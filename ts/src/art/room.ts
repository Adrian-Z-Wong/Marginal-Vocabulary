// 小屋里面

import { mix, ramp } from './color';
import { rnd } from './ground';
import { Pix } from './pix';

// ================= 小屋里面 =================
// 整间屋子一起画：上面两格是墙（顶上的木线、墙纸、腰线、护墙板、踢脚线），下面是长短不一的木地板；
// 左右和下边一圈深色的墙边，门口留出口子
export function room(o: { w: number; h: number; door: number[] | null; seed?: number }): HTMLCanvasElement {
  const T = 16;
  const W = o.w * T;
  const H = o.h * T;
  const p = new Pix(W, H);
  const r = rnd(o.seed || 7);
  // 墙纸：暖白底，细竖条，零星的小花
  const PAPER = '#f1e2c6';
  p.rect(0, 0, W, 2 * T, PAPER);
  for (let x = 0; x < W; x += 6) p.rect(x, 3, 1, 15, '#e8d5b2');
  for (let x = 3; x < W; x += 12)
    for (let y = 7; y < 17; y += 8) {
      const xx = x + (((y - 7) / 8) % 2 ? 6 : 0);
      p.set(xx, y, '#dca792');
      p.set(xx - 1, y + 1, '#dca792');
      p.set(xx + 1, y + 1, '#dca792');
      p.set(xx, y + 2, '#dca792');
      p.set(xx, y + 1, '#a8c08a');
    }
  // 顶上的木线
  p.rect(0, 0, W, 3, '#5a3a28');
  p.rect(0, 2, W, 1, '#7a5238');
  // 腰线
  p.rect(0, 17, W, 1, '#c9965f');
  p.rect(0, 18, W, 2, '#9a6a44');
  p.rect(0, 20, W, 1, '#6e4a30');
  // 护墙板：一格一块，四边有亮边和暗边
  const WOOD = '#b9845a';
  const WR = ramp(WOOD);
  p.rect(0, 21, W, 9, WOOD);
  for (let x = 0; x < W; x += T) {
    p.rect(x + 2, 22, T - 4, 1, WR.mid);
    p.rect(x + 2, 22, 1, 6, WR.mid);
    p.rect(x + 2, 28, T - 4, 1, WR.hi);
    p.rect(x + T - 3, 22, 1, 7, WR.hi);
    p.rect(x + 4, 24, T - 8, 2, mix(WOOD, WR.hi, 0.35));
    p.rect(x, 21, 1, 9, WR.lo);
  }
  // 踢脚线
  p.rect(0, 30, W, 2, '#6a4630');
  p.rect(0, 30, W, 1, '#8a5e40');
  // 地板：一行 6 像素高的木板，长短不一、接缝错开，颜色略有深浅，零星有木纹和节疤
  const TONES = ['#b47c52', '#bc865b', '#ab7449', '#c08c60'];
  const GAP = '#7a4e32';
  for (let y = 2 * T, row = 0; y < H; y += 6, row++) {
    let x = -Math.floor(r() * 30);
    while (x < W) {
      const len = 22 + Math.floor(r() * 26);
      const tone = TONES[Math.floor(r() * TONES.length)];
      p.rect(x, y, len, 5, tone);
      p.rect(x, y, len, 1, mix(tone, '#ffffff', 0.12));
      p.rect(x, y + 5, len, 1, GAP);
      p.rect(x + len - 1, y, 1, 5, GAP);
      const g = Math.floor(r() * 3);
      for (let k = 0; k < g; k++) p.rect(x + 3 + Math.floor(r() * (len - 10)), y + 2 + Math.floor(r() * 2), 3 + Math.floor(r() * 4), 1, mix(tone, GAP, 0.35));
      if (r() < 0.12) {
        const kx = x + 4 + Math.floor(r() * (len - 8));
        p.set(kx, y + 2, mix(tone, GAP, 0.6));
        p.set(kx + 1, y + 2, mix(tone, GAP, 0.4));
      }
      x += len;
    }
  }
  // 墙根在地板上的影子
  for (let y = 2 * T; y < 2 * T + 4; y++)
    for (let x = 0; x < W; x++) {
      const c = p.get(x, y);
      if (c) p.set(x, y, mix(c, '#3a2418', [0.32, 0.22, 0.12, 0.06][y - 2 * T]));
    }
  // 左右和下面的墙边；门口（door: [x0, x1] 格子）留口子
  const EDGE = '#4a3022';
  for (const x0 of [0, W - 4]) {
    p.rect(x0, 0, 4, H, EDGE);
    p.rect(x0 === 0 ? 3 : W - 4, 0, 1, H, '#6a4630');
  }
  for (let x = 0; x < W; x++) {
    const inDoor = o.door && x >= o.door[0] * T && x < (o.door[1] + 1) * T;
    if (inDoor) continue;
    p.set(x, H - 3, '#6a4630');
    p.set(x, H - 2, EDGE);
    p.set(x, H - 1, EDGE);
  }
  // 门口的地垫
  if (o.door) {
    const mx = o.door[0] * T + 2;
    const mw = (o.door[1] - o.door[0] + 1) * T - 4;
    p.rect(mx, H - 11, mw, 9, '#8a5a3b');
    p.rect(mx + 2, H - 9, mw - 4, 5, '#b07a4a');
    for (let x = mx + 3; x < mx + mw - 3; x += 3) p.set(x, H - 7, '#c9965f');
  }
  return p.toCanvas();
}
