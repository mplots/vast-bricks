# Vast Portal

## IntelliJ development

Run `vb-portal-api` from IntelliJ on its default port `6161`, then use the
**Vast Portal** npm run configuration. It runs Vite on `http://localhost:3200`
and proxies `/api/**` to the legacy API.

`./vast services start vast-portal` remains separate: it runs on port `3100`
and proxies to the managed `vast-api` service on port `6363`.

## Production deployment

The **Deploy** run configuration deploys the whole application. It builds the
backend with `clean install -Pprod`, builds the portal against `.env`, copies
the `dist/` tree over as a tarball and the `vb-portal-api` JAR to
`vastbricks.com`, unpacks the portal over `/opt/nginx/vast-portal`, reloads the
`nginx-proxy` container, restarts the `bricks` service, and then tails its log.
It needs SSH access to `ubuntu@vastbricks.com` and passwordless `sudo` there.
