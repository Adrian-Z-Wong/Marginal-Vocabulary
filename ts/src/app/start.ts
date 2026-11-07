// 启动

import { checkAchievements, gain } from '../world/coins';
import { GFIXED, GH, GPOND, GW, HOUSE, OY, layoutGarden } from '../world/data';
import { migrate } from '../world/migrate';
import { mainPet, petAlive } from '../world/pets';
import { petSay } from '../world/roam';
import { scene } from '../world/terrain';
import { askConfirm, toast } from './dialogs';
import { applyTheme } from './events';
import { GAMES } from './games';
import { judgeZhLines, similarity, zhMatch } from './judge';
import { bookEntries, bookName, studyBook } from './library';
import { layersOf, meaningHtml } from './meaning';
import { go, ui } from './nav';
import { AFTER, VIEWS } from './registry';
import { allBooks, render } from './render';
import { save, state } from './store';
import { autoCheckUpdate } from './update';
import { dayNum, esc, fmt } from './util';

export function start(): void {
  // 给自动化测试用的入口（只有测试脚本会设置 __MARGIN_TEST）
  if (window.__MARGIN_TEST) window.__margin = { zhMatch, similarity, judgeZhLines, meaningHtml, layersOf };
  if (window.__MARGIN_TEST) window.__setSky = (w, m) => { ui.forceWeather = w; ui.forceMinute = m; };
  if (window.__MARGIN_TEST) window.__houseInfo = () => ({ house: { x: HOUSE.x, y: HOUSE.y, w: HOUSE.w, h: HOUSE.h, sprite: HOUSE.sprite }, oy: OY, fixed: GFIXED.map((d) => ({ id: d.id, x: d.x, y: d.y })), pond: [...GPOND], gw: GW, gh: GH });
  if (window.__MARGIN_TEST) window.__sceneDebug = () => (scene ? { cx: scene.cam.x, cy: scene.cam.y, w: scene.w, h: scene.h, swimT: scene.swimT || 0, setSwimT: (v: number) => { scene!.swimT = v; }, avf: scene.avFrame, av: scene.av, pet: scene.mainEnt(), pets: scene.pets, fish: scene.fish, scale: scene.scale, vw: scene.vw, blocked: () => scene!.blocked(), walk: (x: number, y: number) => scene!.walkTo(x, y) } : null);

  // 小游戏（ts/src/games）：给它一个读写进度、加金币、换页面的接口
  if (GAMES) {
    GAMES.init({
      state: () => state,
      save,
      gain,
      toast,
      render,
      go,
      esc,
      fmt,
      books: () => allBooks().concat(Object.values(state.books).sort((a, b) => a.t - b.t).map((b) => b.id)).map((id) => ({ id, name: bookName(id) })),
      bookWords: (id) => bookEntries(id).map((e) => e.w),
      studyBook,
      today: () => dayNum(),
      confirm: askConfirm as (msg: string, ok: string) => Promise<boolean>,
    });
  }
  VIEWS.games = () => (GAMES ? GAMES.view() : '');
  AFTER.games = () => GAMES && GAMES.after();

  layoutGarden();
  migrate();
  applyTheme();
  render();
  checkAchievements(true);
  if (petAlive()) {
    const mp = mainPet()!;
    setTimeout(() => petSay(mp.sick ? 'sick' : mp.food < 30 ? 'hungry' : mp.mood < 30 ? 'low' : 'hello'), 1500);
  }
  autoCheckUpdate();
}
