// 追击画面：低分辨率画布按整数倍放大，跟着页面宽度变；镜头跟着警车，小偷跑出画面时边上有箭头。

import { CAR_W, Ctx, PALETTES, Palette, Y, drawCar, drawDust, drawFar, drawHideout, drawMid, drawSky, drawStars, drawStreet, drawThief, paletteNow, rect } from './art';

/** 整段文章对应的路有多长（画布像素） */
export const TRACK = 1800;
/** 进度相同时，警车车头离小偷还差几个像素 */
const GAP0 = 4;

export interface SceneState {
  police: number; // 警车进度 0–1（打对的字 / 全文）
  thief: number; // 小偷进度 0–1
  phase: 'ready' | 'count' | 'run' | 'paused' | 'won' | 'lost';
  wrong: boolean; // 有错字没改，警车停着
  endAt: number; // 结束的时刻（performance.now），用来播结尾动画
}

export class ChaseScene {
  private canvas: HTMLCanvasElement | null = null;
  private wrap: HTMLElement | null = null;
  private ctx: Ctx | null = null;
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private w = 320;
  private scale = 3;
  private cam = 0;
  private carX = 0; // 画面上的警车位置（平滑跟随）
  private last = 0;
  private dust: { x: number; y: number; t: number }[] = [];
  private pal: Palette = paletteNow();
  private readonly get: () => SceneState;

  constructor(get: () => SceneState) {
    this.get = get;
  }

  attach(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
    this.detach();
    this.canvas = canvas;
    this.wrap = wrap;
    this.ctx = canvas.getContext('2d');
    this.pal = paletteNow();
    const s = this.get();
    this.carX = this.carWorld(s.police);
    this.cam = this.camTarget(s);
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(wrap);
    }
    this.fit();
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

  /** 画布高 128 像素，按页面宽度选整数倍；宽度跟着页面变 */
  fit(): void {
    if (!this.canvas || !this.wrap) return;
    const r = this.wrap.getBoundingClientRect();
    const border = this.wrap.offsetWidth - this.wrap.clientWidth;
    const cssW = Math.max(300, r.width - border);
    const maxH = Math.max(240, Math.min(420, window.innerHeight * 0.42));
    this.scale = Math.max(2, Math.min(4, Math.floor(maxH / Y.height)));
    this.w = Math.ceil(cssW / this.scale);
    this.canvas.width = this.w;
    this.canvas.height = Y.height;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = Y.height * this.scale + 'px';
    this.wrap.style.height = Y.height * this.scale + 'px';
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
  }

  private carWorld(p: number): number {
    return 30 + p * TRACK;
  }

  private thiefWorld(q: number): number {
    return 30 + q * TRACK + CAR_W + GAP0;
  }

  private camTarget(s: SceneState): number {
    // 警车和小偷都放得下就一起放在画面中间；放不下就让警车靠左，小偷那边有箭头
    const thiefRight = this.thiefWorld(s.thief) + 14;
    const span = thiefRight - this.carX;
    let want = span < this.w - 40 ? this.carX - (this.w - span) / 2 : this.carX - 24;
    // 快到终点了，仓库也要进画面
    if (s.thief > 0.8) {
      const end = this.thiefWorld(1) + 90 - this.w;
      want = Math.max(want, Math.min(end, thiefRight + 20 - this.w));
    }
    return Math.max(-20, want);
  }

  private draw(t: number): void {
    const c = this.ctx;
    if (!c) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const s = this.get();
    const carTarget = this.carWorld(s.police);
    // 警车平滑地追上目标位置，不会一个字一跳
    this.carX += (carTarget - this.carX) * Math.min(1, dt * 9);
    if (Math.abs(carTarget - this.carX) < 0.05) this.carX = carTarget;
    const camT = this.camTarget(s);
    this.cam += (camT - this.cam) * Math.min(1, dt * 4);
    const cam = Math.round(this.cam);
    const w = this.w;
    const p = this.pal;
    const moving = s.phase === 'run' && !s.wrong;

    drawSky(c, w, p, t);
    drawFar(c, w, cam, p);
    drawMid(c, w, cam, p);
    drawStreet(c, w, cam, p, t);

    // 终点仓库
    const hx = this.thiefWorld(1) + 14 - cam;
    let door = 1;
    if (s.phase === 'lost') door = Math.max(0, 1 - (t - s.endAt) / 700);
    if (hx < w + 10) drawHideout(c, hx, door, p);

    // 小偷
    const tx = this.thiefWorld(s.thief) - cam;
    const thiefRunning = s.phase === 'run' || s.phase === 'count';
    const frame = thiefRunning && s.phase === 'run' ? Math.floor(t / 90) % 4 : 0;
    const escaped = s.phase === 'lost' && t - s.endAt > 500;
    if (!escaped) {
      const pose = s.phase === 'won' ? 'caught' : s.phase === 'run' ? 'run' : 'idle';
      drawThief(c, tx, frame, pose);
      if (s.phase === 'won') drawStars(c, tx + 6, Y.ground - 25, t);
    }
    if (s.phase === 'run' && Math.random() < dt * 8) this.dust.push({ x: this.thiefWorld(s.thief) + 2, y: Y.ground - 1, t: 0 });

    // 警车
    const flash = Math.floor(t / 140) % 2;
    const wheel = moving || Math.abs(carTarget - this.carX) > 0.5 ? (t / 220) % 1 : 0;
    const bump = moving && Math.floor(t / 110) % 3 === 0 ? -1 : 0;
    const shake = s.wrong && s.phase === 'run' ? (Math.floor(t / 50) % 2 ? 1 : -1) : 0;
    const cx = this.carX - cam + shake;
    if (moving && Math.random() < dt * 10) this.dust.push({ x: this.carX + 2, y: Y.ground - 1, t: 0 });
    // 速度线
    if (moving && carTarget - this.carX > 1.5) {
      c.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 3; i++) c.fillRect(Math.round(cx - 10 - ((t / 20 + i * 7) % 14)), Y.ground - 6 - i * 4, 6, 1);
    }
    drawCar(c, cx, flash, wheel, bump, s.phase !== 'ready');
    if (s.wrong && s.phase === 'run') {
      // 打错了：车顶冒一个感叹号
      rect(c, cx + 27, Y.ground - 30, 5, 8, '#ffffff');
      rect(c, cx + 28, Y.ground - 29, 3, 4, '#d6453b');
      rect(c, cx + 28, Y.ground - 24, 3, 1, '#d6453b');
    }

    // 灰尘
    for (const d of this.dust) {
      d.t += dt;
      drawDust(c, d.x - cam, d.y, d.t);
    }
    this.dust = this.dust.filter((d) => d.t < 1);

    // 小偷跑出画面：右边一个箭头
    if (tx > w - 6 && !escaped) {
      const ay = Y.ground - 12;
      c.fillStyle = 'rgba(20,20,30,.55)';
      c.fillRect(w - 13, ay - 6, 12, 12);
      rect(c, w - 10, ay - 1, 5, 2, '#ffffff');
      rect(c, w - 6, ay - 3, 1, 6, '#ffffff');
      rect(c, w - 5, ay - 2, 1, 4, '#ffffff');
      rect(c, w - 4, ay - 1, 1, 2, '#ffffff');
    }

    // 夜里压一层暗色，路灯和窗户更显眼
    if (p === PALETTES.night) {
      c.fillStyle = 'rgba(8,10,30,.12)';
      c.fillRect(0, 0, w, Y.height);
    }
  }
}
