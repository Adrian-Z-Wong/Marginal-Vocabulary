// app.js 交给小游戏用的接口：读写进度、加金币、换页面……
// 小游戏只通过这里碰主程序，主程序以后逐页换成 TypeScript 时，这些类型也能直接沿用。

export interface BookInfo {
  id: string;
  name: string;
}

/** 存档里小游戏自己的那一块（state.games） */
export interface ChaseRecord {
  t: number; // 时间戳
  book: string;
  level: number;
  wpm: number;
  acc: number;
  won: boolean;
}

export interface CustomPassage {
  id: string;
  title: string;
  text: string;
}

export interface GamesSave {
  chase: {
    level: number; // 上次选的难度
    book: string; // 上次选的词库（'__custom' 是自定义文章）
    best: Record<string, number>; // 难度 -> 最快的速度（抓到才算）
    history: ChaseRecord[]; // 最近的成绩
    day: number; // 今天是第几天（dayNum），跨天时清零下面两项
    coins: number; // 今天从打字游戏领到的金币
    seen: number[]; // 最近打过的文章，换文章时尽量不重复
  };
  custom: CustomPassage[];
}

export interface Host {
  /** 当前存档（导入备份后对象会换，所以每次都取） */
  state(): { games?: GamesSave; settings: { book: string; theme?: string } };
  save(): void;
  /** 加金币，会在页面上飘一个 +n */
  gain(n: number): void;
  toast(msg: string): void;
  /** 重新画整个页面 */
  render(): void;
  /** 换到某个页面 */
  go(view: string): void;
  esc(s: string): string;
  fmt(n: number): string;
  /** 所有词库（内置的和自己导入的） */
  books(): BookInfo[];
  /** 词库里的单词 / 术语 */
  bookWords(id: string): string[];
  /** 背诵正在用的词库 */
  studyBook(): string;
  /** 今天是第几天，和背诵的统计用同一套 */
  today(): number;
  /** 弹出确认框 */
  confirm(msg: string, ok: string): Promise<boolean>;
}

export interface PassageData {
  license: string;
  sources: Record<string, { name: string; url: string }>;
  passages: { src: string; sec: string; text: string }[];
  books: Record<string, number[]>;
}

declare global {
  interface Window {
    MARGIN_PASSAGES?: PassageData;
    MARGIN_GAMES?: unknown;
  }
}
