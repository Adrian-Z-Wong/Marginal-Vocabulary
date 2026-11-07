// 斜 45° 俯视（等距视角）的城市：地面是一格格菱形，街道斜着穿过画面，楼房看得到两面墙和屋顶。
// 小偷沿着一条台阶形的路线跑：往右上、往右下拐来拐去，一直跑到他的仓库。
// 地面（草地、马路、人行道、斑马线、公园、停车场）开局画成一张大图；楼、树、路边的车各自先画好，
// 每帧按前后顺序和警车、小偷一起画，前面的楼挡住后面的人。

import { shade } from './sprites';

export type Ctx = CanvasRenderingContext2D;
export type TimeOfDay = 'day' | 'dusk' | 'night';

export function timeOfDay(d = new Date()): TimeOfDay {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17) return 'day';
  if ((h >= 17 && h < 19.5) || (h >= 5.5 && h < 7)) return 'dusk';
  return 'night';
}

/** 一格的宽和高（菱形） */
export const TW = 32;
export const TH = 16;
const ROAD = 2; // 路宽（格）
const BLOCK = 8; // 一块地的宽（含一圈人行道）
export const PITCH = ROAD + BLOCK;
const MAX_H = 64; // 最高的楼有多高（像素）

interface Pal {
  grass: string;
  grassD: string;
  road: string;
  roadD: string;
  walk: string;
  walkD: string;
  lane: string;
  zebra: string;
  walls: string[];
  window: string;
  lit: string;
  litRate: number;
  tree: [string, string];
  water: string;
}

const PAL: Record<TimeOfDay, Pal> = {
  day: {
    grass: '#86bd68', grassD: '#78ae5c', road: '#5b616c', roadD: '#535862', walk: '#dcd3c3', walkD: '#c8bdaa', lane: '#f2d977', zebra: '#f2eee6',
    walls: ['#e3a982', '#e8cf9a', '#9fc3b6', '#b8bad6', '#d9c3ac', '#c98f78', '#a7b8c9', '#efe2c9'], window: '#9fcbe3', lit: '#ffe39a', litRate: 0,
    tree: ['#5fa54c', '#3e7f3a'], water: '#62a6d6',
  },
  dusk: {
    grass: '#719a58', grassD: '#658d4d', road: '#4c4e5a', roadD: '#45474f', walk: '#c9b8a8', walkD: '#b3a493', lane: '#e8c67a', zebra: '#e6ddd0',
    walls: ['#c48268', '#cfae82', '#7f9f97', '#9a99b6', '#bba18e', '#a9705e', '#8796a6', '#d6c4a8'], window: '#5e6c86', lit: '#ffd27a', litRate: 0.4,
    tree: ['#4f8445', '#386536'], water: '#5a7fb3',
  },
  night: {
    grass: '#3e5a45', grassD: '#38513e', road: '#30323c', roadD: '#2b2d36', walk: '#6e6c78', walkD: '#62606c', lane: '#b49d62', zebra: '#9f9da8',
    walls: ['#5b4a58', '#635c6c', '#41595d', '#4f4f6b', '#5d525c', '#4c424c', '#465264', '#6a5f62'], window: '#2b3248', lit: '#ffd27a', litRate: 0.5,
    tree: ['#35593f', '#284634'], water: '#2c4670',
  },
};

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

export interface G {
  gx: number;
  gy: number;
}

/** 地图上的一样东西：楼、树、路边的车。按 depth 从小到大画（越大越靠前） */
export interface Thing {
  img: HTMLCanvasElement;
  x: number; // 在大地图上的位置（左上角）
  y: number;
  depth: number;
  /** 占地的最远角（格子坐标）：人在这两条线以外，就在这样东西前面 */
  mx: number;
  my: number;
  g?: G;
  car?: boolean;
}

const CAR_COLORS = ['#c94a3f', '#3f6fc9', '#e6c34a', '#6d8b5a', '#e8e4dc', '#3a3d47', '#8a5ab0', '#e08a3c'];

export class IsoCity {
  readonly tod: TimeOfDay;
  readonly gw: number; // 地图有多少格
  readonly gh: number;
  readonly width: number; // 大地图的像素大小
  readonly height: number;
  readonly ox: number;
  readonly oy: number;
  readonly ground: HTMLCanvasElement;
  readonly things: Thing[] = [];
  readonly lamps: G[] = [];
  /** 路线（格子坐标，拐角已磨圆） */
  readonly path: G[];
  private readonly cum: number[] = [];
  readonly length: number; // 路线长度（格）
  readonly hideout: G; // 仓库门口
  readonly house: { gx: number; gy: number; w: number; d: number }; // 仓库占的地
  private readonly rand: () => number;
  private readonly P: Pal;

