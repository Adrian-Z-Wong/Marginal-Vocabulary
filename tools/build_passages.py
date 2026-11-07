"""打字小游戏的文章：从 OpenStax 的开放教材里挑段落，按词库分好，写到 data/typing/passages.json。

只用 CC BY 4.0 许可的 OpenStax 教材（旧版本，新版大多是 CC BY-NC-SA），每段注明出处：
    Biology、Astronomy、Psychology、Anatomy and Physiology、Introduction to Sociology 2e、
    Principles of Economics 2e、Principles of Macroeconomics 2e、Introduction to Business、American Government 3e

怎么挑：
  1. 取各节正文里 45–110 个词、只含键盘上能直接打出来的字符、不引用图表的段落；
  2. 专业词库（Finance、MacroFin、Medicine）按段落里出现的本词库术语打分（多词术语算两分）；
  3. 考试词库按「本级别要掌握的词」打分，再扣掉「超出本级别的生词」：
     CET-4 要的是读得懂的段落（生词扣得重），GRE 要的是难词多的段落（几乎不扣）；
  4. 每个词库取 60 段，同一节最多一段，考试词库里同一本教材最多占三分之一。

用法：
    python3 tools/build_passages.py          # 教材原文缓存在 tools/.cache/openstax/，没有就从 OpenStax 下载
    python3 tools/build_passages.py --js     # 只从 data/typing/passages.json 重新生成 src/passages.js
    python3 tools/build.py                   # 再打包进 Margin.html
"""

import collections
import concurrent.futures as cf
import html
import json
import os
import re
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache", "openstax")
OUT = os.path.join(ROOT, "data", "typing", "passages.json")
ARCHIVE = "https://openstax.org/apps/archive/20260604.144757"
RELEASE = "https://openstax.org/rex/release.json"

# 键：(OpenStax 书号, 中文显示名)
BOOKS = {
    "biology": ("185cbf87-c72e-48f5-b51e-f14f21b5eabd", "Biology"),
    "astronomy": ("2e737be8-ea65-48c3-aa0a-9f35b4c6a966", "Astronomy"),
    "psychology": ("4abf04bf-93a0-45c3-9cbc-2cefd46e68cc", "Psychology"),
    "anatomy": ("14fb4ad7-39a1-4eee-ab6e-3ef2482e3e22", "Anatomy and Physiology"),
    "sociology2e": ("02040312-72c8-441e-a685-20e9333f3e1d", "Introduction to Sociology 2e"),
    "economics2e": ("bc498e1f-efe9-43a0-8dea-d3569ad09a82", "Principles of Economics 2e"),
    "macro2e": ("27f59064-990e-48f1-b604-5188b9086c29", "Principles of Macroeconomics 2e"),
    "business": ("4e09771f-a8aa-40ce-9063-aa58cc24e77f", "Introduction to Business"),
    "govt3e": ("30e47181-f52c-4a91-9c11-33380c428268", "American Government 3e"),
}
GENERAL = {"biology", "astronomy", "psychology", "sociology2e", "govt3e", "economics2e", "business", "macro2e"}
PER_BOOK = 60

# ---------------- 下载 ----------------


def get_json(url):
    err = None
    for _ in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # 网络偶尔失败，重试几次
            err = e
    raise err


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def section_pages(tree, chapter=""):
    """书目录里编号为「章.节」的正文页面"""
    for c in tree.get("contents", []):
        t = c.get("title", "")
        num = re.search(r'os-number">(?:<span[^>]*>[^<]*</span>)?([0-9.]+)<', t)
        title = html.unescape(re.sub(r"\s+", " ", strip_tags(t))).strip()
        if "contents" in c:
            yield from section_pages(c, title if "Chapter" in t else chapter)
        elif num and re.match(r"^\d+\.\d+$", num.group(1)):
            yield c["id"], num.group(1), title


