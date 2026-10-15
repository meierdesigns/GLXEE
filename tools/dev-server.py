#!/usr/bin/env python3
"""Static dev server: stamped JS/CSS cache forever, everything else revalidates,
gzip for text, and a one-shot cache wipe per server start so stale immutable
entries never outlive a restart."""
import gzip
import hashlib
import io
import json
import os
import re
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


BOOT_ID = str(time.time_ns() // 1000000)
VFBOOT = "vfboot"  # cookie name; set per port in __main__

# Compressible MIME types (binary formats stay untouched).
COMPRESSIBLE = {
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/json",
    "image/svg+xml",
    "text/plain",
    "application/xml",
    "text/xml",
}
_gzip_cache = {}
# Bundles of consecutive classic `defer` scripts (see bundle_defer_runs): name -> ordered file list, and built text per mtime.
_bundles = {}
_bundle_cache = {}


def file_stamp(path):
    """Cache-busting stamp of a file: mtime in milliseconds (whole seconds let two quick edits share one URL)."""
    return os.stat(path).st_mtime_ns // 1000000
def rebuild_stale_bundle(root):
    """index.html loads the prebuilt js/bundles/deferred.js: when a source file in it is newer, rebuild it,
    otherwise edits silently keep running the old code."""
    out = os.path.join(root, "js", "bundles", "deferred.js")
    try:
        bundle_mt = os.stat(out).st_mtime_ns
        with open(out, "r", encoding="utf-8") as f:
            files = re.findall(r"/\* --- ([^*]+?) --- \*/", f.read())
        stale = any(os.stat(os.path.join(root, p.split("?", 1)[0])).st_mtime_ns > bundle_mt for p in files)
    except OSError:
        return
    if stale:
        import subprocess
        subprocess.run([sys.executable, os.path.join(root, "tools", "build-deferred-bundle.py")], cwd=root, check=False)
        print("deferred.js was stale: rebuilt", flush=True)


DEFER_TAG = re.compile(r'<script\s+defer\s+src="([^"]+)"></script>')
_gzip_cache_lock = threading.Lock()


class NoCacheHandler(SimpleHTTPRequestHandler):
    # HTTP/1.1 keep-alive: the page pulls ~450 files; HTTP/1.0 would open a new
    # TCP connection for every one of them.
    protocol_version = "HTTP/1.1"
    # Headers and body leave in separate writes; with Nagle on, every keep-alive response waits for the
    # client's delayed ACK (~40 ms). Over 500 files on 6 connections that alone is ~3.5 s of idle loading.
    disable_nagle_algorithm = True

    def log_message(self, format, *args):
        # Per-request stderr logging costs noticeable time over 450 requests; only page loads are noted
        # (tools/.dev-server-pages.log) so it is visible which browser/host actually loads the game.
        if self.path.partition("?")[0] in ("/", "/index.html"):
            try:
                with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".dev-server-pages.log"), "a") as f:
                    f.write("%s %s host=%s ua=%s\n" % (time.strftime("%H:%M:%S"), self.path, self.headers.get("Host"), (self.headers.get("User-Agent") or "")[:90]))
            except OSError:
                pass

    def do_HEAD(self):
        # Mirror GET for stamped index / APIs so probes and some browsers see real headers.
        self._respond(write_body=False)

    def do_GET(self):
        self._respond(write_body=True)

    def _respond(self, write_body=True):
        path = self.path.split("?")[0]
        # Explicit cache wipe for browsers that ignore Clear-Site-Data (Safari / some embedded).
        if path == "/__cache-clear":
            body = b'{"ok":true,"boot":"' + BOOT_ID.encode() + b'"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Clear-Site-Data", '"cache"')
            self.send_header("Set-Cookie", VFBOOT + "=" + BOOT_ID + "; Path=/; SameSite=Lax")
            self.end_headers()
            if write_body:
                self.wfile.write(body)
            return
        if path == "/__boot":
            body = ('{"boot":"%s"}' % BOOT_ID).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if write_body:
                self.wfile.write(body)
            return
        # Drop-in faction packs: lists the files under assets/factions/<faction>/ so no manifest has to be kept by hand.
        # A faction's manifest.json is answered live too, so files dropped into the folder show up without regenerating it.
        parts = path.strip("/").split("/")
        if len(parts) == 4 and parts[:2] == ["assets", "factions"] and parts[3] == "manifest.json" and ".." not in parts[2]:
            base = os.path.join(os.getcwd(), "assets", "factions", parts[2])
            if os.path.isdir(base):
                body = json.dumps(sorted(os.path.relpath(os.path.join(d, f), base).replace(os.sep, "/") for d, _, fs in os.walk(base) for f in fs if f != "manifest.json")).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if write_body:
                    self.wfile.write(body)
                return
        if path == "/__factions":
            root, out = os.path.join(os.getcwd(), "assets", "factions"), {}
            if os.path.isdir(root):
                for fac in sorted(os.listdir(root)):
                    base = os.path.join(root, fac)
                    if not os.path.isdir(base):
                        continue
                    out[fac] = sorted(os.path.relpath(os.path.join(d, f), base).replace(os.sep, "/") for d, _, fs in os.walk(base) for f in fs)
            body = json.dumps(out).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if write_body:
                self.wfile.write(body)
            return
        if path.startswith("/__bundle/") and path.endswith(".js"):
            if self.send_bundle(path[len("/__bundle/"):-3], write_body):
                return
        if path == "/__deferred-bundle.js":
            body = self.build_deferred_bundle()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if write_body:
                self.wfile.write(body)
            return
        if path in ("/", "/index.html"):
            if self.send_stamped_index(write_body=write_body):
                return
        # gzip-capable static files: compress text types when the client accepts it.
        if self.serve_maybe_gzip(write_body=write_body):
            return
        if write_body:
            super().do_GET()
        else:
            super().do_HEAD()

    def wants_gzip(self):
        ae = (self.headers.get("Accept-Encoding") or "").lower()
        return "gzip" in ae

    def serve_maybe_gzip(self, write_body=True):
        """Serve a local file with gzip when compressible and accepted; return True if handled."""
        if not self.wants_gzip():
            return False
        path = self.path.split("?")[0]
        # Only real files under cwd; skip directories / APIs.
        local = self.translate_path(path)
        if not os.path.isfile(local):
            return False
        ctype = self.guess_type(local)
        base = ctype.split(";", 1)[0].strip().lower()
        if base not in COMPRESSIBLE:
            return False
        try:
            stat = os.stat(local)
            cache_key = (local, stat.st_mtime_ns, stat.st_size)
        except OSError:
            return False
        with _gzip_cache_lock:
            cached = _gzip_cache.get(cache_key)
        if cached is not None:
            body, mtime, etag = cached
            if self.headers.get("If-None-Match") == etag:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.end_headers()
                return True
        else:
            try:
                with open(local, "rb") as f:
                    raw = f.read()
            except OSError:
                return False
            mtime = int(stat.st_mtime)
            etag = '"%x-%x"' % (mtime, stat.st_size)
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=5, mtime=0) as gz:
                gz.write(raw)
            body = buf.getvalue()
            with _gzip_cache_lock:
                _gzip_cache[cache_key] = (body, mtime, etag)
                if len(_gzip_cache) > 1024:
                    _gzip_cache.pop(next(iter(_gzip_cache)))
        # Skip tiny payloads (header overhead not worth it).
        if stat.st_size < 512:
            return False
        # Conditional GET: If-Modified-Since / ETag via mtime size.
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.end_headers()
            return True
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("ETag", etag)
        self.send_header("Last-Modified", self.date_time_string(mtime))
        self.end_headers()
        if write_body:
            self.wfile.write(body)
        return True

    def send_stamped_index(self, write_body=True):
        # Every local script/stylesheet/font URL in index.html gets ?v=<file mtime>, so an edited file has a
        # new URL and no cache (VS Code's embedded browser included) can serve the old copy.
        root = os.getcwd()
        try:
            with open(os.path.join(root, "index.html"), "rb") as f:
                html = f.read().decode("utf-8")
        except OSError:
            return False

        rebuild_stale_bundle(root)
        if "nobundle" not in self.path:
            html = self.bundle_defer_runs(root, html)

        def stamp(m):
            path = m.group(2)
            try:
                mt = file_stamp(os.path.join(root, path))
            except OSError:
                return m.group(0)
            return '%s="%s?v=%d"' % (m.group(1), path, mt)

        html = re.sub(
            r'\b(src|href)="((?!https?:|//|data:)[^"?#]+\.(?:js|css|ttf|woff2?|otf))(?:\?[^"]*)?"',
            stamp,
            html,
        )
        # The application keeps the legacy script order, but the deferred
        # scripts do not need to be separate network requests. Serve them as
        # one ordered bundle to avoid hundreds of browser/server round trips.
        # Stable boot id for cold/refresh detection and client-side cache wipe fallbacks.
        if 'name="vf-boot"' not in html:
            html = html.replace(
                "<head>",
                '<head>\n    <meta name="vf-boot" content="%s">' % BOOT_ID,
                1,
            )
        else:
            html = re.sub(
                r'<meta name="vf-boot" content="[^"]*">',
                '<meta name="vf-boot" content="%s">' % BOOT_ID,
                html,
                count=1,
            )
        raw = html.encode("utf-8")
        use_gzip = self.wants_gzip() and len(raw) >= 512
        if use_gzip:
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=5, mtime=0) as gz:
                gz.write(raw)
            body = buf.getvalue()
        else:
            body = raw
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        if use_gzip:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if write_body:
            self.wfile.write(body)
        return True

    @staticmethod
    def _is_strict(root, path):
        try:
            with open(os.path.join(root, path.split("?", 1)[0]), "r", encoding="utf-8") as f:
                head = f.read(200).lstrip()
        except OSError:
            return False
        return head.startswith('"use strict"') or head.startswith("'use strict'")

    def bundle_defer_runs(self, root, html):
        """One request per run of consecutive classic defer scripts instead of one per file (hundreds of round
        trips are what makes embedded browsers slow). Runs are split where order against modules / inline scripts
        matters, and at the rare non-strict file so no file changes strictness. Add ?nobundle to the URL to debug."""
        out, pos, run = [], 0, []

        def flush():
            files = [p for _, _, p in run]
            if len(files) > 1:
                mt = 0
                for f in files:
                    try:
                        mt = max(mt, file_stamp(os.path.join(root, f.split("?", 1)[0])))
                    except OSError:
                        pass
                name = "b%d-%s" % (len(files), hashlib.sha1("|".join(files).encode()).hexdigest()[:10])
                _bundles[name] = [f.split("?", 1)[0] for f in files]
                out.append('<script defer src="/__bundle/%s.js?v=%d"></script>' % (name, mt))
            else:
                out.extend('<script defer src="%s"></script>' % f for f in files)
            run.clear()

        for m in DEFER_TAG.finditer(html):
            gap = html[pos:m.start()]
            strict = self._is_strict(root, m.group(1))
            if run and (gap.strip() or not strict):
                flush()
            if not run and not strict:
                out.append(gap + m.group(0))
                pos = m.end()
                continue
            out.append(gap) if not run else None
            run.append((m.start(), m.end(), m.group(1)))
            pos = m.end()
        flush()
        out.append(html[pos:])
        return "".join(out)

    def send_bundle(self, name, write_body):
        files = _bundles.get(name)
        if not files:
            return False
        root = os.getcwd()
        try:
            key = tuple(file_stamp(os.path.join(root, f)) for f in files)
        except OSError:
            return False
        cached = _bundle_cache.get(name)
        if not cached or cached[0] != key:
            # Each file still runs as its own classic <script> (own top-level lexical timing and strictness): a file
            # is only text inside the bundle, injected in order. Plain concatenation would put every later const
            # into the temporal dead zone, so `typeof someManager` guards in earlier files would throw.
            srcs = []
            for f in files:
                with open(os.path.join(root, f), "r", encoding="utf-8") as fh:
                    srcs.append(fh.read() + "\n//# sourceURL=" + f)
            raw = ("/* Generated by tools/dev-server.py: %d scripts. */\n(function(S){var h=document.head;"
                   "for(var i=0;i<S.length;i++){var e=document.createElement('script');e.text=S[i];h.appendChild(e);h.removeChild(e);}"
                   "})(%s);\n" % (len(files), json.dumps(srcs, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))).encode("utf-8")
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=6, mtime=0) as gz:
                gz.write(raw)
            cached = (key, raw, buf.getvalue())
            _bundle_cache[name] = cached
        gz_ok = self.wants_gzip()
        body = cached[2] if gz_ok else cached[1]
        self.send_response(200)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.send_header("Vary", "Accept-Encoding")
        if gz_ok:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if write_body:
            self.wfile.write(body)
        return True

    def build_deferred_bundle(self):
        root = os.getcwd()
        try:
            with open(os.path.join(root, "index.html"), "r", encoding="utf-8") as f:
                html = f.read()
        except OSError:
            return b""
        paths = re.findall(r'<script\s+defer\s+src="([^"]+)"></script>', html)
        chunks = []
        for path in paths:
            local = os.path.join(root, path.split("?", 1)[0])
            try:
                with open(local, "r", encoding="utf-8") as f:
                    chunks.append("\n/* --- %s --- */\n%s\n" % (path, f.read()))
            except OSError:
                continue
        return "".join(chunks).encode("utf-8")

    def stamp_matches(self, path, query):
        m = re.fullmatch(r"v=(\d+)", query)
        if not m:
            return False
        try:
            return file_stamp(os.path.join(os.getcwd(), path.lstrip("/"))) == int(m.group(1))
        except OSError:
            return False

    def end_headers(self):
        # A URL stamped ?v=<mtime> (set by send_stamped_index) can only ever name one file version, so it is
        # cached for good and an edit simply produces a new URL. Everything else (index.html, runtime-loaded
        # files, graphics, fonts, audio) is stored but revalidated on every load (Last-Modified -> 304),
        # so unchanged files cost no transfer and edited ones show up. index.html itself is never stored.
        path, _, query = self.path.partition("?")
        if path.startswith("/__bundle/"):
            pass  # send_bundle set its own (immutable) headers
        elif path in ("/", "/index.html", "/__boot", "/__cache-clear"):
            self.send_header("Cache-Control", "no-store")
        elif self.stamp_matches(path, query):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif path.endswith((".ttf", ".woff", ".woff2", ".otf")):
            # Fonts change rarely; short revalidation keeps F5 cheap across browsers.
            self.send_header("Cache-Control", "public, max-age=86400, must-revalidate")
        elif path.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico")):
            self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        else:
            # no-cache = store + always revalidate (304 when unchanged). Cross-browser safe.
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        # Once per server start, the page load wipes everything the browser still holds from older
        # (immutable) responses, so a stale cache can never outlive a restart.
        # Clear-Site-Data is honored by Chromium; other browsers fall back to stamped URLs + /__cache-clear.
        if path in ("/", "/index.html") and (VFBOOT + "=" + BOOT_ID) not in self.headers.get("Cookie", ""):
            self.send_header("Clear-Site-Data", '"cache"')
            self.send_header("Set-Cookie", VFBOOT + "=" + BOOT_ID + "; Path=/; SameSite=Lax")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    VFBOOT = "vfboot" + str(port)
    server = ThreadingHTTPServer(("", port), NoCacheHandler)
    server.daemon_threads = True
    print("GLXEE dev server on http://127.0.0.1:%d  boot=%s  (gzip + stamped cache)" % (port, BOOT_ID), flush=True)
    server.serve_forever()
