// 词库定义和内置数据：考试词库、专业词库、词根和单词拆解

import { Entry, ExamBook, ExamEntry, Mode, Parts, TermBook } from './types';

// ================= 词库定义 =================

// bit 对应 tools/build_words.py 里 TAGS 的顺序
// bits：这个词库包含哪些标签的词。四六级、考研按大纲是累加的：
// CET-4 包含高考词汇，CET-6、GEE（考研）包含 CET-4 词汇，宁多勿少
export const EXAM_BOOKS: ExamBook[] = [
  { id: 'cet4', name: 'CET-4', bits: [2, 1] },
  { id: 'cet6', name: 'CET-6', bits: [3, 2, 1] },
  { id: 'ky', name: 'GEE', bits: [4, 2, 1] }, // 考研，Graduate Entrance Examination
  { id: 'toefl', name: 'TOEFL', bits: [6] },
  { id: 'ielts', name: 'IELTS', bits: [5] },
  { id: 'toeic', name: 'TOEIC', bits: [9] },
  { id: 'gre', name: 'GRE', bits: [7] },
  { id: 'gmat', name: 'GMAT', bits: [8] },
];

// 专业词库，由 tools/build_terms.py 根据 data/<目录>/*.tsv 生成
// Finance：经济、金融、会计、管理、公司治理、资本市场等；Medicine：西医、中医、中药、经络穴位等
// MacroFin：高级宏微观、宏观金融、DSGE、货币政策、财政政策、宏观调控、计量方法
export const TERM_BOOKS: TermBook[] = [
  { id: 'fin', name: 'Finance', key: 'MARGIN_FINANCE' },
  { id: 'mf', name: 'MacroFin', key: 'MARGIN_MACROFIN' },
  { id: 'med', name: 'Medicine', key: 'MARGIN_MEDICINE' },
];

export const BASIC_MASK = (1 << 0) | (1 << 1); // 中考、高考

export const WRONG_BOOK = '__wrong';
export const REVIEW_BOOK = '__review';

// 间隔复习：第 b 盒的词，隔 INTERVALS[b] 天再复习（简化的 Leitner 盒子法）
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

export const MODES: Record<string, { name: string; desc: string }> = {
  en2zh: { name: '英 → 中', desc: '看英文，写中文意思' },
  zh2en: { name: '中 → 英', desc: '看中文，拼写英文' },
  listen: { name: '听 → 写', desc: '听发音，拼写英文' },
};

// 每轮的三步：同一组词先英→中，再中→英，最后听→写
export const STAGES: Mode[] = ['en2zh', 'zh2en', 'listen'];

export const CJK_RE = /[㐀-鿿豈-﫿]/;

// ================= 内置数据 =================

export const EXAM_WORDS: ExamEntry[] = []; // { w, p, m, mask }
export const TERM_WORDS: Record<string, Entry[]> = {}; // 词库 id -> [{ w, p, m, s, t }]
export const LOOKUP = new Map<string, Entry>(); // 小写单词 -> 词条，导入时自动补释义用

(function loadBuiltin() {
  const exam = window.MARGIN_DICT || '';
  if (exam) {
    for (const line of exam.split('\n')) {
      const [w, p, m, mask, x] = line.split('\t');
      const e = { w, p, m, mask: +mask, x: x || '' };
      EXAM_WORDS.push(e);
      if (!LOOKUP.has(w.toLowerCase())) LOOKUP.set(w.toLowerCase(), e);
    }
  }
  for (const b of TERM_BOOKS) {
    const list: Entry[] = (TERM_WORDS[b.id] = []);
    const raw = window[b.key] || '';
    if (!raw) continue;
    for (const line of raw.split('\n')) {
      const [w, p, m, s, t] = line.split('\t');
      const e = { w, p, m, s, t };
      list.push(e);
      if (!LOOKUP.has(w.toLowerCase())) LOOKUP.set(w.toLowerCase(), e);
    }
  }
})();

// 词根词缀和单词拆解：tools/build_roots.py 根据 data/roots/ 生成
export const ROOTS = window.MARGIN_ROOTS || [];
export const ROOT_BY_ID = new Map(ROOTS.map((r) => [r.id, r]));
export const ROOT_TYPES: Record<string, string> = { prefix: '前缀', root: '词根', suffix: '后缀' };
const PARTS = new Map<string, Parts>(); // 小写单词 -> { w, parts, links: [{ id, form, at }] }
for (const line of (window.MARGIN_PARTS || '').split('\n')) {
  if (!line) continue;
  const [w, parts, links] = line.split('\t');
  PARTS.set(w.toLowerCase(), {
    w,
    parts,
    links: (links ? links.split(',') : [])
      .map((x) => {
        const [id, form, at] = x.split('|');
        return { id, form, at: +at };
      })
      .filter((l) => ROOT_BY_ID.has(l.id)),
  });
}

// 单词的拆解；复数、过去式等查不到时退回原形
export function partsOf(word: string): Parts | null {
  const w = String(word).toLowerCase();
  let p = PARTS.get(w);
  if (p) return p;
  for (const [end, add] of [['ies', 'y'], ['ied', 'y'], ['es', ''], ['s', ''], ['ed', ''], ['ed', 'e'], ['ing', ''], ['ing', 'e']]) {
    if (w.length > end.length + 2 && w.endsWith(end) && (p = PARTS.get(w.slice(0, -end.length) + add))) return p;
  }
  return null;
}

// 答完题显示的拆解；词组显示里面各个词的拆解
export function breakdownLines(w: string): string[] {
  const toks = String(w).toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (toks.length === 1) {
    const p = partsOf(toks[0]);
    return p ? [p.parts] : [];
  }
  const out: string[] = [];
  for (const t of toks) {
    const p = partsOf(t);
    if (p && out.length < 3) out.push(t + ' = ' + p.parts);
  }
  return out;
}

export const bookCache: Record<string, Entry[]> = {};
