# 出題模板選擇策略（selectionPolicy）設計規格

日期：2026-07-10  
狀態：已核准設計；實作計畫見 `docs/superpowers/plans/2026-07-10-question-template-selection-policy.md`  
範圍：`src/features/questions/` 出題權重與模板選擇

---

## 1. 背景與目標

目前出題的模板與數字機率分散在 registry、generators、templates 與 append 邏輯中，難以統一調整。實際考試與心算訓練中：

- **分數運算遠多於純小數運算**，但現行出題容易過度抽到小數題。
- **中間結果為 0** 會讓後續步驟變簡單，削弱難度與練習價值。
- **難題**應偏向分數與冪次，而非大量整數或小數。
- **專項練習／弱項練習**應高度聚焦目標主題，而不是只做鬆散的標籤過濾。

本規格要建立集中式 `selectionPolicy`，作為出題權重的唯一來源，讓一般／mixed、專項、弱項在模板比例、小數上限、主題聚焦與非零步驟上行為一致、可測、可調。

**成功方向：**

1. 一般與 mixed 模式小數題約 10%，符合考試導向。
2. mixed 難題以難模板（分數、冪次、轉換、分數小數混合）為主，整數為輔。
3. 專項／弱項整題步驟約 70% 落在主題。
4. 計算步驟中間結果約 98% 不為 0。
5. **不改** `mentalCost` 公式與 difficulty cost range。

---

## 2. 決策摘要

### 2.1 選定做法：集中式 selectionPolicy（做法二）

新增 `selectionPolicy` 模組，作為模板／步驟選擇權重的**唯一來源**。`registry`、`generators/utils`、`appendStep`（以及任何挑模板或追加步驟的路徑）都讀同一份 policy，避免各處硬編碼權重漂移。

**不採用：**

- 在各 generator／template 內各自調機率（難維護、易不一致）。
- 另建獨立 decimals generator（超出本規格範圍）。

### 2.2 使用者已確認的澄清

| 議題 | 確認結果 |
|------|----------|
| 「小數模板」定義 | 僅 `decimal` 分類：純小數運算（加減乘、小數平方、小數複合等）。**不含**分數↔小數轉換、**不含**分數小數混合。 |
| 「難模板」定義 | `fraction` + `power` + `conversion` + `mixed-decimal-fraction`。 |
| Mixed 難模板合計目標 | `easy` 65%、`medium` 70%、`hard` 75%、`extreme` 80%；其餘多為整數。 |
| 小數上限 | 一般／mixed ~10%；`PracticeMode === "fractions"`（分數小數專項）~20%；`arithmetic` 專項小數硬排除（見模式硬排除）；弱項目標含 `decimals` 時走主題 70%，**不受** 10% 上限壓制。 |
| 專項／弱項聚焦 | 整題 `costTemplates` 步驟中，主題步驟占比 ~70%；允許同題同類步驟可控重複。 |
| 模式硬排除 | `arithmetic`（整數）：禁止分數、小數、次方、開方等；`fractions`（分數小數）：禁止次方、開方等。硬排除不可因重試耗盡而放寬。 |
| 與 cost 衝突 | 合法題 + cost in-range 最優先；重試耗盡可放寬比例，**不放寬** cost range 與模式硬排除。 |
| 非零 | 每個計算步驟的中間結果（`resultForTemplate`）~98% 不為 0；整題最終答案不另設硬性非零。 |
| 絕對值 | 教學意圖改為「絕對值是一種計算方式」，可依難度用更大數字範圍；非零仍以 reroll 為主。 |
| mentalCost | **不改**公式、**不放寬** difficulty cost range。 |

---

## 3. 架構

### 3.1 selectionPolicy 模組

建議位置：`src/features/questions/selectionPolicy.ts`（實作計畫可微調檔名，但必須是單一權威模組）。

職責：

- 定義模板分類 metadata 與查詢 API。
- 依 `PracticeMode`、`difficulty`、`targetTags` 等輸入，輸出選擇權重／配額／約束。
- 提供「小數上限是否生效」「主題步驟目標比例」「難模板目標比例」「模式硬排除」「非零接受率」等可測常數與函式。

