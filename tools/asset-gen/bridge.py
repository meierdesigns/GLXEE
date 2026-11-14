#!/usr/bin/env python3
"""GLXEE Asset-Gen Bridge — ComfyUI Flux generate + accept to disk."""
from __future__ import annotations

import base64
import io
import json
import os
import random
import subprocess
import sys
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[2]
API_WORKFLOW = REPO_ROOT / "tools" / "comfyui" / "workflows" / "vf-flux-sprite-api.json"
PORTRAIT_WORKFLOW = REPO_ROOT / "tools" / "comfyui" / "workflows" / "vf-flux-portrait-api.json"
STAGING_DIR = REPO_ROOT / "assets" / "_generated" / "_staging"
COMFY_START_SH = REPO_ROOT / "tools" / "comfyui" / "start.sh"
COMFY_STOP_SH = REPO_ROOT / "tools" / "comfyui" / "stop.sh"
COMFY_PID_FILE = REPO_ROOT / "tools" / "comfyui" / "comfyui.pid"
COMFY_LOG = REPO_ROOT / "tools" / "comfyui" / "comfyui.log"
COMFY_LOCAL_ENV = REPO_ROOT / "tools" / "comfyui" / "local.env"
COMFY_ROOT_DEFAULT = "/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI"
QUICKY_ROOTS = (
    "/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI",
    "/mnt/quicky2/ComfyUI",
)


def _load_local_env() -> dict[str, str]:
    out: dict[str, str] = {}
    if not COMFY_LOCAL_ENV.is_file():
        return out
    try:
        for line in COMFY_LOCAL_ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'")
            out[k.strip()] = v
    except OSError:
        pass
    return out


def _resolve_comfy_defaults() -> tuple[str, int, str]:
    local = _load_local_env()
    root = (
        os.environ.get("COMFY_ROOT")
        or local.get("COMFY_ROOT")
        or next((p for p in QUICKY_ROOTS if Path(p).is_dir()), COMFY_ROOT_DEFAULT)
    )
    host = os.environ.get("COMFY_HOST") or local.get("COMFY_HOST") or "127.0.0.1"
    port_raw = os.environ.get("COMFY_PORT") or local.get("COMFY_PORT") or (
        "6767" if str(root).startswith("/mnt/quicky2") else "8188"
    )
    try:
        port = int(port_raw)
    except ValueError:
        port = 6767
    return host, port, root


_COMFY_HOST_DEF, _COMFY_PORT_DEF, _COMFY_ROOT_DEF = _resolve_comfy_defaults()
_runtime: dict = {
    "comfyHost": _COMFY_HOST_DEF,
    "comfyPort": _COMFY_PORT_DEF,
    "comfyRoot": _COMFY_ROOT_DEF,
    "autoStartComfy": True,
}

BRIDGE_HOST = os.environ.get("ASSET_GEN_HOST", "127.0.0.1")
BRIDGE_PORT = int(os.environ.get("ASSET_GEN_PORT", "8787"))
CLIENT_ID = str(uuid.uuid4())

MAGENTA = (255, 0, 255)
MAGENTA_TOL = 48
BG_TOL = 42

STYLE_PREFIX = (
    "pixel art, 16-bit game sprite, pure grayscale only, monochrome gray shades, "
    "NO color, NO hue, NO chroma, Game Boy gray palette, flat shading, crisp pixels, "
    "solid magenta background #FF00FF, centered, single object, subject fills most of "
    "frame, large clear silhouette, high contrast, no text, no UI, luminance mask for "
    "later in-engine tint"
)

PORTRAIT_STYLE_PREFIX = (
    "pixel art bust portrait, head and shoulders, crisp hard pixels, limited color palette, "
    "solid magenta background #FF00FF, centered face looking at camera, game character pilot "
    "portrait, no text, no UI, no frame"
)

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore


def comfy_base() -> str:
    return "http://" + str(_runtime["comfyHost"]) + ":" + str(_runtime["comfyPort"])


def parse_hex_color(value: str | None, fallback: tuple[int, int, int] = MAGENTA) -> tuple[int, int, int]:
    if not isinstance(value, str):
        return fallback
    h = value.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return fallback
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return fallback


