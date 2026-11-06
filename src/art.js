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
  Pix.prototype.outline = function (only) {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const n = this.get(x, y - 1) || this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y + 1);
        if (n && n[0] === '#' && !(only && !only(n))) add.push([x, y, ramp(n).line]);
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
  const PET_HAT_AT = { crab: 4, cat: 0, shiba: 0, fox: -1, rabbit: 1, hamster: 4, penguin: 1, duck: -1, frog: 3 };

  function person(p, look, f, dir) {
    dir = dir || 'front';
    const skin = look.skin || '#f3c9a5';
    const hair = look.hair || '#5a3a2a';
    const top = look.top || '#d6ccb8';
    const bottom = look.bottom || '#6d6a7a';
    const shoes = look.shoes || '#5a4334';
    const H = ramp(hair);
    const T = ramp(top);
    const y0 = f === 'walk1' || f === 'walk2' ? -1 : 0;
    const [a, b] = feet(f);
    const act = f === 'act';
    // 腿、鞋
    const bs = look.bottomStyle || 'pants';
    if (dir === 'side') {
      p.sRect(6, 23 + y0, 4, 6 - a, bottom, { noHi: true });
      if (bs !== 'skirt') p.sRect(5 + (a ? 2 : 0), 23 + y0, 4, 6 - b, bottom, { noHi: true });
      p.sRect(6, 29 + y0 - a, 6, 2, shoes, { noHi: true });
    } else {
      const legH = bs === 'shorts' ? 3 : 6;
      p.sRect(4, 23 + y0, 4, legH - a, bottom, { noHi: true });
      p.sRect(8, 23 + y0, 4, legH - b, bottom, { noHi: true });
      if (bs === 'shorts') {
        p.rect(4, 26 + y0 - a, 4, 3, skin);
        p.rect(8, 26 + y0 - b, 4, 3, skin);
      }
      p.sRect(3, 29 + y0 - a, 5, 2, shoes, { noHi: true });
      p.sRect(8, 29 + y0 - b, 5, 2, shoes, { noHi: true });
    }
    if (bs === 'skirt') p.poly([[3, 22 + y0], [13, 22 + y0], [14.5, 27 + y0], [1.5, 27 + y0]], bottom);
    // 上衣
    const ts = look.topStyle || 'tee';
    p.sRect(3, 15 + y0, 10, 8, top);
    if (ts === 'stripe') for (let y = 17; y < 23; y += 2) p.rect(3, y + y0, 10, 1, '#f4ece0');
    if (ts === 'overalls') {
      p.sRect(4, 18 + y0, 8, 5, bottom);
      p.rect(5, 15 + y0, 1, 3, ramp(bottom).base);
      p.rect(10, 15 + y0, 1, 3, ramp(bottom).base);
      p.set(5, 18 + y0, '#f2c14e');
      p.set(10, 18 + y0, '#f2c14e');
    }
    if (ts === 'hoodie' && dir !== 'back') {
      p.rect(6, 15 + y0, 1, 4, T.lo);
      p.rect(9, 15 + y0, 1, 4, T.lo);
      p.rect(5, 20 + y0, 6, 2, T.mid);
    }
    if (ts === 'hoodie' && dir === 'back') p.sEll(8, 15.5 + y0, 5, 2.5, top);
    if (dir !== 'back' && ts !== 'hoodie') p.rect(7, 15 + y0, 2, 1, ramp(skin).mid);
    // 胳膊
    if (dir === 'side') {
      const sw = act ? 0 : a - b;
      if (act) {
        p.sRect(9, 17 + y0, 5, 2, top, { noHi: true });
        p.rect(14, 17 + y0, 2, 2, skin);
      } else {
        p.sRect(7 + sw, 16 + y0, 2, 6, top, { noHi: true });
        p.rect(7 + sw, 22 + y0, 2, 1, skin);
      }
    } else if (act && dir === 'front') {
      p.sRect(3, 18 + y0, 10, 2, top, { noHi: true });
      p.rect(6, 20 + y0, 4, 1, skin);
    } else {
      p.sRect(1, 16 + y0 + b - a, 2, 6, top, { noHi: true });
      p.sRect(13, 16 + y0 + a - b, 2, 6, top, { noHi: true });
      p.rect(1, 22 + y0 + b - a, 2, 1, skin);
      p.rect(13, 22 + y0 + a - b, 2, 1, skin);
    }
    // 头
    const hs = look.hairStyle || 'short';
    if (hs === 'long' && dir !== 'side') p.sRect(2, 7 + y0, 12, 10, hair, { noHi: true });
    if (hs === 'long' && dir === 'side') p.sRect(2, 7 + y0, 6, 10, hair, { noHi: true });
    p.sEll(8, 8.5 + y0, 6.3, 6.6, skin, { noHi: true });
    if (dir === 'back') {
      p.sEll(8, 8 + y0, 6.8, 7, hair);
      if (hs === 'bun') p.sEll(8, 2 + y0, 2.6, 2.4, hair);
    } else if (dir === 'side') {
      p.sEll(7, 5.5 + y0, 6.6, 4.6, hair);
      p.sEll(4.5, 9 + y0, 3.6, 4.4, hair);
      p.rect(10, 7 + y0, 4, 1, H.mid);
      p.set(13, 8 + y0, H.mid);
      p.rect(3, 4 + y0, 4, 1, H.hi);
      if (hs === 'bun') p.sEll(2.5, 3 + y0, 2.4, 2.2, hair);
      p.rect(11, 10 + y0, 1, 2, INK);
      p.set(12, 12 + y0, '#f4b9ab');
      p.set(12, 13 + y0, '#c98a78');
    } else {
      p.sEll(8, 5.5 + y0, 6.8, 4.6, hair);
      p.rect(1, 5 + y0, 2, 6, H.base);
      p.rect(13, 5 + y0, 2, 6, H.mid);
      p.rect(3, 7 + y0, 3, 1, H.base);
      p.rect(10, 7 + y0, 3, 1, H.mid);
      p.rect(4, 3 + y0, 4, 1, H.hi);
      if (hs === 'bun') p.sEll(8, 1.5 + y0, 2.6, 2.4, hair);
      p.rect(5, 10 + y0, 1, 2, INK);
      p.rect(10, 10 + y0, 1, 2, INK);
      p.set(4, 12 + y0, '#f4b9ab');
      p.set(11, 12 + y0, '#f4b9ab');
      p.rect(7, 13 + y0, 2, 1, '#c98a78');
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

  const TREES = {
    oak(p) {
      trunk(p, 14, 30, 15);
      canopy(p, ROUND, '#5f9e4f', SPECK);
    },
    apple(p) {
      trunk(p, 14, 30, 15);
      canopy(p, ROUND, '#5c9a4a', SPECK, [[9, 15, '#d64545'], [21, 12, '#d64545'], [16, 21, '#d64545'], [24, 21, '#d64545'], [12, 24, '#d64545'], [17, 8, '#d64545']]);
    },
    sakura(p) {
      trunk(p, 14, 30, 15, '#7a4a3a');
      canopy(p, ROUND, '#f2a6c0', SPECK, [[10, 12, '#fbd3e0'], [22, 16, '#fbd3e0'], [15, 22, '#fbd3e0'], [19, 7, '#ffffff']]);
      for (const [x, y] of [[5, 34], [26, 37], [9, 41], [22, 43]]) p.set(x, y, '#f2a6c0');
    },
    maple(p) {
      trunk(p, 14, 30, 15, '#7a4a3a');
      canopy(p, [[16, 22, 12, 8], [7, 16, 6, 6], [25, 16, 6, 6], [16, 10, 9, 8], [16, 4, 4, 3]], '#e0663a', SPECK, [[11, 13, '#f2a24a'], [21, 19, '#c8463a'], [15, 25, '#f2a24a']]);
    },
    ginkgo(p) {
      trunk(p, 14, 31, 14);
      canopy(p, [[16, 24, 12, 7], [16, 16, 10, 7], [16, 9, 7, 6], [16, 4, 4, 3]], '#f2c14e', SPECK, [[11, 20, '#f7dc85'], [20, 12, '#f7dc85']]);
    },
    pine(p) {
      trunk(p, 14, 36, 9);
      const G = '#3f7d4f';
      const R = ramp(G);
      for (const [y, w] of [[32, 13], [24, 11], [16, 9], [9, 6]]) {
        p.poly([[16 - w - 1, y + 4], [16 + w + 1, y + 4], [16, y - 9]], R.lo);
        p.poly([[16 - w, y + 3], [16 + w, y + 3], [16, y - 9]], G);
        p.poly([[16 - w, y + 3], [16, y + 3], [16, y - 9]], R.base);
        p.poly([[16 - w + 2, y + 1], [15, y + 1], [15, y - 6]], R.hi);
        p.rect(16, y - 7, 1, y > 20 ? 9 : 6, R.mid);
      }
      p.set(16, 0, '#f2c14e');
    },
    palm(p) {
      shadow(p, 16, 45.5, 9);
      const T = '#a77b52';
      for (let y = 14; y < 45; y++) {
        const x = 14 + Math.round(Math.sin((y - 14) / 9) * 2);
        p.rect(x, y, 4, 1, y % 3 ? ramp(T).base : ramp(T).mid);
        p.set(x + 3, y, ramp(T).lo);
      }
      const F = '#5aa05a';
      for (const [x1, y1, x2, y2] of [[16, 13, 3, 18], [16, 13, 29, 18], [16, 12, 6, 6], [16, 12, 26, 5], [16, 12, 16, 2], [16, 13, 1, 12], [16, 13, 31, 12]]) {
        p.line(x1, y1, x2, y2, F);
        p.line(x1, y1 + 1, x2, y2 + 1, ramp(F).mid);
        p.line((x1 + x2) / 2, (y1 + y2) / 2 + 1, (x1 + x2) / 2 + (x2 > x1 ? 1 : -1), (y1 + y2) / 2 + 3, ramp(F).lo);
      }
      p.sEll(14, 15, 2, 2, '#6b4a2b');
      p.sEll(18, 15, 2, 2, '#6b4a2b');
    },
    bamboo(p) {
      shadow(p, 16, 45.5, 10);
      const B = '#6aa35a';
      for (const [x, top] of [[8, 14], [14, 4], [21, 10]]) {
        p.sRect(x, top, 3, 44 - top, B, { noHi: true });
        for (let y = top + 6; y < 44; y += 7) p.rect(x, y, 3, 1, ramp(B).lo);
        p.poly([[x + 3, top + 7], [x + 9, top + 3], [x + 4, top + 9]], ramp(B).hi);
        p.poly([[x, top + 13], [x - 6, top + 10], [x - 1, top + 15]], ramp(B).base);
      }
    },
    cactus(p) {
      shadow(p, 16, 45.5, 9);
      const C = '#5f9e4f';
      p.sRect(12, 12, 8, 33, C);
      p.sRect(4, 20, 5, 12, C);
      p.sRect(5, 29, 8, 4, C);
      p.sRect(23, 16, 5, 13, C);
      p.sRect(19, 26, 6, 4, C);
      for (let y = 14; y < 44; y += 4) {
        p.set(14, y, ramp(C).hi);
        p.set(17, y + 2, ramp(C).lo);
      }
      p.sEll(16, 11, 3, 2.4, '#ef7fa0');
      p.set(16, 11, '#f6d35b');
    },
  };

  function sapling(p) {
    shadow(p, 16, 45.5, 6);
    p.sRect(15, 32, 2, 13, '#8a5a3b');
    canopy(p, [[16, 30, 6, 5], [12, 27, 3.5, 3], [20, 27, 3.5, 3]], '#6aa35a');
  }
  function deadTree(p) {
    shadow(p, 16, 45.5, 8);
    const T = '#8a7a66';
    p.sRect(14, 22, 5, 23, T);
    p.line(15, 26, 8, 16, T);
    p.line(15, 27, 8, 17, ramp(T).mid);
    p.line(18, 24, 25, 14, T);
    p.line(18, 25, 25, 15, ramp(T).mid);
    p.line(10, 19, 7, 19, T);
    p.line(23, 17, 26, 18, T);
  }

  // 花（16×16）：stage 0 刚种下、1 发芽、2 花苞、3 开花
  const FLOWERS = {
    tulip: { c: '#e85d75', bloom(p, c) {
      p.sEll(8, 5.5, 3.5, 3.5, c);
      p.rect(6, 2, 1, 2, ramp(c).base);
      p.rect(8, 2, 1, 2, ramp(c).hi);
      p.rect(10, 2, 1, 2, ramp(c).mid);
    } },
    rose: { c: '#ef7fa0', bloom(p, c) {
      p.sEll(8, 5.5, 4, 3.5, c);
      p.set(8, 5, ramp(c).lo);
      p.set(7, 4, ramp(c).lo);
      p.set(9, 6, ramp(c).lo);
      p.set(6, 6, ramp(c).hi);
    } },
    daisy: { c: '#fbf7ef', bloom(p, c) {
      for (const [x, y] of [[8, 2], [8, 8], [5, 5], [11, 5], [6, 3], [10, 3], [6, 7], [10, 7]]) p.ell(x + 0.5, y + 0.5, 1.4, 1.4, c);
      p.sEll(8.5, 5.5, 1.6, 1.6, '#f2c14e');
    } },
    sunflower: { c: '#f6c33b', bloom(p, c) {
      for (let k = 0; k < 10; k++) {
        const t = (k / 10) * Math.PI * 2;
        p.ell(8.5 + Math.cos(t) * 3.6, 5 + Math.sin(t) * 3.2, 1.4, 1.4, k % 2 ? c : ramp(c).mid);
      }
      p.sEll(8.5, 5, 2.4, 2.2, '#7a4a2a');
    } },
    lavender: { c: '#9b7fd1', bloom(p, c) {
      for (const x of [5, 8, 11]) for (let y = 1; y < 8; y += 2) p.rect(x, y + (x === 8 ? -1 : 1), 2, 2, y < 3 ? ramp(c).hi : c);
    } },
    bluebell: { c: '#5a8fe0', bloom(p, c) {
      p.line(8, 2, 12, 4, '#4f8a43');
      for (const [x, y] of [[5, 4], [9, 6], [12, 7]]) {
        p.sEll(x + 0.5, y + 0.5, 2, 1.8, c);
        p.set(x, y + 2, ramp(c).lo);
        p.set(x + 1, y + 2, ramp(c).lo);
      }
    } },
  };

  function soilMound(p) {
    p.sEll(8, 13.5, 5, 2, '#8a6244');
    p.set(6, 13, '#6b4a33');
    p.set(10, 14, '#6b4a33');
  }
  function stem(p, top) {
    const G = '#4f8a43';
    p.rect(8, top, 1, 14 - top, G);
    p.poly([[8, 11], [4, 8.5], [5, 11]], '#6aa35a');
    p.poly([[9, 10], [13, 7.5], [12, 10]], ramp('#6aa35a').mid);
  }
  function flower(p, kind, stage) {
    const F = FLOWERS[kind] || FLOWERS.tulip;
    soilMound(p);
    if (stage === 0) {
      p.set(7, 12, '#e8d8b0');
      p.set(9, 12, '#e8d8b0');
      return;
    }
    if (stage === 1) {
      p.rect(8, 9, 1, 4, '#4f8a43');
      p.poly([[8, 10], [5, 8], [6, 10]], '#6aa35a');
      p.poly([[9, 10], [12, 8], [11, 10]], ramp('#6aa35a').mid);
      return;
    }
    stem(p, stage === 2 ? 6 : 5);
    if (stage === 2) {
      p.sEll(8.5, 5, 1.8, 2.4, '#6aa35a');
      p.rect(8, 3, 1, 2, F.c);
      return;
    }
    F.bloom(p, F.c);
  }

  // 灌木（16×16）
  const SHRUBS = {
    bush: { c: '#5f9e4f' },
    berry: { c: '#4f8a43', dots: '#d64545' },
    hydrangea: { c: '#5c9a4a', dots: '#8aa8e8', big: true },
  };
  function shrub(p, kind, stage) {
    const S = SHRUBS[kind] || SHRUBS.bush;
    p.ell(8, 14.5, 6, 1.5, 'rgba(40,30,20,.2)');
    if (stage === 0) {
      soilMound(p);
      p.rect(8, 9, 1, 4, '#4f8a43');
      p.poly([[8, 10], [5, 8], [6, 10]], '#6aa35a');
      return;
    }
    const k = stage === 1 ? 0.65 : 1;
    canopy(p, [[8, 10, 6.5 * k, 4.5 * k], [5, 8.5 - 2 * k, 3.5 * k, 3 * k], [11, 8.5 - 2 * k, 3.5 * k, 3 * k]].map(([x, y, a, b]) => [x, y + (1 - k) * 4, a, b]), S.c);
    if (stage === 2 && S.dots) {
      const pts = S.big ? [[4, 7], [9, 5], [11, 9], [6, 10]] : [[5, 8], [9, 6], [11, 10], [7, 11], [12, 7]];
      for (const [x, y] of pts) {
        if (S.big) {
          p.sEll(x + 1, y + 1, 1.8, 1.6, S.dots);
        } else {
          p.set(x, y, S.dots);
          p.set(x + 1, y, lighten(S.dots, 0.15));
        }
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
    house: { w: 80, h: 84, tw: 5, th: 3, draw(p) {
      const WALL = '#d6a167';
      const WR = ramp(WALL);
      const TRIM = '#f1e2c2';
      const ROOF = '#b9553f';
      const RR = ramp(ROOF);
      const STONE = '#9d978c';
      // 地上的影子
      p.ell(40, 82, 40, 2.6, 'rgba(30,25,15,.28)');
      // 石头地基
      for (let y = 74; y < 82; y++) for (let x = 5; x < 75; x++) p.set(x, y, STONE);
      for (let row = 0; row < 2; row++) {
        const y = 74 + row * 4;
        p.rect(5, y + 3, 70, 1, ramp(STONE).lo);
        for (let x = 5 + (row ? 4 : 0); x < 75; x += 8) {
          p.rect(x, y, 1, 3, ramp(STONE).lo);
          p.rect(x + 1, y, 5, 1, ramp(STONE).hi);
        }
      }
      // 木板墙：一条条横木板，转角有竖木条
      for (let y = 42; y < 74; y++) {
        const k = (y - 42) % 4;
        const c = k === 0 ? WR.hi : k === 3 ? WR.lo : WALL;
        p.rect(6, y, 68, 1, c);
      }
      for (let y = 44; y < 74; y += 4) for (let x = 12 + ((y >> 2) % 3) * 9; x < 72; x += 27) p.set(x, y + 1, WR.mid);
      p.sRect(5, 42, 4, 32, TRIM, { noHi: true });
      p.sRect(71, 42, 4, 32, TRIM, { noHi: true });
      // 屋檐下的影子
      p.rect(6, 42, 68, 3, 'rgba(60,30,15,.28)');
      // 屋顶：一排排瓦片，裁成山墙的三角形
      const top = 3;
      const eave = 42;
      const inRoof = (x, y) => y >= top && y < eave && Math.abs(x - 39.5) <= ((y - top) / (eave - top)) * 41 + 0.5;
      for (let y = top; y < eave; y++)
        for (let x = -2; x < 82; x++) {
          if (!inRoof(x, y)) continue;
          const row = Math.floor((y - top) / 5);
          const ry = (y - top) % 5;
          const off = row % 2 ? 4 : 0;
          const tab = (x + off) % 8;
          let c = ROOF;
          if (ry === 4) c = RR.lo;
          else if (tab === 0) c = RR.mid;
          else if (ry === 0 && tab < 4) c = RR.hi;
          if (x < 40 && ry < 3 && tab > 1 && tab < 4) c = ry === 0 ? RR.hi : c;
          p.set(x, y, c);
        }
      // 山墙边的木封檐板和屋脊
      for (let y = top; y < eave + 1; y++) {
        const half = ((y - top) / (eave - top)) * 41;
        p.set(Math.round(39.5 - half), y, TRIM);
        p.set(Math.round(39.5 - half) + 1, y, ramp(TRIM).mid);
        p.set(Math.round(39.5 + half), y, ramp(TRIM).mid);
        p.set(Math.round(39.5 + half) - 1, y, TRIM);
      }
      p.rect(36, top - 1, 8, 2, ramp(TRIM).mid);
      // 屋檐：一条木板
      p.sRect(-1, eave - 1, 82, 3, '#8a5a3b', { noHi: true });
      // 砖烟囱
      for (let y = 6; y < 28; y++)
        for (let x = 56; x < 64; x++) {
          if (!inRoof(x, y + 8) && y > 20) continue;
          const brick = (y % 4 === 3) || ((x + (Math.floor(y / 4) % 2) * 2) % 4 === 0);
          p.set(x, y, brick ? '#7a3a2e' : y % 4 === 0 ? '#c46a50' : '#a8503c');
        }
      p.sRect(55, 4, 10, 3, '#8a847a', { noHi: false });
      // 窗户：白框、十字窗棂、绿色百叶、花箱
      for (const wx of [14, 53]) {
        p.sRect(wx - 4, 52, 3, 13, '#5f8a52', { noHi: true });
        p.sRect(wx + 13, 52, 3, 13, '#5f8a52', { noHi: true });
        for (let y = 53; y < 64; y += 3) {
          p.rect(wx - 4, y, 3, 1, ramp('#5f8a52').lo);
          p.rect(wx + 13, y, 3, 1, ramp('#5f8a52').lo);
        }
        p.sRect(wx - 1, 51, 14, 15, TRIM);
        p.rect(wx + 1, 53, 10, 11, '#7fb6d8');
        p.rect(wx + 1, 53, 10, 2, '#a9d4ec');
        p.line(wx + 2, 62, wx + 8, 54, '#cdeaf8');
        p.line(wx + 3, 62, wx + 9, 54, '#cdeaf8');
        p.rect(wx + 6, 53, 1, 11, TRIM);
        p.rect(wx + 1, 58, 10, 1, TRIM);
        p.sRect(wx - 2, 66, 16, 3, '#8a5a3b');
        for (let i = 0; i < 6; i++) {
          const c = ['#e85d75', '#f6d35b', '#ef7fa0', '#ffffff', '#e85d75', '#9b7fd1'][i];
          p.set(wx + i * 2 + 1, 65, '#5f9e4f');
          p.set(wx + i * 2, 64, c);
          p.set(wx + i * 2 + 1, 64, c);
        }
      }
      // 门：门框、两块门板、把手；上面一个小雨棚，下面两级石阶
      p.sRect(31, 50, 18, 24, TRIM, { noHi: true });
      p.sRect(33, 52, 14, 22, '#8a5a3b');
      p.sRect(35, 54, 4, 8, ramp('#8a5a3b').mid, { noHi: true });
      p.sRect(41, 54, 4, 8, ramp('#8a5a3b').mid, { noHi: true });
      p.sRect(35, 64, 4, 8, ramp('#8a5a3b').mid, { noHi: true });
      p.sRect(41, 64, 4, 8, ramp('#8a5a3b').mid, { noHi: true });
      p.rect(44, 63, 2, 2, '#f2c14e');
      p.poly([[27, 50], [53, 50], [49, 45], [31, 45]], ROOF);
      for (let x = 32; x < 49; x += 4) p.rect(x, 46, 1, 4, RR.lo);
      p.rect(27, 49, 26, 1, RR.lo);
      p.rect(29, 50, 2, 6, '#8a5a3b');
      p.rect(49, 50, 2, 6, '#8a5a3b');
      p.sRect(28, 74, 24, 3, '#b9b2a6');
      p.sRect(30, 77, 20, 3, '#a8a196');
      // 门边的小灯
      p.sRect(51, 54, 3, 4, '#3a3a42');
      p.set(52, 55, '#ffe28a');
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
    const q = build(kind === 'bush' ? 16 : 32, kind === 'bush' ? 16 : 48, (p) => {
      if (kind === 'bush') {
        canopy(p, [[8, 10, 7, 5.5], [5, 7, 4, 4], [11, 6, 4.5, 4]], '#3f7d3c');
      } else if (kind === 'pine') {
        trunk(p, 14, 36, 9, '#6a4632');
        const G = '#2f6a45';
        const R = ramp(G);
        for (const [y, w] of [[32, 14], [24, 12], [16, 9], [9, 6]]) {
          p.poly([[16 - w - 1, y + 4], [16 + w + 1, y + 4], [16, y - 9]], R.lo);
          p.poly([[16 - w, y + 3], [16 + w, y + 3], [16, y - 9]], G);
          p.poly([[16 - w, y + 3], [16, y + 3], [16, y - 9]], R.base);
          p.poly([[16 - w + 2, y + 1], [15, y + 1], [15, y - 6]], R.hi);
          p.rect(16, y - 7, 1, y > 20 ? 9 : 6, R.mid);
        }
      } else {
        trunk(p, 14, 30, 15, '#6a4632');
        const blobs = kind === 'round2' ? [[16, 22, 13, 9], [7, 15, 7, 7], [25, 15, 7, 7], [16, 9, 10, 8]] : kind === 'round3' ? [[16, 23, 12, 8], [9, 14, 8, 8], [23, 13, 8, 8], [16, 6, 7, 5]] : ROUND;
        canopy(p, blobs, kind === 'round3' ? '#4a8a4a' : '#4f8f42', SPECK);
      }
    });
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
    // 池塘：格子并成一块，边缘圆一点
    const waterAt = (px, py) => {
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
      for (let ty = Math.floor(y0 / T); ty * T < y1 && pads < 4; ty++)
        for (let tx = Math.floor(x0 / T); tx * T < x1 && pads < 4; tx++) {
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
      for (let y = y1 - 1; y > y0 && reeds < 4; y -= 3)
        for (let x = x0; x < x1 && reeds < 4; x += 2) {
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
      // 上边：三排
      for (let x = -12; x < W + 16; x += 17) add(x + hash2(x, 1, seed) * 6, b * T - 24 + hash2(x, 2, seed) * 4, 0.5, k++);
      for (let x = -4; x < W + 16; x += 19) add(x + hash2(x, 3, seed) * 6, b * T - 12 + hash2(x, 4, seed) * 4, 0.28, k++);
      for (let x = 2; x < W + 16; x += 22) add(x + hash2(x, 5, seed) * 6, b * T + 1 + hash2(x, 6, seed) * 3, 0, k++);
      // 下边：两排，只露出树冠上半截
      for (let x = -6; x < W + 16; x += 18) add(x + hash2(x, 7, seed) * 6, H + 6 + hash2(x, 8, seed) * 4, 0.2, k++);
      for (let x = 4; x < W + 16; x += 21) add(x + hash2(x, 9, seed) * 6, H + 18 + hash2(x, 10, seed) * 3, 0, k++);
      // 左右：两列
      for (let y = b * T + 8; y < H; y += 14) {
        add(4 + hash2(y, 11, seed) * 4, y + hash2(y, 12, seed) * 4, 0.35, k++);
        add(b * T - 12 + hash2(y, 13, seed) * 3, y + 7 + hash2(y, 14, seed) * 4, 0, k++);
        add(W - 4 - hash2(y, 15, seed) * 4, y + hash2(y, 16, seed) * 4, 0.35, k++);
        add(W - b * T + 12 - hash2(y, 17, seed) * 3, y + 7 + hash2(y, 18, seed) * 4, 0, k++);
      }
      // 出口：挡住小路的树不要
      const blocks = (t) => {
        for (let y = t.base - 44; y <= t.base + 2; y += 3) for (let x = t.cx - 15; x <= t.cx + 15; x += 3) if (open(x, y)) return true;
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
        const ox = t.cx - 16;
        const oy = t.base - 47;
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

  function avatar(look, frame, dir) {
    return cached('avatar:' + JSON.stringify(look) + ':' + frame + ':' + (dir || 'front'), () => build(16, 32, (q) => person(q, look, frame, dir)));
  }

  function tree(kind, stage) {
    return cached('tree:' + kind + ':' + (stage || 'full'), () =>
      build(32, 48, (q) => (stage === 'sapling' ? sapling(q) : stage === 'dead' ? deadTree(q) : (TREES[kind] || TREES.oak)(q)))
    );
  }

  function flowerSprite(kind, stage) {
    return cached('flower:' + kind + ':' + stage, () => build(16, 16, (q) => flower(q, kind, stage)));
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
    Pix, ramp, lighten, mix, url, terrain, room,
    pet, avatar, tree, flower: flowerSprite, shrub: shrubSprite, ground, decor, icon,
    PETS: Object.keys(PETS), TREES: Object.keys(TREES), FLOWERS: Object.keys(FLOWERS), SHRUBS: Object.keys(SHRUBS),
    DECOR: Object.fromEntries(Object.entries(DECOR).map(([k, v]) => [k, { w: v.w, h: v.h, tw: v.tw, th: v.th, room: !!v.room, wall: !!v.wall, flat: !!v.flat }])),
    HATS: Object.keys(HATS), ICONS: Object.keys(ICONS),
    FLOWER_COLOR: Object.fromEntries(Object.entries(FLOWERS).map(([k, v]) => [k, v.c])),
  };
})();
