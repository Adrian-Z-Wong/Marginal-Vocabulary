// 宠物（32×32，正面）

import { lighten, ramp } from './color';
import { INK, WHITE, blush, eye } from './widgets';
import { Pix } from './pix';

// ================= 宠物（32×32，正面） =================
// f：idle / blink / walk1 / walk2 / happy / sleep / sick

/** 画一只宠物：p 画布，f 哪一帧 */
export type PetDraw = (p: Pix, f: string) => void;

/** 猫狗狐兔仓鼠共用的身体：身子颜色、肚子、爪子、头的大小，耳朵、尾巴、脸上的花纹另外画 */
interface ChibiOpt {
  body: string;
  belly?: string;
  paw?: string;
  hw?: number;
  hh?: number;
  tail?: (p: Pix, y0: number) => void;
  ears?: (p: Pix, y0: number) => void;
  face?: (p: Pix, y0: number) => void;
}

interface FishOpt {
  fancy?: boolean;
  fin2?: string;
  fin3?: string;
  spots?: string;
  line?: string;
  shine?: boolean;
}

function eyeKind(f: string): string {
  return f === 'blink' || f === 'sleep' ? 'closed' : f === 'happy' ? 'happy' : f === 'sick' ? 'sick' : 'open';
}
export function bob(f: string): number {
  return f === 'walk1' ? -1 : f === 'happy' ? -2 : 0;
}

// 走路时两只脚交替抬起
function feet(f: string): [number, number] {
  return f === 'walk1' ? [1, 0] : f === 'walk2' ? [0, 1] : [0, 0];
}

// 猫狗狐兔仓鼠共用的身体：大头、小身子、两只脚
function chibi(p: Pix, f: string, o: ChibiOpt): void {
  const y0 = bob(f);
  const [a, b] = feet(f);
  const B = o.body;
  const belly = o.belly || B;
  if (o.tail) o.tail(p, y0);
  p.sEll(16, 24 + y0, 8, 6, B);
  p.ell(16, 25 + y0, 4.5, 4, belly);
  p.sEll(11.5, 29.5 + y0 - a, 2.6, 1.8, o.paw || belly);
  p.sEll(20.5, 29.5 + y0 - b, 2.6, 1.8, o.paw || belly);
  if (o.ears) o.ears(p, y0);
  p.sEll(16, 13 + y0, o.hw || 11, o.hh || 8.5, B);
  if (o.face) o.face(p, y0);
  const k = eyeKind(f);
  eye(p, 10, 12 + y0, k, 3);
  eye(p, 21, 12 + y0, k, 3);
  if (f === 'happy' || f === 'sick') p.rect(15, 18 + y0, 2, 1, f === 'sick' ? INK : '#c0505a');
  blush(p, 7, 16 + y0);
  blush(p, 23, 16 + y0);
}

// 鱼：圆圆的身子、大眼睛、会摆的尾巴
function cuteFish(p: Pix, f: string, body: string, fin: string, o?: FishOpt): void {
  o = o || {};
  const y0 = (f === 'walk1' ? -1 : f === 'happy' ? -2 : 0) + 2;
  const sw = f === 'walk1' ? -2 : f === 'walk2' ? 2 : f === 'happy' ? -3 : 0;
  // 尾巴
  p.poly([[22, 16 + y0], [30, 8 + y0 + sw], [31, 16 + y0], [30, 24 + y0 - sw]], fin);
  if (o.fancy) {
    p.poly([[23, 16 + y0], [31, 5 + y0 + sw], [29, 14 + y0]], o.fin2 || ramp(fin).mid);
    p.poly([[23, 16 + y0], [31, 27 + y0 - sw], [29, 18 + y0]], o.fin3 || ramp(fin).mid);
  }
  // 背鳍和腹鳍
  p.poly([[11, 9 + y0], [18, 5 + y0], [20, 10 + y0]], fin);
  p.poly([[13, 22 + y0], [17, 27 + y0], [19, 22 + y0]], fin);
  p.sEll(14, 16 + y0, 10, 8, body);
  p.ell(13, 19 + y0, 6.5, 3.5, lighten(body, 0.08));
  if (o.spots) {
    p.ell(15, 12 + y0, 3.5, 2.5, o.spots);
    p.ell(20, 17 + y0, 2.2, 2.4, o.spots);
    p.ell(10, 10 + y0, 1.8, 1.4, o.spots);
  }
  if (o.line) p.rect(8, 16 + y0, 13, 1, o.line);
  if (o.shine) for (const [x, y] of [[12, 12], [17, 14], [15, 19]]) p.set(x, y + y0, '#fff1b8');
  // 胸鳍
  p.sEll(15, 19 + y0, 2.2, 1.4, ramp(fin).mid);
  const k = eyeKind(f);
  eye(p, 8, 13 + y0, k, 3);
  if (f === 'happy' || f === 'sick') p.rect(5, 18 + y0, 2, 1, f === 'sick' ? INK : '#c0505a');
  else p.set(5, 18 + y0, ramp(body).lo);
  blush(p, 9, 18 + y0);
}

