FROM cypress/base:22.19.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        dbus \
        dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/vb-cypress-manspasts
COPY package.json package-lock.json /app/vb-cypress-manspasts/
RUN npm ci --omit=optional && npm cache clean --force

COPY . /app/vb-cypress-manspasts

ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
ENV CYPRESS_VERIFY_TIMEOUT=60000
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null
ENV XDG_RUNTIME_DIR=/tmp
