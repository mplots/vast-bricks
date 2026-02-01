package com.vastbricks.agent;

import io.grpc.Server;
import io.grpc.ServerInterceptors;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

@Component
public class GrpcServerLifecycle implements SmartLifecycle {
    private static final Logger logger = LoggerFactory.getLogger(GrpcServerLifecycle.class);

    private final GrpcServerProperties serverProperties;
    private final AgentServiceImpl agentService;
    private final AgentApiKeyInterceptor apiKeyInterceptor;

    private volatile Server server;
    private volatile boolean running = false;

    public GrpcServerLifecycle(
            GrpcServerProperties serverProperties,
            AgentServiceImpl agentService,
            AgentApiKeyInterceptor apiKeyInterceptor) {
        this.serverProperties = serverProperties;
        this.agentService = agentService;
        this.apiKeyInterceptor = apiKeyInterceptor;
    }

    @Override
    public void start() {
        if (running) {
            return;
        }

        server = NettyServerBuilder.forPort(serverProperties.getPort())
                .maxInboundMessageSize(serverProperties.getMaxInboundMessageBytes())
                .addService(ServerInterceptors.intercept(agentService, apiKeyInterceptor))
                .build();

        try {
            server.start();
            running = true;
            logger.info("gRPC server started on port {}", serverProperties.getPort());
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to start gRPC server", ex);
        }
    }

    @Override
    public void stop() {
        if (server != null) {
            server.shutdown();
            running = false;
        }
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
