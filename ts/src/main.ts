// Marginal Vocabulary 的入口：按原来的顺序把各个模块装起来（esbuild 打包成 src/app.js）

import { ART } from './art';
import { MARGIN_PETS } from './data/pets';
import './games';
import './app/books';
import './app/store';
import './app/util';
import './app/meaning';
import './app/dialogs';
import './app/library';
import './app/stats';
import './app/judge';
import { initSpeech } from './app/speech';
import './app/importer';
import './app/nav';
import './app/session';
import './app/render';
import './app/views/home';
import './app/views/practice';
import './app/views/result';
import './app/views/books';
import './app/views/wrong';
import './app/views/settings';
import './app/roots/quiz';
import './app/roots/views';
import './app/update';
import './app/actions';
import './world/data';
import './world/coins';
import './world/bag';
import './world/pets';
import './world/garden';
import './world/sky';
import './world/debris';
import './world/occupancy';
import './world/migrate';
import { initRoam } from './world/roam';
import './world/terrain';
import './world/scene';
import './world/sceneui';
import { initBag } from './world/bagui';
import './world/shop';
import './world/actions';
import { initEvents } from './app/events';
import { start } from './app/start';

// 像素画和宠物数据也挂在 window 上（自动化测试会用到）
window.MARGIN_ART = ART;
window.MARGIN_PETS = MARGIN_PETS;

initSpeech();
initRoam();
initBag();
initEvents();
start();
