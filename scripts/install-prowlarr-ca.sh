#!/bin/sh
# Install the TRAWL MITM CA certificate into the Prowlarr container trust store.
#
# Prowlarr talks to TRAWL via HTTPS (MITM proxy). Without this CA, every TLS
# request fails with "unable to get local issuer certificate".
#
# Usage (from the server host):
#   docker exec prowlarr sh /path/to/install-prowlarr-ca.sh
#
# Or as a one-liner:
#   docker exec prowlarr sh -c 'curl -sf http://trawl:8191/proxy-ca.crt \
#     -o /usr/local/share/ca-certificates/trawl-mitm.crt && update-ca-certificates'

set -e

CERT_DEST="/usr/local/share/ca-certificates/trawl-mitm.crt"

echo "[trawl-ca] downloading TRAWL MITM CA..."
if ! curl -sf http://trawl:8191/proxy-ca.crt -o "$CERT_DEST"; then
  echo "[trawl-ca] ERROR: could not reach trawl:8191 — is the trawl container up and on the same network?"
  exit 1
fi

echo "[trawl-ca] updating CA certificates..."
update-ca-certificates >/dev/null 2>&1 || true

echo "[trawl-ca] done — Prowlarr now trusts the TRAWL MITM proxy"
