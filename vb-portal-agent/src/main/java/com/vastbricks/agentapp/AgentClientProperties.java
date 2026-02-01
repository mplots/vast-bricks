package com.vastbricks.agentapp;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "agent")
public class AgentClientProperties {
    private String id;
    private String name = "vb-agent";
    private String version = "1.0";
    private List<String> capabilities = new ArrayList<>();
    private String apiKey;
    private long heartbeatIntervalSeconds = 30;
    private String cypressCommand = "npm run cypress:run -- --browser ${CYPRESS_BROWSER:-electron}";
    private String workDir = ".";
    private long maxPdfBytes = 10 * 1024 * 1024;
    private String defaultPdfPath = "cypress/output/report.pdf";
    private Server server = new Server();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public List<String> getCapabilities() {
        return capabilities;
    }

    public void setCapabilities(List<String> capabilities) {
        this.capabilities = capabilities;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public long getHeartbeatIntervalSeconds() {
        return heartbeatIntervalSeconds;
    }

    public void setHeartbeatIntervalSeconds(long heartbeatIntervalSeconds) {
        this.heartbeatIntervalSeconds = heartbeatIntervalSeconds;
    }

    public String getCypressCommand() {
        return cypressCommand;
    }

    public void setCypressCommand(String cypressCommand) {
        this.cypressCommand = cypressCommand;
    }

    public String getWorkDir() {
        return workDir;
    }

    public void setWorkDir(String workDir) {
        this.workDir = workDir;
    }

    public long getMaxPdfBytes() {
        return maxPdfBytes;
    }

    public void setMaxPdfBytes(long maxPdfBytes) {
        this.maxPdfBytes = maxPdfBytes;
    }

    public String getDefaultPdfPath() {
        return defaultPdfPath;
    }

    public void setDefaultPdfPath(String defaultPdfPath) {
        this.defaultPdfPath = defaultPdfPath;
    }

    public Server getServer() {
        return server;
    }

    public void setServer(Server server) {
        this.server = server;
    }

    public static class Server {
        private String host = "localhost";
        private int port = 9095;

        public String getHost() {
            return host;
        }

        public void setHost(String host) {
            this.host = host;
        }

        public int getPort() {
            return port;
        }

        public void setPort(int port) {
            this.port = port;
        }
    }
}
