# Tor proxy

Tor with an HTTP CONNECT proxy on 8118, SOCKS on 9050 and the control port on 9051, which is what the Tor clients
in `vast-services` and `vb-portal-api` expect. Locally `./vast services start tor-proxy` builds and runs it through
`docker-compose.yml`.

The network periodically makes newer protocols mandatory, and a Tor that does not speak them exits. When that
happens, rebuild the image to pick up a current Tor from Alpine.

## Production

```sh
docker build -t vastbricks.com/tor-proxy:latest .

docker run -d \
  --name torproxy \
  --restart unless-stopped \
  -p 127.0.0.1:8118:8118 \
  -p 127.0.0.1:9050:9050 \
  -p 127.0.0.1:9051:9051 \
  vastbricks.com/tor-proxy:latest
```

Publish on `127.0.0.1` only: the ports are an open proxy and a control port, and the application reaches them from
the host. Set `TOR_CONTROL_PASSWORD` with `-e` to change the control password from the default `yourpass`.
