# Vast Portal

## IntelliJ development

Run `vb-portal-api` from IntelliJ on its default port `6161`, then use the
**Vast Portal** npm run configuration. It runs Vite on `http://localhost:3200`
and proxies `/api/**` to the legacy API.

`./vast services start vast-portal` remains separate: it runs on port `3100`
and proxies to the managed API on port `6362`.
