// 主程序里的数据类型：词条、存档、背诵和词根练习的一组、界面状态

import type { GamesSave } from '../games/host';

/** 词根词缀（tools/build_roots.py 生成） */
export interface Root {
  id: string;
  type: 'prefix' | 'root' | 'suffix';
  forms: string[];
  meaning: string;
  origin?: string;
  note?: string;
  /** 例词：单词、拆解、意思 */
  examples?: { w: string; parts: string; m: string }[];
}

/** 单词拆解里的一个词根：id、在词里的写法、从第几个字母开始 */
export interface RootLink {
  id: string;
  form: string;
  at: number;
}

/** 单词拆解：parts 是「a(到) + bandon(控制)」这样的文字 */
export interface Parts {
  w: string;
  parts: string;
  links: RootLink[];
}

/** 花园里用的工具（买一次一直有） */
export type Tool = 'hoe' | 'scythe' | 'pickaxe' | 'axe';

/** 每一步：英→中、中→英、听→写 */
export type Mode = 'en2zh' | 'zh2en' | 'listen';

/**
 * 一个词条：w 单词、p 音标、m 中文意思、x 拓展；考试词库还有 mask（属于哪些词库），专业词库有 s、t；
 * 错题本里的还有 n（错了几次）、t（第一次错的时间），复习的有 b（第几盒）、d（哪天复习）
 */
export interface Entry {
  w: string;
  p?: string;
  m?: string;
  x?: string;
  mask?: number;
  s?: string;
  t?: string | number;
  n?: number;
  b?: number;
  d?: number;
}

/** 考试词库里的词：mask 是它属于哪些标签 */
export interface ExamEntry extends Entry {
  mask: number;
}

/** 错题本里的词：n 错了几次、t 第一次错的时间 */
export interface WrongEntry extends Entry {
  n: number;
  t: number;
}

/** 间隔复习：b 第几盒、d 哪天复习 */
export interface SrsEntry extends Entry {
  b: number;
  d: number;
}

/** 标记为已掌握的词：t 什么时候标记的 */
export interface KnownEntry extends Entry {
  t: number;
}

/** 考试词库：bits 是 tools/build_words.py 里 TAGS 的位 */
export interface ExamBook {
  id: string;
  name: string;
  bits: number[];
}

/** 专业词库：key 是数据在 window 上的名字 */
export interface TermBook {
  id: string;
  name: string;
  key: 'MARGIN_FINANCE' | 'MARGIN_MACROFIN' | 'MARGIN_MEDICINE';
}

/** 自己导入的词表 */
export interface Book {
  id: string;
  name: string;
  words: Entry[];
  t: number;
}

export interface Settings {
  mode: string;
  book: string;
  goal: number;
  size: number;
  order: string;
  accent: string;
  voice: string;
  letterHint: boolean;
  copyWrong: boolean;
  weight: string;
  theme: string;
  rootBook: string;
  rootGoal: number;
  forceAll: boolean;
  petRoam: boolean;
  zoom: number;
  [key: string]: string | number | boolean;
}

/** 一个词的答题记录：f 第一次背的日子；每一步 [对, 错, 最后一次的时间] */
export interface Stat {
  f: number;
  en2zh?: number[];
  zh2en?: number[];
  listen?: number[];
}

/** 每天背了多少：n 答题数、r 答对数、rv 今天复习过的词 */
export interface LogDay {
  n: number;
  r: number;
  rv?: string[];
}

/** 词根的答题记录：r 对、w 错、f 第一次学的日子 */
export interface RootStat {
  r: number;
  w: number;
  f: number;
  d?: number;
}

/** 每天的金币明细：e 赚到、x 花掉、s 背单词得的；groups、perfect、roots、right、combo 是挑战用的计数；ch 领过奖励的挑战 */
export interface PointsDay {
  e: number;
  x: number;
  s: number;
  groups: number;
  perfect: number;
  roots: number;
  right: number;
  combo: number;
  ch: Record<string, number>;
  goalDone?: boolean;
  rootGoalDone?: boolean;
  feed?: number;
  water?: number;
  [key: string]: number | boolean | Record<string, number> | undefined;
}

