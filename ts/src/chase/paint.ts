// 打字追击的美术：楼、树、车、路灯。全部用矢量画在和屏幕一样精细的画布上（Retina 屏也清楚）。
// 光从右上方来：屋顶最亮，朝右下的墙（+gx）次之，朝左下的墙（+gy）最暗，影子落在左下方。

import { Ctx, G, TimeOfDay, grade, ix, iy, mix, poly, rgba, rng, shade } from './geo';

// ---------------- 配色 ----------------

/** 白天的底色；傍晚、夜里用 grade() 调 */
export const BASE = {
  asphalt: '#575d69',
  lane: '#f1d47e',
  marking: '#efece5',
  curb: '#9c9384',
  walk: '#ddd6c8',
  lot: '#cdc5b6',
  grass: '#8ec270',
  grassStripe: '#86ba68',
  path: '#e7dcc8',
  water: '#6cb2df',
  trunk: '#7a5539',
  frame: '#f6f2ea',
  glassTop: '#d6ecf8',
  glassBot: '#7ea9c9',
};

/** 楼的墙色：灰泥、砖、玻璃幕墙、小店 */
export const WALLS = ['#e9b78f', '#ead49e', '#a9cdc0', '#c0c2de', '#dcc8b2', '#d29a7f', '#b0c1d2', '#f1e5ce'];
export const BRICKS = ['#b8664d', '#a85a48', '#c27a5a'];
export const GLASS = ['#7fa7c6', '#86b3c0', '#8f9fc4'];
const AWNINGS = ['#d65a4f', '#2f8476', '#e2a53b', '#3f6fb8', '#8a5bb0'];

/** 夜里窗户亮灯的颜色 */
const LIT_TOP = '#ffe9b0';
const LIT_BOT = '#f6b45c';

export function litRate(tod: TimeOfDay): number {
  return tod === 'day' ? 0 : tod === 'dusk' ? 0.3 : 0.55;
}

// ---------------- 楼 ----------------

export type Style = 'apt' | 'brick' | 'office' | 'shop' | 'warehouse';

/** 一栋楼：占地 (x, y) 起 w × d 格，高 h 像素 */
export interface Bld {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  style: Style;
  wall: string;
  seed: number;
  /** 仓库的大门（格子坐标，在朝 +gy 的那面墙上） */
  door?: G;
}

/** 楼在画布上占的范围（格子坐标原点下的像素） */
export function bldBounds(b: Bld): { x: number; y: number; w: number; h: number } {
  const xs = [ix(b.x, b.y), ix(b.x + b.w, b.y), ix(b.x + b.w, b.y + b.d), ix(b.x, b.y + b.d)];
  const ys = [iy(b.x, b.y), iy(b.x + b.w, b.y), iy(b.x + b.w, b.y + b.d), iy(b.x, b.y + b.d)];
  const x = Math.floor(Math.min(...xs)) - 3;
  const y = Math.floor(Math.min(...ys)) - b.h - 20;
  return { x, y, w: Math.ceil(Math.max(...xs)) + 3 - x, h: Math.ceil(Math.max(...ys)) + 3 - y };
}

