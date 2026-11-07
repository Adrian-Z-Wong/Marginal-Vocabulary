// 金币、宠物、花园：商店的货、挑战、成就、花园和房子的等级和布局

import { ui } from '../app/nav';
import { streak } from '../app/stats';
import { state } from '../app/store';
import { ART } from '../art';
import { MARGIN_PETS } from '../data/pets';
import { gardenCount } from './occupancy';
import { petAge } from './pets';
import { Placed, PointsDay } from '../app/types';
import { ShopItem } from '../data/types';

// ================= 金币、宠物、花园 =================
// 背单词攒金币，在商店买宠物、种子、水、肥料、装饰、家具、宠物用品和装扮。
// 花园：买来的树、花、草、灌木种下以后浇水施肥慢慢长大。
// 宠物可以养好几只，每只都有饱腹和心情，每天往下掉，掉到 0 会生病，要吃药，生病太久会死。

export const PETS = MARGIN_PETS;
export const SPECIES = new Map(PETS.species.map((s) => [s.id, s]));
export const TREES = new Map(PETS.trees.map((t) => [t.id, t]));
// 商店里的树种子由树的列表生成
export const SHELVES = PETS.shop.map((sh) =>
  sh.items === 'TREES' ? Object.assign({}, sh, { items: PETS.trees.map((t): ShopItem => ({ id: 'tseed.' + t.id, name: t.name, price: t.price, use: 'plant', plant: ['tree', t.id] })) }) : sh
) as { id: string; name: string; items: ShopItem[] }[];
export const ITEMS = new Map<string, ShopItem>();
for (const sh of SHELVES) for (const it of sh.items as ShopItem[]) ITEMS.set(it.id, Object.assign({ shelf: sh.id }, it));
export const PTS = { right: 2, combo: 5, perfect: 10, rootDone: 5, rootPerfect: 5, goal: 30, rootGoal: 15, again: 1 };
// 照顾宠物：买来时饱腹、心情都是 80；每天饱腹掉 35、心情掉 20（鱼掉得少一点）；
// 有一样掉到 0 就生病，吃药能好；生病 3 天没吃药就死了。背单词、在花园玩、摸摸它，每天各有上限
export const CARE = { start: 80, food: 35, mood: 20, fishFood: 30, fishMood: 12, cure: 50, studyCap: 20, playCap: 25, petCap: 6, sickDays: 3 };

// 每日挑战：每天从里面挑 3 个
export const CHALLENGES: { id: string; text: string; reward: number; goal: number; val: (d: PointsDay) => number }[] = [
  { id: 'groups2', text: '完成 2 组新词', reward: 15, goal: 2, val: (d) => d.groups },
  { id: 'perfect1', text: '一组单词全对', reward: 15, goal: 1, val: (d) => d.perfect },
  { id: 'right50', text: '答对 50 题', reward: 15, goal: 50, val: (d) => d.right },
  { id: 'combo10', text: '连续答对 10 题', reward: 10, goal: 10, val: (d) => d.combo },
  { id: 'roots1', text: '学完 1 组词根', reward: 10, goal: 1, val: (d) => d.roots },
  { id: 'goal', text: '完成今天的新词目标', reward: 10, goal: 1, val: (d) => (d.goalDone ? 1 : 0) },
  { id: 'feed2', text: '喂宠物 2 次', reward: 10, goal: 2, val: (d) => d.feed || 0 },
  { id: 'water3', text: '给花园浇 3 次水', reward: 10, goal: 3, val: (d) => d.water || 0 },
];

