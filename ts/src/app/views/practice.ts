// 背诵页

import { MODES, STAGES, breakdownLines } from '../books';
import { BURST, ICON_BAD, ICON_OK, ICON_SPEAK } from '../dialogs';
import { zhLineCount } from '../judge';
import { available, bookName, learnedToday, reviewPool, usable } from '../library';
import { layersOf, meaningHtml, meaningLines, shortMeaning } from '../meaning';
import { ui } from '../nav';
import { AFTER, VIEWS } from '../registry';
import { current, needsCopy, nextStageIndex, stageAll } from '../session';
import { state } from '../store';
import { esc, keyOf } from '../util';
import { Entry, Result, Session } from '../types';

function slotsHtml(w: string): string {
  if (!state.settings.letterHint) return '';
  let letters = 0;
  const s = Array.from(w)
    .map((c) => {
      if (/[A-Za-z0-9]/.test(c)) {
        letters++;
        return '_';
      }
      return c === ' ' ? '&nbsp;&nbsp;' : esc(c);
    })
    .join('');
  return '<div class="slots" aria-label="' + letters + ' 个字母">' + s + '<span class="n">' + letters + '</span></div>';
}

// 英→中 的记录：左边是你写的每一行（对的打勾，错的划掉），右边是每一层正确意思
function zhDetailHtml(r: Result): string {
  const layers = layersOf(r.entry.m);
  const yours = (r.lines || []).map((t, i) => {
    const ok = r.marks && r.marks[i] === true;
    return '<div class="y ' + (ok ? 'ok' : 'bad') + '"><span class="mk">' + (ok ? ICON_OK : ICON_BAD) + '</span>' + (t.trim() ? esc(t.trim()) : '<span class="none">没写</span>') + '</div>';
  });
  const right = layers.map((L, i) => '<div class="r"><span class="no">' + (i + 1) + '.</span>' + esc(L.terms.join('；')) + '</div>');
  return '<div class="h-detail">' + (r.ok ? '' : '<div class="h-yours">' + yours.join('') + '</div>') + '<div class="h-right">' + right.join('') + '</div></div>';
}

function historyHtml(ss: Session): string {
  return ss.results
    .map((r, i) => {
      const fresh = i === ss.results.length - 1 && ss.animRow !== ss.results.length ? ' fresh' : '';
      const yours = r.ok ? '' : r.answer ? '<span class="yours">' + esc(r.answer) + '</span>' : '<span class="yours none">没答</span>';
      return (
        '<div class="h-row ' + (r.ok ? 'ok' : 'bad') + fresh + '">' +
        '<span class="h-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="h-mark" aria-label="' + (r.ok ? '答对' : '答错') + '">' + (r.ok ? ICON_OK : ICON_BAD) + '</span>' +
        // 「中 → 英」这一步不出声，答过的词也不能点读
        (ss.mode === 'zh2en' ? '<span class="h-word">' + esc(r.entry.w) + '</span>' : '<button class="h-word" data-act="speakWord" data-w="' + esc(r.entry.w) + '" title="朗读">' + esc(r.entry.w) + '</button>') +
        (ss.mode === 'en2zh' && r.lines
          ? zhDetailHtml(r)
          : '<span class="h-mean" title="' + esc(meaningLines(r.entry.m).join('\n')) + '">' + yours + esc(shortMeaning(r.entry.m)) + '</span>') +
        '</div>'
      );
    })
    .join('');
}

function promptHtml(ss: Session, e: Entry): string {
  if (ss.mode === 'en2zh') {
    return (
      '<div class="prompt-word">' + esc(e.w) + '</div>' +
      '<div class="prompt-phon">' + (e.p ? '/' + esc(e.p) + '/' : '') + '<button class="icon-btn" data-act="speakCurrent" title="朗读（Tab）">' + ICON_SPEAK + '</button></div>'
    );
  }
  if (ss.mode === 'zh2en') {
    return '<div class="prompt-mean">' + meaningHtml(e.m, e.w) + '</div>' + slotsHtml(e.w);
  }
  return '<button class="speak-big" data-act="speakCurrent" title="再听一遍（Tab）">' + ICON_SPEAK + '</button>' + slotsHtml(e.w);
}