/** 画一栋楼，S 是放大倍数（和屏幕像素一样细） */
export function renderBuilding(b: Bld, tod: TimeOfDay, S: number): HTMLCanvasElement {
  const bb = bldBounds(b);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(bb.w * S);
  cv.height = Math.ceil(bb.h * S);
  const c = cv.getContext('2d') as Ctx;
  const R = rng(b.seed);
  const g = (hex: string) => grade(hex, tod);
  const lit = litRate(tod);
  const { x, y, w, d, h } = b;
  const base = () => c.setTransform(S, 0, 0, S, -bb.x * S, -bb.y * S);
  const P = (gx: number, gy: number, up = 0): [number, number] => [ix(gx, gy), iy(gx, gy) - up];
  // 在一面墙上画：u 沿着墙（格），v 往上（像素）
  const face = (gx: number, gy: number, dir: G) => {
    c.setTransform(S * ix(dir.gx, dir.gy), S * iy(dir.gx, dir.gy), 0, -S, S * (ix(gx, gy) - bb.x), S * (iy(gx, gy) - bb.y));
  };
  const box = (gx: number, gy: number, bw: number, bd: number, z: number, hh: number, col: string) => {
    base();
    poly(c, [P(gx + bw, gy, z), P(gx + bw, gy + bd, z), P(gx + bw, gy + bd, z + hh), P(gx + bw, gy, z + hh)], g(shade(col, -0.06)));
    poly(c, [P(gx, gy + bd, z), P(gx + bw, gy + bd, z), P(gx + bw, gy + bd, z + hh), P(gx, gy + bd, z + hh)], g(shade(col, -0.24)));
    poly(c, [P(gx, gy, z + hh), P(gx + bw, gy, z + hh), P(gx + bw, gy + bd, z + hh), P(gx, gy + bd, z + hh)], g(shade(col, 0.1)));
  };

  // 两面墙：底下暗一点（贴地的阴影），往上慢慢亮
  const wallFace = (gx: number, gy: number, dir: G, len: number, col: string) => {
    face(gx, gy, dir);
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, shade(col, -0.16));
    gr.addColorStop(0.18, col);
    gr.addColorStop(1, shade(col, 0.05));
    c.fillStyle = gr;
    c.fillRect(0, 0, len, h);
  };
  const wallTone = b.style === 'office' ? GLASS[0] : b.wall;
  const colR = g(shade(wallTone, -0.03));
  const colL = g(shade(wallTone, -0.22));
  wallFace(x + w, y, { gx: 0, gy: 1 }, d, colR);
  wallFace(x, y + d, { gx: 1, gy: 0 }, w, colL);

  // 墙上的东西：窗、门、店面、玻璃幕墙
  const dress = (gx: number, gy: number, dir: G, len: number, lightSide: boolean) => {
    face(gx, gy, dir);
    const dark = lightSide ? 0 : -0.16;
    if (b.style === 'office') return officeFace(c, len, h, dark, R, lit, g);
    if (b.style === 'warehouse') return warehouseFace(c, len, h, dark, g, b, gx, dir);
    if (b.style === 'brick') {
      // 砖缝：一道道横线
      c.fillStyle = rgba('#3a1d14', 0.13);
      for (let v = 1.3; v < h - 2; v += 1.45) c.fillRect(0, v, len, 0.22);
    }
    const shop = b.style === 'shop';
    const ground = shop ? 11 : 9;
    const floorH = 8;
    const floors = Math.max(0, Math.floor((h - ground - 3) / floorH));
    const cols = Math.max(1, Math.floor(len / 0.62));
    const pitch = len / cols;
    const frame = g(shade(b.style === 'brick' ? '#f3ede2' : BASE.frame, dark));
    // 楼层之间一道细线
    c.fillStyle = rgba('#000000', 0.07);
    for (let f = 0; f <= floors; f++) c.fillRect(0, ground + f * floorH - 0.5, len, 0.45);
    const balcony = b.style === 'apt' && R() < 0.5;
    for (let f = 0; f < floors; f++) {
      for (let k = 0; k < cols; k++) {
        const u = (k + 0.5) * pitch;
        const v = ground + f * floorH + 1.6;
        windowAt(c, u, v, pitch * 0.48, 4.8, frame, R() < lit, dark, g, b.style === 'brick');
        if (balcony && k % 2 === 0 && f % 2 === 0) {
          // 小阳台：一块挑出来的板子和栏杆
          c.fillStyle = g(shade(b.wall, 0.12 + dark));
          c.fillRect(u - pitch * 0.42, v - 1.4, pitch * 0.84, 0.9);
          c.fillStyle = rgba('#2a2f3a', 0.55);
          for (let q = -0.38; q <= 0.39; q += 0.095) c.fillRect(u + pitch * q, v - 0.5, 0.035, 2.3);
          c.fillRect(u - pitch * 0.42, v + 1.7, pitch * 0.84, 0.3);
        }
      }
    }
    if (shop) shopFront(c, len, dark, g, R);
    else {
      // 一楼：门和两边的窗
      const doorU = Math.max(0.4, Math.min(len - 0.4, len * (0.3 + R() * 0.4)));
      c.fillStyle = g(shade(b.wall, 0.14 + dark));
      c.fillRect(doorU - 0.26, 0, 0.52, 7.4);
      c.fillStyle = g(shade('#3b3f4c', dark));
      c.fillRect(doorU - 0.19, 0, 0.38, 6.4);
      c.fillStyle = rgba('#ffffff', 0.18);
      c.fillRect(doorU - 0.17, 3.8, 0.34, 2.2);
      // 门上的小雨棚
      c.fillStyle = g(shade('#5a6070', dark));
      c.fillRect(doorU - 0.33, 7.4, 0.66, 0.9);
      for (let k = 0; k < cols; k++) {
        const u = (k + 0.5) * pitch;
        if (Math.abs(u - doorU) < pitch * 0.75) continue;
        windowAt(c, u, 2.2, pitch * 0.48, 4.6, frame, R() < lit, dark, g, b.style === 'brick');
      }
    }
    // 檐口：墙顶一道亮边
    c.fillStyle = g(shade(b.wall, 0.18 + dark));
    c.fillRect(0, h - 1.6, len, 1.6);
    c.fillStyle = rgba('#000000', 0.12);
    c.fillRect(0, h - 2, len, 0.4);
  };
  dress(x + w, y, { gx: 0, gy: 1 }, d, true);
  dress(x, y + d, { gx: 1, gy: 0 }, w, false);

  // 前面的墙角：一条亮线
  base();
  c.strokeStyle = rgba('#ffffff', tod === 'night' ? 0.08 : 0.22);
  c.lineWidth = 0.35;
  c.beginPath();
  c.moveTo(...P(x + w, y + d));
  c.lineTo(...P(x + w, y + d, h));
  c.stroke();

  // 屋顶：一圈女儿墙，里面低一点，铺着碎石
  const ins = Math.min(0.2, w * 0.08, d * 0.08);
  const roofCol = b.style === 'warehouse' ? '#7d8590' : mix(b.style === 'office' ? '#9aa3ae' : b.wall, '#8d939c', 0.55);
  const rimCol = b.style === 'office' ? '#d5dbe2' : shade(b.wall, 0.2);
  const z = h - 1.3;
  const ai = [x + ins, y + ins];
  const bi = [x + w - ins, y + ins];
  const ci = [x + w - ins, y + d - ins];
  const di = [x + ins, y + d - ins];
  poly(c, [P(ai[0], ai[1], z), P(bi[0], bi[1], z), P(ci[0], ci[1], z), P(di[0], di[1], z)], g(roofCol));
  // 女儿墙里面朝我们的两面
  poly(c, [P(ai[0], ai[1], z), P(bi[0], bi[1], z), P(bi[0], bi[1], h), P(ai[0], ai[1], h)], g(shade(rimCol, -0.3)));
  poly(c, [P(ai[0], ai[1], z), P(di[0], di[1], z), P(di[0], di[1], h), P(ai[0], ai[1], h)], g(shade(rimCol, -0.18)));
  // 女儿墙顶
  c.fillStyle = g(rimCol);
  c.beginPath();
  for (const [gx, gy] of [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]) c.lineTo(...P(gx, gy, h));
  c.closePath();
  for (const q of [ai, di, ci, bi]) c.lineTo(...P(q[0], q[1], h));
  c.closePath();
  c.fill('evenodd');
  // 碎石
  const RG = rng(b.seed + 7);
  for (let k = 0; k < w * d * 7; k++) {
    const gx = ai[0] + RG() * (bi[0] - ai[0]);
    const gy = ai[1] + RG() * (di[1] - ai[1]);
    const [px, py] = P(gx, gy, z);
    c.fillStyle = RG() < 0.5 ? rgba('#000000', 0.08) : rgba('#ffffff', 0.1);
    c.fillRect(px, py, 0.5, 0.35);
  }
  // 屋顶外沿的亮边
  c.strokeStyle = rgba('#ffffff', tod === 'night' ? 0.1 : 0.35);
  c.lineWidth = 0.3;
  c.beginPath();
  c.moveTo(...P(x, y + d, h));
  c.lineTo(...P(x + w, y + d, h));
  c.lineTo(...P(x + w, y, h));
  c.stroke();

  // 屋顶上的东西
  const roomy = w > 1.6 && d > 1.6;
  if (b.style === 'warehouse') {
    // 一排天窗
    for (let k = 0; k < 3; k++) {
      const gx = x + 0.8 + k * ((w - 1.6) / 2);
      skylight(c, P, gx - 0.35, y + d / 2 - 0.6, 0.7, 1.2, z, g);
    }
  } else if (roomy) {
    const n = 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const gx = x + 0.5 + R() * (w - 1.3);
      const gy = y + 0.5 + R() * (d - 1.2);
      hvac(c, P, box, gx, gy, z, g);
    }
    if (h > 40 && R() < 0.6) tank(c, P, x + w * (0.25 + R() * 0.4), y + d * (0.25 + R() * 0.3), z, g);
    if (b.style === 'office') {
      // 楼梯间和天线
      box(x + w * 0.55, y + d * 0.2, Math.min(1.1, w * 0.3), Math.min(0.9, d * 0.3), z, 6, '#c9cfd8');
      base();
      const [ax, ay] = P(x + w * 0.3, y + d * 0.6, z);
      c.strokeStyle = g('#5c636e');
      c.lineWidth = 0.4;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(ax, ay - 14);
      c.stroke();
      c.fillStyle = tod === 'day' ? '#c94a3f' : '#ff6a5a';
      c.beginPath();
      c.arc(ax, ay - 14.4, 0.7, 0, Math.PI * 2);
      c.fill();
    } else if (h < 34 && R() < 0.6) {
      solar(c, P, x + 0.4, y + 0.4, Math.min(2.2, w - 0.8), Math.min(1.2, d - 0.8), z, g);
    }
  }
  return cv;
}

