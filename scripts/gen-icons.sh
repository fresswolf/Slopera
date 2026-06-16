#!/usr/bin/env bash
# Regenerate build/icon.png and build/icon.icns from logo.png.
# The logo is placed on a transparent 1024x1024 canvas at Apple's standard
# content size (~82%) so it matches the visual weight of other macOS dock icons
# instead of filling the whole square edge-to-edge.
set -euo pipefail
cd "$(dirname "$0")/.."

src="logo.png"
[ -f "$src" ] || { echo "logo.png not found" >&2; exit 1; }

# Fraction of the 1024 canvas the artwork should span. Override: ICON_SCALE=0.9 npm run icons
scale="${ICON_SCALE:-0.82}"

python3 - "$src" build/icon.png "$scale" <<'PY'
import sys
from PIL import Image

src, out, scale = sys.argv[1], sys.argv[2], float(sys.argv[3])
canvas = 1024
content = round(canvas * scale)

logo = Image.open(src).convert("RGBA")
ratio = content / max(logo.width, logo.height)
logo = logo.resize((round(logo.width * ratio), round(logo.height * ratio)), Image.LANCZOS)

img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
img.paste(logo, ((canvas - logo.width) // 2, (canvas - logo.height) // 2), logo)
img.save(out)
print(f"padded {logo.width}x{logo.height} logo onto {canvas}x{canvas} canvas (scale {scale})")
PY

iconset="$(mktemp -d)/icon.iconset"
mkdir -p "$iconset"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" build/icon.png --out "$iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" build/icon.png --out "$iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o build/icon.icns

echo "icons regenerated:"
file build/icon.png build/icon.icns
