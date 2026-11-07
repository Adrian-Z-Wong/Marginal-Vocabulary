// 花园和小屋的地面、物件、当前画面

import { setState, state } from '../app/store';
import { dayNum } from '../app/util';
import { ART } from '../art';
import { bagAdd } from './bag';
import { GB, GEXIT, GFIXED, GH, GPATH, GPOND, GW, HOUSE, ITEM_OF_DECOR, OY, RDOOR, RH, RW, TILE, curFloor, floorCount, floorItems, layoutGarden, onStairs, setFloorItems } from './data';
import { DEBRIS, debrisSprite } from './debris';
import { plantStage } from './garden';
import { migrate } from './migrate';
import { decorSize, plantSize } from './occupancy';
import { Placed, Plant, State } from '../app/types';
import { Scene } from './scene';

// ---------- 花园和小屋的画面 ----------
// 用一块 canvas 画：地面整块缓存，房子、植物、装饰、人物、宠物按脚下的位置排前后。
// 花园比窗口大，镜头跟着人物走；点地面走过去，也可以用方向键 / WASD 走。

export let scene: Scene | null = null;
export function setScene(v: typeof scene): void {
  scene = v;
}
export const terrainCache: { key: string; canvas: HTMLCanvasElement | null } = { key: '', canvas: null };
let roomCanvas: (HTMLCanvasElement & { key: string }) | null = null;
export function setRoomCanvas(v: typeof roomCanvas): void {
  roomCanvas = v;
}

export function gardenTerrain(plants: Plant[]): HTMLCanvasElement {
  const soil = new Set<string>();
  const wet = new Set<string>();
  const today = dayNum();
  // 开垦过的地是翻过的土；今天浇过水的植物底下颜色深一点
  for (const k in state.world.till || {}) soil.add(k);
  for (const pl of plants) {
    if (pl.x < 0 || !(pl.w || []).includes(today)) continue;
    const [w, h] = plantSize(pl);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = pl.x + i + ',' + (pl.y + j);
        if (soil.delete(k)) wet.add(k);
      }
  }
  const key = [...soil].sort().join(';') + '|' + [...wet].sort().join(';');
  if (plants === state.world.plants && terrainCache.key === key && terrainCache.canvas) return terrainCache.canvas;
  const c = ART.terrain({ w: GW, h: GH, path: GPATH, soil, wet, water: GPOND, pondFn: (x, y) => ART.pondInside(x, y - OY), exits: GEXIT, border: GB, seed: 11 });
  if (plants === state.world.plants) {
    terrainCache.key = key;
    terrainCache.canvas = c;
  }
  return c;
}

// 花园外面的树林，按需要的宽度（取整到 64 像素）画一次，花园大小变了再重画
let ringCache: { back: HTMLCanvasElement; front: HTMLCanvasElement; key: string; m: number } | null = null;
export function forestRing(out: number): { back: HTMLCanvasElement; front: HTMLCanvasElement; key: string; m: number } {
  const m = Math.ceil((out + 72) / 64) * 64;
  const key = GW + 'x' + GH + ':' + [...GEXIT].join(';');
  if (!ringCache || ringCache.key !== key || ringCache.m < m) ringCache = Object.assign(ART.forestRing({ w: GW, h: GH, m, exits: GEXIT, border: GB, seed: 11 }), { key, m });
  return ringCache;
}

export function roomTerrain(): HTMLCanvasElement & { key: string } {
  const key = RW + 'x' + RH + ':' + curFloor();
  if (!roomCanvas || roomCanvas.key !== key) roomCanvas = Object.assign(ART.room({ w: RW, h: RH, door: curFloor() === 1 ? RDOOR : null, seed: 7 + curFloor() }), { key });
  return roomCanvas;
}

export function roomOcc(skip?: Placed | null, f?: number): Map<string, Placed> {
  const occ = new Map<string, Placed>();
  for (const d of floorItems(f || curFloor())) {
    if (d === skip) continue;
    const [w, h] = decorSize(d.id);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + ',' + (d.y + j), d);
  }
  return occ;
}

// 换了一份数据（清空、导入备份、别的标签页改了）：旧备份照样升级，花园和屋子按新数据重新排
export function adoptState(s: State, fresh: boolean): void {
  setState(s);
  if (fresh) migrate();
  else layoutGarden();
  terrainCache.key = '';
  roomCanvas = null;
  if (scene) scene.stop();
  scene = null;
}

