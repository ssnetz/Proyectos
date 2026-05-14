#!/bin/bash
# Inicia el servidor PHP integrado en el puerto 8080
# Sirve tanto la API como el frontend React (build de producción)

cd "$(dirname "$0")/backend"
echo "======================================"
echo "  Control de Stock - Iniciando..."
echo "======================================"
echo "  URL: http://localhost:8080"
echo "  API: http://localhost:8080/api/"
echo "--------------------------------------"
echo "  Para detener: Ctrl+C"
echo "======================================"
php -S 0.0.0.0:8080 index.php
