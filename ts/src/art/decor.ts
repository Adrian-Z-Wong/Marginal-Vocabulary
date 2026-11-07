// 装饰和家具、房子

import { lighten, mix, ramp } from './color';
import { canopy } from './plants';
import { Pix } from './pix';

// ================= 装饰和家具 =================
// 每件：w×h 像素，占 tw×th 个格子（放置时按底部对齐）

/** 一件装饰或家具：w×h 像素，占 tw×th 格；room 能摆在屋里，wall 挂在墙上，flat 平铺在地上（人可以走上去） */
export interface DecorSpec {
  w: number;
  h: number;
  tw: number;
  th: number;
  room?: boolean;
  wall?: boolean;
  flat?: boolean;
  draw(p: Pix): void;
}

/** 窗户：trim 窗框，shutter 百叶，arch 拱顶，door 落地的门，box 花箱 */
interface WindowOpt {
  trim?: string;
  shutter?: string;
  arch?: boolean;
  door?: boolean;
  box?: boolean;
}

/** 房顶：这一点在不在房顶里 */
type InRoof = (x: number, y: number) => boolean;

// ---------- 画房子用的几样东西 ----------
function bStone(p: Pix, x0: number, y0: number, w: number, h: number, c: string, brick?: boolean): void {
  const R = ramp(c);
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const row = Math.floor((y - y0) / 4);
      const off = row % 2 ? (brick ? 3 : 5) : 0;
      const bw = brick ? 6 : 10;
      let col = c;
      if ((y - y0) % 4 === 3) col = R.lo;
      else if ((x - x0 + off) % bw === 0) col = R.lo;
      else if ((y - y0) % 4 === 0) col = R.hi;
      p.set(x, y, col);
    }
}
function bLogs(p: Pix, x0: number, y0: number, w: number, h: number, c: string): void {
  const R = ramp(c);
  for (let y = y0; y < y0 + h; y++) {
    const k = (y - y0) % 6;
    p.rect(x0, y, w, 1, k === 0 ? R.hi : k === 5 ? R.lo : k === 4 ? R.mid : c);
  }
  // 两头的原木截面
  for (let y = y0; y < y0 + h; y += 6) {
    for (const x of [x0 - 2, x0 + w - 4]) {
      p.ell(x + 3, y + 3, 3, 3, '#c9a070');
      p.ell(x + 3, y + 3, 1.6, 1.6, '#a87e52');
      p.set(x + 3, y + 3, '#8a6440');
    }
  }
  for (let y = y0 + 2; y < y0 + h; y += 6) for (let x = x0 + 8 + ((y / 6) % 3) * 9; x < x0 + w - 6; x += 27) p.rect(x, y, 4, 1, R.mid);
}
function bPlanks(p: Pix, x0: number, y0: number, w: number, h: number, c: string): void {
  const R = ramp(c);
  for (let y = y0; y < y0 + h; y++) {
    const k = (y - y0) % 5;
    p.rect(x0, y, w, 1, k === 0 ? R.hi : k === 4 ? R.mid : c);
  }
}
function bPlaster(p: Pix, x0: number, y0: number, w: number, h: number, c: string): void {
  const R = ramp(c);
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      p.set(x, y, n % 23 === 0 ? R.mid : n % 31 === 0 ? R.hi : c);
    }
}
// 瓦片：一排排，排与排之间错开
function bShingles(p: Pix, inRoof: InRoof, top: number, eave: number, c: string, rowH: number, off: number): void {
  const R = ramp(c);
  for (let y = top; y < eave; y++)
    for (let x = -2; x < p.w + 2; x++) {
      if (!inRoof(x, y)) continue;
      const row = Math.floor((y - top) / rowH);
      const ry = (y - top) % rowH;
      const tab = (x + (row % 2 ? Math.floor(rowH * 0.8) : 0) + off) % (rowH * 2);
      let col = c;
      if (ry === rowH - 1) col = R.lo;
      else if (tab === 0) col = R.mid;
      else if (ry === 0 && tab < rowH) col = R.hi;
      p.set(x, y, col);
    }
}
// 陶土瓦：一条条竖着的弧
function bTiles(p: Pix, inRoof: InRoof, top: number, eave: number, c: string): void {
  const R = ramp(c);
  for (let y = top; y < eave; y++)
    for (let x = -2; x < p.w + 2; x++) {
      if (!inRoof(x, y)) continue;
      const u = x % 5;
      let col = u === 0 ? R.lo : u === 1 ? R.hi : u === 4 ? R.mid : c;
      if ((y - top) % 6 === 5) col = R.lo;
      p.set(x, y, col);
    }
}
function bRoofEdge(p: Pix, cx: number, top: number, eave: number, half: number, c: string): void {
  for (let y = top - 1; y < eave + 1; y++) {
    const h = ((y - top) / (eave - top)) * half;
    p.set(Math.round(cx - h), y, c);
    p.set(Math.round(cx - h) + 1, y, ramp(c).hi);
    p.set(Math.round(cx + h), y, c);
    p.set(Math.round(cx + h) - 1, y, ramp(c).mid);
  }
}
// 窗户：白框、十字窗棂、窗帘；可以带百叶、花箱、拱顶，也可以是落地的门
function bWindow(p: Pix, x: number, y: number, w: number, h: number, o: WindowOpt): void {
  const T = o.trim || '#f4efe4';
  if (o.shutter) {
    p.sRect(x - 4, y, 4, h, o.shutter, { noHi: true });
    p.sRect(x + w, y, 4, h, o.shutter, { noHi: true });
    for (let yy = y + 1; yy < y + h; yy += 3) {
      p.rect(x - 4, yy, 4, 1, ramp(o.shutter).lo);
      p.rect(x + w, yy, 4, 1, ramp(o.shutter).lo);
    }
  }
  p.sRect(x, y, w, h, T);
  const gx = x + 2;
  const gy = y + 2;
  const gw = w - 4;
  const gh = h - 4;
  p.rect(gx, gy, gw, gh, '#7fb6d8');
  p.rect(gx, gy, gw, Math.max(2, Math.floor(gh / 5)), '#a9d4ec');
  // 玻璃往墙里缩进去一点：上沿、左沿一道暗边
  p.rect(gx, gy, gw, 1, '#5e93b8');
  p.rect(gx, gy, 1, gh, '#6aa2c6');
  p.line(gx + 1, gy + gh - 2, gx + Math.min(gw - 2, 7), gy + gh - 2 - Math.min(gh - 3, 7), '#cdeaf8');
  if (o.arch) {
    for (let k = 0; k < Math.floor(w / 2); k++) {
      const cut = Math.round(Math.sqrt(Math.max(0, (w / 2) ** 2 - (w / 2 - k - 0.5) ** 2)));
      for (let yy = y; yy < y + Math.floor(w / 2) - cut; yy++) {
        p.clear(x + k, yy);
        p.clear(x + w - 1 - k, yy);
      }
    }
  }
  p.rect(x + Math.floor(w / 2), gy, 1, gh, T);
  if (!o.door) p.rect(gx, gy + Math.floor(gh / 2), gw, 1, T);
  p.rect(gx, gy, 2, Math.floor(gh * 0.55), '#f4ece0');
  p.rect(gx + gw - 2, gy, 2, Math.floor(gh * 0.55), '#f4ece0');
  // 窗台：比窗框宽一点，上面受光
  if (!o.box && !o.door) {
    p.rect(x - 1, y + h, w + 2, 2, ramp(T).mid);
    p.rect(x - 1, y + h, w + 2, 1, '#fffaf0');
  }
  if (o.box) {
    p.sRect(x - 1, y + h, w + 2, 3, '#8a5a3b');
    for (let i = 0; i < w; i += 2) {
      p.set(x + i, y + h - 1, ['#e85d75', '#f6d35b', '#ef7fa0', '#ffffff', '#9b7fd1'][(i / 2) % 5]);
      p.set(x + i + 1, y + h - 1, '#5f9e4f');
    }
  }
}
function bDoor(p: Pix, cx: number, bottom: number, w: number, h: number, c: string, trim: string, arch?: boolean): void {
  const x = Math.round(cx - w / 2);
  const y = bottom - h;
  p.sRect(x - 3, y - 3, w + 6, h + 3, trim, { noHi: true });
  p.sRect(x, y, w, h, c);
  const R = ramp(c);
  p.rect(x, y, w, 2, R.lo); // 门往里缩，上面压着一道影子
  p.rect(Math.round(cx), y, 1, h, R.lo);
  for (const [px, py] of [[x + 2, y + 3], [Math.round(cx) + 2, y + 3], [x + 2, y + Math.round(h / 2) + 1], [Math.round(cx) + 2, y + Math.round(h / 2) + 1]]) p.sRect(px, py, Math.floor(w / 2) - 4, Math.floor(h / 2) - 5, R.mid, { noHi: true });
  p.rect(Math.round(cx) + 2, y + Math.round(h * 0.55), 2, 2, '#f2c14e');
  p.rect(Math.round(cx) - 4, y + Math.round(h * 0.55), 2, 2, '#f2c14e');
  if (arch) {
    for (let k = 0; k < Math.floor(w / 2) + 3; k++) {
      const r = w / 2 + 3;
      const cut = Math.round(Math.sqrt(Math.max(0, r * r - (r - k - 0.5) ** 2)));
      for (let yy = y - 3; yy < y - 3 + Math.floor(r) - cut; yy++) {
        p.clear(x - 3 + k, yy);
        p.clear(x + w + 2 - k, yy);
      }
    }
  }
}

