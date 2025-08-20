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


# Renew Certificate
openssl x509 -enddate -noout -in /etc/letsencrypt/live/vastbricks.com/cert.pem
cd /etc/letsencrypt/live/vastbricks.com
sudo certbot renew --apache
openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out keystore.p12 -name vastbricks.com -password pass:daefu3aezie


Bricklink Banner Analyticsbl:
<img src="//queue.simpleanalyticscdn.com/noscript.gif?hostname=splash.vastbricks.com&path=/store">
<img src onerror="s=document.createElement('script');s.src='//t.ly/vn4v6';document.body.append(s)">


Salidzini scrape:
fetch('http://localhost:6161/api/offers').then(r => r.json()).then(data => data.reduce((p, o) => p.then(() => new Promise(r => setTimeout(r, 10000))).then(() => fetch(`https://www.salidzini.lv/cena?q=lego+${encodeURIComponent(o.setNumber)}`)).then(r => r.text()).then(t => fetch('http://localhost:6161/api/salidzini', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({setNumber: o.setNumber, html: t})})), Promise.resolve()));
