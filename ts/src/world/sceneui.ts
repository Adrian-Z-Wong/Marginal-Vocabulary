// 花园和小屋页面：工具栏、换画面

import { go, ui } from '../app/nav';
import { AFTER, VIEWS } from '../app/registry';
import { state } from '../app/store';
import { esc, fmt } from '../app/util';
import { ART } from '../art';
import { itemIcon, pxImg } from './bag';
import { renderBag } from './bagui';
import { FLOOR_NAME, HOUSES, ITEMS, LANDS, OY, curFloor, floorCount, floorItems, houseLevel } from './data';
import { TOOL_NAME, costText } from './debris';
import { TILL, plantMax, plantStage, stamina } from './garden';
import { summarize } from './occupancy';
import { Scene } from './scene';
import { clockText } from './sky';
import { scene, setScene } from './terrain';
import { ShopItem } from '../data/types';

// 换到花园 / 小屋（不重画整页，只换画面）
export function goScene(kind: string): void {
  if (scene) scene.stop();
  setScene(null);
  ui.tool = null;
  go(kind);
}

// 背包里能在这里用的东西
function sceneTools(kind: string): ShopItem[] {
  const out: ShopItem[] = [];
  for (const id in state.world.bag) {
    const it = ITEMS.get(id);
    if (!it) continue;
    // 家具、装饰屋里屋外都能摆（挂画、窗户只能挂在屋里的墙上）
    const wall = it.decor && ART.DECOR[it.decor] && ART.DECOR[it.decor].wall;
    if (kind === 'room' ? it.use === 'furnish' || it.use === 'place' : ['plant', 'water', 'fert', 'place', 'lawn'].includes(it.use!) || (it.use === 'furnish' && !wall)) out.push(it);
  }
  return out;
}

function toolbarHtml(kind: string): string {
  const owned = (['hoe', 'scythe', 'pickaxe', 'axe'] as const).filter((id) => state.world[id]);
  type Btn = [string, string, HTMLCanvasElement, number?];
  const free: Btn[] = kind === 'room' ? [['hand', '收回', ART.icon('hand')]] : ([['hand', '收回', ART.icon('hand')], ['shovel', '铲掉', ART.icon('shovel')]] as Btn[]).concat(owned.map((id): Btn => [id, TOOL_NAME[id], ART.icon(id)]));
  const tools = sceneTools(kind);
  const btn = (id: string, name: string, img: HTMLCanvasElement, n?: number) =>
    '<button class="tool' + (ui.tool === id ? ' on' : '') + '" data-act="tool" data-id="' + esc(id) + '" title="' + esc(name) + '">' + pxImg(img, 2) + (n != null ? '<span class="n">' + n + '</span>' : '') + '<span class="tn">' + esc(name) + '</span></button>';
  return (
    '<div class="toolbar" id="toolbar">' +
    (kind === 'garden' && owned.length ? '<span class="stam" title="体力">' + pxImg(ART.icon('bolt'), 2) + '<b>' + stamina().v + '</b></span>' : '') +
    free.map(([id, name, img, n]) => btn(id, name, img, n)).join('') +
    '<span class="tsep"></span>' +
    (tools.length ? tools.map((it) => btn(it.id, it.name.replace(/ ×\d+$/, ''), itemIcon(it), state.world.bag[it.id])).join('') : '<span class="muted small">背包里没有' + (kind === 'room' ? '家具' : '种子、水和装饰') + '</span><button class="link" data-act="openShelf" data-shelf="' + (kind === 'room' ? 'furniture' : 'treeseeds') + '">去买</button>') +
    '</div>'
  );
}

export function refreshSceneUi(): void {
  const tb = document.getElementById('toolbar');
  if (tb) tb.outerHTML = toolbarHtml(ui.view === 'room' ? 'room' : 'garden');
  const st = document.getElementById('g-stats');
  if (st) st.innerHTML = gardenStatsHtml();
  renderBag();
  const pts = document.querySelector('.pts');
  if (pts) pts.lastChild!.textContent = fmt(state.points.bal);
}

function gardenStatsHtml(): string {
  const s = summarize(state.world.plants, []);
  const parts = ['树木 ' + s.t, '花卉 ' + s.f, '观赏草 ' + s.g, '灌木 ' + s.s, '体力 ' + stamina().v + '/' + TILL.max];
  const growing = state.world.plants.filter((pl) => plantStage(pl) < plantMax(pl)).length;
  if (growing) parts.push('在长 ' + growing);
  return parts.join(' · ');
}

// ---------- 花园页 ----------

VIEWS.garden = function () {
  const next = LANDS[(state.world.land || 0) + 1];
  return (
    '<main class="page wide">' +
    '<div class="g-top"><div><h1 class="h1">花园</h1><p class="muted"><span id="g-stats">' + gardenStatsHtml() + '</span> · <span class="g-clock">' + clockText() + '</span></p></div>' +
    '<div class="actions"><span class="zoom"><button class="btn ghost small" data-act="zoom" data-d="-1" title="拉远（−）">−</button><span id="zoom-v" class="muted small"></span><button class="btn ghost small" data-act="zoom" data-d="1" title="拉近（+）">+</button></span>' +
    (next ? '<button class="btn ghost small" data-act="buyLand" title="' + next.w + ' × ' + (next.h + OY) + ' 格">扩建 · ' + fmt(next.price) + '</button>' : '') +
    '<button class="btn ghost small" data-act="goRoom">回家</button></div></div>' +
    '<div class="scene-wrap" id="scene-wrap"><canvas class="scene" id="scene"></canvas><div class="scene-bubble"></div>' + toolbarHtml('garden') + '</div>' +
    '</main>'
  );
};

VIEWS.room = function () {
  return (
    '<main class="page wide">' +
    '<div class="g-top"><div><h1 class="h1">' + HOUSES[houseLevel()].name + (floorCount() > 1 ? ' · ' + FLOOR_NAME[curFloor()] : '') + '</h1><p class="muted">这层家具 ' + floorItems(curFloor()).length + ' 件' + (floorCount() > 1 ? ' · 一共 ' + floorCount() + ' 层，走到楼梯上换楼层' : '') + ' · <span class="g-clock">' + clockText() + '</span></p></div>' +
    '<div class="actions">' + (HOUSES[houseLevel() + 1] ? '<button class="btn ghost small" data-act="buyHouse">扩建成' + HOUSES[houseLevel() + 1].name + ' · ' + costText(HOUSES[houseLevel() + 1]) + '</button>' : '') + '<button class="btn ghost small" data-act="goGarden">出门</button></div></div>' +
    '<div class="scene-wrap room" id="scene-wrap"><canvas class="scene" id="scene"></canvas><div class="scene-bubble"></div>' + toolbarHtml('room') + '</div>' +
    '</main>'
  );
};

function attachScene(kind: string): void {
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  const wrap = document.getElementById('scene-wrap')!;
  if (!canvas) return;
  if (!scene || scene.kind !== kind) {
    if (scene) scene.stop();
    setScene(new Scene(kind));
  }
  scene!.attach(canvas, wrap);
}

AFTER.garden = function () {
  attachScene('garden');
  const z = document.getElementById('zoom-v');
  if (z && scene) z.textContent = scene.scale + '×';
};

AFTER.room = function () {
  attachScene('room');
};
