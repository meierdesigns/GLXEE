"use strict";

/**
 * CursedElementInspect — shared DOM pipette, CSS/tag dump, prompt, screenshot.
 * Used by Asset Store audit and Cursed Fly-in Card.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CursedElementInspect = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "1.2.1";
  const MODULE_TAGS = {
    section: 28,
    article: 30,
    aside: 26,
    nav: 24,
    main: 22,
    form: 26,
    dialog: 32,
    fieldset: 20,
    header: 18,
    footer: 16,
    table: 18,
    ul: 10,
    ol: 10,
    menu: 16,
  };
  const MODULE_ATTRS = [
    "data-module",
    "data-component",
    "data-feature",
    "data-widget",
    "data-view",
    "data-panel",
    "data-block",
    "data-tile",
    "data-section",
    "data-page",
    "data-cursed-module",
    "data-pkg",
    "data-package",
  ];
  const MODULE_TOKEN_RE =
    /(^|[-_.\s])(module|modul|component|komponente|widget|panel|section|feature|view|screen|block|tile|card|sidebar|toolbar|modal|dialog|drawer|nav|header|footer|content|layout|wrapper|container|app|page|tab|menu|list|table|form|chart|graph|editor|preview|inspector|flyin|bridge|store|dashboard|detail|settings|config)(s?|[-_.]|$)/i;
  const GENERIC_CLASS_RE =
    /^(active|open|closed|hidden|visible|selected|disabled|enabled|is-|has-|js-|css-|u-|l-|c-|col-|row-|grid-|flex-|btn|button|icon|text|label|title|link|item|inner|outer|wrap|wrapper|container|box|el|node)$/i;
  const CSS_PROPS = [
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "box-sizing",
    "width",
    "height",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "margin",
    "padding",
    "border",
    "border-radius",
    "overflow",
    "overflow-x",
    "overflow-y",
    "flex",
    "flex-direction",
    "flex-wrap",
    "align-items",
    "justify-content",
    "gap",
    "grid-template-columns",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "color",
    "background",
    "background-color",
    "opacity",
    "visibility",
    "pointer-events",
    "box-shadow",
    "transform",
    "transition",
    "text-align",
    "white-space",
  ];

  function cssEscape(id) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(id);
    return String(id).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  function cssPathFor(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return "#" + cssEscape(el.id);
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift("#" + cssEscape(cur.id));
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const same = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === cur.tagName;
        });
        if (same.length > 1) {
          part += ":nth-of-type(" + (same.indexOf(cur) + 1) + ")";
        }
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(" > ");
  }

  function elementLabel(el, short) {
    if (!el || el.nodeType !== 1) return "";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? "#" + el.id : "";
    const cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    if (short) return (id || tag + cls) || tag;
    return tag + id + cls;
  }

  function elementPath(el) {
    const parts = [];
    let cur = el;
    let i = 0;
    while (cur && cur.nodeType === 1 && cur !== document.body && i < 6) {
      parts.unshift(elementLabel(cur, false));
      cur = cur.parentElement;
      i += 1;
    }
    return parts.join(" › ");
  }

  function dumpComputed(el) {
    if (!el || el.nodeType !== 1) return null;
    const r = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const rules = {};
    CSS_PROPS.forEach(function (p) {
      rules[p] = cs.getPropertyValue(p);
    });
    return {
      path: cssPathFor(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: typeof el.className === "string" ? el.className : null,
      box: {
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.left),
        y: Math.round(r.top),
      },
      display: cs.display,
      position: cs.position,
      zIndex: cs.zIndex,
      overflow: cs.overflow + "/" + cs.overflowX + "/" + cs.overflowY,
      margin: cs.marginTop + " " + cs.marginRight + " " + cs.marginBottom + " " + cs.marginLeft,
      padding: cs.paddingTop + " " + cs.paddingRight + " " + cs.paddingBottom + " " + cs.paddingLeft,
      font: cs.fontSize + "/" + cs.lineHeight + " " + cs.fontFamily,
      color: cs.color,
      background: cs.backgroundColor,
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      visibility: cs.visibility,
      rules: rules,
    };
  }

  function dumpComputedCss(el) {
    const dump = dumpComputed(el);
    if (!dump) return "";
    const sel = dump.path || dump.tag;
    const lines = [sel + " {"];
    Object.keys(dump.rules || {}).forEach(function (p) {
      const v = dump.rules[p];
      if (v) lines.push("  " + p + ": " + v + ";");
    });
    lines.push("}");
    return lines.join("\n");
  }

  function tagSummary(el) {
    if (!el || el.nodeType !== 1) return null;
    const counts = {};
    function walk(node) {
      if (!node || node.nodeType !== 1) return;
      const t = node.tagName.toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
      for (let i = 0; i < node.children.length; i++) walk(node.children[i]);
    }
    walk(el);
    const text = String(el.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    return {
      root: el.tagName.toLowerCase(),
      id: el.id || "",
      className: typeof el.className === "string" ? el.className : "",
      childCount: el.children.length,
      descendantCount: Object.keys(counts).reduce(function (n, k) {
        return n + counts[k];
      }, 0),
      tags: counts,
      text: text,
      outerHtml: String(el.outerHTML || "").slice(0, 8000),
    };
  }

  function classListOf(el) {
    if (!el) return [];
    if (el.classList && el.classList.length) {
      return Array.prototype.slice.call(el.classList);
    }
    if (typeof el.className === "string") {
      return el.className.trim().split(/\s+/).filter(Boolean);
    }
    return [];
  }

  function attrSignals(el) {
    const hits = [];
    if (!el || !el.getAttribute) return hits;
    MODULE_ATTRS.forEach(function (name) {
      const v = el.getAttribute(name);
      if (v != null && String(v).trim() !== "") hits.push({ attr: name, value: String(v).trim() });
    });
    const role = el.getAttribute("role");
    if (role && /^(main|navigation|complementary|banner|contentinfo|region|dialog|form|tabpanel|search)$/i.test(role)) {
      hits.push({ attr: "role", value: role });
    }
    return hits;
  }

  function tokenScore(token) {
    const t = String(token || "").trim();
    if (!t || t.length < 2) return 0;
    if (GENERIC_CLASS_RE.test(t)) return 0;
    if (MODULE_TOKEN_RE.test(t)) return 18;
    if (/^[a-z][a-z0-9]*(-[a-z0-9]+){1,4}$/i.test(t) && t.length >= 4) return 8;
    if (/^[A-Z][a-zA-Z0-9]+$/.test(t)) return 10;
    return 0;
  }

  function suggestName(el) {
    if (!el || el.nodeType !== 1) return "selection";
    const attrs = attrSignals(el);
    for (let i = 0; i < attrs.length; i++) {
      if (attrs[i].attr !== "role" && attrs[i].value) {
        return attrs[i].value.replace(/[_\s]+/g, "-").slice(0, 48);
      }
    }
    if (el.id) return String(el.id).replace(/[_\s]+/g, "-").slice(0, 48);
    const classes = classListOf(el);
    let best = "";
    let bestScore = 0;
    classes.forEach(function (c) {
      const s = tokenScore(c);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    });
    if (best) return best.replace(/[_\s]+/g, "-").slice(0, 48);
    const aria = el.getAttribute("aria-label") || el.getAttribute("title") || "";
    if (aria.trim()) {
      return aria
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || el.tagName.toLowerCase();
    }
    return el.tagName.toLowerCase();
  }

  function suggestKind(el, scoreInfo) {
    if (!el) return "module";
    const tag = el.tagName.toLowerCase();
    const cls = classListOf(el).join(" ").toLowerCase();
    const styleHint = /(style|theme|skin|look|css|color|palette)/i.test(cls + " " + (el.id || ""));
    if (styleHint && (!scoreInfo || scoreInfo.interactive < 2)) return "style";
    if (tag === "form" || /feature|wizard|flow|screen|page|view/i.test(cls + " " + (el.id || ""))) {
      return "feature";
    }
    if ((scoreInfo && scoreInfo.interactive >= 3) || tag === "dialog" || /modal|drawer|panel/i.test(cls)) {
      return "feature";
    }
    return "module";
  }

  function scoreModuleCandidate(el, selected) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName.toLowerCase();
    if (tag === "html" || tag === "body" || tag === "script" || tag === "style" || tag === "link") {
      return null;
    }
    if (el.id === "cursedInspectHighlight" || (el.closest && el.closest("#cursedFlyinRoot, .cursed-flyin"))) {
      return null;
    }

    let score = 0;
    const reasons = [];
    const attrs = attrSignals(el);
    if (attrs.length) {
      score += 40 + Math.min(20, attrs.length * 6);
      reasons.push("data/role");
    }
    if (MODULE_TAGS[tag]) {
      score += MODULE_TAGS[tag];
      reasons.push("tag:" + tag);
    }
    if (el.id) {
      score += 12 + Math.min(12, tokenScore(el.id));
      reasons.push("id");
    }
    const classes = classListOf(el);
    let classHits = 0;
    classes.forEach(function (c) {
      const s = tokenScore(c);
      if (s) {
        classHits += 1;
        score += s;
      }
    });
    if (classHits) reasons.push("class×" + classHits);

    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    const vp = Math.max(1, vw * vh);
    const ratio = area / vp;
    if (area > 0 && area < 1600) score -= 35;
    else if (ratio > 0.02 && ratio < 0.75) {
      score += 12;
      reasons.push("size");
    } else if (ratio >= 0.75) score -= 25;
    else if (ratio > 0 && ratio <= 0.02) score -= 10;

    const kids = el.children ? el.children.length : 0;
    if (kids >= 2) {
      score += Math.min(14, kids);
      reasons.push("children");
    } else if (kids === 0 && tag === "div") score -= 12;

    let interactive = 0;
    try {
      interactive = el.querySelectorAll
        ? el.querySelectorAll("button, a, input, select, textarea, [role='button'], [onclick]").length
        : 0;
    } catch (_) {
      interactive = 0;
    }
    if (interactive >= 1) score += Math.min(12, 4 + interactive);

    if (selected && el === selected) {
      score += 4;
      reasons.push("selection");
    } else if (selected && el.contains && el.contains(selected)) {
      score += 6;
      reasons.push("ancestor");
    }

    if (score < 18) return null;
    return {
      el: el,
      score: score,
      name: suggestName(el),
      kind: suggestKind(el, { interactive: interactive }),
      path: cssPathFor(el),
      label: elementLabel(el, false),
      tag: tag,
      id: el.id || "",
      className: classes.join(" "),
      attrs: attrs,
      reasons: reasons,
      box: {
        w: Math.round(rect.width || 0),
        h: Math.round(rect.height || 0),
      },
      interactive: interactive,
      childCount: kids,
    };
  }

  function detectModule(el, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    if (!el || el.nodeType !== 1) return null;
    const tagLow = el.tagName.toLowerCase();
    const pageLike = tagLow === "html" || tagLow === "body" || tagLow === "main";
    const chain = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement && depth < 24) {
      const scored = scoreModuleCandidate(cur, el);
      if (scored) chain.push(scored);
      cur = cur.parentElement;
      depth += 1;
    }
    chain.sort(function (a, b) {
      return b.score - a.score;
    });
    let best = chain[0] || null;
    let scanRoot = best ? best.el : el;
    if (pageLike || !best) {
      const pageRoot = tagLow === "html" ? el.querySelector("body") || el : el;
      const pageChildren = listChildModules(pageRoot, { limit: o.childLimit || 12, exclude: null });
      if (!best && pageChildren.length) {
        const top = pageChildren[0];
        best = {
          el: null,
          score: top.score,
          name: top.name,
          kind: top.kind,
          path: top.path,
          label: top.label,
          tag: "",
          id: "",
          className: "",
          attrs: [],
          reasons: ["page-scan"],
          box: top.box || { w: 0, h: 0 },
          interactive: 0,
          childCount: 0,
        };
        try {
          best.el = document.querySelector(top.path) || pageRoot;
        } catch (_) {
          best.el = pageRoot;
        }
        scanRoot = pageRoot;
      } else if (pageLike) {
        scanRoot = pageRoot;
      }
    }
    const alts = chain.slice(1, o.maxAlts != null ? o.maxAlts + 1 : 4);
    const children = listChildModules(scanRoot, { limit: o.childLimit || 10, exclude: el });
    return {
      selected: {
        label: elementLabel(el, false),
        path: cssPathFor(el),
        tag: tagLow,
      },
      module: best
        ? {
            name: best.name,
            kind: best.kind,
            score: best.score,
            path: best.path,
            label: best.label,
            tag: best.tag,
            id: best.id,
            className: best.className,
            attrs: best.attrs,
            reasons: best.reasons,
            box: best.box,
            interactive: best.interactive,
            childCount: best.childCount,
            isSelection: best.el === el,
          }
        : null,
      el: best ? best.el : null,
      alternatives: alts.map(function (a) {
        return {
          name: a.name,
          kind: a.kind,
          score: a.score,
          path: a.path,
          label: a.label,
        };
      }),
      children: children,
      pageLike: pageLike,
    };
  }

  function listChildModules(root, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    if (!root || root.nodeType !== 1) return [];
    const limit = o.limit || 8;
    const exclude = o.exclude || null;
    const found = [];
    const stack = Array.prototype.slice.call(root.children || []);
    let guard = 0;
    while (stack.length && found.length < limit * 3 && guard < 400) {
      guard += 1;
      const node = stack.shift();
      if (!node || node.nodeType !== 1) continue;
      if (exclude && (node === exclude || (exclude.contains && node.contains(exclude) && node !== root))) {
        /* keep scanning siblings */
      }
      const scored = scoreModuleCandidate(node, exclude || root);
      if (scored && scored.score >= 28 && scored.el !== root) {
        found.push(scored);
        continue;
      }
      if (node.children && node.children.length && guard < 350) {
        for (let i = 0; i < node.children.length; i++) stack.push(node.children[i]);
      }
    }
    found.sort(function (a, b) {
      return b.score - a.score;
    });
    const out = [];
    const seen = {};
    found.forEach(function (f) {
      const key = f.path || f.name;
      if (seen[key]) return;
      seen[key] = 1;
      out.push({
        name: f.name,
        kind: f.kind,
        score: f.score,
        path: f.path,
        label: f.label,
        box: f.box,
      });
    });
    return out.slice(0, limit);
  }

  function matchPackages(detection, packages) {
    const list = Array.isArray(packages) ? packages : [];
    if (!detection || !detection.module || !list.length) return [];
    const tokens = {};
    function addTok(s) {
      String(s || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter(function (t) {
          return t.length >= 3 && !GENERIC_CLASS_RE.test(t);
        })
        .forEach(function (t) {
          tokens[t] = 1;
        });
    }
    addTok(detection.module.name);
    addTok(detection.module.id);
    addTok(detection.module.className);
    addTok(detection.module.path);
    (detection.children || []).forEach(function (c) {
      addTok(c.name);
    });
    const tokList = Object.keys(tokens);
    if (!tokList.length) return [];
    const hits = [];
    list.forEach(function (pkg) {
      const id = String((pkg && (pkg.id || pkg.name)) || "").toLowerCase();
      const title = String((pkg && (pkg.title || pkg.name)) || "").toLowerCase();
      const blob = id + " " + title;
      let score = 0;
      tokList.forEach(function (t) {
        if (blob.indexOf(t) >= 0) score += t.length >= 6 ? 3 : 2;
      });
      if (score) {
        hits.push({
          id: pkg.id || pkg.name,
          title: pkg.title || pkg.name || pkg.id,
          score: score,
          source: pkg.source || "",
        });
      }
    });
    hits.sort(function (a, b) {
      return b.score - a.score;
    });
    return hits.slice(0, 5);
  }

  function selectionIssues(el, dump) {
    const issues = [];
    if (!el || !dump) return issues;
    if (dump.box.w < 1 || dump.box.h < 1) issues.push("Box 0×0 / unsichtbar klein");
    if (dump.visibility === "hidden") issues.push("visibility:hidden");
    if (Number(dump.opacity) === 0) issues.push("opacity:0");
    if (dump.display === "none") issues.push("display:none");
    if (dump.pointerEvents === "none") issues.push("pointer-events:none");
    if (dump.overflow && /hidden|clip|scroll|auto/.test(String(dump.overflow).split("/")[0])) {
      issues.push("overflow clippt Inhalt");
    }
    const cs = window.getComputedStyle(el);
    if (cs && (cs.position === "absolute" || cs.position === "fixed")) {
      if (cs.zIndex === "auto") issues.push(cs.position + " ohne z-index");
    }
    if (el.tagName && /^(IMG|VIDEO|CANVAS|SVG)$/i.test(el.tagName) && dump.box.w > 0 && dump.box.h > 0) {
      /* media ok */
    } else if (dump.box.w > 0 && dump.box.h > 0 && dump.box.w * dump.box.h < 400) {
      issues.push("sehr kleine Hitbox");
    }
    const parent = el.parentElement;
    if (parent) {
      const pcs = window.getComputedStyle(parent);
      if (pcs && (pcs.display === "flex" || pcs.display === "grid")) {
        if (pcs.display === "flex" && pcs.flexWrap === "nowrap" && parent.scrollWidth > parent.clientWidth + 2) {
          issues.push("Flex-Eltern überläuft (nowrap)");
        }
      }
    }
    return issues;
  }

  const FEATURE_PATTERNS = [
    {
      re: /cf-matrix-rain|matrix-rain|matrix-page|charforge-matrix/i,
      sel: "#cf-matrix-rain, canvas[id*='matrix']",
      name: "Matrix-Atmosphäre",
      role: "Look",
      does: "Hält den Matrix-Look (Regen/Canvas/Theme) im Hintergrund, ohne die Bedienung zu blockieren.",
    },
    {
      re: /tile-nav|is-tile-nav|data-tile-nav|cfTileNav|tile-nav-content/i,
      sel: ".is-tile-nav, [data-tile-nav], .tile-nav-content-clusters",
      name: "Kachel-Navigation",
      role: "Navigation",
      does: "Wechselt Hauptbereiche über Kacheln/Tabs; steuert Workspace und Seiten-Einstieg.",
    },
    {
      re: /site-nav|tabs-bar-nav/i,
      sel: "nav.site-nav, .site-nav",
      name: "Site-Navigation",
      role: "Navigation",
      does: "Führt zu den Hauptseiten der App (Projekte, Usage, Packages, Settings …).",
    },
    {
      re: /project-table|cursor-projekte|projekte scannen|project-row|col-modules/i,
      sel: ".project-table, [data-tile='workspace']",
      name: "Projekt-Übersicht",
      role: "Feature",
      does: "Scannt und listet Cursor-Projekte; Filter, Detail und Feature-Analyse starten hier.",
    },
    {
      re: /usage-analyser|usage-metric/i,
      sel: ".usage-analyser",
      name: "Usage-Analyse",
      role: "Feature",
      does: "Zeigt Verbrauch/Metriken und lässt Zeiträume oder Quellen vergleichen.",
    },
    {
      re: /packages-|pkg-detail|asset-store|bionic-module/i,
      sel: ".packages-main, #assetStoreRoot, .bionic-store",
      name: "Package-/Feature-Store",
      role: "Feature",
      does: "Verwaltet Module/Packages: planen, anbinden, exportieren, in Projekte laden.",
    },
    {
      re: /cursed-flyin|cursedFlyin|data-analyse-out/i,
      sel: "#cursedFlyinRoot, .cursed-flyin",
      name: "Fly-in Inspect",
      role: "Werkzeug",
      does: "Pipette + Analyse: UI-Bereiche wählen, Features erkennen, CSS/HTML und Prompt erzeugen.",
    },
    {
      re: /cursed-bridge|cursedBridge/i,
      sel: "[data-cursed-bridge], .cursed-bridge",
      name: "Cursed Bridge",
      role: "Werkzeug",
      does: "Koppelt Host-App und Cursed (Inject, Status, Package-Laufzeit).",
    },
    {
      re: /sidebar-rail|data-sidebar-resize|sidebar-resizer/i,
      sel: "[data-sidebar-resize], .sidebar-rail-label",
      name: "Sidebar-Rail",
      role: "UI",
      does: "Klappt Seitenleisten ein/aus und zeigt vertikalen Rail-Titel.",
    },
    {
      re: /cf-table-sortable|column-configurator|cf-table-col|table-sort/i,
      sel: ".cf-table-sortable, [data-col-config], .cf-table-col-btn",
      name: "Tabellen-Steuerung",
      role: "UI",
      does: "Sortiert Spalten per Header und blendet/ordnet Spalten über „Spalten ▾“.",
    },
    {
      re: /local-ai|lai-|ollama|llmster|chat-explorer/i,
      sel: "#laiRoot, .lai-model-table, #chatExplorerRefresh",
      name: "Local AI",
      role: "Feature",
      does: "Steuert lokale Modelle, Chat und Harness ohne Cloud-Zwang.",
    },
    {
      re: /serversRefresh|server-control|opencode/i,
      sel: "#serversRefresh, .servers-page",
      name: "Server-Steuerung",
      role: "Feature",
      does: "Startet/überwacht lokale Dienste und zeigt Laufstatus.",
    },
    {
      re: /\bsettings\b|cf-settings|matrix-theme/i,
      sel: "body[data-cf-theme], .settings-page",
      name: "Einstellungen / Theme",
      role: "Config",
      does: "Speichert App-Optionen und schaltet Matrix-/Layout-Theme.",
    },
    {
      re: /\bmodal\b|\bdialog\b|\bdrawer\b/i,
      sel: "dialog, [role='dialog'], .modal, .drawer",
      name: "Overlay / Dialog",
      role: "UI",
      does: "Temporäre Ebene für Detail, Bestätigung oder Nebenaufgabe.",
    },
    {
      re: /\bsearch\b|\bfilter\b|filtern/i,
      sel: "input[type='search'], [placeholder*='Such'], [placeholder*='Filter'], [placeholder*='such'], [placeholder*='filter']",
      name: "Suche / Filter",
      role: "Funktion",
      does: "Grenzt sichtbare Einträge nach Text oder Kriterien ein.",
    },
  ];

  function nodeSignalBlob(el) {
    if (!el || el.nodeType !== 1) return "";
    const parts = [
      el.id || "",
      typeof el.className === "string" ? el.className : "",
      el.tagName || "",
    ];
    MODULE_ATTRS.forEach(function (a) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) parts.push(a + "=" + v);
    });
    ["role", "aria-label", "title", "name", "data-act", "data-tab", "href"].forEach(function (a) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) parts.push(v);
    });
    return parts.join(" ");
  }

  function inferActionDoes(label, tag, href) {
    const t = String(label || "").toLowerCase();
    const h = String(href || "").toLowerCase();
    if (/aktualis|refresh|neu laden|↻/.test(t)) return "Lädt Daten oder Ansicht neu.";
    if (/kopier|copy/.test(t)) return "Kopiert Inhalt in die Zwischenablage.";
    if (/speicher|save|anlegen|erzeug|create/.test(t)) return "Persistiert oder legt einen neuen Eintrag an.";
    if (/lösch|delete|entfernen|remove/.test(t)) return "Entfernt den Bezug oder Eintrag.";
    if (/scann|analys|planen|plan/.test(t)) return "Startet Scan, Analyse oder Planungslauf.";
    if (/export|zip|download/.test(t)) return "Exportiert Daten oder Package als Datei.";
    if (/pipette|pick|wählen|select|modul wählen/.test(t)) return "Wählt ein Element oder Feature in der UI.";
    if (/start|stop|neustart|restart/.test(t)) return "Steuert einen Dienst oder Lauf.";
    if (/filter|suche|search/.test(t)) return "Filtert oder sucht in der aktuellen Liste.";
    if (/einstell|settings|config/.test(t)) return "Öffnet Konfiguration.";
    if (/projekte/.test(t) || /index\.html/.test(h)) return "Öffnet die Projektliste zum Scannen und Analysieren.";
    if (/usage/.test(t) || /usage\.html/.test(h)) return "Öffnet Verbrauchs-/Usage-Analyse.";
    if (/package|store|asset/.test(t) || /packages|asset-store/.test(h)) return "Öffnet Package-/Feature-Verwaltung.";
    if (/local.?ai|\bki\b/.test(t) || /local-ai/.test(h)) return "Öffnet lokale KI-Werkzeuge.";
    if (/server/.test(t) || /servers\.html/.test(h)) return "Öffnet Server-Übersicht und Steuerung.";
    if (tag === "a" && href) return "Navigiert zu „" + href.replace(/^\//, "") + "“.";
    if (tag === "button") return "Löst eine UI-Aktion aus.";
    if (tag === "input" || tag === "select" || tag === "textarea") return "Nimmt Eingabe für Filter oder Formular.";
    return "Bietet Interaktion in diesem Bereich.";
  }

  function analyzeUiFeatures(el, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    if (!el || el.nodeType !== 1) return null;
    const scopeEl = o.scopeEl || el;
    const tag = el.tagName.toLowerCase();
    const pageLike = tag === "html" || tag === "body" || tag === "main";
    const blob =
      nodeSignalBlob(scopeEl) +
      " " +
      (typeof scopeEl.className === "string" ? scopeEl.className : "") +
      " " +
      String(scopeEl.id || "") +
      " " +
      String(scopeEl.innerText || "").slice(0, 1600);

    const features = [];
    const seenFeat = {};
    FEATURE_PATTERNS.forEach(function (p) {
      let hit = p.re.test(blob);
      if (!hit && p.sel && scopeEl.querySelector) {
        try {
          hit = !!scopeEl.querySelector(p.sel);
        } catch (_) {
          hit = false;
        }
      }
      if (!hit || seenFeat[p.name]) return;
      seenFeat[p.name] = 1;
      features.push({ name: p.name, role: p.role, does: p.does });
    });

    const functions = [];
    const seenFn = {};
    let nodes = [];
    try {
      nodes = scopeEl.querySelectorAll
        ? scopeEl.querySelectorAll(
            "a[href], button, [role='button'], input:not([type='hidden']), select, textarea, [data-act], [data-tab], [data-tile]"
          )
        : [];
    } catch (_) {
      nodes = [];
    }
    const maxFn = o.maxFunctions || 14;
    for (let i = 0; i < nodes.length && functions.length < maxFn; i++) {
      const n = nodes[i];
      if (!n || (n.closest && n.closest("#cursedFlyinRoot, #cursedFlyinIcon, .cursed-flyin"))) continue;
      const ntag = n.tagName.toLowerCase();
      const label = (
        n.getAttribute("aria-label") ||
        n.getAttribute("title") ||
        n.getAttribute("data-act") ||
        n.getAttribute("data-tile") ||
        (ntag === "input" ? n.getAttribute("placeholder") || n.getAttribute("name") || n.getAttribute("type") : "") ||
        String(n.textContent || "")
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 72);
      if (!label || label.length < 2) continue;
      const key = label.toLowerCase();
      if (seenFn[key]) continue;
      seenFn[key] = 1;
      const href = n.getAttribute("href") || "";
      functions.push({
        name: label,
        tag: ntag,
        does: inferActionDoes(label, ntag, href),
        href: href.slice(0, 80),
      });
    }

    let purpose = "";
    if (pageLike || features.length >= 2) {
      const names = features
        .slice(0, 4)
        .map(function (f) {
          return f.name;
        })
        .join(", ");
      purpose =
        "Dieser Bereich orchestriert " +
        (names || "UI-Bausteine") +
        (functions.length ? " — Nutzer starten darüber Scan, Navigation und Werkzeuge." : ".");
    } else if (features.length) {
      purpose = features[0].does;
    } else if (functions.length) {
      purpose =
        "Interaktiver Block mit: " +
        functions
          .slice(0, 3)
          .map(function (f) {
            return f.name;
          })
          .join(", ") +
        ".";
    } else {
      const text = String(el.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);
      purpose = text
        ? "Zeigt Inhalt: „" + text + (text.length >= 140 ? "…" : "") + "“."
        : "Struktureller Container ohne klar beschriftete Aktion.";
    }

    return {
      scope: pageLike ? "page" : features.length ? "feature" : "element",
      purpose: purpose,
      features: features.slice(0, o.maxFeatures || 10),
      functions: functions,
    };
  }

  function formatFeatureAnalyse(analysis) {
    if (!analysis) return "";
    const lines = [];
    lines.push("—— Funktion ——");
    lines.push("Zweck: " + (analysis.purpose || "—"));
    lines.push("Scope: " + (analysis.scope || "element"));
    if (analysis.features && analysis.features.length) {
      lines.push("");
      lines.push("Features:");
      analysis.features.forEach(function (f) {
        lines.push("  · " + f.name + " [" + f.role + "] — " + f.does);
      });
    } else {
      lines.push("");
      lines.push("Features: keine klaren Muster (Pipette auf Nav/Panel/Tabelle).");
    }
    if (analysis.functions && analysis.functions.length) {
      lines.push("");
      lines.push("Funktionen / Aktionen:");
      analysis.functions.forEach(function (f) {
        lines.push("  · " + f.name + " — " + f.does);
      });
    }
    return lines.join("\n");
  }

  function formatSelectionAnalyse(el) {
    if (!el || el.nodeType !== 1) return "Keine Selektion.";
    const dump = dumpComputed(el);
    const tags = tagSummary(el);
    const lines = [];
    const classes = classListOf(el);
    const attrs = [];
    if (el.attributes) {
      for (let i = 0; i < el.attributes.length && i < 24; i++) {
        const a = el.attributes[i];
        if (!a || !a.name) continue;
        if (a.name === "class" || a.name === "style") continue;
        attrs.push(a.name + "=" + String(a.value || "").slice(0, 80));
      }
    }
    lines.push("—— Selektion ——");
    lines.push("Label: " + elementLabel(el, false));
    lines.push("Pfad: " + elementPath(el));
    lines.push("CSS: " + ((dump && dump.path) || cssPathFor(el) || "—"));
    lines.push(
      "Tag: " +
        el.tagName.toLowerCase() +
        (el.id ? " #" + el.id : "") +
        (classes.length ? " · ." + classes.slice(0, 8).join(".") : "")
    );
    if (dump) {
      lines.push(
        "Box: " +
          dump.box.w +
          "×" +
          dump.box.h +
          " @ " +
          dump.box.x +
          "," +
          dump.box.y +
          " · display " +
          dump.display +
          " · position " +
          dump.position +
          (dump.zIndex && dump.zIndex !== "auto" ? " · z " + dump.zIndex : "")
      );
      lines.push("Overflow: " + dump.overflow);
      lines.push("Margin: " + dump.margin);
      lines.push("Padding: " + dump.padding);
      lines.push("Font: " + dump.font);
      lines.push("Color/Bg: " + dump.color + " / " + dump.background);
      if (dump.rules) {
        const layout = [];
        ["flex", "flex-direction", "align-items", "justify-content", "gap", "grid-template-columns"].forEach(
          function (p) {
            const v = dump.rules[p];
            if (v && v !== "none" && v !== "normal" && v !== "stretch" && v !== "auto") {
              layout.push(p + ":" + v);
            }
          }
        );
        if (layout.length) lines.push("Layout: " + layout.join("; "));
      }
    }
    const parent = el.parentElement;
    if (parent && parent.nodeType === 1) {
      const sibs = parent.children ? parent.children.length : 0;
      const idx = parent.children ? Array.prototype.indexOf.call(parent.children, el) + 1 : 0;
      lines.push(
        "Eltern: " +
          elementLabel(parent, false) +
          " · Kind " +
          idx +
          "/" +
          sibs +
          " · Kinder hier " +
          (el.children ? el.children.length : 0)
      );
      try {
        const pcs = window.getComputedStyle(parent);
        if (pcs) {
          lines.push(
            "Eltern-Layout: " +
              pcs.display +
              (pcs.display === "flex"
                ? " " + pcs.flexDirection + " gap:" + pcs.gap
                : pcs.display === "grid"
                  ? " cols:" + pcs.gridTemplateColumns
                  : "")
          );
        }
      } catch (_) {}
    }
    if (attrs.length) lines.push("Attrs: " + attrs.join(", "));
    if (tags) {
      const tagList = Object.keys(tags.tags || {})
        .sort()
        .map(function (t) {
          return t + "×" + tags.tags[t];
        })
        .join(", ");
      lines.push(
        "Subtree: " +
          (tags.descendantCount || 0) +
          " Nodes · " +
          (tagList || "—")
      );
      if (tags.text) lines.push("Text: " + tags.text.slice(0, 220));
    }
    const issues = selectionIssues(el, dump);
    if (issues.length) {
      lines.push("Hinweise: " + issues.join(" · "));
    }
    return lines.join("\n");
  }

  function formatModuleAnalyse(detection, packageHits) {
    if (!detection) return "Keine Feature-Erkennung.";
    const lines = [];
    if (!detection.module) {
      lines.push("Modul: nicht erkannt (Eltern ▲ / Pipette auf Container).");
      return lines.join("\n");
    }
    const m = detection.module;
    lines.push("—— Feature ——");
    lines.push("Modul: " + m.name + (m.isSelection ? " · = Selektion" : " · Vorfahr"));
    lines.push("Art: " + m.kind + " · Score " + m.score);
    lines.push("Label: " + m.label);
    lines.push("Pfad: " + m.path);
    lines.push("Box: " + m.box.w + "×" + m.box.h + " · Kinder " + m.childCount + " · Interaktiv " + m.interactive);
    if (m.reasons && m.reasons.length) lines.push("Signale: " + m.reasons.join(", "));
    if (m.attrs && m.attrs.length) {
      lines.push(
        "Attrs: " +
          m.attrs
            .map(function (a) {
              return a.attr + "=" + a.value;
            })
            .join(", ")
      );
    }
    if (detection.alternatives && detection.alternatives.length) {
      lines.push("");
      lines.push("Alternativen:");
      detection.alternatives.forEach(function (a) {
        lines.push("  · " + a.name + " (" + a.kind + ", " + a.score + ") — " + a.label);
      });
    }
    if (detection.children && detection.children.length) {
      lines.push("");
      lines.push("Kind-Features:");
      detection.children.forEach(function (c) {
        lines.push("  · " + c.name + " (" + c.kind + ", " + c.score + ") — " + c.label);
      });
    }
    if (packageHits && packageHits.length) {
      lines.push("");
      lines.push("Cursed-Packages:");
      packageHits.forEach(function (p) {
        lines.push("  · " + (p.title || p.id) + (p.source ? " [" + p.source + "]" : "") + " · match " + p.score);
      });
    }
    return lines.join("\n");
  }

  function buildPrompt(opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const intent = String(o.intent || "fix").toLowerCase();
    const dump = o.dump || (o.el ? dumpComputed(o.el) : null);
    const tags = o.tagSummary || (o.el ? tagSummary(o.el) : null);
    const moduleInfo = o.module || (o.el ? detectModule(o.el) : null);
    const uiInfo = o.ui || (o.el ? analyzeUiFeatures(o.el, { scopeEl: (moduleInfo && moduleInfo.el) || o.el }) : null);
    const shots = Array.isArray(o.screenshots) ? o.screenshots.length : 0;
    const intentLine = {
      fix: "Auftrag: Analysierten Bereich reparieren (Layout, CSS, Markup, Bugs).",
      extend: "Auftrag: Analysierten Bereich ausbauen (Features, States, A11y).",
      restyle: "Auftrag: Look & Styles des Bereichs überarbeiten, Struktur behalten.",
      extract: "Auftrag: Bereich als wiederverwendbares Modul/Feature/Style/Package extrahieren.",
    }[intent] || "Auftrag: Analysierten Bereich bearbeiten.";
    const parts = [];
    parts.push("Cursed Fly-in — UI-Bereich");
    parts.push("");
    parts.push(intentLine);
    if (o.note) {
      parts.push("");
      parts.push("Notiz: " + String(o.note).trim());
    }
    parts.push("");
    if (uiInfo && uiInfo.purpose) {
      parts.push("Zweck: " + uiInfo.purpose);
      if (uiInfo.features && uiInfo.features.length) {
        parts.push(
          "Features: " +
            uiInfo.features
              .map(function (f) {
                return f.name + " (" + f.does + ")";
              })
              .join(" | ")
        );
      }
      if (uiInfo.functions && uiInfo.functions.length) {
        parts.push(
          "Aktionen: " +
            uiInfo.functions
              .slice(0, 8)
              .map(function (f) {
                return f.name + " → " + f.does;
              })
              .join(" | ")
        );
      }
    }
    if (moduleInfo && moduleInfo.module) {
      parts.push(
        "Modul: " +
          moduleInfo.module.name +
          " (" +
          moduleInfo.module.kind +
          ", score " +
          moduleInfo.module.score +
          ")"
      );
      parts.push("Feature-Pfad: " + moduleInfo.module.path);
      if (moduleInfo.children && moduleInfo.children.length) {
        parts.push(
          "Kind-Features: " +
            moduleInfo.children
              .map(function (c) {
                return c.name;
              })
              .join(", ")
        );
      }
    }
    if (dump) {
      parts.push("Selektion: " + (o.path || dump.path || "—"));
      parts.push("Box: " + dump.box.w + "×" + dump.box.h + " @ " + dump.box.x + "," + dump.box.y);
      parts.push("display/position: " + dump.display + " / " + dump.position);
      parts.push("font: " + dump.font);
      parts.push("color/bg: " + dump.color + " / " + dump.background);
    } else {
      parts.push("Selektion: " + (o.path || "—"));
    }
    if (tags) {
      const tagList = Object.keys(tags.tags || {})
        .sort()
        .map(function (t) {
          return t + "×" + tags.tags[t];
        })
        .join(", ");
      parts.push("Tags: " + (tagList || "—"));
      if (tags.text) parts.push("Text: " + tags.text);
    }
    if (o.css) {
      parts.push("");
      parts.push("CSS:");
      parts.push("```css");
      parts.push(String(o.css).slice(0, 4000));
      parts.push("```");
    }
    if (o.html) {
      parts.push("");
      parts.push("HTML:");
      parts.push("```html");
      parts.push(String(o.html).slice(0, 4000));
      parts.push("```");
    }
    if (shots) parts.push("");
    if (shots) parts.push("Screenshots: " + shots + " beigefügt.");
    parts.push("");
    parts.push("OUTPUT ONLY. Keine Erklärungen, direkt umsetzen.");
    return parts.join("\n");
  }

  function ensureHighlight() {
    let box = document.getElementById("cursedInspectHighlight");
    if (!box) {
      box = document.createElement("div");
      box.id = "cursedInspectHighlight";
      box.setAttribute("aria-hidden", "true");
      box.style.cssText =
        "position:fixed;z-index:2147483000;pointer-events:none;border:2px solid #7dffb0;" +
        "background:rgba(125,255,176,0.12);box-shadow:0 0 0 1px rgba(0,0,0,0.35);" +
        "display:none;";
      document.documentElement.appendChild(box);
    }
    return box;
  }

  function placeHighlight(el) {
    const box = ensureHighlight();
    if (!el || !el.getBoundingClientRect) {
      box.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = Math.round(r.left) + "px";
    box.style.top = Math.round(r.top) + "px";
    box.style.width = Math.max(0, Math.round(r.width)) + "px";
    box.style.height = Math.max(0, Math.round(r.height)) + "px";
  }

  function hideHighlight() {
    const box = document.getElementById("cursedInspectHighlight");
    if (box) box.style.display = "none";
  }

  function createPicker(options) {
    const opts = options && typeof options === "object" ? options : {};
    const ignore = typeof opts.ignore === "function" ? opts.ignore : function () {
      return false;
    };
    let picking = false;
    let hover = null;
    let selected = null;
    let depth = [];

    function isIgnored(el) {
      if (!el || el.nodeType !== 1) return true;
      if (el.id === "cursedInspectHighlight") return true;
      if (el.closest && el.closest("#cursedInspectHighlight, #cursedFlyinRoot, .cursed-flyin")) return true;
      try {
        return !!ignore(el);
      } catch (_) {
        return false;
      }
    }

    function fromPoint(x, y) {
      const stack = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
      for (let i = 0; i < stack.length; i++) {
        const el = stack[i];
        if (el && !isIgnored(el)) return el;
      }
      return null;
    }

    function setHover(el) {
      hover = el;
      if (el) placeHighlight(el);
      if (typeof opts.onHover === "function") opts.onHover(el);
    }

    function setSelected(el) {
      selected = el && document.contains(el) ? el : null;
      hover = selected;
      if (selected) {
        placeHighlight(selected);
        window.$sel = selected;
      }
      if (typeof opts.onSelect === "function") opts.onSelect(selected);
    }

    function onMove(ev) {
      if (!picking) return;
      const el = fromPoint(ev.clientX, ev.clientY);
      setHover(el);
    }

    function onClick(ev) {
      if (!picking) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      const el = fromPoint(ev.clientX, ev.clientY);
      if (!el) return;
      // Confirm pick: keep selection, leave pipette mode so UI updates to "Pipette".
      selected = document.contains(el) ? el : null;
      hover = selected;
      if (selected) {
        placeHighlight(selected);
        window.$sel = selected;
      }
      stop();
      if (typeof opts.onSelect === "function") opts.onSelect(selected);
    }

    function onKey(ev) {
      if (!picking) return;
      if (ev.key === "Escape") {
        stop();
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        selectParent();
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        selectChild();
      }
    }

    function start() {
      if (picking) return;
      picking = true;
      document.body.classList.add("cursed-inspect-picking");
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey, true);
    }

    function stop() {
      picking = false;
      document.body.classList.remove("cursed-inspect-picking");
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      if (!selected) hideHighlight();
      else placeHighlight(selected);
    }

    function selectParent() {
      const cur = selected || hover;
      if (!cur || !cur.parentElement) return;
      const next = cur.parentElement;
      if (next === document.documentElement || isIgnored(next)) return;
      setSelected(next);
    }

    function selectChild() {
      const cur = selected || hover;
      if (!cur || !cur.children.length) return;
      const next = cur.children[0];
      if (isIgnored(next)) return;
      setSelected(next);
    }

    function destroy() {
      stop();
      hideHighlight();
      selected = null;
      hover = null;
    }

    return {
      start: start,
      stop: stop,
      toggle: function () {
        if (picking) stop();
        else start();
        return picking;
      },
      isPicking: function () {
        return picking;
      },
      getSelected: function () {
        return selected;
      },
      getHover: function () {
        return hover;
      },
      setSelected: setSelected,
      selectParent: selectParent,
      selectChild: selectChild,
      destroy: destroy,
    };
  }

  function inlineStyles(src, dest) {
    if (!src || !dest || src.nodeType !== 1) return;
    try {
      const cs = window.getComputedStyle(src);
      let css = "";
      for (let i = 0; i < cs.length; i++) {
        const p = cs[i];
        css += p + ":" + cs.getPropertyValue(p) + ";";
      }
      dest.setAttribute("style", css);
    } catch (_) {}
    const sc = src.children;
    const dc = dest.children;
    for (let i = 0; i < sc.length && i < dc.length; i++) inlineStyles(sc[i], dc[i]);
  }

  function captureElement(el, captureOpts) {
    const o = captureOpts && typeof captureOpts === "object" ? captureOpts : {};
    const max = o.maxSize || 1200;
    return new Promise(function (resolve, reject) {
      if (!el || el.nodeType !== 1) {
        reject(new Error("Kein Element"));
        return;
      }
      const rect = el.getBoundingClientRect();
      let w = Math.max(1, Math.round(rect.width));
      let h = Math.max(1, Math.round(rect.height));
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));

      function fallbackCanvas() {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0a120f";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#7dffb0";
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = "#7dffb0";
        ctx.font = "12px monospace";
        const label = elementLabel(el, false).slice(0, 48);
        ctx.fillText(label, 10, 22);
        ctx.fillText(Math.round(rect.width) + "×" + Math.round(rect.height), 10, 40);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: w,
          height: h,
          fallback: true,
          name: "capture-" + Date.now() + ".png",
        });
      }

      try {
        const clone = el.cloneNode(true);
        clone.querySelectorAll("script, iframe, video, audio").forEach(function (n) {
          n.remove();
        });
        inlineStyles(el, clone);
        clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        const wrap = document.createElement("div");
        wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        wrap.style.cssText = "margin:0;padding:0;width:" + w + "px;height:" + h + "px;background:#0a120f;";
        wrap.appendChild(clone);
        const xml = new XMLSerializer().serializeToString(wrap);
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="' +
          w +
          '" height="' +
          h +
          '"><foreignObject width="100%" height="100%">' +
          xml +
          "</foreignObject></svg>";
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        const img = new Image();
        img.onload = function () {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#0a120f";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve({
              dataUrl: canvas.toDataURL("image/png"),
              width: w,
              height: h,
              fallback: false,
              name: "capture-" + Date.now() + ".png",
            });
          } catch (err) {
            fallbackCanvas();
          }
        };
        img.onerror = function () {
          fallbackCanvas();
        };
        img.src = url;
      } catch (err) {
        fallbackCanvas();
      }
    });
  }

  return {
    version: VERSION,
    cssPathFor: cssPathFor,
    elementLabel: elementLabel,
    elementPath: elementPath,
    dumpComputed: dumpComputed,
    dumpComputedCss: dumpComputedCss,
    tagSummary: tagSummary,
    detectFeatures: detectModule,
    listChildFeatures: listChildModules,
    matchPackages: matchPackages,
    analyzeUiFeatures: analyzeUiFeatures,
    formatFeatureAnalyse: formatFeatureAnalyse,
    formatSelectionAnalyse: formatSelectionAnalyse,
    formatModuleAnalyse: formatModuleAnalyse,
    suggestName: suggestName,
    suggestKind: suggestKind,
    buildPrompt: buildPrompt,
    createPicker: createPicker,
    captureElement: captureElement,
    placeHighlight: placeHighlight,
    hideHighlight: hideHighlight,
  };
});
