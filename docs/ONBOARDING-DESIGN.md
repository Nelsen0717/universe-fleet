# 「裝備發放」課前引導遊戲 — 設計規格 v1

**這是什麼**：學員版的**真實**課前引導網頁遊戲（`onboarding/index.html`）——玩完、環境真的裝好了。
**跟 proposal/demo.html 的區別（context 分清楚）**：demo 是給經紀方看「結果長什麼樣」的模擬展示；本頁是給學員用的真工具、每個按鈕都觸發真實動作。本頁住在 plugin 倉庫、屬於產品。

## 核心機制：三種「真動作」

1. **寶藏鍵 = 真下載**：按「收下」→ `window.open` 官方下載/註冊頁（🔴 僅限官方網域白名單：claude.com / claude.ai / openai.com / chatgpt.com / nodejs.org / developers.facebook.com；**建置時必須用 WebSearch/WebFetch 實查每個官方連結現況**、不憑印象寫、查不到就連到該官方首頁並註明「搜『下載』」）
2. **複製鍵 = 真指令進剪貼簿**：`navigator.clipboard`（失敗備援：彈出可全選的文字框）＋圖解「貼到哪裡」
3. **通關碼 = 真驗證**：最後一關、學員複製「教練、報到」貼進 Claude Code → 教練（coach skill）跑環境自檢、通過後告訴學員通關碼**「首航準備完成」** → 學員回本頁輸入、解鎖「裝備完成證書」。網頁無法偵測本機安裝、但教練可以——這是真閉環、不是自欺勾選。

## 章節（第一章必做、第二章課前完成）

**序幕**：教練登場（`assets/` 艦員圖、從 proposal 資產複製進倉庫）、一句話：「開課那天、你要帶著自己的艦來。現在我們去領裝備。」輸入名字（沿用個人化）。

**第一章｜領艦（約 30-45 分、五個寶藏）**
1. 🚢 主艦「Claude Code」：先選平台（Mac／Windows 分頁、內容各自寫）→ 收下 → 官方下載頁 → 裝好後自答清單（「打開後看得到輸入框嗎？」「登入了嗎？」附帳號註冊指引與方案說明一行——照官方現況寫、不誇大）
2. 🛠️ 副艦「Codex」：ChatGPT 帳號＋Codex 取得（官方頁、實查現況）→ 自答清單
3. ⛽ 燃料「Node.js LTS」：標「選配寶藏」——建置時實查 plugin 安裝是否需要它、需要才列必做、不需要就明寫「教練說需要時再回來拿」
4. 🧲 艦隊入列：複製鍵①「/plugin marketplace add Nelsen0717/universe-fleet」→ 圖解貼進 Claude Code 輸入列 → 複製鍵②「/plugin install universe-fleet@universe-fleet-marketplace」→ 自答「看到艦隊安裝成功訊息了嗎」
5. 🎖️ 教練報到（真驗證關）：複製「教練、報到」→ 貼進 Claude Code → 教練自檢 → 拿通關碼回來輸入 →「裝備完成證書」（含學員名字＋日期）＋預告：「開課見、艦長。」

**第二章｜船籍登記（Meta 開發者、對應接入精靈前兩關）**：官方 developers.facebook.com 註冊＋建 App、步驟與 `skills/threads-setup/SKILL.md` 前兩關一致（引用它、不要兩處各寫一套）、完成自答＋「審核等待期」說明。

## 橫貫機制

進度 localStorage（`fleetOnboarding.v1`）、寶藏徽章列、每關「卡住了？」摺疊自救表（最常見 3 錯誤＋一句解法＋「截圖傳給助教」出口）、手機可讀但明示「請在電腦上完成」（Claude Code 在電腦上）。

## 配套改動（同倉庫、一起交）

- `skills/coach/SKILL.md` 加「報到」行為：使用者說「教練、報到」→ 依序自檢（plugin 裝好了嗎／能列出艦員嗎）→ 全過就說：「自檢通過。你的通關碼是：**首航準備完成**。回到裝備發放頁輸入它、領你的證書。」→ 有缺就白話指路缺哪個寶藏
- `README.md` 加「課前裝備發放」一節連到 `onboarding/index.html`

## 視覺

沿用艦隊語彙（白底、墨線、#8a4a2a、等寬元資料）；艦員圖放 `onboarding/assets/`；禁：漸層、卡片陰影、emoji 當 UI 裝飾（寶藏名前的符號屬內容、可用）。

## 驗收

- 外部連結**只有**白名單官方網域、全部 `target="_blank" rel="noopener"`、每條都經 WebSearch/WebFetch 實查後寫入（回報時列出每條與查證來源）
- 兩顆複製鍵真的寫入剪貼簿（附備援）、通關碼輸入「首航準備完成」→ 解鎖證書、錯字給溫和提示
- coach SKILL.md 含報到與通關碼；README 有入口
- localStorage 續關；`node --check` 過；單檔 < 200KB（不含圖）
- git 提交（訊息繁中）＋推送（身分沿用倉庫既有設定）
