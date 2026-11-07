// 一组背完的结果页

import { MODES, STAGES } from '../books';
import { BURST, ICON_BAD, ICON_OK } from '../dialogs';
import { bookName } from '../library';
import { meaningHtml } from '../meaning';
import { ui } from '../nav';
import { VIEWS } from '../registry';
import { allResults, stageAll } from '../session';
import { esc } from '../util';
import { nextLabel, wrongWords } from './practice';

VIEWS.result = function () {
  const ss = ui.session;
  if (!ss) return VIEWS.home();
  const all = allResults(ss);
  const total = all.length;
  const right = all.filter((r) => r.ok).length;
  const wrong = wrongWords(ss);
  const stageLine = STAGES.map((k, i) => {
    const res = stageAll(ss, i);
    const reps = ss.retries.filter((x) => x.stage === i).length;
    return '<div><div class="num">' + (res.length ? res.filter((r) => r.ok).length + '<small> / ' + res.length + '</small>' : '—') + '</div><div class="cap">' + (i + 1) + ' · ' + MODES[k].name + (reps ? ' · 重来 ' + reps + ' 遍' : '') + '</div></div>';
  }).join('');
  const mark = (v: boolean | undefined, i: number) => '<span class="mk' + (v === true ? ' ok' : v === false ? ' bad' : '') + '" title="' + MODES[STAGES[i]].name + '">' + (v === true ? ICON_OK : v === false ? ICON_BAD : '·') + '</span>';
  const list = wrong.length
    ? '<div class="section"><div class="head-row"><p class="label">答错过的词 · ' + wrong.length + '</p><span class="muted">右边三个标记依次是 英→中、中→英、听→写</span></div>' +
      wrong
        .map(
          (x) =>
            '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(x.entry.w) + '">' + esc(x.entry.w) + (x.entry.p ? '<small>/' + esc(x.entry.p) + '/</small>' : '') + '</button>' +
            '<span class="m">' + meaningHtml(x.entry.m) + '</span><span class="side marks">' + [0, 1, 2].map((i) => mark(x.marks[i], i)).join('') + '</span></div>'
        )
        .join('') +
      '</div>'
    : '';
  const rate = total ? Math.round((right / total) * 100) : 0;
  const perfect = total > 0 && right === total;
  const word = perfect ? '全对，漂亮。' : rate >= 80 ? '很稳，错的几个再练一下就好。' : '错的词已经记进错题本，复习时还会出现。';
  return (
    '<main class="page">' +
    '<section class="result-hero' + (perfect ? ' perfect' : '') + '">' + (perfect ? BURST : '') +
    '<p class="label">' + (ss.ended ? '提前结束' : '本轮结束') + ' · ' + esc(bookName(ss.bookId as string)) + '</p>' +
    '<div class="score">' + right + '<small> / ' + total + '</small></div>' +
    '<p class="rate">正确率 ' + rate + '% · ' + word + '</p>' +
    '</section>' +
    '<div class="today stage-line">' + stageLine + '</div>' +
    '<div class="actions" style="margin-top:32px">' +
    (wrong.length ? '<button class="btn" data-act="retryWrong">再练错的 ' + wrong.length + ' 个 <kbd>R</kbd></button>' : '') +
    (nextLabel(ss) ? '<button class="btn ' + (wrong.length ? 'ghost' : '') + '" data-act="nextGroup">' + nextLabel(ss) + ' <kbd>Enter</kbd></button>' : '') +
    '<button class="link" data-act="nav" data-view="home">回首页</button>' +
    '</div>' + list +
    '</main>'
  );
};
