// 花园：植物生长、锄地、体力

import { state } from '../app/store';
import { dayNum } from '../app/util';
import { ITEMS, TREES } from './data';
import { Plant } from '../app/types';
import { TreeKind } from '../data/types';

// ---------- 花园 ----------

// 这一周的星期一（第几天）
export function weekStart(n?: number | null): number {
  n = n == null ? dayNum() : n;
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7;
  return n - dow;
}

// 长到第几阶段：种下以后每浇一天水长一阶，施一次肥也长一阶（b 是迁移过来时已经长好的阶段）
// 树 0 种子、1 发芽、2 小树苗、3 小树、4 大树；花 0–3（3 开花）；灌木和草 0–2
export function plantMax(pl: Plant): number {
  return pl.k === 'tree' ? 4 : pl.k === 'flower' ? 3 : 2;
}

export function plantStage(pl: Plant): number {
  return Math.min(plantMax(pl), (pl.b || 0) + (pl.w || []).length + (pl.f || 0));
}

export function wateredToday(pl: Plant): boolean {
  return (pl.w || []).includes(dayNum());
}

export function plantName(pl: Plant): string {
  if (pl.k === 'tree') return (TREES.get(pl.sp) || ({} as Partial<TreeKind>)).name || '树木';
  const it = ITEMS.get('seed.' + pl.sp);
  return it ? it.name : pl.sp;
}

// 开垦：先买锄头；开垦一格花金币、用 1 点体力。体力每天回满，背完一组单词、一组词根也能补一点
export const TILL = { cost: 10, max: 20, word: 5, root: 3 };
export function stamina(): { v: number; day: number } {
  const W = state.world;
  const d = dayNum();
  if (!W.stam || W.stam.day !== d) W.stam = { v: TILL.max, day: d };
  return W.stam;
}
export function staminaGain(n: number): number {
  const s = stamina();
  const before = s.v;
  s.v = Math.min(TILL.max, s.v + n);
  return s.v - before;
}
export function tilled(x: number, y: number): boolean {
  return !!(state.world.till && state.world.till[x + ',' + y]);
}
export function setTilled(x: number, y: number, on: boolean): void {
  const T: Record<string, number> = state.world.till || (state.world.till = {});
  if (on) T[x + ',' + y] = 1;
  else delete T[x + ',' + y];
}
// 这一块（w × h）是不是都开垦过了
export function allTilled(x: number, y: number, w: number, h: number): boolean {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!tilled(x + i, y + j)) return false;
  return true;
}
