// 商店页和首页的花园卡片

import { ICON_OK, ICON_SPARK } from '../app/dialogs';
import { ui } from '../app/nav';
import { VIEWS } from '../app/registry';
import { state } from '../app/store';
import { esc, fmt } from '../app/util';
import { ART } from '../art';
import { bagHas, itemIcon, pxImg } from './bag';
import { itemNote } from './bagui';
import { levelNeed, levelOf, pday, todayChallenges } from './coins';
import { ACHIEVEMENTS, CARE, HOUSES, ITEMS, LANDS, OY, PETS, PTS, SHELVES, SPECIES, houseLevel } from './data';
import { Cost, costText, matsShort } from './debris';
import { TILL, plantMax, plantStage, wateredToday } from './garden';
import { avatarLook, fishList, isFish, landPets, mainPet, petAge, petCanvas, petLabel, petLow, petsTick } from './pets';
import { Pet, Tool } from '../app/types';
import { ShopItem } from '../data/types';

// ---------- 商店 ----------

// 商店的分栏；卖东西的几栏下面再按类别分
const SHOP_TABS: [string, string, string[]?][] = [
  ['status', '我的宠物'],
  ['adopt', '宠物店'],
  ['seeds', '种子', ['treeseeds', 'seeds']],
  ['supplies', '用品', ['petcare', 'garden']],
  ['home', '家园', ['decor', 'furniture', 'mats', 'build']],
  ['style', '装扮', ['look', 'petlook']],
  ['goals', '挑战与成就'],
  ['rules', '金币规则'],
];
export const tabOfShelf = (id: string): string => (SHOP_TABS.find((t) => t[2] && t[2].includes(id)) || SHOP_TABS[2])[0];

function shopTab(): string {
  return SHOP_TABS.some((t) => t[0] === ui.shopTab) ? ui.shopTab! : 'status';
}

// 「我的宠物」里每只都有自己的画面，页面上走动的那只就先藏起来
export function onPetTab(): boolean {
  return ui.view === 'shop' && shopTab() === 'status';
}

function pointsPanelHtml(): string {
  const p = state.points;
  const lv = levelOf(p.earned);
  const lo = levelNeed(lv);
  const hi = levelNeed(lv + 1);
  const d = pday();
  return (
    '<div class="pts-panel">' +
    '<div class="pp-main"><p class="label">金币</p><div class="pp-num">' + fmt(p.bal) + '</div>' +
    '<p class="muted">今天 +' + fmt(d.e) + (d.x ? ' · 扣 ' + fmt(d.x) : '') + (d.s ? ' · 花了 ' + fmt(d.s) : '') + '</p></div>' +
    '<div class="pp-lv"><p class="label">等级</p><div class="pp-num">Lv ' + lv + '</div>' +
    '<div class="bar"><i style="width:' + Math.min(100, ((p.earned - lo) / (hi - lo)) * 100) + '%"></i></div>' +
    '<p class="muted">再赚 ' + fmt(hi - p.earned) + ' 升到 Lv ' + (lv + 1) + '</p></div>' +
    '</div>'
  );
}

export function challengesHtml(compact?: boolean): string {
  const d = pday();
  const rows = todayChallenges()
    .map((c) => {
      const v = Math.min(c.goal, c.val(d));
      const done = !!d.ch[c.id];
      return (
        '<div class="ch' + (done ? ' done' : '') + '"><span class="ch-mark">' + (done ? ICON_OK : '') + '</span>' +
        '<span class="ch-t">' + c.text + '</span><span class="ch-p">' + (c.goal > 1 ? v + ' / ' + c.goal : '') + '</span><span class="ch-r">+' + c.reward + '</span></div>'
      );
    })
    .join('');
  return '<section class="panel challenges' + (compact ? ' compact' : '') + '"><div class="head-row"><p class="label">今日挑战</p></div>' + rows + '</section>';
}

function achievementsHtml(): string {
  const p = state.points;
  const done = ACHIEVEMENTS.filter((a) => p.ach[a.id]).length;
  return (
    '<section class="panel achs"><div class="head-row"><h2 class="h2">成就</h2><span class="muted">' + done + ' / ' + ACHIEVEMENTS.length + '</span></div><div class="ach-grid">' +
    ACHIEVEMENTS.map((a) => {
      const got = !!p.ach[a.id];
      const v = Math.min(a.goal, a.val());
      return (
        '<div class="ach' + (got ? ' got' : '') + '"><span class="ach-ic">' + ICON_SPARK + '</span><div><b>' + a.name + '</b><span>' + a.desc + '</span>' +
        '<span class="ach-p">' + (got ? '已获得 +' + a.reward : fmt(v) + ' / ' + fmt(a.goal) + ' · +' + a.reward) + '</span></div></div>'
      );
    }).join('') +
    '</div></section>'
  );
}

