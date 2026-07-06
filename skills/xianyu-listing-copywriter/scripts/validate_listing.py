#!/usr/bin/env python3
"""闲鱼文案快检：标题字数 + 高危词/模式。输出 JSON。"""
import argparse
import json
import re
import sys

TITLE_MIN, TITLE_MAX = 15, 20

HIGH_RISK_WORDS = [
    "微信", "vx", "v信", "qq", "私聊", "加我看", "不走闲鱼", "线下转",
    "支付宝直转", "全网最低", "最便宜", "第一", "100%", "假一赔万",
    "假一赔十", "绝对正品", "高仿", "1:1", "原单", "破解", "盗版",
    "论文代写", "代写论文", "包过", "押题必中", "内部渠道", "根治", "治疗", "药到病除",
]

PATTERNS = [
    ("联系方式", re.compile(r"1[3-9]\d{9}")),
    ("联系方式", re.compile(r"[\w.-]+@[\w.-]+\.\w+")),
    ("外部引流", re.compile(r"https?://|www\.\w+", re.I)),
]


def check_title(title: str) -> list[dict]:
    issues = []
    n = len(title.strip())
    if n < TITLE_MIN:
        issues.append({"field": "title", "type": "length", "level": "warn", "msg": f"标题 {n} 字，建议 {TITLE_MIN}-{TITLE_MAX} 字"})
    elif n > TITLE_MAX:
        issues.append({"field": "title", "type": "length", "level": "warn", "msg": f"标题 {n} 字，建议 {TITLE_MIN}-{TITLE_MAX} 字"})
    return issues


def scan_text(text: str, field: str) -> list[dict]:
    hits = []
    low = text.lower()
    for w in HIGH_RISK_WORDS:
        if w.lower() in low:
            hits.append({"field": field, "type": "keyword", "level": "high", "word": w})
    for cat, pat in PATTERNS:
        if pat.search(text):
            hits.append({"field": field, "type": "pattern", "level": "high", "category": cat})
    return hits


def main():
    p = argparse.ArgumentParser(description="闲鱼文案快检")
    p.add_argument("--title", required=True)
    p.add_argument("--body", default="")
    args = p.parse_args()
    issues = check_title(args.title) + scan_text(args.title, "title") + scan_text(args.body, "body")
    high = [i for i in issues if i.get("level") == "high"]
    out = {
        "ok": len(high) == 0,
        "title_length": len(args.title.strip()),
        "issues": issues,
        "verdict": "通过" if not issues else ("不建议发布" if high else "存在风险"),
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    sys.exit(0 if out["ok"] else 1)


if __name__ == "__main__":
    main()
