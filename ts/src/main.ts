// 小游戏的入口：app.js 启动时调用 MARGIN_GAMES.init(host)，「小游戏」页面由这里画。

import type { Host } from './host';
import { ChaseGame } from './chase/game';
import { hubHtml } from './hub';

let host: Host | null = null;
let chase: ChaseGame | null = null;
let route: 'hub' | 'chase' = 'hub';

function init(h: Host): void {
  host = h;
  chase = new ChaseGame(h);
  // 小游戏页面上的按钮（data-game）和选择框
  document.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-game]');
    if (!el || !document.querySelector('main.games') || !chase || !host) return;
    if (el.tagName === 'SELECT') return;
    const name = el.dataset.game || '';
    if (name === 'open') {
      route = el.dataset.id === 'chase' ? 'chase' : 'hub';
      chase.route = 'setup';
      host.render();
      window.scrollTo(0, 0);
      return;
    }
    void chase.action(name, el);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement | HTMLSelectElement;
    if (!chase || !document.querySelector('main.games')) return;
    if (el.id === 'chase-file') void chase.file(el as HTMLInputElement);
    else if (el.dataset && el.dataset.game) chase.change(el.dataset.game, el);
  });
}

/** 点顶栏「小游戏」：回到游戏列表 */
function home(): void {
  if (chase) chase.leave();
  route = 'hub';
}

function view(): string {
  if (!host || !chase) return '';
  return route === 'chase' ? chase.view() : hubHtml(host);
}

function after(): void {
  if (chase) {
    if (route === 'chase') chase.after();
    else chase.leave();
  }
}

/** 离开小游戏页面 */
function leave(): void {
  if (chase) chase.leave();
}

const api = { init, view, after, leave, home, debug: () => (chase ? chase.debug() : null), route: () => route };
window.MARGIN_GAMES = api;
export type GamesApi = typeof api;
