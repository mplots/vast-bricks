<p align="center">
  <img src="./vast-portal/public/logo.png" />
</p>

## About

**Vast Bricks** is a web aggregator that scrapes online stores to collect data on LEGO sets, providing insights into their part-out ratios. This allows users to evaluate the profitability of breaking down sets into individual parts for resale.

## Features
- Scrapes various web stores for LEGO set data.
- Calculates and displays part-out ratios.
- Helps LEGO resellers identify valuable sets.

## Rewritten backend

`vast-api` is the standalone Spring Boot launcher. `vast-services` contains all
rewritten controllers and business logic. Both `vast-api` and the legacy
`vb-portal-api` launch the features provided by `vast-services`.

Build and start the standalone service:

```bash
mvn -pl vast-api -am package -DskipTests
java -jar vast-api/target/vast-api-1.0-exec.jar
```

It listens on port `6262` by default. Override the port with `VAST_API_PORT`.
The scaffolding health endpoint is available at
`GET /api/health`.

`vast-acceptance-tests` is a test-only launcher that depends on `vast-api` and adds
test-only `/api/test/**` endpoints for acceptance tests. `./vast` runs it in
place of `vast-api`. It is never deployed.

```bash
mvn -pl vast-acceptance-tests -am package -DskipTests
java -jar vast-acceptance-tests/target/vast-acceptance-tests-1.0.jar
```


# Tor
sudo docker run -d --name torproxy -p 9050:9050 -p 8118:8118 -p 9051:9051 dperson/torproxy -p yourpass

# Bricksync
sudo docker build -t vastbricks.com/bricksync:latest .
sudo docker run -d --cpus=".1" -v /home/ubuntu/bricksync/data:/opt/bricksync/data --name bricksync vastbricks.com/bricksync:latest


# Nginx
sudo mkdir -p /opt/nginx/vast-portal

sudo docker run -d \
    --name nginx-proxy \
    -p 80:80 \
    -p 443:443 \
    --add-host=host.docker.internal:host-gateway \
    -v /opt/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
    -v /opt/nginx/sites-enabled:/etc/nginx/sites-enabled:ro \
    -v /etc/letsencrypt:/etc/letsencrypt:ro \
    -v /opt/nginx/logs:/var/log/nginx \
    -v /opt/nginx/acme:/var/www/acme \
    -v /opt/nginx/vast-portal:/usr/share/nginx/html/vast-portal:ro \
    nginx:stable-alpine

## Obtain the portal certificate for the first time
# Standalone Certbot needs exclusive access to host port 80.
sudo docker stop nginx-proxy
sudo certbot certonly --standalone -d portal.vastbricks.com
sudo cp vb-nginx/portal.vastbricks.com.conf /opt/nginx/sites-enabled/portal.vastbricks.com.conf
sudo docker start nginx-proxy
sudo docker exec nginx-proxy nginx -t

## Deploy portal
cd vast-portal
npm ci
npm run build
sudo mkdir -p /opt/nginx/vast-portal
sudo cp -a dist/. /opt/nginx/vast-portal/
sudo cp ../vb-nginx/portal.vastbricks.com.conf /opt/nginx/sites-enabled/
sudo docker exec nginx-proxy nginx -t
sudo docker exec nginx-proxy nginx -s reload

## Vast users
# The API service requires a stable secret of at least 32 bytes. Set this in
# the service environment, then restart the service. Preserve the previous
# PORTAL_JWT_SECRET value when migrating production so existing 12-hour tokens
# remain valid for Vast users created with the same numeric IDs.
VAST_AUTH_JWT_SECRET=replace-with-a-long-random-secret

# Generate a BCrypt hash and insert users directly into PostgreSQL.
htpasswd -bnBC 12 "" "your-password" | tr -d ':\n'

INSERT INTO vast.users (email, password_hash, name, role)
VALUES ('admin@example.com', '$2y$12$...', 'Administrator', 'admin');

# Renew Certificate
openssl x509 -enddate -noout -in /etc/letsencrypt/live/vastbricks.com/cert.pem
cd /etc/letsencrypt/live/vastbricks.com
sudo certbot renew --apache
openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out keystore.p12 -name vastbricks.com -password pass:daefu3aezie


Bricklink Banner Analyticsbl:
<img src="//queue.simpleanalyticscdn.com/noscript.gif?hostname=splash.vastbricks.com&path=/store">
<img src onerror="s=document.createElement('script');s.src='//t.ly/vn4v6';document.body.append(s)">
