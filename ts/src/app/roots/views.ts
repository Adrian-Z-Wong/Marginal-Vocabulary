// 词根：首页、详情、练习页

import { LOOKUP, ROOTS, ROOT_TYPES } from '../books';
import { BURST, ICON_BAD, ICON_OK, ringHtml, toast } from '../dialogs';
import { available } from '../library';
import { shortMeaning } from '../meaning';
import { ui } from '../nav';
import { AFTER, VIEWS } from '../registry';
import { allBooks } from '../render';
import { startSession } from '../session';
import { state } from '../store';
import { esc, fmt, keyOf, shuffle } from '../util';
import { chipsHtml } from '../views/settings';
import { ROOT_GROUP, ROOT_MODES, ROOT_STAGES, learnedRootsToday, nextRootStage, rootAll, rootBook, rootBookName, rootForms, rootIndex, rootNextLabel, rootReviewPool, rootStageAll, rootsOfBook } from './quiz';
import { Root, RootQ, RootSession, RootUse } from '../types';

// ---------- 词根首页 ----------

function rootList(): Root[] {
  const q = ui.roots.q.trim().toLowerCase().replace(/^-+|-+$/g, '');
  let list = rootsOfBook(rootBook());
  if (ui.roots.type !== 'all') list = list.filter((r) => r.type === ui.roots.type);
  if (!q) return list;
  const rank = (r: Root) => (r.forms.includes(q) ? 0 : r.forms.some((f) => f.startsWith(q)) ? 1 : 2);
  return list
    .filter((r) => r.forms.some((f) => f.includes(q)) || r.meaning.includes(q) || r.examples!.some((x) => x.w.toLowerCase().includes(q)))
    .sort((a, b) => rank(a) - rank(b));
}

