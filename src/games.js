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

  // src/chase/sprites.ts
  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }
  function shade(hex, amt) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
  }
  var SKIN = "#f0c48e";
  var SKIN_D = "#d9a56f";
  var HAT = "#24252e";
  var STRIPE_A = "#eeebe3";
  var STRIPE_B = "#2c2f3c";
  var PANTS = "#3b4462";
  var SHOE = "#141419";
  var BAG = "#c8a066";
  var BAG_D = "#a47e4a";
  function drawThief(c, frame, caught) {
    const run = !caught;
    const lift = run && frame % 2 === 1 ? -1 : 0;
    const top = 2 + lift;
    if (!caught) {
      px(c, 0, top + 6, 6, 7, BAG_D);
      px(c, 1, top + 5, 4, 8, BAG);
      px(c, 2, top + 4, 2, 1, BAG_D);
      px(c, 2, top + 7, 1, 4, "#5a3f1f");
      px(c, 1, top + 8, 3, 1, "#5a3f1f");
      px(c, 1, top + 10, 3, 1, "#5a3f1f");
    }
    const lf = run ? [[-3, 3], [-1, 1], [3, -3], [1, -1]][frame] : [0, 0];
    px(c, 5 + lf[1], top + 14, 2, 5, shade(PANTS, -0.25));
    px(c, 5 + lf[1] - (lf[1] < 0 ? 1 : 0), top + 18, 3, 2, SHOE);
    px(c, 8 + lf[0], top + 14, 2, 5, PANTS);
    px(c, 8 + lf[0], top + 18, 3, 2, SHOE);
    for (let r = 0; r < 7; r++) px(c, 4, top + 7 + r, 8, 1, r % 2 ? STRIPE_B : STRIPE_A);
    px(c, 11, top + 8, 1, 6, "rgba(0,0,0,.15)");
    if (caught) {
      px(c, 3, top + 1, 2, 7, STRIPE_A);
      px(c, 11, top + 1, 2, 7, STRIPE_A);
      px(c, 3, top, 2, 2, SKIN);
      px(c, 11, top, 2, 2, SKIN);
    } else {
      const sw = [2, 0, -2, 0][frame];
      px(c, 9 + sw, top + 8, 2, 4, STRIPE_A);
      px(c, 9 + sw, top + 12, 2, 1, SKIN);
      px(c, 3, top + 7, 2, 3, STRIPE_B);
    }
    px(c, 5, top + 1, 6, 6, SKIN);
    px(c, 10, top + 3, 2, 2, SKIN);
    px(c, 5, top + 5, 6, 1, SKIN_D);
    px(c, 5, top + 3, 7, 2, "#1b1c22");
    px(c, 9, top + 3, 1, 1, "#ffffff");
    px(c, 4, top - 1, 8, 3, HAT);
    px(c, 5, top - 2, 6, 1, HAT);
    px(c, 4, top + 1, 8, 1, shade(HAT, 0.2));
  }
  function make(w, h, fx, fy, draw) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    draw(c);
    return { img: cv, fx, fy };
  }
  var thief = null;
  var thiefCaught = null;
  function thiefSprite(frame, caught = false) {
    if (caught) return thiefCaught || (thiefCaught = make(16, 24, 8, 22, (c) => drawThief(c, 0, true)));
    if (!thief) thief = [0, 1, 2, 3].map((f) => make(16, 24, 8, 22, (c) => drawThief(c, f, false)));
    return thief[frame & 3];
  }
  function blitFoot(c, s, x, y, flip = false) {
    const X = Math.round(x);
    const Y = Math.round(y);
    if (!flip) {
      c.drawImage(s.img, X - s.fx, Y - s.fy);
      return;
    }
    c.save();
    c.translate(X, Y);
    c.scale(-1, 1);
    c.drawImage(s.img, -s.fx, -s.fy);
    c.restore();
  }
  function shadow(c, x, y, rx, ry) {
    c.fillStyle = "rgba(10,12,25,.28)";
    c.beginPath();
    c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  // src/chase/iso.ts
  function timeOfDay(d = /* @__PURE__ */ new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 17) return "day";
    if (h >= 17 && h < 19.5 || h >= 5.5 && h < 7) return "dusk";
    return "night";
  }
  var TW = 32;
  var TH = 16;
  var ROAD = 2;
  var BLOCK = 8;
  var PITCH = ROAD + BLOCK;
  var MAX_H = 64;
  var PAL = {
    day: {
      grass: "#86bd68",
      grassD: "#78ae5c",
      road: "#5b616c",
      roadD: "#535862",
      walk: "#dcd3c3",
      walkD: "#c8bdaa",
      lane: "#f2d977",
      zebra: "#f2eee6",
      walls: ["#e3a982", "#e8cf9a", "#9fc3b6", "#b8bad6", "#d9c3ac", "#c98f78", "#a7b8c9", "#efe2c9"],
      window: "#9fcbe3",
      lit: "#ffe39a",
      litRate: 0,
      tree: ["#5fa54c", "#3e7f3a"],
      water: "#62a6d6"
    },
    dusk: {
      grass: "#719a58",
      grassD: "#658d4d",
      road: "#4c4e5a",
      roadD: "#45474f",
      walk: "#c9b8a8",
      walkD: "#b3a493",
      lane: "#e8c67a",
      zebra: "#e6ddd0",
      walls: ["#c48268", "#cfae82", "#7f9f97", "#9a99b6", "#bba18e", "#a9705e", "#8796a6", "#d6c4a8"],
      window: "#5e6c86",
      lit: "#ffd27a",
      litRate: 0.4,
      tree: ["#4f8445", "#386536"],
      water: "#5a7fb3"
    },
    night: {
      grass: "#3e5a45",
      grassD: "#38513e",
      road: "#30323c",
      roadD: "#2b2d36",
      walk: "#6e6c78",
      walkD: "#62606c",
      lane: "#b49d62",
      zebra: "#9f9da8",
      walls: ["#5b4a58", "#635c6c", "#41595d", "#4f4f6b", "#5d525c", "#4c424c", "#465264", "#6a5f62"],
      window: "#2b3248",
      lit: "#ffd27a",
      litRate: 0.5,
      tree: ["#35593f", "#284634"],
      water: "#2c4670"
    }
  };
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
  var CAR_COLORS = ["#c94a3f", "#3f6fc9", "#e6c34a", "#6d8b5a", "#e8e4dc", "#3a3d47", "#8a5ab0", "#e08a3c"];
  var IsoCity = class {
    constructor(seed, wantCells, tod) {
      this.things = [];
      this.lamps = [];
      this.cum = [];
      this.tod = tod;
      this.P = PAL[tod];
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
      this.oy = MAX_H + 20;
      this.width = (this.gw + this.gh) * (TW / 2);
      this.height = (this.gw + this.gh) * (TH / 2) + this.oy + 10;
      this.ground = this.drawGround();
    }
    /** 格子坐标 → 大地图上的像素 */
    sx(g) {
      return (g.gx - g.gy) * (TW / 2) + this.ox;
    }
    sy(g) {
      return (g.gx + g.gy) * (TH / 2) + this.oy;
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
    // ---------------- 地面 ----------------
    cellKind(gx, gy) {
      const mx = (gx % PITCH + PITCH) % PITCH;
      const my = (gy % PITCH + PITCH) % PITCH;
      if (mx < ROAD || my < ROAD) return "road";
      if (mx === ROAD || my === ROAD || mx === PITCH - 1 || my === PITCH - 1) return "walk";
      return "block";
    }
    diamond(c, gx, gy, w, h, color) {
      const a = { gx, gy };
      const b = { gx: gx + w, gy };
      const cc = { gx: gx + w, gy: gy + h };
      const d = { gx, gy: gy + h };
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(this.sx(a), this.sy(a));
      c.lineTo(this.sx(b), this.sy(b));
      c.lineTo(this.sx(cc), this.sy(cc));
      c.lineTo(this.sx(d), this.sy(d));
      c.closePath();
      c.fill();
    }
    drawGround() {
      const cv = document.createElement("canvas");
      cv.width = this.width;
      cv.height = this.height;
      const c = cv.getContext("2d");
      const P = this.P;
      const R = this.rand;
      c.fillStyle = "#2b2e38";
      c.fillRect(0, 0, this.width, this.height);
      for (let gy = 0; gy < this.gh; gy++) {
        for (let gx = 0; gx < this.gw; gx++) {
          const k = this.cellKind(gx, gy);
          const col = k === "road" ? (gx + gy) % 7 === 0 ? P.roadD : P.road : k === "walk" ? (gx + gy) % 2 ? P.walk : P.walkD : (gx * 7 + gy * 13) % 5 === 0 ? P.grassD : P.grass;
          this.diamond(c, gx, gy, 1, 1, col);
        }
      }
      c.lineWidth = 1;
      for (let bx = 0; bx * PITCH < this.gw; bx++) {
        for (let by = 0; by * PITCH < this.gh; by++) {
          const x0 = bx * PITCH;
          const y0 = by * PITCH;
          for (let t = ROAD + 0.6; t < PITCH - 0.4; t += 1.2) this.dash(c, { gx: x0 + t, gy: y0 + 1 }, { gx: x0 + t + 0.55, gy: y0 + 1 }, P.lane);
          for (let t = ROAD + 0.6; t < PITCH - 0.4; t += 1.2) this.dash(c, { gx: x0 + 1, gy: y0 + t }, { gx: x0 + 1, gy: y0 + t + 0.55 }, P.lane);
          for (let k = 0; k < 4; k++) {
            const u = 0.15 + k * 0.45;
            this.stripe(c, { gx: x0 + ROAD + 0.15, gy: y0 + u }, { gx: x0 + ROAD + 0.75, gy: y0 + u }, P.zebra);
            this.stripe(c, { gx: x0 - 0.75, gy: y0 + u }, { gx: x0 - 0.15, gy: y0 + u }, P.zebra);
            this.stripe(c, { gx: x0 + u, gy: y0 + ROAD + 0.15 }, { gx: x0 + u, gy: y0 + ROAD + 0.75 }, P.zebra);
            this.stripe(c, { gx: x0 + u, gy: y0 - 0.75 }, { gx: x0 + u, gy: y0 - 0.15 }, P.zebra);
          }
          this.lamps.push({ gx: x0 + ROAD + 0.4, gy: y0 + ROAD + 0.4 });
        }
      }
      const hs = this.house;
      const nearHouse = (gx, gy, w, d) => gx < hs.gx + hs.w + 1 && gx + w > hs.gx - 1 && gy < hs.gy + hs.d + 1 && gy + d > hs.gy - 1;
      for (let bx = 0; bx * PITCH + ROAD < this.gw; bx++) {
        for (let by = 0; by * PITCH + ROAD < this.gh; by++) {
          const x0 = bx * PITCH + ROAD + 1;
          const y0 = by * PITCH + ROAD + 1;
          if (x0 + 6 > this.gw || y0 + 6 > this.gh) continue;
          if (nearHouse(x0 - 1, y0 - 1, 8, 8)) {
            this.diamond(c, x0 - 1, y0 - 1, 8, 8, shade(P.walk, -0.1));
            continue;
          }
          const r = R();
          if (r < 0.16) this.park(c, x0, y0);
          else if (r < 0.24) this.parking(c, x0, y0);
          else this.buildings(x0, y0);
        }
      }
      for (let bx = 0; bx * PITCH < this.gw; bx++) {
        for (let by = 0; by * PITCH < this.gh; by++) {
          const x0 = bx * PITCH;
          const y0 = by * PITCH;
          for (let t = ROAD + 1.5; t < PITCH - 1; t += 2.5 + R() * 2) {
            if (R() < 0.3) this.parked({ gx: x0 + t, gy: y0 + (R() < 0.5 ? 0.35 : 1.65) }, "x");
            if (R() < 0.3) this.parked({ gx: x0 + (R() < 0.5 ? 0.35 : 1.65), gy: y0 + t }, "y");
            if (R() < 0.35) this.tree({ gx: x0 + t, gy: y0 + ROAD + 0.5 }, 0.8);
            if (R() < 0.35) this.tree({ gx: x0 + ROAD + 0.5, gy: y0 + t }, 0.8);
          }
        }
      }
      const onRoute = (g) => this.path.some((p) => Math.abs(p.gx - g.gx) < 1.1 && Math.abs(p.gy - g.gy) < 1.1);
      for (let k = this.things.length - 1; k >= 0; k--) {
        const t = this.things[k];
        if (t.g && (t.car && onRoute(t.g) || nearHouse(t.g.gx, t.g.gy, 0, 0))) this.things.splice(k, 1);
      }
      this.diamond(c, hs.gx - 0.6, hs.gy - 0.6, hs.w + 1.2, hs.d + 1.2, shade(P.road, 0.04));
      this.box(hs.gx, hs.gy, hs.w, hs.d, 34, { wall: "#6a5f70", roof: "#4a4152", door: { gx: this.hideout.gx, gy: hs.gy + hs.d }, sign: true });
      this.things.sort((a, b) => a.depth - b.depth);
      return cv;
    }
    dash(c, a, b, color) {
      c.strokeStyle = color;
      c.beginPath();
      c.moveTo(this.sx(a), this.sy(a));
      c.lineTo(this.sx(b), this.sy(b));
      c.stroke();
    }
    stripe(c, a, b, color) {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(this.sx(a), this.sy(a));
      c.lineTo(this.sx(b), this.sy(b));
      c.stroke();
      c.lineWidth = 1;
    }
    // ---------------- 楼 ----------------
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
        const big = w * d;
        const h = Math.round((big > 10 ? 26 : 18) + R() * (big > 10 ? 38 : 28));
        this.box(x, y, w, d, Math.min(MAX_H, h));
      }
    }
    /** 一栋楼：两面墙（带窗户）+ 屋顶，画成一张小图 */
    box(x, y, w, d, h, opt) {
      const R = this.rand;
      const P = this.P;
      const wall = opt?.wall || P.walls[Math.floor(R() * P.walls.length)];
      const roof = opt?.roof || shade(wall, -0.18);
      const A = { gx: x, gy: y };
      const B = { gx: x + w, gy: y };
      const C = { gx: x + w, gy: y + d };
      const D = { gx: x, gy: y + d };
      const xs = [A, B, C, D].map((g) => this.sx(g));
      const ys = [A, B, C, D].map((g) => this.sy(g));
      const left = Math.floor(Math.min(...xs)) - 2;
      const top = Math.floor(Math.min(...ys)) - h - 2;
      const W = Math.ceil(Math.max(...xs)) - left + 6;
      const H = Math.ceil(Math.max(...ys)) - top + 6;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const c = cv.getContext("2d");
      const p = (g, up = 0) => [this.sx(g) - left, this.sy(g) - top - up];
      const poly = (pts, color) => {
        c.fillStyle = color;
        c.beginPath();
        pts.forEach(([a, b], k) => k ? c.lineTo(a, b) : c.moveTo(a, b));
        c.closePath();
        c.fill();
      };
      poly([p(B), p({ gx: B.gx + 0.9, gy: B.gy + 0.2 }), p({ gx: C.gx + 0.9, gy: C.gy + 0.4 }), p({ gx: D.gx + 0.3, gy: D.gy + 0.4 }), p(D), p(C)], "rgba(15,15,30,.22)");
      const rightWall = shade(wall, -0.08);
      const leftWall = shade(wall, -0.28);
      poly([p(B), p(C), p(C, h), p(B, h)], rightWall);
      poly([p(D), p(C), p(C, h), p(D, h)], leftWall);
      const floors = Math.max(1, Math.floor((h - 6) / 9));
      const lit = (k) => R() < P.litRate || k < 0;
      const winOn = (g0, g1, base) => {
        const len = Math.hypot(g1.gx - g0.gx, g1.gy - g0.gy);
        const cols = Math.max(1, Math.floor(len / 0.62));
        for (let f = 0; f < floors; f++) {
          for (let k = 0; k < cols; k++) {
            const t = (k + 0.5) / cols;
            const g = { gx: g0.gx + (g1.gx - g0.gx) * t, gy: g0.gy + (g1.gy - g0.gy) * t };
            const [wx, wy] = p(g, 6 + f * 9);
            c.fillStyle = lit(0) ? P.lit : base;
            c.fillRect(Math.round(wx) - 1, Math.round(wy) - 4, 3, 4);
          }
        }
      };
      winOn(B, C, shade(P.window, -0.05));
      winOn(D, C, shade(P.window, -0.25));
      c.strokeStyle = shade(wall, -0.45);
      c.lineWidth = 1;
      c.beginPath();
      const [cx, cy] = p(C);
      c.moveTo(cx, cy);
      c.lineTo(cx, cy - h);
      c.stroke();
      poly([p(A, h), p(B, h), p(C, h), p(D, h)], roof);
      const inset = 0.2;
      poly(
        [p({ gx: A.gx + inset, gy: A.gy + inset }, h), p({ gx: B.gx - inset, gy: B.gy + inset }, h), p({ gx: C.gx - inset, gy: C.gy - inset }, h), p({ gx: D.gx + inset, gy: D.gy - inset }, h)],
        shade(roof, 0.12)
      );
      const n = Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const g = { gx: x + 0.6 + R() * (w - 1.4), gy: y + 0.6 + R() * (d - 1.4) };
        const [ax, ay] = p(g, h);
        c.fillStyle = "#8f949e";
        c.fillRect(Math.round(ax) - 3, Math.round(ay) - 4, 6, 4);
        c.fillStyle = "#6d727c";
        c.fillRect(Math.round(ax) - 3, Math.round(ay), 6, 1);
      }
      if (opt?.door) {
        const [dx, dy] = p(opt.door);
        c.fillStyle = "#16141a";
        c.fillRect(Math.round(dx) - 7, Math.round(dy) - 14, 14, 14);
      }
      if (opt?.sign) {
        const [sx, sy] = p({ gx: x + w / 2, gy: y + d / 2 }, h);
        c.fillStyle = "#e8b931";
        c.fillRect(Math.round(sx) - 6, Math.round(sy) - 12, 12, 12);
        c.fillStyle = "#1c1a20";
        c.fillRect(Math.round(sx) - 2, Math.round(sy) - 10, 4, 2);
        c.fillRect(Math.round(sx), Math.round(sy) - 8, 2, 2);
        c.fillRect(Math.round(sx) - 1, Math.round(sy) - 6, 2, 2);
        c.fillRect(Math.round(sx) - 1, Math.round(sy) - 3, 2, 2);
      }
      this.things.push({ img: cv, x: left, y: top, depth: x + w + y + d, mx: x + w, my: y + d });
    }
    park(c, x0, y0) {
      const P = this.P;
      this.diamond(c, x0, y0, 6, 6, shade(P.grass, 0.08));
      this.diamond(c, x0 + 2.6, y0, 0.8, 6, shade(P.walk, -0.05));
      this.diamond(c, x0, y0 + 2.6, 6, 0.8, shade(P.walk, -0.05));
      this.diamond(c, x0 + 2.1, y0 + 2.1, 1.8, 1.8, shade(P.walk, -0.18));
      this.diamond(c, x0 + 2.3, y0 + 2.3, 1.4, 1.4, P.water);
      for (const [a, b] of [[0.9, 0.9], [4.7, 1.2], [1.2, 4.6], [4.6, 4.5], [1.6, 2], [4.2, 3.6]]) if (this.rand() < 0.85) this.tree({ gx: x0 + a, gy: y0 + b }, 1);
    }
    parking(c, x0, y0) {
      const P = this.P;
      this.diamond(c, x0, y0, 6, 6, P.road);
      for (let k = 0; k < 6; k += 1) this.dash(c, { gx: x0 + k + 0.5, gy: y0 + 0.2 }, { gx: x0 + k + 0.5, gy: y0 + 1.6 }, P.zebra);
      for (let k = 0; k < 6; k += 1) this.dash(c, { gx: x0 + k + 0.5, gy: y0 + 4.4 }, { gx: x0 + k + 0.5, gy: y0 + 5.8 }, P.zebra);
      for (let k = 0; k < 5; k++) {
        if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 0.9 }, "y");
        if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 5.1 }, "y");
      }
    }
    // ---------------- 树、车 ----------------
    tree(g, size) {
      const P = this.P;
      const r = Math.round(7 * size);
      const cv = document.createElement("canvas");
      cv.width = r * 2 + 4;
      cv.height = r * 2 + 12;
      const c = cv.getContext("2d");
      c.fillStyle = "rgba(15,15,30,.22)";
      c.beginPath();
      c.ellipse(r + 3, r * 2 + 9, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#6b4a33";
      c.fillRect(r + 1, r + 4, 3, r + 4);
      for (let y = -r; y <= r; y++) {
        const half = Math.round(Math.sqrt(r * r - y * y));
        c.fillStyle = y > r / 3 ? P.tree[1] : P.tree[0];
        c.fillRect(r + 2 - half, r + 2 + y, half * 2, 1);
      }
      c.fillStyle = shade(P.tree[0], 0.22);
      c.fillRect(r - 3, 4, 3, 2);
      c.fillRect(r + 2, 7, 2, 2);
      this.things.push({ img: cv, x: Math.round(this.sx(g)) - r - 2, y: Math.round(this.sy(g)) - r * 2 - 9, depth: g.gx + g.gy, mx: g.gx, my: g.gy, g });
    }
    parked(g, along) {
      const color = CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)];
      const cv = document.createElement("canvas");
      cv.width = 34;
      cv.height = 26;
      const c = cv.getContext("2d");
      drawIsoCar(c, 17, 18, along === "x" ? { gx: 1, gy: 0 } : { gx: 0, gy: 1 }, color, null);
      this.things.push({ img: cv, x: Math.round(this.sx(g)) - 17, y: Math.round(this.sy(g)) - 18, depth: g.gx + g.gy, mx: g.gx, my: g.gy, g, car: true });
    }
  };
  function drawIsoCar(c, cx, cy, dir, color, light) {
    const proj = (gx, gy, up = 0) => [cx + (gx - gy) * (TW / 2), cy + (gx + gy) * (TH / 2) - up];
    const fx = dir.gx;
    const fy = dir.gy;
    const L = 0.62;
    const Wd = 0.34;
    const side = { gx: -fy, gy: fx };
    const corner = (a, b) => ({ gx: fx * a + side.gx * b, gy: fy * a + side.gy * b });
    const poly = (pts, col) => {
      c.fillStyle = col;
      c.beginPath();
      pts.forEach(([a, b], k) => k ? c.lineTo(a, b) : c.moveTo(a, b));
      c.closePath();
      c.fill();
    };
    const P = (g, up = 0) => proj(g.gx, g.gy, up);
    c.fillStyle = "rgba(10,12,25,.3)";
    c.beginPath();
    c.ellipse(cx + 1, cy + 2, 13, 5, 0, 0, Math.PI * 2);
    c.fill();
    const corners = [corner(L, Wd), corner(L, -Wd), corner(-L, -Wd), corner(-L, Wd)];
    const h1 = 5;
    const faces = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0]
    ];
    for (const [a, b] of faces) {
      const ga = corners[a];
      const gb = corners[b];
      const nx = (ga.gx + gb.gx) / 2;
      const ny = (ga.gy + gb.gy) / 2;
      if (nx + ny <= 1e-3) continue;
      const front = Math.abs(nx - fx * L) < 0.01 && Math.abs(ny - fy * L) < 0.01;
      poly([P(ga), P(gb), P(gb, h1), P(ga, h1)], front ? shade(color, -0.12) : shade(color, -0.3));
    }
    poly(corners.map((g) => P(g, h1)), color);
    const cab = [corner(0.18, Wd * 0.8), corner(0.18, -Wd * 0.8), corner(-0.36, -Wd * 0.8), corner(-0.36, Wd * 0.8)];
    const h2 = 4;
    for (const [a, b] of faces) {
      const ga = cab[a];
      const gb = cab[b];
      const nx = (ga.gx + gb.gx) / 2 + fx * 0.09;
      const ny = (ga.gy + gb.gy) / 2 + fy * 0.09;
      if (nx + ny <= 1e-3) continue;
      poly([P(ga, h1), P(gb, h1), P(gb, h1 + h2), P(ga, h1 + h2)], "#5f8fb3");
    }
    poly(cab.map((g) => P(g, h1 + h2)), light === null ? shade(color, 0.12) : "#f6f5f0");
    if (light !== null) {
      const s1 = corner(0.3, Wd);
      const s2 = corner(-0.45, Wd);
      const s3 = corner(0.3, -Wd);
      const s4 = corner(-0.45, -Wd);
      for (const [a, b] of [[s1, s2], [s3, s4]]) {
        const nx = (a.gx + b.gx) / 2;
        const ny = (a.gy + b.gy) / 2;
        if (nx + ny <= 0) continue;
        poly([P(a, 1.5), P(b, 1.5), P(b, 3.5), P(a, 3.5)], "#23356a");
      }
      const l1 = corner(-0.05, 0.22);
      const l2 = corner(-0.05, -0.22);
      const [ax, ay] = P(l1, h1 + h2 + 1);
      const [bx, by] = P(l2, h1 + h2 + 1);
      c.fillStyle = light === 0 ? "#ff4d43" : "#7a2c28";
      c.fillRect(Math.round(ax) - 1, Math.round(ay) - 2, 3, 3);
      c.fillStyle = light === 1 ? "#4fa3ff" : "#284a80";
      c.fillRect(Math.round(bx) - 1, Math.round(by) - 2, 3, 3);
    }
    const hl = corner(L + 0.01, Wd * 0.6);
    const hr = corner(L + 0.01, -Wd * 0.6);
    if (fx + fy > 0) {
      for (const g of [hl, hr]) {
        const [a, b] = P(g, 2.5);
        c.fillStyle = "#fff1b0";
        c.fillRect(Math.round(a), Math.round(b) - 1, 2, 2);
      }
    }
  }
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

  // src/chase/scene.ts
  var START = 2.5;
  var THIEF_AHEAD = 0.9;
  var DOOR_BEFORE = 0.25;
  var ChaseScene = class {
    constructor(get, city) {
      this.canvas = null;
      this.wrap = null;
      this.ctx = null;
      this.raf = 0;
      this.ro = null;
      this.w = 300;
      this.h = 160;
      this.scale = 2;
      this.camX = 0;
      this.camY = 0;
      this.policeS = START;
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
    /** 画布按 2 倍放大（像素清楚）；高度用满窗口剩下的地方，整页不用滚动 */
    fit() {
      if (!this.canvas || !this.wrap) return;
      const r = this.wrap.getBoundingClientRect();
      const border = this.wrap.offsetWidth - this.wrap.clientWidth;
      const cssW = Math.max(300, r.width - border);
      const top = r.top + window.scrollY;
      const cssH = Math.round(Math.max(240, Math.min(500, window.innerHeight - top - 345)));
      this.scale = 2;
      this.w = Math.ceil(cssW / this.scale);
      this.h = Math.ceil(cssH / this.scale);
      this.canvas.width = this.w;
      this.canvas.height = this.h;
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = this.h * this.scale + "px";
      this.wrap.style.height = this.h * this.scale + "px";
      if (this.ctx) this.ctx.imageSmoothingEnabled = false;
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
      [this.camX, this.camY] = this.camTarget(s);
    }
    draw(t) {
      const c = this.ctx;
      if (!c) return;
      const dt = Math.min(0.05, (t - this.last) / 1e3);
      this.last = t;
      const s = this.get();
      const city = this.city;
      const target = this.policeTarget(s.police);
      this.policeS += (target - this.policeS) * Math.min(1, dt * 8);
      if (Math.abs(target - this.policeS) < 5e-3) this.policeS = target;
      const [tx, ty] = this.camTarget(s);
      this.camX += (tx - this.camX) * Math.min(1, dt * 3.5);
      this.camY += (ty - this.camY) * Math.min(1, dt * 3.5);
      const cx = Math.round(this.camX);
      const cy = Math.round(this.camY);
      const w = this.w;
      const h = this.h;
      const X = (g) => city.sx(g) - cx;
      const Y = (g) => city.sy(g) - cy;
      px(c, 0, 0, w, h, "#2b2e38");
      c.drawImage(city.ground, cx, cy, Math.min(w, city.width - cx), Math.min(h, city.height - cy), 0, 0, Math.min(w, city.width - cx), Math.min(h, city.height - cy));
      for (const k of this.skids) {
        k.t += dt;
        const al = Math.max(0, 0.5 - k.t / 12);
        if (al <= 0) continue;
        c.strokeStyle = `rgba(18,18,24,${al.toFixed(2)})`;
        c.lineWidth = 1;
        for (const off of [-0.18, 0.18]) {
          const side = { gx: -k.dir.gy * off, gy: k.dir.gx * off };
          const a = { gx: k.g.gx + side.gx - k.dir.gx * 0.2, gy: k.g.gy + side.gy - k.dir.gy * 0.2 };
          const b = { gx: k.g.gx + side.gx - k.dir.gx * 0.9, gy: k.g.gy + side.gy - k.dir.gy * 0.9 };
          c.beginPath();
          c.moveTo(X(a), Y(a));
          c.lineTo(X(b), Y(b));
          c.stroke();
        }
      }
      this.skids = this.skids.filter((k) => k.t < 6);
      const pol = city.at(this.policeS);
      const thiefPos = city.at(this.thiefS(s.thief));
      const gone = s.phase === "lost" && t - s.endAt > 250;
      const flash = s.phase === "ready" ? -1 : Math.floor(t / 130) % 2;
      const axis = (d) => Math.abs(d.gx) >= Math.abs(d.gy) ? { gx: Math.sign(d.gx) || 1, gy: 0 } : { gx: 0, gy: Math.sign(d.gy) || 1 };
      const ents = [];
      if (!gone) {
        ents.push({
          g: thiefPos,
          done: false,
          draw: (alpha) => {
            c.globalAlpha = alpha;
            if (alpha === 1) shadow(c, X(thiefPos), Y(thiefPos), 5, 2);
            const running = s.phase === "run";
            const spr = s.phase === "won" ? thiefSprite(0, true) : thiefSprite(running ? Math.floor(t / 85) : 0);
            const flip = thiefPos.dir.gx - thiefPos.dir.gy < -0.1;
            blitFoot(c, spr, X(thiefPos), Y(thiefPos), flip);
            c.globalAlpha = 1;
          }
        });
      }
      ents.push({
        g: pol,
        done: false,
        draw: (alpha) => {
          c.globalAlpha = alpha;
          drawIsoCar(c, Math.round(X(pol)), Math.round(Y(pol)), axis(pol.dir), "#f6f5f0", flash);
          c.globalAlpha = 1;
        }
      });
      ents.sort((a, b) => a.g.gx + a.g.gy - (b.g.gx + b.g.gy));
      const inFront = (th, e) => th.mx > e.g.gx + 0.05 && th.my > e.g.gy + 0.05;
      for (const th of city.things) {
        if (th.x - cx > w || th.y - cy > h || th.x + th.img.width - cx < 0 || th.y + th.img.height - cy < 0) continue;
        for (const e of ents) {
          if (!e.done && inFront(th, e)) {
            e.draw(1);
            e.done = true;
          }
        }
        c.drawImage(th.img, th.x - cx, th.y - cy);
      }
      for (const e of ents) if (!e.done) e.draw(1);
      for (const e of ents) e.draw(0.3);
      if (s.phase === "won" && !gone) this.stars(c, X(thiefPos), Y(thiefPos) - 26, t);
      const back = { gx: pol.gx - pol.dir.gx * 0.75, gy: pol.gy - pol.dir.gy * 0.75 };
      const moving = Math.abs(target - this.policeS) > 0.02 && s.phase === "run";
      if (t < this.boostUntil && s.phase === "run") {
        for (let k = 0; k < 2; k++) {
          const bx = city.sx(back);
          const by = city.sy(back) - 3;
          const vx = -(pol.dir.gx - pol.dir.gy) * 18;
          const vy = -(pol.dir.gx + pol.dir.gy) * 9;
          this.sparks.push({ x: bx + (Math.random() - 0.5) * 4, y: by + (Math.random() - 0.5) * 3, vx, vy, t: 0, kind: "flame" });
        }
      } else if (moving && Math.random() < dt * 12) {
        this.sparks.push({ x: city.sx(back), y: city.sy(back), vx: 0, vy: 0, t: 0, kind: "dust" });
      }
      if (s.phase === "run" && !gone && Math.random() < dt * 8) {
        this.sparks.push({ x: city.sx(thiefPos) - 3, y: city.sy(thiefPos), vx: 0, vy: 0, t: 0, kind: "dust" });
      }
      for (const p of this.sparks) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "flame") {
          const col = p.t < 0.12 ? "#fff3b0" : p.t < 0.25 ? "#ffb347" : "#e8553d";
          if (p.t < 0.3) px(c, Math.round(p.x - cx), Math.round(p.y - cy), 2, 2, col);
        } else {
          const a = Math.max(0, 0.4 - p.t * 0.5);
          c.fillStyle = `rgba(225,215,195,${a.toFixed(2)})`;
          const r = 1 + Math.round(p.t * 3);
          c.fillRect(Math.round(p.x - cx - r), Math.round(p.y - cy - r - p.t * 4), r * 2, r * 2);
        }
      }
      this.sparks = this.sparks.filter((p) => p.t < (p.kind === "flame" ? 0.3 : 0.9));
      this.lighting(c, pol, flash, X, Y);
      this.minimap(c, s, pol, thiefPos, gone);
      if (!gone) this.arrow(c, X(thiefPos), Y(thiefPos) - 10);
    }
    stars(c, x, y, t) {
      for (let i = 0; i < 3; i++) {
        const a = t / 260 + i * Math.PI * 2 / 3;
        const sx = Math.round(x + Math.cos(a) * 7);
        const sy = Math.round(y + Math.sin(a) * 2.5);
        px(c, sx, sy - 1, 1, 3, "#ffd75e");
        px(c, sx - 1, sy, 3, 1, "#ffd75e");
      }
    }
    lighting(c, pol, flash, X, Y) {
      const tod = this.city.tod;
      if (tod === "day") return;
      const w = this.w;
      const h = this.h;
      if (!this.light || this.light.width !== w || this.light.height !== h) {
        this.light = document.createElement("canvas");
        this.light.width = w;
        this.light.height = h;
      }
      const l = this.light.getContext("2d");
      l.globalCompositeOperation = "source-over";
      l.clearRect(0, 0, w, h);
      l.fillStyle = tod === "night" ? "rgba(6,10,32,.5)" : "rgba(60,30,60,.2)";
      l.fillRect(0, 0, w, h);
      l.globalCompositeOperation = "destination-out";
      const hole = (x, y, rx, ry, a) => {
        l.save();
        l.translate(x, y);
        l.scale(1, ry / rx);
        const g = l.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        l.fillStyle = g;
        l.fillRect(-rx, -rx, rx * 2, rx * 2);
        l.restore();
      };
      for (const p of this.city.lamps) {
        const x = X(p);
        const y = Y(p);
        if (x < -50 || y < -50 || x > w + 50 || y > h + 50) continue;
        hole(x, y, 34, 18, 0.85);
      }
      const ahead = { gx: pol.gx + pol.dir.gx * 1.8, gy: pol.gy + pol.dir.gy * 1.8 };
      hole(X(ahead), Y(ahead), 30, 15, 0.9);
      hole(X(pol), Y(pol), 18, 10, 0.8);
      l.globalCompositeOperation = "source-over";
      c.drawImage(this.light, 0, 0);
      c.save();
      c.globalCompositeOperation = "lighter";
      if (flash >= 0) {
        const x = X(pol);
        const y = Y(pol) - 8;
        const g = c.createRadialGradient(x, y, 0, x, y, 28);
        g.addColorStop(0, flash ? "rgba(60,120,255,.35)" : "rgba(255,60,50,.35)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(x - 28, y - 28, 56, 56);
      }
      for (const p of this.city.lamps) {
        const x = X(p);
        const y = Y(p);
        if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
        const g = c.createRadialGradient(x, y, 0, x, y, 20);
        g.addColorStop(0, `rgba(255,200,120,${tod === "night" ? 0.2 : 0.1})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(x - 20, y - 20, 40, 40);
      }
      c.restore();
    }
    /** 右上角的小地图：整条路线、警车、小偷、仓库 */
    minimap(c, s, pol, th, gone) {
      const city = this.city;
      const pts = city.path.map((g) => [city.sx(g), city.sy(g)]);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const spanX = Math.max(...xs) - minX || 1;
      const spanY = Math.max(...ys) - minY || 1;
      const mw = Math.min(96, Math.round(this.w * 0.2));
      const k = mw / spanX;
      const mh = Math.max(14, Math.round(spanY * k));
      const ox = this.w - mw - 8;
      const oy = 7;
      c.fillStyle = "rgba(16,18,28,.55)";
      c.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
      c.strokeStyle = "rgba(255,255,255,.5)";
      c.lineWidth = 1;
      c.beginPath();
      pts.forEach(([x, y], i) => i ? c.lineTo(ox + (x - minX) * k, oy + (y - minY) * k) : c.moveTo(ox + (x - minX) * k, oy + (y - minY) * k));
      c.stroke();
      const dot = (g, r, col) => px(c, Math.round(ox + (city.sx(g) - minX) * k - r), Math.round(oy + (city.sy(g) - minY) * k - r), r * 2, r * 2, col);
      dot(city.hideout, 2, "#e8b931");
      if (!gone && s.phase !== "lost") dot(th, 1.5, "#ff5a4e");
      dot(pol, 2, "#ffffff");
      dot(pol, 1, "#3f7cff");
    }
    /** 小偷跑出画面时，画面边上一个指向他的箭头 */
    arrow(c, x, y) {
      const w = this.w;
      const h = this.h;
      if (x >= 4 && y >= 4 && x <= w - 4 && y <= h - 4) return;
      const ax = Math.max(10, Math.min(w - 10, x));
      const ay = Math.max(10, Math.min(h - 10, y));
      const a = Math.atan2(y - ay, x - ax);
      c.save();
      c.translate(ax, ay);
      c.fillStyle = "rgba(16,18,28,.7)";
      c.beginPath();
      c.arc(0, 0, 8, 0, Math.PI * 2);
      c.fill();
      c.rotate(a);
      c.fillStyle = "#ff5a4e";
      c.beginPath();
      c.moveTo(5, 0);
      c.lineTo(-3, -4);
      c.lineTo(-3, 4);
      c.closePath();
      c.fill();
      c.restore();
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
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const c = cv.getContext("2d");
    if (!c) return "";
    c.imageSmoothingEnabled = false;
    const a = city.at(14);
    const b = city.at(17.2);
    const ox = Math.round((city.sx(a) + city.sx(b)) / 2 - W / 2);
    const oy = Math.round((city.sy(a) + city.sy(b)) / 2 - H * 0.62);
    c.drawImage(city.ground, ox, oy, W, H, 0, 0, W, H);
    const axis = (d) => Math.abs(d.gx) >= Math.abs(d.gy) ? { gx: Math.sign(d.gx) || 1, gy: 0 } : { gx: 0, gy: Math.sign(d.gy) || 1 };
    let carDone = false;
    let thiefDone = false;
    const car = () => drawIsoCar(c, Math.round(city.sx(a) - ox), Math.round(city.sy(a) - oy), axis(a.dir), "#f6f5f0", 0);
    const thief2 = () => {
      shadow(c, city.sx(b) - ox, city.sy(b) - oy, 5, 2);
      blitFoot(c, thiefSprite(1), city.sx(b) - ox, city.sy(b) - oy);
    };
    for (const th of city.things) {
      if (th.x - ox > W || th.y - oy > H || th.x + th.img.width - ox < 0 || th.y + th.img.height - oy < 0) continue;
      if (!thiefDone && th.mx > b.gx && th.my > b.gy) {
        thief2();
        thiefDone = true;
      }
      if (!carDone && th.mx > a.gx && th.my > a.gy) {
        car();
        carDone = true;
      }
      c.drawImage(th.img, th.x - ox, th.y - oy);
    }
    if (!thiefDone) thief2();
    if (!carDone) car();
    const g = c.createRadialGradient(city.sx(a) - ox, city.sy(a) - oy - 8, 0, city.sx(a) - ox, city.sy(a) - oy - 8, 22);
    g.addColorStop(0, "rgba(255,70,60,.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    cover = cv.toDataURL();
    return cover;
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
