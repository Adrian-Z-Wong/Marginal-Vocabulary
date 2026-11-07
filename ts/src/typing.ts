// 打字的核心：光标走到哪、哪个字打错了、速度和正确率。
// 规则：打错的字母标红，必须按退格改掉才能接着打；打对的字不能再退回去。

export type KeyResult = 'ok' | 'wrong' | 'blocked' | 'done' | 'ignored';

export class TypingRun {
  readonly text: string;
  /** 已经打对的字符数 */
  pos = 0;
  /** 光标处打错的那个字（还没退格改掉时） */
  wrong: string | null = null;
  /** 按过的字符键总数（不算退格） */
  keys = 0;
  /** 打对的按键数 */
  hits = 0;
  /** 打错的次数（同一个位置错几次算几次） */
  misses = 0;
  /** 每个位置是不是错过（显示成绩时标出来） */
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
    if (this.wrong !== null) {
      // 还有错字没改：再按字母不算数
      this.keys++;
      return 'blocked';
    }
    this.keys++;
    if (ch === this.text[this.pos]) {
      this.hits++;
      this.pos++;
      return this.done ? 'done' : 'ok';
    }
    this.misses++;
    this.missed[this.pos] = 1;
    this.wrong = ch;
    return 'wrong';
  }

  backspace(): boolean {
    if (this.wrong === null) return false;
    this.wrong = null;
    return true;
  }

  /** 速度：每分钟打对多少个词（按 5 个字符一个词算，国际通行的算法） */
  wpm(now: number): number {
    const s = this.elapsed(now);
    if (s < 1) return 0;
    return (this.pos / 5) / (s / 60);
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
