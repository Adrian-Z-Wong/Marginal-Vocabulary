// 由 ts/ 下的 TypeScript 编译生成（cd ts && npm run build），请勿手动修改
"use strict";
(() => {
  // src/art/color.ts
  function hex2rgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  function rgb2hsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hsl2hex(h, s, l) {
    h = (h % 360 + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const f = (k) => {
      const kk = (k + h / 30) % 12;
      return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
    };
    return rgb2hex(f(0) * 255, f(8) * 255, f(4) * 255);
  }
  function hsl(hex) {
    return rgb2hsl(...hex2rgb(hex));
  }
  function toward(h, target, deg) {
    let d = (target - h + 540) % 360 - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), deg);
  }
  var rampCache = /* @__PURE__ */ new Map();
  function ramp(hex) {
    if (rampCache.has(hex)) return rampCache.get(hex);
    const [h, s, l] = hsl(hex);
    const r = {
      hi: hsl2hex(toward(h, 55, 10), s + 0.04, l + 0.11),
      base: hex,
      mid: hsl2hex(toward(h, 255, 8), s + 0.02, l - 0.09),
      lo: hsl2hex(toward(h, 255, 16), s + 0.04, l - 0.19),
      line: hsl2hex(toward(h, 275, 16), Math.min(0.6, s * 0.6 + 0.08), Math.max(0.09, l * 0.3))
    };
    rampCache.set(hex, r);
    return r;
  }
  function lighten(hex, a) {
    const [h, s, l] = hsl(hex);
    return hsl2hex(h, s, l + a);
  }
  function desat(hex, a) {
    const [h, s, l] = hsl(hex);
    return hsl2hex(h, s * (1 - a), l);
  }
  function mix(a, b, t) {
    const x = hex2rgb(a);
    const y = hex2rgb(b);
    return rgb2hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }

  // src/art/plants.ts
  function canopy(p, blobs, color, speck, dots) {
    const R = ramp(color);
    for (const [x, y, rx, ry] of blobs) p.ell(x + 1, y + 1.5, rx, ry, R.lo);
    for (const [x, y, rx, ry] of blobs) p.sEll(x, y, rx, ry, color);
    for (const [x, y, rx, ry] of blobs) p.ell(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.3, R.hi);
    const leaf = /* @__PURE__ */ new Set([R.lo, R.mid, R.base, R.hi, color]);
    let k = 0;
    for (let y = 1; y < p.h - 1; y++)
      for (let x = 1; x < p.w - 1; x++) {
        const c = p.get(x, y);
        if (c !== R.base && c !== R.mid) continue;
        const hsh = (x * 73856093 ^ y * 19349663 ^ k++ * 0) >>> 0;
        if (hsh % 23 === 0 && leaf.has(p.get(x + 1, y)) && leaf.has(p.get(x - 1, y))) {
          p.set(x - 1, y, R.hi);
          p.set(x, y - 1, R.hi);
          p.set(x + 1, y, R.hi);
          p.set(x, y + 1, R.lo);
        }
      }
    const cut = [];
    const add = [];
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const c = p.get(x, y);
        const hsh = (x * 2654435761 ^ y * 40503) >>> 0;
        if (leaf.has(c)) {
          const edge = !p.get(x, y - 1) || !p.get(x - 1, y) || !p.get(x + 1, y);
          if (edge && hsh % 4 === 0) cut.push([x, y]);
        } else if (!c) {
          const n = p.get(x, y + 1);
          if (n && leaf.has(n) && hsh % 5 === 0) add.push([x, y]);
        }
      }
    for (const [x, y] of cut) p.clear(x, y);
    for (const [x, y] of add) p.set(x, y, R.base);
    if (speck) for (const [x, y] of speck) p.set(x, y, R.hi);
    if (dots) for (const [x, y, c] of dots) {
      p.rect(x, y, 2, 2, c);
      p.set(x, y, lighten(c, 0.15));
    }
  }
  var ROUND = [[16, 23, 12, 8], [8, 17, 7, 7], [24, 17, 7, 7], [16, 11, 9, 8], [11, 9, 5, 4], [21, 9, 5, 4]];
  var SPECK = [[12, 14], [19, 12], [9, 21], [25, 22], [16, 26]];
  var TREE_SPECS = {
    oak: { shape: "round", leaf: "#5f9e4f" },
    apple: { shape: "round", leaf: "#5c9a4a", dots: "#d64545" },
    orange: { shape: "round", leaf: "#4f8f45", dots: "#f29a2e" },
    peach: { shape: "round", leaf: "#68a552", dots: "#f6a07a", blossom: "#f7c1cf" },
    sakura: { shape: "round", leaf: "#f2a6c0", trunk: "#7a4a3a", dots: "#fbd3e0", petals: "#f2a6c0" },
    jacaranda: { shape: "round", leaf: "#9b8be0", trunk: "#6e5040", dots: "#c3b6f2", petals: "#a99ae6" },
    maple: { shape: "maple", leaf: "#e0663a", trunk: "#7a4a3a", dots: "#f2a24a" },
    ginkgo: { shape: "fan", leaf: "#f2c14e", dots: "#f7dc85" },
    birch: { shape: "oval", leaf: "#8cc36a", trunk: "#efeae0", marks: "#3a3a3a" },
    willow: { shape: "willow", leaf: "#8cbf5a", trunk: "#7a5a3a" },
    wisteria: { shape: "wisteria", leaf: "#6aa35a", trunk: "#7a5a3a", hang: "#9b7fd1" },
    // 开花的树没有叶子
    plum: { shape: "blossom", trunk: "#4a3530", flower: "#e85d75", center: "#f6d35b" },
    magnolia: { shape: "blossom", trunk: "#6a5040", flower: "#f8e8f0", center: "#e8a0c0" },
    pine: { shape: "pine", leaf: "#3f7d4f" },
    cypress: { shape: "column", leaf: "#3f6f4a" },
    palm: { shape: "palm", leaf: "#5aa05a" },
    bamboo: { shape: "bamboo", leaf: "#6aa35a" },
    cactus: { shape: "cactus", leaf: "#5f9e4f" }
  };
  function leafClumps(p, blobs, color, o) {
    o = o || {};
    const R = ramp(color);
    const r = o.r || 4;
    const inMask = (x, y) => blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [cx, cy, rx, ry] of blobs) {
      x0 = Math.min(x0, cx - rx);
      y0 = Math.min(y0, cy - ry);
      x1 = Math.max(x1, cx + rx);
      y1 = Math.max(y1, cy + ry);
    }
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) if (inMask(x, y)) p.set(x, y, R.lo);
    const seed = o.seed || 1;
    const hsh = (a, b) => {
      let h = a * 374761393 + b * 668265263 + seed * 2246822519 | 0;
      h = Math.imul(h ^ h >>> 13, 1274126177);
      return ((h ^ h >>> 16) >>> 0) / 4294967296;
    };
    const step = r * 1.3;
    const pts = [];
    let row = 0;
    for (let y = y0 + r * 0.6; y <= y1; y += step * 0.78, row++)
      for (let x = x0 + (row % 2 ? step / 2 : 0) + r * 0.4; x <= x1; x += step) {
        const jx = x + (hsh(row, Math.round(x)) - 0.5) * r * 0.7;
        const jy = y + (hsh(Math.round(x), row + 9) - 0.5) * r * 0.6;
        if (inMask(jx, jy)) pts.push([jx, jy]);
      }
    pts.sort((a, b) => a[1] - b[1]);
    const H = Math.max(1, y1 - y0);
    for (const [cx, cy] of pts) {
      const t = (cy - y0) / H;
      const rr = r * (0.9 + hsh(Math.round(cx * 3), Math.round(cy * 3)) * 0.25);
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++)
        for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
          const nx = (x + 0.5 - cx) / rr;
          const ny = (y + 0.5 - cy) / rr;
          const d = nx * nx + ny * ny;
          if (d > 1) continue;
          if (!inMask(x, y) && d > 0.6) continue;
          const lit = -(nx * 0.6 + ny * 0.8);
          let c = t > 0.72 ? R.mid : color;
          if (lit > 0.42 && d < 0.85) c = t < 0.6 ? R.hi : color;
          else if (lit < -0.3) c = t > 0.45 ? R.lo : R.mid;
          else if (lit < 0.05 && t > 0.55) c = R.mid;
          p.set(x, y, c);
        }
      if (t < 0.7) {
        p.set(Math.round(cx - rr * 0.35), Math.round(cy - rr * 0.45), lighten(R.hi, 0.06));
        if (rr > 3) p.set(Math.round(cx - rr * 0.1), Math.round(cy - rr * 0.6), R.hi);
      }
    }
    if (o.dots)
      for (const [x, y, c] of o.dots) {
        p.rect(x, y, 2, 2, c);
        p.set(x, y, lighten(c, 0.18));
        p.set(x + 1, y + 1, ramp(c).mid);
      }
  }
  function trunkS(p, S, color, top, w, marks) {
    const R = ramp(color);
    const base = Math.round(46 * S);
    const yTop = Math.round(top * S);
    const cx = 16 * S;
    for (let y = yTop; y <= base; y++) {
      const t = (y - yTop) / Math.max(1, base - yTop);
      const flare = t > 0.7 ? Math.pow((t - 0.7) / 0.3, 2) * 2.4 * S : 0;
      const ww = (w - 0.8) * S + t * 0.8 * S + flare * 2;
      const xa = Math.round(cx - ww / 2);
      const xb = Math.round(cx + ww / 2) - 1;
      for (let x = xa; x <= xb; x++) {
        const u = (x - xa) / Math.max(1, xb - xa);
        let c = u < 0.25 ? R.hi : u > 0.72 ? R.mid : color;
        if (u > 0.88) c = R.lo;
        if (!marks && (x * 7 + Math.floor(y / 3) * 3) % 9 === 0 && u > 0.2 && u < 0.85) c = R.mid;
        if (marks && (y * 5 + x * 3) % 11 === 0) c = marks;
        if (y - yTop < 2 * S) c = mix(c, R.lo, 0.55);
        p.set(x, y, c);
      }
    }
  }
  function drawTree(p, sp, S) {
    const t = typeof sp === "string" ? TREE_SPECS[sp] || TREE_SPECS.oak : sp;
    const q = (v) => v * S;
    const B = (list) => list.map(([x, y, rx, ry]) => [q(x), q(y), q(rx), q(ry)]);
    const TR = t.trunk || "#8a5a3b";
    const shade2 = (rx) => p.ell(q(16), q(46) - 0.5, q(rx), 2.2 * S, "rgba(40,30,20,.24)");
    const stem = (top, _h, w) => trunkS(p, S, TR, top, w || 5, t.marks);
    const canopy2 = (blobs, color, _speck, dts) => leafClumps(p, blobs, color, { r: 4.2 * S, dots: dts, seed: color.length + blobs.length });
    const speck = (list) => list.map(([x, y]) => [Math.round(q(x)), Math.round(q(y))]);
    const dots = (list, c) => c ? list.map(([x, y]) => [Math.round(q(x)), Math.round(q(y)), c]) : null;
    const DOTS = [[9, 15], [21, 12], [16, 21], [24, 21], [12, 24], [17, 8], [7, 20], [26, 15]];
    switch (t.shape) {
      case "round":
      case "maple":
      case "fan":
      case "oval": {
        shade2(t.shape === "oval" ? 8 : 11);
        const top = t.shape === "oval" ? 26 : 30;
        stem(top, 0, t.shape === "oval" ? 4 : 5);
        const blobs = t.shape === "maple" ? [[16, 22, 12, 8], [7, 16, 6, 6], [25, 16, 6, 6], [16, 10, 9, 8], [16, 4, 4, 3]] : t.shape === "fan" ? [[16, 24, 12, 7], [16, 16, 10, 7], [16, 9, 7, 6], [16, 4, 4, 3]] : t.shape === "oval" ? [[16, 22, 9, 7], [16, 14, 9, 8], [11, 18, 5, 5], [21, 18, 5, 5], [16, 7, 6, 5]] : ROUND;
        canopy2(B(blobs), t.leaf, speck(SPECK), dots(DOTS.slice(0, S > 1 ? 8 : 6), t.dots));
        if (t.blossom) for (const [x, y] of [[11, 11], [20, 17], [14, 25], [23, 9]]) p.ell(q(x), q(y), 1.2 * S, 1.2 * S, t.blossom);
        if (t.petals) for (const [x, y] of [[5, 41], [26, 43], [9, 45], [22, 46], [29, 39]]) p.set(Math.round(q(x)), Math.round(q(y)), t.petals);
        break;
      }
      case "willow": {
        shade2(12);
        stem(26, 0, 5);
        canopy2(B([[16, 16, 12, 8], [10, 12, 7, 6], [22, 12, 7, 6], [16, 8, 8, 6]]), t.leaf);
        const R = ramp(t.leaf);
        for (let x = Math.round(q(5)); x <= Math.round(q(27)); x += S > 1 ? 2 : 2) {
          const y0 = Math.round(q(18 + Math.abs(16 - x / S) * 0.25));
          const len = Math.round(q(14 + x * 7 % 9));
          for (let y = y0; y < Math.min(y0 + len, q(44)); y++) p.set(x + (y % 7 === 0 ? 1 : 0), y, y > y0 + len - 3 ? R.hi : (x + y) % 3 ? R.base : R.mid);
        }
        break;
      }
      case "wisteria": {
        shade2(12);
        stem(28, 0, 5);
        canopy2(B([[16, 18, 13, 8], [9, 13, 7, 6], [23, 13, 7, 6], [16, 9, 9, 6]]), t.leaf);
        const H = ramp(t.hang);
        for (const [x, y, n] of [[6, 20, 9], [10, 23, 11], [14, 24, 8], [18, 24, 12], [22, 23, 9], [26, 20, 10], [12, 15, 6], [21, 15, 6]]) {
          for (let k = 0; k < n * S; k++) {
            const w = Math.max(1, Math.round((1 - k / (n * S)) * 1.6 * S));
            p.rect(Math.round(q(x)) - Math.floor(w / 2), Math.round(q(y)) + k, w, 1, k % 3 === 0 ? H.hi : k % 3 === 1 ? t.hang : H.mid);
          }
        }
        break;
      }
      case "blossom": {
        shade2(10);
        stem(26, 0, 4);
        const R = ramp(t.trunk);
        for (const [x1, y1, x2, y2] of [[16, 28, 7, 12], [16, 27, 25, 10], [16, 26, 16, 4], [11, 19, 4, 14], [21, 18, 28, 16], [16, 15, 11, 6], [16, 14, 21, 5]]) {
          p.line(q(x1), q(y1), q(x2), q(y2), t.trunk);
          if (S > 1) p.line(q(x1) + 1, q(y1), q(x2) + 1, q(y2), R.mid);
        }
        const spots = [[7, 12], [4, 14], [25, 10], [28, 16], [16, 4], [11, 6], [21, 5], [9, 16], [22, 13], [13, 10], [19, 9], [14, 18], [18, 17], [6, 9], [26, 7], [16, 11]];
        leafClumps(p, spots.map(([x, y]) => [q(x), q(y), 2.3 * S, 2 * S]), t.flower, { r: 1.7 * S, seed: 7 });
        for (const [x, y] of spots) {
          p.set(Math.round(q(x)), Math.round(q(y)), t.center);
          if (S > 1) p.set(Math.round(q(x)) + 2, Math.round(q(y)) + 1, t.center);
        }
        for (const [x, y] of [[6, 42], [24, 44], [11, 45]]) p.set(Math.round(q(x)), Math.round(q(y)), t.flower);
        break;
      }
      case "pine":
      case "column": {
        shade2(t.shape === "column" ? 7 : 10);
        stem(36, 0, 4);
        const G3 = t.leaf;
        const R = ramp(G3);
        if (t.shape === "column") {
          canopy2(B([[16, 31, 6.5, 8], [16, 22, 7, 9], [16, 13, 5.5, 8], [16, 5, 3.5, 4.5]]), G3, speck([[14, 12], [15, 20], [14, 28]]));
          break;
        }
        for (const [by, hw, h] of [[37, 14.5, 13], [29, 12, 12], [21, 9.5, 11], [13, 6.5, 11]]) {
          const yb = Math.round(q(by));
          const yt = Math.round(q(by - h));
          const cx = q(16);
          for (let y = yt; y <= yb; y++) {
            const tt = (y - yt) / Math.max(1, yb - yt);
            const half = q(hw) * Math.pow(tt, 0.85) + 0.5 + (y * 7 % 3 === 0 ? 0.8 : 0);
            for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
              const u = (x - (cx - half)) / (2 * half);
              let c = u < 0.3 ? R.hi : u < 0.62 ? G3 : u < 0.85 ? R.mid : R.lo;
              if (yb - y < 1.4 * S) c = u < 0.4 ? R.mid : R.lo;
              if ((x * 5 + y * 3) % 13 === 0 && u < 0.6 && yb - y > 2) c = lighten(R.hi, 0.05);
              p.set(x, y, c);
            }
          }
          for (let x = Math.round(cx - q(hw)); x <= cx + q(hw); x += Math.max(2, Math.round(2.2 * S))) {
            p.set(x, yb + 1, R.lo);
            if (S > 1) p.set(x, yb + 2, R.lo);
          }
        }
        p.set(Math.round(q(16)), Math.round(q(1)), R.hi);
        break;
      }
      case "palm": {
        shade2(9);
        const T = "#a77b52";
        for (let y = Math.round(q(14)); y < q(46); y++) {
          const x = Math.round(q(14) + Math.sin((y / S - 14) / 9) * 2 * S);
          p.rect(x, y, Math.round(4 * S), 1, y % 3 ? ramp(T).base : ramp(T).mid);
          p.set(x + Math.round(4 * S) - 1, y, ramp(T).lo);
        }
        const F = t.leaf;
        for (const [x1, y1, x2, y2] of [[16, 13, 3, 18], [16, 13, 29, 18], [16, 12, 6, 6], [16, 12, 26, 5], [16, 12, 16, 2], [16, 13, 1, 12], [16, 13, 31, 12]]) {
          for (let k = 0; k < S; k++) {
            p.line(q(x1), q(y1) + k, q(x2), q(y2) + k, F);
            p.line(q(x1), q(y1) + 1 + k, q(x2), q(y2) + 1 + k, ramp(F).mid);
          }
          p.line(q((x1 + x2) / 2), q((y1 + y2) / 2) + 1, q((x1 + x2) / 2 + (x2 > x1 ? 1 : -1)), q((y1 + y2) / 2 + 3), ramp(F).lo);
        }
        p.sEll(q(14), q(15), 2 * S, 2 * S, "#6b4a2b");
        p.sEll(q(18), q(15), 2 * S, 2 * S, "#6b4a2b");
        break;
      }
      case "bamboo": {
        shade2(10);
        const G3 = t.leaf;
        for (const [x, top] of [[8, 14], [14, 4], [21, 10]]) {
          p.sRect(Math.round(q(x)), Math.round(q(top)), Math.round(3 * S), Math.round(q(46) - q(top)), G3, { noHi: true });
          for (let y = top + 6; y < 44; y += 7) p.rect(Math.round(q(x)), Math.round(q(y)), Math.round(3 * S), 1, ramp(G3).lo);
          p.poly([[q(x + 3), q(top + 7)], [q(x + 9), q(top + 3)], [q(x + 4), q(top + 9)]], ramp(G3).hi);
          p.poly([[q(x), q(top + 13)], [q(x - 6), q(top + 10)], [q(x - 1), q(top + 15)]], ramp(G3).base);
        }
        break;
      }
      case "cactus": {
        shade2(9);
        const C = t.leaf;
        p.sRect(Math.round(q(12)), Math.round(q(12)), Math.round(q(8)), Math.round(q(34)), C);
        p.sRect(Math.round(q(4)), Math.round(q(20)), Math.round(q(5)), Math.round(q(12)), C);
        p.sRect(Math.round(q(5)), Math.round(q(29)), Math.round(q(8)), Math.round(q(4)), C);
        p.sRect(Math.round(q(23)), Math.round(q(16)), Math.round(q(5)), Math.round(q(13)), C);
        p.sRect(Math.round(q(19)), Math.round(q(26)), Math.round(q(6)), Math.round(q(4)), C);
        for (let y = 14; y < 44; y += 4) {
          p.set(Math.round(q(14)), Math.round(q(y)), ramp(C).hi);
          p.set(Math.round(q(17)), Math.round(q(y + 2)), ramp(C).lo);
        }
        p.sEll(q(16), q(11), 3 * S, 2.4 * S, "#ef7fa0");
        p.set(Math.round(q(16)), Math.round(q(11)), "#f6d35b");
        break;
      }
    }
  }
  function treeSeed(p) {
    p.ell(8, 13.5, 5.5, 2.4, "#7a5238");
    p.ell(8, 12.8, 4.5, 1.8, "#8a5e40");
    p.sEll(8, 11.5, 1.6, 1.3, "#c8a06a");
  }
  function treeSprout(p, sp) {
    const t = TREE_SPECS[sp] || TREE_SPECS.oak;
    p.ell(8, 14, 4.5, 1.6, "#7a5238");
    p.rect(8, 8, 1, 6, "#5f8a42");
    const leaf = t.shape === "cactus" ? t.leaf : "#6aa35a";
    p.sEll(5.5, 8, 2.6, 1.6, leaf);
    p.sEll(10.5, 7, 2.6, 1.6, leaf);
  }
  function treeSapling(p, sp) {
    const t = TREE_SPECS[sp] || TREE_SPECS.oak;
    p.ell(8, 30.5, 5, 1.5, "rgba(40,30,20,.22)");
    p.sRect(7, 16, 2, 15, t.trunk && t.shape !== "blossom" ? t.trunk : "#8a5a3b", { noHi: true });
    const c = t.shape === "blossom" ? "#6aa35a" : t.leaf;
    canopy(p, [[8, 14, 5, 4], [4.5, 18, 3, 2.4], [11.5, 17, 3, 2.4], [8, 9, 3.5, 3]], c);
    if (t.shape === "blossom") for (const [x, y] of [[6, 12], [10, 10], [9, 16]]) p.set(x, y, t.flower);
  }
  var forestCacheSpecs = {
    round: { shape: "round", leaf: "#4f8f42", trunk: "#6a4632" },
    round2: { shape: "oval", leaf: "#4a8a4a", trunk: "#6a4632" },
    round3: { shape: "maple", leaf: "#4f8f42", trunk: "#6a4632" },
    pine: { shape: "pine", leaf: "#2f6a45", trunk: "#6a4632" }
  };
  var FLOWERS = {
    tulip: { c: "#e85d75", bloom: ["h.b.m", "hbhbm", "bbbbm", "mbbml", ".mml."], at: [[2, 4], [9, 1], [6, 7]] },
    rose: { c: "#ef7fa0", bloom: [".hbb.", "hbmhm", "bmhml", "mbmbl", ".mll."], at: [[1, 5], [9, 2], [6, 0]] },
    daisy: { c: "#fbf7ef", bloom: ["..w.w..", ".wwwww.", "wwyyyww", ".wyYyW.", "wwyYYWW", ".wWWWW.", "..W.W.."], at: [[0, 4], [8, 1]] },
    sunflower: { c: "#f6c33b", tall: true, bloom: ["..y.y.y..", ".yyyyyyy.", "yyKkkkKyy", ".yKkKkkY.", "yyKkkkKYy", ".yKkkKkY.", "yyKKkKKYy", ".yYYYYYY.", "..Y.Y.Y.."], at: [[3, 0]] },
    lavender: { c: "#9b7fd1", spikes: [[4, 3], [8, 1], [12, 4]] },
    bluebell: { c: "#5a8fe0", bells: [[3, 6], [6, 8], [10, 4], [13, 6]] }
  };
  var LEAF = "#5f9e4f";
  var STEM = "#4a8a3c";
  function soilMound(p) {
    const H = p.h;
    p.ell(8, H - 2.2, 5.2, 1.7, "#7a5238");
    p.ell(8, H - 2.7, 4.2, 1.1, "#8a6244");
    p.set(6, H - 2, "#5e3e2a");
    p.set(10, H - 2, "#5e3e2a");
  }
  function leafPair(p, big) {
    const H = p.h;
    const L = ramp(LEAF);
    const w = big ? 7 : 5;
    p.poly([[8, H - 2], [8 - w, H - 7], [8 - w + 1, H - 5], [7, H - 3]], LEAF);
    p.line(8 - w + 1, H - 6, 7, H - 3, L.hi);
    p.poly([[9, H - 2], [8 + w, H - 8], [8 + w - 1, H - 5], [10, H - 3]], L.mid);
    p.line(9, H - 3, 8 + w - 1, H - 7, L.base);
  }
  function bloomAt(p, map, x0, y0, c) {
    const R = ramp(c);
    const col = { h: R.hi, b: c, m: R.mid, l: R.lo, w: "#fbf7ef", W: "#d8d0c4", y: "#f6c33b", Y: "#d89a2a", k: "#7a4a2a", K: "#5a3420" };
    map.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== ".") p.set(x0 + i, y0 + j, col[row[i]]);
    });
  }
  function flower(p, kind, stage) {
    const F = FLOWERS[kind] || FLOWERS.tulip;
    const H = p.h;
    const R = ramp(F.c);
    soilMound(p);
    if (stage === 0) {
      p.set(7, H - 3, "#e8d8b0");
      p.set(9, H - 3, "#e8d8b0");
      return;
    }
    if (stage === 1) {
      p.line(8, H - 2, 8, H - 6, STEM);
      p.poly([[8, H - 5], [4, H - 8], [5, H - 5]], LEAF);
      p.poly([[9, H - 6], [13, H - 9], [12, H - 6]], ramp(LEAF).mid);
      return;
    }
    leafPair(p, F.tall);
    const heads = F.spikes || F.bells || F.at;
    const size = F.bloom ? [F.bloom[0].length, F.bloom.length] : [2, 2];
    for (const [x, y] of heads) {
      const tx = F.bloom ? x + Math.floor(size[0] / 2) : x;
      const ty = F.bloom ? y + size[1] - 1 : y + 2;
      p.line(8, H - 3, tx, ty, STEM);
    }
    if (stage === 2) {
      for (const [x, y] of heads) {
        const tx = F.bloom ? x + Math.floor(size[0] / 2) : x;
        const ty = F.bloom ? y + size[1] - 2 : y + 1;
        p.sEll(tx + 0.5, ty, 1.6, 2, ramp(LEAF).mid);
        p.set(tx, ty - 2, F.c);
        p.set(tx + (F.tall ? 1 : 0), ty - 1, R.hi);
      }
      return;
    }
    if (F.bloom) for (const [x, y] of F.at) bloomAt(p, F.bloom, x, y, F.c);
    if (F.spikes)
      for (const [x, y] of F.spikes)
        for (let k = 0; k < 7; k++) {
          const c = k < 2 ? R.hi : k % 2 ? R.mid : F.c;
          p.set(x + k % 2, y + k, c);
          p.set(x + 1 - k % 2, y + k, k % 2 ? F.c : R.mid);
        }
    if (F.bells)
      for (const [x, y] of F.bells) {
        bloomAt(p, [".h.", "hbm", "bbm", "m.l"], x - 1, y, F.c);
      }
  }
  var SHRUBS = {
    bush: { c: "#5f9e4f" },
    berry: { c: "#4f8a43", dots: "#d64545" },
    hydrangea: { c: "#5c9a4a", dots: "#8aa8e8", big: true }
  };
  function shrub(p, kind, stage) {
    const S = SHRUBS[kind] || SHRUBS.bush;
    p.ell(8, 14.5, 6.5, 1.5, "rgba(40,30,20,.22)");
    if (stage === 0) {
      soilMound(p);
      p.line(8, 13, 8, 10, STEM);
      p.poly([[8, 11], [5, 9], [6, 11]], LEAF);
      p.poly([[9, 11], [12, 9], [11, 11]], ramp(LEAF).mid);
      return;
    }
    if (stage === 1) {
      leafClumps(p, [[8, 11, 4.6, 3.4], [6, 9.5, 2.6, 2.2], [10.5, 9.5, 2.6, 2.2]], S.c, { r: 2.1, seed: 3 });
      return;
    }
    leafClumps(p, [[8, 10.5, 7, 4.4], [4.5, 8, 3.6, 3.2], [11.5, 7.5, 3.8, 3.4], [8, 6.5, 3.6, 3]], S.c, { r: 2.5, seed: kind.length });
    if (S.dots && S.big) leafClumps(p, [[4, 7, 2.2, 1.9], [9, 5, 2.4, 2], [12, 9, 2.2, 1.9], [6, 10, 2, 1.8]], S.dots, { r: 1.3, seed: 5 });
    else if (S.dots)
      for (const [x, y] of [[4, 8], [8, 6], [11, 9], [6, 11], [12, 7], [9, 10]]) {
        p.set(x, y, S.dots);
        p.set(x + 1, y, ramp(S.dots).mid);
        p.set(x, y - 1, lighten(S.dots, 0.2));
      }
  }
  var GRASSES = {
    clover: { c: "#5fae4a" },
    foxtail: { c: "#7ba84a", head: "#c8c27a" },
    fountain: { c: "#6a9e4a", head: "#e0a8b8", tall: true },
    pampas: { c: "#8aa86a", head: "#f2ead2", tall: true }
  };
  function grassPlant(p, kind, stage) {
    const G3 = GRASSES[kind] || GRASSES.clover;
    const H = p.h;
    const R = ramp(G3.c);
    if (stage === 0) {
      p.ell(8, H - 2.5, 4.5, 1.8, "#7a5238");
      p.ell(8, H - 3, 3.5, 1.2, "#8a5e40");
      p.set(7, H - 3, "#e8d8b0");
      p.set(9, H - 3, "#e8d8b0");
      return;
    }
    p.ell(8, H - 1.5, 5.5, 1.3, "rgba(40,30,20,.22)");
    const blade = (x0, h, lean, c) => {
      let x = x0;
      for (let k = 0; k < h; k++) {
        const t = k / h;
        x = x0 + lean * t * t * h * 0.5;
        p.set(Math.round(x), H - 2 - k, k < 2 ? R.lo : t > 0.8 ? R.hi : c || (k % 3 ? G3.c : R.mid));
      }
      return [Math.round(x), H - 2 - h];
    };
    if (stage === 1) {
      blade(7, 4, -0.6);
      blade(8, 5, 0.2);
      blade(9, 4, 0.7);
      return;
    }
    if (kind === "clover") {
      for (const [cx, cy] of [[5, H - 4], [10, H - 5], [7.5, H - 7.5], [11.5, H - 2.5], [4, H - 2]]) {
        for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, -1.2]]) p.ell(cx + dx, cy + dy, 1.3, 1.2, G3.c);
        p.set(Math.round(cx - 1), Math.round(cy - 1), R.hi);
        p.set(Math.round(cx), Math.round(cy + 1), R.lo);
      }
      p.rect(9, H - 10, 1, 4, R.mid);
      p.ell(9.5, H - 11, 1.6, 1.6, "#fbf7ef");
      p.set(9, H - 11, "#f2d0dc");
      return;
    }
    const n = G3.tall ? 8 : 6;
    const top = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const h = (G3.tall ? 9 : 7) + Math.round((1 - Math.abs(t) * 1.6) * 3);
      top.push(blade(8 + Math.round(t * 4), h, t * 2.6, i % 2 ? G3.c : R.mid));
    }
    if (kind === "foxtail") {
      for (const [x0, h, lean] of [[6, 11, -1.2], [8, 13, 0.4], [10, 10, 1.4]]) {
        const [x, y] = blade(x0, h, lean, R.mid);
        const d = lean < 0 ? -1 : 1;
        for (let k = 0; k < 4; k++) {
          p.set(x + d * Math.floor(k / 2), y - 1 + k, G3.head);
          p.set(x + d * Math.floor(k / 2) + 1, y - 1 + k, ramp(G3.head).mid);
        }
        p.set(x, y - 2, ramp(G3.head).hi);
      }
      return;
    }
    const stalks = kind === "pampas" ? [[6, 19, -1.4], [8, 21, 0.2], [10, 18, 1.5]] : [[5, 12, -2.4], [8, 14, 0.3], [11, 12, 2.6]];
    for (const [x0, h, lean] of stalks) {
      const [x, y] = blade(x0, h, lean, R.mid);
      const len = kind === "pampas" ? 7 : 5;
      const w = kind === "pampas" ? 3 : 2;
      for (let k = 0; k < len; k++) {
        const ww = k === 0 || k === len - 1 ? w - 1 : w;
        const xx = x - Math.floor(ww / 2) + Math.round(lean * 0.3 * (k / len));
        for (let i = 0; i < ww; i++) p.set(xx + i, y - k, (k + i) % 3 === 0 ? ramp(G3.head).mid : i === 0 ? ramp(G3.head).hi : G3.head);
      }
    }
  }

  // src/art/decor.ts
  function bStone(p, x0, y0, w, h, c, brick) {
    const R = ramp(c);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const row = Math.floor((y - y0) / 4);
        const off = row % 2 ? brick ? 3 : 5 : 0;
        const bw = brick ? 6 : 10;
        let col = c;
        if ((y - y0) % 4 === 3) col = R.lo;
        else if ((x - x0 + off) % bw === 0) col = R.lo;
        else if ((y - y0) % 4 === 0) col = R.hi;
        p.set(x, y, col);
      }
  }
  function bLogs(p, x0, y0, w, h, c) {
    const R = ramp(c);
    for (let y = y0; y < y0 + h; y++) {
      const k = (y - y0) % 6;
      p.rect(x0, y, w, 1, k === 0 ? R.hi : k === 5 ? R.lo : k === 4 ? R.mid : c);
    }
    for (let y = y0; y < y0 + h; y += 6) {
      for (const x of [x0 - 2, x0 + w - 4]) {
        p.ell(x + 3, y + 3, 3, 3, "#c9a070");
        p.ell(x + 3, y + 3, 1.6, 1.6, "#a87e52");
        p.set(x + 3, y + 3, "#8a6440");
      }
    }
    for (let y = y0 + 2; y < y0 + h; y += 6) for (let x = x0 + 8 + y / 6 % 3 * 9; x < x0 + w - 6; x += 27) p.rect(x, y, 4, 1, R.mid);
  }
  function bPlanks(p, x0, y0, w, h, c) {
    const R = ramp(c);
    for (let y = y0; y < y0 + h; y++) {
      const k = (y - y0) % 5;
      p.rect(x0, y, w, 1, k === 0 ? R.hi : k === 4 ? R.mid : c);
    }
  }
  function bPlaster(p, x0, y0, w, h, c) {
    const R = ramp(c);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const n = (x * 73856093 ^ y * 19349663) >>> 0;
        p.set(x, y, n % 23 === 0 ? R.mid : n % 31 === 0 ? R.hi : c);
      }
  }
  function bShingles(p, inRoof, top, eave, c, rowH, off) {
    const R = ramp(c);
    for (let y = top; y < eave; y++)
      for (let x = -2; x < p.w + 2; x++) {
        if (!inRoof(x, y)) continue;
        const row = Math.floor((y - top) / rowH);
        const ry = (y - top) % rowH;
        const tab = (x + (row % 2 ? Math.floor(rowH * 0.8) : 0) + off) % (rowH * 2);
        let col = c;
        if (ry === rowH - 1) col = R.lo;
        else if (tab === 0) col = R.mid;
        else if (ry === 0 && tab < rowH) col = R.hi;
        p.set(x, y, col);
      }
  }
  function bTiles(p, inRoof, top, eave, c) {
    const R = ramp(c);
    for (let y = top; y < eave; y++)
      for (let x = -2; x < p.w + 2; x++) {
        if (!inRoof(x, y)) continue;
        const u = x % 5;
        let col = u === 0 ? R.lo : u === 1 ? R.hi : u === 4 ? R.mid : c;
        if ((y - top) % 6 === 5) col = R.lo;
        p.set(x, y, col);
      }
  }
  function bRoofEdge(p, cx, top, eave, half, c) {
    for (let y = top - 1; y < eave + 1; y++) {
      const h = (y - top) / (eave - top) * half;
      p.set(Math.round(cx - h), y, c);
      p.set(Math.round(cx - h) + 1, y, ramp(c).hi);
      p.set(Math.round(cx + h), y, c);
      p.set(Math.round(cx + h) - 1, y, ramp(c).mid);
    }
  }
  function bWindow(p, x, y, w, h, o) {
    const T = o.trim || "#f4efe4";
    if (o.shutter) {
      p.sRect(x - 4, y, 4, h, o.shutter, { noHi: true });
      p.sRect(x + w, y, 4, h, o.shutter, { noHi: true });
      for (let yy = y + 1; yy < y + h; yy += 3) {
        p.rect(x - 4, yy, 4, 1, ramp(o.shutter).lo);
        p.rect(x + w, yy, 4, 1, ramp(o.shutter).lo);
      }
    }
    p.sRect(x, y, w, h, T);
    const gx = x + 2;
    const gy = y + 2;
    const gw = w - 4;
    const gh = h - 4;
    p.rect(gx, gy, gw, gh, "#7fb6d8");
    p.rect(gx, gy, gw, Math.max(2, Math.floor(gh / 5)), "#a9d4ec");
    p.rect(gx, gy, gw, 1, "#5e93b8");
    p.rect(gx, gy, 1, gh, "#6aa2c6");
    p.line(gx + 1, gy + gh - 2, gx + Math.min(gw - 2, 7), gy + gh - 2 - Math.min(gh - 3, 7), "#cdeaf8");
    if (o.arch) {
      for (let k = 0; k < Math.floor(w / 2); k++) {
        const cut = Math.round(Math.sqrt(Math.max(0, (w / 2) ** 2 - (w / 2 - k - 0.5) ** 2)));
        for (let yy = y; yy < y + Math.floor(w / 2) - cut; yy++) {
          p.clear(x + k, yy);
          p.clear(x + w - 1 - k, yy);
        }
      }
    }
    p.rect(x + Math.floor(w / 2), gy, 1, gh, T);
    if (!o.door) p.rect(gx, gy + Math.floor(gh / 2), gw, 1, T);
    p.rect(gx, gy, 2, Math.floor(gh * 0.55), "#f4ece0");
    p.rect(gx + gw - 2, gy, 2, Math.floor(gh * 0.55), "#f4ece0");
    if (!o.box && !o.door) {
      p.rect(x - 1, y + h, w + 2, 2, ramp(T).mid);
      p.rect(x - 1, y + h, w + 2, 1, "#fffaf0");
    }
    if (o.box) {
      p.sRect(x - 1, y + h, w + 2, 3, "#8a5a3b");
      for (let i = 0; i < w; i += 2) {
        p.set(x + i, y + h - 1, ["#e85d75", "#f6d35b", "#ef7fa0", "#ffffff", "#9b7fd1"][i / 2 % 5]);
        p.set(x + i + 1, y + h - 1, "#5f9e4f");
      }
    }
  }
  function bDoor(p, cx, bottom, w, h, c, trim, arch) {
    const x = Math.round(cx - w / 2);
    const y = bottom - h;
    p.sRect(x - 3, y - 3, w + 6, h + 3, trim, { noHi: true });
    p.sRect(x, y, w, h, c);
    const R = ramp(c);
    p.rect(x, y, w, 2, R.lo);
    p.rect(Math.round(cx), y, 1, h, R.lo);
    for (const [px, py] of [[x + 2, y + 3], [Math.round(cx) + 2, y + 3], [x + 2, y + Math.round(h / 2) + 1], [Math.round(cx) + 2, y + Math.round(h / 2) + 1]]) p.sRect(px, py, Math.floor(w / 2) - 4, Math.floor(h / 2) - 5, R.mid, { noHi: true });
    p.rect(Math.round(cx) + 2, y + Math.round(h * 0.55), 2, 2, "#f2c14e");
    p.rect(Math.round(cx) - 4, y + Math.round(h * 0.55), 2, 2, "#f2c14e");
    if (arch) {
      for (let k = 0; k < Math.floor(w / 2) + 3; k++) {
        const r = w / 2 + 3;
        const cut = Math.round(Math.sqrt(Math.max(0, r * r - (r - k - 0.5) ** 2)));
        for (let yy = y - 3; yy < y - 3 + Math.floor(r) - cut; yy++) {
          p.clear(x - 3 + k, yy);
          p.clear(x + w + 2 - k, yy);
        }
      }
    }
  }
  var DECOR = {
    fence: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      const W = "#c49a6c";
      p.sRect(1, 3, 3, 12, W);
      p.sRect(12, 3, 3, 12, W);
      p.sRect(0, 6, 16, 2, W, { noHi: true });
      p.sRect(0, 11, 16, 2, W, { noHi: true });
    } },
    stone: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14, 6, 1.6, "rgba(40,30,20,.2)");
      p.sEll(8, 10.5, 5.5, 4, "#a8a29a");
      p.sEll(12, 12, 2.5, 2, "#a8a29a");
    } },
    // ---- 地上要清理的东西：杂草、小石头、大石头、树枝、树桩（野树直接用长大的树） ----
    weed1: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14.5, 5.5, 1.4, "rgba(30,40,20,.22)");
      const G3 = ramp("#5f9a3a");
      for (const [x0, y0, x1, y1, c] of [[8, 14, 3, 5, G3.lo], [8, 14, 13, 6, G3.lo], [8, 14, 5, 3, G3.mid], [8, 14, 11, 2, G3.mid], [8, 14, 8, 1, "#5f9a3a"], [8, 14, 2, 9, "#5f9a3a"], [8, 14, 14, 10, "#5f9a3a"]]) p.line(x0, y0, x1, y1, c);
      for (const [x, y] of [[3, 5], [13, 6], [5, 3], [11, 2], [8, 1]]) p.set(x, y, G3.hi);
      p.rect(6, 13, 5, 2, G3.lo);
    } },
    weed2: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14.5, 6, 1.4, "rgba(30,40,20,.22)");
      const G3 = ramp("#6aa23e");
      for (const [cx, cy, rx, ry] of [[4, 11, 3.5, 2.2], [12, 11, 3.5, 2.2], [6, 8, 2.6, 3], [10, 8, 2.6, 3], [8, 12, 3, 2]]) p.sEll(cx, cy, rx, ry, "#6aa23e");
      for (const [x, y] of [[2, 10], [14, 10], [5, 6], [11, 6]]) p.set(x, y, G3.hi);
      p.line(8, 12, 8, 4, G3.lo);
      p.sEll(8, 3.5, 2, 1.8, "#f2c14e");
      p.set(8, 3, "#fff2a8");
    } },
    weed3: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14.5, 6, 1.4, "rgba(30,40,20,.22)");
      const G3 = ramp("#7a9a3a");
      for (let i = 0; i < 7; i++) {
        const x0 = 4 + i * 1.3;
        const lean = (i - 3) * 0.9;
        const h = 8 + i * 5 % 4;
        p.line(Math.round(x0), 14, Math.round(x0 + lean), 14 - h, i % 2 ? G3.mid : "#7a9a3a");
        p.set(Math.round(x0 + lean), 14 - h, "#c9b65a");
      }
      p.rect(4, 13, 9, 2, G3.lo);
    } },
    rock1: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14, 6.5, 1.7, "rgba(30,25,20,.25)");
      const R = ramp("#a39d94");
      p.sEll(8, 10, 6, 4.5, "#a39d94");
      p.ell(6.5, 8.5, 3.6, 2.4, R.hi);
      p.ell(10, 12, 3.2, 1.6, R.mid);
      p.line(9, 8, 11, 11, R.lo);
      p.set(5, 7, "#d8d4cc");
    } },
    rock2: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14, 6.5, 1.7, "rgba(30,25,20,.25)");
      const R = ramp("#9a958e");
      p.sEll(6, 11, 4.5, 3.4, "#9a958e");
      p.sEll(11, 10, 3.6, 3.6, "#a8a29a");
      p.ell(10.5, 8.5, 2, 1.4, ramp("#a8a29a").hi);
      p.ell(5, 9.8, 2.4, 1.3, R.hi);
      p.rect(3, 9, 3, 1, "#6f9a4a");
    } },
    boulder: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.ell(16, 29, 14, 2.6, "rgba(30,25,20,.28)");
      const R = ramp("#9c968c");
      p.sEll(16, 18, 14, 11, "#9c968c");
      p.ell(13, 14, 9.5, 7, R.hi);
      p.ell(12, 13, 6, 4, lighten(R.hi, 0.05));
      p.ell(21, 23, 8, 4.5, R.mid);
      p.ell(23, 25, 5, 2.4, R.lo);
      p.line(17, 9, 19, 15, R.lo);
      p.line(19, 15, 23, 17, R.lo);
      p.line(8, 20, 12, 23, R.mid);
      p.sEll(11, 9, 5, 2.2, "#5f8f3e");
      for (const [x, y] of [[8, 8], [10, 7], [13, 8]]) p.set(x, y, "#7fb04f");
      p.set(9, 11, "#e4e0d8");
      p.set(10, 11, "#e4e0d8");
    } },
    twig: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 13, 6, 1.3, "rgba(30,25,20,.2)");
      const B = "#8a5e3a";
      p.line(2, 12, 13, 8, B);
      p.line(2, 13, 13, 9, ramp(B).lo);
      p.line(8, 10, 10, 5, B);
      p.line(5, 11, 4, 8, B);
      p.sEll(11, 4.5, 1.8, 1.2, "#6aa23e");
      p.sEll(3.5, 7.5, 1.4, 1, "#6aa23e");
    } },
    stump: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.ell(16, 28, 14, 2.6, "rgba(30,25,20,.28)");
      const BARK = "#7a5234";
      const BK = ramp(BARK);
      for (const [x0, x1] of [[5, 2], [26, 30], [11, 8], [21, 24]]) p.poly([[x0, 22], [x0 + (x1 > x0 ? 4 : -4) * 0 + 2, 22], [x1, 27], [x1 + (x1 > x0 ? -3 : 3), 27]], BK.lo);
      p.sRect(6, 12, 20, 14, BARK);
      for (let x = 6; x < 26; x++) {
        const c = x < 9 ? BK.hi : x > 21 ? BK.lo : x % 4 === 0 ? BK.mid : BARK;
        for (let y = 13; y < 26; y++) if (!((y + x) % 7 === 0 && x > 9 && x < 21)) p.set(x, y, c);
      }
      p.sEll(16, 12, 10, 4.5, "#d9b07a");
      p.ell(16, 12, 7, 3, "#c99a62");
      p.ell(16, 12, 4.2, 1.8, "#d9b07a");
      p.ell(16, 12, 1.6, 0.8, "#b8864e");
      p.line(16, 12, 22, 10, "#a8763e");
      p.sEll(25, 21, 2.4, 1.6, "#d8783a");
      p.rect(25, 22, 1, 2, "#f4ece0");
    } },
    // 上楼的楼梯：一级级往后墙里走，越往上越暗，右边一道扶手
    stairsUp: { w: 32, h: 48, tw: 2, th: 3, room: true, flat: true, draw(p) {
      const TREAD = "#c99a62";
      const RISE = "#8a5e3a";
      p.rect(0, 0, 32, 48, "#6a4630");
      for (let i = 0; i < 7; i++) {
        const y = 47 - i * 7;
        const k = i / 7;
        p.rect(3, y - 6, 26, 5, mix(TREAD, "#3a2a20", k * 0.55));
        p.rect(3, y - 1, 26, 2, mix(RISE, "#2a1d16", k * 0.55));
        p.rect(3, y - 6, 26, 1, mix(lighten(TREAD, 0.08), "#3a2a20", k * 0.55));
      }
      p.rect(0, 0, 32, 4, "#2a1d16");
      p.rect(0, 0, 3, 48, "#5a3a26");
      p.rect(29, 0, 3, 48, "#5a3a26");
      for (let y = 8; y < 46; y += 8) p.rect(30, y, 1, 6, "#c8a070");
      p.rect(29, 6, 3, 1, "#d8b080");
    } },
    // 下楼的楼梯：地板上一个口子，楼梯往下走，越往下越暗，三边围着栏杆
    stairsDown: { w: 32, h: 48, tw: 2, th: 3, room: true, flat: true, draw(p) {
      p.rect(0, 0, 32, 48, "#5a3a26");
      for (let i = 0; i < 7; i++) {
        const y = 3 + i * 6;
        const k = i / 7;
        p.rect(4, y, 24, 4, mix("#c99a62", "#1a120c", 0.15 + k * 0.7));
        p.rect(4, y + 4, 24, 2, mix("#8a5e3a", "#120c08", 0.2 + k * 0.7));
      }
      for (const x of [1, 29]) {
        p.rect(x, 0, 2, 46, "#b07a4a");
        for (let y = 2; y < 46; y += 5) p.rect(x, y, 2, 1, "#8a5a3b");
      }
      p.rect(1, 0, 30, 2, "#c8a070");
      p.rect(1, 46, 30, 2, "#8a5a3b");
    } },
    stool: { w: 16, h: 16, tw: 1, th: 1, room: true, draw(p) {
      p.ell(8, 14.5, 5.5, 1.3, "rgba(30,25,20,.22)");
      const W = "#b07a4a";
      for (const x of [4, 11]) p.sRect(x, 8, 2, 7, ramp(W).mid, { noHi: true });
      p.rect(5, 11, 7, 1, ramp(W).lo);
      p.sEll(8, 7, 5.5, 2.6, W);
      p.ell(7, 6.4, 3.6, 1.2, ramp(W).hi);
    } },
    mushroom: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.sRect(6, 9, 4, 5, "#f4ece0");
      p.sEll(8, 8, 6, 4, "#d64545");
      p.rect(2, 9, 12, 1, ramp("#d64545").lo);
      for (const [x, y] of [[5, 6], [9, 5], [11, 8]]) p.rect(x, y, 2, 1, "#ffffff");
    } },
    lamp: { w: 16, h: 32, tw: 1, th: 1, draw(p) {
      p.ell(8, 30.5, 5, 1.4, "rgba(40,30,20,.2)");
      p.sRect(7, 9, 2, 21, "#4a4a52");
      p.sRect(5, 29, 6, 2, "#4a4a52");
      p.sRect(4, 4, 8, 6, "#3a3a42");
      p.rect(5, 5, 6, 4, "#ffe28a");
      p.rect(6, 6, 2, 2, "#fff6cc");
      p.poly([[3, 4], [13, 4], [8, 0]], "#3a3a42");
    } },
    bench: { w: 32, h: 16, tw: 2, th: 1, draw(p) {
      const W = "#b07a4a";
      p.ell(16, 15, 13, 1.5, "rgba(40,30,20,.2)");
      p.sRect(2, 1, 28, 3, W);
      p.sRect(2, 5, 28, 2, W, { noHi: true });
      p.sRect(1, 8, 30, 3, W);
      p.sRect(3, 11, 2, 4, "#4a4a52");
      p.sRect(27, 11, 2, 4, "#4a4a52");
    } },
    birdbath: { w: 16, h: 24, tw: 1, th: 1, draw(p) {
      p.ell(8, 22.5, 5, 1.4, "rgba(40,30,20,.2)");
      p.sRect(6, 11, 4, 11, "#c8c2b8");
      p.sRect(4, 20, 8, 3, "#c8c2b8");
      p.sEll(8, 9, 7, 3, "#c8c2b8");
      p.ell(8, 8.5, 5, 1.6, "#7fb8e0");
      p.set(6, 8, "#d8f0ff");
    } },
    mailbox: { w: 16, h: 32, tw: 1, th: 1, draw(p) {
      p.ell(8, 30.5, 5, 1.4, "rgba(40,30,20,.2)");
      p.sRect(7, 16, 2, 14, "#8a5a3b");
      p.sRect(3, 9, 10, 8, "#5a7fb0");
      p.sEll(8, 9.5, 5, 3, "#5a7fb0");
      p.rect(3, 13, 10, 1, ramp("#5a7fb0").lo);
      p.rect(4, 12, 1, 3, ramp("#5a7fb0").mid);
      p.sRect(12, 5, 1, 6, "#c8463a", { noHi: true });
      p.sRect(12, 5, 3, 2, "#c8463a", { noHi: true });
    } },
    logs: { w: 32, h: 24, tw: 2, th: 1, draw(p) {
      p.ell(16, 22.5, 15, 2, "rgba(40,30,20,.22)");
      const BARK = "#7a5232";
      const CUT = "#d9b483";
      p.sRect(5, 3, 22, 6, BARK, { noHi: true });
      for (let x = 7; x < 26; x += 3) p.set(x, 4 + x % 2, ramp(BARK).hi);
      const end = (x, y) => {
        p.ell(x + 0.5, y + 0.5, 4.5, 4.5, ramp(BARK).lo);
        p.ell(x, y, 4, 4, CUT);
        p.ell(x, y, 2.6, 2.6, ramp(CUT).mid);
        p.ell(x, y, 1.6, 1.6, CUT);
        p.set(Math.floor(x), Math.floor(y), ramp(CUT).lo);
        p.set(Math.floor(x - 2), Math.floor(y - 2), ramp(CUT).hi);
        p.set(Math.floor(x - 1), Math.floor(y - 3), ramp(CUT).hi);
      };
      for (const x of [5.5, 13, 20.5, 28]) end(x, 18);
      for (const x of [9.5, 17, 24.5]) end(x, 12);
      end(13.5, 6.5);
      end(21, 6.5);
      p.line(1, 21, 4, 17, "#7a5232");
      p.set(30, 21, "#5f9e4f");
      p.set(31, 20, "#5f9e4f");
    } },
    sign: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.sRect(7, 8, 2, 7, "#8a5a3b");
      p.sRect(2, 2, 12, 7, "#c49a6c");
      p.rect(4, 4, 8, 1, ramp("#c49a6c").lo);
      p.rect(4, 6, 6, 1, ramp("#c49a6c").lo);
    } },
    pond: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.sEll(16, 17, 15, 12, "#a8a29a");
      p.ell(16, 17, 12.5, 9.5, "#5a9ad0");
      p.ell(14, 15, 9, 6, "#6fb0e0");
      p.rect(9, 13, 5, 1, "#d8f0ff");
      p.rect(19, 20, 3, 1, "#d8f0ff");
      p.sEll(22, 13, 3, 2, "#6aa35a");
      p.set(22, 12, "#ef7fa0");
    } },
    pethouse: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.ell(16, 30.5, 14, 1.8, "rgba(40,30,20,.2)");
      p.sRect(4, 14, 24, 16, "#e8c48a");
      p.poly([[1, 15], [16, 2], [31, 15]], "#c8463a");
      p.poly([[3, 15], [16, 4], [16, 15]], ramp("#c8463a").hi);
      p.rect(1, 15, 30, 2, ramp("#c8463a").lo);
      p.sEll(16, 24, 5, 6, "#4a3226");
      p.rect(11, 24, 11, 6, "#4a3226");
      p.rect(12, 9, 8, 3, "#fbf7ef");
      p.rect(13, 10, 6, 1, "#c8463a");
    } },
    // 农舍：瓦片屋顶、木板墙、石头地基，门上有小雨棚，窗户带百叶和花箱，砖砌烟囱
    // 小木屋：7 格宽，原木墙、山墙屋顶、一扇门两扇窗
    cabin: { w: 112, h: 96, tw: 7, th: 3, draw(p) {
      const LOG = "#a8714a";
      const ROOF = "#8a4a36";
      p.ell(56, 93, 58, 3, "rgba(30,25,15,.28)");
      bStone(p, 78, 2, 10, 26, "#9d978c");
      bStone(p, 6, 80, 100, 8, "#9d978c");
      bLogs(p, 6, 46, 100, 34, LOG);
      const top = 6;
      const eave = 47;
      const inRoof = (x, y) => y >= top && y < eave && Math.abs(x - 55.5) <= (y - top) / (eave - top) * 60;
      bShingles(p, inRoof, top, eave, ROOF, 5, 0);
      bRoofEdge(p, 55.5, top, eave, 60, "#6a4630");
      p.sRect(-1, eave - 1, 114, 3, "#6a4630", { noHi: true });
      bDoor(p, 56, 80, 18, 27, "#7a4e32", "#5a3a26");
      p.sRect(44, 52, 24, 3, "#8a5e3c", { noHi: true });
      bWindow(p, 17, 56, 16, 14, { shutter: "#6a8a52", box: true });
      bWindow(p, 79, 56, 16, 14, { shutter: "#6a8a52", box: true });
      p.sRect(69, 60, 3, 5, "#3a3a42");
      p.set(70, 62, "#ffe28a");
      p.sRect(44, 88, 24, 4, "#b9b2a6");
    } },
    // 石头小屋：9 格宽，石头墙、茅草色的人字屋顶，门口一个小门廊，右边石头烟囱
    cottage: { w: 144, h: 104, tw: 9, th: 3, draw(p) {
      const STONE = "#b8ae9b";
      const ROOF = "#9a7a44";
      const TRIM = "#efe4cc";
      p.ell(72, 101, 74, 3, "rgba(30,25,15,.28)");
      bStone(p, 104, 0, 12, 34, "#9d978c");
      bStone(p, 8, 54, 128, 38, STONE);
      bStone(p, 6, 90, 132, 8, "#8f887c");
      p.rect(10, 54, 124, 3, "rgba(50,35,20,.3)");
      const top = 6;
      const eave = 56;
      const inRoof = (x, y) => y >= top && y < eave && Math.abs(x - 71.5) <= 6 + (y - top) / (eave - top) * 72;
      bShingles(p, inRoof, top, eave, ROOF, 4, 2);
      for (let y = top; y < eave; y += 4) for (let x = 0; x < 144; x += 7) if (inRoof(x, y + 2) && (x + y) % 3 === 0) p.rect(x, y + 2, 1, 2, ramp(ROOF).hi);
      p.rect(66, top - 2, 12, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 146, 3, "#6e5430", { noHi: true });
      p.poly([[50, 66], [94, 66], [72, 52]], "#7a5a36");
      p.poly([[54, 65], [90, 65], [72, 55]], ramp(ROOF).mid);
      p.sRect(52, 66, 4, 24, "#8a6440", { noHi: true });
      p.sRect(88, 66, 4, 24, "#8a6440", { noHi: true });
      bDoor(p, 72, 90, 18, 22, "#6e4a32", "#5a3a26");
      bWindow(p, 20, 64, 18, 16, { shutter: "#4f6f8f", box: true, trim: TRIM });
      bWindow(p, 106, 64, 18, 16, { shutter: "#4f6f8f", box: true, trim: TRIM });
      p.sRect(94, 70, 3, 5, "#3a3a42");
      p.set(95, 72, "#ffe28a");
      p.sRect(58, 96, 28, 4, "#c8c0b2");
    } },
    // 大农舍：11 格宽，红色木板墙、白边，深灰屋顶上两扇老虎窗，整排的门廊
    farm2: { w: 176, h: 136, tw: 11, th: 4, draw(p) {
      const WALL = "#b5523f";
      const TRIM = "#f6efe2";
      const ROOF = "#5a5752";
      p.ell(88, 133, 90, 3.2, "rgba(30,25,15,.28)");
      bStone(p, 26, 0, 12, 30, "#a8503c", true);
      bStone(p, 8, 118, 160, 10, "#9d978c");
      bPlanks(p, 10, 62, 156, 56, WALL);
      for (let x = 22; x < 160; x += 12) p.rect(x, 62, 1, 56, ramp(WALL).lo);
      p.sRect(8, 60, 5, 58, TRIM, { noHi: true });
      p.sRect(163, 60, 5, 58, TRIM, { noHi: true });
      const top = 8;
      const eave = 62;
      const inRoof = (x, y) => y >= top && y < eave && x >= 36 - (y - top) / (eave - top) * 38 && x <= 139 + (y - top) / (eave - top) * 38;
      bShingles(p, inRoof, top, eave, ROOF, 6, 1);
      p.rect(36, top - 2, 104, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 178, 3, "#3e3c38", { noHi: true });
      for (const cx of [56, 120]) {
        p.poly([[cx - 15, 50], [cx + 15, 50], [cx, 28]], TRIM);
        p.poly([[cx - 12, 50], [cx + 12, 50], [cx, 31]], ramp(ROOF).mid);
        bWindow(p, cx - 7, 36, 14, 14, { trim: TRIM });
      }
      p.sRect(14, 76, 148, 6, "#6a675f");
      p.sRect(14, 82, 148, 3, TRIM, { noHi: true });
      for (const x of [16, 44, 68, 104, 128, 156]) p.sRect(x, 85, 4, 33, TRIM, { noHi: true });
      bWindow(p, 24, 88, 18, 18, { trim: TRIM });
      bWindow(p, 46, 88, 18, 18, { trim: TRIM });
      bWindow(p, 112, 88, 18, 18, { trim: TRIM });
      bWindow(p, 134, 88, 18, 18, { trim: TRIM });
      for (const [x0, x1] of [[18, 68], [108, 158]]) {
        p.sRect(x0, 106, x1 - x0, 3, TRIM, { noHi: true });
        for (let x = x0 + 2; x < x1; x += 4) p.rect(x, 109, 2, 9, TRIM);
      }
      bDoor(p, 88, 118, 20, 28, "#6e4a32", TRIM);
      p.sRect(66, 128, 44, 4, "#c8c0b2");
      p.sRect(70, 124, 36, 4, "#d8d0c2");
    } },
    // 红砖洋房：11 格宽，两层红砖、白色窗框，正面一个山墙，楼下左边一扇凸窗
    brick: { w: 176, h: 176, tw: 11, th: 4, draw(p) {
      const BRICK = "#ad5a42";
      const TRIM = "#f6f1e6";
      const ROOF = "#4d5563";
      p.ell(88, 173, 90, 3.5, "rgba(30,25,15,.28)");
      bStone(p, 134, 0, 14, 40, "#8f4434", true);
      bStone(p, 10, 158, 156, 10, "#8f887c");
      bStone(p, 12, 58, 152, 100, BRICK, true);
      p.sRect(10, 106, 156, 4, TRIM, { noHi: true });
      p.rect(14, 58, 148, 3, "rgba(40,30,30,.3)");
      const top = 10;
      const eave = 60;
      const inRoof = (x, y) => y >= top && y < eave && x >= 40 - (y - top) / (eave - top) * 42 && x <= 135 + (y - top) / (eave - top) * 42;
      bShingles(p, inRoof, top, eave, ROOF, 5, 0);
      p.rect(40, top - 2, 96, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 178, 3, "#373d48", { noHi: true });
      bStone(p, 58, 30, 60, 30, BRICK, true);
      const inGable = (x, y) => y >= 14 && y < 60 && Math.abs(x - 87.5) <= (y - 14) / 46 * 34 && y >= 14;
      for (let y = 14; y < 60; y++) for (let x = 50; x < 126; x++) if (!inGable(x, y)) continue;
      else if (Math.abs(x - 87.5) > (y - 14) / 46 * 34 - 4) p.set(x, y, ROOF);
      bRoofEdge(p, 87.5, 14, 60, 36, TRIM);
      p.sEll(88, 38, 6, 6, TRIM);
      p.ell(88, 38, 4, 4, "#7fb6d8");
      p.rect(88, 34, 1, 8, TRIM);
      for (const x of [26, 78, 128]) bWindow(p, x, 68, 22, 28, { trim: TRIM });
      p.sRect(18, 116, 44, 40, TRIM);
      bWindow(p, 22, 120, 12, 30, { trim: TRIM });
      bWindow(p, 34, 118, 16, 32, { trim: TRIM });
      bWindow(p, 50, 120, 12, 30, { trim: TRIM });
      p.sRect(16, 112, 48, 5, ROOF);
      bWindow(p, 126, 120, 24, 28, { trim: TRIM, box: true });
      p.poly([[72, 118], [104, 118], [88, 108]], TRIM);
      bDoor(p, 88, 158, 20, 34, "#2f4a3a", TRIM);
      p.sRect(108, 128, 3, 5, "#3a3a42");
      p.set(109, 130, "#ffe28a");
      p.sRect(68, 168, 40, 4, "#c8c0b2");
      p.sRect(72, 164, 32, 4, "#d8d0c2");
    } },
    // 白色洋房：13 格宽，白色木板墙、绿色百叶窗、墨绿屋顶上三扇老虎窗，楼下一整排带栏杆的门廊
    white: { w: 208, h: 176, tw: 13, th: 4, draw(p) {
      const WALL = "#f1eee6";
      const TRIM = "#ffffff";
      const ROOF = "#3f5f4f";
      const SHUT = "#3f6f52";
      p.ell(104, 173, 106, 3.5, "rgba(30,25,15,.28)");
      bStone(p, 40, 0, 12, 36, "#a8503c", true);
      bStone(p, 156, 0, 12, 36, "#a8503c", true);
      bStone(p, 8, 158, 192, 10, "#9d978c");
      bPlanks(p, 12, 58, 184, 100, WALL);
      p.sRect(10, 56, 5, 102, TRIM, { noHi: true });
      p.sRect(193, 56, 5, 102, TRIM, { noHi: true });
      p.rect(15, 58, 178, 3, "rgba(40,50,40,.25)");
      const top = 8;
      const eave = 58;
      const inRoof = (x, y) => y >= top && y < eave && x >= 48 - (y - top) / (eave - top) * 50 && x <= 159 + (y - top) / (eave - top) * 50;
      bShingles(p, inRoof, top, eave, ROOF, 6, 2);
      p.rect(48, top - 2, 112, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 210, 3, "#2e463a", { noHi: true });
      for (const cx of [62, 104, 146]) {
        p.poly([[cx - 13, 48], [cx + 13, 48], [cx, 28]], TRIM);
        p.poly([[cx - 10, 48], [cx + 10, 48], [cx, 31]], ramp(ROOF).mid);
        bWindow(p, cx - 6, 35, 12, 13, { trim: TRIM });
      }
      for (const x of [24, 66, 122, 164]) bWindow(p, x, 66, 20, 26, { shutter: SHUT, trim: TRIM });
      p.sRect(12, 98, 184, 6, ROOF);
      p.sRect(12, 104, 184, 3, TRIM, { noHi: true });
      for (const x of [14, 38, 62, 86, 118, 142, 166, 190]) p.sRect(x, 107, 4, 51, TRIM, { noHi: true });
      for (const x of [24, 66, 122, 164]) bWindow(p, x, 114, 20, 26, { shutter: SHUT, trim: TRIM });
      for (const [x0, x1] of [[14, 90], [118, 194]]) {
        p.sRect(x0, 140, x1 - x0, 3, TRIM, { noHi: true });
        for (let x = x0 + 2; x < x1; x += 4) p.rect(x, 143, 2, 15, TRIM);
      }
      bDoor(p, 104, 158, 22, 36, "#2f4a3a", TRIM);
      p.sRect(80, 168, 48, 4, "#c8c0b2");
      p.sRect(84, 164, 40, 4, "#d8d0c2");
    } },
    // 石头大宅：13 格宽，灰石头两层，左右两个山墙，正中石头拱门，青灰色屋顶，两边烟囱
    manor: { w: 208, h: 184, tw: 13, th: 5, draw(p) {
      const STONE = "#a9a397";
      const TRIM = "#efe9dc";
      const ROOF = "#4f5868";
      p.ell(104, 181, 106, 3.5, "rgba(30,25,15,.28)");
      bStone(p, 22, 6, 14, 40, "#8f887c");
      bStone(p, 172, 6, 14, 40, "#8f887c");
      bStone(p, 8, 164, 192, 12, "#8f887c");
      bStone(p, 12, 66, 184, 98, STONE);
      p.sRect(10, 112, 188, 4, TRIM, { noHi: true });
      const top = 16;
      const eave = 68;
      const inRoof = (x, y) => y >= top && y < eave && x >= 50 - (y - top) / (eave - top) * 52 && x <= 157 + (y - top) / (eave - top) * 52;
      bShingles(p, inRoof, top, eave, ROOF, 5, 3);
      p.rect(50, top - 2, 108, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 210, 3, "#3a4250", { noHi: true });
      for (const cx of [44, 164]) {
        bStone(p, cx - 30, 52, 60, 20, STONE);
        const inG = (x, y) => y >= 8 && y < 58 && Math.abs(x - cx + 0.5) <= (y - 8) / 50 * 34;
        bShingles(p, inG, 8, 58, ROOF, 5, 1);
        for (let y = 26; y < 58; y++) for (let x = cx - 30; x < cx + 30; x++) if (Math.abs(x - cx + 0.5) <= (y - 8) / 50 * 34 - 7) p.set(x, y, STONE);
        bRoofEdge(p, cx - 0.5, 8, 58, 34, TRIM);
        bWindow(p, cx - 7, 34, 14, 18, { arch: true, trim: TRIM });
        bWindow(p, cx - 12, 74, 24, 30, { trim: TRIM });
        bWindow(p, cx - 12, 124, 24, 30, { trim: TRIM, box: true });
      }
      bWindow(p, 82, 74, 16, 28, { arch: true, trim: TRIM });
      bWindow(p, 110, 74, 16, 28, { arch: true, trim: TRIM });
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (k / 8);
        p.sRect(Math.round(104 - Math.cos(a) * 22) - 3, Math.round(130 - Math.sin(a) * 18) - 2, 6, 5, "#c8c2b4", { noHi: true });
      }
      bDoor(p, 104, 164, 26, 36, "#5a3a26", "#7a6a58", true);
      for (const x of [74, 128]) {
        p.sRect(x, 132, 6, 32, "#c8c2b4", { noHi: true });
        p.sEll(x + 3, 128, 5, 4, "#3f6f3a");
        p.sRect(x + 2, 116, 2, 8, "#3a3a42");
        p.set(x + 3, 120, "#ffe28a");
      }
      p.sRect(76, 176, 56, 4, "#c8c0b2");
      p.sRect(80, 172, 48, 4, "#d8d0c2");
    } },
    // 大别墅：15 格宽，中间主楼三层（顶上山花里一扇圆窗），两边两层的厢房，陶土瓦，门前六根柱子
    villa2: { w: 240, h: 208, tw: 15, th: 5, draw(p) {
      const WALL = "#f2e6cf";
      const STONE = "#cdbfa5";
      const ROOF = "#c2603f";
      const TRIM = "#fbf7ef";
      p.ell(120, 205, 122, 3.5, "rgba(30,25,15,.28)");
      bStone(p, 92, 0, 10, 30, "#a8503c", true);
      bStone(p, 138, 0, 10, 30, "#a8503c", true);
      bStone(p, 8, 186, 224, 10, "#a49c90");
      const roof = (x0, x1, top, eave, ridge0, ridge1) => {
        const inRoof = (x, y) => y >= top && y < eave && x >= ridge0 - (y - top) / (eave - top) * (ridge0 - x0) && x <= ridge1 + (y - top) / (eave - top) * (x1 - ridge1);
        bTiles(p, inRoof, top, eave, ROOF);
        p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
        p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, "#8a4630", { noHi: true });
      };
      bPlaster(p, 12, 104, 68, 82, WALL);
      bPlaster(p, 160, 104, 68, 82, WALL);
      roof(6, 86, 72, 106, 30, 62);
      roof(154, 234, 72, 106, 178, 210);
      for (const x0 of [12, 160]) {
        p.sRect(x0, 142, 68, 3, TRIM, { noHi: true });
        bWindow(p, x0 + 10, 112, 16, 24, { arch: true, trim: TRIM });
        bWindow(p, x0 + 42, 112, 16, 24, { arch: true, trim: TRIM });
        bWindow(p, x0 + 10, 152, 16, 26, { trim: TRIM, box: true });
        bWindow(p, x0 + 42, 152, 16, 26, { trim: TRIM, box: true });
      }
      bPlaster(p, 74, 50, 92, 136, WALL);
      for (const x of [74, 160]) for (let y = 50; y < 186; y += 8) p.sRect(x + (y / 8 % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
      roof(66, 174, 14, 52, 98, 142);
      p.poly([[86, 58], [154, 58], [120, 30]], TRIM);
      p.poly([[92, 56], [148, 56], [120, 34]], "#efe0c4");
      p.sEll(120, 46, 7, 7, TRIM);
      p.ell(120, 46, 5, 5, "#7fb6d8");
      p.rect(120, 41, 1, 10, TRIM);
      p.rect(115, 46, 10, 1, TRIM);
      p.sRect(80, 96, 80, 3, TRIM, { noHi: true });
      for (const x of [86, 112, 138]) bWindow(p, x, 64, 16, 26, { arch: true, trim: TRIM });
      for (const x of [86, 112, 138]) bWindow(p, x, 104, 16, 28, { door: true, trim: TRIM });
      p.sRect(80, 132, 80, 4, TRIM);
      for (let x = 82; x < 158; x += 4) p.rect(x, 126, 2, 6, TRIM);
      p.sRect(80, 124, 80, 3, TRIM);
      p.sRect(78, 138, 84, 7, TRIM);
      for (const x of [82, 96, 108, 128, 140, 154]) {
        p.sRect(x, 145, 5, 41, TRIM, { noHi: true });
        p.rect(x - 1, 145, 7, 2, ramp(TRIM).mid);
      }
      bDoor(p, 120, 186, 24, 34, "#6e4a32", TRIM, true);
      p.sRect(92, 196, 56, 4, "#d8d0c2");
      p.sRect(96, 200, 48, 4, "#c8c0b2");
      for (const [x0, x1] of [[14, 78], [162, 226]]) {
        p.sRect(x0, 180, x1 - x0, 6, "#6e8a52");
        for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 180 + x * 3 % 3, ["#e85d75", "#f6d35b", "#ffffff", "#9b7fd1"][x / 3 % 4 | 0]);
      }
    } },
    // 庄园：17 格宽，中间三层主楼、孟莎式屋顶上一座小圆亭，两边两层的翼楼，两头各一座圆塔
    estate: { w: 272, h: 224, tw: 17, th: 6, draw(p) {
      const WALL = "#ece3cf";
      const STONE = "#cfc4ac";
      const ROOF = "#4a5262";
      const TRIM = "#fbf8f0";
      const GOLD = "#e0b04a";
      p.ell(136, 221, 138, 3.5, "rgba(30,25,15,.28)");
      bStone(p, 6, 200, 260, 10, "#a49c90");
      const hip = (x0, x1, top, eave, ridge0, ridge1) => {
        const inRoof = (x, y) => y >= top && y < eave && x >= ridge0 - (y - top) / (eave - top) * (ridge0 - x0) && x <= ridge1 + (y - top) / (eave - top) * (x1 - ridge1);
        bShingles(p, inRoof, top, eave, ROOF, 5, 1);
        p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
        p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, "#363c48", { noHi: true });
      };
      bPlaster(p, 34, 116, 72, 84, WALL);
      bPlaster(p, 166, 116, 72, 84, WALL);
      hip(28, 112, 86, 118, 48, 92);
      hip(160, 244, 86, 118, 180, 224);
      for (const x0 of [34, 166]) {
        p.sRect(x0, 156, 72, 3, TRIM, { noHi: true });
        for (const dx of [8, 28, 48]) {
          bWindow(p, x0 + dx, 124, 16, 26, { trim: TRIM });
          bWindow(p, x0 + dx, 166, 16, 28, { trim: TRIM, box: true });
        }
      }
      for (const x0 of [4, 232]) {
        const TW2 = 36;
        for (let y = 72; y < 200; y++)
          for (let x = x0; x < x0 + TW2; x++) {
            const u = (x - x0) / (TW2 - 1);
            const shade2 = u < 0.2 ? 0.08 : u > 0.7 ? -0.22 * ((u - 0.7) / 0.3) - 0.05 : 0;
            const c = shade2 > 0 ? mix(WALL, "#ffffff", shade2) : mix(WALL, "#8a7a60", -shade2);
            p.set(x, y, (y - 72) % 8 === 7 ? mix(c, STONE, 0.5) : c);
          }
        const cx = x0 + TW2 / 2 - 0.5;
        const inCone = (x, y) => y >= 22 && y < 76 && Math.abs(x - cx) <= (y - 22) / 54 * 22;
        bShingles(p, inCone, 22, 76, ROOF, 5, 0);
        for (let y = 22; y < 76; y++) {
          const h = (y - 22) / 54 * 22;
          p.set(Math.round(cx + h), y, ramp(ROOF).lo);
          p.set(Math.round(cx + h) - 1, y, ramp(ROOF).lo);
        }
        p.sRect(x0 - 3, 74, TW2 + 6, 4, "#363c48", { noHi: true });
        p.rect(Math.round(cx), 10, 1, 12, GOLD);
        p.sEll(Math.round(cx), 18, 2, 2, GOLD);
        for (const y of [88, 128, 168]) bWindow(p, x0 + 10, y, 16, 26, { arch: true, trim: TRIM });
      }
      bPlaster(p, 98, 66, 76, 134, WALL);
      for (const x of [98, 168]) for (let y = 66; y < 200; y += 8) p.sRect(x + (y / 8 % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
      const inMansard = (x, y) => y >= 34 && y < 68 && x >= 102 - (y - 34) / 34 * 10 && x <= 169 + (y - 34) / 34 * 10;
      bShingles(p, inMansard, 34, 68, ROOF, 5, 2);
      p.sRect(100, 30, 72, 5, "#363c48", { noHi: true });
      p.sRect(90, 67, 92, 3, "#363c48", { noHi: true });
      for (const cx of [114, 136, 158]) {
        p.sRect(cx - 8, 40, 16, 22, TRIM);
        p.poly([[cx - 10, 41], [cx + 10, 41], [cx, 33]], ROOF);
        bWindow(p, cx - 5, 44, 10, 16, { trim: TRIM });
      }
      p.sRect(124, 14, 24, 17, TRIM);
      for (const x of [127, 135, 143]) p.rect(x, 17, 2, 12, "#7fb6d8");
      p.sEll(136, 13, 13, 6, ROOF);
      p.rect(136, 0, 1, 8, GOLD);
      p.sEll(136, 4, 2, 2, GOLD);
      p.sRect(104, 114, 64, 3, TRIM, { noHi: true });
      p.sRect(104, 156, 64, 3, TRIM, { noHi: true });
      for (const x of [108, 128, 148]) bWindow(p, x, 76, 16, 30, { arch: true, trim: TRIM });
      for (const x of [108, 148]) bWindow(p, x, 122, 16, 28, { door: true, trim: TRIM });
      bWindow(p, 126, 120, 20, 30, { door: true, trim: TRIM });
      p.sRect(104, 150, 64, 4, TRIM);
      for (let x = 106; x < 166; x += 4) p.rect(x, 144, 2, 6, TRIM);
      p.sRect(104, 142, 64, 3, TRIM);
      p.poly([[100, 166], [172, 166], [136, 152]], TRIM);
      p.poly([[106, 164], [166, 164], [136, 156]], "#efe4cc");
      p.sRect(100, 166, 72, 5, TRIM);
      for (const x of [104, 118, 150, 164]) {
        p.sRect(x, 171, 5, 29, TRIM, { noHi: true });
        p.rect(x - 1, 171, 7, 2, ramp(TRIM).mid);
      }
      bDoor(p, 136, 200, 24, 26, "#5a3a26", TRIM, true);
      p.sRect(104, 210, 64, 4, "#d8d0c2");
      p.sRect(110, 214, 52, 4, "#c8c0b2");
      for (const [x0, x1] of [[42, 98], [174, 230]]) {
        p.sRect(x0, 194, x1 - x0, 6, "#6e8a52");
        for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 194 + x * 3 % 3, ["#e85d75", "#f6d35b", "#ffffff", "#9b7fd1"][x / 3 % 4 | 0]);
      }
    } },
    // 两层小楼：11 格宽，蓝灰色的墙板、四坡屋顶带老虎窗，门口一个门廊，楼上是阳台
    house2: { w: 176, h: 176, tw: 11, th: 4, draw(p) {
      const WALL = "#b7c9d6";
      const TRIM = "#f4efe4";
      const ROOF = "#5c6b85";
      p.ell(88, 173, 90, 3.5, "rgba(30,25,15,.28)");
      bStone(p, 130, 0, 12, 34, "#a8503c", true);
      bStone(p, 10, 156, 156, 12, "#9d978c");
      bPlanks(p, 12, 60, 152, 96, WALL);
      p.sRect(10, 104, 156, 4, TRIM, { noHi: true });
      p.sRect(10, 58, 5, 98, TRIM, { noHi: true });
      p.sRect(161, 58, 5, 98, TRIM, { noHi: true });
      p.rect(15, 60, 146, 3, "rgba(40,40,60,.25)");
      const top = 8;
      const eave = 60;
      const inRoof = (x, y) => y >= top && y < eave && x >= 44 - (y - top) / (eave - top) * 46 && x <= 131 + (y - top) / (eave - top) * 46;
      bShingles(p, inRoof, top, eave, ROOF, 6, 0);
      p.rect(44, top - 2, 88, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 178, 3, "#4a5468", { noHi: true });
      p.poly([[70, 48], [106, 48], [88, 24]], TRIM);
      p.poly([[73, 48], [103, 48], [88, 27]], ramp(ROOF).mid);
      bWindow(p, 80, 34, 16, 14, {});
      bWindow(p, 24, 70, 22, 22, { shutter: "#3e5a7a" });
      bWindow(p, 130, 70, 22, 22, { shutter: "#3e5a7a" });
      bWindow(p, 78, 68, 20, 30, { door: true });
      p.sRect(60, 98, 56, 6, TRIM);
      for (let x = 62; x < 114; x += 4) p.rect(x, 90, 2, 8, TRIM);
      p.sRect(60, 88, 56, 3, TRIM);
      p.sRect(62, 104, 4, 52, TRIM, { noHi: true });
      p.sRect(110, 104, 4, 52, TRIM, { noHi: true });
      bDoor(p, 88, 156, 22, 34, "#7a3a32", TRIM);
      bWindow(p, 24, 118, 22, 22, { shutter: "#3e5a7a", box: true });
      bWindow(p, 130, 118, 22, 22, { shutter: "#3e5a7a", box: true });
      p.sRect(116, 128, 3, 5, "#3a3a42");
      p.set(117, 130, "#ffe28a");
      p.sRect(70, 168, 36, 4, "#b9b2a6");
      p.sRect(66, 156, 44, 4, "#c8c0b2");
    } },
    // 别墅：13 格宽，中间两层、两边一层；奶白色的墙、陶土瓦屋顶、门前四根柱子，二楼拱形窗和阳台
    villa: { w: 208, h: 192, tw: 13, th: 5, draw(p) {
      const WALL = "#efe3cc";
      const STONE = "#c9bea8";
      const ROOF = "#c2603f";
      const TRIM = "#fbf7ef";
      p.ell(104, 189, 106, 3.5, "rgba(30,25,15,.28)");
      bStone(p, 62, 6, 10, 32, "#a8503c", true);
      bStone(p, 136, 6, 10, 32, "#a8503c", true);
      bStone(p, 8, 172, 192, 12, "#a49c90");
      bPlaster(p, 10, 122, 50, 50, WALL);
      bPlaster(p, 148, 122, 50, 50, WALL);
      bPlaster(p, 56, 64, 96, 108, WALL);
      for (const x of [56, 146]) for (let y = 64; y < 172; y += 8) p.sRect(x + (y / 8 % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
      p.sRect(56, 116, 96, 4, TRIM, { noHi: true });
      const roof = (x0, x1, top, eave, ridge0, ridge1) => {
        const inRoof = (x, y) => y >= top && y < eave && x >= ridge0 - (y - top) / (eave - top) * (ridge0 - x0) && x <= ridge1 + (y - top) / (eave - top) * (x1 - ridge1);
        bTiles(p, inRoof, top, eave, ROOF);
        p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
        p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, "#8a4630", { noHi: true });
      };
      roof(4, 64, 96, 124, 22, 46);
      roof(144, 204, 96, 124, 162, 186);
      roof(48, 160, 18, 66, 78, 130);
      for (const x of [66, 95, 124]) bWindow(p, x, 76, 18, 28, { arch: true, trim: TRIM });
      p.sRect(70, 110, 68, 4, TRIM);
      for (let x = 72; x < 136; x += 4) p.rect(x, 104, 2, 6, TRIM);
      p.sRect(70, 102, 68, 3, TRIM);
      p.sRect(68, 120, 72, 8, TRIM);
      for (const x of [72, 86, 118, 132]) {
        p.sRect(x, 128, 6, 44, TRIM, { noHi: true });
        p.rect(x - 1, 128, 8, 2, ramp(TRIM).mid);
        p.rect(x - 1, 170, 8, 2, ramp(TRIM).mid);
      }
      bDoor(p, 104, 172, 26, 38, "#6e4a32", TRIM, true);
      for (const x of [18, 38, 154, 174]) bWindow(p, x, 134, 16, 24, { arch: true, trim: TRIM, box: true });
      p.sRect(80, 184, 48, 4, "#d8d0c2");
      p.sRect(84, 188, 40, 4, "#c8c0b2");
      for (const [x0, x1] of [[12, 56], [152, 196]]) {
        p.sRect(x0, 166, x1 - x0, 6, "#6e8a52");
        for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 166 + x * 3 % 3, ["#e85d75", "#f6d35b", "#ffffff", "#9b7fd1"][x / 3 % 4 | 0]);
      }
    } },
    // 农舍：9 格宽，四坡屋顶，正中一个山墙对着门；木板墙、石头地基、两扇带百叶和花箱的窗户、门口两级台阶
    house: { w: 144, h: 128, tw: 9, th: 4, draw(p) {
      const WALL = "#d6a167";
      const WR = ramp(WALL);
      const TRIM = "#f1e2c2";
      const TR = ramp(TRIM);
      const ROOF = "#b9553f";
      const RR = ramp(ROOF);
      const STONE = "#9d978c";
      const SR = ramp(STONE);
      const WOOD = "#8a5a3b";
      p.ell(72, 125, 74, 3.2, "rgba(30,25,15,.28)");
      for (let y = 108; y < 120; y++) for (let x = 8; x < 136; x++) p.set(x, y, STONE);
      for (let row = 0; row < 3; row++) {
        const y = 108 + row * 4;
        p.rect(8, y + 3, 128, 1, SR.lo);
        for (let x = 8 + (row % 2 ? 5 : 0); x < 136; x += 10) {
          p.rect(x, y, 1, 3, SR.lo);
          p.rect(x + 1, y, 7, 1, SR.hi);
        }
      }
      p.rect(8, 119, 128, 1, SR.lo);
      for (let y = 62; y < 108; y++) {
        const k = (y - 62) % 5;
        p.rect(10, y, 124, 1, k === 0 ? WR.hi : k === 4 ? WR.lo : WALL);
      }
      for (let y = 63; y < 108; y += 5) for (let x = 18 + y / 5 % 3 * 13; x < 132; x += 39) p.set(x, y + 2, WR.mid);
      p.sRect(8, 60, 5, 48, TRIM, { noHi: true });
      p.sRect(131, 60, 5, 48, TRIM, { noHi: true });
      p.rect(13, 62, 118, 4, "rgba(60,30,15,.3)");
      const RT = 10;
      const RB = 62;
      const inMain = (x, y) => y >= RT && y < RB && x >= 24 - (y - RT) / (RB - RT) * 26 && x <= 119 + (y - RT) / (RB - RT) * 26;
      const shingle = (x, y, off) => {
        const row = Math.floor((y - RT) / 6);
        const ry = (y - RT) % 6;
        const tab = (x + (row % 2 ? 5 : 0) + off) % 10;
        if (ry === 5) return RR.lo;
        if (tab === 0) return RR.mid;
        if (ry === 0 && tab < 5) return RR.hi;
        return ROOF;
      };
      for (let y = RT; y < RB; y++) for (let x = -2; x < 146; x++) if (inMain(x, y)) p.set(x, y, shingle(x, y, 0));
      p.rect(24, RT - 2, 96, 3, RR.lo);
      p.rect(24, RT - 2, 96, 1, RR.hi);
      for (let y = RT; y < RB; y++) {
        const dx = (y - RT) / (RB - RT) * 26;
        p.set(Math.round(24 - dx), y, RR.lo);
        p.set(Math.round(24 - dx) + 1, y, RR.hi);
        p.set(Math.round(119 + dx), y, RR.lo);
      }
      for (let y = 0; y < 22; y++)
        for (let x = 100; x < 111; x++) {
          const brick = y % 4 === 3 || (x + Math.floor(y / 4) % 2 * 2) % 5 === 0;
          p.set(x, y, brick ? "#7a3a2e" : y % 4 === 0 ? "#c46a50" : "#a8503c");
        }
      p.sRect(99, 0, 13, 3, "#8a847a");
      for (let y = RT; y < 22; y++) for (let x = 100; x < 111; x++) if (inMain(x, y + 4)) p.set(x, y, shingle(x, y, 0));
      const GT = 14;
      const inGable = (x, y) => y >= GT && y < RB && Math.abs(x - 71.5) <= (y - GT) / (RB - GT) * 30 + 0.5;
      for (let y = GT; y < RB; y++) for (let x = 40; x < 104; x++) if (inGable(x, y)) p.set(x, y, shingle(x, y, 3));
      for (let y = 40; y < RB; y++) {
        const half = (y - GT) / (RB - GT) * 30 - 3;
        for (let x = Math.ceil(71.5 - half); x <= Math.floor(71.5 + half); x++) p.set(x, y, (y - 40) % 5 === 0 ? WR.hi : (y - 40) % 5 === 4 ? WR.lo : WALL);
      }
      for (let y = GT - 1; y < RB + 1; y++) {
        const half = (y - GT) / (RB - GT) * 30;
        for (const [dx, c] of [[0, TRIM], [1, TR.mid], [2, TR.lo]]) {
          p.set(Math.round(71.5 - half) + dx, y, c);
          p.set(Math.round(71.5 + half) - dx, y, dx === 0 ? TR.mid : c);
        }
      }
      p.rect(68, GT - 3, 8, 3, TR.mid);
      p.rect(69, GT - 3, 6, 1, TRIM);
      p.sEll(72, 31, 6, 6, TRIM);
      p.ell(72, 31, 4.2, 4.2, "#7fb6d8");
      p.ell(71, 30, 2, 2, "#a9d4ec");
      p.rect(72, 27, 1, 8, TRIM);
      p.rect(68, 31, 9, 1, TRIM);
      p.sRect(-1, RB - 1, 146, 3, WOOD, { noHi: true });
      for (const wx of [27, 101]) {
        p.sRect(wx - 6, 72, 4, 19, "#5f8a52", { noHi: true });
        p.sRect(wx + 18, 72, 4, 19, "#5f8a52", { noHi: true });
        for (let y = 73; y < 90; y += 3) {
          p.rect(wx - 6, y, 4, 1, ramp("#5f8a52").lo);
          p.rect(wx + 18, y, 4, 1, ramp("#5f8a52").lo);
        }
        p.sRect(wx - 2, 70, 20, 22, TRIM);
        p.rect(wx + 1, 73, 14, 16, "#7fb6d8");
        p.rect(wx + 1, 73, 14, 3, "#a9d4ec");
        p.line(wx + 3, 87, wx + 11, 75, "#cdeaf8");
        p.line(wx + 4, 87, wx + 12, 75, "#cdeaf8");
        p.rect(wx + 8, 73, 1, 16, TRIM);
        p.rect(wx + 1, 80, 14, 1, TRIM);
        p.rect(wx + 1, 73, 2, 9, "#f4ece0");
        p.rect(wx + 13, 73, 2, 9, "#f4ece0");
        p.sRect(wx - 3, 93, 22, 4, WOOD);
        for (let i = 0; i < 9; i++) {
          const c = ["#e85d75", "#f6d35b", "#ef7fa0", "#ffffff", "#9b7fd1"][i % 5];
          p.set(wx - 1 + i * 2 + 1, 92, "#5f9e4f");
          p.set(wx - 1 + i * 2, 91, c);
          p.set(wx - 1 + i * 2 + 1, 91, c);
          p.set(wx - 1 + i * 2, 92, "#4c8a36");
        }
      }
      p.sRect(60, 74, 24, 34, TRIM, { noHi: true });
      p.sRect(63, 77, 18, 31, WOOD);
      for (const [x, y] of [[65, 80], [73, 80], [65, 93], [73, 93]]) p.sRect(x, y, 6, 11, ramp(WOOD).mid, { noHi: true });
      p.rect(72, 77, 1, 31, ramp(WOOD).lo);
      p.rect(77, 92, 2, 2, "#f2c14e");
      p.rect(67, 92, 2, 2, "#f2c14e");
      p.poly([[54, 74], [90, 74], [85, 67], [59, 67]], ROOF);
      for (let x = 60; x < 86; x += 5) p.rect(x, 68, 1, 6, RR.lo);
      p.rect(54, 73, 36, 1, RR.lo);
      p.rect(55, 74, 3, 8, WOOD);
      p.rect(86, 74, 3, 8, WOOD);
      p.sRect(90, 79, 4, 6, "#3a3a42");
      p.rect(91, 81, 2, 2, "#ffe28a");
      p.sRect(56, 119, 32, 4, "#b9b2a6");
      p.sRect(59, 123, 26, 4, "#a8a196");
      p.rect(64, 106, 16, 2, "#a85a3a");
      for (const [x, c] of [[16, "#ef7fa0"], [20, "#f6d35b"], [124, "#9b7fd1"], [128, "#e85d75"]]) {
        p.sEll(x, 105, 3, 2.5, "#5f9e4f");
        p.set(x - 1, 103, c);
        p.set(x + 1, 104, c);
      }
    } },
    // 家具
    bed: { w: 32, h: 32, tw: 2, th: 2, room: true, draw(p) {
      p.sRect(1, 2, 30, 6, "#8a5a3b");
      p.sRect(2, 8, 28, 22, "#f4ece0");
      p.sRect(2, 15, 28, 15, "#5a8fe0");
      for (let y = 18; y < 30; y += 4) p.rect(2, y, 28, 1, ramp("#5a8fe0").mid);
      p.sRect(5, 9, 9, 5, "#ffffff");
      p.sRect(18, 9, 9, 5, "#ffffff");
      p.rect(1, 29, 30, 2, ramp("#8a5a3b").lo);
    } },
    rug: { w: 32, h: 32, tw: 2, th: 2, room: true, flat: true, draw(p) {
      p.ell(16, 16, 15, 12, "#c8664a");
      p.ell(16, 16, 12, 9, "#e8b07a");
      p.ell(16, 16, 8, 5.5, "#c8664a");
      p.ell(16, 16, 4, 2.5, "#f6d35b");
    } },
    table: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(1, 2, 30, 6, "#b07a4a");
      p.sRect(3, 8, 3, 7, "#8a5a3b");
      p.sRect(26, 8, 3, 7, "#8a5a3b");
      p.sRect(12, 0, 6, 3, "#fbf7ef");
      p.set(14, 0, "#ef7fa0");
    } },
    chair: { w: 16, h: 16, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(3, 0, 10, 7, "#b07a4a");
      p.sRect(2, 7, 12, 3, "#c8664a");
      p.sRect(3, 10, 2, 5, "#8a5a3b");
      p.sRect(11, 10, 2, 5, "#8a5a3b");
    } },
    bookshelf: { w: 16, h: 32, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(0, 0, 16, 31, "#8a5a3b");
      const cols = ["#c8463a", "#3b6ea8", "#f2c14e", "#6aa35a", "#9b7fd1", "#e8793a"];
      for (const y of [3, 11, 19]) {
        p.rect(2, y, 12, 7, "#5a3a28");
        for (let i = 0; i < 6; i++) p.sRect(2 + i * 2, y + (i % 3 === 1 ? 1 : 0), 2, 7 - (i % 3 === 1 ? 1 : 0), cols[(i + y) % 6], { noHi: true });
      }
      p.rect(2, 27, 12, 3, "#5a3a28");
    } },
    floorlamp: { w: 16, h: 32, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(7, 10, 2, 19, "#6a5a4a");
      p.sRect(4, 28, 8, 3, "#6a5a4a");
      p.poly([[3, 10], [13, 10], [11, 2], [5, 2]], "#f6dca0");
      p.rect(4, 9, 8, 1, ramp("#f6dca0").mid);
    } },
    plant: { w: 16, h: 24, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(4, 15, 8, 8, "#c8664a");
      p.rect(3, 15, 10, 2, ramp("#c8664a").hi);
      canopy(p, [[8, 9, 5, 5], [4, 7, 3, 3], [12, 6, 3, 3], [8, 3, 3, 3]], "#5f9e4f");
    } },
    sofa: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(2, 1, 28, 7, "#7a9a8a");
      p.sRect(0, 5, 5, 10, "#7a9a8a");
      p.sRect(27, 5, 5, 10, "#7a9a8a");
      p.sRect(4, 8, 24, 6, "#8ab0a0");
      p.rect(15, 8, 1, 6, ramp("#8ab0a0").lo);
    } },
    desk: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(1, 4, 30, 5, "#8a5a3b");
      p.sRect(2, 9, 3, 6, "#6a4a32");
      p.sRect(22, 9, 8, 6, "#6a4a32");
      p.rect(24, 11, 4, 1, "#f2c14e");
      p.sRect(6, 0, 7, 4, "#fbf7ef");
      p.rect(7, 1, 5, 1, "#9b9488");
      p.sRect(17, 0, 3, 4, "#3b6ea8");
    } },
    fireplace: { w: 32, h: 32, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(1, 2, 30, 29, "#a8a29a");
      for (let y = 6; y < 31; y += 5) p.rect(1, y, 30, 1, ramp("#a8a29a").mid);
      p.rect(7, 13, 18, 18, "#3a2a26");
      p.sEll(16, 27, 6, 4, "#f08a3a");
      p.sEll(16, 26, 3.5, 3, "#f6d35b");
      p.sRect(0, 0, 32, 3, "#8a5a3b");
    } },
    painting: { w: 16, h: 16, tw: 1, th: 1, room: true, wall: true, draw(p) {
      p.sRect(1, 2, 14, 11, "#c49a6c");
      p.rect(3, 4, 10, 7, "#9fd0f0");
      p.rect(3, 8, 10, 3, "#7fb35a");
      p.sEll(10, 6, 1.6, 1.6, "#f6d35b");
    } },
    window: { w: 16, h: 16, tw: 1, th: 1, room: true, wall: true, draw(p) {
      p.sRect(1, 1, 14, 13, "#8a5a3b");
      p.rect(2, 2, 12, 11, "#9fd0f0");
      p.rect(2, 2, 4, 3, "#e8f6ff");
      p.rect(7, 2, 1, 11, "#8a5a3b");
      p.rect(2, 7, 12, 1, "#8a5a3b");
    } }
  };

  // src/art/pix.ts
  var LX = -0.55;
  var LY = -0.83;
  var rgbaCache = /* @__PURE__ */ new Map();
  var probe = null;
  function rgbaOf(v) {
    let q = rgbaCache.get(v);
    if (q) return q;
    if (v[0] === "#" && v.length === 7) {
      const [r, g, b] = hex2rgb(v);
      q = [r, g, b, 255];
    } else {
      const m = /^rgba?\(([^)]+)\)$/.exec(v);
      if (m) {
        const a = m[1].split(",").map((x) => parseFloat(x));
        q = [a[0], a[1], a[2], Math.round((a.length > 3 ? a[3] : 1) * 255)];
      } else {
        if (!probe) {
          probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
          probe.canvas.width = probe.canvas.height = 1;
        }
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = v;
        probe.fillRect(0, 0, 1, 1);
        q = Array.from(probe.getImageData(0, 0, 1, 1).data);
      }
    }
    rgbaCache.set(v, q);
    return q;
  }
  var cache = /* @__PURE__ */ new Map();
  function build(w, h, draw, opt) {
    const p = new Pix(w, h);
    draw(p);
    if (!opt || opt.outline !== false) p.outline();
    return p;
  }
  function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make().toCanvas());
    return cache.get(key);
  }
  var Pix = class {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.d = new Array(w * h).fill(null);
    }
    set(x, y, c) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
    }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      return this.d[y * this.w + x];
    }
    clear(x, y) {
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = null;
    }
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    }
    inEll(x, y, cx, cy, rx, ry) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      return dx * dx + dy * dy <= 1;
    }
    ell(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (this.inEll(x, y, cx, cy, rx, ry)) this.set(x, y, c);
    }
    // 有明暗的椭圆：按法线和光的方向选色阶
    sEll(cx, cy, rx, ry, hex, o) {
      o = o || {};
      const R = ramp(hex);
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          if (!this.inEll(x, y, cx, cy, rx, ry)) continue;
          const nx = (x + 0.5 - cx) / rx;
          const ny = (y + 0.5 - cy) / ry;
          const r = Math.sqrt(nx * nx + ny * ny);
          const dot = nx * LX + ny * LY;
          let c = R.base;
          if (dot > 0.5 && r > 0.45 && r < 0.92 && !o.noHi) c = R.hi;
          else if (dot < -0.45 && r > 0.55) c = R.lo;
          else if (dot < -0.05 && r > 0.6) c = R.mid;
          this.set(x, y, c);
        }
    }
    // 有明暗的方块：上沿亮、下沿和右沿暗
    sRect(x, y, w, h, hex, o) {
      o = o || {};
      const R = ramp(hex);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          let c = R.base;
          if (j === 0 && !o.noHi) c = R.hi;
          else if (j >= h - (o.bottom || 1)) c = R.lo;
          else if (i === w - 1) c = R.mid;
          else if (i === 0 && !o.noHi) c = R.hi;
          this.set(x + i, y + j, c);
        }
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0);
      y0 = Math.round(y0);
      x1 = Math.round(x1);
      y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (; ; ) {
        this.set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }
    // 实心多边形（扫描线）
    poly(pts, c) {
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
      }
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const yc = y + 0.5;
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          if (a[1] <= yc && b[1] > yc || b[1] <= yc && a[1] > yc) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
      }
    }
    // 外轮廓：透明像素挨着有色像素，就涂成那个颜色的描边色
    // 迎光的一边（左上）描边浅一点，背光的一边（右下）深一点，轮廓不那么死板
    outline(only) {
      const add = [];
      const hexAt = (x, y) => {
        const c = this.get(x, y);
        return c && c[0] === "#" ? c : null;
      };
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          if (this.get(x, y)) continue;
          const below = hexAt(x, y + 1);
          const right = hexAt(x + 1, y);
          const above = hexAt(x, y - 1);
          const left = hexAt(x - 1, y);
          const n = above || left || right || below;
          if (!n || only && !only(n)) continue;
          const lit = (below || right) && !above && !left;
          const R = ramp(lit ? below || right : n);
          add.push([x, y, lit ? mix(R.line, R.lo, 0.45) : R.line]);
        }
      for (const [x, y, c] of add) this.set(x, y, c);
    }
    // 把 src 叠到自己上面（偏移 ox, oy；mirror 左右翻转）
    blit(src, ox, oy, mirror) {
      for (let y = 0; y < src.h; y++)
        for (let x = 0; x < src.w; x++) {
          const c = src.d[y * src.w + x];
          if (c) this.set(ox + (mirror ? src.w - 1 - x : x), oy + y, c);
        }
    }
    recolor(fn) {
      for (let i = 0; i < this.d.length; i++) if (this.d[i] && this.d[i][0] === "#") this.d[i] = fn(this.d[i]);
    }
    toCanvas() {
      const c = document.createElement("canvas");
      c.width = this.w;
      c.height = this.h;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(this.w, this.h);
      const out = img.data;
      for (let i = 0; i < this.d.length; i++) {
        const v = this.d[i];
        if (!v) continue;
        const q = rgbaOf(v);
        const k = i * 4;
        out[k] = q[0];
        out[k + 1] = q[1];
        out[k + 2] = q[2];
        out[k + 3] = q[3];
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
  };

  // src/art/widgets.ts
  var INK = "#2a1d1a";
  var WHITE = "#fffaf2";
  function eye(p, x, y, kind, h) {
    h = h || 3;
    if (kind === "closed") {
      p.rect(x - 1, y + h - 2, 3, 1, INK);
      return;
    }
    if (kind === "happy") {
      p.set(x - 1, y + 1, INK);
      p.set(x, y, INK);
      p.set(x + 1, y + 1, INK);
      return;
    }
    if (kind === "sick") {
      p.rect(x - 1, y + 1, 3, 1, INK);
      p.rect(x, y + 2, 1, 1, INK);
      return;
    }
    p.rect(x, y, 2, h, INK);
    p.set(x, y, WHITE);
    if (h >= 3) p.set(x + 1, y + h - 1, "#5d5470");
  }
  function blush(p, x, y, c) {
    p.rect(x, y, 2, 1, c || "#f2a0a0");
  }

  // src/art/fish.ts
  var FISH_LOOK = {
    medaka: { body: "#d8c68a", fin: "#c8b070", spots: null },
    goldfish: { body: "#f0742e", fin: "#f6b07a", spots: null, fancy: true },
    guppy: { body: "#9ab0c8", fin: "#e85d75", fin2: "#9b7fd1", spots: null, fancy: true },
    koi: { body: "#f8f4ec", fin: "#f2e6dc", spots: "#d8452e" },
    goldkoi: { body: "#f2c14e", fin: "#f7dc85", spots: null, shine: true }
  };
  function fishTopDraw(p, sp, frame) {
    const L = FISH_LOOK[sp] || FISH_LOOK.goldfish;
    const sw = frame ? 1 : -1;
    p.poly([[11, 5], [15, 2 + sw], [15, 8 + sw]], L.fin);
    if (L.fancy) p.poly([[12, 5], [16, 1 + sw], [16, 9 + sw]], L.fin2 || L.fin);
    p.sEll(7, 5, 5, 2.6, L.body);
    p.ell(7, 4.3, 3.5, 1, lighten(L.body, 0.08));
    p.set(6, 2 + (frame ? 0 : 1), L.fin);
    p.set(6, 8 - (frame ? 0 : 1), L.fin);
    if (L.spots) {
      p.ell(6, 4.5, 1.6, 1.4, L.spots);
      p.set(9, 5, L.spots);
      p.set(10, 4, L.spots);
    }
    if (L.shine) {
      p.set(5, 4, "#fff1b8");
      p.set(8, 4, "#fff1b8");
    }
    p.set(3, 4, INK);
    p.set(3, 6, INK);
  }
  function fishTop(sp, frame, sick) {
    return cached("fishtop:" + sp + ":" + frame + ":" + (sick ? 1 : 0), () => {
      const p = new Pix(17, 11);
      fishTopDraw(p, sp, frame);
      p.outline();
      if (sick) p.recolor((c) => mix(desat(c, 0.5), "#9fbf8f", 0.15));
      return p;
    });
  }

  // src/art/icons.ts
  var ICONS = {
    kibble(p) {
      p.sEll(8, 11.5, 6.5, 3, "#c8463a");
      p.ell(8, 10, 5.5, 1.8, "#8a5a3b");
      for (const [x, y] of [[5, 9], [7, 8], [9, 9], [11, 8], [6, 10], [10, 10], [8, 9]]) {
        p.set(x, y, "#c08850");
        p.set(x + 1, y, "#a06a3a");
      }
      p.rect(3, 12, 10, 1, ramp("#c8463a").lo);
    },
    tin(p) {
      p.sRect(4, 5, 9, 9, "#c0c6cc");
      p.rect(4, 7, 9, 4, "#e8793a");
      p.sEll(8.5, 9, 2, 1.5, "#fbf7ef");
      p.set(8, 9, "#e85d75");
      p.sEll(8.5, 5, 4.5, 1.6, "#dfe4e8");
      p.rect(6, 4, 4, 1, "#9aa2aa");
    },
    fishfood(p) {
      p.sRect(4, 3, 8, 11, "#5aa2dc");
      p.rect(4, 3, 8, 2, "#3a74b0");
      p.sEll(8, 9, 2.6, 1.6, "#f0742e");
      p.poly([[10, 9], [12, 7.5], [12, 10.5]], "#f0742e");
      p.set(7, 9, INK);
      for (const [x, y] of [[13, 13], [14, 11], [13, 15]]) p.set(x, y, "#e0b050");
    },
    water(p) {
      p.poly([[8, 1], [3, 9], [13, 9]], "#5a9ad0");
      p.sEll(8, 10, 5, 4.5, "#5a9ad0");
      p.rect(6, 7, 2, 3, "#d8f0ff");
    },
    can(p) {
      p.sRect(3, 6, 9, 8, "#7a9ab8");
      p.line(12, 8, 15, 4, "#7a9ab8");
      p.line(12, 9, 15, 5, ramp("#7a9ab8").mid);
      p.rect(4, 3, 7, 1, "#5a7a98");
      p.rect(4, 3, 1, 4, "#5a7a98");
      p.rect(10, 3, 1, 4, "#5a7a98");
    },
    fert(p) {
      p.sRect(3, 4, 10, 11, "#c49a6c");
      p.rect(3, 3, 10, 2, ramp("#c49a6c").lo);
      p.sEll(8, 9.5, 3, 3, "#6aa35a");
      p.rect(8, 7, 1, 4, "#4f8a43");
    },
    medicine(p) {
      p.sRect(4, 5, 8, 10, "#fbf7ef");
      p.sRect(5, 2, 6, 3, "#c8463a");
      p.rect(7, 8, 2, 5, "#e85d75");
      p.rect(5, 10, 6, 1, "#e85d75");
    },
    ball(p) {
      p.sEll(8, 8.5, 6, 6, "#e85d75");
      p.rect(2, 8, 12, 1, "#fbf7ef");
      p.rect(8, 3, 1, 11, "#f6d35b");
    },
    yarn(p) {
      p.sEll(8, 9, 6, 5.5, "#9b7fd1");
      for (let k = 4; k < 13; k += 3) p.line(k, 5, k + 3, 13, ramp("#9b7fd1").lo);
      p.line(13, 11, 15, 15, "#9b7fd1");
    },
    bone(p) {
      p.sRect(4, 7, 8, 3, "#f4ece0");
      for (const [x, y] of [[3, 6], [3, 10], [12, 6], [12, 10]]) p.sEll(x + 0.5, y + 0.5, 2, 2, "#f4ece0");
    },
    fishtoy(p) {
      p.sEll(7, 8.5, 5, 3.5, "#5a9ad0");
      p.poly([[11, 8.5], [15, 5], [15, 12]], "#5a9ad0");
      p.set(4, 7, INK);
      p.rect(6, 6, 2, 1, "#d8f0ff");
    },
    treat(p) {
      p.sEll(8, 9, 6, 5, "#d8a060");
      for (const [x, y] of [[6, 7], [10, 8], [7, 11]]) p.set(x, y, "#6b4a2b");
    },
    seed(p, c) {
      p.sRect(3, 2, 10, 13, "#efe4cc");
      p.rect(3, 2, 10, 2, ramp("#efe4cc").mid);
      p.sEll(8, 9, 3, 3, c || "#e85d75");
      p.set(8, 9, "#f6d35b");
      p.rect(8, 12, 1, 2, "#4f8a43");
    },
    // 体力：一道闪电
    bolt(p) {
      p.poly([[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6], [11, 1]], "#f2c14e");
      p.line(9, 2, 5, 8, "#fff2a8");
    },
    // 材料：一捆木头、一堆石块
    wood(p) {
      const W = "#a8713f";
      for (const [y, x0, x1] of [[10, 2, 12], [6, 4, 14]]) {
        p.sRect(x0, y, x1 - x0, 4, W, { noHi: true });
        p.rect(x0 + 1, y, x1 - x0 - 2, 1, ramp(W).hi);
        p.sEll(x1, y + 2, 1.9, 1.9, "#d9b07a");
        p.set(x1, y + 2, "#a8763e");
      }
      p.rect(7, 6, 1, 8, "#6a4630");
    },
    stone(p) {
      p.sEll(5.5, 10.5, 4, 3, "#a39d94");
      p.sEll(11, 11, 3.6, 2.8, "#948e86");
      p.sEll(8.5, 6.5, 3.4, 2.8, "#b0aaa0");
      p.set(7, 5, "#e4e0d8");
      p.set(4, 9, "#d4d0c8");
    },
    scythe(p) {
      p.line(12, 15, 10, 3, "#8a5a3b");
      p.line(13, 15, 11, 3, ramp("#8a5a3b").lo);
      p.rect(9, 9, 5, 2, "#6a4630");
      for (const [x, y] of [[10, 2], [9, 2], [8, 2], [7, 2], [6, 3], [5, 3], [4, 4], [3, 5], [2, 6], [1, 8]]) p.set(x, y, "#dfe6ec");
      for (const [x, y] of [[9, 3], [8, 3], [7, 3], [6, 4], [5, 4], [4, 5], [3, 6], [2, 7]]) p.set(x, y, "#9aa4ae");
      p.set(10, 3, "#5a5f66");
    },
    pickaxe(p) {
      p.line(4, 15, 10, 4, "#8a5a3b");
      p.line(5, 15, 11, 4, ramp("#8a5a3b").lo);
      for (let i = 0; i < 6; i++) {
        p.set(10 - i, 3 + Math.floor(i / 2), "#a8b0b8");
        p.set(10 + i, 3 + Math.floor(i / 2), "#a8b0b8");
      }
      p.rect(8, 2, 5, 2, "#c8d0d8");
    },
    axe(p) {
      p.line(4, 15, 10, 3, "#8a5a3b");
      p.line(5, 15, 11, 3, ramp("#8a5a3b").lo);
      p.poly([[9, 2], [14, 1], [15, 6], [11, 7]], "#a8b0b8");
      p.line(14, 1, 15, 6, "#d8dee4");
    },
    hoe(p) {
      p.line(2, 14, 10, 4, "#8a5a3b");
      p.line(3, 14, 11, 4, ramp("#8a5a3b").lo);
      p.poly([[8, 2], [14, 2], [15, 5], [13, 7], [11, 5]], "#a8b0b8");
      p.line(9, 2, 13, 2, "#d8dee4");
    },
    shovel(p) {
      p.line(3, 13, 10, 6, "#8a5a3b");
      p.line(4, 13, 11, 6, ramp("#8a5a3b").lo);
      p.poly([[9, 4], [13, 1], [15, 3], [12, 7]], "#a8b0b8");
    },
    hand(p) {
      p.sEll(8, 10, 4.5, 4.5, "#f3c9a5");
      for (const x of [4, 6, 8, 10]) p.sRect(x, 3 + (x === 4 || x === 10 ? 2 : 0), 2, 6, "#f3c9a5", { noHi: true });
    },
    bag(p) {
      p.sRect(2, 5, 12, 10, "#b07a4a");
      p.rect(2, 8, 12, 1, ramp("#b07a4a").lo);
      p.sRect(6, 7, 4, 3, "#f2c14e");
      p.line(4, 5, 6, 1, "#8a5a3b");
      p.line(12, 5, 10, 1, "#8a5a3b");
      p.rect(6, 1, 5, 1, "#8a5a3b");
    },
    coin(p) {
      p.sEll(8, 8, 6, 6, "#f2c14e");
      p.ell(8, 8, 3.5, 3.5, ramp("#f2c14e").mid);
      p.rect(7, 5, 2, 6, ramp("#f2c14e").hi);
    }
  };
  var forestCache = /* @__PURE__ */ new Map();
  function forestTree(kind) {
    if (forestCache.has(kind)) return forestCache.get(kind);
    const q = kind === "bush" ? build(16, 16, (p) => canopy(p, [[8, 10, 7, 5.5], [5, 7, 4, 4], [11, 6, 4.5, 4]], "#3f7d3c")) : build(48, 72, (p) => drawTree(p, forestCacheSpecs[kind] || forestCacheSpecs.round, 1.5));
    forestCache.set(kind, q);
    return q;
  }

  // src/art/terrain.ts
  function hash2(x, y, seed) {
    let h = x * 374761393 + y * 668265263 + seed * 2246822519;
    h = (h ^ h >>> 13) * 1274126177;
    h ^= h >>> 16;
    return (h >>> 0) % 1e4 / 1e4;
  }
  function noise(x, y, seed) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(xi, yi, seed);
    const b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed);
    const d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(x, y, seed) {
    return noise(x / 24, y / 24, seed) * 0.55 + noise(x / 9, y / 9, seed + 7) * 0.3 + noise(x / 3, y / 3, seed + 13) * 0.15;
  }
  var GRASS = ["#4c8a36", "#62a443", "#6fb24a", "#7cbf52", "#92d266"];
  var GRASS_SET = new Set(GRASS);
  var DIRT = ["#b98b5c", "#c99b69", "#d6ab78", "#e2bb88"];
  var DIRT_SET = new Set(DIRT);
  var SOIL = ["#6a4630", "#7a5238", "#8a5e40"];
  var WET = ["#4a3022", "#56382a", "#634232"];
  var WATER = ["#78bdea", "#5aa2dc", "#4a8fcf", "#3f80c0", "#35699f"];
  function terrain(o) {
    const T = 16;
    const W = o.w * T;
    const H = o.h * T;
    const p = new Pix(W, H);
    const seed = o.seed || 1;
    const has = (set, x, y) => set && set.has(x + "," + y);
    const pathAt = (px, py) => {
      const tx = Math.floor(px / T);
      const ty = Math.floor(py / T);
      if (!has(o.path, tx, ty)) return false;
      const lx = px - tx * T;
      const ly = py - ty * T;
      const n = noise(px / 3, py / 3, seed + 5) * 3;
      if (!has(o.path, tx - 1, ty) && lx < 1 + n) return false;
      if (!has(o.path, tx + 1, ty) && T - 1 - lx < 1 + n) return false;
      if (!has(o.path, tx, ty - 1) && ly < 1 + n) return false;
      if (!has(o.path, tx, ty + 1) && T - 1 - ly < 1 + n) return false;
      return true;
    };
    const waterAt = (px, py) => {
      if (o.pondFn) return o.pondFn(px / T, py / T);
      if (!o.water) return false;
      const tx = Math.floor(px / T);
      const ty = Math.floor(py / T);
      if (!has(o.water, tx, ty)) return false;
      const lx = px - tx * T;
      const ly = py - ty * T;
      const r = 4 + noise(px / 4, py / 4, seed + 82) * 2;
      const L = !has(o.water, tx - 1, ty);
      const R = !has(o.water, tx + 1, ty);
      const U = !has(o.water, tx, ty - 1);
      const D = !has(o.water, tx, ty + 1);
      const corner = (cx, cy) => Math.hypot(lx - cx, ly - cy) > r;
      if (L && U && lx < r && ly < r && corner(r, r)) return false;
      if (R && U && lx > T - 1 - r && ly < r && corner(T - 1 - r, r)) return false;
      if (L && D && lx < r && ly > T - 1 - r && corner(r, T - 1 - r)) return false;
      if (R && D && lx > T - 1 - r && ly > T - 1 - r && corner(T - 1 - r, T - 1 - r)) return false;
      return true;
    };
    const wmask = new Uint8Array(W * H);
    const isW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && wmask[y * W + x] === 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = fbm(x, y, seed);
        let c = v < 0.36 ? GRASS[1] : v < 0.66 ? GRASS[2] : GRASS[3];
        if (hash2(x, y, seed + 21) < 0.04) c = GRASS[3];
        if (waterAt(x, y)) {
          wmask[y * W + x] = 1;
          c = WATER[1];
        } else if (pathAt(x, y)) {
          const d = fbm(x * 1.6, y * 1.6, seed + 40);
          c = DIRT[Math.max(0, Math.min(3, Math.floor(d * 4.4 - 0.2)))];
          if (hash2(x, y, seed + 9) < 0.03) c = "#a07a52";
        }
        p.set(x, y, c);
      }
    let pond = null;
    if (o.water && o.water.size) {
      let x0 = W;
      let y0 = H;
      let x1 = 0;
      let y1 = 0;
      for (const k of o.water) {
        const [tx, ty] = k.split(",").map(Number);
        x0 = Math.min(x0, tx * T - 3);
        y0 = Math.min(y0, ty * T - 3);
        x1 = Math.max(x1, tx * T + T + 3);
        y1 = Math.max(y1, ty * T + T + 3);
      }
      x0 = Math.max(0, x0);
      y0 = Math.max(0, y0);
      x1 = Math.min(W, x1);
      y1 = Math.min(H, y1);
      pond = { x0, y0, x1, y1 };
      const depth = (x, y) => {
        for (let r = 1; r <= 9; r++) {
          for (let k = -r; k <= r; k++) if (!isW(x + k, y - r) || !isW(x + k, y + r) || !isW(x - r, y + k) || !isW(x + r, y + k)) return r;
        }
        return 10;
      };
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          if (!isW(x, y)) continue;
          const d = depth(x, y) + (noise(x / 6, y / 6, seed + 80) - 0.5) * 3 + (hash2(x, y, seed + 81) - 0.5) * 1.2;
          let c = d < 2.6 ? WATER[0] : d < 5 ? WATER[1] : d < 8 ? WATER[2] : WATER[3];
          let up = 0;
          while (up < 4 && isW(x, y - up - 1)) up++;
          if (up < 4) c = up < 2 ? WATER[4] : WATER[3];
          p.set(x, y, c);
        }
      for (let gy = y0; gy < y1; gy += 7)
        for (let gx = x0; gx < x1; gx += 11) {
          if (hash2(gx, gy, seed + 83) > 0.3) continue;
          const len = 2 + Math.floor(hash2(gx, gy, seed + 84) * 3);
          const x = gx + Math.floor(hash2(gx, gy, seed + 85) * 6);
          const y = gy + Math.floor(hash2(gx, gy, seed + 86) * 4);
          let ok = true;
          for (let i = -1; i <= len && ok; i++) if (!isW(x + i, y) || !isW(x + i, y - 4) || !isW(x + i, y + 2)) ok = false;
          if (!ok) continue;
          for (let i = 0; i < len; i++) p.set(x + i, y, "#a6d6f4");
          p.set(x + Math.floor(len / 2), y, "#e4f5ff");
        }
      const shore = [];
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          if (isW(x, y)) continue;
          let near = 0;
          for (let dy = -2; dy <= 2 && near < 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isW(x + dx, y + dy)) near = Math.max(near, 3 - Math.max(Math.abs(dx), Math.abs(dy)));
          if (near) shore.push([x, y, near]);
        }
      for (const [x, y, n] of shore) {
        let c = n === 2 ? "#7a6a4a" : "#cdb98a";
        if (n === 1 && hash2(x, y, seed + 87) < 0.12) c = "#b7a274";
        if (n === 1 && hash2(x, y, seed + 88) < 0.04) c = "#e6d6a8";
        p.set(x, y, c);
      }
    }
    for (let y = 1; y < H; y++)
      for (let x = 0; x < W; x++) {
        const isDirt = DIRT_SET.has(p.get(x, y - 1)) && GRASS_SET.has(p.get(x, y));
        if (isDirt) p.set(x, y - 1, "#a3774e");
      }
    const fringe = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (!GRASS_SET.has(p.get(x, y))) continue;
        const d = DIRT_SET.has(p.get(x, y - 1)) || DIRT_SET.has(p.get(x - 1, y)) || DIRT_SET.has(p.get(x + 1, y)) || DIRT_SET.has(p.get(x, y + 1));
        if (d) fringe.push([x, y]);
      }
    for (const [x, y] of fringe) p.set(x, y, hash2(x, y, seed + 90) < 0.5 ? "#4c8a36" : "#58983e");
    const gi = (c) => GRASS.indexOf(c);
    const shade2 = (c, d) => GRASS[Math.max(0, Math.min(4, gi(c) + d))];
    const isG = (x, y) => GRASS_SET.has(p.get(x, y));
    for (let ty = 0; ty < o.h; ty++)
      for (let tx = 0; tx < o.w; tx++) {
        const n = 5 + Math.floor(hash2(tx, ty, seed + 50) * 3);
        for (let k = 0; k < n; k++) {
          const x = tx * T + 2 + Math.floor(hash2(tx * 7 + k, ty, seed + 51) * 12);
          const y = ty * T + 3 + Math.floor(hash2(tx, ty * 7 + k, seed + 52) * 12);
          if (!isG(x, y) || !isG(x - 2, y) || !isG(x + 2, y) || !isG(x, y - 3)) continue;
          const c0 = p.get(x, y);
          const dk = shade2(c0, -1);
          const lt = shade2(c0, 1);
          const kind = Math.floor(hash2(x, y, seed + 53) * 5);
          if (kind === 0) {
            p.set(x - 1, y - 1, dk);
            p.set(x, y, dk);
            p.set(x + 1, y - 1, dk);
            p.set(x - 1, y - 2, lt);
            p.set(x + 1, y - 2, lt);
          } else if (kind === 1) {
            for (const [dx, dy] of [[-2, -1], [-1, 0], [0, -1], [0, -2], [1, 0], [2, -1]]) p.set(x + dx, y + dy, dk);
            p.set(x, y - 3, lt);
            p.set(x - 2, y - 2, lt);
            p.set(x + 2, y - 2, lt);
          } else if (kind === 2) {
            p.set(x, y, dk);
            p.set(x, y - 1, dk);
            p.set(x, y - 2, lt);
            p.set(x + 2, y, dk);
            p.set(x + 2, y - 1, lt);
          } else if (kind === 3) {
            p.set(x, y, lt);
            p.set(x + 1, y, lt);
            p.set(x, y + 1, dk);
            p.set(x + 1, y + 1, dk);
          } else {
            p.set(x, y, dk);
            p.set(x + 1, y - 1, dk);
            p.set(x + 1, y - 2, lt);
          }
        }
      }
    const bx0 = (o.border || 0) * T;
    const clumps = Math.floor((o.w - 2 * (o.border || 0)) * (o.h - 2 * (o.border || 0)) / 6);
    for (let k = 0; k < clumps; k++) {
      const x = bx0 + 6 + Math.floor(hash2(k, 31, seed + 54) * (W - 2 * bx0 - 12));
      const y = bx0 + 9 + Math.floor(hash2(k, 32, seed + 54) * (H - 2 * bx0 - 12));
      let ok = true;
      for (let dy = -9; dy <= 2 && ok; dy++) for (let dx = -6; dx <= 6; dx++) if (!isG(x + dx, y + dy)) {
        ok = false;
        break;
      }
      if (!ok) continue;
      for (let dx = -4; dx <= 4; dx++) p.set(x + dx, y + 1, Math.abs(dx) < 4 ? GRASS[0] : shade2(p.get(x + dx, y + 1), -1));
      for (const i of [-4, -2, 0, 2, 4]) {
        const h = 4 + Math.floor(hash2(k, i + 40, seed + 55) * 3) + (i === 0 ? 2 : Math.abs(i) === 2 ? 1 : 0);
        const lean = i < 0 ? -1 : i > 0 ? 1 : 0;
        for (let j = 0; j < h; j++) {
          const px = x + i + (j > h / 2 ? lean : 0);
          p.set(px, y - j, j < 1 ? "#3f7a2e" : j < h - 2 ? "#5a9e3e" : "#8fcf5e");
          if (j > 0 && j < h - 2) p.set(px + 1, y - j, "#4c8a36");
        }
      }
    }
    if (pond) {
      const { x0, y0, x1, y1 } = pond;
      let pads = 0;
      for (let ty = Math.floor(y0 / T); ty * T < y1 && pads < 8; ty++)
        for (let tx = Math.floor(x0 / T); tx * T < x1 && pads < 8; tx++) {
          const cx = tx * T + 4 + Math.floor(hash2(tx, ty, seed + 91) * 8);
          const cy = ty * T + 5 + Math.floor(hash2(tx, ty, seed + 92) * 7);
          if (hash2(tx, ty, seed + 93) > 0.4) continue;
          let ok = true;
          for (let dy = -6; dy <= 6 && ok; dy++) for (let dx = -6; dx <= 6; dx++) if (!isW(cx + dx, cy + dy)) ok = false;
          if (!ok) continue;
          const big = hash2(tx, ty, seed + 94) < 0.5;
          const rx = big ? 3.6 : 2.6;
          const ry = big ? 2.4 : 1.8;
          p.ell(cx + 0.5, cy + 1.5, rx, ry, WATER[4]);
          p.ell(cx, cy, rx, ry, "#4f9a3a");
          p.ell(cx - 0.6, cy - 0.5, rx - 1, ry - 0.8, "#6fbb4a");
          p.set(cx + 1, cy, WATER[2]);
          p.set(cx + 2, cy, WATER[2]);
          if (big) p.set(cx + 3, cy, WATER[2]);
          if (pads % 2 === 0) {
            p.set(cx - 1, cy - 2, "#f29ac0");
            p.set(cx - 2, cy - 1, "#f29ac0");
            p.set(cx, cy - 1, "#f29ac0");
            p.set(cx - 1, cy - 1, "#fde3ee");
            p.set(cx - 1, cy - 3, "#e46f9e");
          }
          pads++;
        }
      let reeds = 0;
      for (let y = y1 - 1; y > y0 && reeds < 9; y -= 3)
        for (let x = x0; x < x1 && reeds < 9; x += 2) {
          if (!GRASS_SET.has(p.get(x, y)) || hash2(x, y, seed + 95) > 0.08) continue;
          let wet = false;
          for (let d = 1; d <= 4 && !wet; d++) if (isW(x - d, y) || isW(x + d, y) || isW(x, y - d)) wet = true;
          if (!wet) continue;
          for (let k = 0; k < 3; k++) {
            const sx = x + k * 2 - 2;
            const h = 6 + Math.floor(hash2(x + k, y, seed + 96) * 4);
            for (let i = 0; i < h; i++) p.set(sx, y - i, i < 2 ? "#3a6e2a" : "#4f8c34");
            p.set(sx - 1, y - h + 4, "#6fae46");
            if (k !== 1) {
              p.rect(sx, y - h - 2, 1, 3, "#7a4a2a");
              p.set(sx, y - h - 3, "#4f8c34");
            }
          }
          reeds++;
          x += 14;
        }
    }
    for (let k = 0; k < W * H / 1400; k++) {
      const x = Math.floor(hash2(k, 3, seed + 60) * W);
      const y = Math.floor(hash2(k, 4, seed + 60) * H);
      if (!GRASS_SET.has(p.get(x, y))) continue;
      const c = ["#fbf7ef", "#f6d35b", "#ef9ab8"][k % 3];
      p.set(x, y - 1, c);
      p.set(x - 1, y, c);
      p.set(x + 1, y, c);
      p.set(x, y + 1, c);
      p.set(x, y, "#f2c14e");
    }
    const bed = new Uint8Array(W * H);
    const anyBed = (x, y) => has(o.soil, x, y) || has(o.wet, x, y);
    for (const set of [o.soil, o.wet])
      if (set)
        for (const key of set) {
          const [tx, ty] = key.split(",").map(Number);
          const wetBed = set === o.wet;
          const pal = wetBed ? WET : SOIL;
          const L = !anyBed(tx - 1, ty);
          const R = !anyBed(tx + 1, ty);
          const U = !anyBed(tx, ty - 1);
          const D = !anyBed(tx, ty + 1);
          for (let y = 0; y < T; y++)
            for (let x = 0; x < T; x++) {
              if (L && x < 1 || R && x > T - 2 || U && y < 1 || D && y > T - 2) continue;
              if (L && U && x + y < 3 || R && U && T - 1 - x + y < 3 || L && D && x + T - 1 - y < 3 || R && D && T - 1 - x + T - 1 - y < 3) continue;
              const X = tx * T + x;
              const Y = ty * T + y;
              const n = hash2(X, Y, seed + 70);
              let c = pal[1];
              if (Y % 4 === 2) c = n < 0.85 ? pal[0] : pal[1];
              else if (Y % 4 === 3 && n < 0.45) c = pal[2];
              if (n > 0.95) c = pal[2];
              if (U && y === 1) c = wetBed ? "#2e1d15" : "#4a3022";
              else if (U && y === 2) c = pal[0];
              if (D && y === T - 2) c = wetBed ? "#7a5a44" : "#9a6b48";
              if (L && x === 1 || R && x === T - 2) c = pal[0];
              p.set(X, Y, c);
              bed[Y * W + X] = 1;
            }
        }
    const bedEdge = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (bed[y * W + x] || !isG(x, y)) continue;
        if (bed[(y - 1) * W + x] || bed[(y + 1) * W + x] || bed[y * W + x - 1] || bed[y * W + x + 1]) bedEdge.push([x, y]);
      }
    for (const [x, y] of bedEdge) p.set(x, y, shade2(p.get(x, y), -1));
    const b = o.border || 0;
    if (b) {
      const open = (x, y) => o.exits && has(o.exits, Math.floor(x / T), Math.floor(y / T));
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const inside2 = x >= b * T && x < W - b * T && y >= b * T && y < H - b * T;
          const near = open(x, y) || open(x - 10, y) || open(x + 10, y) || open(x, y - 10) || open(x, y + 10);
          if (!inside2 && !near) p.set(x, y, "#22402a");
        }
      const kinds = ["round", "pine", "round2", "round", "pine", "round3"];
      const trees = [];
      const add = (cx, base, dark, k2) => trees.push({ cx: Math.round(cx), base: Math.round(base), dark, kind: kinds[k2 % kinds.length] });
      let k = 0;
      for (let x = -16; x < W + 24; x += 24) add(x + hash2(x, 1, seed) * 8, b * T - 26 + hash2(x, 2, seed) * 5, 0.5, k++);
      for (let x = -6; x < W + 24; x += 27) add(x + hash2(x, 3, seed) * 8, b * T - 12 + hash2(x, 4, seed) * 5, 0.28, k++);
      for (let x = 4; x < W + 24; x += 31) add(x + hash2(x, 5, seed) * 8, b * T + 1 + hash2(x, 6, seed) * 3, 0, k++);
      for (let x = -8; x < W + 24; x += 25) add(x + hash2(x, 7, seed) * 8, H + 26 + hash2(x, 8, seed) * 5, 0.2, k++);
      for (let x = 6; x < W + 24; x += 29) add(x + hash2(x, 9, seed) * 8, H + 40 + hash2(x, 10, seed) * 4, 0, k++);
      for (let y = b * T + 10; y < H + 30; y += 18) {
        add(0 + hash2(y, 11, seed) * 4, y + hash2(y, 12, seed) * 5, 0.35, k++);
        add(b * T - 18 + hash2(y, 13, seed) * 3, y + 9 + hash2(y, 14, seed) * 5, 0, k++);
        add(W - hash2(y, 15, seed) * 4, y + hash2(y, 16, seed) * 5, 0.35, k++);
        add(W - b * T + 18 - hash2(y, 17, seed) * 3, y + 9 + hash2(y, 18, seed) * 5, 0, k++);
      }
      const blocks = (t) => {
        for (let y = t.base - 66; y <= t.base + 2; y += 3) for (let x = t.cx - 22; x <= t.cx + 22; x += 3) if (open(x, y)) return true;
        return false;
      };
      const SHADOWC = "#1e2a16";
      const mixed = /* @__PURE__ */ new Map();
      const darkC = (c, t) => {
        const key = c + t;
        if (!mixed.has(key)) mixed.set(key, mix(c, "#1b3324", t));
        return mixed.get(key);
      };
      trees.sort((u, v) => u.base - v.base);
      for (const t of trees) {
        if (blocks(t)) continue;
        const src = forestTree(t.kind);
        const ox = t.cx - Math.floor(src.w / 2);
        const oy = t.base - src.h + 1;
        const mirror = hash2(t.cx, t.base, seed + 97) < 0.5;
        for (let y = 0; y < src.h; y++)
          for (let x = 0; x < src.w; x++) {
            const c = src.d[y * src.w + x];
            if (!c) continue;
            const X = ox + (mirror ? src.w - 1 - x : x);
            const Y = oy + y;
            if (c[0] !== "#") {
              const u = p.get(X, Y);
              if (u && u[0] === "#") p.set(X, Y, mix(u, SHADOWC, 0.3));
              continue;
            }
            p.set(X, Y, t.dark ? darkC(c, t.dark) : c);
          }
      }
      const FILL = "#22402a";
      const bush = forestTree("bush");
      const exitRects = [...o.exits || []].map((k2) => k2.split(",").map(Number));
      const nearExit = (x, y) => exitRects.some(([tx, ty]) => x > tx * T - 56 && x < tx * T + T + 56 && y > ty * T - 56 && y < ty * T + T + 56);
      for (let y = 4; y < H + 4; y += 7)
        for (let x = 4; x < W + 4; x += 8) {
          if (p.get(x, y) !== FILL || !nearExit(x, y)) continue;
          const ox = x - 8;
          const oy = y - 10;
          let hit = false;
          for (let yy = oy; yy < oy + 16 && !hit; yy += 2) for (let xx = ox; xx < ox + 16; xx += 2) if (open(xx, yy)) {
            hit = true;
            break;
          }
          if (hit) continue;
          p.blit(bush, ox, oy, hash2(x, y, seed + 99) < 0.5);
        }
      for (let y = b * T; y < b * T + 6; y++)
        for (let x = b * T; x < W - b * T; x++) {
          const c = p.get(x, y);
          if (GRASS_SET.has(c) && (y < b * T + 3 || hash2(x, y, seed + 98) < 0.5)) p.set(x, y, GRASS[Math.max(0, GRASS.indexOf(c) - 2)]);
        }
    }
    return p.toCanvas();
  }
  function pondInside(x, y) {
    const e = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    const f = Math.min(e(10.5, 36.6, 8.3, 6.1), e(15.2, 31.4, 3.9, 3.5), e(5.8, 41, 3.9, 3.2));
    return f < 1 + (noise(x * 0.9, y * 0.9, 77) - 0.5) * 0.36;
  }

  // src/art/forest.ts
  function forestRing(o) {
    const T = 16;
    const W = o.w * T;
    const H = o.h * T;
    const m = o.m;
    const bd = o.border || 0;
    const b = bd * T;
    const seed = o.seed || 1;
    const CW = W + 2 * m;
    const CH = H + 2 * m;
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = CW;
      c.height = CH;
      return c;
    };
    const back = mk();
    const front = mk();
    const bx = back.getContext("2d");
    const fx = front.getContext("2d");
    bx.fillStyle = "#1d3826";
    bx.fillRect(0, 0, CW, CH);
    const ex = [...o.exits || []].map((k2) => k2.split(",").map(Number));
    const span = (list) => list.length ? [Math.min(...list), Math.max(...list)] : null;
    const cuts = [];
    const west = span(ex.filter(([x]) => x < bd).map(([, y]) => y));
    const east = span(ex.filter(([x]) => x >= o.w - bd).map(([, y]) => y));
    const north = span(ex.filter(([, y]) => y < bd).map(([x]) => x));
    const south = span(ex.filter(([, y]) => y >= o.h - bd).map(([x]) => x));
    if (west) cuts.push({ x0: 0, x1: m + b, y0: m + west[0] * T - 10, y1: m + (west[1] + 1) * T + 10, a: m + west[0] * T, z: m + (west[1] + 1) * T, along: "x" });
    if (east) cuts.push({ x0: m + W - b, x1: CW, y0: m + east[0] * T - 10, y1: m + (east[1] + 1) * T + 10, a: m + east[0] * T, z: m + (east[1] + 1) * T, along: "x" });
    if (north) cuts.push({ x0: m + north[0] * T - 10, x1: m + (north[1] + 1) * T + 10, y0: 0, y1: m + b, a: m + north[0] * T, z: m + (north[1] + 1) * T, along: "y" });
    if (south) cuts.push({ x0: m + south[0] * T - 10, x1: m + (south[1] + 1) * T + 10, y0: m + H - b, y1: CH, a: m + south[0] * T, z: m + (south[1] + 1) * T, along: "y" });
    for (const c of cuts) {
      const p = new Pix(c.x1 - c.x0, c.y1 - c.y0);
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++) {
          const X = c.x0 + x;
          const Y = c.y0 + y;
          const across = c.along === "x" ? Y : X;
          const n = (hash2(X, Y, seed + 3) - 0.5) * 2 + (noise(X / 5, Y / 5, seed + 4) - 0.5) * 3;
          const dirt = across >= c.a + 1 + n && across < c.z - 1 - n;
          const v = fbm(X, Y, seed);
          p.set(x, y, dirt ? DIRT[Math.max(0, Math.min(3, Math.floor(fbm(X * 1.6, Y * 1.6, seed + 40) * 4.4 - 0.2)))] : v < 0.4 ? GRASS[0] : v < 0.7 ? GRASS[1] : GRASS[2]);
        }
      bx.drawImage(p.toCanvas(), c.x0, c.y0);
    }
    const hitsCut = (cx, base) => cuts.some((c) => cx + 18 > c.x0 && cx - 18 < c.x1 && base > c.y0 + 4 && base - 60 < c.y1);
    const kinds = ["round", "pine", "round2", "round", "pine", "round3"];
    const sprite = (kind, dark) => cached("ring:" + kind + ":" + dark, () => {
      const src = forestTree(kind);
      const q = new Pix(src.w, src.h);
      for (let i = 0; i < src.d.length; i++) {
        const c = src.d[i];
        if (c) q.d[i] = c[0] === "#" ? mix(c, "#1b3324", dark) : c;
      }
      return q;
    });
    const draw = (ctx, list) => {
      list.sort((u, v) => u.base - v.base);
      for (const t of list) ctx.drawImage(sprite(t.kind, t.dark), Math.round(t.cx - 24), Math.round(t.base - 71));
    };
    const all = [];
    let k = 0;
    for (let y = -10, row = 0; y < CH + 72; y += 17, row++)
      for (let x = -24 + row % 2 * 12; x < CW + 24; x += 24) {
        const cx = x + hash2(x, y, seed + 7) * 10;
        const base = y + hash2(x, y, seed + 8) * 6;
        k++;
        if (cx - 24 > m + 8 && cx + 24 < m + W - 8 && base - 72 > m + 8 && base < m + H - 8) continue;
        if (hitsCut(cx, base)) continue;
        all.push({ cx, base, kind: kinds[k % kinds.length], dark: [0.3, 0.38, 0.46][Math.floor(hash2(x, y, seed + 9) * 3)] });
      }
    draw(bx, all);
    const ring = [];
    k = 0;
    for (let x = m - 30; x < m + W + 30; x += 25) {
      ring.push({ cx: x + hash2(x, 1, seed + 11) * 8, base: m + 4 + hash2(x, 2, seed + 11) * 8, kind: kinds[k++ % kinds.length], dark: 0.45 });
      ring.push({ cx: x + 12 + hash2(x, 3, seed + 11) * 8, base: m + H + 36 + hash2(x, 4, seed + 11) * 6, kind: kinds[k++ % kinds.length], dark: 0.3 });
    }
    for (let y = m + 30; y < m + H + 30; y += 19) {
      ring.push({ cx: m - 2 + hash2(y, 5, seed + 11) * 6, base: y + hash2(y, 6, seed + 11) * 5, kind: kinds[k++ % kinds.length], dark: 0.38 });
      ring.push({ cx: m + W + 2 - hash2(y, 7, seed + 11) * 6, base: y + hash2(y, 8, seed + 11) * 5, kind: kinds[k++ % kinds.length], dark: 0.38 });
    }
    draw(fx, ring.filter((t) => !hitsCut(t.cx, t.base)));
    return { back, front };
  }

  // src/art/ground.ts
  function rnd(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
  var GROUND = {
    grass(p, v) {
      const G3 = "#7fb35a";
      const R = ramp(G3);
      p.rect(0, 0, 16, 16, G3);
      const r = rnd(17 + v * 31);
      for (let i = 0; i < 9; i++) {
        const x = Math.floor(r() * 15);
        const y = Math.floor(r() * 14) + 1;
        p.set(x, y, R.mid);
        p.set(x + 1, y - 1, R.hi);
      }
      if (v === 2) {
        p.set(4, 5, "#ffffff");
        p.set(11, 11, "#f6d35b");
      }
      if (v === 3) {
        p.set(6, 9, R.lo);
        p.set(7, 8, R.hi);
        p.set(8, 9, R.lo);
      }
    },
    path(p, v) {
      const D = "#d8b98a";
      p.rect(0, 0, 16, 16, D);
      const r = rnd(5 + v * 13);
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(r() * 15);
        const y = Math.floor(r() * 15);
        p.rect(x, y, 2, 1, ramp(D).mid);
        p.set(x, y - 1, ramp(D).hi);
      }
    },
    soil(p, _v) {
      const S = "#9a6a48";
      p.rect(0, 0, 16, 16, S);
      for (let y = 2; y < 16; y += 4) {
        p.rect(1, y, 14, 1, ramp(S).lo);
        p.rect(1, y - 1, 14, 1, ramp(S).hi);
      }
    },
    wet(p, _v) {
      const S = "#6e4a34";
      p.rect(0, 0, 16, 16, S);
      for (let y = 2; y < 16; y += 4) {
        p.rect(1, y, 14, 1, ramp(S).lo);
        p.rect(1, y - 1, 14, 1, ramp(S).hi);
      }
      p.set(4, 6, "#9fc8e8");
      p.set(11, 10, "#9fc8e8");
    },
    // 木地板：一块 16×16 里四条横木板，接缝错开，有木纹
    floor(p, v) {
      const W = "#c99a6a";
      const R = ramp(W);
      const r = rnd(31 + v * 17);
      for (let k = 0; k < 4; k++) {
        const y = k * 4;
        const tone = [W, mix(W, R.hi, 0.35), mix(W, R.mid, 0.4), W][(k + v) % 4];
        p.rect(0, y, 16, 3, tone);
        p.rect(0, y + 3, 16, 1, R.lo);
        const seam = Math.floor(r() * 12) + 2;
        p.rect(seam, y, 1, 3, R.mid);
        if (r() < 0.45) p.rect(Math.floor(r() * 12), y + 1, 3, 1, mix(tone, R.mid, 0.45));
      }
    },
    // 墙：上面是有小花纹的墙纸，下面是木护墙板和踢脚线（两格高，上下两半分开画）
    wall(p, _v) {
      const P = "#efe0c4";
      p.rect(0, 0, 16, 16, P);
      for (let x = 2; x < 16; x += 8) for (let y = 3; y < 16; y += 8) {
        p.set(x + (y >> 3) % 2 * 4, y, "#e0b8a0");
        p.set(x + (y >> 3) % 2 * 4 + 1, y, "#e0b8a0");
      }
      for (let x = 0; x < 16; x += 8) p.rect(x, 0, 1, 16, mix(P, "#d8c4a0", 0.6));
    },
    wainscot(p, _v) {
      const P = "#efe0c4";
      p.rect(0, 0, 16, 5, P);
      for (let x = 0; x < 16; x += 8) p.rect(x, 0, 1, 5, mix(P, "#d8c4a0", 0.6));
      p.rect(0, 5, 16, 1, "#8a5a3b");
      p.sRect(0, 6, 16, 8, "#b07a4a", { noHi: true });
      for (let x = 3; x < 16; x += 8) p.rect(x, 7, 1, 6, ramp("#b07a4a").lo);
      p.rect(0, 14, 16, 2, "#6a4a32");
    }
  };

  // src/art/person.ts
  var HATS = {
    straw(p, y, _dir) {
      p.sEll(8, y + 4, 8, 2, "#e8c46a");
      p.sEll(8, y + 2, 4.5, 3, "#e8c46a");
      p.rect(4, y + 3, 8, 1, "#c8463a");
    },
    cap(p, y, dir) {
      p.sEll(8, y + 3, 6.5, 3.6, "#3b6ea8");
      if (dir !== "back") p.rect(dir === "side" ? 9 : 3, y + 5, dir === "side" ? 7 : 10, 2, ramp("#3b6ea8").mid);
      p.set(8, y, ramp("#3b6ea8").hi);
    },
    beanie(p, y) {
      p.sEll(8, y + 3.5, 6.8, 4, "#c8463a");
      p.rect(2, y + 5, 12, 2, "#f4ece0");
      p.sEll(8, y - 0.5, 1.8, 1.6, "#f4ece0");
    },
    flower(p, y) {
      for (const [x, c] of [[3, "#ef7fa0"], [6, "#f6d35b"], [9, "#ffffff"], [12, "#9b7fd1"]]) {
        p.ell(x + 0.5, y + 3.5, 1.6, 1.6, c);
        p.set(x, y + 3, "#f6d35b");
      }
      p.rect(2, y + 5, 12, 1, "#6aa35a");
    },
    bow(p, y) {
      p.poly([[8, y + 3], [3, y + 0], [3, y + 6]], "#ef7fa0");
      p.poly([[8, y + 3], [13, y + 0], [13, y + 6]], ramp("#ef7fa0").mid);
      p.rect(7, y + 2, 2, 2, ramp("#ef7fa0").lo);
    },
    crown(p, y) {
      p.poly([[3, y + 6], [3, y + 1], [5.5, y + 3.5], [8, y], [10.5, y + 3.5], [13, y + 1], [13, y + 6]], "#f2c14e");
      p.set(8, y + 3, "#e85d75");
    },
    party(p, y) {
      p.poly([[4, y + 6], [12, y + 6], [8, y - 3]], "#e85d75");
      p.line(6, y + 3, 9, y + 5, "#f6d35b");
      p.line(7, y, 10, y + 2, "#f6d35b");
      p.sEll(8, y - 3, 1.6, 1.6, "#f6d35b");
    },
    beret(p, y) {
      p.sEll(7, y + 3.5, 6.5, 3, "#4a5a8a");
      p.set(8, y, "#4a5a8a");
    },
    grad(p, y) {
      p.poly([[0, y + 2], [8, y - 1], [16, y + 2], [8, y + 5]], "#2b2a28");
      p.sRect(4, y + 3, 8, 3, "#2b2a28", { noHi: true });
      p.line(12, y + 2, 13, y + 7, "#f2c14e");
    }
  };
  var PET_HAT_AT = { crab: 4, cat: 0, shiba: 0, fox: -1, rabbit: 1, hamster: 4, penguin: 1, duck: -1, frog: 3, piglet: 1, lamb: 0, corgi: -1, hedgehog: 2, squirrel: 0, owl: 1, otter: 2, raccoon: 0, koala: 1, redpanda: 0, panda: 1, chick: 4, medaka: 4, goldfish: 4, guppy: 4, koi: 4, goldkoi: 4 };
  var AV = {
    headFront: [
      "................",
      ".....hhhhhh.....",
      "...hhjjjjhhhh...",
      "..hhjjhhhhhhhH..",
      ".hhjhhhhhhhhhHh.",
      ".hhhhhhhhhhhhHh.",
      ".hhhhhhhhhhhhHh.",
      ".hhssshhsssshHh.",
      ".hhssssssssssHh.",
      ".hhswesssswesHh.",
      ".hhseesssseesHh.",
      "..hccssssssccH..",
      "...SsssmmsssS...",
      "....SSssssSS...."
    ],
    headSide: [
      "................",
      "......hhhhh.....",
      "....hhjjjhhhh...",
      "...hhjjhhhhhhh..",
      "..hhjhhhhhhhhhh.",
      "..hhhhhhhhhhhhh.",
      "..hhhhhhhhhhhhh.",
      "..hhhhhhhhhssss.",
      "..hHhhhhsssssss.",
      "..hHhhhSssswess.",
      "..hHhhsSssseess.",
      "...Hhhssssscsss.",
      "....HSsssssssmS.",
      ".....SSsssssSS.."
    ],
    headBack: [
      "................",
      ".....hhhhhh.....",
      "...hhjjjjhhhh...",
      "..hhjjhhhhhhhH..",
      ".hhjhhhhhhhhhHh.",
      ".hhhhhhhhhhhhHh.",
      ".hhhhhhhhhhhhHh.",
      ".hhhhhhhhhhhhHh.",
      ".hhhhhhhhhhhhHh.",
      ".hHhhhhhhhhhhHh.",
      ".hHhhhhhhhhhHHh.",
      "..hHhhhhhhhhHH..",
      "...SHHhhhhHHS...",
      "....SSssssSS...."
    ],
    bodyFront: [
      ".....tSSSSt.....",
      "...ttytTTttTT...",
      "..ttoytttttoTT..",
      "..tToytttttoTT..",
      "..tTottttttoTT..",
      "..tTottttttoTT..",
      "..tToTTTTTToTT..",
      "..sSobbbbbboSS..",
      "....bbbbbbbB....",
      "....bbbbbbbB...."
    ],
    bodyFrontAct: [
      ".....tSSSSt.....",
      "...ttytTTttTT...",
      "..ttyttttttttT..",
      "..tTotttttttTT..",
      "..tToTTsSSTTTT..",
      "...TTosSSSoTT...",
      "....tTTTTTTT....",
      "....obbbbbbo....",
      "....bbbbbbbB....",
      "....bbbbbbbB...."
    ],
    bodyBack: [
      ".....tSSSSt.....",
      "...ttytttttTT...",
      "..ttoytttttoTT..",
      "..tToytttttoTT..",
      "..tTottttttoTT..",
      "..tTottttttoTT..",
      "..tToTTTTTToTT..",
      "..sSobbbbbboSS..",
      "....bbbbbbbB....",
      "....bbbbbbbB...."
    ],
    bodySide: [
      "......tSSt......",
      ".....yttttttT...",
      ".....ytottTtT...",
      ".....ytottTtT...",
      ".....ytottTtT...",
      ".....ttottTtT...",
      ".....TToTTTTT...",
      ".....bbosSbbB...",
      ".....bbbbbbbB...",
      ".....bbbbbbbB..."
    ],
    bodySideAct: [
      "......tSSt......",
      ".....yttttttT...",
      ".....ytotttTtT..",
      ".....yttooTTTTsS",
      ".....yttttTttTSS",
      ".....tttttTtT...",
      ".....TTTTTTTT...",
      ".....bbbbbbbB...",
      ".....bbbbbbbB...",
      ".....bbbbbbbB..."
    ],
    legsFront: ["....bbB..bbB....", "....bbB..bbB....", "....bbB..bbB....", "....bbB..bbB....", "...fffF..fffF...", "...FFFF..FFFF...", "................", "................"],
    legsFrontWalk: ["....bbB..bbB....", "....bbB..bbB....", "....bbB..bbB....", "...fffF..bbB....", "...FFFF..fffF...", ".........FFFF...", "................", "................"],
    legsSide: ["......bbBbbB....", "......bbBbbB....", "......bbBbbB....", "......bbBbbB....", "......fffffffF..", "......FFFFFFFF..", "................", "................"],
    legsSideWalk: ["......bBbbbB....", ".....bBB.bbbB...", ".....BB...bbB...", "....BB.....bbB..", "...FFF.....ffffF", "...........FFFFF", "................", "................"]
  };
  var mirrorRow = (r) => r.split("").reverse().join("");
  var LEGS_SIT = ["................", "................", "................", "....bbB..bbB....", "...fffF..fffF...", "...FFFF..FFFF...", "................", "................"];
  var SWAP_LEG = { b: "B", B: "b", f: "F", F: "f" };
  function person(p, look, f, dir) {
    dir = dir || "front";
    const skin = look.skin || "#f3c9a5";
    const hair = look.hair || "#6b4a35";
    const top = look.top || "#e8e2d4";
    const bottom = look.bottom || "#5b6b8a";
    const shoes = look.shoes || "#6a4a3a";
    const HR = ramp(hair);
    const SK = ramp(skin);
    const TP = ramp(top);
    const BT = ramp(bottom);
    const SH = ramp(shoes);
    const act = f === "act";
    const walk = f === "walk1" || f === "walk2";
    const y0 = f === "walkp" ? -1 : f === "sit" ? 3 : 0;
    const head = AV[dir === "side" ? "headSide" : dir === "back" ? "headBack" : "headFront"];
    const body = AV[dir === "side" ? act ? "bodySideAct" : "bodySide" : dir === "back" ? "bodyBack" : act ? "bodyFrontAct" : "bodyFront"];
    let legs = AV[dir === "side" ? walk ? "legsSideWalk" : "legsSide" : walk ? "legsFrontWalk" : "legsFront"];
    if (f === "walk2") legs = dir === "side" ? legs.map((r) => r.replace(/[bBfF]/g, (c) => SWAP_LEG[c])) : legs.map(mirrorRow);
    if (f === "sit") legs = LEGS_SIT;
    const pal = {
      h: hair,
      H: HR.mid,
      j: HR.hi,
      s: skin,
      S: SK.mid,
      c: "#f2a0a0",
      e: INK,
      w: WHITE,
      m: "#c0705f",
      t: top,
      T: TP.mid,
      y: TP.hi,
      o: TP.lo,
      b: bottom,
      B: BT.mid,
      f: shoes,
      F: SH.lo
    };
    const ts = look.topStyle || "tee";
    const bs = look.bottomStyle || "pants";
    const colorAt = (ch, x, y) => {
      if ((ch === "t" || ch === "y" || ch === "T") && y >= 14 && y <= 20) {
        if (ts === "stripe" && y >= 16 && y % 2 === 0) return ch === "T" ? mix("#f4ece0", TP.mid, 0.35) : "#f4ece0";
        if (ts === "overalls" && dir !== "side") {
          if (y >= 17 && x >= 5 && x <= 10) return ch === "T" ? BT.mid : bottom;
          if ((y === 15 || y === 16) && (x === 5 || x === 10)) return BT.mid;
        }
        if (ts === "overalls" && dir === "side" && y >= 17 && x >= 5 && x <= 12) return ch === "T" ? BT.mid : bottom;
      }
      if (ts === "overalls" && dir === "front" && y === 17 && (x === 5 || x === 10)) return "#f2c14e";
      if (ts === "hoodie" && dir === "front") {
        if (y === 14 && (x === 5 || x === 10)) return TP.mid;
        if ((x === 6 || x === 9) && y >= 15 && y <= 17 && ch !== "o") return TP.hi;
        if (y === 19 && x >= 6 && x <= 9) return TP.lo;
      }
      if (bs === "shorts" && (ch === "b" || ch === "B") && y >= 25) return ch === "B" ? SK.mid : skin;
      return pal[ch];
    };
    const put = (rows, oy, shift) => {
      rows.forEach((r, j) => {
        for (let x = 0; x < 16; x++) {
          const ch = r[x];
          if (ch === ".") continue;
          const y = oy + j;
          p.set(x, y + shift, colorAt(ch, x, y));
        }
      });
    };
    const hs = look.hairStyle || "short";
    if (hs === "long") {
      if (dir === "front") for (let y = 9; y <= 18; y++) for (const x of [1, 2, 13, 14]) p.set(x, y + y0, x === 2 || x === 13 ? HR.mid : hair);
      if (dir === "side") for (let y = 9; y <= 18; y++) for (let x = 2; x <= 5; x++) p.set(x, y + y0, x === 5 ? HR.mid : hair);
    }
    put(head.concat(body), 0, y0);
    put(legs, 24, 0);
    if (bs === "skirt") {
      for (let y = 21; y <= 25; y++) {
        const w = 4 + (y - 21);
        for (let x = 8 - w; x < 8 + w; x++) if (x >= 1 && x <= 14) p.set(x, y + (y < 24 ? y0 : 0), x >= 8 + w - 2 ? BT.mid : y === 25 ? BT.hi : bottom);
      }
      for (let y = 26; y <= 27; y++) for (const x of dir === "side" ? [7, 8, 9, 10] : [4, 5, 10, 11]) if (p.get(x, y)) p.set(x, y, skin);
    }
    if (hs === "long" && dir === "back") for (let y = 12; y <= 19; y++) for (let x = 3; x <= 12; x++) p.set(x, y + y0, x === 12 || y === 19 ? HR.mid : x === 5 && y < 16 ? HR.hi : hair);
    if (hs === "bun") {
      const by = dir === "side" ? 1 : 0;
      const bx = dir === "side" ? 5 : 8;
      p.sEll(bx, 1.5 + by + y0, 2.6, 2, hair);
      p.set(bx - 1, 1 + by + y0, HR.hi);
    }
    if (walk) {
      const hy = 21 + y0;
      const fwd = f === "walk1";
      if (dir === "side") {
        const hand = [p.get(8, hy), p.get(9, hy)];
        const pants = p.get(11, hy) || bottom;
        if (hand[0] && hand[1]) {
          const nx = fwd ? 10 : 6;
          p.set(8, hy, pants);
          p.set(9, hy, pants);
          p.set(nx, hy, hand[0]);
          p.set(nx + 1, hy, hand[1]);
        }
      } else {
        for (const [x0, down] of [[2, fwd], [12, !fwd]]) {
          const a = [p.get(x0, hy), p.get(x0 + 1, hy)];
          if (!a[0] && !a[1]) continue;
          if (down) {
            const sleeve = [p.get(x0, hy - 1), p.get(x0 + 1, hy - 1)];
            p.set(x0, hy + 1, a[0]);
            p.set(x0 + 1, hy + 1, a[1]);
            if (sleeve[0]) p.set(x0, hy, sleeve[0]);
            if (sleeve[1]) p.set(x0 + 1, hy, sleeve[1]);
          } else {
            p.set(x0, hy - 1, a[0]);
            p.set(x0 + 1, hy - 1, a[1]);
            p.clear(x0, hy);
            p.clear(x0 + 1, hy);
          }
        }
      }
    }
    if (look.hat && HATS[look.hat]) HATS[look.hat](p, y0, dir);
  }

  // src/art/pets.ts
  function eyeKind(f) {
    return f === "blink" || f === "sleep" ? "closed" : f === "happy" ? "happy" : f === "sick" ? "sick" : "open";
  }
  function bob(f) {
    return f === "walk1" ? -1 : f === "happy" ? -2 : 0;
  }
  function feet(f) {
    return f === "walk1" ? [1, 0] : f === "walk2" ? [0, 1] : [0, 0];
  }
  function chibi(p, f, o) {
    const y0 = bob(f);
    const [a, b] = feet(f);
    const B = o.body;
    const belly = o.belly || B;
    if (o.tail) o.tail(p, y0);
    p.sEll(16, 24 + y0, 8, 6, B);
    p.ell(16, 25 + y0, 4.5, 4, belly);
    p.sEll(11.5, 29.5 + y0 - a, 2.6, 1.8, o.paw || belly);
    p.sEll(20.5, 29.5 + y0 - b, 2.6, 1.8, o.paw || belly);
    if (o.ears) o.ears(p, y0);
    p.sEll(16, 13 + y0, o.hw || 11, o.hh || 8.5, B);
    if (o.face) o.face(p, y0);
    const k = eyeKind(f);
    eye(p, 10, 12 + y0, k, 3);
    eye(p, 21, 12 + y0, k, 3);
    if (f === "happy" || f === "sick") p.rect(15, 18 + y0, 2, 1, f === "sick" ? INK : "#c0505a");
    blush(p, 7, 16 + y0);
    blush(p, 23, 16 + y0);
  }
  function cuteFish(p, f, body, fin, o) {
    o = o || {};
    const y0 = (f === "walk1" ? -1 : f === "happy" ? -2 : 0) + 2;
    const sw = f === "walk1" ? -2 : f === "walk2" ? 2 : f === "happy" ? -3 : 0;
    p.poly([[22, 16 + y0], [30, 8 + y0 + sw], [31, 16 + y0], [30, 24 + y0 - sw]], fin);
    if (o.fancy) {
      p.poly([[23, 16 + y0], [31, 5 + y0 + sw], [29, 14 + y0]], o.fin2 || ramp(fin).mid);
      p.poly([[23, 16 + y0], [31, 27 + y0 - sw], [29, 18 + y0]], o.fin3 || ramp(fin).mid);
    }
    p.poly([[11, 9 + y0], [18, 5 + y0], [20, 10 + y0]], fin);
    p.poly([[13, 22 + y0], [17, 27 + y0], [19, 22 + y0]], fin);
    p.sEll(14, 16 + y0, 10, 8, body);
    p.ell(13, 19 + y0, 6.5, 3.5, lighten(body, 0.08));
    if (o.spots) {
      p.ell(15, 12 + y0, 3.5, 2.5, o.spots);
      p.ell(20, 17 + y0, 2.2, 2.4, o.spots);
      p.ell(10, 10 + y0, 1.8, 1.4, o.spots);
    }
    if (o.line) p.rect(8, 16 + y0, 13, 1, o.line);
    if (o.shine) for (const [x, y] of [[12, 12], [17, 14], [15, 19]]) p.set(x, y + y0, "#fff1b8");
    p.sEll(15, 19 + y0, 2.2, 1.4, ramp(fin).mid);
    const k = eyeKind(f);
    eye(p, 8, 13 + y0, k, 3);
    if (f === "happy" || f === "sick") p.rect(5, 18 + y0, 2, 1, f === "sick" ? INK : "#c0505a");
    else p.set(5, 18 + y0, ramp(body).lo);
    blush(p, 9, 18 + y0);
  }
  var PETS = {
    crab(p, f) {
      const B = "#d97757";
      const R = ramp(B);
      const y0 = 12 + bob(f);
      const [a, b] = feet(f);
      for (const [i, x] of [[0, 8], [1, 11], [2, 14]]) {
        const lift = i % 2 ? a : b;
        p.line(x, y0 + 12, x - 2, y0 + 15 - lift, R.lo);
        p.line(31 - x, y0 + 12, 33 - x, y0 + 15 - (i % 2 ? b : a), R.lo);
      }
      const up = f === "happy" ? 3 : f === "walk1" ? 1 : 0;
      for (const side of [0, 1]) {
        const sx = (x) => side ? 31 - x : x;
        p.line(sx(6), y0 + 6, sx(3), y0 + 3 - up, R.mid);
        p.line(sx(6), y0 + 7, sx(3), y0 + 4 - up, R.mid);
        p.sEll(side ? 28.5 : 3.5, y0 - 1 - up, 3.6, 3.4, B);
        p.clear(sx(3), y0 - 4 - up);
        p.clear(sx(4), y0 - 4 - up);
        p.clear(sx(3), y0 - 3 - up);
        p.clear(sx(4), y0 - 3 - up);
        p.set(sx(3), y0 - 2 - up, R.lo);
      }
      p.sRect(6, y0, 20, 12, B, { bottom: 2 });
      for (const [x, y] of [[6, y0], [25, y0], [6, y0 + 11], [25, y0 + 11]]) p.clear(x, y);
      p.rect(7, y0 + 1, 6, 1, R.hi);
      const k = eyeKind(f);
      eye(p, 11, y0 + 3, k, 4);
      eye(p, 19, y0 + 3, k, 4);
      if (f === "happy") p.rect(15, y0 + 7, 2, 1, INK);
      if (f === "sick") p.rect(14, y0 + 8, 4, 1, INK);
      blush(p, 8, y0 + 7);
      blush(p, 22, y0 + 7);
    },
    cat(p, f) {
      const B = "#f0a75a";
      chibi(p, f, {
        body: B,
        belly: "#fff1dc",
        tail(p2, y0) {
          p2.line(23, 25 + y0, 27, 21 + y0, ramp(B).base);
          p2.line(24, 25 + y0, 28, 21 + y0, ramp(B).mid);
          p2.line(27, 21 + y0, 27, 16 + y0, ramp(B).base);
          p2.line(28, 21 + y0, 28, 16 + y0, ramp(B).mid);
          p2.set(27, 15 + y0, ramp(B).lo);
        },
        ears(p2, y0) {
          p2.poly([[6, 10 + y0], [8, 1 + y0], [14, 6 + y0]], ramp(B).base);
          p2.poly([[26, 10 + y0], [24, 1 + y0], [18, 6 + y0]], ramp(B).mid);
          p2.poly([[8, 7 + y0], [9, 3.5 + y0], [11.5, 6 + y0]], "#f4a6a0");
          p2.poly([[24, 7 + y0], [23, 3.5 + y0], [20.5, 6 + y0]], "#f4a6a0");
        },
        face(p2, y0) {
          for (const x of [13, 16, 19]) p2.rect(x, 5 + y0, 1, 3, ramp(B).lo);
          p2.ell(16, 17 + y0, 4.5, 3, "#fff1dc");
          p2.rect(15, 15 + y0, 2, 1, "#e98080");
          for (const [x, y] of [[14, 17], [15, 18], [16, 17], [17, 18], [18, 17]]) p2.set(x, y + y0, INK);
        }
      });
    },
    shiba(p, f) {
      const B = "#e39a4f";
      const C = "#fff3e0";
      chibi(p, f, {
        body: B,
        belly: C,
        paw: C,
        tail(p2, y0) {
          p2.sEll(25, 20 + y0, 3.5, 3.5, B);
          p2.ell(25, 20 + y0, 1.5, 1.5, C);
        },
        ears(p2, y0) {
          p2.poly([[6, 10 + y0], [8, 2 + y0], [14, 6 + y0]], ramp(B).base);
          p2.poly([[26, 10 + y0], [24, 2 + y0], [18, 6 + y0]], ramp(B).mid);
          p2.poly([[8.5, 7 + y0], [9.2, 4 + y0], [11.5, 6 + y0]], ramp(B).lo);
          p2.poly([[23.5, 7 + y0], [22.8, 4 + y0], [20.5, 6 + y0]], ramp(B).lo);
        },
        face(p2, y0) {
          p2.ell(10.5, 17 + y0, 4.5, 3.4, C);
          p2.ell(21.5, 17 + y0, 4.5, 3.4, C);
          p2.ell(16, 18 + y0, 4, 2.6, C);
          p2.rect(10, 9 + y0, 2, 1, C);
          p2.rect(21, 9 + y0, 2, 1, C);
          p2.rect(15, 15 + y0, 2, 2, INK);
          p2.set(15, 15 + y0, "#6a5a5a");
        }
      });
    },
    fox(p, f) {
      const B = "#e8793a";
      const C = "#fff4e8";
      const D = "#3a2a26";
      chibi(p, f, {
        body: B,
        belly: C,
        paw: D,
        hw: 12,
        tail(p2, y0) {
          p2.sEll(25.5, 19 + y0, 4.5, 6, B);
          p2.ell(26.5, 14.5 + y0, 2.6, 2.4, C);
        },
        ears(p2, y0) {
          p2.poly([[5, 11 + y0], [6, 0 + y0], [14, 6 + y0]], ramp(B).base);
          p2.poly([[27, 11 + y0], [26, 0 + y0], [18, 6 + y0]], ramp(B).mid);
          p2.poly([[6, 3 + y0], [6, 0 + y0], [8.5, 1.8 + y0]], D);
          p2.poly([[26, 3 + y0], [26, 0 + y0], [23.5, 1.8 + y0]], D);
          p2.poly([[7.5, 8 + y0], [8, 4 + y0], [11, 6.5 + y0]], "#f2b8a0");
          p2.poly([[24.5, 8 + y0], [24, 4 + y0], [21, 6.5 + y0]], "#f2b8a0");
        },
        face(p2, y0) {
          p2.poly([[4, 13 + y0], [16, 15 + y0], [16, 21 + y0], [10, 21 + y0]], C);
          p2.poly([[28, 13 + y0], [16, 15 + y0], [16, 21 + y0], [22, 21 + y0]], C);
          p2.rect(15, 16 + y0, 2, 2, INK);
        }
      });
    },
    rabbit(p, f) {
      const B = "#f1e8dc";
      const P = "#f2a3a0";
      chibi(p, f, {
        body: B,
        belly: "#fffaf2",
        ears(p2, y0) {
          const wig = f === "happy" ? -1 : 0;
          p2.sEll(10.5, 4 + y0 + wig, 2.8, 6.5, B);
          p2.sEll(21.5, 4 + y0 + wig, 2.8, 6.5, B);
          p2.ell(10.5, 4.5 + y0 + wig, 1.2, 4.5, P);
          p2.ell(21.5, 4.5 + y0 + wig, 1.2, 4.5, P);
        },
        face(p2, y0) {
          p2.rect(15, 15 + y0, 2, 1, P);
          p2.set(15, 16 + y0, INK);
          p2.set(16, 16 + y0, INK);
          p2.set(14, 17 + y0, INK);
          p2.set(17, 17 + y0, INK);
        }
      });
    },
    hamster(p, f) {
      const B = "#e8b07a";
      const C = "#fff3e0";
      const y0 = bob(f);
      const [a, b] = feet(f);
      p.sEll(9, 6 + y0, 3, 3, B);
      p.sEll(23, 6 + y0, 3, 3, B);
      p.ell(9, 6 + y0, 1.4, 1.4, "#f2a3a0");
      p.ell(23, 6 + y0, 1.4, 1.4, "#f2a3a0");
      p.sEll(16, 18 + y0, 12.5, 11, B);
      p.ell(16, 22 + y0, 9.5, 7.5, C);
      p.sEll(11, 29.5 + y0 - a, 2.4, 1.6, "#f2a3a0");
      p.sEll(21, 29.5 + y0 - b, 2.4, 1.6, "#f2a3a0");
      p.sEll(13, 23 + y0, 1.8, 1.5, "#f2a3a0");
      p.sEll(19, 23 + y0, 1.8, 1.5, "#f2a3a0");
      const k = eyeKind(f);
      eye(p, 10, 14 + y0, k, 3);
      eye(p, 21, 14 + y0, k, 3);
      p.rect(15, 18 + y0, 2, 1, "#e98080");
      blush(p, 6, 19 + y0);
      blush(p, 24, 19 + y0);
    },
    penguin(p, f) {
      const B = "#3e4a63";
      const W = "#fbf7ef";
      const O = "#f0a23a";
      const y0 = bob(f);
      const [a, b] = feet(f);
      const flap = f === "happy" ? -3 : f === "walk1" ? -1 : 0;
      p.sEll(5.5, 19 + y0 + flap, 2.5, 5.5, B);
      p.sEll(26.5, 19 + y0 + flap, 2.5, 5.5, B);
      p.sEll(16, 17 + y0, 10.5, 12.5, B);
      p.ell(16, 21 + y0, 7, 8.5, W);
      p.ell(12, 11 + y0, 3.8, 3.4, W);
      p.ell(20, 11 + y0, 3.8, 3.4, W);
      p.ell(16, 13 + y0, 5, 3, W);
      p.rect(10, 29 + y0 - a, 5, 2, O);
      p.rect(17, 29 + y0 - b, 5, 2, O);
      const k = eyeKind(f);
      eye(p, 11, 10 + y0, k, 3);
      eye(p, 20, 10 + y0, k, 3);
      p.poly([[13.5, 14 + y0], [18.5, 14 + y0], [16, 17 + y0]], O);
      blush(p, 8, 15 + y0);
      blush(p, 22, 15 + y0);
    },
    duck(p, f) {
      const B = "#f6d35b";
      const O = "#f08a3a";
      const y0 = bob(f);
      const [a, b] = feet(f);
      p.rect(10, 29 + y0 - a, 5, 2, O);
      p.rect(17, 29 + y0 - b, 5, 2, O);
      p.sEll(16, 22 + y0, 11, 7.5, B);
      p.sEll(24, 21 + y0 + (f === "happy" ? -2 : 0), 4, 3, ramp(B).mid);
      p.sEll(16, 11 + y0, 8, 7.5, B);
      p.rect(15, 2 + y0, 2, 2, B);
      p.set(17, 2 + y0, B);
      const k = eyeKind(f);
      eye(p, 11, 9 + y0, k, 3);
      eye(p, 20, 9 + y0, k, 3);
      p.sEll(16, 14.5 + y0, 4, 1.8, O);
      blush(p, 8, 13 + y0);
      blush(p, 22, 13 + y0);
    },
    frog(p, f) {
      const B = "#7cb46b";
      const L = "#d9eab0";
      const y0 = bob(f);
      const [a, b] = feet(f);
      p.sEll(8, 28.5 + y0 - a, 4, 2.2, B);
      p.sEll(24, 28.5 + y0 - b, 4, 2.2, B);
      p.sEll(16, 20 + y0, 13, 9, B);
      p.ell(16, 24 + y0, 8.5, 4.5, L);
      p.sEll(9.5, 10.5 + y0, 5, 4.6, B);
      p.sEll(22.5, 10.5 + y0, 5, 4.6, B);
      p.ell(9.5, 10.5 + y0, 3.2, 3, WHITE);
      p.ell(22.5, 10.5 + y0, 3.2, 3, WHITE);
      const k = eyeKind(f);
      if (k === "open") {
        p.rect(9, 10 + y0, 2, 2, INK);
        p.rect(22, 10 + y0, 2, 2, INK);
        p.set(9, 10 + y0, WHITE);
        p.set(22, 10 + y0, WHITE);
      } else {
        eye(p, 9, 9 + y0, k, 3);
        eye(p, 22, 9 + y0, k, 3);
      }
      for (let x = 11; x <= 20; x++) p.set(x, 19 + y0 + (x === 11 || x === 20 ? -1 : 0), ramp(B).lo);
      blush(p, 6, 17 + y0);
      blush(p, 24, 17 + y0);
    },
    piglet(p, f) {
      const B = "#f4b0aa";
      const D = "#e08a86";
      chibi(p, f, {
        body: B,
        belly: "#fbd3cf",
        paw: D,
        tail(p2, y0) {
          p2.line(23, 24 + y0, 25, 22 + y0, D);
          p2.line(25, 22 + y0, 26, 24 + y0, D);
          p2.set(27, 23 + y0, D);
        },
        ears(p2, y0) {
          p2.poly([[6, 9 + y0], [7, 2 + y0], [13, 6 + y0]], ramp(B).base);
          p2.poly([[26, 9 + y0], [25, 2 + y0], [19, 6 + y0]], ramp(B).mid);
          p2.poly([[8, 7 + y0], [8.5, 4 + y0], [11, 6 + y0]], D);
          p2.poly([[24, 7 + y0], [23.5, 4 + y0], [21, 6 + y0]], D);
        },
        face(p2, y0) {
          p2.sEll(16, 17 + y0, 3.8, 2.6, "#f29a94");
          p2.rect(14, 17 + y0, 1, 1, "#a8524e");
          p2.rect(17, 17 + y0, 1, 1, "#a8524e");
        }
      });
    },
    lamb(p, f) {
      const W = "#f6f0e4";
      const F = "#f3d8bc";
      chibi(p, f, {
        body: W,
        belly: "#fffaf2",
        paw: "#8a7a6a",
        ears(p2, y0) {
          p2.sEll(5, 12 + y0, 3.6, 2, "#e8cfb2");
          p2.sEll(27, 12 + y0, 3.6, 2, "#e8cfb2");
        },
        face(p2, y0) {
          for (const [x, y] of [[8, 6], [12, 4], [16, 3.5], [20, 4], [24, 6], [6, 10], [26, 10]]) p2.sEll(x, y + y0, 3, 2.8, W);
          p2.sEll(16, 14 + y0, 7.5, 6, F);
          p2.rect(15, 17 + y0, 2, 1, "#c8806a");
          p2.set(15, 18 + y0, "#a86a5a");
          p2.set(16, 18 + y0, "#a86a5a");
        }
      });
    },
    corgi(p, f) {
      const B = "#e9974e";
      const C = "#fff4e6";
      chibi(p, f, {
        body: B,
        belly: C,
        paw: C,
        tail(p2, y0) {
          p2.sEll(25, 23 + y0, 2.6, 2.2, B);
        },
        ears(p2, y0) {
          p2.poly([[5, 9 + y0], [6, -1 + y0], [13, 5 + y0]], ramp(B).base);
          p2.poly([[27, 9 + y0], [26, -1 + y0], [19, 5 + y0]], ramp(B).mid);
          p2.poly([[7, 7 + y0], [7.5, 2 + y0], [11, 5.5 + y0]], "#f4b0a0");
          p2.poly([[25, 7 + y0], [24.5, 2 + y0], [21, 5.5 + y0]], "#f4b0a0");
        },
        face(p2, y0) {
          p2.rect(15, 5 + y0, 2, 7, C);
          p2.ell(16, 17 + y0, 6, 3.6, C);
          p2.ell(16, 12 + y0, 2.5, 2, C);
          p2.rect(15, 15 + y0, 2, 2, INK);
          p2.set(15, 15 + y0, "#6a5a5a");
        }
      });
    },
    hedgehog(p, f) {
      const S = "#7a5a3e";
      const T = "#c4a07a";
      const F = "#f2dcc0";
      const y0 = bob(f);
      const [a, b] = feet(f);
      p.sEll(16, 17 + y0, 13, 12, S);
      for (let k2 = 0; k2 <= 16; k2++) {
        const t = Math.PI * (1 + k2 / 16);
        const x = 16 + Math.cos(t) * 12.5;
        const y = 17 + y0 + Math.sin(t) * 11.5;
        const x2 = 16 + Math.cos(t) * 15;
        const y2 = 17 + y0 + Math.sin(t) * 14;
        p.poly([[x - 1.5, y + 0.5], [x + 1.5, y + 0.5], [x2, y2]], k2 % 2 ? S : ramp(S).mid);
        p.set(Math.round(x2), Math.round(y2), T);
      }
      for (let row = 0; row < 3; row++)
        for (let k2 = 0; k2 < 9; k2++) {
          const x = 6 + k2 * 2.5 + row % 2 * 1.2;
          const y = 8 + row * 3 + y0 + Math.abs(k2 - 4) * 0.6;
          p.set(Math.round(x), Math.round(y), T);
          p.set(Math.round(x), Math.round(y) + 1, ramp(S).lo);
        }
      p.sEll(16, 22 + y0, 9.5, 8, F);
      p.sEll(11.5, 29.5 + y0 - a, 2.4, 1.6, "#c8a07a");
      p.sEll(20.5, 29.5 + y0 - b, 2.4, 1.6, "#c8a07a");
      p.sEll(8, 13 + y0, 2.2, 2, "#e8c8a8");
      p.sEll(24, 13 + y0, 2.2, 2, "#e8c8a8");
      const k = eyeKind(f);
      eye(p, 11, 18 + y0, k, 3);
      eye(p, 20, 18 + y0, k, 3);
      p.sEll(16, 23 + y0, 1.8, 1.3, INK);
      if (f === "happy") p.rect(15, 26 + y0, 2, 1, "#c0505a");
      blush(p, 8, 23 + y0);
      blush(p, 22, 23 + y0);
    },
    squirrel(p, f) {
      const B = "#c97a3e";
      const C = "#f6e3c8";
      chibi(p, f, {
        body: B,
        belly: C,
        tail(p2, y0) {
          const up = f === "happy" ? -2 : 0;
          p2.sEll(26, 15 + y0 + up, 5.5, 9, B);
          p2.sEll(27, 10 + y0 + up, 3.5, 4.5, ramp(B).hi);
          p2.ell(29, 16 + y0 + up, 1.5, 6, ramp(B).mid);
        },
        ears(p2, y0) {
          p2.poly([[7, 9 + y0], [8, 1 + y0], [13, 6 + y0]], ramp(B).base);
          p2.poly([[25, 9 + y0], [24, 1 + y0], [19, 6 + y0]], ramp(B).mid);
          p2.set(8, 0 + y0, ramp(B).lo);
          p2.set(24, 0 + y0, ramp(B).lo);
        },
        face(p2, y0) {
          p2.ell(10.5, 17 + y0, 3.8, 3, C);
          p2.ell(21.5, 17 + y0, 3.8, 3, C);
          p2.rect(15, 16 + y0, 2, 1, "#6a3a2a");
          p2.set(15, 18 + y0, "#fbf7ef");
          p2.set(16, 18 + y0, "#fbf7ef");
        }
      });
    },
    owl(p, f) {
      const B = "#9a7556";
      const L = "#e8d4b4";
      const y0 = bob(f);
      const [a, b] = feet(f);
      const flap = f === "happy" ? -3 : 0;
      p.sEll(5, 20 + y0 + flap, 3, 7, ramp(B).mid);
      p.sEll(27, 20 + y0 + flap, 3, 7, ramp(B).mid);
      p.sEll(16, 18 + y0, 11.5, 12.5, B);
      p.poly([[6, 9 + y0], [7, 2 + y0], [11, 7 + y0]], B);
      p.poly([[26, 9 + y0], [25, 2 + y0], [21, 7 + y0]], B);
      p.ell(16, 24 + y0, 7, 6, L);
      for (const [x, y] of [[13, 21], [17, 21], [15, 24], [19, 24], [12, 25], [16, 27]]) {
        p.set(x, y + y0, ramp(L).lo);
        p.set(x + 1, y + 1 + y0, ramp(L).lo);
        p.set(x - 1, y + 1 + y0, ramp(L).lo);
      }
      p.sEll(10.5, 12.5 + y0, 5, 4.8, "#f6ecd8");
      p.sEll(21.5, 12.5 + y0, 5, 4.8, "#f6ecd8");
      const k = eyeKind(f);
      if (k === "open") {
        p.ell(10.5, 12.5 + y0, 2.4, 2.4, "#f2a23a");
        p.ell(21.5, 12.5 + y0, 2.4, 2.4, "#f2a23a");
        p.rect(10, 12 + y0, 2, 2, INK);
        p.rect(21, 12 + y0, 2, 2, INK);
        p.set(10, 12 + y0, WHITE);
        p.set(21, 12 + y0, WHITE);
      } else {
        eye(p, 10, 11 + y0, k, 3);
        eye(p, 21, 11 + y0, k, 3);
      }
      p.poly([[14.5, 15 + y0], [17.5, 15 + y0], [16, 18.5 + y0]], "#f2a23a");
      p.rect(11, 30 + y0 - a, 4, 1, "#f2a23a");
      p.rect(17, 30 + y0 - b, 4, 1, "#f2a23a");
    },
    otter(p, f) {
      const B = "#8a6248";
      const C = "#ecd6ba";
      chibi(p, f, {
        body: B,
        belly: C,
        paw: ramp(B).lo,
        tail(p2, y0) {
          p2.sEll(26, 25 + y0, 4.5, 2.2, ramp(B).mid);
        },
        ears(p2, y0) {
          p2.sEll(6.5, 8 + y0, 2.4, 2.2, B);
          p2.sEll(25.5, 8 + y0, 2.4, 2.2, B);
        },
        face(p2, y0) {
          p2.ell(16, 17 + y0, 6.5, 4, C);
          p2.ell(16, 15.5 + y0, 2.2, 1.4, "#4a2e22");
          for (const [x, y] of [[11, 17], [11, 19], [21, 17], [21, 19]]) p2.set(x, y + y0, ramp(C).lo);
          p2.set(16, 17 + y0, "#4a2e22");
        }
      });
    },
    raccoon(p, f) {
      const B = "#9a9aa2";
      const W = "#f0eee8";
      const M = "#3e3e46";
      chibi(p, f, {
        body: B,
        belly: "#dcdad4",
        paw: M,
        tail(p2, y0) {
          p2.sEll(25.5, 19 + y0, 3.5, 7, B);
          for (const y of [14, 18, 22]) p2.rect(23, y + y0, 6, 2, M);
        },
        ears(p2, y0) {
          p2.poly([[6, 9 + y0], [7, 2 + y0], [13, 6 + y0]], ramp(B).base);
          p2.poly([[26, 9 + y0], [25, 2 + y0], [19, 6 + y0]], ramp(B).mid);
          p2.poly([[8, 7 + y0], [8.5, 4 + y0], [11, 6 + y0]], W);
          p2.poly([[24, 7 + y0], [23.5, 4 + y0], [21, 6 + y0]], W);
        },
        face(p2, y0) {
          p2.ell(16, 17 + y0, 6, 3.6, W);
          p2.rect(8, 9 + y0, 5, 1, W);
          p2.rect(19, 9 + y0, 5, 1, W);
          p2.ell(10.5, 13.5 + y0, 4, 2.6, M);
          p2.ell(21.5, 13.5 + y0, 4, 2.6, M);
          p2.ell(11, 13.5 + y0, 2, 2, "#62626c");
          p2.ell(22, 13.5 + y0, 2, 2, "#62626c");
          p2.rect(15, 15 + y0, 2, 2, INK);
        }
      });
    },
    koala(p, f) {
      const B = "#a8acb6";
      const W = "#eceef2";
      chibi(p, f, {
        body: B,
        belly: W,
        paw: ramp(B).mid,
        ears(p2, y0) {
          p2.sEll(5.5, 8 + y0, 5, 5, B);
          p2.sEll(26.5, 8 + y0, 5, 5, B);
          p2.ell(5.5, 8.5 + y0, 2.8, 2.8, W);
          p2.ell(26.5, 8.5 + y0, 2.8, 2.8, W);
        },
        face(p2, y0) {
          p2.sEll(16, 16.5 + y0, 2.8, 3.4, "#3a3a44");
          p2.set(15, 15 + y0, "#6a6a76");
        }
      });
    },
    redpanda(p, f) {
      const B = "#d0663a";
      const D = "#4a2a22";
      const W = "#fbf2e6";
      chibi(p, f, {
        body: B,
        belly: D,
        paw: D,
        hw: 11.5,
        tail(p2, y0) {
          p2.sEll(26, 19 + y0, 4, 7.5, B);
          for (const y of [15, 19, 23]) p2.rect(23, y + y0, 7, 2, ramp(B).lo);
        },
        ears(p2, y0) {
          p2.poly([[5, 10 + y0], [6, 2 + y0], [13, 6 + y0]], ramp(B).base);
          p2.poly([[27, 10 + y0], [26, 2 + y0], [19, 6 + y0]], ramp(B).mid);
          p2.poly([[7, 8 + y0], [7.5, 4 + y0], [11, 6.5 + y0]], W);
          p2.poly([[25, 8 + y0], [24.5, 4 + y0], [21, 6.5 + y0]], W);
        },
        face(p2, y0) {
          p2.ell(9.5, 17 + y0, 4, 3.2, W);
          p2.ell(22.5, 17 + y0, 4, 3.2, W);
          p2.ell(16, 18 + y0, 3.6, 2.4, W);
          p2.rect(9, 9 + y0, 3, 1, W);
          p2.rect(20, 9 + y0, 3, 1, W);
          p2.rect(15, 16 + y0, 2, 2, INK);
          p2.rect(10, 14 + y0, 1, 3, ramp(B).lo);
          p2.rect(21, 14 + y0, 1, 3, ramp(B).lo);
        }
      });
    },
    panda(p, f) {
      const W = "#f6f4ee";
      const K = "#2e2e36";
      chibi(p, f, {
        body: W,
        belly: "#fffdf8",
        paw: K,
        ears(p2, y0) {
          p2.sEll(6, 6 + y0, 3.6, 3.4, K);
          p2.sEll(26, 6 + y0, 3.6, 3.4, K);
        },
        face(p2, y0) {
          p2.poly([[7, 14 + y0], [9, 10 + y0], [14, 11 + y0], [13, 16 + y0], [9, 17 + y0]], K);
          p2.poly([[25, 14 + y0], [23, 10 + y0], [18, 11 + y0], [19, 16 + y0], [23, 17 + y0]], K);
          p2.ell(11, 13.5 + y0, 1.8, 2.2, "#5c5c68");
          p2.ell(22, 13.5 + y0, 1.8, 2.2, "#5c5c68");
          p2.sEll(16, 17 + y0, 1.8, 1.2, K);
          p2.rect(15, 19 + y0, 2, 1, "#8a8a92");
          p2.ell(16, 22 + y0, 9, 2, K);
        }
      });
    },
    chick(p, f) {
      const Y = "#f8d54a";
      const O = "#f2902e";
      const y0 = bob(f);
      const [a, b] = feet(f);
      const flap = f === "happy" ? -3 : f === "walk1" ? -1 : 0;
      p.rect(11, 29 + y0 - a, 3, 2, O);
      p.rect(18, 29 + y0 - b, 3, 2, O);
      p.sEll(6.5, 20 + y0 + flap, 3, 4, ramp(Y).mid);
      p.sEll(25.5, 20 + y0 + flap, 3, 4, ramp(Y).mid);
      p.sEll(16, 19 + y0, 10.5, 10, Y);
      p.ell(16, 23 + y0, 6, 4.5, lighten(Y, 0.1));
      for (const [x, y] of [[15, 7], [16, 6], [17, 7], [16, 8]]) p.set(x, y + y0, Y);
      p.set(14, 6 + y0, ramp(Y).mid);
      const k = eyeKind(f);
      eye(p, 11, 14 + y0, k, 3);
      eye(p, 20, 14 + y0, k, 3);
      p.poly([[14, 18 + y0], [18, 18 + y0], [16, 20.5 + y0]], O);
      p.rect(14, 17 + y0, 4, 1, ramp(O).hi);
      blush(p, 8, 18 + y0);
      blush(p, 22, 18 + y0);
    },
    // 鱼（侧面，给商店和「我的宠物」用）
    medaka(p, f) {
      cuteFish(p, f, "#d8c68a", "#c8b070", { line: "#7aa0c0" });
    },
    goldfish(p, f) {
      cuteFish(p, f, "#f0742e", "#f6b07a", { fancy: true });
    },
    guppy(p, f) {
      cuteFish(p, f, "#a8bccf", "#e85d75", { fancy: true, fin2: "#9b7fd1", fin3: "#5ab0e0" });
    },
    koi(p, f) {
      cuteFish(p, f, "#f8f4ec", "#f2e6dc", { spots: "#d8452e" });
    },
    goldkoi(p, f) {
      cuteFish(p, f, "#f2c14e", "#f7dc85", { shine: true });
    }
  };

  // src/art/room.ts
  function room(o) {
    const T = 16;
    const W = o.w * T;
    const H = o.h * T;
    const p = new Pix(W, H);
    const r = rnd(o.seed || 7);
    const PAPER = "#f1e2c6";
    p.rect(0, 0, W, 2 * T, PAPER);
    for (let x = 0; x < W; x += 6) p.rect(x, 3, 1, 15, "#e8d5b2");
    for (let x = 3; x < W; x += 12)
      for (let y = 7; y < 17; y += 8) {
        const xx = x + ((y - 7) / 8 % 2 ? 6 : 0);
        p.set(xx, y, "#dca792");
        p.set(xx - 1, y + 1, "#dca792");
        p.set(xx + 1, y + 1, "#dca792");
        p.set(xx, y + 2, "#dca792");
        p.set(xx, y + 1, "#a8c08a");
      }
    p.rect(0, 0, W, 3, "#5a3a28");
    p.rect(0, 2, W, 1, "#7a5238");
    p.rect(0, 17, W, 1, "#c9965f");
    p.rect(0, 18, W, 2, "#9a6a44");
    p.rect(0, 20, W, 1, "#6e4a30");
    const WOOD = "#b9845a";
    const WR = ramp(WOOD);
    p.rect(0, 21, W, 9, WOOD);
    for (let x = 0; x < W; x += T) {
      p.rect(x + 2, 22, T - 4, 1, WR.mid);
      p.rect(x + 2, 22, 1, 6, WR.mid);
      p.rect(x + 2, 28, T - 4, 1, WR.hi);
      p.rect(x + T - 3, 22, 1, 7, WR.hi);
      p.rect(x + 4, 24, T - 8, 2, mix(WOOD, WR.hi, 0.35));
      p.rect(x, 21, 1, 9, WR.lo);
    }
    p.rect(0, 30, W, 2, "#6a4630");
    p.rect(0, 30, W, 1, "#8a5e40");
    const TONES = ["#b47c52", "#bc865b", "#ab7449", "#c08c60"];
    const GAP = "#7a4e32";
    for (let y = 2 * T, row = 0; y < H; y += 6, row++) {
      let x = -Math.floor(r() * 30);
      while (x < W) {
        const len = 22 + Math.floor(r() * 26);
        const tone = TONES[Math.floor(r() * TONES.length)];
        p.rect(x, y, len, 5, tone);
        p.rect(x, y, len, 1, mix(tone, "#ffffff", 0.12));
        p.rect(x, y + 5, len, 1, GAP);
        p.rect(x + len - 1, y, 1, 5, GAP);
        const g = Math.floor(r() * 3);
        for (let k = 0; k < g; k++) p.rect(x + 3 + Math.floor(r() * (len - 10)), y + 2 + Math.floor(r() * 2), 3 + Math.floor(r() * 4), 1, mix(tone, GAP, 0.35));
        if (r() < 0.12) {
          const kx = x + 4 + Math.floor(r() * (len - 8));
          p.set(kx, y + 2, mix(tone, GAP, 0.6));
          p.set(kx + 1, y + 2, mix(tone, GAP, 0.4));
        }
        x += len;
      }
    }
    for (let y = 2 * T; y < 2 * T + 4; y++)
      for (let x = 0; x < W; x++) {
        const c = p.get(x, y);
        if (c) p.set(x, y, mix(c, "#3a2418", [0.32, 0.22, 0.12, 0.06][y - 2 * T]));
      }
    const EDGE = "#4a3022";
    for (const x0 of [0, W - 4]) {
      p.rect(x0, 0, 4, H, EDGE);
      p.rect(x0 === 0 ? 3 : W - 4, 0, 1, H, "#6a4630");
    }
    for (let x = 0; x < W; x++) {
      const inDoor = o.door && x >= o.door[0] * T && x < (o.door[1] + 1) * T;
      if (inDoor) continue;
      p.set(x, H - 3, "#6a4630");
      p.set(x, H - 2, EDGE);
      p.set(x, H - 1, EDGE);
    }
    if (o.door) {
      const mx = o.door[0] * T + 2;
      const mw = (o.door[1] - o.door[0] + 1) * T - 4;
      p.rect(mx, H - 11, mw, 9, "#8a5a3b");
      p.rect(mx + 2, H - 9, mw - 4, 5, "#b07a4a");
      for (let x = mx + 3; x < mx + mw - 3; x += 3) p.set(x, H - 7, "#c9965f");
    }
    return p.toCanvas();
  }

  // src/art/index.ts
  function pet(species, frame, recolor, hat) {
    return cached("pet:" + species + ":" + frame + ":" + (recolor || "") + ":" + (hat || ""), () => {
      const p = new Pix(32, 32);
      (PETS[species] || PETS.crab)(p, frame);
      if (recolor) p.recolor((c) => c === INK || c === WHITE ? c : hueShift(c, recolor));
      if (hat && HATS[hat]) {
        const h = new Pix(16, 12);
        HATS[hat](h, 3, "front");
        p.blit(h, 8, (PET_HAT_AT[species] || 0) + bob(frame) - 3);
      }
      p.outline();
      if (frame === "sick") p.recolor((c) => mix(desat(c, 0.4), "#9fbf8f", 0.12));
      return p;
    });
  }
  function hueShift(c, deg) {
    const [h, s, l] = hsl(c);
    if (s < 0.15 || l > 0.92) return c;
    return hsl2hex(h + deg, s, l);
  }
  function lying(look) {
    return cached("lying:" + JSON.stringify(look), () => {
      const q = build(16, 32, (z) => person(z, look, "idle", "front"));
      const p = new Pix(32, 32);
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) if (q.get(x, y)) p.set(x + 8, y + 3, q.get(x, y));
      const B = ramp("#5a8fe0");
      p.rect(2, 15, 28, 3, "#5a8fe0");
      p.rect(2, 15, 28, 1, B.hi);
      p.rect(2, 18, 28, 1, B.mid);
      p.ell(16, 23, 7, 3, lighten("#5a8fe0", 0.05));
      p.ell(15, 22, 5, 1.5, B.hi);
      return p;
    });
  }
  var GLASS = { "#7fb6d8": "#ffcf6e", "#a9d4ec": "#ffe08f", "#cdeaf8": "#fff1c4", "#5e93b8": "#d99a48", "#6aa2c6": "#e8ac56" };
  function litWindows(kind) {
    const d = DECOR[kind];
    if (!d) return null;
    return cached("lit:" + kind, () => {
      const src = build(d.w, d.h, (q) => d.draw(q), { outline: !d.flat });
      const p = new Pix(d.w, d.h);
      for (let i = 0; i < src.d.length; i++) if (GLASS[src.d[i]]) p.d[i] = GLASS[src.d[i]];
      return p;
    });
  }
  function avatar(look, frame, dir) {
    return cached("avatar:" + JSON.stringify(look) + ":" + frame + ":" + (dir || "front"), () => build(16, 32, (q) => person(q, look, frame, dir)));
  }
  function tree(kind, stage) {
    const st = stage == null ? 4 : stage;
    return cached("tree:" + kind + ":" + st, () => {
      if (st <= 0) return build(16, 16, (q) => treeSeed(q));
      if (st === 1) return build(16, 16, (q) => treeSprout(q, kind));
      if (st === 2) return build(16, 32, (q) => treeSapling(q, kind));
      if (st === 3) return build(32, 48, (q) => drawTree(q, kind, 1));
      return build(48, 72, (q) => drawTree(q, kind, 1.5));
    });
  }
  function grassSprite(kind, stage) {
    const tall = (GRASSES[kind] || {}).tall && stage >= 2;
    return cached("grass:" + kind + ":" + stage, () => build(16, tall ? 24 : 16, (q) => grassPlant(q, kind, stage)));
  }
  function flowerSprite(kind, stage) {
    const tall = (FLOWERS[kind] || {}).tall && stage >= 2;
    return cached("flower:" + kind + ":" + stage, () => build(16, tall ? 24 : 16, (q) => flower(q, kind, stage)));
  }
  function shrubSprite(kind, stage) {
    return cached("shrub:" + kind + ":" + stage, () => build(16, 16, (q) => shrub(q, kind, stage)));
  }
  function ground(kind, v) {
    return cached("ground:" + kind + ":" + (v || 0), () => build(16, 16, (q) => (GROUND[kind] || GROUND.grass)(q, v || 0), { outline: false }));
  }
  function decor(kind) {
    const d = DECOR[kind];
    if (!d) return null;
    return cached("decor:" + kind, () => build(d.w, d.h, (q) => d.draw(q), { outline: !d.flat }));
  }
  function icon(kind, color) {
    return cached("icon:" + kind + ":" + (color || ""), () => build(16, 16, (q) => (ICONS[kind] || ICONS.bag)(q, color)));
  }
  var urlCache = /* @__PURE__ */ new Map();
  function url(canvas) {
    if (!urlCache.has(canvas)) urlCache.set(canvas, canvas.toDataURL());
    return urlCache.get(canvas);
  }
  var ART = {
    Pix,
    ramp,
    lighten,
    mix,
    url,
    terrain,
    pet,
    avatar,
    tree,
    flower: flowerSprite,
    shrub: shrubSprite,
    grass: grassSprite,
    fishTop,
    room,
    forestRing,
    pondInside,
    lying,
    litWindows,
    ground,
    decor,
    icon,
    PETS: Object.keys(PETS),
    TREES: Object.keys(TREE_SPECS),
    FLOWERS: Object.keys(FLOWERS),
    SHRUBS: Object.keys(SHRUBS),
    DECOR: Object.fromEntries(Object.entries(DECOR).map(([k, v]) => [k, { w: v.w, h: v.h, tw: v.tw, th: v.th, room: !!v.room, wall: !!v.wall, flat: !!v.flat }])),
    HATS: Object.keys(HATS),
    ICONS: Object.keys(ICONS),
    FLOWER_COLOR: Object.fromEntries(Object.entries(FLOWERS).map(([k, v]) => [k, v.c]))
  };

  // src/data/pets.ts
  var MARGIN_PETS = {
    // 宠物：price 是买一只要花的金币（同一种可以买好几只）；kind 是宠物店里的分类（dog 猫狗、small 小动物、bird 鸟、wild 野生动物、fish 观赏鱼）；
    // fish 的养在池塘里
    species: [
      { id: "crab", kind: "small", name: "小螃蟹", sound: "Pinch pinch!", price: 4500 },
      { id: "hamster", kind: "small", name: "仓鼠", sound: "*nom nom*", price: 5e3 },
      { id: "chick", kind: "bird", name: "小鸡", sound: "Peep peep!", price: 5e3 },
      { id: "cat", kind: "dog", name: "小猫", sound: "Meow!", price: 6e3 },
      { id: "rabbit", kind: "small", name: "兔子", sound: "*hop hop*", price: 6e3 },
      { id: "duck", kind: "bird", name: "小鸭", sound: "Quack!", price: 6500 },
      { id: "piglet", kind: "small", name: "小猪", sound: "Oink!", price: 6500 },
      { id: "lamb", kind: "small", name: "小羊", sound: "Baa!", price: 7e3 },
      { id: "shiba", kind: "dog", name: "柴犬", sound: "Woof!", price: 7500 },
      { id: "corgi", kind: "dog", name: "柯基", sound: "Woof woof!", price: 8e3 },
      { id: "hedgehog", kind: "small", name: "刺猬", sound: "*sniff sniff*", price: 8e3 },
      { id: "frog", kind: "small", name: "青蛙", sound: "Ribbit!", price: 8e3 },
      { id: "penguin", kind: "bird", name: "企鹅", sound: "*waddle waddle*", price: 9e3 },
      { id: "squirrel", kind: "small", name: "松鼠", sound: "*chitter chitter*", price: 9e3 },
      { id: "owl", kind: "bird", name: "猫头鹰", sound: "Hoo hoo!", price: 1e4 },
      { id: "otter", kind: "wild", name: "水獭", sound: "*splash*", price: 1e4 },
      { id: "raccoon", kind: "wild", name: "浣熊", sound: "*rustle rustle*", price: 11e3 },
      { id: "koala", kind: "wild", name: "考拉", sound: "*yawn*", price: 12e3 },
      { id: "fox", kind: "wild", name: "狐狸", sound: "Hehe!", price: 12e3 },
      { id: "redpanda", kind: "wild", name: "小熊猫", sound: "*squeak*", price: 13e3 },
      { id: "panda", kind: "wild", name: "大熊猫", sound: "*munch munch*", price: 15e3 },
      { id: "medaka", kind: "fish", name: "青鳉鱼", sound: "*blub*", price: 4e3, fish: true },
      { id: "goldfish", kind: "fish", name: "金鱼", sound: "*blub blub*", price: 5e3, fish: true },
      { id: "guppy", kind: "fish", name: "孔雀鱼", sound: "*blub*", price: 5e3, fish: true },
      { id: "koi", kind: "fish", name: "红白锦鲤", sound: "*splash*", price: 7e3, fish: true },
      { id: "goldkoi", kind: "fish", name: "黄金锦鲤", sound: "*splash*", price: 8e3, fish: true }
    ],
    // 树：买种子种下，浇水、施肥长大（种子、发芽、小树苗、小树、大树）
    trees: [
      { id: "oak", name: "橡树", price: 600 },
      { id: "pine", name: "松树", price: 700 },
      { id: "birch", name: "白桦", price: 800 },
      { id: "cypress", name: "柏树", price: 800 },
      { id: "bamboo", name: "竹子", price: 900 },
      { id: "cactus", name: "仙人掌", price: 900 },
      { id: "maple", name: "枫树", price: 1200 },
      { id: "willow", name: "柳树", price: 1400 },
      { id: "ginkgo", name: "银杏", price: 1500 },
      { id: "sakura", name: "樱花", price: 1600 },
      { id: "orange", name: "橘子树", price: 1800 },
      { id: "apple", name: "苹果树", price: 1800 },
      { id: "peach", name: "桃树", price: 2e3 },
      { id: "plum", name: "梅花", price: 2e3 },
      { id: "magnolia", name: "玉兰", price: 2200 },
      { id: "palm", name: "椰子树", price: 2400 },
      { id: "jacaranda", name: "蓝花楹", price: 2800 },
      { id: "wisteria", name: "紫藤", price: 3e3 }
    ],
    // 商店里卖的东西，按类分开。use：plant 种下、water 浇水、fert 施肥、place 摆进花园、furnish 摆进屋里、
    // hoe 锄头（买一次一直有）、lawn 把开垦过的空地变回草地、feed 喂宠物（food 加饱腹、mood 加心情）、fishfood 喂池塘里所有的鱼、toy 陪宠物玩、medicine 治病；
    // look 是人物装扮，pet 是宠物装扮（买了就一直有，所有宠物都能戴）
    shop: [
      {
        id: "treeseeds",
        name: "树木",
        items: "TREES"
      },
      {
        id: "seeds",
        name: "花草",
        items: [
          { id: "seed.tulip", name: "郁金香", price: 150, use: "plant", plant: ["flower", "tulip"] },
          { id: "seed.daisy", name: "雏菊", price: 150, use: "plant", plant: ["flower", "daisy"] },
          { id: "seed.rose", name: "玫瑰", price: 250, use: "plant", plant: ["flower", "rose"] },
          { id: "seed.lavender", name: "薰衣草", price: 250, use: "plant", plant: ["flower", "lavender"] },
          { id: "seed.bluebell", name: "风铃草", price: 300, use: "plant", plant: ["flower", "bluebell"] },
          { id: "seed.sunflower", name: "向日葵", price: 300, use: "plant", plant: ["flower", "sunflower"] },
          { id: "seed.clover", name: "三叶草", price: 100, use: "plant", plant: ["grass", "clover"] },
          { id: "seed.foxtail", name: "狗尾草", price: 120, use: "plant", plant: ["grass", "foxtail"] },
          { id: "seed.fountain", name: "狼尾草", price: 200, use: "plant", plant: ["grass", "fountain"] },
          { id: "seed.pampas", name: "蒲苇", price: 300, use: "plant", plant: ["grass", "pampas"] },
          { id: "seed.bush", name: "灌木", price: 300, use: "plant", plant: ["shrub", "bush"] },
          { id: "seed.berry", name: "浆果丛", price: 450, use: "plant", plant: ["shrub", "berry"] },
          { id: "seed.hydrangea", name: "绣球花", price: 600, use: "plant", plant: ["shrub", "hydrangea"] },
          { id: "lawn", name: "草坪种子", price: 5, use: "lawn" }
        ]
      },
      {
        id: "garden",
        name: "园艺",
        items: [
          { id: "hoe", name: "锄头", price: 600, use: "hoe", icon: "hoe", once: true },
          { id: "scythe", name: "镰刀", price: 300, use: "scythe", icon: "scythe", once: true },
          { id: "pickaxe", name: "十字镐", price: 800, use: "pickaxe", icon: "pickaxe", once: true },
          { id: "axe", name: "斧头", price: 800, use: "axe", icon: "axe", once: true },
          { id: "water", name: "清水 ×5", price: 10, use: "water", gives: 5, icon: "water" },
          { id: "fert", name: "肥料", price: 20, use: "fert", icon: "fert" }
        ]
      },
      {
        id: "petcare",
        name: "宠物用品",
        items: [
          { id: "food.kibble", name: "宠物粮", price: 15, use: "feed", food: 40, mood: 0, icon: "kibble" },
          { id: "food.can", name: "罐头", price: 30, use: "feed", food: 80, mood: 5, icon: "tin" },
          { id: "treat", name: "小零食", price: 10, use: "feed", food: 10, mood: 6, icon: "treat" },
          { id: "fishfood", name: "鱼食", price: 10, use: "fishfood", icon: "fishfood" },
          { id: "toy.ball", name: "小皮球", price: 25, use: "toy", mood: 15, icon: "ball" },
          { id: "toy.yarn", name: "毛线球", price: 30, use: "toy", mood: 18, icon: "yarn" },
          { id: "toy.bone", name: "磨牙骨", price: 30, use: "toy", mood: 18, icon: "bone" },
          { id: "toy.fish", name: "小鱼玩具", price: 35, use: "toy", mood: 22, icon: "fishtoy" },
          { id: "medicine", name: "宠物药", price: 80, use: "medicine", icon: "medicine" }
        ]
      },
      {
        id: "decor",
        name: "装饰",
        items: [
          { id: "decor.fence", name: "木栅栏", price: 30, use: "place", decor: "fence" },
          { id: "decor.stone", name: "石头", price: 40, use: "place", decor: "stone" },
          { id: "decor.mushroom", name: "蘑菇", price: 50, use: "place", decor: "mushroom" },
          { id: "decor.sign", name: "木牌", price: 60, use: "place", decor: "sign" },
          { id: "decor.lamp", name: "路灯", price: 150, use: "place", decor: "lamp" },
          { id: "decor.bench", name: "长椅", price: 200, use: "place", decor: "bench" },
          { id: "decor.birdbath", name: "鸟浴盆", price: 250, use: "place", decor: "birdbath" },
          { id: "decor.pethouse", name: "宠物小屋", price: 400, use: "place", decor: "pethouse" },
          { id: "decor.pond", name: "小水池", price: 600, use: "place", decor: "pond" }
        ]
      },
      {
        id: "mats",
        name: "建材",
        items: [
          { id: "wood", name: "木材", price: 12, use: "mat", icon: "wood" },
          { id: "wood10", name: "木材 ×10", price: 110, use: "mat", icon: "wood", gives: 10, into: "wood" },
          { id: "stone", name: "石料", price: 18, use: "mat", icon: "stone" },
          { id: "stone10", name: "石料 ×10", price: 160, use: "mat", icon: "stone", gives: 10, into: "stone" }
        ]
      },
      {
        id: "furniture",
        name: "家具",
        items: [
          { id: "furn.chair", name: "椅子", price: 120, use: "furnish", decor: "chair" },
          { id: "furn.stool", name: "小凳子", price: 80, use: "furnish", decor: "stool" },
          { id: "furn.plant", name: "盆栽", price: 120, use: "furnish", decor: "plant" },
          { id: "furn.painting", name: "挂画", price: 150, use: "furnish", decor: "painting" },
          { id: "furn.window", name: "窗户", price: 180, use: "furnish", decor: "window" },
          { id: "furn.floorlamp", name: "落地灯", price: 180, use: "furnish", decor: "floorlamp" },
          { id: "furn.rug", name: "地毯", price: 200, use: "furnish", decor: "rug" },
          { id: "furn.table", name: "桌子", price: 240, use: "furnish", decor: "table" },
          { id: "furn.bookshelf", name: "书架", price: 360, use: "furnish", decor: "bookshelf" },
          { id: "furn.desk", name: "书桌", price: 360, use: "furnish", decor: "desk" },
          { id: "furn.bed", name: "木床", price: 450, use: "furnish", decor: "bed" },
          { id: "furn.sofa", name: "沙发", price: 480, use: "furnish", decor: "sofa" },
          { id: "furn.fireplace", name: "壁炉", price: 750, use: "furnish", decor: "fireplace" }
        ]
      },
      {
        id: "look",
        name: "人物装扮",
        items: [
          { id: "look.hat.straw", name: "草帽", price: 300, slot: "hat", look: { hat: "straw" } },
          { id: "look.hat.cap", name: "棒球帽", price: 250, slot: "hat", look: { hat: "cap" } },
          { id: "look.hat.beanie", name: "毛线帽", price: 250, slot: "hat", look: { hat: "beanie" } },
          { id: "look.hat.flower", name: "花环", price: 380, slot: "hat", look: { hat: "flower" } },
          { id: "look.hat.bow", name: "蝴蝶结", price: 300, slot: "hat", look: { hat: "bow" } },
          { id: "look.hat.grad", name: "学士帽", price: 500, slot: "hat", look: { hat: "grad" } },
          { id: "look.hat.crown", name: "皇冠", price: 1200, slot: "hat", look: { hat: "crown" } },
          { id: "look.top.yellow", name: "黄色 T 恤", price: 200, slot: "top", look: { top: "#f6d35b", topStyle: "tee" } },
          { id: "look.top.stripe", name: "海军条纹衫", price: 380, slot: "top", look: { top: "#3b6ea8", topStyle: "stripe" } },
          { id: "look.top.hoodie", name: "红色卫衣", price: 450, slot: "top", look: { top: "#c8463a", topStyle: "hoodie" } },
          { id: "look.top.overalls", name: "背带裤套装", price: 500, slot: "top", look: { top: "#6a9a5a", topStyle: "overalls", bottom: "#3b5a8a" } },
          { id: "look.top.lilac", name: "紫色毛衣", price: 380, slot: "top", look: { top: "#9b7fd1", topStyle: "tee" } },
          { id: "look.bottom.jeans", name: "牛仔裤", price: 250, slot: "bottom", look: { bottom: "#3b5a8a", bottomStyle: "pants" } },
          { id: "look.bottom.skirt", name: "白色裙子", price: 300, slot: "bottom", look: { bottom: "#fbf7ef", bottomStyle: "skirt" } },
          { id: "look.bottom.shorts", name: "短裤", price: 250, slot: "bottom", look: { bottom: "#6a9a5a", bottomStyle: "shorts" } },
          { id: "look.hair.blonde", name: "金色头发", price: 380, slot: "hair", look: { hair: "#e0b050" } },
          { id: "look.hair.black", name: "黑色头发", price: 200, slot: "hair", look: { hair: "#2a1d1a" } },
          { id: "look.hair.auburn", name: "红棕头发", price: 300, slot: "hair", look: { hair: "#a85a3a" } },
          { id: "look.style.long", name: "长发", price: 380, slot: "hairStyle", look: { hairStyle: "long" } },
          { id: "look.style.bun", name: "丸子头", price: 380, slot: "hairStyle", look: { hairStyle: "bun" } }
        ]
      },
      {
        id: "petlook",
        name: "宠物装扮",
        items: [
          { id: "party", name: "派对帽", price: 200, slot: "hat", pet: { hat: "party" } },
          { id: "flower", name: "花环", price: 150, slot: "hat", pet: { hat: "flower" } },
          { id: "beret", name: "贝雷帽", price: 300, slot: "hat", pet: { hat: "beret" } },
          { id: "grad", name: "学士帽", price: 380, slot: "hat", pet: { hat: "grad" } },
          { id: "bow", name: "蝴蝶结", price: 250, slot: "hat", pet: { hat: "bow" } },
          { id: "crown", name: "皇冠", price: 1e3, slot: "hat", pet: { hat: "crown" } },
          { id: "sky", name: "天蓝", price: 500, slot: "color", pet: { hue: 190 } },
          { id: "mint", name: "薄荷绿", price: 500, slot: "color", pet: { hue: 115 } },
          { id: "lilac", name: "丁香紫", price: 500, slot: "color", pet: { hue: 255 } },
          { id: "rose", name: "玫瑰粉", price: 500, slot: "color", pet: { hue: 320 } }
        ]
      }
    ],
    // 0.3 版宠物衣柜里有、新版没有的东西，按原价退回金币
    refund: { glasses: 120, shades: 150, bowtie: 80, bell: 100, scarf: 120 },
    // 宠物说的话（英文）。{name} 换成宠物名字，{sound} 换成叫声，{n} 换成数字
    lines: {
      hello: ["Hi! Ready for some words?", "Welcome back!", "Let's learn a few words today.", "{sound} Good to see you."],
      low: ["I'm a bit bored...", "Can we play in the garden?", "A new toy would be nice..."],
      sick: ["I don't feel well...", "I need some medicine...", "*cough cough*"],
      cured: ["I feel much better now!", "Thank you! All better."],
      toy: ["I love this toy!", "Yay, playtime!", "This is the best!", "{sound} So fun!"],
      play: ["This garden is so nice!", "Wheee!", "Look at all the flowers!", "I love it here."],
      study: ["Let's study together!", "I'll keep you company.", "You can do it!"],
      combo3: ["Three in a row!", "Nice streak!", "You're warming up!"],
      combo5: ["Five straight. Nice!", "You're on fire!", "Keep it going!"],
      combo10: ["Ten in a row! Unstoppable.", "Wow, ten straight!", "Are you a dictionary?"],
      wrong: ["Tricky one. You'll get it next time.", "No worries, mistakes help memory.", "Take one more look, then move on.", "Almost there!"],
      again: ["We met this word before! (-1)", "This one again? Let's nail it. (-1)", "Oops, an old friend. (-1)"],
      stage: ["Step done! On to the next.", "Nice, next step.", "Good job, keep going."],
      stagePerfect: ["Perfect step!", "All correct. Wow.", "Flawless!"],
      repeat: ["One more round. You can do it!", "Again! Practice makes perfect.", "Almost! Let's redo this step."],
      perfect: ["Perfect group! +{n} bonus.", "Not a single mistake! +{n}", "Wow, a perfect round! +{n}"],
      done: ["Group done! Take a breath.", "Nice work on that group.", "Another group down!"],
      goal: ["Daily goal complete! I'm so proud of you.", "Goal reached! +{n} coins.", "You did it! See you tomorrow?"],
      level: ["Level up! You are level {n} now.", "New level: {n}! Amazing."],
      bought: ["Ooh, shopping!", "Nice pick!", "Good choice!"],
      dressed: ["I love it! How do I look?", "So stylish!", "Thank you, it fits perfectly!"],
      click: ["Hey there!", "{sound}", "That tickles!", "Keep going, you're doing great.", "Hehe.", "Words, words, words!", "I'm {name}!"],
      walk: ["On my way!", "Coming!", "Here I go!"],
      sleep: ["Zzz...", "Zzz... five more minutes..."],
      wake: ["Oh! I was just resting my eyes.", "I'm awake!"],
      challenge: ["Challenge complete!", "You crushed today's challenge!", "Bonus coins!"],
      hungry: ["I'm hungry...", "Is it dinner time?", "*tummy rumbles*"],
      otherLow: ["{n} looks hungry...", "{n} wants to play with you.", "Can you check on {n}?"],
      otherSick: ["{n} is sick! Medicine, please?", "{n} doesn't feel well..."],
      fed: ["Yum!", "Delicious, thank you!", "{sound} So tasty!", "Nom nom nom."],
      grown: ["Look, it grew so big!", "Our garden is getting prettier!", "Wow, a whole tree now!"]
    }
  };

  // src/games/typing.ts
  function sameChar(typed, want) {
    if (typed === want) return true;
    return /[A-Za-z]/.test(want) && typed.toLowerCase() === want.toLowerCase();
  }
  var TypingRun = class {
    constructor(text) {
      /** 已经打对的字符数 */
      this.pos = 0;
      /** 刚刚打错的字（下一个字打对就清掉，用来把当前位置标红） */
      this.wrong = null;
      /** 按过的字符键总数 */
      this.keys = 0;
      /** 打对的按键数 */
      this.hits = 0;
      /** 打错的次数 */
      this.misses = 0;
      /** 连续打对了几个字 */
      this.combo = 0;
      /** 这一局最长的连击 */
      this.bestCombo = 0;
      this.startedAt = 0;
      this.pausedAt = 0;
      this.pausedTotal = 0;
      this.text = text;
      this.missed = new Uint8Array(text.length);
    }
    get done() {
      return this.pos >= this.text.length;
    }
    get started() {
      return this.startedAt > 0;
    }
    start(now) {
      if (!this.startedAt) this.startedAt = now;
    }
    pause(now) {
      if (this.startedAt && !this.pausedAt) this.pausedAt = now;
    }
    resume(now) {
      if (this.pausedAt) {
        this.pausedTotal += now - this.pausedAt;
        this.pausedAt = 0;
      }
    }
    /** 从开始到现在打了多少秒（暂停的时间不算） */
    elapsed(now) {
      if (!this.startedAt) return 0;
      const end = this.pausedAt || now;
      return Math.max(0, (end - this.startedAt - this.pausedTotal) / 1e3);
    }
    /** 进度 0–1 */
    progress() {
      return this.text.length ? this.pos / this.text.length : 1;
    }
    type(ch) {
      if (this.done) return "done";
      if (ch.length !== 1) return "ignored";
      this.keys++;
      if (sameChar(ch, this.text[this.pos])) {
        this.hits++;
        this.pos++;
        this.wrong = null;
        this.combo++;
        if (this.combo > this.bestCombo) this.bestCombo = this.combo;
        return this.done ? "done" : "ok";
      }
      this.misses++;
      this.missed[this.pos] = 1;
      this.wrong = ch;
      this.combo = 0;
      return "wrong";
    }
    /** 退格：把标红去掉（打对的字不会退回去） */
    backspace() {
      if (this.wrong === null) return false;
      this.wrong = null;
      return true;
    }
    /** 速度：每分钟打对多少个词（按 5 个字符一个词算，国际通行的算法） */
    wpm(now) {
      const s = this.elapsed(now);
      if (s < 1) return 0;
      return this.pos / 5 / (s / 60);
    }
    /** 正确率：打对的按键 / 全部按键 */
    accuracy() {
      return this.keys ? this.hits / this.keys : 1;
    }
  };
  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  // src/games/passages.ts
  var CUSTOM_BOOK = "__custom";
  function data() {
    return window.MARGIN_PASSAGES || null;
  }
  function builtin(i) {
    const d = data();
    const p = d && d.passages[i];
    if (!d || !p) return null;
    const src = d.sources[p.src];
    return { key: "b:" + i, text: p.text, source: "OpenStax《" + (src ? src.name : p.src) + "》" + p.sec + " · CC BY 4.0", url: src && src.url };
  }
  function wordSet(host2, book) {
    const s = /* @__PURE__ */ new Set();
    for (const w of host2.bookWords(book)) if (w) s.add(w.toLowerCase());
    return s;
  }
  var cache2 = /* @__PURE__ */ new Map();
  function bookPassages(host2, book) {
    const d = data();
    if (!d) return [];
    if (d.books[book]) return d.books[book];
    const hit = cache2.get(book);
    if (hit) return hit;
    const words = wordSet(host2, book);
    if (!words.size) return [];
    const scored = d.passages.map((p, i) => {
      const toks = new Set(p.text.toLowerCase().match(/[a-z]+/g) || []);
      let n = 0;
      for (const t of toks) if (words.has(t) || words.has(t.replace(/(es|s|ed|ing)$/, ""))) n++;
      return [n / Math.sqrt(toks.size || 1), i];
    });
    scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const out = scored.slice(0, 30).filter((x) => x[0] > 0).map((x) => x[1]);
    cache2.set(book, out);
    return out;
  }
  function customPassages(host2) {
    const g = host2.state().games;
    return g ? g.custom : [];
  }
  function pickPassage(host2, book, seen, exclude) {
    if (book === CUSTOM_BOOK) {
      const list = customPassages(host2).filter((c2) => "c:" + c2.id !== exclude);
      const all = list.length ? list : customPassages(host2);
      if (!all.length) return null;
      const c = all[Math.floor(Math.random() * all.length)];
      return { key: "c:" + c.id, text: c.text, source: "自定义 · " + c.title };
    }
    const ids = bookPassages(host2, book);
    if (!ids.length) return null;
    const recent = new Set(seen);
    let pool = ids.filter((i) => !recent.has(i) && "b:" + i !== exclude);
    if (!pool.length) pool = ids.filter((i) => "b:" + i !== exclude);
    if (!pool.length) pool = ids;
    return builtin(pool[Math.floor(Math.random() * pool.length)]);
  }
  function passageByKey(host2, key) {
    if (key.startsWith("b:")) return builtin(+key.slice(2));
    const c = customPassages(host2).find((x) => "c:" + x.id === key);
    return c ? { key, text: c.text, source: "自定义 · " + c.title } : null;
  }
  var REPL = {
    "‘": "'",
    "’": "'",
    "‚": "'",
    "‛": "'",
    "′": "'",
    "“": '"',
    "”": '"',
    "„": '"',
    "″": '"',
    "–": "-",
    "—": " - ",
    "―": " - ",
    "−": "-",
    "‐": "-",
    "‑": "-",
    "…": "...",
    " ": " ",
    " ": " ",
    "​": "",
    "­": "",
    "，": ", ",
    "。": ". ",
    "；": "; ",
    "：": ": ",
    "！": "! ",
    "？": "? ",
    "（": "(",
    "）": ")"
  };
  function normalizeText(raw) {
    let t = raw.replace(/[‘-‟‐-―…  ​­′″−，。；：！？（）]/g, (c) => REPL[c] ?? c);
    t = t.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    t = t.replace(/[^\x20-\x7e\n\t]/g, " ");
    t = t.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/[ \t]+/g, " ");
    return t.trim();
  }
  function splitPassages(text) {
    const paras = text.split(/\n{1,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    const out = [];
    let cur = "";
    const words = (s) => (s.match(/\S+/g) || []).length;
    const push = () => {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    };
    for (const p of paras) {
      const sentences = p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [p];
      for (const s of sentences) {
        if (cur && words(cur) + words(s) > 120) push();
        cur += s.endsWith(" ") ? s : s + " ";
        if (words(cur) >= 60) push();
      }
      if (words(cur) >= 30) push();
    }
    push();
    if (out.length > 1 && words(out[out.length - 1]) < 25) {
      const last = out.pop();
      out[out.length - 1] += " " + last;
    }
    return out;
  }

  // src/games/chase/geo.ts
  var TW = 32;
  var TH = 16;
  function timeOfDay(d = /* @__PURE__ */ new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 17) return "day";
    if (h >= 17 && h < 19.5 || h >= 5.5 && h < 7) return "dusk";
    return "night";
  }
  var ix = (gx, gy) => (gx - gy) * (TW / 2);
  var iy = (gx, gy) => (gx + gy) * (TH / 2);
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function hexOf(r, g, b) {
    return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  function shade(hex, amt) {
    const [r, g, b] = rgbOf(hex);
    const f = (v) => amt < 0 ? v * (1 + amt) : v + (255 - v) * amt;
    return hexOf(f(r), f(g), f(b));
  }
  function mix2(a, b, t) {
    const x = rgbOf(a);
    const y = rgbOf(b);
    return hexOf(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function rgba(hex, a) {
    const [r, g, b] = rgbOf(hex);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function grade(hex, tod) {
    if (tod === "day") return hex;
    if (tod === "dusk") return shade(mix2(hex, "#f0906a", 0.14), -0.16);
    return shade(mix2(hex, "#2a3558", 0.42), -0.42);
  }
  function poly(c, pts, fill) {
    c.fillStyle = fill;
    c.beginPath();
    pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    c.fill();
  }

  // src/games/chase/paint.ts
  var BASE = {
    asphalt: "#575d69",
    lane: "#f1d47e",
    marking: "#efece5",
    curb: "#9c9384",
    walk: "#ddd6c8",
    lot: "#cdc5b6",
    grass: "#8ec270",
    grassStripe: "#86ba68",
    path: "#e7dcc8",
    water: "#6cb2df",
    trunk: "#7a5539",
    frame: "#f6f2ea",
    glassTop: "#d6ecf8",
    glassBot: "#7ea9c9"
  };
  var WALLS = ["#e9b78f", "#ead49e", "#a9cdc0", "#c0c2de", "#dcc8b2", "#d29a7f", "#b0c1d2", "#f1e5ce"];
  var BRICKS = ["#b8664d", "#a85a48", "#c27a5a"];
  var GLASS2 = ["#7fa7c6", "#86b3c0", "#8f9fc4"];
  var AWNINGS = ["#d65a4f", "#2f8476", "#e2a53b", "#3f6fb8", "#8a5bb0"];
  var LIT_TOP = "#ffe9b0";
  var LIT_BOT = "#f6b45c";
  function litRate(tod) {
    return tod === "day" ? 0 : tod === "dusk" ? 0.3 : 0.55;
  }
  function bldBounds(b) {
    const xs = [ix(b.x, b.y), ix(b.x + b.w, b.y), ix(b.x + b.w, b.y + b.d), ix(b.x, b.y + b.d)];
    const ys = [iy(b.x, b.y), iy(b.x + b.w, b.y), iy(b.x + b.w, b.y + b.d), iy(b.x, b.y + b.d)];
    const x = Math.floor(Math.min(...xs)) - 3;
    const y = Math.floor(Math.min(...ys)) - b.h - 20;
    return { x, y, w: Math.ceil(Math.max(...xs)) + 3 - x, h: Math.ceil(Math.max(...ys)) + 3 - y };
  }
  function renderBuilding(b, tod, S) {
    const bb = bldBounds(b);
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(bb.w * S);
    cv.height = Math.ceil(bb.h * S);
    const c = cv.getContext("2d");
    const R = rng(b.seed);
    const g = (hex) => grade(hex, tod);
    const lit = litRate(tod);
    const { x, y, w, d, h } = b;
    const base = () => c.setTransform(S, 0, 0, S, -bb.x * S, -bb.y * S);
    const P = (gx, gy, up = 0) => [ix(gx, gy), iy(gx, gy) - up];
    const face = (gx, gy, dir) => {
      c.setTransform(S * ix(dir.gx, dir.gy), S * iy(dir.gx, dir.gy), 0, -S, S * (ix(gx, gy) - bb.x), S * (iy(gx, gy) - bb.y));
    };
    const box = (gx, gy, bw, bd, z2, hh, col) => {
      base();
      poly(c, [P(gx + bw, gy, z2), P(gx + bw, gy + bd, z2), P(gx + bw, gy + bd, z2 + hh), P(gx + bw, gy, z2 + hh)], g(shade(col, -0.06)));
      poly(c, [P(gx, gy + bd, z2), P(gx + bw, gy + bd, z2), P(gx + bw, gy + bd, z2 + hh), P(gx, gy + bd, z2 + hh)], g(shade(col, -0.24)));
      poly(c, [P(gx, gy, z2 + hh), P(gx + bw, gy, z2 + hh), P(gx + bw, gy + bd, z2 + hh), P(gx, gy + bd, z2 + hh)], g(shade(col, 0.1)));
    };
    const wallFace = (gx, gy, dir, len, col) => {
      face(gx, gy, dir);
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, shade(col, -0.16));
      gr.addColorStop(0.18, col);
      gr.addColorStop(1, shade(col, 0.05));
      c.fillStyle = gr;
      c.fillRect(0, 0, len, h);
    };
    const wallTone = b.style === "office" ? GLASS2[0] : b.wall;
    const colR = g(shade(wallTone, -0.03));
    const colL = g(shade(wallTone, -0.22));
    wallFace(x + w, y, { gx: 0, gy: 1 }, d, colR);
    wallFace(x, y + d, { gx: 1, gy: 0 }, w, colL);
    const dress = (gx, gy, dir, len, lightSide) => {
      face(gx, gy, dir);
      const dark = lightSide ? 0 : -0.16;
      if (b.style === "office") return officeFace(c, len, h, dark, R, lit, g);
      if (b.style === "warehouse") return warehouseFace(c, len, h, dark, g, b, gx, dir);
      if (b.style === "brick") {
        c.fillStyle = rgba("#3a1d14", 0.13);
        for (let v = 1.3; v < h - 2; v += 1.45) c.fillRect(0, v, len, 0.22);
      }
      const shop = b.style === "shop";
      const ground2 = shop ? 11 : 9;
      const floorH = 8;
      const floors = Math.max(0, Math.floor((h - ground2 - 3) / floorH));
      const cols = Math.max(1, Math.floor(len / 0.62));
      const pitch = len / cols;
      const frame = g(shade(b.style === "brick" ? "#f3ede2" : BASE.frame, dark));
      c.fillStyle = rgba("#000000", 0.07);
      for (let f = 0; f <= floors; f++) c.fillRect(0, ground2 + f * floorH - 0.5, len, 0.45);
      const balcony = b.style === "apt" && R() < 0.5;
      for (let f = 0; f < floors; f++) {
        for (let k = 0; k < cols; k++) {
          const u = (k + 0.5) * pitch;
          const v = ground2 + f * floorH + 1.6;
          windowAt(c, u, v, pitch * 0.48, 4.8, frame, R() < lit, dark, g, b.style === "brick");
          if (balcony && k % 2 === 0 && f % 2 === 0) {
            c.fillStyle = g(shade(b.wall, 0.12 + dark));
            c.fillRect(u - pitch * 0.42, v - 1.4, pitch * 0.84, 0.9);
            c.fillStyle = rgba("#2a2f3a", 0.55);
            for (let q = -0.38; q <= 0.39; q += 0.095) c.fillRect(u + pitch * q, v - 0.5, 0.035, 2.3);
            c.fillRect(u - pitch * 0.42, v + 1.7, pitch * 0.84, 0.3);
          }
        }
      }
      if (shop) shopFront(c, len, dark, g, R);
      else {
        const doorU = Math.max(0.4, Math.min(len - 0.4, len * (0.3 + R() * 0.4)));
        c.fillStyle = g(shade(b.wall, 0.14 + dark));
        c.fillRect(doorU - 0.26, 0, 0.52, 7.4);
        c.fillStyle = g(shade("#3b3f4c", dark));
        c.fillRect(doorU - 0.19, 0, 0.38, 6.4);
        c.fillStyle = rgba("#ffffff", 0.18);
        c.fillRect(doorU - 0.17, 3.8, 0.34, 2.2);
        c.fillStyle = g(shade("#5a6070", dark));
        c.fillRect(doorU - 0.33, 7.4, 0.66, 0.9);
        for (let k = 0; k < cols; k++) {
          const u = (k + 0.5) * pitch;
          if (Math.abs(u - doorU) < pitch * 0.75) continue;
          windowAt(c, u, 2.2, pitch * 0.48, 4.6, frame, R() < lit, dark, g, b.style === "brick");
        }
      }
      c.fillStyle = g(shade(b.wall, 0.18 + dark));
      c.fillRect(0, h - 1.6, len, 1.6);
      c.fillStyle = rgba("#000000", 0.12);
      c.fillRect(0, h - 2, len, 0.4);
    };
    dress(x + w, y, { gx: 0, gy: 1 }, d, true);
    dress(x, y + d, { gx: 1, gy: 0 }, w, false);
    base();
    c.strokeStyle = rgba("#ffffff", tod === "night" ? 0.08 : 0.22);
    c.lineWidth = 0.35;
    c.beginPath();
    c.moveTo(...P(x + w, y + d));
    c.lineTo(...P(x + w, y + d, h));
    c.stroke();
    const ins = Math.min(0.2, w * 0.08, d * 0.08);
    const roofCol = b.style === "warehouse" ? "#7d8590" : mix2(b.style === "office" ? "#9aa3ae" : b.wall, "#8d939c", 0.55);
    const rimCol = b.style === "office" ? "#d5dbe2" : shade(b.wall, 0.2);
    const z = h - 1.3;
    const ai = [x + ins, y + ins];
    const bi = [x + w - ins, y + ins];
    const ci = [x + w - ins, y + d - ins];
    const di = [x + ins, y + d - ins];
    poly(c, [P(ai[0], ai[1], z), P(bi[0], bi[1], z), P(ci[0], ci[1], z), P(di[0], di[1], z)], g(roofCol));
    poly(c, [P(ai[0], ai[1], z), P(bi[0], bi[1], z), P(bi[0], bi[1], h), P(ai[0], ai[1], h)], g(shade(rimCol, -0.3)));
    poly(c, [P(ai[0], ai[1], z), P(di[0], di[1], z), P(di[0], di[1], h), P(ai[0], ai[1], h)], g(shade(rimCol, -0.18)));
    c.fillStyle = g(rimCol);
    c.beginPath();
    for (const [gx, gy] of [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]) c.lineTo(...P(gx, gy, h));
    c.closePath();
    for (const q of [ai, di, ci, bi]) c.lineTo(...P(q[0], q[1], h));
    c.closePath();
    c.fill("evenodd");
    const RG = rng(b.seed + 7);
    for (let k = 0; k < w * d * 7; k++) {
      const gx = ai[0] + RG() * (bi[0] - ai[0]);
      const gy = ai[1] + RG() * (di[1] - ai[1]);
      const [px, py] = P(gx, gy, z);
      c.fillStyle = RG() < 0.5 ? rgba("#000000", 0.08) : rgba("#ffffff", 0.1);
      c.fillRect(px, py, 0.5, 0.35);
    }
    c.strokeStyle = rgba("#ffffff", tod === "night" ? 0.1 : 0.35);
    c.lineWidth = 0.3;
    c.beginPath();
    c.moveTo(...P(x, y + d, h));
    c.lineTo(...P(x + w, y + d, h));
    c.lineTo(...P(x + w, y, h));
    c.stroke();
    const roomy = w > 1.6 && d > 1.6;
    if (b.style === "warehouse") {
      for (let k = 0; k < 3; k++) {
        const gx = x + 0.8 + k * ((w - 1.6) / 2);
        skylight(c, P, gx - 0.35, y + d / 2 - 0.6, 0.7, 1.2, z, g);
      }
    } else if (roomy) {
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const gx = x + 0.5 + R() * (w - 1.3);
        const gy = y + 0.5 + R() * (d - 1.2);
        hvac(c, P, box, gx, gy, z, g);
      }
      if (h > 40 && R() < 0.6) tank(c, P, x + w * (0.25 + R() * 0.4), y + d * (0.25 + R() * 0.3), z, g);
      if (b.style === "office") {
        box(x + w * 0.55, y + d * 0.2, Math.min(1.1, w * 0.3), Math.min(0.9, d * 0.3), z, 6, "#c9cfd8");
        base();
        const [ax, ay] = P(x + w * 0.3, y + d * 0.6, z);
        c.strokeStyle = g("#5c636e");
        c.lineWidth = 0.4;
        c.beginPath();
        c.moveTo(ax, ay);
        c.lineTo(ax, ay - 14);
        c.stroke();
        c.fillStyle = tod === "day" ? "#c94a3f" : "#ff6a5a";
        c.beginPath();
        c.arc(ax, ay - 14.4, 0.7, 0, Math.PI * 2);
        c.fill();
      } else if (h < 34 && R() < 0.6) {
        solar(c, P, x + 0.4, y + 0.4, Math.min(2.2, w - 0.8), Math.min(1.2, d - 0.8), z, g);
      }
    }
    return cv;
  }
  function windowAt(c, u, v, ww, wh, frame, on, dark, g, lintel) {
    c.fillStyle = frame;
    c.fillRect(u - ww / 2 - 0.05, v - 0.45, ww + 0.1, wh + 0.9);
    const gr = c.createLinearGradient(0, v, 0, v + wh);
    if (on) {
      gr.addColorStop(0, LIT_TOP);
      gr.addColorStop(1, LIT_BOT);
    } else {
      gr.addColorStop(0, g(shade(BASE.glassBot, dark - 0.08)));
      gr.addColorStop(1, g(shade(BASE.glassTop, dark)));
    }
    c.fillStyle = gr;
    c.fillRect(u - ww / 2, v, ww, wh);
    c.fillStyle = frame;
    c.fillRect(u - 0.018, v, 0.036, wh);
    c.fillRect(u - ww / 2, v + wh * 0.68, ww, 0.3);
    if (!on) {
      c.fillStyle = rgba("#ffffff", 0.22);
      c.beginPath();
      c.moveTo(u - ww / 2, v + wh * 0.25);
      c.lineTo(u - ww / 2 + ww * 0.25, v + wh);
      c.lineTo(u - ww / 2 + ww * 0.4, v + wh);
      c.lineTo(u - ww / 2, v + wh * 0.05);
      c.closePath();
      c.fill();
    }
    c.fillStyle = rgba("#ffffff", 0.35);
    c.fillRect(u - ww / 2 - 0.08, v - 0.75, ww + 0.16, 0.35);
    if (lintel) {
      c.fillStyle = rgba("#3a1d14", 0.3);
      c.fillRect(u - ww / 2 - 0.06, v + wh + 0.45, ww + 0.12, 0.6);
    }
  }
  function officeFace(c, len, h, dark, R, lit, g) {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, g(shade("#5f86a8", dark - 0.06)));
    gr.addColorStop(0.55, g(shade("#8db8d6", dark)));
    gr.addColorStop(1, g(shade("#c3e0f1", dark)));
    c.fillStyle = gr;
    c.fillRect(0, 2.5, len, h - 4.5);
    const cols = Math.max(2, Math.round(len / 0.34));
    const pitch = len / cols;
    if (lit > 0) {
      for (let v = 3; v < h - 6; v += 6) {
        for (let k = 0; k < cols; k++) {
          if (R() >= lit * 0.8) continue;
          const gl = c.createLinearGradient(0, v, 0, v + 4);
          gl.addColorStop(0, LIT_TOP);
          gl.addColorStop(1, LIT_BOT);
          c.fillStyle = gl;
          c.fillRect(k * pitch, v + 0.6, pitch, 4.2);
        }
      }
    }
    c.fillStyle = rgba("#ffffff", 0.13);
    for (const u0 of [len * 0.12, len * 0.62]) {
      c.beginPath();
      c.moveTo(u0, 2.5);
      c.lineTo(u0 + len * 0.12, 2.5);
      c.lineTo(u0 + len * 0.3, h - 2);
      c.lineTo(u0 + len * 0.18, h - 2);
      c.closePath();
      c.fill();
    }
    c.fillStyle = g(shade("#dfe6ee", dark));
    for (let k = 0; k <= cols; k++) c.fillRect(k * pitch - 0.02, 2.5, 0.04, h - 4.5);
    c.fillStyle = g(shade("#4c5f73", dark));
    for (let v = 3; v < h - 3; v += 6) c.fillRect(0, v, len, 0.6);
    c.fillStyle = g(shade("#3d4a5a", dark));
    c.fillRect(0, 0, len, 2.5);
    c.fillStyle = g(shade("#dfe6ee", dark));
    c.fillRect(0, 2.4, len, 0.35);
  }
  function warehouseFace(c, len, h, dark, g, b, gx, dir) {
    for (let u = 0; u < len; u += 0.14) {
      c.fillStyle = rgba(u % 0.28 < 0.14 ? "#ffffff" : "#000000", 0.06);
      c.fillRect(u, 0, 0.07, h - 2);
    }
    c.fillStyle = g(shade("#4d4556", dark));
    c.fillRect(0, 0, len, 1.2);
    if (!b.door || dir.gx !== 1) return;
    const du = b.door.gx - gx;
    const half = 0.85;
    c.fillStyle = g(shade("#2c2830", dark));
    c.fillRect(du - half - 0.12, 0, (half + 0.12) * 2, 13);
    c.fillStyle = g(shade("#9a9aa4", dark));
    c.fillRect(du - half, 0, half * 2, 12);
    c.fillStyle = rgba("#000000", 0.18);
    for (let v = 0.8; v < 12; v += 1.1) c.fillRect(du - half, v, half * 2, 0.3);
    c.fillStyle = "#ffd36b";
    c.fillRect(du - 0.12, 14, 0.24, 0.9);
  }
  function shopFront(c, len, dark, g, R) {
    const awn = AWNINGS[Math.floor(R() * AWNINGS.length)];
    const gr = c.createLinearGradient(0, 0.6, 0, 7.4);
    gr.addColorStop(0, g(shade("#f2d79a", dark)));
    gr.addColorStop(1, g(shade("#6f8aa0", dark)));
    c.fillStyle = g(shade("#3a3d48", dark));
    c.fillRect(0, 0, len, 7.8);
    c.fillStyle = gr;
    c.fillRect(0.06, 0.6, len - 0.12, 6.8);
    c.fillStyle = g(shade("#e9e3d6", dark));
    for (let u = 0; u <= len; u += 0.5) c.fillRect(u - 0.025, 0.6, 0.05, 6.8);
    for (let u = 0, k = 0; u < len; u += 0.22, k++) {
      c.fillStyle = g(shade(k % 2 ? "#f4efe6" : awn, dark));
      c.fillRect(u, 7.6, 0.22, 2.4);
    }
    c.fillStyle = rgba("#000000", 0.2);
    c.fillRect(0, 7.4, len, 0.4);
    c.fillStyle = g(shade("#2f3340", dark));
    c.fillRect(len * 0.18, 10.4, len * 0.64, 2.2);
    c.fillStyle = g(shade("#f6e3a6", dark));
    for (let k = 0; k < 4; k++) c.fillRect(len * 0.24 + k * len * 0.14, 11, len * 0.09, 1);
  }
  function hvac(c, P, box, gx, gy, z, g) {
    box(gx, gy, 0.55, 0.42, z, 3.2, "#b9bfc8");
    const [cx, cy] = P(gx + 0.28, gy + 0.21, z + 3.2);
    c.fillStyle = g("#7d848f");
    c.beginPath();
    c.ellipse(cx, cy, 2.6, 1.3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = g("#5e646e");
    c.beginPath();
    c.ellipse(cx, cy, 0.7, 0.35, 0, 0, Math.PI * 2);
    c.fill();
  }
  function tank(c, P, gx, gy, z, g) {
    const [cx, cy] = P(gx, gy, z);
    c.strokeStyle = g("#4a3c33");
    c.lineWidth = 0.45;
    for (const [dx, dy] of [[-2.4, 0], [2.4, 0], [-1.4, 1], [1.4, 1]]) {
      c.beginPath();
      c.moveTo(cx + dx, cy + dy);
      c.lineTo(cx + dx * 0.9, cy + dy - 4);
      c.stroke();
    }
    const top = cy - 11;
    const gr = c.createLinearGradient(cx - 3, 0, cx + 3, 0);
    gr.addColorStop(0, g("#7a5236"));
    gr.addColorStop(0.45, g("#a8754d"));
    gr.addColorStop(1, g("#6a4630"));
    c.fillStyle = gr;
    c.fillRect(cx - 3, top, 6, 7);
    c.beginPath();
    c.ellipse(cx, cy - 4, 3, 1.4, 0, 0, Math.PI);
    c.fill();
    c.fillStyle = g("#5b3e2c");
    c.fillRect(cx - 3, top + 2.2, 6, 0.4);
    c.fillRect(cx - 3, top + 4.8, 6, 0.4);
    c.fillStyle = g("#4d4f58");
    c.beginPath();
    c.moveTo(cx - 3.3, top);
    c.lineTo(cx, top - 3);
    c.lineTo(cx + 3.3, top);
    c.closePath();
    c.fill();
    c.fillStyle = g("#686b75");
    c.beginPath();
    c.moveTo(cx, top - 3);
    c.lineTo(cx + 3.3, top);
    c.lineTo(cx, top + 0.6);
    c.closePath();
    c.fill();
  }
  function skylight(c, P, gx, gy, w, d, z, g) {
    poly(c, [P(gx, gy, z), P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx, gy + d, z)], g("#5d6670"));
    poly(c, [P(gx + 0.08, gy + 0.08, z + 1.4), P(gx + w - 0.08, gy + 0.08, z + 1.4), P(gx + w - 0.08, gy + d - 0.08, z + 1.4), P(gx + 0.08, gy + d - 0.08, z + 1.4)], g("#a8cfe6"));
    c.strokeStyle = rgba("#ffffff", 0.45);
    c.lineWidth = 0.25;
    c.beginPath();
    c.moveTo(...P(gx + 0.1, gy + d * 0.5, z + 1.4));
    c.lineTo(...P(gx + w - 0.1, gy + d * 0.5, z + 1.4));
    c.stroke();
  }
  function solar(c, P, gx, gy, w, d, z, g) {
    const n = Math.max(1, Math.floor(w / 0.55));
    for (let k = 0; k < n; k++) {
      const x0 = gx + k * 0.55;
      poly(c, [P(x0, gy, z + 0.6), P(x0 + 0.48, gy, z + 0.6), P(x0 + 0.48, gy + d, z + 2.4), P(x0, gy + d, z + 2.4)], g("#2f4f86"));
      c.strokeStyle = rgba("#9fc4f0", 0.5);
      c.lineWidth = 0.18;
      c.beginPath();
      for (let t = 0.25; t < 1; t += 0.25) {
        c.moveTo(...P(x0, gy + d * t, z + 0.6 + 1.8 * t));
        c.lineTo(...P(x0 + 0.48, gy + d * t, z + 0.6 + 1.8 * t));
      }
      c.stroke();
    }
  }
  function drawTree2(c, x, y, size, kind, tod, tint) {
    const g = (h) => grade(h, tod);
    const leaf = mix2("#4f9a4c", tint > 0.5 ? "#7aa33c" : "#3d8f73", Math.abs(tint - 0.5) * 0.6);
    const dk = g(shade(leaf, -0.28));
    const md = g(leaf);
    const lt = g(shade(leaf, 0.28));
    const th = 6 * size;
    const tr = c.createLinearGradient(x - 1, 0, x + 1, 0);
    tr.addColorStop(0, g("#8a6142"));
    tr.addColorStop(1, g("#5a3c28"));
    c.fillStyle = tr;
    c.fillRect(x - 0.8 * size, y - th - 2, 1.6 * size, th + 2);
    if (kind === 1) {
      for (let k = 0; k < 3; k++) {
        const by = y - th + 2 - k * 4.6 * size;
        const hw = (6.4 - k * 1.6) * size;
        const hh = 7.2 * size;
        c.fillStyle = dk;
        c.beginPath();
        c.moveTo(x - hw, by);
        c.quadraticCurveTo(x, by + 2 * size, x + hw, by);
        c.lineTo(x, by - hh);
        c.closePath();
        c.fill();
        c.fillStyle = md;
        c.beginPath();
        c.moveTo(x - hw * 0.92, by - 0.4);
        c.quadraticCurveTo(x - hw * 0.3, by + 0.6 * size, x + 0.2, by + 0.3);
        c.lineTo(x, by - hh);
        c.closePath();
        c.fill();
        c.fillStyle = lt;
        c.beginPath();
        c.moveTo(x - hw * 0.45, by - hh * 0.5);
        c.lineTo(x, by - hh);
        c.lineTo(x - hw * 0.15, by - hh * 0.35);
        c.closePath();
        c.fill();
      }
      return;
    }
    const r = 6.4 * size;
    const cx = x;
    const cy = y - th - r * 0.72;
    const blobs = [
      [-0.48, 0.18, 0.62],
      [0.5, 0.22, 0.6],
      [0, -0.28, 0.72],
      [0.02, 0.3, 0.74]
    ];
    const circle = (bx, by, br, col) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(cx + bx * r, cy + by * r, br * r, 0, Math.PI * 2);
      c.fill();
    };
    for (const [bx, by, br] of blobs) circle(bx, by, br, dk);
    for (const [bx, by, br] of blobs) circle(bx - 0.12, by - 0.16, br * 0.8, md);
    circle(-0.32, -0.42, 0.34, lt);
    circle(0.12, -0.6, 0.22, lt);
    circle(-0.62, 0, 0.18, lt);
    c.fillStyle = rgba("#ffffff", tod === "night" ? 0.05 : 0.16);
    for (const [bx, by] of [[-0.2, -0.2], [0.3, -0.05], [-0.05, 0.25], [0.45, 0.35]]) {
      c.beginPath();
      c.ellipse(cx + bx * r, cy + by * r, 0.9 * size, 0.55 * size, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  }
  function drawCar(c, x, y, dir, color, kind, siren, tod) {
    const g = (h) => grade(h, tod);
    const side = { gx: -dir.gy, gy: dir.gx };
    const pt = (a, s, z) => {
      const gx = dir.gx * a + side.gx * s;
      const gy = dir.gy * a + side.gy * s;
      return [x + ix(gx, gy), y + iy(gx, gy) - z];
    };
    const visible = (na, ns) => dir.gx * na + side.gx * ns + (dir.gy * na + side.gy * ns) > 0.01;
    const tone = (na, ns) => {
      const ngx = dir.gx * na + side.gx * ns;
      const ngy = dir.gy * na + side.gy * ns;
      return -0.15 + 0.09 * (ngx - ngy);
    };
    const HL = 0.62;
    const HW = 0.3;
    c.fillStyle = "rgba(10,12,22,.32)";
    c.beginPath();
    const s0 = [pt(HL + 0.06, HW + 0.06, 0), pt(HL + 0.06, -HW - 0.06, 0), pt(-HL - 0.06, -HW - 0.06, 0), pt(-HL - 0.06, HW + 0.06, 0)];
    s0.forEach(([a, b], k) => k ? c.lineTo(a + 1, b + 1) : c.moveTo(a + 1, b + 1));
    c.closePath();
    c.fill();
    for (const [a, s] of [[0.38, HW], [0.38, -HW], [-0.38, HW], [-0.38, -HW]]) {
      const [wx, wy] = pt(a, s, 1.3);
      c.fillStyle = "#16171c";
      c.beginPath();
      c.ellipse(wx, wy, 1.75, 1.35, 0, 0, Math.PI * 2);
      c.fill();
      if (visible(0, Math.sign(s))) {
        c.fillStyle = "#9aa0aa";
        c.beginPath();
        c.ellipse(wx, wy, 0.7, 0.55, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    const body = g(color);
    const quad = (pts, col) => poly(c, pts, col);
    const z0 = 1.2;
    const z1 = 4.4;
    const corners = [
      [HL, HW],
      [HL, -HW],
      [-HL, -HW],
      [-HL, HW]
    ];
    const normals = [
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1]
    ];
    for (let k = 0; k < 4; k++) {
      const [na, ns] = normals[k];
      if (!visible(na, ns)) continue;
      const [a1, s1] = corners[k];
      const [a2, s2] = corners[(k + 1) % 4];
      quad([pt(a1, s1, z0), pt(a2, s2, z0), pt(a2, s2, z1), pt(a1, s1, z1)], shade(body, tone(na, ns)));
      if (kind === "police" && ns !== 0) {
        quad([pt(0.36, s1, z0), pt(-0.44, s1, z0), pt(-0.44, s1, z0 + 1.6), pt(0.36, s1, z0 + 1.6)], g(shade("#1d2b57", tone(na, ns) + 0.1)));
        quad([pt(0.6, s1, z0 + 2.1), pt(-0.6, s1, z0 + 2.1), pt(-0.6, s1, z0 + 2.7), pt(0.6, s1, z0 + 2.7)], g(shade("#2f73e6", tone(na, ns) + 0.12)));
      }
      if (na === 1) {
        for (const s of [0.2, -0.2]) quad([pt(HL + 0.01, s + 0.07, 2.6), pt(HL + 0.01, s - 0.07, 2.6), pt(HL + 0.01, s - 0.07, 3.5), pt(HL + 0.01, s + 0.07, 3.5)], "#fff3c4");
        quad([pt(HL + 0.01, 0.1, 1.9), pt(HL + 0.01, -0.1, 1.9), pt(HL + 0.01, -0.1, 2.9), pt(HL + 0.01, 0.1, 2.9)], g("#2a2c33"));
      }
      if (na === -1) {
        for (const s of [0.21, -0.21]) quad([pt(-HL - 0.01, s + 0.06, 2.8), pt(-HL - 0.01, s - 0.06, 2.8), pt(-HL - 0.01, s - 0.06, 3.6), pt(-HL - 0.01, s + 0.06, 3.6)], "#e0453b");
      }
    }
    quad(corners.map(([a, s]) => pt(a, s, z1)), shade(body, 0.08));
    if (kind === "police") {
      quad([pt(HL, HW, z1), pt(HL, -HW, z1), pt(0.24, -HW, z1), pt(0.24, HW, z1)], g("#1d2b57"));
    }
    const cab = [
      [0.24, HW * 0.86],
      [0.24, -HW * 0.86],
      [-0.4, -HW * 0.86],
      [-0.4, HW * 0.86]
    ];
    const top = [
      [0.04, HW * 0.72],
      [0.04, -HW * 0.72],
      [-0.32, -HW * 0.72],
      [-0.32, HW * 0.72]
    ];
    const z2 = 7.6;
    for (let k = 0; k < 4; k++) {
      const [na, ns] = normals[k];
      if (!visible(na, ns)) continue;
      const a = cab[k];
      const b = cab[(k + 1) % 4];
      const ta = top[k];
      const tb = top[(k + 1) % 4];
      const pts = [pt(a[0], a[1], z1), pt(b[0], b[1], z1), pt(tb[0], tb[1], z2), pt(ta[0], ta[1], z2)];
      const glass = c.createLinearGradient(0, pts[0][1], 0, pts[3][1]);
      glass.addColorStop(0, g(shade("#2b3a52", tone(na, ns) * 0.6)));
      glass.addColorStop(1, g(shade("#6d8fb2", tone(na, ns) * 0.6)));
      quad(pts, glass);
      if (ns !== 0) {
        const m = pt(-0.08, a[1], z1);
        const mt = pt(-0.12, ta[1], z2);
        c.strokeStyle = shade(body, tone(na, ns));
        c.lineWidth = 0.45;
        c.beginPath();
        c.moveTo(m[0], m[1]);
        c.lineTo(mt[0], mt[1]);
        c.stroke();
      }
    }
    quad(top.map(([a, s]) => pt(a, s, z2)), shade(body, 0.14));
    c.strokeStyle = rgba("#ffffff", tod === "night" ? 0.12 : 0.4);
    c.lineWidth = 0.3;
    c.beginPath();
    const t0 = top.map(([a, s]) => pt(a, s, z2));
    c.moveTo(...t0[3]);
    c.lineTo(...t0[0]);
    c.lineTo(...t0[1]);
    c.stroke();
    if (kind === "taxi") {
      const cx0 = pt(-0.14, 0, z2);
      c.fillStyle = "#2b2b30";
      c.fillRect(cx0[0] - 2.2, cx0[1] - 2.2, 4.4, 2);
      c.fillStyle = tod === "day" ? "#fff3c4" : "#ffe08a";
      c.fillRect(cx0[0] - 1.9, cx0[1] - 2, 3.8, 1.3);
    }
    if (kind === "police") {
      const bar = (s1, s2, on, col, off) => {
        const p1 = [pt(-0.08, s1, z2), pt(-0.08, s2, z2), pt(-0.18, s2, z2), pt(-0.18, s1, z2)];
        const up = 1.5;
        quad([p1[0], p1[1], [p1[1][0], p1[1][1] - up], [p1[0][0], p1[0][1] - up]], on ? shade(col, -0.1) : off);
        quad([p1[1], p1[2], [p1[2][0], p1[2][1] - up], [p1[1][0], p1[1][1] - up]], on ? shade(col, -0.25) : shade(off, -0.2));
        quad(p1.map(([px, py]) => [px, py - up]), on ? "#ffffff" : shade(off, 0.15));
        if (on) quad(p1.map(([px, py]) => [px, py - up]).map(([px, py], i, arr) => [px + (arr[(i + 2) % 4][0] - px) * 0.2, py + (arr[(i + 2) % 4][1] - py) * 0.2]), col);
      };
      bar(0.2, 0.02, siren === 0, "#ff3b30", "#7a2622");
      bar(-0.02, -0.2, siren === 1, "#2f8bff", "#203f77");
    }
  }
  function drawLamp(c, x, y, tod, flip) {
    const g = (h) => grade(h, tod);
    const d = flip ? -1 : 1;
    c.fillStyle = "rgba(10,12,22,.25)";
    c.beginPath();
    c.ellipse(x + 1, y + 0.5, 2.2, 1, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = g("#3c414d");
    c.fillRect(x - 0.9, y - 1.2, 1.8, 1.4);
    c.strokeStyle = g("#4a505c");
    c.lineWidth = 0.75;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - 17);
    c.quadraticCurveTo(x, y - 19, x + 2.4 * d, y - 19);
    c.lineTo(x + 4 * d, y - 19);
    c.stroke();
    c.fillStyle = g("#2f333c");
    c.beginPath();
    c.ellipse(x + 4.4 * d, y - 18.6, 1.9, 0.9, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = tod === "day" ? "#e9edf2" : "#fff1c2";
    c.beginPath();
    c.ellipse(x + 4.4 * d, y - 18.5, 1.4, 0.5, 0, 0, Math.PI * 2);
    c.fill();
    if (tod !== "day") {
      const hx = x + 4.4 * d;
      const hy = y - 18.3;
      c.save();
      c.globalCompositeOperation = "lighter";
      const gr = c.createRadialGradient(hx, hy, 0, hx, hy, 9);
      gr.addColorStop(0, tod === "night" ? "rgba(255,214,140,.55)" : "rgba(255,214,140,.28)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gr;
      c.fillRect(hx - 9, hy - 9, 18, 18);
      const lg = c.createRadialGradient(hx, y + 1, 0, hx, y + 1, 16);
      lg.addColorStop(0, tod === "night" ? "rgba(255,190,110,.13)" : "rgba(255,190,110,.06)");
      lg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = lg;
      c.fillRect(hx - 16, y - 15, 32, 32);
      c.restore();
    }
  }
  function drawHydrant(c, x, y, tod) {
    const g = (h) => grade(h, tod);
    c.fillStyle = "rgba(10,12,22,.22)";
    c.beginPath();
    c.ellipse(x + 0.6, y + 0.3, 1.6, 0.7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = g("#c63b30");
    c.fillRect(x - 1, y - 3.6, 2, 3.6);
    c.fillStyle = g("#e5564a");
    c.fillRect(x - 1, y - 3.6, 0.9, 3.6);
    c.beginPath();
    c.ellipse(x, y - 3.7, 1.1, 0.7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = g("#9c2a22");
    c.fillRect(x - 1.6, y - 2.6, 3.2, 0.8);
  }

  // src/games/chase/sprites.ts
  function shadow(c, x, y, rx, ry) {
    c.fillStyle = "rgba(10,12,25,.3)";
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
  var INK2 = "#17161c";
  function drawThief(c, x, y, t, pose, flip, tod) {
    const g = (h) => grade(h, tod === "night" ? "dusk" : tod);
    const SKIN = g("#f2c69a");
    const HAT = g("#24252e");
    const PANTS = g("#323a58");
    const SHOE = "#121216";
    const SLEEVE = g("#2b2e3b");
    const BAG = g("#cfa369");
    c.save();
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    c.lineCap = "round";
    c.lineJoin = "round";
    const run = pose === "run";
    const ph = t / 1e3 * Math.PI * 2 * 1.7;
    const sw = run ? Math.sin(ph) : 0;
    const bob2 = run ? -Math.abs(Math.cos(ph)) * 1.1 : pose === "caught" ? 0 : Math.sin(t / 400) * 0.25;
    const lean = run ? 0.16 : 0;
    const hipY = -9.4 + bob2;
    const shY = -16.6 + bob2;
    const limb = (pts, w, col) => {
      c.strokeStyle = INK2;
      c.lineWidth = w + 1.3;
      c.beginPath();
      pts.forEach(([a, b], k) => k ? c.lineTo(a, b) : c.moveTo(a, b));
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = w;
      c.stroke();
    };
    const leg = (a, knee, col) => {
      const hx2 = 0;
      const kx = hx2 + Math.sin(a) * 4.6;
      const ky = hipY + Math.cos(a) * 4.6;
      const fa = a - knee;
      const fx = kx + Math.sin(fa) * 4.6;
      const fy = ky + Math.cos(fa) * 4.6;
      limb([[hx2, hipY], [kx, ky], [fx, fy]], 2.3, col);
      c.fillStyle = INK2;
      c.beginPath();
      c.ellipse(fx + 0.9, fy + 0.2, 1.9, 1.05, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = SHOE;
      c.beginPath();
      c.ellipse(fx + 0.9, fy + 0.1, 1.4, 0.65, 0, 0, Math.PI * 2);
      c.fill();
    };
    const arm = (a, elbow, col) => {
      const sx = Math.sin(lean) * 7;
      const ex = sx + Math.sin(a) * 3.6;
      const ey = shY + 0.8 + Math.cos(a) * 3.6;
      const fa = a + elbow;
      const hx2 = ex + Math.sin(fa) * 3.3;
      const hy2 = ey + Math.cos(fa) * 3.3;
      limb([[sx, shY + 0.8], [ex, ey], [hx2, hy2]], 1.9, col);
      c.fillStyle = INK2;
      c.beginPath();
      c.arc(hx2, hy2, 1.35, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = SKIN;
      c.beginPath();
      c.arc(hx2, hy2, 0.85, 0, Math.PI * 2);
      c.fill();
    };
    const backCol = g("#262a42");
    if (pose === "caught") {
      bag(c, 5.5, -3.5, 0.9, BAG);
      leg(0.12, 0.05, backCol);
      leg(-0.12, 0.05, PANTS);
      arm(Math.PI + 1.25, -0.75, SLEEVE);
    } else {
      arm(-sw * 0.9, run ? 0.9 + sw * 0.3 : 0.15, SLEEVE);
      leg(-sw * 0.8, run ? Math.max(0.1, Math.cos(ph) * 1.1) : 0.05, backCol);
      bag(c, -4.4 + Math.sin(lean) * 5, shY + 3.2, 1, BAG);
    }
    c.save();
    c.translate(0, hipY);
    c.rotate(lean);
    const tw = 6.6;
    const th = hipY - shY;
    const body = () => {
      c.beginPath();
      c.moveTo(-tw / 2, 0.6);
      c.lineTo(-tw / 2 + 0.2, -th + 1.6);
      c.quadraticCurveTo(-tw / 2 + 0.4, -th, -tw / 2 + 2, -th);
      c.lineTo(tw / 2 - 2, -th);
      c.quadraticCurveTo(tw / 2 - 0.4, -th, tw / 2 - 0.2, -th + 1.6);
      c.lineTo(tw / 2, 0.6);
      c.closePath();
    };
    body();
    c.strokeStyle = INK2;
    c.lineWidth = 1.3;
    c.stroke();
    c.save();
    body();
    c.clip();
    for (let k = 0; k * 1.2 < th + 1; k++) {
      c.fillStyle = k % 2 ? g("#2c2f3c") : g("#f2eee5");
      c.fillRect(-tw / 2, -th + k * 1.2, tw, 1.2);
    }
    c.fillStyle = "rgba(20,20,40,.18)";
    c.fillRect(-tw / 2, -th, 1.6, th + 1);
    c.restore();
    c.restore();
    if (pose !== "caught") leg(sw * 0.8, run ? Math.max(0.1, -Math.cos(ph) * 1.1) : 0.05, PANTS);
    const hx = Math.sin(lean) * 8.6 + 0.4;
    const hy = shY - 3.4;
    c.fillStyle = INK2;
    c.beginPath();
    c.arc(hx, hy, 4.05, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = SKIN;
    c.beginPath();
    c.arc(hx, hy, 3.4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(hx + 3.2, hy + 0.5, 0.9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = HAT;
    c.beginPath();
    c.arc(hx, hy - 0.2, 3.65, Math.PI * 1.02, Math.PI * 1.98);
    c.closePath();
    c.fill();
    c.fillStyle = g("#3b3e4c");
    c.fillRect(hx - 3.6, hy - 1.3, 7.2, 1.2);
    c.fillStyle = HAT;
    c.beginPath();
    c.arc(hx - 0.6, hy - 3.9, 0.9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#121216";
    c.fillRect(hx - 3.4, hy + 0.1, 7.1, 1.7);
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(hx + 1.9, hy + 0.95, 0.62, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#121216";
    c.beginPath();
    c.arc(hx + 2.15, hy + 0.95, 0.3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = g("#9a5a48");
    c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(hx + 1.2, hy + 2.6);
    c.lineTo(hx + 2.4, hy + 2.5);
    c.stroke();
    if (pose === "caught") arm(Math.PI - 1.25, 0.75, SLEEVE);
    else arm(sw * 0.9, run ? 0.9 - sw * 0.3 : 0.15, SLEEVE);
    c.restore();
  }
  function bag(c, x, y, s, col) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = INK2;
    c.beginPath();
    c.ellipse(0, 0.6, 4.2, 4.6, 0, 0, Math.PI * 2);
    c.fill();
    const gr = c.createLinearGradient(-3, -3, 3, 4);
    gr.addColorStop(0, col);
    gr.addColorStop(1, "#a87c46");
    c.fillStyle = gr;
    c.beginPath();
    c.ellipse(0, 0.6, 3.5, 3.9, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#7a5530";
    c.fillRect(-1.3, -3.6, 2.6, 1);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(-1.4, -3.4);
    c.lineTo(0, -5.2);
    c.lineTo(1.4, -3.4);
    c.closePath();
    c.fill();
    c.fillStyle = "#6a4a2a";
    c.font = "700 4.6px system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("$", 0, 1);
    c.restore();
  }

  // src/games/chase/scene.ts
  var START = 2.5;
  var THIEF_AHEAD = 0.9;
  var DOOR_BEFORE = 0.25;
  var ZOOM = 2;
  var ChaseScene = class {
    constructor(get, city) {
      this.canvas = null;
      this.wrap = null;
      this.ctx = null;
      this.raf = 0;
      this.ro = null;
      this.w = 300;
      // 画面的大小（大地图上的像素）
      this.h = 160;
      this.Z = ZOOM;
      // 一个大地图像素 = Z 个画布像素
      this.camX = 0;
      this.camY = 0;
      this.policeS = START;
      this.carDir = { gx: 1, gy: 0 };
      this.last = 0;
      this.skids = [];
      this.sparks = [];
      this.boostUntil = 0;
      this.light = null;
      this.get = get;
      this.city = city;
    }
    reset(city) {
      this.city = city;
      this.policeS = START;
      this.carDir = { ...city.at(START).dir };
      this.skids = [];
      this.sparks = [];
      this.boostUntil = 0;
      this.snapCamera();
    }
    attach(canvas, wrap) {
      this.detach();
      this.canvas = canvas;
      this.wrap = wrap;
      this.ctx = canvas.getContext("2d");
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(() => this.fit());
        this.ro.observe(wrap);
      }
      this.fit();
      this.snapCamera();
      this.last = performance.now();
      const loop = (t) => {
        if (!this.canvas || !document.body.contains(this.canvas)) return;
        this.draw(t);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    detach() {
      cancelAnimationFrame(this.raf);
      if (this.ro) this.ro.disconnect();
      this.ro = null;
      this.canvas = null;
      this.ctx = null;
    }
    /** 打错：轮胎在地上留一道刹车印 */
    skid() {
      const p = this.city.at(this.policeS);
      this.skids.push({ g: { gx: p.gx, gy: p.gy }, dir: p.dir, t: 0 });
      if (this.skids.length > 60) this.skids.shift();
    }
    /** 连击加速：车尾冒火 */
    boost(now) {
      this.boostUntil = now + 900;
    }
    /** 画布按屏幕的真实像素来（Retina 屏两倍）；高度用满窗口剩下的地方，整页不用滚动 */
    fit() {
      if (!this.canvas || !this.wrap) return;
      const r = this.wrap.getBoundingClientRect();
      const border = this.wrap.offsetWidth - this.wrap.clientWidth;
      const cssW = Math.max(300, r.width - border);
      const top = r.top + window.scrollY;
      const cssH = Math.round(Math.max(240, Math.min(500, window.innerHeight - top - 345)));
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      this.Z = ZOOM * dpr;
      this.w = cssW / ZOOM;
      this.h = cssH / ZOOM;
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = cssH + "px";
      this.wrap.style.height = cssH + "px";
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = "high";
      }
    }
    track() {
      return this.city.length - START - THIEF_AHEAD - DOOR_BEFORE;
    }
    thiefS(q) {
      return START + THIEF_AHEAD + q * this.track();
    }
    policeTarget(p) {
      return START + p * this.track();
    }
    /** 镜头：两个人都放得下就放在中间；放不下就跟着警车，往小偷那边偏 */
    camTarget(s) {
      const c = this.city;
      const a = c.at(this.policeS);
      const b = c.at(this.thiefS(s.thief));
      const ax = c.sx(a);
      const ay = c.sy(a) - 8;
      let dx = c.sx(b) - ax;
      let dy = c.sy(b) - 8 - ay;
      const mx = this.w / 2 - 40;
      const my = this.h / 2 - 30;
      dx = Math.max(-mx, Math.min(mx, dx / 2));
      dy = Math.max(-my, Math.min(my, dy / 2));
      const yAt = s.phase === "won" || s.phase === "lost" ? 0.74 : 0.55;
      const cx = Math.max(0, Math.min(c.width - this.w, ax + dx - this.w / 2));
      const cy = Math.max(0, Math.min(c.height - this.h, ay + dy - this.h * yAt));
      return [cx, cy];
    }
    snapCamera() {
      const s = this.get();
      this.policeS = this.policeTarget(s.police);
      this.carDir = { ...this.city.at(this.policeS).dir };
      [this.camX, this.camY] = this.camTarget(s);
    }
    draw(t) {
      const c = this.ctx;
      const cv = this.canvas;
      if (!c || !cv) return;
      const dt = Math.min(0.05, (t - this.last) / 1e3);
      this.last = t;
      const s = this.get();
      const city = this.city;
      city.tick();
      const Z = this.Z;
      const target = this.policeTarget(s.police);
      this.policeS += (target - this.policeS) * Math.min(1, dt * 8);
      if (Math.abs(target - this.policeS) < 5e-3) this.policeS = target;
      const [tx, ty] = this.camTarget(s);
      this.camX += (tx - this.camX) * Math.min(1, dt * 3.5);
      this.camY += (ty - this.camY) * Math.min(1, dt * 3.5);
      const cx = Math.round(this.camX * Z) / Z;
      const cy = Math.round(this.camY * Z) / Z;
      const w = this.w;
      const h = this.h;
      const X = (g) => city.sx(g);
      const Y = (g) => city.sy(g);
      const tod = city.tod;
      c.setTransform(Z, 0, 0, Z, -cx * Z, -cy * Z);
      c.fillStyle = "#2b2e38";
      c.fillRect(cx, cy, w, h);
      city.drawGround(c, cx, cy, w, h, Z);
      c.lineCap = "round";
      for (const k2 of this.skids) {
        k2.t += dt;
        const al = Math.max(0, 0.45 - k2.t / 12);
        if (al <= 0) continue;
        c.strokeStyle = `rgba(18,18,24,${al.toFixed(2)})`;
        c.lineWidth = 1.1;
        for (const off of [-0.2, 0.2]) {
          const side = { gx: -k2.dir.gy * off, gy: k2.dir.gx * off };
          const a = { gx: k2.g.gx + side.gx - k2.dir.gx * 0.2, gy: k2.g.gy + side.gy - k2.dir.gy * 0.2 };
          const b = { gx: k2.g.gx + side.gx - k2.dir.gx * 1, gy: k2.g.gy + side.gy - k2.dir.gy * 1 };
          c.beginPath();
          c.moveTo(X(a), Y(a));
          c.lineTo(X(b), Y(b));
          c.stroke();
        }
      }
      this.skids = this.skids.filter((k2) => k2.t < 6);
      if (tod !== "day") this.darkGround(c, cv, cx, cy);
      const pol = city.at(this.policeS);
      const k = Math.min(1, dt * 10);
      this.carDir = { gx: this.carDir.gx + (pol.dir.gx - this.carDir.gx) * k, gy: this.carDir.gy + (pol.dir.gy - this.carDir.gy) * k };
      const len = Math.hypot(this.carDir.gx, this.carDir.gy) || 1;
      const dir = { gx: this.carDir.gx / len, gy: this.carDir.gy / len };
      const thiefPos = city.at(this.thiefS(s.thief));
      const gone = s.phase === "lost" && t - s.endAt > 250;
      const flash = s.phase === "ready" ? -1 : Math.floor(t / 140) % 2;
      const ents = [];
      if (!gone) {
        ents.push({
          g: thiefPos,
          done: false,
          draw: (alpha) => {
            c.globalAlpha = alpha;
            if (alpha === 1) shadow(c, X(thiefPos) + 1.2, Y(thiefPos) + 0.4, 5, 2);
            const pose = s.phase === "won" ? "caught" : s.phase === "run" ? "run" : "stand";
            const flip = thiefPos.dir.gx - thiefPos.dir.gy < -0.1;
            drawThief(c, X(thiefPos), Y(thiefPos), t, pose, flip, tod);
            c.globalAlpha = 1;
          }
        });
      }
      ents.push({
        g: pol,
        done: false,
        draw: (alpha) => {
          c.globalAlpha = alpha;
          drawCar(c, X(pol), Y(pol), dir, "#f4f3ee", "police", flash, tod === "night" ? "dusk" : tod);
          c.globalAlpha = 1;
        }
      });
      ents.sort((a, b) => a.g.gx + a.g.gy - (b.g.gx + b.g.gy));
      const inFront = (th, e) => th.mx > e.g.gx + 0.05 && th.my > e.g.gy + 0.05;
      const hidden = /* @__PURE__ */ new Set();
      for (const th of city.things) {
        if (th.x > cx + w || th.y > cy + h || th.x + th.w < cx || th.y + th.h < cy) continue;
        for (const e of ents) {
          if (!e.done && inFront(th, e)) {
            e.draw(1);
            e.done = true;
          }
        }
        th.draw(c, Z);
        if (th.sil) {
          for (const e of ents) if (e.done && inside(th.sil, X(e.g), Y(e.g) - 8)) hidden.add(e);
        }
      }
      for (const e of ents) if (!e.done) e.draw(1);
      for (const e of ents) e.draw(hidden.has(e) ? 0.45 : 0.28);
      for (const e of hidden) this.marker(c, X(e.g), Y(e.g) - (e.g === thiefPos ? 31 : 16), t, e.g === thiefPos ? "#ff4d40" : "#3f7cff");
      if (s.phase === "won" && !gone) this.stars(c, X(thiefPos), Y(thiefPos) - 30, t);
      const back = { gx: pol.gx - dir.gx * 0.75, gy: pol.gy - dir.gy * 0.75 };
      const moving = Math.abs(target - this.policeS) > 0.02 && s.phase === "run";
      if (t < this.boostUntil && s.phase === "run") {
        for (let n = 0; n < 2; n++) {
          const bx = city.sx(back);
          const by = city.sy(back) - 3;
          const vx = -(dir.gx - dir.gy) * 22;
          const vy = -(dir.gx + dir.gy) * 11;
          this.sparks.push({ x: bx + (Math.random() - 0.5) * 3, y: by + (Math.random() - 0.5) * 2, vx: vx + (Math.random() - 0.5) * 8, vy: vy + (Math.random() - 0.5) * 6, t: 0, kind: "flame" });
        }
      } else if (moving && Math.random() < dt * 12) {
        this.sparks.push({ x: city.sx(back), y: city.sy(back), vx: 0, vy: -3, t: 0, kind: "dust" });
      }
      if (s.phase === "run" && !gone && Math.random() < dt * 8) {
        this.sparks.push({ x: city.sx(thiefPos) - 3, y: city.sy(thiefPos), vx: 0, vy: -2, t: 0, kind: "dust" });
      }
      for (const p of this.sparks) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "dust") {
          const a = Math.max(0, 0.32 - p.t * 0.38);
          c.fillStyle = `rgba(228,220,204,${a.toFixed(2)})`;
          c.beginPath();
          c.arc(p.x, p.y - p.t * 3, 1.2 + p.t * 3.2, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.save();
      c.globalCompositeOperation = "lighter";
      for (const p of this.sparks) {
        if (p.kind !== "flame" || p.t >= 0.32) continue;
        const r = 2.6 - p.t * 5;
        const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, p.t < 0.1 ? "rgba(255,250,220,.95)" : "rgba(255,200,90,.85)");
        gr.addColorStop(0.5, "rgba(255,120,50,.55)");
        gr.addColorStop(1, "rgba(255,60,30,0)");
        c.fillStyle = gr;
        c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
      c.restore();
      this.sparks = this.sparks.filter((p) => p.t < (p.kind === "flame" ? 0.32 : 0.85));
      this.glows(c, pol, dir, flash);
      c.setTransform(Z, 0, 0, Z, 0, 0);
      if (tod === "dusk") {
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "rgba(255,150,90,.14)");
        gr.addColorStop(1, "rgba(120,60,120,.06)");
        c.fillStyle = gr;
        c.fillRect(0, 0, w, h);
      }
      const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(8,10,24,.22)");
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);
      this.minimap(c, s, pol, thiefPos, gone, cx, cy);
      if (!gone) this.arrow(c, X(thiefPos) - cx, Y(thiefPos) - cy - 12);
    }
    /** 被挡住时头顶的倒三角，一上一下地跳 */
    marker(c, x, y, t, col) {
      const by = y + Math.sin(t / 180) * 1.2;
      c.save();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(x - 3.6, by - 3.4);
      c.lineTo(x + 3.6, by - 3.4);
      c.lineTo(x, by + 2.2);
      c.closePath();
      c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x - 2.5, by - 2.7);
      c.lineTo(x + 2.5, by - 2.7);
      c.lineTo(x, by + 1.1);
      c.closePath();
      c.fill();
      c.restore();
    }
    stars(c, x, y, t) {
      c.fillStyle = "#ffd75e";
      for (let i = 0; i < 3; i++) {
        const a = t / 260 + i * Math.PI * 2 / 3;
        const sx = x + Math.cos(a) * 7;
        const sy = y + Math.sin(a) * 2.5;
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 0.7 : 1.8;
          const an = k * Math.PI / 5 - Math.PI / 2;
          c.lineTo(sx + Math.cos(an) * r, sy + Math.sin(an) * r);
        }
        c.closePath();
        c.fill();
      }
    }
    /** 夜里、傍晚：盖一层暗色，路灯和车灯的地方挖出亮光（只压在地面上，楼的灯窗还是亮的） */
    darkGround(c, cv, cx, cy) {
      const tod = this.city.tod;
      const Z = this.Z;
      if (!this.light || this.light.width !== cv.width || this.light.height !== cv.height) {
        this.light = document.createElement("canvas");
        this.light.width = cv.width;
        this.light.height = cv.height;
      }
      const l = this.light.getContext("2d");
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = "source-over";
      l.clearRect(0, 0, cv.width, cv.height);
      l.fillStyle = tod === "night" ? "rgba(6,10,30,.42)" : "rgba(50,25,55,.16)";
      l.fillRect(0, 0, cv.width, cv.height);
      l.setTransform(Z, 0, 0, Z, -cx * Z, -cy * Z);
      l.globalCompositeOperation = "destination-out";
      const hole = (x, y, rx, ry, a) => {
        l.save();
        l.translate(x, y);
        l.scale(1, ry / rx);
        const g = l.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(0.6, `rgba(0,0,0,${a * 0.5})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        l.fillStyle = g;
        l.fillRect(-rx, -rx, rx * 2, rx * 2);
        l.restore();
      };
      const city = this.city;
      for (const p of city.lamps) {
        const x = city.sx(p) + 4;
        const y = city.sy(p) + 2;
        if (x < cx - 60 || y < cy - 60 || x > cx + this.w + 60 || y > cy + this.h + 60) continue;
        hole(x, y, 36, 18, 0.9);
      }
      const pol = city.at(this.policeS);
      const d = this.carDir;
      const ahead = { gx: pol.gx + d.gx * 1.9, gy: pol.gy + d.gy * 1.9 };
      hole(city.sx(ahead), city.sy(ahead), 32, 16, 0.95);
      hole(city.sx(pol), city.sy(pol), 18, 10, 0.8);
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.light, 0, 0);
      c.restore();
    }
    /** 发光的东西：警灯的红蓝光、夜里的路灯和车灯 */
    glows(c, pol, dir, flash) {
      const city = this.city;
      const tod = city.tod;
      const X = city.sx(pol);
      const Y = city.sy(pol);
      c.save();
      c.globalCompositeOperation = "lighter";
      const glow = (x, y, r, col) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      };
      if (flash >= 0) {
        const a = tod === "day" ? 0.22 : 0.42;
        glow(X, Y - 9, tod === "day" ? 16 : 30, flash ? `rgba(60,130,255,${a})` : `rgba(255,60,50,${a})`);
      }
      if (tod !== "day") {
        const hx = X + (dir.gx - dir.gy) * 16 * 1.4;
        const hy = Y + (dir.gx + dir.gy) * 8 * 1.4 - 2;
        glow(hx, hy, 14, "rgba(255,240,200,.16)");
      }
      c.restore();
    }
    /** 右上角的小地图：整条路线、警车、小偷、仓库 */
    minimap(c, s, pol, th, gone, cx, cy) {
      const city = this.city;
      const pts = city.path.map((g) => [city.sx(g), city.sy(g)]);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const spanX = Math.max(...xs) - minX || 1;
      const spanY = Math.max(...ys) - minY || 1;
      const mw = Math.min(100, Math.round(this.w * 0.2));
      const k = mw / spanX;
      const mh = Math.max(14, Math.round(spanY * k));
      const ox = this.w - mw - 9;
      const oy = 8;
      const pad = 5;
      c.fillStyle = "rgba(16,18,30,.62)";
      c.beginPath();
      c.roundRect(ox - pad, oy - pad, mw + pad * 2, mh + pad * 2, 4);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,.12)";
      c.lineWidth = 0.5;
      c.stroke();
      const M = (x, y) => [ox + (x - minX) * k, oy + (y - minY) * k];
      c.strokeStyle = "rgba(255,255,255,.25)";
      c.lineWidth = 0.5;
      const [vx, vy] = M(cx, cy);
      c.strokeRect(vx, vy, this.w * k, this.h * k);
      c.strokeStyle = "rgba(255,255,255,.55)";
      c.lineWidth = 1;
      c.lineJoin = "round";
      c.beginPath();
      pts.forEach(([x, y], i) => i ? c.lineTo(...M(x, y)) : c.moveTo(...M(x, y)));
      c.stroke();
      const dot = (g, r, col, ring) => {
        const [x, y] = M(city.sx(g), city.sy(g));
        if (ring) {
          c.fillStyle = ring;
          c.beginPath();
          c.arc(x, y, r + 0.8, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = col;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      };
      const [hx, hy] = M(city.sx(city.hideout), city.sy(city.hideout));
      c.fillStyle = "#e8b931";
      c.fillRect(hx - 2.2, hy - 2.2, 4.4, 4.4);
      if (!gone && s.phase !== "lost") dot(th, 1.7, "#ff5a4e", "rgba(255,255,255,.85)");
      dot(pol, 2, "#3f7cff", "#ffffff");
    }
    /** 小偷跑出画面时，画面边上一个指向他的箭头 */
    arrow(c, x, y) {
      const w = this.w;
      const h = this.h;
      if (x >= 4 && y >= 4 && x <= w - 4 && y <= h - 4) return;
      const ax = Math.max(12, Math.min(w - 12, x));
      const ay = Math.max(12, Math.min(h - 12, y));
      const a = Math.atan2(y - ay, x - ax);
      c.save();
      c.translate(ax, ay);
      c.fillStyle = "rgba(16,18,30,.72)";
      c.beginPath();
      c.arc(0, 0, 8.5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,.2)";
      c.lineWidth = 0.6;
      c.stroke();
      c.rotate(a);
      c.fillStyle = "#ff5a4e";
      c.beginPath();
      c.moveTo(5, 0);
      c.lineTo(-3, -4);
      c.lineTo(-1.5, 0);
      c.lineTo(-3, 4);
      c.closePath();
      c.fill();
      c.restore();
    }
  };
  function inside(pts, x, y) {
    let n = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) n = !n;
    }
    return n;
  }

  // src/games/chase/iso.ts
  var ROAD = 2;
  var BLOCK = 8;
  var PITCH = ROAD + BLOCK;
  var MAX_H = 64;
  var CAR_COLORS = ["#c94a3f", "#3f6fc9", "#e8e4dc", "#3a3d47", "#6d8b5a", "#8a5ab0", "#e08a3c", "#9aa5b1"];
  var IsoCity = class {
    constructor(seed, wantCells, tod) {
      this.things = [];
      this.lamps = [];
      this.cum = [];
      this.blocks = [];
      this.blds = [];
      this.treeAt = [];
      this.grain = null;
      this.grainS = 0;
      /** 画好的楼（太多了就把很久没用的扔掉） */
      this.sprites = /* @__PURE__ */ new Map();
      this.frame = 0;
      this.tod = tod;
      this.rand = rng(seed);
      const R = this.rand;
      const steps = Math.max(6, Math.ceil(wantCells / PITCH));
      let i = 0;
      let j = 0;
      const nodes = [[0, 0]];
      let last = R() < 0.5 ? "x" : "y";
      let run = 0;
      for (let k = 0; k < steps; k++) {
        const turn = run >= 2 || run >= 1 && R() < 0.55;
        const d = turn ? last === "x" ? "y" : "x" : last;
        if (d === last) run++;
        else run = 1;
        last = d;
        if (d === "x") i++;
        else j++;
        nodes.push([i, j]);
      }
      if (last === "x") {
        j++;
        nodes.push([i, j]);
      }
      const J = j;
      const margin = 1;
      this.gw = (i + 2 * margin + 1) * PITCH + ROAD;
      this.gh = (J + 2 * margin + 1) * PITCH + ROAD;
      const node = (a, b) => ({ gx: (a + margin) * PITCH + ROAD / 2, gy: (J - b + margin) * PITCH + ROAD / 2 });
      const pts = nodes.map(([a, b]) => node(a, b));
      const d0 = dirOf(pts[0], pts[1]);
      pts.unshift({ gx: pts[0].gx - d0.gx * 3, gy: pts[0].gy - d0.gy * 3 });
      const dn = dirOf(pts[pts.length - 2], pts[pts.length - 1]);
      const end = { gx: pts[pts.length - 1].gx + dn.gx * 3.2, gy: pts[pts.length - 1].gy + dn.gy * 3.2 };
      pts.push(end);
      this.hideout = end;
      this.house = { gx: end.gx - 2.6, gy: end.gy - 5.4, w: 5.2, d: 5.2 };
      this.path = roundCorners(pts, 0.8);
      let s = 0;
      this.cum.push(0);
      for (let k = 1; k < this.path.length; k++) {
        s += Math.hypot(this.path[k].gx - this.path[k - 1].gx, this.path[k].gy - this.path[k - 1].gy);
        this.cum.push(s);
      }
      this.length = s;
      this.ox = this.gh * (TW / 2);
      this.oy = MAX_H + 30;
      this.width = (this.gw + this.gh) * (TW / 2);
      this.height = (this.gw + this.gh) * (TH / 2) + this.oy + 10;
      this.layout();
    }
    /** 格子坐标 → 大地图上的像素 */
    sx(g) {
      return (g.gx - g.gy) * (TW / 2) + this.ox;
    }
    sy(g) {
      return (g.gx + g.gy) * (TH / 2) + this.oy;
    }
    X(gx, gy, up = 0) {
      return [ix(gx, gy) + this.ox, iy(gx, gy) + this.oy - up];
    }
    /** 路线上离起点 s 格的那一点和方向 */
    at(s) {
      const p = this.path;
      const c = this.cum;
      s = Math.max(0, Math.min(this.length, s));
      let lo = 0;
      let hi = c.length - 1;
      while (hi - lo > 1) {
        const mid = lo + hi >> 1;
        if (c[mid] <= s) lo = mid;
        else hi = mid;
      }
      const seg = c[hi] - c[lo] || 1;
      const t = (s - c[lo]) / seg;
      const dx = p[hi].gx - p[lo].gx;
      const dy = p[hi].gy - p[lo].gy;
      const len = Math.hypot(dx, dy) || 1;
      return { gx: p[lo].gx + dx * t, gy: p[lo].gy + dy * t, dir: { gx: dx / len, gy: dy / len } };
    }
    // ---------------- 摆东西 ----------------
    layout() {
      const R = this.rand;
      const hs = this.house;
      const nearHouse2 = (gx, gy, w, d) => gx < hs.gx + hs.w + 1 && gx + w > hs.gx - 1 && gy < hs.gy + hs.d + 1 && gy + d > hs.gy - 1;
      for (let bx = 0; bx * PITCH + ROAD < this.gw; bx++) {
        for (let by = 0; by * PITCH + ROAD < this.gh; by++) {
          const x0 = bx * PITCH + ROAD;
          const y0 = by * PITCH + ROAD;
          if (x0 + 7 > this.gw || y0 + 7 > this.gh) continue;
          const blk = { x0, y0, kind: "build", seed: Math.floor(R() * 1e9) };
          if (nearHouse2(x0, y0, 8, 8)) blk.kind = "plaza";
          else {
            const r = R();
            if (r < 0.16) blk.kind = "park";
            else if (r < 0.24) blk.kind = "parking";
          }
          this.blocks.push(blk);
          if (blk.kind === "build") this.buildings(x0 + 1, y0 + 1);
          else if (blk.kind === "park") this.park(x0 + 1, y0 + 1);
          else if (blk.kind === "parking") this.parking(x0 + 1, y0 + 1);
        }
      }
      for (let bx = 0; bx * PITCH < this.gw; bx++) {
        for (let by = 0; by * PITCH < this.gh; by++) {
          const x0 = bx * PITCH;
          const y0 = by * PITCH;
          const lamp = { gx: x0 + ROAD + 0.35, gy: y0 + ROAD + 0.35 };
          this.lamps.push(lamp);
          if (!nearHouse2(lamp.gx, lamp.gy, 0, 0)) this.addLamp(lamp);
          for (let t = ROAD + 1.5; t < PITCH - 1; t += 2.5 + R() * 2) {
            if (R() < 0.3) this.parked({ gx: x0 + t, gy: y0 + (R() < 0.5 ? 0.42 : 1.58) }, { gx: R() < 0.5 ? 1 : -1, gy: 0 });
            if (R() < 0.3) this.parked({ gx: x0 + (R() < 0.5 ? 0.42 : 1.58), gy: y0 + t }, { gx: 0, gy: R() < 0.5 ? 1 : -1 });
            if (R() < 0.35) this.tree({ gx: x0 + t, gy: y0 + ROAD + 0.5 }, 0.8, true);
            if (R() < 0.35) this.tree({ gx: x0 + ROAD + 0.5, gy: y0 + t }, 0.8, true);
            if (R() < 0.08) this.hydrant({ gx: x0 + t + 0.6, gy: y0 + ROAD + 0.3 });
          }
        }
      }
      const onRoute = (g) => this.path.some((p) => Math.abs(p.gx - g.gx) < 1.1 && Math.abs(p.gy - g.gy) < 1.1);
      for (let k = this.things.length - 1; k >= 0; k--) {
        const t = this.things[k];
        if (t.g && (t.car && onRoute(t.g) || nearHouse2(t.g.gx, t.g.gy, 0, 0))) this.things.splice(k, 1);
      }
      for (let k = this.treeAt.length - 1; k >= 0; k--) if (nearHouse2(this.treeAt[k].g.gx, this.treeAt[k].g.gy, 0, 0)) this.treeAt.splice(k, 1);
      this.addBld({ x: hs.gx, y: hs.gy, w: hs.w, d: hs.d, h: 36, style: "warehouse", wall: "#6c6377", seed: Math.floor(R() * 1e9), door: { gx: this.hideout.gx, gy: hs.gy + hs.d } });
      this.things.sort((a, b) => a.depth - b.depth);
    }
    /** 一块地（6 × 6 格）切成 1–4 栋楼 */
    buildings(x0, y0) {
      const R = this.rand;
      const lots = [];
      const s = R();
      if (s < 0.2) lots.push([x0 + 0.3, y0 + 0.3, 5.4, 5.4]);
      else if (s < 0.55) {
        lots.push([x0 + 0.3, y0 + 0.3, 2.6, 5.4], [x0 + 3.1, y0 + 0.3, 2.6, 5.4]);
      } else if (s < 0.75) {
        lots.push([x0 + 0.3, y0 + 0.3, 5.4, 2.6], [x0 + 0.3, y0 + 3.1, 5.4, 2.6]);
      } else {
        lots.push([x0 + 0.3, y0 + 0.3, 2.6, 2.6], [x0 + 3.1, y0 + 0.3, 2.6, 2.6], [x0 + 0.3, y0 + 3.1, 2.6, 2.6], [x0 + 3.1, y0 + 3.1, 2.6, 2.6]);
      }
      for (const [x, y, w, d] of lots) {
        const big = w * d > 10;
        const r = R();
        const style = big ? r < 0.4 ? "office" : r < 0.7 ? "apt" : "brick" : r < 0.4 ? "shop" : r < 0.75 ? "apt" : "brick";
        let h = (big ? 24 : 18) + R() * (big ? 32 : 22);
        if (style === "office") h += 8;
        if (style === "shop") h = Math.min(h, 30);
        const wall = style === "brick" ? BRICKS[Math.floor(R() * BRICKS.length)] : style === "office" ? GLASS2[Math.floor(R() * GLASS2.length)] : WALLS[Math.floor(R() * WALLS.length)];
        this.addBld({ x, y, w, d, h: Math.round(Math.min(MAX_H, h)), style, wall, seed: Math.floor(R() * 1e9) });
      }
    }
    addBld(b) {
      this.blds.push(b);
      const bb = bldBounds(b);
      const x = bb.x + this.ox;
      const y = bb.y + this.oy;
      this.things.push({
        x,
        y,
        w: bb.w,
        h: bb.h,
        depth: b.x + b.w + b.y + b.d,
        mx: b.x + b.w,
        my: b.y + b.d,
        sil: [this.X(b.x, b.y, b.h), this.X(b.x + b.w, b.y, b.h), this.X(b.x + b.w, b.y), this.X(b.x + b.w, b.y + b.d), this.X(b.x, b.y + b.d), this.X(b.x, b.y + b.d, b.h)],
        draw: (c, S) => {
          let sp = this.sprites.get(b);
          if (!sp || sp.S !== S) {
            sp = { img: renderBuilding(b, this.tod, S), S, used: 0 };
            this.sprites.set(b, sp);
            this.evict();
          }
          sp.used = this.frame;
          c.drawImage(sp.img, x, y, sp.img.width / S, sp.img.height / S);
        }
      });
    }
    /** 每画一帧调用一次：记下哪些楼最近用过 */
    tick() {
      this.frame++;
    }
    evict() {
      if (this.sprites.size <= 48) return;
      const list = [...this.sprites.entries()].sort((a, b) => a[1].used - b[1].used);
      for (const [k] of list.slice(0, this.sprites.size - 40)) this.sprites.delete(k);
    }
    park(x0, y0) {
      for (const [a, b] of [[0.9, 0.9], [4.7, 1.2], [1.2, 4.6], [4.6, 4.5], [1, 2.2], [4.3, 3.4]]) if (this.rand() < 0.85) this.tree({ gx: x0 + a, gy: y0 + b }, 1.1, false);
    }
    parking(x0, y0) {
      for (let k = 0; k < 5; k++) {
        if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 0.95 }, { gx: 0, gy: -1 });
        if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 5.05 }, { gx: 0, gy: 1 });
      }
    }
    // ---------------- 树、车、路灯 ----------------
    tree(g, size, grate) {
      const R = this.rand;
      const kind = R() < 0.22 ? 1 : 0;
      const tint = R();
      const [x, y] = this.X(g.gx, g.gy);
      this.treeAt.push({ g, size, grate });
      this.things.push({
        x: x - 10 * size,
        y: y - 26 * size,
        w: 20 * size,
        h: 28 * size,
        depth: g.gx + g.gy,
        mx: g.gx,
        my: g.gy,
        g,
        draw: (c) => drawTree2(c, x, y, size, kind, this.tod, tint)
      });
    }
    parked(g, dir) {
      const R = this.rand;
      const color = CAR_COLORS[Math.floor(R() * CAR_COLORS.length)];
      const kind = R() < 0.14 ? "taxi" : "car";
      const [x, y] = this.X(g.gx, g.gy);
      this.things.push({
        x: x - 14,
        y: y - 14,
        w: 28,
        h: 20,
        depth: g.gx + g.gy,
        mx: g.gx,
        my: g.gy,
        g,
        car: true,
        draw: (c) => drawCar(c, x, y, dir, kind === "taxi" ? "#f0c53c" : color, kind, null, this.tod)
      });
    }
    addLamp(g) {
      const [x, y] = this.X(g.gx, g.gy);
      this.things.push({ x: x - 14, y: y - 30, w: 36, h: 48, depth: g.gx + g.gy, mx: g.gx, my: g.gy, g, draw: (c) => drawLamp(c, x, y, this.tod, true) });
    }
    hydrant(g) {
      const [x, y] = this.X(g.gx, g.gy);
      this.things.push({ x: x - 3, y: y - 6, w: 6, h: 7, depth: g.gx + g.gy, mx: g.gx, my: g.gy, g, draw: (c) => drawHydrant(c, x, y, this.tod) });
    }
    // ---------------- 地面 ----------------
    quad(c, gx, gy, w, d, fill, up = 0) {
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(...this.X(gx, gy, up));
      c.lineTo(...this.X(gx + w, gy, up));
      c.lineTo(...this.X(gx + w, gy + d, up));
      c.lineTo(...this.X(gx, gy + d, up));
      c.closePath();
      c.fill();
    }
    /** 沥青上细细的颗粒（和屏幕像素一样大），跟着地图走 */
    grainOf(c, S) {
      if (this.grain && this.grainS === S) return this.grain;
      const n = 96;
      const cv = document.createElement("canvas");
      cv.width = n;
      cv.height = n;
      const g = cv.getContext("2d");
      const R = rng(91);
      for (let k = 0; k < 900; k++) {
        g.fillStyle = R() < 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.08)";
        g.fillRect(Math.floor(R() * n), Math.floor(R() * n), 1, 1);
      }
      this.grain = c.createPattern(cv, "repeat");
      this.grainS = S;
      if (this.grain) this.grain.setTransform(new DOMMatrix().scale(1 / S));
      return this.grain;
    }
    /** 画 (vx, vy) 起 vw × vh 这一块地面（大地图上的像素），S 是放大倍数 */
    drawGround(c, vx, vy, vw, vh, S) {
      const tod = this.tod;
      const gd = (h) => grade(h, tod);
      c.fillStyle = gd(BASE.asphalt);
      c.fillRect(vx, vy, vw, vh);
      const grain = this.grainOf(c, S);
      if (grain) {
        c.fillStyle = grain;
        c.fillRect(vx, vy, vw, vh);
      }
      const toG = (px, py) => {
        const a = (px - this.ox) / (TW / 2);
        const b = (py - this.oy) / (TH / 2);
        return { gx: (a + b) / 2, gy: (b - a) / 2 };
      };
      const cs = [toG(vx, vy), toG(vx + vw, vy), toG(vx, vy + vh + MAX_H), toG(vx + vw, vy + vh + MAX_H)];
      const gx0 = Math.min(...cs.map((p) => p.gx)) - PITCH;
      const gx1 = Math.max(...cs.map((p) => p.gx)) + PITCH;
      const gy0 = Math.min(...cs.map((p) => p.gy)) - PITCH;
      const gy1 = Math.max(...cs.map((p) => p.gy)) + PITCH;
      const inView = (gx, gy, w, d) => gx + w > gx0 && gx < gx1 && gy + d > gy0 && gy < gy1;
      c.strokeStyle = "rgba(0,0,0,.16)";
      c.lineWidth = 1.4;
      c.beginPath();
      for (const b of this.blocks) {
        if (!inView(b.x0 - 1, b.y0 - 1, BLOCK + 2, BLOCK + 2)) continue;
        const e = 0.12;
        c.moveTo(...this.X(b.x0 - e, b.y0 - e));
        c.lineTo(...this.X(b.x0 + BLOCK + e, b.y0 - e));
        c.lineTo(...this.X(b.x0 + BLOCK + e, b.y0 + BLOCK + e));
        c.lineTo(...this.X(b.x0 - e, b.y0 + BLOCK + e));
        c.closePath();
      }
      c.stroke();
      this.markings(c, gx0, gx1, gy0, gy1);
      for (const b of this.blocks) {
        if (!inView(b.x0, b.y0, BLOCK, BLOCK)) continue;
        this.quad(c, b.x0, b.y0, BLOCK, BLOCK, gd(BASE.curb));
        this.quad(c, b.x0, b.y0, BLOCK, BLOCK, gd(BASE.walk), 1.3);
        c.strokeStyle = "rgba(80,66,50,.14)";
        c.lineWidth = 0.3;
        c.beginPath();
        for (let k = 0.5; k < BLOCK; k += 0.5) {
          for (const [a, b2] of [[b.y0, b.y0 + 1], [b.y0 + BLOCK - 1, b.y0 + BLOCK]]) {
            c.moveTo(...this.X(b.x0 + k, a, 1.3));
            c.lineTo(...this.X(b.x0 + k, b2, 1.3));
          }
          for (const [a, b2] of [[b.x0, b.x0 + 1], [b.x0 + BLOCK - 1, b.x0 + BLOCK]]) {
            c.moveTo(...this.X(a, b.y0 + k, 1.3));
            c.lineTo(...this.X(b2, b.y0 + k, 1.3));
          }
        }
        c.stroke();
        c.strokeStyle = rgba("#ffffff", tod === "night" ? 0.08 : 0.35);
        c.lineWidth = 0.35;
        c.beginPath();
        c.moveTo(...this.X(b.x0, b.y0 + BLOCK, 1.3));
        c.lineTo(...this.X(b.x0 + BLOCK, b.y0 + BLOCK, 1.3));
        c.lineTo(...this.X(b.x0 + BLOCK, b.y0, 1.3));
        c.stroke();
        const x0 = b.x0 + 1;
        const y0 = b.y0 + 1;
        if (b.kind === "park") this.parkGround(c, x0, y0, b.seed);
        else if (b.kind === "parking") this.parkingGround(c, x0, y0);
        else if (b.kind === "plaza") this.plazaGround(c, b.x0, b.y0);
        else this.quad(c, x0, y0, BLOCK - 2, BLOCK - 2, gd(BASE.lot), 1.3);
      }
      for (const t of this.treeAt) {
        if (!t.grate || !inView(t.g.gx, t.g.gy, 0, 0)) continue;
        this.quad(c, t.g.gx - 0.32, t.g.gy - 0.32, 0.64, 0.64, gd("#8a7c68"), 1.3);
        this.quad(c, t.g.gx - 0.24, t.g.gy - 0.24, 0.48, 0.48, gd("#5e4a36"), 1.3);
      }
      this.shadows(c, inView);
    }
    markings(c, gx0, gx1, gy0, gy1) {
      const tod = this.tod;
      const bx0 = Math.max(0, Math.floor(gx0 / PITCH));
      const bx1 = Math.ceil(gx1 / PITCH);
      const by0 = Math.max(0, Math.floor(gy0 / PITCH));
      const by1 = Math.ceil(gy1 / PITCH);
      c.strokeStyle = grade(BASE.lane, tod);
      c.lineWidth = 0.9;
      c.setLineDash([5.5, 5]);
      c.beginPath();
      for (let bx = bx0; bx <= bx1; bx++) {
        for (let by = by0; by <= by1; by++) {
          const x0 = bx * PITCH;
          const y0 = by * PITCH;
          if (x0 + PITCH <= this.gw) {
            c.moveTo(...this.X(x0 + ROAD + 0.9, y0 + 1));
            c.lineTo(...this.X(x0 + PITCH - 0.9, y0 + 1));
          }
          if (y0 + PITCH <= this.gh) {
            c.moveTo(...this.X(x0 + 1, y0 + ROAD + 0.9));
            c.lineTo(...this.X(x0 + 1, y0 + PITCH - 0.9));
          }
        }
      }
      c.stroke();
      c.setLineDash([]);
      const zebra = grade(BASE.marking, tod);
      c.fillStyle = tod === "night" ? rgba(zebra, 0.7) : rgba(zebra, 0.88);
      const bar = (ax, ay, bxx, byy, w) => {
        const dx = bxx - ax;
        const dy = byy - ay;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * (w / 2);
        const ny = dx / len * (w / 2);
        c.moveTo(...this.X(ax + nx, ay + ny));
        c.lineTo(...this.X(bxx + nx, byy + ny));
        c.lineTo(...this.X(bxx - nx, byy - ny));
        c.lineTo(...this.X(ax - nx, ay - ny));
        c.closePath();
      };
      c.beginPath();
      for (let bx = bx0; bx <= bx1; bx++) {
        for (let by = by0; by <= by1; by++) {
          const x0 = bx * PITCH;
          const y0 = by * PITCH;
          for (let k = 0; k < 6; k++) {
            const u = 0.2 + k * 0.32;
            if (x0 + ROAD + 1 < this.gw) bar(x0 + ROAD + 0.18, y0 + u, x0 + ROAD + 0.82, y0 + u, 0.17);
            if (x0 > 0) bar(x0 - 0.82, y0 + u, x0 - 0.18, y0 + u, 0.17);
            if (y0 + ROAD + 1 < this.gh) bar(x0 + u, y0 + ROAD + 0.18, x0 + u, y0 + ROAD + 0.82, 0.17);
            if (y0 > 0) bar(x0 + u, y0 - 0.82, x0 + u, y0 - 0.18, 0.17);
          }
        }
      }
      c.fill();
      for (let bx = bx0; bx <= bx1; bx++) {
        for (let by = by0; by <= by1; by++) {
          const [mx, my] = this.X(bx * PITCH + 5.6, by * PITCH + 0.55);
          c.fillStyle = "rgba(0,0,0,.25)";
          c.beginPath();
          c.ellipse(mx, my, 3, 1.5, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = "rgba(255,255,255,.1)";
          c.lineWidth = 0.3;
          c.beginPath();
          c.ellipse(mx, my, 2.2, 1.1, 0, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }
    parkGround(c, x0, y0, seed) {
      const gd = (h) => grade(h, this.tod);
      const R = rng(seed);
      this.quad(c, x0, y0, 6, 6, gd(BASE.grass), 1.3);
      for (let k = 0; k < 6; k += 1) this.quad(c, x0 + k, y0, 0.5, 6, gd(BASE.grassStripe), 1.3);
      this.quad(c, x0 + 2.65, y0, 0.7, 6, gd(BASE.path), 1.3);
      this.quad(c, x0, y0 + 2.65, 6, 0.7, gd(BASE.path), 1.3);
      const [cx, cy] = this.X(x0 + 3, y0 + 3, 1.3);
      const ell = (rx, ry, fill) => {
        c.fillStyle = fill;
        c.beginPath();
        c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      };
      ell(24, 12, gd("#c9c0b0"));
      ell(21.5, 10.6, gd("#8e8576"));
      const wg = c.createLinearGradient(cx, cy - 10, cx, cy + 10);
      wg.addColorStop(0, gd("#4f93c6"));
      wg.addColorStop(1, gd(BASE.water));
      ell(20.5, 9.8, wg);
      c.strokeStyle = rgba("#ffffff", this.tod === "night" ? 0.15 : 0.45);
      c.lineWidth = 0.5;
      for (const [dx, dy, r] of [[-6, -2, 4], [5, 3, 3]]) {
        c.beginPath();
        c.ellipse(cx + dx, cy + dy, r, r / 2, 0, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
      const cols = ["#f2a7b8", "#f6d35b", "#ffffff", "#b99ae6", "#ef7f6f"];
      for (const [a, b] of [[0.5, 4.9], [5.2, 0.7], [5, 5.1]]) {
        const col = gd(cols[Math.floor(R() * cols.length)]);
        for (let k = 0; k < 9; k++) {
          const [fx, fy] = this.X(x0 + a + (R() - 0.5) * 0.7, y0 + b + (R() - 0.5) * 0.7, 1.3);
          c.fillStyle = gd("#4f8f45");
          c.beginPath();
          c.arc(fx, fy + 0.4, 1, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = col;
          c.beginPath();
          c.arc(fx, fy - 0.2, 0.7, 0, Math.PI * 2);
          c.fill();
        }
      }
      for (const [a, b] of [[1.6, 2.35], [3.6, 3.75]]) {
        const [bx, by] = this.X(x0 + a, y0 + b, 1.3);
        c.fillStyle = "rgba(10,12,22,.22)";
        c.fillRect(bx - 4, by, 8, 1.2);
        c.fillStyle = gd("#8a5a3a");
        c.fillRect(bx - 4, by - 2.4, 8, 1.4);
        c.fillStyle = gd("#a86f48");
        c.fillRect(bx - 4, by - 4.6, 8, 1.2);
      }
    }
    parkingGround(c, x0, y0) {
      const gd = (h) => grade(h, this.tod);
      this.quad(c, x0, y0, 6, 6, gd(shade(BASE.asphalt, 0.08)), 1.3);
      c.strokeStyle = gd(BASE.marking);
      c.lineWidth = 0.45;
      c.beginPath();
      for (let k = 0; k <= 6; k++) {
        for (const [a, b] of [[y0 + 0.15, y0 + 1.75], [y0 + 4.25, y0 + 5.85]]) {
          c.moveTo(...this.X(x0 + k + 0.5, a, 1.3));
          c.lineTo(...this.X(x0 + k + 0.5, b, 1.3));
        }
      }
      c.stroke();
    }
    plazaGround(c, x0, y0) {
      const gd = (h) => grade(h, this.tod);
      this.quad(c, x0, y0, BLOCK, BLOCK, gd("#b9b3a8"), 1.3);
      c.strokeStyle = "rgba(0,0,0,.08)";
      c.lineWidth = 0.3;
      c.beginPath();
      for (let k = 1; k < BLOCK; k++) {
        c.moveTo(...this.X(x0 + k, y0, 1.3));
        c.lineTo(...this.X(x0 + k, y0 + BLOCK, 1.3));
        c.moveTo(...this.X(x0, y0 + k, 1.3));
        c.lineTo(...this.X(x0 + BLOCK, y0 + k, 1.3));
      }
      c.stroke();
      const hs = this.house;
      const dx = this.hideout.gx;
      const dy = hs.gy + hs.d;
      for (let k = 0; k < 8; k++) {
        c.fillStyle = gd(k % 2 ? "#2b2b30" : "#e8b931");
        c.beginPath();
        const a = dx - 1.2 + k * 0.3;
        c.moveTo(...this.X(a, dy + 0.15, 1.3));
        c.lineTo(...this.X(a + 0.3, dy + 0.15, 1.3));
        c.lineTo(...this.X(a + 0.3, dy + 0.45, 1.3));
        c.lineTo(...this.X(a, dy + 0.45, 1.3));
        c.closePath();
        c.fill();
      }
    }
    /** 楼和树的影子：光从右上来，影子落在左下 */
    shadows(c, inView) {
      const a = this.tod === "night" ? 0.14 : this.tod === "dusk" ? 0.24 : 0.2;
      c.fillStyle = "rgba(16,20,40," + a + ")";
      c.beginPath();
      for (const b of this.blds) {
        if (!inView(b.x - 4, b.y - 1, b.w + 5, b.d + 6)) continue;
        const L = b.h * 0.05;
        const sx = 0.2 * L;
        const sy = L;
        const pts = [
          [b.x, b.y],
          [b.x + b.w, b.y],
          [b.x + b.w + sx, b.y + sy],
          [b.x + b.w + sx, b.y + b.d + sy],
          [b.x + sx, b.y + b.d + sy],
          [b.x, b.y + b.d]
        ];
        pts.forEach(([gx, gy], k) => k ? c.lineTo(...this.X(gx, gy, 1.3)) : c.moveTo(...this.X(gx, gy, 1.3)));
        c.closePath();
      }
      c.fill();
      c.strokeStyle = "rgba(16,20,40,.22)";
      c.lineWidth = 1.2;
      c.beginPath();
      for (const b of this.blds) {
        if (!inView(b.x - 1, b.y - 1, b.w + 2, b.d + 2)) continue;
        c.moveTo(...this.X(b.x, b.y + b.d + 0.04, 1.3));
        c.lineTo(...this.X(b.x + b.w + 0.04, b.y + b.d + 0.04, 1.3));
        c.lineTo(...this.X(b.x + b.w + 0.04, b.y, 1.3));
      }
      c.stroke();
      c.fillStyle = "rgba(16,20,40," + a * 0.9 + ")";
      for (const t of this.treeAt) {
        if (!inView(t.g.gx, t.g.gy, 0, 0)) continue;
        const [x, y] = this.X(t.g.gx + 0.25, t.g.gy + 0.6, 1.3);
        c.beginPath();
        c.ellipse(x, y, 8 * t.size, 3.6 * t.size, -0.35, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  function dirOf(a, b) {
    return { gx: Math.sign(b.gx - a.gx), gy: Math.sign(b.gy - a.gy) };
  }
  function roundCorners(pts, r) {
    const out = [pts[0]];
    for (let k = 1; k < pts.length - 1; k++) {
      const a = pts[k - 1];
      const b = pts[k];
      const n = pts[k + 1];
      const d1 = dirOf(a, b);
      const d2 = dirOf(b, n);
      if (d1.gx === d2.gx && d1.gy === d2.gy) {
        out.push(b);
        continue;
      }
      const p1 = { gx: b.gx - d1.gx * r, gy: b.gy - d1.gy * r };
      const p2 = { gx: b.gx + d2.gx * r, gy: b.gy + d2.gy * r };
      out.push(p1);
      for (let t = 1; t < 6; t++) {
        const u = t / 6;
        out.push({ gx: (1 - u) * (1 - u) * p1.gx + 2 * (1 - u) * u * b.gx + u * u * p2.gx, gy: (1 - u) * (1 - u) * p1.gy + 2 * (1 - u) * u * b.gy + u * u * p2.gy });
      }
      out.push(p2);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // src/games/chase/game.ts
  var LEVELS = [
    { name: "慢", wpm: 20, coins: 10 },
    { name: "中", wpm: 35, coins: 20 },
    { name: "快", wpm: 50, coins: 30 },
    { name: "极速", wpm: 70, coins: 45 }
  ];
  var DAILY_COINS = 150;
  var HEAD = 0.14;
  var COMBO_EVERY = 12;
  var BOOST_CHARS = 4;
  var SKID_CHARS = 1.5;
  var CELLS_PER_CHAR = 0.22;
  var ChaseGame = class {
    constructor(host2) {
      this.route = "setup";
      this.play = null;
      this.preview = null;
      this.tick = 0;
      this.lastStep = 0;
      this.spans = [];
      this.shownPos = -1;
      this.keyHandler = (ev) => this.onKey(ev);
      this.lastOverlay = "";
      this.flashTimer = 0;
      this.host = host2;
      this.scene = new ChaseScene(() => this.sceneState(), new IsoCity(1, 60, timeOfDay()));
      document.addEventListener("keydown", this.keyHandler, true);
    }
    // ---------------- 存档 ----------------
    save() {
      const st = this.host.state();
      if (!st.games) st.games = { chase: { level: 1, book: "", best: {}, history: [], day: 0, coins: 0, seen: [] }, custom: [] };
      const g = st.games;
      if (!g.custom) g.custom = [];
      const c = g.chase;
      const today = this.host.today();
      if (c.day !== today) {
        c.day = today;
        c.coins = 0;
      }
      return c;
    }
    bookId() {
      const c = this.save();
      const ok = (id) => id === CUSTOM_BOOK || this.host.books().some((b) => b.id === id);
      if (c.book && ok(c.book)) return c.book;
      const sb = this.host.studyBook();
      return ok(sb) ? sb : this.host.books()[0]?.id || CUSTOM_BOOK;
    }
    // ---------------- 页面 ----------------
    view() {
      return this.route === "play" && this.play ? this.playHtml() : this.setupHtml();
    }
    after() {
      if (this.route === "play" && this.play) {
        const canvas = document.getElementById("chase-canvas");
        const wrap = document.getElementById("chase-wrap");
        if (canvas && wrap) this.scene.attach(canvas, wrap);
        this.spans = Array.from(document.querySelectorAll("#chase-text span"));
        this.shownPos = -1;
        this.lastOverlay = "";
        this.paintText();
        this.paintHud(performance.now());
        if (this.play.phase === "won" || this.play.phase === "lost") this.paintResult();
        this.startTick();
      } else {
        this.scene.detach();
        this.stopTick();
      }
    }
    /** 离开这个页面（换到别的页面时调用） */
    leave() {
      this.scene.detach();
      this.stopTick();
      if (this.play && (this.play.phase === "run" || this.play.phase === "ready" || this.play.phase === "paused")) this.play = null;
      this.route = "setup";
    }
    setupHtml() {
      const h = this.host;
      const c = this.save();
      const book = this.bookId();
      if (!this.preview || book === CUSTOM_BOOK !== this.preview.key.startsWith("c:") || !this.previewFits(book)) this.preview = pickPassage(h, book, c.seen);
      const opts = h.books().filter((b) => bookPassages(h, b.id).length).map((b) => '<option value="' + h.esc(b.id) + '"' + (b.id === book ? " selected" : "") + ">" + h.esc(b.name) + "</option>");
      opts.push('<option value="' + CUSTOM_BOOK + '"' + (book === CUSTOM_BOOK ? " selected" : "") + ">自定义文章</option>");
      const left = Math.max(0, DAILY_COINS - c.coins);
      const levels = LEVELS.map((L, i) => '<button class="chip' + (i === c.level ? " on" : "") + '" data-game="level" data-i="' + i + '">' + L.name + '<span class="lv-wpm">' + L.wpm + "</span></button>").join("");
      const best = LEVELS.map((L, i) => c.best[i] ? "<span>" + L.name + " <b>" + Math.round(c.best[i]) + "</b></span>" : "").filter(Boolean).join("");
      const pv = this.preview;
      const custom = book === CUSTOM_BOOK ? this.customHtml() : "";
      return '<main class="page games"><p class="label"><button class="link" data-act="nav" data-view="games">← 小游戏</button></p><div class="g-head"><h1 class="h1">打字追击</h1></div><section class="panel chase-setup"><div class="cs-row"><span class="label">词库</span><label class="select"><select id="chase-book" data-game="book">' + opts.join("") + '</select></label></div><div class="cs-row"><span class="label">小偷的速度</span><div class="chips">' + levels + '</div><span class="muted small">词 / 分钟</span></div>' + (pv ? '<div class="cs-preview"><p class="cs-text">' + h.esc(pv.text) + '</p><div class="cs-meta"><span class="muted small">' + h.esc(pv.source) + " · " + (pv.text.match(/\S+/g) || []).length + ' 词</span><button class="link" data-game="shuffle">换一篇</button></div></div>' : '<p class="muted cs-empty">' + (book === CUSTOM_BOOK ? "还没有自定义文章，在下面贴一段英文" : "这个词库还没有文章") + "</p>") + '<div class="actions cs-go"><button class="btn big" data-game="start"' + (pv ? "" : " disabled") + '>开始<kbd>Enter</kbd></button><span class="muted small">抓到小偷 +' + LEVELS[c.level].coins + " 金币 · 今天还能领 " + left + "</span></div>" + (best ? '<div class="cs-best"><span class="label">最快</span>' + best + '<span class="muted small">词 / 分钟</span></div>' : "") + "</section>" + custom + "</main>";
    }
    previewFits(book) {
      const pv = this.preview;
      if (!pv) return false;
      if (book === CUSTOM_BOOK) return customPassages(this.host).some((c) => "c:" + c.id === pv.key);
      return pv.key.startsWith("b:") && bookPassages(this.host, book).includes(+pv.key.slice(2));
    }
    customHtml() {
      const h = this.host;
      const list = customPassages(h);
      return '<section class="panel chase-custom"><h2 class="h2">自定义文章</h2><textarea class="paste" id="chase-paste" rows="5" placeholder="贴一段英文，长文章会按句子切成几段"></textarea><div class="actions"><button class="btn small" data-game="addCustom">保存</button><label class="file-pick link">或者选一个 .txt 文件<input type="file" id="chase-file" accept=".txt,text/plain"></label></div>' + (list.length ? '<ul class="cc-list">' + list.map((c) => '<li><span class="cc-t">' + h.esc(c.title) + '</span><span class="muted small">' + (c.text.match(/\S+/g) || []).length + ' 词</span><button class="link" data-game="delCustom" data-id="' + h.esc(c.id) + '" aria-label="删除">删除</button></li>').join("") + "</ul>" : "") + "</section>";
    }
    playHtml() {
      const h = this.host;
      const p = this.play;
      const L = LEVELS[p.level];
      const chars = Array.from(p.passage.text).map((ch) => "<span>" + (ch === " " ? " " : h.esc(ch)) + "</span>").join("");
      const bookName2 = p.book === CUSTOM_BOOK ? "自定义文章" : h.books().find((b) => b.id === p.book)?.name || "";
      return '<main class="page games play"><div class="cp-top"><div><h1 class="h1">打字追击</h1><p class="muted">' + h.esc(bookName2) + " · 小偷 " + L.name + "（" + L.wpm + ' 词 / 分钟）</p></div><div class="actions"><button class="btn ghost small" data-game="pause">暂停<kbd>Esc</kbd></button><button class="btn ghost small" data-game="quit">不追了</button></div></div><div class="chase-wrap" id="chase-wrap"><canvas id="chase-canvas" class="chase-canvas"></canvas><div class="cp-pop" id="chase-pop"></div><div class="cp-overlay" id="chase-overlay"></div></div><div class="cp-stats"><div><b id="st-wpm">0</b><span>词 / 分钟</span></div><div><b id="st-acc">100%</b><span>正确率</span></div><div><b id="st-combo">0</b><span>连击</span></div><div><b id="st-gap">0</b><span>米 · 离小偷</span></div></div><div class="cp-textbox" id="chase-box"><div class="cp-scroll" id="chase-scroll"><p class="cp-text" id="chase-text">' + chars + '</p></div></div><p class="cp-source muted small">' + h.esc(p.passage.source) + "</p></main>";
    }
    // ---------------- 开局、进行 ----------------
    start(passage) {
      const c = this.save();
      const book = this.bookId();
      const ps = passage || this.preview || pickPassage(this.host, book, c.seen);
      if (!ps) return;
      if (ps.key.startsWith("b:")) {
        const n = +ps.key.slice(2);
        c.seen = [n].concat(c.seen.filter((x) => x !== n)).slice(0, 40);
      }
      this.host.save();
      this.preview = null;
      this.play = {
        passage: ps,
        run: new TypingRun(ps.text),
        level: c.level,
        book,
        phase: "ready",
        runAt: 0,
        pausedAt: 0,
        pausedTotal: 0,
        endAt: 0,
        thief: HEAD,
        thiefT: 0,
        bonus: 0,
        reward: 0,
        capped: false,
        newBest: false,
        pop: null
      };
      const seed = (Date.now() ^ Math.random() * 1e9) >>> 0;
      this.scene.reset(new IsoCity(seed, Math.max(60, ps.text.length * CELLS_PER_CHAR), timeOfDay()));
      this.route = "play";
      this.host.render();
    }
    /** 警车的进度：打对的字母 + 加速、打滑 */
    policeProgress(p) {
      const n = p.passage.text.length;
      return Math.max(0, Math.min(1, (p.run.pos + p.bonus) / n));
    }
    sceneState() {
      const p = this.play;
      if (!p) return { police: 0, thief: HEAD, phase: "ready", endAt: 0 };
      return { police: this.policeProgress(p), thief: p.thief, phase: p.phase, endAt: p.endAt };
    }
    startTick() {
      this.stopTick();
      this.lastStep = performance.now();
      const loop = () => {
        if (!document.getElementById("chase-text")) {
          this.stopTick();
          return;
        }
        this.step(performance.now());
        this.tick = requestAnimationFrame(loop);
      };
      this.tick = requestAnimationFrame(loop);
    }
    stopTick() {
      cancelAnimationFrame(this.tick);
      this.tick = 0;
    }
    step(now) {
      const p = this.play;
      if (!p) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.lastStep) / 1e3));
      this.lastStep = now;
      if (p.phase === "run") {
        p.thiefT += dt;
        const t = p.thiefT;
        const vary = 1 + 0.16 * Math.sin(t * 0.8) + 0.07 * Math.sin(t * 2.1 + 1.3);
        const cps = LEVELS[p.level].wpm * 5 / 60;
        p.thief = Math.min(1, p.thief + cps * vary * dt / p.passage.text.length);
        if (this.policeProgress(p) >= p.thief) this.finish(true, now);
        else if (p.thief >= 1) this.finish(false, now);
      }
      this.paintHud(now);
    }
    finish(won, now) {
      const p = this.play;
      if (!p || p.phase === "won" || p.phase === "lost") return;
      p.phase = won ? "won" : "lost";
      p.endAt = now;
      p.run.pause(now);
      const c = this.save();
      const wpm = p.run.wpm(now);
      const acc = p.run.accuracy();
      if (won) {
        const can = Math.max(0, DAILY_COINS - c.coins);
        p.reward = Math.min(LEVELS[p.level].coins, can);
        p.capped = p.reward < LEVELS[p.level].coins;
        c.coins += p.reward;
        const prev = c.best[p.level] || 0;
        if (wpm > prev) {
          p.newBest = prev > 0;
          c.best[p.level] = Math.round(wpm * 10) / 10;
        }
        if (p.reward) this.host.gain(p.reward);
      }
      c.history = [{ t: Date.now(), book: p.book, level: p.level, wpm: Math.round(wpm * 10) / 10, acc: Math.round(acc * 1e3) / 1e3, won }].concat(c.history).slice(0, 30);
      this.host.save();
      setTimeout(() => this.paintResult(), won ? 900 : 1300);
    }
    pause(now) {
      const p = this.play;
      if (!p || p.phase !== "run") return;
      p.phase = "paused";
      p.pausedAt = now;
      p.run.pause(now);
      this.paintOverlay();
    }
    resume(now) {
      const p = this.play;
      if (!p || p.phase !== "paused") return;
      p.pausedTotal += now - p.pausedAt;
      p.pausedAt = 0;
      p.run.resume(now);
      p.phase = "run";
      this.lastStep = now;
      this.paintOverlay();
    }
    // ---------------- 键盘 ----------------
    onKey(ev) {
      if (document.querySelector(".modal")) return;
      const view2 = document.querySelector("main.games");
      if (!view2) return;
      const tag = ev.target?.tagName || "";
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const now = performance.now();
      if (this.route === "setup" || !this.play) {
        if (!inField && ev.key === "Enter" && document.querySelector('[data-game="start"]:not([disabled])')) {
          ev.preventDefault();
          this.start();
        }
        return;
      }
      const p = this.play;
      if (inField) return;
      if (ev.isComposing || ev.keyCode === 229 || ev.key === "Process") {
        this.flash("请切换到英文输入法");
        return;
      }
      if (ev.key.length === 1 || ev.key === "Backspace") ev.preventDefault();
      if (p.phase === "won" || p.phase === "lost") {
        if (ev.key === "Enter") {
          ev.preventDefault();
          this.next();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          this.toSetup();
        }
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        if (p.phase === "paused") this.resume(now);
        else this.pause(now);
        return;
      }
      if (p.phase === "paused") {
        if (ev.key === "Enter") {
          ev.preventDefault();
          this.resume(now);
        }
        return;
      }
      if (ev.key === "Backspace") {
        ev.preventDefault();
        if (p.run.backspace()) this.paintText();
        return;
      }
      if (ev.key.length !== 1) return;
      ev.preventDefault();
      if (p.phase === "ready") {
        p.phase = "run";
        p.runAt = now;
        p.run.start(now);
        this.lastStep = now;
        this.paintOverlay();
      }
      const r = p.run.type(ev.key);
      if (r === "wrong") {
        p.bonus = Math.max(-p.run.pos, p.bonus - SKID_CHARS);
        this.scene.skid();
        this.nudge();
      } else if ((r === "ok" || r === "done") && p.run.combo > 0 && p.run.combo % COMBO_EVERY === 0) {
        p.bonus += BOOST_CHARS;
        this.scene.boost(now);
        this.popup("连击 " + p.run.combo + " · 加速");
      }
      this.paintText();
      this.step(now);
    }
    // ---------------- 画 DOM ----------------
    paintText() {
      const p = this.play;
      if (!p || !this.spans.length) return;
      const pos = p.run.pos;
      const first = this.shownPos < 0;
      const from = first ? 0 : Math.max(0, Math.min(this.shownPos, pos) - 1);
      const to = first ? this.spans.length : Math.min(this.spans.length, Math.max(pos, this.shownPos) + 2);
      for (let i = from; i < to; i++) {
        this.spans[i].className = i < pos ? p.run.missed[i] ? "ok was" : "ok" : i === pos ? p.run.wrong !== null ? "cur err" : "cur" : "";
      }
      this.shownPos = pos;
      const cur = this.spans[Math.min(pos, this.spans.length - 1)];
      const box = document.getElementById("chase-scroll");
      if (cur && box) {
        const line = cur.offsetHeight || 40;
        const top = Math.max(0, cur.offsetTop - line);
        if (Math.abs(box.scrollTop - top) > 2) box.scrollTo({ top, behavior: "smooth" });
      }
    }
    paintHud(now) {
      const p = this.play;
      if (!p) return;
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== v) el.textContent = v;
      };
      set("st-wpm", String(Math.round(p.run.wpm(now))));
      set("st-acc", Math.round(p.run.accuracy() * 100) + "%");
      set("st-combo", String(p.run.combo));
      set("st-gap", String(Math.max(0, Math.round((p.thief - this.policeProgress(p)) * 1e3))));
      this.paintOverlay(now);
    }
    paintOverlay(now = performance.now()) {
      const p = this.play;
      const el = document.getElementById("chase-overlay");
      if (!p || !el) return;
      let html = "";
      if (p.phase === "ready") {
        html = '<div class="ov-ready"><b>开始打字，就开始追</b><span>字母不分大小写 · 打错了不前进</span></div>';
      } else if (p.phase === "paused") {
        html = '<div class="ov-card"><b>暂停</b><div class="actions"><button class="btn" data-game="resume">继续<kbd>Esc</kbd></button><button class="btn ghost" data-game="quit">不追了</button></div></div>';
      } else if (p.phase === "won" || p.phase === "lost") {
        html = this.lastOverlay.startsWith('<div class="ov-card result') ? this.lastOverlay : "";
      }
      if (html !== this.lastOverlay) {
        el.innerHTML = html;
        this.lastOverlay = html;
      }
      const pop = document.getElementById("chase-pop");
      if (pop && p.pop && now - p.pop.at > 1100) {
        p.pop = null;
        pop.classList.remove("show");
      }
    }
    popup(text) {
      const p = this.play;
      const pop = document.getElementById("chase-pop");
      if (!p || !pop) return;
      p.pop = { text, at: performance.now() };
      pop.textContent = text;
      pop.classList.remove("show");
      void pop.offsetWidth;
      pop.classList.add("show");
    }
    paintResult() {
      const p = this.play;
      const el = document.getElementById("chase-overlay");
      if (!p || !el || p.phase !== "won" && p.phase !== "lost") return;
      const h = this.host;
      const now = p.endAt;
      const wpm = Math.round(p.run.wpm(now));
      const acc = Math.round(p.run.accuracy() * 100);
      const missedWords = wordsWithMisses(p.run);
      const title = p.phase === "won" ? p.newBest ? "抓到了 · 新纪录" : "抓到了" : "让他跑了";
      const sub = p.phase === "won" ? p.reward ? "+" + p.reward + " 金币" + (p.capped ? "（今天的领满了）" : "") : "今天打字游戏的金币领满了" : "还差 " + Math.max(1, Math.round((1 - p.run.progress()) * (p.passage.text.match(/\S+/g) || []).length)) + " 个词";
      const html = '<div class="ov-card result ' + p.phase + '"><div class="ov-main"><div class="ov-title"><b>' + title + '</b><span class="ov-sub">' + h.esc(sub) + '</span></div><div class="ov-stats"><div><b>' + wpm + "</b><span>词 / 分钟</span></div><div><b>" + acc + "%</b><span>正确率</span></div><div><b>" + p.run.bestCombo + "</b><span>最长连击</span></div><div><b>" + clock(p.run.elapsed(now)) + '</b><span>用时</span></div></div><div class="ov-acts"><button class="btn" data-game="next">再来一篇<kbd>Enter</kbd></button><button class="btn ghost" data-game="setup">换难度<kbd>Esc</kbd></button></div></div>' + (missedWords.length ? '<p class="ov-miss"><span class="muted small">打错过</span> ' + missedWords.map((w) => '<span class="mw">' + h.esc(w) + "</span>").join(" ") + "</p>" : "") + "</div>";
      el.innerHTML = html;
      this.lastOverlay = html;
    }
    nudge() {
      const box = document.getElementById("chase-box");
      if (!box) return;
      box.classList.remove("nudge");
      void box.offsetWidth;
      box.classList.add("nudge");
    }
    flash(msg) {
      const box = document.getElementById("chase-box");
      if (!box) return;
      let tip = box.querySelector(".cp-tip");
      if (!tip) {
        tip = document.createElement("div");
        tip.className = "cp-tip";
        box.appendChild(tip);
      }
      tip.textContent = msg;
      clearTimeout(this.flashTimer);
      this.flashTimer = window.setTimeout(() => tip && tip.remove(), 2200);
    }
    // ---------------- 按钮 ----------------
    next() {
      const p = this.play;
      if (!p) return;
      const c = this.save();
      this.start(pickPassage(this.host, p.book, c.seen, p.passage.key));
    }
    toSetup() {
      this.play = null;
      this.route = "setup";
      this.host.render();
    }
    async action(name, el) {
      const c = this.save();
      const now = performance.now();
      if (name === "level") {
        c.level = Math.max(0, Math.min(LEVELS.length - 1, +(el.dataset.i || 0)));
        this.host.save();
        this.host.render();
      } else if (name === "shuffle") {
        this.preview = pickPassage(this.host, this.bookId(), c.seen, this.preview ? this.preview.key : void 0);
        this.host.render();
      } else if (name === "start") {
        this.start();
      } else if (name === "pause") {
        if (this.play && this.play.phase === "paused") this.resume(now);
        else this.pause(now);
      } else if (name === "resume") {
        this.resume(now);
      } else if (name === "quit") {
        const p = this.play;
        if (p && p.phase === "run" && p.run.pos > 0) {
          this.pause(now);
          if (!await this.host.confirm("这局不追了？", "不追了")) {
            this.resume(performance.now());
            return;
          }
        }
        this.toSetup();
      } else if (name === "next") {
        this.next();
      } else if (name === "setup") {
        this.toSetup();
      } else if (name === "addCustom") {
        const ta = document.getElementById("chase-paste");
        if (ta) this.addCustom(ta.value);
      } else if (name === "delCustom") {
        const g = this.host.state().games;
        if (!g) return;
        g.custom = g.custom.filter((x) => x.id !== el.dataset.id);
        this.host.save();
        this.host.render();
      }
    }
    change(name, el) {
      if (name === "book") {
        const c = this.save();
        c.book = el.value;
        this.preview = null;
        this.host.save();
        this.host.render();
      }
    }
    async file(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      if (f.size > 2e6) {
        this.host.toast("文件太大了");
        return;
      }
      this.addCustom(await f.text());
    }
    addCustom(raw) {
      const text = normalizeText(raw);
      const parts = splitPassages(text).filter((t) => (t.match(/[A-Za-z]+/g) || []).length >= 8);
      if (!parts.length) {
        this.host.toast("没有找到英文段落");
        return;
      }
      const g = this.host.state().games;
      if (!g) return;
      const room2 = 200 - g.custom.length;
      if (room2 <= 0) {
        this.host.toast("自定义文章最多 200 段，先删掉一些");
        return;
      }
      const added = parts.slice(0, room2).map((t, i) => ({
        id: Date.now().toString(36) + i.toString(36),
        title: (t.match(/\S+/g) || []).slice(0, 7).join(" ") + "…",
        text: t
      }));
      g.custom = added.concat(g.custom);
      const c = this.save();
      c.book = CUSTOM_BOOK;
      this.preview = { key: "c:" + added[0].id, text: added[0].text, source: "自定义 · " + added[0].title };
      this.host.save();
      this.host.toast("加了 " + added.length + " 段");
      this.host.render();
    }
    passage(key) {
      return passageByKey(this.host, key);
    }
    /** 测试用：当前这局 */
    debug() {
      const p = this.play;
      return p ? { phase: p.phase, pos: p.run.pos, len: p.passage.text.length, thief: p.thief, police: this.policeProgress(p), wrong: p.run.wrong, text: p.passage.text, reward: p.reward, keys: p.run.keys, hits: p.run.hits, combo: p.run.combo, bonus: p.bonus } : null;
    }
  };
  function wordsWithMisses(run) {
    const out = [];
    const re = /[A-Za-z][A-Za-z'-]*/g;
    let m;
    while (m = re.exec(run.text)) {
      for (let i = m.index; i < m.index + m[0].length; i++) {
        if (run.missed[i]) {
          const w = m[0].replace(/'s$/, "");
          if (!out.includes(w)) out.push(w);
          break;
        }
      }
    }
    return out.slice(0, 12);
  }
  var cover = "";
  function coverImage() {
    if (cover) return cover;
    const city = new IsoCity(7, 70, "dusk");
    const W = 150;
    const H = 68;
    const S = 4;
    const cv = document.createElement("canvas");
    cv.width = W * S;
    cv.height = H * S;
    const c = cv.getContext("2d");
    if (!c) return "";
    const clear = (g2) => !city.things.some((th) => th.sil && th.mx > g2.gx && th.my > g2.gy && [1, 10, 22].some((up) => pointIn(th.sil, city.sx(g2), city.sy(g2) - up)));
    let s0 = 14;
    for (let s = 10; s < city.length - 6; s += 0.5) {
      if (clear(city.at(s)) && clear(city.at(s + 3.2))) {
        s0 = s;
        break;
      }
    }
    const a = city.at(s0);
    const b = city.at(s0 + 3.2);
    const ox = Math.round((city.sx(a) + city.sx(b)) / 2 - W / 2);
    const oy = Math.round((city.sy(a) + city.sy(b)) / 2 - H * 0.62);
    c.setTransform(S, 0, 0, S, -ox * S, -oy * S);
    city.drawGround(c, ox, oy, W, H, S);
    let carDone = false;
    let thiefDone = false;
    const car = () => drawCar(c, city.sx(a), city.sy(a), a.dir, "#f4f3ee", "police", 0, "dusk");
    const thief = () => {
      shadow(c, city.sx(b) + 1.2, city.sy(b) + 0.4, 5, 2);
      drawThief(c, city.sx(b), city.sy(b), 120, "run", b.dir.gx - b.dir.gy < -0.1, "dusk");
    };
    for (const th of city.things) {
      if (th.x > ox + W || th.y > oy + H || th.x + th.w < ox || th.y + th.h < oy) continue;
      if (!thiefDone && th.mx > b.gx && th.my > b.gy) {
        thief();
        thiefDone = true;
      }
      if (!carDone && th.mx > a.gx && th.my > a.gy) {
        car();
        carDone = true;
      }
      th.draw(c, S);
    }
    if (!thiefDone) thief();
    if (!carDone) car();
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(city.sx(a), city.sy(a) - 9, 0, city.sx(a), city.sy(a) - 9, 24);
    g.addColorStop(0, "rgba(255,70,60,.38)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(ox, oy, W, H);
    c.globalCompositeOperation = "source-over";
    c.setTransform(1, 0, 0, 1, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, H * S);
    sky.addColorStop(0, "rgba(255,150,90,.16)");
    sky.addColorStop(1, "rgba(120,60,120,.05)");
    c.fillStyle = sky;
    c.fillRect(0, 0, W * S, H * S);
    cover = cv.toDataURL();
    return cover;
  }
  function pointIn(pts, x, y) {
    let n = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) n = !n;
    }
    return n;
  }

  // src/games/hub.ts
  var GAMES = [
    {
      id: "chase",
      name: "打字追击",
      desc: "在城市的大街小巷里追小偷：打对一个字母，警车就往前开一点，连击还能加速，要在他跑进仓库前追上。文章按词库挑，金融、医学、托福、GRE……",
      cover: coverImage
    }
  ];
  function hubHtml(host2) {
    const g = host2.state().games;
    const c = g && g.chase;
    const best = c ? Math.max(0, ...Object.values(c.best || {})) : 0;
    const today = c && c.day === host2.today() ? c.coins : 0;
    return '<main class="page games"><h1 class="h1">小游戏</h1><div class="game-grid">' + GAMES.map(
      (gm) => '<button class="game-card" data-game="open" data-id="' + gm.id + '"><img class="gc-cover" alt="" src="' + gm.cover() + '"><span class="gc-body"><b class="gc-name">' + host2.esc(gm.name) + '</b><span class="gc-desc">' + host2.esc(gm.desc) + '</span><span class="gc-meta">' + (best ? "<span>最快 " + Math.round(best) + " 词 / 分钟</span>" : "") + "<span>今天 " + today + " / " + DAILY_COINS + " 金币</span><span>" + LEVELS.length + " 档速度</span></span></span></button>"
    ).join("") + "</div></main>";
  }

  // src/games/index.ts
  var host = null;
  var chase = null;
  var route = "hub";
  function init(h) {
    host = h;
    chase = new ChaseGame(h);
    document.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-game]");
      if (!el || !document.querySelector("main.games") || !chase || !host) return;
      if (el.tagName === "SELECT") return;
      const name = el.dataset.game || "";
      if (name === "open") {
        route = el.dataset.id === "chase" ? "chase" : "hub";
        chase.route = "setup";
        host.render();
        window.scrollTo(0, 0);
        return;
      }
      void chase.action(name, el);
    });
    document.addEventListener("change", (ev) => {
      const el = ev.target;
      if (!chase || !document.querySelector("main.games")) return;
      if (el.id === "chase-file") void chase.file(el);
      else if (el.dataset && el.dataset.game) chase.change(el.dataset.game, el);
    });
  }
  function home() {
    if (chase) chase.leave();
    route = "hub";
  }
  function view() {
    if (!host || !chase) return "";
    return route === "chase" ? chase.view() : hubHtml(host);
  }
  function after() {
    if (chase) {
      if (route === "chase") chase.after();
      else chase.leave();
    }
  }
  function leave() {
    if (chase) chase.leave();
  }
  var api = { init, view, after, leave, home, debug: () => chase ? chase.debug() : null, route: () => route };
  window.MARGIN_GAMES = api;

  // src/app/books.ts
  var EXAM_BOOKS = [
    { id: "cet4", name: "CET-4", bits: [2, 1] },
    { id: "cet6", name: "CET-6", bits: [3, 2, 1] },
    { id: "ky", name: "GEE", bits: [4, 2, 1] },
    // 考研，Graduate Entrance Examination
    { id: "toefl", name: "TOEFL", bits: [6] },
    { id: "ielts", name: "IELTS", bits: [5] },
    { id: "toeic", name: "TOEIC", bits: [9] },
    { id: "gre", name: "GRE", bits: [7] },
    { id: "gmat", name: "GMAT", bits: [8] }
  ];
  var TERM_BOOKS = [
    { id: "fin", name: "Finance", key: "MARGIN_FINANCE" },
    { id: "mf", name: "MacroFin", key: "MARGIN_MACROFIN" },
    { id: "med", name: "Medicine", key: "MARGIN_MEDICINE" }
  ];
  var BASIC_MASK = 1 << 0 | 1 << 1;
  var WRONG_BOOK = "__wrong";
  var REVIEW_BOOK = "__review";
  var INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];
  var MODES = {
    en2zh: { name: "英 → 中", desc: "看英文，写中文意思" },
    zh2en: { name: "中 → 英", desc: "看中文，拼写英文" },
    listen: { name: "听 → 写", desc: "听发音，拼写英文" }
  };
  var STAGES = ["en2zh", "zh2en", "listen"];
  var CJK_RE = /[㐀-鿿豈-﫿]/;
  var EXAM_WORDS = [];
  var TERM_WORDS = {};
  var LOOKUP = /* @__PURE__ */ new Map();
  (function loadBuiltin() {
    const exam = window.MARGIN_DICT || "";
    if (exam) {
      for (const line of exam.split("\n")) {
        const [w, p, m, mask, x] = line.split("	");
        const e = { w, p, m, mask: +mask, x: x || "" };
        EXAM_WORDS.push(e);
        if (!LOOKUP.has(w.toLowerCase())) LOOKUP.set(w.toLowerCase(), e);
      }
    }
    for (const b of TERM_BOOKS) {
      const list = TERM_WORDS[b.id] = [];
      const raw = window[b.key] || "";
      if (!raw) continue;
      for (const line of raw.split("\n")) {
        const [w, p, m, s, t] = line.split("	");
        const e = { w, p, m, s, t };
        list.push(e);
        if (!LOOKUP.has(w.toLowerCase())) LOOKUP.set(w.toLowerCase(), e);
      }
    }
  })();
  var ROOTS = window.MARGIN_ROOTS || [];
  var ROOT_BY_ID = new Map(ROOTS.map((r) => [r.id, r]));
  var ROOT_TYPES = { prefix: "前缀", root: "词根", suffix: "后缀" };
  var PARTS = /* @__PURE__ */ new Map();
  for (const line of (window.MARGIN_PARTS || "").split("\n")) {
    if (!line) continue;
    const [w, parts, links] = line.split("	");
    PARTS.set(w.toLowerCase(), {
      w,
      parts,
      links: (links ? links.split(",") : []).map((x) => {
        const [id, form, at] = x.split("|");
        return { id, form, at: +at };
      }).filter((l) => ROOT_BY_ID.has(l.id))
    });
  }
  function partsOf(word) {
    const w = String(word).toLowerCase();
    let p = PARTS.get(w);
    if (p) return p;
    for (const [end, add] of [["ies", "y"], ["ied", "y"], ["es", ""], ["s", ""], ["ed", ""], ["ed", "e"], ["ing", ""], ["ing", "e"]]) {
      if (w.length > end.length + 2 && w.endsWith(end) && (p = PARTS.get(w.slice(0, -end.length) + add))) return p;
    }
    return null;
  }
  function breakdownLines(w) {
    const toks = String(w).toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (toks.length === 1) {
      const p = partsOf(toks[0]);
      return p ? [p.parts] : [];
    }
    const out = [];
    for (const t of toks) {
      const p = partsOf(t);
      if (p && out.length < 3) out.push(t + " = " + p.parts);
    }
    return out;
  }
  var bookCache = {};

  // src/app/util.ts
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function todayKey() {
    const d = /* @__PURE__ */ new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dayNum(date) {
    const d = date || /* @__PURE__ */ new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5);
  }
  function dayKeyOf(n) {
    const d = new Date(n * 864e5);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  }
  var DESKTOP = !!(window.__TAURI__ && window.__TAURI__.core);
  var WINDOWS = DESKTOP && /Windows/i.test(navigator.userAgent);
  function downloadText(name, text, type) {
    if (DESKTOP) {
      window.__TAURI__.core.invoke("save_to_downloads", { name, contents: text }).then(() => toast("已保存到「下载」文件夹：" + name)).catch((e) => toast("保存失败：" + e));
      return;
    }
    const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
  }
  function fmt(n) {
    return Number(n).toLocaleString("en-US");
  }
  var keyOf = (w) => String(w).trim().toLowerCase();

  // src/app/dialogs.ts
  var toastTimer = null;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function modal(message, opts) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "modal";
      wrap.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true"><p class="modal-msg">' + esc(message) + "</p>" + (opts.input ? '<input class="field modal-input" autocomplete="off" value="' + esc(opts.value || "") + '">' : "") + '<div class="actions"><button class="btn small" data-m="ok">' + esc(opts.ok || "确定") + '</button><button class="btn small ghost" data-m="cancel">取消</button></div></div>';
      document.body.appendChild(wrap);
      const input = wrap.querySelector(".modal-input");
      const onKey = (ev) => {
        if (ev.isComposing || ev.keyCode === 229) return;
        if (ev.key === "Enter" || ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          done(ev.key === "Enter");
        }
      };
      function done(ok) {
        document.removeEventListener("keydown", onKey, true);
        wrap.remove();
        resolve(input ? ok ? input.value : null : ok);
      }
      document.addEventListener("keydown", onKey, true);
      wrap.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-m]");
        if (b) done(b.dataset.m === "ok");
        else if (ev.target === wrap) done(false);
      });
      if (input) {
        input.focus();
        input.select();
      } else wrap.querySelector('[data-m="ok"]').focus();
    });
  }
  var askConfirm = (message, ok) => modal(message, { ok });
  var askText = (message, value) => modal(message, { input: true, value });
  var ICON_OK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  var ICON_BAD = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  var ICON_SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/></svg>';
  function ringHtml(a, b, cap) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const p = b ? Math.min(1, a / b) : 1;
    return '<div class="ring' + (p >= 1 ? " full" : "") + '" style="--c:' + c.toFixed(1) + '"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="' + r + '"/><circle class="ring-fg" cx="60" cy="60" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(1) + '"/></svg><div class="ring-num"><b>' + fmt(a) + "</b><small>/ " + fmt(b) + "</small><span>" + cap + "</span></div></div>";
  }
  var BURST = '<span class="burst" aria-hidden="true">' + Array.from({ length: 12 }, (_, i) => '<i style="--a:' + i * 30 + 'deg"></i>').join("") + "</span>";
  var ICON_SPEAK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>';

  // src/app/store.ts
  var STORE_KEY = "margin.v1";
  var FIRST_BOOK = TERM_WORDS.fin.length ? "fin" : EXAM_WORDS.length ? "toefl" : WRONG_BOOK;
  var DEFAULT_SETTINGS = {
    mode: "en2zh",
    book: FIRST_BOOK,
    goal: 20,
    // 每天背多少新词
    size: 10,
    // 每组几个词
    order: "new",
    accent: "us",
    voice: "auto",
    letterHint: true,
    copyWrong: true,
    weight: "normal",
    theme: "auto",
    rootBook: "all",
    // 词根板块选的词库
    rootGoal: 10,
    // 每天学几个词根
    forceAll: false,
    // 强制全对：某一步有错，这一步整组重来，直到全对才进入下一步
    petRoam: true,
    // 宠物在页面上走动
    zoom: 0
    // 花园画面放大几倍，0 是自动
  };
  function freshState() {
    return {
      v: 1,
      settings: Object.assign({}, DEFAULT_SETTINGS),
      books: {},
      stats: {},
      wrong: {},
      srs: {},
      known: {},
      log: {},
      rootStats: {},
      rootWrong: {},
      rootLog: {},
      // 金币：bal 余额，earned 累计赚到，groups / perfects 累计完成 / 全对的组数，days 每天的明细，ach 已获得的成就
      points: { bal: 0, earned: 0, groups: 0, perfects: 0, days: {}, ach: {} },
      // 宠物：每只 { id, sp 品种, name, born, food 饱腹, mood 心情, day 算到哪天了, sick, sickSince, wear 装扮 }；
      // petMain 陪你背单词的那只；petGraves 去世的宠物；petWardrobe 买过的宠物装扮（每只都能戴）
      pets: [],
      petMain: 0,
      petSeq: 0,
      petGraves: [],
      petWardrobe: [],
      // 花园：land 扩建了几次；plants 树、花、草、灌木；decor 装饰；room 屋里的家具；bag 背包；
      //       look / owned 人物的装扮；hist 每周的花园快照（星期一 -> 统计和布局）；grown 一共种大了多少（t 树、f 花）
      world: { land: 0, week: 0, plants: [], decor: [], room: [], bag: {}, look: {}, owned: [], hist: {}, grown: { t: 0, f: 0 }, gift: 0, migrated: 0, v5: 0 }
    };
  }
  function normalizeState(saved) {
    const s = freshState();
    if (!saved || typeof saved !== "object") return s;
    for (const k of ["books", "stats", "wrong", "srs", "known", "log", "rootStats", "rootWrong", "rootLog"]) {
      if (saved[k] && typeof saved[k] === "object") s[k] = saved[k];
    }
    Object.assign(s.settings, saved.settings || {});
    for (const k of ["points", "world"]) if (saved[k] && typeof saved[k] === "object") Object.assign(s[k], saved[k]);
    for (const k of ["pets", "petGraves", "petWardrobe"]) if (Array.isArray(saved[k])) s[k] = saved[k];
    for (const k of ["petMain", "petSeq"]) if (typeof saved[k] === "number") s[k] = saved[k];
    if (saved.games && typeof saved.games === "object") s.games = saved.games;
    if (saved.garden && typeof saved.garden === "object") s.garden = saved.garden;
    if (saved.pet && typeof saved.pet === "object") s.pet = saved.pet;
    if (saved.forest && typeof saved.forest === "object") s.forest = saved.forest;
    return s;
  }
  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORE_KEY) || "null"));
    } catch (e) {
      return freshState();
    }
  }
  var state = loadState();
  function setState(v) {
    state = v;
  }
  var saveFailed = false;
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      saveFailed = false;
    } catch (e) {
      if (!saveFailed) toast("进度没能保存（浏览器存储不可用或已满），请到「设置」里导出备份");
      saveFailed = true;
    }
  }

  // src/app/judge.ts
  function zhTerms(text) {
    const acronyms = [];
    String(text || "").replace(/[（(]\s*([A-Za-z][A-Za-z0-9&.\- ]{0,15})\s*[）)]/g, (_, a) => (acronyms.push(a.replace(/[^A-Za-z0-9]/g, "").toLowerCase()), _));
    return String(text || "").replace(/[（(［\[【〔<《][^）)］\]】〕>》]*[）)］\]】〕>》]/g, " ").replace(/(^|[^a-z])(?:[a-z]{1,6}\.)+/gi, "$1 ").split(/[\s,，;；、\/|。.!！?？:：'"“”‘’…·\-—–~～=]+/).map((t) => t.replace(/[^㐀-鿿豈-﫿A-Za-z0-9]/g, "").toLowerCase()).map((t) => t.length > 1 ? t.replace(/[的地得]$/, "").replace(/^[的地得之]/, "") : t).concat(acronyms).filter(Boolean);
  }
  function commonLen(a, b) {
    let best = 0;
    const prev = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      let diag = 0;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
        if (prev[j] > best) best = prev[j];
        diag = tmp;
      }
    }
    return best;
  }
  var SIM_T = 0.45;
  var VEC = null;
  var vecCache = /* @__PURE__ */ new Map();
  function loadVectors() {
    if (VEC !== null) return VEC;
    const raw = window.MARGIN_VEC;
    if (!raw || !raw.data) return VEC = false;
    const bin = atob(raw.data);
    const data2 = new Int8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data2[i] = bin.charCodeAt(i) << 24 >> 24;
    const map = /* @__PURE__ */ new Map();
    raw.words.split("	").forEach((w, i) => map.set(w, i));
    return VEC = { dim: raw.dim, map, data: data2 };
  }
  function vecOf(term) {
    if (vecCache.has(term)) return vecCache.get(term);
    const V = loadVectors();
    let out = null;
    if (V) {
      const acc = new Float32Array(V.dim);
      const add = (row) => {
        const o = row * V.dim;
        for (let d = 0; d < V.dim; d++) acc[d] += V.data[o + d];
      };
      let n = 0;
      if (V.map.has(term)) {
        add(V.map.get(term));
        n = 1;
      } else {
        for (let i = 0; i < term.length; ) {
          let step = 1;
          for (let L = Math.min(6, term.length - i); L >= 1; L--) {
            const r = V.map.get(term.substr(i, L));
            if (r !== void 0) {
              add(r);
              n++;
              step = L;
              break;
            }
          }
          i += step;
        }
      }
      let norm = 0;
      for (let d = 0; d < V.dim; d++) norm += acc[d] * acc[d];
      if (n && norm) {
        norm = Math.sqrt(norm);
        for (let d = 0; d < V.dim; d++) acc[d] /= norm;
        out = acc;
      }
    }
    vecCache.set(term, out);
    return out;
  }
  function similarity(a, b) {
    const va = vecOf(a);
    const vb = vecOf(b);
    if (!va || !vb) return null;
    let s = 0;
    for (let d = 0; d < va.length; d++) s += va[d] * vb[d];
    return s;
  }
  var NEG_RE = /^[不无非未没]/;
  var OPPOSITE = new Set(
    "多空 多少 上下 进出 入出 买卖 大小 长短 高低 增减 加减 升降 涨跌 正负 内外 前后 主被 顺逆 优劣 收支 盈亏 输赢 胜败 胜负 早晚 新旧 强弱 左右 东西 南北 好坏 真假 是非 有无 开关 借贷 存取 升贬 褒贬 攻守 动静 明暗 首末 始终 生死 得失 利弊 难易 快慢 轻重 远近 深浅 宽窄 厚薄 粗细 冷热 干湿 软硬 松紧 美丑 善恶 贫富 贵贱 进退 出入 起落 正反 积消 乐悲 顺差 买方".split(" ").filter((x) => x.length === 2).flatMap((x) => [x, x[1] + x[0]])
  );
  function oppositePair(a, b) {
    if (a.length !== b.length || a === b) return false;
    let diff = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (diff >= 0) return false;
        diff = i;
      }
    }
    return OPPOSITE.has(a[diff] + b[diff]);
  }
  function zhMatch(answer, meaning) {
    const us = zhTerms(answer);
    const rs = zhTerms(meaning);
    for (const u of us) {
      for (const r of rs) {
        if (u === r) return true;
        if (NEG_RE.test(u) !== NEG_RE.test(r) || oppositePair(u, r)) continue;
        if (u.length >= 2 && r.includes(u)) return true;
        if (r.length >= 2 && u.includes(r)) return true;
        if (r.length === 1 && u.includes(r) && u.length <= 3) return true;
        if (u.length < 2 || r.length < 2) continue;
        const sim = similarity(u, r);
        if (sim !== null ? sim >= SIM_T : commonLen(u, r) >= 2) return true;
      }
    }
    return false;
  }
  function normEn(s) {
    return String(s || "").trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ");
  }
  function enMatch(answer, word) {
    const a = normEn(answer);
    return !!a && String(word).split("/").some((w) => normEn(w) === a);
  }
  function judge(mode, entry, answer) {
    if (!answer.trim()) return false;
    return mode === "en2zh" ? zhMatch(answer, entry.m) : enMatch(answer, entry.w);
  }
  function zhLineCount(entry) {
    return Math.max(1, layersOf(entry.m).length);
  }
  function judgeZhLines(lines, entry) {
    const layers = layersOf(entry.m);
    const texts = lines.map((t) => t.trim());
    const can = texts.map((t) => t ? layers.map((L, j) => zhMatch(t, L.terms.join("；")) ? j : -1).filter((j) => j >= 0) : []);
    const owner = new Array(layers.length).fill(-1);
    const assign = (i, used) => {
      for (const j of can[i]) {
        if (used[j]) continue;
        used[j] = true;
        if (owner[j] < 0 || assign(owner[j], used)) {
          owner[j] = i;
          return true;
        }
      }
      return false;
    };
    texts.forEach((t, i) => {
      if (t) assign(i, []);
    });
    const matched = new Set(owner.filter((i) => i >= 0));
    const marks = texts.map((t, i) => t ? matched.has(i) : null);
    return { ok: texts.length === layers.length && marks.every((x) => x === true), marks };
  }

  // src/app/meaning.ts
  function meaningLines(m) {
    return String(m || "").split(/\s*[|\n]\s*/).filter(Boolean);
  }
  function splitPos(line) {
    const mt = line.match(/^((?:[a-z]{1,6}\.\s*(?:&\s*)?)+)\s*(.*)$/i);
    return mt ? [mt[1].trim(), mt[2]] : ["", line];
  }
  function splitTerms(text) {
    const out = [];
    let depth = 0;
    let cur = "";
    for (const ch of text) {
      if ("(（[［【".includes(ch)) depth++;
      else if (")）]］】".includes(ch)) depth = Math.max(0, depth - 1);
      if (depth === 0 && /[,，;；、]/.test(ch)) {
        if (cur.trim()) out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  var POS_SPLIT_RE = /\s+(?=(?:n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|interj|aux|abbr)\.\s)/i;
  var layerCache = /* @__PURE__ */ new Map();
  function layersOf(m) {
    m = String(m || "");
    if (layerCache.has(m)) return layerCache.get(m);
    const lines = meaningLines(m);
    const layers = [];
    if (!lines.some((ln) => splitPos(ln.trim())[0])) {
      const terms = [...new Set(lines.flatMap((ln) => splitTerms(ln)))];
      if (terms.length) layers.push({ pos: "", terms });
    } else {
      const seen = /* @__PURE__ */ new Set();
      for (const ln of lines) {
        for (const part of ln.split(POS_SPLIT_RE)) {
          const [pos, text] = splitPos(part.trim());
          for (const chunk of text.split(/[；;]/)) {
            const terms = chunk.split(/[，,、]/).map((t) => t.trim()).filter((t) => {
              const k = zhTerms(t).join("");
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            if (terms.length) layers.push({ pos, terms });
          }
        }
      }
    }
    layerCache.set(m, layers);
    return layers;
  }
  function shortMeaning(m) {
    const first = layersOf(m)[0];
    return first ? first.terms[0] : "";
  }
  function meaningHtml(m, mask) {
    const layers = layersOf(m);
    if (!layers.length) return "";
    let lastPos = null;
    return '<div class="senses">' + layers.map((L, i) => {
      const pos = L.pos !== lastPos ? L.pos : "";
      lastPos = L.pos;
      const text = L.terms.join("；");
      return '<span class="no">' + (i + 1) + '.</span><span class="pos">' + esc(pos) + '</span><span class="t">' + esc(mask ? maskWord(text, mask) : text) + "</span>";
    }).join("") + "</div>";
  }
  function maskWord(text, w) {
    const k = String(w).trim();
    if (!k) return text;
    const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return text.replace(re, "＿＿");
  }

  // src/app/library.ts
  function findExam(id) {
    return EXAM_BOOKS.find((b) => b.id === id);
  }
  function findTerm(id) {
    return TERM_BOOKS.find((b) => b.id === id);
  }
  function learnedToday() {
    const today = dayNum();
    let n = 0;
    for (const k in state.stats) if (state.stats[k].f === today) n++;
    return n;
  }
  function reviewPool() {
    const today = dayNum();
    const done = (state.log[todayKey()] || {}).rv || [];
    const doneSet = new Set(done);
    const pool = /* @__PURE__ */ new Map();
    for (const k in state.srs) {
      const st = state.stats[k];
      if (st && st.f === today - 1 || state.srs[k].d <= today) pool.set(k, state.srs[k]);
    }
    for (const k in state.wrong) pool.set(k, state.wrong[k]);
    const remaining = [];
    for (const [k, e] of pool) if (!state.known[k] && !doneSet.has(k)) remaining.push(e);
    return { done: done.length, remaining };
  }
  function markReviewed(entry) {
    const day = todayLog();
    const k = keyOf(entry.w);
    day.rv = day.rv || [];
    if (!day.rv.includes(k)) day.rv.push(k);
  }
  function todayLog() {
    const k = todayKey();
    return state.log[k] || (state.log[k] = { n: 0, r: 0 });
  }
  function bookEntries(id) {
    if (id === WRONG_BOOK) return Object.values(state.wrong);
    if (id === REVIEW_BOOK) return reviewPool().remaining;
    const ex = findExam(id);
    if (ex) {
      if (!bookCache[id]) {
        const want = ex.bits.reduce((m, b) => m | 1 << b, 0);
        const list = EXAM_WORDS.filter((e) => e.mask & want);
        const basic = (e) => e.mask & BASIC_MASK ? 1 : 0;
        bookCache[id] = list.map((e, i) => [e, i]).sort((a, b) => basic(a[0]) - basic(b[0]) || a[1] - b[1]).map((x) => x[0]);
      }
      return bookCache[id];
    }
    if (findTerm(id)) return TERM_WORDS[id];
    const c = state.books[id];
    return c ? c.words : [];
  }
  function bookName(id) {
    if (id === WRONG_BOOK) return "错题本";
    if (id === REVIEW_BOOK) return "今日复习";
    const b = findExam(id) || findTerm(id);
    if (b) return b.name;
    return state.books[id] ? state.books[id].name : "";
  }
  function bookExists(id) {
    if (id === WRONG_BOOK || id === REVIEW_BOOK) return true;
    if (findExam(id)) return bookEntries(id).length > 0;
    if (findTerm(id)) return TERM_WORDS[id].length > 0;
    return !!state.books[id];
  }
  function studyBook() {
    const s = state.settings;
    if (!bookExists(s.book) || s.book === WRONG_BOOK || s.book === REVIEW_BOOK) s.book = FIRST_BOOK;
    return s.book;
  }
  function isBuiltin(id) {
    return !!(findExam(id) || findTerm(id));
  }
  function available(entries) {
    return entries.filter((e) => e.w && !state.known[keyOf(e.w)]);
  }
  function usable(entries, mode) {
    return available(entries).filter((e) => mode === "listen" || e.m);
  }

  // src/app/stats.ts
  function seenCount(entries) {
    let n = 0;
    for (const e of entries) {
      const k = keyOf(e.w);
      if (state.stats[k] || state.known[k]) n++;
    }
    return n;
  }
  function streak() {
    let d = dayNum();
    const has = (n2) => (state.log[dayKeyOf(n2)] || {}).n > 0;
    if (!has(d)) d--;
    let n = 0;
    while (has(d)) {
      n++;
      d--;
    }
    return n;
  }
  function bump(entry, mode, ok) {
    const k = keyOf(entry.w);
    const s = state.stats[k] || (state.stats[k] = { f: dayNum() });
    const m = s[mode] || (s[mode] = [0, 0, 0]);
    m[ok ? 0 : 1]++;
    m[2] = Math.floor(Date.now() / 1e3);
    const day = todayLog();
    day.n++;
    if (ok) day.r++;
  }
  function markWrong(entry) {
    const k = keyOf(entry.w);
    const was = state.wrong[k];
    state.wrong[k] = { w: entry.w, p: entry.p || "", m: entry.m || "", x: entry.x || "", n: (was ? was.n : 0) + 1, t: was ? was.t : Date.now() };
  }
  function srsUpdate(entry, ok) {
    const k = keyOf(entry.w);
    const today = dayNum();
    const cur = state.srs[k];
    const base = { w: entry.w, p: entry.p || "", m: entry.m || "", x: entry.x || "" };
    if (!ok) state.srs[k] = Object.assign(base, { b: 1, d: today + INTERVALS[1] });
    else if (!cur) state.srs[k] = Object.assign(base, { b: 2, d: today + INTERVALS[2] });
    else if (today >= cur.d) {
      const b = Math.min(cur.b + 1, INTERVALS.length - 1);
      state.srs[k] = Object.assign(base, { b, d: today + INTERVALS[b] });
    }
  }
  function applyOutcome(entry, ok) {
    if (!ok) markWrong(entry);
    srsUpdate(entry, ok);
  }
  function markKnown(entry) {
    const k = keyOf(entry.w);
    state.known[k] = { w: entry.w, p: entry.p || "", m: entry.m || "", t: Date.now() };
    delete state.wrong[k];
    delete state.srs[k];
  }

  // src/app/speech.ts
  var speakToken = 0;
  var currentAudio = null;
  function stopSpeech() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  function speak(word) {
    if (!word) return;
    const token = ++speakToken;
    stopSpeech();
    const s = state.settings;
    if (s.voice === "browser" || navigator.onLine === false) {
      tts(word);
      return;
    }
    const a = new Audio("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(word) + "&type=" + (s.accent === "uk" ? 1 : 2));
    currentAudio = a;
    let settled = false;
    const fallback = () => {
      if (settled || token !== speakToken) return;
      settled = true;
      a.pause();
      tts(word);
    };
    a.addEventListener("playing", () => {
      settled = true;
    });
    a.addEventListener("error", fallback);
    setTimeout(fallback, 2500);
    a.play().catch(fallback);
  }
  function pickVoice(lang) {
    const voices = window.speechSynthesis.getVoices();
    const norm = (l) => String(l).replace("_", "-").toLowerCase();
    const same = voices.filter((v) => norm(v.lang) === lang.toLowerCase());
    const pool = same.length ? same : voices.filter((v) => norm(v.lang).startsWith("en"));
    const prefer = ["Google", "Samantha", "Daniel", "Aria", "Jenny", "Sonia", "Natural", "Microsoft"];
    for (const p of prefer) {
      const v = pool.find((x) => x.name.includes(p));
      if (v) return v;
    }
    return pool[0] || null;
  }
  function tts(word) {
    if (!("speechSynthesis" in window)) {
      toast("这个浏览器不支持朗读，建议用 Chrome 或 Edge");
      return;
    }
    const synth = window.speechSynthesis;
    const lang = state.settings.accent === "uk" ? "en-GB" : "en-US";
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang;
    u.rate = 0.9;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    synth.cancel();
    setTimeout(() => synth.speak(u), 30);
  }
  function initSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }

  // src/app/games.ts
  var GAMES2 = api;

  // src/world/bag.ts
  function bagAdd(id, n) {
    const b = state.world.bag;
    b[id] = (b[id] || 0) + n;
    if (b[id] <= 0) delete b[id];
  }
  function bagHas(id) {
    return (state.world.bag[id] || 0) > 0;
  }
  function itemIcon(it) {
    if (!it) return ART.icon("bag");
    if (it.plant) return ART.icon("seed", it.plant[0] === "flower" ? ART.FLOWER_COLOR[it.plant[1]] : it.plant[0] === "tree" ? "#a0703a" : it.plant[0] === "grass" ? "#9ab84a" : "#6aa35a");
    if (it.decor) return ART.decor(it.decor);
    if (it.use === "lawn") return ART.icon("seed", "#5fa83f");
    return ART.icon(it.icon || "bag");
  }
  function pxImg(canvas, scale, cls, title) {
    if (!canvas) return "";
    return '<img class="px' + (cls ? " " + cls : "") + '" src="' + ART.url(canvas) + '" width="' + canvas.width * scale + '" height="' + canvas.height * scale + '" alt=""' + (title ? ' title="' + esc(title) + '"' : "") + ' draggable="false">';
  }

  // src/world/garden.ts
  function weekStart(n) {
    n = n == null ? dayNum() : n;
    const dow = (new Date(n * 864e5).getUTCDay() + 6) % 7;
    return n - dow;
  }
  function plantMax(pl) {
    return pl.k === "tree" ? 4 : pl.k === "flower" ? 3 : 2;
  }
  function plantStage(pl) {
    return Math.min(plantMax(pl), (pl.b || 0) + (pl.w || []).length + (pl.f || 0));
  }
  function wateredToday(pl) {
    return (pl.w || []).includes(dayNum());
  }
  function plantName(pl) {
    if (pl.k === "tree") return (TREES.get(pl.sp) || {}).name || "树木";
    const it = ITEMS.get("seed." + pl.sp);
    return it ? it.name : pl.sp;
  }
  var TILL = { cost: 10, max: 20, word: 5, root: 3 };
  function stamina() {
    const W = state.world;
    const d = dayNum();
    if (!W.stam || W.stam.day !== d) W.stam = { v: TILL.max, day: d };
    return W.stam;
  }
  function staminaGain(n) {
    const s = stamina();
    const before = s.v;
    s.v = Math.min(TILL.max, s.v + n);
    return s.v - before;
  }
  function tilled(x, y) {
    return !!(state.world.till && state.world.till[x + "," + y]);
  }
  function setTilled(x, y, on) {
    const T = state.world.till || (state.world.till = {});
    if (on) T[x + "," + y] = 1;
    else delete T[x + "," + y];
  }
  function allTilled(x, y, w, h) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!tilled(x + i, y + j)) return false;
    return true;
  }

  // src/world/debris.ts
  var DEBRIS = {
    weed: { tool: "scythe", st: 1, w: 1, h: 1, walk: true, name: "杂草" },
    twig: { tool: "axe", st: 1, w: 1, h: 1, walk: true, name: "树枝", wood: [1, 2] },
    rock: { tool: "pickaxe", st: 2, w: 1, h: 1, name: "石头", stone: [1, 2] },
    boulder: { tool: "pickaxe", st: 5, w: 2, h: 2, name: "大石头", stone: [6, 8] },
    stump: { tool: "axe", st: 4, w: 2, h: 2, name: "树桩", wood: [4, 5] },
    tree: { tool: "axe", st: 6, w: 2, h: 1, name: "野树", wood: [8, 10] }
  };
  var CLEAR_TOOLS = ["scythe", "pickaxe", "axe"];
  var TOOL_NAME = { hoe: "锄头", scythe: "镰刀", pickaxe: "十字镐", axe: "斧头" };
  var WILD_TREES = ["oak", "pine", "maple", "birch"];
  function debrisSprite(d) {
    if (d.k === "tree") return ART.tree(d.sp, 4);
    if (d.k === "weed" || d.k === "rock") return ART.decor(d.k + (d.v || 1));
    return ART.decor(d.k);
  }
  function nearHouse(x, y) {
    return x >= HOUSE.x - 5 && x < HOUSE.x + HOUSE.w + 5 && y < HOUSE.y + HOUSE.h + 7;
  }
  function debrisFits(x, y, D, occ) {
    if (!gardenFree(x, y, D.w, D.h, occ)) return false;
    for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) if (tilled(x + i, y + j) || nearHouse(x + i, y + j)) return false;
    return true;
  }
  function seedDebris(ok) {
    const W = state.world;
    if (!W.debris) W.debris = [];
    const occ = gardenOcc();
    const cand = [];
    for (let y = GB; y < GH - GB; y++) for (let x = GB; x < GW - GB; x++) if (ok(x, y)) cand.push([x, y]);
    const R = Math.random;
    for (const [k, per] of [["tree", 4], ["boulder", 1.6], ["stump", 1.6], ["rock", 9], ["twig", 7], ["weed", 20]]) {
      const D = DEBRIS[k];
      let n = Math.round(cand.length * per / 100);
      for (let tries = 0; n > 0 && tries < 40 * n + 40; tries++) {
        const [x, y] = cand[Math.floor(R() * cand.length)];
        if (!ok(x + D.w - 1, y + D.h - 1) || !debrisFits(x, y, D, occ)) continue;
        const d = { k, x, y };
        if (k === "weed") d.v = 1 + Math.floor(R() * 3);
        if (k === "rock") d.v = 1 + Math.floor(R() * 2);
        if (k === "tree") d.sp = WILD_TREES[Math.floor(R() * WILD_TREES.length)];
        W.debris.push(d);
        for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) occ.set(x + i + "," + (y + j), { debris: d });
        n--;
      }
    }
  }
  function debrisTick() {
    const W = state.world;
    if (!W.debris) return;
    const today = dayNum();
    if (W.debrisDay == null) W.debrisDay = today;
    const days = Math.min(3, today - W.debrisDay);
    if (days <= 0) return;
    W.debrisDay = today;
    const occ = gardenOcc();
    for (let i = 0; i < days * 3 && W.debris.length < 400; i++) {
      const k = i % 3 === 2 ? Math.random() < 0.5 ? "rock" : "twig" : "weed";
      for (let t = 0; t < 60; t++) {
        const x = GB + Math.floor(Math.random() * (GW - 2 * GB));
        const y = GB + Math.floor(Math.random() * (GH - 2 * GB));
        if (!debrisFits(x, y, DEBRIS[k], occ)) continue;
        const d = { k, x, y };
        if (k === "weed") d.v = 1 + Math.floor(Math.random() * 3);
        if (k === "rock") d.v = 1 + Math.floor(Math.random() * 2);
        W.debris.push(d);
        occ.set(x + "," + y, { debris: d });
        break;
      }
    }
    save();
  }
  function matsShort(need) {
    const bag2 = state.world.bag;
    const out = [];
    if ((bag2.wood || 0) < (need.wood || 0)) out.push("木材 " + ((need.wood || 0) - (bag2.wood || 0)));
    if ((bag2.stone || 0) < (need.stone || 0)) out.push("石料 " + ((need.stone || 0) - (bag2.stone || 0)));
    return out;
  }
  function costText(need) {
    return fmt(need.price) + " 金币" + (need.wood ? " · 木材 " + need.wood : "") + (need.stone ? " · 石料 " + need.stone : "");
  }
  function payMats(need) {
    if (need.wood) bagAdd("wood", -need.wood);
    if (need.stone) bagAdd("stone", -need.stone);
  }

  // src/world/occupancy.ts
  function plantSize(pl) {
    return pl.k === "tree" ? [2, 1] : [1, 1];
  }
  function decorSize(id) {
    const d = ART.DECOR[id];
    return d ? [d.tw, d.th] : [1, 1];
  }
  function summarize(plants, decor2) {
    const s = { t: 0, y: 0, f: 0, s: 0, g: 0, w: GW, h: GH, p: [], dc: [] };
    for (const pl of plants) {
      const st = plantStage(pl);
      const full = st >= plantMax(pl);
      if (pl.k === "tree") full ? s.t++ : s.y++;
      else if (pl.k === "flower" && full) s.f++;
      else if (pl.k === "shrub" && full) s.s++;
      else if (pl.k === "grass" && full) s.g++;
      s.p.push([pl.k, pl.sp, pl.x, pl.y, st]);
    }
    for (const d of decor2 || []) s.dc.push([d.id, d.x, d.y]);
    return s;
  }
  function gardenCount(key) {
    return state.world.grown && state.world.grown[key] || 0;
  }
  function baseOcc() {
    const occ = /* @__PURE__ */ new Map();
    for (let y = HOUSE.y; y < HOUSE.y + HOUSE.h; y++) for (let x = HOUSE.x; x < HOUSE.x + HOUSE.w; x++) occ.set(x + "," + y, { house: true });
    for (const k of GPOND) occ.set(k, { pond: true });
    for (const d of GFIXED) {
      const [w, h] = decorSize(d.id);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + "," + (d.y + j), { fixed: d });
    }
    return occ;
  }
  function gardenOcc(skip) {
    const occ = baseOcc();
    for (const pl of state.world.plants) {
      if (pl === skip) continue;
      const [w, h] = plantSize(pl);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(pl.x + i + "," + (pl.y + j), { plant: pl });
    }
    for (const d of state.world.decor) {
      if (d === skip) continue;
      const [w, h] = decorSize(d.id);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + "," + (d.y + j), { decor: d });
    }
    for (const d of state.world.debris || []) {
      if (d === skip) continue;
      const D = DEBRIS[d.k];
      for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) occ.set(d.x + i + "," + (d.y + j), { debris: d });
    }
    return occ;
  }
  function gardenFree(x, y, w, h, occ) {
    occ = occ || gardenOcc();
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (tx < GB || ty < GB || tx >= GW - GB || ty >= GH - GB) return false;
        if (ty < HOUSE.y && tx >= HOUSE.x - 1 && tx <= HOUSE.x + HOUSE.w) return false;
        if (GPATH.has(tx + "," + ty) || occ.has(tx + "," + ty)) return false;
      }
    return true;
  }
  function relocate() {
    const W = state.world;
    let moved = 0;
    const fix = (item, w, h) => {
      if (gardenFree(item.x, item.y, w, h, gardenOcc(item))) return true;
      const occ = gardenOcc(item);
      let best = null;
      let bestD = Infinity;
      for (let y = GB; y < GH - GB; y++)
        for (let x = GB; x < GW - GB; x++) {
          const d = Math.hypot(x - item.x, y - item.y);
          if (d < bestD && gardenFree(x, y, w, h, occ)) {
            best = [x, y];
            bestD = d;
          }
        }
      if (!best) return false;
      item.x = best[0];
      item.y = best[1];
      moved++;
      return true;
    };
    W.plants = W.plants.filter((pl) => {
      const [w, h] = plantSize(pl);
      return fix(pl, w, h);
    });
    W.decor = W.decor.filter((d) => {
      const [w, h] = decorSize(d.id);
      if (fix(d, w, h)) return true;
      bagAdd("decor." + d.id, 1);
      return false;
    });
    if (W.debris) {
      const occD = baseOcc();
      for (const pl of W.plants) {
        const [w, h] = plantSize(pl);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occD.set(pl.x + i + "," + (pl.y + j), { plant: pl });
      }
      for (const d of W.decor) {
        const [w, h] = decorSize(d.id);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occD.set(d.x + i + "," + (d.y + j), { decor: d });
      }
      W.debris = W.debris.filter((d) => {
        const D = DEBRIS[d.k];
        if (!D || !gardenFree(d.x, d.y, D.w, D.h, occD)) return false;
        for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) occD.set(d.x + i + "," + (d.y + j), { debris: d });
        return true;
      });
    }
    const base = baseOcc();
    for (const k of Object.keys(W.till || {})) {
      const [x, y] = k.split(",").map(Number);
      if (!gardenFree(x, y, 1, 1, base)) delete W.till[k];
    }
    for (const pl of W.plants) {
      const [w, h] = plantSize(pl);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setTilled(pl.x + i, pl.y + j, true);
    }
    return moved;
  }
  function shiftTilled(dy) {
    const T = state.world.till || {};
    const out = {};
    for (const k in T) {
      const [x, y] = k.split(",").map(Number);
      out[x + "," + (y + dy)] = 1;
    }
    state.world.till = out;
  }

  // src/world/pets.ts
  function isFish(p) {
    return !!(p && (SPECIES.get(p.sp) || {}).fish);
  }
  function landPets() {
    return state.pets.filter((p) => SPECIES.has(p.sp) && !isFish(p));
  }
  function fishList() {
    return state.pets.filter((p) => SPECIES.has(p.sp) && isFish(p));
  }
  function petById(id) {
    return state.pets.find((p) => p.id === id) || null;
  }
  function mainPet() {
    const p = petById(state.petMain);
    return p && SPECIES.has(p.sp) && !isFish(p) ? p : null;
  }
  function petAlive() {
    return !!mainPet();
  }
  function petAge(p) {
    if (p) return dayNum() - p.born + 1;
    return state.pets.reduce((m, x) => Math.max(m, dayNum() - x.born + 1), 0);
  }
  function petSick(p) {
    p = p || mainPet();
    return !!p && !!p.sick;
  }
  function petLow(p) {
    return p.sick || p.food < 30 || p.mood < 30;
  }
  function petNeedsCare() {
    return state.pets.some((p) => SPECIES.has(p.sp) && petLow(p));
  }
  function newPet(sp, name) {
    state.petSeq = (state.petSeq || 0) + 1;
    const p = { id: state.petSeq, sp, name: name || (SPECIES.get(sp) || {}).name || "宠物", born: dayNum(), food: CARE.start, mood: CARE.start, day: dayNum(), sick: false, sickSince: 0, wear: {} };
    state.pets.push(p);
    if (!isFish(p) && !mainPet()) state.petMain = p.id;
    return p;
  }
  function petsTick() {
    const today = dayNum();
    let changed = false;
    const gone = [];
    for (const p of state.pets) {
      if (p.day == null) p.day = today;
      const fish = isFish(p);
      while (p.day < today) {
        p.day++;
        changed = true;
        if (p.sick) continue;
        p.food = Math.max(0, p.food - (fish ? CARE.fishFood : CARE.food));
        p.mood = Math.max(0, p.mood - (fish ? CARE.fishMood : CARE.mood));
        if (p.food <= 0 || p.mood <= 0) {
          p.sick = true;
          p.sickSince = p.day;
        }
      }
      if (p.sick && today - p.sickSince >= CARE.sickDays) gone.push(p);
    }
    for (const p of gone) {
      state.pets = state.pets.filter((x) => x !== p);
      state.petGraves.push({ name: p.name, sp: p.sp, born: p.born, died: today });
      ui.petGone = (ui.petGone || []).concat(p.name);
      changed = true;
    }
    if (!mainPet()) {
      const next = landPets()[0];
      state.petMain = next ? next.id : 0;
    }
    if (changed) save();
  }
  function careUp(p, field, n, capKey, cap) {
    if (!p || p.sick || n <= 0) return 0;
    if (capKey) {
      const d = pday();
      const key = capKey + ":" + p.id;
      const used = d[key] || 0;
      n = Math.min(n, cap - used);
      if (n <= 0) return 0;
      d[key] = used + n;
    }
    p[field] = Math.min(100, (p[field] || 0) + n);
    return n;
  }
  function moodUp(n, capKey, cap) {
    return careUp(mainPet(), "mood", n, capKey, cap);
  }
  function petLabel(p) {
    if (p.sick) return "生病了";
    if (p.food < 30) return "饿了";
    if (p.mood < 30) return "不太开心";
    return p.food >= 70 && p.mood >= 70 ? "很好" : "还不错";
  }
  function lookOf(p) {
    const w = p && p.wear || {};
    const hat = ITEMS.get(w.hat);
    const color = ITEMS.get(w.color);
    return { hat: hat && hat.pet ? hat.pet.hat : "", hue: color && color.pet ? color.pet.hue : 0 };
  }
  function petCanvas(frame, p) {
    p = p || mainPet();
    if (!p) return null;
    const l = lookOf(p);
    return ART.pet(p.sp, frame, l.hue, l.hat);
  }
  function petLine(kind, vars, p) {
    p = p || mainPet();
    const list = PETS2.lines[kind];
    if (!p || !list || !list.length) return "";
    const sp = SPECIES.get(p.sp);
    const t = list[Math.floor(Math.random() * list.length)];
    return t.replace(/\{(\w+)\}/g, (_, k) => k === "name" ? p.name : k === "sound" ? sp ? sp.sound : "" : vars && vars[k] != null ? vars[k] : "");
  }
  function avatarLook() {
    const look = {};
    const wear = state.world.look || {};
    for (const slot of ["top", "bottom", "hair", "hairStyle", "hat"]) {
      const it = ITEMS.get(wear[slot]);
      if (it && it.look) Object.assign(look, it.look);
    }
    return look;
  }

  // src/world/data.ts
  var PETS2 = MARGIN_PETS;
  var SPECIES = new Map(PETS2.species.map((s) => [s.id, s]));
  var TREES = new Map(PETS2.trees.map((t) => [t.id, t]));
  var SHELVES = PETS2.shop.map(
    (sh) => sh.items === "TREES" ? Object.assign({}, sh, { items: PETS2.trees.map((t) => ({ id: "tseed." + t.id, name: t.name, price: t.price, use: "plant", plant: ["tree", t.id] })) }) : sh
  );
  var ITEMS = /* @__PURE__ */ new Map();
  for (const sh of SHELVES) for (const it of sh.items) ITEMS.set(it.id, Object.assign({ shelf: sh.id }, it));
  var PTS = { right: 2, combo: 5, perfect: 10, rootDone: 5, rootPerfect: 5, goal: 30, rootGoal: 15, again: 1 };
  var CARE = { start: 80, food: 35, mood: 20, fishFood: 30, fishMood: 12, cure: 50, studyCap: 20, playCap: 25, petCap: 6, sickDays: 3 };
  var CHALLENGES = [
    { id: "groups2", text: "完成 2 组新词", reward: 15, goal: 2, val: (d) => d.groups },
    { id: "perfect1", text: "一组单词全对", reward: 15, goal: 1, val: (d) => d.perfect },
    { id: "right50", text: "答对 50 题", reward: 15, goal: 50, val: (d) => d.right },
    { id: "combo10", text: "连续答对 10 题", reward: 10, goal: 10, val: (d) => d.combo },
    { id: "roots1", text: "学完 1 组词根", reward: 10, goal: 1, val: (d) => d.roots },
    { id: "goal", text: "完成今天的新词目标", reward: 10, goal: 1, val: (d) => d.goalDone ? 1 : 0 },
    { id: "feed2", text: "喂宠物 2 次", reward: 10, goal: 2, val: (d) => d.feed || 0 },
    { id: "water3", text: "给花园浇 3 次水", reward: 10, goal: 3, val: (d) => d.water || 0 }
  ];
  var ACHIEVEMENTS = [
    { id: "first", name: "第一组", desc: "完成第一组单词", reward: 20, goal: 1, val: () => state.points.groups },
    { id: "words100", name: "百词", desc: "累计背过 100 个词", reward: 30, goal: 100, val: () => Object.keys(state.stats).length },
    { id: "words500", name: "五百词", desc: "累计背过 500 个词", reward: 80, goal: 500, val: () => Object.keys(state.stats).length },
    { id: "words2000", name: "两千词", desc: "累计背过 2,000 个词", reward: 200, goal: 2e3, val: () => Object.keys(state.stats).length },
    { id: "words5000", name: "五千词", desc: "累计背过 5,000 个词", reward: 500, goal: 5e3, val: () => Object.keys(state.stats).length },
    { id: "streak3", name: "三天", desc: "连续打卡 3 天", reward: 20, goal: 3, val: () => streak() },
    { id: "streak7", name: "一周", desc: "连续打卡 7 天", reward: 50, goal: 7, val: () => streak() },
    { id: "streak30", name: "一个月", desc: "连续打卡 30 天", reward: 150, goal: 30, val: () => streak() },
    { id: "streak100", name: "一百天", desc: "连续打卡 100 天", reward: 500, goal: 100, val: () => streak() },
    { id: "perfect10", name: "十全十美", desc: "累计 10 组全对", reward: 50, goal: 10, val: () => state.points.perfects },
    { id: "perfect50", name: "稳扎稳打", desc: "累计 50 组全对", reward: 200, goal: 50, val: () => state.points.perfects },
    { id: "roots50", name: "寻根", desc: "学过 50 个词根", reward: 50, goal: 50, val: () => Object.keys(state.rootStats).length },
    { id: "roots300", name: "根深", desc: "学过 300 个词根", reward: 150, goal: 300, val: () => Object.keys(state.rootStats).length },
    { id: "pet7", name: "好伙伴", desc: "有一只宠物陪了你 7 天", reward: 50, goal: 7, val: () => petAge() },
    { id: "pet30", name: "老朋友", desc: "有一只宠物陪了你 30 天", reward: 200, goal: 30, val: () => petAge() },
    { id: "tree1", name: "第一棵树", desc: "种出第一棵大树", reward: 20, goal: 1, val: () => gardenCount("t") },
    { id: "tree10", name: "小树林", desc: "种出 10 棵大树", reward: 100, goal: 10, val: () => gardenCount("t") },
    { id: "tree50", name: "森林", desc: "种出 50 棵大树", reward: 300, goal: 50, val: () => gardenCount("t") },
    { id: "flower10", name: "花匠", desc: "养开 10 朵花", reward: 50, goal: 10, val: () => gardenCount("f") },
    { id: "home5", name: "小家", desc: "屋里摆 5 件家具", reward: 50, goal: 5, val: () => allRoomItems().length }
  ];
  var TILE = 16;
  var GB = 2;
  var LANDS = [0, 2e3, 3500, 5e3, 7e3, 9e3, 12e3, 15e3, 19e3, 24e3, 3e4].map((price, i) => ({ w: 64 + 4 * i, h: 48 + 3 * i, price, wood: 6 * i, stone: 4 * i }));
  var HOUSES = [
    ["小木屋", "cabin", 0],
    ["石头小屋", "cottage", 3e3],
    ["农舍", "house", 5e3],
    ["大农舍", "farm2", 8e3],
    ["两层小楼", "house2", 11e3],
    ["红砖洋房", "brick", 15e3],
    ["白色洋房", "white", 2e4],
    ["石头大宅", "manor", 25e3],
    ["别墅", "villa", 31e3],
    ["大别墅", "villa2", 38e3],
    ["庄园", "estate", 46e3]
  ].map(([name, sprite, price], i) => {
    const D = ART.DECOR[sprite];
    return { name, sprite, price, wood: i ? 10 * i + 10 : 0, stone: 8 * i, w: D.tw, h: D.th, room: [24 + 2 * i, 14 + i], floors: i >= 9 ? 3 : i >= 4 ? 2 : 1, oy: Math.max(0, Math.ceil(D.h / TILE) - 8) };
  });
  function floorCount() {
    return HOUSES[houseLevel()].floors;
  }
  function curFloor() {
    return Math.max(1, Math.min(floorCount(), ui.floor || 1));
  }
  function floorItems(f) {
    const W = state.world;
    const k = f > 1 ? "room" + f : "room";
    return W[k] || (W[k] = []);
  }
  function setFloorItems(f, list) {
    state.world[f > 1 ? "room" + f : "room"] = list;
  }
  function allRoomItems() {
    const out = [];
    for (let f = 1; f <= 3; f++) out.push(...floorItems(f));
    return out;
  }
  var FLOOR_NAME = ["", "一楼", "二楼", "三楼"];
  function stairsOf(f) {
    const n = floorCount();
    const out = [];
    if (f < n) out.push({ dir: "up", x: f === 1 ? RW - 5 : 3, y: 2 });
    if (f > 1) out.push({ dir: "down", x: f === 2 ? RW - 5 : 3, y: 2 });
    return out;
  }
  function onStairs(f, tx, ty) {
    return stairsOf(f).some((s) => tx >= s.x && tx < s.x + 2 && ty >= s.y && ty < s.y + 3);
  }
  var SEATS = { chair: { seat: 9, at: [8] }, stool: { seat: 8, at: [8] }, sofa: { seat: 11, at: [9, 23] }, bench: { seat: 10, at: [9, 23] } };
  var ITEM_OF_DECOR = /* @__PURE__ */ new Map();
  for (const it of ITEMS.values()) if (it.decor && !ITEM_OF_DECOR.has(it.decor)) ITEM_OF_DECOR.set(it.decor, it.id);
  var DOOR_X = 20;
  var HOUSE = { x: 16, y: 4, w: 9, h: 4, sprite: "house" };
  var GW = 40;
  var GH = 28;
  var GPATH = /* @__PURE__ */ new Set();
  var GEXIT = /* @__PURE__ */ new Set();
  var GPOND = /* @__PURE__ */ new Set();
  var POND_INNER = [];
  var OY = 0;
  function layoutGarden() {
    const L = LANDS[Math.max(0, Math.min(LANDS.length - 1, state.world && state.world.land || 0))];
    GW = L.w;
    const Hs = HOUSES[houseLevel()];
    OY = Hs.oy;
    GH = L.h + OY;
    Object.assign(HOUSE, { w: Hs.w, h: Hs.h, x: DOOR_X - Math.floor(Hs.w / 2), y: 8 + OY - Hs.h, sprite: Hs.sprite });
    RW = Hs.room[0];
    RH = Hs.room[1];
    RDOOR = [RW / 2 - 1, RW / 2];
    GPATH.clear();
    GEXIT.clear();
    for (let y = HOUSE.y + HOUSE.h - 1; y <= 13 + OY; y++) GPATH.add(DOOR_X + "," + y);
    for (let x = 0; x <= DOOR_X + 1; x++) for (const y of [12, 13]) GPATH.add(x + "," + (y + OY));
    for (let y = 14 + OY; y < GH; y++) for (const x of [DOOR_X, DOOR_X + 1]) GPATH.add(x + "," + y);
    for (const k of GPATH) {
      const [x, y] = k.split(",").map(Number);
      if (x < GB || y >= GH - GB) GEXIT.add(k);
    }
    GPOND.clear();
    for (let y = POND.y; y < POND.y + POND.h; y++)
      for (let x = POND.x; x < POND.x + POND.w; x++) {
        let n = 0;
        for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (ART.pondInside(x + dx, y + dy)) n++;
        if (n >= 2) GPOND.add(x + "," + (y + OY));
      }
    POND_INNER = [...GPOND].filter((k) => {
      const [x, y] = k.split(",").map(Number);
      return GPOND.has(x - 1 + "," + y) && GPOND.has(x + 1 + "," + y) && GPOND.has(x + "," + (y - 1)) && GPOND.has(x + "," + (y + 1));
    });
    GFIXED.length = 0;
    for (const d of GFIXED_AT) GFIXED.push({ id: d.id, x: d.side === "left" ? HOUSE.x - 5 : d.side === "right" ? HOUSE.x + HOUSE.w + 2 : d.x, y: d.y + OY });
  }
  var GFIXED = [];
  var GFIXED_AT = [
    { id: "sign", side: "right", y: 8 },
    { id: "mailbox", x: 22, y: 8 },
    { id: "logs", side: "left", y: 6 }
  ];
  var POND = { x: 1, y: 26, w: 20, h: 20 };
  var RW = 18;
  var RH = 11;
  var RDOOR = [8, 9];
  function houseLevel() {
    const h = state.world && state.world.house;
    return h >= 0 && h < HOUSES.length ? h : 0;
  }

  // src/app/registry.ts
  var VIEWS = {};
  var AFTER = {};
  var ACTIONS = {};

  // src/world/shop.ts
  var SHOP_TABS = [
    ["status", "我的宠物"],
    ["adopt", "宠物店"],
    ["seeds", "种子", ["treeseeds", "seeds"]],
    ["supplies", "用品", ["petcare", "garden"]],
    ["home", "家园", ["decor", "furniture", "mats", "build"]],
    ["style", "装扮", ["look", "petlook"]],
    ["goals", "挑战与成就"],
    ["rules", "金币规则"]
  ];
  var tabOfShelf = (id) => (SHOP_TABS.find((t) => t[2] && t[2].includes(id)) || SHOP_TABS[2])[0];
  function shopTab() {
    return SHOP_TABS.some((t) => t[0] === ui.shopTab) ? ui.shopTab : "status";
  }
  function onPetTab() {
    return ui.view === "shop" && shopTab() === "status";
  }
  function pointsPanelHtml() {
    const p = state.points;
    const lv = levelOf(p.earned);
    const lo = levelNeed(lv);
    const hi = levelNeed(lv + 1);
    const d = pday();
    return '<div class="pts-panel"><div class="pp-main"><p class="label">金币</p><div class="pp-num">' + fmt(p.bal) + '</div><p class="muted">今天 +' + fmt(d.e) + (d.x ? " · 扣 " + fmt(d.x) : "") + (d.s ? " · 花了 " + fmt(d.s) : "") + '</p></div><div class="pp-lv"><p class="label">等级</p><div class="pp-num">Lv ' + lv + '</div><div class="bar"><i style="width:' + Math.min(100, (p.earned - lo) / (hi - lo) * 100) + '%"></i></div><p class="muted">再赚 ' + fmt(hi - p.earned) + " 升到 Lv " + (lv + 1) + "</p></div></div>";
  }
  function challengesHtml(compact) {
    const d = pday();
    const rows = todayChallenges().map((c) => {
      const v = Math.min(c.goal, c.val(d));
      const done = !!d.ch[c.id];
      return '<div class="ch' + (done ? " done" : "") + '"><span class="ch-mark">' + (done ? ICON_OK : "") + '</span><span class="ch-t">' + c.text + '</span><span class="ch-p">' + (c.goal > 1 ? v + " / " + c.goal : "") + '</span><span class="ch-r">+' + c.reward + "</span></div>";
    }).join("");
    return '<section class="panel challenges' + (compact ? " compact" : "") + '"><div class="head-row"><p class="label">今日挑战</p></div>' + rows + "</section>";
  }
  function achievementsHtml() {
    const p = state.points;
    const done = ACHIEVEMENTS.filter((a) => p.ach[a.id]).length;
    return '<section class="panel achs"><div class="head-row"><h2 class="h2">成就</h2><span class="muted">' + done + " / " + ACHIEVEMENTS.length + '</span></div><div class="ach-grid">' + ACHIEVEMENTS.map((a) => {
      const got = !!p.ach[a.id];
      const v = Math.min(a.goal, a.val());
      return '<div class="ach' + (got ? " got" : "") + '"><span class="ach-ic">' + ICON_SPARK + "</span><div><b>" + a.name + "</b><span>" + a.desc + '</span><span class="ach-p">' + (got ? "已获得 +" + a.reward : fmt(v) + " / " + fmt(a.goal) + " · +" + a.reward) + "</span></div></div>";
    }).join("") + "</div></section>";
  }
  function careBar(label, v, sick) {
    const n = Math.round(v || 0);
    return '<div class="care"><span>' + label + '</span><div class="bar mood' + (sick ? " sick" : n < 30 ? " low" : "") + '"><i style="width:' + (sick ? 100 : n) + '%"></i></div><b>' + (sick ? "—" : n) + "</b></div>";
  }
  function careButtons(p) {
    const uses = p.sick ? ["medicine"] : isFish(p) ? [] : ["feed", "toy"];
    const ids = Object.keys(state.world.bag).filter((id) => {
      const it = ITEMS.get(id);
      return it && uses.includes(it.use);
    });
    return ids.map((id) => '<button class="use" data-act="careUse" data-pet="' + p.id + '" data-id="' + esc(id) + '" title="' + esc(ITEMS.get(id).name + " · " + itemNote(ITEMS.get(id))) + '">' + pxImg(itemIcon(ITEMS.get(id)), 2) + '<span class="n">' + state.world.bag[id] + "</span></button>").join("");
  }
  function petCardHtml(p) {
    const sp = SPECIES.get(p.sp);
    const main = p.id === state.petMain;
    const ward = ui.wardPet === p.id;
    const own = SHELVES.find((x) => x.id === "petlook").items.filter((it) => state.petWardrobe.includes(it.id));
    return '<section class="panel pet-home' + (p.sick ? " sick" : "") + '"><div class="ph-grid"><div class="pet-stage' + (p.sick ? " sick" : "") + '" data-pet="' + p.id + '"><div class="pet-bubble"></div><div class="pet-hop">' + pxImg(petCanvas(p.sick ? "sick" : "idle", p), 4, "stage-img") + '</div></div><div class="ph-info"><h2 class="h2">' + esc(p.name) + ' <button class="link" data-act="renamePet" data-pet="' + p.id + '">改名</button></h2><p class="muted">' + sp.name + " · 第 " + petAge(p) + ' 天 · <b class="' + (petLow(p) ? "bad" : "") + '">' + petLabel(p) + "</b></p>" + careBar("饱腹", p.food, p.sick) + careBar("心情", p.mood, p.sick) + '<div class="use-row">' + careButtons(p) + '<button class="link" data-act="openShelf" data-shelf="petcare">' + (p.sick && !bagHas("medicine") ? "买药" : "买吃的和玩具") + '</button></div><div class="actions">' + (main ? '<span class="tag">正在陪你背单词</span>' : '<button class="btn small ghost" data-act="setMain" data-pet="' + p.id + '">陪我背单词</button>') + (own.length ? '<button class="btn small ghost" data-act="wardPet" data-pet="' + p.id + '">' + (ward ? "收起衣柜" : "换装扮") + "</button>" : "") + "</div></div></div>" + (ward ? '<div class="shop-grid ward">' + own.map((it) => {
      const on = p.wear[it.slot] === it.id;
      return '<button class="shop-item' + (on ? " on" : "") + '" data-act="wearPet" data-pet="' + p.id + '" data-id="' + it.id + '">' + pxImg(petCanvas("idle", Object.assign({}, p, { wear: Object.assign({}, p.wear, { [it.slot]: it.id }) })), 2) + '<span class="si-name">' + it.name + '</span><span class="si-meta">' + (on ? "戴着" : "戴上") + "</span></button>";
    }).join("") + "</div>" : "") + "</section>";
  }
  function pondHtml() {
    const fish = fishList();
    if (!fish.length) return "";
    return '<section class="panel pond-card"><div class="head-row"><h2 class="h2">观赏鱼</h2><span class="muted">' + fish.length + ' 条</span></div><div class="fish-grid">' + fish.map((f) => '<div class="fish' + (f.sick ? " sick" : "") + '">' + pxImg(petCanvas("idle", f), 3) + "<div><b>" + esc(f.name) + '</b> <button class="link" data-act="renamePet" data-pet="' + f.id + '">改名</button><span class="muted small">' + SPECIES.get(f.sp).name + " · " + petLabel(f) + "</span>" + careBar("饱腹", f.food, f.sick) + careBar("心情", f.mood, f.sick) + (f.sick ? '<div class="use-row">' + careButtons(f) + "</div>" : "") + "</div></div>").join("") + '</div><div class="actions">' + (bagHas("fishfood") ? '<button class="btn small" data-act="feedFish">撒鱼食 · 还有 ' + state.world.bag.fishfood + " 份</button>" : '<button class="btn small ghost" data-act="openShelf" data-shelf="petcare">买鱼食</button>') + "</div></section>";
  }
  function petStatusHtml() {
    const land = landPets();
    let html = "";
    if (!state.pets.length) html += '<section class="panel empty-pet"><p class="muted">还没有宠物</p><button class="btn" data-act="openShop" data-tab="adopt">去宠物店</button></section>';
    html += land.map(petCardHtml).join("") + pondHtml();
    if (state.petGraves.length)
      html += '<section class="panel memorial"><h2 class="h2">纪念</h2><div class="graves">' + state.petGraves.slice(-12).reverse().map((g) => '<div class="grave">' + pxImg(ART.pet(g.sp, "sleep"), 2, "gray") + "<span><b>" + esc(g.name) + '</b><span class="muted small">陪了你 ' + (g.died - g.born + 1) + " 天</span></span></div>").join("") + "</div></section>";
    return html;
  }
  var PET_KINDS = [
    ["all", "全部"],
    ["dog", "猫狗"],
    ["small", "小动物"],
    ["bird", "鸟类"],
    ["wild", "野生动物"],
    ["fish", "观赏鱼"]
  ];
  function adoptHtml() {
    const kind = PET_KINDS.some((k) => k[0] === ui.petKind) ? ui.petKind : "all";
    const list = PETS2.species.filter((sp2) => kind === "all" || sp2.kind === kind);
    const pick = list.some((sp2) => sp2.id === ui.petPick) ? ui.petPick : list[0].id;
    const sp = SPECIES.get(pick);
    const have = state.pets.filter((p) => p.sp === pick).length;
    const cards = list.map((x) => '<button class="pet-card' + (x.id === pick ? " on" : "") + '" data-act="petPick" data-id="' + x.id + '">' + pxImg(ART.pet(x.id, "idle"), 2) + '<span class="pc-name">' + x.name + '</span><span class="pc-meta">' + fmt(x.price) + " 金币</span></button>").join("");
    return '<div class="shelf-tabs">' + PET_KINDS.map(([id, l]) => '<button class="chip' + (id === kind ? " on" : "") + '" data-act="adoptKind" data-kind="' + id + '">' + l + "</button>").join("") + '</div><section class="panel adopt"><div class="pet-grid">' + cards + '</div><div class="adopt-pick">' + pxImg(ART.pet(pick, "happy"), 3) + "<div><b>" + sp.name + '</b><span class="muted small">' + fmt(sp.price) + " 金币" + (have ? " · 已经有 " + have + (sp.fish ? " 条" : " 只") : "") + '</span></div><button class="btn" data-act="buyPet" data-id="' + pick + '"' + (state.points.bal >= sp.price ? "" : " disabled") + ">买一只</button></div></section>";
  }
  function petPreview(it) {
    const p = mainPet() || { sp: "crab", wear: {} };
    return petCanvas("idle", Object.assign({}, p, { wear: Object.assign({}, p.wear, { [it.slot]: it.id }) }));
  }
  function shelfPreview(it) {
    if (it.shelf === "look") {
      const look = Object.assign(avatarLook(), it.look);
      return pxImg(ART.avatar(look, "idle", "front"), 2);
    }
    if (it.shelf === "petlook") return pxImg(petPreview(it), 2);
    if (it.decor) {
      const c = ART.decor(it.decor);
      return pxImg(c, c.width > 32 ? 1 : 2);
    }
    if (it.plant) {
      const [k, sp] = it.plant;
      if (k === "tree") return pxImg(ART.tree(sp, 4), 1);
      return pxImg(k === "flower" ? ART.flower(sp, 3) : k === "grass" ? ART.grass(sp, 2) : ART.shrub(sp, 2), 3);
    }
    return pxImg(itemIcon(it), 3);
  }
  function shelfItemHtml(it) {
    let meta;
    let act;
    if (it.shelf === "look") {
      const owned = state.world.owned.includes(it.id);
      const on = state.world.look[it.slot] === it.id;
      meta = on ? "穿着" : owned ? "已拥有" : fmt(it.price) + " 金币";
      act = '<button class="btn small' + (on ? " ghost" : "") + '" data-act="lookItem" data-id="' + it.id + '">' + (on ? "脱下" : owned ? "穿上" : "购买") + "</button>";
    } else if (it.shelf === "petlook") {
      const owned = state.petWardrobe.includes(it.id);
      meta = owned ? "已拥有" : fmt(it.price) + " 金币";
      act = owned ? '<button class="btn small ghost" data-act="openShop" data-tab="status">去换</button>' : '<button class="btn small" data-act="buyPetLook" data-id="' + it.id + '">购买</button>';
    } else if (it.once) {
      const owned = !!state.world[it.id];
      meta = owned ? "已拥有" : '<span class="pts-ic"></span>' + fmt(it.price);
      act = owned ? "" : '<button class="btn small" data-act="buyItem" data-id="' + it.id + '">购买</button>';
    } else {
      const n = state.world.bag[it.id] || 0;
      meta = '<span class="pts-ic"></span>' + fmt(it.price) + (n ? '<span class="have">有 ' + n + "</span>" : "");
      act = '<button class="btn small" data-act="buyItem" data-id="' + it.id + '">购买</button>';
    }
    const note = itemNote(it);
    return '<div class="shop-item"><div class="si-pic">' + shelfPreview(it) + '</div><span class="si-name">' + esc(it.name) + "</span>" + (note ? '<span class="si-note">' + note + "</span>" : "") + '<span class="si-meta">' + meta + "</span>" + act + "</div>";
  }
  function landHtml() {
    const lv = state.world.land || 0;
    const next = LANDS[lv + 1];
    if (!next) return '<div class="shop-item land"><div class="si-pic">' + pxImg(ART.icon("shovel"), 3) + '</div><span class="si-name">花园已经扩建到最大</span><span class="si-meta">' + LANDS[lv].w + " × " + (LANDS[lv].h + OY) + " 格</span></div>";
    return '<div class="shop-item land"><div class="si-pic">' + pxImg(ART.icon("shovel"), 3) + '</div><span class="si-name">扩建花园</span><span class="si-note">' + LANDS[lv].w + " × " + (LANDS[lv].h + OY) + " → " + next.w + " × " + (next.h + OY) + ' 格</span><span class="si-meta">' + costText(next) + "</span>" + shortNote(next) + '<button class="btn small" data-act="buyLand">扩建</button></div>';
  }
  function shortNote(need) {
    const s = matsShort(need);
    return s.length ? '<span class="si-note short">还差' + s.join("、") + "</span>" : "";
  }
  function houseHtml() {
    const lv = houseLevel();
    const next = HOUSES[lv + 1];
    const pic = (h) => pxImg(ART.decor(h.sprite), 0.75);
    if (!next) return '<div class="shop-item land"><div class="si-pic">' + pic(HOUSES[lv]) + '</div><span class="si-name">' + HOUSES[lv].name + '</span><span class="si-meta">已经是最大的房子</span></div>';
    return '<div class="shop-item land"><div class="si-pic">' + pic(next) + '</div><span class="si-name">扩建成' + next.name + '</span><span class="si-note">屋里 ' + next.room[0] + " × " + next.room[1] + ' 格</span><span class="si-meta">' + costText(next) + "</span>" + shortNote(next) + '<button class="btn small" data-act="buyHouse">扩建</button></div>';
  }
  function shelfHtml(tab) {
    const ids = SHOP_TABS.find((t) => t[0] === tab)[2];
    const cur = ids.includes(ui.shelf) ? ui.shelf : ids[0];
    const name = (id) => id === "build" ? "扩建" : SHELVES.find((s) => s.id === id).name;
    const items = cur === "build" ? [] : SHELVES.find((s) => s.id === cur).items.map((it) => ITEMS.get(it.id));
    return '<div class="shelf-tabs">' + ids.map((id) => '<button class="chip' + (id === cur ? " on" : "") + '" data-act="openShelf" data-shelf="' + id + '">' + name(id) + "</button>").join("") + '</div><section class="panel store"><div class="shop-grid">' + (cur === "build" ? landHtml() + houseHtml() : items.map(shelfItemHtml).join("")) + "</div></section>";
  }
  function rulesHtml() {
    return '<section class="panel rules"><h2 class="h2">金币</h2><ul><li>答对一题 +' + PTS.right + "，每连对 5 题再 +" + PTS.combo + "</li><li>背完一组新词：组里有几个词就 +几；全对再 +" + PTS.perfect + "</li><li>学完一组词根 +" + PTS.rootDone + "，全对再 +" + PTS.rootPerfect + "</li><li>每日新词目标 +" + PTS.goal + "，每日词根目标 +" + PTS.rootGoal + "，每日挑战和成就另有奖励</li><li>以前错过的词再答错 −" + PTS.again + '</li></ul><h2 class="h2" style="margin-top:22px">宠物</h2><ul><li>饱腹每天 −' + CARE.food + "，心情每天 −" + CARE.mood + "；喂饭、玩具、在花园玩、陪你背单词、摸摸它都会回升</li><li>饱腹或心情掉到 0 会生病，吃药才能好；生病 " + CARE.sickDays + ' 天没吃药就会死</li></ul><h2 class="h2" style="margin-top:22px">花园</h2><ul><li>先买一把锄头开垦草地，开垦一格 ' + TILL.cost + " 金币、1 点体力；种子要种在开垦过的地上，草坪种子能把空地变回草地</li><li>体力每天 " + TILL.max + " 点，第二天回满；背完一组单词 +" + TILL.word + "，学完一组词根 +" + TILL.root + "</li><li>买种子种下，每天浇一次水长一阶，施一次肥也长一阶</li><li>树从种子长成大树要 4 阶，花 3 阶，草和灌木 2 阶</li></ul></section>";
  }
  VIEWS.shop = function() {
    petsTick();
    const tab = shopTab();
    const body = { status: petStatusHtml, adopt: adoptHtml, goals: () => challengesHtml(false) + achievementsHtml(), rules: rulesHtml }[tab] ? { status: petStatusHtml, adopt: adoptHtml, goals: () => challengesHtml(false) + achievementsHtml(), rules: rulesHtml }[tab]() : shelfHtml(tab);
    return '<main class="page"><h1 class="h1">商店</h1>' + pointsPanelHtml() + '<div class="shop-tabs">' + SHOP_TABS.map(([id, label]) => '<button class="chip' + (id === tab ? " on" : "") + '" data-act="openShop" data-tab="' + id + '">' + label + "</button>").join("") + "</div>" + body + "</main>";
  };
  function gardenCardHtml() {
    const pets = state.pets.filter((p) => SPECIES.has(p.sp));
    const need = pets.filter(petLow);
    const thirsty = state.world.plants.filter((pl) => plantStage(pl) < plantMax(pl) && !wateredToday(pl)).length;
    const pics = landPets().slice(0, 4).map((p) => pxImg(petCanvas(p.sick ? "sick" : "idle", p), 2)).join("");
    let h;
    let sub;
    if (!pets.length) {
      h = "还没有宠物";
      sub = "";
    } else {
      h = need.length ? need.map((p) => p.name + petLabel(p)).slice(0, 3).join("，") : pets.length + " 只宠物都很好";
      sub = thirsty ? thirsty + " 株今天还没浇水" : "";
    }
    return '<section class="panel gcard"><div class="gc-pets">' + (pics || pxImg(ART.tree("oak", 4), 1)) + '</div><div class="gc-main"><p class="label">花园</p><h2 class="h2' + (need.length ? " bad" : "") + '">' + esc(h) + "</h2>" + (sub ? '<p class="muted">' + sub + "</p>" : "") + '<div class="actions"><button class="btn ghost" data-act="nav" data-view="garden">去花园</button>' + (pets.length ? '<button class="btn ghost" data-act="openShop" data-tab="status">我的宠物</button>' : '<button class="btn ghost" data-act="openShop" data-tab="adopt">宠物店</button>') + "</div></div></section>";
  }

  // src/world/migrate.ts
  function migrate() {
    const W = state.world;
    const wasOld = !!(W.layout || W.v5 || W.migrated);
    if (W.house == null) {
      W.house = !W.layout && (W.v5 || W.migrated) ? 1 : 0;
      if (W.house === 1) for (const d of W.room) d.x += 1;
    }
    if (!W.layout) {
      W.layout = 3;
      W.land = [0, 2, 4, 6][Math.max(0, Math.min(3, W.land || 0))];
      const h = Math.max(0, Math.min(3, W.house || 0));
      W.house = [0, 2, 4, 8][h];
      const dx = (HOUSES[W.house].room[0] - [16, 20, 24, 28][h]) / 2;
      for (const d of W.room) d.x += dx;
      W.layout = 4;
    } else if (W.layout === 3) {
      W.layout = 4;
      for (const d of W.room) d.x += 4;
    }
    layoutGarden();
    const old = state.pet;
    let refund = 0;
    const notes = [];
    if (old) {
      for (const id of (old.owned || []).slice()) {
        if (!PETS2.refund[id]) continue;
        refund += PETS2.refund[id];
        old.owned = old.owned.filter((x) => x !== id);
      }
    }
    if (!W.migrated) {
      W.migrated = 1;
      const garden = state.garden || {};
      const wk = weekStart();
      W.week = W.week || wk;
      for (const day in garden) {
        if (!Array.isArray(garden[day])) continue;
        const n = Math.round((/* @__PURE__ */ new Date(day + "T00:00:00Z")).getTime() / 864e5);
        const ws = weekStart(n);
        for (const [sp, ok] of garden[day]) {
          if (!ok) continue;
          if (ws === wk) W.plants.push({ k: "tree", sp, ok: 1, x: -1, y: -1, w: [], f: 0 });
          else {
            const h = W.hist[ws] || (W.hist[ws] = { t: 0, y: 0, f: 0, s: 0, g: 0, p: [], dc: [] });
            h.t++;
          }
        }
      }
      delete state.garden;
    }
    if (!W.v5) {
      W.v5 = 1;
      if (old) {
        if (old.status === "alive" && SPECIES.has(old.species)) {
          const p = newPet(old.species, old.name);
          p.born = old.born || dayNum();
          p.mood = old.mood == null ? CARE.start : old.mood;
          p.sick = !!old.sick;
          p.sickSince = old.sickSince || 0;
          p.wear = {};
          for (const slot2 of ["hat", "color"]) if (old.wear && old.wear[slot2]) p.wear[slot2] = old.wear[slot2];
          state.petMain = p.id;
          bagAdd("food.kibble", 6);
          notes.push("送你 6 份宠物粮");
        }
        for (const g of old.graves || []) state.petGraves.push({ name: g.name, sp: g.species, born: g.born, died: g.died });
        state.petWardrobe = (old.owned || []).filter((id) => ITEMS.has(id));
        const SP_OLD = { cat: 200, hamster: 200, shiba: 300, rabbit: 300, duck: 400, penguin: 500, frog: 500, fox: 600 };
        for (const id of old.unlocked || []) refund += SP_OLD[id] || 0;
      }
      const TR_OLD = { pine: 150, cactus: 200, bamboo: 250, sakura: 300, maple: 300, ginkgo: 400, palm: 400, apple: 500 };
      if (state.forest) for (const id of state.forest.unlocked || []) refund += TR_OLD[id] || 0;
      W.plants = W.plants.filter((pl) => pl.k !== "tree" || pl.ok !== 0);
      for (const pl of W.plants) {
        if (pl.k === "tree" && pl.ok != null) {
          pl.b = 4;
          delete pl.ok;
          delete pl.min;
        }
      }
      W.grown = { t: 0, f: 0 };
      for (const k in W.hist) {
        W.grown.t += W.hist[k].t || 0;
        W.grown.f += W.hist[k].f || 0;
      }
      for (const pl of W.plants) if (plantStage(pl) >= plantMax(pl)) W.grown[pl.k === "tree" ? "t" : "f"] += pl.k === "tree" || pl.k === "flower" ? 1 : 0;
      try {
        localStorage.removeItem("margin.focus");
      } catch (e) {
      }
      delete state.pet;
      delete state.forest;
    }
    let slot = 0;
    for (const pl of W.plants)
      if (pl.x < 0) {
        pl.x = 4 + slot % 4 * 3;
        pl.y = 5 + Math.floor(slot / 4) * 2;
        slot++;
      }
    relocate();
    roomRelocate();
    if (!W.debris) {
      W.debris = [];
      W.debrisDay = dayNum();
      if (wasOld) {
        const ow = 48 + 4 * (W.land || 0);
        const oh = 36 + 3 * (W.land || 0) + OY;
        seedDebris((x, y) => x >= ow - GB || y >= oh - GB);
      } else seedDebris(() => true);
    }
    if (!W.gift) {
      W.gift = 1;
      bagAdd("water", 5);
      bagAdd("seed.tulip", 2);
      bagAdd("seed.daisy", 2);
      bagAdd("treat", 1);
    }
    if (refund) {
      state.points.bal += refund;
      notes.push("退回 " + fmt(refund) + " 金币");
    }
    if (notes.length) setTimeout(() => toast(notes.join("；")), 1200);
    save();
  }

  // src/world/terrain.ts
  var scene = null;
  function setScene(v) {
    scene = v;
  }
  var terrainCache = { key: "", canvas: null };
  var roomCanvas = null;
  function setRoomCanvas(v) {
    roomCanvas = v;
  }
  function gardenTerrain(plants) {
    const soil = /* @__PURE__ */ new Set();
    const wet = /* @__PURE__ */ new Set();
    const today = dayNum();
    for (const k in state.world.till || {}) soil.add(k);
    for (const pl of plants) {
      if (pl.x < 0 || !(pl.w || []).includes(today)) continue;
      const [w, h] = plantSize(pl);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const k = pl.x + i + "," + (pl.y + j);
          if (soil.delete(k)) wet.add(k);
        }
    }
    const key = [...soil].sort().join(";") + "|" + [...wet].sort().join(";");
    if (plants === state.world.plants && terrainCache.key === key && terrainCache.canvas) return terrainCache.canvas;
    const c = ART.terrain({ w: GW, h: GH, path: GPATH, soil, wet, water: GPOND, pondFn: (x, y) => ART.pondInside(x, y - OY), exits: GEXIT, border: GB, seed: 11 });
    if (plants === state.world.plants) {
      terrainCache.key = key;
      terrainCache.canvas = c;
    }
    return c;
  }
  var ringCache = null;
  function forestRing2(out) {
    const m = Math.ceil((out + 72) / 64) * 64;
    const key = GW + "x" + GH + ":" + [...GEXIT].join(";");
    if (!ringCache || ringCache.key !== key || ringCache.m < m) ringCache = Object.assign(ART.forestRing({ w: GW, h: GH, m, exits: GEXIT, border: GB, seed: 11 }), { key, m });
    return ringCache;
  }
  function roomTerrain() {
    const key = RW + "x" + RH + ":" + curFloor();
    if (!roomCanvas || roomCanvas.key !== key) roomCanvas = Object.assign(ART.room({ w: RW, h: RH, door: curFloor() === 1 ? RDOOR : null, seed: 7 + curFloor() }), { key });
    return roomCanvas;
  }
  function roomOcc(skip, f) {
    const occ = /* @__PURE__ */ new Map();
    for (const d of floorItems(f || curFloor())) {
      if (d === skip) continue;
      const [w, h] = decorSize(d.id);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + "," + (d.y + j), d);
    }
    return occ;
  }
  function adoptState(s, fresh) {
    setState(s);
    if (fresh) migrate();
    else layoutGarden();
    terrainCache.key = "";
    roomCanvas = null;
    if (scene) scene.stop();
    scene = null;
  }
  function roomRelocate() {
    for (let f = 1; f <= 3; f++) {
      if (f > floorCount()) {
        for (const d of floorItems(f)) bagAdd(ITEM_OF_DECOR.get(d.id) || "furn." + d.id, 1);
        setFloorItems(f, []);
        continue;
      }
      setFloorItems(
        f,
        floorItems(f).filter((d) => {
          if (roomFree(d.id, d.x, d.y, roomOcc(d, f), f)) return true;
          const occ = roomOcc(d, f);
          let best = null;
          let bestD = Infinity;
          for (let y = 1; y < RH; y++)
            for (let x = 0; x < RW; x++) {
              const dd = Math.hypot(x - d.x, y - d.y);
              if (dd < bestD && roomFree(d.id, x, y, occ, f)) {
                best = [x, y];
                bestD = dd;
              }
            }
          if (best) {
            d.x = best[0];
            d.y = best[1];
            return true;
          }
          bagAdd(ITEM_OF_DECOR.get(d.id) || "furn." + d.id, 1);
          return false;
        })
      );
    }
  }
  function roomFree(id, x, y, occ, f) {
    f = f || curFloor();
    occ = occ || roomOcc(null, f);
    const D = ART.DECOR[id];
    const [w, h] = decorSize(id);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (tx < 0 || tx >= RW) return false;
        if (D && D.wall ? ty !== 1 : ty < 2 || ty >= RH) return false;
        if (!D.wall && f === 1 && ty === RH - 1 && RDOOR.includes(tx)) return false;
        if (onStairs(f, tx, ty)) return false;
        if (occ.has(tx + "," + ty)) return false;
      }
    return true;
  }
  function objAt(img, tx, ty, tw, th) {
    const base = (ty + th) * TILE;
    return { img, x: tx * TILE + (tw * TILE - img.width) / 2, y: base - img.height, base };
  }
  function gardenObjects(plants, decor2, live) {
    const out = [];
    out.push(objAt(ART.decor(HOUSE.sprite), HOUSE.x, HOUSE.y, HOUSE.w, HOUSE.h));
    for (const d of GFIXED) {
      const [w, h] = decorSize(d.id);
      out.push(objAt(ART.decor(d.id), d.x, d.y, w, h));
    }
    for (const d of decor2) {
      const img = ART.decor(d.id);
      if (!img) continue;
      const [w, h] = decorSize(d.id);
      const o = objAt(img, d.x, d.y, w, h);
      if (ART.DECOR[d.id] && ART.DECOR[d.id].flat) o.base = -1;
      out.push(o);
    }
    for (const d of live ? state.world.debris || [] : []) {
      const D = DEBRIS[d.k];
      const o = objAt(debrisSprite(d), d.x, d.y, D.w, D.h);
      if (d.k === "tree") o.y += 2;
      out.push(o);
    }
    for (const pl of plants) {
      const k = pl.k || pl[0];
      const sp = pl.sp || pl[1];
      const x = pl.x != null ? pl.x : pl[2];
      const y = pl.y != null ? pl.y : pl[3];
      if (x < 0) continue;
      const st = pl.k ? plantStage(pl) : pl[4];
      let img;
      if (k === "tree") img = ART.tree(sp, st);
      else if (k === "flower") img = ART.flower(sp, st);
      else if (k === "grass") img = ART.grass(sp, st);
      else img = ART.shrub(sp, st);
      const o = objAt(img, x, y, k === "tree" ? 2 : 1, 1);
      if (k === "tree" && st >= 3) o.y += 2;
      o.plant = live ? pl : null;
      out.push(o);
    }
    return out;
  }

  // src/world/roam.ts
  var PET_W = 64;
  var PET_H = 64;
  var petLayer = document.createElement("div");
  var roam = { x: null, y: null, tx: 0, ty: 0, moving: false, last: 0, lastAct: Date.now(), sleeping: false, bubbleTimer: 0, careAt: 0, frame: "idle", walkT: 0, talking: false };
  function petShown() {
    return petAlive() && state.settings.petRoam !== false && ui.view !== "garden" && ui.view !== "room" && !onPetTab();
  }
  function petEl() {
    return petLayer.querySelector(".pet");
  }
  function clampPet() {
    roam.tx = Math.max(6, Math.min(window.innerWidth - PET_W - 6, roam.tx));
    roam.ty = Math.max(8, Math.min(window.innerHeight - PET_H - 6, roam.ty));
  }
  function placePet() {
    const el = petEl();
    if (el) el.style.transform = "translate(" + Math.round(roam.x) + "px," + Math.round(roam.y) + "px)";
  }
  function petFrameNow() {
    if (petSick()) return "sick";
    if (roam.sleeping) return "sleep";
    if (roam.moving) return roam.walkT % 2 ? "walk2" : "walk1";
    if (roam.talking) return "happy";
    return roam.frame === "blink" ? "blink" : "idle";
  }
  function setPetFrame() {
    const img = petLayer.querySelector(".pet-img");
    if (!img) return;
    const f = petFrameNow();
    if (img.dataset.f === f) return;
    img.dataset.f = f;
    img.src = ART.url(petCanvas(f));
  }
  function renderPet() {
    if (!petShown()) {
      petLayer.hidden = true;
      return;
    }
    petLayer.hidden = false;
    const mp = mainPet();
    const key = mp.id + "|" + mp.sp + "|" + JSON.stringify(mp.wear);
    if (petLayer.dataset.key !== key || !petEl()) {
      petLayer.innerHTML = '<div class="pet" title="' + esc(mp.name) + '"><div class="pet-bubble"></div><div class="pet-hop"><img class="pet-img px" width="' + PET_W + '" height="' + PET_H + '" alt="" draggable="false"></div></div>';
      petLayer.dataset.key = key;
    }
    if (roam.x === null) {
      roam.x = roam.tx = window.innerWidth - PET_W - 100;
      roam.y = roam.ty = window.innerHeight - PET_H - 18;
    }
    placePet();
    setPetFrame();
  }
  function walkTo(cx, cy) {
    roam.tx = cx - PET_W / 2;
    roam.ty = cy - PET_H + 6;
    clampPet();
    if (!petEl()) return;
    wakePet(false);
    if (!roam.moving) {
      roam.moving = true;
      roam.last = performance.now();
      requestAnimationFrame(stepPet);
    }
  }
  function stepPet(t) {
    if (!petEl()) {
      roam.moving = false;
      return;
    }
    const dt = Math.min(0.05, (t - roam.last) / 1e3);
    roam.last = t;
    roam.walkT = Math.floor(t / 140);
    const dx = roam.tx - roam.x;
    const dy = roam.ty - roam.y;
    const dist = Math.hypot(dx, dy);
    const v = (petSick() ? 90 : 200) * dt;
    if (dist <= v) {
      roam.x = roam.tx;
      roam.y = roam.ty;
      roam.moving = false;
      placePet();
      setPetFrame();
      return;
    }
    roam.x += dx / dist * v;
    roam.y += dy / dist * v;
    placePet();
    setPetFrame();
    requestAnimationFrame(stepPet);
  }
  function petSay(kind, vars) {
    const text = petLine(kind, vars);
    if (!text) return;
    let box = null;
    if (onPetTab()) box = document.querySelector(".pet-stage");
    else if (petShown()) box = petEl();
    else if ((ui.view === "garden" || ui.view === "room") && scene) {
      scene.say(text);
      return;
    }
    if (!box) return;
    const b = box.querySelector(".pet-bubble");
    if (!b) return;
    b.textContent = text;
    b.classList.remove("show");
    b.style.setProperty("--dx", "0px");
    void b.offsetWidth;
    const r = b.getBoundingClientRect();
    const dx = r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : r.left < 8 ? 8 - r.left : 0;
    b.style.setProperty("--dx", Math.round(dx) + "px");
    b.classList.add("show");
    roam.talking = true;
    setPetFrame();
    clearTimeout(roam.bubbleTimer);
    roam.bubbleTimer = setTimeout(() => {
      b.classList.remove("show");
      roam.talking = false;
      setPetFrame();
    }, 3600);
  }
  function hopPet(box) {
    const h = box && box.querySelector(".pet-hop");
    if (!h) return;
    h.classList.remove("hop");
    void h.offsetWidth;
    h.classList.add("hop");
    const heart = document.createElement("span");
    heart.className = "pet-heart";
    heart.textContent = "♥";
    box.appendChild(heart);
    setTimeout(() => heart.remove(), 900);
  }
  function wakePet(say) {
    roam.lastAct = Date.now();
    if (!roam.sleeping) return;
    roam.sleeping = false;
    setPetFrame();
    if (say) petSay("wake");
  }
  function floatPts(text, neg) {
    let x;
    let y;
    if (petShown() && petEl()) {
      x = roam.x + PET_W / 2;
      y = roam.y;
    } else {
      const chip = document.querySelector(".pts");
      if (!chip) return;
      const r = chip.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.bottom + 4;
    }
    const s = document.createElement("span");
    s.className = "pts-float" + (neg ? " neg" : "");
    s.textContent = text;
    s.style.left = x + "px";
    s.style.top = y + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
  function blankClick(ev) {
    const t = ev.target;
    if (!(t instanceof Element)) return false;
    if (t.closest("a, button, input, textarea, select, label, kbd, canvas, [data-act], [data-bag], .opt, .list-row, .chip, .modal, .toast, .hm, .update-bar, .pet-stage, .pet-card, .shop-item, .bag")) return false;
    const sel = window.getSelection && window.getSelection();
    return !(sel && String(sel).length);
  }
  function petJoinStudy() {
    if (!petShown()) return;
    setTimeout(() => {
      if (!petEl()) return;
      const card = document.querySelector(".practice .card, .rq .card");
      const r = card ? card.getBoundingClientRect() : null;
      const x = r && r.right + 70 < window.innerWidth ? r.right + 44 : window.innerWidth - 50;
      const y = r ? r.bottom - 4 : window.innerHeight - 30;
      walkTo(x, y);
      if (Math.random() < 0.5) setTimeout(() => petSay("study"), 900);
    }, 250);
  }
  function initRoam() {
    petLayer.className = "pet-layer";
    document.body.appendChild(petLayer);
    document.addEventListener("click", (ev) => {
      if (document.querySelector(".modal")) return;
      const onPet = ev.target instanceof Element && ev.target.closest(".pet");
      if (onPet) {
        const was = roam.sleeping;
        wakePet(false);
        hopPet(onPet);
        if (moodUp(1, "petMood", CARE.petCap)) save();
        petSay(was ? "wake" : petSick() ? "sick" : "click");
        return;
      }
      const stage = ev.target instanceof Element && ev.target.closest(".pet-stage .pet-hop");
      if (stage) {
        const box = stage.closest(".pet-stage");
        const p = petById(+box.dataset.pet);
        hopPet(box);
        if (p && careUp(p, "mood", 1, "petMood", CARE.petCap)) save();
        const text = petLine(p && p.sick ? "sick" : "click", null, p);
        const b = box.querySelector(".pet-bubble");
        if (b && text) {
          b.textContent = text;
          b.classList.remove("show");
          void b.offsetWidth;
          b.classList.add("show");
          clearTimeout(box._t);
          box._t = setTimeout(() => b.classList.remove("show"), 3200);
        }
        return;
      }
      roam.lastAct = Date.now();
      if (!petShown() || !blankClick(ev)) return;
      walkTo(ev.clientX, ev.clientY);
      if (Math.random() < 0.15) petSay("walk");
      const input = document.querySelector(".practice .ans:not([readonly]), #answer:not([readonly]), #rq-answer:not([readonly])");
      if (input) input.focus({ preventScroll: true });
    });
    document.addEventListener("keydown", () => wakePet(false), true);
    window.addEventListener("resize", () => {
      if (scene) scene.fit();
      if (roam.x === null || window.innerWidth < 200 || window.innerHeight < 200) return;
      roam.tx = roam.x;
      roam.ty = roam.y;
      clampPet();
      roam.x = roam.tx;
      roam.y = roam.ty;
      placePet();
    });
    setInterval(() => {
      if (!petShown() || roam.moving) return;
      if (!petEl()) return;
      const idle = Date.now() - roam.lastAct;
      if (idle > 9e4) {
        if (!roam.sleeping) {
          roam.sleeping = true;
          setPetFrame();
          petSay("sleep");
        }
        return;
      }
      if (Math.random() < 0.12) {
        roam.frame = "blink";
        setPetFrame();
        setTimeout(() => {
          roam.frame = "idle";
          setPetFrame();
        }, 140);
      }
      if (petNeedsCare() && Date.now() - roam.careAt > 10 * 6e4 && ui.view !== "practice" && ui.view !== "rootquiz") {
        roam.careAt = Date.now();
        const mp = mainPet();
        const other = state.pets.find((p) => p !== mp && SPECIES.has(p.sp) && petLow(p));
        if (petLow(mp)) petSay(mp.sick ? "sick" : mp.food < 30 ? "hungry" : "low");
        else if (other) petSay(other.sick ? "otherSick" : "otherLow", { n: other.name });
        return;
      }
      if (petSick()) return;
      const r = Math.random();
      if (r < 0.06) {
        roam.tx = roam.x + (Math.random() - 0.5) * 240;
        roam.ty = roam.y + (Math.random() - 0.5) * 80;
      } else if (r < 0.08) {
        roam.tx = Math.random() * window.innerWidth;
        roam.ty = window.innerHeight * (0.35 + Math.random() * 0.6);
      } else return;
      clampPet();
      roam.moving = true;
      roam.last = performance.now();
      requestAnimationFrame(stepPet);
    }, 1e3);
  }

  // src/app/roots/quiz.ts
  var ROOT_STAGES = ["r2m", "m2r", "fill"];
  var ROOT_MODES = {
    r2m: { name: "根 → 义", desc: "看词根，选意思" },
    m2r: { name: "义 → 根", desc: "看意思，选词根" },
    fill: { name: "填词根", desc: "在单词里填出词根" }
  };
  var ROOT_GROUP = 5;
  function rootForms(r) {
    return r.forms.map((f) => r.type === "prefix" ? f + "-" : r.type === "suffix" ? "-" + f : f).join(" / ");
  }
  function rootBook() {
    const s = state.settings;
    if (s.rootBook !== "all" && (!bookExists(s.rootBook) || s.rootBook === WRONG_BOOK || s.rootBook === REVIEW_BOOK)) s.rootBook = "all";
    return s.rootBook;
  }
  function rootBookName(id) {
    return id === "all" ? "全部词库" : bookName(id);
  }
  var rootIdxCache = {};
  function rootIndex(bookId) {
    const custom = bookId !== "all" && !isBuiltin(bookId);
    if (!custom && rootIdxCache[bookId]) return rootIdxCache[bookId];
    const entries = bookId === "all" ? EXAM_WORDS.concat(...TERM_BOOKS.map((b) => TERM_WORDS[b.id])) : bookEntries(bookId);
    const idx = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    for (const e of entries) {
      const k = keyOf(e.w);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const toks = k.split(/[^a-z]+/).filter(Boolean);
      const got = /* @__PURE__ */ new Set();
      for (const t of toks) {
        const p = partsOf(t);
        if (!p) continue;
        const exact = toks.length === 1 && p.w.toLowerCase() === t;
        for (const l of p.links) {
          if (got.has(l.id)) continue;
          got.add(l.id);
          if (!idx.has(l.id)) idx.set(l.id, []);
          const fill = exact && l.at >= 0 && t.substr(l.at, l.form.length) === l.form && l.form.length >= 2 && l.form.length < t.length ? l : null;
          idx.get(l.id).push({ e, tok: t, p, fill });
        }
      }
    }
    if (!custom) rootIdxCache[bookId] = idx;
    return idx;
  }
  function rootsOfBook(bookId) {
    const idx = rootIndex(bookId);
    const n = (r) => (idx.get(r.id) || []).length;
    const list = bookId === "all" ? ROOTS.slice() : ROOTS.filter((r) => n(r) > 0);
    return list.sort((a, b) => n(b) - n(a));
  }
  function learnedRootsToday() {
    const today = dayNum();
    let n = 0;
    for (const id in state.rootStats) if (state.rootStats[id].f === today) n++;
    return n;
  }
  function rootReviewPool() {
    const today = dayNum();
    const done = (state.rootLog[todayKey()] || {}).rv || [];
    const doneSet = new Set(done);
    const ids = /* @__PURE__ */ new Set();
    for (const id in state.rootStats) if (state.rootStats[id].f === today - 1) ids.add(id);
    for (const id in state.rootWrong) ids.add(id);
    const remaining = [...ids].filter((id) => ROOT_BY_ID.has(id) && !doneSet.has(id)).map((id) => ROOT_BY_ID.get(id));
    return { done: done.length, remaining };
  }
  function markRootReviewed(id) {
    const k = todayKey();
    const day = state.rootLog[k] || (state.rootLog[k] = { rv: [] });
    if (!day.rv.includes(id)) day.rv.push(id);
  }
  function sameMeaning(a, b) {
    const ta = a.split(/[，,；;、\s]+/).filter(Boolean);
    const tb = new Set(b.split(/[，,；;、\s]+/).filter(Boolean));
    return ta.some((t) => tb.has(t));
  }
  function distractors(r) {
    const pick = [];
    const pools = [rootsOfBook(rootBook()).filter((x) => x.type === r.type), ROOTS.filter((x) => x.type === r.type), ROOTS];
    for (const pool of pools) {
      for (const x of shuffle(pool.slice())) {
        if (pick.length >= 3) break;
        if (x === r || sameMeaning(x.meaning, r.meaning) || pick.some((y) => y === x || sameMeaning(y.meaning, x.meaning))) continue;
        if (x.forms.some((f) => r.forms.includes(f))) continue;
        pick.push(x);
      }
      if (pick.length >= 3) break;
    }
    return pick;
  }
  function rootQuestion(x, mode) {
    const q = { r: x.r, x, mode };
    if (mode !== "fill") {
      const options = shuffle([x.r].concat(distractors(x.r)));
      q.options = options.map((o) => mode === "r2m" ? o.meaning : rootForms(o));
      q.correct = options.indexOf(x.r);
    }
    return q;
  }
  function startRootNew() {
    const book = rootBook();
    const left = state.settings.rootGoal - learnedRootsToday();
    const n = left > 0 ? Math.min(ROOT_GROUP, left) : ROOT_GROUP;
    const fresh = rootsOfBook(book).filter((r) => !state.rootStats[r.id]);
    if (!fresh.length) {
      toast("这个词库的词根都学过了，换一个词库吧");
      return;
    }
    startRootSession(fresh.slice(0, n), "new");
  }
  function startRootReview() {
    const { remaining } = rootReviewPool();
    if (!remaining.length) {
      toast("今天的词根复习做完了");
      return;
    }
    startRootSession(shuffle(remaining.slice()).slice(0, ROOT_GROUP), "review");
  }
  function startRootSession(roots, kind) {
    const book = rootBook();
    const idx = rootIndex(book);
    const pickFill = (list) => {
      const ok = (list || []).filter((w) => w.fill);
      return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
    };
    const items = roots.map((r) => {
      const words = idx.get(r.id) || [];
      return { r, words, target: pickFill(words) || (book === "all" ? null : pickFill(rootIndex("all").get(r.id))) };
    });
    ui.rs = { kind, book, roots: items, stage: -1, mode: null, items: [], idx: 0, pick: null, ok: null, results: [], stageResults: [], retries: [], repeat: false, attempt: 1, between: false, done: false, ended: false };
    beginRootStage(0);
    go("rootquiz");
    petJoinStudy();
  }
  function nextRootStage(rs, from) {
    for (let i = from; i < ROOT_STAGES.length; i++) {
      if (ROOT_STAGES[i] !== "fill" || rs.roots.some((x) => x.target)) return i;
    }
    return -1;
  }
  function beginRootStage(i) {
    const rs = ui.rs;
    const stage = nextRootStage(rs, i);
    if (stage < 0) return finishRootSession();
    const mode = ROOT_STAGES[stage];
    rs.attempt = stage === rs.stage ? rs.attempt + 1 : 1;
    rs.repeat = false;
    rs.stage = stage;
    rs.mode = mode;
    rs.items = shuffle(rs.roots.filter((x) => mode !== "fill" || x.target).map((x) => rootQuestion(x, mode)));
    rs.idx = 0;
    rs.pick = null;
    rs.results = [];
    rs.between = false;
  }
  function rootAnswer(n) {
    const rs = ui.rs;
    if (!rs || rs.between || rs.done || rs.pick !== null || rs.mode === "fill") return;
    const q = rs.items[rs.idx];
    if (n < 0 || n >= q.options.length) return;
    recordRoot(q, n === q.correct, n);
  }
  function recordRoot(q, ok, pick) {
    const rs = ui.rs;
    rs.pick = pick;
    rs.ok = ok;
    rs.results.push({ r: q.r, ok });
    const today = dayNum();
    const st = state.rootStats[q.r.id] || (state.rootStats[q.r.id] = { r: 0, w: 0, f: today });
    const again = !ok && st.w > 0;
    st[ok ? "r" : "w"]++;
    st.d = today;
    rewardAnswer(rs, ok, again);
    if (rs.kind === "review") markRootReviewed(q.r.id);
    save();
    render();
    if (q.mode === "fill") speak(q.x.target.tok);
  }
  function rootNextLabel(rs) {
    if (rs.kind === "new") {
      const left = state.settings.rootGoal - learnedRootsToday();
      return left > 0 ? "下一组新词根 · 今天还差 " + left + " 个" : "再学一组新词根";
    }
    const n = rootReviewPool().remaining.length;
    return n ? "继续复习 · 还剩 " + n + " 个" : "";
  }
  function rootNext() {
    const rs = ui.rs;
    if (!rs) return;
    if (rs.done) {
      if (rootNextLabel(rs)) {
        if (rs.kind === "new") startRootNew();
        else startRootReview();
      } else go("roots");
      return;
    }
    if (rs.between) {
      if (rs.repeat) {
        rs.retries.push({ stage: rs.stage, results: rs.results });
        rs.stageResults[rs.stage] = null;
        beginRootStage(rs.stage);
      } else beginRootStage(rs.stage + 1);
      render();
      return;
    }
    const q = rs.items[rs.idx];
    if (rs.pick === null) {
      if (rs.mode === "fill") {
        const input = document.getElementById("rq-answer");
        const v = (input ? input.value : "").trim().toLowerCase();
        recordRoot(q, v === q.x.target.fill.form, v);
      }
      return;
    }
    rs.idx++;
    rs.pick = null;
    if (rs.idx >= rs.items.length) {
      rs.stageResults[rs.stage] = rs.results;
      if (state.settings.forceAll && rs.results.some((x) => !x.ok)) {
        rs.repeat = true;
        rs.between = true;
        setTimeout(() => petSay("repeat"), 50);
      } else if (nextRootStage(rs, rs.stage + 1) >= 0) {
        rs.between = true;
        const allOk = rs.results.every((x) => x.ok);
        setTimeout(() => petSay(allOk ? "stagePerfect" : "stage"), 50);
      } else return finishRootSession();
    }
    render();
  }
  function finishRootSession() {
    const rs = ui.rs;
    rs.done = true;
    rs.between = false;
    const all = rootAll(rs);
    for (const x of rs.roots) {
      const mine = all.filter((y) => y.r === x.r);
      if (!mine.length) continue;
      if (mine.some((y) => !y.ok)) state.rootWrong[x.r.id] = Date.now();
      else if (!rs.ended) delete state.rootWrong[x.r.id];
    }
    if (all.length) rewardGroup("root", rs.roots.length, !rs.ended && all.every((y) => y.ok), rs.ended);
    save();
    if (!all.length) {
      ui.rs = null;
      go("roots");
      return;
    }
    render();
  }
  function rootAll(rs) {
    return [].concat(...rs.stageResults.filter(Boolean), ...rs.retries.map((x) => x.results));
  }
  function rootStageAll(rs, i) {
    return [].concat(...rs.retries.filter((x) => x.stage === i).map((x) => x.results), rs.stageResults[i] || []);
  }
  function quitRootSession() {
    const rs = ui.rs;
    if (!rs || rs.done) return go("roots");
    if (!rs.between) rs.stageResults[rs.stage] = rs.results;
    rs.ended = true;
    finishRootSession();
  }

  // src/world/coins.ts
  function pday() {
    const k = todayKey();
    return state.points.days[k] || (state.points.days[k] = { e: 0, x: 0, s: 0, groups: 0, perfect: 0, roots: 0, right: 0, combo: 0, ch: {} });
  }
  function levelOf(e) {
    let n = 1;
    while (50 * (n + 1) * n <= e) n++;
    return n;
  }
  var levelNeed = (n) => 50 * n * (n - 1);
  function gain(n) {
    if (n <= 0) return;
    const p = state.points;
    const before = levelOf(p.earned);
    p.bal += n;
    p.earned += n;
    pday().e += n;
    floatPts("+" + n, false);
    const chip = document.querySelector(".pts");
    if (chip && chip.lastChild) chip.lastChild.textContent = fmt(p.bal);
    const after2 = levelOf(p.earned);
    if (after2 > before) {
      petSay("level", { n: after2 });
      toast("升到 " + after2 + " 级了");
    }
  }
  function lose(n) {
    const p = state.points;
    n = Math.min(n, p.bal);
    if (n <= 0) return;
    p.bal -= n;
    pday().x += n;
    floatPts("−" + n, true);
  }
  function spend(n) {
    const p = state.points;
    if (p.bal < n) {
      toast("金币不够（还差 " + fmt(n - p.bal) + "）");
      return false;
    }
    p.bal -= n;
    pday().s += n;
    return true;
  }
  function wrongBefore(entry) {
    const s = state.stats[keyOf(entry.w)];
    if (!s) return false;
    return STAGES.some((m) => s[m] && s[m][1] > 0);
  }
  function rewardAnswer(holder, ok, repeatWrong) {
    const d = pday();
    if (ok) {
      gain(PTS.right);
      d.right++;
      moodUp(0.5, "studyMood", CARE.studyCap);
      holder.combo = (holder.combo || 0) + 1;
      d.combo = Math.max(d.combo, holder.combo);
      if (holder.combo % 5 === 0) gain(PTS.combo);
      const c = holder.combo;
      if (c === 3) petSay("combo3");
      else if (c === 5) petSay("combo5");
      else if (c === 10 || c === 20 || c === 30) petSay("combo10");
    } else {
      holder.combo = 0;
      if (repeatWrong) {
        lose(PTS.again);
        petSay("again");
      } else if (Math.random() < 0.6) petSay("wrong");
    }
    checkChallenges();
  }
  function rewardGroup(kind, size, perfect, ended) {
    const d = pday();
    if (ended) return;
    const st = staminaGain(kind === "root" ? TILL.root : TILL.word);
    if (st && state.world.hoe) setTimeout(() => toast("体力 +" + st), 900);
    if (kind === "root") {
      d.roots++;
      gain(PTS.rootDone + (perfect ? PTS.rootPerfect : 0));
      if (perfect) petSay("perfect", { n: PTS.rootPerfect });
      else petSay("done");
      if (learnedRootsToday() >= state.settings.rootGoal && !d.rootGoalDone) {
        d.rootGoalDone = true;
        gain(PTS.rootGoal);
        petSay("goal", { n: PTS.rootGoal });
      }
    } else {
      d.groups++;
      state.points.groups++;
      gain(size);
      if (perfect) {
        d.perfect++;
        state.points.perfects++;
        gain(PTS.perfect);
        petSay("perfect", { n: PTS.perfect });
      } else petSay("done");
      if (learnedToday() >= state.settings.goal && !d.goalDone) {
        d.goalDone = true;
        gain(PTS.goal);
        petSay("goal", { n: PTS.goal });
      }
    }
    checkChallenges();
    checkAchievements();
  }
  function todayChallenges() {
    let seed = dayNum() * 9301 + 49297;
    const idx = CHALLENGES.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor(seed / 233280 * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, 3).map((i) => CHALLENGES[i]);
  }
  function checkChallenges() {
    const d = pday();
    for (const c of todayChallenges()) {
      if (d.ch[c.id] || c.val(d) < c.goal) continue;
      d.ch[c.id] = 1;
      gain(c.reward);
      toast("完成每日挑战「" + c.text + "」 +" + c.reward);
      petSay("challenge");
    }
  }
  function checkAchievements(quiet) {
    const p = state.points;
    let n = 0;
    let sum = 0;
    let last = null;
    for (const a of ACHIEVEMENTS) {
      if (p.ach[a.id] || a.val() < a.goal) continue;
      p.ach[a.id] = todayKey();
      gain(a.reward);
      n++;
      sum += a.reward;
      last = a;
    }
    if (!n) return;
    save();
    if (n === 1) toast("解锁成就「" + last.name + "」 +" + last.reward);
    else toast("解锁 " + n + " 个成就 +" + sum + (quiet ? "，到「商店 → 挑战与成就」看看" : ""));
  }

  // src/world/sky.ts
  var WEATHER_NAME = { sunny: "晴", cloudy: "多云", overcast: "阴", rain: "小雨", storm: "大雨", snow: "下雪" };
  function weatherOf(day) {
    let h = day * 2654435761 >>> 0;
    h = Math.imul(h ^ h >>> 15, 2246822519) >>> 0;
    h = (h ^ h >>> 13) >>> 0;
    const r = h % 1e4 / 1e4;
    const w = r < 0.45 ? "sunny" : r < 0.67 ? "cloudy" : r < 0.8 ? "overcast" : r < 0.93 ? "rain" : "storm";
    const month = new Date(day * 864e5).getUTCMonth();
    return (month === 11 || month <= 1) && (w === "rain" || w === "storm") ? "snow" : w;
  }
  function weatherNow() {
    return ui.forceWeather || weatherOf(dayNum());
  }
  function minuteNow() {
    if (ui.forceMinute != null) return ui.forceMinute;
    const d = /* @__PURE__ */ new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function clockText() {
    const m = minuteNow();
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") + " · " + WEATHER_NAME[weatherNow()];
  }
  var SKY = [
    [0, [14, 22, 58, 0.5]],
    [270, [14, 22, 58, 0.5]],
    [330, [255, 170, 120, 0.12]],
    [420, [255, 255, 255, 0]],
    [990, [255, 255, 255, 0]],
    [1065, [255, 160, 80, 0.15]],
    [1110, [80, 45, 110, 0.3]],
    [1170, [14, 22, 58, 0.5]],
    [1440, [14, 22, 58, 0.5]]
  ];
  function skyTint(m) {
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1][0] <= m) i++;
    const [m0, a] = SKY[i];
    const [m1, b] = SKY[i + 1];
    const k = m1 > m0 ? (m - m0) / (m1 - m0) : 0;
    const ca = a[3] ? a : b;
    const cb = b[3] ? b : a;
    return [0, 1, 2].map((j) => Math.round(ca[j] + (cb[j] - ca[j]) * k)).concat(a[3] + (b[3] - a[3]) * k);
  }
  function darkness(m) {
    const t = skyTint(m);
    return t[0] < 120 ? Math.min(1, t[3] / 0.5) : 0;
  }
  var WEATHER_TINT = { overcast: [100, 108, 122, 0.24], rain: [70, 82, 105, 0.24], storm: [45, 55, 80, 0.34], snow: [215, 225, 240, 0.1] };
  function rainTick() {
    const W = state.world;
    const today = dayNum();
    if (W.rainDay === today || !["rain", "storm"].includes(weatherOf(today))) return;
    W.rainDay = today;
    for (const pl of W.plants) if (plantStage(pl) < plantMax(pl) && !wateredToday(pl)) pl.w = (pl.w || []).concat(today);
    save();
  }

  // src/world/scene.ts
  var WALK_CYCLE = ["walk1", "walkp", "walk2", "walkp"];
  var TB_GAP = 10;
  function pondSpot() {
    const list = POND_INNER.length ? POND_INNER : [...GPOND];
    const [tx, ty] = list[Math.floor(Math.random() * list.length)].split(",").map(Number);
    return [tx * TILE + 3 + Math.random() * 10, ty * TILE + 4 + Math.random() * 8];
  }
  var cloudImgs = null;
  function cloudShadows() {
    if (cloudImgs) return cloudImgs;
    cloudImgs = [
      [[30, 24, 26, 13], [52, 20, 20, 12], [14, 28, 13, 8], [70, 27, 14, 9]],
      [[24, 20, 20, 11], [42, 16, 16, 10], [58, 22, 14, 9]]
    ].map((blobs) => {
      const q = new ART.Pix(96, 44);
      for (const [x, y, rx, ry] of blobs) q.ell(x, y, rx, ry, "#0d2a18");
      return q.toCanvas();
    });
    return cloudImgs;
  }
  var BUTTERFLY = ["#fbf7ef", "#f6d35b", "#9cc8f0"];
  var Scene = class {
    constructor(kind) {
      this.kind = kind;
      this.w = kind === "room" ? RW : GW;
      this.h = kind === "room" ? RH : GH;
      let sx = kind === "room" ? (RDOOR[0] + 1) * TILE : DOOR_X * TILE + TILE / 2;
      let sy = (HOUSE.y + HOUSE.h + 1) * TILE;
      if (kind === "room" && ui.arrive) {
        sx = ui.arrive[0];
        sy = ui.arrive[1];
        ui.arrive = null;
      } else if (kind === "room") {
        const B = this.blocked();
        sy = (RH - 1) * TILE - 2;
        for (const r of [RH - 3, RH - 2]) {
          if (this.freeAt(sx, r * TILE + 8, B)) {
            sy = r * TILE + 8;
            break;
          }
        }
      }
      this.av = { x: sx, y: sy, tx: sx, ty: sy, path: [], dir: "front", flip: false, moving: false, act: 0, then: null };
      this.pets = [];
      this.fish = [];
      if (kind === "garden") {
        landPets().forEach((pet2, i) => {
          const px = (DOOR_X + 3 + i % 5 * 2) * TILE;
          const py = (HOUSE.y + HOUSE.h + 2 + Math.floor(i / 5)) * TILE;
          this.pets.push({ pid: pet2.id, x: px, y: py, tx: px, ty: py, path: [], moving: false, next: performance.now() + 800 + i * 400, play: 0, flip: false, blink: 0, hop: 0 });
        });
        fishList().forEach((f) => {
          const [x, y] = pondSpot();
          this.fish.push({ pid: f.id, x, y, tx: x, ty: y, flip: false, next: 0, v: 7 + Math.random() * 6, hop: 0 });
        });
      }
      this.cam = { x: 0, y: 0, init: false };
      this.hover = null;
      this.keys = {};
      this.fx = [];
      this.raf = 0;
      this.last = 0;
      this.bubbleUntil = 0;
    }
    attach(canvas, wrap) {
      this.canvas = canvas;
      this.wrap = wrap;
      this.ctx = canvas.getContext("2d");
      this.bubble = wrap.querySelector(".scene-bubble");
      canvas.addEventListener("click", (ev) => this.click(ev));
      canvas.addEventListener("mousemove", (ev) => this.move(ev));
      canvas.addEventListener("mouseleave", () => this.hover = null);
      let acc = 0;
      canvas.addEventListener(
        "wheel",
        (ev) => {
          if (!ev.ctrlKey && !ev.metaKey) return;
          ev.preventDefault();
          acc += ev.deltaY;
          if (Math.abs(acc) < 40) return;
          this.zoomBy(acc > 0 ? -1 : 1);
          acc = 0;
        },
        { passive: false }
      );
      if (this.ro) this.ro.disconnect();
      if (window.ResizeObserver) {
        let lastW = 0;
        this.ro = new ResizeObserver(() => {
          const w = this.wrap && this.wrap.getBoundingClientRect().width;
          if (!this.canvas || !w || w === lastW) return;
          lastW = w;
          this.fit();
        });
        this.ro.observe(this.wrap);
      }
      this.fit();
      this.start();
    }
    // 画面和页面内容一样宽，高度用满窗口剩下的地方（最高到 4:3），整页不用滚动；工具栏浮在画面下面
    box() {
      const exact = this.wrap.getBoundingClientRect().width - (this.wrap.offsetWidth - this.wrap.clientWidth);
      const w = Math.max(280, exact || 960);
      const top = this.wrap.getBoundingClientRect().top + window.scrollY;
      const border = this.wrap.offsetHeight - this.wrap.clientHeight;
      const pad = parseFloat(getComputedStyle(this.wrap.parentElement).paddingBottom) || 0;
      const tall = window.innerHeight > window.innerWidth ? 1.25 : 0.75;
      const h = Math.floor(Math.max(240, Math.min(w * tall, window.innerHeight - top - pad - border)));
      return [w, h];
    }
    // 默认大约看到 30 格宽（和星露谷差不多），可以拉近拉远（1–5 倍）；拉远到地图刚好铺满画面为止
    autoScale() {
      return Math.max(2, Math.min(4, Math.round(this.box()[0] / 480)));
    }
    fit() {
      if (!this.canvas) return;
      let [bw, bh] = this.box();
      if (this.kind === "room") bh = Math.min(bh, Math.max(Math.round(Math.max(bw, this.w * TILE * 2.6) * this.h / this.w), this.h * TILE * 2));
      this.wrap.style.height = bh + (this.wrap.offsetHeight - this.wrap.clientHeight) + "px";
      let scale;
      if (this.kind === "room") {
        scale = Math.max(2.6, bw / (this.w * TILE), bh / (this.h * TILE));
      } else {
        const z = state.settings.zoom;
        scale = z >= 1 && z <= 5 ? z : this.autoScale();
      }
      const vw = this.kind === "room" ? Math.min(this.w * TILE, Math.round(bw / scale)) : Math.round(bw / scale);
      const vh = this.kind === "room" ? Math.min(this.h * TILE, Math.round(bh / scale)) : Math.round(bh / scale);
      this.scale = scale;
      this.vw = vw;
      this.vh = vh;
      this.canvas.width = vw;
      this.canvas.height = vh;
      this.canvas.style.width = bw + "px";
      this.canvas.style.height = bh + "px";
      this.ctx.imageSmoothingEnabled = false;
      this.tb = this.wrap.querySelector(".toolbar");
      this.tbTop = this.tb ? (this.wrap.clientHeight - TB_GAP - this.tb.offsetHeight - this.canvas.offsetTop) / scale : vh;
    }
    zoomBy(d) {
      if (this.kind === "room") return;
      const z = Math.max(1, Math.min(5, this.scale + d));
      if (z === this.scale) return;
      state.settings.zoom = z === this.autoScale() ? 0 : z;
      save();
      this.fit();
      this.cam.init = false;
      const el = document.getElementById("zoom-v");
      if (el) el.textContent = z + "×";
    }
    start() {
      cancelAnimationFrame(this.raf);
      this.last = performance.now();
      const loop = (t) => {
        if (!this.canvas || !document.body.contains(this.canvas)) return;
        this.step(t);
        if (!this.canvas) return;
        this.draw(t);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    stop() {
      cancelAnimationFrame(this.raf);
      if (this.ro) this.ro.disconnect();
      this.ro = null;
      this.canvas = null;
    }
    bounds() {
      if (this.kind === "room") return [8, 2 * TILE + 10, RW * TILE - 8, RH * TILE - 2];
      return [GB * TILE + 6, GB * TILE + 10, (GW - GB) * TILE - 6, (GH - GB) * TILE - 2];
    }
    // 走不过去的格子：房子、池塘、树、灌木、石头和各种摆设（花和地毯可以踩）
    // who = 'pet' 是宠物（不下水）；不写就是人物：有体力就能下池塘游泳
    blocked(who) {
      const B = /* @__PURE__ */ new Set();
      const swim = who !== "pet" && this.canSwim();
      if (this.kind === "room") {
        for (const d of floorItems(curFloor())) {
          const D = ART.DECOR[d.id];
          if (D && (D.flat || D.wall)) continue;
          const [w, h] = decorSize(d.id);
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) B.add(d.x + i + "," + (d.y + j));
        }
        for (const s of stairsOf(curFloor())) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) B.add(s.x + i + "," + (s.y + j));
        return B;
      }
      for (const [k, v] of gardenOcc()) {
        if (v.plant && v.plant.k === "flower") continue;
        if (v.debris && DEBRIS[v.debris.k].walk) continue;
        if (v.decor && ART.DECOR[v.decor.id] && ART.DECOR[v.decor.id].flat) continue;
        if (v.pond && swim) continue;
        B.add(k);
      }
      return B;
    }
    canSwim() {
      return this.kind === "garden" && stamina().v > 0;
    }
    // 离人物最近的岸边空地（游泳没体力了往那儿游）
    nearestShore(x, y) {
      const B = this.blocked("pet");
      const sx = Math.floor(x / TILE);
      const sy = Math.floor(y / TILE);
      let best = null;
      let bestD = Infinity;
      for (let ty = sy - 12; ty <= sy + 12; ty++)
        for (let tx = sx - 12; tx <= sx + 12; tx++) {
          if (tx < GB || ty < GB || tx >= GW - GB || ty >= GH - GB || B.has(tx + "," + ty)) continue;
          const d = Math.hypot(tx - sx, ty - sy);
          if (d < bestD) {
            bestD = d;
            best = [tx * TILE + TILE / 2, ty * TILE + 10];
          }
        }
      return best || [x, y];
    }
    // 脚下这一点能不能站（看脚的左右两边）
    freeAt(x, y, B) {
      B = B || this.blockedNow || this.blocked();
      const ty = Math.floor(y / TILE);
      return !B.has(Math.floor((x - 4) / TILE) + "," + ty) && !B.has(Math.floor((x + 4) / TILE) + "," + ty);
    }
    // 找路：按格子广度优先，走不到目标就走到离目标最近、走得到的格子；再把能直走的拐点省掉
    route(px, py, who) {
      const B = this.blocked(who && who !== this.av ? "pet" : void 0);
      const [x0, y0, x1, y1] = this.bounds();
      const cxOf = (tx) => Math.max(x0, Math.min(x1, tx * TILE + TILE / 2));
      const cyOf = (ty) => Math.max(y0, Math.min(y1, ty * TILE + 10));
      const ok = (tx, ty) => tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && !B.has(tx + "," + ty) && (ty + 1) * TILE > y0 && ty * TILE <= y1 && (tx + 1) * TILE > x0 && tx * TILE <= x1;
      const av = who || this.av;
      const sx = Math.floor(av.x / TILE);
      const sy = Math.floor(av.y / TILE);
      const gx = Math.floor(px / TILE);
      const gy = Math.floor(py / TILE);
      const key = (x, y) => x + "," + y;
      const prev = /* @__PURE__ */ new Map([[key(sx, sy), null]]);
      const queue = [[sx, sy]];
      let best = [sx, sy];
      let bestD = Math.hypot(cxOf(sx) - px, cyOf(sy) - py);
      for (let i2 = 0; i2 < queue.length; i2++) {
        const [x, y] = queue[i2];
        const d = x === gx && y === gy ? -1 : Math.hypot(cxOf(x) - px, cyOf(y) - py);
        if (d < bestD - 0.01) {
          best = [x, y];
          bestD = d;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (prev.has(key(nx, ny)) || !ok(nx, ny)) continue;
          if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue;
          prev.set(key(nx, ny), [x, y]);
          queue.push([nx, ny]);
        }
      }
      const reached = best[0] === gx && best[1] === gy;
      if (!reached && ok(gx, gy)) return [[Math.max(x0, Math.min(x1, px)), Math.max(y0, Math.min(y1, py))]];
      const tiles = [];
      for (let c = best; c; c = prev.get(key(c[0], c[1]))) tiles.unshift(c);
      tiles.shift();
      const pts = tiles.map(([x, y]) => [cxOf(x), cyOf(y)]);
      const end = reached ? [Math.max(x0, Math.min(x1, px)), Math.max(y0, Math.min(y1, py))] : pts.length ? pts[pts.length - 1] : [av.x, av.y];
      if (pts.length) pts[pts.length - 1] = end;
      else pts.push(end);
      const clear = (a, b) => {
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
        for (let i2 = 1; i2 <= n; i2++) if (!this.freeAt(a[0] + (b[0] - a[0]) * i2 / n, a[1] + (b[1] - a[1]) * i2 / n, B)) return false;
        return true;
      };
      const out = [];
      let from = [av.x, av.y];
      let i = 0;
      while (i < pts.length) {
        let j = pts.length - 1;
        while (j > i && !clear(from, pts[j])) j--;
        out.push(pts[j]);
        from = pts[j];
        i = j + 1;
      }
      return out;
    }
    // 走到某一点（绕开挡路的东西），到了再做 then
    walkTo(px, py, then) {
      this.av.pose = null;
      const path = this.route(px, py);
      const last = path[path.length - 1];
      this.av.path = path;
      this.av.tx = last[0];
      this.av.ty = last[1];
      this.av.then = then || null;
      this.av.moving = true;
    }
    walkNear(tx, ty, tw, th, then) {
      const cx = (tx + tw / 2) * TILE;
      const below = (ty + th) * TILE + 6;
      const [, , , y1] = this.bounds();
      if (below > y1) this.walkTo(cx + (this.av.x < cx ? -(tw * TILE) / 2 - 6 : tw * TILE / 2 + 6), (ty + th) * TILE - 2, then);
      else this.walkTo(cx, below, then);
    }
    step(t) {
      const dt = Math.min(0.05, (t - this.last) / 1e3);
      this.last = t;
      const av = this.av;
      const k = this.keys;
      const vx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      const vy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      const speed = av.swim ? 44 : 72;
      if (vx || vy) {
        av.pose = null;
        const n = Math.hypot(vx, vy);
        const [x0, y0, x1, y1] = this.bounds();
        const nx = Math.max(x0, Math.min(x1, av.x + vx / n * speed * dt));
        const ny = Math.max(y0, Math.min(y1, av.y + vy / n * speed * dt));
        this.blockedNow = this.blocked();
        if (this.freeAt(nx, ny) || !this.freeAt(av.x, av.y)) {
          av.x = nx;
          av.y = ny;
        } else if (this.freeAt(nx, av.y)) av.x = nx;
        else if (this.freeAt(av.x, ny)) av.y = ny;
        this.blockedNow = null;
        av.tx = av.x;
        av.ty = av.y;
        av.path = [];
        av.moving = false;
        av.then = null;
        av.walking = true;
        if (Math.abs(vx) >= Math.abs(vy)) {
          av.dir = "side";
          av.flip = vx < 0;
        } else av.dir = vy > 0 ? "front" : "back";
      } else if (av.moving) {
        if (!av.path || !av.path.length) av.path = [[av.tx, av.ty]];
        const wp = av.path[0];
        const dx = wp[0] - av.x;
        const dy = wp[1] - av.y;
        const d = Math.hypot(dx, dy);
        const v = speed * dt;
        av.walking = true;
        if (Math.abs(dx) >= Math.abs(dy)) {
          if (Math.abs(dx) > 0.5) {
            av.dir = "side";
            av.flip = dx < 0;
          }
        } else av.dir = dy > 0 ? "front" : "back";
        if (d <= v && av.path.length > 1) {
          av.x = wp[0];
          av.y = wp[1];
          av.path.shift();
        } else if (d <= v) {
          av.x = wp[0];
          av.y = wp[1];
          av.path = [];
          av.moving = false;
          av.walking = false;
          const then = av.then;
          av.then = null;
          if (then) {
            av.act = t + 450;
            then();
          }
        } else {
          av.x += dx / d * v;
          av.y += dy / d * v;
        }
      } else av.walking = false;
      const mapW = this.w * TILE;
      const mapH = this.h * TILE;
      const cxT = this.vw >= mapW ? (mapW - this.vw) / 2 : Math.max(0, Math.min(mapW - this.vw, av.x - this.vw / 2));
      let cyC = av.y - 16 - this.vh / 2;
      if (this.kind === "garden") {
        const doorY = (HOUSE.y + HOUSE.h + 1) * TILE;
        const top = (HOUSE.y + HOUSE.h) * TILE - ART.decor(HOUSE.sprite).height;
        const lift = cyC - Math.max(top - 4, av.y - Math.min(this.vh, this.tbTop || this.vh) + 6);
        const k2 = Math.max(0, Math.min(1, (av.y - doorY) / (6 * TILE)));
        if (lift > 0) cyC -= lift * (1 - k2);
      }
      const cyT = this.vh >= mapH ? (mapH - this.vh) / 2 : Math.max(0, Math.min(mapH - this.vh, cyC));
      if (!this.cam.init) {
        this.cam.x = cxT;
        this.cam.y = cyT;
        this.cam.init = true;
      } else {
        this.cam.x += (cxT - this.cam.x) * Math.min(1, dt * 5);
        this.cam.y += (cyT - this.cam.y) * Math.min(1, dt * 5);
      }
      if (this.kind === "room" && !av.pose) {
        const tx = Math.floor(av.x / TILE);
        const ty = Math.floor((av.y - 2) / TILE);
        const s = stairsOf(curFloor()).find((q) => tx >= q.x && tx < q.x + 2 && ty === q.y + 2);
        if (s) {
          const to = curFloor() + (s.dir === "up" ? 1 : -1);
          ui.floor = to;
          ui.arrive = [(s.x + 1) * TILE, (s.y + 3) * TILE + 10];
          toast(FLOOR_NAME[to]);
          goScene("room");
          return;
        }
      }
      if (this.kind === "garden") {
        const wet = GPOND.has(Math.floor(av.x / TILE) + "," + Math.floor((av.y - 2) / TILE));
        if (wet && !av.swim) this.drops(av.x, av.y);
        av.swim = wet;
        if (wet) {
          this.swimT = (this.swimT || 0) + dt;
          if (this.swimT >= 60) {
            this.swimT -= 60;
            const s = stamina();
            s.v = Math.max(0, s.v - 1);
            save();
            refreshSceneUi();
          }
          if (stamina().v <= 0 && !(av.moving && av.exiting)) {
            if (!av.exiting) toast("体力用完了，先游回岸上");
            av.exiting = true;
            const sh = this.nearestShore(av.x, av.y);
            av.path = [sh];
            av.tx = sh[0];
            av.ty = sh[1];
            av.then = null;
            av.moving = true;
          }
        } else av.exiting = false;
      }
      this.stepPet(t, dt);
      this.ambient(t, dt);
      for (const f of this.fx) {
        f.life -= dt;
        f.y += f.vy * dt;
        f.x += (f.vx || 0) * dt;
      }
      this.fx = this.fx.filter((f) => f.life > 0);
    }
    // 宠物在花园里：自己溜达，花园里有树有花就跑过去玩，玩一会儿状态会好起来
    // 花园里的宠物：每只自己溜达；花园里有长好的树和花，就跑过去玩，玩一会儿心情会好起来
    stepPet(t, dt) {
      for (const e of this.pets) this.stepOne(e, t, dt);
      for (const f of this.fish) this.stepFish(f, t, dt);
    }
    stepOne(p, t, dt) {
      const pet2 = petById(p.pid);
      if (!pet2 || pet2.sick) {
        p.moving = false;
        return;
      }
      if (p.moving) {
        if (!p.path || !p.path.length) p.path = [[p.tx, p.ty]];
        const wp = p.path[0];
        const dx = wp[0] - p.x;
        const dy = wp[1] - p.y;
        const d = Math.hypot(dx, dy);
        const v = 48 * dt;
        if (Math.abs(dx) > 1) p.flip = dx < 0;
        if (d <= v && p.path.length > 1) {
          p.x = wp[0];
          p.y = wp[1];
          p.path.shift();
        } else if (d <= v) {
          p.x = wp[0];
          p.y = wp[1];
          p.path = [];
          p.moving = false;
          if (p.goPlay) {
            p.goPlay = false;
            p.play = t + 2800;
            this.heart(p.x, p.y - 30);
            if (careUp(pet2, "mood", 3, "playMood", CARE.playCap)) save();
            if (pet2.id === state.petMain && Math.random() < 0.35) petSay("play");
          }
        } else {
          p.x += dx / d * v;
          p.y += dy / d * v;
        }
        return;
      }
      if (Math.random() < dt * 0.4) p.blink = t + 140;
      if (t < p.next || t < p.play) return;
      p.next = t + 2500 + Math.random() * 4e3;
      const [x0, y0, x1, y1] = this.bounds();
      const fun = state.world.plants.filter((pl) => plantStage(pl) >= (pl.k === "tree" ? 3 : 2));
      if (fun.length && Math.random() < 0.5) {
        const pl = fun[Math.floor(Math.random() * fun.length)];
        p.tx = (pl.x + (pl.k === "tree" ? 1 : 0.5)) * TILE + (Math.random() - 0.5) * 20;
        p.ty = (pl.y + 1) * TILE + 8;
        p.goPlay = true;
      } else {
        p.tx = p.x + (Math.random() - 0.5) * 140;
        p.ty = p.y + (Math.random() - 0.5) * 90;
      }
      p.tx = Math.max(x0, Math.min(x1, p.tx));
      p.ty = Math.max(y0 + 8, Math.min(y1, p.ty));
      p.path = this.route(p.tx, p.ty, p);
      const last = p.path[p.path.length - 1];
      p.tx = last[0];
      p.ty = last[1];
      p.moving = true;
    }
    // 鱼：在池塘里慢慢游，停一停再换个方向；刚撒了鱼食就都游到一处
    stepFish(f, t, dt) {
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.hypot(dx, dy);
      const v = (t < f.hop ? f.v * 3 : f.v) * dt;
      if (d > v) {
        f.x += dx / d * v;
        f.y += dy / d * v;
        if (Math.abs(dx) > 0.5) f.flip = dx < 0;
        return;
      }
      if (t < f.next) return;
      f.next = t + 600 + Math.random() * 2600;
      const fed = this.fishFed && t - this.fishFed < 4e3;
      const [x, y] = fed ? this.fishBowl || (this.fishBowl = pondSpot()) : pondSpot();
      f.tx = x + (fed ? (Math.random() - 0.5) * 10 : 0);
      f.ty = y + (fed ? (Math.random() - 0.5) * 6 : 0);
      if (!fed) this.fishBowl = null;
    }
    ambient(t, dt) {
      if (this.kind !== "garden") return;
      const [x0, y0, x1, y1] = this.bounds();
      const rx = () => x0 + Math.random() * (x1 - x0);
      const ry = () => y0 + Math.random() * (y1 - y0);
      const A = this.amb || (this.amb = { bf: BUTTERFLY.map((c, i) => ({ x: rx(), y: ry(), tx: rx(), ty: ry(), c, alt: 10, rest: 0, ph: i * 2 })), petals: [], glints: [], nextGlint: 0 });
      const flowers = state.world.plants.filter((pl) => pl.k === "flower" && plantStage(pl) >= 2);
      for (const b of A.bf) {
        const d = Math.hypot(b.tx - b.x, b.ty - b.y);
        if (t < b.rest) {
          b.alt = Math.max(2, b.alt - dt * 20);
          continue;
        }
        if (d < 2) {
          if (b.onFlower) b.rest = t + 1500 + Math.random() * 2500;
          const fl = flowers.length && Math.random() < 0.7 ? flowers[Math.floor(Math.random() * flowers.length)] : null;
          b.tx = fl ? fl.x * TILE + 8 : rx();
          b.ty = fl ? fl.y * TILE + 10 : ry();
          b.onFlower = !!fl;
          continue;
        }
        const v = 18 * dt;
        b.x += (b.tx - b.x) / d * Math.min(v, d) + Math.sin(t / 180 + b.ph) * 0.25;
        b.y += (b.ty - b.y) / d * Math.min(v, d) + Math.cos(t / 230 + b.ph) * 0.2;
        b.alt = Math.min(12, b.alt + dt * 20) + Math.sin(t / 160 + b.ph) * 0.3;
      }
      const sakura = state.world.plants.filter((pl) => pl.k === "tree" && pl.sp === "sakura" && pl.ok && pl.x >= 0);
      if (sakura.length && A.petals.length < 4 + sakura.length * 3 && Math.random() < dt * 1.5 * sakura.length) {
        const tr = sakura[Math.floor(Math.random() * sakura.length)];
        const cx = tr.x * TILE + TILE;
        const base = (tr.y + 1) * TILE;
        A.petals.push({ x: cx - 12 + Math.random() * 24, y: base - 40 + Math.random() * 18, ground: base + 2 + Math.random() * 12, ph: Math.random() * 6, life: 9 });
      }
      for (const q of A.petals) {
        q.life -= dt;
        if (q.y < q.ground) {
          q.y += 9 * dt;
          q.x += Math.sin(t / 400 + q.ph) * 10 * dt;
        }
      }
      A.petals = A.petals.filter((q) => q.life > 0);
      if (POND_INNER.length && t > A.nextGlint) {
        A.nextGlint = t + 250 + Math.random() * 400;
        const [gx, gy] = POND_INNER[Math.floor(Math.random() * POND_INNER.length)].split(",").map(Number);
        A.glints.push({ x: gx * TILE + 2 + Math.floor(Math.random() * 11), y: gy * TILE + 2 + Math.floor(Math.random() * 12), t0: t });
      }
      A.glints = A.glints.filter((g) => t - g.t0 < 900);
    }
    // 在地面上、物件下面画：波光
    drawGround(ctx, t) {
      for (const f of this.fish) {
        const fish = petById(f.pid);
        if (!fish) continue;
        const img = ART.fishTop(fish.sp, Math.floor(t / (t < f.hop ? 90 : 220)) % 2, fish.sick);
        ctx.globalAlpha = 0.92;
        if (f.flip) {
          ctx.save();
          ctx.translate(Math.round(f.x) + img.width / 2, Math.round(f.y) - img.height / 2);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        } else ctx.drawImage(img, Math.round(f.x) - img.width / 2, Math.round(f.y) - img.height / 2);
        ctx.globalAlpha = 1;
      }
      const A = this.amb;
      if (!A) return;
      for (const g of A.glints) {
        const k = (t - g.t0) / 900;
        const len = k < 0.3 || k > 0.75 ? 1 : 3;
        ctx.fillStyle = k > 0.3 && k < 0.75 ? "#e4f5ff" : "#a6d6f4";
        ctx.fillRect(g.x - (len >> 1), g.y, len, 1);
      }
    }
    // 在物件上面画：花瓣、蝴蝶、云影
    // 时间和天气：盖一层颜色；天黑了窗户和灯亮起来；下雨、下雪；打雷闪一下
    drawLight(ctx, t, cx, cy) {
      const m = minuteNow();
      const wx = this.kind === "garden" ? weatherNow() : "sunny";
      let tint = skyTint(m);
      if (this.kind === "room") tint = [tint[0], tint[1], tint[2], tint[3] * 0.45];
      const dark = darkness(m);
      if (tint[3] > 5e-3) {
        ctx.fillStyle = "rgba(" + tint[0] + "," + tint[1] + "," + tint[2] + "," + tint[3].toFixed(3) + ")";
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
      const wt = WEATHER_TINT[wx];
      if (wt) {
        ctx.fillStyle = "rgba(" + wt.slice(0, 3).join(",") + "," + wt[3] + ")";
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
      if (dark > 0.05) {
        ctx.save();
        ctx.translate(-cx, -cy);
        ctx.globalAlpha = Math.min(1, dark * 1.1);
        const glow = (x, y, r, a) => {
          const g = ctx.createRadialGradient(x, y, 1, x, y, r);
          g.addColorStop(0, "rgba(255,200,120," + a + ")");
          g.addColorStop(1, "rgba(255,200,120,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        };
        if (this.kind === "garden") {
          const img = ART.decor(HOUSE.sprite);
          const hx = HOUSE.x * TILE + (HOUSE.w * TILE - img.width) / 2;
          const hy = (HOUSE.y + HOUSE.h) * TILE - img.height;
          ctx.drawImage(ART.litWindows(HOUSE.sprite), hx, hy);
          ctx.globalCompositeOperation = "lighter";
          glow(DOOR_X * TILE + 8, (HOUSE.y + HOUSE.h) * TILE, 40, 0.22);
          for (const d of state.world.decor) if (d.id === "lamp" || d.id === "floorlamp") glow(d.x * TILE + 8, d.y * TILE - 4, 34, 0.35);
        } else {
          ctx.globalCompositeOperation = "lighter";
          for (const d of floorItems(curFloor())) {
            if (d.id === "lamp" || d.id === "floorlamp") glow(d.x * TILE + 8, d.y * TILE - 4, 42, 0.3);
            if (d.id === "fireplace") glow(d.x * TILE + 16, d.y * TILE + 8, 50, 0.3);
          }
        }
        ctx.restore();
      }
      const A = this.wx || (this.wx = { drops: [], rings: [], flash: 0, next: 0 });
      const want = wx === "storm" ? 220 : wx === "rain" ? 110 : wx === "snow" ? 90 : 0;
      while (A.drops.length < want) A.drops.push({ x: Math.random() * this.vw, y: Math.random() * this.vh, v: 0.6 + Math.random() * 0.6 });
      if (A.drops.length > want) A.drops.length = want;
      const dt = Math.min(0.05, (t - (A.last || t)) / 1e3);
      A.last = t;
      if (wx === "snow") {
        ctx.fillStyle = "rgba(255,255,255,.9)";
        for (const d of A.drops) {
          d.y += 18 * d.v * dt;
          d.x += Math.sin(t / 900 + d.v * 10) * 8 * dt;
          if (d.y > this.vh) d.y -= this.vh;
          ctx.fillRect(Math.round(d.x), Math.round(d.y), d.v > 0.9 ? 2 : 1, d.v > 0.9 ? 2 : 1);
        }
      } else if (want) {
        ctx.strokeStyle = "rgba(200,215,235,.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of A.drops) {
          d.y += 220 * d.v * dt;
          d.x -= 40 * d.v * dt;
          if (d.y > this.vh) {
            d.y -= this.vh + 10;
            d.x = Math.random() * (this.vw + 40);
          }
          ctx.moveTo(Math.round(d.x), Math.round(d.y));
          ctx.lineTo(Math.round(d.x - 2), Math.round(d.y + 6));
        }
        ctx.stroke();
        if (this.kind === "garden" && POND_INNER.length && Math.random() < (wx === "storm" ? 0.6 : 0.3)) {
          const [tx, ty] = POND_INNER[Math.floor(Math.random() * POND_INNER.length)].split(",").map(Number);
          A.rings.push({ x: tx * TILE + Math.random() * 16, y: ty * TILE + Math.random() * 16, t });
        }
        ctx.strokeStyle = "rgba(220,240,255,.7)";
        A.rings = A.rings.filter((r) => t - r.t < 700);
        for (const r of A.rings) {
          const k = (t - r.t) / 700;
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.ellipse(r.x - cx, r.y - cy, 1 + k * 4, 0.5 + k * 1.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (wx === "storm") {
          if (!A.next) A.next = t + 6e3 + Math.random() * 12e3;
          if (t > A.next) {
            A.flash = t;
            A.next = t + 8e3 + Math.random() * 14e3;
          }
          const f = (t - A.flash) / 250;
          if (A.flash && f < 1) {
            ctx.fillStyle = "rgba(255,255,255," + (0.45 * (1 - f)).toFixed(2) + ")";
            ctx.fillRect(0, 0, this.vw, this.vh);
          }
        }
      }
      if (this.clockM !== m || this.clockW !== wx) {
        this.clockM = m;
        this.clockW = wx;
        for (const el of document.querySelectorAll(".g-clock")) el.textContent = clockText();
      }
    }
    drawSky(ctx, t) {
      const A = this.amb;
      if (!A) return;
      for (const q of A.petals) {
        ctx.globalAlpha = Math.min(1, q.life / 2);
        ctx.fillStyle = "#f7b6cc";
        ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 1);
        ctx.fillStyle = "#fbd3e0";
        ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
      ctx.globalAlpha = 1;
      for (const b of A.bf) {
        const x = Math.round(b.x);
        const y = Math.round(b.y - b.alt);
        ctx.fillStyle = "rgba(30,40,20,.25)";
        ctx.fillRect(x - 1, Math.round(b.y), 3, 1);
        const resting = t < b.rest;
        const open = Math.floor((t + b.ph * 100) / (resting ? 700 : 110)) % 2 === 0;
        ctx.fillStyle = b.c;
        if (open) {
          ctx.fillRect(x - 2, y - 1, 2, 2);
          ctx.fillRect(x + 1, y - 1, 2, 2);
          ctx.fillRect(x - 1, y + 1, 1, 1);
          ctx.fillRect(x + 1, y + 1, 1, 1);
        } else {
          ctx.fillRect(x - 1, y - 2, 1, 2);
          ctx.fillRect(x + 1, y - 2, 1, 2);
        }
        ctx.fillStyle = "#3a2a2a";
        ctx.fillRect(x, y - 1, 1, 3);
      }
      const imgs = cloudShadows();
      const W = this.w * TILE;
      ctx.globalAlpha = 0.09;
      for (let i = 0; i < 3; i++) {
        const img = imgs[i % 2];
        const span = W + img.width * 2;
        const x = Math.round((t / 1e3 * (5 + i * 1.5) + i * 230) % span) - img.width;
        const y = [30, 150, 230][i];
        ctx.drawImage(img, x, y);
      }
      ctx.globalAlpha = 1;
    }
    heart(x, y) {
      this.fx.push({ kind: "heart", x, y, vy: -18, life: 1 });
    }
    drops(x, y) {
      for (let i = 0; i < 6; i++) this.fx.push({ kind: "drop", x: x + (Math.random() - 0.5) * 12, y: y - 14 - Math.random() * 6, vy: 30 + Math.random() * 20, life: 0.5 });
    }
    // 锄地扬起的土
    dust(x, y) {
      for (let i = 0; i < 7; i++) this.fx.push({ kind: "dust", x: x + (Math.random() - 0.5) * 14, y: y - 4 - Math.random() * 4, vy: -14 - Math.random() * 10, vx: (Math.random() - 0.5) * 30, life: 0.45 });
    }
    sparkle(x, y) {
      for (let i = 0; i < 8; i++) this.fx.push({ kind: "spark", x: x + (Math.random() - 0.5) * 18, y: y - 8 - Math.random() * 18, vy: -12, vx: (Math.random() - 0.5) * 16, life: 0.7 });
    }
    // 陪你背单词的那只在画面里的样子
    mainEnt() {
      return this.pets.find((e) => e.pid === state.petMain) || null;
    }
    say(text) {
      const e = this.mainEnt();
      if (!this.bubble || !e) return;
      this.bubble.textContent = text;
      this.bubbleUntil = performance.now() + 3400;
      e.play = Math.max(e.play, performance.now() + 1800);
    }
    draw(t) {
      const ctx = this.ctx;
      const cam = this.cam;
      const cx = Math.round(cam.x);
      const cy = Math.round(cam.y);
      ctx.clearRect(0, 0, this.vw, this.vh);
      ctx.save();
      ctx.translate(-cx, -cy);
      let objs;
      if (this.kind === "room") {
        ctx.drawImage(roomTerrain(), 0, 0);
        for (const s of stairsOf(curFloor())) ctx.drawImage(ART.decor(s.dir === "up" ? "stairsUp" : "stairsDown"), s.x * TILE, s.y * TILE);
        for (const d of floorItems(curFloor())) {
          if (d.id === "window") {
            ctx.fillStyle = "rgba(255,244,200,.2)";
            for (let j = 0; j < 30; j++) ctx.fillRect(d.x * TILE + 2 + Math.floor(j * 0.5), 2 * TILE + j, TILE - 4, 1);
          } else if (d.id === "fireplace") {
            const fx = d.x * TILE + TILE;
            const fy = (d.y + 1) * TILE;
            const a = 0.16 + Math.sin(t / 130) * 0.03 + Math.sin(t / 47) * 0.02;
            const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 46);
            g.addColorStop(0, "rgba(255,170,80," + a.toFixed(3) + ")");
            g.addColorStop(1, "rgba(255,170,80,0)");
            ctx.fillStyle = g;
            ctx.fillRect(fx - 46, fy - 46, 92, 92);
          }
        }
        objs = floorItems(curFloor()).map((d) => {
          const [w, h] = decorSize(d.id);
          const o = objAt(ART.decor(d.id), d.x, d.y, w, h);
          if (ART.DECOR[d.id] && (ART.DECOR[d.id].flat || ART.DECOR[d.id].wall)) o.base = -1;
          return o;
        });
      } else {
        const out = Math.max(-cx, -cy, cx + this.vw - GW * TILE, cy + this.vh - GH * TILE);
        const ring = out > 0 ? forestRing2(out) : null;
        if (ring) ctx.drawImage(ring.back, -ring.m, -ring.m);
        ctx.drawImage(gardenTerrain(state.world.plants), 0, 0);
        if (ring) ctx.drawImage(ring.front, -ring.m, -ring.m);
        this.drawGround(ctx, t);
        objs = gardenObjects(state.world.plants, state.world.decor, true);
      }
      const av = this.av;
      const look = avatarLook();
      const af = t < av.act ? "act" : av.walking ? WALK_CYCLE[Math.floor(t / 120) % 4] : "idle";
      this.avFrame = af;
      if (av.pose && av.pose.kind === "sit") objs.push({ img: ART.avatar(look, "sit", "front"), x: av.pose.x - 8, y: av.pose.top, base: av.pose.base + 0.5 });
      else if (av.pose && av.pose.kind === "lie") objs.push({ img: ART.lying(look), x: av.pose.x, y: av.pose.y, base: av.pose.base + 0.5 });
      else if (av.swim) {
        const bob2 = Math.round(Math.sin(t / 260));
        objs.push({ img: ART.avatar(look, Math.floor(t / 420) % 2 ? "walkp" : "idle", av.dir), x: Math.round(av.x) - 8, y: Math.round(av.y) - 24 + bob2, crop: 19, base: av.y, flip: av.dir === "side" && av.flip, ripple: true });
      } else objs.push({ img: ART.avatar(look, af, av.dir), x: Math.round(av.x) - 8, y: Math.round(av.y) - 31, base: av.y, flip: av.dir === "side" && av.flip, shadow: true });
      const p = this.mainEnt();
      for (const e of this.pets) {
        const pet2 = petById(e.pid);
        if (!pet2) continue;
        const talking = e === p && t < this.bubbleUntil;
        const pf = pet2.sick ? "sick" : e.moving ? Math.floor(t / 140) % 2 ? "walk2" : "walk1" : t < e.play || talking ? "happy" : t < e.blink ? "blink" : "idle";
        const hop = t < e.hop ? Math.round(Math.sin((e.hop - t) / 400 * Math.PI) * 5) : 0;
        objs.push({ img: petCanvas(pf, pet2), x: Math.round(e.x) - 16, y: Math.round(e.y) - 30 - hop, base: e.y, flip: e.flip, shadow: true, pet: true });
      }
      objs.sort((a, b) => a.base - b.base);
      for (const o of objs) {
        if (o.shadow) {
          ctx.fillStyle = "rgba(40,30,20,.22)";
          ctx.beginPath();
          ctx.ellipse(o.x + o.img.width / 2, o.base, o.pet ? 9 : 6, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        const ih = o.crop || o.img.height;
        if (o.flip) {
          ctx.save();
          ctx.translate(o.x + o.img.width, o.y);
          ctx.scale(-1, 1);
          ctx.drawImage(o.img, 0, 0, o.img.width, ih, 0, 0, o.img.width, ih);
          ctx.restore();
        } else ctx.drawImage(o.img, 0, 0, o.img.width, ih, Math.round(o.x), Math.round(o.y), o.img.width, ih);
        if (o.ripple) {
          const cx2 = Math.round(o.x + 8);
          const cy2 = Math.round(o.y + ih);
          ctx.strokeStyle = "rgba(225,244,255,.85)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(cx2, cy2, 8, 2.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          const k = t % 1400 / 1400;
          ctx.strokeStyle = "rgba(225,244,255," + (0.6 * (1 - k)).toFixed(2) + ")";
          ctx.beginPath();
          ctx.ellipse(cx2, cy2, 9 + k * 10, 3 + k * 3, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (o.plant && (wateredToday(o.plant) || o.plant.f) && Math.floor(t / 400) % 3 === 0) {
          ctx.fillStyle = o.plant.f ? "#f6d35b" : "#bfe6ff";
          const sx = o.x + 3 + t / 37 % (o.img.width - 6);
          ctx.fillRect(Math.round(sx), Math.round(o.y + 2 + t / 53 % 8), 1, 1);
        }
      }
      if (this.kind === "garden") this.drawSky(ctx, t);
      for (const f of this.fx) {
        const x = Math.round(f.x);
        const y = Math.round(f.y);
        if (f.kind === "heart") {
          ctx.fillStyle = "#e85d75";
          for (const [dx, dy] of [[-2, 0], [-1, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [0, 3], [-1, -1], [1, -1]]) ctx.fillRect(x + dx, y + dy, 1, 1);
        } else if (f.kind === "drop") {
          ctx.fillStyle = "#7fc0f0";
          ctx.fillRect(x, y, 1, 2);
        } else if (f.kind === "dust") {
          ctx.fillStyle = f.life > 0.25 ? "#9a7048" : "#b8916a";
          ctx.fillRect(x, y, 2, 2);
        } else {
          ctx.fillStyle = "#fff1a8";
          ctx.fillRect(x, y, 1, 1);
          if (f.life > 0.35) {
            ctx.fillRect(x - 1, y, 1, 1);
            ctx.fillRect(x + 1, y, 1, 1);
            ctx.fillRect(x, y - 1, 1, 1);
            ctx.fillRect(x, y + 1, 1, 1);
          }
        }
      }
      if (this.hover && ui.tool) {
        const [w, h] = this.toolSize();
        const ok = this.toolOk(this.hover[0], this.hover[1]);
        ctx.strokeStyle = ok ? "rgba(255,255,255,.9)" : "rgba(230,80,70,.9)";
        ctx.lineWidth = 1;
        ctx.strokeRect(this.hover[0] * TILE + 0.5, this.hover[1] * TILE + 0.5, w * TILE - 1, h * TILE - 1);
        ctx.fillStyle = ok ? "rgba(255,255,255,.15)" : "rgba(230,80,70,.15)";
        ctx.fillRect(this.hover[0] * TILE, this.hover[1] * TILE, w * TILE, h * TILE);
      }
      ctx.restore();
      this.drawLight(ctx, t, cx, cy);
      if (!this.vig || this.vig.w !== this.vw || this.vig.h !== this.vh) {
        const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.42, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.75);
        g.addColorStop(0, "rgba(20,28,12,0)");
        g.addColorStop(1, this.kind === "room" ? "rgba(40,22,10,.22)" : "rgba(16,30,14,.2)");
        this.vig = { w: this.vw, h: this.vh, g };
      }
      ctx.fillStyle = this.vig.g;
      ctx.fillRect(0, 0, this.vw, this.vh);
      if (this.bubble) {
        const show = p && performance.now() < this.bubbleUntil;
        this.bubble.classList.toggle("show", !!show);
        if (show) {
          this.bubble.style.left = this.canvas.offsetLeft + (p.x - cx) * this.scale + "px";
          this.bubble.style.top = this.canvas.offsetTop + (p.y - 34 - cy) * this.scale + "px";
        }
      }
      if (!this.tb || !this.tb.isConnected) this.tb = this.wrap && this.wrap.querySelector(".toolbar");
      const tb = this.tb;
      if (tb) {
        const s = this.scale;
        const ax = this.canvas.offsetLeft + (this.av.x - cx) * s;
        const feet2 = this.canvas.offsetTop + (this.av.y - cy) * s;
        const top = this.wrap.clientHeight - TB_GAP - tb.offsetHeight;
        const under = feet2 > top - 2 && ax + 10 * s > tb.offsetLeft && ax - 10 * s < tb.offsetLeft + tb.offsetWidth;
        if (under !== tb.classList.contains("at-top")) tb.classList.toggle("at-top", under);
      }
    }
    toTile(ev) {
      const r = this.canvas.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * this.vw + this.cam.x;
      const py = (ev.clientY - r.top) / r.height * this.vh + this.cam.y;
      return [px, py, Math.floor(px / TILE), Math.floor(py / TILE)];
    }
    move(ev) {
      const [, , tx, ty] = this.toTile(ev);
      this.hover = [tx, ty];
    }
    toolSize() {
      const it = ITEMS.get(ui.tool);
      if (it && it.decor) return decorSize(it.decor);
      if (it && it.plant && it.plant[0] === "tree") return [2, 1];
      return [1, 1];
    }
    // 拿着的工具能不能用在这个格子上
    toolOk(tx, ty) {
      const tool = ui.tool;
      if (this.kind === "room") {
        if (tool === "hand") return roomOcc().has(tx + "," + ty);
        const it2 = ITEMS.get(tool);
        return !!(it2 && (it2.use === "furnish" || it2.use === "place") && roomFree(it2.decor, tx, ty));
      }
      const occ = gardenOcc();
      const here = occ.get(tx + "," + ty);
      if (tool === "hand") return !!(here && here.decor);
      if (tool === "shovel") return !!(here && here.plant);
      if (tool === "hoe") return !tilled(tx, ty) && gardenFree(tx, ty, 1, 1, occ);
      if (CLEAR_TOOLS.includes(tool)) return !!(here && here.debris && DEBRIS[here.debris.k].tool === tool);
      const it = ITEMS.get(tool);
      if (!it) return false;
      const growing = here && here.plant && plantStage(here.plant) < plantMax(here.plant);
      if (it.use === "plant") {
        const w = it.plant[0] === "tree" ? 2 : 1;
        return gardenFree(tx, ty, w, 1, occ) && allTilled(tx, ty, w, 1);
      }
      if (it.use === "lawn") return tilled(tx, ty) && !here;
      if (it.use === "water") return !!(growing && !wateredToday(here.plant));
      if (it.use === "fert") return !!(growing && here.plant.fd !== dayNum());
      if (it.use === "place" || it.use === "furnish" && !ART.DECOR[it.decor].wall) {
        const [w, h] = decorSize(it.decor);
        return gardenFree(tx, ty, w, h, occ);
      }
      return false;
    }
    click(ev) {
      const [px, py, tx, ty] = this.toTile(ev);
      if (ui.tool) {
        this.useTool(tx, ty);
        return;
      }
      const hits = this.pets.filter((e) => Math.abs(px - e.x) < 14 && py > e.y - 30 && py < e.y + 2).sort((a, b) => b.y - a.y);
      if (hits.length) {
        const e = hits[0];
        const pet2 = petById(e.pid);
        e.hop = performance.now() + 400;
        this.heart(e.x, e.y - 32);
        if (pet2 && careUp(pet2, "mood", 1, "petMood", CARE.petCap)) save();
        if (pet2 && pet2.id === state.petMain) petSay(pet2.sick ? "sick" : "click");
        return;
      }
      const fh = this.fish.find((f) => Math.abs(px - f.x) < 8 && Math.abs(py - f.y) < 6);
      if (fh) {
        const f = petById(fh.pid);
        fh.hop = performance.now() + 500;
        fh.next = 0;
        this.drops(fh.x, fh.y + 14);
        if (f && careUp(f, "mood", 4, "fishPlay", 20)) save();
        return;
      }
      const furn = this.kind === "room" ? roomOcc().get(tx + "," + ty) : (gardenOcc().get(tx + "," + ty) || {}).decor;
      if (furn && (SEATS[furn.id] || furn.id === "bed")) {
        this.restOn(furn, px);
        return;
      }
      if (this.kind === "room") {
        if (curFloor() === 1 && ty >= RH - 1 && RDOOR.includes(tx)) {
          this.walkTo((RDOOR[0] + 1) * TILE, RH * TILE - 2, () => goScene("garden"));
          return;
        }
        this.walkTo(px, py);
        return;
      }
      const here = gardenOcc().get(tx + "," + ty);
      if (here && here.house) {
        this.walkTo(DOOR_X * TILE + TILE / 2, (HOUSE.y + HOUSE.h) * TILE + 4, () => {
          ui.floor = 1;
          goScene("room");
        });
        return;
      }
      if (here && here.pond && stamina().v <= 0) toast("体力用完了，下不了水");
      if (here && here.debris) {
        const D = DEBRIS[here.debris.k];
        toast(D.name + " · 用" + TOOL_NAME[D.tool] + "清理，要 " + D.st + " 点体力");
      }
      if (here && here.plant) {
        const pl = here.plant;
        const st = plantStage(pl);
        const names = pl.k === "tree" ? ["种子", "发芽", "小树苗", "小树", "长成大树了"] : pl.k === "flower" ? ["刚种下", "发芽", "花苞", "开花了"] : ["刚种下", "发芽", "长好了"];
        const msg = plantName(pl) + " · " + names[st] + (st >= plantMax(pl) ? "" : " · " + (wateredToday(pl) ? "今天浇过水" : "今天还没浇水"));
        toast(msg);
      }
      this.walkTo(px, py + 4);
    }
    // 走到家具前面，坐下或者躺下；再走动就站起来
    restOn(d, px) {
      const [w, h] = decorSize(d.id);
      const img = ART.decor(d.id);
      const base = (d.y + h) * TILE;
      const top = base - img.height;
      let pose;
      let fx = d.x + Math.floor(w / 2);
      if (d.id === "bed") pose = { kind: "lie", x: d.x * TILE, y: top, base };
      else {
        const S = SEATS[d.id];
        const at = S.at.reduce((a, b) => Math.abs(d.x * TILE + b - px) < Math.abs(d.x * TILE + a - px) ? b : a);
        fx = d.x + Math.floor(at / TILE);
        pose = { kind: "sit", x: d.x * TILE + at, top: top + S.seat - 26, base };
      }
      this.walkTo(fx * TILE + TILE / 2, base + 8, () => {
        this.av.pose = pose;
        this.av.dir = "front";
      });
    }
    async useTool(tx, ty) {
      if (!this.toolOk(tx, ty)) {
        const here = this.kind === "garden" && gardenOcc().get(tx + "," + ty);
        const it2 = ITEMS.get(ui.tool);
        if (here && here.plant && it2 && (it2.use === "water" || it2.use === "fert")) {
          const pl = here.plant;
          toast(plantStage(pl) >= plantMax(pl) ? plantName(pl) + "已经长好了" : it2.use === "water" ? "今天浇过水了" : "今天施过肥了");
        } else if (this.kind === "garden" && it2 && it2.use === "plant" && gardenFree(tx, ty, it2.plant[0] === "tree" ? 2 : 1, 1)) {
          toast(state.world.hoe ? it2.plant[0] === "tree" ? "树要种在开垦过的两格地上" : "这块地还没开垦" : "先买一把锄头，开垦了才能种");
        } else if (this.kind === "garden" && ui.tool === "hoe" && tilled(tx, ty)) toast("这块地已经开垦过了");
        else if (this.kind === "garden" && here && here.debris) toast(DEBRIS[here.debris.k].name + "要用" + TOOL_NAME[DEBRIS[here.debris.k].tool] + (state.world[DEBRIS[here.debris.k].tool] ? "" : "，先去商店买一把"));
        else toast(this.kind === "room" ? "这里放不下" : "这里不行");
        return;
      }
      const tool = ui.tool;
      if (CLEAR_TOOLS.includes(tool)) {
        const d = gardenOcc().get(tx + "," + ty).debris;
        if (stamina().v < DEBRIS[d.k].st) return toast(stamina().v ? "体力不够了（" + DEBRIS[d.k].name + "要 " + DEBRIS[d.k].st + " 点），背一组单词能补回来" : "体力用完了，背一组单词能补回来");
      }
      if (tool === "hoe") {
        if (stamina().v <= 0) return toast("体力用完了，背一组单词能补回来");
        if (state.points.bal < TILL.cost) return toast("金币不够（开垦一格 " + TILL.cost + " 金币）");
      }
      if (tool === "shovel") {
        const pl = gardenOcc().get(tx + "," + ty).plant;
        if (pl.k === "tree" && !await askConfirm("铲掉这棵" + plantName(pl) + "？铲掉就没有了。", "铲掉")) return;
      }
      const it = ITEMS.get(tool);
      const [w, h] = this.toolSize();
      this.walkNear(tx, ty, w, h, () => {
        if (!this.toolOk(tx, ty)) return;
        const W = state.world;
        const cx = (tx + w / 2) * TILE;
        const cy = (ty + h) * TILE;
        if (this.kind === "room") {
          if (tool === "hand") {
            const d = roomOcc().get(tx + "," + ty);
            setFloorItems(curFloor(), floorItems(curFloor()).filter((x) => x !== d));
            bagAdd(ITEM_OF_DECOR.get(d.id) || "furn." + d.id, 1);
          } else {
            floorItems(curFloor()).push({ id: it.decor, x: tx, y: ty });
            bagAdd(tool, -1);
            this.sparkle(cx, cy);
            checkAchievements();
          }
        } else {
          const here = gardenOcc().get(tx + "," + ty);
          if (tool === "hand") {
            W.decor = W.decor.filter((x) => x !== here.decor);
            bagAdd(ITEM_OF_DECOR.get(here.decor.id) || "decor." + here.decor.id, 1);
          } else if (tool === "shovel") {
            W.plants = W.plants.filter((x) => x !== here.plant);
          } else if (CLEAR_TOOLS.includes(tool)) {
            const d = here.debris;
            const D = DEBRIS[d.k];
            if (stamina().v < D.st) return;
            stamina().v -= D.st;
            W.debris = W.debris.filter((x) => x !== d);
            const roll = (r) => r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
            const got = [];
            if (D.wood) {
              const n = roll(D.wood);
              bagAdd("wood", n);
              got.push("木材 +" + n);
            }
            if (D.stone) {
              const n = roll(D.stone);
              bagAdd("stone", n);
              got.push("石料 +" + n);
            }
            if (d.k === "weed" && Math.random() < 0.2) {
              bagAdd("lawn", 1);
              got.push("草坪种子 +1");
            }
            if (d.k === "tree" && Math.random() < 0.25) {
              bagAdd("tseed." + d.sp, 1);
              got.push(TREES.get(d.sp).name + "种子 +1");
            }
            this.dust((d.x + D.w / 2) * TILE, (d.y + D.h) * TILE);
            if (got.length) toast(got.join("，"));
          } else if (tool === "hoe") {
            if (stamina().v <= 0 || !spend(TILL.cost)) return;
            stamina().v--;
            setTilled(tx, ty, true);
            this.dust(cx, cy);
          } else if (it.use === "lawn") {
            setTilled(tx, ty, false);
            bagAdd(tool, -1);
            this.sparkle(cx, cy);
          } else if (it.use === "plant") {
            W.plants.push({ k: it.plant[0], sp: it.plant[1], x: tx, y: ty, t: dayNum(), w: [], f: 0 });
            bagAdd(tool, -1);
          } else if (it.use === "water" || it.use === "fert") {
            const pl = here.plant;
            const before = plantStage(pl);
            if (it.use === "water") {
              pl.w = (pl.w || []).concat(dayNum());
              const d = pday();
              d.water = (d.water || 0) + 1;
              this.drops((pl.x + plantSize(pl)[0] / 2) * TILE, (pl.y + 1) * TILE);
              checkChallenges();
            } else {
              pl.f = (pl.f || 0) + 1;
              pl.fd = dayNum();
              this.sparkle((pl.x + plantSize(pl)[0] / 2) * TILE, (pl.y + 1) * TILE);
            }
            bagAdd(tool, -1);
            if (before < plantMax(pl) && plantStage(pl) >= plantMax(pl)) {
              if (!W.grown) W.grown = { t: 0, f: 0 };
              if (pl.k === "tree") {
                W.grown.t++;
                toast(plantName(pl) + "长成大树了");
                if (Math.random() < 0.7) petSay("grown");
              } else if (pl.k === "flower") W.grown.f++;
            }
          } else if (it.use === "place" || it.use === "furnish") {
            W.decor.push({ id: it.decor, x: tx, y: ty });
            bagAdd(tool, -1);
            this.sparkle(cx, cy);
          }
          checkAchievements();
        }
        if (tool !== "hand" && tool !== "shovel" && tool !== "hoe" && !CLEAR_TOOLS.includes(tool) && !bagHas(tool)) ui.tool = null;
        save();
        refreshSceneUi();
      });
    }
    key(ev, down) {
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down" };
      const k = map[ev.key];
      if (!k) return false;
      this.keys[k] = down;
      return true;
    }
  };

  // src/world/sceneui.ts
  function goScene(kind) {
    if (scene) scene.stop();
    setScene(null);
    ui.tool = null;
    go(kind);
  }
  function sceneTools(kind) {
    const out = [];
    for (const id in state.world.bag) {
      const it = ITEMS.get(id);
      if (!it) continue;
      const wall = it.decor && ART.DECOR[it.decor] && ART.DECOR[it.decor].wall;
      if (kind === "room" ? it.use === "furnish" || it.use === "place" : ["plant", "water", "fert", "place", "lawn"].includes(it.use) || it.use === "furnish" && !wall) out.push(it);
    }
    return out;
  }
  function toolbarHtml(kind) {
    const owned = ["hoe", "scythe", "pickaxe", "axe"].filter((id) => state.world[id]);
    const free = kind === "room" ? [["hand", "收回", ART.icon("hand")]] : [["hand", "收回", ART.icon("hand")], ["shovel", "铲掉", ART.icon("shovel")]].concat(owned.map((id) => [id, TOOL_NAME[id], ART.icon(id)]));
    const tools = sceneTools(kind);
    const btn = (id, name, img, n) => '<button class="tool' + (ui.tool === id ? " on" : "") + '" data-act="tool" data-id="' + esc(id) + '" title="' + esc(name) + '">' + pxImg(img, 2) + (n != null ? '<span class="n">' + n + "</span>" : "") + '<span class="tn">' + esc(name) + "</span></button>";
    return '<div class="toolbar" id="toolbar">' + (kind === "garden" && owned.length ? '<span class="stam" title="体力">' + pxImg(ART.icon("bolt"), 2) + "<b>" + stamina().v + "</b></span>" : "") + free.map(([id, name, img, n]) => btn(id, name, img, n)).join("") + '<span class="tsep"></span>' + (tools.length ? tools.map((it) => btn(it.id, it.name.replace(/ ×\d+$/, ""), itemIcon(it), state.world.bag[it.id])).join("") : '<span class="muted small">背包里没有' + (kind === "room" ? "家具" : "种子、水和装饰") + '</span><button class="link" data-act="openShelf" data-shelf="' + (kind === "room" ? "furniture" : "treeseeds") + '">去买</button>') + "</div>";
  }
  function refreshSceneUi() {
    const tb = document.getElementById("toolbar");
    if (tb) tb.outerHTML = toolbarHtml(ui.view === "room" ? "room" : "garden");
    const st = document.getElementById("g-stats");
    if (st) st.innerHTML = gardenStatsHtml();
    renderBag();
    const pts = document.querySelector(".pts");
    if (pts) pts.lastChild.textContent = fmt(state.points.bal);
  }
  function gardenStatsHtml() {
    const s = summarize(state.world.plants, []);
    const parts = ["树木 " + s.t, "花卉 " + s.f, "观赏草 " + s.g, "灌木 " + s.s, "体力 " + stamina().v + "/" + TILL.max];
    const growing = state.world.plants.filter((pl) => plantStage(pl) < plantMax(pl)).length;
    if (growing) parts.push("在长 " + growing);
    return parts.join(" · ");
  }
  VIEWS.garden = function() {
    const next = LANDS[(state.world.land || 0) + 1];
    return '<main class="page wide"><div class="g-top"><div><h1 class="h1">花园</h1><p class="muted"><span id="g-stats">' + gardenStatsHtml() + '</span> · <span class="g-clock">' + clockText() + '</span></p></div><div class="actions"><span class="zoom"><button class="btn ghost small" data-act="zoom" data-d="-1" title="拉远（−）">−</button><span id="zoom-v" class="muted small"></span><button class="btn ghost small" data-act="zoom" data-d="1" title="拉近（+）">+</button></span>' + (next ? '<button class="btn ghost small" data-act="buyLand" title="' + next.w + " × " + (next.h + OY) + ' 格">扩建 · ' + fmt(next.price) + "</button>" : "") + '<button class="btn ghost small" data-act="goRoom">回家</button></div></div><div class="scene-wrap" id="scene-wrap"><canvas class="scene" id="scene"></canvas><div class="scene-bubble"></div>' + toolbarHtml("garden") + "</div></main>";
  };
  VIEWS.room = function() {
    return '<main class="page wide"><div class="g-top"><div><h1 class="h1">' + HOUSES[houseLevel()].name + (floorCount() > 1 ? " · " + FLOOR_NAME[curFloor()] : "") + '</h1><p class="muted">这层家具 ' + floorItems(curFloor()).length + " 件" + (floorCount() > 1 ? " · 一共 " + floorCount() + " 层，走到楼梯上换楼层" : "") + ' · <span class="g-clock">' + clockText() + '</span></p></div><div class="actions">' + (HOUSES[houseLevel() + 1] ? '<button class="btn ghost small" data-act="buyHouse">扩建成' + HOUSES[houseLevel() + 1].name + " · " + costText(HOUSES[houseLevel() + 1]) + "</button>" : "") + '<button class="btn ghost small" data-act="goGarden">出门</button></div></div><div class="scene-wrap room" id="scene-wrap"><canvas class="scene" id="scene"></canvas><div class="scene-bubble"></div>' + toolbarHtml("room") + "</div></main>";
  };
  function attachScene(kind) {
    const canvas = document.getElementById("scene");
    const wrap = document.getElementById("scene-wrap");
    if (!canvas) return;
    if (!scene || scene.kind !== kind) {
      if (scene) scene.stop();
      setScene(new Scene(kind));
    }
    scene.attach(canvas, wrap);
  }
  AFTER.garden = function() {
    attachScene("garden");
    const z = document.getElementById("zoom-v");
    if (z && scene) z.textContent = scene.scale + "×";
  };
  AFTER.room = function() {
    attachScene("room");
  };

  // src/world/bagui.ts
  var bagLayer = document.createElement("div");
  function bagTotal() {
    let n = 0;
    for (const id in state.world.bag) n += state.world.bag[id];
    return n;
  }
  function itemNote(it) {
    if (it.use === "feed") return "饱腹 +" + it.food + (it.mood ? " · 心情 +" + it.mood : "");
    if (it.use === "toy") return "心情 +" + it.mood;
    if (it.use === "hoe") return "开垦一格 " + TILL.cost + " 金币、1 点体力";
    if (it.use === "scythe") return "割杂草，每次 1 点体力";
    if (it.use === "pickaxe") return "敲石头，小石头 2 点体力、大石头 5 点";
    if (it.use === "axe") return "砍树枝、树桩和野树，1–6 点体力";
    if (it.use === "mat") return "扩建花园、房子要用";
    if (it.use === "lawn") return "撒在开垦过的空地上，变回草地";
    return "";
  }
  function renderBag() {
    const ids = Object.keys(state.world.bag).filter((id) => ITEMS.has(id));
    const order = [...ITEMS.keys()];
    ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const sel = ITEMS.get(ui.bagPick);
    let panel = "";
    if (ui.bagOpen) {
      let detail = "";
      if (sel && bagHas(sel.id)) {
        const acts = [];
        if (["plant", "water", "fert", "place", "lawn"].includes(sel.use)) acts.push('<button class="btn small" data-bag="garden">去花园用</button>');
        if (sel.use === "furnish") acts.push('<button class="btn small" data-bag="room">摆进屋里</button>');
        if (sel.use === "fishfood") acts.push(fishList().length ? '<button class="btn small" data-bag="fish">撒进池塘</button>' : '<span class="muted small">池塘里还没有鱼</span>');
        if (["feed", "toy", "medicine"].includes(sel.use)) {
          const pets = landPets().concat(sel.use === "medicine" ? fishList() : []).filter((p) => sel.use === "medicine" ? p.sick : !p.sick);
          if (pets.length) acts.push('<span class="muted small">' + (sel.use === "feed" ? "喂给" : sel.use === "toy" ? "给" : "喂药") + "</span>" + pets.map((p) => '<button class="btn small" data-bag="care" data-pet="' + p.id + '">' + esc(p.name) + "</button>").join(""));
          else acts.push('<span class="muted small">' + (sel.use === "medicine" ? "没有宠物生病" : state.pets.length ? "宠物生病了，先喂药" : "还没有宠物") + "</span>");
        }
        detail = '<div class="bag-detail"><b>' + esc(sel.name) + '</b><span class="muted">×' + state.world.bag[sel.id] + (itemNote(sel) ? " · " + itemNote(sel) : "") + '</span><div class="actions">' + acts.join("") + "</div></div>";
      }
      panel = '<div class="bag" role="dialog" aria-label="背包"><div class="bag-head"><b>背包</b><button class="link" data-bag="shop">商店</button><button class="bag-x" data-bag="close" aria-label="关上">×</button></div>' + (ids.length ? '<div class="bag-grid">' + ids.map((id) => '<button class="slot' + (ui.bagPick === id ? " on" : "") + '" data-bag="pick" data-id="' + esc(id) + '" title="' + esc(ITEMS.get(id).name) + '">' + pxImg(itemIcon(ITEMS.get(id)), 2) + '<span class="n">' + state.world.bag[id] + "</span></button>").join("") + "</div>" + detail : '<p class="muted bag-empty">空的</p>') + "</div>";
    }
    const n = bagTotal();
    bagLayer.innerHTML = panel + '<button class="bag-btn' + (ui.bagOpen ? " on" : "") + '" data-bag="toggle" title="背包">' + pxImg(ART.icon("bag"), 2) + (n ? '<span class="n">' + n + "</span>" : "") + "</button>";
  }
  function careUse(p, id) {
    const it = ITEMS.get(id);
    if (!p || !it || !bagHas(id)) return false;
    if (it.use === "medicine") {
      if (!p.sick) return toast(p.name + "没生病，药先留着"), false;
      bagAdd(id, -1);
      p.sick = false;
      p.food = Math.max(p.food, CARE.cure);
      p.mood = Math.max(p.mood, CARE.cure);
      p.day = dayNum();
      save();
      if (p === mainPet()) setTimeout(() => petSay("cured"), 200);
      else toast(p.name + "好起来了");
      return true;
    }
    if (p.sick) return toast(p.name + "生病了，先喂药"), false;
    bagAdd(id, -1);
    if (it.use === "feed") {
      careUp(p, "food", it.food);
      careUp(p, "mood", it.mood || 0);
      const d = pday();
      d.feed = (d.feed || 0) + 1;
      floatMood("饱腹 +" + it.food);
      if (p === mainPet()) petSay("fed");
      checkChallenges();
    } else {
      careUp(p, "mood", it.mood);
      floatMood("+" + it.mood);
      if (p === mainPet()) petSay("toy");
    }
    save();
    return true;
  }
  function feedFish() {
    const fish = fishList().filter((f) => !f.sick);
    if (!bagHas("fishfood")) return toast("背包里没有鱼食");
    if (!fish.length) return toast(fishList().length ? "鱼生病了，先喂药" : "池塘里还没有鱼");
    bagAdd("fishfood", -1);
    for (const f of fish) {
      f.food = 100;
      careUp(f, "mood", 5);
    }
    const d = pday();
    d.feed = (d.feed || 0) + 1;
    checkChallenges();
    save();
    floatMood("鱼都吃饱了");
    if (scene && scene.kind === "garden") scene.fishFed = performance.now();
    return true;
  }
  function floatMood(text) {
    const pts = document.querySelector(".pts");
    if (!pts) return;
    const r = pts.getBoundingClientRect();
    const s = document.createElement("span");
    s.className = "pts-float mood";
    s.textContent = "♥ " + text;
    s.style.left = r.left + r.width / 2 + "px";
    s.style.top = r.bottom + 4 + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
  function initBag() {
    bagLayer.className = "bag-layer";
    document.body.appendChild(bagLayer);
    bagLayer.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-bag]");
      if (!t) return;
      const a = t.dataset.bag;
      if (a === "toggle") ui.bagOpen = !ui.bagOpen;
      else if (a === "close") ui.bagOpen = false;
      else if (a === "pick") ui.bagPick = t.dataset.id;
      else if (a === "shop") {
        ui.bagOpen = false;
        ui.shopTab = "seeds";
        go("shop");
        return;
      } else if (a === "garden" || a === "room") {
        ui.bagOpen = false;
        if (ui.view !== a) {
          if (scene) scene.stop();
          setScene(null);
          go(a);
        }
        ui.tool = ui.bagPick;
        refreshSceneUi();
        return;
      } else if (a === "care") {
        if (careUse(petById(+t.dataset.pet), ui.bagPick)) {
          if (!bagHas(ui.bagPick)) ui.bagPick = null;
          render();
          return;
        }
      } else if (a === "fish") {
        if (feedFish()) {
          if (!bagHas("fishfood")) ui.bagPick = null;
          render();
          return;
        }
      }
      renderBag();
    });
  }

  // src/app/update.ts
  var APP_VERSION = "0.6.4";
  var REPO = "Adrian-Z-Wong/Marginal-Vocabulary";
  var UPDATE_KEY = "margin.updateCheck";
  var ONLINE = /^https?:$/.test(location.protocol);
  var DOWNLOAD_PAGE = "https://adrian-z-wong.github.io/Marginal-Vocabulary/";
  function versionNewer(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  }
  function changelogSince(text, from) {
    const out = [];
    for (const part of text.split(/^## /m).slice(1)) {
      const m = /^(\d+\.\d+\.\d+)/.exec(part);
      if (!m || !versionNewer(m[1], from)) continue;
      out.push({ v: m[1], items: part.split("\n").filter((l) => /^- /.test(l)).map((l) => l.slice(2)) });
    }
    return out;
  }
  async function checkUpdate(manual) {
    ui.update = Object.assign({}, ui.update, { checking: true, error: "" });
    if (manual) render();
    try {
      const res = await fetch("https://api.github.com/repos/" + REPO + "/releases/latest", { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rel = await res.json();
      const latest = String(rel.tag_name || "").replace(/^v/, "");
      try {
        localStorage.setItem(UPDATE_KEY, String(Date.now()));
      } catch (e) {
      }
      if (!latest || !versionNewer(latest, APP_VERSION)) {
        ui.update = { checking: false, latest: latest || APP_VERSION, none: true };
        if (manual) toast("已经是最新版本（" + APP_VERSION + "）");
      } else {
        const asset = (rel.assets || []).find((a) => (WINDOWS ? /-setup\.exe$/ : /\.app\.tar\.gz$/).test(a.name));
        let notes = [];
        try {
          const r2 = await fetch("https://raw.githubusercontent.com/" + REPO + "/main/CHANGELOG.md", { cache: "no-store" });
          if (r2.ok) notes = changelogSince(await r2.text(), APP_VERSION);
        } catch (e) {
          notes = [];
        }
        ui.update = { checking: false, latest, url: asset ? asset.browser_download_url : "", notes, show: true, open: manual };
      }
    } catch (e) {
      ui.update = { checking: false, error: "检查更新失败，请检查网络后再试" };
      if (manual) toast(ui.update.error);
    }
    if (ui.view !== "practice" && ui.view !== "rootquiz") render();
  }
  window.__marginCheckUpdate = function() {
    checkUpdate(true).then(() => {
      const u = ui.update;
      if (u && u.show && (ui.view === "practice" || ui.view === "rootquiz")) toast("发现新版本 " + u.latest + "，这一组背完后会提示更新");
    });
  };
  function autoCheckUpdate() {
    if (window.__MARGIN_TEST && !window.__MARGIN_TEST_UPDATE) return;
    let last = 0;
    try {
      last = +localStorage.getItem(UPDATE_KEY) || 0;
    } catch (e) {
      last = 0;
    }
    if (Date.now() - last > 12 * 3600 * 1e3) setTimeout(() => checkUpdate(false), 2500);
  }
  async function installUpdate() {
    const u = ui.update;
    if (!u || !u.latest) return;
    if (!DESKTOP) {
      if (ONLINE) location.reload();
      else window.open(DOWNLOAD_PAGE, "_blank");
      return;
    }
    if (!u.url) {
      window.open("https://github.com/" + REPO + "/releases/latest", "_blank");
      return;
    }
    u.installing = true;
    u.error = "";
    render();
    try {
      save();
      await window.__TAURI__.core.invoke("save_update_backup", {
        contents: JSON.stringify({ app: "Marginal Vocabulary", v: 1, exported: (/* @__PURE__ */ new Date()).toISOString(), version: APP_VERSION, data: state })
      });
      await window.__TAURI__.core.invoke("install_update", { url: u.url });
      u.installing = false;
      u.installed = true;
    } catch (e) {
      u.installing = false;
      u.error = "自动更新没成功（" + e + "）。可以到 Releases 页面手动下载新版本。";
    }
    render();
  }
  function updateBarHtml() {
    const u = ui.update;
    if (!u || !u.show || ui.view === "practice" || ui.view === "rootquiz") return "";
    let main;
    let acts;
    if (u.installed) {
      main = "<b>新版本 " + esc(u.latest) + ' 装好了</b><span class="muted">重新打开就是新版本，进度不受影响。</span>';
      acts = '<button class="btn small" data-act="relaunchApp">重新打开</button>';
    } else if (u.installing) {
      main = "<b>正在下载新版本 " + esc(u.latest) + '…</b><span class="muted">' + (WINDOWS ? "下载好后会打开安装程序，按提示装好就是新版本。" : "大约 4 MB，装好后会提示你重新打开。") + "</span>";
      acts = '<span class="spin" aria-hidden="true"></span>';
    } else {
      main = "<b>发现新版本 " + esc(u.latest) + '</b><span class="muted">当前 ' + APP_VERSION + "</span>";
      const label = DESKTOP ? "立即更新" : ONLINE ? "刷新页面" : "下载新版本";
      acts = '<button class="btn small" data-act="installUpdate">' + label + "</button>" + (u.notes && u.notes.length ? '<button class="link" data-act="toggleUpdateNotes">' + (u.open ? "收起" : "更新内容") + "</button>" : "") + '<button class="link" data-act="hideUpdate">稍后</button>';
    }
    const notes = u.open && u.notes && u.notes.length && !u.installed ? '<div class="u-notes">' + u.notes.map((n) => '<p class="label">' + esc(n.v) + "</p><ul>" + n.items.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>").join("") + "</div>" : "";
    return '<div class="update-bar" role="status"><div class="u-in"><span class="u-mark">' + ICON_SPARK + '</span><div class="u-text">' + main + (u.error ? '<span class="u-err">' + esc(u.error) + "</span>" : "") + '</div><div class="actions">' + acts + "</div></div>" + notes + "</div>";
  }
  function updateSettingHtml() {
    const u = ui.update || {};
    const status = u.checking ? "正在检查…" : u.error ? u.error : u.none ? "已经是最新版本" : u.latest && versionNewer(u.latest, APP_VERSION) ? "有新版本 " + u.latest : "";
    const desc = WINDOWS ? "每天打开时自动检查一次。有新版本时在应用里下载安装程序，打开后按提示装好：新版本覆盖旧版本，不会留下多个版本；背诵进度存在应用的数据文件夹里，不受影响，更新前还会自动备份一份。" : DESKTOP ? "每天打开时自动检查一次，也可以在菜单「Marginal Vocabulary → Check for Updates…」里检查。有新版本时直接在应用里下载安装：新版本替换旧版本，不会留下多个版本；背诵进度存在应用的数据文件夹里，不受影响，更新前还会自动备份一份。" : ONLINE ? "在线版每次打开都是最新版本；如果页面开着时发布了新版本，这里会提示刷新。" : "下载到电脑的网页文件不能自己更新；有新版本时会提示，到下载页面再下载一次即可（先导出备份）。";
    return '<div class="set-row"><div><div class="t">版本与更新</div></div><div><div>当前版本 <b class="mono">' + APP_VERSION + "</b>" + (status ? '<span class="muted"> · ' + esc(status) + "</span>" : "") + '</div><div class="actions" style="margin-top:12px"><button class="btn small ghost" data-act="checkUpdate"' + (u.checking ? " disabled" : "") + ">检查更新</button>" + (u.latest && versionNewer(u.latest, APP_VERSION) && !u.installed ? '<button class="btn small" data-act="installUpdate">' + (DESKTOP ? "立即更新" : ONLINE ? "刷新页面" : "下载新版本") + "</button>" : "") + (u.installed ? '<button class="btn small" data-act="relaunchApp">重新打开</button>' : "") + '</div><div class="d">' + desc + "</div></div></div>";
  }

  // src/app/render.ts
  function render() {
    petsTick();
    debrisTick();
    rainTick();
    if (ui.petGone && ui.petGone.length) {
      const names = ui.petGone;
      ui.petGone = null;
      setTimeout(() => toast(names.join("、") + " 生病太久，去世了"), 600);
    }
    if (scene && ui.view !== "garden" && ui.view !== "room") {
      scene.stop();
      setScene(null);
    }
    const html = header() + updateBarHtml() + (VIEWS[ui.view] || VIEWS.home)();
    app.innerHTML = html;
    AFTER[ui.view] && AFTER[ui.view]();
    renderPet();
    renderBag();
  }
  function header() {
    const wrongN = Object.keys(state.wrong).length;
    const nav = [
      ["home", "背诵"],
      ["roots", "词根"],
      ["books", "词库"],
      ["wrong", "错题本" + (wrongN ? "<sup>" + wrongN + "</sup>" : "")],
      ["garden", "花园"],
      ["shop", "商店" + (petNeedsCare() ? '<i class="dot" title="' + (petSick() ? "宠物生病了" : "宠物状态不太好") + '"></i>' : "")],
      ["games", "小游戏"],
      ["settings", "设置"]
    ];
    const active = { practice: "home", result: "home", book: "books", import: "books", root: "roots", rootquiz: "roots", room: "garden" }[ui.view] || ui.view;
    return '<header class="top"><button class="brand" data-act="nav" data-view="home"><span class="brand-mark">' + ICON_SPARK + '</span>Marginal Vocabulary</button><div class="top-r"><button class="pts" data-act="nav" data-view="shop" title="金币 · Lv ' + levelOf(state.points.earned) + '"><span class="pts-ic"></span>' + fmt(state.points.bal) + '</button><nav class="nav">' + nav.map(([v, label]) => '<button data-act="nav" data-view="' + v + '" class="' + (active === v ? "on" : "") + '">' + label + "</button>").join("") + "</nav></div></header>";
  }
  function allBooks() {
    return TERM_BOOKS.concat(EXAM_BOOKS).map((b) => b.id).filter((id) => bookExists(id));
  }
  function bookOptionsHtml(selected) {
    const opt = (id, label) => '<option value="' + esc(id) + '"' + (id === selected ? " selected" : "") + ">" + esc(label) + "</option>";
    const info = (id) => {
      const list = bookEntries(id);
      return bookName(id) + " · " + fmt(list.length) + " 词 · 已背 " + fmt(seenCount(list));
    };
    let html = "";
    html += allBooks().map((id) => opt(id, info(id))).join("");
    const mine = Object.values(state.books).sort((a, b) => a.t - b.t);
    html += mine.map((b) => opt(b.id, info(b.id))).join("");
    return html;
  }

  // src/app/nav.ts
  var app = document.getElementById("app");
  var ui = {
    view: "home",
    session: null,
    book: { id: null, q: "", limit: 200 },
    draft: null,
    roots: { q: "", type: "all", id: null, limit: 200, wordLimit: 50 },
    rs: null
    // 词根练习的一组
  };
  function go(view2) {
    if (ui.view === "practice" && view2 !== "practice") stopSpeech();
    if (GAMES2 && ui.view === "games" && view2 !== "games") GAMES2.leave();
    if (GAMES2 && view2 === "games") GAMES2.home();
    if (view2 !== ui.view) ui.tool = null;
    ui.view = view2;
    render();
    window.scrollTo(0, 0);
  }

  // src/app/importer.ts
  var POS_TAIL_RE = /(?:^|\s)((?:(?:n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|interj|aux|abbr|pl|phr)\.\s*(?:&\s*)?)+)\s*$/i;
  function parseLine(raw) {
    let line = raw.replace(/^﻿/, "").trim();
    if (!line || line.startsWith("#")) return null;
    line = line.replace(/^\d+\s*[.、)）:：]\s*/, "");
    let w = "";
    let p = "";
    let m = "";
    if (line.includes("	")) {
      const parts = line.split("	").map((s) => s.trim()).filter(Boolean);
      w = parts.shift() || "";
      if (parts.length > 1 && /^[\/\[].*[\/\]]$/.test(parts[0])) p = parts.shift().slice(1, -1);
      m = parts.join("|");
    } else {
      line = line.replace(/"/g, "");
      const i = line.search(CJK_RE);
      let head = i >= 0 ? line.slice(0, i) : line;
      m = i >= 0 ? line.slice(i).trim() : "";
      const pm = head.match(/[\/\[]([^\/\]]+)[\/\]]/);
      if (pm) {
        p = pm[1].trim();
        head = head.replace(pm[0], " ");
      }
      const pos = head.match(POS_TAIL_RE);
      if (pos) {
        m = (pos[1].trim() + " " + m).trim();
        head = head.slice(0, pos.index);
      }
      head = head.replace(/[\s,，;；:：=|\-—–]+$/, "").trim();
      if (i < 0) {
        const sep = head.match(/\s*[,，;；:：=|\t]\s*|\s+[-—–]\s+/);
        if (sep) {
          m = head.slice(sep.index + sep[0].length).trim();
          head = head.slice(0, sep.index).trim();
        }
      }
      w = head;
    }
    w = w.replace(/\s+/g, " ").trim();
    if (!/[A-Za-z]/.test(w) || w.length > 80) return { bad: raw.trim() };
    return { w, p, m };
  }
  function jsonToLines(text) {
    const t = String(text || "").trim();
    if (!t.startsWith("[")) return text;
    try {
      const arr = JSON.parse(t);
      if (!Array.isArray(arr)) return text;
      return arr.map((o) => {
        if (!o || typeof o !== "object") return "";
        const w = o.name || o.word || o.w || "";
        let m = o.trans || o.translation || o.m || "";
        if (Array.isArray(m)) m = m.join("|");
        return w ? w + "	" + String(m).replace(/\t/g, " ") : "";
      }).join("\n");
    } catch (e) {
      return text;
    }
  }
  function parseImport(text) {
    text = jsonToLines(text);
    const words = [];
    const seen = /* @__PURE__ */ new Map();
    let filled = 0;
    const bad = [];
    for (const raw of String(text || "").split(/\r?\n/)) {
      const r = parseLine(raw);
      if (!r) continue;
      if (r.bad) {
        bad.push(r.bad);
        continue;
      }
      const hit = LOOKUP.get(r.w.toLowerCase());
      if (hit) {
        if (!r.m) {
          r.m = hit.m;
          filled++;
        }
        if (!r.p) r.p = hit.p || "";
      }
      const k = keyOf(r.w);
      if (seen.has(k)) {
        const old = seen.get(k);
        if (!old.m && r.m) old.m = r.m;
        continue;
      }
      const e = { w: r.w, p: r.p, m: r.m };
      seen.set(k, e);
      words.push(e);
    }
    const missing = words.filter((e) => !e.m);
    return { words, filled, missing, bad };
  }
  function decodeFile(buf) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch (e) {
      try {
        return new TextDecoder("gbk").decode(buf);
      } catch (e2) {
        return new TextDecoder("utf-8").decode(buf);
      }
    }
  }
  function createBook(name, words) {
    const id = "u" + Date.now().toString(36);
    const book = { id, name: (name || "").trim() || "我的词表 " + (Object.keys(state.books).length + 1), words, t: Date.now() };
    state.books[id] = book;
    return book;
  }
  function openNewBook(book, added) {
    state.settings.book = book.id;
    save();
    ui.book = { id: book.id, q: "", limit: 200 };
    go("book");
    toast("已导入 " + added + " 个词");
  }

  // src/app/session.ts
  function startNew() {
    const s = state.settings;
    const book = studyBook();
    const left = s.goal - learnedToday();
    const n = left > 0 ? Math.min(s.size, left) : s.size;
    const fresh = available(bookEntries(book)).filter((e) => !state.stats[keyOf(e.w)]);
    if (!fresh.length) {
      toast(bookEntries(book).length ? "这个词库的词都背过了，换一个词库吧" : "这个词表还没有词");
      return;
    }
    const words = s.order === "random" ? shuffle(fresh.slice()).slice(0, n) : shuffle(fresh.slice(0, n));
    startSession(words, book, "new");
  }
  function startReview() {
    const { remaining } = reviewPool();
    if (!remaining.length) {
      toast("今天的复习做完了");
      return;
    }
    startSession(shuffle(remaining.slice()).slice(0, state.settings.size), REVIEW_BOOK, "review");
  }
  function startWrong() {
    const list = available(Object.values(state.wrong));
    if (!list.length) {
      toast("错题本是空的");
      return;
    }
    startSession(shuffle(list.slice()).slice(0, state.settings.size), WRONG_BOOK, "wrong");
  }
  function startSession(words, bookId, kind) {
    ui.session = { kind, bookId, words, stage: -1, mode: null, items: [], idx: 0, results: [], stageResults: [], retries: [], repeat: false, attempt: 1, pending: null, between: false, ended: false };
    beginStage(0);
    petJoinStudy();
  }
  function finishSession() {
    const ss = ui.session;
    if (ss && !ss.finished) {
      ss.finished = true;
      const allOk = /* @__PURE__ */ new Map();
      for (const r of allResults(ss)) {
        const k = keyOf(r.entry.w);
        allOk.set(k, allOk.get(k) !== false && r.ok);
      }
      for (const [k, ok] of allOk) if (ok) delete state.wrong[k];
      const all = allResults(ss);
      rewardGroup("word", ss.words.length, !ss.ended && all.length > 0 && all.every((r) => r.ok), ss.ended);
      save();
    }
    go("result");
  }
  function beginStage(n) {
    const ss = ui.session;
    ss.attempt = n === ss.stage ? ss.attempt + 1 : 1;
    ss.repeat = false;
    while (n < STAGES.length && !usable(ss.words, STAGES[n]).length) n++;
    if (n >= STAGES.length) {
      finishSession();
      return;
    }
    Object.assign(ss, { stage: n, mode: STAGES[n], items: shuffle(usable(ss.words, STAGES[n]).slice()), idx: 0, results: [], pending: null, between: false, animIdx: -1, animRow: 0 });
    go("practice");
    onPromptShown();
  }
  function nextStageIndex(ss) {
    for (let n = ss.stage + 1; n < STAGES.length; n++) if (usable(ss.words, STAGES[n]).length) return n;
    return -1;
  }
  function endStage() {
    const ss = ui.session;
    ss.stageResults[ss.stage] = ss.results;
    if (state.settings.forceAll && ss.results.some((r) => !r.ok)) {
      ss.repeat = true;
      ss.between = true;
      render();
      petSay("repeat");
      return;
    }
    if (nextStageIndex(ss) < 0) {
      finishSession();
      return;
    }
    ss.between = true;
    setTimeout(() => petSay(ss.results.every((r) => r.ok) ? "stagePerfect" : "stage"), 50);
    render();
  }
  function continueStage() {
    const ss = ui.session;
    if (!ss || !ss.between) return;
    if (ss.repeat) {
      ss.retries.push({ stage: ss.stage, results: ss.results });
      ss.stageResults[ss.stage] = null;
      beginStage(ss.stage);
      return;
    }
    beginStage(nextStageIndex(ss));
  }
  function current() {
    const ss = ui.session;
    return ss && ss.items[ss.idx];
  }
  function onPromptShown() {
    const ss = ui.session;
    const e = current();
    if (!e) return;
    if (ss.mode !== "zh2en") speak(e.w);
  }
  function submitAnswer() {
    const ss = ui.session;
    if (!ss) return;
    if (ss.pending) {
      submitPending();
      return;
    }
    const entry = current();
    let ok;
    let answer;
    let lines = null;
    let marks = null;
    if (ss.mode === "en2zh") {
      lines = [...document.querySelectorAll(".ans")].map((el) => el.value);
      const j = judgeZhLines(lines, entry);
      ok = j.ok;
      marks = j.marks;
      answer = lines.map((t) => t.trim()).filter(Boolean).join("；");
    } else {
      const input = document.getElementById("answer");
      answer = (input ? input.value : "").trim();
      ok = judge(ss.mode, entry, answer);
    }
    const result = { entry, answer, lines, marks, ok };
    const again = !ok && wrongBefore(entry);
    bump(entry, ss.mode, ok);
    applyOutcome(entry, ok);
    rewardAnswer(ss, ok, again);
    if (ss.kind === "review") markReviewed(entry);
    save();
    if (ok) {
      ss.results.push(result);
      advance();
    } else {
      ss.pending = result;
      render();
      if (ss.mode === "listen") speak(entry.w);
    }
  }
  function needsCopy(ss) {
    return ss.mode !== "en2zh" && state.settings.copyWrong && ss.pending && !ss.pending.ok;
  }
  function submitPending() {
    const ss = ui.session;
    const input = document.getElementById("answer");
    if (needsCopy(ss) && input) {
      const v = input.value;
      if (v.trim() && !enMatch(v, ss.pending.entry.w)) {
        input.classList.remove("shake");
        void input.offsetWidth;
        input.classList.add("shake");
        input.select();
        return;
      }
    }
    finishPending();
  }
  function skipKnown() {
    const ss = ui.session;
    if (!ss || ss.pending) return;
    const e = current();
    markKnown(e);
    ss.words = ss.words.filter((w) => w !== e);
    save();
    toast("「" + e.w + "」标记为已掌握，以后不再出现");
    advance();
  }
  function finishPending() {
    const ss = ui.session;
    ss.results.push(ss.pending);
    ss.pending = null;
    advance();
  }
  function advance() {
    const ss = ui.session;
    ss.idx++;
    if (ss.idx >= ss.items.length) {
      endStage();
      return;
    }
    render();
    onPromptShown();
  }
  function quitSession() {
    const ss = ui.session;
    if (!ss) return go("home");
    if (ss.pending) {
      ss.results.push(ss.pending);
      ss.pending = null;
    }
    if (ss.stage >= 0) ss.stageResults[ss.stage] = ss.results;
    if (!allResults(ss).length) {
      ui.session = null;
      return go("home");
    }
    ss.ended = true;
    finishSession();
  }
  function allResults(ss) {
    return [].concat(...ss.stageResults.filter(Boolean), ...ss.retries.map((x) => x.results));
  }
  function stageAll(ss, i) {
    return [].concat(...ss.retries.filter((x) => x.stage === i).map((x) => x.results), ss.stageResults[i] || []);
  }

  // src/app/views/settings.ts
  function chipsHtml(key, options) {
    const cur = state.settings[key];
    return '<div class="chips">' + options.map(([val, label]) => '<button class="chip' + (cur === val ? " on" : "") + '" data-act="setting" data-key="' + key + '" data-val="' + esc(JSON.stringify(val)) + '">' + label + "</button>").join("") + "</div>";
  }
  VIEWS.settings = function() {
    return '<main class="page"><h1 class="h1">设置</h1><p class="sub">改动会自动保存。</p><div class="section panel set-list"><div class="set-row"><div><div class="t">发音口音</div></div><div>' + chipsHtml("accent", [["us", "美式"], ["uk", "英式"]]) + '</div></div><div class="set-row"><div><div class="t">发音来源</div></div><div>' + chipsHtml("voice", [["auto", "真人发音"], ["browser", "电脑语音"]]) + '<div class="d">真人发音来自有道词典，需要联网；连不上时会自动改用电脑自带的语音。电脑语音不用联网，但效果取决于你的系统。</div><div class="actions" style="margin-top:12px"><button class="btn small ghost" data-act="testVoice">试听</button></div></div></div><div class="set-row"><div><div class="t">读音</div></div><div class="d" style="margin-top:0">「英 → 中」和「听 → 写」出词时自动朗读，按 Tab 再听一遍；「中 → 英」不出声。</div></div><div class="set-row"><div><div class="t">每组几个词</div></div><div>' + chipsHtml("size", [[5, "5"], [10, "10"], [15, "15"], [20, "20"]]) + '</div></div><div class="set-row"><div><div class="t">强制全对</div></div><div>' + chipsHtml("forceAll", [[true, "开"], [false, "关"]]) + '<div class="d">背单词和词根时，一组词在某一步（如「英 → 中」）只要错一个，这一步做完后整组再来一遍，直到全对才进入下一步。</div></div></div><div class="set-row"><div><div class="t">拼错后照打一遍</div></div><div>' + chipsHtml("copyWrong", [[true, "开"], [false, "关"]]) + '<div class="d">拼写题答错后，照着正确拼写再打一遍，免得记住错的拼法。直接按 Enter 可以跳过。</div></div></div><div class="set-row"><div><div class="t">字母个数提示</div></div><div>' + chipsHtml("letterHint", [[true, "显示"], [false, "不显示"]]) + '<div class="d">拼写题下面显示 _ _ _ _，提示单词有几个字母。</div></div></div><div class="set-row"><div><div class="t">宠物在页面上走动</div></div><div>' + chipsHtml("petRoam", [[true, "开"], [false, "关"]]) + '<div class="d">陪你背单词的宠物在页面上走动、说话。</div></div></div><div class="set-row"><div><div class="t">外观</div></div><div>' + chipsHtml("theme", [["auto", "跟随系统"], ["light", "浅色"], ["dark", "深色"]]) + '</div></div><div class="set-row"><div><div class="t">字体粗细</div></div><div>' + chipsHtml("weight", [["light", "细"], ["normal", "标准"], ["bold", "粗"]]) + '<div class="d">仿宋本身笔画比较细，觉得还是细就选「粗」。</div></div></div>' + (!/^https?:$/.test(location.protocol) ? "" : '<div class="set-row"><div><div class="t">下载到电脑</div></div><div><a class="btn small ghost" href="Margin.html" download="Marginal Vocabulary.html">下载 Marginal Vocabulary.html</a><div class="d">下载后双击就能打开，不用联网。进度不会自动带过去，需要的话先导出备份，再在下载的版本里导入。</div></div></div>') + updateSettingHtml() + '<div class="set-row"><div><div class="t">数据备份</div><div class="d">进度只保存在这台电脑的这个浏览器里。</div></div><div><div class="actions"><button class="btn small" data-act="exportData">导出备份</button><label class="btn small ghost file-pick">导入备份<input type="file" id="backup-file" accept=".json,application/json"></label><button class="link" data-act="resetAll">清空所有数据</button></div><div class="d">换电脑、换浏览器或清理浏览器数据之前，先导出备份；到新地方打开 Marginal Vocabulary 后再导入。</div></div></div><div class="set-row"><div><div class="t">关于</div></div><div class="d" style="margin-top:0">Marginal Vocabulary · 背单词工具。<br>Finance、MacroFin、Medicine 词库和词根由 Marginal Vocabulary 整理，译名参考国内通行教材和标准术语；发现不准欢迎到 GitHub 反馈。<br>CET-4、CET-6、GEE、TOEFL、IELTS、GRE、GMAT 词库与音标来自开源词典 ECDICT（MIT 许可证）。</div></div></div></main>';
  };

  // src/app/views/home.ts
  VIEWS.home = function() {
    const s = state.settings;
    const book = studyBook();
    const day = state.log[todayKey()] || { n: 0, r: 0 };
    const learned = learnedToday();
    const rv = reviewPool();
    const rvTotal = rv.done + rv.remaining.length;
    const left = s.goal - learned;
    const st = streak();
    const d = /* @__PURE__ */ new Date();
    const week = "日一二三四五六"[d.getDay()];
    const pct = (a, b) => b ? Math.min(100, a / b * 100) : 100;
    const orders = chipsHtml("order", [
      ["new", "按词表顺序"],
      ["random", "随机"]
    ]);
    const title = left <= 0 ? "今天的目标完成了" : learned ? "还差 " + left + " 个新词" : "今天背 " + s.goal + " 个新词";
    const sub = left <= 0 ? "想多背一点，可以再来一组。" : learned ? "已经背了 " + learned + " 个，接着来。" : "一组一组来，每组过三步：英 → 中、中 → 英、听 → 写。";
    return '<main class="page home"><p class="label">' + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 · 星期" + week + '</p><section class="hero' + (left <= 0 ? " done" : "") + '"><div class="hero-main"><p class="label">今日新词 · ' + esc(bookName(book)) + '</p><h1 class="h1">' + title + '</h1><p class="sub">' + sub + '</p><div class="actions"><button class="btn big" data-act="startNew">' + (left > 0 ? "背新词" : "再背一组") + " <kbd>Enter</kbd></button></div></div>" + ringHtml(learned, s.goal, "新词") + '</section><div class="tasks"><div class="task"><p class="label">复习</p><div class="num">' + fmt(rv.done) + "<small> / " + fmt(rvTotal) + '</small></div><div class="bar"><i style="width:' + pct(rv.done, rvTotal) + '%"></i></div><p class="muted">昨天的新词、错题本和到期的词</p><button class="btn ghost" data-act="startReview"' + (rv.remaining.length ? "" : " disabled") + ">" + (rv.remaining.length ? "开始复习 <kbd>R</kbd>" : rvTotal ? "复习完了" : "今天没有要复习的词") + '</button></div><div class="task streak' + (st ? " on" : "") + '"><p class="label">打卡</p><div class="num"><span class="spark">' + ICON_SPARK + "</span>" + fmt(st) + '<small> 天</small></div><p class="muted">' + (st ? "已连续打卡 " + st + " 天" : "今天背一组，就开始打卡") + '</p><div class="mini"><div><b>' + fmt(day.n) + "</b><span>今天答题</span></div><div><b>" + (day.n ? Math.round(day.r / day.n * 100) + "%" : "—") + "</b><span>今天正确率</span></div></div></div></div>" + gardenCardHtml() + challengesHtml(true) + '<section class="panel prefs"><p class="label">背什么</p><div class="pref"><span class="t">词库</span><label class="select"><select data-act="setBook" aria-label="词库">' + bookOptionsHtml(book) + '</select></label></div><div class="pref"><span class="t">每天背多少新词</span>' + chipsHtml("goal", [10, 20, 30, 50, 100].map((n) => [n, String(n)])) + '</div><div class="pref"><span class="t">新词顺序</span>' + orders + "</div></section>" + heatmapHtml() + "</main>";
  };
  function heatmapHtml() {
    const WEEKS = 52;
    const today = dayNum();
    const dow = (/* @__PURE__ */ new Date()).getDay();
    const start2 = today - dow - (WEEKS - 1) * 7;
    let cells = "";
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const n = start2 + w * 7 + d;
        if (n > today) {
          cells += '<i class="hm-x"></i>';
          continue;
        }
        const key = dayKeyOf(n);
        const rec = state.log[key] || { n: 0, r: 0 };
        const lv = rec.n === 0 ? 0 : rec.n < 10 ? 1 : rec.n < 30 ? 2 : rec.n < 60 ? 3 : 4;
        const tip = key + " · " + (rec.n ? "答题 " + rec.n + "，正确率 " + Math.round(rec.r / rec.n * 100) + "%" : "没有背");
        cells += '<i class="hm-' + lv + '" title="' + tip + '"></i>';
      }
    }
    const total = Object.keys(state.stats).length;
    return '<section class="panel heat"><div class="head-row"><p class="label">最近一年</p><span class="muted">累计背过 ' + fmt(total) + " 词 · 已掌握 " + fmt(Object.keys(state.known).length) + ' 词</span></div><div class="hm" aria-label="最近一年每天的答题量">' + cells + '</div><div class="hm-legend" aria-hidden="true"><span>少</span><i class="hm-0"></i><i class="hm-1"></i><i class="hm-2"></i><i class="hm-3"></i><i class="hm-4"></i><span>多</span></div></section>';
  }
  AFTER.home = function() {
    const hm = document.querySelector(".hm");
    if (hm) hm.scrollLeft = hm.scrollWidth;
  };

  // src/app/views/practice.ts
  function slotsHtml(w) {
    if (!state.settings.letterHint) return "";
    let letters = 0;
    const s = Array.from(w).map((c) => {
      if (/[A-Za-z0-9]/.test(c)) {
        letters++;
        return "_";
      }
      return c === " " ? "&nbsp;&nbsp;" : esc(c);
    }).join("");
    return '<div class="slots" aria-label="' + letters + ' 个字母">' + s + '<span class="n">' + letters + "</span></div>";
  }
  function zhDetailHtml(r) {
    const layers = layersOf(r.entry.m);
    const yours = (r.lines || []).map((t, i) => {
      const ok = r.marks && r.marks[i] === true;
      return '<div class="y ' + (ok ? "ok" : "bad") + '"><span class="mk">' + (ok ? ICON_OK : ICON_BAD) + "</span>" + (t.trim() ? esc(t.trim()) : '<span class="none">没写</span>') + "</div>";
    });
    const right = layers.map((L, i) => '<div class="r"><span class="no">' + (i + 1) + ".</span>" + esc(L.terms.join("；")) + "</div>");
    return '<div class="h-detail">' + (r.ok ? "" : '<div class="h-yours">' + yours.join("") + "</div>") + '<div class="h-right">' + right.join("") + "</div></div>";
  }
  function historyHtml(ss) {
    return ss.results.map((r, i) => {
      const fresh = i === ss.results.length - 1 && ss.animRow !== ss.results.length ? " fresh" : "";
      const yours = r.ok ? "" : r.answer ? '<span class="yours">' + esc(r.answer) + "</span>" : '<span class="yours none">没答</span>';
      return '<div class="h-row ' + (r.ok ? "ok" : "bad") + fresh + '"><span class="h-no">' + String(i + 1).padStart(2, "0") + '</span><span class="h-mark" aria-label="' + (r.ok ? "答对" : "答错") + '">' + (r.ok ? ICON_OK : ICON_BAD) + "</span>" + // 「中 → 英」这一步不出声，答过的词也不能点读
      (ss.mode === "zh2en" ? '<span class="h-word">' + esc(r.entry.w) + "</span>" : '<button class="h-word" data-act="speakWord" data-w="' + esc(r.entry.w) + '" title="朗读">' + esc(r.entry.w) + "</button>") + (ss.mode === "en2zh" && r.lines ? zhDetailHtml(r) : '<span class="h-mean" title="' + esc(meaningLines(r.entry.m).join("\n")) + '">' + yours + esc(shortMeaning(r.entry.m)) + "</span>") + "</div>";
    }).join("");
  }
  function promptHtml(ss, e) {
    if (ss.mode === "en2zh") {
      return '<div class="prompt-word">' + esc(e.w) + '</div><div class="prompt-phon">' + (e.p ? "/" + esc(e.p) + "/" : "") + '<button class="icon-btn" data-act="speakCurrent" title="朗读（Tab）">' + ICON_SPEAK + "</button></div>";
    }
    if (ss.mode === "zh2en") {
      return '<div class="prompt-mean">' + meaningHtml(e.m, e.w) + "</div>" + slotsHtml(e.w);
    }
    return '<button class="speak-big" data-act="speakCurrent" title="再听一遍（Tab）">' + ICON_SPEAK + "</button>" + slotsHtml(e.w);
  }
  function feedbackHtml(ss, r) {
    const e = r.entry;
    const copy = needsCopy(ss);
    let body;
    if (ss.mode === "en2zh") {
      body = '<div class="fb-label">参考释义</div><div class="fb-mean">' + meaningHtml(e.m) + "</div>";
    } else {
      body = (copy && r.answer ? '<div class="fb-yours">你写的：<s>' + esc(r.answer) + "</s></div>" : "") + '<div class="fb-label">正确拼写</div><div class="fb-word">' + esc(e.w) + "</div>" + (e.p ? '<div class="fb-phon">/' + esc(e.p) + "/</div>" : "") + (ss.mode === "listen" ? '<div class="fb-mean">' + meaningHtml(e.m) + "</div>" : "");
    }
    const parts = breakdownLines(e.w);
    if (parts.length) body += '<div class="fb-parts">' + parts.map(esc).join("<br>") + "</div>";
    return '<div class="feedback">' + body + '<div class="actions"><button class="btn small" data-act="next">继续 <kbd>Enter</kbd></button></div></div>';
  }
  function betweenHtml(ss) {
    const right = ss.results.filter((r) => r.ok).length;
    if (ss.repeat) {
      const bad = ss.results.length - right;
      return '<div class="stage-done again"><p class="label">第 ' + (ss.stage + 1) + " 步 · " + MODES[ss.mode].name + (ss.attempt > 1 ? " · 第 " + ss.attempt + " 遍" : "") + '</p><div class="stage-score">' + right + "<small> / " + ss.results.length + '</small></div><p class="muted">错了 ' + bad + ' 个。已开启强制全对，这一步整组再来一遍，全对才进入下一步。</p><div class="actions"><button class="btn" data-act="continueStage">再来一遍 <kbd>Enter</kbd></button></div></div>';
    }
    const next = MODES[STAGES[nextStageIndex(ss)]];
    const perfect = right === ss.results.length;
    return '<div class="stage-done' + (perfect ? " perfect" : "") + '">' + (perfect ? BURST : "") + '<p class="label">第 ' + (ss.stage + 1) + " 步完成 · " + MODES[ss.mode].name + '</p><div class="stage-score">' + right + "<small> / " + ss.results.length + '</small></div><p class="muted">下一步：' + next.name + " · " + next.desc + '</p><div class="actions"><button class="btn" data-act="continueStage">继续 <kbd>Enter</kbd></button></div></div>';
  }
  function stepsHtml(ss) {
    return STAGES.map((k, i) => '<span class="step' + (i === ss.stage ? " on" : i < ss.stage ? " done" : "") + '">' + (i + 1) + " " + MODES[k].name + (i === ss.stage && ss.attempt > 1 ? " · 第 " + ss.attempt + " 遍" : "") + "</span>").join("");
  }
  VIEWS.practice = function() {
    const ss = ui.session;
    if (!ss) return VIEWS.home();
    const e = current();
    const counts = STAGES.map((k) => usable(ss.words, k).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const before = counts.slice(0, ss.stage).reduce((a, b) => a + b, 0);
    const done = before + ss.results.length + (ss.pending ? 1 : 0);
    const pct = Math.min(100, done / total * 100);
    const pend = ss.pending;
    const copy = needsCopy(ss);
    const placeholder = copy ? "照着打一遍，或直接按 Enter 继续" : "拼写英文";
    const anim = ss.animIdx !== ss.idx ? " anim" : "";
    let inputs;
    if (ss.between) inputs = "";
    else if (ss.mode === "en2zh") {
      const n = pend && pend.lines ? pend.lines.length : zhLineCount(e);
      inputs = '<div class="zh-lines' + (n > 4 ? " many" : "") + '">';
      for (let i = 0; i < n; i++) {
        const mk = pend && pend.marks ? pend.marks[i] : void 0;
        const cls = mk === true ? " ok" : mk === false ? " bad" : "";
        inputs += '<div class="zl' + cls + '"><span class="zl-mark">' + (mk === true ? ICON_OK : mk === false ? ICON_BAD : "") + '</span><span class="zl-no">' + (i + 1) + '.</span><input class="answer ans" ' + (i === 0 ? 'id="answer" ' : "") + 'data-line="' + i + '" autocomplete="off" spellcheck="false"' + (pend ? ' readonly value="' + esc(pend.lines[i] || "") + '"' : "") + "></div>";
      }
      inputs += "</div>";
    } else {
      inputs = '<input id="answer" class="answer en' + (pend && !copy ? " wrong" : "") + (copy ? " copy" : "") + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="' + placeholder + '"' + (pend && !copy ? ' readonly value="' + esc(pend.answer) + '"' : "") + ">";
    }
    const hint = ss.mode === "en2zh" ? '<div class="hint"><span>一行写一个意思，<kbd>Enter</kbd> 换行</span><span>写完最后一行按 <kbd>Enter</kbd> 提交</span><span><kbd>Tab</kbd> 再听一遍</span><button class="link" data-act="skipKnown" title="以后不再出这个词">已掌握，跳过</button></div>' : '<div class="hint"><span><kbd>Enter</kbd> 提交</span><span>空着按 <kbd>Enter</kbd> = 不会</span>' + (ss.mode === "listen" ? "<span><kbd>Tab</kbd> 再听一遍</span>" : "") + '<button class="link" data-act="skipKnown" title="以后不再出这个词">已掌握，跳过</button></div>';
    const history = ss.results.length ? historyHtml(ss) : '<div class="h-empty">答过的词会一行一行留在这里</div>';
    return '<main class="practice"><div class="p-top"><span class="steps">' + stepsHtml(ss) + '<span class="book">' + esc(bookName(ss.bookId)) + '</span></span><span class="right"><span>' + (ss.between ? ss.items.length : ss.idx + 1) + " / " + ss.items.length + '</span><button class="link" data-act="quit">结束 Esc</button></span></div><div class="bar"><i style="width:' + pct + '%"></i></div><div class="history' + (ss.results.length ? "" : " empty") + '" id="history">' + history + "</div>" + (ss.between ? '<section class="card"><div class="inner anim">' + betweenHtml(ss) + "</div></section></main>" : "") + (ss.between ? "" : '<section class="card"><div class="inner' + anim + '">' + promptHtml(ss, e) + inputs + (pend ? feedbackHtml(ss, pend) : hint) + "</div></section></main>");
  };
  AFTER.practice = function() {
    const ss = ui.session;
    if (ss) {
      ss.animIdx = ss.idx;
      ss.animRow = ss.results.length;
    }
    const h = document.getElementById("history");
    if (h) h.scrollTop = h.scrollHeight;
    const input = document.getElementById("answer");
    if (input) input.focus();
  };
  function wrongWords(ss) {
    const map = /* @__PURE__ */ new Map();
    STAGES.forEach((_, i) => {
      stageAll(ss, i).forEach((r) => {
        const k = keyOf(r.entry.w);
        if (!map.has(k)) map.set(k, { entry: r.entry, marks: [], bad: false });
        const x = map.get(k);
        x.marks[i] = x.marks[i] === false ? false : r.ok;
        if (!r.ok) x.bad = true;
      });
    });
    return [...map.values()].filter((x) => x.bad);
  }
  function nextLabel(ss) {
    if (ss.kind === "root") return "";
    if (ss.kind === "new" || ss.kind === "retry") {
      const left = state.settings.goal - learnedToday();
      return left > 0 ? "下一组新词 · 今天还差 " + left + " 个" : "再背一组新词";
    }
    if (ss.kind === "review") {
      const n2 = reviewPool().remaining.length;
      return n2 ? "继续复习 · 还剩 " + n2 + " 个" : "";
    }
    const n = available(Object.values(state.wrong)).length;
    return n ? "继续练错题本 · 还有 " + n + " 个" : "";
  }

  // src/app/views/result.ts
  VIEWS.result = function() {
    const ss = ui.session;
    if (!ss) return VIEWS.home();
    const all = allResults(ss);
    const total = all.length;
    const right = all.filter((r) => r.ok).length;
    const wrong = wrongWords(ss);
    const stageLine = STAGES.map((k, i) => {
      const res = stageAll(ss, i);
      const reps = ss.retries.filter((x) => x.stage === i).length;
      return '<div><div class="num">' + (res.length ? res.filter((r) => r.ok).length + "<small> / " + res.length + "</small>" : "—") + '</div><div class="cap">' + (i + 1) + " · " + MODES[k].name + (reps ? " · 重来 " + reps + " 遍" : "") + "</div></div>";
    }).join("");
    const mark = (v, i) => '<span class="mk' + (v === true ? " ok" : v === false ? " bad" : "") + '" title="' + MODES[STAGES[i]].name + '">' + (v === true ? ICON_OK : v === false ? ICON_BAD : "·") + "</span>";
    const list = wrong.length ? '<div class="section"><div class="head-row"><p class="label">答错过的词 · ' + wrong.length + '</p><span class="muted">右边三个标记依次是 英→中、中→英、听→写</span></div>' + wrong.map(
      (x) => '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(x.entry.w) + '">' + esc(x.entry.w) + (x.entry.p ? "<small>/" + esc(x.entry.p) + "/</small>" : "") + '</button><span class="m">' + meaningHtml(x.entry.m) + '</span><span class="side marks">' + [0, 1, 2].map((i) => mark(x.marks[i], i)).join("") + "</span></div>"
    ).join("") + "</div>" : "";
    const rate = total ? Math.round(right / total * 100) : 0;
    const perfect = total > 0 && right === total;
    const word = perfect ? "全对，漂亮。" : rate >= 80 ? "很稳，错的几个再练一下就好。" : "错的词已经记进错题本，复习时还会出现。";
    return '<main class="page"><section class="result-hero' + (perfect ? " perfect" : "") + '">' + (perfect ? BURST : "") + '<p class="label">' + (ss.ended ? "提前结束" : "本轮结束") + " · " + esc(bookName(ss.bookId)) + '</p><div class="score">' + right + "<small> / " + total + '</small></div><p class="rate">正确率 ' + rate + "% · " + word + '</p></section><div class="today stage-line">' + stageLine + '</div><div class="actions" style="margin-top:32px">' + (wrong.length ? '<button class="btn" data-act="retryWrong">再练错的 ' + wrong.length + " 个 <kbd>R</kbd></button>" : "") + (nextLabel(ss) ? '<button class="btn ' + (wrong.length ? "ghost" : "") + '" data-act="nextGroup">' + nextLabel(ss) + " <kbd>Enter</kbd></button>" : "") + '<button class="link" data-act="nav" data-view="home">回首页</button></div>' + list + "</main>";
  };

  // src/app/views/books.ts
  function bookRowHtml(id, extra) {
    const list = bookEntries(id);
    const seen = seenCount(list);
    const pct = list.length ? seen / list.length * 100 : 0;
    const kind = findTerm(id) ? "专业词库" : findExam(id) ? "考试词库" : "我的词表";
    return '<div class="book-row"><div><div class="kind">' + kind + '</div><div class="name">' + esc(bookName(id)) + '</div><div class="meta"><span>' + fmt(list.length) + " 词</span><span>已背 " + fmt(seen) + '</span><span class="prog"><i style="width:' + pct + '%"></i></span></div></div><div class="side">' + (extra || "") + '<button class="link" data-act="viewBook" data-id="' + esc(id) + '">查看</button><button class="btn small ghost" data-act="useBook" data-id="' + esc(id) + '">背这个</button></div></div>';
  }
  VIEWS.books = function() {
    const mine = Object.values(state.books).sort((a, b) => a.t - b.t);
    return '<main class="page"><h1 class="h1">词库</h1><div class="section book-grid">' + allBooks().map((id) => bookRowHtml(id)).join("") + '</div><div class="section mine"><div class="head-row"><h2 class="h2">我的词表</h2><div class="actions"><button class="btn small" data-act="newImport">＋ 粘贴单词</button><label class="btn small ghost file-pick">上传文件<input type="file" id="upload-book" accept=".txt,.csv,.tsv,.json,text/plain,text/csv,application/json"></label></div></div><p class="sub">把自己要背的单词做成词表：直接粘贴，或者上传 .txt、.csv 文件（Excel 可以另存为 .csv）。只写英文也行，常见词会自动补上中文意思。</p>' + (mine.length ? '<div class="book-grid">' + mine.map((b) => bookRowHtml(b.id, '<button class="link" data-act="deleteBook" data-id="' + esc(b.id) + '">删除</button>')).join("") + "</div>" : '<div class="empty">还没有自己的词表。</div>') + "</div></main>";
  };
  function bookRowsHtml() {
    const id = ui.book.id;
    const all = bookEntries(id);
    const q = ui.book.q.trim().toLowerCase();
    const list = q ? all.filter((e) => e.w.toLowerCase().includes(q) || String(e.m).includes(q)) : all;
    const custom = !isBuiltin(id) && id !== WRONG_BOOK;
    const shown = list.slice(0, ui.book.limit);
    if (!list.length) return '<div class="empty">' + (q ? "没有找到「" + esc(q) + "」" : "这个词表还没有词") + "</div>";
    return shown.map((e) => {
      const k = keyOf(e.w);
      const s = state.stats[k];
      const tag = e.t ? "<span>" + esc(e.t) + "</span>" : "";
      const known = state.known[k] ? "<span>已掌握</span>" : "";
      return '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + (e.p ? "<small>/" + esc(e.p) + "/</small>" : "") + '</button><span class="m">' + (meaningHtml(e.m) || "（没有释义）") + '</span><span class="side">' + tag + (known || (s ? "<span>已背</span>" : "")) + (custom ? '<button class="link" data-act="deleteWord" data-w="' + esc(e.w) + '">删除</button>' : "") + "</span></div>";
    }).join("") + (list.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRows">再显示 200 个（还有 ' + fmt(list.length - shown.length) + " 个）</button></div>" : "");
  }
  VIEWS.book = function() {
    const id = ui.book.id;
    if (!bookExists(id)) return VIEWS.books();
    const custom = !isBuiltin(id);
    return '<main class="page"><p class="label"><button class="link" data-act="nav" data-view="books">← 词库</button></p><h1 class="h1">' + esc(bookName(id)) + '</h1><p class="sub">' + fmt(bookEntries(id).length) + ' 词 · 点单词可以听发音</p><div class="actions"><button class="btn small" data-act="useBook" data-id="' + esc(id) + '">背这个词表</button>' + (custom ? '<button class="btn small ghost" data-act="appendImport" data-id="' + esc(id) + '">添加单词</button><button class="link" data-act="renameBook" data-id="' + esc(id) + '">改名</button>' : "") + '<button class="link" data-act="exportBook" data-id="' + esc(id) + '">导出为表格</button></div><div class="section"><input class="field" id="book-q" placeholder="搜索单词或中文" value="' + esc(ui.book.q) + '" autocomplete="off"></div><div class="section" id="book-rows">' + bookRowsHtml() + "</div></main>";
  };
  function previewHtml() {
    const d = ui.draft;
    if (!d || !d.text.trim()) return '<span class="muted">粘贴后这里会显示识别结果。</span>';
    const r = parseImport(d.text);
    let s = "识别到 <b>" + r.words.length + "</b> 个词";
    if (r.filled) s += "，其中 " + r.filled + " 个自动补上了中文意思";
    s += "。";
    if (r.missing.length) {
      s += '<br><span class="muted">' + r.missing.length + " 个词没有中文意思，也没查到（" + esc(r.missing.slice(0, 5).map((e) => e.w).join("、")) + (r.missing.length > 5 ? " 等" : "") + "），这些词只能用「听 → 写」练。</span>";
    }
    if (r.bad.length) s += '<br><span class="muted">' + r.bad.length + " 行看不出英文单词，已跳过（" + esc(r.bad.slice(0, 3).join("、")) + "）。</span>";
    return s;
  }
  VIEWS.import = function() {
    const d = ui.draft;
    const target = d.target && state.books[d.target];
    return '<main class="page"><p class="label"><button class="link" data-act="nav" data-view="books">← 词库</button></p><h1 class="h1">' + (target ? "添加到「" + esc(target.name) + "」" : "导入新词表") + '</h1><p class="sub">把单词粘贴到下面，一行一个。只写英文也行，常见词会自动补上中文意思。</p>' + (target ? "" : '<div class="section" style="margin-top:0"><p class="label">词表名称</p><input class="field" id="draft-name" value="' + esc(d.name) + '" autocomplete="off"></div>') + '<div class="section grid2" style="grid-template-columns: 1.6fr 1fr"><div><p class="label">单词</p><textarea class="paste" id="draft-text" placeholder="abandon 放弃&#10;benefit n. 好处；利益&#10;candidate&#10;moral hazard 道德风险">' + esc(d.text) + '</textarea><div class="preview" id="draft-preview">' + previewHtml() + '</div></div><div><p class="label">支持的格式</p><div class="formats"><b>abandon 放弃</b><br><b>abandon	v. 放弃</b><br>从 Excel 复制两列也行<br><br><b>abandon /əˈbændən/ v. 放弃</b><br>带音标、词性<br><br><b>abandon</b><br>只写单词，自动查意思<br><br><b>moral hazard 道德风险</b><br>词组也可以</div><p style="margin-top:20px"><label class="file-pick link">或者选一个 .txt / .csv 文件<input type="file" id="draft-file" accept=".txt,.csv,.tsv,.json,text/plain,text/csv,application/json"></label></p></div></div><div class="actions" style="margin-top:40px"><button class="btn" data-act="saveImport">保存</button><button class="link" data-act="nav" data-view="books">取消</button></div></main>';
  };
  AFTER.import = function() {
    const t = document.getElementById("draft-text");
    if (t && !ui.draft.text) t.focus();
  };

  // src/app/views/wrong.ts
  VIEWS.wrong = function() {
    const list = Object.values(state.wrong).sort((a, b) => b.n - a.n || b.t - a.t);
    const known = Object.values(state.known).sort((a, b) => b.t - a.t);
    const knownHtml = '<div class="section"><div class="head-row"><p class="label">已掌握 · ' + known.length + " 词</p></div>" + (known.length ? known.map(
      (e) => '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + '</button><span class="m">' + meaningHtml(e.m) + '</span><span class="side"><button class="link" data-act="unknow" data-w="' + esc(e.w) + '">恢复</button></span></div>'
    ).join("") : '<div class="empty">背诵时点「已掌握，跳过」，这个词以后就不会再出现，会列在这里。</div>') + "</div>";
    return '<main class="page"><h1 class="h1">错题本</h1><p class="sub">答错的词会记在这里，每天的复习里都会有；一轮里每一步都答对，就自动移出。</p>' + (list.length ? '<div class="actions"><button class="btn" data-act="practiceWrong">练习错题本 · ' + list.length + ' 词</button><button class="link" data-act="exportBook" data-id="' + WRONG_BOOK + '">导出为表格</button><button class="link" data-act="clearWrong">清空错题本</button></div><div class="section">' + list.map(
      (e) => '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + (e.p ? "<small>/" + esc(e.p) + "/</small>" : "") + '</button><span class="m">' + meaningHtml(e.m) + '</span><span class="side"><span>错 ' + e.n + ' 次</span><button class="link" data-act="removeWrong" data-w="' + esc(e.w) + '">移出</button></span></div>'
    ).join("") + "</div>" : '<div class="empty">错题本是空的。</div>') + knownHtml + "</main>";
  };

  // src/app/roots/views.ts
  function rootList() {
    const q = ui.roots.q.trim().toLowerCase().replace(/^-+|-+$/g, "");
    let list = rootsOfBook(rootBook());
    if (ui.roots.type !== "all") list = list.filter((r) => r.type === ui.roots.type);
    if (!q) return list;
    const rank = (r) => r.forms.includes(q) ? 0 : r.forms.some((f) => f.startsWith(q)) ? 1 : 2;
    return list.filter((r) => r.forms.some((f) => f.includes(q)) || r.meaning.includes(q) || r.examples.some((x) => x.w.toLowerCase().includes(q))).sort((a, b) => rank(a) - rank(b));
  }
  function rootRowsHtml() {
    const list = rootList();
    const q = ui.roots.q.trim();
    if (!list.length) return '<div class="empty">' + (q ? "没有找到「" + esc(q) + "」" : "这个词库里没有用到这类词根") + "</div>";
    const idx = rootIndex(rootBook());
    const shown = list.slice(0, ui.roots.limit);
    return shown.map((r) => {
      const n = (idx.get(r.id) || []).length;
      return '<button class="list-row root-row" data-act="viewRoot" data-id="' + esc(r.id) + '"><span class="w">' + esc(rootForms(r)) + '</span><span class="m">' + esc(r.meaning) + '</span><span class="side"><span>' + ROOT_TYPES[r.type] + "</span>" + (n ? "<span>" + fmt(n) + " 词</span>" : "") + (state.rootStats[r.id] ? "<span>已学</span>" : "") + "</span></button>";
    }).join("") + (list.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRoots">再显示 200 个（还有 ' + fmt(list.length - shown.length) + " 个）</button></div>" : "");
  }
  function rootBookOptionsHtml(selected) {
    const opt = (id) => '<option value="' + esc(id) + '"' + (id === selected ? " selected" : "") + ">" + esc(rootBookName(id)) + "</option>";
    const mine = Object.values(state.books).sort((a, b) => a.t - b.t).map((b) => b.id);
    return ["all"].concat(allBooks(), mine).map(opt).join("");
  }
  VIEWS.roots = function() {
    const s = state.settings;
    const book = rootBook();
    const inBook = rootsOfBook(book);
    const learned = learnedRootsToday();
    const studied = inBook.filter((r) => state.rootStats[r.id]).length;
    const rv = rootReviewPool();
    const rvTotal = rv.done + rv.remaining.length;
    const left = s.rootGoal - learned;
    const pct = (a, b) => b ? Math.min(100, a / b * 100) : 100;
    const types = [["all", "全部"], ["prefix", "前缀"], ["root", "词根"], ["suffix", "后缀"]];
    const title = left <= 0 ? "今天的词根学完了" : learned ? "还差 " + left + " 个词根" : "今天学 " + s.rootGoal + " 个词根";
    return '<main class="page"><p class="label">词根 · ' + esc(rootBookName(book)) + " 用到 " + fmt(inBook.length) + ' 个词根词缀</p><section class="hero' + (left <= 0 ? " done" : "") + '"><div class="hero-main"><p class="label">今日词根</p><h1 class="h1">' + title + '</h1><p class="sub">每组 ' + ROOT_GROUP + ' 个，过三步：根 → 义、义 → 根、填词根。</p><div class="actions"><button class="btn big" data-act="startRootNew">' + (left > 0 ? "学新词根" : "再学一组") + " <kbd>Enter</kbd></button></div></div>" + ringHtml(learned, s.rootGoal, "词根") + '</section><div class="tasks"><div class="task"><p class="label">复习</p><div class="num">' + fmt(rv.done) + "<small> / " + fmt(rvTotal) + '</small></div><div class="bar"><i style="width:' + pct(rv.done, rvTotal) + '%"></i></div><p class="muted">昨天的新词根和答错过的词根</p><button class="btn ghost" data-act="startRootReview"' + (rv.remaining.length ? "" : " disabled") + ">" + (rv.remaining.length ? "开始复习 <kbd>R</kbd>" : rvTotal ? "复习完了" : "今天没有要复习的词根") + '</button></div><div class="task"><p class="label">学什么</p><div class="pref"><span class="t">词库</span><label class="select"><select data-act="setRootBook" aria-label="词库">' + rootBookOptionsHtml(book) + '</select></label></div><div class="pref"><span class="t">每天学几个词根</span>' + chipsHtml("rootGoal", [5, 10, 20, 30].map((n) => [n, String(n)])) + '</div><div class="bar wide"><i style="width:' + pct(studied, inBook.length) + '%"></i></div><p class="muted">这个词库用到的词根已学 ' + fmt(studied) + " / " + fmt(inBook.length) + '</p></div></div><div class="section"><h2 class="h2">查词根</h2><div class="chips" style="margin-top:20px">' + types.map(([v, label]) => '<button class="chip' + (ui.roots.type === v ? " on" : "") + '" data-act="rootType" data-type="' + v + '">' + label + "</button>").join("") + '</div><input class="field roots-q" id="roots-q" placeholder="搜索词根、意思或单词" value="' + esc(ui.roots.q) + '" autocomplete="off" spellcheck="false"></div><div class="section root-list" id="root-rows">' + rootRowsHtml() + "</div></main>";
  };
  function rootWordRow(w, parts, m) {
    const e = LOOKUP.get(w.toLowerCase());
    return '<div class="list-row ex-row"><button class="w" data-act="speakWord" data-w="' + esc(w) + '">' + esc(w) + (e && e.p && !/\s/.test(w) ? "<small>/" + esc(e.p) + "/</small>" : "") + '</button><span class="m"><span class="parts">' + esc(parts) + '</span><span class="ex-m">' + esc(m) + "</span></span></div>";
  }
  function bookWordRow(x) {
    const phrase = /\s/.test(x.e.w);
    return rootWordRow(x.e.w, (phrase ? x.tok + " = " : "") + x.p.parts, shortMeaning(x.e.m));
  }
  VIEWS.root = function() {
    let list = rootList();
    let i = list.findIndex((r2) => r2.id === ui.roots.id);
    if (i < 0) {
      list = ROOTS;
      i = list.findIndex((r2) => r2.id === ui.roots.id);
    }
    if (i < 0) return VIEWS.roots();
    const r = list[i];
    const book = rootBook();
    const words = rootIndex(book).get(r.id) || [];
    const shown = words.slice(0, ui.roots.wordLimit);
    const st = state.rootStats[r.id];
    const step = (x, label) => x ? '<button class="link" data-act="viewRoot" data-id="' + esc(x.id) + '">' + label + "</button>" : "<span></span>";
    return '<main class="page"><p class="label"><button class="link" data-act="nav" data-view="roots">← 词根</button></p><p class="label root-type">' + ROOT_TYPES[r.type] + (st ? " · 答对 " + st.r + " 次 · 答错 " + st.w + " 次" : "") + '</p><h1 class="root-forms">' + esc(rootForms(r)) + '</h1><div class="root-mean">' + esc(r.meaning) + "</div>" + (r.origin ? '<p class="root-origin">' + esc(r.origin) + "</p>" : "") + (r.note ? '<p class="root-note">' + esc(r.note) + "</p>" : "") + '<div class="section"><div class="head-row"><p class="label">例词</p><span class="muted">点单词听发音</span></div>' + r.examples.map((x) => rootWordRow(x.w, x.parts, x.m)).join("") + "</div>" + (book !== "all" ? '<div class="section"><div class="head-row"><p class="label">' + esc(rootBookName(book)) + " 里的词 · " + fmt(words.length) + "</p>" + (words.length ? '<button class="btn small ghost" data-act="studyRootWords">背这些词</button>' : "") + "</div>" + (words.length ? shown.map(bookWordRow).join("") : '<div class="empty">这个词库里没有含这个词根的词。</div>') + (words.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRootWords">再显示 50 个（还有 ' + fmt(words.length - shown.length) + " 个）</button></div>" : "") + "</div>" : "") + '<div class="root-steps">' + step(list[i - 1], "← " + esc(list[i - 1] ? rootForms(list[i - 1]) : "")) + step(list[i + 1], esc(list[i + 1] ? rootForms(list[i + 1]) : "") + " →") + "</div></main>";
  };
  function studyRootWords() {
    const words = rootIndex(rootBook()).get(ui.roots.id) || [];
    const list = available(words.map((x) => x.e));
    if (!list.length) {
      toast("这些词都标记为已掌握了");
      return;
    }
    const fresh = list.filter((e) => !state.stats[keyOf(e.w)]);
    const pick = (fresh.length ? fresh : list).slice(0, state.settings.size);
    startSession(shuffle(pick.slice()), rootBook() === "all" ? null : rootBook(), "root");
  }
  function rootStepsHtml(rs) {
    return ROOT_STAGES.map((k, i) => '<span class="step' + (i === rs.stage ? " on" : i < rs.stage ? " done" : "") + '">' + (i + 1) + " " + ROOT_MODES[k].name + (i === rs.stage && rs.attempt > 1 ? " · 第 " + rs.attempt + " 遍" : "") + "</span>").join("");
  }
  function rootAfterHtml(q) {
    const r = q.r;
    const words = q.x.words.filter((w) => !/\s/.test(w.e.w)).slice(0, 3);
    const rows = words.length ? words.map(bookWordRow).join("") : r.examples.slice(0, 3).map((x) => rootWordRow(x.w, x.parts, x.m)).join("");
    return '<div class="rq-after"><p class="rq-root"><b>' + esc(rootForms(r)) + "</b>　" + esc(r.meaning) + (r.origin ? '<span class="root-origin">' + esc(r.origin) + "</span>" : "") + '</p><div class="rq-words">' + rows + '</div><div class="actions" style="justify-content:center;margin-top:20px"><button class="btn small" data-act="rootNext">继续 <kbd>Enter</kbd></button></div></div>';
  }
  function rootPromptHtml(rs, q) {
    const r = q.r;
    const answered = rs.pick !== null;
    if (q.mode === "fill") {
      const f = q.x.target;
      const t = f.tok;
      const at = f.fill.at;
      const len = f.fill.form.length;
      const gap = answered ? '<u class="gap-ans">' + esc(t.substr(at, len)) + "</u>" : '<span class="gap">' + "_".repeat(len) + "</span>";
      return '<div class="prompt-word">' + esc(t.slice(0, at)) + gap + esc(t.slice(at + len)) + '</div><div class="rq-hint">' + esc(shortMeaning(f.e.m)) + " · 空格里的" + ROOT_TYPES[r.type] + "意思是「" + esc(r.meaning) + '」</div><input id="rq-answer" class="answer en' + (answered && !rs.ok ? " wrong" : "") + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"' + (answered ? ' readonly value="' + esc(rs.pick) + '"' : ' placeholder="填词根"') + ">";
    }
    if (q.mode === "r2m") {
      const hint = q.x.words.filter((w) => !/\s/.test(w.e.w)).slice(0, 3).map((w) => w.e.w);
      const words = hint.length ? hint : r.examples.slice(0, 3).map((x) => x.w);
      return '<p class="label">' + ROOT_TYPES[r.type] + '</p><div class="prompt-word">' + esc(rootForms(r)) + '</div><div class="rq-hint">' + esc(words.join(" · ")) + "</div>";
    }
    return '<p class="label">' + ROOT_TYPES[r.type] + '</p><div class="prompt-mean">' + esc(r.meaning) + "</div>";
  }
  function rootQuizResultHtml(rs) {
    const all = rootAll(rs);
    const right = all.filter((x) => x.ok).length;
    const stageLine = ROOT_STAGES.map((k, i) => {
      const res = rootStageAll(rs, i);
      const reps = rs.retries.filter((x) => x.stage === i).length;
      return '<div><div class="num">' + (res.length ? res.filter((x) => x.ok).length + "<small> / " + res.length + "</small>" : "—") + '</div><div class="cap">' + (i + 1) + " · " + ROOT_MODES[k].name + (reps ? " · 重来 " + reps + " 遍" : "") + "</div></div>";
    }).join("");
    const mark = (r, i) => {
      const xs = rootStageAll(rs, i).filter((y) => y.r === r);
      const v = !xs.length ? null : xs.every((y) => y.ok);
      return '<span class="mk' + (v === true ? " ok" : v === false ? " bad" : "") + '" title="' + ROOT_MODES[ROOT_STAGES[i]].name + '">' + (v === null ? "·" : v ? ICON_OK : ICON_BAD) + "</span>";
    };
    const next = rootNextLabel(rs);
    return '<main class="page rq"><section class="result-hero' + (all.length && right === all.length ? " perfect" : "") + '">' + (all.length && right === all.length ? BURST : "") + '<p class="label">' + (rs.ended ? "提前结束" : "本组结束") + " · " + esc(rootBookName(rs.book)) + '</p><div class="score">' + right + "<small> / " + all.length + '</small></div><p class="rate">正确率 ' + (all.length ? Math.round(right / all.length * 100) : 0) + '%</p></section><div class="today stage-line">' + stageLine + '</div><div class="section"><div class="head-row"><p class="label">这一组的词根</p><span class="muted">右边三个标记依次是 根→义、义→根、填词根</span></div>' + rs.roots.map(
      (x) => '<button class="list-row root-row" data-act="viewRoot" data-id="' + esc(x.r.id) + '"><span class="w">' + esc(rootForms(x.r)) + '</span><span class="m">' + esc(x.r.meaning) + '</span><span class="side marks">' + [0, 1, 2].map((i) => mark(x.r, i)).join("") + "</span></button>"
    ).join("") + '</div><div class="actions" style="margin-top:40px">' + (next ? '<button class="btn" data-act="rootNext">' + next + " <kbd>Enter</kbd></button>" : "") + '<button class="link" data-act="nav" data-view="roots">回到词根 Esc</button></div></main>';
  }
  VIEWS.rootquiz = function() {
    const rs = ui.rs;
    if (!rs) return VIEWS.roots();
    if (rs.done) return rootQuizResultHtml(rs);
    const total = rs.roots.length * 2 + rs.roots.filter((x) => x.target).length;
    const before = rs.stageResults.slice(0, rs.stage).reduce((a, b) => a + (b ? b.length : 0), 0);
    const done = before + rs.results.length;
    const top = '<div class="p-top"><span class="steps">' + rootStepsHtml(rs) + '<span class="book">' + esc(rootBookName(rs.book)) + '</span></span><span class="right"><span>' + (rs.between ? rs.items.length : rs.idx + 1) + " / " + rs.items.length + '</span><button class="link" data-act="rootQuit">结束 Esc</button></span></div><div class="bar"><i style="width:' + Math.min(100, done / (total || 1) * 100) + '%"></i></div>';
    if (rs.between && rs.repeat) {
      const right = rs.results.filter((x) => x.ok).length;
      return '<main class="page rq">' + top + '<section class="card"><div class="inner anim"><div class="stage-done again"><p class="label">第 ' + (rs.stage + 1) + " 步 · " + ROOT_MODES[rs.mode].name + (rs.attempt > 1 ? " · 第 " + rs.attempt + " 遍" : "") + '</p><div class="stage-score">' + right + "<small> / " + rs.results.length + '</small></div><p class="muted">错了 ' + (rs.results.length - right) + ' 个。已开启强制全对，这一步整组再来一遍，全对才进入下一步。</p><div class="actions"><button class="btn" data-act="rootNext">再来一遍 <kbd>Enter</kbd></button></div></div></div></section></main>';
    }
    if (rs.between) {
      const right = rs.results.filter((x) => x.ok).length;
      const next = ROOT_MODES[ROOT_STAGES[nextRootStage(rs, rs.stage + 1)]];
      const perfect = right === rs.results.length;
      return '<main class="page rq">' + top + '<section class="card"><div class="inner anim"><div class="stage-done' + (perfect ? " perfect" : "") + '">' + (perfect ? BURST : "") + '<p class="label">第 ' + (rs.stage + 1) + " 步完成 · " + ROOT_MODES[rs.mode].name + '</p><div class="stage-score">' + right + "<small> / " + rs.results.length + '</small></div><p class="muted">下一步：' + next.name + " · " + next.desc + '</p><div class="actions"><button class="btn" data-act="rootNext">继续 <kbd>Enter</kbd></button></div></div></div></section></main>';
    }
    const q = rs.items[rs.idx];
    const answered = rs.pick !== null;
    let body = "";
    if (q.mode !== "fill") {
      body = '<div class="opts' + (q.mode === "m2r" ? " forms" : "") + '">' + q.options.map((m, i) => {
        const cls = answered ? i === q.correct ? " right" : i === rs.pick ? " wrong" : " off" : "";
        return '<button class="opt' + cls + '" data-act="rootPick" data-n="' + i + '"' + (answered ? " disabled" : "") + "><kbd>" + (i + 1) + "</kbd><span>" + esc(m) + "</span></button>";
      }).join("") + "</div>";
    }
    const hint = q.mode === "fill" ? '<div class="hint"><span><kbd>Enter</kbd> 提交</span><span>空着按 <kbd>Enter</kbd> = 不会</span></div>' : '<div class="hint"><span>按 <kbd>1</kbd>–<kbd>4</kbd> 选择</span></div>';
    return '<main class="page rq">' + top + '<section class="card"><div class="inner' + (answered ? "" : " anim") + '">' + rootPromptHtml(rs, q) + "</div></section>" + body + (answered ? rootAfterHtml(q) : hint) + "</main>";
  };
  AFTER.rootquiz = function() {
    const input = document.getElementById("rq-answer");
    if (input && !input.readOnly) input.focus();
  };

  // src/app/events.ts
  function applyTheme() {
    const root = document.documentElement;
    const t = state.settings.theme;
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
    else root.removeAttribute("data-theme");
    root.setAttribute("data-weight", state.settings.weight || "normal");
  }
  function initEvents() {
    document.addEventListener("keydown", (ev) => {
      if (!scene || ui.view !== "garden" && ui.view !== "room" || document.querySelector(".modal")) return;
      const tag = ev.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (ev.key === "Escape" && ui.tool) {
        ui.tool = null;
        refreshSceneUi();
        return;
      }
      if (ev.key === "+" || ev.key === "=" || ev.key === "-" || ev.key === "_") {
        scene.zoomBy(ev.key === "-" || ev.key === "_" ? -1 : 1);
        ev.preventDefault();
        return;
      }
      if (scene.key(ev, true)) ev.preventDefault();
    });
    document.addEventListener("keyup", (ev) => {
      if (scene) scene.key(ev, false);
    });
    window.addEventListener("blur", () => {
      if (scene) scene.keys = {};
    });
    app.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-act]");
      if (!t || t.tagName === "SELECT") return;
      const fn = ACTIONS[t.dataset.act];
      if (fn) fn(t, ev);
    });
    app.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t.dataset.act === "setBook") {
        state.settings.book = t.value;
        save();
        render();
      } else if (t.dataset.act === "setRootBook") {
        state.settings.rootBook = t.value;
        ui.roots.limit = 200;
        save();
        render();
      } else if (t.id === "draft-file" && t.files[0]) {
        t.files[0].arrayBuffer().then((buf) => {
          const text = decodeFile(buf);
          ui.draft.text = ui.draft.text.trim() ? ui.draft.text.trim() + "\n" + text : text;
          if (!ui.draft.target && /^我的词表 \d+$/.test(ui.draft.name)) ui.draft.name = t.files[0].name.replace(/\.[^.]+$/, "");
          render();
        });
      } else if (t.id === "upload-book" && t.files[0]) {
        const file = t.files[0];
        file.arrayBuffer().then((buf) => {
          const r = parseImport(decodeFile(buf));
          if (!r.words.length) {
            toast("这个文件里没有识别到单词");
            return;
          }
          openNewBook(createBook(file.name.replace(/\.[^.]+$/, ""), r.words), r.words.length);
        });
      } else if (t.id === "backup-file" && t.files[0]) {
        t.files[0].text().then(async (text) => {
          let obj = null;
          try {
            obj = JSON.parse(text);
          } catch (e) {
            obj = null;
          }
          if (!obj || obj.app !== "Marginal Vocabulary" && obj.app !== "Margin" || !obj.data) {
            toast("这个文件不是 Marginal Vocabulary 的备份");
            return;
          }
          if (!await askConfirm("用这个备份覆盖现在的数据？", "覆盖")) return;
          adoptState(normalizeState(obj.data), true);
          applyTheme();
          render();
          toast("备份已导入");
        });
      }
    });
    let previewTimer = null;
    app.addEventListener("input", (ev) => {
      const t = ev.target;
      if (t.id === "draft-text") {
        ui.draft.text = t.value;
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => {
          const el = document.getElementById("draft-preview");
          if (el) el.innerHTML = previewHtml();
        }, 200);
      } else if (t.id === "draft-name") {
        ui.draft.name = t.value;
      } else if (t.id === "roots-q") {
        ui.roots.q = t.value;
        ui.roots.limit = 200;
        document.getElementById("root-rows").innerHTML = rootRowsHtml();
      } else if (t.id === "book-q") {
        ui.book.q = t.value;
        ui.book.limit = 200;
        document.getElementById("book-rows").innerHTML = bookRowsHtml();
      }
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.isComposing || ev.keyCode === 229) return;
      if (document.querySelector(".modal")) return;
      const tag = ev.target.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ui.view === "practice") {
        if (ui.session && ui.session.between) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            continueStage();
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            quitSession();
          }
          return;
        }
        if (ev.key === "Enter" && ev.target.classList.contains("ans") && !ui.session.pending) {
          ev.preventDefault();
          const next = document.querySelector('.ans[data-line="' + (+ev.target.dataset.line + 1) + '"]');
          if (ev.target.value.trim() && next) next.focus();
          else submitAnswer();
        } else if (ev.key === "Enter" && (ev.target.id === "answer" || ev.target.classList.contains("ans") || !typing)) {
          ev.preventDefault();
          submitAnswer();
        } else if (ev.key === "Tab") {
          ev.preventDefault();
          ACTIONS.speakCurrent();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          quitSession();
        }
        return;
      }
      if (ui.view === "rootquiz") {
        if (ev.key === "Enter") {
          ev.preventDefault();
          rootNext();
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          if (ui.rs && ui.rs.done) go("roots");
          else quitRootSession();
        } else if (!typing && /^[1-4]$/.test(ev.key)) {
          rootAnswer(+ev.key - 1);
        }
        return;
      }
      if (typing) return;
      if (ui.view === "roots") {
        if (ev.key === "Enter") {
          ev.preventDefault();
          startRootNew();
        } else if (ev.key === "r" || ev.key === "R") {
          startRootReview();
        }
      } else if (ui.view === "root") {
        if (ev.key === "Escape") go("roots");
      } else if (ui.view === "home") {
        if (ev.key === "Enter") {
          ev.preventDefault();
          startNew();
        } else if (ev.key === "r" || ev.key === "R") {
          startReview();
        }
      } else if (ui.view === "result") {
        if (ev.key === "Enter") {
          ev.preventDefault();
          if (nextLabel(ui.session)) ACTIONS.nextGroup();
          else go("home");
        } else if (ev.key === "r" || ev.key === "R") {
          ACTIONS.retryWrong();
        } else if (ev.key === "Escape") {
          go("home");
        }
      }
    });
    window.addEventListener("storage", (ev) => {
      if (ev.key === STORE_KEY && ui.view !== "practice") {
        adoptState(loadState(), false);
        applyTheme();
        render();
      }
    });
  }

  // src/app/actions.ts
  Object.assign(ACTIONS, {
    nav(t) {
      if (ui.view === "practice") quitSession();
      if (ui.view === "rootquiz" && ui.rs && !ui.rs.done && t.dataset.view !== "roots") quitRootSession();
      go(t.dataset.view);
    },
    startNew() {
      startNew();
    },
    startReview() {
      startReview();
    },
    speakCurrent() {
      const e = current();
      if (e && ui.session.mode !== "zh2en") speak(e.w);
      const input = document.getElementById("answer");
      if (input) input.focus();
    },
    speakWord(t) {
      if (ui.view === "practice" && ui.session && ui.session.mode === "zh2en") return;
      speak(t.dataset.w);
    },
    next() {
      submitAnswer();
    },
    quit() {
      quitSession();
    },
    skipKnown() {
      skipKnown();
    },
    unknow(t) {
      delete state.known[keyOf(t.dataset.w)];
      save();
      render();
    },
    exportBook(t) {
      const id = t.dataset.id;
      const lines = bookEntries(id).map((e) => e.w + "	" + meaningLines(e.m).join("；"));
      const slug = id === WRONG_BOOK ? "wrong-words" : id === REVIEW_BOOK ? "review" : isBuiltin(id) ? id : "my-list";
      downloadText("margin-" + slug + "-" + todayKey() + ".txt", "\uFEFF" + lines.join("\r\n"));
      toast("已导出 " + lines.length + " 个词，可以用 Excel 打开，也能导入 Anki");
    },
    retryWrong() {
      const ss = ui.session;
      const words = wrongWords(ss).map((x) => x.entry);
      if (words.length) startSession(shuffle(words), ss.bookId, ss.kind === "new" ? "retry" : ss.kind);
    },
    nextGroup() {
      const ss = ui.session;
      if (!ss || ss.kind === "new" || ss.kind === "retry") startNew();
      else if (ss.kind === "review") startReview();
      else startWrong();
    },
    continueStage() {
      continueStage();
    },
    viewBook(t) {
      ui.book = { id: t.dataset.id, q: "", limit: 200 };
      go("book");
    },
    useBook(t) {
      state.settings.book = t.dataset.id;
      save();
      go("home");
    },
    moreRows() {
      ui.book.limit += 200;
      document.getElementById("book-rows").innerHTML = bookRowsHtml();
    },
    async deleteBook(t) {
      const b = state.books[t.dataset.id];
      if (!b || !await askConfirm("删除词表「" + b.name + "」？背诵记录和错题本不受影响。", "删除")) return;
      delete state.books[b.id];
      if (state.settings.book === b.id) state.settings.book = FIRST_BOOK;
      save();
      render();
    },
    async renameBook(t) {
      const b = state.books[t.dataset.id];
      if (!b) return;
      const name = await askText("新的词表名称", b.name);
      if (name && name.trim()) {
        b.name = name.trim();
        save();
        render();
      }
    },
    deleteWord(t) {
      const b = state.books[ui.book.id];
      if (!b) return;
      const k = keyOf(t.dataset.w);
      b.words = b.words.filter((e) => keyOf(e.w) !== k);
      save();
      render();
    },
    newImport() {
      const n = Object.keys(state.books).length + 1;
      ui.draft = { target: null, name: "我的词表 " + n, text: "" };
      go("import");
    },
    appendImport(t) {
      ui.draft = { target: t.dataset.id, name: "", text: "" };
      go("import");
    },
    saveImport() {
      const d = ui.draft;
      const r = parseImport(d.text);
      if (!r.words.length) {
        toast("还没有识别到单词");
        return;
      }
      let book = d.target && state.books[d.target];
      let added = r.words.length;
      if (book) {
        const have = new Map(book.words.map((e) => [keyOf(e.w), e]));
        added = 0;
        for (const e of r.words) {
          const old = have.get(keyOf(e.w));
          if (old) {
            if (e.m) old.m = e.m;
            if (e.p) old.p = e.p;
          } else {
            book.words.push(e);
            added++;
          }
        }
      } else {
        book = createBook(d.name, r.words);
      }
      ui.draft = null;
      openNewBook(book, added);
    },
    practiceWrong() {
      startWrong();
    },
    viewRoot(t) {
      if (ui.roots.id !== t.dataset.id) ui.roots.wordLimit = 50;
      ui.roots.id = t.dataset.id;
      go("root");
    },
    rootType(t) {
      ui.roots.type = t.dataset.type;
      ui.roots.limit = 200;
      render();
    },
    moreRoots() {
      ui.roots.limit += 200;
      document.getElementById("root-rows").innerHTML = rootRowsHtml();
    },
    moreRootWords() {
      ui.roots.wordLimit += 50;
      render();
    },
    studyRootWords() {
      studyRootWords();
    },
    startRootNew() {
      startRootNew();
    },
    startRootReview() {
      startRootReview();
    },
    rootPick(t) {
      rootAnswer(+t.dataset.n);
    },
    rootNext() {
      rootNext();
    },
    rootQuit() {
      quitRootSession();
    },
    removeWrong(t) {
      delete state.wrong[keyOf(t.dataset.w)];
      save();
      render();
    },
    async clearWrong() {
      if (!await askConfirm("清空错题本？", "清空")) return;
      state.wrong = {};
      save();
      render();
    },
    setting(t) {
      state.settings[t.dataset.key] = JSON.parse(t.dataset.val);
      save();
      applyTheme();
      render();
    },
    testVoice() {
      speak("Marginal Vocabulary");
    },
    checkUpdate() {
      checkUpdate(true);
    },
    installUpdate() {
      installUpdate();
    },
    relaunchApp() {
      if (DESKTOP) window.__TAURI__.core.invoke("relaunch").catch((e) => toast("重新打开失败：" + e + "，请手动退出后再打开"));
    },
    hideUpdate() {
      ui.update.show = false;
      render();
    },
    toggleUpdateNotes() {
      ui.update.open = !ui.update.open;
      render();
    },
    exportData() {
      downloadText("marginal-vocabulary-backup-" + todayKey() + ".json", JSON.stringify({ app: "Marginal Vocabulary", v: 1, exported: (/* @__PURE__ */ new Date()).toISOString(), data: state }), "application/json");
      toast("备份已下载");
    },
    async resetAll() {
      if (!await askConfirm("清空所有数据？自己导入的词表、背诵记录、错题本都会删除，无法恢复。", "清空")) return;
      adoptState(freshState(), true);
      applyTheme();
      render();
      toast("已清空");
    }
  });

  // src/world/actions.ts
  Object.assign(ACTIONS, {
    openShop(t) {
      ui.shopTab = t.dataset.tab;
      if (ui.view !== "shop") go("shop");
      else render();
    },
    openShelf(t) {
      ui.shelf = t.dataset.shelf;
      ui.shopTab = tabOfShelf(ui.shelf);
      if (ui.view !== "shop") go("shop");
      else render();
    },
    tool(t) {
      const id = t.dataset.id;
      ui.tool = ui.tool === id ? null : id;
      refreshSceneUi();
    },
    goRoom() {
      ui.floor = 1;
      goScene("room");
    },
    goGarden() {
      goScene("garden");
    },
    zoom(t) {
      if (!scene) return;
      scene.zoomBy(+t.dataset.d);
    },
    buyItem(t) {
      const it = ITEMS.get(t.dataset.id);
      if (!it || it.once && state.world[it.id] || !spend(it.price)) return;
      if (it.once) state.world[it.id] = 1;
      else bagAdd(it.into || it.id, it.gives || 1);
      save();
      toast("买了" + it.name);
      render();
    },
    lookItem(t) {
      const it = ITEMS.get(t.dataset.id);
      if (!it) return;
      const W = state.world;
      if (W.look[it.slot] === it.id) delete W.look[it.slot];
      else {
        if (!W.owned.includes(it.id)) {
          if (!spend(it.price)) return;
          W.owned.push(it.id);
        }
        W.look[it.slot] = it.id;
        if (it.look.bottom && it.slot === "top") delete W.look.bottom;
        if (it.slot === "bottom" && W.look.top && (ITEMS.get(W.look.top) || {}).look && ITEMS.get(W.look.top).look.bottom) delete W.look.top;
      }
      save();
      render();
    },
    buyPetLook(t) {
      const it = ITEMS.get(t.dataset.id);
      if (!it || state.petWardrobe.includes(it.id) || !spend(it.price)) return;
      state.petWardrobe.push(it.id);
      save();
      toast("买了" + it.name);
      render();
    },
    wearPet(t) {
      const it = ITEMS.get(t.dataset.id);
      const p = petById(+t.dataset.pet);
      if (!it || !p || !state.petWardrobe.includes(it.id)) return;
      if (p.wear[it.slot] === it.id) delete p.wear[it.slot];
      else {
        p.wear[it.slot] = it.id;
        if (p === mainPet()) setTimeout(() => petSay("dressed"), 200);
      }
      save();
      render();
    },
    wardPet(t) {
      const id = +t.dataset.pet;
      ui.wardPet = ui.wardPet === id ? null : id;
      render();
    },
    careUse(t) {
      if (careUse(petById(+t.dataset.pet), t.dataset.id)) render();
    },
    feedFish() {
      if (feedFish()) render();
    },
    setMain(t) {
      const p = petById(+t.dataset.pet);
      if (!p || isFish(p)) return;
      state.petMain = p.id;
      save();
      roam.x = null;
      toast(p.name + "会陪你背单词");
      render();
    },
    petPick(t) {
      ui.petPick = t.dataset.id;
      render();
    },
    adoptKind(t) {
      ui.petKind = t.dataset.kind;
      ui.petPick = null;
      render();
    },
    async buyPet(t) {
      const sp = SPECIES.get(t.dataset.id);
      if (!sp) return;
      if (state.points.bal < sp.price) return toast("金币不够（还差 " + fmt(sp.price - state.points.bal) + "）");
      const n = state.pets.filter((p2) => p2.sp === sp.id).length;
      const name = await askText("给你的" + sp.name + "起个名字", sp.name + (n ? " " + (n + 1) : ""));
      if (name === null) return;
      if (!spend(sp.price)) return;
      const p = newPet(sp.id, name.trim().slice(0, 12) || sp.name);
      save();
      roam.x = null;
      toast(p.name + (sp.fish ? "游进池塘了" : "来到花园了"));
      ui.petPick = sp.id;
      render();
      if (p === mainPet()) setTimeout(() => petSay("hello"), 300);
    },
    async renamePet(t) {
      const p = petById(+t.dataset.pet);
      if (!p) return;
      const name = await askText("改个名字", p.name);
      if (name === null || !name.trim()) return;
      p.name = name.trim().slice(0, 12);
      save();
      render();
    },
    async buyHouse() {
      const lv = houseLevel();
      const next = HOUSES[lv + 1];
      if (!next) return;
      if (state.points.bal < next.price) return toast("金币不够（还差 " + fmt(next.price - state.points.bal) + "）");
      const shortH = matsShort(next);
      if (shortH.length) return toast("材料不够：还差" + shortH.join("、"));
      if (!await askConfirm("花 " + costText(next) + " 把房子扩建成" + next.name + "？", "扩建")) return;
      if (matsShort(next).length || !spend(next.price)) return;
      payMats(next);
      const dx = (next.room[0] - HOUSES[lv].room[0]) / 2;
      for (const d of allRoomItems()) d.x += dx;
      const dy = next.oy - HOUSES[lv].oy;
      for (const it of [...state.world.plants, ...state.world.decor, ...state.world.debris || []]) it.y += dy;
      shiftTilled(dy);
      state.world.house = lv + 1;
      layoutGarden();
      relocate();
      roomRelocate();
      terrainCache.key = "";
      setRoomCanvas(null);
      save();
      toast("房子扩建成" + next.name + "了");
      const back = ui.view === "room" ? "room" : "garden";
      if (scene) scene.stop();
      setScene(null);
      go(ui.view === "shop" ? "shop" : back);
    },
    async buyLand() {
      const lv = state.world.land || 0;
      const next = LANDS[lv + 1];
      if (!next) return;
      if (state.points.bal < next.price) return toast("金币不够（还差 " + fmt(next.price - state.points.bal) + "）");
      const shortL = matsShort(next);
      if (shortL.length) return toast("材料不够：还差" + shortL.join("、"));
      if (!await askConfirm("花 " + costText(next) + " 把花园扩建到 " + next.w + " × " + (next.h + OY) + " 格？", "扩建")) return;
      if (matsShort(next).length || !spend(next.price)) return;
      payMats(next);
      const ow = GW;
      const oh = GH;
      state.world.land = lv + 1;
      layoutGarden();
      relocate();
      seedDebris((x, y) => x >= ow - GB || y >= oh - GB);
      terrainCache.key = "";
      save();
      toast("花园扩建好了");
      if (scene) scene.stop();
      setScene(null);
      go("garden");
    }
  });

  // src/app/start.ts
  function start() {
    if (window.__MARGIN_TEST) window.__margin = { zhMatch, similarity, judgeZhLines, meaningHtml, layersOf };
    if (window.__MARGIN_TEST) window.__setSky = (w, m) => {
      ui.forceWeather = w;
      ui.forceMinute = m;
    };
    if (window.__MARGIN_TEST) window.__houseInfo = () => ({ house: { x: HOUSE.x, y: HOUSE.y, w: HOUSE.w, h: HOUSE.h, sprite: HOUSE.sprite }, oy: OY, fixed: GFIXED.map((d) => ({ id: d.id, x: d.x, y: d.y })), pond: [...GPOND], gw: GW, gh: GH });
    if (window.__MARGIN_TEST) window.__sceneDebug = () => scene ? { cx: scene.cam.x, cy: scene.cam.y, w: scene.w, h: scene.h, swimT: scene.swimT || 0, setSwimT: (v) => {
      scene.swimT = v;
    }, avf: scene.avFrame, av: scene.av, pet: scene.mainEnt(), pets: scene.pets, fish: scene.fish, scale: scene.scale, vw: scene.vw, blocked: () => scene.blocked(), walk: (x, y) => scene.walkTo(x, y) } : null;
    if (GAMES2) {
      GAMES2.init({
        state: () => state,
        save,
        gain,
        toast,
        render,
        go,
        esc,
        fmt,
        books: () => allBooks().concat(Object.values(state.books).sort((a, b) => a.t - b.t).map((b) => b.id)).map((id) => ({ id, name: bookName(id) })),
        bookWords: (id) => bookEntries(id).map((e) => e.w),
        studyBook,
        today: () => dayNum(),
        confirm: askConfirm
      });
    }
    VIEWS.games = () => GAMES2 ? GAMES2.view() : "";
    AFTER.games = () => GAMES2 && GAMES2.after();
    layoutGarden();
    migrate();
    applyTheme();
    render();
    checkAchievements(true);
    if (petAlive()) {
      const mp = mainPet();
      setTimeout(() => petSay(mp.sick ? "sick" : mp.food < 30 ? "hungry" : mp.mood < 30 ? "low" : "hello"), 1500);
    }
    autoCheckUpdate();
  }

  // src/main.ts
  window.MARGIN_ART = ART;
  window.MARGIN_PETS = MARGIN_PETS;
  initSpeech();
  initRoam();
  initBag();
  initEvents();
  start();
})();
