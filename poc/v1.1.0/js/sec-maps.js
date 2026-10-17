/* orion-81.io mock: js/sec-maps.js (maps task, ORI-1306). Classic script, file:// safe: no fetch, no module, no local image textures.
   Registers 'maps'. DESIGN.md 4.2: a schematic chart, five locations (Appendix A.2), procedural vignettes made for this site,
   the game's own facts from ORION_DATA.maps and in-game captures (media keys map.<id>.N, Appendix A.9).
   Deep link for tests and sharing: index.html?maps=<mapId> opens that location. */
(function () {
	'use strict';
	var W = window, D = document, ORION = W.ORION;
	if (!ORION) return;

	/* ------------------------------------------------------------------ helpers */
	function $(s, r) { return (r || D).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
	function el(tag, attrs, kids) {
		var n = D.createElement(tag), k, v;
		if (attrs) for (k in attrs) {
			v = attrs[k];
			if (v == null || v === false) continue;
			if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
		}
		if (kids != null) [].concat(kids).forEach(function (c) { if (c != null) n.append(c); });
		return n;
	}
	function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
	function mix(a, b, t) { return a + (b - a) * t; }
	function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
	function maps() { return (ORION.data && ORION.data.maps) || []; }
	function mapById(id) { return maps().filter(function (m) { return m.id === id; })[0] || null; }
	function trimNum(n, d) { return String(parseFloat(Number(n).toFixed(d))); }
	function locN(n, d) { return new Intl.NumberFormat(ORION.i18n.locale, { maximumFractionDigits: d }).format(n); }
	function shortName(m) { return m.title.split(',')[0].replace(/ ASTEROID FIELD$/, ''); }
	function gravityText(m) {
		if (m.gravityMs2 == null) return '';
		if (m.gravityMs2 === 0) return ORION.t('maps.gravityFree', '0 m/s², free fall');
		if (m.gravityG == null) return ORION.t('maps.gravityOnly', '{ms2} m/s²', { ms2: locN(m.gravityMs2, 2) });
		return ORION.t('maps.gravity', '{ms2} m/s² · {g} g', { ms2: locN(m.gravityMs2, 2), g: locN(m.gravityG, 3) });
	}
	function mediaFor(m) { return (m.mediaKeys || []).filter(function (k) { return ORION.media(k); }); }
	function warn() { console.warn.apply(console, ['[maps]'].concat([].slice.call(arguments))); }

	/* ------------------------------------------------------------------ constants */
	var WORLD = { chart: [0, 0, 0], theta7: [7000, 0, 0], earth_orbit: [0, 0, 7000], luna: [-7000, 0, 0], sol: [0, 0, -7000] };
	var TIER = {
		low: { rocks: 400, stars: 700, earthW: 512, seg: [48, 24], terr: 120, debris: 40 },
		medium: { rocks: 900, stars: 1200, earthW: 512, seg: [64, 32], terr: 180, debris: 80 },
		high: { rocks: 2000, stars: 1800, earthW: 768, seg: [96, 48], terr: 240, debris: 140 }
	};
	var S = { cur: null, galI: 0, hot: null, openerKind: 'list', pendingFocus: null, v: null, view3d: null, root: null, galleryFor: null };

	/* ------------------------------------------------------------------ noise (procedural textures and terrain) */
	function hash3(x, y, z) {
		var n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
		n = Math.imul(n ^ (n >>> 13), 1103515245); n ^= n >>> 16; return (n >>> 0) / 4294967296;
	}
	function vnoise(x, y, z) {
		var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
		xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
		var a = hash3(xi, yi, zi), b = hash3(xi + 1, yi, zi), c = hash3(xi, yi + 1, zi), d = hash3(xi + 1, yi + 1, zi),
			e = hash3(xi, yi, zi + 1), f = hash3(xi + 1, yi, zi + 1), g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
		var x1 = a + (b - a) * xf, x2 = c + (d - c) * xf, x3 = e + (f - e) * xf, x4 = g + (h - g) * xf;
		var y1 = x1 + (x2 - x1) * yf, y2 = x3 + (x4 - x3) * yf;
		return y1 + (y2 - y1) * zf;
	}
	function fbm(x, y, z, oct) {
		var s = 0, a = 0.5, n = 0, i;
		for (i = 0; i < oct; i++) { s += a * vnoise(x, y, z); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
		return s / n;
	}

	/* ------------------------------------------------------------------ shaders (shared GLSL) */
	var GLSL_NOISE = [
		'float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
		'float vn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
		' return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),',
		'            mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }',
		'float fbm4(vec3 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }'
	].join('\n');
	var SUN_VS = 'varying vec3 vDir; varying vec3 vN; varying vec3 vV;\nvoid main(){ vDir = normalize(position); vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }';
	var SUN_FS = [
		'uniform float uTime; varying vec3 vDir; varying vec3 vN; varying vec3 vV;', GLSL_NOISE,
		'void main(){',
		' vec3 N = normalize(vN); vec3 V = normalize(vV); float mu = clamp(dot(N, V), 0.0, 1.0);',
		' float limb = 1.0 - 0.58 * (1.0 - mu) - 0.17 * (1.0 - mu) * (1.0 - mu);',
		' vec3 p = vDir * 5.5;',
		' float g1 = fbm4(p + vec3(0.0, uTime * 0.12, uTime * 0.07));',
		' float g2 = fbm4(p * 2.7 - vec3(uTime * 0.2, 0.0, uTime * 0.1));',
		' float gran = 0.55 + 0.9 * g1 + 0.35 * (g2 - 0.5);',
		' float spots = smoothstep(0.62, 0.74, fbm4(vDir * 2.2 + 7.0 + uTime * 0.01));',
		' vec3 hot = vec3(1.0, 0.46, 0.09); vec3 cool = vec3(0.62, 0.07, 0.0);',
		' vec3 col = mix(cool, hot, pow(mu, 0.7)) * limb * gran;',
		' col *= 1.0 - 0.55 * spots * mu;',
		' gl_FragColor = vec4(col * 1.05, 1.0);',
		' #include <colorspace_fragment>', '}'
	].join('\n');
	var EARTH_VS = 'varying vec2 vUv; varying vec3 vNW; varying vec3 vWP;\nvoid main(){ vUv = uv; vNW = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
	var EARTH_FS = [
		'uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; varying vec2 vUv; varying vec3 vNW; varying vec3 vWP;', 'float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
		'void main(){',
		' vec3 N = normalize(vNW); vec3 V = normalize(cameraPosition - vWP); float ndl = dot(N, uSun);',
		' vec3 day = texture2D(uDay, vUv).rgb; vec3 nl = texture2D(uNight, vUv).rgb;',
		' float lit = smoothstep(-0.06, 0.25, ndl);',
		' float sea = smoothstep(0.03, 0.09, day.b - day.r);',
		' vec3 H = normalize(uSun + V); float spec = pow(max(dot(N, H), 0.0), 80.0) * sea * lit;',
		' vec3 col = day * (0.012 + 1.35 * max(ndl, 0.0));',
		' float tw = smoothstep(-0.16, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.22, ndl));',
		' col += day * vec3(1.0, 0.42, 0.16) * tw * 0.5 + day * vec3(0.55, 0.7, 1.0) * 0.06;',
		' vec2 cc = vUv * vec2(3600.0, 1800.0); float rnd = h31(vec3(floor(cc), 1.0)); float sp = step(0.74, rnd) * smoothstep(0.5, 0.08, length(fract(cc) - 0.5)); col += nl * (0.7 + 7.0 * sp) * (1.0 - lit);',
		' col += vec3(1.0, 0.95, 0.85) * spec * 0.9;',
		' gl_FragColor = vec4(col, 1.0);',
		' #include <tonemapping_fragment>', ' #include <colorspace_fragment>', '}'
	].join('\n');
	var CLOUD_FS = [
		'uniform sampler2D uCloud; uniform vec3 uSun; varying vec2 vUv; varying vec3 vNW; varying vec3 vWP;',
		'void main(){ vec3 N = normalize(vNW); float ndl = dot(N, uSun); float c = texture2D(uCloud, vUv).r;',
		' float lit = smoothstep(-0.1, 0.3, ndl); vec3 col = vec3(1.0) * (0.02 + 1.2 * max(ndl, 0.0));',
		' gl_FragColor = vec4(col, c * 0.85 * (0.18 + 0.82 * lit));',
		' #include <tonemapping_fragment>', ' #include <colorspace_fragment>', '}'
	].join('\n');
	var ATMO_FS = [
		'uniform vec3 uSun; uniform float uT0; varying vec2 vUv; varying vec3 vNW; varying vec3 vWP;',
		'void main(){ vec3 N = normalize(vNW); vec3 V = normalize(cameraPosition - vWP); float t = clamp(dot(N, V), 0.0, 1.0);',
		' float band = smoothstep(0.0, uT0, t) * (1.0 - smoothstep(uT0, 1.0, t)); band = pow(band, 1.6);',
		' float ndl = dot(N, uSun); float day = smoothstep(-0.32, 0.3, ndl);',
		' float dawn = 1.0 - smoothstep(0.0, 0.5, abs(ndl + 0.04));',
		' vec3 col = mix(vec3(0.20, 0.50, 1.0), vec3(1.0, 0.52, 0.2), dawn * 0.85);',
		' float k = band * day * 1.7; gl_FragColor = vec4(col * k, k);',
		' #include <colorspace_fragment>', '}'
	].join('\n');
	var PLAIN_VS = EARTH_VS;

	/* ------------------------------------------------------------------ the Earth kit (textures generated once per mount) */
	function earthKit(ctx, disp) {
		var T = ctx.THREE, kit = ctx.kit, P = TIER[ctx.tier] || TIER.medium, tex = null;
		function gen() {
			var w = P.earthW, h = w / 2, day = new Uint8ClampedArray(w * h * 4), night = new Uint8ClampedArray(w * h * 4), cloud = new Uint8ClampedArray(w * h * 4);
			var x, y, i = 0, lat, cl, sl, lon, px, py, pz, e, m, heat, r, g, b, land, v, d, q, t;
			for (y = 0; y < h; y++) {
				lat = (0.5 - (y + 0.5) / h) * Math.PI; cl = Math.cos(lat); sl = Math.sin(lat);
				for (x = 0; x < w; x++, i += 4) {
					lon = (x + 0.5) / w * Math.PI * 2; px = cl * Math.cos(lon); py = sl; pz = cl * Math.sin(lon);
					e = fbm(px * 1.7 + 9, py * 1.7 + 9, pz * 1.7 + 9, 4);
					land = e > 0.52;
					heat = 1 - Math.abs(lat) / 1.5708 * 1.15;
					if (land) {
						m = fbm(px * 3.1 + 40, py * 3.1 + 40, pz * 3.1 + 40, 3);
						t = smooth(0.56, 0.4, m);
						r = mix(38, 150, t); g = mix(92, 126, t); b = mix(40, 84, t);
						t = smooth(0.34, 0.12, heat); r = mix(r, 232, t); g = mix(g, 238, t); b = mix(b, 242, t);
						t = smooth(0.63, 0.74, e); r = mix(r, 176, t); g = mix(g, 170, t); b = mix(b, 160, t);
					} else {
						t = clamp((0.52 - e) / 0.18, 0, 1);
						r = mix(22, 3, t); g = mix(78, 22, t); b = mix(120, 62, t);
					}
					if (Math.abs(lat) > 1.27 + 0.05 * vnoise(px * 9, py * 9, pz * 9)) { r = 238; g = 242; b = 246; land = true; }
					day[i] = r; day[i + 1] = g; day[i + 2] = b; day[i + 3] = 255;
					v = 0;
					if (land && Math.abs(lat) < 1.12) {
						d = fbm(px * 7 + 60, py * 7 + 60, pz * 7 + 60, 3);
						if (d > 0.56) { v = smooth(0.56, 0.78, d); q = hash3(x, y, 7); v *= q > 0.4 ? 1 : 0.35; }
					}
					night[i] = 255 * v; night[i + 1] = 188 * v; night[i + 2] = 105 * v; night[i + 3] = 255;
					t = fbm(px * 2.8 + 100, py * 2.8 + 100, pz * 2.8 + 100, 4);
					t = smooth(0.5, 0.7, t); cloud[i] = cloud[i + 1] = cloud[i + 2] = 255 * t; cloud[i + 3] = 255;
				}
			}
			function toTex(arr) {
				var tt = kit.canvasTexture(w, h, function (g2) { g2.putImageData(new ImageData(arr, w, h), 0, 0); });
				tt.anisotropy = 4; disp.push(tt); return tt;
			}
			return { day: toTex(day), night: toTex(night), cloud: toTex(cloud) };
		}
		return {
			/* returns { group, sun } ; sun is the shared THREE.Vector3 (world direction towards the Sun) */
			planet: function (R, sunDir) {
				if (!tex) tex = gen();
				var sun = new T.Vector3().copy(sunDir).normalize(), g = new T.Group(), seg = P.seg;
				var pm = new T.ShaderMaterial({ uniforms: { uDay: { value: tex.day }, uNight: { value: tex.night }, uSun: { value: sun } }, vertexShader: EARTH_VS, fragmentShader: EARTH_FS });
				var cm = new T.ShaderMaterial({ uniforms: { uCloud: { value: tex.cloud }, uSun: { value: sun } }, vertexShader: PLAIN_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false });
				var k = 1.045, am = new T.ShaderMaterial({ uniforms: { uSun: { value: sun }, uT0: { value: Math.sqrt(1 - 1 / (k * k)) } }, vertexShader: PLAIN_VS, fragmentShader: ATMO_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
				var p = new T.Mesh(new T.SphereGeometry(R, seg[0], seg[1]), pm), c = new T.Mesh(new T.SphereGeometry(R * 1.012, seg[0], seg[1]), cm), a = new T.Mesh(new T.SphereGeometry(R * k, seg[0], seg[1]), am);
				c.renderOrder = 2; a.renderOrder = 3;
				g.add(p, c, a); return { group: g, sun: sun, planet: p, clouds: c };
			}
		};
	}
	function sunMesh(T, R, seg) {
		var mat = new T.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: SUN_VS, fragmentShader: SUN_FS });
		var m = new T.Mesh(new T.SphereGeometry(R, seg, Math.round(seg * 0.75)), mat); m.userData.mat = mat; return m;
	}
	function dirLight(T, group, center, dir, color, intensity) {
		var l = new T.DirectionalLight(color, intensity), d = new T.Vector3().fromArray(dir).normalize();
		l.position.set(center[0] + d.x * 1000, center[1] + d.y * 1000, center[2] + d.z * 1000); l.target.position.set(center[0], center[1], center[2]);
		group.add(l, l.target); return l;
	}
	function addSunGlow(kit, group, center, dir, dist, size, hotColor) {
		var d = dir.slice(), L = Math.hypot(d[0], d[1], d[2]); d = d.map(function (v) { return v / L; });
		var s1 = kit.glowSprite(hotColor || 0xffc070, size, 0.9), s2 = kit.glowSprite(0xffffff, size * 0.22, 1);
		[s1, s2].forEach(function (s) { s.position.set(center[0] + d[0] * dist, center[1] + d[1] * dist, center[2] + d[2] * dist); group.add(s); });
	}

	/* ------------------------------------------------------------------ chart */
	function buildChart(ctx, E) {
		var T = ctx.THREE, kit = ctx.kit, P = TIER[ctx.tier] || TIER.medium, g = new T.Group();
		var sunPos = new T.Vector3(-42, 0, 6), earthR = 6.2;
		var sun = sunMesh(T, 8, 40); sun.position.copy(sunPos); g.add(sun);
		var glow = kit.glowSprite(0xffb050, 46, 0.55); glow.position.copy(sunPos); g.add(glow);
		var toSun = sunPos.clone().normalize();
		var ep = E.planet(earthR, toSun); g.add(ep.group);
		/* rings: the Moon's path and a ring for the low orbit (schematic lines) */
		function ring(r, tiltX, color, op) {
			var pts = [], i; for (i = 0; i <= 96; i++) { var a = i / 96 * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
			var l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: color, transparent: true, opacity: op })); l.rotation.x = tiltX; return l;
		}
		g.add(ring(15, 0.18, 0x5d7391, 0.7)); g.add(ring(9.6, 0.95, 0x8cc8ff, 0.55));
		var moon = new T.Mesh(new T.SphereGeometry(1.7, 24, 16), new T.MeshStandardMaterial({ color: 0xa8a49c, roughness: 1, metalness: 0 })); g.add(moon);
		var moonA = 0.5; function placeMoon() { moon.position.set(Math.cos(moonA) * 15, Math.sin(moonA) * 15 * Math.sin(0.18), Math.sin(moonA) * 15 * Math.cos(0.18)); }
		placeMoon();
		var leo = new T.Vector3(9.6 * Math.cos(3.7), 0, 9.6 * Math.sin(3.7)).applyAxisAngle(new T.Vector3(1, 0, 0), 0.95);
		var leoDot = new T.Mesh(new T.OctahedronGeometry(0.34, 0), new T.MeshBasicMaterial({ color: 0xd8ecff })); leoDot.position.copy(leo); g.add(leoDot);
		/* THETA-7: a schematic cluster of faceted rocks, apart from the planets */
		var thC = new T.Vector3(43, -3, -16), rng = kit.rng(7771), n = P.rocks > 800 ? 90 : 60;
		var rockMesh = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0x8f857a, roughness: 0.95, flatShading: true }), n), dm = new T.Object3D(), i;
		for (i = 0; i < n; i++) {
			var u = rng(), v = rng() * 2 - 1, th = rng() * 6.283, rr = Math.cbrt(u) * 7;
			dm.position.set(thC.x + Math.cos(th) * Math.sqrt(1 - v * v) * rr, thC.y + v * rr * 0.45, thC.z + Math.sin(th) * Math.sqrt(1 - v * v) * rr * 0.8);
			var s = 0.25 + rng() * rng() * 1.1; dm.scale.set(s * (0.8 + rng() * 0.5), s, s * (0.8 + rng() * 0.5)); dm.rotation.set(rng() * 6, rng() * 6, rng() * 6); dm.updateMatrix(); rockMesh.setMatrixAt(i, dm.matrix);
		}
		rockMesh.frustumCulled = false; g.add(rockMesh);
		var lt = dirLight(T, g, [0, 0, 0], [-42, 0, 6], 0xfff1dc, 2.6); void lt;
		g.add(new T.HemisphereLight(0x6f8fb8, 0x0a0f17, 0.55));
		/* hover/focus glow rings */
		var pts = {
			sol: { p: sunPos, size: 26 }, earth_orbit: { p: leo, size: 7 }, luna: { p: moon.position, size: 6 }, theta7: { p: thC, size: 22 },
			glasgow: { p: new T.Vector3(-0.3, 0.38, 0.87).normalize().multiplyScalar(earthR), size: 5 }
		};
		var hots = {}; Object.keys(pts).forEach(function (k) { var s = kit.glowSprite(0x8cc8ff, pts[k].size, 0); s.position.copy(pts[k].p); g.add(s); hots[k] = s; });
		return {
			group: g, points: pts, glasgowDir: pts.glasgow.p.clone().normalize(),
			setHot: function (id) { Object.keys(hots).forEach(function (k) { hots[k].material.opacity = k === id ? 0.85 : 0; }); },
			update: function (dt, t, full) {
				if (full) { moonA += dt * 0.05; placeMoon(); hots.luna.position.copy(moon.position); }
				sun.userData.mat.uniforms.uTime.value = full ? t : 0; return full;
			}
		};
	}

	/* ------------------------------------------------------------------ THETA-7: the game's own rock meshes, instanced */
	async function buildTheta7(ctx) {
		var T = ctx.THREE, kit = ctx.kit, P = TIER[ctx.tier] || TIER.medium, C = WORLD.theta7, g = new T.Group();
		var ids = ['rock1', 'rock2', 'rock3', 'rock4'];
		var models = await Promise.all(ids.map(function (id) { return ctx.loadModel(id); }));
		var rng = kit.rng(40817), per = Math.floor(P.rocks / 4), meshes = [], spins = [];
		models.forEach(function (mod, mi) {
			var A = mod.arrays, geo = new T.BufferGeometry();
			geo.setAttribute('position', new T.BufferAttribute(A.position, 3)); geo.setAttribute('normal', new T.BufferAttribute(A.normal, 3));
			if (A.uv) geo.setAttribute('uv', new T.BufferAttribute(A.uv, 2));
			geo.setIndex(new T.BufferAttribute(A.index, 1)); geo.center(); geo.computeBoundingSphere();
			var map = null;
			if (mod.atlas) { map = new T.Texture(mod.atlas); map.flipY = false; map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4; map.needsUpdate = true; }
			var mat = new T.MeshStandardMaterial({ map: map, color: map ? 0xffffff : 0x8b8174, roughness: 0.96, metalness: 0 });
			var im = new T.InstancedMesh(geo, mat, per); im.frustumCulled = false;
			var data = { pos: [], q: [], s: [], axis: [], w: [] }, dm = new T.Object3D(), i, tries;
			for (i = 0; i < per; i++) {
				var x, y, z, r;
				for (tries = 0; tries < 8; tries++) {
					var u = rng(), v = rng() * 2 - 1, th = rng() * 6.2832; r = Math.pow(u, 0.4) * 1600;
					x = Math.cos(th) * Math.sqrt(1 - v * v) * r; y = v * r * 0.45; z = Math.sin(th) * Math.sqrt(1 - v * v) * r;
					if (Math.hypot(x, y, z) > 150 && Math.hypot(x, y - 90, z - 380) > 260) break;
				}
				var s = 0.6 + Math.pow(rng(), 5) * 8.5; /* a few big rocks give the field scale */
				var q = new T.Quaternion().set(rng() - 0.5, rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
				data.pos.push(new T.Vector3(C[0] + x, C[1] + y, C[2] + z)); data.q.push(q); data.s.push(s);
				data.axis.push(new T.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()); data.w.push((rng() - 0.5) * 0.36 / Math.sqrt(s));
				dm.position.copy(data.pos[i]); dm.quaternion.copy(q); dm.scale.setScalar(s); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
			}
			im.instanceMatrix.needsUpdate = true; g.add(im); meshes.push(im); spins.push(data);
		});
		var sunDir = [0.85, 0.35, 0.2];
		dirLight(T, g, C, sunDir, 0xfff2dc, 3.6);
		dirLight(T, g, C, [-0.7, -0.15, -0.55], 0x5f86b8, 0.8); /* cool rim light from the shadow side */
		g.add(new T.HemisphereLight(0x1b2638, 0x050403, 0.3));
		addSunGlow(kit, g, C, sunDir, 9000, 2400, 0xffc77a);
		var dm2 = new T.Object3D(), dq = new T.Quaternion();
		return {
			group: g,
			cfg: { pos: [C[0], C[1] + 90, C[2] + 380], target: C, min: 120, max: 1100, pMin: 0.05, pMax: Math.PI - 0.05, env: 0.06 },
			update: function (dt, t, full) {
				if (!full) return false;
				for (var k = 0; k < meshes.length; k++) {
					var d = spins[k], im = meshes[k];
					for (var i = 0; i < d.s.length; i++) {
						dq.setFromAxisAngle(d.axis[i], d.w[i] * dt); d.q[i].multiply(dq).normalize();
						dm2.position.copy(d.pos[i]); dm2.quaternion.copy(d.q[i]); dm2.scale.setScalar(d.s[i]); dm2.updateMatrix(); im.setMatrixAt(i, dm2.matrix);
					}
					im.instanceMatrix.needsUpdate = true;
				}
				return true;
			}
		};
	}

	/* ------------------------------------------------------------------ LOW EARTH ORBIT */
	function buildEarthOrbit(ctx, E) {
		var T = ctx.THREE, kit = ctx.kit, P = TIER[ctx.tier] || TIER.medium, C = WORLD.earth_orbit, g = new T.Group();
		var R = 1000, sunDir = new T.Vector3(-0.27, -0.37, -0.95).normalize();
		var ep = E.planet(R, sunDir); ep.group.position.set(C[0], C[1] - R - 70, C[2]); ep.group.rotation.set(-0.7, 1.6, 0); g.add(ep.group);
		/* a co-orbital debris cloud (the map's own hazard), drawn as faceted shards */
		var n = P.debris, rng = kit.rng(90133), mesh = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.6, roughness: 0.5, flatShading: true }), n);
		var data = [], dm = new T.Object3D(), i;
		for (i = 0; i < n; i++) {
			var u = rng(), v = rng() * 2 - 1, th = rng() * 6.2832, r = Math.cbrt(u) * 330;
			var p = new T.Vector3(C[0] + Math.cos(th) * Math.sqrt(1 - v * v) * r, C[1] - 25 + v * r * 0.5, C[2] - 280 + Math.sin(th) * Math.sqrt(1 - v * v) * r);
			var s = 0.5 + Math.pow(rng(), 2) * 4.5, q = new T.Quaternion().set(rng() - 0.5, rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
			data.push({ p: p, q: q, s: s, a: new T.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), w: (rng() - 0.5) * 0.8, sx: 0.5 + rng() * 1.2, sz: 0.4 + rng() });
			dm.position.copy(p); dm.quaternion.copy(q); dm.scale.set(s * data[i].sx, s * 0.35, s * data[i].sz); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix);
		}
		mesh.frustumCulled = false; g.add(mesh);
		dirLight(T, g, C, sunDir.toArray(), 0xffe2c0, 3.0);
		g.add(new T.HemisphereLight(0x3a5c92, 0x05070b, 0.18));
		addSunGlow(kit, g, C, sunDir.toArray(), 9000, 2600, 0xff9a4a);
		var dq = new T.Quaternion();
		return {
			group: g,
			cfg: { pos: [C[0], C[1], C[2]], target: [C[0], C[1] - 170, C[2] - 600], min: 200, max: 1300, pMin: 0.3, pMax: Math.PI / 2 - 0.02, env: 0.05 },
			update: function (dt, t, full) {
				if (!full) return false;
				for (var i = 0; i < n; i++) {
					var d = data[i]; dq.setFromAxisAngle(d.a, d.w * dt); d.q.multiply(dq).normalize();
					dm.position.copy(d.p); dm.quaternion.copy(d.q); dm.scale.set(d.s * d.sx, d.s * 0.35, d.s * d.sz); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix);
				}
				mesh.instanceMatrix.needsUpdate = true; return true;
			}
		};
	}

	/* ------------------------------------------------------------------ COPERNICUS: a terraced wall at sunset, Earth in the sky */
	function buildLuna(ctx, E, disp) {
		var T = ctx.THREE, kit = ctx.kit, P = TIER[ctx.tier] || TIER.medium, C = WORLD.luna, g = new T.Group();
		var SIZE = 6400, N = P.terr, RM = 14000, rng = kit.rng(5521), craters = [], i;
		for (i = 0; i < 230; i++) {
			var big = i < 14, near = i >= 150, r = big ? 140 + rng() * 380 : (near ? 40 + Math.pow(rng(), 1.5) * 190 : 14 + Math.pow(rng(), 2.2) * 120);
			craters.push({ x: near ? (rng() - 0.5) * 3000 : (rng() - 0.5) * SIZE * 1.1, z: near ? -2200 * rng() + 300 : (rng() - 0.5) * SIZE * 1.1, r: r, d: r * (big ? 0.22 : 0.2) });
		}
		function wall(x, z) {
			var dd = -z + 180 * (fbm(x * 0.002, 3.3, z * 0.002, 3) - 0.5), t = clamp((dd - 1000) / 1000, 0, 1), s = t * 5, step = (Math.floor(s) + smooth(0.84, 1, s - Math.floor(s))) / 5;
			var fade = 1 - smooth(1500, 3000, Math.abs(x + 200 * Math.sin(z * 0.0015)));
			return 420 * (dd > 1000 ? Math.min(step, 1) : 0) * fade;
		}
		function height(x, z) {
			var h = 12 * (fbm(x * 0.0018, 1.7, z * 0.0018, 4) - 0.5) + 6 * (fbm(x * 0.02, 5.1, z * 0.02, 2) - 0.5), k, c, dx, dz, q, d2;
			for (k = 0; k < craters.length; k++) {
				c = craters[k]; dx = x - c.x; dz = z - c.z; d2 = dx * dx + dz * dz; if (d2 > c.r * c.r * 2.56) continue;
				q = Math.sqrt(d2) / c.r;
				if (q < 1) h -= c.d * (1 - q * q) * (1 - 0.25 * q); h += c.d * 0.38 * Math.exp(-Math.pow((q - 1) / 0.22, 2));
			}
			return h + wall(x, z) + 2.4 * (vnoise(x * 0.11, 9.3, z * 0.11) - 0.5) - (x * x + z * z) / (2 * RM);
		}
		var grain = (function () {
			var size = 512, cv = D.createElement('canvas'), g2 = cv.getContext('2d'), gr = kit.rng(8801), id, d, px, k;
			cv.width = cv.height = size; g2.fillStyle = '#808080'; g2.fillRect(0, 0, size, size);
			id = g2.getImageData(0, 0, size, size); d = id.data;
			for (px = 0; px < d.length; px += 4) { k = 128 + (gr() - 0.5) * 46 + (vnoise((px / 4 % size) * 0.04, Math.floor(px / 4 / size) * 0.04, 2.2) - 0.5) * 60; d[px] = d[px + 1] = d[px + 2] = k; d[px + 3] = 255; }
			g2.putImageData(id, 0, 0);
			function crater(x, y, r) {
				var gg = g2.createRadialGradient(x, y, r * 0.1, x, y, r); gg.addColorStop(0, 'rgba(40,40,40,.85)'); gg.addColorStop(0.75, 'rgba(90,90,90,.45)'); gg.addColorStop(1, 'rgba(128,128,128,0)');
				g2.fillStyle = gg; g2.beginPath(); g2.arc(x, y, r, 0, 6.2832); g2.fill();
				g2.strokeStyle = 'rgba(210,210,210,.5)'; g2.lineWidth = Math.max(1, r * 0.12); g2.beginPath(); g2.arc(x - r * 0.08, y - r * 0.08, r * 0.92, 3.4, 5.4); g2.stroke();
			}
			for (var i2 = 0; i2 < 170; i2++) {
				var x = gr() * size, y = gr() * size, r = 3 + Math.pow(gr(), 2.4) * 40;
				[-size, 0, size].forEach(function (ox) { [-size, 0, size].forEach(function (oy) { if (x + ox > -r && x + ox < size + r && y + oy > -r && y + oy < size + r) crater(x + ox, y + oy, r); }); });
			}
			var m = new T.CanvasTexture(cv), b = new T.CanvasTexture(cv);
			m.colorSpace = T.SRGBColorSpace; b.colorSpace = T.NoColorSpace;
			[m, b].forEach(function (t) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(30, 30); t.anisotropy = 4; });
			return { map: m, bump: b };
		})();
		disp.push(grain.map, grain.bump);
		var geo = new T.PlaneGeometry(SIZE, SIZE, N, N); geo.rotateX(-Math.PI / 2);
		var pos = geo.attributes.position, col = new Float32Array(pos.count * 3), x, z, c0;
		for (i = 0; i < pos.count; i++) {
			x = pos.getX(i); z = pos.getZ(i); pos.setY(i, height(x, z));
			c0 = 0.55 + 0.3 * fbm(x * 0.004, 3.7, z * 0.004, 3) + 0.06 * (vnoise(x * 0.05, 1, z * 0.05) - 0.5);
			col[i * 3] = c0; col[i * 3 + 1] = c0 * 0.985; col[i * 3 + 2] = c0 * 0.96;
		}
		geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.computeVertexNormals();
		var terrain = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, map: grain.map, bumpMap: grain.bump, bumpScale: 1.6, roughness: 1, metalness: 0 }));
		terrain.position.set(C[0], C[1], C[2]); g.add(terrain);
		var sunDir = [0.93, 0.07, -0.3];
		dirLight(T, g, C, sunDir, 0xfff1e0, 5.6);
		g.add(new T.HemisphereLight(0x4a6a9c, 0x14110e, 0.45));
		addSunGlow(kit, g, C, sunDir, 9000, 2400, 0xffb070);
		/* Earth in the sky: follows the camera, so it never parallaxes */
		var sky = new T.Group(), eDir = new T.Vector3(-0.2, 0.29, -0.93).normalize(), ER = 3000 * Math.tan(0.97 * Math.PI / 180);
		var ep = E.planet(ER, new T.Vector3(0.8, 0.1, 0.55)); ep.group.position.copy(eDir).multiplyScalar(3000); sky.add(ep.group); g.add(sky);
		var camY = height(0, 60) + 48, cam = ctx.camera, SKY = new T.Vector3();
		return {
			group: g,
			cfg: { pos: [C[0], C[1] + camY, C[2] + 60], target: [C[0], C[1] + camY + 40, C[2] - 420], min: 120, max: 900, pMin: 0.5, pMax: Math.PI / 2 + 0.3, env: 0.04 },
			update: function () {
				SKY.copy(cam.position); sky.position.copy(SKY);
				var gx = cam.position.x - C[0], gz = cam.position.z - C[2];
				if (Math.abs(gx) < SIZE / 2 && Math.abs(gz) < SIZE / 2) { var hy = C[1] + height(gx, gz) + 30; if (cam.position.y < hy) cam.position.y = hy; }
				return false;
			}
		};
	}

	/* ------------------------------------------------------------------ PERIHELION: a limb-darkened Sun */
	function buildSol(ctx) {
		var T = ctx.THREE, kit = ctx.kit, C = WORLD.sol, g = new T.Group(), R = 1000, D0 = 4000;
		var c = [C[0], C[1] - D0, C[2]], sun = sunMesh(T, R, ctx.tier === 'low' ? 56 : 96); sun.position.set(c[0], c[1], c[2]); g.add(sun);
		var corona = kit.glowSprite(0xff8a2a, R * 6.5, 1); corona.position.set(c[0], c[1], c[2]); g.add(corona);
		var a = 1.0, b = 0.4, off = [Math.sin(a) * Math.cos(b) * D0, Math.cos(a) * D0, Math.sin(a) * Math.sin(b) * D0];
		return {
			group: g,
			cfg: { pos: [c[0] + off[0], c[1] + off[1], c[2] + off[2]], target: c, min: 2500, max: 7500, pMin: 0.35, pMax: Math.PI - 0.35, env: 0 },
			update: function (dt, t, full) { sun.userData.mat.uniforms.uTime.value = full ? t : 0; return full; }
		};
	}

	/* ------------------------------------------------------------------ the viewer setup and camera controller */
	async function setupScene(ctx) {
		var T = ctx.THREE, kit = ctx.kit, scene = ctx.scene, camera = ctx.camera, controls = ctx.controls, P = TIER[ctx.tier] || TIER.medium;
		camera.near = 1; camera.far = 40000; camera.updateProjectionMatrix();
		scene.environmentIntensity = 0.35;
		var disp = [], E = earthKit(ctx, disp);
		var stars = kit.starfield({ count: P.stars, radius: 15000, twinkle: ctx.motion === 'full' }); scene.add(stars);
		var chart = buildChart(ctx, E); scene.add(chart.group);
		var vig = {}, curView = 'chart', tok = 0, wantMarkers = true;
		var BUILD = {
			theta7: function () { return buildTheta7(ctx); }, earth_orbit: function () { return Promise.resolve(buildEarthOrbit(ctx, E)); },
			luna: function () { return Promise.resolve(buildLuna(ctx, E, disp)); }, sol: function () { return Promise.resolve(buildSol(ctx)); }
		};
		function chartCfg() {
			var asp = camera.aspect || 1.6, D = 175 / asp, d = new T.Vector3(0.12, 0.38, 0.92).normalize().multiplyScalar(D);
			return { pos: [d.x, d.y, d.z], target: [0, 0, 0], min: 30, max: 320, pMin: 0.12, pMax: Math.PI - 0.5, env: 0.35 };
		}
		function limits(cfg) { controls.minDistance = cfg.min; controls.maxDistance = cfg.max; controls.minPolarAngle = cfg.pMin; controls.maxPolarAngle = cfg.pMax; }
		function relax() { controls.minDistance = 0.01; controls.maxDistance = 1e9; controls.minPolarAngle = 0.01; controls.maxPolarAngle = Math.PI - 0.01; }
		async function go(id, instant) {
			var my = ++tok, target = (id && id !== 'glasgow') ? id : 'chart', cfg;
			if (target !== 'chart' && !vig[target]) {
				S.loading(true);
				try { vig[target] = await BUILD[target](); scene.add(vig[target].group); vig[target].group.visible = false; }
				catch (e) { S.loading(false); warn('vignette failed: ' + target, e); S.sceneFailed(id); return; }
				S.loading(false); if (my !== tok) return;
			}
			cfg = target === 'chart' ? chartCfg() : vig[target].cfg;
			chart.group.visible = true; Object.keys(vig).forEach(function (k) { vig[k].group.visible = (k === target) || (k === curView); });
			relax(); scene.environmentIntensity = cfg.env;
			await ctx.cameraTo(cfg.pos, cfg.target, instant ? 0 : 800);
			if (my !== tok) return;
			chart.group.visible = target === 'chart'; Object.keys(vig).forEach(function (k) { vig[k].group.visible = k === target; });
			limits(cfg); curView = target; ctx.setHome(); wantMarkers = target === 'chart'; ctx.requestRender();
			S.viewArrived(target);
		}
		/* chart markers */
		var items = [], MK = S.markers;
		Object.keys(MK).forEach(function (id) {
			var pt = chart.points[id]; if (!pt) return;
			items.push({ id: id, el: MK[id], point: pt.p, dir: id === 'glasgow' ? chart.glasgowDir : null });
		});
		var proj = kit.projector(ctx.viewer, chart.group);
		var watch = proj.watch(items, function (it, r) {
			var n = it.el, w = ctx.viewer.size.w;
			n.style.transform = 'translate3d(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px,0)';
			n.dataset.facing = r.facing > 0.05 ? 'front' : 'back'; n.dataset.visible = (r.visible && curView === 'chart') ? 'true' : 'false'; n.dataset.left = (it.id === 'earth_orbit' || r.x > w * 0.7) ? 'true' : 'false';
		});
		var ro = W.ResizeObserver ? new ResizeObserver(function () { if (curView === 'chart' && S.cur === null && !ctx.viewer.tween) { var c = chartCfg(); camera.position.fromArray(c.pos); controls.target.fromArray(c.target); controls.update(); ctx.setHome(); } }) : null;
		if (ro) ro.observe(ctx.host);
		var api = {
			go: go, hot: function (id) { chart.setHot(id); ctx.requestRender(); }, view: function () { return curView; },
			update: function (dt, t) {
				var full = ctx.motion === 'full', anim = false;
				stars.position.copy(camera.position);
				if (chart.group.visible && chart.update(dt, t, full)) anim = true;
				Object.keys(vig).forEach(function (k) { if (vig[k].group.visible && vig[k].update(dt, t, full)) anim = true; });
				return anim;
			},
			dispose: function () {
				S.view3d = null; if (ro) ro.disconnect(); watch.stop();
				disp.forEach(function (t) { try { t.dispose(); } catch (e) { /* ignore */ } });
			}
		};
		S.view3d = api; S.dbg = { scene: scene, camera: camera, vig: vig, chart: chart };
		function firstSync() { try { api.update(0, 0); } catch (e) { warn(e); } }
		/* restore the current choice (remount, deep link) without a fly-in */
		if (S.cur && S.cur !== 'glasgow') await go(S.cur, true); else { limits(chartCfg()); camera.position.fromArray(chartCfg().pos); controls.target.fromArray(chartCfg().target); controls.update(); ctx.setHome(); }
		firstSync();
		return api;
	}

	/* ------------------------------------------------------------------ section UI */
	function captionText() {
		var v = S.v, st = v ? v.host.dataset.state : 'poster', live = st === 'live' || st === 'paused', cur = S.cur;
		if (S.galleryFor) { var gk = galKeys(S.galleryFor), gm = ORION.media(gk[S.galI] || gk[0]); return gm ? gm.caption : ''; }
		if (!live) { var pm = v && v.opts.posterKey ? ORION.media(v.opts.posterKey) : null; return pm ? pm.caption : ''; }
		if (!cur) return ORION.t('maps.capChart', 'Schematic, not to scale. Illustration made for this site (procedural): sizes and distances are not real.');
		if (cur === 'theta7') {
			var idx = W.ORION_MODEL_INDEX && W.ORION_MODEL_INDEX.rock1;
			return ORION.t('maps.capTheta7', 'Illustration made for this site (procedural). Rocks: real in-game models from version {version}, lower-detail level (LOD 2) for the web, texture reduced to 512 px. Their placement is random.', { version: (idx && idx.version) || '0.6.1' });
		}
		if (cur === 'earth_orbit') return ORION.t('maps.capEarthOrbit', 'Illustration made for this site (procedural). Earth, clouds, city lights and debris are drawn for this site. Nothing here is a model from the game.');
		if (cur === 'luna') return ORION.t('maps.capLuna', 'Illustration made for this site (procedural). Terrain and Earth are drawn for this site. In the game Earth hangs about 68 degrees up; here it sits lower so it fits the frame.');
		if (cur === 'sol') return ORION.t('maps.capSol', 'Illustration made for this site (procedural). The Sun is drawn for this site, about 29 degrees across when first shown, as the game gives it. The surface detail is invented.');
		return ORION.t('maps.capGeneric', 'Illustration made for this site (procedural).');
	}
	function galKeys(id) { var m = mapById(id); return m ? mediaFor(m) : []; }

	function init(root, api) {
		var data = maps(); if (!data.length) return;
		S.root = root;
		var host = $('#maps-viewer', root), listEl = $('#maps-list', root), detail = $('#maps-detail', root), back = $('#maps-back', root), crumb = $('#maps-crumb', root), capEl = $('#maps-caption', root);
		if (!host || !listEl || !detail) return;
		S.markers = {};

		function tagsText(m) { return (m.tags || []).map(function (t) { return ORION.i18n.d(t); }).join(' · '); }
		/* list (the keyboard path and the fallback) */
		var itemBtns = S.itemBtns = {};
		data.forEach(function (m) {
			var b = el('button', { type: 'button', class: 'maps-item', 'data-map': m.id, 'aria-describedby': 'maps-howto' }, [
				el('span', { class: 'maps-item__title', text: m.title }), el('span', { class: 'maps-item__go', 'aria-hidden': 'true', text: ORION.t('maps.enter', 'Enter') }),
				el('span', { class: 'maps-item__tags', text: tagsText(m) })]);
			b.addEventListener('click', function () { select(S.cur === m.id ? S.cur : m.id, { opener: b }); });
			b.addEventListener('pointerenter', function () { setHot(m.id); }); b.addEventListener('pointerleave', function () { setHot(null); });
			b.addEventListener('focus', function () { setHot(m.id); }); b.addEventListener('blur', function () { setHot(null); });
			itemBtns[m.id] = b; listEl.append(el('li', null, b));
		});

		/* viewer layer: markers, badge, readout, loading note, Glasgow gallery */
		var hud = el('div', { class: 'maps-hud' }), badge = el('p', { class: 'maps-badge', text: ORION.t('maps.badge', 'Illustration · made for this site') }), readout = el('p', { class: 'maps-readout', hidden: true }), loading = el('p', { class: 'maps-loading', text: ORION.t('maps.loadingRocks', 'Loading rocks...'), hidden: true });
		data.forEach(function (m) {
			var b = el('button', { type: 'button', class: 'maps-marker', 'data-map': m.id, 'aria-label': ORION.t('maps.flyIn', 'Fly in to {title}', { title: m.title }) }, [el('span', { class: 'maps-marker__dot', 'aria-hidden': 'true' }), el('span', { class: 'maps-marker__label', 'aria-hidden': 'true', text: shortName(m) })]);
			b.addEventListener('click', function () { select(m.id, { opener: b }); });
			b.addEventListener('pointerenter', function () { setHot(m.id); }); b.addEventListener('pointerleave', function () { setHot(null); });
			b.addEventListener('focus', function () { setHot(m.id); }); b.addEventListener('blur', function () { setHot(null); });
			S.markers[m.id] = b; hud.append(b);
		});
		hud.append(badge, readout, loading);
		var gal = { box: el('div', { class: 'maps-gallery', hidden: true }), main: el('button', { type: 'button', class: 'maps-gallery__main' }), img: el('img', { alt: '', decoding: 'async' }), thumbs: el('div', { class: 'maps-gallery__thumbs', role: 'group', 'aria-label': ORION.t('maps.capturesGroup', 'Captures') }), badge: el('p', { class: 'maps-badge', text: '' }) };
		gal.main.append(gal.img); gal.box.append(gal.main, gal.thumbs, gal.badge);
		gal.main.addEventListener('click', function () { var ks = galKeys(S.galleryFor || S.cur); if (ks.length) ORION.ui.lightbox(ks, S.galI); });

		var loadRocks = true;   /* which of the two texts the (hidden) loading note carries; kept across a language switch so the English text is restored exactly */
		function paintLoading() { loading.textContent = loadRocks ? ORION.t('maps.loadingRocks', 'Loading rocks...') : ORION.t('maps.loadingView', 'Loading view...'); }
		S.loading = function (on) { loading.hidden = !on; loadRocks = S.cur === 'theta7'; paintLoading(); };
		function paintReadout() {
			var sm = mapById('sol'); readout.textContent = '';
			if (S.lastView === 'sol' && sm && sm.hazards && sm.hazards[0]) readout.append(el('b', { text: ORION.t('maps.hazard', 'Hazard') + ' ' }), ORION.i18n.d(sm.hazards[0]));
		}
		S.sceneFailed = function (id) { S.galleryFor = id; refreshGallery(); refreshCaption(); };
		S.viewArrived = function (view) {
			badge.hidden = false; readout.hidden = view !== 'sol';
			if (view === 'chart' && S.pendingFocus) {
				var pf = S.pendingFocus; S.pendingFocus = null;
				/* a marker is focusable only once the projector has made it visible again (one rendered frame after arrival, slow on software GL): retry a few times before falling back to the list button */
				var tries = 0;
				(function refocus() {
					var a = D.activeElement, mk = S.markers[pf];
					if (S.cur !== null || !(a === D.body || (S.root && S.root.contains(a)))) return;
					if (mk) mk.focus({ preventScroll: true });
					if (mk && D.activeElement === mk) return;
					if (++tries < 8) { setTimeout(refocus, 160); return; }
					if (S.itemBtns[pf]) S.itemBtns[pf].focus({ preventScroll: true });
				}());
			}
			S.lastView = view; paintReadout();
		};

		/* viewer */
		function viewLabel(id) {
			var m = id ? mapById(id) : null;
			if (!m) return ORION.t('maps.viewLabelChart', '3D chart of the five map locations: the Sun, Earth with the Moon, and the THETA-7 asteroid field. Schematic, not to scale.');
			return id === 'glasgow' ? ORION.t('maps.viewLabelGlasgow', 'In-game captures of {title}', { title: m.title }) : ORION.t('maps.viewLabelIllustration', '3D illustration of {title}, made for this site', { title: m.title });
		}
		var v = null;
		try {
			v = ORION.viewer(host, {
				name: 'maps', title: ORION.t('maps.viewerTitle', 'MAPS'), label: viewLabel(null),
				groupLabel: ORION.t('maps.viewerGroup', 'Maps chart and location views'), priority: 'section', posterKey: 'poster.maps', interactive: true,
				caption: capEl ? capEl.textContent : ORION.t('maps.captionStatic', 'Schematic, not to scale. Illustration made for this site.'),
				controls: { position: [14, 40, 100], target: [0, 0, -4], minDistance: 30, maxDistance: 260 }, setup: setupScene
			});
			S.v = v; v.layer().append(hud);
			new MutationObserver(function () { refreshCaption(); badge.hidden = !(v.isLive()); }).observe(host, { attributes: true, attributeFilter: ['data-state'] });
		} catch (e) { warn('viewer could not start; the list and captures still work', e); }
		host.append(gal.box);

		function refreshGallery() {
			var id = S.galleryFor, ks = id ? galKeys(id) : [];
			gal.box.hidden = !ks.length; if (!ks.length) return;
			S.galI = clamp(S.galI, 0, ks.length - 1);
			var me = ORION.media(ks[S.galI]); gal.img.src = me.src; gal.img.alt = me.alt || ''; gal.main.setAttribute('aria-label', ORION.t('maps.openCaptureFull', 'Open capture {n} of {total} full size: {alt}', { n: S.galI + 1, total: ks.length, alt: me.alt || '' }));
			gal.badge.textContent = ORION.t('maps.galleryBadge', 'In-game capture · version {version}', { version: me.version || '' });
			gal.thumbs.textContent = '';
			ks.forEach(function (k, i) {
				var mt = ORION.media(k), tb = el('button', { type: 'button', class: 'maps-gallery__thumb', 'aria-pressed': i === S.galI ? 'true' : 'false', 'aria-label': ORION.t('maps.showCapture', 'Show capture {n} of {total}', { n: i + 1, total: ks.length }) }, [el('img', { src: mt.src, alt: '', loading: 'lazy', decoding: 'async' })]);
				tb.addEventListener('click', function () { S.galI = i; refreshGallery(); refreshCaption(); });
				gal.thumbs.append(tb);
			});
			gal.thumbs.hidden = ks.length < 2;
		}
		function refreshCaption() { var t = captionText(); if (v) v.setCaption(t); else if (capEl) capEl.textContent = t; }
		function setHot(id) {
			S.hot = id;
			Object.keys(itemBtns).forEach(function (k) { itemBtns[k].classList.toggle('is-hot', k === id); S.markers[k].classList.toggle('is-hot', k === id); });
			if (S.view3d) S.view3d.hot(id);
		}

		/* panel */
		function renderDetail() {
			var m = S.cur ? mapById(S.cur) : null;
			detail.textContent = '';
			if (!m) {
				detail.append(el('h3', { id: 'maps-detail-title', tabindex: '-1', text: ORION.t('maps.choose', 'Choose a place') }),
					el('p', { class: 'maps-empty', text: ORION.t('maps.chooseHelp', 'Click a marker on the chart or pick a place from the list. You will see the game\'s own description, its gravity and hazards, and real captures from the game.') }),
					el('p', { class: 'maps-note', text: ORION.t('maps.fiveBuilt', 'Five maps are built: {names}.', { names: data.map(shortName).join(', ') }) }));
				return;
			}
			var ver = m.since === 'v0' ? 'v0' : m.since, D2 = ORION.i18n.d;
			var tags = el('div', { class: 'cluster' }, [ORION.ui.chip('built', ver)].concat((m.tags || []).map(function (t) { return el('span', { class: 'maps-tag', text: D2(t) }); })));
			var facts = el('dl', { class: 'maps-facts' });
			var gt = gravityText(m); if (gt) facts.append(el('dt', { text: ORION.t('maps.gravityLabel', 'Gravity') }), el('dd', null, [D.createTextNode(gt), ORION.ui.src(m.src && (m.src.gravityMs2 || m.src['*']))]));
			if (m.hazards && m.hazards.length) facts.append(el('dt', { text: ORION.t('maps.hazards', 'Hazards') }), el('dd', null, el('ul', null, m.hazards.map(function (h) { return el('li', { text: D2(h) }); }))));
			if (m.modes && m.modes.length) facts.append(el('dt', { text: ORION.t('maps.modes', 'Modes') }), el('dd', null, [el('ul', null, m.modes.map(function (h) { return el('li', { text: D2(h) }); })), ORION.ui.src(m.src && m.src.modes)]));
			var feats = el('ul', { class: 'maps-features' }, (m.features || []).map(function (f) { return el('li', null, [D.createTextNode(D2(f.text)), ORION.ui.src(f.src)]); }));
			var ks = mediaFor(m), caps = el('ul', { class: 'maps-caps' });
			ks.forEach(function (k, i) {
				var me = ORION.media(k), b = el('button', { type: 'button', class: 'maps-cap', 'aria-label': ORION.t('maps.openCapture', 'Open capture {n} of {total}: {alt}', { n: i + 1, total: ks.length, alt: me.alt || '' }) }, [
					el('img', { src: me.src, alt: '', loading: 'lazy', decoding: 'async', width: me.w, height: me.h }), el('span', { class: 'maps-cap__t', text: ORION.t('maps.captureLabel', 'In-game capture, version {version}', { version: me.version || '' }) })]);
				b.addEventListener('click', function () { S.galI = i; ORION.ui.lightbox(ks, i); });
				caps.append(el('li', null, b));
			});
			detail.append(el('h3', { id: 'maps-detail-title', tabindex: '-1', text: m.title }), tags, el('p', { text: D2(m.blurb) }), facts, feats,
				el('p', { class: 'maps-note', text: ORION.t('maps.onlineNote', 'Online multiplayer is not built yet. Single-player and LAN modes are.') }),
				el('h4', { class: 'maps-h', text: ks.length ? ORION.t('maps.realCaptures', 'Real captures') : ORION.t('maps.captures', 'Captures') }), ks.length ? caps : el('p', { class: 'maps-empty', text: ORION.t('maps.noCapture', 'No capture for this place yet.') }));
		}

		function paintCrumb(id) {
			var m = id ? mapById(id) : null; crumb.textContent = ''; crumb.append(ORION.t('maps.chart', 'Chart')); if (m) crumb.append(' / ', el('b', { text: shortName(m) }));
		}
		/* selection */
		function select(id, o) {
			o = o || {};
			if (id === S.cur && !o.force) { return; }
			var prev = S.cur; S.cur = id; S.pendingFocus = null; if (id && o.opener) S.openerKind = o.opener.classList && o.opener.classList.contains('maps-marker') ? 'marker' : 'list';
			Object.keys(itemBtns).forEach(function (k) { if (k === id) itemBtns[k].setAttribute('aria-current', 'true'); else itemBtns[k].removeAttribute('aria-current'); });
			var m = id ? mapById(id) : null;
			host.dataset.view = id || 'chart';
			S.galleryFor = id === 'glasgow' ? id : null; S.galI = id === 'glasgow' ? 1 : 0; /* lead with the clearer second capture (clamped if there is only one) */ refreshGallery();
			back.hidden = !id; paintCrumb(id);
			if (v) { v.setPoster(id ? (ORION.media('map.' + id + '.1') ? 'map.' + id + '.1' : 'poster.maps') : 'poster.maps'); v.setLabel(viewLabel(id)); }
			renderDetail(); refreshCaption();
			if (S.view3d) S.view3d.go(id, !!o.instant);
			if (!o.quiet) {
				ORION.ui.announce(id ? (id === 'glasgow' ? ORION.t('maps.announceGlasgow', '{title}. In-game captures. Press Escape or Back to chart to return.', { title: m.title }) : ORION.t('maps.announceIllustration', '{title}. Illustration made for this site. Press Escape or Back to chart to return.', { title: m.title })) : ORION.t('maps.announceBack', 'Back to the chart.'));
				var t = $('#maps-detail-title', detail);
				if (id) { if (t) t.focus({ preventScroll: true }); }
				else if (prev) { if (S.openerKind === 'marker' && v && v.isLive() && S.view3d) S.pendingFocus = prev; else if (itemBtns[prev]) itemBtns[prev].focus({ preventScroll: true }); }
			}
			ORION.bus.emit('maps:select', { id: id, from: prev });
		}
		S.select = select;
		back.addEventListener('click', function () { select(null); });
		root.addEventListener('keydown', function (e) {
			if (e.key !== 'Escape' || !S.cur || D.querySelector('.lightbox')) return;
			if (S.v && S.v.active) return;   /* the first Escape only releases scroll zoom (core) */
			e.preventDefault(); select(null);
		}, true);

		renderDetail(); refreshCaption();
		/* language switch (I18N.md 3.8): re-render everything this section drew, keeping the selected place, gallery position and focus */
		ORION.bus.on('lang', function () {
			data.forEach(function (m) {
				var b = itemBtns[m.id]; b.querySelector('.maps-item__go').textContent = ORION.t('maps.enter', 'Enter'); b.querySelector('.maps-item__tags').textContent = tagsText(m);
				S.markers[m.id].setAttribute('aria-label', ORION.t('maps.flyIn', 'Fly in to {title}', { title: m.title }));
			});
			badge.textContent = ORION.t('maps.badge', 'Illustration \u00b7 made for this site');
			paintLoading();
			gal.thumbs.setAttribute('aria-label', ORION.t('maps.capturesGroup', 'Captures'));
			paintCrumb(S.cur); paintReadout(); refreshGallery();
			ORION.ui.keepFocus(detail, function () { renderDetail(); });
			refreshCaption();
			if (v) v.setTexts({ label: viewLabel(S.cur), groupLabel: ORION.t('maps.viewerGroup', 'Maps chart and location views'), title: ORION.t('maps.viewerTitle', 'MAPS') });
		});
		root.classList.add('maps-ready');
		var q = new URLSearchParams(location.search).get('maps');
		if (q && mapById(q)) select(q, { instant: true, quiet: true });
		ORION.__maps = { state: S, select: select };
	}

	ORION.register('maps', { init: init });

	/* ------------------------------------------------------------------ ?selftest steps */
	function until(fn, ms) { return new Promise(function (res) { var t0 = Date.now(); (function tick() { var r; try { r = fn(); } catch (e) { r = false; } if (r || Date.now() - t0 > ms) res(!!r); else setTimeout(tick, 60); })(); }); }
	async function bringIntoView(root) {
		var h = $('#maps-viewer', root); if (!h) return;
		h.scrollIntoView({ block: 'center', behavior: 'instant' });
		await until(function () { return S.v && S.v.isLive() && S.view3d; }, 8000);
	}
	ORION.selftest.add('maps: list, chart -> location -> back for all five', async function () {
		var root = S.root; if (!root) return { ok: false, note: 'maps not initialised' };
		var data = maps(), btns = $$('.maps-item', root), notes = [], i, bad = [];
		await bringIntoView(root);
		if (btns.length !== 5) return { ok: false, note: 'list has ' + btns.length + ' buttons, expected 5' };
		for (i = 0; i < data.length; i++) {
			var m = data[i], b = btns[i];
			b.click();
			await new Promise(function (r) { setTimeout(r, 50); });
			var title = $('#maps-detail-title', root), backB = $('#maps-back', root);
			if (S.cur !== m.id) bad.push(m.id + ': state not set');
			if (!title || title.textContent !== m.title) bad.push(m.id + ': panel title');
			if (backB.hidden) bad.push(m.id + ': back hidden');
			if (D.activeElement !== title) bad.push(m.id + ': focus not on heading');
			if (m.gravityMs2 > 0 && $('#maps-detail', root).textContent.indexOf(locN(m.gravityMs2, 2)) < 0) bad.push(m.id + ': gravity text');
			if (m.id === 'glasgow') { if ($('.maps-gallery', root).hidden) bad.push('glasgow: captures not shown'); }
			else if (S.v && S.v.isLive()) { var settled = await until(function () { return S.view3d && S.view3d.view() === m.id; }, 6000); if (!settled) bad.push(m.id + ': camera did not arrive'); }
			var cap = ($('#maps-caption', root) || {}).textContent || '';
			if (ORION.i18n.lang === 'en' && !/Illustration made for this site|In-game capture/.test(cap)) bad.push(m.id + ': caption not labelled');
			backB.click();
			await new Promise(function (r) { setTimeout(r, 50); });
			if (S.cur !== null || !backB.hidden) bad.push(m.id + ': back did not return to chart');
			if (D.activeElement !== b && D.activeElement !== S.markers[m.id]) bad.push(m.id + ': focus not returned');
		}
		notes.push('5 locations entered and left' + (S.v && S.v.isLive() ? ' with the camera arriving each time' : ' (3D not live: list and captures only)'));
		var live = ORION.__debug && ORION.__debug.liveContexts ? ORION.__debug.liveContexts() : 0, budget = ORION.__debug && ORION.__debug.budget ? ORION.__debug.budget() : 9;
		if (live > budget) bad.push('live contexts ' + live + ' > budget ' + budget);
		return { ok: !bad.length, note: bad.length ? bad.join('; ') : notes.join('; ') };
	});
	ORION.selftest.add('maps: Escape returns, lightbox returns focus', async function () {
		var root = S.root; if (!root) return { ok: false, note: 'maps not initialised' };
		var bad = [], btn = $$('.maps-item', root)[0];
		await bringIntoView(root);
		btn.click(); await new Promise(function (r) { setTimeout(r, 80); });
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await new Promise(function (r) { setTimeout(r, 50); });
		if (S.cur !== null) bad.push('Escape did not return to the chart');
		btn.click(); await new Promise(function (r) { setTimeout(r, 80); });
		var cap = $('.maps-cap', root);
		if (!cap) bad.push('no capture button for ' + S.cur);
		else {
			cap.focus(); cap.click(); await new Promise(function (r) { setTimeout(r, 80); });
			var lb = $('.lightbox'); if (!lb) bad.push('lightbox did not open');
			else {
				D.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await new Promise(function (r) { setTimeout(r, 80); });
				if ($('.lightbox')) bad.push('lightbox did not close on Escape');
				if (D.activeElement !== cap) bad.push('focus did not return to the capture button');
				if (S.cur === null) bad.push('Escape in the lightbox also left the location');
			}
		}
		S.select(null); await new Promise(function (r) { setTimeout(r, 60); });
		return { ok: !bad.length, note: bad.length ? bad.join('; ') : 'Escape returns to the chart; the lightbox closes on Escape and focus returns to its opener' };
	});
	ORION.selftest.add('maps: marker opens a location, Back returns focus to the marker', async function () {
		var root = S.root; if (!root) return { ok: false, note: 'maps not initialised' };
		await bringIntoView(root);
		if (!(S.v && S.v.isLive() && S.view3d)) return { ok: true, note: 'skipped: 3D not live on this run (list path covered by the previous steps)' };
		var mk = S.markers.luna, bad = [];
		mk.focus(); mk.click(); await new Promise(function (r) { setTimeout(r, 60); });
		if (S.cur !== 'luna') bad.push('marker did not select luna');
		if (!(await until(function () { return S.view3d && S.view3d.view() === 'luna'; }, 6000))) bad.push('camera did not arrive');
		$('#maps-back', root).click();
		if (!(await until(function () { return S.view3d && S.view3d.view() === 'chart'; }, 6000))) bad.push('camera did not return to the chart');
		await until(function () { return D.activeElement === mk; }, 2500);
		if (D.activeElement !== mk) bad.push('focus is on ' + (D.activeElement && (D.activeElement.className || D.activeElement.tagName)));
		return { ok: !bad.length, note: bad.length ? bad.join('; ') : 'marker click flew in to COPERNICUS and Back returned focus to the marker' };
	});
}());
