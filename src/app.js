/* Marginal Vocabulary —— 背单词 */
(function () {
  'use strict';

  // ================= 词库定义 =================

  // bit 对应 tools/build_words.py 里 TAGS 的顺序
  // bits：这个词库包含哪些标签的词。四六级、考研按大纲是累加的：
  // CET-4 包含高考词汇，CET-6、GEE（考研）包含 CET-4 词汇，宁多勿少
  const EXAM_BOOKS = [
    { id: 'cet4', name: 'CET-4', bits: [2, 1] },
    { id: 'cet6', name: 'CET-6', bits: [3, 2, 1] },
    { id: 'ky', name: 'GEE', bits: [4, 2, 1] }, // 考研，Graduate Entrance Examination
    { id: 'toefl', name: 'TOEFL', bits: [6] },
    { id: 'ielts', name: 'IELTS', bits: [5] },
    { id: 'gre', name: 'GRE', bits: [7] },
    { id: 'gmat', name: 'GMAT', bits: [8] },
  ];

  // 专业词库，由 tools/build_terms.py 根据 data/<目录>/*.tsv 生成
  // Finance：经济、金融、会计、管理、公司治理、资本市场等；Medicine：西医、中医、中药、经络穴位等
  // MacroFin：高级宏微观、宏观金融、DSGE、货币政策、财政政策、宏观调控、计量方法
  const TERM_BOOKS = [
    { id: 'fin', name: 'Finance', key: 'MARGIN_FINANCE' },
    { id: 'mf', name: 'MacroFin', key: 'MARGIN_MACROFIN' },
    { id: 'med', name: 'Medicine', key: 'MARGIN_MEDICINE' },
  ];

  const BASIC_MASK = (1 << 0) | (1 << 1); // 中考、高考

  const WRONG_BOOK = '__wrong';
  const REVIEW_BOOK = '__review';

  // 间隔复习：第 b 盒的词，隔 INTERVALS[b] 天再复习（简化的 Leitner 盒子法）
  const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];

  const MODES = {
    en2zh: { name: '英 → 中', desc: '看英文，写中文意思' },
    zh2en: { name: '中 → 英', desc: '看中文，拼写英文' },
    listen: { name: '听 → 写', desc: '听发音，拼写英文' },
  };

  // 每轮的三步：同一组词先英→中，再中→英，最后听→写
  const STAGES = ['en2zh', 'zh2en', 'listen'];

  const CJK_RE = /[㐀-鿿豈-﫿]/;

  // ================= 内置数据 =================

  const EXAM_WORDS = []; // { w, p, m, mask }
  const TERM_WORDS = {}; // 词库 id -> [{ w, p, m, s, t }]
  const LOOKUP = new Map(); // 小写单词 -> 词条，导入时自动补释义用

  (function loadBuiltin() {
    const exam = window.MARGIN_DICT || '';
    if (exam) {
      for (const line of exam.split('\n')) {
        const [w, p, m, mask, x] = line.split('\t');
        const e = { w, p, m, mask: +mask, x: x || '' };
        EXAM_WORDS.push(e);
        if (!LOOKUP.has(w.toLowerCase())) LOOKUP.set(w.toLowerCase(), e);
      }
    }
    for (const b of TERM_BOOKS) {
      const list = (TERM_WORDS[b.id] = []);
      const raw = window[b.key] || '';
      if (!raw) continue;
      for (const line of raw.split('\n')) {
        const [w, p, m, s, t] = line.split('\t');
        const e = { w, p, m, s, t };
        list.push(e);
        if (!LOOKUP.has(w.toLowerCase())) LOOKUP.set(w.toLowerCase(), e);
      }
    }
  })();

  // 词根词缀和单词拆解：tools/build_roots.py 根据 data/roots/ 生成
  const ROOTS = window.MARGIN_ROOTS || [];
  const ROOT_BY_ID = new Map(ROOTS.map((r) => [r.id, r]));
  const ROOT_TYPES = { prefix: '前缀', root: '词根', suffix: '后缀' };
  const PARTS = new Map(); // 小写单词 -> { w, parts, links: [{ id, form, at }] }
  for (const line of (window.MARGIN_PARTS || '').split('\n')) {
    if (!line) continue;
    const [w, parts, links] = line.split('\t');
    PARTS.set(w.toLowerCase(), {
      w,
      parts,
      links: (links ? links.split(',') : [])
        .map((x) => {
          const [id, form, at] = x.split('|');
          return { id, form, at: +at };
        })
        .filter((l) => ROOT_BY_ID.has(l.id)),
    });
  }

  // 单词的拆解；复数、过去式等查不到时退回原形
  function partsOf(word) {
    const w = String(word).toLowerCase();
    let p = PARTS.get(w);
    if (p) return p;
    for (const [end, add] of [['ies', 'y'], ['ied', 'y'], ['es', ''], ['s', ''], ['ed', ''], ['ed', 'e'], ['ing', ''], ['ing', 'e']]) {
      if (w.length > end.length + 2 && w.endsWith(end) && (p = PARTS.get(w.slice(0, -end.length) + add))) return p;
    }
    return null;
  }

  // 答完题显示的拆解；词组显示里面各个词的拆解
  function breakdownLines(w) {
    const toks = String(w).toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (toks.length === 1) {
      const p = partsOf(toks[0]);
      return p ? [p.parts] : [];
    }
    const out = [];
    for (const t of toks) {
      const p = partsOf(t);
      if (p && out.length < 3) out.push(t + ' = ' + p.parts);
    }
    return out;
  }

  const bookCache = {};

  // ================= 存储 =================

  const STORE_KEY = 'margin.v1';
  const FIRST_BOOK = TERM_WORDS.fin.length ? 'fin' : EXAM_WORDS.length ? 'toefl' : WRONG_BOOK;
  const DEFAULT_SETTINGS = {
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

  function freshState() {
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

  function normalizeState(saved) {
    const s = freshState();
    if (!saved || typeof saved !== 'object') return s;
    for (const k of ['books', 'stats', 'wrong', 'srs', 'known', 'log', 'rootStats', 'rootWrong', 'rootLog']) {
      if (saved[k] && typeof saved[k] === 'object') s[k] = saved[k];
    }
    Object.assign(s.settings, saved.settings || {});
    for (const k of ['points', 'world']) if (saved[k] && typeof saved[k] === 'object') Object.assign(s[k], saved[k]);
    for (const k of ['pets', 'petGraves', 'petWardrobe']) if (Array.isArray(saved[k])) s[k] = saved[k];
    for (const k of ['petMain', 'petSeq']) if (typeof saved[k] === 'number') s[k] = saved[k];
    // 旧版本的数据，迁移时用：0.3 的森林记录、0.3 / 0.4 的单只宠物和树种解锁
    if (saved.garden && typeof saved.garden === 'object') s.garden = saved.garden;
    if (saved.pet && typeof saved.pet === 'object') s.pet = saved.pet;
    if (saved.forest && typeof saved.forest === 'object') s.forest = saved.forest;
    return s;
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORE_KEY) || 'null'));
    } catch (e) {
      return freshState();
    }
  }

  let state = loadState();
  let saveFailed = false;

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      saveFailed = false;
    } catch (e) {
      if (!saveFailed) toast('进度没能保存（浏览器存储不可用或已满），请到「设置」里导出备份');
      saveFailed = true;
    }
  }

  // ================= 小工具 =================

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 本地日期的「第几天」，用来算复习日期
  function dayNum(date) {
    const d = date || new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }

  function dayKeyOf(n) {
    const d = new Date(n * 86400000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  // 桌面版（Tauri）里没有浏览器下载，改成直接存到「下载」文件夹
  const DESKTOP = !!(window.__TAURI__ && window.__TAURI__.core);

  function downloadText(name, text, type) {
    if (DESKTOP) {
      window.__TAURI__.core
        .invoke('save_to_downloads', { name, contents: text })
        .then(() => toast('已保存到「下载」文件夹：' + name))
        .catch((e) => toast('保存失败：' + e));
      return;
    }
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function fmt(n) {
    return Number(n).toLocaleString('en-US');
  }

  const keyOf = (w) => String(w).trim().toLowerCase();

  function meaningLines(m) {
    return String(m || '').split(/\s*[|\n]\s*/).filter(Boolean);
  }

  // 「n. 环境, 状况」拆成词性和释义
  function splitPos(line) {
    const mt = line.match(/^((?:[a-z]{1,6}\.\s*(?:&\s*)?)+)\s*(.*)$/i);
    return mt ? [mt[1].trim(), mt[2]] : ['', line];
  }

  // 按逗号、分号、顿号拆成一个个词语（括号里的不拆）
  function splitTerms(text) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of text) {
      if ('(（[［【'.includes(ch)) depth++;
      else if (')）]］】'.includes(ch)) depth = Math.max(0, depth - 1);
      if (depth === 0 && /[,，;；、]/.test(ch)) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  const POS_SPLIT_RE = /\s+(?=(?:n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|interj|aux|abbr)\.\s)/i;

  function senseGroups(m) {
    const groups = [];
    for (const ln of meaningLines(m)) {
      // 一行里夹着几个词性，比如「v. 放弃；抛弃 n. 放纵」
      for (const part of ln.split(POS_SPLIT_RE)) {
        const [pos, text] = splitPos(part.trim());
        const terms = splitTerms(text);
        if (terms.length) groups.push({ pos, terms });
      }
    }
    return groups;
  }

  // 「意思层」：一层意思显示一行，意思相近的词在同一行。
  // 考试词库的释义已经分好层（tools/build_layers.py）：同一词性里「；」隔开不同的意思层，「，」隔开同一层里的词。
  // 不带词性的释义（Finance 词库、自己导入的）里用「；」隔开的是同一个意思的几种译法，算一层。
  const layerCache = new Map();

  function layersOf(m) {
    m = String(m || '');
    if (layerCache.has(m)) return layerCache.get(m);
    const lines = meaningLines(m);
    const layers = [];
    if (!lines.some((ln) => splitPos(ln.trim())[0])) {
      const terms = [...new Set(lines.flatMap((ln) => splitTerms(ln)))];
      if (terms.length) layers.push({ pos: '', terms });
    } else {
      const seen = new Set();
      for (const ln of lines) {
        for (const part of ln.split(POS_SPLIT_RE)) {
          const [pos, text] = splitPos(part.trim());
          for (const chunk of text.split(/[；;]/)) {
            const terms = chunk
              .split(/[，,、]/)
              .map((t) => t.trim())
              .filter((t) => {
                const k = zhTerms(t).join('');
                if (!k || seen.has(k)) return false; // 别的词性里出现过的同一个词，算同一层
                seen.add(k);
                return true;
              });
            if (terms.length) layers.push({ pos, terms });
          }
        }
      }
    }
    layerCache.set(m, layers);
    return layers;
  }

  function shortMeaning(m) {
    const first = layersOf(m)[0];
    return first ? first.terms[0] : '';
  }

  // 中文意思竖着排：一层意思一行，前面编号 1. 2. 3.，意思相近的词放在同一行
  function meaningHtml(m, mask) {
    const layers = layersOf(m);
    if (!layers.length) return '';
    let lastPos = null;
    return (
      '<div class="senses">' +
      layers
        .map((L, i) => {
          const pos = L.pos !== lastPos ? L.pos : '';
          lastPos = L.pos;
          const text = L.terms.join('；');
          return '<span class="no">' + (i + 1) + '.</span><span class="pos">' + esc(pos) + '</span><span class="t">' + esc(mask ? maskWord(text, mask) : text) + '</span>';
        })
        .join('') +
      '</div>'
    );
  }

  // 中→英 题目里，释义可能直接带着答案（比如「X射线的」），遮住它
  function maskWord(text, w) {
    const k = String(w).trim();
    if (!k) return text;
    const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return text.replace(re, '＿＿');
  }

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // 确认框和输入框：桌面版里系统弹窗不可靠，网页版也统一用这个，风格一致
  function modal(message, opts) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML =
        '<div class="modal-card" role="dialog" aria-modal="true"><p class="modal-msg">' + esc(message) + '</p>' +
        (opts.input ? '<input class="field modal-input" autocomplete="off" value="' + esc(opts.value || '') + '">' : '') +
        '<div class="actions"><button class="btn small" data-m="ok">' + esc(opts.ok || '确定') + '</button><button class="btn small ghost" data-m="cancel">取消</button></div></div>';
      document.body.appendChild(wrap);
      const input = wrap.querySelector('.modal-input');
      const onKey = (ev) => {
        if (ev.isComposing || ev.keyCode === 229) return;
        if (ev.key === 'Enter' || ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          done(ev.key === 'Enter');
        }
      };
      function done(ok) {
        document.removeEventListener('keydown', onKey, true);
        wrap.remove();
        resolve(input ? (ok ? input.value : null) : ok);
      }
      document.addEventListener('keydown', onKey, true);
      wrap.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-m]');
        if (b) done(b.dataset.m === 'ok');
        else if (ev.target === wrap) done(false);
      });
      if (input) {
        input.focus();
        input.select();
      } else wrap.querySelector('[data-m="ok"]').focus();
    });
  }

  const askConfirm = (message, ok) => modal(message, { ok });
  const askText = (message, value) => modal(message, { input: true, value });

  const ICON_OK =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const ICON_BAD =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

  // 放射状的小太阳：打卡、全对时用
  const ICON_SPARK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/></svg>';

  // 今日目标的进度环
  function ringHtml(a, b, cap) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const p = b ? Math.min(1, a / b) : 1;
    return (
      '<div class="ring' + (p >= 1 ? ' full' : '') + '" style="--c:' + c.toFixed(1) + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="' + r + '"/>' +
      '<circle class="ring-fg" cx="60" cy="60" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(1) + '"/></svg>' +
      '<div class="ring-num"><b>' + fmt(a) + '</b><small>/ ' + fmt(b) + '</small><span>' + cap + '</span></div></div>'
    );
  }

  // 全对时的一圈小光芒
  const BURST = '<span class="burst" aria-hidden="true">' + Array.from({ length: 12 }, (_, i) => '<i style="--a:' + i * 30 + 'deg"></i>').join('') + '</span>';

  const ICON_SPEAK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>';

  // ================= 词库 =================

  function findExam(id) {
    return EXAM_BOOKS.find((b) => b.id === id);
  }
  function findTerm(id) {
    return TERM_BOOKS.find((b) => b.id === id);
  }

  // 今天学了多少个新词（第一次答这个词是在今天）
  function learnedToday() {
    const today = dayNum();
    let n = 0;
    for (const k in state.stats) if (state.stats[k].f === today) n++;
    return n;
  }

  // 今日复习：昨天的新词 + 错题本 + 按记忆曲线今天到期的词。今天复习过的不再出现
  function reviewPool() {
    const today = dayNum();
    const done = (state.log[todayKey()] || {}).rv || [];
    const doneSet = new Set(done);
    const pool = new Map();
    for (const k in state.srs) {
      const st = state.stats[k];
      if ((st && st.f === today - 1) || state.srs[k].d <= today) pool.set(k, state.srs[k]);
    }
    for (const k in state.wrong) pool.set(k, state.wrong[k]);
    const remaining = [];
    for (const [k, e] of pool) if (!state.known[k] && !doneSet.has(k)) remaining.push(e);
    return { done: done.length, remaining };
  }

  function markReviewed(entry) {
    const day = todayLog();
    const k = keyOf(entry.w);
    day.rv = day.rv || [];
    if (!day.rv.includes(k)) day.rv.push(k);
  }

  function todayLog() {
    const k = todayKey();
    return state.log[k] || (state.log[k] = { n: 0, r: 0 });
  }

  function bookEntries(id) {
    if (id === WRONG_BOOK) return Object.values(state.wrong);
    if (id === REVIEW_BOOK) return reviewPool().remaining;
    const ex = findExam(id);
    if (ex) {
      if (!bookCache[id]) {
        // 中考、高考词表里也有的基础词排到最后，「新词优先」时先背更难的词
        const want = ex.bits.reduce((m, b) => m | (1 << b), 0);
        const list = EXAM_WORDS.filter((e) => e.mask & want);
        const basic = (e) => (e.mask & BASIC_MASK ? 1 : 0);
        bookCache[id] = list.map((e, i) => [e, i]).sort((a, b) => basic(a[0]) - basic(b[0]) || a[1] - b[1]).map((x) => x[0]);
      }
      return bookCache[id];
    }
    if (findTerm(id)) return TERM_WORDS[id];
    const c = state.books[id];
    return c ? c.words : [];
  }

  function bookName(id) {
    if (id === WRONG_BOOK) return '错题本';
    if (id === REVIEW_BOOK) return '今日复习';
    const b = findExam(id) || findTerm(id);
    if (b) return b.name;
    return state.books[id] ? state.books[id].name : '';
  }

  function bookExists(id) {
    if (id === WRONG_BOOK || id === REVIEW_BOOK) return true;
    if (findExam(id)) return bookEntries(id).length > 0;
    if (findTerm(id)) return TERM_WORDS[id].length > 0;
    return !!state.books[id];
  }

  function studyBook() {
    const s = state.settings;
    if (!bookExists(s.book) || s.book === WRONG_BOOK || s.book === REVIEW_BOOK) s.book = FIRST_BOOK;
    return s.book;
  }

  function isBuiltin(id) {
    return !!(findExam(id) || findTerm(id));
  }

  // 还没标记为已掌握的词
  function available(entries) {
    return entries.filter((e) => e.w && !state.known[keyOf(e.w)]);
  }

  // 某一步能用的词：英→中、中→英 需要有中文意思
  function usable(entries, mode) {
    return available(entries).filter((e) => mode === 'listen' || e.m);
  }

  // ================= 统计 =================

  // 背过（或标记为已掌握）的词数
  function seenCount(entries) {
    let n = 0;
    for (const e of entries) {
      const k = keyOf(e.w);
      if (state.stats[k] || state.known[k]) n++;
    }
    return n;
  }

  // 连续打卡天数：从今天（今天还没背就从昨天）往前数
  function streak() {
    let d = dayNum();
    const has = (n) => (state.log[dayKeyOf(n)] || {}).n > 0;
    if (!has(d)) d--;
    let n = 0;
    while (has(d)) {
      n++;
      d--;
    }
    return n;
  }

  function accuracy(e) {
    const s = state.stats[keyOf(e.w)];
    if (!s) return 1;
    let r = 0;
    let x = 0;
    for (const m of STAGES) {
      if (s[m]) {
        r += s[m][0];
        x += s[m][1];
      }
    }
    return r / Math.max(1, r + x);
  }

  // 记一次答题；f 是第一次背这个词的日子，用来算「今天背了几个新词」和「昨天的新词」
  function bump(entry, mode, ok) {
    const k = keyOf(entry.w);
    const s = state.stats[k] || (state.stats[k] = { f: dayNum() });
    const m = s[mode] || (s[mode] = [0, 0, 0]);
    m[ok ? 0 : 1]++;
    m[2] = Math.floor(Date.now() / 1000);
    const day = todayLog();
    day.n++;
    if (ok) day.r++;
  }

  // 错题本：答错就进；之后某一轮里每一步都答对，就自动移出（见 finishSession）
  function markWrong(entry) {
    const k = keyOf(entry.w);
    const was = state.wrong[k];
    state.wrong[k] = { w: entry.w, p: entry.p || '', m: entry.m || '', x: entry.x || '', n: (was ? was.n : 0) + 1, t: was ? was.t : Date.now() };
  }

  // 间隔复习：答错明天再来；答对升一盒，间隔拉长。没到复习日提前答对不升盒
  function srsUpdate(entry, ok) {
    const k = keyOf(entry.w);
    const today = dayNum();
    const cur = state.srs[k];
    const base = { w: entry.w, p: entry.p || '', m: entry.m || '', x: entry.x || '' };
    if (!ok) state.srs[k] = Object.assign(base, { b: 1, d: today + INTERVALS[1] });
    else if (!cur) state.srs[k] = Object.assign(base, { b: 2, d: today + INTERVALS[2] });
    else if (today >= cur.d) {
      const b = Math.min(cur.b + 1, INTERVALS.length - 1);
      state.srs[k] = Object.assign(base, { b, d: today + INTERVALS[b] });
    }
  }

  function applyOutcome(entry, ok) {
    if (!ok) markWrong(entry);
    srsUpdate(entry, ok);
  }

  function markKnown(entry) {
    const k = keyOf(entry.w);
    state.known[k] = { w: entry.w, p: entry.p || '', m: entry.m || '', t: Date.now() };
    delete state.wrong[k];
    delete state.srs[k];
  }

  // ================= 判分 =================

  function zhTerms(text) {
    // 括号里的英文缩写（比如「资本资产定价模型（CAPM）」里的 CAPM）也算一个可以接受的答案
    const acronyms = [];
    String(text || '').replace(/[（(]\s*([A-Za-z][A-Za-z0-9&.\- ]{0,15})\s*[）)]/g, (_, a) => acronyms.push(a.replace(/[^A-Za-z0-9]/g, '').toLowerCase()));
    return String(text || '')
      .replace(/[（(［\[【〔<《][^）)］\]】〕>》]*[）)］\]】〕>》]/g, ' ')
      .replace(/(^|[^a-z])(?:[a-z]{1,6}\.)+/gi, '$1 ')
      .split(/[\s,，;；、\/|。.!！?？:：'"“”‘’…·\-—–~～=]+/)
      .map((t) => t.replace(/[^㐀-鿿豈-﫿A-Za-z0-9]/g, '').toLowerCase())
      .map((t) => (t.length > 1 ? t.replace(/[的地得]$/, '').replace(/^[的地得之]/, '') : t))
      .concat(acronyms)
      .filter(Boolean);
  }

  function commonLen(a, b) {
    let best = 0;
    const prev = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      let diag = 0;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
        if (prev[j] > best) best = prev[j];
        diag = tmp;
      }
    }
    return best;
  }

  // ---- 中文词向量（tools/build_vectors.py 生成）----
  // 两个中文词如果经常翻译同一批英文单词，向量就接近；反义词几乎不会翻译同一个英文单词
  const SIM_T = 0.45;
  let VEC = null;
  const vecCache = new Map();

  function loadVectors() {
    if (VEC !== null) return VEC;
    const raw = window.MARGIN_VEC;
    if (!raw || !raw.data) return (VEC = false);
    const bin = atob(raw.data);
    const data = new Int8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = (bin.charCodeAt(i) << 24) >> 24;
    const map = new Map();
    raw.words.split('\t').forEach((w, i) => map.set(w, i));
    return (VEC = { dim: raw.dim, map, data });
  }

  // 词表里有就直接用；没有就按最长匹配拆成几个认识的词，向量相加
  function vecOf(term) {
    if (vecCache.has(term)) return vecCache.get(term);
    const V = loadVectors();
    let out = null;
    if (V) {
      const acc = new Float32Array(V.dim);
      const add = (row) => {
        const o = row * V.dim;
        for (let d = 0; d < V.dim; d++) acc[d] += V.data[o + d];
      };
      let n = 0;
      if (V.map.has(term)) {
        add(V.map.get(term));
        n = 1;
      } else {
        for (let i = 0; i < term.length; ) {
          let step = 1;
          for (let L = Math.min(6, term.length - i); L >= 1; L--) {
            const r = V.map.get(term.substr(i, L));
            if (r !== undefined) {
              add(r);
              n++;
              step = L;
              break;
            }
          }
          i += step;
        }
      }
      let norm = 0;
      for (let d = 0; d < V.dim; d++) norm += acc[d] * acc[d];
      if (n && norm) {
        norm = Math.sqrt(norm);
        for (let d = 0; d < V.dim; d++) acc[d] /= norm;
        out = acc;
      }
    }
    vecCache.set(term, out);
    return out;
  }

  function similarity(a, b) {
    const va = vecOf(a);
    const vb = vecOf(b);
    if (!va || !vb) return null;
    let s = 0;
    for (let d = 0; d < va.length; d++) s += va[d] * vb[d];
    return s;
  }

  const NEG_RE = /^[不无非未没]/;

  // 只差一个字、而这两个字意思相反的词（多头 / 空头、进口 / 出口），一律不算对
  const OPPOSITE = new Set(
    '多空 多少 上下 进出 入出 买卖 大小 长短 高低 增减 加减 升降 涨跌 正负 内外 前后 主被 顺逆 优劣 收支 盈亏 输赢 胜败 胜负 早晚 新旧 强弱 左右 东西 南北 好坏 真假 是非 有无 开关 借贷 存取 升贬 褒贬 攻守 动静 明暗 首末 始终 生死 得失 利弊 难易 快慢 轻重 远近 深浅 宽窄 厚薄 粗细 冷热 干湿 软硬 松紧 美丑 善恶 贫富 贵贱 进退 出入 起落 正反 积消 乐悲 顺差 买方'
      .split(' ')
      .filter((x) => x.length === 2)
      .flatMap((x) => [x, x[1] + x[0]])
  );

  function oppositePair(a, b) {
    if (a.length !== b.length || a === b) return false;
    let diff = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (diff >= 0) return false;
        diff = i;
      }
    }
    return OPPOSITE.has(a[diff] + b[diff]);
  }

  // 判中文：写的和任何一个释义意思相同或相近就算对
  function zhMatch(answer, meaning) {
    const us = zhTerms(answer);
    const rs = zhTerms(meaning);
    for (const u of us) {
      for (const r of rs) {
        if (u === r) return true;
        // 一个带「不、无、非」一个不带，或者只差一个反义字，意思多半相反
        if (NEG_RE.test(u) !== NEG_RE.test(r) || oppositePair(u, r)) continue;
        if (u.length >= 2 && r.includes(u)) return true;
        if (r.length >= 2 && u.includes(r)) return true;
        if (r.length === 1 && u.includes(r) && u.length <= 3) return true;
        // 词向量只比较两个字以上的词；单字和「含…的意思」拆出来的碎片意思太泛
        if (u.length < 2 || r.length < 2) continue;
        const sim = similarity(u, r);
        if (sim !== null ? sim >= SIM_T : commonLen(u, r) >= 2) return true;
      }
    }
    return false;
  }

  // 拼写必须完全一样（连字符、空格、撇号都算），只忽略大小写和首尾空格
  function normEn(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, ' ');
  }

  function enMatch(answer, word) {
    const a = normEn(answer);
    return !!a && String(word).split('/').some((w) => normEn(w) === a);
  }

  function judge(mode, entry, answer) {
    if (!answer.trim()) return false;
    return mode === 'en2zh' ? zhMatch(answer, entry.m) : enMatch(answer, entry.w);
  }

  // 英→中 要写几行：这个词有几层意思就写几行
  function zhLineCount(entry) {
    return Math.max(1, layersOf(entry.m).length);
  }

  // 英→中 多行判分：每一行要对上一层不同的意思，每一层都写到了才算对
  function judgeZhLines(lines, entry) {
    const layers = layersOf(entry.m);
    const texts = lines.map((t) => t.trim());
    // 每一行能对上哪几层
    const can = texts.map((t) => (t ? layers.map((L, j) => (zhMatch(t, L.terms.join('；')) ? j : -1)).filter((j) => j >= 0) : []));
    // 二分图匹配：一行只能占一层，两行不能都算同一层
    const owner = new Array(layers.length).fill(-1);
    const assign = (i, used) => {
      for (const j of can[i]) {
        if (used[j]) continue;
        used[j] = true;
        if (owner[j] < 0 || assign(owner[j], used)) {
          owner[j] = i;
          return true;
        }
      }
      return false;
    };
    texts.forEach((t, i) => {
      if (t) assign(i, []);
    });
    const matched = new Set(owner.filter((i) => i >= 0));
    const marks = texts.map((t, i) => (t ? matched.has(i) : null));
    return { ok: texts.length === layers.length && marks.every((x) => x === true), marks };
  }

  // ================= 发音 =================

  let speakToken = 0;
  let currentAudio = null;

  function stopSpeech() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function speak(word) {
    if (!word) return;
    const token = ++speakToken;
    stopSpeech();
    const s = state.settings;
    if (s.voice === 'browser' || navigator.onLine === false) {
      tts(word);
      return;
    }
    const a = new Audio('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(word) + '&type=' + (s.accent === 'uk' ? 1 : 2));
    currentAudio = a;
    let settled = false;
    const fallback = () => {
      if (settled || token !== speakToken) return;
      settled = true;
      a.pause();
      tts(word);
    };
    a.addEventListener('playing', () => {
      settled = true;
    });
    a.addEventListener('error', fallback);
    setTimeout(fallback, 2500);
    a.play().catch(fallback);
  }

  function pickVoice(lang) {
    const voices = window.speechSynthesis.getVoices();
    const norm = (l) => String(l).replace('_', '-').toLowerCase();
    const same = voices.filter((v) => norm(v.lang) === lang.toLowerCase());
    const pool = same.length ? same : voices.filter((v) => norm(v.lang).startsWith('en'));
    const prefer = ['Google', 'Samantha', 'Daniel', 'Aria', 'Jenny', 'Sonia', 'Natural', 'Microsoft'];
    for (const p of prefer) {
      const v = pool.find((x) => x.name.includes(p));
      if (v) return v;
    }
    return pool[0] || null;
  }

  function tts(word) {
    if (!('speechSynthesis' in window)) {
      toast('这个浏览器不支持朗读，建议用 Chrome 或 Edge');
      return;
    }
    const synth = window.speechSynthesis;
    const lang = state.settings.accent === 'uk' ? 'en-GB' : 'en-US';
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang;
    u.rate = 0.9;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    synth.cancel();
    setTimeout(() => synth.speak(u), 30);
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  // ================= 导入解析 =================

  const POS_TAIL_RE = /(?:^|\s)((?:(?:n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|interj|aux|abbr|pl|phr)\.\s*(?:&\s*)?)+)\s*$/i;

  function parseLine(raw) {
    let line = raw.replace(/^﻿/, '').trim();
    if (!line || line.startsWith('#')) return null;
    line = line.replace(/^\d+\s*[.、)）:：]\s*/, '');
    let w = '';
    let p = '';
    let m = '';
    if (line.includes('\t')) {
      const parts = line.split('\t').map((s) => s.trim()).filter(Boolean);
      w = parts.shift() || '';
      if (parts.length > 1 && /^[\/\[].*[\/\]]$/.test(parts[0])) p = parts.shift().slice(1, -1);
      m = parts.join('|');
    } else {
      line = line.replace(/"/g, '');
      const i = line.search(CJK_RE);
      let head = i >= 0 ? line.slice(0, i) : line;
      m = i >= 0 ? line.slice(i).trim() : '';
      const pm = head.match(/[\/\[]([^\/\]]+)[\/\]]/);
      if (pm) {
        p = pm[1].trim();
        head = head.replace(pm[0], ' ');
      }
      const pos = head.match(POS_TAIL_RE);
      if (pos) {
        m = (pos[1].trim() + ' ' + m).trim();
        head = head.slice(0, pos.index);
      }
      head = head.replace(/[\s,，;；:：=|\-—–]+$/, '').trim();
      if (i < 0) {
        // 没有中文：可能是「word, english meaning」，也可能只有单词
        const sep = head.match(/\s*[,，;；:：=|\t]\s*|\s+[-—–]\s+/);
        if (sep) {
          m = head.slice(sep.index + sep[0].length).trim();
          head = head.slice(0, sep.index).trim();
        }
      }
      w = head;
    }
    w = w.replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]/.test(w) || w.length > 80) return { bad: raw.trim() };
    return { w, p, m };
  }

  // Qwerty Learner 词库格式：[{"name":"if","trans":["conj. 如果"]}]
  function jsonToLines(text) {
    const t = String(text || '').trim();
    if (!t.startsWith('[')) return text;
    try {
      const arr = JSON.parse(t);
      if (!Array.isArray(arr)) return text;
      return arr
        .map((o) => {
          if (!o || typeof o !== 'object') return '';
          const w = o.name || o.word || o.w || '';
          let m = o.trans || o.translation || o.m || '';
          if (Array.isArray(m)) m = m.join('|');
          return w ? w + '\t' + String(m).replace(/\t/g, ' ') : '';
        })
        .join('\n');
    } catch (e) {
      return text;
    }
  }

  function parseImport(text) {
    text = jsonToLines(text);
    const words = [];
    const seen = new Map();
    let filled = 0;
    const bad = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const r = parseLine(raw);
      if (!r) continue;
      if (r.bad) {
        bad.push(r.bad);
        continue;
      }
      const hit = LOOKUP.get(r.w.toLowerCase());
      if (hit) {
        if (!r.m) {
          r.m = hit.m;
          filled++;
        }
        if (!r.p) r.p = hit.p || '';
      }
      const k = keyOf(r.w);
      if (seen.has(k)) {
        const old = seen.get(k);
        if (!old.m && r.m) old.m = r.m;
        continue;
      }
      const e = { w: r.w, p: r.p, m: r.m };
      seen.set(k, e);
      words.push(e);
    }
    const missing = words.filter((e) => !e.m);
    return { words, filled, missing, bad };
  }

  function decodeFile(buf) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (e) {
      // Excel 在中文 Windows 上另存的 CSV 通常是 GBK 编码
      try {
        return new TextDecoder('gbk').decode(buf);
      } catch (e2) {
        return new TextDecoder('utf-8').decode(buf);
      }
    }
  }

  // ================= 我的词表 =================

  function createBook(name, words) {
    const id = 'u' + Date.now().toString(36);
    const book = { id, name: (name || '').trim() || '我的词表 ' + (Object.keys(state.books).length + 1), words, t: Date.now() };
    state.books[id] = book;
    return book;
  }

  function openNewBook(book, added) {
    state.settings.book = book.id;
    save();
    ui.book = { id: book.id, q: '', limit: 200 };
    go('book');
    toast('已导入 ' + added + ' 个词');
  }

  // ================= 界面状态 =================

  const app = document.getElementById('app');
  const ui = {
    view: 'home',
    session: null,
    book: { id: null, q: '', limit: 200 },
    draft: null,
    roots: { q: '', type: 'all', id: null, limit: 200, wordLimit: 50 },
    rs: null, // 词根练习的一组
  };

  function go(view) {
    if (ui.view === 'practice' && view !== 'practice') stopSpeech();
    if (view !== ui.view) ui.tool = null; // 换页面就把手里的工具放下
    ui.view = view;
    render();
    window.scrollTo(0, 0);
  }

  // ================= 背诵流程 =================

  // 背新词：从词库里挑还没背过的词，每组 size 个，直到完成今天的目标（之后可以再背）
  function startNew() {
    const s = state.settings;
    const book = studyBook();
    const left = s.goal - learnedToday();
    const n = left > 0 ? Math.min(s.size, left) : s.size;
    const fresh = available(bookEntries(book)).filter((e) => !state.stats[keyOf(e.w)]);
    if (!fresh.length) {
      toast(bookEntries(book).length ? '这个词库的词都背过了，换一个词库吧' : '这个词表还没有词');
      return;
    }
    const words = s.order === 'random' ? shuffle(fresh.slice()).slice(0, n) : shuffle(fresh.slice(0, n));
    startSession(words, book, 'new');
  }

  function startReview() {
    const { remaining } = reviewPool();
    if (!remaining.length) {
      toast('今天的复习做完了');
      return;
    }
    startSession(shuffle(remaining.slice()).slice(0, state.settings.size), REVIEW_BOOK, 'review');
  }

  function startWrong() {
    const list = available(Object.values(state.wrong));
    if (!list.length) {
      toast('错题本是空的');
      return;
    }
    startSession(shuffle(list.slice()).slice(0, state.settings.size), WRONG_BOOK, 'wrong');
  }

  // 一轮：同一组词依次过三步。kind：new 背新词 / review 今日复习 / wrong 错题本 / retry 再练错的
  function startSession(words, bookId, kind) {
    ui.session = { kind, bookId, words, stage: -1, mode: null, items: [], idx: 0, results: [], stageResults: [], retries: [], repeat: false, attempt: 1, pending: null, between: false, ended: false };
    beginStage(0);
    petJoinStudy();
  }

  // 一轮结束：这一轮里每一步都答对的词，从错题本移出
  function finishSession() {
    const ss = ui.session;
    if (ss && !ss.finished) {
      ss.finished = true;
      const allOk = new Map();
      for (const r of allResults(ss)) {
        const k = keyOf(r.entry.w);
        allOk.set(k, allOk.get(k) !== false && r.ok);
      }
      for (const [k, ok] of allOk) if (ok) delete state.wrong[k];
      const all = allResults(ss);
      rewardGroup('word', ss.words.length, !ss.ended && all.length > 0 && all.every((r) => r.ok), ss.ended);
      save();
    }
    go('result');
  }

  function beginStage(n) {
    const ss = ui.session;
    ss.attempt = n === ss.stage ? ss.attempt + 1 : 1;
    ss.repeat = false;
    // 跳过没有可用词的步骤（比如导入的词没有中文意思，就只练听写）
    while (n < STAGES.length && !usable(ss.words, STAGES[n]).length) n++;
    if (n >= STAGES.length) {
      finishSession();
      return;
    }
    Object.assign(ss, { stage: n, mode: STAGES[n], items: shuffle(usable(ss.words, STAGES[n]).slice()), idx: 0, results: [], pending: null, between: false, animIdx: -1, animRow: 0 });
    go('practice');
    onPromptShown();
  }

  function nextStageIndex(ss) {
    for (let n = ss.stage + 1; n < STAGES.length; n++) if (usable(ss.words, STAGES[n]).length) return n;
    return -1;
  }

  function endStage() {
    const ss = ui.session;
    ss.stageResults[ss.stage] = ss.results;
    // 强制全对：这一步有答错的，整组重来这一步
    if (state.settings.forceAll && ss.results.some((r) => !r.ok)) {
      ss.repeat = true;
      ss.between = true;
      render();
      petSay('repeat');
      return;
    }
    if (nextStageIndex(ss) < 0) {
      finishSession();
      return;
    }
    ss.between = true;
    setTimeout(() => petSay(ss.results.every((r) => r.ok) ? 'stagePerfect' : 'stage'), 50);
    render();
  }

  function continueStage() {
    const ss = ui.session;
    if (!ss || !ss.between) return;
    if (ss.repeat) {
      // 没通过的这一遍记下来（结果页和错题本要用），再把这一步重来一遍
      ss.retries.push({ stage: ss.stage, results: ss.results });
      ss.stageResults[ss.stage] = null;
      beginStage(ss.stage);
      return;
    }
    beginStage(nextStageIndex(ss));
  }

  function current() {
    const ss = ui.session;
    return ss && ss.items[ss.idx];
  }

  function onPromptShown() {
    const ss = ui.session;
    const e = current();
    if (!e) return;
    if (ss.mode !== 'zh2en') speak(e.w);
  }

  function submitAnswer() {
    const ss = ui.session;
    if (!ss) return;
    if (ss.pending) {
      submitPending();
      return;
    }
    const entry = current();
    let ok;
    let answer;
    let lines = null;
    let marks = null;
    if (ss.mode === 'en2zh') {
      lines = [...document.querySelectorAll('.ans')].map((el) => el.value);
      const j = judgeZhLines(lines, entry);
      ok = j.ok;
      marks = j.marks;
      answer = lines.map((t) => t.trim()).filter(Boolean).join('；');
    } else {
      const input = document.getElementById('answer');
      answer = (input ? input.value : '').trim();
      ok = judge(ss.mode, entry, answer);
    }
    const result = { entry, answer, lines, marks, ok };
    const again = !ok && wrongBefore(entry);
    bump(entry, ss.mode, ok);
    applyOutcome(entry, ok);
    rewardAnswer(ss, ok, again);
    if (ss.kind === 'review') markReviewed(entry);
    save();
    if (ok) {
      ss.results.push(result);
      advance();
    } else {
      ss.pending = result;
      render();
      if (ss.mode === 'listen') speak(entry.w);
    }
  }

  // 拼写题答错后，照着正确拼写打一遍
  function needsCopy(ss) {
    return ss.mode !== 'en2zh' && state.settings.copyWrong && ss.pending && !ss.pending.ok;
  }

  function submitPending() {
    const ss = ui.session;
    const input = document.getElementById('answer');
    if (needsCopy(ss) && input) {
      const v = input.value;
      if (v.trim() && !enMatch(v, ss.pending.entry.w)) {
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
        input.select();
        return;
      }
    }
    finishPending();
  }

  function skipKnown() {
    const ss = ui.session;
    if (!ss || ss.pending) return;
    const e = current();
    markKnown(e);
    ss.words = ss.words.filter((w) => w !== e);
    save();
    toast('「' + e.w + '」标记为已掌握，以后不再出现');
    advance();
  }

  function finishPending() {
    const ss = ui.session;
    ss.results.push(ss.pending);
    ss.pending = null;
    advance();
  }

  function advance() {
    const ss = ui.session;
    ss.idx++;
    if (ss.idx >= ss.items.length) {
      endStage();
      return;
    }
    render();
    onPromptShown();
  }

  function quitSession() {
    const ss = ui.session;
    if (!ss) return go('home');
    if (ss.pending) {
      ss.results.push(ss.pending);
      ss.pending = null;
    }
    if (ss.stage >= 0) ss.stageResults[ss.stage] = ss.results;
    if (!allResults(ss).length) {
      ui.session = null;
      return go('home');
    }
    ss.ended = true;
    finishSession();
  }

  function allResults(ss) {
    return [].concat(...ss.stageResults.filter(Boolean), ...ss.retries.map((x) => x.results));
  }

  // 某一步所有遍数的答题（强制全对时一步可能做了好几遍）
  function stageAll(ss, i) {
    return [].concat(...ss.retries.filter((x) => x.stage === i).map((x) => x.results), ss.stageResults[i] || []);
  }

  // ================= 渲染：框架 =================

  function render() {
    petsTick();
    if (ui.petGone && ui.petGone.length) {
      const names = ui.petGone;
      ui.petGone = null;
      setTimeout(() => toast(names.join('、') + ' 生病太久，去世了'), 600);
    }
    if (scene && ui.view !== 'garden' && ui.view !== 'room') {
      scene.stop();
      scene = null;
    }
    const html = header() + updateBarHtml() + (VIEWS[ui.view] || VIEWS.home)();
    app.innerHTML = html;
    AFTER[ui.view] && AFTER[ui.view]();
    renderPet();
    renderBag();
  }

  function header() {
    const wrongN = Object.keys(state.wrong).length;
    const nav = [
      ['home', '背诵'],
      ['roots', '词根'],
      ['books', '词库'],
      ['wrong', '错题本' + (wrongN ? '<sup>' + wrongN + '</sup>' : '')],
      ['garden', '花园'],
      ['shop', '商店' + (petNeedsCare() ? '<i class="dot" title="' + (petSick() ? '宠物生病了' : '宠物状态不太好') + '"></i>' : '')],
      ['settings', '设置'],
    ];
    const active = { practice: 'home', result: 'home', book: 'books', import: 'books', root: 'roots', rootquiz: 'roots', room: 'garden' }[ui.view] || ui.view;
    return (
      '<header class="top"><button class="brand" data-act="nav" data-view="home"><span class="brand-mark">' + ICON_SPARK + '</span>Marginal Vocabulary</button>' +
      '<div class="top-r"><button class="pts" data-act="nav" data-view="shop" title="金币 · Lv ' + levelOf(state.points.earned) + '"><span class="pts-ic"></span>' + fmt(state.points.bal) + '</button><nav class="nav">' +
      nav.map(([v, label]) => '<button data-act="nav" data-view="' + v + '" class="' + (active === v ? 'on' : '') + '">' + label + '</button>').join('') +
      '</nav></div></header>'
    );
  }

  // 内置词库，平铺：Finance、Medicine、CET-4、CET-6……
  function allBooks() {
    return TERM_BOOKS.concat(EXAM_BOOKS)
      .map((b) => b.id)
      .filter((id) => bookExists(id));
  }

  function bookOptionsHtml(selected) {
    const opt = (id, label) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    const info = (id) => {
      const list = bookEntries(id);
      return bookName(id) + ' · ' + fmt(list.length) + ' 词 · 已背 ' + fmt(seenCount(list));
    };
    let html = '';
    html += allBooks().map((id) => opt(id, info(id))).join('');
    const mine = Object.values(state.books).sort((a, b) => a.t - b.t);
    html += mine.map((b) => opt(b.id, info(b.id))).join('');
    return html;
  }

  // ================= 渲染：各页面 =================

  const VIEWS = {};
  const AFTER = {};

  VIEWS.home = function () {
    const s = state.settings;
    const book = studyBook();
    const day = state.log[todayKey()] || { n: 0, r: 0 };
    const learned = learnedToday();
    const rv = reviewPool();
    const rvTotal = rv.done + rv.remaining.length;
    const left = s.goal - learned;
    const st = streak();
    const d = new Date();
    const week = '日一二三四五六'[d.getDay()];
    const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 100);
    const orders = chipsHtml('order', [
      ['new', '按词表顺序'],
      ['random', '随机'],
    ]);
    const title = left <= 0 ? '今天的目标完成了' : learned ? '还差 ' + left + ' 个新词' : '今天背 ' + s.goal + ' 个新词';
    const sub = left <= 0 ? '想多背一点，可以再来一组。' : learned ? '已经背了 ' + learned + ' 个，接着来。' : '一组一组来，每组过三步：英 → 中、中 → 英、听 → 写。';
    return (
      '<main class="page home">' +
      '<p class="label">' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + week + '</p>' +
      '<section class="hero' + (left <= 0 ? ' done' : '') + '">' +
      '<div class="hero-main"><p class="label">今日新词 · ' + esc(bookName(book)) + '</p>' +
      '<h1 class="h1">' + title + '</h1><p class="sub">' + sub + '</p>' +
      '<div class="actions"><button class="btn big" data-act="startNew">' + (left > 0 ? '背新词' : '再背一组') + ' <kbd>Enter</kbd></button></div></div>' +
      ringHtml(learned, s.goal, '新词') +
      '</section>' +
      '<div class="tasks">' +
      '<div class="task"><p class="label">复习</p>' +
      '<div class="num">' + fmt(rv.done) + '<small> / ' + fmt(rvTotal) + '</small></div>' +
      '<div class="bar"><i style="width:' + pct(rv.done, rvTotal) + '%"></i></div>' +
      '<p class="muted">昨天的新词、错题本和到期的词</p>' +
      '<button class="btn ghost" data-act="startReview"' + (rv.remaining.length ? '' : ' disabled') + '>' + (rv.remaining.length ? '开始复习 <kbd>R</kbd>' : rvTotal ? '复习完了' : '今天没有要复习的词') + '</button></div>' +
      '<div class="task streak' + (st ? ' on' : '') + '"><p class="label">打卡</p>' +
      '<div class="num"><span class="spark">' + ICON_SPARK + '</span>' + fmt(st) + '<small> 天</small></div>' +
      '<p class="muted">' + (st ? '已连续打卡 ' + st + ' 天' : '今天背一组，就开始打卡') + '</p>' +
      '<div class="mini"><div><b>' + fmt(day.n) + '</b><span>今天答题</span></div><div><b>' + (day.n ? Math.round((day.r / day.n) * 100) + '%' : '—') + '</b><span>今天正确率</span></div></div></div>' +
      '</div>' +
      gardenCardHtml() +
      challengesHtml(true) +
      '<section class="panel prefs"><p class="label">背什么</p>' +
      '<div class="pref"><span class="t">词库</span><label class="select"><select data-act="setBook" aria-label="词库">' + bookOptionsHtml(book) + '</select></label></div>' +
      '<div class="pref"><span class="t">每天背多少新词</span>' + chipsHtml('goal', [10, 20, 30, 50, 100].map((n) => [n, String(n)])) + '</div>' +
      '<div class="pref"><span class="t">新词顺序</span>' + orders + '</div>' +
      '</section>' +
      heatmapHtml() +
      '</main>'
    );
  };

  // 最近一年的打卡热力图：颜色越深，那天答题越多
  function heatmapHtml() {
    const WEEKS = 52;
    const today = dayNum();
    const dow = new Date().getDay();
    const start = today - dow - (WEEKS - 1) * 7;
    let cells = '';
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const n = start + w * 7 + d;
        if (n > today) {
          cells += '<i class="hm-x"></i>';
          continue;
        }
        const key = dayKeyOf(n);
        const rec = state.log[key] || { n: 0, r: 0 };
        const lv = rec.n === 0 ? 0 : rec.n < 10 ? 1 : rec.n < 30 ? 2 : rec.n < 60 ? 3 : 4;
        const tip = key + ' · ' + (rec.n ? '答题 ' + rec.n + '，正确率 ' + Math.round((rec.r / rec.n) * 100) + '%' : '没有背');
        cells += '<i class="hm-' + lv + '" title="' + tip + '"></i>';
      }
    }
    const total = Object.keys(state.stats).length;
    return (
      '<section class="panel heat"><div class="head-row"><p class="label">最近一年</p><span class="muted">累计背过 ' + fmt(total) + ' 词 · 已掌握 ' + fmt(Object.keys(state.known).length) + ' 词</span></div>' +
      '<div class="hm" aria-label="最近一年每天的答题量">' + cells + '</div>' +
      '<div class="hm-legend" aria-hidden="true"><span>少</span><i class="hm-0"></i><i class="hm-1"></i><i class="hm-2"></i><i class="hm-3"></i><i class="hm-4"></i><span>多</span></div></section>'
    );
  }

  AFTER.home = function () {
    // 窄屏时热力图默认滚到最近几周
    const hm = document.querySelector('.hm');
    if (hm) hm.scrollLeft = hm.scrollWidth;
  };

  function slotsHtml(w) {
    if (!state.settings.letterHint) return '';
    let letters = 0;
    const s = Array.from(w)
      .map((c) => {
        if (/[A-Za-z0-9]/.test(c)) {
          letters++;
          return '_';
        }
        return c === ' ' ? '&nbsp;&nbsp;' : esc(c);
      })
      .join('');
    return '<div class="slots" aria-label="' + letters + ' 个字母">' + s + '<span class="n">' + letters + '</span></div>';
  }

  // 英→中 的记录：左边是你写的每一行（对的打勾，错的划掉），右边是每一层正确意思
  function zhDetailHtml(r) {
    const layers = layersOf(r.entry.m);
    const yours = (r.lines || []).map((t, i) => {
      const ok = r.marks && r.marks[i] === true;
      return '<div class="y ' + (ok ? 'ok' : 'bad') + '"><span class="mk">' + (ok ? ICON_OK : ICON_BAD) + '</span>' + (t.trim() ? esc(t.trim()) : '<span class="none">没写</span>') + '</div>';
    });
    const right = layers.map((L, i) => '<div class="r"><span class="no">' + (i + 1) + '.</span>' + esc(L.terms.join('；')) + '</div>');
    return '<div class="h-detail">' + (r.ok ? '' : '<div class="h-yours">' + yours.join('') + '</div>') + '<div class="h-right">' + right.join('') + '</div></div>';
  }

  function historyHtml(ss) {
    return ss.results
      .map((r, i) => {
        const fresh = i === ss.results.length - 1 && ss.animRow !== ss.results.length ? ' fresh' : '';
        const yours = r.ok ? '' : r.answer ? '<span class="yours">' + esc(r.answer) + '</span>' : '<span class="yours none">没答</span>';
        return (
          '<div class="h-row ' + (r.ok ? 'ok' : 'bad') + fresh + '">' +
          '<span class="h-no">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="h-mark" aria-label="' + (r.ok ? '答对' : '答错') + '">' + (r.ok ? ICON_OK : ICON_BAD) + '</span>' +
          // 「中 → 英」这一步不出声，答过的词也不能点读
          (ss.mode === 'zh2en' ? '<span class="h-word">' + esc(r.entry.w) + '</span>' : '<button class="h-word" data-act="speakWord" data-w="' + esc(r.entry.w) + '" title="朗读">' + esc(r.entry.w) + '</button>') +
          (ss.mode === 'en2zh' && r.lines
            ? zhDetailHtml(r)
            : '<span class="h-mean" title="' + esc(meaningLines(r.entry.m).join('\n')) + '">' + yours + esc(shortMeaning(r.entry.m)) + '</span>') +
          '</div>'
        );
      })
      .join('');
  }

  function promptHtml(ss, e) {
    if (ss.mode === 'en2zh') {
      return (
        '<div class="prompt-word">' + esc(e.w) + '</div>' +
        '<div class="prompt-phon">' + (e.p ? '/' + esc(e.p) + '/' : '') + '<button class="icon-btn" data-act="speakCurrent" title="朗读（Tab）">' + ICON_SPEAK + '</button></div>'
      );
    }
    if (ss.mode === 'zh2en') {
      return '<div class="prompt-mean">' + meaningHtml(e.m, e.w) + '</div>' + slotsHtml(e.w);
    }
    return '<button class="speak-big" data-act="speakCurrent" title="再听一遍（Tab）">' + ICON_SPEAK + '</button>' + slotsHtml(e.w);
  }

  function feedbackHtml(ss, r) {
    const e = r.entry;
    const copy = needsCopy(ss);
    let body;
    if (ss.mode === 'en2zh') {
      body = '<div class="fb-label">参考释义</div><div class="fb-mean">' + meaningHtml(e.m) + '</div>';
    } else {
      body =
        (copy && r.answer ? '<div class="fb-yours">你写的：<s>' + esc(r.answer) + '</s></div>' : '') +
        '<div class="fb-label">正确拼写</div><div class="fb-word">' + esc(e.w) + '</div>' +
        (e.p ? '<div class="fb-phon">/' + esc(e.p) + '/</div>' : '') +
        (ss.mode === 'listen' ? '<div class="fb-mean">' + meaningHtml(e.m) + '</div>' : ''); // 中→英 的题目本身就是中文意思，不再重复
    }
    const parts = breakdownLines(e.w);
    if (parts.length) body += '<div class="fb-parts">' + parts.map(esc).join('<br>') + '</div>';
    return (
      '<div class="feedback">' + body +
      '<div class="actions"><button class="btn small" data-act="next">继续 <kbd>Enter</kbd></button></div>' +
      '</div>'
    );
  }

  // 两步之间的小结
  function betweenHtml(ss) {
    const right = ss.results.filter((r) => r.ok).length;
    if (ss.repeat) {
      const bad = ss.results.length - right;
      return (
        '<div class="stage-done again">' +
        '<p class="label">第 ' + (ss.stage + 1) + ' 步 · ' + MODES[ss.mode].name + (ss.attempt > 1 ? ' · 第 ' + ss.attempt + ' 遍' : '') + '</p>' +
        '<div class="stage-score">' + right + '<small> / ' + ss.results.length + '</small></div>' +
        '<p class="muted">错了 ' + bad + ' 个。已开启强制全对，这一步整组再来一遍，全对才进入下一步。</p>' +
        '<div class="actions"><button class="btn" data-act="continueStage">再来一遍 <kbd>Enter</kbd></button></div>' +
        '</div>'
      );
    }
    const next = MODES[STAGES[nextStageIndex(ss)]];
    const perfect = right === ss.results.length;
    return (
      '<div class="stage-done' + (perfect ? ' perfect' : '') + '">' + (perfect ? BURST : '') +
      '<p class="label">第 ' + (ss.stage + 1) + ' 步完成 · ' + MODES[ss.mode].name + '</p>' +
      '<div class="stage-score">' + right + '<small> / ' + ss.results.length + '</small></div>' +
      '<p class="muted">下一步：' + next.name + ' · ' + next.desc + '</p>' +
      '<div class="actions"><button class="btn" data-act="continueStage">继续 <kbd>Enter</kbd></button></div>' +
      '</div>'
    );
  }

  function stepsHtml(ss) {
    return STAGES.map((k, i) => '<span class="step' + (i === ss.stage ? ' on' : i < ss.stage ? ' done' : '') + '">' + (i + 1) + ' ' + MODES[k].name + (i === ss.stage && ss.attempt > 1 ? ' · 第 ' + ss.attempt + ' 遍' : '') + '</span>').join('');
  }

  VIEWS.practice = function () {
    const ss = ui.session;
    if (!ss) return VIEWS.home();
    const e = current();
    // 进度条按三步加起来算
    const counts = STAGES.map((k) => usable(ss.words, k).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const before = counts.slice(0, ss.stage).reduce((a, b) => a + b, 0);
    const done = before + ss.results.length + (ss.pending ? 1 : 0);
    const pct = Math.min(100, (done / total) * 100);
    const pend = ss.pending;
    const copy = needsCopy(ss);
    const placeholder = copy ? '照着打一遍，或直接按 Enter 继续' : '拼写英文';
    const anim = ss.animIdx !== ss.idx ? ' anim' : '';
    let inputs;
    if (ss.between) inputs = '';
    else if (ss.mode === 'en2zh') {
      // 英→中：一行写一个中文意思
      const n = pend && pend.lines ? pend.lines.length : zhLineCount(e);
      inputs = '<div class="zh-lines' + (n > 4 ? ' many' : '') + '">';
      for (let i = 0; i < n; i++) {
        const mk = pend && pend.marks ? pend.marks[i] : undefined;
        const cls = mk === true ? ' ok' : mk === false ? ' bad' : '';
        inputs +=
          '<div class="zl' + cls + '"><span class="zl-mark">' + (mk === true ? ICON_OK : mk === false ? ICON_BAD : '') + '</span><span class="zl-no">' + (i + 1) + '.</span>' +
          '<input class="answer ans" ' + (i === 0 ? 'id="answer" ' : '') + 'data-line="' + i + '" autocomplete="off" spellcheck="false"' +
          (pend ? ' readonly value="' + esc(pend.lines[i] || '') + '"' : '') + '></div>';
      }
      inputs += '</div>';
    } else {
      inputs =
        '<input id="answer" class="answer en' + (pend && !copy ? ' wrong' : '') + (copy ? ' copy' : '') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="' + placeholder + '"' +
        (pend && !copy ? ' readonly value="' + esc(pend.answer) + '"' : '') + '>';
    }
    const hint =
      ss.mode === 'en2zh'
        ? '<div class="hint"><span>一行写一个意思，<kbd>Enter</kbd> 换行</span><span>写完最后一行按 <kbd>Enter</kbd> 提交</span><span><kbd>Tab</kbd> 再听一遍</span><button class="link" data-act="skipKnown" title="以后不再出这个词">已掌握，跳过</button></div>'
        : '<div class="hint"><span><kbd>Enter</kbd> 提交</span><span>空着按 <kbd>Enter</kbd> = 不会</span>' + (ss.mode === 'listen' ? '<span><kbd>Tab</kbd> 再听一遍</span>' : '') + '<button class="link" data-act="skipKnown" title="以后不再出这个词">已掌握，跳过</button></div>';
    const history = ss.results.length ? historyHtml(ss) : '<div class="h-empty">答过的词会一行一行留在这里</div>';
    return (
      '<main class="practice">' +
      '<div class="p-top"><span class="steps">' + stepsHtml(ss) + '<span class="book">' + esc(bookName(ss.bookId)) + '</span></span>' +
      '<span class="right"><span>' + (ss.between ? ss.items.length : ss.idx + 1) + ' / ' + ss.items.length + '</span><button class="link" data-act="quit">结束 Esc</button></span></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="history' + (ss.results.length ? '' : ' empty') + '" id="history">' + history + '</div>' +
      (ss.between ? '<section class="card"><div class="inner anim">' + betweenHtml(ss) + '</div></section></main>' : '') +
      (ss.between ? '' : '<section class="card"><div class="inner' + anim + '">' + promptHtml(ss, e) +
      inputs +
      (pend ? feedbackHtml(ss, pend) : hint) +
      '</div></section>' +
      '</main>')
    );
  };

  AFTER.practice = function () {
    const ss = ui.session;
    if (ss) {
      ss.animIdx = ss.idx;
      ss.animRow = ss.results.length;
    }
    const h = document.getElementById('history');
    if (h) h.scrollTop = h.scrollHeight;
    const input = document.getElementById('answer');
    if (input) input.focus();
  };

  // 这一轮里任何一步答错过的词，以及它在三步里各自的对错
  function wrongWords(ss) {
    const map = new Map();
    STAGES.forEach((_, i) => {
      stageAll(ss, i).forEach((r) => {
        const k = keyOf(r.entry.w);
        if (!map.has(k)) map.set(k, { entry: r.entry, marks: [], bad: false });
        const x = map.get(k);
        x.marks[i] = x.marks[i] === false ? false : r.ok;
        if (!r.ok) x.bad = true;
      });
    });
    return [...map.values()].filter((x) => x.bad);
  }

  // 结果页上「下一组」按钮的文字；没有下一组时返回空
  function nextLabel(ss) {
    if (ss.kind === 'root') return '';
    if (ss.kind === 'new' || ss.kind === 'retry') {
      const left = state.settings.goal - learnedToday();
      return left > 0 ? '下一组新词 · 今天还差 ' + left + ' 个' : '再背一组新词';
    }
    if (ss.kind === 'review') {
      const n = reviewPool().remaining.length;
      return n ? '继续复习 · 还剩 ' + n + ' 个' : '';
    }
    const n = available(Object.values(state.wrong)).length;
    return n ? '继续练错题本 · 还有 ' + n + ' 个' : '';
  }

  VIEWS.result = function () {
    const ss = ui.session;
    if (!ss) return VIEWS.home();
    const all = allResults(ss);
    const total = all.length;
    const right = all.filter((r) => r.ok).length;
    const wrong = wrongWords(ss);
    const stageLine = STAGES.map((k, i) => {
      const res = stageAll(ss, i);
      const reps = ss.retries.filter((x) => x.stage === i).length;
      return '<div><div class="num">' + (res.length ? res.filter((r) => r.ok).length + '<small> / ' + res.length + '</small>' : '—') + '</div><div class="cap">' + (i + 1) + ' · ' + MODES[k].name + (reps ? ' · 重来 ' + reps + ' 遍' : '') + '</div></div>';
    }).join('');
    const mark = (v, i) => '<span class="mk' + (v === true ? ' ok' : v === false ? ' bad' : '') + '" title="' + MODES[STAGES[i]].name + '">' + (v === true ? ICON_OK : v === false ? ICON_BAD : '·') + '</span>';
    const list = wrong.length
      ? '<div class="section"><div class="head-row"><p class="label">答错过的词 · ' + wrong.length + '</p><span class="muted">右边三个标记依次是 英→中、中→英、听→写</span></div>' +
        wrong
          .map(
            (x) =>
              '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(x.entry.w) + '">' + esc(x.entry.w) + (x.entry.p ? '<small>/' + esc(x.entry.p) + '/</small>' : '') + '</button>' +
              '<span class="m">' + meaningHtml(x.entry.m) + '</span><span class="side marks">' + [0, 1, 2].map((i) => mark(x.marks[i], i)).join('') + '</span></div>'
          )
          .join('') +
        '</div>'
      : '';
    const rate = total ? Math.round((right / total) * 100) : 0;
    const perfect = total > 0 && right === total;
    const word = perfect ? '全对，漂亮。' : rate >= 80 ? '很稳，错的几个再练一下就好。' : '错的词已经记进错题本，复习时还会出现。';
    return (
      '<main class="page">' +
      '<section class="result-hero' + (perfect ? ' perfect' : '') + '">' + (perfect ? BURST : '') +
      '<p class="label">' + (ss.ended ? '提前结束' : '本轮结束') + ' · ' + esc(bookName(ss.bookId)) + '</p>' +
      '<div class="score">' + right + '<small> / ' + total + '</small></div>' +
      '<p class="rate">正确率 ' + rate + '% · ' + word + '</p>' +
      '</section>' +
      '<div class="today stage-line">' + stageLine + '</div>' +
      '<div class="actions" style="margin-top:32px">' +
      (wrong.length ? '<button class="btn" data-act="retryWrong">再练错的 ' + wrong.length + ' 个 <kbd>R</kbd></button>' : '') +
      (nextLabel(ss) ? '<button class="btn ' + (wrong.length ? 'ghost' : '') + '" data-act="nextGroup">' + nextLabel(ss) + ' <kbd>Enter</kbd></button>' : '') +
      '<button class="link" data-act="nav" data-view="home">回首页</button>' +
      '</div>' + list +
      '</main>'
    );
  };

  function bookRowHtml(id, extra) {
    const list = bookEntries(id);
    const seen = seenCount(list);
    const pct = list.length ? (seen / list.length) * 100 : 0;
    const kind = findTerm(id) ? '专业词库' : findExam(id) ? '考试词库' : '我的词表';
    return (
      '<div class="book-row"><div><div class="kind">' + kind + '</div><div class="name">' + esc(bookName(id)) + '</div>' +
      '<div class="meta"><span>' + fmt(list.length) + ' 词</span><span>已背 ' + fmt(seen) + '</span><span class="prog"><i style="width:' + pct + '%"></i></span></div></div>' +
      '<div class="side">' + (extra || '') + '<button class="link" data-act="viewBook" data-id="' + esc(id) + '">查看</button><button class="btn small ghost" data-act="useBook" data-id="' + esc(id) + '">背这个</button></div></div>'
    );
  }

  VIEWS.books = function () {
    const mine = Object.values(state.books).sort((a, b) => a.t - b.t);
    return (
      '<main class="page">' +
      '<h1 class="h1">词库</h1>' +
      '<div class="section book-grid">' + allBooks().map((id) => bookRowHtml(id)).join('') + '</div>' +
      '<div class="section mine">' +
      '<div class="head-row"><h2 class="h2">我的词表</h2>' +
      '<div class="actions"><button class="btn small" data-act="newImport">＋ 粘贴单词</button>' +
      '<label class="btn small ghost file-pick">上传文件<input type="file" id="upload-book" accept=".txt,.csv,.tsv,.json,text/plain,text/csv,application/json"></label></div></div>' +
      '<p class="sub">把自己要背的单词做成词表：直接粘贴，或者上传 .txt、.csv 文件（Excel 可以另存为 .csv）。只写英文也行，常见词会自动补上中文意思。</p>' +
      (mine.length
        ? '<div class="book-grid">' + mine.map((b) => bookRowHtml(b.id, '<button class="link" data-act="deleteBook" data-id="' + esc(b.id) + '">删除</button>')).join('') + '</div>'
        : '<div class="empty">还没有自己的词表。</div>') +
      '</div>' +
      '</main>'
    );
  };

  function bookRowsHtml() {
    const id = ui.book.id;
    const all = bookEntries(id);
    const q = ui.book.q.trim().toLowerCase();
    const list = q ? all.filter((e) => e.w.toLowerCase().includes(q) || String(e.m).includes(q)) : all;
    const custom = !isBuiltin(id) && id !== WRONG_BOOK;
    const shown = list.slice(0, ui.book.limit);
    if (!list.length) return '<div class="empty">' + (q ? '没有找到「' + esc(q) + '」' : '这个词表还没有词') + '</div>';
    return (
      shown
        .map((e) => {
          const k = keyOf(e.w);
          const s = state.stats[k];
          const tag = e.t ? '<span>' + esc(e.t) + '</span>' : '';
          const known = state.known[k] ? '<span>已掌握</span>' : '';
          return (
            '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + (e.p ? '<small>/' + esc(e.p) + '/</small>' : '') + '</button>' +
            '<span class="m">' + (meaningHtml(e.m) || '（没有释义）') + '</span>' +
            '<span class="side">' + tag + (known || (s ? '<span>已背</span>' : '')) + (custom ? '<button class="link" data-act="deleteWord" data-w="' + esc(e.w) + '">删除</button>' : '') + '</span></div>'
          );
        })
        .join('') +
      (list.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRows">再显示 200 个（还有 ' + fmt(list.length - shown.length) + ' 个）</button></div>' : '')
    );
  }

  VIEWS.book = function () {
    const id = ui.book.id;
    if (!bookExists(id)) return VIEWS.books();
    const custom = !isBuiltin(id);
    return (
      '<main class="page">' +
      '<p class="label"><button class="link" data-act="nav" data-view="books">← 词库</button></p>' +
      '<h1 class="h1">' + esc(bookName(id)) + '</h1>' +
      '<p class="sub">' + fmt(bookEntries(id).length) + ' 词 · 点单词可以听发音</p>' +
      '<div class="actions"><button class="btn small" data-act="useBook" data-id="' + esc(id) + '">背这个词表</button>' +
      (custom ? '<button class="btn small ghost" data-act="appendImport" data-id="' + esc(id) + '">添加单词</button><button class="link" data-act="renameBook" data-id="' + esc(id) + '">改名</button>' : '') +
      '<button class="link" data-act="exportBook" data-id="' + esc(id) + '">导出为表格</button>' +
      '</div>' +
      '<div class="section"><input class="field" id="book-q" placeholder="搜索单词或中文" value="' + esc(ui.book.q) + '" autocomplete="off"></div>' +
      '<div class="section" id="book-rows">' + bookRowsHtml() + '</div>' +
      '</main>'
    );
  };

  function previewHtml() {
    const d = ui.draft;
    if (!d || !d.text.trim()) return '<span class="muted">粘贴后这里会显示识别结果。</span>';
    const r = parseImport(d.text);
    let s = '识别到 <b>' + r.words.length + '</b> 个词';
    if (r.filled) s += '，其中 ' + r.filled + ' 个自动补上了中文意思';
    s += '。';
    if (r.missing.length) {
      s += '<br><span class="muted">' + r.missing.length + ' 个词没有中文意思，也没查到（' + esc(r.missing.slice(0, 5).map((e) => e.w).join('、')) + (r.missing.length > 5 ? ' 等' : '') + '），这些词只能用「听 → 写」练。</span>';
    }
    if (r.bad.length) s += '<br><span class="muted">' + r.bad.length + ' 行看不出英文单词，已跳过（' + esc(r.bad.slice(0, 3).join('、')) + '）。</span>';
    return s;
  }

  VIEWS.import = function () {
    const d = ui.draft;
    const target = d.target && state.books[d.target];
    return (
      '<main class="page">' +
      '<p class="label"><button class="link" data-act="nav" data-view="books">← 词库</button></p>' +
      '<h1 class="h1">' + (target ? '添加到「' + esc(target.name) + '」' : '导入新词表') + '</h1>' +
      '<p class="sub">把单词粘贴到下面，一行一个。只写英文也行，常见词会自动补上中文意思。</p>' +
      (target ? '' : '<div class="section" style="margin-top:0"><p class="label">词表名称</p><input class="field" id="draft-name" value="' + esc(d.name) + '" autocomplete="off"></div>') +
      '<div class="section grid2" style="grid-template-columns: 1.6fr 1fr">' +
      '<div><p class="label">单词</p><textarea class="paste" id="draft-text" placeholder="abandon 放弃&#10;benefit n. 好处；利益&#10;candidate&#10;moral hazard 道德风险">' + esc(d.text) + '</textarea>' +
      '<div class="preview" id="draft-preview">' + previewHtml() + '</div></div>' +
      '<div><p class="label">支持的格式</p><div class="formats">' +
      '<b>abandon 放弃</b><br><b>abandon	v. 放弃</b><br>从 Excel 复制两列也行<br><br>' +
      '<b>abandon /əˈbændən/ v. 放弃</b><br>带音标、词性<br><br>' +
      '<b>abandon</b><br>只写单词，自动查意思<br><br>' +
      '<b>moral hazard 道德风险</b><br>词组也可以' +
      '</div>' +
      '<p style="margin-top:20px"><label class="file-pick link">或者选一个 .txt / .csv 文件<input type="file" id="draft-file" accept=".txt,.csv,.tsv,.json,text/plain,text/csv,application/json"></label></p>' +
      '</div></div>' +
      '<div class="actions" style="margin-top:40px"><button class="btn" data-act="saveImport">保存</button><button class="link" data-act="nav" data-view="books">取消</button></div>' +
      '</main>'
    );
  };

  AFTER.import = function () {
    const t = document.getElementById('draft-text');
    if (t && !ui.draft.text) t.focus();
  };

  VIEWS.wrong = function () {
    const list = Object.values(state.wrong).sort((a, b) => b.n - a.n || b.t - a.t);
    const known = Object.values(state.known).sort((a, b) => b.t - a.t);
    const knownHtml =
      '<div class="section"><div class="head-row"><p class="label">已掌握 · ' + known.length + ' 词</p></div>' +
      (known.length
        ? known
            .map(
              (e) =>
                '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + '</button>' +
                '<span class="m">' + meaningHtml(e.m) + '</span>' +
                '<span class="side"><button class="link" data-act="unknow" data-w="' + esc(e.w) + '">恢复</button></span></div>'
            )
            .join('')
        : '<div class="empty">背诵时点「已掌握，跳过」，这个词以后就不会再出现，会列在这里。</div>') +
      '</div>';
    return (
      '<main class="page">' +
      '<h1 class="h1">错题本</h1><p class="sub">答错的词会记在这里，每天的复习里都会有；一轮里每一步都答对，就自动移出。</p>' +
      (list.length
        ? '<div class="actions"><button class="btn" data-act="practiceWrong">练习错题本 · ' + list.length + ' 词</button><button class="link" data-act="exportBook" data-id="' + WRONG_BOOK + '">导出为表格</button><button class="link" data-act="clearWrong">清空错题本</button></div>' +
          '<div class="section">' +
          list
            .map(
              (e) =>
                '<div class="list-row"><button class="w" data-act="speakWord" data-w="' + esc(e.w) + '">' + esc(e.w) + (e.p ? '<small>/' + esc(e.p) + '/</small>' : '') + '</button>' +
                '<span class="m">' + meaningHtml(e.m) + '</span>' +
                '<span class="side"><span>错 ' + e.n + ' 次</span><button class="link" data-act="removeWrong" data-w="' + esc(e.w) + '">移出</button></span></div>'
            )
            .join('') +
          '</div>'
        : '<div class="empty">错题本是空的。</div>') +
      knownHtml +
      '</main>'
    );
  };

  function chipsHtml(key, options) {
    const cur = state.settings[key];
    return (
      '<div class="chips">' +
      options.map(([val, label]) => '<button class="chip' + (cur === val ? ' on' : '') + '" data-act="setting" data-key="' + key + '" data-val="' + esc(JSON.stringify(val)) + '">' + label + '</button>').join('') +
      '</div>'
    );
  }

  VIEWS.settings = function () {
    return (
      '<main class="page">' +
      '<h1 class="h1">设置</h1><p class="sub">改动会自动保存。</p>' +
      '<div class="section panel set-list">' +
      '<div class="set-row"><div><div class="t">发音口音</div></div><div>' + chipsHtml('accent', [['us', '美式'], ['uk', '英式']]) + '</div></div>' +
      '<div class="set-row"><div><div class="t">发音来源</div></div><div>' +
      chipsHtml('voice', [['auto', '真人发音'], ['browser', '电脑语音']]) +
      '<div class="d">真人发音来自有道词典，需要联网；连不上时会自动改用电脑自带的语音。电脑语音不用联网，但效果取决于你的系统。</div>' +
      '<div class="actions" style="margin-top:12px"><button class="btn small ghost" data-act="testVoice">试听</button></div></div></div>' +
      '<div class="set-row"><div><div class="t">读音</div></div><div class="d" style="margin-top:0">「英 → 中」和「听 → 写」出词时自动朗读，按 Tab 再听一遍；「中 → 英」不出声。</div></div>' +
      '<div class="set-row"><div><div class="t">每组几个词</div></div><div>' + chipsHtml('size', [[5, '5'], [10, '10'], [15, '15'], [20, '20']]) + '</div></div>' +
      '<div class="set-row"><div><div class="t">强制全对</div></div><div>' + chipsHtml('forceAll', [[true, '开'], [false, '关']]) +
      '<div class="d">背单词和词根时，一组词在某一步（如「英 → 中」）只要错一个，这一步做完后整组再来一遍，直到全对才进入下一步。</div></div></div>' +
      '<div class="set-row"><div><div class="t">拼错后照打一遍</div></div><div>' + chipsHtml('copyWrong', [[true, '开'], [false, '关']]) +
      '<div class="d">拼写题答错后，照着正确拼写再打一遍，免得记住错的拼法。直接按 Enter 可以跳过。</div></div></div>' +
      '<div class="set-row"><div><div class="t">字母个数提示</div></div><div>' + chipsHtml('letterHint', [[true, '显示'], [false, '不显示']]) +
      '<div class="d">拼写题下面显示 _ _ _ _，提示单词有几个字母。</div></div></div>' +
      '<div class="set-row"><div><div class="t">宠物在页面上走动</div></div><div>' + chipsHtml('petRoam', [[true, '开'], [false, '关']]) +
      '<div class="d">陪你背单词的宠物在页面上走动、说话。</div></div></div>' +
      '<div class="set-row"><div><div class="t">外观</div></div><div>' + chipsHtml('theme', [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']]) + '</div></div>' +
      '<div class="set-row"><div><div class="t">字体粗细</div></div><div>' + chipsHtml('weight', [['light', '细'], ['normal', '标准'], ['bold', '粗']]) +
      '<div class="d">仿宋本身笔画比较细，觉得还是细就选「粗」。</div></div></div>' +
      (!/^https?:$/.test(location.protocol)
        ? ''
        : '<div class="set-row"><div><div class="t">下载到电脑</div></div><div><a class="btn small ghost" href="Margin.html" download="Marginal Vocabulary.html">下载 Marginal Vocabulary.html</a>' +
          '<div class="d">下载后双击就能打开，不用联网。进度不会自动带过去，需要的话先导出备份，再在下载的版本里导入。</div></div></div>') +
      updateSettingHtml() +
      '<div class="set-row"><div><div class="t">数据备份</div><div class="d">进度只保存在这台电脑的这个浏览器里。</div></div><div>' +
      '<div class="actions"><button class="btn small" data-act="exportData">导出备份</button>' +
      '<label class="btn small ghost file-pick">导入备份<input type="file" id="backup-file" accept=".json,application/json"></label>' +
      '<button class="link" data-act="resetAll">清空所有数据</button></div>' +
      '<div class="d">换电脑、换浏览器或清理浏览器数据之前，先导出备份；到新地方打开 Marginal Vocabulary 后再导入。</div></div></div>' +
      '<div class="set-row"><div><div class="t">关于</div></div><div class="d" style="margin-top:0">Marginal Vocabulary · 背单词工具。<br>Finance、MacroFin、Medicine 词库和词根由 Marginal Vocabulary 整理，译名参考国内通行教材和标准术语；发现不准欢迎到 GitHub 反馈。<br>CET-4、CET-6、GEE、TOEFL、IELTS、GRE、GMAT 词库与音标来自开源词典 ECDICT（MIT 许可证）。</div></div>' +
      '</div>' +
      '</main>'
    );
  };

  // ================= 词根 =================

  // 词根的学习和背单词是并列的另一套：选词库、每天学几个，每组依次过三步
  const ROOT_STAGES = ['r2m', 'm2r', 'fill'];
  const ROOT_MODES = {
    r2m: { name: '根 → 义', desc: '看词根，选意思' },
    m2r: { name: '义 → 根', desc: '看意思，选词根' },
    fill: { name: '填词根', desc: '在单词里填出词根' },
  };
  const ROOT_GROUP = 5; // 每组几个词根

  function rootForms(r) {
    return r.forms.map((f) => (r.type === 'prefix' ? f + '-' : r.type === 'suffix' ? '-' + f : f)).join(' / ');
  }

  function rootBook() {
    const s = state.settings;
    if (s.rootBook !== 'all' && (!bookExists(s.rootBook) || s.rootBook === WRONG_BOOK || s.rootBook === REVIEW_BOOK)) s.rootBook = 'all';
    return s.rootBook;
  }

  function rootBookName(id) {
    return id === 'all' ? '全部词库' : bookName(id);
  }

  // 词根 id -> 这个词库里含这个词根的词 [{ e, tok, p, fill }]；fill 是能用来「填词根」的位置
  const rootIdxCache = {};
  function rootIndex(bookId) {
    const custom = bookId !== 'all' && !isBuiltin(bookId);
    if (!custom && rootIdxCache[bookId]) return rootIdxCache[bookId];
    const entries = bookId === 'all' ? EXAM_WORDS.concat(...TERM_BOOKS.map((b) => TERM_WORDS[b.id])) : bookEntries(bookId);
    const idx = new Map();
    const seen = new Set();
    for (const e of entries) {
      const k = keyOf(e.w);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const toks = k.split(/[^a-z]+/).filter(Boolean);
      const got = new Set();
      for (const t of toks) {
        const p = partsOf(t);
        if (!p) continue;
        const exact = toks.length === 1 && p.w.toLowerCase() === t;
        for (const l of p.links) {
          if (got.has(l.id)) continue;
          got.add(l.id);
          if (!idx.has(l.id)) idx.set(l.id, []);
          const fill = exact && l.at >= 0 && t.substr(l.at, l.form.length) === l.form && l.form.length >= 2 && l.form.length < t.length ? l : null;
          idx.get(l.id).push({ e, tok: t, p, fill });
        }
      }
    }
    if (!custom) rootIdxCache[bookId] = idx;
    return idx;
  }

  // 这个词库里用得到的词根，用到的词越多越靠前（也是学新词根的顺序）
  function rootsOfBook(bookId) {
    const idx = rootIndex(bookId);
    const n = (r) => (idx.get(r.id) || []).length;
    const list = bookId === 'all' ? ROOTS.slice() : ROOTS.filter((r) => n(r) > 0);
    return list.sort((a, b) => n(b) - n(a));
  }

  function learnedRootsToday() {
    const today = dayNum();
    let n = 0;
    for (const id in state.rootStats) if (state.rootStats[id].f === today) n++;
    return n;
  }

  // 词根复习：昨天学的新词根 + 答错过的词根。今天复习过的不再出现
  function rootReviewPool() {
    const today = dayNum();
    const done = (state.rootLog[todayKey()] || {}).rv || [];
    const doneSet = new Set(done);
    const ids = new Set();
    for (const id in state.rootStats) if (state.rootStats[id].f === today - 1) ids.add(id);
    for (const id in state.rootWrong) ids.add(id);
    const remaining = [...ids].filter((id) => ROOT_BY_ID.has(id) && !doneSet.has(id)).map((id) => ROOT_BY_ID.get(id));
    return { done: done.length, remaining };
  }

  function markRootReviewed(id) {
    const k = todayKey();
    const day = state.rootLog[k] || (state.rootLog[k] = { rv: [] });
    if (!day.rv.includes(id)) day.rv.push(id);
  }

  // 意思是否相近：有一个词相同就算，出选择题时不放在一起
  function sameMeaning(a, b) {
    const ta = a.split(/[，,；;、\s]+/).filter(Boolean);
    const tb = new Set(b.split(/[，,；;、\s]+/).filter(Boolean));
    return ta.some((t) => tb.has(t));
  }

  function distractors(r) {
    const pick = [];
    const pools = [rootsOfBook(rootBook()).filter((x) => x.type === r.type), ROOTS.filter((x) => x.type === r.type), ROOTS];
    for (const pool of pools) {
      for (const x of shuffle(pool.slice())) {
        if (pick.length >= 3) break;
        if (x === r || sameMeaning(x.meaning, r.meaning) || pick.some((y) => y === x || sameMeaning(y.meaning, x.meaning))) continue;
        if (x.forms.some((f) => r.forms.includes(f))) continue;
        pick.push(x);
      }
      if (pick.length >= 3) break;
    }
    return pick;
  }

  function rootQuestion(x, mode) {
    const q = { r: x.r, x, mode };
    if (mode !== 'fill') {
      const options = shuffle([x.r].concat(distractors(x.r)));
      q.options = options.map((o) => (mode === 'r2m' ? o.meaning : rootForms(o)));
      q.correct = options.indexOf(x.r);
    }
    return q;
  }

  function startRootNew() {
    const book = rootBook();
    const left = state.settings.rootGoal - learnedRootsToday();
    const n = left > 0 ? Math.min(ROOT_GROUP, left) : ROOT_GROUP;
    const fresh = rootsOfBook(book).filter((r) => !state.rootStats[r.id]);
    if (!fresh.length) {
      toast('这个词库的词根都学过了，换一个词库吧');
      return;
    }
    startRootSession(fresh.slice(0, n), 'new');
  }

  function startRootReview() {
    const { remaining } = rootReviewPool();
    if (!remaining.length) {
      toast('今天的词根复习做完了');
      return;
    }
    startRootSession(shuffle(remaining.slice()).slice(0, ROOT_GROUP), 'review');
  }

  function startRootSession(roots, kind) {
    const book = rootBook();
    const idx = rootIndex(book);
    const pickFill = (list) => {
      const ok = (list || []).filter((w) => w.fill);
      return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
    };
    const items = roots.map((r) => {
      const words = idx.get(r.id) || [];
      return { r, words, target: pickFill(words) || (book === 'all' ? null : pickFill(rootIndex('all').get(r.id))) };
    });
    ui.rs = { kind, book, roots: items, stage: -1, mode: null, items: [], idx: 0, pick: null, ok: null, results: [], stageResults: [], retries: [], repeat: false, attempt: 1, between: false, done: false, ended: false };
    beginRootStage(0);
    go('rootquiz');
    petJoinStudy();
  }

  function nextRootStage(rs, from) {
    for (let i = from; i < ROOT_STAGES.length; i++) {
      if (ROOT_STAGES[i] !== 'fill' || rs.roots.some((x) => x.target)) return i;
    }
    return -1;
  }

  function beginRootStage(i) {
    const rs = ui.rs;
    const stage = nextRootStage(rs, i);
    if (stage < 0) return finishRootSession();
    const mode = ROOT_STAGES[stage];
    rs.attempt = stage === rs.stage ? rs.attempt + 1 : 1;
    rs.repeat = false;
    rs.stage = stage;
    rs.mode = mode;
    rs.items = shuffle(rs.roots.filter((x) => mode !== 'fill' || x.target).map((x) => rootQuestion(x, mode)));
    rs.idx = 0;
    rs.pick = null;
    rs.results = [];
    rs.between = false;
  }

  function rootAnswer(n) {
    const rs = ui.rs;
    if (!rs || rs.between || rs.done || rs.pick !== null || rs.mode === 'fill') return;
    const q = rs.items[rs.idx];
    if (n < 0 || n >= q.options.length) return;
    recordRoot(q, n === q.correct, n);
  }

  function recordRoot(q, ok, pick) {
    const rs = ui.rs;
    rs.pick = pick;
    rs.ok = ok;
    rs.results.push({ r: q.r, ok });
    const today = dayNum();
    const st = state.rootStats[q.r.id] || (state.rootStats[q.r.id] = { r: 0, w: 0, f: today });
    const again = !ok && st.w > 0;
    st[ok ? 'r' : 'w']++;
    st.d = today;
    rewardAnswer(rs, ok, again);
    if (rs.kind === 'review') markRootReviewed(q.r.id);
    save();
    render();
    if (q.mode === 'fill') speak(q.x.target.tok);
  }

  function rootNextLabel(rs) {
    if (rs.kind === 'new') {
      const left = state.settings.rootGoal - learnedRootsToday();
      return left > 0 ? '下一组新词根 · 今天还差 ' + left + ' 个' : '再学一组新词根';
    }
    const n = rootReviewPool().remaining.length;
    return n ? '继续复习 · 还剩 ' + n + ' 个' : '';
  }

  function rootNext() {
    const rs = ui.rs;
    if (!rs) return;
    if (rs.done) {
      if (rootNextLabel(rs)) {
        if (rs.kind === 'new') startRootNew();
        else startRootReview();
      } else go('roots');
      return;
    }
    if (rs.between) {
      if (rs.repeat) {
        // 强制全对：没通过的这一遍记下来，这一步再来一遍
        rs.retries.push({ stage: rs.stage, results: rs.results });
        rs.stageResults[rs.stage] = null;
        beginRootStage(rs.stage);
      } else beginRootStage(rs.stage + 1);
      render();
      return;
    }
    const q = rs.items[rs.idx];
    if (rs.pick === null) {
      if (rs.mode === 'fill') {
        const input = document.getElementById('rq-answer');
        const v = (input ? input.value : '').trim().toLowerCase();
        recordRoot(q, v === q.x.target.fill.form, v);
      }
      return;
    }
    rs.idx++;
    rs.pick = null;
    if (rs.idx >= rs.items.length) {
      rs.stageResults[rs.stage] = rs.results;
      if (state.settings.forceAll && rs.results.some((x) => !x.ok)) {
        rs.repeat = true;
        rs.between = true;
        setTimeout(() => petSay('repeat'), 50);
      } else if (nextRootStage(rs, rs.stage + 1) >= 0) {
        rs.between = true;
        const allOk = rs.results.every((x) => x.ok);
        setTimeout(() => petSay(allOk ? 'stagePerfect' : 'stage'), 50);
      } else return finishRootSession();
    }
    render();
  }

  // 一组结束：这一组里每一步都答对的词根移出错题，答错过的记进去
  function finishRootSession() {
    const rs = ui.rs;
    rs.done = true;
    rs.between = false;
    const all = rootAll(rs);
    for (const x of rs.roots) {
      const mine = all.filter((y) => y.r === x.r);
      if (!mine.length) continue;
      if (mine.some((y) => !y.ok)) state.rootWrong[x.r.id] = Date.now();
      else if (!rs.ended) delete state.rootWrong[x.r.id];
    }
    if (all.length) rewardGroup('root', rs.roots.length, !rs.ended && all.every((y) => y.ok), rs.ended);
    save();
    if (!all.length) {
      ui.rs = null;
      go('roots');
      return;
    }
    render();
  }

  function rootAll(rs) {
    return [].concat(...rs.stageResults.filter(Boolean), ...rs.retries.map((x) => x.results));
  }

  function rootStageAll(rs, i) {
    return [].concat(...rs.retries.filter((x) => x.stage === i).map((x) => x.results), rs.stageResults[i] || []);
  }

  function quitRootSession() {
    const rs = ui.rs;
    if (!rs || rs.done) return go('roots');
    if (!rs.between) rs.stageResults[rs.stage] = rs.results;
    rs.ended = true;
    finishRootSession();
  }

  // ---------- 词根首页 ----------

  function rootList() {
    const q = ui.roots.q.trim().toLowerCase().replace(/^-+|-+$/g, '');
    let list = rootsOfBook(rootBook());
    if (ui.roots.type !== 'all') list = list.filter((r) => r.type === ui.roots.type);
    if (!q) return list;
    const rank = (r) => (r.forms.includes(q) ? 0 : r.forms.some((f) => f.startsWith(q)) ? 1 : 2);
    return list
      .filter((r) => r.forms.some((f) => f.includes(q)) || r.meaning.includes(q) || r.examples.some((x) => x.w.toLowerCase().includes(q)))
      .sort((a, b) => rank(a) - rank(b));
  }

  function rootRowsHtml() {
    const list = rootList();
    const q = ui.roots.q.trim();
    if (!list.length) return '<div class="empty">' + (q ? '没有找到「' + esc(q) + '」' : '这个词库里没有用到这类词根') + '</div>';
    const idx = rootIndex(rootBook());
    const shown = list.slice(0, ui.roots.limit);
    return (
      shown
        .map((r) => {
          const n = (idx.get(r.id) || []).length;
          return (
            '<button class="list-row root-row" data-act="viewRoot" data-id="' + esc(r.id) + '">' +
            '<span class="w">' + esc(rootForms(r)) + '</span>' +
            '<span class="m">' + esc(r.meaning) + '</span>' +
            '<span class="side"><span>' + ROOT_TYPES[r.type] + '</span>' + (n ? '<span>' + fmt(n) + ' 词</span>' : '') + (state.rootStats[r.id] ? '<span>已学</span>' : '') + '</span></button>'
          );
        })
        .join('') +
      (list.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRoots">再显示 200 个（还有 ' + fmt(list.length - shown.length) + ' 个）</button></div>' : '')
    );
  }

  function rootBookOptionsHtml(selected) {
    const opt = (id) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(rootBookName(id)) + '</option>';
    const mine = Object.values(state.books).sort((a, b) => a.t - b.t).map((b) => b.id);
    return ['all'].concat(allBooks(), mine).map(opt).join('');
  }

  VIEWS.roots = function () {
    const s = state.settings;
    const book = rootBook();
    const inBook = rootsOfBook(book);
    const learned = learnedRootsToday();
    const studied = inBook.filter((r) => state.rootStats[r.id]).length;
    const rv = rootReviewPool();
    const rvTotal = rv.done + rv.remaining.length;
    const left = s.rootGoal - learned;
    const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 100);
    const types = [['all', '全部'], ['prefix', '前缀'], ['root', '词根'], ['suffix', '后缀']];
    const title = left <= 0 ? '今天的词根学完了' : learned ? '还差 ' + left + ' 个词根' : '今天学 ' + s.rootGoal + ' 个词根';
    return (
      '<main class="page">' +
      '<p class="label">词根 · ' + esc(rootBookName(book)) + ' 用到 ' + fmt(inBook.length) + ' 个词根词缀</p>' +
      '<section class="hero' + (left <= 0 ? ' done' : '') + '">' +
      '<div class="hero-main"><p class="label">今日词根</p>' +
      '<h1 class="h1">' + title + '</h1><p class="sub">每组 ' + ROOT_GROUP + ' 个，过三步：根 → 义、义 → 根、填词根。</p>' +
      '<div class="actions"><button class="btn big" data-act="startRootNew">' + (left > 0 ? '学新词根' : '再学一组') + ' <kbd>Enter</kbd></button></div></div>' +
      ringHtml(learned, s.rootGoal, '词根') +
      '</section>' +
      '<div class="tasks">' +
      '<div class="task"><p class="label">复习</p>' +
      '<div class="num">' + fmt(rv.done) + '<small> / ' + fmt(rvTotal) + '</small></div>' +
      '<div class="bar"><i style="width:' + pct(rv.done, rvTotal) + '%"></i></div>' +
      '<p class="muted">昨天的新词根和答错过的词根</p>' +
      '<button class="btn ghost" data-act="startRootReview"' + (rv.remaining.length ? '' : ' disabled') + '>' + (rv.remaining.length ? '开始复习 <kbd>R</kbd>' : rvTotal ? '复习完了' : '今天没有要复习的词根') + '</button></div>' +
      '<div class="task"><p class="label">学什么</p>' +
      '<div class="pref"><span class="t">词库</span><label class="select"><select data-act="setRootBook" aria-label="词库">' + rootBookOptionsHtml(book) + '</select></label></div>' +
      '<div class="pref"><span class="t">每天学几个词根</span>' + chipsHtml('rootGoal', [5, 10, 20, 30].map((n) => [n, String(n)])) + '</div>' +
      '<div class="bar wide"><i style="width:' + pct(studied, inBook.length) + '%"></i></div>' +
      '<p class="muted">这个词库用到的词根已学 ' + fmt(studied) + ' / ' + fmt(inBook.length) + '</p></div>' +
      '</div>' +
      '<div class="section"><h2 class="h2">查词根</h2>' +
      '<div class="chips" style="margin-top:20px">' +
      types.map(([v, label]) => '<button class="chip' + (ui.roots.type === v ? ' on' : '') + '" data-act="rootType" data-type="' + v + '">' + label + '</button>').join('') +
      '</div>' +
      '<input class="field roots-q" id="roots-q" placeholder="搜索词根、意思或单词" value="' + esc(ui.roots.q) + '" autocomplete="off" spellcheck="false"></div>' +
      '<div class="section root-list" id="root-rows">' + rootRowsHtml() + '</div>' +
      '</main>'
    );
  };

  // ---------- 词根详情 ----------

  function rootWordRow(w, parts, m) {
    const e = LOOKUP.get(w.toLowerCase());
    return (
      '<div class="list-row ex-row"><button class="w" data-act="speakWord" data-w="' + esc(w) + '">' + esc(w) + (e && e.p && !/\s/.test(w) ? '<small>/' + esc(e.p) + '/</small>' : '') + '</button>' +
      '<span class="m"><span class="parts">' + esc(parts) + '</span><span class="ex-m">' + esc(m) + '</span></span></div>'
    );
  }

  // 词组只显示含这个词根的那个词的拆解
  function bookWordRow(x) {
    const phrase = /\s/.test(x.e.w);
    return rootWordRow(x.e.w, (phrase ? x.tok + ' = ' : '') + x.p.parts, shortMeaning(x.e.m));
  }

  VIEWS.root = function () {
    let list = rootList();
    let i = list.findIndex((r) => r.id === ui.roots.id);
    if (i < 0) {
      list = ROOTS;
      i = list.findIndex((r) => r.id === ui.roots.id);
    }
    if (i < 0) return VIEWS.roots();
    const r = list[i];
    const book = rootBook();
    const words = rootIndex(book).get(r.id) || [];
    const shown = words.slice(0, ui.roots.wordLimit);
    const st = state.rootStats[r.id];
    const step = (x, label) => (x ? '<button class="link" data-act="viewRoot" data-id="' + esc(x.id) + '">' + label + '</button>' : '<span></span>');
    return (
      '<main class="page">' +
      '<p class="label"><button class="link" data-act="nav" data-view="roots">← 词根</button></p>' +
      '<p class="label root-type">' + ROOT_TYPES[r.type] + (st ? ' · 答对 ' + st.r + ' 次 · 答错 ' + st.w + ' 次' : '') + '</p>' +
      '<h1 class="root-forms">' + esc(rootForms(r)) + '</h1>' +
      '<div class="root-mean">' + esc(r.meaning) + '</div>' +
      (r.origin ? '<p class="root-origin">' + esc(r.origin) + '</p>' : '') +
      (r.note ? '<p class="root-note">' + esc(r.note) + '</p>' : '') +
      '<div class="section"><div class="head-row"><p class="label">例词</p><span class="muted">点单词听发音</span></div>' +
      r.examples.map((x) => rootWordRow(x.w, x.parts, x.m)).join('') + '</div>' +
      (book !== 'all'
        ? '<div class="section"><div class="head-row"><p class="label">' + esc(rootBookName(book)) + ' 里的词 · ' + fmt(words.length) + '</p>' +
          (words.length ? '<button class="btn small ghost" data-act="studyRootWords">背这些词</button>' : '') + '</div>' +
          (words.length ? shown.map(bookWordRow).join('') : '<div class="empty">这个词库里没有含这个词根的词。</div>') +
          (words.length > shown.length ? '<div class="actions" style="margin-top:20px"><button class="btn small ghost" data-act="moreRootWords">再显示 50 个（还有 ' + fmt(words.length - shown.length) + ' 个）</button></div>' : '') +
          '</div>'
        : '') +
      '<div class="root-steps">' + step(list[i - 1], '← ' + esc(list[i - 1] ? rootForms(list[i - 1]) : '')) + step(list[i + 1], esc(list[i + 1] ? rootForms(list[i + 1]) : '') + ' →') + '</div>' +
      '</main>'
    );
  };

  // 用背单词的三步，背这个词库里含这个词根的词（没背过的优先）
  function studyRootWords() {
    const words = rootIndex(rootBook()).get(ui.roots.id) || [];
    const list = available(words.map((x) => x.e));
    if (!list.length) {
      toast('这些词都标记为已掌握了');
      return;
    }
    const fresh = list.filter((e) => !state.stats[keyOf(e.w)]);
    const pick = (fresh.length ? fresh : list).slice(0, state.settings.size);
    startSession(shuffle(pick.slice()), rootBook() === 'all' ? null : rootBook(), 'root');
  }

  // ---------- 词根练习 ----------

  function rootStepsHtml(rs) {
    return ROOT_STAGES.map((k, i) => '<span class="step' + (i === rs.stage ? ' on' : i < rs.stage ? ' done' : '') + '">' + (i + 1) + ' ' + ROOT_MODES[k].name + (i === rs.stage && rs.attempt > 1 ? ' · 第 ' + rs.attempt + ' 遍' : '') + '</span>').join('');
  }

  // 答完以后显示：词根、来源，再列几个这个词库里的词
  function rootAfterHtml(q) {
    const r = q.r;
    const words = q.x.words.filter((w) => !/\s/.test(w.e.w)).slice(0, 3);
    const rows = words.length ? words.map(bookWordRow).join('') : r.examples.slice(0, 3).map((x) => rootWordRow(x.w, x.parts, x.m)).join('');
    return (
      '<div class="rq-after">' +
      '<p class="rq-root"><b>' + esc(rootForms(r)) + '</b>　' + esc(r.meaning) + (r.origin ? '<span class="root-origin">' + esc(r.origin) + '</span>' : '') + '</p>' +
      '<div class="rq-words">' + rows + '</div>' +
      '<div class="actions" style="justify-content:center;margin-top:20px"><button class="btn small" data-act="rootNext">继续 <kbd>Enter</kbd></button></div></div>'
    );
  }

  function rootPromptHtml(rs, q) {
    const r = q.r;
    const answered = rs.pick !== null;
    if (q.mode === 'fill') {
      const f = q.x.target;
      const t = f.tok;
      const at = f.fill.at;
      const len = f.fill.form.length;
      const gap = answered ? '<u class="gap-ans">' + esc(t.substr(at, len)) + '</u>' : '<span class="gap">' + '_'.repeat(len) + '</span>';
      return (
        '<div class="prompt-word">' + esc(t.slice(0, at)) + gap + esc(t.slice(at + len)) + '</div>' +
        '<div class="rq-hint">' + esc(shortMeaning(f.e.m)) + ' · 空格里的' + ROOT_TYPES[r.type] + '意思是「' + esc(r.meaning) + '」</div>' +
        '<input id="rq-answer" class="answer en' + (answered && !rs.ok ? ' wrong' : '') + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"' +
        (answered ? ' readonly value="' + esc(rs.pick) + '"' : ' placeholder="填词根"') + '>'
      );
    }
    if (q.mode === 'r2m') {
      const hint = q.x.words.filter((w) => !/\s/.test(w.e.w)).slice(0, 3).map((w) => w.e.w);
      const words = hint.length ? hint : r.examples.slice(0, 3).map((x) => x.w);
      return '<p class="label">' + ROOT_TYPES[r.type] + '</p><div class="prompt-word">' + esc(rootForms(r)) + '</div><div class="rq-hint">' + esc(words.join(' · ')) + '</div>';
    }
    return '<p class="label">' + ROOT_TYPES[r.type] + '</p><div class="prompt-mean">' + esc(r.meaning) + '</div>';
  }

  function rootQuizResultHtml(rs) {
    const all = rootAll(rs);
    const right = all.filter((x) => x.ok).length;
    const stageLine = ROOT_STAGES.map((k, i) => {
      const res = rootStageAll(rs, i);
      const reps = rs.retries.filter((x) => x.stage === i).length;
      return '<div><div class="num">' + (res.length ? res.filter((x) => x.ok).length + '<small> / ' + res.length + '</small>' : '—') + '</div><div class="cap">' + (i + 1) + ' · ' + ROOT_MODES[k].name + (reps ? ' · 重来 ' + reps + ' 遍' : '') + '</div></div>';
    }).join('');
    const mark = (r, i) => {
      const xs = rootStageAll(rs, i).filter((y) => y.r === r);
      const v = !xs.length ? null : xs.every((y) => y.ok);
      return '<span class="mk' + (v === true ? ' ok' : v === false ? ' bad' : '') + '" title="' + ROOT_MODES[ROOT_STAGES[i]].name + '">' + (v === null ? '·' : v ? ICON_OK : ICON_BAD) + '</span>';
    };
    const next = rootNextLabel(rs);
    return (
      '<main class="page rq">' +
      '<section class="result-hero' + (all.length && right === all.length ? ' perfect' : '') + '">' + (all.length && right === all.length ? BURST : '') +
      '<p class="label">' + (rs.ended ? '提前结束' : '本组结束') + ' · ' + esc(rootBookName(rs.book)) + '</p>' +
      '<div class="score">' + right + '<small> / ' + all.length + '</small></div>' +
      '<p class="rate">正确率 ' + (all.length ? Math.round((right / all.length) * 100) : 0) + '%</p>' +
      '</section>' +
      '<div class="today stage-line">' + stageLine + '</div>' +
      '<div class="section"><div class="head-row"><p class="label">这一组的词根</p><span class="muted">右边三个标记依次是 根→义、义→根、填词根</span></div>' +
      rs.roots
        .map(
          (x) =>
            '<button class="list-row root-row" data-act="viewRoot" data-id="' + esc(x.r.id) + '">' +
            '<span class="w">' + esc(rootForms(x.r)) + '</span><span class="m">' + esc(x.r.meaning) + '</span>' +
            '<span class="side marks">' + [0, 1, 2].map((i) => mark(x.r, i)).join('') + '</span></button>'
        )
        .join('') +
      '</div>' +
      '<div class="actions" style="margin-top:40px">' + (next ? '<button class="btn" data-act="rootNext">' + next + ' <kbd>Enter</kbd></button>' : '') +
      '<button class="link" data-act="nav" data-view="roots">回到词根 Esc</button></div>' +
      '</main>'
    );
  }

  VIEWS.rootquiz = function () {
    const rs = ui.rs;
    if (!rs) return VIEWS.roots();
    if (rs.done) return rootQuizResultHtml(rs);
    const total = rs.roots.length * 2 + rs.roots.filter((x) => x.target).length;
    const before = rs.stageResults.slice(0, rs.stage).reduce((a, b) => a + (b ? b.length : 0), 0);
    const done = before + rs.results.length;
    const top =
      '<div class="p-top"><span class="steps">' + rootStepsHtml(rs) + '<span class="book">' + esc(rootBookName(rs.book)) + '</span></span>' +
      '<span class="right"><span>' + (rs.between ? rs.items.length : rs.idx + 1) + ' / ' + rs.items.length + '</span><button class="link" data-act="rootQuit">结束 Esc</button></span></div>' +
      '<div class="bar"><i style="width:' + Math.min(100, (done / (total || 1)) * 100) + '%"></i></div>';
    if (rs.between && rs.repeat) {
      const right = rs.results.filter((x) => x.ok).length;
      return (
        '<main class="page rq">' + top +
        '<section class="card"><div class="inner anim"><div class="stage-done again">' +
        '<p class="label">第 ' + (rs.stage + 1) + ' 步 · ' + ROOT_MODES[rs.mode].name + (rs.attempt > 1 ? ' · 第 ' + rs.attempt + ' 遍' : '') + '</p>' +
        '<div class="stage-score">' + right + '<small> / ' + rs.results.length + '</small></div>' +
        '<p class="muted">错了 ' + (rs.results.length - right) + ' 个。已开启强制全对，这一步整组再来一遍，全对才进入下一步。</p>' +
        '<div class="actions"><button class="btn" data-act="rootNext">再来一遍 <kbd>Enter</kbd></button></div>' +
        '</div></div></section></main>'
      );
    }
    if (rs.between) {
      const right = rs.results.filter((x) => x.ok).length;
      const next = ROOT_MODES[ROOT_STAGES[nextRootStage(rs, rs.stage + 1)]];
      const perfect = right === rs.results.length;
      return (
        '<main class="page rq">' + top +
        '<section class="card"><div class="inner anim"><div class="stage-done' + (perfect ? ' perfect' : '') + '">' + (perfect ? BURST : '') +
        '<p class="label">第 ' + (rs.stage + 1) + ' 步完成 · ' + ROOT_MODES[rs.mode].name + '</p>' +
        '<div class="stage-score">' + right + '<small> / ' + rs.results.length + '</small></div>' +
        '<p class="muted">下一步：' + next.name + ' · ' + next.desc + '</p>' +
        '<div class="actions"><button class="btn" data-act="rootNext">继续 <kbd>Enter</kbd></button></div>' +
        '</div></div></section></main>'
      );
    }
    const q = rs.items[rs.idx];
    const answered = rs.pick !== null;
    let body = '';
    if (q.mode !== 'fill') {
      body =
        '<div class="opts' + (q.mode === 'm2r' ? ' forms' : '') + '">' +
        q.options
          .map((m, i) => {
            const cls = answered ? (i === q.correct ? ' right' : i === rs.pick ? ' wrong' : ' off') : '';
            return '<button class="opt' + cls + '" data-act="rootPick" data-n="' + i + '"' + (answered ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd><span>' + esc(m) + '</span></button>';
          })
          .join('') +
        '</div>';
    }
    const hint =
      q.mode === 'fill'
        ? '<div class="hint"><span><kbd>Enter</kbd> 提交</span><span>空着按 <kbd>Enter</kbd> = 不会</span></div>'
        : '<div class="hint"><span>按 <kbd>1</kbd>–<kbd>4</kbd> 选择</span></div>';
    return (
      '<main class="page rq">' + top +
      '<section class="card"><div class="inner' + (answered ? '' : ' anim') + '">' + rootPromptHtml(rs, q) + '</div></section>' +
      body +
      (answered ? rootAfterHtml(q) : hint) +
      '</main>'
    );
  };

  AFTER.rootquiz = function () {
    const input = document.getElementById('rq-answer');
    if (input && !input.readOnly) input.focus();
  };

  // ================= 检查更新 =================

  // 版本号和 desktop/src-tauri/tauri.conf.json 保持一致（tools/build.py 会检查）
  const APP_VERSION = '0.5.2';
  const REPO = 'Adrian-Z-Wong/Marginal-Vocabulary';
  const UPDATE_KEY = 'margin.updateCheck';
  const ONLINE = /^https?:$/.test(location.protocol);
  const DOWNLOAD_PAGE = 'https://adrian-z-wong.github.io/Marginal-Vocabulary/';

  // a 是否比 b 新
  function versionNewer(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  }

  // 从 CHANGELOG 里取出比当前版本新的几段更新内容
  function changelogSince(text, from) {
    const out = [];
    for (const part of text.split(/^## /m).slice(1)) {
      const m = /^(\d+\.\d+\.\d+)/.exec(part);
      if (!m || !versionNewer(m[1], from)) continue;
      out.push({ v: m[1], items: part.split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2)) });
    }
    return out;
  }

  async function checkUpdate(manual) {
    ui.update = Object.assign({}, ui.update, { checking: true, error: '' });
    if (manual) render();
    try {
      const res = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rel = await res.json();
      const latest = String(rel.tag_name || '').replace(/^v/, '');
      try {
        localStorage.setItem(UPDATE_KEY, String(Date.now()));
      } catch (e) {
        /* 存不了就下次再查 */
      }
      if (!latest || !versionNewer(latest, APP_VERSION)) {
        ui.update = { checking: false, latest: latest || APP_VERSION, none: true };
        if (manual) toast('已经是最新版本（' + APP_VERSION + '）');
      } else {
        const asset = (rel.assets || []).find((a) => /\.app\.tar\.gz$/.test(a.name));
        let notes = [];
        try {
          const r2 = await fetch('https://raw.githubusercontent.com/' + REPO + '/main/CHANGELOG.md', { cache: 'no-store' });
          if (r2.ok) notes = changelogSince(await r2.text(), APP_VERSION);
        } catch (e) {
          notes = [];
        }
        ui.update = { checking: false, latest, url: asset ? asset.browser_download_url : '', notes, show: true, open: manual };
      }
    } catch (e) {
      ui.update = { checking: false, error: '检查更新失败，请检查网络后再试' };
      if (manual) toast(ui.update.error);
    }
    // 正在答题时不打断，下次换页面时再显示
    if (ui.view !== 'practice' && ui.view !== 'rootquiz') render();
  }

  // Mac 应用菜单里的「Check for Updates…」会调用这个
  window.__marginCheckUpdate = function () {
    checkUpdate(true).then(() => {
      const u = ui.update;
      if (u && u.show && (ui.view === 'practice' || ui.view === 'rootquiz')) toast('发现新版本 ' + u.latest + '，这一组背完后会提示更新');
    });
  };

  // 每天打开时自动查一次
  function autoCheckUpdate() {
    if (window.__MARGIN_TEST && !window.__MARGIN_TEST_UPDATE) return;
    let last = 0;
    try {
      last = +localStorage.getItem(UPDATE_KEY) || 0;
    } catch (e) {
      last = 0;
    }
    if (Date.now() - last > 12 * 3600 * 1000) setTimeout(() => checkUpdate(false), 2500);
  }

  async function installUpdate() {
    const u = ui.update;
    if (!u || !u.latest) return;
    if (!DESKTOP) {
      if (ONLINE) location.reload();
      else window.open(DOWNLOAD_PAGE, '_blank');
      return;
    }
    if (!u.url) {
      window.open('https://github.com/' + REPO + '/releases/latest', '_blank');
      return;
    }
    u.installing = true;
    u.error = '';
    render();
    try {
      // 进度存在应用的数据文件夹里，换掉应用本身不会动到它；保险起见，更新前再单独存一份备份
      save();
      await window.__TAURI__.core.invoke('save_update_backup', {
        contents: JSON.stringify({ app: 'Marginal Vocabulary', v: 1, exported: new Date().toISOString(), version: APP_VERSION, data: state }),
      });
      await window.__TAURI__.core.invoke('install_update', { url: u.url });
      u.installing = false;
      u.installed = true;
    } catch (e) {
      u.installing = false;
      u.error = '自动更新没成功（' + e + '）。可以到 Releases 页面手动下载新版本。';
    }
    render();
  }

  function updateBarHtml() {
    const u = ui.update;
    if (!u || !u.show || ui.view === 'practice' || ui.view === 'rootquiz') return '';
    let main;
    let acts;
    if (u.installed) {
      main = '<b>新版本 ' + esc(u.latest) + ' 装好了</b><span class="muted">重新打开就是新版本，进度不受影响。</span>';
      acts = '<button class="btn small" data-act="relaunchApp">重新打开</button>';
    } else if (u.installing) {
      main = '<b>正在下载新版本 ' + esc(u.latest) + '…</b><span class="muted">大约 4 MB，装好后会提示你重新打开。</span>';
      acts = '<span class="spin" aria-hidden="true"></span>';
    } else {
      main = '<b>发现新版本 ' + esc(u.latest) + '</b><span class="muted">当前 ' + APP_VERSION + '</span>';
      const label = DESKTOP ? '立即更新' : ONLINE ? '刷新页面' : '下载新版本';
      acts =
        '<button class="btn small" data-act="installUpdate">' + label + '</button>' +
        (u.notes && u.notes.length ? '<button class="link" data-act="toggleUpdateNotes">' + (u.open ? '收起' : '更新内容') + '</button>' : '') +
        '<button class="link" data-act="hideUpdate">稍后</button>';
    }
    const notes =
      u.open && u.notes && u.notes.length && !u.installed
        ? '<div class="u-notes">' + u.notes.map((n) => '<p class="label">' + esc(n.v) + '</p><ul>' + n.items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>').join('') + '</div>'
        : '';
    return (
      '<div class="update-bar" role="status"><div class="u-in"><span class="u-mark">' + ICON_SPARK + '</span><div class="u-text">' + main +
      (u.error ? '<span class="u-err">' + esc(u.error) + '</span>' : '') + '</div><div class="actions">' + acts + '</div></div>' + notes + '</div>'
    );
  }

  function updateSettingHtml() {
    const u = ui.update || {};
    const status = u.checking
      ? '正在检查…'
      : u.error
        ? u.error
        : u.none
          ? '已经是最新版本'
          : u.latest && versionNewer(u.latest, APP_VERSION)
            ? '有新版本 ' + u.latest
            : '';
    const desc = DESKTOP
      ? '每天打开时自动检查一次，也可以在菜单「Marginal Vocabulary → Check for Updates…」里检查。有新版本时直接在应用里下载安装：新版本替换旧版本，不会留下多个版本；背诵进度存在应用的数据文件夹里，不受影响，更新前还会自动备份一份。'
      : ONLINE
        ? '在线版每次打开都是最新版本；如果页面开着时发布了新版本，这里会提示刷新。'
        : '下载到电脑的网页文件不能自己更新；有新版本时会提示，到下载页面再下载一次即可（先导出备份）。';
    return (
      '<div class="set-row"><div><div class="t">版本与更新</div></div><div>' +
      '<div>当前版本 <b class="mono">' + APP_VERSION + '</b>' + (status ? '<span class="muted"> · ' + esc(status) + '</span>' : '') + '</div>' +
      '<div class="actions" style="margin-top:12px"><button class="btn small ghost" data-act="checkUpdate"' + (u.checking ? ' disabled' : '') + '>检查更新</button>' +
      (u.latest && versionNewer(u.latest, APP_VERSION) && !u.installed ? '<button class="btn small" data-act="installUpdate">' + (DESKTOP ? '立即更新' : ONLINE ? '刷新页面' : '下载新版本') + '</button>' : '') +
      (u.installed ? '<button class="btn small" data-act="relaunchApp">重新打开</button>' : '') +
      '</div><div class="d">' + desc + '</div></div></div>'
    );
  }

  // ================= 交互 =================

  const ACTIONS = {
    nav(t) {
      if (ui.view === 'practice') quitSession();
      if (ui.view === 'rootquiz' && ui.rs && !ui.rs.done && t.dataset.view !== 'roots') quitRootSession();
      go(t.dataset.view);
    },
    startNew() {
      startNew();
    },
    startReview() {
      startReview();
    },
    speakCurrent() {
      const e = current();
      if (e && ui.session.mode !== 'zh2en') speak(e.w);
      const input = document.getElementById('answer');
      if (input) input.focus();
    },
    speakWord(t) {
      if (ui.view === 'practice' && ui.session && ui.session.mode === 'zh2en') return;
      speak(t.dataset.w);
    },
    next() {
      submitAnswer();
    },
    quit() {
      quitSession();
    },
    skipKnown() {
      skipKnown();
    },
    unknow(t) {
      delete state.known[keyOf(t.dataset.w)];
      save();
      render();
    },
    exportBook(t) {
      const id = t.dataset.id;
      const lines = bookEntries(id).map((e) => e.w + '\t' + meaningLines(e.m).join('；'));
      // 文件名只用英文：有的浏览器遇到中文文件名会改成 download
      const slug = id === WRONG_BOOK ? 'wrong-words' : id === REVIEW_BOOK ? 'review' : isBuiltin(id) ? id : 'my-list';
      downloadText('margin-' + slug + '-' + todayKey() + '.txt', '\ufeff' + lines.join('\r\n'));
      toast('已导出 ' + lines.length + ' 个词，可以用 Excel 打开，也能导入 Anki');
    },
    retryWrong() {
      const ss = ui.session;
      const words = wrongWords(ss).map((x) => x.entry);
      if (words.length) startSession(shuffle(words), ss.bookId, ss.kind === 'new' ? 'retry' : ss.kind);
    },
    nextGroup() {
      const ss = ui.session;
      if (!ss || ss.kind === 'new' || ss.kind === 'retry') startNew();
      else if (ss.kind === 'review') startReview();
      else startWrong();
    },
    continueStage() {
      continueStage();
    },
    viewBook(t) {
      ui.book = { id: t.dataset.id, q: '', limit: 200 };
      go('book');
    },
    useBook(t) {
      state.settings.book = t.dataset.id;
      save();
      go('home');
    },
    moreRows() {
      ui.book.limit += 200;
      document.getElementById('book-rows').innerHTML = bookRowsHtml();
    },
    async deleteBook(t) {
      const b = state.books[t.dataset.id];
      if (!b || !(await askConfirm('删除词表「' + b.name + '」？背诵记录和错题本不受影响。', '删除'))) return;
      delete state.books[b.id];
      if (state.settings.book === b.id) state.settings.book = FIRST_BOOK;
      save();
      render();
    },
    async renameBook(t) {
      const b = state.books[t.dataset.id];
      if (!b) return;
      const name = await askText('新的词表名称', b.name);
      if (name && name.trim()) {
        b.name = name.trim();
        save();
        render();
      }
    },
    deleteWord(t) {
      const b = state.books[ui.book.id];
      if (!b) return;
      const k = keyOf(t.dataset.w);
      b.words = b.words.filter((e) => keyOf(e.w) !== k);
      save();
      render();
    },
    newImport() {
      const n = Object.keys(state.books).length + 1;
      ui.draft = { target: null, name: '我的词表 ' + n, text: '' };
      go('import');
    },
    appendImport(t) {
      ui.draft = { target: t.dataset.id, name: '', text: '' };
      go('import');
    },
    saveImport() {
      const d = ui.draft;
      const r = parseImport(d.text);
      if (!r.words.length) {
        toast('还没有识别到单词');
        return;
      }
      let book = d.target && state.books[d.target];
      let added = r.words.length;
      if (book) {
        const have = new Map(book.words.map((e) => [keyOf(e.w), e]));
        added = 0;
        for (const e of r.words) {
          const old = have.get(keyOf(e.w));
          if (old) {
            if (e.m) old.m = e.m;
            if (e.p) old.p = e.p;
          } else {
            book.words.push(e);
            added++;
          }
        }
      } else {
        book = createBook(d.name, r.words);
      }
      ui.draft = null;
      openNewBook(book, added);
    },
    practiceWrong() {
      startWrong();
    },
    viewRoot(t) {
      if (ui.roots.id !== t.dataset.id) ui.roots.wordLimit = 50;
      ui.roots.id = t.dataset.id;
      go('root');
    },
    rootType(t) {
      ui.roots.type = t.dataset.type;
      ui.roots.limit = 200;
      render();
    },
    moreRoots() {
      ui.roots.limit += 200;
      document.getElementById('root-rows').innerHTML = rootRowsHtml();
    },
    moreRootWords() {
      ui.roots.wordLimit += 50;
      render();
    },
    studyRootWords() {
      studyRootWords();
    },
    startRootNew() {
      startRootNew();
    },
    startRootReview() {
      startRootReview();
    },
    rootPick(t) {
      rootAnswer(+t.dataset.n);
    },
    rootNext() {
      rootNext();
    },
    rootQuit() {
      quitRootSession();
    },
    removeWrong(t) {
      delete state.wrong[keyOf(t.dataset.w)];
      save();
      render();
    },
    async clearWrong() {
      if (!(await askConfirm('清空错题本？', '清空'))) return;
      state.wrong = {};
      save();
      render();
    },
    setting(t) {
      state.settings[t.dataset.key] = JSON.parse(t.dataset.val);
      save();
      applyTheme();
      render();
    },
    testVoice() {
      speak('Marginal Vocabulary');
    },
    checkUpdate() {
      checkUpdate(true);
    },
    installUpdate() {
      installUpdate();
    },
    relaunchApp() {
      if (DESKTOP) window.__TAURI__.core.invoke('relaunch').catch((e) => toast('重新打开失败：' + e + '，请手动退出后再打开'));
    },
    hideUpdate() {
      ui.update.show = false;
      render();
    },
    toggleUpdateNotes() {
      ui.update.open = !ui.update.open;
      render();
    },
    exportData() {
      downloadText('marginal-vocabulary-backup-' + todayKey() + '.json', JSON.stringify({ app: 'Marginal Vocabulary', v: 1, exported: new Date().toISOString(), data: state }), 'application/json');
      toast('备份已下载');
    },
    async resetAll() {
      if (!(await askConfirm('清空所有数据？自己导入的词表、背诵记录、错题本都会删除，无法恢复。', '清空'))) return;
      adoptState(freshState(), true);
      applyTheme();
      render();
      toast('已清空');
    },
  };

  // ================= 金币、宠物、花园 =================
  // 背单词攒金币，在商店买宠物、种子、水、肥料、装饰、家具、宠物用品和装扮。
  // 花园：买来的树、花、草、灌木种下以后浇水施肥慢慢长大。
  // 宠物可以养好几只，每只都有饱腹和心情，每天往下掉，掉到 0 会生病，要吃药，生病太久会死。

  const PETS = window.MARGIN_PETS || { species: [], trees: [], shop: [], lines: {}, refund: {} };
  const ART = window.MARGIN_ART;
  const SPECIES = new Map(PETS.species.map((s) => [s.id, s]));
  const TREES = new Map(PETS.trees.map((t) => [t.id, t]));
  // 商店里的树种子由树的列表生成
  const SHELVES = PETS.shop.map((sh) =>
    sh.items === 'TREES' ? Object.assign({}, sh, { items: PETS.trees.map((t) => ({ id: 'tseed.' + t.id, name: t.name, price: t.price, use: 'plant', plant: ['tree', t.id] })) }) : sh
  );
  const ITEMS = new Map();
  for (const sh of SHELVES) for (const it of sh.items) ITEMS.set(it.id, Object.assign({ shelf: sh.id }, it));
  const PTS = { right: 2, combo: 5, perfect: 10, rootDone: 5, rootPerfect: 5, goal: 30, rootGoal: 15, again: 1 };
  // 照顾宠物：买来时饱腹、心情都是 80；每天饱腹掉 35、心情掉 20（鱼掉得少一点）；
  // 有一样掉到 0 就生病，吃药能好；生病 3 天没吃药就死了。背单词、在花园玩、摸摸它，每天各有上限
  const CARE = { start: 80, food: 35, mood: 20, fishFood: 30, fishMood: 12, cure: 50, studyCap: 20, playCap: 25, petCap: 6, sickDays: 3 };

  // 每日挑战：每天从里面挑 3 个
  const CHALLENGES = [
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
  const ACHIEVEMENTS = [
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
    { id: 'perfect50', name: '稳', desc: '累计 50 组全对', reward: 200, goal: 50, val: () => state.points.perfects },
    { id: 'roots50', name: '寻根', desc: '学过 50 个词根', reward: 50, goal: 50, val: () => Object.keys(state.rootStats).length },
    { id: 'roots300', name: '根深', desc: '学过 300 个词根', reward: 150, goal: 300, val: () => Object.keys(state.rootStats).length },
    { id: 'pet7', name: '好伙伴', desc: '有一只宠物陪了你 7 天', reward: 50, goal: 7, val: () => petAge() },
    { id: 'pet30', name: '老朋友', desc: '有一只宠物陪了你 30 天', reward: 200, goal: 30, val: () => petAge() },
    { id: 'tree1', name: '第一棵树', desc: '种出第一棵大树', reward: 20, goal: 1, val: () => gardenCount('t') },
    { id: 'tree10', name: '小树林', desc: '种出 10 棵大树', reward: 100, goal: 10, val: () => gardenCount('t') },
    { id: 'tree50', name: '森林', desc: '种出 50 棵大树', reward: 300, goal: 50, val: () => gardenCount('t') },
    { id: 'flower10', name: '花匠', desc: '养开 10 朵花', reward: 50, goal: 10, val: () => gardenCount('f') },
    { id: 'home5', name: '小家', desc: '屋里摆 5 件家具', reward: 50, goal: 5, val: () => state.world.room.length },
  ];

  // 花园的布局（模仿星露谷的农场）：上方是房子，门口一条小路往下，分别通向左边和下边的出口；
  // 左下角是池塘，四周是树林。花园可以花金币扩建三次，往右、往下变大，原来的东西位置不变。
  const TILE = 16;
  const GB = 2; // 外圈两格是树林
  // 花园都是 4:3，和画面一样
  const LANDS = [
    { w: 40, h: 30, price: 0 },
    { w: 48, h: 36, price: 6000 },
    { w: 56, h: 42, price: 15000 },
    { w: 64, h: 48, price: 30000 },
  ];
  // 房子可以一级级扩建：小木屋 → 农舍 → 两层小楼 → 别墅；门一直在第 20 列，房子往两边、往上变大，屋里也跟着变大
  const HOUSES = [
    { name: '小木屋', sprite: 'cabin', w: 7, h: 3, room: [16, 9], price: 0, oy: 0 },
    { name: '农舍', sprite: 'house', w: 9, h: 4, room: [20, 11], price: 8000, oy: 0 },
    { name: '两层小楼', sprite: 'house2', w: 11, h: 4, room: [24, 13], price: 20000, oy: 3 },
    { name: '别墅', sprite: 'villa', w: 13, h: 5, room: [28, 15], price: 40000, oy: 4 },
  ];
  // 房子越高，花园上边多出几行给它（oy），花园里的东西整体往下挪这么多
  const DOOR_X = 20;
  const HOUSE = { x: 16, y: 4, w: 9, h: 4, sprite: 'house' }; // 房子占的格子，门在下沿正中
  let GW = 40;
  let GH = 28;
  const GPATH = new Set();
  const GEXIT = new Set();
  const GPOND = new Set();
  let POND_INNER = [];
  let OY = 0;

  // 按花园大小重新铺路：门口往下到第 13 行，往左通到西边出口，往下通到南边出口
  function layoutGarden() {
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
    for (let x = 0; x <= DOOR_X; x++) for (const y of [12, 13]) GPATH.add(x + ',' + (y + OY));
    for (let y = 14 + OY; y < GH; y++) for (const x of [13, 14]) GPATH.add(x + ',' + y);
    for (const k of GPATH) {
      const [x, y] = k.split(',').map(Number);
      if (x < GB || y >= GH - GB) GEXIT.add(k);
    }
    GPOND.clear();
    for (let y = 18; y <= 21; y++) for (let x = 4; x <= 8; x++) GPOND.add(x + ',' + (y + OY));
    for (const [x, y] of [[5, 17], [6, 17], [9, 19], [9, 20], [5, 22], [6, 22]]) GPOND.add(x + ',' + (y + OY));
    POND_INNER = [...GPOND].filter((k) => {
      const [x, y] = k.split(',').map(Number);
      return GPOND.has(x - 1 + ',' + y) && GPOND.has(x + 1 + ',' + y) && GPOND.has(x + ',' + (y - 1)) && GPOND.has(x + ',' + (y + 1));
    });
    GFIXED.length = 0;
    for (const d of GFIXED_AT) GFIXED.push({ id: d.id, x: d.x, y: d.y + OY });
  }

  // 地上本来就有的东西（不能收走）
  const GFIXED = [];
  const GFIXED_AT = [
    { id: 'sign', x: 27, y: 8 },
    { id: 'mailbox', x: 22, y: 8 },
    { id: 'logs', x: 11, y: 6 },
    { id: 'stone', x: 31, y: 5 },
    { id: 'stone', x: 19, y: 22 },
    { id: 'stone', x: 10, y: 16 },
    { id: 'mushroom', x: 34, y: 21 },
    { id: 'mushroom', x: 4, y: 9 },
    { id: 'mushroom', x: 29, y: 15 },
  ];
  // 屋里的大小跟着房子变；门在下沿正中两格
  let RW = 18;
  let RH = 11;
  let RDOOR = [8, 9];

  function houseLevel() {
    const h = state.world && state.world.house;
    return h >= 0 && h < HOUSES.length ? h : 0;
  }

  // ---------- 金币 ----------

  function pday() {
    const k = todayKey();
    return state.points.days[k] || (state.points.days[k] = { e: 0, x: 0, s: 0, groups: 0, perfect: 0, roots: 0, right: 0, combo: 0, ch: {} });
  }

  // 等级看累计赚到的金币：第 n 级需要 50 × n × (n − 1)
  function levelOf(e) {
    let n = 1;
    while (50 * (n + 1) * n <= e) n++;
    return n;
  }
  const levelNeed = (n) => 50 * n * (n - 1);

  function gain(n) {
    if (n <= 0) return;
    const p = state.points;
    const before = levelOf(p.earned);
    p.bal += n;
    p.earned += n;
    pday().e += n;
    floatPts('+' + n, false);
    const chip = document.querySelector('.pts');
    if (chip && chip.lastChild) chip.lastChild.textContent = fmt(p.bal);
    const after = levelOf(p.earned);
    if (after > before) {
      petSay('level', { n: after });
      toast('升到 ' + after + ' 级了');
    }
  }

  function lose(n) {
    const p = state.points;
    n = Math.min(n, p.bal);
    if (n <= 0) return;
    p.bal -= n;
    pday().x += n;
    floatPts('−' + n, true);
  }

  function spend(n) {
    const p = state.points;
    if (p.bal < n) {
      toast('金币不够（还差 ' + fmt(n - p.bal) + '）');
      return false;
    }
    p.bal -= n;
    pday().s += n;
    return true;
  }

  // 这个词以前答错过吗（第一次答错不扣分，之后再错扣一点）
  function wrongBefore(entry) {
    const s = state.stats[keyOf(entry.w)];
    if (!s) return false;
    return STAGES.some((m) => s[m] && s[m][1] > 0);
  }

  // 每答一题：答对加分、连对奖励；同一个词再错扣一点；宠物陪你背，状态也会好一点
  function rewardAnswer(holder, ok, repeatWrong) {
    const d = pday();
    if (ok) {
      gain(PTS.right);
      d.right++;
      moodUp(0.5, 'studyMood', CARE.studyCap);
      holder.combo = (holder.combo || 0) + 1;
      d.combo = Math.max(d.combo, holder.combo);
      if (holder.combo % 5 === 0) gain(PTS.combo);
      const c = holder.combo;
      if (c === 3) petSay('combo3');
      else if (c === 5) petSay('combo5');
      else if (c === 10 || c === 20 || c === 30) petSay('combo10');
    } else {
      holder.combo = 0;
      if (repeatWrong) {
        lose(PTS.again);
        petSay('again');
      } else if (Math.random() < 0.6) petSay('wrong');
    }
    checkChallenges();
  }

  // 一组结束：发完成奖励，查今日目标、挑战和成就
  function rewardGroup(kind, size, perfect, ended) {
    const d = pday();
    if (ended) return;
    if (kind === 'root') {
      d.roots++;
      gain(PTS.rootDone + (perfect ? PTS.rootPerfect : 0));
      if (perfect) petSay('perfect', { n: PTS.rootPerfect });
      else petSay('done');
      if (learnedRootsToday() >= state.settings.rootGoal && !d.rootGoalDone) {
        d.rootGoalDone = true;
        gain(PTS.rootGoal);
        petSay('goal', { n: PTS.rootGoal });
      }
    } else {
      d.groups++;
      state.points.groups++;
      gain(size);
      if (perfect) {
        d.perfect++;
        state.points.perfects++;
        gain(PTS.perfect);
        petSay('perfect', { n: PTS.perfect });
      } else petSay('done');
      if (learnedToday() >= state.settings.goal && !d.goalDone) {
        d.goalDone = true;
        gain(PTS.goal);
        petSay('goal', { n: PTS.goal });
      }
    }
    checkChallenges();
    checkAchievements();
  }

  // 每天的挑战：按日期固定挑 3 个
  function todayChallenges() {
    let seed = dayNum() * 9301 + 49297;
    const idx = CHALLENGES.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, 3).map((i) => CHALLENGES[i]);
  }

  function checkChallenges() {
    const d = pday();
    for (const c of todayChallenges()) {
      if (d.ch[c.id] || c.val(d) < c.goal) continue;
      d.ch[c.id] = 1;
      gain(c.reward);
      toast('完成每日挑战「' + c.text + '」 +' + c.reward);
      petSay('challenge');
    }
  }

  // quiet：打开应用时补发已经达成的成就，合成一条提示
  function checkAchievements(quiet) {
    const p = state.points;
    let n = 0;
    let sum = 0;
    let last = null;
    for (const a of ACHIEVEMENTS) {
      if (p.ach[a.id] || a.val() < a.goal) continue;
      p.ach[a.id] = todayKey();
      gain(a.reward);
      n++;
      sum += a.reward;
      last = a;
    }
    if (!n) return;
    save();
    if (n === 1) toast('解锁成就「' + last.name + '」 +' + last.reward);
    else toast('解锁 ' + n + ' 个成就 +' + sum + (quiet ? '，到「商店 → 挑战与成就」看看' : ''));
  }

  // ---------- 背包 ----------

  function bagAdd(id, n) {
    const b = state.world.bag;
    b[id] = (b[id] || 0) + n;
    if (b[id] <= 0) delete b[id];
  }

  function bagHas(id) {
    return (state.world.bag[id] || 0) > 0;
  }

  function itemIcon(it) {
    if (!it) return ART.icon('bag');
    if (it.plant) return ART.icon('seed', it.plant[0] === 'flower' ? ART.FLOWER_COLOR[it.plant[1]] : it.plant[0] === 'tree' ? '#a0703a' : it.plant[0] === 'grass' ? '#9ab84a' : '#6aa35a');
    if (it.decor) return ART.decor(it.decor);
    return ART.icon(it.icon || 'bag');
  }

  function pxImg(canvas, scale, cls, title) {
    if (!canvas) return '';
    return (
      '<img class="px' + (cls ? ' ' + cls : '') + '" src="' + ART.url(canvas) + '" width="' + canvas.width * scale + '" height="' + canvas.height * scale + '" alt=""' +
      (title ? ' title="' + esc(title) + '"' : '') + ' draggable="false">'
    );
  }

  // ---------- 宠物 ----------
  // 可以养好几只：都住在花园里，鱼养在池塘里；其中一只（自己选）会跑出来陪你背单词。
  // 每只都有饱腹和心情，每天往下掉；有一样掉到 0 就生病，吃药能好；生病 3 天没吃药就死了。

  function isFish(p) {
    return !!(p && (SPECIES.get(p.sp) || {}).fish);
  }

  function landPets() {
    return state.pets.filter((p) => SPECIES.has(p.sp) && !isFish(p));
  }

  function fishList() {
    return state.pets.filter((p) => SPECIES.has(p.sp) && isFish(p));
  }

  function petById(id) {
    return state.pets.find((p) => p.id === id) || null;
  }

  // 陪你背单词的那只（不是鱼）
  function mainPet() {
    const p = petById(state.petMain);
    return p && SPECIES.has(p.sp) && !isFish(p) ? p : null;
  }

  function petAlive() {
    return !!mainPet();
  }

  function petAge(p) {
    if (p) return dayNum() - p.born + 1;
    return state.pets.reduce((m, x) => Math.max(m, dayNum() - x.born + 1), 0);
  }

  function petSick(p) {
    p = p || mainPet();
    return !!p && !!p.sick;
  }

  function petLow(p) {
    return p.sick || p.food < 30 || p.mood < 30;
  }

  // 有没有哪只需要照顾：生病、饿了或者不开心
  function petNeedsCare() {
    return state.pets.some((p) => SPECIES.has(p.sp) && petLow(p));
  }

  function newPet(sp, name) {
    state.petSeq = (state.petSeq || 0) + 1;
    const p = { id: state.petSeq, sp, name: name || (SPECIES.get(sp) || {}).name || '宠物', born: dayNum(), food: CARE.start, mood: CARE.start, day: dayNum(), sick: false, sickSince: 0, wear: {} };
    state.pets.push(p);
    if (!isFish(p) && !mainPet()) state.petMain = p.id;
    return p;
  }

  // 每过一天：饱腹、心情各掉一截；有一样到 0 就生病；生病太久就死了
  function petsTick() {
    const today = dayNum();
    let changed = false;
    const gone = [];
    for (const p of state.pets) {
      if (p.day == null) p.day = today;
      const fish = isFish(p);
      while (p.day < today) {
        p.day++;
        changed = true;
        if (p.sick) continue;
        p.food = Math.max(0, p.food - (fish ? CARE.fishFood : CARE.food));
        p.mood = Math.max(0, p.mood - (fish ? CARE.fishMood : CARE.mood));
        if (p.food <= 0 || p.mood <= 0) {
          p.sick = true;
          p.sickSince = p.day;
        }
      }
      if (p.sick && today - p.sickSince >= CARE.sickDays) gone.push(p);
    }
    for (const p of gone) {
      state.pets = state.pets.filter((x) => x !== p);
      state.petGraves.push({ name: p.name, sp: p.sp, born: p.born, died: today });
      ui.petGone = (ui.petGone || []).concat(p.name);
      changed = true;
    }
    if (!mainPet()) {
      const next = landPets()[0];
      state.petMain = next ? next.id : 0;
    }
    if (changed) save();
  }

  // 饱腹 / 心情往上加；capKey 是今天这一类的上限（比如背单词最多加 20），每只分开算
  function careUp(p, field, n, capKey, cap) {
    if (!p || p.sick || n <= 0) return 0;
    if (capKey) {
      const d = pday();
      const key = capKey + ':' + p.id;
      const used = d[key] || 0;
      n = Math.min(n, cap - used);
      if (n <= 0) return 0;
      d[key] = used + n;
    }
    p[field] = Math.min(100, (p[field] || 0) + n);
    return n;
  }

  // 陪你背单词的那只心情往上加
  function moodUp(n, capKey, cap) {
    return careUp(mainPet(), 'mood', n, capKey, cap);
  }

  function petLabel(p) {
    if (p.sick) return '生病了';
    if (p.food < 30) return '饿了';
    if (p.mood < 30) return '不太开心';
    return p.food >= 70 && p.mood >= 70 ? '很好' : '还不错';
  }

  function lookOf(p) {
    const w = (p && p.wear) || {};
    const hat = ITEMS.get(w.hat);
    const color = ITEMS.get(w.color);
    return { hat: hat && hat.pet ? hat.pet.hat : '', hue: color && color.pet ? color.pet.hue : 0 };
  }

  function petCanvas(frame, p) {
    p = p || mainPet();
    if (!p) return null;
    const l = lookOf(p);
    return ART.pet(p.sp, frame, l.hue, l.hat);
  }

  function petLine(kind, vars, p) {
    p = p || mainPet();
    const list = PETS.lines[kind];
    if (!p || !list || !list.length) return '';
    const sp = SPECIES.get(p.sp);
    const t = list[Math.floor(Math.random() * list.length)];
    return t.replace(/\{(\w+)\}/g, (_, k) => (k === 'name' ? p.name : k === 'sound' ? (sp ? sp.sound : '') : vars && vars[k] != null ? vars[k] : ''));
  }

  // ---------- 人物 ----------

  function avatarLook() {
    const look = {};
    const wear = state.world.look || {};
    for (const slot of ['top', 'bottom', 'hair', 'hairStyle', 'hat']) {
      const it = ITEMS.get(wear[slot]);
      if (it && it.look) Object.assign(look, it.look);
    }
    return look;
  }

  // ---------- 花园 ----------

  // 这一周的星期一（第几天）
  function weekStart(n) {
    n = n == null ? dayNum() : n;
    const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7;
    return n - dow;
  }

  // 长到第几阶段：种下以后每浇一天水长一阶，施一次肥也长一阶（b 是迁移过来时已经长好的阶段）
  // 树 0 种子、1 发芽、2 小树苗、3 小树、4 大树；花 0–3（3 开花）；灌木和草 0–2
  function plantMax(pl) {
    return pl.k === 'tree' ? 4 : pl.k === 'flower' ? 3 : 2;
  }

  function plantStage(pl) {
    return Math.min(plantMax(pl), (pl.b || 0) + (pl.w || []).length + (pl.f || 0));
  }

  function wateredToday(pl) {
    return (pl.w || []).includes(dayNum());
  }

  function plantName(pl) {
    if (pl.k === 'tree') return (TREES.get(pl.sp) || {}).name || '树';
    const it = ITEMS.get('seed.' + pl.sp);
    return it ? it.name : pl.sp;
  }

  function plantSize(pl) {
    return pl.k === 'tree' ? [2, 1] : [1, 1];
  }

  function decorSize(id) {
    const d = ART.DECOR[id];
    return d ? [d.tw, d.th] : [1, 1];
  }

  // 花园的规模：长大的树、开了的花、长好的灌木和草，还有正在长的
  function summarize(plants, decor) {
    const s = { t: 0, y: 0, f: 0, s: 0, g: 0, w: GW, h: GH, p: [], dc: [] };
    for (const pl of plants) {
      const st = plantStage(pl);
      const full = st >= plantMax(pl);
      if (pl.k === 'tree') full ? s.t++ : s.y++;
      else if (pl.k === 'flower' && full) s.f++;
      else if (pl.k === 'shrub' && full) s.s++;
      else if (pl.k === 'grass' && full) s.g++;
      s.p.push([pl.k, pl.sp, pl.x, pl.y, st]);
    }
    for (const d of decor || []) s.dc.push([d.id, d.x, d.y]);
    return s;
  }

  // 一共种大了多少棵树（t）/ 养开了多少朵花（f）
  function gardenCount(key) {
    return (state.world.grown && state.world.grown[key]) || 0;
  }

  // 格子上有什么：房子、池塘、地上本来有的东西、植物、装饰
  function gardenOcc(skip) {
    const occ = new Map();
    for (let y = HOUSE.y; y < HOUSE.y + HOUSE.h; y++) for (let x = HOUSE.x; x < HOUSE.x + HOUSE.w; x++) occ.set(x + ',' + y, { house: true });
    for (const k of GPOND) occ.set(k, { pond: true });
    for (const d of GFIXED) {
      const [w, h] = decorSize(d.id);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + ',' + (d.y + j), { fixed: d });
    }
    for (const pl of state.world.plants) {
      if (pl === skip) continue;
      const [w, h] = plantSize(pl);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(pl.x + i + ',' + (pl.y + j), { plant: pl });
    }
    for (const d of state.world.decor) {
      if (d === skip) continue;
      const [w, h] = decorSize(d.id);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + ',' + (d.y + j), { decor: d });
    }
    return occ;
  }

  function gardenFree(x, y, w, h, occ) {
    occ = occ || gardenOcc();
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (tx < GB || ty < GB || tx >= GW - GB || ty >= GH - GB) return false;
        // 房子后面被屋顶挡住的那一条，不种也不摆
        if (ty < HOUSE.y && tx >= HOUSE.x - 1 && tx <= HOUSE.x + HOUSE.w) return false;
        if (GPATH.has(tx + ',' + ty) || occ.has(tx + ',' + ty)) return false;
      }
    return true;
  }

  // 布局变了以后（比如旧版本的花园），压在房子、路、池塘上的东西挪到最近的空地；实在没地方，装饰收回背包
  function relocate() {
    const W = state.world;
    let moved = 0;
    const fix = (item, w, h, list) => {
      if (gardenFree(item.x, item.y, w, h, gardenOcc(item))) return true;
      const occ = gardenOcc(item);
      let best = null;
      let bestD = Infinity;
      for (let y = GB; y < GH - GB; y++)
        for (let x = GB; x < GW - GB; x++) {
          const d = Math.hypot(x - item.x, y - item.y);
          if (d < bestD && gardenFree(x, y, w, h, occ)) {
            best = [x, y];
            bestD = d;
          }
        }
      if (!best) return false;
      item.x = best[0];
      item.y = best[1];
      moved++;
      return true;
    };
    W.plants = W.plants.filter((pl) => {
      const [w, h] = plantSize(pl);
      return fix(pl, w, h);
    });
    W.decor = W.decor.filter((d) => {
      const [w, h] = decorSize(d.id);
      if (fix(d, w, h)) return true;
      bagAdd('decor.' + d.id, 1);
      return false;
    });
    return moved;
  }

  // 旧版本的数据：
  // 0.3 → 饱食度去掉，退回新版没有的宠物配饰，旧的森林记录挪进花园；
  // 0.4 → 一只宠物变成可以养好几只（加上饱腹），专注种树去掉（退回解锁树种和宠物品种花的金币，长好的树留着），花园变大
  function migrate() {
    const W = state.world;
    // 以前的版本都是农舍；新来的从小木屋开始
    if (W.house == null) {
      W.house = W.v5 || W.migrated ? 1 : 0;
      // 以前的农舍屋里是 18 格宽，现在 20 格：家具往右挪一格，还是对着门
      if (W.house === 1) for (const d of W.room) d.x += 1;
    }
    layoutGarden();
    const old = state.pet;
    let refund = 0;
    const notes = [];
    if (old) {
      for (const id of (old.owned || []).slice()) {
        if (!PETS.refund[id]) continue;
        refund += PETS.refund[id];
        old.owned = old.owned.filter((x) => x !== id);
      }
    }
    if (!W.migrated) {
      W.migrated = 1;
      const garden = state.garden || {};
      const wk = weekStart();
      W.week = W.week || wk;
      for (const day in garden) {
        if (!Array.isArray(garden[day])) continue;
        const n = Math.round(new Date(day + 'T00:00:00Z').getTime() / 86400000);
        const ws = weekStart(n);
        for (const [sp, ok] of garden[day]) {
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
        const SP_OLD = { cat: 200, hamster: 200, shiba: 300, rabbit: 300, duck: 400, penguin: 500, frog: 500, fox: 600 };
        for (const id of old.unlocked || []) refund += SP_OLD[id] || 0;
      }
      // 专注种树去掉了：退回解锁树种花的金币；种活的树留在花园里，算长大的树；枯萎的清掉
      const TR_OLD = { pine: 150, cactus: 200, bamboo: 250, sakura: 300, maple: 300, ginkgo: 400, palm: 400, apple: 500 };
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

  // ---------- 在页面上走动的宠物 ----------

  const PET_W = 64;
  const PET_H = 64;
  const petLayer = document.createElement('div');
  petLayer.className = 'pet-layer';
  document.body.appendChild(petLayer);
  const roam = { x: null, y: null, tx: 0, ty: 0, moving: false, last: 0, lastAct: Date.now(), sleeping: false, bubbleTimer: 0, careAt: 0, frame: 'idle', walkT: 0, talking: false };

  // 花园、小屋、商店的宠物栏里有自己的宠物画面，页面上走动的那只就先藏起来
  function petShown() {
    return petAlive() && state.settings.petRoam !== false && ui.view !== 'garden' && ui.view !== 'room' && !onPetTab();
  }

  function petEl() {
    return petLayer.querySelector('.pet');
  }

  function clampPet() {
    roam.tx = Math.max(6, Math.min(window.innerWidth - PET_W - 6, roam.tx));
    roam.ty = Math.max(8, Math.min(window.innerHeight - PET_H - 6, roam.ty));
  }

  function placePet() {
    const el = petEl();
    if (el) el.style.transform = 'translate(' + Math.round(roam.x) + 'px,' + Math.round(roam.y) + 'px)';
  }

  // 现在该用哪一帧：生病、睡觉、说话时开心，走路两帧交替，平时偶尔眨眼
  function petFrameNow() {
    if (petSick()) return 'sick';
    if (roam.sleeping) return 'sleep';
    if (roam.moving) return roam.walkT % 2 ? 'walk2' : 'walk1';
    if (roam.talking) return 'happy';
    return roam.frame === 'blink' ? 'blink' : 'idle';
  }

  function setPetFrame() {
    const img = petLayer.querySelector('.pet-img');
    if (!img) return;
    const f = petFrameNow();
    if (img.dataset.f === f) return;
    img.dataset.f = f;
    img.src = ART.url(petCanvas(f));
  }

  function renderPet() {
    if (!petShown()) {
      petLayer.hidden = true;
      return;
    }
    petLayer.hidden = false;
    const mp = mainPet();
    const key = mp.id + '|' + mp.sp + '|' + JSON.stringify(mp.wear);
    if (petLayer.dataset.key !== key || !petEl()) {
      petLayer.innerHTML = '<div class="pet" title="' + esc(mp.name) + '"><div class="pet-bubble"></div><div class="pet-hop"><img class="pet-img px" width="' + PET_W + '" height="' + PET_H + '" alt="" draggable="false"></div></div>';
      petLayer.dataset.key = key;
    }
    if (roam.x === null) {
      roam.x = roam.tx = window.innerWidth - PET_W - 100; // 右下角留给背包
      roam.y = roam.ty = window.innerHeight - PET_H - 18;
    }
    placePet();
    setPetFrame();
  }

  function walkTo(cx, cy) {
    roam.tx = cx - PET_W / 2;
    roam.ty = cy - PET_H + 6;
    clampPet();
    if (!petEl()) return;
    wakePet(false);
    if (!roam.moving) {
      roam.moving = true;
      roam.last = performance.now();
      requestAnimationFrame(stepPet);
    }
  }

  function stepPet(t) {
    if (!petEl()) {
      roam.moving = false;
      return;
    }
    const dt = Math.min(0.05, (t - roam.last) / 1000);
    roam.last = t;
    roam.walkT = Math.floor(t / 140);
    const dx = roam.tx - roam.x;
    const dy = roam.ty - roam.y;
    const dist = Math.hypot(dx, dy);
    const v = (petSick() ? 90 : 200) * dt;
    if (dist <= v) {
      roam.x = roam.tx;
      roam.y = roam.ty;
      roam.moving = false;
      placePet();
      setPetFrame();
      return;
    }
    roam.x += (dx / dist) * v;
    roam.y += (dy / dist) * v;
    placePet();
    setPetFrame();
    requestAnimationFrame(stepPet);
  }

  function petSay(kind, vars) {
    const text = petLine(kind, vars);
    if (!text) return;
    let box = null;
    if (onPetTab()) box = document.querySelector('.pet-stage');
    else if (petShown()) box = petEl();
    else if ((ui.view === 'garden' || ui.view === 'room') && scene) {
      scene.say(text);
      return;
    }
    if (!box) return;
    const b = box.querySelector('.pet-bubble');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('show');
    b.style.setProperty('--dx', '0px');
    void b.offsetWidth;
    // 宠物在窗口边上时，气泡往里挪，别露到窗口外面
    const r = b.getBoundingClientRect();
    const dx = r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : r.left < 8 ? 8 - r.left : 0;
    b.style.setProperty('--dx', Math.round(dx) + 'px');
    b.classList.add('show');
    roam.talking = true;
    setPetFrame();
    clearTimeout(roam.bubbleTimer);
    roam.bubbleTimer = setTimeout(() => {
      b.classList.remove('show');
      roam.talking = false;
      setPetFrame();
    }, 3600);
  }

  function hopPet(box) {
    const h = box && box.querySelector('.pet-hop');
    if (!h) return;
    h.classList.remove('hop');
    void h.offsetWidth;
    h.classList.add('hop');
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = '♥';
    box.appendChild(heart);
    setTimeout(() => heart.remove(), 900);
  }

  function wakePet(say) {
    roam.lastAct = Date.now();
    if (!roam.sleeping) return;
    roam.sleeping = false;
    setPetFrame();
    if (say) petSay('wake');
  }

  // 金币变化时，从宠物头上（没有宠物就从顶栏的金币）飘出一个数字
  function floatPts(text, neg) {
    let x;
    let y;
    if (petShown() && petEl()) {
      x = roam.x + PET_W / 2;
      y = roam.y;
    } else {
      const chip = document.querySelector('.pts');
      if (!chip) return;
      const r = chip.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.bottom + 4;
    }
    const s = document.createElement('span');
    s.className = 'pts-float' + (neg ? ' neg' : '');
    s.textContent = text;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }

  // 空白处：不是按钮、输入框、链接、选项、列表行这些可以操作的东西
  function blankClick(ev) {
    const t = ev.target;
    if (!(t instanceof Element)) return false;
    if (t.closest('a, button, input, textarea, select, label, kbd, canvas, [data-act], [data-bag], .opt, .list-row, .chip, .modal, .toast, .hm, .update-bar, .pet-stage, .pet-card, .shop-item, .bag')) return false;
    const sel = window.getSelection && window.getSelection();
    return !(sel && String(sel).length);
  }

  document.addEventListener('click', (ev) => {
    if (document.querySelector('.modal')) return;
    const onPet = ev.target instanceof Element && ev.target.closest('.pet');
    if (onPet) {
      const was = roam.sleeping;
      wakePet(false);
      hopPet(onPet);
      if (moodUp(1, 'petMood', CARE.petCap)) save();
      petSay(was ? 'wake' : petSick() ? 'sick' : 'click');
      return;
    }
    // 「我的宠物」里点宠物：跳一下，心情好一点
    const stage = ev.target instanceof Element && ev.target.closest('.pet-stage .pet-hop');
    if (stage) {
      const box = stage.closest('.pet-stage');
      const p = petById(+box.dataset.pet);
      hopPet(box);
      if (p && careUp(p, 'mood', 1, 'petMood', CARE.petCap)) save();
      const text = petLine(p && p.sick ? 'sick' : 'click', null, p);
      const b = box.querySelector('.pet-bubble');
      if (b && text) {
        b.textContent = text;
        b.classList.remove('show');
        void b.offsetWidth;
        b.classList.add('show');
        clearTimeout(box._t);
        box._t = setTimeout(() => b.classList.remove('show'), 3200);
      }
      return;
    }
    roam.lastAct = Date.now();
    if (!petShown() || !blankClick(ev)) return;
    walkTo(ev.clientX, ev.clientY);
    if (Math.random() < 0.15) petSay('walk');
    // 背诵时点空白处不要丢掉输入框的焦点
    const input = document.querySelector('.practice .ans:not([readonly]), #answer:not([readonly]), #rq-answer:not([readonly])');
    if (input) input.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', () => wakePet(false), true);

  window.addEventListener('resize', () => {
    // 最小化等情况下窗口尺寸会是 0，不要把宠物挤到角落
    if (roam.x === null || window.innerWidth < 200 || window.innerHeight < 200) return;
    roam.tx = roam.x;
    roam.ty = roam.y;
    clampPet();
    roam.x = roam.tx;
    roam.y = roam.ty;
    placePet();
    if (scene) scene.fit();
  });

  // 闲着的时候：自己到处跑，偶尔眨眼；太久没动静就睡觉；状态低或生病会说
  setInterval(() => {
    if (!petShown() || roam.moving) return;
    if (!petEl()) return;
    const idle = Date.now() - roam.lastAct;
    if (idle > 90000) {
      if (!roam.sleeping) {
        roam.sleeping = true;
        setPetFrame();
        petSay('sleep');
      }
      return;
    }
    if (Math.random() < 0.12) {
      roam.frame = 'blink';
      setPetFrame();
      setTimeout(() => {
        roam.frame = 'idle';
        setPetFrame();
      }, 140);
    }
    if (petNeedsCare() && Date.now() - roam.careAt > 10 * 60000 && ui.view !== 'practice' && ui.view !== 'rootquiz') {
      roam.careAt = Date.now();
      const mp = mainPet();
      const other = state.pets.find((p) => p !== mp && SPECIES.has(p.sp) && petLow(p));
      if (petLow(mp)) petSay(mp.sick ? 'sick' : mp.food < 30 ? 'hungry' : 'low');
      else if (other) petSay(other.sick ? 'otherSick' : 'otherLow', { n: other.name });
      return;
    }
    if (petSick()) return;
    // 想去哪就去哪：有时在附近溜达，有时跑到页面另一头
    const r = Math.random();
    if (r < 0.06) {
      roam.tx = roam.x + (Math.random() - 0.5) * 240;
      roam.ty = roam.y + (Math.random() - 0.5) * 80;
    } else if (r < 0.08) {
      roam.tx = Math.random() * window.innerWidth;
      roam.ty = window.innerHeight * (0.35 + Math.random() * 0.6);
    } else return;
    clampPet();
    roam.moving = true;
    roam.last = performance.now();
    requestAnimationFrame(stepPet);
  }, 1000);

  // 开始背诵时，宠物跑过来陪你（卡片右下角旁边）
  function petJoinStudy() {
    if (!petShown()) return;
    setTimeout(() => {
      if (!petEl()) return;
      const card = document.querySelector('.practice .card, .rq .card');
      const r = card ? card.getBoundingClientRect() : null;
      const x = r && r.right + 70 < window.innerWidth ? r.right + 44 : window.innerWidth - 50;
      const y = r ? r.bottom - 4 : window.innerHeight - 30;
      walkTo(x, y);
      if (Math.random() < 0.5) setTimeout(() => petSay('study'), 900);
    }, 250);
  }

  // ---------- 花园和小屋的画面 ----------
  // 用一块 canvas 画：地面整块缓存，房子、植物、装饰、人物、宠物按脚下的位置排前后。
  // 花园比窗口大，镜头跟着人物走；点地面走过去，也可以用方向键 / WASD 走。

  let scene = null;
  const terrainCache = { key: '', canvas: null };
  let roomCanvas = null;

  function gardenTerrain(plants) {
    const soil = new Set();
    const wet = new Set();
    const today = dayNum();
    // 花下面是翻过的土（浇过水更深）；灌木直接长在草地上
    for (const pl of plants) {
      const k = pl.k || pl[0];
      const x = pl.x != null ? pl.x : pl[2];
      const y = pl.y != null ? pl.y : pl[3];
      if (k !== 'flower' || x < 0) continue;
      ((pl.w || []).includes(today) && plants === state.world.plants ? wet : soil).add(x + ',' + y);
    }
    const key = [...soil].sort().join(';') + '|' + [...wet].sort().join(';');
    if (plants === state.world.plants && terrainCache.key === key && terrainCache.canvas) return terrainCache.canvas;
    const c = ART.terrain({ w: GW, h: GH, path: GPATH, soil, wet, water: GPOND, exits: GEXIT, border: GB, seed: 11 });
    if (plants === state.world.plants) {
      terrainCache.key = key;
      terrainCache.canvas = c;
    }
    return c;
  }

  function roomTerrain() {
    if (!roomCanvas || roomCanvas.width !== RW * TILE || roomCanvas.height !== RH * TILE) roomCanvas = ART.room({ w: RW, h: RH, door: RDOOR, seed: 7 });
    return roomCanvas;
  }

  function roomOcc(skip) {
    const occ = new Map();
    for (const d of state.world.room) {
      if (d === skip) continue;
      const [w, h] = decorSize(d.id);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) occ.set(d.x + i + ',' + (d.y + j), d);
    }
    return occ;
  }

  // 换了一份数据（清空、导入备份、别的标签页改了）：旧备份照样升级，花园和屋子按新数据重新排
  function adoptState(s, fresh) {
    state = s;
    if (fresh) migrate();
    else layoutGarden();
    terrainCache.key = '';
    roomCanvas = null;
    if (scene) scene.stop();
    scene = null;
  }

  function roomRelocate() {
    const W = state.world;
    W.room = W.room.filter((d) => {
      if (roomFree(d.id, d.x, d.y, roomOcc(d))) return true;
      const occ = roomOcc(d);
      let best = null;
      let bestD = Infinity;
      for (let y = 1; y < RH; y++)
        for (let x = 0; x < RW; x++) {
          const dd = Math.hypot(x - d.x, y - d.y);
          if (dd < bestD && roomFree(d.id, x, y, occ)) {
            best = [x, y];
            bestD = dd;
          }
        }
      if (best) {
        d.x = best[0];
        d.y = best[1];
        return true;
      }
      bagAdd('furn.' + d.id, 1);
      return false;
    });
  }

  function roomFree(id, x, y, occ) {
    occ = occ || roomOcc();
    const D = ART.DECOR[id];
    const [w, h] = decorSize(id);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (tx < 0 || tx >= RW) return false;
        if (D && D.wall ? ty !== 1 : ty < 2 || ty >= RH) return false;
        if (!D.wall && ty === RH - 1 && RDOOR.includes(tx)) return false;
        if (occ.has(tx + ',' + ty)) return false;
      }
    return true;
  }

  // 画一个物件：底边对齐格子
  function objAt(img, tx, ty, tw, th) {
    const base = (ty + th) * TILE;
    return { img, x: tx * TILE + (tw * TILE - img.width) / 2, y: base - img.height, base };
  }

  function gardenObjects(plants, decor, live) {
    const out = [];
    out.push(objAt(ART.decor(HOUSE.sprite), HOUSE.x, HOUSE.y, HOUSE.w, HOUSE.h));
    for (const d of GFIXED) {
      const [w, h] = decorSize(d.id);
      out.push(objAt(ART.decor(d.id), d.x, d.y, w, h));
    }
    for (const d of decor) {
      const img = ART.decor(d.id);
      if (!img) continue;
      const [w, h] = decorSize(d.id);
      const o = objAt(img, d.x, d.y, w, h);
      if (ART.DECOR[d.id] && ART.DECOR[d.id].flat) o.base = -1;
      out.push(o);
    }
    for (const pl of plants) {
      const k = pl.k || pl[0];
      const sp = pl.sp || pl[1];
      const x = pl.x != null ? pl.x : pl[2];
      const y = pl.y != null ? pl.y : pl[3];
      if (x < 0) continue;
      const st = pl.k ? plantStage(pl) : pl[4];
      let img;
      if (k === 'tree') img = ART.tree(sp, st);
      else if (k === 'flower') img = ART.flower(sp, st);
      else if (k === 'grass') img = ART.grass(sp, st);
      else img = ART.shrub(sp, st);
      const o = objAt(img, x, y, k === 'tree' ? 2 : 1, 1);
      if (k === 'tree' && st >= 3) o.y += 2;
      o.plant = live ? pl : null;
      out.push(o);
    }
    return out;
  }

  const TB_GAP = 10; // 工具栏离画面下沿（或上沿）的距离，和 CSS 一致

  function Scene(kind) {
    this.kind = kind;
    this.w = kind === 'room' ? RW : GW;
    this.h = kind === 'room' ? RH : GH;
    const sx = kind === 'room' ? (RDOOR[0] + 1) * TILE : DOOR_X * TILE + TILE / 2;
    let sy = (HOUSE.y + HOUSE.h + 1) * TILE;
    if (kind === 'room') {
      // 进门往里走两步站着（别站在下边的工具栏后面）；那儿摆了家具就站门口
      const B = this.blocked();
      sy = (RH - 1) * TILE - 2;
      for (const r of [RH - 3, RH - 2]) {
        if (this.freeAt(sx, r * TILE + 8, B)) {
          sy = r * TILE + 8;
          break;
        }
      }
    }
    this.av = { x: sx, y: sy, tx: sx, ty: sy, path: [], dir: 'front', flip: false, moving: false, act: 0, then: null };
    // 花园里所有的宠物都出来玩；鱼在池塘里游
    this.pets = [];
    this.fish = [];
    if (kind === 'garden') {
      landPets().forEach((pet, i) => {
        const px = (DOOR_X + 3 + (i % 5) * 2) * TILE;
        const py = (HOUSE.y + HOUSE.h + 2 + Math.floor(i / 5)) * TILE;
        this.pets.push({ pid: pet.id, x: px, y: py, tx: px, ty: py, path: [], moving: false, next: performance.now() + 800 + i * 400, play: 0, flip: false, blink: 0, hop: 0 });
      });
      fishList().forEach((f) => {
        const [x, y] = pondSpot();
        this.fish.push({ pid: f.id, x, y, tx: x, ty: y, flip: false, next: 0, v: 7 + Math.random() * 6, hop: 0 });
      });
    }
    this.cam = { x: 0, y: 0, init: false };
    this.hover = null;
    this.keys = {};
    this.fx = [];
    this.raf = 0;
    this.last = 0;
    this.bubbleUntil = 0;
  }

  Scene.prototype.attach = function (canvas, wrap) {
    this.canvas = canvas;
    this.wrap = wrap;
    this.ctx = canvas.getContext('2d');
    this.bubble = wrap.querySelector('.scene-bubble');
    canvas.addEventListener('click', (ev) => this.click(ev));
    canvas.addEventListener('mousemove', (ev) => this.move(ev));
    canvas.addEventListener('mouseleave', () => (this.hover = null));
    let acc = 0;
    canvas.addEventListener(
      'wheel',
      (ev) => {
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        acc += ev.deltaY;
        if (Math.abs(acc) < 40) return;
        this.zoomBy(acc > 0 ? -1 : 1);
        acc = 0;
      },
      { passive: false }
    );
    this.fit();
    this.start();
  };

  // 画面占满页面的宽度，高度尽量用满窗口（最高到 4:3）；工具栏浮在画面下面
  Scene.prototype.box = function () {
    const w = Math.max(280, this.wrap.clientWidth || 960);
    const top = this.wrap.getBoundingClientRect().top + window.scrollY;
    // 横着的窗口 4:3；竖着拿的手机可以高一点
    const tall = window.innerHeight > window.innerWidth ? 1.25 : 0.75;
    const h = Math.round(Math.max(240, Math.min(w * tall, window.innerHeight - top - 16)));
    return [w, h];
  };

  // 默认大约看到 30 格宽（和星露谷差不多），可以拉近拉远（1–5 倍）；拉远到地图刚好铺满画面为止
  Scene.prototype.autoScale = function () {
    return Math.max(2, Math.min(4, Math.round(this.box()[0] / 480)));
  };

  Scene.prototype.minScale = function () {
    const [bw, bh] = this.box();
    return Math.max(1, Math.ceil(Math.max(bw / (this.w * TILE), bh / (this.h * TILE)) - 1e-6));
  };

  Scene.prototype.fit = function () {
    if (!this.canvas) return;
    let [bw, bh] = this.box();
    // 屋里：画面高度按屋子的比例来，整间屋子横着铺满；窗口太矮放不下，就裁掉一点、跟着人物走
    // 手机上屋子至少放大两倍，太小看不清
    if (this.kind === 'room') bh = Math.min(bh, Math.max(Math.round((bw * this.h) / this.w), this.h * TILE * 2));
    this.wrap.style.height = bh + (this.wrap.offsetHeight - this.wrap.clientHeight) + 'px'; // 加上边框，里面正好 bh 高
    let scale;
    if (this.kind === 'room') {
      // 屋里：整间屋子放大到铺满画面，多出来的一点跟着人物走
      scale = Math.max(bw / (this.w * TILE), bh / (this.h * TILE));
    } else {
      const z = state.settings.zoom;
      scale = Math.max(z >= 1 && z <= 5 ? z : this.autoScale(), this.minScale());
    }
    const vw = Math.min(this.w * TILE, Math.round(bw / scale));
    const vh = Math.min(this.h * TILE, Math.round(bh / scale));
    this.scale = scale;
    this.vw = vw;
    this.vh = vh;
    this.canvas.width = vw;
    this.canvas.height = vh;
    // 画面像素数取整以后，放大出来会比框差一两个像素，在边上留一道缝：直接撑满（最多拉伸不到一个像素）
    this.canvas.style.width = bw + 'px';
    this.canvas.style.height = bh + 'px';
    this.ctx.imageSmoothingEnabled = false;
    // 底下工具栏的上沿（画面里的像素）：人物站在门口时别被它挡住
    this.tb = this.wrap.querySelector('.toolbar');
    this.tbTop = this.tb ? (this.wrap.clientHeight - TB_GAP - this.tb.offsetHeight - this.canvas.offsetTop) / scale : vh;
  };

  Scene.prototype.zoomBy = function (d) {
    if (this.kind === 'room') return;
    const z = Math.max(this.minScale(), Math.min(5, this.scale + d));
    if (z === this.scale) return;
    state.settings.zoom = z === this.autoScale() ? 0 : z;
    save();
    this.fit();
    this.cam.init = false;
    const el = document.getElementById('zoom-v');
    if (el) el.textContent = z + '×';
  };

  Scene.prototype.start = function () {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (t) => {
      if (!this.canvas || !document.body.contains(this.canvas)) return;
      this.step(t);
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };

  Scene.prototype.stop = function () {
    cancelAnimationFrame(this.raf);
    this.canvas = null;
  };

  Scene.prototype.bounds = function () {
    if (this.kind === 'room') return [8, 2 * TILE + 10, RW * TILE - 8, RH * TILE - 2];
    return [GB * TILE + 6, GB * TILE + 10, (GW - GB) * TILE - 6, (GH - GB) * TILE - 2];
  };

  // 走不过去的格子：房子、池塘、树、灌木、石头和各种摆设（花和地毯可以踩）
  Scene.prototype.blocked = function () {
    const B = new Set();
    if (this.kind === 'room') {
      for (const d of state.world.room) {
        const D = ART.DECOR[d.id];
        if (D && (D.flat || D.wall)) continue;
        const [w, h] = decorSize(d.id);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) B.add(d.x + i + ',' + (d.y + j));
      }
      return B;
    }
    for (const [k, v] of gardenOcc()) {
      if (v.plant && v.plant.k === 'flower') continue;
      if (v.decor && ART.DECOR[v.decor.id] && ART.DECOR[v.decor.id].flat) continue;
      B.add(k);
    }
    return B;
  };

  // 脚下这一点能不能站（看脚的左右两边）
  Scene.prototype.freeAt = function (x, y, B) {
    B = B || this.blockedNow || this.blocked();
    const ty = Math.floor(y / TILE);
    return !B.has(Math.floor((x - 4) / TILE) + ',' + ty) && !B.has(Math.floor((x + 4) / TILE) + ',' + ty);
  };

  // 找路：按格子广度优先，走不到目标就走到离目标最近、走得到的格子；再把能直走的拐点省掉
  Scene.prototype.route = function (px, py, who) {
    const B = this.blocked();
    const [x0, y0, x1, y1] = this.bounds();
    const cxOf = (tx) => Math.max(x0, Math.min(x1, tx * TILE + TILE / 2));
    const cyOf = (ty) => Math.max(y0, Math.min(y1, ty * TILE + 10));
    const ok = (tx, ty) => tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && !B.has(tx + ',' + ty) && (ty + 1) * TILE > y0 && ty * TILE <= y1 && (tx + 1) * TILE > x0 && tx * TILE <= x1;
    const av = who || this.av;
    const sx = Math.floor(av.x / TILE);
    const sy = Math.floor(av.y / TILE);
    const gx = Math.floor(px / TILE);
    const gy = Math.floor(py / TILE);
    const key = (x, y) => x + ',' + y;
    const prev = new Map([[key(sx, sy), null]]);
    const queue = [[sx, sy]];
    let best = [sx, sy];
    let bestD = Math.hypot(cxOf(sx) - px, cyOf(sy) - py);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      const d = x === gx && y === gy ? -1 : Math.hypot(cxOf(x) - px, cyOf(y) - py);
      if (d < bestD - 0.01) {
        best = [x, y];
        bestD = d;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (prev.has(key(nx, ny)) || !ok(nx, ny)) continue;
        if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue; // 斜着走不能擦着墙角
        prev.set(key(nx, ny), [x, y]);
        queue.push([nx, ny]);
      }
    }
    const reached = best[0] === gx && best[1] === gy;
    // 目标是空地却走不到：多半是自己用栅栏把自己围起来了，直接走过去，免得卡死
    if (!reached && ok(gx, gy)) return [[Math.max(x0, Math.min(x1, px)), Math.max(y0, Math.min(y1, py))]];
    const tiles = [];
    for (let c = best; c; c = prev.get(key(c[0], c[1]))) tiles.unshift(c);
    tiles.shift(); // 起点那一格不用走
    const pts = tiles.map(([x, y]) => [cxOf(x), cyOf(y)]);
    const end = reached ? [Math.max(x0, Math.min(x1, px)), Math.max(y0, Math.min(y1, py))] : pts.length ? pts[pts.length - 1] : [av.x, av.y];
    if (pts.length) pts[pts.length - 1] = end;
    else pts.push(end);
    // 能直着走过去的拐点去掉
    const clear = (a, b) => {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
      for (let i = 1; i <= n; i++) if (!this.freeAt(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, B)) return false;
      return true;
    };
    const out = [];
    let from = [av.x, av.y];
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !clear(from, pts[j])) j--;
      out.push(pts[j]);
      from = pts[j];
      i = j + 1;
    }
    return out;
  };

  // 走到某一点（绕开挡路的东西），到了再做 then
  Scene.prototype.walkTo = function (px, py, then) {
    const path = this.route(px, py);
    const last = path[path.length - 1];
    this.av.path = path;
    this.av.tx = last[0];
    this.av.ty = last[1];
    this.av.then = then || null;
    this.av.moving = true;
  };

  Scene.prototype.walkNear = function (tx, ty, tw, th, then) {
    const cx = (tx + tw / 2) * TILE;
    const below = (ty + th) * TILE + 6;
    // 从下面够不着（比如在下边缘），就站到旁边
    const [, , , y1] = this.bounds();
    if (below > y1) this.walkTo(cx + (this.av.x < cx ? -(tw * TILE) / 2 - 6 : (tw * TILE) / 2 + 6), (ty + th) * TILE - 2, then);
    else this.walkTo(cx, below, then);
  };

  Scene.prototype.step = function (t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const av = this.av;
    const k = this.keys;
    const vx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const vy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const speed = 72;
    if (vx || vy) {
      const n = Math.hypot(vx, vy);
      const [x0, y0, x1, y1] = this.bounds();
      const nx = Math.max(x0, Math.min(x1, av.x + (vx / n) * speed * dt));
      const ny = Math.max(y0, Math.min(y1, av.y + (vy / n) * speed * dt));
      // 撞到东西就顺着边滑过去；本来就卡在里面的话随便走，好出来
      this.blockedNow = this.blocked();
      if (this.freeAt(nx, ny) || !this.freeAt(av.x, av.y)) {
        av.x = nx;
        av.y = ny;
      } else if (this.freeAt(nx, av.y)) av.x = nx;
      else if (this.freeAt(av.x, ny)) av.y = ny;
      this.blockedNow = null;
      av.tx = av.x;
      av.ty = av.y;
      av.path = [];
      av.moving = false;
      av.then = null;
      av.walking = true;
      if (Math.abs(vx) >= Math.abs(vy)) {
        av.dir = 'side';
        av.flip = vx < 0;
      } else av.dir = vy > 0 ? 'front' : 'back';
    } else if (av.moving) {
      if (!av.path || !av.path.length) av.path = [[av.tx, av.ty]];
      const wp = av.path[0];
      const dx = wp[0] - av.x;
      const dy = wp[1] - av.y;
      const d = Math.hypot(dx, dy);
      const v = speed * dt;
      av.walking = true;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (Math.abs(dx) > 0.5) {
          av.dir = 'side';
          av.flip = dx < 0;
        }
      } else av.dir = dy > 0 ? 'front' : 'back';
      if (d <= v && av.path.length > 1) {
        av.x = wp[0];
        av.y = wp[1];
        av.path.shift();
      } else if (d <= v) {
        av.x = wp[0];
        av.y = wp[1];
        av.path = [];
        av.moving = false;
        av.walking = false;
        const then = av.then;
        av.then = null;
        if (then) {
          av.act = t + 450;
          then();
        }
      } else {
        av.x += (dx / d) * v;
        av.y += (dy / d) * v;
      }
    } else av.walking = false;
    // 镜头跟着人物，不超出地图；在房子跟前时镜头往上抬，尽量把整栋房子拍进来（人物留在工具栏上面），走远了慢慢回到正中
    const cxT = Math.max(0, Math.min(this.w * TILE - this.vw, av.x - this.vw / 2));
    let cyC = av.y - 16 - this.vh / 2;
    if (this.kind === 'garden') {
      const doorY = (HOUSE.y + HOUSE.h + 1) * TILE;
      const top = (HOUSE.y + HOUSE.h) * TILE - ART.decor(HOUSE.sprite).height;
      const lift = cyC - Math.max(top - 4, av.y - Math.min(this.vh, this.tbTop || this.vh) + 6);
      const k = Math.max(0, Math.min(1, (av.y - doorY) / (6 * TILE)));
      if (lift > 0) cyC -= lift * (1 - k);
    }
    const cyT = Math.max(0, Math.min(this.h * TILE - this.vh, cyC));
    if (!this.cam.init) {
      this.cam.x = cxT;
      this.cam.y = cyT;
      this.cam.init = true;
    } else {
      this.cam.x += (cxT - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (cyT - this.cam.y) * Math.min(1, dt * 5);
    }
    this.stepPet(t, dt);
    this.ambient(t, dt);
    for (const f of this.fx) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.x += (f.vx || 0) * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  };

  // 宠物在花园里：自己溜达，花园里有树有花就跑过去玩，玩一会儿状态会好起来
  // 花园里的宠物：每只自己溜达；花园里有长好的树和花，就跑过去玩，玩一会儿心情会好起来
  Scene.prototype.stepPet = function (t, dt) {
    for (const e of this.pets) this.stepOne(e, t, dt);
    for (const f of this.fish) this.stepFish(f, t, dt);
  };

  Scene.prototype.stepOne = function (p, t, dt) {
    const pet = petById(p.pid);
    if (!pet || pet.sick) {
      p.moving = false;
      return;
    }
    if (p.moving) {
      if (!p.path || !p.path.length) p.path = [[p.tx, p.ty]];
      const wp = p.path[0];
      const dx = wp[0] - p.x;
      const dy = wp[1] - p.y;
      const d = Math.hypot(dx, dy);
      const v = 48 * dt;
      if (Math.abs(dx) > 1) p.flip = dx < 0;
      if (d <= v && p.path.length > 1) {
        p.x = wp[0];
        p.y = wp[1];
        p.path.shift();
      } else if (d <= v) {
        p.x = wp[0];
        p.y = wp[1];
        p.path = [];
        p.moving = false;
        if (p.goPlay) {
          p.goPlay = false;
          p.play = t + 2800;
          this.heart(p.x, p.y - 30);
          if (careUp(pet, 'mood', 3, 'playMood', CARE.playCap)) save();
          if (pet.id === state.petMain && Math.random() < 0.35) petSay('play');
        }
      } else {
        p.x += (dx / d) * v;
        p.y += (dy / d) * v;
      }
      return;
    }
    if (Math.random() < dt * 0.4) p.blink = t + 140;
    if (t < p.next || t < p.play) return;
    p.next = t + 2500 + Math.random() * 4000;
    const [x0, y0, x1, y1] = this.bounds();
    const fun = state.world.plants.filter((pl) => plantStage(pl) >= (pl.k === 'tree' ? 3 : 2));
    if (fun.length && Math.random() < 0.5) {
      const pl = fun[Math.floor(Math.random() * fun.length)];
      p.tx = (pl.x + (pl.k === 'tree' ? 1 : 0.5)) * TILE + (Math.random() - 0.5) * 20;
      p.ty = (pl.y + 1) * TILE + 8;
      p.goPlay = true;
    } else {
      p.tx = p.x + (Math.random() - 0.5) * 140;
      p.ty = p.y + (Math.random() - 0.5) * 90;
    }
    p.tx = Math.max(x0, Math.min(x1, p.tx));
    p.ty = Math.max(y0 + 8, Math.min(y1, p.ty));
    // 绕开房子、池塘和摆设走
    p.path = this.route(p.tx, p.ty, p);
    const last = p.path[p.path.length - 1];
    p.tx = last[0];
    p.ty = last[1];
    p.moving = true;
  };

  // 鱼：在池塘里慢慢游，停一停再换个方向；刚撒了鱼食就都游到一处
  Scene.prototype.stepFish = function (f, t, dt) {
    const dx = f.tx - f.x;
    const dy = f.ty - f.y;
    const d = Math.hypot(dx, dy);
    const v = (t < f.hop ? f.v * 3 : f.v) * dt;
    if (d > v) {
      f.x += (dx / d) * v;
      f.y += (dy / d) * v;
      if (Math.abs(dx) > 0.5) f.flip = dx < 0;
      return;
    }
    if (t < f.next) return;
    f.next = t + 600 + Math.random() * 2600;
    const fed = this.fishFed && t - this.fishFed < 4000;
    const [x, y] = fed ? this.fishBowl || (this.fishBowl = pondSpot()) : pondSpot();
    f.tx = x + (fed ? (Math.random() - 0.5) * 10 : 0);
    f.ty = y + (fed ? (Math.random() - 0.5) * 6 : 0);
    if (!fed) this.fishBowl = null;
  };

  // 花园里的小生命：蝴蝶在花间飞、樱花树下飘花瓣、池塘上一闪一闪的波光、慢慢飘过的云影
  function pondSpot() {
    const list = POND_INNER.length ? POND_INNER : [...GPOND];
    const [tx, ty] = list[Math.floor(Math.random() * list.length)].split(',').map(Number);
    return [tx * TILE + 3 + Math.random() * 10, ty * TILE + 4 + Math.random() * 8];
  }

  let cloudImgs = null;
  function cloudShadows() {
    if (cloudImgs) return cloudImgs;
    cloudImgs = [
      [[30, 24, 26, 13], [52, 20, 20, 12], [14, 28, 13, 8], [70, 27, 14, 9]],
      [[24, 20, 20, 11], [42, 16, 16, 10], [58, 22, 14, 9]],
    ].map((blobs) => {
      const q = new ART.Pix(96, 44);
      for (const [x, y, rx, ry] of blobs) q.ell(x, y, rx, ry, '#0d2a18');
      return q.toCanvas();
    });
    return cloudImgs;
  }
  const BUTTERFLY = ['#fbf7ef', '#f6d35b', '#9cc8f0'];

  Scene.prototype.ambient = function (t, dt) {
    if (this.kind !== 'garden') return;
    const [x0, y0, x1, y1] = this.bounds();
    const rx = () => x0 + Math.random() * (x1 - x0);
    const ry = () => y0 + Math.random() * (y1 - y0);
    const A = this.amb || (this.amb = { bf: BUTTERFLY.map((c, i) => ({ x: rx(), y: ry(), tx: rx(), ty: ry(), c, alt: 10, rest: 0, ph: i * 2 })), petals: [], glints: [], nextGlint: 0 });
    const flowers = state.world.plants.filter((pl) => pl.k === 'flower' && plantStage(pl) >= 2);
    for (const b of A.bf) {
      const d = Math.hypot(b.tx - b.x, b.ty - b.y);
      if (t < b.rest) {
        b.alt = Math.max(2, b.alt - dt * 20);
        continue;
      }
      if (d < 2) {
        // 落在花上歇一会儿，再飞去别处
        if (b.onFlower) b.rest = t + 1500 + Math.random() * 2500;
        const fl = flowers.length && Math.random() < 0.7 ? flowers[Math.floor(Math.random() * flowers.length)] : null;
        b.tx = fl ? fl.x * TILE + 8 : rx();
        b.ty = fl ? fl.y * TILE + 10 : ry();
        b.onFlower = !!fl;
        continue;
      }
      const v = 18 * dt;
      b.x += ((b.tx - b.x) / d) * Math.min(v, d) + Math.sin(t / 180 + b.ph) * 0.25;
      b.y += ((b.ty - b.y) / d) * Math.min(v, d) + Math.cos(t / 230 + b.ph) * 0.2;
      b.alt = Math.min(12, b.alt + dt * 20) + Math.sin(t / 160 + b.ph) * 0.3;
    }
    // 樱花瓣
    const sakura = state.world.plants.filter((pl) => pl.k === 'tree' && pl.sp === 'sakura' && pl.ok && pl.x >= 0);
    if (sakura.length && A.petals.length < 4 + sakura.length * 3 && Math.random() < dt * 1.5 * sakura.length) {
      const tr = sakura[Math.floor(Math.random() * sakura.length)];
      const cx = tr.x * TILE + TILE;
      const base = (tr.y + 1) * TILE;
      A.petals.push({ x: cx - 12 + Math.random() * 24, y: base - 40 + Math.random() * 18, ground: base + 2 + Math.random() * 12, ph: Math.random() * 6, life: 9 });
    }
    for (const q of A.petals) {
      q.life -= dt;
      if (q.y < q.ground) {
        q.y += 9 * dt;
        q.x += Math.sin(t / 400 + q.ph) * 10 * dt;
      }
    }
    A.petals = A.petals.filter((q) => q.life > 0);
    // 池塘波光
    if (POND_INNER.length && t > A.nextGlint) {
      A.nextGlint = t + 250 + Math.random() * 400;
      const [gx, gy] = POND_INNER[Math.floor(Math.random() * POND_INNER.length)].split(',').map(Number);
      A.glints.push({ x: gx * TILE + 2 + Math.floor(Math.random() * 11), y: gy * TILE + 2 + Math.floor(Math.random() * 12), t0: t });
    }
    A.glints = A.glints.filter((g) => t - g.t0 < 900);
  };

  // 在地面上、物件下面画：波光
  Scene.prototype.drawGround = function (ctx, t) {
    for (const f of this.fish) {
      const fish = petById(f.pid);
      if (!fish) continue;
      const img = ART.fishTop(fish.sp, Math.floor(t / (t < f.hop ? 90 : 220)) % 2, fish.sick);
      ctx.globalAlpha = 0.92;
      if (f.flip) {
        ctx.save();
        ctx.translate(Math.round(f.x) + img.width / 2, Math.round(f.y) - img.height / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else ctx.drawImage(img, Math.round(f.x) - img.width / 2, Math.round(f.y) - img.height / 2);
      ctx.globalAlpha = 1;
    }
    const A = this.amb;
    if (!A) return;
    for (const g of A.glints) {
      const k = (t - g.t0) / 900;
      const len = k < 0.3 || k > 0.75 ? 1 : 3;
      ctx.fillStyle = k > 0.3 && k < 0.75 ? '#e4f5ff' : '#a6d6f4';
      ctx.fillRect(g.x - (len >> 1), g.y, len, 1);
    }
  };

  // 在物件上面画：花瓣、蝴蝶、云影
  Scene.prototype.drawSky = function (ctx, t) {
    const A = this.amb;
    if (!A) return;
    for (const q of A.petals) {
      ctx.globalAlpha = Math.min(1, q.life / 2);
      ctx.fillStyle = '#f7b6cc';
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 1);
      ctx.fillStyle = '#fbd3e0';
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const b of A.bf) {
      const x = Math.round(b.x);
      const y = Math.round(b.y - b.alt);
      ctx.fillStyle = 'rgba(30,40,20,.25)';
      ctx.fillRect(x - 1, Math.round(b.y), 3, 1);
      const resting = t < b.rest;
      const open = Math.floor((t + b.ph * 100) / (resting ? 700 : 110)) % 2 === 0;
      ctx.fillStyle = b.c;
      if (open) {
        ctx.fillRect(x - 2, y - 1, 2, 2);
        ctx.fillRect(x + 1, y - 1, 2, 2);
        ctx.fillRect(x - 1, y + 1, 1, 1);
        ctx.fillRect(x + 1, y + 1, 1, 1);
      } else {
        ctx.fillRect(x - 1, y - 2, 1, 2);
        ctx.fillRect(x + 1, y - 2, 1, 2);
      }
      ctx.fillStyle = '#3a2a2a';
      ctx.fillRect(x, y - 1, 1, 3);
    }
    const imgs = cloudShadows();
    const W = this.w * TILE;
    ctx.globalAlpha = 0.09;
    for (let i = 0; i < 3; i++) {
      const img = imgs[i % 2];
      const span = W + img.width * 2;
      const x = Math.round(((t / 1000) * (5 + i * 1.5) + i * 230) % span) - img.width;
      const y = [30, 150, 230][i];
      ctx.drawImage(img, x, y);
    }
    ctx.globalAlpha = 1;
  };

  Scene.prototype.heart = function (x, y) {
    this.fx.push({ kind: 'heart', x, y, vy: -18, life: 1 });
  };

  Scene.prototype.drops = function (x, y) {
    for (let i = 0; i < 6; i++) this.fx.push({ kind: 'drop', x: x + (Math.random() - 0.5) * 12, y: y - 14 - Math.random() * 6, vy: 30 + Math.random() * 20, life: 0.5 });
  };

  Scene.prototype.sparkle = function (x, y) {
    for (let i = 0; i < 8; i++) this.fx.push({ kind: 'spark', x: x + (Math.random() - 0.5) * 18, y: y - 8 - Math.random() * 18, vy: -12, vx: (Math.random() - 0.5) * 16, life: 0.7 });
  };

  // 陪你背单词的那只在画面里的样子
  Scene.prototype.mainEnt = function () {
    return this.pets.find((e) => e.pid === state.petMain) || null;
  };

  Scene.prototype.say = function (text) {
    const e = this.mainEnt();
    if (!this.bubble || !e) return;
    this.bubble.textContent = text;
    this.bubbleUntil = performance.now() + 3400;
    e.play = Math.max(e.play, performance.now() + 1800);
  };

  Scene.prototype.draw = function (t) {
    const ctx = this.ctx;
    const cam = this.cam;
    const cx = Math.round(cam.x);
    const cy = Math.round(cam.y);
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.save();
    ctx.translate(-cx, -cy);
    let objs;
    if (this.kind === 'room') {
      ctx.drawImage(roomTerrain(), 0, 0);
      // 窗户照进来的光斑；壁炉一闪一闪的暖光
      for (const d of state.world.room) {
        if (d.id === 'window') {
          ctx.fillStyle = 'rgba(255,244,200,.2)';
          for (let j = 0; j < 30; j++) ctx.fillRect(d.x * TILE + 2 + Math.floor(j * 0.5), 2 * TILE + j, TILE - 4, 1);
        } else if (d.id === 'fireplace') {
          const fx = d.x * TILE + TILE;
          const fy = (d.y + 1) * TILE;
          const a = 0.16 + Math.sin(t / 130) * 0.03 + Math.sin(t / 47) * 0.02;
          const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 46);
          g.addColorStop(0, 'rgba(255,170,80,' + a.toFixed(3) + ')');
          g.addColorStop(1, 'rgba(255,170,80,0)');
          ctx.fillStyle = g;
          ctx.fillRect(fx - 46, fy - 46, 92, 92);
        }
      }
      objs = state.world.room.map((d) => {
        const [w, h] = decorSize(d.id);
        const o = objAt(ART.decor(d.id), d.x, d.y, w, h);
        if (ART.DECOR[d.id] && (ART.DECOR[d.id].flat || ART.DECOR[d.id].wall)) o.base = -1;
        return o;
      });
    } else {
      ctx.drawImage(gardenTerrain(state.world.plants), 0, 0);
      this.drawGround(ctx, t);
      objs = gardenObjects(state.world.plants, state.world.decor, true);
    }
    // 人物
    const av = this.av;
    const look = avatarLook();
    const af = t < av.act ? 'act' : av.walking ? (Math.floor(t / 150) % 2 ? 'walk2' : 'walk1') : 'idle';
    objs.push({ img: ART.avatar(look, af, av.dir), x: Math.round(av.x) - 8, y: Math.round(av.y) - 31, base: av.y, flip: av.dir === 'side' && av.flip, shadow: true });
    // 宠物
    const p = this.mainEnt();
    for (const e of this.pets) {
      const pet = petById(e.pid);
      if (!pet) continue;
      const talking = e === p && t < this.bubbleUntil;
      const pf = pet.sick ? 'sick' : e.moving ? (Math.floor(t / 140) % 2 ? 'walk2' : 'walk1') : t < e.play || talking ? 'happy' : t < e.blink ? 'blink' : 'idle';
      const hop = t < e.hop ? Math.round(Math.sin(((e.hop - t) / 400) * Math.PI) * 5) : 0;
      objs.push({ img: petCanvas(pf, pet), x: Math.round(e.x) - 16, y: Math.round(e.y) - 30 - hop, base: e.y, flip: e.flip, shadow: true, pet: true });
    }
    objs.sort((a, b) => a.base - b.base);
    for (const o of objs) {
      if (o.shadow) {
        ctx.fillStyle = 'rgba(40,30,20,.22)';
        ctx.beginPath();
        ctx.ellipse(o.x + o.img.width / 2, o.base, o.pet ? 9 : 6, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (o.flip) {
        ctx.save();
        ctx.translate(o.x + o.img.width, o.y);
        ctx.scale(-1, 1);
        ctx.drawImage(o.img, 0, 0);
        ctx.restore();
      } else ctx.drawImage(o.img, Math.round(o.x), Math.round(o.y));
      // 浇过水、施过肥的植物：闪一闪
      if (o.plant && (wateredToday(o.plant) || o.plant.f) && Math.floor(t / 400) % 3 === 0) {
        ctx.fillStyle = o.plant.f ? '#f6d35b' : '#bfe6ff';
        const sx = o.x + 3 + ((t / 37) % (o.img.width - 6));
        ctx.fillRect(Math.round(sx), Math.round(o.y + 2 + ((t / 53) % 8)), 1, 1);
      }
    }
    if (this.kind === 'garden') this.drawSky(ctx, t);
    // 特效：爱心、水滴、星星
    for (const f of this.fx) {
      const x = Math.round(f.x);
      const y = Math.round(f.y);
      if (f.kind === 'heart') {
        ctx.fillStyle = '#e85d75';
        for (const [dx, dy] of [[-2, 0], [-1, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [0, 3], [-1, -1], [1, -1]]) ctx.fillRect(x + dx, y + dy, 1, 1);
      } else if (f.kind === 'drop') {
        ctx.fillStyle = '#7fc0f0';
        ctx.fillRect(x, y, 1, 2);
      } else {
        ctx.fillStyle = '#fff1a8';
        ctx.fillRect(x, y, 1, 1);
        if (f.life > 0.35) {
          ctx.fillRect(x - 1, y, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
          ctx.fillRect(x, y - 1, 1, 1);
          ctx.fillRect(x, y + 1, 1, 1);
        }
      }
    }
    // 拿着工具时，鼠标下面的格子画个框：能放是白色，不能放是红色
    if (this.hover && ui.tool) {
      const [w, h] = this.toolSize();
      const ok = this.toolOk(this.hover[0], this.hover[1]);
      ctx.strokeStyle = ok ? 'rgba(255,255,255,.9)' : 'rgba(230,80,70,.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.hover[0] * TILE + 0.5, this.hover[1] * TILE + 0.5, w * TILE - 1, h * TILE - 1);
      ctx.fillStyle = ok ? 'rgba(255,255,255,.15)' : 'rgba(230,80,70,.15)';
      ctx.fillRect(this.hover[0] * TILE, this.hover[1] * TILE, w * TILE, h * TILE);
    }
    ctx.restore();
    // 四角稍微暗一点，画面更聚拢
    if (!this.vig || this.vig.w !== this.vw || this.vig.h !== this.vh) {
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.42, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.75);
      g.addColorStop(0, 'rgba(20,28,12,0)');
      g.addColorStop(1, this.kind === 'room' ? 'rgba(40,22,10,.22)' : 'rgba(16,30,14,.2)');
      this.vig = { w: this.vw, h: this.vh, g };
    }
    ctx.fillStyle = this.vig.g;
    ctx.fillRect(0, 0, this.vw, this.vh);
    // 宠物说话的气泡（HTML，跟着宠物走）
    if (this.bubble) {
      const show = p && performance.now() < this.bubbleUntil;
      this.bubble.classList.toggle('show', !!show);
      if (show) {
        this.bubble.style.left = this.canvas.offsetLeft + (p.x - cx) * this.scale + 'px';
        this.bubble.style.top = this.canvas.offsetTop + (p.y - 34 - cy) * this.scale + 'px';
      }
    }
    // 人物走到工具栏后面，工具栏就挪到画面上边；走开了再回到下边
    const tb = this.tb;
    if (tb && tb.isConnected) {
      const s = this.scale;
      const ax = this.canvas.offsetLeft + (this.av.x - cx) * s;
      const feet = this.canvas.offsetTop + (this.av.y - cy) * s;
      const top = this.wrap.clientHeight - TB_GAP - tb.offsetHeight;
      const under = feet > top - 2 && ax + 10 * s > tb.offsetLeft && ax - 10 * s < tb.offsetLeft + tb.offsetWidth;
      if (under !== tb.classList.contains('at-top')) tb.classList.toggle('at-top', under);
    }
  };

  Scene.prototype.toTile = function (ev) {
    const r = this.canvas.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * this.vw + this.cam.x;
    const py = ((ev.clientY - r.top) / r.height) * this.vh + this.cam.y;
    return [px, py, Math.floor(px / TILE), Math.floor(py / TILE)];
  };

  Scene.prototype.move = function (ev) {
    const [, , tx, ty] = this.toTile(ev);
    this.hover = [tx, ty];
  };

  Scene.prototype.toolSize = function () {
    const it = ITEMS.get(ui.tool);
    if (it && it.decor) return decorSize(it.decor);
    if (it && it.plant && it.plant[0] === 'tree') return [2, 1];
    return [1, 1];
  };

  // 拿着的工具能不能用在这个格子上
  Scene.prototype.toolOk = function (tx, ty) {
    const tool = ui.tool;
    if (this.kind === 'room') {
      if (tool === 'hand') return roomOcc().has(tx + ',' + ty);
      const it = ITEMS.get(tool);
      return !!(it && it.use === 'furnish' && roomFree(it.decor, tx, ty));
    }
    const occ = gardenOcc();
    const here = occ.get(tx + ',' + ty);
    if (tool === 'hand') return !!(here && here.decor);
    if (tool === 'shovel') return !!(here && here.plant);
    const it = ITEMS.get(tool);
    if (!it) return false;
    const growing = here && here.plant && plantStage(here.plant) < plantMax(here.plant);
    if (it.use === 'plant') return it.plant[0] === 'tree' ? gardenFree(tx, ty, 2, 1, occ) : gardenFree(tx, ty, 1, 1, occ);
    if (it.use === 'water') return !!(growing && !wateredToday(here.plant));
    if (it.use === 'fert') return !!(growing && here.plant.fd !== dayNum());
    if (it.use === 'place') {
      const [w, h] = decorSize(it.decor);
      return gardenFree(tx, ty, w, h, occ);
    }
    return false;
  };

  Scene.prototype.click = function (ev) {
    const [px, py, tx, ty] = this.toTile(ev);
    // 手里拿着工具：先用工具，不去摸宠物
    if (ui.tool) {
      this.useTool(tx, ty);
      return;
    }
    // 点到宠物：跳一下、冒个爱心，心情好一点（每只每天有上限）
    const hits = this.pets.filter((e) => Math.abs(px - e.x) < 14 && py > e.y - 30 && py < e.y + 2).sort((a, b) => b.y - a.y);
    if (hits.length) {
      const e = hits[0];
      const pet = petById(e.pid);
      e.hop = performance.now() + 400;
      this.heart(e.x, e.y - 32);
      if (pet && careUp(pet, 'mood', 1, 'petMood', CARE.petCap)) save();
      if (pet && pet.id === state.petMain) petSay(pet.sick ? 'sick' : 'click');
      return;
    }
    // 点到鱼：溅起水花，鱼开心一点
    const fh = this.fish.find((f) => Math.abs(px - f.x) < 8 && Math.abs(py - f.y) < 6);
    if (fh) {
      const f = petById(fh.pid);
      fh.hop = performance.now() + 500;
      fh.next = 0;
      this.drops(fh.x, fh.y + 14);
      if (f && careUp(f, 'mood', 4, 'fishPlay', 20)) save();
      return;
    }
    if (this.kind === 'room') {
      if (ty >= RH - 1 && RDOOR.includes(tx)) {
        this.walkTo((RDOOR[0] + 1) * TILE, RH * TILE - 2, () => goScene('garden'));
        return;
      }
      this.walkTo(px, py);
      return;
    }
    const here = gardenOcc().get(tx + ',' + ty);
    if (here && here.house) {
      this.walkTo(DOOR_X * TILE + TILE / 2, (HOUSE.y + HOUSE.h) * TILE + 4, () => goScene('room'));
      return;
    }
    if (here && here.plant) {
      const pl = here.plant;
      const st = plantStage(pl);
      const names = pl.k === 'tree' ? ['种子', '发芽', '小树苗', '小树', '长成大树了'] : pl.k === 'flower' ? ['刚种下', '发芽', '花苞', '开花了'] : ['刚种下', '发芽', '长好了'];
      const msg = plantName(pl) + ' · ' + names[st] + (st >= plantMax(pl) ? '' : ' · ' + (wateredToday(pl) ? '今天浇过水' : '今天还没浇水'));
      toast(msg);
    }
    this.walkTo(px, py + 4);
  };

  Scene.prototype.useTool = async function (tx, ty) {
    if (!this.toolOk(tx, ty)) {
      const here = this.kind === 'garden' && gardenOcc().get(tx + ',' + ty);
      const it = ITEMS.get(ui.tool);
      if (here && here.plant && it && (it.use === 'water' || it.use === 'fert')) {
        const pl = here.plant;
        toast(plantStage(pl) >= plantMax(pl) ? plantName(pl) + '已经长好了' : it.use === 'water' ? '今天浇过水了' : '今天施过肥了');
      } else toast(this.kind === 'room' ? '这里放不下' : '这里不行');
      return;
    }
    const tool = ui.tool;
    if (tool === 'shovel') {
      const pl = gardenOcc().get(tx + ',' + ty).plant;
      if (pl.k === 'tree' && !(await askConfirm('铲掉这棵' + plantName(pl) + '？铲掉就没有了。', '铲掉'))) return;
    }
    const it = ITEMS.get(tool);
    const [w, h] = this.toolSize();
    this.walkNear(tx, ty, w, h, () => {
      if (!this.toolOk(tx, ty)) return;
      const W = state.world;
      const cx = (tx + w / 2) * TILE;
      const cy = (ty + h) * TILE;
      if (this.kind === 'room') {
        if (tool === 'hand') {
          const d = roomOcc().get(tx + ',' + ty);
          W.room = W.room.filter((x) => x !== d);
          bagAdd('furn.' + d.id, 1);
        } else {
          W.room.push({ id: it.decor, x: tx, y: ty });
          bagAdd(tool, -1);
          this.sparkle(cx, cy);
          checkAchievements();
        }
      } else {
        const here = gardenOcc().get(tx + ',' + ty);
        if (tool === 'hand') {
          W.decor = W.decor.filter((x) => x !== here.decor);
          bagAdd('decor.' + here.decor.id, 1);
        } else if (tool === 'shovel') {
          W.plants = W.plants.filter((x) => x !== here.plant);
        } else if (it.use === 'plant') {
          W.plants.push({ k: it.plant[0], sp: it.plant[1], x: tx, y: ty, t: dayNum(), w: [], f: 0 });
          bagAdd(tool, -1);
        } else if (it.use === 'water' || it.use === 'fert') {
          const pl = here.plant;
          const before = plantStage(pl);
          if (it.use === 'water') {
            pl.w = (pl.w || []).concat(dayNum());
            const d = pday();
            d.water = (d.water || 0) + 1;
            this.drops((pl.x + plantSize(pl)[0] / 2) * TILE, (pl.y + 1) * TILE);
            checkChallenges();
          } else {
            pl.f = (pl.f || 0) + 1;
            pl.fd = dayNum();
            this.sparkle((pl.x + plantSize(pl)[0] / 2) * TILE, (pl.y + 1) * TILE);
          }
          bagAdd(tool, -1);
          // 刚好长好：记一笔，树长成大树宠物会说一句
          if (before < plantMax(pl) && plantStage(pl) >= plantMax(pl)) {
            if (!W.grown) W.grown = { t: 0, f: 0 };
            if (pl.k === 'tree') {
              W.grown.t++;
              toast(plantName(pl) + '长成大树了');
              if (Math.random() < 0.7) petSay('grown');
            } else if (pl.k === 'flower') W.grown.f++;
          }
        } else if (it.use === 'place') {
          W.decor.push({ id: it.decor, x: tx, y: ty });
          bagAdd(tool, -1);
          this.sparkle(cx, cy);
        }
        checkAchievements();
      }
      if (tool !== 'hand' && tool !== 'shovel' && !bagHas(tool)) ui.tool = null;
      save();
      refreshSceneUi();
    });
  };

  Scene.prototype.key = function (ev, down) {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
    const k = map[ev.key];
    if (!k) return false;
    this.keys[k] = down;
    return true;
  };

  // 换到花园 / 小屋（不重画整页，只换画面）
  function goScene(kind) {
    if (scene) scene.stop();
    scene = null;
    ui.tool = null;
    go(kind);
  }

  // 背包里能在这里用的东西
  function sceneTools(kind) {
    const out = [];
    for (const id in state.world.bag) {
      const it = ITEMS.get(id);
      if (!it) continue;
      if (kind === 'room' ? it.use === 'furnish' : ['plant', 'water', 'fert', 'place'].includes(it.use)) out.push(it);
    }
    return out;
  }

  function toolbarHtml(kind) {
    const free = kind === 'room' ? [['hand', '收回', ART.icon('hand')]] : [['hand', '收回', ART.icon('hand')], ['shovel', '铲掉', ART.icon('shovel')]];
    const tools = sceneTools(kind);
    const btn = (id, name, img, n) =>
      '<button class="tool' + (ui.tool === id ? ' on' : '') + '" data-act="tool" data-id="' + esc(id) + '" title="' + esc(name) + '">' + pxImg(img, 2) + (n != null ? '<span class="n">' + n + '</span>' : '') + '<span class="tn">' + esc(name) + '</span></button>';
    return (
      '<div class="toolbar" id="toolbar">' +
      free.map(([id, name, img]) => btn(id, name, img)).join('') +
      '<span class="tsep"></span>' +
      (tools.length ? tools.map((it) => btn(it.id, it.name.replace(/ ×\d+$/, ''), itemIcon(it), state.world.bag[it.id])).join('') : '<span class="muted small">背包里没有' + (kind === 'room' ? '家具' : '种子、水和装饰') + '</span><button class="link" data-act="openShelf" data-shelf="' + (kind === 'room' ? 'furniture' : 'treeseeds') + '">去买</button>') +
      '</div>'
    );
  }

  function refreshSceneUi() {
    const tb = document.getElementById('toolbar');
    if (tb) tb.outerHTML = toolbarHtml(ui.view === 'room' ? 'room' : 'garden');
    const st = document.getElementById('g-stats');
    if (st) st.innerHTML = gardenStatsHtml();
    renderBag();
    const pts = document.querySelector('.pts');
    if (pts) pts.lastChild.textContent = fmt(state.points.bal);
  }

  function gardenStatsHtml() {
    const s = summarize(state.world.plants, []);
    const parts = ['树 ' + s.t, '花 ' + s.f, '草 ' + s.g, '灌木 ' + s.s];
    const growing = state.world.plants.filter((pl) => plantStage(pl) < plantMax(pl)).length;
    if (growing) parts.push('在长 ' + growing);
    return parts.join(' · ');
  }

  // ---------- 花园页 ----------

  VIEWS.garden = function () {
    const next = LANDS[(state.world.land || 0) + 1];
    return (
      '<main class="page wide">' +
      '<div class="g-top"><div><h1 class="h1">花园</h1><p class="muted"><span id="g-stats">' + gardenStatsHtml() + '</span></p></div>' +
      '<div class="actions"><span class="zoom"><button class="btn ghost small" data-act="zoom" data-d="-1" title="拉远（−）">−</button><span id="zoom-v" class="muted small"></span><button class="btn ghost small" data-act="zoom" data-d="1" title="拉近（+）">+</button></span>' +
      (next ? '<button class="btn ghost small" data-act="buyLand" title="' + next.w + ' × ' + (next.h + OY) + ' 格">扩建 · ' + fmt(next.price) + '</button>' : '') +
      '<button class="btn ghost small" data-act="goRoom">回家</button></div></div>' +
      '<div class="scene-wrap" id="scene-wrap"><canvas class="scene" id="scene"></canvas><div class="scene-bubble"></div>' + toolbarHtml('garden') + '</div>' +
      '</main>'
    );
  };

  VIEWS.room = function () {
    return (
      '<main class="page wide">' +
      '<div class="g-top"><div><h1 class="h1">' + HOUSES[houseLevel()].name + '</h1><p class="muted">家具 ' + state.world.room.length + ' 件</p></div>' +
      '<div class="actions">' + (HOUSES[houseLevel() + 1] ? '<button class="btn ghost small" data-act="buyHouse">扩建成' + HOUSES[houseLevel() + 1].name + ' · ' + fmt(HOUSES[houseLevel() + 1].price) + '</button>' : '') + '<button class="btn ghost small" data-act="goGarden">出门</button></div></div>' +
      '<div class="scene-wrap room" id="scene-wrap"><canvas class="scene" id="scene"></canvas><div class="scene-bubble"></div>' + toolbarHtml('room') + '</div>' +
      '</main>'
    );
  };

  function attachScene(kind) {
    const canvas = document.getElementById('scene');
    const wrap = document.getElementById('scene-wrap');
    if (!canvas) return;
    if (!scene || scene.kind !== kind) {
      if (scene) scene.stop();
      scene = new Scene(kind);
    }
    scene.attach(canvas, wrap);
  }

  AFTER.garden = function () {
    attachScene('garden');
    const z = document.getElementById('zoom-v');
    if (z && scene) z.textContent = scene.scale + '×';
  };

  AFTER.room = function () {
    attachScene('room');
  };

  // ---------- 背包（右下角） ----------

  const bagLayer = document.createElement('div');
  bagLayer.className = 'bag-layer';
  document.body.appendChild(bagLayer);

  function bagTotal() {
    let n = 0;
    for (const id in state.world.bag) n += state.world.bag[id];
    return n;
  }

  // 一件东西的效果（背包和商店里的小字）
  function itemNote(it) {
    if (it.use === 'feed') return '饱腹 +' + it.food + (it.mood ? ' · 心情 +' + it.mood : '');
    if (it.use === 'toy') return '心情 +' + it.mood;
    return '';
  }

  function renderBag() {
    const ids = Object.keys(state.world.bag).filter((id) => ITEMS.has(id));
    const order = [...ITEMS.keys()];
    ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const sel = ITEMS.get(ui.bagPick);
    let panel = '';
    if (ui.bagOpen) {
      let detail = '';
      if (sel && bagHas(sel.id)) {
        const acts = [];
        if (['plant', 'water', 'fert', 'place'].includes(sel.use)) acts.push('<button class="btn small" data-bag="garden">去花园用</button>');
        if (sel.use === 'furnish') acts.push('<button class="btn small" data-bag="room">摆进屋里</button>');
        if (sel.use === 'fishfood') acts.push(fishList().length ? '<button class="btn small" data-bag="fish">撒进池塘</button>' : '<span class="muted small">池塘里还没有鱼</span>');
        if (['feed', 'toy', 'medicine'].includes(sel.use)) {
          const pets = landPets().concat(sel.use === 'medicine' ? fishList() : []).filter((p) => (sel.use === 'medicine' ? p.sick : !p.sick));
          if (pets.length) acts.push('<span class="muted small">' + (sel.use === 'feed' ? '喂给' : sel.use === 'toy' ? '给' : '喂药') + '</span>' + pets.map((p) => '<button class="btn small" data-bag="care" data-pet="' + p.id + '">' + esc(p.name) + '</button>').join(''));
          else acts.push('<span class="muted small">' + (sel.use === 'medicine' ? '没有宠物生病' : state.pets.length ? '宠物生病了，先喂药' : '还没有宠物') + '</span>');
        }
        detail = '<div class="bag-detail"><b>' + esc(sel.name) + '</b><span class="muted">×' + state.world.bag[sel.id] + (itemNote(sel) ? ' · ' + itemNote(sel) : '') + '</span><div class="actions">' + acts.join('') + '</div></div>';
      }
      panel =
        '<div class="bag" role="dialog" aria-label="背包"><div class="bag-head"><b>背包</b><button class="link" data-bag="shop">商店</button><button class="bag-x" data-bag="close" aria-label="关上">×</button></div>' +
        (ids.length
          ? '<div class="bag-grid">' +
            ids.map((id) => '<button class="slot' + (ui.bagPick === id ? ' on' : '') + '" data-bag="pick" data-id="' + esc(id) + '" title="' + esc(ITEMS.get(id).name) + '">' + pxImg(itemIcon(ITEMS.get(id)), 2) + '<span class="n">' + state.world.bag[id] + '</span></button>').join('') +
            '</div>' + detail
          : '<p class="muted bag-empty">空的</p>') +
        '</div>';
    }
    const n = bagTotal();
    bagLayer.innerHTML = panel + '<button class="bag-btn' + (ui.bagOpen ? ' on' : '') + '" data-bag="toggle" title="背包">' + pxImg(ART.icon('bag'), 2) + (n ? '<span class="n">' + n + '</span>' : '') + '</button>';
  }

  // 照顾宠物：喂饭、玩玩具、喂药
  function careUse(p, id) {
    const it = ITEMS.get(id);
    if (!p || !it || !bagHas(id)) return false;
    if (it.use === 'medicine') {
      if (!p.sick) return toast(p.name + '没生病，药先留着'), false;
      bagAdd(id, -1);
      p.sick = false;
      p.food = Math.max(p.food, CARE.cure);
      p.mood = Math.max(p.mood, CARE.cure);
      p.day = dayNum();
      save();
      if (p === mainPet()) setTimeout(() => petSay('cured'), 200);
      else toast(p.name + '好起来了');
      return true;
    }
    if (p.sick) return toast(p.name + '生病了，先喂药'), false;
    bagAdd(id, -1);
    if (it.use === 'feed') {
      careUp(p, 'food', it.food);
      careUp(p, 'mood', it.mood || 0);
      const d = pday();
      d.feed = (d.feed || 0) + 1;
      floatMood('饱腹 +' + it.food);
      if (p === mainPet()) petSay('fed');
      checkChallenges();
    } else {
      careUp(p, 'mood', it.mood);
      floatMood('+' + it.mood);
      if (p === mainPet()) petSay('toy');
    }
    save();
    return true;
  }

  // 撒一份鱼食：池塘里的鱼都吃饱
  function feedFish() {
    const fish = fishList().filter((f) => !f.sick);
    if (!bagHas('fishfood')) return toast('背包里没有鱼食');
    if (!fish.length) return toast(fishList().length ? '鱼生病了，先喂药' : '池塘里还没有鱼');
    bagAdd('fishfood', -1);
    for (const f of fish) {
      f.food = 100;
      careUp(f, 'mood', 5);
    }
    const d = pday();
    d.feed = (d.feed || 0) + 1;
    checkChallenges();
    save();
    floatMood('鱼都吃饱了');
    if (scene && scene.kind === 'garden') scene.fishFed = performance.now();
    return true;
  }

  function floatMood(text) {
    const pts = document.querySelector('.pts');
    if (!pts) return;
    const r = pts.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'pts-float mood';
    s.textContent = '♥ ' + text;
    s.style.left = r.left + r.width / 2 + 'px';
    s.style.top = r.bottom + 4 + 'px';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }

  bagLayer.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-bag]');
    if (!t) return;
    const a = t.dataset.bag;
    if (a === 'toggle') ui.bagOpen = !ui.bagOpen;
    else if (a === 'close') ui.bagOpen = false;
    else if (a === 'pick') ui.bagPick = t.dataset.id;
    else if (a === 'shop') {
      ui.bagOpen = false;
      ui.shopTab = 'seeds';
      go('shop');
      return;
    } else if (a === 'garden' || a === 'room') {
      ui.bagOpen = false;
      if (ui.view !== a) {
        if (scene) scene.stop();
        scene = null;
        go(a);
      }
      ui.tool = ui.bagPick;
      refreshSceneUi();
      return;
    } else if (a === 'care') {
      if (careUse(petById(+t.dataset.pet), ui.bagPick)) {
        if (!bagHas(ui.bagPick)) ui.bagPick = null;
        render();
        return;
      }
    } else if (a === 'fish') {
      if (feedFish()) {
        if (!bagHas('fishfood')) ui.bagPick = null;
        render();
        return;
      }
    }
    renderBag();
  });

  // ---------- 商店 ----------

  // 商店的分栏；卖东西的几栏下面再按类别分
  const SHOP_TABS = [
    ['status', '我的宠物'],
    ['adopt', '宠物店'],
    ['seeds', '种子', ['treeseeds', 'seeds']],
    ['supplies', '用品', ['petcare', 'garden']],
    ['home', '家园', ['decor', 'furniture', 'build']],
    ['style', '装扮', ['look', 'petlook']],
    ['goals', '挑战与成就'],
    ['rules', '金币规则'],
  ];
  const tabOfShelf = (id) => (SHOP_TABS.find((t) => t[2] && t[2].includes(id)) || SHOP_TABS[2])[0];

  function shopTab() {
    return SHOP_TABS.some((t) => t[0] === ui.shopTab) ? ui.shopTab : 'status';
  }

  // 「我的宠物」里每只都有自己的画面，页面上走动的那只就先藏起来
  function onPetTab() {
    return ui.view === 'shop' && shopTab() === 'status';
  }

  function pointsPanelHtml() {
    const p = state.points;
    const lv = levelOf(p.earned);
    const lo = levelNeed(lv);
    const hi = levelNeed(lv + 1);
    const d = pday();
    return (
      '<div class="pts-panel">' +
      '<div class="pp-main"><p class="label">金币</p><div class="pp-num">' + fmt(p.bal) + '</div>' +
      '<p class="muted">今天 +' + fmt(d.e) + (d.x ? ' · 扣 ' + fmt(d.x) : '') + (d.s ? ' · 花了 ' + fmt(d.s) : '') + '</p></div>' +
      '<div class="pp-lv"><p class="label">等级</p><div class="pp-num">Lv ' + lv + '</div>' +
      '<div class="bar"><i style="width:' + Math.min(100, ((p.earned - lo) / (hi - lo)) * 100) + '%"></i></div>' +
      '<p class="muted">再赚 ' + fmt(hi - p.earned) + ' 升到 Lv ' + (lv + 1) + '</p></div>' +
      '</div>'
    );
  }

  function challengesHtml(compact) {
    const d = pday();
    const rows = todayChallenges()
      .map((c) => {
        const v = Math.min(c.goal, c.val(d));
        const done = !!d.ch[c.id];
        return (
          '<div class="ch' + (done ? ' done' : '') + '"><span class="ch-mark">' + (done ? ICON_OK : '') + '</span>' +
          '<span class="ch-t">' + c.text + '</span><span class="ch-p">' + (c.goal > 1 ? v + ' / ' + c.goal : '') + '</span><span class="ch-r">+' + c.reward + '</span></div>'
        );
      })
      .join('');
    return '<section class="panel challenges' + (compact ? ' compact' : '') + '"><div class="head-row"><p class="label">今日挑战</p></div>' + rows + '</section>';
  }

  function achievementsHtml() {
    const p = state.points;
    const done = ACHIEVEMENTS.filter((a) => p.ach[a.id]).length;
    return (
      '<section class="panel achs"><div class="head-row"><h2 class="h2">成就</h2><span class="muted">' + done + ' / ' + ACHIEVEMENTS.length + '</span></div><div class="ach-grid">' +
      ACHIEVEMENTS.map((a) => {
        const got = !!p.ach[a.id];
        const v = Math.min(a.goal, a.val());
        return (
          '<div class="ach' + (got ? ' got' : '') + '"><span class="ach-ic">' + ICON_SPARK + '</span><div><b>' + a.name + '</b><span>' + a.desc + '</span>' +
          '<span class="ach-p">' + (got ? '已获得 +' + a.reward : fmt(v) + ' / ' + fmt(a.goal) + ' · +' + a.reward) + '</span></div></div>'
        );
      }).join('') +
      '</div></section>'
    );
  }

  function careBar(label, v, sick) {
    const n = Math.round(v || 0);
    return '<div class="care"><span>' + label + '</span><div class="bar mood' + (sick ? ' sick' : n < 30 ? ' low' : '') + '"><i style="width:' + (sick ? 100 : n) + '%"></i></div><b>' + (sick ? '—' : n) + '</b></div>';
  }

  // 背包里能给这只用的东西
  function careButtons(p) {
    const uses = p.sick ? ['medicine'] : isFish(p) ? [] : ['feed', 'toy'];
    const ids = Object.keys(state.world.bag).filter((id) => {
      const it = ITEMS.get(id);
      return it && uses.includes(it.use);
    });
    return ids.map((id) => '<button class="use" data-act="careUse" data-pet="' + p.id + '" data-id="' + esc(id) + '" title="' + esc(ITEMS.get(id).name + ' · ' + itemNote(ITEMS.get(id))) + '">' + pxImg(itemIcon(ITEMS.get(id)), 2) + '<span class="n">' + state.world.bag[id] + '</span></button>').join('');
  }

  // 一只宠物的卡片：画面、名字、饱腹和心情、能用的东西
  function petCardHtml(p) {
    const sp = SPECIES.get(p.sp);
    const main = p.id === state.petMain;
    const ward = ui.wardPet === p.id;
    const own = SHELVES.find((x) => x.id === 'petlook').items.filter((it) => state.petWardrobe.includes(it.id));
    return (
      '<section class="panel pet-home' + (p.sick ? ' sick' : '') + '"><div class="ph-grid">' +
      '<div class="pet-stage' + (p.sick ? ' sick' : '') + '" data-pet="' + p.id + '"><div class="pet-bubble"></div><div class="pet-hop">' + pxImg(petCanvas(p.sick ? 'sick' : 'idle', p), 4, 'stage-img') + '</div></div>' +
      '<div class="ph-info"><h2 class="h2">' + esc(p.name) + ' <button class="link" data-act="renamePet" data-pet="' + p.id + '">改名</button></h2>' +
      '<p class="muted">' + sp.name + ' · 第 ' + petAge(p) + ' 天 · <b class="' + (petLow(p) ? 'bad' : '') + '">' + petLabel(p) + '</b></p>' +
      careBar('饱腹', p.food, p.sick) + careBar('心情', p.mood, p.sick) +
      '<div class="use-row">' + careButtons(p) + '<button class="link" data-act="openShelf" data-shelf="petcare">' + (p.sick && !bagHas('medicine') ? '买药' : '买吃的和玩具') + '</button></div>' +
      '<div class="actions">' +
      (main ? '<span class="tag">正在陪你背单词</span>' : '<button class="btn small ghost" data-act="setMain" data-pet="' + p.id + '">陪我背单词</button>') +
      (own.length ? '<button class="btn small ghost" data-act="wardPet" data-pet="' + p.id + '">' + (ward ? '收起衣柜' : '换装扮') + '</button>' : '') +
      '</div></div></div>' +
      (ward
        ? '<div class="shop-grid ward">' +
          own.map((it) => {
            const on = p.wear[it.slot] === it.id;
            return '<button class="shop-item' + (on ? ' on' : '') + '" data-act="wearPet" data-pet="' + p.id + '" data-id="' + it.id + '">' + pxImg(petCanvas('idle', Object.assign({}, p, { wear: Object.assign({}, p.wear, { [it.slot]: it.id }) })), 2) + '<span class="si-name">' + it.name + '</span><span class="si-meta">' + (on ? '戴着' : '戴上') + '</span></button>';
          }).join('') +
          '</div>'
        : '') +
      '</section>'
    );
  }

  // 池塘里的鱼：一起喂
  function pondHtml() {
    const fish = fishList();
    if (!fish.length) return '';
    return (
      '<section class="panel pond-card"><div class="head-row"><h2 class="h2">观赏鱼</h2><span class="muted">' + fish.length + ' 条</span></div>' +
      '<div class="fish-grid">' +
      fish.map((f) => '<div class="fish' + (f.sick ? ' sick' : '') + '">' + pxImg(petCanvas('idle', f), 3) + '<div><b>' + esc(f.name) + '</b> <button class="link" data-act="renamePet" data-pet="' + f.id + '">改名</button><span class="muted small">' + SPECIES.get(f.sp).name + ' · ' + petLabel(f) + '</span>' + careBar('饱腹', f.food, f.sick) + careBar('心情', f.mood, f.sick) + (f.sick ? '<div class="use-row">' + careButtons(f) + '</div>' : '') + '</div></div>').join('') +
      '</div><div class="actions">' + (bagHas('fishfood') ? '<button class="btn small" data-act="feedFish">撒鱼食 · 还有 ' + state.world.bag.fishfood + ' 份</button>' : '<button class="btn small ghost" data-act="openShelf" data-shelf="petcare">买鱼食</button>') +
      '</div></section>'
    );
  }

  function petStatusHtml() {
    const land = landPets();
    let html = '';
    if (!state.pets.length) html += '<section class="panel empty-pet"><p class="muted">还没有宠物</p><button class="btn" data-act="openShop" data-tab="adopt">去宠物店</button></section>';
    html += land.map(petCardHtml).join('') + pondHtml();
    if (state.petGraves.length)
      html +=
        '<section class="panel memorial"><h2 class="h2">纪念</h2><div class="graves">' +
        state.petGraves.slice(-12).reverse().map((g) => '<div class="grave">' + pxImg(ART.pet(g.sp, 'sleep'), 2, 'gray') + '<span><b>' + esc(g.name) + '</b><span class="muted small">陪了你 ' + (g.died - g.born + 1) + ' 天</span></span></div>').join('') +
        '</div></section>';
    return html;
  }

  const PET_KINDS = [
    ['all', '全部'],
    ['dog', '猫狗'],
    ['small', '小动物'],
    ['bird', '鸟'],
    ['wild', '野生动物'],
    ['fish', '观赏鱼'],
  ];

  function adoptHtml() {
    const kind = PET_KINDS.some((k) => k[0] === ui.petKind) ? ui.petKind : 'all';
    const list = PETS.species.filter((sp) => kind === 'all' || sp.kind === kind);
    const pick = list.some((sp) => sp.id === ui.petPick) ? ui.petPick : list[0].id;
    const sp = SPECIES.get(pick);
    const have = state.pets.filter((p) => p.sp === pick).length;
    const cards = list
      .map((x) => '<button class="pet-card' + (x.id === pick ? ' on' : '') + '" data-act="petPick" data-id="' + x.id + '">' + pxImg(ART.pet(x.id, 'idle'), 2) + '<span class="pc-name">' + x.name + '</span><span class="pc-meta">' + fmt(x.price) + ' 金币</span></button>')
      .join('');
    return (
      '<div class="shelf-tabs">' + PET_KINDS.map(([id, l]) => '<button class="chip' + (id === kind ? ' on' : '') + '" data-act="adoptKind" data-kind="' + id + '">' + l + '</button>').join('') + '</div>' +
      '<section class="panel adopt"><div class="pet-grid">' + cards + '</div>' +
      '<div class="adopt-pick">' + pxImg(ART.pet(pick, 'happy'), 3) + '<div><b>' + sp.name + '</b><span class="muted small">' + fmt(sp.price) + ' 金币' + (have ? ' · 已经有 ' + have + (sp.fish ? ' 条' : ' 只') : '') + '</span></div>' +
      '<button class="btn" data-act="buyPet" data-id="' + pick + '"' + (state.points.bal >= sp.price ? '' : ' disabled') + '>买一只</button></div></section>'
    );
  }

  // 戴上 it 之后的样子（预览用陪你背单词的那只，没有宠物就用小螃蟹）
  function petPreview(it) {
    const p = mainPet() || { sp: 'crab', wear: {} };
    return petCanvas('idle', Object.assign({}, p, { wear: Object.assign({}, p.wear, { [it.slot]: it.id }) }));
  }

  // 商店里一件东西的样子
  function shelfPreview(it) {
    if (it.shelf === 'look') {
      const look = Object.assign(avatarLook(), it.look);
      return pxImg(ART.avatar(look, 'idle', 'front'), 2);
    }
    if (it.shelf === 'petlook') return pxImg(petPreview(it), 2);
    if (it.decor) {
      const c = ART.decor(it.decor);
      return pxImg(c, c.width > 32 ? 1 : 2);
    }
    if (it.plant) {
      const [k, sp] = it.plant;
      if (k === 'tree') return pxImg(ART.tree(sp, 4), 1);
      return pxImg(k === 'flower' ? ART.flower(sp, 3) : k === 'grass' ? ART.grass(sp, 2) : ART.shrub(sp, 2), 3);
    }
    return pxImg(itemIcon(it), 3);
  }

  function shelfItemHtml(it) {
    let meta;
    let act;
    if (it.shelf === 'look') {
      const owned = state.world.owned.includes(it.id);
      const on = state.world.look[it.slot] === it.id;
      meta = on ? '穿着' : owned ? '已拥有' : fmt(it.price) + ' 金币';
      act = '<button class="btn small' + (on ? ' ghost' : '') + '" data-act="lookItem" data-id="' + it.id + '">' + (on ? '脱下' : owned ? '穿上' : '买') + '</button>';
    } else if (it.shelf === 'petlook') {
      const owned = state.petWardrobe.includes(it.id);
      meta = owned ? '已拥有' : fmt(it.price) + ' 金币';
      act = owned ? '<button class="btn small ghost" data-act="openShop" data-tab="status">去换</button>' : '<button class="btn small" data-act="buyPetLook" data-id="' + it.id + '">买</button>';
    } else {
      const n = state.world.bag[it.id] || 0;
      meta = fmt(it.price) + ' 金币' + (n ? ' · 有 ' + n : '');
      act = '<button class="btn small" data-act="buyItem" data-id="' + it.id + '">买</button>';
    }
    const note = itemNote(it);
    return '<div class="shop-item">' + '<div class="si-pic">' + shelfPreview(it) + '</div><span class="si-name">' + esc(it.name) + '</span>' + (note ? '<span class="si-note">' + note + '</span>' : '') + '<span class="si-meta">' + meta + '</span>' + act + '</div>';
  }

  // 扩建花园的卡片
  function landHtml() {
    const lv = state.world.land || 0;
    const next = LANDS[lv + 1];
    if (!next) return '<div class="shop-item land"><div class="si-pic">' + pxImg(ART.icon('shovel'), 3) + '</div><span class="si-name">花园已经扩建到最大</span><span class="si-meta">' + LANDS[lv].w + ' × ' + (LANDS[lv].h + OY) + ' 格</span></div>';
    return (
      '<div class="shop-item land"><div class="si-pic">' + pxImg(ART.icon('shovel'), 3) + '</div><span class="si-name">扩建花园</span>' +
      '<span class="si-note">' + LANDS[lv].w + ' × ' + (LANDS[lv].h + OY) + ' → ' + next.w + ' × ' + (next.h + OY) + ' 格</span>' +
      '<span class="si-meta">' + fmt(next.price) + ' 金币</span><button class="btn small" data-act="buyLand">扩建</button></div>'
    );
  }

  // 扩建房子的卡片
  function houseHtml() {
    const lv = houseLevel();
    const next = HOUSES[lv + 1];
    const pic = (h) => pxImg(ART.decor(h.sprite), 0.75);
    if (!next) return '<div class="shop-item land"><div class="si-pic">' + pic(HOUSES[lv]) + '</div><span class="si-name">' + HOUSES[lv].name + '</span><span class="si-meta">已经是最大的房子</span></div>';
    return (
      '<div class="shop-item land"><div class="si-pic">' + pic(next) + '</div><span class="si-name">扩建成' + next.name + '</span>' +
      '<span class="si-note">屋里 ' + next.room[0] + ' × ' + next.room[1] + ' 格</span>' +
      '<span class="si-meta">' + fmt(next.price) + ' 金币</span><button class="btn small" data-act="buyHouse">扩建</button></div>'
    );
  }

  function shelfHtml(tab) {
    const ids = SHOP_TABS.find((t) => t[0] === tab)[2];
    const cur = ids.includes(ui.shelf) ? ui.shelf : ids[0];
    const name = (id) => (id === 'build' ? '扩建' : SHELVES.find((s) => s.id === id).name);
    const items = cur === 'build' ? [] : SHELVES.find((s) => s.id === cur).items.map((it) => ITEMS.get(it.id));
    return (
      '<div class="shelf-tabs">' + ids.map((id) => '<button class="chip' + (id === cur ? ' on' : '') + '" data-act="openShelf" data-shelf="' + id + '">' + name(id) + '</button>').join('') + '</div>' +
      '<section class="panel"><div class="shop-grid">' + (cur === 'build' ? landHtml() + houseHtml() : items.map(shelfItemHtml).join('')) + '</div></section>'
    );
  }

  function rulesHtml() {
    return (
      '<section class="panel rules"><h2 class="h2">金币</h2><ul>' +
      '<li>答对一题 +' + PTS.right + '，每连对 5 题再 +' + PTS.combo + '</li>' +
      '<li>背完一组新词：组里有几个词就 +几；全对再 +' + PTS.perfect + '</li>' +
      '<li>学完一组词根 +' + PTS.rootDone + '，全对再 +' + PTS.rootPerfect + '</li>' +
      '<li>每日新词目标 +' + PTS.goal + '，每日词根目标 +' + PTS.rootGoal + '，每日挑战和成就另有奖励</li>' +
      '<li>以前错过的词再答错 −' + PTS.again + '</li>' +
      '</ul><h2 class="h2" style="margin-top:22px">宠物</h2><ul>' +
      '<li>饱腹每天 −' + CARE.food + '，心情每天 −' + CARE.mood + '；喂饭、玩具、在花园玩、陪你背单词、摸摸它都会回升</li>' +
      '<li>饱腹或心情掉到 0 会生病，吃药才能好；生病 ' + CARE.sickDays + ' 天没吃药就会死</li>' +
      '</ul><h2 class="h2" style="margin-top:22px">花园</h2><ul>' +
      '<li>买种子种下，每天浇一次水长一阶，施一次肥也长一阶</li>' +
      '<li>树从种子长成大树要 4 阶，花 3 阶，草和灌木 2 阶</li>' +
      '</ul></section>'
    );
  }

  VIEWS.shop = function () {
    petsTick();
    const tab = shopTab();
    const body = { status: petStatusHtml, adopt: adoptHtml, goals: () => challengesHtml(false) + achievementsHtml(), rules: rulesHtml }[tab] ? { status: petStatusHtml, adopt: adoptHtml, goals: () => challengesHtml(false) + achievementsHtml(), rules: rulesHtml }[tab]() : shelfHtml(tab);
    return (
      '<main class="page">' +
      '<h1 class="h1">商店</h1>' +
      pointsPanelHtml() +
      '<div class="shop-tabs">' + SHOP_TABS.map(([id, label]) => '<button class="chip' + (id === tab ? ' on' : '') + '" data-act="openShop" data-tab="' + id + '">' + label + '</button>').join('') + '</div>' +
      body +
      '</main>'
    );
  };

  // 首页的花园卡片：宠物好不好、今天还有多少株没浇水
  function gardenCardHtml() {
    const pets = state.pets.filter((p) => SPECIES.has(p.sp));
    const need = pets.filter(petLow);
    const thirsty = state.world.plants.filter((pl) => plantStage(pl) < plantMax(pl) && !wateredToday(pl)).length;
    const pics = landPets().slice(0, 4).map((p) => pxImg(petCanvas(p.sick ? 'sick' : 'idle', p), 2)).join('');
    let h;
    let sub;
    if (!pets.length) {
      h = '还没有宠物';
      sub = '';
    } else {
      h = need.length ? need.map((p) => p.name + petLabel(p)).slice(0, 3).join('，') : pets.length + ' 只宠物都很好';
      sub = thirsty ? thirsty + ' 株今天还没浇水' : '';
    }
    return (
      '<section class="panel gcard"><div class="gc-pets">' + (pics || pxImg(ART.tree('oak', 4), 1)) + '</div>' +
      '<div class="gc-main"><p class="label">花园</p><h2 class="h2' + (need.length ? ' bad' : '') + '">' + esc(h) + '</h2>' + (sub ? '<p class="muted">' + sub + '</p>' : '') +
      '<div class="actions"><button class="btn ghost" data-act="nav" data-view="garden">去花园</button>' + (pets.length ? '<button class="btn ghost" data-act="openShop" data-tab="status">我的宠物</button>' : '<button class="btn ghost" data-act="openShop" data-tab="adopt">宠物店</button>') + '</div></div></section>'
    );
  }

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
      if (!it || !spend(it.price)) return;
      bagAdd(it.id, it.gives || 1);
      save();
      toast('买了' + it.name);
      render();
    },
    lookItem(t) {
      const it = ITEMS.get(t.dataset.id);
      if (!it) return;
      const W = state.world;
      if (W.look[it.slot] === it.id) delete W.look[it.slot];
      else {
        if (!W.owned.includes(it.id)) {
          if (!spend(it.price)) return;
          W.owned.push(it.id);
        }
        W.look[it.slot] = it.id;
        // 背带裤套装自带下装，换上它就不穿别的裤子
        if (it.look.bottom && it.slot === 'top') delete W.look.bottom;
        if (it.slot === 'bottom' && W.look.top && (ITEMS.get(W.look.top) || {}).look && ITEMS.get(W.look.top).look.bottom) delete W.look.top;
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
      if (p.wear[it.slot] === it.id) delete p.wear[it.slot];
      else {
        p.wear[it.slot] = it.id;
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
      ui.shopTab = 'status';
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
      if (!(await askConfirm('花 ' + fmt(next.price) + ' 金币把房子扩建成' + next.name + '？', '扩建'))) return;
      if (!spend(next.price)) return;
      // 屋子变宽，家具跟着门一起挪到中间；花园上边多出来的几行，园子里的东西跟着房子往下挪
      const dx = (next.room[0] - HOUSES[lv].room[0]) / 2;
      for (const d of state.world.room) d.x += dx;
      const dy = next.oy - HOUSES[lv].oy;
      for (const it of [...state.world.plants, ...state.world.decor]) it.y += dy;
      state.world.house = lv + 1;
      layoutGarden();
      relocate();
      roomRelocate();
      terrainCache.key = '';
      roomCanvas = null;
      save();
      toast('房子扩建成' + next.name + '了');
      const back = ui.view === 'room' ? 'room' : 'garden';
      if (scene) scene.stop();
      scene = null;
      go(ui.view === 'shop' ? 'shop' : back);
    },
    async buyLand() {
      const lv = state.world.land || 0;
      const next = LANDS[lv + 1];
      if (!next) return;
      if (state.points.bal < next.price) return toast('金币不够（还差 ' + fmt(next.price - state.points.bal) + '）');
      if (!(await askConfirm('花 ' + fmt(next.price) + ' 金币把花园扩建到 ' + next.w + ' × ' + (next.h + OY) + ' 格？', '扩建'))) return;
      if (!spend(next.price)) return;
      state.world.land = lv + 1;
      layoutGarden();
      terrainCache.key = '';
      save();
      toast('花园扩建好了');
      if (scene) scene.stop();
      scene = null;
      go('garden');
    },
  });

  // 花园和小屋里：方向键 / WASD 走路，Esc 放下手里的工具
  document.addEventListener('keydown', (ev) => {
    if (!scene || (ui.view !== 'garden' && ui.view !== 'room') || document.querySelector('.modal')) return;
    const tag = ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (ev.key === 'Escape' && ui.tool) {
      ui.tool = null;
      refreshSceneUi();
      return;
    }
    if (ev.key === '+' || ev.key === '=' || ev.key === '-' || ev.key === '_') {
      scene.zoomBy(ev.key === '-' || ev.key === '_' ? -1 : 1);
      ev.preventDefault();
      return;
    }
    if (scene.key(ev, true)) ev.preventDefault();
  });
  document.addEventListener('keyup', (ev) => {
    if (scene) scene.key(ev, false);
  });
  window.addEventListener('blur', () => {
    if (scene) scene.keys = {};
  });

  app.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.tagName === 'SELECT') return;
    const fn = ACTIONS[t.dataset.act];
    if (fn) fn(t, ev);
  });

  app.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.act === 'setBook') {
      state.settings.book = t.value;
      save();
      render();
    } else if (t.dataset.act === 'setRootBook') {
      state.settings.rootBook = t.value;
      ui.roots.limit = 200;
      save();
      render();
    } else if (t.id === 'draft-file' && t.files[0]) {
      t.files[0].arrayBuffer().then((buf) => {
        const text = decodeFile(buf);
        ui.draft.text = ui.draft.text.trim() ? ui.draft.text.trim() + '\n' + text : text;
        if (!ui.draft.target && /^我的词表 \d+$/.test(ui.draft.name)) ui.draft.name = t.files[0].name.replace(/\.[^.]+$/, '');
        render();
      });
    } else if (t.id === 'upload-book' && t.files[0]) {
      const file = t.files[0];
      file.arrayBuffer().then((buf) => {
        const r = parseImport(decodeFile(buf));
        if (!r.words.length) {
          toast('这个文件里没有识别到单词');
          return;
        }
        openNewBook(createBook(file.name.replace(/\.[^.]+$/, ''), r.words), r.words.length);
      });
    } else if (t.id === 'backup-file' && t.files[0]) {
      t.files[0].text().then(async (text) => {
        let obj = null;
        try {
          obj = JSON.parse(text);
        } catch (e) {
          obj = null;
        }
        // 改名前导出的备份写的是 Margin
        if (!obj || (obj.app !== 'Marginal Vocabulary' && obj.app !== 'Margin') || !obj.data) {
          toast('这个文件不是 Marginal Vocabulary 的备份');
          return;
        }
        if (!(await askConfirm('用这个备份覆盖现在的数据？', '覆盖'))) return;
        adoptState(normalizeState(obj.data), true);
        applyTheme();
        render();
        toast('备份已导入');
      });
    }
  });

  let previewTimer = null;
  app.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'draft-text') {
      ui.draft.text = t.value;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        const el = document.getElementById('draft-preview');
        if (el) el.innerHTML = previewHtml();
      }, 200);
    } else if (t.id === 'draft-name') {
      ui.draft.name = t.value;
    } else if (t.id === 'roots-q') {
      ui.roots.q = t.value;
      ui.roots.limit = 200;
      document.getElementById('root-rows').innerHTML = rootRowsHtml();
    } else if (t.id === 'book-q') {
      ui.book.q = t.value;
      ui.book.limit = 200;
      document.getElementById('book-rows').innerHTML = bookRowsHtml();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.isComposing || ev.keyCode === 229) return; // 中文输入法正在选字
    if (document.querySelector('.modal')) return;
    const tag = ev.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

    if (ui.view === 'practice') {
      if (ui.session && ui.session.between) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          continueStage();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          quitSession();
        }
        return;
      }
      if (ev.key === 'Enter' && ev.target.classList.contains('ans') && !ui.session.pending) {
        // 这一行写了字、下面还有行：跳到下一行；空行或最后一行：提交
        ev.preventDefault();
        const next = document.querySelector('.ans[data-line="' + (+ev.target.dataset.line + 1) + '"]');
        if (ev.target.value.trim() && next) next.focus();
        else submitAnswer();
      } else if (ev.key === 'Enter' && (ev.target.id === 'answer' || ev.target.classList.contains('ans') || !typing)) {
        ev.preventDefault();
        submitAnswer();
      } else if (ev.key === 'Tab') {
        ev.preventDefault();
        ACTIONS.speakCurrent();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        quitSession();
      }
      return;
    }
    if (ui.view === 'rootquiz') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        rootNext();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        if (ui.rs && ui.rs.done) go('roots');
        else quitRootSession();
      } else if (!typing && /^[1-4]$/.test(ev.key)) {
        rootAnswer(+ev.key - 1);
      }
      return;
    }
    if (typing) return;
    if (ui.view === 'roots') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        startRootNew();
      } else if (ev.key === 'r' || ev.key === 'R') {
        startRootReview();
      }
    } else if (ui.view === 'root') {
      if (ev.key === 'Escape') go('roots');
    } else if (ui.view === 'home') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        startNew();
      } else if (ev.key === 'r' || ev.key === 'R') {
        startReview();
      }
    } else if (ui.view === 'result') {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (nextLabel(ui.session)) ACTIONS.nextGroup();
        else go('home');
      } else if (ev.key === 'r' || ev.key === 'R') {
        ACTIONS.retryWrong();
      } else if (ev.key === 'Escape') {
        go('home');
      }
    }
  });

  function applyTheme() {
    const root = document.documentElement;
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    root.setAttribute('data-weight', state.settings.weight || 'normal');
  }

  // 其他标签页改了数据（比如同时开了两个 Marginal Vocabulary），这里跟着更新
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORE_KEY && ui.view !== 'practice') {
      adoptState(loadState(), false);
      applyTheme();
      render();
    }
  });

  // 给自动化测试用的入口（只有测试脚本会设置 __MARGIN_TEST）
  if (window.__MARGIN_TEST) window.__margin = { zhMatch, similarity, judgeZhLines, meaningHtml, layersOf };
  if (window.__MARGIN_TEST) window.__sceneDebug = () => (scene ? { cx: scene.cam.x, cy: scene.cam.y, h: scene.h, av: scene.av, pet: scene.mainEnt(), pets: scene.pets, fish: scene.fish, scale: scene.scale, vw: scene.vw, blocked: () => scene.blocked(), walk: (x, y) => scene.walkTo(x, y) } : null);

  layoutGarden();
  migrate();
  applyTheme();
  render();
  checkAchievements(true);
  if (petAlive()) {
    const mp = mainPet();
    setTimeout(() => petSay(mp.sick ? 'sick' : mp.food < 30 ? 'hungry' : mp.mood < 30 ? 'low' : 'hello'), 1500);
  }
  autoCheckUpdate();
})();
