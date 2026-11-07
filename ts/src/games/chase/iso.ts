// 斜 45° 俯视（等距视角）的城市：街道斜着穿过画面，楼房看得到两面墙和屋顶。
// 小偷沿着一条台阶形的路线跑：往右上、往右下拐来拐去，一直跑到他的仓库。
// 地面（马路、人行道、斑马线、公园、停车场、影子）每帧只画画面里的那一块；
// 楼画成和屏幕一样精细的小图存起来，树、车、路灯每帧直接画；按前后顺序和警车、小偷一起画。

import { Ctx, G, TH, TW, TimeOfDay, grade, ix, iy, rgba, rng, shade } from './geo';
import { BASE, BRICKS, Bld, CarKind, GLASS, Style, WALLS, bldBounds, drawCar, drawHydrant, drawLamp, drawTree, renderBuilding } from './paint';

export type { G, TimeOfDay } from './geo';
export { TH, TW, timeOfDay } from './geo';

const ROAD = 2; // 路宽（格）
const BLOCK = 8; // 一块地的宽（含一圈人行道）
export const PITCH = ROAD + BLOCK;
const MAX_H = 64; // 最高的楼有多高（像素）

/** 地图上的一样东西：楼、树、车、路灯。按 depth 从小到大画（越大越靠前） */
export interface Thing {
  /** 画出来占的范围（大地图上的像素），画面外的不画 */
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  /** 占地的最远角（格子坐标）：人在这两条线以外，就在这样东西前面 */
  mx: number;
  my: number;
  g?: G;
  car?: boolean;
  /** 楼的轮廓（大地图上的像素），用来判断人是不是被楼挡住 */
  sil?: [number, number][];
  /** 画在大地图坐标上；S 是现在一个像素放大多少倍 */
  draw: (c: Ctx, S: number) => void;
}

interface Block {
  x0: number; // 人行道外沿（格子坐标）
  y0: number;
  kind: 'build' | 'park' | 'parking' | 'plaza';
  seed: number;
}

const CAR_COLORS = ['#c94a3f', '#3f6fc9', '#e8e4dc', '#3a3d47', '#6d8b5a', '#8a5ab0', '#e08a3c', '#9aa5b1'];

export class IsoCity {
  readonly tod: TimeOfDay;
  readonly gw: number; // 地图有多少格
  readonly gh: number;
  readonly width: number; // 大地图的像素大小
  readonly height: number;
  readonly ox: number;
  readonly oy: number;
  readonly things: Thing[] = [];
  readonly lamps: G[] = [];
  /** 路线（格子坐标，拐角已磨圆） */
  readonly path: G[];
  private readonly cum: number[] = [];
  readonly length: number; // 路线长度（格）
  readonly hideout: G; // 仓库门口
  readonly house: { gx: number; gy: number; w: number; d: number }; // 仓库占的地
  private readonly rand: () => number;
  private readonly blocks: Block[] = [];
  private readonly blds: Bld[] = [];
  private readonly treeAt: { g: G; size: number; grate: boolean }[] = [];
  private grain: CanvasPattern | null = null;
  private grainS = 0;
  /** 画好的楼（太多了就把很久没用的扔掉） */
  private sprites = new Map<Bld, { img: HTMLCanvasElement; S: number; used: number }>();
  private frame = 0;

  constructor(seed: number, wantCells: number, tod: TimeOfDay) {
    this.tod = tod;
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
    this.oy = MAX_H + 30;
    this.width = (this.gw + this.gh) * (TW / 2);
    this.height = (this.gw + this.gh) * (TH / 2) + this.oy + 10;
    this.layout();
  }

