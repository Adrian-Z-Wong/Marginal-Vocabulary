// 在页面上走动的宠物

import { ui } from '../app/nav';
import { save, state } from '../app/store';
import { esc } from '../app/util';
import { ART } from '../art';
import { CARE, SPECIES } from './data';
import { careUp, mainPet, moodUp, petAlive, petById, petCanvas, petLine, petLow, petNeedsCare, petSick } from './pets';
import { onPetTab } from './shop';
import { scene } from './terrain';

// ---------- 在页面上走动的宠物 ----------

const PET_W = 64;
const PET_H = 64;
const petLayer = document.createElement('div');
/** 页面上走动的宠物：x、y 现在的位置（还没出来时是 null），tx、ty 要去哪儿 */
interface Roam {
  x: number | null;
  y: number | null;
  tx: number;
  ty: number;
  moving: boolean;
  last: number;
  lastAct: number;
  sleeping: boolean;
  bubbleTimer: ReturnType<typeof setTimeout> | number;
  careAt: number;
  frame: string;
  walkT: number;
  talking: boolean;
}

export const roam: Roam = { x: null, y: null, tx: 0, ty: 0, moving: false, last: 0, lastAct: Date.now(), sleeping: false, bubbleTimer: 0, careAt: 0, frame: 'idle', walkT: 0, talking: false };

// 花园、小屋、商店的宠物栏里有自己的宠物画面，页面上走动的那只就先藏起来
function petShown(): boolean {
  return petAlive() && state.settings.petRoam !== false && ui.view !== 'garden' && ui.view !== 'room' && !onPetTab();
}

function petEl(): HTMLElement | null {
  return petLayer.querySelector<HTMLElement>('.pet');
}

function clampPet(): void {
  roam.tx = Math.max(6, Math.min(window.innerWidth - PET_W - 6, roam.tx));
  roam.ty = Math.max(8, Math.min(window.innerHeight - PET_H - 6, roam.ty));
}

function placePet(): void {
  const el = petEl();
  if (el) el.style.transform = 'translate(' + Math.round(roam.x!) + 'px,' + Math.round(roam.y!) + 'px)';
}

// 现在该用哪一帧：生病、睡觉、说话时开心，走路两帧交替，平时偶尔眨眼
function petFrameNow(): string {
  if (petSick()) return 'sick';
  if (roam.sleeping) return 'sleep';
  if (roam.moving) return roam.walkT % 2 ? 'walk2' : 'walk1';
  if (roam.talking) return 'happy';
  return roam.frame === 'blink' ? 'blink' : 'idle';
}

function setPetFrame(): void {
  const img = petLayer.querySelector<HTMLImageElement>('.pet-img');
  if (!img) return;
  const f = petFrameNow();
  if (img.dataset.f === f) return;
  img.dataset.f = f;
  img.src = ART.url(petCanvas(f)!);
}

