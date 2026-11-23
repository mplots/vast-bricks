# Replaces dperson/torproxy, whose Tor stopped running once the network required protocols it does not speak.
# Rebuild this image to pick up a current Tor from Alpine; the network will eventually outgrow any pinned release.
FROM alpine:3.22

RUN apk add --no-cache tor

# 8118 is an HTTP CONNECT proxy, which is all the Tor clients send: every Tor-routed call is HTTPS.
# 9051 is the control port the clients use to switch circuits.
RUN printf '%s\n' \
        'SocksPort 0.0.0.0:9050' \
        'HTTPTunnelPort 0.0.0.0:8118' \
        'ControlPort 0.0.0.0:9051' \
        'DataDirectory /var/lib/tor' \
        'Log notice stdout' \
        > /etc/tor/torrc \
    && chown -R tor /var/lib/tor

ENV TOR_CONTROL_PASSWORD=yourpass

USER tor
EXPOSE 8118 9050 9051

ENTRYPOINT ["/bin/sh", "-c", "exec tor -f /etc/tor/torrc --HashedControlPassword \"$(tor --quiet --hash-password \"$TOR_CONTROL_PASSWORD\")\""]