// 成就：一次性奖励
export const ACHIEVEMENTS: { id: string; name: string; desc: string; reward: number; goal: number; val: () => number }[] = [
  { id: 'first', name: '第一组', desc: '完成第一组单词', reward: 20, goal: 1, val: () => state.points.groups },
  { id: 'words100', name: '百词', desc: '累计背过 100 个词', reward: 30, goal: 100, val: () => Object.keys(state.stats).length },
  { id: 'words500', name: '五百词', desc: '累计背过 500 个词', reward: 80, goal: 500, val: () => Object.keys(state.stats).length },
  { id: 'words2000', name: '两千词', desc: '累计背过 2,000 个词', reward: 200, goal: 2000, val: () => Object.keys(state.stats).length },
  { id: 'words5000', name: '五千词', desc: '累计背过 5,000 个词', reward: 500, goal: 5000, val: () => Object.keys(state.stats).length },
  { id: 'streak3', name: '三天', desc: '连续打卡 3 天', reward: 20, goal: 3, val: () => streak() },
  { id: 'streak7', name: '一周', desc: '连续打卡 7 天', reward: 50, goal: 7, val: () => streak() },
  { id: 'streak30', name: '一个月', desc: '连续打卡 30 天', reward: 150, goal: 30, val: () => streak() },
  { id: 'streak100', name: '一百天', desc: '连续打卡 100 天', reward: 500, goal: 100, val: () => streak() },
  { id: 'perfect10', name: '十全十美', desc: '累计 10 组全对', reward: 50, goal: 10, val: () => state.points.perfects },
  { id: 'perfect50', name: '稳扎稳打', desc: '累计 50 组全对', reward: 200, goal: 50, val: () => state.points.perfects },
  { id: 'roots50', name: '寻根', desc: '学过 50 个词根', reward: 50, goal: 50, val: () => Object.keys(state.rootStats).length },
  { id: 'roots300', name: '根深', desc: '学过 300 个词根', reward: 150, goal: 300, val: () => Object.keys(state.rootStats).length },
  { id: 'pet7', name: '好伙伴', desc: '有一只宠物陪了你 7 天', reward: 50, goal: 7, val: () => petAge() },
  { id: 'pet30', name: '老朋友', desc: '有一只宠物陪了你 30 天', reward: 200, goal: 30, val: () => petAge() },
  { id: 'tree1', name: '第一棵树', desc: '种出第一棵大树', reward: 20, goal: 1, val: () => gardenCount('t') },
  { id: 'tree10', name: '小树林', desc: '种出 10 棵大树', reward: 100, goal: 10, val: () => gardenCount('t') },
  { id: 'tree50', name: '森林', desc: '种出 50 棵大树', reward: 300, goal: 50, val: () => gardenCount('t') },
  { id: 'flower10', name: '花匠', desc: '养开 10 朵花', reward: 50, goal: 10, val: () => gardenCount('f') },
  { id: 'home5', name: '小家', desc: '屋里摆 5 件家具', reward: 50, goal: 5, val: () => allRoomItems().length },
];

// 花园的布局（模仿星露谷的农场）：上方是房子，门口一条小路往下，分别通向左边和下边的出口；
// 左下角是池塘，四周是树林。花园可以花金币扩建三次，往右、往下变大，原来的东西位置不变。
export const TILE = 16;
export const GB = 2; // 外圈两格是树林
// 花园都是 4:3，和画面一样
// 花园一共 11 级：一开始 64 × 48 格，扩建 10 次到 104 × 78 格（都是 4:3）
// 扩建除了金币还要木材、石料（清理花园得到，也能在商店买）
export const LANDS = [0, 2000, 3500, 5000, 7000, 9000, 12000, 15000, 19000, 24000, 30000].map((price, i) => ({ w: 64 + 4 * i, h: 48 + 3 * i, price, wood: 6 * i, stone: 4 * i }));
// 一共 11 级，扩建 10 次到庄园；门一直在第 20 列，房子往两边、往上变大，屋里也跟着变大
export const HOUSES = ([
  ['小木屋', 'cabin', 0],
  ['石头小屋', 'cottage', 3000],
  ['农舍', 'house', 5000],
  ['大农舍', 'farm2', 8000],
  ['两层小楼', 'house2', 11000],
  ['红砖洋房', 'brick', 15000],
  ['白色洋房', 'white', 20000],
  ['石头大宅', 'manor', 25000],
  ['别墅', 'villa', 31000],
  ['大别墅', 'villa2', 38000],
  ['庄园', 'estate', 46000],
] as [string, string, number][]).map(([name, sprite, price], i) => {
  const D = ART.DECOR[sprite];
  // oy：房子比 8 格高，花园上边就多出几行给它
  return { name, sprite, price, wood: i ? 10 * i + 10 : 0, stone: 8 * i, w: D.tw, h: D.th, room: [24 + 2 * i, 14 + i], floors: i >= 9 ? 3 : i >= 4 ? 2 : 1, oy: Math.max(0, Math.ceil(D.h / TILE) - 8) };
});
// 楼层：一楼的家具在 world.room，二楼 room2，三楼 room3
export function floorCount(): number {
  return HOUSES[houseLevel()].floors;
}
export function curFloor(): number {
  return Math.max(1, Math.min(floorCount(), ui.floor || 1));
}
export function floorItems(f: number): Placed[] {
  const W = state.world;
  const k = (f > 1 ? 'room' + f : 'room') as 'room' | 'room2' | 'room3';
  return W[k] || (W[k] = []);
}
export function setFloorItems(f: number, list: Placed[]): void {
  state.world[(f > 1 ? 'room' + f : 'room') as 'room' | 'room2' | 'room3'] = list;
}
export function allRoomItems(): Placed[] {
  const out: Placed[] = [];
  for (let f = 1; f <= 3; f++) out.push(...floorItems(f));
  return out;
}
export const FLOOR_NAME = ['', '一楼', '二楼', '三楼'];
// 楼梯：两格宽、三格高，贴着后墙。一楼右边上楼，二楼右边下楼（有三楼的话左边再上楼），三楼左边下楼
export function stairsOf(f: number): { dir: string; x: number; y: number }[] {
  const n = floorCount();
  const out: { dir: string; x: number; y: number }[] = [];
  if (f < n) out.push({ dir: 'up', x: f === 1 ? RW - 5 : 3, y: 2 });
  if (f > 1) out.push({ dir: 'down', x: f === 2 ? RW - 5 : 3, y: 2 });
  return out;
}
export function onStairs(f: number, tx: number, ty: number): boolean {
  return stairsOf(f).some((s) => tx >= s.x && tx < s.x + 2 && ty >= s.y && ty < s.y + 3);
}
// 能坐的东西（x 是坐的位置，在图里的横坐标；seat 是坐垫离图顶多高）和能躺的床
export const SEATS: Record<string, { seat: number; at: number[] }> = { chair: { seat: 9, at: [8] }, stool: { seat: 8, at: [8] }, sofa: { seat: 11, at: [9, 23] }, bench: { seat: 10, at: [9, 23] } };
// 商店里哪件东西摆出来是这个样子（收回时放回背包）
export const ITEM_OF_DECOR = new Map<string, string>();
for (const it of ITEMS.values()) if (it.decor && !ITEM_OF_DECOR.has(it.decor)) ITEM_OF_DECOR.set(it.decor, it.id);
export const DOOR_X = 20;
export const HOUSE = { x: 16, y: 4, w: 9, h: 4, sprite: 'house' }; // 房子占的格子，门在下沿正中
export let GW = 40;
export let GH = 28;
export const GPATH = new Set<string>();
export const GEXIT = new Set<string>();
export const GPOND = new Set<string>();
export let POND_INNER: string[] = [];
export let OY = 0;

