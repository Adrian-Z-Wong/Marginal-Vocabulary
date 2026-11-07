// 右下角的背包

import { toast } from '../app/dialogs';
import { go, ui } from '../app/nav';
import { render } from '../app/render';
import { save, state } from '../app/store';
import { dayNum, esc } from '../app/util';
import { ART } from '../art';
import { bagAdd, bagHas, itemIcon, pxImg } from './bag';
import { checkChallenges, pday } from './coins';
import { CARE, ITEMS } from './data';
import { TILL } from './garden';
import { careUp, fishList, landPets, mainPet, petById } from './pets';
import { petSay } from './roam';
import { refreshSceneUi } from './sceneui';
import { scene, setScene } from './terrain';
import { Pet } from '../app/types';
import { ShopItem } from '../data/types';

// ---------- 背包（右下角） ----------

const bagLayer = document.createElement('div');

function bagTotal(): number {
  let n = 0;
  for (const id in state.world.bag) n += state.world.bag[id];
  return n;
}

// 一件东西的效果（背包和商店里的小字）
export function itemNote(it: ShopItem): string {
  if (it.use === 'feed') return '饱腹 +' + it.food + (it.mood ? ' · 心情 +' + it.mood : '');
  if (it.use === 'toy') return '心情 +' + it.mood;
  if (it.use === 'hoe') return '开垦一格 ' + TILL.cost + ' 金币、1 点体力';
  if (it.use === 'scythe') return '割杂草，每次 1 点体力';
  if (it.use === 'pickaxe') return '敲石头，小石头 2 点体力、大石头 5 点';
  if (it.use === 'axe') return '砍树枝、树桩和野树，1–6 点体力';
  if (it.use === 'mat') return '扩建花园、房子要用';
  if (it.use === 'lawn') return '撒在开垦过的空地上，变回草地';
  return '';
}

export function renderBag(): void {
  const ids = Object.keys(state.world.bag).filter((id) => ITEMS.has(id));
  const order = [...ITEMS.keys()];
  ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const sel = ITEMS.get(ui.bagPick!);
  let panel = '';
  if (ui.bagOpen) {
    let detail = '';
    if (sel && bagHas(sel.id)) {
      const acts = [];
      if (['plant', 'water', 'fert', 'place', 'lawn'].includes(sel.use!)) acts.push('<button class="btn small" data-bag="garden">去花园用</button>');
      if (sel.use === 'furnish') acts.push('<button class="btn small" data-bag="room">摆进屋里</button>');
      if (sel.use === 'fishfood') acts.push(fishList().length ? '<button class="btn small" data-bag="fish">撒进池塘</button>' : '<span class="muted small">池塘里还没有鱼</span>');
      if (['feed', 'toy', 'medicine'].includes(sel.use!)) {
        const pets = landPets().concat(sel.use === 'medicine' ? fishList() : []).filter((p) => (sel.use === 'medicine' ? p.sick : !p.sick));
        if (pets.length) acts.push('<span class="muted small">' + (sel.use === 'feed' ? '喂给' : sel.use === 'toy' ? '给' : '喂药') + '</span>' + pets.map((p) => '<button class="btn small" data-bag="care" data-pet="' + p.id + '">' + esc(p.name) + '</button>').join(''));
        else acts.push('<span class="muted small">' + (sel.use === 'medicine' ? '没有宠物生病' : state.pets.length ? '宠物生病了，先喂药' : '还没有宠物') + '</span>');
      }
      detail = '<div class="bag-detail"><b>' + esc(sel.name) + '</b><span class="muted">×' + state.world.bag[sel.id] + (itemNote(sel) ? ' · ' + itemNote(sel) : '') + '</span><div class="actions">' + acts.join('') + '</div></div>';
    }
    panel =
      '<div class="bag" role="dialog" aria-label="背包"><div class="bag-head"><b>背包</b><button class="link" data-bag="shop">商店</button><button class="bag-x" data-bag="close" aria-label="关上">×</button></div>' +
      (ids.length
        ? '<div class="bag-grid">' +
          ids.map((id) => '<button class="slot' + (ui.bagPick === id ? ' on' : '') + '" data-bag="pick" data-id="' + esc(id) + '" title="' + esc(ITEMS.get(id)!.name) + '">' + pxImg(itemIcon(ITEMS.get(id)), 2) + '<span class="n">' + state.world.bag[id] + '</span></button>').join('') +
          '</div>' + detail
        : '<p class="muted bag-empty">空的</p>') +
      '</div>';
  }
  const n = bagTotal();
  bagLayer.innerHTML = panel + '<button class="bag-btn' + (ui.bagOpen ? ' on' : '') + '" data-bag="toggle" title="背包">' + pxImg(ART.icon('bag'), 2) + (n ? '<span class="n">' + n + '</span>' : '') + '</button>';
}

