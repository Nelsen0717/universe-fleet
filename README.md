# 我的宇宙艦隊（universe-fleet）

給不會寫程式的創作者用的 AI 宇宙艦隊——裝了就會動，繁體中文優先。

課程教你當艦長，這支 plugin 就是你的艦員。

## 線上入口

- 提案站：https://universe-fleet-proposal.vercel.app
- 艦橋：https://nelsen0717.github.io/universe-fleet/game/
- 裝備發放：https://nelsen0717.github.io/universe-fleet/onboarding/

## 安裝（桌面版 Claude Code、不用打指令）

桌面版 Claude Code 的聊天視窗**不吃 `/plugin` 指令**——所以用「拖資料夾」裝，全程不碰終端機：

1. 下載艦隊 zip：https://nelsen0717.github.io/universe-fleet/dist/universe-fleet-skills.zip ，在下載資料夾裡解壓縮
2. 打開 Finder，按 `Cmd+Shift+G`，貼上 `~/.claude/skills` 按 Enter
3. 把解壓出來的五個艦員資料夾（`coach`、`navigator`、`ghostwriter`、`brand-guard`、`threads-setup`）全選、一起拖進去
4. 完全關掉 Claude Code 再重開——它會自動掃 `~/.claude/skills`、認得艦隊

裝完之後，跟教練打聲招呼：「教練、報到」——它會帶你認識整支團隊。

<details>
<summary>進階：終端機版 Claude Code 的指令安裝</summary>

如果你用的是**終端機版（CLI）**的 Claude Code，可以改用 plugin 指令：

```
/plugin marketplace add Nelsen0717/universe-fleet
/plugin install universe-fleet@universe-fleet-marketplace
```

⚠️ 這兩個指令**只在終端機版有效**；桌面版聊天視窗打了會回「不認得這個指令」，桌面版請用上面的拖資料夾法。
</details>

## 課前裝備發放

第一次接觸這支艦隊、還沒裝任何東西？打開 `onboarding/index.html`（用瀏覽器直接開這個檔案），跟著「裝備發放」引導遊戲走一輪——每個按鈕都是真動作：真下載官方安裝頁與艦隊 zip、真複製存放路徑進剪貼簿，最後跟教練說「教練、報到」讓它真的驗證你的環境，拿到通關碼解鎖證書。玩完這頁，環境就真的裝好了，不是勾格子假裝完成。

## 艦員名冊

| 艦員 | 綽號 | 做什麼 | 收費 |
|---|---|---|---|
| 🎓 coach | 教練 | 新手引導、進度自查、卡關自救 | 免費 |
| 🛡️ brand-guard | 守門員 | 發文前檢查：AI 腔句型、字數、禁詞、大段落 | 免費 |
| ✍️ ghostwriter | 寫手（lite） | 學你的語氣、生貼文草稿 | 免費（完整版另計） |
| 🧭 threads-setup | 接入精靈 | 把 Threads 帳號接上這支團隊，五關遊戲化引導 | 免費（文件版 POC） |

免費不是行銷噱頭，是刻意設計：先讓你確定這家真的管品質、真的有用，再談要不要用付費的完整艦員陣容。

## 這支團隊的三條艦隊守則

1. **發佈鍵永遠在人手上**——任何艦員都只會準備草稿、跑檢查、給建議，沒有人能替你按下「發送」。
2. **每個動作都留痕**——語氣檔案、檢查報告、草稿，全部留檔案在你自己的電腦上，不會憑空消失、也不會事後查不到。
3. **你的鑰匙不離開你的電腦**——Threads 的帳號憑證只存在本機、檔案權限鎖死，不經過任何第三方伺服器。

## 現在是 POC 階段

這是搶在 2026/7/7 前完成的骨架版本，用來對外 demo。目前狀態：

- 教練、守門員：可以直接用
- 守門員的檢查程式（`check.py`）是真的能跑的 Python，不是紙上流程
- 寫手是 lite 版：語氣萃取 + 貼文生成可以用，進階自動化排程之後才有
- 接入精靈是**文件版**：五關的步驟、欄位、自救表都寫好了，但還不會自動幫你操作瀏覽器——目前是「地圖」不是「自動導航」

詳細建置紀錄看 `BUILD-REPORT.md`。

## 目錄結構

```text
.
├── README.md
├── docs/
│   ├── DATA-INTERFACE.md
│   ├── GAME-DESIGN-v2.md
│   └── ONBOARDING-DESIGN.md
├── game/
│   ├── index.html
│   ├── assets/
│   ├── css/
│   ├── data/
│   └── js/
├── onboarding/
├── skills/
└── universe-fleet-marketplace/
```
