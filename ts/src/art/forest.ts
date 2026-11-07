// 花园外面的树林

import { mix } from './color';
import { forestTree } from './icons';
import { Pix, cached } from './pix';
import { DIRT, GRASS, RingTree, fbm, hash2, noise } from './terrain';

// ================= 花园外面的树林 =================
// 拉远看、画面比地图大的时候，地图外面一整片都是树：back 铺在最底下；
// front 是贴着地图四边的一圈树，画在地面上面，盖住地图边上被切开的树冠。出口的小路一直通进树林里
export function forestRing(o: { w: number; h: number; m: number; exits?: Set<string>; border?: number; seed?: number }): { back: HTMLCanvasElement; front: HTMLCanvasElement } {
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
  const bx = back.getContext('2d')!;
  const fx = front.getContext('2d')!;
  bx.fillStyle = '#1d3826';
  bx.fillRect(0, 0, CW, CH);
  // 出口外面的林间小路：一条土路，两边一点草
  const ex = [...(o.exits || [])].map((k) => k.split(',').map(Number));
  const span = (list: number[]) => (list.length ? [Math.min(...list), Math.max(...list)] : null);
  const cuts: { x0: number; x1: number; y0: number; y1: number; a: number; z: number; along: string }[] = [];
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
  const hitsCut = (cx: number, base: number) => cuts.some((c) => cx + 18 > c.x0 && cx - 18 < c.x1 && base > c.y0 + 4 && base - 60 < c.y1);
  const kinds = ['round', 'pine', 'round2', 'round', 'pine', 'round3'];
  const sprite = (kind: string, dark: number) =>
    cached('ring:' + kind + ':' + dark, () => {
      const src = forestTree(kind);
      const q = new Pix(src.w, src.h);
      for (let i = 0; i < src.d.length; i++) {
        const c = src.d[i];
        if (c) q.d[i] = c[0] === '#' ? mix(c, '#1b3324', dark) : c;
      }
      return q;
    });
  const draw = (ctx: CanvasRenderingContext2D, list: RingTree[]) => {
    list.sort((u, v) => u.base - v.base);
    for (const t of list) ctx.drawImage(sprite(t.kind, t.dark), Math.round(t.cx - 24), Math.round(t.base - 71));
  };
  // 整片：一排排错开，往前一排盖住后一排的树干；地图正中间会被地面盖住，不用画
  const all: RingTree[] = [];
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
  const ring: RingTree[] = [];
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