  /** 格子坐标 → 大地图上的像素 */
  sx(g: G): number {
    return (g.gx - g.gy) * (TW / 2) + this.ox;
  }
  sy(g: G): number {
    return (g.gx + g.gy) * (TH / 2) + this.oy;
  }
  private X(gx: number, gy: number, up = 0): [number, number] {
    return [ix(gx, gy) + this.ox, iy(gx, gy) + this.oy - up];
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

  // ---------------- 摆东西 ----------------

  private layout(): void {
    const R = this.rand;
    const hs = this.house;
    const nearHouse = (gx: number, gy: number, w: number, d: number) => gx < hs.gx + hs.w + 1 && gx + w > hs.gx - 1 && gy < hs.gy + hs.d + 1 && gy + d > hs.gy - 1;
    // 每一块地：楼、公园或者停车场；仓库压着的地铺成空场
    for (let bx = 0; bx * PITCH + ROAD < this.gw; bx++) {
      for (let by = 0; by * PITCH + ROAD < this.gh; by++) {
        const x0 = bx * PITCH + ROAD;
        const y0 = by * PITCH + ROAD;
        if (x0 + 7 > this.gw || y0 + 7 > this.gh) continue;
        const blk: Block = { x0, y0, kind: 'build', seed: Math.floor(R() * 1e9) };
        if (nearHouse(x0, y0, 8, 8)) blk.kind = 'plaza';
        else {
          const r = R();
          if (r < 0.16) blk.kind = 'park';
          else if (r < 0.24) blk.kind = 'parking';
        }
        this.blocks.push(blk);
        if (blk.kind === 'build') this.buildings(x0 + 1, y0 + 1);
        else if (blk.kind === 'park') this.park(x0 + 1, y0 + 1);
        else if (blk.kind === 'parking') this.parking(x0 + 1, y0 + 1);
      }
    }
    // 路灯（每个路口的一角）、路边停的车、人行道上的树和消防栓
    for (let bx = 0; bx * PITCH < this.gw; bx++) {
      for (let by = 0; by * PITCH < this.gh; by++) {
        const x0 = bx * PITCH;
        const y0 = by * PITCH;
        const lamp = { gx: x0 + ROAD + 0.35, gy: y0 + ROAD + 0.35 };
        this.lamps.push(lamp);
        if (!nearHouse(lamp.gx, lamp.gy, 0, 0)) this.addLamp(lamp);
        for (let t = ROAD + 1.5; t < PITCH - 1; t += 2.5 + R() * 2) {
          if (R() < 0.3) this.parked({ gx: x0 + t, gy: y0 + (R() < 0.5 ? 0.42 : 1.58) }, { gx: R() < 0.5 ? 1 : -1, gy: 0 });
          if (R() < 0.3) this.parked({ gx: x0 + (R() < 0.5 ? 0.42 : 1.58), gy: y0 + t }, { gx: 0, gy: R() < 0.5 ? 1 : -1 });
          if (R() < 0.35) this.tree({ gx: x0 + t, gy: y0 + ROAD + 0.5 }, 0.8, true);
          if (R() < 0.35) this.tree({ gx: x0 + ROAD + 0.5, gy: y0 + t }, 0.8, true);
          if (R() < 0.08) this.hydrant({ gx: x0 + t + 0.6, gy: y0 + ROAD + 0.3 });
        }
      }
    }
    // 路线经过的地方不停车；仓库那块地上什么都不放
    const onRoute = (g: G) => this.path.some((p) => Math.abs(p.gx - g.gx) < 1.1 && Math.abs(p.gy - g.gy) < 1.1);
    for (let k = this.things.length - 1; k >= 0; k--) {
      const t = this.things[k];
      if (t.g && ((t.car && onRoute(t.g)) || nearHouse(t.g.gx, t.g.gy, 0, 0))) this.things.splice(k, 1);
    }
    for (let k = this.treeAt.length - 1; k >= 0; k--) if (nearHouse(this.treeAt[k].g.gx, this.treeAt[k].g.gy, 0, 0)) this.treeAt.splice(k, 1);
    // 仓库：门开在朝 +gy 的那面墙（看得见的一面），正对路线
    this.addBld({ x: hs.gx, y: hs.gy, w: hs.w, d: hs.d, h: 36, style: 'warehouse', wall: '#6c6377', seed: Math.floor(R() * 1e9), door: { gx: this.hideout.gx, gy: hs.gy + hs.d } });
    this.things.sort((a, b) => a.depth - b.depth);
  }

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
      const big = w * d > 10;
      const r = R();
      const style: Style = big ? (r < 0.4 ? 'office' : r < 0.7 ? 'apt' : 'brick') : r < 0.4 ? 'shop' : r < 0.75 ? 'apt' : 'brick';
      let h = (big ? 24 : 18) + R() * (big ? 32 : 22);
      if (style === 'office') h += 8;
      if (style === 'shop') h = Math.min(h, 30);
      const wall = style === 'brick' ? BRICKS[Math.floor(R() * BRICKS.length)] : style === 'office' ? GLASS[Math.floor(R() * GLASS.length)] : WALLS[Math.floor(R() * WALLS.length)];
      this.addBld({ x, y, w, d, h: Math.round(Math.min(MAX_H, h)), style, wall, seed: Math.floor(R() * 1e9) });
    }
  }

  private addBld(b: Bld): void {
    this.blds.push(b);
    const bb = bldBounds(b);
    const x = bb.x + this.ox;
    const y = bb.y + this.oy;
    this.things.push({
      x,
      y,
      w: bb.w,
      h: bb.h,
      depth: b.x + b.w + b.y + b.d,
      mx: b.x + b.w,
      my: b.y + b.d,
      sil: [this.X(b.x, b.y, b.h), this.X(b.x + b.w, b.y, b.h), this.X(b.x + b.w, b.y), this.X(b.x + b.w, b.y + b.d), this.X(b.x, b.y + b.d), this.X(b.x, b.y + b.d, b.h)],
      draw: (c, S) => {
        let sp = this.sprites.get(b);
        if (!sp || sp.S !== S) {
          sp = { img: renderBuilding(b, this.tod, S), S, used: 0 };
          this.sprites.set(b, sp);
          this.evict();
        }
        sp.used = this.frame;
        c.drawImage(sp.img, x, y, sp.img.width / S, sp.img.height / S);
      },
    });
  }

  /** 每画一帧调用一次：记下哪些楼最近用过 */
  tick(): void {
    this.frame++;
  }

  private evict(): void {
    if (this.sprites.size <= 48) return;
    const list = [...this.sprites.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k] of list.slice(0, this.sprites.size - 40)) this.sprites.delete(k);
  }

  private park(x0: number, y0: number): void {
    for (const [a, b] of [[0.9, 0.9], [4.7, 1.2], [1.2, 4.6], [4.6, 4.5], [1.0, 2.2], [4.3, 3.4]]) if (this.rand() < 0.85) this.tree({ gx: x0 + a, gy: y0 + b }, 1.1, false);
  }

  private parking(x0: number, y0: number): void {
    for (let k = 0; k < 5; k++) {
      if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 0.95 }, { gx: 0, gy: -1 });
      if (this.rand() < 0.6) this.parked({ gx: x0 + k + 1, gy: y0 + 5.05 }, { gx: 0, gy: 1 });
    }
  }

  // ---------------- 树、车、路灯 ----------------

  private tree(g: G, size: number, grate: boolean): void {
    const R = this.rand;
    const kind = R() < 0.22 ? 1 : 0;
    const tint = R();
    const [x, y] = this.X(g.gx, g.gy);
    this.treeAt.push({ g, size, grate });
    this.things.push({
      x: x - 10 * size,
      y: y - 26 * size,
      w: 20 * size,
      h: 28 * size,
      depth: g.gx + g.gy,
      mx: g.gx,
      my: g.gy,
      g,
      draw: (c) => drawTree(c, x, y, size, kind, this.tod, tint),
    });
  }

  private parked(g: G, dir: G): void {
    const R = this.rand;
    const color = CAR_COLORS[Math.floor(R() * CAR_COLORS.length)];
    const kind: CarKind = R() < 0.14 ? 'taxi' : 'car';
    const [x, y] = this.X(g.gx, g.gy);
    this.things.push({
      x: x - 14,
      y: y - 14,
      w: 28,
      h: 20,
      depth: g.gx + g.gy,
      mx: g.gx,
      my: g.gy,
      g,
      car: true,
      draw: (c) => drawCar(c, x, y, dir, kind === 'taxi' ? '#f0c53c' : color, kind, null, this.tod),
    });
  }

  private addLamp(g: G): void {
    const [x, y] = this.X(g.gx, g.gy);
    this.things.push({ x: x - 14, y: y - 30, w: 36, h: 48, depth: g.gx + g.gy, mx: g.gx, my: g.gy, g, draw: (c) => drawLamp(c, x, y, this.tod, true) });
  }

  private hydrant(g: G): void {
    const [x, y] = this.X(g.gx, g.gy);
    this.things.push({ x: x - 3, y: y - 6, w: 6, h: 7, depth: g.gx + g.gy, mx: g.gx, my: g.gy, g, draw: (c) => drawHydrant(c, x, y, this.tod) });
  }

  // ---------------- 地面 ----------------

  private quad(c: Ctx, gx: number, gy: number, w: number, d: number, fill: string | CanvasGradient | CanvasPattern, up = 0): void {
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(...this.X(gx, gy, up));
    c.lineTo(...this.X(gx + w, gy, up));
    c.lineTo(...this.X(gx + w, gy + d, up));
    c.lineTo(...this.X(gx, gy + d, up));
    c.closePath();
    c.fill();
  }

  /** 沥青上细细的颗粒（和屏幕像素一样大），跟着地图走 */
  private grainOf(c: Ctx, S: number): CanvasPattern | null {
    if (this.grain && this.grainS === S) return this.grain;
    const n = 96;
    const cv = document.createElement('canvas');
    cv.width = n;
    cv.height = n;
    const g = cv.getContext('2d') as Ctx;
    const R = rng(91);
    for (let k = 0; k < 900; k++) {
      g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)';
      g.fillRect(Math.floor(R() * n), Math.floor(R() * n), 1, 1);
    }
    this.grain = c.createPattern(cv, 'repeat');
    this.grainS = S;
    if (this.grain) this.grain.setTransform(new DOMMatrix().scale(1 / S));
    return this.grain;
  }

  /** 画 (vx, vy) 起 vw × vh 这一块地面（大地图上的像素），S 是放大倍数 */
  drawGround(c: Ctx, vx: number, vy: number, vw: number, vh: number, S: number): void {
    const tod = this.tod;
    const gd = (h: string) => grade(h, tod);
    c.fillStyle = gd(BASE.asphalt);
    c.fillRect(vx, vy, vw, vh);
    const grain = this.grainOf(c, S);
    if (grain) {
      c.fillStyle = grain;
      c.fillRect(vx, vy, vw, vh);
    }
    // 画面四个角换成格子坐标，算出要画哪几块
    const toG = (px: number, py: number) => {
      const a = (px - this.ox) / (TW / 2);
      const b = (py - this.oy) / (TH / 2);
      return { gx: (a + b) / 2, gy: (b - a) / 2 };
    };
    const cs = [toG(vx, vy), toG(vx + vw, vy), toG(vx, vy + vh + MAX_H), toG(vx + vw, vy + vh + MAX_H)];
    const gx0 = Math.min(...cs.map((p) => p.gx)) - PITCH;
    const gx1 = Math.max(...cs.map((p) => p.gx)) + PITCH;
    const gy0 = Math.min(...cs.map((p) => p.gy)) - PITCH;
    const gy1 = Math.max(...cs.map((p) => p.gy)) + PITCH;
    const inView = (gx: number, gy: number, w: number, d: number) => gx + w > gx0 && gx < gx1 && gy + d > gy0 && gy < gy1;

    // 路边的排水沟：靠路牙一道暗边
    c.strokeStyle = 'rgba(0,0,0,.16)';
    c.lineWidth = 1.4;
    c.beginPath();
    for (const b of this.blocks) {
      if (!inView(b.x0 - 1, b.y0 - 1, BLOCK + 2, BLOCK + 2)) continue;
      const e = 0.12;
      c.moveTo(...this.X(b.x0 - e, b.y0 - e));
      c.lineTo(...this.X(b.x0 + BLOCK + e, b.y0 - e));
      c.lineTo(...this.X(b.x0 + BLOCK + e, b.y0 + BLOCK + e));
      c.lineTo(...this.X(b.x0 - e, b.y0 + BLOCK + e));
      c.closePath();
    }
    c.stroke();

    // 车道中线（虚线）、路口的斑马线、井盖
    this.markings(c, gx0, gx1, gy0, gy1);

    // 每一块地：路牙高出来一点，上面是人行道，里面是楼、公园、停车场
    for (const b of this.blocks) {
      if (!inView(b.x0, b.y0, BLOCK, BLOCK)) continue;
      this.quad(c, b.x0, b.y0, BLOCK, BLOCK, gd(BASE.curb));
      this.quad(c, b.x0, b.y0, BLOCK, BLOCK, gd(BASE.walk), 1.3);
      // 人行道的地砖缝
      c.strokeStyle = 'rgba(80,66,50,.14)';
      c.lineWidth = 0.3;
      c.beginPath();
      for (let k = 0.5; k < BLOCK; k += 0.5) {
        for (const [a, b2] of [[b.y0, b.y0 + 1], [b.y0 + BLOCK - 1, b.y0 + BLOCK]]) {
          c.moveTo(...this.X(b.x0 + k, a, 1.3));
          c.lineTo(...this.X(b.x0 + k, b2, 1.3));
        }
        for (const [a, b2] of [[b.x0, b.x0 + 1], [b.x0 + BLOCK - 1, b.x0 + BLOCK]]) {
          c.moveTo(...this.X(a, b.y0 + k, 1.3));
          c.lineTo(...this.X(b2, b.y0 + k, 1.3));
        }
      }
      c.stroke();
      // 路牙顶上一道亮边
      c.strokeStyle = rgba('#ffffff', tod === 'night' ? 0.08 : 0.35);
      c.lineWidth = 0.35;
      c.beginPath();
      c.moveTo(...this.X(b.x0, b.y0 + BLOCK, 1.3));
      c.lineTo(...this.X(b.x0 + BLOCK, b.y0 + BLOCK, 1.3));
      c.lineTo(...this.X(b.x0 + BLOCK, b.y0, 1.3));
      c.stroke();
      const x0 = b.x0 + 1;
      const y0 = b.y0 + 1;
      if (b.kind === 'park') this.parkGround(c, x0, y0, b.seed);
      else if (b.kind === 'parking') this.parkingGround(c, x0, y0);
      else if (b.kind === 'plaza') this.plazaGround(c, b.x0, b.y0);
      else this.quad(c, x0, y0, BLOCK - 2, BLOCK - 2, gd(BASE.lot), 1.3);
    }
    // 人行道上的树坑
    for (const t of this.treeAt) {
      if (!t.grate || !inView(t.g.gx, t.g.gy, 0, 0)) continue;
      this.quad(c, t.g.gx - 0.32, t.g.gy - 0.32, 0.64, 0.64, gd('#8a7c68'), 1.3);
      this.quad(c, t.g.gx - 0.24, t.g.gy - 0.24, 0.48, 0.48, gd('#5e4a36'), 1.3);
    }
    this.shadows(c, inView);
  }

  private markings(c: Ctx, gx0: number, gx1: number, gy0: number, gy1: number): void {
    const tod = this.tod;
    const bx0 = Math.max(0, Math.floor(gx0 / PITCH));
    const bx1 = Math.ceil(gx1 / PITCH);
    const by0 = Math.max(0, Math.floor(gy0 / PITCH));
    const by1 = Math.ceil(gy1 / PITCH);
    // 中线：一段一段的虚线
    c.strokeStyle = grade(BASE.lane, tod);
    c.lineWidth = 0.9;
    c.setLineDash([5.5, 5]);
    c.beginPath();
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        const x0 = bx * PITCH;
        const y0 = by * PITCH;
        if (x0 + PITCH <= this.gw) {
          c.moveTo(...this.X(x0 + ROAD + 0.9, y0 + 1));
          c.lineTo(...this.X(x0 + PITCH - 0.9, y0 + 1));
        }
        if (y0 + PITCH <= this.gh) {
          c.moveTo(...this.X(x0 + 1, y0 + ROAD + 0.9));
          c.lineTo(...this.X(x0 + 1, y0 + PITCH - 0.9));
        }
      }
    }
    c.stroke();
    c.setLineDash([]);
    // 斑马线：路口四边，白色的长条
    const zebra = grade(BASE.marking, tod);
    c.fillStyle = tod === 'night' ? rgba(zebra, 0.7) : rgba(zebra, 0.88);
    const bar = (ax: number, ay: number, bxx: number, byy: number, w: number) => {
      // 从 a 到 b 的一条，宽 w 格（横着）
      const dx = bxx - ax;
      const dy = byy - ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (w / 2);
      const ny = (dx / len) * (w / 2);
      c.moveTo(...this.X(ax + nx, ay + ny));
      c.lineTo(...this.X(bxx + nx, byy + ny));
      c.lineTo(...this.X(bxx - nx, byy - ny));
      c.lineTo(...this.X(ax - nx, ay - ny));
      c.closePath();
    };
    c.beginPath();
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        const x0 = bx * PITCH;
        const y0 = by * PITCH;
        for (let k = 0; k < 6; k++) {
          const u = 0.2 + k * 0.32;
          if (x0 + ROAD + 1 < this.gw) bar(x0 + ROAD + 0.18, y0 + u, x0 + ROAD + 0.82, y0 + u, 0.17);
          if (x0 > 0) bar(x0 - 0.82, y0 + u, x0 - 0.18, y0 + u, 0.17);
          if (y0 + ROAD + 1 < this.gh) bar(x0 + u, y0 + ROAD + 0.18, x0 + u, y0 + ROAD + 0.82, 0.17);
          if (y0 > 0) bar(x0 + u, y0 - 0.82, x0 + u, y0 - 0.18, 0.17);
        }
      }
    }
    c.fill();
    // 井盖：每段路中间一个
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        const [mx, my] = this.X(bx * PITCH + 5.6, by * PITCH + 0.55);
        c.fillStyle = 'rgba(0,0,0,.25)';
        c.beginPath();
        c.ellipse(mx, my, 3, 1.5, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,.1)';
        c.lineWidth = 0.3;
        c.beginPath();
        c.ellipse(mx, my, 2.2, 1.1, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  private parkGround(c: Ctx, x0: number, y0: number, seed: number): void {
    const gd = (h: string) => grade(h, this.tod);
    const R = rng(seed);
    this.quad(c, x0, y0, 6, 6, gd(BASE.grass), 1.3);
    // 割草的条纹
    for (let k = 0; k < 6; k += 1) this.quad(c, x0 + k, y0, 0.5, 6, gd(BASE.grassStripe), 1.3);
    // 十字小路
    this.quad(c, x0 + 2.65, y0, 0.7, 6, gd(BASE.path), 1.3);
    this.quad(c, x0, y0 + 2.65, 6, 0.7, gd(BASE.path), 1.3);
    // 中间的水池：一圈石头边，水面，两道波光
    const [cx, cy] = this.X(x0 + 3, y0 + 3, 1.3);
    const ell = (rx: number, ry: number, fill: string | CanvasGradient) => {
      c.fillStyle = fill;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    };
    ell(24, 12, gd('#c9c0b0'));
    ell(21.5, 10.6, gd('#8e8576'));
    const wg = c.createLinearGradient(cx, cy - 10, cx, cy + 10);
    wg.addColorStop(0, gd('#4f93c6'));
    wg.addColorStop(1, gd(BASE.water));
    ell(20.5, 9.8, wg);
    c.strokeStyle = rgba('#ffffff', this.tod === 'night' ? 0.15 : 0.45);
    c.lineWidth = 0.5;
    for (const [dx, dy, r] of [[-6, -2, 4], [5, 3, 3]]) {
      c.beginPath();
      c.ellipse(cx + dx, cy + dy, r, r / 2, 0, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
    }
    // 花坛：几簇小花
    const cols = ['#f2a7b8', '#f6d35b', '#ffffff', '#b99ae6', '#ef7f6f'];
    for (const [a, b] of [[0.5, 4.9], [5.2, 0.7], [5.0, 5.1]]) {
      const col = gd(cols[Math.floor(R() * cols.length)]);
      for (let k = 0; k < 9; k++) {
        const [fx, fy] = this.X(x0 + a + (R() - 0.5) * 0.7, y0 + b + (R() - 0.5) * 0.7, 1.3);
        c.fillStyle = gd('#4f8f45');
        c.beginPath();
        c.arc(fx, fy + 0.4, 1, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = col;
        c.beginPath();
        c.arc(fx, fy - 0.2, 0.7, 0, Math.PI * 2);
        c.fill();
      }
    }
    // 长椅
    for (const [a, b] of [[1.6, 2.35], [3.6, 3.75]]) {
      const [bx, by] = this.X(x0 + a, y0 + b, 1.3);
      c.fillStyle = 'rgba(10,12,22,.22)';
      c.fillRect(bx - 4, by, 8, 1.2);
      c.fillStyle = gd('#8a5a3a');
      c.fillRect(bx - 4, by - 2.4, 8, 1.4);
      c.fillStyle = gd('#a86f48');
      c.fillRect(bx - 4, by - 4.6, 8, 1.2);
    }
  }

  private parkingGround(c: Ctx, x0: number, y0: number): void {
    const gd = (h: string) => grade(h, this.tod);
    this.quad(c, x0, y0, 6, 6, gd(shade(BASE.asphalt, 0.08)), 1.3);
    c.strokeStyle = gd(BASE.marking);
    c.lineWidth = 0.45;
    c.beginPath();
    for (let k = 0; k <= 6; k++) {
      for (const [a, b] of [[y0 + 0.15, y0 + 1.75], [y0 + 4.25, y0 + 5.85]]) {
        c.moveTo(...this.X(x0 + k + 0.5, a, 1.3));
        c.lineTo(...this.X(x0 + k + 0.5, b, 1.3));
      }
    }
    c.stroke();
  }

  private plazaGround(c: Ctx, x0: number, y0: number): void {
    const gd = (h: string) => grade(h, this.tod);
    this.quad(c, x0, y0, BLOCK, BLOCK, gd('#b9b3a8'), 1.3);
    c.strokeStyle = 'rgba(0,0,0,.08)';
    c.lineWidth = 0.3;
    c.beginPath();
    for (let k = 1; k < BLOCK; k++) {
      c.moveTo(...this.X(x0 + k, y0, 1.3));
      c.lineTo(...this.X(x0 + k, y0 + BLOCK, 1.3));
      c.moveTo(...this.X(x0, y0 + k, 1.3));
      c.lineTo(...this.X(x0 + BLOCK, y0 + k, 1.3));
    }
    c.stroke();
    // 仓库门前的黄黑警示线
    const hs = this.house;
    const dx = this.hideout.gx;
    const dy = hs.gy + hs.d;
    for (let k = 0; k < 8; k++) {
      c.fillStyle = gd(k % 2 ? '#2b2b30' : '#e8b931');
      c.beginPath();
      const a = dx - 1.2 + k * 0.3;
      c.moveTo(...this.X(a, dy + 0.15, 1.3));
      c.lineTo(...this.X(a + 0.3, dy + 0.15, 1.3));
      c.lineTo(...this.X(a + 0.3, dy + 0.45, 1.3));
      c.lineTo(...this.X(a, dy + 0.45, 1.3));
      c.closePath();
      c.fill();
    }
  }

  /** 楼和树的影子：光从右上来，影子落在左下 */
  private shadows(c: Ctx, inView: (gx: number, gy: number, w: number, d: number) => boolean): void {
    const a = this.tod === 'night' ? 0.14 : this.tod === 'dusk' ? 0.24 : 0.2;
    c.fillStyle = 'rgba(16,20,40,' + a + ')';
    c.beginPath();
    for (const b of this.blds) {
      if (!inView(b.x - 4, b.y - 1, b.w + 5, b.d + 6)) continue;
      const L = b.h * 0.05;
      const sx = 0.2 * L;
      const sy = L;
      const pts: [number, number][] = [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x + b.w + sx, b.y + sy],
        [b.x + b.w + sx, b.y + b.d + sy],
        [b.x + sx, b.y + b.d + sy],
        [b.x, b.y + b.d],
      ];
      pts.forEach(([gx, gy], k) => (k ? c.lineTo(...this.X(gx, gy, 1.3)) : c.moveTo(...this.X(gx, gy, 1.3))));
      c.closePath();
    }
    c.fill();
    // 贴着墙根的一道暗影
    c.strokeStyle = 'rgba(16,20,40,.22)';
    c.lineWidth = 1.2;
    c.beginPath();
    for (const b of this.blds) {
      if (!inView(b.x - 1, b.y - 1, b.w + 2, b.d + 2)) continue;
      c.moveTo(...this.X(b.x, b.y + b.d + 0.04, 1.3));
      c.lineTo(...this.X(b.x + b.w + 0.04, b.y + b.d + 0.04, 1.3));
      c.lineTo(...this.X(b.x + b.w + 0.04, b.y, 1.3));
    }
    c.stroke();
    c.fillStyle = 'rgba(16,20,40,' + a * 0.9 + ')';
    for (const t of this.treeAt) {
      if (!inView(t.g.gx, t.g.gy, 0, 0)) continue;
      const [x, y] = this.X(t.g.gx + 0.25, t.g.gy + 0.6, 1.3);
      c.beginPath();
      c.ellipse(x, y, 8 * t.size, 3.6 * t.size, -0.35, 0, Math.PI * 2);
      c.fill();
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

