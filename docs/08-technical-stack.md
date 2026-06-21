# 08 Technical Stack

## MVP 決策

- Framework：React
- Language：TypeScript
- Build Tool：Vite
- Testing：Vitest + React Testing Library
- Styling：CSS Modules + global CSS
- State：React state + custom hooks
- Storage：localStorage adapter
- Routing：MVP 先用單頁組裝，等 Practice / Results / Settings 分頁需要獨立 URL 時再加入 React Router

## 選擇理由

這組技術棧符合 quickmathowo 的前端優先方向：啟動快、設定少、容易測試純函式邏輯，也不需要為 MVP 引入後端、Redux、狀態機或 full-stack framework。

TypeScript 用來保護 `Question`、`Attempt`、`Session` 與 `PracticePreferences` 等核心資料模型。Vitest 主要覆蓋 Question Engine、答案比對與 Result Tracker，避免題目生成與統計在後續擴題型時回歸。
