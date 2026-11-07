# 第三方声明 / Third-party notices

Margin 的四级、六级、考研、托福、雅思、GRE 词库和音标（`src/words.js`），以及中文词向量（`src/vectors.js`），由开源词典 [ECDICT](https://github.com/skywind3000/ECDICT) 转换生成，打包在 `Margin.html` 里，按其 MIT 许可证使用：

```
MIT License

Copyright (c) 2025 Linwei

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## TOEIC 词表

TOEIC 词库的词表（`data/toeic.tsv`，打包进 `src/words.js`）来自 [New General Service List Project](https://www.newgeneralservicelist.com)，按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可使用；`data/toeic.tsv` 本身同样按 CC BY-SA 4.0 提供。词表里把少数词换成了常见写法（如 headquarter → headquarters），并补写了部分中文释义和音标。

- TOEIC Service List 1.2 — Browne, C. & Culligan, B. (2016)
- New General Service List 1.2 — Browne, C., Culligan, B. & Phillips, J. (2013)

## 打字小游戏的文章

打字追击里的文章（`data/typing/passages.json`，打包进 `src/passages.js`）节选自 OpenStax（Rice University）的开放教材，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可使用，每段都标了书名和章节。节选时把弯引号、破折号换成了键盘能直接打出来的字符，去掉了图表引用。

- Biology、Astronomy、Psychology、Anatomy and Physiology、Introduction to Sociology 2e、Principles of Economics 2e、Principles of Macroeconomics 2e、Introduction to Business、American Government 3e — OpenStax, Rice University, https://openstax.org
