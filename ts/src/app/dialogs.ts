// 提示条、确认框、图标

import { esc, fmt } from './util';

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(msg: string): void {
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
  clearTimeout(toastTimer!);
  toastTimer = setTimeout(() => el!.classList.remove('show'), 2600);
}

// 确认框和输入框：桌面版里系统弹窗不可靠，网页版也统一用这个，风格一致
function modal(message: string, opts: { ok?: string; input?: boolean; value?: string }): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML =
      '<div class="modal-card" role="dialog" aria-modal="true"><p class="modal-msg">' + esc(message) + '</p>' +
      (opts.input ? '<input class="field modal-input" autocomplete="off" value="' + esc(opts.value || '') + '">' : '') +
      '<div class="actions"><button class="btn small" data-m="ok">' + esc(opts.ok || '确定') + '</button><button class="btn small ghost" data-m="cancel">取消</button></div></div>';
    document.body.appendChild(wrap);
    const input = wrap.querySelector<HTMLInputElement>('.modal-input');
    const onKey = (ev: KeyboardEvent) => {
      if (ev.isComposing || ev.keyCode === 229) return;
      if (ev.key === 'Enter' || ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        done(ev.key === 'Enter');
      }
    };
    function done(ok: boolean) {
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      resolve(input ? (ok ? input.value : null) : ok);
    }
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-m]');
      if (b) done(b.dataset.m === 'ok');
      else if (ev.target === wrap) done(false);
    });
    if (input) {
      input.focus();
      input.select();
    } else wrap.querySelector<HTMLElement>('[data-m="ok"]')!.focus();
  });
}

export const askConfirm = (message: string, ok?: string): Promise<string | boolean | null> => modal(message, { ok });
export const askText = (message: string, value?: string) => modal(message, { input: true, value }) as Promise<string | null>;

export const ICON_OK =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
export const ICON_BAD =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

// 放射状的小太阳：打卡、全对时用
export const ICON_SPARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/></svg>';

// 今日目标的进度环
export function ringHtml(a: number, b: number, cap: string): string {
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
export const BURST = '<span class="burst" aria-hidden="true">' + Array.from({ length: 12 }, (_, i) => '<i style="--a:' + i * 30 + 'deg"></i>').join('') + '</span>';

export const ICON_SPEAK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>';
