// 词库里的词：取词、复习池、今天学了多少

import { BASIC_MASK, EXAM_BOOKS, EXAM_WORDS, REVIEW_BOOK, TERM_BOOKS, TERM_WORDS, WRONG_BOOK, bookCache } from './books';
import { FIRST_BOOK, state } from './store';
import { dayNum, keyOf, todayKey } from './util';
import { Entry, ExamBook, ExamEntry, LogDay, TermBook } from './types';

// ================= 词库 =================

export function findExam(id: string): ExamBook | undefined {
  return EXAM_BOOKS.find((b) => b.id === id);
}
export function findTerm(id: string): TermBook | undefined {
  return TERM_BOOKS.find((b) => b.id === id);
}

// 今天学了多少个新词（第一次答这个词是在今天）
export function learnedToday(): number {
  const today = dayNum();
  let n = 0;
  for (const k in state.stats) if (state.stats[k].f === today) n++;
  return n;
}

// 今日复习：昨天的新词 + 错题本 + 按记忆曲线今天到期的词。今天复习过的不再出现
export function reviewPool(): { done: number; remaining: Entry[] } {
  const today = dayNum();
  const done = (state.log[todayKey()] || ({} as Partial<LogDay>)).rv || [];
  const doneSet = new Set(done);
  const pool = new Map<string, Entry>();
  for (const k in state.srs) {
    const st = state.stats[k];
    if ((st && st.f === today - 1) || state.srs[k].d <= today) pool.set(k, state.srs[k]);
  }
  for (const k in state.wrong) pool.set(k, state.wrong[k]);
  const remaining: Entry[] = [];
  for (const [k, e] of pool) if (!state.known[k] && !doneSet.has(k)) remaining.push(e);
  return { done: done.length, remaining };
}

export function markReviewed(entry: Entry): void {
  const day = todayLog();
  const k = keyOf(entry.w);
  day.rv = day.rv || [];
  if (!day.rv.includes(k)) day.rv.push(k);
}

export function todayLog(): LogDay {
  const k = todayKey();
  return state.log[k] || (state.log[k] = { n: 0, r: 0 });
}

export function bookEntries(id: string): Entry[] {
  if (id === WRONG_BOOK) return Object.values(state.wrong);
  if (id === REVIEW_BOOK) return reviewPool().remaining;
  const ex = findExam(id);
  if (ex) {
    if (!bookCache[id]) {
      // 中考、高考词表里也有的基础词排到最后，「新词优先」时先背更难的词
      const want = ex.bits.reduce((m, b) => m | (1 << b), 0);
      const list = EXAM_WORDS.filter((e) => e.mask & want);
      const basic = (e: ExamEntry) => (e.mask & BASIC_MASK ? 1 : 0);
      bookCache[id] = list.map((e, i) => [e, i] as [ExamEntry, number]).sort((a, b) => basic(a[0]) - basic(b[0]) || a[1] - b[1]).map((x) => x[0]);
    }
    return bookCache[id];
  }
  if (findTerm(id)) return TERM_WORDS[id];
  const c = state.books[id];
  return c ? c.words : [];
}

export function bookName(id: string): string {
  if (id === WRONG_BOOK) return '错题本';
  if (id === REVIEW_BOOK) return '今日复习';
  const b = findExam(id) || findTerm(id);
  if (b) return b.name;
  return state.books[id] ? state.books[id].name : '';
}

export function bookExists(id: string): boolean {
  if (id === WRONG_BOOK || id === REVIEW_BOOK) return true;
  if (findExam(id)) return bookEntries(id).length > 0;
  if (findTerm(id)) return TERM_WORDS[id].length > 0;
  return !!state.books[id];
}

export function studyBook(): string {
  const s = state.settings;
  if (!bookExists(s.book) || s.book === WRONG_BOOK || s.book === REVIEW_BOOK) s.book = FIRST_BOOK;
  return s.book;
}

export function isBuiltin(id: string): boolean {
  return !!(findExam(id) || findTerm(id));
}

// 还没标记为已掌握的词
export function available(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.w && !state.known[keyOf(e.w)]);
}

// 某一步能用的词：英→中、中→英 需要有中文意思
export function usable(entries: Entry[], mode: string): Entry[] {
  return available(entries).filter((e) => mode === 'listen' || e.m);
}
