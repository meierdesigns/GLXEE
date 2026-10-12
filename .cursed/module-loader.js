/* Cursed module-loader — auto-generated. Loads only enabled modules. */
(function () {
  "use strict";
  var modules = [{"id":"cursed-bridge","title":"Cursed Bridge","base":"packages/cursed-bridge","styles":["assets/css/cursed-bridge.css"],"scripts":["assets/js/cursed-bridge.js"],"css":"assets/css/cursed-bridge.css","script":"assets/js/cursed-bridge.js","optional":true,"ui":[]},{"id":"cursed-flyin","title":"Cursed Fly-in Card","base":"packages/cursed-flyin","styles":["assets/css/cursed-flyin.css"],"scripts":["assets/js/cursed-flyin.js"],"css":"assets/css/cursed-flyin.css","script":"assets/js/cursed-flyin.js","optional":true,"ui":[]}];
  function abs(base, rel) {
    if (!rel) return '';
    if (/^(https?:|\/)/i.test(rel)) return rel;
    return (base.replace(/\/+$/, '') + '/' + rel.replace(/^\/+/, ''));
  }
  function loadCss(href) {
    if (!href) return;
    try {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    } catch (e) {}
  }
  function loadScript(src, optional) {
    if (!src) return;
    try {
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      if (optional) s.dataset.optional = '1';
      document.head.appendChild(s);
    } catch (e) {}
  }
  function adoptUi() {
    var host = window.CursedModuleHost || window.cfModuleHost;
    if (!host || typeof host.adoptPackageUi !== 'function') return;
    modules.forEach(function (m) {
      if (!m.ui || !m.ui.length) return;
      try { host.adoptPackageUi(m); } catch (e) {}
    });
    if (typeof host.refresh === 'function') host.refresh();
  }
  modules.forEach(function (m) {
    (m.styles || []).forEach(function (href) { loadCss(abs(m.base, href)); });
    (m.scripts || []).forEach(function (src) { loadScript(abs(m.base, src), m.optional !== false); });
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(adoptUi, 0); });
  } else {
    setTimeout(adoptUi, 0);
  }
  document.addEventListener('cf:module-host-ready', adoptUi);
  window.CursedModuleLoader = { modules: modules, adoptUi: adoptUi };
})();
