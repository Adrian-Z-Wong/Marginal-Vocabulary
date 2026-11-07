// 打字追击：选词库和难度 → 打字追小偷 → 成绩。
// 打对一个字母，警车就往前开一点（字母不分大小写，空格和标点要打对）；打错不会卡住，但这一下不前进，还会打滑退一点。
// 连续打对 12 个字母，警车加速冲一段。小偷按难度跑，速度时快时慢；追上就抓到了，小偷先跑进仓库就跑掉了。
// 地图是俯视的城市，每局随机一条拐来拐去的路线。

import type { GamesSave, Host } from '../host';
import { clock, TypingRun } from '../typing';
import { CUSTOM_BOOK, Passage, bookPassages, customPassages, normalizeText, passageByKey, pickPassage, splitPassages } from '../passages';
import { ChaseScene, SceneState } from './scene';
import { City, timeOfDay } from './city';
import { blit, policeSprite, shadow, thiefSprite } from './sprites';

export const LEVELS = [
  { name: '慢', wpm: 20, coins: 10 },
  { name: '中', wpm: 35, coins: 20 },
  { name: '快', wpm: 50, coins: 30 },
  { name: '极速', wpm: 70, coins: 45 },
];
/** 每天从打字游戏最多领多少金币 */
export const DAILY_COINS = 150;
/** 开局小偷领先全程的多少 */
const HEAD = 0.14;
/** 连续打对几个字母加速一次，加速相当于多打了几个字母 */
const COMBO_EVERY = 12;
const BOOST_CHARS = 4;
/** 打错一次，警车打滑退回几个字母的距离 */
const SKID_CHARS = 1.5;
/** 一个字母对应路线上多少像素（文章越长路线越长） */
const PX_PER_CHAR = 7;

type Route = 'setup' | 'play';

interface Play {
  passage: Passage;
  run: TypingRun;
  level: number;
  book: string;
  phase: SceneState['phase'];
  runAt: number; // 开跑的时刻（第一下按键）
  pausedAt: number;
  pausedTotal: number;
  endAt: number;
  thief: number; // 小偷的进度 0–1
  thiefT: number; // 小偷跑了多少秒（算时快时慢用）
  bonus: number; // 加速、打滑带来的额外距离（字母数）
  reward: number;
  capped: boolean;
  newBest: boolean;
  pop: { text: string; at: number } | null; // 「连击」「加速」的提示
}

export class ChaseGame {
  private readonly host: Host;
  route: Route = 'setup';
  private play: Play | null = null;
  private preview: Passage | null = null;
  private scene: ChaseScene;
  private tick = 0;
  private lastStep = 0;
  private spans: HTMLElement[] = [];
  private shownPos = -1;
  private keyHandler = (ev: KeyboardEvent) => this.onKey(ev);

  constructor(host: Host) {
    this.host = host;
    this.scene = new ChaseScene(() => this.sceneState(), new City(1, 600, timeOfDay()));
    document.addEventListener('keydown', this.keyHandler, true);
  }

  // ---------------- 存档 ----------------

  save(): GamesSave['chase'] {
    const st = this.host.state();
    if (!st.games) st.games = { chase: { level: 1, book: '', best: {}, history: [], day: 0, coins: 0, seen: [] }, custom: [] };
    const g = st.games;
    if (!g.custom) g.custom = [];
    const c = g.chase;
    const today = this.host.today();
    if (c.day !== today) {
      c.day = today;
      c.coins = 0;
    }
    return c;
  }

  private bookId(): string {
    const c = this.save();
    const ok = (id: string) => id === CUSTOM_BOOK || this.host.books().some((b) => b.id === id);
    if (c.book && ok(c.book)) return c.book;
    const sb = this.host.studyBook();
    return ok(sb) ? sb : this.host.books()[0]?.id || CUSTOM_BOOK;
  }

  // ---------------- 页面 ----------------

  view(): string {
    return this.route === 'play' && this.play ? this.playHtml() : this.setupHtml();
  }