  constructor(seed: number, wantCells: number, tod: TimeOfDay) {
    this.tod = tod;
    this.P = PAL[tod];
    this.rand = rng(seed);
    const R = this.rand;
    // 路口：往右下（+gx）或者往右上（-gy）走，台阶一样拐来拐去
    const steps = Math.max(6, Math.ceil(wantCells / PITCH));
    let i = 0;
    let j = 0;
    const nodes: [number, number][] = [[0, 0]];
    let last = R() < 0.5 ? 'x' : 'y';
    let run = 0;
    for (let k = 0; k < steps; k++) {
      // 同一个方向走一到两段就拐
      const turn = run >= 2 || (run >= 1 && R() < 0.55);
      const d = turn ? (last === 'x' ? 'y' : 'x') : last;
      if (d === last) run++;
      else run = 1;
      last = d;
      if (d === 'x') i++;
      else j++;
      nodes.push([i, j]);
    }
    // 最后一段往右上（-gy）走，仓库的门就开在看得见的那面墙上
    if (last === 'x') {
      j++;
      nodes.push([i, j]);
    }
    // 格子坐标：路口在 (i·PITCH + 1, (J - j)·PITCH + 1)，四周各留一块地
    const J = j;
    const margin = 1;
    this.gw = (i + 2 * margin + 1) * PITCH + ROAD;
    this.gh = (J + 2 * margin + 1) * PITCH + ROAD;
    const node = (a: number, b: number): G => ({ gx: (a + margin) * PITCH + ROAD / 2, gy: (J - b + margin) * PITCH + ROAD / 2 });
    const pts = nodes.map(([a, b]) => node(a, b));
    // 起点往回退一点（从画面外跑进来）；终点再往前一点，就是仓库门口
    const d0 = dirOf(pts[0], pts[1]);
    pts.unshift({ gx: pts[0].gx - d0.gx * 3, gy: pts[0].gy - d0.gy * 3 });
    const dn = dirOf(pts[pts.length - 2], pts[pts.length - 1]);
    const end = { gx: pts[pts.length - 1].gx + dn.gx * 3.2, gy: pts[pts.length - 1].gy + dn.gy * 3.2 };
    pts.push(end);
    this.hideout = end;
    // 仓库横在这条路的尽头，门对着追过来的方向
    this.house = { gx: end.gx - 2.6, gy: end.gy - 5.4, w: 5.2, d: 5.2 };
    this.path = roundCorners(pts, 0.8);
    let s = 0;
    this.cum.push(0);
    for (let k = 1; k < this.path.length; k++) {
      s += Math.hypot(this.path[k].gx - this.path[k - 1].gx, this.path[k].gy - this.path[k - 1].gy);
      this.cum.push(s);
    }
    this.length = s;
    // 屏幕坐标：sx = (gx − gy)·TW/2 + ox，sy = (gx + gy)·TH/2 + oy
    this.ox = this.gh * (TW / 2);
    this.oy = MAX_H + 20;
    this.width = (this.gw + this.gh) * (TW / 2);
    this.height = (this.gw + this.gh) * (TH / 2) + this.oy + 10;
    this.ground = this.drawGround();
  }

  /** 格子坐标 → 大地图上的像素 */
  sx(g: G): number {
    return (g.gx - g.gy) * (TW / 2) + this.ox;
  }
  sy(g: G): number {
    return (g.gx + g.gy) * (TH / 2) + this.oy;
  }

  /** 路线上离起点 s 格的那一点和方向 */
  at(s: number): G & { dir: G } {
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
    const dx = p[hi].gx - p[lo].gx;
    const dy = p[hi].gy - p[lo].gy;
    const len = Math.hypot(dx, dy) || 1;
    return { gx: p[lo].gx + dx * t, gy: p[lo].gy + dy * t, dir: { gx: dx / len, gy: dy / len } };
  }

  // ---------------- 地面 ----------------

