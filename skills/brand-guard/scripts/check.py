#!/usr/bin/env python3
"""
守門員 check.py —— 發文前品質檢查

用法：
    python3 check.py "要檢查的文字"
    python3 check.py --file 貼文草稿.txt
    echo "要檢查的文字" | python3 check.py

四項檢查：
  (a) 高風險罐頭句型（「不是 A 而是 B」「先不要 A 先 B」類，正規表示式）
  (b) Threads 500 字上限（Python len() 算 Unicode 字元，不是 bytes）
  (c) 禁詞清單（可配置，預設空，見 config/banned-words.example.json）
  (d) 連續大段落（超過 3 行無斷行）

輸出：人話報告，每項 ✅ / ⚠️ + 哪一句 + 怎麼改。
不改寫文字、只檢查。
"""

import sys
import re
import json
import argparse
from pathlib import Path

THREADS_LIMIT = 500
SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_DIR = SCRIPT_DIR.parent / "config"
BANNED_WORDS_FILE = CONFIG_DIR / "banned-words.json"
BANNED_WORDS_EXAMPLE = CONFIG_DIR / "banned-words.example.json"

# ---------------------------------------------------------------------------
# (a) 高風險罐頭句型 —— AI 腔常見的對比句型
# ---------------------------------------------------------------------------
CANNED_PATTERNS = [
    {
        "name": "不是A而是B",
        "pattern": re.compile(r"不是.{1,20}而是.{1,20}"),
        "advice": "這種「否定前半、肯定後半」的對比句是很典型的 AI 腔，讀者一眼就認得出來。試著直接講你要講的那句就好，不用先繞一個「不是」。",
    },
    {
        "name": "先不要A先B",
        "pattern": re.compile(r"先不要.{1,20}先.{1,20}"),
        "advice": "「先不要 A、先 B」這種先抑後揚的句型太罐頭了。直接講「先 B」就好，不需要鋪陳一個要被否定的 A。",
    },
    {
        "name": "這不是A這是B",
        "pattern": re.compile(r"這不是.{1,20}這是.{1,20}"),
        "advice": "跟「不是 A 而是 B」同一個家族，換句話說也是 AI 常用的萬用句型，建議整句換掉、講具體內容。",
    },
    {
        "name": "重點不是A而是B",
        "pattern": re.compile(r"重點不是.{1,20}(而是|是).{1,20}"),
        "advice": "「重點不是 A 而是 B」是最常見的 AI 總結句，容易讓讀者出戲。直接講重點是什麼。",
    },
]

# ---------------------------------------------------------------------------
# (d) 連續大段落 —— 超過 3 行無斷行視為警訊
# ---------------------------------------------------------------------------
MAX_CONSECUTIVE_LINES_WITHOUT_BREAK = 3


def load_banned_words():
    """讀禁詞清單，優先讀使用者自訂檔，沒有就視為空清單。"""
    if BANNED_WORDS_FILE.exists():
        try:
            data = json.loads(BANNED_WORDS_FILE.read_text(encoding="utf-8"))
            return data.get("banned_words", [])
        except (json.JSONDecodeError, OSError):
            return []
    return []


def check_canned_phrases(text):
    """(a) 高風險罐頭句型檢查。回傳 (ok, findings)"""
    findings = []
    for rule in CANNED_PATTERNS:
        for m in rule["pattern"].finditer(text):
            findings.append({
                "type": rule["name"],
                "snippet": m.group(0),
                "advice": rule["advice"],
            })
    return (len(findings) == 0, findings)


def check_length(text):
    """(b) Threads 500 字上限，用 Unicode 字元數算，不是 bytes。"""
    char_count = len(text)
    ok = char_count <= THREADS_LIMIT
    return (ok, char_count)


def check_banned_words(text, banned_words):
    """(c) 禁詞清單檢查。"""
    findings = []
    for word in banned_words:
        if not word:
            continue
        idx = text.find(word)
        if idx != -1:
            start = max(0, idx - 8)
            end = min(len(text), idx + len(word) + 8)
            findings.append({
                "word": word,
                "context": text[start:end],
            })
    return (len(findings) == 0, findings)


