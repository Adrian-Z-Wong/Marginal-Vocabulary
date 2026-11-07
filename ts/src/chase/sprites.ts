// 俯视角的像素小图：警车、小偷、路边停的车、树。都朝右画，用的时候按方向转。
// 先画在小画布上存起来（每一帧一张），游戏里用 drawImage 转着画，像素保持清楚。

export type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d') as Ctx;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export function px(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

export interface Sprite {
  img: HTMLCanvasElement;
  /** 图的中心（转的时候绕这里） */
  cx: number;
  cy: number;
}

// ---------------- 警车（24 × 14，车头朝右） ----------------

const K = '#151a28';
const WHITE = '#f6f5f0';
const WHITE_D = '#dcdbd4';
const NAVY = '#23356a';
const GLASS = '#5f97bd';
const GLASS_L = '#9fd0ea';

/** flash：0 红灯亮，1 蓝灯亮，-1 都不亮 */
function drawPolice(c: Ctx, flash: number): void {
  // 车轮（露出车身一点）
  for (const [x, y] of [[4, 1], [16, 1], [4, 12], [16, 12]]) px(c, x, y, 4, 1, '#0d0f14');
  // 外框和车身
  px(c, 1, 2, 22, 10, K);
  px(c, 0, 3, 24, 8, K);
  px(c, 2, 3, 20, 8, WHITE);
  px(c, 1, 4, 22, 6, WHITE);
  // 车身两侧深蓝色条
  px(c, 6, 3, 11, 1, NAVY);
  px(c, 6, 10, 11, 1, NAVY);
  // 前挡风、后窗
  px(c, 15, 4, 2, 6, GLASS);
  px(c, 15, 4, 1, 2, GLASS_L);
  px(c, 5, 4, 2, 6, GLASS);
  // 车顶
  px(c, 7, 4, 8, 6, WHITE);
  px(c, 7, 9, 8, 1, WHITE_D);
  // 警灯（横在车顶中间）
  px(c, 10, 3, 3, 8, K);
  px(c, 11, 4, 1, 3, flash === 0 ? '#ff4d43' : '#8a2f2b');
  px(c, 11, 7, 1, 3, flash === 1 ? '#4fa3ff' : '#284a80');
  // 大灯、尾灯
  px(c, 23, 4, 1, 2, '#fff1b0');
  px(c, 23, 8, 1, 2, '#fff1b0');
  px(c, 0, 4, 1, 2, '#d0463c');
  px(c, 0, 8, 1, 2, '#d0463c');
  // 车头的高光
  px(c, 19, 4, 3, 1, '#ffffff');
}

// ---------------- 小偷（14 × 14，往右跑） ----------------

const SKIN = '#f0c48e';
const HAT = '#22232c';
const STRIPE_A = '#efece4';
const STRIPE_B = '#2b2e3b';
const BAG = '#c9a066';
const BAG_D = '#9c7744';

/** frame 0–3 跑步；caught 举手投降 */
function drawThief(c: Ctx, frame: number, caught: boolean): void {
  const leg = caught ? 0 : [2, 0, -2, 0][frame];
  const arm = caught ? 0 : [-2, 0, 2, 0][frame];
  // 腿（俯视看得到从身子底下伸出来的脚）
  px(c, 6 + leg, 3, 3, 2, '#2f3650');
  px(c, 6 - leg, 9, 3, 2, '#2f3650');
  px(c, 8 + leg, 3, 1, 2, '#111');
  px(c, 8 - leg, 9, 1, 2, '#111');
  // 钱袋（背在后面）
  if (!caught) {
    px(c, 1, 4, 4, 6, BAG_D);
    px(c, 2, 3, 3, 8, BAG);
    px(c, 2, 5, 1, 1, '#ffe2a6');
    px(c, 3, 6, 1, 2, '#5a3f1f');
  }
  // 身子（条纹衫，条纹横过肩膀）
  px(c, 5, 4, 5, 6, STRIPE_A);
  for (let i = 0; i < 5; i += 2) px(c, 5 + i, 4, 1, 6, STRIPE_B);
  // 胳膊
  if (caught) {
    px(c, 7, 0, 2, 4, STRIPE_A);
    px(c, 7, 10, 2, 4, STRIPE_A);
    px(c, 7, 0, 2, 1, SKIN);
    px(c, 7, 13, 2, 1, SKIN);
  } else {
    px(c, 6 + arm, 2, 3, 2, STRIPE_A);
    px(c, 6 - arm, 10, 3, 2, STRIPE_A);
    px(c, 9 + arm, 2, 1, 2, SKIN);
    px(c, 9 - arm, 10, 1, 2, SKIN);
  }
  // 头：毛线帽从上面看是个黑圆，前面露出一点脸和眼罩
  px(c, 8, 5, 4, 4, HAT);
  px(c, 9, 4, 2, 6, HAT);
  px(c, 12, 6, 1, 2, SKIN);
  px(c, 11, 5, 1, 4, '#3a3b46');
  px(c, 9, 5, 1, 1, '#4a4c58');
}

