// 对外的接口：按种类取图（带缓存）

import { desat, hsl, hsl2hex, lighten, mix, ramp } from './color';
import { DECOR } from './decor';
import { fishTop } from './fish';
import { forestRing } from './forest';
import { GROUND } from './ground';
import { ICONS } from './icons';
import { HATS, Look, PET_HAT_AT, person } from './person';
import { PETS, bob } from './pets';
import { Pix, Sprite, build, cached } from './pix';
import { FLOWERS, GRASSES, SHRUBS, TREE_SPECS, drawTree, flower, grassPlant, shrub, treeSapling, treeSeed, treeSprout } from './plants';
import { room } from './room';
import { pondInside, terrain } from './terrain';
import { INK, WHITE } from './widgets';

function pet(species: string, frame: string, recolor?: number, hat?: string): Sprite {
  return cached('pet:' + species + ':' + frame + ':' + (recolor || '') + ':' + (hat || ''), () => {
    const p = new Pix(32, 32);
    (PETS[species] || PETS.crab)(p, frame);
    if (recolor) p.recolor((c) => (c === INK || c === WHITE ? c : hueShift(c, recolor)));
    if (hat && HATS[hat]) {
      const h = new Pix(16, 12);
      HATS[hat](h, 3, 'front');
      p.blit(h, 8, (PET_HAT_AT[species] || 0) + bob(frame) - 3);
    }
    p.outline();
    if (frame === 'sick') p.recolor((c) => mix(desat(c, 0.4), '#9fbf8f', 0.12));
    return p;
  });
}

function hueShift(c: string, deg: number): string {
  const [h, s, l] = hsl(c);
  if (s < 0.15 || l > 0.92) return c;
  return hsl2hex(h + deg, s, l);
}

// 躺在床上：头枕在枕头上，被子盖到下巴，被子下面鼓起来一点（和 32×32 的床对齐）
function lying(look: Look): Sprite {
  return cached('lying:' + JSON.stringify(look), () => {
    const q = build(16, 32, (z) => person(z, look, 'idle', 'front'));
    const p = new Pix(32, 32);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) if (q.get(x, y)) p.set(x + 8, y + 3, q.get(x, y));
    const B = ramp('#5a8fe0');
    p.rect(2, 15, 28, 3, '#5a8fe0');
    p.rect(2, 15, 28, 1, B.hi);
    p.rect(2, 18, 28, 1, B.mid);
    p.ell(16, 23, 7, 3, lighten('#5a8fe0', 0.05));
    p.ell(15, 22, 5, 1.5, B.hi);
    return p;
  });
}

// 夜里亮灯的窗户：只留下房子图里的玻璃，换成暖黄色（盖在变暗的画面上）
export const GLASS: Record<string, string> = { '#7fb6d8': '#ffcf6e', '#a9d4ec': '#ffe08f', '#cdeaf8': '#fff1c4', '#5e93b8': '#d99a48', '#6aa2c6': '#e8ac56' };
function litWindows(kind: string): Sprite | null {
  const d = DECOR[kind];
  if (!d) return null;
  return cached('lit:' + kind, () => {
    const src = build(d.w, d.h, (q) => d.draw(q), { outline: !d.flat });
    const p = new Pix(d.w, d.h);
    for (let i = 0; i < src.d.length; i++) if (GLASS[src.d[i]!]) p.d[i] = GLASS[src.d[i]!];
    return p;
  });
}

function avatar(look: Look, frame: string, dir?: string): Sprite {
  return cached('avatar:' + JSON.stringify(look) + ':' + frame + ':' + (dir || 'front'), () => build(16, 32, (q) => person(q, look, frame, dir)));
}

// stage：0 种子、1 发芽、2 小树苗、3 小树、4（默认）长大的树
function tree(kind: string, stage?: number | null): Sprite {
  const st = stage == null ? 4 : stage;
  return cached('tree:' + kind + ':' + st, () => {
    if (st <= 0) return build(16, 16, (q) => treeSeed(q));
    if (st === 1) return build(16, 16, (q) => treeSprout(q, kind));
    if (st === 2) return build(16, 32, (q) => treeSapling(q, kind));
    if (st === 3) return build(32, 48, (q) => drawTree(q, kind, 1));
    return build(48, 72, (q) => drawTree(q, kind, 1.5));
  });
}

function grassSprite(kind: string, stage: number): Sprite {
  const tall = (GRASSES[kind] || {}).tall && stage >= 2;
  return cached('grass:' + kind + ':' + stage, () => build(16, tall ? 24 : 16, (q) => grassPlant(q, kind, stage)));
}

function flowerSprite(kind: string, stage: number): Sprite {
  const tall = (FLOWERS[kind] || {}).tall && stage >= 2;
  return cached('flower:' + kind + ':' + stage, () => build(16, tall ? 24 : 16, (q) => flower(q, kind, stage)));
}

function shrubSprite(kind: string, stage: number): Sprite {
  return cached('shrub:' + kind + ':' + stage, () => build(16, 16, (q) => shrub(q, kind, stage)));
}

function ground(kind: string, v?: number): Sprite {
  return cached('ground:' + kind + ':' + (v || 0), () => build(16, 16, (q) => (GROUND[kind] || GROUND.grass)(q, v || 0), { outline: false }));
}

function decor(kind: string): Sprite | null {
  const d = DECOR[kind];
  if (!d) return null;
  return cached('decor:' + kind, () => build(d.w, d.h, (q) => d.draw(q), { outline: !d.flat }));
}

function icon(kind: string, color?: string): Sprite {
  return cached('icon:' + kind + ':' + (color || ''), () => build(16, 16, (q) => (ICONS[kind] || ICONS.bag)(q, color)));
}

// 画到 <canvas> 或返回 dataURL，给 <img> 用
const urlCache = new Map<HTMLCanvasElement, string>();
function url(canvas: HTMLCanvasElement): string {
  if (!urlCache.has(canvas)) urlCache.set(canvas, canvas.toDataURL());
  return urlCache.get(canvas)!;
}

export const ART = {
  Pix, ramp, lighten, mix, url, terrain,
  pet, avatar, tree, flower: flowerSprite, shrub: shrubSprite, grass: grassSprite, fishTop, room, forestRing, pondInside, lying, litWindows, ground, decor, icon,
  PETS: Object.keys(PETS), TREES: Object.keys(TREE_SPECS), FLOWERS: Object.keys(FLOWERS), SHRUBS: Object.keys(SHRUBS),
  DECOR: Object.fromEntries(Object.entries(DECOR).map(([k, v]) => [k, { w: v.w, h: v.h, tw: v.tw, th: v.th, room: !!v.room, wall: !!v.wall, flat: !!v.flat }])),
  HATS: Object.keys(HATS), ICONS: Object.keys(ICONS),
  FLOWER_COLOR: Object.fromEntries(Object.entries(FLOWERS).map(([k, v]) => [k, v.c])),
};