/** 一扇窗：窗框、玻璃（天空的倒影，上亮下暗）、窗台；夜里亮灯是暖黄色 */
function windowAt(c: Ctx, u: number, v: number, ww: number, wh: number, frame: string, on: boolean, dark: number, g: (h: string) => string, lintel: boolean): void {
  c.fillStyle = frame;
  c.fillRect(u - ww / 2 - 0.05, v - 0.45, ww + 0.1, wh + 0.9);
  const gr = c.createLinearGradient(0, v, 0, v + wh);
  if (on) {
    gr.addColorStop(0, LIT_TOP);
    gr.addColorStop(1, LIT_BOT);
  } else {
    gr.addColorStop(0, g(shade(BASE.glassBot, dark - 0.08)));
    gr.addColorStop(1, g(shade(BASE.glassTop, dark)));
  }
  c.fillStyle = gr;
  c.fillRect(u - ww / 2, v, ww, wh);
  // 窗棂：中间一竖、上面一横
  c.fillStyle = frame;
  c.fillRect(u - 0.018, v, 0.036, wh);
  c.fillRect(u - ww / 2, v + wh * 0.68, ww, 0.3);
  if (!on) {
    // 玻璃上斜斜的一道反光
    c.fillStyle = rgba('#ffffff', 0.22);
    c.beginPath();
    c.moveTo(u - ww / 2, v + wh * 0.25);
    c.lineTo(u - ww / 2 + ww * 0.25, v + wh);
    c.lineTo(u - ww / 2 + ww * 0.4, v + wh);
    c.lineTo(u - ww / 2, v + wh * 0.05);
    c.closePath();
    c.fill();
  }
  // 窗台
  c.fillStyle = rgba('#ffffff', 0.35);
  c.fillRect(u - ww / 2 - 0.08, v - 0.75, ww + 0.16, 0.35);
  if (lintel) {
    c.fillStyle = rgba('#3a1d14', 0.3);
    c.fillRect(u - ww / 2 - 0.06, v + wh + 0.45, ww + 0.12, 0.6);
  }
}

