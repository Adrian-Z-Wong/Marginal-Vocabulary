// 小游戏（ts/src/games）：没有就不显示小游戏

import { api, type GamesApi } from '../games';

export const GAMES: GamesApi | null = api;
