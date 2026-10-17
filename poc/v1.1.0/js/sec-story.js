/* orion-81.io mock: sec-story.js (story task, ORI-1304). Classic script; registers the 'story' section with core.js.
   Enhances the static chapters (hero, mission, #ai, proof, roadmap, why, FAQ, footer). Everything works as plain HTML without it. */
(function () {
	'use strict';
	var W = window, D = document;
	function $(s, r) { return (r || D).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
	function el(tag, attrs, kids) {
		var n = D.createElement(tag), k;
		for (k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else if (k === 'html') n.innerHTML = attrs[k]; else if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
		(kids || []).forEach(function (c) { if (c) n.append(c); });
		return n;
	}
	function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
	function until(fn, ms) { var t0 = Date.now(); return new Promise(function (res) { (function f() { if (fn()) return res(true); if (Date.now() - t0 > ms) return res(false); setTimeout(f, 100); })(); }); }

	function init(root, ORION) {
		var DATA = ORION.data || W.ORION_DATA || {};
		var chapters = $$('[data-section="story"]');
		function within(sel) { var out = []; chapters.forEach(function (c) { out = out.concat($$(sel, c)); }); return out; }

		upgradeChips(chapters);
		initDisabledButtons(ORION);
		initHero(ORION, DATA);
		initMission(ORION);
		initTimeline(ORION);
		initProof(ORION);
		initReveal(ORION);
		registerSelfTests(ORION, DATA, chapters);
		void within;
	}

	/* ---- chips written as plain text in the partials get the three-dot icon core's chip() uses ---- */
	function upgradeChips(chapters) {
		chapters.forEach(function (c) {
			$$('.chip', c).forEach(function (ch) {
				if ($('.chip__dots', ch)) return;
				ch.insertBefore(el('span', { class: 'chip__dots', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]), ch.firstChild);
			});
		});
	}

	/* ---- placeholder buttons: focusable, aria-disabled, say what they are ---- */
	function initDisabledButtons(ORION) {
		$$('[data-section="story"] .btn[aria-disabled="true"]').forEach(function (b) {
			b.addEventListener('click', function (e) {
				e.preventDefault();
				var did = b.getAttribute('aria-describedby'), note = did ? $('#' + did) : null;
				var t = b.classList.contains('hero__play') ? ORION.t('hero.trailerComingTitle', 'Trailer coming') : (note ? note.textContent : ORION.t('hero.notLiveYet', 'Not live yet'));
				ORION.ui.announce(ORION.t('common.labelNote', '{label}: {note}', { label: b.textContent.trim(), note: t }));
			});
		});
		$$('.hero__play').forEach(function (b) {
			b.addEventListener('click', function (e) { e.preventDefault(); ORION.ui.announce(ORION.t('hero.trailerAnnounce', 'Trailer coming. We will cut one from the game itself.')); });
		});
	}

	/* ---- hero: logo from the manifest, the trailer-slot viewer with the real ORION-1 model ---- */
	function initHero(ORION, DATA) {
		var logo = $('#top-logo');
		if (logo) {
			var m = ORION.media('logo.full');
			if (m && m.src) { logo.src = m.src; if (m.alt) logo.alt = m.alt; if (m.w) logo.width = m.w; if (m.h) logo.height = m.h; }
			logo.addEventListener('error', function () { logo.hidden = true; });
		}
		var host = $('#top-viewer'); if (!host) return;
		var ship = (DATA.fleet || []).filter(function (s) { return s.id === 'orion1'; })[0];
		function heroTexts() {
			var role = ORION.i18n.d(String((ship && ship.role) || ''));
			var lbl = ship ? ORION.t('hero.viewerLabel', '3D model of the {name} {role}, {length}, slowly rotating', { name: ship.name, role: ORION.i18n.lang === 'en' ? role.toLowerCase() : role, length: ORION.ui.fmt.len(ship.lengthM) }) : ORION.t('hero.viewerLabelFallback', '3D model of the ORION-1 fighter, slowly rotating');
			return { label: lbl, groupLabel: ORION.t('hero.viewerGroup', 'Trailer slot: {label}, behind the Trailer coming plate', { label: lbl }), title: ORION.t('hero.trailerPh', 'TRAILER') };
		}
		var tx = heroTexts();
		var hv = ORION.viewer(host, {
			name: 'hero', priority: 'hero', interactive: true, pausable: true,
			label: tx.label, groupLabel: tx.groupLabel,
			posterKey: 'hero.poster', title: tx.title,
			controls: { autoRotate: true },
			setup: async function (ctx) {
				var T = ctx.THREE, k = ctx.kit;
				var model = await ctx.loadModel('orion1');
				if (ctx.signal && ctx.signal.aborted) return null;
				var s = k.ship(model, { parts: false });
				ctx.scene.add(s.group);
				k.lightRig(ctx.scene, { intensity: 1.1 });
				var R = s.radius || 8;
				ctx.scene.add(k.starfield({ count: 1100, radius: R * 60 }));
				ctx.camera.position.set(0.95, 0.38, 1.15);
				k.fit(ctx.camera, ctx.controls, R * 1.05);
				ctx.setHome();
				return { update: function () { return false; }, dispose: function () { /* scene disposal is done by core */ void T; } };
			}
		});
		ORION.bus.on('lang', function () { hv.setTexts(heroTexts()); });
	}

	/* ---- mission: ledger collapse ---- */
	function initMission() {
		var tbl = $('#mission-ledger'), btn = $('#mission-ledger-toggle');
		if (!tbl || !btn) return;
		var more = $$('.mission__more', tbl).length;
		if (!more) return;
		btn.hidden = false; tbl.classList.add('is-collapsed');
		function paint() {
			var collapsed = tbl.classList.contains('is-collapsed');
			btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
			btn.textContent = collapsed ? ORION.t('mission.showAllMore', 'Show all ({n} more)', { n: more }) : ORION.t('mission.showFewer', 'Show fewer');
		}
		paint();
		btn.addEventListener('click', function () { tbl.classList.toggle('is-collapsed'); paint(); });
		ORION.bus.on('lang', paint);
	}

	/* ---- #ai: the timeline scrubber (>= 900 px) over the plain list ---- */
	function initTimeline(ORION) {
		var wrap = $('#ai-timeline'), list = $('#ai-timeline-list');
		if (!wrap || !list) return;
		var items = $$('.timeline__item', list); if (!items.length) return;
		var cur = 0, tabs = [];
		/* the first 70 characters of an event for its tab label: English cuts exactly as before; other languages cut at a whole letter (grapheme) and, when there is a space, at a whole word */
		function clip(t, n) {
			if (t.length <= n) return t;
			if (ORION.i18n.lang === 'en' || !window.Intl || !Intl.Segmenter) return t.slice(0, n) + '...';
			var o = '', it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)[Symbol.iterator](), x, sp;
			while (!(x = it.next()).done) { if (o.length + x.value.segment.length > n) break; o += x.value.segment; }
			sp = o.lastIndexOf(' '); if (sp > n / 2 && /\S/.test(t.charAt(o.length))) o = o.slice(0, sp);
			return o + '...';
		}
		function nodeLabel(li) {
			var t = $('time', li), date = t ? t.textContent : '', chipT = ($('.chip__t', li) || {}).textContent || '', txt = ($('.timeline__text', li) || {}).textContent || '';
			return ORION.t('ai.timelineNode', '{date}, {chip}: {text}', { date: date, chip: chipT, text: clip(txt, 70) });
		}
		var scrub = el('div', { class: 'timeline__scrub', role: 'tablist', 'aria-label': ORION.t('ai.timelineScrub', 'Timeline events: use the left and right arrow keys to move between them') });
		var panel = el('div', { class: 'timeline__panel panel panel--raised frame', role: 'tabpanel', id: 'ai-tl-panel', tabindex: '0' });
		var prev = el('button', { type: 'button', class: 'btn btn--sm', text: ORION.t('ai.prevEvent', 'Previous event') });
		var next = el('button', { type: 'button', class: 'btn btn--sm', text: ORION.t('ai.nextEvent', 'Next event') });
		var count = el('span', { class: 'mono-label', 'aria-hidden': 'true' });
		var nav = el('div', { class: 'timeline__nav' }, [prev, next, count]);
		items.forEach(function (li, i) {
			var t = $('time', li), date = t ? t.textContent : '';
			var b = el('button', { type: 'button', role: 'tab', class: 'tl-node', id: 'ai-tl-tab-' + i, 'aria-selected': 'false', 'aria-controls': 'ai-tl-panel', tabindex: '-1', 'data-chip': li.getAttribute('data-chip') || '',
				'aria-label': nodeLabel(li) }, [el('i', { class: 'tl-node__dot', 'aria-hidden': 'true' }), el('span', { class: 'tl-node__date', 'aria-hidden': 'true', text: date.slice(5) })]);
			b.addEventListener('click', function () { select(i, false); });
			tabs.push(b); scrub.append(b);
		});
		function select(i, focus) {
			i = Math.max(0, Math.min(items.length - 1, i)); cur = i;
			tabs.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
			var li = items[i], t = $('time', li), chipEl = $('.chip', li);
			panel.setAttribute('aria-labelledby', 'ai-tl-tab-' + i);
			panel.textContent = '';
			var top = el('div', { class: 'timeline__panel-top' }, [el('time', { class: 'timeline__date', datetime: t ? t.getAttribute('datetime') : '', text: t ? t.textContent : '' }), chipEl ? chipEl.cloneNode(true) : null]);
			var tx = $('.timeline__text', li), sc = $('.timeline__src', li);   /* clones keep the markup: the citation stays a translate="no" span */
			panel.append(top, tx ? tx.cloneNode(true) : el('p', { class: 'timeline__text' }), sc ? sc.cloneNode(true) : el('p', { class: 'timeline__src' }));
			count.textContent = ORION.t('ai.timelineCount', '{n} of {total}', { n: i + 1, total: items.length });
			prev.disabled = i === 0; next.disabled = i === items.length - 1;
			if (focus) tabs[i].focus();
		}
		scrub.addEventListener('keydown', function (e) {
			var k = e.key, i = cur;
			if (k === 'ArrowRight') i = cur + 1; else if (k === 'ArrowLeft') i = cur - 1; else if (k === 'Home') i = 0; else if (k === 'End') i = items.length - 1; else return;
			e.preventDefault(); select(i, true);
		});
		prev.addEventListener('click', function () { select(cur - 1, false); });
		next.addEventListener('click', function () { select(cur + 1, false); });
		wrap.append(scrub, panel, nav);
		wrap.classList.add('timeline--ready');
		select(0, false);
		ORION.bus.on('lang', function () {
			scrub.setAttribute('aria-label', ORION.t('ai.timelineScrub', 'Timeline events: use the left and right arrow keys to move between them'));
			prev.textContent = ORION.t('ai.prevEvent', 'Previous event'); next.textContent = ORION.t('ai.nextEvent', 'Next event');
			tabs.forEach(function (b, j) { b.setAttribute('aria-label', nodeLabel(items[j])); });
			select(cur, false);
		});
		wrap.__select = select;
	}

	/* ---- proof: count-up, sources toggle, version list, pipeline ---- */
	function initProof(ORION) {
		var sec = $('#proof'); if (!sec) return;
		var srcBtn = $('#proof-src-toggle');
		if (srcBtn) {
			srcBtn.hidden = false;
			function paintSrc() { srcBtn.textContent = srcBtn.getAttribute('aria-pressed') === 'true' ? ORION.t('proof.hideSources', 'Hide sources') : ORION.t('proof.showSources', 'Show sources'); }
			srcBtn.addEventListener('click', function () { var on = srcBtn.getAttribute('aria-pressed') !== 'true'; srcBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); paintSrc(); sec.classList.toggle('show-src', on); });
			ORION.bus.on('lang', paintSrc);
		}
		var verBtn = $('#proof-ver-toggle'), vers = $$('.ver', sec);
		if (verBtn && vers.length) {
			verBtn.hidden = false;
			function paintVer() { verBtn.textContent = verBtn.getAttribute('aria-expanded') === 'true' ? ORION.t('proof.collapseAll', 'Collapse all') : ORION.t('proof.expandAll', 'Expand all'); }
			ORION.bus.on('lang', paintVer);
			verBtn.addEventListener('click', function () {
				var open = verBtn.getAttribute('aria-expanded') !== 'true';
				vers.forEach(function (d) { d.open = open; });
				verBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); paintVer();
			});
		}
		initCounters(ORION, sec);
		initPipeline(ORION, sec);
	}

	function initCounters(ORION, sec) {
		var nums = $$('.counter__n [data-bind]', sec); if (!nums.length) return;
		var done = false;
		function finalise() { nums.forEach(function (n) { var v = resolve(ORION.data, n.getAttribute('data-bind')); if (typeof v === 'number') n.textContent = ORION.ui.fmt.num(v); }); }
		function run() {
			if (done) return; done = true;
			if (ORION.state.motion === 'reduced') { finalise(); return; }
			var t0 = performance.now(), dur = 1100, targets = nums.map(function (n) { var v = resolve(ORION.data, n.getAttribute('data-bind')); return typeof v === 'number' ? v : null; });
			(function step(t) {
				var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
				nums.forEach(function (n, i) { if (targets[i] != null) n.textContent = ORION.ui.fmt.num(Math.round(targets[i] * e)); });
				if (p < 1 && ORION.state.motion !== 'reduced') requestAnimationFrame(step); else finalise();
			})(t0);
		}
		ORION.bus.on('motion', function (s) { if (s && s.motion === 'reduced') finalise(); });
		ORION.bus.on('lang', function () { if (done) finalise(); });
		var box = $('#proof-counters');
		if ('IntersectionObserver' in W && box) {
			var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); run(); } }); }, { threshold: 0.2 });
			io.observe(box);
		}
		sec.__finalise = finalise;
	}
	function resolve(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }

	function initPipeline(ORION, sec) {
		var pipe = $('#proof-pipe', sec), detail = $('#proof-pipe-detail', sec); if (!pipe || !detail) return;
		var svgNodes = $$('.pipe__node', pipe), btns = $$('.pipe__step', pipe), total = svgNodes.length || btns.length, cur = 0;
		function select(i, announce) {
			cur = i;
			svgNodes.concat(btns).forEach(function (n) { n.setAttribute('aria-pressed', Number(n.getAttribute('data-i')) === i ? 'true' : 'false'); });
			var n = svgNodes[i] || btns[i]; if (!n) return;
			detail.textContent = '';
			detail.append(el('span', { class: 'mono-label', text: ORION.t('proof.pipe.stepOf', 'Step {n} of {total}', { n: i + 1, total: total }) }), D.createTextNode(' '), el('strong', { text: ORION.t('proof.pipe.titleDot', '{title}.', { title: n.getAttribute('data-title') }) }), D.createTextNode(' ' + n.getAttribute('data-desc')));
			void announce;
		}
		function visible(n) { return n.getClientRects().length > 0; }
		function wire(nodes) {
			nodes.forEach(function (n) {
				var i = Number(n.getAttribute('data-i'));
				n.addEventListener('click', function () { select(i); });
				n.addEventListener('focus', function () { select(i); });
				n.addEventListener('keydown', function (e) {
					var k = e.key;
					if (k === 'Enter' || k === ' ') { e.preventDefault(); select(i); return; }
					var j = null;
					if (k === 'ArrowRight' || k === 'ArrowDown') j = Math.min(nodes.length - 1, i + 1); else if (k === 'ArrowLeft' || k === 'ArrowUp') j = Math.max(0, i - 1); else if (k === 'Home') j = 0; else if (k === 'End') j = nodes.length - 1;
					if (j != null && visible(nodes[j])) { e.preventDefault(); nodes[j].focus(); }
				});
			});
		}
		wire(svgNodes); wire(btns);
		function relabel() {
			svgNodes.forEach(function (n) { n.setAttribute('aria-label', ORION.t('proof.pipe.nodeLabel', 'Step {n} of {total}: {label}', { n: Number(n.getAttribute('data-i')) + 1, total: total, label: n.getAttribute('data-label') })); });
			select(cur);
		}
		ORION.bus.on('lang', relabel); relabel();
		pipe.__select = select; void cur;
	}

	function initReveal(ORION) {
		$$('.mission__step, .counter, .phase, .why__card, .faq__item').forEach(function (n) { n.classList.add('reveal'); });
		if (ORION.refresh) ORION.refresh(D);
	}

	/* ---- ?selftest steps (DESIGN.md 7) ---- */
	function registerSelfTests(ORION, DATA, chapters) {
		var add = ORION.selftest && ORION.selftest.add; if (!add) return;
		var DISCLOSURE = 'Orion-81 is a completely AI-generated project.';
		add('story: disclosure sentence in hero, #ai and footer', async function () {
			if (ORION.i18n.lang !== 'en') return { ok: true, note: 'English-only text check, skipped in ' + ORION.i18n.lang };
			var parts = ['#top', '#ai', '#footer'].map(function (s) { var e = $(s); return e ? e.textContent.replace(/\s+/g, ' ').indexOf(DISCLOSURE) >= 0 : false; });
			return { ok: parts.every(Boolean), note: 'hero/ai/footer = ' + parts.join('/') };
		});
		add('story: Future partners? group is exact text', async function () {
			if (ORION.i18n.lang !== 'en') return { ok: true, note: 'English-only text check, skipped in ' + ORION.i18n.lang };
			var g = $('.footer__partners'); if (!g) return { ok: false, note: 'missing' };
			var t = g.textContent.replace(/\s+/g, ' ').trim();
			var ok = t === 'Future partners? Unreal Engine · Blender · Anthropic · Epic Games Aspirational. No partnership, affiliation or endorsement exists.' && !$('img, svg, a', g);
			return { ok: ok, note: t };
		});
		add('story: banned phrases absent from the story chapters', async function () {
			if (ORION.i18n.lang !== 'en') return { ok: true, note: 'English-only text check, skipped in ' + ORION.i18n.lang };
			var txt = chapters.map(function (c) { return c.textContent; }).join(' ').replace(/\s+/g, ' ');
			var bad = [/every line of code/i, /original design/i, /replaced every/i, /still playable/i, /public example/i, /ready to move/i, /solo founder/i].filter(function (r) { return r.test(txt); }).map(String);
			return { ok: !bad.length, note: bad.join(', ') || 'none found' };
		});
		add('story: version list (14 rows, early rows reduced, no downloads)', async function () {
			var rows = $$('#proof-versions .ver'), early = rows.filter(function (r) { return r.classList.contains('ver--early'); });
			var late = rows.filter(function (r) { return !r.classList.contains('ver--early'); });
			var pathLike = early.some(function (r) { return !!$('.ver__ev', r) || /\.md|\.sha256|versions\//i.test(r.textContent); });
			var links = $$('#proof-versions a[href]').length;
			var dl = /download|play it|installer|\.exe|\.zip/i.test($('#proof-versions').textContent);
			var lateEv = late.every(function (r) { return !!$('.ver__ev', r); });
			var dataEarly = (DATA.versions || []).filter(function (v) { return v.early; }).length;
			var ok = rows.length === 14 && early.length === dataEarly && early.length === 6 && !pathLike && !links && !dl && lateEv;
			return { ok: ok, note: 'rows=' + rows.length + ' early=' + early.length + ' pathLikeEarly=' + pathLike + ' links=' + links + ' download=' + dl + ' lateEvidence=' + lateEv };
		});
		add('story: counters equal ORION_DATA after count-up', async function () {
			var sec = $('#proof'); if (sec && sec.__finalise) await sleep(1500);
			var bad = $$('#proof [data-bind]').filter(function (n) {
				var v = resolve(DATA, n.getAttribute('data-bind')); return !(typeof v === 'number' ? n.textContent === ORION.ui.fmt.num(v) : n.textContent === String(v));
			}).map(function (n) { return n.getAttribute('data-bind') + '=' + n.textContent; });
			return { ok: !bad.length, note: bad.join(', ') || 'all bound values equal the data' };
		});
		add('story: timeline keyboard (arrows, Home, End)', async function () {
			var wrap = $('#ai-timeline'), tabs = $$('.tl-node', wrap), list = $$('#ai-timeline-list .timeline__item');
			if (!tabs.length) return { ok: list.length === (DATA.timeline || []).length, note: 'no scrubber; plain list of ' + list.length };
			if (innerWidth < 900) return { ok: list.length === (DATA.timeline || []).length && tabs.length === list.length, note: 'phone width: list ' + list.length + ', scrubber hidden' };
			var key = function (k) { $('.timeline__scrub', wrap).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
			wrap.__select(0, true); key('ArrowRight'); var a = tabs[1].getAttribute('aria-selected') === 'true' && D.activeElement === tabs[1];
			key('End'); var b = tabs[tabs.length - 1].getAttribute('aria-selected') === 'true'; key('Home'); var c = tabs[0].getAttribute('aria-selected') === 'true';
			key('ArrowLeft'); var d = tabs[0].getAttribute('aria-selected') === 'true';
			var panelOk = /Quake III Arena/.test($('.timeline__panel', wrap).textContent);
			return { ok: a && b && c && d && panelOk && tabs.length === (DATA.timeline || []).length, note: [a, b, c, d, panelOk].join('/') + ' tabs=' + tabs.length };
		});
		add('story: pipeline steps focusable and selectable', async function () {
			var vis = $$('#proof-pipe .pipe__node, #proof-pipe .pipe__step').filter(function (n) { return n.getClientRects().length > 0; });
			if (!vis.length) return { ok: false, note: 'no visible step' };
			vis[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await sleep(50); var d = $('#proof-pipe-detail').textContent;
			return { ok: vis.length === 9 && d.indexOf(ORION.t('proof.pipe.stepOf', 'Step {n} of {total}', { n: 3, total: 9 })) >= 0 && d.indexOf(vis[2].getAttribute('data-title')) >= 0, note: 'visible steps ' + vis.length + '; detail: ' + d.slice(0, 80) };
		});
		add('story: hero viewer follows webgl state (live or still, copy swaps)', async function () {
			var v = ORION.__debug && ORION.__debug.get && ORION.__debug.get('hero'); if (!v) return { ok: false, note: 'no hero viewer' };
			scrollTo(0, 0); await sleep(200);
			var live = $('.hero__slotnote [data-when="live"]'), stat = $('.hero__slotnote [data-when="static"]');
			if (ORION.state.webgl === 'ok') {
				var ok = await until(function () { return v.isLive(); }, 12000);
				var ar = v.controls ? v.controls.autoRotate : null;
				var pb = v.pauseBtn; if (pb) { pb.click(); await sleep(60); var stopped = v.controls && v.controls.autoRotate === false; pb.click(); await sleep(60); var resumed = !v.controls || v.controls.autoRotate === (ORION.state.motion === 'full'); }
				var showL = getComputedStyle(live).display !== 'none', showS = getComputedStyle(stat).display === 'none';
				return { ok: ok && showL && showS && (ORION.state.motion !== 'full' || ar === true) && (!pb || (stopped && resumed)), note: 'live=' + ok + ' autoRotate=' + ar + ' pauseWorks=' + (pb ? stopped + '/' + resumed : 'n/a') + ' liveCopy=' + showL };
			}
			var showL2 = getComputedStyle(live).display === 'none', showS2 = getComputedStyle(stat).display !== 'none';
			var poster = $('.viewer__poster', v.host);
			return { ok: !v.isLive() && showL2 && showS2 && !!poster && !poster.hidden, note: 'webgl=' + ORION.state.webgl + ' state=' + v.state + ' staticCopy=' + showS2 };
		});
		add('story: meter at 0 percent, placeholders disabled', async function () {
			var m = $('.meter'), b = $$('[data-section="story"] .btn[aria-disabled="true"]');
			var ok = m && m.getAttribute('role') === 'meter' && m.getAttribute('aria-valuenow') === '0' && b.length >= 4 && b.every(function (x) { return x.getAttribute('aria-disabled') === 'true'; });
			return { ok: !!ok, note: 'disabled placeholders ' + b.length };
		});
	}

	if (W.ORION && W.ORION.register) W.ORION.register('story', { init: init });
	else (W.__orionPending = W.__orionPending || []).push(['story', { init: init }]);
})();