def check_paragraph_breaks(text):
    """(d) 連續大段落檢查：超過 3 行完全無斷行（無空行）視為警訊。"""
    lines = text.split("\n")
    findings = []
    consecutive_non_blank = 0
    block_start_idx = 0

    for i, line in enumerate(lines):
        if line.strip() == "":
            if consecutive_non_blank > MAX_CONSECUTIVE_LINES_WITHOUT_BREAK:
                block = "\n".join(lines[block_start_idx:i])
                findings.append({
                    "line_range": f"第 {block_start_idx + 1} 行 ~ 第 {i} 行",
                    "line_count": consecutive_non_blank,
                    "snippet": block[:60] + ("..." if len(block) > 60 else ""),
                })
            consecutive_non_blank = 0
            block_start_idx = i + 1
        else:
            consecutive_non_blank += 1

    # 檢查文字結尾前還沒收斂的大段落
    if consecutive_non_blank > MAX_CONSECUTIVE_LINES_WITHOUT_BREAK:
        block = "\n".join(lines[block_start_idx:])
        findings.append({
            "line_range": f"第 {block_start_idx + 1} 行 ~ 第 {len(lines)} 行",
            "line_count": consecutive_non_blank,
            "snippet": block[:60] + ("..." if len(block) > 60 else ""),
        })

    return (len(findings) == 0, findings)


def build_report(text):
    """跑四項檢查、組成人話報告字串。"""
    banned_words = load_banned_words()

    canned_ok, canned_findings = check_canned_phrases(text)
    length_ok, char_count = check_length(text)
    banned_ok, banned_findings = check_banned_words(text, banned_words)
    para_ok, para_findings = check_paragraph_breaks(text)

    lines = []
    lines.append("=" * 44)
    lines.append("守門員發文前檢查報告")
    lines.append("=" * 44)
    lines.append("")

    # (a) 罐頭句型
    if canned_ok:
        lines.append("✅ 高風險罐頭句型：沒抓到，這段文字讀起來不會太「AI 腔」。")
    else:
        lines.append(f"⚠️  高風險罐頭句型：抓到 {len(canned_findings)} 處")
        for idx, f in enumerate(canned_findings, 1):
            lines.append(f"   {idx}. 踩到句型「{f['type']}」")
            lines.append(f"      原句：「{f['snippet']}」")
            lines.append(f"      怎麼改：{f['advice']}")
    lines.append("")

    # (b) 字數上限
    if length_ok:
        lines.append(f"✅ 字數：{char_count} 字，在 Threads 500 字上限內。")
    else:
        over = char_count - THREADS_LIMIT
        lines.append(f"⚠️  字數：{char_count} 字，超過 Threads 500 字上限 {over} 字。")
        lines.append("      怎麼改：把次要資訊拆到留言串接續發、或直接刪減例子與重複的話。")
    lines.append("")

    # (c) 禁詞
    if not banned_words:
        lines.append("✅ 禁詞清單：目前沒有設定禁詞（預設空清單），略過此項。")
        lines.append(f"      要設定請複製 {BANNED_WORDS_EXAMPLE.name} 成 banned-words.json 並填自己的詞。")
    elif banned_ok:
        lines.append(f"✅ 禁詞清單：已對照 {len(banned_words)} 個設定詞，沒有踩到。")
    else:
        lines.append(f"⚠️  禁詞清單：踩到 {len(banned_findings)} 個禁用詞")
        for idx, f in enumerate(banned_findings, 1):
            lines.append(f"   {idx}. 禁用詞「{f['word']}」")
            lines.append(f"      前後文：...{f['context']}...")
            lines.append(f"      怎麼改：換成公司允許的替代說法，或直接刪掉這個詞。")
    lines.append("")

    # (d) 大段落
    if para_ok:
        lines.append("✅ 段落斷行：沒有連續超過 3 行的無斷行大段落，閱讀節奏可以。")
    else:
        lines.append(f"⚠️  段落斷行：抓到 {len(para_findings)} 處連續大段落")
        for idx, f in enumerate(para_findings, 1):
            lines.append(f"   {idx}. {f['line_range']}（連續 {f['line_count']} 行無斷行）")
            lines.append(f"      片段：「{f['snippet']}」")
            lines.append("      怎麼改：每 2-3 行加一個空行斷開，手機閱讀才不會變成一大塊灰色文字牆。")
    lines.append("")

    lines.append("-" * 44)
    all_ok = canned_ok and length_ok and banned_ok and para_ok
    if all_ok:
        lines.append("結論：四項都過，可以發了。")
    else:
        fail_count = sum(1 for ok in [canned_ok, length_ok, banned_ok, para_ok] if not ok)
        lines.append(f"結論：{fail_count} 項需要留意，建議照上面的建議調整後再發。")
    lines.append("=" * 44)

    return "\n".join(lines), all_ok


def main():
    parser = argparse.ArgumentParser(description="守門員發文前品質檢查")
    parser.add_argument("text", nargs="?", default=None, help="要檢查的文字（直接當參數傳入）")
    parser.add_argument("--file", "-f", default=None, help="從檔案讀取要檢查的文字")
    args = parser.parse_args()

    if args.file:
        text = Path(args.file).read_text(encoding="utf-8")
    elif args.text is not None:
        text = args.text
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        parser.print_help()
        sys.exit(1)

    report, all_ok = build_report(text)
    print(report)
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
