/* (c) 2026 Andrius Bubliauskas. All rights reserved.
   Tab bar behaviour for both new pages (classic script, no storage, no network requests).
   - Orion-81 page: old links (?lang=, ?maps=, ?tier=, or a #hash that is not on this page) go on to the Orion POC tab.
   - Orion POC page: the frame shows the frozen site with the page's own lang, maps and tier parameters and its hash.
   - Over http(s) the two tab links use clean addresses; from the disk they keep naming index.html. */
(function () {
  'use strict';

  var PASS = ['lang', 'maps', 'tier'];
  var nav = document.querySelector('nav.o81-tabs');
  var isPoc = document.body.classList.contains('o81-poc');
  var web = location.protocol === 'http:' || location.protocol === 'https:';
  var params = new URLSearchParams(location.search);

  function hasPassParam() {
    for (var i = 0; i < PASS.length; i++) {
      if (params.has(PASS[i])) return true;
    }
    return false;
  }

  function hashId() {
    var h = location.hash.slice(1);
    if (!h) return '';
    try { return decodeURIComponent(h); } catch (e) { return h; }
  }

  function tab(name) {
    return nav ? nav.querySelector('a.o81-tab[data-tab="' + name + '"]') : null;
  }

  if (!isPoc) {
    var id = hashId();
    if (hasPassParam() || (id && !document.getElementById(id))) {
      var target = new URL(web ? 'poc/' : 'poc/index.html', location.href);
      target.search = location.search;
      target.hash = location.hash;
      location.replace(target.href);
      return;
    }
  } else {
    var frame = document.querySelector('iframe.o81-poc-frame');
    var frameSrc = function () {
      var q = new URLSearchParams();
      PASS.forEach(function (k) {
        params.getAll(k).forEach(function (v) { q.append(k, v); });
      });
      var s = q.toString();
      return 'v1.1.0/index.html' + (s ? '?' + s : '') + location.hash;
    };
    if (frame) {
      var want = frameSrc();
      if (want !== frame.getAttribute('src')) frame.setAttribute('src', want);
      window.addEventListener('hashchange', function () {
        var next = frameSrc();
        if (next !== frame.getAttribute('src')) frame.setAttribute('src', next);
      });
    }
  }

  if (web) {
    var home = tab('orion-81');
    var poc = tab('poc');
    if (home) home.setAttribute('href', isPoc ? '../' : './');
    if (poc) poc.setAttribute('href', isPoc ? './' : 'poc/');
  }
})();