**不負責：**

- 計算 `mentalCost`（仍由 `costModel`／`calculationTemplates`／`answerPath` 負責）。
- 決定 difficulty 的 cost range（仍由 `mentalCost.ts` 負責）。
- UI 文案（除非絕對值教學意圖需要極小文案調整，見範圍邊界）。

### 3.2 誰消費 policy

| 消費者 | 用途 |
|--------|------|
| `registry.ts` | 選題型／套用 type quota 軟上限時，讓位給 policy 的難模板／小數／主題權重。 |
| `generators/utils.ts` | 從模板池加權抽主模板；專項／弱項優先主題模板。 |
| `appendStep.ts` | cost 不足時追加步驟：優先同主題；套用同題同類可控重複上限。 |
| 模板／數字生成路徑 | 非零 reroll、絕對值數字範圍依 policy／難度參數。 |

所有權重決策以 policy 為準；消費者不得另寫一組衝突的硬編碼比例。

### 3.3 模板分類 metadata

每個出題模板（或可被選為主模板／步驟來源的單位）必須標註恰好一個主要分類：

| 分類 | 含義 | 計入「小數模板」？ | 計入「難模板」？ |
|------|------|-------------------|------------------|
| `integer` | 純整數運算 | 否 | 否 |
| `fraction` | 分數運算 | 否 | 是 |
| `decimal` | 純小數運算 | **是** | 否 |
| `power` | 冪次／根號等 | 否 | 是 |
| `conversion` | 分數↔小數轉換 | 否 | **是** |
| `mixed-decimal-fraction` | 分數與小數混合運算 | 否 | **是** |

**明確邊界：**

- 「小數模板」＝僅 `decimal`。
- `conversion` 與 `mixed-decimal-fraction` **不**受小數 ~10%／~20% 上限約束（它們不是「小數模板」），但**計入**難模板。
- 「難模板」＝`fraction` ∪ `power` ∪ `conversion` ∪ `mixed-decimal-fraction`；mixed 模式下的難模板合計目標計算這四類。

分類必須掛在模板 metadata 上，供 policy 與 Monte Carlo 統計使用，避免依 tag 字串猜測。

### 3.4 與現有 type quota 的關係

現有依 `QuestionType`（如 arithmetic／fractions／powers）的 session quota **降級為軟上限**：只防止單一題型極端壟斷，必須**讓位**給本規格的難模板合計、小數上限、主題 70% 等權重。當 soft quota 與 policy 目標衝突時，以 §7 優先序處理。

---

## 4. 機率規則

下列比例皆為**長期期望值**（大量出題的 Monte Carlo 目標），單次抽樣允許隨機波動；驗證用容差見測試計畫。

### 4.1 小數模板（僅 `decimal`）出現率

統計單位：以「主模板分類為 `decimal` 的題」占該情境生成題的比例為準（步驟級主題占比見 §4.3，兩者分開驗證）。

| 情境 | 目標占比 | 說明 |
|------|----------|------|
| `mixed`，以及允許小數的非分數專項（例如 `powers`） | ~10% | 考試導向：純小數少於分數；`powers` 專項仍受此小數上限 |
| `PracticeMode === "fractions"` | ~20% | 分數小數專項內允許略多純小數題 |
| `PracticeMode === "arithmetic"` | **0%（硬排除）** | 整數模式禁止小數（見 §4.4）；不套用 ~10% 小數配額 |
| `weakness-focused` 且 `targetTags` 含 `decimals` | 不套用 10% 上限 | 改走 §4.3 主題 ~70%（此時主題即 decimals，小數題／步驟會明顯高於 10%） |
| 其他 `weakness-focused`／專項（主題不是 decimals，且非 `arithmetic`） | 主題步驟 ~70% | 非主題的 ~30% 可含 `decimal`；若與一般小數上限衝突，依 §7：主題比例優先於小數上限 |

### 4.2 Mixed 模式：難模板合計

難模板＝`fraction` + `power` + `conversion` + `mixed-decimal-fraction`。

對應現有 `Difficulty = "easy" | "medium" | "hard" | "extreme"`：

