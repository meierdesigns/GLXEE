#!/usr/bin/env python3
"""Static dev server that keeps files cached but revalidates each request (304 when unchanged), so F5 is fast and edits still show."""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    # HTTP/1.1 keep-alive: the page pulls ~450 files; HTTP/1.0 would open a new
    # TCP connection for every one of them.
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        # Per-request stderr logging costs noticeable time over 450 requests.
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    server = ThreadingHTTPServer(("", port), NoCacheHandler)
    server.daemon_threads = True
    server.serve_forever()
