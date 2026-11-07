// 花园和小屋的画面（canvas）

import { askConfirm, toast } from '../app/dialogs';
import { ui } from '../app/nav';
import { save, state } from '../app/store';
import { dayNum } from '../app/util';
import { ART } from '../art';
import { bagAdd, bagHas } from './bag';
import { checkAchievements, checkChallenges, pday, spend } from './coins';
import { CARE, DOOR_X, FLOOR_NAME, GB, GH, GPOND, GW, HOUSE, ITEMS, ITEM_OF_DECOR, POND_INNER, RDOOR, RH, RW, SEATS, TILE, TREES, curFloor, floorItems, setFloorItems, stairsOf } from './data';
import { CLEAR_TOOLS, DEBRIS, TOOL_NAME } from './debris';
import { TILL, allTilled, plantMax, plantName, plantStage, setTilled, stamina, tilled, wateredToday } from './garden';
import { decorSize, gardenFree, gardenOcc, plantSize } from './occupancy';
import { avatarLook, careUp, fishList, landPets, petById, petCanvas } from './pets';
import { petSay } from './roam';
import { goScene, refreshSceneUi } from './sceneui';
import { WEATHER_TINT, clockText, darkness, minuteNow, skyTint, weatherNow } from './sky';
import { SceneObj, forestRing, gardenObjects, gardenTerrain, objAt, roomFree, roomOcc, roomTerrain } from './terrain';
import { Placed, Tool } from '../app/types';

type Ctx = CanvasRenderingContext2D;

/** 画面里的人物：x、y 脚下的位置，path 要走的路，pose 坐着或躺着，swim 在水里 */
interface Avatar {
  x: number;
  y: number;
  tx: number;
  ty: number;
  path: number[][];
  dir: string;
  flip: boolean;
  moving: boolean;
  act: number;
  then: (() => void) | null;
  pose?: Pose | null;
  walking?: boolean;
  swim?: boolean;
  exiting?: boolean;
}

/** 坐在椅子上（x 坐的位置、top 图的上沿）或者躺在床上（x、y 图的左上角）；base 排前后用 */
type Pose = { kind: 'sit'; x: number; top: number; base: number } | { kind: 'lie'; x: number; y: number; base: number };

/** 花园里的一只宠物：pid 是哪只，next 下次动身的时刻，play 玩到什么时候，hop 跳到什么时候 */
interface PetEnt {
  pid: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  path: number[][];
  moving: boolean;
  next: number;
  play: number;
  flip: boolean;
  blink: number;
  hop: number;
  goPlay?: boolean;
}

/** 池塘里的一条鱼：v 游的速度 */
interface FishEnt {
  pid: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  flip: boolean;
  next: number;
  v: number;
  hop: number;
}

/** 特效：爱心、水滴、土、星星 */
interface Fx {
  kind: string;
  x: number;
  y: number;
  vx?: number;
  vy: number;
  life: number;
}

/** 花园里的小生命：蝴蝶、樱花瓣、池塘的波光 */
interface Ambient {
  bf: { x: number; y: number; tx: number; ty: number; c: string; alt: number; rest: number; ph: number; onFlower?: boolean }[];
  petals: { x: number; y: number; ground: number; ph: number; life: number }[];
  glints: { x: number; y: number; t0: number }[];
  nextGlint: number;
}

/** 雨雪：drops 雨点或雪花，rings 池塘上的水纹，flash 打雷的时刻 */
interface Weather {
  drops: { x: number; y: number; v: number }[];
  rings: { x: number; y: number; t: number }[];
  flash: number;
  next: number;
  last?: number;
}

/** 画面里按前后顺序画的一样东西 */
interface DrawObj extends SceneObj {
  crop?: number;
  flip?: boolean;
  ripple?: boolean;
  shadow?: boolean;
  pet?: boolean;
}

const WALK_CYCLE = ['walk1', 'walkp', 'walk2', 'walkp'];
const TB_GAP = 10; // 工具栏离画面下沿（或上沿）的距离，和 CSS 一致

// 花园里的小生命：蝴蝶在花间飞、樱花树下飘花瓣、池塘上一闪一闪的波光、慢慢飘过的云影
function pondSpot(): number[] {
  const list = POND_INNER.length ? POND_INNER : [...GPOND];
  const [tx, ty] = list[Math.floor(Math.random() * list.length)].split(',').map(Number);
  return [tx * TILE + 3 + Math.random() * 10, ty * TILE + 4 + Math.random() * 8];
}

let cloudImgs: HTMLCanvasElement[] | null = null;
function cloudShadows(): HTMLCanvasElement[] {
  if (cloudImgs) return cloudImgs;
  cloudImgs = [
    [[30, 24, 26, 13], [52, 20, 20, 12], [14, 28, 13, 8], [70, 27, 14, 9]],
    [[24, 20, 20, 11], [42, 16, 16, 10], [58, 22, 14, 9]],
  ].map((blobs) => {
    const q = new ART.Pix(96, 44);
    for (const [x, y, rx, ry] of blobs) q.ell(x, y, rx, ry, '#0d2a18');
    return q.toCanvas();
  });
  return cloudImgs;
}
const BUTTERFLY = ['#fbf7ef', '#f6d35b', '#9cc8f0'];

export class Scene {
  declare kind: string;
  declare w: number;
  declare h: number;
  declare av: Avatar;
  declare pets: PetEnt[];
  declare fish: FishEnt[];
  declare cam: { x: number; y: number; init: boolean };
  declare hover: number[] | null;
  declare keys: Record<string, boolean>;
  declare fx: Fx[];
  declare raf: number;
  declare last: number;
  declare bubbleUntil: number;
  declare canvas: HTMLCanvasElement | null;
  declare wrap: HTMLElement;
  declare ctx: Ctx;
  declare bubble: HTMLElement | null;
  declare ro: ResizeObserver | null | undefined;
  declare scale: number;
  declare vw: number;
  declare vh: number;
  declare tb: HTMLElement | null;
  declare tbTop: number;
  declare blockedNow: Set<string> | null | undefined;
  declare swimT: number | undefined;
  declare avFrame: string;
  declare fishFed: number | undefined;
  declare fishBowl: number[] | null | undefined;
  declare amb: Ambient | undefined;
  declare wx: Weather | undefined;
  declare clockM: number | undefined;
  declare clockW: string | undefined;
  declare vig: { w: number; h: number; g: CanvasGradient } | undefined;

  constructor(kind: string) {
    this.kind = kind;
    this.w = kind === 'room' ? RW : GW;
    this.h = kind === 'room' ? RH : GH;
    let sx = kind === 'room' ? (RDOOR[0] + 1) * TILE : DOOR_X * TILE + TILE / 2;
    let sy = (HOUSE.y + HOUSE.h + 1) * TILE;
    if (kind === 'room' && ui.arrive) {
      // 从楼梯上来（下来）：站在这层楼梯的下面一格
      sx = ui.arrive[0];
      sy = ui.arrive[1];
      ui.arrive = null;
    } else if (kind === 'room') {
      // 进门往里走两步站着（别站在下边的工具栏后面）；那儿摆了家具就站门口
      const B = this.blocked();
      sy = (RH - 1) * TILE - 2;
      for (const r of [RH - 3, RH - 2]) {
        if (this.freeAt(sx, r * TILE + 8, B)) {
          sy = r * TILE + 8;
          break;
        }
      }
    }
    this.av = { x: sx, y: sy, tx: sx, ty: sy, path: [], dir: 'front', flip: false, moving: false, act: 0, then: null };
    // 花园里所有的宠物都出来玩；鱼在池塘里游
    this.pets = [];
    this.fish = [];
    if (kind === 'garden') {
      landPets().forEach((pet, i) => {
        const px = (DOOR_X + 3 + (i % 5) * 2) * TILE;
        const py = (HOUSE.y + HOUSE.h + 2 + Math.floor(i / 5)) * TILE;
        this.pets.push({ pid: pet.id, x: px, y: py, tx: px, ty: py, path: [], moving: false, next: performance.now() + 800 + i * 400, play: 0, flip: false, blink: 0, hop: 0 });
      });
      fishList().forEach((f) => {
        const [x, y] = pondSpot();
        this.fish.push({ pid: f.id, x, y, tx: x, ty: y, flip: false, next: 0, v: 7 + Math.random() * 6, hop: 0 });
      });
    }
    this.cam = { x: 0, y: 0, init: false };
    this.hover = null;
    this.keys = {};
    this.fx = [];
    this.raf = 0;
    this.last = 0;
    this.bubbleUntil = 0;
  }

