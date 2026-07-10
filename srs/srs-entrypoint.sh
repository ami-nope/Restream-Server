#!/bin/sh
# Configures SRS with dynamic backend connection hosts and ports

BACKEND_HOST=${BACKEND_HOST:-app}
BACKEND_PORT=${BACKEND_PORT:-3001}

echo "Configuring SRS with BACKEND_HOST=${BACKEND_HOST} and BACKEND_PORT=${BACKEND_PORT}..."

# Resolve variables by rewriting placeholder srs.conf to active config file
sed "s/\[BACKEND_HOST\]/${BACKEND_HOST}/g; s/\[BACKEND_PORT\]/${BACKEND_PORT}/g" /usr/local/srs/conf/srs.conf.template > /usr/local/srs/conf/srs.conf

echo "Starting SRS..."
exec /usr/local/srs/objs/srs -c /usr/local/srs/conf/srs.conf
