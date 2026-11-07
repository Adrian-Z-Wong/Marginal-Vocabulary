// 像素画布（每个像素一格）和缓存

import { hex2rgb, mix, ramp } from './color';

// ================= 画布 =================

const LX = -0.55;
const LY = -0.83; // 光从左上来

// 颜色字符串 → [r, g, b, a]（缓存起来；整张图一次写进 ImageData，比一个个 fillRect 快得多）
const rgbaCache = new Map<string, number[]>();
let probe: CanvasRenderingContext2D | null = null;
function rgbaOf(v: string): number[] {
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
        probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
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

// ================= 注册和缓存 =================

/** 一个像素：颜色字符串（#rrggbb 或 rgba(...)），透明是 null */
export type Px = string | null;

/** 精灵图：画好的小画布 */
export type Sprite = HTMLCanvasElement;

const cache = new Map<string, Sprite>();

export function build(w: number, h: number, draw: (p: Pix) => void, opt?: { outline?: boolean }): Pix {
  const p = new Pix(w, h);
  draw(p);
  if (!opt || opt.outline !== false) p.outline();
  return p;
}

export function cached(key: string, make: () => Pix): Sprite {
  if (!cache.has(key)) cache.set(key, make().toCanvas());
  return cache.get(key)!;
}

/** 选项：noHi 不要高光，bottom 下沿暗几行 */
export interface ShadeOpt {
  noHi?: boolean;
  bottom?: number;
}

export class Pix {
  declare w: number;
  declare h: number;
  declare d: Px[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill(null);
  }

  set(x: number, y: number, c: Px | undefined | false): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }

  get(x: number, y: number): Px {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.d[y * this.w + x];
  }

  clear(x: number, y: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = null;
  }

  rect(x: number, y: number, w: number, h: number, c: Px | undefined): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  inEll(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  ell(cx: number, cy: number, rx: number, ry: number, c: Px | undefined): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (this.inEll(x, y, cx, cy, rx, ry)) this.set(x, y, c);
  }

  // 有明暗的椭圆：按法线和光的方向选色阶
  sEll(cx: number, cy: number, rx: number, ry: number, hex: string, o?: ShadeOpt): void {
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
  sRect(x: number, y: number, w: number, h: number, hex: string, o?: ShadeOpt): void {
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

  line(x0: number, y0: number, x1: number, y1: number, c: Px | undefined): void {
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
  }

  // 实心多边形（扫描线）
  poly(pts: number[][], c: Px | undefined): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
    }
  }

  // 外轮廓：透明像素挨着有色像素，就涂成那个颜色的描边色
  // 迎光的一边（左上）描边浅一点，背光的一边（右下）深一点，轮廓不那么死板
  outline(only?: (c: string) => boolean): void {
    const add: [number, number, string][] = [];
    const hexAt = (x: number, y: number) => {
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
        const R = ramp(lit ? (below || right)! : n);
        add.push([x, y, lit ? mix(R.line, R.lo, 0.45) : R.line]);
      }
    for (const [x, y, c] of add) this.set(x, y, c);
  }

  // 把 src 叠到自己上面（偏移 ox, oy；mirror 左右翻转）
  blit(src: Pix, ox: number, oy: number, mirror?: boolean): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + x];
        if (c) this.set(ox + (mirror ? src.w - 1 - x : x), oy + y, c);
      }
  }

  recolor(fn: (c: string) => string): void {
    for (let i = 0; i < this.d.length; i++) if (this.d[i] && this.d[i]![0] === '#') this.d[i] = fn(this.d[i]!);
  }

  toCanvas(): Sprite {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
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
}
