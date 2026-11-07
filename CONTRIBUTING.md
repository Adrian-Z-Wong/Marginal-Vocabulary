# 参与贡献

谢谢你愿意帮 Marginal Vocabulary 变得更好。

## 词库纠错（最欢迎）

Finance 词库的原始表格在 [`data/finance/`](data/finance/)：

| 文件 | 学科 |
| --- | --- |
| `economics.tsv` | 经济学（含计量、统计、研究方法） |
| `finance.tsv` | 金融学 |
| `management.tsv` | 管理学 |
| `accounting.tsv` | 会计学 |

每行一个词条，三列用 Tab 分隔：`英文术语	中文释义	小类`。

- 英文用美式拼写，缩写写在中文释义末尾的括号里，例如 `capital asset pricing model	资本资产定价模型（CAPM）	资产定价`。
- 中文用国内教材最通行的译名；几个译名都常用时用全角分号「；」隔开，常用的放前面。
- 改完运行 `python3 tools/build_terms.py` 和 `python3 tools/build.py`，再提交 Pull Request。

不熟悉 Git 也没关系，直接[提一个「词条纠错」Issue](https://github.com/Adrian-Z-Wong/Marginal-Vocabulary/issues/new/choose) 就行。

CET-4、CET-6、GEE、TOEFL、IELTS、GRE、GMAT 词库来自 [ECDICT](https://github.com/skywind3000/ECDICT)，释义问题可以同时反馈给上游。

## 改代码

- 界面代码用 TypeScript 写在 `ts/src/`，入口是 `main.ts`：
  - `app/`：背单词、词根、词库、错题本、设置这些页面，存档、判分、发音、检查更新
  - `world/`：花园、小屋、宠物、商店、背包、天气和时间
  - `art/`：像素画全部用代码画（宠物、小人、房子、植物、装饰、家具、物品、花园地面）
  - `data/`：宠物、树种、商店货架和台词
  - `games/`：小游戏（打字追击在 `games/chase/`），和主程序只通过 `games/host.ts` 里的接口打交道
- 改完在 `ts/` 里运行 `npm install`（第一次）和 `npm run build`：先做严格的类型检查，再编译成 `src/app.js`（生成的文件，不要手改）。`src/` 里还有 `index.html`、`style.css` 和词库数据。
- 版本号写在 `ts/src/app/update.ts` 的 `APP_VERSION` 和 `desktop/src-tauri/tauri.conf.json` 里，两处要一致（`tools/build.py` 会检查），应用内检查更新靠它比较版本。
- 开发时在 `ts/` 里运行 `npm run build`，再用浏览器打开 `src/index.html`，刷新就能看到改动。
- 提交前运行 `python3 tools/build.py`，更新打包好的 `Margin.html`。

生成数据的脚本：

```bash
python3 tools/build_words.py     # 考试词库 src/words.js（自动下载 ECDICT；GMAT 词表在 data/gmat.tsv）
python3 tools/build_terms.py     # Finance、MacroFin、Medicine 词库 src/finance.js、src/macrofin.js、src/medicine.js
python3 tools/build_roots.py     # 词根和单词拆解 src/roots.js（data/roots/）
pip install numpy scipy
python3 tools/build_vectors.py   # 中文词向量 src/vectors.js
python3 tools/build_passages.py  # 打字小游戏的文章 data/typing/passages.json、src/passages.js（OpenStax CC BY 教材）
(cd ts && npm run build)         # 界面和小游戏 src/app.js
python3 tools/build.py           # 打包 Margin.html
```

Mac、Windows 应用在 `desktop/`，用 [Tauri](https://tauri.app) 把 `Margin.html` 包成 App（Rust 写的外壳在 `desktop/src-tauri/src/`）。发布新版本：改 `desktop/src-tauri/tauri.conf.json` 里的 `version` 并推送到 `main`，GitHub Actions 会先打包 Mac 的 `.dmg`、创建 `v版本号` 标签并发布到 Releases，再打包 Windows 的安装程序 `…_x64-setup.exe` 传到同一个 Release。也可以在 Actions 页面手动运行「桌面应用」。
- 风格：米白纸面、墨色文字、陶土色点缀（深色外观是暖调炭灰）；英文用 Times New Roman 斜体，中文用仿宋；界面文字用中文。
- 进度存在浏览器 `localStorage` 的 `margin.v1` 里。改数据结构时要兼容旧数据。