def download(key):
    path = os.path.join(CACHE, key + ".json")
    if os.path.exists(path):
        return json.load(open(path))
    os.makedirs(CACHE, exist_ok=True)
    rel_path = os.path.join(CACHE, "release.json")
    if not os.path.exists(rel_path):
        json.dump(get_json(RELEASE), open(rel_path, "w"))
    bid = BOOKS[key][0]
    ver = json.load(open(rel_path))["books"][bid]["defaultVersion"]
    meta = get_json(f"{ARCHIVE}/contents/{bid}@{ver}.json")
    lic = meta["license"]["url"]
    if "/by/" not in lic or "-nc" in lic or "-sa" in lic:
        raise SystemExit(f"{key} 不是 CC BY 许可：{lic}")

    def one(p):
        pid, num, title = p
        d = get_json(f"{ARCHIVE}/contents/{bid}@{ver}:{pid.split('@')[0]}.json")
        return {"num": num, "title": title, "html": d["content"]}

    with cf.ThreadPoolExecutor(8) as ex:
        pages = list(ex.map(one, list(section_pages(meta["tree"]))))
    data = {"book": meta["title"], "license": lic, "id": bid, "version": ver, "slug": meta.get("slug"), "pages": pages}
    json.dump(data, open(path, "w"))
    print(f"下载了 {meta['title']}：{len(pages)} 节")
    return data


# ---------------- 取段落 ----------------

SKIP_BLOCKS = (
    "figure", "table", "example", "link-to-learning", "review", "glossary", "key-terms", "exercise", "problem", "solution",
    "note", "footnote", "os-caption", "learning-objectives", "abstract", "interactive", "everyday", "visual-connection",
    "career", "evolution", "connection",
)
REPL = {
    "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": " - ", "…": "...",
    " ": " ", " ": " ", " ": " ", " ": " ", "­": "", "′": "'", "−": "-", "×": "x",
}
TYPABLE = re.compile(r"^[A-Za-z0-9 .,;:'\"()?!%$&/-]+$")


def clean(t):
    t = html.unescape(strip_tags(t))
    for a, b in REPL.items():
        t = t.replace(a, b)
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"\s*\((?:see )?(?:Figure|Table|Example|Link|Chapter|Exhibit)[^)]*\)", "", t)
    t = re.sub(r"\s*\[[^\]]*\]", "", t)
    t = re.sub(r"\s*\([A-Z][A-Za-z]+(?: (?:and|&) [A-Z][A-Za-z]+| et al\.)?,? \d{4}[a-z]?(?:; [^)]*)?\)", "", t)
    return re.sub(r"\s+", " ", t).strip()


def paragraphs(page_html):
    h = page_html
    for cls in SKIP_BLOCKS:
        h = re.sub(r'<(div|section|figure|table|aside)[^>]*(?:class|data-type)="[^"]*' + cls + r'[^"]*"[^>]*>.*?</\1>', " ", h, flags=re.S)
    for m in re.finditer(r"<p[^>]*>(.*?)</p>", h, re.S):
        yield m.group(1)


def usable(raw, t):
    if re.search(r"<(math|img|sub|sup|ol|ul)", raw):
        return False
    if not 45 <= len(t.split()) <= 110 or not TYPABLE.match(t):
        return False
    if not re.match(r'^[A-Z"]', t) or not re.search(r'[.?!]"?$', t) or t.count('"') % 2:
        return False
    if sum(c.isdigit() for c in t) > 20:
        return False
    # 开头接着上文说的（This、However、In contrast……），单独拿出来读不通
    if re.match(r"^(This|These|That|Those|Such|However|Thus|Therefore|Also|Instead|Similarly|Likewise|In contrast|On the other hand|As a result|For this reason|In this|Second|Third|Finally|Another|Then|They|He|She|Both|Neither|Each of|Here)\b", t):
        return False
    return not re.search(
        r"\b(this (chapter|section|module|book)|you will (learn|read)|the following|as follows|below\b|above\b|Figure|Table|Exhibit|https?:|www\.)",
        t,
        re.I,
    )


