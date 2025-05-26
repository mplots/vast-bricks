FROM alpine:3.21.3

# Install required packages
RUN apk add --no-cache \
    curl \
    unzip \
    bash \
    libc6-compat \
    ca-certificates \
    tar

# Set working directory
WORKDIR /opt/bricksync

# Download and unzip BrickSync binary
RUN curl -L -o bricksync.zip https://github.com/ZZJHONS/Bricksync/releases/download/v1.7.4-Feb2nd2024/bricksync-linux64.zip \
    && unzip bricksync.zip \
    && tar -xzf bricksync-linux64-1.7.4-30.tar.gz \
    && rm bricksync.zip \
    && rm bricksync-linux64-1.7.4-30.tar.gz \
    && mv bricksync-linux64/* . \
    && chmod +x bricksync-linux64/bricksync

# Optional: add to PATH
ENV PATH="/opt/bricksync:${PATH}"

# Default command
CMD ["./bricksync"]
