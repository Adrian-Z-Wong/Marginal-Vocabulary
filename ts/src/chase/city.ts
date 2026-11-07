// 俯视的城市地图：一张横平竖直的街道网，小偷从左边出发，拐来拐去跑向他的仓库。
// 地图（路、人行道、斑马线、楼顶、公园、停车场、路边的车和树）开局画一次存成一张大图，
// 每帧只截取镜头看到的那一块。

import { Ctx, parkedSprite, px, shade, treeSprite } from './sprites';

export type TimeOfDay = 'day' | 'dusk' | 'night';

export function timeOfDay(d = new Date()): TimeOfDay {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17) return 'day';
  if ((h >= 17 && h < 19.5) || (h >= 5.5 && h < 7)) return 'dusk';
  return 'night';
}

interface Pal {
  grass: string;
  grassD: string;
  road: string;
  roadD: string;
  walk: string;
  walkD: string;
  curb: string;
  lane: string;
  zebra: string;
  roofs: string[];
  tree: [string, string];
  water: string;
}

const PAL: Record<TimeOfDay, Pal> = {
  day: {
    grass: '#7fb663', grassD: '#6aa152', road: '#555b66', roadD: '#4b505a', walk: '#d7cfc0', walkD: '#c3b9a8', curb: '#a39887',
    lane: '#f0d77a', zebra: '#eeeae0', roofs: ['#c97b5d', '#d9b27a', '#7fa79c', '#a7a9c2', '#c6b29d', '#9b7f6a', '#e0a17a', '#8c9aa8'],
    tree: ['#5ea24b', '#3f7f3a'], water: '#5b9fd0',
  },
  dusk: {
    grass: '#6d9555', grassD: '#5c8247', road: '#4a4b57', roadD: '#40414c', walk: '#c4b3a3', walkD: '#ae9f8f', curb: '#8c7f73',
    lane: '#e8c67a', zebra: '#e6ddd0', roofs: ['#b06a56', '#c49a72', '#6f8f8a', '#9493b0', '#b39c8b', '#8a6d60', '#c98b6c', '#7f8798'],
    tree: ['#4f8445', '#386536'], water: '#5a7fb3',
  },
  night: {
    grass: '#3f5a45', grassD: '#354e3c', road: '#30323c', roadD: '#2a2c35', walk: '#6e6c78', walkD: '#615f6b', curb: '#55535e',
    lane: '#b9a165', zebra: '#9f9da8', roofs: ['#5b4652', '#5e5866', '#3f565a', '#4d4d68', '#5a5058', '#4a4048', '#665058', '#45505e'],
    tree: ['#35593f', '#284634'], water: '#2c4670',
  },
};