  after(): void {
    if (this.route === 'play' && this.play) {
      const canvas = document.getElementById('chase-canvas') as HTMLCanvasElement | null;
      const wrap = document.getElementById('chase-wrap');
      if (canvas && wrap) this.scene.attach(canvas, wrap);
      this.spans = Array.from(document.querySelectorAll<HTMLElement>('#chase-text span'));
      this.shownPos = -1;
      this.lastOverlay = '';
      this.paintText();
      this.paintHud(performance.now());
      if (this.play.phase === 'won' || this.play.phase === 'lost') this.paintResult();
      this.startTick();
    } else {
      this.scene.detach();
      this.stopTick();
    }
  }

  /** 离开这个页面（换到别的页面时调用） */
  leave(): void {
    this.scene.detach();
    this.stopTick();
    if (this.play && (this.play.phase === 'run' || this.play.phase === 'ready' || this.play.phase === 'paused')) this.play = null;
    this.route = 'setup';
  }

  private setupHtml(): string {
    const h = this.host;
    const c = this.save();
    const book = this.bookId();
    if (!this.preview || (book === CUSTOM_BOOK) !== this.preview.key.startsWith('c:') || !this.previewFits(book)) this.preview = pickPassage(h, book, c.seen);
    const opts = h.books().filter((b) => bookPassages(h, b.id).length).map((b) => '<option value="' + h.esc(b.id) + '"' + (b.id === book ? ' selected' : '') + '>' + h.esc(b.name) + '</option>');
    opts.push('<option value="' + CUSTOM_BOOK + '"' + (book === CUSTOM_BOOK ? ' selected' : '') + '>自定义文章</option>');
    const left = Math.max(0, DAILY_COINS - c.coins);
    const levels = LEVELS.map((L, i) => '<button class="chip' + (i === c.level ? ' on' : '') + '" data-game="level" data-i="' + i + '">' + L.name + '<span class="lv-wpm">' + L.wpm + '</span></button>').join('');
    const best = LEVELS.map((L, i) => (c.best[i] ? '<span>' + L.name + ' <b>' + Math.round(c.best[i]) + '</b></span>' : '')).filter(Boolean).join('');
    const pv = this.preview;
    const custom = book === CUSTOM_BOOK ? this.customHtml() : '';
    return (
      '<main class="page games">' +
      '<p class="label"><button class="link" data-act="nav" data-view="games">← 小游戏</button></p>' +
      '<div class="g-head"><h1 class="h1">打字追击</h1></div>' +
      '<section class="panel chase-setup">' +
      '<div class="cs-row"><span class="label">词库</span><label class="select"><select id="chase-book" data-game="book">' + opts.join('') + '</select></label></div>' +
      '<div class="cs-row"><span class="label">小偷的速度</span><div class="chips">' + levels + '</div><span class="muted small">词 / 分钟</span></div>' +
      (pv
        ? '<div class="cs-preview"><p class="cs-text">' + h.esc(pv.text) + '</p><div class="cs-meta"><span class="muted small">' + h.esc(pv.source) + ' · ' + (pv.text.match(/\S+/g) || []).length + ' 词</span><button class="link" data-game="shuffle">换一篇</button></div></div>'
        : '<p class="muted cs-empty">' + (book === CUSTOM_BOOK ? '还没有自定义文章，在下面贴一段英文' : '这个词库还没有文章') + '</p>') +
      '<div class="actions cs-go"><button class="btn big" data-game="start"' + (pv ? '' : ' disabled') + '>开始<kbd>Enter</kbd></button>' +
      '<span class="muted small">抓到小偷 +' + LEVELS[c.level].coins + ' 金币 · 今天还能领 ' + left + '</span></div>' +
      (best ? '<div class="cs-best"><span class="label">最快</span>' + best + '<span class="muted small">词 / 分钟</span></div>' : '') +
      '</section>' +
      custom +
      '</main>'
    );
  }

  private previewFits(book: string): boolean {
    const pv = this.preview;
    if (!pv) return false;
    if (book === CUSTOM_BOOK) return customPassages(this.host).some((c) => 'c:' + c.id === pv.key);
    return pv.key.startsWith('b:') && bookPassages(this.host, book).includes(+pv.key.slice(2));
  }

