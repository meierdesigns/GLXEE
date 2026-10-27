#!/usr/bin/env python3
"""Generates the per-faction "parted graphic" bezel border-image assets
(assets/ui/<faction>-bezel-art[-N].svg, -frame[-N].svg) plus the matching
--fr-shape-<faction> clip-path polygon, in the same format as the hand-built
voidborn assets (assets/ui/voidborn-bezel-vine*.svg).

Offline/manual tool only — not part of any runtime bundle. Run with:
    python3 tools/gen-bezel-art.py <faction> [--frame-only]

Output format matches voidborn exactly: a GRID x GRID pixel grid (default 48),
rendered as an SVG at 2x pixel size with one <path> per color, each path body
built from horizontal run-length-encoded rects ("Mx yh{w}v1h-{w}z" per run).
Corners of the square source image map directly onto the four corners of the
CSS border-image box (no auto-rotation), so the grid is drawn as a symmetric
hollow frame band — fixed art at each 16x16 corner, a repeatable strip along
the middle of each edge.
"""
import sys
import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "ui"

BAND = 32      # solid ring width (== SLICE, so the frame is fully covered).
               # Bumped 16 -> 24 -> 32: each step gave motif pieces more
               # room so they could be drawn as genuinely bigger chunks
               # instead of denser fine detail — reported repeatedly as
               # "zu monoton"/"noch gröbere Elemente" until the band had
               # enough depth for 6x6+ glyph pieces and wide plate segments.
SLICE = BAND   # border-image-slice; also the corner block size
GRID = BAND * 6  # keeps the band/grid ratio (1:6, matching voidborn's own
                 # hand-built proportions) fixed as BAND grows, so the
                 # repeatable mid-edge strip that border-image "round" tiles
                 # stays proportionally long. BAND had grown 16->32 without
                 # GRID following it, so the strip shrank back down to ~32
                 # raw px — too short for any periodic edge detail (rivets,
                 # branch ticks, valve blocks) longer than a few px to ever
                 # appear, leaving a flat repeating comb (reported as "sieht
                 # zu eintönig aus, das muss maschineller aussehen").


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return '#' + ''.join(f'{max(0, min(255, int(round(c)))):02x}' for c in rgb)


def shift(h, amount):
    """Darken (amount<0) or lighten (amount>0) a hex color, amount in [-1,1]."""
    r, g, b = hex_to_rgb(h)
    def ch(v):
        return v * (1 + amount) if amount < 0 else v + (255 - v) * amount
    return rgb_to_hex((ch(r), ch(g), ch(b)))


def build_palette(hull_dark, hull, hull_lit, accent):
    """Derive the small indexed palette (1..8) from the faction's own tokens —
    never introduce new arbitrary colors, only shade ramps off them (same
    trick voidborn's own asset uses: 6 derived tones off 2 base tokens).
    0 stays transparent."""
    return {
        1: hull_dark,                 # outline / recessed seam
        2: hull,                      # base plate
        3: hull_lit,                  # lit sheen (top-left bevel read)
        4: shift(hull, -0.38),        # panel shade (darker facet)
        5: shift(hull, 0.34),         # panel shade (lighter facet)
        6: shift(accent, -0.4),       # accent, dimmed ("off" trace/rivet)
        7: accent,                    # accent, full bright ("lit" trace/rivet)
        8: shift(accent, 0.35),       # accent, hot highlight (sparks/chip glow)
    }


def apply_plate_shading(g, n, band, seed=0, density=22):
    """Sparse dark rivet/pit speckle on the base plate — NOT a hashed
    light/dark block texture. An earlier version also toned 8x6 hashed
    blocks darker/lighter to break up the flat fill; pulled out because it
    competed with apply_bevel_shading for the exact same band cells: tested
    against voidborn's own hand-drawn cross-section (dumped and compared
    tone-by-tone), voidborn's entire ring depth is ONE continuous graded
    bevel with no separate flat/hashed "plate" zone at all — the hash noise
    sitting in the middle of our band was diluting that gradient into a
    patchy, un-plastic-looking surface instead of a clean emboss. Any
    texture now goes on top of the finished bevel as isolated dark pits.
    `density` (0-100) is a per-faction knob: low for a clean parade plate
    (terran), high for battered/grimy surfaces (kronax/pirate)."""
    pw, ph = 8, 6
    def h(a, b, k):
        return (((a * 73856093) ^ (b * 19349663) ^ ((seed + k) * 83492791)) & 0x7fffffff) % 100
    for y in range(n):
        for x in range(n):
            if not g[y][x]:
                continue
            px, py = x // pw, y // ph
            if x % pw == 1 and y % ph == 1 and h(px, py, 2) < density:
                g[y][x] = 1


BEVEL_STYLES = {
    # (seam_u, highlight_u, falloff_u) — all in units of u = band/8, matching
    # voidborn's own 8-cell-deep ring. plateau fills whatever's left between
    # seam+highlight and falloff. highlight_u=0 skips the specular zone
    # entirely (falls straight to the plateau tone) for a duller, matte read.
    'default': (1, 1, 2),   # voidborn-matched baseline
    'rough':   (1, 1, 4),   # kronax: short plateau, long dark falloff — hammered/field-welded metal
    'matte':   (1, 0, 2),   # pirate: no glossy specular — dry bone, not wet metal
    'flat':    (1, 0, 1),   # machine: minimal highlight/falloff, plateau dominates — matte cast iron
    'crisp':   (1, 1, 1),   # terran: short falloff, wide flat plateau — stamped parade metal
}


