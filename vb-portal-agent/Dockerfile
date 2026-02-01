FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /workspace

COPY pom.xml ./
COPY vb-portal-grpc/pom.xml vb-portal-grpc/pom.xml
COPY vb-portal-api/pom.xml vb-portal-api/pom.xml
COPY vb-portal-agent/pom.xml vb-portal-agent/pom.xml

RUN mvn -q -pl vb-portal-agent -am -DskipTests package || true

COPY vb-portal-grpc vb-portal-grpc
COPY vb-portal-api vb-portal-api
COPY vb-portal-agent vb-portal-agent
COPY vb-cypress-manspasts vb-cypress-manspasts

RUN mvn -pl vb-portal-agent -am -DskipTests package

RUN $JAVA_HOME/bin/jlink \
    --add-modules java.base,java.logging,java.naming,java.management,java.sql,java.security.jgss,jdk.crypto.ec,jdk.unsupported,java.desktop \
    --strip-debug \
    --no-header-files \
    --no-man-pages \
    --compress=2 \
    --output /opt/java-runtime

FROM cypress/included:13.6.2

RUN rm -f /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates gnupg \
    && wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y --no-install-recommends /tmp/google-chrome.deb \
    && rm -f /tmp/google-chrome.deb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /opt/java-runtime /opt/java
COPY --from=builder /workspace/vb-portal-agent/target/vb-portal-agent-1.0.jar /app/vb-portal-agent.jar
COPY --from=builder /workspace/vb-cypress-manspasts /app/vb-cypress-manspasts

RUN cd /app/vb-cypress-manspasts && npm ci

ENV JAVA_HOME=/opt/java
ENV PATH=/opt/java/bin:$PATH
ENV AGENT_WORK_DIR=/app/vb-cypress-manspasts

ENTRYPOINT ["java", "-jar", "/app/vb-portal-agent.jar"]
