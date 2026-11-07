// 小工具：转义、日期、下载文件

import { toast } from './dialogs';

// ================= 小工具 =================

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function todayKey(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 本地日期的「第几天」，用来算复习日期
export function dayNum(date?: Date): number {
  const d = date || new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

export function dayKeyOf(n: number): string {
  const d = new Date(n * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

// 桌面版（Tauri）里没有浏览器下载，改成直接存到「下载」文件夹
export const DESKTOP = !!(window.__TAURI__ && window.__TAURI__.core);
// Windows 版更新是下载安装程序；Mac 版是直接替换应用
export const WINDOWS = DESKTOP && /Windows/i.test(navigator.userAgent);

export function downloadText(name: string, text: string, type?: string): void {
  if (DESKTOP) {
    window.__TAURI__!.core!
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

export function fmt(n: number | string): string {
  return Number(n).toLocaleString('en-US');
}

export const keyOf = (w: string): string => String(w).trim().toLowerCase();
