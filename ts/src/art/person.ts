// 人物（16×32，正面）和帽子

import { mix, ramp } from './color';
import { INK, WHITE } from './widgets';
import { Pix } from './pix';

// ================= 人物（16×32，正面） =================

// look：skin 肤色、hair 发色、hairStyle（short / long / bun）、hat、top 上衣颜色、topStyle（tee / overalls / hoodie / stripe）、
//       bottom 下装颜色、bottomStyle（pants / shorts / skirt）、shoes
// dir：front / back / side（朝右；朝左时翻转）；f：idle / walk1 / walk2 / act
export interface Look {
  skin?: string;
  hair?: string;
  hairStyle?: string;
  hat?: string;
  top?: string;
  topStyle?: string;
  bottom?: string;
  bottomStyle?: string;
  shoes?: string;
}

export const HATS: Record<string, (p: Pix, y: number, dir: string) => void> = {
  straw(p, y, _dir) {
    p.sEll(8, y + 4, 8, 2, '#e8c46a');
    p.sEll(8, y + 2, 4.5, 3, '#e8c46a');
    p.rect(4, y + 3, 8, 1, '#c8463a');
  },
  cap(p, y, dir) {
    p.sEll(8, y + 3, 6.5, 3.6, '#3b6ea8');
    if (dir !== 'back') p.rect(dir === 'side' ? 9 : 3, y + 5, dir === 'side' ? 7 : 10, 2, ramp('#3b6ea8').mid);
    p.set(8, y, ramp('#3b6ea8').hi);
  },
  beanie(p, y) {
    p.sEll(8, y + 3.5, 6.8, 4, '#c8463a');
    p.rect(2, y + 5, 12, 2, '#f4ece0');
    p.sEll(8, y - 0.5, 1.8, 1.6, '#f4ece0');
  },
  flower(p, y) {
    for (const [x, c] of [[3, '#ef7fa0'], [6, '#f6d35b'], [9, '#ffffff'], [12, '#9b7fd1']] as [number, string][]) {
      p.ell(x + 0.5, y + 3.5, 1.6, 1.6, c);
      p.set(x, y + 3, '#f6d35b');
    }
    p.rect(2, y + 5, 12, 1, '#6aa35a');
  },
  bow(p, y) {
    p.poly([[8, y + 3], [3, y + 0], [3, y + 6]], '#ef7fa0');
    p.poly([[8, y + 3], [13, y + 0], [13, y + 6]], ramp('#ef7fa0').mid);
    p.rect(7, y + 2, 2, 2, ramp('#ef7fa0').lo);
  },
  crown(p, y) {
    p.poly([[3, y + 6], [3, y + 1], [5.5, y + 3.5], [8, y], [10.5, y + 3.5], [13, y + 1], [13, y + 6]], '#f2c14e');
    p.set(8, y + 3, '#e85d75');
  },
  party(p, y) {
    p.poly([[4, y + 6], [12, y + 6], [8, y - 3]], '#e85d75');
    p.line(6, y + 3, 9, y + 5, '#f6d35b');
    p.line(7, y, 10, y + 2, '#f6d35b');
    p.sEll(8, y - 3, 1.6, 1.6, '#f6d35b');
  },
  beret(p, y) {
    p.sEll(7, y + 3.5, 6.5, 3, '#4a5a8a');
    p.set(8, y, '#4a5a8a');
  },
  grad(p, y) {
    p.poly([[0, y + 2], [8, y - 1], [16, y + 2], [8, y + 5]], '#2b2a28');
    p.sRect(4, y + 3, 8, 3, '#2b2a28', { noHi: true });
    p.line(12, y + 2, 13, y + 7, '#f2c14e');
  },
};
// 宠物戴帽子的位置：帽子画在 16 宽的格子里，挪到宠物头顶
export const PET_HAT_AT: Record<string, number> = { crab: 4, cat: 0, shiba: 0, fox: -1, rabbit: 1, hamster: 4, penguin: 1, duck: -1, frog: 3, piglet: 1, lamb: 0, corgi: -1, hedgehog: 2, squirrel: 0, owl: 1, otter: 2, raccoon: 0, koala: 1, redpanda: 0, panda: 1, chick: 4, medaka: 4, goldfish: 4, guppy: 4, koi: 4, goldkoi: 4 };

