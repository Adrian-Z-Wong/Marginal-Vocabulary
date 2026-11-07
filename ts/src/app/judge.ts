// 判分：中文意思（词向量）、英文拼写

import { layersOf } from './meaning';
import { Entry } from './types';

// ================= 判分 =================

export function zhTerms(text: string | undefined): string[] {
  // 括号里的英文缩写（比如「资本资产定价模型（CAPM）」里的 CAPM）也算一个可以接受的答案
  const acronyms: string[] = [];
  String(text || '').replace(/[（(]\s*([A-Za-z][A-Za-z0-9&.\- ]{0,15})\s*[）)]/g, (_, a: string) => (acronyms.push(a.replace(/[^A-Za-z0-9]/g, '').toLowerCase()), _));
  return String(text || '')
    .replace(/[（(［\[【〔<《][^）)］\]】〕>》]*[）)］\]】〕>》]/g, ' ')
    .replace(/(^|[^a-z])(?:[a-z]{1,6}\.)+/gi, '$1 ')
    .split(/[\s,，;；、\/|。.!！?？:：'"“”‘’…·\-—–~～=]+/)
    .map((t) => t.replace(/[^㐀-鿿豈-﫿A-Za-z0-9]/g, '').toLowerCase())
    .map((t) => (t.length > 1 ? t.replace(/[的地得]$/, '').replace(/^[的地得之]/, '') : t))
    .concat(acronyms)
    .filter(Boolean);
}

function commonLen(a: string, b: string): number {
  let best = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = tmp;
    }
  }
  return best;
}

// ---- 中文词向量（tools/build_vectors.py 生成）----
// 两个中文词如果经常翻译同一批英文单词，向量就接近；反义词几乎不会翻译同一个英文单词
const SIM_T = 0.45;
/** 中文词向量：dim 维数，map 词 → 第几行，data 每行 dim 个 -128..127 的数 */
export interface Vectors {
  dim: number;
  map: Map<string, number>;
  data: Int8Array;
}

let VEC: Vectors | false | null = null;
const vecCache = new Map<string, Float32Array | null>();

function loadVectors(): Vectors | false {
  if (VEC !== null) return VEC;
  const raw = window.MARGIN_VEC;
  if (!raw || !raw.data) return (VEC = false);
  const bin = atob(raw.data);
  const data = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = (bin.charCodeAt(i) << 24) >> 24;
  const map = new Map<string, number>();
  raw.words.split('\t').forEach((w, i) => map.set(w, i));
  return (VEC = { dim: raw.dim, map, data });
}

// 词表里有就直接用；没有就按最长匹配拆成几个认识的词，向量相加
function vecOf(term: string): Float32Array | null {
  if (vecCache.has(term)) return vecCache.get(term) as Float32Array | null;
  const V = loadVectors();
  let out: Float32Array | null = null;
  if (V) {
    const acc = new Float32Array(V.dim);
    const add = (row: number) => {
      const o = row * V.dim;
      for (let d = 0; d < V.dim; d++) acc[d] += V.data[o + d];
    };
    let n = 0;
    if (V.map.has(term)) {
      add(V.map.get(term)!);
      n = 1;
    } else {
      for (let i = 0; i < term.length; ) {
        let step = 1;
        for (let L = Math.min(6, term.length - i); L >= 1; L--) {
          const r = V.map.get(term.substr(i, L));
          if (r !== undefined) {
            add(r);
            n++;
            step = L;
            break;
          }
        }
        i += step;
      }
    }
    let norm = 0;
    for (let d = 0; d < V.dim; d++) norm += acc[d] * acc[d];
    if (n && norm) {
      norm = Math.sqrt(norm);
      for (let d = 0; d < V.dim; d++) acc[d] /= norm;
      out = acc;
    }
  }
  vecCache.set(term, out);
  return out;
}

export function similarity(a: string, b: string): number | null {
  const va = vecOf(a);
  const vb = vecOf(b);
  if (!va || !vb) return null;
  let s = 0;
  for (let d = 0; d < va.length; d++) s += va[d] * vb[d];
  return s;
}

