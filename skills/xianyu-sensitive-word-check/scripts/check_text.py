#!/usr/bin/env python3
"""闲鱼敏感词本地检测脚本。输出 JSON，供批量或 CI 使用。"""
import argparse
import json
import re
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
WORD_FILE = SKILL_DIR / "word_categories.md"
DATA_DIR = SKILL_DIR / "data"
CUSTOM_FILE = DATA_DIR / "custom_words.txt"
BUILTIN_DIR = DATA_DIR / "builtin"
BUILTIN_FILES = {
    "商品违禁词": "product_banned_words.txt",
    "商品版权词": "copyright_words.txt",
    "平台盗版违规词": "piracy_violation_words.txt",
}

CATEGORY_LEVEL = {
    "外部引流": "high",
    "私下交易": "high",
    "违禁商品": "high",
    "联系方式": "high",
    "广告法极限词": "medium",
    "虚假营销": "medium",
    "医疗功效": "medium",
    "色情低俗": "high",
    "政治敏感": "high",
    "金融赌博": "high",
    "刷单炒信": "high",
    "边界营销词": "low",
    "商品违禁词": "high",
    "商品版权词": "high",
    "平台盗版违规词": "high",
    "平台风控词": "high",
}

PATTERNS = [
    ("联系方式", "high", re.compile(r"1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}")),
    ("联系方式", "high", re.compile(r"0\d{2,3}[-\s]?\d{7,8}")),
    ("联系方式", "high", re.compile(r"[\w.-]+@[\w.-]+\.\w+")),
    ("外部引流", "high", re.compile(r"https?://|www\.\w+", re.I)),
    ("外部引流", "high", re.compile(r"(微信|vx|v信|qq)[号\s:：]*[\w-]{4,}", re.I)),
]

SEP_RE = re.compile(r"[\s\-_*~·•./\\|，,。！!？?；;：:\"'（）()\[\]【】<>《》]+")


def normalize(s: str) -> str:
    return SEP_RE.sub("", s).lower()


def parse_word_file(path: Path) -> dict[str, list[str]]:
    cats: dict[str, list[str]] = {}
    cur = None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## \d+\. (.+?) [🔴🟠🟡]", line)
        if m:
            cur = m.group(1).strip()
            cats[cur] = []
            continue
        if cur and line.strip().startswith("```"):
            continue
        if cur and line.strip() and not line.startswith("#") and not line.startswith("|") and not line.startswith("（"):
            if line.strip() == "```":
                continue
            for w in line.split():
                w = w.strip()
                if w and not w.startswith("（"):
                    cats[cur].append(w)
    return cats


def load_custom() -> list[str]:
    if not CUSTOM_FILE.exists():
        return []
    return [ln.strip() for ln in CUSTOM_FILE.read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.startswith("#")]


def parse_comma_file(path: Path) -> list[str]:
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8").replace("\n", "")
    return [w.strip() for w in raw.split(",") if w.strip()]


def load_builtin() -> dict[str, list[str]]:
    cats: dict[str, list[str]] = {}
    for cat, fname in BUILTIN_FILES.items():
        cats[cat] = parse_comma_file(BUILTIN_DIR / fname)
    return cats


def find_hits(text: str, words: dict[str, list[str]], custom: list[str]) -> list[dict]:
    norm = normalize(text)
    hits = []
    seen = set()

    def add(cat, word, level, match_type="keyword"):
        key = (cat, word, match_type)
        if key in seen:
            return
        seen.add(key)
        hits.append({"category": cat, "word": word, "level": level, "type": match_type})

    for cat, wlist in words.items():
        level = {"high": "high", "medium": "medium", "low": "low"}.get(
            CATEGORY_LEVEL.get(cat, "medium"), "medium"
        )
        for w in wlist:
            if len(w) < 2:
                continue
            nw = normalize(w)
            if nw and nw in norm:
                add(cat, w, level)
            elif w.lower() in text.lower():
                add(cat, w, level)

    for w in custom:
        nw = normalize(w)
        if nw and nw in norm:
            add("自定义", w, "high")

    for cat, level, pat in PATTERNS:
        for m in pat.finditer(text):
            add(cat, m.group(0), level, "pattern")

    order = {"high": 0, "medium": 1, "low": 2}
    hits.sort(key=lambda x: order.get(x["level"], 9))
    return hits


def build_wordlists() -> tuple[dict[str, list[str]], list[str]]:
    words = parse_word_file(WORD_FILE)
    words.update(load_builtin())
    return words, load_custom()


def check(text: str) -> dict:
    """检测文案，返回 verdict / summary / hits。"""
    words, custom = build_wordlists()
    hits = find_hits(text, words, custom)
    high = sum(1 for h in hits if h["level"] == "high")
    medium = sum(1 for h in hits if h["level"] == "medium")
    low = sum(1 for h in hits if h["level"] == "low")
    if high:
        verdict = "不建议发布"
    elif medium or low:
        verdict = "存在风险"
    else:
        verdict = "通过"
    return {
        "verdict": verdict,
        "summary": {"high": high, "medium": medium, "low": low},
        "hits": hits,
    }


def main():
    ap = argparse.ArgumentParser(description="闲鱼敏感词检测")
    ap.add_argument("text", nargs="?", help="待检测文案")
    ap.add_argument("--file", "-f", help="从文件读取文案")
    args = ap.parse_args()

    if args.file:
        text = Path(args.file).read_text(encoding="utf-8")
    elif args.text:
        text = args.text
    else:
        text = sys.stdin.read()

    print(json.dumps(check(text), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
