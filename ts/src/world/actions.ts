// 商店、花园、宠物的按钮操作

import { askConfirm, askText, toast } from '../app/dialogs';
import { go, ui } from '../app/nav';
import { ACTIONS, Action } from '../app/registry';
import { render } from '../app/render';
import { save, state } from '../app/store';
import { fmt } from '../app/util';
import { bagAdd } from './bag';
import { careUse, feedFish } from './bagui';
import { spend } from './coins';
import { GB, GH, GW, HOUSES, ITEMS, LANDS, OY, SPECIES, allRoomItems, houseLevel, layoutGarden } from './data';
import { costText, matsShort, payMats, seedDebris } from './debris';
import { relocate, shiftTilled } from './occupancy';
import { isFish, mainPet, newPet, petById } from './pets';
import { petSay, roam } from './roam';
import { goScene, refreshSceneUi } from './sceneui';
import { tabOfShelf } from './shop';
import { roomRelocate, scene, setRoomCanvas, setScene, terrainCache } from './terrain';
import { ShopItem } from '../data/types';
import { Tool } from '../app/types';

Object.assign(ACTIONS, {
  openShop(t) {
    ui.shopTab = t.dataset.tab;
    if (ui.view !== 'shop') go('shop');
    else render();
  },
  openShelf(t) {
    ui.shelf = t.dataset.shelf;
    ui.shopTab = tabOfShelf(ui.shelf);
    if (ui.view !== 'shop') go('shop');
    else render();
  },
  tool(t) {
    const id = t.dataset.id;
    ui.tool = ui.tool === id ? null : id;
    refreshSceneUi();
  },
  goRoom() {
    ui.floor = 1;
    goScene('room');
  },
  goGarden() {
    goScene('garden');
  },
  zoom(t) {
    if (!scene) return;
    scene.zoomBy(+t.dataset.d);
  },
  buyItem(t) {
    const it = ITEMS.get(t.dataset.id);
    if (!it || (it.once && state.world[it.id as Tool]) || !spend(it.price)) return;
    if (it.once) state.world[it.id as Tool] = 1;
    else bagAdd(it.into || it.id, it.gives || 1);
    save();
    toast('买了' + it.name);
    render();
  },
  lookItem(t) {
    const it = ITEMS.get(t.dataset.id);
    if (!it) return;
    const W = state.world;
    if (W.look[it.slot!] === it.id) delete W.look[it.slot!];
    else {
      if (!W.owned.includes(it.id)) {
        if (!spend(it.price)) return;
        W.owned.push(it.id);
      }
      W.look[it.slot!] = it.id;
      // 背带裤套装自带下装，换上它就不穿别的裤子
      if (it.look!.bottom && it.slot === 'top') delete W.look.bottom;
      if (it.slot === 'bottom' && W.look.top && (ITEMS.get(W.look.top) || ({} as Partial<ShopItem>)).look && ITEMS.get(W.look.top)!.look!.bottom) delete W.look.top;
    }
    save();
    render();
  },
  buyPetLook(t) {
    const it = ITEMS.get(t.dataset.id);
    if (!it || state.petWardrobe.includes(it.id) || !spend(it.price)) return;
    state.petWardrobe.push(it.id);
    save();
    toast('买了' + it.name);
    render();
  },
  wearPet(t) {
    const it = ITEMS.get(t.dataset.id);
    const p = petById(+t.dataset.pet);
    if (!it || !p || !state.petWardrobe.includes(it.id)) return;
    if (p.wear[it.slot!] === it.id) delete p.wear[it.slot!];
    else {
      p.wear[it.slot!] = it.id;
      if (p === mainPet()) setTimeout(() => petSay('dressed'), 200);
    }
    save();
    render();
  },
  wardPet(t) {
    const id = +t.dataset.pet;
    ui.wardPet = ui.wardPet === id ? null : id;
    render();
  },
  careUse(t) {
    if (careUse(petById(+t.dataset.pet), t.dataset.id)) render();
  },
  feedFish() {
    if (feedFish()) render();
  },
  setMain(t) {
    const p = petById(+t.dataset.pet);
    if (!p || isFish(p)) return;
    state.petMain = p.id;
    save();
    roam.x = null;
    toast(p.name + '会陪你背单词');
    render();
  },
  petPick(t) {
    ui.petPick = t.dataset.id;
    render();
  },
  adoptKind(t) {
    ui.petKind = t.dataset.kind;
    ui.petPick = null;
    render();
  },
  async buyPet(t) {
    const sp = SPECIES.get(t.dataset.id);
    if (!sp) return;
    if (state.points.bal < sp.price) return toast('金币不够（还差 ' + fmt(sp.price - state.points.bal) + '）');
    const n = state.pets.filter((p) => p.sp === sp.id).length;
    const name = await askText('给你的' + sp.name + '起个名字', sp.name + (n ? ' ' + (n + 1) : ''));
    if (name === null) return;
    if (!spend(sp.price)) return;
    const p = newPet(sp.id, name.trim().slice(0, 12) || sp.name);
    save();
    roam.x = null;
    toast(p.name + (sp.fish ? '游进池塘了' : '来到花园了'));
    // 留在宠物店、还选着这一种：同一种可以接着买
    ui.petPick = sp.id;
    render();
    if (p === mainPet()) setTimeout(() => petSay('hello'), 300);
  },
  async renamePet(t) {
    const p = petById(+t.dataset.pet);
    if (!p) return;
    const name = await askText('改个名字', p.name);
    if (name === null || !name.trim()) return;
    p.name = name.trim().slice(0, 12);
    save();
    render();
  },
  async buyHouse() {
    const lv = houseLevel();
    const next = HOUSES[lv + 1];
    if (!next) return;
    if (state.points.bal < next.price) return toast('金币不够（还差 ' + fmt(next.price - state.points.bal) + '）');
    const shortH = matsShort(next);
    if (shortH.length) return toast('材料不够：还差' + shortH.join('、'));
    if (!(await askConfirm('花 ' + costText(next) + ' 把房子扩建成' + next.name + '？', '扩建'))) return;
    if (matsShort(next).length || !spend(next.price)) return;
    payMats(next);
    // 屋子变宽，家具跟着门一起挪到中间；花园上边多出来的几行，园子里的东西跟着房子往下挪
    const dx = (next.room[0] - HOUSES[lv].room[0]) / 2;
    for (const d of allRoomItems()) d.x += dx;
    const dy = next.oy - HOUSES[lv].oy;
    for (const it of [...state.world.plants, ...state.world.decor, ...(state.world.debris || [])]) it.y += dy;
    shiftTilled(dy);
    state.world.house = lv + 1;
    layoutGarden();
    relocate();
    roomRelocate();
    terrainCache.key = '';
    setRoomCanvas(null);
    save();
    toast('房子扩建成' + next.name + '了');
    const back = ui.view === 'room' ? 'room' : 'garden';
    if (scene) scene.stop();
    setScene(null);
    go(ui.view === 'shop' ? 'shop' : back);
  },
  async buyLand() {
    const lv = state.world.land || 0;
    const next = LANDS[lv + 1];
    if (!next) return;
    if (state.points.bal < next.price) return toast('金币不够（还差 ' + fmt(next.price - state.points.bal) + '）');
    const shortL = matsShort(next);
    if (shortL.length) return toast('材料不够：还差' + shortL.join('、'));
    if (!(await askConfirm('花 ' + costText(next) + ' 把花园扩建到 ' + next.w + ' × ' + (next.h + OY) + ' 格？', '扩建'))) return;
    if (matsShort(next).length || !spend(next.price)) return;
    payMats(next);
    // 新扩出来的地是荒地：上面有杂草、石头、野树
    const ow = GW;
    const oh = GH;
    state.world.land = lv + 1;
    layoutGarden();
    relocate();
    seedDebris((x, y) => x >= ow - GB || y >= oh - GB);
    terrainCache.key = '';
    save();
    toast('花园扩建好了');
    if (scene) scene.stop();
    setScene(null);
    go('garden');
  },
} satisfies Record<string, Action>);
