#!/usr/bin/env bash
# uso: ./grid.sh [carpeta_svg] [salida.webp] [tamaño_icono] [columnas] [fondo]
set -euo pipefail

DIR="${1:-.}"
OUT="${2:-icons-grid.webp}"
SIZE="${3:-64}"
COLS="${4:-16}"
BG="${5:-none}"   # ej: '#1e1e1e'

command -v rsvg-convert >/dev/null || { echo "falta rsvg-convert (librsvg)"; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# SVG -> PNG en paralelo
find "$DIR" -maxdepth 1 -name '*.svg' -print0 \
  | xargs -0 -P"$(nproc)" -I{} sh -c \
    'rsvg-convert -a -w "$1" -h "$1" -o "$2/$(basename "$3" .svg).png" "$3"' _ "$SIZE" "$TMP" {}

# grid -> webp lossless
montage "$TMP"/*.png \
  -background "$BG" \
  -geometry "${SIZE}x${SIZE}+12+12" \
  -tile "${COLS}x" \
  -define webp:lossless=true \
  "$OUT"