// 照顾宠物：喂饭、玩玩具、喂药
export function careUse(p: Pet | null, id: string): boolean | undefined {
  const it = ITEMS.get(id);
  if (!p || !it || !bagHas(id)) return false;
  if (it.use === 'medicine') {
    if (!p.sick) return toast(p.name + '没生病，药先留着'), false;
    bagAdd(id, -1);
    p.sick = false;
    p.food = Math.max(p.food, CARE.cure);
    p.mood = Math.max(p.mood, CARE.cure);
    p.day = dayNum();
    save();
    if (p === mainPet()) setTimeout(() => petSay('cured'), 200);
    else toast(p.name + '好起来了');
    return true;
  }
  if (p.sick) return toast(p.name + '生病了，先喂药'), false;
  bagAdd(id, -1);
  if (it.use === 'feed') {
    careUp(p, 'food', it.food!);
    careUp(p, 'mood', it.mood || 0);
    const d = pday();
    d.feed = (d.feed || 0) + 1;
    floatMood('饱腹 +' + it.food);
    if (p === mainPet()) petSay('fed');
    checkChallenges();
  } else {
    careUp(p, 'mood', it.mood!);
    floatMood('+' + it.mood);
    if (p === mainPet()) petSay('toy');
  }
  save();
  return true;
}

// 撒一份鱼食：池塘里的鱼都吃饱
export function feedFish(): boolean | void {
  const fish = fishList().filter((f) => !f.sick);
  if (!bagHas('fishfood')) return toast('背包里没有鱼食');
  if (!fish.length) return toast(fishList().length ? '鱼生病了，先喂药' : '池塘里还没有鱼');
  bagAdd('fishfood', -1);
  for (const f of fish) {
    f.food = 100;
    careUp(f, 'mood', 5);
  }
  const d = pday();
  d.feed = (d.feed || 0) + 1;
  checkChallenges();
  save();
  floatMood('鱼都吃饱了');
  if (scene && scene.kind === 'garden') scene.fishFed = performance.now();
  return true;
}

function floatMood(text: string): void {
  const pts = document.querySelector('.pts');
  if (!pts) return;
  const r = pts.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'pts-float mood';
  s.textContent = '♥ ' + text;
  s.style.left = r.left + r.width / 2 + 'px';
  s.style.top = r.bottom + 4 + 'px';
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1100);
}

export function initBag(): void {
  bagLayer.className = 'bag-layer';
  document.body.appendChild(bagLayer);
  bagLayer.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-bag]');
    if (!t) return;
    const a = t.dataset.bag;
    if (a === 'toggle') ui.bagOpen = !ui.bagOpen;
    else if (a === 'close') ui.bagOpen = false;
    else if (a === 'pick') ui.bagPick = t.dataset.id;
    else if (a === 'shop') {
      ui.bagOpen = false;
      ui.shopTab = 'seeds';
      go('shop');
      return;
    } else if (a === 'garden' || a === 'room') {
      ui.bagOpen = false;
      if (ui.view !== a) {
        if (scene) scene.stop();
        setScene(null);
        go(a);
      }
      ui.tool = ui.bagPick;
      refreshSceneUi();
      return;
    } else if (a === 'care') {
      if (careUse(petById(+t.dataset.pet!), ui.bagPick!)) {
        if (!bagHas(ui.bagPick!)) ui.bagPick = null;
        render();
        return;
      }
    } else if (a === 'fish') {
      if (feedFish()) {
        if (!bagHas('fishfood')) ui.bagPick = null;
        render();
        return;
      }
    }
    renderBag();
  });
}
