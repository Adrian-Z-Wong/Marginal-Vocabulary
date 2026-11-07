// 金币、挑战、成就

import { STAGES } from '../app/books';
import { toast } from '../app/dialogs';
import { learnedToday } from '../app/library';
import { learnedRootsToday } from '../app/roots/quiz';
import { save, state } from '../app/store';
import { dayNum, fmt, keyOf, todayKey } from '../app/util';
import { ACHIEVEMENTS, CARE, CHALLENGES, PTS } from './data';
import { TILL, staminaGain } from './garden';
import { moodUp } from './pets';
import { floatPts, petSay } from './roam';
import { Entry, PointsDay, RootSession, Session } from '../app/types';

// ---------- 金币 ----------

export function pday(): PointsDay {
  const k = todayKey();
  return state.points.days[k] || (state.points.days[k] = { e: 0, x: 0, s: 0, groups: 0, perfect: 0, roots: 0, right: 0, combo: 0, ch: {} });
}

// 等级看累计赚到的金币：第 n 级需要 50 × n × (n − 1)
export function levelOf(e: number): number {
  let n = 1;
  while (50 * (n + 1) * n <= e) n++;
  return n;
}
export const levelNeed = (n: number): number => 50 * n * (n - 1);

export function gain(n: number): void {
  if (n <= 0) return;
  const p = state.points;
  const before = levelOf(p.earned);
  p.bal += n;
  p.earned += n;
  pday().e += n;
  floatPts('+' + n, false);
  const chip = document.querySelector('.pts');
  if (chip && chip.lastChild) chip.lastChild.textContent = fmt(p.bal);
  const after = levelOf(p.earned);
  if (after > before) {
    petSay('level', { n: after });
    toast('升到 ' + after + ' 级了');
  }
}

function lose(n: number): void {
  const p = state.points;
  n = Math.min(n, p.bal);
  if (n <= 0) return;
  p.bal -= n;
  pday().x += n;
  floatPts('−' + n, true);
}

export function spend(n: number): boolean {
  const p = state.points;
  if (p.bal < n) {
    toast('金币不够（还差 ' + fmt(n - p.bal) + '）');
    return false;
  }
  p.bal -= n;
  pday().s += n;
  return true;
}

// 这个词以前答错过吗（第一次答错不扣分，之后再错扣一点）
export function wrongBefore(entry: Entry): boolean {
  const s = state.stats[keyOf(entry.w)];
  if (!s) return false;
  return STAGES.some((m) => s[m] && s[m]![1] > 0);
}

// 每答一题：答对加分、连对奖励；同一个词再错扣一点；宠物陪你背，状态也会好一点
export function rewardAnswer(holder: Session | RootSession, ok: boolean, repeatWrong: boolean): void {
  const d = pday();
  if (ok) {
    gain(PTS.right);
    d.right++;
    moodUp(0.5, 'studyMood', CARE.studyCap);
    holder.combo = (holder.combo || 0) + 1;
    d.combo = Math.max(d.combo, holder.combo);
    if (holder.combo % 5 === 0) gain(PTS.combo);
    const c = holder.combo;
    if (c === 3) petSay('combo3');
    else if (c === 5) petSay('combo5');
    else if (c === 10 || c === 20 || c === 30) petSay('combo10');
  } else {
    holder.combo = 0;
    if (repeatWrong) {
      lose(PTS.again);
      petSay('again');
    } else if (Math.random() < 0.6) petSay('wrong');
  }
  checkChallenges();
}

// 一组结束：发完成奖励，查今日目标、挑战和成就
export function rewardGroup(kind: string, size: number, perfect: boolean, ended: boolean): void {
  const d = pday();
  if (ended) return;
  const st = staminaGain(kind === 'root' ? TILL.root : TILL.word);
  if (st && state.world.hoe) setTimeout(() => toast('体力 +' + st), 900);
  if (kind === 'root') {
    d.roots++;
    gain(PTS.rootDone + (perfect ? PTS.rootPerfect : 0));
    if (perfect) petSay('perfect', { n: PTS.rootPerfect });
    else petSay('done');
    if (learnedRootsToday() >= state.settings.rootGoal && !d.rootGoalDone) {
      d.rootGoalDone = true;
      gain(PTS.rootGoal);
      petSay('goal', { n: PTS.rootGoal });
    }
  } else {
    d.groups++;
    state.points.groups++;
    gain(size);
    if (perfect) {
      d.perfect++;
      state.points.perfects++;
      gain(PTS.perfect);
      petSay('perfect', { n: PTS.perfect });
    } else petSay('done');
    if (learnedToday() >= state.settings.goal && !d.goalDone) {
      d.goalDone = true;
      gain(PTS.goal);
      petSay('goal', { n: PTS.goal });
    }
  }
  checkChallenges();
  checkAchievements();
}

// 每天的挑战：按日期固定挑 3 个
export function todayChallenges(): typeof CHALLENGES {
  let seed = dayNum() * 9301 + 49297;
  const idx = CHALLENGES.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 3).map((i) => CHALLENGES[i]);
}

export function checkChallenges(): void {
  const d = pday();
  for (const c of todayChallenges()) {
    if (d.ch[c.id] || c.val(d) < c.goal) continue;
    d.ch[c.id] = 1;
    gain(c.reward);
    toast('完成每日挑战「' + c.text + '」 +' + c.reward);
    petSay('challenge');
  }
}

// quiet：打开应用时补发已经达成的成就，合成一条提示
export function checkAchievements(quiet?: boolean): void {
  const p = state.points;
  let n = 0;
  let sum = 0;
  let last: (typeof ACHIEVEMENTS)[number] | null = null;
  for (const a of ACHIEVEMENTS) {
    if (p.ach[a.id] || a.val() < a.goal) continue;
    p.ach[a.id] = todayKey();
    gain(a.reward);
    n++;
    sum += a.reward;
    last = a;
  }
  if (!n) return;
  save();
  if (n === 1) toast('解锁成就「' + last!.name + '」 +' + last!.reward);
  else toast('解锁 ' + n + ' 个成就 +' + sum + (quiet ? '，到「商店 → 挑战与成就」看看' : ''));
}
