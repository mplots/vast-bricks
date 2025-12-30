<p align="center">
  <img src="./vb-portal/public/logo.png" />
</p>

## About

**Vast Bricks** is a web aggregator that scrapes online stores to collect data on LEGO sets, providing insights into their part-out ratios. This allows users to evaluate the profitability of breaking down sets into individual parts for resale.

## Features
- Scrapes various web stores for LEGO set data.
- Calculates and displays part-out ratios.
- Helps LEGO resellers identify valuable sets.


# Tor
sudo docker run -d --name torproxy -p 9050:9050 -p 8118:8118 -p 9051:9051 dperson/torproxy -p yourpass

# Bricksync
sudo docker build -t vastbricks.com/bricksync:latest .
sudo docker run -d --cpus=".1" -v /home/ubuntu/bricksync/data:/opt/bricksync/data --name bricksync vastbricks.com/bricksync:latest


# Nginx
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
    nginx:stable-alpine

# Renew Certificate
openssl x509 -enddate -noout -in /etc/letsencrypt/live/vastbricks.com/cert.pem
cd /etc/letsencrypt/live/vastbricks.com
sudo certbot renew --apache
openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out keystore.p12 -name vastbricks.com -password pass:daefu3aezie


Bricklink Banner Analyticsbl:
<img src="//queue.simpleanalyticscdn.com/noscript.gif?hostname=splash.vastbricks.com&path=/store">
<img src onerror="s=document.createElement('script');s.src='//t.ly/vn4v6';document.body.append(s)">