function feedbackHtml(ss: Session, r: Result): string {
  const e = r.entry;
  const copy = needsCopy(ss);
  let body: string;
  if (ss.mode === 'en2zh') {
    body = '<div class="fb-label">参考释义</div><div class="fb-mean">' + meaningHtml(e.m) + '</div>';
  } else {
    body =
      (copy && r.answer ? '<div class="fb-yours">你写的：<s>' + esc(r.answer) + '</s></div>' : '') +
      '<div class="fb-label">正确拼写</div><div class="fb-word">' + esc(e.w) + '</div>' +
      (e.p ? '<div class="fb-phon">/' + esc(e.p) + '/</div>' : '') +
      (ss.mode === 'listen' ? '<div class="fb-mean">' + meaningHtml(e.m) + '</div>' : ''); // 中→英 的题目本身就是中文意思，不再重复
  }
  const parts = breakdownLines(e.w);
  if (parts.length) body += '<div class="fb-parts">' + parts.map(esc).join('<br>') + '</div>';
  return (
    '<div class="feedback">' + body +
    '<div class="actions"><button class="btn small" data-act="next">继续 <kbd>Enter</kbd></button></div>' +
    '</div>'
  );
}

// 两步之间的小结
function betweenHtml(ss: Session): string {
  const right = ss.results.filter((r) => r.ok).length;
  if (ss.repeat) {
    const bad = ss.results.length - right;
    return (
      '<div class="stage-done again">' +
      '<p class="label">第 ' + (ss.stage + 1) + ' 步 · ' + MODES[ss.mode!].name + (ss.attempt > 1 ? ' · 第 ' + ss.attempt + ' 遍' : '') + '</p>' +
      '<div class="stage-score">' + right + '<small> / ' + ss.results.length + '</small></div>' +
      '<p class="muted">错了 ' + bad + ' 个。已开启强制全对，这一步整组再来一遍，全对才进入下一步。</p>' +
      '<div class="actions"><button class="btn" data-act="continueStage">再来一遍 <kbd>Enter</kbd></button></div>' +
      '</div>'
    );
  }
  const next = MODES[STAGES[nextStageIndex(ss)]];
  const perfect = right === ss.results.length;
  return (
    '<div class="stage-done' + (perfect ? ' perfect' : '') + '">' + (perfect ? BURST : '') +
    '<p class="label">第 ' + (ss.stage + 1) + ' 步完成 · ' + MODES[ss.mode!].name + '</p>' +
    '<div class="stage-score">' + right + '<small> / ' + ss.results.length + '</small></div>' +
    '<p class="muted">下一步：' + next.name + ' · ' + next.desc + '</p>' +
    '<div class="actions"><button class="btn" data-act="continueStage">继续 <kbd>Enter</kbd></button></div>' +
    '</div>'
  );
}

function stepsHtml(ss: Session): string {
  return STAGES.map((k, i) => '<span class="step' + (i === ss.stage ? ' on' : i < ss.stage ? ' done' : '') + '">' + (i + 1) + ' ' + MODES[k].name + (i === ss.stage && ss.attempt > 1 ? ' · 第 ' + ss.attempt + ' 遍' : '') + '</span>').join('');
}

