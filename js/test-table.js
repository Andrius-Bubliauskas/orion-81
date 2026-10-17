/* (c) 2026 Andrius Bubliauskas. All rights reserved.
   The searchable table of every automated test (classic script, no storage, no network requests).
   Reads window.ORION81_TESTS (assets/data/test-index.js), renders into #o81-tests and fills every data-o81-bind element. */
(function () {
  'use strict';

  var data = window.ORION81_TESTS;
  var mount = document.getElementById('o81-tests');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  function bindValues(d) {
    return {
      count: String(d.meta.count),
      probes: String(d.meta.probes),
      commit: String(d.meta.commit),
      generated: String(d.meta.generated_label),
      areas: String(d.areas.length)
    };
  }

  if (!data || !data.meta) return;

  /* Data binds first: they may sit anywhere on the page. Keep the static text for the self-test. */
  var values = bindValues(data);
  var bindsBefore = [];
  Array.prototype.forEach.call(document.querySelectorAll('[data-o81-bind]'), function (b) {
    var key = b.getAttribute('data-o81-bind');
    bindsBefore.push({ key: key, text: b.textContent.trim() });
    if (Object.prototype.hasOwnProperty.call(values, key)) b.textContent = values[key];
  });

  if (!mount) {
    window.O81_TABLE = { apply: function () { return 0; }, rows: [], renderMs: 0, values: values, bindsBefore: bindsBefore };
    return;
  }

  var t0 = performance.now();
  var meta = data.meta;
  var total = data.tests.length;
  var labels = {};
  data.areas.forEach(function (a) { labels[a.key] = a.label; });

  var frag = document.createDocumentFragment();

  frag.appendChild(el('p', 'o81-tests-source',
    total + ' tests at game commit ' + meta.commit + ' (' + meta.branch + '), indexed ' + meta.generated_label +
    '. Index numbers follow the suite\'s order and change when tests are added.'));

  /* Controls: search, area menu, live count. */
  var controls = el('div', 'o81-tests-controls');
  var fSearch = el('div', 'o81-tests-field o81-tests-field-search');
  var lSearch = el('label', 'o81-tests-label', 'Search the tests');
  lSearch.htmlFor = 'o81-tests-q';
  var search = el('input', 'o81-tests-search');
  search.type = 'search';
  search.id = 'o81-tests-q';
  search.placeholder = 'word, weapons 8.5 or file';
  search.autocomplete = 'off';
  search.spellcheck = false;
  fSearch.appendChild(lSearch);
  fSearch.appendChild(search);

  var fArea = el('div', 'o81-tests-field o81-tests-field-area');
  var lArea = el('label', 'o81-tests-label', 'Area');
  lArea.htmlFor = 'o81-tests-area';
  var menu = el('select', 'o81-tests-area');
  menu.id = 'o81-tests-area';
  menu.appendChild(new Option('All areas (' + total + ')', ''));
  data.areas.forEach(function (a) { menu.appendChild(new Option(a.label + ' (' + a.count + ')', a.key)); });
  fArea.appendChild(lArea);
  fArea.appendChild(menu);

  var count = el('p', 'o81-tests-count');
  count.setAttribute('aria-live', 'polite');
  count.id = 'o81-tests-count';

  controls.appendChild(fSearch);
  controls.appendChild(fArea);
  controls.appendChild(count);
  frag.appendChild(controls);

  /* The table, built once. */
  var wrap = el('div', 'o81-tests-wrap');
  var table = el('table', 'o81-tests-table');
  table.setAttribute('aria-label', 'Every automated test of the game\'s rules');
  var thead = el('thead');
  var hr = el('tr');
  [['#', 'o81-tests-num'], ['Area', ''], ['Spec reference', ''], ['What it checks', ''], ['Where', '']].forEach(function (h) {
    var th = el('th', h[1], h[0]);
    th.scope = 'col';
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = el('tbody');
  var rows = [];
  data.tests.forEach(function (t) {
    var idx = t[0], key = t[1], ref = t[2], check = t[3], file = t[4], line = t[5];
    var label = labels[key] || key;
    var where = file + ':' + line;
    var tr = el('tr', 'o81-tests-row');
    tr.appendChild(el('td', 'o81-tests-num', idx));
    tr.appendChild(el('td', 'o81-tests-areacell', label));
    tr.appendChild(el('td', 'o81-tests-ref', ref));
    tr.appendChild(el('td', 'o81-tests-check', check));
    var wcell = el('td', 'o81-tests-where');
    where.split('/').forEach(function (part, k) {
      if (k) { wcell.appendChild(document.createTextNode('/')); wcell.appendChild(document.createElement('wbr')); }
      wcell.appendChild(document.createTextNode(part));
    });
    tr.appendChild(wcell);
    tbody.appendChild(tr);
    rows.push({ tr: tr, area: key, index: idx, text: [idx, label, ref, check, where].join(' ').toLowerCase() });
  });
  var empty = el('tr', 'o81-tests-empty');
  var emptyCell = el('td', '', 'No test matches.');
  emptyCell.colSpan = 5;
  empty.appendChild(emptyCell);
  empty.hidden = true;
  tbody.appendChild(empty);
  table.appendChild(tbody);
  wrap.appendChild(table);
  frag.appendChild(wrap);

  /* On-demand probes. */
  var probes = el('div', 'o81-tests-probes');
  probes.appendChild(el('h3', 'o81-tests-probes-h', 'On-demand probes (' + data.probes.length + ', not counted above)'));
  probes.appendChild(el('p', 'o81-tests-probes-note',
    'These are skipped in every normal run: a developer runs them by hand to time a step or print stored check values.'));
  var plist = el('ul', 'o81-tests-probes-list');
  data.probes.forEach(function (p) {
    var li = el('li');
    li.appendChild(document.createTextNode(p.name + ' (' + p.area + ') '));
    li.appendChild(el('span', 'o81-tests-where', p.file + ':' + p.line));
    plist.appendChild(li);
  });
  probes.appendChild(plist);
  frag.appendChild(probes);

  mount.textContent = '';
  mount.appendChild(frag);

  var lastQuery = null, lastArea = null, shown = total;

  function apply(query, area) {
    query = query == null ? '' : String(query);
    area = area == null ? '' : String(area);
    if (search.value !== query) search.value = query;
    if (menu.value !== area) menu.value = area;
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (query === lastQuery && area === lastArea) return shown;
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var ok = !area || r.area === area;
      for (var w = 0; ok && w < words.length; w++) {
        if (r.text.indexOf(words[w]) === -1) ok = false;
      }
      if (r.tr.hidden === ok) r.tr.hidden = !ok;
      if (ok) n++;
    }
    empty.hidden = n > 0;
    count.textContent = n + ' of ' + total + ' shown';
    lastQuery = query;
    lastArea = area;
    shown = n;
    return n;
  }

  var timer = 0;
  function fromControls() {
    clearTimeout(timer);
    apply(search.value, menu.value);
  }
  search.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(fromControls, 100);
  });
  search.addEventListener('search', fromControls);
  menu.addEventListener('change', fromControls);

  count.textContent = total + ' of ' + total + ' shown';
  lastQuery = '';
  lastArea = '';

  window.O81_TABLE = {
    apply: apply,
    rows: rows,
    empty: empty,
    count: count,
    search: search,
    menu: menu,
    probes: plist,
    values: values,
    bindsBefore: bindsBefore,
    renderMs: Math.round((performance.now() - t0) * 100) / 100
  };
})();