  attach(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
    this.canvas = canvas;
    this.wrap = wrap;
    this.ctx = canvas.getContext('2d')!;
    this.bubble = wrap.querySelector<HTMLElement>('.scene-bubble');
    canvas.addEventListener('click', (ev) => this.click(ev));
    canvas.addEventListener('mousemove', (ev) => this.move(ev));
    canvas.addEventListener('mouseleave', () => (this.hover = null));
    let acc = 0;
    canvas.addEventListener(
      'wheel',
      (ev) => {
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        acc += ev.deltaY;
        if (Math.abs(acc) < 40) return;
        this.zoomBy(acc > 0 ? -1 : 1);
        acc = 0;
      },
      { passive: false }
    );
    // 页面宽度变了（拖窗口、滚动条出现消失）就重新排，画面始终按原比例
    if (this.ro) this.ro.disconnect();
    if (window.ResizeObserver) {
      let lastW = 0;
      this.ro = new ResizeObserver(() => {
        const w = this.wrap && this.wrap.getBoundingClientRect().width;
        if (!this.canvas || !w || w === lastW) return;
        lastW = w;
        this.fit();
      });
      this.ro.observe(this.wrap);
    }
    this.fit();
    this.start();
  }

  // 画面和页面内容一样宽，高度用满窗口剩下的地方（最高到 4:3），整页不用滚动；工具栏浮在画面下面
  box(): [number, number] {
    // 用精确宽度（页面宽度跟着窗口按比例变，常带小数），画面正好贴满边框，边上不留缝
    const exact = this.wrap.getBoundingClientRect().width - (this.wrap.offsetWidth - this.wrap.clientWidth);
    const w = Math.max(280, exact || 960);
    const top = this.wrap.getBoundingClientRect().top + window.scrollY;
    const border = this.wrap.offsetHeight - this.wrap.clientHeight;
    const pad = parseFloat(getComputedStyle(this.wrap.parentElement!).paddingBottom) || 0;
    // 横着的窗口 4:3；竖着拿的手机可以高一点
    const tall = window.innerHeight > window.innerWidth ? 1.25 : 0.75;
    const h = Math.floor(Math.max(240, Math.min(w * tall, window.innerHeight - top - pad - border)));
    return [w, h];
  }

  // 默认大约看到 30 格宽（和星露谷差不多），可以拉近拉远（1–5 倍）；拉远到地图刚好铺满画面为止
  autoScale(): number {
    return Math.max(2, Math.min(4, Math.round(this.box()[0] / 480)));
  }

  fit(): void {
    if (!this.canvas) return;
    let [bw, bh] = this.box();
    // 屋里：画面高度按屋子的比例来，整间屋子横着铺满；窗口太矮放不下，就裁掉一点、跟着人物走
    // 屋里的画面高度按屋子的比例；手机上屋子至少放大两倍
    if (this.kind === 'room') bh = Math.min(bh, Math.max(Math.round((Math.max(bw, this.w * TILE * 2.6) * this.h) / this.w), this.h * TILE * 2));
    this.wrap.style.height = bh + (this.wrap.offsetHeight - this.wrap.clientHeight) + 'px'; // 加上边框，里面正好 bh 高
    let scale: number;
    if (this.kind === 'room') {
      // 屋里：横着铺满画面；屋子太大就不再缩小（最小 2.6 倍），镜头跟着人物走
      scale = Math.max(2.6, bw / (this.w * TILE), bh / (this.h * TILE));
    } else {
      const z = state.settings.zoom;
      scale = z >= 1 && z <= 5 ? z : this.autoScale();
    }
    // 屋里画面不超过屋子；花园拉远了可以比地图大，外面画树林
    const vw = this.kind === 'room' ? Math.min(this.w * TILE, Math.round(bw / scale)) : Math.round(bw / scale);
    const vh = this.kind === 'room' ? Math.min(this.h * TILE, Math.round(bh / scale)) : Math.round(bh / scale);
    this.scale = scale;
    this.vw = vw;
    this.vh = vh;
    this.canvas!.width = vw;
    this.canvas!.height = vh;
    // 画面像素数取整以后，放大出来会比框差一两个像素，在边上留一道缝：直接撑满（最多拉伸不到一个像素）
    this.canvas!.style.width = bw + 'px';
    this.canvas!.style.height = bh + 'px';
    this.ctx.imageSmoothingEnabled = false;
    // 底下工具栏的上沿（画面里的像素）：人物站在门口时别被它挡住
    this.tb = this.wrap.querySelector<HTMLElement>('.toolbar');
    this.tbTop = this.tb ? (this.wrap.clientHeight - TB_GAP - this.tb.offsetHeight - this.canvas!.offsetTop) / scale : vh;
  }

  zoomBy(d: number): void {
    if (this.kind === 'room') return;
    const z = Math.max(1, Math.min(5, this.scale + d));
    if (z === this.scale) return;
    state.settings.zoom = z === this.autoScale() ? 0 : z;
    save();
    this.fit();
    this.cam.init = false;
    const el = document.getElementById('zoom-v');
    if (el) el.textContent = z + '×';
  }

