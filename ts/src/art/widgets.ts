// 小部件：眼睛、腮红

import { Pix } from './pix';

// ================= 小部件 =================

export const INK = '#2a1d1a';
export const WHITE = '#fffaf2';

// 大眼睛：黑眼珠带两个高光（kind: open / closed / happy / sick）
export function eye(p: Pix, x: number, y: number, kind: string, h?: number): void {
  h = h || 3;
  if (kind === 'closed') {
    p.rect(x - 1, y + h - 2, 3, 1, INK);
    return;
  }
  if (kind === 'happy') {
    p.set(x - 1, y + 1, INK);
    p.set(x, y, INK);
    p.set(x + 1, y + 1, INK);
    return;
  }
  if (kind === 'sick') {
    p.rect(x - 1, y + 1, 3, 1, INK);
    p.rect(x, y + 2, 1, 1, INK);
    return;
  }
  p.rect(x, y, 2, h, INK);
  p.set(x, y, WHITE);
  // 眼睛下面一点反光，看起来水汪汪的
  if (h >= 3) p.set(x + 1, y + h - 1, '#5d5470');
}
export function blush(p: Pix, x: number, y: number, c?: string): void {
  p.rect(x, y, 2, 1, c || '#f2a0a0');
}
