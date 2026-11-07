// 词库页、词库详情、导入

import { WRONG_BOOK } from '../books';
import { parseImport } from '../importer';
import { bookEntries, bookExists, bookName, findExam, findTerm, isBuiltin } from '../library';
import { meaningHtml } from '../meaning';
import { ui } from '../nav';
import { AFTER, VIEWS } from '../registry';
import { allBooks } from '../render';
import { seenCount } from '../stats';
import { state } from '../store';
import { esc, fmt, keyOf } from '../util';

function bookRowHtml(id: string, extra?: string): string {
  const list = bookEntries(id);
  const seen = seenCount(list);
  const pct = list.length ? (seen / list.length) * 100 : 0;
  const kind = findTerm(id) ? '专业词库' : findExam(id) ? '考试词库' : '我的词表';
  return (
    '<div class="book-row"><div><div class="kind">' + kind + '</div><div class="name">' + esc(bookName(id)) + '</div>' +
    '<div class="meta"><span>' + fmt(list.length) + ' 词</span><span>已背 ' + fmt(seen) + '</span><span class="prog"><i style="width:' + pct + '%"></i></span></div></div>' +
    '<div class="side">' + (extra || '') + '<button class="link" data-act="viewBook" data-id="' + esc(id) + '">查看</button><button class="btn small ghost" data-act="useBook" data-id="' + esc(id) + '">背这个</button></div></div>'
  );
}

VIEWS.books = function () {
  const mine = Object.values(state.books).sort((a, b) => a.t - b.t);
  return (
    '<main class="page">' +
    '<h1 class="h1">词库</h1>' +
    '<div class="section book-grid">' + allBooks().map((id) => bookRowHtml(id)).join('') + '</div>' +
    '<div class="section mine">' +
    '<div class="head-row"><h2 class="h2">我的词表</h2>' +
    '<div class="actions"><button class="btn small" data-act="newImport">＋ 粘贴单词</button>' +
    '<label class="btn small ghost file-pick">上传文件<input type="file" id="upload-book" accept=".txt,.csv,.tsv,.json,text/plain,text/csv,application/json"></label></div></div>' +
    '<p class="sub">把自己要背的单词做成词表：直接粘贴，或者上传 .txt、.csv 文件（Excel 可以另存为 .csv）。只写英文也行，常见词会自动补上中文意思。</p>' +
    (mine.length
      ? '<div class="book-grid">' + mine.map((b) => bookRowHtml(b.id, '<button class="link" data-act="deleteBook" data-id="' + esc(b.id) + '">删除</button>')).join('') + '</div>'
      : '<div class="empty">还没有自己的词表。</div>') +
    '</div>' +
    '</main>'
  );
};