| `difficulty` | 中文對照 | 難模板合計目標 | 其餘（多為 `integer`；可含 `decimal`） |
|--------------|----------|----------------|----------------------------------------|
| `easy` | 基礎 | 65% | ~35% |
| `medium` | 普通 | 70% | ~30% |
| `hard` | 挑戰 | 75% | ~25% |
| `extreme` | 極限 | 80% | ~20% |

本表僅適用 `mode === "mixed"`。長期不得把難模板合計拉低到明顯低於目標（以 soft 調整與重試達成）。

現有 type quota 必須讓位給本表權重。

### 4.3 專項／弱項：主題步驟占比

| 規則 | 目標 |
|------|------|
| 整題 `costTemplates` 中，主題相關步驟占比 | ~70% |
| 非主題步驟 | ~30% |
| 主模板 | 優先選主題模板 |
| cost 不足需 append | 優先追加同主題步驟 |
| 同題同類步驟重複 | 允許可控重複（見 §5） |

「主題」由 `mode`／`targetTags` 決定（例如 fractions 專項、weakness 的 `decimals`／`absolute-value` 等）。步驟是否算主題，以該步驟對應模板分類／specialty tags 與目標的對應關係判定，規則需在 policy 內集中實作並單測。

主題 ~70% 僅在**未被 §4.4 硬排除**的模板池內計算；硬排除的分類永遠不得出現在主模板或任何步驟中。

### 4.4 模式硬排除（不可放寬）

下列為**硬約束**：主模板與整題所有步驟（含 `appendStep`）皆適用；重試耗盡也**不得**放寬。

| `PracticeMode` | 中文對照 | 禁止出現的操作／分類 | 允許的主要分類 |
|----------------|----------|----------------------|----------------|
| `arithmetic` | 整數 | 分數、小數、次方、開方等——即禁止 `fraction`、`decimal`、`power`、`conversion`、`mixed-decimal-fraction` | 僅 `integer` |
| `fractions` | 分數小數 | 次方、開方等——即禁止 `power` | `integer`、`fraction`、`decimal`、`conversion`、`mixed-decimal-fraction` |

說明：

- 「不會出現」指整題任何步驟都不得含被禁操作，不只是主模板。
- `fractions` 模式對應產品上的「分數小數」專項：可含分數與小數相關操作，但不可含冪次／根號。
- `mixed`／`powers`／`weakness-focused` 不套用本表的整數／分數小數硬排除；弱項若目標本身含冪次等，仍依主題規則，不受本表禁令。
- 與 §4.1／§4.3 的關係：硬排除優先於小數上限與主題比例；被禁分類的目標占比視為 0。

---

## 5. 組題與同主題重複

### 5.1 組題流程（概念）

1. 依 mode／difficulty／tags 向 `selectionPolicy` 取得權重與約束。
2. 加權選擇主模板（專項／弱項優先主題）。
3. 生成數字與步驟；套用非零約束（§6）。
4. 若 `mentalCost` 低於目標 range，經 `appendStep` 追加步驟：優先同主題。
5. 檢查 cost in-range、小數／難模板／主題比例等約束；失敗則重試（§7）。

### 5.2 同題同類可控重複

為達成主題 ~70% 且仍能墊高 cost，允許同一題內同類步驟可控重複：

- **「同類」定義：** 以步驟所對應模板的**運算族**判定（例如同分母加法、異分母減法、小數乘法各為一類），而非僅六大分類（`fraction` 下可有多個運算族）。
- **上限常數：** `MAX_SAME_KIND_EXTRA = 2`——同題、同一運算族在已出現 1 次後，最多再追加 **2** 次（該族合計最多 3 次）。超過則改選其他同主題運算族，或依 §7 處理。
- **優先：** 同主題但**不同運算族**，勝過完全相同運算的重複。
- **目的：** 避免為了湊 cost 而跳出主題，或為了不重複而無法達標。

---

## 6. 非零步驟與絕對值教學意圖

### 6.1 非零步驟約束

