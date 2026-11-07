// 宠物、树种、商店货架的数据类型（数据在 pets.ts）

import type { Look } from '../art/person';

/** 宠物品种：kind 是宠物店里的分类（dog 猫狗、small 小动物、bird 鸟、wild 野生动物、fish 观赏鱼），fish 的养在池塘里 */
export interface Species {
  id: string;
  kind: string;
  name: string;
  sound: string;
  price: number;
  fish?: boolean;
}

/** 树种：买种子种下 */
export interface TreeKind {
  id: string;
  name: string;
  price: number;
}

/**
 * 商店里的一样东西。use：plant 种下、water 浇水、fert 施肥、place 摆进花园、furnish 摆进屋里、hoe / scythe / pickaxe / axe 工具、
 * lawn 把空地变回草地、mat 建材、feed 喂宠物、fishfood 喂鱼、toy 玩具、medicine 治病；
 * look 是人物装扮，pet 是宠物装扮（slot 是装扮的位置）
 */
export interface ShopItem {
  id: string;
  name: string;
  price: number;
  use?: string;
  plant?: [string, string];
  icon?: string;
  once?: boolean;
  gives?: number;
  into?: string;
  food?: number;
  mood?: number;
  decor?: string;
  slot?: string;
  look?: Look;
  pet?: { hat?: string; hue?: number };
  /** 在哪个货架上（ITEMS 里才有） */
  shelf?: string;
}

/** 货架：items 是 'TREES' 的由树种列表生成 */
export interface Shelf {
  id: string;
  name: string;
  items: ShopItem[] | 'TREES';
}

export interface PetsData {
  species: Species[];
  trees: TreeKind[];
  shop: Shelf[];
  /** 0.3 版宠物衣柜里有、新版没有的东西，按原价退回金币 */
  refund: Record<string, number>;
  /** 宠物说的话 */
  lines: Record<string, string[]>;
}
