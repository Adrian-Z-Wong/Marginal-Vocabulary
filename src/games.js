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
  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    return [c, x];
  }
  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }
  var K = "#151a28";
  var WHITE = "#f6f5f0";
  var WHITE_D = "#dcdbd4";
  var NAVY = "#23356a";
  var GLASS = "#5f97bd";
  var GLASS_L = "#9fd0ea";
  function drawPolice(c, flash) {
    for (const [x, y] of [[4, 1], [16, 1], [4, 12], [16, 12]]) px(c, x, y, 4, 1, "#0d0f14");
    px(c, 1, 2, 22, 10, K);
    px(c, 0, 3, 24, 8, K);
    px(c, 2, 3, 20, 8, WHITE);
    px(c, 1, 4, 22, 6, WHITE);
    px(c, 6, 3, 11, 1, NAVY);
    px(c, 6, 10, 11, 1, NAVY);
    px(c, 15, 4, 2, 6, GLASS);
    px(c, 15, 4, 1, 2, GLASS_L);
    px(c, 5, 4, 2, 6, GLASS);
    px(c, 7, 4, 8, 6, WHITE);
    px(c, 7, 9, 8, 1, WHITE_D);
    px(c, 10, 3, 3, 8, K);
    px(c, 11, 4, 1, 3, flash === 0 ? "#ff4d43" : "#8a2f2b");
    px(c, 11, 7, 1, 3, flash === 1 ? "#4fa3ff" : "#284a80");
    px(c, 23, 4, 1, 2, "#fff1b0");
    px(c, 23, 8, 1, 2, "#fff1b0");
    px(c, 0, 4, 1, 2, "#d0463c");
    px(c, 0, 8, 1, 2, "#d0463c");
    px(c, 19, 4, 3, 1, "#ffffff");
  }
  var SKIN = "#f0c48e";
  var HAT = "#22232c";
  var STRIPE_A = "#efece4";
  var STRIPE_B = "#2b2e3b";
  var BAG = "#c9a066";
  var BAG_D = "#9c7744";
  function drawThief(c, frame, caught) {
    const leg = caught ? 0 : [2, 0, -2, 0][frame];
    const arm = caught ? 0 : [-2, 0, 2, 0][frame];
    px(c, 6 + leg, 3, 3, 2, "#2f3650");
    px(c, 6 - leg, 9, 3, 2, "#2f3650");
    px(c, 8 + leg, 3, 1, 2, "#111");
    px(c, 8 - leg, 9, 1, 2, "#111");
    if (!caught) {
      px(c, 1, 4, 4, 6, BAG_D);
      px(c, 2, 3, 3, 8, BAG);
      px(c, 2, 5, 1, 1, "#ffe2a6");
      px(c, 3, 6, 1, 2, "#5a3f1f");
    }
    px(c, 5, 4, 5, 6, STRIPE_A);
    for (let i = 0; i < 5; i += 2) px(c, 5 + i, 4, 1, 6, STRIPE_B);
    if (caught) {
      px(c, 7, 0, 2, 4, STRIPE_A);
      px(c, 7, 10, 2, 4, STRIPE_A);
      px(c, 7, 0, 2, 1, SKIN);
      px(c, 7, 13, 2, 1, SKIN);
    } else {
      px(c, 6 + arm, 2, 3, 2, STRIPE_A);
      px(c, 6 - arm, 10, 3, 2, STRIPE_A);
      px(c, 9 + arm, 2, 1, 2, SKIN);
      px(c, 9 - arm, 10, 1, 2, SKIN);
    }
    px(c, 8, 5, 4, 4, HAT);
    px(c, 9, 4, 2, 6, HAT);
    px(c, 12, 6, 1, 2, SKIN);
    px(c, 11, 5, 1, 4, "#3a3b46");
    px(c, 9, 5, 1, 1, "#4a4c58");
  }
  function drawParked(c, color) {
    const d = shade(color, -0.3);
    for (const [x, y] of [[3, 0], [14, 0], [3, 10], [14, 10]]) px(c, x, y, 3, 1, "#0d0f14");
    px(c, 0, 1, 20, 9, d);
    px(c, 1, 1, 18, 9, color);
    px(c, 12, 2, 2, 7, "#4d6f88");
    px(c, 4, 2, 2, 7, "#4d6f88");
    px(c, 6, 2, 6, 7, shade(color, 0.15));
    px(c, 16, 2, 2, 1, shade(color, 0.4));
  }
  function drawTree(c, light, dark) {
    const r = 7;
    for (let y = -r; y <= r; y++) {
      const half = Math.round(Math.sqrt(r * r - y * y));
      px(c, 8 - half, 8 + y, half * 2, 1, y > 2 ? dark : light);
    }
    px(c, 4, 4, 3, 2, shade(light, 0.2));
    px(c, 9, 6, 2, 2, shade(light, 0.25));
    px(c, 6, 10, 3, 1, shade(dark, -0.15));
    px(c, 11, 9, 2, 2, shade(dark, -0.1));
  }
  function shade(hex, amt) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
  }
  var police = null;
  var thief = null;
  var thiefCaught = null;
  var parked = /* @__PURE__ */ new Map();
  var trees = /* @__PURE__ */ new Map();
  function make(w, h, draw) {
    const [cv, c] = canvas(w, h);
    draw(c);
    return { img: cv, cx: w / 2, cy: h / 2 };
  }
  function policeSprite(flash) {
    if (!police) police = [0, 1, -1].map((f) => make(24, 14, (c) => drawPolice(c, f)));
    return police[flash === 0 ? 0 : flash === 1 ? 1 : 2];
  }
  function thiefSprite(frame, caught = false) {
    if (caught) return thiefCaught || (thiefCaught = make(14, 14, (c) => drawThief(c, 0, true)));
    if (!thief) thief = [0, 1, 2, 3].map((f) => make(14, 14, (c) => drawThief(c, f, false)));
    return thief[frame & 3];
  }
  function parkedSprite(color) {
    let s = parked.get(color);
    if (!s) parked.set(color, s = make(20, 11, (c) => drawParked(c, color)));
    return s;
  }
  function treeSprite(light, dark) {
    const key = light + dark;
    let s = trees.get(key);
    if (!s) trees.set(key, s = make(16, 16, (c) => drawTree(c, light, dark)));
    return s;
  }
  function blit(c, s, x, y, angle) {
    c.save();
    c.translate(Math.round(x), Math.round(y));
    const a = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    if (a) c.rotate(a);
    c.drawImage(s.img, -Math.round(s.cx), -Math.round(s.cy));
    c.restore();
  }
  function shadow(c, x, y, rx, ry) {
    c.fillStyle = "rgba(10,12,25,.28)";
    c.beginPath();
    c.ellipse(Math.round(x) + 1, Math.round(y) + 2, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  // src/chase/city.ts
  function timeOfDay(d = /* @__PURE__ */ new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 17) return "day";
    if (h >= 17 && h < 19.5 || h >= 5.5 && h < 7) return "dusk";
    return "night";
  }
  var PAL = {
    day: {
      grass: "#7fb663",
      grassD: "#6aa152",
      road: "#555b66",
      roadD: "#4b505a",
      walk: "#d7cfc0",
      walkD: "#c3b9a8",
      curb: "#a39887",
      lane: "#f0d77a",
      zebra: "#eeeae0",
      roofs: ["#c97b5d", "#d9b27a", "#7fa79c", "#a7a9c2", "#c6b29d", "#9b7f6a", "#e0a17a", "#8c9aa8"],
      tree: ["#5ea24b", "#3f7f3a"],
      water: "#5b9fd0"
    },
    dusk: {
      grass: "#6d9555",
      grassD: "#5c8247",
      road: "#4a4b57",
      roadD: "#40414c",
      walk: "#c4b3a3",
      walkD: "#ae9f8f",
      curb: "#8c7f73",
      lane: "#e8c67a",
      zebra: "#e6ddd0",
      roofs: ["#b06a56", "#c49a72", "#6f8f8a", "#9493b0", "#b39c8b", "#8a6d60", "#c98b6c", "#7f8798"],
      tree: ["#4f8445", "#386536"],
      water: "#5a7fb3"
    },
    night: {
      grass: "#3f5a45",
      grassD: "#354e3c",
      road: "#30323c",
      roadD: "#2a2c35",
      walk: "#6e6c78",
      walkD: "#615f6b",
      curb: "#55535e",
      lane: "#b9a165",
      zebra: "#9f9da8",
      roofs: ["#5b4652", "#5e5866", "#3f565a", "#4d4d68", "#5a5058", "#4a4048", "#665058", "#45505e"],
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
  var ROAD = 30;
  var BLOCK = 92;
  var PITCH = ROAD + BLOCK;
  var WALK = 5;
  var City = class {
    /** want：路线大概要多长（画布像素） */
    constructor(seed, want, tod) {
      /** 路线上的点（已经把拐角磨圆） */
      this.path = [];
      /** 每个点到起点的距离 */
      this.cum = [];
      /** 路口的路灯 */
      this.lights = [];
      this.tod = tod;
      this.rand = rng(seed);
      const R = this.rand;
      this.ny = 5;
      const nodes = [[0, 2]];
      const seen = /* @__PURE__ */ new Set(["0,2"]);
      let len = 0;
      let last = "r";
      while (len < want) {
        const [i, j] = nodes[nodes.length - 1];
        const opts = [];
        opts.push(["r", i + 1, j], ["r", i + 1, j]);
        if (last === "r") opts.push(["r", i + 1, j]);
        if (j > 0 && !seen.has(i + "," + (j - 1))) opts.push(["u", i, j - 1], ["u", i, j - 1]);
        if (j < this.ny - 1 && !seen.has(i + "," + (j + 1))) opts.push(["d", i, j + 1], ["d", i, j + 1]);
        const [d, ni, nj] = opts[Math.floor(R() * opts.length)];
        if ((d === "u" || d === "d") && (last === "u" || last === "d") && R() < 0.6) continue;
        nodes.push([ni, nj]);
        seen.add(ni + "," + nj);
        last = d;
        len += PITCH;
      }
      this.nx = nodes[nodes.length - 1][0] + 2;
      this.width = this.nx * PITCH + ROAD;
      this.height = this.ny * PITCH - BLOCK + ROAD + 2 * PITCH;
      const oy = PITCH;
      const center = (i, j) => ({ x: i * PITCH + ROAD / 2, y: oy + j * PITCH + ROAD / 2 });
      const pts = nodes.map(([i, j]) => center(i, j));
      pts.unshift({ x: pts[0].x - 40, y: pts[0].y });
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      const dir = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
      const end = { x: b.x + dir.x * 46, y: b.y + dir.y * 46 };
      pts.push(end);
      this.path = roundCorners(pts, 12);
      let s = 0;
      this.cum.push(0);
      for (let k = 1; k < this.path.length; k++) {
        s += Math.hypot(this.path[k].x - this.path[k - 1].x, this.path[k].y - this.path[k - 1].y);
        this.cum.push(s);
      }
      this.length = s;
      const hw = 64;
      const hh = 52;
      this.hideout = {
        x: dir.x > 0 ? end.x + 4 : dir.x < 0 ? end.x - 4 - hw : end.x - hw / 2,
        y: dir.y > 0 ? end.y + 4 : dir.y < 0 ? end.y - 4 - hh : end.y - hh / 2,
        w: hw,
        h: hh,
        doorX: end.x,
        doorY: end.y,
        dir
      };
      this.map = this.render(oy);
    }
    /** 路线上距离起点 s 的那一点，和那里的方向（弧度） */
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
      const x = p[lo].x + (p[hi].x - p[lo].x) * t;
      const y = p[lo].y + (p[hi].y - p[lo].y) * t;
      return { x, y, angle: Math.atan2(p[hi].y - p[lo].y, p[hi].x - p[lo].x) };
    }
    // ---------------- 画地图 ----------------
    render(oy) {
      const cv = document.createElement("canvas");
      cv.width = this.width;
      cv.height = this.height;
      const c = cv.getContext("2d");
      c.imageSmoothingEnabled = false;
      const P = PAL[this.tod];
      const R = this.rand;
      px(c, 0, 0, this.width, this.height, P.grass);
      for (let k = 0; k < this.width * this.height / 90; k++) px(c, Math.floor(R() * this.width), Math.floor(R() * this.height), 2, 1, P.grassD);
      const rows = this.ny + 2;
      const xs = [];
      const ys = [];
      for (let i = 0; i <= this.nx; i++) xs.push(i * PITCH);
      for (let j = -1; j < rows; j++) ys.push(oy + j * PITCH);
      for (let i = 0; i < this.nx; i++) {
        for (const y02 of ys) {
          const bx2 = i * PITCH + ROAD;
          const by2 = y02 + ROAD;
          if (by2 > this.height || by2 + BLOCK < 0) continue;
          this.block(c, bx2, by2, P);
        }
      }
      for (const y02 of ys) this.roadH(c, 0, this.width, y02, P);
      for (const x02 of xs) this.roadV(c, x02, 0, this.height, P);
      for (const x02 of xs) for (const y02 of ys) this.crossing(c, x02, y02, P);
      const h = this.hideout;
      const bi = Math.floor((h.doorX + h.dir.x * 20) / PITCH);
      const bj = Math.floor((h.doorY + h.dir.y * 20 - oy) / PITCH);
      px(c, bi * PITCH + ROAD, oy + bj * PITCH + ROAD, BLOCK, BLOCK, P.grassD);
      const from = this.path[this.path.length - 1];
      const d = h.dir;
      const bx = from.x - d.x * 46;
      const by = from.y - d.y * 46;
      const x0 = Math.min(bx, from.x) - (d.x ? 0 : 8);
      const y0 = Math.min(by, from.y) - (d.y ? 0 : 8);
      px(c, Math.round(x0), Math.round(y0), d.x ? 46 : 16, d.y ? 46 : 16, P.road);
      this.hideoutRoof(c);
      return cv;
    }
    roadH(c, x0, x1, y, P) {
      px(c, x0, y, x1 - x0, ROAD, P.road);
      px(c, x0, y, x1 - x0, WALK, P.walk);
      px(c, x0, y + ROAD - WALK, x1 - x0, WALK, P.walk);
      px(c, x0, y + WALK, x1 - x0, 1, P.curb);
      px(c, x0, y + ROAD - WALK - 1, x1 - x0, 1, P.curb);
      for (let x = x0; x < x1; x += 6) {
        px(c, x, y, 1, WALK, P.walkD);
        px(c, x, y + ROAD - WALK, 1, WALK, P.walkD);
      }
      for (let x = x0 + 4; x < x1; x += 14) px(c, x, y + ROAD / 2, 7, 1, P.lane);
      for (let x = x0; x < x1; x += 3) if (this.rand() < 0.25) px(c, x, y + WALK + 2 + Math.floor(this.rand() * (ROAD - 2 * WALK - 4)), 1, 1, P.roadD);
      for (let x = x0 + 30; x < x1 - 30; x += 40 + Math.floor(this.rand() * 60)) {
        if (this.rand() < 0.45) {
          const s = parkedSprite(CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)]);
          const top = this.rand() < 0.5;
          c.drawImage(s.img, x, top ? y + WALK + 1 : y + ROAD - WALK - 12);
        }
      }
    }
    roadV(c, x, y0, y1, P) {
      px(c, x, y0, ROAD, y1 - y0, P.road);
      px(c, x, y0, WALK, y1 - y0, P.walk);
      px(c, x + ROAD - WALK, y0, WALK, y1 - y0, P.walk);
      px(c, x + WALK, y0, 1, y1 - y0, P.curb);
      px(c, x + ROAD - WALK - 1, y0, 1, y1 - y0, P.curb);
      for (let y = y0; y < y1; y += 6) {
        px(c, x, y, WALK, 1, P.walkD);
        px(c, x + ROAD - WALK, y, WALK, 1, P.walkD);
      }
      for (let y = y0 + 4; y < y1; y += 14) px(c, x + ROAD / 2, y, 1, 7, P.lane);
      for (let y = y0; y < y1; y += 3) if (this.rand() < 0.25) px(c, x + WALK + 2 + Math.floor(this.rand() * (ROAD - 2 * WALK - 4)), y, 1, 1, P.roadD);
    }
    /** 路口：清掉中线，四边画斑马线，角上一盏路灯 */
    crossing(c, x, y, P) {
      px(c, x + WALK, y + WALK, ROAD - 2 * WALK, ROAD - 2 * WALK, P.road);
      for (let k = 0; k < ROAD - 2 * WALK; k += 3) {
        px(c, x + WALK + k, y - 6, 2, 5, P.zebra);
        px(c, x + WALK + k, y + ROAD + 1, 2, 5, P.zebra);
        px(c, x - 6, y + WALK + k, 5, 2, P.zebra);
        px(c, x + ROAD + 1, y + WALK + k, 5, 2, P.zebra);
      }
      px(c, x + 1, y + 1, 3, 3, "#3b3f4c");
      px(c, x + 2, y + 2, 1, 1, "#ffe7a6");
      this.lights.push({ x: x + 2, y: y + 2 });
    }
    /** 一块地：几栋楼、公园或者停车场 */
    block(c, x, y, P) {
      const R = this.rand;
      const kind = R();
      if (kind < 0.17) return this.park(c, x, y, P);
      if (kind < 0.25) return this.parking(c, x, y, P);
      const lots = [];
      const split = R();
      if (split < 0.25) lots.push([x + 4, y + 4, BLOCK - 8, BLOCK - 8]);
      else if (split < 0.6) {
        const m = Math.floor(BLOCK * (0.35 + R() * 0.3));
        lots.push([x + 4, y + 4, m - 6, BLOCK - 8], [x + m + 2, y + 4, BLOCK - m - 6, BLOCK - 8]);
      } else {
        const m = Math.floor(BLOCK / 2);
        lots.push([x + 4, y + 4, m - 6, m - 6], [x + m + 2, y + 4, m - 6, m - 6], [x + 4, y + m + 2, m - 6, m - 6], [x + m + 2, y + m + 2, m - 6, m - 6]);
      }
      px(c, x, y, BLOCK, BLOCK, shade(P.grass, -0.05));
      for (const [lx, ly, lw, lh] of lots) this.building(c, lx, ly, lw, lh, P);
      const t = treeSprite(P.tree[0], P.tree[1]);
      for (let k = 0; k < 3; k++) if (R() < 0.5) c.drawImage(t.img, x + Math.floor(R() * (BLOCK - 16)), y + (R() < 0.5 ? -4 : BLOCK - 12));
    }
    building(c, x, y, w, h, P) {
      const R = this.rand;
      const roof = P.roofs[Math.floor(R() * P.roofs.length)];
      c.fillStyle = "rgba(15,15,30,.28)";
      c.fillRect(x + 4, y + 4, w, h);
      px(c, x, y, w, h, shade(roof, -0.35));
      px(c, x + 1, y + 1, w - 2, h - 2, roof);
      px(c, x + 1, y + 1, w - 2, 1, shade(roof, 0.25));
      px(c, x + 1, y + h - 2, w - 2, 1, shade(roof, -0.2));
      const n = 2 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        const ax = x + 4 + Math.floor(R() * Math.max(1, w - 14));
        const ay = y + 4 + Math.floor(R() * Math.max(1, h - 14));
        const t = R();
        if (t < 0.35) {
          px(c, ax, ay, 7, 5, "#9aa0aa");
          px(c, ax, ay + 4, 7, 1, "#6c717b");
          px(c, ax + 2, ay + 1, 3, 3, "#5d626c");
        } else if (t < 0.55) {
          px(c, ax + 1, ay, 6, 8, "#7a6252");
          px(c, ax, ay + 1, 8, 6, "#7a6252");
          px(c, ax + 2, ay + 2, 4, 4, "#94796a");
        } else if (t < 0.8) {
          const lit = this.tod !== "day" && R() < 0.6;
          px(c, ax, ay, 9, 6, "#3d4a5a");
          px(c, ax + 1, ay + 1, 7, 4, lit ? "#ffd780" : "#6f8fa8");
          px(c, ax + 4, ay + 1, 1, 4, "#3d4a5a");
        } else {
          px(c, ax, ay, 3, 3, "#4b4f58");
        }
      }
    }
    park(c, x, y, P) {
      const R = this.rand;
      px(c, x, y, BLOCK, BLOCK, shade(P.grass, 0.06));
      const pathC = shade(P.walk, -0.05);
      px(c, x + BLOCK / 2 - 3, y, 6, BLOCK, pathC);
      px(c, x, y + BLOCK / 2 - 3, BLOCK, 6, pathC);
      if (R() < 0.6) {
        const cx = x + BLOCK / 2;
        const cy = y + BLOCK / 2;
        c.fillStyle = shade(P.walk, -0.2);
        c.beginPath();
        c.arc(cx, cy, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = P.water;
        c.beginPath();
        c.arc(cx, cy, 10, 0, Math.PI * 2);
        c.fill();
        px(c, cx - 4, cy - 4, 3, 1, "#ffffff");
      }
      const t = treeSprite(P.tree[0], P.tree[1]);
      for (let k = 0; k < 9; k++) {
        const tx = x + 2 + Math.floor(R() * (BLOCK - 18));
        const ty = y + 2 + Math.floor(R() * (BLOCK - 18));
        if (Math.abs(tx + 8 - (x + BLOCK / 2)) < 18 && Math.abs(ty + 8 - (y + BLOCK / 2)) < 18) continue;
        c.drawImage(t.img, tx, ty);
      }
      px(c, x + BLOCK / 2 + 6, y + 10, 10, 3, "#8a5a3a");
      px(c, x + 10, y + BLOCK / 2 + 6, 3, 10, "#8a5a3a");
    }
    parking(c, x, y, P) {
      const R = this.rand;
      px(c, x + 2, y + 2, BLOCK - 4, BLOCK - 4, P.road);
      for (let k = 0; k < BLOCK - 10; k += 14) {
        px(c, x + 6 + k, y + 6, 1, 22, P.zebra);
        px(c, x + 6 + k, y + BLOCK - 28, 1, 22, P.zebra);
      }
      for (let k = 0; k + 14 < BLOCK - 10; k += 14) {
        if (R() < 0.6) {
          const s = parkedSprite(CAR_COLORS[Math.floor(R() * CAR_COLORS.length)]);
          c.save();
          c.translate(x + 7 + k + 6, y + 6 + 11);
          c.rotate(Math.PI / 2);
          c.drawImage(s.img, -10, -6);
          c.restore();
        }
        if (R() < 0.6) {
          const s = parkedSprite(CAR_COLORS[Math.floor(R() * CAR_COLORS.length)]);
          c.save();
          c.translate(x + 7 + k + 6, y + BLOCK - 28 + 11);
          c.rotate(-Math.PI / 2);
          c.drawImage(s.img, -10, -6);
          c.restore();
        }
      }
    }
    hideoutRoof(c) {
      const h = this.hideout;
      c.fillStyle = "rgba(15,15,30,.3)";
      c.fillRect(h.x + 4, h.y + 4, h.w, h.h);
      px(c, h.x, h.y, h.w, h.h, "#2d2833");
      px(c, h.x + 1, h.y + 1, h.w - 2, h.h - 2, "#4a4152");
      for (let k = 3; k < h.w - 2; k += 4) px(c, h.x + k, h.y + 2, 1, h.h - 4, "#3c3444");
      const d = h.dir;
      const len = 26;
      for (let k = 0; k < len; k += 4) {
        const col = k / 4 % 2 ? "#1c1a20" : "#e8b931";
        if (d.x) px(c, d.x > 0 ? h.x : h.x + h.w - 3, h.doorY - len / 2 + k, 3, 4, col);
        else px(c, h.doorX - len / 2 + k, d.y > 0 ? h.y : h.y + h.h - 3, 4, 3, col);
      }
      const sx = h.x + h.w / 2 - 5;
      const sy = h.y + h.h / 2 - 7;
      px(c, sx, sy, 11, 14, "#e8b931");
      px(c, sx + 3, sy + 2, 5, 2, "#1c1a20");
      px(c, sx + 6, sy + 4, 2, 2, "#1c1a20");
      px(c, sx + 4, sy + 6, 3, 2, "#1c1a20");
      px(c, sx + 4, sy + 10, 3, 2, "#1c1a20");
    }
  };
  var CAR_COLORS = ["#c94a3f", "#3f6fc9", "#e6c34a", "#6d8b5a", "#e8e4dc", "#3a3d47", "#8a5ab0", "#e08a3c"];
  function roundCorners(pts, r) {
    const out = [pts[0]];
    for (let k = 1; k < pts.length - 1; k++) {
      const a = pts[k - 1];
      const b = pts[k];
      const n = pts[k + 1];
      const d1 = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
      const d2 = { x: Math.sign(n.x - b.x), y: Math.sign(n.y - b.y) };
      if (d1.x === d2.x && d1.y === d2.y) {
        out.push(b);
        continue;
      }
      const p1 = { x: b.x - d1.x * r, y: b.y - d1.y * r };
      const p2 = { x: b.x + d2.x * r, y: b.y + d2.y * r };
      out.push(p1);
      for (let t = 1; t < 6; t++) {
        const u = t / 6;
        out.push({ x: (1 - u) * (1 - u) * p1.x + 2 * (1 - u) * u * b.x + u * u * p2.x, y: (1 - u) * (1 - u) * p1.y + 2 * (1 - u) * u * b.y + u * u * p2.y });
      }
      out.push(p2);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // src/chase/scene.ts
  var START = 34;
  var THIEF_AHEAD = 18;
  var DOOR_BEFORE = 6;
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
      // 画面上的警车位置（平滑跟随）
      this.last = 0;
      this.skids = [];
      this.sparks = [];
      this.boostUntil = 0;
      this.light = null;
      this.get = get;
      this.city = city;
    }
    /** 换一局：新地图 */
    reset(city) {
      this.city = city;
      this.policeS = START;
      this.skids = [];
      this.sparks = [];
      this.boostUntil = 0;
      this.snapCamera();
    }
    attach(canvas2, wrap) {
      this.detach();
      this.canvas = canvas2;
      this.wrap = wrap;
      this.ctx = canvas2.getContext("2d");
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
      this.skids.push({ x: p.x, y: p.y, a: p.angle, t: 0 });
      if (this.skids.length > 60) this.skids.shift();
    }
    /** 连击加速：车尾冒火 */
    boost(now) {
      this.boostUntil = now + 900;
    }
    /** 画布按整数倍放大（像素清楚），宽度跟着页面，高度占窗口的一半左右 */
    fit() {
      if (!this.canvas || !this.wrap) return;
      const r = this.wrap.getBoundingClientRect();
      const border = this.wrap.offsetWidth - this.wrap.clientWidth;
      const cssW = Math.max(300, r.width - border);
      const top = r.top + window.scrollY;
      const cssH = Math.round(Math.max(240, Math.min(480, window.innerHeight - top - 345)));
      this.scale = cssW >= 700 && cssH >= 300 ? 3 : 2;
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
      const a = this.city.at(this.policeS);
      const b = this.city.at(this.thiefS(s.thief));
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const mx = this.w / 2 - 34;
      const my = this.h / 2 - 26;
      dx = Math.max(-mx, Math.min(mx, dx / 2));
      dy = Math.max(-my, Math.min(my, dy / 2));
      const yAt = s.phase === "won" || s.phase === "lost" ? 0.74 : 0.5;
      let cx = a.x + dx - this.w / 2;
      let cy = a.y + dy - this.h * yAt;
      cx = Math.max(0, Math.min(this.city.width - this.w, cx));
      cy = Math.max(0, Math.min(this.city.height - this.h, cy));
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
      if (Math.abs(target - this.policeS) < 0.05) this.policeS = target;
      const [tx, ty] = this.camTarget(s);
      this.camX += (tx - this.camX) * Math.min(1, dt * 3.5);
      this.camY += (ty - this.camY) * Math.min(1, dt * 3.5);
      const cx = Math.round(this.camX);
      const cy = Math.round(this.camY);
      const w = this.w;
      const h = this.h;
      px(c, 0, 0, w, h, "#2b2e38");
      c.drawImage(city.map, cx, cy, Math.min(w, city.width - cx), Math.min(h, city.height - cy), 0, 0, Math.min(w, city.width - cx), Math.min(h, city.height - cy));
      for (const k of this.skids) {
        k.t += dt;
        const al = Math.max(0, 0.45 - k.t / 14);
        if (al <= 0) continue;
        c.save();
        c.translate(Math.round(k.x - cx), Math.round(k.y - cy));
        c.rotate(Math.round(k.a / (Math.PI / 2)) * (Math.PI / 2));
        c.fillStyle = `rgba(20,20,26,${al.toFixed(2)})`;
        c.fillRect(-14, -5, 9, 1);
        c.fillRect(-14, 4, 9, 1);
        c.restore();
      }
      this.skids = this.skids.filter((k) => k.t < 7);
      const hd = city.hideout;
      let door = 1;
      if (s.phase === "lost") door = Math.max(0, 1 - (t - s.endAt - 350) / 500);
      this.drawDoor(c, hd, door, cx, cy);
      const thiefPos = city.at(this.thiefS(s.thief));
      const gone = s.phase === "lost" && t - s.endAt > 350;
      if (!gone) {
        const running = s.phase === "run";
        shadow(c, thiefPos.x - cx, thiefPos.y - cy, 5, 3);
        const spr = s.phase === "won" ? thiefSprite(0, true) : thiefSprite(running ? Math.floor(t / 85) : 0);
        blit(c, spr, thiefPos.x - cx, thiefPos.y - cy, thiefPos.angle);
        if (running && Math.random() < dt * 9) this.sparks.push({ x: thiefPos.x - Math.cos(thiefPos.angle) * 5, y: thiefPos.y - Math.sin(thiefPos.angle) * 5, vx: 0, vy: 0, t: 0, kind: "dust" });
        if (s.phase === "won") this.stars(c, thiefPos.x - cx, thiefPos.y - cy - 9, t);
      }
      const pol = city.at(this.policeS);
      const moving = Math.abs(target - this.policeS) > 0.3 && s.phase === "run";
      const flash = s.phase === "ready" ? -1 : Math.floor(t / 130) % 2;
      shadow(c, pol.x - cx, pol.y - cy, 11, 5);
      blit(c, policeSprite(flash), pol.x - cx, pol.y - cy, pol.angle);
      if (t < this.boostUntil && s.phase === "run") {
        for (let k = 0; k < 2; k++)
          this.sparks.push({
            x: pol.x - Math.cos(pol.angle) * 12,
            y: pol.y - Math.sin(pol.angle) * 12 + (Math.random() - 0.5) * 6,
            vx: -Math.cos(pol.angle) * 30,
            vy: -Math.sin(pol.angle) * 30,
            t: 0,
            kind: "flame"
          });
      } else if (moving && Math.random() < dt * 12) {
        this.sparks.push({ x: pol.x - Math.cos(pol.angle) * 12, y: pol.y - Math.sin(pol.angle) * 12, vx: 0, vy: 0, t: 0, kind: "dust" });
      }
      for (const p of this.sparks) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "flame") {
          const col = p.t < 0.12 ? "#fff3b0" : p.t < 0.25 ? "#ffb347" : "#e8553d";
          if (p.t < 0.4) px(c, Math.round(p.x - cx), Math.round(p.y - cy), 2, 2, col);
        } else {
          const a = Math.max(0, 0.4 - p.t * 0.5);
          c.fillStyle = `rgba(225,215,195,${a.toFixed(2)})`;
          const r = 1 + Math.round(p.t * 3);
          c.fillRect(Math.round(p.x - cx - r), Math.round(p.y - cy - r), r * 2, r * 2);
        }
      }
      this.sparks = this.sparks.filter((p) => p.t < (p.kind === "flame" ? 0.4 : 0.9));
      this.lighting(c, city.tod, pol, flash, cx, cy);
      this.minimap(c, s, pol, thiefPos);
      if (!gone) this.arrow(c, thiefPos.x - cx, thiefPos.y - cy);
    }
    drawDoor(c, hd, open, cx, cy) {
      const d = hd.dir;
      const len = 18;
      const thick = 3;
      const dx = d.x ? d.x > 0 ? hd.x : hd.x + hd.w - thick : hd.doorX - len / 2;
      const dy = d.y ? d.y > 0 ? hd.y : hd.y + hd.h - thick : hd.doorY - len / 2;
      const w = d.x ? thick : len;
      const hh = d.x ? len : thick;
      px(c, Math.round(dx - cx), Math.round(dy - cy), w, hh, "#101015");
      if (open < 1) {
        const k = 1 - open;
        if (d.x) px(c, Math.round(dx - cx), Math.round(dy - cy), w, Math.round(hh * k), "#9aa0aa");
        else px(c, Math.round(dx - cx), Math.round(dy - cy), Math.round(w * k), hh, "#9aa0aa");
      }
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
    lighting(c, tod, pol, flash, cx, cy) {
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
      l.fillStyle = tod === "night" ? "rgba(6,10,32,.58)" : "rgba(60,30,60,.22)";
      l.fillRect(0, 0, w, h);
      l.globalCompositeOperation = "destination-out";
      const hole = (x, y, r, a) => {
        const g = l.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        l.fillStyle = g;
        l.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const p of this.city.lights) {
        const x = p.x - cx;
        const y = p.y - cy;
        if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
        hole(x, y, 30, 0.85);
      }
      const fx = pol.x - cx + Math.cos(pol.angle) * 26;
      const fy = pol.y - cy + Math.sin(pol.angle) * 26;
      hole(fx, fy, 24, 0.9);
      hole(pol.x - cx, pol.y - cy, 16, 0.8);
      l.globalCompositeOperation = "source-over";
      c.drawImage(this.light, 0, 0);
      c.save();
      c.globalCompositeOperation = "lighter";
      if (flash >= 0) {
        const g = c.createRadialGradient(pol.x - cx, pol.y - cy, 0, pol.x - cx, pol.y - cy, 26);
        g.addColorStop(0, flash ? "rgba(60,120,255,.35)" : "rgba(255,60,50,.35)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(pol.x - cx - 26, pol.y - cy - 26, 52, 52);
      }
      for (const p of this.city.lights) {
        const x = p.x - cx;
        const y = p.y - cy;
        if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
        const g = c.createRadialGradient(x, y, 0, x, y, 18);
        g.addColorStop(0, `rgba(255,200,120,${tod === "night" ? 0.22 : 0.12})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(x - 18, y - 18, 36, 36);
      }
      c.restore();
    }
    /** 右上角的小地图：整条路线、警车、小偷、仓库 */
    minimap(c, s, pol, th) {
      const city = this.city;
      const mw = Math.min(84, Math.round(this.w * 0.2));
      const k = mw / city.width;
      const mh = Math.max(16, Math.round(city.height * k));
      const ox = this.w - mw - 6;
      const oy = 6;
      c.fillStyle = "rgba(16,18,28,.55)";
      c.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);
      c.strokeStyle = "rgba(255,255,255,.18)";
      c.lineWidth = 1;
      c.strokeRect(ox - 1.5, oy - 1.5, mw + 3, mh + 3);
      c.strokeStyle = "rgba(255,255,255,.55)";
      c.beginPath();
      city.path.forEach((p, i) => i ? c.lineTo(ox + p.x * k, oy + p.y * k) : c.moveTo(ox + p.x * k, oy + p.y * k));
      c.stroke();
      const hd = city.hideout;
      px(c, Math.round(ox + (hd.x + hd.w / 2) * k) - 2, Math.round(oy + (hd.y + hd.h / 2) * k) - 2, 4, 4, "#e8b931");
      if (!(s.phase === "lost")) px(c, Math.round(ox + th.x * k) - 1, Math.round(oy + th.y * k) - 1, 3, 3, "#ff5a4e");
      px(c, Math.round(ox + pol.x * k) - 2, Math.round(oy + pol.y * k) - 2, 4, 4, "#ffffff");
      px(c, Math.round(ox + pol.x * k) - 1, Math.round(oy + pol.y * k) - 1, 2, 2, "#3f7cff");
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
    /** 当前是白天、傍晚还是夜里（开新地图时用） */
    static tod() {
      return timeOfDay();
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
  var PX_PER_CHAR = 7;
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
      this.scene = new ChaseScene(() => this.sceneState(), new City(1, 600, timeOfDay()));
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
        const canvas2 = document.getElementById("chase-canvas");
        const wrap = document.getElementById("chase-wrap");
        if (canvas2 && wrap) this.scene.attach(canvas2, wrap);
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
      this.scene.reset(new City(seed, Math.max(900, ps.text.length * PX_PER_CHAR), timeOfDay()));
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
    const city = new City(7, 700, "dusk");
    const W = 140;
    const H = 63;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const c = cv.getContext("2d");
    if (!c) return "";
    c.imageSmoothingEnabled = false;
    const a = city.at(120);
    const b = city.at(165);
    const ox = Math.round(Math.max(0, Math.min(city.width - W, (a.x + b.x) / 2 - W / 2)));
    const oy = Math.round(Math.max(0, Math.min(city.height - H, (a.y + b.y) / 2 - H / 2)));
    c.drawImage(city.map, ox, oy, W, H, 0, 0, W, H);
    shadow(c, b.x - ox, b.y - oy, 5, 3);
    blit(c, thiefSprite(1), b.x - ox, b.y - oy, b.angle);
    shadow(c, a.x - ox, a.y - oy, 11, 5);
    blit(c, policeSprite(0), a.x - ox, a.y - oy, a.angle);
    const g = c.createRadialGradient(a.x - ox, a.y - oy, 0, a.x - ox, a.y - oy, 24);
    g.addColorStop(0, "rgba(255,70,60,.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(a.x - ox - 24, a.y - oy - 24, 48, 48);
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
