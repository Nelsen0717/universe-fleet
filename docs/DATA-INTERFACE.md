# 艦橋資料介面

日期：2026-07-05
狀態：S4 示範資料模式

## 原則

艦橋目前全部讀本地 JSON，不呼叫社群 API、不讀金鑰、不向外部服務請求資料。畫面上凡是晨會、任務鏈、檔案室或資料驅動內容，都必須明標「示範資料」。未來 plugin 只負責把真實資料寫成本地 JSON；遊戲端仍只讀檔案。

## 遊戲目前讀取的 JSON

| 檔案 | 用途 | 目前模式 |
|---|---|---|
| `game/data/crew.json` | 五名艦員基本資料、立繪路徑、對話樹檔案 | 靜態設定 |
| `game/data/dialogue-guard.json` | 守門員對話與危機事件 | 靜態示範 |
| `game/data/dialogue-scout.json` | 情報員對話樹 | 靜態示範 |
| `game/data/dialogue-writer.json` | 寫手對話樹 | 靜態示範 |
| `game/data/dialogue-publisher.json` | 發行官對話樹 | 靜態示範 |
| `game/data/dialogue-analyst.json` | 分析師對話樹 | 靜態示範 |
| `game/data/tasks.json` | 今日任務與艦內設施清單 | 示範資料 |
| `game/data/demo-briefing.json` | 晨會日報 | 示範資料 |
| `game/data/archive-log.json` | 前任艦長日誌與解鎖條件 | 示範資料 |
| `game/data/quests.json` | 八模組主線任務鏈與完成劇情 | 示範資料 |

## 晨會日報格式

檔案：`game/data/demo-briefing.json`

欄位：

- `modeLabel`：固定顯示用標籤，目前為 `示範資料`。
- `date`：資料日期，格式 `YYYY-MM-DD`。
- `hostCrewId`：主持艦員 id，目前為 `scout`。
- `title`：晨會標題。
- `summary`：主持人摘要。
- `signals[]`：今日訊號清單。
- `signals[].id`：訊號 id。
- `signals[].label`：訊號分類。
- `signals[].value`：玩家應理解的資料內容。
- `signals[].crewNote`：情報員口吻的補充。
- `dailyTenMinuteTask`：每日 10 分鐘任務；目前不給 XP，正式版若綁真實產出才可給 XP。

未來 plugin 寫入規格：產生同結構 JSON，檔名可維持 `demo-briefing.json` 或由遊戲設定改指向 `briefing-current.json`。若資料來自真實日報，仍需保留 `modeLabel` 或等效標籤，讓畫面能明確標示資料來源狀態。

## 週報格式

S4 尚未接 UI，但預留 plugin 寫入格式：

```json
{
  "modeLabel": "示範資料",
  "weekStart": "2026-07-06",
  "weekEnd": "2026-07-12",
  "summary": "本週回聲摘要",
  "metrics": {
    "posts": 3,
    "externalComments": 8,
    "shares": 4,
    "savedQuotedLines": 2
  },
  "learning": [
    {
      "id": "weekly_learning_1",
      "signal": "現場錨留言率較高",
      "decision": "下週保留現場錨，但避免連續同型開場"
    }
  ]
}
```

建議落點：`game/data/weekly-report-current.json`。

## 發文事件格式

任務鏈的真實 XP 應由本地發文事件驅動，不由點擊驅動。預留格式：

```json
{
  "modeLabel": "示範資料",
  "events": [
    {
      "id": "publish_2026_07_05_001",
      "type": "published_post",
      "createdAt": "2026-07-05T21:00:00+08:00",
      "channel": "threads",
      "title": "貼文標題或內部代號",
      "sourceFile": "wip/posts/example.md",
      "xp": 100,
      "humanApproved": true
    }
  ]
}
```

允許的 `type`：

- `published_post`：完成真實發佈，允許給 XP。
- `reader_reply`：完成真實讀者回覆，允許給 XP。
- `weekly_review_read`：讀週報並寫下決策，允許給 XP。
- `draft_only`：草稿，不給 XP，除非課程明確定義為產出型作業。

建議落點：`game/data/post-events-current.json`。

## Plugin 寫入邊界

1. Plugin 只寫本地 JSON，不直接改遊戲程式。
2. Plugin 不呼叫遊戲內函式、不碰 localStorage。
3. Plugin 寫入前先輸出 dry-run 摘要，讓人確認資料來源與欄位。
4. 發佈鍵永遠在人手上；`humanApproved` 只能表示已人工確認，不代表 plugin 代發。
5. 遊戲端讀不到真實資料時，必須回到示範資料模式並明標。
