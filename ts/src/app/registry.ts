// 页面和按钮的登记表：各个模块把自己的页面（VIEWS）、画完以后要做的事（AFTER）、按钮操作（ACTIONS）登记在这里

/** 带 data-act 的按钮：data-* 属性按有值来用 */
export type ActEl = HTMLElement & { dataset: Record<string, string> };
export type Action = (t: ActEl, ev?: Event) => unknown;

export const VIEWS: Record<string, () => string> = {};
export const AFTER: Record<string, () => void> = {};
export const ACTIONS: Record<string, Action> = {};