def style_prefix(colors: int = 15, bg_hex: str = "#FF00FF") -> str:
    n = max(2, min(15, int(colors or 15)))
    bg = (bg_hex or "#FF00FF").strip().upper()
    if not bg.startswith("#"):
        bg = "#" + bg
    return (
        "pixel art, 16-bit game sprite, pure grayscale only, monochrome gray shades, exactly "
        + str(n)
        + " base gray colors max (not counting background), NO color, NO hue, NO chroma, "
        "Game Boy gray palette, flat shading, crisp pixels, solid background "
        + bg
        + ", chroma key background, centered, single object, subject fills most of frame, "
        "large clear silhouette, high contrast, no text, no UI, luminance mask for later "
        "in-engine tint"
    )


def refresh_comfy_globals() -> None:
    _runtime["comfyHost"] = os.environ.get("COMFY_HOST", _runtime.get("comfyHost", _COMFY_HOST_DEF))
    try:
        _runtime["comfyPort"] = int(os.environ.get("COMFY_PORT", _runtime.get("comfyPort", _COMFY_PORT_DEF)))
    except (TypeError, ValueError):
        _runtime["comfyPort"] = _COMFY_PORT_DEF
    _runtime["comfyRoot"] = os.environ.get("COMFY_ROOT", _runtime.get("comfyRoot", _COMFY_ROOT_DEF))


def http_json(method: str, url: str, body: dict | None = None, timeout: float = 30.0):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers=headers, method=method)
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))


