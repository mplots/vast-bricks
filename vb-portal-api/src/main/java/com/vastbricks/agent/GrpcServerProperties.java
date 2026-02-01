package com.vastbricks.agent;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "grpc.server")
public class GrpcServerProperties {
    private int port = 9095;
    private int maxInboundMessageBytes = 20 * 1024 * 1024;

    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }

    public int getMaxInboundMessageBytes() {
        return maxInboundMessageBytes;
    }

    public void setMaxInboundMessageBytes(int maxInboundMessageBytes) {
        this.maxInboundMessageBytes = maxInboundMessageBytes;
    }
}
