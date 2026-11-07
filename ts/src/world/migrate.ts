// 旧版本存档的迁移

import { toast } from '../app/dialogs';
import { save, state } from '../app/store';
import { dayNum, fmt } from '../app/util';
import { bagAdd } from './bag';
import { CARE, GB, HOUSES, ITEMS, OY, PETS, SPECIES, layoutGarden } from './data';
import { seedDebris } from './debris';
import { plantMax, plantStage, weekStart } from './garden';
import { relocate } from './occupancy';
import { newPet } from './pets';
import { roomRelocate } from './terrain';
import { OldGarden } from '../app/types';

// 旧版本的数据：
// 0.3 → 饱食度去掉，退回新版没有的宠物配饰，旧的森林记录挪进花园；
// 0.4 → 一只宠物变成可以养好几只（加上饱腹），专注种树去掉（退回解锁树种和宠物品种花的金币，长好的树留着），花园变大
export function migrate(): void {
  const W = state.world;
  // 以前就有的存档（不是刚开始玩的新玩家）
  const wasOld = !!(W.layout || W.v5 || W.migrated);
  // 以前的版本都是农舍；新来的从小木屋开始
  if (W.house == null) {
    W.house = !W.layout && (W.v5 || W.migrated) ? 1 : 0;
    // 以前的农舍屋里是 18 格宽，现在 20 格：家具往右挪一格，还是对着门
    if (W.house === 1) for (const d of W.room) d.x += 1;
  }
  // 0.5.3：花园和房子都改成 11 级。以前的花园 0–3 级对到 0、2、4、6 级（都比原来大）；
  // 小木屋、农舍、两层小楼、别墅对到 0、2、4、8 级，别墅的屋里变宽了，家具往右挪一点，还是对着门
  if (!W.layout) {
    W.layout = 3;
    W.land = [0, 2, 4, 6][Math.max(0, Math.min(3, W.land || 0))];
    const h = Math.max(0, Math.min(3, W.house || 0));
    W.house = [0, 2, 4, 8][h];
    const dx = (HOUSES[W.house!].room[0] - [16, 20, 24, 28][h]) / 2;
    for (const d of W.room) d.x += dx;
    W.layout = 4;
  } else if (W.layout === 3) {
    // 0.5.4：屋里变大（宽 8 格），家具跟着门挪到中间
    W.layout = 4;
    for (const d of W.room) d.x += 4;
  }
  layoutGarden();
  const old = state.pet;
  let refund = 0;
  const notes: string[] = [];
  if (old) {
    for (const id of (old.owned || []).slice()) {
      if (!PETS.refund[id]) continue;
      refund += PETS.refund[id];
      old.owned = old.owned!.filter((x) => x !== id);
    }
  }
  if (!W.migrated) {
    W.migrated = 1;
    const garden: OldGarden = state.garden || {};
    const wk = weekStart();
    W.week = W.week || wk;
    for (const day in garden) {
      if (!Array.isArray(garden[day])) continue;
      const n = Math.round(new Date(day + 'T00:00:00Z').getTime() / 86400000);
      const ws = weekStart(n);
      for (const [sp, ok] of garden[day] as [string, unknown][]) {
        if (!ok) continue;
        if (ws === wk) W.plants.push({ k: 'tree', sp, ok: 1, x: -1, y: -1, w: [], f: 0 });
        else {
          const h = W.hist[ws] || (W.hist[ws] = { t: 0, y: 0, f: 0, s: 0, g: 0, p: [], dc: [] });
          h.t++;
        }
      }
    }
    delete state.garden;
  }
  if (!W.v5) {
    W.v5 = 1;
    // 宠物：一只变成一个列表
    if (old) {
      if (old.status === 'alive' && SPECIES.has(old.species)) {
        const p = newPet(old.species, old.name);
        p.born = old.born || dayNum();
        p.mood = old.mood == null ? CARE.start : old.mood;
        p.sick = !!old.sick;
        p.sickSince = old.sickSince || 0;
        p.wear = {};
        for (const slot of ['hat', 'color']) if (old.wear && old.wear[slot]) p.wear[slot] = old.wear[slot];
        state.petMain = p.id;
        bagAdd('food.kibble', 6); // 新版要喂饭了，先送几份宠物粮
        notes.push('送你 6 份宠物粮');
      }
      for (const g of old.graves || []) state.petGraves.push({ name: g.name, sp: g.species, born: g.born, died: g.died });
      state.petWardrobe = (old.owned || []).filter((id) => ITEMS.has(id));
      // 以前花金币解锁的宠物品种，现在改成直接买，退回解锁花的金币
      const SP_OLD: Record<string, number> = { cat: 200, hamster: 200, shiba: 300, rabbit: 300, duck: 400, penguin: 500, frog: 500, fox: 600 };
      for (const id of old.unlocked || []) refund += SP_OLD[id] || 0;
    }
    // 专注种树去掉了：退回解锁树种花的金币；种活的树留在花园里，算长大的树；枯萎的清掉
    const TR_OLD: Record<string, number> = { pine: 150, cactus: 200, bamboo: 250, sakura: 300, maple: 300, ginkgo: 400, palm: 400, apple: 500 };
    if (state.forest) for (const id of state.forest.unlocked || []) refund += TR_OLD[id] || 0;
    W.plants = W.plants.filter((pl) => pl.k !== 'tree' || pl.ok !== 0);
    for (const pl of W.plants) {
      if (pl.k === 'tree' && pl.ok != null) {
        pl.b = 4;
        delete pl.ok;
        delete pl.min;
      }
    }
    W.grown = { t: 0, f: 0 };
    for (const k in W.hist) {
      W.grown.t += W.hist[k].t || 0;
      W.grown.f += W.hist[k].f || 0;
    }
    for (const pl of W.plants) if (plantStage(pl) >= plantMax(pl)) W.grown[pl.k === 'tree' ? 't' : 'f'] += pl.k === 'tree' || pl.k === 'flower' ? 1 : 0;
    try {
      localStorage.removeItem('margin.focus');
    } catch (e) {
      /* 没有就算了 */
    }
    delete state.pet;
    delete state.forest;
  }
  // 没有位置的树（0.3 迁移过来的）和压在房子、路上的东西，挪到空地上
  // 没有位置的（0.3 迁移过来的树）先排在房子左边一排，再挪到最近的空地
  let slot = 0;
  for (const pl of W.plants)
    if (pl.x < 0) {
      pl.x = 4 + (slot % 4) * 3;
      pl.y = 5 + Math.floor(slot / 4) * 2;
      slot++;
    }
  relocate();
  roomRelocate();
  // 0.5.4：地上有杂草、石头、树枝、树桩、野树要清理。新玩家整片花园都是；
  // 以前的存档只在这次变大多出来的地方（0.5.3 的花园外面）
  if (!W.debris) {
    W.debris = [];
    W.debrisDay = dayNum();
    if (wasOld) {
      const ow = 48 + 4 * (W.land || 0);
      const oh = 36 + 3 * (W.land || 0) + OY;
      seedDebris((x, y) => x >= ow - GB || y >= oh - GB);
    } else seedDebris(() => true);
  }
  if (!W.gift) {
    W.gift = 1;
    bagAdd('water', 5);
    bagAdd('seed.tulip', 2);
    bagAdd('seed.daisy', 2);
    bagAdd('treat', 1);
  }
  if (refund) {
    state.points.bal += refund;
    notes.push('退回 ' + fmt(refund) + ' 金币');
  }
  if (notes.length) setTimeout(() => toast(notes.join('；')), 1200);
  save();
}
