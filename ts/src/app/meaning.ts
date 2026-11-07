// 中文释义：拆词性、拆意思层、显示

import { zhTerms } from './judge';
import { esc } from './util';

/** 一层意思：词性和这一层里的几个词 */
export interface Layer {
  pos: string;
  terms: string[];
}

export function meaningLines(m: string | undefined): string[] {
  return String(m || '').split(/\s*[|\n]\s*/).filter(Boolean);
}

// 「n. 环境, 状况」拆成词性和释义
function splitPos(line: string): [string, string] {
  const mt = line.match(/^((?:[a-z]{1,6}\.\s*(?:&\s*)?)+)\s*(.*)$/i);
  return mt ? [mt[1].trim(), mt[2]] : ['', line];
}

// 按逗号、分号、顿号拆成一个个词语（括号里的不拆）
function splitTerms(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if ('(（[［【'.includes(ch)) depth++;
    else if (')）]］】'.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,，;；、]/.test(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const POS_SPLIT_RE = /\s+(?=(?:n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|interj|aux|abbr)\.\s)/i;

// 「意思层」：一层意思显示一行，意思相近的词在同一行。
// 考试词库的释义已经分好层（tools/build_layers.py）：同一词性里「；」隔开不同的意思层，「，」隔开同一层里的词。
// 不带词性的释义（Finance 词库、自己导入的）里用「；」隔开的是同一个意思的几种译法，算一层。
const layerCache = new Map<string, Layer[]>();

export function layersOf(m: string | undefined): Layer[] {
  m = String(m || '');
  if (layerCache.has(m)) return layerCache.get(m)!;
  const lines = meaningLines(m);
  const layers: Layer[] = [];
  if (!lines.some((ln) => splitPos(ln.trim())[0])) {
    const terms = [...new Set(lines.flatMap((ln) => splitTerms(ln)))];
    if (terms.length) layers.push({ pos: '', terms });
  } else {
    const seen = new Set<string>();
    for (const ln of lines) {
      for (const part of ln.split(POS_SPLIT_RE)) {
        const [pos, text] = splitPos(part.trim());
        for (const chunk of text.split(/[；;]/)) {
          const terms = chunk
            .split(/[，,、]/)
            .map((t) => t.trim())
            .filter((t) => {
              const k = zhTerms(t).join('');
              if (!k || seen.has(k)) return false; // 别的词性里出现过的同一个词，算同一层
              seen.add(k);
              return true;
            });
          if (terms.length) layers.push({ pos, terms });
        }
      }
    }
  }
  layerCache.set(m, layers);
  return layers;
}

export function shortMeaning(m: string | undefined): string {
  const first = layersOf(m)[0];
  return first ? first.terms[0] : '';
}

// 中文意思竖着排：一层意思一行，前面编号 1. 2. 3.，意思相近的词放在同一行
export function meaningHtml(m: string | undefined, mask?: string): string {
  const layers = layersOf(m);
  if (!layers.length) return '';
  let lastPos: string | null = null;
  return (
    '<div class="senses">' +
    layers
      .map((L, i) => {
        const pos = L.pos !== lastPos ? L.pos : '';
        lastPos = L.pos;
        const text = L.terms.join('；');
        return '<span class="no">' + (i + 1) + '.</span><span class="pos">' + esc(pos) + '</span><span class="t">' + esc(mask ? maskWord(text, mask) : text) + '</span>';
      })
      .join('') +
    '</div>'
  );
}

// 中→英 题目里，释义可能直接带着答案（比如「X射线的」），遮住它
function maskWord(text: string, w: string): string {
  const k = String(w).trim();
  if (!k) return text;
  const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return text.replace(re, '＿＿');
}
