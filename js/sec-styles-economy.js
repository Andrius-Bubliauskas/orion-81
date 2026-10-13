/* orion-81.io mock: js/sec-styles-economy.js (ORI-1309). Classic script, no imports, no fetch. Registers 'styles-economy' once; init handles both
   chapters: #styles (class tabs, one shared 3D vignette viewer, compare bars, colossal FUTURE card) and #economy (PLANNED diagram highlight).
   The static HTML in partials/80-styles.html and 85-economy.html is complete without JS; this file only enhances it. All numbers come from ORION_DATA. */
(function () {
	'use strict';
	var W = window, D = document, O = W.ORION;
	if (!O) return;
	var $ = function (s, r) { return (r || D).querySelector(s); };
	var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
	var DATA = W.ORION_DATA || { classes: [], fleet: [], economy: {} };
	var CLASSES = DATA.classes || [];
	var CLS = {}; CLASSES.forEach(function (c) { CLS[c.id] = c; });
	var FLEET = {}; (DATA.fleet || []).forEach(function (f) { FLEET[f.id] = f; });
	var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

	/* per-class viewer facts: model ids shown, poster key, label, short scene description */
	var SCENE = {
		small: { poster: 'poster.styles.small', models: ['kestrel', 'needle'], names: ['KESTREL', 'NEEDLE'] },
		medium: { poster: 'poster.styles.medium', models: ['anvil', 'needle'], names: ['ANVIL', 'NEEDLE'] },
		large: { poster: 'poster.styles.large', models: ['ironclad'], names: ['IRONCLAD'] }
	};
	function sceneNames(cls) { var n = SCENE[cls].names; return n.length === 2 ? O.t('ships.namesAnd', '{a} and {b}', { a: n[0], b: n[1] }) : n[0]; }
	function sceneLabel(cls) {
		if (cls === 'small') return O.t('styles.scene.smallLabel', '3D scene: a KESTREL and a NEEDLE fighter in a turning fight, with laser fire. Scripted illustration, rotatable.');
		if (cls === 'medium') return O.t('styles.scene.mediumLabel', '3D scene: the ANVIL destroyer with its NEEDLE wing leaving the hangar bay. Scripted illustration, rotatable.');
		return O.t('styles.scene.largeLabel', '3D scene: the IRONCLAD dreadnought with turret tracer fire and point defence shooting down incoming rockets. Scripted illustration, rotatable.');
	}
	function sceneWhat(cls) {
		if (cls === 'small') return O.t('styles.scene.smallWhat', 'The chase, the banking and the laser fire are a scripted illustration made for this site, not game footage.');
		if (cls === 'medium') return O.t('styles.scene.mediumWhat', 'The launch sequence is a scripted illustration made for this site, not game footage; the bay positions come from the ANVIL model.');
		return O.t('styles.scene.largeWhat', 'The tracers, incoming rockets and point-defence fire are a scripted illustration made for this site, not game footage; the turret positions come from the IRONCLAD model.');
	}

	/* ====================================================================== 3D vignettes ====================================================================== */
	function disposeObj(o) {
		o.traverse(function (n) {
			if (n.geometry) n.geometry.dispose();
			var ms = n.material ? [].concat(n.material) : [];
			ms.forEach(function (m) { for (var k in m) { var t = m[k]; if (t && t.isTexture && !(t.userData && t.userData.keep)) t.dispose(); } m.dispose(); });
		});
	}
	function pool(ctx, root, n, color, size) {
		var T = ctx.THREE, tpl = ctx.kit.glowSprite(color, size, 1), out = [tpl], i;
		for (i = 1; i < n; i++) { var s = new T.Sprite(tpl.material); s.scale.set(size, size, 1); out.push(s); }
		out.forEach(function (s) { s.visible = false; root.add(s); });
		return out;
	}
	function streaks(ctx, root, n, color) {
		var T = ctx.THREE, g = new T.BufferGeometry(), pos = new Float32Array(n * 6);
		g.setAttribute('position', new T.BufferAttribute(pos, 3));
		var l = new T.LineSegments(g, new T.LineBasicMaterial({ color: color, transparent: true, opacity: 0.9, toneMapped: false })); l.frustumCulled = false; root.add(l);
		return {
			set: function (i, p, d, len) { pos[i * 6] = p.x - d.x * len; pos[i * 6 + 1] = p.y - d.y * len; pos[i * 6 + 2] = p.z - d.z * len; pos[i * 6 + 3] = p.x; pos[i * 6 + 4] = p.y; pos[i * 6 + 5] = p.z; },
			hide: function (i) { pos.fill(0, i * 6, i * 6 + 6); }, flush: function () { g.attributes.position.needsUpdate = true; }
		};
	}
	function hpOrigin(model, name, fallback) {
		var h = (model.meta.hardpoints || []).filter(function (x) { return x.name === name; })[0];
		return h ? { o: h.origin, a: h.axis } : { o: fallback, a: [0, 0, 1] };
	}
	function fixedLaserNames(id) {
		var f = FLEET[id], out = [];
		(f && f.hardpoints || []).forEach(function (h) { if (h.kind === 'fixed' && h.siteFamily === 'laser') out.push(h.name); });
		return out;
	}
	function boltSpeed(id) { var f = FLEET[id], v = f && f.lasers && f.lasers.boltSpeedMs; return Math.min(v || 400, 500); }

	/* ---- small: two fighters in a turning fight (a pure function of time, so a still frame is just one value of t) ---- */
	async function buildSmall(ctx) {
		var T = ctx.THREE, kit = ctx.kit, root = new T.Group();
		var mods = await Promise.all([ctx.loadModel('kestrel'), ctx.loadModel('needle')]);
		var A = kit.ship(mods[0], {}), B = kit.ship(mods[1], { livery: '#8cc8ff' });
		root.add(A.group, B.group);
		var RA = 40, RB = 34, OM = 1.45, LAG = 0.8, BURST = 0.35;
		function P(tau, R, out) { var th = OM * tau; return out.set(R * Math.cos(th), 11 * Math.sin(0.7 * th + 0.6), R * Math.sin(th)); }
		var pa = new T.Vector3(), pn = new T.Vector3(), tmp = new T.Object3D(), tgt = new T.Vector3(), mz = new T.Vector3(), dir = new T.Vector3();
		function place(obj, tau, R) { P(tau, R, pa); P(tau + 0.05, R, pn); obj.position.copy(pa); obj.lookAt(pn); obj.rotateZ(0.8); }
		var names = fixedLaserNames('needle'), hp = names.slice(0, 2).map(function (n, i) { return hpOrigin(mods[1], n, [i ? -1.3 : 1.3, 0, 8]).o; });
		if (hp.length < 2) hp = [[1.3, 0, 8], [-1.3, 0, 8]];
		var bolts = pool(ctx, root, 6, 0xff7a45, 4.5), sk = streaks(ctx, root, 6, 0xff7a45), SP = boltSpeed('needle'), LIFE = 110 / SP;
		function pose(t) {
			place(A.group, t, RA); place(B.group, t - LAG, RB);
			var base = Math.floor(t / BURST), q, k, i = 0;
			for (q = 0; q < 3; q++) {
				var m = base - q, tf = m * BURST, age = t - tf, on = age >= 0 && age <= LIFE && (((m % 6) + 6) % 6) < 4;
				if (on) { place(tmp, tf - LAG, RB); tmp.updateMatrixWorld(true); P(tf + 0.25, RA, tgt); }
				for (k = 0; k < 2; k++, i++) {
					var s = bolts[i]; s.visible = on; if (!on) { sk.hide(i); continue; }
					mz.set(hp[k][0], hp[k][1], hp[k][2]); tmp.localToWorld(mz);
					dir.copy(tgt).sub(mz).normalize(); s.position.copy(mz).addScaledVector(dir, SP * age); sk.set(i, s.position, dir, 9);
				}
			}
			sk.flush();
		}
		return { root: root, pose: pose, still: 2.4, radius: 36, target: [0, 2, 0], dir: [0.12, 0.34, 0.93], stars: 400 };
	}

	/* ---- medium: an ANVIL with its NEEDLEs leaving the bay ---- */
	async function buildMedium(ctx) {
		var T = ctx.THREE, kit = ctx.kit, root = new T.Group();
		var mods = await Promise.all([ctx.loadModel('anvil'), ctx.loadModel('needle')]);
		var anvil = kit.ship(mods[0], {}); root.add(anvil.group);
		var needle = kit.ship(mods[1], { livery: '#8cc8ff' });
		var bay = mods[0].meta.bay, cr = (bay && bay.cradles) || [], N = Math.min(10, cr.length || 10), V0 = (bay && bay.exitSpeed) || 60;
		var crafts = [], i;
		for (i = 0; i < N; i++) {
			var g = i === 0 ? needle.group : needle.group.clone(true);
			g.visible = false; root.add(g);
			var c = cr[i] || { origin: [(i % 2 ? -12.8 : 12.8), -2.4, -49.6 + 12.8 * Math.floor(i / 2)], dir: [i % 2 ? -1 : 1, 0, 0] };
			crafts.push({ g: g, o: c.origin, d: c.dir });
		}
		var TC = 18, GAP = 1.0, AFT = 25, TF = 3, v = new T.Vector3(), p = new T.Vector3(), look = new T.Vector3();
		function pose(t) {
			crafts.forEach(function (c, k) {
				var u = (((t - k * GAP) % TC) + TC) % TC;
				if (u > 15) { c.g.visible = false; return; }
				var lat = V0 * 1.2 * (1 - Math.exp(-u / 1.2)), lv = V0 * Math.exp(-u / 1.2);
				var fz = u < TF ? 0.5 * (AFT / TF) * u * u : 0.5 * AFT * TF + AFT * (u - TF), fv = u < TF ? (AFT / TF) * u : AFT;
				p.set(c.o[0] + c.d[0] * lat, c.o[1], c.o[2] + fz);
				v.set(c.d[0] * lv, 0, fv + 0.001);
				c.g.visible = true; c.g.position.copy(p); look.copy(p).add(v); c.g.lookAt(look);
				var sc = u > 13.8 ? Math.max(0.001, (15 - u) / 1.2) : 1; c.g.scale.setScalar(sc);
			});
		}
		return { root: root, pose: pose, still: 8, radius: 190, target: [0, 0, 70], dir: [0.82, 0.5, -0.58], stars: 1200 };
	}

	/* ---- large: turret tracer sprites, point defence and incoming rockets around a dreadnought ---- */
	async function buildLarge(ctx) {
		var T = ctx.THREE, kit = ctx.kit, root = new T.Group();
		var model = await ctx.loadModel('ironclad'), ship = kit.ship(model, {}); root.add(ship.group);
		var f = FLEET.ironclad, hps = (f && f.hardpoints) || [], ax = new T.Vector3();
		function mk(h) { var g = hpOrigin(model, h.name, [0, 0, 0]); return { o: new T.Vector3(g.o[0], g.o[1], g.o[2]), a: new T.Vector3(g.a[0], g.a[1], g.a[2]).normalize() }; }
		var tur = hps.filter(function (h) { return h.kind === 'turret'; }).map(mk), pds = hps.filter(function (h) { return h.kind === 'pd'; }).map(mk);
		var tb = pool(ctx, root, Math.max(2, tur.length * 2), 0xff8a5c, 70), pb = pool(ctx, root, 12, 0xcfe8ff, 45), tsk = streaks(ctx, root, tb.length, 0xff8a5c), psk = streaks(ctx, root, 12, 0xcfe8ff);
		var rk = pool(ctx, root, 4, 0xffb347, 100), fl = [], j, k;
		for (j = 0; j < 4; j++) { var s = kit.glowSprite(0xffffff, 90, 1); s.visible = false; root.add(s); fl.push(s); }
		var RDIR = [[0.62, 0.25, 0.74], [-0.72, 0.2, 0.66], [0.78, 0.42, -0.46], [-0.4, 0.55, 0.74]].map(function (a) { return new T.Vector3(a[0], a[1], a[2]).normalize(); });
		var RS = 1500, RI = 640, SPD = 220, CYC = 7, TT = (RS - RI) / SPD;
		var pdOf = RDIR.map(function (d) { var best = -2, bi = 0; pds.forEach(function (h, i) { var q = h.a.dot(d); if (q > best) { best = q; bi = i; } }); return bi; });
		var HR = 1800, TS = 1400, TL = 0.55, tmpD = new T.Vector3(), tmpP = new T.Vector3(), aim = new T.Vector3();
		function tpos(j, t, out) { var a = 0.1 * t + j * 2.1; return out.set(HR * Math.cos(a), 620 * Math.sin(a * 1.3 + j), HR * Math.sin(a)); }
		function pose(t) {
			var i = 0, q, h, jj;
			tur.forEach(function (th, ti) {
				for (q = 0; q < 2; q++, i++) {
					var m = Math.floor((t - ti * 0.37) / 0.8) - q, tf = m * 0.8 + ti * 0.37, age = t - tf, s = tb[i];
					var on = age >= 0 && age < TL && (((m + ti) % 4) + 4) % 4 < 3, best = 0.05, bd = null;
					if (on) {
						for (jj = 0; jj < 3; jj++) { tpos(jj, tf, tmpP); tmpD.copy(tmpP).sub(th.o).normalize(); var dd = th.a.dot(tmpD); if (dd > best) { best = dd; bd = jj; } }
						if (bd == null) on = false; else { tpos(bd, tf, tmpP); tmpD.copy(tmpP).sub(th.o).normalize(); }
					}
					s.visible = on; if (on) { s.position.copy(th.o).addScaledVector(tmpD, TS * age + 6); tsk.set(i, s.position, tmpD, 150); } else tsk.hide(i);
				}
			});
			for (; i < tb.length; i++) { tb[i].visible = false; tsk.hide(i); }
			var pi = 0;
			for (j = 0; j < 4; j++) {
				var u = (((t - j * 1.4) % CYC) + CYC) % CYC, d = RDIR[j], r = rk[j], f2 = fl[j], alive = u < TT;
				r.visible = alive; if (alive) r.position.copy(d).multiplyScalar(RS - SPD * u);
				var fa = u - TT; f2.visible = fa >= 0 && fa < 0.35;
				if (f2.visible) { f2.position.copy(d).multiplyScalar(RI); var kk = fa / 0.35; f2.scale.set(120 + 280 * kk, 120 + 280 * kk, 1); f2.material.opacity = 1 - kk; }
				for (k = 0; k < 3; k++, pi++) {
					var ps = pb[pi], tfi = Math.floor((u - k * 0.1) / 0.1) * 0.1, ag = u - tfi, ok = tfi >= 1.2 && tfi < TT - 0.1 && ag >= 0 && ag < 0.26;
					ps.visible = ok; if (!ok) { psk.hide(pi); continue; }
					h = pds[pdOf[j]]; if (!h) { ps.visible = false; psk.hide(pi); continue; }
					aim.copy(d).multiplyScalar(RS - SPD * (tfi + 0.2)); tmpD.copy(aim).sub(h.o).normalize(); ps.position.copy(h.o).addScaledVector(tmpD, 1800 * ag + 4); psk.set(pi, ps.position, tmpD, 90);
				}
			}
			tsk.flush(); psk.flush();
		}
		return { root: root, pose: pose, still: 3.0, radius: 600, target: [0, 0, 0], dir: [0.8, 0.35, 0.6], stars: 1500 };
	}
	var BUILD = { small: buildSmall, medium: buildMedium, large: buildLarge };

	/* ====================================================================== section state ====================================================================== */
	var st = { cls: 'small', viewer: null, sceneApi: null, chapter: null, measure: 'turnDegS' };

	function lowerFirst(c) { return O.i18n.lang === 'en' ? c.charAt(0).toLowerCase() + c.slice(1) : c; }
	function liveCaption(cls) {
		var sc = SCENE[cls], groups = {}, order = [];
		sc.models.forEach(function (id) { var c = O.ui.modelCaption(id) || O.t('styles.modelFallback', 'Real in-game model from version 0.6.1, converted for the web'); if (!groups[c]) { groups[c] = []; order.push(c); } groups[c].push(id.toUpperCase().replace('ORION1', 'ORION-1')); });
		var parts = order.map(function (c) { var g = groups[c]; return O.t('styles.livePart', '{names}: {caption}', { names: g.length === 2 ? O.t('ships.namesAnd', '{a} and {b}', { a: g[0], b: g[1] }) : g.join(', '), caption: lowerFirst(c) }); });
		return O.t('styles.live', 'Live 3D scene. {parts}. {what}', { parts: parts.join('; '), what: sceneWhat(cls) });
	}
	function staticCaption(cls) { var m = O.media(SCENE[cls].poster); return m && m.caption ? O.t('styles.still', 'Still image. {caption}.', { caption: m.caption }) : O.t('styles.stillFallback', 'Still image. An in-game capture.'); }
	function applyViewerText(cls) {
		var sc = SCENE[cls], v = st.viewer; if (!sc) return;
		var cl = $('#styles-caption-live'), cs = $('#styles-caption-static');
		if (cl) cl.textContent = liveCaption(cls); if (cs) cs.textContent = staticCaption(cls);
		if (v) { v.setPoster(sc.poster); v.setLabel(sceneLabel(cls)); var pm = O.media(sc.poster); if (v.posterEl && pm && pm.alt) v.posterEl.alt = pm.alt; }
	}

	function makeViewer() {
		var host = $('#styles-viewer'); if (!host || !O.viewer) return;
		var sc = SCENE.small;
		st.viewer = O.viewer(host, {
			name: 'styles', priority: 'section', label: sceneLabel('small'), groupLabel: O.t('styles.viewerGroup', 'Scripted 3D scene for the selected size class. Drag to orbit.'), posterKey: sc.poster, interactive: true,
			controls: { autoRotate: false, minDistance: 5, maxDistance: 8000 },
			async setup(ctx) {
				var T = ctx.THREE, kit = ctx.kit, seq = 0, cur = null, built = {}, clock = 0, shown = null, stars = null;
				kit.lightRig(ctx.scene, { intensity: 1 });
				function ensure(cls) {
					if (!built[cls]) { built[cls] = BUILD[cls](ctx).catch(function (e) { delete built[cls]; throw e; }); }
					return built[cls];
				}
				async function show(cls) {
					var my = ++seq, b = await ensure(cls);
					if (my !== seq || ctx.signal.aborted) return;
					if (cur) ctx.scene.remove(cur.root);
					if (stars) { ctx.scene.remove(stars); disposeObj(stars); }
					cur = b; shown = cls; ctx.scene.add(b.root);
					stars = kit.starfield({ count: 700, radius: b.radius * 40 }); ctx.scene.add(stars);
					var tg = new T.Vector3(b.target[0], b.target[1], b.target[2]), dr = new T.Vector3(b.dir[0], b.dir[1], b.dir[2]).normalize();
					ctx.camera.position.copy(tg).addScaledVector(dr, 1);
					var asp = ctx.viewer.size.w / Math.max(1, ctx.viewer.size.h); /* scenes are framed for a wide view: widen the fit on square and portrait frames */
					kit.fit(ctx.camera, ctx.controls, b.radius * (asp < 1.55 ? Math.min(2, 1.55 / asp) : 1), tg); ctx.setHome();
					clock = b.still; b.pose(clock); ctx.requestRender();
				}
				await show(st.cls === 'colossal' ? 'small' : st.cls);
				while (st.cls !== 'colossal' && shown !== st.cls && !ctx.signal.aborted) await show(st.cls);
				var api = {
					show: show,
					seek: function (t) { clock = t; if (cur) cur.pose(clock); ctx.requestRender(); },
					update: function (dt) {
						if (!cur) return false;
						if (O.state.motion === 'reduced') { cur.pose(cur.still); return false; }
						if (ctx.viewer.motionPaused) return false;
						clock += dt; cur.pose(clock); return true;
					},
					dispose: function () {
						seq++; if (st.sceneApi === api) st.sceneApi = null;
						Object.keys(built).forEach(function (k) { built[k].then(function (b) { if (b.root.parent == null) disposeObj(b.root); }, function () { }); });
					}
				};
				st.sceneApi = api; O.__debug.stylesSeek = function (t) { if (st.sceneApi) st.sceneApi.seek(t); }; return api;
			}
		});
	}

	/* ====================================================================== tabs ====================================================================== */
	function select(cls, opts) {
		if (!CLS[cls]) return; opts = opts || {};
		var prev = st.cls; st.cls = cls;
		var tabs = $$('.styles-tabs [role="tab"]', st.chapter), panels = $$('.styles-panel', st.chapter);
		var future = cls === 'colossal', box = $('#styles-viewerbox'), fig = $('#styles-colossal');
		function dom() {
			tabs.forEach(function (t) { var on = t.dataset.class === cls; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
			panels.forEach(function (p) { p.classList.toggle('is-on', p.dataset.class === cls); });
			if (box) box.hidden = future; if (fig) fig.hidden = !future;
			renderBars();
		}
		dom();
		var v = st.viewer;
		if (future) { if (v && v.renderer) v.unmount('evicted'); }
		else if (v) {
			applyViewerText(cls);
			if (v.renderer && st.sceneApi) {
				st.sceneApi.show(cls).catch(function (e) { O.fallback && console.warn('[orion] styles scene failed', e); v.unmount('failed', 'model', true); });
			} else if (!v.renderer && v.state !== 'failed') v.rebuild();
		}
		if (opts.focus) { var t = $('#styles-tab-' + cls); if (t) t.focus(); }
		if (prev !== cls) {
			O.ui.announce(future ? O.t('styles.announceColossal', 'Colossal class selected. This class is a future idea and is not designed yet.') : O.t('styles.announceClass', '{label} ships, classes {from} to {to}. The 3D scene shows {names}.', { label: O.i18n.d(CLS[cls].label), from: CLS[cls].range[0], to: CLS[cls].range[1], names: sceneNames(cls) }));
			O.bus.emit('styles:class', cls);
		}
	}
	function wireTabs() {
		var list = $('.styles-tabs', st.chapter); if (!list) return;
		var ids = $$('[role="tab"]', list).map(function (t) { return t.dataset.class; });
		list.addEventListener('click', function (e) { var t = e.target.closest('[role="tab"]'); if (t) select(t.dataset.class, {}); });
		list.addEventListener('keydown', function (e) {
			var t = e.target.closest('[role="tab"]'); if (!t) return; var i = ids.indexOf(t.dataset.class), n = -1;
			if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % ids.length; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + ids.length - 1) % ids.length;
			else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = ids.length - 1;
			if (n >= 0) { e.preventDefault(); select(ids[n], { focus: true }); }
		});
		$$('.styles-ship', st.chapter).forEach(function (a) { a.addEventListener('click', function () { O.bus.emit('ship:select', { id: a.dataset.ship, from: 'styles' }); }); });
		labelShips();
	}
	function titleCase(r) { return O.i18n.lang === 'en' ? String(r).toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : String(r); }
	function labelShips() {
		$$('.styles-ship', st.chapter).forEach(function (a) {
			var f = FLEET[a.dataset.ship]; if (!f) return;
			a.setAttribute('aria-label', O.t('styles.shipLink', '{name}, {role}: open in the ships explorer', { name: f.name, role: titleCase(O.i18n.d(f.role)) }));
		});
	}

	/* ====================================================================== compare bars ====================================================================== */
	function measureLabel(k) {
		switch (k) {
			case 'turnDegS': return O.t('ships.spec.turn', 'Turn rate'); case 'cruiseMs': return O.t('ships.spec.cruise', 'Cruise speed'); case 'lengthM': return O.t('ships.spec.length', 'Length');
			case 'massT': return O.t('ships.spec.mass', 'Mass'); case 'hullShield': return O.t('styles.spec.hullShield', 'Hull + shield'); default: return O.t('styles.spec.dps', 'Damage per second');
		}
	}
	var MEASURES = [
		{ k: 'turnDegS', u: ' deg/s', log: false }, { k: 'cruiseMs', u: ' m/s', log: false }, { k: 'lengthM', u: ' m', log: true },
		{ k: 'massT', u: ' t', log: true }, { k: 'hullShield', u: '', log: true }, { k: 'dps', u: '', log: false }
	];
	function nfmt(v) { return v >= 1000 ? O.ui.fmt.num(v) : (v % 1 ? O.ui.fmt.num(Math.round(v * 10) / 10, 1).replace(/[.,]0$/, '') : String(v)); }
	function renderBars() {
		var ul = $('#styles-bars'); if (!ul) return;
		var m = MEASURES.filter(function (x) { return x.k === st.measure; })[0] || MEASURES[0], built = CLASSES.filter(function (c) { return c.status === 'built' && c.ranges; });
		var vals = []; built.forEach(function (c) { vals.push(c.ranges[m.k][0], c.ranges[m.k][1]); });
		var f = function (v) { return m.log ? Math.log10(v) : v; }, lo = Math.min.apply(null, vals.map(f)), hi = Math.max.apply(null, vals.map(f)), span = hi - lo || 1;
		ul.textContent = '';
		CLASSES.forEach(function (c) {
			var li = D.createElement('li'); li.dataset.class = c.id; if (c.id === st.cls) li.className = 'is-on'; if (c.status !== 'built') li.classList.add('is-future');
			var name = D.createElement('span'); name.className = 'styles-bars__name'; name.textContent = O.i18n.d(c.label);
			var track = D.createElement('span'); track.className = 'styles-bars__track'; track.setAttribute('aria-hidden', 'true');
			var val = D.createElement('span'); val.className = 'styles-bars__val';
			if (c.status === 'built' && c.ranges) {
				var a = c.ranges[m.k][0], b = c.ranges[m.k][1], l = (f(a) - lo) / span * 100, w = Math.max(1.5, (f(b) - f(a)) / span * 100);
				var fill = D.createElement('span'); fill.className = 'styles-bars__fill'; fill.style.left = Math.min(l, 98.5) + '%'; fill.style.width = Math.min(w, 100 - Math.min(l, 98.5)) + '%'; track.appendChild(fill);
				val.textContent = O.t('styles.range', '{from} to {to}{unit}', { from: nfmt(a), to: nfmt(b), unit: m.u });
			} else val.textContent = O.t('styles.notDesigned', 'Not designed yet');
			li.append(name, track, val); ul.appendChild(li);
		});
		var cap = $('#styles-compare .muted'); if (cap) cap.textContent = m.log ? O.t('styles.barsCapLog', 'Each bar spans the smallest to the largest value among the ships of that class (log scale, so the small classes stay visible). Pick a measure.') : O.t('styles.barsCap', 'Each bar spans the smallest to the largest value among the ships of that class. Pick a measure.');
	}
	function wireBars() {
		var box = $('#styles-compare'), grp = $('#styles-measure'); if (!box || !grp) return;
		MEASURES.forEach(function (m) {
			var b = D.createElement('button'); b.type = 'button'; b.className = 'pill'; b.textContent = measureLabel(m.k); b.dataset.k = m.k; b.setAttribute('aria-pressed', m.k === st.measure ? 'true' : 'false'); grp.appendChild(b);
		});
		grp.addEventListener('click', function (e) {
			var b = e.target.closest('button'); if (!b) return; st.measure = b.dataset.k;
			$$('button', grp).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
			renderBars(); O.ui.announce(O.t('styles.comparingBy', 'Comparing the classes by {measure}', { measure: O.i18n.lang === 'en' ? b.textContent.toLowerCase() : b.textContent }));
		});
		box.hidden = false; renderBars();
	}

	/* ====================================================================== economy ====================================================================== */
	function initEconomy() {
		var fs = $('#economy-path'), dia = $('#economy-diagram'); if (!fs || !dia) return;
		fs.hidden = false;
		fs.addEventListener('change', function (e) {
			var r = e.target; if (!r || r.name !== 'economy-path') return; dia.dataset.path = r.value;
			O.ui.announce(r.value === 'earn' ? O.t('economy.sayEarn', 'Showing the earn path.') : r.value === 'buy' ? O.t('economy.sayBuy', 'Showing the buy path.') : O.t('economy.sayBoth', 'Showing both paths.'));
		});
	}

	/* ====================================================================== self-test steps ====================================================================== */
	function addSelftests() {
		if (!O.selftest || !O.selftest.add) return;
		O.selftest.add('styles: class tabs by mouse and keyboard', async function () {
			var ch = st.chapter, notes = [], ok = true;
			function chk(c, m) { if (!c) { ok = false; notes.push(m); } }
			var tabs = $$('.styles-tabs [role="tab"]', ch); chk(tabs.length === 4, 'tab count ' + tabs.length);
			for (var i = 0; i < tabs.length; i++) {
				var id = tabs[i].dataset.class; tabs[i].click(); await sleep(450);
				chk(tabs[i].getAttribute('aria-selected') === 'true', id + ' not selected');
				var on = $$('.styles-panel.is-on', ch); chk(on.length === 1 && on[0].dataset.class === id, id + ' panel');
				var fut = id === 'colossal', box = $('#styles-viewerbox'), fig = $('#styles-colossal');
				chk(box.hidden === fut && fig.hidden === !fut, id + ' viewer/silhouette visibility');
				if (fut) {
					var txt = on[0].textContent.replace('1.2 km LEVIATHAN', ''); chk(!/[0-9]/.test(txt), 'colossal panel shows a digit');
					chk(!$('canvas', fig) && !(st.viewer && st.viewer.renderer), 'colossal has a 3D canvas');
					chk(!!$('.chip--future', on[0]), 'colossal FUTURE chip missing');
				} else {
					var bl = CLS[id].howItFights.length; chk($$('.styles-fights li', on[0]).length === bl && $$('.styles-fights li .chip--built', on[0]).length === bl && $$('.styles-fights li .styles-src', on[0]).length === bl, id + ' bullets/chips/sources');
				}
			}
			tabs[3].focus(); tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await sleep(450);
			chk(tabs[0].getAttribute('aria-selected') === 'true' && D.activeElement === tabs[0], 'ArrowRight wraps to Small');
			tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); await sleep(450);
			chk(tabs[3].getAttribute('aria-selected') === 'true', 'End selects Colossal');
			select('small', {}); await sleep(450);
			return { ok: ok, note: ok ? '4 tabs, ArrowRight/End, colossal has no numbers and no canvas' : notes.join('; ') };
		});
		O.selftest.add('styles: every bound number equals ORION_DATA', async function () {
			var bad = [], n = 0;
			$$('[data-bind]', D).filter(function (e) { return st.chapter.contains(e) || e.closest('#economy'); }).forEach(function (e) {
				n++; var v = e.getAttribute('data-bind').split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, W.ORION_DATA);
				var want = (e.dataset.fmt === 'num' && typeof v === 'number') ? O.ui.fmt.num(v) : (typeof v === 'string' ? O.i18n.d(v) : String(v));
				if (v == null || typeof v === 'object' || e.textContent !== want) bad.push(e.getAttribute('data-bind') + ' = ' + e.textContent + ' (data ' + want + ')');
			});
			return { ok: bad.length === 0 && n > 20, note: n + ' bound values checked' + (bad.length ? '; mismatches: ' + bad.slice(0, 4).join(' | ') : '') };
		});
		O.selftest.add('economy: PLANNED, fairness line, path highlight', async function () {
			var ec = $('#economy'), notes = [], ok = true;
			function chk(c, m) { if (!c) { ok = false; notes.push(m); } }
			chk(!!$('.chip--planned', ec), 'PLANNED chip'); chk(O.i18n.lang !== 'en' || /Nothing in this section is built yet\./.test(ec.textContent), 'nothing-built line');
			var fair = ec.querySelector('.economy-fair__t'), want = W.ORION_DATA.economy.fairness.text;
			chk(!!fair && fair.textContent === want, 'fairness line equals data');
			var dia = $('#economy-diagram'); chk(!!fair && dia.compareDocumentPosition(fair) & Node.DOCUMENT_POSITION_FOLLOWING, 'fairness line is below the diagram');
			chk(O.i18n.lang !== 'en' || !/cosmetics?[- ]only/i.test(ec.textContent), 'says cosmetics only');
			['earn', 'buy', 'both'].forEach(function (v) { var r = $('input[value="' + v + '"]', ec); r.click(); chk(dia.dataset.path === v, 'path ' + v); });
			chk($$('.economy-today__list li .chip--built', ec).length === W.ORION_DATA.economy.builtToday.length, 'built-today chips');
			return { ok: ok, note: ok ? 'PLANNED chip, fairness line under the diagram, radio highlight earn/buy/both, built-today chips' : notes.join('; ') };
		});
	}

	/* ====================================================================== register ====================================================================== */
	O.register('styles-economy', {
		init: function () {
			st.chapter = $('#styles'); if (!st.chapter) return;
			wireTabs(); wireBars(); initEconomy(); makeViewer(); applyViewerText('small'); addSelftests();
			/* language switch (I18N.md 3.8): re-render every piece of text this section drew, keeping the selected class and measure */
			O.bus.on('lang', function () {
				labelShips();
				var grp = $('#styles-measure'); if (grp) $$('button', grp).forEach(function (b) { b.textContent = measureLabel(b.dataset.k); });
				renderBars();
				if (st.cls !== 'colossal') applyViewerText(st.cls); else applyViewerText('small');
				if (st.viewer) st.viewer.setTexts({ label: sceneLabel(st.cls === 'colossal' ? 'small' : st.cls), groupLabel: O.t('styles.viewerGroup', 'Scripted 3D scene for the selected size class. Drag to orbit.') });
			});
		}
	});
})();
