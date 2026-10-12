"use strict";

/**
 * CursedBridge — Drop-in Client für neue Projekte
 *
 * Verbindet ein Host-Projekt mit dem laufenden Cursed-Server (Default :6190),
 * listet analysierte Features, macht sie für die KI auswählbar und
 * injiziert sie per API in das Zielprojekt.
 *
 * Einbindung:
 *   <script src="packages/cursed-bridge/assets/js/cursed-bridge.js"></script>
 *   <script>
 *     const cursed = CursedBridge.create({
 *       baseUrl: "http://127.0.0.1:6190",
 *       targetProject: "/mnt/quicky2/Cursor/MeinNeuesProjekt",
 *     });
 *     await cursed.mountPicker("#cursed-modules");
 *   </script>
 *
 * KI-Kurzflow:
 *   1. prompt = await cursed.catalogPrompt({ query: "ui", limit: 40 })
 *   2. Modell wählt packageIds
 *   3. await cursed.select(ids); await cursed.inject()
 *   oder: await cursed.scaffold({ name: "MeinApp", packageIds: ids })
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CursedBridge = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_BASE = "http://127.0.0.1:6190";
  const STORAGE_PREFIX = "cursed-bridge-selection:";
  const VERSION = "1.0.0";
  let lastBridgeOpts = { baseUrl: DEFAULT_BASE, targetProject: "" };

  function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  function normalizeBase(url) {
    const raw = String(url || "").trim();
    if (!raw) {
      if (isBrowser() && location.protocol !== "file:") return "";
      return DEFAULT_BASE;
    }
    return raw.replace(/\/+$/, "");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function uniq(arr) {
    const seen = Object.create(null);
    const out = [];
    (arr || []).forEach(function (x) {
      const k = String(x || "").trim();
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(k);
    });
    return out;
  }

  function packageLabel(pkg) {
    return String((pkg && (pkg.title || pkg.name || pkg.id)) || "").trim() || "—";
  }

  function packageMatches(pkg, query, tags) {
    if (tags && tags.length) {
      const pt = (pkg.tags || []).map(norm);
      const ok = tags.some(function (t) {
        return pt.indexOf(norm(t)) >= 0;
      });
      if (!ok) return false;
    }
    const q = norm(query);
    if (!q) return true;
    const hay = norm(
      [pkg.id, pkg.name, pkg.title, pkg.description, (pkg.tags || []).join(" "), pkg.sourceProject || ""].join(" ")
    );
    return hay.indexOf(q) >= 0;
  }

  function summarizePackage(pkg) {
    return {
      id: pkg.id,
      name: pkg.name || "",
      title: packageLabel(pkg),
      description: String(pkg.description || "").trim(),
      tags: Array.isArray(pkg.tags) ? pkg.tags.slice() : [],
      stack: pkg.stack || null,
      fileCount: Array.isArray(pkg.files) ? pkg.files.length : 0,
      source: pkg.source || "",
      sourceProject: pkg.sourceProject || "",
      dependencies: Array.isArray(pkg.dependencies) ? pkg.dependencies.slice() : [],
    };
  }

  function create(options) {
    const opts = options && typeof options === "object" ? options : {};
    let baseUrl = normalizeBase(opts.baseUrl != null ? opts.baseUrl : opts.cursedUrl);
    let targetProject = String(opts.targetProject || opts.target || "").trim();
    lastBridgeOpts = { baseUrl: baseUrl, targetProject: targetProject };
    const storageKey =
      String(opts.storageKey || STORAGE_PREFIX + (targetProject || "default")).trim() ||
      STORAGE_PREFIX + "default";
    let cache = null;
    let selection = loadSelection(storageKey);

    function api(path, init) {
      const url = baseUrl + path;
      const cfg = Object.assign({ credentials: "same-origin" }, init || {});
      if (cfg.body && typeof cfg.body === "object" && !(cfg.body instanceof FormData)) {
        cfg.headers = Object.assign({ "Content-Type": "application/json" }, cfg.headers || {});
        cfg.body = JSON.stringify(cfg.body);
      }
      return fetch(url, cfg).then(function (res) {
        return res.json().then(
          function (data) {
            if (!res.ok) {
              const err = new Error((data && data.error) || res.statusText || "HTTP " + res.status);
              err.status = res.status;
              err.data = data;
              throw err;
            }
            return data;
          },
          function () {
            if (!res.ok) throw new Error(res.statusText || "HTTP " + res.status);
            return {};
          }
        );
      });
    }

    function loadSelection(key) {
      if (!isBrowser()) return [];
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? uniq(parsed.map(String)) : [];
      } catch (_) {
        return [];
      }
    }

    function persistSelection() {
      if (!isBrowser()) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(selection));
      } catch (_) {}
    }

    function setBaseUrl(url) {
      baseUrl = normalizeBase(url);
      cache = null;
      return baseUrl;
    }

    function getBaseUrl() {
      return baseUrl || DEFAULT_BASE;
    }

    function setTargetProject(path) {
      targetProject = String(path || "").trim();
      return targetProject;
    }

    function getTargetProject() {
      return targetProject;
    }

    function ping() {
      return api("/api/packages").then(function (data) {
        const packages = Array.isArray(data.packages) ? data.packages : [];
        return { ok: true, baseUrl: getBaseUrl(), count: packages.length };
      });
    }

    function list(filter) {
      const f = filter && typeof filter === "object" ? filter : {};
      const q = f.project ? "?project=" + encodeURIComponent(f.project) : "";
      return api("/api/packages" + q).then(function (data) {
        let packages = Array.isArray(data.packages) ? data.packages : [];
        cache = packages;
        const tags = f.tags
          ? Array.isArray(f.tags)
            ? f.tags
            : String(f.tags)
                .split(/[,|]/)
                .map(function (s) {
                  return s.trim();
                })
                .filter(Boolean)
          : null;
        if (f.query || (tags && tags.length)) {
          packages = packages.filter(function (p) {
            return packageMatches(p, f.query, tags);
          });
        }
        if (f.sourceProject) {
          const sp = norm(f.sourceProject);
          packages = packages.filter(function (p) {
            return norm(p.sourceProject || "").indexOf(sp) >= 0;
          });
        }
        const limit = f.limit > 0 ? f.limit : 0;
        if (limit) packages = packages.slice(0, limit);
        return packages.map(summarizePackage);
      });
    }

    function get(id) {
      const pid = String(id || "").trim();
      if (!pid) return Promise.reject(new Error("packageId fehlt"));
      return api("/api/packages/" + encodeURIComponent(pid)).then(function (data) {
        return data.package || data;
      });
    }

    function find(query) {
      const q = String(query || "").trim();
      if (!q) return Promise.resolve(null);
      const from = cache
        ? Promise.resolve(cache)
        : api("/api/packages").then(function (data) {
            cache = Array.isArray(data.packages) ? data.packages : [];
            return cache;
          });
      return from.then(function (packages) {
        const nq = norm(q);
        let hit = packages.find(function (p) {
          return norm(p.id) === nq;
        });
        if (hit) return summarizePackage(hit);
        hit = packages.find(function (p) {
          return norm(p.name || "") === nq || norm(p.title || "") === nq;
        });
        if (hit) return summarizePackage(hit);
        hit = packages.find(function (p) {
          const hay = norm([p.id, p.name, p.title].join(" "));
          return hay.indexOf(nq) >= 0;
        });
        return hit ? summarizePackage(hit) : null;
      });
    }

    function docs(subject, extra) {
      const body = Object.assign({}, extra || {});
      if (typeof subject === "string") {
        body.packageId = subject;
      } else if (subject && typeof subject === "object") {
        if (subject.packageId) body.packageId = subject.packageId;
        else if (subject.package) body.package = subject.package;
        else if (subject.feature) {
          body.feature = subject.feature;
          if (subject.projectPath) body.projectPath = subject.projectPath;
        } else if (subject.id) body.packageId = subject.id;
        else Object.assign(body, subject);
      } else {
        return Promise.reject(new Error("docs: packageId oder feature erforderlich"));
      }
      return api("/api/packages/docs", { method: "POST", body: body });
    }

    function context(ids) {
      const packageIds = uniq(
        (Array.isArray(ids) ? ids : ids != null ? [ids] : selection).map(String)
      );
      if (!packageIds.length) return Promise.reject(new Error("Keine packageIds"));
      return api("/api/packages/to-model", {
        method: "POST",
        body: { packageIds: packageIds },
      });
    }

    function exportZip(subject, extra) {
      const body = Object.assign({}, extra || {});
      if (typeof subject === "string") body.packageId = subject;
      else if (subject && subject.packageId) body.packageId = subject.packageId;
      else if (subject && subject.id) body.packageId = subject.id;
      else if (subject && subject.feature) {
        body.feature = subject.feature;
        if (subject.projectPath) body.projectPath = subject.projectPath;
      } else if (subject) Object.assign(body, subject);
      if (body.includeDocs == null) body.includeDocs = true;
      return api("/api/packages/export-zip", { method: "POST", body: body });
    }

    function analyzeProject(opts) {
      const o = opts && typeof opts === "object" ? opts : {};
      const path = String(o.path || o.projectPath || targetProject || "").trim();
      if (!path) return Promise.reject(new Error("projectPath fehlt"));
      return api("/api/analyze-project", {
        method: "POST",
        body: { path: path, scope: o.scope || "all" },
      }).then(function (data) {
        return api("/api/packages/plan-heuristic", {
          method: "POST",
          body: { projectPath: path, path: path },
        }).then(function (plan) {
          return { analyze: data, plan: plan };
        });
      });
    }

    function projectStatus(opts) {
      const o = opts && typeof opts === "object" ? opts : {};
      const path = String(o.path || o.projectPath || targetProject || "").trim();
      if (!path) return Promise.reject(new Error("projectPath fehlt"));
      return api("/api/packages/project-status?path=" + encodeURIComponent(path));
    }

    function prepareImplementation(spec) {
      const s = spec && typeof spec === "object" ? spec : {};
      const target = String(s.targetProject || s.target || targetProject || "").trim();
      if (!target) return Promise.reject(new Error("targetProject fehlt"));
      const packageIds = uniq(
        (s.packageIds || s.packages || selection || []).map(function (x) {
          return typeof x === "string" ? x : x && x.id;
        })
      );
      const body = {
        targetProject: target,
        packageIds: packageIds,
        features: s.features || [],
        deliveryMode: s.deliveryMode,
        analyzeFirst: !!s.analyzeFirst,
        requireBridge: s.requireBridge !== false,
        options: s.options || {},
      };
      return api("/api/packages/prepare-implementation", { method: "POST", body: body });
    }

    function implementationPrompt(opts) {
      const o = opts && typeof opts === "object" ? opts : {};
      const path = String(o.path || o.projectPath || targetProject || "").trim();
      if (!path) return Promise.reject(new Error("projectPath fehlt"));
      return api("/api/packages/implementation-prompt?path=" + encodeURIComponent(path));
    }

    function getSelection() {
      return selection.slice();
    }

    function select(ids, mode) {
      const listIds = uniq((Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean));
      if (mode === "add") {
        selection = uniq(selection.concat(listIds));
      } else if (mode === "remove") {
        const drop = Object.create(null);
        listIds.forEach(function (id) {
          drop[id] = true;
        });
        selection = selection.filter(function (id) {
          return !drop[id];
        });
      } else {
        selection = listIds;
      }
      persistSelection();
      return selection.slice();
    }

    function toggle(id) {
      const pid = String(id || "").trim();
      if (!pid) return selection.slice();
      if (selection.indexOf(pid) >= 0) return select(pid, "remove");
      return select(pid, "add");
    }

    function clearSelection() {
      selection = [];
      persistSelection();
      return selection.slice();
    }

    function inject(ids, injectOpts) {
      const io = injectOpts && typeof injectOpts === "object" ? injectOpts : {};
      const target = String(io.targetProject || io.target || targetProject || "").trim();
      if (!target) return Promise.reject(new Error("targetProject fehlt (create({ targetProject }) oder inject opts)"));
      const packageIds = uniq(
        (ids != null ? (Array.isArray(ids) ? ids : [ids]) : selection).map(String).filter(Boolean)
      );
      if (!packageIds.length && !io.zipPath) {
        return Promise.reject(new Error("Keine Packages ausgewählt"));
      }

      if (io.zipPath) {
        return api("/api/packages/inject", {
          method: "POST",
          body: {
            zipPath: io.zipPath,
            targetProject: target,
            overwrite: !!io.overwrite,
          },
        });
      }

      return api("/api/packages/inject", {
        method: "POST",
        body: {
          packageIds: packageIds,
          targetProject: target,
          subdir: io.subdir,
          overwrite: !!io.overwrite,
          resolveDeps: io.resolveDeps !== false,
        },
      });
    }

    function createWorkspace(name, createOpts) {
      const co = createOpts && typeof createOpts === "object" ? createOpts : {};
      const clean = String(name || "").trim();
      if (!clean) return Promise.reject(new Error("name fehlt"));
      return api("/api/local-ai/workspace/create", {
        method: "POST",
        body: {
          name: clean,
          open: co.open !== false,
          initGit: !!co.initGit,
        },
      }).then(function (data) {
        const path =
          (data.project && (data.project.absolutePath || data.project.path)) ||
          data.path ||
          "";
        if (path) setTargetProject(path);
        return data;
      });
    }

    function scaffold(spec) {
      const s = spec && typeof spec === "object" ? spec : {};
      const ids = uniq(
        (s.packageIds || s.packages || selection || []).map(function (x) {
          return typeof x === "string" ? x : x && x.id;
        })
      );
      const storeIds = uniq(
        (s.storeItemIds || []).map(function (x) {
          return typeof x === "string" ? x : x && x.id;
        })
      );
      return api("/api/packages/scaffold-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name || undefined,
          packageIds: ids,
          storeItemIds: storeIds,
          targetProject: s.targetProject || targetProject || undefined,
          parentPath: s.parentPath || undefined,
          inPlace: s.inPlace != null ? !!s.inPlace : !!(s.targetProject || targetProject) && !s.name,
          createSubfolder: !!s.createSubfolder,
          websiteTemplate: s.websiteTemplate !== false,
          supplementalPrompt: s.prompt || s.supplementalPrompt || "",
          overwrite: !!s.overwrite,
          prepareBriefing: s.prepareBriefing !== false,
          agentHost: "bionic",
          skipCursor: true,
          syncBionicMcp: s.syncBionicMcp !== false,
        }),
      }).then(function (data) {
        if (data && data.targetProject) setTargetProject(data.targetProject);
        return data;
      });
    }

    /**
     * Markdown-Katalog für KI-Prompts: kompakte Liste zum Auswählen.
     */
    function catalogPrompt(filter) {
      const f = Object.assign({ limit: 60 }, filter || {});
      return list(f).then(function (packages) {
        const lines = [
          "# Cursed Feature-Katalog",
          "",
          "Wähle passende packageIds für das neue Projekt.",
          "Antworte mit JSON: {\"packageIds\":[\"id1\",\"id2\"],\"reason\":\"…\"}",
          "",
        ];
        packages.forEach(function (p, i) {
          const tags = (p.tags || []).length ? " [" + p.tags.join(", ") + "]" : "";
          const desc = p.description ? " — " + p.description.replace(/\s+/g, " ").slice(0, 160) : "";
          lines.push(
            (i + 1) +
              ". `" +
              p.id +
              "` · **" +
              p.title +
              "**" +
              tags +
              " · " +
              p.fileCount +
              " Dateien" +
              desc
          );
        });
        if (!packages.length) lines.push("_Keine Features gefunden._");
        return {
          ok: true,
          markdown: lines.join("\n"),
          packages: packages,
          count: packages.length,
        };
      });
    }

    /**
     * Tool-Deskriptoren für Agenten (Cursor/Codex/Jarvis-ähnlich).
     */
    function aiTools() {
      return [
        {
          name: "cursed_list_modules",
          description: "Listet analysierte Cursed-Features (optional query/tags).",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              limit: { type: "number" },
              project: { type: "string", description: "Quellprojekt-Pfad filtern" },
            },
          },
        },
        {
          name: "cursed_module_docs",
          description: "Feinanalyse/Rebuild-Plan eines Packages (Tools, Dateien, plan).",
          parameters: {
            type: "object",
            properties: { packageId: { type: "string" } },
            required: ["packageId"],
          },
        },
        {
          name: "cursed_module_context",
          description: "Markdown-Kontext mehrerer Packages für die KI (to-model).",
          parameters: {
            type: "object",
            properties: {
              packageIds: { type: "array", items: { type: "string" } },
            },
            required: ["packageIds"],
          },
        },
        {
          name: "cursed_select_modules",
          description: "Setzt die lokale Feature-Auswahl (für Inject/Scaffold).",
          parameters: {
            type: "object",
            properties: {
              packageIds: { type: "array", items: { type: "string" } },
              mode: { type: "string", enum: ["replace", "add", "remove"] },
            },
            required: ["packageIds"],
          },
        },
        {
          name: "cursed_inject_modules",
          description: "Injiziert ausgewählte (oder angegebene) Packages in targetProject.",
          parameters: {
            type: "object",
            properties: {
              packageIds: { type: "array", items: { type: "string" } },
              targetProject: { type: "string" },
              overwrite: { type: "boolean" },
            },
          },
        },
        {
          name: "cursed_scaffold_project",
          description: "Legt optional Workspace an und injiziert gewählte Packages.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              packageIds: { type: "array", items: { type: "string" } },
              create: { type: "boolean" },
              targetProject: { type: "string" },
            },
          },
        },
        {
          name: "cursed_analyze_project",
          description: "Analysiert ein Projekt und plant Features (Heuristik) für die Bibliothek.",
          parameters: {
            type: "object",
            properties: {
              projectPath: { type: "string" },
              scope: { type: "string" },
            },
            required: ["projectPath"],
          },
        },
        {
          name: "cursed_prepare_implementation",
          description:
            "Erzeugt IMPLEMENTATION.md und optional data/ im Bridge-Implementierungsordner.",
          parameters: {
            type: "object",
            properties: {
              targetProject: { type: "string" },
              packageIds: { type: "array", items: { type: "string" } },
              deliveryMode: { type: "string", enum: ["promptOnly", "promptAndData"] },
              analyzeFirst: { type: "boolean" },
            },
          },
        },
      ];
    }

    function runAiTool(name, args) {
      const a = args && typeof args === "object" ? args : {};
      switch (String(name || "")) {
        case "cursed_list_modules":
          return list(a);
        case "cursed_module_docs":
          return docs(a.packageId || a.id);
        case "cursed_module_context":
          return context(a.packageIds || a.ids);
        case "cursed_select_modules":
          return Promise.resolve(select(a.packageIds || a.ids, a.mode === "replace" ? undefined : a.mode));
        case "cursed_inject_modules":
          return inject(a.packageIds || a.ids, a);
        case "cursed_scaffold_project":
          return scaffold(a);
        case "cursed_analyze_project":
          return analyzeProject(a);
        case "cursed_prepare_implementation":
          return prepareImplementation(a);
        case "cursed_catalog_prompt":
          return catalogPrompt(a);
        default:
          return Promise.reject(new Error("Unbekanntes Tool: " + name));
      }
    }

    function ensureCss() {
      if (!isBrowser()) return;
      if (document.querySelector('link[data-cursed-bridge-css="1"]')) return;
      const scripts = document.getElementsByTagName("script");
      let base = "";
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src || "";
        if (src.indexOf("cursed-bridge.js") >= 0) {
          base = src.replace(/assets\/js\/cursed-bridge\.js(\?.*)?$/, "");
          break;
        }
      }
      const href = (base || "packages/cursed-bridge/") + "assets/css/cursed-bridge.css";
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.cursedBridgeCss = "1";
      document.head.appendChild(link);
    }

    /**
     * Einfacher Feature-Picker (Suche + Checkboxen + Inject).
     * mountPicker("#el") oder mountPicker(element)
     */
    function mountPicker(target, pickerOpts) {
      if (!isBrowser()) return Promise.reject(new Error("mountPicker nur im Browser"));
      const po = pickerOpts && typeof pickerOpts === "object" ? pickerOpts : {};
      const el =
        typeof target === "string" ? document.querySelector(target) : target;
      if (!el) return Promise.reject(new Error("Picker-Ziel nicht gefunden"));

      ensureCss();
      el.classList.add("cursed-bridge");
      const pickerTitle = String(po.title || "Features").trim() || "Features";
      el.innerHTML =
        '<div class="cursed-bridge-head">' +
        '<strong class="cursed-bridge-title">' +
        escapeHtml(pickerTitle) +
        "</strong>" +
        '<span class="cursed-bridge-status muted" data-cb-status>Lädt…</span>' +
        "</div>" +
        '<div class="cursed-bridge-toolbar">' +
        '<input type="search" class="cursed-bridge-search" data-cb-search placeholder="Suche Features…" />' +
        '<input type="text" class="cursed-bridge-tags" data-cb-tags placeholder="Tags (ui,api,…)" />' +
        '<button type="button" class="cursed-bridge-btn" data-cb-refresh>Aktualisieren</button>' +
        "</div>" +
        '<div class="cursed-bridge-meta muted" data-cb-meta></div>' +
        '<div class="cursed-bridge-list" data-cb-list role="listbox" aria-label="Features"></div>' +
        '<div class="cursed-bridge-actions">' +
        '<button type="button" class="cursed-bridge-btn cursed-bridge-btn-primary" data-cb-inject>Auswahl injizieren</button>' +
        '<button type="button" class="cursed-bridge-btn" data-cb-context>KI-Kontext kopieren</button>' +
        '<button type="button" class="cursed-bridge-btn" data-cb-clear>Auswahl leeren</button>' +
        "</div>" +
        '<pre class="cursed-bridge-log muted" data-cb-log hidden></pre>';

      const statusEl = el.querySelector("[data-cb-status]");
      const metaEl = el.querySelector("[data-cb-meta]");
      const listEl = el.querySelector("[data-cb-list]");
      const logEl = el.querySelector("[data-cb-log]");
      const searchEl = el.querySelector("[data-cb-search]");
      const tagsEl = el.querySelector("[data-cb-tags]");
      let items = [];

      function setStatus(text, isErr) {
        statusEl.textContent = text || "";
        statusEl.classList.toggle("is-error", !!isErr);
      }

      function setLog(text) {
        if (!text) {
          logEl.hidden = true;
          logEl.textContent = "";
          return;
        }
        logEl.hidden = false;
        logEl.textContent = text;
      }

      function renderList() {
        const selected = Object.create(null);
        selection.forEach(function (id) {
          selected[id] = true;
        });
        if (!items.length) {
          listEl.innerHTML = '<p class="muted cursed-bridge-empty">Keine Features.</p>';
          metaEl.textContent = "0 Features · Auswahl " + selection.length;
          return;
        }
        listEl.innerHTML = items
          .map(function (p) {
            const checked = selected[p.id] ? " checked" : "";
            const tags = (p.tags || [])
              .slice(0, 6)
              .map(function (t) {
                return '<span class="cursed-bridge-tag">' + escapeHtml(t) + "</span>";
              })
              .join("");
            return (
              '<label class="cursed-bridge-item" role="option" aria-selected="' +
              (selected[p.id] ? "true" : "false") +
              '">' +
              '<input type="checkbox" data-cb-id="' +
              escapeHtml(p.id) +
              '"' +
              checked +
              " />" +
              '<span class="cursed-bridge-item-body">' +
              '<span class="cursed-bridge-item-title">' +
              escapeHtml(p.title) +
              "</span>" +
              '<code class="cursed-bridge-item-id">' +
              escapeHtml(p.id) +
              "</code>" +
              (p.description
                ? '<span class="cursed-bridge-item-desc">' +
                  escapeHtml(p.description.slice(0, 140)) +
                  "</span>"
                : "") +
              '<span class="cursed-bridge-item-meta">' +
              p.fileCount +
              " Dateien " +
              tags +
              "</span>" +
              "</span></label>"
            );
          })
          .join("");
        metaEl.textContent =
          items.length +
          " Features · Auswahl " +
          selection.length +
          (targetProject ? " · → " + targetProject : "");
      }

      function refresh() {
        const query = (searchEl.value || "").trim();
        const tags = String(tagsEl.value || "")
          .split(/[,|]/)
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
        setStatus("Lädt…");
        return list({
          query: query,
          tags: tags,
          limit: po.limit || 200,
          project: po.project,
        })
          .then(function (pkgs) {
            items = pkgs;
            setStatus(getBaseUrl());
            renderList();
          })
          .catch(function (err) {
            items = [];
            renderList();
            setStatus((err && err.message) || "Fehler", true);
          });
      }

      listEl.addEventListener("change", function (ev) {
        const input = ev.target && ev.target.closest ? ev.target.closest("input[data-cb-id]") : null;
        if (!input) return;
        const id = input.getAttribute("data-cb-id");
        if (input.checked) select(id, "add");
        else select(id, "remove");
        renderList();
      });

      let searchTimer = 0;
      function scheduleRefresh() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(refresh, 180);
      }
      searchEl.addEventListener("input", scheduleRefresh);
      tagsEl.addEventListener("input", scheduleRefresh);
      el.querySelector("[data-cb-refresh]").addEventListener("click", refresh);
      el.querySelector("[data-cb-clear]").addEventListener("click", function () {
        clearSelection();
        renderList();
        setLog("");
      });
      el.querySelector("[data-cb-inject]").addEventListener("click", function () {
        setStatus("Injiziere…");
        inject(null, { overwrite: !!po.overwrite })
          .then(function (res) {
            const ok = (res.results || []).filter(function (r) {
              return r.ok;
            }).length;
            const fail = (res.results || []).length - ok;
            setStatus("Fertig · " + ok + " ok" + (fail ? " · " + fail + " Fehler" : ""));
            setLog(JSON.stringify(res, null, 2));
          })
          .catch(function (err) {
            setStatus((err && err.message) || "Inject fehlgeschlagen", true);
          });
      });
      el.querySelector("[data-cb-context]").addEventListener("click", function () {
        context()
          .then(function (data) {
            const text = (data && data.context) || "";
            if (navigator.clipboard && navigator.clipboard.writeText) {
              return navigator.clipboard.writeText(text).then(function () {
                setStatus("KI-Kontext kopiert (" + (data.chars || text.length) + " Zeichen)");
                setLog(text.slice(0, 2000) + (text.length > 2000 ? "\n…" : ""));
              });
            }
            setLog(text);
            setStatus("KI-Kontext geladen");
          })
          .catch(function (err) {
            setStatus((err && err.message) || "Kontext fehlgeschlagen", true);
          });
      });

      return refresh().then(function () {
        return {
          el: el,
          refresh: refresh,
          getSelection: getSelection,
        };
      });
    }

    return {
      version: VERSION,
      ping: ping,
      setBaseUrl: setBaseUrl,
      getBaseUrl: getBaseUrl,
      setTargetProject: setTargetProject,
      getTargetProject: getTargetProject,
      list: list,
      get: get,
      find: find,
      docs: docs,
      context: context,
      exportZip: exportZip,
      analyzeProject: analyzeProject,
      projectStatus: projectStatus,
      prepareImplementation: prepareImplementation,
      implementationPrompt: implementationPrompt,
      getSelection: getSelection,
      select: select,
      toggle: toggle,
      clearSelection: clearSelection,
      inject: inject,
      createWorkspace: createWorkspace,
      scaffold: scaffold,
      catalogPrompt: catalogPrompt,
      aiTools: aiTools,
      runAiTool: runAiTool,
      mountPicker: mountPicker,
      mountFlyin: mountFlyin,
    };
  }

  function bridgeScriptDir() {
    if (!isBrowser()) return "";
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || "";
      if (/cursed-bridge\.js/.test(src)) return src.replace(/[^/]+$/, "");
    }
    return "";
  }

  function flyinScriptUrl() {
    const dir = bridgeScriptDir();
    if (/cursed-bridge\/assets\/js\/?$/.test(dir)) {
      return dir.replace(/cursed-bridge\/assets\/js\/?$/, "cursed-flyin/assets/js/cursed-flyin.js");
    }
    if (/\/assets\/js\/?$/.test(dir)) {
      return dir.replace(/\/assets\/js\/?$/, "/packages/cursed-flyin/assets/js/cursed-flyin.js");
    }
    return dir.replace(/\/$/, "") + "/../../../cursed-flyin/assets/js/cursed-flyin.js";
  }

  function loadFlyinScript() {
    if (!isBrowser()) return Promise.resolve(null);
    if (window.CursedFlyin) return Promise.resolve(window.CursedFlyin);
    const src = flyinScriptUrl();
    return new Promise(function (resolve, reject) {
      const inspectSrc = src.replace(/cursed-flyin\.js$/, "cursed-element-inspect.js");
      function load(url) {
        return new Promise(function (res, rej) {
          if (document.querySelector('script[src="' + url + '"]')) {
            res();
            return;
          }
          const s = document.createElement("script");
          s.src = url;
          s.onload = function () {
            res();
          };
          s.onerror = function () {
            rej(new Error("Fly-in Script fehlt: " + url));
          };
          document.head.appendChild(s);
        });
      }
      load(inspectSrc)
        .catch(function () {})
        .then(function () {
          return load(src);
        })
        .then(function () {
          resolve(window.CursedFlyin || null);
        })
        .catch(reject);
    });
  }

  function autoMountFlyin(options) {
    if (!isBrowser()) return Promise.resolve(null);
    const o = options && typeof options === "object" ? options : {};
    const baseUrl = normalizeBase(
      o.baseUrl != null ? o.baseUrl : lastBridgeOpts.baseUrl || DEFAULT_BASE
    );
    const target =
      String(o.targetProject || lastBridgeOpts.targetProject || "").trim() ||
      (document.documentElement.getAttribute("data-cursed-project") || "");
    return loadFlyinScript().then(function (Flyin) {
      if (!Flyin) return null;
      return Flyin.autoMount({
        baseUrl: baseUrl,
        targetProject: target,
        force: !!o.force,
      });
    });
  }

  function mountFlyin(mountOpts) {
    return autoMountFlyin(mountOpts || {});
  }

  if (isBrowser()) {
    function bootFlyin() {
      autoMountFlyin({}).catch(function () {});
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootFlyin);
    } else {
      setTimeout(bootFlyin, 0);
    }
  }

  return {
    version: VERSION,
    DEFAULT_BASE: DEFAULT_BASE,
    create: create,
    autoMountFlyin: autoMountFlyin,
    loadFlyinScript: loadFlyinScript,
  };
});
