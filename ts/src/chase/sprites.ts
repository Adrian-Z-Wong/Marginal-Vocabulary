// 小偷：手画的矢量小人（黑毛线帽、眼罩、条纹衫、背着钱袋），描一圈深色的边，小也看得清；
// 跑起来手脚连续地摆，身子一颠一颠。还有画影子、画小方块的小工具。

import { Ctx, TimeOfDay, grade } from './geo';

export type { Ctx } from './geo';

export function px(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

/** 地上的影子 */
export function shadow(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = 'rgba(10,12,25,.3)';
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

const INK = '#17161c';

export type ThiefPose = 'stand' | 'run' | 'caught';

/**
 * 画小偷：(x, y) 是两脚中间的地面，t 是时间（毫秒，跑步的节奏），flip 往左跑时左右翻过来。
 * 身高大约 24 像素（大地图上的像素）
 */
export function drawThief(c: Ctx, x: number, y: number, t: number, pose: ThiefPose, flip: boolean, tod: TimeOfDay): void {
  const g = (h: string) => grade(h, tod === 'night' ? 'dusk' : tod);
  const SKIN = g('#f2c69a');
  const HAT = g('#24252e');
  const PANTS = g('#323a58');
  const SHOE = '#121216';
  const SLEEVE = g('#2b2e3b');
  const BAG = g('#cfa369');
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const run = pose === 'run';
  const ph = (t / 1000) * Math.PI * 2 * 1.7;
  const sw = run ? Math.sin(ph) : 0;
  const bob = run ? -Math.abs(Math.cos(ph)) * 1.1 : pose === 'caught' ? 0 : Math.sin(t / 400) * 0.25;
  const lean = run ? 0.16 : 0;
  const hipY = -9.4 + bob;
  const shY = -16.6 + bob;

  // 一节一节的手脚：先描深色的边，再涂颜色
  const limb = (pts: [number, number][], w: number, col: string) => {
    c.strokeStyle = INK;
    c.lineWidth = w + 1.3;
    c.beginPath();
    pts.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b)));
    c.stroke();
    c.strokeStyle = col;
    c.lineWidth = w;
    c.stroke();
  };
  const leg = (a: number, knee: number, col: string) => {
    const hx = 0;
    const kx = hx + Math.sin(a) * 4.6;
    const ky = hipY + Math.cos(a) * 4.6;
    const fa = a - knee;
    const fx = kx + Math.sin(fa) * 4.6;
    const fy = ky + Math.cos(fa) * 4.6;
    limb([[hx, hipY], [kx, ky], [fx, fy]], 2.3, col);
    // 鞋
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(fx + 0.9, fy + 0.2, 1.9, 1.05, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = SHOE;
    c.beginPath();
    c.ellipse(fx + 0.9, fy + 0.1, 1.4, 0.65, 0, 0, Math.PI * 2);
    c.fill();
  };
  const arm = (a: number, elbow: number, col: string) => {
    const sx = Math.sin(lean) * 7;
    const ex = sx + Math.sin(a) * 3.6;
    const ey = shY + 0.8 + Math.cos(a) * 3.6;
    const fa = a + elbow;
    const hx = ex + Math.sin(fa) * 3.3;
    const hy = ey + Math.cos(fa) * 3.3;
    limb([[sx, shY + 0.8], [ex, ey], [hx, hy]], 1.9, col);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(hx, hy, 1.35, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = SKIN;
    c.beginPath();
    c.arc(hx, hy, 0.85, 0, Math.PI * 2);
    c.fill();
  };

  const backCol = g('#262a42');
  if (pose === 'caught') {
    // 举起双手、钱袋掉在脚边
    bag(c, 5.5, -3.5, 0.9, BAG);
    leg(0.12, 0.05, backCol);
    leg(-0.12, 0.05, PANTS);
    arm(Math.PI + 1.25, -0.75, SLEEVE);
  } else {
    arm(-sw * 0.9, run ? 0.9 + sw * 0.3 : 0.15, SLEEVE);
    leg(-sw * 0.8, run ? Math.max(0.1, Math.cos(ph) * 1.1) : 0.05, backCol);
    // 背上的钱袋
    bag(c, -4.4 + Math.sin(lean) * 5, shY + 3.2, 1, BAG);
  }

  // 身子：条纹衫，略微前倾
  c.save();
  c.translate(0, hipY);
  c.rotate(lean);
  const tw = 6.6;
  const th = hipY - shY;
  const body = () => {
    c.beginPath();
    c.moveTo(-tw / 2, 0.6);
    c.lineTo(-tw / 2 + 0.2, -th + 1.6);
    c.quadraticCurveTo(-tw / 2 + 0.4, -th, -tw / 2 + 2, -th);
    c.lineTo(tw / 2 - 2, -th);
    c.quadraticCurveTo(tw / 2 - 0.4, -th, tw / 2 - 0.2, -th + 1.6);
    c.lineTo(tw / 2, 0.6);
    c.closePath();
  };
  body();
  c.strokeStyle = INK;
  c.lineWidth = 1.3;
  c.stroke();
  c.save();
  body();
  c.clip();
  for (let k = 0; k * 1.2 < th + 1; k++) {
    c.fillStyle = k % 2 ? g('#2c2f3c') : g('#f2eee5');
    c.fillRect(-tw / 2, -th + k * 1.2, tw, 1.2);
  }
  // 背光的一侧暗一点
  c.fillStyle = 'rgba(20,20,40,.18)';
  c.fillRect(-tw / 2, -th, 1.6, th + 1);
  c.restore();
  c.restore();

  if (pose !== 'caught') leg(sw * 0.8, run ? Math.max(0.1, -Math.cos(ph) * 1.1) : 0.05, PANTS);

  // 头：毛线帽、眼罩
  const hx = Math.sin(lean) * 8.6 + 0.4;
  const hy = shY - 3.4;
  c.fillStyle = INK;
  c.beginPath();
  c.arc(hx, hy, 4.05, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = SKIN;
  c.beginPath();
  c.arc(hx, hy, 3.4, 0, Math.PI * 2);
  c.fill();
  // 鼻子
  c.beginPath();
  c.arc(hx + 3.2, hy + 0.5, 0.9, 0, Math.PI * 2);
  c.fill();
  // 帽子（盖住头顶）和翻边
  c.fillStyle = HAT;
  c.beginPath();
  c.arc(hx, hy - 0.2, 3.65, Math.PI * 1.02, Math.PI * 1.98);
  c.closePath();
  c.fill();
  c.fillStyle = g('#3b3e4c');
  c.fillRect(hx - 3.6, hy - 1.3, 7.2, 1.2);
  c.fillStyle = HAT;
  c.beginPath();
  c.arc(hx - 0.6, hy - 3.9, 0.9, 0, Math.PI * 2);
  c.fill();
  // 眼罩：一道黑带，露出眼睛
  c.fillStyle = '#121216';
  c.fillRect(hx - 3.4, hy + 0.1, 7.1, 1.7);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(hx + 1.9, hy + 0.95, 0.62, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#121216';
  c.beginPath();
  c.arc(hx + 2.15, hy + 0.95, 0.3, 0, Math.PI * 2);
  c.fill();
  // 嘴
  c.strokeStyle = g('#9a5a48');
  c.lineWidth = 0.4;
  c.beginPath();
  c.moveTo(hx + 1.2, hy + 2.6);
  c.lineTo(hx + 2.4, hy + 2.5);
  c.stroke();

  if (pose === 'caught') arm(Math.PI - 1.25, 0.75, SLEEVE);
  else arm(sw * 0.9, run ? 0.9 - sw * 0.3 : 0.15, SLEEVE);
  c.restore();
}

/** 钱袋：鼓鼓的布袋，扎着口，印着 $ */
function bag(c: Ctx, x: number, y: number, s: number, col: string): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(0, 0.6, 4.2, 4.6, 0, 0, Math.PI * 2);
  c.fill();
  const gr = c.createLinearGradient(-3, -3, 3, 4);
  gr.addColorStop(0, col);
  gr.addColorStop(1, '#a87c46');
  c.fillStyle = gr;
  c.beginPath();
  c.ellipse(0, 0.6, 3.5, 3.9, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#7a5530';
  c.fillRect(-1.3, -3.6, 2.6, 1);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-1.4, -3.4);
  c.lineTo(0, -5.2);
  c.lineTo(1.4, -3.4);
  c.closePath();
  c.fill();
  c.fillStyle = '#6a4a2a';
  c.font = '700 4.6px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('$', 0, 1);
  c.restore();
}
