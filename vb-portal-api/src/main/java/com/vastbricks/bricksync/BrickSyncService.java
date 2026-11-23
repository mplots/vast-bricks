package com.vastbricks.bricksync;

import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
public class BrickSyncService {
    /** The commands that read a BrickStore file. BrickSync documents each as taking the file path and nothing else. */
    private static final Set<String> FILE_COMMANDS = new LinkedHashSet<>(List.of("add", "merge", "loadprices"));
    private static final String IMPORTS_DIRECTORY = "imports";
    private static final DateTimeFormatter IMPORT_FILE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");
    /** Longer than a command write, since a whole inventory goes through docker exec. */
    private static final Duration FILE_WRITE_TIMEOUT = Duration.ofSeconds(30);
    private static final String EXPORTS_DIRECTORY = "exports";
    /** How long a backup may take to appear, generous because BrickSync takes commands one at a time. */
    private static final Duration BACKUP_TIMEOUT = Duration.ofSeconds(60);
    private static final Duration BACKUP_POLL = Duration.ofMillis(500);

    private final BrickSyncProperties properties;

    public BrickSyncService(BrickSyncProperties properties) {
        this.properties = properties;
    }

    public void sendCommand(String command) {
        String normalized = validateCommand(command);
        Path pipe = Path.of(properties.getCommandPipe());
        ProcessBuilder builder = Files.exists(pipe) ? hostPipeCommand(normalized, pipe) : dockerExecCommand(normalized);

        Process process = start(builder, "write command");
        waitFor(process, Duration.ofSeconds(properties.getCommandTimeoutSeconds()), "Timed out writing command to BrickSync");
    }

    /**
     * Writes pasted BSX content to a file BrickSync can read and sends the command with its path.
     *
     * <p>The file lands in an imports directory beside the command pipe, which is the directory the host and the
     * container already share. It is kept rather than deleted: BrickSync reads it some time after the command is
     * queued, and nothing reports when it has finished. The name carries the command and the time, so the directory
     * doubles as a record of what was imported.
     *
     * @return the command as sent, path included
     */
    public String sendFileCommand(String command, String bsx) {
        String verb = StringUtils.trimToEmpty(command).toLowerCase(Locale.ROOT);
        if (!FILE_COMMANDS.contains(verb)) {
            throw new BrickSyncException(HttpStatus.BAD_REQUEST, "Command must be one of " + String.join(", ", FILE_COMMANDS));
        }
        if (StringUtils.isBlank(bsx) || !StringUtils.containsIgnoreCase(bsx, "<BrickStoreXML")) {
            throw new BrickSyncException(HttpStatus.BAD_REQUEST, "Paste the content of a BrickStore .bsx file");
        }

        String fileName = verb + "-" + LocalDateTime.now().format(IMPORT_FILE_TIME) + ".bsx";
        String containerFile = Path.of(properties.getContainerCommandPipe()).resolveSibling(IMPORTS_DIRECTORY)
                .resolve(fileName).toString();
        Path pipe = Path.of(properties.getCommandPipe());
        if (Files.exists(pipe)) {
            writeHostFile(pipe.resolveSibling(IMPORTS_DIRECTORY).resolve(fileName), bsx);
        } else {
            writeContainerFile(containerFile, bsx);
        }

        String sent = verb + " " + containerFile;
        sendCommand(sent);
        return sent;
    }