const NEG_RE = /^[不无非未没]/;

// 只差一个字、而这两个字意思相反的词（多头 / 空头、进口 / 出口），一律不算对
const OPPOSITE = new Set(
  '多空 多少 上下 进出 入出 买卖 大小 长短 高低 增减 加减 升降 涨跌 正负 内外 前后 主被 顺逆 优劣 收支 盈亏 输赢 胜败 胜负 早晚 新旧 强弱 左右 东西 南北 好坏 真假 是非 有无 开关 借贷 存取 升贬 褒贬 攻守 动静 明暗 首末 始终 生死 得失 利弊 难易 快慢 轻重 远近 深浅 宽窄 厚薄 粗细 冷热 干湿 软硬 松紧 美丑 善恶 贫富 贵贱 进退 出入 起落 正反 积消 乐悲 顺差 买方'
    .split(' ')
    .filter((x) => x.length === 2)
    .flatMap((x) => [x, x[1] + x[0]])
);

function oppositePair(a: string, b: string): boolean {
  if (a.length !== b.length || a === b) return false;
  let diff = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (diff >= 0) return false;
      diff = i;
    }
  }
  return OPPOSITE.has(a[diff] + b[diff]);
}

// 判中文：写的和任何一个释义意思相同或相近就算对
export function zhMatch(answer: string, meaning: string | undefined): boolean {
  const us = zhTerms(answer);
  const rs = zhTerms(meaning);
  for (const u of us) {
    for (const r of rs) {
      if (u === r) return true;
      // 一个带「不、无、非」一个不带，或者只差一个反义字，意思多半相反
      if (NEG_RE.test(u) !== NEG_RE.test(r) || oppositePair(u, r)) continue;
      if (u.length >= 2 && r.includes(u)) return true;
      if (r.length >= 2 && u.includes(r)) return true;
      if (r.length === 1 && u.includes(r) && u.length <= 3) return true;
      // 词向量只比较两个字以上的词；单字和「含…的意思」拆出来的碎片意思太泛
      if (u.length < 2 || r.length < 2) continue;
      const sim = similarity(u, r);
      if (sim !== null ? sim >= SIM_T : commonLen(u, r) >= 2) return true;
    }
  }
  return false;
}

// 拼写必须完全一样（连字符、空格、撇号都算），只忽略大小写和首尾空格
function normEn(s: string | undefined): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ');
}

export function enMatch(answer: string, word: string): boolean {
  const a = normEn(answer);
  return !!a && String(word).split('/').some((w) => normEn(w) === a);
}

export function judge(mode: string, entry: Entry, answer: string): boolean {
  if (!answer.trim()) return false;
  return mode === 'en2zh' ? zhMatch(answer, entry.m) : enMatch(answer, entry.w);
}

// 英→中 要写几行：这个词有几层意思就写几行
export function zhLineCount(entry: Entry): number {
  return Math.max(1, layersOf(entry.m).length);
}

// 英→中 多行判分：每一行要对上一层不同的意思，每一层都写到了才算对
export function judgeZhLines(lines: string[], entry: Entry): { ok: boolean; marks: (boolean | null)[] } {
  const layers = layersOf(entry.m);
  const texts = lines.map((t) => t.trim());
  // 每一行能对上哪几层
  const can = texts.map((t) => (t ? layers.map((L, j) => (zhMatch(t, L.terms.join('；')) ? j : -1)).filter((j) => j >= 0) : []));
  // 二分图匹配：一行只能占一层，两行不能都算同一层
  const owner = new Array(layers.length).fill(-1);
  const assign = (i: number, used: boolean[]): boolean => {
    for (const j of can[i]) {
      if (used[j]) continue;
      used[j] = true;
      if (owner[j] < 0 || assign(owner[j], used)) {
        owner[j] = i;
        return true;
      }
    }
    return false;
  };
  texts.forEach((t, i) => {
    if (t) assign(i, []);
  });
  const matched = new Set(owner.filter((i) => i >= 0));
  const marks = texts.map((t, i) => (t ? matched.has(i) : null));
  return { ok: texts.length === layers.length && marks.every((x) => x === true), marks };
}
