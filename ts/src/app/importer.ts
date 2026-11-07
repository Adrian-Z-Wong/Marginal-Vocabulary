// 导入词表、我的词表

import { CJK_RE, LOOKUP } from './books';
import { toast } from './dialogs';
import { go, ui } from './nav';
import { save, state } from './store';
import { keyOf } from './util';
import { Book, Entry } from './types';

// ================= 导入解析 =================

const POS_TAIL_RE = /(?:^|\s)((?:(?:n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|interj|aux|abbr|pl|phr)\.\s*(?:&\s*)?)+)\s*$/i;

/** 导入的一行：bad 是认不出单词的行 */
export interface ParsedLine {
  w: string;
  p: string;
  m: string;
  bad?: string;
}

function parseLine(raw: string): ParsedLine | null {
  let line = raw.replace(/^﻿/, '').trim();
  if (!line || line.startsWith('#')) return null;
  line = line.replace(/^\d+\s*[.、)）:：]\s*/, '');
  let w = '';
  let p = '';
  let m = '';
  if (line.includes('\t')) {
    const parts = line.split('\t').map((s) => s.trim()).filter(Boolean);
    w = parts.shift() || '';
    if (parts.length > 1 && /^[\/\[].*[\/\]]$/.test(parts[0])) p = parts.shift()!.slice(1, -1);
    m = parts.join('|');
  } else {
    line = line.replace(/"/g, '');
    const i = line.search(CJK_RE);
    let head = i >= 0 ? line.slice(0, i) : line;
    m = i >= 0 ? line.slice(i).trim() : '';
    const pm = head.match(/[\/\[]([^\/\]]+)[\/\]]/);
    if (pm) {
      p = pm[1].trim();
      head = head.replace(pm[0], ' ');
    }
    const pos = head.match(POS_TAIL_RE);
    if (pos) {
      m = (pos[1].trim() + ' ' + m).trim();
      head = head.slice(0, pos.index!);
    }
    head = head.replace(/[\s,，;；:：=|\-—–]+$/, '').trim();
    if (i < 0) {
      // 没有中文：可能是「word, english meaning」，也可能只有单词
      const sep = head.match(/\s*[,，;；:：=|\t]\s*|\s+[-—–]\s+/);
      if (sep) {
        m = head.slice(sep.index! + sep[0].length).trim();
        head = head.slice(0, sep.index!).trim();
      }
    }
    w = head;
  }
  w = w.replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]/.test(w) || w.length > 80) return { bad: raw.trim() } as ParsedLine;
  return { w, p, m };
}

// Qwerty Learner 词库格式：[{"name":"if","trans":["conj. 如果"]}]
function jsonToLines(text: string): string {
  const t = String(text || '').trim();
  if (!t.startsWith('[')) return text;
  try {
    const arr = JSON.parse(t);
    if (!Array.isArray(arr)) return text;
    return arr
      .map((o) => {
        if (!o || typeof o !== 'object') return '';
        const w = o.name || o.word || o.w || '';
        let m = o.trans || o.translation || o.m || '';
        if (Array.isArray(m)) m = m.join('|');
        return w ? w + '\t' + String(m).replace(/\t/g, ' ') : '';
      })
      .join('\n');
  } catch (e) {
    return text;
  }
}

export function parseImport(text: string): { words: Entry[]; filled: number; missing: Entry[]; bad: string[] } {
  text = jsonToLines(text);
  const words: Entry[] = [];
  const seen = new Map<string, Entry>();
  let filled = 0;
  const bad: string[] = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const r = parseLine(raw);
    if (!r) continue;
    if (r.bad) {
      bad.push(r.bad);
      continue;
    }
    const hit = LOOKUP.get(r.w.toLowerCase());
    if (hit) {
      if (!r.m) {
        r.m = hit.m as string;
        filled++;
      }
      if (!r.p) r.p = hit.p || '';
    }
    const k = keyOf(r.w);
    if (seen.has(k)) {
      const old = seen.get(k)!;
      if (!old.m && r.m) old.m = r.m;
      continue;
    }
    const e = { w: r.w, p: r.p, m: r.m };
    seen.set(k, e);
    words.push(e);
  }
  const missing = words.filter((e) => !e.m);
  return { words, filled, missing, bad };
}

export function decodeFile(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    // Excel 在中文 Windows 上另存的 CSV 通常是 GBK 编码
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch (e2) {
      return new TextDecoder('utf-8').decode(buf);
    }
  }
}

// ================= 我的词表 =================

export function createBook(name: string, words: Entry[]): Book {
  const id = 'u' + Date.now().toString(36);
  const book = { id, name: (name || '').trim() || '我的词表 ' + (Object.keys(state.books).length + 1), words, t: Date.now() };
  state.books[id] = book;
  return book;
}

export function openNewBook(book: Book, added: number): void {
  state.settings.book = book.id;
  save();
  ui.book = { id: book.id, q: '', limit: 200 };
  go('book');
  toast('已导入 ' + added + ' 个词');
}
