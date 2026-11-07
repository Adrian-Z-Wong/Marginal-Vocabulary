// 等距视角的坐标、颜色小工具：格子坐标 (gx, gy) → 大地图上的像素；颜色变亮变暗、混色

export type Ctx = CanvasRenderingContext2D;
export type TimeOfDay = 'day' | 'dusk' | 'night';

/** 一格的宽和高（菱形，像素） */
export const TW = 32;
export const TH = 16;

export interface G {
  gx: number;
  gy: number;
}

export function timeOfDay(d = new Date()): TimeOfDay {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17) return 'day';
  if ((h >= 17 && h < 19.5) || (h >= 5.5 && h < 7)) return 'dusk';
  return 'night';
}

/** 格子坐标 → 屏幕像素（不含整张地图的偏移） */
export const ix = (gx: number, gy: number): number => (gx - gy) * (TW / 2);
export const iy = (gx: number, gy: number): number => (gx + gy) * (TH / 2);

/** 可以重复的随机数 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexOf(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** 颜色变亮（amt > 0）或变暗（amt < 0） */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = rgbOf(hex);
  const f = (v: number) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return hexOf(f(r), f(g), f(b));
}

/** a 往 b 混 t（0–1） */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return hexOf(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/** 按时间调色：白天原色；傍晚偏暖、暗一点；夜里偏蓝、暗很多 */
export function grade(hex: string, tod: TimeOfDay): string {
  if (tod === 'day') return hex;
  if (tod === 'dusk') return shade(mix(hex, '#f0906a', 0.14), -0.16);
  return shade(mix(hex, '#2a3558', 0.42), -0.42);
}

/** 填一个多边形 */
export function poly(c: Ctx, pts: [number, number][], fill: string | CanvasGradient): void {
  c.fillStyle = fill;
  c.beginPath();
  pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}
