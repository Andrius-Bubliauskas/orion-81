/* (c) 2026 Andrius Bubliauskas. All rights reserved.
   Fills every data-o81-stat element from window.ORION81_PROGRESS (assets/data/progress-stats.js): the totals of the progress
   chart and of the AI-effort estimate. The page also holds the same text as static HTML, so it reads the same without scripts.
   Classic script, no storage, no network requests. */
(function () {
  'use strict';

  var P = window.ORION81_PROGRESS;
  if (!P) return;

  function num(x) { return Number(x).toLocaleString('en-GB'); }

  var e = P.estimate, u = P.used;
  var values = {
    tests: num(P.tests),
    items_done: num(P.items_done),
    items_total: num(P.items_total),
    milestones_done: num(P.milestones_done),
    milestones_total: num(P.milestones_total),
    est_date: e.date,
    tokens_bn: num(e.tokens_bn),
    tokens_low_bn: num(e.tokens_low_bn),
    tokens_high_bn: num(e.tokens_high_bn),
    weeks: num(e.weeks),
    weeks_low: num(e.weeks_low),
    weeks_high: num(e.weeks_high),
    weeks_free: e.weeks_engine_free,
    weeks_engine: e.weeks_engine,
    finish: e.finish,
    finish_low: e.finish_low,
    finish_high: e.finish_high,
    used_bn: String(u.tokens_bn),
    used_from: u.from,
    used_to: u.to
  };

  var before = [];
  var els = document.querySelectorAll('[data-o81-stat]');
  for (var i = 0; i < els.length; i++) {
    var key = els[i].getAttribute('data-o81-stat');
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    before.push({ key: key, text: els[i].textContent.trim() });
    els[i].textContent = values[key];
  }
  window.O81_STATS = { values: values, before: before };
})();
