// 按钮的操作（data-act）

import { adoptState } from '../world/terrain';
import { REVIEW_BOOK, WRONG_BOOK } from './books';
import { askConfirm, askText, toast } from './dialogs';
import { applyTheme } from './events';
import { createBook, openNewBook, parseImport } from './importer';
import { bookEntries, isBuiltin } from './library';
import { meaningLines } from './meaning';
import { go, ui } from './nav';
import { ACTIONS, Action } from './registry';
import { render } from './render';
import { quitRootSession, rootAnswer, rootNext, startRootNew, startRootReview } from './roots/quiz';
import { rootRowsHtml, studyRootWords } from './roots/views';
import { continueStage, current, quitSession, skipKnown, startNew, startReview, startSession, startWrong, submitAnswer } from './session';
import { speak } from './speech';
import { FIRST_BOOK, freshState, save, state } from './store';
import { checkUpdate, installUpdate } from './update';
import { DESKTOP, downloadText, keyOf, shuffle, todayKey } from './util';
import { bookRowsHtml } from './views/books';
import { wrongWords } from './views/practice';

// ================= 交互 =================

Object.assign(ACTIONS, {
  nav(t) {
    if (ui.view === 'practice') quitSession();
    if (ui.view === 'rootquiz' && ui.rs && !ui.rs.done && t.dataset.view !== 'roots') quitRootSession();
    go(t.dataset.view);
  },
  startNew() {
    startNew();
  },
  startReview() {
    startReview();
  },
  speakCurrent() {
    const e = current();
    if (e && ui.session!.mode !== 'zh2en') speak(e.w);
    const input = document.getElementById('answer');
    if (input) input.focus();
  },
  speakWord(t) {
    if (ui.view === 'practice' && ui.session && ui.session.mode === 'zh2en') return;
    speak(t.dataset.w);
  },
  next() {
    submitAnswer();
  },
  quit() {
    quitSession();
  },
  skipKnown() {
    skipKnown();
  },
  unknow(t) {
    delete state.known[keyOf(t.dataset.w)];
    save();
    render();
  },
  exportBook(t) {
    const id = t.dataset.id;
    const lines = bookEntries(id).map((e) => e.w + '\t' + meaningLines(e.m).join('；'));
    // 文件名只用英文：有的浏览器遇到中文文件名会改成 download
    const slug = id === WRONG_BOOK ? 'wrong-words' : id === REVIEW_BOOK ? 'review' : isBuiltin(id) ? id : 'my-list';
    downloadText('margin-' + slug + '-' + todayKey() + '.txt', '\ufeff' + lines.join('\r\n'));
    toast('已导出 ' + lines.length + ' 个词，可以用 Excel 打开，也能导入 Anki');
  },
  retryWrong() {
    const ss = ui.session!;
    const words = wrongWords(ss).map((x) => x.entry);
    if (words.length) startSession(shuffle(words), ss.bookId, ss.kind === 'new' ? 'retry' : ss.kind);
  },
  nextGroup() {
    const ss = ui.session;
    if (!ss || ss.kind === 'new' || ss.kind === 'retry') startNew();
    else if (ss.kind === 'review') startReview();
    else startWrong();
  },
  continueStage() {
    continueStage();
  },
  viewBook(t) {
    ui.book = { id: t.dataset.id, q: '', limit: 200 };
    go('book');
  },
  useBook(t) {
    state.settings.book = t.dataset.id;
    save();
    go('home');
  },
  moreRows() {
    ui.book.limit += 200;
    document.getElementById('book-rows')!.innerHTML = bookRowsHtml();
  },
  async deleteBook(t) {
    const b = state.books[t.dataset.id];
    if (!b || !(await askConfirm('删除词表「' + b.name + '」？背诵记录和错题本不受影响。', '删除'))) return;
    delete state.books[b.id];
    if (state.settings.book === b.id) state.settings.book = FIRST_BOOK;
    save();
    render();
  },
  async renameBook(t) {
    const b = state.books[t.dataset.id];
    if (!b) return;
    const name = await askText('新的词表名称', b.name);
    if (name && name.trim()) {
      b.name = name.trim();
      save();
      render();
    }
  },
  deleteWord(t) {
    const b = state.books[ui.book.id!];
    if (!b) return;
    const k = keyOf(t.dataset.w);
    b.words = b.words.filter((e) => keyOf(e.w) !== k);
    save();
    render();
  },
  newImport() {
    const n = Object.keys(state.books).length + 1;
    ui.draft = { target: null, name: '我的词表 ' + n, text: '' };
    go('import');
  },
  appendImport(t) {
    ui.draft = { target: t.dataset.id, name: '', text: '' };
    go('import');
  },
  saveImport() {
    const d = ui.draft!;
    const r = parseImport(d.text);
    if (!r.words.length) {
      toast('还没有识别到单词');
      return;
    }
    let book = d.target && state.books[d.target];
    let added = r.words.length;
    if (book) {
      const have = new Map(book.words.map((e) => [keyOf(e.w), e]));
      added = 0;
      for (const e of r.words) {
        const old = have.get(keyOf(e.w));
        if (old) {
          if (e.m) old.m = e.m;
          if (e.p) old.p = e.p;
        } else {
          book.words.push(e);
          added++;
        }
      }
    } else {
      book = createBook(d.name, r.words);
    }
    ui.draft = null;
    openNewBook(book, added);
  },
  practiceWrong() {
    startWrong();
  },
  viewRoot(t) {
    if (ui.roots.id !== t.dataset.id) ui.roots.wordLimit = 50;
    ui.roots.id = t.dataset.id;
    go('root');
  },
  rootType(t) {
    ui.roots.type = t.dataset.type;
    ui.roots.limit = 200;
    render();
  },
  moreRoots() {
    ui.roots.limit += 200;
    document.getElementById('root-rows')!.innerHTML = rootRowsHtml();
  },
  moreRootWords() {
    ui.roots.wordLimit += 50;
    render();
  },
  studyRootWords() {
    studyRootWords();
  },
  startRootNew() {
    startRootNew();
  },
  startRootReview() {
    startRootReview();
  },
  rootPick(t) {
    rootAnswer(+t.dataset.n);
  },
  rootNext() {
    rootNext();
  },
  rootQuit() {
    quitRootSession();
  },
  removeWrong(t) {
    delete state.wrong[keyOf(t.dataset.w)];
    save();
    render();
  },
  async clearWrong() {
    if (!(await askConfirm('清空错题本？', '清空'))) return;
    state.wrong = {};
    save();
    render();
  },
  setting(t) {
    state.settings[t.dataset.key] = JSON.parse(t.dataset.val);
    save();
    applyTheme();
    render();
  },
  testVoice() {
    speak('Marginal Vocabulary');
  },
  checkUpdate() {
    checkUpdate(true);
  },
  installUpdate() {
    installUpdate();
  },
  relaunchApp() {
    if (DESKTOP) window.__TAURI__!.core!.invoke('relaunch').catch((e) => toast('重新打开失败：' + e + '，请手动退出后再打开'));
  },
  hideUpdate() {
    ui.update!.show = false;
    render();
  },
  toggleUpdateNotes() {
    ui.update!.open = !ui.update!.open;
    render();
  },
  exportData() {
    downloadText('marginal-vocabulary-backup-' + todayKey() + '.json', JSON.stringify({ app: 'Marginal Vocabulary', v: 1, exported: new Date().toISOString(), data: state }), 'application/json');
    toast('备份已下载');
  },
  async resetAll() {
    if (!(await askConfirm('清空所有数据？自己导入的词表、背诵记录、错题本都会删除，无法恢复。', '清空'))) return;
    adoptState(freshState(), true);
    applyTheme();
    render();
    toast('已清空');
  },
} satisfies Record<string, Action>);
