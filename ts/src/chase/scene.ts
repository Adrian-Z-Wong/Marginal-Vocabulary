// 追击画面（俯视）：镜头跟着警车和小偷，在城市里拐来拐去。
// 右上角小地图，夜里路灯和警车大灯照亮一片，警灯一红一蓝地闪，打错了轮胎留下刹车印，连击时警车加速冒火。

import { City, TimeOfDay, timeOfDay } from './city';
import { Ctx, blit, policeSprite, px, shadow, thiefSprite } from './sprites';

export interface SceneState {
  police: number; // 警车进度 0–1
  thief: number; // 小偷进度 0–1
  phase: 'ready' | 'run' | 'paused' | 'won' | 'lost';
  endAt: number; // 结束的时刻（performance.now），播结尾动画
}

const START = 34; // 路线上起跑的位置
const THIEF_AHEAD = 18; // 进度相同时小偷在警车前面多少像素（车头碰到人）
const DOOR_BEFORE = 6; // 小偷跑到离仓库门这么近就算进去了

interface Skid {
  x: number;
  y: number;
  a: number;
  t: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  kind: 'flame' | 'dust';
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
  private policeS = START; // 画面上的警车位置（平滑跟随）
  private last = 0;
  private skids: Skid[] = [];
  private sparks: Spark[] = [];
  private boostUntil = 0;
  private light: HTMLCanvasElement | null = null;
  city: City;
  private readonly get: () => SceneState;

  constructor(get: () => SceneState, city: City) {
    this.get = get;
    this.city = city;
  }

  /** 换一局：新地图 */
  reset(city: City): void {
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
    this.skids.push({ x: p.x, y: p.y, a: p.angle, t: 0 });
    if (this.skids.length > 60) this.skids.shift();
  }

  /** 连击加速：车尾冒火 */
  boost(now: number): void {
    this.boostUntil = now + 900;
  }

