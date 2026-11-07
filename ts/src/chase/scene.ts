// 追击画面（斜 45° 的等距视角）：镜头跟着警车和小偷，在城市的大街上斜着追。
// 画布和屏幕像素一样精细（Retina 屏两倍），所有东西都按大地图上的像素画，统一放大。
// 楼挡住人时，人会透过楼淡淡地显出来；右上角小地图，小偷跑出画面时边上有箭头。
// 夜里路灯和警车大灯照亮路面，警灯一红一蓝地闪；打错了留下刹车印，连击时警车冒火加速。

import { G, IsoCity, Thing } from './iso';
import { drawCar } from './paint';
import { Ctx, drawThief, shadow } from './sprites';

export interface SceneState {
  police: number; // 警车进度 0–1
  thief: number; // 小偷进度 0–1
  phase: 'ready' | 'run' | 'paused' | 'won' | 'lost';
  endAt: number; // 结束的时刻（performance.now），播结尾动画
}

const START = 2.5; // 路线上起跑的位置（格）
const THIEF_AHEAD = 0.9; // 进度相同时小偷在警车前面多少格（车头碰到人）
const DOOR_BEFORE = 0.25; // 小偷跑到离仓库门这么近就算进去了
const ZOOM = 2; // 一个大地图像素在页面上占几个 CSS 像素

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
  private w = 300; // 画面的大小（大地图上的像素）
  private h = 160;
  private Z = ZOOM; // 一个大地图像素 = Z 个画布像素
  private camX = 0;
  private camY = 0;
  private policeS = START;
  private carDir: G = { gx: 1, gy: 0 };
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
    this.carDir = { ...city.at(START).dir };
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

  /** 画布按屏幕的真实像素来（Retina 屏两倍）；高度用满窗口剩下的地方，整页不用滚动 */
  fit(): void {
    if (!this.canvas || !this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    const border = this.wrap.offsetWidth - this.wrap.clientWidth;
    const cssW = Math.max(300, r.width - border);
    const top = r.top + window.scrollY;
    const cssH = Math.round(Math.max(240, Math.min(500, window.innerHeight - top - 345)));
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    this.Z = ZOOM * dpr;
    this.w = cssW / ZOOM;
    this.h = cssH / ZOOM;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.wrap.style.height = cssH + 'px';
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
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
    this.carDir = { ...this.city.at(this.policeS).dir };
    [this.camX, this.camY] = this.camTarget(s);
  }

  private draw(t: number): void {
    const c = this.ctx;
    const cv = this.canvas;
    if (!c || !cv) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const s = this.get();
    const city = this.city;
    city.tick();
    const Z = this.Z;
    const target = this.policeTarget(s.police);
    this.policeS += (target - this.policeS) * Math.min(1, dt * 8);
    if (Math.abs(target - this.policeS) < 0.005) this.policeS = target;
    const [tx, ty] = this.camTarget(s);
    this.camX += (tx - this.camX) * Math.min(1, dt * 3.5);
    this.camY += (ty - this.camY) * Math.min(1, dt * 3.5);
    // 镜头对齐到画布像素，楼的小图画上去不会糊
    const cx = Math.round(this.camX * Z) / Z;
    const cy = Math.round(this.camY * Z) / Z;
    const w = this.w;
    const h = this.h;
    const X = (g: G) => city.sx(g);
    const Y = (g: G) => city.sy(g);
    const tod = city.tod;

    // 下面都按大地图上的像素画
    c.setTransform(Z, 0, 0, Z, -cx * Z, -cy * Z);
    c.fillStyle = '#2b2e38';
    c.fillRect(cx, cy, w, h);
    city.drawGround(c, cx, cy, w, h, Z);

    // 刹车印
    c.lineCap = 'round';
    for (const k of this.skids) {
      k.t += dt;
      const al = Math.max(0, 0.45 - k.t / 12);
      if (al <= 0) continue;
      c.strokeStyle = `rgba(18,18,24,${al.toFixed(2)})`;
      c.lineWidth = 1.1;
      for (const off of [-0.2, 0.2]) {
        const side = { gx: -k.dir.gy * off, gy: k.dir.gx * off };
        const a = { gx: k.g.gx + side.gx - k.dir.gx * 0.2, gy: k.g.gy + side.gy - k.dir.gy * 0.2 };
        const b = { gx: k.g.gx + side.gx - k.dir.gx * 1.0, gy: k.g.gy + side.gy - k.dir.gy * 1.0 };
        c.beginPath();
        c.moveTo(X(a), Y(a));
        c.lineTo(X(b), Y(b));
        c.stroke();
      }
    }
    this.skids = this.skids.filter((k) => k.t < 6);

    // 夜里、傍晚：路面暗下来，路灯、车灯照到的地方亮
    if (tod !== 'day') this.darkGround(c, cv, cx, cy);

    // 警车、小偷
    const pol = city.at(this.policeS);
    // 车头慢慢转过去，拐弯不突兀
    const k = Math.min(1, dt * 10);
    this.carDir = { gx: this.carDir.gx + (pol.dir.gx - this.carDir.gx) * k, gy: this.carDir.gy + (pol.dir.gy - this.carDir.gy) * k };
    const len = Math.hypot(this.carDir.gx, this.carDir.gy) || 1;
    const dir = { gx: this.carDir.gx / len, gy: this.carDir.gy / len };
    const thiefPos = city.at(this.thiefS(s.thief));
    const gone = s.phase === 'lost' && t - s.endAt > 250;
    const flash = s.phase === 'ready' ? -1 : Math.floor(t / 140) % 2;
    const ents: Ent[] = [];
    if (!gone) {
      ents.push({
        g: thiefPos,
        done: false,
        draw: (alpha) => {
          c.globalAlpha = alpha;
          if (alpha === 1) shadow(c, X(thiefPos) + 1.2, Y(thiefPos) + 0.4, 5, 2);
          const pose = s.phase === 'won' ? 'caught' : s.phase === 'run' ? 'run' : 'stand';
          // 往屏幕左边跑时左右翻过来
          const flip = thiefPos.dir.gx - thiefPos.dir.gy < -0.1;
          drawThief(c, X(thiefPos), Y(thiefPos), t, pose, flip, tod);
          c.globalAlpha = 1;
        },
      });
    }
    ents.push({
      g: pol,
      done: false,
      draw: (alpha) => {
        c.globalAlpha = alpha;
        drawCar(c, X(pol), Y(pol), dir, '#f4f3ee', 'police', flash, tod === 'night' ? 'dusk' : tod);
        c.globalAlpha = 1;
      },
    });
    ents.sort((a, b) => a.g.gx + a.g.gy - (b.g.gx + b.g.gy));

    // 楼、树、路边的车，和两个人一起按前后顺序画
    const inFront = (th: Thing, e: Ent) => th.mx > e.g.gx + 0.05 && th.my > e.g.gy + 0.05;
    // 人（车）的身子在前面哪栋楼的轮廓里，就算被挡住了
    const hidden = new Set<Ent>();
    for (const th of city.things) {
      if (th.x > cx + w || th.y > cy + h || th.x + th.w < cx || th.y + th.h < cy) continue;
      for (const e of ents) {
        if (!e.done && inFront(th, e)) {
          e.draw(1);
          e.done = true;
        }
      }
      th.draw(c, Z);
      if (th.sil) for (const e of ents) if (e.done && inside(th.sil, X(e.g), Y(e.g) - 8)) hidden.add(e);
    }
    for (const e of ents) if (!e.done) e.draw(1);
    // 被楼挡住也看得到：再淡淡地画一遍；挡住了头顶上再加一个标记（小偷红色、警车蓝色）
    for (const e of ents) e.draw(hidden.has(e) ? 0.45 : 0.28);
    for (const e of hidden) this.marker(c, X(e.g), Y(e.g) - (e.g === thiefPos ? 31 : 16), t, e.g === thiefPos ? '#ff4d40' : '#3f7cff');
    if (s.phase === 'won' && !gone) this.stars(c, X(thiefPos), Y(thiefPos) - 30, t);

    // 加速的火、扬起的灰
    const back = { gx: pol.gx - dir.gx * 0.75, gy: pol.gy - dir.gy * 0.75 };
    const moving = Math.abs(target - this.policeS) > 0.02 && s.phase === 'run';
    if (t < this.boostUntil && s.phase === 'run') {
      for (let n = 0; n < 2; n++) {
        const bx = city.sx(back);
        const by = city.sy(back) - 3;
        const vx = -(dir.gx - dir.gy) * 22;
        const vy = -(dir.gx + dir.gy) * 11;
        this.sparks.push({ x: bx + (Math.random() - 0.5) * 3, y: by + (Math.random() - 0.5) * 2, vx: vx + (Math.random() - 0.5) * 8, vy: vy + (Math.random() - 0.5) * 6, t: 0, kind: 'flame' });
      }
    } else if (moving && Math.random() < dt * 12) {
      this.sparks.push({ x: city.sx(back), y: city.sy(back), vx: 0, vy: -3, t: 0, kind: 'dust' });
    }
    if (s.phase === 'run' && !gone && Math.random() < dt * 8) {
      this.sparks.push({ x: city.sx(thiefPos) - 3, y: city.sy(thiefPos), vx: 0, vy: -2, t: 0, kind: 'dust' });
    }
    for (const p of this.sparks) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dust') {
        const a = Math.max(0, 0.32 - p.t * 0.38);
        c.fillStyle = `rgba(228,220,204,${a.toFixed(2)})`;
        c.beginPath();
        c.arc(p.x, p.y - p.t * 3, 1.2 + p.t * 3.2, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      if (p.kind !== 'flame' || p.t >= 0.32) continue;
      const r = 2.6 - p.t * 5;
      const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, p.t < 0.1 ? 'rgba(255,250,220,.95)' : 'rgba(255,200,90,.85)');
      gr.addColorStop(0.5, 'rgba(255,120,50,.55)');
      gr.addColorStop(1, 'rgba(255,60,30,0)');
      c.fillStyle = gr;
      c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    c.restore();
    this.sparks = this.sparks.filter((p) => p.t < (p.kind === 'flame' ? 0.32 : 0.85));

    this.glows(c, pol, dir, flash);

    // 画面上的东西（小地图、箭头）按画面坐标画
    c.setTransform(Z, 0, 0, Z, 0, 0);
    if (tod === 'dusk') {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,150,90,.14)');
      gr.addColorStop(1, 'rgba(120,60,120,.06)');
      c.fillStyle = gr;
      c.fillRect(0, 0, w, h);
    }
    // 四周一圈淡淡的暗角
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,10,24,.22)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
    this.minimap(c, s, pol, thiefPos, gone, cx, cy);
    if (!gone) this.arrow(c, X(thiefPos) - cx, Y(thiefPos) - cy - 12);
  }

  /** 被挡住时头顶的倒三角，一上一下地跳 */
  private marker(c: Ctx, x: number, y: number, t: number, col: string): void {
    const by = y + Math.sin(t / 180) * 1.2;
    c.save();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(x - 3.6, by - 3.4);
    c.lineTo(x + 3.6, by - 3.4);
    c.lineTo(x, by + 2.2);
    c.closePath();
    c.fill();
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x - 2.5, by - 2.7);
    c.lineTo(x + 2.5, by - 2.7);
    c.lineTo(x, by + 1.1);
    c.closePath();
    c.fill();
    c.restore();
  }

  private stars(c: Ctx, x: number, y: number, t: number): void {
    c.fillStyle = '#ffd75e';
    for (let i = 0; i < 3; i++) {
      const a = t / 260 + (i * Math.PI * 2) / 3;
      const sx = x + Math.cos(a) * 7;
      const sy = y + Math.sin(a) * 2.5;
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 0.7 : 1.8;
        const an = (k * Math.PI) / 5 - Math.PI / 2;
        c.lineTo(sx + Math.cos(an) * r, sy + Math.sin(an) * r);
      }
      c.closePath();
      c.fill();
    }
  }

  /** 夜里、傍晚：盖一层暗色，路灯和车灯的地方挖出亮光（只压在地面上，楼的灯窗还是亮的） */
  private darkGround(c: Ctx, cv: HTMLCanvasElement, cx: number, cy: number): void {
    const tod = this.city.tod;
    const Z = this.Z;
    if (!this.light || this.light.width !== cv.width || this.light.height !== cv.height) {
      this.light = document.createElement('canvas');
      this.light.width = cv.width;
      this.light.height = cv.height;
    }
    const l = this.light.getContext('2d') as Ctx;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, cv.width, cv.height);
    l.fillStyle = tod === 'night' ? 'rgba(6,10,30,.42)' : 'rgba(50,25,55,.16)';
    l.fillRect(0, 0, cv.width, cv.height);
    l.setTransform(Z, 0, 0, Z, -cx * Z, -cy * Z);
    l.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, rx: number, ry: number, a: number) => {
      l.save();
      l.translate(x, y);
      l.scale(1, ry / rx);
      const g = l.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.6, `rgba(0,0,0,${a * 0.5})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(-rx, -rx, rx * 2, rx * 2);
      l.restore();
    };
    const city = this.city;
    for (const p of city.lamps) {
      const x = city.sx(p) + 4;
      const y = city.sy(p) + 2;
      if (x < cx - 60 || y < cy - 60 || x > cx + this.w + 60 || y > cy + this.h + 60) continue;
      hole(x, y, 36, 18, 0.9);
    }
    const pol = city.at(this.policeS);
    const d = this.carDir;
    const ahead = { gx: pol.gx + d.gx * 1.9, gy: pol.gy + d.gy * 1.9 };
    hole(city.sx(ahead), city.sy(ahead), 32, 16, 0.95);
    hole(city.sx(pol), city.sy(pol), 18, 10, 0.8);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.light, 0, 0);
    c.restore();
  }

  /** 发光的东西：警灯的红蓝光、夜里的路灯和车灯 */
  private glows(c: Ctx, pol: G, dir: G, flash: number): void {
    const city = this.city;
    const tod = city.tod;
    const X = city.sx(pol);
    const Y = city.sy(pol);
    c.save();
    c.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, col: string) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (flash >= 0) {
      const a = tod === 'day' ? 0.22 : 0.42;
      glow(X, Y - 9, tod === 'day' ? 16 : 30, flash ? `rgba(60,130,255,${a})` : `rgba(255,60,50,${a})`);
    }
    if (tod !== 'day') {
      // 大灯照出去的一片
      const hx = X + (dir.gx - dir.gy) * 16 * 1.4;
      const hy = Y + (dir.gx + dir.gy) * 8 * 1.4 - 2;
      glow(hx, hy, 14, 'rgba(255,240,200,.16)');
    }
    c.restore();
  }

  /** 右上角的小地图：整条路线、警车、小偷、仓库 */
  private minimap(c: Ctx, s: SceneState, pol: G, th: G, gone: boolean, cx: number, cy: number): void {
    const city = this.city;
    const pts = city.path.map((g) => [city.sx(g), city.sy(g)]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX || 1;
    const spanY = Math.max(...ys) - minY || 1;
    const mw = Math.min(100, Math.round(this.w * 0.2));
    const k = mw / spanX;
    const mh = Math.max(14, Math.round(spanY * k));
    const ox = this.w - mw - 9;
    const oy = 8;
    const pad = 5;
    c.fillStyle = 'rgba(16,18,30,.62)';
    c.beginPath();
    c.roundRect(ox - pad, oy - pad, mw + pad * 2, mh + pad * 2, 4);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)';
    c.lineWidth = 0.5;
    c.stroke();
    const M = (x: number, y: number): [number, number] => [ox + (x - minX) * k, oy + (y - minY) * k];
    // 画面里看到的范围
    c.strokeStyle = 'rgba(255,255,255,.25)';
    c.lineWidth = 0.5;
    const [vx, vy] = M(cx, cy);
    c.strokeRect(vx, vy, this.w * k, this.h * k);
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.lineWidth = 1;
    c.lineJoin = 'round';
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(...M(x, y)) : c.moveTo(...M(x, y))));
    c.stroke();
    const dot = (g: G, r: number, col: string, ring?: string) => {
      const [x, y] = M(city.sx(g), city.sy(g));
      if (ring) {
        c.fillStyle = ring;
        c.beginPath();
        c.arc(x, y, r + 0.8, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = col;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };
    const [hx, hy] = M(city.sx(city.hideout), city.sy(city.hideout));
    c.fillStyle = '#e8b931';
    c.fillRect(hx - 2.2, hy - 2.2, 4.4, 4.4);
    if (!gone && s.phase !== 'lost') dot(th, 1.7, '#ff5a4e', 'rgba(255,255,255,.85)');
    dot(pol, 2, '#3f7cff', '#ffffff');
  }

  /** 小偷跑出画面时，画面边上一个指向他的箭头 */
  private arrow(c: Ctx, x: number, y: number): void {
    const w = this.w;
    const h = this.h;
    if (x >= 4 && y >= 4 && x <= w - 4 && y <= h - 4) return;
    const ax = Math.max(12, Math.min(w - 12, x));
    const ay = Math.max(12, Math.min(h - 12, y));
    const a = Math.atan2(y - ay, x - ax);
    c.save();
    c.translate(ax, ay);
    c.fillStyle = 'rgba(16,18,30,.72)';
    c.beginPath();
    c.arc(0, 0, 8.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.2)';
    c.lineWidth = 0.6;
    c.stroke();
    c.rotate(a);
    c.fillStyle = '#ff5a4e';
    c.beginPath();
    c.moveTo(5, 0);
    c.lineTo(-3, -4);
    c.lineTo(-1.5, 0);
    c.lineTo(-3, 4);
    c.closePath();
    c.fill();
    c.restore();
  }
}

/** 点 (x, y) 在不在多边形里 */
function inside(pts: [number, number][], x: number, y: number): boolean {
  let n = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) n = !n;
  }
  return n;
}