function careBar(label: string, v: number, sick?: boolean): string {
  const n = Math.round(v || 0);
  return '<div class="care"><span>' + label + '</span><div class="bar mood' + (sick ? ' sick' : n < 30 ? ' low' : '') + '"><i style="width:' + (sick ? 100 : n) + '%"></i></div><b>' + (sick ? '—' : n) + '</b></div>';
}

// 背包里能给这只用的东西
function careButtons(p: Pet): string {
  const uses = p.sick ? ['medicine'] : isFish(p) ? [] : ['feed', 'toy'];
  const ids = Object.keys(state.world.bag).filter((id) => {
    const it = ITEMS.get(id);
    return it && uses.includes(it.use!);
  });
  return ids.map((id) => '<button class="use" data-act="careUse" data-pet="' + p.id + '" data-id="' + esc(id) + '" title="' + esc(ITEMS.get(id)!.name + ' · ' + itemNote(ITEMS.get(id)!)) + '">' + pxImg(itemIcon(ITEMS.get(id)), 2) + '<span class="n">' + state.world.bag[id] + '</span></button>').join('');
}

// 一只宠物的卡片：画面、名字、饱腹和心情、能用的东西
function petCardHtml(p: Pet): string {
  const sp = SPECIES.get(p.sp)!;
  const main = p.id === state.petMain;
  const ward = ui.wardPet === p.id;
  const own = SHELVES.find((x) => x.id === 'petlook')!.items.filter((it) => state.petWardrobe.includes(it.id));
  return (
    '<section class="panel pet-home' + (p.sick ? ' sick' : '') + '"><div class="ph-grid">' +
    '<div class="pet-stage' + (p.sick ? ' sick' : '') + '" data-pet="' + p.id + '"><div class="pet-bubble"></div><div class="pet-hop">' + pxImg(petCanvas(p.sick ? 'sick' : 'idle', p), 4, 'stage-img') + '</div></div>' +
    '<div class="ph-info"><h2 class="h2">' + esc(p.name) + ' <button class="link" data-act="renamePet" data-pet="' + p.id + '">改名</button></h2>' +
    '<p class="muted">' + sp.name + ' · 第 ' + petAge(p) + ' 天 · <b class="' + (petLow(p) ? 'bad' : '') + '">' + petLabel(p) + '</b></p>' +
    careBar('饱腹', p.food, p.sick) + careBar('心情', p.mood, p.sick) +
    '<div class="use-row">' + careButtons(p) + '<button class="link" data-act="openShelf" data-shelf="petcare">' + (p.sick && !bagHas('medicine') ? '买药' : '买吃的和玩具') + '</button></div>' +
    '<div class="actions">' +
    (main ? '<span class="tag">正在陪你背单词</span>' : '<button class="btn small ghost" data-act="setMain" data-pet="' + p.id + '">陪我背单词</button>') +
    (own.length ? '<button class="btn small ghost" data-act="wardPet" data-pet="' + p.id + '">' + (ward ? '收起衣柜' : '换装扮') + '</button>' : '') +
    '</div></div></div>' +
    (ward
      ? '<div class="shop-grid ward">' +
        own.map((it) => {
          const on = p.wear[it.slot!] === it.id;
          return '<button class="shop-item' + (on ? ' on' : '') + '" data-act="wearPet" data-pet="' + p.id + '" data-id="' + it.id + '">' + pxImg(petCanvas('idle', Object.assign({}, p, { wear: Object.assign({}, p.wear, { [it.slot!]: it.id }) })), 2) + '<span class="si-name">' + it.name + '</span><span class="si-meta">' + (on ? '戴着' : '戴上') + '</span></button>';
        }).join('') +
        '</div>'
      : '') +
    '</section>'
  );
}

// 池塘里的鱼：一起喂
function pondHtml(): string {
  const fish = fishList();
  if (!fish.length) return '';
  return (
    '<section class="panel pond-card"><div class="head-row"><h2 class="h2">观赏鱼</h2><span class="muted">' + fish.length + ' 条</span></div>' +
    '<div class="fish-grid">' +
    fish.map((f) => '<div class="fish' + (f.sick ? ' sick' : '') + '">' + pxImg(petCanvas('idle', f), 3) + '<div><b>' + esc(f.name) + '</b> <button class="link" data-act="renamePet" data-pet="' + f.id + '">改名</button><span class="muted small">' + SPECIES.get(f.sp)!.name + ' · ' + petLabel(f) + '</span>' + careBar('饱腹', f.food, f.sick) + careBar('心情', f.mood, f.sick) + (f.sick ? '<div class="use-row">' + careButtons(f) + '</div>' : '') + '</div></div>').join('') +
    '</div><div class="actions">' + (bagHas('fishfood') ? '<button class="btn small" data-act="feedFish">撒鱼食 · 还有 ' + state.world.bag.fishfood + ' 份</button>' : '<button class="btn small ghost" data-act="openShelf" data-shelf="petcare">买鱼食</button>') +
    '</div></section>'
  );
}