export function roomRelocate(): void {
  for (let f = 1; f <= 3; f++) {
    // 房子变小了（导入旧备份）没有这层楼：东西收回背包
    if (f > floorCount()) {
      for (const d of floorItems(f)) bagAdd(ITEM_OF_DECOR.get(d.id) || 'furn.' + d.id, 1);
      setFloorItems(f, []);
      continue;
    }
    setFloorItems(
      f,
      floorItems(f).filter((d) => {
        if (roomFree(d.id, d.x, d.y, roomOcc(d, f), f)) return true;
        const occ = roomOcc(d, f);
        let best: number[] | null = null;
        let bestD = Infinity;
        for (let y = 1; y < RH; y++)
          for (let x = 0; x < RW; x++) {
            const dd = Math.hypot(x - d.x, y - d.y);
            if (dd < bestD && roomFree(d.id, x, y, occ, f)) {
              best = [x, y];
              bestD = dd;
            }
          }
        if (best) {
          d.x = best[0];
          d.y = best[1];
          return true;
        }
        bagAdd(ITEM_OF_DECOR.get(d.id) || 'furn.' + d.id, 1);
        return false;
      }),
    );
  }
}

export function roomFree(id: string, x: number, y: number, occ?: Map<string, Placed> | null, f?: number): boolean {
  f = f || curFloor();
  occ = occ || roomOcc(null, f);
  const D = ART.DECOR[id];
  const [w, h] = decorSize(id);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const tx = x + i;
      const ty = y + j;
      if (tx < 0 || tx >= RW) return false;
      if (D && D.wall ? ty !== 1 : ty < 2 || ty >= RH) return false;
      if (!D.wall && f === 1 && ty === RH - 1 && RDOOR.includes(tx)) return false;
      if (onStairs(f, tx, ty)) return false;
      if (occ.has(tx + ',' + ty)) return false;
    }
  return true;
}

// 画一个物件：底边对齐格子
/** 画面里的一个物件：图、左上角、脚下的位置（排前后用），植物还带着是哪一株 */
export interface SceneObj {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  base: number;
  plant?: Plant | null;
}

export function objAt(img: HTMLCanvasElement, tx: number, ty: number, tw: number, th: number): SceneObj {
  const base = (ty + th) * TILE;
  return { img, x: tx * TILE + (tw * TILE - img.width) / 2, y: base - img.height, base };
}

export function gardenObjects(plants: Plant[], decor: Placed[], live: boolean): SceneObj[] {
  const out: SceneObj[] = [];
  out.push(objAt(ART.decor(HOUSE.sprite)!, HOUSE.x, HOUSE.y, HOUSE.w, HOUSE.h));
  for (const d of GFIXED) {
    const [w, h] = decorSize(d.id);
    out.push(objAt(ART.decor(d.id)!, d.x, d.y, w, h));
  }
  for (const d of decor) {
    const img = ART.decor(d.id);
    if (!img) continue;
    const [w, h] = decorSize(d.id);
    const o = objAt(img, d.x, d.y, w, h);
    if (ART.DECOR[d.id] && ART.DECOR[d.id].flat) o.base = -1;
    out.push(o);
  }
  for (const d of live ? state.world.debris || [] : []) {
    const D = DEBRIS[d.k];
    const o = objAt(debrisSprite(d), d.x, d.y, D.w, D.h);
    if (d.k === 'tree') o.y += 2;
    out.push(o);
  }
  // 以前的周快照里，植物存成数组 [种类, 品种, x, y, 阶段]
  for (const pl of plants as (Plant & [string, string, number, number, number])[]) {
    const k = pl.k || pl[0];
    const sp = pl.sp || pl[1];
    const x = pl.x != null ? pl.x : pl[2];
    const y = pl.y != null ? pl.y : pl[3];
    if (x < 0) continue;
    const st = pl.k ? plantStage(pl) : pl[4];
    let img;
    if (k === 'tree') img = ART.tree(sp, st);
    else if (k === 'flower') img = ART.flower(sp, st);
    else if (k === 'grass') img = ART.grass(sp, st);
    else img = ART.shrub(sp, st);
    const o = objAt(img, x, y, k === 'tree' ? 2 : 1, 1);
    if (k === 'tree' && st >= 3) o.y += 2;
    o.plant = live ? pl : null;
    out.push(o);
  }
  return out;
}
