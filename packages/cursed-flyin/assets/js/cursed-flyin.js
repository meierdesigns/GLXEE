"use strict";

/**
 * CursedFlyin — right-edge card for host apps and the IDE overlay.
 *
 *   CursedFlyin.autoMount({ baseUrl, targetProject });
 *   const fly = CursedFlyin.create({ baseUrl, targetProject }).mount();
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CursedFlyin = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "1.2.2";
  const INSPECT_MIN = "1.2.0";
  const DEFAULT_BASE = "http://127.0.0.1:6190";
  const WIDTH_KEY = "cursed-flyin-width";
  const WIDTH_MIN = 360;
  const WIDTH_MAX = 960;
  const WIDTH_DEFAULT = 560;
  const MAX_SHOTS = 5;
  const ROOT_ID = "cursedFlyinRoot";
  const ICON_ID = "cursedFlyinIcon";
  let mountedInstance = null;

  function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  function normalizeBase(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      if (isBrowser() && location.protocol !== "file:") {
        if (location.port === "6190" || /cursed/i.test(location.hostname)) return "";
        return DEFAULT_BASE;
      }
      return DEFAULT_BASE;
    }
    return raw.replace(/\/+$/, "");
  }

  function scriptDir() {
    if (!isBrowser()) return "";
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src.replace(/[^/]+$/, "");
    }
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || "";
      if (/cursed-flyin\.js/.test(src)) return src.replace(/[^/]+$/, "");
    }
    return "";
  }

  function loadCss(href) {
    if (!href || document.querySelector('link[data-cursed-flyin-css="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href + (href.indexOf("?") >= 0 ? "&" : "?") + "v=" + VERSION;
    link.setAttribute("data-cursed-flyin-css", "1");
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!src) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute("data-cursed-loaded") === "1" || window.CursedElementInspect) {
          resolve();
          return;
        }
        existing.addEventListener("load", function () {
          resolve();
        });
        existing.addEventListener("error", function () {
          reject(new Error("Script fehlgeschlagen: " + src));
        });
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.setAttribute("data-cursed-flyin-js", "1");
      s.onload = function () {
        s.setAttribute("data-cursed-loaded", "1");
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Script fehlgeschlagen: " + src));
      };
      document.head.appendChild(s);
    });
  }

  function inspectIsCurrent(api) {
    if (!api) return false;
    if (typeof api.formatSelectionAnalyse !== "function") return false;
    const v = String(api.version || "");
    return v >= INSPECT_MIN;
  }

  function ensureInspect(dir) {
    if (typeof window !== "undefined" && inspectIsCurrent(window.CursedElementInspect)) {
      return Promise.resolve(window.CursedElementInspect);
    }
    const base = (dir || scriptDir()) + "cursed-element-inspect.js";
    const src = base + (base.indexOf("?") >= 0 ? "&" : "?") + "v=" + VERSION;
    return loadScript(src).then(function () {
      return window.CursedElementInspect;
    });
  }

  function parseShortcut(str) {
    const parts = String(str || "Alt+Shift+F")
      .split("+")
      .map(function (p) {
        return p.trim().toLowerCase();
      })
      .filter(Boolean);
    const spec = { alt: false, shift: false, ctrl: false, meta: false, key: "f" };
    parts.forEach(function (p) {
      if (p === "alt") spec.alt = true;
      else if (p === "shift") spec.shift = true;
      else if (p === "ctrl" || p === "control") spec.ctrl = true;
      else if (p === "meta" || p === "cmd" || p === "command") spec.meta = true;
      else spec.key = p;
    });
    return spec;
  }

  function matchShortcut(ev, spec) {
    if (!spec) return false;
    if (!!ev.altKey !== spec.alt) return false;
    if (!!ev.shiftKey !== spec.shift) return false;
    if (!!ev.ctrlKey !== spec.ctrl) return false;
    if (!!ev.metaKey !== spec.meta) return false;
    const key = String(ev.key || "").toLowerCase();
    const code = String(ev.code || "").toLowerCase();
    return key === spec.key || code === "key" + spec.key || code === spec.key;
  }

  function clampWidth(px) {
    const vw = isBrowser() ? window.innerWidth || 1200 : 1200;
    const max = Math.min(WIDTH_MAX, Math.floor(vw * 0.92));
    const min = Math.min(WIDTH_MIN, max);
    const n = Math.round(Number(px) || WIDTH_DEFAULT);
    return Math.max(min, Math.min(max, n));
  }

  function readWidth() {
    try {
      const raw = localStorage.getItem(WIDTH_KEY);
      if (raw) return clampWidth(raw);
    } catch (_) {}
    return WIDTH_DEFAULT;
  }

  function saveWidth(px) {
    const w = clampWidth(px);
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch (_) {}
    return w;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function defaultFlyinSettings() {
    return {
      enabled: false,
      injectInProjects: true,
      ideOverlay: true,
      shortcut: "Alt+Shift+F",
      iconButton: true,
      iconPosition: "bottom-right",
    };
  }

  function create(options) {
    const opts = options && typeof options === "object" ? options : {};
    let baseUrl = normalizeBase(opts.baseUrl != null ? opts.baseUrl : opts.cursedUrl);
    let targetProject = String(opts.targetProject || opts.target || "").trim();
    let settings = Object.assign(defaultFlyinSettings(), opts.settings || {});
    let open = false;
    let picker = null;
    let screenshots = [];
    let currentTab = "element";
    const dir = opts.scriptDir || scriptDir();
    const force = opts.force === true;
    const startOpen = opts.startOpen === true;
    const hostMode = opts.host === "ide" ? "ide" : "app";

    function api(path, init) {
      const url = (baseUrl || "") + path;
      const headers = Object.assign({ Accept: "application/json" }, (init && init.headers) || {});
      let body = init && init.body;
      if (body && typeof body === "object" && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
      }
      return fetch(url, Object.assign({}, init || {}, { headers: headers, body: body })).then(
        function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error((data && data.error) || res.statusText);
            return data;
          });
        }
      );
    }

    function inspect() {
      return window.CursedElementInspect;
    }

    function selectedEl() {
      return picker && picker.getSelected ? picker.getSelected() : null;
    }

    function setStatus(text, isErr) {
      const el = document.getElementById("cursedFlyinStatus");
      if (!el) return;
      el.textContent = text || "";
      el.classList.toggle("is-err", !!isErr);
    }

    function applyWidth(px) {
      const w = clampWidth(px);
      document.documentElement.style.setProperty("--cursed-flyin-w", w + "px");
      return w;
    }

    function bindResize(root) {
      const handle = root.querySelector(".cursed-flyin-resizer");
      const panel = root.querySelector(".cursed-flyin-panel");
      if (!handle || !panel) return;
      let startX = 0;
      let startW = 0;
      function onMove(ev) {
        applyWidth(startW + (startX - ev.clientX));
      }
      function onUp() {
        document.body.classList.remove("is-cursed-flyin-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        saveWidth(panel.getBoundingClientRect().width || readWidth());
      }
      handle.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        startX = ev.clientX;
        startW = panel.getBoundingClientRect().width || readWidth();
        document.body.classList.add("is-cursed-flyin-resizing");
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }

    function sectionHtml() {
      return (
        '<div class="cursed-flyin-head">' +
        "<h2>Cursed</h2>" +
        '<button type="button" class="cursed-flyin-close" data-flyin-close aria-label="Schließen">×</button>' +
        "</div>" +
        '<div class="cursed-flyin-tabs" role="tablist">' +
        '<button type="button" class="cursed-flyin-tab is-on" data-tab="element" role="tab">Element</button>' +
        '<button type="button" class="cursed-flyin-tab" data-tab="analyse" role="tab">Analyse</button>' +
        '<button type="button" class="cursed-flyin-tab" data-tab="shots" role="tab">Screenshots</button>' +
        '<button type="button" class="cursed-flyin-tab" data-tab="prompt" role="tab">Prompt</button>' +
        '<button type="button" class="cursed-flyin-tab" data-tab="create" role="tab">Anlegen</button>' +
        "</div>" +
        '<section class="cursed-flyin-section" data-section="element">' +
        '<div class="cursed-flyin-toolbar">' +
        '<button type="button" class="cursed-flyin-btn primary" data-act="pick">Pipette</button>' +
        '<button type="button" class="cursed-flyin-btn" data-act="parent">Eltern ▲</button>' +
        '<button type="button" class="cursed-flyin-btn" data-act="child">Kind ▼</button>' +
        "</div>" +
        '<p class="cursed-flyin-muted" data-el-hint>Pipette · Element klicken · ↑↓ Ebene · Esc zu</p>' +
        '<pre class="cursed-flyin-pre" data-el-path>—</pre>' +
        "</section>" +
        '<section class="cursed-flyin-section" data-section="analyse" hidden>' +
        '<div class="cursed-flyin-row">' +
        '<button type="button" class="cursed-flyin-btn" data-act="refresh-analyse">Aktualisieren</button>' +
        '<button type="button" class="cursed-flyin-btn" data-act="pick-module">Feature wählen</button>' +
        '<button type="button" class="cursed-flyin-btn" data-act="copy-css">CSS kopieren</button>' +
        '<button type="button" class="cursed-flyin-btn" data-act="copy-html">HTML kopieren</button>' +
        "</div>" +
        '<pre class="cursed-flyin-pre" data-analyse-out>Keine Selektion.</pre>' +
        "</section>" +
        '<section class="cursed-flyin-section" data-section="shots" hidden>' +
        '<div class="cursed-flyin-row">' +
        '<button type="button" class="cursed-flyin-btn primary" data-act="capture">Element aufnehmen</button>' +
        "</div>" +
        '<div class="cursed-flyin-shots" data-shots></div>' +
        '<p class="cursed-flyin-muted">Max. ' +
        MAX_SHOTS +
        " Bilder, werden mit Prompt/Package mitgeschickt.</p>" +
        "</section>" +
        '<section class="cursed-flyin-section" data-section="prompt" hidden>' +
        '<label class="cursed-flyin-field">Intent' +
        '<select data-intent><option value="fix">Fixen</option><option value="extend">Ausbauen</option>' +
        '<option value="restyle">Restylen</option><option value="extract">Extrahieren</option></select></label>' +
        '<label class="cursed-flyin-field">Notiz<textarea data-note rows="2" placeholder="Was soll passieren?"></textarea></label>' +
        '<div class="cursed-flyin-row">' +
        '<button type="button" class="cursed-flyin-btn primary" data-act="build-prompt">Prompt bauen</button>' +
        '<button type="button" class="cursed-flyin-btn" data-act="copy-prompt">Kopieren</button>' +
        "</div>" +
        '<textarea class="cursed-flyin-pre" data-prompt rows="12" spellcheck="false"></textarea>' +
        "</section>" +
        '<section class="cursed-flyin-section" data-section="create" hidden>' +
        '<label class="cursed-flyin-field">Art' +
        '<select data-kind><option value="module">Feature</option><option value="feature">Feature</option>' +
        '<option value="style">Style</option><option value="package">Package</option></select></label>' +
        '<label class="cursed-flyin-field">Name<input type="text" data-title placeholder="Name" spellcheck="false"></label>' +
        '<label class="cursed-flyin-field">Tags<input type="text" data-tags placeholder="ui, styles" spellcheck="false"></label>' +
        '<div class="cursed-flyin-row">' +
        '<button type="button" class="cursed-flyin-btn primary" data-act="create">In Cursed anlegen</button>' +
        "</div>" +
        "</section>" +
        '<p class="cursed-flyin-status" id="cursedFlyinStatus" aria-live="polite"></p>'
      );
    }

    function ensureDom() {
      let root = document.getElementById(ROOT_ID);
      if (!root) {
        root = document.createElement("div");
        root.id = ROOT_ID;
        root.className = "cursed-flyin";
        root.hidden = true;
        root.innerHTML =
          '<div class="cursed-flyin-backdrop" data-flyin-close="1" aria-hidden="true"></div>' +
          '<div class="cursed-flyin-panel">' +
          '<div class="cursed-flyin-resizer" aria-hidden="true"></div>' +
          '<aside class="cursed-flyin-card" role="dialog" aria-modal="true" aria-label="Cursed">' +
          sectionHtml() +
          "</aside></div>";
        document.body.appendChild(root);
        bindResize(root);
        bindUi(root);
      } else {
        const card = root.querySelector(".cursed-flyin-card");
        if (card && !card.querySelector(".cursed-flyin-toolbar")) {
          card.innerHTML = sectionHtml();
        }
        if (!root.querySelector(".cursed-flyin-backdrop")) {
          const bd = document.createElement("div");
          bd.className = "cursed-flyin-backdrop";
          bd.setAttribute("data-flyin-close", "1");
          bd.setAttribute("aria-hidden", "true");
          root.insertBefore(bd, root.firstChild);
        }
      }
      ensureIcon();
      applyWidth(readWidth());
      return root;
    }

    function ensureIcon() {
      let btn = document.getElementById(ICON_ID);
      if (!btn) {
        btn = document.createElement("button");
        btn.id = ICON_ID;
        btn.type = "button";
        btn.className = "cursed-flyin-icon";
        btn.textContent = "C";
        btn.title = "Cursed Fly-in";
        btn.addEventListener("click", function () {
          toggle();
        });
        document.body.appendChild(btn);
      }
      syncIcon();
      return btn;
    }

    function syncIcon() {
      const btn = document.getElementById(ICON_ID);
      if (!btn) return;
      const show = settings.iconButton !== false && (force || settings.enabled);
      btn.hidden = !show;
      btn.className =
        "cursed-flyin-icon pos-" + (settings.iconPosition || "bottom-right");
      btn.title = "Cursed Fly-in (" + (settings.shortcut || "Alt+Shift+F") + ")";
    }

    function setTab(id) {
      currentTab = id;
      const root = document.getElementById(ROOT_ID);
      if (!root) return;
      root.querySelectorAll("[data-tab]").forEach(function (btn) {
        const on = btn.getAttribute("data-tab") === id;
        btn.classList.toggle("is-on", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      root.querySelectorAll("[data-section]").forEach(function (sec) {
        sec.hidden = sec.getAttribute("data-section") !== id;
      });
      if (id === "analyse") refreshAnalyse();
      if (id === "prompt") buildPromptIntoUi(false);
    }

    function syncPickingUi() {
      const root = document.getElementById(ROOT_ID);
      const on = !!(picker && picker.isPicking && picker.isPicking());
      if (root) root.classList.toggle("is-picking", on);
      const pickBtn = root && root.querySelector('[data-act="pick"]');
      if (pickBtn) {
        pickBtn.classList.toggle("is-on", on);
        pickBtn.textContent = on ? "Pipette · an" : "Pipette";
      }
    }

    function refreshElement() {
      const root = document.getElementById(ROOT_ID);
      if (!root) return;
      const el = selectedEl();
      const insp = inspect();
      const pathEl = root.querySelector("[data-el-path]");
      const hint = root.querySelector("[data-el-hint]");
      syncPickingUi();
      if (!el) {
        if (pathEl) pathEl.textContent = hostMode === "ide"
          ? "Keine Selektion. Pipette hier oder in der Projekt-App nutzen."
          : "Keine Selektion.";
        if (hint) {
          hint.textContent = "Pipette · Element klicken · ↑↓ Ebene · Esc zu";
        }
        return;
      }
      const path = insp ? insp.cssPathFor(el) : el.tagName;
      const label = insp ? insp.elementPath(el) : el.tagName;
      if (pathEl) pathEl.textContent = label + "\n" + path;
      if (hint) hint.textContent = "Gewählt · ↑↓ Ebene · Klick außerhalb schließt";
    }

    function applyModuleSuggestion(detection) {
      const root = document.getElementById(ROOT_ID);
      if (!root || !detection || !detection.module) return;
      const kindEl = root.querySelector("[data-kind]");
      const titleEl = root.querySelector("[data-title]");
      const tagsEl = root.querySelector("[data-tags]");
      if (kindEl && (!kindEl.dataset.userSet || !kindEl.value)) {
        kindEl.value = detection.module.kind || "module";
      }
      if (titleEl && !titleEl.value.trim()) {
        titleEl.value = detection.module.name || "";
      }
      if (tagsEl && !tagsEl.value.trim()) {
        const tags = ["ui"];
        if (detection.module.kind === "style") tags.push("styles");
        if (detection.module.kind === "feature") tags.push("feature");
        if (detection.module.name) tags.push(detection.module.name);
        tagsEl.value = tags.filter(Boolean).join(", ");
      }
    }

    function loadProjectPackages() {
      if (!targetProject) return Promise.resolve([]);
      return api("/api/packages?project=" + encodeURIComponent(targetProject))
        .then(function (data) {
          return (data && (data.packages || data.items)) || [];
        })
        .catch(function () {
          return [];
        });
    }

    function refreshAnalyse() {
      const root = document.getElementById(ROOT_ID);
      if (!root) return;
      const out = root.querySelector("[data-analyse-out]");
      const el = selectedEl();
      const insp = inspect();
      if (!el || !insp) {
        if (out) out.textContent = "Keine Selektion.";
        return;
      }
      const detection = insp.detectModule(el);
      applyModuleSuggestion(detection);
      const scopeEl = detection && detection.el ? detection.el : el;
      const ui =
        typeof insp.analyzeUiFeatures === "function"
          ? insp.analyzeUiFeatures(el, { scopeEl: scopeEl })
          : null;
      const featureBlock =
        typeof insp.formatFeatureAnalyse === "function" ? insp.formatFeatureAnalyse(ui) : "";
      const selectionBlock =
        typeof insp.formatSelectionAnalyse === "function"
          ? insp.formatSelectionAnalyse(el)
          : "Selektion: " + (insp.cssPathFor(el) || "—");
      const dump = insp.dumpComputed(scopeEl);
      const css = insp.dumpComputedCss(scopeEl).slice(0, 1800);
      const html = String(scopeEl.outerHTML || "").slice(0, 1200);
      function paint(packageHits) {
        const moduleBlock = insp.formatModuleAnalyse(detection, packageHits);
        if (out) {
          out.textContent = [featureBlock, moduleBlock, selectionBlock, "—— CSS / Markup (kurz) ——", css, "", "HTML:", html]
            .filter(function (part) {
              return part != null && String(part).length;
            })
            .join("\n\n");
        }
      }
      paint([]);
      loadProjectPackages().then(function (pkgs) {
        const hits = insp.matchPackages(detection, pkgs);
        if (hits.length) paint(hits);
      });
    }

    function selectDetectedModule() {
      const el = selectedEl();
      const insp = inspect();
      if (!el || !insp) {
        setStatus("Zuerst Element wählen", true);
        return;
      }
      const detection = insp.detectModule(el);
      if (!detection || !detection.el) {
        setStatus("Kein Feature erkannt", true);
        return;
      }
      if (!picker) picker = makePicker();
      if (!picker) {
        setStatus("Inspect-Feature fehlt", true);
        return;
      }
      picker.setSelected(detection.el);
      applyModuleSuggestion(detection);
      refreshElement();
      refreshAnalyse();
      setStatus("Feature gewählt · " + detection.module.name);
      setTab("analyse");
    }

    function renderShots() {
      const root = document.getElementById(ROOT_ID);
      if (!root) return;
      const host = root.querySelector("[data-shots]");
      if (!host) return;
      host.innerHTML = screenshots
        .map(function (shot, i) {
          return (
            '<div class="cursed-flyin-shot"><img alt="" src="' +
            shot.dataUrl +
            '"><button type="button" data-shot-del="' +
            i +
            '" aria-label="Entfernen">×</button></div>'
          );
        })
        .join("");
    }

    function selectionPayload() {
      const el = selectedEl();
      const insp = inspect();
      const root = document.getElementById(ROOT_ID);
      const promptEl = root && root.querySelector("[data-prompt]");
      const kindEl = root && root.querySelector("[data-kind]");
      const titleEl = root && root.querySelector("[data-title]");
      const tagsEl = root && root.querySelector("[data-tags]");
      const detection = el && insp ? insp.detectModule(el) : null;
      const target = detection && detection.el ? detection.el : el;
      const dump = target && insp ? insp.dumpComputed(target) : null;
      const tags = target && insp ? insp.tagSummary(target) : null;
      return {
        kind: (kindEl && kindEl.value) || (detection && detection.module && detection.module.kind) || "module",
        title:
          (titleEl && titleEl.value.trim()) ||
          (detection && detection.module && detection.module.name) ||
          (dump && dump.tag) ||
          "selection",
        tags: String((tagsEl && tagsEl.value) || "")
          .split(",")
          .map(function (t) {
            return t.trim();
          })
          .filter(Boolean),
        sourceProject: targetProject,
        html: target ? String(target.outerHTML || "").slice(0, 20000) : "",
        css: target && insp ? insp.dumpComputedCss(target) : "",
        cssPath: dump ? dump.path : "",
        tagSummary: tags,
        computed: dump
          ? {
              position: dump.position,
              zIndex: dump.zIndex,
              display: dump.display,
              box: dump.box,
              path: dump.path,
              tag: dump.tag,
            }
          : null,
        layout: dump
          ? {
              sticky: dump.position === "sticky" || dump.position === "fixed",
              position: dump.position || "static",
              edge: "top",
              offset: "0px",
              zIndex:
                dump.zIndex && dump.zIndex !== "auto"
                  ? parseInt(dump.zIndex, 10) || 8
                  : 8,
              defaults: {
                top: "0px",
                left: dump.box && dump.box.x != null ? dump.box.x + "px" : null,
                width: dump.box && dump.box.w != null ? dump.box.w + "px" : null,
              },
            }
          : null,
        module: detection && detection.module
          ? {
              name: detection.module.name,
              kind: detection.module.kind,
              score: detection.module.score,
              path: detection.module.path,
              children: (detection.children || []).map(function (c) {
                return c.name;
              }),
            }
          : null,
        prompt: (promptEl && promptEl.value) || "",
        screenshots: screenshots.map(function (s) {
          return { name: s.name, dataUrl: s.dataUrl };
        }),
      };
    }

    function buildPromptIntoUi(forceBuild) {
      const root = document.getElementById(ROOT_ID);
      if (!root) return "";
      const ta = root.querySelector("[data-prompt]");
      const insp = inspect();
      if (!insp) return "";
      const intent = (root.querySelector("[data-intent]") || {}).value || "fix";
      const note = (root.querySelector("[data-note]") || {}).value || "";
      const el = selectedEl();
      const text = insp.buildPrompt({
        el: el,
        intent: intent,
        note: note,
        html: el ? String(el.outerHTML || "").slice(0, 4000) : "",
        css: el ? insp.dumpComputedCss(el) : "",
        path: el ? insp.cssPathFor(el) : "",
        screenshots: screenshots,
      });
      if (ta && (forceBuild || !ta.value.trim())) ta.value = text;
      else if (ta && forceBuild) ta.value = text;
      return text;
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.resolve();
    }

    function bindUi(root) {
      root.addEventListener("click", function (ev) {
        const close = ev.target.closest("[data-flyin-close]");
        if (close) {
          closeFlyin();
          return;
        }
        const tab = ev.target.closest("[data-tab]");
        if (tab) {
          setTab(tab.getAttribute("data-tab"));
          return;
        }
        const del = ev.target.closest("[data-shot-del]");
        if (del) {
          screenshots.splice(Number(del.getAttribute("data-shot-del")), 1);
          renderShots();
          return;
        }
        const act = ev.target.closest("[data-act]");
        if (!act) return;
        const name = act.getAttribute("data-act");
        if (name === "pick") togglePick();
        else if (name === "parent" && picker) picker.selectParent();
        else if (name === "child" && picker) picker.selectChild();
        else if (name === "refresh-analyse") refreshAnalyse();
        else if (name === "pick-module") selectDetectedModule();
        else if (name === "copy-css") {
          const el = selectedEl();
          const insp = inspect();
          const detection = el && insp ? insp.detectModule(el) : null;
          const target = detection && detection.el ? detection.el : el;
          if (target && insp) copyText(insp.dumpComputedCss(target)).then(function () {
            setStatus("CSS kopiert" + (detection && detection.module ? " · Feature" : ""));
          });
        } else if (name === "copy-html") {
          const el = selectedEl();
          const insp = inspect();
          const detection = el && insp ? insp.detectModule(el) : null;
          const target = detection && detection.el ? detection.el : el;
          if (target) copyText(target.outerHTML).then(function () {
            setStatus("HTML kopiert" + (detection && detection.module ? " · Feature" : ""));
          });
        } else if (name === "capture") captureShot();
        else if (name === "build-prompt") {
          buildPromptIntoUi(true);
          setStatus("Prompt gebaut");
        } else if (name === "copy-prompt") {
          const ta = root.querySelector("[data-prompt]");
          copyText((ta && ta.value) || "").then(function () {
            setStatus("Prompt kopiert");
          });
        } else if (name === "create") createFromSelection();
      });
    }

    function isInsideFlyinChrome(el) {
      if (!el || !el.closest) return false;
      return !!(
        el.closest("#" + ROOT_ID + " .cursed-flyin-card") ||
        el.closest("#" + ROOT_ID + " .cursed-flyin-resizer") ||
        el.closest("#" + ICON_ID) ||
        el.closest("#cursedInspectHighlight")
      );
    }

    function onOutsidePointerDown(ev) {
      if (!open) return;
      if (picker && picker.isPicking && picker.isPicking()) return;
      if (isInsideFlyinChrome(ev.target)) return;
      closeFlyin();
    }

    function bindOutsideClose() {
      document.addEventListener("pointerdown", onOutsidePointerDown, true);
    }

    function unbindOutsideClose() {
      document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    }

    function unbindPickGuard() {
      document.removeEventListener("click", onPickGuardClick, true);
    }

    function onPickGuardClick(ev) {
      if (!picker || !picker.isPicking || !picker.isPicking()) return;
      const t = ev.target;
      if (t && t.closest && t.closest("#" + ROOT_ID + ", #" + ICON_ID + ", #cursedInspectHighlight")) {
        return;
      }
      // After picker onClick (same capture phase / next tick): force pipette off.
      setTimeout(function () {
        if (!picker) return;
        if (picker.isPicking && picker.isPicking()) picker.stop();
        unbindPickGuard();
        refreshElement();
        refreshAnalyse();
        if (picker.getSelected && picker.getSelected()) {
          setTab("analyse");
          setStatus("Element gewählt");
        }
      }, 0);
    }

    function bindPickGuard() {
      unbindPickGuard();
      document.addEventListener("click", onPickGuardClick, true);
    }

    function makePicker() {
      const insp = inspect();
      if (!insp) return null;
      return insp.createPicker({
        ignore: function (el) {
          return !!(el.closest && el.closest("#" + ROOT_ID + ", #" + ICON_ID));
        },
        onSelect: function () {
          refreshElement();
          refreshAnalyse();
          if (picker && picker.isPicking && picker.isPicking()) return;
          unbindPickGuard();
          setTab("analyse");
          setStatus("Element gewählt");
        },
        onHover: function () {},
      });
    }

    function togglePick() {
      const insp = inspect();
      if (!insp) {
        setStatus("Inspect-Feature fehlt", true);
        return;
      }
      if (!picker) picker = makePicker();
      if (!picker) {
        setStatus("Inspect-Feature fehlt", true);
        return;
      }
      const was = !!(picker.isPicking && picker.isPicking());
      picker.toggle();
      const now = !!(picker.isPicking && picker.isPicking());
      if (now && !was) bindPickGuard();
      else if (!now && was) unbindPickGuard();
      syncPickingUi();
      refreshElement();
    }

    function captureShot() {
      const el = selectedEl();
      const insp = inspect();
      if (!el || !insp) {
        setStatus("Zuerst ein Element wählen", true);
        return;
      }
      if (screenshots.length >= MAX_SHOTS) {
        setStatus("Maximal " + MAX_SHOTS + " Screenshots", true);
        return;
      }
      setStatus("Aufnahme…");
      insp
        .captureElement(el)
        .then(function (shot) {
          screenshots.push(shot);
          renderShots();
          setStatus(shot.fallback ? "Platzhalter-Aufnahme" : "Screenshot gespeichert");
          setTab("shots");
        })
        .catch(function (err) {
          setStatus(String(err.message || err), true);
        });
    }

    function createFromSelection() {
      const payload = selectionPayload();
      if (!payload.html && !payload.css && !payload.screenshots.length) {
        setStatus("Nichts zum Anlegen — Element wählen", true);
        return;
      }
      setStatus("Lege an…");
      api("/api/packages/from-selection", { method: "POST", body: payload })
        .then(function (data) {
          const id = data.packageId || (data.package && data.package.id) || "";
          setStatus("Angelegt" + (id ? " · " + id : ""));
        })
        .catch(function (err) {
          setStatus(String(err.message || err), true);
        });
    }

    function openFlyin() {
      const root = ensureDom();
      root.hidden = false;
      requestAnimationFrame(function () {
        root.classList.add("is-open");
      });
      document.body.classList.add("has-cursed-flyin");
      open = true;
      unbindOutsideClose();
      bindOutsideClose();
      syncPickingUi();
    }

    function closeFlyin() {
      const root = document.getElementById(ROOT_ID);
      if (root) {
        root.classList.remove("is-open", "is-picking");
        root.hidden = true;
      }
      document.body.classList.remove("has-cursed-flyin");
      if (picker && picker.isPicking && picker.isPicking()) picker.stop();
      unbindPickGuard();
      unbindOutsideClose();
      open = false;
    }

    function toggle() {
      if (open) closeFlyin();
      else openFlyin();
    }

    function onKey(ev) {
      if (ev.key === "Escape" && open) {
        closeFlyin();
        return;
      }
      const spec = parseShortcut(settings.shortcut || "Alt+Shift+F");
      if (matchShortcut(ev, spec)) {
        ev.preventDefault();
        toggle();
      }
    }

    function applySettings(next) {
      if (next && typeof next === "object") {
        settings = Object.assign(settings, next);
      }
      syncIcon();
    }

    function fetchSettings() {
      return api("/api/cursed-plugin/settings")
        .then(function (data) {
          const raw = data && data.settings;
          const hasFlyin = !!(raw && Object.prototype.hasOwnProperty.call(raw, "flyin"));
          const fy = hasFlyin ? raw.flyin || {} : null;
          if (fy) {
            applySettings(fy);
          } else {
            /* Alte Server-Version ohne flyin-Block: Overlay trotzdem erlauben */
            applySettings({
              enabled: true,
              injectInProjects: true,
              ideOverlay: true,
            });
          }
          if (raw && raw.cursedUrl && !opts.baseUrl) {
            baseUrl = normalizeBase(raw.cursedUrl);
          }
          return settings;
        })
        .catch(function () {
          return settings;
        });
    }

    function mount() {
      if (!isBrowser()) return api;
      loadCss((dir || scriptDir()) + "../css/cursed-flyin.css");
      return ensureInspect(dir || scriptDir()).then(function () {
        ensureDom();
        document.addEventListener("keydown", onKey, true);
        if (startOpen) openFlyin();
        return apiPublic;
      });
    }

    const apiPublic = {
      version: VERSION,
      mount: mount,
      open: openFlyin,
      close: closeFlyin,
      toggle: toggle,
      applySettings: applySettings,
      fetchSettings: fetchSettings,
      setTargetProject: function (p) {
        targetProject = String(p || "").trim();
      },
      getTargetProject: function () {
        return targetProject;
      },
      destroy: function () {
        document.removeEventListener("keydown", onKey, true);
        unbindPickGuard();
        unbindOutsideClose();
        if (picker) picker.destroy();
        const root = document.getElementById(ROOT_ID);
        if (root) root.remove();
        const icon = document.getElementById(ICON_ID);
        if (icon) icon.remove();
        if (mountedInstance === apiPublic) mountedInstance = null;
      },
    };
    return apiPublic;
  }

  function autoMount(options) {
    if (!isBrowser()) return Promise.resolve(null);
    if (mountedInstance) return Promise.resolve(mountedInstance);
    const opts = options && typeof options === "object" ? options : {};
    const inst = create(opts);
    mountedInstance = inst;
    return inst.fetchSettings().then(function (settings) {
      if (!opts.force && !settings.enabled) {
        inst.destroy();
        mountedInstance = null;
        return null;
      }
      if (!opts.force && opts.requireInject !== false && settings.injectInProjects === false && !opts.ide) {
        inst.destroy();
        mountedInstance = null;
        return null;
      }
      return inst.mount().then(function () {
        return inst;
      });
    });
  }

  return {
    version: VERSION,
    DEFAULT_BASE: DEFAULT_BASE,
    create: create,
    autoMount: autoMount,
  };
});