  private customHtml(): string {
    const h = this.host;
    const list = customPassages(h);
    return (
      '<section class="panel chase-custom">' +
      '<h2 class="h2">自定义文章</h2>' +
      '<textarea class="paste" id="chase-paste" rows="5" placeholder="贴一段英文，长文章会按句子切成几段"></textarea>' +
      '<div class="actions"><button class="btn small" data-game="addCustom">保存</button><label class="file-pick link">或者选一个 .txt 文件<input type="file" id="chase-file" accept=".txt,text/plain"></label></div>' +
      (list.length
        ? '<ul class="cc-list">' + list.map((c) => '<li><span class="cc-t">' + h.esc(c.title) + '</span><span class="muted small">' + (c.text.match(/\S+/g) || []).length + ' 词</span><button class="link" data-game="delCustom" data-id="' + h.esc(c.id) + '" aria-label="删除">删除</button></li>').join('') + '</ul>'
        : '') +
      '</section>'
    );
  }

  private playHtml(): string {
    const h = this.host;
    const p = this.play as Play;
    const L = LEVELS[p.level];
    const chars = Array.from(p.passage.text)
      .map((ch) => '<span>' + (ch === ' ' ? ' ' : h.esc(ch)) + '</span>')
      .join('');
    const bookName = p.book === CUSTOM_BOOK ? '自定义文章' : h.books().find((b) => b.id === p.book)?.name || '';
    return (
      '<main class="page games play">' +
      '<div class="cp-top"><div><h1 class="h1">打字追击</h1><p class="muted">' + h.esc(bookName) + ' · 小偷 ' + L.name + '（' + L.wpm + ' 词 / 分钟）</p></div>' +
      '<div class="actions"><button class="btn ghost small" data-game="pause">暂停<kbd>Esc</kbd></button><button class="btn ghost small" data-game="quit">不追了</button></div></div>' +
      '<div class="chase-wrap" id="chase-wrap"><canvas id="chase-canvas" class="chase-canvas"></canvas><div class="cp-pop" id="chase-pop"></div><div class="cp-overlay" id="chase-overlay"></div></div>' +
      '<div class="cp-stats"><div><b id="st-wpm">0</b><span>词 / 分钟</span></div><div><b id="st-acc">100%</b><span>正确率</span></div><div><b id="st-combo">0</b><span>连击</span></div><div><b id="st-gap">0</b><span>米 · 离小偷</span></div></div>' +
      '<div class="cp-textbox" id="chase-box"><div class="cp-scroll" id="chase-scroll"><p class="cp-text" id="chase-text">' + chars + '</p></div></div>' +
      '<p class="cp-source muted small">' + h.esc(p.passage.source) + '</p>' +
      '</main>'
    );
  }

  // ---------------- 开局、进行 ----------------

  start(passage?: Passage | null): void {
    const c = this.save();
    const book = this.bookId();
    const ps = passage || this.preview || pickPassage(this.host, book, c.seen);
    if (!ps) return;
    if (ps.key.startsWith('b:')) {
      const n = +ps.key.slice(2);
      c.seen = [n].concat(c.seen.filter((x) => x !== n)).slice(0, 40);
    }
    this.host.save();
    this.preview = null;
    this.play = {
      passage: ps,
      run: new TypingRun(ps.text),
      level: c.level,
      book,
      phase: 'ready',
      runAt: 0,
      pausedAt: 0,
      pausedTotal: 0,
      endAt: 0,
      thief: HEAD,
      thiefT: 0,
      bonus: 0,
      reward: 0,
      capped: false,
      newBest: false,
      pop: null,
    };
    // 每局一张新地图：路线长短跟着文章长短
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    this.scene.reset(new City(seed, Math.max(900, ps.text.length * PX_PER_CHAR), timeOfDay()));
    this.route = 'play';
    this.host.render();
  }

  /** 警车的进度：打对的字母 + 加速、打滑 */
  private policeProgress(p: Play): number {
    const n = p.passage.text.length;
    return Math.max(0, Math.min(1, (p.run.pos + p.bonus) / n));
  }

