#!/usr/bin/env python3
"""Per-faction station backdrops: assets/factions/<volk>/ui/bg-<screen>.png (1280x720).

Each faction gets its own look and architecture on top of the shared station rooms (assets/ui/hs-bg-*.png):
a gradient-mapped palette plus pixel-art architecture drawn on a 320x180 grid and scaled x4.
Painted art replaces any of these: just save a file with the same name (the CSS blocks in assets/factions/<volk>/gui.css prefer it and
falls back to the default room). Run again to regenerate:  python3 tools/build-faction-station-bgs.py
"""
import os, random, math
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENS = ['station', 'upgrade', 'hangar', 'shop', 'craft', 'travel', 'explorations', 'menu', 'profiles']
SOURCE = {'menu': 'menu-hangar-bg.png', 'profiles': 'profiles-bg.png'}   # everything else: hs-bg-<screen>.png
LW, LH, K = 320, 180, 4
RAMPS = {
    'terran':   [(4, 8, 18), (20, 44, 80), (86, 140, 196), (214, 236, 255)],
    'kronax':   [(8, 2, 2), (60, 16, 8), (190, 70, 24), (255, 200, 100)],
    'voidborn': [(4, 2, 12), (34, 12, 70), (130, 50, 170), (230, 180, 255)],
    'pirate':   [(8, 5, 3), (48, 30, 16), (150, 110, 48), (232, 214, 160)],
    'machine':  [(2, 8, 8), (8, 40, 40), (30, 170, 150), (190, 255, 235)],
}

def ramp_map(im, ramp, keep=0.22):
    g = im.convert('L')
    lut = []
    for v in range(256):
        t = v / 255 * (len(ramp) - 1); i = min(len(ramp) - 2, int(t)); f = t - i
        lut.append(tuple(round(ramp[i][c] + (ramp[i + 1][c] - ramp[i][c]) * f) for c in range(3)))
    px = g.load(); out = Image.new('RGB', im.size); o = out.load(); src = im.convert('RGB').load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            m = lut[px[x, y]]; s = src[x, y]
            o[x, y] = tuple(round(m[c] * (1 - keep) + s[c] * keep) for c in range(3))
    return out

def glow(layer, cx, cy, r, col, a):
    d = ImageDraw.Draw(layer)
    for i in range(r, 0, -2):
        d.ellipse([cx - i, cy - i, cx + i, cy + i], fill=col + (int(a * (1 - i / r) ** 1.6),))

def terran(d, layer, rnd, s):
    for side in (0, 1):
        x0 = 0 if side == 0 else LW - 26
        d.rectangle([x0, 0, x0 + 25, LH], fill=(10, 18, 34, 235))
        for y in range(0, LH, 14): d.line([x0, y, x0 + 25, y], fill=(60, 90, 130, 200))
        d.line([x0 + (25 if side == 0 else 0), 0, x0 + (25 if side == 0 else 0), LH], fill=(120, 170, 220, 255))
        for y in range(6, LH, 14):
            for x in (x0 + 4, x0 + 21): d.point((x, y), fill=(190, 220, 255, 255))
    d.rectangle([0, 0, LW, 9], fill=(8, 14, 28, 235))
    for x in range(0, LW, 22): d.line([x, 0, x + 11, 9], fill=(90, 130, 180, 220)); d.line([x + 11, 9, x + 22, 0], fill=(90, 130, 180, 220))
    for k in range(3):                                                    # light shafts
        x = rnd.randint(50, LW - 50); w = rnd.randint(6, 14)
        d.polygon([(x, 9), (x + w, 9), (x + w + 22, LH), (x - 8, LH)], fill=(170, 210, 255, 26))
    d.rectangle([0, LH - 12, LW, LH], fill=(8, 14, 28, 235))
    for x in range(26, LW - 26, 16): d.polygon([(x, LH - 12), (x + 8, LH - 12), (x + 4, LH - 6)], fill=(230, 190, 70, 190))