// 人物是一格一格手画的（16×32）：头、身子、腿分开画，走路时身子上下颠一下、两条腿交替抬起。
// 字母代表颜色：h 头发、H 头发暗部、j 头发高光、s 皮肤、S 皮肤暗部、c 腮红、e 眼睛、w 眼睛高光、m 嘴、
// t 上衣、T 上衣暗部、y 上衣高光、o 胳膊和身子之间的暗线、b 裤子、B 裤子暗部、f 鞋、F 鞋底
const AV: Record<string, string[]> = {
  headFront: [
    '................',
    '.....hhhhhh.....',
    '...hhjjjjhhhh...',
    '..hhjjhhhhhhhH..',
    '.hhjhhhhhhhhhHh.',
    '.hhhhhhhhhhhhHh.',
    '.hhhhhhhhhhhhHh.',
    '.hhssshhsssshHh.',
    '.hhssssssssssHh.',
    '.hhswesssswesHh.',
    '.hhseesssseesHh.',
    '..hccssssssccH..',
    '...SsssmmsssS...',
    '....SSssssSS....',
  ],
  headSide: [
    '................',
    '......hhhhh.....',
    '....hhjjjhhhh...',
    '...hhjjhhhhhhh..',
    '..hhjhhhhhhhhhh.',
    '..hhhhhhhhhhhhh.',
    '..hhhhhhhhhhhhh.',
    '..hhhhhhhhhssss.',
    '..hHhhhhsssssss.',
    '..hHhhhSssswess.',
    '..hHhhsSssseess.',
    '...Hhhssssscsss.',
    '....HSsssssssmS.',
    '.....SSsssssSS..',
  ],
  headBack: [
    '................',
    '.....hhhhhh.....',
    '...hhjjjjhhhh...',
    '..hhjjhhhhhhhH..',
    '.hhjhhhhhhhhhHh.',
    '.hhhhhhhhhhhhHh.',
    '.hhhhhhhhhhhhHh.',
    '.hhhhhhhhhhhhHh.',
    '.hhhhhhhhhhhhHh.',
    '.hHhhhhhhhhhhHh.',
    '.hHhhhhhhhhhHHh.',
    '..hHhhhhhhhhHH..',
    '...SHHhhhhHHS...',
    '....SSssssSS....',
  ],
  bodyFront: [
    '.....tSSSSt.....',
    '...ttytTTttTT...',
    '..ttoytttttoTT..',
    '..tToytttttoTT..',
    '..tTottttttoTT..',
    '..tTottttttoTT..',
    '..tToTTTTTToTT..',
    '..sSobbbbbboSS..',
    '....bbbbbbbB....',
    '....bbbbbbbB....',
  ],
  bodyFrontAct: [
    '.....tSSSSt.....',
    '...ttytTTttTT...',
    '..ttyttttttttT..',
    '..tTotttttttTT..',
    '..tToTTsSSTTTT..',
    '...TTosSSSoTT...',
    '....tTTTTTTT....',
    '....obbbbbbo....',
    '....bbbbbbbB....',
    '....bbbbbbbB....',
  ],
  bodyBack: [
    '.....tSSSSt.....',
    '...ttytttttTT...',
    '..ttoytttttoTT..',
    '..tToytttttoTT..',
    '..tTottttttoTT..',
    '..tTottttttoTT..',
    '..tToTTTTTToTT..',
    '..sSobbbbbboSS..',
    '....bbbbbbbB....',
    '....bbbbbbbB....',
  ],
  bodySide: [
    '......tSSt......',
    '.....yttttttT...',
    '.....ytottTtT...',
    '.....ytottTtT...',
    '.....ytottTtT...',
    '.....ttottTtT...',
    '.....TToTTTTT...',
    '.....bbosSbbB...',
    '.....bbbbbbbB...',
    '.....bbbbbbbB...',
  ],
  bodySideAct: [
    '......tSSt......',
    '.....yttttttT...',
    '.....ytotttTtT..',
    '.....yttooTTTTsS',
    '.....yttttTttTSS',
    '.....tttttTtT...',
    '.....TTTTTTTT...',
    '.....bbbbbbbB...',
    '.....bbbbbbbB...',
    '.....bbbbbbbB...',
  ],
  legsFront: ['....bbB..bbB....', '....bbB..bbB....', '....bbB..bbB....', '....bbB..bbB....', '...fffF..fffF...', '...FFFF..FFFF...', '................', '................'],
  legsFrontWalk: ['....bbB..bbB....', '....bbB..bbB....', '....bbB..bbB....', '...fffF..bbB....', '...FFFF..fffF...', '.........FFFF...', '................', '................'],
  legsSide: ['......bbBbbB....', '......bbBbbB....', '......bbBbbB....', '......bbBbbB....', '......fffffffF..', '......FFFFFFFF..', '................', '................'],
  legsSideWalk: ['......bBbbbB....', '.....bBB.bbbB...', '.....BB...bbB...', '....BB.....bbB..', '...FFF.....ffffF', '...........FFFFF', '................', '................'],
};
// 镜像一行（走路的另一只脚）
const mirrorRow = (r: string): string => r.split('').reverse().join('');

