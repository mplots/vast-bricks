FROM --platform=linux/amd64 alpine:3.21.3

RUN apk add --no-cache \
    curl \
    unzip \
    bash \
    libc6-compat \
    ca-certificates \
    tar

WORKDIR /opt/bricksync

RUN curl -L -o bricksync.zip https://github.com/ZZJHONS/Bricksync/releases/download/v1.7.4-Feb2nd2024/bricksync-linux64.zip \
    && unzip bricksync.zip \
    && tar -xzf bricksync-linux64-1.7.4-30.tar.gz \
    && rm bricksync.zip \
    && rm bricksync-linux64-1.7.4-30.tar.gz \
    && mv bricksync-linux64/* . \
    && rmdir bricksync-linux64 \
    && mkdir -p /opt/bricksync/defaults \
    && cp data/bricksync.conf.txt /opt/bricksync/defaults/bricksync.conf.txt \
    && chmod +x ./bricksync

RUN <<'EOF'
cat > /usr/local/bin/vb-bricksync-test-entrypoint <<'SCRIPT'
#!/bin/sh
set -eu

BRICKSYNC_HOME="${BRICKSYNC_HOME:-/opt/bricksync}"
CONTROL_DIR="${BRICKSYNC_CONTROL_DIR:-$BRICKSYNC_HOME/control}"
COMMAND_FIFO="${BRICKSYNC_COMMAND_FIFO:-$CONTROL_DIR/commands.fifo}"
CONFIG_FILE="$BRICKSYNC_HOME/data/bricksync.conf.txt"
INPUT_FIFO="/tmp/bricksync-stdin.fifo"

mkdir -p "$CONTROL_DIR" "$BRICKSYNC_HOME/data"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing BrickSync config: $CONFIG_FILE" >&2
  echo "Mount a data directory containing bricksync.conf.txt at $BRICKSYNC_HOME/data." >&2
  exit 1
fi

if [ -e "$COMMAND_FIFO" ] && [ ! -p "$COMMAND_FIFO" ]; then
  echo "Command path exists but is not a FIFO: $COMMAND_FIFO" >&2
  exit 1
fi

if [ ! -p "$COMMAND_FIFO" ]; then
  mkfifo "$COMMAND_FIFO"
fi

rm -f "$INPUT_FIFO"
mkfifo "$INPUT_FIFO"

cd "$BRICKSYNC_HOME"

echo "BrickSync test container ready."
echo "Command FIFO: $COMMAND_FIFO"

while true; do
  cat "$COMMAND_FIFO"
done > "$INPUT_FIFO" &
bridge_pid="$!"

./bricksync < "$INPUT_FIFO" &
bricksync_pid="$!"

wait "$bricksync_pid"
status="$?"

kill "$bridge_pid" 2>/dev/null || true
wait "$bridge_pid" 2>/dev/null || true

exit "$status"
SCRIPT
chmod +x /usr/local/bin/vb-bricksync-test-entrypoint
EOF

ENV PATH="/opt/bricksync:${PATH}"

ENTRYPOINT ["/usr/local/bin/vb-bricksync-test-entrypoint"]