function petStatusHtml(): string {
  const land = landPets();
  let html = '';
  if (!state.pets.length) html += '<section class="panel empty-pet"><p class="muted">还没有宠物</p><button class="btn" data-act="openShop" data-tab="adopt">去宠物店</button></section>';
  html += land.map(petCardHtml).join('') + pondHtml();
  if (state.petGraves.length)
    html +=
      '<section class="panel memorial"><h2 class="h2">纪念</h2><div class="graves">' +
      state.petGraves.slice(-12).reverse().map((g) => '<div class="grave">' + pxImg(ART.pet(g.sp, 'sleep'), 2, 'gray') + '<span><b>' + esc(g.name) + '</b><span class="muted small">陪了你 ' + (g.died - g.born + 1) + ' 天</span></span></div>').join('') +
      '</div></section>';
  return html;
}

const PET_KINDS: [string, string][] = [
  ['all', '全部'],
  ['dog', '猫狗'],
  ['small', '小动物'],
  ['bird', '鸟类'],
  ['wild', '野生动物'],
  ['fish', '观赏鱼'],
];

function adoptHtml(): string {
  const kind = PET_KINDS.some((k) => k[0] === ui.petKind) ? ui.petKind : 'all';
  const list = PETS.species.filter((sp) => kind === 'all' || sp.kind === kind);
  const pick = list.some((sp) => sp.id === ui.petPick) ? ui.petPick! : list[0].id;
  const sp = SPECIES.get(pick)!;
  const have = state.pets.filter((p) => p.sp === pick).length;
  const cards = list
    .map((x) => '<button class="pet-card' + (x.id === pick ? ' on' : '') + '" data-act="petPick" data-id="' + x.id + '">' + pxImg(ART.pet(x.id, 'idle'), 2) + '<span class="pc-name">' + x.name + '</span><span class="pc-meta">' + fmt(x.price) + ' 金币</span></button>')
    .join('');
  return (
    '<div class="shelf-tabs">' + PET_KINDS.map(([id, l]) => '<button class="chip' + (id === kind ? ' on' : '') + '" data-act="adoptKind" data-kind="' + id + '">' + l + '</button>').join('') + '</div>' +
    '<section class="panel adopt"><div class="pet-grid">' + cards + '</div>' +
    '<div class="adopt-pick">' + pxImg(ART.pet(pick, 'happy'), 3) + '<div><b>' + sp.name + '</b><span class="muted small">' + fmt(sp.price) + ' 金币' + (have ? ' · 已经有 ' + have + (sp.fish ? ' 条' : ' 只') : '') + '</span></div>' +
    '<button class="btn" data-act="buyPet" data-id="' + pick + '"' + (state.points.bal >= sp.price ? '' : ' disabled') + '>买一只</button></div></section>'
  );
}

// 戴上 it 之后的样子（预览用陪你背单词的那只，没有宠物就用小螃蟹）
function petPreview(it: ShopItem): HTMLCanvasElement | null {
  const p = mainPet() || { sp: 'crab', wear: {} };
  return petCanvas('idle', Object.assign({}, p, { wear: Object.assign({}, p.wear, { [it.slot!]: it.id }) }) as Pet);
}

// 商店里一件东西的样子
function shelfPreview(it: ShopItem): string {
  if (it.shelf === 'look') {
    const look = Object.assign(avatarLook(), it.look);
    return pxImg(ART.avatar(look, 'idle', 'front'), 2);
  }
  if (it.shelf === 'petlook') return pxImg(petPreview(it), 2);
  if (it.decor) {
    const c = ART.decor(it.decor)!;
    return pxImg(c, c.width > 32 ? 1 : 2);
  }
  if (it.plant) {
    const [k, sp] = it.plant;
    if (k === 'tree') return pxImg(ART.tree(sp, 4), 1);
    return pxImg(k === 'flower' ? ART.flower(sp, 3) : k === 'grass' ? ART.grass(sp, 2) : ART.shrub(sp, 2), 3);
  }
  return pxImg(itemIcon(it), 3);
}

