// 背包

import { state } from '../app/store';
import { esc } from '../app/util';
import { ART } from '../art';
import { ShopItem } from '../data/types';
import { Sprite } from '../art/pix';

// ---------- 背包 ----------

export function bagAdd(id: string, n: number): void {
  const b = state.world.bag;
  b[id] = (b[id] || 0) + n;
  if (b[id] <= 0) delete b[id];
}

export function bagHas(id: string): boolean {
  return (state.world.bag[id] || 0) > 0;
}

export function itemIcon(it: ShopItem | undefined): Sprite {
  if (!it) return ART.icon('bag');
  if (it.plant) return ART.icon('seed', it.plant[0] === 'flower' ? ART.FLOWER_COLOR[it.plant[1]] : it.plant[0] === 'tree' ? '#a0703a' : it.plant[0] === 'grass' ? '#9ab84a' : '#6aa35a');
  if (it.decor) return ART.decor(it.decor)!;
  if (it.use === 'lawn') return ART.icon('seed', '#5fa83f');
  return ART.icon(it.icon || 'bag');
}

export function pxImg(canvas: HTMLCanvasElement | null, scale: number, cls?: string, title?: string): string {
  if (!canvas) return '';
  return (
    '<img class="px' + (cls ? ' ' + cls : '') + '" src="' + ART.url(canvas) + '" width="' + canvas.width * scale + '" height="' + canvas.height * scale + '" alt=""' +
    (title ? ' title="' + esc(title) + '"' : '') + ' draggable="false">'
  );
}
