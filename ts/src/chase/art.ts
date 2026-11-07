// 追击画面的像素画：天空、远处的楼、街边的楼、人行道、马路、警车、小偷、终点的仓库。
// 全部在低分辨率画布上用整数坐标的方块画，再整倍放大，和花园一样是清楚的像素风。

export type Ctx = CanvasRenderingContext2D;

export interface Palette {
  sky: [string, string, string]; // 上、中、下
  far: string;
  farLit: string;
  buildings: string[];
  shade: string; // 楼的暗面
  window: string;
  lit: string;
  litRate: number; // 亮灯窗户的比例
  sidewalk: string;
  sidewalkLine: string;
  curb: string;
  road: string;
  roadEdge: string;
  lane: string;
  lamp: string;
  glow: string | null;
  sun: string | null;
  moon: string | null;
  stars: boolean;
  tree: [string, string];
}

export const PALETTES: Record<'day' | 'dusk' | 'night', Palette> = {
  day: {
    sky: ['#7fbde8', '#a9d4f0', '#dcefF7'.toLowerCase()],
    far: '#a7c0d4',
    farLit: '#a7c0d4',
    buildings: ['#d98b6a', '#e9c88e', '#8db4a6', '#c8b6a2', '#9fa6c8', '#e3a37e'],
    shade: 'rgba(40,30,50,.18)',
    window: '#cfe7f3',
    lit: '#cfe7f3',
    litRate: 0,
    sidewalk: '#d6cdbd',
    sidewalkLine: '#bfb4a2',
    curb: '#9c9283',
    road: '#4b5059',
    roadEdge: '#3d4148',
    lane: '#f1e3b8',
    lamp: '#5a5f6b',
    glow: null,
    sun: '#fff1b8',
    moon: null,
    stars: false,
    tree: ['#5f9e4f', '#3f7a3c'],
  },
  dusk: {
    sky: ['#4c5b98', '#d98a73', '#f4c48b'],
    far: '#7a6688',
    farLit: '#f2b77a',
    buildings: ['#9a5d55', '#b48a6e', '#5f7d7a', '#8c7a72', '#6f6f94', '#a8705c'],
    shade: 'rgba(30,20,40,.25)',
    window: '#56607a',
    lit: '#ffd37e',
    litRate: 0.35,
    sidewalk: '#b8a99a',
    sidewalkLine: '#9f907f',
    curb: '#7e7266',
    road: '#3d3f4a',
    roadEdge: '#30323b',
    lane: '#e8c98f',
    lamp: '#3f4250',
    glow: 'rgba(255,214,140,.22)',
    sun: '#ffd89a',
    moon: null,
    stars: false,
    tree: ['#4e7a45', '#355a34'],
  },
  night: {
    sky: ['#0d1430', '#1b2752', '#2c3e70'],
    far: '#1b2446',
    farLit: '#e9c46a',
    buildings: ['#2e3657', '#3a3f5e', '#2b4652', '#433c58', '#353a4f', '#40364c'],
    shade: 'rgba(0,0,10,.3)',
    window: '#262c45',
    lit: '#ffd27a',
    litRate: 0.45,
    sidewalk: '#5d5d6b',
    sidewalkLine: '#4c4c59',
    curb: '#40404c',
    road: '#26272f',
    roadEdge: '#1d1e25',
    lane: '#b9a36e',
    lamp: '#2c2f3c',
    glow: 'rgba(255,214,140,.3)',
    sun: null,
    moon: '#f3ecd2',
    stars: true,
    tree: ['#2f4a39', '#223a2c'],
  },
};

/** 按电脑时间选白天、傍晚、夜里 */
export function paletteNow(d = new Date()): Palette {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17) return PALETTES.day;
  if ((h >= 17 && h < 19.5) || (h >= 5.5 && h < 7)) return PALETTES.dusk;
  return PALETTES.night;
}

