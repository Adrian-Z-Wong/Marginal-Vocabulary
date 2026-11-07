// 词根：词库、复习、练习流程

import { rewardAnswer, rewardGroup } from '../../world/coins';
import { petJoinStudy, petSay } from '../../world/roam';
import { EXAM_WORDS, REVIEW_BOOK, ROOTS, ROOT_BY_ID, TERM_BOOKS, TERM_WORDS, WRONG_BOOK, partsOf } from '../books';
import { toast } from '../dialogs';
import { bookEntries, bookExists, bookName, isBuiltin } from '../library';
import { go, ui } from '../nav';
import { render } from '../render';
import { speak } from '../speech';
import { save, state } from '../store';
import { dayNum, keyOf, shuffle, todayKey } from '../util';
import { Entry, Root, RootItem, RootQ, RootSession, RootStat, RootUse } from '../types';

// ================= 词根 =================

// 词根的学习和背单词是并列的另一套：选词库、每天学几个，每组依次过三步
export const ROOT_STAGES = ['r2m', 'm2r', 'fill'];
export const ROOT_MODES: Record<string, { name: string; desc: string }> = {
  r2m: { name: '根 → 义', desc: '看词根，选意思' },
  m2r: { name: '义 → 根', desc: '看意思，选词根' },
  fill: { name: '填词根', desc: '在单词里填出词根' },
};
export const ROOT_GROUP = 5; // 每组几个词根

export function rootForms(r: Root): string {
  return r.forms.map((f) => (r.type === 'prefix' ? f + '-' : r.type === 'suffix' ? '-' + f : f)).join(' / ');
}

export function rootBook(): string {
  const s = state.settings;
  if (s.rootBook !== 'all' && (!bookExists(s.rootBook) || s.rootBook === WRONG_BOOK || s.rootBook === REVIEW_BOOK)) s.rootBook = 'all';
  return s.rootBook;
}

export function rootBookName(id: string): string {
  return id === 'all' ? '全部词库' : bookName(id);
}

// 词根 id -> 这个词库里含这个词根的词 [{ e, tok, p, fill }]；fill 是能用来「填词根」的位置
const rootIdxCache: Record<string, Map<string, RootUse[]>> = {};
export function rootIndex(bookId: string): Map<string, RootUse[]> {
  const custom = bookId !== 'all' && !isBuiltin(bookId);
  if (!custom && rootIdxCache[bookId]) return rootIdxCache[bookId];
  const entries = bookId === 'all' ? (EXAM_WORDS as Entry[]).concat(...TERM_BOOKS.map((b) => TERM_WORDS[b.id])) : bookEntries(bookId);
  const idx = new Map<string, RootUse[]>();
  const seen = new Set<string>();
  for (const e of entries) {
    const k = keyOf(e.w);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const toks = k.split(/[^a-z]+/).filter(Boolean);
    const got = new Set<string>();
    for (const t of toks) {
      const p = partsOf(t);
      if (!p) continue;
      const exact = toks.length === 1 && p.w.toLowerCase() === t;
      for (const l of p.links) {
        if (got.has(l.id)) continue;
        got.add(l.id);
        if (!idx.has(l.id)) idx.set(l.id, []);
        const fill = exact && l.at >= 0 && t.substr(l.at, l.form.length) === l.form && l.form.length >= 2 && l.form.length < t.length ? l : null;
        idx.get(l.id)!.push({ e, tok: t, p, fill });
      }
    }
  }
  if (!custom) rootIdxCache[bookId] = idx;
  return idx;
}

// 这个词库里用得到的词根，用到的词越多越靠前（也是学新词根的顺序）
export function rootsOfBook(bookId: string): Root[] {
  const idx = rootIndex(bookId);
  const n = (r: Root) => (idx.get(r.id) || []).length;
  const list = bookId === 'all' ? ROOTS.slice() : ROOTS.filter((r) => n(r) > 0);
  return list.sort((a, b) => n(b) - n(a));
}

export function learnedRootsToday(): number {
  const today = dayNum();
  let n = 0;
  for (const id in state.rootStats) if (state.rootStats[id].f === today) n++;
  return n;
}

