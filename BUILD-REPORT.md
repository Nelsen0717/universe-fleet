# 建置報告 —— 宇宙艦隊 plugin POC 骨架

**日期**：2026-07-04
**目標**：7/7 前可對外 demo 的 POC，依 `~/Brain/ventures/personal-brand/plugin-product-plan.md` 第三、四、六節建置。

## 建了哪些檔

```
~/Projects/universe-fleet/
├── .git/                                          （git init，1 次 commit + 1 次補 gitignore commit）
├── .gitignore
├── .claude-plugin/
│   ├── plugin.json                                （plugin manifest：name/description/version/author...）
│   └── marketplace.json                           （自架 marketplace，本地 source: "./"）
├── README.md                                       （繁中快速開始、艦員名冊、三條艦隊守則）
├── BUILD-REPORT.md                                 （本檔）
└── skills/
    ├── coach/
    │   └── SKILL.md                                （教練：團隊介紹、五關進度自查、卡關自救表）
    ├── brand-guard/
    │   ├── SKILL.md                                （守門員：怎麼跑檢查、怎麼跟使用者講結果）
    │   ├── scripts/check.py                        （真的能跑的四項檢查程式）
    │   └── config/banned-words.example.json        （禁詞清單範例配置）
    ├── ghostwriter/
    │   └── SKILL.md                                （寫手 lite：語氣萃取四步驟 + 四種開場錨點 + 自動呼叫守門員）
    └── threads-setup/
        └── SKILL.md                                （接入精靈：五關遊戲化文件、含 Meta 後台欄位層級步驟）
```

## 驗收指令實際 stdout

### 1. 結構一覽

```
$ find ~/Projects/universe-fleet -type f -not -path "*/.git/*" | sort
/Users/nelsen/Projects/universe-fleet/.claude-plugin/marketplace.json
/Users/nelsen/Projects/universe-fleet/.claude-plugin/plugin.json
/Users/nelsen/Projects/universe-fleet/.gitignore
/Users/nelsen/Projects/universe-fleet/README.md
/Users/nelsen/Projects/universe-fleet/skills/brand-guard/SKILL.md
/Users/nelsen/Projects/universe-fleet/skills/brand-guard/config/banned-words.example.json
/Users/nelsen/Projects/universe-fleet/skills/brand-guard/scripts/check.py
/Users/nelsen/Projects/universe-fleet/skills/coach/SKILL.md
/Users/nelsen/Projects/universe-fleet/skills/ghostwriter/SKILL.md
/Users/nelsen/Projects/universe-fleet/skills/threads-setup/SKILL.md
```

（原始 `find` 沒加 `-not -path` 時會混進 `.git/` 內部物件檔案，這裡排除掉只看有意義的檔案。）

### 2. check.py 偵測高風險句型

```
$ echo "我覺得你不是不會用 AI，而是還沒找到方法。先不要急著學工具，先想清楚目標。" | python3 ~/Projects/universe-fleet/skills/brand-guard/scripts/check.py

============================================
守門員發文前檢查報告
============================================

⚠️  高風險罐頭句型：抓到 2 處
   1. 踩到句型「不是A而是B」
      原句：「不是不會用 AI，而是還沒找到方法。先不要急著學工具，先想清楚」
      怎麼改：這種「否定前半、肯定後半」的對比句是很典型的 AI 腔，讀者一眼就認得出來。試著直接講你要講的那句就好，不用先繞一個「不是」。
   2. 踩到句型「先不要A先B」
      原句：「先不要急著學工具，先想清楚目標。」
      怎麼改：「先不要 A、先 B」這種先抑後揚的句型太罐頭了。直接講「先 B」就好，不需要鋪陳一個要被否定的 A。

✅ 字數：39 字，在 Threads 500 字上限內。

✅ 禁詞清單：目前沒有設定禁詞（預設空清單），略過此項。
      要設定請複製 banned-words.example.json 成 banned-words.json 並填自己的詞。

✅ 段落斷行：沒有連續超過 3 行的無斷行大段落，閱讀節奏可以。

--------------------------------------------
結論：1 項需要留意，建議照上面的建議調整後再發。
============================================
```

