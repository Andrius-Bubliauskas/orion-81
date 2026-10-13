/* orion-81.io mock: js/sec-ships.js (ships task, ORI-1305). Classic script, file:// safe: no fetch, no module, no image textures.
	DESIGN.md 4.1 (Ships explorer), 5.4 (viewer), 5.5 (kit), 5.7 (models), 6.2 (copy). Registers 'ships'. */
(function () {
	'use strict';
	var W = window, D = document, O = W.ORION;
	if (!O || !O.register) return;
	var FAMS = ['laser', 'rocket', 'rail', 'gun', 'pd'];
	function lc(x) { return O.i18n.lang === 'en' ? String(x).toLowerCase() : String(x); } /* English lower-casing only: other scripts and German nouns keep their case */
	function famName(f) {
		switch (f) {
			case 'laser': return O.t('ships.fam.laser', 'Lasers'); case 'rocket': return O.t('ships.fam.rocket', 'Rockets'); case 'rail': return O.t('ships.fam.rail', 'Railguns');
			case 'gun': return O.t('ships.fam.gun', 'Miniguns'); case 'pd': return O.t('ships.fam.pd', 'Point defence');
		}
		return String(f);
	}
	function wordOf(id) {
		switch (id) {
			case 'laser': return O.t('ships.word.laser', 'laser'); case 'rocket': return O.t('ships.word.rocket', 'rocket'); case 'railgun': return O.t('ships.word.railgun', 'railgun');
			case 'minigun': return O.t('ships.word.minigun', 'minigun'); case 'point defence': return O.t('ships.word.pointDefence', 'point defence');
			case 'rail': return O.t('ships.word.rail', 'rail'); case 'gun': return O.t('ships.word.gun', 'gun'); case 'pd': return O.t('ships.word.pd', 'pd');
			case 'light': return O.t('ships.word.light', 'light'); case 'medium': return O.t('ships.word.medium', 'medium'); case 'large': return O.t('ships.word.large', 'large');
			case 'heavy': return O.t('ships.word.heavy', 'heavy'); case 'screen': return O.t('ships.word.screen', 'screen'); case 'strike': return O.t('ships.word.strike', 'strike');
		}
		return String(id);
	}
	function famWord(f) { return wordOf(f === 'rail' ? 'railgun' : f === 'gun' ? 'minigun' : f === 'pd' ? 'point defence' : f); }
	function friendlyHp(hp) {
		var m = /(\d+)$/.exec(hp.name || ''), v = { n: m ? m[1] : '' }, k = hp.kind, f = hp.siteFamily, r;
		if (k === 'fixed' && f === 'laser') r = O.t('ships.hp.fixedLaser', 'Fixed laser {n}', v);
		else if (k === 'fixed' && f === 'gun') r = O.t('ships.hp.fixedGun', 'Fixed minigun {n}', v);
		else if (k === 'turret' && f === 'laser') r = O.t('ships.hp.laserTurret', 'Laser turret {n}', v);
		else if (k === 'turret' && f === 'gun') r = O.t('ships.hp.gunTurret', 'Minigun turret {n}', v);
		else if (k === 'launcher' && f === 'rocket') r = O.t('ships.hp.rocketLauncher', 'Rocket launcher {n}', v);
		else if (k === 'spinal' && f === 'rail') r = O.t('ships.hp.spinalRail', 'Spinal railgun {n}', v);
		else if (k === 'railturret') r = O.t('ships.hp.railTurret', 'Railgun turret {n}', v);
		else if (k === 'pd') r = O.t('ships.hp.pd', 'Point defence {n}', v);
		else r = famWord(f) + (v.n ? ' ' + v.n : '');
		return r.trim();
	}
	function kindWord(k) {
		switch (k) {
			case 'fixed': return O.t('ships.kind.fixed', 'fixed'); case 'turret': return O.t('ships.kind.turret', 'turret'); case 'pd': return wordOf('pd');
			case 'launcher': return O.t('ships.kind.launcher', 'launcher'); case 'spinal': return O.t('ships.kind.spinal', 'spinal'); case 'railturret': return O.t('ships.kind.railturret', 'railturret');
		}
		return String(k);
	}
	function kindDesc(k) {
		switch (k) {
			case 'fixed': return O.t('ships.kindDesc.fixed', 'fixed mount'); case 'turret': return O.t('ships.kindDesc.turret', 'turret'); case 'pd': return O.t('ships.kindDesc.pd', 'point-defence mount');
			case 'launcher': return O.t('ships.kindDesc.launcher', 'launcher'); case 'spinal': return O.t('ships.kindDesc.spinal', 'spinal mount'); case 'railturret': return O.t('ships.kindDesc.railturret', 'rail turret');
		}
		return '';
	}
	function ctrlText(c) {
		if (c == null) return O.t('ships.ctrl.none', 'none (no mode choice)');
		if (c === 'switch') return O.t('ships.ctrl.switch', 'switch (manual or AUTO)');
		if (c === 'auto') return O.t('ships.ctrl.auto', 'auto');
		if (c === 'pd') return O.t('ships.ctrl.pd', 'pd (automatic point defence)');
		return String(c);
	}
	function profileWord(p) {
		switch (p) {
			case 'fighter': return O.t('ships.profile.fighter', 'fighter'); case 'gunboat': return O.t('ships.profile.gunboat', 'gunboat'); case 'hauler': return O.t('ships.profile.hauler', 'hauler');
			case 'capital': return O.t('ships.profile.capital', 'capital'); case 'carrier': return O.t('ships.profile.carrier', 'carrier');
		}
		return String(p);
	}
	function bandWord(b) {
		switch (b) { case 'fighter': return O.t('ships.band.fighter', 'fighter'); case 'mid': return O.t('ships.band.mid', 'mid'); case 'capital': return O.t('ships.band.capital', 'capital'); }
		return String(b);
	}
	var TURRETY = { turret: 1, pd: 1, railturret: 1 };
	var SORTS = {
		length: { f: function (s) { return s.lengthM; }, dir: 1 },
		mass: { f: function (s) { return s.massT; }, dir: 1 },
		speed: { f: function (s) { return s.cruiseMs; }, dir: -1 },
		dps: { f: function (s) { return s.dps; }, dir: -1 }
	};
	function sortText(k) {
		switch (k) {
			case 'length': return O.t('ships.sort.length', 'length, short to long'); case 'mass': return O.t('ships.sort.mass', 'mass, light to heavy');
			case 'speed': return O.t('ships.sort.speed', 'speed, fastest first'); default: return O.t('ships.sort.dps', 'firepower, highest first');
		}
	}
	var BARS = [['speed', 'cruiseMs'], ['agility', 'turnDegS'], ['armour', 'armor'], ['shields', 'shield'], ['firepower', 'dps']];
	function barName(id) {
		switch (id) {
			case 'speed': return O.t('ships.bar.speed', 'SPEED'); case 'agility': return O.t('ships.bar.agility', 'AGILITY'); case 'armour': return O.t('ships.bar.armour', 'ARMOUR');
			case 'shields': return O.t('ships.bar.shields', 'SHIELDS'); default: return O.t('ships.bar.firepower', 'FIREPOWER');
		}
	}
	function barVal(id, v) {
		var t = nf(v, 2);
		switch (id) {
			case 'speed': return t + ' m/s'; case 'agility': return t + ' deg/s'; case 'armour': return O.t('ships.bar.flatPerHit', '{value} flat per hit', { value: t });
			case 'firepower': return t + ' dps'; default: return t;
		}
	}
	function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
	function now() { return W.performance ? W.performance.now() : Date.now(); }
	function warn() { console.warn.apply(console, ['[ships]'].concat([].slice.call(arguments))); }
	function h(tag, a, kids) {
		var n = D.createElement(tag), k, v;
		if (a) for (k in a) {
			v = a[k]; if (v == null || v === false) continue;
			if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
		}
		if (kids != null) [].concat(kids).forEach(function (c) { if (c != null) n.append(c); });
		return n;
	}
	var nfs = {};
	function nf(v, d) { d = d == null ? 2 : d; var loc = O.i18n.locale, k = loc + '|' + d, f = nfs[k] || (nfs[k] = new Intl.NumberFormat(loc, { maximumFractionDigits: d })); return f.format(v); }
	function lenTxt(m) { if (m == null || isNaN(m)) return ''; return m >= 1000 ? nf(Math.round(m / 100) / 10, 1) + ' km' : nf(Math.round(m * 10) / 10, 1) + ' m'; }
	function mkChip(status, label, ver) {
		return h('span', { class: 'chip chip--' + status }, [h('span', { class: 'chip__dots', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]), h('span', { class: 'chip__t', text: label }), ver ? h('span', { class: 'chip__v', text: ver }) : null]);
	}
	function mark(f) { return h('span', { class: 'ships-mark ships-mark--' + f, 'aria-hidden': 'true' }); }

	function init(root, api) {
		var data = W.ORION_DATA, fleet = data && data.fleet;
		if (!fleet || !fleet.length) { warn('no fleet data'); return; }
		var ui = api.ui, fmt = ui.fmt, bus = api.bus, byId = {}, N = fleet.length;
		fleet.forEach(function (s) { byId[s.id] = s; });
		var q = function (s) { return root.querySelector(s); };
		var E = {
			tabs: q('#ships-tabs'), scroll: q('#ships-ladder'), list: q('#ships-ladder-list'), sort: q('#ships-sort'), scalePills: [].slice.call(root.querySelectorAll('[data-scale]')),
			host: q('#ships-viewer'), cap: q('#ships-caption'), ratio: q('#ships-ratio'), cmp: q('#ships-cmp'), scaleref: q('#ships-scaleref'), zoom: q('#ships-zoom'),
			back: q('#ships-back'), clear: q('#ships-clear'), legend: q('#ships-legend'), panel: q('#ships-panel')
		};
		if (!E.list || !E.host || !E.panel) { warn('chapter markup missing'); return; }
		var S = { sel: byId.orion1 ? 'orion1' : fleet[0].id, cmp: null, filter: 'all', sort: 'length', scale: 'true', src: false, hp: null, hsOn: true, fam: { laser: true, rocket: true, rail: true, gun: true, pd: true }, busy: false };
		var ctl = null, viewer = null, cards = {}, maxLen = 0, minLen = 1e9, rangeCache = {};
		fleet.forEach(function (s) { maxLen = Math.max(maxLen, s.lengthM); minLen = Math.min(minLen, s.lengthM); });
		function vt(fn) {
			if (D.startViewTransition && O.state.motion === 'full' && !D.hidden) { try { var tr = D.startViewTransition(fn); ['ready', 'finished', 'updateCallbackDone'].forEach(function (k) { if (tr[k] && tr[k].catch) tr[k].catch(function () { /* a skipped transition is normal */ }); }); return; } catch (e) { /* fall through */ } }
			fn();
		}
		function srcOf(s, key) { var m = s.src || {}; return (typeof m === 'string') ? m : (m[key] || m['*'] || ''); }
		function ratioText(a, b) {
			var big = a.lengthM >= b.lengthM ? a : b, sm = big === a ? b : a, r = big.lengthM / sm.lengthM, live = O.state.webgl === 'ok';
			if (r < 1.05) return live ? O.t('ships.ratio.sameBoth', '{a} and {b} are about the same length. Both are drawn at true relative scale in the 3D view.', { a: a.name, b: b.name }) : O.t('ships.ratio.sameStill', '{a} and {b} are about the same length. The 3D view is not running here, so only a still image of one ship is shown.', { a: a.name, b: b.name });
			var v = { big: big.name, small: sm.name, times: r >= 10 ? nf(Math.round(r), 0) : nf(Math.round(r * 10) / 10, 1), bigLen: lenTxt(big.lengthM), smallLen: lenTxt(sm.lengthM) };
			return live ? O.t('ships.ratio.timesBoth', '{big} is about {times} times the length of {small} ({bigLen} against {smallLen}). Both are drawn at true relative scale in the 3D view.', v) : O.t('ships.ratio.timesStill', '{big} is about {times} times the length of {small} ({bigLen} against {smallLen}). The 3D view is not running here, so only a still image of one ship is shown.', v);
		}
		function bigSmall(a, b) { return a.lengthM >= b.lengthM ? { big: a, small: b } : { big: b, small: a }; }

		/* ---------- spec rows (all values from ORION_DATA, each with its source key) ---------- */
		function specRows(s) {
			var r = [];
			function add(label, key, val, text, num, srcKey) { if (val == null || val === '' || text == null || text === '') return; r.push({ label: label, key: key, raw: String(val), text: text, num: num == null ? null : num, src: srcKey || key }); }
			add(O.t('ships.spec.length', 'Length'), 'lengthM', s.lengthM, lenTxt(s.lengthM), s.lengthM);
			add(O.t('ships.spec.width', 'Width'), 'widthM', s.widthM, lenTxt(s.widthM), s.widthM);
			add(O.t('ships.spec.height', 'Height'), 'heightM', s.heightM, lenTxt(s.heightM), s.heightM);
			add(O.t('ships.spec.mass', 'Mass'), 'massT', s.massT, fmt.mass(s.massT), s.massT);
			add(O.t('ships.spec.cruise', 'Cruise speed'), 'cruiseMs', s.cruiseMs, s.cruiseMs == null ? null : nf(s.cruiseMs) + ' m/s', s.cruiseMs);
			add(O.t('ships.spec.boost', 'Boost speed'), 'boostMs', s.boostMs, s.boostMs == null ? null : nf(s.boostMs) + ' m/s', s.boostMs);
			add(O.t('ships.spec.strafe', 'Strafe speed'), 'strafeMs', s.strafeMs, s.strafeMs == null ? null : nf(s.strafeMs) + ' m/s', s.strafeMs);
			add(O.t('ships.spec.turn', 'Turn rate'), 'turnDegS', s.turnDegS, s.turnDegS == null ? null : nf(s.turnDegS) + ' deg/s', s.turnDegS);
			add(O.t('ships.spec.roll', 'Roll rate'), 'rollDegS', s.rollDegS, s.rollDegS == null ? null : nf(s.rollDegS) + ' deg/s', s.rollDegS);
			add(O.t('ships.spec.hull', 'Hull'), 'hull', s.hull, s.hull == null ? null : nf(s.hull, 0), s.hull);
			add(O.t('ships.spec.shield', 'Shield'), 'shield', s.shield, s.shield == null ? null : nf(s.shield, 0), s.shield);
			add(O.t('ships.spec.armour', 'Armour'), 'armor', s.armor, s.armor == null ? null : O.t('ships.spec.armourValue', '{value} flat per hull hit', { value: nf(s.armor) }), s.armor);
			add(O.t('ships.spec.shieldRegen', 'Shield regeneration'), 'shieldRegen', s.shieldRegen, s.shieldRegen == null ? null : O.t('ships.spec.perSecond', '{value} per second', { value: nf(s.shieldRegen) }), s.shieldRegen);
			add(O.t('ships.spec.regenDelay', 'Regeneration delay'), 'shieldRegenDelayS', s.shieldRegenDelayS, s.shieldRegenDelayS == null ? null : nf(s.shieldRegenDelayS) + ' s', s.shieldRegenDelayS);
			add(O.t('ships.spec.sensor', 'Sensor range'), 'sensorRangeM', s.sensorRangeM, lenTxt(s.sensorRangeM), s.sensorRangeM);
			var c = s.counts || {};
			FAMS.forEach(function (f) { if (c[f] != null) add(famName(f), 'counts.' + f, c[f], O.t('ships.spec.hardpointCount', { one: '{n} hardpoint', other: '{n} hardpoints' }, { n: c[f] }), c[f], 'counts'); });
			if (s.lasers) add(O.t('ships.spec.laserBolt', 'Laser bolt'), 'lasers', s.lasers.type + ' ' + s.lasers.damage, O.t('ships.spec.laserBoltValue', 'damage {damage}, every {refire} ms, {speed} m/s', { damage: nf(s.lasers.damage), refire: nf(s.lasers.refireMs, 0), speed: nf(s.lasers.boltSpeedMs, 0) }), null, 'lasers');
			if (s.rockets) add(famName('rocket'), 'rockets', s.rockets.variant + ' ' + s.rockets.magazine, O.t('ships.spec.rocketsValue', '{variant}, {manual} manual / {auto} AUTO, magazine {magazine}', { variant: wordOf(s.rockets.variant), manual: s.rockets.manual, auto: s.rockets.auto, magazine: s.rockets.magazine }), s.rockets.magazine, 'rockets');
			if (s.rails && s.rails.length) add(famName('rail'), 'rails', s.rails.length, s.rails.map(function (x) { return O.t('ships.spec.variantKind', '{variant} {kind}', { variant: wordOf(x.variant), kind: x.kind === 'railturret' ? kindWord('turret') : kindWord(x.kind) }); }).join(', '), s.rails.length, 'rails');
			if (s.guns) {
				var g = [];
				if (s.guns.fixed) g.push(O.t('ships.spec.gunFixed', 'fixed {variant} \u00d7{count}', { variant: wordOf(s.guns.fixed.variant), count: s.guns.fixed.count }));
				(s.guns.turrets || []).forEach(function (x) { g.push(O.t('ships.spec.gunTurret', 'turret {variant} \u00d7{count}', { variant: wordOf(x.variant), count: x.count })); });
				(s.guns.ciws || []).forEach(function (x) { g.push(O.t('ships.spec.gunCiws', 'CIWS {variant} \u00d7{count}', { variant: wordOf(x.variant), count: x.count })); });
				if (g.length) add(famName('gun'), 'guns', g.length, g.join(', '), null, 'guns');
			}
			add(O.t('ships.spec.dps', 'Sustained firepower'), 'dps', s.dps, s.dps == null ? null : nf(s.dps, 0) + ' dps', s.dps);
			add(O.t('ships.spec.threat', 'Threat'), 'threat', s.threat, s.threat == null ? null : O.t('ships.spec.threatValue', '{value} (scale 1 to 4)', { value: nf(s.threat) }), s.threat);
			add(O.t('ships.spec.modules', 'Modules'), 'modules.count', s.modules && s.modules.count, s.modules && s.modules.count != null ? nf(s.modules.count, 0) : null, s.modules && s.modules.count, 'modules');
			add(O.t('ships.spec.aiProfile', 'AI profile'), 'aiProfile', s.aiProfile, s.aiProfile == null ? null : profileWord(s.aiProfile), null);
			if (s.bay) add(O.t('ships.spec.bay', 'Hangar bay'), 'bay', s.bay.slots, O.t('ships.spec.bayValue', '{slots} slots, craft up to {dims} m, stock craft {craft}', { slots: s.bay.slots, dims: s.bay.craftMaxM.map(function (x) { return nf(x); }).join(' \u00d7 '), craft: String(s.bay.stockCraft).toUpperCase() }), s.bay.slots, 'bay');
			return r;
		}
		function classLine(s) {
			var cl = (data.classes || []).filter(function (c) { return c.id === s.siteClass; })[0];
			return O.t('ships.classLine', '{class} class, {n} of {total} \u00b7 game band: {band}', { 'class': cl ? O.i18n.d(cl.label) : s.siteClass, n: s.n, total: N, band: bandWord(s.gameBand) });
		}
		/* log-scale bars: position within the 16 classes (log of 1 + value), drawn by this site from the game's numbers */
		function rangeOf(key) {
			if (rangeCache[key]) return rangeCache[key];
			var lo = 1e18, hi = -1e18; fleet.forEach(function (s) { var v = Math.log(1 + (s[key] || 0)); lo = Math.min(lo, v); hi = Math.max(hi, v); });
			return (rangeCache[key] = [lo, hi]);
		}
		function barFrac(s, key) { var r = rangeOf(key), v = Math.log(1 + (s[key] || 0)); return r[1] > r[0] ? 0.04 + 0.96 * (v - r[0]) / (r[1] - r[0]) : 0.5; }

		/* ---------- ladder ---------- */
		function inFilter(s) { return S.filter === 'all' || s.siteClass === S.filter; }
		function buildLadder() {
			E.list.textContent = '';
			fleet.forEach(function (s) {
				var fill = h('span', { class: 'ships-card__fill' });
				var b = h('button', { type: 'button', class: 'ships-card', 'data-ship': s.id, 'aria-pressed': 'false', tabindex: '-1' }, [
					h('span', { class: 'ships-card__name', text: s.name }), h('span', { class: 'ships-card__len', text: lenTxt(s.lengthM) }),
					h('span', { class: 'ships-card__role', text: O.i18n.d(s.role) }), h('span', { class: 'ships-card__bar', 'aria-hidden': 'true' }, fill)]);
				var li = h('li', null, b); cards[s.id] = { li: li, b: b, fill: fill }; E.list.append(li);
				b.addEventListener('click', function () { selectShip(s.id); });
			});
		}
		function layoutLadder() {
			var sc = SORTS[S.sort], order = fleet.slice().sort(function (a, b) { return (sc.f(a) - sc.f(b)) * sc.dir || a.n - b.n; }), vis = 0;
			order.forEach(function (s) {
				var c = cards[s.id], show = inFilter(s); c.li.hidden = !show; if (show) vis++; E.list.append(c.li);
				var f = S.scale === 'true' ? s.lengthM / maxLen : 0.06 + 0.94 * (Math.log(s.lengthM) - Math.log(minLen)) / (Math.log(maxLen) - Math.log(minLen));
				c.fill.style.setProperty('--f', f.toFixed(4));
			});
			E.list.setAttribute('aria-label', S.scale === 'true' ? O.t('ships.ladderTrue', 'Ship classes, {sort}, bars at true scale', { sort: sortText(S.sort) }) : O.t('ships.ladderLog', 'Ship classes, {sort}, bars on a log scale', { sort: sortText(S.sort) }));
			E.scalePills.forEach(function (p) { p.setAttribute('aria-pressed', p.dataset.scale === S.scale ? 'true' : 'false'); });
			markSelected(); return vis;
		}
		function visibleCards() { return fleet.filter(inFilter).map(function (s) { return cards[s.id]; }).sort(function (a, b) { return (a.li.compareDocumentPosition(b.li) & 4) ? -1 : 1; }); }
		function markSelected() {
			var vis = visibleCards(), rove = cards[S.sel] && !cards[S.sel].li.hidden ? cards[S.sel] : vis[0];
			fleet.forEach(function (s) { var c = cards[s.id]; c.b.setAttribute('aria-pressed', s.id === S.sel ? 'true' : 'false'); c.b.tabIndex = c === rove ? 0 : -1; });
		}
		function revealCard(id) {
			var c = cards[id]; if (!c || c.li.hidden) return; var sc = E.scroll;
			var left = c.li.offsetLeft - (sc.clientWidth - c.li.offsetWidth) / 2;
			try { sc.scrollTo({ left: Math.max(0, left), behavior: O.state.motion === 'full' ? 'smooth' : 'auto' }); } catch (e) { sc.scrollLeft = Math.max(0, left); }
		}
		E.list.addEventListener('keydown', function (e) {
			var b = e.target.closest && e.target.closest('.ships-card'); if (!b) return;
			var vis = visibleCards(), i = vis.map(function (c) { return c.b; }).indexOf(b), n = -1;
			if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % vis.length; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + vis.length) % vis.length;
			else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = vis.length - 1; else return;
			e.preventDefault(); vis.forEach(function (c) { c.b.tabIndex = -1; }); vis[n].b.tabIndex = 0; vis[n].b.focus(); revealCard(vis[n].b.dataset.ship);
		});
		var tabEls = [].slice.call(E.tabs.querySelectorAll('[role="tab"]'));
		function setFilter(f, focus) {
			S.filter = f;
			vt(function () {
				tabEls.forEach(function (t) { var on = t.dataset.filter === f; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on) E.scroll.setAttribute('aria-labelledby', t.id); });
				var n = layoutLadder(); ui.announce(O.t('ships.showing', { one: 'Showing {n} ship, sorted by {sort}', other: 'Showing {n} ships, sorted by {sort}' }, { n: n, sort: sortText(S.sort) }));
				E.scroll.scrollLeft = 0; revealCard(S.sel);
			});
			if (focus) tabEls.filter(function (t) { return t.dataset.filter === f; })[0].focus();
		}
		tabEls.forEach(function (t) { t.addEventListener('click', function () { setFilter(t.dataset.filter, false); }); });
		E.tabs.addEventListener('keydown', function (e) {
			var i = tabEls.indexOf(e.target), n = -1; if (i < 0) return;
			if (e.key === 'ArrowRight') n = (i + 1) % tabEls.length; else if (e.key === 'ArrowLeft') n = (i - 1 + tabEls.length) % tabEls.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabEls.length - 1; else return;
			e.preventDefault(); setFilter(tabEls[n].dataset.filter, true);
		});
		E.sort.addEventListener('change', function () { S.sort = E.sort.value; vt(function () { var n = layoutLadder(); ui.announce(O.t('ships.sortedBy', 'Sorted by {sort}, {n} ships', { sort: sortText(S.sort), n: n })); revealCard(S.sel); }); });
		E.scalePills.forEach(function (p) { p.addEventListener('click', function () { S.scale = p.dataset.scale; layoutLadder(); ui.announce(S.scale === 'true' ? O.t('ships.barsTrue', 'Bars at true scale') : O.t('ships.barsLog', 'Bars on a log scale')); }); });

		/* ---------- selection, compare ---------- */
		function selLabel() {
			var s = byId[S.sel], c = S.cmp ? byId[S.cmp] : null;
			if (c) return O.t('ships.viewerLabelCmp', '3D model of the {name} {role}, {length}, beside the {name2} {role2}, {length2}, at true relative scale, rotatable', { name: s.name, role: lc(O.i18n.d(s.role)), length: lenTxt(s.lengthM), name2: c.name, role2: lc(O.i18n.d(c.role)), length2: lenTxt(c.lengthM) });
			return O.t('ships.viewerLabel', '3D model of the {name} {role}, {length}, rotatable', { name: s.name, role: lc(O.i18n.d(s.role)), length: lenTxt(s.lengthM) });
		}
		function posterCaption() { var m = O.media('ship.' + S.sel); return m && m.caption ? m.caption : ''; }
		function modelCap() {
			if (!S.cmp) return ui.modelCaption(S.sel);
			return O.t('ships.modelCapPair', '{a}: {capA}. {b}: {capB}.', { a: byId[S.sel].name, capA: ui.modelCaption(S.sel), b: byId[S.cmp].name, capB: ui.modelCaption(S.cmp) });
		}
		function updateViewerMeta() {
			if (!viewer) return; var s = byId[S.sel];
			viewer.opts.title = s.name; viewer.setLabel(selLabel()); viewer.setPoster('ship.' + S.sel);
			if (!ctl || S.busy) E.cap.textContent = S.busy && ctl ? O.t('ships.loadingModel', 'Loading the 3D model...') : posterCaption();
		}
		function renderTools() {
			var s = byId[S.sel], c = S.cmp ? byId[S.cmp] : null;
			E.cmp.value = S.cmp || ''; E.zoom.hidden = E.back.hidden = !(c && ctl); E.clear.hidden = !c;
			if (c) { var sm = bigSmall(s, c).small; E.zoom.textContent = O.t('ships.zoomTo', 'Zoom to {name}', { name: sm.name }); }
			E.scaleref.setAttribute('aria-disabled', S.sel === 'kestrel' ? 'true' : 'false');
			E.scaleref.title = S.sel === 'kestrel' ? O.t('ships.scaleRefSelf', 'The KESTREL is the scale reference: pick another ship first') : O.t('ships.scaleRefBeside', 'Put the KESTREL beside {name}', { name: s.name });
			E.ratio.hidden = !c; E.ratio.textContent = c ? ratioText(s, c) : '';
			renderLegend();
		}
		function selectShip(id, o) {
			if (!byId[id]) return; o = o || {};
			S.sel = id; if (S.cmp === id) S.cmp = null; S.hp = null;
			vt(function () { markSelected(); renderTools(); renderPanel(); revealCard(id); });
			updateViewerMeta(); if (ctl) ctl.apply();
			var s = byId[id], sv = { name: s.name, role: lc(O.i18n.d(s.role)), length: lenTxt(s.lengthM) }; ui.announce(S.cmp ? O.t('ships.selectedCmp', '{name}, {role}, {length} selected. {ratio}', Object.assign(sv, { ratio: ratioText(s, byId[S.cmp]) })) : O.t('ships.selected', '{name}, {role}, {length} selected', sv));
			if (!o.quiet) bus.emit('ship:select', { id: id, from: 'ships' });
		}
		function setCompare(id) {
			S.cmp = (id && id !== S.sel && byId[id]) ? id : null; S.hp = null;
			vt(function () { renderTools(); renderPanel(); });
			updateViewerMeta(); if (ctl) ctl.apply();
			ui.announce(S.cmp ? ratioText(byId[S.sel], byId[S.cmp]) : O.t('ships.compareOff', 'Comparison off'));
		}
		E.cmp.addEventListener('change', function () { setCompare(E.cmp.value); });
		E.scaleref.addEventListener('click', function () {
			if (S.sel === 'kestrel') { ui.announce(O.t('ships.scaleRefAnnounce', 'The KESTREL is the scale reference. Select another ship first.')); return; }
			setCompare('kestrel');
		});
		E.clear.addEventListener('click', function () { setCompare(null); E.cmp.focus(); });
		E.zoom.addEventListener('click', function () { if (ctl) ctl.zoomSmall(); else ui.announce(O.t('ships.noZoom', 'The 3D view is not running, so there is nothing to zoom.')); });
		E.back.addEventListener('click', function () { if (ctl) ctl.backBoth(); });
		function fillCmp() { var v = E.cmp.value; while (E.cmp.options.length > 1) E.cmp.remove(1); fleet.forEach(function (s) { E.cmp.append(h('option', { value: s.id, text: s.name + ', ' + lenTxt(s.lengthM) })); }); E.cmp.value = v; }
		fillCmp();
		bus.on('webgl', function () { renderTools(); if (S.cmp) renderPanel(); });
		bus.on('ship:select', function (e) { if (e && e.from !== 'ships' && byId[e.id] && e.id !== S.sel) selectShip(e.id, { quiet: true }); });

		/* ---------- legend (hotspot groups) ---------- */
		function renderLegend() {
			var s = byId[S.sel], c = s.counts || {}, L = E.legend;
			L.textContent = ''; L.append(h('span', { class: 'mono-label', text: O.t('ships.legend.hotspots', 'Hotspots') }));
			var master = h('button', { type: 'button', class: 'pill', 'aria-pressed': S.hsOn ? 'true' : 'false', text: S.hsOn ? O.t('ships.legend.on', 'On') : O.t('ships.legend.off', 'Off') });
			master.setAttribute('aria-label', S.hsOn ? O.t('ships.legend.labelOn', 'Hotspots on the model: on') : O.t('ships.legend.labelOff', 'Hotspots on the model: off'));
			master.addEventListener('click', function () { S.hsOn = !S.hsOn; renderLegend(); applyHsVisibility(); });
			L.append(master);
			FAMS.forEach(function (f) {
				var n = c[f] || 0, b = h('button', { type: 'button', class: 'pill', 'data-fam': f, 'aria-pressed': S.fam[f] && n ? 'true' : 'false' }, [mark(f), h('span', { text: O.t('ships.legend.famCount', '{family} {n}', { family: famName(f), n: n }) })]);
				if (!n) b.disabled = true;
				b.addEventListener('click', function () { S.fam[f] = !S.fam[f]; b.setAttribute('aria-pressed', S.fam[f] ? 'true' : 'false'); applyHsVisibility(); ui.announce(S.fam[f] ? O.t('ships.legend.shown', '{family} shown', { family: famName(f) }) : O.t('ships.legend.hidden', '{family} hidden', { family: famName(f) })); });
				L.append(b);
			});
			if (S.cmp) L.append(h('p', { class: 'ships-legend__note', text: O.t('ships.legend.noteCompare', 'Hotspots are off while two ships are compared. The hardpoint list in the panel still works.') }));
			else if (!ctl) L.append(h('p', { class: 'ships-legend__note', text: O.t('ships.legend.noteStill', 'Hotspots appear on the 3D model when it is running. The hardpoint list in the panel always works.') }));
		}
		function applyHsVisibility() {
			if (!ctl) return; ctl.items.forEach(function (it) { it.el.hidden = !(S.hsOn && S.fam[it.h.siteFamily]); });
			ctl.fixRove(); if (S.hp && ctl.openItem && ctl.openItem.el.hidden) closeHP(false);
			if (viewer) viewer.requestRender();
		}

		/* ---------- panel ---------- */
		function hpGlossRows(hp) {
			var kd = kindDesc(hp.kind);
			var rows = [[O.t('ships.gloss.name', 'Name'), O.t('ships.gloss.nameValue', '{name} ({id})', { name: friendlyHp(hp), id: hp.name })], [O.t('ships.gloss.group', 'Group'), famName(hp.siteFamily)], [O.t('ships.gloss.family', 'Family'), wordOf(hp.family)],
				[O.t('ships.gloss.kind', 'Kind'), kd ? O.t('ships.gloss.kindValue', '{kind} ({desc})', { kind: kindWord(hp.kind), desc: kd }) : kindWord(hp.kind)],
				[O.t('ships.gloss.control', 'Control'), ctrlText(hp.control)], [O.t('ships.gloss.variant', 'Variant'), hp.variant == null ? O.t('ships.gloss.none', 'none') : wordOf(hp.variant)]];
			if (hp.role) rows.push([O.t('ships.gloss.role', 'AUTO role'), wordOf(hp.role)]);
			return rows;
		}
		function hpSentence(hp) { return hpGlossRows(hp).slice(0, 6).map(function (r) { return O.t('ships.gloss.pair', '{label} {value}', { label: String(r[0]).toLocaleLowerCase(O.i18n.locale), value: r[1] }); }).join(', ') + '.'; }
		function renderPanel() {
			var s = byId[S.sel], c = S.cmp ? byId[S.cmp] : null, p = E.panel, rows = specRows(s);
			p.textContent = ''; p.classList.toggle('show-src', S.src);
			p.append(h('p', { class: 'mono-label', text: O.i18n.d(s.role) }), h('h3', { class: 'ships-panel__name', id: 'ships-panel-name', text: s.name }),
				h('p', { class: 'mono-label', text: classLine(s) }));
			var chips = h('div', { class: 'cluster ships-panel__chips' });
			chips.append(mkChip('built', O.t('common.chip.built', 'Built'), s.since)); if (s.hullRedesign) chips.append(mkChip('built', O.t('ships.chip.hullRedesigned', 'Hull redesigned'), s.hullRedesign));
			(s.extraChips || []).forEach(function (x) { chips.append(mkChip('built', O.i18n.d(x.label), x.version)); });
			p.append(chips);
			if (s.blurb) { var bl = h('p', { class: 'ships-panel__blurb', text: O.i18n.d(s.blurb) }); bl.append(ui.src(srcOf(s, 'blurb'))); p.append(bl); }
			var src = h('button', { type: 'button', class: 'pill', 'aria-pressed': S.src ? 'true' : 'false', text: O.t('proof.showSources', 'Show sources') });
			src.addEventListener('click', function () { S.src = !S.src; p.classList.toggle('show-src', S.src); src.setAttribute('aria-pressed', S.src ? 'true' : 'false'); ui.announce(S.src ? O.t('ships.sourcesShown', 'Sources shown') : O.t('ships.sourcesHidden', 'Sources hidden')); });
			var cfg = h('a', { class: 'btn btn--primary btn--sm', href: '#build', text: O.t('ships.configure', 'Configure this ship') });
			cfg.addEventListener('click', function () { bus.emit('ship:select', { id: S.sel, from: 'ships' }); });
			p.append(h('div', { class: 'ships-panel__acts' }, [src, cfg]));
			if (c) p.append(compareBox(s, c));
			else {
				var dl = h('dl', { class: 'spec', 'aria-label': O.t('ships.specLabel', '{name} specification', { name: s.name }) });
				rows.forEach(function (r) { dl.append(h('dt', { text: r.label }), h('dd', { 'data-field': r.key, 'data-v': r.raw }, [h('span', { text: r.text }), ui.src(srcOf(s, r.src))])); });
				p.append(h('h4', { text: O.t('ships.specHead', 'Specification') }), dl);
			}
			p.append(h('h4', { text: c ? O.t('ships.barsHeadBoth', 'Stat bars, both ships') : O.t('ships.barsHead', 'Stat bars') }), barsEl([s].concat(c ? [c] : [])));
			p.append(h('h4', { text: O.t('ships.hardpointsHead', '{name} hardpoints ({n})', { name: s.name, n: (s.hardpoints || []).length }) }), hpList(s));
		}
		function barsEl(ships) {
			var wrap = h('div'), ul = h('ul', { class: 'ships-bars', 'aria-label': O.t('ships.barsLabel', 'Stat bars, log scale across the fleet') });
			if (ships.length > 1) wrap.append(h('p', { class: 'small' }, [h('span', { class: 'ships-key' }, [h('i'), document.createTextNode(ships[0].name)]), h('span', { class: 'ships-key' }, [h('i', { class: 'b' }), document.createTextNode(ships[1].name)])]));
			BARS.forEach(function (b) {
				var tr = h('span', { class: 'ships-bars__t', 'aria-hidden': 'true' }), vals = h('span', { class: 'ships-bars__v' });
				ships.forEach(function (s, i) {
					var f = h('span', { class: 'ships-bars__f' + (i ? ' ships-bars__f--b' : '') }); f.style.setProperty('--f', barFrac(s, b[1]).toFixed(4)); tr.append(h('span', { class: 'ships-bars__tr' }, f));
					vals.append(i ? document.createTextNode(' / ') : '', ships.length > 1 ? h('b', { text: s.name + ' ' }) : '', document.createTextNode(barVal(b[0], s[b[1]])));
				});
				ul.append(h('li', null, [h('span', { class: 'ships-bars__l', text: barName(b[0]) }), tr, vals]));
			});
			wrap.append(ul, h('p', { class: 'ships-bars__cap', text: O.t('ships.barsCaption', 'Each bar is where the value sits among the {n} classes, on a log scale. Drawn by this site from the game\'s numbers (speed is cruise, agility is turn rate, armour is the flat per-hit value, firepower is sustained dps), not the game\'s own bar graphics.', { n: N }) }));
			return wrap;
		}
		function compareBox(a, b) {
			var box = h('div', { class: 'ships-cmpbox' }), ra = specRows(a), rb = {}, bs = bigSmall(a, b);
			specRows(b).forEach(function (r) { rb[r.key] = r; });
			box.append(h('h4', { text: O.t('ships.comparing', 'Comparing {a} with {b}', { a: a.name, b: b.name }) }), h('p', { class: 'ships-cmpbox__ratio', text: ratioText(a, b) }));
			var t = h('table', { class: 'table' }), body = h('tbody');
			t.append(h('caption', { class: 'sr-only', text: O.t('ships.compareCaption', '{a} and {b} compared. The higher value in each row is marked.', { a: a.name, b: b.name }) }),
				h('thead', null, h('tr', null, [h('th', { scope: 'col', text: O.t('ships.specHead', 'Specification') }), h('th', { scope: 'col', text: a.name }), h('th', { scope: 'col', text: b.name }), h('th', { scope: 'col', text: O.t('ships.ratioHead', 'Ratio') })])));
			ra.forEach(function (r) {
				var o = rb[r.key]; if (!o) return;
				var hiA = r.num != null && o.num != null && r.num > o.num, hiB = r.num != null && o.num != null && o.num > r.num;
				var cell = function (row, ship, hi) { return h('td', { class: hi ? 'is-hi' : null, 'data-field': row.key, 'data-v': row.raw }, [h('span', { text: row.text }), hi ? h('span', { class: 'vh', text: ' ' + O.t('ships.higher', '(higher)') }) : null, ui.src(srcOf(ship, row.src))]); };
				var ratio = '';
				if (r.num > 0 && o.num > 0) { var rr = Math.max(r.num, o.num) / Math.min(r.num, o.num); ratio = rr < 1.005 ? O.t('ships.same', 'same') : '\u00d7' + (rr >= 10 ? nf(Math.round(rr), 0) : nf(Math.round(rr * 100) / 100, 2)); }
				body.append(h('tr', null, [h('th', { scope: 'row', text: r.label }), cell(r, a, hiA), cell(o, b, hiB), h('td', { class: 'x', text: ratio })]));
			});
			t.append(body); box.append(h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': O.t('ships.compareTable', 'Ship comparison, scrollable table') }, t));
			return box;
		}
		function hpList(s) {
			var wrap = h('div'), ul = h('ul', { class: 'ships-hp' }), hps = s.hardpoints || [];
			FAMS.forEach(function (f) {
				var g = hps.filter(function (x) { return x.siteFamily === f; }); if (!g.length) return;
				var row = h('li', { class: 'ships-hp__g' }, h('span', { class: 'ships-hp__t' }, [mark(f), document.createTextNode(O.t('ships.hpGroup', '{family}, {n}', { family: famName(f), n: g.length }))]));
				g.forEach(function (x) { row.append(h('button', { type: 'button', class: 'ships-hpbtn', 'data-hp': x.name, 'aria-pressed': S.hp === x.name ? 'true' : 'false', 'aria-label': O.t('ships.hpAria', '{name}, {family}, {kind}', { name: friendlyHp(x), family: wordOf(f), kind: kindWord(x.kind) }), text: friendlyHp(x) })); });
				ul.append(row);
			});
			wrap.append(ul, h('p', { class: 'ships-hpd', id: 'ships-hp-detail', 'aria-live': 'polite', text: S.hp ? '' : O.t('ships.hpPick', 'Pick a hardpoint to highlight it on the model and read its details.') }));
			return wrap;
		}
		E.panel.addEventListener('click', function (e) {
			var b = e.target.closest && e.target.closest('[data-hp]'); if (!b) return;
			if (S.hp === b.dataset.hp) closeHP(false); else openHP(b.dataset.hp, 'list');
		});
		E.panel.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.hp && e.target.closest && e.target.closest('[data-hp]')) { e.preventDefault(); closeHP(false); } });

		/* ---------- hardpoint selection (hotspot, list, popover share one state) ---------- */
		function hpData(name) { return (byId[S.sel].hardpoints || []).filter(function (x) { return x.name === name; })[0] || null; }
		function syncHP() {
			var hp = S.hp ? hpData(S.hp) : null, det = E.panel.querySelector('#ships-hp-detail');
			[].forEach.call(E.panel.querySelectorAll('[data-hp]'), function (b) { b.setAttribute('aria-pressed', b.dataset.hp === S.hp ? 'true' : 'false'); });
			if (det) det.textContent = hp ? O.t('ships.hpDetail', '{name}: {details}', { name: friendlyHp(hp), details: hpSentence(hp) }) : O.t('ships.hpPick', 'Pick a hardpoint to highlight it on the model and read its details.');
			if (ctl) ctl.syncPop(hp);
		}
		function openHP(name, via) {
			var hp = hpData(name); if (!hp) return;
			S.hp = name; syncHP(); ui.announce(O.t('ships.hpDetail', '{name}: {details}', { name: friendlyHp(hp), details: hpSentence(hp) }));
			if (viewer && viewer.userAct) viewer.userAct();
			if (via === 'list' && !ctl && !S.cmp) ui.announce(O.t('ships.hpSelectedStill', '{name} selected. The 3D view is not running, so there is no hotspot.', { name: friendlyHp(hp) }));
		}
		function closeHP(refocus) {
			var item = ctl && ctl.openItem; S.hp = null; syncHP();
			if (refocus && item && !item.el.hidden) item.el.focus();
		}

		/* ---------- the 3D scene: one viewer, the selected ship (and the compared one) ---------- */
		function disposeTree(g) {
			g.traverse(function (o) {
				if (o.geometry) o.geometry.dispose();
				var ms = o.material ? [].concat(o.material) : [];
				ms.forEach(function (m) { for (var k in m) { var t = m[k]; if (t && t.isTexture && !(t.userData && t.userData.keep)) t.dispose(); } m.dispose(); });
			});
		}
		function niceLen(x) { var k = Math.pow(10, Math.floor(Math.log(x) / Math.LN10)), m = x / k; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * k; }
		function scaleTxt(v) { return v >= 1000 ? nf(v / 1000) + ' km' : v >= 1 ? nf(v) + ' m' : nf(v * 100) + ' cm'; }

		function setup(ctx) {
			var T = ctx.THREE, kit = ctx.kit, view = ctx.viewer, camera = ctx.camera, controls = ctx.controls, scene = ctx.scene;
			var c = { disposed: false, seq: 0, items: [], A: null, B: null, big: null, small: null, openItem: null, hsMs: [], offs: [], ready: false, bigD: 1 };
			kit.lightRig(scene);
			c.stars = kit.starfield({ count: 900, radius: 1 }); scene.add(c.stars);
			c.world = new T.Group(); scene.add(c.world);
			controls.autoRotateSpeed = 0.5;
			var layer = view.layer(); layer.textContent = '';
			c.hsl = h('div', { class: 'ships-hsl', role: 'toolbar', 'aria-label': O.t('ships.hsLabel', 'Hardpoint hotspots. Arrow keys move between them, Enter opens details, Escape closes.'), 'aria-orientation': 'horizontal' });
			c.busy = h('div', { class: 'ships-busy', hidden: true, 'aria-hidden': 'true' });
			c.scaleBar = h('span', { class: 'ships-scale__bar' }); c.scaleLab = h('span');
			c.scale = h('div', { class: 'ships-scale', role: 'img', 'aria-label': O.t('ships.scaleBar', 'Scale bar') }, [c.scaleBar, c.scaleLab]);
			c.ringC = h('span', { class: 'ships-ring__c' }); c.ringL = h('span', { class: 'ships-ring__l' });
			c.ring = h('div', { class: 'ships-ring', hidden: true, 'aria-hidden': 'true' }, [c.ringC, c.ringL]);
			c.pop = h('div', { class: 'ships-pop', id: 'ships-pop', role: 'group', hidden: true, 'aria-label': O.t('ships.hpDetails', 'Hardpoint details') });
			c.note = h('div', { class: 'ships-note', role: 'status', hidden: true });
			layer.append(c.hsl, c.ring, c.scale, c.busy, c.pop, c.note);

			function entry(model, id) {
				var k = kit.ship(model, { parts: false, livery: '#ff5a36' }), bb = model.meta.bbox, mn = bb.min, mx = bb.max;
				c.world.add(k.group);
				return { id: id, s: byId[id], model: model, k: k, centre: new T.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2), r: k.radius, halfW: (mx[0] - mn[0]) / 2, world: new T.Vector3() };
			}
			function clearScene() {
				c.offs.forEach(function (f) { f(); }); c.offs = []; c.items = []; c.openItem = null;
				c.world.children.slice().forEach(function (g) { c.world.remove(g); disposeTree(g); });
				c.hsl.textContent = ''; c.pop.hidden = true; c.ring.hidden = true; c.A = c.B = c.big = c.small = c.pj = null;
			}
			function frame(radius, target) {
				var old = controls.target.clone(); camera.position.sub(old).add(target);
				if (camera.position.distanceTo(target) < 1e-3) camera.position.set(target.x + 0.62, target.y + 0.38, target.z + 0.78);
				c.bigD = kit.fit(camera, controls, radius, target);
				c.stars.scale.setScalar(camera.far * 0.45); c.stars.position.copy(camera.position);
				ctx.setHome(); view.requestRender();
			}
			function build(mA, mB, ida, idb) {
				clearScene();
				var A = c.A = entry(mA, ida), B = c.B = mB ? entry(mB, idb) : null;
				if (!B) {
					A.k.group.position.set(0, 0, 0); A.world.copy(A.centre); frame(A.r * ((view.size.w / Math.max(1, view.size.h)) < 1.3 ? 1.05 : 0.8), A.centre); /* squarer frames (phones) need the whole hull in view */
					if (S.hsFor !== ida) { S.hsFor = ida; S.hsOn = ((byId[ida].hardpoints || []).length <= 20); } /* big hulls start with hotspots off: 36 markers hide the ship */
					buildHotspots(A);
				} else {
					var bs = bigSmall(A.s, B.s), big = bs.big === A.s ? A : B, sm = big === A ? B : A;
					c.big = big; c.small = sm; big.k.group.position.set(0, 0, 0); big.world.copy(big.centre);
					sm.world.set(big.centre.x + big.halfW + sm.r * 1.8 + big.r * 0.06, big.centre.y + big.r * 0.05, big.centre.z + big.r * 0.18);
					sm.k.group.position.copy(sm.world).sub(sm.centre);
					c.pj = kit.projector(view, sm.k.group); frame(big.r, big.centre);
					c.ringL.textContent = sm.s.name + ', ' + lenTxt(sm.s.lengthM); c.ringW = 0; c.ringSm = sm;
				}
				c.offs.push(view.onFrame(tick));
				view.setLabel(selLabel()); E.cap.textContent = modelCap(); view.setPoster('ship.' + S.sel);
				if (S.hp && !B) syncHP();
				tick(); c.lastScale = null; view.requestRender();
			}
			function buildHotspots(A) {
				var model = A.model.meta, geo = {}, hs = model.hardpoints || [], pj = kit.projector(view) /* single ship: its group sits at the origin with no rotation, so local = world and no per-point matrix work is needed */;
				hs.forEach(function (g) { geo[g.name] = g; });
				(byId[A.id].hardpoints || []).forEach(function (hp) {
					var g = geo[hp.name]; if (!g || !g.origin) return;
					var o = new T.Vector3(g.origin[0], g.origin[1], g.origin[2]), dir;
					if (TURRETY[hp.kind] || !g.axis) dir = o.clone().sub(A.centre); else dir = new T.Vector3(g.axis[0], g.axis[1], g.axis[2]);
					if (dir.lengthSq() < 1e-8) dir = o.clone().sub(A.centre); dir.normalize();
					var el = h('button', { type: 'button', class: 'ships-hs', 'data-fam': hp.siteFamily, 'data-name': hp.name, tabindex: '-1', 'aria-expanded': 'false', 'aria-controls': 'ships-pop', title: O.t('ships.hsTitle', '{name}, {family}', { name: friendlyHp(hp), family: lc(famName(hp.siteFamily)) }), 'aria-label': O.t('ships.hsAria', 'Hardpoint {name}, {family}, {kind}', { name: friendlyHp(hp), family: wordOf(hp.siteFamily), kind: kindWord(hp.kind) }) }, mark(hp.siteFamily));
					el.hidden = !(S.hsOn && S.fam[hp.siteFamily]);
					var it = { h: hp, el: el, point: o.toArray(), dir: dir.toArray(), r: null };
					c.items.push(it); c.hsl.append(el);
				});
				c.pj = pj; c.fixRove();
				c.offs.push(view.onFrame(function () {
					var t0 = now(), items = c.items, i, it, r;
					for (i = 0; i < items.length; i++) {
						it = items[i]; if (it.el.hidden) continue; r = pj.project(it.point, it.dir); if (!r) continue; it.r = r;
						it.el.style.transform = 'translate3d(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px,0)';
						var f = r.facing > 0.05 ? 'front' : 'back'; if (it.el.dataset.facing !== f) it.el.dataset.facing = f;
						var v = r.visible ? 'true' : 'false'; if (it.el.dataset.visible !== v) it.el.dataset.visible = v;
					}
					if (c.openItem && c.openItem.r) placePop(c.openItem.r);
					c.hsMs.push(now() - t0); if (c.hsMs.length > 240) c.hsMs.shift();
				}));
			}
			c.fixRove = function () {
				var vis = c.items.filter(function (i) { return !i.el.hidden; }), cur = vis.filter(function (i) { return i.el.tabIndex === 0; })[0];
				c.items.forEach(function (i) { i.el.tabIndex = -1; }); var t = cur || vis[0]; if (t) t.el.tabIndex = 0;
			};
			function placePop(r) {
				var w = view.size.w, hh = view.size.h, pw = c.pop.offsetWidth, ph = c.pop.offsetHeight, tb = c.toolbarTop(), tr = view.toolbarRect(), side = tr.h > tr.w && tr.x > w / 2; /* narrow screens: the toolbar is a strip on the right edge */
				var xr = side ? tr.x - 6 : w - 6;
				var x = r.x + 22; if (x + pw > xr) x = r.x - 22 - pw; x = clamp(x, 6, Math.max(6, xr - pw));
				var maxY = side ? Math.max(6, hh - ph - 6) : Math.max(6, tb - ph - 6), y = clamp(r.y - ph / 2, 6, maxY);
				c.pop.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
			}
			c.toolbarTop = function () { var t = view.toolbarRect(); return t.h > 0 ? t.y : view.size.h; };
			c.syncPop = function (hp) {
				c.items.forEach(function (i) { var on = !!hp && i.h.name === hp.name; i.el.classList.toggle('is-hl', on); i.el.setAttribute('aria-expanded', on ? 'true' : 'false'); });
				c.openItem = hp ? c.items.filter(function (i) { return i.h.name === hp.name; })[0] || null : null;
				if (!c.openItem) { c.pop.hidden = true; return; }
				c.pop.textContent = '';
				var rows = hpGlossRows(hp), x = h('button', { type: 'button', class: 'ships-pop__x', 'aria-label': O.t('ships.closeDetails', 'Close details for {name}', { name: friendlyHp(hp) }), text: O.t('lightbox.close', 'Close') });
				x.addEventListener('click', function () { closeHP(true); });
				var dl = h('dl'); rows.slice(1).forEach(function (r) { dl.append(h('dt', { text: r[0] }), h('dd', { text: r[1] })); });
				c.pop.append(h('div', { class: 'ships-pop__top' }, [h('span', { class: 'ships-pop__name', text: friendlyHp(hp) }), x]), dl);
				c.pop.hidden = false; c.pop.style.transform = 'translate3d(0,0,0)';
				if (c.openItem.r) placePop(c.openItem.r);
				var rove = c.openItem; c.items.forEach(function (i) { i.el.tabIndex = i === rove ? 0 : -1; });
				view.requestRender();
			};
			c.hsl.addEventListener('click', function (e) {
				var b = e.target.closest && e.target.closest('.ships-hs'); if (!b) return;
				if (S.hp === b.dataset.name) closeHP(false); else openHP(b.dataset.name, 'hotspot');
			});
			c.hsl.addEventListener('keydown', function (e) {
				var vis = c.items.filter(function (i) { return !i.el.hidden; }), cur = vis.map(function (i) { return i.el; }).indexOf(e.target), n = -1;
				if (e.key === 'Escape' && (S.hp || c.pop.contains(e.target))) { e.preventDefault(); e.stopPropagation(); var it = c.openItem; closeHP(false); if (it) it.el.focus(); return; }
				if (cur < 0) return;
				if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (cur + 1) % vis.length; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (cur - 1 + vis.length) % vis.length;
				else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = vis.length - 1; else return;
				e.preventDefault(); e.stopPropagation(); c.items.forEach(function (i) { i.el.tabIndex = -1; }); vis[n].el.tabIndex = 0; vis[n].el.focus();
			});
			c.pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); var it = c.openItem; closeHP(false); if (it) it.el.focus(); } });
			view.host.addEventListener('pointerdown', function (e) { if (e.target === view.canvas && S.hp) closeHP(false); });

			function tick() {
				var w = view.size.w, hh = view.size.h, fov = Math.tan(camera.fov * Math.PI / 360), dist = camera.position.distanceTo(controls.target), mpp = 2 * dist * fov / Math.max(1, hh);
				var val = niceLen(Math.min(160, Math.max(90, w * 0.38)) * mpp), px = val / mpp;
				c.scaleBar.style.width = px.toFixed(1) + 'px';
				if (c.lastScale !== val) { c.lastScale = val; var tx = scaleTxt(val); c.scaleLab.textContent = tx; c.scale.setAttribute('aria-label', O.t('ships.scaleBarAt', 'Scale bar, {value} at the centre of the view', { value: tx })); }
				c.scalePx = px;
				if (c.small && c.pj) {
					var r = c.pj.project(c.small.centre.toArray()); if (!r) return;
					var dS = camera.position.distanceTo(c.small.world), mppS = 2 * dS * fov / Math.max(1, hh), diam = clamp(2 * c.small.r / mppS, 28, 0.7 * Math.min(w, hh));
					c.ring.hidden = false; c.ring.style.transform = 'translate3d(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px,0)'; c.ring.style.opacity = r.visible ? '1' : '0';
					c.ringC.style.width = c.ringC.style.height = diam.toFixed(1) + 'px'; c.diam = diam;
					if (!c.ringW) c.ringW = c.ringL.offsetWidth;
					var right = r.x + diam / 2 + 8 + c.ringW < w - 6, ty = clamp(r.y - 10, 6, hh - 64) - r.y;
					c.ringL.style.transform = 'translate3d(' + (right ? diam / 2 + 8 : -(diam / 2 + 8 + c.ringW)).toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
				} else c.ring.hidden = true;
			}
			c.zoomSmall = function () {
				if (!c.small) return Promise.resolve();
				var sm = c.small, tgt = sm.world.clone(), dir = camera.position.clone().sub(controls.target).normalize();
				var d = sm.r / Math.sin(camera.fov * Math.PI / 360) * 1.15; controls.minDistance = d * 0.5;
				ui.announce(O.t('ships.zoomed', 'Zoomed to {name}, {length}', { name: sm.s.name, length: lenTxt(sm.s.lengthM) }));
				return view.cameraTo(tgt.clone().addScaledVector(dir, d), tgt, 700);
			};
			c.backBoth = function () {
				if (!view.home) return Promise.resolve(); ui.announce(O.t('ships.backBothSay', 'Back to both ships'));
				return view.cameraTo(view.home.pos, view.home.target, 700).then(function () { if (!c.disposed) controls.minDistance = c.bigD * 0.6; });
			};
			c.setBusy = function (on, name) { c.busy.hidden = !on; if (on) c.busy.textContent = O.t('ships.loadingName', 'Loading {name}...', { name: name }); };
			c.apply = function () {
				var seq = ++c.seq, a = S.sel, b = S.cmp; S.busy = true; c.note.hidden = true;
				var names = b ? O.t('ships.namesAnd', '{a} and {b}', { a: byId[a].name, b: byId[b].name }) : byId[a].name;
				if (c.ready) { c.setBusy(true, names); E.cap.textContent = O.t('ships.loadingModel', 'Loading the 3D model...'); }
				return Promise.all([ctx.loadModel(a), b ? ctx.loadModel(b) : null]).then(function (m) {
					if (c.disposed || seq !== c.seq) return;
					if (a !== S.sel || b !== S.cmp) return c.apply();
					S.busy = false; c.setBusy(false); build(m[0], m[1], a, b); c.ready = true; ctl = c; renderTools(); applyHsVisibility();
				}).catch(function (err) {
					if (c.disposed || seq !== c.seq) return; S.busy = false; c.setBusy(false);
					if (!c.ready) throw err;
					clearScene(); view.setLabel(O.t('ships.modelFailedLabel', '3D model for {names} could not load', { names: names })); view.requestRender(); /* never leave the previous ship on screen under the new name */
					c.note.textContent = ''; c.note.hidden = false;
					var rb = h('button', { type: 'button', class: 'btn btn--sm', text: O.t('viewer.retry', 'Retry') }); rb.addEventListener('click', function () { c.apply(); });
					c.note.append(h('span', { text: O.t('ships.modelFailed', 'The 3D model for {names} could not load. The panel still shows its numbers.', { names: names }) }), rb);
					E.cap.textContent = posterCaption();
				});
			};
			c.dispose = function () {
				c.disposed = true; c.offs.forEach(function (f) { f(); }); c.offs = []; ctl = null; S.busy = false;
				[c.hsl, c.ring, c.scale, c.busy, c.pop, c.note].forEach(function (n) { n.remove(); });
				E.cap.textContent = posterCaption(); renderTools();
			};
			return c.apply().then(function () {
				if (c.disposed) return null; ctl = c;
				return { update: function () { c.stars.position.copy(camera.position); return false; }, dispose: function () { c.dispose(); } };
			});
		}

		/* ---------- start ---------- */
		buildLadder(); E.sort.value = S.sort; layoutLadder(); renderTools(); renderPanel();
		var s0 = byId[S.sel];
		viewer = api.viewer(E.host, {
			name: 'ships', priority: 'section', interactive: true, title: s0.name, label: selLabel(), groupLabel: O.t('ships.viewerGroup', 'Ship viewer'), posterKey: 'ship.' + S.sel,
			controls: { autoRotate: true, position: [0.62, 0.38, 0.78], target: [0, 0, 0] }, modelId: function () { return S.sel; }, setup: setup
		});
		E.cap.textContent = posterCaption();
				O.__debug.ships = { state: S, ctl: function () { return ctl; }, viewer: viewer, select: selectShip, compare: setCompare, openHP: openHP, closeHP: closeHP, specRows: specRows, hsMs: function () { var a = ctl ? ctl.hsMs : []; if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return { frames: a.length, avgMs: a.reduce(function (x, y) { return x + y; }, 0) / a.length, p50Ms: s[s.length >> 1], maxMs: s[s.length - 1] }; } };

		/* ---------- language switch (I18N.md 3.8): re-render every piece of text this section drew, keeping all state ---------- */
		bus.on('lang', function () {
			ui.keepFocus(E.panel, function () { renderPanel(); });
			fillCmp(); layoutLadder();
			fleet.forEach(function (s) { var c = cards[s.id]; c.b.querySelector('.ships-card__role').textContent = O.i18n.d(s.role); c.b.querySelector('.ships-card__len').textContent = lenTxt(s.lengthM); });
			ui.keepFocus(E.legend, function () { renderTools(); }); updateViewerMeta();
			viewer.setTexts({ label: selLabel(), groupLabel: O.t('ships.viewerGroup', 'Ship viewer'), title: byId[S.sel].name });
			if (ctl) {
				E.cap.textContent = S.busy ? O.t('ships.loadingModel', 'Loading the 3D model...') : modelCap();
				ctl.hsl.setAttribute('aria-label', O.t('ships.hsLabel', 'Hardpoint hotspots. Arrow keys move between them, Enter opens details, Escape closes.'));
				ctl.scale.setAttribute('aria-label', O.t('ships.scaleBarAt', 'Scale bar, {value} at the centre of the view', { value: ctl.scaleLab.textContent }));
				ctl.pop.setAttribute('aria-label', O.t('ships.hpDetails', 'Hardpoint details'));
				ctl.items.forEach(function (it) {
					it.el.title = O.t('ships.hsTitle', '{name}, {family}', { name: friendlyHp(it.h), family: lc(famName(it.h.siteFamily)) });
					it.el.setAttribute('aria-label', O.t('ships.hsAria', 'Hardpoint {name}, {family}, {kind}', { name: friendlyHp(it.h), family: wordOf(it.h.siteFamily), kind: kindWord(it.h.kind) }));
				});
				if (S.hp) ctl.syncPop(hpData(S.hp));
				if (ctl.ringSm) { ctl.ringL.textContent = ctl.ringSm.s.name + ', ' + lenTxt(ctl.ringSm.s.lengthM); ctl.ringW = 0; }
			} else E.cap.textContent = posterCaption();
		});

		/* ---------- ?selftest steps ---------- */
		var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
		var until = async function (fn, ms) { var t = now(); while (now() - t < ms && !fn()) await sleep(100); return !!fn(); };
		var live3d = function () { return O.state.webgl === 'ok'; };
		var panelIs = function (id) { return until(function () { var n = E.panel.querySelector('.ships-panel__name'); return !!n && n.textContent === byId[id].name; }, 8000); };
		var ready = function (id, cmp) { return until(function () { return ctl && ctl.ready && !S.busy && ctl.A && ctl.A.id === id && (cmp ? ctl.B && ctl.B.id === cmp : !ctl.B); }, 20000); };
		O.selftest.add('ships: ladder has 16 buttons, each prints its length, every bar >= 6 px, both scales', async function () {
			var out = [], ok = true;
			root.scrollIntoView({ behavior: 'instant', block: 'start' }); await sleep(200);
			['true', 'log'].forEach(function (sc) {
				S.scale = sc; layoutLadder();
				var bs = [].slice.call(root.querySelectorAll('.ships-card')), minW = 1e9;
				bs.forEach(function (b) { var w = b.querySelector('.ships-card__fill').getBoundingClientRect().width; minW = Math.min(minW, w); if (!/\d/.test(b.querySelector('.ships-card__len').textContent)) ok = false; });
				if (bs.length !== 16 || minW < 5.99) ok = false; out.push(sc + ': ' + bs.length + ' cards, min bar ' + minW.toFixed(1) + ' px');
			});
			S.scale = 'true'; layoutLadder();
			var lens = [].map.call(root.querySelectorAll('.ships-card__len'), function (n) { return n.textContent; }); out.push(lens[0] + '..' + lens[15]);
			return { ok: ok, note: out.join('; ') };
		});
		O.selftest.add('ships: filter tabs and sort keep 16 / 5 / 5 / 6 ships and sort order', async function () {
			var cnt = {}; ['small', 'medium', 'large', 'all'].forEach(function (f) { S.filter = f; layoutLadder(); cnt[f] = [].filter.call(root.querySelectorAll('.ships-card'), function (b) { return !b.parentNode.hidden; }).length; });
			S.sort = 'dps'; layoutLadder(); var first = root.querySelector('.ships-card:not([hidden])') && E.list.querySelector('li:not([hidden]) .ships-card__name').textContent;
			S.sort = 'length'; S.filter = 'all'; layoutLadder();
			return { ok: cnt.small === 5 && cnt.medium === 5 && cnt.large === 6 && cnt.all === 16 && first === 'LEVIATHAN', note: JSON.stringify(cnt) + ' top by dps: ' + first };
		});
		O.selftest.add('ships: panel numbers equal ORION_DATA (10 values) and sources can show', async function () {
			var checks = [['kestrel', 'lengthM'], ['anvil', 'lengthM'], ['leviathan', 'lengthM'], ['leviathan', 'massT'], ['brawler', 'hull'], ['mule', 'shield'], ['thresher', 'dps'], ['needle', 'cruiseMs'], ['bastion', 'turnDegS'], ['meridian', 'modules.count']], res = [], ok = true;
			for (var i = 0; i < checks.length; i++) {
				selectShip(checks[i][0], { quiet: true }); await panelIs(checks[i][0]);
				var dd = E.panel.querySelector('[data-field="' + checks[i][1] + '"]'), s = byId[checks[i][0]], want = checks[i][1].split('.').reduce(function (o, k) { return o[k]; }, s);
				var good = dd && dd.getAttribute('data-v') === String(want) && dd.querySelector('span').textContent.length > 0; ok = ok && good;
				res.push(checks[i][0] + '.' + checks[i][1] + '=' + want + ' -> "' + (dd ? dd.firstChild.textContent : 'missing') + '"' + (good ? '' : ' MISMATCH'));
			}
			E.panel.classList.add('show-src'); var srcShown = getComputedStyle(E.panel.querySelector('.src')).display !== 'none'; E.panel.classList.remove('show-src'); S.src = false;
			selectShip('orion1', { quiet: true }); await panelIs('orion1');
			return { ok: ok && srcShown, note: res.join(' | ') + ' | sources visible with toggle: ' + srcShown };
		});
		O.selftest.add('ships: 3D selection of KESTREL, ANVIL, LEVIATHAN: caption, label, hotspots equal data, frame time', async function () {
			if (!live3d()) return { ok: true, note: 'skipped: 3D not live (' + O.state.webgl + ')' };
			var out = [], ok = true; E.host.scrollIntoView({ behavior: 'instant', block: 'center' }); await sleep(400);
			for (const id of ['kestrel', 'anvil', 'leviathan']) {
				selectShip(id, { quiet: true }); var r = await ready(id); if (!r) { ok = false; out.push(id + ': not ready'); continue; }
				await sleep(500); ctl.hsMs.length = 0; for (var fi = 0; fi < 90; fi++) { viewer.orbitBy(0.03, 0); await new Promise(function (r) { requestAnimationFrame(r); }); }
				var want = byId[id].hardpoints.length, got = ctl.items.length, cap = E.cap.textContent === ui.modelCaption(id), lab = viewer.canvas && /3D model of the/.test(viewer.canvas.getAttribute('aria-label') || '');
				var back = ctl.items.filter(function (i) { return i.el.dataset.facing === 'back'; }).length, st = O.__debug.ships.hsMs();
				ok = ok && got === want && cap && lab;
				out.push(id + ': hotspots ' + got + '/' + want + ', caption ' + cap + ', canvas label ' + lab + ', facing-away ' + back + ', hotspot pass ' + (st ? st.p50Ms.toFixed(3) + ' ms median / ' + st.avgMs.toFixed(3) + ' avg / ' + st.maxMs.toFixed(2) + ' max over ' + st.frames + ' frames' : 'n/a'));
			}
			return { ok: ok, note: out.join(' | ') };
		});
		O.selftest.add('ships: hotspot keyboard (one Tab stop, arrows, Home/End, Enter, Esc, clamped popover)', async function () {
			if (!live3d()) return { ok: true, note: 'skipped: 3D not live' };
			E.host.scrollIntoView({ behavior: 'instant', block: 'center' }); selectShip('anvil', { quiet: true }); if (!await ready('anvil')) return { ok: false, note: 'anvil not ready' };
			await sleep(500); var out = [], ok = true, tabStops = ctl.items.filter(function (i) { return i.el.tabIndex === 0; }).length;
			ok = ok && tabStops === 1; out.push('tab stops ' + tabStops);
			var vis = ctl.items.filter(function (i) { return !i.el.hidden; }), first = vis[0].el; first.focus();
			var key = function (k, el) { (el || D.activeElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
			key('ArrowRight'); var second = D.activeElement === vis[1].el; key('End'); var last = D.activeElement === vis[vis.length - 1].el; key('Home'); var home = D.activeElement === first;
			ok = ok && second && last && home; out.push('arrows ' + second + '/' + last + '/' + home);
			first.click(); await sleep(250); var pop = ctl.pop, open = !pop.hidden && first.getAttribute('aria-expanded') === 'true';
			var pr = pop.getBoundingClientRect(), vr = viewer.host.getBoundingClientRect(), tb = viewer.toolbar.getBoundingClientRect();
			var inside = pr.left >= vr.left - 1 && pr.right <= vr.right + 1 && pr.top >= vr.top - 1 && pr.bottom <= vr.bottom + 1, clear = pr.bottom <= tb.top + 1 || pr.right <= tb.left || pr.left >= tb.right;
			ok = ok && open && inside && clear; out.push('popover open ' + open + ', inside viewer ' + inside + ', clear of toolbar ' + clear);
			key('Escape', first); await sleep(100); var closed = pop.hidden && D.activeElement === first; ok = ok && closed; out.push('Esc closes and keeps focus ' + closed);
			var lb = E.panel.querySelector('[data-hp]'); lb.click(); await sleep(250);
			var listOpen = !ctl.pop.hidden && ctl.openItem && ctl.openItem.h.name === lb.dataset.hp && ctl.openItem.el.classList.contains('is-hl'); ok = ok && listOpen; out.push('list button opens + highlights ' + !!listOpen);
			closeHP(false); return { ok: ok, note: out.join('; ') };
		});
		O.selftest.add('ships: KESTREL vs LEVIATHAN compare: 100 : 1 ratio, ring >= 24 px, scale bar, zoom and back', async function () {
			var txt = ratioText(byId.leviathan, byId.kestrel), out = ['ratio text: ' + txt.split(' (')[0]], ok = O.i18n.lang !== 'en' || /about 100 times the length of KESTREL/.test(txt);
			if (!live3d()) return { ok: ok, note: out.join('; ') + '; 3D part skipped (not live)' };
			E.host.scrollIntoView({ behavior: 'instant', block: 'center' }); selectShip('leviathan', { quiet: true }); if (!await ready('leviathan')) return { ok: false, note: 'not ready' };
			setCompare('kestrel'); if (!await ready('leviathan', 'kestrel')) return { ok: false, note: 'compare not ready' };
			await sleep(500); var ring = ctl.ringC.getBoundingClientRect(), bar = ctl.scaleBar.getBoundingClientRect().width, lab = ctl.scaleLab.textContent;
			var real = ctl.big.s.lengthM / ctl.small.s.lengthM;
			ok = ok && ring.width >= 24 && bar >= 64 && bar <= 160.5 && Math.abs(real - 100) < 1e-6 && !E.ratio.hidden && E.zoom.textContent === O.t('ships.zoomTo', 'Zoom to {name}', { name: 'KESTREL' });
			out.push('ring ' + ring.width.toFixed(0) + ' px, scale bar ' + bar.toFixed(0) + ' px = ' + lab + ', length ratio ' + real + ', hotspots ' + ctl.items.length);
			var d0 = viewer.distance(); E.zoom.click(); await sleep(1200); var d1 = viewer.distance(), t1 = viewer.controls.target.distanceTo(ctl.small.world);
			var lab1 = ctl.scaleLab.textContent, bar1 = ctl.scaleBar.getBoundingClientRect().width;
			ok = ok && d1 < d0 * 0.1 && t1 < 1; out.push('zoom: distance ' + d0.toFixed(0) + ' -> ' + d1.toFixed(1) + ' m, scale bar now ' + lab1 + ' (' + bar1.toFixed(0) + ' px)');
			E.back.click(); await sleep(1200); var d2 = viewer.distance(); ok = ok && Math.abs(d2 - d0) < d0 * 0.02; out.push('back: distance ' + d2.toFixed(0) + ' m');
			setCompare(null); await ready('leviathan'); selectShip('orion1', { quiet: true }); await ready('orion1');
			return { ok: ok, note: out.join('; ') };
		});
		O.selftest.add('ships: plain wheel scrolls the page; Ctrl + wheel and an activated viewer zoom; keys work', async function () {
			if (!live3d()) return { ok: true, note: 'skipped: 3D not live' };
			E.host.scrollIntoView({ behavior: 'instant', block: 'center' }); selectShip('orion1', { quiet: true }); if (!await ready('orion1')) return { ok: false, note: 'not ready' };
			await sleep(400); var v = viewer, out = [], ok = true, c = v.camera;
			var wheel = async function (o) { var d = v.distance(), e = new WheelEvent('wheel', Object.assign({ bubbles: true, cancelable: true }, o)); v.canvas.dispatchEvent(e); await sleep(250); return { prevented: e.defaultPrevented, moved: Math.abs(v.distance() - d) > 1e-6 }; };
			var key = function (k) { v.host.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
			v.setActive(false); var a = await wheel({ deltaY: 240 }); ok = ok && !a.prevented && !a.moved; out.push('plain wheel ' + JSON.stringify(a));
			a = await wheel({ deltaY: -240, ctrlKey: true }); ok = ok && a.prevented && a.moved; out.push('Ctrl+wheel ' + JSON.stringify(a));
			v.cameraTo(v.home.pos, v.home.target, 0); v.host.focus(); await sleep(60); if (!v.active) v.setActive(true);
			a = await wheel({ deltaY: -240 }); ok = ok && v.active && a.moved; out.push('activated wheel ' + JSON.stringify(a));
			v.host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await sleep(50); ok = ok && !v.active; out.push('Esc ends activation ' + !v.active);
			v.cameraTo(v.home.pos, v.home.target, 0); var p0 = c.position.clone(); key('ArrowRight'); await sleep(150); var rot = p0.distanceTo(c.position) > 1e-4; var d0 = v.distance(); key('+'); await sleep(150); var zin = v.distance() < d0; key('0'); await sleep(900);
			ok = ok && rot && zin; out.push('ArrowRight rotates ' + rot + ', + zooms ' + zin);
			return { ok: ok, note: out.join('; ') };
		});
		O.selftest.add('ships: Configure this ship emits ship:select', async function () {
			var got = null, f = function (e) { got = e; }; bus.on('ship:select', f); selectShip('mule', { quiet: true }); await panelIs('mule');
			var a = E.panel.querySelector('a[href="#build"]'); a.click(); await sleep(100); bus.off('ship:select', f); var toBuild = !!D.getElementById('build') && D.activeElement && D.activeElement.closest && !!D.activeElement.closest('#build'); E.host.scrollIntoView({ behavior: 'instant', block: 'center' });
			selectShip('orion1', { quiet: true }); await panelIs('orion1');
			return { ok: !!got && got.id === 'mule' && got.from === 'ships', note: JSON.stringify(got) + '; focus moved into #build: ' + toBuild };
		});
	}
	O.register('ships', { init: init });
})();