  /** 画布按整数倍放大（像素清楚），宽度跟着页面，高度占窗口的一半左右 */
  fit(): void {
    if (!this.canvas || !this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    const border = this.wrap.offsetWidth - this.wrap.clientWidth;
    const cssW = Math.max(300, r.width - border);
    // 下面还有成绩条和打字框（约 330 像素），整页不用滚动
    const top = r.top + window.scrollY;
    const cssH = Math.round(Math.max(240, Math.min(480, window.innerHeight - top - 345)));
    // 放大 3 倍，警车和小偷看得清；窄窗口放大 2 倍，看得到的街区多一点
    this.scale = cssW >= 700 && cssH >= 300 ? 3 : 2;
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
    const a = this.city.at(this.policeS);
    const b = this.city.at(this.thiefS(s.thief));
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const mx = this.w / 2 - 34;
    const my = this.h / 2 - 26;
    dx = Math.max(-mx, Math.min(mx, dx / 2));
    dy = Math.max(-my, Math.min(my, dy / 2));
    // 结束时成绩卡片在上面，把两个人放到画面下方
    const yAt = s.phase === 'won' || s.phase === 'lost' ? 0.74 : 0.5;
    let cx = a.x + dx - this.w / 2;
    let cy = a.y + dy - this.h * yAt;
    cx = Math.max(0, Math.min(this.city.width - this.w, cx));
    cy = Math.max(0, Math.min(this.city.height - this.h, cy));
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
    if (Math.abs(target - this.policeS) < 0.05) this.policeS = target;
    const [tx, ty] = this.camTarget(s);
    this.camX += (tx - this.camX) * Math.min(1, dt * 3.5);
    this.camY += (ty - this.camY) * Math.min(1, dt * 3.5);
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const w = this.w;
    const h = this.h;

    // 地图
    px(c, 0, 0, w, h, '#2b2e38');
    c.drawImage(city.map, cx, cy, Math.min(w, city.width - cx), Math.min(h, city.height - cy), 0, 0, Math.min(w, city.width - cx), Math.min(h, city.height - cy));

    // 刹车印
    for (const k of this.skids) {
      k.t += dt;
      const al = Math.max(0, 0.45 - k.t / 14);
      if (al <= 0) continue;
      c.save();
      c.translate(Math.round(k.x - cx), Math.round(k.y - cy));
      c.rotate(Math.round(k.a / (Math.PI / 2)) * (Math.PI / 2));
      c.fillStyle = `rgba(20,20,26,${al.toFixed(2)})`;
      c.fillRect(-14, -5, 9, 1);
      c.fillRect(-14, 4, 9, 1);
      c.restore();
    }
    this.skids = this.skids.filter((k) => k.t < 7);

    // 仓库门：小偷跑进去以后关上
    const hd = city.hideout;
    let door = 1;
    if (s.phase === 'lost') door = Math.max(0, 1 - (t - s.endAt - 350) / 500);
    this.drawDoor(c, hd, door, cx, cy);

    // 小偷
    const thiefPos = city.at(this.thiefS(s.thief));
    const gone = s.phase === 'lost' && t - s.endAt > 350;
    if (!gone) {
      const running = s.phase === 'run';
      shadow(c, thiefPos.x - cx, thiefPos.y - cy, 5, 3);
      const spr = s.phase === 'won' ? thiefSprite(0, true) : thiefSprite(running ? Math.floor(t / 85) : 0);
      blit(c, spr, thiefPos.x - cx, thiefPos.y - cy, thiefPos.angle);
      if (running && Math.random() < dt * 9) this.sparks.push({ x: thiefPos.x - Math.cos(thiefPos.angle) * 5, y: thiefPos.y - Math.sin(thiefPos.angle) * 5, vx: 0, vy: 0, t: 0, kind: 'dust' });
      if (s.phase === 'won') this.stars(c, thiefPos.x - cx, thiefPos.y - cy - 9, t);
    }

    // 警车
    const pol = city.at(this.policeS);
    const moving = Math.abs(target - this.policeS) > 0.3 && s.phase === 'run';
    const flash = s.phase === 'ready' ? -1 : Math.floor(t / 130) % 2;
    shadow(c, pol.x - cx, pol.y - cy, 11, 5);
    blit(c, policeSprite(flash), pol.x - cx, pol.y - cy, pol.angle);
    if (t < this.boostUntil && s.phase === 'run') {
      for (let k = 0; k < 2; k++)
        this.sparks.push({
          x: pol.x - Math.cos(pol.angle) * 12,
          y: pol.y - Math.sin(pol.angle) * 12 + (Math.random() - 0.5) * 6,
          vx: -Math.cos(pol.angle) * 30,
          vy: -Math.sin(pol.angle) * 30,
          t: 0,
          kind: 'flame',
        });
    } else if (moving && Math.random() < dt * 12) {
      this.sparks.push({ x: pol.x - Math.cos(pol.angle) * 12, y: pol.y - Math.sin(pol.angle) * 12, vx: 0, vy: 0, t: 0, kind: 'dust' });
    }

    // 火花、灰尘
    for (const p of this.sparks) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'flame') {
        const col = p.t < 0.12 ? '#fff3b0' : p.t < 0.25 ? '#ffb347' : '#e8553d';
        if (p.t < 0.4) px(c, Math.round(p.x - cx), Math.round(p.y - cy), 2, 2, col);
      } else {
        const a = Math.max(0, 0.4 - p.t * 0.5);
        c.fillStyle = `rgba(225,215,195,${a.toFixed(2)})`;
        const r = 1 + Math.round(p.t * 3);
        c.fillRect(Math.round(p.x - cx - r), Math.round(p.y - cy - r), r * 2, r * 2);
      }
    }
    this.sparks = this.sparks.filter((p) => p.t < (p.kind === 'flame' ? 0.4 : 0.9));

    // 光线：夜里、傍晚
    this.lighting(c, city.tod, pol, flash, cx, cy);

