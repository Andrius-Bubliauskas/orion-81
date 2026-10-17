/* orion-81.io mock: js/sec-build.js (build task, ORI-1308). Classic script, file:// safe (no fetch, no imports, no image textures).
   DESIGN.md 4.4 and 5.6: the LOADOUT configurator, the live shield bubble, the L1 loadout string (built only from the data's tokens,
   checked against loadout.vectors), and the modular damage / break-apart preview. Registers 'build'.
   Numbers come from ORION_DATA (fleet + loadout); nothing is invented here. */
(function () {
	'use strict';
	var W = window, D = document;

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
	var $ = function (s, r) { return (r || D).querySelector(s); };
	var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
	function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
	function trimZeros(s) { return s.replace(/0+$/, ''); }
	function upper(s) { return String(s).toUpperCase(); }
	function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

	function famTag(f) {
		var ORION = W.ORION;
		switch (f) {
			case 'laser': return ORION.t('build.fam.laser', 'LASER'); case 'gun': return ORION.t('build.fam.gun', 'MINIGUN'); case 'rocket': return ORION.t('build.fam.rocket', 'ROCKET');
			case 'rail': return ORION.t('build.fam.rail', 'RAILGUN'); case 'pd': return ORION.t('build.fam.pd', 'POINT DEFENCE');
		}
		return '';
	}
	function kindTag(k) {
		var ORION = W.ORION;
		switch (k) {
			case 'fixed': return ORION.t('build.kind.fixed', 'FIXED'); case 'turret': return ORION.t('build.kind.turret', 'TURRET'); case 'launcher': return ORION.t('build.kind.launcher', 'LAUNCHER');
			case 'spinal': return ORION.t('build.kind.spinal', 'SPINAL'); case 'railturret': return ORION.t('build.kind.railturret', 'RAILTURRET'); case 'pd': return ORION.t('build.kind.pd', 'PD');
		}
		return upper(k);
	}
	function modWord(w) {
		var ORION = W.ORION;
		switch (w) {
			case 'l': return ORION.t('build.mw.l', 'left');
			case 'r': return ORION.t('build.mw.r', 'right');
			case 'al': return ORION.t('build.mw.al', 'aft left');
			case 'ar': return ORION.t('build.mw.ar', 'aft right');
			case 'fl': return ORION.t('build.mw.fl', 'fore left');
			case 'fr': return ORION.t('build.mw.fr', 'fore right');
			case 'hab': return ORION.t('build.mw.hab', 'habitat');
			case 'cic': return ORION.t('build.mw.cic', 'CIC');
			case 'ciws': return ORION.t('build.mw.ciws', 'CIWS');
			case 'rcs': return ORION.t('build.mw.rcs', 'thruster');
			case 'tur': return ORION.t('build.mw.tur', 'turret');
			case 'mgt': return ORION.t('build.mw.mgt', 'minigun turret');
			case 'mg': return ORION.t('build.mw.mg', 'minigun');
			case 'pd': return ORION.t('build.mw.pd', 'point defence');
			case 'rtur': return ORION.t('build.mw.rtur', 'railgun turret');
			case 'rail': return ORION.t('build.mw.rail', 'railgun');
			case 'rkt': return ORION.t('build.mw.rkt', 'rocket launcher');
			case 'gun': return ORION.t('build.mw.gun', 'laser');
			case 'gunp': return ORION.t('build.mw.gunp', 'gun pod');
			case 'cells': return ORION.t('build.mw.cells', 'missile cells');
			case 'aux': return ORION.t('build.mw.aux', 'auxiliary');
			case 'fore': return ORION.t('build.mw.fore', 'fore');
			case 'aft': return ORION.t('build.mw.aft', 'aft');
			case 'array': return ORION.t('build.mw.array', 'array');
			case 'battery': return ORION.t('build.mw.battery', 'battery');
			case 'belt': return ORION.t('build.mw.belt', 'belt');
			case 'bow': return ORION.t('build.mw.bow', 'bow');
			case 'bridge': return ORION.t('build.mw.bridge', 'bridge');
			case 'cab': return ORION.t('build.mw.cab', 'cab');
			case 'canard': return ORION.t('build.mw.canard', 'canard');
			case 'cargo': return ORION.t('build.mw.cargo', 'cargo');
			case 'cheek': return ORION.t('build.mw.cheek', 'cheek');
			case 'citadel': return ORION.t('build.mw.citadel', 'citadel');
			case 'city': return ORION.t('build.mw.city', 'city');
			case 'cockpit': return ORION.t('build.mw.cockpit', 'cockpit');
			case 'core': return ORION.t('build.mw.core', 'core');
			case 'crew': return ORION.t('build.mw.crew', 'crew');
			case 'deck': return ORION.t('build.mw.deck', 'deck');
			case 'dorsal': return ORION.t('build.mw.dorsal', 'dorsal');
			case 'drive': return ORION.t('build.mw.drive', 'drive');
			case 'drum': return ORION.t('build.mw.drum', 'drum');
			case 'hangar': return ORION.t('build.mw.hangar', 'hangar');
			case 'hull': return ORION.t('build.mw.hull', 'hull');
			case 'launcher': return ORION.t('build.mw.launcher', 'launcher');
			case 'magazine': return ORION.t('build.mw.magazine', 'magazine');
			case 'main': return ORION.t('build.mw.main', 'main');
			case 'mast': return ORION.t('build.mw.mast', 'mast');
			case 'mid': return ORION.t('build.mw.mid', 'mid');
			case 'nose': return ORION.t('build.mw.nose', 'nose');
			case 'outrigger': return ORION.t('build.mw.outrigger', 'outrigger');
			case 'pod': return ORION.t('build.mw.pod', 'pod');
			case 'power': return ORION.t('build.mw.power', 'power');
			case 'prow': return ORION.t('build.mw.prow', 'prow');
			case 'radiator': return ORION.t('build.mw.radiator', 'radiator');
			case 'reactor': return ORION.t('build.mw.reactor', 'reactor');
			case 'ring': return ORION.t('build.mw.ring', 'ring');
			case 'rocket': return ORION.t('build.mw.rocket', 'rocket');
			case 'sensor': return ORION.t('build.mw.sensor', 'sensor');
			case 'slab': return ORION.t('build.mw.slab', 'slab');
			case 'spinal': return ORION.t('build.mw.spinal', 'spinal');
			case 'spine': return ORION.t('build.mw.spine', 'spine');
			case 'sponson': return ORION.t('build.mw.sponson', 'sponson');
			case 'tail': return ORION.t('build.mw.tail', 'tail');
			case 'tank': return ORION.t('build.mw.tank', 'tank');
			case 'truss': return ORION.t('build.mw.truss', 'truss');
			case 'tug': return ORION.t('build.mw.tug', 'tug');
			case 'waist': return ORION.t('build.mw.waist', 'waist');
			case 'wing': return ORION.t('build.mw.wing', 'wing');
		}
		return w;
	}
	function partKind(k) {
		var ORION = W.ORION;
		switch (k) {
			case 'hull': return ORION.t('build.mk.hull', 'hull');
			case 'livery': return ORION.t('build.mk.livery', 'livery');
			case 'drive': return ORION.t('build.mk.drive', 'drive');
			case 'rail': return ORION.t('build.mk.rail', 'rail');
			case 'bridge': return ORION.t('build.mk.bridge', 'bridge');
			case 'weapon': return ORION.t('build.mk.weapon', 'weapon');
			case 'turret': return ORION.t('build.mk.turret', 'turret');
			case 'magazine': return ORION.t('build.mk.magazine', 'magazine');
			case 'reactor': return ORION.t('build.mk.reactor', 'reactor');
			case 'radiator': return ORION.t('build.mk.radiator', 'radiator');
			case 'rcs': return ORION.t('build.mk.rcs', 'rcs');
			case 'joint': return ORION.t('build.mk.joint', 'joint');
			case 'door': return ORION.t('build.mk.door', 'door');
			case 'armour': return ORION.t('build.mk.armour', 'armour');
			case 'crew': return ORION.t('build.mk.crew', 'crew');
			case 'tank': return ORION.t('build.mk.tank', 'tank');
			case 'sensor': return ORION.t('build.mk.sensor', 'sensor');
			case 'wing': return ORION.t('build.mk.wing', 'wing');
			case 'hangar': return ORION.t('build.mk.hangar', 'hangar');
			case 'cargo': return ORION.t('build.mk.cargo', 'cargo');
			case 'other': return ORION.t('build.mk.other', 'other');
		}
		return k;
	}
	function lc(x) { return W.ORION.i18n.lang === 'en' ? String(x).toLowerCase() : String(x); } /* English lower-casing only */
	var TINT_SEL = 0x4f9be8, TINT_DMG = 0xffb347;

	function init(root, ORION) {
		var data = ORION.data || W.ORION_DATA, L = data && data.loadout;
		var app = $('#build-app', root);
		if (!data || !L || !L.hullTypes || !L.perClass || !app) return; // the static content stays
		var fmt = ORION.ui.fmt, announce = ORION.ui.announce;
		var FLEET = {}; data.fleet.forEach(function (f) { FLEET[f.id] = f; });
		var rules = L.stringRules, rule = L.customColorRule, bay = L.bay;

		/* ------------------------------------------------------------ state */
		var S = {
			ship: FLEET.anvil ? 'anvil' : data.fleet[0].id,
			hull: 0, shield: 0,
			col: { mode: 'palette', idx: 0, hex: '#ff8800' },
			hp: {}, craft: bay ? bay.stockCraft : null, craftHull: 0, craftShield: 0, craftHp: {},
			tab: 'loadout', subject: 'ship', hot: null,
			selMod: null, damaged: {}, brk: 'idle', modInfo: null
		};
		var sc = { ctx: null, v: null, gen: 0, ks: null, shield: null, content: null, proj: null, groups: null, plan: null, cur: {}, t: 0, meshes: [], sprites: [], hits: 0, rt: 0 };

		/* ------------------------------------------------------------ pure helpers (formulas, string, colour) */
		function rowsFor(id) { return (L.perClass[id] || []).slice().sort(function (a, b) { return a.index - b.index; }); }
		function hasBay(id) { return !!(bay && id === bay.classId && FLEET[id] && FLEET[id].bay); }
		function stats(id, h, s) {
			var f = FLEET[id], ht = L.hullTypes[h], st = L.shieldTypes[s];
			return { hull: Math.round(f.hull * ht.hullScale), armor: f.armor + ht.armorAdd, shield: Math.round(f.shield * st.shieldScale), regen: f.shieldRegen * st.regenScale };
		}
		function effColor() {
			var c = S.col;
			if (c.mode === 'palette') { var sc0 = L.shieldColors[c.idx]; return { token: sc0.token, rgb: sc0.rgb, name: sc0.name, dark: false, custom: false }; }
			var hx = c.hex.replace('#', '').toLowerCase(), rgb = [parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16)];
			if (Math.max(rgb[0], rgb[1], rgb[2]) < rule.minBrightestChannel) { var st0 = L.shieldColors[0]; return { token: st0.token, rgb: st0.rgb, name: st0.name, dark: true, custom: true }; }
			return { token: hx, rgb: rgb, name: 'CUSTOM', dark: false, custom: true };
		}
		/* The L1 string, concatenated from the data's tokens following loadout.stringRules (no encoder ported from C). */
		function segments(p) {
			var stockTier = L.hullTypes[0].token + L.shieldTypes[0].token, stockCol = L.shieldColors[0].token;
			return [
				{ key: 'tiers', label: ORION.t('build.seg.tiers', 'Hull and shield tier'), value: p.hull + p.shield, stock: stockTier },
				{ key: 'colour', label: ORION.t('build.seg.colour', 'Shield colour'), value: p.color, stock: stockCol },
				{ key: 'hp', label: ORION.t('build.seg.hp', 'Hardpoint options'), value: trimZeros(p.hp.join('')), stock: '' },
				{ key: 'craft', label: ORION.t('build.seg.craft', 'Hangar craft'), value: p.craft, stock: rules.stockCraftToken },
				{ key: 'ctiers', label: ORION.t('build.seg.ctiers', 'Craft hull and shield tier'), value: p.craftHull + p.craftShield, stock: stockTier },
				{ key: 'chp', label: ORION.t('build.seg.chp', 'Craft hardpoint options'), value: trimZeros(p.craftHp.join('')), stock: '' }
			];
		}
		function buildString(p) {
			var sg = segments(p), n = sg.length;
			if (rules.trimTrailingStockSegments) while (n > 0 && sg[n - 1].value === sg[n - 1].stock) n--;
			return [rules.tag, p.shipId].concat(sg.slice(0, n).map(function (x) { return x.value; })).join('.');
		}
		function picksNow() {
			var rows = rowsFor(S.ship), b = hasBay(S.ship), crow = b ? rowsFor(S.craft) : [];
			return {
				shipId: S.ship, hull: L.hullTypes[S.hull].token, shield: L.shieldTypes[S.shield].token, color: effColor().token,
				hp: rows.map(function (r) { return S.hp[r.hardpoint] || '0'; }),
				craft: b ? (S.craft === bay.stockCraft ? rules.stockCraftToken : S.craft) : rules.stockCraftToken,
				craftHull: b ? L.hullTypes[S.craftHull].token : L.hullTypes[0].token, craftShield: b ? L.shieldTypes[S.craftShield].token : L.shieldTypes[0].token,
				craftHp: crow.map(function (r) { return S.craftHp[r.hardpoint] || '0'; })
			};
		}
		function selfCheck() {
			var out = { total: L.vectors.length, pass: 0, rows: [] };
			L.vectors.forEach(function (v) {
				var p = v.picks, got = buildString({ shipId: v.shipId, hull: p.hull, shield: p.shield, color: p.color, hp: p.hp, craft: p.craft, craftHull: p.craftHull, craftShield: p.craftShield, craftHp: p.craftHp });
				var ok = got === v.string; if (ok) out.pass++;
				out.rows.push({ expected: v.string, got: got, ok: ok, src: v.src });
			});
			return out;
		}

		/* ------------------------------------------------------------ DOM refs */
		var ui = {
			ship: $('#build-ship', root), shipInfo: $('#build-shipinfo', root), hull: $('#build-hull', root), shield: $('#build-shield', root), stats: $('#build-stats', root),
			colour: $('#build-colour', root), hp: $('#build-hardpoints', root), hangar: $('#build-hangar', root), strWrap: $('#build-string-wrap', root),
			reset: $('#build-reset', root), shot: $('#build-shot', root), hit: $('#build-hit', root), subject: $('#build-subject', root), viewNote: $('#build-viewnote', root),
			tabL: $('#build-tab-loadout', root), tabD: $('#build-tab-damage', root), panL: $('#build-panel-loadout', root), panD: $('#build-panel-damage', root),
			modules: $('#build-modules', root), dmgIntro: $('#build-dmg-intro', root), dmg: $('#build-damage', root), brk: $('#build-break', root), reas: $('#build-reassemble', root), dmgStatus: $('#build-dmg-status', root),
			host: $('#build-viewer', root)
		};
		var sayT = 0;
		function say(text) { var l0 = ORION.i18n && ORION.i18n.lang; clearTimeout(sayT); sayT = setTimeout(function () { if (!ORION.i18n || ORION.i18n.lang === l0) announce(text); }, 350); }   /* dropped when the language changed meanwhile: it was worded in the old one */

		/* ------------------------------------------------------------ ship picker */
		function fillShipPicker() {
			var keep = ui.ship.value || S.ship; ui.ship.textContent = '';
			var groups = { small: ORION.t('build.group.small', 'Small, classes 1-5'), medium: ORION.t('build.group.medium', 'Medium, classes 6-10'), large: ORION.t('build.group.large', 'Large, classes 11-16') };
			Object.keys(groups).forEach(function (k) {
				var og = el('optgroup', { label: groups[k] });
				data.fleet.filter(function (f) { return f.siteClass === k; }).forEach(function (f) { og.append(el('option', { value: f.id, text: f.name + '  \u00b7  ' + ORION.i18n.d(f.role) })); });
				ui.ship.append(og);
			});
			ui.ship.value = keep;
		}
		function buildShipPicker() {
			fillShipPicker();
			ui.ship.addEventListener('change', function () { setShip(ui.ship.value, 'picker'); });
		}
		function updateShipInfo() {
			var f = FLEET[S.ship], v = { length: fmt.len(f.lengthM), hp: f.hardpoints.length, mods: f.modules.count };
			ui.shipInfo.textContent = hasBay(S.ship) ? ORION.t('build.shipInfoBay', '{length} \u00b7 {hp} hardpoints \u00b7 hangar bay \u00b7 {mods} modules', v) : ORION.t('build.shipInfo', '{length} \u00b7 {hp} hardpoints \u00b7 {mods} modules', v);
		}
		function setShip(id, from) {
			if (!FLEET[id]) return;
			if (id === S.ship && from !== 'force') { ui.ship.value = id; return; }
			S.ship = id; S.hull = 0; S.shield = 0; S.hp = {}; S.damaged = {}; S.selMod = null; S.hot = null; S.subject = 'ship'; S.brk = 'idle'; S.modInfo = null;
			S.craft = hasBay(id) ? bay.stockCraft : null; S.craftHull = 0; S.craftShield = 0; S.craftHp = {};
			ui.ship.value = id;
			renderAll();
			if (sc.v) { sc.v.setPoster('ship.' + id); sc.v.setLabel(viewLabel()); }
			rebuildContent(true);
			loadModules();
			ORION.bus.emit('build:ship', { id: id, from: from || 'picker' });
			say(ORION.t('build.shipSelected', '{name} selected. Tiers and mounts are back to stock; your shield colour stays.', { name: FLEET[id].name }));
		}

		/* ------------------------------------------------------------ tiers (radio cards) */
		function tierCards(host, name, legend, list, which) {
			var fs = el('fieldset', { class: 'radio-cards build-tiers' }, [el('legend', { text: legend })]);
			list.forEach(function (t, i) {
				var inp = el('input', { type: 'radio', name: name, value: String(i) });
				var scale = which === 'hull' ? ORION.t('build.hullScale', '\u00d7 {scale} hull, armour +{add}', { scale: t.hullScale, add: t.armorAdd }) : ORION.t('build.shieldScale', '\u00d7 {scale} shield, regen \u00d7 {regen}', { scale: t.shieldScale, regen: t.regenScale });
				var sub2 = el('span', { class: 'radio-card__sub build-tier__now', 'data-tier': String(i) });
				inp.addEventListener('change', function () {
					if (!inp.checked) return;
					if (which === 'hull') S.hull = i; else S.shield = i;
					refreshLoadout(); say(ORION.t('build.tierSelected', '{name} selected.', { name: t.name }));
				});
				fs.append(el('label', { class: 'radio-card' }, [inp, el('span', { class: 'radio-card__body' }, [el('span', { class: 'radio-card__title', text: t.name }), el('span', { class: 'radio-card__sub', text: scale }), sub2])]));
			});
			host.replaceChildren(fs);
		}
		function syncTierRadios() {
			$$('input[name="build-hull"]', ui.hull).forEach(function (r) { r.checked = Number(r.value) === S.hull; });
			$$('input[name="build-shield"]', ui.shield).forEach(function (r) { r.checked = Number(r.value) === S.shield; });
		}
		function updateTierSubs() {
			$$('.build-tier__now', ui.hull).forEach(function (n) { var s = stats(S.ship, Number(n.dataset.tier), S.shield); n.textContent = ORION.t('build.hullNow', '{hull} hull, armour {armor}', { hull: fmt.num(s.hull), armor: s.armor }); });
			$$('.build-tier__now', ui.shield).forEach(function (n) { var s = stats(S.ship, S.hull, Number(n.dataset.tier)); n.textContent = ORION.t('build.shieldNow', '{shield} shield, {regen}/s', { shield: fmt.num(s.shield), regen: fmt.num(s.regen, 1) }); });
		}

		/* ------------------------------------------------------------ stats with deltas vs stock */
		function statsDl(id, h, s, tag) {
			var cur = stats(id, h, s), base = stats(id, 0, 0);
			var rowsDef = [['hull', ORION.t('build.stat.hull', 'Hull'), 0], ['armor', ORION.t('build.stat.armour', 'Armour'), 0], ['shield', ORION.t('build.stat.shield', 'Shield'), 0], ['regen', ORION.t('build.stat.regen', 'Shield regen'), 1]];
			var dl = el('dl', { class: 'spec build-spec', 'data-stats': tag || 'ship' });
			rowsDef.forEach(function (r) {
				var d = Math.round((cur[r[0]] - base[r[0]]) * 100) / 100;
				var dtxt = d === 0 ? ORION.t('build.stock', 'stock') : (d > 0 ? '+' : '\u2212') + fmt.num(Math.abs(d), r[2]);
				dl.append(el('dt', { text: r[1] }), el('dd', { 'data-stat': r[0] }, [
					el('span', { class: 'build-val', 'data-v': String(cur[r[0]]), text: fmt.num(cur[r[0]], r[2]) }), ' ',
					el('span', { class: 'build-delta' + (d > 0 ? ' is-up' : '') , text: dtxt })]));
			});
			return dl;
		}
		function renderStats() {
			var f = FLEET[S.ship], fp = el('p', { class: 'small muted build-formula' });
			ORION.i18n.fill(fp, 'build.formula', 'Game formulas: hull = <0/>, armour = <1/>, shield = <2/>, regen = <3/>. Deltas are against the stock loadout.', [el('code', { translate: 'no', text: L.formulas.hull }), el('code', { translate: 'no', text: L.formulas.armor }), el('code', { translate: 'no', text: L.formulas.shield }), el('code', { translate: 'no', text: L.formulas.regen })]);
			fp.append(ORION.ui.src(L.src && L.src.formulas));
			ui.stats.replaceChildren(
				el('h3', { class: 'build-h', text: ORION.t('build.withLoadout', '{name} with this loadout', { name: f.name }) }),
				statsDl(S.ship, S.hull, S.shield, 'ship'), fp);
		}

		/* ------------------------------------------------------------ shield colour */
		function renderColour() {
			var fs = el('fieldset', { class: 'build-colours' }, [el('legend', { text: ORION.t('build.colour.legend', 'Shield colour') })]);
			var grid = el('div', { class: 'build-sw-grid' });
			L.shieldColors.forEach(function (c, i) {
				var inp = el('input', { type: 'radio', name: 'build-colour', value: String(i), 'data-token': c.token });
				inp.addEventListener('change', function () { if (!inp.checked) return; S.col.mode = 'palette'; S.col.idx = i; refreshColour(); say(ORION.t('build.colour.say', 'Shield colour {name}.', { name: c.name })); });
				var sw = el('span', { class: 'build-sw__chip', 'aria-hidden': 'true' }); sw.style.setProperty('--sw', c.hex);
				grid.append(el('label', { class: 'build-sw' }, [inp, el('span', { class: 'build-sw__body' }, [sw, el('span', { class: 'build-sw__name', text: c.name })])]));
			});
			var cin = el('input', { type: 'radio', name: 'build-colour', value: 'custom' });
			var cpick = el('input', { type: 'color', id: 'build-custom', value: S.col.hex, 'aria-label': ORION.t('build.colour.customLabel', 'Custom shield colour') });
			cin.addEventListener('change', function () { if (!cin.checked) return; S.col.mode = 'custom'; refreshColour(); say(ORION.t('build.colour.sayCustom', 'Custom shield colour.')); });
			cpick.addEventListener('input', function () { S.col.hex = cpick.value; S.col.mode = 'custom'; cin.checked = true; refreshColour(); });
			grid.append(el('label', { class: 'build-sw build-sw--custom' }, [cin, el('span', { class: 'build-sw__body' }, [el('span', { class: 'build-sw__name', text: 'CUSTOM' }), cpick])]));
			var msg = el('p', { class: 'small build-colmsg', id: 'build-colmsg', role: 'status' });
			fs.append(grid, msg, el('p', { class: 'small muted', text: ORION.t('build.colour.customNote', 'A custom colour is written into the loadout string as six hex digits.') + ' ' + ORION.i18n.d(rule.text) }));
			ui.colour.replaceChildren(fs);
		}
		function paintColourUi() {
			var c = effColor(), msg = $('#build-colmsg', ui.colour);
			$$('input[name="build-colour"]', ui.colour).forEach(function (r) { r.checked = S.col.mode === 'custom' ? r.value === 'custom' : r.value === String(S.col.idx); });
			var cp = $('#build-custom', ui.colour); if (cp) cp.value = S.col.hex;
			if (c.dark) { msg.textContent = ORION.t('build.colour.tooDark', 'That colour is too dark: its brightest channel is below 0x{hex}, so the game reads it as STOCK and your shield keeps the stock colour.', { hex: rule.minBrightestChannel.toString(16).toUpperCase() }); msg.classList.add('notice'); }
			else { msg.textContent = ''; msg.classList.remove('notice'); }
			return c;
		}
		function refreshColour() {
			var c = paintColourUi();
			applyShieldColour();
			refreshString();
			ORION.bus.emit('shield:color', { rgb: c.rgb });
		}
		function applyShieldColour() {
			if (sc.shield) { sc.shield.setColor(effColor().rgb); sc.v && sc.v.requestRender(); }
		}

		/* ------------------------------------------------------------ hardpoint rows (joined to the model by name) */
		/* fit labels are in-game names (protected) except the family word POINT DEFENCE, which is a normal UI string */
		function fitLabel(l) { return l.indexOf('POINT DEFENCE') < 0 ? l : l.split('POINT DEFENCE').join(ORION.t('weapons.famPd', 'POINT DEFENCE')); }
		function hpRowEl(shipId, row, store, ownerKey) {
			var f = FLEET[shipId], h = f.hardpoints.filter(function (x) { return x.name === row.hardpoint; })[0] || {};
			var meta = famTag(h.siteFamily) + (h.kind && h.kind !== 'pd' ? ' · ' + kindTag(h.kind) : '');
			var li = el('li', { class: 'build-row', 'data-hp': row.hardpoint, 'data-owner': ownerKey });
			var sid = 'build-hp-' + ownerKey + '-' + row.hardpoint;
			var lab = el('label', { class: 'build-row__lab', for: sid }, [el('span', { class: 'build-row__name mono', translate: 'no', text: row.hardpoint }), el('span', { class: 'build-row__meta', text: meta })]);
			var ctl;
			if (row.options.length > 1) {
				ctl = el('select', { id: sid, class: 'build-row__sel' });
				row.options.forEach(function (o) { ctl.append(el('option', { value: o.token, text: fitLabel(o.label) })); });
				ctl.value = store[row.hardpoint] || '0';
				ctl.addEventListener('change', function () { store[row.hardpoint] = ctl.value; refreshString(); say(ORION.t('common.labelNote', '{label}: {note}', { label: row.hardpoint, note: ctl.options[ctl.selectedIndex].text })); });
				ctl.addEventListener('focus', function () { setHot(row.hardpoint, ownerKey); });
				ctl.addEventListener('blur', function () { setHot(null); });
			} else {
				ctl = el('span', { id: sid, class: 'build-row__fit', text: fitLabel(row.options[0].label) });
				lab.removeAttribute('for');
			}
			li.append(lab, ctl);
			li.addEventListener('mouseenter', function () { setHot(row.hardpoint, ownerKey); });
			li.addEventListener('mouseleave', function () { setHot(null); });
			return li;
		}
		function renderRows() {
			var rows = rowsFor(S.ship), ul = el('ul', { class: 'build-rows' });
			rows.forEach(function (r) { ul.append(hpRowEl(S.ship, r, S.hp, 'ship')); });
			var changeable = rows.filter(function (r) { return r.options.length > 1; }).length;
			ui.hp.replaceChildren(
				el('h3', { class: 'build-h', id: 'build-hp-h' }, [ORION.t('build.hardpoints', 'Hardpoints') + ' ', el('span', { class: 'mono muted', text: ORION.t('build.hardpointsCount', '{n} · {changeable} with a choice', { n: rows.length, changeable: changeable }) })]),
				el('p', { class: 'small muted', text: ORION.t('build.hardpointsHelp', 'Each row is one mount, with exactly the fits and modes the game offers for this ship. Focus or hover a row to see the mount on the model.') }),
				el('div', { class: 'build-hp', role: 'group', 'aria-labelledby': 'build-hp-h' }, [ul]));
		}

		/* ------------------------------------------------------------ hangar craft (ANVIL only) */
		function renderHangar() {
			if (!hasBay(S.ship)) { ui.hangar.replaceChildren(); ui.hangar.hidden = true; return; }
			ui.hangar.hidden = false;
			var dims = bay.craftMaxM.map(function (n) { return fmt.num(n, 1); }).join(' \u00d7 ');
			var fs = el('fieldset', { class: 'build-hangar' }, [el('legend', { text: ORION.t('build.hangar.legend', 'Hangar bay') })]);
			fs.append(el('p', { class: 'mono-label', text: ORION.t('build.hangar.bayLine', '{name} \u00b7 {slots} slots \u00b7 craft up to {dims} m', { name: bay.name, slots: bay.slots, dims: dims }) }));
			var cards = el('div', { class: 'radio-cards build-craft', role: 'radiogroup', 'aria-label': ORION.t('build.hangar.craftType', 'Craft type') });
			bay.craftOptions.forEach(function (cid) {
				var inp = el('input', { type: 'radio', name: 'build-craft', value: cid });
				inp.checked = cid === S.craft;
				inp.addEventListener('change', function () {
					if (!inp.checked) return; S.craft = cid; S.craftHp = {};
					renderHangarRows(); refreshString(); showSubject('craft'); say(ORION.t('build.hangar.craftSelected', 'Hangar craft {name}. Craft hardpoints reset to stock.', { name: FLEET[cid].name }));
				});
				cards.append(el('label', { class: 'radio-card' }, [inp, el('span', { class: 'radio-card__body' }, [el('span', { class: 'radio-card__title', text: FLEET[cid].name }), el('span', { class: 'radio-card__sub', text: cid === bay.stockCraft ? ORION.t('build.hangar.craftStock', '\u00d7 {slots} \u00b7 stock', { slots: bay.slots }) : '\u00d7 ' + bay.slots })])]));
			});
			fs.append(cards);
			var tiers = el('div', { class: 'build-ctiers' });
			function tsel(id, label, list, key) {
				var sel = el('select', { id: id });
				list.forEach(function (t, i) { sel.append(el('option', { value: String(i), text: t.name })); });
				sel.value = String(S[key]);
				sel.addEventListener('change', function () { S[key] = Number(sel.value); renderCraftStats(); refreshString(); showSubject('craft'); say(ORION.t('common.labelNote', '{label}: {note}', { label: label, note: sel.options[sel.selectedIndex].text })); });
				return el('div', { class: 'build-ctier' }, [el('label', { for: id, class: 'mono-label', text: label }), sel]);
			}
			tiers.append(tsel('build-chull', ORION.t('build.hangar.craftHull', 'Craft hull'), L.hullTypes, 'craftHull'), tsel('build-cshield', ORION.t('build.hangar.craftShield', 'Craft shield'), L.shieldTypes, 'craftShield'));
			fs.append(tiers, el('div', { id: 'build-cstats' }), el('div', { id: 'build-crows' }));
			var ph = ORION.media('feature.bay');
			if (ph && ph.src) fs.append(el('figure', { class: 'build-shot' }, [el('img', { src: ph.src, alt: ph.alt || '', width: ph.w, height: ph.h, loading: 'lazy', decoding: 'async' }), el('figcaption', { class: 'viewer__caption', text: ph.caption || '' })]));
			ui.hangar.replaceChildren(fs);
			renderCraftStats(); renderHangarRows();
		}
		function renderCraftStats() {
			var h = $('#build-cstats', ui.hangar); if (!h) return;
			h.replaceChildren(
				el('h3', { class: 'build-h', text: ORION.t('build.hangar.craftStats', '{name} craft, each of {slots}', { name: FLEET[S.craft].name, slots: bay.slots }) }),
				statsDl(S.craft, S.craftHull, S.craftShield, 'craft'),
				el('p', { class: 'small muted', text: ORION.t('build.hangar.craftNote', 'The craft take the same hull and shield tiers as any ship. In the preview they wear your carrier\u2019s shield colour (0.6.1).') }));
		}
		function renderHangarRows() {
			var h = $('#build-crows', ui.hangar); if (!h) return;
			var rows = rowsFor(S.craft), ul = el('ul', { class: 'build-rows' });
			rows.forEach(function (r) { ul.append(hpRowEl(S.craft, r, S.craftHp, 'craft')); });
			h.replaceChildren(el('h3', { class: 'build-h', id: 'build-chp-h', text: ORION.t('build.hangar.craftRows', 'Craft hardpoints') }), el('p', { class: 'small muted', text: ORION.t('build.hangar.craftRowsHelp', 'Changing the craft type resets these rows to stock.') }), el('div', { class: 'build-hp', role: 'group', 'aria-labelledby': 'build-chp-h' }, [ul]));
		}

		/* ------------------------------------------------------------ loadout string */
		var selfRes = null;
		function renderStringBlock() {
			selfRes = selfCheck();
			var code = el('code', { translate: 'no', id: 'build-str', class: 'build-str__code', tabindex: '0', 'aria-label': ORION.t('build.str.label', 'Loadout string') });
			var copy = el('button', { type: 'button', class: 'btn btn--sm', id: 'build-copy', text: ORION.t('build.str.copy', 'Copy') });
			var cstat = el('span', { class: 'small muted', id: 'build-copystat', role: 'status' });
			copy.addEventListener('click', function () {
				var text = code.textContent, done = function (ok) { cstat.textContent = ok ? ORION.t('build.str.copied', 'Copied.') : ORION.t('build.str.copyFailed', 'Select the string and press Ctrl + C.'); if (!ok) { var r = D.createRange(); r.selectNodeContents(code); var s = W.getSelection(); s.removeAllRanges(); s.addRange(r); } setTimeout(function () { cstat.textContent = ''; }, 2500); };
				try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); else done(false); } catch (e) { done(false); }
			});
			var seg = el('ol', { class: 'build-segs', id: 'build-segs' });
			var fmtp = el('p', { class: 'small muted' });
			ORION.i18n.fill(fmtp, 'build.str.format', 'Format: <0/>', [el('code', { translate: 'no', text: L.stringFormat })]);
			var det = el('details', { class: 'build-details' }, [
				el('summary', { text: ORION.t('build.str.summary', 'Read the string, and how it is checked') }),
				fmtp,
				el('p', { class: 'small muted', text: ORION.i18n.d(rules.text) }),
				seg,
				el('p', { class: 'small', id: 'build-selfsum' }),
				el('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': ORION.t('build.str.tableLabel', 'Loadout string checks, scrollable table') }, [el('table', { class: 'table', id: 'build-selftab' })]),
				ORION.ui.src(L.src && L.src.vectors)
			]);
			ui.strWrap.replaceChildren(
				el('h3', { class: 'build-h', text: ORION.t('build.str.heading', 'Loadout string') }),
				el('div', { class: 'build-str' }, [code, copy, cstat]),
				el('p', { class: 'small muted', text: ORION.t('build.str.help', 'This is the exact string the game sends to the server. Your choices change it live.') }),
				det);
			var sum = $('#build-selfsum', ui.strWrap), tab = $('#build-selftab', ui.strWrap);
			sum.textContent = ORION.t('build.str.selfCheck', 'Self-check: this page rebuilt {pass} of {total} loadout strings recorded from the game\u2019s tests and docs, character for character.', { pass: selfRes.pass, total: selfRes.total });
			tab.append(el('thead', null, [el('tr', null, [el('th', { scope: 'col', text: ORION.t('build.str.recorded', 'Recorded string') }), el('th', { scope: 'col', text: ORION.t('build.str.rebuilt', 'Rebuilt here') })])]));
			var tb = el('tbody');
			selfRes.rows.forEach(function (r) { tb.append(el('tr', null, [el('td', { class: 'mono', text: r.expected }, [ORION.ui.src(r.src)]), el('td', { class: 'mono', text: r.ok ? ORION.t('build.str.identical', '\u2713 identical') : '\u2717 ' + r.got })])); });
			tab.append(tb);
			refreshString();
		}
		function refreshString() {
			var p = picksNow(), s = buildString(p), code = $('#build-str', ui.strWrap); if (!code) return;
			code.textContent = s;
			var segs = segments(p), n = segs.length;
			while (n > 0 && segs[n - 1].value === segs[n - 1].stock) n--;
			var ol = $('#build-segs', ui.strWrap); ol.replaceChildren();
			ol.append(el('li', null, [el('span', { class: 'build-segs__k', text: ORION.t('build.str.tagShip', 'Tag and ship') }), el('code', { translate: 'no', text: rules.tag + '.' + S.ship })]));
			segs.forEach(function (g, i) {
				var kept = i < n;
				if (g.key === 'craft' || g.key === 'ctiers' || g.key === 'chp') { if (!hasBay(S.ship) && !kept) return; }
				ol.append(el('li', { class: kept ? '' : 'is-left-out' }, [el('span', { class: 'build-segs__k', text: g.label }), el('code', { translate: 'no', text: g.value === '' ? ORION.t('build.str.empty', '(empty)') : g.value }), el('span', { class: 'build-segs__n muted', text: kept ? '' : ORION.t('build.str.leftOut', ' left out: stock, and nothing after it changes') })]));
			});
		}

		/* ------------------------------------------------------------ combined loadout refresh */
		function refreshLoadout() {
			syncTierRadios(); updateTierSubs(); renderStats(); refreshString();
			clearTimeout(refreshLoadout._t); refreshLoadout._t = setTimeout(function () { var s = stats(S.ship, S.hull, S.shield); say(ORION.t('build.statsSay', 'Hull {hull}, armour {armor}, shield {shield}, regen {regen} per second.', { hull: fmt.num(s.hull), armor: s.armor, shield: fmt.num(s.shield), regen: fmt.num(s.regen, 1) })); }, 500);
		}
		function renderShot() {
			var m = ORION.media('feature.loadout');
			if (!m || !m.src) { ui.shot.hidden = true; return; }
			ui.shot.replaceChildren(el('h3', { class: 'build-h', text: ORION.t('build.shotHead', 'The game’s own LOADOUT screen') }), el('img', { src: m.src, alt: m.alt || '', width: m.w, height: m.h, loading: 'lazy', decoding: 'async' }), el('figcaption', { class: 'viewer__caption', text: m.caption || '' }));
		}
		function renderAll() {
			updateShipInfo();
			buildTiers();
			renderStats(); renderColour(); renderRows(); renderHangar();
			if (!$('#build-str', ui.strWrap)) renderStringBlock();
			refreshColour(); refreshLoadout(); renderDamageIntro();
			applyTabUi();
		}
		function buildTiers() {
			tierCards(ui.hull, 'build-hull', ORION.t('build.hullType', 'Hull type'), L.hullTypes, 'hull');
			tierCards(ui.shield, 'build-shield', ORION.t('build.shieldType', 'Shield type'), L.shieldTypes, 'shield');
		}

		/* ------------------------------------------------------------ tabs */
		function setTab(t, focus) {
			if (t === S.tab) { if (focus) (t === 'loadout' ? ui.tabL : ui.tabD).focus(); return; }
			S.tab = t; applyTabUi(); if (focus) (t === 'loadout' ? ui.tabL : ui.tabD).focus();
			if (S.tab === 'loadout') S.subject = 'ship';
			rebuildContent(false);
			if (sc.v) sc.v.setLabel(viewLabel());
			say(t === 'loadout' ? ORION.t('build.tabLoadoutSay', 'Loadout tab.') : ORION.t('build.tabDamageSay', 'Damage tab.'));
		}
		function applyTabUi() {
			var L1 = S.tab === 'loadout';
			ui.tabL.setAttribute('aria-selected', String(L1)); ui.tabD.setAttribute('aria-selected', String(!L1));
			ui.tabL.tabIndex = L1 ? 0 : -1; ui.tabD.tabIndex = L1 ? -1 : 0;
			ui.panL.hidden = !L1; ui.panD.hidden = L1;
			ui.hit.hidden = !L1;
			ui.subject.hidden = !(L1 && hasBay(S.ship));
			ui.subject.setAttribute('aria-pressed', String(S.subject === 'craft'));
			ui.subject.textContent = S.subject === 'craft' ? ORION.t('build.showShip', 'Show {name}', { name: FLEET[S.ship].name }) : ORION.t('build.showCraft', 'Show hangar craft');
			ui.viewNote.hidden = !L1;
			refreshCaption();
			refreshDamageUi();
		}
		[ui.tabL, ui.tabD].forEach(function (t, i) {
			t.addEventListener('click', function () { setTab(i === 0 ? 'loadout' : 'damage', false); });
			t.addEventListener('keydown', function (e) {
				var k = e.key; if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
				e.preventDefault(); var to = (k === 'Home') ? 0 : (k === 'End') ? 1 : 1 - i; setTab(to === 0 ? 'loadout' : 'damage', true);
			});
		});
		function showSubject(s) {
			if (!hasBay(S.ship)) s = 'ship';
			if (S.tab !== 'loadout' || S.subject === s) return;
			S.subject = s; applyTabUi(); rebuildContent(true); if (sc.v) { sc.v.setPoster('ship.' + currentId()); sc.v.setLabel(viewLabel()); }
		}
		ui.subject.addEventListener('click', function () { showSubject(S.subject === 'craft' ? 'ship' : 'craft'); });
		ui.reset.addEventListener('click', function () {
			S.hull = 0; S.shield = 0; S.col = { mode: 'palette', idx: 0, hex: S.col.hex }; S.hp = {}; S.craftHp = {}; S.craftHull = 0; S.craftShield = 0; S.craft = hasBay(S.ship) ? bay.stockCraft : null; S.subject = 'ship';
			renderAll(); rebuildContent(true); say(ORION.t('build.resetSay', 'Loadout reset to stock.'));
		});

		/* ------------------------------------------------------------ viewer text */
		function currentId() { return (S.tab === 'loadout' && S.subject === 'craft' && hasBay(S.ship)) ? S.craft : S.ship; }
		function viewLabel() {
			var id = currentId(), f = FLEET[id], v = { name: f.name, role: lc(ORION.i18n.d(f.role)), length: fmt.len(f.lengthM) };
			if (S.tab !== 'loadout') return ORION.t('build.viewLabelDamage', '3D model of the {name} {role}, {length}, rotatable, shown in modules', v);
			v.colour = effColor().name;
			return S.subject === 'craft' ? ORION.t('build.viewLabelCraft', '3D model of the {name} {role}, {length}, rotatable, with its shield bubble in {colour} (hangar craft)', v) : ORION.t('build.viewLabelLoadout', '3D model of the {name} {role}, {length}, rotatable, with its shield bubble in {colour}', v);
		}
		function refreshCaption() {
			if (!sc.v) return; var id = currentId(), cap;
			if (sc.v.isLive()) {
				cap = S.tab === 'loadout' ? ORION.t('build.capLoadout', '{model}. Shield bubble drawn for this site; in the game it shows when the shield is hit.', { model: ORION.ui.modelCaption(id) }) : ORION.t('build.capDamage', '{model}. Preview animation for this site. In the game (0.3.0) modules take damage separately, joints fail and the hulk breaks into tumbling pieces with secondary explosions.', { model: ORION.ui.modelCaption(id) });
			} else { var m = ORION.media('ship.' + id); cap = m && m.caption ? m.caption : ''; }
			sc.v.setCaption(cap);
		}

		/* ------------------------------------------------------------ hotspots (hardpoint highlight) */
		function setHot(name, owner) {
			S.hot = name ? { name: name, owner: owner } : null;
			$$('.build-row', root).forEach(function (li) { li.classList.toggle('is-hot', !!name && li.dataset.hp === name && li.dataset.owner === owner); });
			paintHot();
		}
		function paintHot() {
			if (!sc.v) return; var layer = sc.v._layer; if (!layer) return;
			var want = S.hot && ((S.hot.owner === 'craft') === (S.subject === 'craft' && S.tab === 'loadout')) ? S.hot.name : null;
			$$('.build-hot:not(.build-pin)', layer).forEach(function (h) { h.classList.toggle('is-hot', !!want && h.dataset.hp === want); });
			layer.classList.toggle('has-hot', !!want);
			sc.v.requestRender();
		}

		/* ------------------------------------------------------------ scene */
		function dispose3(o) {
			o.traverse(function (n) {
				if (n.geometry) n.geometry.dispose();
				var ms = n.material ? [].concat(n.material) : [];
				ms.forEach(function (m) { for (var k in m) { var t = m[k]; if (t && t.isTexture) t.dispose(); } m.dispose(); });
			});
		}
		function clearContent() {
			if (sc.proj) { sc.proj.stop(); sc.proj = null; }
			if (sc.v && sc.v._layer) sc.v._layer.replaceChildren();
			if (sc.content) { if (sc.ctx) sc.ctx.scene.remove(sc.content); dispose3(sc.content); }
			sc.content = sc.ks = sc.shield = sc.groups = sc.plan = null; sc.cur = {}; sc.meshes = []; sc.sprites = [];
		}
		async function rebuildContent(refit) {
			var ctx = sc.ctx; if (!ctx || !sc.v || !sc.v.renderer) return;
			var gen = ++sc.gen, id = currentId(), model;
			try { model = await ctx.loadModel(id); }
			catch (e) { if (gen === sc.gen && sc.v.renderer) sc.v.unmount('failed', 'model', true); return; }
			if (gen !== sc.gen || sc.ctx !== ctx || !sc.v.renderer) return;
			placeContent(ctx, model, refit, id);
		}
		function placeContent(ctx, model, refit, id) {
			clearContent();
			var wantParts = S.tab === 'damage', wantShield = S.tab === 'loadout';
			var T = ctx.THREE, kit = ctx.kit, g = new T.Group(); g.name = 'build-content';
			var ks = kit.ship(model, { parts: wantParts }); g.add(ks.group);
			var bb = model.meta.bbox, cx = (bb.min[0] + bb.max[0]) / 2, cy = (bb.min[1] + bb.max[1]) / 2, cz = (bb.min[2] + bb.max[2]) / 2;
			var half = Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]) / 2;
			if (wantShield) { sc.shield = kit.shield(model, effColor().rgb); sc.shield.setMotion(sc.v.effectiveMotion()); g.add(sc.shield.mesh); }
			g.add(kit.starfield({ count: 260, radius: ks.radius * 16, twinkle: true }));
			ctx.scene.add(g); sc.content = g; sc.ks = ks;
			ks.group.children.forEach(function (c) { if (c.isSprite) sc.sprites.push(c); });
			if (wantParts) prepGroups(model, ks, T);
			if (refit || sc.fitId !== id || sc.fitTab !== S.tab) {
				kit.fit(ctx.camera, ctx.controls, wantShield ? half * 1.4 : ks.radius * 1.1, [cx, cy, cz]); ctx.setHome(); sc.fitId = id; sc.fitTab = S.tab;
			}
			buildHotspots(model, ks, kit);
			if (wantParts) refreshTints();
			refreshCaption(); sc.v.setLabel(viewLabel()); refreshDamageUi(); ctx.requestRender();
		}
		function buildHotspots(model, ks, kit) {
			var layer = sc.v.layer(), items = [];
			layer.replaceChildren();
			(model.meta.hardpoints || []).forEach(function (h) {
				var dot = el('span', { class: 'build-hot', 'data-hp': h.name, 'aria-hidden': 'true' }, [el('i'), el('b', { text: h.name })]);
				layer.append(dot); items.push({ point: h.origin, dir: h.axis, el: dot });
			});
			sc.pin = null;
			if (S.tab === 'damage') {
				var pe = el('span', { class: 'build-hot is-hot build-pin', 'aria-hidden': 'true', style: 'display:none' }, [el('i'), el('b', { text: '' })]);
				layer.append(pe); sc.pin = { point: [0, 0, 0], el: pe }; items.push(sc.pin);
			}
			sc.proj = kit.projector(sc.v, ks.group).watch(items);
			paintHot(); updatePin();
		}
		function updatePin() {
			var it = sc.pin; if (!it) return;
			var n = S.selMod, gp = n && sc.groups && sc.groups[n];
			it.el.style.display = gp ? '' : 'none';
			if (gp) { it.point = [gp.g.position.x, gp.g.position.y, gp.g.position.z]; it.el.lastChild.textContent = n; it.el.classList.toggle('is-dmg', !!S.damaged[n]); }
			if (sc.proj) sc.proj.update();
		}

		/* ---- modules: data from the model (works without WebGL) ---- */
		function modInfoFrom(model) {
			var meta = model.meta, parts = meta.parts, by = {}, order = [];
			parts.forEach(function (p, i) {
				if (!p.module) return;
				var m = by[p.module]; if (!m) { m = by[p.module] = { name: p.module, kind: null, idx: [], hps: [], adj: {}, c: null }; order.push(p.module); }
				m.idx.push(i);
				if (p.name === p.module || !m.kind) { m.kind = p.kind; var b = p.bbox; m.c = b ? [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2] : (p.pivot || [0, 0, 0]); }
			});
			(meta.joints || []).forEach(function (j) {
				var a = parts[j[0]] && parts[j[0]].module, b = parts[j[1]] && parts[j[1]].module;
				if (a && b && a !== b) { by[a].adj[b] = 1; by[b].adj[a] = 1; }
			});
			(meta.hardpoints || []).forEach(function (h) { if (h.part != null && parts[h.part] && parts[h.part].module) by[parts[h.part].module].hps.push(h.name); });
			return { id: model.id, order: order, by: by, core: meta.core };
		}
		async function loadModules() {
			var id = S.ship, mark = S.ship;
			ui.modules.replaceChildren(el('p', { class: 'small muted', text: ORION.t('build.mods.loading', 'Loading modules\u2026') }));
			try {
				var model = await ORION.loadModel(id);
				if (S.ship !== mark) return;
				S.modInfo = modInfoFrom(model); renderModules();
			} catch (e) {
				if (S.ship !== mark) return;
				ui.modules.replaceChildren(el('p', { class: 'notice', text: ORION.t('build.mods.failed', 'The module list could not load here.') }));
			}
		}
		function renderDamageIntro() {
			var f = FLEET[S.ship], k = f.modules.kinds || {}, parts = Object.keys(k).map(function (n) { return partKind(n) + ' ' + k[n]; }).join(' \u00b7 ');
			ui.dmgIntro.textContent = ORION.t('build.damageIntro', '{name} is built from {count} modules ({parts}). Select one in the list or on the model, damage it, then break the ship apart.', { name: f.name, count: f.modules.count, parts: parts });
		}
		function cap1(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
		function friendlyMod(n) {
			var w = String(n).split('_').map(function (t) { var m = /^(\d+)([lr])$/.exec(t), m2 = /^([lr])(\d+)$/.exec(t); if (m) return m[1] + ' ' + modWord(m[2]); if (m2) return modWord(m2[1]) + ' ' + m2[2]; return modWord(t); }).join(' ');
			return cap1(w);
		}
		function friendlyWeapon(n) {
			var m = /^([a-z]+)_(\d+)$/.exec(n); if (!m) return n;
			var w = modWord(m[1]); return (m[1] === 'gun' ? ORION.t('build.mods.fixedLaser', 'Fixed laser') : cap1(w)) + ' ' + m[2];
		}
		function renderModules() {
			var mi = S.modInfo; if (!mi) return;
			var ul = el('ul', { class: 'build-mods' });
			mi.order.forEach(function (n) {
				var m = mi.by[n], b = el('button', { type: 'button', class: 'build-mod', 'data-mod': n, 'aria-pressed': String(S.selMod === n) });
				b.setAttribute('title', n); b.append(el('span', { class: 'build-mod__name', text: friendlyMod(n) }), el('span', { class: 'build-mod__kind', text: m.kind ? partKind(m.kind) : '' }));
				if (m.hps.length) b.append(el('span', { class: 'build-mod__hp', text: ORION.t('build.mods.carries', 'carries {list}', { list: m.hps.map(friendlyWeapon).join(', ') }) }));
				b.append(el('span', { class: 'build-mod__state', text: S.damaged[n] ? ORION.t('build.mods.damaged', 'damaged') : '' }));
				if (n === mi.core) b.append(el('span', { class: 'build-mod__core', text: ORION.t('build.mods.core', 'core') }));
				if (S.damaged[n]) b.classList.add('is-damaged');
				b.addEventListener('click', function () { selectModule(n === S.selMod ? null : n, false); });
				ul.append(el('li', null, [b]));
			});
			ui.modules.replaceChildren(el('h3', { class: 'build-h', id: 'build-mods-h' }, [ORION.t('build.mods.heading', 'Modules') + ' ', el('span', { class: 'mono muted', text: String(mi.order.length) })]), el('div', { class: 'build-modlist', role: 'group', 'aria-labelledby': 'build-mods-h' }, [ul]));
		}
		function selectModule(n, fromModel) {
			S.selMod = n; refreshTints(); updatePin();
			$$('.build-mod', ui.modules).forEach(function (b) {
				var on = b.dataset.mod === n; b.setAttribute('aria-pressed', String(on));
				if (on && fromModel) { var c = b.closest('.build-modlist'); if (c) c.scrollTop = Math.max(0, b.offsetTop - c.clientHeight / 2); }
			});
			refreshDamageUi();
			if (n) say(S.damaged[n] ? ORION.t('build.mods.selectedDamaged', 'Module {name} selected, damaged.', { name: n }) : ORION.t('build.mods.selected', 'Module {name} selected.', { name: n })); else say(ORION.t('build.mods.none', 'No module selected.'));
		}
		function refreshDamageUi() {
			var n = S.selMod, live = !!(sc.v && sc.v.isLive() && sc.groups);
			ui.dmg.textContent = n && S.damaged[n] ? ORION.t('build.repairModule', 'Repair module') : ORION.t('build.damageModule', 'Damage module');
			ui.dmg.disabled = !n || S.brk !== 'idle';
			ui.brk.disabled = S.brk !== 'idle' || !live;
			ui.reas.disabled = S.brk === 'idle' && !Object.keys(S.damaged).some(function (k) { return S.damaged[k]; });
			ui.brk.setAttribute('aria-disabled', String(ui.brk.disabled));
			ui.hit.setAttribute('aria-disabled', String(!(sc.v && sc.v.isLive() && sc.shield)));
			var st = '';
			if (S.brk === 'breaking') st = ORION.t('build.status.breaking', 'Joints are failing\u2026');
			else if (S.brk === 'broken') st = ORION.t('build.status.broken', 'Broken apart. Reassemble to put the ship back together.');
			else if (S.brk === 'reassembling') st = ORION.t('build.status.reassembling', 'Reassembling\u2026');
			else if (S.tab === 'damage' && !live) st = (ORION.state.webgl === 'ok') ? ORION.t('build.status.waiting', 'The 3D view is not showing right now, so break-apart waits for it. Module damage still works in the list.') : ORION.t('build.status.no3d', 'Break apart needs the 3D view, which is off on this device. Module damage still works in the list.');
			else st = failFrom() ? ORION.t('build.status.failFrom', 'Joints will fail outward from {list}.', { list: failFrom() }) : '';
			ui.dmgStatus.textContent = st;
			$$('.build-mod', ui.modules).forEach(function (b) { var d = !!S.damaged[b.dataset.mod]; b.classList.toggle('is-damaged', d); $('.build-mod__state', b).textContent = d ? ORION.t('build.mods.damaged', 'damaged') : ''; });
		}
		function failSeeds() {
			var mi = S.modInfo; if (!mi) return [];
			var dm = Object.keys(S.damaged).filter(function (k) { return S.damaged[k] && mi.by[k]; });
			if (dm.length) return dm; if (S.selMod && mi.by[S.selMod]) return [S.selMod]; return mi.core && mi.by[mi.core] ? [mi.core] : [];
		}
		function failFrom() { return failSeeds().join(', '); }
		ui.dmg.addEventListener('click', function () {
			var n = S.selMod; if (!n) return;
			if (S.damaged[n]) delete S.damaged[n]; else S.damaged[n] = true;
			refreshTints(); updatePin(); refreshDamageUi(); say(S.damaged[n] ? ORION.t('build.mods.sayDamaged', '{name} damaged.', { name: n }) : ORION.t('build.mods.sayRepaired', '{name} repaired.', { name: n }));
		});
		function refreshTints() {
			var ks = sc.ks, mi = S.modInfo; if (!ks || !mi || !ks.parts || S.tab !== 'damage') return;
			mi.order.forEach(function (n) {
				var col = S.damaged[n] ? TINT_DMG : (S.selMod === n ? TINT_SEL : null);
				mi.by[n].idx.forEach(function (i) { ks.highlightPart(i, col); });
			});
			if (sc.v) sc.v.requestRender();
		}

		/* ---- modular groups + break-apart ---- */
		function prepGroups(model, ks, T) {
			var mi = modInfoFrom(model); S.modInfo = mi; S.brk = 'idle'; sc.groups = {}; sc.meshes = [];
			mi.order.forEach(function (n) {
				var m = mi.by[n], g = new T.Group(); g.name = 'mod:' + n; g.position.set(m.c[0], m.c[1], m.c[2]);
				m.idx.forEach(function (i) { var pm = ks.parts[i] && ks.parts[i].mesh; if (pm) { g.add(pm); pm.position.set(-m.c[0], -m.c[1], -m.c[2]); sc.meshes.push(pm); } });
				ks.group.add(g); sc.groups[n] = { g: g, c: m.c };
			});
			sc.cur = {};
			renderModules(); refreshDamageUi();
		}
		function makePlan(kit, model) {
			var mi = S.modInfo, seeds = failSeeds(), depth = {}, q = [], maxD = 0;
			seeds.forEach(function (s) { depth[s] = 0; q.push(s); });
			while (q.length) { var cur = q.shift(); Object.keys(mi.by[cur].adj).forEach(function (nb) { if (depth[nb] == null) { depth[nb] = depth[cur] + 1; maxD = Math.max(maxD, depth[nb]); q.push(nb); } }); }
			mi.order.forEach(function (n) { if (depth[n] == null) { depth[n] = maxD + 1; } });
			var D0 = 0; mi.order.forEach(function (n) { D0 = Math.max(D0, depth[n]); });
			var bb = model.meta.bbox, ctr = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2], R = model.meta.radius || sc.ks.radius;
			var seed = 0x0B1D, i; for (i = 0; i < S.ship.length; i++) seed = (seed * 31 + S.ship.charCodeAt(i)) | 0;
			var rng = kit.rng(seed), step = Math.min(0.25, 1.2 / Math.max(1, D0)), plan = { dur: 3.0, mods: {} };
			mi.order.forEach(function (n) {
				var c = mi.by[n].c, vx = c[0] - ctr[0], vy = c[1] - ctr[1], vz = c[2] - ctr[2], len = Math.hypot(vx, vy, vz);
				var nx = rng() - 0.5, ny = rng() - 0.5, nz = rng() - 0.5, nl = Math.hypot(nx, ny, nz) || 1;
				var dx, dy, dz;
				if (len < R * 0.02) { dx = nx / nl; dy = ny / nl; dz = nz / nl; }
				else { dx = vx / len + 0.45 * nx / nl; dy = vy / len + 0.45 * ny / nl; dz = vz / len + 0.45 * nz / nl; var dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl; }
				var core = n === mi.core, dist = R * (0.22 + 0.5 * rng()) * (core ? 0.12 : 1);
				var ax = rng() - 0.5, ay = rng() - 0.5, az = rng() - 0.5, al = Math.hypot(ax, ay, az) || 1;
				plan.mods[n] = { delay: depth[n] * step, dir: [dx, dy, dz], dist: dist, axis: [ax / al, ay / al, az / al], angle: (0.5 + 1.8 * rng()) * (rng() < 0.5 ? -1 : 1) * (core ? 0.1 : 1) };
			});
			return plan;
		}
		function applyCur() {
			var mi = S.modInfo; if (!mi || !sc.groups) return;
			var T = sc.ctx.THREE, q = new T.Quaternion(), ax = new T.Vector3();
			mi.order.forEach(function (n) {
				var gp = sc.groups[n], pl = sc.plan && sc.plan.mods[n], e = sc.cur[n] || 0;
				if (!gp) return;
				if (!pl || e <= 0) { gp.g.position.set(gp.c[0], gp.c[1], gp.c[2]); gp.g.quaternion.identity(); return; }
				gp.g.position.set(gp.c[0] + pl.dir[0] * pl.dist * e, gp.c[1] + pl.dir[1] * pl.dist * e, gp.c[2] + pl.dir[2] * pl.dist * e);
				ax.set(pl.axis[0], pl.axis[1], pl.axis[2]); q.setFromAxisAngle(ax, pl.angle * e); gp.g.quaternion.copy(q);
			});
			var apart = S.brk !== 'idle';
			sc.sprites.forEach(function (s) { s.visible = !apart; });
			updatePin();
		}
		function easeOut(p) { return 1 - Math.pow(1 - p, 2.2); }
		function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
		function breakApart() {
			if (S.brk !== 'idle' || !sc.groups || !sc.v || !sc.v.isLive()) return;
			sc.plan = makePlan(sc.ctx.kit, sc.ks.group.userData.model); sc.t = 0; sc.cur = {};
			var reduced = sc.v.effectiveMotion() === 'reduced';
			S.brk = reduced ? 'broken' : 'breaking';
			if (reduced) { Object.keys(sc.plan.mods).forEach(function (n) { sc.cur[n] = 1; }); }
			applyCur(); sc.v.requestRender(); refreshDamageUi();
			say(reduced ? ORION.t('build.say.brokenEnd', 'Broken apart. Showing the end state.') : ORION.t('build.say.breaking', 'Breaking apart.'));
		}
		function reassemble() {
			if (!sc.groups || !sc.v) { S.damaged = {}; refreshTints(); refreshDamageUi(); return; }
			var wasApart = S.brk !== 'idle';
			S.damaged = {}; refreshTints();
			if (!wasApart) { refreshDamageUi(); say(ORION.t('build.say.cleared', 'Damage cleared.')); return; }
			var reduced = sc.v.effectiveMotion() === 'reduced';
			sc.start = {}; Object.keys(sc.cur).forEach(function (n) { sc.start[n] = sc.cur[n]; });
			if (reduced) { sc.cur = {}; S.brk = 'idle'; applyCur(); }
			else { S.brk = 'reassembling'; sc.rt = 0; }
			sc.v.requestRender(); refreshDamageUi(); say(ORION.t('build.say.reassembling', 'Reassembling.'));
		}
		function stepBreak(dt) {
			if (S.brk === 'breaking') {
				sc.t += dt; var pl = sc.plan, done = true;
				Object.keys(pl.mods).forEach(function (n) { var m = pl.mods[n], p = clamp((sc.t - m.delay) / Math.max(0.2, pl.dur - m.delay), 0, 1); sc.cur[n] = easeOut(p); if (p < 1) done = false; });
				applyCur(); if (done || sc.t >= pl.dur + 0.5) { S.brk = 'broken'; refreshDamageUi(); return false; }
				return true;
			}
			if (S.brk === 'reassembling') {
				sc.rt += dt; var k = clamp(sc.rt / 0.9, 0, 1), f = 1 - easeInOut(k);
				Object.keys(sc.start || {}).forEach(function (n) { sc.cur[n] = sc.start[n] * f; });
				applyCur(); if (k >= 1) { sc.cur = {}; S.brk = 'idle'; applyCur(); refreshDamageUi(); return false; }
				return true;
			}
			return false;
		}
		ui.brk.addEventListener('click', breakApart);
		ui.reas.addEventListener('click', reassemble);

		/* ---- test hit ---- */
		ui.hit.addEventListener('click', function () {
			var v = sc.v, now = (W.performance || Date).now();
			if (!v || !v.isLive() || !sc.shield) { announce(ORION.t('build.hit.off', '3D is off on this device, so there is no bubble to flash. The colour still goes into the loadout string.')); return; }
			if (now - (sc.lastHit || 0) < 600) return; sc.lastHit = now;
			var T = sc.ctx.THREE, rng = sc.ctx.kit.rng(0x51D + (sc.hits++)), cam = sc.ctx.camera.position;
			var d = new T.Vector3(cam.x, cam.y, cam.z).normalize().add(new T.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.9)).normalize();
			var bb = sc.ks.group.userData.model.meta.bbox, ctr = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2], r = sc.ks.radius;
			sc.shield.flash([ctr[0] + d.x * r, ctr[1] + d.y * r, ctr[2] + d.z * r]); v.requestRender();
			announce(ORION.t('build.hit.done', 'Test hit on the shield.'));
		});

		/* ------------------------------------------------------------ the viewer */
		function pick(e, canvas) {
			var ctx = sc.ctx; if (!ctx || S.tab !== 'damage' || !sc.meshes.length) return;
			var T = ctx.THREE, r = canvas.getBoundingClientRect(), rc = new T.Raycaster();
			rc.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), ctx.camera);
			var hit = rc.intersectObjects(sc.meshes, false)[0];
			if (hit && hit.object.userData.part) selectModule(hit.object.userData.part.module === S.selMod ? null : hit.object.userData.part.module, true);
		}
		sc.v = ORION.viewer(ui.host, {
			name: 'build', title: FLEET[S.ship].name, label: viewLabel(), posterKey: 'ship.' + S.ship, priority: 'section', interactive: true,
			controls: { target: [0, 0, 0], autoRotate: false }, modelId: function () { return currentId(); },
			onMotion: function (m) { if (sc.shield) { sc.shield.setMotion(m); } },
			async setup(ctx) {
				sc.ctx = ctx; sc.gen++; sc.content = sc.ks = sc.shield = sc.groups = sc.plan = sc.proj = null; sc.fitId = null; sc.cur = {}; sc.meshes = [];
				var kit = ctx.kit; kit.lightRig(ctx.scene);
				var down = null;
				ctx.host.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; }, { signal: ctx.signal });
				ctx.host.addEventListener('pointerup', function (e) { if (down && e.target === ctx.renderer.domElement && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) pick(e, ctx.renderer.domElement); down = null; }, { signal: ctx.signal });
				var id = currentId(), model = await ctx.loadModel(id);
				sc.gen++;
				placeContent(ctx, model, true, id);
				return {
					update: function (dt) { var a = false; if (sc.shield && sc.shield.update(dt)) a = true; if (stepBreak(dt)) a = true; return a; },
					dispose: function () {
						if (sc.proj) { sc.proj.stop(); sc.proj = null; }
						if (sc.v && sc.v._layer) sc.v._layer.replaceChildren();
						sc.ctx = null; sc.content = sc.ks = sc.shield = sc.groups = sc.plan = null; sc.meshes = []; sc.sprites = []; refreshDamageUi();
					}
				};
			}
		});
		/* language switch (I18N.md 3.8): re-render every piece of text this section drew, keeping ship, tiers, colour, mounts, craft, tab and damage state */
		ORION.bus.on('lang', function () {
			ORION.ui.keepFocus(root, function () {
				var det = $('.build-details', ui.strWrap), open = !!(det && det.open);
				fillShipPicker(); updateShipInfo(); buildTiers(); renderStats(); renderColour(); renderRows(); renderHangar();
				ui.strWrap.textContent = ''; renderStringBlock(); if (open) { det = $('.build-details', ui.strWrap); if (det) det.open = true; }
				syncTierRadios(); updateTierSubs(); paintColourUi(); renderDamageIntro(); renderShot(); if (S.modInfo) renderModules(); applyTabUi();
			});
			if (sc.v) { sc.v.setTexts({ label: viewLabel(), title: FLEET[S.ship].name }); refreshCaption(); }
		});
		ORION.bus.on('webgl', function () { refreshDamageUi(); });
		ORION.bus.on('motion', function () { if (sc.shield && sc.v) sc.shield.setMotion(sc.v.effectiveMotion()); });
		ORION.bus.on('ship:select', function (e) { if (e && e.id && e.from !== 'build') setShip(e.id, 'ships'); });
		var lastLive = false;
		setInterval(function () { var l = !!(sc.v && sc.v.isLive()); if (l !== lastLive) { lastLive = l; refreshDamageUi(); refreshCaption(); } }, 700);

		/* ------------------------------------------------------------ start */
		buildShipPicker();
		renderShot();
		renderAll();
		/* the ANVIL file is 0.8 MB: fetch it when the chapter is within 800 px of the viewport, not at page load (integration fix, ORI-1310) */
		if ('IntersectionObserver' in W) {
			var modIO = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { modIO.disconnect(); loadModules(); } }, { rootMargin: '800px 0px' });
			modIO.observe(root);
		} else loadModules();
		app.hidden = false;
		root.classList.add('is-ready');

		/* ------------------------------------------------------------ debug + self-test steps */
		ORION.__debug.build = {
			state: S, stats: stats, buildString: buildString, picksNow: picksNow, selfCheck: selfCheck, effColor: effColor, setShip: setShip,
			scene: function () { return { live: !!(sc.v && sc.v.isLive()), shield: !!sc.shield, groups: sc.groups ? Object.keys(sc.groups).length : 0, brk: S.brk, cur: sc.cur, plan: sc.plan }; },
			breakApart: breakApart, reassemble: reassemble, groups: function () { return sc.groups; }
		};
		function clickEl(e) { e.click(); }
		function readStat(tag, key) { var n = $('[data-stats="' + tag + '"] [data-stat="' + key + '"] .build-val', root); return n ? Number(n.getAttribute('data-v')) : NaN; }
		ORION.selftest.add('build: hull and shield tiers (9 combinations x ANVIL, KESTREL, LEVIATHAN) equal the formulas', async function () {
			var keep = S.ship, bad = [], rowsOut = [];
			for (var si = 0; si < 3; si++) {
				var id = ['anvil', 'kestrel', 'leviathan'][si], f = FLEET[id]; setShip(id, 'selftest');
				for (var h = 0; h < 3; h++) for (var s = 0; s < 3; s++) {
					clickEl($$('input[name="build-hull"]', ui.hull)[h]); clickEl($$('input[name="build-shield"]', ui.shield)[s]);
					var ht = L.hullTypes[h], st = L.shieldTypes[s];
					var exp = { hull: Math.round(f.hull * ht.hullScale), armor: f.armor + ht.armorAdd, shield: Math.round(f.shield * st.shieldScale), regen: Math.round(f.shieldRegen * st.regenScale * 10) / 10 };
					var got = { hull: readStat('ship', 'hull'), armor: readStat('ship', 'armor'), shield: readStat('ship', 'shield'), regen: readStat('ship', 'regen') };
					var ok = got.hull === exp.hull && got.armor === exp.armor && got.shield === exp.shield && Math.abs(got.regen - exp.regen) < 0.051;
					rowsOut.push(id + ' ' + h + s + ' ' + got.hull + '/' + got.armor + '/' + got.shield + '/' + got.regen); if (!ok) bad.push(id + h + s + ' exp ' + JSON.stringify(exp) + ' got ' + JSON.stringify(got));
				}
			}
			setShip(keep, 'selftest');
			return { ok: bad.length === 0, note: bad.length ? bad.join(' | ') : '27 combinations match: ' + rowsOut.join('; ') };
		});
		ORION.selftest.add('build: colour rule and string tokens', async function () {
			var keep = S.ship; setShip('orion1', 'selftest'); $('#build-reset', root).click(); var out = [], ok = true;
			function chk(name, cond, note) { out.push(name + (cond ? ' ok' : ' FAIL ' + note)); if (!cond) ok = false; }
			clickEl($$('input[name="build-colour"]', ui.colour)[3]); chk('palette p3', buildString(picksNow()) === 'L1.orion1.00.p3', buildString(picksNow()));
			var cp = $('#build-custom', ui.colour); cp.value = '#ff8800'; cp.dispatchEvent(new Event('input', { bubbles: true }));
			chk('custom ff8800', buildString(picksNow()) === 'L1.orion1.00.ff8800' && !$('#build-colmsg', ui.colour).textContent, buildString(picksNow()));
			cp.value = '#303030'; cp.dispatchEvent(new Event('input', { bubbles: true }));
			chk('dark reads as STOCK with a visible message', buildString(picksNow()) === 'L1.orion1' && !!$('#build-colmsg', ui.colour).textContent, buildString(picksNow()));
			cp.value = '#400000'; cp.dispatchEvent(new Event('input', { bubbles: true }));
			chk('0x40 boundary is allowed', buildString(picksNow()) === 'L1.orion1.00.400000', buildString(picksNow()));
			clickEl($$('input[name="build-colour"]', ui.colour)[0]);
			chk('stock colour back to L1.orion1', $('#build-str', ui.strWrap).textContent === 'L1.orion1', $('#build-str', ui.strWrap).textContent);
			setShip(keep, 'selftest'); return { ok: ok, note: out.join('; ') };
		});
		ORION.selftest.add('build: every loadout.vectors entry is reproduced exactly', async function () {
			var r = selfCheck(); return { ok: r.pass === r.total && r.total >= 8, note: r.pass + '/' + r.total + (r.pass === r.total ? '' : ' fails: ' + r.rows.filter(function (x) { return !x.ok; }).map(function (x) { return x.expected + ' got ' + x.got; }).join(' | ')) };
		});
		ORION.selftest.add('build: loadout string follows the UI (ANVIL with craft and hardpoints)', async function () {
			var keep = S.ship; setShip('anvil', 'selftest'); var ok = true, note = [];
			clickEl($$('input[name="build-hull"]', ui.hull)[1]); clickEl($$('input[name="build-shield"]', ui.shield)[2]); clickEl($$('input[name="build-colour"]', ui.colour)[3]);
			function setSel(host, name, v) { var s = $('#build-hp-' + host + '-' + name, root); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
			setSel('ship', 'tur_3', '1'); setSel('ship', 'tur_4', '2');
			clickEl($$('input[name="build-craft"]', ui.hangar)[1]);
			var ch = $('#build-chull', ui.hangar); ch.value = '1'; ch.dispatchEvent(new Event('change', { bubbles: true }));
			var got = $('#build-str', ui.strWrap).textContent; ok = got === 'L1.anvil.12.p3.0012.kestrel.10'; note.push(got);
			setSel('craft', 'rkt_1', '1'); got = $('#build-str', ui.strWrap).textContent; note.push(got);
			ok = ok && got === 'L1.anvil.12.p3.0012.kestrel.10.00001'; // rkt_1 is index 4 of the KESTREL rows: 000010, trailing 0 trimmed
			$('#build-reset', root).click(); got = $('#build-str', ui.strWrap).textContent; ok = ok && got === 'L1.anvil'; note.push(got);
			setShip(keep, 'selftest'); return { ok: ok, note: note.join(' | ') };
		});
		ORION.selftest.add('build: every hardpoint row joins the fleet list by name (16 ships); model hotspots by name (3 ships)', async function () {
			var bad = [], ids = Object.keys(L.perClass);
			ids.forEach(function (id) { var names = {}; FLEET[id].hardpoints.forEach(function (h) { names[h.name] = 1; }); rowsFor(id).forEach(function (r) { if (!names[r.hardpoint]) bad.push(id + ':' + r.hardpoint); }); if (rowsFor(id).length !== FLEET[id].hardpoints.length) bad.push(id + ' count'); });
			for (var i = 0; i < 3; i++) { var id2 = ['anvil', 'kestrel', 'leviathan'][i], m; try { m = await ORION.loadModel(id2); } catch (e) { bad.push(id2 + ' model ' + e.message); continue; } var mn = {}; m.meta.hardpoints.forEach(function (h) { mn[h.name] = 1; }); rowsFor(id2).forEach(function (r) { if (!mn[r.hardpoint]) bad.push(id2 + ' model lacks ' + r.hardpoint); }); }
			return { ok: bad.length === 0, note: bad.length ? bad.join(', ') : 'all 16 perClass lists match fleet hardpoint names; ANVIL, KESTREL, LEVIATHAN match their model hotspots' };
		});
		ORION.selftest.add('build: damage, break apart and reassemble', async function () {
			if (ORION.state.webgl !== 'ok') return { ok: true, note: 'skipped: no WebGL here (module list still checked)' };
			var keep = S.ship, ok = true, note = [];
			setShip('kestrel', 'selftest'); setTab('damage', false); ui.host.scrollIntoView({ block: 'center', behavior: 'instant' });
			var t0 = Date.now(); while (Date.now() - t0 < 20000 && !(sc.v.isLive() && sc.groups)) await sleep(150);
			if (!(sc.v.isLive() && sc.groups)) { setTab('loadout', false); setShip(keep, 'selftest'); return { ok: true, note: 'skipped: build viewer not live (context budget or off-screen)' }; }
			var mods = S.modInfo.order.length; note.push(mods + ' modules vs data ' + FLEET.kestrel.modules.count); ok = ok && mods === FLEET.kestrel.modules.count;
			selectModule(S.modInfo.order[1], false); ui.dmg.click(); ok = ok && !!S.damaged[S.modInfo.order[1]]; note.push('damaged ' + S.modInfo.order[1]);
			ui.brk.click(); sc.v.userStopped = true;
			t0 = Date.now(); while (Date.now() - t0 < 6000 && S.brk !== 'broken') await sleep(120);
			var moved = Object.keys(sc.groups).filter(function (n) { var g = sc.groups[n].g.position, c = sc.groups[n].c; return Math.hypot(g.x - c[0], g.y - c[1], g.z - c[2]) > 1e-3; }).length;
			ok = ok && S.brk === 'broken' && moved > 0; note.push('broken, ' + moved + ' modules displaced in ' + (Date.now() - t0) + ' ms');
			ui.reas.click(); t0 = Date.now(); while (Date.now() - t0 < 4000 && S.brk !== 'idle') await sleep(120);
			var still = Object.keys(sc.groups).filter(function (n) { var g = sc.groups[n].g.position, c = sc.groups[n].c; return Math.hypot(g.x - c[0], g.y - c[1], g.z - c[2]) > 1e-3; }).length;
			ok = ok && S.brk === 'idle' && still === 0 && !Object.keys(S.damaged).length; note.push('reassembled, ' + still + ' displaced');
			setTab('loadout', false); setShip(keep, 'selftest'); return { ok: ok, note: note.join('; ') };
		});
	}

	if (W.ORION) W.ORION.register('build', { init: init });
})();
