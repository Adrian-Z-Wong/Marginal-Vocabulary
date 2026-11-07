// 键盘、点击、输入、换主题、别的标签页改了数据

import { refreshSceneUi } from '../world/sceneui';
import { adoptState, scene } from '../world/terrain';
import { askConfirm, toast } from './dialogs';
import { createBook, decodeFile, openNewBook, parseImport } from './importer';
import { app, go, ui } from './nav';
import { ACTIONS, ActEl } from './registry';
import { render } from './render';
import { quitRootSession, rootAnswer, rootNext, startRootNew, startRootReview } from './roots/quiz';
import { rootRowsHtml } from './roots/views';
import { continueStage, quitSession, startNew, startReview, submitAnswer } from './session';
import { STORE_KEY, loadState, normalizeState, save, state } from './store';
import { bookRowsHtml, previewHtml } from './views/books';
import { nextLabel } from './views/practice';

export function applyTheme() {
  const root = document.documentElement;
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  root.setAttribute('data-weight', state.settings.weight || 'normal');
}

export function initEvents(): void {
  // 花园和小屋里：方向键 / WASD 走路，Esc 放下手里的工具
  document.addEventListener('keydown', (ev) => {
    if (!scene || (ui.view !== 'garden' && ui.view !== 'room') || document.querySelector('.modal')) return;
    const tag = (ev.target as HTMLInputElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (ev.key === 'Escape' && ui.tool) {
      ui.tool = null;
      refreshSceneUi();
      return;
    }
    if (ev.key === '+' || ev.key === '=' || ev.key === '-' || ev.key === '_') {
      scene.zoomBy(ev.key === '-' || ev.key === '_' ? -1 : 1);
      ev.preventDefault();
      return;
    }
    if (scene.key(ev, true)) ev.preventDefault();
  });
  document.addEventListener('keyup', (ev) => {
    if (scene) scene.key(ev, false);
  });
  window.addEventListener('blur', () => {
    if (scene) scene.keys = {};
  });

  app.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t || t.tagName === 'SELECT') return;
    const fn = ACTIONS[t.dataset.act!];
    if (fn) fn(t as ActEl, ev);
  });

  app.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.act === 'setBook') {
      state.settings.book = t.value;
      save();
      render();
    } else if (t.dataset.act === 'setRootBook') {
      state.settings.rootBook = t.value;
      ui.roots.limit = 200;
      save();
      render();
    } else if (t.id === 'draft-file' && t.files![0]) {
      t.files![0].arrayBuffer().then((buf) => {
        const text = decodeFile(buf);
        ui.draft!.text = ui.draft!.text.trim() ? ui.draft!.text.trim() + '\n' + text : text;
        if (!ui.draft!.target && /^我的词表 \d+$/.test(ui.draft!.name)) ui.draft!.name = t.files![0].name.replace(/\.[^.]+$/, '');
        render();
      });
    } else if (t.id === 'upload-book' && t.files![0]) {
      const file = t.files![0];
      file.arrayBuffer().then((buf) => {
        const r = parseImport(decodeFile(buf));
        if (!r.words.length) {
          toast('这个文件里没有识别到单词');
          return;
        }
        openNewBook(createBook(file.name.replace(/\.[^.]+$/, ''), r.words), r.words.length);
      });
    } else if (t.id === 'backup-file' && t.files![0]) {
      t.files![0].text().then(async (text) => {
        let obj = null;
        try {
          obj = JSON.parse(text);
        } catch (e) {
          obj = null;
        }
        // 改名前导出的备份写的是 Margin
        if (!obj || (obj.app !== 'Marginal Vocabulary' && obj.app !== 'Margin') || !obj.data) {
          toast('这个文件不是 Marginal Vocabulary 的备份');
          return;
        }
        if (!(await askConfirm('用这个备份覆盖现在的数据？', '覆盖'))) return;
        adoptState(normalizeState(obj.data), true);
        applyTheme();
        render();
        toast('备份已导入');
      });
    }
  });

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  app.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'draft-text') {
      ui.draft!.text = t.value;
      clearTimeout(previewTimer!);
      previewTimer = setTimeout(() => {
        const el = document.getElementById('draft-preview');
        if (el) el.innerHTML = previewHtml();
      }, 200);
    } else if (t.id === 'draft-name') {
      ui.draft!.name = t.value;
    } else if (t.id === 'roots-q') {
      ui.roots.q = t.value;
      ui.roots.limit = 200;
      document.getElementById('root-rows')!.innerHTML = rootRowsHtml();
    } else if (t.id === 'book-q') {
      ui.book.q = t.value;
      ui.book.limit = 200;
      document.getElementById('book-rows')!.innerHTML = bookRowsHtml();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.isComposing || ev.keyCode === 229) return; // 中文输入法正在选字
    if (document.querySelector('.modal')) return;
    const tag = (ev.target as HTMLInputElement).tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

    if (ui.view === 'practice') {
      if (ui.session && ui.session.between) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          continueStage();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          quitSession();
        }
        return;
      }
      if (ev.key === 'Enter' && (ev.target as HTMLInputElement).classList.contains('ans') && !ui.session!.pending) {
        // 这一行写了字、下面还有行：跳到下一行；空行或最后一行：提交
        ev.preventDefault();
        const next = document.querySelector<HTMLElement>('.ans[data-line="' + (+(ev.target as HTMLInputElement).dataset.line! + 1) + '"]');
        if ((ev.target as HTMLInputElement).value.trim() && next) next.focus();
        else submitAnswer();
      } else if (ev.key === 'Enter' && ((ev.target as HTMLInputElement).id === 'answer' || (ev.target as HTMLInputElement).classList.contains('ans') || !typing)) {
        ev.preventDefault();
        submitAnswer();
      } else if (ev.key === 'Tab') {
        ev.preventDefault();
        (ACTIONS.speakCurrent as () => void)();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        quitSession();
      }
      return;
    }
    if (ui.view === 'rootquiz') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        rootNext();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        if (ui.rs && ui.rs.done) go('roots');
        else quitRootSession();
      } else if (!typing && /^[1-4]$/.test(ev.key)) {
        rootAnswer(+ev.key - 1);
      }
      return;
    }
    if (typing) return;
    if (ui.view === 'roots') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        startRootNew();
      } else if (ev.key === 'r' || ev.key === 'R') {
        startRootReview();
      }
    } else if (ui.view === 'root') {
      if (ev.key === 'Escape') go('roots');
    } else if (ui.view === 'home') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        startNew();
      } else if (ev.key === 'r' || ev.key === 'R') {
        startReview();
      }
    } else if (ui.view === 'result') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (nextLabel(ui.session!)) (ACTIONS.nextGroup as () => void)();
        else go('home');
      } else if (ev.key === 'r' || ev.key === 'R') {
        (ACTIONS.retryWrong as () => void)();
      } else if (ev.key === 'Escape') {
        go('home');
      }
    }
  });
  // 其他标签页改了数据（比如同时开了两个 Marginal Vocabulary），这里跟着更新
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORE_KEY && ui.view !== 'practice') {
      adoptState(loadState(), false);
      applyTheme();
      render();
    }
  });
}
