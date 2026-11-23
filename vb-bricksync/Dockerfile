# Upstream builds the Linux release on an Ubuntu runner against glibc and OpenSSL 3; musl cannot load it.
FROM --platform=linux/amd64 ubuntu:24.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates libssl3t64 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/bricksync

ARG BRICKSYNC_RELEASE=v1.7.4-261028
ARG BRICKSYNC_SHA256=7d15a1a2e3ac254ca6365f166ea230b9fb0bed2d064b2e5520bc4001680e1c66

RUN curl -fL -o bricksync.tar.gz "https://github.com/ZZJHONS/Bricksync/releases/download/${BRICKSYNC_RELEASE}/bricksync-linux64.tar.gz" \
    && echo "${BRICKSYNC_SHA256}  bricksync.tar.gz" | sha256sum -c - \
    && tar -xzf bricksync.tar.gz \
    && rm bricksync.tar.gz \
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

# Closes BrickSync's stdin. Its exit blocks on the stdin lock its reader thread holds while waiting for input, so it
# can only finish once that read sees end of file, and the bridge and its cat both hold the write end open.
stop_bridge() {
  bridge_children="$(pgrep -P "$bridge_pid" || true)"
  kill "$bridge_pid" 2>/dev/null || true
  [ -z "$bridge_children" ] || kill $bridge_children 2>/dev/null || true
}

# BrickSync saves its state and stops cleanly on SIGTERM, but as PID 1 this shell would never pass docker stop on.
trap 'kill -TERM "$bricksync_pid" 2>/dev/null || true; stop_bridge' TERM INT

# A forwarded signal interrupts the wait before BrickSync has finished, so wait again until it has exited.
status=0
wait "$bricksync_pid" || status="$?"
while kill -0 "$bricksync_pid" 2>/dev/null; do
  status=0
  wait "$bricksync_pid" || status="$?"
done

stop_bridge
wait "$bridge_pid" 2>/dev/null || true

exit "$status"
SCRIPT
chmod +x /usr/local/bin/vb-bricksync-test-entrypoint
EOF

ENV PATH="/opt/bricksync:${PATH}"

ENTRYPOINT ["/usr/local/bin/vb-bricksync-test-entrypoint"]