  private cellKind(gx: number, gy: number): 'road' | 'walk' | 'block' {
    const mx = ((gx % PITCH) + PITCH) % PITCH;
    const my = ((gy % PITCH) + PITCH) % PITCH;
    if (mx < ROAD || my < ROAD) return 'road';
    if (mx === ROAD || my === ROAD || mx === PITCH - 1 || my === PITCH - 1) return 'walk';
    return 'block';
  }

  private diamond(c: Ctx, gx: number, gy: number, w: number, h: number, color: string): void {
    // 从格子 (gx, gy) 开始、宽 w 格、深 h 格的一块地
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

  private drawGround(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.width;
    cv.height = this.height;
    const c = cv.getContext('2d') as Ctx;
    const P = this.P;
    const R = this.rand;
    c.fillStyle = '#2b2e38';
    c.fillRect(0, 0, this.width, this.height);
    // 一格一格铺地
    for (let gy = 0; gy < this.gh; gy++) {
      for (let gx = 0; gx < this.gw; gx++) {
        const k = this.cellKind(gx, gy);
        const col = k === 'road' ? ((gx + gy) % 7 === 0 ? P.roadD : P.road) : k === 'walk' ? ((gx + gy) % 2 ? P.walk : P.walkD) : (gx * 7 + gy * 13) % 5 === 0 ? P.grassD : P.grass;
        this.diamond(c, gx, gy, 1, 1, col);
      }
    }
    // 车道线和斑马线
    c.lineWidth = 1;
    for (let bx = 0; bx * PITCH < this.gw; bx++) {
      for (let by = 0; by * PITCH < this.gh; by++) {
        const x0 = bx * PITCH;
        const y0 = by * PITCH;
        // 沿 gx 方向的路（gy 在 y0..y0+2）中线虚线
        for (let t = ROAD + 0.6; t < PITCH - 0.4; t += 1.2) this.dash(c, { gx: x0 + t, gy: y0 + 1 }, { gx: x0 + t + 0.55, gy: y0 + 1 }, P.lane);
        // 沿 gy 方向的路
        for (let t = ROAD + 0.6; t < PITCH - 0.4; t += 1.2) this.dash(c, { gx: x0 + 1, gy: y0 + t }, { gx: x0 + 1, gy: y0 + t + 0.55 }, P.lane);
        // 斑马线：路口四边
        for (let k = 0; k < 4; k++) {
          const u = 0.15 + k * 0.45;
          this.stripe(c, { gx: x0 + ROAD + 0.15, gy: y0 + u }, { gx: x0 + ROAD + 0.75, gy: y0 + u }, P.zebra);
          this.stripe(c, { gx: x0 - 0.75, gy: y0 + u }, { gx: x0 - 0.15, gy: y0 + u }, P.zebra);
          this.stripe(c, { gx: x0 + u, gy: y0 + ROAD + 0.15 }, { gx: x0 + u, gy: y0 + ROAD + 0.75 }, P.zebra);
          this.stripe(c, { gx: x0 + u, gy: y0 - 0.75 }, { gx: x0 + u, gy: y0 - 0.15 }, P.zebra);
        }
        // 路灯：每个路口的北角
        this.lamps.push({ gx: x0 + ROAD + 0.4, gy: y0 + ROAD + 0.4 });
      }
    }
    // 每一块地：楼、公园或者停车场；仓库压着的地铺成空场
    const hs = this.house;
    const nearHouse = (gx: number, gy: number, w: number, d: number) => gx < hs.gx + hs.w + 1 && gx + w > hs.gx - 1 && gy < hs.gy + hs.d + 1 && gy + d > hs.gy - 1;
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
    // 路边停的车、人行道上的树
    for (let bx = 0; bx * PITCH < this.gw; bx++) {
      for (let by = 0; by * PITCH < this.gh; by++) {
        const x0 = bx * PITCH;
        const y0 = by * PITCH;
        for (let t = ROAD + 1.5; t < PITCH - 1; t += 2.5 + R() * 2) {
          if (R() < 0.3) this.parked({ gx: x0 + t, gy: y0 + (R() < 0.5 ? 0.35 : 1.65) }, 'x');
          if (R() < 0.3) this.parked({ gx: x0 + (R() < 0.5 ? 0.35 : 1.65), gy: y0 + t }, 'y');
          if (R() < 0.35) this.tree({ gx: x0 + t, gy: y0 + ROAD + 0.5 }, 0.8);
          if (R() < 0.35) this.tree({ gx: x0 + ROAD + 0.5, gy: y0 + t }, 0.8);
        }
      }
    }
    // 路线经过的地方不停车；仓库那块地上什么都不放
    const onRoute = (g: G) => this.path.some((p) => Math.abs(p.gx - g.gx) < 1.1 && Math.abs(p.gy - g.gy) < 1.1);
    for (let k = this.things.length - 1; k >= 0; k--) {
      const t = this.things[k];
      if (t.g && ((t.car && onRoute(t.g)) || nearHouse(t.g.gx, t.g.gy, 0, 0))) this.things.splice(k, 1);
    }
    // 仓库：门开在朝 +gy 的那面墙（看得见的一面），正对路线
    this.diamond(c, hs.gx - 0.6, hs.gy - 0.6, hs.w + 1.2, hs.d + 1.2, shade(P.road, 0.04));
    this.box(hs.gx, hs.gy, hs.w, hs.d, 34, { wall: '#6a5f70', roof: '#4a4152', door: { gx: this.hideout.gx, gy: hs.gy + hs.d }, sign: true });
    this.things.sort((a, b) => a.depth - b.depth);
    return cv;
  }

  private dash(c: Ctx, a: G, b: G, color: string): void {
    c.strokeStyle = color;
    c.beginPath();
    c.moveTo(this.sx(a), this.sy(a));
    c.lineTo(this.sx(b), this.sy(b));
    c.stroke();
  }

  private stripe(c: Ctx, a: G, b: G, color: string): void {
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
  private buildings(x0: number, y0: number): void {
    const R = this.rand;
    const lots: [number, number, number, number][] = [];
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
  private box(x: number, y: number, w: number, d: number, h: number, opt?: { wall?: string; roof?: string; door?: G; sign?: boolean }): void {
    const R = this.rand;
    const P = this.P;
    const wall = opt?.wall || P.walls[Math.floor(R() * P.walls.length)];
    const roof = opt?.roof || shade(wall, -0.18);
    // 四个底角的屏幕坐标（相对于这张小图）
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
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d') as Ctx;
    const p = (g: G, up = 0): [number, number] => [this.sx(g) - left, this.sy(g) - top - up];
    const poly = (pts: [number, number][], color: string) => {
      c.fillStyle = color;
      c.beginPath();
      pts.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b)));
      c.closePath();
      c.fill();
    };
    // 影子（往右下落在地上）
    poly([p(B), p({ gx: B.gx + 0.9, gy: B.gy + 0.2 }), p({ gx: C.gx + 0.9, gy: C.gy + 0.4 }), p({ gx: D.gx + 0.3, gy: D.gy + 0.4 }), p(D), p(C)], 'rgba(15,15,30,.22)');
    // 右面墙（朝 +gx）：中间色；左面墙（朝 +gy）：暗一点
    const rightWall = shade(wall, -0.08);
    const leftWall = shade(wall, -0.28);
    poly([p(B), p(C), p(C, h), p(B, h)], rightWall);
    poly([p(D), p(C), p(C, h), p(D, h)], leftWall);
    // 窗户：每层一排
    const floors = Math.max(1, Math.floor((h - 6) / 9));
    const lit = (k: number) => R() < P.litRate || k < 0;
    const winOn = (g0: G, g1: G, base: string) => {
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
    // 墙角的竖线、屋檐
    c.strokeStyle = shade(wall, -0.45);
    c.lineWidth = 1;
    c.beginPath();
    const [cx, cy] = p(C);
    c.moveTo(cx, cy);
    c.lineTo(cx, cy - h);
    c.stroke();
    // 屋顶
    poly([p(A, h), p(B, h), p(C, h), p(D, h)], roof);
    const inset = 0.2;
    poly(
      [p({ gx: A.gx + inset, gy: A.gy + inset }, h), p({ gx: B.gx - inset, gy: B.gy + inset }, h), p({ gx: C.gx - inset, gy: C.gy - inset }, h), p({ gx: D.gx + inset, gy: D.gy - inset }, h)],
      shade(roof, 0.12),
    );
    // 屋顶上的空调外机、水箱
    const n = Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const g = { gx: x + 0.6 + R() * (w - 1.4), gy: y + 0.6 + R() * (d - 1.4) };
      const [ax, ay] = p(g, h);
      c.fillStyle = '#8f949e';
      c.fillRect(Math.round(ax) - 3, Math.round(ay) - 4, 6, 4);
      c.fillStyle = '#6d727c';
      c.fillRect(Math.round(ax) - 3, Math.round(ay), 6, 1);
    }
    if (opt?.door) {
      const [dx, dy] = p(opt.door);
      c.fillStyle = '#16141a';
      c.fillRect(Math.round(dx) - 7, Math.round(dy) - 14, 14, 14);
    }
    if (opt?.sign) {
      const [sx, sy] = p({ gx: x + w / 2, gy: y + d / 2 }, h);
      c.fillStyle = '#e8b931';
      c.fillRect(Math.round(sx) - 6, Math.round(sy) - 12, 12, 12);
      c.fillStyle = '#1c1a20';
      c.fillRect(Math.round(sx) - 2, Math.round(sy) - 10, 4, 2);
      c.fillRect(Math.round(sx), Math.round(sy) - 8, 2, 2);
      c.fillRect(Math.round(sx) - 1, Math.round(sy) - 6, 2, 2);
      c.fillRect(Math.round(sx) - 1, Math.round(sy) - 3, 2, 2);
    }
    this.things.push({ img: cv, x: left, y: top, depth: x + w + y + d, mx: x + w, my: y + d });
  }

