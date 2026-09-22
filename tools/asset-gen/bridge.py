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
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            key, val = s.split("=", 1)
            out[key.strip()] = val.strip().strip('"').strip("'")
    except OSError:
        return {}
    return out


def _resolve_comfy_defaults() -> tuple[str, int, str]:
    local = _load_local_env()
    root = (
        os.environ.get("COMFY_ROOT")
        or local.get("COMFY_ROOT")
        or next((p for p in QUICKY_ROOTS if Path(p).is_dir()), COMFY_ROOT_DEFAULT)
    )
    host = os.environ.get("COMFY_HOST") or local.get("COMFY_HOST") or "127.0.0.1"
    port_raw = os.environ.get("COMFY_PORT") or local.get("COMFY_PORT")
    if port_raw:
        port = int(port_raw)
    elif Path("/mnt/quicky2").is_dir():
        port = 6767
    else:
        port = 8188
    return root, port, host


_COMFY_ROOT_DEF, _COMFY_PORT_DEF, _COMFY_HOST_DEF = _resolve_comfy_defaults()

# Mutable runtime config (UI can update host/port)
_runtime = {
    "comfyHost": _COMFY_HOST_DEF,
    "comfyPort": _COMFY_PORT_DEF,
    "comfyRoot": _COMFY_ROOT_DEF,
    "autoStartComfy": True,
}

BRIDGE_HOST = os.environ.get("ASSET_GEN_HOST", "127.0.0.1")
BRIDGE_PORT = int(os.environ.get("ASSET_GEN_PORT", "8787"))
CLIENT_ID = str(uuid.uuid4())


def comfy_base() -> str:
    return f"http://{_runtime['comfyHost']}:{_runtime['comfyPort']}"


COMFY_HOST = _runtime["comfyHost"]
COMFY_PORT = _runtime["comfyPort"]
COMFY_BASE = comfy_base()

STYLE_PREFIX = (
    "pixel art, 16-bit game sprite, pure grayscale only, monochrome gray shades, "
    "NO color, NO hue, NO chroma, Game Boy gray palette, flat shading, crisp pixels, "
    "solid magenta background #FF00FF, centered, single object, subject fills most of frame, "
    "large clear silhouette, high contrast, no text, no UI, "
    "luminance mask for later in-engine tint"
)

MAGENTA = (255, 0, 255)
MAGENTA_TOL = 48
BG_TOL = 36


def parse_hex_color(value: str | None, fallback: tuple[int, int, int] = MAGENTA) -> tuple[int, int, int]:
    if not value or not isinstance(value, str):
        return fallback
    h = value.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return fallback
    try:
        n = int(h, 16)
    except ValueError:
        return fallback
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def style_prefix(colors: int = 15, bg_hex: str = "#FF00FF") -> str:
    n = max(2, min(15, int(colors) if colors else 15))
    bg = (bg_hex or "#FF00FF").upper()
    if not bg.startswith("#"):
        bg = "#" + bg
    return (
        f"pixel art, 16-bit game sprite, pure grayscale only, monochrome gray shades, "
        f"exactly {n} base gray colors max (not counting background), "
        f"NO color, NO hue, NO chroma, Game Boy gray palette, flat shading, crisp pixels, "
        f"solid background {bg}, chroma key background, centered, single object, "
        f"subject fills most of frame, large clear silhouette, high contrast, no text, no UI, "
        f"luminance mask for later in-engine tint"
    )

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore


def refresh_comfy_globals():
    global COMFY_HOST, COMFY_PORT, COMFY_BASE
    COMFY_HOST = _runtime["comfyHost"]
    COMFY_PORT = int(_runtime["comfyPort"])
    COMFY_BASE = comfy_base()
    os.environ["COMFY_HOST"] = COMFY_HOST
    os.environ["COMFY_PORT"] = str(COMFY_PORT)
    os.environ["COMFY_ROOT"] = str(_runtime["comfyRoot"])


def http_json(method: str, url: str, body: dict | None = None, timeout: float = 120.0):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers=headers, method=method)
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if not raw:
            return None
        return json.loads(raw.decode("utf-8"))


