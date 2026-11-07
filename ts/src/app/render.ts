// 渲染：顶栏和页面框架

import { renderBag } from '../world/bagui';
import { levelOf } from '../world/coins';
import { debrisTick } from '../world/debris';
import { petNeedsCare, petSick, petsTick } from '../world/pets';
import { renderPet } from '../world/roam';
import { rainTick } from '../world/sky';
import { scene, setScene } from '../world/terrain';
import { EXAM_BOOKS, TERM_BOOKS } from './books';
import { ICON_SPARK, toast } from './dialogs';
import { bookEntries, bookExists, bookName } from './library';
import { app, ui } from './nav';
import { AFTER, VIEWS } from './registry';
import { seenCount } from './stats';
import { state } from './store';
import { updateBarHtml } from './update';
import { esc, fmt } from './util';

// ================= 渲染：框架 =================

export function render(): void {
  petsTick();
  debrisTick();
  rainTick();
  if (ui.petGone && ui.petGone.length) {
    const names = ui.petGone;
    ui.petGone = null;
    setTimeout(() => toast(names.join('、') + ' 生病太久，去世了'), 600);
  }
  if (scene && ui.view !== 'garden' && ui.view !== 'room') {
    scene.stop();
    setScene(null);
  }
  const html = header() + updateBarHtml() + (VIEWS[ui.view] || VIEWS.home)();
  app.innerHTML = html;
  AFTER[ui.view] && AFTER[ui.view]();
  renderPet();
  renderBag();
}

function header(): string {
  const wrongN = Object.keys(state.wrong).length;
  const nav = [
    ['home', '背诵'],
    ['roots', '词根'],
    ['books', '词库'],
    ['wrong', '错题本' + (wrongN ? '<sup>' + wrongN + '</sup>' : '')],
    ['garden', '花园'],
    ['shop', '商店' + (petNeedsCare() ? '<i class="dot" title="' + (petSick() ? '宠物生病了' : '宠物状态不太好') + '"></i>' : '')],
    ['games', '小游戏'],
    ['settings', '设置'],
  ];
  const active = ({ practice: 'home', result: 'home', book: 'books', import: 'books', root: 'roots', rootquiz: 'roots', room: 'garden' } as Record<string, string>)[ui.view] || ui.view;
  return (
    '<header class="top"><button class="brand" data-act="nav" data-view="home"><span class="brand-mark">' + ICON_SPARK + '</span>Marginal Vocabulary</button>' +
    '<div class="top-r"><button class="pts" data-act="nav" data-view="shop" title="金币 · Lv ' + levelOf(state.points.earned) + '"><span class="pts-ic"></span>' + fmt(state.points.bal) + '</button><nav class="nav">' +
    nav.map(([v, label]) => '<button data-act="nav" data-view="' + v + '" class="' + (active === v ? 'on' : '') + '">' + label + '</button>').join('') +
    '</nav></div></header>'
  );
}

// 内置词库，平铺：Finance、Medicine、CET-4、CET-6……
export function allBooks(): string[] {
  return (TERM_BOOKS as { id: string }[]).concat(EXAM_BOOKS)
    .map((b) => b.id)
    .filter((id) => bookExists(id));
}

export function bookOptionsHtml(selected: string): string {
  const opt = (id: string, label: string) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  const info = (id: string) => {
    const list = bookEntries(id);
    return bookName(id) + ' · ' + fmt(list.length) + ' 词 · 已背 ' + fmt(seenCount(list));
  };
  let html = '';
  html += allBooks().map((id) => opt(id, info(id))).join('');
  const mine = Object.values(state.books).sort((a, b) => a.t - b.t);
  html += mine.map((b) => opt(b.id, info(b.id))).join('');
  return html;
}

// ================= 渲染：各页面 =================
