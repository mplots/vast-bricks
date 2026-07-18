package com.vastbricks.bricksync;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class BrickSyncService {
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
