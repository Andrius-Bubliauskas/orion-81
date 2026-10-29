/* (c) 2026 Andrius Bubliauskas. All rights reserved.
   ?selftest for the new pages (home, devlog, Orchestration and Orion POC). Writes "SELFTEST PASS n/n" or "SELFTEST FAIL k/n" to the title
   and the details as JSON into <pre id="o81-selftest">. Does nothing without ?selftest. */
(function () {
  'use strict';

  if (!new URLSearchParams(location.search).has('selftest')) return;

  var checks = [];
  var info = {};

  function check(name, ok, detail) {
    var c = { name: name, ok: !!ok };
    if (detail !== undefined) c.detail = detail;
    checks.push(c);
  }

  // a wide table may scroll inside its own box (overflow-x auto or scroll on an ancestor): that is not a sideways scroll of the page
  function inScroller(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var ox = window.getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  }

  function noOverflow() {
    var w = document.documentElement.getBoundingClientRect().width;
    var wideNode = null;
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length && !wideNode; i++) {
      var r = all[i].getBoundingClientRect();
      if (r.width && r.right > window.innerWidth + 0.5 && !inScroller(all[i])) wideNode = all[i];
    }
    var x0 = window.scrollX, y0 = window.pageYOffset;
    window.scrollTo(100000, y0);
    var moved = window.scrollX;
    window.scrollTo(x0, y0);
    return {
      ok: w <= window.innerWidth + 0.5 && moved === 0 && !wideNode,
      detail: { doc: Math.round(w * 10) / 10, viewport: window.innerWidth, scrolledX: moved,
        wide: wideNode ? (wideNode.tagName + '.' + wideNode.className) : null }
    };
  }

  function barCheck(current) {
    var nav = document.querySelector('nav.o81-tabs');
    var links = nav ? nav.querySelectorAll('a.o81-tab') : [];
    var order = Array.prototype.map.call(links, function (a) { return a.getAttribute('data-tab') + '=' + a.textContent.trim(); });
    var cur = Array.prototype.filter.call(links, function (a) { return a.getAttribute('aria-current') === 'page'; })
      .map(function (a) { return a.getAttribute('data-tab'); });
    check('tab bar: five links, Home, Orion-81 devlog, Progress, Orchestration, Orion POC',
      nav && nav.getAttribute('aria-label') === 'Site' &&
      order.join('|') === 'home=Home|devlog=Orion-81 devlog|progress=Progress|orchestration=Orchestration|poc=Orion POC', order);
    var hrefs = Array.prototype.map.call(links, function (a) { return a.getAttribute('href'); });
    check('tab bar: every link ends in .html (or is a clean address over http)',
      hrefs.length === 5 && hrefs.every(function (h) { return /\.html$/.test(h) || /\/$/.test(h); }), hrefs);
    check('tab bar: current tab is ' + current, cur.length === 1 && cur[0] === current, cur);
    var bar = nav ? nav.getBoundingClientRect() : null;
    check('tab bar: one row, 44 px high', bar && Math.abs(bar.height - 44) < 1, bar ? bar.height : null);
    return nav;
  }

  function pocSubBar(current) {
    var nav = document.querySelector('nav.o81-subtabs');
    var links = nav ? nav.querySelectorAll('a.o81-subtab') : [];
    var order = Array.prototype.map.call(links, function (a) { return a.getAttribute('data-subtab') + '=' + a.textContent.trim(); });
    var cur = Array.prototype.filter.call(links, function (a) { return a.getAttribute('aria-current') === 'page'; })
      .map(function (a) { return a.getAttribute('data-subtab'); });
    check('subtab bar: Proof of concept, Gallery',
      nav && nav.getAttribute('aria-label') === 'Orion POC views' && order.join('|') === 'poc=Proof of concept|gallery=Gallery', order);
    var hrefs = Array.prototype.map.call(links, function (a) { return a.getAttribute('href'); });
    check('subtab bar: every link ends in .html (or is a clean address over http)', hrefs.length === 2 && hrefs.every(function (h) { return /\.html$/.test(h) || /\/$/.test(h); }), hrefs);
    check('subtab bar: current subtab is ' + current, cur.length === 1 && cur[0] === current, cur);
    var tabs = document.querySelector('nav.o81-tabs');
    var a = tabs ? tabs.getBoundingClientRect() : null, b = nav ? nav.getBoundingClientRect() : null;
    check('subtab bar: directly under the tab bar', !!a && !!b && Math.abs(b.top - a.bottom) <= 1 && b.height >= 35, b ? { top: b.top, height: b.height, tabsBottom: a && a.bottom } : null);
    return nav;
  }

  function checkStats(min) {
    var S = window.O81_STATS;
    var bad = [];
    if (S) S.before.forEach(function (b) { if (S.values[b.key] !== b.text) bad.push(b.key + ': page "' + b.text + '", data "' + S.values[b.key] + '"'); });
    check('every stat on the page equals the data', !!S && S.before.length >= min && bad.length === 0,
      { bound: S ? S.before.length : 0, bad: bad });
  }

  function homePage() {
    barCheck('home');
    var cta = document.querySelectorAll('a.fp-btn');
    var names = Array.prototype.map.call(cta, function (a) { return a.textContent.trim(); });
    check('two calls to action: Read the devlog, See the progress chart',
      names.join('|') === 'Read the devlog|See the progress chart', names);
    var door = document.querySelectorAll('a.fp-door .fp-door-h');
    check('a door to Orion POC (archived)', door.length === 1 && door[0].textContent.trim() === 'Orion POC (archived)');
    check('the progress chart card links to the chart', document.querySelectorAll('a.fp-feature[href$="progress.html"]').length === 1);
    checkStats(4);
    var strip = document.querySelectorAll('.fp-stat');
    check('stat strip: four stats', strip.length === 4, strip.length);
    var body = document.body.textContent;
    check('hero line: A step towards AI that benefits everyone.', !!document.querySelector('.fp-lead') &&
      document.querySelector('.fp-lead').textContent.trim() === 'A step towards AI that benefits everyone.');
    check('no revenue, money or payment wording on the front page', !/revenue|money|payment|paid|jobs?|livelihood/i.test(document.querySelector('main').textContent));
    check('three neutral cards plus where it is going', document.querySelectorAll('.fp-card').length === 4, document.querySelectorAll('.fp-card').length);
    check('the footer keeps the trademark and not-affiliated line', body.indexOf('Orion-81 is not affiliated with, sponsored or endorsed by Anthropic.') !== -1);
    var o = noOverflow();
    check('no horizontal overflow', o.ok, o.detail);
  }

  function orionPage() {
    var data = window.ORION81_TESTS;
    var T = window.O81_TABLE;
    barCheck('devlog');
    var prog = document.querySelectorAll('a[href="progress.html"]');
    check('link to the interactive progress chart, with the card near the top', prog.length >= 2 &&
      !!document.querySelector('#glance a.pg-feature[href="progress.html"]'), prog.length);
    check('estimate totals near the top: six cards', document.querySelectorAll('#glance .pg-stat').length === 6);
    check('no per-milestone estimate table', document.querySelectorAll('table.pg-table').length === 0);
    checkStats(10);
    var entries = document.querySelectorAll('.pg-entry');
    check('devlog: dated entries, newest first', entries.length >= 5 &&
      /^\d+( to \d+)? October/.test(entries[0].querySelector('.pg-date').textContent.trim()) && /14 October/.test(entries[entries.length - 1].querySelector('.pg-date').textContent),
      entries.length);
    check('data and table present', !!(data && T && T.rows));
    if (!data || !T || !T.rows) return;
    var total = data.meta.count;
    info.renderMs = T.renderMs;
    check('every test is a row', T.rows.length === total && data.tests.length === total && total > 0, T.rows.length);

    var sum = data.areas.reduce(function (s, a) { return s + a.count; }, 0);
    check('area counts sum to the total', sum === total, sum);
    var bad = [];
    data.areas.forEach(function (a) {
      var inData = data.tests.filter(function (t) { return t[1] === a.key; }).length;
      var shown = T.apply('', a.key);
      if (shown !== a.count || inData !== a.count) bad.push(a.key + ': ' + shown + '/' + inData + '/' + a.count);
    });
    check('each area alone shows its count', bad.length === 0 && data.areas.length > 0, bad);
    check('area menu: all areas then each area', T.menu.options.length === data.areas.length + 1 &&
      T.menu.options[0].textContent === 'All areas (' + total + ')', T.menu.options.length);

    var n = T.apply('weapons 8.5', '');
    var words = ['weapons', '8.5'];
    var wrong = 0, phrase = 0;
    T.rows.forEach(function (r) {
      if (r.tr.hidden) return;
      if (!words.every(function (w) { return r.text.indexOf(w) !== -1; })) wrong++;
      if (r.text.indexOf('weapons 8.5') !== -1) phrase++;
    });
    info.weapons85 = { shown: n, withExactPhrase: phrase };
    check('search "weapons 8.5" leaves rows, each holding both words', n >= 1 && wrong === 0, { shown: n, wrong: wrong });

    var z = T.apply('zqxjvwk', '');
    check('nonsense word: 0 rows and the empty state', z === 0 && !T.empty.hidden &&
      T.count.textContent === '0 of ' + total + ' shown', T.count.textContent);

    var c = T.apply('', '');
    var hiddenRows = T.rows.filter(function (r) { return r.tr.hidden; }).length;
    check('clearing restores every row', c === total && hiddenRows === 0 && T.empty.hidden &&
      T.count.textContent === total + ' of ' + total + ' shown', T.count.textContent);

    check('every probe listed', data.probes.length === data.meta.probes && T.probes.children.length === data.meta.probes,
      T.probes.children.length);

    var binds = document.querySelectorAll('[data-o81-bind]');
    var badBind = [];
    Array.prototype.forEach.call(binds, function (b) {
      var k = b.getAttribute('data-o81-bind');
      if (!Object.prototype.hasOwnProperty.call(T.values, k) || b.textContent.trim() !== T.values[k]) badBind.push(k);
    });
    T.bindsBefore.forEach(function (b) {
      if (T.values[b.key] !== b.text) badBind.push(b.key + ' (static text "' + b.text + '")');
    });
    check('every data bind equals the data', binds.length > 0 && badBind.length === 0, { binds: binds.length, bad: badBind });

    var src = document.querySelector('.o81-tests-source');
    check('source line names the commit and the date', !!src && src.textContent.indexOf(data.meta.commit) !== -1 &&
      src.textContent.indexOf(data.meta.generated_label) !== -1);

    var o = noOverflow();
    check('no horizontal overflow', o.ok, o.detail);
  }

  function orchestrationPage() {
    barCheck('orchestration');
    var h1 = document.querySelectorAll('main h1');
    check('one heading 1, Orchestration', h1.length === 1 && h1[0].textContent.trim() === 'Orchestration', h1.length);
    var def = document.querySelector('.og-definition');
    check('the definition opens the page', !!def && /^Orchestration, here, means several developers, each directing their own AI agents, working towards one goal/.test(def.textContent.trim()));
    var heads = Array.prototype.map.call(document.querySelectorAll('main h2'), function (h) { return h.textContent.trim(); });
    check('four sections in order', heads.join('|') === 'Where Orion-81 stands, and how one orchestrator runs it|The road, and how it could split into two lanes|Two developers, one project|The one-line version', heads);
    check('the proposal label appears three times', document.querySelectorAll('.og-tag').length === 3, document.querySelectorAll('.og-tag').length);
    check('seven loop steps, four stages, six rules', document.querySelectorAll('.og-step').length === 7 &&
      document.querySelectorAll('#chunks ~ ol.og-grid').length >= 1 && document.querySelectorAll('#rules ~ ol.og-grid > li').length === 6, null);
    check('six tables, each inside a keyboard-reachable box', document.querySelectorAll('.og-table-wrap[tabindex="0"] > table.og-table').length === 6 && document.querySelectorAll('.og-table').length === 6,
      document.querySelectorAll('.og-table').length);
    check('no script, link or image loaded from another site', !document.querySelector('[src^="http"],[href^="http"],img'));
    var o = noOverflow();
    check('no horizontal overflow', o.ok, o.detail);
  }

  function galleryPage() {
    barCheck('poc');
    pocSubBar('gallery');
    var imgs = document.querySelectorAll('.gl-thumb img');
    check('nine pictures, each with a thumbnail that loaded', imgs.length === 9 &&
      Array.prototype.every.call(imgs, function (i) { return i.complete && i.naturalWidth > 0; }), imgs.length);
    var vids = document.querySelectorAll('.gl-clip video');
    check('three clips with controls, muted, not autoplaying', vids.length === 3 && Array.prototype.every.call(vids, function (v) {
      return v.controls && v.muted && !v.autoplay && !v.hasAttribute('autoplay') && v.getAttribute('poster'); }), vids.length);
    var note = document.querySelector('.gl-note');
    check('top note: footage from the latest Orion proof of concept; Orion-81 has no gameplay yet', !!note &&
      note.textContent.indexOf('latest version of the Orion proof of concept') !== -1 &&
      note.textContent.indexOf('Orion-81, the new game, has no gameplay to show yet') !== -1);
    var o = noOverflow();
    check('no horizontal overflow', o.ok, o.detail);
  }

  function pocPage() {
    var nav = barCheck('poc');
    var sub = pocSubBar('poc');
    var note = nav ? nav.querySelector('.o81-tabs-note') : null;
    check('archive note in the bar', !!note && note.textContent.indexOf('13 October 2026') !== -1);
    var frame = document.querySelector('iframe.o81-poc-frame');
    var src = frame ? frame.src : '';
    check('frame shows v1.1.0/index.html', /v1\.1\.0\/index\.html$/.test(src), src);
    if (frame) {
      var r = frame.getBoundingClientRect();
      var top = sub ? sub.getBoundingClientRect().bottom : (nav ? nav.getBoundingClientRect().bottom : 0);
      var d = { top: r.top, bottom: r.bottom, width: r.width, barBottom: top, vw: window.innerWidth, vh: window.innerHeight };
      check('frame fills the viewport under both bars', Math.abs(r.top - top) <= 1 && Math.abs(r.bottom - window.innerHeight) <= 1 &&
        Math.abs(r.width - window.innerWidth) <= 1, d);
    }
    var o = noOverflow();
    check('no horizontal overflow', o.ok, o.detail);
  }

  function run() {
    try {
      var pg = document.body.getAttribute('data-o81-page');
      if (pg === 'poc') pocPage(); else if (pg === 'home') homePage(); else if (pg === 'gallery') galleryPage(); else if (pg === 'orchestration') orchestrationPage(); else orionPage();
    } catch (e) {
      check('self-test ran without an exception', false, String(e && e.message || e));
    }
    var failed = checks.filter(function (c) { return !c.ok; }).length;
    var n = checks.length;
    document.title = failed ? 'SELFTEST FAIL ' + failed + '/' + n : 'SELFTEST PASS ' + n + '/' + n;
    var pre = document.getElementById('o81-selftest') || document.createElement('pre');
    pre.id = 'o81-selftest';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.overflowWrap = 'anywhere';
    pre.textContent = JSON.stringify({ page: location.pathname.split('/').slice(-2).join('/'), pass: !failed,
      passed: n - failed, total: n, info: info, checks: checks }, null, 1);
    if (!pre.parentNode) document.body.appendChild(pre);
  }

  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
