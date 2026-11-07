// 由 ts/ 下的 TypeScript 编译生成（npm run build），请勿手动修改
"use strict";
(() => {
  // src/typing.ts
  var TypingRun = class {
    constructor(text) {
      /** 已经打对的字符数 */
      this.pos = 0;
      /** 光标处打错的那个字（还没退格改掉时） */
      this.wrong = null;
      /** 按过的字符键总数（不算退格） */
      this.keys = 0;
      /** 打对的按键数 */
      this.hits = 0;
      /** 打错的次数（同一个位置错几次算几次） */
      this.misses = 0;
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
      if (this.wrong !== null) {
        this.keys++;
        return "blocked";
      }
      this.keys++;
      if (ch === this.text[this.pos]) {
        this.hits++;
        this.pos++;
        return this.done ? "done" : "ok";
      }
      this.misses++;
      this.missed[this.pos] = 1;
      this.wrong = ch;
      return "wrong";
    }
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

  // src/chase/art.ts
  var PALETTES = {
    day: {
      sky: ["#7fbde8", "#a9d4f0", "#dcefF7".toLowerCase()],
      far: "#a7c0d4",
      farLit: "#a7c0d4",
      buildings: ["#d98b6a", "#e9c88e", "#8db4a6", "#c8b6a2", "#9fa6c8", "#e3a37e"],
      shade: "rgba(40,30,50,.18)",
      window: "#cfe7f3",
      lit: "#cfe7f3",
      litRate: 0,
      sidewalk: "#d6cdbd",
      sidewalkLine: "#bfb4a2",
      curb: "#9c9283",
      road: "#4b5059",
      roadEdge: "#3d4148",
      lane: "#f1e3b8",
      lamp: "#5a5f6b",
      glow: null,
      sun: "#fff1b8",
      moon: null,
      stars: false,
      tree: ["#5f9e4f", "#3f7a3c"]
    },
    dusk: {
      sky: ["#4c5b98", "#d98a73", "#f4c48b"],
      far: "#7a6688",
      farLit: "#f2b77a",
      buildings: ["#9a5d55", "#b48a6e", "#5f7d7a", "#8c7a72", "#6f6f94", "#a8705c"],
      shade: "rgba(30,20,40,.25)",
      window: "#56607a",
      lit: "#ffd37e",
      litRate: 0.35,
      sidewalk: "#b8a99a",
      sidewalkLine: "#9f907f",
      curb: "#7e7266",
      road: "#3d3f4a",
      roadEdge: "#30323b",
      lane: "#e8c98f",
      lamp: "#3f4250",
      glow: "rgba(255,214,140,.22)",
      sun: "#ffd89a",
      moon: null,
      stars: false,
      tree: ["#4e7a45", "#355a34"]
    },
    night: {
      sky: ["#0d1430", "#1b2752", "#2c3e70"],
      far: "#1b2446",
      farLit: "#e9c46a",
      buildings: ["#2e3657", "#3a3f5e", "#2b4652", "#433c58", "#353a4f", "#40364c"],
      shade: "rgba(0,0,10,.3)",
      window: "#262c45",
      lit: "#ffd27a",
      litRate: 0.45,
      sidewalk: "#5d5d6b",
      sidewalkLine: "#4c4c59",
      curb: "#40404c",
      road: "#26272f",
      roadEdge: "#1d1e25",
      lane: "#b9a36e",
      lamp: "#2c2f3c",
      glow: "rgba(255,214,140,.3)",
      sun: null,
      moon: "#f3ecd2",
      stars: true,
      tree: ["#2f4a39", "#223a2c"]
    }
  };
  function paletteNow(d = /* @__PURE__ */ new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 17) return PALETTES.day;
    if (h >= 17 && h < 19.5 || h >= 5.5 && h < 7) return PALETTES.dusk;
    return PALETTES.night;
  }
  function hash(n) {
    let x = (n | 0) * 374761393 + 668265263;
    x = (x ^ x >>> 13) * 1274126177;
    return ((x ^ x >>> 16) >>> 0) / 4294967296;
  }
  function rect(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  }
  var Y = {
    farBase: 86,
    midBase: 93,
    walkTop: 93,
    curb: 101,
    roadTop: 103,
    lane: 116,
    lane2Top: 110,
    ground: 121,
    // 车轮、人脚着地的地方
    height: 128
  };
  function drawSky(c, w, p, t) {
    const g = c.createLinearGradient(0, 0, 0, Y.midBase);
    g.addColorStop(0, p.sky[0]);
    g.addColorStop(0.55, p.sky[1]);
    g.addColorStop(1, p.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, Y.midBase);
    if (p.stars) {
      for (let i = 0; i < w / 6; i++) {
        const x = Math.floor(hash(i * 7 + 1) * w);
        const y = Math.floor(hash(i * 13 + 5) * 54);
        const tw = 0.5 + 0.5 * Math.sin(t / 700 + i);
        c.fillStyle = `rgba(255,248,220,${(0.35 + 0.5 * tw * hash(i)).toFixed(2)})`;
        c.fillRect(x, y, 1, 1);
      }
    }
    if (p.sun) {
      const sx = Math.round(w * 0.78);
      const sy = p === PALETTES.dusk ? 62 : 22;
      c.fillStyle = p === PALETTES.dusk ? "rgba(255,214,150,.35)" : "rgba(255,250,220,.35)";
      c.beginPath();
      c.arc(sx, sy, 13, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.sun;
      c.beginPath();
      c.arc(sx, sy, 8, 0, Math.PI * 2);
      c.fill();
    }
    if (p.moon) {
      const mx = Math.round(w * 0.8);
      c.fillStyle = "rgba(243,236,210,.15)";
      c.beginPath();
      c.arc(mx, 20, 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.moon;
      c.beginPath();
      c.arc(mx, 20, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.sky[0];
      c.beginPath();
      c.arc(mx + 3, 18, 5, 0, Math.PI * 2);
      c.fill();
    }
  }
  function drawFar(c, w, cam, p) {
    const off = cam * 0.25;
    const unit = 14;
    const first = Math.floor(off / unit) - 1;
    for (let i = first; i < first + Math.ceil(w / unit) + 3; i++) {
      const x = Math.round(i * unit - off);
      const h = 14 + Math.floor(hash(i * 3 + 11) * 30);
      const bw = unit - (hash(i * 5) < 0.3 ? 3 : 0);
      rect(c, x, Y.farBase - h, bw, h + 8, p.far);
      if (hash(i * 17) < 0.18) rect(c, x + Math.floor(bw / 2), Y.farBase - h - 5, 1, 5, p.far);
      if (p.litRate) {
        for (let k = 0; k < 4; k++) {
          if (hash(i * 31 + k) < p.litRate * 0.5) rect(c, x + 2 + Math.floor(hash(i * 41 + k) * (bw - 4)), Y.farBase - h + 3 + Math.floor(hash(i * 43 + k) * (h - 4)), 1, 1, p.farLit);
        }
      }
    }
  }
  function drawMid(c, w, cam, p) {
    const off = cam * 0.55;
    const unit = 46;
    const first = Math.floor(off / unit) - 1;
    for (let i = first; i < first + Math.ceil(w / unit) + 3; i++) {
      const r = hash(i * 9 + 3);
      const bw = 34 + Math.floor(hash(i * 2 + 7) * 12);
      const h = 26 + Math.floor(r * 34);
      const x = Math.round(i * unit - off + (unit - bw) / 2);
      const color = p.buildings[Math.floor(hash(i * 19) * p.buildings.length)];
      const top = Y.midBase - h;
      rect(c, x, top, bw, h, color);
      rect(c, x - 1, top, bw + 2, 2, shadeOf(color, -0.25));
      c.fillStyle = p.shade;
      c.fillRect(x + bw - 4, top + 2, 4, h - 2);
      const cols = Math.floor((bw - 6) / 6);
      const rows = Math.floor((h - 10) / 8);
      for (let ry = 0; ry < rows; ry++) {
        for (let cx = 0; cx < cols; cx++) {
          const lit = hash(i * 101 + ry * 7 + cx) < p.litRate;
          const wx = x + 4 + cx * 6;
          const wy = top + 5 + ry * 8;
          rect(c, wx, wy, 4, 5, lit ? p.lit : p.window);
          rect(c, wx, wy + 5, 4, 1, shadeOf(color, -0.18));
        }
      }
      if (hash(i * 23) < 0.5) {
        const aw = shadeOf(p.buildings[Math.floor(hash(i * 29) * p.buildings.length)], -0.1);
        for (let k = 0; k < bw - 4; k += 4) rect(c, x + 2 + k, Y.midBase - 9, 2, 3, k % 8 ? "#f4efe6" : aw);
        rect(c, x + 2, Y.midBase - 6, bw - 4, 6, shadeOf(color, -0.35));
        if (p.litRate) rect(c, x + 4, Y.midBase - 5, bw - 8, 4, "rgba(255,214,140,.55)");
      } else {
        rect(c, x + Math.floor(bw / 2) - 3, Y.midBase - 9, 6, 9, shadeOf(color, -0.4));
      }
    }
  }
  function drawStreet(c, w, cam, p, t) {
    rect(c, 0, Y.walkTop, w, Y.curb - Y.walkTop, p.sidewalk);
    const off = Math.floor(cam);
    for (let x = -(off % 12); x < w; x += 12) rect(c, x, Y.walkTop, 1, Y.curb - Y.walkTop, p.sidewalkLine);
    rect(c, 0, Y.curb, w, 2, p.curb);
    rect(c, 0, Y.roadTop, w, Y.height - Y.roadTop, p.road);
    rect(c, 0, Y.roadTop, w, 1, p.roadEdge);
    for (let x = -(off % 28); x < w; x += 28) rect(c, x, Y.lane, 14, 1, p.lane);
    for (let x = -(off % 9); x < w; x += 9) {
      const n = Math.floor((x + off) / 9);
      if (hash(n) < 0.35) rect(c, x + Math.floor(hash(n * 3) * 8), Y.roadTop + 3 + Math.floor(hash(n * 5) * 22), 1, 1, p.roadEdge);
    }
    const unit = 90;
    const first = Math.floor(cam / unit) - 1;
    for (let i = first; i < first + Math.ceil(w / unit) + 2; i++) {
      const x = Math.round(i * unit - cam);
      rect(c, x, Y.walkTop - 30, 2, 31, p.lamp);
      rect(c, x, Y.walkTop - 30, 8, 2, p.lamp);
      rect(c, x + 6, Y.walkTop - 29, 3, 2, p.glow ? "#ffe7a8" : "#d9d4c4");
      if (p.glow) {
        const g = c.createRadialGradient(x + 7, Y.walkTop - 27, 1, x + 7, Y.walkTop - 27, 22);
        g.addColorStop(0, p.glow);
        g.addColorStop(1, "rgba(255,214,140,0)");
        c.fillStyle = g;
        c.fillRect(x - 16, Y.walkTop - 50, 46, 60);
      }
      const tx = x + 45;
      if (hash(i * 7 + 2) < 0.75) {
        rect(c, tx, Y.walkTop - 8, 2, 9, "#6b4a33");
        const sway = Math.round(Math.sin(t / 900 + i) * 0.6);
        blob(c, tx + 1 + sway, Y.walkTop - 15, 8, 7, p.tree[0], p.tree[1]);
      } else {
        rect(c, tx, Y.walkTop - 6, 4, 6, "#c4473d");
        rect(c, tx - 1, Y.walkTop - 4, 6, 1, "#9e352e");
        rect(c, tx + 1, Y.walkTop - 7, 2, 1, "#9e352e");
      }
    }
  }
  function blob(c, cx, cy, rx, ry, light, dark) {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.round(rx * Math.sqrt(1 - y * y / (ry * ry)));
      rect(c, cx - half, cy + y, half * 2, 1, y > ry / 3 ? dark : light);
    }
    rect(c, cx - 3, cy - ry + 2, 2, 1, "rgba(255,255,255,.25)");
  }
  function shadeOf(hex, amt) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
  }
  var CAR_W = 36;
  function drawCar(c, x, flash, wheel, bump, lightsOn) {
    const g = Y.ground;
    const b = bump;
    const K = "#1c2232";
    const W = "#f5f4ef";
    const Wd = "#d9d8d2";
    const N = "#26386d";
    const Nl = "#3a53a0";
    const G = "#a9d9f1";
    const Gd = "#7db6d6";
    c.fillStyle = "rgba(0,0,0,.28)";
    c.fillRect(Math.round(x) + 2, g - 1, CAR_W - 2, 2);
    const X = Math.round(x);
    const yb = g - 3 + b;
    rect(c, X, yb - 8, CAR_W, 8, K);
    rect(c, X + 1, yb - 7, CAR_W - 2, 6, W);
    rect(c, X + 1, yb - 3, CAR_W - 2, 2, Wd);
    rect(c, X + 9, yb - 6, 18, 3, N);
    rect(c, X + 9, yb - 6, 18, 1, Nl);
    rect(c, X + 16, yb - 6, 2, 2, "#f2c94c");
    rect(c, X + CAR_W - 3, yb - 7, 2, 2, "#ffe9a6");
    rect(c, X + CAR_W - 1, yb - 3, 2, 2, "#9aa1ad");
    rect(c, X + 1, yb - 7, 1, 2, "#d0463c");
    rect(c, X - 1, yb - 3, 2, 2, "#9aa1ad");
    rect(c, X + 8, yb - 14, 19, 7, K);
    rect(c, X + 9, yb - 13, 17, 6, W);
    rect(c, X + 10, yb - 12, 7, 4, G);
    rect(c, X + 18, yb - 12, 7, 4, G);
    rect(c, X + 10, yb - 12, 2, 1, "#e3f4fb");
    rect(c, X + 18, yb - 12, 2, 1, "#e3f4fb");
    rect(c, X + 10, yb - 9, 7, 1, Gd);
    rect(c, X + 18, yb - 9, 7, 1, Gd);
    rect(c, X + 13, yb - 16, 9, 2, K);
    const red = lightsOn && flash ? "#ff5b4f" : "#9e3a34";
    const blue = lightsOn && !flash ? "#5aa8ff" : "#2f4d86";
    rect(c, X + 14, yb - 16, 3, 1, red);
    rect(c, X + 18, yb - 16, 3, 1, blue);
    if (lightsOn) {
      const gx = flash ? X + 15 : X + 19;
      const col = flash ? "rgba(255,90,80,.28)" : "rgba(90,168,255,.28)";
      const gr = c.createRadialGradient(gx, yb - 16, 0, gx, yb - 16, 14);
      gr.addColorStop(0, col);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gr;
      c.fillRect(gx - 14, yb - 30, 28, 28);
    }
    wheelAt(c, X + 8, g - 3, wheel);
    wheelAt(c, X + CAR_W - 8, g - 3, wheel);
  }
  function wheelAt(c, cx, cy, phase) {
    rect(c, cx - 3, cy - 2, 6, 5, "#15171d");
    rect(c, cx - 2, cy - 3, 4, 7, "#15171d");
    rect(c, cx - 1, cy - 1, 2, 2, "#9aa1ad");
    const a = phase * Math.PI * 2;
    rect(c, cx + Math.round(Math.cos(a) * 2) - 0.5, cy + Math.round(Math.sin(a) * 2) - 0.5, 1, 1, "#5d6370");
  }
  function drawThief(c, x, frame, pose) {
    const g = Y.ground;
    const X = Math.round(x);
    const skin = "#f0c48e";
    const skinD = "#d9a56f";
    const hat = "#2a2b35";
    const stripeA = "#eceae4";
    const stripeB = "#2c2f3c";
    const pants = "#3b4462";
    const shoe = "#141419";
    const bag = "#c8a066";
    const bagD = "#a47e4a";
    const run = pose === "run";
    const lift = run && (frame === 1 || frame === 3) ? -1 : 0;
    const top = g - 21 + lift;
    c.fillStyle = "rgba(0,0,0,.25)";
    c.fillRect(X, g - 1, 11, 2);
    if (pose !== "caught") {
      rect(c, X - 3, top + 6, 7, 7, bagD);
      rect(c, X - 2, top + 5, 5, 8, bag);
      rect(c, X - 1, top + 4, 3, 1, bagD);
      rect(c, X, top + 7, 1, 4, "#5a3f1f");
      rect(c, X - 1, top + 8, 3, 1, "#5a3f1f");
      rect(c, X - 1, top + 10, 3, 1, "#5a3f1f");
    }
    const lf = run ? [[-3, 3], [-1, 1], [3, -3], [1, -1]][frame] : [0, 0];
    rect(c, X + 3 + lf[1], top + 14, 2, 6 - (run && frame % 2 === 0 ? 1 : 0), shadeOf(pants, -0.25));
    rect(c, X + 3 + lf[1] - (lf[1] < 0 ? 1 : 0), g - 2 + (run && frame % 2 === 0 ? -1 : 0), 3, 2, shoe);
    rect(c, X + 6 + lf[0], top + 14, 2, 6, pants);
    rect(c, X + 6 + lf[0], g - 2, 3, 2, shoe);
    for (let r = 0; r < 7; r++) rect(c, X + 2, top + 7 + r, 8, 1, r % 2 ? stripeB : stripeA);
    rect(c, X + 9, top + 8, 1, 6, "rgba(0,0,0,.15)");
    if (pose === "caught") {
      rect(c, X + 1, top + 1, 2, 7, stripeA);
      rect(c, X + 9, top + 1, 2, 7, stripeA);
      rect(c, X + 1, top, 2, 2, skin);
      rect(c, X + 9, top, 2, 2, skin);
    } else {
      const sw = run ? [2, 0, -2, 0][frame] : 0;
      rect(c, X + 7 + sw, top + 8, 2, 4, stripeA);
      rect(c, X + 7 + sw, top + 12, 2, 1, skin);
      rect(c, X + 1, top + 7, 2, 3, stripeB);
    }
    rect(c, X + 3, top + 1, 6, 6, skin);
    rect(c, X + 8, top + 3, 2, 2, skin);
    rect(c, X + 3, top + 5, 6, 1, skinD);
    rect(c, X + 3, top + 3, 7, 2, "#1b1c22");
    rect(c, X + 7, top + 3, 1, 1, "#ffffff");
    rect(c, X + 2, top - 1, 8, 3, hat);
    rect(c, X + 3, top - 2, 6, 1, hat);
    rect(c, X + 2, top + 1, 8, 1, shadeOf(hat, 0.2));
  }
  function drawHideout(c, x, doorOpen, p) {
    const X = Math.round(x);
    const w = 62;
    const h = 46;
    const base = Y.curb + 1;
    const top = base - h;
    const wall = p === PALETTES.night ? "#4a4256" : "#8a6f5e";
    rect(c, X, top, w, h, wall);
    for (let k = 2; k < w; k += 4) rect(c, X + k, top + 4, 1, h - 4, shadeOf(wall, -0.18));
    rect(c, X - 3, top - 4, w + 6, 4, "#3d3340");
    rect(c, X - 3, top - 4, w + 6, 1, "#5a4d5d");
    const dw = 30;
    const dh = 28;
    const dx = X + 16;
    const dy = base - dh;
    rect(c, dx - 1, dy - 1, dw + 2, dh + 1, "#2a2430");
    rect(c, dx, dy, dw, dh, "#141118");
    const shut = Math.round(dh * (1 - doorOpen));
    rect(c, dx, dy, dw, shut, "#9aa0aa");
    for (let k = 1; k < shut; k += 3) rect(c, dx, dy + k, dw, 1, "#7d8390");
    rect(c, dx + 10, top + 4, 10, 6, "#2a2430");
    rect(c, dx + 11, top + 5, 8, 4, "#e8b84a");
    rect(c, dx + 14, top + 6, 2, 2, "#2a2430");
    if (p.glow) {
      const g = c.createRadialGradient(dx + dw / 2, top + 8, 1, dx + dw / 2, top + 8, 26);
      g.addColorStop(0, "rgba(255,200,110,.35)");
      g.addColorStop(1, "rgba(255,200,110,0)");
      c.fillStyle = g;
      c.fillRect(dx - 12, top - 14, dw + 24, 48);
    }
  }
  function drawStars(c, cx, cy, t) {
    for (let i = 0; i < 3; i++) {
      const a = t / 300 + i * Math.PI * 2 / 3;
      const x = Math.round(cx + Math.cos(a) * 6);
      const y = Math.round(cy + Math.sin(a) * 2);
      rect(c, x, y - 1, 1, 3, "#ffd75e");
      rect(c, x - 1, y, 3, 1, "#ffd75e");
    }
  }
  function drawDust(c, x, y, age) {
    const a = Math.max(0, 0.45 - age * 0.45);
    c.fillStyle = `rgba(220,210,190,${a.toFixed(2)})`;
    const r = 1 + Math.round(age * 3);
    c.fillRect(Math.round(x - r), Math.round(y - r - age * 3), r * 2, r * 2);
  }

  // src/chase/scene.ts
  var TRACK = 1800;
  var GAP0 = 4;
  var ChaseScene = class {
    constructor(get) {
      this.canvas = null;
      this.wrap = null;
      this.ctx = null;
      this.raf = 0;
      this.ro = null;
      this.w = 320;
      this.scale = 3;
      this.cam = 0;
      this.carX = 0;
      // 画面上的警车位置（平滑跟随）
      this.last = 0;
      this.dust = [];
      this.pal = paletteNow();
      this.get = get;
    }
    attach(canvas, wrap) {
      this.detach();
      this.canvas = canvas;
      this.wrap = wrap;
      this.ctx = canvas.getContext("2d");
      this.pal = paletteNow();
      const s = this.get();
      this.carX = this.carWorld(s.police);
      this.cam = this.camTarget(s);
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(() => this.fit());
        this.ro.observe(wrap);
      }
      this.fit();
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
    /** 画布高 128 像素，按页面宽度选整数倍；宽度跟着页面变 */
    fit() {
      if (!this.canvas || !this.wrap) return;
      const r = this.wrap.getBoundingClientRect();
      const border = this.wrap.offsetWidth - this.wrap.clientWidth;
      const cssW = Math.max(300, r.width - border);
      const maxH = Math.max(240, Math.min(420, window.innerHeight * 0.42));
      this.scale = Math.max(2, Math.min(4, Math.floor(maxH / Y.height)));
      this.w = Math.ceil(cssW / this.scale);
      this.canvas.width = this.w;
      this.canvas.height = Y.height;
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = Y.height * this.scale + "px";
      this.wrap.style.height = Y.height * this.scale + "px";
      if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    }
    carWorld(p) {
      return 30 + p * TRACK;
    }
    thiefWorld(q) {
      return 30 + q * TRACK + CAR_W + GAP0;
    }
    camTarget(s) {
      const thiefRight = this.thiefWorld(s.thief) + 14;
      const span = thiefRight - this.carX;
      let want = span < this.w - 40 ? this.carX - (this.w - span) / 2 : this.carX - 24;
      if (s.thief > 0.8) {
        const end = this.thiefWorld(1) + 90 - this.w;
        want = Math.max(want, Math.min(end, thiefRight + 20 - this.w));
      }
      return Math.max(-20, want);
    }
    draw(t) {
      const c = this.ctx;
      if (!c) return;
      const dt = Math.min(0.05, (t - this.last) / 1e3);
      this.last = t;
      const s = this.get();
      const carTarget = this.carWorld(s.police);
      this.carX += (carTarget - this.carX) * Math.min(1, dt * 9);
      if (Math.abs(carTarget - this.carX) < 0.05) this.carX = carTarget;
      const camT = this.camTarget(s);
      this.cam += (camT - this.cam) * Math.min(1, dt * 4);
      const cam = Math.round(this.cam);
      const w = this.w;
      const p = this.pal;
      const moving = s.phase === "run" && !s.wrong;
      drawSky(c, w, p, t);
      drawFar(c, w, cam, p);
      drawMid(c, w, cam, p);
      drawStreet(c, w, cam, p, t);
      const hx = this.thiefWorld(1) + 14 - cam;
      let door = 1;
      if (s.phase === "lost") door = Math.max(0, 1 - (t - s.endAt) / 700);
      if (hx < w + 10) drawHideout(c, hx, door, p);
      const tx = this.thiefWorld(s.thief) - cam;
      const thiefRunning = s.phase === "run" || s.phase === "count";
      const frame = thiefRunning && s.phase === "run" ? Math.floor(t / 90) % 4 : 0;
      const escaped = s.phase === "lost" && t - s.endAt > 500;
      if (!escaped) {
        const pose = s.phase === "won" ? "caught" : s.phase === "run" ? "run" : "idle";
        drawThief(c, tx, frame, pose);
        if (s.phase === "won") drawStars(c, tx + 6, Y.ground - 25, t);
      }
      if (s.phase === "run" && Math.random() < dt * 8) this.dust.push({ x: this.thiefWorld(s.thief) + 2, y: Y.ground - 1, t: 0 });
      const flash = Math.floor(t / 140) % 2;
      const wheel = moving || Math.abs(carTarget - this.carX) > 0.5 ? t / 220 % 1 : 0;
      const bump = moving && Math.floor(t / 110) % 3 === 0 ? -1 : 0;
      const shake = s.wrong && s.phase === "run" ? Math.floor(t / 50) % 2 ? 1 : -1 : 0;
      const cx = this.carX - cam + shake;
      if (moving && Math.random() < dt * 10) this.dust.push({ x: this.carX + 2, y: Y.ground - 1, t: 0 });
      if (moving && carTarget - this.carX > 1.5) {
        c.fillStyle = "rgba(255,255,255,.35)";
        for (let i = 0; i < 3; i++) c.fillRect(Math.round(cx - 10 - (t / 20 + i * 7) % 14), Y.ground - 6 - i * 4, 6, 1);
      }
      drawCar(c, cx, flash, wheel, bump, s.phase !== "ready");
      if (s.wrong && s.phase === "run") {
        rect(c, cx + 27, Y.ground - 30, 5, 8, "#ffffff");
        rect(c, cx + 28, Y.ground - 29, 3, 4, "#d6453b");
        rect(c, cx + 28, Y.ground - 24, 3, 1, "#d6453b");
      }
      for (const d of this.dust) {
        d.t += dt;
        drawDust(c, d.x - cam, d.y, d.t);
      }
      this.dust = this.dust.filter((d) => d.t < 1);
      if (tx > w - 6 && !escaped) {
        const ay = Y.ground - 12;
        c.fillStyle = "rgba(20,20,30,.55)";
        c.fillRect(w - 13, ay - 6, 12, 12);
        rect(c, w - 10, ay - 1, 5, 2, "#ffffff");
        rect(c, w - 6, ay - 3, 1, 6, "#ffffff");
        rect(c, w - 5, ay - 2, 1, 4, "#ffffff");
        rect(c, w - 4, ay - 1, 1, 2, "#ffffff");
      }
      if (p === PALETTES.night) {
        c.fillStyle = "rgba(8,10,30,.12)";
        c.fillRect(0, 0, w, Y.height);
      }
    }
  };

  // src/chase/game.ts
  var LEVELS = [
    { name: "慢", wpm: 20, coins: 10 },
    { name: "中", wpm: 35, coins: 20 },
    { name: "快", wpm: 50, coins: 30 },
    { name: "极速", wpm: 70, coins: 45 }
  ];
  var DAILY_COINS = 150;
  var HEAD = 0.15;
  var COUNT_MS = 3e3;
  var ChaseGame = class {
    constructor(host2) {
      this.route = "setup";
      this.play = null;
      this.preview = null;
      this.tick = 0;
      this.spans = [];
      this.shownPos = -1;
      this.keyHandler = (ev) => this.onKey(ev);
      this.lastOverlay = "";
      this.flashTimer = 0;
      this.host = host2;
      this.scene = new ChaseScene(() => this.sceneState());
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
        this.paintText();
        this.paintHud(performance.now());
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
      if (this.play && (this.play.phase === "run" || this.play.phase === "count" || this.play.phase === "paused")) this.play = null;
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
      return '<main class="page games play"><div class="cp-top"><div><h1 class="h1">打字追击</h1><p class="muted">' + h.esc(bookName) + " · 小偷 " + L.name + "（" + L.wpm + ' 词 / 分钟）</p></div><div class="actions"><button class="btn ghost small" data-game="pause">暂停<kbd>Esc</kbd></button><button class="btn ghost small" data-game="quit">不追了</button></div></div><div class="chase-wrap" id="chase-wrap"><canvas id="chase-canvas" class="chase-canvas"></canvas><div class="cp-overlay" id="chase-overlay"></div></div><div class="cp-track"><div class="tr-line"><i class="tr-done" id="tr-done"></i></div><img class="tr-icon tr-car" id="tr-car" alt="" src="' + icon("car") + '"><img class="tr-icon tr-thief" id="tr-thief" alt="" src="' + icon("thief") + '"><span class="tr-flag" title="小偷的仓库"></span></div><div class="cp-stats"><div><b id="st-wpm">0</b><span>词 / 分钟</span></div><div><b id="st-acc">100%</b><span>正确率</span></div><div><b id="st-time">00:00</b><span>用时</span></div><div><b id="st-gap">0</b><span>米 · 离小偷</span></div></div><div class="cp-textbox" id="chase-box"><div class="cp-scroll" id="chase-scroll"><p class="cp-text" id="chase-text">' + chars + '</p></div></div><p class="cp-source muted small">' + h.esc(p.passage.source) + "</p></main>";
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
        phase: "count",
        countAt: performance.now(),
        runAt: 0,
        pausedAt: 0,
        pausedTotal: 0,
        endAt: 0,
        thief: HEAD,
        reward: 0,
        capped: false,
        newBest: false
      };
      this.route = "play";
      this.host.render();
    }
    sceneState() {
      const p = this.play;
      if (!p) return { police: 0, thief: HEAD, phase: "ready", wrong: false, endAt: 0 };
      return { police: p.run.progress(), thief: p.thief, phase: p.phase, wrong: p.run.wrong !== null, endAt: p.endAt };
    }
    /** 小偷跑了多少秒（暂停不算） */
    chaseSeconds(now) {
      const p = this.play;
      if (!p || !p.runAt) return 0;
      const end = p.pausedAt || p.endAt || now;
      return Math.max(0, (end - p.runAt - p.pausedTotal) / 1e3);
    }
    startTick() {
      this.stopTick();
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
      if (p.phase === "count" && now - p.countAt >= COUNT_MS) {
        p.phase = "run";
        p.runAt = now;
        p.run.start(now);
      }
      if (p.phase === "run") {
        const cps = LEVELS[p.level].wpm * 5 / 60;
        p.thief = Math.min(1, HEAD + cps * this.chaseSeconds(now) / p.passage.text.length);
        if (p.run.progress() >= p.thief) this.finish(true, now);
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
      setTimeout(() => this.paintResult(), won ? 900 : 1100);
    }
    pause(now) {
      const p = this.play;
      if (!p || p.phase !== "run" && p.phase !== "count") return;
      if (p.phase === "count") {
        p.countAt = now;
        return;
      }
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
        if (!inField && ev.key === "Enter" && view2.classList.contains("games") && document.querySelector('[data-game="start"]:not([disabled])')) {
          ev.preventDefault();
          this.start();
        }
        return;
      }
      const p = this.play;
      if (inField) return;
      if (ev.isComposing || ev.keyCode === 229 || ev.key === "Process") {
        this.flash("切换到英文输入法再打");
        return;
      }
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
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this.resume(now);
        }
        return;
      }
      if (p.phase !== "run") {
        if (ev.key.length === 1 || ev.key === "Backspace") ev.preventDefault();
        return;
      }
      if (ev.key === "Backspace") {
        ev.preventDefault();
        if (p.run.backspace()) this.paintText();
        return;
      }
      if (ev.key.length !== 1) return;
      ev.preventDefault();
      const r = p.run.type(ev.key);
      if (r === "blocked") this.nudge();
      this.paintText();
      this.step(now);
    }
    // ---------------- 画 DOM ----------------
    paintText() {
      const p = this.play;
      if (!p || !this.spans.length) return;
      const pos = p.run.pos;
      const from = Math.max(0, Math.min(this.shownPos < 0 ? 0 : this.shownPos, pos) - 1);
      for (let i = this.shownPos < 0 ? 0 : from; i < (this.shownPos < 0 ? this.spans.length : Math.min(this.spans.length, Math.max(pos, this.shownPos) + 2)); i++) {
        const s = this.spans[i];
        s.className = i < pos ? p.run.missed[i] ? "ok was" : "ok" : i === pos ? p.run.wrong !== null ? "cur err" : "cur" : "";
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
      set("st-time", clock(p.run.elapsed(now)));
      set("st-gap", String(Math.max(0, Math.round((p.thief - p.run.progress()) * 1e3))));
      const pct = (x) => (Math.max(0, Math.min(1, x)) * 100).toFixed(2) + "%";
      const car = document.getElementById("tr-car");
      const th = document.getElementById("tr-thief");
      const done = document.getElementById("tr-done");
      if (car) car.style.left = pct(p.run.progress());
      if (th) th.style.left = pct(p.thief);
      if (done) done.style.width = pct(p.run.progress());
      this.paintOverlay(now);
    }
    paintOverlay(now = performance.now()) {
      const p = this.play;
      const el = document.getElementById("chase-overlay");
      if (!p || !el) return;
      let html = "";
      if (p.phase === "count") {
        const n = Math.ceil((COUNT_MS - (now - p.countAt)) / 1e3);
        html = '<div class="ov-count" data-n="' + n + '">' + (n > 0 ? n : "追") + "</div>";
      } else if (p.phase === "paused") {
        html = '<div class="ov-card"><b>暂停</b><div class="actions"><button class="btn" data-game="resume">继续<kbd>Esc</kbd></button><button class="btn ghost" data-game="quit">不追了</button></div></div>';
      } else if (p.phase === "won" || p.phase === "lost") {
        html = this.lastOverlay.startsWith('<div class="ov-card result') ? this.lastOverlay : "";
      }
      if (html !== this.lastOverlay) {
        el.innerHTML = html;
        this.lastOverlay = html;
      }
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
      const html = '<div class="ov-card result ' + p.phase + '"><div class="ov-main"><div class="ov-title"><b>' + title + '</b><span class="ov-sub">' + h.esc(sub) + '</span></div><div class="ov-stats"><div><b>' + wpm + "</b><span>词 / 分钟</span></div><div><b>" + acc + "%</b><span>正确率</span></div><div><b>" + clock(p.run.elapsed(now)) + '</b><span>用时</span></div></div><div class="ov-acts"><button class="btn" data-game="next">再来一篇<kbd>Enter</kbd></button><button class="btn ghost" data-game="setup">换难度<kbd>Esc</kbd></button></div></div>' + (missedWords.length ? '<p class="ov-miss"><span class="muted small">打错过</span> ' + missedWords.map((w) => '<span class="mw">' + h.esc(w) + "</span>").join(" ") + "</p>" : "") + "</div>";
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
      const ps = pickPassage(this.host, p.book, c.seen, p.passage.key);
      this.start(ps);
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
    /** 从存档里恢复上次的文章（测试用） */
    passage(key) {
      return passageByKey(this.host, key);
    }
    /** 测试用：当前这局 */
    debug() {
      const p = this.play;
      return p ? { phase: p.phase, pos: p.run.pos, len: p.passage.text.length, thief: p.thief, wrong: p.run.wrong, text: p.passage.text, reward: p.reward, keys: p.run.keys, hits: p.run.hits } : null;
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
  var icons = {};
  function icon(kind) {
    if (icons[kind]) return icons[kind];
    const cv = document.createElement("canvas");
    const c = cv.getContext("2d");
    if (!c) return "";
    if (kind === "car") {
      cv.width = 40;
      cv.height = 20;
      c.translate(2, -(Y.ground - 19));
      drawCar(c, 0, 1, 0, 0, true);
    } else if (kind === "thief") {
      cv.width = 16;
      cv.height = 24;
      c.translate(3, -(Y.ground - 23));
      drawThief(c, 0, 1, "run");
    } else {
      cv.width = 160;
      cv.height = 72;
      const p = PALETTES.dusk;
      const g = c.createLinearGradient(0, 0, 0, 72);
      g.addColorStop(0, p.sky[0]);
      g.addColorStop(0.6, p.sky[1]);
      g.addColorStop(1, p.sky[2]);
      c.fillStyle = g;
      c.fillRect(0, 0, 160, 72);
      for (let i = 0; i < 12; i++) {
        const h = 14 + i * 37 % 22;
        c.fillStyle = p.far;
        c.fillRect(i * 14, 46 - h, 13, h + 6);
      }
      c.fillStyle = p.sidewalk;
      c.fillRect(0, 46, 160, 6);
      c.fillStyle = p.road;
      c.fillRect(0, 52, 160, 20);
      c.fillStyle = p.lane;
      for (let x = 4; x < 160; x += 24) c.fillRect(x, 63, 12, 1);
      c.save();
      c.translate(18, -(Y.ground - 70));
      drawCar(c, 0, 1, 0.3, 0, true);
      c.restore();
      c.save();
      c.translate(104, -(Y.ground - 70));
      drawThief(c, 0, 2, "run");
      c.restore();
    }
    icons[kind] = cv.toDataURL();
    return icons[kind];
  }

  // src/hub.ts
  var GAMES = [
    {
      id: "chase",
      name: "打字追击",
      desc: "打对一个字母，警车就往前开一点，在小偷跑进仓库前追上他。文章按词库挑，金融、医学、托福、GRE……",
      cover: () => icon("cover")
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
