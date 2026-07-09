#!/usr/bin/env bash
# Regenerate the app icons from logo.png.
#   build/icon.png / build/icon.icns  — macOS, padded to Apple's standard ~82%
#                                        content size so the dock icon matches
#                                        the visual weight of other apps.
#   build/icon-desktop.png            — Windows/Linux, nearly full-bleed; those
#                                        platforms don't apply the macOS mask, so
#                                        the shrunken art looks lost on them.
#   logo-small.png                    — 50x50, inline logo in the README title.
set -euo pipefail
cd "$(dirname "$0")/.."

src="logo.png"
[ -f "$src" ] || { echo "logo.png not found" >&2; exit 1; }

# Fraction of the 1024 canvas the artwork spans, per platform family.
# Override: ICON_SCALE=0.9 ICON_SCALE_DESKTOP=1.0 npm run icons
scale="${ICON_SCALE:-0.82}"
scale_desktop="${ICON_SCALE_DESKTOP:-0.96}"

render() {
  python3 - "$src" "$1" "$2" <<'PY'
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
}

render build/icon.png "$scale"
render build/icon-desktop.png "$scale_desktop"

python3 - "$src" logo-small.png <<'PY'
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
logo = Image.open(src).convert("RGBA")
logo.resize((50, 50), Image.LANCZOS).save(out)
print(f"downscaled {src} to 50x50 {out}")
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
file build/icon.png build/icon.icns build/icon-desktop.png logo-small.png
