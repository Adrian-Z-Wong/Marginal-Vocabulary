// 颜色：五档色阶、变亮、混色

// ================= 颜色 =================

/** 一种颜色的五档：hi 高光、base 本色、mid 暗部、lo 深暗、line 描边 */
export interface Ramp {
  hi: string;
  base: string;
  mid: string;
  lo: string;
  line: string;
}

export function hex2rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl2hex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const f = (k: number) => {
    const kk = (k + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
  };
  return rgb2hex(f(0) * 255, f(8) * 255, f(4) * 255);
}
export function hsl(hex: string): [number, number, number] {
  return rgb2hsl(...hex2rgb(hex));
}
// 色相往 target 转 deg 度（走近的那一边）
function toward(h: number, target: number, deg: number): number {
  let d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), deg);
}

const rampCache = new Map<string, Ramp>();
// 一种颜色的五档：hi 高光、base 本色、mid 暗部、lo 深暗、line 描边
export function ramp(hex: string): Ramp {
  if (rampCache.has(hex)) return rampCache.get(hex)!;
  const [h, s, l] = hsl(hex);
  const r: Ramp = {
    hi: hsl2hex(toward(h, 55, 10), s + 0.04, l + 0.11),
    base: hex,
    mid: hsl2hex(toward(h, 255, 8), s + 0.02, l - 0.09),
    lo: hsl2hex(toward(h, 255, 16), s + 0.04, l - 0.19),
    line: hsl2hex(toward(h, 275, 16), Math.min(0.6, s * 0.6 + 0.08), Math.max(0.09, l * 0.3)),
  };
  rampCache.set(hex, r);
  return r;
}
export function lighten(hex: string, a: number): string {
  const [h, s, l] = hsl(hex);
  return hsl2hex(h, s, l + a);
}
export function desat(hex: string, a: number): string {
  const [h, s, l] = hsl(hex);
  return hsl2hex(h, s * (1 - a), l);
}
export function mix(a: string, b: string, t: number): string {
  const x = hex2rgb(a);
  const y = hex2rgb(b);
  return rgb2hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
