// 花园里的格子：谁占了哪儿、东西放不下时挪开

import { state } from '../app/store';
import { ART } from '../art';
import { bagAdd } from './bag';
import { GB, GFIXED, GH, GPATH, GPOND, GW, HOUSE } from './data';
import { DEBRIS } from './debris';
import { plantMax, plantStage, setTilled } from './garden';
import { Debris, GardenSnap, Placed, Plant } from '../app/types';

/** 格子上有什么（"x,y" → 那个东西） */
export type Occ = Map<string, { house?: boolean; pond?: boolean; fixed?: Placed; plant?: Plant; decor?: Placed; debris?: Debris }>;

export function plantSize(pl: Plant): [number, number] {
  return pl.k === 'tree' ? [2, 1] : [1, 1];
}

export function decorSize(id: string): [number, number] {
  const d = ART.DECOR[id];
  return d ? [d.tw, d.th] : [1, 1];
}

// 花园的规模：长大的树、开了的花、长好的灌木和草，还有正在长的
export function summarize(plants: Plant[], decor?: Placed[]): GardenSnap {
  const s: GardenSnap = { t: 0, y: 0, f: 0, s: 0, g: 0, w: GW, h: GH, p: [], dc: [] };
  for (const pl of plants) {
    const st = plantStage(pl);
    const full = st >= plantMax(pl);
    if (pl.k === 'tree') full ? s.t++ : s.y++;
    else if (pl.k === 'flower' && full) s.f++;
    else if (pl.k === 'shrub' && full) s.s++;
    else if (pl.k === 'grass' && full) s.g++;
    s.p.push([pl.k, pl.sp, pl.x, pl.y, st]);
  }
  for (const d of decor || []) s.dc.push([d.id, d.x, d.y]);
  return s;
}

// 一共种大了多少棵树（t）/ 养开了多少朵花（f）
export function gardenCount(key: 't' | 'f'): number {
  return (state.world.grown && state.world.grown[key]) || 0;
}

// 格子上有什么：房子、池塘、地上本来有的东西、植物、装饰
// 只有房子、池塘、地上本来有的东西
function baseOcc(): Occ {
  const occ: Occ = new Map();
  for (let y = HOUSE.y; y < HOUSE.y + HOUSE.h; y++) for (let x = HOUSE.x; x < HOUSE.x + HOUSE.w; x++) occ.set(x + ',' + y, { house: true });
  for (const k of GPOND) occ.set(k, { pond: true });
  for (const d of GFIXED) {
    const [w, h] = decorSize(d.id);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + ',' + (d.y + j), { fixed: d });
  }
  return occ;
}

export function gardenOcc(skip?: Plant | Placed | Debris | null): Occ {
  const occ = baseOcc();
  for (const pl of state.world.plants) {
    if (pl === skip) continue;
    const [w, h] = plantSize(pl);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(pl.x + i + ',' + (pl.y + j), { plant: pl });
  }
  for (const d of state.world.decor) {
    if (d === skip) continue;
    const [w, h] = decorSize(d.id);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + ',' + (d.y + j), { decor: d });
  }
  for (const d of state.world.debris || []) {
    if (d === skip) continue;
    const D = DEBRIS[d.k];
    for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) occ.set(d.x + i + ',' + (d.y + j), { debris: d });
  }
  return occ;
}

export function gardenFree(x: number, y: number, w: number, h: number, occ?: Occ): boolean {
  occ = occ || gardenOcc();
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const tx = x + i;
      const ty = y + j;
      if (tx < GB || ty < GB || tx >= GW - GB || ty >= GH - GB) return false;
      // 房子后面被屋顶挡住的那一条，不种也不摆
      if (ty < HOUSE.y && tx >= HOUSE.x - 1 && tx <= HOUSE.x + HOUSE.w) return false;
      if (GPATH.has(tx + ',' + ty) || occ.has(tx + ',' + ty)) return false;
    }
  return true;
}

// 布局变了以后（比如旧版本的花园），压在房子、路、池塘上的东西挪到最近的空地；实在没地方，装饰收回背包
export function relocate(): number {
  const W = state.world;
  let moved = 0;
  const fix = (item: Plant | Placed, w: number, h: number) => {
    if (gardenFree(item.x, item.y, w, h, gardenOcc(item))) return true;
    const occ = gardenOcc(item);
    let best: number[] | null = null;
    let bestD = Infinity;
    for (let y = GB; y < GH - GB; y++)
      for (let x = GB; x < GW - GB; x++) {
        const d = Math.hypot(x - item.x, y - item.y);
        if (d < bestD && gardenFree(x, y, w, h, occ)) {
          best = [x, y];
          bestD = d;
        }
      }
    if (!best) return false;
    item.x = best[0];
    item.y = best[1];
    moved++;
    return true;
  };
  W.plants = W.plants.filter((pl) => {
    const [w, h] = plantSize(pl);
    return fix(pl, w, h);
  });
  W.decor = W.decor.filter((d) => {
    const [w, h] = decorSize(d.id);
    if (fix(d, w, h)) return true;
    bagAdd('decor.' + d.id, 1);
    return false;
  });
  // 杂物压到房子、路、池塘、植物、摆设上的，直接没了
  if (W.debris) {
    const occD = baseOcc();
    for (const pl of W.plants) {
      const [w, h] = plantSize(pl);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occD.set(pl.x + i + ',' + (pl.y + j), { plant: pl });
    }
    for (const d of W.decor) {
      const [w, h] = decorSize(d.id);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occD.set(d.x + i + ',' + (d.y + j), { decor: d });
    }
    W.debris = W.debris.filter((d) => {
      const D = DEBRIS[d.k];
      if (!D || !gardenFree(d.x, d.y, D.w, D.h, occD)) return false;
      for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) occD.set(d.x + i + ',' + (d.y + j), { debris: d });
      return true;
    });
  }
  // 开垦过的地：压到房子、路、池塘、原来就有的东西下面的不算了；植物底下一定是开垦过的
  const base = baseOcc();
  for (const k of Object.keys(W.till || {})) {
    const [x, y] = k.split(',').map(Number);
    if (!gardenFree(x, y, 1, 1, base)) delete W.till![k];
  }
  for (const pl of W.plants) {
    const [w, h] = plantSize(pl);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setTilled(pl.x + i, pl.y + j, true);
  }
  return moved;
}

// 房子长高、花园上边多出几行时，开垦过的地跟着往下挪
export function shiftTilled(dy: number): void {
  const T = state.world.till || {};
  const out: Record<string, number> = {};
  for (const k in T) {
    const [x, y] = k.split(',').map(Number);
    out[x + ',' + (y + dy)] = 1;
  }
  state.world.till = out;
}
