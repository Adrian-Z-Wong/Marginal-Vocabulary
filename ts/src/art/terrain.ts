// 整块地面和池塘的形状

import { mix } from './color';
import { forestTree } from './icons';
import { Pix, Px } from './pix';

// ================= 整块地面 =================
// 花园的地面不按格子贴图，而是整块画：草地用噪声做出自然的深浅，
// 小路、菜地的边缘不规则地融进草里，四周是一圈树林和灌木，画面像一个小世界

export function hash2(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}
export function noise(x: number, y: number, seed: number): number {
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
export function fbm(x: number, y: number, seed: number): number {
  return noise(x / 24, y / 24, seed) * 0.55 + noise(x / 9, y / 9, seed + 7) * 0.3 + noise(x / 3, y / 3, seed + 13) * 0.15;
}

export const GRASS = ['#4c8a36', '#62a443', '#6fb24a', '#7cbf52', '#92d266'];
const GRASS_SET = new Set<Px>(GRASS);
export const DIRT = ['#b98b5c', '#c99b69', '#d6ab78', '#e2bb88'];
const DIRT_SET = new Set<Px>(DIRT);
const SOIL = ['#6a4630', '#7a5238', '#8a5e40'];
const WET = ['#4a3022', '#56382a', '#634232'];
// 浅水、中、深、最深、岸的影子
const WATER = ['#78bdea', '#5aa2dc', '#4a8fcf', '#3f80c0', '#35699f'];

/** 花园地面：w、h（格子数）、path、soil、wet、water、exits（Set，"x,y"）、pondFn（池塘的形状）、border（外圈几格是树林）、seed */
export interface TerrainOpt {
  w: number;
  h: number;
  path?: Set<string>;
  soil?: Set<string>;
  wet?: Set<string>;
  water?: Set<string>;
  exits?: Set<string>;
  pondFn?: (x: number, y: number) => boolean;
  border?: number;
  seed?: number;
}

/** 外圈树林里的一棵树：cx 中间，base 树根，kind 哪种，dark 压暗多少 */
export interface RingTree {
  cx: number;
  base: number;
  kind: string;
  dark: number;
}

// opts: w、h（格子数）、path、soil、wet（Set，"x,y"）、border（外圈几格是树林）、seed
export function terrain(o: TerrainOpt): HTMLCanvasElement {
  const T = 16;
  const W = o.w * T;
  const H = o.h * T;
  const p = new Pix(W, H);
  const seed = o.seed || 1;
  const has = (set: Set<string> | undefined, x: number, y: number) => set && set.has(x + ',' + y);
  // 小路：到最近的路格子的距离，边缘加一点噪声，看起来是踩出来的土路
  const pathAt = (px: number, py: number) => {
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
  const waterAt = (px: number, py: number) => {
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
    const corner = (cx: number, cy: number) => Math.hypot(lx - cx, ly - cy) > r;
    if (L && U && lx < r && ly < r && corner(r, r)) return false;
    if (R && U && lx > T - 1 - r && ly < r && corner(T - 1 - r, r)) return false;
    if (L && D && lx < r && ly > T - 1 - r && corner(r, T - 1 - r)) return false;
    if (R && D && lx > T - 1 - r && ly > T - 1 - r && corner(T - 1 - r, T - 1 - r)) return false;
    return true;
  };
  const wmask = new Uint8Array(W * H);
  const isW = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && wmask[y * W + x] === 1;
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
    const depth = (x: number, y: number) => {
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
  const gi = (c: Px) => GRASS.indexOf(c!);
  const shade = (c: Px, d: number) => GRASS[Math.max(0, Math.min(4, gi(c) + d))];
  const isG = (x: number, y: number) => GRASS_SET.has(p.get(x, y));
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
  const anyBed = (x: number, y: number) => has(o.soil, x, y) || has(o.wet, x, y);
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
    const open = (x: number, y: number) => o.exits && has(o.exits, Math.floor(x / T), Math.floor(y / T));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const inside = x >= b * T && x < W - b * T && y >= b * T && y < H - b * T;
        // 出口两边留一点草地，不要直接是黑乎乎的树林
        const near = open(x, y) || open(x - 10, y) || open(x + 10, y) || open(x, y - 10) || open(x, y + 10);
        if (!inside && !near) p.set(x, y, '#22402a');
      }
    const kinds = ['round', 'pine', 'round2', 'round', 'pine', 'round3'];
    const trees: RingTree[] = [];
    const add = (cx: number, base: number, dark: number, k: number) => trees.push({ cx: Math.round(cx), base: Math.round(base), dark, kind: kinds[k % kinds.length] });
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
    const blocks = (t: RingTree) => {
      for (let y = t.base - 66; y <= t.base + 2; y += 3) for (let x = t.cx - 22; x <= t.cx + 22; x += 3) if (open(x, y)) return true;
      return false;
    };
    const SHADOWC = '#1e2a16';
    const mixed = new Map<string, string>();
    const darkC = (c: string, t: number) => {
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
    const nearExit = (x: number, y: number) => exitRects.some(([tx, ty]) => x > tx * T - 56 && x < tx * T + T + 56 && y > ty * T - 56 && y < ty * T + T + 56);
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
        if (GRASS_SET.has(c) && (y < b * T + 3 || hash2(x, y, seed + 98) < 0.5)) p.set(x, y, GRASS[Math.max(0, GRASS.indexOf(c!) - 2)]);
      }
  }
  return p.toCanvas();
}

// ================= 池塘的形状 =================
// 格子坐标（可以带小数）。一大一小两个椭圆连成一片，左下边一个小湾，岸线再加一点起伏，看着像天然的池塘
export function pondInside(x: number, y: number): boolean {
  const e = (cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const f = Math.min(e(10.5, 36.6, 8.3, 6.1), e(15.2, 31.4, 3.9, 3.5), e(5.8, 41.0, 3.9, 3.2));
  return f < 1 + (noise(x * 0.9, y * 0.9, 77) - 0.5) * 0.36;
}