def apply_bevel_shading(g, n, band, style='default'):
    """Give the band a real cross-section bevel: a full, continuous
    monotonic gradient across the entire ring depth, matching voidborn's own
    hand-drawn cross-section exactly (dumped and inspected directly:
    dark seam -> bright highlight peak one cell in -> a broad mid-light
    plateau across most of the band -> a darker falloff cell -> dark seam
    at the inner/glass-facing edge). A flat two-zone light/dark split (the
    previous version) or a textured "plate" gap in the middle both read as
    a tinted rectangle, not a rounded, lit ridge — voidborn's band has no
    flat unshaded cells at all. `band` is the pre-downsample (authoring)
    width; thresholds are expressed in post-downsample "cells" (u = band/8,
    since every asset is halved 2x before export) so the proportions match
    voidborn's own 8-cell-deep ring regardless of BAND. `style` picks a
    per-faction cross-section shape from BEVEL_STYLES (each faction's
    surface material should look different, not just differently colored)."""
    u = max(1, band // 8)
    seam_u, hi_u, falloff_u = BEVEL_STYLES[style]
    seam_d = seam_u * u
    hi_d = seam_d + hi_u * u
    falloff_d = band - falloff_u * u - u
    for y in range(n):
        for x in range(n):
            if g[y][x] != 2:
                continue
            qx = x if x < n / 2 else n - 1 - x
            qy = y if y < n / 2 else n - 1 - y
            depth = min(qx, qy)
            if depth < seam_d:
                g[y][x] = 4          # dark seam cell just inside the outer edge
            elif hi_u and depth < hi_d:
                g[y][x] = 3          # bright highlight peak
            elif depth < falloff_d:
                g[y][x] = 5          # broad mid-light plateau (most of the band)
            elif depth < band - u:
                g[y][x] = 4          # darker falloff before the inner seam
            # else: last `u` cells stay base/outline-adjacent, picked up by
            # the existing inner-edge outline pass right after this call.


# ---------------------------------------------------------------------------
# Grid helpers
# ---------------------------------------------------------------------------

def blank_grid(n=GRID):
    return [[0] * n for _ in range(n)]


def crop_grid(g, x0, y0, w, h):
    return [row[x0:x0 + w] for row in g[y0:y0 + h]]


def downsample(g, factor):
    """Coarsen a grid by `factor` (majority color per factor x factor block,
    0 only if the whole block is empty). Motifs are authored at GRID/BAND
    resolution for comfortable coordinate math, then coarsened before export
    so the on-screen pixel size matches voidborn's hand-drawn art: voidborn's
    corner is ~8 cells across a ~34px rendered corner (border-image-slice 16
    on a 2x-natural image); ours was 16 cells across the same corner — twice
    as fine, which read as smooth/soft instead of chunky. Halving here (and
    slice 32->16 in the CSS) matches voidborn's cell density exactly.
    Handles rectangular grids (not just square): the topstrip crop is
    BAND tall but GRID-2*BAND wide, and using row-count for both
    dimensions here silently truncated it to a square, dropping most of
    its width (surfaced as "sieht zu eintönig aus" once GRID grew past 3x
    BAND and the crop stopped being square by coincidence)."""
    rows, cols = len(g), len(g[0])
    mh, mw = rows // factor, cols // factor
    out = [[0] * mw for _ in range(mh)]
    for oy in range(mh):
        for ox in range(mw):
            cells = [g[oy * factor + dy][ox * factor + dx]
                     for dy in range(factor) for dx in range(factor)]
            nonzero = [c for c in cells if c]
            out[oy][ox] = max(set(nonzero), key=nonzero.count) if nonzero else 0
    return out


def rescale_profile(profile, old_band, new_band=BAND):
    """Stretch a hand-tuned corner-cut profile (authored at `old_band` depth)
    to the current BAND, scaling both its length and its depth values so the
    corner silhouette keeps the same proportions at a bigger size."""
    out = []
    for i in range(new_band):
        src = min(old_band - 1, int(i * old_band / new_band))
        out.append(round(profile[src] * new_band / old_band))
    return out


def apply_plate_segments(g, n, band, seed, segment_len=40):
    """Break each straight edge run into a few large contiguous plate
    segments (alternating base tone) instead of one uniform strip — large
    bolted plates instead of a continuous rail. Only retints tone==2 (plain
    base plate) cells, so it sits underneath — not in conflict with — the
    bevel/outline/accent tones and whatever fine edge_stamp detail is drawn
    afterward. Addresses "immer noch zu monoton, größere Teile müssten es
    sein": the fine rivet/trace/tooth rhythms read as confetti without a
    bigger underlying shape to break up."""
    def h(i, salt):
        return (((i * 2654435761) ^ (seed * 40503) ^ salt) & 0x7fffffff) % 100
    for x in range(band, n - band):
        if h((x - band) // segment_len, 71) >= 50:
            continue
        for y in list(range(0, band)) + list(range(n - band, n)):
            if g[y][x] == 2:
                g[y][x] = 4
    for y in range(band, n - band):
        if h((y - band) // segment_len, 73) >= 50:
            continue
        for x in list(range(0, band)) + list(range(n - band, n)):
            if g[y][x] == 2:
                g[y][x] = 4


def in_band(x, y, n=GRID, band=BAND):
    """True inside the symmetric hollow-frame ring (outer band of width `band`,
    each edge of the NxN square), i.e. everywhere except the open center."""
    return x < band or x >= n - band or y < band or y >= n - band


def rle_encode_row(row, n=GRID):
    """Yield (start_x, width) runs of truthy cells for one grid row."""
    runs = []
    x = 0
    while x < n:
        if row[x]:
            x0 = x
            while x < n and row[x] == row[x0]:
                x += 1
            runs.append((x0, x - x0))
        else:
            x += 1
    return runs


def grid_to_svg(grid, palette, n=GRID, w=None, h=None):
    """Exact voidborn format: one <path> per color index, body built from
    'Mx yh{w}v1h-{w}z' run segments, 2x pixel upscale, crisp edges.
    Pass `n` for a square grid, or `w`/`h` for a rectangular one (n ignored)."""
    gw = w if w is not None else n
    gh = h if h is not None else n
    paths = []
    for color_idx in sorted(palette.keys()):
        hexcol = palette[color_idx]
        d = []
        for y in range(gh):
            row = [1 if grid[y][x] == color_idx else 0 for x in range(gw)]
            for x0, rw in rle_encode_row(row, gw):
                d.append(f'M{x0} {y}h{rw}v1h-{rw}z')
        if not d:
            continue
        paths.append(f"<path fill='{hexcol}' d='{''.join(d)}'/>")
    body = ''.join(paths)
    return (f"<svg xmlns='http://www.w3.org/2000/svg' width='{gw * 2}' height='{gh * 2}' "
            f"viewBox='0 0 {gw} {gh}' shape-rendering='crispEdges'>{body}</svg>")


def _top_left_notch(grid, n=GRID, band=BAND):
    """Scan the generated grid's actual top-left corner (rows 0..band-1) and
    return the outward step polyline from the top edge to the left edge, as
    (x,y) pixel points, ordered top-entry -> left-exit. Collapses runs of
    identical x into single corner vertices (a flat step, not one point per
    row), so the result is already a minimal polygon."""
    pts = []
    prev_x = None
    for y in range(band):
        row = grid[y]
        x_left = next((x for x in range(n) if row[x]), band)
        if x_left != prev_x:
            pts.append((x_left, y))
            prev_x = x_left
    pts.append((prev_x if prev_x is not None else band, band))
    return pts


def deriveClipPolygon(grid, n=GRID, band=BAND, unit_label='var(--u)'):
    """Mirror the scanned top-left corner notch into all four corners and
    stitch them with the band's straight edge runs, so the CSS clip-path can
    never drift from the art that was actually generated. Only valid for the
    symmetric hollow-frame band construction used by this generator (same
    corner notch mirrored 4x, straight runs in between)."""
    P = _top_left_notch(grid, n, band)  # top-entry (band,0)-ish .. left-exit (0,band)-ish

    def mx(p):
        return (n - p[0], p[1])

    def my(p):
        return (p[0], n - p[1])

    def mxy(p):
        return (n - p[0], n - p[1])

    TR = [mx(p) for p in P]                       # top-entry -> right-exit
    BR = list(reversed([mxy(p) for p in P]))       # right-entry -> bottom-exit
    BL = [my(p) for p in P]                        # bottom-entry -> left-exit
    TL_close = list(reversed(P))[:-1]               # left-entry -> (top-exit, dropped: closes to start)

    poly = [P[0]] + TR + BR + BL + TL_close

    def fmt(v):
        if v <= 0:
            return '0'
        if v >= n:
            return '100%'
        if v <= n / 2:
            return f'calc({v} * {unit_label})'
        return f'calc(100% - calc({n - v} * {unit_label}))'

    parts = [f'{fmt(x)} {fmt(y)}' for (x, y) in poly]
    return 'polygon(' + ', '.join(parts) + ')'


# ---------------------------------------------------------------------------
# Per-faction motif generators. Each returns (grid, meta) where grid[y][x] is
# a palette index 0-5. Vocabulary mirrors js/graphics/ship-assets/ship-asset-
# loader/lit-bounds.js baseFactionRowProfile + grid-helpers.js
# applyFactionPlatingPattern silhouette keys, as the established per-faction
# visual language (NOT reused code — ship hull grids are canvas/DOM, these
# are RLE SVG paths).
# ---------------------------------------------------------------------------

def _block(r0, c0, h, w, tone):
    """A filled h x w rectangle of `tone`, as a flat list of (row, col, tone)
    cells, starting at (r0, c0). Every signature-glyph piece below is built
    from these — each block is >=2 in both dimensions so it survives the 2x
    downsample's 2x2 majority vote (a 1px-wide piece loses that vote to
    whatever's next to it and silently vanishes on export)."""
    return [(r0 + dr, c0 + dc, tone) for dr in range(h) for dc in range(w)]


def _stamp_glyph_corner(g, n, cells, require_filled=False):
    """Stamp a (row, col, tone) cell list into the top-left corner and mirror
    it into the other three corners. `require_filled` only paints a cell if
    the grid is already solid there (truthy) — use this for glyphs placed
    against an irregular/aggressive corner `profile` where part of the
    glyph's bounding box might fall outside the carved silhouette; leave it
    False (unconditional, bounds-checked only) for a corner shape known to
    be fully solid there, matching the existing chip-node code's style."""
    for (r, c, tone) in cells:
        for (rr, cc) in ((r, c), (r, n - 1 - c), (n - 1 - r, c), (n - 1 - r, n - 1 - c)):
            if 0 <= rr < n and 0 <= cc < n and (not require_filled or g[rr][cc]):
                g[rr][cc] = tone

def gen_circuit_motif(seed=0, variant=0):
    """Machine: rectilinear circuit traces + chip-node corners, a stepped
    (not diagonal) corner notch — reads as 'machined', matching its ship
    silhouette ('circuit', notched right-angle traces)."""
    g = blank_grid()
    n = GRID
    # Solid ring band, base plate + dark outline at both ring boundaries.
    for y in range(n):
        for x in range(n):
            if not in_band(x, y, n, BAND):
                continue
            edge = (x in (BAND - 1, n - BAND) or y in (BAND - 1, n - BAND)
                    or x == 0 or x == n - 1 or y == 0 or y == n - 1)
            g[y][x] = 1 if edge else 2
    # Stepped corner notch: carve a coarse 2-step rectilinear staircase out
    # of each corner (right angles only, no diagonal). Widened from an
    # earlier 3-step/finer-step version (steps now 4px tall each instead of
    # finely staggered) — heavier, fewer steps read as a cast gear-housing
    # block, where the old fine staircase read closer to a PCB notch.
    steps = [(0, 0, 20), (0, 20, 12), (20, 0, 12)]  # (dx,dy,size) cut squares — scaled for BAND=32
    for (dx, dy, size) in steps:
        for yy in range(dy, dy + size):
            for xx in range(dx, dx + size):
                g[yy][xx] = 0
                g[yy][n - 1 - xx] = 0
                g[n - 1 - yy][xx] = 0
                g[n - 1 - yy][n - 1 - xx] = 0
    apply_bevel_shading(g, n, BAND, style='flat')
    apply_plate_shading(g, n, BAND, seed)
    apply_plate_segments(g, n, BAND, seed)
    # Lit bevel sheen along the inner top-left-facing edge of the band.
    for x in range(BAND, n - BAND):
        if g[BAND - 1][x]:
            g[BAND - 1][x] = 3
    for y in range(BAND, n - BAND):
        if g[y][BAND - 1]:
            g[y][BAND - 1] = 3
    # Corner gear/cog node: a 10x10 hub (2px outline ring + 6x6 hot-accent
    # axle bolt) filling the clear pocket the steps leave open at
    # rows/cols 20-31 for BAND=32 — sized up again per "noch gröbere
    # Elemente", kept even-aligned throughout so every piece survives the
    # 2x downsample.
    hub0 = 20  # top-left of the clear pocket for BAND=32
    _stamp_glyph_corner(g, n, (
        _block(hub0, hub0, 10, 10, 1) +                     # outline ring (full 10x10 base)
        _block(hub0 + 2, hub0 + 2, 6, 6, 8)                 # hot-accent axle bolt (center 6x6)
    ), require_filled=True)
    # Heavy conduit/pipe trace along the edge-strip midline (the part that
    # repeats via border-image "round"). Doubled in thickness/period from
    # the DOWNSAMPLE=2 version (2px strokes, period 8/9/18) to 4px
    # strokes/period 16/32/72: at DOWNSAMPLE=4 a 2px-wide accent stroke is
    # thinner than one exported pixel block, so the majority-vote downsample
    # dropped every accent color and left only the plain outline teeth —
    # reported as "sieht zu eintönig aus, das muss maschineller aussehen".
    # Also layered in a second, offset conduit plus periodic valve-flange
    # blocks so the strip reads as several different pipe/plate elements
    # instead of one repeating comb.
    mid = BAND // 2
    on = (lambda i: (i // 4 + variant) % 4 < 2)
    for x in range(BAND, n - BAND):
        i = x - BAND
        if i % 16 < 8:
            col = 8 if on(i) else 6
            for dr in range(4):
                g[mid + dr][x] = col
                g[n - 1 - mid - dr][x] = col
                g[x][mid + dr] = col
                g[x][n - 1 - mid - dr] = col
        elif i % 16 == 8:
            for dr in range(4):
                g[mid - 2 + dr][x] = 1
                g[n - 1 - mid - 2 + dr][x] = 1
                g[x][mid - 2 + dr] = 1
                g[x][n - 1 - mid - 2 + dr] = 1
        if i % 18 < 8:
            col2 = 7 if on(i + 4) else 6
            for dd in range(4):
                g[mid + 8 + dd][x] = col2
                g[n - 1 - mid - 8 - dd][x] = col2
                g[x][mid + 8 + dd] = col2
                g[x][n - 1 - mid - 8 - dd] = col2
        # Right-angle branch ticks: one every 72px (was 18 at DOWNSAMPLE=2,
        # doubled for thickness then doubled again so it stays a rare accent
        # rather than a dense repeat at the coarser pixel grid).
        if i % 72 == 8:
            for dy in range(4, 16):
                g[mid + dy][x] = 1
                g[n - 1 - mid - dy][x] = 1
                g[x][mid + dy] = 1
                g[x][n - 1 - mid - dy] = 1
        # Valve-flange block: a big 4-wide hot-accent plate spanning most of
        # the band depth every 36px, offset from the rivet seams below —
        # reads as a bolted pressure valve/junction box breaking up the
        # conduit run, not just a longer pipe.
        if i % 36 in (16, 17, 18, 19) and x + 3 < n - BAND:
            for yy in range(BAND - 14, BAND - 2):
                col3 = 8 if (i // 4 + variant) % 3 == 0 else 7
                g[yy][x] = col3
                g[n - 1 - yy][x] = col3
                g[x][yy] = col3
                g[x][n - 1 - yy] = col3
        # Rivet-and-plate seam: a 4x4 rivet head every 16px flanked by a 4px
        # dark seam line spanning the band's full depth — bolted armor
        # plating, not a printed board.
        if i % 16 == 0 and x + 3 < n - BAND:
            for yy in range(1, BAND - 1):
                for dd in range(4):
                    g[yy][x + dd] = 4
                    g[n - 1 - yy][x + dd] = 4
            for xx in range(1, BAND - 1):
                for dd in range(4):
                    g[x + dd][xx] = 4
                    g[x + dd][n - 1 - xx] = 4
            for dd in range(4):
                for ee in range(4):
                    g[BAND - 9 + dd][x + ee] = 1
                    g[n - BAND + 5 + dd][x + ee] = 1
    return g


def _mirror_included(x, y, n, band, profile):
    """Shared corner-profile band builder: `profile` is a length-`band` list
    of inward cut depths (0..band) for the top-left corner's row y=0..band-1,
    mirrored into all four corners by symmetry; straight runs away from the
    corners stay a flat band of width `band`."""
    qx = x if x < n / 2 else n - 1 - x
    qy = y if y < n / 2 else n - 1 - y
    if qx < band and qy < band:
        return qx >= profile[qy]
    return qx < band or qy < band


def build_frame_grid(profile, edge_stamp=None, band=BAND, n=GRID, seed=0,
                      bevel_style='default', plate_density=22):
    """Generic hollow-frame band builder used by terran/kronax/pirate: a
    corner cut driven by `profile` (see _mirror_included) plus an optional
    `edge_stamp(grid, n, band)` callback that stamps extra colors along the
    straight mid-edge runs (rivets/traces/teeth/etc, faction-specific)."""
    g = blank_grid(n)
    for y in range(n):
        for x in range(n):
            if not _mirror_included(x, y, n, band, profile):
                continue
            on_boundary = (x in (band - 1, n - band) or y in (band - 1, n - band)
                           or x == 0 or x == n - 1 or y == 0 or y == n - 1)
            g[y][x] = 1 if on_boundary else 2
    apply_bevel_shading(g, n, band, style=bevel_style)
    apply_plate_shading(g, n, band, seed, density=plate_density)
    apply_plate_segments(g, n, band, seed)
    # Lit bevel sheen along the band's inner top/left-facing edge.
    for x in range(band, n - band):
        if g[band - 1][x]:
            g[band - 1][x] = 3
    for y in range(band, n - band):
        if g[y][band - 1]:
            g[y][band - 1] = 3
    if edge_stamp:
        edge_stamp(g, n, band)
    return g


def gen_modular_motif(seed=0, variant=0):
    """Terran: righteous Starship-Troopers propaganda-poster doctrine. A
    stepped rank-chevron corner (stacked shoulder-rank insignia, not a
    plain chamfer), a gold parade-stripe rule along every edge, an honor-
    chevron stencil band, and a federation star-and-wings emblem at each
    corner — reads as a disciplined, self-righteous military order, not
    neutral machined plate."""
    profile = rescale_profile([12, 12, 10, 10, 8, 8, 8, 8, 4, 4, 4, 4, 0, 0, 0, 0], 16)

    def edge_stamp(g, n, band):
        mid = band // 2
        # Long, steady, synchronized holds (75% duty, same phase for every
        # line) — reads as "drilled"/disciplined, unlike kronax's erratic
        # per-line phase offset or pirate's guttering-candle flicker.
        on = (lambda i: (i + variant) % 8 < 6)
        # Every rule line here is drawn 2 rows/cols thick, not 1: a 1px line
        # sitting on a downsample block boundary ties 2-2 against whatever
        # tone fills the row next to it and loses that tie consistently
        # (verified by dumping the grid: the gold rule line was 92 cells
        # pre-downsample and exactly 0 post-downsample) — drawing on a
        # matched pair of rows removes the tie entirely.
        for x in range(band, n - band):
            i = x - band
            # ln (and mid) are kept even so each 2-row pair below lands on
            # exactly one downsample block (rows 2k/2k+1) instead of
            # straddling two — a straddling pair still ties 2-2 per block.
            for ln in (mid - 4, mid + 2):
                col = 7 if on(i) else 6
                for dd in (0, 1):
                    g[ln + dd][x] = col
                    g[n - 1 - ln - dd][x] = col
                    g[x][ln + dd] = col
                    g[x][n - 1 - ln - dd] = col
            col8 = 8 if on(i) else 3
            for dd in (0, 1):
                g[mid + dd][x] = col8
                g[n - 1 - mid - dd][x] = col8
                g[x][mid + dd] = col8
                g[x][n - 1 - mid - dd] = col8
            if i % 6 == 0:
                for d in (band - 4, n - band + 3):
                    g[d][x] = 1
                    g[x][d] = 1
            if i % 12 < 1:
                g[band - 2][x] = 3
                g[n - band + 1][x] = 3
                g[x][band - 2] = 3
                g[x][n - band + 1] = 3
            # Riveted armor-plate bolt heads: a raised 2x2 dot (light
            # top-left facet, dark bottom-right facet) every 8px — Terran's
            # "modular" doctrine should read as bolted plate segments, not
            # just rule lines on a flat chamfer. Drawn 2px thick (not 1px):
            # every exported asset is downsampled 2x by majority-vote per
            # 2x2 block (see downsample()), so a 1px feature sitting next to
            # 3px of plain plate in its block loses the vote and vanishes
            # entirely on export — this was reported as "you can't see it".
            if i % 8 in (2, 3) and x + 1 < n - band:
                for ry in (band - 7, n - band + 5):
                    if g[ry][x]:
                        g[ry][x] = 3
                        g[ry][x + 1] = 3
                        g[ry + 1][x] = 1
                        g[ry + 1][x + 1] = 1
                for rx in (band - 7, n - band + 5):
                    if g[x][rx]:
                        g[x][rx] = 3
                        g[x + 1][rx] = 3
                        g[x][rx + 1] = 1
                        g[x + 1][rx + 1] = 1
            # Honor-chevron stencil band: replaces a black/gold HAZARD stripe
            # (warning stripes signal danger, which contradicts "righteous")
            # with a stencilled "^" rank-chevron — same footprint (4 rows,
            # every 20px) as a drop-in swap, but now reads as a tapferkeit/
            # rank honor mark instead of a caution marking.
            if i % 20 < 8 and band + 2 < n - band:
                local = i % 20
                for dy in range(4):
                    yy = band + 2 + dy
                    left = (3 - dy) <= local <= (4 - dy)
                    right = (4 + dy - 1) <= local <= (4 + dy)
                    col = 7 if (left or right) else 1
                    if g[yy][x]:
                        g[yy][x] = col
                    yy2 = n - band - 3 + dy
                    if 0 <= yy2 < n and g[yy2][x]:
                        g[yy2][x] = col
                    xx = band + 2 + dy
                    if g[x][xx]:
                        g[x][xx] = col
                    xx2 = n - band - 3 + dy
                    if 0 <= xx2 < n and g[x][xx2]:
                        g[x][xx2] = col

    g = build_frame_grid(profile, edge_stamp, seed=seed, bevel_style='crisp', plate_density=4)
    n = len(g)
    # Federation star-and-wings emblem: a propaganda-poster medal, the
    # signature glyph that makes Terran read as "righteous order" at a
    # glance instead of "generic military grey". Core + 4 cardinal arms in
    # full accent gold, 2 diagonal hot-gold wingtips, framed by a 2px dark
    # outline ring — built from >=2x2 blocks on even coordinates.
    s0 = 14  # star bounding box top-left — clear of the chevron corner's cut rows/cols.
             # Must be even: downsample() majority-votes 2x2 raw blocks aligned on
             # even coordinates, so an odd-aligned glyph cell straddles two blocks
             # and loses the vote to its neighbor, vanishing on export (reported as
             # "die Ornamente fehlen" — the star was silently dropping out). Arms
             # sized up again to 6x6 (from 2x2, then 4x4) per "noch gröbere
             # Elemente".
    _stamp_glyph_corner(g, n, (
        _block(s0 + 6, s0 + 6, 6, 6, 7) +                     # core
        _block(s0, s0 + 6, 6, 6, 7) + _block(s0 + 12, s0 + 6, 6, 6, 7) +      # top/bottom arms
        _block(s0 + 6, s0, 6, 6, 7) + _block(s0 + 6, s0 + 12, 6, 6, 7) +      # left/right arms
        _block(s0, s0, 6, 6, 8) + _block(s0, s0 + 12, 6, 6, 8)               # wingtips
    ), require_filled=True)
    return g


def gen_spikes_motif(seed=0, variant=0):
    """Kronax: jagged sawtooth corner (echoes the existing zigzag-teeth
    silhouette, now a single overbuilt fang instead of repeating decorative
    teeth) and an erratic, twitchy tooth rhythm along the edge — brawler,
    not machined. Kept deliberately light on the repeating mid-edge strip:
    this tile is halved by downsample() before export (see generate()), so
    anything drawn "thick" here reads as a dense, busy repeat once tiled
    along a long border — a dropped claw-gash block here was exactly that
    (tiled into what looked like a continuous staircase)."""
    profile = rescale_profile([15, 13, 10, 10, 10, 10, 6, 6, 6, 3, 3, 3, 0, 0, 0, 0], 16)

    def edge_stamp(g, n, band):
        mid = band // 2
        # Erratic/twitchy: fast-changing, uneven duty — unlike terran's
        # long synchronized hold or machine's clean clockwork tick.
        on = (lambda i: (i * 3 + variant * 7) % 9 < 3)
        for x in range(band, n - band):
            i = x - band
            col = 7 if on(i) else 6
            if i % 6 in (0, 1):
                for dd in (0, 1):
                    g[mid + dd][x] = col
                    g[n - 1 - mid - dd][x] = col
                    g[x][mid + dd] = col
                    g[x][n - 1 - mid - dd] = col
            if i % 14 == 0:
                g[mid - 2][x] = 1
                g[n - 1 - mid + 2][x] = 1
                g[x][mid - 2] = 1
                g[x][n - 1 - mid + 2] = 1

    g = build_frame_grid(profile, edge_stamp, seed=seed, bevel_style='rough', plate_density=32)
    n = len(g)
    # Directional spike shading: the sawtooth profile already carves a jagged
    # tooth silhouette into the corner, but a chamfer edge with flat tone
    # reads as a cut bevel, not a protruding bone spike. Give each tooth's
    # ascending (outward-facing) face a bright catch-light and its
    # descending (inward) face a cast shadow, same bevel direction for every
    # tooth, so the whole corner reads as a row of lit, 3D-protruding spikes.
    for k in range(1, len(profile)):
        if profile[k] < profile[k - 1]:
            yy = k
            for xx in range(profile[k], profile[k - 1]):
                if 0 <= yy < n and 0 <= xx < n and g[yy][xx]:
                    g[yy][xx] = 3
                    g[n - 1 - yy][xx] = 3
                    g[xx][yy] = 3
                    g[xx][n - 1 - yy] = 3
            yy2 = k - 1
            for xx in range(profile[k], profile[k - 1]):
                if 0 <= yy2 < n and 0 <= xx < n and g[yy2][xx] == 2:
                    g[yy2][xx] = 4
                    g[n - 1 - yy2][xx] = 4
                    g[xx][yy2] = 4
                    g[xx][n - 1 - yy2] = 4
    # Claw-gash scars: Kronax's lore is "scars as law" (wounded hulls
    # cannibalised, crews branded by combat) — two parallel diagonal
    # slashes raked across the band every ~18px (reduced from 3, so they
    # don't fight the new trophy-skull glyph for attention), 2 cells thick
    # so they survive the 2x downsample intact (a thin 1-cell version of
    # this was dropped earlier for tiling into a staircase; drawn thick +
    # sparse here instead of fine + dense).
    band = BAND
    # yy must stay inside the band's actual thickness (0..band-1) — an
    # earlier version offset it by `band + 2`, landing every gash pixel in
    # the empty center instead of the ring, so none of them survived at
    # all (verified by dumping the grid's color histogram: zero tone-6
    # pixels pre-downsample).
    for x0 in range(band, n - band, 18):
        for s in range(2):
            for t in range(6):
                yy = 2 + s * 3 + t
                xx = x0 + t
                if yy >= band - 1 or not (band <= xx < n - band):
                    continue
                for (py, px) in ((yy, xx), (yy + 1, xx)):
                    if py < band - 1 and g[py][px]:
                        g[py][px] = 6
                        g[n - 1 - py][px] = 6
                        g[px][py] = 6
                        g[px][n - 1 - py] = 6
    # Trophy skull-on-pike: Kronax's signature glyph ("Eater of Banners" —
    # a hunting trophy, not decoration). Brow ridge, two hollow eye sockets
    # and a dark jaw line. Sized up again to 6x6 pieces (from 2x2, then
    # 4x4) and rebased for BAND=32 per "noch gröbere Elemente" — the
    # pike-stumps are still dropped, no room below the jaw at this scale.
    # Placed where the single-fang profile is guaranteed solid.
    _stamp_glyph_corner(g, n, (
        _block(14, 14, 6, 6, 1) +                             # brow ridge
        _block(20, 8, 6, 6, 6) + _block(20, 20, 6, 6, 6) +    # eye sockets
        _block(26, 14, 6, 6, 1)                               # jaw line
    ), require_filled=True)
    return g


def gen_scrap_motif(seed=0, variant=0):
    """Pirate: necromantic ossuary/bone-cult relic, not welded scrap. A tall
    narrow bone-spire corner (instead of a lopsided scrap dent), a ribcage
    bar motif and a bone tooth-row along the edge, and a skull-and-
    crossbones glyph at each corner — echoes the existing 'wreck-cannibal'
    lore with a literal totem instead of abstract weld dents."""
    profile = rescale_profile([15, 14, 13, 4, 4, 11, 11, 2, 2, 9, 9, 0, 0, 0, 0, 0], 16)

    def edge_stamp(g, n, band):
        mid = band // 2
        # Guttering/dying-candle flicker: an irregular period-5-within-8
        # rhythm with one frame dropped entirely — sputtering, not a clean
        # pulse (terran) or an erratic twitch (kronax). Thickness/period
        # doubled from the DOWNSAMPLE=2 original (2px/period 4-6) to 4px/
        # period 8-12: at DOWNSAMPLE=4 a 2px stroke is thinner than one
        # exported pixel block and the majority-vote downsample dropped it
        # entirely, leaving plain grey plate — reported as "sieht noch
        # nicht nekromäßig aus".
        on = (lambda i: (i + variant) % 5 < 3 and variant % 8 != 2)
        for x in range(band, n - band):
            i = x - band
            col = 7 if on(i) else 6
            if (i // 4) % 3 != 2:
                for dd in range(4):
                    g[mid + dd][x] = col
                    g[n - 1 - mid - dd][x] = col
                    g[x][mid + dd] = col
                    g[x][n - 1 - mid - dd] = col
            if i % 16 == 0:
                for dd in range(4):
                    g[mid + 4 + dd][x] = 1
                    g[n - 1 - mid - 4 - dd][x] = 1
                    g[x][mid + 4 + dd] = 1
                    g[x][n - 1 - mid - 4 - dd] = 1
            # Jaw tooth-row: individual bone-white teeth in a row, period
            # 40px (doubled for DOWNSAMPLE=4) — direct continuation of the
            # game's existing bone-teeth decoration vocabulary. Was tone1
            # (hull_dark, same near-black as the outline it sits against —
            # invisible) despite the comment already saying "bone-white";
            # recolored to tone8 and thickened 2px -> 4px so it actually
            # survives the coarser downsample.
            local = i % 40
            if local < 28 and local % 8 < 4:
                for dd in range(4):
                    for (yy, xx) in ((mid - 8 + dd, x), (n - 1 - mid + 8 - dd, x)):
                        if 0 <= yy < n and g[yy][xx]:
                            g[yy][xx] = 8
                    for (yy, xx) in ((x, mid - 8 + dd), (x, n - 1 - mid + 8 - dd)):
                        if 0 <= xx < n and g[yy][xx]:
                            g[yy][xx] = 8
            # Raised bolt pair (light cap + dark cast shadow) holding each
            # welded plate down — distinct from a flat accent dot, reads as
            # a protruding rivet head on scavenged hull-plate. Sized up
            # 2x2->4x4 per cap/shadow to survive DOWNSAMPLE=4.
            if i % 20 in (2, 3, 4, 5) and x + 3 < n - band:
                for (by, bx) in ((band + 4, x), (n - band - 7, x)):
                    if g[by][bx]:
                        for dd in range(4):
                            g[by][bx + dd] = 3
                        if g[by + 4][bx]:
                            for dd in range(4):
                                g[by + 4][bx + dd] = 1
                for (by, bx) in ((x, band + 4), (x, n - band - 7)):
                    if g[by][bx]:
                        for dd in range(4):
                            g[by + dd][bx] = 3
                        if g[by][bx + 4]:
                            for dd in range(4):
                                g[by + dd][bx + 4] = 1
            # Chain link: Pirate's lore is "debt slavery" / "chain markets" —
            # an explicit linked-chain silhouette (alternating open-loop /
            # closed-loop pairs) dragged along the band. One link every
            # 12px (doubled), 4px thick so it survives DOWNSAMPLE=4.
            lk = (i // 12) % 2
            if i % 12 in (2, 3, 4, 5, 6, 7, 8):
                yy = mid - 10 if lk == 0 else mid - 12
                if 0 <= yy < n and g[yy][x]:
                    g[yy][x] = 1
                yy2 = n - 1 - mid + 10 if lk == 0 else n - 1 - mid + 12
                if 0 <= yy2 < n and g[yy2][x]:
                    g[yy2][x] = 1
                xx = mid - 10 if lk == 0 else mid - 12
                if 0 <= xx < n and g[x][xx]:
                    g[x][xx] = 1
                xx2 = n - 1 - mid + 10 if lk == 0 else n - 1 - mid + 12
                if 0 <= xx2 < n and g[x][xx2]:
                    g[x][xx2] = 1
            # Ribcage bars: three parallel bars, alternating dark-gap/
            # bone-white rib tone, period 24px — a freed-up ribcage running
            # along the edge. 4px thick (was 2px) to survive the coarser
            # downsample, and recolored off plain tone2 to tone8 (bone
            # white) so the ribs actually read against the dark band
            # instead of blending into the plate.
            rlocal = i % 24
            if rlocal < 16 and rlocal % 8 < 4:
                rcol = 1 if (i // 24) % 2 == 0 else 8
                for dd in range(4):
                    for (yy, xx) in ((band + 6 + dd, x), (n - band - 9 + dd, x)):
                        if 0 <= yy < n and g[yy][xx]:
                            g[yy][xx] = rcol
                    for (yy, xx) in ((x, band + 6 + dd), (x, n - band - 9 + dd)):
                        if 0 <= xx < n and g[yy][xx]:
                            g[yy][xx] = rcol

    g = build_frame_grid(profile, edge_stamp, seed=seed, bevel_style='matte', plate_density=38)
    n = len(g)
    # Welded-on scrap plates: large irregular blocks of alternating tint
    # (not the fine uniform hash from apply_plate_shading) so the band reads
    # as several mismatched salvaged plates bolted together, each catching
    # light differently — rather than one continuous, evenly shaded panel.
    def h(a, b, k):
        return (((a * 92821) ^ (b * 68917) ^ ((seed + k) * 50021)) & 0x7fffffff) % 100
    plate = 7
    for y in range(n):
        for x in range(n):
            if g[y][x] != 2:
                continue
            tone = h(x // plate, y // plate, 3)
            if tone < 30:
                g[y][x] = 5
            elif tone < 55:
                g[y][x] = 4
    # Skull-and-crossbones: the signature glyph, replacing the diffuse
    # "weld-blob/bone-teeth" vocabulary with a literal totem — cranial cap,
    # two hollow eye sockets, a nasal cavity. The cap/jaw were drawn in
    # tone1 (hull_dark), which is nearly the same near-black as the outline
    # seams it sits against — the skull was there but invisible, reported
    # as "sieht noch nicht nekromäßig aus". Recolored to tone8 (hot accent,
    # the brightest bone-white in the palette) so it reads as a lit skull
    # against black eye sockets instead of blending into the plate. Sized
    # up to 6x6 pieces and rebased for BAND=32; crossbone stubs stay
    # dropped — no room below the nasal cavity at this scale. Placed where
    # the tall-spire profile is guaranteed solid.
    _stamp_glyph_corner(g, n, (
        _block(18, 20, 6, 6, 8) +                             # cranial cap (bone-white)
        _block(24, 14, 6, 6, 1) + _block(24, 26, 6, 6, 1) +   # eye sockets (hollow black)
        _block(30, 20, 2, 2, 1)                               # nasal cavity (hollow black)
    ), require_filled=True)
    return g


MOTIFS = {
    'terran': gen_modular_motif,
    'kronax': gen_spikes_motif,
    'pirate': gen_scrap_motif,
    'machine': gen_circuit_motif,
}


def faction_tokens(faction):
    """Faction color tokens — single source of truth is css/screen-frame.css's
    --hull/--hull-lit/--hull-dark (and each faction's own accent token), kept
    in sync by hand here since there's no CSS-to-Python token bridge in this
    project. Update this table if screen-frame.css's values change."""
    table = {
        'terran': dict(hull='#131a26', hull_lit='#2a3a52', hull_dark='#05080e', accent='#c9a24a'),
        'kronax': dict(hull='#1c0d0a', hull_lit='#4a1d14', hull_dark='#060202', accent='#e0603a'),
        'pirate': dict(hull='#14160f', hull_lit='#3a4030', hull_dark='#040503', accent='#cdc7a4'),
        'machine': dict(hull='#071312', hull_lit='#143832', hull_dark='#020706', accent='#50e0a8'),
    }
    return table[faction]


DOWNSAMPLE = 4        # motifs are authored at GRID/BAND; exported at GRID/DOWNSAMPLE.
                       # Bumped 2 -> 4: the structural fixes (BAND, glyphs,
                       # plate segments) made the *shapes* bigger, but each
                       # exported pixel was still only a 2x2 raw-cell block —
                       # fine-grained up close, reported as "die gröber
                       # auflösen die Rahmen". Doubling this halves the
                       # exported pixel count and doubles each cell's
                       # on-screen size, for a visibly chunkier retro-pixel
                       # look at the same physical border thickness.
BAND_OUT = BAND // DOWNSAMPLE
SLICE_OUT = BAND_OUT * 2   # natural px, matches voidborn's own slice=16


def generate(faction, frames=8):
    if faction not in MOTIFS:
        print(f"No motif generator for '{faction}' yet.", file=sys.stderr)
        sys.exit(1)
    tok = faction_tokens(faction)
    palette = build_palette(tok['hull_dark'], tok['hull'], tok['hull_lit'], tok['accent'])
    gen_fn = MOTIFS[faction]

    base_full = gen_fn(seed=0, variant=0)
    base_grid = downsample(base_full, DOWNSAMPLE)
    n_out = len(base_grid)
    base_svg = grid_to_svg(base_grid, palette, n=n_out)
    (ASSETS / f'{faction}-bezel-art.svg').write_text(base_svg)
    print(f'wrote {faction}-bezel-art.svg (slice={SLICE_OUT})')

    # Dedicated thin top-mid strip: the straight mid-edge slice only (no corner
    # notch, no hollow center), for the header fill behind the border-image
    # (--fr-ot is much taller than the border itself — see css/screen-frame.css
    # ::before per faction). Reusing the full square tile there (repeat-x) was
    # periodically showing its transparent hollow middle as empty patches —
    # this mirrors voidborn's own dedicated voidborn-vine-top-mid.svg instead.
    strip_full = crop_grid(base_full, BAND, 0, GRID - 2 * BAND, BAND)
    strip = downsample(strip_full, DOWNSAMPLE)
    strip_svg = grid_to_svg(strip, palette, n=None, w=len(strip[0]), h=len(strip))
    (ASSETS / f'{faction}-topstrip.svg').write_text(strip_svg)
    print(f'wrote {faction}-topstrip.svg')

    for i in range(1, frames + 1):
        # seed stays fixed at 0 across every frame: seed drives the plate's
        # structural noise (hash shading, rivets, corner notch), and letting
        # it vary per frame re-rolled that whole texture every animation
        # step — the plate itself "glitched"/static-shuffled instead of
        # holding still while only the lit accent traces pulse. Only
        # `variant` (which drives the accent on/off blink pattern) animates.
        g = downsample(gen_fn(seed=0, variant=i), DOWNSAMPLE)
        svg = grid_to_svg(g, palette, n=n_out)
        (ASSETS / f'{faction}-bezel-art-{i}.svg').write_text(svg)
        print(f'wrote {faction}-bezel-art-{i}.svg')

    poly = deriveClipPolygon(base_grid, n=n_out, band=BAND_OUT)
    out_txt = ROOT / 'tools' / 'bezel-art' / f'{faction}-shape.txt'
    out_txt.write_text(f'--fr-shape-{faction}: {poly};\n')
    print(f'wrote {out_txt} (paste into css/screen-frame.css)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('faction')
    ap.add_argument('--frames', type=int, default=8)
    args = ap.parse_args()
    generate(args.faction, frames=args.frames)


if __name__ == '__main__':
    main()
