#!/usr/bin/env python3
"""Build ordered deferred-script bundles (boot + feature chunks + lazy editors)."""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
ORDER_FILE = os.path.join(ROOT, "js", "bundles", "script-order.json")

OUTPUT_BOOT = os.path.join(ROOT, "js", "bundles", "deferred-boot.js")
OUTPUT_STATION = os.path.join(ROOT, "js", "bundles", "deferred-station.js")
OUTPUT_GALAXY = os.path.join(ROOT, "js", "bundles", "deferred-galaxy.js")
OUTPUT_PROFILES = os.path.join(ROOT, "js", "bundles", "deferred-profiles.js")
OUTPUT_COMBAT = os.path.join(ROOT, "js", "bundles", "deferred-combat.js")
OUTPUT_EDITORS = os.path.join(ROOT, "js", "bundles", "deferred-editors.js")
# Compat alias: itch / older index may still request deferred.js → same as boot.
OUTPUT_LEGACY = os.path.join(ROOT, "js", "bundles", "deferred.js")

EDITOR_PREFIXES = (
    "js/graphics/asset-gen-",
    "js/ui/asset-gen-ui",
    "js/ui/planet-editor",
    "js/ui/component-editor",
    "js/ui/ship-editor",
    "js/ui/enemy-editor",
    "js/ui/theme-editor",
    "js/ui/hangar-test-arena",
    "js/ui/weapon-viewer",
    "js/ui/ship-viewer",
    "js/ui/enemy-viewer",
    "js/ui/faction-viewer",
    "js/ui/energy-viewer",
    "js/ui/defense-viewer",
    "js/ui/ability-viewer",
    "js/ui/explosion-viewer",
    "js/ui/enhanced-palette-ui",
    "js/ui/hud-layout-editor",
    "js/ui/soundtrack-editor.js",
)

STATION_PREFIXES = (
    "js/ui/home-station/",
    "js/ui/home-station.js",
    "js/ui/in-stage-shop/",
    # Portraits: station crest / hangar faces (profiles also ensure station or portraits via ensureVfProfiles→prefetch)
    "js/graphics/hero-portrait.js",
    "js/graphics/voxel-portrait-presets.js",
    "js/graphics/voxel-portrait-build.js",
    "js/graphics/voxel-portrait-bg.js",
    "js/graphics/voxel-portrait.js",
)

GALAXY_PREFIXES = (
    "js/ui/galaxy-map/",
    "js/ui/galaxy-map.js",
    "js/ui/galaxy-viewer.js",
    "js/ui/galaxy-viewer-part2.js",
)

PROFILES_PREFIXES = (
    "js/ui/profile-selection/",
    "js/ui/profile-selection.js",
    "js/ui/combined-selection/",
    "js/ui/combined-selection.js",
)

COMBAT_PREFIXES = (
    "js/game/enemies/",
    "js/game/enemies.js",
    "js/game/obstacles/",
    "js/game/obstacles.js",
    "js/game/bullets/",
    "js/game/bullets.js",
    "js/game/player/",
    "js/game/player.js",
    "js/game/collisions/",
    "js/game/collisions.js",
    "js/game/tracker/",
    "js/game/charge-system.js",
    "js/game/pickups.js",
    "js/game/power-crates.js",
    # planet-svgs stay in BOOT: start-screen station-backdrop spins them before combat loads
    "js/core/objective-manager.js",
    "js/core/game-control-system/show-victory-overlay.js",
    "js/ui/level-info-manager/",
    "js/ui/level-info-manager.js",
    "js/ui/render/",
    "js/ui/render.js",
)

# Replaced by feature-loaders.js (defines ensureVfEditors too).
SKIP_PATHS = {
    "js/core/editors-loader.js",
}

CORE_INJECT = (
    "js/core/vf-storage.js",
    "js/core/station-anim.js",
    "js/core/feature-loaders.js",
)

TOP_DECL = re.compile(r"^(?:const|let) (\w+) =", re.M)
TOP_CLASS = re.compile(r"^class (\w+)((?: extends [^{\n]+)?) \{", re.M)
MARKER_RE = re.compile(r"/\* --- ([^*]+?) --- \*/")


def hoist(text):
    return TOP_CLASS.sub(r"var \1 = class \1\2 {", TOP_DECL.sub(r"var \1 =", text))


def norm(path):
    return path.split("?", 1)[0]


def matches_prefixes(path, prefixes):
    p = norm(path)
    for pref in prefixes:
        if pref.endswith(".js"):
            if p == pref:
                return True
        elif p.startswith(pref):
            return True
    return False


def feature_of(path):
    p = norm(path)
    if p in SKIP_PATHS or "js/bundles/deferred" in p:
        return "skip"
    if matches_prefixes(p, EDITOR_PREFIXES):
        return "editors"
    if matches_prefixes(p, STATION_PREFIXES):
        return "station"
    if matches_prefixes(p, GALAXY_PREFIXES):
        return "galaxy"
    if matches_prefixes(p, PROFILES_PREFIXES):
        return "profiles"
    if matches_prefixes(p, COMBAT_PREFIXES):
        return "combat"
    return "boot"