  private park(c: Ctx, x0: number, y0: number): void {
    const P = this.P;
    this.diamond(c, x0, y0, 6, 6, shade(P.grass, 0.08));
    this.diamond(c, x0 + 2.6, y0, 0.8, 6, shade(P.walk, -0.05));
    this.diamond(c, x0, y0 + 2.6, 6, 0.8, shade(P.walk, -0.05));
    this.diamond(c, x0 + 2.1, y0 + 2.1, 1.8, 1.8, shade(P.walk, -0.18));
    this.diamond(c, x0 + 2.3, y0 + 2.3, 1.4, 1.4, P.water);
    for (const [a, b] of [[0.9, 0.9], [4.7, 1.2], [1.2, 4.6], [4.6, 4.5], [1.6, 2.0], [4.2, 3.6]]) if (this.rand() < 0.85) this.tree({ gx: x0 + a, gy: y0 + b }, 1);
  }

  private parking(c: Ctx, x0: number, y0: number): void {
    const P = this.P;
    this.diamond(c, x0, y0, 6, 6, P.road);
    for (let k = 0; k < 6; k += 1) this.dash(c, { gx: x0 + k + 0.5, gy: y0 + 0.2 }, { gx: x0 + k + 0.5, gy: y0 + 1.6 }, P.zebra);
    for (let k = 0; k < 6; k += 1) this.dash(c, { gx: x0 + k + 0.5, gy: y0 + 4.4 }, { gx: x0 + k + 0.5, gy: y0 + 5.8 }, P.zebra);
    for (let k = 0; k < 5; k++) {
      if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 0.9 }, 'y');
      if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 5.1 }, 'y');
    }
  }

  // ---------------- 树、车 ----------------

  private tree(g: G, size: number): void {
    const P = this.P;
    const r = Math.round(7 * size);
    const cv = document.createElement('canvas');
    cv.width = r * 2 + 4;
    cv.height = r * 2 + 12;
    const c = cv.getContext('2d') as Ctx;
    c.fillStyle = 'rgba(15,15,30,.22)';
    c.beginPath();
    c.ellipse(r + 3, r * 2 + 9, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6b4a33';
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

  private parked(g: G, along: 'x' | 'y'): void {
    const color = CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)];
    const cv = document.createElement('canvas');
    cv.width = 34;
    cv.height = 26;
    const c = cv.getContext('2d') as Ctx;
    drawIsoCar(c, 17, 18, along === 'x' ? { gx: 1, gy: 0 } : { gx: 0, gy: 1 }, color, null);
    this.things.push({ img: cv, x: Math.round(this.sx(g)) - 17, y: Math.round(this.sy(g)) - 18, depth: g.gx + g.gy, mx: g.gx, my: g.gy, g, car: true });
  }
}