def collect():
    out, seen = [], set()
    for key in BOOKS:
        d = download(key)
        for pg in d["pages"]:
            if re.search(r"Introduction|Summary|Key Terms|Questions", pg["title"]):
                continue
            for raw in paragraphs(pg["html"]):
                t = clean(raw)
                if usable(raw, t) and t not in seen:  # 同一段在两本书里都有，只留一份
                    seen.add(t)
                    out.append({"src": key, "book": BOOKS[key][1], "slug": d["slug"], "sec": pg["num"], "title": pg["title"], "text": t})
    return out


# ---------------- 打分、挑选 ----------------


def js_var(name):
    with open(os.path.join(ROOT, "src", name), encoding="utf-8") as f:
        t = f.read()
    return json.loads(t[t.index("=") + 1 :].strip().rstrip(";"))


TAGS = ["zk", "gk", "cet4", "cet6", "ky", "ielts", "toefl", "gre", "gmat", "toeic"]
STOP = set(
    "a an the of to in on for and or but is are was were be been being it its this that these those with as by at from which who "
    "whom whose what when where why how not no than then there their they them he she his her we our you your i me my us do does "
    "did done have has had can could may might must shall should will would also such so very more most other some any each many "
    "much few one two three".split()
)


def lemmas(w):
    yield w
    if w.endswith("ies"):
        yield w[:-3] + "y"
    if w.endswith("es"):
        yield w[:-2]
    if w.endswith("s"):
        yield w[:-1]
    if w.endswith("ied"):
        yield w[:-3] + "y"
    if w.endswith("ed"):
        yield w[:-2]
        yield w[:-1]
    if w.endswith("ing"):
        yield w[:-3]
        yield w[:-3] + "e"
    if w.endswith("ly"):
        yield w[:-2]


def find(tok, words):
    for f in lemmas(tok):
        if f in words:
            return f
    return None


def term_list(name):
    out = {}
    for line in js_var(name).split("\n"):
        k = re.sub(r"\s*\([^)]*\)", "", line.split("\t")[0]).strip().lower()
        if len(k) >= 3 and re.match(r"^[a-z][a-z0-9 '\-]*$", k):
            out[k] = 2 if " " in k else 1
    return out