// 词根复习：昨天学的新词根 + 答错过的词根。今天复习过的不再出现
export function rootReviewPool(): { done: number; remaining: Root[] } {
  const today = dayNum();
  const done = (state.rootLog[todayKey()] || ({} as { rv?: string[] })).rv || [];
  const doneSet = new Set(done);
  const ids = new Set<string>();
  for (const id in state.rootStats) if (state.rootStats[id].f === today - 1) ids.add(id);
  for (const id in state.rootWrong) ids.add(id);
  const remaining = [...ids].filter((id) => ROOT_BY_ID.has(id) && !doneSet.has(id)).map((id) => ROOT_BY_ID.get(id)!);
  return { done: done.length, remaining };
}

function markRootReviewed(id: string): void {
  const k = todayKey();
  const day = state.rootLog[k] || (state.rootLog[k] = { rv: [] });
  if (!day.rv.includes(id)) day.rv.push(id);
}

// 意思是否相近：有一个词相同就算，出选择题时不放在一起
function sameMeaning(a: string, b: string): boolean {
  const ta = a.split(/[，,；;、\s]+/).filter(Boolean);
  const tb = new Set(b.split(/[，,；;、\s]+/).filter(Boolean));
  return ta.some((t) => tb.has(t));
}

function distractors(r: Root): Root[] {
  const pick: Root[] = [];
  const pools = [rootsOfBook(rootBook()).filter((x) => x.type === r.type), ROOTS.filter((x) => x.type === r.type), ROOTS];
  for (const pool of pools) {
    for (const x of shuffle(pool.slice())) {
      if (pick.length >= 3) break;
      if (x === r || sameMeaning(x.meaning, r.meaning) || pick.some((y) => y === x || sameMeaning(y.meaning, x.meaning))) continue;
      if (x.forms.some((f) => r.forms.includes(f))) continue;
      pick.push(x);
    }
    if (pick.length >= 3) break;
  }
  return pick;
}

function rootQuestion(x: RootItem, mode: string): RootQ {
  const q: RootQ = { r: x.r, x, mode };
  if (mode !== 'fill') {
    const options = shuffle([x.r].concat(distractors(x.r)));
    q.options = options.map((o) => (mode === 'r2m' ? o.meaning : rootForms(o)));
    q.correct = options.indexOf(x.r);
  }
  return q;
}

export function startRootNew(): void {
  const book = rootBook();
  const left = state.settings.rootGoal - learnedRootsToday();
  const n = left > 0 ? Math.min(ROOT_GROUP, left) : ROOT_GROUP;
  const fresh = rootsOfBook(book).filter((r) => !state.rootStats[r.id]);
  if (!fresh.length) {
    toast('这个词库的词根都学过了，换一个词库吧');
    return;
  }
  startRootSession(fresh.slice(0, n), 'new');
}

export function startRootReview(): void {
  const { remaining } = rootReviewPool();
  if (!remaining.length) {
    toast('今天的词根复习做完了');
    return;
  }
  startRootSession(shuffle(remaining.slice()).slice(0, ROOT_GROUP), 'review');
}

function startRootSession(roots: Root[], kind: string): void {
  const book = rootBook();
  const idx = rootIndex(book);
  const pickFill = (list: RootUse[] | undefined) => {
    const ok = (list || []).filter((w) => w.fill);
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  };
  const items = roots.map((r) => {
    const words = idx.get(r.id) || [];
    return { r, words, target: pickFill(words) || (book === 'all' ? null : pickFill(rootIndex('all').get(r.id))) };
  });
  ui.rs = { kind, book, roots: items, stage: -1, mode: null, items: [], idx: 0, pick: null, ok: null, results: [], stageResults: [], retries: [], repeat: false, attempt: 1, between: false, done: false, ended: false };
  beginRootStage(0);
  go('rootquiz');
  petJoinStudy();
}

export function nextRootStage(rs: RootSession, from: number): number {
  for (let i = from; i < ROOT_STAGES.length; i++) {
    if (ROOT_STAGES[i] !== 'fill' || rs.roots.some((x) => x.target)) return i;
  }
  return -1;
}

function beginRootStage(i: number): void {
  const rs = ui.rs!;
  const stage = nextRootStage(rs, i);
  if (stage < 0) return finishRootSession();
  const mode = ROOT_STAGES[stage];
  rs.attempt = stage === rs.stage ? rs.attempt + 1 : 1;
  rs.repeat = false;
  rs.stage = stage;
  rs.mode = mode;
  rs.items = shuffle(rs.roots.filter((x) => mode !== 'fill' || x.target).map((x) => rootQuestion(x, mode)));
  rs.idx = 0;
  rs.pick = null;
  rs.results = [];
  rs.between = false;
}

