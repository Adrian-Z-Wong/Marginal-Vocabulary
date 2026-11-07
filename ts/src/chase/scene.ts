// 追击画面（斜 45° 的等距视角）：镜头跟着警车和小偷，在城市的大街上斜着追。
// 楼挡住人时，人会透过楼淡淡地显出来；右上角小地图，小偷跑出画面时边上有箭头。
// 夜里路灯和警车大灯照亮路面，警灯一红一蓝地闪；打错了留下刹车印，连击时警车冒火加速。

import { G, IsoCity, Thing, drawIsoCar } from './iso';
import { Ctx, blitFoot, px, shadow, thiefSprite } from './sprites';

export interface SceneState {
  police: number; // 警车进度 0–1
  thief: number; // 小偷进度 0–1
  phase: 'ready' | 'run' | 'paused' | 'won' | 'lost';
  endAt: number; // 结束的时刻（performance.now），播结尾动画
}

const START = 2.5; // 路线上起跑的位置（格）
const THIEF_AHEAD = 0.9; // 进度相同时小偷在警车前面多少格（车头碰到人）
const DOOR_BEFORE = 0.25; // 小偷跑到离仓库门这么近就算进去了

interface Skid {
  g: G;
  dir: G;
  t: number;
}
interface Spark {
  x: number; // 大地图上的像素
  y: number;
  vx: number;
  vy: number;
  t: number;
  kind: 'flame' | 'dust';
}

interface Ent {
  g: G;
  draw: (alpha: number) => void;
  done: boolean;
}

export class ChaseScene {
  private canvas: HTMLCanvasElement | null = null;
  private wrap: HTMLElement | null = null;
  private ctx: Ctx | null = null;
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private w = 300;
  private h = 160;
  private scale = 2;
  private camX = 0;
  private camY = 0;
  private policeS = START;
  private last = 0;
  private skids: Skid[] = [];
  private sparks: Spark[] = [];
  private boostUntil = 0;
  private light: HTMLCanvasElement | null = null;
  city: IsoCity;
  private readonly get: () => SceneState;

  constructor(get: () => SceneState, city: IsoCity) {
    this.get = get;
    this.city = city;
  }

  reset(city: IsoCity): void {
    this.city = city;
    this.policeS = START;
    this.skids = [];
    this.sparks = [];
    this.boostUntil = 0;
    this.snapCamera();
  }

