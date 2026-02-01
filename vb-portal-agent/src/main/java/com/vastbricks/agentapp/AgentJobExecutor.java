package com.vastbricks.agentapp;

import com.vastbricks.agent.v1.JobAssignment;
import com.vastbricks.agent.v1.JobType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;

@Component
public class AgentJobExecutor {
    private static final Logger logger = LoggerFactory.getLogger(AgentJobExecutor.class);

    private final AgentClientProperties properties;

    public AgentJobExecutor(AgentClientProperties properties) {
        this.properties = properties;
    }

    public JobExecutionResult execute(JobAssignment assignment) {
        if (assignment.getJobType() != JobType.JOB_TYPE_CYPRESS_PDF) {
            return new JobExecutionResult(false, "Unsupported job type", null, Map.of());
        }

        String command = assignment.getCommand();
        if (command == null || command.isBlank()) {
            command = properties.getCypressCommand();
        }

        Map<String, String> env = new HashMap<>();
        env.putAll(assignment.getEnvMap());
        if (!assignment.getBaseUrl().isBlank()) {
            env.put("CYPRESS_BASE_URL", assignment.getBaseUrl());
        }
        if (!assignment.getSpec().isBlank()) {
            env.put("CYPRESS_SPEC", assignment.getSpec());
        }

        String pdfPath = assignment.getPdfPath();
        if (pdfPath == null || pdfPath.isBlank()) {
            pdfPath = properties.getDefaultPdfPath();
        }
        env.put("PDF_PATH", pdfPath);

        File workDir = resolveWorkDir();
        writeDotEnv(workDir, env);

        ProcessBuilder builder = new ProcessBuilder("/bin/sh", "-lc", command);
        builder.directory(workDir);
        builder.environment().putAll(env);
        builder.redirectErrorStream(true);

        String output;
        int exitCode;
        try {
            Process process = builder.start();
            output = readOutput(process.getInputStream());
            exitCode = process.waitFor();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new JobExecutionResult(false, "Execution interrupted", null, Map.of());
        } catch (IOException ex) {
            return new JobExecutionResult(false, "Execution failed: " + ex.getMessage(), null, Map.of());
        }

        if (output != null && !output.isBlank()) {
            logger.info("Cypress output:\n{}", output);
        }

        if (exitCode != 0) {
            return new JobExecutionResult(false, "Command failed with exit code " + exitCode + ": " + output, null, Map.of());
        }

        Path pdfFile = resolvePdfFile(Path.of(workDir.getPath()), pdfPath);
        if (pdfFile == null || !Files.exists(pdfFile)) {
            return new JobExecutionResult(false, "PDF not found", null, Map.of());
        }

        try {
            long size = Files.size(pdfFile);
            if (size > properties.getMaxPdfBytes()) {
                return new JobExecutionResult(false, "PDF exceeds max size limit", null, Map.of());
            }
            byte[] bytes = Files.readAllBytes(pdfFile);
            Map<String, String> meta = readMetaForPdf(pdfFile);
            return new JobExecutionResult(true, output, bytes, meta);
        } catch (IOException ex) {
            logger.warn("Failed to read PDF {}: {}", pdfFile, ex.getMessage());
            return new JobExecutionResult(false, "Failed to read PDF", null, Map.of());
        }
    }

    private String readOutput(InputStream inputStream) throws IOException {
        try (InputStream in = inputStream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString();
        }
    }

    private Path resolvePdfFile(Path workDir, String pdfPath) {
        Path candidate = workDir.resolve(pdfPath);
        if (Files.isDirectory(candidate)) {
            try (Stream<Path> files = Files.list(candidate)) {
                return files
                        .filter(file -> file.getFileName().toString().toLowerCase().endsWith(".pdf"))
                        .max(Comparator.comparingLong(file -> file.toFile().lastModified()))
                        .orElse(null);
            } catch (IOException ex) {
                return null;
            }
        }
        return candidate;
    }

    private File resolveWorkDir() {
        File configured = new File(properties.getWorkDir());
        if (configured.exists()) {
            return configured;
        }
        File fallback = new File("vb-cypress-manspasts");
        if (fallback.exists()) {
            return fallback;
        }
        File parentFallback = new File("..", "vb-cypress-manspasts");
        if (parentFallback.exists()) {
            return parentFallback;
        }
        return configured;
    }

    private Map<String, String> readMetaForPdf(Path pdfFile) {
        Path metaPath = pdfFile.getParent() != null ? pdfFile.getParent().resolve("meta.json") : null;
        if (metaPath == null || !Files.exists(metaPath)) {
            return Map.of();
        }
        try {
            var json = new ObjectMapper().readTree(Files.readString(metaPath));
            Map<String, String> meta = new HashMap<>();
            String price = json.path("price").asText(null);
            String deliveryDays = json.path("deliveryDays").asText(null);
            if (price != null && !price.isBlank()) {
                meta.put("price", price);
            }
            if (deliveryDays != null && !deliveryDays.isBlank()) {
                meta.put("deliveryDays", deliveryDays);
            }
            return meta;
        } catch (IOException ex) {
            return Map.of();
        }
    }

    private void writeDotEnv(File workDir, Map<String, String> env) {
        if (env.isEmpty()) {
            return;
        }
        Path dotEnv = Path.of(workDir.getPath(), ".env");
        StringBuilder content = new StringBuilder();
        env.forEach((key, value) -> {
            if (key == null || key.isBlank()) {
                return;
            }
            String safeValue = value == null ? "" : value.replace("\n", "\\n");
            content.append(key).append('=').append(safeValue).append(System.lineSeparator());
        });
        try {
            Files.writeString(dotEnv, content.toString());
        } catch (IOException ex) {
            logger.warn("Failed to write .env file: {}", ex.getMessage());
        }
    }
}
