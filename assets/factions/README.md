# Fraktions-Pakete (`assets/factions/<volk>/`)

Alles, was zu einem Volk gehört, liegt in seinem Ordner. Dateien einfach hineinlegen und die Seite neu laden — der Dev-Server
(`npm start`) listet die Ordner selbst (`/__factions`). Auf anderem Hosting vorher `python3 tools/build-faction-manifests.py` ausführen.

| Datei | Wirkung |
|---|---|
| `portraits.png` | 4×4-Raster mit 16 Pilotenporträts (Zellen gleich groß, zeilenweise 1–16). Oder einzeln: `portraits/01.png` … `16.png`. Ohne Dateien zeigt das Spiel den Generator. |
| `ships/<klasse>.png` | Gegner-Schiff des Volkes: `scout`, `assault`, `heavy`, `elite`, `capital`. Segmente optional: `scout-front.png`, `-center`, `-back`, `-wingLeft`, `-wingRight`, `-wing`. Auch `player-<name>.png` / `enemy-<name>.png` überschreiben das gleichnamige Schiff. |
| `faction.json` → `style` | Schiffs-Style: `hull`, `edge`, `accent`, `engine` (Hex), `silhouette`, `anatomy` (`front/center/back/wing` je `x`,`y`), `wingVariants`, `defaultWeapons`, `prompt`, `styleStrength`. Nur angegebene Werte ersetzen die Standardwerte. |
| `faction.json` → `gui.vars` | CSS-Variablen, die nur bei diesem Volk gelten, z. B. `"--color-primary": "#ff8a40"`. `{pack}` steht für den Ordnerpfad: `"--hs-bg": "url({pack}/ui/station.png)"`. |
| `gui.css` | Zusätzliches CSS, mit `html[data-faction="<volk>"] …` begrenzen. |
| `ui/*` | Bilder für GUI-Styles (aus `faction.json` oder `gui.css` verlinkt). |

Beispiel `faction.json`:

```json
{
  "style": { "hull": "#3a6ea5", "accent": "#7ec8ff", "silhouette": "modular",
             "anatomy": { "front": { "x": 1, "y": 1.2 }, "wing": { "x": 1.3, "y": 0.9 } } },
  "gui": { "vars": { "--hs-bg-station": "url({pack}/ui/station.png)" } }
}
```
