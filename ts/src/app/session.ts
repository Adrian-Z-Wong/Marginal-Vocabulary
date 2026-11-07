// 背诵流程：一组词分三步

import { rewardAnswer, rewardGroup, wrongBefore } from '../world/coins';
import { petJoinStudy, petSay } from '../world/roam';
import { REVIEW_BOOK, STAGES, WRONG_BOOK } from './books';
import { toast } from './dialogs';
import { enMatch, judge, judgeZhLines } from './judge';
import { available, bookEntries, learnedToday, markReviewed, reviewPool, studyBook, usable } from './library';
import { go, ui } from './nav';
import { render } from './render';
import { speak } from './speech';
import { applyOutcome, bump, markKnown } from './stats';
import { save, state } from './store';
import { keyOf, shuffle } from './util';
import { Entry, Result, Session } from './types';

// ================= 背诵流程 =================

// 背新词：从词库里挑还没背过的词，每组 size 个，直到完成今天的目标（之后可以再背）
export function startNew(): void {
  const s = state.settings;
  const book = studyBook();
  const left = s.goal - learnedToday();
  const n = left > 0 ? Math.min(s.size, left) : s.size;
  const fresh = available(bookEntries(book)).filter((e) => !state.stats[keyOf(e.w)]);
  if (!fresh.length) {
    toast(bookEntries(book).length ? '这个词库的词都背过了，换一个词库吧' : '这个词表还没有词');
    return;
  }
  const words = s.order === 'random' ? shuffle(fresh.slice()).slice(0, n) : shuffle(fresh.slice(0, n));
  startSession(words, book, 'new');
}

export function startReview(): void {
  const { remaining } = reviewPool();
  if (!remaining.length) {
    toast('今天的复习做完了');
    return;
  }
  startSession(shuffle(remaining.slice()).slice(0, state.settings.size), REVIEW_BOOK, 'review');
}

export function startWrong(): void {
  const list = available(Object.values(state.wrong));
  if (!list.length) {
    toast('错题本是空的');
    return;
  }
  startSession(shuffle(list.slice()).slice(0, state.settings.size), WRONG_BOOK, 'wrong');
}

// 一轮：同一组词依次过三步。kind：new 背新词 / review 今日复习 / wrong 错题本 / retry 再练错的
export function startSession(words: Entry[], bookId: string | null, kind: string): void {
  ui.session = { kind, bookId, words, stage: -1, mode: null, items: [], idx: 0, results: [], stageResults: [], retries: [], repeat: false, attempt: 1, pending: null, between: false, ended: false };
  beginStage(0);
  petJoinStudy();
}

// 一轮结束：这一轮里每一步都答对的词，从错题本移出
function finishSession(): void {
  const ss = ui.session;
  if (ss && !ss.finished) {
    ss.finished = true;
    const allOk = new Map<string, boolean>();
    for (const r of allResults(ss)) {
      const k = keyOf(r.entry.w);
      allOk.set(k, allOk.get(k) !== false && r.ok);
    }
    for (const [k, ok] of allOk) if (ok) delete state.wrong[k];
    const all = allResults(ss);
    rewardGroup('word', ss.words.length, !ss.ended && all.length > 0 && all.every((r) => r.ok), ss.ended);
    save();
  }
  go('result');
}

function beginStage(n: number): void {
  const ss = ui.session!;
  ss.attempt = n === ss.stage ? ss.attempt + 1 : 1;
  ss.repeat = false;
  // 跳过没有可用词的步骤（比如导入的词没有中文意思，就只练听写）
  while (n < STAGES.length && !usable(ss.words, STAGES[n]).length) n++;
  if (n >= STAGES.length) {
    finishSession();
    return;
  }
  Object.assign(ss, { stage: n, mode: STAGES[n], items: shuffle(usable(ss.words, STAGES[n]).slice()), idx: 0, results: [], pending: null, between: false, animIdx: -1, animRow: 0 });
  go('practice');
  onPromptShown();
}

export function nextStageIndex(ss: Session): number {
  for (let n = ss.stage + 1; n < STAGES.length; n++) if (usable(ss.words, STAGES[n]).length) return n;
  return -1;
}

