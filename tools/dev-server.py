#!/usr/bin/env python3
"""Static dev server that keeps files cached but revalidates each request (304 when unchanged), so F5 is fast and edits still show."""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