export function rootRowsHtml(): string {
  const list = rootList();
  const q = ui.roots.q.trim();
  if (!list.length) return '<div class="empty">' + (q ? '没有找到「' + esc(q) + '」' : '这个词库里没有用到这类词根') + '</div>';
  const idx = rootIndex(rootBook());
  const shown = list.slice(0, ui.roots.limit);
  return (
    shown
      .map((r) => {
        const n = (idx.get(r.id) || []).length;
        return (
          '<button class="list-row root-row" data-act="viewRoot" data-id="' + esc(r.id) + '">' +
          '<span class="w">' + esc(rootForms(r)) + '</span>' +
          '<span class="m">' + esc(r.meaning) + '</span>' +
          '<span class="side"><span>' + ROOT_TYPES[r.type] + '</span>' + (n ? '<span>' + fmt(n) + ' 词</span>' : '') + (state.rootStats[r.id] ? '<span>已学</span>' : '') + '</span></button>'
        );
      })
      .join('') +
    (list.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRoots">再显示 200 个（还有 ' + fmt(list.length - shown.length) + ' 个）</button></div>' : '')
  );
}

function rootBookOptionsHtml(selected: string): string {
  const opt = (id: string) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(rootBookName(id)) + '</option>';
  const mine = Object.values(state.books).sort((a, b) => a.t - b.t).map((b) => b.id);
  return ['all'].concat(allBooks(), mine).map(opt).join('');
}

VIEWS.roots = function () {
  const s = state.settings;
  const book = rootBook();
  const inBook = rootsOfBook(book);
  const learned = learnedRootsToday();
  const studied = inBook.filter((r) => state.rootStats[r.id]).length;
  const rv = rootReviewPool();
  const rvTotal = rv.done + rv.remaining.length;
  const left = s.rootGoal - learned;
  const pct = (a: number, b: number) => (b ? Math.min(100, (a / b) * 100) : 100);
  const types = [['all', '全部'], ['prefix', '前缀'], ['root', '词根'], ['suffix', '后缀']];
  const title = left <= 0 ? '今天的词根学完了' : learned ? '还差 ' + left + ' 个词根' : '今天学 ' + s.rootGoal + ' 个词根';
  return (
    '<main class="page">' +
    '<p class="label">词根 · ' + esc(rootBookName(book)) + ' 用到 ' + fmt(inBook.length) + ' 个词根词缀</p>' +
    '<section class="hero' + (left <= 0 ? ' done' : '') + '">' +
    '<div class="hero-main"><p class="label">今日词根</p>' +
    '<h1 class="h1">' + title + '</h1><p class="sub">每组 ' + ROOT_GROUP + ' 个，过三步：根 → 义、义 → 根、填词根。</p>' +
    '<div class="actions"><button class="btn big" data-act="startRootNew">' + (left > 0 ? '学新词根' : '再学一组') + ' <kbd>Enter</kbd></button></div></div>' +
    ringHtml(learned, s.rootGoal, '词根') +
    '</section>' +
    '<div class="tasks">' +
    '<div class="task"><p class="label">复习</p>' +
    '<div class="num">' + fmt(rv.done) + '<small> / ' + fmt(rvTotal) + '</small></div>' +
    '<div class="bar"><i style="width:' + pct(rv.done, rvTotal) + '%"></i></div>' +
    '<p class="muted">昨天的新词根和答错过的词根</p>' +
    '<button class="btn ghost" data-act="startRootReview"' + (rv.remaining.length ? '' : ' disabled') + '>' + (rv.remaining.length ? '开始复习 <kbd>R</kbd>' : rvTotal ? '复习完了' : '今天没有要复习的词根') + '</button></div>' +
    '<div class="task"><p class="label">学什么</p>' +
    '<div class="pref"><span class="t">词库</span><label class="select"><select data-act="setRootBook" aria-label="词库">' + rootBookOptionsHtml(book) + '</select></label></div>' +
    '<div class="pref"><span class="t">每天学几个词根</span>' + chipsHtml('rootGoal', [5, 10, 20, 30].map((n) => [n, String(n)])) + '</div>' +
    '<div class="bar wide"><i style="width:' + pct(studied, inBook.length) + '%"></i></div>' +
    '<p class="muted">这个词库用到的词根已学 ' + fmt(studied) + ' / ' + fmt(inBook.length) + '</p></div>' +
    '</div>' +
    '<div class="section"><h2 class="h2">查词根</h2>' +
    '<div class="chips" style="margin-top:20px">' +
    types.map(([v, label]) => '<button class="chip' + (ui.roots.type === v ? ' on' : '') + '" data-act="rootType" data-type="' + v + '">' + label + '</button>').join('') +
    '</div>' +
    '<input class="field roots-q" id="roots-q" placeholder="搜索词根、意思或单词" value="' + esc(ui.roots.q) + '" autocomplete="off" spellcheck="false"></div>' +
    '<div class="section root-list" id="root-rows">' + rootRowsHtml() + '</div>' +
    '</main>'
  );
};

// ---------- 词根详情 ----------

function rootWordRow(w: string, parts: string, m: string | undefined): string {
  const e = LOOKUP.get(w.toLowerCase());
  return (
    '<div class="list-row ex-row"><button class="w" data-act="speakWord" data-w="' + esc(w) + '">' + esc(w) + (e && e.p && !/\s/.test(w) ? '<small>/' + esc(e.p) + '/</small>' : '') + '</button>' +
    '<span class="m"><span class="parts">' + esc(parts) + '</span><span class="ex-m">' + esc(m) + '</span></span></div>'
  );
}

// 词组只显示含这个词根的那个词的拆解
function bookWordRow(x: RootUse): string {
  const phrase = /\s/.test(x.e.w);
  return rootWordRow(x.e.w, (phrase ? x.tok + ' = ' : '') + x.p.parts, shortMeaning(x.e.m));
}

VIEWS.root = function () {
  let list = rootList();
  let i = list.findIndex((r) => r.id === ui.roots.id);
  if (i < 0) {
    list = ROOTS;
    i = list.findIndex((r) => r.id === ui.roots.id);
  }
  if (i < 0) return VIEWS.roots();
  const r = list[i];
  const book = rootBook();
  const words = rootIndex(book).get(r.id) || [];
  const shown = words.slice(0, ui.roots.wordLimit);
  const st = state.rootStats[r.id];
  const step = (x: Root | undefined, label: string) => (x ? '<button class="link" data-act="viewRoot" data-id="' + esc(x.id) + '">' + label + '</button>' : '<span></span>');
  return (
    '<main class="page">' +
    '<p class="label"><button class="link" data-act="nav" data-view="roots">← 词根</button></p>' +
    '<p class="label root-type">' + ROOT_TYPES[r.type] + (st ? ' · 答对 ' + st.r + ' 次 · 答错 ' + st.w + ' 次' : '') + '</p>' +
    '<h1 class="root-forms">' + esc(rootForms(r)) + '</h1>' +
    '<div class="root-mean">' + esc(r.meaning) + '</div>' +
    (r.origin ? '<p class="root-origin">' + esc(r.origin) + '</p>' : '') +
    (r.note ? '<p class="root-note">' + esc(r.note) + '</p>' : '') +
    '<div class="section"><div class="head-row"><p class="label">例词</p><span class="muted">点单词听发音</span></div>' +
    r.examples!.map((x) => rootWordRow(x.w, x.parts, x.m)).join('') + '</div>' +
    (book !== 'all'
      ? '<div class="section"><div class="head-row"><p class="label">' + esc(rootBookName(book)) + ' 里的词 · ' + fmt(words.length) + '</p>' +
        (words.length ? '<button class="btn small ghost" data-act="studyRootWords">背这些词</button>' : '') + '</div>' +
        (words.length ? shown.map(bookWordRow).join('') : '<div class="empty">这个词库里没有含这个词根的词。</div>') +
        (words.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRootWords">再显示 50 个（还有 ' + fmt(words.length - shown.length) + ' 个）</button></div>' : '') +
        '</div>'
      : '') +
    '<div class="root-steps">' + step(list[i - 1], '← ' + esc(list[i - 1] ? rootForms(list[i - 1]) : '')) + step(list[i + 1], esc(list[i + 1] ? rootForms(list[i + 1]) : '') + ' →') + '</div>' +
    '</main>'
  );
};

// 用背单词的三步，背这个词库里含这个词根的词（没背过的优先）
export function studyRootWords(): void {
  const words = rootIndex(rootBook()).get(ui.roots.id!) || [];
  const list = available(words.map((x) => x.e));
  if (!list.length) {
    toast('这些词都标记为已掌握了');
    return;
  }
  const fresh = list.filter((e) => !state.stats[keyOf(e.w)]);
  const pick = (fresh.length ? fresh : list).slice(0, state.settings.size);
  startSession(shuffle(pick.slice()), rootBook() === 'all' ? null : rootBook(), 'root');
}

// ---------- 词根练习 ----------

function rootStepsHtml(rs: RootSession): string {
  return ROOT_STAGES.map((k, i) => '<span class="step' + (i === rs.stage ? ' on' : i < rs.stage ? ' done' : '') + '">' + (i + 1) + ' ' + ROOT_MODES[k].name + (i === rs.stage && rs.attempt > 1 ? ' · 第 ' + rs.attempt + ' 遍' : '') + '</span>').join('');
}

// 答完以后显示：词根、来源，再列几个这个词库里的词
function rootAfterHtml(q: RootQ): string {
  const r = q.r;
  const words = q.x.words.filter((w) => !/\s/.test(w.e.w)).slice(0, 3);
  const rows = words.length ? words.map(bookWordRow).join('') : r.examples!.slice(0, 3).map((x) => rootWordRow(x.w, x.parts, x.m)).join('');
  return (
    '<div class="rq-after">' +
    '<p class="rq-root"><b>' + esc(rootForms(r)) + '</b>　' + esc(r.meaning) + (r.origin ? '<span class="root-origin">' + esc(r.origin) + '</span>' : '') + '</p>' +
    '<div class="rq-words">' + rows + '</div>' +
    '<div class="actions" style="justify-content:center;margin-top:20px"><button class="btn small" data-act="rootNext">继续 <kbd>Enter</kbd></button></div></div>'
  );
}

function rootPromptHtml(rs: RootSession, q: RootQ): string {
  const r = q.r;
  const answered = rs.pick !== null;
  if (q.mode === 'fill') {
    const f = q.x.target!;
    const t = f.tok;
    const at = f.fill!.at;
    const len = f.fill!.form.length;
    const gap = answered ? '<u class="gap-ans">' + esc(t.substr(at, len)) + '</u>' : '<span class="gap">' + '_'.repeat(len) + '</span>';
    return (
      '<div class="prompt-word">' + esc(t.slice(0, at)) + gap + esc(t.slice(at + len)) + '</div>' +
      '<div class="rq-hint">' + esc(shortMeaning(f.e.m)) + ' · 空格里的' + ROOT_TYPES[r.type] + '意思是「' + esc(r.meaning) + '」</div>' +
      '<input id="rq-answer" class="answer en' + (answered && !rs.ok ? ' wrong' : '') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"' +
      (answered ? ' readonly value="' + esc(rs.pick) + '"' : ' placeholder="填词根"') + '>'
    );
  }
  if (q.mode === 'r2m') {
    const hint = q.x.words.filter((w) => !/\s/.test(w.e.w)).slice(0, 3).map((w) => w.e.w);
    const words = hint.length ? hint : r.examples!.slice(0, 3).map((x) => x.w);
    return '<p class="label">' + ROOT_TYPES[r.type] + '</p><div class="prompt-word">' + esc(rootForms(r)) + '</div><div class="rq-hint">' + esc(words.join(' · ')) + '</div>';
  }
  return '<p class="label">' + ROOT_TYPES[r.type] + '</p><div class="prompt-mean">' + esc(r.meaning) + '</div>';
}

function rootQuizResultHtml(rs: RootSession): string {
  const all = rootAll(rs);
  const right = all.filter((x) => x.ok).length;
  const stageLine = ROOT_STAGES.map((k, i) => {
    const res = rootStageAll(rs, i);
    const reps = rs.retries.filter((x) => x.stage === i).length;
    return '<div><div class="num">' + (res.length ? res.filter((x) => x.ok).length + '<small> / ' + res.length + '</small>' : '—') + '</div><div class="cap">' + (i + 1) + ' · ' + ROOT_MODES[k].name + (reps ? ' · 重来 ' + reps + ' 遍' : '') + '</div></div>';
  }).join('');
  const mark = (r: Root, i: number) => {
    const xs = rootStageAll(rs, i).filter((y) => y.r === r);
    const v = !xs.length ? null : xs.every((y) => y.ok);
    return '<span class="mk' + (v === true ? ' ok' : v === false ? ' bad' : '') + '" title="' + ROOT_MODES[ROOT_STAGES[i]].name + '">' + (v === null ? '·' : v ? ICON_OK : ICON_BAD) + '</span>';
  };
  const next = rootNextLabel(rs);
  return (
    '<main class="page rq">' +
    '<section class="result-hero' + (all.length && right === all.length ? ' perfect' : '') + '">' + (all.length && right === all.length ? BURST : '') +
    '<p class="label">' + (rs.ended ? '提前结束' : '本组结束') + ' · ' + esc(rootBookName(rs.book)) + '</p>' +
    '<div class="score">' + right + '<small> / ' + all.length + '</small></div>' +
    '<p class="rate">正确率 ' + (all.length ? Math.round((right / all.length) * 100) : 0) + '%</p>' +
    '</section>' +
    '<div class="today stage-line">' + stageLine + '</div>' +
    '<div class="section"><div class="head-row"><p class="label">这一组的词根</p><span class="muted">右边三个标记依次是 根→义、义→根、填词根</span></div>' +
    rs.roots
      .map(
        (x) =>
          '<button class="list-row root-row" data-act="viewRoot" data-id="' + esc(x.r.id) + '">' +
          '<span class="w">' + esc(rootForms(x.r)) + '</span><span class="m">' + esc(x.r.meaning) + '</span>' +
          '<span class="side marks">' + [0, 1, 2].map((i) => mark(x.r, i)).join('') + '</span></button>'
      )
      .join('') +
    '</div>' +
    '<div class="actions" style="margin-top:40px">' + (next ? '<button class="btn" data-act="rootNext">' + next + ' <kbd>Enter</kbd></button>' : '') +
    '<button class="link" data-act="nav" data-view="roots">回到词根 Esc</button></div>' +
    '</main>'
  );
}

VIEWS.rootquiz = function () {
  const rs = ui.rs;
  if (!rs) return VIEWS.roots();
  if (rs.done) return rootQuizResultHtml(rs);
  const total = rs.roots.length * 2 + rs.roots.filter((x) => x.target).length;
  const before = rs.stageResults.slice(0, rs.stage).reduce((a, b) => a + (b ? b.length : 0), 0);
  const done = before + rs.results.length;
  const top =
    '<div class="p-top"><span class="steps">' + rootStepsHtml(rs) + '<span class="book">' + esc(rootBookName(rs.book)) + '</span></span>' +
    '<span class="right"><span>' + (rs.between ? rs.items.length : rs.idx + 1) + ' / ' + rs.items.length + '</span><button class="link" data-act="rootQuit">结束 Esc</button></span></div>' +
    '<div class="bar"><i style="width:' + Math.min(100, (done / (total || 1)) * 100) + '%"></i></div>';
  if (rs.between && rs.repeat) {
    const right = rs.results.filter((x) => x.ok).length;
    return (
      '<main class="page rq">' + top +
      '<section class="card"><div class="inner anim"><div class="stage-done again">' +
      '<p class="label">第 ' + (rs.stage + 1) + ' 步 · ' + ROOT_MODES[rs.mode!].name + (rs.attempt > 1 ? ' · 第 ' + rs.attempt + ' 遍' : '') + '</p>' +
      '<div class="stage-score">' + right + '<small> / ' + rs.results.length + '</small></div>' +
      '<p class="muted">错了 ' + (rs.results.length - right) + ' 个。已开启强制全对，这一步整组再来一遍，全对才进入下一步。</p>' +
      '<div class="actions"><button class="btn" data-act="rootNext">再来一遍 <kbd>Enter</kbd></button></div>' +
      '</div></div></section></main>'
    );
  }
  if (rs.between) {
    const right = rs.results.filter((x) => x.ok).length;
    const next = ROOT_MODES[ROOT_STAGES[nextRootStage(rs, rs.stage + 1)]];
    const perfect = right === rs.results.length;
    return (
      '<main class="page rq">' + top +
      '<section class="card"><div class="inner anim"><div class="stage-done' + (perfect ? ' perfect' : '') + '">' + (perfect ? BURST : '') +
      '<p class="label">第 ' + (rs.stage + 1) + ' 步完成 · ' + ROOT_MODES[rs.mode!].name + '</p>' +
      '<div class="stage-score">' + right + '<small> / ' + rs.results.length + '</small></div>' +
      '<p class="muted">下一步：' + next.name + ' · ' + next.desc + '</p>' +
      '<div class="actions"><button class="btn" data-act="rootNext">继续 <kbd>Enter</kbd></button></div>' +
      '</div></div></section></main>'
    );
  }
  const q = rs.items[rs.idx];
  const answered = rs.pick !== null;
  let body = '';
  if (q.mode !== 'fill') {
    body =
      '<div class="opts' + (q.mode === 'm2r' ? ' forms' : '') + '">' +
      q.options!
        .map((m, i) => {
          const cls = answered ? (i === q.correct ? ' right' : i === rs.pick ? ' wrong' : ' off') : '';
          return '<button class="opt' + cls + '" data-act="rootPick" data-n="' + i + '"' + (answered ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd><span>' + esc(m) + '</span></button>';
        })
        .join('') +
      '</div>';
  }
  const hint =
    q.mode === 'fill'
      ? '<div class="hint"><span><kbd>Enter</kbd> 提交</span><span>空着按 <kbd>Enter</kbd> = 不会</span></div>'
      : '<div class="hint"><span>按 <kbd>1</kbd>–<kbd>4</kbd> 选择</span></div>';
  return (
    '<main class="page rq">' + top +
    '<section class="card"><div class="inner' + (answered ? '' : ' anim') + '">' + rootPromptHtml(rs, q) + '</div></section>' +
    body +
    (answered ? rootAfterHtml(q) : hint) +
    '</main>'
  );
};

AFTER.rootquiz = function () {
  const input = document.getElementById('rq-answer') as HTMLInputElement | null;
  if (input && !input.readOnly) input.focus();
};
