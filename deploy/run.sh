#!/usr/bin/env bash
# Deploy EVIDIQ Notary as a Docker container behind the shared Coolify Traefik
# proxy on the mcp.evidiq.dev box. Routed by PathPrefix(/notary) with the prefix
# stripped, so the container still sees /mcp, /x402, /health. Secrets come from
# the env file, never baked into the image. Mirrors the sibling MCP deploys.
#
# The host port is bound to 127.0.0.1 on purpose: Traefik reaches the container
# over the `coolify` network, so publishing it on all interfaces would expose the
# MCP over plain HTTP with no TLS and bypass the proxy entirely.
set -euo pipefail

IMAGE="${IMAGE:-evidiq-notary:latest}"
NAME="${NAME:-evidiq-notary}"
NETWORK="${NETWORK:-coolify}"
ENV_FILE="${ENV_FILE:-/root/evidiq-notary.env}"
HOST_PORT="${HOST_PORT:-3001}"

docker rm -f "$NAME" >/dev/null 2>&1 || true

docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:${HOST_PORT}:3000 \
  --label 'traefik.enable=true' \
  --label 'traefik.http.middlewares.notary-strip.stripprefix.prefixes=/notary' \
  --label 'traefik.http.routers.notary-mcp.middlewares=notary-strip' \
  --label 'traefik.http.routers.notary-mcp.rule=Host(`mcp.evidiq.dev`) && PathPrefix(`/notary`)' \
  --label 'traefik.http.routers.notary-mcp.tls=true' \
  --label 'traefik.http.routers.notary-mcp.tls.certresolver=letsencrypt' \
  --label 'traefik.http.services.notary-mcp.loadbalancer.server.port=3000' \
  "$IMAGE"

echo "started:"
docker ps --filter "name=^/${NAME}$" --format '{{.Names}}  {{.Status}}'
