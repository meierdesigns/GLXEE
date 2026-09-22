#!/usr/bin/env python3
"""Render IconSprites pixel grids → PNG (same ramp as js/graphics/icon-renderer.js).

Usage:
  python3 tools/render-icon-sprites.py                  # all icons
  python3 tools/render-icon-sprites.py menuAssets       # one key
  python3 tools/render-icon-sprites.py menuAssets --scale 16 --tint FF6A00
"""
from __future__ import annotations

import argparse
import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPRITES_JS = ROOT / "js" / "graphics" / "icon-sprites.js"
OUT_DIR = ROOT / "tools" / "icon-previews"

# Matches IconRenderer.getGray (indices 1–15)
GRAY = [
    None,
    (0x2C, 0x2C, 0x2C),
    (0x38, 0x38, 0x38),
    (0x45, 0x45, 0x45),
    (0x54, 0x54, 0x54),
    (0x64, 0x64, 0x64),
    (0x75, 0x75, 0x75),
    (0x88, 0x88, 0x88),
    (0x9A, 0x9A, 0x9A),
    (0xAD, 0xAD, 0xAD),
    (0xBF, 0xBF, 0xBF),
    (0xD0, 0xD0, 0xD0),
    (0xDE, 0xDE, 0xDE),
    (0xE8, 0xE8, 0xE8),
    (0xF0, 0xF0, 0xF0),
    (0xF8, 0xF8, 0xF8),
]


def parse_sprites(src: str) -> dict[str, list[list[int]]]:
    sprites: dict[str, list[list[int]]] = {}
    # key: [ ... nested rows ... ]
    for m in re.finditer(
        r"(\w+)\s*:\s*\[((?:\s*\[[^\]]*\]\s*,?)+)\s*\]",
        src,
        re.MULTILINE,
    ):
        key = m.group(1)
        body = m.group(2)
        rows: list[list[int]] = []
        for row_m in re.finditer(r"\[([^\]]*)\]", body):
            nums = [int(x) for x in re.findall(r"\d+", row_m.group(1))]
            if nums:
                rows.append(nums)
        if rows:
            sprites[key] = rows
    return sprites


def tint_color(gray_rgb: tuple[int, int, int], tint: tuple[int, int, int] | None) -> tuple[int, int, int]:
    if not tint:
        return gray_rgb
    f = gray_rgb[1] / 255.0
    return (
        int(round(tint[0] * f)),
        int(round(tint[1] * f)),
        int(round(tint[2] * f)),
    )


def render_rgba(sprite: list[list[int]], scale: int, tint: tuple[int, int, int] | None) -> tuple[int, int, bytes]:
    rows = len(sprite)
    cols = len(sprite[0]) if rows else 0
    w, h = cols * scale, rows * scale
    pixels = bytearray(w * h * 4)
    for r, row in enumerate(sprite):
        for c, idx in enumerate(row):
            if not idx:
                continue
            base = GRAY[idx] if 0 < idx < len(GRAY) else None
            if not base:
                continue
            rr, gg, bb = tint_color(base, tint)
            for dy in range(scale):
                for dx in range(scale):
                    x = c * scale + dx
                    y = r * scale + dy
                    i = (y * w + x) * 4
                    pixels[i : i + 4] = bytes((rr, gg, bb, 255))
    return w, h, bytes(pixels)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, w: int, h: int, rgba: bytes) -> None:
    raw = b"".join(b"\x00" + rgba[y * w * 4 : (y + 1) * w * 4] for y in range(h))
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )


def parse_tint(s: str | None) -> tuple[int, int, int] | None:
    if not s:
        return None
    s = s.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    n = int(s, 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def main() -> int:
    ap = argparse.ArgumentParser(description="Render IconSprites grids to PNG")
    ap.add_argument("keys", nargs="*", help="Sprite keys (default: all)")
    ap.add_argument("--scale", type=int, default=16, help="Nearest-neighbor scale (default 16 → 256px)")
    ap.add_argument("--tint", default="FF6A00", help="Hex tint like game menu orange, or '' for gray")
    ap.add_argument("--out", type=Path, default=OUT_DIR, help="Output directory")
    ap.add_argument("--src", type=Path, default=SPRITES_JS, help="icon-sprites.js path")
    args = ap.parse_args()

    src = args.src.read_text(encoding="utf-8")
    sprites = parse_sprites(src)
    if not sprites:
        print("No sprites parsed from", args.src)
        return 1

    keys = args.keys or sorted(sprites.keys())
    tint = parse_tint(args.tint) if args.tint else None
    args.out.mkdir(parents=True, exist_ok=True)

    written = 0
    for key in keys:
        sprite = sprites.get(key)
        if not sprite:
            print("missing:", key)
            continue
        w, h, rgba = render_rgba(sprite, max(1, args.scale), tint)
        out = args.out / f"{key}.png"
        write_png(out, w, h, rgba)
        print(f"{key} → {out.relative_to(ROOT)} ({w}x{h})")
        written += 1

    print(f"done: {written} png(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
