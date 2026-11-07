// 宠物和人物

import { ui } from '../app/nav';
import { save, state } from '../app/store';
import { dayNum } from '../app/util';
import { ART } from '../art';
import { pday } from './coins';
import { CARE, ITEMS, PETS, SPECIES } from './data';
import { Look } from '../art/person';
import { Pet } from '../app/types';
import { Species } from '../data/types';

// ---------- 宠物 ----------
// 可以养好几只：都住在花园里，鱼养在池塘里；其中一只（自己选）会跑出来陪你背单词。
// 每只都有饱腹和心情，每天往下掉；有一样掉到 0 就生病，吃药能好；生病 3 天没吃药就死了。

export function isFish(p: Pet | null | undefined): boolean {
  return !!(p && (SPECIES.get(p.sp) || ({} as Partial<Species>)).fish);
}

export function landPets(): Pet[] {
  return state.pets.filter((p) => SPECIES.has(p.sp) && !isFish(p));
}

export function fishList(): Pet[] {
  return state.pets.filter((p) => SPECIES.has(p.sp) && isFish(p));
}

export function petById(id: number): Pet | null {
  return state.pets.find((p) => p.id === id) || null;
}

// 陪你背单词的那只（不是鱼）
export function mainPet(): Pet | null {
  const p = petById(state.petMain);
  return p && SPECIES.has(p.sp) && !isFish(p) ? p : null;
}

export function petAlive(): boolean {
  return !!mainPet();
}

export function petAge(p?: Pet): number {
  if (p) return dayNum() - p.born + 1;
  return state.pets.reduce((m, x) => Math.max(m, dayNum() - x.born + 1), 0);
}

export function petSick(p?: Pet | null): boolean {
  p = p || mainPet();
  return !!p && !!p.sick;
}

export function petLow(p: Pet): boolean {
  return p.sick || p.food < 30 || p.mood < 30;
}

// 有没有哪只需要照顾：生病、饿了或者不开心
export function petNeedsCare(): boolean {
  return state.pets.some((p) => SPECIES.has(p.sp) && petLow(p));
}

export function newPet(sp: string, name?: string | null): Pet {
  state.petSeq = (state.petSeq || 0) + 1;
  const p: Pet = { id: state.petSeq, sp, name: name || (SPECIES.get(sp) || ({} as Partial<Species>)).name || '宠物', born: dayNum(), food: CARE.start, mood: CARE.start, day: dayNum(), sick: false, sickSince: 0, wear: {} };
  state.pets.push(p);
  if (!isFish(p) && !mainPet()) state.petMain = p.id;
  return p;
}

// 每过一天：饱腹、心情各掉一截；有一样到 0 就生病；生病太久就死了
export function petsTick(): void {
  const today = dayNum();
  let changed = false;
  const gone: Pet[] = [];
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
export function careUp(p: Pet | null, field: 'food' | 'mood', n: number, capKey?: string | null, cap?: number): number {
  if (!p || p.sick || n <= 0) return 0;
  if (capKey) {
    const d = pday();
    const key = capKey + ':' + p.id;
    const used = (d[key] as number) || 0;
    n = Math.min(n, cap! - used);
    if (n <= 0) return 0;
    d[key] = used + n;
  }
  p[field] = Math.min(100, (p[field] || 0) + n);
  return n;
}

// 陪你背单词的那只心情往上加
export function moodUp(n: number, capKey?: string, cap?: number): number {
  return careUp(mainPet(), 'mood', n, capKey, cap);
}

export function petLabel(p: Pet): string {
  if (p.sick) return '生病了';
  if (p.food < 30) return '饿了';
  if (p.mood < 30) return '不太开心';
  return p.food >= 70 && p.mood >= 70 ? '很好' : '还不错';
}

function lookOf(p: Pet | null): { hat: string | undefined; hue: number | undefined } {
  const w: Record<string, string> = (p && p.wear) || {};
  const hat = ITEMS.get(w.hat);
  const color = ITEMS.get(w.color);
  return { hat: hat && hat.pet ? hat.pet.hat : '', hue: color && color.pet ? color.pet.hue : 0 };
}

export function petCanvas(frame: string, p?: Pet | null): HTMLCanvasElement | null {
  p = p || mainPet();
  if (!p) return null;
  const l = lookOf(p);
  return ART.pet(p.sp, frame, l.hue, l.hat);
}

export function petLine(kind: string, vars?: Record<string, string | number> | null, p?: Pet | null): string {
  p = p || mainPet();
  const list = PETS.lines[kind];
  if (!p || !list || !list.length) return '';
  const sp = SPECIES.get(p.sp);
  const t = list[Math.floor(Math.random() * list.length)];
  return t.replace(/\{(\w+)\}/g, (_, k) => (k === 'name' ? p!.name : k === 'sound' ? (sp ? sp.sound : '') : vars && vars[k] != null ? (vars[k] as string) : ''));
}

// ---------- 人物 ----------

export function avatarLook(): Look {
  const look: Look = {};
  const wear = state.world.look || {};
  for (const slot of ['top', 'bottom', 'hair', 'hairStyle', 'hat']) {
    const it = ITEMS.get(wear[slot]);
    if (it && it.look) Object.assign(look, it.look);
  }
  return look;
}
