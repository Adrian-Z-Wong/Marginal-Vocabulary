// 小图：站着跑的小偷（等距画面里人是立着画的），和一些画像素用的小工具。
// 警车、路边的车在 iso.ts 里按方向画成小方块车。

export type Ctx = CanvasRenderingContext2D;

export function px(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

/** 颜色变亮（amt > 0）或变暗（amt < 0） */
export function shade(hex: string, amt: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}

export interface Sprite {
  img: HTMLCanvasElement;
  /** 脚底在小图里的位置 */
  fx: number;
  fy: number;
}

const SKIN = '#f0c48e';
const SKIN_D = '#d9a56f';
const HAT = '#24252e';
const STRIPE_A = '#eeebe3';
const STRIPE_B = '#2c2f3c';
const PANTS = '#3b4462';
const SHOE = '#141419';
const BAG = '#c8a066';
const BAG_D = '#a47e4a';

/**
 * 小偷（14 × 22，面朝右在跑）：黑毛线帽、眼罩、条纹衫，背着钱袋。
 * frame 0–3 跑步四帧；caught 举着手站住
 */
function drawThief(c: Ctx, frame: number, caught: boolean): void {
  const run = !caught;
  const lift = run && frame % 2 === 1 ? -1 : 0;
  const top = 2 + lift;
  // 钱袋背在身后
  if (!caught) {
    px(c, 0, top + 6, 6, 7, BAG_D);
    px(c, 1, top + 5, 4, 8, BAG);
    px(c, 2, top + 4, 2, 1, BAG_D);
    px(c, 2, top + 7, 1, 4, '#5a3f1f');
    px(c, 1, top + 8, 3, 1, '#5a3f1f');
    px(c, 1, top + 10, 3, 1, '#5a3f1f');
  }
  // 腿：前后错开
  const lf = run ? [[-3, 3], [-1, 1], [3, -3], [1, -1]][frame] : [0, 0];
  px(c, 5 + lf[1], top + 14, 2, 5, shade(PANTS, -0.25));
  px(c, 5 + lf[1] - (lf[1] < 0 ? 1 : 0), top + 18, 3, 2, SHOE);
  px(c, 8 + lf[0], top + 14, 2, 5, PANTS);
  px(c, 8 + lf[0], top + 18, 3, 2, SHOE);
  // 身子：横条纹衫
  for (let r = 0; r < 7; r++) px(c, 4, top + 7 + r, 8, 1, r % 2 ? STRIPE_B : STRIPE_A);
  px(c, 11, top + 8, 1, 6, 'rgba(0,0,0,.15)');
  // 胳膊
  if (caught) {
    px(c, 3, top + 1, 2, 7, STRIPE_A);
    px(c, 11, top + 1, 2, 7, STRIPE_A);
    px(c, 3, top, 2, 2, SKIN);
    px(c, 11, top, 2, 2, SKIN);
  } else {
    const sw = [2, 0, -2, 0][frame];
    px(c, 9 + sw, top + 8, 2, 4, STRIPE_A);
    px(c, 9 + sw, top + 12, 2, 1, SKIN);
    px(c, 3, top + 7, 2, 3, STRIPE_B);
  }
  // 头、眼罩、毛线帽
  px(c, 5, top + 1, 6, 6, SKIN);
  px(c, 10, top + 3, 2, 2, SKIN);
  px(c, 5, top + 5, 6, 1, SKIN_D);
  px(c, 5, top + 3, 7, 2, '#1b1c22');
  px(c, 9, top + 3, 1, 1, '#ffffff');
  px(c, 4, top - 1, 8, 3, HAT);
  px(c, 5, top - 2, 6, 1, HAT);
  px(c, 4, top + 1, 8, 1, shade(HAT, 0.2));
}

function make(w: number, h: number, fx: number, fy: number, draw: (c: Ctx) => void): Sprite {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d') as Ctx;
  c.imageSmoothingEnabled = false;
  draw(c);
  return { img: cv, fx, fy };
}

let thief: Sprite[] | null = null;
let thiefCaught: Sprite | null = null;

export function thiefSprite(frame: number, caught = false): Sprite {
  if (caught) return thiefCaught || (thiefCaught = make(16, 24, 8, 22, (c) => drawThief(c, 0, true)));
  if (!thief) thief = [0, 1, 2, 3].map((f) => make(16, 24, 8, 22, (c) => drawThief(c, f, false)));
  return thief[frame & 3];
}

/** 把小图的脚底放在 (x, y)；flip 时左右翻过来（往左跑） */
export function blitFoot(c: Ctx, s: Sprite, x: number, y: number, flip = false): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (!flip) {
    c.drawImage(s.img, X - s.fx, Y - s.fy);
    return;
  }
  c.save();
  c.translate(X, Y);
  c.scale(-1, 1);
  c.drawImage(s.img, -s.fx, -s.fy);
  c.restore();
}

/** 地上的影子 */
export function shadow(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = 'rgba(10,12,25,.28)';
  c.beginPath();
  c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