def select(paras):
    words = {}
    for line in js_var("words.js").split("\n"):
        w, _, _, mask, _ = line.split("\t")
        words[w.lower()] = words.get(w.lower(), 0) | int(mask)
    tag = lambda t: {w for w, m in words.items() if m >> TAGS.index(t) & 1}  # noqa: E731
    basic = tag("zk") | tag("gk")
    B = {t: tag(t) for t in TAGS}
    B["cet4"] |= B["gk"]
    B["cet6"] |= B["cet4"]
    B["ky"] |= B["cet4"]
    every = set(words)
    # 考试词库：(要掌握的词, 认得的词, 每个生词扣几分, 用哪些教材)
    exam = {
        "cet4": (B["cet4"] - basic, B["cet4"] | basic, 2.5, GENERAL),
        "cet6": (B["cet6"] - B["cet4"], B["cet6"] | basic, 1.6, GENERAL),
        "ky": (B["ky"] - B["cet4"], B["ky"] | basic, 1.4, GENERAL),
        "toefl": (B["toefl"] - B["cet4"], B["toefl"] | B["cet4"] | basic, 1.0, GENERAL),
        "ielts": (B["ielts"] - B["cet4"], B["ielts"] | B["cet4"] | basic, 1.0, GENERAL),
        "toeic": (B["toeic"] - basic, B["toeic"] | B["cet4"] | basic, 1.2, {"business", "economics2e", "psychology", "sociology2e"}),
        "gre": (B["gre"] - B["cet6"], B["gre"] | B["cet6"] | basic, 0.35, GENERAL),
        "gmat": (B["gmat"] - B["cet4"], B["gmat"] | B["cet6"] | basic, 0.6, GENERAL),
    }
    terms = {"fin": term_list("finance.js"), "mf": term_list("macrofin.js"), "med": term_list("medicine.js")}
    term_src = {"fin": {"business", "economics2e", "macro2e"}, "mf": {"macro2e", "economics2e"}, "med": {"anatomy", "biology"}}

    for p in paras:
        toks = re.findall(r"[A-Za-z]+(?:'[a-z]+)?", p["text"])
        # 句子中间大写开头的多半是专有名词，不当生词
        low = [t.lower() for i, t in enumerate(toks) if not (t[0].isupper() and i > 0)]
        p["_toks"] = [t for t in low if t not in STOP and len(t) > 2]
        p["_low"] = " " + re.sub(r"[^a-z0-9' -]+", " ", p["text"].lower()) + " "

    picked = {}
    for book in ["fin", "mf", "med"] + list(exam):
        cand = []
        for i, p in enumerate(paras):
            n = max(1, len(set(p["_toks"]))) ** 0.5
            if book in terms:
                if p["src"] not in term_src[book]:
                    continue
                T = terms[book]
                found = {t for t in T if (" " + t + " ") in p["_low"] or (" " + t + "s ") in p["_low"]}
                found = {t for t in found if not any(t != u and t in u for u in found)}
                cand.append((sum(T[t] for t in found) / n, i))
            else:
                tgt, known, pen, src = exam[book]
                if p["src"] not in src:
                    continue
                hits = {find(t, tgt) for t in p["_toks"]} - {None}
                hard = {t for t in p["_toks"] if not find(t, known) and find(t, every)}
                cand.append(((len(hits) - pen * len(hard)) / n, i))
        cand.sort(key=lambda c: (-c[0], c[1]))
        chosen, secs, per_src = [], set(), collections.Counter()
        for s, i in cand:
            p = paras[i]
            if (p["src"], p["sec"]) in secs or (book in exam and per_src[p["src"]] >= PER_BOOK // 3):
                continue
            chosen.append(i)
            secs.add((p["src"], p["sec"]))
            per_src[p["src"]] += 1
            if len(chosen) >= PER_BOOK:
                break
        picked[book] = chosen
        print(f"{book}: {len(chosen)} 段", dict(per_src))
    return picked


def main():
    paras = collect()
    print(f"可用段落 {len(paras)}")
    picked = select(paras)
    used = sorted({i for v in picked.values() for i in v})
    index = {i: n for n, i in enumerate(used)}
    sources = {}
    for key, (bid, name) in BOOKS.items():
        sources[key] = {"name": name, "url": f"https://openstax.org/details/books/{json.load(open(os.path.join(CACHE, key + '.json')))['slug']}"}
    out = {
        "license": "Texts from OpenStax (Rice University), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Paragraphs are excerpted; quotes and dashes are converted to plain ASCII and figure references removed.",
        "sources": sources,
        "passages": [{"src": paras[i]["src"], "sec": paras[i]["sec"] + " " + re.sub(r"^\d+\.\d+\s*", "", paras[i]["title"]), "text": paras[i]["text"]} for i in used],
        "books": {b: [index[i] for i in v] for b, v in picked.items()},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print(f"写入 {OUT}：{len(used)} 段（{os.path.getsize(OUT) // 1024} KB）")
    write_js(out)


def write_js(out=None):
    """data/typing/passages.json -> src/passages.js（打包进网页）"""
    if out is None:
        out = json.load(open(OUT, encoding="utf-8"))
    js = os.path.join(ROOT, "src", "passages.js")
    with open(js, "w", encoding="utf-8") as f:
        f.write("// 由 tools/build_passages.py 根据 data/typing/passages.json 生成，请勿手动修改\n")
        f.write("window.MARGIN_PASSAGES = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"写入 {js}（{os.path.getsize(js) // 1024} KB）")


if __name__ == "__main__":
    import sys

    if "--js" in sys.argv:  # 只从 passages.json 重新生成 src/passages.js
        write_js()
    else:
        main()
