#!/usr/bin/env python3
"""闲鱼敏感词检测 — 真实业务场景示例。运行: python examples/business_cases.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from check_text import check

# 每个案例: (场景名, 检测模式, 业务描述, 文案)
CASES = [
    (
        "二手数码 · 外部引流",
        "词库匹配 + 变体识别",
        "卖家在商品描述里引导买家加微信看实拍，触发平台引流规则。",
        "iPhone15 国行在保，细节图不够？加薇-信 abc123 发你更多实拍。",
    ),
    (
        "闲鱼客服 · 私下交易",
        "词库匹配",
        "客服为促成成交，提议跳过平台直接转账。",
        "亲，可以不走闲鱼，支付宝直接转账给你便宜50，面交也行。",
    ),
    (
        "潮牌转卖 · 违禁商品",
        "词库匹配 + 语义风险",
        "描述含高仿、原单等违禁品类暗示。",
        "Chanel 1:1精仿，原单尾货，和专柜一样，懂的来。",
    ),
    (
        "租房转租 · 联系方式",
        "正则模式",
        "文案中直接留手机号，触发联系方式规则。",
        "朝阳单间转租，月租3200，看房请联系手机 138-0013-8000。",
    ),
    (
        "母婴闲置 · 广告法极限词",
        "词库匹配",
        "使用绝对化用语做促销。",
        "进口奶粉闲置，全网最低价，第一品牌，100%正品保证。",
    ),
    (
        "代购副业 · 虚假营销",
        "词库匹配",
        "夸大承诺、稳赚类表述。",
        "副业代购，零风险稳赚，假一赔十，日赚300不是问题。",
    ),
    (
        "保健品转让 · 医疗功效",
        "词库匹配",
        "非药品宣传治疗功效，违反医疗广告规定。",
        "自家囤的助眠片，吃了能治疗失眠，根治焦虑，效果特别好。",
    ),
    (
        "论文润色 · 商品违禁词",
        "内置扩展词库",
        "平台禁止代写、论文类违规服务。",
        "承接论文代写、开题报告、查重降重，包过保密。",
    ),
    (
        "考研资料 · 教育版权",
        "版权词库",
        "转售未授权网课/讲师课程，涉及版权侵权。",
        "转让张舟事考全套网课+肖秀荣考研政治PDF，百度网盘秒发。",
    ),
    (
        "软件资源 · 盗版违规",
        "盗版词库",
        "售卖破解软件、永久激活类资源。",
        "Navicat16永久激活，Adobe全家桶中文破解版，剪映永久会员破解版。",
    ),
    (
        "店铺运营 · 批量上架",
        "批量检测模式",
        "运营上架前批量扫描多条商品文案。",
        None,  # 见 batch_check() 多文案
    ),
    (
        "引流擦边 · 变体绕过",
        "变体识别",
        "用谐音、符号间隔规避「微信」等关键词。",
        "想要更多图？加 V X ：seller2024，扣扣群也有。",
    ),
    (
        "合规对照 · 正常发布",
        "全量检测",
        "合规的二手闲置描述，应检测通过。",
        "个人闲置九成新键盘，购于官网，箱说齐全，仅自提或走闲鱼。",
    ),
]


def print_case(name: str, mode: str, desc: str, text: str):
    result = check(text)
    print(f"\n{'='*60}")
    print(f"场景: {name}")
    print(f"模式: {mode}")
    print(f"说明: {desc}")
    print(f"文案: {text}")
    print(f"结论: {result['verdict']} | 高危{result['summary']['high']} 中危{result['summary']['medium']} 低危{result['summary']['low']}")
    if result["hits"]:
        print("命中:")
        for h in result["hits"][:5]:
            print(f"  - [{h['level']}] {h['category']}: {h['word']}")
        if len(result["hits"]) > 5:
            print(f"  ... 共 {len(result['hits'])} 处")


def batch_check(listings: list[dict]) -> list[dict]:
    """批量检测商品标题+描述，返回带检测结果的列表。"""
    out = []
    for item in listings:
        text = f"{item['title']} {item['desc']}"
        r = check(text)
        out.append({**item, "check": r})
    return out


def demo_batch():
    listings = [
        {"id": "SKU001", "title": "九成新 iPad", "desc": "个人自用，走平台交易。"},
        {"id": "SKU002", "title": "考研资料合集", "desc": "肖秀荣考研政治+颉斌斌长难句PDF电子版。"},
        {"id": "SKU003", "title": "机械键盘", "desc": "加微信看细节，13800138000。"},
    ]
    results = batch_check(listings)
    print(f"\n{'='*60}")
    print("场景: 店铺运营 · 批量上架")
    print("模式: 批量检测模式")
    print("说明: 上架前一次扫描多条 SKU，拦截高风险商品。")
    for row in results:
        s = row["check"]["summary"]
        flag = "✓" if row["check"]["verdict"] == "通过" else "✗"
        print(f"  {flag} [{row['id']}] {row['title']} → {row['check']['verdict']} (高{s['high']}/中{s['medium']}/低{s['low']})")
    return results


def main():
    print("闲鱼敏感词检测 — 业务场景示例\n")
    for name, mode, desc, text in CASES:
        if text is None:
            continue
        print_case(name, mode, desc, text)
    demo_batch()
    print(f"\n{'='*60}\n全部示例运行完毕。")


if __name__ == "__main__":
    main()