  private sceneState(): SceneState {
    const p = this.play;
    if (!p) return { police: 0, thief: HEAD, phase: 'ready', endAt: 0 };
    return { police: this.policeProgress(p), thief: p.thief, phase: p.phase, endAt: p.endAt };
  }

  private startTick(): void {
    this.stopTick();
    this.lastStep = performance.now();
    const loop = () => {
      if (!document.getElementById('chase-text')) {
        this.stopTick();
        return;
      }
      this.step(performance.now());
      this.tick = requestAnimationFrame(loop);
    };
    this.tick = requestAnimationFrame(loop);
  }

  private stopTick(): void {
    cancelAnimationFrame(this.tick);
    this.tick = 0;
  }

  private step(now: number): void {
    const p = this.play;
    if (!p) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastStep) / 1000));
    this.lastStep = now;
    if (p.phase === 'run') {
      // 小偷的速度时快时慢，平均正好是这一档的速度
      p.thiefT += dt;
      const t = p.thiefT;
      const vary = 1 + 0.16 * Math.sin(t * 0.8) + 0.07 * Math.sin(t * 2.1 + 1.3);
      const cps = (LEVELS[p.level].wpm * 5) / 60;
      p.thief = Math.min(1, p.thief + (cps * vary * dt) / p.passage.text.length);
      if (this.policeProgress(p) >= p.thief) this.finish(true, now);
      else if (p.thief >= 1) this.finish(false, now);
    }
    this.paintHud(now);
  }

  private finish(won: boolean, now: number): void {
    const p = this.play;
    if (!p || p.phase === 'won' || p.phase === 'lost') return;
    p.phase = won ? 'won' : 'lost';
    p.endAt = now;
    p.run.pause(now);
    const c = this.save();
    const wpm = p.run.wpm(now);
    const acc = p.run.accuracy();
    if (won) {
      const can = Math.max(0, DAILY_COINS - c.coins);
      p.reward = Math.min(LEVELS[p.level].coins, can);
      p.capped = p.reward < LEVELS[p.level].coins;
      c.coins += p.reward;
      const prev = c.best[p.level] || 0;
      if (wpm > prev) {
        p.newBest = prev > 0;
        c.best[p.level] = Math.round(wpm * 10) / 10;
      }
      if (p.reward) this.host.gain(p.reward);
    }
    c.history = [{ t: Date.now(), book: p.book, level: p.level, wpm: Math.round(wpm * 10) / 10, acc: Math.round(acc * 1000) / 1000, won }].concat(c.history).slice(0, 30);
    this.host.save();
    setTimeout(() => this.paintResult(), won ? 900 : 1300);
  }

  private pause(now: number): void {
    const p = this.play;
    if (!p || p.phase !== 'run') return;
    p.phase = 'paused';
    p.pausedAt = now;
    p.run.pause(now);
    this.paintOverlay();
  }

  private resume(now: number): void {
    const p = this.play;
    if (!p || p.phase !== 'paused') return;
    p.pausedTotal += now - p.pausedAt;
    p.pausedAt = 0;
    p.run.resume(now);
    p.phase = 'run';
    this.lastStep = now;
    this.paintOverlay();
  }

  // ---------------- 键盘 ----------------

  private onKey(ev: KeyboardEvent): void {
    if (document.querySelector('.modal')) return;
    const view = document.querySelector('main.games');
    if (!view) return;
    const tag = (ev.target as HTMLElement | null)?.tagName || '';
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const now = performance.now();
    if (this.route === 'setup' || !this.play) {
      if (!inField && ev.key === 'Enter' && document.querySelector('[data-game="start"]:not([disabled])')) {
        ev.preventDefault();
        this.start();
      }
      return;
    }
    const p = this.play;
    if (inField) return;
    if (ev.isComposing || ev.keyCode === 229 || ev.key === 'Process') {
      this.flash('请切换到英文输入法');
      return;
    }
    // 游戏里的按键不要让页面滚动（空格）或者触发浏览器的快捷查找（引号）
    if (ev.key.length === 1 || ev.key === 'Backspace') ev.preventDefault();
    if (p.phase === 'won' || p.phase === 'lost') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.next();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this.toSetup();
      }
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (p.phase === 'paused') this.resume(now);
      else this.pause(now);
      return;
    }
    if (p.phase === 'paused') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.resume(now);
      }
      return;
    }
    if (ev.key === 'Backspace') {
      ev.preventDefault();
      if (p.run.backspace()) this.paintText();
      return;
    }
    if (ev.key.length !== 1) return;
    ev.preventDefault();
    // 第一下按键：小偷开跑，开始计时
    if (p.phase === 'ready') {
      p.phase = 'run';
      p.runAt = now;
      p.run.start(now);
      this.lastStep = now;
      this.paintOverlay();
    }
    const r = p.run.type(ev.key);
    if (r === 'wrong') {
      p.bonus = Math.max(-p.run.pos, p.bonus - SKID_CHARS);
      this.scene.skid();
      this.nudge();
    } else if ((r === 'ok' || r === 'done') && p.run.combo > 0 && p.run.combo % COMBO_EVERY === 0) {
      p.bonus += BOOST_CHARS;
      this.scene.boost(now);
      this.popup('连击 ' + p.run.combo + ' · 加速');
    }
    this.paintText();
    this.step(now);
  }

  // ---------------- 画 DOM ----------------

  private paintText(): void {
    const p = this.play;
    if (!p || !this.spans.length) return;
    const pos = p.run.pos;
    const first = this.shownPos < 0;
    const from = first ? 0 : Math.max(0, Math.min(this.shownPos, pos) - 1);
    const to = first ? this.spans.length : Math.min(this.spans.length, Math.max(pos, this.shownPos) + 2);
    for (let i = from; i < to; i++) {
      this.spans[i].className = i < pos ? (p.run.missed[i] ? 'ok was' : 'ok') : i === pos ? (p.run.wrong !== null ? 'cur err' : 'cur') : '';
    }
    this.shownPos = pos;
    const cur = this.spans[Math.min(pos, this.spans.length - 1)];
    const box = document.getElementById('chase-scroll');
    if (cur && box) {
      // 当前行放在第二行；第一行打完才往上滚
      const line = cur.offsetHeight || 40;
      const top = Math.max(0, cur.offsetTop - line);
      if (Math.abs(box.scrollTop - top) > 2) box.scrollTo({ top, behavior: 'smooth' });
    }
  }

  private paintHud(now: number): void {
    const p = this.play;
    if (!p) return;
    const set = (id: string, v: string) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== v) el.textContent = v;
    };
    set('st-wpm', String(Math.round(p.run.wpm(now))));
    set('st-acc', Math.round(p.run.accuracy() * 100) + '%');
    set('st-combo', String(p.run.combo));
    set('st-gap', String(Math.max(0, Math.round((p.thief - this.policeProgress(p)) * 1000))));
    this.paintOverlay(now);
  }

  private lastOverlay = '';

  private paintOverlay(now = performance.now()): void {
    const p = this.play;
    const el = document.getElementById('chase-overlay');
    if (!p || !el) return;
    let html = '';
    if (p.phase === 'ready') {
      html = '<div class="ov-ready"><b>开始打字，就开始追</b><span>字母不分大小写 · 打错了不前进</span></div>';
    } else if (p.phase === 'paused') {
      html = '<div class="ov-card"><b>暂停</b><div class="actions"><button class="btn" data-game="resume">继续<kbd>Esc</kbd></button><button class="btn ghost" data-game="quit">不追了</button></div></div>';
    } else if (p.phase === 'won' || p.phase === 'lost') {
      html = this.lastOverlay.startsWith('<div class="ov-card result') ? this.lastOverlay : '';
    }
    if (html !== this.lastOverlay) {
      el.innerHTML = html;
      this.lastOverlay = html;
    }
    // 连击提示一会儿就消失
    const pop = document.getElementById('chase-pop');
    if (pop && p.pop && now - p.pop.at > 1100) {
      p.pop = null;
      pop.classList.remove('show');
    }
  }

  private popup(text: string): void {
    const p = this.play;
    const pop = document.getElementById('chase-pop');
    if (!p || !pop) return;
    p.pop = { text, at: performance.now() };
    pop.textContent = text;
    pop.classList.remove('show');
    void pop.offsetWidth;
    pop.classList.add('show');
  }

  private paintResult(): void {
    const p = this.play;
    const el = document.getElementById('chase-overlay');
    if (!p || !el || (p.phase !== 'won' && p.phase !== 'lost')) return;
    const h = this.host;
    const now = p.endAt;
    const wpm = Math.round(p.run.wpm(now));
    const acc = Math.round(p.run.accuracy() * 100);
    const missedWords = wordsWithMisses(p.run);
    const title = p.phase === 'won' ? (p.newBest ? '抓到了 · 新纪录' : '抓到了') : '让他跑了';
    const sub =
      p.phase === 'won'
        ? p.reward
          ? '+' + p.reward + ' 金币' + (p.capped ? '（今天的领满了）' : '')
          : '今天打字游戏的金币领满了'
        : '还差 ' + Math.max(1, Math.round((1 - p.run.progress()) * (p.passage.text.match(/\S+/g) || []).length)) + ' 个词';
    const html =
      '<div class="ov-card result ' + p.phase + '">' +
      '<div class="ov-main"><div class="ov-title"><b>' + title + '</b><span class="ov-sub">' + h.esc(sub) + '</span></div>' +
      '<div class="ov-stats"><div><b>' + wpm + '</b><span>词 / 分钟</span></div><div><b>' + acc + '%</b><span>正确率</span></div><div><b>' + p.run.bestCombo + '</b><span>最长连击</span></div><div><b>' + clock(p.run.elapsed(now)) + '</b><span>用时</span></div></div>' +
      '<div class="ov-acts"><button class="btn" data-game="next">再来一篇<kbd>Enter</kbd></button><button class="btn ghost" data-game="setup">换难度<kbd>Esc</kbd></button></div></div>' +
      (missedWords.length ? '<p class="ov-miss"><span class="muted small">打错过</span> ' + missedWords.map((w) => '<span class="mw">' + h.esc(w) + '</span>').join(' ') + '</p>' : '') +
      '</div>';
    el.innerHTML = html;
    this.lastOverlay = html;
  }

  private nudge(): void {
    const box = document.getElementById('chase-box');
    if (!box) return;
    box.classList.remove('nudge');
    void box.offsetWidth;
    box.classList.add('nudge');
  }

  private flashTimer = 0;

  private flash(msg: string): void {
    const box = document.getElementById('chase-box');
    if (!box) return;
    let tip = box.querySelector('.cp-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'cp-tip';
      box.appendChild(tip);
    }
    tip.textContent = msg;
    clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => tip && tip.remove(), 2200);
  }

  // ---------------- 按钮 ----------------

  next(): void {
    const p = this.play;
    if (!p) return;
    const c = this.save();
    this.start(pickPassage(this.host, p.book, c.seen, p.passage.key));
  }

  toSetup(): void {
    this.play = null;
    this.route = 'setup';
    this.host.render();
  }

  async action(name: string, el: HTMLElement): Promise<void> {
    const c = this.save();
    const now = performance.now();
    if (name === 'level') {
      c.level = Math.max(0, Math.min(LEVELS.length - 1, +(el.dataset.i || 0)));
      this.host.save();
      this.host.render();
    } else if (name === 'shuffle') {
      this.preview = pickPassage(this.host, this.bookId(), c.seen, this.preview ? this.preview.key : undefined);
      this.host.render();
    } else if (name === 'start') {
      this.start();
    } else if (name === 'pause') {
      if (this.play && this.play.phase === 'paused') this.resume(now);
      else this.pause(now);
    } else if (name === 'resume') {
      this.resume(now);
    } else if (name === 'quit') {
      const p = this.play;
      if (p && p.phase === 'run' && p.run.pos > 0) {
        this.pause(now);
        if (!(await this.host.confirm('这局不追了？', '不追了'))) {
          this.resume(performance.now());
          return;
        }
      }
      this.toSetup();
    } else if (name === 'next') {
      this.next();
    } else if (name === 'setup') {
      this.toSetup();
    } else if (name === 'addCustom') {
      const ta = document.getElementById('chase-paste') as HTMLTextAreaElement | null;
      if (ta) this.addCustom(ta.value);
    } else if (name === 'delCustom') {
      const g = this.host.state().games;
      if (!g) return;
      g.custom = g.custom.filter((x) => x.id !== el.dataset.id);
      this.host.save();
      this.host.render();
    }
  }

  change(name: string, el: HTMLInputElement | HTMLSelectElement): void {
    if (name === 'book') {
      const c = this.save();
      c.book = el.value;
      this.preview = null;
      this.host.save();
      this.host.render();
    }
  }

  async file(input: HTMLInputElement): Promise<void> {
    const f = input.files && input.files[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      this.host.toast('文件太大了');
      return;
    }
    this.addCustom(await f.text());
  }

  private addCustom(raw: string): void {
    const text = normalizeText(raw);
    const parts = splitPassages(text).filter((t) => (t.match(/[A-Za-z]+/g) || []).length >= 8);
    if (!parts.length) {
      this.host.toast('没有找到英文段落');
      return;
    }
    const g = this.host.state().games;
    if (!g) return;
    const room = 200 - g.custom.length;
    if (room <= 0) {
      this.host.toast('自定义文章最多 200 段，先删掉一些');
      return;
    }
    const added = parts.slice(0, room).map((t, i) => ({
      id: Date.now().toString(36) + i.toString(36),
      title: (t.match(/\S+/g) || []).slice(0, 7).join(' ') + '…',
      text: t,
    }));
    g.custom = added.concat(g.custom);
    const c = this.save();
    c.book = CUSTOM_BOOK;
    this.preview = { key: 'c:' + added[0].id, text: added[0].text, source: '自定义 · ' + added[0].title };
    this.host.save();
    this.host.toast('加了 ' + added.length + ' 段');
    this.host.render();
  }

  passage(key: string): Passage | null {
    return passageByKey(this.host, key);
  }

  /** 测试用：当前这局 */
  debug(): unknown {
    const p = this.play;
    return p
      ? { phase: p.phase, pos: p.run.pos, len: p.passage.text.length, thief: p.thief, police: this.policeProgress(p), wrong: p.run.wrong, text: p.passage.text, reward: p.reward, keys: p.run.keys, hits: p.run.hits, combo: p.run.combo, bonus: p.bonus }
      : null;
  }
}