// 坐着（正面）：大腿朝着我们看不见，只露出小腿和鞋
const LEGS_SIT = ['................', '................', '................', '....bbB..bbB....', '...fffF..fffF...', '...FFFF..FFFF...', '................', '................'];
// 侧面换另一条腿在前：远近两条腿的深浅对调
const SWAP_LEG: Record<string, string> = { b: 'B', B: 'b', f: 'F', F: 'f' };

export function person(p: Pix, look: Look, f: string, dir?: string): void {
  dir = dir || 'front';
  const skin = look.skin || '#f3c9a5';
  const hair = look.hair || '#6b4a35';
  const top = look.top || '#e8e2d4';
  const bottom = look.bottom || '#5b6b8a';
  const shoes = look.shoes || '#6a4a3a';
  const HR = ramp(hair);
  const SK = ramp(skin);
  const TP = ramp(top);
  const BT = ramp(bottom);
  const SH = ramp(shoes);
  const act = f === 'act';
  // 走路四步一轮：walk1 迈开一条腿、walkp 两腿并拢身子往上一点、walk2 迈开另一条腿、walkp
  const walk = f === 'walk1' || f === 'walk2';
  const y0 = f === 'walkp' ? -1 : f === 'sit' ? 3 : 0;
  const head = AV[dir === 'side' ? 'headSide' : dir === 'back' ? 'headBack' : 'headFront'];
  const body = AV[dir === 'side' ? (act ? 'bodySideAct' : 'bodySide') : dir === 'back' ? 'bodyBack' : act ? 'bodyFrontAct' : 'bodyFront'];
  let legs = AV[dir === 'side' ? (walk ? 'legsSideWalk' : 'legsSide') : walk ? 'legsFrontWalk' : 'legsFront'];
  if (f === 'walk2') legs = dir === 'side' ? legs.map((r) => r.replace(/[bBfF]/g, (c) => SWAP_LEG[c])) : legs.map(mirrorRow);
  if (f === 'sit') legs = LEGS_SIT;
  const pal: Record<string, string> = {
    h: hair, H: HR.mid, j: HR.hi,
    s: skin, S: SK.mid, c: '#f2a0a0', e: INK, w: WHITE, m: '#c0705f',
    t: top, T: TP.mid, y: TP.hi, o: TP.lo,
    b: bottom, B: BT.mid,
    f: shoes, F: SH.lo,
  };
  // 上衣样式、下装样式：按格子换颜色
  const ts = look.topStyle || 'tee';
  const bs = look.bottomStyle || 'pants';
  const colorAt = (ch: string, x: number, y: number) => {
    if ((ch === 't' || ch === 'y' || ch === 'T') && y >= 14 && y <= 20) {
      if (ts === 'stripe' && y >= 16 && y % 2 === 0) return ch === 'T' ? mix('#f4ece0', TP.mid, 0.35) : '#f4ece0';
      if (ts === 'overalls' && dir !== 'side') {
        // 胸前的背带裤：两条背带、两颗扣子、一块护胸
        if (y >= 17 && x >= 5 && x <= 10) return ch === 'T' ? BT.mid : bottom;
        if ((y === 15 || y === 16) && (x === 5 || x === 10)) return BT.mid;
      }
      if (ts === 'overalls' && dir === 'side' && y >= 17 && x >= 5 && x <= 12) return ch === 'T' ? BT.mid : bottom;
    }
    if (ts === 'overalls' && dir === 'front' && y === 17 && (x === 5 || x === 10)) return '#f2c14e';
    if (ts === 'hoodie' && dir === 'front') {
      if (y === 14 && (x === 5 || x === 10)) return TP.mid;
      if ((x === 6 || x === 9) && y >= 15 && y <= 17 && ch !== 'o') return TP.hi;
      if (y === 19 && x >= 6 && x <= 9) return TP.lo;
    }
    if (bs === 'shorts' && (ch === 'b' || ch === 'B') && y >= 25) return ch === 'B' ? SK.mid : skin;
    return pal[ch];
  };
  const put = (rows: string[], oy: number, shift: number) => {
    rows.forEach((r, j) => {
      for (let x = 0; x < 16; x++) {
        const ch = r[x];
        if (ch === '.') continue;
        const y = oy + j;
        p.set(x, y + shift, colorAt(ch, x, y));
      }
    });
  };
  // 长发：披在肩上（前面、侧面）或者盖住后背
  const hs = look.hairStyle || 'short';
  if (hs === 'long') {
    if (dir === 'front') for (let y = 9; y <= 18; y++) for (const x of [1, 2, 13, 14]) p.set(x, y + y0, x === 2 || x === 13 ? HR.mid : hair);
    if (dir === 'side') for (let y = 9; y <= 18; y++) for (let x = 2; x <= 5; x++) p.set(x, y + y0, x === 5 ? HR.mid : hair);
  }
  put(head.concat(body), 0, y0);
  put(legs, 24, 0);
  if (bs === 'skirt') {
    // 裙子：从腰往下张开
    for (let y = 21; y <= 25; y++) {
      const w = 4 + (y - 21);
      for (let x = 8 - w; x < 8 + w; x++) if (x >= 1 && x <= 14) p.set(x, y + (y < 24 ? y0 : 0), x >= 8 + w - 2 ? BT.mid : y === 25 ? BT.hi : bottom);
    }
    for (let y = 26; y <= 27; y++) for (const x of dir === 'side' ? [7, 8, 9, 10] : [4, 5, 10, 11]) if (p.get(x, y)) p.set(x, y, skin);
  }
  if (hs === 'long' && dir === 'back') for (let y = 12; y <= 19; y++) for (let x = 3; x <= 12; x++) p.set(x, y + y0, x === 12 || y === 19 ? HR.mid : x === 5 && y < 16 ? HR.hi : hair);
  if (hs === 'bun') {
    const by = dir === 'side' ? 1 : 0;
    const bx = dir === 'side' ? 5 : 8;
    p.sEll(bx, 1.5 + by + y0, 2.6, 2, hair);
    p.set(bx - 1, 1 + by + y0, HR.hi);
  }
  // 走路时手臂和腿反着摆：正面、背面一只手往前（低一格）、一只手往后（高一格）；侧面手往前、往后挪两格
  if (walk) {
    const hy = 21 + y0;
    const fwd = f === 'walk1';
    if (dir === 'side') {
      const hand = [p.get(8, hy), p.get(9, hy)];
      const pants = p.get(11, hy) || bottom;
      if (hand[0] && hand[1]) {
        const nx = fwd ? 10 : 6;
        p.set(8, hy, pants);
        p.set(9, hy, pants);
        p.set(nx, hy, hand[0]);
        p.set(nx + 1, hy, hand[1]);
      }
    } else {
      for (const [x0, down] of [[2, fwd], [12, !fwd]] as [number, boolean][]) {
        const a = [p.get(x0, hy), p.get(x0 + 1, hy)];
        if (!a[0] && !a[1]) continue;
        if (down) {
          const sleeve = [p.get(x0, hy - 1), p.get(x0 + 1, hy - 1)];
          p.set(x0, hy + 1, a[0]);
          p.set(x0 + 1, hy + 1, a[1]);
          if (sleeve[0]) p.set(x0, hy, sleeve[0]);
          if (sleeve[1]) p.set(x0 + 1, hy, sleeve[1]);
        } else {
          p.set(x0, hy - 1, a[0]);
          p.set(x0 + 1, hy - 1, a[1]);
          p.clear(x0, hy);
          p.clear(x0 + 1, hy);
        }
      }
    }
  }
  if (look.hat && HATS[look.hat]) HATS[look.hat](p, y0, dir);
}
