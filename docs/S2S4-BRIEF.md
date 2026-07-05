# S2-S4 建置派工包（Codex、2026-07-05）

## 1. Outcome
把「艦橋」從垂直切片建成完整產品：玩家能完整經歷課前→課中→課後 30 天的體驗弧。讀者（試玩者）的感受標準：每名艦員都像活人、每天有理由回來、劇情追得下去。聖經：`docs/GAME-DESIGN-v2.md`（逐節照做、特別是第三節性格表、第五節黏著迴圈、第八節切片定義）。品質基準：S1 守門員對話樹（`game/data/dialogue-guard.json`）的語感——人話、有記憶、不中二。

## 2. Hard Invariants（必含）
**S2**：
- 四名艦員對話樹各 ≥20 節點（`dialogue-scout/writer/publisher/analyst.json`）、性格照設計第三節表（情報員話多好奇／寫手浪漫慢熱／發行官急性子／分析師冷靜冷笑話）、每人 ≥2 記憶旗標、選擇有後果
- 晨會場景：情報員主持、讀 `game/data/demo-briefing.json`（示範資料、畫面上**必標「示範資料」**）
- 檔案室：前任艦長日誌 10 頁（`game/data/archive-log.json`）、方法論故事化（他追過奇觀流量摔過船、學會共鳴、寫下守則——素材心法參考 `/Users/nelsen/Brain/ventures/ai-curator/upgrade-2026-07-03/TEXT-PLAYBOOK.md` 的四機制與地雷、但寫成劇情不寫成教材）、翻頁動畫、`archive-room.png` 實裝、解鎖條件照設計（連續登艦 3/7/14/30）
- 四艦員表情差分可用內建 image_gen 生成（風格照 `game/assets/` 既有、每張 single call、無後製、生成記錄寫 `game/assets/generation-log-s2.md`）
**S3**：
- 八模組主線任務鏈（`game/data/quests.json`＋任務板場景）、每任務完成觸發對應艦員劇情對話一段
- 首航 Boss：完成第一次「真實發佈」任務 → 全艦慶祝場景（五艦員同框道賀＋全屏粒子）
**S4**：
- 資料介面文件 `docs/DATA-INTERFACE.md`：遊戲讀哪些本地 JSON（晨會日報／週報／發文事件）、欄位規格、未來 plugin 怎麼寫入；遊戲端全部走「示範資料模式」且畫面明標
**README**：加「線上入口」節——提案站 https://universe-fleet-proposal.vercel.app ／艦橋 https://nelsen0717.github.io/universe-fleet/game/ ／裝備發放 https://nelsen0717.github.io/universe-fleet/onboarding/ ＋ 更新目錄結構含 game/

## 3. Hard Constraints
- 只動 `~/Projects/universe-fleet/`；無外部函式庫、無外部資源請求（`http://` 與非 github.io 的 `https://` 皆禁——README 的三條入口連結除外）
- 手機直式優先、`prefers-reduced-motion` 尊重、視覺語彙不變（白底墨線 #8a4a2a、禁漸層俗套、禁 emoji 當 UI）
- 黏著紅線：斷 streak 不懲罰不內疚（設計八之二）、解鎖劇情永不回鎖、XP 只綁真實產出型動作
- 每完成一個切片單獨 commit（繁中訊息、S2/S3/S4 分開）、每次 commit 前 `node --check` 全部 js；push 用倉庫既有身分

## 4. Out-of-Scope（不准動）
- S1 既有行為不得回歸破壞（守門員旗標、續檔、開場皆須通過回歸測試）
- 不碰 `onboarding/`、`skills/`、`.claude-plugin/`（除非 README）
- 不真的呼叫任何社群 API、不放任何金鑰

## 5. Verification（宣告完成的條件）
- 真瀏覽器通玩：五艦員對話各走兩分支＋旗標記憶生效、晨會、檔案室翻頁與解鎖、任務板、首航慶祝
- 回歸：S1 守門員三分支＋續檔仍過
- `grep -r 'http://' game/` = 0；`node --check` 全過
- 回報 ≤ 15 行：各切片交付清單、對話樹節點數統計、回歸結果、commit 雜湊列表、做不到的明說
