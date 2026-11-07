// 打字的核心：光标走到哪、打错了几次、速度和正确率。
// 规则：字母不分大小写；空格和标点要打对。打错不会卡住，只是这一下不往前走，
// 打对的下一个字照常往前；打错的那个位置会记下来，成绩里列出来。

export type KeyResult = 'ok' | 'wrong' | 'done' | 'ignored';

/** 两个字符算不算打对：字母不分大小写，其他（空格、标点、数字）要一样 */
export function sameChar(typed: string, want: string): boolean {
  if (typed === want) return true;
  return /[A-Za-z]/.test(want) && typed.toLowerCase() === want.toLowerCase();
}

export class TypingRun {
  readonly text: string;
  /** 已经打对的字符数 */
  pos = 0;
  /** 刚刚打错的字（下一个字打对就清掉，用来把当前位置标红） */
  wrong: string | null = null;
  /** 按过的字符键总数 */
  keys = 0;
  /** 打对的按键数 */
  hits = 0;
  /** 打错的次数 */
  misses = 0;
  /** 连续打对了几个字 */
  combo = 0;
  /** 这一局最长的连击 */
  bestCombo = 0;
  /** 每个位置是不是打错过（成绩里标出来） */
  readonly missed: Uint8Array;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;

  constructor(text: string) {
    this.text = text;
    this.missed = new Uint8Array(text.length);
  }

  get done(): boolean {
    return this.pos >= this.text.length;
  }

  get started(): boolean {
    return this.startedAt > 0;
  }

  start(now: number): void {
    if (!this.startedAt) this.startedAt = now;
  }

  pause(now: number): void {
    if (this.startedAt && !this.pausedAt) this.pausedAt = now;
  }

  resume(now: number): void {
    if (this.pausedAt) {
      this.pausedTotal += now - this.pausedAt;
      this.pausedAt = 0;
    }
  }

  /** 从开始到现在打了多少秒（暂停的时间不算） */
  elapsed(now: number): number {
    if (!this.startedAt) return 0;
    const end = this.pausedAt || now;
    return Math.max(0, (end - this.startedAt - this.pausedTotal) / 1000);
  }

  /** 进度 0–1 */
  progress(): number {
    return this.text.length ? this.pos / this.text.length : 1;
  }

  type(ch: string): KeyResult {
    if (this.done) return 'done';
    if (ch.length !== 1) return 'ignored';
    this.keys++;
    if (sameChar(ch, this.text[this.pos])) {
      this.hits++;
      this.pos++;
      this.wrong = null;
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      return this.done ? 'done' : 'ok';
    }
    this.misses++;
    this.missed[this.pos] = 1;
    this.wrong = ch;
    this.combo = 0;
    return 'wrong';
  }

  /** 退格：把标红去掉（打对的字不会退回去） */
  backspace(): boolean {
    if (this.wrong === null) return false;
    this.wrong = null;
    return true;
  }

  /** 速度：每分钟打对多少个词（按 5 个字符一个词算，国际通行的算法） */
  wpm(now: number): number {
    const s = this.elapsed(now);
    if (s < 1) return 0;
    return this.pos / 5 / (s / 60);
  }

  /** 正确率：打对的按键 / 全部按键 */
  accuracy(): number {
    return this.keys ? this.hits / this.keys : 1;
  }
}

/** 05:07 这样的用时 */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