def comfy_probe(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        http_json("GET", f"http://{host}:{int(port)}/system_stats", timeout=timeout)
        return True
    except Exception:
        return False


def discover_comfy(adopt: bool = True) -> bool:
    """Find a live ComfyUI; prefer configured port, then Quicky/SM defaults."""
    refresh_comfy_globals()
    host = str(_runtime.get("comfyHost") or "127.0.0.1")
    configured = int(_runtime.get("comfyPort") or _COMFY_PORT_DEF)
    candidates: list[int] = []
    for p in (configured, 6767, 8188, _COMFY_PORT_DEF):
        try:
            pi = int(p)
        except (TypeError, ValueError):
            continue
        if pi not in candidates:
            candidates.append(pi)
    for port in candidates:
        if comfy_probe(host, port):
            if adopt and int(_runtime.get("comfyPort") or 0) != port:
                _runtime["comfyPort"] = port
                refresh_comfy_globals()
            return True
    return False


def comfy_reachable() -> bool:
    return discover_comfy(adopt=True)


def comfy_pid() -> int | None:
    try:
        if COMFY_PID_FILE.is_file():
            pid = int(COMFY_PID_FILE.read_text(encoding="utf-8").strip() or "0")
            if pid > 0:
                os.kill(pid, 0)
                return pid
    except Exception:
        return None
    return None


def available_comfy_roots() -> list[str]:
    roots: list[str] = []
    for p in QUICKY_ROOTS:
        if Path(p).is_dir() and (Path(p) / "main.py").is_file():
            roots.append(p)
    cur = str(_runtime.get("comfyRoot") or "")
    if cur and Path(cur).is_dir() and cur not in roots:
        roots.insert(0, cur)
    return roots


def comfy_status() -> dict:
    running = discover_comfy(adopt=True)
    pid = comfy_pid()
    return {
        "ok": True,
        "running": running,
        "pid": pid,
        "host": _runtime["comfyHost"],
        "port": int(_runtime["comfyPort"]),
        "url": comfy_base(),
        "root": _runtime["comfyRoot"],
        "rootExists": Path(_runtime["comfyRoot"]).is_dir(),
        "availableRoots": available_comfy_roots(),
        "autoStartComfy": bool(_runtime["autoStartComfy"]),
        "log": str(COMFY_LOG.relative_to(REPO_ROOT)) if COMFY_LOG.exists() else None,
        "startScript": str(COMFY_START_SH.relative_to(REPO_ROOT)),
        "stopScript": str(COMFY_STOP_SH.relative_to(REPO_ROOT)),
    }


def start_comfy() -> dict:
    if discover_comfy(adopt=True):
        return {
            "ok": True,
            "already": True,
            "status": comfy_status(),
            "message": f"ComfyUI already running on :{_runtime['comfyPort']}",
        }
    if not COMFY_START_SH.is_file():
        return {"ok": False, "error": f"Missing start script: {COMFY_START_SH}"}
    env = os.environ.copy()
    env["COMFY_HOST"] = _runtime["comfyHost"]
    env["COMFY_PORT"] = str(_runtime["comfyPort"])
    env["COMFY_ROOT"] = str(_runtime["comfyRoot"])
    try:
        proc = subprocess.run(
            ["bash", str(COMFY_START_SH)],
            cwd=str(REPO_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "ComfyUI start timed out"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    # Wait briefly for listen; also re-discover alternate ports (e.g. SM :6767)
    for _ in range(40):
        if discover_comfy(adopt=True):
            return {
                "ok": True,
                "already": False,
                "status": comfy_status(),
                "message": f"ComfyUI started on :{_runtime['comfyPort']}",
                "stdout": (proc.stdout or "").strip()[-500:],
            }
        time.sleep(0.25)

    return {
        "ok": False,
        "error": "ComfyUI started but not reachable yet",
        "stdout": (proc.stdout or "").strip()[-500:],
        "stderr": (proc.stderr or "").strip()[-500:],
        "status": comfy_status(),
    }


def stop_comfy() -> dict:
    refresh_comfy_globals()
    if not COMFY_STOP_SH.is_file():
        return {"ok": False, "error": f"Missing stop script: {COMFY_STOP_SH}"}
    env = os.environ.copy()
    env["COMFY_PORT"] = str(_runtime["comfyPort"])
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
        "stdout": (proc.stdout or "").strip()[-500:],
        "status": comfy_status(),
    }


def ensure_comfy_running() -> bool:
    if comfy_reachable():
        return True
    if not _runtime.get("autoStartComfy", True):
        return False
    result = start_comfy()
    return bool(result.get("ok")) and comfy_reachable()


def load_api_workflow() -> dict:
    with open(API_WORKFLOW, "r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(
    positive: str,
    filename_prefix: str,
    width: int,
    height: int,
    seed: int | None,
    steps: int = 4,
    colors: int = 15,
    bg_hex: str = "#FF00FF",
) -> dict:
    wf = load_api_workflow()
    full = positive.strip()
    prefix = style_prefix(colors, bg_hex)
    if prefix.lower() not in full.lower() and STYLE_PREFIX.lower() not in full.lower():
        full = f"{prefix}, {full}" if full else prefix

    gen_w = max(256, int(width) if width >= 256 else 512)
    gen_h = max(256, int(height) if height >= 256 else 512)
    # Flux2 prefers multiples of 16
    gen_w = (gen_w // 16) * 16
    gen_h = (gen_h // 16) * 16
    noise_seed = int(seed) if seed is not None else random.randint(0, 2**31 - 1)

    wf["74"]["inputs"]["text"] = full
    wf["66"]["inputs"]["width"] = gen_w
    wf["66"]["inputs"]["height"] = gen_h
    wf["62"]["inputs"]["width"] = gen_w
    wf["62"]["inputs"]["height"] = gen_h
    wf["62"]["inputs"]["steps"] = int(steps)
    wf["73"]["inputs"]["noise_seed"] = noise_seed
    wf["9"]["inputs"]["filename_prefix"] = filename_prefix or "ships/vf_flux"
    return wf, noise_seed, gen_w, gen_h


def queue_and_wait(prompt: dict, timeout_s: float = 300.0) -> dict:
    base = comfy_base()
    result = http_json(
        "POST",
        f"{base}/prompt",
        {"prompt": prompt, "client_id": CLIENT_ID},
        timeout=30.0,
    )
    if not result or "prompt_id" not in result:
        raise RuntimeError(f"ComfyUI queue failed: {result}")
    prompt_id = result["prompt_id"]
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        hist = http_json("GET", f"{base}/history/{prompt_id}", timeout=10.0)
        if hist and prompt_id in hist:
            entry = hist[prompt_id]
            status = (entry.get("status") or {}).get("status_str") or ""
            if status == "error" or entry.get("status", {}).get("completed") is False and entry.get("outputs") == {}:
                msgs = entry.get("status", {}).get("messages") or []
                raise RuntimeError(f"ComfyUI job error: {msgs}")
            outputs = entry.get("outputs") or {}
            if outputs:
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
        filename = img["filename"]
        subfolder = img.get("subfolder") or ""
        img_type = img.get("type") or "output"
        url = (
            f"{base}/view?filename={filename}"
            f"&subfolder={subfolder}&type={img_type}"
        )
        req = Request(url, method="GET")
        with urlopen(req, timeout=60.0) as resp:
            return resp.read()
    raise RuntimeError("No image in ComfyUI outputs")


def ensure_pil():
    if Image is None:
        raise RuntimeError(
            "Pillow required. Install: pip install Pillow  (or use ComfyUI venv)"
        )


def color_dist(a, b) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def make_transparent(img: "Image.Image", key_rgb: tuple[int, int, int] | None = None) -> "Image.Image":
    """Remove key color + corner-connected near-background → RGBA."""
    ensure_pil()
    key = key_rgb or MAGENTA
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    # Sample corner average as secondary bg
    corners = [pixels[0, 0][:3], pixels[w - 1, 0][:3], pixels[0, h - 1][:3], pixels[w - 1, h - 1][:3]]
    bg_r = sum(c[0] for c in corners) // 4
    bg_g = sum(c[1] for c in corners) // 4
    bg_b = sum(c[2] for c in corners) // 4
    bg = (bg_r, bg_g, bg_b)

    # Flood from corners for near-bg
    visited = [[False] * w for _ in range(h)]
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    transparent = set()

    def is_bg_like(rgb):
        if color_dist(rgb, key) <= MAGENTA_TOL * 3:
            return True
        if color_dist(rgb, bg) <= BG_TOL * 3:
            return True
        # near-white / near-black solid sheets also treated as bg if corners match
        return False

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, a = pixels[x, y]
        if not is_bg_like((r, g, b)):
            continue
        transparent.add((x, y))
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    # Also hard-key all key-color pixels (even interior)
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if color_dist((r, g, b), key) <= MAGENTA_TOL * 3:
                transparent.add((x, y))

    for x, y in transparent:
        pixels[x, y] = (0, 0, 0, 0)

    # Near-key fringe → fully transparent (no pink residue)
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if color_dist((r, g, b), key) <= MAGENTA_TOL * 5:
                pixels[x, y] = (0, 0, 0, 0)

    return rgba


def force_grayscale(img: "Image.Image", key_rgb: tuple[int, int, int] | None = None) -> "Image.Image":
    """Collapse RGB to luminance; drop residual chroma; keep alpha.

    Also punches leftover key-color fringe to transparent so tinted tips
    cannot survive as tinted gray.
    """
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
            # Residual key color → fully transparent (not pink gray)
            if color_dist((r, g, b), key) <= MAGENTA_TOL * 4:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            # Rec. 601 luma — shape energy for multiply/tint overlays
            yv = int(round(0.299 * r + 0.587 * g + 0.114 * b))
            # Keep alpha; force R=G=B
            pixels[x, y] = (yv, yv, yv, a)
    return rgba


def quantize_grays(img: "Image.Image", colors: int = 15) -> "Image.Image":
    """Snap opaque luma to N evenly spaced gray levels (BG/alpha untouched)."""
    ensure_pil()
    n = max(2, min(15, int(colors) if colors else 15))
    if n >= 15:
        return img
    # Match JS shadeToGray ramp: 44 + t*(248-44) for shades 1..15
    levels = []
    for i in range(n):
        shade = 1 + round(i * 14 / (n - 1)) if n > 1 else 8
        t = shade / 15.0
        levels.append(int(round(44 + t * (248 - 44))))
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 16:
                continue
            best = levels[0]
            best_d = abs(r - best)
            for lv in levels[1:]:
                d = abs(r - lv)
                if d < best_d:
                    best_d = d
                    best = lv
            pixels[x, y] = (best, best, best, a)
    return rgba


def nearest_resize(img: "Image.Image", size: int) -> "Image.Image":
    ensure_pil()
    size = max(1, int(size))
    return img.resize((size, size), Image.NEAREST)


def opaque_bbox(img: "Image.Image", alpha_min: int = 12) -> tuple[int, int, int, int] | None:
    """Return (left, top, right, bottom) inclusive-exclusive bbox of opaque pixels."""
    ensure_pil()
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    # getbbox returns None if fully transparent
    box = alpha.point(lambda a: 255 if a >= alpha_min else 0).getbbox()
    return box


def crop_content_square(img: "Image.Image", pad_frac: float = 0.08) -> "Image.Image":
    """Crop to opaque content, pad to square so nearest downscale keeps shape."""
    ensure_pil()
    rgba = img.convert("RGBA")
    box = opaque_bbox(rgba)
    if not box:
        return rgba
    left, top, right, bottom = box
    w = max(1, right - left)
    h = max(1, bottom - top)
    pad = max(1, int(round(max(w, h) * pad_frac)))
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(rgba.size[0], right + pad)
    bottom = min(rgba.size[1], bottom + pad)
    cropped = rgba.crop((left, top, right, bottom))
    cw, ch = cropped.size
    side = max(cw, ch)
    if side <= 0:
        return rgba
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square.paste(cropped, (ox, oy), cropped)
    return square


def process_image(
    raw: bytes,
    out_size: int,
    colors: int = 15,
    bg_hex: str = "#FF00FF",
) -> bytes:
    ensure_pil()
    key = parse_hex_color(bg_hex, MAGENTA)
    img = Image.open(io.BytesIO(raw))
    img = make_transparent(img, key)
    img = force_grayscale(img, key)
    # Critical: crop subject before downscale. Nearest 512→8 without crop
    # collapses the whole canvas to 2–4 muddy pixels ("mist").
    img = crop_content_square(img)
    if out_size and out_size > 0:
        # Prefer LANCZOS→NEAREST for large shrink: first reduce with box/lanczos
        # to retain silhouette energy, then snap to crisp pixels.
        side = max(1, int(out_size))
        cw, ch = img.size
        if max(cw, ch) > side * 4:
            mid = max(side * 2, side)
            img = img.resize((mid, mid), Image.Resampling.BOX)
        img = nearest_resize(img, side)
        img = force_grayscale(img, key)
        img = quantize_grays(img, colors)
        # Drop near-empty fringe alphas after resize
        px = img.load()
        for y in range(side):
            for x in range(side):
                r, g, b, a = px[x, y]
                if a < 20:
                    px[x, y] = (0, 0, 0, 0)
                elif r < 8 and g < 8 and b < 8 and a < 40:
                    px[x, y] = (0, 0, 0, 0)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def png_to_data_url(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def safe_repo_path(rel: str) -> Path:
    rel = rel.replace("\\", "/").lstrip("/")
    if ".." in rel.split("/"):
        raise ValueError("Invalid path")
    target = (REPO_ROOT / rel).resolve()
    if not str(target).startswith(str(REPO_ROOT.resolve())):
        raise ValueError("Path outside repo")
    return target


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[asset-gen] " + (fmt % args) + "\n")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/api/health"):
            refresh_comfy_globals()
            ok = comfy_reachable()
            self._json(200, {
                "ok": True,
                "bridge": True,
                "comfy": ok,
                "comfyUrl": comfy_base(),
                "pillow": Image is not None,
                "workflow": API_WORKFLOW.exists(),
                "comfyStatus": comfy_status(),
            })
            return
        if path.startswith("/api/comfy/status"):
            self._json(200, comfy_status())
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw_body = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid json"})
            return

        path = self.path.split("?")[0]
        try:
            if path.startswith("/api/generate"):
                self._handle_generate(data)
                return
            if path.startswith("/api/accept"):
                self._handle_accept(data)
                return
            if path.startswith("/api/comfy/start"):
                self._json(200, start_comfy())
                return
            if path.startswith("/api/comfy/stop"):
                self._json(200, stop_comfy())
                return
            if path.startswith("/api/comfy/config"):
                self._handle_comfy_config(data)
                return
            if path.startswith("/api/write-json"):
                self._handle_write_json(data)
                return
            if path.startswith("/api/write-png"):
                self._handle_write_png(data)
                return
            self._json(404, {"ok": False, "error": "not found"})
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"ok": False, "error": str(e)})

    def _handle_comfy_config(self, data: dict):
        if data.get("host"):
            _runtime["comfyHost"] = str(data.get("host")).strip() or "127.0.0.1"
        if data.get("port") is not None:
            try:
                _runtime["comfyPort"] = int(data.get("port"))
            except (TypeError, ValueError):
                pass
        if data.get("root"):
            _runtime["comfyRoot"] = str(data.get("root")).strip() or _COMFY_ROOT_DEF
        if "autoStartComfy" in data:
            _runtime["autoStartComfy"] = bool(data.get("autoStartComfy"))
        refresh_comfy_globals()
        self._json(200, {"ok": True, "status": comfy_status()})

    def _handle_write_json(self, data: dict):
        target_path = str(data.get("targetPath") or "")
        payload = data.get("data")
        if not target_path:
            self._json(400, {"ok": False, "error": "targetPath required"})
            return
        if payload is None or not isinstance(payload, (dict, list)):
            self._json(400, {"ok": False, "error": "data must be object or array"})
            return
        rel = target_path.replace("\\", "/").lstrip("/")
        if not (rel.startswith("assets/") and rel.endswith(".json")):
            self._json(400, {"ok": False, "error": "Only assets/**/*.json allowed"})
            return
        try:
            dest = safe_repo_path(rel)
        except ValueError as e:
            self._json(400, {"ok": False, "error": str(e)})
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        rel_out = str(dest.relative_to(REPO_ROOT)).replace("\\", "/")
        self._json(200, {"ok": True, "path": rel_out})

    def _handle_write_png(self, data: dict):
        target_path = str(data.get("targetPath") or "")
        data_url = str(data.get("dataUrl") or "")
        if not target_path:
            self._json(400, {"ok": False, "error": "targetPath required"})
            return
        if not data_url or "base64," not in data_url:
            self._json(400, {"ok": False, "error": "dataUrl (base64 PNG) required"})
            return
        rel = target_path.replace("\\", "/").lstrip("/")
        if not (rel.startswith("assets/") and rel.endswith(".png")):
            self._json(400, {"ok": False, "error": "Only assets/**/*.png allowed"})
            return
        try:
            dest = safe_repo_path(rel)
        except ValueError as e:
            self._json(400, {"ok": False, "error": str(e)})
            return
        try:
            b64 = data_url.split("base64,", 1)[1]
            raw = base64.b64decode(b64)
        except Exception as e:
            self._json(400, {"ok": False, "error": "invalid dataUrl: " + str(e)})
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            ensure_pil()
            img = Image.open(io.BytesIO(raw))
            img = force_grayscale(img.convert("RGBA"))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            dest.write_bytes(buf.getvalue())
        except Exception:
            dest.write_bytes(raw)
        try:
            manifest_path = dest.parent / "manifest.json"
            stem = dest.stem
            names = []
            if manifest_path.is_file():
                raw_m = json.loads(manifest_path.read_text(encoding="utf-8"))
                if isinstance(raw_m, list):
                    names = [str(x) for x in raw_m if x]
                elif isinstance(raw_m, dict) and isinstance(raw_m.get("files"), list):
                    names = [str(x) for x in raw_m["files"] if x]
            if stem not in names:
                names.append(stem)
                names = sorted(set(names))
                manifest_path.write_text(
                    json.dumps(names, indent=2) + "\n", encoding="utf-8"
                )
        except Exception as exc:
            sys.stderr.write("[asset-gen] manifest update failed: %s\n" % exc)
        rel_out = str(dest.relative_to(REPO_ROOT)).replace("\\", "/")
        bust = int(time.time() * 1000)
        self._json(200, {
            "ok": True,
            "path": rel_out,
            "url": f"{rel_out}?v={bust}",
            "spriteName": Path(rel_out).stem,
        })

    def _handle_generate(self, data: dict):
        refresh_comfy_globals()
        if not comfy_reachable():
            if _runtime.get("autoStartComfy", True):
                start_comfy()
            if not comfy_reachable():
                self._json(503, {
                    "ok": False,
                    "error": "ComfyUI not reachable. Use Settings → START COMFYUI (or npm run comfy)",
                })
                return
        if Image is None:
            # Try ComfyUI venv pillow by re-exec hint
            self._json(500, {
                "ok": False,
                "error": "Pillow missing. Prefer: "
                "/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/bin/python "
                "tools/asset-gen/bridge.py",
            })
            return

        prompt_text = str(data.get("prompt") or "")
        filename_prefix = str(data.get("filenamePrefix") or "ships/vf_flux")
        out_size = int(data.get("size") or 64)
        gen_size = int(data.get("genSize") or 512)
        seed = data.get("seed")
        seed = int(seed) if seed is not None else None
        steps = int(data.get("steps") or 4)
        colors = max(2, min(15, int(data.get("colors") or 15)))
        bg_hex = str(data.get("bgColor") or "#FF00FF").strip() or "#FF00FF"
        prepend_style = data.get("prependStyle")
        skip_style = prepend_style is False or prepend_style == 0 or prepend_style == "false"

        if skip_style:
            wf = load_api_workflow()
            gen_w = max(256, int(gen_size) if gen_size >= 256 else 512)
            gen_h = gen_w
            gen_w = (gen_w // 16) * 16
            gen_h = (gen_h // 16) * 16
            noise_seed = int(seed) if seed is not None else random.randint(0, 2**31 - 1)
            wf["74"]["inputs"]["text"] = prompt_text.strip() or style_prefix(colors, bg_hex)
            wf["66"]["inputs"]["width"] = gen_w
            wf["66"]["inputs"]["height"] = gen_h
            wf["62"]["inputs"]["width"] = gen_w
            wf["62"]["inputs"]["height"] = gen_h
            wf["62"]["inputs"]["steps"] = int(steps)
            wf["73"]["inputs"]["noise_seed"] = noise_seed
            wf["9"]["inputs"]["filename_prefix"] = filename_prefix or "ships/vf_flux"
            prompt, used_seed, gw, gh = wf, noise_seed, gen_w, gen_h
        else:
            prompt, used_seed, gw, gh = build_prompt(
                prompt_text, filename_prefix, gen_size, gen_size, seed, steps, colors, bg_hex
            )
        entry = queue_and_wait(prompt)
        raw = fetch_image_bytes(entry)
        png = process_image(raw, out_size, colors, bg_hex)

        STAGING_DIR.mkdir(parents=True, exist_ok=True)
        staging_id = str(uuid.uuid4())
        staging_path = STAGING_DIR / f"{staging_id}.png"
        staging_path.write_bytes(png)

        self._json(200, {
            "ok": True,
            "stagingId": staging_id,
            "seed": used_seed,
            "genWidth": gw,
            "genHeight": gh,
            "size": out_size,
            "previewDataUrl": png_to_data_url(png),
        })

    def _handle_accept(self, data: dict):
        staging_id = str(data.get("stagingId") or "")
        target_path = str(data.get("targetPath") or "")
        if not staging_id or not target_path:
            self._json(400, {"ok": False, "error": "stagingId and targetPath required"})
            return
        src = STAGING_DIR / f"{staging_id}.png"
        if not src.is_file():
            self._json(404, {"ok": False, "error": "staging image not found"})
            return
        dest = safe_repo_path(target_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        # Re-assert grayscale on accept (covers staging from older bridge builds)
        try:
            ensure_pil()
            img = Image.open(io.BytesIO(src.read_bytes()))
            img = force_grayscale(img.convert("RGBA"))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            dest.write_bytes(buf.getvalue())
        except Exception:
            dest.write_bytes(src.read_bytes())
        # Keep sprite-loader manifests in sync (avoids 404 probing)
        if dest.suffix.lower() == ".png":
            try:
                manifest_path = dest.parent / "manifest.json"
                stem = dest.stem
                names = []
                if manifest_path.is_file():
                    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
                    if isinstance(raw, list):
                        names = [str(x) for x in raw if x]
                    elif isinstance(raw, dict) and isinstance(raw.get("files"), list):
                        names = [str(x) for x in raw["files"] if x]
                if stem not in names:
                    names.append(stem)
                    names = sorted(set(names))
                    manifest_path.write_text(
                        json.dumps(names, indent=2) + "\n", encoding="utf-8"
                    )
            except Exception as exc:
                sys.stderr.write("[asset-gen] manifest update failed: %s\n" % exc)
        # cache-bust relative URL from repo root
        rel = str(dest.relative_to(REPO_ROOT)).replace("\\", "/")
        bust = int(time.time() * 1000)
        self._json(200, {
            "ok": True,
            "path": rel,
            "url": f"{rel}?v={bust}",
            "spriteName": Path(rel).stem,
        })


def main():
    # Prefer importing Pillow from ComfyUI venv if system lacks it
    global Image
    if Image is None:
        venv_site = Path(
            "/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/lib"
        )
        # Best-effort: re-run under comfy python
        comfy_py = Path(
            "/mnt/quicky2/stability-matrix/Data/Packages/ComfyUI/venv/bin/python"
        )
        if comfy_py.is_file() and Path(sys.executable).resolve() != comfy_py.resolve():
            os.execv(str(comfy_py), [str(comfy_py), __file__] + sys.argv[1:])

    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((BRIDGE_HOST, BRIDGE_PORT), Handler)
    print(f"Asset-Gen Bridge http://{BRIDGE_HOST}:{BRIDGE_PORT}")
    print(f"  ComfyUI: {comfy_base()}")
    print(f"  Workflow: {API_WORKFLOW}")
    print(f"  Pillow: {Image is not None}")
    print(f"  Comfy control: POST /api/comfy/start|stop  GET /api/comfy/status")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