正確偵測出 2 個高風險句型（「不是 A 而是 B」「先不要 A 先 B」），並附上具體修改建議。exit code 為 1（非零）是設計行為——有 ⚠️ 項目時程式刻意回傳非零，方便未來接自動化管線判斷「能不能發」。

額外測試（沒有寫進硬性驗收條件、但實作時已驗證）：
- 字數超標（511 字）→ 正確標示超過上限 11 字
- 段落斷行（連續 4 行無空行）→ 正確抓到並標示行號範圍
- 禁詞（設定「限時優惠」後測試）→ 正確抓到踩到的詞與前後文

### 3. git log

```
$ cd ~/Projects/universe-fleet && git log --oneline
52dedba 補 .gitignore
d74808a 宇宙艦隊 plugin POC 骨架初版
```

### 額外驗證：官方指令確認 marketplace 格式真的合法

```
$ claude plugin validate ~/Projects/universe-fleet
Validating marketplace manifest: /Users/nelsen/Projects/universe-fleet/.claude-plugin/marketplace.json

✔ Validation passed
```

這比原本要求的驗收條件更進一步——用 Claude Code 本體（v2.1.150）的官方驗證指令實測，證明 `marketplace.json` 是真的能被官方工具認得的格式，不是憑猜測拼湊。

## 官方 plugin 格式關鍵要求（查到什麼）

來源：
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugin-marketplaces

一句話：plugin 的身分證是 `.claude-plugin/plugin.json`（`name`/`description`/`version` 必要），marketplace 的目錄是 `.claude-plugin/marketplace.json`（`name`/`owner`/`plugins[]`，每個 plugin entry 至少要 `name` + `source`，本地路徑用 `"./相對路徑"`），skills 預設從 plugin 根目錄下的 `skills/<name>/SKILL.md` 載入、不用額外宣告。本機測試指令是 `claude plugin marketplace add ./my-marketplace`。

## 沒做到的部分（明說＋原因）

1. **接入精靈是文件版、不是自動化版**——SKILL.md 裡的五關都是「教使用者自己在瀏覽器操作」的步驟指引，沒有真的呼叫 Threads API、沒有自動填表、沒有 OAuth 程式碼。原因：規格明確寫「文件版 POC」，且 Threads API 需要真實 Meta 開發者帳號、App 審核，POC 時間內無法申請一輪真實憑證來跑通端到端，也不應該把測試用假憑證混進公開骨架。MVP 階段（規劃書時程「7 月中」）才會做瀏覽器自動化或 API 串接。
2. **`.codex-plugin/` 等其他 host 殼**——規劃書第六節提到「一份 skill 邏輯、多殼 manifest」是後續路線，POC 階段只做官方 `.claude-plugin/`，符合規格所述「後續」時程，沒有超做。
3. **寫手 lite 沒有實際跑過一次真人 3 段文字的萃取 demo**——SKILL.md 教流程教得很完整，但這次沒有真人樣本可餵，所以沒有產出一份實際的 `voice-profile.md` 範例檔。之後 demo 前建議拿 Nelsen 自己的舊文真的跑一次。
4. **沒有申請或連結真實的 Meta 開發者帳號**——接入精靈文件裡的欄位、流程是查證官方文件寫的，但沒有實測「照著這份文件走一遍能不能真的申請成功」，因為需要真實建立一個 Meta App（有跨到 Nelsen 本人帳號授權的風險，超出這次「只動 universe-fleet 目錄」的邊界）。建議 demo 前找一次時間真人跑一輪核對。

## 結論

四個 skill、manifest、README、git 都建好且驗證通過，`check.py` 是真的能跑、被三種輸入方式（stdin／位置參數／`--file`）測過的程式，marketplace.json 通過官方 `claude plugin validate`。唯一保留的缺口是「接入精靈只到文件層級、還沒有真實跑通一次 Meta 申請」，這是規格本身要求的 POC 邊界、不是遺漏。沒有碰 `~/NelsenClaw/`、`~/ai-curator-tw/`、`~/Brain/`（除了唯讀規劃書），沒有建遠端、沒有推送，沒有放任何金鑰。