/** 金币：bal 余额、earned 累计赚到、groups / perfects 累计完成 / 全对的组数、days 每天的明细、ach 已获得的成就 */
export interface Points {
  bal: number;
  earned: number;
  groups: number;
  perfects: number;
  days: Record<string, PointsDay>;
  ach: Record<string, string>;
}

/** 一只宠物：sp 品种、born 哪天来的、food 饱腹、mood 心情、day 算到哪天了、wear 装扮（slot → 商店里的 id） */
export interface Pet {
  id: number;
  sp: string;
  name: string;
  born: number;
  food: number;
  mood: number;
  day: number;
  sick: boolean;
  sickSince: number;
  wear: Record<string, string>;
}

/** 去世的宠物 */
export interface Grave {
  name: string;
  sp: string;
  born: number;
  died: number;
}

/**
 * 花园里的一株：k 种类（tree / flower / shrub / grass）、sp 品种、x、y 格子；
 * w 浇过水的日子、f 施了几次肥、fd 最后一次施肥的日子、b 迁移过来时已经长到的阶段；ok、min 是 0.3 的旧数据
 */
export interface Plant {
  k: string;
  sp: string;
  x: number;
  y: number;
  w?: number[];
  f?: number;
  fd?: number;
  b?: number;
  ok?: number | boolean;
  min?: number;
  /** 种下的日子 */
  t?: number;
}

/** 摆在花园或屋里的东西 */
export interface Placed {
  id: string;
  x: number;
  y: number;
}

/** 花园里要清理的杂物：k 种类、v 第几种样子、sp 野树的品种 */
export interface Debris {
  k: string;
  x: number;
  y: number;
  v?: number;
  sp?: string;
}

/** 一周的花园快照：t 大树、y 小树、f 花、s 灌木、g 草，p 植物，dc 装饰 */
export interface GardenSnap {
  t: number;
  y: number;
  f: number;
  s: number;
  g: number;
  w?: number;
  h?: number;
  p: (string | number)[][];
  dc: (string | number)[][];
}

/**
 * 花园：land 扩建了几次；plants 树、花、草、灌木；decor 装饰；room / room2 / room3 各层的家具；bag 背包；
 * look / owned 人物的装扮；hist 每周的花园快照；grown 一共种大了多少（t 树、f 花）；house 房子的等级；
 * debris 要清理的杂物；till 开垦过的格子；stam 体力
 */
export interface World {
  land: number;
  week: number;
  plants: Plant[];
  decor: Placed[];
  room: Placed[];
  room2?: Placed[];
  room3?: Placed[];
  bag: Record<string, number>;
  look: Record<string, string>;
  owned: string[];
  hist: Record<string, GardenSnap>;
  grown: { t: number; f: number };
  gift: number;
  migrated: number;
  v5: number;
  house?: number;
  /** 买过的工具（1 是有） */
  hoe?: number;
  scythe?: number;
  pickaxe?: number;
  axe?: number;
  layout?: number;
  debris?: Debris[];
  debrisDay?: number;
  till?: Record<string, number>;
  stam?: { v: number; day: number };
  rainDay?: number;
}

/** 整份存档 */
export interface State {
  v: number;
  settings: Settings;
  books: Record<string, Book>;
  stats: Record<string, Stat>;
  wrong: Record<string, WrongEntry>;
  srs: Record<string, SrsEntry>;
  known: Record<string, KnownEntry>;
  log: Record<string, LogDay>;
  rootStats: Record<string, RootStat>;
  rootWrong: Record<string, number>;
  rootLog: Record<string, { rv: string[] }>;
  points: Points;
  pets: Pet[];
  petMain: number;
  petSeq: number;
  petGraves: Grave[];
  petWardrobe: string[];
  world: World;
  games?: GamesSave;
  /** 旧版本的数据，迁移时用 */
  garden?: OldGarden;
  pet?: OldPet;
  forest?: OldForest;
}

