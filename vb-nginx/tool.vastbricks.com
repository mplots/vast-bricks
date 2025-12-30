server {
  listen 80;
  listen [::]:80;

  server_name tool.vastbricks.com;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/acme;
    try_files $uri =404;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;

  http2 on;

  server_name tool.vastbricks.com;

  ssl_certificate     /etc/letsencrypt/live/tool.vastbricks.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tool.vastbricks.com/privkey.pem;

  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;
  ssl_protocols TLSv1.2 TLSv1.3;
  client_max_body_size 10m;

  location / {
    proxy_pass http://host.docker.internal:8080;
  }
}
