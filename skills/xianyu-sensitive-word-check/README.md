# xianyuSensitiveWords

闲鱼商品文案敏感词检测工具。用于发布前检查标题、描述是否可能触发平台违禁词、版权词、极限词或引流规则，降低下架、限流风险。

> 词库基于公开规则与常见违规类型整理，**不能替代**闲鱼官方实时审核。

## 功能

- 15 类风险词库：引流、私下交易、违禁商品、极限词、版权、盗版等
- 2100+ 内置词条（商品违禁词 397、版权词 1561、盗版违规词 193）
- 支持谐音/拆字/符号变体匹配（如 vx、薇信、微-信）
- 正则识别手机号、邮箱、链接、社交账号
- 支持自定义词库扩展
- 提供 Cursor Agent Skill 与本地 CLI 脚本

## 目录结构

```
.cursor/skills/xianyu-sensitive-word-check/
├── SKILL.md                    # Agent 检测流程与输出模板
├── README.md                   # 使用说明
├── word_categories.md          # 15 类分类词库说明
├── data/
│   ├── custom_words.txt        # 自定义词（每行一个）
│   └── builtin/
│       ├── product_banned_words.txt    # 商品违禁词
│       ├── copyright_words.txt         # 商品版权词
│       └── piracy_violation_words.txt  # 平台盗版违规词
├── scripts/
│   └── check_text.py           # 本地检测脚本（含 check() API）
├── examples/
│   └── business_cases.py       # 13 个业务场景可运行示例
└── examples.md                 # 案例说明文档
```

## 使用方式

### 1. Cursor Agent Skill

在 Cursor 对话中 @ 引用 `xianyu-sensitive-word-check`，或直接说：

```
帮我检测这段闲鱼文案是否含敏感词：……
```

Agent 会读取词库，输出分级检测报告（高危 / 中危 / 低危）及修改建议。

### 2. 命令行脚本

```bash
# 直接传入文案
python .cursor/skills/xianyu-sensitive-word-check/scripts/check_text.py "九成新 iPhone，加微信看细节"

# 从文件读取
python .cursor/skills/xianyu-sensitive-word-check/scripts/check_text.py --file copy.txt

# 从 stdin 读取
echo "待检测文案" | python .cursor/skills/xianyu-sensitive-word-check/scripts/check_text.py
```

输出 JSON 示例：

```json
{
  "verdict": "不建议发布",
  "summary": { "high": 2, "medium": 1, "low": 0 },
  "hits": [
    { "category": "外部引流", "word": "微信", "level": "high", "type": "keyword" }
  ]
}
```

结论说明：

| verdict | 含义 |
|---------|------|
| 通过 | 未命中词库 |
| 存在风险 | 仅有中/低危命中 |
| 不建议发布 | 存在高危命中 |

### 3. 业务场景示例

每个检测模式配套真实闲鱼业务案例（数码引流、客服话术、批量上架、考研版权、论文违禁、盗版软件等）：

```bash
python .cursor/skills/xianyu-sensitive-word-check/examples/business_cases.py
```

详细说明与接入代码见 [examples.md](examples.md)。

## 词库分类

| 类别 | 风险 | 说明 |
|------|------|------|
| 外部引流 | 高 | 微信、QQ、抖音、外链等 |
| 私下交易 | 高 | 不走平台、线下转账等 |
| 违禁商品 | 高 | 高仿、假货、管制物品等 |
| 联系方式 | 高 | 电话、邮箱、社交账号 |
| 广告法极限词 | 中 | 最、第一、100% 等 |
| 虚假营销 | 中 | 假一赔十、稳赚等 |
| 医疗功效 | 中 | 治疗、根治等 |
| 商品违禁词 | 高 | 平台商品类目禁用词 |
| 商品版权词 | 高 | 课程/IP/视听作品版权 |
| 平台盗版违规词 | 高 | 破解版、盗版资料等 |
| 平台风控词 | 高 | 论文、论文分析、教育等机器审核高频词 |
| 其他 | 高/低 | 色情、政治、赌博、刷单、边界营销词 |

完整词条见 `word_categories.md` 与 `data/builtin/` 下 txt 文件。

## 扩展词库

**自定义词**：编辑 `data/custom_words.txt`，每行一个词，以 `#` 开头为注释。

**内置词库**：编辑 `data/builtin/` 下对应 txt，词条以英文逗号分隔。

## 环境要求

- Python 3.10+（脚本仅使用标准库，无第三方依赖）
- Cursor IDE（使用 Agent Skill 时）

## 免责声明

本工具仅供文案合规自查参考。闲鱼平台规则会动态更新，最终审核结果以平台为准。版权相关词条涉及第三方 IP，请确保商品描述与售卖内容合法合规。