/** 玻璃幕墙：竖的窗框、每层一道深色的腰线、斜着的反光 */
function officeFace(c: Ctx, len: number, h: number, dark: number, R: () => number, lit: number, g: (h: string) => string): void {
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, g(shade('#5f86a8', dark - 0.06)));
  gr.addColorStop(0.55, g(shade('#8db8d6', dark)));
  gr.addColorStop(1, g(shade('#c3e0f1', dark)));
  c.fillStyle = gr;
  c.fillRect(0, 2.5, len, h - 4.5);
  const cols = Math.max(2, Math.round(len / 0.34));
  const pitch = len / cols;
  // 亮灯的格子
  if (lit > 0) {
    for (let v = 3; v < h - 6; v += 6) {
      for (let k = 0; k < cols; k++) {
        if (R() >= lit * 0.8) continue;
        const gl = c.createLinearGradient(0, v, 0, v + 4);
        gl.addColorStop(0, LIT_TOP);
        gl.addColorStop(1, LIT_BOT);
        c.fillStyle = gl;
        c.fillRect(k * pitch, v + 0.6, pitch, 4.2);
      }
    }
  }
  // 斜着的反光
  c.fillStyle = rgba('#ffffff', 0.13);
  for (const u0 of [len * 0.12, len * 0.62]) {
    c.beginPath();
    c.moveTo(u0, 2.5);
    c.lineTo(u0 + len * 0.12, 2.5);
    c.lineTo(u0 + len * 0.3, h - 2);
    c.lineTo(u0 + len * 0.18, h - 2);
    c.closePath();
    c.fill();
  }
  c.fillStyle = g(shade('#dfe6ee', dark));
  for (let k = 0; k <= cols; k++) c.fillRect(k * pitch - 0.02, 2.5, 0.04, h - 4.5);
  c.fillStyle = g(shade('#4c5f73', dark));
  for (let v = 3; v < h - 3; v += 6) c.fillRect(0, v, len, 0.6);
  // 一楼：深色的大门厅
  c.fillStyle = g(shade('#3d4a5a', dark));
  c.fillRect(0, 0, len, 2.5);
  c.fillStyle = g(shade('#dfe6ee', dark));
  c.fillRect(0, 2.4, len, 0.35);
}

/** 仓库的墙：波纹铁皮，大门是卷帘门 */
function warehouseFace(c: Ctx, len: number, h: number, dark: number, g: (h: string) => string, b: Bld, gx: number, dir: G): void {
  for (let u = 0; u < len; u += 0.14) {
    c.fillStyle = rgba(u % 0.28 < 0.14 ? '#ffffff' : '#000000', 0.06);
    c.fillRect(u, 0, 0.07, h - 2);
  }
  c.fillStyle = g(shade('#4d4556', dark));
  c.fillRect(0, 0, len, 1.2);
  if (!b.door || dir.gx !== 1) return;
  const du = b.door.gx - gx;
  const half = 0.85;
  // 门框、卷帘、门上的灯
  c.fillStyle = g(shade('#2c2830', dark));
  c.fillRect(du - half - 0.12, 0, (half + 0.12) * 2, 13);
  c.fillStyle = g(shade('#9a9aa4', dark));
  c.fillRect(du - half, 0, half * 2, 12);
  c.fillStyle = rgba('#000000', 0.18);
  for (let v = 0.8; v < 12; v += 1.1) c.fillRect(du - half, v, half * 2, 0.3);
  c.fillStyle = '#ffd36b';
  c.fillRect(du - 0.12, 14, 0.24, 0.9);
}

/** 小店：一楼整面玻璃，上面一条条纹雨棚和招牌 */
function shopFront(c: Ctx, len: number, dark: number, g: (h: string) => string, R: () => number): void {
  const awn = AWNINGS[Math.floor(R() * AWNINGS.length)];
  const gr = c.createLinearGradient(0, 0.6, 0, 7.4);
  gr.addColorStop(0, g(shade('#f2d79a', dark)));
  gr.addColorStop(1, g(shade('#6f8aa0', dark)));
  c.fillStyle = g(shade('#3a3d48', dark));
  c.fillRect(0, 0, len, 7.8);
  c.fillStyle = gr;
  c.fillRect(0.06, 0.6, len - 0.12, 6.8);
  c.fillStyle = g(shade('#e9e3d6', dark));
  for (let u = 0; u <= len; u += 0.5) c.fillRect(u - 0.025, 0.6, 0.05, 6.8);
  // 条纹雨棚
  for (let u = 0, k = 0; u < len; u += 0.22, k++) {
    c.fillStyle = g(shade(k % 2 ? '#f4efe6' : awn, dark));
    c.fillRect(u, 7.6, 0.22, 2.4);
  }
  c.fillStyle = rgba('#000000', 0.2);
  c.fillRect(0, 7.4, len, 0.4);
  // 招牌：一块深色的板，上面几道亮的「字」
  c.fillStyle = g(shade('#2f3340', dark));
  c.fillRect(len * 0.18, 10.4, len * 0.64, 2.2);
  c.fillStyle = g(shade('#f6e3a6', dark));
  for (let k = 0; k < 4; k++) c.fillRect(len * 0.24 + k * len * 0.14, 11, len * 0.09, 1);
}

