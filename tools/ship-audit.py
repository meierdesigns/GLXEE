#!/usr/bin/env python3
"""Count tracked ship files and flag upload-risk / non-runtime clutter."""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = 800
HARD_CAP = 1000

# Paths that must never appear in the GitHub/itch download.
FORBIDDEN_PREFIXES = (
    ".claude/",
    "archive/",
    "tools/debug/",
    "js/ui/dev/",
    "node_modules/",
    "packages/",
    ".import/",
    "assets/levels/sprites/",
    "assets/ships/sprites/",
    "assets/weapons/sprites/",
    "assets/soundtracks/mod-templates/",
)


def tracked_files():
    out = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=ROOT
    )
    return [p.decode("utf-8", "replace") for p in out.split(b"\0") if p]


def main():
    files = tracked_files()
    n = len(files)
    print("tracked files: %d (target ~%d, hard cap %d)" % (n, TARGET, HARD_CAP))
    if n > HARD_CAP:
        print("FAIL: over GitHub download hard cap (%d)" % HARD_CAP)
        return 1
    if n > TARGET:
        print("WARN: above soft target (%d) — trim non-runtime before next upload" % TARGET)
    else:
        print("OK: within soft target")

    bad = [p for p in files if p.startswith(FORBIDDEN_PREFIXES)]
    if bad:
        print("FAIL: forbidden paths still tracked:")
        for p in bad[:40]:
            print("  ", p)
        return 1

    # Heaviest tracked blobs (approximate via working tree size).
    sizes = []
    for p in files:
        fp = os.path.join(ROOT, p)
        try:
            sizes.append((os.path.getsize(fp), p))
        except OSError:
            pass
    sizes.sort(reverse=True)
    print("\nheaviest tracked (top 15):")
    for s, p in sizes[:15]:
        print("  %6.1f KB  %s" % (s / 1024.0, p))

    bundles = [
        ("js/bundles/deferred.js", "core+combat+station"),
        ("js/bundles/deferred-editors.js", "dev editors (lazy)"),
    ]
    print("\nbundles:")
    for rel, label in bundles:
        fp = os.path.join(ROOT, rel)
        if os.path.isfile(fp):
            print("  %6.1f KB  %s (%s)" % (os.path.getsize(fp) / 1024.0, rel, label))
        else:
            print("  (missing) %s" % rel)
    return 0


if __name__ == "__main__":
    sys.exit(main())
