#!/bin/sh
set -e

mkdir -p /etc/nginx/certs

if [ ! -f /etc/nginx/certs/selfsigned.crt ]; then
    echo "Generating self-signed SSL certificate for HTTPS (Port 443)..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/selfsigned.key \
      -out /etc/nginx/certs/selfsigned.crt \
      -subj "/CN=3.7.73.152.sslip.io/O=Codity/C=IN"
fi

exec "$@"
