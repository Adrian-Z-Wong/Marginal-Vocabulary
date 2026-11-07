// 由 ts/ 下的 TypeScript 编译生成（npm run build），请勿手动修改
"use strict";
(() => {
  // src/typing.ts
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

  // src/passages.ts
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
  var cache = /* @__PURE__ */ new Map();
  function bookPassages(host2, book) {
    const d = data();
    if (!d) return [];
    if (d.books[book]) return d.books[book];
    const hit = cache.get(book);
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
    cache.set(book, out);
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

  // src/chase/geo.ts
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
  function mix(a, b, t) {
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
    if (tod === "dusk") return shade(mix(hex, "#f0906a", 0.14), -0.16);
    return shade(mix(hex, "#2a3558", 0.42), -0.42);
  }
  function poly(c, pts, fill) {
    c.fillStyle = fill;
    c.beginPath();
    pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    c.fill();
  }

  // src/chase/paint.ts
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
  var GLASS = ["#7fa7c6", "#86b3c0", "#8f9fc4"];
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
    const wallTone = b.style === "office" ? GLASS[0] : b.wall;
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
      const ground = shop ? 11 : 9;
      const floorH = 8;
      const floors = Math.max(0, Math.floor((h - ground - 3) / floorH));
      const cols = Math.max(1, Math.floor(len / 0.62));
      const pitch = len / cols;
      const frame = g(shade(b.style === "brick" ? "#f3ede2" : BASE.frame, dark));
      c.fillStyle = rgba("#000000", 0.07);
      for (let f = 0; f <= floors; f++) c.fillRect(0, ground + f * floorH - 0.5, len, 0.45);
      const balcony = b.style === "apt" && R() < 0.5;
      for (let f = 0; f < floors; f++) {
        for (let k = 0; k < cols; k++) {
          const u = (k + 0.5) * pitch;
          const v = ground + f * floorH + 1.6;
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
    const roofCol = b.style === "warehouse" ? "#7d8590" : mix(b.style === "office" ? "#9aa3ae" : b.wall, "#8d939c", 0.55);
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
  function drawTree(c, x, y, size, kind, tod, tint) {
    const g = (h) => grade(h, tod);
    const leaf = mix("#4f9a4c", tint > 0.5 ? "#7aa33c" : "#3d8f73", Math.abs(tint - 0.5) * 0.6);
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

  // src/chase/sprites.ts
  function shadow(c, x, y, rx, ry) {
    c.fillStyle = "rgba(10,12,25,.3)";
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
  var INK = "#17161c";
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
    const bob = run ? -Math.abs(Math.cos(ph)) * 1.1 : pose === "caught" ? 0 : Math.sin(t / 400) * 0.25;
    const lean = run ? 0.16 : 0;
    const hipY = -9.4 + bob;
    const shY = -16.6 + bob;
    const limb = (pts, w, col) => {
      c.strokeStyle = INK;
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
      c.fillStyle = INK;
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
      c.fillStyle = INK;
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
    c.strokeStyle = INK;
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
    c.fillStyle = INK;
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
    c.fillStyle = INK;
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

  // src/chase/scene.ts
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

  // src/chase/iso.ts
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
      const nearHouse = (gx, gy, w, d) => gx < hs.gx + hs.w + 1 && gx + w > hs.gx - 1 && gy < hs.gy + hs.d + 1 && gy + d > hs.gy - 1;
      for (let bx = 0; bx * PITCH + ROAD < this.gw; bx++) {
        for (let by = 0; by * PITCH + ROAD < this.gh; by++) {
          const x0 = bx * PITCH + ROAD;
          const y0 = by * PITCH + ROAD;
          if (x0 + 7 > this.gw || y0 + 7 > this.gh) continue;
          const blk = { x0, y0, kind: "build", seed: Math.floor(R() * 1e9) };
          if (nearHouse(x0, y0, 8, 8)) blk.kind = "plaza";
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
          if (!nearHouse(lamp.gx, lamp.gy, 0, 0)) this.addLamp(lamp);
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
        if (t.g && (t.car && onRoute(t.g) || nearHouse(t.g.gx, t.g.gy, 0, 0))) this.things.splice(k, 1);
      }
      for (let k = this.treeAt.length - 1; k >= 0; k--) if (nearHouse(this.treeAt[k].g.gx, this.treeAt[k].g.gy, 0, 0)) this.treeAt.splice(k, 1);
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
        const wall = style === "brick" ? BRICKS[Math.floor(R() * BRICKS.length)] : style === "office" ? GLASS[Math.floor(R() * GLASS.length)] : WALLS[Math.floor(R() * WALLS.length)];
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
        draw: (c) => drawTree(c, x, y, size, kind, this.tod, tint)
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

  // src/chase/game.ts
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
      const bookName = p.book === CUSTOM_BOOK ? "自定义文章" : h.books().find((b) => b.id === p.book)?.name || "";
      return '<main class="page games play"><div class="cp-top"><div><h1 class="h1">打字追击</h1><p class="muted">' + h.esc(bookName) + " · 小偷 " + L.name + "（" + L.wpm + ' 词 / 分钟）</p></div><div class="actions"><button class="btn ghost small" data-game="pause">暂停<kbd>Esc</kbd></button><button class="btn ghost small" data-game="quit">不追了</button></div></div><div class="chase-wrap" id="chase-wrap"><canvas id="chase-canvas" class="chase-canvas"></canvas><div class="cp-pop" id="chase-pop"></div><div class="cp-overlay" id="chase-overlay"></div></div><div class="cp-stats"><div><b id="st-wpm">0</b><span>词 / 分钟</span></div><div><b id="st-acc">100%</b><span>正确率</span></div><div><b id="st-combo">0</b><span>连击</span></div><div><b id="st-gap">0</b><span>米 · 离小偷</span></div></div><div class="cp-textbox" id="chase-box"><div class="cp-scroll" id="chase-scroll"><p class="cp-text" id="chase-text">' + chars + '</p></div></div><p class="cp-source muted small">' + h.esc(p.passage.source) + "</p></main>";
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
      const room = 200 - g.custom.length;
      if (room <= 0) {
        this.host.toast("自定义文章最多 200 段，先删掉一些");
        return;
      }
      const added = parts.slice(0, room).map((t, i) => ({
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

  // src/hub.ts
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

  // src/main.ts
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
})();
