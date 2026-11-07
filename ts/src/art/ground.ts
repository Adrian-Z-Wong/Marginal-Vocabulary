// 地面（16×16）

import { mix, ramp } from './color';
import { Pix } from './pix';

// ================= 地面（16×16） =================

export function rnd(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
export const GROUND: Record<string, (p: Pix, v: number) => void> = {
  grass(p, v) {
    const G = '#7fb35a';
    const R = ramp(G);
    p.rect(0, 0, 16, 16, G);
    const r = rnd(17 + v * 31);
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(r() * 15);
      const y = Math.floor(r() * 14) + 1;
      p.set(x, y, R.mid);
      p.set(x + 1, y - 1, R.hi);
    }
    if (v === 2) {
      p.set(4, 5, '#ffffff');
      p.set(11, 11, '#f6d35b');
    }
    if (v === 3) {
      p.set(6, 9, R.lo);
      p.set(7, 8, R.hi);
      p.set(8, 9, R.lo);
    }
  },
  path(p, v) {
    const D = '#d8b98a';
    p.rect(0, 0, 16, 16, D);
    const r = rnd(5 + v * 13);
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(r() * 15);
      const y = Math.floor(r() * 15);
      p.rect(x, y, 2, 1, ramp(D).mid);
      p.set(x, y - 1, ramp(D).hi);
    }
  },
  soil(p, _v) {
    const S = '#9a6a48';
    p.rect(0, 0, 16, 16, S);
    for (let y = 2; y < 16; y += 4) {
      p.rect(1, y, 14, 1, ramp(S).lo);
      p.rect(1, y - 1, 14, 1, ramp(S).hi);
    }
  },
  wet(p, _v) {
    const S = '#6e4a34';
    p.rect(0, 0, 16, 16, S);
    for (let y = 2; y < 16; y += 4) {
      p.rect(1, y, 14, 1, ramp(S).lo);
      p.rect(1, y - 1, 14, 1, ramp(S).hi);
    }
    p.set(4, 6, '#9fc8e8');
    p.set(11, 10, '#9fc8e8');
  },
  // 木地板：一块 16×16 里四条横木板，接缝错开，有木纹
  floor(p, v) {
    const W = '#c99a6a';
    const R = ramp(W);
    const r = rnd(31 + v * 17);
    for (let k = 0; k < 4; k++) {
      const y = k * 4;
      const tone = [W, mix(W, R.hi, 0.35), mix(W, R.mid, 0.4), W][(k + v) % 4];
      p.rect(0, y, 16, 3, tone);
      p.rect(0, y + 3, 16, 1, R.lo);
      const seam = Math.floor(r() * 12) + 2;
      p.rect(seam, y, 1, 3, R.mid);
      if (r() < 0.45) p.rect(Math.floor(r() * 12), y + 1, 3, 1, mix(tone, R.mid, 0.45));
    }
  },
  // 墙：上面是有小花纹的墙纸，下面是木护墙板和踢脚线（两格高，上下两半分开画）
  wall(p, _v) {
    const P = '#efe0c4';
    p.rect(0, 0, 16, 16, P);
    for (let x = 2; x < 16; x += 8) for (let y = 3; y < 16; y += 8) {
      p.set(x + ((y >> 3) % 2) * 4, y, '#e0b8a0');
      p.set(x + ((y >> 3) % 2) * 4 + 1, y, '#e0b8a0');
    }
    for (let x = 0; x < 16; x += 8) p.rect(x, 0, 1, 16, mix(P, '#d8c4a0', 0.6));
  },
  wainscot(p, _v) {
    const P = '#efe0c4';
    p.rect(0, 0, 16, 5, P);
    for (let x = 0; x < 16; x += 8) p.rect(x, 0, 1, 5, mix(P, '#d8c4a0', 0.6));
    p.rect(0, 5, 16, 1, '#8a5a3b');
    p.sRect(0, 6, 16, 8, '#b07a4a', { noHi: true });
    for (let x = 3; x < 16; x += 8) p.rect(x, 7, 1, 6, ramp('#b07a4a').lo);
    p.rect(0, 14, 16, 2, '#6a4a32');
  },
};