- **約束對象：** 每個計算步驟的中間結果（`resultForTemplate` 或等價欄位）約 **98%** 不為 0。
- **非整題最終答案：** 不另設「最終答案不得為 0」的硬性規則（最終答案可為 0，只要步驟中間結果政策已套用）。

### 6.2 失敗與接受順序

當某次抽樣產生中間結果為 0：

1. **優先：** 同模板內 reroll 數字（保留模板，重抽操作數）。
2. 若仍反覆得到 0：以約 **2%** 機率**接受**該零結果；其餘情況改抽其他模板（或放棄本次候選並重試整題生成）。

長期統計上，步驟中間結果為 0 的比例應接近 ~2%（互補於 ~98% 非零）。

### 6.3 絕對值

- **教學意圖：** 絕對值是一種**計算方式**（求絕對值並繼續運算），而非僅認識 `|·|` 符號。
- **數字範圍：** 可依 difficulty 使用更大範圍（含兩位數），以支撐計算練習而非符號辨識。
- **非零：** 仍以同模板 reroll 為主；放寬數字 bucket／範圍為輔助手段，不得靠放寬 cost range 解決。

若需讓使用者理解意圖，允許**極小** UI／技巧文案調整；不做大改版。

---

## 7. 衝突優先序與 fallback

當「合法題 + cost in-range」「主題／難度比例」「小數上限」無法同時滿足時，依下列優先序：

0. **模式硬排除**（§4.4；永遠生效，不參與放寬）。
1. **合法題，且 `mentalCost` 落在該 difficulty 的 cost range 內**（不可放寬 range）。
2. **主題比例／難模板比例**（專項 70%、mixed 難模板合計等）。
3. **小數上限**（一般／mixed ~10% 等；`arithmetic` 的小數禁令屬第 0 項，非本項）。

**重試策略：**

- 在既有 registry 重試預算內，依權重重抽模板／數字／append；抽樣池須先套用 §4.4 硬排除。
- **重試耗盡：** 可依序放寬第 3 項、再放寬第 2 項的嚴格度（例如暫時允許偏離目標比例），以產出合法且 cost in-range 的題。
- **永不放寬：** 模式硬排除（§4.4）、`mentalCost` 的 difficulty cost range，以及「題目必須合法可答」的約束。

---

## 8. 風險與緩解

| 風險 | 說明 | 緩解 |
|------|------|------|
| cost 打架 | 主題／難模板／非零約束使 in-range 題變少 | 明確優先序；重試耗盡只放寬比例不放寬 range；同主題可控重複墊高 cost |
| 步驟 70% 難控 | 多步驟題 append 後主題占比漂移 | append 優先同主題；同類可控重複；Monte Carlo 驗證步驟級占比 |
| 分類邊界 | 轉換／混合被誤算進小數上限 | metadata 明確六類；小數僅 `decimal`；單測分類查詢 |
| 模式硬排除被軟化 | 重試耗盡時誤放行分數／冪次進整數模式 | 硬排除列為永不放寬；抽樣池預先過濾；單測＋Monte Carlo 驗證零出現 |
| quota 衝突 | 舊 type quota 與新權重互搶 | quota 改軟上限並讓位給 policy；衝突走 §7 |
| 弱項從硬篩到機率 | 既有 weakness 偏硬過濾，改 70% 機率後行為改變 | 文件化；回歸 registry 弱項測試；decimals 弱項不受 10% 壓制 |
| 抽象層成本 | 多一層 policy 增加間接性 | 單一模組、薄 API；消費者只讀 policy，禁止散落魔術數字 |

---

## 9. 範圍邊界

### 做

- 新增並接入 `selectionPolicy`（權重唯一來源）。
- 為模板補齊分類 metadata（`integer`／`fraction`／`decimal`／`power`／`conversion`／`mixed-decimal-fraction`）。
- 實作 §4–§7 的機率、模式硬排除、組題、非零、絕對值數字範圍與衝突優先序。
- 調整 type quota 為軟上限並讓位給 policy。
- 單元測試與 Monte Carlo 驗證；回歸既有出題／cost 測試。
- 絕對值教學意圖所需的**極小**文案調整（若有必要）。

### 不做

