#!/usr/bin/env bash
# Trae una copia de solo lectura de una carpeta del servidor hacia el repo,
# para respaldo/comparación. Nunca modifica nada en el servidor (rsync sin
# --delete, sentido único servidor -> local).
#
# Uso: HOSTINGER_HOST=x HOSTINGER_USER=root ./deploy/pull-from-server.sh <carpeta-remota> <carpeta-local-destino>

set -euo pipefail

REMOTE_DIR="${1:?Uso: pull-from-server.sh <carpeta-remota-en-var-www-html> <carpeta-local-destino>}"
LOCAL_DIR="${2:?Uso: pull-from-server.sh <carpeta-remota-en-var-www-html> <carpeta-local-destino>}"

: "${HOSTINGER_HOST:?falta HOSTINGER_HOST}"
: "${HOSTINGER_USER:?falta HOSTINGER_USER}"

mkdir -p "$LOCAL_DIR"

echo "==> Trayendo /var/www/html/$REMOTE_DIR desde $HOSTINGER_USER@$HOSTINGER_HOST hacia $LOCAL_DIR"
rsync -avz \
    -e "ssh -o StrictHostKeyChecking=accept-new" \
    "$HOSTINGER_USER@$HOSTINGER_HOST:/var/www/html/$REMOTE_DIR/" "$LOCAL_DIR/"

echo "==> Listo, sin tocar nada en el servidor."
