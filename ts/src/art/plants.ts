// 植物：树、花、灌木、草

import { lighten, mix, ramp } from './color';
import { Pix, Px } from './pix';

// ================= 植物 =================

/** 一个椭圆：中心 x、y，半径 rx、ry */
export type Blob = number[];
/** 果子、花点：x、y、颜色 */
export type Dot = [number, number, string];

/** 树：shape 树冠的形状，leaf 叶子，trunk 树干，dots 果子，blossom / flower / center 花，petals 飘落的花瓣，marks 树皮的斑点，hang 垂下来的花串 */
export interface TreeSpec {
  shape: string;
  leaf: string;
  trunk?: string;
  dots?: string;
  blossom?: string;
  petals?: string;
  marks?: string;
  hang?: string;
  flower?: string;
  center?: string;
}

// 树冠：先画暗的底层，再叠亮的团块，最后点几个高光，叶子看起来有层次
export function canopy(p: Pix, blobs: Blob[], color: string, speck?: number[][], dots?: Dot[]): void {
  const R = ramp(color);
  for (const [x, y, rx, ry] of blobs) p.ell(x + 1, y + 1.5, rx, ry, R.lo);
  for (const [x, y, rx, ry] of blobs) p.sEll(x, y, rx, ry, color);
  for (const [x, y, rx, ry] of blobs) p.ell(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.3, R.hi);
  const leaf = new Set<Px>([R.lo, R.mid, R.base, R.hi, color]);
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
  const cut: number[][] = [];
  const add: number[][] = [];
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
const ROUND = [[16, 23, 12, 8], [8, 17, 7, 7], [24, 17, 7, 7], [16, 11, 9, 8], [11, 9, 5, 4], [21, 9, 5, 4]];
const SPECK = [[12, 14], [19, 12], [9, 21], [25, 22], [16, 26]];

// 树：同一套画法按比例 S 画两种大小——S = 1 是小树（32×48），S = 1.5 是长大的树（48×72）。
// 坐标都按 32×48 写，画的时候乘以 S；叶子的纹理按像素生成，放大以后细节更多，不会糊。
export const TREE_SPECS: Record<string, TreeSpec> = {
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
  // 开花的树没有叶子
  plum: { shape: 'blossom', trunk: '#4a3530', flower: '#e85d75', center: '#f6d35b' } as TreeSpec,
  magnolia: { shape: 'blossom', trunk: '#6a5040', flower: '#f8e8f0', center: '#e8a0c0' } as TreeSpec,
  pine: { shape: 'pine', leaf: '#3f7d4f' },
  cypress: { shape: 'column', leaf: '#3f6f4a' },
  palm: { shape: 'palm', leaf: '#5aa05a' },
  bamboo: { shape: 'bamboo', leaf: '#6aa35a' },
  cactus: { shape: 'cactus', leaf: '#5f9e4f' },
};

// 树冠：先按几个椭圆圈出形状，再在里面排一团团小叶簇；每团左上亮、右下暗，团和团之间露出深色的缝，
// 上面的团整体亮一点、下面的暗一点；边上的叶簇稍微探出轮廓，边缘就是一团一团的
function leafClumps(p: Pix, blobs: Blob[], color: string, o?: { r?: number; seed?: number; dots?: Dot[] | null }): void {
  o = o || {};
  const R = ramp(color);
  const r = o.r || 4;
  const inMask = (x: number, y: number) => blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
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
  const hsh = (a: number, b: number) => {
    let h = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const step = r * 1.3;
  const pts: number[][] = [];
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
function trunkS(p: Pix, S: number, color: string, top: number, w: number, marks?: string): void {
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

export function drawTree(p: Pix, sp: string | TreeSpec, S: number): void {
  const t = typeof sp === 'string' ? TREE_SPECS[sp] || TREE_SPECS.oak : sp;
  const q = (v: number) => v * S;
  const B = (list: Blob[]) => list.map(([x, y, rx, ry]) => [q(x), q(y), q(rx), q(ry)]);
  const TR = t.trunk || '#8a5a3b';
  const shade = (rx: number) => p.ell(q(16), q(46) - 0.5, q(rx), 2.2 * S, 'rgba(40,30,20,.24)');
  const stem = (top: number, _h: number, w?: number) => trunkS(p, S, TR, top, w || 5, t.marks);
  const canopy = (blobs: Blob[], color: string, _speck?: number[][] | null, dts?: Dot[] | null) => leafClumps(p, blobs, color, { r: 4.2 * S, dots: dts, seed: color.length + blobs.length });
  const speck = (list: number[][]) => list.map(([x, y]) => [Math.round(q(x)), Math.round(q(y))]);
  const dots = (list: number[][], c?: string): Dot[] | null => (c ? list.map(([x, y]) => [Math.round(q(x)), Math.round(q(y)), c] as Dot) : null);
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
      const H = ramp(t.hang!);
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
      const R = ramp(t.trunk!);
      // 枝条：从树干往上分叉
      for (const [x1, y1, x2, y2] of [[16, 28, 7, 12], [16, 27, 25, 10], [16, 26, 16, 4], [11, 19, 4, 14], [21, 18, 28, 16], [16, 15, 11, 6], [16, 14, 21, 5]]) {
        p.line(q(x1), q(y1), q(x2), q(y2), t.trunk);
        if (S > 1) p.line(q(x1) + 1, q(y1), q(x2) + 1, q(y2), R.mid);
      }
      const spots = [[7, 12], [4, 14], [25, 10], [28, 16], [16, 4], [11, 6], [21, 5], [9, 16], [22, 13], [13, 10], [19, 9], [14, 18], [18, 17], [6, 9], [26, 7], [16, 11]];
      // 一簇簇的花：用叶簇的画法画成小团，再点上花心
      leafClumps(p, spots.map(([x, y]) => [q(x), q(y), 2.3 * S, 2 * S]), t.flower!, { r: 1.7 * S, seed: 7 });
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
export function treeSeed(p: Pix): void {
  p.ell(8, 13.5, 5.5, 2.4, '#7a5238');
  p.ell(8, 12.8, 4.5, 1.8, '#8a5e40');
  p.sEll(8, 11.5, 1.6, 1.3, '#c8a06a');
}
export function treeSprout(p: Pix, sp: string): void {
  const t = TREE_SPECS[sp] || TREE_SPECS.oak;
  p.ell(8, 14, 4.5, 1.6, '#7a5238');
  p.rect(8, 8, 1, 6, '#5f8a42');
  const leaf = t.shape === 'cactus' ? t.leaf : '#6aa35a';
  p.sEll(5.5, 8, 2.6, 1.6, leaf);
  p.sEll(10.5, 7, 2.6, 1.6, leaf);
}
export function treeSapling(p: Pix, sp: string): void {
  const t = TREE_SPECS[sp] || TREE_SPECS.oak;
  p.ell(8, 30.5, 5, 1.5, 'rgba(40,30,20,.22)');
  p.sRect(7, 16, 2, 15, t.trunk && t.shape !== 'blossom' ? t.trunk : '#8a5a3b', { noHi: true });
  const c = t.shape === 'blossom' ? '#6aa35a' : t.leaf;
  canopy(p, [[8, 14, 5, 4], [4.5, 18, 3, 2.4], [11.5, 17, 3, 2.4], [8, 9, 3.5, 3]], c);
  if (t.shape === 'blossom') for (const [x, y] of [[6, 12], [10, 10], [9, 16]]) p.set(x, y, t.flower);
}

export const forestCacheSpecs: Record<string, TreeSpec> = {
  round: { shape: 'round', leaf: '#4f8f42', trunk: '#6a4632' },
  round2: { shape: 'oval', leaf: '#4a8a4a', trunk: '#6a4632' },
  round3: { shape: 'maple', leaf: '#4f8f42', trunk: '#6a4632' },
  pine: { shape: 'pine', leaf: '#2f6a45', trunk: '#6a4632' },
};

// 花（16×16，向日葵长高以后 16×24）：stage 0 刚种下、1 发芽、2 花苞、3 开花。
// 一株是一小丛：底下两片宽叶子，两三根茎，顶上的花是一格一格手画的。
// 字母：h 高光、b 本色、m 暗部、l 最暗、w 白、W 白的暗部、y 黄、Y 黄的暗部、k 花心、K 花心暗部
/** 花：c 颜色，bloom 花朵的像素图，at 花朵的位置，tall 长高以后 16×24，spikes 穗状花序，bells 铃铛一样的花 */
export interface FlowerSpec {
  c: string;
  bloom?: string[];
  at?: number[][];
  tall?: boolean;
  spikes?: number[][];
  bells?: number[][];
}

export const FLOWERS: Record<string, FlowerSpec> = {
  tulip: { c: '#e85d75', bloom: ['h.b.m', 'hbhbm', 'bbbbm', 'mbbml', '.mml.'], at: [[2, 4], [9, 1], [6, 7]] },
  rose: { c: '#ef7fa0', bloom: ['.hbb.', 'hbmhm', 'bmhml', 'mbmbl', '.mll.'], at: [[1, 5], [9, 2], [6, 0]] },
  daisy: { c: '#fbf7ef', bloom: ['..w.w..', '.wwwww.', 'wwyyyww', '.wyYyW.', 'wwyYYWW', '.wWWWW.', '..W.W..'], at: [[0, 4], [8, 1]] },
  sunflower: { c: '#f6c33b', tall: true, bloom: ['..y.y.y..', '.yyyyyyy.', 'yyKkkkKyy', '.yKkKkkY.', 'yyKkkkKYy', '.yKkkKkY.', 'yyKKkKKYy', '.yYYYYYY.', '..Y.Y.Y..'], at: [[3, 0]] },
  lavender: { c: '#9b7fd1', spikes: [[4, 3], [8, 1], [12, 4]] },
  bluebell: { c: '#5a8fe0', bells: [[3, 6], [6, 8], [10, 4], [13, 6]] },
};
const LEAF = '#5f9e4f';
const STEM = '#4a8a3c';

function soilMound(p: Pix): void {
  const H = p.h;
  p.ell(8, H - 2.2, 5.2, 1.7, '#7a5238');
  p.ell(8, H - 2.7, 4.2, 1.1, '#8a6244');
  p.set(6, H - 2, '#5e3e2a');
  p.set(10, H - 2, '#5e3e2a');
}
// 底下两片宽叶子
function leafPair(p: Pix, big?: boolean): void {
  const H = p.h;
  const L = ramp(LEAF);
  const w = big ? 7 : 5;
  p.poly([[8, H - 2], [8 - w, H - 7], [8 - w + 1, H - 5], [7, H - 3]], LEAF);
  p.line(8 - w + 1, H - 6, 7, H - 3, L.hi);
  p.poly([[9, H - 2], [8 + w, H - 8], [8 + w - 1, H - 5], [10, H - 3]], L.mid);
  p.line(9, H - 3, 8 + w - 1, H - 7, L.base);
}
function bloomAt(p: Pix, map: string[], x0: number, y0: number, c: string): void {
  const R = ramp(c);
  const col: Record<string, string> = { h: R.hi, b: c, m: R.mid, l: R.lo, w: '#fbf7ef', W: '#d8d0c4', y: '#f6c33b', Y: '#d89a2a', k: '#7a4a2a', K: '#5a3420' };
  map.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') p.set(x0 + i, y0 + j, col[row[i]]);
  });
}
export function flower(p: Pix, kind: string, stage: number): void {
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
  const heads = (F.spikes || F.bells || F.at)!;
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
  if (F.bloom) for (const [x, y] of F.at!) bloomAt(p, F.bloom, x, y, F.c);
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
export const SHRUBS: Record<string, { c: string; dots?: string; big?: boolean }> = {
  bush: { c: '#5f9e4f' },
  berry: { c: '#4f8a43', dots: '#d64545' },
  hydrangea: { c: '#5c9a4a', dots: '#8aa8e8', big: true },
};
export function shrub(p: Pix, kind: string, stage: number): void {
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
export const GRASSES: Record<string, { c: string; head?: string; tall?: boolean }> = {
  clover: { c: '#5fae4a' },
  foxtail: { c: '#7ba84a', head: '#c8c27a' },
  fountain: { c: '#6a9e4a', head: '#e0a8b8', tall: true },
  pampas: { c: '#8aa86a', head: '#f2ead2', tall: true },
};
export function grassPlant(p: Pix, kind: string, stage: number): void {
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
  const blade = (x0: number, h: number, lean: number, c?: string) => {
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
        p.set(x + d * Math.floor(k / 2) + 1, y - 1 + k, ramp(G.head!).mid);
      }
      p.set(x, y - 2, ramp(G.head!).hi);
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
      for (let i = 0; i < ww; i++) p.set(xx + i, y - k, (k + i) % 3 === 0 ? ramp(G.head!).mid : i === 0 ? ramp(G.head!).hi : G.head);
    }
  }
}
