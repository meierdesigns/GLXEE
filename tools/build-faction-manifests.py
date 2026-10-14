#!/usr/bin/env python3
"""Writes assets/factions/<faction>/manifest.json (list of every file in the folder) for hosts that are not tools/dev-server.py."""
import json
import os

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "factions")
for fac in sorted(os.listdir(root)):
    base = os.path.join(root, fac)
    if not os.path.isdir(base):
        continue
    files = sorted(os.path.relpath(os.path.join(d, f), base).replace(os.sep, "/") for d, _, fs in os.walk(base) for f in fs if f != "manifest.json")
    with open(os.path.join(base, "manifest.json"), "w") as fh:
        json.dump(files, fh, indent=1)
    print(fac, len(files), "files")
