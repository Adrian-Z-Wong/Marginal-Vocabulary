// 时间和天气

import { ui } from '../app/nav';
import { save, state } from '../app/store';
import { dayNum } from '../app/util';
import { plantMax, plantStage, wateredToday } from './garden';

// ---- 时间和天气 ----
// 时间跟着电脑的时钟走：清早、白天、傍晚、夜里光线不一样。天气每天随机一种（同一天怎么打开都一样），
// 冬天（12–2 月）下雨变成下雪。下雨天花园里的植物算浇过水
const WEATHER_NAME: Record<string, string> = { sunny: '晴', cloudy: '多云', overcast: '阴', rain: '小雨', storm: '大雨', snow: '下雪' };
function weatherOf(day: number): string {
  let h = (day * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  const r = (h % 10000) / 10000;
  const w = r < 0.45 ? 'sunny' : r < 0.67 ? 'cloudy' : r < 0.8 ? 'overcast' : r < 0.93 ? 'rain' : 'storm';
  const month = new Date(day * 86400000).getUTCMonth();
  return (month === 11 || month <= 1) && (w === 'rain' || w === 'storm') ? 'snow' : w;
}
export function weatherNow(): string {
  return ui.forceWeather || weatherOf(dayNum());
}
export function minuteNow(): number {
  if (ui.forceMinute != null) return ui.forceMinute;
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
export function clockText(): string {
  const m = minuteNow();
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ' · ' + WEATHER_NAME[weatherNow()];
}
// 一天里盖在画面上的颜色：夜里深蓝、清早和傍晚暖一点
const SKY: [number, number[]][] = [
  [0, [14, 22, 58, 0.5]],
  [270, [14, 22, 58, 0.5]],
  [330, [255, 170, 120, 0.12]],
  [420, [255, 255, 255, 0]],
  [990, [255, 255, 255, 0]],
  [1065, [255, 160, 80, 0.15]],
  [1110, [80, 45, 110, 0.3]],
  [1170, [14, 22, 58, 0.5]],
  [1440, [14, 22, 58, 0.5]],
];
export function skyTint(m: number): number[] {
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= m) i++;
  const [m0, a] = SKY[i];
  const [m1, b] = SKY[i + 1];
  const k = m1 > m0 ? (m - m0) / (m1 - m0) : 0;
  const ca = a[3] ? a : b;
  const cb = b[3] ? b : a;
  return [0, 1, 2].map((j) => Math.round(ca[j] + (cb[j] - ca[j]) * k)).concat(a[3] + (b[3] - a[3]) * k);
}
// 现在有多黑（0 白天到 1 半夜），用来决定点不点灯
export function darkness(m: number): number {
  const t = skyTint(m);
  return t[0] < 120 ? Math.min(1, t[3] / 0.5) : 0;
}
export const WEATHER_TINT: Record<string, number[]> = { overcast: [100, 108, 122, 0.24], rain: [70, 82, 105, 0.24], storm: [45, 55, 80, 0.34], snow: [215, 225, 240, 0.1] };
// 下雨天：今天还没浇水的植物都算浇过了（每天只算一次）
export function rainTick(): void {
  const W = state.world;
  const today = dayNum();
  if (W.rainDay === today || !['rain', 'storm'].includes(weatherOf(today))) return;
  W.rainDay = today;
  for (const pl of W.plants) if (plantStage(pl) < plantMax(pl) && !wateredToday(pl)) pl.w = (pl.w || []).concat(today);
  save();
}
