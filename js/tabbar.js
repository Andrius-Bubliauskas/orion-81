/* (c) 2026 Andrius Bubliauskas. All rights reserved.
   Tab bar behaviour for the new pages (classic script, no storage, no network requests).
   - Home page: old links go on to where they now live. A link with ?lang=, ?maps= or ?tier=, or a fragment (#something) that is on no
     page of the new site (for example #ships), goes to the Orion POC tab. A fragment that used to be on the old Orion-81 page
     (#what, #road, #built, #how, #tests, #poc-note) goes to the same place on the devlog page.
   - Orion POC page: the frame shows the frozen site with the page's own lang, maps and tier parameters and its fragment.
   - Over http(s) the tab links use clean addresses (their data-clean value); from the disk they keep naming index.html. */
(function () {
  'use strict';

  var PASS = ['lang', 'maps', 'tier'];
  var MOVED = ['what', 'road', 'built', 'how', 'tests', 'poc-note'];
  var HOME_OLD = ['purpose', 'sharing', 'reading']; // sections of earlier front pages: the link stays on the front page
  var page = document.body.getAttribute('data-o81-page') || '';
  var isPoc = page === 'poc';
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

  if (page === 'home') {
    var id = hashId();
    if (hasPassParam() || (id && !document.getElementById(id) && HOME_OLD.indexOf(id) === -1)) {
      var base = (!hasPassParam() && MOVED.indexOf(id) !== -1) ? 'devlog/' : 'poc/';
      var target = new URL(web ? base : base + 'index.html', location.href);
      target.search = location.search;
      target.hash = location.hash;
      location.replace(target.href);
      return;
    }
  } else if (isPoc) {
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
    var links = document.querySelectorAll('a[data-clean]');
    for (var j = 0; j < links.length; j++) {
      links[j].setAttribute('href', links[j].getAttribute('data-clean'));
    }
  }
})();