export const PETS: Record<string, PetDraw> = {
  crab(p, f) {
    const B = '#d97757';
    const R = ramp(B);
    const y0 = 12 + bob(f);
    const [a, b] = feet(f);
    // 腿：每边三条，斜着向外
    for (const [i, x] of [[0, 8], [1, 11], [2, 14]]) {
      const lift = i % 2 ? a : b;
      p.line(x, y0 + 12, x - 2, y0 + 15 - lift, R.lo);
      p.line(31 - x, y0 + 12, 33 - x, y0 + 15 - (i % 2 ? b : a), R.lo);
    }
    // 胳膊和钳子
    const up = f === 'happy' ? 3 : f === 'walk1' ? 1 : 0;
    for (const side of [0, 1]) {
      const sx = (x: number) => (side ? 31 - x : x);
      p.line(sx(6), y0 + 6, sx(3), y0 + 3 - up, R.mid);
      p.line(sx(6), y0 + 7, sx(3), y0 + 4 - up, R.mid);
      p.sEll(side ? 28.5 : 3.5, y0 - 1 - up, 3.6, 3.4, B);
      // 钳口：上面切一个缺口
      p.clear(sx(3), y0 - 4 - up);
      p.clear(sx(4), y0 - 4 - up);
      p.clear(sx(3), y0 - 3 - up);
      p.clear(sx(4), y0 - 3 - up);
      p.set(sx(3), y0 - 2 - up, R.lo);
    }
    // 身体：圆角方块
    p.sRect(6, y0, 20, 12, B, { bottom: 2 });
    for (const [x, y] of [[6, y0], [25, y0], [6, y0 + 11], [25, y0 + 11]]) p.clear(x, y);
    p.rect(7, y0 + 1, 6, 1, R.hi);
    // 眼睛、嘴、腮红
    const k = eyeKind(f);
    eye(p, 11, y0 + 3, k, 4);
    eye(p, 19, y0 + 3, k, 4);
    if (f === 'happy') p.rect(15, y0 + 7, 2, 1, INK);
    if (f === 'sick') p.rect(14, y0 + 8, 4, 1, INK);
    blush(p, 8, y0 + 7);
    blush(p, 22, y0 + 7);
  },

  cat(p, f) {
    const B = '#f0a75a';
    chibi(p, f, {
      body: B,
      belly: '#fff1dc',
      tail(p, y0) {
        p.line(23, 25 + y0, 27, 21 + y0, ramp(B).base);
        p.line(24, 25 + y0, 28, 21 + y0, ramp(B).mid);
        p.line(27, 21 + y0, 27, 16 + y0, ramp(B).base);
        p.line(28, 21 + y0, 28, 16 + y0, ramp(B).mid);
        p.set(27, 15 + y0, ramp(B).lo);
      },
      ears(p, y0) {
        p.poly([[6, 10 + y0], [8, 1 + y0], [14, 6 + y0]], ramp(B).base);
        p.poly([[26, 10 + y0], [24, 1 + y0], [18, 6 + y0]], ramp(B).mid);
        p.poly([[8, 7 + y0], [9, 3.5 + y0], [11.5, 6 + y0]], '#f4a6a0');
        p.poly([[24, 7 + y0], [23, 3.5 + y0], [20.5, 6 + y0]], '#f4a6a0');
      },
      face(p, y0) {
        for (const x of [13, 16, 19]) p.rect(x, 5 + y0, 1, 3, ramp(B).lo);
        p.ell(16, 17 + y0, 4.5, 3, '#fff1dc');
        p.rect(15, 15 + y0, 2, 1, '#e98080');
        for (const [x, y] of [[14, 17], [15, 18], [16, 17], [17, 18], [18, 17]]) p.set(x, y + y0, INK);
      },
    });
  },

  shiba(p, f) {
    const B = '#e39a4f';
    const C = '#fff3e0';
    chibi(p, f, {
      body: B,
      belly: C,
      paw: C,
      tail(p, y0) {
        p.sEll(25, 20 + y0, 3.5, 3.5, B);
        p.ell(25, 20 + y0, 1.5, 1.5, C);
      },
      ears(p, y0) {
        p.poly([[6, 10 + y0], [8, 2 + y0], [14, 6 + y0]], ramp(B).base);
        p.poly([[26, 10 + y0], [24, 2 + y0], [18, 6 + y0]], ramp(B).mid);
        p.poly([[8.5, 7 + y0], [9.2, 4 + y0], [11.5, 6 + y0]], ramp(B).lo);
        p.poly([[23.5, 7 + y0], [22.8, 4 + y0], [20.5, 6 + y0]], ramp(B).lo);
      },
      face(p, y0) {
        p.ell(10.5, 17 + y0, 4.5, 3.4, C);
        p.ell(21.5, 17 + y0, 4.5, 3.4, C);
        p.ell(16, 18 + y0, 4, 2.6, C);
        p.rect(10, 9 + y0, 2, 1, C);
        p.rect(21, 9 + y0, 2, 1, C);
        p.rect(15, 15 + y0, 2, 2, INK);
        p.set(15, 15 + y0, '#6a5a5a');
      },
    });
  },

  fox(p, f) {
    const B = '#e8793a';
    const C = '#fff4e8';
    const D = '#3a2a26';
    chibi(p, f, {
      body: B,
      belly: C,
      paw: D,
      hw: 12,
      tail(p, y0) {
        p.sEll(25.5, 19 + y0, 4.5, 6, B);
        p.ell(26.5, 14.5 + y0, 2.6, 2.4, C);
      },
      ears(p, y0) {
        p.poly([[5, 11 + y0], [6, 0 + y0], [14, 6 + y0]], ramp(B).base);
        p.poly([[27, 11 + y0], [26, 0 + y0], [18, 6 + y0]], ramp(B).mid);
        p.poly([[6, 3 + y0], [6, 0 + y0], [8.5, 1.8 + y0]], D);
        p.poly([[26, 3 + y0], [26, 0 + y0], [23.5, 1.8 + y0]], D);
        p.poly([[7.5, 8 + y0], [8, 4 + y0], [11, 6.5 + y0]], '#f2b8a0');
        p.poly([[24.5, 8 + y0], [24, 4 + y0], [21, 6.5 + y0]], '#f2b8a0');
      },
      face(p, y0) {
        p.poly([[4, 13 + y0], [16, 15 + y0], [16, 21 + y0], [10, 21 + y0]], C);
        p.poly([[28, 13 + y0], [16, 15 + y0], [16, 21 + y0], [22, 21 + y0]], C);
        p.rect(15, 16 + y0, 2, 2, INK);
      },
    });
  },

  rabbit(p, f) {
    const B = '#f1e8dc';
    const P = '#f2a3a0';
    chibi(p, f, {
      body: B,
      belly: '#fffaf2',
      ears(p, y0) {
        const wig = f === 'happy' ? -1 : 0;
        p.sEll(10.5, 4 + y0 + wig, 2.8, 6.5, B);
        p.sEll(21.5, 4 + y0 + wig, 2.8, 6.5, B);
        p.ell(10.5, 4.5 + y0 + wig, 1.2, 4.5, P);
        p.ell(21.5, 4.5 + y0 + wig, 1.2, 4.5, P);
      },
      face(p, y0) {
        p.rect(15, 15 + y0, 2, 1, P);
        p.set(15, 16 + y0, INK);
        p.set(16, 16 + y0, INK);
        p.set(14, 17 + y0, INK);
        p.set(17, 17 + y0, INK);
      },
    });
  },

  hamster(p, f) {
    const B = '#e8b07a';
    const C = '#fff3e0';
    const y0 = bob(f);
    const [a, b] = feet(f);
    p.sEll(9, 6 + y0, 3, 3, B);
    p.sEll(23, 6 + y0, 3, 3, B);
    p.ell(9, 6 + y0, 1.4, 1.4, '#f2a3a0');
    p.ell(23, 6 + y0, 1.4, 1.4, '#f2a3a0');
    p.sEll(16, 18 + y0, 12.5, 11, B);
    p.ell(16, 22 + y0, 9.5, 7.5, C);
    p.sEll(11, 29.5 + y0 - a, 2.4, 1.6, '#f2a3a0');
    p.sEll(21, 29.5 + y0 - b, 2.4, 1.6, '#f2a3a0');
    p.sEll(13, 23 + y0, 1.8, 1.5, '#f2a3a0');
    p.sEll(19, 23 + y0, 1.8, 1.5, '#f2a3a0');
    const k = eyeKind(f);
    eye(p, 10, 14 + y0, k, 3);
    eye(p, 21, 14 + y0, k, 3);
    p.rect(15, 18 + y0, 2, 1, '#e98080');
    blush(p, 6, 19 + y0);
    blush(p, 24, 19 + y0);
  },

  penguin(p, f) {
    const B = '#3e4a63';
    const W = '#fbf7ef';
    const O = '#f0a23a';
    const y0 = bob(f);
    const [a, b] = feet(f);
    const flap = f === 'happy' ? -3 : f === 'walk1' ? -1 : 0;
    p.sEll(5.5, 19 + y0 + flap, 2.5, 5.5, B);
    p.sEll(26.5, 19 + y0 + flap, 2.5, 5.5, B);
    p.sEll(16, 17 + y0, 10.5, 12.5, B);
    p.ell(16, 21 + y0, 7, 8.5, W);
    p.ell(12, 11 + y0, 3.8, 3.4, W);
    p.ell(20, 11 + y0, 3.8, 3.4, W);
    p.ell(16, 13 + y0, 5, 3, W);
    p.rect(10, 29 + y0 - a, 5, 2, O);
    p.rect(17, 29 + y0 - b, 5, 2, O);
    const k = eyeKind(f);
    eye(p, 11, 10 + y0, k, 3);
    eye(p, 20, 10 + y0, k, 3);
    p.poly([[13.5, 14 + y0], [18.5, 14 + y0], [16, 17 + y0]], O);
    blush(p, 8, 15 + y0);
    blush(p, 22, 15 + y0);
  },

  duck(p, f) {
    const B = '#f6d35b';
    const O = '#f08a3a';
    const y0 = bob(f);
    const [a, b] = feet(f);
    p.rect(10, 29 + y0 - a, 5, 2, O);
    p.rect(17, 29 + y0 - b, 5, 2, O);
    p.sEll(16, 22 + y0, 11, 7.5, B);
    p.sEll(24, 21 + y0 + (f === 'happy' ? -2 : 0), 4, 3, ramp(B).mid);
    p.sEll(16, 11 + y0, 8, 7.5, B);
    p.rect(15, 2 + y0, 2, 2, B);
    p.set(17, 2 + y0, B);
    const k = eyeKind(f);
    eye(p, 11, 9 + y0, k, 3);
    eye(p, 20, 9 + y0, k, 3);
    p.sEll(16, 14.5 + y0, 4, 1.8, O);
    blush(p, 8, 13 + y0);
    blush(p, 22, 13 + y0);
  },

  frog(p, f) {
    const B = '#7cb46b';
    const L = '#d9eab0';
    const y0 = bob(f);
    const [a, b] = feet(f);
    p.sEll(8, 28.5 + y0 - a, 4, 2.2, B);
    p.sEll(24, 28.5 + y0 - b, 4, 2.2, B);
    p.sEll(16, 20 + y0, 13, 9, B);
    p.ell(16, 24 + y0, 8.5, 4.5, L);
    p.sEll(9.5, 10.5 + y0, 5, 4.6, B);
    p.sEll(22.5, 10.5 + y0, 5, 4.6, B);
    p.ell(9.5, 10.5 + y0, 3.2, 3, WHITE);
    p.ell(22.5, 10.5 + y0, 3.2, 3, WHITE);
    const k = eyeKind(f);
    if (k === 'open') {
      p.rect(9, 10 + y0, 2, 2, INK);
      p.rect(22, 10 + y0, 2, 2, INK);
      p.set(9, 10 + y0, WHITE);
      p.set(22, 10 + y0, WHITE);
    } else {
      eye(p, 9, 9 + y0, k, 3);
      eye(p, 22, 9 + y0, k, 3);
    }
    for (let x = 11; x <= 20; x++) p.set(x, 19 + y0 + (x === 11 || x === 20 ? -1 : 0), ramp(B).lo);
    blush(p, 6, 17 + y0);
    blush(p, 24, 17 + y0);
  },

  piglet(p, f) {
    const B = '#f4b0aa';
    const D = '#e08a86';
    chibi(p, f, {
      body: B,
      belly: '#fbd3cf',
      paw: D,
      tail(p, y0) {
        p.line(23, 24 + y0, 25, 22 + y0, D);
        p.line(25, 22 + y0, 26, 24 + y0, D);
        p.set(27, 23 + y0, D);
      },
      ears(p, y0) {
        p.poly([[6, 9 + y0], [7, 2 + y0], [13, 6 + y0]], ramp(B).base);
        p.poly([[26, 9 + y0], [25, 2 + y0], [19, 6 + y0]], ramp(B).mid);
        p.poly([[8, 7 + y0], [8.5, 4 + y0], [11, 6 + y0]], D);
        p.poly([[24, 7 + y0], [23.5, 4 + y0], [21, 6 + y0]], D);
      },
      face(p, y0) {
        p.sEll(16, 17 + y0, 3.8, 2.6, '#f29a94');
        p.rect(14, 17 + y0, 1, 1, '#a8524e');
        p.rect(17, 17 + y0, 1, 1, '#a8524e');
      },
    });
  },

  lamb(p, f) {
    const W = '#f6f0e4';
    const F = '#f3d8bc';
    chibi(p, f, {
      body: W,
      belly: '#fffaf2',
      paw: '#8a7a6a',
      ears(p, y0) {
        p.sEll(5, 12 + y0, 3.6, 2, '#e8cfb2');
        p.sEll(27, 12 + y0, 3.6, 2, '#e8cfb2');
      },
      face(p, y0) {
        // 一圈卷卷的羊毛，中间是脸
        for (const [x, y] of [[8, 6], [12, 4], [16, 3.5], [20, 4], [24, 6], [6, 10], [26, 10]]) p.sEll(x, y + y0, 3, 2.8, W);
        p.sEll(16, 14 + y0, 7.5, 6, F);
        p.rect(15, 17 + y0, 2, 1, '#c8806a');
        p.set(15, 18 + y0, '#a86a5a');
        p.set(16, 18 + y0, '#a86a5a');
      },
    });
  },

  corgi(p, f) {
    const B = '#e9974e';
    const C = '#fff4e6';
    chibi(p, f, {
      body: B,
      belly: C,
      paw: C,
      tail(p, y0) {
        p.sEll(25, 23 + y0, 2.6, 2.2, B);
      },
      ears(p, y0) {
        p.poly([[5, 9 + y0], [6, -1 + y0], [13, 5 + y0]], ramp(B).base);
        p.poly([[27, 9 + y0], [26, -1 + y0], [19, 5 + y0]], ramp(B).mid);
        p.poly([[7, 7 + y0], [7.5, 2 + y0], [11, 5.5 + y0]], '#f4b0a0');
        p.poly([[25, 7 + y0], [24.5, 2 + y0], [21, 5.5 + y0]], '#f4b0a0');
      },
      face(p, y0) {
        p.rect(15, 5 + y0, 2, 7, C);
        p.ell(16, 17 + y0, 6, 3.6, C);
        p.ell(16, 12 + y0, 2.5, 2, C);
        p.rect(15, 15 + y0, 2, 2, INK);
        p.set(15, 15 + y0, '#6a5a5a');
      },
    });
  },

  hedgehog(p, f) {
    const S = '#7a5a3e';
    const T = '#c4a07a';
    const F = '#f2dcc0';
    const y0 = bob(f);
    const [a, b] = feet(f);
    // 背上的刺：一个圆顶，边上一圈短短的尖，尖上发白
    p.sEll(16, 17 + y0, 13, 12, S);
    for (let k = 0; k <= 16; k++) {
      const t = Math.PI * (1 + k / 16);
      const x = 16 + Math.cos(t) * 12.5;
      const y = 17 + y0 + Math.sin(t) * 11.5;
      const x2 = 16 + Math.cos(t) * 15;
      const y2 = 17 + y0 + Math.sin(t) * 14;
      p.poly([[x - 1.5, y + 0.5], [x + 1.5, y + 0.5], [x2, y2]], k % 2 ? S : ramp(S).mid);
      p.set(Math.round(x2), Math.round(y2), T);
    }
    // 刺上的纹理：一排排浅色的小短线
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 9; k++) {
        const x = 6 + k * 2.5 + (row % 2) * 1.2;
        const y = 8 + row * 3 + y0 + Math.abs(k - 4) * 0.6;
        p.set(Math.round(x), Math.round(y), T);
        p.set(Math.round(x), Math.round(y) + 1, ramp(S).lo);
      }
    // 脸和肚子
    p.sEll(16, 22 + y0, 9.5, 8, F);
    p.sEll(11.5, 29.5 + y0 - a, 2.4, 1.6, '#c8a07a');
    p.sEll(20.5, 29.5 + y0 - b, 2.4, 1.6, '#c8a07a');
    p.sEll(8, 13 + y0, 2.2, 2, '#e8c8a8');
    p.sEll(24, 13 + y0, 2.2, 2, '#e8c8a8');
    const k = eyeKind(f);
    eye(p, 11, 18 + y0, k, 3);
    eye(p, 20, 18 + y0, k, 3);
    p.sEll(16, 23 + y0, 1.8, 1.3, INK);
    if (f === 'happy') p.rect(15, 26 + y0, 2, 1, '#c0505a');
    blush(p, 8, 23 + y0);
    blush(p, 22, 23 + y0);
  },

  squirrel(p, f) {
    const B = '#c97a3e';
    const C = '#f6e3c8';
    chibi(p, f, {
      body: B,
      belly: C,
      tail(p, y0) {
        const up = f === 'happy' ? -2 : 0;
        p.sEll(26, 15 + y0 + up, 5.5, 9, B);
        p.sEll(27, 10 + y0 + up, 3.5, 4.5, ramp(B).hi);
        p.ell(29, 16 + y0 + up, 1.5, 6, ramp(B).mid);
      },
      ears(p, y0) {
        p.poly([[7, 9 + y0], [8, 1 + y0], [13, 6 + y0]], ramp(B).base);
        p.poly([[25, 9 + y0], [24, 1 + y0], [19, 6 + y0]], ramp(B).mid);
        p.set(8, 0 + y0, ramp(B).lo);
        p.set(24, 0 + y0, ramp(B).lo);
      },
      face(p, y0) {
        p.ell(10.5, 17 + y0, 3.8, 3, C);
        p.ell(21.5, 17 + y0, 3.8, 3, C);
        p.rect(15, 16 + y0, 2, 1, '#6a3a2a');
        p.set(15, 18 + y0, '#fbf7ef');
        p.set(16, 18 + y0, '#fbf7ef');
      },
    });
  },

  owl(p, f) {
    const B = '#9a7556';
    const L = '#e8d4b4';
    const y0 = bob(f);
    const [a, b] = feet(f);
    const flap = f === 'happy' ? -3 : 0;
    p.sEll(5, 20 + y0 + flap, 3, 7, ramp(B).mid);
    p.sEll(27, 20 + y0 + flap, 3, 7, ramp(B).mid);
    p.sEll(16, 18 + y0, 11.5, 12.5, B);
    // 耳羽
    p.poly([[6, 9 + y0], [7, 2 + y0], [11, 7 + y0]], B);
    p.poly([[26, 9 + y0], [25, 2 + y0], [21, 7 + y0]], B);
    p.ell(16, 24 + y0, 7, 6, L);
    for (const [x, y] of [[13, 21], [17, 21], [15, 24], [19, 24], [12, 25], [16, 27]]) {
      p.set(x, y + y0, ramp(L).lo);
      p.set(x + 1, y + 1 + y0, ramp(L).lo);
      p.set(x - 1, y + 1 + y0, ramp(L).lo);
    }
    // 大眼圈
    p.sEll(10.5, 12.5 + y0, 5, 4.8, '#f6ecd8');
    p.sEll(21.5, 12.5 + y0, 5, 4.8, '#f6ecd8');
    const k = eyeKind(f);
    if (k === 'open') {
      p.ell(10.5, 12.5 + y0, 2.4, 2.4, '#f2a23a');
      p.ell(21.5, 12.5 + y0, 2.4, 2.4, '#f2a23a');
      p.rect(10, 12 + y0, 2, 2, INK);
      p.rect(21, 12 + y0, 2, 2, INK);
      p.set(10, 12 + y0, WHITE);
      p.set(21, 12 + y0, WHITE);
    } else {
      eye(p, 10, 11 + y0, k, 3);
      eye(p, 21, 11 + y0, k, 3);
    }
    p.poly([[14.5, 15 + y0], [17.5, 15 + y0], [16, 18.5 + y0]], '#f2a23a');
    p.rect(11, 30 + y0 - a, 4, 1, '#f2a23a');
    p.rect(17, 30 + y0 - b, 4, 1, '#f2a23a');
  },

  otter(p, f) {
    const B = '#8a6248';
    const C = '#ecd6ba';
    chibi(p, f, {
      body: B,
      belly: C,
      paw: ramp(B).lo,
      tail(p, y0) {
        p.sEll(26, 25 + y0, 4.5, 2.2, ramp(B).mid);
      },
      ears(p, y0) {
        p.sEll(6.5, 8 + y0, 2.4, 2.2, B);
        p.sEll(25.5, 8 + y0, 2.4, 2.2, B);
      },
      face(p, y0) {
        p.ell(16, 17 + y0, 6.5, 4, C);
        p.ell(16, 15.5 + y0, 2.2, 1.4, '#4a2e22');
        for (const [x, y] of [[11, 17], [11, 19], [21, 17], [21, 19]]) p.set(x, y + y0, ramp(C).lo);
        p.set(16, 17 + y0, '#4a2e22');
      },
    });
  },

  raccoon(p, f) {
    const B = '#9a9aa2';
    const W = '#f0eee8';
    const M = '#3e3e46';
    chibi(p, f, {
      body: B,
      belly: '#dcdad4',
      paw: M,
      tail(p, y0) {
        p.sEll(25.5, 19 + y0, 3.5, 7, B);
        for (const y of [14, 18, 22]) p.rect(23, y + y0, 6, 2, M);
      },
      ears(p, y0) {
        p.poly([[6, 9 + y0], [7, 2 + y0], [13, 6 + y0]], ramp(B).base);
        p.poly([[26, 9 + y0], [25, 2 + y0], [19, 6 + y0]], ramp(B).mid);
        p.poly([[8, 7 + y0], [8.5, 4 + y0], [11, 6 + y0]], W);
        p.poly([[24, 7 + y0], [23.5, 4 + y0], [21, 6 + y0]], W);
      },
      face(p, y0) {
        p.ell(16, 17 + y0, 6, 3.6, W);
        p.rect(8, 9 + y0, 5, 1, W);
        p.rect(19, 9 + y0, 5, 1, W);
        // 眼罩
        p.ell(10.5, 13.5 + y0, 4, 2.6, M);
        p.ell(21.5, 13.5 + y0, 4, 2.6, M);
        p.ell(11, 13.5 + y0, 2, 2, '#62626c');
        p.ell(22, 13.5 + y0, 2, 2, '#62626c');
        p.rect(15, 15 + y0, 2, 2, INK);
      },
    });
  },

  koala(p, f) {
    const B = '#a8acb6';
    const W = '#eceef2';
    chibi(p, f, {
      body: B,
      belly: W,
      paw: ramp(B).mid,
      ears(p, y0) {
        p.sEll(5.5, 8 + y0, 5, 5, B);
        p.sEll(26.5, 8 + y0, 5, 5, B);
        p.ell(5.5, 8.5 + y0, 2.8, 2.8, W);
        p.ell(26.5, 8.5 + y0, 2.8, 2.8, W);
      },
      face(p, y0) {
        p.sEll(16, 16.5 + y0, 2.8, 3.4, '#3a3a44');
        p.set(15, 15 + y0, '#6a6a76');
      },
    });
  },

  redpanda(p, f) {
    const B = '#d0663a';
    const D = '#4a2a22';
    const W = '#fbf2e6';
    chibi(p, f, {
      body: B,
      belly: D,
      paw: D,
      hw: 11.5,
      tail(p, y0) {
        p.sEll(26, 19 + y0, 4, 7.5, B);
        for (const y of [15, 19, 23]) p.rect(23, y + y0, 7, 2, ramp(B).lo);
      },
      ears(p, y0) {
        p.poly([[5, 10 + y0], [6, 2 + y0], [13, 6 + y0]], ramp(B).base);
        p.poly([[27, 10 + y0], [26, 2 + y0], [19, 6 + y0]], ramp(B).mid);
        p.poly([[7, 8 + y0], [7.5, 4 + y0], [11, 6.5 + y0]], W);
        p.poly([[25, 8 + y0], [24.5, 4 + y0], [21, 6.5 + y0]], W);
      },
      face(p, y0) {
        p.ell(9.5, 17 + y0, 4, 3.2, W);
        p.ell(22.5, 17 + y0, 4, 3.2, W);
        p.ell(16, 18 + y0, 3.6, 2.4, W);
        p.rect(9, 9 + y0, 3, 1, W);
        p.rect(20, 9 + y0, 3, 1, W);
        p.rect(15, 16 + y0, 2, 2, INK);
        p.rect(10, 14 + y0, 1, 3, ramp(B).lo);
        p.rect(21, 14 + y0, 1, 3, ramp(B).lo);
      },
    });
  },

  panda(p, f) {
    const W = '#f6f4ee';
    const K = '#2e2e36';
    chibi(p, f, {
      body: W,
      belly: '#fffdf8',
      paw: K,
      ears(p, y0) {
        p.sEll(6, 6 + y0, 3.6, 3.4, K);
        p.sEll(26, 6 + y0, 3.6, 3.4, K);
      },
      face(p, y0) {
        // 黑眼圈：斜一点的椭圆，里面浅一点好看清眼睛
        p.poly([[7, 14 + y0], [9, 10 + y0], [14, 11 + y0], [13, 16 + y0], [9, 17 + y0]], K);
        p.poly([[25, 14 + y0], [23, 10 + y0], [18, 11 + y0], [19, 16 + y0], [23, 17 + y0]], K);
        p.ell(11, 13.5 + y0, 1.8, 2.2, '#5c5c68');
        p.ell(22, 13.5 + y0, 1.8, 2.2, '#5c5c68');
        p.sEll(16, 17 + y0, 1.8, 1.2, K);
        p.rect(15, 19 + y0, 2, 1, '#8a8a92');
        // 肩膀上一圈黑
        p.ell(16, 22 + y0, 9, 2, K);
      },
    });
  },

  chick(p, f) {
    const Y = '#f8d54a';
    const O = '#f2902e';
    const y0 = bob(f);
    const [a, b] = feet(f);
    const flap = f === 'happy' ? -3 : f === 'walk1' ? -1 : 0;
    p.rect(11, 29 + y0 - a, 3, 2, O);
    p.rect(18, 29 + y0 - b, 3, 2, O);
    p.sEll(6.5, 20 + y0 + flap, 3, 4, ramp(Y).mid);
    p.sEll(25.5, 20 + y0 + flap, 3, 4, ramp(Y).mid);
    p.sEll(16, 19 + y0, 10.5, 10, Y);
    p.ell(16, 23 + y0, 6, 4.5, lighten(Y, 0.1));
    for (const [x, y] of [[15, 7], [16, 6], [17, 7], [16, 8]]) p.set(x, y + y0, Y);
    p.set(14, 6 + y0, ramp(Y).mid);
    const k = eyeKind(f);
    eye(p, 11, 14 + y0, k, 3);
    eye(p, 20, 14 + y0, k, 3);
    p.poly([[14, 18 + y0], [18, 18 + y0], [16, 20.5 + y0]], O);
    p.rect(14, 17 + y0, 4, 1, ramp(O).hi);
    blush(p, 8, 18 + y0);
    blush(p, 22, 18 + y0);
  },

  // 鱼（侧面，给商店和「我的宠物」用）
  medaka(p, f) {
    cuteFish(p, f, '#d8c68a', '#c8b070', { line: '#7aa0c0' });
  },
  goldfish(p, f) {
    cuteFish(p, f, '#f0742e', '#f6b07a', { fancy: true });
  },
  guppy(p, f) {
    cuteFish(p, f, '#a8bccf', '#e85d75', { fancy: true, fin2: '#9b7fd1', fin3: '#5ab0e0' });
  },
  koi(p, f) {
    cuteFish(p, f, '#f8f4ec', '#f2e6dc', { spots: '#d8452e' });
  },
  goldkoi(p, f) {
    cuteFish(p, f, '#f2c14e', '#f7dc85', { shine: true });
  },
};