/**
 * 画一辆等距视角的车：底盘中心在 (cx, cy)，dir 是车头朝的格子方向。
 * light：警灯（0 红、1 蓝、-1 不亮），普通车给 null
 */
export function drawIsoCar(c: Ctx, cx: number, cy: number, dir: G, color: string, light: number | null): void {
  const proj = (gx: number, gy: number, up = 0): [number, number] => [cx + (gx - gy) * (TW / 2), cy + (gx + gy) * (TH / 2) - up];
  const fx = dir.gx;
  const fy = dir.gy;
  // 车身的长、宽（格）
  const L = 0.62;
  const Wd = 0.34;
  const side = { gx: -fy, gy: fx };
  const corner = (a: number, b: number) => ({ gx: fx * a + side.gx * b, gy: fy * a + side.gy * b });
  const poly = (pts: [number, number][], col: string) => {
    c.fillStyle = col;
    c.beginPath();
    pts.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b)));
    c.closePath();
    c.fill();
  };
  const P = (g: { gx: number; gy: number }, up = 0) => proj(g.gx, g.gy, up);
  // 影子
  c.fillStyle = 'rgba(10,12,25,.3)';
  c.beginPath();
  c.ellipse(cx + 1, cy + 2, 13, 5, 0, 0, Math.PI * 2);
  c.fill();
  const corners = [corner(L, Wd), corner(L, -Wd), corner(-L, -Wd), corner(-L, Wd)];
  // 底盘的四个角，按屏幕上从后到前排：画能看到的两面
  const h1 = 5;
  const faces: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ];
  // 朝 +gx 或 +gy 的面看得到
  for (const [a, b] of faces) {
    const ga = corners[a];
    const gb = corners[b];
    const nx = (ga.gx + gb.gx) / 2;
    const ny = (ga.gy + gb.gy) / 2;
    if (nx + ny <= 0.001) continue;
    const front = Math.abs(nx - fx * L) < 0.01 && Math.abs(ny - fy * L) < 0.01;
    poly([P(ga), P(gb), P(gb, h1), P(ga, h1)], front ? shade(color, -0.12) : shade(color, -0.3));
  }
  // 车顶面
  poly(corners.map((g) => P(g, h1)), color);
  // 车舱（窄一点、短一点，往后挪）
  const cab = [corner(0.18, Wd * 0.8), corner(0.18, -Wd * 0.8), corner(-0.36, -Wd * 0.8), corner(-0.36, Wd * 0.8)];
  const h2 = 4;
  for (const [a, b] of faces) {
    const ga = cab[a];
    const gb = cab[b];
    const nx = (ga.gx + gb.gx) / 2 + fx * 0.09;
    const ny = (ga.gy + gb.gy) / 2 + fy * 0.09;
    if (nx + ny <= 0.001) continue;
    poly([P(ga, h1), P(gb, h1), P(gb, h1 + h2), P(ga, h1 + h2)], '#5f8fb3');
  }
  poly(cab.map((g) => P(g, h1 + h2)), light === null ? shade(color, 0.12) : '#f6f5f0');
  if (light !== null) {
    // 车门上的深蓝条
    const s1 = corner(0.3, Wd);
    const s2 = corner(-0.45, Wd);
    const s3 = corner(0.3, -Wd);
    const s4 = corner(-0.45, -Wd);
    for (const [a, b] of [[s1, s2], [s3, s4]]) {
      const nx = (a.gx + b.gx) / 2;
      const ny = (a.gy + b.gy) / 2;
      if (nx + ny <= 0) continue;
      poly([P(a, 1.5), P(b, 1.5), P(b, 3.5), P(a, 3.5)], '#23356a');
    }
    // 警灯
    const l1 = corner(-0.05, 0.22);
    const l2 = corner(-0.05, -0.22);
    const [ax, ay] = P(l1, h1 + h2 + 1);
    const [bx, by] = P(l2, h1 + h2 + 1);
    c.fillStyle = light === 0 ? '#ff4d43' : '#7a2c28';
    c.fillRect(Math.round(ax) - 1, Math.round(ay) - 2, 3, 3);
    c.fillStyle = light === 1 ? '#4fa3ff' : '#284a80';
    c.fillRect(Math.round(bx) - 1, Math.round(by) - 2, 3, 3);
  }
  // 大灯
  const hl = corner(L + 0.01, Wd * 0.6);
  const hr = corner(L + 0.01, -Wd * 0.6);
  if (fx + fy > 0) {
    for (const g of [hl, hr]) {
      const [a, b] = P(g, 2.5);
      c.fillStyle = '#fff1b0';
      c.fillRect(Math.round(a), Math.round(b) - 1, 2, 2);
    }
  }
}

function dirOf(a: G, b: G): G {
  return { gx: Math.sign(b.gx - a.gx), gy: Math.sign(b.gy - a.gy) };
}

/** 把每个拐角换成一小段弧 */
function roundCorners(pts: G[], r: number): G[] {
  const out: G[] = [pts[0]];
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