type Proj = (gx: number, gy: number, up?: number) => [number, number];

function hvac(c: Ctx, P: Proj, box: (gx: number, gy: number, bw: number, bd: number, z: number, hh: number, col: string) => void, gx: number, gy: number, z: number, g: (h: string) => string): void {
  box(gx, gy, 0.55, 0.42, z, 3.2, '#b9bfc8');
  // 顶上的风扇
  const [cx, cy] = P(gx + 0.28, gy + 0.21, z + 3.2);
  c.fillStyle = g('#7d848f');
  c.beginPath();
  c.ellipse(cx, cy, 2.6, 1.3, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = g('#5e646e');
  c.beginPath();
  c.ellipse(cx, cy, 0.7, 0.35, 0, 0, Math.PI * 2);
  c.fill();
}

/** 屋顶水箱：四条腿撑着一个木桶 */
function tank(c: Ctx, P: Proj, gx: number, gy: number, z: number, g: (h: string) => string): void {
  const [cx, cy] = P(gx, gy, z);
  c.strokeStyle = g('#4a3c33');
  c.lineWidth = 0.45;
  for (const [dx, dy] of [[-2.4, 0], [2.4, 0], [-1.4, 1], [1.4, 1]]) {
    c.beginPath();
    c.moveTo(cx + dx, cy + dy);
    c.lineTo(cx + dx * 0.9, cy + dy - 4);
    c.stroke();
  }
  const top = cy - 11;
  const gr = c.createLinearGradient(cx - 3, 0, cx + 3, 0);
  gr.addColorStop(0, g('#7a5236'));
  gr.addColorStop(0.45, g('#a8754d'));
  gr.addColorStop(1, g('#6a4630'));
  c.fillStyle = gr;
  c.fillRect(cx - 3, top, 6, 7);
  c.beginPath();
  c.ellipse(cx, cy - 4, 3, 1.4, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = g('#5b3e2c');
  c.fillRect(cx - 3, top + 2.2, 6, 0.4);
  c.fillRect(cx - 3, top + 4.8, 6, 0.4);
  // 尖顶
  c.fillStyle = g('#4d4f58');
  c.beginPath();
  c.moveTo(cx - 3.3, top);
  c.lineTo(cx, top - 3);
  c.lineTo(cx + 3.3, top);
  c.closePath();
  c.fill();
  c.fillStyle = g('#686b75');
  c.beginPath();
  c.moveTo(cx, top - 3);
  c.lineTo(cx + 3.3, top);
  c.lineTo(cx, top + 0.6);
  c.closePath();
  c.fill();
}

function skylight(c: Ctx, P: Proj, gx: number, gy: number, w: number, d: number, z: number, g: (h: string) => string): void {
  poly(c, [P(gx, gy, z), P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx, gy + d, z)], g('#5d6670'));
  poly(c, [P(gx + 0.08, gy + 0.08, z + 1.4), P(gx + w - 0.08, gy + 0.08, z + 1.4), P(gx + w - 0.08, gy + d - 0.08, z + 1.4), P(gx + 0.08, gy + d - 0.08, z + 1.4)], g('#a8cfe6'));
  c.strokeStyle = rgba('#ffffff', 0.45);
  c.lineWidth = 0.25;
  c.beginPath();
  c.moveTo(...P(gx + 0.1, gy + d * 0.5, z + 1.4));
  c.lineTo(...P(gx + w - 0.1, gy + d * 0.5, z + 1.4));
  c.stroke();
}

function solar(c: Ctx, P: Proj, gx: number, gy: number, w: number, d: number, z: number, g: (h: string) => string): void {
  const n = Math.max(1, Math.floor(w / 0.55));
  for (let k = 0; k < n; k++) {
    const x0 = gx + k * 0.55;
    poly(c, [P(x0, gy, z + 0.6), P(x0 + 0.48, gy, z + 0.6), P(x0 + 0.48, gy + d, z + 2.4), P(x0, gy + d, z + 2.4)], g('#2f4f86'));
    c.strokeStyle = rgba('#9fc4f0', 0.5);
    c.lineWidth = 0.18;
    c.beginPath();
    for (let t = 0.25; t < 1; t += 0.25) {
      c.moveTo(...P(x0, gy + d * t, z + 0.6 + 1.8 * t));
      c.lineTo(...P(x0 + 0.48, gy + d * t, z + 0.6 + 1.8 * t));
    }
    c.stroke();
  }
}

// ---------------- 树 ----------------

/** 一棵树，(x, y) 是树根；kind 0 圆冠阔叶树、1 松树 */
export function drawTree(c: Ctx, x: number, y: number, size: number, kind: number, tod: TimeOfDay, tint: number): void {
  const g = (h: string) => grade(h, tod);
  const leaf = mix('#4f9a4c', tint > 0.5 ? '#7aa33c' : '#3d8f73', Math.abs(tint - 0.5) * 0.6);
  const dk = g(shade(leaf, -0.28));
  const md = g(leaf);
  const lt = g(shade(leaf, 0.28));
  // 树干
  const th = 6 * size;
  const tr = c.createLinearGradient(x - 1, 0, x + 1, 0);
  tr.addColorStop(0, g('#8a6142'));
  tr.addColorStop(1, g('#5a3c28'));
  c.fillStyle = tr;
  c.fillRect(x - 0.8 * size, y - th - 2, 1.6 * size, th + 2);
  if (kind === 1) {
    // 松树：三层，越往上越小
    for (let k = 0; k < 3; k++) {
      const by = y - th + 2 - k * 4.6 * size;
      const hw = (6.4 - k * 1.6) * size;
      const hh = 7.2 * size;
      c.fillStyle = dk;
      c.beginPath();
      c.moveTo(x - hw, by);
      c.quadraticCurveTo(x, by + 2 * size, x + hw, by);
      c.lineTo(x, by - hh);
      c.closePath();
      c.fill();
      c.fillStyle = md;
      c.beginPath();
      c.moveTo(x - hw * 0.92, by - 0.4);
      c.quadraticCurveTo(x - hw * 0.3, by + 0.6 * size, x + 0.2, by + 0.3);
      c.lineTo(x, by - hh);
      c.closePath();
      c.fill();
      c.fillStyle = lt;
      c.beginPath();
      c.moveTo(x - hw * 0.45, by - hh * 0.5);
      c.lineTo(x, by - hh);
      c.lineTo(x - hw * 0.15, by - hh * 0.35);
      c.closePath();
      c.fill();
    }
    return;
  }
  const r = 6.4 * size;
  const cx = x;
  const cy = y - th - r * 0.72;
  const blobs: [number, number, number][] = [
    [-0.48, 0.18, 0.62],
    [0.5, 0.22, 0.6],
    [0, -0.28, 0.72],
    [0.02, 0.3, 0.74],
  ];
  const circle = (bx: number, by: number, br: number, col: string) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(cx + bx * r, cy + by * r, br * r, 0, Math.PI * 2);
    c.fill();
  };
  for (const [bx, by, br] of blobs) circle(bx, by, br, dk);
  for (const [bx, by, br] of blobs) circle(bx - 0.12, by - 0.16, br * 0.8, md);
  circle(-0.32, -0.42, 0.34, lt);
  circle(0.12, -0.6, 0.22, lt);
  circle(-0.62, 0.0, 0.18, lt);
  // 几片亮叶子
  c.fillStyle = rgba('#ffffff', tod === 'night' ? 0.05 : 0.16);
  for (const [bx, by] of [[-0.2, -0.2], [0.3, -0.05], [-0.05, 0.25], [0.45, 0.35]]) {
    c.beginPath();
    c.ellipse(cx + bx * r, cy + by * r, 0.9 * size, 0.55 * size, -0.5, 0, Math.PI * 2);
    c.fill();
  }
}