  attach(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
    this.detach();
    this.canvas = canvas;
    this.wrap = wrap;
    this.ctx = canvas.getContext('2d');
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(wrap);
    }
    this.fit();
    this.snapCamera();
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.canvas || !document.body.contains(this.canvas)) return;
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    this.ro = null;
    this.canvas = null;
    this.ctx = null;
  }

  /** 打错：轮胎在地上留一道刹车印 */
  skid(): void {
    const p = this.city.at(this.policeS);
    this.skids.push({ g: { gx: p.gx, gy: p.gy }, dir: p.dir, t: 0 });
    if (this.skids.length > 60) this.skids.shift();
  }

  /** 连击加速：车尾冒火 */
  boost(now: number): void {
    this.boostUntil = now + 900;
  }

  /** 画布按 2 倍放大（像素清楚）；高度用满窗口剩下的地方，整页不用滚动 */
  fit(): void {
    if (!this.canvas || !this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    const border = this.wrap.offsetWidth - this.wrap.clientWidth;
    const cssW = Math.max(300, r.width - border);
    const top = r.top + window.scrollY;
    const cssH = Math.round(Math.max(240, Math.min(500, window.innerHeight - top - 345)));
    this.scale = 2;
    this.w = Math.ceil(cssW / this.scale);
    this.h = Math.ceil(cssH / this.scale);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = this.h * this.scale + 'px';
    this.wrap.style.height = this.h * this.scale + 'px';
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
  }

  private track(): number {
    return this.city.length - START - THIEF_AHEAD - DOOR_BEFORE;
  }

  private thiefS(q: number): number {
    return START + THIEF_AHEAD + q * this.track();
  }

  private policeTarget(p: number): number {
    return START + p * this.track();
  }

  /** 镜头：两个人都放得下就放在中间；放不下就跟着警车，往小偷那边偏 */
  private camTarget(s: SceneState): [number, number] {
    const c = this.city;
    const a = c.at(this.policeS);
    const b = c.at(this.thiefS(s.thief));
    const ax = c.sx(a);
    const ay = c.sy(a) - 8;
    let dx = c.sx(b) - ax;
    let dy = c.sy(b) - 8 - ay;
    const mx = this.w / 2 - 40;
    const my = this.h / 2 - 30;
    dx = Math.max(-mx, Math.min(mx, dx / 2));
    dy = Math.max(-my, Math.min(my, dy / 2));
    // 结束时成绩卡片在上面，把两个人放到画面下方
    const yAt = s.phase === 'won' || s.phase === 'lost' ? 0.74 : 0.55;
    const cx = Math.max(0, Math.min(c.width - this.w, ax + dx - this.w / 2));
    const cy = Math.max(0, Math.min(c.height - this.h, ay + dy - this.h * yAt));
    return [cx, cy];
  }

  private snapCamera(): void {
    const s = this.get();
    this.policeS = this.policeTarget(s.police);
    [this.camX, this.camY] = this.camTarget(s);
  }

  private draw(t: number): void {
    const c = this.ctx;
    if (!c) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const s = this.get();
    const city = this.city;
    const target = this.policeTarget(s.police);
    this.policeS += (target - this.policeS) * Math.min(1, dt * 8);
    if (Math.abs(target - this.policeS) < 0.005) this.policeS = target;
    const [tx, ty] = this.camTarget(s);
    this.camX += (tx - this.camX) * Math.min(1, dt * 3.5);
    this.camY += (ty - this.camY) * Math.min(1, dt * 3.5);
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const w = this.w;
    const h = this.h;
    const X = (g: G) => city.sx(g) - cx;
    const Y = (g: G) => city.sy(g) - cy;

    // 地面
    px(c, 0, 0, w, h, '#2b2e38');
    c.drawImage(city.ground, cx, cy, Math.min(w, city.width - cx), Math.min(h, city.height - cy), 0, 0, Math.min(w, city.width - cx), Math.min(h, city.height - cy));

    // 刹车印
    for (const k of this.skids) {
      k.t += dt;
      const al = Math.max(0, 0.5 - k.t / 12);
      if (al <= 0) continue;
      c.strokeStyle = `rgba(18,18,24,${al.toFixed(2)})`;
      c.lineWidth = 1;
      for (const off of [-0.18, 0.18]) {
        const side = { gx: -k.dir.gy * off, gy: k.dir.gx * off };
        const a = { gx: k.g.gx + side.gx - k.dir.gx * 0.2, gy: k.g.gy + side.gy - k.dir.gy * 0.2 };
        const b = { gx: k.g.gx + side.gx - k.dir.gx * 0.9, gy: k.g.gy + side.gy - k.dir.gy * 0.9 };
        c.beginPath();
        c.moveTo(X(a), Y(a));
        c.lineTo(X(b), Y(b));
        c.stroke();
      }
    }
    this.skids = this.skids.filter((k) => k.t < 6);

    // 警车、小偷
    const pol = city.at(this.policeS);
    const thiefPos = city.at(this.thiefS(s.thief));
    const gone = s.phase === 'lost' && t - s.endAt > 250;
    const flash = s.phase === 'ready' ? -1 : Math.floor(t / 130) % 2;
    const axis = (d: G): G => (Math.abs(d.gx) >= Math.abs(d.gy) ? { gx: Math.sign(d.gx) || 1, gy: 0 } : { gx: 0, gy: Math.sign(d.gy) || 1 });
    const ents: Ent[] = [];
    if (!gone) {
      ents.push({
        g: thiefPos,
        done: false,
        draw: (alpha) => {
          c.globalAlpha = alpha;
          if (alpha === 1) shadow(c, X(thiefPos), Y(thiefPos), 5, 2);
          const running = s.phase === 'run';
          const spr = s.phase === 'won' ? thiefSprite(0, true) : thiefSprite(running ? Math.floor(t / 85) : 0);
          // 往屏幕左边跑时左右翻过来
          const flip = thiefPos.dir.gx - thiefPos.dir.gy < -0.1;
          blitFoot(c, spr, X(thiefPos), Y(thiefPos), flip);
          c.globalAlpha = 1;
        },
      });
    }
    ents.push({
      g: pol,
      done: false,
      draw: (alpha) => {
        c.globalAlpha = alpha;
        drawIsoCar(c, Math.round(X(pol)), Math.round(Y(pol)), axis(pol.dir), '#f6f5f0', flash);
        c.globalAlpha = 1;
      },
    });
    ents.sort((a, b) => a.g.gx + a.g.gy - (b.g.gx + b.g.gy));

    // 楼、树、路边的车，和两个人一起按前后顺序画
    const inFront = (th: Thing, e: Ent) => th.mx > e.g.gx + 0.05 && th.my > e.g.gy + 0.05;
    for (const th of city.things) {
      if (th.x - cx > w || th.y - cy > h || th.x + th.img.width - cx < 0 || th.y + th.img.height - cy < 0) continue;
      for (const e of ents) {
        if (!e.done && inFront(th, e)) {
          e.draw(1);
          e.done = true;
        }
      }
      c.drawImage(th.img, th.x - cx, th.y - cy);
    }
    for (const e of ents) if (!e.done) e.draw(1);
    // 被楼挡住也看得到：再淡淡地画一遍
    for (const e of ents) e.draw(0.3);
    if (s.phase === 'won' && !gone) this.stars(c, X(thiefPos), Y(thiefPos) - 26, t);

    // 加速的火、扬起的灰
    const back = { gx: pol.gx - pol.dir.gx * 0.75, gy: pol.gy - pol.dir.gy * 0.75 };
    const moving = Math.abs(target - this.policeS) > 0.02 && s.phase === 'run';
    if (t < this.boostUntil && s.phase === 'run') {
      for (let k = 0; k < 2; k++) {
        const bx = city.sx(back);
        const by = city.sy(back) - 3;
        const vx = -(pol.dir.gx - pol.dir.gy) * 18;
        const vy = -(pol.dir.gx + pol.dir.gy) * 9;
        this.sparks.push({ x: bx + (Math.random() - 0.5) * 4, y: by + (Math.random() - 0.5) * 3, vx, vy, t: 0, kind: 'flame' });
      }
    } else if (moving && Math.random() < dt * 12) {
      this.sparks.push({ x: city.sx(back), y: city.sy(back), vx: 0, vy: 0, t: 0, kind: 'dust' });
    }
    if (s.phase === 'run' && !gone && Math.random() < dt * 8) {
      this.sparks.push({ x: city.sx(thiefPos) - 3, y: city.sy(thiefPos), vx: 0, vy: 0, t: 0, kind: 'dust' });
    }
    for (const p of this.sparks) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'flame') {
        const col = p.t < 0.12 ? '#fff3b0' : p.t < 0.25 ? '#ffb347' : '#e8553d';
        if (p.t < 0.3) px(c, Math.round(p.x - cx), Math.round(p.y - cy), 2, 2, col);
      } else {
        const a = Math.max(0, 0.4 - p.t * 0.5);
        c.fillStyle = `rgba(225,215,195,${a.toFixed(2)})`;
        const r = 1 + Math.round(p.t * 3);
        c.fillRect(Math.round(p.x - cx - r), Math.round(p.y - cy - r - p.t * 4), r * 2, r * 2);
      }
    }
    this.sparks = this.sparks.filter((p) => p.t < (p.kind === 'flame' ? 0.3 : 0.9));

    this.lighting(c, pol, flash, X, Y);
    this.minimap(c, s, pol, thiefPos, gone);
    if (!gone) this.arrow(c, X(thiefPos), Y(thiefPos) - 10);
  }

  private stars(c: Ctx, x: number, y: number, t: number): void {
    for (let i = 0; i < 3; i++) {
      const a = t / 260 + (i * Math.PI * 2) / 3;
      const sx = Math.round(x + Math.cos(a) * 7);
      const sy = Math.round(y + Math.sin(a) * 2.5);
      px(c, sx, sy - 1, 1, 3, '#ffd75e');
      px(c, sx - 1, sy, 3, 1, '#ffd75e');
    }
  }

  private lighting(c: Ctx, pol: G & { dir: G }, flash: number, X: (g: G) => number, Y: (g: G) => number): void {
    const tod = this.city.tod;
    if (tod === 'day') return;
    const w = this.w;
    const h = this.h;
    if (!this.light || this.light.width !== w || this.light.height !== h) {
      this.light = document.createElement('canvas');
      this.light.width = w;
      this.light.height = h;
    }
    const l = this.light.getContext('2d') as Ctx;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, w, h);
    l.fillStyle = tod === 'night' ? 'rgba(6,10,32,.5)' : 'rgba(60,30,60,.2)';
    l.fillRect(0, 0, w, h);
    l.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, rx: number, ry: number, a: number) => {
      l.save();
      l.translate(x, y);
      l.scale(1, ry / rx);
      const g = l.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(-rx, -rx, rx * 2, rx * 2);
      l.restore();
    };
    for (const p of this.city.lamps) {
      const x = X(p);
      const y = Y(p);
      if (x < -50 || y < -50 || x > w + 50 || y > h + 50) continue;
      hole(x, y, 34, 18, 0.85);
    }
    // 警车大灯：车头前面一片
    const ahead = { gx: pol.gx + pol.dir.gx * 1.8, gy: pol.gy + pol.dir.gy * 1.8 };
    hole(X(ahead), Y(ahead), 30, 15, 0.9);
    hole(X(pol), Y(pol), 18, 10, 0.8);
    l.globalCompositeOperation = 'source-over';
    c.drawImage(this.light, 0, 0);
    // 路灯的暖光、警灯的红蓝光
    c.save();
    c.globalCompositeOperation = 'lighter';
    if (flash >= 0) {
      const x = X(pol);
      const y = Y(pol) - 8;
      const g = c.createRadialGradient(x, y, 0, x, y, 28);
      g.addColorStop(0, flash ? 'rgba(60,120,255,.35)' : 'rgba(255,60,50,.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - 28, y - 28, 56, 56);
    }
    for (const p of this.city.lamps) {
      const x = X(p);
      const y = Y(p);
      if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
      const g = c.createRadialGradient(x, y, 0, x, y, 20);
      g.addColorStop(0, `rgba(255,200,120,${tod === 'night' ? 0.2 : 0.1})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - 20, y - 20, 40, 40);
    }
    c.restore();
  }

  /** 右上角的小地图：整条路线、警车、小偷、仓库 */
  private minimap(c: Ctx, s: SceneState, pol: G, th: G, gone: boolean): void {
    const city = this.city;
    const pts = city.path.map((g) => [city.sx(g), city.sy(g)]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX || 1;
    const spanY = Math.max(...ys) - minY || 1;
    const mw = Math.min(96, Math.round(this.w * 0.2));
    const k = mw / spanX;
    const mh = Math.max(14, Math.round(spanY * k));
    const ox = this.w - mw - 8;
    const oy = 7;
    c.fillStyle = 'rgba(16,18,28,.55)';
    c.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
    c.strokeStyle = 'rgba(255,255,255,.5)';
    c.lineWidth = 1;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(ox + (x - minX) * k, oy + (y - minY) * k) : c.moveTo(ox + (x - minX) * k, oy + (y - minY) * k)));
    c.stroke();
    const dot = (g: G, r: number, col: string) => px(c, Math.round(ox + (city.sx(g) - minX) * k - r), Math.round(oy + (city.sy(g) - minY) * k - r), r * 2, r * 2, col);
    dot(city.hideout, 2, '#e8b931');
    if (!gone && s.phase !== 'lost') dot(th, 1.5, '#ff5a4e');
    dot(pol, 2, '#ffffff');
    dot(pol, 1, '#3f7cff');
  }

  /** 小偷跑出画面时，画面边上一个指向他的箭头 */
  private arrow(c: Ctx, x: number, y: number): void {
    const w = this.w;
    const h = this.h;
    if (x >= 4 && y >= 4 && x <= w - 4 && y <= h - 4) return;
    const ax = Math.max(10, Math.min(w - 10, x));
    const ay = Math.max(10, Math.min(h - 10, y));
    const a = Math.atan2(y - ay, x - ax);
    c.save();
    c.translate(ax, ay);
    c.fillStyle = 'rgba(16,18,28,.7)';
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    c.fill();
    c.rotate(a);
    c.fillStyle = '#ff5a4e';
    c.beginPath();
    c.moveTo(5, 0);
    c.lineTo(-3, -4);
    c.lineTo(-3, 4);
    c.closePath();
    c.fill();
    c.restore();
  }
}
