// 存档：默认设置、读写 localStorage

import { EXAM_WORDS, TERM_WORDS, WRONG_BOOK } from './books';
import { toast } from './dialogs';
import { Settings, State } from './types';

// ================= 存储 =================

export const STORE_KEY = 'margin.v1';
export const FIRST_BOOK = TERM_WORDS.fin.length ? 'fin' : EXAM_WORDS.length ? 'toefl' : WRONG_BOOK;
const DEFAULT_SETTINGS: Settings = {
  mode: 'en2zh',
  book: FIRST_BOOK,
  goal: 20, // 每天背多少新词
  size: 10, // 每组几个词
  order: 'new',
  accent: 'us',
  voice: 'auto',
  letterHint: true,
  copyWrong: true,
  weight: 'normal',
  theme: 'auto',
  rootBook: 'all', // 词根板块选的词库
  rootGoal: 10, // 每天学几个词根
  forceAll: false, // 强制全对：某一步有错，这一步整组重来，直到全对才进入下一步
  petRoam: true, // 宠物在页面上走动
  zoom: 0, // 花园画面放大几倍，0 是自动
};

export function freshState(): State {
  return {
    v: 1,
    settings: Object.assign({}, DEFAULT_SETTINGS),
    books: {},
    stats: {},
    wrong: {},
    srs: {},
    known: {},
    log: {},
    rootStats: {},
    rootWrong: {},
    rootLog: {},
    // 金币：bal 余额，earned 累计赚到，groups / perfects 累计完成 / 全对的组数，days 每天的明细，ach 已获得的成就
    points: { bal: 0, earned: 0, groups: 0, perfects: 0, days: {}, ach: {} },
    // 宠物：每只 { id, sp 品种, name, born, food 饱腹, mood 心情, day 算到哪天了, sick, sickSince, wear 装扮 }；
    // petMain 陪你背单词的那只；petGraves 去世的宠物；petWardrobe 买过的宠物装扮（每只都能戴）
    pets: [],
    petMain: 0,
    petSeq: 0,
    petGraves: [],
    petWardrobe: [],
    // 花园：land 扩建了几次；plants 树、花、草、灌木；decor 装饰；room 屋里的家具；bag 背包；
    //       look / owned 人物的装扮；hist 每周的花园快照（星期一 -> 统计和布局）；grown 一共种大了多少（t 树、f 花）
    world: { land: 0, week: 0, plants: [], decor: [], room: [], bag: {}, look: {}, owned: [], hist: {}, grown: { t: 0, f: 0 }, gift: 0, migrated: 0, v5: 0 },
  };
}

// saved 是 JSON.parse 读出来的，什么都可能有
export function normalizeState(saved: any): State {
  const s = freshState();
  if (!saved || typeof saved !== 'object') return s;
  for (const k of ['books', 'stats', 'wrong', 'srs', 'known', 'log', 'rootStats', 'rootWrong', 'rootLog'] as const) {
    if (saved[k] && typeof saved[k] === 'object') s[k] = saved[k];
  }
  Object.assign(s.settings, saved.settings || {});
  for (const k of ['points', 'world'] as const) if (saved[k] && typeof saved[k] === 'object') Object.assign(s[k], saved[k]);
  for (const k of ['pets', 'petGraves', 'petWardrobe'] as const) if (Array.isArray(saved[k])) s[k] = saved[k];
  for (const k of ['petMain', 'petSeq'] as const) if (typeof saved[k] === 'number') s[k] = saved[k];
  // 小游戏：成绩、自定义文章、今天领了多少金币
  if (saved.games && typeof saved.games === 'object') s.games = saved.games;
  // 旧版本的数据，迁移时用：0.3 的森林记录、0.3 / 0.4 的单只宠物和树种解锁
  if (saved.garden && typeof saved.garden === 'object') s.garden = saved.garden;
  if (saved.pet && typeof saved.pet === 'object') s.pet = saved.pet;
  if (saved.forest && typeof saved.forest === 'object') s.forest = saved.forest;
  return s;
}

export function loadState(): State {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORE_KEY) || 'null'));
  } catch (e) {
    return freshState();
  }
}

export let state = loadState();
export function setState(v: typeof state): void {
  state = v;
}
let saveFailed = false;

export function save(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (e) {
    if (!saveFailed) toast('进度没能保存（浏览器存储不可用或已满），请到「设置」里导出备份');
    saveFailed = true;
  }
}