function shelfItemHtml(it: ShopItem): string {
  let meta: string;
  let act: string;
  if (it.shelf === 'look') {
    const owned = state.world.owned.includes(it.id);
    const on = state.world.look[it.slot!] === it.id;
    meta = on ? '穿着' : owned ? '已拥有' : fmt(it.price) + ' 金币';
    act = '<button class="btn small' + (on ? ' ghost' : '') + '" data-act="lookItem" data-id="' + it.id + '">' + (on ? '脱下' : owned ? '穿上' : '购买') + '</button>';
  } else if (it.shelf === 'petlook') {
    const owned = state.petWardrobe.includes(it.id);
    meta = owned ? '已拥有' : fmt(it.price) + ' 金币';
    act = owned ? '<button class="btn small ghost" data-act="openShop" data-tab="status">去换</button>' : '<button class="btn small" data-act="buyPetLook" data-id="' + it.id + '">购买</button>';
  } else if (it.once) {
    const owned = !!state.world[it.id as Tool];
    meta = owned ? '已拥有' : '<span class="pts-ic"></span>' + fmt(it.price);
    act = owned ? '' : '<button class="btn small" data-act="buyItem" data-id="' + it.id + '">购买</button>';
  } else {
    const n = state.world.bag[it.id] || 0;
    meta = '<span class="pts-ic"></span>' + fmt(it.price) + (n ? '<span class="have">有 ' + n + '</span>' : '');
    act = '<button class="btn small" data-act="buyItem" data-id="' + it.id + '">购买</button>';
  }
  const note = itemNote(it);
  return '<div class="shop-item">' + '<div class="si-pic">' + shelfPreview(it) + '</div><span class="si-name">' + esc(it.name) + '</span>' + (note ? '<span class="si-note">' + note + '</span>' : '') + '<span class="si-meta">' + meta + '</span>' + act + '</div>';
}

// 扩建花园的卡片
function landHtml(): string {
  const lv = state.world.land || 0;
  const next = LANDS[lv + 1];
  if (!next) return '<div class="shop-item land"><div class="si-pic">' + pxImg(ART.icon('shovel'), 3) + '</div><span class="si-name">花园已经扩建到最大</span><span class="si-meta">' + LANDS[lv].w + ' × ' + (LANDS[lv].h + OY) + ' 格</span></div>';
  return (
    '<div class="shop-item land"><div class="si-pic">' + pxImg(ART.icon('shovel'), 3) + '</div><span class="si-name">扩建花园</span>' +
    '<span class="si-note">' + LANDS[lv].w + ' × ' + (LANDS[lv].h + OY) + ' → ' + next.w + ' × ' + (next.h + OY) + ' 格</span>' +
    '<span class="si-meta">' + costText(next) + '</span>' + shortNote(next) + '<button class="btn small" data-act="buyLand">扩建</button></div>'
  );
}

// 材料还差多少（够了就不显示）
function shortNote(need: Cost): string {
  const s = matsShort(need);
  return s.length ? '<span class="si-note short">还差' + s.join('、') + '</span>' : '';
}

// 扩建房子的卡片
function houseHtml(): string {
  const lv = houseLevel();
  const next = HOUSES[lv + 1];
  const pic = (h: { sprite: string }) => pxImg(ART.decor(h.sprite), 0.75);
  if (!next) return '<div class="shop-item land"><div class="si-pic">' + pic(HOUSES[lv]) + '</div><span class="si-name">' + HOUSES[lv].name + '</span><span class="si-meta">已经是最大的房子</span></div>';
  return (
    '<div class="shop-item land"><div class="si-pic">' + pic(next) + '</div><span class="si-name">扩建成' + next.name + '</span>' +
    '<span class="si-note">屋里 ' + next.room[0] + ' × ' + next.room[1] + ' 格</span>' +
    '<span class="si-meta">' + costText(next) + '</span>' + shortNote(next) + '<button class="btn small" data-act="buyHouse">扩建</button></div>'
  );
}

function shelfHtml(tab: string): string {
  const ids = SHOP_TABS.find((t) => t[0] === tab)![2]!;
  const cur = ids.includes(ui.shelf!) ? ui.shelf! : ids[0];
  const name = (id: string) => (id === 'build' ? '扩建' : SHELVES.find((s) => s.id === id)!.name);
  const items = cur === 'build' ? [] : SHELVES.find((s) => s.id === cur)!.items.map((it) => ITEMS.get(it.id)!);
  return (
    '<div class="shelf-tabs">' + ids.map((id) => '<button class="chip' + (id === cur ? ' on' : '') + '" data-act="openShelf" data-shelf="' + id + '">' + name(id) + '</button>').join('') + '</div>' +
    '<section class="panel store"><div class="shop-grid">' + (cur === 'build' ? landHtml() + houseHtml() : items.map(shelfItemHtml).join('')) + '</div></section>'
  );
}

