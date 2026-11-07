// 「小游戏」页：列出所有英语小游戏。以后加游戏就往 GAMES 里加一项。

import type { Host } from './host';
import { DAILY_COINS, LEVELS, coverImage } from './chase/game';

export interface GameCard {
  id: string;
  name: string;
  desc: string;
  cover: () => string;
}

export const GAMES: GameCard[] = [
  {
    id: 'chase',
    name: '打字追击',
    desc: '在城市的大街小巷里追小偷：打对一个字母，警车就往前开一点，连击还能加速，要在他跑进仓库前追上。文章按词库挑，金融、医学、托福、GRE……',
    cover: coverImage,
  },
];

export function hubHtml(host: Host): string {
  const g = host.state().games;
  const c = g && g.chase;
  const best = c ? Math.max(0, ...Object.values(c.best || {})) : 0;
  const today = c && c.day === host.today() ? c.coins : 0;
  return (
    '<main class="page games">' +
    '<h1 class="h1">小游戏</h1>' +
    '<div class="game-grid">' +
    GAMES.map(
      (gm) =>
        '<button class="game-card" data-game="open" data-id="' + gm.id + '">' +
        '<img class="gc-cover" alt="" src="' + gm.cover() + '">' +
        '<span class="gc-body"><b class="gc-name">' + host.esc(gm.name) + '</b><span class="gc-desc">' + host.esc(gm.desc) + '</span>' +
        '<span class="gc-meta">' +
        (best ? '<span>最快 ' + Math.round(best) + ' 词 / 分钟</span>' : '') +
        '<span>今天 ' + today + ' / ' + DAILY_COINS + ' 金币</span>' +
        '<span>' + LEVELS.length + ' 档速度</span>' +
        '</span></span></button>'
    ).join('') +
    '</div>' +
    '</main>'
  );
}
