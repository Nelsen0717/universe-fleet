# S2 艦員表情差分生成紀錄

日期：2026-07-05
工具：內建 `image_gen`，每張 single call，無後製；生成後僅複製進 `game/assets/`。
風格依據：`docs/GAME-DESIGN-v2.md` 與 `game/assets/` 既有白底墨線、棕色墨線遊戲立繪。

## 檔案

- `scout-pleased.png`
  - 來源：`/Users/nelsen/.codex/generated_images/019f3273-3e12-77f3-83a7-12d08ee73e91/ig_0246cf93b6f5b799016a4a5b3d8f0c8191b1a856cfd71dba2d.png`
  - Prompt：好奇、話多、戴通訊耳機的情報員，高興表情；手繪墨線、白紙背景、#8a4a2a 棕色點綴，無文字、無 UI。
- `writer-pleased.png`
  - 來源：`/Users/nelsen/.codex/generated_images/019f3273-3e12-77f3-83a7-12d08ee73e91/ig_0246cf93b6f5b799016a4a5b7ad9b881918e50a6bf97a5c6d8.png`
  - Prompt：浪漫慢熱的寫手，害羞高興表情，拿筆記本或筆；手繪墨線、白紙背景、#8a4a2a 棕色點綴，無文字、無 UI。
- `publisher-pleased.png`
  - 來源：`/Users/nelsen/.codex/generated_images/019f3273-3e12-77f3-83a7-12d08ee73e91/ig_0246cf93b6f5b799016a4a5bbc68088191a02a5a4eca26c182.png`
  - Prompt：急性子、行動派發行官，興奮但專業的慶祝表情；手繪墨線、白紙背景、#8a4a2a 棕色點綴，無文字、無 UI。
- `analyst-pleased.png`
  - 來源：`/Users/nelsen/.codex/generated_images/019f3273-3e12-77f3-83a7-12d08ee73e91/ig_0246cf93b6f5b799016a4a5bf9b4508191868cfddf67ac09fb.png`
  - Prompt：冷靜分析師，克制微笑與冷笑話氣質；手繪墨線、白紙背景、#8a4a2a 棕色點綴，無文字、無 UI。

四張表情差分（scout/writer/publisher/analyst-pleased.png）因風格漂移於 2026-07-06 移除；四人一律固定用 `crew-*.png` 單圖，不再切換表情。守門員的 guard-neutral/guard-pleased 差分（同墨線風格）保留。
