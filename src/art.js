// Marginal Vocabulary 的像素画：宠物、人物、花园、房子、物品
// 全部用代码画在小画布上（每个像素一格），再按整数倍放大显示，Retina 屏上也清楚。
// 着色方式：每种颜色自动生成「高光 / 本色 / 暗部 / 深暗 / 描边」五档，暗部往冷色偏、高光往暖色偏；
// 轮廓用相邻颜色的深色描边，而不是一律黑线。
window.MARGIN_ART = (function () {
  'use strict';

  // ================= 颜色 =================

  function hex2rgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
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
    h = ((h % 360) + 360) % 360;
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
  // 色相往 target 转 deg 度（走近的那一边）
  function toward(h, target, deg) {
    let d = ((target - h + 540) % 360) - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), deg);
  }

  const rampCache = new Map();
  // 一种颜色的五档：hi 高光、base 本色、mid 暗部、lo 深暗、line 描边
  function ramp(hex) {
    if (rampCache.has(hex)) return rampCache.get(hex);
    const [h, s, l] = hsl(hex);
    const r = {
      hi: hsl2hex(toward(h, 55, 10), s + 0.04, l + 0.11),
      base: hex,
      mid: hsl2hex(toward(h, 255, 8), s + 0.02, l - 0.09),
      lo: hsl2hex(toward(h, 255, 16), s + 0.04, l - 0.19),
      line: hsl2hex(toward(h, 275, 16), Math.min(0.6, s * 0.6 + 0.08), Math.max(0.09, l * 0.3)),
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

  // ================= 画布 =================

  const LX = -0.55;
  const LY = -0.83; // 光从左上来

  function Pix(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill(null);
  }
  Pix.prototype.set = function (x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  };
  Pix.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.d[y * this.w + x];
  };
  Pix.prototype.clear = function (x, y) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = null;
  };
  Pix.prototype.rect = function (x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  };
  Pix.prototype.inEll = function (x, y, cx, cy, rx, ry) {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  Pix.prototype.ell = function (cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (this.inEll(x, y, cx, cy, rx, ry)) this.set(x, y, c);
  };
  // 有明暗的椭圆：按法线和光的方向选色阶
  Pix.prototype.sEll = function (cx, cy, rx, ry, hex, o) {
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
  };
  // 有明暗的方块：上沿亮、下沿和右沿暗
  Pix.prototype.sRect = function (x, y, w, h, hex, o) {
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
  };
  Pix.prototype.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
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
  };
  // 实心多边形（扫描线）
  Pix.prototype.poly = function (pts, c) {
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
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
    }
  };
  // 外轮廓：透明像素挨着有色像素，就涂成那个颜色的描边色
  // 迎光的一边（左上）描边浅一点，背光的一边（右下）深一点，轮廓不那么死板
  Pix.prototype.outline = function (only) {
    const add = [];
    const hexAt = (x, y) => {
      const c = this.get(x, y);
      return c && c[0] === '#' ? c : null;
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const below = hexAt(x, y + 1);
        const right = hexAt(x + 1, y);
        const above = hexAt(x, y - 1);
        const left = hexAt(x - 1, y);
        const n = above || left || right || below;
        if (!n || (only && !only(n))) continue;
        const lit = (below || right) && !above && !left;
        const R = ramp(lit ? below || right : n);
        add.push([x, y, lit ? mix(R.line, R.lo, 0.45) : R.line]);
      }
    for (const [x, y, c] of add) this.set(x, y, c);
  };
  // 把 src 叠到自己上面（偏移 ox, oy；mirror 左右翻转）
  Pix.prototype.blit = function (src, ox, oy, mirror) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + x];
        if (c) this.set(ox + (mirror ? src.w - 1 - x : x), oy + y, c);
      }
  };
  Pix.prototype.recolor = function (fn) {
    for (let i = 0; i < this.d.length; i++) if (this.d[i] && this.d[i][0] === '#') this.d[i] = fn(this.d[i]);
  };
  // 颜色字符串 → [r, g, b, a]（缓存起来；整张图一次写进 ImageData，比一个个 fillRect 快得多）
  const rgbaCache = new Map();
  let probe = null;
  function rgbaOf(v) {
    let q = rgbaCache.get(v);
    if (q) return q;
    if (v[0] === '#' && v.length === 7) {
      const [r, g, b] = hex2rgb(v);
      q = [r, g, b, 255];
    } else {
      const m = /^rgba?\(([^)]+)\)$/.exec(v);
      if (m) {
        const a = m[1].split(',').map((x) => parseFloat(x));
        q = [a[0], a[1], a[2], Math.round((a.length > 3 ? a[3] : 1) * 255)];
      } else {
        if (!probe) {
          probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
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
  Pix.prototype.toCanvas = function () {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d');
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
  };

  // ================= 小部件 =================

  const INK = '#2a1d1a';
  const WHITE = '#fffaf2';

  // 大眼睛：黑眼珠带两个高光（kind: open / closed / happy / sick）
  function eye(p, x, y, kind, h) {
    h = h || 3;
    if (kind === 'closed') {
      p.rect(x - 1, y + h - 2, 3, 1, INK);
      return;
    }
    if (kind === 'happy') {
      p.set(x - 1, y + 1, INK);
      p.set(x, y, INK);
      p.set(x + 1, y + 1, INK);
      return;
    }
    if (kind === 'sick') {
      p.rect(x - 1, y + 1, 3, 1, INK);
      p.rect(x, y + 2, 1, 1, INK);
      return;
    }
    p.rect(x, y, 2, h, INK);
    p.set(x, y, WHITE);
    // 眼睛下面一点反光，看起来水汪汪的
    if (h >= 3) p.set(x + 1, y + h - 1, '#5d5470');
  }
  function blush(p, x, y, c) {
    p.rect(x, y, 2, 1, c || '#f2a0a0');
  }

  // ================= 宠物（32×32，正面） =================
  // f：idle / blink / walk1 / walk2 / happy / sleep / sick

  function eyeKind(f) {
    return f === 'blink' || f === 'sleep' ? 'closed' : f === 'happy' ? 'happy' : f === 'sick' ? 'sick' : 'open';
  }
  function bob(f) {
    return f === 'walk1' ? -1 : f === 'happy' ? -2 : 0;
  }

  // 走路时两只脚交替抬起
  function feet(f) {
    return f === 'walk1' ? [1, 0] : f === 'walk2' ? [0, 1] : [0, 0];
  }

  // 猫狗狐兔仓鼠共用的身体：大头、小身子、两只脚
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
    if (f === 'happy' || f === 'sick') p.rect(15, 18 + y0, 2, 1, f === 'sick' ? INK : '#c0505a');
    blush(p, 7, 16 + y0);
    blush(p, 23, 16 + y0);
  }

  // 鱼：圆圆的身子、大眼睛、会摆的尾巴
  function cuteFish(p, f, body, fin, o) {
    o = o || {};
    const y0 = (f === 'walk1' ? -1 : f === 'happy' ? -2 : 0) + 2;
    const sw = f === 'walk1' ? -2 : f === 'walk2' ? 2 : f === 'happy' ? -3 : 0;
    // 尾巴
    p.poly([[22, 16 + y0], [30, 8 + y0 + sw], [31, 16 + y0], [30, 24 + y0 - sw]], fin);
    if (o.fancy) {
      p.poly([[23, 16 + y0], [31, 5 + y0 + sw], [29, 14 + y0]], o.fin2 || ramp(fin).mid);
      p.poly([[23, 16 + y0], [31, 27 + y0 - sw], [29, 18 + y0]], o.fin3 || ramp(fin).mid);
    }
    // 背鳍和腹鳍
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
    if (o.shine) for (const [x, y] of [[12, 12], [17, 14], [15, 19]]) p.set(x, y + y0, '#fff1b8');
    // 胸鳍
    p.sEll(15, 19 + y0, 2.2, 1.4, ramp(fin).mid);
    const k = eyeKind(f);
    eye(p, 8, 13 + y0, k, 3);
    if (f === 'happy' || f === 'sick') p.rect(5, 18 + y0, 2, 1, f === 'sick' ? INK : '#c0505a');
    else p.set(5, 18 + y0, ramp(body).lo);
    blush(p, 9, 18 + y0);
  }

  const PETS = {
    crab(p, f) {
      const B = '#d97757';
      const R = ramp(B);
      const y0 = 12 + bob(f);
      const [a, b] = feet(f);
      // 腿：每边三条，斜着向外
      for (const [i, x] of [[0, 8], [1, 11], [2, 14]]) {
        const lift = i % 2 ? a : b;
        p.line(x, y0 + 12, x - 2, y0 + 15 - lift, R.lo);
        p.line(31 - x, y0 + 12, 33 - x, y0 + 15 - (i % 2 ? b : a), R.lo);
      }
      // 胳膊和钳子
      const up = f === 'happy' ? 3 : f === 'walk1' ? 1 : 0;
      for (const side of [0, 1]) {
        const sx = (x) => (side ? 31 - x : x);
        p.line(sx(6), y0 + 6, sx(3), y0 + 3 - up, R.mid);
        p.line(sx(6), y0 + 7, sx(3), y0 + 4 - up, R.mid);
        p.sEll(side ? 28.5 : 3.5, y0 - 1 - up, 3.6, 3.4, B);
        // 钳口：上面切一个缺口
        p.clear(sx(3), y0 - 4 - up);
        p.clear(sx(4), y0 - 4 - up);
        p.clear(sx(3), y0 - 3 - up);
        p.clear(sx(4), y0 - 3 - up);
        p.set(sx(3), y0 - 2 - up, R.lo);
      }
      // 身体：圆角方块
      p.sRect(6, y0, 20, 12, B, { bottom: 2 });
      for (const [x, y] of [[6, y0], [25, y0], [6, y0 + 11], [25, y0 + 11]]) p.clear(x, y);
      p.rect(7, y0 + 1, 6, 1, R.hi);
      // 眼睛、嘴、腮红
      const k = eyeKind(f);
      eye(p, 11, y0 + 3, k, 4);
      eye(p, 19, y0 + 3, k, 4);
      if (f === 'happy') p.rect(15, y0 + 7, 2, 1, INK);
      if (f === 'sick') p.rect(14, y0 + 8, 4, 1, INK);
      blush(p, 8, y0 + 7);
      blush(p, 22, y0 + 7);
    },

    cat(p, f) {
      const B = '#f0a75a';
      chibi(p, f, {
        body: B,
        belly: '#fff1dc',
        tail(p, y0) {
          p.line(23, 25 + y0, 27, 21 + y0, ramp(B).base);
          p.line(24, 25 + y0, 28, 21 + y0, ramp(B).mid);
          p.line(27, 21 + y0, 27, 16 + y0, ramp(B).base);
          p.line(28, 21 + y0, 28, 16 + y0, ramp(B).mid);
          p.set(27, 15 + y0, ramp(B).lo);
        },
        ears(p, y0) {
          p.poly([[6, 10 + y0], [8, 1 + y0], [14, 6 + y0]], ramp(B).base);
          p.poly([[26, 10 + y0], [24, 1 + y0], [18, 6 + y0]], ramp(B).mid);
          p.poly([[8, 7 + y0], [9, 3.5 + y0], [11.5, 6 + y0]], '#f4a6a0');
          p.poly([[24, 7 + y0], [23, 3.5 + y0], [20.5, 6 + y0]], '#f4a6a0');
        },
        face(p, y0) {
          for (const x of [13, 16, 19]) p.rect(x, 5 + y0, 1, 3, ramp(B).lo);
          p.ell(16, 17 + y0, 4.5, 3, '#fff1dc');
          p.rect(15, 15 + y0, 2, 1, '#e98080');
          for (const [x, y] of [[14, 17], [15, 18], [16, 17], [17, 18], [18, 17]]) p.set(x, y + y0, INK);
        },
      });
    },

    shiba(p, f) {
      const B = '#e39a4f';
      const C = '#fff3e0';
      chibi(p, f, {
        body: B,
        belly: C,
        paw: C,
        tail(p, y0) {
          p.sEll(25, 20 + y0, 3.5, 3.5, B);
          p.ell(25, 20 + y0, 1.5, 1.5, C);
        },
        ears(p, y0) {
          p.poly([[6, 10 + y0], [8, 2 + y0], [14, 6 + y0]], ramp(B).base);
          p.poly([[26, 10 + y0], [24, 2 + y0], [18, 6 + y0]], ramp(B).mid);
          p.poly([[8.5, 7 + y0], [9.2, 4 + y0], [11.5, 6 + y0]], ramp(B).lo);
          p.poly([[23.5, 7 + y0], [22.8, 4 + y0], [20.5, 6 + y0]], ramp(B).lo);
        },
        face(p, y0) {
          p.ell(10.5, 17 + y0, 4.5, 3.4, C);
          p.ell(21.5, 17 + y0, 4.5, 3.4, C);
          p.ell(16, 18 + y0, 4, 2.6, C);
          p.rect(10, 9 + y0, 2, 1, C);
          p.rect(21, 9 + y0, 2, 1, C);
          p.rect(15, 15 + y0, 2, 2, INK);
          p.set(15, 15 + y0, '#6a5a5a');
        },
      });
    },

    fox(p, f) {
      const B = '#e8793a';
      const C = '#fff4e8';
      const D = '#3a2a26';
      chibi(p, f, {
        body: B,
        belly: C,
        paw: D,
        hw: 12,
        tail(p, y0) {
          p.sEll(25.5, 19 + y0, 4.5, 6, B);
          p.ell(26.5, 14.5 + y0, 2.6, 2.4, C);
        },
        ears(p, y0) {
          p.poly([[5, 11 + y0], [6, 0 + y0], [14, 6 + y0]], ramp(B).base);
          p.poly([[27, 11 + y0], [26, 0 + y0], [18, 6 + y0]], ramp(B).mid);
          p.poly([[6, 3 + y0], [6, 0 + y0], [8.5, 1.8 + y0]], D);
          p.poly([[26, 3 + y0], [26, 0 + y0], [23.5, 1.8 + y0]], D);
          p.poly([[7.5, 8 + y0], [8, 4 + y0], [11, 6.5 + y0]], '#f2b8a0');
          p.poly([[24.5, 8 + y0], [24, 4 + y0], [21, 6.5 + y0]], '#f2b8a0');
        },
        face(p, y0) {
          p.poly([[4, 13 + y0], [16, 15 + y0], [16, 21 + y0], [10, 21 + y0]], C);
          p.poly([[28, 13 + y0], [16, 15 + y0], [16, 21 + y0], [22, 21 + y0]], C);
          p.rect(15, 16 + y0, 2, 2, INK);
        },
      });
    },

    rabbit(p, f) {
      const B = '#f1e8dc';
      const P = '#f2a3a0';
      chibi(p, f, {
        body: B,
        belly: '#fffaf2',
        ears(p, y0) {
          const wig = f === 'happy' ? -1 : 0;
          p.sEll(10.5, 4 + y0 + wig, 2.8, 6.5, B);
          p.sEll(21.5, 4 + y0 + wig, 2.8, 6.5, B);
          p.ell(10.5, 4.5 + y0 + wig, 1.2, 4.5, P);
          p.ell(21.5, 4.5 + y0 + wig, 1.2, 4.5, P);
        },
        face(p, y0) {
          p.rect(15, 15 + y0, 2, 1, P);
          p.set(15, 16 + y0, INK);
          p.set(16, 16 + y0, INK);
          p.set(14, 17 + y0, INK);
          p.set(17, 17 + y0, INK);
        },
      });
    },

    hamster(p, f) {
      const B = '#e8b07a';
      const C = '#fff3e0';
      const y0 = bob(f);
      const [a, b] = feet(f);
      p.sEll(9, 6 + y0, 3, 3, B);
      p.sEll(23, 6 + y0, 3, 3, B);
      p.ell(9, 6 + y0, 1.4, 1.4, '#f2a3a0');
      p.ell(23, 6 + y0, 1.4, 1.4, '#f2a3a0');
      p.sEll(16, 18 + y0, 12.5, 11, B);
      p.ell(16, 22 + y0, 9.5, 7.5, C);
      p.sEll(11, 29.5 + y0 - a, 2.4, 1.6, '#f2a3a0');
      p.sEll(21, 29.5 + y0 - b, 2.4, 1.6, '#f2a3a0');
      p.sEll(13, 23 + y0, 1.8, 1.5, '#f2a3a0');
      p.sEll(19, 23 + y0, 1.8, 1.5, '#f2a3a0');
      const k = eyeKind(f);
      eye(p, 10, 14 + y0, k, 3);
      eye(p, 21, 14 + y0, k, 3);
      p.rect(15, 18 + y0, 2, 1, '#e98080');
      blush(p, 6, 19 + y0);
      blush(p, 24, 19 + y0);
    },

    penguin(p, f) {
      const B = '#3e4a63';
      const W = '#fbf7ef';
      const O = '#f0a23a';
      const y0 = bob(f);
      const [a, b] = feet(f);
      const flap = f === 'happy' ? -3 : f === 'walk1' ? -1 : 0;
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
      const B = '#f6d35b';
      const O = '#f08a3a';
      const y0 = bob(f);
      const [a, b] = feet(f);
      p.rect(10, 29 + y0 - a, 5, 2, O);
      p.rect(17, 29 + y0 - b, 5, 2, O);
      p.sEll(16, 22 + y0, 11, 7.5, B);
      p.sEll(24, 21 + y0 + (f === 'happy' ? -2 : 0), 4, 3, ramp(B).mid);
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
      const B = '#7cb46b';
      const L = '#d9eab0';
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
      if (k === 'open') {
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
      const B = '#f4b0aa';
      const D = '#e08a86';
      chibi(p, f, {
        body: B,
        belly: '#fbd3cf',
        paw: D,
        tail(p, y0) {
          p.line(23, 24 + y0, 25, 22 + y0, D);
          p.line(25, 22 + y0, 26, 24 + y0, D);
          p.set(27, 23 + y0, D);
        },
        ears(p, y0) {
          p.poly([[6, 9 + y0], [7, 2 + y0], [13, 6 + y0]], ramp(B).base);
          p.poly([[26, 9 + y0], [25, 2 + y0], [19, 6 + y0]], ramp(B).mid);
          p.poly([[8, 7 + y0], [8.5, 4 + y0], [11, 6 + y0]], D);
          p.poly([[24, 7 + y0], [23.5, 4 + y0], [21, 6 + y0]], D);
        },
        face(p, y0) {
          p.sEll(16, 17 + y0, 3.8, 2.6, '#f29a94');
          p.rect(14, 17 + y0, 1, 1, '#a8524e');
          p.rect(17, 17 + y0, 1, 1, '#a8524e');
        },
      });
    },

    lamb(p, f) {
      const W = '#f6f0e4';
      const F = '#f3d8bc';
      chibi(p, f, {
        body: W,
        belly: '#fffaf2',
        paw: '#8a7a6a',
        ears(p, y0) {
          p.sEll(5, 12 + y0, 3.6, 2, '#e8cfb2');
          p.sEll(27, 12 + y0, 3.6, 2, '#e8cfb2');
        },
        face(p, y0) {
          // 一圈卷卷的羊毛，中间是脸
          for (const [x, y] of [[8, 6], [12, 4], [16, 3.5], [20, 4], [24, 6], [6, 10], [26, 10]]) p.sEll(x, y + y0, 3, 2.8, W);
          p.sEll(16, 14 + y0, 7.5, 6, F);
          p.rect(15, 17 + y0, 2, 1, '#c8806a');
          p.set(15, 18 + y0, '#a86a5a');
          p.set(16, 18 + y0, '#a86a5a');
        },
      });
    },

    corgi(p, f) {
      const B = '#e9974e';
      const C = '#fff4e6';
      chibi(p, f, {
        body: B,
        belly: C,
        paw: C,
        tail(p, y0) {
          p.sEll(25, 23 + y0, 2.6, 2.2, B);
        },
        ears(p, y0) {
          p.poly([[5, 9 + y0], [6, -1 + y0], [13, 5 + y0]], ramp(B).base);
          p.poly([[27, 9 + y0], [26, -1 + y0], [19, 5 + y0]], ramp(B).mid);
          p.poly([[7, 7 + y0], [7.5, 2 + y0], [11, 5.5 + y0]], '#f4b0a0');
          p.poly([[25, 7 + y0], [24.5, 2 + y0], [21, 5.5 + y0]], '#f4b0a0');
        },
        face(p, y0) {
          p.rect(15, 5 + y0, 2, 7, C);
          p.ell(16, 17 + y0, 6, 3.6, C);
          p.ell(16, 12 + y0, 2.5, 2, C);
          p.rect(15, 15 + y0, 2, 2, INK);
          p.set(15, 15 + y0, '#6a5a5a');
        },
      });
    },

    hedgehog(p, f) {
      const S = '#7a5a3e';
      const T = '#c4a07a';
      const F = '#f2dcc0';
      const y0 = bob(f);
      const [a, b] = feet(f);
      // 背上的刺：一个圆顶，边上一圈短短的尖，尖上发白
      p.sEll(16, 17 + y0, 13, 12, S);
      for (let k = 0; k <= 16; k++) {
        const t = Math.PI * (1 + k / 16);
        const x = 16 + Math.cos(t) * 12.5;
        const y = 17 + y0 + Math.sin(t) * 11.5;
        const x2 = 16 + Math.cos(t) * 15;
        const y2 = 17 + y0 + Math.sin(t) * 14;
        p.poly([[x - 1.5, y + 0.5], [x + 1.5, y + 0.5], [x2, y2]], k % 2 ? S : ramp(S).mid);
        p.set(Math.round(x2), Math.round(y2), T);
      }
      // 刺上的纹理：一排排浅色的小短线
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 9; k++) {
          const x = 6 + k * 2.5 + (row % 2) * 1.2;
          const y = 8 + row * 3 + y0 + Math.abs(k - 4) * 0.6;
          p.set(Math.round(x), Math.round(y), T);
          p.set(Math.round(x), Math.round(y) + 1, ramp(S).lo);
        }
      // 脸和肚子
      p.sEll(16, 22 + y0, 9.5, 8, F);
      p.sEll(11.5, 29.5 + y0 - a, 2.4, 1.6, '#c8a07a');
      p.sEll(20.5, 29.5 + y0 - b, 2.4, 1.6, '#c8a07a');
      p.sEll(8, 13 + y0, 2.2, 2, '#e8c8a8');
      p.sEll(24, 13 + y0, 2.2, 2, '#e8c8a8');
      const k = eyeKind(f);
      eye(p, 11, 18 + y0, k, 3);
      eye(p, 20, 18 + y0, k, 3);
      p.sEll(16, 23 + y0, 1.8, 1.3, INK);
      if (f === 'happy') p.rect(15, 26 + y0, 2, 1, '#c0505a');
      blush(p, 8, 23 + y0);
      blush(p, 22, 23 + y0);
    },

    squirrel(p, f) {
      const B = '#c97a3e';
      const C = '#f6e3c8';
      chibi(p, f, {
        body: B,
        belly: C,
        tail(p, y0) {
          const up = f === 'happy' ? -2 : 0;
          p.sEll(26, 15 + y0 + up, 5.5, 9, B);
          p.sEll(27, 10 + y0 + up, 3.5, 4.5, ramp(B).hi);
          p.ell(29, 16 + y0 + up, 1.5, 6, ramp(B).mid);
        },
        ears(p, y0) {
          p.poly([[7, 9 + y0], [8, 1 + y0], [13, 6 + y0]], ramp(B).base);
          p.poly([[25, 9 + y0], [24, 1 + y0], [19, 6 + y0]], ramp(B).mid);
          p.set(8, 0 + y0, ramp(B).lo);
          p.set(24, 0 + y0, ramp(B).lo);
        },
        face(p, y0) {
          p.ell(10.5, 17 + y0, 3.8, 3, C);
          p.ell(21.5, 17 + y0, 3.8, 3, C);
          p.rect(15, 16 + y0, 2, 1, '#6a3a2a');
          p.set(15, 18 + y0, '#fbf7ef');
          p.set(16, 18 + y0, '#fbf7ef');
        },
      });
    },

    owl(p, f) {
      const B = '#9a7556';
      const L = '#e8d4b4';
      const y0 = bob(f);
      const [a, b] = feet(f);
      const flap = f === 'happy' ? -3 : 0;
      p.sEll(5, 20 + y0 + flap, 3, 7, ramp(B).mid);
      p.sEll(27, 20 + y0 + flap, 3, 7, ramp(B).mid);
      p.sEll(16, 18 + y0, 11.5, 12.5, B);
      // 耳羽
      p.poly([[6, 9 + y0], [7, 2 + y0], [11, 7 + y0]], B);
      p.poly([[26, 9 + y0], [25, 2 + y0], [21, 7 + y0]], B);
      p.ell(16, 24 + y0, 7, 6, L);
      for (const [x, y] of [[13, 21], [17, 21], [15, 24], [19, 24], [12, 25], [16, 27]]) {
        p.set(x, y + y0, ramp(L).lo);
        p.set(x + 1, y + 1 + y0, ramp(L).lo);
        p.set(x - 1, y + 1 + y0, ramp(L).lo);
      }
      // 大眼圈
      p.sEll(10.5, 12.5 + y0, 5, 4.8, '#f6ecd8');
      p.sEll(21.5, 12.5 + y0, 5, 4.8, '#f6ecd8');
      const k = eyeKind(f);
      if (k === 'open') {
        p.ell(10.5, 12.5 + y0, 2.4, 2.4, '#f2a23a');
        p.ell(21.5, 12.5 + y0, 2.4, 2.4, '#f2a23a');
        p.rect(10, 12 + y0, 2, 2, INK);
        p.rect(21, 12 + y0, 2, 2, INK);
        p.set(10, 12 + y0, WHITE);
        p.set(21, 12 + y0, WHITE);
      } else {
        eye(p, 10, 11 + y0, k, 3);
        eye(p, 21, 11 + y0, k, 3);
      }
      p.poly([[14.5, 15 + y0], [17.5, 15 + y0], [16, 18.5 + y0]], '#f2a23a');
      p.rect(11, 30 + y0 - a, 4, 1, '#f2a23a');
      p.rect(17, 30 + y0 - b, 4, 1, '#f2a23a');
    },

    otter(p, f) {
      const B = '#8a6248';
      const C = '#ecd6ba';
      chibi(p, f, {
        body: B,
        belly: C,
        paw: ramp(B).lo,
        tail(p, y0) {
          p.sEll(26, 25 + y0, 4.5, 2.2, ramp(B).mid);
        },
        ears(p, y0) {
          p.sEll(6.5, 8 + y0, 2.4, 2.2, B);
          p.sEll(25.5, 8 + y0, 2.4, 2.2, B);
        },
        face(p, y0) {
          p.ell(16, 17 + y0, 6.5, 4, C);
          p.ell(16, 15.5 + y0, 2.2, 1.4, '#4a2e22');
          for (const [x, y] of [[11, 17], [11, 19], [21, 17], [21, 19]]) p.set(x, y + y0, ramp(C).lo);
          p.set(16, 17 + y0, '#4a2e22');
        },
      });
    },

    raccoon(p, f) {
      const B = '#9a9aa2';
      const W = '#f0eee8';
      const M = '#3e3e46';
      chibi(p, f, {
        body: B,
        belly: '#dcdad4',
        paw: M,
        tail(p, y0) {
          p.sEll(25.5, 19 + y0, 3.5, 7, B);
          for (const y of [14, 18, 22]) p.rect(23, y + y0, 6, 2, M);
        },
        ears(p, y0) {
          p.poly([[6, 9 + y0], [7, 2 + y0], [13, 6 + y0]], ramp(B).base);
          p.poly([[26, 9 + y0], [25, 2 + y0], [19, 6 + y0]], ramp(B).mid);
          p.poly([[8, 7 + y0], [8.5, 4 + y0], [11, 6 + y0]], W);
          p.poly([[24, 7 + y0], [23.5, 4 + y0], [21, 6 + y0]], W);
        },
        face(p, y0) {
          p.ell(16, 17 + y0, 6, 3.6, W);
          p.rect(8, 9 + y0, 5, 1, W);
          p.rect(19, 9 + y0, 5, 1, W);
          // 眼罩
          p.ell(10.5, 13.5 + y0, 4, 2.6, M);
          p.ell(21.5, 13.5 + y0, 4, 2.6, M);
          p.ell(11, 13.5 + y0, 2, 2, '#62626c');
          p.ell(22, 13.5 + y0, 2, 2, '#62626c');
          p.rect(15, 15 + y0, 2, 2, INK);
        },
      });
    },

    koala(p, f) {
      const B = '#a8acb6';
      const W = '#eceef2';
      chibi(p, f, {
        body: B,
        belly: W,
        paw: ramp(B).mid,
        ears(p, y0) {
          p.sEll(5.5, 8 + y0, 5, 5, B);
          p.sEll(26.5, 8 + y0, 5, 5, B);
          p.ell(5.5, 8.5 + y0, 2.8, 2.8, W);
          p.ell(26.5, 8.5 + y0, 2.8, 2.8, W);
        },
        face(p, y0) {
          p.sEll(16, 16.5 + y0, 2.8, 3.4, '#3a3a44');
          p.set(15, 15 + y0, '#6a6a76');
        },
      });
    },

    redpanda(p, f) {
      const B = '#d0663a';
      const D = '#4a2a22';
      const W = '#fbf2e6';
      chibi(p, f, {
        body: B,
        belly: D,
        paw: D,
        hw: 11.5,
        tail(p, y0) {
          p.sEll(26, 19 + y0, 4, 7.5, B);
          for (const y of [15, 19, 23]) p.rect(23, y + y0, 7, 2, ramp(B).lo);
        },
        ears(p, y0) {
          p.poly([[5, 10 + y0], [6, 2 + y0], [13, 6 + y0]], ramp(B).base);
          p.poly([[27, 10 + y0], [26, 2 + y0], [19, 6 + y0]], ramp(B).mid);
          p.poly([[7, 8 + y0], [7.5, 4 + y0], [11, 6.5 + y0]], W);
          p.poly([[25, 8 + y0], [24.5, 4 + y0], [21, 6.5 + y0]], W);
        },
        face(p, y0) {
          p.ell(9.5, 17 + y0, 4, 3.2, W);
          p.ell(22.5, 17 + y0, 4, 3.2, W);
          p.ell(16, 18 + y0, 3.6, 2.4, W);
          p.rect(9, 9 + y0, 3, 1, W);
          p.rect(20, 9 + y0, 3, 1, W);
          p.rect(15, 16 + y0, 2, 2, INK);
          p.rect(10, 14 + y0, 1, 3, ramp(B).lo);
          p.rect(21, 14 + y0, 1, 3, ramp(B).lo);
        },
      });
    },

    panda(p, f) {
      const W = '#f6f4ee';
      const K = '#2e2e36';
      chibi(p, f, {
        body: W,
        belly: '#fffdf8',
        paw: K,
        ears(p, y0) {
          p.sEll(6, 6 + y0, 3.6, 3.4, K);
          p.sEll(26, 6 + y0, 3.6, 3.4, K);
        },
        face(p, y0) {
          // 黑眼圈：斜一点的椭圆，里面浅一点好看清眼睛
          p.poly([[7, 14 + y0], [9, 10 + y0], [14, 11 + y0], [13, 16 + y0], [9, 17 + y0]], K);
          p.poly([[25, 14 + y0], [23, 10 + y0], [18, 11 + y0], [19, 16 + y0], [23, 17 + y0]], K);
          p.ell(11, 13.5 + y0, 1.8, 2.2, '#5c5c68');
          p.ell(22, 13.5 + y0, 1.8, 2.2, '#5c5c68');
          p.sEll(16, 17 + y0, 1.8, 1.2, K);
          p.rect(15, 19 + y0, 2, 1, '#8a8a92');
          // 肩膀上一圈黑
          p.ell(16, 22 + y0, 9, 2, K);
        },
      });
    },

    chick(p, f) {
      const Y = '#f8d54a';
      const O = '#f2902e';
      const y0 = bob(f);
      const [a, b] = feet(f);
      const flap = f === 'happy' ? -3 : f === 'walk1' ? -1 : 0;
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
      cuteFish(p, f, '#d8c68a', '#c8b070', { line: '#7aa0c0' });
    },
    goldfish(p, f) {
      cuteFish(p, f, '#f0742e', '#f6b07a', { fancy: true });
    },
    guppy(p, f) {
      cuteFish(p, f, '#a8bccf', '#e85d75', { fancy: true, fin2: '#9b7fd1', fin3: '#5ab0e0' });
    },
    koi(p, f) {
      cuteFish(p, f, '#f8f4ec', '#f2e6dc', { spots: '#d8452e' });
    },
    goldkoi(p, f) {
      cuteFish(p, f, '#f2c14e', '#f7dc85', { shine: true });
    },
  };

  // ================= 人物（16×32，正面） =================

  // look：skin 肤色、hair 发色、hairStyle（short / long / bun）、hat、top 上衣颜色、topStyle（tee / overalls / hoodie / stripe）、
  //       bottom 下装颜色、bottomStyle（pants / shorts / skirt）、shoes
  // dir：front / back / side（朝右；朝左时翻转）；f：idle / walk1 / walk2 / act
  const HATS = {
    straw(p, y, dir) {
      p.sEll(8, y + 4, 8, 2, '#e8c46a');
      p.sEll(8, y + 2, 4.5, 3, '#e8c46a');
      p.rect(4, y + 3, 8, 1, '#c8463a');
    },
    cap(p, y, dir) {
      p.sEll(8, y + 3, 6.5, 3.6, '#3b6ea8');
      if (dir !== 'back') p.rect(dir === 'side' ? 9 : 3, y + 5, dir === 'side' ? 7 : 10, 2, ramp('#3b6ea8').mid);
      p.set(8, y, ramp('#3b6ea8').hi);
    },
    beanie(p, y) {
      p.sEll(8, y + 3.5, 6.8, 4, '#c8463a');
      p.rect(2, y + 5, 12, 2, '#f4ece0');
      p.sEll(8, y - 0.5, 1.8, 1.6, '#f4ece0');
    },
    flower(p, y) {
      for (const [x, c] of [[3, '#ef7fa0'], [6, '#f6d35b'], [9, '#ffffff'], [12, '#9b7fd1']]) {
        p.ell(x + 0.5, y + 3.5, 1.6, 1.6, c);
        p.set(x, y + 3, '#f6d35b');
      }
      p.rect(2, y + 5, 12, 1, '#6aa35a');
    },
    bow(p, y) {
      p.poly([[8, y + 3], [3, y + 0], [3, y + 6]], '#ef7fa0');
      p.poly([[8, y + 3], [13, y + 0], [13, y + 6]], ramp('#ef7fa0').mid);
      p.rect(7, y + 2, 2, 2, ramp('#ef7fa0').lo);
    },
    crown(p, y) {
      p.poly([[3, y + 6], [3, y + 1], [5.5, y + 3.5], [8, y], [10.5, y + 3.5], [13, y + 1], [13, y + 6]], '#f2c14e');
      p.set(8, y + 3, '#e85d75');
    },
    party(p, y) {
      p.poly([[4, y + 6], [12, y + 6], [8, y - 3]], '#e85d75');
      p.line(6, y + 3, 9, y + 5, '#f6d35b');
      p.line(7, y, 10, y + 2, '#f6d35b');
      p.sEll(8, y - 3, 1.6, 1.6, '#f6d35b');
    },
    beret(p, y) {
      p.sEll(7, y + 3.5, 6.5, 3, '#4a5a8a');
      p.set(8, y, '#4a5a8a');
    },
    grad(p, y) {
      p.poly([[0, y + 2], [8, y - 1], [16, y + 2], [8, y + 5]], '#2b2a28');
      p.sRect(4, y + 3, 8, 3, '#2b2a28', { noHi: true });
      p.line(12, y + 2, 13, y + 7, '#f2c14e');
    },
  };
  // 宠物戴帽子的位置：帽子画在 16 宽的格子里，挪到宠物头顶
  const PET_HAT_AT = { crab: 4, cat: 0, shiba: 0, fox: -1, rabbit: 1, hamster: 4, penguin: 1, duck: -1, frog: 3, piglet: 1, lamb: 0, corgi: -1, hedgehog: 2, squirrel: 0, owl: 1, otter: 2, raccoon: 0, koala: 1, redpanda: 0, panda: 1, chick: 4, medaka: 4, goldfish: 4, guppy: 4, koi: 4, goldkoi: 4 };

  // 人物是一格一格手画的（16×32）：头、身子、腿分开画，走路时身子上下颠一下、两条腿交替抬起。
  // 字母代表颜色：h 头发、H 头发暗部、j 头发高光、s 皮肤、S 皮肤暗部、c 腮红、e 眼睛、w 眼睛高光、m 嘴、
  // t 上衣、T 上衣暗部、y 上衣高光、o 胳膊和身子之间的暗线、b 裤子、B 裤子暗部、f 鞋、F 鞋底
  const AV = {
    headFront: [
      '................',
      '.....hhhhhh.....',
      '...hhjjjjhhhh...',
      '..hhjjhhhhhhhH..',
      '.hhjhhhhhhhhhHh.',
      '.hhhhhhhhhhhhHh.',
      '.hhhhhhhhhhhhHh.',
      '.hhssshhsssshHh.',
      '.hhssssssssssHh.',
      '.hhswesssswesHh.',
      '.hhseesssseesHh.',
      '..hccssssssccH..',
      '...SsssmmsssS...',
      '....SSssssSS....',
    ],
    headSide: [
      '................',
      '......hhhhh.....',
      '....hhjjjhhhh...',
      '...hhjjhhhhhhh..',
      '..hhjhhhhhhhhhh.',
      '..hhhhhhhhhhhhh.',
      '..hhhhhhhhhhhhh.',
      '..hhhhhhhhhssss.',
      '..hHhhhhsssssss.',
      '..hHhhhSssswess.',
      '..hHhhsSssseess.',
      '...Hhhssssscsss.',
      '....HSsssssssmS.',
      '.....SSsssssSS..',
    ],
    headBack: [
      '................',
      '.....hhhhhh.....',
      '...hhjjjjhhhh...',
      '..hhjjhhhhhhhH..',
      '.hhjhhhhhhhhhHh.',
      '.hhhhhhhhhhhhHh.',
      '.hhhhhhhhhhhhHh.',
      '.hhhhhhhhhhhhHh.',
      '.hhhhhhhhhhhhHh.',
      '.hHhhhhhhhhhhHh.',
      '.hHhhhhhhhhhHHh.',
      '..hHhhhhhhhhHH..',
      '...SHHhhhhHHS...',
      '....SSssssSS....',
    ],
    bodyFront: [
      '.....tSSSSt.....',
      '...ttytTTttTT...',
      '..ttoytttttoTT..',
      '..tToytttttoTT..',
      '..tTottttttoTT..',
      '..tTottttttoTT..',
      '..tToTTTTTToTT..',
      '..sSobbbbbboSS..',
      '....bbbbbbbB....',
      '....bbbbbbbB....',
    ],
    bodyFrontAct: [
      '.....tSSSSt.....',
      '...ttytTTttTT...',
      '..ttyttttttttT..',
      '..tTotttttttTT..',
      '..tToTTsSSTTTT..',
      '...TTosSSSoTT...',
      '....tTTTTTTT....',
      '....obbbbbbo....',
      '....bbbbbbbB....',
      '....bbbbbbbB....',
    ],
    bodyBack: [
      '.....tSSSSt.....',
      '...ttytttttTT...',
      '..ttoytttttoTT..',
      '..tToytttttoTT..',
      '..tTottttttoTT..',
      '..tTottttttoTT..',
      '..tToTTTTTToTT..',
      '..sSobbbbbboSS..',
      '....bbbbbbbB....',
      '....bbbbbbbB....',
    ],
    bodySide: [
      '......tSSt......',
      '.....yttttttT...',
      '.....ytottTtT...',
      '.....ytottTtT...',
      '.....ytottTtT...',
      '.....ttottTtT...',
      '.....TToTTTTT...',
      '.....bbosSbbB...',
      '.....bbbbbbbB...',
      '.....bbbbbbbB...',
    ],
    bodySideAct: [
      '......tSSt......',
      '.....yttttttT...',
      '.....ytotttTtT..',
      '.....yttooTTTTsS',
      '.....yttttTttTSS',
      '.....tttttTtT...',
      '.....TTTTTTTT...',
      '.....bbbbbbbB...',
      '.....bbbbbbbB...',
      '.....bbbbbbbB...',
    ],
    legsFront: ['....bbB..bbB....', '....bbB..bbB....', '....bbB..bbB....', '....bbB..bbB....', '...fffF..fffF...', '...FFFF..FFFF...', '................', '................'],
    legsFrontWalk: ['....bbB..bbB....', '....bbB..bbB....', '....bbB..bbB....', '...fffF..bbB....', '...FFFF..fffF...', '.........FFFF...', '................', '................'],
    legsSide: ['......bbBbbB....', '......bbBbbB....', '......bbBbbB....', '......bbBbbB....', '......fffffffF..', '......FFFFFFFF..', '................', '................'],
    legsSideWalk: ['......bBbbbB....', '.....bBB.bbbB...', '.....BB...bbB...', '....BB.....bbB..', '...FFF.....ffffF', '...........FFFFF', '................', '................'],
  };
  // 镜像一行（走路的另一只脚）
  const mirrorRow = (r) => r.split('').reverse().join('');

  // 坐着（正面）：大腿朝着我们看不见，只露出小腿和鞋
  const LEGS_SIT = ['................', '................', '................', '....bbB..bbB....', '...fffF..fffF...', '...FFFF..FFFF...', '................', '................'];
  // 侧面换另一条腿在前：远近两条腿的深浅对调
  const SWAP_LEG = { b: 'B', B: 'b', f: 'F', F: 'f' };

  function person(p, look, f, dir) {
    dir = dir || 'front';
    const skin = look.skin || '#f3c9a5';
    const hair = look.hair || '#6b4a35';
    const top = look.top || '#e8e2d4';
    const bottom = look.bottom || '#5b6b8a';
    const shoes = look.shoes || '#6a4a3a';
    const HR = ramp(hair);
    const SK = ramp(skin);
    const TP = ramp(top);
    const BT = ramp(bottom);
    const SH = ramp(shoes);
    const act = f === 'act';
    // 走路四步一轮：walk1 迈开一条腿、walkp 两腿并拢身子往上一点、walk2 迈开另一条腿、walkp
    const walk = f === 'walk1' || f === 'walk2';
    const y0 = f === 'walkp' ? -1 : f === 'sit' ? 3 : 0;
    const head = AV[dir === 'side' ? 'headSide' : dir === 'back' ? 'headBack' : 'headFront'];
    const body = AV[dir === 'side' ? (act ? 'bodySideAct' : 'bodySide') : dir === 'back' ? 'bodyBack' : act ? 'bodyFrontAct' : 'bodyFront'];
    let legs = AV[dir === 'side' ? (walk ? 'legsSideWalk' : 'legsSide') : walk ? 'legsFrontWalk' : 'legsFront'];
    if (f === 'walk2') legs = dir === 'side' ? legs.map((r) => r.replace(/[bBfF]/g, (c) => SWAP_LEG[c])) : legs.map(mirrorRow);
    if (f === 'sit') legs = LEGS_SIT;
    const pal = {
      h: hair, H: HR.mid, j: HR.hi,
      s: skin, S: SK.mid, c: '#f2a0a0', e: INK, w: WHITE, m: '#c0705f',
      t: top, T: TP.mid, y: TP.hi, o: TP.lo,
      b: bottom, B: BT.mid,
      f: shoes, F: SH.lo,
    };
    // 上衣样式、下装样式：按格子换颜色
    const ts = look.topStyle || 'tee';
    const bs = look.bottomStyle || 'pants';
    const colorAt = (ch, x, y) => {
      if ((ch === 't' || ch === 'y' || ch === 'T') && y >= 14 && y <= 20) {
        if (ts === 'stripe' && y >= 16 && y % 2 === 0) return ch === 'T' ? mix('#f4ece0', TP.mid, 0.35) : '#f4ece0';
        if (ts === 'overalls' && dir !== 'side') {
          // 胸前的背带裤：两条背带、两颗扣子、一块护胸
          if (y >= 17 && x >= 5 && x <= 10) return ch === 'T' ? BT.mid : bottom;
          if ((y === 15 || y === 16) && (x === 5 || x === 10)) return BT.mid;
        }
        if (ts === 'overalls' && dir === 'side' && y >= 17 && x >= 5 && x <= 12) return ch === 'T' ? BT.mid : bottom;
      }
      if (ts === 'overalls' && dir === 'front' && y === 17 && (x === 5 || x === 10)) return '#f2c14e';
      if (ts === 'hoodie' && dir === 'front') {
        if (y === 14 && (x === 5 || x === 10)) return TP.mid;
        if ((x === 6 || x === 9) && y >= 15 && y <= 17 && ch !== 'o') return TP.hi;
        if (y === 19 && x >= 6 && x <= 9) return TP.lo;
      }
      if (bs === 'shorts' && (ch === 'b' || ch === 'B') && y >= 25) return ch === 'B' ? SK.mid : skin;
      return pal[ch];
    };
    const put = (rows, oy, shift) => {
      rows.forEach((r, j) => {
        for (let x = 0; x < 16; x++) {
          const ch = r[x];
          if (ch === '.') continue;
          const y = oy + j;
          p.set(x, y + shift, colorAt(ch, x, y));
        }
      });
    };
    // 长发：披在肩上（前面、侧面）或者盖住后背
    const hs = look.hairStyle || 'short';
    if (hs === 'long') {
      if (dir === 'front') for (let y = 9; y <= 18; y++) for (const x of [1, 2, 13, 14]) p.set(x, y + y0, x === 2 || x === 13 ? HR.mid : hair);
      if (dir === 'side') for (let y = 9; y <= 18; y++) for (let x = 2; x <= 5; x++) p.set(x, y + y0, x === 5 ? HR.mid : hair);
    }
    put(head.concat(body), 0, y0);
    put(legs, 24, 0);
    if (bs === 'skirt') {
      // 裙子：从腰往下张开
      for (let y = 21; y <= 25; y++) {
        const w = 4 + (y - 21);
        for (let x = 8 - w; x < 8 + w; x++) if (x >= 1 && x <= 14) p.set(x, y + (y < 24 ? y0 : 0), x >= 8 + w - 2 ? BT.mid : y === 25 ? BT.hi : bottom);
      }
      for (let y = 26; y <= 27; y++) for (const x of dir === 'side' ? [7, 8, 9, 10] : [4, 5, 10, 11]) if (p.get(x, y)) p.set(x, y, skin);
    }
    if (hs === 'long' && dir === 'back') for (let y = 12; y <= 19; y++) for (let x = 3; x <= 12; x++) p.set(x, y + y0, x === 12 || y === 19 ? HR.mid : x === 5 && y < 16 ? HR.hi : hair);
    if (hs === 'bun') {
      const by = dir === 'side' ? 1 : 0;
      const bx = dir === 'side' ? 5 : 8;
      p.sEll(bx, 1.5 + by + y0, 2.6, 2, hair);
      p.set(bx - 1, 1 + by + y0, HR.hi);
    }
    // 走路时手臂和腿反着摆：正面、背面一只手往前（低一格）、一只手往后（高一格）；侧面手往前、往后挪两格
    if (walk) {
      const hy = 21 + y0;
      const fwd = f === 'walk1';
      if (dir === 'side') {
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

  // ================= 植物 =================

  // 树冠：先画暗的底层，再叠亮的团块，最后点几个高光，叶子看起来有层次
  function canopy(p, blobs, color, speck, dots) {
    const R = ramp(color);
    for (const [x, y, rx, ry] of blobs) p.ell(x + 1, y + 1.5, rx, ry, R.lo);
    for (const [x, y, rx, ry] of blobs) p.sEll(x, y, rx, ry, color);
    for (const [x, y, rx, ry] of blobs) p.ell(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.3, R.hi);
    const leaf = new Set([R.lo, R.mid, R.base, R.hi, color]);
    // 一簇簇叶子：树冠里散布小小的亮弧和暗点
    let k = 0;
    for (let y = 1; y < p.h - 1; y++)
      for (let x = 1; x < p.w - 1; x++) {
        const c = p.get(x, y);
        if (c !== R.base && c !== R.mid) continue;
        const hsh = ((x * 73856093) ^ (y * 19349663) ^ (k++ * 0)) >>> 0;
        if (hsh % 23 === 0 && leaf.has(p.get(x + 1, y)) && leaf.has(p.get(x - 1, y))) {
          p.set(x - 1, y, R.hi);
          p.set(x, y - 1, R.hi);
          p.set(x + 1, y, R.hi);
          p.set(x, y + 1, R.lo);
        }
      }
    // 叶子的边缘不规则：边上随机缺几个像素、长出几个小叶尖
    const cut = [];
    const add = [];
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const c = p.get(x, y);
        const hsh = ((x * 2654435761) ^ (y * 40503)) >>> 0;
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
  function shadow(p, cx, cy, rx) {
    p.ell(cx, cy, rx, 2.2, 'rgba(40,30,20,.22)');
  }
  function trunk(p, x, top, h, color) {
    const R = ramp(color || '#8a5a3b');
    shadow(p, 16, 45.5, 10);
    p.sRect(x, top, 5, h, color || '#8a5a3b', { bottom: 1 });
    p.rect(x - 2, top + h - 2, 2, 2, R.mid);
    p.rect(x + 5, top + h - 2, 2, 2, R.lo);
    p.set(x + 2, top + 4, R.lo);
    p.set(x + 1, top + 8, R.lo);
  }
  const ROUND = [[16, 23, 12, 8], [8, 17, 7, 7], [24, 17, 7, 7], [16, 11, 9, 8], [11, 9, 5, 4], [21, 9, 5, 4]];
  const SPECK = [[12, 14], [19, 12], [9, 21], [25, 22], [16, 26]];

  // 树：同一套画法按比例 S 画两种大小——S = 1 是小树（32×48），S = 1.5 是长大的树（48×72）。
  // 坐标都按 32×48 写，画的时候乘以 S；叶子的纹理按像素生成，放大以后细节更多，不会糊。
  const TREE_SPECS = {
    oak: { shape: 'round', leaf: '#5f9e4f' },
    apple: { shape: 'round', leaf: '#5c9a4a', dots: '#d64545' },
    orange: { shape: 'round', leaf: '#4f8f45', dots: '#f29a2e' },
    peach: { shape: 'round', leaf: '#68a552', dots: '#f6a07a', blossom: '#f7c1cf' },
    sakura: { shape: 'round', leaf: '#f2a6c0', trunk: '#7a4a3a', dots: '#fbd3e0', petals: '#f2a6c0' },
    jacaranda: { shape: 'round', leaf: '#9b8be0', trunk: '#6e5040', dots: '#c3b6f2', petals: '#a99ae6' },
    maple: { shape: 'maple', leaf: '#e0663a', trunk: '#7a4a3a', dots: '#f2a24a' },
    ginkgo: { shape: 'fan', leaf: '#f2c14e', dots: '#f7dc85' },
    birch: { shape: 'oval', leaf: '#8cc36a', trunk: '#efeae0', marks: '#3a3a3a' },
    willow: { shape: 'willow', leaf: '#8cbf5a', trunk: '#7a5a3a' },
    wisteria: { shape: 'wisteria', leaf: '#6aa35a', trunk: '#7a5a3a', hang: '#9b7fd1' },
    plum: { shape: 'blossom', trunk: '#4a3530', flower: '#e85d75', center: '#f6d35b' },
    magnolia: { shape: 'blossom', trunk: '#6a5040', flower: '#f8e8f0', center: '#e8a0c0' },
    pine: { shape: 'pine', leaf: '#3f7d4f' },
    cypress: { shape: 'column', leaf: '#3f6f4a' },
    palm: { shape: 'palm', leaf: '#5aa05a' },
    bamboo: { shape: 'bamboo', leaf: '#6aa35a' },
    cactus: { shape: 'cactus', leaf: '#5f9e4f' },
  };

  // 树冠：先按几个椭圆圈出形状，再在里面排一团团小叶簇；每团左上亮、右下暗，团和团之间露出深色的缝，
  // 上面的团整体亮一点、下面的暗一点；边上的叶簇稍微探出轮廓，边缘就是一团一团的
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
    // 底色：最深的一层，叶簇之间的缝隙
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) if (inMask(x, y)) p.set(x, y, R.lo);
    const seed = o.seed || 1;
    const hsh = (a, b) => {
      let h = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
      // 叶簇顶上的一两点亮光
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

  // 树干：往下稍微变粗，根部向两边张开；有竖着的树皮纹，顶上被树冠遮出一截阴影
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
        // 树皮纹
        if (!marks && (x * 7 + Math.floor(y / 3) * 3) % 9 === 0 && u > 0.2 && u < 0.85) c = R.mid;
        if (marks && (y * 5 + x * 3) % 11 === 0) c = marks;
        if (y - yTop < 2 * S) c = mix(c, R.lo, 0.55);
        p.set(x, y, c);
      }
    }
  }

  function drawTree(p, sp, S) {
    const t = typeof sp === 'string' ? TREE_SPECS[sp] || TREE_SPECS.oak : sp;
    const q = (v) => v * S;
    const B = (list) => list.map(([x, y, rx, ry]) => [q(x), q(y), q(rx), q(ry)]);
    const TR = t.trunk || '#8a5a3b';
    const shade = (rx) => p.ell(q(16), q(46) - 0.5, q(rx), 2.2 * S, 'rgba(40,30,20,.24)');
    const stem = (top, h, w) => trunkS(p, S, TR, top, w || 5, t.marks);
    const canopy = (blobs, color, speck, dts) => leafClumps(p, blobs, color, { r: 4.2 * S, dots: dts, seed: color.length + blobs.length });
    const speck = (list) => list.map(([x, y]) => [Math.round(q(x)), Math.round(q(y))]);
    const dots = (list, c) => (c ? list.map(([x, y]) => [Math.round(q(x)), Math.round(q(y)), c]) : null);
    const DOTS = [[9, 15], [21, 12], [16, 21], [24, 21], [12, 24], [17, 8], [7, 20], [26, 15]];
    switch (t.shape) {
      case 'round':
      case 'maple':
      case 'fan':
      case 'oval': {
        shade(t.shape === 'oval' ? 8 : 11);
        const top = t.shape === 'oval' ? 26 : 30;
        stem(top, 0, t.shape === 'oval' ? 4 : 5);
        const blobs =
          t.shape === 'maple' ? [[16, 22, 12, 8], [7, 16, 6, 6], [25, 16, 6, 6], [16, 10, 9, 8], [16, 4, 4, 3]]
          : t.shape === 'fan' ? [[16, 24, 12, 7], [16, 16, 10, 7], [16, 9, 7, 6], [16, 4, 4, 3]]
          : t.shape === 'oval' ? [[16, 22, 9, 7], [16, 14, 9, 8], [11, 18, 5, 5], [21, 18, 5, 5], [16, 7, 6, 5]]
          : ROUND;
        canopy(B(blobs), t.leaf, speck(SPECK), dots(DOTS.slice(0, S > 1 ? 8 : 6), t.dots));
        if (t.blossom) for (const [x, y] of [[11, 11], [20, 17], [14, 25], [23, 9]]) p.ell(q(x), q(y), 1.2 * S, 1.2 * S, t.blossom);
        if (t.petals) for (const [x, y] of [[5, 41], [26, 43], [9, 45], [22, 46], [29, 39]]) p.set(Math.round(q(x)), Math.round(q(y)), t.petals);
        break;
      }
      case 'willow': {
        shade(12);
        stem(26, 0, 5);
        canopy(B([[16, 16, 12, 8], [10, 12, 7, 6], [22, 12, 7, 6], [16, 8, 8, 6]]), t.leaf);
        const R = ramp(t.leaf);
        // 垂下来的柳条
        for (let x = Math.round(q(5)); x <= Math.round(q(27)); x += S > 1 ? 2 : 2) {
          const y0 = Math.round(q(18 + Math.abs(16 - x / S) * 0.25));
          const len = Math.round(q(14 + ((x * 7) % 9)));
          for (let y = y0; y < Math.min(y0 + len, q(44)); y++) p.set(x + (y % 7 === 0 ? 1 : 0), y, y > y0 + len - 3 ? R.hi : (x + y) % 3 ? R.base : R.mid);
        }
        break;
      }
      case 'wisteria': {
        shade(12);
        stem(28, 0, 5);
        canopy(B([[16, 18, 13, 8], [9, 13, 7, 6], [23, 13, 7, 6], [16, 9, 9, 6]]), t.leaf);
        const H = ramp(t.hang);
        for (const [x, y, n] of [[6, 20, 9], [10, 23, 11], [14, 24, 8], [18, 24, 12], [22, 23, 9], [26, 20, 10], [12, 15, 6], [21, 15, 6]]) {
          for (let k = 0; k < n * S; k++) {
            const w = Math.max(1, Math.round((1 - k / (n * S)) * 1.6 * S));
            p.rect(Math.round(q(x)) - Math.floor(w / 2), Math.round(q(y)) + k, w, 1, k % 3 === 0 ? H.hi : k % 3 === 1 ? t.hang : H.mid);
          }
        }
        break;
      }
      case 'blossom': {
        shade(10);
        stem(26, 0, 4);
        const R = ramp(t.trunk);
        // 枝条：从树干往上分叉
        for (const [x1, y1, x2, y2] of [[16, 28, 7, 12], [16, 27, 25, 10], [16, 26, 16, 4], [11, 19, 4, 14], [21, 18, 28, 16], [16, 15, 11, 6], [16, 14, 21, 5]]) {
          p.line(q(x1), q(y1), q(x2), q(y2), t.trunk);
          if (S > 1) p.line(q(x1) + 1, q(y1), q(x2) + 1, q(y2), R.mid);
        }
        const spots = [[7, 12], [4, 14], [25, 10], [28, 16], [16, 4], [11, 6], [21, 5], [9, 16], [22, 13], [13, 10], [19, 9], [14, 18], [18, 17], [6, 9], [26, 7], [16, 11]];
        // 一簇簇的花：用叶簇的画法画成小团，再点上花心
        leafClumps(p, spots.map(([x, y]) => [q(x), q(y), 2.3 * S, 2 * S]), t.flower, { r: 1.7 * S, seed: 7 });
        for (const [x, y] of spots) {
          p.set(Math.round(q(x)), Math.round(q(y)), t.center);
          if (S > 1) p.set(Math.round(q(x)) + 2, Math.round(q(y)) + 1, t.center);
        }
        for (const [x, y] of [[6, 42], [24, 44], [11, 45]]) p.set(Math.round(q(x)), Math.round(q(y)), t.flower);
        break;
      }
      case 'pine':
      case 'column': {
        shade(t.shape === 'column' ? 7 : 10);
        stem(36, 0, 4);
        const G = t.leaf;
        const R = ramp(G);
        if (t.shape === 'column') {
          canopy(B([[16, 31, 6.5, 8], [16, 22, 7, 9], [16, 13, 5.5, 8], [16, 5, 3.5, 4.5]]), G, speck([[14, 12], [15, 20], [14, 28]]));
          break;
        }
        // 松树：四层枝叶，下面的先画，上面的盖在上面；每层下沿一排锯齿，左边迎光、右边和下沿暗
        for (const [by, hw, h] of [[37, 14.5, 13], [29, 12, 12], [21, 9.5, 11], [13, 6.5, 11]]) {
          const yb = Math.round(q(by));
          const yt = Math.round(q(by - h));
          const cx = q(16);
          for (let y = yt; y <= yb; y++) {
            const tt = (y - yt) / Math.max(1, yb - yt);
            const half = q(hw) * Math.pow(tt, 0.85) + 0.5 + ((y * 7) % 3 === 0 ? 0.8 : 0);
            for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
              const u = (x - (cx - half)) / (2 * half);
              let c = u < 0.3 ? R.hi : u < 0.62 ? G : u < 0.85 ? R.mid : R.lo;
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
      case 'palm': {
        shade(9);
        const T = '#a77b52';
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
        p.sEll(q(14), q(15), 2 * S, 2 * S, '#6b4a2b');
        p.sEll(q(18), q(15), 2 * S, 2 * S, '#6b4a2b');
        break;
      }
      case 'bamboo': {
        shade(10);
        const G = t.leaf;
        for (const [x, top] of [[8, 14], [14, 4], [21, 10]]) {
          p.sRect(Math.round(q(x)), Math.round(q(top)), Math.round(3 * S), Math.round(q(46) - q(top)), G, { noHi: true });
          for (let y = top + 6; y < 44; y += 7) p.rect(Math.round(q(x)), Math.round(q(y)), Math.round(3 * S), 1, ramp(G).lo);
          p.poly([[q(x + 3), q(top + 7)], [q(x + 9), q(top + 3)], [q(x + 4), q(top + 9)]], ramp(G).hi);
          p.poly([[q(x), q(top + 13)], [q(x - 6), q(top + 10)], [q(x - 1), q(top + 15)]], ramp(G).base);
        }
        break;
      }
      case 'cactus': {
        shade(9);
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
        p.sEll(q(16), q(11), 3 * S, 2.4 * S, '#ef7fa0');
        p.set(Math.round(q(16)), Math.round(q(11)), '#f6d35b');
        break;
      }
    }
  }

  // 树长大的几个阶段（stage）：0 刚种下的种子、1 发芽、2 小树苗、3 小树、4 长大
  function treeSeed(p) {
    p.ell(8, 13.5, 5.5, 2.4, '#7a5238');
    p.ell(8, 12.8, 4.5, 1.8, '#8a5e40');
    p.sEll(8, 11.5, 1.6, 1.3, '#c8a06a');
  }
  function treeSprout(p, sp) {
    const t = TREE_SPECS[sp] || TREE_SPECS.oak;
    p.ell(8, 14, 4.5, 1.6, '#7a5238');
    p.rect(8, 8, 1, 6, '#5f8a42');
    const leaf = t.shape === 'cactus' ? t.leaf : '#6aa35a';
    p.sEll(5.5, 8, 2.6, 1.6, leaf);
    p.sEll(10.5, 7, 2.6, 1.6, leaf);
  }
  function treeSapling(p, sp) {
    const t = TREE_SPECS[sp] || TREE_SPECS.oak;
    p.ell(8, 30.5, 5, 1.5, 'rgba(40,30,20,.22)');
    p.sRect(7, 16, 2, 15, t.trunk && t.shape !== 'blossom' ? t.trunk : '#8a5a3b', { noHi: true });
    const c = t.shape === 'blossom' ? '#6aa35a' : t.leaf;
    canopy(p, [[8, 14, 5, 4], [4.5, 18, 3, 2.4], [11.5, 17, 3, 2.4], [8, 9, 3.5, 3]], c);
    if (t.shape === 'blossom') for (const [x, y] of [[6, 12], [10, 10], [9, 16]]) p.set(x, y, t.flower);
  }

  const forestCacheSpecs = {
    round: { shape: 'round', leaf: '#4f8f42', trunk: '#6a4632' },
    round2: { shape: 'oval', leaf: '#4a8a4a', trunk: '#6a4632' },
    round3: { shape: 'maple', leaf: '#4f8f42', trunk: '#6a4632' },
    pine: { shape: 'pine', leaf: '#2f6a45', trunk: '#6a4632' },
  };

  // 花（16×16，向日葵长高以后 16×24）：stage 0 刚种下、1 发芽、2 花苞、3 开花。
  // 一株是一小丛：底下两片宽叶子，两三根茎，顶上的花是一格一格手画的。
  // 字母：h 高光、b 本色、m 暗部、l 最暗、w 白、W 白的暗部、y 黄、Y 黄的暗部、k 花心、K 花心暗部
  const FLOWERS = {
    tulip: { c: '#e85d75', bloom: ['h.b.m', 'hbhbm', 'bbbbm', 'mbbml', '.mml.'], at: [[2, 4], [9, 1], [6, 7]] },
    rose: { c: '#ef7fa0', bloom: ['.hbb.', 'hbmhm', 'bmhml', 'mbmbl', '.mll.'], at: [[1, 5], [9, 2], [6, 0]] },
    daisy: { c: '#fbf7ef', bloom: ['..w.w..', '.wwwww.', 'wwyyyww', '.wyYyW.', 'wwyYYWW', '.wWWWW.', '..W.W..'], at: [[0, 4], [8, 1]] },
    sunflower: { c: '#f6c33b', tall: true, bloom: ['..y.y.y..', '.yyyyyyy.', 'yyKkkkKyy', '.yKkKkkY.', 'yyKkkkKYy', '.yKkkKkY.', 'yyKKkKKYy', '.yYYYYYY.', '..Y.Y.Y..'], at: [[3, 0]] },
    lavender: { c: '#9b7fd1', spikes: [[4, 3], [8, 1], [12, 4]] },
    bluebell: { c: '#5a8fe0', bells: [[3, 6], [6, 8], [10, 4], [13, 6]] },
  };
  const LEAF = '#5f9e4f';
  const STEM = '#4a8a3c';

  function soilMound(p) {
    const H = p.h;
    p.ell(8, H - 2.2, 5.2, 1.7, '#7a5238');
    p.ell(8, H - 2.7, 4.2, 1.1, '#8a6244');
    p.set(6, H - 2, '#5e3e2a');
    p.set(10, H - 2, '#5e3e2a');
  }
  // 底下两片宽叶子
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
    const col = { h: R.hi, b: c, m: R.mid, l: R.lo, w: '#fbf7ef', W: '#d8d0c4', y: '#f6c33b', Y: '#d89a2a', k: '#7a4a2a', K: '#5a3420' };
    map.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== '.') p.set(x0 + i, y0 + j, col[row[i]]);
    });
  }
  function flower(p, kind, stage) {
    const F = FLOWERS[kind] || FLOWERS.tulip;
    const H = p.h;
    const R = ramp(F.c);
    soilMound(p);
    if (stage === 0) {
      p.set(7, H - 3, '#e8d8b0');
      p.set(9, H - 3, '#e8d8b0');
      return;
    }
    if (stage === 1) {
      p.line(8, H - 2, 8, H - 6, STEM);
      p.poly([[8, H - 5], [4, H - 8], [5, H - 5]], LEAF);
      p.poly([[9, H - 6], [13, H - 9], [12, H - 6]], ramp(LEAF).mid);
      return;
    }
    leafPair(p, F.tall);
    // 茎：从底下分到每朵花
    const heads = F.spikes || F.bells || F.at;
    const size = F.bloom ? [F.bloom[0].length, F.bloom.length] : [2, 2];
    for (const [x, y] of heads) {
      const tx = F.bloom ? x + Math.floor(size[0] / 2) : x;
      const ty = F.bloom ? y + size[1] - 1 : y + 2;
      p.line(8, H - 3, tx, ty, STEM);
    }
    if (stage === 2) {
      // 花苞：绿色的萼片包着一点花色
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
          p.set(x + (k % 2), y + k, c);
          p.set(x + 1 - (k % 2), y + k, k % 2 ? F.c : R.mid);
        }
    if (F.bells)
      for (const [x, y] of F.bells) {
        bloomAt(p, ['.h.', 'hbm', 'bbm', 'm.l'], x - 1, y, F.c);
      }
  }

  // 灌木（16×16）
  const SHRUBS = {
    bush: { c: '#5f9e4f' },
    berry: { c: '#4f8a43', dots: '#d64545' },
    hydrangea: { c: '#5c9a4a', dots: '#8aa8e8', big: true },
  };
  function shrub(p, kind, stage) {
    const S = SHRUBS[kind] || SHRUBS.bush;
    p.ell(8, 14.5, 6.5, 1.5, 'rgba(40,30,20,.22)');
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

  // 草（16×16，蒲苇和狼尾草长大后是 16×24）：stage 0 刚种下、1 发芽、2 长好
  const GRASSES = {
    clover: { c: '#5fae4a' },
    foxtail: { c: '#7ba84a', head: '#c8c27a' },
    fountain: { c: '#6a9e4a', head: '#e0a8b8', tall: true },
    pampas: { c: '#8aa86a', head: '#f2ead2', tall: true },
  };
  function grassPlant(p, kind, stage) {
    const G = GRASSES[kind] || GRASSES.clover;
    const H = p.h;
    const R = ramp(G.c);
    if (stage === 0) {
      p.ell(8, H - 2.5, 4.5, 1.8, '#7a5238');
      p.ell(8, H - 3, 3.5, 1.2, '#8a5e40');
      p.set(7, H - 3, '#e8d8b0');
      p.set(9, H - 3, '#e8d8b0');
      return;
    }
    p.ell(8, H - 1.5, 5.5, 1.3, 'rgba(40,30,20,.22)');
    // 一根弯弯的草叶：从 (x0, 底) 往上长 h，往 lean 那边弯
    const blade = (x0, h, lean, c) => {
      let x = x0;
      for (let k = 0; k < h; k++) {
        const t = k / h;
        x = x0 + lean * t * t * h * 0.5;
        p.set(Math.round(x), H - 2 - k, k < 2 ? R.lo : t > 0.8 ? R.hi : c || (k % 3 ? G.c : R.mid));
      }
      return [Math.round(x), H - 2 - h];
    };
    if (stage === 1) {
      blade(7, 4, -0.6);
      blade(8, 5, 0.2);
      blade(9, 4, 0.7);
      return;
    }
    if (kind === 'clover') {
      // 贴地的一丛三叶草，开一朵小白花
      for (const [cx, cy] of [[5, H - 4], [10, H - 5], [7.5, H - 7.5], [11.5, H - 2.5], [4, H - 2]]) {
        for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, -1.2]]) p.ell(cx + dx, cy + dy, 1.3, 1.2, G.c);
        p.set(Math.round(cx - 1), Math.round(cy - 1), R.hi);
        p.set(Math.round(cx), Math.round(cy + 1), R.lo);
      }
      p.rect(9, H - 10, 1, 4, R.mid);
      p.ell(9.5, H - 11, 1.6, 1.6, '#fbf7ef');
      p.set(9, H - 11, '#f2d0dc');
      return;
    }
    // 底下一丛叶子
    const n = G.tall ? 8 : 6;
    const top = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const h = (G.tall ? 9 : 7) + Math.round((1 - Math.abs(t) * 1.6) * 3);
      top.push(blade(8 + Math.round(t * 4), h, t * 2.6, i % 2 ? G.c : R.mid));
    }
    if (kind === 'foxtail') {
      // 狗尾草：三根细茎，顶上毛茸茸的穗子往一边垂
      for (const [x0, h, lean] of [[6, 11, -1.2], [8, 13, 0.4], [10, 10, 1.4]]) {
        const [x, y] = blade(x0, h, lean, R.mid);
        const d = lean < 0 ? -1 : 1;
        for (let k = 0; k < 4; k++) {
          p.set(x + d * Math.floor(k / 2), y - 1 + k, G.head);
          p.set(x + d * Math.floor(k / 2) + 1, y - 1 + k, ramp(G.head).mid);
        }
        p.set(x, y - 2, ramp(G.head).hi);
      }
      return;
    }
    // 狼尾草 / 蒲苇：几根长茎，顶上一束细长的花穗
    const stalks = kind === 'pampas' ? [[6, 19, -1.4], [8, 21, 0.2], [10, 18, 1.5]] : [[5, 12, -2.4], [8, 14, 0.3], [11, 12, 2.6]];
    for (const [x0, h, lean] of stalks) {
      const [x, y] = blade(x0, h, lean, R.mid);
      const len = kind === 'pampas' ? 7 : 5;
      const w = kind === 'pampas' ? 3 : 2;
      for (let k = 0; k < len; k++) {
        const ww = k === 0 || k === len - 1 ? w - 1 : w;
        const xx = x - Math.floor(ww / 2) + Math.round(lean * 0.3 * (k / len));
        for (let i = 0; i < ww; i++) p.set(xx + i, y - k, (k + i) % 3 === 0 ? ramp(G.head).mid : i === 0 ? ramp(G.head).hi : G.head);
      }
    }
  }

  // ================= 地面（16×16） =================

  function rnd(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
  const GROUND = {
    grass(p, v) {
      const G = '#7fb35a';
      const R = ramp(G);
      p.rect(0, 0, 16, 16, G);
      const r = rnd(17 + v * 31);
      for (let i = 0; i < 9; i++) {
        const x = Math.floor(r() * 15);
        const y = Math.floor(r() * 14) + 1;
        p.set(x, y, R.mid);
        p.set(x + 1, y - 1, R.hi);
      }
      if (v === 2) {
        p.set(4, 5, '#ffffff');
        p.set(11, 11, '#f6d35b');
      }
      if (v === 3) {
        p.set(6, 9, R.lo);
        p.set(7, 8, R.hi);
        p.set(8, 9, R.lo);
      }
    },
    path(p, v) {
      const D = '#d8b98a';
      p.rect(0, 0, 16, 16, D);
      const r = rnd(5 + v * 13);
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(r() * 15);
        const y = Math.floor(r() * 15);
        p.rect(x, y, 2, 1, ramp(D).mid);
        p.set(x, y - 1, ramp(D).hi);
      }
    },
    soil(p, v) {
      const S = '#9a6a48';
      p.rect(0, 0, 16, 16, S);
      for (let y = 2; y < 16; y += 4) {
        p.rect(1, y, 14, 1, ramp(S).lo);
        p.rect(1, y - 1, 14, 1, ramp(S).hi);
      }
    },
    wet(p, v) {
      const S = '#6e4a34';
      p.rect(0, 0, 16, 16, S);
      for (let y = 2; y < 16; y += 4) {
        p.rect(1, y, 14, 1, ramp(S).lo);
        p.rect(1, y - 1, 14, 1, ramp(S).hi);
      }
      p.set(4, 6, '#9fc8e8');
      p.set(11, 10, '#9fc8e8');
    },
    // 木地板：一块 16×16 里四条横木板，接缝错开，有木纹
    floor(p, v) {
      const W = '#c99a6a';
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
    wall(p, v) {
      const P = '#efe0c4';
      p.rect(0, 0, 16, 16, P);
      for (let x = 2; x < 16; x += 8) for (let y = 3; y < 16; y += 8) {
        p.set(x + ((y >> 3) % 2) * 4, y, '#e0b8a0');
        p.set(x + ((y >> 3) % 2) * 4 + 1, y, '#e0b8a0');
      }
      for (let x = 0; x < 16; x += 8) p.rect(x, 0, 1, 16, mix(P, '#d8c4a0', 0.6));
    },
    wainscot(p, v) {
      const P = '#efe0c4';
      p.rect(0, 0, 16, 5, P);
      for (let x = 0; x < 16; x += 8) p.rect(x, 0, 1, 5, mix(P, '#d8c4a0', 0.6));
      p.rect(0, 5, 16, 1, '#8a5a3b');
      p.sRect(0, 6, 16, 8, '#b07a4a', { noHi: true });
      for (let x = 3; x < 16; x += 8) p.rect(x, 7, 1, 6, ramp('#b07a4a').lo);
      p.rect(0, 14, 16, 2, '#6a4a32');
    },
  };

  // ================= 装饰和家具 =================
  // 每件：w×h 像素，占 tw×th 个格子（放置时按底部对齐）

  // ---------- 画房子用的几样东西 ----------
  function bStone(p, x0, y0, w, h, c, brick) {
    const R = ramp(c);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const row = Math.floor((y - y0) / 4);
        const off = row % 2 ? (brick ? 3 : 5) : 0;
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
    // 两头的原木截面
    for (let y = y0; y < y0 + h; y += 6) {
      for (const x of [x0 - 2, x0 + w - 4]) {
        p.ell(x + 3, y + 3, 3, 3, '#c9a070');
        p.ell(x + 3, y + 3, 1.6, 1.6, '#a87e52');
        p.set(x + 3, y + 3, '#8a6440');
      }
    }
    for (let y = y0 + 2; y < y0 + h; y += 6) for (let x = x0 + 8 + ((y / 6) % 3) * 9; x < x0 + w - 6; x += 27) p.rect(x, y, 4, 1, R.mid);
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
        const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        p.set(x, y, n % 23 === 0 ? R.mid : n % 31 === 0 ? R.hi : c);
      }
  }
  // 瓦片：一排排，排与排之间错开
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
  // 陶土瓦：一条条竖着的弧
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
      const h = ((y - top) / (eave - top)) * half;
      p.set(Math.round(cx - h), y, c);
      p.set(Math.round(cx - h) + 1, y, ramp(c).hi);
      p.set(Math.round(cx + h), y, c);
      p.set(Math.round(cx + h) - 1, y, ramp(c).mid);
    }
  }
  // 窗户：白框、十字窗棂、窗帘；可以带百叶、花箱、拱顶，也可以是落地的门
  function bWindow(p, x, y, w, h, o) {
    const T = o.trim || '#f4efe4';
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
    p.rect(gx, gy, gw, gh, '#7fb6d8');
    p.rect(gx, gy, gw, Math.max(2, Math.floor(gh / 5)), '#a9d4ec');
    // 玻璃往墙里缩进去一点：上沿、左沿一道暗边
    p.rect(gx, gy, gw, 1, '#5e93b8');
    p.rect(gx, gy, 1, gh, '#6aa2c6');
    p.line(gx + 1, gy + gh - 2, gx + Math.min(gw - 2, 7), gy + gh - 2 - Math.min(gh - 3, 7), '#cdeaf8');
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
    p.rect(gx, gy, 2, Math.floor(gh * 0.55), '#f4ece0');
    p.rect(gx + gw - 2, gy, 2, Math.floor(gh * 0.55), '#f4ece0');
    // 窗台：比窗框宽一点，上面受光
    if (!o.box && !o.door) {
      p.rect(x - 1, y + h, w + 2, 2, ramp(T).mid);
      p.rect(x - 1, y + h, w + 2, 1, '#fffaf0');
    }
    if (o.box) {
      p.sRect(x - 1, y + h, w + 2, 3, '#8a5a3b');
      for (let i = 0; i < w; i += 2) {
        p.set(x + i, y + h - 1, ['#e85d75', '#f6d35b', '#ef7fa0', '#ffffff', '#9b7fd1'][(i / 2) % 5]);
        p.set(x + i + 1, y + h - 1, '#5f9e4f');
      }
    }
  }
  function bDoor(p, cx, bottom, w, h, c, trim, arch) {
    const x = Math.round(cx - w / 2);
    const y = bottom - h;
    p.sRect(x - 3, y - 3, w + 6, h + 3, trim, { noHi: true });
    p.sRect(x, y, w, h, c);
    const R = ramp(c);
    p.rect(x, y, w, 2, R.lo); // 门往里缩，上面压着一道影子
    p.rect(Math.round(cx), y, 1, h, R.lo);
    for (const [px, py] of [[x + 2, y + 3], [Math.round(cx) + 2, y + 3], [x + 2, y + Math.round(h / 2) + 1], [Math.round(cx) + 2, y + Math.round(h / 2) + 1]]) p.sRect(px, py, Math.floor(w / 2) - 4, Math.floor(h / 2) - 5, R.mid, { noHi: true });
    p.rect(Math.round(cx) + 2, y + Math.round(h * 0.55), 2, 2, '#f2c14e');
    p.rect(Math.round(cx) - 4, y + Math.round(h * 0.55), 2, 2, '#f2c14e');
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

  const DECOR = {
    fence: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      const W = '#c49a6c';
      p.sRect(1, 3, 3, 12, W);
      p.sRect(12, 3, 3, 12, W);
      p.sRect(0, 6, 16, 2, W, { noHi: true });
      p.sRect(0, 11, 16, 2, W, { noHi: true });
    } },
    stone: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14, 6, 1.6, 'rgba(40,30,20,.2)');
      p.sEll(8, 10.5, 5.5, 4, '#a8a29a');
      p.sEll(12, 12, 2.5, 2, '#a8a29a');
    } },
    // ---- 地上要清理的东西：杂草、小石头、大石头、树枝、树桩（野树直接用长大的树） ----
    weed1: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14.5, 5.5, 1.4, 'rgba(30,40,20,.22)');
      const G = ramp('#5f9a3a');
      for (const [x0, y0, x1, y1, c] of [[8, 14, 3, 5, G.lo], [8, 14, 13, 6, G.lo], [8, 14, 5, 3, G.mid], [8, 14, 11, 2, G.mid], [8, 14, 8, 1, '#5f9a3a'], [8, 14, 2, 9, '#5f9a3a'], [8, 14, 14, 10, '#5f9a3a']]) p.line(x0, y0, x1, y1, c);
      for (const [x, y] of [[3, 5], [13, 6], [5, 3], [11, 2], [8, 1]]) p.set(x, y, G.hi);
      p.rect(6, 13, 5, 2, G.lo);
    } },
    weed2: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14.5, 6, 1.4, 'rgba(30,40,20,.22)');
      const G = ramp('#6aa23e');
      // 一圈锯齿边的叶子，中间冒出一朵小黄花
      for (const [cx, cy, rx, ry] of [[4, 11, 3.5, 2.2], [12, 11, 3.5, 2.2], [6, 8, 2.6, 3], [10, 8, 2.6, 3], [8, 12, 3, 2]]) p.sEll(cx, cy, rx, ry, '#6aa23e');
      for (const [x, y] of [[2, 10], [14, 10], [5, 6], [11, 6]]) p.set(x, y, G.hi);
      p.line(8, 12, 8, 4, G.lo);
      p.sEll(8, 3.5, 2, 1.8, '#f2c14e');
      p.set(8, 3, '#fff2a8');
    } },
    weed3: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14.5, 6, 1.4, 'rgba(30,40,20,.22)');
      const G = ramp('#7a9a3a');
      // 一丛干一点的长草，叶尖发黄
      for (let i = 0; i < 7; i++) {
        const x0 = 4 + i * 1.3;
        const lean = (i - 3) * 0.9;
        const h = 8 + ((i * 5) % 4);
        p.line(Math.round(x0), 14, Math.round(x0 + lean), 14 - h, i % 2 ? G.mid : '#7a9a3a');
        p.set(Math.round(x0 + lean), 14 - h, '#c9b65a');
      }
      p.rect(4, 13, 9, 2, G.lo);
    } },
    rock1: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14, 6.5, 1.7, 'rgba(30,25,20,.25)');
      const R = ramp('#a39d94');
      p.sEll(8, 10, 6, 4.5, '#a39d94');
      p.ell(6.5, 8.5, 3.6, 2.4, R.hi);
      p.ell(10, 12, 3.2, 1.6, R.mid);
      p.line(9, 8, 11, 11, R.lo);
      p.set(5, 7, '#d8d4cc');
    } },
    rock2: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 14, 6.5, 1.7, 'rgba(30,25,20,.25)');
      const R = ramp('#9a958e');
      p.sEll(6, 11, 4.5, 3.4, '#9a958e');
      p.sEll(11, 10, 3.6, 3.6, '#a8a29a');
      p.ell(10.5, 8.5, 2, 1.4, ramp('#a8a29a').hi);
      p.ell(5, 9.8, 2.4, 1.3, R.hi);
      p.rect(3, 9, 3, 1, '#6f9a4a');
    } },
    boulder: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.ell(16, 29, 14, 2.6, 'rgba(30,25,20,.28)');
      const R = ramp('#9c968c');
      // 大石头：亮的一面朝左上，暗的一面朝右下，几道裂缝，顶上一点青苔
      p.sEll(16, 18, 14, 11, '#9c968c');
      p.ell(13, 14, 9.5, 7, R.hi);
      p.ell(12, 13, 6, 4, lighten(R.hi, 0.05));
      p.ell(21, 23, 8, 4.5, R.mid);
      p.ell(23, 25, 5, 2.4, R.lo);
      p.line(17, 9, 19, 15, R.lo);
      p.line(19, 15, 23, 17, R.lo);
      p.line(8, 20, 12, 23, R.mid);
      p.sEll(11, 9, 5, 2.2, '#5f8f3e');
      for (const [x, y] of [[8, 8], [10, 7], [13, 8]]) p.set(x, y, '#7fb04f');
      p.set(9, 11, '#e4e0d8');
      p.set(10, 11, '#e4e0d8');
    } },
    twig: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.ell(8, 13, 6, 1.3, 'rgba(30,25,20,.2)');
      const B = '#8a5e3a';
      p.line(2, 12, 13, 8, B);
      p.line(2, 13, 13, 9, ramp(B).lo);
      p.line(8, 10, 10, 5, B);
      p.line(5, 11, 4, 8, B);
      p.sEll(11, 4.5, 1.8, 1.2, '#6aa23e');
      p.sEll(3.5, 7.5, 1.4, 1, '#6aa23e');
    } },
    stump: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.ell(16, 28, 14, 2.6, 'rgba(30,25,20,.28)');
      const BARK = '#7a5234';
      const BK = ramp(BARK);
      // 树根往外张开
      for (const [x0, x1] of [[5, 2], [26, 30], [11, 8], [21, 24]]) p.poly([[x0, 22], [x0 + (x1 > x0 ? 4 : -4) * 0 + 2, 22], [x1, 27], [x1 + (x1 > x0 ? -3 : 3), 27]], BK.lo);
      // 树干：一圈树皮，左边亮右边暗
      p.sRect(6, 12, 20, 14, BARK);
      for (let x = 6; x < 26; x++) {
        const c = x < 9 ? BK.hi : x > 21 ? BK.lo : (x % 4 === 0 ? BK.mid : BARK);
        for (let y = 13; y < 26; y++) if (!((y + x) % 7 === 0 && x > 9 && x < 21)) p.set(x, y, c);
      }
      // 截面：年轮
      p.sEll(16, 12, 10, 4.5, '#d9b07a');
      p.ell(16, 12, 7, 3, '#c99a62');
      p.ell(16, 12, 4.2, 1.8, '#d9b07a');
      p.ell(16, 12, 1.6, 0.8, '#b8864e');
      p.line(16, 12, 22, 10, '#a8763e');
      // 一朵小蘑菇
      p.sEll(25, 21, 2.4, 1.6, '#d8783a');
      p.rect(25, 22, 1, 2, '#f4ece0');
    } },
    // 上楼的楼梯：一级级往后墙里走，越往上越暗，右边一道扶手
    stairsUp: { w: 32, h: 48, tw: 2, th: 3, room: true, flat: true, draw(p) {
      const TREAD = '#c99a62';
      const RISE = '#8a5e3a';
      p.rect(0, 0, 32, 48, '#6a4630');
      for (let i = 0; i < 7; i++) {
        const y = 47 - i * 7;
        const k = i / 7;
        p.rect(3, y - 6, 26, 5, mix(TREAD, '#3a2a20', k * 0.55));
        p.rect(3, y - 1, 26, 2, mix(RISE, '#2a1d16', k * 0.55));
        p.rect(3, y - 6, 26, 1, mix(lighten(TREAD, 0.08), '#3a2a20', k * 0.55));
      }
      p.rect(0, 0, 32, 4, '#2a1d16');
      p.rect(0, 0, 3, 48, '#5a3a26');
      p.rect(29, 0, 3, 48, '#5a3a26');
      for (let y = 8; y < 46; y += 8) p.rect(30, y, 1, 6, '#c8a070');
      p.rect(29, 6, 3, 1, '#d8b080');
    } },
    // 下楼的楼梯：地板上一个口子，楼梯往下走，越往下越暗，三边围着栏杆
    stairsDown: { w: 32, h: 48, tw: 2, th: 3, room: true, flat: true, draw(p) {
      p.rect(0, 0, 32, 48, '#5a3a26');
      for (let i = 0; i < 7; i++) {
        const y = 3 + i * 6;
        const k = i / 7;
        p.rect(4, y, 24, 4, mix('#c99a62', '#1a120c', 0.15 + k * 0.7));
        p.rect(4, y + 4, 24, 2, mix('#8a5e3a', '#120c08', 0.2 + k * 0.7));
      }
      for (const x of [1, 29]) {
        p.rect(x, 0, 2, 46, '#b07a4a');
        for (let y = 2; y < 46; y += 5) p.rect(x, y, 2, 1, '#8a5a3b');
      }
      p.rect(1, 0, 30, 2, '#c8a070');
      p.rect(1, 46, 30, 2, '#8a5a3b');
    } },
    stool: { w: 16, h: 16, tw: 1, th: 1, room: true, draw(p) {
      p.ell(8, 14.5, 5.5, 1.3, 'rgba(30,25,20,.22)');
      const W = '#b07a4a';
      for (const x of [4, 11]) p.sRect(x, 8, 2, 7, ramp(W).mid, { noHi: true });
      p.rect(5, 11, 7, 1, ramp(W).lo);
      p.sEll(8, 7, 5.5, 2.6, W);
      p.ell(7, 6.4, 3.6, 1.2, ramp(W).hi);
    } },
    mushroom: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.sRect(6, 9, 4, 5, '#f4ece0');
      p.sEll(8, 8, 6, 4, '#d64545');
      p.rect(2, 9, 12, 1, ramp('#d64545').lo);
      for (const [x, y] of [[5, 6], [9, 5], [11, 8]]) p.rect(x, y, 2, 1, '#ffffff');
    } },
    lamp: { w: 16, h: 32, tw: 1, th: 1, draw(p) {
      p.ell(8, 30.5, 5, 1.4, 'rgba(40,30,20,.2)');
      p.sRect(7, 9, 2, 21, '#4a4a52');
      p.sRect(5, 29, 6, 2, '#4a4a52');
      p.sRect(4, 4, 8, 6, '#3a3a42');
      p.rect(5, 5, 6, 4, '#ffe28a');
      p.rect(6, 6, 2, 2, '#fff6cc');
      p.poly([[3, 4], [13, 4], [8, 0]], '#3a3a42');
    } },
    bench: { w: 32, h: 16, tw: 2, th: 1, draw(p) {
      const W = '#b07a4a';
      p.ell(16, 15, 13, 1.5, 'rgba(40,30,20,.2)');
      p.sRect(2, 1, 28, 3, W);
      p.sRect(2, 5, 28, 2, W, { noHi: true });
      p.sRect(1, 8, 30, 3, W);
      p.sRect(3, 11, 2, 4, '#4a4a52');
      p.sRect(27, 11, 2, 4, '#4a4a52');
    } },
    birdbath: { w: 16, h: 24, tw: 1, th: 1, draw(p) {
      p.ell(8, 22.5, 5, 1.4, 'rgba(40,30,20,.2)');
      p.sRect(6, 11, 4, 11, '#c8c2b8');
      p.sRect(4, 20, 8, 3, '#c8c2b8');
      p.sEll(8, 9, 7, 3, '#c8c2b8');
      p.ell(8, 8.5, 5, 1.6, '#7fb8e0');
      p.set(6, 8, '#d8f0ff');
    } },
    mailbox: { w: 16, h: 32, tw: 1, th: 1, draw(p) {
      p.ell(8, 30.5, 5, 1.4, 'rgba(40,30,20,.2)');
      p.sRect(7, 16, 2, 14, '#8a5a3b');
      p.sRect(3, 9, 10, 8, '#5a7fb0');
      p.sEll(8, 9.5, 5, 3, '#5a7fb0');
      p.rect(3, 13, 10, 1, ramp('#5a7fb0').lo);
      p.rect(4, 12, 1, 3, ramp('#5a7fb0').mid);
      p.sRect(12, 5, 1, 6, '#c8463a', { noHi: true });
      p.sRect(12, 5, 3, 2, '#c8463a', { noHi: true });
    } },
    logs: { w: 32, h: 24, tw: 2, th: 1, draw(p) {
      p.ell(16, 22.5, 15, 2, 'rgba(40,30,20,.22)');
      const BARK = '#7a5232';
      const CUT = '#d9b483';
      // 木头往后伸的上表面（树皮）
      p.sRect(5, 3, 22, 6, BARK, { noHi: true });
      for (let x = 7; x < 26; x += 3) p.set(x, 4 + (x % 2), ramp(BARK).hi);
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
      p.line(1, 21, 4, 17, '#7a5232');
      p.set(30, 21, '#5f9e4f');
      p.set(31, 20, '#5f9e4f');
    } },
    sign: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
      p.sRect(7, 8, 2, 7, '#8a5a3b');
      p.sRect(2, 2, 12, 7, '#c49a6c');
      p.rect(4, 4, 8, 1, ramp('#c49a6c').lo);
      p.rect(4, 6, 6, 1, ramp('#c49a6c').lo);
    } },
    pond: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.sEll(16, 17, 15, 12, '#a8a29a');
      p.ell(16, 17, 12.5, 9.5, '#5a9ad0');
      p.ell(14, 15, 9, 6, '#6fb0e0');
      p.rect(9, 13, 5, 1, '#d8f0ff');
      p.rect(19, 20, 3, 1, '#d8f0ff');
      p.sEll(22, 13, 3, 2, '#6aa35a');
      p.set(22, 12, '#ef7fa0');
    } },
    pethouse: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
      p.ell(16, 30.5, 14, 1.8, 'rgba(40,30,20,.2)');
      p.sRect(4, 14, 24, 16, '#e8c48a');
      p.poly([[1, 15], [16, 2], [31, 15]], '#c8463a');
      p.poly([[3, 15], [16, 4], [16, 15]], ramp('#c8463a').hi);
      p.rect(1, 15, 30, 2, ramp('#c8463a').lo);
      p.sEll(16, 24, 5, 6, '#4a3226');
      p.rect(11, 24, 11, 6, '#4a3226');
      p.rect(12, 9, 8, 3, '#fbf7ef');
      p.rect(13, 10, 6, 1, '#c8463a');
    } },
    // 农舍：瓦片屋顶、木板墙、石头地基，门上有小雨棚，窗户带百叶和花箱，砖砌烟囱
    // 小木屋：7 格宽，原木墙、山墙屋顶、一扇门两扇窗
    cabin: { w: 112, h: 96, tw: 7, th: 3, draw(p) {
      const LOG = '#a8714a';
      const ROOF = '#8a4a36';
      p.ell(56, 93, 58, 3, 'rgba(30,25,15,.28)');
      // 烟囱（在屋顶后面）
      bStone(p, 78, 2, 10, 26, '#9d978c');
      bStone(p, 6, 80, 100, 8, '#9d978c');
      bLogs(p, 6, 46, 100, 34, LOG);
      // 屋顶
      const top = 6;
      const eave = 47;
      const inRoof = (x, y) => y >= top && y < eave && Math.abs(x - 55.5) <= ((y - top) / (eave - top)) * 60;
      bShingles(p, inRoof, top, eave, ROOF, 5, 0);
      bRoofEdge(p, 55.5, top, eave, 60, '#6a4630');
      p.sRect(-1, eave - 1, 114, 3, '#6a4630', { noHi: true });
      // 门
      bDoor(p, 56, 80, 18, 27, '#7a4e32', '#5a3a26');
      p.sRect(44, 52, 24, 3, '#8a5e3c', { noHi: true });
      // 窗户
      bWindow(p, 17, 56, 16, 14, { shutter: '#6a8a52', box: true });
      bWindow(p, 79, 56, 16, 14, { shutter: '#6a8a52', box: true });
      // 门边的灯、台阶
      p.sRect(69, 60, 3, 5, '#3a3a42');
      p.set(70, 62, '#ffe28a');
      p.sRect(44, 88, 24, 4, '#b9b2a6');
    } },
    // 石头小屋：9 格宽，石头墙、茅草色的人字屋顶，门口一个小门廊，右边石头烟囱
    cottage: { w: 144, h: 104, tw: 9, th: 3, draw(p) {
      const STONE = '#b8ae9b';
      const ROOF = '#9a7a44';
      const TRIM = '#efe4cc';
      p.ell(72, 101, 74, 3, 'rgba(30,25,15,.28)');
      bStone(p, 104, 0, 12, 34, '#9d978c');
      bStone(p, 8, 54, 128, 38, STONE);
      bStone(p, 6, 90, 132, 8, '#8f887c');
      p.rect(10, 54, 124, 3, 'rgba(50,35,20,.3)');
      // 人字屋顶：一层层茅草
      const top = 6;
      const eave = 56;
      const inRoof = (x, y) => y >= top && y < eave && Math.abs(x - 71.5) <= 6 + ((y - top) / (eave - top)) * 72;
      bShingles(p, inRoof, top, eave, ROOF, 4, 2);
      for (let y = top; y < eave; y += 4) for (let x = 0; x < 144; x += 7) if (inRoof(x, y + 2) && (x + y) % 3 === 0) p.rect(x, y + 2, 1, 2, ramp(ROOF).hi);
      p.rect(66, top - 2, 12, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 146, 3, '#6e5430', { noHi: true });
      // 门廊：两根木柱撑着一个小人字顶
      p.poly([[50, 66], [94, 66], [72, 52]], '#7a5a36');
      p.poly([[54, 65], [90, 65], [72, 55]], ramp(ROOF).mid);
      p.sRect(52, 66, 4, 24, '#8a6440', { noHi: true });
      p.sRect(88, 66, 4, 24, '#8a6440', { noHi: true });
      bDoor(p, 72, 90, 18, 22, '#6e4a32', '#5a3a26');
      bWindow(p, 20, 64, 18, 16, { shutter: '#4f6f8f', box: true, trim: TRIM });
      bWindow(p, 106, 64, 18, 16, { shutter: '#4f6f8f', box: true, trim: TRIM });
      p.sRect(94, 70, 3, 5, '#3a3a42');
      p.set(95, 72, '#ffe28a');
      p.sRect(58, 96, 28, 4, '#c8c0b2');
    } },
    // 大农舍：11 格宽，红色木板墙、白边，深灰屋顶上两扇老虎窗，整排的门廊
    farm2: { w: 176, h: 136, tw: 11, th: 4, draw(p) {
      const WALL = '#b5523f';
      const TRIM = '#f6efe2';
      const ROOF = '#5a5752';
      p.ell(88, 133, 90, 3.2, 'rgba(30,25,15,.28)');
      bStone(p, 26, 0, 12, 30, '#a8503c', true);
      bStone(p, 8, 118, 160, 10, '#9d978c');
      bPlanks(p, 10, 62, 156, 56, WALL);
      for (let x = 22; x < 160; x += 12) p.rect(x, 62, 1, 56, ramp(WALL).lo);
      p.sRect(8, 60, 5, 58, TRIM, { noHi: true });
      p.sRect(163, 60, 5, 58, TRIM, { noHi: true });
      // 四坡屋顶
      const top = 8;
      const eave = 62;
      const inRoof = (x, y) => y >= top && y < eave && x >= 36 - ((y - top) / (eave - top)) * 38 && x <= 139 + ((y - top) / (eave - top)) * 38;
      bShingles(p, inRoof, top, eave, ROOF, 6, 1);
      p.rect(36, top - 2, 104, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 178, 3, '#3e3c38', { noHi: true });
      // 两扇老虎窗
      for (const cx of [56, 120]) {
        p.poly([[cx - 15, 50], [cx + 15, 50], [cx, 28]], TRIM);
        p.poly([[cx - 12, 50], [cx + 12, 50], [cx, 31]], ramp(ROOF).mid);
        bWindow(p, cx - 7, 36, 14, 14, { trim: TRIM });
      }
      // 门廊：屋檐、六根柱子、栏杆
      p.sRect(14, 76, 148, 6, '#6a675f');
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
      bDoor(p, 88, 118, 20, 28, '#6e4a32', TRIM);
      p.sRect(66, 128, 44, 4, '#c8c0b2');
      p.sRect(70, 124, 36, 4, '#d8d0c2');
    } },
    // 红砖洋房：11 格宽，两层红砖、白色窗框，正面一个山墙，楼下左边一扇凸窗
    brick: { w: 176, h: 176, tw: 11, th: 4, draw(p) {
      const BRICK = '#ad5a42';
      const TRIM = '#f6f1e6';
      const ROOF = '#4d5563';
      p.ell(88, 173, 90, 3.5, 'rgba(30,25,15,.28)');
      bStone(p, 134, 0, 14, 40, '#8f4434', true);
      bStone(p, 10, 158, 156, 10, '#8f887c');
      bStone(p, 12, 58, 152, 100, BRICK, true);
      p.sRect(10, 106, 156, 4, TRIM, { noHi: true });
      p.rect(14, 58, 148, 3, 'rgba(40,30,30,.3)');
      // 四坡屋顶 + 正中的山墙
      const top = 10;
      const eave = 60;
      const inRoof = (x, y) => y >= top && y < eave && x >= 40 - ((y - top) / (eave - top)) * 42 && x <= 135 + ((y - top) / (eave - top)) * 42;
      bShingles(p, inRoof, top, eave, ROOF, 5, 0);
      p.rect(40, top - 2, 96, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 178, 3, '#373d48', { noHi: true });
      bStone(p, 58, 30, 60, 30, BRICK, true);
      const inGable = (x, y) => y >= 14 && y < 60 && Math.abs(x - 87.5) <= ((y - 14) / 46) * 34 && y >= 14;
      for (let y = 14; y < 60; y++) for (let x = 50; x < 126; x++) if (!inGable(x, y)) continue; else if (Math.abs(x - 87.5) > ((y - 14) / 46) * 34 - 4) p.set(x, y, ROOF);
      bRoofEdge(p, 87.5, 14, 60, 36, TRIM);
      p.sEll(88, 38, 6, 6, TRIM);
      p.ell(88, 38, 4, 4, '#7fb6d8');
      p.rect(88, 34, 1, 8, TRIM);
      // 楼上三扇窗
      for (const x of [26, 78, 128]) bWindow(p, x, 68, 22, 28, { trim: TRIM });
      // 楼下：凸窗、门、窗
      p.sRect(18, 116, 44, 40, TRIM);
      bWindow(p, 22, 120, 12, 30, { trim: TRIM });
      bWindow(p, 34, 118, 16, 32, { trim: TRIM });
      bWindow(p, 50, 120, 12, 30, { trim: TRIM });
      p.sRect(16, 112, 48, 5, ROOF);
      bWindow(p, 126, 120, 24, 28, { trim: TRIM, box: true });
      p.poly([[72, 118], [104, 118], [88, 108]], TRIM);
      bDoor(p, 88, 158, 20, 34, '#2f4a3a', TRIM);
      p.sRect(108, 128, 3, 5, '#3a3a42');
      p.set(109, 130, '#ffe28a');
      p.sRect(68, 168, 40, 4, '#c8c0b2');
      p.sRect(72, 164, 32, 4, '#d8d0c2');
    } },
    // 白色洋房：13 格宽，白色木板墙、绿色百叶窗、墨绿屋顶上三扇老虎窗，楼下一整排带栏杆的门廊
    white: { w: 208, h: 176, tw: 13, th: 4, draw(p) {
      const WALL = '#f1eee6';
      const TRIM = '#ffffff';
      const ROOF = '#3f5f4f';
      const SHUT = '#3f6f52';
      p.ell(104, 173, 106, 3.5, 'rgba(30,25,15,.28)');
      bStone(p, 40, 0, 12, 36, '#a8503c', true);
      bStone(p, 156, 0, 12, 36, '#a8503c', true);
      bStone(p, 8, 158, 192, 10, '#9d978c');
      bPlanks(p, 12, 58, 184, 100, WALL);
      p.sRect(10, 56, 5, 102, TRIM, { noHi: true });
      p.sRect(193, 56, 5, 102, TRIM, { noHi: true });
      p.rect(15, 58, 178, 3, 'rgba(40,50,40,.25)');
      const top = 8;
      const eave = 58;
      const inRoof = (x, y) => y >= top && y < eave && x >= 48 - ((y - top) / (eave - top)) * 50 && x <= 159 + ((y - top) / (eave - top)) * 50;
      bShingles(p, inRoof, top, eave, ROOF, 6, 2);
      p.rect(48, top - 2, 112, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 210, 3, '#2e463a', { noHi: true });
      for (const cx of [62, 104, 146]) {
        p.poly([[cx - 13, 48], [cx + 13, 48], [cx, 28]], TRIM);
        p.poly([[cx - 10, 48], [cx + 10, 48], [cx, 31]], ramp(ROOF).mid);
        bWindow(p, cx - 6, 35, 12, 13, { trim: TRIM });
      }
      // 楼上四扇窗
      for (const x of [24, 66, 122, 164]) bWindow(p, x, 66, 20, 26, { shutter: SHUT, trim: TRIM });
      // 门廊：屋檐、栏杆、八根柱子
      p.sRect(12, 98, 184, 6, ROOF);
      p.sRect(12, 104, 184, 3, TRIM, { noHi: true });
      for (const x of [14, 38, 62, 86, 118, 142, 166, 190]) p.sRect(x, 107, 4, 51, TRIM, { noHi: true });
      for (const x of [24, 66, 122, 164]) bWindow(p, x, 114, 20, 26, { shutter: SHUT, trim: TRIM });
      for (const [x0, x1] of [[14, 90], [118, 194]]) {
        p.sRect(x0, 140, x1 - x0, 3, TRIM, { noHi: true });
        for (let x = x0 + 2; x < x1; x += 4) p.rect(x, 143, 2, 15, TRIM);
      }
      bDoor(p, 104, 158, 22, 36, '#2f4a3a', TRIM);
      p.sRect(80, 168, 48, 4, '#c8c0b2');
      p.sRect(84, 164, 40, 4, '#d8d0c2');
    } },
    // 石头大宅：13 格宽，灰石头两层，左右两个山墙，正中石头拱门，青灰色屋顶，两边烟囱
    manor: { w: 208, h: 184, tw: 13, th: 5, draw(p) {
      const STONE = '#a9a397';
      const TRIM = '#efe9dc';
      const ROOF = '#4f5868';
      p.ell(104, 181, 106, 3.5, 'rgba(30,25,15,.28)');
      bStone(p, 22, 6, 14, 40, '#8f887c');
      bStone(p, 172, 6, 14, 40, '#8f887c');
      bStone(p, 8, 164, 192, 12, '#8f887c');
      bStone(p, 12, 66, 184, 98, STONE);
      p.sRect(10, 112, 188, 4, TRIM, { noHi: true });
      // 主屋顶
      const top = 16;
      const eave = 68;
      const inRoof = (x, y) => y >= top && y < eave && x >= 50 - ((y - top) / (eave - top)) * 52 && x <= 157 + ((y - top) / (eave - top)) * 52;
      bShingles(p, inRoof, top, eave, ROOF, 5, 3);
      p.rect(50, top - 2, 108, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 210, 3, '#3a4250', { noHi: true });
      // 左右两个山墙：石墙往上伸，三角屋顶
      for (const cx of [44, 164]) {
        bStone(p, cx - 30, 52, 60, 20, STONE);
        const inG = (x, y) => y >= 8 && y < 58 && Math.abs(x - cx + 0.5) <= ((y - 8) / 50) * 34;
        bShingles(p, inG, 8, 58, ROOF, 5, 1);
        for (let y = 26; y < 58; y++) for (let x = cx - 30; x < cx + 30; x++) if (Math.abs(x - cx + 0.5) <= ((y - 8) / 50) * 34 - 7) p.set(x, y, STONE);
        bRoofEdge(p, cx - 0.5, 8, 58, 34, TRIM);
        bWindow(p, cx - 7, 34, 14, 18, { arch: true, trim: TRIM });
        bWindow(p, cx - 12, 74, 24, 30, { trim: TRIM });
        bWindow(p, cx - 12, 124, 24, 30, { trim: TRIM, box: true });
      }
      // 中间：楼上两扇窗，楼下石头拱门
      bWindow(p, 82, 74, 16, 28, { arch: true, trim: TRIM });
      bWindow(p, 110, 74, 16, 28, { arch: true, trim: TRIM });
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (k / 8);
        p.sRect(Math.round(104 - Math.cos(a) * 22) - 3, Math.round(130 - Math.sin(a) * 18) - 2, 6, 5, '#c8c2b4', { noHi: true });
      }
      bDoor(p, 104, 164, 26, 36, '#5a3a26', '#7a6a58', true);
      for (const x of [74, 128]) {
        p.sRect(x, 132, 6, 32, '#c8c2b4', { noHi: true });
        p.sEll(x + 3, 128, 5, 4, '#3f6f3a');
        p.sRect(x + 2, 116, 2, 8, '#3a3a42');
        p.set(x + 3, 120, '#ffe28a');
      }
      p.sRect(76, 176, 56, 4, '#c8c0b2');
      p.sRect(80, 172, 48, 4, '#d8d0c2');
    } },
    // 大别墅：15 格宽，中间主楼三层（顶上山花里一扇圆窗），两边两层的厢房，陶土瓦，门前六根柱子
    villa2: { w: 240, h: 208, tw: 15, th: 5, draw(p) {
      const WALL = '#f2e6cf';
      const STONE = '#cdbfa5';
      const ROOF = '#c2603f';
      const TRIM = '#fbf7ef';
      p.ell(120, 205, 122, 3.5, 'rgba(30,25,15,.28)');
      bStone(p, 92, 0, 10, 30, '#a8503c', true);
      bStone(p, 138, 0, 10, 30, '#a8503c', true);
      bStone(p, 8, 186, 224, 10, '#a49c90');
      const roof = (x0, x1, top, eave, ridge0, ridge1) => {
        const inRoof = (x, y) => y >= top && y < eave && x >= ridge0 - ((y - top) / (eave - top)) * (ridge0 - x0) && x <= ridge1 + ((y - top) / (eave - top)) * (x1 - ridge1);
        bTiles(p, inRoof, top, eave, ROOF);
        p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
        p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, '#8a4630', { noHi: true });
      };
      // 厢房
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
      // 主楼
      bPlaster(p, 74, 50, 92, 136, WALL);
      for (const x of [74, 160]) for (let y = 50; y < 186; y += 8) p.sRect(x + ((y / 8) % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
      roof(66, 174, 14, 52, 98, 142);
      // 山花：三角形，里面一扇圆窗
      p.poly([[86, 58], [154, 58], [120, 30]], TRIM);
      p.poly([[92, 56], [148, 56], [120, 34]], '#efe0c4');
      p.sEll(120, 46, 7, 7, TRIM);
      p.ell(120, 46, 5, 5, '#7fb6d8');
      p.rect(120, 41, 1, 10, TRIM);
      p.rect(115, 46, 10, 1, TRIM);
      p.sRect(80, 96, 80, 3, TRIM, { noHi: true });
      for (const x of [86, 112, 138]) bWindow(p, x, 64, 16, 26, { arch: true, trim: TRIM });
      // 二楼阳台
      for (const x of [86, 112, 138]) bWindow(p, x, 104, 16, 28, { door: true, trim: TRIM });
      p.sRect(80, 132, 80, 4, TRIM);
      for (let x = 82; x < 158; x += 4) p.rect(x, 126, 2, 6, TRIM);
      p.sRect(80, 124, 80, 3, TRIM);
      // 门廊：六根柱子
      p.sRect(78, 138, 84, 7, TRIM);
      for (const x of [82, 96, 108, 128, 140, 154]) {
        p.sRect(x, 145, 5, 41, TRIM, { noHi: true });
        p.rect(x - 1, 145, 7, 2, ramp(TRIM).mid);
      }
      bDoor(p, 120, 186, 24, 34, '#6e4a32', TRIM, true);
      p.sRect(92, 196, 56, 4, '#d8d0c2');
      p.sRect(96, 200, 48, 4, '#c8c0b2');
      for (const [x0, x1] of [[14, 78], [162, 226]]) {
        p.sRect(x0, 180, x1 - x0, 6, '#6e8a52');
        for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 180 + ((x * 3) % 3), ['#e85d75', '#f6d35b', '#ffffff', '#9b7fd1'][(x / 3) % 4 | 0]);
      }
    } },
    // 庄园：17 格宽，中间三层主楼、孟莎式屋顶上一座小圆亭，两边两层的翼楼，两头各一座圆塔
    estate: { w: 272, h: 224, tw: 17, th: 6, draw(p) {
      const WALL = '#ece3cf';
      const STONE = '#cfc4ac';
      const ROOF = '#4a5262';
      const TRIM = '#fbf8f0';
      const GOLD = '#e0b04a';
      p.ell(136, 221, 138, 3.5, 'rgba(30,25,15,.28)');
      bStone(p, 6, 200, 260, 10, '#a49c90');
      const hip = (x0, x1, top, eave, ridge0, ridge1) => {
        const inRoof = (x, y) => y >= top && y < eave && x >= ridge0 - ((y - top) / (eave - top)) * (ridge0 - x0) && x <= ridge1 + ((y - top) / (eave - top)) * (x1 - ridge1);
        bShingles(p, inRoof, top, eave, ROOF, 5, 1);
        p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
        p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, '#363c48', { noHi: true });
      };
      // 翼楼
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
      // 圆塔：左边亮右边暗，看着是圆的；尖顶上一个金色的尖
      for (const x0 of [4, 232]) {
        const TW = 36;
        for (let y = 72; y < 200; y++)
          for (let x = x0; x < x0 + TW; x++) {
            const u = (x - x0) / (TW - 1);
            const shade = u < 0.2 ? 0.08 : u > 0.7 ? -0.22 * ((u - 0.7) / 0.3) - 0.05 : 0;
            const c = shade > 0 ? mix(WALL, '#ffffff', shade) : mix(WALL, '#8a7a60', -shade);
            p.set(x, y, (y - 72) % 8 === 7 ? mix(c, STONE, 0.5) : c);
          }
        const cx = x0 + TW / 2 - 0.5;
        const inCone = (x, y) => y >= 22 && y < 76 && Math.abs(x - cx) <= ((y - 22) / 54) * 22;
        bShingles(p, inCone, 22, 76, ROOF, 5, 0);
        for (let y = 22; y < 76; y++) {
          const h = ((y - 22) / 54) * 22;
          p.set(Math.round(cx + h), y, ramp(ROOF).lo);
          p.set(Math.round(cx + h) - 1, y, ramp(ROOF).lo);
        }
        p.sRect(x0 - 3, 74, TW + 6, 4, '#363c48', { noHi: true });
        p.rect(Math.round(cx), 10, 1, 12, GOLD);
        p.sEll(Math.round(cx), 18, 2, 2, GOLD);
        for (const y of [88, 128, 168]) bWindow(p, x0 + 10, y, 16, 26, { arch: true, trim: TRIM });
      }
      // 主楼：三层，孟莎式屋顶（很陡的一圈，上面平）
      bPlaster(p, 98, 66, 76, 134, WALL);
      for (const x of [98, 168]) for (let y = 66; y < 200; y += 8) p.sRect(x + ((y / 8) % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
      const inMansard = (x, y) => y >= 34 && y < 68 && x >= 102 - ((y - 34) / 34) * 10 && x <= 169 + ((y - 34) / 34) * 10;
      bShingles(p, inMansard, 34, 68, ROOF, 5, 2);
      p.sRect(100, 30, 72, 5, '#363c48', { noHi: true });
      p.sRect(90, 67, 92, 3, '#363c48', { noHi: true });
      for (const cx of [114, 136, 158]) {
        p.sRect(cx - 8, 40, 16, 22, TRIM);
        p.poly([[cx - 10, 41], [cx + 10, 41], [cx, 33]], ROOF);
        bWindow(p, cx - 5, 44, 10, 16, { trim: TRIM });
      }
      // 小圆亭
      p.sRect(124, 14, 24, 17, TRIM);
      for (const x of [127, 135, 143]) p.rect(x, 17, 2, 12, '#7fb6d8');
      p.sEll(136, 13, 13, 6, ROOF);
      p.rect(136, 0, 1, 8, GOLD);
      p.sEll(136, 4, 2, 2, GOLD);
      p.sRect(104, 114, 64, 3, TRIM, { noHi: true });
      p.sRect(104, 156, 64, 3, TRIM, { noHi: true });
      for (const x of [108, 128, 148]) bWindow(p, x, 76, 16, 30, { arch: true, trim: TRIM });
      for (const x of [108, 148]) bWindow(p, x, 122, 16, 28, { door: true, trim: TRIM });
      // 二楼正中的阳台和大窗
      bWindow(p, 126, 120, 20, 30, { door: true, trim: TRIM });
      p.sRect(104, 150, 64, 4, TRIM);
      for (let x = 106; x < 166; x += 4) p.rect(x, 144, 2, 6, TRIM);
      p.sRect(104, 142, 64, 3, TRIM);
      // 门廊：四根柱子撑着三角山花
      p.poly([[100, 166], [172, 166], [136, 152]], TRIM);
      p.poly([[106, 164], [166, 164], [136, 156]], '#efe4cc');
      p.sRect(100, 166, 72, 5, TRIM);
      for (const x of [104, 118, 150, 164]) {
        p.sRect(x, 171, 5, 29, TRIM, { noHi: true });
        p.rect(x - 1, 171, 7, 2, ramp(TRIM).mid);
      }
      bDoor(p, 136, 200, 24, 26, '#5a3a26', TRIM, true);
      // 大台阶
      p.sRect(104, 210, 64, 4, '#d8d0c2');
      p.sRect(110, 214, 52, 4, '#c8c0b2');
      for (const [x0, x1] of [[42, 98], [174, 230]]) {
        p.sRect(x0, 194, x1 - x0, 6, '#6e8a52');
        for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 194 + ((x * 3) % 3), ['#e85d75', '#f6d35b', '#ffffff', '#9b7fd1'][(x / 3) % 4 | 0]);
      }
    } },
    // 两层小楼：11 格宽，蓝灰色的墙板、四坡屋顶带老虎窗，门口一个门廊，楼上是阳台
    house2: { w: 176, h: 176, tw: 11, th: 4, draw(p) {
      const WALL = '#b7c9d6';
      const TRIM = '#f4efe4';
      const ROOF = '#5c6b85';
      p.ell(88, 173, 90, 3.5, 'rgba(30,25,15,.28)');
      bStone(p, 130, 0, 12, 34, '#a8503c', true);
      bStone(p, 10, 156, 156, 12, '#9d978c');
      bPlanks(p, 12, 60, 152, 96, WALL);
      p.sRect(10, 104, 156, 4, TRIM, { noHi: true });
      p.sRect(10, 58, 5, 98, TRIM, { noHi: true });
      p.sRect(161, 58, 5, 98, TRIM, { noHi: true });
      p.rect(15, 60, 146, 3, 'rgba(40,40,60,.25)');
      // 四坡屋顶
      const top = 8;
      const eave = 60;
      const inRoof = (x, y) => y >= top && y < eave && x >= 44 - ((y - top) / (eave - top)) * 46 && x <= 131 + ((y - top) / (eave - top)) * 46;
      bShingles(p, inRoof, top, eave, ROOF, 6, 0);
      p.rect(44, top - 2, 88, 3, ramp(ROOF).lo);
      p.sRect(-1, eave - 1, 178, 3, '#4a5468', { noHi: true });
      // 老虎窗
      p.poly([[70, 48], [106, 48], [88, 24]], TRIM);
      p.poly([[73, 48], [103, 48], [88, 27]], ramp(ROOF).mid);
      bWindow(p, 80, 34, 16, 14, {});
      // 楼上：两扇窗、中间是通阳台的门
      bWindow(p, 24, 70, 22, 22, { shutter: '#3e5a7a' });
      bWindow(p, 130, 70, 22, 22, { shutter: '#3e5a7a' });
      bWindow(p, 78, 68, 20, 30, { door: true });
      // 门廊屋顶兼阳台，栏杆
      p.sRect(60, 98, 56, 6, TRIM);
      for (let x = 62; x < 114; x += 4) p.rect(x, 90, 2, 8, TRIM);
      p.sRect(60, 88, 56, 3, TRIM);
      p.sRect(62, 104, 4, 52, TRIM, { noHi: true });
      p.sRect(110, 104, 4, 52, TRIM, { noHi: true });
      // 楼下：门和两扇窗
      bDoor(p, 88, 156, 22, 34, '#7a3a32', TRIM);
      bWindow(p, 24, 118, 22, 22, { shutter: '#3e5a7a', box: true });
      bWindow(p, 130, 118, 22, 22, { shutter: '#3e5a7a', box: true });
      p.sRect(116, 128, 3, 5, '#3a3a42');
      p.set(117, 130, '#ffe28a');
      p.sRect(70, 168, 36, 4, '#b9b2a6');
      p.sRect(66, 156, 44, 4, '#c8c0b2');
    } },
    // 别墅：13 格宽，中间两层、两边一层；奶白色的墙、陶土瓦屋顶、门前四根柱子，二楼拱形窗和阳台
    villa: { w: 208, h: 192, tw: 13, th: 5, draw(p) {
      const WALL = '#efe3cc';
      const STONE = '#c9bea8';
      const ROOF = '#c2603f';
      const TRIM = '#fbf7ef';
      p.ell(104, 189, 106, 3.5, 'rgba(30,25,15,.28)');
      bStone(p, 62, 6, 10, 32, '#a8503c', true);
      bStone(p, 136, 6, 10, 32, '#a8503c', true);
      bStone(p, 8, 172, 192, 12, '#a49c90');
      // 两边的厢房
      bPlaster(p, 10, 122, 50, 50, WALL);
      bPlaster(p, 148, 122, 50, 50, WALL);
      // 中间的主楼
      bPlaster(p, 56, 64, 96, 108, WALL);
      for (const x of [56, 146]) for (let y = 64; y < 172; y += 8) p.sRect(x + ((y / 8) % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
      p.sRect(56, 116, 96, 4, TRIM, { noHi: true });
      // 屋顶
      const roof = (x0, x1, top, eave, ridge0, ridge1) => {
        const inRoof = (x, y) => y >= top && y < eave && x >= ridge0 - ((y - top) / (eave - top)) * (ridge0 - x0) && x <= ridge1 + ((y - top) / (eave - top)) * (x1 - ridge1);
        bTiles(p, inRoof, top, eave, ROOF);
        p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
        p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, '#8a4630', { noHi: true });
      };
      roof(4, 64, 96, 124, 22, 46);
      roof(144, 204, 96, 124, 162, 186);
      roof(48, 160, 18, 66, 78, 130);
      // 二楼：三扇拱形窗、阳台
      for (const x of [66, 95, 124]) bWindow(p, x, 76, 18, 28, { arch: true, trim: TRIM });
      p.sRect(70, 110, 68, 4, TRIM);
      for (let x = 72; x < 136; x += 4) p.rect(x, 104, 2, 6, TRIM);
      p.sRect(70, 102, 68, 3, TRIM);
      // 门廊：四根柱子
      p.sRect(68, 120, 72, 8, TRIM);
      for (const x of [72, 86, 118, 132]) {
        p.sRect(x, 128, 6, 44, TRIM, { noHi: true });
        p.rect(x - 1, 128, 8, 2, ramp(TRIM).mid);
        p.rect(x - 1, 170, 8, 2, ramp(TRIM).mid);
      }
      bDoor(p, 104, 172, 26, 38, '#6e4a32', TRIM, true);
      // 厢房的窗
      for (const x of [18, 38, 154, 174]) bWindow(p, x, 134, 16, 24, { arch: true, trim: TRIM, box: true });
      // 台阶和花坛
      p.sRect(80, 184, 48, 4, '#d8d0c2');
      p.sRect(84, 188, 40, 4, '#c8c0b2');
      for (const [x0, x1] of [[12, 56], [152, 196]]) {
        p.sRect(x0, 166, x1 - x0, 6, '#6e8a52');
        for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 166 + ((x * 3) % 3), ['#e85d75', '#f6d35b', '#ffffff', '#9b7fd1'][(x / 3) % 4 | 0]);
      }
    } },
    // 农舍：9 格宽，四坡屋顶，正中一个山墙对着门；木板墙、石头地基、两扇带百叶和花箱的窗户、门口两级台阶
    house: { w: 144, h: 128, tw: 9, th: 4, draw(p) {
      const WALL = '#d6a167';
      const WR = ramp(WALL);
      const TRIM = '#f1e2c2';
      const TR = ramp(TRIM);
      const ROOF = '#b9553f';
      const RR = ramp(ROOF);
      const STONE = '#9d978c';
      const SR = ramp(STONE);
      const WOOD = '#8a5a3b';
      p.ell(72, 125, 74, 3.2, 'rgba(30,25,15,.28)');
      // 石头地基
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
      // 木板墙
      for (let y = 62; y < 108; y++) {
        const k = (y - 62) % 5;
        p.rect(10, y, 124, 1, k === 0 ? WR.hi : k === 4 ? WR.lo : WALL);
      }
      for (let y = 63; y < 108; y += 5) for (let x = 18 + ((y / 5) % 3) * 13; x < 132; x += 39) p.set(x, y + 2, WR.mid);
      // 转角的竖木条
      p.sRect(8, 60, 5, 48, TRIM, { noHi: true });
      p.sRect(131, 60, 5, 48, TRIM, { noHi: true });
      // 屋檐下的影子
      p.rect(13, 62, 118, 4, 'rgba(60,30,15,.3)');
      // 四坡屋顶：上窄下宽的梯形，一排排瓦片
      const RT = 10;
      const RB = 62;
      const inMain = (x, y) => y >= RT && y < RB && x >= 24 - ((y - RT) / (RB - RT)) * 26 && x <= 119 + ((y - RT) / (RB - RT)) * 26;
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
      // 屋脊和两边的斜脊
      p.rect(24, RT - 2, 96, 3, RR.lo);
      p.rect(24, RT - 2, 96, 1, RR.hi);
      for (let y = RT; y < RB; y++) {
        const dx = ((y - RT) / (RB - RT)) * 26;
        p.set(Math.round(24 - dx), y, RR.lo);
        p.set(Math.round(24 - dx) + 1, y, RR.hi);
        p.set(Math.round(119 + dx), y, RR.lo);
      }
      // 砖烟囱（在屋顶后面）
      for (let y = 0; y < 22; y++)
        for (let x = 100; x < 111; x++) {
          const brick = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 2) % 5 === 0;
          p.set(x, y, brick ? '#7a3a2e' : y % 4 === 0 ? '#c46a50' : '#a8503c');
        }
      p.sRect(99, 0, 13, 3, '#8a847a');
      for (let y = RT; y < 22; y++) for (let x = 100; x < 111; x++) if (inMain(x, y + 4)) p.set(x, y, shingle(x, y, 0));
      // 正中的山墙：三角形，自己的封檐板，里面一扇小圆窗
      const GT = 14;
      const inGable = (x, y) => y >= GT && y < RB && Math.abs(x - 71.5) <= ((y - GT) / (RB - GT)) * 30 + 0.5;
      for (let y = GT; y < RB; y++) for (let x = 40; x < 104; x++) if (inGable(x, y)) p.set(x, y, shingle(x, y, 3));
      // 山墙正面是木板墙（下面一截）
      for (let y = 40; y < RB; y++) {
        const half = ((y - GT) / (RB - GT)) * 30 - 3;
        for (let x = Math.ceil(71.5 - half); x <= Math.floor(71.5 + half); x++) p.set(x, y, (y - 40) % 5 === 0 ? WR.hi : (y - 40) % 5 === 4 ? WR.lo : WALL);
      }
      for (let y = GT - 1; y < RB + 1; y++) {
        const half = ((y - GT) / (RB - GT)) * 30;
        for (const [dx, c] of [[0, TRIM], [1, TR.mid], [2, TR.lo]]) {
          p.set(Math.round(71.5 - half) + dx, y, c);
          p.set(Math.round(71.5 + half) - dx, y, dx === 0 ? TR.mid : c);
        }
      }
      p.rect(68, GT - 3, 8, 3, TR.mid);
      p.rect(69, GT - 3, 6, 1, TRIM);
      // 山墙上的小圆窗
      p.sEll(72, 31, 6, 6, TRIM);
      p.ell(72, 31, 4.2, 4.2, '#7fb6d8');
      p.ell(71, 30, 2, 2, '#a9d4ec');
      p.rect(72, 27, 1, 8, TRIM);
      p.rect(68, 31, 9, 1, TRIM);
      // 屋檐的木板
      p.sRect(-1, RB - 1, 146, 3, WOOD, { noHi: true });
      // 窗户：白框、十字窗棂、绿色百叶、花箱
      for (const wx of [27, 101]) {
        p.sRect(wx - 6, 72, 4, 19, '#5f8a52', { noHi: true });
        p.sRect(wx + 18, 72, 4, 19, '#5f8a52', { noHi: true });
        for (let y = 73; y < 90; y += 3) {
          p.rect(wx - 6, y, 4, 1, ramp('#5f8a52').lo);
          p.rect(wx + 18, y, 4, 1, ramp('#5f8a52').lo);
        }
        p.sRect(wx - 2, 70, 20, 22, TRIM);
        p.rect(wx + 1, 73, 14, 16, '#7fb6d8');
        p.rect(wx + 1, 73, 14, 3, '#a9d4ec');
        p.line(wx + 3, 87, wx + 11, 75, '#cdeaf8');
        p.line(wx + 4, 87, wx + 12, 75, '#cdeaf8');
        p.rect(wx + 8, 73, 1, 16, TRIM);
        p.rect(wx + 1, 80, 14, 1, TRIM);
        // 窗帘
        p.rect(wx + 1, 73, 2, 9, '#f4ece0');
        p.rect(wx + 13, 73, 2, 9, '#f4ece0');
        p.sRect(wx - 3, 93, 22, 4, WOOD);
        for (let i = 0; i < 9; i++) {
          const c = ['#e85d75', '#f6d35b', '#ef7fa0', '#ffffff', '#9b7fd1'][i % 5];
          p.set(wx - 1 + i * 2 + 1, 92, '#5f9e4f');
          p.set(wx - 1 + i * 2, 91, c);
          p.set(wx - 1 + i * 2 + 1, 91, c);
          p.set(wx - 1 + i * 2, 92, '#4c8a36');
        }
      }
      // 门：门框、两扇门板、把手；上面一个小雨棚和一盏灯
      p.sRect(60, 74, 24, 34, TRIM, { noHi: true });
      p.sRect(63, 77, 18, 31, WOOD);
      for (const [x, y] of [[65, 80], [73, 80], [65, 93], [73, 93]]) p.sRect(x, y, 6, 11, ramp(WOOD).mid, { noHi: true });
      p.rect(72, 77, 1, 31, ramp(WOOD).lo);
      p.rect(77, 92, 2, 2, '#f2c14e');
      p.rect(67, 92, 2, 2, '#f2c14e');
      p.poly([[54, 74], [90, 74], [85, 67], [59, 67]], ROOF);
      for (let x = 60; x < 86; x += 5) p.rect(x, 68, 1, 6, RR.lo);
      p.rect(54, 73, 36, 1, RR.lo);
      p.rect(55, 74, 3, 8, WOOD);
      p.rect(86, 74, 3, 8, WOOD);
      p.sRect(90, 79, 4, 6, '#3a3a42');
      p.rect(91, 81, 2, 2, '#ffe28a');
      // 门口的台阶和门垫
      p.sRect(56, 119, 32, 4, '#b9b2a6');
      p.sRect(59, 123, 26, 4, '#a8a196');
      p.rect(64, 106, 16, 2, '#a85a3a');
      // 墙根的小花丛
      for (const [x, c] of [[16, '#ef7fa0'], [20, '#f6d35b'], [124, '#9b7fd1'], [128, '#e85d75']]) {
        p.sEll(x, 105, 3, 2.5, '#5f9e4f');
        p.set(x - 1, 103, c);
        p.set(x + 1, 104, c);
      }
    } },
    // 家具
    bed: { w: 32, h: 32, tw: 2, th: 2, room: true, draw(p) {
      p.sRect(1, 2, 30, 6, '#8a5a3b');
      p.sRect(2, 8, 28, 22, '#f4ece0');
      p.sRect(2, 15, 28, 15, '#5a8fe0');
      for (let y = 18; y < 30; y += 4) p.rect(2, y, 28, 1, ramp('#5a8fe0').mid);
      p.sRect(5, 9, 9, 5, '#ffffff');
      p.sRect(18, 9, 9, 5, '#ffffff');
      p.rect(1, 29, 30, 2, ramp('#8a5a3b').lo);
    } },
    rug: { w: 32, h: 32, tw: 2, th: 2, room: true, flat: true, draw(p) {
      p.ell(16, 16, 15, 12, '#c8664a');
      p.ell(16, 16, 12, 9, '#e8b07a');
      p.ell(16, 16, 8, 5.5, '#c8664a');
      p.ell(16, 16, 4, 2.5, '#f6d35b');
    } },
    table: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(1, 2, 30, 6, '#b07a4a');
      p.sRect(3, 8, 3, 7, '#8a5a3b');
      p.sRect(26, 8, 3, 7, '#8a5a3b');
      p.sRect(12, 0, 6, 3, '#fbf7ef');
      p.set(14, 0, '#ef7fa0');
    } },
    chair: { w: 16, h: 16, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(3, 0, 10, 7, '#b07a4a');
      p.sRect(2, 7, 12, 3, '#c8664a');
      p.sRect(3, 10, 2, 5, '#8a5a3b');
      p.sRect(11, 10, 2, 5, '#8a5a3b');
    } },
    bookshelf: { w: 16, h: 32, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(0, 0, 16, 31, '#8a5a3b');
      const cols = ['#c8463a', '#3b6ea8', '#f2c14e', '#6aa35a', '#9b7fd1', '#e8793a'];
      for (const y of [3, 11, 19]) {
        p.rect(2, y, 12, 7, '#5a3a28');
        for (let i = 0; i < 6; i++) p.sRect(2 + i * 2, y + (i % 3 === 1 ? 1 : 0), 2, 7 - (i % 3 === 1 ? 1 : 0), cols[(i + y) % 6], { noHi: true });
      }
      p.rect(2, 27, 12, 3, '#5a3a28');
    } },
    floorlamp: { w: 16, h: 32, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(7, 10, 2, 19, '#6a5a4a');
      p.sRect(4, 28, 8, 3, '#6a5a4a');
      p.poly([[3, 10], [13, 10], [11, 2], [5, 2]], '#f6dca0');
      p.rect(4, 9, 8, 1, ramp('#f6dca0').mid);
    } },
    plant: { w: 16, h: 24, tw: 1, th: 1, room: true, draw(p) {
      p.sRect(4, 15, 8, 8, '#c8664a');
      p.rect(3, 15, 10, 2, ramp('#c8664a').hi);
      canopy(p, [[8, 9, 5, 5], [4, 7, 3, 3], [12, 6, 3, 3], [8, 3, 3, 3]], '#5f9e4f');
    } },
    sofa: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(2, 1, 28, 7, '#7a9a8a');
      p.sRect(0, 5, 5, 10, '#7a9a8a');
      p.sRect(27, 5, 5, 10, '#7a9a8a');
      p.sRect(4, 8, 24, 6, '#8ab0a0');
      p.rect(15, 8, 1, 6, ramp('#8ab0a0').lo);
    } },
    desk: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(1, 4, 30, 5, '#8a5a3b');
      p.sRect(2, 9, 3, 6, '#6a4a32');
      p.sRect(22, 9, 8, 6, '#6a4a32');
      p.rect(24, 11, 4, 1, '#f2c14e');
      p.sRect(6, 0, 7, 4, '#fbf7ef');
      p.rect(7, 1, 5, 1, '#9b9488');
      p.sRect(17, 0, 3, 4, '#3b6ea8');
    } },
    fireplace: { w: 32, h: 32, tw: 2, th: 1, room: true, draw(p) {
      p.sRect(1, 2, 30, 29, '#a8a29a');
      for (let y = 6; y < 31; y += 5) p.rect(1, y, 30, 1, ramp('#a8a29a').mid);
      p.rect(7, 13, 18, 18, '#3a2a26');
      p.sEll(16, 27, 6, 4, '#f08a3a');
      p.sEll(16, 26, 3.5, 3, '#f6d35b');
      p.sRect(0, 0, 32, 3, '#8a5a3b');
    } },
    painting: { w: 16, h: 16, tw: 1, th: 1, room: true, wall: true, draw(p) {
      p.sRect(1, 2, 14, 11, '#c49a6c');
      p.rect(3, 4, 10, 7, '#9fd0f0');
      p.rect(3, 8, 10, 3, '#7fb35a');
      p.sEll(10, 6, 1.6, 1.6, '#f6d35b');
    } },
    window: { w: 16, h: 16, tw: 1, th: 1, room: true, wall: true, draw(p) {
      p.sRect(1, 1, 14, 13, '#8a5a3b');
      p.rect(2, 2, 12, 11, '#9fd0f0');
      p.rect(2, 2, 4, 3, '#e8f6ff');
      p.rect(7, 2, 1, 11, '#8a5a3b');
      p.rect(2, 7, 12, 1, '#8a5a3b');
    } },
  };

  // ================= 物品图标（16×16） =================

  const ICONS = {
    kibble(p) {
      p.sEll(8, 11.5, 6.5, 3, '#c8463a');
      p.ell(8, 10, 5.5, 1.8, '#8a5a3b');
      for (const [x, y] of [[5, 9], [7, 8], [9, 9], [11, 8], [6, 10], [10, 10], [8, 9]]) {
        p.set(x, y, '#c08850');
        p.set(x + 1, y, '#a06a3a');
      }
      p.rect(3, 12, 10, 1, ramp('#c8463a').lo);
    },
    tin(p) {
      p.sRect(4, 5, 9, 9, '#c0c6cc');
      p.rect(4, 7, 9, 4, '#e8793a');
      p.sEll(8.5, 9, 2, 1.5, '#fbf7ef');
      p.set(8, 9, '#e85d75');
      p.sEll(8.5, 5, 4.5, 1.6, '#dfe4e8');
      p.rect(6, 4, 4, 1, '#9aa2aa');
    },
    fishfood(p) {
      p.sRect(4, 3, 8, 11, '#5aa2dc');
      p.rect(4, 3, 8, 2, '#3a74b0');
      p.sEll(8, 9, 2.6, 1.6, '#f0742e');
      p.poly([[10, 9], [12, 7.5], [12, 10.5]], '#f0742e');
      p.set(7, 9, INK);
      for (const [x, y] of [[13, 13], [14, 11], [13, 15]]) p.set(x, y, '#e0b050');
    },
    water(p) {
      p.poly([[8, 1], [3, 9], [13, 9]], '#5a9ad0');
      p.sEll(8, 10, 5, 4.5, '#5a9ad0');
      p.rect(6, 7, 2, 3, '#d8f0ff');
    },
    can(p) {
      p.sRect(3, 6, 9, 8, '#7a9ab8');
      p.line(12, 8, 15, 4, '#7a9ab8');
      p.line(12, 9, 15, 5, ramp('#7a9ab8').mid);
      p.rect(4, 3, 7, 1, '#5a7a98');
      p.rect(4, 3, 1, 4, '#5a7a98');
      p.rect(10, 3, 1, 4, '#5a7a98');
    },
    fert(p) {
      p.sRect(3, 4, 10, 11, '#c49a6c');
      p.rect(3, 3, 10, 2, ramp('#c49a6c').lo);
      p.sEll(8, 9.5, 3, 3, '#6aa35a');
      p.rect(8, 7, 1, 4, '#4f8a43');
    },
    medicine(p) {
      p.sRect(4, 5, 8, 10, '#fbf7ef');
      p.sRect(5, 2, 6, 3, '#c8463a');
      p.rect(7, 8, 2, 5, '#e85d75');
      p.rect(5, 10, 6, 1, '#e85d75');
    },
    ball(p) {
      p.sEll(8, 8.5, 6, 6, '#e85d75');
      p.rect(2, 8, 12, 1, '#fbf7ef');
      p.rect(8, 3, 1, 11, '#f6d35b');
    },
    yarn(p) {
      p.sEll(8, 9, 6, 5.5, '#9b7fd1');
      for (let k = 4; k < 13; k += 3) p.line(k, 5, k + 3, 13, ramp('#9b7fd1').lo);
      p.line(13, 11, 15, 15, '#9b7fd1');
    },
    bone(p) {
      p.sRect(4, 7, 8, 3, '#f4ece0');
      for (const [x, y] of [[3, 6], [3, 10], [12, 6], [12, 10]]) p.sEll(x + 0.5, y + 0.5, 2, 2, '#f4ece0');
    },
    fishtoy(p) {
      p.sEll(7, 8.5, 5, 3.5, '#5a9ad0');
      p.poly([[11, 8.5], [15, 5], [15, 12]], '#5a9ad0');
      p.set(4, 7, INK);
      p.rect(6, 6, 2, 1, '#d8f0ff');
    },
    treat(p) {
      p.sEll(8, 9, 6, 5, '#d8a060');
      for (const [x, y] of [[6, 7], [10, 8], [7, 11]]) p.set(x, y, '#6b4a2b');
    },
    seed(p, c) {
      p.sRect(3, 2, 10, 13, '#efe4cc');
      p.rect(3, 2, 10, 2, ramp('#efe4cc').mid);
      p.sEll(8, 9, 3, 3, c || '#e85d75');
      p.set(8, 9, '#f6d35b');
      p.rect(8, 12, 1, 2, '#4f8a43');
    },
    // 体力：一道闪电
    bolt(p) {
      p.poly([[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6], [11, 1]], '#f2c14e');
      p.line(9, 2, 5, 8, '#fff2a8');
    },
    // 材料：一捆木头、一堆石块
    wood(p) {
      const W = '#a8713f';
      for (const [y, x0, x1] of [[10, 2, 12], [6, 4, 14]]) {
        p.sRect(x0, y, x1 - x0, 4, W, { noHi: true });
        p.rect(x0 + 1, y, x1 - x0 - 2, 1, ramp(W).hi);
        p.sEll(x1, y + 2, 1.9, 1.9, '#d9b07a');
        p.set(x1, y + 2, '#a8763e');
      }
      p.rect(7, 6, 1, 8, '#6a4630');
    },
    stone(p) {
      p.sEll(5.5, 10.5, 4, 3, '#a39d94');
      p.sEll(11, 11, 3.6, 2.8, '#948e86');
      p.sEll(8.5, 6.5, 3.4, 2.8, '#b0aaa0');
      p.set(7, 5, '#e4e0d8');
      p.set(4, 9, '#d4d0c8');
    },
    scythe(p) {
      // 长木柄，顶上一把往左弯的刀，柄中间一个握把
      p.line(12, 15, 10, 3, '#8a5a3b');
      p.line(13, 15, 11, 3, ramp('#8a5a3b').lo);
      p.rect(9, 9, 5, 2, '#6a4630');
      for (const [x, y] of [[10, 2], [9, 2], [8, 2], [7, 2], [6, 3], [5, 3], [4, 4], [3, 5], [2, 6], [1, 8]]) p.set(x, y, '#dfe6ec');
      for (const [x, y] of [[9, 3], [8, 3], [7, 3], [6, 4], [5, 4], [4, 5], [3, 6], [2, 7]]) p.set(x, y, '#9aa4ae');
      p.set(10, 3, '#5a5f66');
    },
    pickaxe(p) {
      p.line(4, 15, 10, 4, '#8a5a3b');
      p.line(5, 15, 11, 4, ramp('#8a5a3b').lo);
      // 两头尖的镐头
      for (let i = 0; i < 6; i++) {
        p.set(10 - i, 3 + Math.floor(i / 2), '#a8b0b8');
        p.set(10 + i, 3 + Math.floor(i / 2), '#a8b0b8');
      }
      p.rect(8, 2, 5, 2, '#c8d0d8');
    },
    axe(p) {
      p.line(4, 15, 10, 3, '#8a5a3b');
      p.line(5, 15, 11, 3, ramp('#8a5a3b').lo);
      p.poly([[9, 2], [14, 1], [15, 6], [11, 7]], '#a8b0b8');
      p.line(14, 1, 15, 6, '#d8dee4');
    },
    hoe(p) {
      p.line(2, 14, 10, 4, '#8a5a3b');
      p.line(3, 14, 11, 4, ramp('#8a5a3b').lo);
      p.poly([[8, 2], [14, 2], [15, 5], [13, 7], [11, 5]], '#a8b0b8');
      p.line(9, 2, 13, 2, '#d8dee4');
    },
    shovel(p) {
      p.line(3, 13, 10, 6, '#8a5a3b');
      p.line(4, 13, 11, 6, ramp('#8a5a3b').lo);
      p.poly([[9, 4], [13, 1], [15, 3], [12, 7]], '#a8b0b8');
    },
    hand(p) {
      p.sEll(8, 10, 4.5, 4.5, '#f3c9a5');
      for (const x of [4, 6, 8, 10]) p.sRect(x, 3 + (x === 4 || x === 10 ? 2 : 0), 2, 6, '#f3c9a5', { noHi: true });
    },
    bag(p) {
      p.sRect(2, 5, 12, 10, '#b07a4a');
      p.rect(2, 8, 12, 1, ramp('#b07a4a').lo);
      p.sRect(6, 7, 4, 3, '#f2c14e');
      p.line(4, 5, 6, 1, '#8a5a3b');
      p.line(12, 5, 10, 1, '#8a5a3b');
      p.rect(6, 1, 5, 1, '#8a5a3b');
    },
    coin(p) {
      p.sEll(8, 8, 6, 6, '#f2c14e');
      p.ell(8, 8, 3.5, 3.5, ramp('#f2c14e').mid);
      p.rect(7, 5, 2, 6, ramp('#f2c14e').hi);
    },
  };

  // 外圈树林用的树：和花园里种的树不一样，颜色更沉，不带果子
  const forestCache = new Map();
  function forestTree(kind) {
    if (forestCache.has(kind)) return forestCache.get(kind);
    const q = kind === 'bush'
      ? build(16, 16, (p) => canopy(p, [[8, 10, 7, 5.5], [5, 7, 4, 4], [11, 6, 4.5, 4]], '#3f7d3c'))
      : build(48, 72, (p) => drawTree(p, forestCacheSpecs[kind] || forestCacheSpecs.round, 1.5));
    forestCache.set(kind, q);
    return q;
  }

  // ================= 整块地面 =================
  // 花园的地面不按格子贴图，而是整块画：草地用噪声做出自然的深浅，
  // 小路、菜地的边缘不规则地融进草里，四周是一圈树林和灌木，画面像一个小世界

  function hash2(x, y, seed) {
    let h = x * 374761393 + y * 668265263 + seed * 2246822519;
    h = (h ^ (h >>> 13)) * 1274126177;
    h ^= h >>> 16;
    return ((h >>> 0) % 10000) / 10000;
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

  const GRASS = ['#4c8a36', '#62a443', '#6fb24a', '#7cbf52', '#92d266'];
  const GRASS_SET = new Set(GRASS);
  const DIRT = ['#b98b5c', '#c99b69', '#d6ab78', '#e2bb88'];
  const DIRT_SET = new Set(DIRT);
  const SOIL = ['#6a4630', '#7a5238', '#8a5e40'];
  const WET = ['#4a3022', '#56382a', '#634232'];
  // 浅水、中、深、最深、岸的影子
  const WATER = ['#78bdea', '#5aa2dc', '#4a8fcf', '#3f80c0', '#35699f'];

  // opts: w、h（格子数）、path、soil、wet（Set，"x,y"）、border（外圈几格是树林）、seed
  function terrain(o) {
    const T = 16;
    const W = o.w * T;
    const H = o.h * T;
    const p = new Pix(W, H);
    const seed = o.seed || 1;
    const has = (set, x, y) => set && set.has(x + ',' + y);
    // 小路：到最近的路格子的距离，边缘加一点噪声，看起来是踩出来的土路
    const pathAt = (px, py) => {
      const tx = Math.floor(px / T);
      const ty = Math.floor(py / T);
      if (!has(o.path, tx, ty)) return false;
      // 路格子的边：没有相邻路格子的那一边往里收一点
      const lx = px - tx * T;
      const ly = py - ty * T;
      const n = noise(px / 3, py / 3, seed + 5) * 3;
      if (!has(o.path, tx - 1, ty) && lx < 1 + n) return false;
      if (!has(o.path, tx + 1, ty) && T - 1 - lx < 1 + n) return false;
      if (!has(o.path, tx, ty - 1) && ly < 1 + n) return false;
      if (!has(o.path, tx, ty + 1) && T - 1 - ly < 1 + n) return false;
      return true;
    };
    // 池塘：有 pondFn 就按它画出弯弯曲曲的岸；没有就按格子并成一块，边缘圆一点
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
        // 草地底色：只有轻微的深浅变化，不要大块的色斑
        const v = fbm(x, y, seed);
        let c = v < 0.36 ? GRASS[1] : v < 0.66 ? GRASS[2] : GRASS[3];
        if (hash2(x, y, seed + 21) < 0.04) c = GRASS[3];
        if (waterAt(x, y)) {
          wmask[y * W + x] = 1;
          c = WATER[1];
        } else if (pathAt(x, y)) {
          const d = fbm(x * 1.6, y * 1.6, seed + 40);
          c = DIRT[Math.max(0, Math.min(3, Math.floor(d * 4.4 - 0.2)))];
          if (hash2(x, y, seed + 9) < 0.03) c = '#a07a52';
        }
        p.set(x, y, c);
      }
    // 池塘：岸边浅、中间深；北岸的土坎在水面投下一道影子；水面有几道波光
    let pond = null;
    if (o.water && o.water.size) {
      let x0 = W;
      let y0 = H;
      let x1 = 0;
      let y1 = 0;
      for (const k of o.water) {
        const [tx, ty] = k.split(',').map(Number);
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
      // 离岸边多远（最多 9 格像素）
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
          // 北岸的影子：上面几行是岸
          let up = 0;
          while (up < 4 && isW(x, y - up - 1)) up++;
          if (up < 4) c = up < 2 ? WATER[4] : WATER[3];
          p.set(x, y, c);
        }
      // 波光：短短的亮线，中间一点最亮
      for (let gy = y0; gy < y1; gy += 7)
        for (let gx = x0; gx < x1; gx += 11) {
          if (hash2(gx, gy, seed + 83) > 0.3) continue;
          const len = 2 + Math.floor(hash2(gx, gy, seed + 84) * 3);
          const x = gx + Math.floor(hash2(gx, gy, seed + 85) * 6);
          const y = gy + Math.floor(hash2(gx, gy, seed + 86) * 4);
          let ok = true;
          for (let i = -1; i <= len && ok; i++) if (!isW(x + i, y) || !isW(x + i, y - 4) || !isW(x + i, y + 2)) ok = false;
          if (!ok) continue;
          for (let i = 0; i < len; i++) p.set(x + i, y, '#a6d6f4');
          p.set(x + Math.floor(len / 2), y, '#e4f5ff');
        }
      // 岸：贴着水一圈深色湿泥，外面一圈浅沙，沙上有几颗小石子
      const shore = [];
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          if (isW(x, y)) continue;
          let near = 0;
          for (let dy = -2; dy <= 2 && near < 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isW(x + dx, y + dy)) near = Math.max(near, 3 - Math.max(Math.abs(dx), Math.abs(dy)));
          if (near) shore.push([x, y, near]);
        }
      for (const [x, y, n] of shore) {
        let c = n === 2 ? '#7a6a4a' : '#cdb98a';
        if (n === 1 && hash2(x, y, seed + 87) < 0.12) c = '#b7a274';
        if (n === 1 && hash2(x, y, seed + 88) < 0.04) c = '#e6d6a8';
        p.set(x, y, c);
      }
    }
    // 小路边缘：土路下沿一行暗土，像低一点；挨着土的草叶压过来，颜色深一点
    for (let y = 1; y < H; y++)
      for (let x = 0; x < W; x++) {
        const isDirt = DIRT_SET.has(p.get(x, y - 1)) && GRASS_SET.has(p.get(x, y));
        if (isDirt) p.set(x, y - 1, '#a3774e');
      }
    const fringe = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (!GRASS_SET.has(p.get(x, y))) continue;
        const d = DIRT_SET.has(p.get(x, y - 1)) || DIRT_SET.has(p.get(x - 1, y)) || DIRT_SET.has(p.get(x + 1, y)) || DIRT_SET.has(p.get(x, y + 1));
        if (d) fringe.push([x, y]);
      }
    for (const [x, y] of fringe) p.set(x, y, hash2(x, y, seed + 90) < 0.5 ? '#4c8a36' : '#58983e');
    // 草叶：每格几簇小草，颜色只比脚下的草深一档、叶尖亮一档，看着细而不花
    const gi = (c) => GRASS.indexOf(c);
    const shade = (c, d) => GRASS[Math.max(0, Math.min(4, gi(c) + d))];
    const isG = (x, y) => GRASS_SET.has(p.get(x, y));
    for (let ty = 0; ty < o.h; ty++)
      for (let tx = 0; tx < o.w; tx++) {
        const n = 5 + Math.floor(hash2(tx, ty, seed + 50) * 3);
        for (let k = 0; k < n; k++) {
          const x = tx * T + 2 + Math.floor(hash2(tx * 7 + k, ty, seed + 51) * 12);
          const y = ty * T + 3 + Math.floor(hash2(tx, ty * 7 + k, seed + 52) * 12);
          if (!isG(x, y) || !isG(x - 2, y) || !isG(x + 2, y) || !isG(x, y - 3)) continue;
          const c0 = p.get(x, y);
          const dk = shade(c0, -1);
          const lt = shade(c0, 1);
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
    // 一丛丛高草：五六根叶子，底下一道阴影
    const bx0 = (o.border || 0) * T;
    const clumps = Math.floor(((o.w - 2 * (o.border || 0)) * (o.h - 2 * (o.border || 0))) / 6);
    for (let k = 0; k < clumps; k++) {
      const x = bx0 + 6 + Math.floor(hash2(k, 31, seed + 54) * (W - 2 * bx0 - 12));
      const y = bx0 + 9 + Math.floor(hash2(k, 32, seed + 54) * (H - 2 * bx0 - 12));
      let ok = true;
      for (let dy = -9; dy <= 2 && ok; dy++) for (let dx = -6; dx <= 6; dx++) if (!isG(x + dx, y + dy)) { ok = false; break; }
      if (!ok) continue;
      for (let dx = -4; dx <= 4; dx++) p.set(x + dx, y + 1, Math.abs(dx) < 4 ? GRASS[0] : shade(p.get(x + dx, y + 1), -1));
      for (const i of [-4, -2, 0, 2, 4]) {
        const h = 4 + Math.floor(hash2(k, i + 40, seed + 55) * 3) + (i === 0 ? 2 : Math.abs(i) === 2 ? 1 : 0);
        const lean = i < 0 ? -1 : i > 0 ? 1 : 0;
        for (let j = 0; j < h; j++) {
          const px = x + i + (j > h / 2 ? lean : 0);
          p.set(px, y - j, j < 1 ? '#3f7a2e' : j < h - 2 ? '#5a9e3e' : '#8fcf5e');
          if (j > 0 && j < h - 2) p.set(px + 1, y - j, '#4c8a36');
        }
      }
    }
    // 睡莲和芦苇
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
          p.ell(cx, cy, rx, ry, '#4f9a3a');
          p.ell(cx - 0.6, cy - 0.5, rx - 1, ry - 0.8, '#6fbb4a');
          // 叶子上的缺口
          p.set(cx + 1, cy, WATER[2]);
          p.set(cx + 2, cy, WATER[2]);
          if (big) p.set(cx + 3, cy, WATER[2]);
          if (pads % 2 === 0) {
            p.set(cx - 1, cy - 2, '#f29ac0');
            p.set(cx - 2, cy - 1, '#f29ac0');
            p.set(cx, cy - 1, '#f29ac0');
            p.set(cx - 1, cy - 1, '#fde3ee');
            p.set(cx - 1, cy - 3, '#e46f9e');
          }
          pads++;
        }
      // 芦苇：长在岸边的草里，几根一丛，顶上一个棕色的穗
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
            for (let i = 0; i < h; i++) p.set(sx, y - i, i < 2 ? '#3a6e2a' : '#4f8c34');
            p.set(sx - 1, y - h + 4, '#6fae46');
            if (k !== 1) {
              p.rect(sx, y - h - 2, 1, 3, '#7a4a2a');
              p.set(sx, y - h - 3, '#4f8c34');
            }
          }
          reeds++;
          x += 14;
        }
    }
    // 零星的小野花
    for (let k = 0; k < (W * H) / 1400; k++) {
      const x = Math.floor(hash2(k, 3, seed + 60) * W);
      const y = Math.floor(hash2(k, 4, seed + 60) * H);
      if (!GRASS_SET.has(p.get(x, y))) continue;
      const c = ['#fbf7ef', '#f6d35b', '#ef9ab8'][k % 3];
      p.set(x, y - 1, c);
      p.set(x - 1, y, c);
      p.set(x + 1, y, c);
      p.set(x, y + 1, c);
      p.set(x, y, '#f2c14e');
    }
    // 菜地：挨着的格子连成一整块地，一道道垄沟；上沿是坑里的影子，下沿是亮一点的土埂；浇过水更深
    const bed = new Uint8Array(W * H);
    const anyBed = (x, y) => has(o.soil, x, y) || has(o.wet, x, y);
    for (const set of [o.soil, o.wet])
      if (set)
        for (const key of set) {
          const [tx, ty] = key.split(',').map(Number);
          const wetBed = set === o.wet;
          const pal = wetBed ? WET : SOIL;
          const L = !anyBed(tx - 1, ty);
          const R = !anyBed(tx + 1, ty);
          const U = !anyBed(tx, ty - 1);
          const D = !anyBed(tx, ty + 1);
          for (let y = 0; y < T; y++)
            for (let x = 0; x < T; x++) {
              if ((L && x < 1) || (R && x > T - 2) || (U && y < 1) || (D && y > T - 2)) continue;
              if ((L && U && x + y < 3) || (R && U && T - 1 - x + y < 3) || (L && D && x + T - 1 - y < 3) || (R && D && T - 1 - x + T - 1 - y < 3)) continue;
              const X = tx * T + x;
              const Y = ty * T + y;
              const n = hash2(X, Y, seed + 70);
              let c = pal[1];
              if (Y % 4 === 2) c = n < 0.85 ? pal[0] : pal[1];
              else if (Y % 4 === 3 && n < 0.45) c = pal[2];
              if (n > 0.95) c = pal[2];
              if (U && y === 1) c = wetBed ? '#2e1d15' : '#4a3022';
              else if (U && y === 2) c = pal[0];
              if (D && y === T - 2) c = wetBed ? '#7a5a44' : '#9a6b48';
              if ((L && x === 1) || (R && x === T - 2)) c = pal[0];
              p.set(X, Y, c);
              bed[Y * W + X] = 1;
            }
        }
    // 地边上的草压过来一点，颜色深一档
    const bedEdge = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (bed[y * W + x] || !isG(x, y)) continue;
        if (bed[(y - 1) * W + x] || bed[(y + 1) * W + x] || bed[y * W + x - 1] || bed[y * W + x + 1]) bedEdge.push([x, y]);
      }
    for (const [x, y] of bedEdge) p.set(x, y, shade(p.get(x, y), -1));
    // 外圈：一层层真正的树围起来，后排暗、前排亮，树干从树冠下面露出来
    const b = o.border || 0;
    if (b) {
      const open = (x, y) => o.exits && has(o.exits, Math.floor(x / T), Math.floor(y / T));
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const inside = x >= b * T && x < W - b * T && y >= b * T && y < H - b * T;
          // 出口两边留一点草地，不要直接是黑乎乎的树林
          const near = open(x, y) || open(x - 10, y) || open(x + 10, y) || open(x, y - 10) || open(x, y + 10);
          if (!inside && !near) p.set(x, y, '#22402a');
        }
      const kinds = ['round', 'pine', 'round2', 'round', 'pine', 'round3'];
      const trees = [];
      const add = (cx, base, dark, k) => trees.push({ cx: Math.round(cx), base: Math.round(base), dark, kind: kinds[k % kinds.length] });
      let k = 0;
      // 树是 48×72 的；上边三排，越往前越亮
      for (let x = -16; x < W + 24; x += 24) add(x + hash2(x, 1, seed) * 8, b * T - 26 + hash2(x, 2, seed) * 5, 0.5, k++);
      for (let x = -6; x < W + 24; x += 27) add(x + hash2(x, 3, seed) * 8, b * T - 12 + hash2(x, 4, seed) * 5, 0.28, k++);
      for (let x = 4; x < W + 24; x += 31) add(x + hash2(x, 5, seed) * 8, b * T + 1 + hash2(x, 6, seed) * 3, 0, k++);
      // 下边：两排，只露出树冠上半截
      for (let x = -8; x < W + 24; x += 25) add(x + hash2(x, 7, seed) * 8, H + 26 + hash2(x, 8, seed) * 5, 0.2, k++);
      for (let x = 6; x < W + 24; x += 29) add(x + hash2(x, 9, seed) * 8, H + 40 + hash2(x, 10, seed) * 4, 0, k++);
      // 左右：两列
      for (let y = b * T + 10; y < H + 30; y += 18) {
        add(0 + hash2(y, 11, seed) * 4, y + hash2(y, 12, seed) * 5, 0.35, k++);
        add(b * T - 18 + hash2(y, 13, seed) * 3, y + 9 + hash2(y, 14, seed) * 5, 0, k++);
        add(W - hash2(y, 15, seed) * 4, y + hash2(y, 16, seed) * 5, 0.35, k++);
        add(W - b * T + 18 - hash2(y, 17, seed) * 3, y + 9 + hash2(y, 18, seed) * 5, 0, k++);
      }
      // 出口：挡住小路的树不要
      const blocks = (t) => {
        for (let y = t.base - 66; y <= t.base + 2; y += 3) for (let x = t.cx - 22; x <= t.cx + 22; x += 3) if (open(x, y)) return true;
        return false;
      };
      const SHADOWC = '#1e2a16';
      const mixed = new Map();
      const darkC = (c, t) => {
        const key = c + t;
        if (!mixed.has(key)) mixed.set(key, mix(c, '#1b3324', t));
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
            if (c[0] !== '#') {
              const u = p.get(X, Y);
              if (u && u[0] === '#') p.set(X, Y, mix(u, SHADOWC, 0.3));
              continue;
            }
            p.set(X, Y, t.dark ? darkC(c, t.dark) : c);
          }
      }
      // 树挪开以后露出的空当（多半在出口两边）：补上矮灌木
      const FILL = '#22402a';
      const bush = forestTree('bush');
      const exitRects = [...(o.exits || [])].map((k) => k.split(',').map(Number));
      const nearExit = (x, y) => exitRects.some(([tx, ty]) => x > tx * T - 56 && x < tx * T + T + 56 && y > ty * T - 56 && y < ty * T + T + 56);
      for (let y = 4; y < H + 4; y += 7)
        for (let x = 4; x < W + 4; x += 8) {
          if (p.get(x, y) !== FILL || !nearExit(x, y)) continue;
          const ox = x - 8;
          const oy = y - 10;
          let hit = false;
          for (let yy = oy; yy < oy + 16 && !hit; yy += 2) for (let xx = ox; xx < ox + 16; xx += 2) if (open(xx, yy)) { hit = true; break; }
          if (hit) continue;
          p.blit(bush, ox, oy, hash2(x, y, seed + 99) < 0.5);
        }
      // 树林在草地上投下的影子
      for (let y = b * T; y < b * T + 6; y++)
        for (let x = b * T; x < W - b * T; x++) {
          const c = p.get(x, y);
          if (GRASS_SET.has(c) && (y < b * T + 3 || hash2(x, y, seed + 98) < 0.5)) p.set(x, y, GRASS[Math.max(0, GRASS.indexOf(c) - 2)]);
        }
    }
    return p.toCanvas();
  }

  // ================= 池塘的形状 =================
  // 格子坐标（可以带小数）。一大一小两个椭圆连成一片，左下边一个小湾，岸线再加一点起伏，看着像天然的池塘
  function pondInside(x, y) {
    const e = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    const f = Math.min(e(10.5, 36.4, 7.6, 4.3), e(15.4, 33.4, 3.7, 2.9), e(5.3, 39.3, 3.4, 2.5));
    return f < 1 + (noise(x * 0.9, y * 0.9, 77) - 0.5) * 0.36;
  }

  // ================= 花园外面的树林 =================
  // 拉远看、画面比地图大的时候，地图外面一整片都是树：back 铺在最底下；
  // front 是贴着地图四边的一圈树，画在地面上面，盖住地图边上被切开的树冠。出口的小路一直通进树林里
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
      const c = document.createElement('canvas');
      c.width = CW;
      c.height = CH;
      return c;
    };
    const back = mk();
    const front = mk();
    const bx = back.getContext('2d');
    const fx = front.getContext('2d');
    bx.fillStyle = '#1d3826';
    bx.fillRect(0, 0, CW, CH);
    // 出口外面的林间小路：一条土路，两边一点草
    const ex = [...(o.exits || [])].map((k) => k.split(',').map(Number));
    const span = (list) => (list.length ? [Math.min(...list), Math.max(...list)] : null);
    const cuts = [];
    const west = span(ex.filter(([x]) => x < bd).map(([, y]) => y));
    const east = span(ex.filter(([x]) => x >= o.w - bd).map(([, y]) => y));
    const north = span(ex.filter(([, y]) => y < bd).map(([x]) => x));
    const south = span(ex.filter(([, y]) => y >= o.h - bd).map(([x]) => x));
    if (west) cuts.push({ x0: 0, x1: m + b, y0: m + west[0] * T - 10, y1: m + (west[1] + 1) * T + 10, a: m + west[0] * T, z: m + (west[1] + 1) * T, along: 'x' });
    if (east) cuts.push({ x0: m + W - b, x1: CW, y0: m + east[0] * T - 10, y1: m + (east[1] + 1) * T + 10, a: m + east[0] * T, z: m + (east[1] + 1) * T, along: 'x' });
    if (north) cuts.push({ x0: m + north[0] * T - 10, x1: m + (north[1] + 1) * T + 10, y0: 0, y1: m + b, a: m + north[0] * T, z: m + (north[1] + 1) * T, along: 'y' });
    if (south) cuts.push({ x0: m + south[0] * T - 10, x1: m + (south[1] + 1) * T + 10, y0: m + H - b, y1: CH, a: m + south[0] * T, z: m + (south[1] + 1) * T, along: 'y' });
    for (const c of cuts) {
      const p = new Pix(c.x1 - c.x0, c.y1 - c.y0);
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++) {
          const X = c.x0 + x;
          const Y = c.y0 + y;
          const across = c.along === 'x' ? Y : X;
          const n = (hash2(X, Y, seed + 3) - 0.5) * 2 + (noise(X / 5, Y / 5, seed + 4) - 0.5) * 3;
          const dirt = across >= c.a + 1 + n && across < c.z - 1 - n;
          const v = fbm(X, Y, seed);
          p.set(x, y, dirt ? DIRT[Math.max(0, Math.min(3, Math.floor(fbm(X * 1.6, Y * 1.6, seed + 40) * 4.4 - 0.2)))] : v < 0.4 ? GRASS[0] : v < 0.7 ? GRASS[1] : GRASS[2]);
        }
      bx.drawImage(p.toCanvas(), c.x0, c.y0);
    }
    const hitsCut = (cx, base) => cuts.some((c) => cx + 18 > c.x0 && cx - 18 < c.x1 && base > c.y0 + 4 && base - 60 < c.y1);
    const kinds = ['round', 'pine', 'round2', 'round', 'pine', 'round3'];
    const sprite = (kind, dark) =>
      cached('ring:' + kind + ':' + dark, () => {
        const src = forestTree(kind);
        const q = new Pix(src.w, src.h);
        for (let i = 0; i < src.d.length; i++) {
          const c = src.d[i];
          if (c) q.d[i] = c[0] === '#' ? mix(c, '#1b3324', dark) : c;
        }
        return q;
      });
    const draw = (ctx, list) => {
      list.sort((u, v) => u.base - v.base);
      for (const t of list) ctx.drawImage(sprite(t.kind, t.dark), Math.round(t.cx - 24), Math.round(t.base - 71));
    };
    // 整片：一排排错开，往前一排盖住后一排的树干；地图正中间会被地面盖住，不用画
    const all = [];
    let k = 0;
    for (let y = -10, row = 0; y < CH + 72; y += 17, row++)
      for (let x = -24 + (row % 2) * 12; x < CW + 24; x += 24) {
        const cx = x + hash2(x, y, seed + 7) * 10;
        const base = y + hash2(x, y, seed + 8) * 6;
        k++;
        if (cx - 24 > m + 8 && cx + 24 < m + W - 8 && base - 72 > m + 8 && base < m + H - 8) continue;
        if (hitsCut(cx, base)) continue;
        all.push({ cx, base, kind: kinds[k % kinds.length], dark: [0.3, 0.38, 0.46][Math.floor(hash2(x, y, seed + 9) * 3)] });
      }
    draw(bx, all);
    // 贴着地图四边的一圈
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

  // ================= 小屋里面 =================
  // 整间屋子一起画：上面两格是墙（顶上的木线、墙纸、腰线、护墙板、踢脚线），下面是长短不一的木地板；
  // 左右和下边一圈深色的墙边，门口留出口子
  function room(o) {
    const T = 16;
    const W = o.w * T;
    const H = o.h * T;
    const p = new Pix(W, H);
    const r = rnd(o.seed || 7);
    // 墙纸：暖白底，细竖条，零星的小花
    const PAPER = '#f1e2c6';
    p.rect(0, 0, W, 2 * T, PAPER);
    for (let x = 0; x < W; x += 6) p.rect(x, 3, 1, 15, '#e8d5b2');
    for (let x = 3; x < W; x += 12)
      for (let y = 7; y < 17; y += 8) {
        const xx = x + (((y - 7) / 8) % 2 ? 6 : 0);
        p.set(xx, y, '#dca792');
        p.set(xx - 1, y + 1, '#dca792');
        p.set(xx + 1, y + 1, '#dca792');
        p.set(xx, y + 2, '#dca792');
        p.set(xx, y + 1, '#a8c08a');
      }
    // 顶上的木线
    p.rect(0, 0, W, 3, '#5a3a28');
    p.rect(0, 2, W, 1, '#7a5238');
    // 腰线
    p.rect(0, 17, W, 1, '#c9965f');
    p.rect(0, 18, W, 2, '#9a6a44');
    p.rect(0, 20, W, 1, '#6e4a30');
    // 护墙板：一格一块，四边有亮边和暗边
    const WOOD = '#b9845a';
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
    // 踢脚线
    p.rect(0, 30, W, 2, '#6a4630');
    p.rect(0, 30, W, 1, '#8a5e40');
    // 地板：一行 6 像素高的木板，长短不一、接缝错开，颜色略有深浅，零星有木纹和节疤
    const TONES = ['#b47c52', '#bc865b', '#ab7449', '#c08c60'];
    const GAP = '#7a4e32';
    for (let y = 2 * T, row = 0; y < H; y += 6, row++) {
      let x = -Math.floor(r() * 30);
      while (x < W) {
        const len = 22 + Math.floor(r() * 26);
        const tone = TONES[Math.floor(r() * TONES.length)];
        p.rect(x, y, len, 5, tone);
        p.rect(x, y, len, 1, mix(tone, '#ffffff', 0.12));
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
    // 墙根在地板上的影子
    for (let y = 2 * T; y < 2 * T + 4; y++)
      for (let x = 0; x < W; x++) {
        const c = p.get(x, y);
        if (c) p.set(x, y, mix(c, '#3a2418', [0.32, 0.22, 0.12, 0.06][y - 2 * T]));
      }
    // 左右和下面的墙边；门口（door: [x0, x1] 格子）留口子
    const EDGE = '#4a3022';
    for (const x0 of [0, W - 4]) {
      p.rect(x0, 0, 4, H, EDGE);
      p.rect(x0 === 0 ? 3 : W - 4, 0, 1, H, '#6a4630');
    }
    for (let x = 0; x < W; x++) {
      const inDoor = o.door && x >= o.door[0] * T && x < (o.door[1] + 1) * T;
      if (inDoor) continue;
      p.set(x, H - 3, '#6a4630');
      p.set(x, H - 2, EDGE);
      p.set(x, H - 1, EDGE);
    }
    // 门口的地垫
    if (o.door) {
      const mx = o.door[0] * T + 2;
      const mw = (o.door[1] - o.door[0] + 1) * T - 4;
      p.rect(mx, H - 11, mw, 9, '#8a5a3b');
      p.rect(mx + 2, H - 9, mw - 4, 5, '#b07a4a');
      for (let x = mx + 3; x < mx + mw - 3; x += 3) p.set(x, H - 7, '#c9965f');
    }
    return p.toCanvas();
  }

  // ================= 池塘里的鱼（从上往下看） =================
  const FISH_LOOK = {
    medaka: { body: '#d8c68a', fin: '#c8b070', spots: null },
    goldfish: { body: '#f0742e', fin: '#f6b07a', spots: null, fancy: true },
    guppy: { body: '#9ab0c8', fin: '#e85d75', fin2: '#9b7fd1', spots: null, fancy: true },
    koi: { body: '#f8f4ec', fin: '#f2e6dc', spots: '#d8452e' },
    goldkoi: { body: '#f2c14e', fin: '#f7dc85', spots: null, shine: true },
  };
  function fishTopDraw(p, sp, frame) {
    const L = FISH_LOOK[sp] || FISH_LOOK.goldfish;
    const sw = frame ? 1 : -1;
    // 尾巴
    p.poly([[11, 5], [15, 2 + sw], [15, 8 + sw]], L.fin);
    if (L.fancy) p.poly([[12, 5], [16, 1 + sw], [16, 9 + sw]], L.fin2 || L.fin);
    // 身子
    p.sEll(7, 5, 5, 2.6, L.body);
    p.ell(7, 4.3, 3.5, 1, lighten(L.body, 0.08));
    // 胸鳍
    p.set(6, 2 + (frame ? 0 : 1), L.fin);
    p.set(6, 8 - (frame ? 0 : 1), L.fin);
    if (L.spots) {
      p.ell(6, 4.5, 1.6, 1.4, L.spots);
      p.set(9, 5, L.spots);
      p.set(10, 4, L.spots);
    }
    if (L.shine) {
      p.set(5, 4, '#fff1b8');
      p.set(8, 4, '#fff1b8');
    }
    p.set(3, 4, INK);
    p.set(3, 6, INK);
  }
  function fishTop(sp, frame, sick) {
    return cached('fishtop:' + sp + ':' + frame + ':' + (sick ? 1 : 0), () => {
      const p = new Pix(17, 11);
      fishTopDraw(p, sp, frame);
      p.outline();
      if (sick) p.recolor((c) => mix(desat(c, 0.5), '#9fbf8f', 0.15));
      return p;
    });
  }

  // ================= 注册和缓存 =================

  const cache = new Map();

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

  function pet(species, frame, recolor, hat) {
    return cached('pet:' + species + ':' + frame + ':' + (recolor || '') + ':' + (hat || ''), () => {
      const p = new Pix(32, 32);
      (PETS[species] || PETS.crab)(p, frame);
      if (recolor) p.recolor((c) => (c === INK || c === WHITE ? c : hueShift(c, recolor)));
      if (hat && HATS[hat]) {
        const h = new Pix(16, 12);
        HATS[hat](h, 3, 'front');
        p.blit(h, 8, (PET_HAT_AT[species] || 0) + bob(frame) - 3);
      }
      p.outline();
      if (frame === 'sick') p.recolor((c) => mix(desat(c, 0.4), '#9fbf8f', 0.12));
      return p;
    });
  }

  function hueShift(c, deg) {
    const [h, s, l] = hsl(c);
    if (s < 0.15 || l > 0.92) return c;
    return hsl2hex(h + deg, s, l);
  }

  // 躺在床上：头枕在枕头上，被子盖到下巴，被子下面鼓起来一点（和 32×32 的床对齐）
  function lying(look) {
    return cached('lying:' + JSON.stringify(look), () => {
      const q = build(16, 32, (z) => person(z, look, 'idle', 'front'));
      const p = new Pix(32, 32);
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) if (q.get(x, y)) p.set(x + 8, y + 3, q.get(x, y));
      const B = ramp('#5a8fe0');
      p.rect(2, 15, 28, 3, '#5a8fe0');
      p.rect(2, 15, 28, 1, B.hi);
      p.rect(2, 18, 28, 1, B.mid);
      p.ell(16, 23, 7, 3, lighten('#5a8fe0', 0.05));
      p.ell(15, 22, 5, 1.5, B.hi);
      return p;
    });
  }

  // 夜里亮灯的窗户：只留下房子图里的玻璃，换成暖黄色（盖在变暗的画面上）
  const GLASS = { '#7fb6d8': '#ffcf6e', '#a9d4ec': '#ffe08f', '#cdeaf8': '#fff1c4', '#5e93b8': '#d99a48', '#6aa2c6': '#e8ac56' };
  function litWindows(kind) {
    const d = DECOR[kind];
    if (!d) return null;
    return cached('lit:' + kind, () => {
      const src = build(d.w, d.h, (q) => d.draw(q), { outline: !d.flat });
      const p = new Pix(d.w, d.h);
      for (let i = 0; i < src.d.length; i++) if (GLASS[src.d[i]]) p.d[i] = GLASS[src.d[i]];
      return p;
    });
  }

  function avatar(look, frame, dir) {
    return cached('avatar:' + JSON.stringify(look) + ':' + frame + ':' + (dir || 'front'), () => build(16, 32, (q) => person(q, look, frame, dir)));
  }

  // stage：0 种子、1 发芽、2 小树苗、3 小树、4（默认）长大的树
  function tree(kind, stage) {
    const st = stage == null ? 4 : stage;
    return cached('tree:' + kind + ':' + st, () => {
      if (st <= 0) return build(16, 16, (q) => treeSeed(q));
      if (st === 1) return build(16, 16, (q) => treeSprout(q, kind));
      if (st === 2) return build(16, 32, (q) => treeSapling(q, kind));
      if (st === 3) return build(32, 48, (q) => drawTree(q, kind, 1));
      return build(48, 72, (q) => drawTree(q, kind, 1.5));
    });
  }

  function grassSprite(kind, stage) {
    const tall = (GRASSES[kind] || {}).tall && stage >= 2;
    return cached('grass:' + kind + ':' + stage, () => build(16, tall ? 24 : 16, (q) => grassPlant(q, kind, stage)));
  }

  function flowerSprite(kind, stage) {
    const tall = (FLOWERS[kind] || {}).tall && stage >= 2;
    return cached('flower:' + kind + ':' + stage, () => build(16, tall ? 24 : 16, (q) => flower(q, kind, stage)));
  }

  function shrubSprite(kind, stage) {
    return cached('shrub:' + kind + ':' + stage, () => build(16, 16, (q) => shrub(q, kind, stage)));
  }

  function ground(kind, v) {
    return cached('ground:' + kind + ':' + (v || 0), () => build(16, 16, (q) => (GROUND[kind] || GROUND.grass)(q, v || 0), { outline: false }));
  }

  function decor(kind) {
    const d = DECOR[kind];
    if (!d) return null;
    return cached('decor:' + kind, () => build(d.w, d.h, (q) => d.draw(q), { outline: !d.flat }));
  }

  function icon(kind, color) {
    return cached('icon:' + kind + ':' + (color || ''), () => build(16, 16, (q) => (ICONS[kind] || ICONS.bag)(q, color)));
  }

  // 画到 <canvas> 或返回 dataURL，给 <img> 用
  const urlCache = new Map();
  function url(canvas) {
    if (!urlCache.has(canvas)) urlCache.set(canvas, canvas.toDataURL());
    return urlCache.get(canvas);
  }

  return {
    Pix, ramp, lighten, mix, url, terrain,
    pet, avatar, tree, flower: flowerSprite, shrub: shrubSprite, grass: grassSprite, fishTop, room, forestRing, pondInside, lying, litWindows, ground, decor, icon,
    PETS: Object.keys(PETS), TREES: Object.keys(TREE_SPECS), FLOWERS: Object.keys(FLOWERS), SHRUBS: Object.keys(SHRUBS),
    DECOR: Object.fromEntries(Object.entries(DECOR).map(([k, v]) => [k, { w: v.w, h: v.h, tw: v.tw, th: v.th, room: !!v.room, wall: !!v.wall, flat: !!v.flat }])),
    HATS: Object.keys(HATS), ICONS: Object.keys(ICONS),
    FLOWER_COLOR: Object.fromEntries(Object.entries(FLOWERS).map(([k, v]) => [k, v.c])),
  };
})();