def kronax(d, layer, rnd, s):
    glow(layer, LW // 2, LH + 20, 150, (255, 110, 30), 150)
    for side in (0, 1):
        for step in range(7):                                             # stepped stone buttresses
            w = 34 - step * 3; x0 = 0 if side == 0 else LW - w; y0 = step * 25
            d.rectangle([x0, y0, x0 + w, LH], fill=(18 + step * 2, 8, 6, 245))
            for by in range(y0, LH, 8):
                for bx in range(x0 + (by // 8 % 2) * 6, x0 + w, 12): d.rectangle([bx, by, bx + 10, by + 6], outline=(60, 24, 14, 200))
    d.polygon([(34, 0), (LW // 2, 34), (LW - 34, 0)], fill=(12, 5, 4, 230))        # arch lintel
    for k in range(4):
        x = rnd.randint(50, LW - 50); y = rnd.randint(20, 60)
        for yy in range(0, y, 3): d.rectangle([x, yy, x + 1, yy + 1], fill=(90, 90, 96, 230))
        d.ellipse([x - 2, y, x + 3, y + 5], outline=(150, 150, 156, 230))
    for k in range(70):
        x = rnd.randint(30, LW - 30); y = rnd.randint(50, LH)
        d.point((x, y), fill=(255, rnd.randint(120, 210), 40, rnd.randint(140, 255)))

def voidborn(d, layer, rnd, s):
    glow(layer, LW // 2, 50 + s * 6, 90, (150, 60, 220), 90)
    for k in range(9):                                                    # crystal spires from the floor
        x = 10 + k * 36 + rnd.randint(-8, 8); h = rnd.randint(40, 100); w = rnd.randint(10, 18)
        d.polygon([(x, LH), (x + w // 2, LH - h), (x + w, LH)], fill=(14, 6, 34, 235), outline=(150, 90, 230, 230))
        d.line([x + w // 2, LH - h, x + w // 2, LH], fill=(200, 150, 255, 160))
    for k in range(5):
        x = rnd.randint(0, LW); h = rnd.randint(20, 60); w = rnd.randint(8, 14)
        d.polygon([(x, 0), (x + w // 2, h), (x + w, 0)], fill=(14, 6, 34, 235), outline=(150, 90, 230, 200))
    for r in (46, 58, 70):
        d.ellipse([LW // 2 - r * 1.6, 56 - r, LW // 2 + r * 1.6, 56 + r], outline=(190, 120, 255, 70))
    for k in range(80): d.point((rnd.randint(0, LW), rnd.randint(0, LH)), fill=(230, 190, 255, rnd.randint(90, 230)))

def pirate(d, layer, rnd, s):
    for side in (0, 1):
        for k in range(6):                                               # curved hull ribs
            x0 = k * 11 if side == 0 else LW - k * 11 - 10
            d.arc([x0 - 70, -20 - k * 4, x0 + 70, LH + 40], 90 if side == 0 else 270, 270 if side == 0 else 450, fill=(60 + k * 6, 38 + k * 3, 20, 240), width=5)
    for k in range(3):                                                    # sagging ropes
        y = 12 + k * 8; x0 = rnd.randint(0, 80); x1 = LW - rnd.randint(0, 80)
        pts = [(x0 + (x1 - x0) * t / 24, y + math.sin(t / 24 * math.pi) * (10 + k * 3)) for t in range(25)]
        d.line(pts, fill=(120, 96, 60, 230), width=2)
    for lx in (rnd.randint(50, 110), rnd.randint(210, 270)):              # lanterns
        glow(layer, lx, 40, 38, (255, 170, 60), 120)
        d.line([lx, 0, lx, 34], fill=(40, 30, 20, 230)); d.rectangle([lx - 3, 34, lx + 3, 44], fill=(255, 210, 100, 255), outline=(40, 30, 20, 255))
    for bx in (30, LW - 56):                                              # barrels and crates in the corners
        d.rectangle([bx, LH - 38, bx + 26, LH], fill=(40, 26, 14, 245))
        for yy in (LH - 34, LH - 20, LH - 6): d.line([bx, yy, bx + 26, yy], fill=(150, 120, 60, 230))
    d.rectangle([0, LH - 8, LW, LH], fill=(30, 20, 12, 245))
    for x in range(0, LW, 10): d.line([x, LH - 8, x, LH], fill=(10, 6, 4, 255))

def machine(d, layer, rnd, s):
    for side in (0, 1):
        x0 = 0 if side == 0 else LW - 30
        d.rectangle([x0, 0, x0 + 29, LH], fill=(3, 12, 12, 240))
        for y in range(4, LH - 6, 9):
            d.rectangle([x0 + 3, y, x0 + 26, y + 6], outline=(14, 70, 66, 255))
            for i in range(4): d.point((x0 + 6 + i * 5, y + 3), fill=((60, 255, 210, 255) if rnd.random() < 0.6 else (10, 90, 80, 255)))
    for k in range(10):                                                  # circuit traces
        x, y = rnd.randint(34, LW - 34), rnd.randint(10, LH - 10); pts = [(x, y)]
        for st in range(rnd.randint(3, 6)):
            if st % 2 == 0: x += rnd.choice((-1, 1)) * rnd.randint(14, 50)
            else: y += rnd.choice((-1, 1)) * rnd.randint(10, 30)
            x = max(34, min(LW - 34, x)); y = max(6, min(LH - 6, y)); pts.append((x, y))
        d.line(pts, fill=(40, 220, 190, 120), width=1)
        for p in pts: d.rectangle([p[0] - 1, p[1] - 1, p[0] + 1, p[1] + 1], fill=(160, 255, 235, 220))
    for x in range(30, LW - 30, 18):
        for y in range(0, 14, 7): d.polygon([(x + (y // 7) * 9, y), (x + 6 + (y // 7) * 9, y), (x + 9 + (y // 7) * 9, y + 4), (x + 6 + (y // 7) * 9, y + 8), (x + (y // 7) * 9, y + 8), (x - 3 + (y // 7) * 9, y + 4)], outline=(20, 100, 92, 200))


# Menu + pilot-wizard hangars: a bolder, brighter faction look on top of the shared per-faction art.
LIFT = {'terran': 1.7, 'kronax': 1.6, 'voidborn': 1.7, 'pirate': 1.7, 'machine': 1.7}
ACCENT = {'terran': (126, 200, 255), 'kronax': (255, 120, 40), 'voidborn': (190, 110, 255), 'pirate': (255, 190, 80), 'machine': (60, 255, 210)}

def hangar_scene(fac, d, layer, rnd):
    c = ACCENT[fac]
    glow(layer, LW // 2, LH - 10, 120, c, 130)                           # floor wash in the faction colour
    glow(layer, LW // 2, 70, 80, c, 70)                                  # bay door / window halo
    if fac == 'terran':                                                  # clean docking bay: gantry beams + hazard-free grid floor
        for x in range(40, LW - 40, 40): d.rectangle([x, 10, x + 3, 120], fill=(20, 40, 70, 200), outline=c + (160,))
        for y in (30, 60, 90): d.line([30, y, LW - 30, y], fill=c + (110,))
        for x in range(30, LW - 30, 20): d.line([x, LH - 24, LW // 2 + (x - LW // 2) // 3, 120], fill=c + (90,))
    elif fac == 'kronax':                                                # forge hall: braziers + molten floor cracks + hanging chains
        for bx in (60, LW - 60):
            d.rectangle([bx - 6, LH - 46, bx + 6, LH - 30], fill=(30, 10, 6, 255), outline=(150, 60, 20, 255))
            glow(layer, bx, LH - 50, 40, (255, 140, 40), 200)
            for k in range(10): d.point((bx + rnd.randint(-6, 6), LH - 50 - rnd.randint(0, 26)), fill=(255, 210, 90, 255))
        for k in range(14):
            x = rnd.randint(40, LW - 40); y = LH - 4; pts = [(x, y)]
            for st in range(5): x += rnd.randint(-8, 8); y -= rnd.randint(4, 10); pts.append((x, y))
            d.line(pts, fill=(255, 150, 40, 230))
    elif fac == 'voidborn':                                              # rift chamber: floating shards + central rift
        for k in range(14):
            x, y, r = rnd.randint(40, LW - 40), rnd.randint(20, LH - 60), rnd.randint(3, 9)
            d.polygon([(x, y - r * 2), (x + r, y), (x, y + r * 2), (x - r, y)], fill=(30, 10, 70, 240), outline=c + (255,))
        d.ellipse([LW // 2 - 22, 40, LW // 2 + 22, 104], outline=c + (255,), width=2)
        d.ellipse([LW // 2 - 12, 54, LW // 2 + 12, 90], fill=(240, 200, 255, 220))
    elif fac == 'pirate':                                                # scrapyard dock: hanging junk, patched plates, bright lamps
        for k in range(10):
            x, y = rnd.randint(30, LW - 60), rnd.randint(14, 100); w, h = rnd.randint(14, 30), rnd.randint(8, 16)
            d.rectangle([x, y, x + w, y + h], fill=(70 + rnd.randint(0, 40), 46, 26, 255), outline=(200, 150, 70, 255))
            d.point((x + 2, y + 2), fill=(255, 230, 150, 255)); d.point((x + w - 2, y + h - 2), fill=(255, 230, 150, 255))
        d.line([0, 14, 90, 70], fill=(220, 170, 80, 255), width=2); d.line([LW, 14, LW - 90, 70], fill=(220, 170, 80, 255), width=2)
    else:                                                                # machine: server racks + data streams
        for x in range(36, LW - 36, 24):
            d.rectangle([x, 20, x + 16, LH - 30], fill=(2, 14, 14, 235), outline=c + (200,))
            for y in range(26, LH - 36, 6): d.point((x + 3 + rnd.randint(0, 9), y), fill=c + (255,) if rnd.random() < 0.5 else (20, 90, 80, 255))
        for x in range(50, LW - 50, 30): d.line([x, 0, x, LH], fill=c + (70,))

PAINT = dict(terran=terran, kronax=kronax, voidborn=voidborn, pirate=pirate, machine=machine)

# ---- Fully drawn per-faction hangars (menu / profiles / hangar): own room shape, not the recoloured shared image ----
# pal: wall, floor, ceiling, trim, accent, deep (dark recess)
HPAL = {
    'terran':   dict(wall=(28, 52, 88),  floor=(18, 32, 56), ceil=(14, 26, 48), trim=(120, 175, 225), acc=(126, 200, 255), deep=(6, 12, 26)),
    'kronax':   dict(wall=(58, 26, 16),  floor=(30, 12, 8),  ceil=(24, 10, 6),  trim=(150, 70, 30),   acc=(255, 120, 40),  deep=(10, 3, 2)),
    'voidborn': dict(wall=(44, 20, 84),  floor=(22, 10, 44), ceil=(18, 8, 38),  trim=(140, 80, 210),  acc=(190, 110, 255), deep=(6, 2, 16)),
    'pirate':   dict(wall=(84, 54, 28),  floor=(48, 30, 16), ceil=(40, 26, 14), trim=(190, 140, 70),  acc=(255, 190, 80),  deep=(14, 8, 4)),
    'machine':  dict(wall=(6, 40, 40),   floor=(4, 24, 24),  ceil=(3, 18, 18),  trim=(24, 120, 110),  acc=(60, 255, 210),  deep=(1, 8, 8)),
}

def hangar_base(fac, scr, rnd):
    """320x180 hangar: perspective room (ceiling / side walls / floor / back wall) with faction architecture."""
    P = HPAL[fac]; im = Image.new('RGBA', (LW, LH), P['deep'] + (255,)); d = ImageDraw.Draw(im)
    cx = LW // 2; bw, bh = (70, 46) if fac != 'pirate' else (60, 60); bx0, bx1 = cx - bw, cx + bw; by0 = 40; by1 = by0 + bh * 2
    if fac == 'kronax': bx0, bx1, by0 = cx - 56, cx + 56, 30
    hl = by1 - 18                                                          # horizon / floor line of the back wall
    d.polygon([(0, 0), (LW, 0), (bx1, by0), (bx0, by0)], fill=P['ceil'] + (255,))
    d.polygon([(0, 0), (bx0, by0), (bx0, hl), (0, LH)], fill=P['wall'] + (255,))
    d.polygon([(LW, 0), (bx1, by0), (bx1, hl), (LW, LH)], fill=tuple(round(v * 0.85) for v in P['wall']) + (255,))
    d.polygon([(0, LH), (bx0, hl), (bx1, hl), (LW, LH)], fill=P['floor'] + (255,))
    d.rectangle([bx0, by0, bx1, hl], fill=P['deep'] + (255,))
    c = P['acc']; t = P['trim']
    def rib(u, col, w=1):                                                  # a frame ring at depth u (0 = camera, 1 = back wall)
        x0 = round(0 + (bx0 - 0) * u); x1 = round(LW + (bx1 - LW) * u); y0 = round(0 + by0 * u); y1 = round(LH + (hl - LH) * u)
        return x0, y0, x1, y1
    if fac == 'terran':                                                    # square steel bay: ribs, ceiling gantry, grid floor, wide shutter
        for u in (0.12, 0.3, 0.46, 0.6, 0.72, 0.82, 0.9):
            x0, y0, x1, y1 = rib(u, t); d.rectangle([x0, y0, x1, y1], outline=t + (255,), width=2 if u < 0.5 else 1)
            d.rectangle([x0, y0, x1, y0 + max(2, round(6 * (1 - u)))], fill=(10, 20, 38, 255))
        for k in range(1, 8): d.line([cx - 150 + k * 40, LH, cx + (k - 4) * 16, hl], fill=t + (110,))
        for k in range(0, 5): y = hl + (LH - hl) * (k / 5) ** 1.8; d.line([0, y, LW, y], fill=t + (90,))
        for k in range(4): d.rectangle([bx0 + 6, by0 + 6 + k * 14, bx1 - 6, by0 + 12 + k * 14], fill=(34, 62, 100, 255), outline=t + (255,))
        d.rectangle([bx0, hl - 3, bx1, hl], fill=(220, 180, 60, 255))
        for x in range(bx0, bx1, 8): d.polygon([(x, hl - 3), (x + 4, hl - 3), (x + 2, hl)], fill=(20, 20, 20, 255))
        for x in (18, LW - 18):
            for y in range(20, LH - 20, 24): d.rectangle([x - 3, y, x + 3, y + 10], fill=(220, 240, 255, 255), outline=t + (255,))
    elif fac == 'kronax':                                                  # stone forge hall: stepped ziggurat arches, masonry, lava channel
        for step in range(7):
            u = 0.1 + step * 0.13; x0, y0, x1, y1 = rib(u, t); w = 12 - step
            d.rectangle([x0, y0, x0 + w, y1], fill=(34 + step * 6, 14, 8, 255), outline=t + (255,))
            d.rectangle([x1 - w, y0, x1, y1], fill=(34 + step * 6, 14, 8, 255), outline=t + (255,))
            d.rectangle([x0, y0, x1, y0 + w], fill=(26 + step * 6, 10, 6, 255), outline=t + (255,))
        for y in range(0, LH, 9):                                          # masonry joints on the side walls
            for x in range(4 + (y // 9 % 2) * 8, bx0 - 6, 16): d.line([x, y, x + 12, y], fill=(20, 8, 4, 255)); d.line([x, y, x, y + 8], fill=(20, 8, 4, 255))
        d.polygon([(bx0 - 8, hl), (cx - 14, by0 + 4), (cx + 14, by0 + 4), (bx1 + 8, hl)], outline=t + (255,))
        d.polygon([(cx - 20, LH), (cx - 5, hl), (cx + 5, hl), (cx + 20, LH)], fill=(255, 120, 30, 255))   # molten channel
        d.polygon([(cx - 10, LH), (cx - 2, hl), (cx + 2, hl), (cx + 10, LH)], fill=(255, 210, 90, 255))
        for bx in (50, LW - 50):
            d.polygon([(bx - 10, LH), (bx - 6, LH - 40), (bx + 6, LH - 40), (bx + 10, LH)], fill=(24, 10, 6, 255), outline=t + (255,))
            d.polygon([(bx - 6, LH - 40), (bx, LH - 62), (bx + 6, LH - 40)], fill=(255, 150, 40, 255))
    elif fac == 'voidborn':                                                # crystal cavern: pointed vault, spires, central rift
        for k in range(14):
            x = rnd.randint(0, LW); h = rnd.randint(20, 78); w = rnd.randint(8, 18)
            d.polygon([(x, 0), (x + w // 2, h), (x + w, 0)], fill=(20, 8, 46, 255), outline=t + (255,))
        for k in range(12):
            x = rnd.randint(0, LW); h = rnd.randint(18, 70); w = rnd.randint(10, 20)
            d.polygon([(x, LH), (x + w // 2, LH - h), (x + w, LH)], fill=(24, 10, 52, 255), outline=t + (255,))
            d.line([x + w // 2, LH - h, x + w // 2, LH], fill=c + (150,))
        for r in (30, 44, 58, 72): d.ellipse([cx - r * 0.7, hl - 30 - r, cx + r * 0.7, hl - 30 + r], outline=c + (150,), width=2)
        d.ellipse([cx - 13, hl - 56, cx + 13, hl - 8], fill=(240, 205, 255, 255), outline=c + (255,), width=2)
        for k in range(12):
            x, y, r = rnd.randint(30, LW - 30), rnd.randint(20, LH - 50), rnd.randint(3, 8)
            d.polygon([(x, y - r * 2), (x + r, y), (x, y + r * 2), (x - r, y)], fill=(34, 12, 80, 255), outline=c + (255,))
    elif fac == 'pirate':                                                  # ship-hull hold: wooden ribs, round bulkhead door, ropes, patched plates
        for k in range(9):
            u = 0.08 + k * 0.1; x0, y0, x1, y1 = rib(u, t); w = max(2, round(9 * (1 - u)))
            d.arc([x0 - 36, y0 - 20, x1 + 36, y1 + 50], 180, 360, fill=(70, 44, 22, 255), width=w)
            d.line([x0, y0 + 20, x0, y1], fill=(70, 44, 22, 255), width=w); d.line([x1, y0 + 20, x1, y1], fill=(70, 44, 22, 255), width=w)
        d.ellipse([cx - 40, by0 + 2, cx + 40, hl - 2], fill=(20, 12, 6, 255), outline=t + (255,), width=3)    # round bulkhead
        d.ellipse([cx - 28, by0 + 14, cx + 28, hl - 14], fill=(50, 90, 110, 255), outline=(150, 110, 50, 255), width=2)
        for k in range(8): a = k * math.pi / 4; d.point((cx + math.cos(a) * 34, (by0 + hl) // 2 + math.sin(a) * 34), fill=(255, 230, 150, 255))
        for y in range(hl, LH, 7): d.line([0, y, LW, y], fill=(24, 14, 8, 255))           # plank floor
        for k in range(3):
            y = 14 + k * 9; x0 = rnd.randint(0, 60); x1 = LW - rnd.randint(0, 60)
            d.line([(x0 + (x1 - x0) * s / 24, y + math.sin(s / 24 * math.pi) * (9 + k * 3)) for s in range(25)], fill=(150, 120, 74, 255), width=2)
        for k in range(7):
            x, y = rnd.choice([rnd.randint(4, bx0 - 20), rnd.randint(bx1 + 6, LW - 24)]), rnd.randint(30, LH - 50); w, h = rnd.randint(12, 26), rnd.randint(8, 14)
            d.rectangle([x, y, x + w, y + h], fill=(100 + rnd.randint(0, 40), 66, 34, 255), outline=(210, 160, 80, 255)); d.point((x + 2, y + 2), fill=(255, 230, 150, 255))
    else:                                                                  # machine: hex-plated server hall, rack walls, circuit floor
        for k in range(8):
            u = 0.1 + k * 0.11; x0, y0, x1, y1 = rib(u, t)
            for side, xs in ((0, x0), (1, x1)):
                for y in range(y0, y1, max(4, round(10 * (1 - u) + 4))):
                    d.rectangle([xs - (8 if side else 0), y, xs + (0 if side else 8), y + max(2, round(6 * (1 - u)))], fill=(2, 16, 16, 255), outline=t + (255,))
                    d.point((xs + (3 if side else 3), y + 1), fill=c + (255,) if rnd.random() < 0.6 else (14, 80, 70, 255))
        for k in range(1, 9): d.line([cx - 160 + k * 40, LH, cx + (k - 4.5) * 10, hl], fill=t + (150,))
        for k in range(14):
            x, y = rnd.randint(10, LW - 10), rnd.randint(hl + 2, LH - 4); pts = [(x, y)]
            for st in range(4): x += rnd.choice((-1, 1)) * rnd.randint(8, 28); pts.append((max(4, min(LW - 4, x)), y)); y = min(LH - 2, y + rnd.randint(3, 10)); pts.append((pts[-1][0], y))
            d.line(pts, fill=c + (170,))
        for x in range(bx0 + 4, bx1, 10): d.line([x, by0, x, hl], fill=t + (200,)); yy = by0 + rnd.randint(4, bh * 2 - 30); d.rectangle([x - 1, yy, x + 1, yy + 3], fill=c + (255,))
        d.rectangle([bx0, by0, bx1, hl], outline=c + (255,), width=2)
    # shared: back-wall bay glow, floor wash, light pools, pixel grain
    layer = Image.new('RGBA', (LW, LH), (0, 0, 0, 0)); gd = ImageDraw.Draw(layer)
    glow(layer, cx, hl - 20, 90, c, 110); glow(layer, cx, LH + 10, 130, c, 90)
    for x in (cx - 100, cx - 40, cx + 40, cx + 100): glow(layer, x, 8, 22, c, 120)
    im = Image.alpha_composite(im, layer)
    px = im.load()
    for y in range(LH):
        for x in range(LW):
            if (x + y) % 2 == 0 and rnd.random() < 0.18:
                r, g, b, a = px[x, y]; k = 0.88 if rnd.random() < 0.5 else 1.12; px[x, y] = (min(255, round(r * k)), min(255, round(g * k)), min(255, round(b * k)), 255)
    return im

HANGAR_SCREENS = ('menu', 'profiles', 'hangar')

def save_png(im, path):
    # 256-colour palette PNG: the art is flat pixel blocks, so it looks the same at roughly a third of the size.
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)

def main():
    for fac, ramp in RAMPS.items():
        out_dir = os.path.join(ROOT, 'assets', 'factions', fac, 'ui'); os.makedirs(out_dir, exist_ok=True)
        for si, scr in enumerate(SCREENS):
            rnd = random.Random(sum(map(ord, fac)) * 131 + si * 977)
            if scr in HANGAR_SCREENS:                                      # own drawn hangar in the faction's architecture
                out = hangar_base(fac, scr, rnd).resize((LW * K, LH * K), Image.NEAREST).convert('RGB')
                save_png(out, os.path.join(out_dir, f'bg-{scr}.png'))
                print(fac, scr, '(hangar)'); continue
            base = Image.open(os.path.join(ROOT, 'assets', 'ui', SOURCE.get(scr, f'hs-bg-{scr}.png'))).convert('RGBA')
            mapped = ramp_map(base.convert('RGB'), ramp, 0.22).convert('RGBA')
            layer = Image.new('RGBA', (LW, LH), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
            PAINT[fac](d, layer, rnd, si)
            layer = layer.resize((LW * K, LH * K), Image.NEAREST)
            out = Image.alpha_composite(mapped, layer).convert('RGB')
            save_png(out, os.path.join(out_dir, f'bg-{scr}.png'))
            print(fac, scr)

if __name__ == '__main__':
    main()