// ---------------- 路边停的车（20 × 11） ----------------

function drawParked(c: Ctx, color: string): void {
  const d = shade(color, -0.3);
  for (const [x, y] of [[3, 0], [14, 0], [3, 10], [14, 10]]) px(c, x, y, 3, 1, '#0d0f14');
  px(c, 0, 1, 20, 9, d);
  px(c, 1, 1, 18, 9, color);
  px(c, 12, 2, 2, 7, '#4d6f88');
  px(c, 4, 2, 2, 7, '#4d6f88');
  px(c, 6, 2, 6, 7, shade(color, 0.15));
  px(c, 16, 2, 2, 1, shade(color, 0.4));
}

// ---------------- 树冠（16 × 16） ----------------

function drawTree(c: Ctx, light: string, dark: string): void {
  const r = 7;
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(r * r - y * y));
    px(c, 8 - half, 8 + y, half * 2, 1, y > 2 ? dark : light);
  }
  // 一圈一圈的叶子团
  px(c, 4, 4, 3, 2, shade(light, 0.2));
  px(c, 9, 6, 2, 2, shade(light, 0.25));
  px(c, 6, 10, 3, 1, shade(dark, -0.15));
  px(c, 11, 9, 2, 2, shade(dark, -0.1));
}

/** 颜色变亮（amt > 0）或变暗（amt < 0） */
export function shade(hex: string, amt: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}

// ---------------- 缓存 ----------------

let police: Sprite[] | null = null;
let thief: Sprite[] | null = null;
let thiefCaught: Sprite | null = null;
const parked = new Map<string, Sprite>();
const trees = new Map<string, Sprite>();

function make(w: number, h: number, draw: (c: Ctx) => void): Sprite {
  const [cv, c] = canvas(w, h);
  draw(c);
  return { img: cv, cx: w / 2, cy: h / 2 };
}

/** 警车三帧：红灯、蓝灯、不亮 */
export function policeSprite(flash: number): Sprite {
  if (!police) police = [0, 1, -1].map((f) => make(24, 14, (c) => drawPolice(c, f)));
  return police[flash === 0 ? 0 : flash === 1 ? 1 : 2];
}

export function thiefSprite(frame: number, caught = false): Sprite {
  if (caught) return thiefCaught || (thiefCaught = make(14, 14, (c) => drawThief(c, 0, true)));
  if (!thief) thief = [0, 1, 2, 3].map((f) => make(14, 14, (c) => drawThief(c, f, false)));
  return thief[frame & 3];
}

export function parkedSprite(color: string): Sprite {
  let s = parked.get(color);
  if (!s) parked.set(color, (s = make(20, 11, (c) => drawParked(c, color))));
  return s;
}

export function treeSprite(light: string, dark: string): Sprite {
  const key = light + dark;
  let s = trees.get(key);
  if (!s) trees.set(key, (s = make(16, 16, (c) => drawTree(c, light, dark))));
  return s;
}

/** 转着画一张小图：angle 是弧度，0 朝右 */
export function blit(c: Ctx, s: Sprite, x: number, y: number, angle: number): void {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  // 转到 8 个方向之一，转弯时也不会糊成一团
  const a = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  if (a) c.rotate(a);
  c.drawImage(s.img, -Math.round(s.cx), -Math.round(s.cy));
  c.restore();
}

/** 地上的影子 */
export function shadow(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = 'rgba(10,12,25,.28)';
  c.beginPath();
  c.ellipse(Math.round(x) + 1, Math.round(y) + 2, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