    // 小地图、小偷在画面外时的箭头
    this.minimap(c, s, pol, thiefPos);
    if (!gone) this.arrow(c, thiefPos.x - cx, thiefPos.y - cy);
  }

  private drawDoor(c: Ctx, hd: City['hideout'], open: number, cx: number, cy: number): void {
    const d = hd.dir;
    const len = 18;
    const thick = 3;
    // 门在仓库朝着路线的那一面
    const dx = d.x ? (d.x > 0 ? hd.x : hd.x + hd.w - thick) : hd.doorX - len / 2;
    const dy = d.y ? (d.y > 0 ? hd.y : hd.y + hd.h - thick) : hd.doorY - len / 2;
    const w = d.x ? thick : len;
    const hh = d.x ? len : thick;
    px(c, Math.round(dx - cx), Math.round(dy - cy), w, hh, '#101015');
    if (open < 1) {
      // 卷帘门往下放
      const k = 1 - open;
      if (d.x) px(c, Math.round(dx - cx), Math.round(dy - cy), w, Math.round(hh * k), '#9aa0aa');
      else px(c, Math.round(dx - cx), Math.round(dy - cy), Math.round(w * k), hh, '#9aa0aa');
    }
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

  private lighting(c: Ctx, tod: TimeOfDay, pol: { x: number; y: number; angle: number }, flash: number, cx: number, cy: number): void {
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
    l.fillStyle = tod === 'night' ? 'rgba(6,10,32,.58)' : 'rgba(60,30,60,.22)';
    l.fillRect(0, 0, w, h);
    l.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a: number) => {
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const p of this.city.lights) {
      const x = p.x - cx;
      const y = p.y - cy;
      if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
      hole(x, y, 30, 0.85);
    }
    // 警车大灯：车头前面一片
    const fx = pol.x - cx + Math.cos(pol.angle) * 26;
    const fy = pol.y - cy + Math.sin(pol.angle) * 26;
    hole(fx, fy, 24, 0.9);
    hole(pol.x - cx, pol.y - cy, 16, 0.8);
    l.globalCompositeOperation = 'source-over';
    c.drawImage(this.light, 0, 0);
    // 暖色的灯光和警灯的光晕
    c.save();
    c.globalCompositeOperation = 'lighter';
    if (flash >= 0) {
      const g = c.createRadialGradient(pol.x - cx, pol.y - cy, 0, pol.x - cx, pol.y - cy, 26);
      g.addColorStop(0, flash ? 'rgba(60,120,255,.35)' : 'rgba(255,60,50,.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(pol.x - cx - 26, pol.y - cy - 26, 52, 52);
    }
    for (const p of this.city.lights) {
      const x = p.x - cx;
      const y = p.y - cy;
      if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
      const g = c.createRadialGradient(x, y, 0, x, y, 18);
      g.addColorStop(0, `rgba(255,200,120,${tod === 'night' ? 0.22 : 0.12})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - 18, y - 18, 36, 36);
    }
    c.restore();
  }

  /** 右上角的小地图：整条路线、警车、小偷、仓库 */
  private minimap(c: Ctx, s: SceneState, pol: { x: number; y: number }, th: { x: number; y: number }): void {
    const city = this.city;
    const mw = Math.min(84, Math.round(this.w * 0.2));
    const k = mw / city.width;
    const mh = Math.max(16, Math.round(city.height * k));
    const ox = this.w - mw - 6;
    const oy = 6;
    c.fillStyle = 'rgba(16,18,28,.55)';
    c.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);
    c.strokeStyle = 'rgba(255,255,255,.18)';
    c.lineWidth = 1;
    c.strokeRect(ox - 1.5, oy - 1.5, mw + 3, mh + 3);
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    city.path.forEach((p, i) => (i ? c.lineTo(ox + p.x * k, oy + p.y * k) : c.moveTo(ox + p.x * k, oy + p.y * k)));
    c.stroke();
    const hd = city.hideout;
    px(c, Math.round(ox + (hd.x + hd.w / 2) * k) - 2, Math.round(oy + (hd.y + hd.h / 2) * k) - 2, 4, 4, '#e8b931');
    if (!(s.phase === 'lost')) px(c, Math.round(ox + th.x * k) - 1, Math.round(oy + th.y * k) - 1, 3, 3, '#ff5a4e');
    px(c, Math.round(ox + pol.x * k) - 2, Math.round(oy + pol.y * k) - 2, 4, 4, '#ffffff');
    px(c, Math.round(ox + pol.x * k) - 1, Math.round(oy + pol.y * k) - 1, 2, 2, '#3f7cff');
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

  /** 当前是白天、傍晚还是夜里（开新地图时用） */
  static tod(): TimeOfDay {
    return timeOfDay();
  }
}
