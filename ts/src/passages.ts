// 文章：内置的（按词库挑好的 OpenStax 段落）和自己加的。

import type { CustomPassage, Host, PassageData } from './host';

export const CUSTOM_BOOK = '__custom';

export interface Passage {
  key: string; // 'b:12' 内置第 12 段，'c:abc' 自定义
  text: string;
  source: string; // 出处，一行字
  url?: string;
}

function data(): PassageData | null {
  return window.MARGIN_PASSAGES || null;
}

function builtin(i: number): Passage | null {
  const d = data();
  const p = d && d.passages[i];
  if (!d || !p) return null;
  const src = d.sources[p.src];
  return { key: 'b:' + i, text: p.text, source: 'OpenStax《' + (src ? src.name : p.src) + '》' + p.sec + ' · CC BY 4.0', url: src && src.url };
}

/** 词库里单词的原形集合（小写） */
function wordSet(host: Host, book: string): Set<string> {
  const s = new Set<string>();
  for (const w of host.bookWords(book)) if (w) s.add(w.toLowerCase());
  return s;
}

const cache = new Map<string, number[]>();

/** 某个词库可以打的内置文章（编号）。自己导入的词库：从全部文章里挑这个词库的词出现最多的 30 段 */
export function bookPassages(host: Host, book: string): number[] {
  const d = data();
  if (!d) return [];
  if (d.books[book]) return d.books[book];
  const hit = cache.get(book);
  if (hit) return hit;
  const words = wordSet(host, book);
  if (!words.size) return [];
  const scored = d.passages.map((p, i) => {
    const toks = new Set(p.text.toLowerCase().match(/[a-z]+/g) || []);
    let n = 0;
    for (const t of toks) if (words.has(t) || words.has(t.replace(/(es|s|ed|ing)$/, ''))) n++;
    return [n / Math.sqrt(toks.size || 1), i] as const;
  });
  scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const out = scored.slice(0, 30).filter((x) => x[0] > 0).map((x) => x[1]);
  cache.set(book, out);
  return out;
}

export function customPassages(host: Host): CustomPassage[] {
  const g = host.state().games;
  return g ? g.custom : [];
}

/** 挑一篇：最近打过的先不出 */
export function pickPassage(host: Host, book: string, seen: number[], exclude?: string): Passage | null {
  if (book === CUSTOM_BOOK) {
    const list = customPassages(host).filter((c) => 'c:' + c.id !== exclude);
    const all = list.length ? list : customPassages(host);
    if (!all.length) return null;
    const c = all[Math.floor(Math.random() * all.length)];
    return { key: 'c:' + c.id, text: c.text, source: '自定义 · ' + c.title };
  }
  const ids = bookPassages(host, book);
  if (!ids.length) return null;
  const recent = new Set(seen);
  let pool = ids.filter((i) => !recent.has(i) && 'b:' + i !== exclude);
  if (!pool.length) pool = ids.filter((i) => 'b:' + i !== exclude);
  if (!pool.length) pool = ids;
  return builtin(pool[Math.floor(Math.random() * pool.length)]);
}

export function passageByKey(host: Host, key: string): Passage | null {
  if (key.startsWith('b:')) return builtin(+key.slice(2));
  const c = customPassages(host).find((x) => 'c:' + x.id === key);
  return c ? { key, text: c.text, source: '自定义 · ' + c.title } : null;
}

const REPL: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '″': '"',
  '–': '-', '—': ' - ', '―': ' - ', '−': '-', '‐': '-', '‑': '-',
  '…': '...', ' ': ' ', ' ': ' ', '​': '', '­': '',
  '，': ', ', '。': '. ', '；': '; ', '：': ': ', '！': '! ', '？': '? ', '（': '(', '）': ')',
};

/** 把贴进来的文字变成键盘能直接打的：弯引号换直引号、去掉重音、合并空白；中文等打不出来的字去掉 */
export function normalizeText(raw: string): string {
  let t = raw.replace(/[‘-‟‐-―…  ​­′″−，。；：！？（）]/g, (c) => REPL[c] ?? c);
  t = t.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/[^\x20-\x7e\n\t]/g, ' ');
  t = t.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]+/g, ' ');
  return t.trim();
}

/** 长文章按句子切成一段一段（每段大约 60–120 个词），一局打一段 */
export function splitPassages(text: string): string[] {
  const paras = text.split(/\n{1,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  const words = (s: string) => (s.match(/\S+/g) || []).length;
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  for (const p of paras) {
    const sentences = p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [p];
    for (const s of sentences) {
      if (cur && words(cur) + words(s) > 120) push();
      cur += s.endsWith(' ') ? s : s + ' ';
      if (words(cur) >= 60) push();
    }
    if (words(cur) >= 30) push();
  }
  push();
  // 太短的尾巴并到前一段
  if (out.length > 1 && words(out[out.length - 1]) < 25) {
    const last = out.pop() as string;
    out[out.length - 1] += ' ' + last;
  }
  return out;
}