  start(): void {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.canvas || !document.body.contains(this.canvas)) return;
      this.step(t);
      // 走进门（或出门）会在 step 里换场景，这个画面就不用再画了
      if (!this.canvas) return;
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    this.ro = null;
    this.canvas = null;
  }

  bounds(): number[] {
    if (this.kind === 'room') return [8, 2 * TILE + 10, RW * TILE - 8, RH * TILE - 2];
    return [GB * TILE + 6, GB * TILE + 10, (GW - GB) * TILE - 6, (GH - GB) * TILE - 2];
  }

  // 走不过去的格子：房子、池塘、树、灌木、石头和各种摆设（花和地毯可以踩）
  // who = 'pet' 是宠物（不下水）；不写就是人物：有体力就能下池塘游泳
  blocked(who?: string): Set<string> {
    const B = new Set<string>();
    const swim = who !== 'pet' && this.canSwim();
    if (this.kind === 'room') {
      for (const d of floorItems(curFloor())) {
        const D = ART.DECOR[d.id];
        if (D && (D.flat || D.wall)) continue;
        const [w, h] = decorSize(d.id);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) B.add(d.x + i + ',' + (d.y + j));
      }
      // 楼梯上面两格是往上（往下）走的台阶，最下面一格踩上去就换楼层
      for (const s of stairsOf(curFloor())) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) B.add(s.x + i + ',' + (s.y + j));
      return B;
    }
    for (const [k, v] of gardenOcc()) {
      if (v.plant && v.plant.k === 'flower') continue;
      if (v.debris && DEBRIS[v.debris.k].walk) continue;
      if (v.decor && ART.DECOR[v.decor.id] && ART.DECOR[v.decor.id].flat) continue;
      if (v.pond && swim) continue;
      B.add(k);
    }
    return B;
  }

  canSwim(): boolean {
    return this.kind === 'garden' && stamina().v > 0;
  }

  // 离人物最近的岸边空地（游泳没体力了往那儿游）
  nearestShore(x: number, y: number): number[] {
    const B = this.blocked('pet');
    const sx = Math.floor(x / TILE);
    const sy = Math.floor(y / TILE);
    let best: number[] | null = null;
    let bestD = Infinity;
    for (let ty = sy - 12; ty <= sy + 12; ty++)
      for (let tx = sx - 12; tx <= sx + 12; tx++) {
        if (tx < GB || ty < GB || tx >= GW - GB || ty >= GH - GB || B.has(tx + ',' + ty)) continue;
        const d = Math.hypot(tx - sx, ty - sy);
        if (d < bestD) {
          bestD = d;
          best = [tx * TILE + TILE / 2, ty * TILE + 10];
        }
      }
    return best || [x, y];
  }

  // 脚下这一点能不能站（看脚的左右两边）
  freeAt(x: number, y: number, B?: Set<string> | null): boolean {
    B = B || this.blockedNow || this.blocked();
    const ty = Math.floor(y / TILE);
    return !B.has(Math.floor((x - 4) / TILE) + ',' + ty) && !B.has(Math.floor((x + 4) / TILE) + ',' + ty);
  }

  // 找路：按格子广度优先，走不到目标就走到离目标最近、走得到的格子；再把能直走的拐点省掉
  route(px: number, py: number, who?: Avatar | PetEnt): number[][] {
    const B = this.blocked(who && who !== this.av ? 'pet' : undefined);
    const [x0, y0, x1, y1] = this.bounds();
    const cxOf = (tx: number) => Math.max(x0, Math.min(x1, tx * TILE + TILE / 2));
    const cyOf = (ty: number) => Math.max(y0, Math.min(y1, ty * TILE + 10));
    const ok = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && !B.has(tx + ',' + ty) && (ty + 1) * TILE > y0 && ty * TILE <= y1 && (tx + 1) * TILE > x0 && tx * TILE <= x1;
    const av = who || this.av;
    const sx = Math.floor(av.x / TILE);
    const sy = Math.floor(av.y / TILE);
    const gx = Math.floor(px / TILE);
    const gy = Math.floor(py / TILE);
    const key = (x: number, y: number) => x + ',' + y;
    const prev = new Map<string, number[] | null>([[key(sx, sy), null]]);
    const queue = [[sx, sy]];
    let best = [sx, sy];
    let bestD = Math.hypot(cxOf(sx) - px, cyOf(sy) - py);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      const d = x === gx && y === gy ? -1 : Math.hypot(cxOf(x) - px, cyOf(y) - py);
      if (d < bestD - 0.01) {
        best = [x, y];
        bestD = d;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (prev.has(key(nx, ny)) || !ok(nx, ny)) continue;
        if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue; // 斜着走不能擦着墙角
        prev.set(key(nx, ny), [x, y]);
        queue.push([nx, ny]);
      }
    }
    const reached = best[0] === gx && best[1] === gy;
    // 目标是空地却走不到：多半是自己用栅栏把自己围起来了，直接走过去，免得卡死
    if (!reached && ok(gx, gy)) return [[Math.max(x0, Math.min(x1, px)), Math.max(y0, Math.min(y1, py))]];
    const tiles: number[][] = [];
    for (let c: number[] | null | undefined = best; c; c = prev.get(key(c[0], c[1]))) tiles.unshift(c);
    tiles.shift(); // 起点那一格不用走
    const pts = tiles.map(([x, y]) => [cxOf(x), cyOf(y)]);
    const end = reached ? [Math.max(x0, Math.min(x1, px)), Math.max(y0, Math.min(y1, py))] : pts.length ? pts[pts.length - 1] : [av.x, av.y];
    if (pts.length) pts[pts.length - 1] = end;
    else pts.push(end);
    // 能直着走过去的拐点去掉
    const clear = (a: number[], b: number[]) => {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
      for (let i = 1; i <= n; i++) if (!this.freeAt(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, B)) return false;
      return true;
    };
    const out: number[][] = [];
    let from = [av.x, av.y];
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !clear(from, pts[j])) j--;
      out.push(pts[j]);
      from = pts[j];
      i = j + 1;
    }
    return out;
  }

  // 走到某一点（绕开挡路的东西），到了再做 then
  walkTo(px: number, py: number, then?: () => void): void {
    this.av.pose = null;
    const path = this.route(px, py);
    const last = path[path.length - 1];
    this.av.path = path;
    this.av.tx = last[0];
    this.av.ty = last[1];
    this.av.then = then || null;
    this.av.moving = true;
  }

  walkNear(tx: number, ty: number, tw: number, th: number, then?: () => void): void {
    const cx = (tx + tw / 2) * TILE;
    const below = (ty + th) * TILE + 6;
    // 从下面够不着（比如在下边缘），就站到旁边
    const [, , , y1] = this.bounds();
    if (below > y1) this.walkTo(cx + (this.av.x < cx ? -(tw * TILE) / 2 - 6 : (tw * TILE) / 2 + 6), (ty + th) * TILE - 2, then);
    else this.walkTo(cx, below, then);
  }

  step(t: number): void {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const av = this.av;
    const k = this.keys;
    const vx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const vy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const speed = av.swim ? 44 : 72; // 游泳慢一点
    if (vx || vy) {
      av.pose = null;
      const n = Math.hypot(vx, vy);
      const [x0, y0, x1, y1] = this.bounds();
      const nx = Math.max(x0, Math.min(x1, av.x + (vx / n) * speed * dt));
      const ny = Math.max(y0, Math.min(y1, av.y + (vy / n) * speed * dt));
      // 撞到东西就顺着边滑过去；本来就卡在里面的话随便走，好出来
      this.blockedNow = this.blocked();
      if (this.freeAt(nx, ny) || !this.freeAt(av.x, av.y)) {
        av.x = nx;
        av.y = ny;
      } else if (this.freeAt(nx, av.y)) av.x = nx;
      else if (this.freeAt(av.x, ny)) av.y = ny;
      this.blockedNow = null;
      av.tx = av.x;
      av.ty = av.y;
      av.path = [];
      av.moving = false;
      av.then = null;
      av.walking = true;
      if (Math.abs(vx) >= Math.abs(vy)) {
        av.dir = 'side';
        av.flip = vx < 0;
      } else av.dir = vy > 0 ? 'front' : 'back';
    } else if (av.moving) {
      if (!av.path || !av.path.length) av.path = [[av.tx, av.ty]];
      const wp = av.path[0];
      const dx = wp[0] - av.x;
      const dy = wp[1] - av.y;
      const d = Math.hypot(dx, dy);
      const v = speed * dt;
      av.walking = true;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (Math.abs(dx) > 0.5) {
          av.dir = 'side';
          av.flip = dx < 0;
        }
      } else av.dir = dy > 0 ? 'front' : 'back';
      if (d <= v && av.path.length > 1) {
        av.x = wp[0];
        av.y = wp[1];
        av.path.shift();
      } else if (d <= v) {
        av.x = wp[0];
        av.y = wp[1];
        av.path = [];
        av.moving = false;
        av.walking = false;
        const then = av.then;
        av.then = null;
        if (then) {
          av.act = t + 450;
          then();
        }
      } else {
        av.x += (dx / d) * v;
        av.y += (dy / d) * v;
      }
    } else av.walking = false;
    // 镜头跟着人物，不超出地图；在房子跟前时镜头往上抬，尽量把整栋房子拍进来（人物留在工具栏上面），走远了慢慢回到正中
    // 画面比地图还大（拉得很远）：地图放在正中，四周是树林
    const mapW = this.w * TILE;
    const mapH = this.h * TILE;
    const cxT = this.vw >= mapW ? (mapW - this.vw) / 2 : Math.max(0, Math.min(mapW - this.vw, av.x - this.vw / 2));
    let cyC = av.y - 16 - this.vh / 2;
    if (this.kind === 'garden') {
      const doorY = (HOUSE.y + HOUSE.h + 1) * TILE;
      const top = (HOUSE.y + HOUSE.h) * TILE - ART.decor(HOUSE.sprite)!.height;
      const lift = cyC - Math.max(top - 4, av.y - Math.min(this.vh, this.tbTop || this.vh) + 6);
      const k = Math.max(0, Math.min(1, (av.y - doorY) / (6 * TILE)));
      if (lift > 0) cyC -= lift * (1 - k);
    }
    const cyT = this.vh >= mapH ? (mapH - this.vh) / 2 : Math.max(0, Math.min(mapH - this.vh, cyC));
    if (!this.cam.init) {
      this.cam.x = cxT;
      this.cam.y = cyT;
      this.cam.init = true;
    } else {
      this.cam.x += (cxT - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (cyT - this.cam.y) * Math.min(1, dt * 5);
    }
    // 踩到楼梯最下面一格：换楼层
    if (this.kind === 'room' && !av.pose) {
      const tx = Math.floor(av.x / TILE);
      const ty = Math.floor((av.y - 2) / TILE);
      const s = stairsOf(curFloor()).find((q) => tx >= q.x && tx < q.x + 2 && ty === q.y + 2);
      if (s) {
        const to = curFloor() + (s.dir === 'up' ? 1 : -1);
        ui.floor = to;
        ui.arrive = [(s.x + 1) * TILE, (s.y + 3) * TILE + 10];
        toast(FLOOR_NAME[to]);
        goScene('room');
        return;
      }
    }
    // 在池塘里：游泳。每游一分钟用 1 点体力；体力用完了自己游回岸上
    if (this.kind === 'garden') {
      const wet = GPOND.has(Math.floor(av.x / TILE) + ',' + Math.floor((av.y - 2) / TILE));
      if (wet && !av.swim) this.drops(av.x, av.y);
      av.swim = wet;
      if (wet) {
        this.swimT = (this.swimT || 0) + dt;
        if (this.swimT >= 60) {
          this.swimT -= 60;
          const s = stamina();
          s.v = Math.max(0, s.v - 1);
          save();
          refreshSceneUi();
        }
        if (stamina().v <= 0 && !(av.moving && av.exiting)) {
          if (!av.exiting) toast('体力用完了，先游回岸上');
          av.exiting = true;
          const sh = this.nearestShore(av.x, av.y);
          av.path = [sh];
          av.tx = sh[0];
          av.ty = sh[1];
          av.then = null;
          av.moving = true;
        }
      } else av.exiting = false;
    }
    this.stepPet(t, dt);
    this.ambient(t, dt);
    for (const f of this.fx) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.x += (f.vx || 0) * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  }

  // 宠物在花园里：自己溜达，花园里有树有花就跑过去玩，玩一会儿状态会好起来
  // 花园里的宠物：每只自己溜达；花园里有长好的树和花，就跑过去玩，玩一会儿心情会好起来
  stepPet(t: number, dt: number): void {
    for (const e of this.pets) this.stepOne(e, t, dt);
    for (const f of this.fish) this.stepFish(f, t, dt);
  }

  stepOne(p: PetEnt, t: number, dt: number): void {
    const pet = petById(p.pid);
    if (!pet || pet.sick) {
      p.moving = false;
      return;
    }
    if (p.moving) {
      if (!p.path || !p.path.length) p.path = [[p.tx, p.ty]];
      const wp = p.path[0];
      const dx = wp[0] - p.x;
      const dy = wp[1] - p.y;
      const d = Math.hypot(dx, dy);
      const v = 48 * dt;
      if (Math.abs(dx) > 1) p.flip = dx < 0;
      if (d <= v && p.path.length > 1) {
        p.x = wp[0];
        p.y = wp[1];
        p.path.shift();
      } else if (d <= v) {
        p.x = wp[0];
        p.y = wp[1];
        p.path = [];
        p.moving = false;
        if (p.goPlay) {
          p.goPlay = false;
          p.play = t + 2800;
          this.heart(p.x, p.y - 30);
          if (careUp(pet, 'mood', 3, 'playMood', CARE.playCap)) save();
          if (pet.id === state.petMain && Math.random() < 0.35) petSay('play');
        }
      } else {
        p.x += (dx / d) * v;
        p.y += (dy / d) * v;
      }
      return;
    }
    if (Math.random() < dt * 0.4) p.blink = t + 140;
    if (t < p.next || t < p.play) return;
    p.next = t + 2500 + Math.random() * 4000;
    const [x0, y0, x1, y1] = this.bounds();
    const fun = state.world.plants.filter((pl) => plantStage(pl) >= (pl.k === 'tree' ? 3 : 2));
    if (fun.length && Math.random() < 0.5) {
      const pl = fun[Math.floor(Math.random() * fun.length)];
      p.tx = (pl.x + (pl.k === 'tree' ? 1 : 0.5)) * TILE + (Math.random() - 0.5) * 20;
      p.ty = (pl.y + 1) * TILE + 8;
      p.goPlay = true;
    } else {
      p.tx = p.x + (Math.random() - 0.5) * 140;
      p.ty = p.y + (Math.random() - 0.5) * 90;
    }
    p.tx = Math.max(x0, Math.min(x1, p.tx));
    p.ty = Math.max(y0 + 8, Math.min(y1, p.ty));
    // 绕开房子、池塘和摆设走
    p.path = this.route(p.tx, p.ty, p);
    const last = p.path[p.path.length - 1];
    p.tx = last[0];
    p.ty = last[1];
    p.moving = true;
  }

  // 鱼：在池塘里慢慢游，停一停再换个方向；刚撒了鱼食就都游到一处
  stepFish(f: FishEnt, t: number, dt: number): void {
    const dx = f.tx - f.x;
    const dy = f.ty - f.y;
    const d = Math.hypot(dx, dy);
    const v = (t < f.hop ? f.v * 3 : f.v) * dt;
    if (d > v) {
      f.x += (dx / d) * v;
      f.y += (dy / d) * v;
      if (Math.abs(dx) > 0.5) f.flip = dx < 0;
      return;
    }
    if (t < f.next) return;
    f.next = t + 600 + Math.random() * 2600;
    const fed = this.fishFed && t - this.fishFed < 4000;
    const [x, y] = fed ? this.fishBowl || (this.fishBowl = pondSpot()) : pondSpot();
    f.tx = x + (fed ? (Math.random() - 0.5) * 10 : 0);
    f.ty = y + (fed ? (Math.random() - 0.5) * 6 : 0);
    if (!fed) this.fishBowl = null;
  }

  ambient(t: number, dt: number): void {
    if (this.kind !== 'garden') return;
    const [x0, y0, x1, y1] = this.bounds();
    const rx = () => x0 + Math.random() * (x1 - x0);
    const ry = () => y0 + Math.random() * (y1 - y0);
    const A: Ambient = this.amb || (this.amb = { bf: BUTTERFLY.map((c, i) => ({ x: rx(), y: ry(), tx: rx(), ty: ry(), c, alt: 10, rest: 0, ph: i * 2 })), petals: [], glints: [], nextGlint: 0 });
    const flowers = state.world.plants.filter((pl) => pl.k === 'flower' && plantStage(pl) >= 2);
    for (const b of A.bf) {
      const d = Math.hypot(b.tx - b.x, b.ty - b.y);
      if (t < b.rest) {
        b.alt = Math.max(2, b.alt - dt * 20);
        continue;
      }
      if (d < 2) {
        // 落在花上歇一会儿，再飞去别处
        if (b.onFlower) b.rest = t + 1500 + Math.random() * 2500;
        const fl = flowers.length && Math.random() < 0.7 ? flowers[Math.floor(Math.random() * flowers.length)] : null;
        b.tx = fl ? fl.x * TILE + 8 : rx();
        b.ty = fl ? fl.y * TILE + 10 : ry();
        b.onFlower = !!fl;
        continue;
      }
      const v = 18 * dt;
      b.x += ((b.tx - b.x) / d) * Math.min(v, d) + Math.sin(t / 180 + b.ph) * 0.25;
      b.y += ((b.ty - b.y) / d) * Math.min(v, d) + Math.cos(t / 230 + b.ph) * 0.2;
      b.alt = Math.min(12, b.alt + dt * 20) + Math.sin(t / 160 + b.ph) * 0.3;
    }
    // 樱花瓣
    const sakura = state.world.plants.filter((pl) => pl.k === 'tree' && pl.sp === 'sakura' && pl.ok && pl.x >= 0);
    if (sakura.length && A.petals.length < 4 + sakura.length * 3 && Math.random() < dt * 1.5 * sakura.length) {
      const tr = sakura[Math.floor(Math.random() * sakura.length)];
      const cx = tr.x * TILE + TILE;
      const base = (tr.y + 1) * TILE;
      A.petals.push({ x: cx - 12 + Math.random() * 24, y: base - 40 + Math.random() * 18, ground: base + 2 + Math.random() * 12, ph: Math.random() * 6, life: 9 });
    }
    for (const q of A.petals) {
      q.life -= dt;
      if (q.y < q.ground) {
        q.y += 9 * dt;
        q.x += Math.sin(t / 400 + q.ph) * 10 * dt;
      }
    }
    A.petals = A.petals.filter((q) => q.life > 0);
    // 池塘波光
    if (POND_INNER.length && t > A.nextGlint) {
      A.nextGlint = t + 250 + Math.random() * 400;
      const [gx, gy] = POND_INNER[Math.floor(Math.random() * POND_INNER.length)].split(',').map(Number);
      A.glints.push({ x: gx * TILE + 2 + Math.floor(Math.random() * 11), y: gy * TILE + 2 + Math.floor(Math.random() * 12), t0: t });
    }
    A.glints = A.glints.filter((g) => t - g.t0 < 900);
  }

  // 在地面上、物件下面画：波光
  drawGround(ctx: Ctx, t: number): void {
    for (const f of this.fish) {
      const fish = petById(f.pid);
      if (!fish) continue;
      const img = ART.fishTop(fish.sp, Math.floor(t / (t < f.hop ? 90 : 220)) % 2, fish.sick);
      ctx.globalAlpha = 0.92;
      if (f.flip) {
        ctx.save();
        ctx.translate(Math.round(f.x) + img.width / 2, Math.round(f.y) - img.height / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else ctx.drawImage(img, Math.round(f.x) - img.width / 2, Math.round(f.y) - img.height / 2);
      ctx.globalAlpha = 1;
    }
    const A = this.amb;
    if (!A) return;
    for (const g of A.glints) {
      const k = (t - g.t0) / 900;
      const len = k < 0.3 || k > 0.75 ? 1 : 3;
      ctx.fillStyle = k > 0.3 && k < 0.75 ? '#e4f5ff' : '#a6d6f4';
      ctx.fillRect(g.x - (len >> 1), g.y, len, 1);
    }
  }

  // 在物件上面画：花瓣、蝴蝶、云影
  // 时间和天气：盖一层颜色；天黑了窗户和灯亮起来；下雨、下雪；打雷闪一下
  drawLight(ctx: Ctx, t: number, cx: number, cy: number): void {
    const m = minuteNow();
    const wx = this.kind === 'garden' ? weatherNow() : 'sunny';
    let tint = skyTint(m);
    // 屋里晚上开着灯，不会像外面那么黑
    if (this.kind === 'room') tint = [tint[0], tint[1], tint[2], tint[3] * 0.45];
    const dark = darkness(m);
    if (tint[3] > 0.005) {
      ctx.fillStyle = 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + tint[3].toFixed(3) + ')';
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    const wt = WEATHER_TINT[wx];
    if (wt) {
      ctx.fillStyle = 'rgba(' + wt.slice(0, 3).join(',') + ',' + wt[3] + ')';
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    // 灯：窗户、路灯、落地灯、壁炉，天越黑越亮
    if (dark > 0.05) {
      ctx.save();
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = Math.min(1, dark * 1.1);
      const glow = (x: number, y: number, r: number, a: number) => {
        const g = ctx.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, 'rgba(255,200,120,' + a + ')');
        g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      if (this.kind === 'garden') {
        const img = ART.decor(HOUSE.sprite)!;
        const hx = HOUSE.x * TILE + (HOUSE.w * TILE - img.width) / 2;
        const hy = (HOUSE.y + HOUSE.h) * TILE - img.height;
        ctx.drawImage(ART.litWindows(HOUSE.sprite)!, hx, hy);
        ctx.globalCompositeOperation = 'lighter';
        glow(DOOR_X * TILE + 8, (HOUSE.y + HOUSE.h) * TILE, 40, 0.22);
        for (const d of state.world.decor) if (d.id === 'lamp' || d.id === 'floorlamp') glow(d.x * TILE + 8, d.y * TILE - 4, 34, 0.35);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        for (const d of floorItems(curFloor())) {
          if (d.id === 'lamp' || d.id === 'floorlamp') glow(d.x * TILE + 8, d.y * TILE - 4, 42, 0.3);
          if (d.id === 'fireplace') glow(d.x * TILE + 16, d.y * TILE + 8, 50, 0.3);
        }
      }
      ctx.restore();
    }
    // 雨、雪：画面里一直落；雨落进池塘有一圈圈水纹
    const A: Weather = this.wx || (this.wx = { drops: [], rings: [], flash: 0, next: 0 });
    const want = wx === 'storm' ? 220 : wx === 'rain' ? 110 : wx === 'snow' ? 90 : 0;
    while (A.drops.length < want) A.drops.push({ x: Math.random() * this.vw, y: Math.random() * this.vh, v: 0.6 + Math.random() * 0.6 });
    if (A.drops.length > want) A.drops.length = want;
    const dt = Math.min(0.05, (t - (A.last || t)) / 1000);
    A.last = t;
    if (wx === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (const d of A.drops) {
        d.y += 18 * d.v * dt;
        d.x += Math.sin(t / 900 + d.v * 10) * 8 * dt;
        if (d.y > this.vh) d.y -= this.vh;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), d.v > 0.9 ? 2 : 1, d.v > 0.9 ? 2 : 1);
      }
    } else if (want) {
      ctx.strokeStyle = 'rgba(200,215,235,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of A.drops) {
        d.y += 220 * d.v * dt;
        d.x -= 40 * d.v * dt;
        if (d.y > this.vh) {
          d.y -= this.vh + 10;
          d.x = Math.random() * (this.vw + 40);
        }
        ctx.moveTo(Math.round(d.x), Math.round(d.y));
        ctx.lineTo(Math.round(d.x - 2), Math.round(d.y + 6));
      }
      ctx.stroke();
      // 池塘上的雨点
      if (this.kind === 'garden' && POND_INNER.length && Math.random() < (wx === 'storm' ? 0.6 : 0.3)) {
        const [tx, ty] = POND_INNER[Math.floor(Math.random() * POND_INNER.length)].split(',').map(Number);
        A.rings.push({ x: tx * TILE + Math.random() * 16, y: ty * TILE + Math.random() * 16, t });
      }
      ctx.strokeStyle = 'rgba(220,240,255,.7)';
      A.rings = A.rings.filter((r) => t - r.t < 700);
      for (const r of A.rings) {
        const k = (t - r.t) / 700;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.ellipse(r.x - cx, r.y - cy, 1 + k * 4, 0.5 + k * 1.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 大雨打雷：隔一阵闪一下
      if (wx === 'storm') {
        if (!A.next) A.next = t + 6000 + Math.random() * 12000;
        if (t > A.next) {
          A.flash = t;
          A.next = t + 8000 + Math.random() * 14000;
        }
        const f = (t - A.flash) / 250;
        if (A.flash && f < 1) {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.45 * (1 - f)).toFixed(2) + ')';
          ctx.fillRect(0, 0, this.vw, this.vh);
        }
      }
    }
    // 标题上的时间，过了一分钟再改
    if (this.clockM !== m || this.clockW !== wx) {
      this.clockM = m;
      this.clockW = wx;
      for (const el of document.querySelectorAll('.g-clock')) el.textContent = clockText();
    }
  }

  drawSky(ctx: Ctx, t: number): void {
    const A = this.amb;
    if (!A) return;
    for (const q of A.petals) {
      ctx.globalAlpha = Math.min(1, q.life / 2);
      ctx.fillStyle = '#f7b6cc';
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 1);
      ctx.fillStyle = '#fbd3e0';
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const b of A.bf) {
      const x = Math.round(b.x);
      const y = Math.round(b.y - b.alt);
      ctx.fillStyle = 'rgba(30,40,20,.25)';
      ctx.fillRect(x - 1, Math.round(b.y), 3, 1);
      const resting = t < b.rest;
      const open = Math.floor((t + b.ph * 100) / (resting ? 700 : 110)) % 2 === 0;
      ctx.fillStyle = b.c;
      if (open) {
        ctx.fillRect(x - 2, y - 1, 2, 2);
        ctx.fillRect(x + 1, y - 1, 2, 2);
        ctx.fillRect(x - 1, y + 1, 1, 1);
        ctx.fillRect(x + 1, y + 1, 1, 1);
      } else {
        ctx.fillRect(x - 1, y - 2, 1, 2);
        ctx.fillRect(x + 1, y - 2, 1, 2);
      }
      ctx.fillStyle = '#3a2a2a';
      ctx.fillRect(x, y - 1, 1, 3);
    }
    const imgs = cloudShadows();
    const W = this.w * TILE;
    ctx.globalAlpha = 0.09;
    for (let i = 0; i < 3; i++) {
      const img = imgs[i % 2];
      const span = W + img.width * 2;
      const x = Math.round(((t / 1000) * (5 + i * 1.5) + i * 230) % span) - img.width;
      const y = [30, 150, 230][i];
      ctx.drawImage(img, x, y);
    }
    ctx.globalAlpha = 1;
  }

  heart(x: number, y: number): void {
    this.fx.push({ kind: 'heart', x, y, vy: -18, life: 1 });
  }

  drops(x: number, y: number): void {
    for (let i = 0; i < 6; i++) this.fx.push({ kind: 'drop', x: x + (Math.random() - 0.5) * 12, y: y - 14 - Math.random() * 6, vy: 30 + Math.random() * 20, life: 0.5 });
  }

  // 锄地扬起的土
  dust(x: number, y: number): void {
    for (let i = 0; i < 7; i++) this.fx.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 14, y: y - 4 - Math.random() * 4, vy: -14 - Math.random() * 10, vx: (Math.random() - 0.5) * 30, life: 0.45 });
  }

  sparkle(x: number, y: number): void {
    for (let i = 0; i < 8; i++) this.fx.push({ kind: 'spark', x: x + (Math.random() - 0.5) * 18, y: y - 8 - Math.random() * 18, vy: -12, vx: (Math.random() - 0.5) * 16, life: 0.7 });
  }

  // 陪你背单词的那只在画面里的样子
  mainEnt(): PetEnt | null {
    return this.pets.find((e) => e.pid === state.petMain) || null;
  }

  say(text: string): void {
    const e = this.mainEnt();
    if (!this.bubble || !e) return;
    this.bubble!.textContent = text;
    this.bubbleUntil = performance.now() + 3400;
    e.play = Math.max(e.play, performance.now() + 1800);
  }

  draw(t: number): void {
    const ctx = this.ctx;
    const cam = this.cam;
    const cx = Math.round(cam.x);
    const cy = Math.round(cam.y);
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.save();
    ctx.translate(-cx, -cy);
    let objs: DrawObj[];
    if (this.kind === 'room') {
      ctx.drawImage(roomTerrain(), 0, 0);
      // 窗户照进来的光斑；壁炉一闪一闪的暖光
      for (const s of stairsOf(curFloor())) ctx.drawImage(ART.decor(s.dir === 'up' ? 'stairsUp' : 'stairsDown')!, s.x * TILE, s.y * TILE);
      for (const d of floorItems(curFloor())) {
        if (d.id === 'window') {
          ctx.fillStyle = 'rgba(255,244,200,.2)';
          for (let j = 0; j < 30; j++) ctx.fillRect(d.x * TILE + 2 + Math.floor(j * 0.5), 2 * TILE + j, TILE - 4, 1);
        } else if (d.id === 'fireplace') {
          const fx = d.x * TILE + TILE;
          const fy = (d.y + 1) * TILE;
          const a = 0.16 + Math.sin(t / 130) * 0.03 + Math.sin(t / 47) * 0.02;
          const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 46);
          g.addColorStop(0, 'rgba(255,170,80,' + a.toFixed(3) + ')');
          g.addColorStop(1, 'rgba(255,170,80,0)');
          ctx.fillStyle = g;
          ctx.fillRect(fx - 46, fy - 46, 92, 92);
        }
      }
      objs = floorItems(curFloor()).map((d) => {
        const [w, h] = decorSize(d.id);
        const o: DrawObj = objAt(ART.decor(d.id)!, d.x, d.y, w, h);
        if (ART.DECOR[d.id] && (ART.DECOR[d.id].flat || ART.DECOR[d.id].wall)) o.base = -1;
        return o;
      });
    } else {
      // 地图外面露出来的地方：先铺一整片树林，地面画上去以后再压一圈树把接缝盖住
      const out = Math.max(-cx, -cy, cx + this.vw - GW * TILE, cy + this.vh - GH * TILE);
      const ring = out > 0 ? forestRing(out) : null;
      if (ring) ctx.drawImage(ring.back, -ring.m, -ring.m);
      ctx.drawImage(gardenTerrain(state.world.plants), 0, 0);
      if (ring) ctx.drawImage(ring.front, -ring.m, -ring.m);
      this.drawGround(ctx, t);
      objs = gardenObjects(state.world.plants, state.world.decor, true);
    }
    // 人物
    const av = this.av;
    const look = avatarLook();
    const af = t < av.act ? 'act' : av.walking ? WALK_CYCLE[Math.floor(t / 120) % 4] : 'idle';
    this.avFrame = af;
    if (av.pose && av.pose.kind === 'sit') objs.push({ img: ART.avatar(look, 'sit', 'front'), x: av.pose.x - 8, y: av.pose.top, base: av.pose.base + 0.5 });
    else if (av.pose && av.pose.kind === 'lie') objs.push({ img: ART.lying(look), x: av.pose.x, y: av.pose.y, base: av.pose.base + 0.5 });
    else if (av.swim) {
      // 在水里：只露出上半身，身子一上一下，周围一圈水波
      const bob = Math.round(Math.sin(t / 260));
      objs.push({ img: ART.avatar(look, Math.floor(t / 420) % 2 ? 'walkp' : 'idle', av.dir), x: Math.round(av.x) - 8, y: Math.round(av.y) - 24 + bob, crop: 19, base: av.y, flip: av.dir === 'side' && av.flip, ripple: true });
    } else objs.push({ img: ART.avatar(look, af, av.dir), x: Math.round(av.x) - 8, y: Math.round(av.y) - 31, base: av.y, flip: av.dir === 'side' && av.flip, shadow: true });
    // 宠物
    const p = this.mainEnt();
    for (const e of this.pets) {
      const pet = petById(e.pid);
      if (!pet) continue;
      const talking = e === p && t < this.bubbleUntil;
      const pf = pet.sick ? 'sick' : e.moving ? (Math.floor(t / 140) % 2 ? 'walk2' : 'walk1') : t < e.play || talking ? 'happy' : t < e.blink ? 'blink' : 'idle';
      const hop = t < e.hop ? Math.round(Math.sin(((e.hop - t) / 400) * Math.PI) * 5) : 0;
      objs.push({ img: petCanvas(pf, pet)!, x: Math.round(e.x) - 16, y: Math.round(e.y) - 30 - hop, base: e.y, flip: e.flip, shadow: true, pet: true });
    }
    objs.sort((a, b) => a.base - b.base);
    for (const o of objs) {
      if (o.shadow) {
        ctx.fillStyle = 'rgba(40,30,20,.22)';
        ctx.beginPath();
        ctx.ellipse(o.x + o.img.width / 2, o.base, o.pet ? 9 : 6, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const ih = o.crop || o.img.height;
      if (o.flip) {
        ctx.save();
        ctx.translate(o.x + o.img.width, o.y);
        ctx.scale(-1, 1);
        ctx.drawImage(o.img, 0, 0, o.img.width, ih, 0, 0, o.img.width, ih);
        ctx.restore();
      } else ctx.drawImage(o.img, 0, 0, o.img.width, ih, Math.round(o.x), Math.round(o.y), o.img.width, ih);
      if (o.ripple) {
        // 水面上一圈亮边，往外慢慢散开的波纹
        const cx = Math.round(o.x + 8);
        const cy = Math.round(o.y + ih);
        ctx.strokeStyle = 'rgba(225,244,255,.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        const k = (t % 1400) / 1400;
        ctx.strokeStyle = 'rgba(225,244,255,' + (0.6 * (1 - k)).toFixed(2) + ')';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 9 + k * 10, 3 + k * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 浇过水、施过肥的植物：闪一闪
      if (o.plant && (wateredToday(o.plant) || o.plant.f) && Math.floor(t / 400) % 3 === 0) {
        ctx.fillStyle = o.plant.f ? '#f6d35b' : '#bfe6ff';
        const sx = o.x + 3 + ((t / 37) % (o.img.width - 6));
        ctx.fillRect(Math.round(sx), Math.round(o.y + 2 + ((t / 53) % 8)), 1, 1);
      }
    }
    if (this.kind === 'garden') this.drawSky(ctx, t);
    // 特效：爱心、水滴、星星
    for (const f of this.fx) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      if (f.kind === 'heart') {
        ctx.fillStyle = '#e85d75';
        for (const [dx, dy] of [[-2, 0], [-1, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [0, 3], [-1, -1], [1, -1]]) ctx.fillRect(x + dx, y + dy, 1, 1);
      } else if (f.kind === 'drop') {
        ctx.fillStyle = '#7fc0f0';
        ctx.fillRect(x, y, 1, 2);
      } else if (f.kind === 'dust') {
        ctx.fillStyle = f.life > 0.25 ? '#9a7048' : '#b8916a';
        ctx.fillRect(x, y, 2, 2);
      } else {
        ctx.fillStyle = '#fff1a8';
        ctx.fillRect(x, y, 1, 1);
        if (f.life > 0.35) {
          ctx.fillRect(x - 1, y, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
          ctx.fillRect(x, y - 1, 1, 1);
          ctx.fillRect(x, y + 1, 1, 1);
        }
      }
    }
    // 拿着工具时，鼠标下面的格子画个框：能放是白色，不能放是红色
    if (this.hover && ui.tool) {
      const [w, h] = this.toolSize();
      const ok = this.toolOk(this.hover[0], this.hover[1]);
      ctx.strokeStyle = ok ? 'rgba(255,255,255,.9)' : 'rgba(230,80,70,.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.hover[0] * TILE + 0.5, this.hover[1] * TILE + 0.5, w * TILE - 1, h * TILE - 1);
      ctx.fillStyle = ok ? 'rgba(255,255,255,.15)' : 'rgba(230,80,70,.15)';
      ctx.fillRect(this.hover[0] * TILE, this.hover[1] * TILE, w * TILE, h * TILE);
    }
    ctx.restore();
    this.drawLight(ctx, t, cx, cy);
    // 四角稍微暗一点，画面更聚拢
    if (!this.vig || this.vig.w !== this.vw || this.vig.h !== this.vh) {
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.42, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.75);
      g.addColorStop(0, 'rgba(20,28,12,0)');
      g.addColorStop(1, this.kind === 'room' ? 'rgba(40,22,10,.22)' : 'rgba(16,30,14,.2)');
      this.vig = { w: this.vw, h: this.vh, g };
    }
    ctx.fillStyle = this.vig.g;
    ctx.fillRect(0, 0, this.vw, this.vh);
    // 宠物说话的气泡（HTML，跟着宠物走）
    if (this.bubble) {
      const show = p && performance.now() < this.bubbleUntil;
      this.bubble!.classList.toggle('show', !!show);
      if (show) {
        this.bubble!.style.left = this.canvas!.offsetLeft + (p.x - cx) * this.scale + 'px';
        this.bubble!.style.top = this.canvas!.offsetTop + (p.y - 34 - cy) * this.scale + 'px';
      }
    }
    // 人物走到工具栏后面，工具栏就挪到画面上边；走开了再回到下边（工具栏换过内容会重新生成，要重新找）
    if (!this.tb || !this.tb.isConnected) this.tb = this.wrap && this.wrap.querySelector<HTMLElement>('.toolbar');
    const tb = this.tb;
    if (tb) {
      const s = this.scale;
      const ax = this.canvas!.offsetLeft + (this.av.x - cx) * s;
      const feet = this.canvas!.offsetTop + (this.av.y - cy) * s;
      const top = this.wrap.clientHeight - TB_GAP - tb.offsetHeight;
      const under = feet > top - 2 && ax + 10 * s > tb.offsetLeft && ax - 10 * s < tb.offsetLeft + tb.offsetWidth;
      if (under !== tb.classList.contains('at-top')) tb.classList.toggle('at-top', under);
    }
  }

  toTile(ev: MouseEvent): number[] {
    const r = this.canvas!.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * this.vw + this.cam.x;
    const py = ((ev.clientY - r.top) / r.height) * this.vh + this.cam.y;
    return [px, py, Math.floor(px / TILE), Math.floor(py / TILE)];
  }

  move(ev: MouseEvent): void {
    const [, , tx, ty] = this.toTile(ev);
    this.hover = [tx, ty];
  }

  toolSize(): [number, number] {
    const it = ITEMS.get(ui.tool!);
    if (it && it.decor) return decorSize(it.decor);
    if (it && it.plant && it.plant[0] === 'tree') return [2, 1];
    return [1, 1];
  }

  // 拿着的工具能不能用在这个格子上
  toolOk(tx: number, ty: number): boolean {
    const tool = ui.tool!;
    if (this.kind === 'room') {
      if (tool === 'hand') return roomOcc().has(tx + ',' + ty);
      const it = ITEMS.get(tool);
      return !!(it && (it.use === 'furnish' || it.use === 'place') && roomFree(it.decor!, tx, ty));
    }
    const occ = gardenOcc();
    const here = occ.get(tx + ',' + ty);
    if (tool === 'hand') return !!(here && here.decor);
    if (tool === 'shovel') return !!(here && here.plant);
    if (tool === 'hoe') return !tilled(tx, ty) && gardenFree(tx, ty, 1, 1, occ);
    if (CLEAR_TOOLS.includes(tool)) return !!(here && here.debris && DEBRIS[here.debris.k].tool === tool);
    const it = ITEMS.get(tool);
    if (!it) return false;
    const growing = here && here.plant && plantStage(here.plant) < plantMax(here.plant);
    if (it.use === 'plant') {
      const w = it.plant![0] === 'tree' ? 2 : 1;
      return gardenFree(tx, ty, w, 1, occ) && allTilled(tx, ty, w, 1);
    }
    if (it.use === 'lawn') return tilled(tx, ty) && !here;
    if (it.use === 'water') return !!(growing && !wateredToday(here!.plant!));
    if (it.use === 'fert') return !!(growing && here!.plant!.fd !== dayNum());
    if (it.use === 'place' || (it.use === 'furnish' && !ART.DECOR[it.decor!].wall)) {
      const [w, h] = decorSize(it.decor!);
      return gardenFree(tx, ty, w, h, occ);
    }
    return false;
  }

  click(ev: MouseEvent): void {
    const [px, py, tx, ty] = this.toTile(ev);
    // 手里拿着工具：先用工具，不去摸宠物
    if (ui.tool) {
      this.useTool(tx, ty);
      return;
    }
    // 点到宠物：跳一下、冒个爱心，心情好一点（每只每天有上限）
    const hits = this.pets.filter((e) => Math.abs(px - e.x) < 14 && py > e.y - 30 && py < e.y + 2).sort((a, b) => b.y - a.y);
    if (hits.length) {
      const e = hits[0];
      const pet = petById(e.pid);
      e.hop = performance.now() + 400;
      this.heart(e.x, e.y - 32);
      if (pet && careUp(pet, 'mood', 1, 'petMood', CARE.petCap)) save();
      if (pet && pet.id === state.petMain) petSay(pet.sick ? 'sick' : 'click');
      return;
    }
    // 点到鱼：溅起水花，鱼开心一点
    const fh = this.fish.find((f) => Math.abs(px - f.x) < 8 && Math.abs(py - f.y) < 6);
    if (fh) {
      const f = petById(fh.pid);
      fh.hop = performance.now() + 500;
      fh.next = 0;
      this.drops(fh.x, fh.y + 14);
      if (f && careUp(f, 'mood', 4, 'fishPlay', 20)) save();
      return;
    }
    // 点到椅子、凳子、沙发、长椅就走过去坐下；点到床就躺上去
    const furn = this.kind === 'room' ? roomOcc().get(tx + ',' + ty) : (gardenOcc().get(tx + ',' + ty) || ({} as { decor?: Placed })).decor;
    if (furn && (SEATS[furn.id] || furn.id === 'bed')) {
      this.restOn(furn, px);
      return;
    }
    if (this.kind === 'room') {
      if (curFloor() === 1 && ty >= RH - 1 && RDOOR.includes(tx)) {
        this.walkTo((RDOOR[0] + 1) * TILE, RH * TILE - 2, () => goScene('garden'));
        return;
      }
      this.walkTo(px, py);
      return;
    }
    const here = gardenOcc().get(tx + ',' + ty);
    if (here && here.house) {
      this.walkTo(DOOR_X * TILE + TILE / 2, (HOUSE.y + HOUSE.h) * TILE + 4, () => {
        ui.floor = 1;
        goScene('room');
      });
      return;
    }
    if (here && here.pond && stamina().v <= 0) toast('体力用完了，下不了水');
    if (here && here.debris) {
      const D = DEBRIS[here.debris.k];
      toast(D.name + ' · 用' + TOOL_NAME[D.tool] + '清理，要 ' + D.st + ' 点体力');
    }
    if (here && here.plant) {
      const pl = here.plant;
      const st = plantStage(pl);
      const names = pl.k === 'tree' ? ['种子', '发芽', '小树苗', '小树', '长成大树了'] : pl.k === 'flower' ? ['刚种下', '发芽', '花苞', '开花了'] : ['刚种下', '发芽', '长好了'];
      const msg = plantName(pl) + ' · ' + names[st] + (st >= plantMax(pl) ? '' : ' · ' + (wateredToday(pl) ? '今天浇过水' : '今天还没浇水'));
      toast(msg);
    }
    this.walkTo(px, py + 4);
  }

  // 走到家具前面，坐下或者躺下；再走动就站起来
  restOn(d: Placed, px: number): void {
    const [w, h] = decorSize(d.id);
    const img = ART.decor(d.id)!;
    const base = (d.y + h) * TILE;
    const top = base - img.height;
    let pose: Pose;
    let fx = d.x + Math.floor(w / 2);
    if (d.id === 'bed') pose = { kind: 'lie', x: d.x * TILE, y: top, base };
    else {
      const S = SEATS[d.id];
      const at = S.at.reduce((a, b) => (Math.abs(d.x * TILE + b - px) < Math.abs(d.x * TILE + a - px) ? b : a));
      fx = d.x + Math.floor(at / TILE);
      pose = { kind: 'sit', x: d.x * TILE + at, top: top + S.seat - 26, base };
    }
    this.walkTo(fx * TILE + TILE / 2, base + 8, () => {
      this.av.pose = pose;
      this.av.dir = 'front';
    });
  }

  async useTool(tx: number, ty: number): Promise<void> {
    if (!this.toolOk(tx, ty)) {
      const here = this.kind === 'garden' && gardenOcc().get(tx + ',' + ty);
      const it = ITEMS.get(ui.tool!);
      if (here && here.plant && it && (it.use === 'water' || it.use === 'fert')) {
        const pl = here.plant;
        toast(plantStage(pl) >= plantMax(pl) ? plantName(pl) + '已经长好了' : it.use === 'water' ? '今天浇过水了' : '今天施过肥了');
      } else if (this.kind === 'garden' && it && it.use === 'plant' && gardenFree(tx, ty, it.plant![0] === 'tree' ? 2 : 1, 1)) {
        toast(state.world.hoe ? (it.plant![0] === 'tree' ? '树要种在开垦过的两格地上' : '这块地还没开垦') : '先买一把锄头，开垦了才能种');
      } else if (this.kind === 'garden' && ui.tool === 'hoe' && tilled(tx, ty)) toast('这块地已经开垦过了');
      else if (this.kind === 'garden' && here && here.debris) toast(DEBRIS[here.debris.k].name + '要用' + TOOL_NAME[DEBRIS[here.debris.k].tool] + (state.world[DEBRIS[here.debris.k].tool as Tool] ? '' : '，先去商店买一把'));
      else toast(this.kind === 'room' ? '这里放不下' : '这里不行');
      return;
    }
    const tool = ui.tool!;
    if (CLEAR_TOOLS.includes(tool)) {
      const d = gardenOcc().get(tx + ',' + ty)!.debris!;
      if (stamina().v < DEBRIS[d.k].st) return toast(stamina().v ? '体力不够了（' + DEBRIS[d.k].name + '要 ' + DEBRIS[d.k].st + ' 点），背一组单词能补回来' : '体力用完了，背一组单词能补回来');
    }
    if (tool === 'hoe') {
      if (stamina().v <= 0) return toast('体力用完了，背一组单词能补回来');
      if (state.points.bal < TILL.cost) return toast('金币不够（开垦一格 ' + TILL.cost + ' 金币）');
    }
    if (tool === 'shovel') {
      const pl = gardenOcc().get(tx + ',' + ty)!.plant!;
      if (pl.k === 'tree' && !(await askConfirm('铲掉这棵' + plantName(pl) + '？铲掉就没有了。', '铲掉'))) return;
    }
    const it = ITEMS.get(tool)!;
    const [w, h] = this.toolSize();
    this.walkNear(tx, ty, w, h, () => {
      if (!this.toolOk(tx, ty)) return;
      const W = state.world;
      const cx = (tx + w / 2) * TILE;
      const cy = (ty + h) * TILE;
      if (this.kind === 'room') {
        if (tool === 'hand') {
          const d = roomOcc().get(tx + ',' + ty)!;
          setFloorItems(curFloor(), floorItems(curFloor()).filter((x) => x !== d));
          bagAdd(ITEM_OF_DECOR.get(d.id) || 'furn.' + d.id, 1);
        } else {
          floorItems(curFloor()).push({ id: it.decor!, x: tx, y: ty });
          bagAdd(tool, -1);
          this.sparkle(cx, cy);
          checkAchievements();
        }
      } else {
        const here = gardenOcc().get(tx + ',' + ty)!;
        if (tool === 'hand') {
          W.decor = W.decor.filter((x) => x !== here.decor);
          bagAdd(ITEM_OF_DECOR.get(here.decor!.id) || 'decor.' + here.decor!.id, 1);
        } else if (tool === 'shovel') {
          W.plants = W.plants.filter((x) => x !== here.plant);
        } else if (CLEAR_TOOLS.includes(tool)) {
          const d = here.debris!;
          const D = DEBRIS[d.k];
          if (stamina().v < D.st) return;
          stamina().v -= D.st;
          W.debris = W.debris!.filter((x) => x !== d);
          const roll = (r: number[]) => r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
          const got: string[] = [];
          if (D.wood) {
            const n = roll(D.wood);
            bagAdd('wood', n);
            got.push('木材 +' + n);
          }
          if (D.stone) {
            const n = roll(D.stone);
            bagAdd('stone', n);
            got.push('石料 +' + n);
          }
          if (d.k === 'weed' && Math.random() < 0.2) {
            bagAdd('lawn', 1);
            got.push('草坪种子 +1');
          }
          if (d.k === 'tree' && Math.random() < 0.25) {
            bagAdd('tseed.' + d.sp, 1);
            got.push(TREES.get(d.sp!)!.name + '种子 +1');
          }
          this.dust((d.x + D.w / 2) * TILE, (d.y + D.h) * TILE);
          if (got.length) toast(got.join('，'));
        } else if (tool === 'hoe') {
          if (stamina().v <= 0 || !spend(TILL.cost)) return;
          stamina().v--;
          setTilled(tx, ty, true);
          this.dust(cx, cy);
        } else if (it.use === 'lawn') {
          setTilled(tx, ty, false);
          bagAdd(tool, -1);
          this.sparkle(cx, cy);
        } else if (it.use === 'plant') {
          W.plants.push({ k: it.plant![0], sp: it.plant![1], x: tx, y: ty, t: dayNum(), w: [], f: 0 });
          bagAdd(tool, -1);
        } else if (it.use === 'water' || it.use === 'fert') {
          const pl = here.plant!;
          const before = plantStage(pl);
          if (it.use === 'water') {
            pl.w = (pl.w || []).concat(dayNum());
            const d = pday();
            d.water = (d.water || 0) + 1;
            this.drops((pl.x + plantSize(pl)[0] / 2) * TILE, (pl.y + 1) * TILE);
            checkChallenges();
          } else {
            pl.f = (pl.f || 0) + 1;
            pl.fd = dayNum();
            this.sparkle((pl.x + plantSize(pl)[0] / 2) * TILE, (pl.y + 1) * TILE);
          }
          bagAdd(tool, -1);
          // 刚好长好：记一笔，树长成大树宠物会说一句
          if (before < plantMax(pl) && plantStage(pl) >= plantMax(pl)) {
            if (!W.grown) W.grown = { t: 0, f: 0 };
            if (pl.k === 'tree') {
              W.grown.t++;
              toast(plantName(pl) + '长成大树了');
              if (Math.random() < 0.7) petSay('grown');
            } else if (pl.k === 'flower') W.grown.f++;
          }
        } else if (it.use === 'place' || it.use === 'furnish') {
          W.decor.push({ id: it.decor!, x: tx, y: ty });
          bagAdd(tool, -1);
          this.sparkle(cx, cy);
        }
        checkAchievements();
      }
      if (tool !== 'hand' && tool !== 'shovel' && tool !== 'hoe' && !CLEAR_TOOLS.includes(tool) && !bagHas(tool)) ui.tool = null;
      save();
      refreshSceneUi();
    });
  }

  key(ev: KeyboardEvent, down: boolean): boolean {
    const map: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
    const k = map[ev.key];
    if (!k) return false;
    this.keys[k] = down;
    return true;
  }
}
