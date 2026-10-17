/* (c) 2026 Andrius Bubliauskas. All rights reserved.
   ?selftest for both new pages. Writes "SELFTEST PASS n/n" or "SELFTEST FAIL k/n" to the title
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

  function noOverflow() {
    var w = document.documentElement.getBoundingClientRect().width;
    var wideNode = null;
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length && !wideNode; i++) {
      var r = all[i].getBoundingClientRect();
      if (r.width && r.right > window.innerWidth + 0.5) wideNode = all[i];
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
    check('tab bar: two links, Orion-81 then Orion POC',
      nav && nav.getAttribute('aria-label') === 'Site' && order.join('|') === 'orion-81=Orion-81|poc=Orion POC', order);
    check('tab bar: current tab is ' + current, cur.length === 1 && cur[0] === current, cur);
    var bar = nav ? nav.getBoundingClientRect() : null;
    check('tab bar: one row, 44 px high', bar && Math.abs(bar.height - 44) < 1, bar ? bar.height : null);
    return nav;
  }

  function orionPage() {
    var data = window.ORION81_TESTS;
    var T = window.O81_TABLE;
    barCheck('orion-81');
    check('data and table present', !!(data && T && T.rows));
    if (!data || !T || !T.rows) return;
    var total = data.meta.count;
    info.renderMs = T.renderMs;
    check('834 rows', T.rows.length === 834 && total === 834 && data.tests.length === 834, T.rows.length);

    var sum = data.areas.reduce(function (s, a) { return s + a.count; }, 0);
    check('area counts sum to the total', sum === total, sum);
    var bad = [];
    data.areas.forEach(function (a) {
      var inData = data.tests.filter(function (t) { return t[1] === a.key; }).length;
      var shown = T.apply('', a.key);
      if (shown !== a.count || inData !== a.count) bad.push(a.key + ': ' + shown + '/' + inData + '/' + a.count);
    });
    check('each area alone shows its count', bad.length === 0 && data.areas.length === 16, bad);
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

    check('5 probes listed', data.probes.length === 5 && data.meta.probes === 5 && T.probes.children.length === 5,
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

  function pocPage() {
    var nav = barCheck('poc');
    var note = nav ? nav.querySelector('.o81-tabs-note') : null;
    check('archive note in the bar', !!note && note.textContent.indexOf('13 October 2026') !== -1);
    var frame = document.querySelector('iframe.o81-poc-frame');
    var src = frame ? frame.src : '';
    check('frame shows v1.1.0/index.html', /v1\.1\.0\/index\.html$/.test(src), src);
    if (frame) {
      var r = frame.getBoundingClientRect();
      var top = nav ? nav.getBoundingClientRect().bottom : 0;
      var d = { top: r.top, bottom: r.bottom, width: r.width, barBottom: top, vw: window.innerWidth, vh: window.innerHeight };
      check('frame fills the viewport under the bar', Math.abs(r.top - top) <= 1 && Math.abs(r.bottom - window.innerHeight) <= 1 &&
        Math.abs(r.width - window.innerWidth) <= 1, d);
    }
    var o = noOverflow();
    check('no horizontal overflow', o.ok, o.detail);
  }

  function run() {
    try {
      if (document.body.classList.contains('o81-poc')) pocPage(); else orionPage();
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