    /**
     * Has BrickSync save its current inventory with {@code backup} and returns the file it wrote.
     *
     * <p>BrickSync answers a command only in its log, so the file itself is the signal: it is read until it holds
     * the closing root element, which a file still being written does not. The backup lands in an exports directory
     * beside the command pipe, the directory host and container already share, and is kept there as a dated copy.
     */
    public BrickSyncBackupResponse backupInventory() {
        String fileName = "inventory-" + LocalDateTime.now().format(IMPORT_FILE_TIME) + ".bsx";
        String containerFile = Path.of(properties.getContainerCommandPipe()).resolveSibling(EXPORTS_DIRECTORY)
                .resolve(fileName).toString();
        Path pipe = Path.of(properties.getCommandPipe());
        Path hostFile = Files.exists(pipe) ? pipe.resolveSibling(EXPORTS_DIRECTORY).resolve(fileName) : null;

        // BrickSync is not known to create a missing directory, so it exists before the command is sent.
        if (hostFile != null) {
            try {
                Files.createDirectories(hostFile.getParent());
            } catch (IOException ex) {
                throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Failed to create exports directory: " + ex.getMessage());
            }
        } else {
            containerShell("mkdir -p \"$(dirname \"$1\")\"", containerFile, "create exports directory");
        }

        sendCommand("backup " + containerFile);

        long deadline = System.nanoTime() + BACKUP_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            String content = hostFile != null ? readHostFile(hostFile) : containerShell("cat \"$1\" 2>/dev/null || true", containerFile, "read inventory backup");
            if (StringUtils.containsIgnoreCase(content, "</BrickStoreXML>")) {
                return new BrickSyncBackupResponse(fileName, content);
            }
            sleep(BACKUP_POLL);
        }
        throw new BrickSyncException(HttpStatus.GATEWAY_TIMEOUT,
                "BrickSync did not finish writing the inventory backup within " + BACKUP_TIMEOUT.toSeconds() + " seconds");
    }

    private String readHostFile(Path file) {
        try {
            return Files.exists(file) ? Files.readString(file, StandardCharsets.UTF_8) : "";
        } catch (IOException ex) {
            throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Failed to read inventory backup: " + ex.getMessage());
        }
    }

    private String containerShell(String script, String file, String action) {
        ProcessBuilder builder = new ProcessBuilder("docker", "exec", properties.getContainerName(), "sh", "-c", script, "sh", file);
        return waitFor(start(builder, action), FILE_WRITE_TIMEOUT, "Timed out trying to " + action);
    }

    private void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Interrupted while waiting for the inventory backup");
        }
    }

    private void writeHostFile(Path file, String content) {
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, content, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Failed to write BSX file: " + ex.getMessage());
        }
    }

    private void writeContainerFile(String file, String content) {
        ProcessBuilder builder = new ProcessBuilder(
                "docker",
                "exec",
                "-i",
                properties.getContainerName(),
                "sh",
                "-c",
                "mkdir -p \"$(dirname \"$1\")\" && cat > \"$1\"",
                "sh",
                file
        );
        Process process = start(builder, "write BSX file");
        try (OutputStream stdin = process.getOutputStream()) {
            stdin.write(content.getBytes(StandardCharsets.UTF_8));
        } catch (IOException ex) {
            process.destroyForcibly();
            throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Failed to write BSX file: " + ex.getMessage());
        }
        waitFor(process, FILE_WRITE_TIMEOUT, "Timed out writing BSX file to BrickSync");
    }

    public BrickSyncLogsResponse getLogs(Integer requestedTail) {
        int tail = normalizeTail(requestedTail);
        ProcessBuilder builder = new ProcessBuilder("docker", "logs", "--tail", String.valueOf(tail), properties.getContainerName());
        Process process = start(builder, "read logs");
        String output = waitFor(process, Duration.ofSeconds(5), "Timed out reading BrickSync logs");
        return new BrickSyncLogsResponse(properties.getContainerName(), tail, output);
    }

    private String validateCommand(String command) {
        if (command == null || command.trim().isEmpty()) {
            throw new BrickSyncException(HttpStatus.BAD_REQUEST, "Command is required");
        }

        String normalized = command.trim();
        if (normalized.contains("\n") || normalized.contains("\r")) {
            throw new BrickSyncException(HttpStatus.BAD_REQUEST, "Command must be a single line");
        }
        if (normalized.length() > properties.getMaxCommandLength()) {
            throw new BrickSyncException(HttpStatus.BAD_REQUEST, "Command exceeds max length of " + properties.getMaxCommandLength());
        }
        return normalized;
    }

    private int normalizeTail(Integer requestedTail) {
        if (requestedTail == null) {
            return properties.getDefaultLogTail();
        }
        if (requestedTail < 1) {
            throw new BrickSyncException(HttpStatus.BAD_REQUEST, "Tail must be at least 1");
        }
        return Math.min(requestedTail, properties.getMaxLogTail());
    }

    private ProcessBuilder hostPipeCommand(String command, Path pipe) {
        return new ProcessBuilder("sh", "-c", "printf '%s\\n' \"$1\" > \"$2\"", "sh", command, pipe.toString());
    }

    private ProcessBuilder dockerExecCommand(String command) {
        return new ProcessBuilder(
                "docker",
                "exec",
                properties.getContainerName(),
                "sh",
                "-c",
                "printf '%s\\n' \"$1\" > \"$2\"",
                "sh",
                command,
                properties.getContainerCommandPipe()
        );
    }

    private Process start(ProcessBuilder builder, String action) {
        builder.redirectErrorStream(true);
        try {
            return builder.start();
        } catch (IOException ex) {
            throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Failed to " + action + ": " + ex.getMessage());
        }
    }

    private String waitFor(Process process, Duration timeout, String timeoutMessage) {
        try {
            boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new BrickSyncException(HttpStatus.GATEWAY_TIMEOUT, timeoutMessage);
            }

            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.exitValue() != 0) {
                throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, lastLines(output));
            }
            return output;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Interrupted while waiting for BrickSync process");
        } catch (IOException ex) {
            throw new BrickSyncException(HttpStatus.SERVICE_UNAVAILABLE, "Failed reading BrickSync process output: " + ex.getMessage());
        }
    }

    private String lastLines(String output) {
        if (output == null || output.isBlank()) {
            return "BrickSync command failed";
        }
        List<String> lines = output.lines().toList();
        int from = Math.max(0, lines.size() - 20);
        return String.join("\n", lines.subList(from, lines.size()));
    }
}