// ---------------- 车 ----------------

export type CarKind = 'car' | 'taxi' | 'police';

/**
 * 一辆车：(x, y) 是车底中心，dir 是车头朝的方向（沿格子的四个方向之一）。
 * siren：警灯（0 红亮、1 蓝亮、-1 都不亮），不是警车给 null
 */
export function drawCar(c: Ctx, x: number, y: number, dir: G, color: string, kind: CarKind, siren: number | null, tod: TimeOfDay): void {
  const g = (h: string) => grade(h, tod);
  const side = { gx: -dir.gy, gy: dir.gx };
  const pt = (a: number, s: number, z: number): [number, number] => {
    const gx = dir.gx * a + side.gx * s;
    const gy = dir.gy * a + side.gy * s;
    return [x + ix(gx, gy), y + iy(gx, gy) - z];
  };
  const visible = (na: number, ns: number) => dir.gx * na + side.gx * ns + (dir.gy * na + side.gy * ns) > 0.01;
  // 朝 +gx 的面亮一点，朝 +gy 的面暗一点
  const tone = (na: number, ns: number) => {
    const ngx = dir.gx * na + side.gx * ns;
    const ngy = dir.gy * na + side.gy * ns;
    return -0.15 + 0.09 * (ngx - ngy);
  };
  const HL = 0.62;
  const HW = 0.3;
  // 地上的影子
  c.fillStyle = 'rgba(10,12,22,.32)';
  c.beginPath();
  const s0 = [pt(HL + 0.06, HW + 0.06, 0), pt(HL + 0.06, -HW - 0.06, 0), pt(-HL - 0.06, -HW - 0.06, 0), pt(-HL - 0.06, HW + 0.06, 0)];
  s0.forEach(([a, b], k) => (k ? c.lineTo(a + 1, b + 1) : c.moveTo(a + 1, b + 1)));
  c.closePath();
  c.fill();
  // 轮子
  for (const [a, s] of [[0.38, HW], [0.38, -HW], [-0.38, HW], [-0.38, -HW]]) {
    const [wx, wy] = pt(a, s, 1.3);
    c.fillStyle = '#16171c';
    c.beginPath();
    c.ellipse(wx, wy, 1.75, 1.35, 0, 0, Math.PI * 2);
    c.fill();
    if (visible(0, Math.sign(s))) {
      c.fillStyle = '#9aa0aa';
      c.beginPath();
      c.ellipse(wx, wy, 0.7, 0.55, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  const body = g(color);
  const quad = (pts: [number, number][], col: string | CanvasGradient) => poly(c, pts, col);
  // 车身（下半截）：四面，画看得到的两面
  const z0 = 1.2;
  const z1 = 4.4;
  const corners: [number, number][] = [
    [HL, HW],
    [HL, -HW],
    [-HL, -HW],
    [-HL, HW],
  ];
  const normals: [number, number][] = [
    [1, 0],
    [0, -1],
    [-1, 0],
    [0, 1],
  ];
  for (let k = 0; k < 4; k++) {
    const [na, ns] = normals[k];
    if (!visible(na, ns)) continue;
    const [a1, s1] = corners[k];
    const [a2, s2] = corners[(k + 1) % 4];
    quad([pt(a1, s1, z0), pt(a2, s2, z0), pt(a2, s2, z1), pt(a1, s1, z1)], shade(body, tone(na, ns)));
    if (kind === 'police' && ns !== 0) {
      // 警车车门：下半截深蓝，中间一道亮蓝
      quad([pt(0.36, s1, z0), pt(-0.44, s1, z0), pt(-0.44, s1, z0 + 1.6), pt(0.36, s1, z0 + 1.6)], g(shade('#1d2b57', tone(na, ns) + 0.1)));
      quad([pt(0.6, s1, z0 + 2.1), pt(-0.6, s1, z0 + 2.1), pt(-0.6, s1, z0 + 2.7), pt(0.6, s1, z0 + 2.7)], g(shade('#2f73e6', tone(na, ns) + 0.12)));
    }
    if (na === 1) {
      // 车头：两只大灯和格栅
      for (const s of [0.2, -0.2]) quad([pt(HL + 0.01, s + 0.07, 2.6), pt(HL + 0.01, s - 0.07, 2.6), pt(HL + 0.01, s - 0.07, 3.5), pt(HL + 0.01, s + 0.07, 3.5)], '#fff3c4');
      quad([pt(HL + 0.01, 0.1, 1.9), pt(HL + 0.01, -0.1, 1.9), pt(HL + 0.01, -0.1, 2.9), pt(HL + 0.01, 0.1, 2.9)], g('#2a2c33'));
    }
    if (na === -1) {
      for (const s of [0.21, -0.21]) quad([pt(-HL - 0.01, s + 0.06, 2.8), pt(-HL - 0.01, s - 0.06, 2.8), pt(-HL - 0.01, s - 0.06, 3.6), pt(-HL - 0.01, s + 0.06, 3.6)], '#e0453b');
    }
  }
  // 车身顶面（引擎盖、后备箱）
  quad(corners.map(([a, s]) => pt(a, s, z1)), shade(body, 0.08));
  if (kind === 'police') {
    quad([pt(HL, HW, z1), pt(HL, -HW, z1), pt(0.24, -HW, z1), pt(0.24, HW, z1)], g('#1d2b57'));
  }
  // 车舱：下面大、上面小，前挡风玻璃斜着
  const cab: [number, number][] = [
    [0.24, HW * 0.86],
    [0.24, -HW * 0.86],
    [-0.4, -HW * 0.86],
    [-0.4, HW * 0.86],
  ];
  const top: [number, number][] = [
    [0.04, HW * 0.72],
    [0.04, -HW * 0.72],
    [-0.32, -HW * 0.72],
    [-0.32, HW * 0.72],
  ];
  const z2 = 7.6;
  for (let k = 0; k < 4; k++) {
    const [na, ns] = normals[k];
    if (!visible(na, ns)) continue;
    const a = cab[k];
    const b = cab[(k + 1) % 4];
    const ta = top[k];
    const tb = top[(k + 1) % 4];
    const pts = [pt(a[0], a[1], z1), pt(b[0], b[1], z1), pt(tb[0], tb[1], z2), pt(ta[0], ta[1], z2)];
    const glass = c.createLinearGradient(0, pts[0][1], 0, pts[3][1]);
    glass.addColorStop(0, g(shade('#2b3a52', tone(na, ns) * 0.6)));
    glass.addColorStop(1, g(shade('#6d8fb2', tone(na, ns) * 0.6)));
    quad(pts, glass);
    // 车窗中间的柱子
    if (ns !== 0) {
      const m = pt(-0.08, a[1], z1);
      const mt = pt(-0.12, ta[1], z2);
      c.strokeStyle = shade(body, tone(na, ns));
      c.lineWidth = 0.45;
      c.beginPath();
      c.moveTo(m[0], m[1]);
      c.lineTo(mt[0], mt[1]);
      c.stroke();
    }
  }
  // 车顶
  quad(top.map(([a, s]) => pt(a, s, z2)), shade(body, 0.14));
  c.strokeStyle = rgba('#ffffff', tod === 'night' ? 0.12 : 0.4);
  c.lineWidth = 0.3;
  c.beginPath();
  const t0 = top.map(([a, s]) => pt(a, s, z2));
  c.moveTo(...t0[3]);
  c.lineTo(...t0[0]);
  c.lineTo(...t0[1]);
  c.stroke();
  if (kind === 'taxi') {
    // 出租车顶灯
    const cx0 = pt(-0.14, 0, z2);
    c.fillStyle = '#2b2b30';
    c.fillRect(cx0[0] - 2.2, cx0[1] - 2.2, 4.4, 2);
    c.fillStyle = tod === 'day' ? '#fff3c4' : '#ffe08a';
    c.fillRect(cx0[0] - 1.9, cx0[1] - 2, 3.8, 1.3);
  }
  if (kind === 'police') {
    // 警灯：车顶中间一条，左红右蓝
    const bar = (s1: number, s2: number, on: boolean, col: string, off: string) => {
      const p1 = [pt(-0.08, s1, z2), pt(-0.08, s2, z2), pt(-0.18, s2, z2), pt(-0.18, s1, z2)];
      const up = 1.5;
      quad([p1[0], p1[1], [p1[1][0], p1[1][1] - up], [p1[0][0], p1[0][1] - up]], on ? shade(col, -0.1) : off);
      quad([p1[1], p1[2], [p1[2][0], p1[2][1] - up], [p1[1][0], p1[1][1] - up]], on ? shade(col, -0.25) : shade(off, -0.2));
      quad(p1.map(([px, py]) => [px, py - up] as [number, number]), on ? '#ffffff' : shade(off, 0.15));
      if (on) quad(p1.map(([px, py]) => [px, py - up] as [number, number]).map(([px, py], i, arr) => [px + (arr[(i + 2) % 4][0] - px) * 0.2, py + (arr[(i + 2) % 4][1] - py) * 0.2] as [number, number]), col);
    };
    bar(0.2, 0.02, siren === 0, '#ff3b30', '#7a2622');
    bar(-0.02, -0.2, siren === 1, '#2f8bff', '#203f77');
  }
}

// ---------------- 路灯 ----------------

/** 路灯：细杆子、往路这边弯的灯臂、灯罩；夜里灯亮 */
export function drawLamp(c: Ctx, x: number, y: number, tod: TimeOfDay, flip: boolean): void {
  const g = (h: string) => grade(h, tod);
  const d = flip ? -1 : 1;
  c.fillStyle = 'rgba(10,12,22,.25)';
  c.beginPath();
  c.ellipse(x + 1, y + 0.5, 2.2, 1, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = g('#3c414d');
  c.fillRect(x - 0.9, y - 1.2, 1.8, 1.4);
  c.strokeStyle = g('#4a505c');
  c.lineWidth = 0.75;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - 17);
  c.quadraticCurveTo(x, y - 19, x + 2.4 * d, y - 19);
  c.lineTo(x + 4 * d, y - 19);
  c.stroke();
  c.fillStyle = g('#2f333c');
  c.beginPath();
  c.ellipse(x + 4.4 * d, y - 18.6, 1.9, 0.9, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = tod === 'day' ? '#e9edf2' : '#fff1c2';
  c.beginPath();
  c.ellipse(x + 4.4 * d, y - 18.5, 1.4, 0.5, 0, 0, Math.PI * 2);
  c.fill();
  if (tod !== 'day') {
    // 灯泡周围一圈暖光（和路灯一起按前后顺序画，被楼挡住就看不见）
    const hx = x + 4.4 * d;
    const hy = y - 18.3;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(hx, hy, 0, hx, hy, 9);
    gr.addColorStop(0, tod === 'night' ? 'rgba(255,214,140,.55)' : 'rgba(255,214,140,.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr;
    c.fillRect(hx - 9, hy - 9, 18, 18);
    // 照在杆子下面路面上的一片
    const lg = c.createRadialGradient(hx, y + 1, 0, hx, y + 1, 16);
    lg.addColorStop(0, tod === 'night' ? 'rgba(255,190,110,.13)' : 'rgba(255,190,110,.06)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = lg;
    c.fillRect(hx - 16, y - 15, 32, 32);
    c.restore();
  }
}

/** 消防栓 */
export function drawHydrant(c: Ctx, x: number, y: number, tod: TimeOfDay): void {
  const g = (h: string) => grade(h, tod);
  c.fillStyle = 'rgba(10,12,22,.22)';
  c.beginPath();
  c.ellipse(x + 0.6, y + 0.3, 1.6, 0.7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = g('#c63b30');
  c.fillRect(x - 1, y - 3.6, 2, 3.6);
  c.fillStyle = g('#e5564a');
  c.fillRect(x - 1, y - 3.6, 0.9, 3.6);
  c.beginPath();
  c.ellipse(x, y - 3.7, 1.1, 0.7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = g('#9c2a22');
  c.fillRect(x - 1.6, y - 2.6, 3.2, 0.8);
}
