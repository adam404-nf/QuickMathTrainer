# 07 Frontend Architecture

## 定位

本前端架構服務於 Flashcard 式數學運算速度訓練平台。目標是讓單人開發能快速推進，也讓 Cursor 協作時能清楚理解每個模組的責任。

架構重點：

- 以 Flashcard 練習流程為中心。
- 題目生成、練習流程、統計紀錄與 UI 分離。
- 前端優先，MVP 不依賴後端。
- 可長期擴展，但避免企業級架構與過早抽象。

## 資料夾結構

```text
src/
  app/
    routes/
    App.tsx
    providers.tsx
  features/
    practice/
      components/
      hooks/
      session.ts
      types.ts
    questions/
      generators/
      templates.ts
      constraints.ts
      registry.ts
      types.ts
      utils.ts
    results/
      summary.ts
      history.ts
      types.ts
    settings/
      preferences.ts
      types.ts
  shared/
    components/
    hooks/
    utils/
    storage/
      localStorageAdapter.ts
  styles/
  main.tsx
```

## 模組責任

### `app`

負責應用入口、路由與頁面組裝。

- `routes/` 放頁面級組合，例如練習頁、結果頁、設定頁。
- `App.tsx` 掛載路由與整體 layout。
- `providers.tsx` 集中管理全域 provider。

這層只做組裝，不放題目規則、作答判斷或統計邏輯。

### `features/practice`

負責一次練習回合的核心流程。

- 管理目前題目、題序、作答輸入、提交狀態與反饋狀態。
- 管理每題計時與回合結束條件。
- 呼叫 `features/questions` 取得下一題。
- 呼叫 `features/results` 記錄作答並產生本輪統計。
- 放與練習流程高度相關的 UI，例如題卡、答案輸入、反饋區與下一題操作。

### `features/questions`

負責題目模型、題目生成與題型註冊。

- `types.ts` 定義 `Question`、題型、答案格式、難度、標籤與 `mentalCost`。
- `generators/` 放各題型生成器，例如四則、分數、小數、冪次、對數、三角函數、排列組合、概率。
- `templates.ts` 定義題目形式，例如接近整十數乘法、平方差、特殊角三角函數、基本對數與排列組合公式。
- `constraints.ts` 檢查題目品質，例如可心算性、是否太簡單、是否超出 mental cost、是否近期重複。
- `registry.ts` 作為題型入口，讓 practice 不需要知道每個生成器細節。
- `utils.ts` 放純函式工具，例如亂數、答案正規化與避免重複題目。

這層不依賴 React，不處理 UI，方便測試與擴展。

### `features/results`

負責作答紀錄、回合統計、錯題與歷史資料。

- 計算本輪題數、正確率、平均用時與錯題列表。
- 將練習回合轉成可保存的歷史紀錄。
- 提供錯題重練與進步追蹤的資料來源。
- 實際儲存動作交給 `shared/storage`。

### `features/settings`

負責使用者偏好與練習選項。

- 保存預設模式、題數、難度、常用題型組合與輸入偏好。
- 未來可加入是否只練錯題、是否顯示計時、挑戰模式設定。
- 只定義產品層設定，不直接操作瀏覽器 API。

### `shared`

放跨功能可重用，但不承載產品決策的基礎能力。

- `components/` 放通用 Button、Card、Input、Modal 等。
- `hooks/` 放通用 React hooks，例如鍵盤快捷鍵與視窗尺寸。
- `utils/` 放格式化時間、數字工具與日期工具。
- `storage/` 封裝 `localStorage`，未來可替換為 IndexedDB 或雲端同步。

判斷標準：如果它知道「數學練習」的業務含義，就不應放在 `shared`。

## 題目生成設計

題目生成採用「受控隨機」，不是直接隨機丟數字。每個 generator 先選擇合適模板，再產生候選題目，最後由 constraints 檢查品質。

```text
Practice Session 要下一題
→ Question Registry 選題型
→ Generator 選模板
→ Template 產生候選題目
→ Constraints 檢查 mentalCost / difficulty / 重複度
→ 通過後回傳 Question
→ Practice 顯示題卡
```

每題建議保留 metadata：

```text
type：題型，例如 multiplication、logarithm、trigonometry
difficulty：easy / medium / hard
tags：章節、技巧、能力點
mentalCost：1–5，代表心算成本
strategy：預期使用的心算方法
```

`mentalCost` 定義：

```text
1 = 秒答
2 = 一步心算
3 = 兩步心算
4 = 多步但仍可不用紙筆
5 = 挑戰型心算
```

普通練習主要控制在 `1–3`，進階練習控制在 `2–4`，挑戰模式才使用 `3–5`。

MVP 建議每個核心題型先有 `3–5` 個高品質模板；整體約 `15–25` 個模板即可支撐第一版練習流程。後續再依重複感與使用者表現擴到每個題型 `6–10` 個模板。

## 未來擴展

### Timer

Timer 先放在 `features/practice`，因為計時是練習回合的一部分。

- MVP：每題開始時記錄時間，提交時產生 `timeMs`。
- 限時挑戰：在 session 層增加倒數狀態。
- 統計：由 `features/results` 使用 attempts 的 `timeMs` 計算平均用時與速度趨勢。

### Difficulty

Difficulty 放在 `features/questions` 的題目生成參數與題目 metadata。

- `Question` 保留 `difficulty` 欄位。
- 每個 generator 自己解讀難度，例如數字範圍、步驟數、是否含分數或根號。
- `settings` 保存使用者預設難度。
- `practice` 只傳入難度設定，不知道每種題型的難度細節。

### Progress Tracking

Progress Tracking 以 `features/results` 為核心，先從 session history 演進。

- MVP：保存最近練習紀錄與本輪 summary。
- P1：依題型、難度、tags 聚合正確率與平均用時。
- P2：新增進步曲線頁面，但資料仍由 `results/history.ts` 提供。
- 若 `localStorage` 不夠，再替換 `shared/storage` 為 IndexedDB 或後端同步。

### 自訂題型

自訂題型以 `features/questions/generators` 與 `registry.ts` 擴展。

- 每個題型是一個 generator，輸入模式、難度與已出題紀錄，輸出標準 `Question`。
- `registry.ts` 集中註冊題型，讓模式選擇可以根據 registry 顯示可用題型。
- 對數、三角函數、排列組合、概率都可作為獨立 generator，並用 `tags` 標記章節與能力點。
- MVP 不需要外掛系統，只需要穩定的 generator 介面與 registry。

## 控制複雜度

- 不新增 Redux、狀態機框架或企業級分層，除非練習流程明顯變複雜。
- 不預先做後端 repository pattern，只用 `storageAdapter` 保留替換點。
- 不把所有型別集中到全域 `types/`，型別放在最接近使用它的 feature。
- 不讓 UI 元件直接生成題目或計算統計。
- 不把所有工具都丟進 `shared`。
