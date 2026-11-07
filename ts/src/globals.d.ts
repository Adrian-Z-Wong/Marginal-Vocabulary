// 页面上的全局变量：词库数据（src/*.js，由 tools/ 生成）、桌面版（Tauri）、自动化测试的入口

interface TauriCore {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

interface Window {
  /** 考试词库：每行「词\t音标\t释义\t标签位\t拓展」 */
  MARGIN_DICT?: string;
  MARGIN_FINANCE?: string;
  MARGIN_MACROFIN?: string;
  MARGIN_MEDICINE?: string;
  /** 词根词缀 */
  MARGIN_ROOTS?: import('./app/types').Root[];
  /** 单词拆解：每行「词\t拆解\t词根链接」 */
  MARGIN_PARTS?: string;
  /** 中文词向量 */
  MARGIN_VEC?: { dim: number; words: string; data: string };
  MARGIN_ART?: unknown;
  MARGIN_PETS?: unknown;
  __TAURI__?: { core?: TauriCore };
  __MARGIN_TEST?: boolean;
  __MARGIN_TEST_UPDATE?: boolean;
  __margin?: unknown;
  __setSky?: (w: string, m: number) => void;
  __houseInfo?: () => unknown;
  __sceneDebug?: () => unknown;
  __marginCheckUpdate?: () => void;
}
