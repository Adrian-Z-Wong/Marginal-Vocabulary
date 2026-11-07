// 物品图标（16×16）和外圈树林用的树

import { ramp } from './color';
import { Pix, build } from './pix';
import { canopy, drawTree, forestCacheSpecs } from './plants';
import { INK } from './widgets';

// ================= 物品图标（16×16） =================

export const ICONS: Record<string, (p: Pix, c?: string) => void> = {
  kibble(p) {
    p.sEll(8, 11.5, 6.5, 3, '#c8463a');
    p.ell(8, 10, 5.5, 1.8, '#8a5a3b');
    for (const [x, y] of [[5, 9], [7, 8], [9, 9], [11, 8], [6, 10], [10, 10], [8, 9]]) {
      p.set(x, y, '#c08850');
      p.set(x + 1, y, '#a06a3a');
    }
    p.rect(3, 12, 10, 1, ramp('#c8463a').lo);
  },
  tin(p) {
    p.sRect(4, 5, 9, 9, '#c0c6cc');
    p.rect(4, 7, 9, 4, '#e8793a');
    p.sEll(8.5, 9, 2, 1.5, '#fbf7ef');
    p.set(8, 9, '#e85d75');
    p.sEll(8.5, 5, 4.5, 1.6, '#dfe4e8');
    p.rect(6, 4, 4, 1, '#9aa2aa');
  },
  fishfood(p) {
    p.sRect(4, 3, 8, 11, '#5aa2dc');
    p.rect(4, 3, 8, 2, '#3a74b0');
    p.sEll(8, 9, 2.6, 1.6, '#f0742e');
    p.poly([[10, 9], [12, 7.5], [12, 10.5]], '#f0742e');
    p.set(7, 9, INK);
    for (const [x, y] of [[13, 13], [14, 11], [13, 15]]) p.set(x, y, '#e0b050');
  },
  water(p) {
    p.poly([[8, 1], [3, 9], [13, 9]], '#5a9ad0');
    p.sEll(8, 10, 5, 4.5, '#5a9ad0');
    p.rect(6, 7, 2, 3, '#d8f0ff');
  },
  can(p) {
    p.sRect(3, 6, 9, 8, '#7a9ab8');
    p.line(12, 8, 15, 4, '#7a9ab8');
    p.line(12, 9, 15, 5, ramp('#7a9ab8').mid);
    p.rect(4, 3, 7, 1, '#5a7a98');
    p.rect(4, 3, 1, 4, '#5a7a98');
    p.rect(10, 3, 1, 4, '#5a7a98');
  },
  fert(p) {
    p.sRect(3, 4, 10, 11, '#c49a6c');
    p.rect(3, 3, 10, 2, ramp('#c49a6c').lo);
    p.sEll(8, 9.5, 3, 3, '#6aa35a');
    p.rect(8, 7, 1, 4, '#4f8a43');
  },
  medicine(p) {
    p.sRect(4, 5, 8, 10, '#fbf7ef');
    p.sRect(5, 2, 6, 3, '#c8463a');
    p.rect(7, 8, 2, 5, '#e85d75');
    p.rect(5, 10, 6, 1, '#e85d75');
  },
  ball(p) {
    p.sEll(8, 8.5, 6, 6, '#e85d75');
    p.rect(2, 8, 12, 1, '#fbf7ef');
    p.rect(8, 3, 1, 11, '#f6d35b');
  },
  yarn(p) {
    p.sEll(8, 9, 6, 5.5, '#9b7fd1');
    for (let k = 4; k < 13; k += 3) p.line(k, 5, k + 3, 13, ramp('#9b7fd1').lo);
    p.line(13, 11, 15, 15, '#9b7fd1');
  },
  bone(p) {
    p.sRect(4, 7, 8, 3, '#f4ece0');
    for (const [x, y] of [[3, 6], [3, 10], [12, 6], [12, 10]]) p.sEll(x + 0.5, y + 0.5, 2, 2, '#f4ece0');
  },
  fishtoy(p) {
    p.sEll(7, 8.5, 5, 3.5, '#5a9ad0');
    p.poly([[11, 8.5], [15, 5], [15, 12]], '#5a9ad0');
    p.set(4, 7, INK);
    p.rect(6, 6, 2, 1, '#d8f0ff');
  },
  treat(p) {
    p.sEll(8, 9, 6, 5, '#d8a060');
    for (const [x, y] of [[6, 7], [10, 8], [7, 11]]) p.set(x, y, '#6b4a2b');
  },
  seed(p, c) {
    p.sRect(3, 2, 10, 13, '#efe4cc');
    p.rect(3, 2, 10, 2, ramp('#efe4cc').mid);
    p.sEll(8, 9, 3, 3, c || '#e85d75');
    p.set(8, 9, '#f6d35b');
    p.rect(8, 12, 1, 2, '#4f8a43');
  },
  // 体力：一道闪电
  bolt(p) {
    p.poly([[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6], [11, 1]], '#f2c14e');
    p.line(9, 2, 5, 8, '#fff2a8');
  },
  // 材料：一捆木头、一堆石块
  wood(p) {
    const W = '#a8713f';
    for (const [y, x0, x1] of [[10, 2, 12], [6, 4, 14]]) {
      p.sRect(x0, y, x1 - x0, 4, W, { noHi: true });
      p.rect(x0 + 1, y, x1 - x0 - 2, 1, ramp(W).hi);
      p.sEll(x1, y + 2, 1.9, 1.9, '#d9b07a');
      p.set(x1, y + 2, '#a8763e');
    }
    p.rect(7, 6, 1, 8, '#6a4630');
  },
  stone(p) {
    p.sEll(5.5, 10.5, 4, 3, '#a39d94');
    p.sEll(11, 11, 3.6, 2.8, '#948e86');
    p.sEll(8.5, 6.5, 3.4, 2.8, '#b0aaa0');
    p.set(7, 5, '#e4e0d8');
    p.set(4, 9, '#d4d0c8');
  },
  scythe(p) {
    // 长木柄，顶上一把往左弯的刀，柄中间一个握把
    p.line(12, 15, 10, 3, '#8a5a3b');
    p.line(13, 15, 11, 3, ramp('#8a5a3b').lo);
    p.rect(9, 9, 5, 2, '#6a4630');
    for (const [x, y] of [[10, 2], [9, 2], [8, 2], [7, 2], [6, 3], [5, 3], [4, 4], [3, 5], [2, 6], [1, 8]]) p.set(x, y, '#dfe6ec');
    for (const [x, y] of [[9, 3], [8, 3], [7, 3], [6, 4], [5, 4], [4, 5], [3, 6], [2, 7]]) p.set(x, y, '#9aa4ae');
    p.set(10, 3, '#5a5f66');
  },
  pickaxe(p) {
    p.line(4, 15, 10, 4, '#8a5a3b');
    p.line(5, 15, 11, 4, ramp('#8a5a3b').lo);
    // 两头尖的镐头
    for (let i = 0; i < 6; i++) {
      p.set(10 - i, 3 + Math.floor(i / 2), '#a8b0b8');
      p.set(10 + i, 3 + Math.floor(i / 2), '#a8b0b8');
    }
    p.rect(8, 2, 5, 2, '#c8d0d8');
  },
  axe(p) {
    p.line(4, 15, 10, 3, '#8a5a3b');
    p.line(5, 15, 11, 3, ramp('#8a5a3b').lo);
    p.poly([[9, 2], [14, 1], [15, 6], [11, 7]], '#a8b0b8');
    p.line(14, 1, 15, 6, '#d8dee4');
  },
  hoe(p) {
    p.line(2, 14, 10, 4, '#8a5a3b');
    p.line(3, 14, 11, 4, ramp('#8a5a3b').lo);
    p.poly([[8, 2], [14, 2], [15, 5], [13, 7], [11, 5]], '#a8b0b8');
    p.line(9, 2, 13, 2, '#d8dee4');
  },
  shovel(p) {
    p.line(3, 13, 10, 6, '#8a5a3b');
    p.line(4, 13, 11, 6, ramp('#8a5a3b').lo);
    p.poly([[9, 4], [13, 1], [15, 3], [12, 7]], '#a8b0b8');
  },
  hand(p) {
    p.sEll(8, 10, 4.5, 4.5, '#f3c9a5');
    for (const x of [4, 6, 8, 10]) p.sRect(x, 3 + (x === 4 || x === 10 ? 2 : 0), 2, 6, '#f3c9a5', { noHi: true });
  },
  bag(p) {
    p.sRect(2, 5, 12, 10, '#b07a4a');
    p.rect(2, 8, 12, 1, ramp('#b07a4a').lo);
    p.sRect(6, 7, 4, 3, '#f2c14e');
    p.line(4, 5, 6, 1, '#8a5a3b');
    p.line(12, 5, 10, 1, '#8a5a3b');
    p.rect(6, 1, 5, 1, '#8a5a3b');
  },
  coin(p) {
    p.sEll(8, 8, 6, 6, '#f2c14e');
    p.ell(8, 8, 3.5, 3.5, ramp('#f2c14e').mid);
    p.rect(7, 5, 2, 6, ramp('#f2c14e').hi);
  },
};

// 外圈树林用的树：和花园里种的树不一样，颜色更沉，不带果子
const forestCache = new Map<string, Pix>();
export function forestTree(kind: string): Pix {
  if (forestCache.has(kind)) return forestCache.get(kind)!;
  const q = kind === 'bush'
    ? build(16, 16, (p) => canopy(p, [[8, 10, 7, 5.5], [5, 7, 4, 4], [11, 6, 4.5, 4]], '#3f7d3c'))
    : build(48, 72, (p) => drawTree(p, forestCacheSpecs[kind] || forestCacheSpecs.round, 1.5));
  forestCache.set(kind, q);
  return q;
}