/** 打错过的词（成绩里列出来） */
function wordsWithMisses(run: TypingRun): string[] {
  const out: string[] = [];
  const re = /[A-Za-z][A-Za-z'-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(run.text))) {
    for (let i = m.index; i < m.index + m[0].length; i++) {
      if (run.missed[i]) {
        const w = m[0].replace(/'s$/, '');
        if (!out.includes(w)) out.push(w);
        break;
      }
    }
  }
  return out.slice(0, 12);
}

// ---------------- 小游戏首页的封面 ----------------

let cover = '';

/** 封面：傍晚的城市一角，警车在路口追小偷 */
export function coverImage(): string {
  if (cover) return cover;
  const city = new City(7, 700, 'dusk');
  const W = 140;
  const H = 63;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return '';
  c.imageSmoothingEnabled = false;
  const a = city.at(120);
  const b = city.at(165);
  const ox = Math.round(Math.max(0, Math.min(city.width - W, (a.x + b.x) / 2 - W / 2)));
  const oy = Math.round(Math.max(0, Math.min(city.height - H, (a.y + b.y) / 2 - H / 2)));
  c.drawImage(city.map, ox, oy, W, H, 0, 0, W, H);
  shadow(c, b.x - ox, b.y - oy, 5, 3);
  blit(c, thiefSprite(1), b.x - ox, b.y - oy, b.angle);
  shadow(c, a.x - ox, a.y - oy, 11, 5);
  blit(c, policeSprite(0), a.x - ox, a.y - oy, a.angle);
  const g = c.createRadialGradient(a.x - ox, a.y - oy, 0, a.x - ox, a.y - oy, 24);
  g.addColorStop(0, 'rgba(255,70,60,.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(a.x - ox - 24, a.y - oy - 24, 48, 48);
  cover = cv.toDataURL();
  return cover;
}