// 按花园大小重新铺路：门口往下到第 13 行，往左通到西边出口，往下通到南边出口
export function layoutGarden(): void {
  const L = LANDS[Math.max(0, Math.min(LANDS.length - 1, (state.world && state.world.land) || 0))];
  GW = L.w;
  const Hs = HOUSES[houseLevel()];
  OY = Hs.oy;
  GH = L.h + OY;
  Object.assign(HOUSE, { w: Hs.w, h: Hs.h, x: DOOR_X - Math.floor(Hs.w / 2), y: 8 + OY - Hs.h, sprite: Hs.sprite });
  RW = Hs.room[0];
  RH = Hs.room[1];
  RDOOR = [RW / 2 - 1, RW / 2];
  GPATH.clear();
  GEXIT.clear();
  for (let y = HOUSE.y + HOUSE.h - 1; y <= 13 + OY; y++) GPATH.add(DOOR_X + ',' + y); // 最上面一格藏在房子后面，路一直接到台阶
  // 门口往左一条路通到西边，往下一条路一直通到南边
  for (let x = 0; x <= DOOR_X + 1; x++) for (const y of [12, 13]) GPATH.add(x + ',' + (y + OY));
  for (let y = 14 + OY; y < GH; y++) for (const x of [DOOR_X, DOOR_X + 1]) GPATH.add(x + ',' + y);
  for (const k of GPATH) {
    const [x, y] = k.split(',').map(Number);
    if (x < GB || y >= GH - GB) GEXIT.add(k);
  }
  // 鱼塘：左下角一片弯弯曲曲的水，大约 150 格，可以下水游泳。一格里有一半以上是水就算池塘
  GPOND.clear();
  for (let y = POND.y; y < POND.y + POND.h; y++)
    for (let x = POND.x; x < POND.x + POND.w; x++) {
      let n = 0;
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (ART.pondInside(x + dx, y + dy)) n++;
      if (n >= 2) GPOND.add(x + ',' + (y + OY));
    }
  POND_INNER = [...GPOND].filter((k) => {
    const [x, y] = k.split(',').map(Number);
    return GPOND.has(x - 1 + ',' + y) && GPOND.has(x + 1 + ',' + y) && GPOND.has(x + ',' + (y - 1)) && GPOND.has(x + ',' + (y + 1));
  });
  GFIXED.length = 0;
  // 木头堆在房子左边、木牌在房子右边，房子变宽也不会压到
  for (const d of GFIXED_AT) GFIXED.push({ id: d.id, x: d.side === 'left' ? HOUSE.x - 5 : d.side === 'right' ? HOUSE.x + HOUSE.w + 2 : d.x!, y: d.y + OY });
}

// 地上本来就有的东西（不能收走）
export const GFIXED: Placed[] = [];
// 木牌、信箱、木头堆一直在；石头、杂草、野树这些要自己清理（见 debris）
const GFIXED_AT: { id: string; side?: string; x?: number; y: number }[] = [
  { id: 'sign', side: 'right', y: 8 },
  { id: 'mailbox', x: 22, y: 8 },
  { id: 'logs', side: 'left', y: 6 },
];
const POND = { x: 1, y: 26, w: 20, h: 20 }; // 池塘可能出现的范围（形状在 art/terrain.ts 的 pondInside）
// 屋里的大小跟着房子变；门在下沿正中两格
export let RW = 18;
export let RH = 11;
export let RDOOR = [8, 9];

export function houseLevel(): number {
  const h = state.world && state.world.house;
  return h! >= 0 && h! < HOUSES.length ? h! : 0;
}