function endStage(): void {
  const ss = ui.session!;
  ss.stageResults[ss.stage] = ss.results;
  // 强制全对：这一步有答错的，整组重来这一步
  if (state.settings.forceAll && ss.results.some((r) => !r.ok)) {
    ss.repeat = true;
    ss.between = true;
    render();
    petSay('repeat');
    return;
  }
  if (nextStageIndex(ss) < 0) {
    finishSession();
    return;
  }
  ss.between = true;
  setTimeout(() => petSay(ss.results.every((r) => r.ok) ? 'stagePerfect' : 'stage'), 50);
  render();
}

export function continueStage(): void {
  const ss = ui.session;
  if (!ss || !ss.between) return;
  if (ss.repeat) {
    // 没通过的这一遍记下来（结果页和错题本要用），再把这一步重来一遍
    ss.retries.push({ stage: ss.stage, results: ss.results });
    ss.stageResults[ss.stage] = null;
    beginStage(ss.stage);
    return;
  }
  beginStage(nextStageIndex(ss));
}

export function current(): Entry {
  const ss = ui.session;
  return (ss && ss.items[ss.idx]) as Entry;
}

function onPromptShown(): void {
  const ss = ui.session!;
  const e = current();
  if (!e) return;
  if (ss.mode !== 'zh2en') speak(e.w);
}

export function submitAnswer(): void {
  const ss = ui.session;
  if (!ss) return;
  if (ss.pending) {
    submitPending();
    return;
  }
  const entry = current();
  let ok: boolean;
  let answer: string;
  let lines: string[] | null = null;
  let marks: (boolean | null)[] | null = null;
  if (ss.mode === 'en2zh') {
    lines = [...document.querySelectorAll<HTMLInputElement>('.ans')].map((el) => el.value);
    const j = judgeZhLines(lines, entry);
    ok = j.ok;
    marks = j.marks;
    answer = lines.map((t) => t.trim()).filter(Boolean).join('；');
  } else {
    const input = document.getElementById('answer') as HTMLInputElement | null;
    answer = (input ? input.value : '').trim();
    ok = judge(ss.mode!, entry, answer);
  }
  const result: Result = { entry, answer, lines, marks, ok };
  const again = !ok && wrongBefore(entry);
  bump(entry, ss.mode!, ok);
  applyOutcome(entry, ok);
  rewardAnswer(ss, ok, again);
  if (ss.kind === 'review') markReviewed(entry);
  save();
  if (ok) {
    ss.results.push(result);
    advance();
  } else {
    ss.pending = result;
    render();
    if (ss.mode === 'listen') speak(entry.w);
  }
}

// 拼写题答错后，照着正确拼写打一遍
export function needsCopy(ss: Session): boolean | null {
  return ss.mode !== 'en2zh' && state.settings.copyWrong && ss.pending && !ss.pending.ok;
}

function submitPending(): void {
  const ss = ui.session!;
  const input = document.getElementById('answer') as HTMLInputElement | null;
  if (needsCopy(ss) && input) {
    const v = input.value;
    if (v.trim() && !enMatch(v, ss.pending!.entry.w)) {
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      input.select();
      return;
    }
  }
  finishPending();
}

export function skipKnown(): void {
  const ss = ui.session;
  if (!ss || ss.pending) return;
  const e = current();
  markKnown(e);
  ss.words = ss.words.filter((w) => w !== e);
  save();
  toast('「' + e.w + '」标记为已掌握，以后不再出现');
  advance();
}

function finishPending(): void {
  const ss = ui.session!;
  ss.results.push(ss.pending!);
  ss.pending = null;
  advance();
}

function advance(): void {
  const ss = ui.session!;
  ss.idx++;
  if (ss.idx >= ss.items.length) {
    endStage();
    return;
  }
  render();
  onPromptShown();
}

export function quitSession(): void {
  const ss = ui.session;
  if (!ss) return go('home');
  if (ss.pending) {
    ss.results.push(ss.pending);
    ss.pending = null;
  }
  if (ss.stage >= 0) ss.stageResults[ss.stage] = ss.results;
  if (!allResults(ss).length) {
    ui.session = null;
    return go('home');
  }
  ss.ended = true;
  finishSession();
}

export function allResults(ss: Session): Result[] {
  return ([] as Result[]).concat(...(ss.stageResults.filter(Boolean) as Result[][]), ...ss.retries.map((x) => x.results));
}

// 某一步所有遍数的答题（强制全对时一步可能做了好几遍）
export function stageAll(ss: Session, i: number): Result[] {
  return ([] as Result[]).concat(...ss.retries.filter((x) => x.stage === i).map((x) => x.results), ss.stageResults[i] || []);
}