/** 固定种子的随机数 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Pt {
  x: number;
  y: number;
}

export const ROAD = 30; // 路宽（含两边人行道）
export const BLOCK = 92; // 两条路之间一块地的宽
export const PITCH = ROAD + BLOCK;
const WALK = 5; // 人行道宽

export class City {
  readonly tod: TimeOfDay;
  readonly width: number;
  readonly height: number;
  /** 路线上的点（已经把拐角磨圆） */
  readonly path: Pt[] = [];
  /** 每个点到起点的距离 */
  private readonly cum: number[] = [];
  readonly length: number;
  /** 路口的路灯 */
  readonly lights: Pt[] = [];
  /** 仓库：门口就在路线的终点 */
  readonly hideout: { x: number; y: number; w: number; h: number; doorX: number; doorY: number; dir: Pt };
  readonly map: HTMLCanvasElement;
  private readonly rand: () => number;
  private readonly nx: number;
  private readonly ny: number;

  /** want：路线大概要多长（画布像素） */
  constructor(seed: number, want: number, tod: TimeOfDay) {
    this.tod = tod;
    this.rand = rng(seed);
    const R = this.rand;
    // 路口格子：横着 i，竖着 j；先走一条不回头的路线（往右为主，时不时拐上拐下）
    this.ny = 5;
    const nodes: [number, number][] = [[0, 2]];
    const seen = new Set(['0,2']);
    let len = 0;
    let last = 'r';
    while (len < want) {
      const [i, j] = nodes[nodes.length - 1];
      const opts: [string, number, number][] = [];
      opts.push(['r', i + 1, j], ['r', i + 1, j]);
      if (last === 'r') opts.push(['r', i + 1, j]);
      if (j > 0 && !seen.has(i + ',' + (j - 1))) opts.push(['u', i, j - 1], ['u', i, j - 1]);
      if (j < this.ny - 1 && !seen.has(i + ',' + (j + 1))) opts.push(['d', i, j + 1], ['d', i, j + 1]);
      const [d, ni, nj] = opts[Math.floor(R() * opts.length)];
      // 上下拐过一次以后，尽量再往右走（不要一直上下绕）
      if ((d === 'u' || d === 'd') && (last === 'u' || last === 'd') && R() < 0.6) continue;
      nodes.push([ni, nj]);
      seen.add(ni + ',' + nj);
      last = d;
      len += PITCH;
    }
    this.nx = nodes[nodes.length - 1][0] + 2;
    this.width = this.nx * PITCH + ROAD;
    this.height = this.ny * PITCH - BLOCK + ROAD + 2 * PITCH;
    const oy = PITCH; // 上面留一排街区
    const center = (i: number, j: number): Pt => ({ x: i * PITCH + ROAD / 2, y: oy + j * PITCH + ROAD / 2 });
    const pts = nodes.map(([i, j]) => center(i, j));
    // 起点往左边多一段，从画面外跑进来
    pts.unshift({ x: pts[0].x - 40, y: pts[0].y });
    // 终点：最后一个路口再往前一点，就是仓库门口
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const dir = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
    const end = { x: b.x + dir.x * 46, y: b.y + dir.y * 46 };
    pts.push(end);
    // 磨圆拐角
    this.path = roundCorners(pts, 12);
    let s = 0;
    this.cum.push(0);
    for (let k = 1; k < this.path.length; k++) {
      s += Math.hypot(this.path[k].x - this.path[k - 1].x, this.path[k].y - this.path[k - 1].y);
      this.cum.push(s);
    }
    this.length = s;
    // 仓库：占终点前面那块地
    const hw = 64;
    const hh = 52;
    this.hideout = {
      x: dir.x > 0 ? end.x + 4 : dir.x < 0 ? end.x - 4 - hw : end.x - hw / 2,
      y: dir.y > 0 ? end.y + 4 : dir.y < 0 ? end.y - 4 - hh : end.y - hh / 2,
      w: hw,
      h: hh,
      doorX: end.x,
      doorY: end.y,
      dir,
    };
    this.map = this.render(oy);
  }

  /** 路线上距离起点 s 的那一点，和那里的方向（弧度） */
  at(s: number): { x: number; y: number; angle: number } {
    const p = this.path;
    const c = this.cum;
    s = Math.max(0, Math.min(this.length, s));
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
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

  private render(oy: number): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.width;
    cv.height = this.height;
    const c = cv.getContext('2d') as Ctx;
    c.imageSmoothingEnabled = false;
    const P = PAL[this.tod];
    const R = this.rand;
    // 草地底色和斑驳
    px(c, 0, 0, this.width, this.height, P.grass);
    for (let k = 0; k < (this.width * this.height) / 90; k++) px(c, Math.floor(R() * this.width), Math.floor(R() * this.height), 2, 1, P.grassD);
    const rows = this.ny + 2;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= this.nx; i++) xs.push(i * PITCH);
    for (let j = -1; j < rows; j++) ys.push(oy + j * PITCH);
    // 街区
    for (let i = 0; i < this.nx; i++) {
      for (const y0 of ys) {
        const bx = i * PITCH + ROAD;
        const by = y0 + ROAD;
        if (by > this.height || by + BLOCK < 0) continue;
        this.block(c, bx, by, P);
      }
    }
    // 路：先横后竖，再画路口
    for (const y0 of ys) this.roadH(c, 0, this.width, y0, P);
    for (const x0 of xs) this.roadV(c, x0, 0, this.height, P);
    for (const x0 of xs) for (const y0 of ys) this.crossing(c, x0, y0, P);
    // 仓库：先把它所在的那块地清成空地，再修一条从路口通到门口的车道
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

  private roadH(c: Ctx, x0: number, x1: number, y: number, P: Pal): void {
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
    // 路面的小斑点
    for (let x = x0; x < x1; x += 3) if (this.rand() < 0.25) px(c, x, y + WALK + 2 + Math.floor(this.rand() * (ROAD - 2 * WALK - 4)), 1, 1, P.roadD);
    // 路边停的车
    for (let x = x0 + 30; x < x1 - 30; x += 40 + Math.floor(this.rand() * 60)) {
      if (this.rand() < 0.45) {
        const s = parkedSprite(CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)]);
        const top = this.rand() < 0.5;
        c.drawImage(s.img, x, top ? y + WALK + 1 : y + ROAD - WALK - 12);
      }
    }
  }

  private roadV(c: Ctx, x: number, y0: number, y1: number, P: Pal): void {
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
  private crossing(c: Ctx, x: number, y: number, P: Pal): void {
    px(c, x + WALK, y + WALK, ROAD - 2 * WALK, ROAD - 2 * WALK, P.road);
    for (let k = 0; k < ROAD - 2 * WALK; k += 3) {
      px(c, x + WALK + k, y - 6, 2, 5, P.zebra);
      px(c, x + WALK + k, y + ROAD + 1, 2, 5, P.zebra);
      px(c, x - 6, y + WALK + k, 5, 2, P.zebra);
      px(c, x + ROAD + 1, y + WALK + k, 5, 2, P.zebra);
    }
    px(c, x + 1, y + 1, 3, 3, '#3b3f4c');
    px(c, x + 2, y + 2, 1, 1, '#ffe7a6');
    this.lights.push({ x: x + 2, y: y + 2 });
  }

  /** 一块地：几栋楼、公园或者停车场 */
  private block(c: Ctx, x: number, y: number, P: Pal): void {
    const R = this.rand;
    const kind = R();
    if (kind < 0.17) return this.park(c, x, y, P);
    if (kind < 0.25) return this.parking(c, x, y, P);
    // 楼：把这块地切成 1–4 栋
    const lots: [number, number, number, number][] = [];
    const split = R();
    if (split < 0.25) lots.push([x + 4, y + 4, BLOCK - 8, BLOCK - 8]);
    else if (split < 0.6) {
      const m = Math.floor(BLOCK * (0.35 + R() * 0.3));
      lots.push([x + 4, y + 4, m - 6, BLOCK - 8], [x + m + 2, y + 4, BLOCK - m - 6, BLOCK - 8]);
    } else {
      const m = Math.floor(BLOCK / 2);
      lots.push([x + 4, y + 4, m - 6, m - 6], [x + m + 2, y + 4, m - 6, m - 6], [x + 4, y + m + 2, m - 6, m - 6], [x + m + 2, y + m + 2, m - 6, m - 6]);
    }
    // 楼和人行道之间的小院子、树
    px(c, x, y, BLOCK, BLOCK, shade(P.grass, -0.05));
    for (const [lx, ly, lw, lh] of lots) this.building(c, lx, ly, lw, lh, P);
    const t = treeSprite(P.tree[0], P.tree[1]);
    for (let k = 0; k < 3; k++) if (R() < 0.5) c.drawImage(t.img, x + Math.floor(R() * (BLOCK - 16)), y + (R() < 0.5 ? -4 : BLOCK - 12));
  }

  private building(c: Ctx, x: number, y: number, w: number, h: number, P: Pal): void {
    const R = this.rand;
    const roof = P.roofs[Math.floor(R() * P.roofs.length)];
    // 影子（往右下）
    c.fillStyle = 'rgba(15,15,30,.28)';
    c.fillRect(x + 4, y + 4, w, h);
    px(c, x, y, w, h, shade(roof, -0.35));
    px(c, x + 1, y + 1, w - 2, h - 2, roof);
    // 女儿墙的高光和暗边
    px(c, x + 1, y + 1, w - 2, 1, shade(roof, 0.25));
    px(c, x + 1, y + h - 2, w - 2, 1, shade(roof, -0.2));
    // 屋顶上的东西：空调外机、水箱、天窗、通风口
    const n = 2 + Math.floor(R() * 4);
    for (let k = 0; k < n; k++) {
      const ax = x + 4 + Math.floor(R() * Math.max(1, w - 14));
      const ay = y + 4 + Math.floor(R() * Math.max(1, h - 14));
      const t = R();
      if (t < 0.35) {
        px(c, ax, ay, 7, 5, '#9aa0aa');
        px(c, ax, ay + 4, 7, 1, '#6c717b');
        px(c, ax + 2, ay + 1, 3, 3, '#5d626c');
      } else if (t < 0.55) {
        px(c, ax + 1, ay, 6, 8, '#7a6252');
        px(c, ax, ay + 1, 8, 6, '#7a6252');
        px(c, ax + 2, ay + 2, 4, 4, '#94796a');
      } else if (t < 0.8) {
        const lit = this.tod !== 'day' && R() < 0.6;
        px(c, ax, ay, 9, 6, '#3d4a5a');
        px(c, ax + 1, ay + 1, 7, 4, lit ? '#ffd780' : '#6f8fa8');
        px(c, ax + 4, ay + 1, 1, 4, '#3d4a5a');
      } else {
        px(c, ax, ay, 3, 3, '#4b4f58');
      }
    }
  }

  private park(c: Ctx, x: number, y: number, P: Pal): void {
    const R = this.rand;
    px(c, x, y, BLOCK, BLOCK, shade(P.grass, 0.06));
    // 十字小路
    const pathC = shade(P.walk, -0.05);
    px(c, x + BLOCK / 2 - 3, y, 6, BLOCK, pathC);
    px(c, x, y + BLOCK / 2 - 3, BLOCK, 6, pathC);
    // 中间一个小水池
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
      px(c, cx - 4, cy - 4, 3, 1, '#ffffff');
    }
    const t = treeSprite(P.tree[0], P.tree[1]);
    for (let k = 0; k < 9; k++) {
      const tx = x + 2 + Math.floor(R() * (BLOCK - 18));
      const ty = y + 2 + Math.floor(R() * (BLOCK - 18));
      if (Math.abs(tx + 8 - (x + BLOCK / 2)) < 18 && Math.abs(ty + 8 - (y + BLOCK / 2)) < 18) continue;
      c.drawImage(t.img, tx, ty);
    }
    // 长椅
    px(c, x + BLOCK / 2 + 6, y + 10, 10, 3, '#8a5a3a');
    px(c, x + 10, y + BLOCK / 2 + 6, 3, 10, '#8a5a3a');
  }

  private parking(c: Ctx, x: number, y: number, P: Pal): void {
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

  private hideoutRoof(c: Ctx): void {
    const h = this.hideout;
    c.fillStyle = 'rgba(15,15,30,.3)';
    c.fillRect(h.x + 4, h.y + 4, h.w, h.h);
    px(c, h.x, h.y, h.w, h.h, '#2d2833');
    px(c, h.x + 1, h.y + 1, h.w - 2, h.h - 2, '#4a4152');
    // 波纹铁皮屋顶
    for (let k = 3; k < h.w - 2; k += 4) px(c, h.x + k, h.y + 2, 1, h.h - 4, '#3c3444');
    // 门口的黄黑警戒线
    const d = h.dir;
    const len = 26;
    for (let k = 0; k < len; k += 4) {
      const col = (k / 4) % 2 ? '#1c1a20' : '#e8b931';
      if (d.x) px(c, d.x > 0 ? h.x : h.x + h.w - 3, h.doorY - len / 2 + k, 3, 4, col);
      else px(c, h.doorX - len / 2 + k, d.y > 0 ? h.y : h.y + h.h - 3, 4, 3, col);
    }
    // 屋顶上的一个「？」牌子
    const sx = h.x + h.w / 2 - 5;
    const sy = h.y + h.h / 2 - 7;
    px(c, sx, sy, 11, 14, '#e8b931');
    px(c, sx + 3, sy + 2, 5, 2, '#1c1a20');
    px(c, sx + 6, sy + 4, 2, 2, '#1c1a20');
    px(c, sx + 4, sy + 6, 3, 2, '#1c1a20');
    px(c, sx + 4, sy + 10, 3, 2, '#1c1a20');
  }
}

const CAR_COLORS = ['#c94a3f', '#3f6fc9', '#e6c34a', '#6d8b5a', '#e8e4dc', '#3a3d47', '#8a5ab0', '#e08a3c'];

/** 把折线的每个拐角换成一小段圆弧 */
function roundCorners(pts: Pt[], r: number): Pt[] {
  const out: Pt[] = [pts[0]];
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
      // 二次贝塞尔：p1 → b → p2
      out.push({ x: (1 - u) * (1 - u) * p1.x + 2 * (1 - u) * u * b.x + u * u * p2.x, y: (1 - u) * (1 - u) * p1.y + 2 * (1 - u) * u * b.y + u * u * p2.y });
    }
    out.push(p2);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
