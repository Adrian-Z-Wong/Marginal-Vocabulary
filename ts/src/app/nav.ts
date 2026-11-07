// 界面状态和换页

import { GAMES } from './games';
import { render } from './render';
import { stopSpeech } from './speech';
import { UI } from './types';

// ================= 界面状态 =================

export const app = document.getElementById('app')!;
export const ui: UI = {
  view: 'home',
  session: null,
  book: { id: null, q: '', limit: 200 },
  draft: null,
  roots: { q: '', type: 'all', id: null, limit: 200, wordLimit: 50 },
  rs: null, // 词根练习的一组
};

export function go(view: string): void {
  if (ui.view === 'practice' && view !== 'practice') stopSpeech();
  // 小游戏：离开时停下正在进行的一局；点顶栏「小游戏」回到游戏列表
  if (GAMES && ui.view === 'games' && view !== 'games') GAMES.leave();
  if (GAMES && view === 'games') GAMES.home();
  if (view !== ui.view) ui.tool = null; // 换页面就把手里的工具放下
  ui.view = view;
  render();
  window.scrollTo(0, 0);
}
