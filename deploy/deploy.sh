#!/usr/bin/env bash
# Arma el bundle de producción de un proyecto (backend/api + backend/config +
# frontend build) y lo sincroniza por rsync/ssh a /var/www/html/<destino> en
# el servidor. Pensado para correr desde GitHub Actions, pero también sirve
# a mano: HOSTINGER_HOST=x HOSTINGER_USER=root ./deploy/deploy.sh <proyecto>
#
# config/database.php NUNCA se sube: la primera vez se crea en el servidor a
# partir de config/database.php.dist, y de ahí en más el deploy no la toca,
# así las credenciales reales de producción no se pisan en cada push.
#
# Si frontend/ tiene package.json se compila (npm ci && npm run build); si
# no, pero existe frontend/dist ya commiteado, se copia tal cual (proyectos
# sin código fuente de frontend disponible, solo el build).
#
# Archivos opcionales por proyecto:
#   .deploy-target   nombre de la carpeta remota, si difiere del nombre del
#                    proyecto en el repo.
#   .deploy-keep     rutas (una por línea, relativas a la carpeta remota) que
#                    nunca se borran aunque no estén en el bundle — para
#                    archivos que solo existen en el servidor.

set -euo pipefail

PROJECT="${1:?Uso: deploy.sh <nombre-del-proyecto>}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$REPO_ROOT/$PROJECT"
BUNDLE="/tmp/deploy-bundle/$PROJECT"

: "${HOSTINGER_HOST:?falta HOSTINGER_HOST}"
: "${HOSTINGER_USER:?falta HOSTINGER_USER}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "No existe la carpeta $PROJECT_DIR" >&2
    exit 1
fi

TARGET="$PROJECT"
if [ -f "$PROJECT_DIR/.deploy-target" ]; then
    TARGET="$(tr -d '[:space:]' < "$PROJECT_DIR/.deploy-target")"
fi
REMOTE_PATH="/var/www/html/$TARGET"

echo "==> Armando bundle para $PROJECT (destino: $TARGET)"
rm -rf "$BUNDLE"
mkdir -p "$BUNDLE"

if [ -f "$PROJECT_DIR/frontend/package.json" ]; then
    echo "==> Build del frontend"
    (cd "$PROJECT_DIR/frontend" && npm ci && npm run build)
    cp -r "$PROJECT_DIR/frontend/dist/." "$BUNDLE/"
elif [ -d "$PROJECT_DIR/frontend/dist" ]; then
    # Sin código fuente del frontend (solo el build ya compilado, commiteado
    # tal cual) — se copia directo, sin paso de build.
    echo "==> Frontend sin fuente disponible, copiando el build ya compilado"
    cp -r "$PROJECT_DIR/frontend/dist/." "$BUNDLE/"
fi

if [ -d "$PROJECT_DIR/backend/api" ]; then
    cp -r "$PROJECT_DIR/backend/api" "$BUNDLE/api"
fi

if [ -d "$PROJECT_DIR/backend/config" ]; then
    mkdir -p "$BUNDLE/config"
    for f in "$PROJECT_DIR/backend/config"/*; do
        base="$(basename "$f")"
        if [ "$base" = "database.php" ]; then
            # Nunca se sube tal cual; queda como plantilla .dist
            cp "$f" "$BUNDLE/config/database.php.dist"
        else
            cp "$f" "$BUNDLE/config/$base"
        fi
    done
fi

sed "s#__BASE__#/$TARGET/#g" "$REPO_ROOT/deploy/htaccess.template" > "$BUNDLE/.htaccess"

RSYNC_EXCLUDES=(--exclude 'config/database.php')
if [ -f "$PROJECT_DIR/.deploy-keep" ]; then
    while IFS= read -r keep; do
        [ -z "$keep" ] && continue
        RSYNC_EXCLUDES+=(--exclude "$keep")
    done < "$PROJECT_DIR/.deploy-keep"
fi

RSYNC_FLAGS=(-az --delete --itemize-changes)
if [ "${DRY_RUN:-0}" = "1" ]; then
    RSYNC_FLAGS+=(--dry-run)
    echo "==> DRY RUN: mostrando qué cambiaría, sin tocar nada, en $HOSTINGER_USER@$HOSTINGER_HOST:$REMOTE_PATH"
else
    echo "==> Sincronizando con $HOSTINGER_USER@$HOSTINGER_HOST:$REMOTE_PATH"
fi
ssh -o StrictHostKeyChecking=accept-new "$HOSTINGER_USER@$HOSTINGER_HOST" "mkdir -p '$REMOTE_PATH'"

rsync "${RSYNC_FLAGS[@]}" \
    "${RSYNC_EXCLUDES[@]}" \
    -e "ssh -o StrictHostKeyChecking=accept-new" \
    "$BUNDLE/" "$HOSTINGER_USER@$HOSTINGER_HOST:$REMOTE_PATH/"

if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "==> DRY RUN terminado, no se modificó nada en el servidor."
    exit 0
fi

echo "==> Verificando config/database.php en el servidor"
ssh -o StrictHostKeyChecking=accept-new "$HOSTINGER_USER@$HOSTINGER_HOST" \
    "test -f '$REMOTE_PATH/config/database.php' || cp '$REMOTE_PATH/config/database.php.dist' '$REMOTE_PATH/config/database.php'"

echo "==> Listo: $PROJECT desplegado en $REMOTE_PATH"
