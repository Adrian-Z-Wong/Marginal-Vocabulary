// 答题统计、错题本、间隔复习

import { INTERVALS } from './books';
import { todayLog } from './library';
import { state } from './store';
import { dayKeyOf, dayNum, keyOf } from './util';
import { Entry, LogDay, Mode, Stat } from './types';

// ================= 统计 =================

// 背过（或标记为已掌握）的词数
export function seenCount(entries: Entry[]): number {
  let n = 0;
  for (const e of entries) {
    const k = keyOf(e.w);
    if (state.stats[k] || state.known[k]) n++;
  }
  return n;
}

// 连续打卡天数：从今天（今天还没背就从昨天）往前数
export function streak(): number {
  let d = dayNum();
  const has = (n: number) => (state.log[dayKeyOf(n)] || ({} as Partial<LogDay>)).n! > 0;
  if (!has(d)) d--;
  let n = 0;
  while (has(d)) {
    n++;
    d--;
  }
  return n;
}

// 记一次答题；f 是第一次背这个词的日子，用来算「今天背了几个新词」和「昨天的新词」
export function bump(entry: Entry, mode: Mode, ok: boolean): void {
  const k = keyOf(entry.w);
  const s: Stat = state.stats[k] || (state.stats[k] = { f: dayNum() });
  const m = s[mode] || (s[mode] = [0, 0, 0]);
  m[ok ? 0 : 1]++;
  m[2] = Math.floor(Date.now() / 1000);
  const day = todayLog();
  day.n++;
  if (ok) day.r++;
}

// 错题本：答错就进；之后某一轮里每一步都答对，就自动移出（见 finishSession）
function markWrong(entry: Entry): void {
  const k = keyOf(entry.w);
  const was = state.wrong[k];
  state.wrong[k] = { w: entry.w, p: entry.p || '', m: entry.m || '', x: entry.x || '', n: (was ? was.n : 0) + 1, t: was ? was.t : Date.now() };
}

// 间隔复习：答错明天再来；答对升一盒，间隔拉长。没到复习日提前答对不升盒
function srsUpdate(entry: Entry, ok: boolean): void {
  const k = keyOf(entry.w);
  const today = dayNum();
  const cur = state.srs[k];
  const base = { w: entry.w, p: entry.p || '', m: entry.m || '', x: entry.x || '' };
  if (!ok) state.srs[k] = Object.assign(base, { b: 1, d: today + INTERVALS[1] });
  else if (!cur) state.srs[k] = Object.assign(base, { b: 2, d: today + INTERVALS[2] });
  else if (today >= cur.d) {
    const b = Math.min(cur.b + 1, INTERVALS.length - 1);
    state.srs[k] = Object.assign(base, { b, d: today + INTERVALS[b] });
  }
}

export function applyOutcome(entry: Entry, ok: boolean): void {
  if (!ok) markWrong(entry);
  srsUpdate(entry, ok);
}

export function markKnown(entry: Entry): void {
  const k = keyOf(entry.w);
  state.known[k] = { w: entry.w, p: entry.p || '', m: entry.m || '', t: Date.now() };
  delete state.wrong[k];
  delete state.srs[k];
}