/** 0.3 的森林记录：解锁过的树种 */
export interface OldForest {
  unlocked?: string[];
}

/** 0.3 / 0.4 的花园：日期 → 那天种的树 [品种, 种活没有] */
export type OldGarden = Record<string, unknown>;

/** 0.3 / 0.4 的单只宠物 */
export interface OldPet {
  status?: string;
  species: string;
  name?: string;
  born?: number;
  mood?: number;
  sick?: boolean;
  sickSince?: number;
  wear?: Record<string, string>;
  graves?: { name: string; species: string; born: number; died: number }[];
  owned?: string[];
  unlocked?: string[];
}

/** 一题的结果：answer 写的答案（英→中 多行时 lines 是每一行、marks 是每一行对不对） */
export interface Result {
  entry: Entry;
  answer: string;
  lines: string[] | null;
  marks: (boolean | null)[] | null;
  ok: boolean;
}

/** 背诵的一组：kind（new / review / wrong / retry）、words 这一组的词、stage 第几步、items 这一步的题、results 这一步的结果 */
export interface Session {
  kind: string;
  bookId: string | null;
  words: Entry[];
  stage: number;
  mode: Mode | null;
  items: Entry[];
  idx: number;
  results: Result[];
  stageResults: (Result[] | null)[];
  retries: { stage: number; results: Result[] }[];
  repeat: boolean;
  attempt: number;
  pending: Result | null;
  between: boolean;
  ended: boolean;
  finished?: boolean;
  animIdx?: number;
  animRow?: number;
  /** 连续答对几题 */
  combo?: number;
}

/** 词库里用到某个词根的一个词：tok 词组里的哪个词，fill 能做填空题时是那个词根 */
export interface RootUse {
  e: Entry;
  tok: string;
  p: Parts;
  fill: RootLink | null;
}

/** 词根练习的一个词根：words 用到它的词，target 填空题用的词 */
export interface RootItem {
  r: Root;
  words: RootUse[];
  target: RootUse | null;
}

/** 词根练习的一题：mode（r2m 看词根选意思、m2r 看意思选词根、fill 填空） */
export interface RootQ {
  r: Root;
  x: RootItem;
  mode: string;
  options?: string[];
  correct?: number;
}

/** 词根练习的一组 */
export interface RootSession {
  kind: string;
  book: string;
  roots: RootItem[];
  stage: number;
  mode: string | null;
  items: RootQ[];
  idx: number;
  pick: number | string | null;
  ok: boolean | null;
  results: { r: Root; ok: boolean }[];
  stageResults: ({ r: Root; ok: boolean }[] | null)[];
  retries: { stage: number; results: { r: Root; ok: boolean }[] }[];
  repeat: boolean;
  attempt: number;
  between: boolean;
  done: boolean;
  ended: boolean;
  combo?: number;
}

/** 检查更新的状态 */
export interface UpdateState {
  checking?: boolean;
  latest?: string;
  none?: boolean;
  url?: string;
  notes?: { v: string; items: string[] }[];
  show?: boolean;
  open?: boolean;
  error?: string;
  installing?: boolean;
  installed?: boolean;
  hidden?: boolean;
}

/** 界面状态（不存档） */
export interface UI {
  view: string;
  session: Session | null;
  book: { id: string | null; q: string; limit: number };
  draft: { target: string | null; name: string; text: string } | null;
  roots: { q: string; type: string; id: string | null; limit: number; wordLimit: number };
  rs: RootSession | null;
  tool?: string | null;
  petGone?: string[] | null;
  shopTab?: string;
  shelf?: string;
  petKind?: string;
  petPick?: string | null;
  wardPet?: number | null;
  bagOpen?: boolean;
  bagPick?: string | null;
  floor?: number;
  arrive?: number[] | null;
  forceWeather?: string;
  forceMinute?: number;
  update?: UpdateState;
}