- 修改 `mentalCost` 計算公式或 chunk 常數。
- 放寬或重訂 difficulty 的 cost range。
- 新增獨立 decimals generator。
- 大改 Practice UI／視覺設計。
- 改動與本策略無關的 WIP（例如未核准的 costModel／powers 實驗變更不在本規格實作範圍內一併混入，除非實作計畫另行核准）。

---

## 10. 測試計畫

### 10.1 單元測試（policy）

- 分類 metadata：小數僅 `decimal`；難模板為 `fraction`+`power`+`conversion`+`mixed-decimal-fraction`。
- 各情境權重：`mixed`／`powers` 小數 ~10%、`fractions` 專項小數 ~20%、`arithmetic` 小數 0%（硬排除）、弱項 `decimals` 不受 10% 壓制。
- Mixed 各 `difficulty` 難模板合計目標（easy 65／medium 70／hard 75／extreme 80）。
- 專項／弱項主題步驟目標 ~70%。
- 模式硬排除：`arithmetic` 禁止 `fraction`／`decimal`／`power`／`conversion`／`mixed-decimal-fraction`；`fractions` 禁止 `power`；耗盡重試仍不放寬。
- `MAX_SAME_KIND_EXTRA = 2` 行為。
- 非零接受率參數（~98%／~2%）與 fallback 順序介面。
- 衝突優先序：模擬耗盡重試時放寬比例、不放寬 cost range 與模式硬排除。

### 10.2 Monte Carlo 驗證

對大量生成題（建議每情境 ≥1000 題，容差依現有 registry 測試風格設定，例如相對或絕對百分比帶）：

| 指標 | 期望 |
|------|------|
| `mixed`（及 `powers` 等允許小數的非 fractions 專項）小數主模板占比 | ~10% |
| `fractions` 專項小數主模板占比 | ~20% |
| `arithmetic` 專項 | 主模板與步驟皆無分數／小數／次方／開方（硬排除，出現率 0） |
| `fractions` 專項 | 主模板與步驟皆無次方／開方（硬排除，出現率 0） |
| `mixed` × 各難度難模板合計 | easy 65%／medium 70%／hard 75%／extreme 80% |
| 專項／弱項主題步驟占比 | ~70% |
| 步驟中間結果為 0 的占比 | ~2% |
| 弱項 `decimals` | 主題高聚焦，且不被 10% 小數上限壓制 |

### 10.3 回歸

- 既有 `registry.test.ts`、`mentalCost.test.ts`、generators／templates 相關測試維持通過。
- 弱項不因改機率而大量退回無關整數題（尤其 `decimals`、`absolute-value` 等既有案例）。
- cost in-range 分佈仍符合現行 `mentalCost.ts` range（本規格不改 range）。

---

## 11. 成功標準

1. 出題權重只來自 `selectionPolicy`；registry／generators／append 無衝突硬編碼比例。
2. 模板皆有明確分類；「小數」「難模板」定義與 §3.3 一致。
3. Monte Carlo 達到 §10.2 的占比目標（在約定容差內）。
4. 專項／弱項步驟級主題聚焦 ~70%，且同主題可控重複可墊高 cost。
5. 步驟中間結果非零 ~98%；零結果處理順序為 reroll → 少數接受 → 換模板。
6. 絕對值題依難度可用更大數字範圍，體現「計算方式」意圖。
7. **未**修改 mentalCost 公式與 cost range；既有 cost 回歸通過。
8. 衝突時永遠優先合法題 + cost in-range；耗盡只放寬比例；模式硬排除永不放寬。
9. `arithmetic` 模式不出分數／小數／次方／開方；`fractions` 模式不出次方／開方。

---

## 12. 實作備註（給後續 writing-plans）

- 先加 metadata 與 policy 模組及單測，再接 generators／append／registry，最後跑 Monte Carlo。
- 對齊現有 `Difficulty` 與 `PracticeMode` 名稱，避免文件與程式列舉不一致。
- 變更集應聚焦本規格；勿夾帶無關 WIP。
- 實作計畫：`docs/superpowers/plans/2026-07-10-question-template-selection-policy.md`
