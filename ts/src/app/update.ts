// 检查更新

import { ICON_SPARK, toast } from './dialogs';
import { ui } from './nav';
import { render } from './render';
import { save, state } from './store';
import { DESKTOP, WINDOWS, esc } from './util';

// ================= 检查更新 =================

// 版本号和 desktop/src-tauri/tauri.conf.json 保持一致（tools/build.py 会检查）
const APP_VERSION = '0.6.4';
const REPO = 'Adrian-Z-Wong/Marginal-Vocabulary';
const UPDATE_KEY = 'margin.updateCheck';
const ONLINE = /^https?:$/.test(location.protocol);
const DOWNLOAD_PAGE = 'https://adrian-z-wong.github.io/Marginal-Vocabulary/';

// a 是否比 b 新
function versionNewer(a: string, b: string): boolean {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

// 从 CHANGELOG 里取出比当前版本新的几段更新内容
function changelogSince(text: string, from: string): { v: string; items: string[] }[] {
  const out: { v: string; items: string[] }[] = [];
  for (const part of text.split(/^## /m).slice(1)) {
    const m = /^(\d+\.\d+\.\d+)/.exec(part);
    if (!m || !versionNewer(m[1], from)) continue;
    out.push({ v: m[1], items: part.split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2)) });
  }
  return out;
}

export async function checkUpdate(manual: boolean): Promise<void> {
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
      const asset = (rel.assets || []).find((a: { name: string }) => (WINDOWS ? /-setup\.exe$/ : /\.app\.tar\.gz$/).test(a.name));
      let notes: { v: string; items: string[] }[] = [];
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
    if (manual) toast(ui.update.error!);
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
export function autoCheckUpdate(): void {
  if (window.__MARGIN_TEST && !window.__MARGIN_TEST_UPDATE) return;
  let last = 0;
  try {
    last = +localStorage.getItem(UPDATE_KEY)! || 0;
  } catch (e) {
    last = 0;
  }
  if (Date.now() - last > 12 * 3600 * 1000) setTimeout(() => checkUpdate(false), 2500);
}

export async function installUpdate(): Promise<void> {
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
    await window.__TAURI__!.core!.invoke('save_update_backup', {
      contents: JSON.stringify({ app: 'Marginal Vocabulary', v: 1, exported: new Date().toISOString(), version: APP_VERSION, data: state }),
    });
    await window.__TAURI__!.core!.invoke('install_update', { url: u.url });
    u.installing = false;
    u.installed = true;
  } catch (e) {
    u.installing = false;
    u.error = '自动更新没成功（' + e + '）。可以到 Releases 页面手动下载新版本。';
  }
  render();
}

export function updateBarHtml(): string {
  const u = ui.update;
  if (!u || !u.show || ui.view === 'practice' || ui.view === 'rootquiz') return '';
  let main;
  let acts;
  if (u.installed) {
    main = '<b>新版本 ' + esc(u.latest) + ' 装好了</b><span class="muted">重新打开就是新版本，进度不受影响。</span>';
    acts = '<button class="btn small" data-act="relaunchApp">重新打开</button>';
  } else if (u.installing) {
    main = '<b>正在下载新版本 ' + esc(u.latest) + '…</b><span class="muted">' + (WINDOWS ? '下载好后会打开安装程序，按提示装好就是新版本。' : '大约 4 MB，装好后会提示你重新打开。') + '</span>';
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

export function updateSettingHtml(): string {
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
  const desc = WINDOWS
    ? '每天打开时自动检查一次。有新版本时在应用里下载安装程序，打开后按提示装好：新版本覆盖旧版本，不会留下多个版本；背诵进度存在应用的数据文件夹里，不受影响，更新前还会自动备份一份。'
    : DESKTOP
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
