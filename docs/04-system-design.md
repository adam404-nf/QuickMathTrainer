# 04 System Design
## 架構方向
前端優先的單頁 Web App；MVP 不依賴後端，題目生成與練習狀態都在瀏覽器內完成。

詳細前端架構見 [07-frontend-architecture.md](./07-frontend-architecture.md)。

## 核心模組
- Question Engine：根據模式與難度生成題目、答案與解析資料。
- Practice Session：管理目前題目、作答狀態、計時、題序與結束條件。
- Result Tracker：計算正確率、平均用時、錯題與歷史紀錄。
- UI Components：題卡、輸入框、反饋區、統計面板、模式選擇。
- Storage Adapter：封裝 localStorage，未來可替換為雲端同步。

## 資料模型
- Question：id、type、prompt、answer、difficulty、tags、mentalCost、strategy。
- Attempt：questionId、userAnswer、isCorrect、timeMs、createdAt。
- Session：mode、startedAt、endedAt、attempts、summary。

## 題目生成原則
- 採用受控隨機：先選題型與模板，再生成候選題目，最後檢查可心算性、難度與重複度。
- 題目模板應訓練明確能力，例如平方差、特殊角、基本對數、排列組合公式或概率直覺。
- mentalCost 使用 1–5 表示心算成本；普通練習以 1–3 為主，進階與挑戰模式再提高。
- 對數、三角函數、排列組合、概率等題型應作為 Question Engine 的獨立 generator 擴展。

## 技術原則
- 題目生成邏輯與 UI 分離，方便測試與擴展。
- 優先支援鍵盤操作與行動瀏覽器；未來可加入後端、帳號、同步、排行榜。