export const DECOR: Record<string, DecorSpec> = {
  fence: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    const W = '#c49a6c';
    p.sRect(1, 3, 3, 12, W);
    p.sRect(12, 3, 3, 12, W);
    p.sRect(0, 6, 16, 2, W, { noHi: true });
    p.sRect(0, 11, 16, 2, W, { noHi: true });
  } },
  stone: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.ell(8, 14, 6, 1.6, 'rgba(40,30,20,.2)');
    p.sEll(8, 10.5, 5.5, 4, '#a8a29a');
    p.sEll(12, 12, 2.5, 2, '#a8a29a');
  } },
  // ---- 地上要清理的东西：杂草、小石头、大石头、树枝、树桩（野树直接用长大的树） ----
  weed1: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.ell(8, 14.5, 5.5, 1.4, 'rgba(30,40,20,.22)');
    const G = ramp('#5f9a3a');
    for (const [x0, y0, x1, y1, c] of [[8, 14, 3, 5, G.lo], [8, 14, 13, 6, G.lo], [8, 14, 5, 3, G.mid], [8, 14, 11, 2, G.mid], [8, 14, 8, 1, '#5f9a3a'], [8, 14, 2, 9, '#5f9a3a'], [8, 14, 14, 10, '#5f9a3a']] as [number, number, number, number, string][]) p.line(x0, y0, x1, y1, c);
    for (const [x, y] of [[3, 5], [13, 6], [5, 3], [11, 2], [8, 1]]) p.set(x, y, G.hi);
    p.rect(6, 13, 5, 2, G.lo);
  } },
  weed2: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.ell(8, 14.5, 6, 1.4, 'rgba(30,40,20,.22)');
    const G = ramp('#6aa23e');
    // 一圈锯齿边的叶子，中间冒出一朵小黄花
    for (const [cx, cy, rx, ry] of [[4, 11, 3.5, 2.2], [12, 11, 3.5, 2.2], [6, 8, 2.6, 3], [10, 8, 2.6, 3], [8, 12, 3, 2]]) p.sEll(cx, cy, rx, ry, '#6aa23e');
    for (const [x, y] of [[2, 10], [14, 10], [5, 6], [11, 6]]) p.set(x, y, G.hi);
    p.line(8, 12, 8, 4, G.lo);
    p.sEll(8, 3.5, 2, 1.8, '#f2c14e');
    p.set(8, 3, '#fff2a8');
  } },
  weed3: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.ell(8, 14.5, 6, 1.4, 'rgba(30,40,20,.22)');
    const G = ramp('#7a9a3a');
    // 一丛干一点的长草，叶尖发黄
    for (let i = 0; i < 7; i++) {
      const x0 = 4 + i * 1.3;
      const lean = (i - 3) * 0.9;
      const h = 8 + ((i * 5) % 4);
      p.line(Math.round(x0), 14, Math.round(x0 + lean), 14 - h, i % 2 ? G.mid : '#7a9a3a');
      p.set(Math.round(x0 + lean), 14 - h, '#c9b65a');
    }
    p.rect(4, 13, 9, 2, G.lo);
  } },
  rock1: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.ell(8, 14, 6.5, 1.7, 'rgba(30,25,20,.25)');
    const R = ramp('#a39d94');
    p.sEll(8, 10, 6, 4.5, '#a39d94');
    p.ell(6.5, 8.5, 3.6, 2.4, R.hi);
    p.ell(10, 12, 3.2, 1.6, R.mid);
    p.line(9, 8, 11, 11, R.lo);
    p.set(5, 7, '#d8d4cc');
  } },
  rock2: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.ell(8, 14, 6.5, 1.7, 'rgba(30,25,20,.25)');
    const R = ramp('#9a958e');
    p.sEll(6, 11, 4.5, 3.4, '#9a958e');
    p.sEll(11, 10, 3.6, 3.6, '#a8a29a');
    p.ell(10.5, 8.5, 2, 1.4, ramp('#a8a29a').hi);
    p.ell(5, 9.8, 2.4, 1.3, R.hi);
    p.rect(3, 9, 3, 1, '#6f9a4a');
  } },
  boulder: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
    p.ell(16, 29, 14, 2.6, 'rgba(30,25,20,.28)');
    const R = ramp('#9c968c');
    // 大石头：亮的一面朝左上，暗的一面朝右下，几道裂缝，顶上一点青苔
    p.sEll(16, 18, 14, 11, '#9c968c');
    p.ell(13, 14, 9.5, 7, R.hi);
    p.ell(12, 13, 6, 4, lighten(R.hi, 0.05));
    p.ell(21, 23, 8, 4.5, R.mid);
    p.ell(23, 25, 5, 2.4, R.lo);
    p.line(17, 9, 19, 15, R.lo);
    p.line(19, 15, 23, 17, R.lo);
    p.line(8, 20, 12, 23, R.mid);
    p.sEll(11, 9, 5, 2.2, '#5f8f3e');
    for (const [x, y] of [[8, 8], [10, 7], [13, 8]]) p.set(x, y, '#7fb04f');
    p.set(9, 11, '#e4e0d8');
    p.set(10, 11, '#e4e0d8');
  } },
  twig: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.ell(8, 13, 6, 1.3, 'rgba(30,25,20,.2)');
    const B = '#8a5e3a';
    p.line(2, 12, 13, 8, B);
    p.line(2, 13, 13, 9, ramp(B).lo);
    p.line(8, 10, 10, 5, B);
    p.line(5, 11, 4, 8, B);
    p.sEll(11, 4.5, 1.8, 1.2, '#6aa23e');
    p.sEll(3.5, 7.5, 1.4, 1, '#6aa23e');
  } },
  stump: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
    p.ell(16, 28, 14, 2.6, 'rgba(30,25,20,.28)');
    const BARK = '#7a5234';
    const BK = ramp(BARK);
    // 树根往外张开
    for (const [x0, x1] of [[5, 2], [26, 30], [11, 8], [21, 24]]) p.poly([[x0, 22], [x0 + (x1 > x0 ? 4 : -4) * 0 + 2, 22], [x1, 27], [x1 + (x1 > x0 ? -3 : 3), 27]], BK.lo);
    // 树干：一圈树皮，左边亮右边暗
    p.sRect(6, 12, 20, 14, BARK);
    for (let x = 6; x < 26; x++) {
      const c = x < 9 ? BK.hi : x > 21 ? BK.lo : (x % 4 === 0 ? BK.mid : BARK);
      for (let y = 13; y < 26; y++) if (!((y + x) % 7 === 0 && x > 9 && x < 21)) p.set(x, y, c);
    }
    // 截面：年轮
    p.sEll(16, 12, 10, 4.5, '#d9b07a');
    p.ell(16, 12, 7, 3, '#c99a62');
    p.ell(16, 12, 4.2, 1.8, '#d9b07a');
    p.ell(16, 12, 1.6, 0.8, '#b8864e');
    p.line(16, 12, 22, 10, '#a8763e');
    // 一朵小蘑菇
    p.sEll(25, 21, 2.4, 1.6, '#d8783a');
    p.rect(25, 22, 1, 2, '#f4ece0');
  } },
  // 上楼的楼梯：一级级往后墙里走，越往上越暗，右边一道扶手
  stairsUp: { w: 32, h: 48, tw: 2, th: 3, room: true, flat: true, draw(p) {
    const TREAD = '#c99a62';
    const RISE = '#8a5e3a';
    p.rect(0, 0, 32, 48, '#6a4630');
    for (let i = 0; i < 7; i++) {
      const y = 47 - i * 7;
      const k = i / 7;
      p.rect(3, y - 6, 26, 5, mix(TREAD, '#3a2a20', k * 0.55));
      p.rect(3, y - 1, 26, 2, mix(RISE, '#2a1d16', k * 0.55));
      p.rect(3, y - 6, 26, 1, mix(lighten(TREAD, 0.08), '#3a2a20', k * 0.55));
    }
    p.rect(0, 0, 32, 4, '#2a1d16');
    p.rect(0, 0, 3, 48, '#5a3a26');
    p.rect(29, 0, 3, 48, '#5a3a26');
    for (let y = 8; y < 46; y += 8) p.rect(30, y, 1, 6, '#c8a070');
    p.rect(29, 6, 3, 1, '#d8b080');
  } },
  // 下楼的楼梯：地板上一个口子，楼梯往下走，越往下越暗，三边围着栏杆
  stairsDown: { w: 32, h: 48, tw: 2, th: 3, room: true, flat: true, draw(p) {
    p.rect(0, 0, 32, 48, '#5a3a26');
    for (let i = 0; i < 7; i++) {
      const y = 3 + i * 6;
      const k = i / 7;
      p.rect(4, y, 24, 4, mix('#c99a62', '#1a120c', 0.15 + k * 0.7));
      p.rect(4, y + 4, 24, 2, mix('#8a5e3a', '#120c08', 0.2 + k * 0.7));
    }
    for (const x of [1, 29]) {
      p.rect(x, 0, 2, 46, '#b07a4a');
      for (let y = 2; y < 46; y += 5) p.rect(x, y, 2, 1, '#8a5a3b');
    }
    p.rect(1, 0, 30, 2, '#c8a070');
    p.rect(1, 46, 30, 2, '#8a5a3b');
  } },
  stool: { w: 16, h: 16, tw: 1, th: 1, room: true, draw(p) {
    p.ell(8, 14.5, 5.5, 1.3, 'rgba(30,25,20,.22)');
    const W = '#b07a4a';
    for (const x of [4, 11]) p.sRect(x, 8, 2, 7, ramp(W).mid, { noHi: true });
    p.rect(5, 11, 7, 1, ramp(W).lo);
    p.sEll(8, 7, 5.5, 2.6, W);
    p.ell(7, 6.4, 3.6, 1.2, ramp(W).hi);
  } },
  mushroom: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.sRect(6, 9, 4, 5, '#f4ece0');
    p.sEll(8, 8, 6, 4, '#d64545');
    p.rect(2, 9, 12, 1, ramp('#d64545').lo);
    for (const [x, y] of [[5, 6], [9, 5], [11, 8]]) p.rect(x, y, 2, 1, '#ffffff');
  } },
  lamp: { w: 16, h: 32, tw: 1, th: 1, draw(p) {
    p.ell(8, 30.5, 5, 1.4, 'rgba(40,30,20,.2)');
    p.sRect(7, 9, 2, 21, '#4a4a52');
    p.sRect(5, 29, 6, 2, '#4a4a52');
    p.sRect(4, 4, 8, 6, '#3a3a42');
    p.rect(5, 5, 6, 4, '#ffe28a');
    p.rect(6, 6, 2, 2, '#fff6cc');
    p.poly([[3, 4], [13, 4], [8, 0]], '#3a3a42');
  } },
  bench: { w: 32, h: 16, tw: 2, th: 1, draw(p) {
    const W = '#b07a4a';
    p.ell(16, 15, 13, 1.5, 'rgba(40,30,20,.2)');
    p.sRect(2, 1, 28, 3, W);
    p.sRect(2, 5, 28, 2, W, { noHi: true });
    p.sRect(1, 8, 30, 3, W);
    p.sRect(3, 11, 2, 4, '#4a4a52');
    p.sRect(27, 11, 2, 4, '#4a4a52');
  } },
  birdbath: { w: 16, h: 24, tw: 1, th: 1, draw(p) {
    p.ell(8, 22.5, 5, 1.4, 'rgba(40,30,20,.2)');
    p.sRect(6, 11, 4, 11, '#c8c2b8');
    p.sRect(4, 20, 8, 3, '#c8c2b8');
    p.sEll(8, 9, 7, 3, '#c8c2b8');
    p.ell(8, 8.5, 5, 1.6, '#7fb8e0');
    p.set(6, 8, '#d8f0ff');
  } },
  mailbox: { w: 16, h: 32, tw: 1, th: 1, draw(p) {
    p.ell(8, 30.5, 5, 1.4, 'rgba(40,30,20,.2)');
    p.sRect(7, 16, 2, 14, '#8a5a3b');
    p.sRect(3, 9, 10, 8, '#5a7fb0');
    p.sEll(8, 9.5, 5, 3, '#5a7fb0');
    p.rect(3, 13, 10, 1, ramp('#5a7fb0').lo);
    p.rect(4, 12, 1, 3, ramp('#5a7fb0').mid);
    p.sRect(12, 5, 1, 6, '#c8463a', { noHi: true });
    p.sRect(12, 5, 3, 2, '#c8463a', { noHi: true });
  } },
  logs: { w: 32, h: 24, tw: 2, th: 1, draw(p) {
    p.ell(16, 22.5, 15, 2, 'rgba(40,30,20,.22)');
    const BARK = '#7a5232';
    const CUT = '#d9b483';
    // 木头往后伸的上表面（树皮）
    p.sRect(5, 3, 22, 6, BARK, { noHi: true });
    for (let x = 7; x < 26; x += 3) p.set(x, 4 + (x % 2), ramp(BARK).hi);
    const end = (x: number, y: number) => {
      p.ell(x + 0.5, y + 0.5, 4.5, 4.5, ramp(BARK).lo);
      p.ell(x, y, 4, 4, CUT);
      p.ell(x, y, 2.6, 2.6, ramp(CUT).mid);
      p.ell(x, y, 1.6, 1.6, CUT);
      p.set(Math.floor(x), Math.floor(y), ramp(CUT).lo);
      p.set(Math.floor(x - 2), Math.floor(y - 2), ramp(CUT).hi);
      p.set(Math.floor(x - 1), Math.floor(y - 3), ramp(CUT).hi);
    };
    for (const x of [5.5, 13, 20.5, 28]) end(x, 18);
    for (const x of [9.5, 17, 24.5]) end(x, 12);
    end(13.5, 6.5);
    end(21, 6.5);
    p.line(1, 21, 4, 17, '#7a5232');
    p.set(30, 21, '#5f9e4f');
    p.set(31, 20, '#5f9e4f');
  } },
  sign: { w: 16, h: 16, tw: 1, th: 1, draw(p) {
    p.sRect(7, 8, 2, 7, '#8a5a3b');
    p.sRect(2, 2, 12, 7, '#c49a6c');
    p.rect(4, 4, 8, 1, ramp('#c49a6c').lo);
    p.rect(4, 6, 6, 1, ramp('#c49a6c').lo);
  } },
  pond: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
    p.sEll(16, 17, 15, 12, '#a8a29a');
    p.ell(16, 17, 12.5, 9.5, '#5a9ad0');
    p.ell(14, 15, 9, 6, '#6fb0e0');
    p.rect(9, 13, 5, 1, '#d8f0ff');
    p.rect(19, 20, 3, 1, '#d8f0ff');
    p.sEll(22, 13, 3, 2, '#6aa35a');
    p.set(22, 12, '#ef7fa0');
  } },
  pethouse: { w: 32, h: 32, tw: 2, th: 2, draw(p) {
    p.ell(16, 30.5, 14, 1.8, 'rgba(40,30,20,.2)');
    p.sRect(4, 14, 24, 16, '#e8c48a');
    p.poly([[1, 15], [16, 2], [31, 15]], '#c8463a');
    p.poly([[3, 15], [16, 4], [16, 15]], ramp('#c8463a').hi);
    p.rect(1, 15, 30, 2, ramp('#c8463a').lo);
    p.sEll(16, 24, 5, 6, '#4a3226');
    p.rect(11, 24, 11, 6, '#4a3226');
    p.rect(12, 9, 8, 3, '#fbf7ef');
    p.rect(13, 10, 6, 1, '#c8463a');
  } },
  // 农舍：瓦片屋顶、木板墙、石头地基，门上有小雨棚，窗户带百叶和花箱，砖砌烟囱
  // 小木屋：7 格宽，原木墙、山墙屋顶、一扇门两扇窗
  cabin: { w: 112, h: 96, tw: 7, th: 3, draw(p) {
    const LOG = '#a8714a';
    const ROOF = '#8a4a36';
    p.ell(56, 93, 58, 3, 'rgba(30,25,15,.28)');
    // 烟囱（在屋顶后面）
    bStone(p, 78, 2, 10, 26, '#9d978c');
    bStone(p, 6, 80, 100, 8, '#9d978c');
    bLogs(p, 6, 46, 100, 34, LOG);
    // 屋顶
    const top = 6;
    const eave = 47;
    const inRoof = (x: number, y: number) => y >= top && y < eave && Math.abs(x - 55.5) <= ((y - top) / (eave - top)) * 60;
    bShingles(p, inRoof, top, eave, ROOF, 5, 0);
    bRoofEdge(p, 55.5, top, eave, 60, '#6a4630');
    p.sRect(-1, eave - 1, 114, 3, '#6a4630', { noHi: true });
    // 门
    bDoor(p, 56, 80, 18, 27, '#7a4e32', '#5a3a26');
    p.sRect(44, 52, 24, 3, '#8a5e3c', { noHi: true });
    // 窗户
    bWindow(p, 17, 56, 16, 14, { shutter: '#6a8a52', box: true });
    bWindow(p, 79, 56, 16, 14, { shutter: '#6a8a52', box: true });
    // 门边的灯、台阶
    p.sRect(69, 60, 3, 5, '#3a3a42');
    p.set(70, 62, '#ffe28a');
    p.sRect(44, 88, 24, 4, '#b9b2a6');
  } },
  // 石头小屋：9 格宽，石头墙、茅草色的人字屋顶，门口一个小门廊，右边石头烟囱
  cottage: { w: 144, h: 104, tw: 9, th: 3, draw(p) {
    const STONE = '#b8ae9b';
    const ROOF = '#9a7a44';
    const TRIM = '#efe4cc';
    p.ell(72, 101, 74, 3, 'rgba(30,25,15,.28)');
    bStone(p, 104, 0, 12, 34, '#9d978c');
    bStone(p, 8, 54, 128, 38, STONE);
    bStone(p, 6, 90, 132, 8, '#8f887c');
    p.rect(10, 54, 124, 3, 'rgba(50,35,20,.3)');
    // 人字屋顶：一层层茅草
    const top = 6;
    const eave = 56;
    const inRoof = (x: number, y: number) => y >= top && y < eave && Math.abs(x - 71.5) <= 6 + ((y - top) / (eave - top)) * 72;
    bShingles(p, inRoof, top, eave, ROOF, 4, 2);
    for (let y = top; y < eave; y += 4) for (let x = 0; x < 144; x += 7) if (inRoof(x, y + 2) && (x + y) % 3 === 0) p.rect(x, y + 2, 1, 2, ramp(ROOF).hi);
    p.rect(66, top - 2, 12, 3, ramp(ROOF).lo);
    p.sRect(-1, eave - 1, 146, 3, '#6e5430', { noHi: true });
    // 门廊：两根木柱撑着一个小人字顶
    p.poly([[50, 66], [94, 66], [72, 52]], '#7a5a36');
    p.poly([[54, 65], [90, 65], [72, 55]], ramp(ROOF).mid);
    p.sRect(52, 66, 4, 24, '#8a6440', { noHi: true });
    p.sRect(88, 66, 4, 24, '#8a6440', { noHi: true });
    bDoor(p, 72, 90, 18, 22, '#6e4a32', '#5a3a26');
    bWindow(p, 20, 64, 18, 16, { shutter: '#4f6f8f', box: true, trim: TRIM });
    bWindow(p, 106, 64, 18, 16, { shutter: '#4f6f8f', box: true, trim: TRIM });
    p.sRect(94, 70, 3, 5, '#3a3a42');
    p.set(95, 72, '#ffe28a');
    p.sRect(58, 96, 28, 4, '#c8c0b2');
  } },
  // 大农舍：11 格宽，红色木板墙、白边，深灰屋顶上两扇老虎窗，整排的门廊
  farm2: { w: 176, h: 136, tw: 11, th: 4, draw(p) {
    const WALL = '#b5523f';
    const TRIM = '#f6efe2';
    const ROOF = '#5a5752';
    p.ell(88, 133, 90, 3.2, 'rgba(30,25,15,.28)');
    bStone(p, 26, 0, 12, 30, '#a8503c', true);
    bStone(p, 8, 118, 160, 10, '#9d978c');
    bPlanks(p, 10, 62, 156, 56, WALL);
    for (let x = 22; x < 160; x += 12) p.rect(x, 62, 1, 56, ramp(WALL).lo);
    p.sRect(8, 60, 5, 58, TRIM, { noHi: true });
    p.sRect(163, 60, 5, 58, TRIM, { noHi: true });
    // 四坡屋顶
    const top = 8;
    const eave = 62;
    const inRoof = (x: number, y: number) => y >= top && y < eave && x >= 36 - ((y - top) / (eave - top)) * 38 && x <= 139 + ((y - top) / (eave - top)) * 38;
    bShingles(p, inRoof, top, eave, ROOF, 6, 1);
    p.rect(36, top - 2, 104, 3, ramp(ROOF).lo);
    p.sRect(-1, eave - 1, 178, 3, '#3e3c38', { noHi: true });
    // 两扇老虎窗
    for (const cx of [56, 120]) {
      p.poly([[cx - 15, 50], [cx + 15, 50], [cx, 28]], TRIM);
      p.poly([[cx - 12, 50], [cx + 12, 50], [cx, 31]], ramp(ROOF).mid);
      bWindow(p, cx - 7, 36, 14, 14, { trim: TRIM });
    }
    // 门廊：屋檐、六根柱子、栏杆
    p.sRect(14, 76, 148, 6, '#6a675f');
    p.sRect(14, 82, 148, 3, TRIM, { noHi: true });
    for (const x of [16, 44, 68, 104, 128, 156]) p.sRect(x, 85, 4, 33, TRIM, { noHi: true });
    bWindow(p, 24, 88, 18, 18, { trim: TRIM });
    bWindow(p, 46, 88, 18, 18, { trim: TRIM });
    bWindow(p, 112, 88, 18, 18, { trim: TRIM });
    bWindow(p, 134, 88, 18, 18, { trim: TRIM });
    for (const [x0, x1] of [[18, 68], [108, 158]]) {
      p.sRect(x0, 106, x1 - x0, 3, TRIM, { noHi: true });
      for (let x = x0 + 2; x < x1; x += 4) p.rect(x, 109, 2, 9, TRIM);
    }
    bDoor(p, 88, 118, 20, 28, '#6e4a32', TRIM);
    p.sRect(66, 128, 44, 4, '#c8c0b2');
    p.sRect(70, 124, 36, 4, '#d8d0c2');
  } },
  // 红砖洋房：11 格宽，两层红砖、白色窗框，正面一个山墙，楼下左边一扇凸窗
  brick: { w: 176, h: 176, tw: 11, th: 4, draw(p) {
    const BRICK = '#ad5a42';
    const TRIM = '#f6f1e6';
    const ROOF = '#4d5563';
    p.ell(88, 173, 90, 3.5, 'rgba(30,25,15,.28)');
    bStone(p, 134, 0, 14, 40, '#8f4434', true);
    bStone(p, 10, 158, 156, 10, '#8f887c');
    bStone(p, 12, 58, 152, 100, BRICK, true);
    p.sRect(10, 106, 156, 4, TRIM, { noHi: true });
    p.rect(14, 58, 148, 3, 'rgba(40,30,30,.3)');
    // 四坡屋顶 + 正中的山墙
    const top = 10;
    const eave = 60;
    const inRoof = (x: number, y: number) => y >= top && y < eave && x >= 40 - ((y - top) / (eave - top)) * 42 && x <= 135 + ((y - top) / (eave - top)) * 42;
    bShingles(p, inRoof, top, eave, ROOF, 5, 0);
    p.rect(40, top - 2, 96, 3, ramp(ROOF).lo);
    p.sRect(-1, eave - 1, 178, 3, '#373d48', { noHi: true });
    bStone(p, 58, 30, 60, 30, BRICK, true);
    const inGable = (x: number, y: number) => y >= 14 && y < 60 && Math.abs(x - 87.5) <= ((y - 14) / 46) * 34 && y >= 14;
    for (let y = 14; y < 60; y++) for (let x = 50; x < 126; x++) if (!inGable(x, y)) continue; else if (Math.abs(x - 87.5) > ((y - 14) / 46) * 34 - 4) p.set(x, y, ROOF);
    bRoofEdge(p, 87.5, 14, 60, 36, TRIM);
    p.sEll(88, 38, 6, 6, TRIM);
    p.ell(88, 38, 4, 4, '#7fb6d8');
    p.rect(88, 34, 1, 8, TRIM);
    // 楼上三扇窗
    for (const x of [26, 78, 128]) bWindow(p, x, 68, 22, 28, { trim: TRIM });
    // 楼下：凸窗、门、窗
    p.sRect(18, 116, 44, 40, TRIM);
    bWindow(p, 22, 120, 12, 30, { trim: TRIM });
    bWindow(p, 34, 118, 16, 32, { trim: TRIM });
    bWindow(p, 50, 120, 12, 30, { trim: TRIM });
    p.sRect(16, 112, 48, 5, ROOF);
    bWindow(p, 126, 120, 24, 28, { trim: TRIM, box: true });
    p.poly([[72, 118], [104, 118], [88, 108]], TRIM);
    bDoor(p, 88, 158, 20, 34, '#2f4a3a', TRIM);
    p.sRect(108, 128, 3, 5, '#3a3a42');
    p.set(109, 130, '#ffe28a');
    p.sRect(68, 168, 40, 4, '#c8c0b2');
    p.sRect(72, 164, 32, 4, '#d8d0c2');
  } },
  // 白色洋房：13 格宽，白色木板墙、绿色百叶窗、墨绿屋顶上三扇老虎窗，楼下一整排带栏杆的门廊
  white: { w: 208, h: 176, tw: 13, th: 4, draw(p) {
    const WALL = '#f1eee6';
    const TRIM = '#ffffff';
    const ROOF = '#3f5f4f';
    const SHUT = '#3f6f52';
    p.ell(104, 173, 106, 3.5, 'rgba(30,25,15,.28)');
    bStone(p, 40, 0, 12, 36, '#a8503c', true);
    bStone(p, 156, 0, 12, 36, '#a8503c', true);
    bStone(p, 8, 158, 192, 10, '#9d978c');
    bPlanks(p, 12, 58, 184, 100, WALL);
    p.sRect(10, 56, 5, 102, TRIM, { noHi: true });
    p.sRect(193, 56, 5, 102, TRIM, { noHi: true });
    p.rect(15, 58, 178, 3, 'rgba(40,50,40,.25)');
    const top = 8;
    const eave = 58;
    const inRoof = (x: number, y: number) => y >= top && y < eave && x >= 48 - ((y - top) / (eave - top)) * 50 && x <= 159 + ((y - top) / (eave - top)) * 50;
    bShingles(p, inRoof, top, eave, ROOF, 6, 2);
    p.rect(48, top - 2, 112, 3, ramp(ROOF).lo);
    p.sRect(-1, eave - 1, 210, 3, '#2e463a', { noHi: true });
    for (const cx of [62, 104, 146]) {
      p.poly([[cx - 13, 48], [cx + 13, 48], [cx, 28]], TRIM);
      p.poly([[cx - 10, 48], [cx + 10, 48], [cx, 31]], ramp(ROOF).mid);
      bWindow(p, cx - 6, 35, 12, 13, { trim: TRIM });
    }
    // 楼上四扇窗
    for (const x of [24, 66, 122, 164]) bWindow(p, x, 66, 20, 26, { shutter: SHUT, trim: TRIM });
    // 门廊：屋檐、栏杆、八根柱子
    p.sRect(12, 98, 184, 6, ROOF);
    p.sRect(12, 104, 184, 3, TRIM, { noHi: true });
    for (const x of [14, 38, 62, 86, 118, 142, 166, 190]) p.sRect(x, 107, 4, 51, TRIM, { noHi: true });
    for (const x of [24, 66, 122, 164]) bWindow(p, x, 114, 20, 26, { shutter: SHUT, trim: TRIM });
    for (const [x0, x1] of [[14, 90], [118, 194]]) {
      p.sRect(x0, 140, x1 - x0, 3, TRIM, { noHi: true });
      for (let x = x0 + 2; x < x1; x += 4) p.rect(x, 143, 2, 15, TRIM);
    }
    bDoor(p, 104, 158, 22, 36, '#2f4a3a', TRIM);
    p.sRect(80, 168, 48, 4, '#c8c0b2');
    p.sRect(84, 164, 40, 4, '#d8d0c2');
  } },
  // 石头大宅：13 格宽，灰石头两层，左右两个山墙，正中石头拱门，青灰色屋顶，两边烟囱
  manor: { w: 208, h: 184, tw: 13, th: 5, draw(p) {
    const STONE = '#a9a397';
    const TRIM = '#efe9dc';
    const ROOF = '#4f5868';
    p.ell(104, 181, 106, 3.5, 'rgba(30,25,15,.28)');
    bStone(p, 22, 6, 14, 40, '#8f887c');
    bStone(p, 172, 6, 14, 40, '#8f887c');
    bStone(p, 8, 164, 192, 12, '#8f887c');
    bStone(p, 12, 66, 184, 98, STONE);
    p.sRect(10, 112, 188, 4, TRIM, { noHi: true });
    // 主屋顶
    const top = 16;
    const eave = 68;
    const inRoof = (x: number, y: number) => y >= top && y < eave && x >= 50 - ((y - top) / (eave - top)) * 52 && x <= 157 + ((y - top) / (eave - top)) * 52;
    bShingles(p, inRoof, top, eave, ROOF, 5, 3);
    p.rect(50, top - 2, 108, 3, ramp(ROOF).lo);
    p.sRect(-1, eave - 1, 210, 3, '#3a4250', { noHi: true });
    // 左右两个山墙：石墙往上伸，三角屋顶
    for (const cx of [44, 164]) {
      bStone(p, cx - 30, 52, 60, 20, STONE);
      const inG = (x: number, y: number) => y >= 8 && y < 58 && Math.abs(x - cx + 0.5) <= ((y - 8) / 50) * 34;
      bShingles(p, inG, 8, 58, ROOF, 5, 1);
      for (let y = 26; y < 58; y++) for (let x = cx - 30; x < cx + 30; x++) if (Math.abs(x - cx + 0.5) <= ((y - 8) / 50) * 34 - 7) p.set(x, y, STONE);
      bRoofEdge(p, cx - 0.5, 8, 58, 34, TRIM);
      bWindow(p, cx - 7, 34, 14, 18, { arch: true, trim: TRIM });
      bWindow(p, cx - 12, 74, 24, 30, { trim: TRIM });
      bWindow(p, cx - 12, 124, 24, 30, { trim: TRIM, box: true });
    }
    // 中间：楼上两扇窗，楼下石头拱门
    bWindow(p, 82, 74, 16, 28, { arch: true, trim: TRIM });
    bWindow(p, 110, 74, 16, 28, { arch: true, trim: TRIM });
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (k / 8);
      p.sRect(Math.round(104 - Math.cos(a) * 22) - 3, Math.round(130 - Math.sin(a) * 18) - 2, 6, 5, '#c8c2b4', { noHi: true });
    }
    bDoor(p, 104, 164, 26, 36, '#5a3a26', '#7a6a58', true);
    for (const x of [74, 128]) {
      p.sRect(x, 132, 6, 32, '#c8c2b4', { noHi: true });
      p.sEll(x + 3, 128, 5, 4, '#3f6f3a');
      p.sRect(x + 2, 116, 2, 8, '#3a3a42');
      p.set(x + 3, 120, '#ffe28a');
    }
    p.sRect(76, 176, 56, 4, '#c8c0b2');
    p.sRect(80, 172, 48, 4, '#d8d0c2');
  } },
  // 大别墅：15 格宽，中间主楼三层（顶上山花里一扇圆窗），两边两层的厢房，陶土瓦，门前六根柱子
  villa2: { w: 240, h: 208, tw: 15, th: 5, draw(p) {
    const WALL = '#f2e6cf';
    const STONE = '#cdbfa5';
    const ROOF = '#c2603f';
    const TRIM = '#fbf7ef';
    p.ell(120, 205, 122, 3.5, 'rgba(30,25,15,.28)');
    bStone(p, 92, 0, 10, 30, '#a8503c', true);
    bStone(p, 138, 0, 10, 30, '#a8503c', true);
    bStone(p, 8, 186, 224, 10, '#a49c90');
    const roof = (x0: number, x1: number, top: number, eave: number, ridge0: number, ridge1: number) => {
      const inRoof = (x: number, y: number) => y >= top && y < eave && x >= ridge0 - ((y - top) / (eave - top)) * (ridge0 - x0) && x <= ridge1 + ((y - top) / (eave - top)) * (x1 - ridge1);
      bTiles(p, inRoof, top, eave, ROOF);
      p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
      p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, '#8a4630', { noHi: true });
    };
    // 厢房
    bPlaster(p, 12, 104, 68, 82, WALL);
    bPlaster(p, 160, 104, 68, 82, WALL);
    roof(6, 86, 72, 106, 30, 62);
    roof(154, 234, 72, 106, 178, 210);
    for (const x0 of [12, 160]) {
      p.sRect(x0, 142, 68, 3, TRIM, { noHi: true });
      bWindow(p, x0 + 10, 112, 16, 24, { arch: true, trim: TRIM });
      bWindow(p, x0 + 42, 112, 16, 24, { arch: true, trim: TRIM });
      bWindow(p, x0 + 10, 152, 16, 26, { trim: TRIM, box: true });
      bWindow(p, x0 + 42, 152, 16, 26, { trim: TRIM, box: true });
    }
    // 主楼
    bPlaster(p, 74, 50, 92, 136, WALL);
    for (const x of [74, 160]) for (let y = 50; y < 186; y += 8) p.sRect(x + ((y / 8) % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
    roof(66, 174, 14, 52, 98, 142);
    // 山花：三角形，里面一扇圆窗
    p.poly([[86, 58], [154, 58], [120, 30]], TRIM);
    p.poly([[92, 56], [148, 56], [120, 34]], '#efe0c4');
    p.sEll(120, 46, 7, 7, TRIM);
    p.ell(120, 46, 5, 5, '#7fb6d8');
    p.rect(120, 41, 1, 10, TRIM);
    p.rect(115, 46, 10, 1, TRIM);
    p.sRect(80, 96, 80, 3, TRIM, { noHi: true });
    for (const x of [86, 112, 138]) bWindow(p, x, 64, 16, 26, { arch: true, trim: TRIM });
    // 二楼阳台
    for (const x of [86, 112, 138]) bWindow(p, x, 104, 16, 28, { door: true, trim: TRIM });
    p.sRect(80, 132, 80, 4, TRIM);
    for (let x = 82; x < 158; x += 4) p.rect(x, 126, 2, 6, TRIM);
    p.sRect(80, 124, 80, 3, TRIM);
    // 门廊：六根柱子
    p.sRect(78, 138, 84, 7, TRIM);
    for (const x of [82, 96, 108, 128, 140, 154]) {
      p.sRect(x, 145, 5, 41, TRIM, { noHi: true });
      p.rect(x - 1, 145, 7, 2, ramp(TRIM).mid);
    }
    bDoor(p, 120, 186, 24, 34, '#6e4a32', TRIM, true);
    p.sRect(92, 196, 56, 4, '#d8d0c2');
    p.sRect(96, 200, 48, 4, '#c8c0b2');
    for (const [x0, x1] of [[14, 78], [162, 226]]) {
      p.sRect(x0, 180, x1 - x0, 6, '#6e8a52');
      for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 180 + ((x * 3) % 3), ['#e85d75', '#f6d35b', '#ffffff', '#9b7fd1'][(x / 3) % 4 | 0]);
    }
  } },
  // 庄园：17 格宽，中间三层主楼、孟莎式屋顶上一座小圆亭，两边两层的翼楼，两头各一座圆塔
  estate: { w: 272, h: 224, tw: 17, th: 6, draw(p) {
    const WALL = '#ece3cf';
    const STONE = '#cfc4ac';
    const ROOF = '#4a5262';
    const TRIM = '#fbf8f0';
    const GOLD = '#e0b04a';
    p.ell(136, 221, 138, 3.5, 'rgba(30,25,15,.28)');
    bStone(p, 6, 200, 260, 10, '#a49c90');
    const hip = (x0: number, x1: number, top: number, eave: number, ridge0: number, ridge1: number) => {
      const inRoof = (x: number, y: number) => y >= top && y < eave && x >= ridge0 - ((y - top) / (eave - top)) * (ridge0 - x0) && x <= ridge1 + ((y - top) / (eave - top)) * (x1 - ridge1);
      bShingles(p, inRoof, top, eave, ROOF, 5, 1);
      p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
      p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, '#363c48', { noHi: true });
    };
    // 翼楼
    bPlaster(p, 34, 116, 72, 84, WALL);
    bPlaster(p, 166, 116, 72, 84, WALL);
    hip(28, 112, 86, 118, 48, 92);
    hip(160, 244, 86, 118, 180, 224);
    for (const x0 of [34, 166]) {
      p.sRect(x0, 156, 72, 3, TRIM, { noHi: true });
      for (const dx of [8, 28, 48]) {
        bWindow(p, x0 + dx, 124, 16, 26, { trim: TRIM });
        bWindow(p, x0 + dx, 166, 16, 28, { trim: TRIM, box: true });
      }
    }
    // 圆塔：左边亮右边暗，看着是圆的；尖顶上一个金色的尖
    for (const x0 of [4, 232]) {
      const TW = 36;
      for (let y = 72; y < 200; y++)
        for (let x = x0; x < x0 + TW; x++) {
          const u = (x - x0) / (TW - 1);
          const shade = u < 0.2 ? 0.08 : u > 0.7 ? -0.22 * ((u - 0.7) / 0.3) - 0.05 : 0;
          const c = shade > 0 ? mix(WALL, '#ffffff', shade) : mix(WALL, '#8a7a60', -shade);
          p.set(x, y, (y - 72) % 8 === 7 ? mix(c, STONE, 0.5) : c);
        }
      const cx = x0 + TW / 2 - 0.5;
      const inCone = (x: number, y: number) => y >= 22 && y < 76 && Math.abs(x - cx) <= ((y - 22) / 54) * 22;
      bShingles(p, inCone, 22, 76, ROOF, 5, 0);
      for (let y = 22; y < 76; y++) {
        const h = ((y - 22) / 54) * 22;
        p.set(Math.round(cx + h), y, ramp(ROOF).lo);
        p.set(Math.round(cx + h) - 1, y, ramp(ROOF).lo);
      }
      p.sRect(x0 - 3, 74, TW + 6, 4, '#363c48', { noHi: true });
      p.rect(Math.round(cx), 10, 1, 12, GOLD);
      p.sEll(Math.round(cx), 18, 2, 2, GOLD);
      for (const y of [88, 128, 168]) bWindow(p, x0 + 10, y, 16, 26, { arch: true, trim: TRIM });
    }
    // 主楼：三层，孟莎式屋顶（很陡的一圈，上面平）
    bPlaster(p, 98, 66, 76, 134, WALL);
    for (const x of [98, 168]) for (let y = 66; y < 200; y += 8) p.sRect(x + ((y / 8) % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
    const inMansard = (x: number, y: number) => y >= 34 && y < 68 && x >= 102 - ((y - 34) / 34) * 10 && x <= 169 + ((y - 34) / 34) * 10;
    bShingles(p, inMansard, 34, 68, ROOF, 5, 2);
    p.sRect(100, 30, 72, 5, '#363c48', { noHi: true });
    p.sRect(90, 67, 92, 3, '#363c48', { noHi: true });
    for (const cx of [114, 136, 158]) {
      p.sRect(cx - 8, 40, 16, 22, TRIM);
      p.poly([[cx - 10, 41], [cx + 10, 41], [cx, 33]], ROOF);
      bWindow(p, cx - 5, 44, 10, 16, { trim: TRIM });
    }
    // 小圆亭
    p.sRect(124, 14, 24, 17, TRIM);
    for (const x of [127, 135, 143]) p.rect(x, 17, 2, 12, '#7fb6d8');
    p.sEll(136, 13, 13, 6, ROOF);
    p.rect(136, 0, 1, 8, GOLD);
    p.sEll(136, 4, 2, 2, GOLD);
    p.sRect(104, 114, 64, 3, TRIM, { noHi: true });
    p.sRect(104, 156, 64, 3, TRIM, { noHi: true });
    for (const x of [108, 128, 148]) bWindow(p, x, 76, 16, 30, { arch: true, trim: TRIM });
    for (const x of [108, 148]) bWindow(p, x, 122, 16, 28, { door: true, trim: TRIM });
    // 二楼正中的阳台和大窗
    bWindow(p, 126, 120, 20, 30, { door: true, trim: TRIM });
    p.sRect(104, 150, 64, 4, TRIM);
    for (let x = 106; x < 166; x += 4) p.rect(x, 144, 2, 6, TRIM);
    p.sRect(104, 142, 64, 3, TRIM);
    // 门廊：四根柱子撑着三角山花
    p.poly([[100, 166], [172, 166], [136, 152]], TRIM);
    p.poly([[106, 164], [166, 164], [136, 156]], '#efe4cc');
    p.sRect(100, 166, 72, 5, TRIM);
    for (const x of [104, 118, 150, 164]) {
      p.sRect(x, 171, 5, 29, TRIM, { noHi: true });
      p.rect(x - 1, 171, 7, 2, ramp(TRIM).mid);
    }
    bDoor(p, 136, 200, 24, 26, '#5a3a26', TRIM, true);
    // 大台阶
    p.sRect(104, 210, 64, 4, '#d8d0c2');
    p.sRect(110, 214, 52, 4, '#c8c0b2');
    for (const [x0, x1] of [[42, 98], [174, 230]]) {
      p.sRect(x0, 194, x1 - x0, 6, '#6e8a52');
      for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 194 + ((x * 3) % 3), ['#e85d75', '#f6d35b', '#ffffff', '#9b7fd1'][(x / 3) % 4 | 0]);
    }
  } },
  // 两层小楼：11 格宽，蓝灰色的墙板、四坡屋顶带老虎窗，门口一个门廊，楼上是阳台
  house2: { w: 176, h: 176, tw: 11, th: 4, draw(p) {
    const WALL = '#b7c9d6';
    const TRIM = '#f4efe4';
    const ROOF = '#5c6b85';
    p.ell(88, 173, 90, 3.5, 'rgba(30,25,15,.28)');
    bStone(p, 130, 0, 12, 34, '#a8503c', true);
    bStone(p, 10, 156, 156, 12, '#9d978c');
    bPlanks(p, 12, 60, 152, 96, WALL);
    p.sRect(10, 104, 156, 4, TRIM, { noHi: true });
    p.sRect(10, 58, 5, 98, TRIM, { noHi: true });
    p.sRect(161, 58, 5, 98, TRIM, { noHi: true });
    p.rect(15, 60, 146, 3, 'rgba(40,40,60,.25)');
    // 四坡屋顶
    const top = 8;
    const eave = 60;
    const inRoof = (x: number, y: number) => y >= top && y < eave && x >= 44 - ((y - top) / (eave - top)) * 46 && x <= 131 + ((y - top) / (eave - top)) * 46;
    bShingles(p, inRoof, top, eave, ROOF, 6, 0);
    p.rect(44, top - 2, 88, 3, ramp(ROOF).lo);
    p.sRect(-1, eave - 1, 178, 3, '#4a5468', { noHi: true });
    // 老虎窗
    p.poly([[70, 48], [106, 48], [88, 24]], TRIM);
    p.poly([[73, 48], [103, 48], [88, 27]], ramp(ROOF).mid);
    bWindow(p, 80, 34, 16, 14, {});
    // 楼上：两扇窗、中间是通阳台的门
    bWindow(p, 24, 70, 22, 22, { shutter: '#3e5a7a' });
    bWindow(p, 130, 70, 22, 22, { shutter: '#3e5a7a' });
    bWindow(p, 78, 68, 20, 30, { door: true });
    // 门廊屋顶兼阳台，栏杆
    p.sRect(60, 98, 56, 6, TRIM);
    for (let x = 62; x < 114; x += 4) p.rect(x, 90, 2, 8, TRIM);
    p.sRect(60, 88, 56, 3, TRIM);
    p.sRect(62, 104, 4, 52, TRIM, { noHi: true });
    p.sRect(110, 104, 4, 52, TRIM, { noHi: true });
    // 楼下：门和两扇窗
    bDoor(p, 88, 156, 22, 34, '#7a3a32', TRIM);
    bWindow(p, 24, 118, 22, 22, { shutter: '#3e5a7a', box: true });
    bWindow(p, 130, 118, 22, 22, { shutter: '#3e5a7a', box: true });
    p.sRect(116, 128, 3, 5, '#3a3a42');
    p.set(117, 130, '#ffe28a');
    p.sRect(70, 168, 36, 4, '#b9b2a6');
    p.sRect(66, 156, 44, 4, '#c8c0b2');
  } },
  // 别墅：13 格宽，中间两层、两边一层；奶白色的墙、陶土瓦屋顶、门前四根柱子，二楼拱形窗和阳台
  villa: { w: 208, h: 192, tw: 13, th: 5, draw(p) {
    const WALL = '#efe3cc';
    const STONE = '#c9bea8';
    const ROOF = '#c2603f';
    const TRIM = '#fbf7ef';
    p.ell(104, 189, 106, 3.5, 'rgba(30,25,15,.28)');
    bStone(p, 62, 6, 10, 32, '#a8503c', true);
    bStone(p, 136, 6, 10, 32, '#a8503c', true);
    bStone(p, 8, 172, 192, 12, '#a49c90');
    // 两边的厢房
    bPlaster(p, 10, 122, 50, 50, WALL);
    bPlaster(p, 148, 122, 50, 50, WALL);
    // 中间的主楼
    bPlaster(p, 56, 64, 96, 108, WALL);
    for (const x of [56, 146]) for (let y = 64; y < 172; y += 8) p.sRect(x + ((y / 8) % 2 ? 0 : 1), y, 6, 7, STONE, { noHi: true });
    p.sRect(56, 116, 96, 4, TRIM, { noHi: true });
    // 屋顶
    const roof = (x0: number, x1: number, top: number, eave: number, ridge0: number, ridge1: number) => {
      const inRoof = (x: number, y: number) => y >= top && y < eave && x >= ridge0 - ((y - top) / (eave - top)) * (ridge0 - x0) && x <= ridge1 + ((y - top) / (eave - top)) * (x1 - ridge1);
      bTiles(p, inRoof, top, eave, ROOF);
      p.rect(ridge0, top - 2, ridge1 - ridge0, 3, ramp(ROOF).lo);
      p.sRect(x0 - 1, eave - 1, x1 - x0 + 2, 3, '#8a4630', { noHi: true });
    };
    roof(4, 64, 96, 124, 22, 46);
    roof(144, 204, 96, 124, 162, 186);
    roof(48, 160, 18, 66, 78, 130);
    // 二楼：三扇拱形窗、阳台
    for (const x of [66, 95, 124]) bWindow(p, x, 76, 18, 28, { arch: true, trim: TRIM });
    p.sRect(70, 110, 68, 4, TRIM);
    for (let x = 72; x < 136; x += 4) p.rect(x, 104, 2, 6, TRIM);
    p.sRect(70, 102, 68, 3, TRIM);
    // 门廊：四根柱子
    p.sRect(68, 120, 72, 8, TRIM);
    for (const x of [72, 86, 118, 132]) {
      p.sRect(x, 128, 6, 44, TRIM, { noHi: true });
      p.rect(x - 1, 128, 8, 2, ramp(TRIM).mid);
      p.rect(x - 1, 170, 8, 2, ramp(TRIM).mid);
    }
    bDoor(p, 104, 172, 26, 38, '#6e4a32', TRIM, true);
    // 厢房的窗
    for (const x of [18, 38, 154, 174]) bWindow(p, x, 134, 16, 24, { arch: true, trim: TRIM, box: true });
    // 台阶和花坛
    p.sRect(80, 184, 48, 4, '#d8d0c2');
    p.sRect(84, 188, 40, 4, '#c8c0b2');
    for (const [x0, x1] of [[12, 56], [152, 196]]) {
      p.sRect(x0, 166, x1 - x0, 6, '#6e8a52');
      for (let x = x0 + 2; x < x1 - 1; x += 3) p.set(x, 166 + ((x * 3) % 3), ['#e85d75', '#f6d35b', '#ffffff', '#9b7fd1'][(x / 3) % 4 | 0]);
    }
  } },
  // 农舍：9 格宽，四坡屋顶，正中一个山墙对着门；木板墙、石头地基、两扇带百叶和花箱的窗户、门口两级台阶
  house: { w: 144, h: 128, tw: 9, th: 4, draw(p) {
    const WALL = '#d6a167';
    const WR = ramp(WALL);
    const TRIM = '#f1e2c2';
    const TR = ramp(TRIM);
    const ROOF = '#b9553f';
    const RR = ramp(ROOF);
    const STONE = '#9d978c';
    const SR = ramp(STONE);
    const WOOD = '#8a5a3b';
    p.ell(72, 125, 74, 3.2, 'rgba(30,25,15,.28)');
    // 石头地基
    for (let y = 108; y < 120; y++) for (let x = 8; x < 136; x++) p.set(x, y, STONE);
    for (let row = 0; row < 3; row++) {
      const y = 108 + row * 4;
      p.rect(8, y + 3, 128, 1, SR.lo);
      for (let x = 8 + (row % 2 ? 5 : 0); x < 136; x += 10) {
        p.rect(x, y, 1, 3, SR.lo);
        p.rect(x + 1, y, 7, 1, SR.hi);
      }
    }
    p.rect(8, 119, 128, 1, SR.lo);
    // 木板墙
    for (let y = 62; y < 108; y++) {
      const k = (y - 62) % 5;
      p.rect(10, y, 124, 1, k === 0 ? WR.hi : k === 4 ? WR.lo : WALL);
    }
    for (let y = 63; y < 108; y += 5) for (let x = 18 + ((y / 5) % 3) * 13; x < 132; x += 39) p.set(x, y + 2, WR.mid);
    // 转角的竖木条
    p.sRect(8, 60, 5, 48, TRIM, { noHi: true });
    p.sRect(131, 60, 5, 48, TRIM, { noHi: true });
    // 屋檐下的影子
    p.rect(13, 62, 118, 4, 'rgba(60,30,15,.3)');
    // 四坡屋顶：上窄下宽的梯形，一排排瓦片
    const RT = 10;
    const RB = 62;
    const inMain = (x: number, y: number) => y >= RT && y < RB && x >= 24 - ((y - RT) / (RB - RT)) * 26 && x <= 119 + ((y - RT) / (RB - RT)) * 26;
    const shingle = (x: number, y: number, off: number) => {
      const row = Math.floor((y - RT) / 6);
      const ry = (y - RT) % 6;
      const tab = (x + (row % 2 ? 5 : 0) + off) % 10;
      if (ry === 5) return RR.lo;
      if (tab === 0) return RR.mid;
      if (ry === 0 && tab < 5) return RR.hi;
      return ROOF;
    };
    for (let y = RT; y < RB; y++) for (let x = -2; x < 146; x++) if (inMain(x, y)) p.set(x, y, shingle(x, y, 0));
    // 屋脊和两边的斜脊
    p.rect(24, RT - 2, 96, 3, RR.lo);
    p.rect(24, RT - 2, 96, 1, RR.hi);
    for (let y = RT; y < RB; y++) {
      const dx = ((y - RT) / (RB - RT)) * 26;
      p.set(Math.round(24 - dx), y, RR.lo);
      p.set(Math.round(24 - dx) + 1, y, RR.hi);
      p.set(Math.round(119 + dx), y, RR.lo);
    }
    // 砖烟囱（在屋顶后面）
    for (let y = 0; y < 22; y++)
      for (let x = 100; x < 111; x++) {
        const brick = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 2) % 5 === 0;
        p.set(x, y, brick ? '#7a3a2e' : y % 4 === 0 ? '#c46a50' : '#a8503c');
      }
    p.sRect(99, 0, 13, 3, '#8a847a');
    for (let y = RT; y < 22; y++) for (let x = 100; x < 111; x++) if (inMain(x, y + 4)) p.set(x, y, shingle(x, y, 0));
    // 正中的山墙：三角形，自己的封檐板，里面一扇小圆窗
    const GT = 14;
    const inGable = (x: number, y: number) => y >= GT && y < RB && Math.abs(x - 71.5) <= ((y - GT) / (RB - GT)) * 30 + 0.5;
    for (let y = GT; y < RB; y++) for (let x = 40; x < 104; x++) if (inGable(x, y)) p.set(x, y, shingle(x, y, 3));
    // 山墙正面是木板墙（下面一截）
    for (let y = 40; y < RB; y++) {
      const half = ((y - GT) / (RB - GT)) * 30 - 3;
      for (let x = Math.ceil(71.5 - half); x <= Math.floor(71.5 + half); x++) p.set(x, y, (y - 40) % 5 === 0 ? WR.hi : (y - 40) % 5 === 4 ? WR.lo : WALL);
    }
    for (let y = GT - 1; y < RB + 1; y++) {
      const half = ((y - GT) / (RB - GT)) * 30;
      for (const [dx, c] of [[0, TRIM], [1, TR.mid], [2, TR.lo]] as [number, string][]) {
        p.set(Math.round(71.5 - half) + dx, y, c);
        p.set(Math.round(71.5 + half) - dx, y, dx === 0 ? TR.mid : c);
      }
    }
    p.rect(68, GT - 3, 8, 3, TR.mid);
    p.rect(69, GT - 3, 6, 1, TRIM);
    // 山墙上的小圆窗
    p.sEll(72, 31, 6, 6, TRIM);
    p.ell(72, 31, 4.2, 4.2, '#7fb6d8');
    p.ell(71, 30, 2, 2, '#a9d4ec');
    p.rect(72, 27, 1, 8, TRIM);
    p.rect(68, 31, 9, 1, TRIM);
    // 屋檐的木板
    p.sRect(-1, RB - 1, 146, 3, WOOD, { noHi: true });
    // 窗户：白框、十字窗棂、绿色百叶、花箱
    for (const wx of [27, 101]) {
      p.sRect(wx - 6, 72, 4, 19, '#5f8a52', { noHi: true });
      p.sRect(wx + 18, 72, 4, 19, '#5f8a52', { noHi: true });
      for (let y = 73; y < 90; y += 3) {
        p.rect(wx - 6, y, 4, 1, ramp('#5f8a52').lo);
        p.rect(wx + 18, y, 4, 1, ramp('#5f8a52').lo);
      }
      p.sRect(wx - 2, 70, 20, 22, TRIM);
      p.rect(wx + 1, 73, 14, 16, '#7fb6d8');
      p.rect(wx + 1, 73, 14, 3, '#a9d4ec');
      p.line(wx + 3, 87, wx + 11, 75, '#cdeaf8');
      p.line(wx + 4, 87, wx + 12, 75, '#cdeaf8');
      p.rect(wx + 8, 73, 1, 16, TRIM);
      p.rect(wx + 1, 80, 14, 1, TRIM);
      // 窗帘
      p.rect(wx + 1, 73, 2, 9, '#f4ece0');
      p.rect(wx + 13, 73, 2, 9, '#f4ece0');
      p.sRect(wx - 3, 93, 22, 4, WOOD);
      for (let i = 0; i < 9; i++) {
        const c = ['#e85d75', '#f6d35b', '#ef7fa0', '#ffffff', '#9b7fd1'][i % 5];
        p.set(wx - 1 + i * 2 + 1, 92, '#5f9e4f');
        p.set(wx - 1 + i * 2, 91, c);
        p.set(wx - 1 + i * 2 + 1, 91, c);
        p.set(wx - 1 + i * 2, 92, '#4c8a36');
      }
    }
    // 门：门框、两扇门板、把手；上面一个小雨棚和一盏灯
    p.sRect(60, 74, 24, 34, TRIM, { noHi: true });
    p.sRect(63, 77, 18, 31, WOOD);
    for (const [x, y] of [[65, 80], [73, 80], [65, 93], [73, 93]]) p.sRect(x, y, 6, 11, ramp(WOOD).mid, { noHi: true });
    p.rect(72, 77, 1, 31, ramp(WOOD).lo);
    p.rect(77, 92, 2, 2, '#f2c14e');
    p.rect(67, 92, 2, 2, '#f2c14e');
    p.poly([[54, 74], [90, 74], [85, 67], [59, 67]], ROOF);
    for (let x = 60; x < 86; x += 5) p.rect(x, 68, 1, 6, RR.lo);
    p.rect(54, 73, 36, 1, RR.lo);
    p.rect(55, 74, 3, 8, WOOD);
    p.rect(86, 74, 3, 8, WOOD);
    p.sRect(90, 79, 4, 6, '#3a3a42');
    p.rect(91, 81, 2, 2, '#ffe28a');
    // 门口的台阶和门垫
    p.sRect(56, 119, 32, 4, '#b9b2a6');
    p.sRect(59, 123, 26, 4, '#a8a196');
    p.rect(64, 106, 16, 2, '#a85a3a');
    // 墙根的小花丛
    for (const [x, c] of [[16, '#ef7fa0'], [20, '#f6d35b'], [124, '#9b7fd1'], [128, '#e85d75']] as [number, string][]) {
      p.sEll(x, 105, 3, 2.5, '#5f9e4f');
      p.set(x - 1, 103, c);
      p.set(x + 1, 104, c);
    }
  } },
  // 家具
  bed: { w: 32, h: 32, tw: 2, th: 2, room: true, draw(p) {
    p.sRect(1, 2, 30, 6, '#8a5a3b');
    p.sRect(2, 8, 28, 22, '#f4ece0');
    p.sRect(2, 15, 28, 15, '#5a8fe0');
    for (let y = 18; y < 30; y += 4) p.rect(2, y, 28, 1, ramp('#5a8fe0').mid);
    p.sRect(5, 9, 9, 5, '#ffffff');
    p.sRect(18, 9, 9, 5, '#ffffff');
    p.rect(1, 29, 30, 2, ramp('#8a5a3b').lo);
  } },
  rug: { w: 32, h: 32, tw: 2, th: 2, room: true, flat: true, draw(p) {
    p.ell(16, 16, 15, 12, '#c8664a');
    p.ell(16, 16, 12, 9, '#e8b07a');
    p.ell(16, 16, 8, 5.5, '#c8664a');
    p.ell(16, 16, 4, 2.5, '#f6d35b');
  } },
  table: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
    p.sRect(1, 2, 30, 6, '#b07a4a');
    p.sRect(3, 8, 3, 7, '#8a5a3b');
    p.sRect(26, 8, 3, 7, '#8a5a3b');
    p.sRect(12, 0, 6, 3, '#fbf7ef');
    p.set(14, 0, '#ef7fa0');
  } },
  chair: { w: 16, h: 16, tw: 1, th: 1, room: true, draw(p) {
    p.sRect(3, 0, 10, 7, '#b07a4a');
    p.sRect(2, 7, 12, 3, '#c8664a');
    p.sRect(3, 10, 2, 5, '#8a5a3b');
    p.sRect(11, 10, 2, 5, '#8a5a3b');
  } },
  bookshelf: { w: 16, h: 32, tw: 1, th: 1, room: true, draw(p) {
    p.sRect(0, 0, 16, 31, '#8a5a3b');
    const cols = ['#c8463a', '#3b6ea8', '#f2c14e', '#6aa35a', '#9b7fd1', '#e8793a'];
    for (const y of [3, 11, 19]) {
      p.rect(2, y, 12, 7, '#5a3a28');
      for (let i = 0; i < 6; i++) p.sRect(2 + i * 2, y + (i % 3 === 1 ? 1 : 0), 2, 7 - (i % 3 === 1 ? 1 : 0), cols[(i + y) % 6], { noHi: true });
    }
    p.rect(2, 27, 12, 3, '#5a3a28');
  } },
  floorlamp: { w: 16, h: 32, tw: 1, th: 1, room: true, draw(p) {
    p.sRect(7, 10, 2, 19, '#6a5a4a');
    p.sRect(4, 28, 8, 3, '#6a5a4a');
    p.poly([[3, 10], [13, 10], [11, 2], [5, 2]], '#f6dca0');
    p.rect(4, 9, 8, 1, ramp('#f6dca0').mid);
  } },
  plant: { w: 16, h: 24, tw: 1, th: 1, room: true, draw(p) {
    p.sRect(4, 15, 8, 8, '#c8664a');
    p.rect(3, 15, 10, 2, ramp('#c8664a').hi);
    canopy(p, [[8, 9, 5, 5], [4, 7, 3, 3], [12, 6, 3, 3], [8, 3, 3, 3]], '#5f9e4f');
  } },
  sofa: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
    p.sRect(2, 1, 28, 7, '#7a9a8a');
    p.sRect(0, 5, 5, 10, '#7a9a8a');
    p.sRect(27, 5, 5, 10, '#7a9a8a');
    p.sRect(4, 8, 24, 6, '#8ab0a0');
    p.rect(15, 8, 1, 6, ramp('#8ab0a0').lo);
  } },
  desk: { w: 32, h: 16, tw: 2, th: 1, room: true, draw(p) {
    p.sRect(1, 4, 30, 5, '#8a5a3b');
    p.sRect(2, 9, 3, 6, '#6a4a32');
    p.sRect(22, 9, 8, 6, '#6a4a32');
    p.rect(24, 11, 4, 1, '#f2c14e');
    p.sRect(6, 0, 7, 4, '#fbf7ef');
    p.rect(7, 1, 5, 1, '#9b9488');
    p.sRect(17, 0, 3, 4, '#3b6ea8');
  } },
  fireplace: { w: 32, h: 32, tw: 2, th: 1, room: true, draw(p) {
    p.sRect(1, 2, 30, 29, '#a8a29a');
    for (let y = 6; y < 31; y += 5) p.rect(1, y, 30, 1, ramp('#a8a29a').mid);
    p.rect(7, 13, 18, 18, '#3a2a26');
    p.sEll(16, 27, 6, 4, '#f08a3a');
    p.sEll(16, 26, 3.5, 3, '#f6d35b');
    p.sRect(0, 0, 32, 3, '#8a5a3b');
  } },
  painting: { w: 16, h: 16, tw: 1, th: 1, room: true, wall: true, draw(p) {
    p.sRect(1, 2, 14, 11, '#c49a6c');
    p.rect(3, 4, 10, 7, '#9fd0f0');
    p.rect(3, 8, 10, 3, '#7fb35a');
    p.sEll(10, 6, 1.6, 1.6, '#f6d35b');
  } },
  window: { w: 16, h: 16, tw: 1, th: 1, room: true, wall: true, draw(p) {
    p.sRect(1, 1, 14, 13, '#8a5a3b');
    p.rect(2, 2, 12, 11, '#9fd0f0');
    p.rect(2, 2, 4, 3, '#e8f6ff');
    p.rect(7, 2, 1, 11, '#8a5a3b');
    p.rect(2, 7, 12, 1, '#8a5a3b');
  } },
};
