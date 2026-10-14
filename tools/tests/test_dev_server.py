"""Cache behaviour of tools/dev-server.py. Run: python3 -m unittest discover -s tools/tests -v"""
import http.client
import importlib.util
import os
import re
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

SERVER_PATH = os.path.join(os.path.dirname(__file__), "..", "dev-server.py")


def load_server_module():
    spec = importlib.util.spec_from_file_location("dev_server", SERVER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class DevServerCacheTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_server_module()
        cls.tmp = tempfile.TemporaryDirectory()
        cls.old_cwd = os.getcwd()
        os.chdir(cls.tmp.name)
        cls.write("index.html", '<link rel="stylesheet" href="styles.css?v=old">'
                  '<script src="js/app.js?v=hand-1"></script>'
                  '<script src="https://cdn.example.com/lib.js"></script>'
                  '<script src="missing.js?v=1"></script>')
        cls.write("styles.css", "body{}")
        cls.write("js/app.js", "1")
        cls.write("img/ship.png", "PNG")
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), cls.mod.NoCacheHandler)
        cls.server.daemon_threads = True
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        os.chdir(cls.old_cwd)
        cls.tmp.cleanup()

    @classmethod
    def write(cls, rel, text, mtime=None):
        path = os.path.join(cls.tmp.name, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(text)
        if mtime:
            os.utime(path, (mtime, mtime))

    def get(self, path, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port)
        c.request("GET", path, headers=headers or {})
        r = c.getresponse()
        body = r.read().decode("utf-8", "replace")
        c.close()
        return r, body

    def test_index_is_never_stored(self):
        r, _ = self.get("/")
        self.assertEqual(r.getheader("Cache-Control"), "no-store")

    def test_index_stamps_local_assets_with_mtime(self):
        self.write("styles.css", "body{}", mtime=1700000000)
        self.write("js/app.js", "1", mtime=1700000500)
        _, html = self.get("/")
        self.assertIn('href="styles.css?v=1700000000"', html)
        self.assertIn('src="js/app.js?v=1700000500"', html)

    def test_external_and_missing_urls_are_untouched(self):
        _, html = self.get("/")
        self.assertIn('src="https://cdn.example.com/lib.js"', html)
        self.assertIn('src="missing.js?v=1"', html)

    def test_current_stamp_is_cached_for_good(self):
        _, html = self.get("/")
        url = re.search(r'href="(styles\.css\?v=\d+)"', html).group(1)
        r, _ = self.get("/" + url)
        self.assertEqual(r.getheader("Cache-Control"), "public, max-age=31536000, immutable")

    def test_edit_gives_a_new_url_and_the_old_one_revalidates(self):
        self.write("styles.css", "a{}", mtime=1700001000)
        _, html1 = self.get("/")
        url1 = re.search(r'href="(styles\.css\?v=\d+)"', html1).group(1)
        self.write("styles.css", "b{}", mtime=1700002000)
        _, html2 = self.get("/")
        url2 = re.search(r'href="(styles\.css\?v=\d+)"', html2).group(1)
        self.assertNotEqual(url1, url2)
        r_old, _ = self.get("/" + url1)
        self.assertEqual(r_old.getheader("Cache-Control"), "no-cache")   # stale stamp can never be served from cache
        r_new, body = self.get("/" + url2)
        self.assertEqual(body, "b{}")
        self.assertIn("immutable", r_new.getheader("Cache-Control"))

    def test_unstamped_and_hand_stamped_files_revalidate(self):
        for path in ("/img/ship.png", "/styles.css", "/styles.css?v=hand-1", "/js/app.js?v=1"):
            r, _ = self.get(path)
            self.assertEqual(r.getheader("Cache-Control"), "no-cache", path)

    def test_unchanged_asset_answers_304(self):
        r, _ = self.get("/img/ship.png")
        lm = r.getheader("Last-Modified")
        self.assertTrue(lm)
        r2, body = self.get("/img/ship.png", {"If-Modified-Since": lm})
        self.assertEqual(r2.status, 304)
        self.assertEqual(body, "")

    def test_changed_asset_is_resent(self):
        r, _ = self.get("/img/ship.png")
        lm = r.getheader("Last-Modified")
        self.write("img/ship.png", "NEW", mtime=os.path.getmtime("img/ship.png") + 100)
        r2, body = self.get("/img/ship.png", {"If-Modified-Since": lm})
        self.assertEqual(r2.status, 200)
        self.assertEqual(body, "NEW")

    def test_clear_site_data_only_once_per_boot(self):
        r, _ = self.get("/")
        self.assertEqual(r.getheader("Clear-Site-Data"), '"cache"')
        cookie = r.getheader("Set-Cookie").split(";")[0]
        r2, _ = self.get("/", {"Cookie": cookie})
        self.assertIsNone(r2.getheader("Clear-Site-Data"))


if __name__ == "__main__":
    unittest.main()