export function rootAnswer(n: number): void {
  const rs = ui.rs;
  if (!rs || rs.between || rs.done || rs.pick !== null || rs.mode === 'fill') return;
  const q = rs.items[rs.idx];
  if (n < 0 || n >= q.options!.length) return;
  recordRoot(q, n === q.correct, n);
}

function recordRoot(q: RootQ, ok: boolean, pick: number | string): void {
  const rs = ui.rs!;
  rs.pick = pick;
  rs.ok = ok;
  rs.results.push({ r: q.r, ok });
  const today = dayNum();
  const st: RootStat = state.rootStats[q.r.id] || (state.rootStats[q.r.id] = { r: 0, w: 0, f: today });
  const again = !ok && st.w > 0;
  st[ok ? 'r' : 'w']++;
  st.d = today;
  rewardAnswer(rs, ok, again);
  if (rs.kind === 'review') markRootReviewed(q.r.id);
  save();
  render();
  if (q.mode === 'fill') speak(q.x.target!.tok);
}

export function rootNextLabel(rs: RootSession): string {
  if (rs.kind === 'new') {
    const left = state.settings.rootGoal - learnedRootsToday();
    return left > 0 ? '下一组新词根 · 今天还差 ' + left + ' 个' : '再学一组新词根';
  }
  const n = rootReviewPool().remaining.length;
  return n ? '继续复习 · 还剩 ' + n + ' 个' : '';
}

export function rootNext(): void {
  const rs = ui.rs;
  if (!rs) return;
  if (rs.done) {
    if (rootNextLabel(rs)) {
      if (rs.kind === 'new') startRootNew();
      else startRootReview();
    } else go('roots');
    return;
  }
  if (rs.between) {
    if (rs.repeat) {
      // 强制全对：没通过的这一遍记下来，这一步再来一遍
      rs.retries.push({ stage: rs.stage, results: rs.results });
      rs.stageResults[rs.stage] = null;
      beginRootStage(rs.stage);
    } else beginRootStage(rs.stage + 1);
    render();
    return;
  }
  const q = rs.items[rs.idx];
  if (rs.pick === null) {
    if (rs.mode === 'fill') {
      const input = document.getElementById('rq-answer') as HTMLInputElement | null;
      const v = (input ? input.value : '').trim().toLowerCase();
      recordRoot(q, v === q.x.target!.fill!.form, v);
    }
    return;
  }
  rs.idx++;
  rs.pick = null;
  if (rs.idx >= rs.items.length) {
    rs.stageResults[rs.stage] = rs.results;
    if (state.settings.forceAll && rs.results.some((x) => !x.ok)) {
      rs.repeat = true;
      rs.between = true;
      setTimeout(() => petSay('repeat'), 50);
    } else if (nextRootStage(rs, rs.stage + 1) >= 0) {
      rs.between = true;
      const allOk = rs.results.every((x) => x.ok);
      setTimeout(() => petSay(allOk ? 'stagePerfect' : 'stage'), 50);
    } else return finishRootSession();
  }
  render();
}

// 一组结束：这一组里每一步都答对的词根移出错题，答错过的记进去
function finishRootSession(): void {
  const rs = ui.rs!;
  rs.done = true;
  rs.between = false;
  const all = rootAll(rs);
  for (const x of rs.roots) {
    const mine = all.filter((y) => y.r === x.r);
    if (!mine.length) continue;
    if (mine.some((y) => !y.ok)) state.rootWrong[x.r.id] = Date.now();
    else if (!rs.ended) delete state.rootWrong[x.r.id];
  }
  if (all.length) rewardGroup('root', rs.roots.length, !rs.ended && all.every((y) => y.ok), rs.ended);
  save();
  if (!all.length) {
    ui.rs = null;
    go('roots');
    return;
  }
  render();
}

export function rootAll(rs: RootSession): { r: Root; ok: boolean }[] {
  return ([] as { r: Root; ok: boolean }[]).concat(...(rs.stageResults.filter(Boolean) as { r: Root; ok: boolean }[][]), ...rs.retries.map((x) => x.results));
}

export function rootStageAll(rs: RootSession, i: number): { r: Root; ok: boolean }[] {
  return ([] as { r: Root; ok: boolean }[]).concat(...rs.retries.filter((x) => x.stage === i).map((x) => x.results), rs.stageResults[i] || []);
}

export function quitRootSession(): void {
  const rs = ui.rs;
  if (!rs || rs.done) return go('roots');
  if (!rs.between) rs.stageResults[rs.stage] = rs.results;
  rs.ended = true;
  finishRootSession();
}
