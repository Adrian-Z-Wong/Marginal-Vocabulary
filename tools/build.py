"""把 src/ 里的网页打包成一个文件 Margin.html（双击就能打开，也用于 GitHub Pages）。

用法：
    python3 tools/build.py
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "Margin.html")


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def check_version():
    """网页里的版本号要和桌面版的一致，检查更新靠它比较版本"""
    with open(os.path.join(ROOT, "desktop", "src-tauri", "tauri.conf.json"), encoding="utf-8") as f:
        desktop = json.load(f)["version"]
    m = re.search(r"const APP_VERSION = '([^']+)'", read("app.js"))
    if not m or m.group(1) != desktop:
        raise SystemExit(f"版本号不一致：src/app.js 是 {m.group(1) if m else '（没找到）'}，tauri.conf.json 是 {desktop}")


def main():
    check_version()
    html = read("index.html")

    def inline_css(m):
        return "<style>\n" + read(m.group(1)) + "</style>"

    def inline_js(m):
        name = m.group(1)
        if not os.path.exists(os.path.join(SRC, name)):
            print(f"跳过不存在的 {name}")
            return ""
        # 防止脚本里的 </script> 提前结束标签
        return "<script>\n" + read(name).replace("</script", "<\\/script") + "</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"已生成 {OUT}（{os.path.getsize(OUT) // 1024} KB）")


if __name__ == "__main__":
    main()
