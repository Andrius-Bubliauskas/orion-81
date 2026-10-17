/* Weapons lab (#weapons), ORI-1307. Classic script (works from file://). Implements DESIGN.md 4.3 and Appendix A.5 / A.6.
   Data: ORION_DATA.weapons (families, variants, stats, mountedOn) and ORION_DATA.fleet (hardpoints, for the legal control modes).
   Scene: one live viewer ("weapons"): a procedural firing mount at the left, the game's training buoy (ORION_MODELS.buoy) at the right.
   Time and distance are compressed for display (projectile speeds x K, engagement ranges x DS); rates (refire, rpm, spin-up, lock, charge) are the game's own. */
(function () {
	'use strict';
	var W = window, D = document, ORION = W.ORION;
	if (!ORION) return;

	var K = 0.07;            /* game m/s -> display units per second (compressed travel) */
	var DS = 0.02;           /* display units per game metre, used only for engagement ranges */
	var MOUNT_X = -22, TARGET_X = 22;
	var ORDER = ['laser', 'rocket', 'rail', 'gun', 'pd'];
	var VOLLEY = 6;          /* 6-rocket volleys: version 0.5.1 (ORION_DATA.versions) */
	var RAIL_HOLD_MS = 3000; /* a fully charged rail discharges by itself after 3 s (ORION_DATA.weapons.families rail summary) */
	var COOL_DISPLAY_MS = 2200; /* the lab lets a rail fire again after this long (game cooldown is shown as data) */
	var RELOAD_DISPLAY_MS = 1500;
	var FLASH_MAX = 3;       /* WCAG 2.3.1: at most 3 flashes in any 1000 ms window, enforced in flashOK() with the simulation clock */
	var COLORS = { laser: 0x7fe3ff, rocket: 0xffb347, rail: 0x6fb4ff, gun: 0xffe08a, pd: 0xa6ffcf, hostile: 0xff6b6b };
	function postureTxt(p) {
		if (p === 'HOLD') return ORION.t('weapons.posture.hold', 'holds fire');
		if (p === 'DEFEND') return ORION.t('weapons.posture.defend', 'returns fire only');
		if (p === 'FREE') return ORION.t('weapons.posture.free', 'engages freely');
		return '';
	}
	function lc(x) { return ORION.i18n.lang === 'en' ? String(x).toLowerCase() : String(x); } /* English lower-casing only */
	function nn1(v) { return ORION.ui.fmt.num(v, 1); }
	function meterName(id) {
		switch (id) {
			case 'READY': return ORION.t('weapons.meter.ready', 'READY'); case 'FIRING': return ORION.t('weapons.meter.firing', 'FIRING'); case 'SPIN': return ORION.t('weapons.meter.spin', 'SPIN');
			case 'LOCK': return ORION.t('weapons.meter.lock', 'LOCK'); case 'VOLLEY': return ORION.t('weapons.meter.volley', 'VOLLEY'); case 'IN FLIGHT': return ORION.t('weapons.meter.inFlight', 'IN FLIGHT');
			case 'RELOADING': return ORION.t('weapons.meter.reloading', 'RELOADING'); case 'CHARGE': return ORION.t('weapons.meter.charge', 'CHARGE'); case 'FULL': return ORION.t('weapons.meter.full', 'FULL');
			case 'COOLDOWN': return ORION.t('weapons.meter.cooldown', 'COOLDOWN'); case 'ENGAGING': return ORION.t('weapons.meter.engaging', 'ENGAGING'); case 'STILL': return ORION.t('weapons.meter.still', 'STILL');
		}
		return String(id);
	}

	/* stats shown, in A.6 order; formatters return the value with its unit */
	function dec(v) { var s = String(v), i = s.indexOf('.'); return i < 0 ? 0 : Math.min(2, s.length - i - 1); }
	function nn(v) { return ORION.ui.fmt.num(v, dec(v)); }
	function ms(v) { return v >= 1000 ? nn(Math.round(v / 10) / 100) + ' s' : nn(v) + ' ms'; }
	var STAT_DEF = [
		['damage', function () { return ORION.t('weapons.stat.damage', 'Damage'); }, function (v) { return nn(v); }],
		['refireMs', function () { return ORION.t('weapons.stat.refire', 'Refire interval'); }, ms],
		['reloadMs', function () { return ORION.t('weapons.stat.reload', 'Reload'); }, ms],
		['rpm', function () { return ORION.t('weapons.stat.rate', 'Rate of fire'); }, function (v) { return nn(v) + ' rpm'; }],
		['muzzleSpeedMs', function () { return ORION.t('weapons.stat.muzzle', 'Muzzle speed'); }, function (v) { return nn(v) + ' m/s'; }],
		['rangeM', function () { return ORION.t('weapons.stat.range', 'Effective range'); }, function (v) { return ORION.ui.fmt.len(v); }],
		['lockRangeM', function () { return ORION.t('weapons.stat.lockRange', 'Lock range'); }, function (v) { return ORION.ui.fmt.len(v); }],
		['lockMs', function () { return ORION.t('weapons.stat.lockTime', 'Lock time'); }, ms],
		['splashRadiusM', function () { return ORION.t('weapons.stat.splash', 'Splash radius'); }, function (v) { return nn(v) + ' m'; }],
		['rocketSpeedMs', function () { return ORION.t('weapons.stat.rocketSpeed', 'Rocket speed limit'); }, function (v) { return nn(v) + ' m/s'; }],
		['turnDegS', function () { return ORION.t('weapons.stat.turn', 'Turn rate'); }, function (v) { return nn(v) + ' deg/s'; }],
		['chargeMs', function () { return ORION.t('weapons.stat.charge', 'Charge time'); }, ms],
		['cooldownMs', function () { return ORION.t('weapons.stat.cooldown', 'Cooldown'); }, ms],
		['slugMassKg', function () { return ORION.t('weapons.stat.slugMass', 'Slug mass'); }, function (v) { return nn(v) + ' kg'; }],
		['roundMassKg', function () { return ORION.t('weapons.stat.roundMass', 'Round mass'); }, function (v) { return nn(v) + ' kg'; }],
		['spinUpMs', function () { return ORION.t('weapons.stat.spinUp', 'Spin-up'); }, ms],
		['spinDownMs', function () { return ORION.t('weapons.stat.spinDown', 'Spin-down'); }, ms],
		['belt', function () { return ORION.t('weapons.stat.belt', 'Belt'); }, function (v) { return ORION.t('weapons.val.rounds', { one: '{value} round', other: '{value} rounds' }, { n: v, value: nn(v) }); }],
		['reserveBelts', function () { return ORION.t('weapons.stat.reserveBelts', 'Reserve belts'); }, function (v) { return nn(v); }],
		['heatPerRound', function () { return ORION.t('weapons.stat.heat', 'Heat per round'); }, function (v) { return nn(v); }],
		['burst', function () { return ORION.t('weapons.stat.burst', 'Burst'); }, function (v) { return ORION.t('weapons.val.shots', { one: '{value} shot', other: '{value} shots' }, { n: v, value: nn(v) }); }],
		['slewDegS', function () { return ORION.t('weapons.stat.slew', 'Turret slew rate'); }, function (v) { return nn(v) + ' deg/s'; }],
		['magazine', function () { return ORION.t('weapons.stat.magazine', 'Magazine (per mount)'); }, function (v) { return ORION.t('weapons.val.rockets', { one: '{value} rocket', other: '{value} rockets' }, { n: v, value: nn(v) }); }]
	];

	function h(tag, attrs, kids) {
		var n = D.createElement(tag), k, v;
		if (attrs) for (k in attrs) {
			v = attrs[k];
			if (v == null || v === false) continue;
			if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
		}
		if (kids != null) [].concat(kids).forEach(function (c) { if (c != null) n.append(c); });
		return n;
	}
	function $(s, r) { return (r || D).querySelector(s); }
	function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

	/* ------------------------------------------------------------------ data helpers */
	var DATA = null, FAMS = [], FLEET = {}, SHIPNAME = {};
	function famById(id) { for (var i = 0; i < FAMS.length; i++) if (FAMS[i].id === id) return FAMS[i]; return null; }
	function varById(f, id) { for (var i = 0; i < f.variants.length; i++) if (f.variants[i].id === id) return f.variants[i]; return f.variants[0]; }
	function hpMatcher(fam, v) {
		return function (hp) {
			switch (fam.id) {
				case 'laser': return v.id === 'fixed' ? (hp.siteFamily === 'laser' && hp.kind === 'fixed') : (hp.siteFamily === 'laser' && hp.kind === 'turret' && ('turret_' + hp.variant) === v.id);
				case 'rocket': return hp.siteFamily === 'rocket' && hp.variant === v.id;
				case 'rail': return v.id === 'turret_medium' ? hp.kind === 'railturret' : (hp.kind === 'spinal' && hp.variant === v.id);
				case 'gun': return hp.siteFamily === 'gun' && hp.variant === v.id;
				case 'pd': return v.id === 'laser_pd' ? (hp.siteFamily === 'pd' && hp.family === 'laser') : (hp.siteFamily === 'pd' && hp.family === 'gun' && ('ciws_' + hp.variant) === v.id);
			}
			return false;
		};
	}
	/* legal control modes, from the hardpoints of the ships that mount the variant (FLEET.md 9.1: null = manual only, switch = manual or auto, auto/pd = automatic) */
	function modesFor(fam, v) {
		var m = hpMatcher(fam, v), out = { manual: false, auto: false, count: 0 };
		(DATA.fleet || []).forEach(function (s) {
			(s.hardpoints || []).forEach(function (hp) {
				if (!m(hp)) return; out.count++;
				if (hp.control == null) out.manual = true;
				else if (hp.control === 'switch') { out.manual = true; out.auto = true; }
				else if (hp.control === 'auto' || hp.control === 'pd') out.auto = true;
			});
		});
		if (fam.modes && fam.modes.indexOf('manual') < 0) out.manual = false;
		if (fam.modes && fam.modes.indexOf('auto') < 0) out.auto = false;
		return out;
	}
	function statsFor(v, shipId) {
		var st = {}, k; for (k in v.stats) st[k] = v.stats[k];
		var ps = v.perShip && shipId && v.perShip[shipId];
		if (ps) ['damage', 'refireMs', 'muzzleSpeedMs', 'magazine'].forEach(function (key) { if (ps[key] != null) st[key] = ps[key]; });
		return st;
	}
	function shipsFor(v) { return v.perShip ? (v.mountedOn || []).filter(function (id) { return v.perShip[id]; }) : []; }
	function chipVersion(since) { return since; }

	/* ------------------------------------------------------------------ UI state */
	var S = { fam: 'laser', variant: 'fixed', mode: 'manual', posture: 'FREE', deployed: true, ship: null };
	var E = {};          /* DOM refs */
	var R = null;        /* the live range controller, or null */
	var VIEWER = null;
	var capRange = false;   /* the viewer caption was set to the range caption once; it stays so after the range is evicted, and a language switch must restore it (applyDom resets the tagged caption to the still's text) */
	var C = { shots: 0, hits: 0, dmg: 0, volleys: 0, rounds: 0, kills: 0, rails: 0, intercepts: 0 };
	function resetCounters() { for (var k in C) C[k] = 0; }
	function curFam() { return famById(S.fam); }
	function curVar() { return varById(curFam(), S.variant); }
	function curStats() { return statsFor(curVar(), S.ship); }
	function curModes() { return modesFor(curFam(), curVar()); }
	function reduced() { return ORION.state.motion === 'reduced' || (VIEWER && VIEWER.motionPaused); }
	function speak(t) { try { ORION.ui.announce(t); } catch (e) { /* ignore */ } }
	var idleKind = '';   /* which idle line the status shows ('variant' = Ready: {variant}., 'ready' = Ready.), so a language switch re-words the same line */
	function setStatus(t, say) {
		if (E.status) E.status.textContent = t; if (say) speak(t);
		try { idleKind = t === ORION.t('weapons.readyVariant', 'Ready: {variant}.', { variant: vName(curVar()) }) ? 'variant' : (t === ORION.t('weapons.ready', 'Ready.') ? 'ready' : ''); } catch (e) { idleKind = ''; }
	}
	var meterLast = '', meterArgs = ['READY', 0, '', false];
	function setMeter(name, frac, valText, amber) {
		if (!E.meterBar) return; var key = name + '|' + Math.round(frac * 200) + '|' + valText + '|' + (amber ? 1 : 0); if (key === meterLast) return; meterLast = key; meterArgs = [name, frac, valText, amber];
		E.meterName.textContent = meterName(name); E.meterVal.textContent = valText || '';
		E.meterBar.style.transform = 'scaleX(' + clamp(frac, 0, 1).toFixed(3) + ')'; E.meterBar.classList.toggle('is-amber', !!amber);
	}
	function setDial(frac) {
		if (!E.dial) return; if (frac == null) { E.dial.hidden = true; return; }
		E.dial.hidden = false; var p = Math.round(clamp(frac, 0, 1) * 100); E.dial.style.setProperty('--spin', p); E.dialT.textContent = p + ' %';
	}
	var roLast = 0;
	function refreshReadout(force) {
		if (!E.readout) return; var t = performance.now(); if (!force && t - roLast < 200) return; roLast = t;
		var f = S.fam, st = curStats(), parts = [];
		if (f === 'laser') { if (st.refireMs) parts.push(ORION.t('weapons.ro.refire', 'refire {ms} ms = {rate} shots per second', { ms: st.refireMs, rate: nn1(1000 / st.refireMs) })); parts.push(ORION.t('weapons.ro.shots', 'shots {n}', { n: C.shots })); parts.push(ORION.t('weapons.ro.hits', 'hits {n}', { n: C.hits })); if (st.damage != null) parts.push(ORION.t('weapons.ro.damage', 'damage delivered {value}', { value: nn(Math.round(C.dmg * 10) / 10) })); }
		else if (f === 'rocket') { parts.push(ORION.t('weapons.ro.volleys', 'volleys {n}', { n: C.volleys })); parts.push(ORION.t('weapons.ro.rocketsAway', 'rockets away {n}', { n: C.shots })); parts.push(ORION.t('weapons.ro.hits', 'hits {n}', { n: C.hits })); if (st.damage != null) parts.push(ORION.t('weapons.ro.damage', 'damage delivered {value}', { value: nn(C.dmg) })); }
		else if (f === 'rail') { parts.push(ORION.t('weapons.ro.slugs', 'slugs {n}', { n: C.rails })); if (st.damage != null) parts.push(ORION.t('weapons.ro.damage', 'damage delivered {value}', { value: nn(C.dmg) })); if (st.cooldownMs) parts.push(ORION.t('weapons.ro.cooldown', 'game cooldown {time}', { time: ms(st.cooldownMs) })); }
		else if (f === 'gun') { if (st.rpm) parts.push(ORION.t('weapons.ro.fullRate', 'full rate {rpm} rpm = {rate} rounds per second', { rpm: nn(st.rpm), rate: nn1(st.rpm / 60) })); parts.push(ORION.t('weapons.ro.rounds', 'rounds fired {n}', { n: C.rounds })); if (st.belt) parts.push(ORION.t('weapons.ro.belt', 'belt left {n}', { n: Math.max(0, st.belt - (R ? R.beltUsed() : 0)) })); }
		else { parts.push(ORION.t('weapons.ro.incoming', 'incoming {n}', { n: C.shots })); parts.push(ORION.t('weapons.ro.destroyed', 'destroyed {n}', { n: C.intercepts })); }
		E.readout.textContent = parts.join(' | ');
	}

	/* ------------------------------------------------------------------ rendering of the DOM panel */
	function famLabel(f) { return f.id === 'pd' ? ORION.t('weapons.famPd', 'POINT DEFENCE') : ORION.i18n.d(f.name); }
	function vName(v) { return v.name === 'POINT DEFENCE' ? ORION.t('weapons.famPd', 'POINT DEFENCE') : v.name; }
	function renderTabs() {
		E.tabs.textContent = '';
		FAMS.forEach(function (f) {
			var b = h('button', { type: 'button', class: 'weapons-tab', role: 'tab', id: 'weapons-tab-' + f.id, 'aria-selected': f.id === S.fam ? 'true' : 'false', 'aria-controls': 'weapons-panel', tabindex: f.id === S.fam ? '0' : '-1', 'data-fam': f.id });
			b.append(h('span', { text: famLabel(f) }), ORION.ui.chip('built', chipVersion(f.since)));
			E.tabs.append(b);
		});
	}
	function syncTabs() {
		[].forEach.call(E.tabs.children, function (b) { var on = b.dataset.fam === S.fam; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
		E.panel.setAttribute('aria-labelledby', 'weapons-tab-' + S.fam);
	}
	function renderVariants() {
		var f = curFam(); E.variants.textContent = '';
		f.variants.forEach(function (v) {
			var b = h('button', { type: 'button', class: 'pill', 'aria-pressed': v.id === S.variant ? 'true' : 'false', 'data-variant': v.id, text: vName(v) });
			E.variants.append(b);
		});
	}
	function renderShip() {
		var v = curVar(), ids = shipsFor(v);
		E.shipField.hidden = !ids.length; E.ship.textContent = '';
		if (!ids.length) return;
		if (ids.indexOf(S.ship) < 0) S.ship = ids[0];
		ids.forEach(function (id) { var o = h('option', { value: id, text: SHIPNAME[id] || id }); if (id === S.ship) o.selected = true; E.ship.append(o); });
	}
	function renderMode() {
		var f = curFam(), m = curModes(); E.mode.textContent = '';
		if (m.manual && m.auto) {
			if (S.mode !== 'manual' && S.mode !== 'auto') S.mode = 'manual';
			var g = h('div', { class: 'pill-group', role: 'group', 'aria-label': ORION.t('weapons.controlMode', 'Control mode') });
			['manual', 'auto'].forEach(function (k) { g.append(h('button', { type: 'button', class: 'pill', 'data-mode': k, 'aria-pressed': S.mode === k ? 'true' : 'false', text: k.toUpperCase() })); });
			E.mode.append(g);
			var note = f.id === 'gun' ? ORION.t('weapons.modeNoteGun', 'Fixed banks are MANUAL only; AUTO applies to turret mounts.') : f.id === 'laser' ? ORION.t('weapons.modeNoteLaser', 'Turrets switch between MANUAL and AUTO.') : ORION.t('weapons.modeNoteLauncher', 'Launchers are MANUAL or AUTO.');
			E.mode.append(h('p', { class: 'small muted', text: note }));
		} else if (m.auto) {
			S.mode = 'auto';
			E.mode.append(h('p', { class: 'weapons-only' }, [h('strong', { text: ORION.t('weapons.automatic', 'AUTOMATIC') }), h('span', { text: ORION.t('weapons.automaticNote', 'Point defence shoots hostile rockets by itself and is never on the trigger.') })]));
		} else {
			S.mode = 'manual';
			E.mode.append(h('p', { class: 'weapons-only' }, [h('strong', { text: 'MANUAL' }), h('span', { text: ORION.t('weapons.manualNote', 'The pilot fires this mount. It has no AUTO mode.') })]));
		}
	}
	function renderPosture() {
		var f = curFam(), show = S.mode === 'auto' && f.postures && f.postures.length && curModes().auto;
		E.postureField.hidden = !show; if (!show) return; E.posture.textContent = '';
		var labels = (DATA.weapons.postureLabels) || {};
		f.postures.forEach(function (p) { E.posture.append(h('button', { type: 'button', class: 'pill', 'data-posture': p, 'aria-pressed': S.posture === p ? 'true' : 'false', text: p })); });
		E.postureNote.textContent = ORION.t('weapons.postureNote', '{label}: the AUTO mount {text}.', { label: labels[S.posture] || S.posture, text: postureTxt(S.posture) });
	}
	function renderTable() {
		var f = curFam(), v = curVar(), st = curStats(), shipTxt = '';
		var ids = shipsFor(v); var hasShip = ids.length && S.ship;
		E.tcap.textContent = hasShip ? ORION.t('weapons.capShip', '{variant}, as mounted on {ship}', { variant: vName(v), ship: SHIPNAME[S.ship] || S.ship }) : vName(v);
		E.tbody.textContent = '';
		var rows = 0;
		STAT_DEF.forEach(function (d) {
			var val = st[d[0]]; if (val == null) return; rows++;
			E.tbody.append(h('tr', { 'data-stat': d[0] }, [h('th', { scope: 'row', text: d[1]() }), h('td', { class: 'num', text: d[2](val) })]));
		});
		if (!rows) E.tbody.append(h('tr', null, [h('td', { colspan: '2', text: ORION.t('weapons.noSingleValue', 'The game defines no single value for this variant: the numbers depend on the ship that mounts it. Pick a ship above.') })]));
		E.src.textContent = '';
		var s = v.src; var srcTxt = typeof s === 'string' ? s : (s && (s['*'] || s.stats)) || '';
		if (srcTxt) E.src.append(ORION.ui.src(ORION.t('common.sourceVar', 'Source: {path}', { path: srcTxt })));
		void shipTxt;
	}
	function renderMounted() {
		var v = curVar(); E.mounted.textContent = '';
		(v.mountedOn || []).forEach(function (id) {
			var a = h('a', { href: '#ships', 'data-ship': id, text: SHIPNAME[id] || id, 'aria-label': ORION.t('weapons.showInShips', 'Show {name} in the ships explorer', { name: SHIPNAME[id] || id }) });
			E.mounted.append(h('li', null, a));
		});
		if (!(v.mountedOn || []).length) E.mounted.append(h('li', { class: 'muted', text: ORION.t('weapons.noMounts', 'No ship mounts this variant in 0.6.1.') }));
	}
	function renderFacts() {
		var f = curFam(); E.facts.textContent = '';
		var ul = h('ul'); (f.summary || []).forEach(function (s) { var li = h('li', { text: ORION.i18n.d(s.text) }); ul.append(li); });
		E.facts.append(ul);
	}
	function renderCapture() {
		var f = curFam(), m = ORION.media('feature.weapon.' + f.id); E.capture.textContent = '';
		if (m && m.src) { E.capture.append(h('img', { src: m.src, width: m.w, height: m.h, alt: m.alt || '', loading: 'lazy', decoding: 'async' }), h('figcaption', { text: m.caption || '' })); }
		else E.capture.append(h('figcaption', { text: ORION.t('weapons.noCapture', 'No in-game capture of {family} yet.', { family: lc(ORION.i18n.d(f.name)) }) }));
	}
	function updateControls() {
		var f = curFam(), m = curModes(), auto = S.mode === 'auto' && m.auto, label = ORION.t('weapons.fire', 'FIRE'), hint;
		E.charge.hidden = f.id !== 'rail';
		E.deploy.setAttribute('aria-pressed', S.deployed ? 'true' : 'false'); E.deployState.textContent = S.deployed ? ORION.t('weapons.deployed', 'Deployed') : ORION.t('weapons.retracted', 'Retracted');
		if (f.id === 'pd') { label = ORION.t('weapons.launchIncoming', 'Launch incoming rockets'); hint = ORION.t('weapons.hintPd', 'Press the button, or Space or Enter while the range has focus. Three hostile rockets come in and point defence shoots them down by itself.'); }
		else if (auto && S.posture === 'HOLD') { label = ORION.t('weapons.testAuto', 'Test AUTO (holds)'); hint = ORION.t('weapons.hintHold', 'WEAPONS HOLD: the AUTO mount tracks the target and does not fire. Choose DEFEND or FREE to see it shoot.'); }
		else if (auto && S.posture === 'DEFEND') { label = ORION.t('weapons.provoke', 'Provoke target'); hint = ORION.t('weapons.hintDefend', 'RETURN FIRE ONLY: the target fires at the mount, then the AUTO mount returns fire.'); }
		else if (auto) { label = ORION.t('weapons.runAuto', 'Run AUTO'); hint = ORION.t('weapons.hintFree', 'WEAPONS FREE: the AUTO mount engages the target by itself for a few seconds.'); }
		else if (f.id === 'rail') { label = ORION.t('weapons.fireHold', 'FIRE (hold to charge)'); hint = ORION.t('weapons.hintRail', 'Hold to charge and release at 50 % or more to fire, or use Charge and fire: no holding needed. Space or Enter works on the focused range.'); }
		else if (f.id === 'rocket') { label = ORION.t('weapons.fire', 'FIRE'); hint = ORION.t('weapons.hintRocket', 'The lock ring fills, then a volley of {n} rockets launches in turn. One press does the whole volley.', { n: VOLLEY }); }
		else if (f.id === 'gun') { label = ORION.t('weapons.fire', 'FIRE'); hint = ORION.t('weapons.hintGun', 'The barrels spin up to full rate. Hold to keep firing; one press gives a burst.'); }
		else hint = ORION.t('weapons.hintDefault', 'Press FIRE, or Space or Enter while the range has focus. Holding is optional: one press always fires a full burst.');
		E.fire.textContent = label; E.hint.textContent = hint;
		E.fire.disabled = false;
	}
	function rangeLabel() { return ORION.t('weapons.rangeLabel', 'Firing range: {variant}, mount at the left, training buoy at the right', { variant: lc(vName(curVar())) }); }
	function rangeCaption() {
		return ORION.t('weapons.captionFull', 'Time and distance are compressed for display. Numbers are the game\'s own. {target} Mount and effects: illustration made for this site (procedural).', { target: S.model ? ORION.t('weapons.targetModel', 'Target: {model}.', { model: ORION.ui.modelCaption('buoy') }) : ORION.t('weapons.targetStandIn', 'Target: a stand-in shape (the buoy model did not load).') });
	}
	function renderAll() {
		syncTabs(); renderVariants(); renderShip(); renderMode(); renderPosture(); renderTable(); renderMounted(); renderFacts(); renderCapture(); updateControls();
		if (VIEWER) { var key = ORION.media('feature.weapon.' + S.fam) ? 'feature.weapon.' + S.fam : 'poster.weapons'; VIEWER.setPoster(key); VIEWER.setLabel(rangeLabel()); }
	}
	function onWeaponChanged(reason) {
		resetCounters(); meterLast = ''; setMeter('READY', 0, ''); setDial(null);
		if (R) R.setWeapon();
		setStatus(ORION.t('weapons.readyVariant', 'Ready: {variant}.', { variant: vName(curVar()) }), false); refreshReadout(true);
		if (reason) speak(reason);
	}

	/* ------------------------------------------------------------------ the range (needs three.js; built in the viewer's setup) */
	function createRange(ctx, buoyModel) {
		var T = ctx.THREE, kit = ctx.kit, scene = ctx.scene, camera = ctx.camera, rng = kit.rng(20261011);
		var clock = 0, fxList = [], stillList = [], flashLog = [], flashDrawn = [], seq = null, belt = 0, spin = 0, spinAcc = 0, deployK = 1, recoil = 0;
		var mats = {}, geos = {}, hostile = [], lastAspect = 0, driftT = 0, pdRockets = [], rotor = null, muzzles = [], sizeS = 1, ring = null, ringLine = null;
		var X = new T.Vector3(1, 0, 0), tmpA = new T.Vector3(), tmpB = new T.Vector3(), tmpC = new T.Vector3();
		var gunGlow = null;
		var fxCap = ctx.tier === 'low' ? 36 : 70;

		function mat(color, opacity) {
			var k = color + ':' + (opacity == null ? 1 : opacity);
			return mats[k] || (mats[k] = new T.MeshBasicMaterial({ color: color, blending: T.AdditiveBlending, transparent: true, opacity: opacity == null ? 1 : opacity, depthWrite: false, toneMapped: false }));
		}
		var mMetal = new T.MeshStandardMaterial({ color: 0x8d98a8, metalness: 0.7, roughness: 0.45 });
		var mDark = new T.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.6, roughness: 0.5 });
		var mCoil = new T.MeshStandardMaterial({ color: 0x1a2433, emissive: 0x6fb4ff, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.35 });
		var mGlowTip = new T.MeshStandardMaterial({ color: 0x101820, emissive: 0x8cc8ff, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.5 });
		geos.box = new T.BoxGeometry(1, 1, 1);
		geos.cylX = new T.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2);
		geos.cylY = new T.CylinderGeometry(1, 1, 1, 16);
		geos.sph = new T.SphereGeometry(1, 16, 10);
		geos.torus = new T.TorusGeometry(1, 0.12, 8, 24).rotateY(Math.PI / 2);
		geos.ring = new T.RingGeometry(0.9, 1, 56);

		scene.add(kit.starfield({ count: ctx.tier === 'low' ? 260 : 520, radius: 800, twinkle: false }));
		kit.lightRig(scene, { intensity: 1 });
		var mount = new T.Group(); mount.position.set(MOUNT_X, 0, 0); scene.add(mount);
		var mountInner = new T.Group(); mount.add(mountInner);
		var target = new T.Group(); target.position.set(TARGET_X, 0, 0); scene.add(target);
		var targetRadius = 4.7;
		if (buoyModel) { var b = kit.ship(buoyModel, {}); target.add(b.group); targetRadius = b.radius || 4.7; }
		else { target.add(new T.Mesh(geos.sph, mMetal)); target.children[0].scale.set(4.7, 4.7, 4.7); target.add(new T.Mesh(geos.torus, mCoil)); target.children[1].scale.set(7, 7, 7); }
		var beacon = kit.glowSprite(0xff8a4d, 3.2, 0.5); beacon.position.set(0, targetRadius * 0.95, 0); target.add(beacon);

		/* ---- flash budget: no more than FLASH_MAX bright flashes in any 1000 ms of simulation time (WCAG 2.3.1) ---- */
		function flashOK() {
			while (flashLog.length && clock - flashLog[0] >= 1000) flashLog.shift();
			if (flashLog.length >= FLASH_MAX) return false;
			flashLog.push(clock); flashDrawn.push(clock); if (flashDrawn.length > 400) flashDrawn.shift(); return true;
		}
		function maxFlashWindow() { var best = 0, i, j = 0; for (i = 0; i < flashDrawn.length; i++) { while (flashDrawn[i] - flashDrawn[j] >= 1000) j++; best = Math.max(best, i - j + 1); } return best; }

		function addFx(o) { if (fxList.length >= fxCap && o.cosmetic) { o.dispose && o.dispose(); return null; } fxList.push(o); return o; }
		function removeObj(o) { if (o.parent) o.parent.remove(o); }
		function spriteFx(color, size, opacity0, lifeMs, grow, pos, parent) {
			var sp = kit.glowSprite(color, size, opacity0); sp.position.copy(pos); (parent || scene).add(sp); var t = 0;
			return addFx({ cosmetic: true,
				update: function (dt) { t += dt; var k = t / lifeMs; if (k >= 1) return false; sp.material.opacity = opacity0 * (1 - k) * (1 - k); var s = size * (1 + (grow || 0) * k); sp.scale.set(s, s, 1); return true; },
				dispose: function () { removeObj(sp); sp.material.dispose(); } });
		}
		function flash(pos, size, color, life) { if (flashOK()) return spriteFx(color, size, 1, life || 260, 0.6, pos); return spriteFx(color, size * 0.5, 0.22, 500, 0.2, pos); }
		function shock(pos, radius, color) {
			var m = mat(color, 0.55).clone(); m.opacity = 0.55; var r = new T.Mesh(geos.ring, m); r.position.copy(pos); r.scale.set(0.2, 0.2, 1); scene.add(r); var t = 0;
			return addFx({ cosmetic: true,
				update: function (dt) { t += dt; var k = t / 650; if (k >= 1) return false; var s = radius * (0.2 + 0.8 * k); r.scale.set(s, s, 1); m.opacity = 0.55 * (1 - k); return true; },
				dispose: function () { removeObj(r); m.dispose(); } });
		}
		function explosion(pos, radius, color) { flash(pos, radius * 1.6, 0xffe2b0, 380); shock(pos, radius, color || 0xffb347); }

		/* ---- bolts (lasers, tracers, point-defence shots, slugs) ---- */
		function makeBolt(color, len, thick) {
			var mesh = new T.Mesh(geos.box, mat(color, 1)); mesh.scale.set(len, thick, thick); var spr = kit.glowSprite(color, thick * 9, 0.7);
			scene.add(mesh, spr);
			return { mesh: mesh, spr: spr, len: len, place: function (from, dir, head) {
				var l = Math.min(len, Math.max(head, 0.01)); mesh.scale.x = l; mesh.quaternion.setFromUnitVectors(X, dir);
				mesh.position.copy(from).addScaledVector(dir, head - l / 2); spr.position.copy(from).addScaledVector(dir, head);
			}, dispose: function () { removeObj(mesh); removeObj(spr); spr.material.dispose(); } };
		}
		function spawnBolt(from, to, speedU, color, len, thick, onHit) {
			var dir = tmpA.copy(to).sub(from), dist = dir.length(); dir = dir.clone().normalize(); var f = from.clone(), b = makeBolt(color, len, thick), d = 0;
			b.place(f, dir, 0.01);
			return addFx({ cosmetic: !onHit,
				update: function (dt) { d += speedU * dt / 1000; if (d >= dist) { if (onHit) onHit(to); return false; } b.place(f, dir, d); return true; },
				dispose: b.dispose });
		}

		/* ---- rockets (own, and the hostile ones point defence shoots down) ---- */
		function makeRocketMesh(color) {
			var g = new T.Group(), body = new T.Mesh(geos.cylX, new T.MeshStandardMaterial({ color: 0xc9d3df, metalness: 0.5, roughness: 0.5 })); body.scale.set(2.2, 0.38, 0.38);
			var fl = kit.glowSprite(color, 2.6, 0.9); fl.position.set(-1.4, 0, 0); g.add(body, fl); scene.add(g);
			return { g: g, flame: fl, dispose: function () { removeObj(g); body.material.dispose(); fl.material.dispose(); } };
		}
		function makeTrail(color) {
			var n = 18, arr = new Float32Array(n * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(arr, 3));
			var m = new T.LineBasicMaterial({ color: color, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
			var line = new T.Line(geo, m); line.frustumCulled = false; scene.add(line);
			return { arr: arr, n: n, line: line, init: function (p) { for (var i = 0; i < n; i++) { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; } geo.attributes.position.needsUpdate = true; },
				push: function (p) { arr.copyWithin(0, 3); arr[(n - 1) * 3] = p.x; arr[(n - 1) * 3 + 1] = p.y; arr[(n - 1) * 3 + 2] = p.z; geo.attributes.position.needsUpdate = true; },
				dispose: function () { removeObj(line); geo.dispose(); m.dispose(); } };
		}
		function aimPoint(out, offsetSeed) {
			out.set(TARGET_X - targetRadius * 0.92, target.position.y, target.position.z);
			if (offsetSeed != null) { out.y += Math.sin(offsetSeed * 5.1) * 1.6; out.z += Math.cos(offsetSeed * 3.7) * 1.6; }
			return out;
		}
		/* spec: {from, dirInit, speedU, turnRad, color, trailColor, aim(vec)->vec, onExplode(pos), life, hostile} */
		function spawnRocket(spec) {
			var rm = makeRocketMesh(spec.color), tr = makeTrail(spec.trailColor || spec.color), pos = spec.from.clone(), vel = spec.dirInit.clone().normalize(), t = 0, trT = 0, dead = false, aim = new T.Vector3();
			rm.g.position.copy(pos); tr.init(pos);
			var o = {
				pos: pos, vel: vel, alive: true, hits: 0, spec: spec,
				kill: function (silent) { if (!o.alive) return; o.alive = false; if (!silent) { explosion(pos.clone(), spec.deathRadius || 3, spec.color); } },
				update: function (dt) {
					if (!o.alive) return false;
					t += dt; var dts = dt / 1000, sp = spec.speedU * Math.min(1, 0.35 + t / 380);
					spec.aim(aim);
					var to = tmpB.copy(aim).sub(pos), dist = to.length(); to.normalize();
					var ang = Math.acos(clamp(vel.dot(to), -1, 1)), maxT = spec.turnRad * dts;
					if (ang > 1e-4) vel.lerp(to, clamp(maxT / ang, 0, 1)).normalize();
					pos.addScaledVector(vel, sp * dts); rm.g.position.copy(pos); rm.g.quaternion.setFromUnitVectors(X, vel);
					trT += dt; if (trT > 45) { trT = 0; tr.push(pos); }
					if (dist < Math.max(spec.reach || 2.4, sp * dts * 1.4) || t > (spec.life || 7000)) { o.alive = false; spec.onExplode(pos.clone(), dist < 8); return false; }
					return true;
				},
				dispose: function () { rm.dispose(); tr.dispose(); }
			};
			o.vel0 = vel; return o;
		}

		/* ---- the mount (procedural; shapes differ per family, size per variant) ---- */
		function clearMount() { mountInner.clear(); muzzles = []; rotor = null; }
		function part(geo, m, sx, sy, sz, x, y, z, parent) { var p = new T.Mesh(geo, m); p.scale.set(sx, sy, sz); p.position.set(x, y, z); (parent || mountInner).add(p); return p; }
		function buildMount() {
			clearMount();
			var fam = S.fam, vid = S.variant, s = (/heavy|large/.test(vid)) ? 1.35 : /light/.test(vid) ? 0.8 : 1; if (fam === 'pd') s = 0.8; s *= 1.55; sizeS = s;
			part(geos.cylY, mMetal, 1.7 * s, 0.35 * s, 1.7 * s, 0, -0.3 * s, 0);
			if (fam === 'laser') {
				var turret = vid !== 'fixed';
				if (turret) { part(geos.sph, mMetal, 1.1 * s, 0.9 * s, 1.1 * s, 0.1 * s, 0.35 * s, 0); } else part(geos.box, mMetal, 2.4 * s, 0.8 * s, 2.4 * s, 0.4 * s, 0.2 * s, 0);
				[-0.8, 0.8].forEach(function (z) { part(geos.cylX, mDark, 3.6 * s, 0.13 * s, 0.13 * s, 2.5 * s, 0.35 * s, z * s * 0.75); part(geos.sph, mGlowTip, 0.2 * s, 0.2 * s, 0.2 * s, 4.3 * s, 0.35 * s, z * s * 0.75); muzzles.push(new T.Vector3(4.3 * s, 0.35 * s, z * s * 0.75)); });
			} else if (fam === 'rocket') {
				part(geos.box, mMetal, 3.4 * s, 1.7 * s, 2.6 * s, 1.4 * s, 0.6 * s, 0);
				for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
					var yy = (0.25 + r * 0.8) * s, zz = (c - 1) * 0.8 * s; part(geos.cylX, mDark, 0.3 * s, 0.3 * s, 0.3 * s, 3.1 * s, yy, zz); muzzles.push(new T.Vector3(3.3 * s, yy, zz));
				}
			} else if (fam === 'rail') {
				part(geos.box, mMetal, 2.4 * s, 0.9 * s, 1.6 * s, 0.3 * s, 0.25 * s, 0);
				[-0.32, 0.32].forEach(function (z) { part(geos.box, mDark, 8 * s, 0.22 * s, 0.22 * s, 4.2 * s, 0.5 * s, z * s); });
				for (var k = 0; k < 4; k++) part(geos.torus, mCoil, 0.5 * s, 0.5 * s, 0.5 * s, (1.6 + k * 1.7) * s, 0.5 * s, 0);
				muzzles.push(new T.Vector3(8.3 * s, 0.5 * s, 0));
			} else {
				var ciws = fam === 'pd' && S.variant !== 'laser_pd';
				if (fam === 'pd' && !ciws) {
					part(geos.sph, mMetal, 1.0 * s, 0.8 * s, 1.0 * s, 0, 0.3 * s, 0);
					[-0.35, 0.35].forEach(function (z) { part(geos.cylX, mDark, 2.2 * s, 0.1 * s, 0.1 * s, 1.5 * s, 0.4 * s, z * s); part(geos.sph, mGlowTip, 0.14 * s, 0.14 * s, 0.14 * s, 2.6 * s, 0.4 * s, z * s); muzzles.push(new T.Vector3(2.6 * s, 0.4 * s, z * s)); });
				} else {
					part(geos.box, mMetal, 2.2 * s, 1.0 * s, 1.8 * s, 0.2 * s, 0.3 * s, 0);
					var rg = new T.Group(); rg.position.set(1.2 * s, 0.5 * s, 0); mountInner.add(rg); rotor = rg;
					for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2; part(geos.cylX, mDark, 3.2 * s, 0.1 * s, 0.1 * s, 1.6 * s, Math.sin(a) * 0.38 * s, Math.cos(a) * 0.38 * s, rg); }
					part(geos.torus, mMetal, 0.45 * s, 0.45 * s, 0.45 * s, 1.6 * s, 0, 0, rg);
					muzzles.push(new T.Vector3(4.5 * s, 0.5 * s, 0));
				}
			}
		}
		function muzzleWorld(i, out) { mount.updateMatrixWorld(true); out.copy(muzzles[i % muzzles.length] || tmpC.set(3, 0.4, 0)); return mountInner.localToWorld(out); }

		/* ---- the lock ring (rockets) and the charge ring (rails): line loops with a draw range ---- */
		function makeRing(color, radius) {
			var n = 65, arr = new Float32Array(n * 3), i; for (i = 0; i < n; i++) { var a = i / (n - 1) * Math.PI * 2; arr[i * 3] = Math.cos(a) * radius; arr[i * 3 + 1] = Math.sin(a) * radius; arr[i * 3 + 2] = 0; }
			var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(arr, 3)); geo.setDrawRange(0, 0);
			var m = new T.LineBasicMaterial({ color: color, transparent: true, opacity: 0.95, toneMapped: false }), line = new T.Line(geo, m); line.frustumCulled = false; line.visible = false; scene.add(line);
			return { line: line, set: function (frac) { var c = Math.round(clamp(frac, 0, 1) * 64) + 1; geo.setDrawRange(0, frac <= 0 ? 0 : c); line.visible = frac > 0; }, dispose: function () { removeObj(line); geo.dispose(); m.dispose(); } };
		}
		gunGlow = kit.glowSprite(COLORS.gun, 1.6, 0); gunGlow.visible = false; scene.add(gunGlow);
		var lockRing = makeRing(COLORS.rocket, 7.4), chargeRing = makeRing(COLORS.rail, 1.9);
		lockRing.line.position.copy(target.position); lockRing.line.position.x = TARGET_X;

		/* ---- weapon parameters from the data ---- */
		function P() { return curStats(); }
		function targetPos() { return tmpB.set(TARGET_X, target.position.y, target.position.z); }
		function surfacePoint(out) {
			var a = rng() * Math.PI * 2, u = rng() * 1.6 - 0.8; out.set(TARGET_X - targetRadius * Math.sqrt(1 - u * u) * 0.9, target.position.y + u * targetRadius * 0.8, target.position.z + Math.sin(a) * 1.2); return out;
		}
		function hit(dmg, pos, big) { C.hits++; C.dmg += dmg || 0; flash(pos, big || 2.2, COLORS[S.fam] || 0xffffff, 240); }

		/* ---- sequences ---- */
		function isRunning() { return !!seq; }
		function endSeq(msg) { seq = null; if (gunGlow) gunGlow.visible = false; setDial(null); setMeter('READY', 0, ''); if (msg) setStatus(msg, false); E.stop.hidden = true; E.fire.classList.remove('is-held'); lockRing.set(0); chargeRing.set(0); updateRunUi(); }
		function updateRunUi() { E.stop.hidden = !seq; }
		function stopAll(msg) { if (seq) { var s = seq; seq = null; if (s.fam === 'pd') { pdRockets.forEach(function (r) { r.kill(true); }); pdRockets = []; } } endSeq(msg || ORION.t('weapons.stopped', 'Stopped.')); }

		function autoParams() { var m = curModes(); return S.mode === 'auto' && m.auto; }
		function press(src) {
			if (!S.deployed) { setStatus(ORION.t('weapons.retractedFire', 'The mount is retracted. Deploy it to fire.'), true); return; }
			if (reduced()) { stillFrame(); return; }
			clearStill();
			var f = S.fam, auto = autoParams() && f !== 'pd';
			if (seq) { if (seq.fam === f && f !== 'rocket' && f !== 'pd' && f !== 'rail') { seq.held = src !== 'click'; if (src === 'click') seq.until = Math.max(seq.until || 0, clock + 900); } else setStatus(ORION.t('weapons.alreadyRunning', 'Already running. Press Stop to cancel.'), false); return; }
			var st = P();
			if (auto && S.posture === 'HOLD') { setStatus(ORION.t('weapons.statusHold', 'WEAPONS HOLD: the AUTO mount tracks the target and holds fire.'), true); return; }
			var s = seq = { fam: f, t: 0, held: src === 'pointer' || src === 'key', src: src, until: 0, auto: auto };
			if (auto) { if (S.posture === 'DEFEND') { setStatus(ORION.t('weapons.statusDefend', 'The target fires at the mount. Returning fire.'), true); hostileShot(); s.until = clock + 3500; } else { s.until = clock + 4000; setStatus(ORION.t('weapons.statusFree', 'AUTO, WEAPONS FREE: engaging the target.'), true); } s.held = false; }
			else if (src === 'click' && (f === 'laser' || f === 'gun')) s.until = clock + (f === 'gun' ? 1800 : 1300);
			if (f === 'laser') { s.next = clock; if (!st.refireMs) { stopAll(ORION.t('weapons.noRefire', 'This laser has no refire value in the data.')); return; } if (!auto) setStatus(ORION.t('weapons.firing', 'Firing {ship} {variant}.', { ship: SHIPNAME[S.ship] || '', variant: lc(vName(curVar())) }), false); }
			else if (f === 'gun') { s.acc = 0; belt = 0; setStatus(ORION.t('weapons.spinningUp', 'Spinning up.'), false); }
			else if (f === 'rocket') { s.phase = 'lock'; s.p = 0; s.sent = 0; s.next = 0; s.alive = 0; s.t0 = clock; setStatus(ORION.t('weapons.acquiring', 'Acquiring lock.'), true); }
			else if (f === 'rail') { s.phase = 'charge'; s.p = 0; s.fireOnFull = src === 'click' || src === 'chargefire'; s.held = src === 'pointer' || src === 'key'; setStatus(ORION.t('weapons.charging', 'Charging.'), false); }
			else if (f === 'pd') { belt = 0; s.phase = 'run'; s.sent = 0; s.next = 0; s.done = 0; setStatus(ORION.t('weapons.hostileIncoming', 'Hostile rockets incoming.'), true); }
			E.stop.hidden = false; E.fire.classList.toggle('is-held', !!s.held);
		}
		function release() {
			E.fire.classList.remove('is-held');
			if (!seq) return; seq.held = false;
			if (seq.fam === 'rail' && seq.phase === 'charge' && !seq.fireOnFull) {
				if (seq.p >= 0.5) fireRail(); else { var tx = ORION.t('weapons.releasedEarly', 'Released at {percent} %, below 50 %: cancelled. Hold longer, or use Charge and fire.', { percent: Math.round(seq.p * 100) }); endSeq(tx); speak(tx); }
			}
		}
		function chargeFire() { if (!S.deployed) { setStatus(ORION.t('weapons.retractedFire', 'The mount is retracted. Deploy it to fire.'), true); return; } if (reduced()) { stillFrame(); return; } if (seq) { setStatus(ORION.t('weapons.alreadyRunning', 'Already running. Press Stop to cancel.'), false); return; } clearStill(); press('chargefire'); }

		function hostileShot() {
			var from = new T.Vector3(TARGET_X - 3, target.position.y + 1, target.position.z), to = muzzleWorld(0, new T.Vector3());
			spawnBolt(from, to, 30, COLORS.hostile, 2.6, 0.2, function (p) { spriteFx(COLORS.hostile, 2.4, 0.3, 500, 0.4, p); });
		}
		/* laser */
		function stepLaser(dt) {
			var st = P(), s = seq, firing = s.held || clock < s.until; if (!firing) { endSeq(ORION.t('weapons.ready', 'Ready.')); return; }
			setMeter('FIRING', 1, st.refireMs ? ORION.t('weapons.shotsPerSecond', '{rate} shots/s', { rate: nn1(1000 / st.refireMs) }) : '');
			while (clock >= s.next) {
				var mi = C.shots % muzzles.length, from = muzzleWorld(mi, new T.Vector3()), to = surfacePoint(new T.Vector3()), dmg = st.damage;
				var spd = (st.muzzleSpeedMs || 600) * K; C.shots++;
				spawnBolt(from, to, spd, COLORS.laser, 1.9 * sizeS, 0.2, function (p) { hit(dmg, p, 2); });
				flash(from, 1.6, COLORS.laser, 160);
				s.next += st.refireMs;
			}
		}
		/* minigun and CIWS rounds */
		function beltUsed() { return belt; }
		function gunStep(dt, wantFire, targetFn, onRound, canShoot) {
			var st = P(), up = st.spinUpMs || 800, down = st.spinDownMs || 1600;
			if (wantFire) spin = Math.min(1, spin + dt / up); else spin = Math.max(0, spin - dt / down);
			if (rotor) rotor.rotation.x += spin * 0.9 * dt / 16;
			setDial(spin);
			if (wantFire && canShoot !== false && st.rpm && spin > 0.02 && (!st.belt || belt < st.belt)) {
				spinAcc += st.rpm / 60 * spin * dt / 1000;
				var perTracer = Math.max(1, Math.ceil(st.rpm / 60 / 9));
				while (spinAcc >= 1) {
					spinAcc -= 1; belt++; C.rounds++;
					if (C.rounds % perTracer === 0) {
						var from = muzzleWorld(0, new T.Vector3()), to = targetFn(); spawnBolt(from, to, (st.muzzleSpeedMs || 900) * K, COLORS.gun, 1.7, 0.11, onRound ? function (p) { onRound(p); } : function (p) { spriteFx(COLORS.gun, 1.2, 0.35, 300, 0.4, p); });
					}
				}
			}
			return spin;
		}
		function stepGun(dt) {
			var st = P(), s = seq, firing = (s.held || clock < s.until) && (!st.belt || belt < st.belt);
			if (st.belt && belt >= st.belt && !s.reloading) { s.reloading = true; s.reloadAt = clock + RELOAD_DISPLAY_MS; setStatus(ORION.t('weapons.beltEmpty', 'Belt empty. Reload is {game} in the game; the lab reloads in {lab}.', { game: ms(st.reloadMs || 0), lab: ms(RELOAD_DISPLAY_MS) }), true); }
			if (s.reloading) { setMeter('RELOADING', 1 - (s.reloadAt - clock) / RELOAD_DISPLAY_MS, '', true); if (clock >= s.reloadAt) { belt = 0; s.reloading = false; s.until = 0; s.held = false; } }
			var sp = gunStep(dt, firing && !s.reloading, function () { return surfacePoint(new T.Vector3()); }, function (p) { spriteFx(COLORS.gun, 1.1, 0.3, 280, 0.4, p); });
			if (firing && sp >= 1 && !s.said) { s.said = true; setStatus(ORION.t('weapons.fullSpin', 'Full spin: {rpm}.', { rpm: st.rpm ? nn(st.rpm) + ' rpm' : '' }), false); }
			if (!s.reloading) setMeter('SPIN', sp, Math.round(sp * 100) + ' %' + (st.rpm ? ', ' + nn(Math.round(st.rpm * sp)) + ' rpm' : ''));
			gunGlow.visible = firing && sp > 0.3 && !s.reloading; if (gunGlow.visible) { muzzleWorld(0, gunGlow.position); gunGlow.material.opacity = 0.45 * sp; }
			if (!firing && sp <= 0 && !s.reloading) endSeq(ORION.t('weapons.ready', 'Ready.'));
		}
		/* rockets */
		function launchRocket(i, guided) {
			var st = P(), from = muzzleWorld(i, new T.Vector3()), elev = clamp((st.turnDegS || 25) * 1.2, 15, 50) * Math.PI / 180, spread = (i % 3 - 1) * 0.18;
			var dir = new T.Vector3(Math.cos(elev), Math.sin(elev), spread), spd = (st.rocketSpeedMs || 320) * K, dmg = st.damage, splash = Math.max(2.5, (st.splashRadiusM || 40) * 0.12);
			C.shots++; seq.alive++;
			var rk = spawnRocket({ from: from, dirInit: dir, speedU: spd, turnRad: (st.turnDegS || 25) * Math.PI / 180 * 2.6, color: COLORS.rocket, deathRadius: 3,
				aim: function (o) { return aimPoint(o, i + 1); },
				onExplode: function (p, onTarget) { seq && seq.alive--; if (onTarget) { C.hits++; C.dmg += dmg || 0; } explosion(p, splash, COLORS.rocket); } });
			addFx(rk); flash(from, 2, COLORS.rocket, 220);
		}
		function stepRocket(dt) {
			var st = P(), s = seq;
			if (s.phase === 'lock') {
				s.p = Math.min(1, (clock - s.t0) / (st.lockMs || 1500)); lockRing.set(s.p);
				lockRing.line.material.color.setHex(s.p >= 1 ? 0xffffff : COLORS.rocket);
				setMeter('LOCK', s.p, ORION.t('weapons.lockValue', '{percent} % of {time}', { percent: Math.round(s.p * 100), time: ms(st.lockMs || 0) }));
				if (s.p >= 1) { s.phase = 'launch'; s.next = clock; setStatus(ORION.t('weapons.locked', 'Locked. Launching a volley of {n}.', { n: VOLLEY }), true); }
			} else if (s.phase === 'launch') {
				setMeter('VOLLEY', s.sent / VOLLEY, ORION.t('weapons.volleyValue', '{sent} of {total}', { sent: s.sent, total: VOLLEY }));
				while (s.sent < VOLLEY && clock >= s.next) { launchRocket(s.sent, true); s.sent++; s.next += st.refireMs || 500; }
				if (s.sent >= VOLLEY) { s.phase = 'flight'; C.volleys++; }
			} else if (s.phase === 'flight') {
				setMeter('IN FLIGHT', 1, ORION.t('weapons.val.rockets', { one: '{value} rocket', other: '{value} rockets' }, { n: s.alive, value: s.alive })); if (s.alive <= 0) { s.phase = 'reload'; s.rt = clock + RELOAD_DISPLAY_MS; lockRing.set(0); setStatus(ORION.t('weapons.volleyDone', 'Volley done. Reload is {game} in the game; the lab reloads in {lab}.', { game: ms(st.reloadMs || 0), lab: ms(RELOAD_DISPLAY_MS) }), true); }
			} else if (s.phase === 'reload') {
				setMeter('RELOADING', 1 - (s.rt - clock) / RELOAD_DISPLAY_MS, '', true); if (clock >= s.rt) endSeq(ORION.t('weapons.ready', 'Ready.'));
			}
		}
		/* rails */
		function fireRail() {
			var st = P(), s = seq, from = muzzleWorld(0, new T.Vector3()), to = surfacePoint(new T.Vector3()); s.phase = 'cool'; s.cool = clock; chargeRing.set(0);
			var dir = to.clone().sub(from), dist = dir.length(); dir.normalize(); var travel = dist / ((st.muzzleSpeedMs || 4000) * K) * 1000, t = 0, mesh = new T.Mesh(geos.box, mat(COLORS.rail, 1).clone()), core = new T.Mesh(geos.box, mat(0xffffff, 1).clone());
			mesh.material.opacity = 0.55; scene.add(mesh, core); var dmg = st.damage, landed = false;
			var bright = flashOK(); if (!bright) { core.material.opacity = 0.4; }
			C.rails++; C.shots++; recoil = 1;
			addFx({ cosmetic: false, update: function (dt2) {
				t += dt2; var head = Math.min(1, t / travel), l = dist * head;
				mesh.scale.set(Math.max(l, 0.01), 0.9, 0.9); mesh.position.copy(from).addScaledVector(dir, l / 2); mesh.quaternion.setFromUnitVectors(X, dir);
				core.scale.set(Math.max(l, 0.01), 0.24, 0.24); core.position.copy(mesh.position); core.quaternion.copy(mesh.quaternion);
				if (head >= 1 && !landed) { landed = true; hit(dmg, to, 4.5); shock(to, 5, COLORS.rail); }
				var k = (t - travel) / 1200; if (k >= 1) return false; if (k > 0) { mesh.material.opacity = 0.55 * (1 - k); core.material.opacity = (bright ? 1 : 0.4) * (1 - k) * (1 - k); } return true;
			}, dispose: function () { removeObj(mesh); removeObj(core); mesh.material.dispose(); core.material.dispose(); } });
			flash(from, 3.2, COLORS.rail, 300);
			var m = ORION.t('weapons.slugAway', 'Slug away: {damage} damage. Game cooldown {game}; the lab lets you fire again in {lab}.', { damage: nn(st.damage || 0), game: ms(st.cooldownMs || 0), lab: ms(COOL_DISPLAY_MS) }); setStatus(m, true);
		}
		function stepRail(dt) {
			var st = P(), s = seq, charge = st.chargeMs || 2000;
			if (s.phase === 'charge') {
				s.p = Math.min(1, s.p + dt / charge); chargeRing.set(s.p); muzzleWorld(0, chargeRing.line.position);
				setMeter('CHARGE', s.p, s.p >= 0.5 ? ORION.t('weapons.chargeCan', '{percent} %, can fire', { percent: Math.round(s.p * 100) }) : ORION.t('weapons.chargeHold', '{percent} %, hold to 50 %', { percent: Math.round(s.p * 100) }));
				if (s.p >= 1) { if (s.fireOnFull) fireRail(); else { s.phase = 'full'; s.fullAt = clock; setStatus(ORION.t('weapons.fullyCharged', 'Fully charged. Release to fire; it discharges by itself after {time}.', { time: ms(RAIL_HOLD_MS) }), true); } }
			} else if (s.phase === 'full') {
				setMeter('FULL', 1, ORION.t('weapons.autoDischarge', 'auto discharge in {time} s', { time: nn1((RAIL_HOLD_MS - (clock - s.fullAt)) / 1000) })); muzzleWorld(0, chargeRing.line.position);
				if (!s.held || clock - s.fullAt >= RAIL_HOLD_MS) fireRail();
			} else if (s.phase === 'cool') {
				var k = (clock - s.cool) / COOL_DISPLAY_MS; setMeter('COOLDOWN', 1 - k, ORION.t('weapons.gameCooldown', 'game: {time}', { time: ms(st.cooldownMs || 0) }), true); if (k >= 1) endSeq(ORION.t('weapons.ready', 'Ready.'));
			}
		}
		/* point defence */
		function stepPd(dt) {
			var st = P(), s = seq, isLaser = S.variant === 'laser_pd', rangeU = (st.rangeM || 1500) * DS, base = famById('rocket').variants[0].stats.rocketSpeedMs || 380, spd = base * K;
			if (s.sent < 3 && clock >= s.next) {
				var from = new T.Vector3(TARGET_X - 3, target.position.y + (s.sent - 1) * 2.2, target.position.z + (s.sent - 1) * 2), idx = s.sent;
				var rk = spawnRocket({ from: from, dirInit: new T.Vector3(-1, 0.25 * (idx - 1), 0.2 * (idx - 1)), speedU: spd, turnRad: 3, color: COLORS.hostile, deathRadius: 2.4, reach: 3, life: 9000,
					aim: function (o) { return muzzleWorld(0, o); }, onExplode: function (p) { s.done++; explosion(p, 4, COLORS.hostile); setStatus(ORION.t('weapons.rocketReached', 'A rocket reached the mount.'), true); } });
				pdRockets.push(rk); addFx(rk); C.shots++; s.sent++; s.next = clock + 1700;
			}
			var alive = pdRockets.filter(function (r) { return r.alive; });
			var mpos = muzzleWorld(0, new T.Vector3()), tgt = null, best = 1e9;
			alive.forEach(function (r) { var d = r.pos.distanceTo(mpos); if (d < rangeU && d < best) { best = d; tgt = r; } });
			var firing = !!tgt;
			if (isLaser) {
				setMeter('ENGAGING', alive.length ? 1 : 0, ORION.t('weapons.incomingValue', '{n} incoming', { n: alive.length }));
				if (!s.nextShot) s.nextShot = clock;
				if (tgt && clock >= s.nextShot) {
					s.nextShot = clock + (st.refireMs || 120);
					var ft = best / ((st.muzzleSpeedMs || 1200) * K), lead = tgt.pos.clone().addScaledVector(tgt.vel, tgt.spec.speedU * ft), burst = st.burst || 3, targetRk = tgt;
					spawnBolt(muzzleWorld(C.shots % muzzles.length, new T.Vector3()), lead, (st.muzzleSpeedMs || 1200) * K, COLORS.pd, 2, 0.15, function (p) {
						if (!targetRk.alive) return; if (targetRk.pos.distanceTo(p) < 3.6) { targetRk.hits++; spriteFx(COLORS.pd, 1.2, 0.5, 260, 0.5, p); if (targetRk.hits >= burst) { targetRk.kill(); C.intercepts++; s.done++; speak(ORION.t('weapons.rocketDestroyed', 'Rocket destroyed.')); } } });
				}
			} else {
				var sp = gunStep(dt, alive.length > 0, function () { return tgt ? tgt.pos.clone() : mpos.clone().add(new T.Vector3(10, 0, 0)); }, null, firing);
				setMeter('SPIN', sp, ORION.t('weapons.spinIncoming', '{percent} %, {n} incoming', { percent: Math.round(sp * 100), n: alive.length }));
				if (tgt && sp > 0.5 && clock - (s.lastHit || 0) > 130) { s.lastHit = clock; tgt.hits++; spriteFx(COLORS.pd, 1.1, 0.4, 240, 0.5, tgt.pos); if (tgt.hits >= 6) { tgt.kill(); C.intercepts++; s.done++; speak(ORION.t('weapons.rocketDestroyed', 'Rocket destroyed.')); } }
			}
			if (s.sent >= 3 && !alive.length) { if (s.fin == null) s.fin = clock; if (clock - s.fin > 600 && (isLaser || spin <= 0.02)) { var tx = ORION.t('weapons.pdDone', 'Done: {n} of 3 rockets shot down.', { n: C.intercepts }); pdRockets = []; endSeq(tx); speak(tx); } }
		}

		/* ---- still frame for reduced motion: one effect frame, no animation ---- */
		function keep(o) { stillList.push(o); return o; }
		function clearStill() { while (stillList.length) { var o = stillList.pop(); o.dispose && o.dispose(); } lockRing.set(0); chargeRing.set(0); }
		function stillBolt(color, len, thick, from, to, frac) { var b = makeBolt(color, len, thick), dir = to.clone().sub(from).normalize(); b.place(from, dir, from.distanceTo(to) * frac); keep(b); }
		function stillFrame() {
			clearStill(); if (seq) stopAll('');
			var f = S.fam, st = P(), from = muzzleWorld(0, new T.Vector3()), to = aimPoint(new T.Vector3()), txt = '';
			function glow(p, size, color, op) { var g = kit.glowSprite(color, size, op); g.position.copy(p); scene.add(g); keep({ dispose: function () { removeObj(g); g.material.dispose(); } }); }
			glow(from, 2.4, COLORS[f] || 0xffffff, 0.6); glow(to, 3.4, COLORS[f] || 0xffffff, 0.45);
			if (f === 'laser') { [0.3, 0.55, 0.8].forEach(function (k) { stillBolt(COLORS.laser, 1.9 * sizeS, 0.2, from, to, k); }); txt = ORION.t('weapons.stillLaser', 'Still frame: laser bolts every {time}, {damage} damage each, {speed} m/s.', { time: ms(st.refireMs || 0), damage: nn(st.damage || 0), speed: nn(st.muzzleSpeedMs || 0) }); }
			else if (f === 'rocket') { lockRing.set(1); lockRing.line.material.color.setHex(0xffffff); for (var i = 0; i < 6; i++) { var rm = makeRocketMesh(COLORS.rocket), k = (i + 1) / 7, p = from.clone().lerp(to, k); p.y += Math.sin(k * Math.PI) * 6; rm.g.position.copy(p); keep(rm); } txt = ORION.t('weapons.stillRocket', 'Still frame: lock complete ({lock}), volley of {n} rockets, {damage} damage each, splash {splash} m.', { lock: ms(st.lockMs || 0), n: VOLLEY, damage: nn(st.damage || 0), splash: nn(st.splashRadiusM || 0) }); }
			else if (f === 'rail') { var b = new T.Mesh(geos.box, mat(COLORS.rail, 0.55).clone()), d = from.distanceTo(to); b.scale.set(d, 0.7, 0.7); b.position.copy(from).lerp(to, 0.5); b.quaternion.setFromUnitVectors(X, to.clone().sub(from).normalize()); scene.add(b); keep({ dispose: function () { removeObj(b); b.material.dispose(); } }); chargeRing.set(1); chargeRing.line.position.copy(from); txt = ORION.t('weapons.stillRail', 'Still frame: slug after a {time} charge, {damage} damage, {speed} m/s.', { time: ms(st.chargeMs || 0), damage: nn(st.damage || 0), speed: nn(st.muzzleSpeedMs || 0) }); }
			else if (f === 'gun') { for (var j = 1; j <= 8; j++) stillBolt(COLORS.gun, 1.6, 0.11, from, to, j / 9); txt = ORION.t('weapons.stillGun', 'Still frame: tracers at {rpm} rpm after {time} of spin-up.', { rpm: nn(st.rpm || 0), time: ms(st.spinUpMs || 0) }); }
			else { var rr = makeRocketMesh(COLORS.hostile); rr.g.position.copy(from).lerp(to, 0.45); keep(rr); stillBolt(COLORS.pd, 2, 0.15, from, rr.g.position, 0.9); glow(rr.g.position, 3.6, 0xffe2b0, 0.5); txt = ORION.t('weapons.stillPd', 'Still frame: point defence shooting down a hostile rocket within {range}.', { range: ORION.ui.fmt.len(st.rangeM || 0) }); }
			setStatus(txt, true); setMeter('STILL', 1, ''); ctx.requestRender();
		}

		/* ---- loop ---- */
		function layoutCamera() {
			var sz = ctx.viewer.size, asp = sz.w / Math.max(1, sz.h); if (Math.abs(asp - lastAspect) < 0.001) return; lastAspect = asp;
			var halfW = 28, halfH = 12.5, tv = Math.tan(camera.fov * Math.PI / 360), dist = Math.max(halfW / (tv * asp), halfH / tv);
			camera.position.set(0, dist * 0.16, dist); camera.lookAt(0, 0.6, 0); camera.near = 1; camera.far = 3000; camera.updateProjectionMatrix();
		}
		function update(dt, t) {
			layoutCamera(); dt = Math.min(dt, 50); clock += dt;
			var full = ctx.motion === 'full', animating = false;
			if (full) { driftT += dt / 1000; target.position.y = Math.sin(driftT * 0.55) * 1.4; target.position.z = Math.cos(driftT * 0.4) * 1.8; target.rotation.y += dt * 0.00012; animating = true; }
			lockRing.line.position.set(TARGET_X, target.position.y, target.position.z);
			var tgtK = S.deployed ? 1 : 0; if (full) deployK += (tgtK - deployK) * Math.min(1, dt / 90); else deployK = tgtK;
			mount.scale.setScalar(Math.max(deployK, 0.001)); mount.visible = deployK > 0.02;
			if (recoil > 0) { recoil = Math.max(0, recoil - dt / 500); mountInner.position.x = -recoil * 0.9 * sizeS; } else mountInner.position.x = 0;
			if (seq && !full) { stopAll(ORION.t('weapons.motionOff', 'Motion is off or paused: fire shows one still frame.')); }
			if (seq) {
				animating = true;
				switch (seq.fam) { case 'laser': stepLaser(dt); break; case 'gun': stepGun(dt); break; case 'rocket': stepRocket(dt); break; case 'rail': stepRail(dt); break; case 'pd': stepPd(dt); break; }
			} else if (spin > 0) { /* spin-down after a stop */ spin = Math.max(0, spin - dt / 1600); if (rotor) rotor.rotation.x += spin * 0.9 * dt / 16; setDial(spin > 0 ? spin : null); animating = true; }
			for (var i = fxList.length - 1; i >= 0; i--) { var o = fxList[i], alive = true; try { alive = o.update(dt); } catch (e) { alive = false; if (W.console) console.warn('weapons fx failed', e); } if (!alive) { o.dispose && o.dispose(); fxList.splice(i, 1); } else animating = true; }
			refreshReadout(false);
			return animating;
		}
		function step(msTotal) { var left = msTotal; while (left > 0) { var d = Math.min(50, left); update(d, 0); left -= d; } ctx.requestRender(); }
		function dispose() {
			fxList.forEach(function (o) { o.dispose && o.dispose(); }); fxList = []; clearStill(); lockRing.dispose(); chargeRing.dispose(); removeObj(gunGlow); gunGlow.material.dispose();
			Object.keys(mats).forEach(function (k) { mats[k].dispose(); }); Object.keys(geos).forEach(function (k) { geos[k].dispose(); });
			[mMetal, mDark, mCoil, mGlowTip].forEach(function (m) { m.dispose(); }); R = null;
		}
		buildMount(); layoutCamera();
		return {
			update: update, dispose: dispose, step: step, press: press, release: release, chargeFire: chargeFire, stop: function () { stopAll(ORION.t('weapons.stopped', 'Stopped.')); }, still: stillFrame,
			setWeapon: function () { stopAll(''); clearStill(); fxList.forEach(function (o) { o.dispose && o.dispose(); }); fxList = []; belt = 0; spin = 0; spinAcc = 0; pdRockets = []; buildMount(); setStatus(ORION.t('weapons.readyVariant', 'Ready: {variant}.', { variant: vName(curVar()) }), false); ctx.requestRender(); },
			beltUsed: beltUsed, running: isRunning, clock: function () { return clock; }, maxFlashWindow: maxFlashWindow, flashCount: function () { return flashDrawn.length; },
			snapshot: function () { return { seq: seq ? seq.fam + ':' + (seq.phase || '') : null, fx: fxList.length, mountVisible: mount.visible, deployK: deployK }; },
			counters: C
		};
	}

	/* ------------------------------------------------------------------ init */
	function init(root, api) {
		DATA = ORION.data || W.ORION_DATA;
		if (!DATA || !DATA.weapons || !DATA.weapons.families) { return; }
		FAMS = []; ORDER.forEach(function (id) { DATA.weapons.families.forEach(function (f) { if (f.id === id) FAMS.push(f); }); });
		(DATA.fleet || []).forEach(function (s) { FLEET[s.id] = s; SHIPNAME[s.id] = s.name; });
		if (!FAMS.length) return;
		['tabs', 'panel', 'variants', 'ship-field', 'ship', 'mode', 'posture-field', 'posture', 'posture-note', 'deploy', 'deploy-state', 'facts', 'tbody', 'table-cap', 'src', 'mounted', 'capture', 'fire', 'charge', 'stop', 'status', 'readout', 'hint', 'dial', 'dial-t', 'meter-bar', 'meter-name', 'meter-val', 'viewer'].forEach(function (id) {
			E[id.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })] = D.getElementById('weapons-' + id);
		});
		E.tcap = E.tableCap;
		if (!E.tabs || !E.viewer) return;
		S.fam = FAMS[0].id; S.variant = FAMS[0].variants[0].id; S.ship = shipsFor(FAMS[0].variants[0])[0] || null;
		renderTabs(); renderAll();
		setMeter('READY', 0, ''); refreshReadout(true);

		/* tabs: arrow keys move and select (automatic activation) */
		E.tabs.addEventListener('click', function (e) { var b = e.target.closest('[role="tab"]'); if (b) selectFamily(b.dataset.fam, false); });
		E.tabs.addEventListener('keydown', function (e) {
			var tabs = [].slice.call(E.tabs.children), i = tabs.indexOf(D.activeElement), n = -1;
			if (i < 0) return;
			if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + tabs.length - 1) % tabs.length;
			else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1; else return;
			e.preventDefault(); selectFamily(tabs[n].dataset.fam, true);
		});
		function selectFamily(id, focus) {
			if (id === S.fam) { if (focus) $('#weapons-tab-' + id).focus(); return; }
			var f = famById(id); if (!f) return; S.fam = id; S.variant = f.variants[0].id; S.ship = shipsFor(f.variants[0])[0] || S.ship;
			S.mode = 'manual'; renderAll(); onWeaponChanged(ORION.t('weapons.selected', '{name} selected.', { name: ORION.i18n.d(f.name) })); if (focus) $('#weapons-tab-' + id).focus();
		}
		E.variants.addEventListener('click', function (e) {
			var b = e.target.closest('[data-variant]'); if (!b || b.dataset.variant === S.variant) return;
			var prevShip = S.ship; S.variant = b.dataset.variant; var ids = shipsFor(curVar()); if (ids.indexOf(prevShip) < 0) S.ship = ids[0] || null; S.mode = 'manual';
			renderAll(); onWeaponChanged(ORION.t('weapons.selected', '{name} selected.', { name: vName(curVar()) })); var nb = $('[data-variant="' + S.variant + '"]', E.variants); if (nb) nb.focus();
		});
		E.ship.addEventListener('change', function () { S.ship = E.ship.value; renderTable(); onWeaponChanged(ORION.t('weapons.mountedAs', 'Mounted as on {ship}.', { ship: SHIPNAME[S.ship] || S.ship })); });
		E.mode.addEventListener('click', function (e) {
			var b = e.target.closest('[data-mode]'); if (!b) return; S.mode = b.dataset.mode; renderMode(); renderPosture(); updateControls();
			var nb = $('[data-mode="' + S.mode + '"]', E.mode); if (nb) nb.focus(); onWeaponChanged(ORION.t('weapons.selected', '{name} selected.', { name: S.mode.toUpperCase() }));
		});
		E.posture.addEventListener('click', function (e) {
			var b = e.target.closest('[data-posture]'); if (!b) return; S.posture = b.dataset.posture; renderPosture(); updateControls();
			var nb = $('[data-posture="' + S.posture + '"]', E.posture); if (nb) nb.focus(); speak((DATA.weapons.postureLabels && DATA.weapons.postureLabels[S.posture]) || S.posture);
		});
		E.deploy.addEventListener('click', function () {
			S.deployed = !S.deployed; if (!S.deployed && R) R.stop(); updateControls(); if (R) R.snapshot(); if (VIEWER) VIEWER.requestRender();
			speak(S.deployed ? ORION.t('weapons.mountDeployed', 'Mount deployed.') : ORION.t('weapons.mountRetracted', 'Mount retracted. Retracted weapons are hidden and do not fire.')); setStatus(S.deployed ? ORION.t('weapons.deployedDot', 'Deployed.') : ORION.t('weapons.retractedHidden', 'Retracted: hidden and not firing.'), false);
		});
		E.mounted.addEventListener('click', function (e) { var a = e.target.closest('a[data-ship]'); if (a) ORION.bus.emit('ship:select', { id: a.dataset.ship, from: 'weapons' }); });
		ORION.bus.on('ship:select', function (p) { if (!p || p.from === 'weapons') return; if (shipsFor(curVar()).indexOf(p.id) >= 0 && S.ship !== p.id) { S.ship = p.id; renderShip(); renderTable(); } });
		ORION.bus.on('motion', function () { if (VIEWER) VIEWER.requestRender(); });

		/* fire controls: hold is optional; a click from assistive tech is a full burst */
		var suppressClickUntil = 0;
		function press(src) { if (!R) { setStatus(ORION.t('weapons.needs3dNumbers', 'The firing range needs 3D, which is not running here. The numbers below are the game\'s own.'), false); return; } R.press(src); }
		function release() { if (R) R.release(); }
		E.fire.addEventListener('pointerdown', function (e) { if (e.button != null && e.button > 0) return; try { E.fire.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } press('pointer'); });
		['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { E.fire.addEventListener(ev, function () { suppressClickUntil = performance.now() + 400; release(); }); });
		E.fire.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press('key'); } else if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
		E.fire.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); suppressClickUntil = performance.now() + 400; release(); } });
		E.fire.addEventListener('click', function () { if (performance.now() < suppressClickUntil) return; press('click'); setTimeout(release, 0); });
		E.charge.addEventListener('click', function () { if (R) R.chargeFire(); else setStatus(ORION.t('weapons.needs3d', 'The firing range needs 3D, which is not running here.'), false); });
		E.stop.addEventListener('click', function () { if (R) R.stop(); });

		/* the viewer: non-interactive scene with its own keys (Space / Enter fire, Escape stops), click fires a burst */
		var host = E.viewer; host.tabIndex = 0; host.setAttribute('aria-describedby', 'weapons-hint');
		VIEWER = ORION.viewer(host, {
			name: 'weapons', priority: 'section', label: ORION.t('weapons.viewerLabel', 'Firing range'), title: ORION.t('weapons.viewerTitle', 'WEAPONS RANGE'), posterKey: ORION.media('feature.weapon.laser') ? 'feature.weapon.laser' : 'poster.weapons', pausable: true, interactive: false, modelId: 'buoy',
			setup: async function (ctx) {
				var model = null;
				try { model = await ctx.loadModel('buoy'); } catch (e) { model = null; }
				var ctrl = createRange(ctx, model);
				R = ctrl; S.model = !!model; capRange = true; ctx.viewer.setCaption(rangeCaption());
				ctx.viewer.setLabel(rangeLabel());
				setStatus(ORION.t('weapons.readyVariant', 'Ready: {variant}.', { variant: vName(curVar()) }), false);
								return { update: function (dt, t) { return ctrl.update(dt * 1000, t); }, /* core.js passes seconds; the range works in ms */ dispose: function () { ctrl.dispose(); } };
			}
		});
		host.addEventListener('keydown', function (e) {
			if (e.target !== host) return;
			if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press('key'); } else if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
			else if (e.key === 'Escape' && R) R.stop();
		});
		host.addEventListener('keyup', function (e) { if (e.target === host && (e.key === ' ' || e.key === 'Enter')) { release(); } });
		host.addEventListener('click', function (e) {
			if (e.target.closest('.viewer__toolbar, .viewer__note, button, a')) return;
			if (S.fam === 'rail' && R) R.chargeFire(); else { press('click'); setTimeout(release, 0); }
		});

		/* language switch (I18N.md 3.8): re-render every piece of text this section drew, keeping family, variant, ship, mode, posture and focus */
		ORION.bus.on('lang', function () {
			ORION.ui.keepFocus(E.tabs, function () { renderTabs(); syncTabs(); });
			ORION.ui.keepFocus(E.panel, function () { renderAll(); });
			meterLast = ''; setMeter.apply(null, meterArgs); refreshReadout(true);
			if (!R || !R.running()) { var ik = idleKind; if (ik === 'variant') setStatus(ORION.t('weapons.readyVariant', 'Ready: {variant}.', { variant: vName(curVar()) }), false); else if (ik === 'ready') setStatus(ORION.t('weapons.ready', 'Ready.'), false); }
			if (VIEWER) { VIEWER.setTexts({ label: R ? rangeLabel() : ORION.t('weapons.viewerLabel', 'Firing range'), title: ORION.t('weapons.viewerTitle', 'WEAPONS RANGE') }); if (R || capRange) VIEWER.setCaption(rangeCaption()); }
		});

		/* test and debug hooks */
		ORION.__debug.weapons = {
			state: function () { return JSON.parse(JSON.stringify(S)); }, counters: function () { return JSON.parse(JSON.stringify(C)); }, live: function () { return !!R; },
			range: function () { return R; }, select: function (fam, variant) { selectFamily(fam, false); if (variant) { var b = $('[data-variant="' + variant + '"]', E.variants); if (b) b.click(); } }
		};
	}

	ORION.register('weapons', { init: init });

	/* ------------------------------------------------------------------ ?selftest steps (DESIGN.md 7) */
	function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
	async function until(fn, ms) { var t0 = performance.now(); while (performance.now() - t0 < ms && !fn()) await sleep(100); return !!fn(); }
	function key(el, k, type) { el.dispatchEvent(new KeyboardEvent(type || 'keydown', { key: k, bubbles: true, cancelable: true })); }
	function tabState() { return [].map.call($('#weapons-tabs').children, function (b) { return b.id.replace('weapons-tab-', '') + (b.getAttribute('aria-selected') === 'true' ? '*' : ''); }).join(','); }
	function cell(stat) { var r = $('#weapons-tbody [data-stat="' + stat + '"] td'); return r ? r.textContent : null; }
	if (ORION.selftest && ORION.selftest.add) {
		ORION.selftest.add('weapons: tabs follow A.5 order and work by keyboard', async function () {
			var sec = $('#weapons'); if (!sec || !ORION.__debug.weapons) return { ok: false, note: 'weapons section not initialised' };
			sec.scrollIntoView({ behavior: 'instant', block: 'start' }); await sleep(300);
			var order = [].map.call($('#weapons-tabs').children, function (b) { return b.dataset.fam; }).join(',');
			if (order !== 'laser,rocket,rail,gun,pd') return { ok: false, note: 'tab order ' + order };
			var first = $('#weapons-tab-laser'); first.focus();
			key(first, 'ArrowRight'); var s1 = tabState(); key(D.activeElement, 'ArrowRight'); key(D.activeElement, 'ArrowRight'); key(D.activeElement, 'ArrowRight'); var s2 = tabState();
			key(D.activeElement, 'ArrowRight'); var s3 = tabState(); key(D.activeElement, 'End'); var s4 = tabState(); key(D.activeElement, 'Home'); var s5 = tabState();
			var panelOk = $('#weapons-panel').getAttribute('aria-labelledby') === 'weapons-tab-laser';
			var ok = /rocket\*/.test(s1) && /pd\*/.test(s2) && /laser\*/.test(s3) && /pd\*/.test(s4) && /laser\*/.test(s5) && panelOk;
			return { ok: ok, note: [s1, s2, s3, s4, s5].join(' | ') + ' panel=' + panelOk + ' order=' + order };
		});
		ORION.selftest.add('weapons: stats equal ORION_DATA (8 spot checks) and modes legal', async function () {
			var d = ORION.__debug.weapons, W_ = ORION.data.weapons, notes = [], bad = 0;
			function chk(fam, variant, stat, expect) { d.select(fam, variant); var got = cell(stat); var ok = got === expect; if (!ok) bad++; notes.push(fam + '/' + variant + '.' + stat + '=' + got + (ok ? '' : ' (want ' + expect + ')')); }
			var rl = W_.families[1].variants[0].stats, rr = W_.families[2].variants[2].stats, gm = W_.families[3].variants[1].stats, pd = W_.families[4].variants[0].stats;
			var f = ORION.ui.fmt;
			chk('rocket', 'light', 'damage', f.num(rl.damage, 0)); chk('rocket', 'heavy', 'lockMs', ms(4000)); chk('rail', 'heavy', 'damage', f.num(rr.damage, 0)); chk('rail', 'heavy', 'chargeMs', ms(4500));
			chk('gun', 'medium', 'rpm', f.num(gm.rpm, 0) + ' rpm'); chk('gun', 'medium', 'spinUpMs', ms(1000)); chk('pd', 'laser_pd', 'refireMs', ms(pd.refireMs)); chk('pd', 'laser_pd', 'rangeM', ORION.ui.fmt.len(1500));
			var lc = []; ['laser', 'rocket', 'rail', 'gun', 'pd'].forEach(function (id) { var fam = W_.families.filter(function (x) { return x.id === id; })[0]; fam.variants.forEach(function (v) { var m = modesFor(fam, v); lc.push(id + '/' + v.id + ':' + (m.manual ? 'M' : '') + (m.auto ? 'A' : '')); }); });
			d.select('laser', 'fixed');
			var exp = 'laser/fixed:M,laser/turret_medium:MA,laser/turret_large:MA,rocket/light:MA,rocket/medium:MA,rocket/heavy:MA,rail/light:M,rail/medium:M,rail/heavy:M,rail/turret_medium:M,gun/light:MA,gun/medium:MA,gun/heavy:MA,pd/laser_pd:A,pd/ciws_medium:A,pd/ciws_heavy:A';
			var modesOk = lc.join(',') === exp; if (!modesOk) bad++;
			return { ok: !bad, note: notes.join('; ') + ' | modes ' + (modesOk ? 'ok' : lc.join(',')) };
		});
		ORION.selftest.add('weapons: FIRE works (laser), flashes capped at 3 per second', async function () {
			var d = ORION.__debug.weapons; if (ORION.state.tier === 'static' || ORION.state.webgl !== 'ok') return { ok: true, note: 'skipped: 3D is off (tier ' + ORION.state.tier + ', webgl ' + ORION.state.webgl + '); tabs and table remain' };
			d.select('laser', 'fixed'); $('#weapons-viewer').scrollIntoView({ behavior: 'instant', block: 'center' });
			var live = await until(function () { return d.live(); }, 12000); if (!live) return { ok: false, note: 'range did not mount in 12 s: ' + (ORION.__debug.viewers().filter(function (v) { return v.name === 'weapons'; })[0] || {}).state };
			var r = d.range(); $('#weapons-fire').click(); r.step(2200); var c = d.counters();
			var maxW = r.maxFlashWindow(), ok = c.shots >= 6 && c.hits >= 3 && maxW <= 3;
			return { ok: ok, note: 'shots ' + c.shots + ', hits ' + c.hits + ', flashes drawn ' + r.flashCount() + ', max in any 1 s ' + maxW + ' (limit 3), refire ' + ORION.data.weapons.families[0].variants[0].perShip.kestrel.refireMs + ' ms' };
		});
		ORION.selftest.add('weapons: FIRE advances in real time (render loop, not range.step)', async function () {
			var d = ORION.__debug.weapons; if (ORION.state.tier === 'static' || ORION.state.webgl !== 'ok' || !d.live()) return { ok: true, note: 'skipped: range not live' };
			d.select('laser', 'fixed'); $('#weapons-viewer').scrollIntoView({ behavior: 'instant', block: 'center' }); await sleep(300);
			var r = d.range(), c0 = d.counters().shots; $('#weapons-fire').click();
			var moved = await until(function () { return d.counters().shots >= c0 + 1; }, 7000); r.stop();
			return { ok: moved, note: moved ? 'a shot was fired by the live render loop' : 'no shot in 7 s of real time: update() is not receiving real dt (units?)' };
		});
		ORION.selftest.add('weapons: Charge and fire (railgun, no holding), rocket volley, minigun spin-up, point defence', async function () {
			var d = ORION.__debug.weapons; if (ORION.state.tier === 'static' || ORION.state.webgl !== 'ok' || !d.live()) return { ok: true, note: 'skipped: range not live' };
			var r = d.range(), notes = [], ok = true;
			d.select('rail', 'light'); var st = ORION.data.weapons.families[2].variants[0].stats; $('#weapons-charge').click();
			r.step(300); var mid = r.snapshot().seq; r.step(st.chargeMs + 600); var c1 = d.counters(); var railOk = /rail:/.test(mid) && c1.rails === 1; ok = ok && railOk; notes.push('rail: mid ' + mid + ', slugs ' + c1.rails);
			r.step(st.cooldownMs ? 3000 : 3000); r.stop();
			d.select('rocket', 'light'); $('#weapons-fire').click(); var rs = ORION.data.weapons.families[1].variants[0].stats; r.step(rs.lockMs + 6 * rs.refireMs + 4000); var c2 = d.counters(); var rocketOk = c2.shots === 6 && c2.volleys === 1; ok = ok && rocketOk; notes.push('rocket: launched ' + c2.shots + ', volleys ' + c2.volleys + ', hits ' + c2.hits);
			r.stop(); d.select('gun', 'light'); var gs = ORION.data.weapons.families[3].variants[0].stats; $('#weapons-fire').click(); r.step(gs.spinUpMs + 800); var c3 = d.counters(); var gunOk = c3.rounds > 20; ok = ok && gunOk; notes.push('gun: rounds ' + c3.rounds + ' after ' + (gs.spinUpMs + 800) + ' ms'); r.stop();
			d.select('pd', 'laser_pd'); $('#weapons-fire').click(); r.step(9000); var c4 = d.counters(); var pdOk = c4.shots === 3 && c4.intercepts >= 1; ok = ok && pdOk; notes.push('pd: incoming ' + c4.shots + ', destroyed ' + c4.intercepts);
			var maxW = r.maxFlashWindow(); ok = ok && maxW <= 3; notes.push('max flashes in 1 s ' + maxW);
			r.stop(); d.select('laser', 'fixed');
			return { ok: ok, note: notes.join('; ') };
		});
	}
})();
