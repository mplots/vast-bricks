package com.vastbricks.agent;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class AgentApiKeyInterceptor implements ServerInterceptor {
    private static final Logger logger = LoggerFactory.getLogger(AgentApiKeyInterceptor.class);
    private static final Metadata.Key<String> API_KEY_HEADER =
            Metadata.Key.of("x-api-key", Metadata.ASCII_STRING_MARSHALLER);

    private final AgentProperties agentProperties;

    public AgentApiKeyInterceptor(AgentProperties agentProperties) {
        this.agentProperties = agentProperties;
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {
        String expectedKey = agentProperties.getApiKey();
        if (expectedKey == null || expectedKey.isBlank()) {
            return next.startCall(call, headers);
        }

        String providedKey = headers.get(API_KEY_HEADER);
        if (!expectedKey.equals(providedKey)) {
            logger.warn("Rejected agent call: invalid API key");
            call.close(Status.UNAUTHENTICATED.withDescription("Invalid API key"), new Metadata());
            return new ServerCall.Listener<>() {};
        }

        return next.startCall(call, headers);
    }
}
