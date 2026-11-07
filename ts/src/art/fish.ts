// 池塘里的鱼（从上往下看）

import { desat, lighten, mix } from './color';
import { Pix, Sprite, cached } from './pix';
import { INK } from './widgets';

// ================= 池塘里的鱼（从上往下看） =================
interface FishLook {
  body: string;
  fin: string;
  fin2?: string;
  spots: string | null;
  fancy?: boolean;
  shine?: boolean;
}

const FISH_LOOK: Record<string, FishLook> = {
  medaka: { body: '#d8c68a', fin: '#c8b070', spots: null },
  goldfish: { body: '#f0742e', fin: '#f6b07a', spots: null, fancy: true },
  guppy: { body: '#9ab0c8', fin: '#e85d75', fin2: '#9b7fd1', spots: null, fancy: true },
  koi: { body: '#f8f4ec', fin: '#f2e6dc', spots: '#d8452e' },
  goldkoi: { body: '#f2c14e', fin: '#f7dc85', spots: null, shine: true },
};
function fishTopDraw(p: Pix, sp: string, frame: number): void {
  const L = FISH_LOOK[sp] || FISH_LOOK.goldfish;
  const sw = frame ? 1 : -1;
  // 尾巴
  p.poly([[11, 5], [15, 2 + sw], [15, 8 + sw]], L.fin);
  if (L.fancy) p.poly([[12, 5], [16, 1 + sw], [16, 9 + sw]], L.fin2 || L.fin);
  // 身子
  p.sEll(7, 5, 5, 2.6, L.body);
  p.ell(7, 4.3, 3.5, 1, lighten(L.body, 0.08));
  // 胸鳍
  p.set(6, 2 + (frame ? 0 : 1), L.fin);
  p.set(6, 8 - (frame ? 0 : 1), L.fin);
  if (L.spots) {
    p.ell(6, 4.5, 1.6, 1.4, L.spots);
    p.set(9, 5, L.spots);
    p.set(10, 4, L.spots);
  }
  if (L.shine) {
    p.set(5, 4, '#fff1b8');
    p.set(8, 4, '#fff1b8');
  }
  p.set(3, 4, INK);
  p.set(3, 6, INK);
}
export function fishTop(sp: string, frame: number, sick?: boolean): Sprite {
  return cached('fishtop:' + sp + ':' + frame + ':' + (sick ? 1 : 0), () => {
    const p = new Pix(17, 11);
    fishTopDraw(p, sp, frame);
    p.outline();
    if (sick) p.recolor((c) => mix(desat(c, 0.5), '#9fbf8f', 0.15));
    return p;
  });
}
