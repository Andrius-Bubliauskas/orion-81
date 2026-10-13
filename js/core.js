/* orion-81.io mock: js/core.js (shell task, ORI-1300). Classic script, file:// safe (no local fetches, imports or image textures).
	Implements DESIGN.md 5.3 to 5.7.1, 4 (viewer chrome, wheel rule, data-when swap), 3.5 (motion), 7 (?selftest).
	Sections: ORION.register(name, {init(root, api, roots)}) ({mount} is an alias). `root` is the chapter element when a section owns exactly one chapter, otherwise <main>; `roots` is always the array of its chapter elements. */
(function () {
	'use strict';
	var W = window, D = document, ROOT = D.documentElement;
	if (W.ORION && W.ORION.version) return;
	/* 1. utilities, bus, state */
	var $ = function (s, r) { return (r || D).querySelector(s); };
	var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
	var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
	var now = function () { return W.performance ? W.performance.now() : Date.now(); };
	var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
	var lsGet = function (k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } };
	var lsSet = function (k, v) { try { W.localStorage.setItem(k, v); } catch (e) { /* storage blocked: the page still works */ } };
	var params = new URLSearchParams(location.search);
	var warn = function () { console.warn.apply(console, ['[orion]'].concat([].slice.call(arguments))); };
	var errlog = function () { console.error.apply(console, ['[orion]'].concat([].slice.call(arguments))); };
	function el(tag, attrs, kids) {
		var n = D.createElement(tag), k, v;
		if (attrs) for (k in attrs) {
			v = attrs[k];
			if (v == null || v === false) continue;
			if (k === 'class') n.className = v;
			else if (k === 'text') n.textContent = v;
			else if (k === 'html') n.innerHTML = v;
			else n.setAttribute(k, v === true ? '' : v);
		}
		if (kids != null) [].concat(kids).forEach(function (c) { if (c != null) n.append(c); });
		return n;
	}
	function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
	function onReady(fn) { if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', fn, { once: true }); else fn(); }
	function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
	var handlers = {};
	var bus = {
		on: function (e, f) { (handlers[e] || (handlers[e] = [])).push(f); },
		off: function (e, f) { var l = handlers[e]; if (!l) return; var i = l.indexOf(f); if (i >= 0) l.splice(i, 1); },
		emit: function (e, p) { (handlers[e] || []).slice().forEach(function (f) { try { f(p); } catch (err) { errlog('bus handler for ' + e + ' failed', err); } }); }
	};
	var state = { motion: 'full', tier: 'pending', webgl: 'pending' };
	var ORION = {
		version: 1, data: W.ORION_DATA || null, state: state, bus: bus, three: null, kit: null,
		ui: {}, selftest: {}, __debug: {}
	};
	W.ORION = ORION;
	/* media entries come back with alt and caption in the page language (copies; the manifest is never changed) */
	ORION.media = function (key) {
		var m = W.ORION_MEDIA && W.ORION_MEDIA[key]; if (!m) return null;
		var c = Object.assign({}, m), d = ORION.i18n && ORION.i18n.d;
		if (d) { if (c.alt) c.alt = d(c.alt); if (c.caption) c.caption = d(c.caption); }
		return c;
	};
	/* 1b. i18n hooks (I18N.md 3.9). js/i18n.js replaces ORION.t and ORION.i18n before any section script runs; these stubs are English only. */
	function interp(s, vars) { return String(s).replace(/\{([A-Za-z_]\w*)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : m; }); }
	var stubPR = null;
	function stubPlural(n) { try { stubPR = stubPR || new Intl.PluralRules('en-GB'); return stubPR.select(n); } catch (e) { return n === 1 ? 'one' : 'other'; } }
	ORION.t = function (key, en, vars) {
		var s = en;
		if (en && typeof en === 'object') { var f = stubPlural(vars && vars.n); s = en[f] != null ? en[f] : en.other; }
		return interp(s, vars);
	};
	function slotKids(str, nodes) {
		var re = /<(\d+)\/>|<(\d+)>|<\/(\d+)>/g, root = { kids: [] }, stack = [root], cur = root, last = 0, m;
		function text(t) { if (t) cur.kids.push(D.createTextNode(t)); }
		while ((m = re.exec(str))) {
			text(str.slice(last, m.index)); last = m.index + m[0].length;
			if (m[1] != null) { if (nodes[+m[1]]) cur.kids.push(nodes[+m[1]]); }
			else if (m[2] != null) { cur = { node: nodes[+m[2]], kids: [] }; stack.push(cur); }
			else { var c = stack.pop(); cur = stack[stack.length - 1]; if (c.node) { c.node.textContent = ''; c.kids.forEach(function (k) { c.node.append(k); }); cur.kids.push(c.node); } else c.kids.forEach(function (k) { cur.kids.push(k); }); }
		}
		text(str.slice(last));
		return root.kids;
	}
	var MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	ORION.i18n = {
		lang: 'en', locale: 'en-GB-u-nu-latn', dir: 'ltr', script: 'Latn',
		d: function (s) { return s; },
		plural: stubPlural,
		/* a prose date from an ISO string (YYYY-MM-DD, YYYY-MM or --MM-DD) in one of the formats d MMM y, d MMMM y, MMMM y, d MMM */
		date: function (iso, fmt) {
			var m = /^(?:(\d{4})|-)-(\d{2})(?:-(\d{2}))?$/.exec(iso); if (!m) return String(iso);
			var y = m[1] ? +m[1] : 2000, mo = +m[2] - 1, d = m[3] ? +m[3] : 1, o = { timeZone: 'UTC' };
			if (/d/.test(fmt)) o.day = 'numeric';
			o.month = /MMMM/.test(fmt) ? 'long' : 'short'; if (/y/.test(fmt)) o.year = 'numeric';
			try { return new Intl.DateTimeFormat(ORION.i18n.locale, o).format(new Date(Date.UTC(y, mo, d))); } catch (e) { return (m[3] ? d + ' ' : '') + MONTHS_S[mo] + (m[1] ? ' ' + y : ''); }
		},
		fill: function (host, key, en, nodes) {
			var str = typeof en === 'string' ? en : en.other;
			var kids = slotKids(str, nodes || []); host.textContent = ''; kids.forEach(function (k) { host.append(k); });
			return host;
		}
	};
	ORION.refreshBinds = function (root) { refreshBind(root || D); };
	/* 2. small UI helpers (ORION.ui) */
	var live = null;
	function announce(text) {
		if (!live) return;
		var l0 = ORION.i18n && ORION.i18n.lang;
		live.textContent = '';
		setTimeout(function () { if (!ORION.i18n || ORION.i18n.lang === l0) live.textContent = text; }, 30);   /* an announcement made just before a language switch is dropped, not read out in the old language */
	}
	var CHIP_STATUS = ['built', 'planned', 'future', 'review', 'ai'];
	function chipText(s) {
		if (s === 'planned') return ['common.chip.planned', ORION.t('common.chip.planned', 'Planned')];
		if (s === 'future') return ['common.chip.future', ORION.t('common.chip.future', 'Future')];
		if (s === 'review') return ['common.chip.review', ORION.t('common.chip.review', 'Under review')];
		if (s === 'ai') return ['common.chip.aiMade', ORION.t('common.chip.aiMade', 'AI-made')];
		return ['common.chip.built', ORION.t('common.chip.built', 'Built')];
	}
	function chip(status, version) {
		var s = CHIP_STATUS.indexOf(status) >= 0 ? status : 'built', ct = chipText(s);
		var dots = el('span', { class: 'chip__dots', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]);
		var kids = [dots, el('span', { class: 'chip__t', text: ct[1], 'data-i18n': ct[0] })];
		if (version) kids.push(el('span', { class: 'chip__v', text: String(version) }));
		return el('span', { class: 'chip chip--' + s }, kids);
	}
	var nf = {};
	function numFmt(d) { var loc = ORION.i18n.locale, k = loc + '|' + d; return nf[k] || (nf[k] = new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d })); }
	function numFmtMax(d) { var loc = ORION.i18n.locale, k = loc + '|max' + d; return nf[k] || (nf[k] = new Intl.NumberFormat(loc, { maximumFractionDigits: d })); }
	var fmt = {
		num: function (n, digits) { return (n == null || isNaN(n)) ? '' : numFmt(digits || 0).format(n); },
		len: function (m) {
			if (m == null || isNaN(m)) return '';
			if (m >= 1000) return numFmtMax(m % 1000 ? 1 : 0).format(m / 1000) + ' km';
			if (m < 10) return numFmtMax(1).format(m) + ' m';
			return numFmt(0).format(m) + ' m';
		},
		mass: function (t) {
			if (t == null || isNaN(t)) return '';
			if (t < 1) return numFmt(0).format(t * 1000) + ' kg';
			return numFmtMax(t < 100 ? 1 : 0).format(t) + ' t';
		}
	};
	function srcEl(path) { return el('span', { class: 'src', translate: 'no', lang: 'en', dir: 'ltr', text: path == null ? '' : String(path) }); }   /* a citation: quoted source text stays English (I18N.md 2.7) */
	function fmtBytes(b) { return b >= 1048576 ? numFmt(1).format(b / 1048576) + ' MB' : numFmt(0).format(Math.max(1, Math.round(b / 1024))) + ' KB'; }
	function modelCaption(id) {
		var idx = W.ORION_MODEL_INDEX && W.ORION_MODEL_INDEX[id];
		if (!idx) return '';
		var lod = String(idx.lod || ''), ver = idx.version || '0.6.1', v = { version: ver };
		if (/lod1$/.test(lod)) return idx.atlas ? ORION.t('viewer.model.lod1Atlas', 'Real in-game model from version {version}, lower-detail level (LOD 1) for the web, texture reduced to 512 px', v) : ORION.t('viewer.model.lod1Panel', 'Real in-game model from version {version}, lower-detail level (LOD 1) for the web, with a panel texture made for this site', v);
		if (/lod2$/.test(lod)) return idx.atlas ? ORION.t('viewer.model.lod2Atlas', 'Real in-game model from version {version}, lower-detail level (LOD 2) for the web, texture reduced to 512 px', v) : ORION.t('viewer.model.lod2Panel', 'Real in-game model from version {version}, lower-detail level (LOD 2) for the web, with a panel texture made for this site', v);
		return idx.atlas ? ORION.t('viewer.model.fullAtlas', 'Real in-game model from version {version}, converted for the web, texture reduced to 512 px', v) : ORION.t('viewer.model.fullPanel', 'Real in-game model from version {version}, converted for the web, with a panel texture made for this site', v);
	}
	/* runs fn (a re-render of the text inside root) and puts the focus back on the equivalent control afterwards (I18N.md 3.8) */
	ORION.ui.keepFocus = function (root, fn) {
		var sel = 'button, a[href], select, input, textarea, summary, [tabindex]', a = D.activeElement, list = root ? $$(sel, root) : [], i = (a && root && root.contains(a)) ? list.indexOf(a) : -1;
		fn();
		if (i >= 0) { var l2 = $$(sel, root); if (l2[i] && l2[i] !== D.activeElement) { try { l2[i].focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
	};
	ORION.ui.announce = announce; ORION.ui.chip = chip; ORION.ui.fmt = fmt; ORION.ui.src = srcEl; ORION.ui.modelCaption = modelCaption;
	/* ---- lightbox ---- */
	ORION.ui.lightbox = function (images, startIndex) {
		var list = (images || []).map(function (im) {
			if (typeof im === 'string') { var m = ORION.media(im); return m ? { src: m.src, alt: m.alt || '', caption: m.caption || '' } : null; }
			return im && im.src ? im : null;
		}).filter(Boolean);
		if (!list.length) return null;
		var i = clamp(startIndex | 0, 0, list.length - 1), opener = D.activeElement;
		var img = el('img', { class: 'lightbox__img', alt: '' });
		var cap = el('p', { class: 'lightbox__cap' }), count = el('span', { class: 'lightbox__count', 'aria-hidden': 'true' });
		var closeB = el('button', { type: 'button', class: 'btn btn--sm', text: ORION.t('lightbox.close', 'Close'), 'data-i18n': 'lightbox.close' });
		var prevB = el('button', { type: 'button', class: 'lightbox__nav lightbox__nav--prev', 'aria-label': ORION.t('lightbox.prev', 'Previous image'), 'data-i18n-attr': 'aria-label:lightbox.prev', text: '‹' });
		var nextB = el('button', { type: 'button', class: 'lightbox__nav lightbox__nav--next', 'aria-label': ORION.t('lightbox.next', 'Next image'), 'data-i18n-attr': 'aria-label:lightbox.next', text: '›' });
		var box = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': ORION.t('lightbox.label', 'Image viewer'), 'data-i18n-attr': 'aria-label:lightbox.label' }, [
			el('div', { class: 'lightbox__top' }, [count, closeB]),
			el('div', { class: 'lightbox__stage' }, [prevB, img, nextB]), cap]);
		var inerted = [];
		function show() {
			var it = list[i]; img.src = it.src; img.alt = it.alt || ''; cap.textContent = it.caption || '';
			count.textContent = (i + 1) + ' / ' + list.length; prevB.hidden = nextB.hidden = list.length < 2;
			announce(it.alt ? ORION.t('lightbox.announceAlt', 'Image {n} of {total}: {alt}', { n: i + 1, total: list.length, alt: it.alt }) : ORION.t('lightbox.announce', 'Image {n} of {total}', { n: i + 1, total: list.length }));
		}
		function go(d) { i = (i + d + list.length) % list.length; show(); }
		function close() {
			D.removeEventListener('keydown', onKey, true); box.remove(); ROOT.classList.remove('no-scroll');
			inerted.forEach(function (n) { n.inert = false; });
			if (opener && D.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
		}
		function onKey(e) {
			if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
			else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
			else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
		}
		closeB.addEventListener('click', close); prevB.addEventListener('click', function () { go(-1); }); nextB.addEventListener('click', function () { go(1); });
		box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('lightbox__stage')) close(); });
		D.body.append(box);
		$$('body > *').forEach(function (n) { if (n !== box && n.id !== 'orion-live' && !n.inert) { n.inert = true; inerted.push(n); } });
		ROOT.classList.add('no-scroll'); D.addEventListener('keydown', onKey, true); show(); closeB.focus();
		return { close: close, el: box };
	};
	/* 3. motion, data-bind, reveal, background */
	var mq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
	var userMotion = lsGet('orion.motion');
	function computeMotion() { return userMotion === 'off' ? 'reduced' : userMotion === 'on' ? 'full' : (mq.matches ? 'reduced' : 'full'); }
	function applyMotion() {
		var m = computeMotion(), changed = m !== state.motion;
		state.motion = m; ROOT.dataset.motion = m;
		var b = $('#motion-toggle');
		if (b) { b.setAttribute('aria-pressed', m === 'full' ? 'true' : 'false'); var s = $('.bar__motion-state', b); if (s) s.textContent = m === 'full' ? ORION.t('motion.on', 'on') : ORION.t('motion.off', 'off'); }
		if (changed) bus.emit('motion', state);
	}
	applyMotion();
	if (mq.addEventListener) mq.addEventListener('change', function () { applyMotion(); }); else if (mq.addListener) mq.addListener(applyMotion);
	function setupMotionToggle() {
		var b = $('#motion-toggle'); if (!b) return;
		applyMotion();
		b.addEventListener('click', function () {
			userMotion = state.motion === 'full' ? 'off' : 'on'; lsSet('orion.motion', userMotion); applyMotion();
			announce(state.motion === 'full' ? ORION.t('motion.announceOn', 'Motion on') : ORION.t('motion.announceOff', 'Motion off'));
		});
	}
	function resolvePath(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
	function refreshBind(root) {
		$$('[data-bind]', root).forEach(function (n) {
			var v = resolvePath(W.ORION_DATA, n.getAttribute('data-bind'));
			if (v == null || typeof v === 'object') return;
			n.textContent = (n.dataset.fmt === 'num' && typeof v === 'number') ? fmt.num(v) : ORION.i18n.d(String(v));
		});
	}
	var revealIO = null;
	function setupReveal(root) {
		if (!('IntersectionObserver' in W)) return;
		if (W.CSS && W.CSS.supports && W.CSS.supports('animation-timeline: view()')) return;
		if (!revealIO) {
			ROOT.classList.add('js-reveal');
			revealIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
		}
		$$('.reveal:not(.is-in)', root).forEach(function (n) { revealIO.observe(n); });
	}
	ORION.refresh = function (root) { refreshBind(root || D); setupReveal(root || D); };
	function setupBackground() {
		var c = el('canvas', { id: 'orion-bg', 'aria-hidden': 'true' });
		D.body.insertBefore(c, D.body.firstChild);
		var ctx = c.getContext && c.getContext('2d'); if (!ctx) return;
		var w = 0, h = 0, dpr = 1, stars = [], off = 0, last = 0, raf = 0;
		function build() {
			var rng = mulberry32(81), n = clamp(Math.round(w * h / 6500), 120, 420); stars = [];
			for (var i = 0; i < n; i++) {
				var d = rng();
				stars.push({ x: rng() * w, y: rng() * h, r: 0.35 + d * d * d * 1.25, a: 0.18 + d * 0.62, v: 0.3 + d * 1.6, c: rng() < 0.12 ? '140,200,255' : '232,240,255' });
			}
		}
		function draw() {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
			for (var i = 0; i < stars.length; i++) {
				var s = stars[i], y = (s.y + off * s.v) % h;
				ctx.fillStyle = 'rgba(' + s.c + ',' + s.a.toFixed(2) + ')';
				if (s.r < 0.8) ctx.fillRect(s.x, y, 1, 1); else { ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.2832); ctx.fill(); }
			}
		}
		function resize() {
			var wc = W.innerWidth !== w; dpr = Math.min(W.devicePixelRatio || 1, 1.5); w = W.innerWidth; h = W.innerHeight; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
			if (wc || !stars.length) build();
			draw();
		}
		function frame(t) {
			raf = 0;
			if (state.motion !== 'full' || D.hidden) return;
			if (t - last > 33) { off += (t - last) * 0.0035; last = t; draw(); }
			raf = requestAnimationFrame(frame);
		}
		function kick() { if (!raf && state.motion === 'full' && !D.hidden) { last = now(); raf = requestAnimationFrame(frame); } }
		resize(); W.addEventListener('resize', debounce(resize, 120));
		bus.on('motion', function () { if (state.motion === 'full') kick(); else draw(); });
		D.addEventListener('visibilitychange', kick); kick();
	}
	/* 4. navigation, progress, focus management */
	var userMoved = false;
	function headingFor(target) {
		if (!target) return null;
		if (target.classList && target.classList.contains('chapter')) return $('#' + target.id + '-title') || $('h1, h2, h3', target) || target;
		return target;
	}
	function focusTarget(t) {
		if (!t) return;
		if (!t.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(t.tagName)) t.setAttribute('tabindex', '-1');
		try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
	}
	function goTo(target, push) {
		target.scrollIntoView({ behavior: state.motion === 'full' ? 'smooth' : 'auto', block: 'start' });
		if (push) { try { history.pushState(null, '', '#' + target.id); } catch (e) { /* ignore */ } }
		focusTarget(headingFor(target));
	}
	function setupNav() {
		var bar = $('#bar'), list = $('#nav-links'), menuBtn = $('#nav-menu-btn');
		var links = $$('a', list);
		function measure() { if (bar) ROOT.style.setProperty('--bar-h', Math.round(bar.getBoundingClientRect().height) + 'px'); }
		measure(); W.addEventListener('resize', debounce(measure, 100));
		if (bar && W.ResizeObserver) new ResizeObserver(measure).observe(bar);
		function closeMenu(refocus) { if (!list) return; list.classList.remove('is-open'); if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); if (refocus) menuBtn.focus(); } }
		if (menuBtn) {
			menuBtn.addEventListener('click', function () { var o = list.classList.toggle('is-open'); menuBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); });
			D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && list.classList.contains('is-open')) { closeMenu(true); } });
			D.addEventListener('click', function (e) { if (list.classList.contains('is-open') && !list.contains(e.target) && e.target !== menuBtn) closeMenu(false); });
		}
		D.addEventListener('click', function (e) {
			if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
			var h = a.getAttribute('href'); if (h.length < 2) return;
			var t; try { t = D.getElementById(decodeURIComponent(h.slice(1))); } catch (err) { t = null; }
			if (!t) return;
			e.preventDefault(); if (list && list.contains(a)) closeMenu(false);
			goTo(t, true);
		});
		var current = null, targets = $$('.chapter, .site-footer, footer');
		function setCurrent(id) {
			if (id === current) return; current = id;
			links.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
			bus.emit('nav:chapter', id);
		}
		if ('IntersectionObserver' in W && targets.length) {
			var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) setCurrent(e.target.id || 'footer'); }); }, { rootMargin: '-45% 0px -54% 0px' });
			targets.forEach(function (t) { cio.observe(t); });
		}
		var prog = $('#progress'), fill = prog && $('.bar__progress-fill', prog), star = prog && $('.bar__progress-star', prog), tick = false;
		function paint() {
			tick = false; if (!prog) return;
			var max = Math.max(1, ROOT.scrollHeight - W.innerHeight), p = clamp((W.scrollY || ROOT.scrollTop) / max, 0, 1);
			fill.style.transform = 'scaleX(' + p.toFixed(4) + ')'; star.style.transform = 'translateX(' + (p * prog.clientWidth).toFixed(1) + 'px)';
			prog.classList.toggle('is-on', p > 0.004);
		}
		function sched() { if (!tick) { tick = true; requestAnimationFrame(paint); } }
		W.addEventListener('scroll', sched, { passive: true }); W.addEventListener('resize', sched); paint();
		['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) { W.addEventListener(ev, function () { userMoved = true; }, { passive: true, once: true }); });
		W.addEventListener('load', function () {
			var h = location.hash; if (h.length < 2 || userMoved) return;
			var t; try { t = D.getElementById(decodeURIComponent(h.slice(1))); } catch (e) { t = null; }
			if (t) setTimeout(function () { if (!userMoved) t.scrollIntoView({ block: 'start' }); }, 250);
		});
	}
	/* 5. model loader: ORION.loadModel (DESIGN.md 5.7.1) */
	var fileP = {}, decoded = {}, pendingDec = {};
	function modelError(msg, kind) { var e = new Error(msg); e.kind = kind || 'model'; return e; }
	function loadFile(file) {
		if (fileP[file]) return fileP[file];
		var s, timer, p = new Promise(function (res, rej) {
			s = D.createElement('script'); s.async = true; s.src = file;
			function fail(err) { clearTimeout(timer); if (s.parentNode) s.remove(); delete fileP[file]; rej(err); }
			timer = setTimeout(function () { fail(modelError('timeout loading ' + file + ' (30 s)')); }, 30000);
			s.onload = function () { clearTimeout(timer); res(); };
			s.onerror = function () { fail(modelError('could not load ' + file)); };
			D.head.appendChild(s);
		});
		fileP[file] = p; return p;
	}
	function b64(s) { var bin = atob(s), n = bin.length, u = new Uint8Array(n), i; for (i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u; }
	function decodeRaw(raw) {
		var q = raw.q || { scale: [1, 1, 1], offset: [0, 0, 0] }, i, n;
		var pu = b64(raw.pos), pi = new Int16Array(pu.buffer, 0, pu.byteLength >> 1); n = pi.length;
		var position = new Float32Array(n), sx = q.scale[0] / 32767, sy = q.scale[1] / 32767, sz = q.scale[2] / 32767;
		for (i = 0; i < n; i += 3) { position[i] = pi[i] * sx + q.offset[0]; position[i + 1] = pi[i + 1] * sy + q.offset[1]; position[i + 2] = pi[i + 2] * sz + q.offset[2]; }
		var nu = b64(raw.nrm), ni = new Int8Array(nu.buffer, 0, nu.byteLength), normal = new Float32Array(ni.length);
		for (i = 0; i < ni.length; i++) normal[i] = ni[i] / 127;
		var uv = null;
		if (raw.uv) { var uu = b64(raw.uv), ui = new Uint16Array(uu.buffer, 0, uu.byteLength >> 1); uv = new Float32Array(ui.length); for (i = 0; i < ui.length; i++) uv[i] = ui[i] / 65535; }
		var xu = b64(raw.idx), index = raw.idxType === 32 ? new Uint32Array(xu.buffer, 0, xu.byteLength >> 2) : new Uint16Array(xu.buffer, 0, xu.byteLength >> 1);
		var meta = {}, k; for (k in raw) if (k !== 'pos' && k !== 'nrm' && k !== 'uv' && k !== 'idx' && k !== 'atlas') meta[k] = raw[k];
		return { id: raw.id, meta: meta, arrays: { position: position, normal: normal, uv: uv, index: index }, atlas: null };
	}
	function decodeAtlas(uri) {
		return new Promise(function (res) {
			if (!uri) return res(null);
			var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = uri;
		});
	}
	ORION.loadModel = function (id) {
		var idx = W.ORION_MODEL_INDEX && W.ORION_MODEL_INDEX[id];
		if (!idx) return Promise.reject(modelError('unknown model ' + id));
		if (params.get('no3d') === 'model') return Promise.reject(modelError('?no3d=model test hook: every model fails, so each viewer shows its error note and Retry (I18N.md 2.8 cell 8)'));
		if (decoded[id]) return Promise.resolve(decoded[id]);
		if (pendingDec[id]) return pendingDec[id];
		var p = loadFile(idx.file).then(function () {
			var raw = W.ORION_MODELS && W.ORION_MODELS[id];
			if (!raw) {
				var s = $$('script[src]').filter(function (n) { return n.getAttribute('src') === idx.file; })[0]; if (s) s.remove();
				delete fileP[idx.file]; throw modelError('model ' + id + ' missing from ' + idx.file);
			}
			var m = decodeRaw(raw), atlasUri = raw.atlas;
			return decodeAtlas(atlasUri).then(function (img) {
				m.atlas = img; decoded[id] = m;
				['pos', 'nrm', 'uv', 'idx', 'atlas'].forEach(function (k) { delete raw[k]; });
				delete pendingDec[id]; return m;
			});
		}).catch(function (e) { delete pendingDec[id]; throw e; });
		pendingDec[id] = p; return p;
	};
	/* 6. tier, budget, boot lifecycle (DESIGN.md 5.3) */
	var boot = { booted: false, final: false, reason: null, slow: false, t0: now() };
	var BUDGET = { static: 0, low: 2, medium: 3, high: 4 }, PRCAP = { low: 1.25, medium: 1.5, high: 2 };
	var V = [], byName = {}, io = null, ioVis = null, waitTimer = 0, counters = { mounts: 0, evicts: 0 };
	var qualityPref = lsGet('orion.quality') || 'auto';
	var tierOverride = (function () { var t = params.get('tier'); return /^(low|medium|high|static)$/.test(t || '') ? t : null; })();
	function probeGL(strict) {
		var c = D.createElement('canvas'), gl = null;
		try { gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: strict }) || c.getContext('webgl', { failIfMajorPerformanceCaveat: strict }); } catch (e) { gl = null; }
		if (gl) { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
		return !!gl;
	}
	function detectTier() {
		if (tierOverride) return tierOverride;
		if (qualityPref === 'off') return 'static';
		var strict = probeGL(true), relaxed = strict || probeGL(false);
		if (!relaxed) return 'static';
		if (qualityPref === 'low') return 'low';
		if (!strict) return 'low';
		var coarse = W.matchMedia && W.matchMedia('(pointer: coarse)').matches, mem = navigator.deviceMemory, sd = navigator.connection && navigator.connection.saveData;
		if ((coarse && W.innerWidth < 768) || (mem && mem <= 4) || sd) return 'low';
		if (!coarse && W.innerWidth >= 1280) return 'high';
		return 'medium';
	}
	function budget() { return BUDGET[state.tier] || 0; }
	function liveCount() { return V.filter(function (v) { return v.renderer; }).length; }
	function globalFailText() {
		return boot.reason === 'user' ? ORION.t('viewer.offByUser', 'Interactive 3D is switched off, so this is a still image.') : ORION.t('viewer.glFailed', 'Interactive 3D could not load here, so this is a still image.');
	}
	function footerNotice() {
		var n = $('#orion-3d-notice'), want = state.webgl === 'failed' && boot.reason && boot.reason !== 'user';
		if (!want) { if (n) n.remove(); return; }
		var text = boot.reason === 'webgl' ? ORION.t('shell.noWebgl', 'Interactive 3D is off: WebGL is not available here. Everything else works.') : ORION.t('shell.noCdn', 'Interactive 3D is off: the 3D library could not load. Everything else works.');
		if (n) { n.textContent = text; return; }
		n = el('p', { id: 'orion-3d-notice', class: 'notice', role: 'status', text: text });
		var f = $('footer .wrap') || $('footer') || D.body, q = $('#footer-3d-quality', f);
		if (q && q.parentNode === f) f.insertBefore(n, q); else f.insertBefore(n, f.firstChild);
	}
	/* the display name of a viewer inside an accessibility label: the English stays the id ("hero", "ships" ...), other languages translate it */
	function vname(n) {
		switch (n) {
			case 'hero': return ORION.t('viewer.name.hero', 'hero'); case 'ships': return ORION.t('viewer.name.ships', 'ships');
			case 'maps': return ORION.t('viewer.name.maps', 'maps'); case 'weapons': return ORION.t('viewer.name.weapons', 'weapons');
			case 'build': return ORION.t('viewer.name.build', 'build'); case 'build-colour': return ORION.t('viewer.name.buildColour', 'build-colour');
			case 'build-craft': return ORION.t('viewer.name.buildCraft', 'build-craft'); case 'styles': return ORION.t('viewer.name.styles', 'styles');
			default: return n;
		}
	}
	function failText(kind) {
		if (kind === 'model') return ORION.t('viewer.modelFailed', 'The 3D model could not load, so this is a still image.');
		if (kind === 'reset') return ORION.t('viewer.resetFailed', 'Interactive 3D stopped after repeated graphics resets, so this is a still image.');
		if (kind === 'gl') return ORION.t('viewer.glFailed', 'Interactive 3D could not load here, so this is a still image.');
		return String(kind);
	}
	function updateNotes() { V.forEach(function (v) { v.refreshNote(); }); footerNotice(); }
	function setTier(t) { if (state.tier === t) return; state.tier = t; bus.emit('tier', state); }
	ORION.fallback = function (reason, err) {
		if (boot.booted || boot.reason === 'cdn' || boot.reason === 'webgl') return;
		if (err) warn('3D fallback (' + reason + '):', err && err.message ? err.message : err);
		boot.reason = reason; boot.final = reason !== 'timeout';
		state.webgl = 'failed'; ROOT.dataset.webgl = 'failed'; setTier('static');
		V.forEach(function (v) { if (v.renderer) v.unmount('poster'); else v.setState('poster'); });
		updateNotes(); bus.emit('webgl', state);
	};
	ORION.boot = function (mods) {
		if (boot.final || boot.booted) return;
		try {
			ORION.three = mods; ORION.kit = buildKit(mods);
			var wasFailed = state.webgl === 'failed';
			boot.reason = null; boot.booted = true; boot.slow = false;
			applyTierNow(detectTier(), wasFailed);
		} catch (e) { boot.booted = false; errlog('boot failed', e); ORION.fallback('webgl', e); }
	};
	function applyTierNow(t, wasFailed) {
		if (t === 'static') {
			boot.reason = (!tierOverride && qualityPref === 'off') ? 'user' : 'webgl';
			state.webgl = 'failed'; ROOT.dataset.webgl = 'failed'; setTier('static');
			V.forEach(function (v) { if (v.renderer) v.unmount('poster'); });
		} else {
			boot.reason = null; state.webgl = 'ok'; if (wasFailed || ROOT.dataset.webgl === 'failed') ROOT.dataset.webgl = 'pending';
			setTier(t);
			while (liveCount() > budget()) { var v = pickVictim(null, true); if (!v) break; evict(v); }
		}
		updateNotes(); bus.emit('webgl', state); pump();
	}
	setTimeout(function () { if (!boot.booted && !boot.reason) { boot.slow = true; updateNotes(); } }, 4000);
	setTimeout(function () { if (!boot.booted && !boot.reason) ORION.fallback('timeout'); }, 20000);
	/* ----- footer quality control ----- */
	function setupQuality() {
		var slot = $('#footer-3d-quality'); if (!slot || slot.dataset.ready) return; slot.dataset.ready = '1';
		var fs = el('fieldset', { class: 'q-ctl' }, [el('legend', { text: ORION.t('quality.legend', '3D quality'), 'data-i18n': 'quality.legend' })]), opts = el('div', { class: 'q-ctl__opts' });
		[['auto', ORION.t('quality.auto', 'Auto'), 'quality.auto'], ['low', ORION.t('quality.low', 'Low'), 'quality.low'], ['off', ORION.t('quality.off', 'Off'), 'quality.off']].forEach(function (o) {
			var inp = el('input', { type: 'radio', name: 'orion-q', value: o[0] }); if (qualityPref === o[0]) inp.checked = true;
			if (tierOverride) inp.disabled = true;
			inp.addEventListener('change', function () { setQuality(o[0]); });
			opts.append(el('label', { class: 'q-ctl__opt' }, [inp, el('span', { text: o[1], 'data-i18n': o[2] })]));
		});
		fs.append(opts); if (tierOverride) fs.append(el('p', { class: 'q-ctl__note', text: ORION.t('quality.setByAddress', 'Set by the address (?tier={tier}).', { tier: tierOverride }) }));
		slot.append(fs);
	}
	function setQuality(q) {
		qualityPref = q; lsSet('orion.quality', q);
		if (!boot.booted || tierOverride) return;
		applyTierNow(detectTier(), state.webgl === 'failed');
		announce(ORION.t('quality.announce', '3D quality: {mode}', { mode: q === 'low' ? ORION.t('quality.low', 'Low') : q === 'off' ? ORION.t('quality.off', 'Off') : ORION.t('quality.auto', 'Auto') }));
	}
	/* 7. the 3D kit (DESIGN.md 5.5), built at boot */
	function buildKit(mods) {
		var T = mods.THREE, RoomEnv = mods.RoomEnvironment, kit = {}, envMap = new WeakMap(), glowTex = null;
		var V3 = T.Vector3;
		function toV3(a) { return a && a.isVector3 ? a : new V3(a[0], a[1], a[2]); }
		kit.rng = function (seed) {
			var r = mulberry32(seed | 0);
			r.range = function (a, b) { return a + (b - a) * r(); }; r.int = function (n) { return Math.floor(r() * n); };
			r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; }; r.sign = function () { return r() < 0.5 ? -1 : 1; };
			return r;
		};
		kit.canvasTexture = function (w, h, draw) {
			var c = D.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); draw(g, w, h);
			var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
		};
		kit.env = function (renderer) {
			if (envMap.has(renderer)) return envMap.get(renderer).texture;
			var pm = new T.PMREMGenerator(renderer), room = new RoomEnv(), rt = pm.fromScene(room, 0.04);
			pm.dispose(); room.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
			envMap.set(renderer, rt); return rt.texture;
		};
		kit.disposeEnv = function (renderer) { var rt = envMap.get(renderer); if (rt) { rt.dispose(); envMap.delete(renderer); } };
		kit.lightRig = function (scene, o) {
			var k = (o && o.intensity != null) ? o.intensity : 1;
			var key = new T.DirectionalLight(0xfff1dc, 2.4 * k); key.position.set(5, 6, 4);
			var fill = new T.DirectionalLight(0x9fb7d6, 0.25 * k); fill.position.set(-5, 1, 3);
			var rim = new T.DirectionalLight(0x8cc8ff, 0.9 * k); rim.position.set(-2, 3, -6);
			scene.add(key, fill, rim); return { key: key, fill: fill, rim: rim };
		};
		kit.glowTexture = function () {
			if (glowTex) return glowTex;
			glowTex = kit.canvasTexture(64, 64, function (g, w) {
				var gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
				gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(200,230,255,.55)'); gr.addColorStop(0.6, 'rgba(120,180,255,.12)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
				g.fillStyle = gr; g.fillRect(0, 0, w, w);
			});
			glowTex.userData.keep = true; return glowTex;
		};
		kit.glowSprite = function (color, size, opacity) {
			var m = new T.SpriteMaterial({ map: kit.glowTexture(), color: color == null ? 0x8cc8ff : color, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: opacity == null ? 1 : opacity, toneMapped: false });
			var s = new T.Sprite(m); s.scale.set(size, size, 1); return s;
		};
		kit.starfield = function (o) {
			o = Object.assign({ count: 900, radius: 400, twinkle: true }, o || {});
			var rng = kit.rng(7), n = o.count, pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n), i, a, b, r;
			for (i = 0; i < n; i++) {
				a = rng() * 6.2832; b = Math.acos(2 * rng() - 1); r = o.radius * (0.92 + rng() * 0.08);
				pos[i * 3] = r * Math.sin(b) * Math.cos(a); pos[i * 3 + 1] = r * Math.cos(b); pos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
				sz[i] = 1 + rng() * rng() * 3.2; ph[i] = rng() * 6.2832;
			}
			var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSize', new T.BufferAttribute(sz, 1)); g.setAttribute('aPhase', new T.BufferAttribute(ph, 1));
			var u = { uTime: { value: 0 }, uScale: { value: 1 }, uTw: { value: o.twinkle ? 1 : 0 } };
			var m = new T.ShaderMaterial({
				uniforms: u, transparent: true, depthWrite: false,
				vertexShader: 'attribute float aSize; attribute float aPhase; uniform float uTime; uniform float uScale; uniform float uTw; varying float vA;\nvoid main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale; vA = 0.7 + 0.3 * sin(uTime * 1.3 + aPhase) * uTw; }',
				fragmentShader: 'varying float vA;\nvoid main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(0.86, 0.93, 1.0, a * vA); }'
			});
			var p = new T.Points(g, m); p.frustumCulled = false; p.renderOrder = -10;
			p.onBeforeRender = function (renderer) { u.uScale.value = renderer.getPixelRatio(); if (state.motion === 'full') u.uTime.value = now() / 1000; };
			return p;
		};
		/* ---- ship builder ---- */
		function byMaterial(model) {
			if (model._byMat) return model._byMat;
			var meta = model.meta, A = model.arrays, groups = meta.groups && meta.groups.length ? meta.groups : [{ start: 0, count: A.index.length, mat: 0, part: 0 }];
			var nm = Math.max(1, (meta.mats || []).length), counts = new Array(nm).fill(0), total = 0, off = [], ranges = [], i;
			groups.forEach(function (g) { counts[g.mat] += g.count; total += g.count; });
			var out = new A.index.constructor(total), cur = 0;
			for (i = 0; i < nm; i++) { off[i] = cur; cur += counts[i]; }
			var w = off.slice();
			groups.forEach(function (g) { out.set(A.index.subarray(g.start, g.start + g.count), w[g.mat]); w[g.mat] += g.count; });
			for (i = 0; i < nm; i++) if (counts[i]) ranges.push({ start: off[i], count: counts[i], mat: i });
			return (model._byMat = { index: out, ranges: ranges });
		}
		function partData(model, pi) {
			model._parts = model._parts || {}; if (model._parts[pi]) return model._parts[pi];
			var A = model.arrays, gs = (model.meta.groups || []).filter(function (g) { return g.part === pi; }).sort(function (a, b) { return a.mat - b.mat; });
			var total = 0; gs.forEach(function (g) { total += g.count; });
			var out = new A.index.constructor(total), cur = 0, ranges = [];
			gs.forEach(function (g) { out.set(A.index.subarray(g.start, g.start + g.count), cur); ranges.push({ start: cur, count: g.count, mat: g.mat }); cur += g.count; });
			return (model._parts[pi] = { index: out, ranges: ranges });
		}
		function panelTexture(seedStr) {
			var seed = 0, i; for (i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
			var r = kit.rng(seed);
			var t = kit.canvasTexture(256, 256, function (g, w, h) {
				g.fillStyle = '#7c8694'; g.fillRect(0, 0, w, h);
				for (var k = 0; k < 90; k++) { var s = 110 + r.int(60); g.fillStyle = 'rgba(' + s + ',' + (s + 6) + ',' + (s + 16) + ',.28)'; g.fillRect(r.int(w), r.int(h), 8 + r.int(54), 6 + r.int(36)); }
				g.strokeStyle = 'rgba(20,26,36,.55)'; g.lineWidth = 1;
				for (k = 0; k < 26; k++) { var x = r.int(w), y = r.int(h); g.strokeRect(x, y, 14 + r.int(70), 10 + r.int(48)); }
				for (k = 0; k < 14; k++) { g.fillStyle = r() < 0.5 ? 'rgba(200,225,255,.7)' : 'rgba(255,200,140,.6)'; g.fillRect(r.int(w), r.int(h), 2, 2); }
			});
			t.wrapS = t.wrapT = T.RepeatWrapping; return t;
		}
		kit.ship = function (model, opts) {
			opts = Object.assign({ parts: false, livery: '#ff5a36' }, opts || {});
			var meta = model.meta, A = model.arrays, group = new T.Group(), hasUV = !!A.uv, mapTex = null;
			group.name = 'ship:' + model.id;
			if (hasUV && model.atlas) { mapTex = new T.Texture(model.atlas); mapTex.colorSpace = T.SRGBColorSpace; mapTex.flipY = false; mapTex.anisotropy = 4; mapTex.needsUpdate = true; }
			else if (hasUV) mapTex = panelTexture(String(model.id));
			var env = {};
			function mk(kind) {
				switch (kind) {
					case 'livery': return new T.MeshStandardMaterial({ color: new T.Color(opts.livery), map: mapTex, metalness: 0.7, roughness: 0.45 });
					case 'drive': case 'glow': return new T.MeshStandardMaterial({ color: 0x101820, emissive: 0x8cc8ff, emissiveIntensity: kind === 'glow' ? 2.6 : 2.0, metalness: 0.2, roughness: 0.5 });
					case 'rail': return new T.MeshStandardMaterial({ color: 0x1a2433, emissive: 0x6fb4ff, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.35 });
					case 'glass': return new T.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.4 });
					case 'hull': return new T.MeshStandardMaterial({ color: mapTex ? (model.atlas ? 0xffffff : 0xeef2f8) : 0xc4ccd8, map: mapTex, metalness: 0.7, roughness: 0.45 });
					default: return new T.MeshStandardMaterial({ color: 0x9aa5b3, map: mapTex, metalness: 0.6, roughness: 0.5 });
				}
			}
			var mats = (meta.mats && meta.mats.length ? meta.mats : [{ kind: 'hull' }]).map(function (m) { return mk(m.kind); });
			var posA = new T.BufferAttribute(A.position, 3), nrmA = new T.BufferAttribute(A.normal, 3), uvA = hasUV ? new T.BufferAttribute(A.uv, 2) : null;
			function geo(index, ranges) {
				var g = new T.BufferGeometry(); g.setAttribute('position', posA); g.setAttribute('normal', nrmA); if (uvA) g.setAttribute('uv', uvA);
				g.setIndex(new T.BufferAttribute(index, 1)); ranges.forEach(function (r) { g.addGroup(r.start, r.count, r.mat); }); return g;
			}
			var meshes = [], parts = null;
			if (opts.parts && meta.parts && meta.parts.length) {
				parts = [];
				meta.parts.forEach(function (part, pi) {
					var pd = partData(model, pi); if (!pd.index.length) { parts.push({ mesh: null, part: part }); return; }
					var m = new T.Mesh(geo(pd.index, pd.ranges), mats); m.name = part.name || ('part' + pi); m.userData.part = part; m.userData.pivot = part.pivot;
					group.add(m); meshes.push(m); parts.push({ mesh: m, part: part });
				});
			} else {
				var bm = byMaterial(model), m1 = new T.Mesh(geo(bm.index, bm.ranges), mats); group.add(m1); meshes.push(m1);
			}
			var radius = meta.radius || (meta.lengthM ? meta.lengthM / 2 : 1);
			var sprites = [], er = (meta.engines && meta.engines.radiusM) || radius * 0.02;
			((meta.engines && meta.engines.nozzles) || []).forEach(function (p) {
				var o = kit.glowSprite(0x8cc8ff, Math.max(er * 7, 0.5), 0.55), c = kit.glowSprite(0xe8f4ff, Math.max(er * 3, 0.25), 1);
				o.position.set(p[0], p[1], p[2]); c.position.set(p[0], p[1], p[2]); group.add(o, c); sprites.push(o, c);
			});
			(meta.navLights || []).forEach(function (p) {
				var s = kit.glowSprite(p[0] > 0 ? 0xff3a3a : 0x3aff6a, Math.max(radius * 0.025, 0.5), 1); s.position.set(p[0], p[1], p[2]); group.add(s);
			});
			group.userData = { model: model, radius: radius, parts: parts, meshes: meshes };
			var api = {
				group: group, radius: radius, parts: parts,
				setLivery: function (hex) { mats.forEach(function (m, i) { if (meta.mats && meta.mats[i] && meta.mats[i].kind === 'livery') m.color.set(hex); }); },
				highlightPart: function (i, color) {
					if (!parts || !parts[i] || !parts[i].mesh) return; var m = parts[i].mesh;
					if (color == null) { if (m.userData.hl) { m.material = mats; m.userData.hl.forEach(function (c) { c.dispose(); }); m.userData.hl = null; } return; }
					if (!m.userData.hl) { m.userData.hl = mats.map(function (x) { return x.clone(); }); m.material = m.userData.hl; }
					m.userData.hl.forEach(function (c) { c.emissive.set(color); c.emissiveIntensity = 0.9; });
				},
				hardpointLocal: function (name) { var h = (meta.hardpoints || []).filter(function (x) { return x.name === name; })[0]; return h ? h.origin : null; },
				hardpointWorld: function (name) { var p = api.hardpointLocal(name); if (!p) return null; group.updateMatrixWorld(true); return new V3(p[0], p[1], p[2]).applyMatrix4(group.matrixWorld); }
			};
			return api;
		};
		/* ---- shield bubble ---- */
		kit.shield = function (model, rgb) {
			var bb = model.meta.bbox, mn = bb ? bb.min : [-1, -1, -1], mx = bb ? bb.max : [1, 1, 1], k = Math.SQRT2 * 1.08;
			var cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, cz = (mn[2] + mx[2]) / 2;
			var ax = Math.max(0.5, (mx[0] - mn[0]) / 2) * k, ay = Math.max(0.5, (mx[1] - mn[1]) / 2) * k, az = Math.max(0.5, (mx[2] - mn[2]) / 2) * k;
			var u = { uColor: { value: new T.Color(0x4f9be8) }, uTime: { value: 0 }, uHit: { value: new V3(0, 0, 1) }, uHitT: { value: 1 }, uStatic: { value: state.motion === 'full' ? 0 : 1 }, uStrength: { value: 1 } };
			var mat = new T.ShaderMaterial({
				uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
				vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP;\nvoid main(){ vP = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
				fragmentShader: 'uniform vec3 uColor; uniform float uTime; uniform vec3 uHit; uniform float uHitT; uniform float uStatic; uniform float uStrength; varying vec3 vN; varying vec3 vV; varying vec3 vP;\n' +
					'void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4); float sh = 0.86 + 0.14 * sin(uTime * 1.6 + vP.y * 9.0 + vP.x * 5.0) * (1.0 - uStatic);\n' +
					'float a = (f * 0.85 * sh + 0.03) * uStrength; float h = 0.0;\n' +
					'if (uHitT < 1.0) { float ang = acos(clamp(dot(normalize(vP), normalize(uHit)), -1.0, 1.0)); float r = mix(uHitT * 1.6, 0.45, uStatic); float ring = exp(-pow((ang - r) * 6.0, 2.0)); float core = exp(-pow(ang * 2.5, 2.0)); h = (ring + core) * (1.0 - uHitT) * 1.2; }\n' +
					'gl_FragColor = vec4(uColor + vec3(h * 0.25), clamp(a + h, 0.0, 1.0));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
			});
			var mesh = new T.Mesh(new T.SphereGeometry(1, 48, 32), mat); mesh.scale.set(ax, ay, az); mesh.position.set(cx, cy, cz); mesh.renderOrder = 10; mesh.name = 'shield';
			var hold = 0;
			var api = {
				mesh: mesh,
				setColor: function (c) {
					if (Array.isArray(c)) u.uColor.value.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, T.SRGBColorSpace);
					else u.uColor.value.set(c);
				},
				setStrength: function (s) { u.uStrength.value = s; },
				setMotion: function (m) { u.uStatic.value = m === 'full' ? 0 : 1; },
				flash: function (p) {
					var d = p ? new V3((p[0] - cx) / ax, (p[1] - cy) / ay, (p[2] - cz) / az) : new V3(0, 0, 1);
					if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
					u.uHit.value.copy(d.normalize()); u.uHitT.value = state.motion === 'full' ? 0 : 0.45; hold = 0.7;
				},
				update: function (dt) {
					if (state.motion === 'full') u.uTime.value += dt;
					if (u.uHitT.value < 1) {
						if (state.motion === 'full') u.uHitT.value = Math.min(1, u.uHitT.value + dt / 0.9);
						else { hold -= dt; if (hold <= 0) u.uHitT.value = 1; }
						return true;
					}
					return false;
				}
			};
			api.setMotion(state.motion); api.setColor(rgb || [79, 155, 232]); return api;
		};
		kit.fit = function (camera, controls, radius, target) {
			var fov = camera.fov || 35, d = radius / Math.sin(fov * Math.PI / 360) * 1.05, t = target ? toV3(target) : (controls ? controls.target : new V3());
			var dir = camera.position.clone().sub(t); if (dir.lengthSq() < 1e-6) dir.set(0.7, 0.4, 0.9); dir.normalize();
			camera.position.copy(t).addScaledVector(dir, d); camera.near = Math.max(radius * 0.01, 0.01); camera.far = radius * 200; camera.updateProjectionMatrix();
			if (controls) { controls.target.copy(t); controls.minDistance = d * 0.6; controls.maxDistance = d * 4; controls.update(); } else camera.lookAt(t);
			return d;
		};
		/* ---- projector ---- */
		kit.projector = function (viewer, root) {
			var p = new V3(), d = new V3(), cam = new V3();
			function project(point, dir) {
				var c = viewer.camera; if (!c) return null;
				p.copy(toV3(point)); if (root) { root.updateMatrixWorld(); p.applyMatrix4(root.matrixWorld); }
				var facing = 1;
				if (dir) { d.copy(toV3(dir)); if (root) d.transformDirection(root.matrixWorld); else d.normalize(); cam.copy(c.position).sub(p).normalize(); facing = d.dot(cam); }
				p.project(c);
				var sz = viewer.size, x = (p.x * 0.5 + 0.5) * sz.w, y = (-p.y * 0.5 + 0.5) * sz.h;
				return { x: x, y: y, facing: facing, visible: p.z > -1 && p.z < 1 && x >= -8 && y >= -8 && x <= sz.w + 8 && y <= sz.h + 8 };
			}
			function watch(items, apply) {
				function run() {
					items.forEach(function (it) {
						var r = project(it.point, it.dir); if (!r) return;
						if (apply) apply(it, r);
						else if (it.el) { it.el.style.transform = 'translate3d(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px,0)'; it.el.dataset.facing = r.facing > 0.05 ? 'front' : 'back'; it.el.dataset.visible = r.visible ? 'true' : 'false'; }
					});
				}
				var off = viewer.onFrame(run); run(); return { update: run, stop: off };
			}
			return { project: project, watch: watch };
		};
		return kit;
	}
	/* 8. stage manager: ORION.viewer (DESIGN.md 5.4) */
	var ICON = {
		left: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>', right: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
		zin: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/>', zout: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2M8.5 11h5"/>',
		reset: '<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>', pause: '<path d="M9 6v12M15 6v12"/>', play: '<path d="M8 5l11 7-11 7z"/>'
	};
	function toolLabel(name) {
		switch (name) {
			case 'left': return ORION.t('viewer.rotateLeft', 'Rotate left'); case 'right': return ORION.t('viewer.rotateRight', 'Rotate right');
			case 'zin': return ORION.t('viewer.zoomIn', 'Zoom in'); case 'zout': return ORION.t('viewer.zoomOut', 'Zoom out');
			case 'reset': return ORION.t('viewer.resetView', 'Reset view'); case 'play': return ORION.t('viewer.playMotion', 'Play motion');
			default: return ORION.t('viewer.pauseMotion', 'Pause motion');
		}
	}
	function tool(name, icon) { var label = toolLabel(name); return el('button', { type: 'button', class: 'viewer__tool', 'data-tool': name, 'aria-label': label, title: label, html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + icon + '</svg>' }); }
	function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
	var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
	var coarseMQ = W.matchMedia ? W.matchMedia('(pointer: coarse)') : { matches: false };
	function disposeScene(scene) {
		if (!scene) return;
		scene.traverse(function (o) {
			if (o.geometry) o.geometry.dispose();
			var ms = o.material ? [].concat(o.material) : [];
			ms.forEach(function (m) {
				for (var k in m) { var t = m[k]; if (t && t.isTexture && !(t.userData && t.userData.keep)) t.dispose(); }
				m.dispose();
			});
		});
	}
	function Viewer(host, opts) {
		var self = this;
		this.host = host; this.opts = opts; this.name = opts.name || ('viewer' + V.length); this.label = opts.label || ORION.t('viewer.defaultLabel', '3D viewer: {name}', { name: vname(this.name) });
		this.state = 'poster'; this.gen = 0; this.renderer = null; this.scene = null; this.camera = null; this.controls = null; this.api = null; this.canvas = null;
		this.near = false; this.onScreen = false; this.lastVisible = now(); this.liveSince = 0; this.looping = false; this.dirty = false; this.idle = 0;
		this.active = false; this.motionPaused = false; this.userStopped = false; this.failNote = null; this.canRetry = false; this.lossCount = 0;
		this.tween = null; this.home = null; this.frameHooks = []; this.size = { w: host.clientWidth || 1, h: host.clientHeight || 1 };
		this.counters = { mounts: 0, evicts: 0 }; this.mountT0 = 0; this.firstFrameMs = null; this.avg = 16; this.pr = 1; this.statT = 0; this.fastT = 0;
		this.coarse = !!opts.interactive && coarseMQ.matches;
		host.classList.add('viewer'); host.dataset.state = 'poster'; host.dataset.viewer = this.name;
		host.setAttribute('role', 'group'); host.setAttribute('aria-label', opts.groupLabel || ORION.t('viewer.defaultLabel', '3D viewer: {name}', { name: vname(this.name) }));
		if (opts.interactive) host.classList.toggle('viewer--coarse', this.coarse);
		this.posterEl = $('.viewer__poster', host) || el('img', { class: 'viewer__poster', alt: '', decoding: 'async' });
		this.phEl = el('div', { class: 'viewer__ph', hidden: true });
		this.noteEl = el('div', { class: 'viewer__note' });
		this.statusEl = el('div', { class: 'viewer__status', 'aria-hidden': 'true' }, [el('span', { class: 'viewer__status-t', text: ORION.t('viewer.loading', 'Loading 3D...') }), el('span', { class: 'viewer__bar' })]);
		this.hintEl = el('div', { class: 'viewer__hint', 'aria-hidden': 'true' });
		this.toolbar = el('div', { class: 'viewer__toolbar', role: 'group', 'aria-label': ORION.t('viewer.controls', 'View controls: {name}', { name: vname(this.name) }) });
		var wantPause = opts.interactive || opts.pausable || (opts.controls && opts.controls.autoRotate);
		if (opts.interactive) {
			this.toolbar.append(tool('left', ICON.left), tool('right', ICON.right), tool('zin', ICON.zin), tool('zout', ICON.zout), tool('reset', ICON.reset));
			this.doneBtn = el('button', { type: 'button', class: 'viewer__tool viewer__tool--done', text: ORION.t('viewer.done', 'Done'), hidden: true, 'aria-label': ORION.t('viewer.doneLabel', 'Done: let the page scroll again') });
		}
		if (wantPause) { this.pauseBtn = tool('pause', ICON.pause); this.toolbar.append(this.pauseBtn); }
		if (this.doneBtn) this.toolbar.append(this.doneBtn);
		if (this.coarse) this.tapEl = el('button', { type: 'button', class: 'viewer__tap', 'aria-label': ORION.t('viewer.tapLabel', 'Tap to interact with the 3D view') }, [el('span', { text: ORION.t('viewer.tap', 'Tap to interact') })]);
		if (opts.interactive) {
			this.helpEl = el('span', { class: 'sr-only', id: 'vhelp-' + this.name, text: ORION.t('viewer.help', 'Arrow keys rotate, plus and minus zoom, 0 resets, space pauses motion, Escape releases scroll zoom.') });
			host.removeAttribute('tabindex'); host.removeAttribute('aria-describedby');
		}
		if (!this.posterEl.parentNode) host.insertBefore(this.posterEl, host.firstChild);
		[this.phEl, this.noteEl, this.statusEl, this.hintEl, this.tapEl, this.toolbar, this.helpEl].forEach(function (n) { if (n) host.append(n); });
		this.posterEl.addEventListener('error', function () { self.phEl.hidden = false; self.posterEl.hidden = true; });
		var capEl = $('[data-caption-for="' + this.name + '"]');
		if (!capEl && opts.caption != null) { capEl = el('p', { class: 'viewer__caption' }); host.insertAdjacentElement('afterend', capEl); }
		this.capEl = capEl; if (capEl && opts.caption != null) capEl.textContent = opts.caption;
		this.setPoster(opts.posterKey); this.bind(); this.refreshNote();
		if (W.ResizeObserver) { this.ro = new ResizeObserver(function () { self.resize(); }); this.ro.observe(host); }
	}
	var VP = Viewer.prototype;
	VP.setState = function (s) {
		this.state = s; this.host.dataset.state = s;
		var live = s === 'live' || s === 'paused', h = this.host;
		if (this.posterEl) { if (live) this.posterEl.setAttribute('aria-hidden', 'true'); else this.posterEl.removeAttribute('aria-hidden'); }
		if (this.opts.interactive && this.helpEl) {
			if (live) { h.setAttribute('tabindex', '0'); h.setAttribute('aria-describedby', this.helpEl.id); }
			else { h.removeAttribute('tabindex'); h.removeAttribute('aria-describedby'); }
		}
	};
	VP.setLabel = function (t) { this.label = t; if (this.canvas) this.canvas.setAttribute('aria-label', t); };
	VP.setCaption = function (t) { if (this.capEl) this.capEl.textContent = t; };
	VP.setPoster = function (key) {
		var m = key ? ORION.media(key) : null, p = this.posterEl, ph = this.phEl;
		this.opts.posterKey = key;
		if (m && m.src) {
			p.hidden = false; p.src = m.src; p.alt = m.alt || this.label || ''; if (m.w) p.width = m.w; if (m.h) p.height = m.h;
			if (m.srcset) p.setAttribute('srcset', m.srcset); else p.removeAttribute('srcset'); if (m.sizes) p.setAttribute('sizes', m.sizes);
			ph.hidden = true;
		} else {
			p.hidden = true; p.removeAttribute('src'); ph.hidden = false; ph.textContent = '';
			ph.append(el('strong', { text: this.opts.title || this.name.toUpperCase() }), el('span', { text: ORION.t('viewer.imageToCome', 'Image to come'), 'data-i18n': 'viewer.imageToCome' }));
		}
	};
	VP.refreshNote = function () {
		var n = null, e = this.noteEl, self = this;
		if (this.failNote) n = { text: failText(this.failNote), retry: this.canRetry };
		else if (state.webgl === 'failed' && !this.renderer) n = { text: globalFailText() };
		else if (!boot.booted && boot.slow && state.webgl !== 'failed') n = { text: ORION.t('viewer.loading', 'Loading 3D...'), info: true };
		e.textContent = '';
		if (!n) { e.className = 'viewer__note'; return; }
		e.className = 'viewer__note is-on' + (n.info ? ' is-info' : ''); e.append(el('span', { text: n.text }));
		if (n.retry) { var b = el('button', { type: 'button', class: 'btn btn--sm', text: ORION.t('viewer.retry', 'Retry') }); b.addEventListener('click', function () { self.retry(); }); e.append(b); }
	};
	/* I18N.md 3.8: re-writes every piece of text the viewer chrome owns; sections call setTexts for their own label, group label and title */
	VP.relabel = function () {
		var self = this;
		$$('[data-tool]', this.toolbar).forEach(function (b) { var l = toolLabel(b.dataset.tool === 'pause' && self.motionPaused ? 'play' : b.dataset.tool); b.setAttribute('aria-label', l); b.title = l; });
		this.toolbar.setAttribute('aria-label', ORION.t('viewer.controls', 'View controls: {name}', { name: vname(this.name) }));
		if (this.doneBtn) { this.doneBtn.textContent = ORION.t('viewer.done', 'Done'); this.doneBtn.setAttribute('aria-label', ORION.t('viewer.doneLabel', 'Done: let the page scroll again')); }
		if (this.tapEl) { this.tapEl.setAttribute('aria-label', ORION.t('viewer.tapLabel', 'Tap to interact with the 3D view')); if (this.tapEl.firstChild) this.tapEl.firstChild.textContent = ORION.t('viewer.tap', 'Tap to interact'); }
		if (this.helpEl) this.helpEl.textContent = ORION.t('viewer.help', 'Arrow keys rotate, plus and minus zoom, 0 resets, space pauses motion, Escape releases scroll zoom.');
		this.setStatusText(this.statusId);
		if (this.opts.posterKey && this.posterEl) { var pm = ORION.media(this.opts.posterKey); if (pm && pm.alt) this.posterEl.alt = pm.alt; }   /* the poster's alt text follows the language (English: the same media alt as at construction) */
		if (!this.opts.groupLabel) this.host.setAttribute('aria-label', ORION.t('viewer.defaultLabel', '3D viewer: {name}', { name: vname(this.name) }));
		this.refreshNote();
	};
	VP.setTexts = function (t) {
		t = t || {};
		if (t.label != null) this.setLabel(t.label);
		if (t.groupLabel != null) { this.opts.groupLabel = t.groupLabel; this.host.setAttribute('aria-label', t.groupLabel); }
		if (t.title != null) { this.opts.title = t.title; if (!this.phEl.hidden && this.phEl.firstChild && this.phEl.firstChild.tagName === 'STRONG') this.phEl.firstChild.textContent = t.title; }
	};
	VP.retry = function () { this.failNote = null; this.canRetry = false; this.setState('poster'); this.refreshNote(); maybeMount(this); };
	VP.isLive = function () { return !!this.renderer && (this.state === 'live' || this.state === 'paused'); };
	VP.effectiveMotion = function () { return (state.motion === 'reduced' || this.motionPaused) ? 'reduced' : 'full'; };
	VP.onFrame = function (fn) { var h = this.frameHooks; h.push(fn); return function () { var i = h.indexOf(fn); if (i >= 0) h.splice(i, 1); }; };
	VP.layer = function () { if (!this._layer) { this._layer = el('div', { class: 'viewer__layer' }); this.host.insertBefore(this._layer, this.noteEl); } return this._layer; };
	VP.toolbarRect = function () { var hr = this.host.getBoundingClientRect(), r = this.toolbar.getBoundingClientRect(); return { x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height }; };
	VP.resize = function () {
		var w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
		this.size = { w: w, h: h };
		if (this.renderer) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.requestRender(); }
	};
	VP.requestRender = function () { this.dirty = true; this.ensureLoop(); };
	VP.ensureLoop = function () {
		if (!this.renderer || this.looping || D.hidden || this.state === 'loading') return;
		if (!this.onScreen) return;
		if (this.state === 'paused') this.setState('live');
		this.looping = true; this.lastT = now(); this.idle = 0; this.renderer.setAnimationLoop(this._tick);
	};
	VP.stopLoop = function () { if (this.looping && this.renderer) { this.renderer.setAnimationLoop(null); } this.looping = false; };
	VP._render = function () {
		this.renderer.render(this.scene, this.camera);
		if (this.firstFrameMs == null) { this.firstFrameMs = now() - this.mountT0; }
		var h = this.frameHooks; for (var i = 0; i < h.length; i++) { try { h[i](); } catch (e) { errlog('frame hook failed', e); h.splice(i--, 1); } }
	};
	VP.applyAutoRotate = function () {
		if (this.controls) this.controls.autoRotate = !!(this.opts.controls && this.opts.controls.autoRotate) && this.effectiveMotion() === 'full' && !this.userStopped;
		if (this.pauseBtn) {
			var paused = this.motionPaused, pl = toolLabel(paused ? 'play' : 'pause'); this.pauseBtn.setAttribute('aria-label', pl); this.pauseBtn.title = pl;
			this.pauseBtn.firstChild.innerHTML = paused ? ICON.play : ICON.pause;
		}
		if (typeof this.opts.onMotion === 'function') { try { this.opts.onMotion(this.effectiveMotion()); } catch (e) { errlog(e); } }
		this.requestRender();
	};
	VP.userAct = function () { if (!this.userStopped) { this.userStopped = true; this.applyAutoRotate(); } };
	VP.setMotionPaused = function (p) { this.motionPaused = !!p; if (!p) this.userStopped = false; this.applyAutoRotate(); };
	VP.toggleMotion = function () { this.setMotionPaused(!this.motionPaused); announce(this.motionPaused ? ORION.t('viewer.announcePaused', 'Motion paused') : ORION.t('viewer.announcePlaying', 'Motion playing')); };
	VP.setHome = function () { if (this.camera) this.home = { pos: this.camera.position.clone(), target: this.controls ? this.controls.target.clone() : new ORION.three.THREE.Vector3() }; };
	VP.distance = function () { return this.camera ? this.camera.position.distanceTo(this.controls ? this.controls.target : new ORION.three.THREE.Vector3()) : 0; };
	VP.setActive = function (a) {
		a = !!a && !!this.controls; if (a === this.active) return; this.active = a;
		this.host.classList.toggle('is-active', a);
		if (this.controls) { this.controls.enableZoom = a; this.canvas.style.touchAction = a ? 'none' : 'pan-y'; }
		if (this.doneBtn) this.doneBtn.hidden = !(a && this.coarse);
	};
	VP.showHint = function () {
		var h = this.hintEl, self = this; h.textContent = this.coarse ? ORION.t('viewer.tap', 'Tap to interact') : ORION.t('viewer.hintScroll', 'Use {key} + scroll to zoom', { key: isMac ? 'Cmd' : 'Ctrl' });
		h.classList.add('is-on'); clearTimeout(this._hintT); this._hintT = setTimeout(function () { self.hintEl.classList.remove('is-on'); }, 1500);
	};
	VP.orbitBy = function (dAz, dPol) {
		if (!this.camera || !this.controls) return; var T = ORION.three.THREE, c = this.controls, off = this.camera.position.clone().sub(c.target), s = new T.Spherical().setFromVector3(off);
		s.theta += dAz; s.phi = clamp(s.phi + dPol, 0.05, Math.PI - 0.05); off.setFromSpherical(s); this.camera.position.copy(c.target).add(off); this.camera.lookAt(c.target); c.update(); this.requestRender();
	};
	VP.zoomBy = function (f) {
		if (!this.camera || !this.controls) return; var c = this.controls, off = this.camera.position.clone().sub(c.target), d = clamp(off.length() * f, c.minDistance || 0.01, c.maxDistance || 1e9);
		off.setLength(d); this.camera.position.copy(c.target).add(off); c.update(); this.requestRender();
	};
	VP.cameraTo = function (pos, tgt, ms) {
		var self = this; if (!this.camera) return Promise.resolve();
		var T = ORION.three.THREE, c = this.controls, p1 = pos ? new T.Vector3().fromArray(pos.toArray ? pos.toArray() : pos) : this.camera.position.clone(), t1 = tgt ? new T.Vector3().fromArray(tgt.toArray ? tgt.toArray() : tgt) : (c ? c.target.clone() : new T.Vector3());
		var dur = ms == null ? 700 : ms;
		if (this.tween) { this.tween.resolve(); this.tween = null; }
		if (state.motion === 'reduced' || dur <= 0 || !this.onScreen) {
			this.camera.position.copy(p1); if (c) { c.target.copy(t1); c.update(); } else this.camera.lookAt(t1); this.requestRender(); return Promise.resolve();
		}
		return new Promise(function (resolve) {
			self.tween = { p0: self.camera.position.clone(), t0: c ? c.target.clone() : new T.Vector3(), p1: p1, t1: t1, start: now(), dur: dur, resolve: resolve };
			self.ensureLoop();
		});
	};
	VP.resetView = function () { if (this.home) return this.cameraTo(this.home.pos, this.home.target, 700); return Promise.resolve(); };
	VP._stepTween = function (t) {
		var tw = this.tween; if (!tw) return false; var k = clamp((t - tw.start) / tw.dur, 0, 1), e = ease(k);
		this.camera.position.lerpVectors(tw.p0, tw.p1, e);
		if (this.controls) { this.controls.target.lerpVectors(tw.t0, tw.t1, e); } else this.camera.lookAt(tw.t1);
		if (k >= 1) { var r = tw.resolve; this.tween = null; r(); }
		return true;
	};
	VP._frameStats = function (dt) {
		this.avg = this.avg * 0.9 + dt * 0.1; this.statT += dt; var cap = PRCAP[state.tier] || 1.25, base = Math.min(W.devicePixelRatio || 1, cap);
		if (this.statT < 2000) return; this.statT = 0;
		if (this.avg > 20 && this.pr > 0.75) { this.setPR(Math.max(0.75, this.pr * 0.9)); this.fastT = 0; }
		else if (this.avg < 11 && this.pr < base) { this.fastT += 1; if (this.fastT >= 2) { this.setPR(Math.min(base, this.pr * 1.1)); this.fastT = 0; } } else this.fastT = 0;
	};
	VP.setPR = function (pr) { this.pr = pr; if (this.renderer) { this.renderer.setPixelRatio(pr); this.renderer.setSize(this.size.w, this.size.h, false); this.dirty = true; } };
	VP.bind = function () {
		var self = this, host = this.host, o = this.opts;
		host.addEventListener('click', function (e) {
			var b = e.target.closest && e.target.closest('[data-tool]'); if (b && host.contains(b)) {
				if (b.dataset.tool !== 'pause') self.userAct();
				switch (b.dataset.tool) {
					case 'left': self.orbitBy(0.26, 0); break; case 'right': self.orbitBy(-0.26, 0); break; case 'zin': self.zoomBy(0.8); break; case 'zout': self.zoomBy(1.25); break;
					case 'reset': self.resetView(); break; case 'pause': self.toggleMotion(); break;
				}
			}
			if (e.target === self.doneBtn) { self.setActive(false); }
			if (self.tapEl && self.tapEl.contains(e.target)) { self.setActive(true); }
		});
		if (!o.interactive) return;
		host.addEventListener('wheel', function (e) {
			if (!self.controls) return; var mod = e.ctrlKey || e.metaKey;
			if (mod) { e.preventDefault(); self.controls.enableZoom = true; setTimeout(function () { if (self.controls) self.controls.enableZoom = self.active; }, 0); return; }
			if (self.active) { self.controls.enableZoom = true; return; }
			self.controls.enableZoom = false; self.showHint();
		}, { capture: true, passive: false });
		host.addEventListener('pointerdown', function (e) { if (self.controls && e.target === self.canvas) self.setActive(true); });
		host.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') self.setActive(false); });
		host.addEventListener('focusin', function (e) { if (e.target === host && self.controls) self.setActive(true); });
		host.addEventListener('focusout', function (e) { if (!e.relatedTarget || !host.contains(e.relatedTarget)) self.setActive(false); });
		host.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && self.active) { self.setActive(false); return; }
			if (e.target !== host && e.target !== self.canvas) return; if (e.ctrlKey || e.metaKey || e.altKey || !self.controls) return;
			var k = e.key, used = true;
			if (k === 'ArrowLeft') self.orbitBy(0.21, 0); else if (k === 'ArrowRight') self.orbitBy(-0.21, 0);
			else if (k === 'ArrowUp') self.orbitBy(0, 0.16); else if (k === 'ArrowDown') self.orbitBy(0, -0.16);
			else if (k === '+' || k === '=') self.zoomBy(0.8); else if (k === '-' || k === '_') self.zoomBy(1.25);
			else if (k === '0' || k === 'Home') self.resetView(); else if (k === ' ') self.toggleMotion(); else used = false;
			if (used) { e.preventDefault(); if (k !== ' ') self.userAct(); }
		});
	};
	VP.mount = function () {
		var self = this, T = ORION.three, THREE = T.THREE, kit = ORION.kit, gen = ++this.gen, o = this.opts, co = o.controls || {};
		this.mountT0 = now(); this.firstFrameMs = null; this.counters.mounts++; counters.mounts++; this.liveSince = now();
		this.setState('loading'); this.setStatusText(typeof o.modelId === 'function' ? o.modelId() : o.modelId);
		var renderer;
		try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: state.tier === 'high' ? 'high-performance' : 'default' }); }
		catch (e) { errlog('WebGL renderer failed for ' + this.name, e); this.unmount('failed', 'gl', false); return Promise.resolve(); }
		this.renderer = renderer; this.canvas = renderer.domElement;
		renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.setClearColor(0x000000, 0);
		this.canvas.className = 'viewer__canvas'; this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', this.label);
		this.host.insertBefore(this.canvas, this.phEl.nextSibling);
		this.size = { w: this.host.clientWidth || 1, h: this.host.clientHeight || 1 };
		this.pr = Math.min(W.devicePixelRatio || 1, PRCAP[state.tier] || 1.25); renderer.setPixelRatio(this.pr); renderer.setSize(this.size.w, this.size.h, false);
		this.canvas.addEventListener('webglcontextlost', function (e) {
			e.preventDefault(); if (self.renderer !== renderer) return; self.lossCount++; warn('WebGL context lost: ' + self.name);
			if (self.lossCount > 3) self.unmount('failed', 'reset', true);
			else { self.unmount('evicted'); setTimeout(pump, 600); }
		});
		var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(co.fov || 35, this.size.w / this.size.h, 0.1, 5000), pos = co.position || [3, 2, 6];
		camera.position.set(pos[0], pos[1], pos[2]); this.scene = scene; this.camera = camera;
		try { scene.environment = kit.env(renderer); scene.environmentIntensity = 0.6; } catch (e) { warn('environment map failed', e); }
		if (o.interactive || co.autoRotate) {
			var c = new T.OrbitControls(camera, this.canvas);
			c.enableDamping = true; c.dampingFactor = 0.08; c.enablePan = false; c.enableZoom = false; c.rotateSpeed = 0.7; c.zoomSpeed = 0.8; c.autoRotateSpeed = 1.0;
			c.minPolarAngle = 0.05; c.maxPolarAngle = Math.PI - 0.05; if (co.minDistance != null) c.minDistance = co.minDistance; if (co.maxDistance != null) c.maxDistance = co.maxDistance;
			if (co.target) c.target.set(co.target[0], co.target[1], co.target[2]);
			if (!o.interactive) c.enabled = false;
			c.addEventListener('change', function () { self.dirty = true; self.ensureLoop(); });
			c.addEventListener('start', function () { self.userStopped = true; self.applyAutoRotate(); });
			this.controls = c; this.canvas.style.touchAction = 'pan-y'; if (!o.interactive) this.canvas.style.pointerEvents = 'none';
			c.update();
		} else camera.lookAt(0, 0, 0);
		var abort = new AbortController(); this.abort = abort;
		var ctx = {
			THREE: THREE, kit: kit, renderer: renderer, scene: scene, camera: camera, controls: this.controls, host: this.host, tier: state.tier, viewer: this, signal: abort.signal,
			get motion() { return self.effectiveMotion(); }, requestRender: function () { self.requestRender(); },
			cameraTo: function (p, t, ms) { return self.cameraTo(p, t, ms); }, setHome: function () { self.setHome(); },
			loadModel: function (id) { self.setStatusText(id); return ORION.loadModel(id); }
		};
		return Promise.resolve().then(function () { return o.setup ? o.setup(ctx) : null; }).then(function (api) {
			if (gen !== self.gen) { try { api && api.dispose && api.dispose(); } catch (e) { errlog(e); } return; }
			self.api = api || null; self.applyAutoRotate(); self.setHome();
			self.setState('live'); self.counters.live = true;
			if (ROOT.dataset.webgl !== 'ok') { ROOT.dataset.webgl = 'ok'; bus.emit('webgl', state); }
			self.refreshNote(); self.dirty = true; self._render(); self.dirty = false;
			if (self.onScreen) self.ensureLoop(); else self.setState('paused');
		}).catch(function (e) {
			if (gen !== self.gen) return; errlog('viewer setup failed: ' + self.name, e);
			var isModel = e && e.kind === 'model';
			self.unmount('failed', isModel ? 'model' : 'gl', isModel);
		});
	};
	VP.setStatusText = function (id) {
		this.statusId = id;
		var t = this.statusEl.firstChild, idx = id && W.ORION_MODEL_INDEX && W.ORION_MODEL_INDEX[id];
		t.textContent = idx && idx.bytes ? ORION.t('viewer.loadingModel', 'Loading 3D model, {size}', { size: fmtBytes(idx.bytes) }) : ORION.t('viewer.loading', 'Loading 3D...');
	};
	VP.unmount = function (toState, failNote, canRetry) {
		this.gen++; this.stopLoop(); if (this.active) this.setActive(false);
		if (this.tween) { this.tween.resolve(); this.tween = null; }
		if (this.abort) { try { this.abort.abort(); } catch (e) { /* ignore */ } this.abort = null; }
		if (this.api) { try { this.api.dispose && this.api.dispose(); } catch (e) { errlog('dispose failed', e); } this.api = null; }
		if (this.controls) { try { this.controls.dispose(); } catch (e) { /* ignore */ } this.controls = null; }
		var r = this.renderer;
		if (r) {
			disposeScene(this.scene); if (ORION.kit) ORION.kit.disposeEnv(r);
			try { r.dispose(); } catch (e) { /* ignore */ } try { r.forceContextLoss(); } catch (e) { /* ignore */ }
			if (r.domElement.parentNode) r.domElement.remove();
		}
		this.renderer = this.scene = this.camera = this.canvas = null; this.liveSince = 0; this.userStopped = false;
		this.setState(toState || 'evicted'); this.failNote = failNote || null; this.canRetry = !!canRetry; this.refreshNote();
	};
	VP.rebuild = function () { if (this.renderer) { this.unmount('evicted'); } this.near = this.near || this.onScreen; maybeMount(this); };
	VP.destroy = function () {
		this.unmount('poster'); var i = V.indexOf(this); if (i >= 0) V.splice(i, 1); delete byName[this.name];
		if (io) io.unobserve(this.host); if (ioVis) ioVis.unobserve(this.host); if (this.ro) this.ro.disconnect();
		[this.noteEl, this.statusEl, this.hintEl, this.toolbar, this.tapEl, this.helpEl, this.phEl, this._layer].forEach(function (n) { if (n) n.remove(); }); this.destroyed = true;
	};
	function lastSeen(v) { return v.onScreen ? Infinity : v.lastVisible; }
	function distVH(v) {
		var r = v.host.getBoundingClientRect(), vh = W.innerHeight || 1;
		if (r.bottom < 0) return -r.bottom / vh; if (r.top > vh) return (r.top - vh) / vh; return 0;
	}
	function pickVictim(exclude, force) {
		var t = now(), c = V.filter(function (v) {
			if (!v.renderer || v === exclude) return false;
			if (force) return true;
			return distVH(v) > (v.opts.priority === 'hero' ? 2 : 1) && t - v.liveSince >= 2000;
		});
		c.sort(function (a, b) { return lastSeen(a) - lastSeen(b); });
		return c[0] || null;
	}
	function evict(v) { counters.evicts++; v.counters.evicts++; v.unmount('evicted'); }
	function maybeMount(v) {
		if (!boot.booted || state.webgl !== 'ok' || state.tier === 'static' || !v.near || v.renderer || v.destroyed || v.state === 'failed') return false;
		if (liveCount() >= budget()) {
			var victim = pickVictim(v, false); if (!victim) { v.waiting = true; startWait(); return false; }
			evict(victim);
		}
		v.waiting = false; v.mount(); return true;
	}
	function pump() {
		if (!boot.booted || state.webgl !== 'ok') return;
		var cand = V.filter(function (v) { return v.near && !v.renderer && v.state !== 'failed' && !v.destroyed; });
		cand.sort(function (a, b) { return (a.opts.priority === 'hero' ? 0 : 1) - (b.opts.priority === 'hero' ? 0 : 1) || distVH(a) - distVH(b); });
		var waiting = false; cand.forEach(function (v) { if (!maybeMount(v)) waiting = true; });
		if (!waiting && waitTimer) { clearInterval(waitTimer); waitTimer = 0; }
	}
	function startWait() { if (!waitTimer) waitTimer = setInterval(pump, 400); }
	function tickFor(v) {
		return function (t) {
			if (!v.renderer) return;
			var dt = clamp(t - v.lastT, 0, 50); v.lastT = t; var anim = false;
			try {
				if (v.tween && v._stepTween(t)) anim = true;
				if (v.controls && v.controls.update(dt / 1000)) anim = true;
				if (v.api && v.api.update && v.api.update(dt / 1000, t / 1000)) anim = true;
			} catch (e) { errlog('viewer update failed: ' + v.name, e); if (v.api) v.api.update = null; }
			if (anim || v.dirty) { v.dirty = false; v._render(); v.idle = 0; if (anim) v._frameStats(dt); }
			else if (++v.idle > 2) v.stopLoop();
		};
	}
	function observers() {
		if (io || !('IntersectionObserver' in W)) return;
		io = new IntersectionObserver(function (es) {
			es.forEach(function (e) { var v = V.filter(function (x) { return x.host === e.target; })[0]; if (v) v.near = e.isIntersecting; });
			pump();
		}, { rootMargin: '300px 0px' });
		ioVis = new IntersectionObserver(function (es) {
			es.forEach(function (e) {
				var v = V.filter(function (x) { return x.host === e.target; })[0]; if (!v) return; v.onScreen = e.isIntersecting;
				if (e.isIntersecting) { if (v.renderer && v.state !== 'loading') v.ensureLoop(); }
				else { v.lastVisible = now(); v.stopLoop(); if (v.active) v.setActive(false); if (v.state === 'live') v.setState('paused'); }
			});
		}, { threshold: 0 });
	}
	bus.on('motion', function () { V.forEach(function (v) { v.applyAutoRotate(); }); });
	D.addEventListener('visibilitychange', function () { if (!D.hidden) V.forEach(function (v) { if (v.renderer) v.ensureLoop(); }); else V.forEach(function (v) { v.stopLoop(); }); });
	ORION.viewer = function (host, opts) {
		if (!host) throw new Error('ORION.viewer: host element missing');
		opts = Object.assign({ interactive: true, priority: 'section', controls: {} }, opts || {});
		if (opts.name && byName[opts.name]) { warn('viewer name already used: ' + opts.name); }
		var v = new Viewer(host, opts); v._tick = tickFor(v);
		V.push(v); byName[v.name] = v; observers();
		if (io) { io.observe(host); ioVis.observe(host); } else { v.near = v.onScreen = true; pump(); }
		return v;
	};
	/* 9. registry and section init */
	var sections = {}, initDone = {}, docReady = false;
	function runInit(name) {
		var def = sections[name]; if (!def || initDone[name]) return; initDone[name] = true;
		var roots = $$('[data-section="' + name + '"]'), root = roots.length === 1 ? roots[0] : $('main') || D.body;
		if (!roots.length) { warn('section "' + name + '": no chapter element with data-section="' + name + '"; skipped'); return; }
		var fn = def.init || def.mount; if (typeof fn !== 'function') return;
		try { var r = fn.call(def, root, ORION, roots); if (r && r.catch) r.catch(function (e) { errlog('section "' + name + '" init rejected', e); }); }
		catch (e) { errlog('section "' + name + '" init failed; its static content stays in place', e); }
	}
	ORION.register = function (name, def) {
		if (typeof def === 'function') def = { init: def };
		sections[name] = def; if (docReady) runInit(name);
	};
	ORION.selftest.add = function (name, fn) { (ORION.selftest._extra = ORION.selftest._extra || []).push({ name: name, fn: fn }); };
	/* 10. debug hooks */
	bus.on('lang', function () {
		if (live) live.textContent = '';   /* an announcement made in the previous language must not linger in the live region */
		applyMotion(); V.forEach(function (v) { v.relabel(); }); footerNotice();
		var q = $('#footer-3d-quality'); if (q && q.dataset.ready) { q.textContent = ''; delete q.dataset.ready; setupQuality(); }
	});
	ORION.__debug.liveContexts = liveCount;
	ORION.__debug.budget = budget;
	ORION.__debug.viewers = function () { return V.map(function (v) { return { name: v.name, state: v.state, liveSinceMs: v.renderer ? Math.round(now() - v.liveSince) : null }; }); };
	ORION.__debug.counters = function () { return { mounts: counters.mounts, evicts: counters.evicts, perViewer: V.map(function (v) { return { name: v.name, mounts: v.counters.mounts, evicts: v.counters.evicts, firstFrameMs: v.firstFrameMs == null ? null : Math.round(v.firstFrameMs) }; }) }; };
	ORION.__debug.get = function (name) { return byName[name] || null; };
	ORION.__debug.pump = pump; ORION.__debug.boot = boot;
	/* 11. DOM-ready wiring */
	onReady(function () {
		docReady = true;
		live = el('div', { id: 'orion-live', class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' }); D.body.append(live);
		ORION.data = W.ORION_DATA || null;
		refreshBind(D); setupMotionToggle(); setupBackground(); setupNav(); setupQuality(); setupReveal(D);
		Object.keys(sections).forEach(runInit);
		footerNotice();
		W.addEventListener('load', function () { refreshBind(D); setupReveal(D); setupQuality(); });
		if (params.has('selftest')) setTimeout(runSelfTest, 0);
	});
	/* 12. ?selftest (DESIGN.md 7) */
	var stErrors = [], stRes = [], frames = 0;
	async function until(fn, ms) { var t = now(); while (now() - t < ms && !fn()) await sleep(100); return !!fn(); }
	if (params.has('selftest')) {
		W.addEventListener('error', function (e) { if (e instanceof ErrorEvent) stErrors.push(e.message + ' @' + String(e.filename).split('/').pop() + ':' + e.lineno); else if (e.target && e.target !== W) stRes.push(e.target.src || e.target.href || e.target.tagName); }, true);
		W.addEventListener('unhandledrejection', function (e) { stErrors.push('rejection: ' + (e.reason && e.reason.message || e.reason)); });
	}
	async function runSelfTest() {
		(function f() { frames++; requestAnimationFrame(f); })();
		var steps = [], J = JSON.stringify, hook = params.get('no3d'), pre = el('pre', { id: 'orion-selftest' }), probe = null;
		var probeHost = el('div', { style: 'position:fixed;right:8px;top:70px;width:260px;height:170px;z-index:80;aspect-ratio:auto;max-height:none;min-height:0' });
		D.body.append(pre, probeHost);
		var rec = function (n, ok, note) { steps.push({ name: n, ok: !!ok, note: note == null ? '' : String(note) }); };
		var snap = function () { return { live: liveCount(), budget: budget(), viewers: ORION.__debug.viewers(), state: state }; };
			var st = function () { return J({ t: Math.round(now() / 100) / 10, webgl: state.webgl, reason: boot.reason, booted: boot.booted, notice: $$('#orion-3d-notice').length }); };
		try {
			probe = ORION.viewer(probeHost, {
				name: 'selftest-probe', label: '3D probe object', title: 'PROBE', interactive: true, controls: { autoRotate: true },
				async setup(ctx) {
					var T = ctx.THREE, k = ctx.kit; k.lightRig(ctx.scene);
					ctx.scene.add(new T.Mesh(new T.BoxGeometry(2, 1, 3), new T.MeshStandardMaterial({ color: 0xc4ccd8, metalness: 0.7, roughness: 0.45 })), k.starfield({ count: 200, radius: 40 }));
					k.fit(ctx.camera, ctx.controls, 2.2); ctx.setHome(); return { update: function () { return false; } };
				}
			});
			var note = function () { return probe.noteEl.textContent; };
			if (hook === 'cdn') {
				await sleep(300); rec('cdn: immediate fallback, poster note, one footer notice, no contexts', state.webgl === 'failed' && boot.reason === 'cdn' && /still image/.test(note()) && $$('#orion-3d-notice').length === 1 && !liveCount(), st());
			} else if (hook === 'delay') {
				await until(function () { return now() > 5200; }, 6000); rec('delay: "Loading 3D..." at 4 s', /Loading 3D/.test(note()) && state.webgl === 'pending', st() + ' ' + note());
				await until(function () { return now() > 21000; }, 17000); rec('delay: soft fallback at 20 s with footer notice', state.webgl === 'failed' && boot.reason === 'timeout' && $$('#orion-3d-notice').length === 1, st());
				await until(function () { return now() > 26500; }, 8000);
				rec('delay: late boot recovers, notes and notice removed (or final cdn fallback when offline)', boot.reason === 'cdn' || (boot.booted && state.webgl === 'ok' && !$$('#orion-3d-notice').length && !/still image|Loading 3D/.test(note())), st());
			} else rec('boot', await until(function () { return state.webgl !== 'pending'; }, 30000) && state.webgl === 'ok', st() + ' tier=' + state.tier);
			var tw = el('div', { style: 'position:absolute;left:-9999px' }, [el('span', { 'data-when': 'live', text: 'L' }), el('span', { 'data-when': 'static', text: 'S' })]); D.body.append(tw);
			if (state.webgl === 'ok') await until(function () { return probe.isLive(); }, 8000);
			var cl = getComputedStyle(tw.children[0]).display, cs = getComputedStyle(tw.children[1]).display, okw = ROOT.dataset.webgl === 'ok';
			rec('data-when swap follows state', okw ? (cl !== 'none' && cs === 'none') : (cl === 'none' && cs !== 'none'), 'html[data-webgl]=' + ROOT.dataset.webgl + ' live=' + cl + ' static=' + cs); tw.remove();
			var tog = $('#motion-toggle'), m0 = state.motion;
			if (tog) {
				tog.click(); await sleep(60); var m1 = state.motion, d1 = ROOT.dataset.motion, ar = probe.controls ? probe.controls.autoRotate : null; tog.click(); await sleep(60);
				rec('motion toggle propagates', m1 !== m0 && d1 === m1 && state.motion === m0 && (ar === null || ar === (m1 === 'full')), J({ before: m0, after: m1, dataset: d1, autoRotate: ar, restored: state.motion }));
			}
			if (state.webgl === 'ok') {
				var l1 = await until(function () { return probe.isLive(); }, 8000); rec('probe viewer mounts', l1, 'state=' + probe.state + ' tier=' + state.tier + ' firstFrameMs=' + (probe.firstFrameMs == null ? 'n/a' : Math.round(probe.firstFrameMs)));
				if (l1) await viewerChecks(probe, rec);
				var idx = W.ORION_MODEL_INDEX || {}, ids = Object.keys(idx), rej = false, ship = ids.filter(function (i) { return idx[i].kind === 'ship'; })[0];
				try { await ORION.loadModel('__nope__'); } catch (e) { rej = /unknown model/.test(e.message); }
				rec('loadModel: unknown id rejects at once', rej);
				if (ship) {
					var t0 = now(), mdl = await ORION.loadModel(ship).catch(function (e) { return e; });
					rec('loadModel + modelCaption for a real ship', mdl && mdl.arrays && mdl.arrays.index.length > 0 && /^Real in-game model from version [\d.]+, (converted for the web|lower-detail level \(LOD [12]\) for the web), (texture reduced to 512 px|with a panel texture made for this site)$/.test(modelCaption(ship)), ship + ' ' + (mdl && mdl.arrays ? mdl.arrays.index.length / 3 + ' tris' : mdl && mdl.message) + ' ' + Math.round(now() - t0) + ' ms; ' + modelCaption(ship));
			} else rec('loadModel + modelCaption for a real ship', true, 'skipped: no ship in ORION_MODEL_INDEX');
				if (idx.rock1 && idx.rock3) { var rf = idx.rock1.file.split('/').pop(); await Promise.all([ORION.loadModel('rock1'), ORION.loadModel('rock3')]).catch(function () { }); rec('loadModel: rocks file injected once', $$('script[src$="' + rf + '"]').length === 1); }
			}
			probe.destroy(); probeHost.remove(); probe = null;
			var chapters = $$('.chapter, footer').filter(function (n, i, a) { return a.indexOf(n) === i; }), seen = {};
			for (var ci = 0; ci < chapters.length; ci++) {
				var ch = chapters[ci]; ch.scrollIntoView({ behavior: 'instant', block: 'start' }); await sleep(900);
				var s = snap(); rec('walk #' + (ch.id || ch.tagName.toLowerCase()), s.live <= s.budget, 'live ' + s.live + '/' + s.budget + ' ' + s.viewers.map(function (v) { return v.name + ':' + v.state; }).join(' '));
				var vs = V.filter(function (v) { return v.isLive() && v.onScreen && v.opts.interactive && !seen[v.name]; });
				for (var vi = 0; vi < vs.length; vi++) { seen[vs[vi].name] = 1; await viewerChecks(vs[vi], rec); }
			}
			for (var xi = 0; xi < (ORION.selftest._extra || []).length; xi++) {
				var ex = ORION.selftest._extra[xi]; try { var rr = await ex.fn(); rec('section: ' + ex.name, rr && rr.ok, rr && rr.note); } catch (e) { rec('section: ' + ex.name, false, 'threw ' + (e && e.message)); }
			}
			if (ORION.i18n && ORION.i18n._test && !params.has('noi18nsteps')) await i18nSteps(rec);
			rec('no console errors', !stErrors.length, stErrors.join(' | '));
		} catch (e) { rec('selftest crashed', false, e && e.stack || e); }
		var fails = steps.filter(function (x) { return !x.ok; }).length;
		pre.textContent = J({ result: fails ? 'FAIL' : 'PASS', failures: fails, url: location.search, ua: navigator.userAgent.replace(/^Mozilla\/5.0 /, ''), final: snap(), counters: ORION.__debug.counters(), resourceErrors: stRes.slice(0, 20), errors: stErrors, steps: steps }, null, 1);
		D.title = fails ? 'SELFTEST FAIL ' + fails : 'SELFTEST PASS';
	}
	/* ?selftest i18n steps (ORI-1323, I18N.md 6.1): picker, three switching cycles en -> x-pseudo -> x-pseudo-rtl -> en without a reload, the frozen peak, the section steps once more */
	async function i18nSteps(rec) {
		var I = ORION.i18n, J = JSON.stringify, T = I._test, text = function () {
			var o = [], w = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentElement; return !p || p.closest('script,style,noscript,template,.lang,#orion-selftest') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
			while (w.nextNode()) o.push(w.currentNode.nodeValue); return o.join('').replace(/\s+/g, '');
		};
		var atRight = function (b) { var m = 0; $$('#bar a, #bar button').forEach(function (e) { if (!e.closest('.lang')) { var q = e.getBoundingClientRect(); if (q.width) m = Math.max(m, q.right); } }); return b.right >= m - 1 && b.right <= W.innerWidth; };   /* the bar is centred (76 rem), so "top right" means: the rightmost item of the bar */
		var pick = $('#lang'), r = pick && pick.getBoundingClientRect(), mark = W.__stNoReload = Math.random();
		rec('i18n: picker is the rightmost item of the bar at the top, English, no x-* pack applied', !!r && atRight(r) && r.top < 80 && I.lang === 'en' && !ROOT.hasAttribute('data-i18n-boot'), r && J({ right: Math.round(r.right), top: Math.round(r.top), w: W.innerWidth }));
		await I.set('en', { force: true }); await sleep(100);   /* English re-rendered once by the handlers: state-driven text that a section had not refreshed (a stale status line) is brought up to date, so the baseline is what every later English render must give */
		var base = text(), times = {}, bad = [], miss = 0, codes = ['x-pseudo', 'x-pseudo-rtl', 'en'];
		for (var cy = 0; cy < 3; cy++) for (var ci = 0; ci < codes.length; ci++) {
			var c = codes[ci], t0 = now(); await I.set(c); await sleep(60); times[c] = Math.max(times[c] || 0, Math.round(now() - t0));
			var want = c === 'en' ? ['en-GB', 'ltr'] : ['en', c === 'x-pseudo-rtl' ? 'rtl' : 'ltr'], r2 = pick.getBoundingClientRect();
			if (ROOT.lang !== want[0] || ROOT.dir !== want[1] || I.lang !== c) bad.push(c + ': lang ' + ROOT.lang + '/' + ROOT.dir + '/' + I.lang);
			if (W.__stNoReload !== mark) bad.push(c + ': page reloaded');
			if (!atRight(r2) || r2.top > 80) bad.push(c + ': picker at ' + Math.round(r2.right) + ',' + Math.round(r2.top));
			if (D.documentElement.scrollWidth > W.innerWidth + 1) bad.push(c + ': horizontal overflow ' + D.documentElement.scrollWidth);
			if (c !== 'en' && text() === base) bad.push(c + ': text unchanged');
			if (c !== 'en') miss += I.misses.size;
			if (c === 'en') { var tn = text(); if (tn !== base) { var di = 0; while (di < base.length && base[di] === tn[di]) di++; bad.push('en: text differs from the baseline after cycle ' + (cy + 1) + ' at ' + di + ': "' + base.slice(Math.max(0, di - 25), di + 35) + '" => "' + tn.slice(Math.max(0, di - 25), di + 35) + '"'); } }
		}
		rec('i18n: 3 cycles en -> x-pseudo -> x-pseudo-rtl -> en: no reload, lang and dir set, picker stays top right, no overflow, English restored exactly', !bad.length, bad.slice(0, 4).join(' | ') + ' slowest swap ms ' + J(times));
		rec('i18n: no missed key while in x-pseudo and x-pseudo-rtl (ORION.i18n.misses empty)', !miss, miss ? J(Array.from(I.misses).slice(0, 8)) : '');
		/* the frozen peak: every non-whitespace text node of every zone carries a shadow and a transparent fill */
		var red = ROOT.dataset.motion === 'reduced' || (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
		T.freeze(1, 'after'); var pr = I.set('x-pseudo'); await until(function () { return T.held() === 'after'; }, 15000);
		var zs = $$('.i18n-zone'), nodes = 0, nogood = [], glow = I.stats.lastMode === 'glow';
		if (T.held() === 'after' && glow) {
			zs.forEach(function (z) {
				var w = D.createTreeWalker(z, NodeFilter.SHOW_TEXT, null), n, cs, a;
				while ((n = w.nextNode())) {
					if (!/\S/.test(n.nodeValue) || n.parentElement.closest('script,style,noscript,template,.lang,canvas,svg title,svg desc')) continue; nodes++;
					cs = getComputedStyle(n.parentElement); a = (cs.webkitTextFillColor || '').match(/[\d.]+/g) || [];
					var svg = !!n.parentElement.closest('svg'), alpha = /\/\s*0\)|, 0\)$|transparent/.test(cs.webkitTextFillColor || ''), sh = cs.textShadow && cs.textShadow !== 'none';
					if (svg ? (cs.filter === 'none' && +cs.opacity > 0.01) : (!sh || !alpha)) nogood.push((n.parentElement.tagName + '.' + n.parentElement.className).slice(0, 40) + ' fill=' + cs.webkitTextFillColor + ' shadow=' + String(cs.textShadow).slice(0, 20));
				}
			});
		}
		rec('i18n: at the frozen peak every text node in every zone has a text-shadow and a transparent fill', red ? true : (T.held() === 'after' && glow && nodes > 0 && !nogood.length), (red ? 'skipped: reduced motion (fade only). ' : '') + J({ held: T.held(), mode: I.stats.lastMode, zones: zs.length, textNodes: nodes, bad: nogood.slice(0, 3), nBad: nogood.length }));
		T.release(); await pr; await I.set('en'); await sleep(100);
		var ex = ORION.selftest._extra || [], again = 0, fl = [];
		for (var xi = 0; xi < ex.length; xi++) { try { var rr = await ex[xi].fn(); if (rr && rr.ok) again++; else fl.push(ex[xi].name + ': ' + (rr && rr.note)); } catch (e) { fl.push(ex[xi].name + ' threw ' + (e && e.message)); } }
		rec('i18n: the ' + ex.length + ' section steps pass again after the cycles (English)', !fl.length, again + ' of ' + ex.length + (fl.length ? ' | FAIL ' + fl.slice(0, 3).join(' || ') : ''));
		rec('i18n: still no reload after the section steps', W.__stNoReload === mark && I.lang === 'en', '');
	}
	async function viewerChecks(v, rec) {
		var J = JSON.stringify, n = 'viewer ' + v.name + ': ', c = v.camera, ctl = v.controls; if (!c || !ctl) return rec(n + 'keys and wheel', true, 'skipped: no controls');
		var key = function (k) { v.host.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
		var wheel = async function (o) { var d = v.distance(), e = new WheelEvent('wheel', Object.assign({ bubbles: true, cancelable: true }, o)); v.canvas.dispatchEvent(e); await sleep(250); return { prevented: e.defaultPrevented, moved: Math.abs(v.distance() - d) > 1e-6 }; };
		v.setActive(false); var p0 = c.position.clone(); key('ArrowRight'); await sleep(150); rec(n + 'ArrowRight rotates', p0.distanceTo(c.position) > 1e-4);
		var d0 = v.distance(); key('+'); await sleep(150); rec(n + '+ zooms in', v.distance() < d0 - 1e-6 || d0 <= ctl.minDistance + 1e-6, d0.toFixed(3) + ' -> ' + v.distance().toFixed(3));
		var f0 = frames; key('0'); await until(function () { return !v.tween; }, 2500); var resetOk = function () {
			if (!v.home || v.tween) return false;
			if (c.position.distanceTo(v.home.pos) < 0.01) return true;
			var a = c.position.clone().sub(ctl.target), b = v.home.pos.clone().sub(v.home.target);   /* auto-rotation keeps turning the azimuth: compare radius and polar angle */
			return !!ctl.autoRotate && Math.abs(a.length() - b.length()) < 0.01 * Math.max(1, b.length()) && Math.abs(a.y / a.length() - b.y / b.length()) < 0.01;
		};
		rec(n + '0 resets', resetOk() || frames - f0 < 5, 'frames ' + (frames - f0));
		var a = await wheel({ deltaY: 240 }); rec(n + 'plain wheel leaves page scrolling alone', !a.prevented && !a.moved, J(a));
		a = await wheel({ deltaY: -240, ctrlKey: true }); rec(n + 'Ctrl + wheel zooms and is prevented', a.prevented && a.moved, J(a));
		v.cameraTo(v.home.pos, v.home.target, 0); v.host.focus(); await sleep(50); if (!v.active) v.setActive(true);
		a = await wheel({ deltaY: -240 }); rec(n + 'activated viewer zooms on plain wheel', v.active && a.moved, J(a));
		v.host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await sleep(50); rec(n + 'Esc ends activation', !v.active); v.cameraTo(v.home.pos, v.home.target, 0);
	}
	ORION.__debug.runSelfTest = runSelfTest;
})();
