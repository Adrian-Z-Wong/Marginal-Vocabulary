// 首页

import { challengesHtml, gardenCardHtml } from '../../world/shop';
import { ICON_SPARK, ringHtml } from '../dialogs';
import { bookName, learnedToday, reviewPool, studyBook } from '../library';
import { AFTER, VIEWS } from '../registry';
import { bookOptionsHtml } from '../render';
import { streak } from '../stats';
import { state } from '../store';
import { dayKeyOf, dayNum, esc, fmt, todayKey } from '../util';
import { chipsHtml } from './settings';

VIEWS.home = function () {
  const s = state.settings;
  const book = studyBook();
  const day = state.log[todayKey()] || { n: 0, r: 0 };
  const learned = learnedToday();
  const rv = reviewPool();
  const rvTotal = rv.done + rv.remaining.length;
  const left = s.goal - learned;
  const st = streak();
  const d = new Date();
  const week = '日一二三四五六'[d.getDay()];
  const pct = (a: number, b: number) => (b ? Math.min(100, (a / b) * 100) : 100);
  const orders = chipsHtml('order', [
    ['new', '按词表顺序'],
    ['random', '随机'],
  ]);
  const title = left <= 0 ? '今天的目标完成了' : learned ? '还差 ' + left + ' 个新词' : '今天背 ' + s.goal + ' 个新词';
  const sub = left <= 0 ? '想多背一点，可以再来一组。' : learned ? '已经背了 ' + learned + ' 个，接着来。' : '一组一组来，每组过三步：英 → 中、中 → 英、听 → 写。';
  return (
    '<main class="page home">' +
    '<p class="label">' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + week + '</p>' +
    '<section class="hero' + (left <= 0 ? ' done' : '') + '">' +
    '<div class="hero-main"><p class="label">今日新词 · ' + esc(bookName(book)) + '</p>' +
    '<h1 class="h1">' + title + '</h1><p class="sub">' + sub + '</p>' +
    '<div class="actions"><button class="btn big" data-act="startNew">' + (left > 0 ? '背新词' : '再背一组') + ' <kbd>Enter</kbd></button></div></div>' +
    ringHtml(learned, s.goal, '新词') +
    '</section>' +
    '<div class="tasks">' +
    '<div class="task"><p class="label">复习</p>' +
    '<div class="num">' + fmt(rv.done) + '<small> / ' + fmt(rvTotal) + '</small></div>' +
    '<div class="bar"><i style="width:' + pct(rv.done, rvTotal) + '%"></i></div>' +
    '<p class="muted">昨天的新词、错题本和到期的词</p>' +
    '<button class="btn ghost" data-act="startReview"' + (rv.remaining.length ? '' : ' disabled') + '>' + (rv.remaining.length ? '开始复习 <kbd>R</kbd>' : rvTotal ? '复习完了' : '今天没有要复习的词') + '</button></div>' +
    '<div class="task streak' + (st ? ' on' : '') + '"><p class="label">打卡</p>' +
    '<div class="num"><span class="spark">' + ICON_SPARK + '</span>' + fmt(st) + '<small> 天</small></div>' +
    '<p class="muted">' + (st ? '已连续打卡 ' + st + ' 天' : '今天背一组，就开始打卡') + '</p>' +
    '<div class="mini"><div><b>' + fmt(day.n) + '</b><span>今天答题</span></div><div><b>' + (day.n ? Math.round((day.r / day.n) * 100) + '%' : '—') + '</b><span>今天正确率</span></div></div></div>' +
    '</div>' +
    gardenCardHtml() +
    challengesHtml(true) +
    '<section class="panel prefs"><p class="label">背什么</p>' +
    '<div class="pref"><span class="t">词库</span><label class="select"><select data-act="setBook" aria-label="词库">' + bookOptionsHtml(book) + '</select></label></div>' +
    '<div class="pref"><span class="t">每天背多少新词</span>' + chipsHtml('goal', [10, 20, 30, 50, 100].map((n) => [n, String(n)])) + '</div>' +
    '<div class="pref"><span class="t">新词顺序</span>' + orders + '</div>' +
    '</section>' +
    heatmapHtml() +
    '</main>'
  );
};

// 最近一年的打卡热力图：颜色越深，那天答题越多
function heatmapHtml(): string {
  const WEEKS = 52;
  const today = dayNum();
  const dow = new Date().getDay();
  const start = today - dow - (WEEKS - 1) * 7;
  let cells = '';
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const n = start + w * 7 + d;
      if (n > today) {
        cells += '<i class="hm-x"></i>';
        continue;
      }
      const key = dayKeyOf(n);
      const rec = state.log[key] || { n: 0, r: 0 };
      const lv = rec.n === 0 ? 0 : rec.n < 10 ? 1 : rec.n < 30 ? 2 : rec.n < 60 ? 3 : 4;
      const tip = key + ' · ' + (rec.n ? '答题 ' + rec.n + '，正确率 ' + Math.round((rec.r / rec.n) * 100) + '%' : '没有背');
      cells += '<i class="hm-' + lv + '" title="' + tip + '"></i>';
    }
  }
  const total = Object.keys(state.stats).length;
  return (
    '<section class="panel heat"><div class="head-row"><p class="label">最近一年</p><span class="muted">累计背过 ' + fmt(total) + ' 词 · 已掌握 ' + fmt(Object.keys(state.known).length) + ' 词</span></div>' +
    '<div class="hm" aria-label="最近一年每天的答题量">' + cells + '</div>' +
    '<div class="hm-legend" aria-hidden="true"><span>少</span><i class="hm-0"></i><i class="hm-1"></i><i class="hm-2"></i><i class="hm-3"></i><i class="hm-4"></i><span>多</span></div></section>'
  );
}

AFTER.home = function () {
  // 窄屏时热力图默认滚到最近几周
  const hm = document.querySelector('.hm');
  if (hm) hm.scrollLeft = hm.scrollWidth;
};