VIEWS.practice = function () {
  const ss = ui.session;
  if (!ss) return VIEWS.home();
  const e = current();
  // 进度条按三步加起来算
  const counts = STAGES.map((k) => usable(ss.words, k).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const before = counts.slice(0, ss.stage).reduce((a, b) => a + b, 0);
  const done = before + ss.results.length + (ss.pending ? 1 : 0);
  const pct = Math.min(100, (done / total) * 100);
  const pend = ss.pending;
  const copy = needsCopy(ss);
  const placeholder = copy ? '照着打一遍，或直接按 Enter 继续' : '拼写英文';
  const anim = ss.animIdx !== ss.idx ? ' anim' : '';
  let inputs;
  if (ss.between) inputs = '';
  else if (ss.mode === 'en2zh') {
    // 英→中：一行写一个中文意思
    const n = pend && pend.lines ? pend.lines.length : zhLineCount(e);
    inputs = '<div class="zh-lines' + (n > 4 ? ' many' : '') + '">';
    for (let i = 0; i < n; i++) {
      const mk = pend && pend.marks ? pend.marks[i] : undefined;
      const cls = mk === true ? ' ok' : mk === false ? ' bad' : '';
      inputs +=
        '<div class="zl' + cls + '"><span class="zl-mark">' + (mk === true ? ICON_OK : mk === false ? ICON_BAD : '') + '</span><span class="zl-no">' + (i + 1) + '.</span>' +
        '<input class="answer ans" ' + (i === 0 ? 'id="answer" ' : '') + 'data-line="' + i + '" autocomplete="off" spellcheck="false"' +
        (pend ? ' readonly value="' + esc(pend.lines![i] || '') + '"' : '') + '></div>';
    }
    inputs += '</div>';
  } else {
    inputs =
      '<input id="answer" class="answer en' + (pend && !copy ? ' wrong' : '') + (copy ? ' copy' : '') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="' + placeholder + '"' +
      (pend && !copy ? ' readonly value="' + esc(pend.answer) + '"' : '') + '>';
  }
  const hint =
    ss.mode === 'en2zh'
      ? '<div class="hint"><span>一行写一个意思，<kbd>Enter</kbd> 换行</span><span>写完最后一行按 <kbd>Enter</kbd> 提交</span><span><kbd>Tab</kbd> 再听一遍</span><button class="link" data-act="skipKnown" title="以后不再出这个词">已掌握，跳过</button></div>'
      : '<div class="hint"><span><kbd>Enter</kbd> 提交</span><span>空着按 <kbd>Enter</kbd> = 不会</span>' + (ss.mode === 'listen' ? '<span><kbd>Tab</kbd> 再听一遍</span>' : '') + '<button class="link" data-act="skipKnown" title="以后不再出这个词">已掌握，跳过</button></div>';
  const history = ss.results.length ? historyHtml(ss) : '<div class="h-empty">答过的词会一行一行留在这里</div>';
  return (
    '<main class="practice">' +
    '<div class="p-top"><span class="steps">' + stepsHtml(ss) + '<span class="book">' + esc(bookName(ss.bookId as string)) + '</span></span>' +
    '<span class="right"><span>' + (ss.between ? ss.items.length : ss.idx + 1) + ' / ' + ss.items.length + '</span><button class="link" data-act="quit">结束 Esc</button></span></div>' +
    '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
    '<div class="history' + (ss.results.length ? '' : ' empty') + '" id="history">' + history + '</div>' +
    (ss.between ? '<section class="card"><div class="inner anim">' + betweenHtml(ss) + '</div></section></main>' : '') +
    (ss.between ? '' : '<section class="card"><div class="inner' + anim + '">' + promptHtml(ss, e) +
    inputs +
    (pend ? feedbackHtml(ss, pend) : hint) +
    '</div></section>' +
    '</main>')
  );
};

AFTER.practice = function () {
  const ss = ui.session;
  if (ss) {
    ss.animIdx = ss.idx;
    ss.animRow = ss.results.length;
  }
  const h = document.getElementById('history');
  if (h) h.scrollTop = h.scrollHeight;
  const input = document.getElementById('answer');
  if (input) input.focus();
};

// 这一轮里任何一步答错过的词，以及它在三步里各自的对错
export function wrongWords(ss: Session): { entry: Entry; marks: boolean[]; bad: boolean }[] {
  const map = new Map<string, { entry: Entry; marks: boolean[]; bad: boolean }>();
  STAGES.forEach((_, i) => {
    stageAll(ss, i).forEach((r) => {
      const k = keyOf(r.entry.w);
      if (!map.has(k)) map.set(k, { entry: r.entry, marks: [], bad: false });
      const x = map.get(k)!;
      x.marks[i] = x.marks[i] === false ? false : r.ok;
      if (!r.ok) x.bad = true;
    });
  });
  return [...map.values()].filter((x) => x.bad);
}

// 结果页上「下一组」按钮的文字；没有下一组时返回空
export function nextLabel(ss: Session): string {
  if (ss.kind === 'root') return '';
  if (ss.kind === 'new' || ss.kind === 'retry') {
    const left = state.settings.goal - learnedToday();
    return left > 0 ? '下一组新词 · 今天还差 ' + left + ' 个' : '再背一组新词';
  }
  if (ss.kind === 'review') {
    const n = reviewPool().remaining.length;
    return n ? '继续复习 · 还剩 ' + n + ' 个' : '';
  }
  const n = available(Object.values(state.wrong)).length;
  return n ? '继续练错题本 · 还有 ' + n + ' 个' : '';
}
