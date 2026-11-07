// 错题本页

import { WRONG_BOOK } from '../books';
import { meaningHtml } from '../meaning';
import { VIEWS } from '../registry';
import { state } from '../store';
import { esc } from '../util';

VIEWS.wrong = function () {
  const list = Object.values(state.wrong).sort((a, b) => b.n - a.n || b.t - a.t);
  const known = Object.values(state.known).sort((a, b) => b.t - a.t);
  const knownHtml =
    '<div class="section"><div class="head-row"><p class="label">已掌握 · ' + known.length + ' 词</p></div>' +
    (known.length
      ? known
          .map(
            (e) =>
              '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + '</button>' +
              '<span class="m">' + meaningHtml(e.m) + '</span>' +
              '<span class="side"><button class="link" data-act="unknow" data-w="' + esc(e.w) + '">恢复</button></span></div>'
          )
          .join('')
      : '<div class="empty">背诵时点「已掌握，跳过」，这个词以后就不会再出现，会列在这里。</div>') +
    '</div>';
  return (
    '<main class="page">' +
    '<h1 class="h1">错题本</h1><p class="sub">答错的词会记在这里，每天的复习里都会有；一轮里每一步都答对，就自动移出。</p>' +
    (list.length
      ? '<div class="actions"><button class="btn" data-act="practiceWrong">练习错题本 · ' + list.length + ' 词</button><button class="link" data-act="exportBook" data-id="' + WRONG_BOOK + '">导出为表格</button><button class="link" data-act="clearWrong">清空错题本</button></div>' +
        '<div class="section">' +
        list
          .map(
            (e) =>
              '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + (e.p ? '<small>/' + esc(e.p) + '/</small>' : '') + '</button>' +
              '<span class="m">' + meaningHtml(e.m) + '</span>' +
              '<span class="side"><span>错 ' + e.n + ' 次</span><button class="link" data-act="removeWrong" data-w="' + esc(e.w) + '">移出</button></span></div>'
          )
          .join('') +
        '</div>'
      : '<div class="empty">错题本是空的。</div>') +
    knownHtml +
    '</main>'
  );
};
