// 花园里要清理的杂草、石头、野树

import { save, state } from '../app/store';
import { dayNum, fmt } from '../app/util';
import { ART } from '../art';
import { bagAdd } from './bag';
import { GB, GH, GW, HOUSE } from './data';
import { tilled } from './garden';
import { Occ, gardenFree, gardenOcc } from './occupancy';
import { Debris } from '../app/types';
import { Sprite } from '../art/pix';

// ---- 花园里要清理的东西 ----
// 每种：用什么工具、花几点体力、占几格、能不能踩过去、掉多少木材 / 石料
/** 杂物：tool 用什么工具清理、st 花几点体力、w × h 占几格、walk 能不能踩过去、wood / stone 掉多少木材 / 石料 */
export interface DebrisKind {
  tool: string;
  st: number;
  w: number;
  h: number;
  walk?: boolean;
  name: string;
  wood?: number[];
  stone?: number[];
}

export const DEBRIS: Record<string, DebrisKind> = {
  weed: { tool: 'scythe', st: 1, w: 1, h: 1, walk: true, name: '杂草' },
  twig: { tool: 'axe', st: 1, w: 1, h: 1, walk: true, name: '树枝', wood: [1, 2] },
  rock: { tool: 'pickaxe', st: 2, w: 1, h: 1, name: '石头', stone: [1, 2] },
  boulder: { tool: 'pickaxe', st: 5, w: 2, h: 2, name: '大石头', stone: [6, 8] },
  stump: { tool: 'axe', st: 4, w: 2, h: 2, name: '树桩', wood: [4, 5] },
  tree: { tool: 'axe', st: 6, w: 2, h: 1, name: '野树', wood: [8, 10] },
};
export const CLEAR_TOOLS = ['scythe', 'pickaxe', 'axe'];
export const TOOL_NAME: Record<string, string> = { hoe: '锄头', scythe: '镰刀', pickaxe: '十字镐', axe: '斧头' };
const WILD_TREES = ['oak', 'pine', 'maple', 'birch'];
export function debrisSprite(d: Debris): Sprite {
  if (d.k === 'tree') return ART.tree(d.sp!, 4);
  if (d.k === 'weed' || d.k === 'rock') return ART.decor(d.k + (d.v || 1))!;
  return ART.decor(d.k)!;
}
// 房子跟前留一块空地，不长杂物
function nearHouse(x: number, y: number): boolean {
  return x >= HOUSE.x - 5 && x < HOUSE.x + HOUSE.w + 5 && y < HOUSE.y + HOUSE.h + 7;
}
function debrisFits(x: number, y: number, D: DebrisKind, occ: Occ): boolean {
  if (!gardenFree(x, y, D.w, D.h, occ)) return false;
  for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) if (tilled(x + i, y + j) || nearHouse(x + i, y + j)) return false;
  return true;
}
// 在 ok(x, y) 允许的空草地上撒杂物：新开的地是一片荒地，长满杂草、野树，遍地石头
// （每 100 格大约：杂草 20、石头 9、树枝 7、野树 4、大石头 1.6、树桩 1.6）
export function seedDebris(ok: (x: number, y: number) => boolean): void {
  const W = state.world;
  if (!W.debris) W.debris = [];
  const occ = gardenOcc();
  const cand: number[][] = [];
  for (let y = GB; y < GH - GB; y++) for (let x = GB; x < GW - GB; x++) if (ok(x, y)) cand.push([x, y]);
  const R = Math.random;
  for (const [k, per] of [['tree', 4], ['boulder', 1.6], ['stump', 1.6], ['rock', 9], ['twig', 7], ['weed', 20]] as [string, number][]) {
    const D = DEBRIS[k];
    let n = Math.round((cand.length * per) / 100);
    for (let tries = 0; n > 0 && tries < 40 * n + 40; tries++) {
      const [x, y] = cand[Math.floor(R() * cand.length)];
      if (!ok(x + D.w - 1, y + D.h - 1) || !debrisFits(x, y, D, occ)) continue;
      const d: Debris = { k, x, y };
      if (k === 'weed') d.v = 1 + Math.floor(R() * 3);
      if (k === 'rock') d.v = 1 + Math.floor(R() * 2);
      if (k === 'tree') d.sp = WILD_TREES[Math.floor(R() * WILD_TREES.length)];
      W.debris!.push(d);
      for (let j = 0; j < D.h; j++) for (let i = 0; i < D.w; i++) occ.set(x + i + ',' + (y + j), { debris: d });
      n--;
    }
  }
}
// 每过一天，空草地上冒出几棵杂草、几块小石头和树枝（最多攒 400 个）
export function debrisTick(): void {
  const W = state.world;
  if (!W.debris) return;
  const today = dayNum();
  if (W.debrisDay == null) W.debrisDay = today;
  const days = Math.min(3, today - W.debrisDay);
  if (days <= 0) return;
  W.debrisDay = today;
  const occ = gardenOcc();
  for (let i = 0; i < days * 3 && W.debris.length < 400; i++) {
    const k = i % 3 === 2 ? (Math.random() < 0.5 ? 'rock' : 'twig') : 'weed';
    for (let t = 0; t < 60; t++) {
      const x = GB + Math.floor(Math.random() * (GW - 2 * GB));
      const y = GB + Math.floor(Math.random() * (GH - 2 * GB));
      if (!debrisFits(x, y, DEBRIS[k], occ)) continue;
      const d: Debris = { k, x, y };
      if (k === 'weed') d.v = 1 + Math.floor(Math.random() * 3);
      if (k === 'rock') d.v = 1 + Math.floor(Math.random() * 2);
      W.debris.push(d);
      occ.set(x + ',' + y, { debris: d });
      break;
    }
  }
  save();
}
// 扩建要的材料够不够；不够的话说还差多少
/** 要花的金币和材料 */
export interface Cost {
  price: number;
  wood?: number;
  stone?: number;
}

export function matsShort(need: Cost): string[] {
  const bag = state.world.bag;
  const out: string[] = [];
  if ((bag.wood || 0) < (need.wood || 0)) out.push('木材 ' + ((need.wood || 0) - (bag.wood || 0)));
  if ((bag.stone || 0) < (need.stone || 0)) out.push('石料 ' + ((need.stone || 0) - (bag.stone || 0)));
  return out;
}
export function costText(need: Cost): string {
  return fmt(need.price) + ' 金币' + (need.wood ? ' · 木材 ' + need.wood : '') + (need.stone ? ' · 石料 ' + need.stone : '');
}
export function payMats(need: Cost): void {
  if (need.wood) bagAdd('wood', -need.wood);
  if (need.stone) bagAdd('stone', -need.stone);
}