def comfy_probe(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        http_json("GET", "http://" + host + ":" + str(port) + "/system_stats", timeout=timeout)
        return True
    except Exception:
        return False


def discover_comfy(adopt: bool = True) -> bool:
    """Find a live ComfyUI; prefer configured port, then Quicky/SM defaults."""
    refresh_comfy_globals()
    host = str(_runtime.get("comfyHost") or "127.0.0.1")
    configured = int(_runtime.get("comfyPort") or _COMFY_PORT_DEF)
    candidates = []
    for p in (configured, 6767, 8188):
        try:
            pi = int(p)
        except (TypeError, ValueError):
            continue
        if pi not in candidates:
            candidates.append(pi)
    for port in candidates:
        if comfy_probe(host, port):
            if adopt:
                _runtime["comfyPort"] = port
            return True
    return False


def comfy_reachable() -> bool:
    return discover_comfy(adopt=True)


def comfy_pid() -> int | None:
    if not COMFY_PID_FILE.is_file():
        return None
    try:
        raw = COMFY_PID_FILE.read_text(encoding="utf-8").strip() or "0"
        pid = int(raw)
        return pid if pid > 0 else None
    except Exception:
        return None


def available_comfy_roots() -> list[str]:
    roots: list[str] = []
    for p in QUICKY_ROOTS:
        path = Path(p)
        if path.is_dir() and (path / "main.py").is_file():
            roots.append(str(path))
    cur = str(_runtime.get("comfyRoot") or "")
    if cur and cur not in roots and Path(cur).is_dir() and (Path(cur) / "main.py").is_file():
        roots.insert(0, cur)
    return roots


def comfy_status() -> dict:
    running = discover_comfy(adopt=True)
    root = str(_runtime.get("comfyRoot") or "")
    return {
        "ok": True,
        "running": running,
        "pid": comfy_pid(),
        "host": _runtime.get("comfyHost"),
        "port": _runtime.get("comfyPort"),
        "url": comfy_base(),
        "root": root,
        "rootExists": Path(root).is_dir() if root else False,
        "availableRoots": available_comfy_roots(),
        "autoStartComfy": bool(_runtime.get("autoStartComfy", True)),
        "log": str(COMFY_LOG.relative_to(REPO_ROOT)) if COMFY_LOG.exists() else str(COMFY_LOG),
        "startScript": str(COMFY_START_SH),
        "stopScript": str(COMFY_STOP_SH),
    }


def start_comfy() -> dict:
    if discover_comfy(adopt=True):
        st = comfy_status()
        return {
            "ok": True,
            "already": True,
            "status": st,
            "message": "ComfyUI already running on :" + str(_runtime.get("comfyPort")),
        }
    if not COMFY_START_SH.is_file():
        return {"ok": False, "error": "Missing start script: " + str(COMFY_START_SH)}
    env = os.environ.copy()
    env["COMFY_HOST"] = str(_runtime.get("comfyHost"))
    env["COMFY_PORT"] = str(_runtime.get("comfyPort"))
    env["COMFY_ROOT"] = str(_runtime.get("comfyRoot"))
    try:
        proc = subprocess.run(
            ["bash", str(COMFY_START_SH)],
            cwd=str(REPO_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=90,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "ComfyUI start timed out"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    for _ in range(40):
        if discover_comfy(adopt=True):
            return {
                "ok": True,
                "already": False,
                "status": comfy_status(),
                "message": "ComfyUI started on :" + str(_runtime.get("comfyPort")),
                "stdout": (proc.stdout or "").strip(),
            }
        time.sleep(0.25)
    return {
        "ok": False,
        "error": "ComfyUI started but not reachable yet",
        "stdout": (proc.stdout or "").strip(),
        "stderr": (proc.stderr or "").strip(),
        "status": comfy_status(),
    }


def stop_comfy() -> dict:
    if not COMFY_STOP_SH.is_file():
        return {"ok": False, "error": "Missing stop script: " + str(COMFY_STOP_SH)}
    env = os.environ.copy()
    env["COMFY_PORT"] = str(_runtime.get("comfyPort"))
    try:
        proc = subprocess.run(
            ["bash", str(COMFY_STOP_SH)],
            cwd=str(REPO_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return {
        "ok": True,
        "message": "ComfyUI stop requested",
        "stdout": (proc.stdout or "").strip(),
        "status": comfy_status(),
    }


def ensure_comfy_running() -> bool:
    if comfy_reachable():
        return True
    if not _runtime.get("autoStartComfy", True):
        return False
    return bool(start_comfy().get("ok"))


def load_api_workflow(path: Path | None = None) -> dict:
    p = path or API_WORKFLOW
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(
    positive: str,
    filename_prefix: str,
    width: int,
    height: int,
    seed: int | None = None,
    steps: int = 4,
    colors: int = 15,
    bg_hex: str = "#FF00FF",
) -> dict:
    wf = load_api_workflow()
    prefix = style_prefix(colors, bg_hex)
    full = positive.strip()
    if full.lower().startswith(STYLE_PREFIX[:40].lower()) or full.lower().startswith("pixel art, 16-bit"):
        pass
    else:
        full = (prefix + ", " + full) if full else prefix
    gen_w = max(256, int(width or 512))
    gen_h = max(256, int(height or 512))
    noise_seed = int(seed) if seed is not None else random.randint(0, 2147483647)
    wf["74"]["inputs"]["text"] = full
    wf["66"]["inputs"]["width"] = gen_w
    wf["66"]["inputs"]["height"] = gen_h
    wf["62"]["inputs"]["steps"] = max(1, int(steps or 4))
    wf["62"]["inputs"]["width"] = gen_w
    wf["62"]["inputs"]["height"] = gen_h
    wf["73"]["inputs"]["noise_seed"] = noise_seed
    wf["9"]["inputs"]["filename_prefix"] = filename_prefix or "ships/vf_flux"
    return wf


def build_portrait_prompt(
    positive: str,
    filename_prefix: str,
    width: int,
    height: int,
    seed: int | None,
    steps: int,
    reference_name: str,
) -> dict:
    wf = load_api_workflow(PORTRAIT_WORKFLOW)
    full = positive.strip()
    if not full.lower().startswith("pixel art"):
        full = (PORTRAIT_STYLE_PREFIX + ", " + full) if full else PORTRAIT_STYLE_PREFIX
    gen_w = max(256, int(width or 512))
    gen_h = max(256, int(height or 576))
    # Keep 96:108 aspect when square was requested
    if gen_w == gen_h:
        gen_h = int(round(gen_w * 108 / 96))
    noise_seed = int(seed) if seed is not None else random.randint(0, 2147483647)
    wf["74"]["inputs"]["text"] = full
    wf["80"]["inputs"]["image"] = reference_name
    wf["81"]["inputs"]["width"] = gen_w
    wf["81"]["inputs"]["height"] = gen_h
    wf["62"]["inputs"]["steps"] = max(1, int(steps or 4))
    wf["62"]["inputs"]["width"] = gen_w
    wf["62"]["inputs"]["height"] = gen_h
    wf["73"]["inputs"]["noise_seed"] = noise_seed
    wf["9"]["inputs"]["filename_prefix"] = filename_prefix or "portraits/vf_flux"
    return wf


def queue_and_wait(prompt: dict, timeout_s: float = 300.0) -> dict:
    base = comfy_base()
    result = http_json(
        "POST",
        base + "/prompt",
        {"prompt": prompt, "client_id": CLIENT_ID},
        timeout=30.0,
    )
    prompt_id = result.get("prompt_id")
    if not prompt_id:
        raise RuntimeError("ComfyUI queue failed: " + json.dumps(result)[:400])
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        hist = http_json("GET", base + "/history/" + str(prompt_id), timeout=10.0)
        entry = hist.get(str(prompt_id)) if isinstance(hist, dict) else None
        if entry:
            status = entry.get("status") or {}
            status_str = str(status.get("status_str") or "")
            if status.get("status_str") == "error" or status_str == "error":
                msgs = status.get("messages") or entry.get("messages") or []
                raise RuntimeError("ComfyUI job error: " + json.dumps(msgs)[:500])
            outputs = entry.get("outputs")
            if outputs and (status.get("completed") is True or status_str == "success" or True):
                # Prefer when images exist
                for node_out in outputs.values():
                    if node_out.get("images"):
                        return entry
        time.sleep(0.4)
    raise TimeoutError("ComfyUI generation timed out")


def fetch_image_bytes(entry: dict) -> bytes:
    base = comfy_base()
    outputs = entry.get("outputs") or {}
    for node_out in outputs.values():
        images = node_out.get("images") or []
        if not images:
            continue
        img = images[0]
        filename = img.get("filename")
        if not filename:
            continue
        subfolder = img.get("subfolder") or ""
        img_type = img.get("type") or "output"
        url = (
            base
            + "/view?filename="
            + filename
            + "&subfolder="
            + subfolder
            + "&type="
            + img_type
        )
        req = Request(url, method="GET")
        with urlopen(req, timeout=60.0) as resp:
            return resp.read()
    raise RuntimeError("No image in ComfyUI outputs")


def ensure_pil() -> None:
    if Image is None:
        raise RuntimeError(
            "Pillow required. Install: pip install Pillow  (or use ComfyUI venv)"
        )


def color_dist(a, b) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def make_transparent(img, key_rgb: tuple[int, int, int] | None = None):
    """Remove key color + corner-connected near-background → RGBA."""
    ensure_pil()
    key = key_rgb or MAGENTA
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    corners = [
        pixels[0, 0][:3],
        pixels[w - 1, 0][:3],
        pixels[0, h - 1][:3],
        pixels[w - 1, h - 1][:3],
    ]
    bg_r = sum(c[0] for c in corners) // 4
    bg_g = sum(c[1] for c in corners) // 4
    bg_b = sum(c[2] for c in corners) // 4

    def is_bg_like(rgb) -> bool:
        if color_dist(rgb, key) <= MAGENTA_TOL:
            return True
        return color_dist(rgb, (bg_r, bg_g, bg_b)) <= BG_TOL

    visited = set()
    transparent = set()
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        if not is_bg_like((r, g, b)):
            continue
        transparent.add((x, y))
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    for x, y in transparent:
        pixels[x, y] = (0, 0, 0, 0)
    return rgba


def punch_magenta_fringe(img, key_rgb: tuple[int, int, int] | None = None):
    """Clean up leftover near-key fringe from resize/quantize, without eating
    the character: flood-fills OUT from the already-transparent region only,
    so a magenta/pink detail that isn't touching the background survives."""
    ensure_pil()
    key = key_rgb or MAGENTA
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    visited = set()
    stack = []
    for y in range(h):
        for x in range(w):
            if pixels[x, y][3] == 0:
                visited.add((x, y))
                stack.append((x, y))
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) in visited or nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            visited.add((nx, ny))
            r, g, b, a = pixels[nx, ny]
            if a == 0:
                stack.append((nx, ny))
                continue
            if color_dist((r, g, b), key) <= MAGENTA_TOL:
                pixels[nx, ny] = (0, 0, 0, 0)
                stack.append((nx, ny))
    return rgba


def force_grayscale(img, key_rgb: tuple[int, int, int] | None = None):
    """Collapse RGB to luminance; drop residual chroma; keep alpha."""
    ensure_pil()
    key = key_rgb or MAGENTA
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if color_dist((r, g, b), key) <= MAGENTA_TOL:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            yv = int(round(0.299 * r + 0.587 * g + 0.114 * b))
            pixels[x, y] = (yv, yv, yv, a)
    return rgba


def quantize_grays(img, colors: int = 15):
    """Snap opaque luma to N evenly spaced gray levels (BG/alpha untouched)."""
    ensure_pil()
    n = max(2, min(15, int(colors or 15)))
    levels = []
    for i in range(n):
        shade = int(round(i * 255.0 / (n - 1))) if n > 1 else 128
        levels.append(shade)
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            best, best_d = levels[0], abs(r - levels[0])
            for lv in levels[1:]:
                d = abs(r - lv)
                if d < best_d:
                    best, best_d = lv, d
            pixels[x, y] = (best, best, best, a)
    return rgba


def nearest_resize(img, size: int):
    ensure_pil()
    s = max(1, int(size))
    return img.resize((s, s), Image.NEAREST)


def opaque_bbox(img, alpha_min: int = 12) -> tuple[int, int, int, int] | None:
    """Return (left, top, right, bottom) inclusive-exclusive bbox of opaque pixels."""
    ensure_pil()
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A").point(lambda a: 255 if a >= alpha_min else 0)
    box = alpha.getbbox()
    return box


def crop_content_square(img, pad_frac: float = 0.08):
    """Crop to opaque content, pad to square so nearest downscale keeps shape."""
    ensure_pil()
    rgba = img.convert("RGBA")
    box = opaque_bbox(rgba)
    if not box:
        return rgba
    left, top, right, bottom = box
    w = right - left
    h = bottom - top
    pad = int(round(max(w, h) * float(pad_frac)))
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(rgba.size[0], right + pad)
    bottom = min(rgba.size[1], bottom + pad)
    cropped = rgba.crop((left, top, right, bottom))
    cw, ch = cropped.size
    side = max(cw, ch)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square.paste(cropped, (ox, oy))
    return square


def process_image(raw: bytes, out_size: int = 64, colors: int = 15, bg_hex: str = "#FF00FF") -> bytes:
    ensure_pil()
    key = parse_hex_color(bg_hex, MAGENTA)
    img = Image.open(io.BytesIO(raw))
    img = make_transparent(img, key)
    img = force_grayscale(img, key)
    img = crop_content_square(img)
    side = max(1, int(out_size or 64))
    # Soft box downscale then nearest snap when source is much larger
    cw, ch = img.size
    if max(cw, ch) > side * 2:
        mid = max(side * 2, int(max(cw, ch) * 0.5))
        img = img.resize((mid, mid), Image.Resampling.BOX)
    img = nearest_resize(img, side)
    img = quantize_grays(img, colors)
    # Punch leftover fully-magenta fringe (border-connected only — keeps magenta/pink character detail intact)
    img = punch_magenta_fringe(img, key)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def process_portrait_image(
    raw: bytes,
    out_w: int = 96,
    out_h: int = 108,
    colors: int = 24,
    bg_hex: str = "#FF00FF",
) -> bytes:
    """Color pixel portrait: chroma-key, crop, nearest resize to bust size."""
    ensure_pil()
    key = parse_hex_color(bg_hex, MAGENTA)
    img = Image.open(io.BytesIO(raw))
    img = make_transparent(img, key)
    box = opaque_bbox(img)
    if box:
        left, top, right, bottom = box
        pad = int(round(max(right - left, bottom - top) * 0.06))
        left = max(0, left - pad)
        top = max(0, top - pad)
        right = min(img.size[0], right + pad)
        bottom = min(img.size[1], bottom + pad)
        img = img.crop((left, top, right, bottom))
    tw = max(16, int(out_w or 96))
    th = max(16, int(out_h or 108))
    # Fit into target aspect with letterbox transparency
    cw, ch = img.size
    scale = min(tw / max(1, cw), th / max(1, ch))
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    if max(cw, ch) > max(tw, th) * 2:
        img = img.resize((nw, nh), Image.Resampling.BOX)
    else:
        img = img.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(img, ((tw - nw) // 2, (th - nh) // 2), img)
    # Light color quantize (keep chroma)
    n = max(8, min(48, int(colors or 24)))
    q = canvas.convert("RGB").quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    q = q.convert("RGBA")
    # restore alpha from canvas
    ca = canvas.split()[3]
    q.putalpha(ca)
    # Punch leftover fully-magenta fringe (border-connected only — keeps magenta/pink character detail intact)
    q = punch_magenta_fringe(q, key)
    buf = io.BytesIO()
    q.save(buf, format="PNG")
    return buf.getvalue()


def png_to_data_url(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def safe_repo_path(rel: str) -> Path:
    rel = str(rel).replace("\\", "/").lstrip("/")
    if ".." in rel.split("/"):
        raise ValueError("Invalid path")
    dest = (REPO_ROOT / rel).resolve()
    if not str(dest).startswith(str(REPO_ROOT.resolve())):
        raise ValueError("Path outside repo")
    return dest


def update_faction_manifest(dest: Path) -> None:
    """If dest is under assets/factions/<id>/..., refresh that folder's manifest.json."""
    try:
        rel = dest.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return
    parts = rel.split("/")
    if len(parts) < 3 or parts[0] != "assets" or parts[1] != "factions":
        return
    faction_dir = REPO_ROOT / "assets" / "factions" / parts[2]
    if not faction_dir.is_dir():
        return
    names = []
    for p in sorted(faction_dir.rglob("*")):
        if p.is_file() and p.name != "manifest.json":
            names.append(p.relative_to(faction_dir).as_posix())
    manifest_path = faction_dir / "manifest.json"
    try:
        manifest_path.write_text(json.dumps(names, indent=1) + "\n", encoding="utf-8")
    except Exception as exc:
        sys.stderr.write("[asset-gen] manifest update failed: %s\n" % exc)


def upload_comfy_image(png: bytes, filename: str = "vf_portrait_ref.png") -> str:
    """Upload PNG bytes to ComfyUI input folder; return the stored filename."""
    import urllib.request

    boundary = "----vfassetgen" + uuid.uuid4().hex
    body = (
        (
            "--"
            + boundary
            + "\r\n"
            + 'Content-Disposition: form-data; name="image"; filename="'
            + filename
            + '"\r\n'
            + "Content-Type: image/png\r\n\r\n"
        ).encode("utf-8")
        + png
        + ("\r\n--" + boundary + "--\r\n").encode("utf-8")
    )
    req = Request(
        comfy_base() + "/upload/image",
        data=body,
        headers={"Content-Type": "multipart/form-data; boundary=" + boundary},
        method="POST",
    )
    with urlopen(req, timeout=60.0) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    name = data.get("name") or filename
    return str(name)


def decode_data_url_png(data_url: str) -> bytes:
    if "base64," in data_url:
        b64 = data_url.split("base64,", 1)[1]
    else:
        raise ValueError("dataUrl (base64 PNG) required")
    return base64.b64decode(b64)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[asset-gen] " + (fmt % args) + "\n")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, obj: dict):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            pillow_ok = Image is not None
            wf_ok = API_WORKFLOW.is_file()
            running = comfy_reachable()
            self._json(
                200,
                {
                    "ok": True,
                    "bridge": True,
                    "comfy": running,
                    "comfyUrl": comfy_base(),
                    "pillow": pillow_ok,
                    "workflow": wf_ok,
                    "portraitWorkflow": PORTRAIT_WORKFLOW.is_file(),
                    "comfyStatus": comfy_status(),
                },
            )
            return
        if path == "/api/comfy/status":
            self._json(200, comfy_status())
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._json(400, {"ok": False, "error": "invalid json"})
            return
        path = self.path.split("?", 1)[0]
        if path == "/api/generate":
            self._handle_generate(data)
            return
        if path == "/api/accept":
            self._handle_accept(data)
            return
        if path == "/api/comfy/start":
            self._json(200, start_comfy())
            return
        if path == "/api/comfy/stop":
            self._json(200, stop_comfy())
            return
        if path == "/api/comfy/config":
            self._handle_comfy_config(data)
            return
        if path == "/api/write-json":
            self._handle_write_json(data)
            return
        if path == "/api/write-png":
            self._handle_write_png(data)
            return
        self._json(404, {"ok": False, "error": "not found"})

    def _handle_comfy_config(self, data: dict):
        if "host" in data:
            _runtime["comfyHost"] = str(data.get("host") or "127.0.0.1")
        if "port" in data:
            try:
                _runtime["comfyPort"] = int(data.get("port") or _runtime["comfyPort"])
            except (TypeError, ValueError):
                pass
        if "root" in data and data.get("root"):
            _runtime["comfyRoot"] = str(data.get("root"))
        if "autoStartComfy" in data:
            _runtime["autoStartComfy"] = bool(data.get("autoStartComfy"))
        self._json(200, {"ok": True, "status": comfy_status()})

    def _handle_write_json(self, data: dict):
        target_path = str(data.get("targetPath") or "")
        payload = data.get("data")
        if not target_path:
            self._json(400, {"ok": False, "error": "targetPath required"})
            return
        if not isinstance(payload, (dict, list)):
            self._json(400, {"ok": False, "error": "data must be object or array"})
            return
        rel = target_path.replace("\\", "/").lstrip("/")
        if not rel.startswith("assets/") or not rel.endswith(".json"):
            self._json(400, {"ok": False, "error": "Only assets/**/*.json allowed"})
            return
        try:
            dest = safe_repo_path(rel)
        except ValueError as e:
            self._json(400, {"ok": False, "error": str(e)})
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        self._json(200, {"ok": True, "path": rel})

    def _handle_write_png(self, data: dict):
        target_path = str(data.get("targetPath") or "")
        data_url = str(data.get("dataUrl") or "")
        if not target_path:
            self._json(400, {"ok": False, "error": "targetPath required"})
            return
        if "base64," not in data_url:
            self._json(400, {"ok": False, "error": "dataUrl (base64 PNG) required"})
            return
        rel = target_path.replace("\\", "/").lstrip("/")
        if not rel.startswith("assets/") or not rel.endswith(".png"):
            self._json(400, {"ok": False, "error": "Only assets/**/*.png allowed"})
            return
        try:
            dest = safe_repo_path(rel)
            raw = decode_data_url_png(data_url)
        except Exception as e:
            self._json(400, {"ok": False, "error": "invalid dataUrl: " + str(e)})
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        ensure_pil()
        img = Image.open(io.BytesIO(raw))
        is_portrait = "/portraits/" in rel or rel.endswith("/portraits.png")
        if not is_portrait:
            img = force_grayscale(img)
        img = img.convert("RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        dest.write_bytes(buf.getvalue())
        update_faction_manifest(dest)
        bust = int(time.time() * 1000)
        self._json(
            200,
            {
                "ok": True,
                "path": rel,
                "url": rel + "?v=" + str(bust),
                "spriteName": dest.stem,
            },
        )

    def _handle_generate(self, data: dict):
        refresh_comfy_globals()
        if not comfy_reachable():
            if _runtime.get("autoStartComfy", True):
                start_comfy()
            if not comfy_reachable():
                self._json(
                    503,
                    {
                        "ok": False,
                        "error": "ComfyUI not reachable. Use Settings → START COMFYUI (or npm run comfy)",
                    },
                )
                return
        if Image is None:
            self._json(
                500,
                {
                    "ok": False,
                    "error": "Pillow missing. Prefer: /mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/bin/python tools/asset-gen/bridge.py",
                },
            )
            return

        mode = str(data.get("mode") or "sprite").strip().lower()
        prompt_text = str(data.get("prompt") or "")
        filename_prefix = str(data.get("filenamePrefix") or (
            "portraits/vf_flux" if mode == "portrait" else "ships/vf_flux"
        ))
        out_size = int(data.get("size") or (96 if mode == "portrait" else 64))
        gen_size = int(data.get("genSize") or 512)
        seed = data.get("seed")
        steps = int(data.get("steps") or 4)
        colors = int(data.get("colors") or (24 if mode == "portrait" else 15))
        bg_hex = str(data.get("bgColor") or "#FF00FF")
        prepend_style = data.get("prependStyle")
        skip_style = str(prepend_style).lower() == "false" or prepend_style is False

        try:
            if mode == "portrait":
                if not PORTRAIT_WORKFLOW.is_file():
                    self._json(500, {"ok": False, "error": "Portrait workflow missing"})
                    return
                ref_url = str(data.get("referenceDataUrl") or "")
                ref_path = str(data.get("referencePath") or "")
                if not ref_url and not ref_path:
                    self._json(400, {"ok": False, "error": "portrait mode needs referenceDataUrl or referencePath"})
                    return
                if ref_url:
                    ref_png = decode_data_url_png(ref_url)
                else:
                    ref_file = safe_repo_path(ref_path)
                    ref_png = ref_file.read_bytes()
                ref_name = upload_comfy_image(ref_png, "vf_portrait_ref.png")
                out_w = int(data.get("outWidth") or out_size or 96)
                out_h = int(data.get("outHeight") or int(round(out_w * 108 / 96)))
                gen_w = max(256, gen_size)
                gen_h = int(round(gen_w * 108 / 96))
                full_prompt = prompt_text
                if skip_style:
                    full_prompt = prompt_text
                prompt = build_portrait_prompt(
                    full_prompt,
                    filename_prefix,
                    gen_w,
                    gen_h,
                    int(seed) if seed not in (None, "") else None,
                    steps,
                    ref_name,
                )
                used_seed = prompt["73"]["inputs"]["noise_seed"]
                entry = queue_and_wait(prompt)
                raw = fetch_image_bytes(entry)
                png = process_portrait_image(raw, out_w, out_h, colors, bg_hex)
                gw, gh = gen_w, gen_h
            else:
                gen_w = max(256, gen_size)
                gen_h = gen_w
                positive = prompt_text
                if skip_style:
                    # build_prompt still may add prefix unless text already looks styled;
                    # force raw by prepending a marker that build_prompt detects — pass via STYLE-like start
                    positive = prompt_text if prompt_text else STYLE_PREFIX
                prompt = build_prompt(
                    positive,
                    filename_prefix,
                    gen_w,
                    gen_h,
                    int(seed) if seed not in (None, "") else None,
                    steps,
                    colors,
                    bg_hex,
                )
                if skip_style:
                    prompt["74"]["inputs"]["text"] = prompt_text or STYLE_PREFIX
                used_seed = prompt["73"]["inputs"]["noise_seed"]
                entry = queue_and_wait(prompt)
                raw = fetch_image_bytes(entry)
                png = process_image(raw, out_size, colors, bg_hex)
                gw, gh = gen_w, gen_h
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"ok": False, "error": str(e)})
            return

        STAGING_DIR.mkdir(parents=True, exist_ok=True)
        staging_id = uuid.uuid4().hex
        staging_path = STAGING_DIR / (staging_id + ".png")
        staging_path.write_bytes(png)
        self._json(
            200,
            {
                "ok": True,
                "stagingId": staging_id,
                "seed": used_seed,
                "genWidth": gw,
                "genHeight": gh,
                "previewDataUrl": png_to_data_url(png),
                "mode": mode,
            },
        )

    def _handle_accept(self, data: dict):
        staging_id = str(data.get("stagingId") or "")
        target_path = str(data.get("targetPath") or "")
        if not staging_id or not target_path:
            self._json(400, {"ok": False, "error": "stagingId and targetPath required"})
            return
        src = STAGING_DIR / (staging_id + ".png")
        if not src.is_file():
            self._json(404, {"ok": False, "error": "staging image not found"})
            return
        try:
            dest = safe_repo_path(target_path.replace("\\", "/").lstrip("/"))
        except ValueError as e:
            self._json(400, {"ok": False, "error": str(e)})
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        ensure_pil()
        img = Image.open(io.BytesIO(src.read_bytes()))
        rel = dest.relative_to(REPO_ROOT).as_posix()
        is_portrait = "/portraits/" in rel or rel.endswith("/portraits.png")
        if not is_portrait:
            img = force_grayscale(img)
        img = img.convert("RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        dest.write_bytes(buf.getvalue())
        update_faction_manifest(dest)
        bust = int(time.time() * 1000)
        self._json(
            200,
            {
                "ok": True,
                "path": rel,
                "url": rel + "?v=" + str(bust),
                "spriteName": dest.stem,
            },
        )


def main():
    # Prefer ComfyUI venv python (has Pillow + matches torch env expectations for ops)
    venv_site = Path("/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/lib")
    comfy_py = Path("/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/bin/python")
    if Image is None and comfy_py.is_file() and Path(sys.executable).resolve() != comfy_py.resolve():
        os.execv(str(comfy_py), [str(comfy_py), str(Path(__file__).resolve()), *sys.argv[1:]])
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((BRIDGE_HOST, BRIDGE_PORT), Handler)
    print("Asset-Gen Bridge http://" + BRIDGE_HOST + ":" + str(BRIDGE_PORT))
    print("  ComfyUI: " + comfy_base())
    print("  Workflow: " + str(API_WORKFLOW))
    print("  Pillow: " + ("yes" if Image is not None else "NO"))
    print("  Comfy control: POST /api/comfy/start|stop  GET /api/comfy/status")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
