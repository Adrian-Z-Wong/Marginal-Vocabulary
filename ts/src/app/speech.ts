// 发音

import { toast } from './dialogs';
import { state } from './store';

// ================= 发音 =================

let speakToken = 0;
let currentAudio: HTMLAudioElement | null = null;

export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function speak(word: string): void {
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

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const norm = (l: string) => String(l).replace('_', '-').toLowerCase();
  const same = voices.filter((v) => norm(v.lang) === lang.toLowerCase());
  const pool = same.length ? same : voices.filter((v) => norm(v.lang).startsWith('en'));
  const prefer = ['Google', 'Samantha', 'Daniel', 'Aria', 'Jenny', 'Sonia', 'Natural', 'Microsoft'];
  for (const p of prefer) {
    const v = pool.find((x) => x.name.includes(p));
    if (v) return v;
  }
  return pool[0] || null;
}

function tts(word: string): void {
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

export function initSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}