def markers_from(file_path):
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as handle:
        return [
            p for p in MARKER_RE.findall(handle.read())
            if "js/bundles/deferred" not in norm(p)
        ]


def load_paths(html):
    index_paths = re.findall(r'<script\s+defer\s+src="([^"]+)"></script>', html)
    index_has_bundle = any(
        "js/bundles/deferred" in norm(p) for p in index_paths
    )

    if os.path.exists(ORDER_FILE):
        with open(ORDER_FILE, "r", encoding="utf-8") as handle:
            ordered = json.load(handle)
        if isinstance(ordered, list) and ordered:
            return [p for p in ordered if "js/bundles/deferred" not in norm(p)]

    marker_sources = [
        OUTPUT_LEGACY,
        OUTPUT_BOOT,
        OUTPUT_STATION,
        OUTPUT_GALAXY,
        OUTPUT_PROFILES,
        OUTPUT_COMBAT,
        OUTPUT_EDITORS,
    ]
    if index_has_bundle:
        marker_paths = []
        for src in marker_sources:
            marker_paths.extend(markers_from(src))
        seen = set()
        merged = []
        for p in marker_paths:
            k = norm(p)
            if k in seen:
                continue
            seen.add(k)
            merged.append(p)
        extra = [
            p for p in index_paths
            if "js/bundles/deferred" not in norm(p) and norm(p) not in seen
        ]
        return merged + extra

    return [p for p in index_paths if "js/bundles/deferred" not in norm(p)]


def inject_core_helpers(paths):
    filtered = [p for p in paths if norm(p) not in SKIP_PATHS]
    have = {norm(p) for p in filtered}
    missing = [p for p in CORE_INJECT if p not in have]
    if not missing:
        return filtered
    insert_at = 0
    for i, p in enumerate(filtered):
        n = norm(p)
        if n.endswith("extend-class.js") or n.endswith("extend-class-module.js"):
            insert_at = i + 1
            break
        if insert_at == 0 and n.startswith("js/core/"):
            insert_at = i + 1
    out = list(filtered)
    for offset, p in enumerate(missing):
        out.insert(insert_at + offset, p)
    return out


def write_bundle(file_path, paths, label):
    chunks = [
        "/* Generated by tools/build-deferred-bundle.py (%s). Do not edit. */\n" % label
    ]
    for path in paths:
        local = os.path.join(ROOT, norm(path))
        if not os.path.isfile(local):
            print("WARN: missing %s" % path, file=sys.stderr)
            continue
        with open(local, "r", encoding="utf-8") as handle:
            chunks.append("\n/* --- %s --- */\n%s\n" % (path, hoist(handle.read())))
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as handle:
        handle.write("".join(chunks))
    return sum(os.path.getsize(os.path.join(ROOT, norm(p))) for p in paths if os.path.isfile(os.path.join(ROOT, norm(p))))


def main():
    with open(INDEX, "r", encoding="utf-8") as handle:
        html = handle.read()

    paths = inject_core_helpers(load_paths(html))
    buckets = {k: [] for k in ("boot", "station", "galaxy", "profiles", "combat", "editors")}
    for p in paths:
        feat = feature_of(p)
        if feat == "skip":
            continue
        buckets[feat].append(p)

    with open(ORDER_FILE, "w", encoding="utf-8") as handle:
        json.dump(paths, handle, indent=2)
        handle.write("\n")

    sizes = {}
    sizes["boot"] = write_bundle(OUTPUT_BOOT, buckets["boot"], "boot")
    sizes["station"] = write_bundle(OUTPUT_STATION, buckets["station"], "station")
    sizes["galaxy"] = write_bundle(OUTPUT_GALAXY, buckets["galaxy"], "galaxy")
    sizes["profiles"] = write_bundle(OUTPUT_PROFILES, buckets["profiles"], "profiles")
    sizes["combat"] = write_bundle(OUTPUT_COMBAT, buckets["combat"], "combat")
    sizes["editors"] = write_bundle(OUTPUT_EDITORS, buckets["editors"], "editors")
    # Legacy alias = boot (downloaders / old bookmarks)
    write_bundle(OUTPUT_LEGACY, buckets["boot"], "boot-legacy-alias")

    if "--update-index" in sys.argv:
        bundled = re.sub(r'<script\s+defer\s+src="[^"]+"></script>\s*', "", html)
        bundled = bundled.replace(
            "</body>",
            '<script defer src="js/bundles/deferred-boot.js"></script>\n</body>',
            1,
        )
        with open(INDEX, "w", encoding="utf-8") as handle:
            handle.write(bundled)

    print("Built feature bundles:")
    for name in ("boot", "station", "galaxy", "profiles", "combat", "editors"):
        print(
            "  %-9s %4d files  %7.1f KB"
            % (name, len(buckets[name]), sizes[name] / 1024.0)
        )


if __name__ == "__main__":
    main()
