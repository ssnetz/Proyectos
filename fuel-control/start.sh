#!/bin/bash
# Levanta el frontend en modo dev y el backend PHP
cd "$(dirname "$0")"

echo "Instalando dependencias del frontend..."
cd frontend && npm install

echo "Iniciando servidor de desarrollo (puerto 3001)..."
npm run dev &

echo ""
echo "Frontend: http://localhost:3001/fuel-control/"
echo "Backend PHP (XAMPP): copiar carpeta fuel-control/ a htdocs/"