export function renderPet(): void {
  if (!petShown()) {
    petLayer.hidden = true;
    return;
  }
  petLayer.hidden = false;
  const mp = mainPet()!;
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

function walkTo(cx: number, cy: number): void {
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

function stepPet(t: number): void {
  if (!petEl()) {
    roam.moving = false;
    return;
  }
  const dt = Math.min(0.05, (t - roam.last) / 1000);
  roam.last = t;
  roam.walkT = Math.floor(t / 140);
  const dx = roam.tx - roam.x!;
  const dy = roam.ty - roam.y!;
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
  roam.x! += (dx / dist) * v;
  roam.y! += (dy / dist) * v;
  placePet();
  setPetFrame();
  requestAnimationFrame(stepPet);
}

export function petSay(kind: string, vars?: Record<string, string | number>): void {
  const text = petLine(kind, vars);
  if (!text) return;
  let box: HTMLElement | null = null;
  if (onPetTab()) box = document.querySelector<HTMLElement>('.pet-stage');
  else if (petShown()) box = petEl();
  else if ((ui.view === 'garden' || ui.view === 'room') && scene) {
    scene.say(text);
    return;
  }
  if (!box) return;
  const b = box.querySelector<HTMLElement>('.pet-bubble');
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

function hopPet(box: HTMLElement | null): void {
  const h = box && box.querySelector<HTMLElement>('.pet-hop');
  if (!h) return;
  h.classList.remove('hop');
  void h.offsetWidth;
  h.classList.add('hop');
  const heart = document.createElement('span');
  heart.className = 'pet-heart';
  heart.textContent = '♥';
  box!.appendChild(heart);
  setTimeout(() => heart.remove(), 900);
}

function wakePet(say: boolean): void {
  roam.lastAct = Date.now();
  if (!roam.sleeping) return;
  roam.sleeping = false;
  setPetFrame();
  if (say) petSay('wake');
}

// 金币变化时，从宠物头上（没有宠物就从顶栏的金币）飘出一个数字
export function floatPts(text: string, neg: boolean): void {
  let x: number;
  let y: number | null;
  if (petShown() && petEl()) {
    x = roam.x! + PET_W / 2;
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
function blankClick(ev: Event): boolean {
  const t = ev.target;
  if (!(t instanceof Element)) return false;
  if (t.closest('a, button, input, textarea, select, label, kbd, canvas, [data-act], [data-bag], .opt, .list-row, .chip, .modal, .toast, .hm, .update-bar, .pet-stage, .pet-card, .shop-item, .bag')) return false;
  const sel = window.getSelection && window.getSelection();
  return !(sel && String(sel).length);
}

// 开始背诵时，宠物跑过来陪你（卡片右下角旁边）
export function petJoinStudy(): void {
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

export function initRoam(): void {
  petLayer.className = 'pet-layer';
  document.body.appendChild(petLayer);
  document.addEventListener('click', (ev) => {
    if (document.querySelector('.modal')) return;
    const onPet = ev.target instanceof Element && ev.target.closest('.pet');
    if (onPet) {
      const was = roam.sleeping;
      wakePet(false);
      hopPet(onPet as HTMLElement);
      if (moodUp(1, 'petMood', CARE.petCap)) save();
      petSay(was ? 'wake' : petSick() ? 'sick' : 'click');
      return;
    }
    // 「我的宠物」里点宠物：跳一下，心情好一点
    const stage = ev.target instanceof Element && ev.target.closest('.pet-stage .pet-hop');
    if (stage) {
      const box = stage.closest('.pet-stage') as HTMLElement & { _t?: ReturnType<typeof setTimeout> };
      const p = petById(+box.dataset.pet!);
      hopPet(box);
      if (p && careUp(p, 'mood', 1, 'petMood', CARE.petCap)) save();
      const text = petLine(p && p.sick ? 'sick' : 'click', null, p);
      const b = box.querySelector<HTMLElement>('.pet-bubble');
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
    const input = document.querySelector<HTMLInputElement>('.practice .ans:not([readonly]), #answer:not([readonly]), #rq-answer:not([readonly])');
    if (input) input.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', () => wakePet(false), true);
  window.addEventListener('resize', () => {
    // 花园、屋里的画面跟着窗口重新排（没有宠物也要排）
    if (scene) scene.fit();
    // 最小化等情况下窗口尺寸会是 0，不要把宠物挤到角落
    if (roam.x === null || window.innerWidth < 200 || window.innerHeight < 200) return;
    roam.tx = roam.x;
    roam.ty = roam.y!;
    clampPet();
    roam.x = roam.tx;
    roam.y = roam.ty;
    placePet();
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
      const mp = mainPet()!;
      const other = state.pets.find((p) => p !== mp && SPECIES.has(p.sp) && petLow(p));
      if (petLow(mp)) petSay(mp.sick ? 'sick' : mp.food < 30 ? 'hungry' : 'low');
      else if (other) petSay(other.sick ? 'otherSick' : 'otherLow', { n: other.name });
      return;
    }
    if (petSick()) return;
    // 想去哪就去哪：有时在附近溜达，有时跑到页面另一头
    const r = Math.random();
    if (r < 0.06) {
      roam.tx = roam.x! + (Math.random() - 0.5) * 240;
      roam.ty = roam.y! + (Math.random() - 0.5) * 80;
    } else if (r < 0.08) {
      roam.tx = Math.random() * window.innerWidth;
      roam.ty = window.innerHeight * (0.35 + Math.random() * 0.6);
    } else return;
    clampPet();
    roam.moving = true;
    roam.last = performance.now();
    requestAnimationFrame(stepPet);
  }, 1000);
}