function rulesHtml(): string {
  return (
    '<section class="panel rules"><h2 class="h2">金币</h2><ul>' +
    '<li>答对一题 +' + PTS.right + '，每连对 5 题再 +' + PTS.combo + '</li>' +
    '<li>背完一组新词：组里有几个词就 +几；全对再 +' + PTS.perfect + '</li>' +
    '<li>学完一组词根 +' + PTS.rootDone + '，全对再 +' + PTS.rootPerfect + '</li>' +
    '<li>每日新词目标 +' + PTS.goal + '，每日词根目标 +' + PTS.rootGoal + '，每日挑战和成就另有奖励</li>' +
    '<li>以前错过的词再答错 −' + PTS.again + '</li>' +
    '</ul><h2 class="h2" style="margin-top:22px">宠物</h2><ul>' +
    '<li>饱腹每天 −' + CARE.food + '，心情每天 −' + CARE.mood + '；喂饭、玩具、在花园玩、陪你背单词、摸摸它都会回升</li>' +
    '<li>饱腹或心情掉到 0 会生病，吃药才能好；生病 ' + CARE.sickDays + ' 天没吃药就会死</li>' +
    '</ul><h2 class="h2" style="margin-top:22px">花园</h2><ul>' +
    '<li>先买一把锄头开垦草地，开垦一格 ' + TILL.cost + ' 金币、1 点体力；种子要种在开垦过的地上，草坪种子能把空地变回草地</li>' +
    '<li>体力每天 ' + TILL.max + ' 点，第二天回满；背完一组单词 +' + TILL.word + '，学完一组词根 +' + TILL.root + '</li>' +
    '<li>买种子种下，每天浇一次水长一阶，施一次肥也长一阶</li>' +
    '<li>树从种子长成大树要 4 阶，花 3 阶，草和灌木 2 阶</li>' +
    '</ul></section>'
  );
}

VIEWS.shop = function () {
  petsTick();
  const tab = shopTab();
  const body = ({ status: petStatusHtml, adopt: adoptHtml, goals: () => challengesHtml(false) + achievementsHtml(), rules: rulesHtml } as Record<string, () => string>)[tab] ? ({ status: petStatusHtml, adopt: adoptHtml, goals: () => challengesHtml(false) + achievementsHtml(), rules: rulesHtml } as Record<string, () => string>)[tab]() : shelfHtml(tab);
  return (
    '<main class="page">' +
    '<h1 class="h1">商店</h1>' +
    pointsPanelHtml() +
    '<div class="shop-tabs">' + SHOP_TABS.map(([id, label]) => '<button class="chip' + (id === tab ? ' on' : '') + '" data-act="openShop" data-tab="' + id + '">' + label + '</button>').join('') + '</div>' +
    body +
    '</main>'
  );
};

// 首页的花园卡片：宠物好不好、今天还有多少株没浇水
export function gardenCardHtml(): string {
  const pets = state.pets.filter((p) => SPECIES.has(p.sp));
  const need = pets.filter(petLow);
  const thirsty = state.world.plants.filter((pl) => plantStage(pl) < plantMax(pl) && !wateredToday(pl)).length;
  const pics = landPets().slice(0, 4).map((p) => pxImg(petCanvas(p.sick ? 'sick' : 'idle', p), 2)).join('');
  let h: string;
  let sub: string;
  if (!pets.length) {
    h = '还没有宠物';
    sub = '';
  } else {
    h = need.length ? need.map((p) => p.name + petLabel(p)).slice(0, 3).join('，') : pets.length + ' 只宠物都很好';
    sub = thirsty ? thirsty + ' 株今天还没浇水' : '';
  }
  return (
    '<section class="panel gcard"><div class="gc-pets">' + (pics || pxImg(ART.tree('oak', 4), 1)) + '</div>' +
    '<div class="gc-main"><p class="label">花园</p><h2 class="h2' + (need.length ? ' bad' : '') + '">' + esc(h) + '</h2>' + (sub ? '<p class="muted">' + sub + '</p>' : '') +
    '<div class="actions"><button class="btn ghost" data-act="nav" data-view="garden">去花园</button>' + (pets.length ? '<button class="btn ghost" data-act="openShop" data-tab="status">我的宠物</button>' : '<button class="btn ghost" data-act="openShop" data-tab="adopt">宠物店</button>') + '</div></div></section>'
  );
}