export function bookRowsHtml(): string {
  const id = ui.book.id!;
  const all = bookEntries(id);
  const q = ui.book.q.trim().toLowerCase();
  const list = q ? all.filter((e) => e.w.toLowerCase().includes(q) || String(e.m).includes(q)) : all;
  const custom = !isBuiltin(id) && id !== WRONG_BOOK;
  const shown = list.slice(0, ui.book.limit);
  if (!list.length) return '<div class="empty">' + (q ? '没有找到「' + esc(q) + '」' : '这个词表还没有词') + '</div>';
  return (
    shown
      .map((e) => {
        const k = keyOf(e.w);
        const s = state.stats[k];
        const tag = e.t ? '<span>' + esc(e.t) + '</span>' : '';
        const known = state.known[k] ? '<span>已掌握</span>' : '';
        return (
          '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + (e.p ? '<small>/' + esc(e.p) + '/</small>' : '') + '</button>' +
          '<span class="m">' + (meaningHtml(e.m) || '（没有释义）') + '</span>' +
          '<span class="side">' + tag + (known || (s ? '<span>已背</span>' : '')) + (custom ? '<button class="link" data-act="deleteWord" data-w="' + esc(e.w) + '">删除</button>' : '') + '</span></div>'
        );
      })
      .join('') +
    (list.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRows">再显示 200 个（还有 ' + fmt(list.length - shown.length) + ' 个）</button></div>' : '')
  );
}

VIEWS.book = function () {
  const id = ui.book.id!;
  if (!bookExists(id)) return VIEWS.books();
  const custom = !isBuiltin(id);
  return (
    '<main class="page">' +
    '<p class="label"><button class="link" data-act="nav" data-view="books">← 词库</button></p>' +
    '<h1 class="h1">' + esc(bookName(id)) + '</h1>' +
    '<p class="sub">' + fmt(bookEntries(id).length) + ' 词 · 点单词可以听发音</p>' +
    '<div class="actions"><button class="btn small" data-act="useBook" data-id="' + esc(id) + '">背这个词表</button>' +
    (custom ? '<button class="btn small ghost" data-act="appendImport" data-id="' + esc(id) + '">添加单词</button><button class="link" data-act="renameBook" data-id="' + esc(id) + '">改名</button>' : '') +
    '<button class="link" data-act="exportBook" data-id="' + esc(id) + '">导出为表格</button>' +
    '</div>' +
    '<div class="section"><input class="field" id="book-q" placeholder="搜索单词或中文" value="' + esc(ui.book.q) + '" autocomplete="off"></div>' +
    '<div class="section" id="book-rows">' + bookRowsHtml() + '</div>' +
    '</main>'
  );
};

export function previewHtml(): string {
  const d = ui.draft;
  if (!d || !d.text.trim()) return '<span class="muted">粘贴后这里会显示识别结果。</span>';
  const r = parseImport(d.text);
  let s = '识别到 <b>' + r.words.length + '</b> 个词';
  if (r.filled) s += '，其中 ' + r.filled + ' 个自动补上了中文意思';
  s += '。';
  if (r.missing.length) {
    s += '<br><span class="muted">' + r.missing.length + ' 个词没有中文意思，也没查到（' + esc(r.missing.slice(0, 5).map((e) => e.w).join('、')) + (r.missing.length > 5 ? ' 等' : '') + '），这些词只能用「听 → 写」练。</span>';
  }
  if (r.bad.length) s += '<br><span class="muted">' + r.bad.length + ' 行看不出英文单词，已跳过（' + esc(r.bad.slice(0, 3).join('、')) + '）。</span>';
  return s;
}

VIEWS.import = function () {
  const d = ui.draft!;
  const target = d.target && state.books[d.target];
  return (
    '<main class="page">' +
    '<p class="label"><button class="link" data-act="nav" data-view="books">← 词库</button></p>' +
    '<h1 class="h1">' + (target ? '添加到「' + esc(target.name) + '」' : '导入新词表') + '</h1>' +
    '<p class="sub">把单词粘贴到下面，一行一个。只写英文也行，常见词会自动补上中文意思。</p>' +
    (target ? '' : '<div class="section" style="margin-top:0"><p class="label">词表名称</p><input class="field" id="draft-name" value="' + esc(d.name) + '" autocomplete="off"></div>') +
    '<div class="section grid2" style="grid-template-columns: 1.6fr 1fr">' +
    '<div><p class="label">单词</p><textarea class="paste" id="draft-text" placeholder="abandon 放弃&#10;benefit n. 好处；利益&#10;candidate&#10;moral hazard 道德风险">' + esc(d.text) + '</textarea>' +
    '<div class="preview" id="draft-preview">' + previewHtml() + '</div></div>' +
    '<div><p class="label">支持的格式</p><div class="formats">' +
    '<b>abandon 放弃</b><br><b>abandon	v. 放弃</b><br>从 Excel 复制两列也行<br><br>' +
    '<b>abandon /əˈbændən/ v. 放弃</b><br>带音标、词性<br><br>' +
    '<b>abandon</b><br>只写单词，自动查意思<br><br>' +
    '<b>moral hazard 道德风险</b><br>词组也可以' +
    '</div>' +
    '<p style="margin-top:20px"><label class="file-pick link">或者选一个 .txt / .csv 文件<input type="file" id="draft-file" accept=".txt,.csv,.tsv,.json,text/plain,text/csv,application/json"></label></p>' +
    '</div></div>' +
    '<div class="actions" style="margin-top:40px"><button class="btn" data-act="saveImport">保存</button><button class="link" data-act="nav" data-view="books">取消</button></div>' +
    '</main>'
  );
};

AFTER.import = function () {
  const t = document.getElementById('draft-text');
  if (t && !ui.draft!.text) t.focus();
};
