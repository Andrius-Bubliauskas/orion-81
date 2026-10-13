/* orion-81.io: js/i18n.js (ORI-1321, I18N.md section 3). Classic script, file:// safe: no fetch, no module; language packs load as <script> tags.
	Sections: 1 pure helpers (also loaded by the Node unit test) - 2 state and lookups - 3 packs and fonts - 4 applying a language - 5 swap animation - 6 picker - 7 boot. */
(function () {
	'use strict';
	var G = typeof window !== 'undefined' ? window : null;
	/* ---------- 1. pure helpers ---------- */
	var FMAP = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ł': 'l', 'ı': 'i', 'ŋ': 'n', 'ʼ': '', '’': '', '‘': '', 'ʻ': '', "'": '' };
	/* fold(): the picker's matching key (3.3): no case, no diacritics, a few letters that do not decompose */
	function fold(s) {
		return String(s == null ? '' : s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[ßæœøđðþłıŋʼ’‘ʻ']/g, function (c) { return FMAP[c]; }).replace(/\s+/g, ' ');
	}
	function norm(s) { return String(s).normalize('NFC').replace(/\s+/g, ' ').trim(); }
	/* data-string key (2.2): FNV-1a 32 bit over the UTF-16 code units of norm(s), base 36 */
	function dkey(s) {
		s = norm(s); var h = 0x811c9dc5, i;
		for (i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0; }
		return 'd.' + h.toString(36);
	}
	var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	/* the prose-date pattern shared with tools/i18n/extract.mjs (2.4): 8 Oct 2026, 8 October 2026, October 2026, 8 Oct */
	var MN = MONL.concat(MON).join('|');
	var RE_DATE = new RegExp('\\b(?:(\\d{1,2}) (' + MN + ')\\b(?: (\\d{4})\\b)?|(' + MONL.join('|') + ') (\\d{4})\\b)', 'g');
	function pad(n) { return (n < 10 ? '0' : '') + n; }
	function dateSpans(s) {
		var out = [], m, name, mi, full, y, d;
		RE_DATE.lastIndex = 0;
		while ((m = RE_DATE.exec(s))) {
			name = m[2] || m[4]; y = m[3] || m[5]; d = m[1] || '1'; full = name.length > 3;
			mi = (full ? MONL : MON).indexOf(name);
			if (mi < 0 || (!y && full && name !== 'May')) continue;
			out.push({ at: m.index, len: m[0].length, iso: (y || '2000') + '-' + pad(mi + 1) + '-' + pad(+d), fmt: m[4] ? 'MMMM y' : (m[1] ? 'd ' + (full ? 'MMMM' : 'MMM') + (y ? ' y' : '') : 'MMMM y') });
		}
		return out;
	}
	/* english text with {date0}.. placeholders (what the catalogue hashes) and the dates that were taken out */
	function placeholder(s) {
		var sp = dateSpans(s), out = '', at = 0, i;
		for (i = 0; i < sp.length; i++) { out += s.slice(at, sp[i].at) + '{date' + i + '}'; at = sp[i].at + sp[i].len; }
		return { text: out + s.slice(at), dates: sp };
	}
	function interp(s, vars) {
		return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && Object.prototype.hasOwnProperty.call(vars, k) && vars[k] != null ? String(vars[k]) : m; });
	}
	/* <0>wrapped</0> and <1/> slots (2.3) to a tree */
	function parseSlots(str) {
		var re = /<(\/?)(\d+)(\/?)>/g, rootN = { c: [] }, stack = [rootN], last = 0, m, top, n;
		function txt(e) { if (e > last) stack[stack.length - 1].c.push(str.slice(last, e)); }
		while ((m = re.exec(str))) {
			txt(m.index); last = re.lastIndex; top = stack[stack.length - 1];
			if (m[3]) top.c.push({ i: +m[2], self: true });
			else if (m[1]) { if (stack.length > 1 && top.i === +m[2]) stack.pop(); }
			else { n = { i: +m[2], c: [] }; top.c.push(n); stack.push(n); }
		}
		txt(str.length);
		return rootN.c;
	}
	if (!G) { if (typeof module === 'object' && module.exports) module.exports = { fold: fold, dkey: dkey, norm: norm, dateSpans: dateSpans, placeholder: placeholder, interp: interp, parseSlots: parseSlots }; return; }

	/* ---------- 2. state and lookups ---------- */
	var W = G, D = document, ROOT = D.documentElement;
	var ORION = W.ORION = W.ORION || {};
	var bus = ORION.bus || (ORION.bus = { on: function () {}, off: function () {}, emit: function () {} });
	var I = ORION.i18n = ORION.i18n || {};
	var params = new URLSearchParams(location.search), TESTING = params.has('selftest');
	var warn = function () { console.warn.apply(console, ['[orion] i18n'].concat([].slice.call(arguments))); };
	var $ = function (s, r) { return (r || D).querySelector(s); };
	var now = function () { return W.performance ? W.performance.now() : Date.now(); };
	var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
	var raf = function (f) { return requestAnimationFrame(f); };
	var lsGet = function (k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } };
	var lsSet = function (k, v) { try { W.localStorage.setItem(k, v); } catch (e) { /* storage blocked: the choice is just not remembered */ } };
	var lsDel = function (k) { try { W.localStorage.removeItem(k); } catch (e) { /* ignore */ } };
	var CODE_RE = /^(?:[a-z]{2}|x-pseudo(?:-rtl)?)$/;
	var ROWS = (W.ORION_LANGS || []).map(function (r) { return { c: r[0], a: r[1], e: r[2], d: r[3], s: r[4], t: r[5], n: r[6], idx: fold(r[1]) + '\u0001' + fold(r[2]) + '\u0001' + r[0] }; });
	var BY = {}; ROWS.forEach(function (r) { BY[r.c] = r; });
	var S = { code: 'en', L: BY.en || { c: 'en', a: 'English', e: 'English', d: 'ltr', s: 'Latn', t: 'en', n: '' }, P: null, E: null, packs: {}, loads: {}, req: 0, running: false, next: null, pr: null, hold: null, held: '', loc: 'en-GB-u-nu-latn', dcache: new Map(), boot: 'none' };
	var STATS = { zones: 0, peakMs: 0, frames: [], downgraded: false, lastMode: '', parts: {} };
	var SLOTS = new WeakMap();
	I.lang = 'en'; I.locale = S.loc; I.dir = 'ltr'; I.script = 'Latn'; I.lite = false; I.misses = TESTING ? new Set() : null; I.stats = STATS;
	function listed(c) { return !!BY[c] || c === 'x-pseudo' || c === 'x-pseudo-rtl'; }
	function pickPlural(forms, n) {
		var cat = S.pr && isFinite(+n) ? S.pr.select(+n) : (+n === 1 ? 'one' : 'other');
		var v = forms[cat]; if (v === undefined) v = forms.other; if (v === undefined) v = forms.one; if (v === undefined) v = forms[Object.keys(forms)[0]];
		return v;
	}
	/* ORION.t(key, english, vars): the pack's string, else the inline english (3.9) */
	function T(key, en, vars) {
		var v = en, p;
		if (S.code !== 'en' && S.P) { p = S.P.s[key]; if (p !== undefined) v = p; else if (I.misses) I.misses.add(key); }
		if (v && typeof v === 'object') v = pickPlural(v, vars && vars.n);
		return vars ? interp(v, vars) : v;
	}
	/* ORION.i18n.d(str): a display string of ORION_DATA / ORION_MEDIA (2.5) */
	function Dd(str) {
		if (S.code === 'en' || !S.P || typeof str !== 'string' || !str || !/[^\W\d_]/.test(str)) return str;   /* no letters (a number as text): nothing to translate, never a miss */
		var hit = S.dcache.get(str); if (hit !== undefined) return hit;
		var ph = placeholder(str), t = S.P.s[dkey(ph.text)], out = str;
		if (t !== undefined) {
			if (typeof t === 'object') t = pickPlural(t, 1);
			var vars = {}; ph.dates.forEach(function (d, i) { vars['date' + i] = fmtDate(d.iso, d.fmt); });
			out = interp(t, vars);
		} else if (I.misses) I.misses.add(dkey(ph.text));
		S.dcache.set(str, out); return out;
	}
	function fmtDate(iso, fmt) {
		var p = String(iso).split('-'), y = +p[0], m = +p[1] || 1, d = +p[2] || 1, dt, o = {};
		if (S.code === 'en') {
			if (fmt === 'MMMM y') return MONL[m - 1] + ' ' + y;
			if (fmt === 'd MMMM y') return d + ' ' + MONL[m - 1] + ' ' + y;
			return d + ' ' + MON[m - 1] + (fmt === 'd MMM y' ? ' ' + y : '');
		}
		dt = new Date(Date.UTC(y, m - 1, d)); o.timeZone = 'UTC';
		if (/d/.test(fmt)) o.day = 'numeric';
		o.month = /MMMM/.test(fmt) ? 'long' : 'short';
		if (/y/.test(fmt)) o.year = 'numeric';
		try { return new Intl.DateTimeFormat(S.loc, o).format(dt); } catch (e) { return String(iso); }
	}
	/* fill an element from a slot string with the given nodes (moved, never cloned) */
	function build(nodes, parent, slots) {
		nodes.forEach(function (x) {
			if (typeof x === 'string') { parent.append(x); return; }
			var el = slots[x.i]; if (!el) return;
			if (!x.self) { el.textContent = ''; build(x.c, el, slots); }
			parent.append(el);
		});
	}
	var HAS_SLOT = /<\/?\d+\/?>/;
	function fillText(n, str) {
		var f, slots;
		if (!HAS_SLOT.test(str)) {
			if (n.childNodes.length === 1 && n.firstChild.nodeType === 3) { if (n.firstChild.nodeValue !== str) n.firstChild.nodeValue = str; } else n.textContent = str;
			return;
		}
		slots = SLOTS.get(n); if (!slots) { slots = [].slice.call(n.querySelectorAll('*')); SLOTS.set(n, slots); }
		f = D.createDocumentFragment(); build(parseSlots(str), f, slots); n.replaceChildren(f);
	}
	I.fill = function (el, key, en, nodes) { var f = D.createDocumentFragment(); build(parseSlots(String(T(key, en))), f, nodes || []); el.replaceChildren(f); return el; };
	I.plural = function (n, forms) { return pickPlural(forms, n); };
	I.date = fmtDate; I.d = Dd; I.set = function (code, o) { return switchTo(code, o || {}); };
	I.list = ROWS; ORION.t = T;
	I._dateRe = RE_DATE; I._key = dkey;

	/* ---------- 3. packs and fonts ---------- */
	function loadPack(code) {
		if (S.loads[code]) return S.loads[code];
		var p = new Promise(function (res, rej) {
			var s, done = false, timer;
			function end(err) {
				if (done) return; done = true; clearTimeout(timer);
				if (err) { delete S.loads[code]; if (s && s.parentNode) s.remove(); rej(new Error(err)); return; }
				res(S.packs[code]);
			}
			if (!CODE_RE.test(code) || !listed(code)) { rej(new Error('not a listed language')); return; }
			if (W.ORION_I18N && W.ORION_I18N[code] && S.packs[code]) { res(S.packs[code]); return; }
			s = D.createElement('script'); s.charset = 'utf-8'; s.async = true;
			s.onload = function () {
				var pk = W.ORION_I18N && W.ORION_I18N[code];
				if (!pk || !pk.meta || pk.meta.format !== 1 || pk.meta.code !== code || !pk.s) { end('bad pack'); return; }
				S.packs[code] = pk; end();
			};
			s.onerror = function () { end('not found'); };
			timer = setTimeout(function () { end('timeout'); }, 12000);
			s.src = 'assets/i18n/' + code + '.js'; D.head.append(s);
		});
		S.loads[code] = p; p.catch(function () { /* handled by the caller */ }); return p;
	}
	var fontsDone = {};
	function fontReady(L) {
		var fam = L.n;
		if (!fam || !/^Noto [A-Za-z ]+$/.test(fam)) return Promise.resolve();
		if (!fontsDone[fam]) {
			var l = D.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + fam.replace(/ /g, '+') + '&display=swap'; D.head.append(l);
			fontsDone[fam] = Promise.race([D.fonts && D.fonts.load ? D.fonts.load('1em "' + fam + '"', L.a).catch(function () {}) : Promise.resolve(), sleep(3000)]);
		}
		return fontsDone[fam];
	}

	/* ---------- 4. applying a language ---------- */
	function supported(loc) { try { return Intl.PluralRules.supportedLocalesOf([loc]).length > 0; } catch (e) { return false; } }
	function dataNum(path) { var o = W.ORION_DATA; String(path).split('.').forEach(function (k) { o = o == null ? undefined : o[k]; }); return o; }
	function lookup(k) {
		var v = S.P.s[k];
		if (v === undefined && S.code !== 'en') { if (I.misses) I.misses.add(k); v = S.E && S.E.s[k]; }
		return v;
	}
	function applyDom() {
		var nodes = D.querySelectorAll('[data-i18n],[data-i18n-d],[data-i18n-attr],time[data-i18n-date]'), i, n, k, v, a, ps, j, pr;
		for (i = 0; i < nodes.length; i++) {
			n = nodes[i];
			if (n.__oen === undefined) n.__oen = n.children.length ? null : n.textContent;
			k = n.getAttribute('data-i18n');
			if (k != null) {
				v = lookup(k); if (v === undefined) v = n.__oen;
				if (v && typeof v === 'object') v = pickPlural(v, dataNum(n.getAttribute('data-i18n-count')));
				if (typeof v === 'string') fillText(n, v);
			} else if ((k = n.getAttribute('data-i18n-d')) != null) {
				v = lookup(k); if (v === undefined) v = n.__oen;
				if (typeof v === 'string' && n.__oen != null) { pr = placeholder(n.__oen).dates; v = interp(v, pr.reduce(function (o, d, x) { o['date' + x] = fmtDate(d.iso, d.fmt); return o; }, {})); fillText(n, v); }
			}
			a = n.getAttribute('data-i18n-attr');
			if (a) {
				ps = a.split(';');
				for (j = 0; j < ps.length; j++) {
					k = ps[j].split(':'); if (k.length < 2) continue;
					v = lookup(k[1].trim()); if (typeof v === 'string') n.setAttribute(k[0].trim(), v);
				}
			}
			if (n.localName === 'time' && n.hasAttribute('data-i18n-date')) n.textContent = fmtDate(n.getAttribute('datetime'), n.getAttribute('data-i18n-date'));
		}
	}
	function fitSvg() {
		[].forEach.call(D.querySelectorAll('[data-i18n-fit]'), function (t) {
			var max = +t.getAttribute('data-i18n-fit'), len, fs, k;
			t.removeAttribute('textLength'); t.removeAttribute('lengthAdjust'); t.style.fontSize = '';
			try { len = t.getComputedTextLength(); } catch (e) { return; }
			if (!(len > max)) return;
			fs = parseFloat(getComputedStyle(t).fontSize) || 12; k = max / len;
			if (k >= 0.7) t.style.fontSize = (fs * k).toFixed(2) + 'px';
			else { t.style.fontSize = (fs * 0.7).toFixed(2) + 'px'; t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
		});
	}
	/* the chapter links must fit the bar in every language, else the bar uses its Menu mode (3.1) */
	function checkCompact() {
		var bar = $('#bar'), inner = bar && $('.bar__inner', bar), lis; if (!inner) return;
		bar.classList.remove('bar--compact');
		if (W.innerWidth < 992) return;
		lis = [].slice.call(inner.querySelectorAll('.bar__links li'));
		if (inner.scrollWidth > inner.clientWidth + 1 || (lis.length && lis.some(function (li) { return li.offsetTop - lis[0].offsetTop > 4; }))) bar.classList.add('bar--compact');
	}
	function scrollAnchor() {
		var bar = $('#bar'), bh = bar ? bar.getBoundingClientRect().bottom : 0, hs = D.querySelectorAll('.chapter h1, .chapter h2, .chapter h3'), i, r;
		for (i = 0; i < hs.length; i++) { r = hs[i].getBoundingClientRect(); if (r.top >= bh && r.height) return { el: hs[i], top: r.top, sy: W.scrollY }; }
		return null;
	}
	function restoreScroll(a) {
		if (!a || !a.el.isConnected) return;
		var d = a.el.getBoundingClientRect().top - (a.top - (W.scrollY - a.sy));
		if (Math.abs(d) > 1) { var old = ROOT.style.scrollBehavior; ROOT.style.scrollBehavior = 'auto'; W.scrollBy(0, d); ROOT.style.scrollBehavior = old; }
	}
	function applyLanguage(code) {
		var pk = S.packs[code], m = pk.meta, L = BY[code] || { c: code, a: m.autonym || code, e: m.en || code, d: m.dir || 'ltr', s: m.script || 'Latn', t: m.bcp47 || 'en', n: '' }, prev = S.code, tag = code === 'en' ? 'en-GB' : L.t, loc = tag + '-u-nu-latn';
		if (!supported(loc)) loc = 'en-GB-u-nu-latn';
		S.code = code; S.L = L; S.P = pk; S.E = code === 'en' ? pk : (S.packs.en || null); S.loc = loc; S.dcache.clear();
		try { S.pr = Intl.PluralRules.supportedLocalesOf([loc]).length ? new Intl.PluralRules(loc) : null; } catch (e) { S.pr = null; }
		I.lang = code; I.locale = loc; I.dir = L.d; I.script = L.s;
		var t0 = now(), t1, P = STATS.parts = {};
		ROOT.lang = tag; ROOT.dir = L.d; ROOT.setAttribute('data-script', L.s);
		applyDom(); t1 = now(); P.dom = t1 - t0;
		bus.emit('lang', { code: code, prev: prev, locale: loc, dir: L.d, script: L.s }); P.bus = now() - t1; t1 = now();
		if (ORION.refreshBinds) ORION.refreshBinds(D); else if (ORION.refresh) ORION.refresh(D);
		P.binds = now() - t1; t1 = now(); fitSvg(); P.fit = now() - t1; t1 = now(); checkCompact(); P.compact = now() - t1; t1 = now(); updatePicker(); P.picker = now() - t1;
	}

	/* ---------- 5. the swap animation ---------- */
	var MQ_RM = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
	var MQ_FC = W.matchMedia ? W.matchMedia('(forced-colors: active)') : { matches: false };
	function reducedMotion() { var m = ROOT.dataset.motion; return m ? m === 'reduced' : MQ_RM.matches; }
	function canGlow() { return !!(W.CSS && CSS.registerProperty) && !MQ_FC.matches; }
	var SKIPTAG = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1 };
	function hasOwnText(e) { var c = e.firstChild; while (c) { if (c.nodeType === 3 && /\S/.test(c.nodeValue)) return true; c = c.nextSibling; } return false; }
	function markZones() {
		var vh = W.innerHeight, vw = W.innerWidth, zs = [], roots = [];
		var b = $('#bar'), f = $('#footer'); if (b) roots.push(b); [].forEach.call(D.querySelectorAll('.chapter'), function (c) { roots.push(c); }); if (f) roots.push(f);
		function walk(e, d) {
			if (SKIPTAG[e.tagName] || e.classList.contains('lang') || e.tagName === 'CANVAS') return;
			var r = e.getBoundingClientRect(), kids;
			if (!(r.width && r.height && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)) return;
			kids = [].filter.call(e.children, function (k) { return !SKIPTAG[k.tagName] && !k.classList.contains('lang'); });
			if ((r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw) || d >= 3 || hasOwnText(e) || !kids.length || (kids.length === 1 && !kids[0].children.length)) zs.push(e);
			else kids.forEach(function (k) { walk(k, d + 1); });
		}
		roots.forEach(function (r) { walk(r, 0); });
		for (var guard = 0; zs.length > 24 && guard < 6; guard++) {
			var up = []; zs.forEach(function (z) { var p = z.parentElement; if (p && !roots.includes(z) && p !== D.body && p.id !== 'main') z = p; if (up.indexOf(z) < 0) up.push(z); });
			zs = up.filter(function (z) { return !up.some(function (o) { return o !== z && o.contains(z); }); });
		}
		return zs;
	}
	function endOf(z, name, ms) {
		return new Promise(function (res) {
			var t = setTimeout(done, ms);
			function done() { clearTimeout(t); z.removeEventListener('animationend', on); res(); }
			function on(e) { if (e.target === z && e.animationName === name) done(); }
			z.addEventListener('animationend', on);
		});
	}
	function markLite(zones) { STATS.downgraded = true; I.lite = true; zones.forEach(function (z) { z.classList.add('i18n-reduced'); }); }
	/* times the first frames of the glow-up (3.5): two frames over 33 ms or a mean over 20 ms switches this swap, and later ones, to the reduced fade */
	function frameWatch(zones, state) {
		var last = 0, n = 0, slow = 0, sum = 0, force = TESTING && params.get('i18nglow') === 'force';
		STATS.frames = [];
		state.bad = function () { return !force && n > 0 && (slow >= 2 || sum / n > 20); };
		(function f(t) {
			if (!state.on) return;
			if (last) {
				var d = t - last; n++; sum += d; STATS.frames.push(Math.round(d * 10) / 10); if (d > 33) slow++;
				if (state.bad() && (slow >= 2 || n >= 8)) { markLite(zones); return; }
				if (n >= 8) return;
			}
			last = t; raf(f);
		})(0);
	}
	function runSwap(code, o) {
		var lite = I.lite || reducedMotion(), instant = o.instant || !canGlow() || D.hidden, anchor, zones, st = { on: true }, t0;
		function peak() {
			t0 = now(); zones.forEach(function (z) { z.classList.remove('i18n-out'); z.classList.add('i18n-peak'); });
			applyLanguage(code); var t2 = now(); restoreScroll(anchor); STATS.parts.scroll = now() - t2;
			if (!instant) cover();
			STATS.peakMs = Math.round((now() - t0) * 10) / 10;
		}
		/* the new language re-flows the page: text that was off screen before may now be in view. It becomes a zone in this same task, before anything is painted, so no letter shows at the peak */
		function cover() {
			var red = I.lite || reducedMotion(), extra = markZones().filter(function (z) { return !zones.some(function (o) { return o === z || o.contains(z); }); });
			extra.forEach(function (z) { z.classList.add('i18n-zone', 'i18n-peak'); if (red) z.classList.add('i18n-reduced'); if (S.hold) { z.classList.add('i18n-hold'); z.style.setProperty('--i18n-g', S.hold.g); } zones.push(z); });
			STATS.extraZones = extra.length;
		}
		if (instant) { STATS.lastMode = 'instant'; zones = []; anchor = scrollAnchor(); peak(); return Promise.resolve(); }
		anchor = scrollAnchor(); zones = markZones(); STATS.zones = zones.length; STATS.downgraded = false; STATS.lastMode = lite ? 'reduced' : 'glow';
		var main = $('#main'); if (main) main.setAttribute('aria-busy', 'true');
		ROOT.classList.add('i18n-busy');
		zones.forEach(function (z) { z.classList.add('i18n-zone', 'i18n-out'); if (lite) z.classList.add('i18n-reduced'); });
		if (!lite) frameWatch(zones, st);
		var first = zones.find(function (z) { return z.offsetParent !== null || z === $('#bar'); }) || zones[0];
		function clean() { zones.forEach(function (z) { z.classList.remove('i18n-zone', 'i18n-in', 'i18n-out', 'i18n-peak', 'i18n-reduced', 'i18n-hold'); z.style.removeProperty('--i18n-g'); }); }
		return (first ? endOf(first, 'i18n-up', 520) : sleep(0)).then(function () {
			st.on = false;
			if (!lite && st.bad && st.bad()) markLite(zones);
			if (S.hold) {
				zones.forEach(function (z) { z.classList.remove('i18n-out'); z.classList.add('i18n-peak', 'i18n-hold'); z.style.setProperty('--i18n-g', S.hold.g); });
				if (S.hold.side === 'before') { S.held = 'before'; return new Promise(function (r) { S.hold.step = r; }); }
			}
		}).then(function () {
			peak();
			if (S.hold) { S.held = 'after'; return new Promise(function (r) { S.hold.release = r; }).then(function () { zones.forEach(function (z) { z.classList.remove('i18n-hold'); z.style.removeProperty('--i18n-g'); }); S.hold = null; S.held = ''; }); }
		}).then(function () { return new Promise(function (r) { raf(function () { raf(r); }); }); }).then(function () {
			var z0 = zones.find(function (z) { return z.isConnected; });
			zones.forEach(function (z) { z.classList.remove('i18n-peak'); z.classList.add('i18n-in'); });
			return z0 ? endOf(z0, 'i18n-down', (zones[0] && zones[0].classList.contains('i18n-reduced') ? 180 : 640) + 80) : sleep(0);
		}).then(function () {
			clean(); ROOT.classList.remove('i18n-busy'); if (main) main.setAttribute('aria-busy', 'false');
		}, function (e) { clean(); ROOT.classList.remove('i18n-busy'); if (main) main.setAttribute('aria-busy', 'false'); throw e; });
	}

	/* ---------- 6. the picker ---------- */
	var U = {}; /* picker elements, filled by buildPicker() */
	var open = false, typed = false, vis = [], active = -1, msgTimer = 0, cntTimer = 0;
	var NS = 'http://www.w3.org/2000/svg';
	function svgEl(cls, d, vb) {
		var s = D.createElementNS(NS, 'svg'), p; s.setAttribute('viewBox', vb || '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.setAttribute('class', cls);
		[].concat(d).forEach(function (x) { p = D.createElementNS(NS, x[0]); for (var k in x[1]) p.setAttribute(k, x[1][k]); s.append(p); }); return s;
	}
	function mk(tag, attrs, kids) {
		var n = D.createElement(tag), k;
		for (k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
		[].concat(kids || []).forEach(function (c) { if (c != null) n.append(c); });
		return n;
	}
	function buildPicker() {
		var bar = $('#bar .bar__inner'); if (!bar || !ROWS.length) { if (!ROWS.length) warn('ORION_LANGS missing: no picker'); return; }
		var rows = ROWS.map(function (r) {
			var kids = [mk('span', { class: 'lang__auto', lang: r.t, dir: r.d }, [r.a])];
			if (r.a !== r.e) kids.push(mk('span', { class: 'lang__sep', 'aria-hidden': 'true' }, [' - ']), mk('span', { class: 'lang__en', lang: 'en' }, [r.e]));
			kids.push(svgEl('lang__tick', [['path', { d: 'M5 12.5l4.5 4.5L19 7.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]]));
			var li = mk('li', { role: 'option', id: 'lang-o-' + r.c, 'data-code': r.c, 'aria-selected': 'false' }, kids); r.li = li; return li;
		});
		U.label = mk('label', { class: 'sr-only', for: 'lang-input' });
		U.input = mk('input', { id: 'lang-input', class: 'lang__input', type: 'text', role: 'combobox', dir: 'auto', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'lang-list', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'done' });
		U.btn = mk('button', { class: 'lang__open', type: 'button', tabindex: '-1', 'aria-controls': 'lang-list', 'aria-expanded': 'false' }, [svgEl('lang__chev', [['path', { d: 'M6 9.5l6 6 6-6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]])]);
		U.globe = svgEl('lang__globe', [['circle', { cx: '12', cy: '12', r: '9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }], ['path', { d: 'M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }]]);
		U.spin = svgEl('lang__spin', [['circle', { cx: '12', cy: '12', r: '8', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-dasharray': '30 20', 'stroke-linecap': 'round' }]]);
		U.field = mk('div', { class: 'lang__field' }, [U.globe, U.spin, U.input, U.btn]);
		U.msg = mk('p', { class: 'lang__msg small', id: 'lang-msg', hidden: '' });
		U.status = mk('p', { class: 'sr-only', id: 'lang-status', role: 'status', 'aria-live': 'polite' });
		U.list = mk('ul', { class: 'lang__list', id: 'lang-list', role: 'listbox' }, rows);
		U.empty = mk('p', { class: 'lang__empty', id: 'lang-empty', hidden: '' });
		U.note = mk('p', { class: 'lang__note small', id: 'lang-note' });
		U.pop = mk('div', { class: 'lang__pop', id: 'lang-pop', hidden: '' }, [U.list, U.empty, U.note]);
		U.root = mk('div', { class: 'lang', id: 'lang' }, [U.label, U.field, U.msg, U.status, U.pop]);
		bar.append(U.root); ROOT.classList.add('i18n-ready');
		var rz; W.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(checkCompact, 150); });
		W.addEventListener('load', checkCompact); if (D.fonts && D.fonts.ready) D.fonts.ready.then(checkCompact);
		checkCompact();
		var inp = U.input;
		inp.addEventListener('focus', function () { try { inp.select(); } catch (e) { /* ignore */ } });
		var fresh = false; inp.addEventListener('mousedown', function () { fresh = D.activeElement !== inp; });
		inp.addEventListener('mouseup', function (e) { if (fresh) { fresh = false; e.preventDefault(); try { inp.select(); } catch (x) { /* ignore */ } } });
		inp.addEventListener('click', function () { if (!open) openPop(false); });
		inp.addEventListener('input', onInput);
		inp.addEventListener('keydown', onKey);
		U.globe.addEventListener('click', function () { inp.focus(); if (!open) openPop(false); });
		U.spin.addEventListener('click', function () { inp.focus(); });
		U.btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
		U.btn.addEventListener('click', function () { inp.focus(); if (open) closePop(true); else openPop(false); });
		U.field.addEventListener('mousedown', function (e) { if (e.target !== inp && e.target !== U.btn && !U.btn.contains(e.target)) { e.preventDefault(); inp.focus(); } });
		U.pop.addEventListener('mousedown', function (e) { e.preventDefault(); });
		U.list.addEventListener('click', function (e) { var li = e.target.closest && e.target.closest('li[data-code]'); if (li) pick(li.getAttribute('data-code')); });
		U.root.addEventListener('focusout', function (e) { if (open && !(e.relatedTarget && U.root.contains(e.relatedTarget))) closePop(true); });
		D.addEventListener('pointerdown', function (e) { if (open && !U.root.contains(e.target)) closePop(true); }, true);
		U.empty.hidden = true;
		updatePicker();
	}
	function updatePicker() {
		if (!U.root) return;
		var L = S.L, en = S.code === 'en', q = S.P && S.P.meta && S.P.meta.quality === 'best-effort';
		U.root.setAttribute('lang', S.code === 'en' ? 'en' : L.t); U.root.setAttribute('dir', L.d);
		U.status.lang = U.msg.lang = U.root.lang; U.status.dir = U.msg.dir = L.d;
		U.label.textContent = ORION.t('picker.label', 'Language');
		U.btn.setAttribute('aria-label', ORION.t('picker.open', 'Show all languages'));
		U.list.setAttribute('aria-label', ORION.t('picker.listLabel', 'Languages'));
		U.empty.textContent = ORION.t('picker.none', 'No language matches');
		U.note.textContent = ORION.t('picker.note', 'AI translation by Claude. It may contain mistakes; English is the original.') + (q ? ' ' + ORION.t('picker.noteBestEffort', 'This language has little written material, so expect more mistakes.') : '');
		if (!open || !typed) setField();
		setDescribe();
		ROWS.forEach(function (r) { if (r.c === S.code) r.li.setAttribute('data-current', ''); else r.li.removeAttribute('data-current'); });
	}
	function setField() { U.input.value = S.L.a; U.input.setAttribute('lang', S.code === 'en' ? 'en' : S.L.t); selectField(); }
	/* a focused field keeps its whole value selected, so the next typing replaces it (3.2) */
	function selectField() { if (D.activeElement === U.input) { try { U.input.select(); } catch (e) { /* ignore */ } } }
	function setDescribe() {
		var ids = []; if (S.code !== 'en') ids.push('lang-note'); if (!U.msg.hidden) ids.push('lang-msg');
		if (ids.length) U.input.setAttribute('aria-describedby', ids.join(' ')); else U.input.removeAttribute('aria-describedby');
	}
	function say(text) { U.status.textContent = ''; setTimeout(function () { U.status.textContent = text; }, 30); }
	function showMsg(text) {
		U.msg.textContent = text; U.msg.hidden = false; setDescribe(); say(text);
		clearTimeout(msgTimer); msgTimer = setTimeout(hideMsg, 10000);
	}
	function hideMsg() { clearTimeout(msgTimer); if (!U.msg.hidden) { U.msg.hidden = true; U.msg.textContent = ''; setDescribe(); } }
	function openPop(withActive) {
		if (open) return; open = true; typed = false; hideMsg();
		U.pop.hidden = false; U.root.classList.add('lang--open'); U.input.setAttribute('aria-expanded', 'true'); U.btn.setAttribute('aria-expanded', 'true');
		filter('', true);
		if (withActive) setActive(vis.indexOf(BY[S.code]) >= 0 ? vis.indexOf(BY[S.code]) : 0, true);
		else setActive(Math.max(0, vis.indexOf(BY[S.code])), true);
	}
	function closePop(restore) {
		if (!open) { if (restore) { typed = false; setField(); } return; }
		open = false; clearTimeout(cntTimer);
		U.pop.hidden = true; U.root.classList.remove('lang--open'); U.input.setAttribute('aria-expanded', 'false'); U.btn.setAttribute('aria-expanded', 'false'); U.input.removeAttribute('aria-activedescendant');
		if (active >= 0 && vis[active]) vis[active].li.setAttribute('aria-selected', 'false');
		active = -1;
		if (restore) { typed = false; setField(); }
	}
	function filter(q, quiet) {
		var f = fold(q).trim(), exact = null;
		vis = ROWS.filter(function (r) { var m = !f || r.idx.indexOf(f) >= 0; r.li.hidden = !m; if (m && f.length === 2 && r.c === f) exact = r; return m; });
		if (exact) { vis.splice(vis.indexOf(exact), 1); vis.unshift(exact); U.list.prepend(exact.li); }
		else if (U.list.firstChild !== ROWS[0].li) ROWS.forEach(function (r) { U.list.append(r.li); });
		U.empty.hidden = vis.length > 0;
		if (!quiet) { clearTimeout(cntTimer); cntTimer = setTimeout(function () { say(vis.length ? ORION.t('picker.count', { one: '{n} language', other: '{n} languages' }, { n: vis.length }) : ORION.t('picker.none', 'No language matches')); }, 400); }
	}
	function setActive(i, noScroll) {
		if (active >= 0 && vis[active]) vis[active].li.setAttribute('aria-selected', 'false');
		active = vis.length ? ((i % vis.length) + vis.length) % vis.length : -1;
		if (active < 0) { U.input.removeAttribute('aria-activedescendant'); return; }
		var li = vis[active].li; li.setAttribute('aria-selected', 'true'); U.input.setAttribute('aria-activedescendant', li.id);
		var lt = U.list, top = li.offsetTop, bot = top + li.offsetHeight;
		if (top < lt.scrollTop) lt.scrollTop = top; else if (bot > lt.scrollTop + lt.clientHeight) lt.scrollTop = bot - lt.clientHeight;
	}
	function onInput() {
		typed = true; hideMsg();
		if (!open) { open = false; openPop(false); typed = true; }
		filter(U.input.value); setActive(U.input.value.trim() ? 0 : Math.max(0, vis.indexOf(BY[S.code])), false);
	}
	function onKey(e) {
		var k = e.key;
		if (e.isComposing) return;
		if (k === 'ArrowDown' || k === 'ArrowUp') {
			e.preventDefault();
			if (!open) { openPop(true); return; }
			if (e.altKey) { if (k === 'ArrowUp') closePop(true); return; }
			setActive(active + (k === 'ArrowDown' ? 1 : -1), false);
		} else if (k === 'PageDown' || k === 'PageUp') { if (open) { e.preventDefault(); setActive(Math.max(0, Math.min(vis.length - 1, active + (k === 'PageDown' ? 10 : -10))), false); } }
		else if (k === 'Enter') { if (open && active >= 0) { e.preventDefault(); pick(vis[active].c); } }
		else if (k === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); } closePop(true); }
		else if (k === 'Tab') closePop(true);
	}
	function pick(code) {
		closePop(false); typed = false;
		if (code === S.code && !S.running && S.next == null) { setField(); return; }
		U.input.value = BY[code].a; U.input.setAttribute('lang', BY[code].t); selectField();
		switchTo(code, { save: true });
	}
	function busyUI(on) { if (!U.root) return; U.root.classList.toggle('lang--busy', on); if (on) U.input.setAttribute('aria-busy', 'true'); else U.input.removeAttribute('aria-busy'); }

	/* ---------- switching (3.4, 3.5) ---------- */
	function failMsg(code, err) {
		warn(code, err && err.message || err);
		busyUI(false); if (U.root) { setField(); showMsg(ORION.t('picker.failed', '{language} could not be loaded. The page stays in {current}.', { language: (BY[code] || { a: code }).a, current: S.L.a })); }
	}
	function switchTo(code, o) {
		if (!CODE_RE.test(code) || !listed(code)) return Promise.reject(new Error('unknown language'));
		var id = ++S.req;
		if (S.running) { S.next = { code: code, o: o }; return Promise.resolve(); }
		S.next = null; if (U.root) hideMsg(); busyUI(true);
		var L = BY[code] || { a: code, n: '' };
		var jobs = [loadPack(code), code === 'en' ? null : loadPack('en').catch(function (e) { warn('en', e.message); }), fontReady(L)];
		return Promise.all(jobs).then(function () {
			if (id !== S.req) return;
			if (code === S.code && !o.force) { busyUI(false); return; }
			S.running = true;
			return runSwap(code, o).then(function () {
				S.running = false; busyUI(false);
				if (o.save !== false) { if (code === 'en') lsDel('orion.lang'); else lsSet('orion.lang', code); }
				if (U.root) say(ORION.t('picker.changed', 'Language: {language}', { language: S.L.a }));
				if (S.next) { var n = S.next; S.next = null; return switchTo(n.code, n.o); }
			}, function (e) { S.running = false; ROOT.classList.remove('i18n-busy'); failMsg(code, e); });
		}, function (e) { if (id === S.req) failMsg(code, e); });
	}

	/* ---------- 7. boot ---------- */
	function reveal() {
		ROOT.removeAttribute('data-i18n-boot'); ROOT.removeAttribute('data-i18n-want');
		if (!reducedMotion()) { ROOT.classList.add('i18n-reveal'); setTimeout(function () { ROOT.classList.remove('i18n-reveal'); }, 260); }
	}
	function whenParsed(f) { if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function () { setTimeout(f, 0); }, { once: true }); else setTimeout(f, 0); }
	function boot() {
		var want = ROOT.getAttribute('data-i18n-want'), byUrl = /[?&]lang=/.test(location.search), gave = false;
		if (ROOT.getAttribute('data-i18n-boot') !== 'pending' && !want) return;
		if (!want || !CODE_RE.test(want) || !listed(want) || want === 'en') { ROOT.removeAttribute('data-i18n-boot'); ROOT.removeAttribute('data-i18n-want'); return; }
		S.boot = 'pending';
		var giveUp = setTimeout(function () { gave = true; S.boot = 'late'; ROOT.removeAttribute('data-i18n-boot'); ROOT.removeAttribute('data-i18n-want'); }, Math.max(0, 1500 - now()));
		var L = BY[want] || { a: want, n: '' };
		Promise.all([loadPack(want), loadPack('en').catch(function () {}), fontReady(L), new Promise(function (r) { whenParsed(r); })]).then(function () {
			clearTimeout(giveUp);
			if (gave) { switchTo(want, { save: !byUrl }); return; }
			applyLanguage(want); S.boot = 'done'; reveal();
		}, function (e) { clearTimeout(giveUp); warn(want, e && e.message); S.boot = 'failed'; if (!gave) reveal(); });
	}

	/* ---------- test hooks (selftest only) ---------- */
	if (TESTING) {
		I._test = {
			freeze: function (g, side) { S.hold = { g: +g, side: side || 'after' }; },
			step: function () { var h = S.hold; if (h && h.step) { var s = h.step; h.step = null; s(); } },
			release: function () { var h = S.hold; if (h && h.release) { var r = h.release; h.release = null; r(); } },
			held: function () { return S.held; },
			zones: function () { return [].map.call(D.querySelectorAll('.i18n-zone'), function (z) { return z.tagName.toLowerCase() + (z.id ? '#' + z.id : '') + (z.className ? '.' + String(z.className).split(' ')[0] : ''); }); },
			markZones: function () { return markZones(); },
			pickPlural: pickPlural, fold: fold, fmtDate: fmtDate
		};
	}
	W.__orionBootId = W.__orionBootId || Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	if (W.ORION_I18N && W.ORION_I18N.en && W.ORION_I18N.en.meta) S.packs.en = W.ORION_I18N.en;
	buildPicker();
	boot();
})();