/** 固定种子的随机数：同一个位置每次画出来都一样 */
export function hash(n: number): number {
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

// 画面里的几条水平线（画布高度固定 128）
export const Y = {
  farBase: 86,
  midBase: 93,
  walkTop: 93,
  curb: 101,
  roadTop: 103,
  lane: 116,
  lane2Top: 110,
  ground: 121, // 车轮、人脚着地的地方
  height: 128,
};

export function drawSky(c: Ctx, w: number, p: Palette, t: number): void {
  const g = c.createLinearGradient(0, 0, 0, Y.midBase);
  g.addColorStop(0, p.sky[0]);
  g.addColorStop(0.55, p.sky[1]);
  g.addColorStop(1, p.sky[2]);
  c.fillStyle = g;
  c.fillRect(0, 0, w, Y.midBase);
  if (p.stars) {
    for (let i = 0; i < w / 6; i++) {
      const x = Math.floor(hash(i * 7 + 1) * w);
      const y = Math.floor(hash(i * 13 + 5) * 54);
      const tw = 0.5 + 0.5 * Math.sin(t / 700 + i);
      c.fillStyle = `rgba(255,248,220,${(0.35 + 0.5 * tw * hash(i)).toFixed(2)})`;
      c.fillRect(x, y, 1, 1);
    }
  }
  if (p.sun) {
    const sx = Math.round(w * 0.78);
    const sy = p === PALETTES.dusk ? 62 : 22;
    c.fillStyle = p === PALETTES.dusk ? 'rgba(255,214,150,.35)' : 'rgba(255,250,220,.35)';
    c.beginPath();
    c.arc(sx, sy, 13, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.sun;
    c.beginPath();
    c.arc(sx, sy, 8, 0, Math.PI * 2);
    c.fill();
  }
  if (p.moon) {
    const mx = Math.round(w * 0.8);
    c.fillStyle = 'rgba(243,236,210,.15)';
    c.beginPath();
    c.arc(mx, 20, 11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.moon;
    c.beginPath();
    c.arc(mx, 20, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.sky[0];
    c.beginPath();
    c.arc(mx + 3, 18, 5, 0, Math.PI * 2);
    c.fill();
  }
}

/** 远处的城市剪影（视差 0.25） */
export function drawFar(c: Ctx, w: number, cam: number, p: Palette): void {
  const off = cam * 0.25;
  const unit = 14;
  const first = Math.floor(off / unit) - 1;
  for (let i = first; i < first + Math.ceil(w / unit) + 3; i++) {
    const x = Math.round(i * unit - off);
    const h = 14 + Math.floor(hash(i * 3 + 11) * 30);
    const bw = unit - (hash(i * 5) < 0.3 ? 3 : 0);
    rect(c, x, Y.farBase - h, bw, h + 8, p.far);
    if (hash(i * 17) < 0.18) rect(c, x + Math.floor(bw / 2), Y.farBase - h - 5, 1, 5, p.far); // 天线
    if (p.litRate) {
      for (let k = 0; k < 4; k++) {
        if (hash(i * 31 + k) < p.litRate * 0.5) rect(c, x + 2 + Math.floor(hash(i * 41 + k) * (bw - 4)), Y.farBase - h + 3 + Math.floor(hash(i * 43 + k) * (h - 4)), 1, 1, p.farLit);
      }
    }
  }
}

/** 街边的楼（视差 0.55） */
export function drawMid(c: Ctx, w: number, cam: number, p: Palette): void {
  const off = cam * 0.55;
  const unit = 46;
  const first = Math.floor(off / unit) - 1;
  for (let i = first; i < first + Math.ceil(w / unit) + 3; i++) {
    const r = hash(i * 9 + 3);
    const bw = 34 + Math.floor(hash(i * 2 + 7) * 12);
    const h = 26 + Math.floor(r * 34);
    const x = Math.round(i * unit - off + (unit - bw) / 2);
    const color = p.buildings[Math.floor(hash(i * 19) * p.buildings.length)];
    const top = Y.midBase - h;
    rect(c, x, top, bw, h, color);
    // 屋顶边、右侧暗面
    rect(c, x - 1, top, bw + 2, 2, shadeOf(color, -0.25));
    c.fillStyle = p.shade;
    c.fillRect(x + bw - 4, top + 2, 4, h - 2);
    // 窗户
    const cols = Math.floor((bw - 6) / 6);
    const rows = Math.floor((h - 10) / 8);
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        const lit = hash(i * 101 + ry * 7 + cx) < p.litRate;
        const wx = x + 4 + cx * 6;
        const wy = top + 5 + ry * 8;
        rect(c, wx, wy, 4, 5, lit ? p.lit : p.window);
        rect(c, wx, wy + 5, 4, 1, shadeOf(color, -0.18));
      }
    }
    // 底层：门或店面遮阳棚
    if (hash(i * 23) < 0.5) {
      const aw = shadeOf(p.buildings[Math.floor(hash(i * 29) * p.buildings.length)], -0.1);
      for (let k = 0; k < bw - 4; k += 4) rect(c, x + 2 + k, Y.midBase - 9, 2, 3, k % 8 ? '#f4efe6' : aw);
      rect(c, x + 2, Y.midBase - 6, bw - 4, 6, shadeOf(color, -0.35));
      if (p.litRate) rect(c, x + 4, Y.midBase - 5, bw - 8, 4, 'rgba(255,214,140,.55)');
    } else {
      rect(c, x + Math.floor(bw / 2) - 3, Y.midBase - 9, 6, 9, shadeOf(color, -0.4));
    }
  }
}

/** 人行道、路灯、行道树、马路（视差 1） */
export function drawStreet(c: Ctx, w: number, cam: number, p: Palette, t: number): void {
  rect(c, 0, Y.walkTop, w, Y.curb - Y.walkTop, p.sidewalk);
  // 地砖缝
  const off = Math.floor(cam);
  for (let x = -(off % 12); x < w; x += 12) rect(c, x, Y.walkTop, 1, Y.curb - Y.walkTop, p.sidewalkLine);
  rect(c, 0, Y.curb, w, 2, p.curb);
  rect(c, 0, Y.roadTop, w, Y.height - Y.roadTop, p.road);
  rect(c, 0, Y.roadTop, w, 1, p.roadEdge);
  // 车道线
  for (let x = -(off % 28); x < w; x += 28) rect(c, x, Y.lane, 14, 1, p.lane);
  // 路面的小斑点
  for (let x = -(off % 9); x < w; x += 9) {
    const n = Math.floor((x + off) / 9);
    if (hash(n) < 0.35) rect(c, x + Math.floor(hash(n * 3) * 8), Y.roadTop + 3 + Math.floor(hash(n * 5) * 22), 1, 1, p.roadEdge);
  }
  // 路灯和树，每 90 像素一组
  const unit = 90;
  const first = Math.floor(cam / unit) - 1;
  for (let i = first; i < first + Math.ceil(w / unit) + 2; i++) {
    const x = Math.round(i * unit - cam);
    // 路灯
    rect(c, x, Y.walkTop - 30, 2, 31, p.lamp);
    rect(c, x, Y.walkTop - 30, 8, 2, p.lamp);
    rect(c, x + 6, Y.walkTop - 29, 3, 2, p.glow ? '#ffe7a8' : '#d9d4c4');
    if (p.glow) {
      const g = c.createRadialGradient(x + 7, Y.walkTop - 27, 1, x + 7, Y.walkTop - 27, 22);
      g.addColorStop(0, p.glow);
      g.addColorStop(1, 'rgba(255,214,140,0)');
      c.fillStyle = g;
      c.fillRect(x - 16, Y.walkTop - 50, 46, 60);
    }
    // 行道树
    const tx = x + 45;
    if (hash(i * 7 + 2) < 0.75) {
      rect(c, tx, Y.walkTop - 8, 2, 9, '#6b4a33');
      const sway = Math.round(Math.sin(t / 900 + i) * 0.6);
      blob(c, tx + 1 + sway, Y.walkTop - 15, 8, 7, p.tree[0], p.tree[1]);
    } else {
      // 消防栓
      rect(c, tx, Y.walkTop - 6, 4, 6, '#c4473d');
      rect(c, tx - 1, Y.walkTop - 4, 6, 1, '#9e352e');
      rect(c, tx + 1, Y.walkTop - 7, 2, 1, '#9e352e');
    }
  }
}

/** 一团圆圆的树冠 */
function blob(c: Ctx, cx: number, cy: number, rx: number, ry: number, light: string, dark: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    rect(c, cx - half, cy + y, half * 2, 1, y > ry / 3 ? dark : light);
  }
  rect(c, cx - 3, cy - ry + 2, 2, 1, 'rgba(255,255,255,.25)');
}

/** 颜色变亮（amt > 0）或变暗（amt < 0） */
export function shadeOf(hex: string, amt: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}

// ---------------- 警车 ----------------

export const CAR_W = 36;

/**
 * 警车，车尾在 x，车轮着地在 Y.ground。
 * flash：警灯闪的相位（0/1），wheel：车轮转的相位，bump：上下颠一点
 */
export function drawCar(c: Ctx, x: number, flash: number, wheel: number, bump: number, lightsOn: boolean): void {
  const g = Y.ground;
  const b = bump;
  const K = '#1c2232';
  const W = '#f5f4ef';
  const Wd = '#d9d8d2';
  const N = '#26386d';
  const Nl = '#3a53a0';
  const G = '#a9d9f1';
  const Gd = '#7db6d6';
  // 影子
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.fillRect(Math.round(x) + 2, g - 1, CAR_W - 2, 2);
  const X = Math.round(x);
  const yb = g - 3 + b; // 车身下沿
  // 车身外框
  rect(c, X, yb - 8, CAR_W, 8, K);
  rect(c, X + 1, yb - 7, CAR_W - 2, 6, W);
  rect(c, X + 1, yb - 3, CAR_W - 2, 2, Wd);
  // 车门上的深蓝色条和星形徽章
  rect(c, X + 9, yb - 6, 18, 3, N);
  rect(c, X + 9, yb - 6, 18, 1, Nl);
  rect(c, X + 16, yb - 6, 2, 2, '#f2c94c');
  // 车头：大灯、保险杠；车尾：尾灯
  rect(c, X + CAR_W - 3, yb - 7, 2, 2, '#ffe9a6');
  rect(c, X + CAR_W - 1, yb - 3, 2, 2, '#9aa1ad');
  rect(c, X + 1, yb - 7, 1, 2, '#d0463c');
  rect(c, X - 1, yb - 3, 2, 2, '#9aa1ad');
  // 车顶舱
  rect(c, X + 8, yb - 14, 19, 7, K);
  rect(c, X + 9, yb - 13, 17, 6, W);
  rect(c, X + 10, yb - 12, 7, 4, G);
  rect(c, X + 18, yb - 12, 7, 4, G);
  rect(c, X + 10, yb - 12, 2, 1, '#e3f4fb');
  rect(c, X + 18, yb - 12, 2, 1, '#e3f4fb');
  rect(c, X + 10, yb - 9, 7, 1, Gd);
  rect(c, X + 18, yb - 9, 7, 1, Gd);
  // 警灯
  rect(c, X + 13, yb - 16, 9, 2, K);
  const red = lightsOn && flash ? '#ff5b4f' : '#9e3a34';
  const blue = lightsOn && !flash ? '#5aa8ff' : '#2f4d86';
  rect(c, X + 14, yb - 16, 3, 1, red);
  rect(c, X + 18, yb - 16, 3, 1, blue);
  if (lightsOn) {
    const gx = flash ? X + 15 : X + 19;
    const col = flash ? 'rgba(255,90,80,.28)' : 'rgba(90,168,255,.28)';
    const gr = c.createRadialGradient(gx, yb - 16, 0, gx, yb - 16, 14);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr;
    c.fillRect(gx - 14, yb - 30, 28, 28);
  }
  // 车轮
  wheelAt(c, X + 8, g - 3, wheel);
  wheelAt(c, X + CAR_W - 8, g - 3, wheel);
}

function wheelAt(c: Ctx, cx: number, cy: number, phase: number): void {
  rect(c, cx - 3, cy - 2, 6, 5, '#15171d');
  rect(c, cx - 2, cy - 3, 4, 7, '#15171d');
  rect(c, cx - 1, cy - 1, 2, 2, '#9aa1ad');
  // 轮毂上的一个点跟着转
  const a = phase * Math.PI * 2;
  rect(c, cx + Math.round(Math.cos(a) * 2) - 0.5, cy + Math.round(Math.sin(a) * 2) - 0.5, 1, 1, '#5d6370');
}

// ---------------- 小偷 ----------------

/**
 * 小偷：黑色毛线帽、眼罩、条纹衫，背着钱袋往右跑。
 * x 是他的后背，frame 0–3 是跑步的四帧；pose: 'run' | 'caught'（举手）| 'idle'
 */
export function drawThief(c: Ctx, x: number, frame: number, pose: 'run' | 'caught' | 'idle'): void {
  const g = Y.ground;
  const X = Math.round(x);
  const skin = '#f0c48e';
  const skinD = '#d9a56f';
  const hat = '#2a2b35';
  const stripeA = '#eceae4';
  const stripeB = '#2c2f3c';
  const pants = '#3b4462';
  const shoe = '#141419';
  const bag = '#c8a066';
  const bagD = '#a47e4a';
  const run = pose === 'run';
  const lift = run && (frame === 1 || frame === 3) ? -1 : 0;
  const top = g - 21 + lift;
  // 影子
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.fillRect(X, g - 1, 11, 2);
  // 钱袋（背在后面）
  if (pose !== 'caught') {
    rect(c, X - 3, top + 6, 7, 7, bagD);
    rect(c, X - 2, top + 5, 5, 8, bag);
    rect(c, X - 1, top + 4, 3, 1, bagD);
    rect(c, X, top + 7, 1, 4, '#5a3f1f'); // 「$」的竖
    rect(c, X - 1, top + 8, 3, 1, '#5a3f1f');
    rect(c, X - 1, top + 10, 3, 1, '#5a3f1f');
  }
  // 腿：四帧里前后腿错开（前腿、后腿的水平偏移）
  const lf = run ? [[-3, 3], [-1, 1], [3, -3], [1, -1]][frame] : [0, 0];
  // 后腿
  rect(c, X + 3 + lf[1], top + 14, 2, 6 - (run && frame % 2 === 0 ? 1 : 0), shadeOf(pants, -0.25));
  rect(c, X + 3 + lf[1] - (lf[1] < 0 ? 1 : 0), g - 2 + (run && frame % 2 === 0 ? -1 : 0), 3, 2, shoe);
  // 前腿
  rect(c, X + 6 + lf[0], top + 14, 2, 6, pants);
  rect(c, X + 6 + lf[0], g - 2, 3, 2, shoe);
  // 身子（条纹衫）
  for (let r = 0; r < 7; r++) rect(c, X + 2, top + 7 + r, 8, 1, r % 2 ? stripeB : stripeA);
  rect(c, X + 9, top + 8, 1, 6, 'rgba(0,0,0,.15)');
  // 胳膊
  if (pose === 'caught') {
    rect(c, X + 1, top + 1, 2, 7, stripeA);
    rect(c, X + 9, top + 1, 2, 7, stripeA);
    rect(c, X + 1, top, 2, 2, skin);
    rect(c, X + 9, top, 2, 2, skin);
  } else {
    const sw = run ? [2, 0, -2, 0][frame] : 0;
    rect(c, X + 7 + sw, top + 8, 2, 4, stripeA);
    rect(c, X + 7 + sw, top + 12, 2, 1, skin);
    rect(c, X + 1, top + 7, 2, 3, stripeB); // 扛着钱袋的手
  }
  // 头
  rect(c, X + 3, top + 1, 6, 6, skin);
  rect(c, X + 8, top + 3, 2, 2, skin); // 鼻子
  rect(c, X + 3, top + 5, 6, 1, skinD);
  // 眼罩
  rect(c, X + 3, top + 3, 7, 2, '#1b1c22');
  rect(c, X + 7, top + 3, 1, 1, '#ffffff');
  // 毛线帽
  rect(c, X + 2, top - 1, 8, 3, hat);
  rect(c, X + 3, top - 2, 6, 1, hat);
  rect(c, X + 2, top + 1, 8, 1, shadeOf(hat, 0.2));
}

// ---------------- 终点：小偷的仓库 ----------------

export function drawHideout(c: Ctx, x: number, doorOpen: number, p: Palette): void {
  const X = Math.round(x);
  const w = 62;
  const h = 46;
  const base = Y.curb + 1;
  const top = base - h;
  const wall = p === PALETTES.night ? '#4a4256' : '#8a6f5e';
  rect(c, X, top, w, h, wall);
  // 波纹铁皮墙
  for (let k = 2; k < w; k += 4) rect(c, X + k, top + 4, 1, h - 4, shadeOf(wall, -0.18));
  // 屋顶
  rect(c, X - 3, top - 4, w + 6, 4, '#3d3340');
  rect(c, X - 3, top - 4, w + 6, 1, '#5a4d5d');
  // 卷帘门
  const dw = 30;
  const dh = 28;
  const dx = X + 16;
  const dy = base - dh;
  rect(c, dx - 1, dy - 1, dw + 2, dh + 1, '#2a2430');
  rect(c, dx, dy, dw, dh, '#141118');
  const shut = Math.round(dh * (1 - doorOpen));
  rect(c, dx, dy, dw, shut, '#9aa0aa');
  for (let k = 1; k < shut; k += 3) rect(c, dx, dy + k, dw, 1, '#7d8390');
  // 门上的灯和牌子
  rect(c, dx + 10, top + 4, 10, 6, '#2a2430');
  rect(c, dx + 11, top + 5, 8, 4, '#e8b84a');
  rect(c, dx + 14, top + 6, 2, 2, '#2a2430');
  if (p.glow) {
    const g = c.createRadialGradient(dx + dw / 2, top + 8, 1, dx + dw / 2, top + 8, 26);
    g.addColorStop(0, 'rgba(255,200,110,.35)');
    g.addColorStop(1, 'rgba(255,200,110,0)');
    c.fillStyle = g;
    c.fillRect(dx - 12, top - 14, dw + 24, 48);
  }
}

/** 头顶冒星星（抓到了） */
export function drawStars(c: Ctx, cx: number, cy: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const a = t / 300 + (i * Math.PI * 2) / 3;
    const x = Math.round(cx + Math.cos(a) * 6);
    const y = Math.round(cy + Math.sin(a) * 2);
    rect(c, x, y - 1, 1, 3, '#ffd75e');
    rect(c, x - 1, y, 3, 1, '#ffd75e');
  }
}

/** 扬起的灰（小偷跑、警车开） */
export function drawDust(c: Ctx, x: number, y: number, age: number): void {
  const a = Math.max(0, 0.45 - age * 0.45);
  c.fillStyle = `rgba(220,210,190,${a.toFixed(2)})`;
  const r = 1 + Math.round(age * 3);
  c.fillRect(Math.round(x - r), Math.round(y - r - age * 3), r * 2, r * 2);
}
