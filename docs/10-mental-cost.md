# 10 Mental Cost（心算成本）計算規格

> 本文件是 QuickMath Trainer 心算成本（`mentalCost`）的**唯一設計規格**。實作對應：
>
> - [`src/features/questions/costModel.ts`](../src/features/questions/costModel.ts) — Atomic、IntegerChunk、FractionChunk 與壓縮常數
> - [`src/features/questions/calculationTemplates.ts`](../src/features/questions/calculationTemplates.ts) — 題目模板到 cost tree 的適配層（含小數／換算 chunk）
> - [`src/features/questions/answerPath.ts`](../src/features/questions/answerPath.ts) — 答案形式判定與分數／小數雙路徑 cost
> - [`src/features/questions/mentalCost.ts`](../src/features/questions/mentalCost.ts) — 難度加權選題分佈（raw cost range）
> - [`src/features/questions/templates.ts`](../src/features/questions/templates.ts) — 題目模板
> - [`src/features/questions/registry.ts`](../src/features/questions/registry.ts) — 依 cost range 重試生成

---

## 1. 核心原則

### 1.1 Intrinsic（題目固有）

同一道題的 `mentalCost` **只由題目內容決定**，與 UI 上的 `difficulty` 無關。

`difficulty` 只負責抽題時的 **cost range 分佈**，不會因模式標籤直接加價。

### 1.2 分數尺度

`mentalCost` 為 **raw cost（可為小數）**，不再限制在 1–11。

### 1.3 兩層模型

| 層級 | 名稱 | 說明 |
|------|------|------|
| Layer 1 | **Atomic Operation** | 一位數加減乘除，cost = 1 |
| Layer 2 | **Chunk** | 較高階技能；內部可展開為 Atomic 或子 Chunk，完成後封裝成 effective cost |

整數四則收斂為單一 **IntegerChunk**（Atomic Expansion Helper），不拆成四個獨立 Chunk kind。

分數四則收斂為單一 **FractionChunk**，內部使用 IntegerChunk 計算 LCM、擴分、分子運算、約分。

---

## 2. Atomic Operation

### 2.1 基本規則

- 一位數加法、減法、乘法、除法：cost = 1
- 進位：每次視為一次一位數加法
- 退位：每次視為一次一位數減法
- 乘法：標準豎式；部分積相加依加法規則
- 除法：長除法；每輪一位數除法、乘法、減法各計 atomic cost

### 2.2 免費操作

```text
a+0, 0+a, a-0, a×1, 1×a, a÷1  → cost = 0
×10, ×100, ÷10, ÷100            → cost = 0（位值移動）
```

### 2.3 範例

| 運算 | cost |
|------|------|
| `3+4` | 1 |
| `25+36` | 3 |
| `34-19` | 3 |
| `8÷2` | 1 |

---

## 3. Chunk 封裝

### 3.1 IntegerChunk

- `operation: add | subtract | multiply | divide`
- `compressionConstant = 1.00`
- 對外只暴露 effective cost

### 3.2 FractionChunk

分數加減（異分母）內部步驟：

```text
LCMChunk
+ ExpandFractionChunk
+ IntegerChunk（分子加減）
+ FractionSimplificationChunk
→ × FractionOperationConstant
```

分數內部使用的整數運算會套用 `FRACTION_INTERNAL_INTEGER_FACTOR = 0.6`，避免分數題被算得過重。

異分母分數加減的 internal cost 下限為 `7`，再乘上對應的 Fraction constant。

### 3.3 Compression Constants（第一版）

> **v2 校準**：分數相關 chunk 常數整體調高，讓分數運算的整體 cost 更貼近真實心智負擔
> （通分／擴分／分子運算／約分多環節疊加）。主要調大四個分數運算常數，內部子 chunk
> （ExpandFraction / GCD / FractionSimplification）僅微調，避免多層相乘後成本過度膨脹。

| Chunk kind | Constant（v1 → v2） |
|---|---|
| IntegerChunk | 1.00 |
| ExpandFractionChunk | 0.30 → **0.35** |
| GCDChunk | 0.35 → **0.40** |
| FractionSimplificationChunk | 0.45 → **0.50** |
| FractionAddChunk | 0.70 → **0.90** |
| FractionSubtractChunk | 0.70 → **0.90** |
| FractionMultiplyChunk | 0.55 → **0.70** |
| FractionDivideChunk | 0.65 → **0.85** |
| AbsoluteValueChunk | 0.80 |
| PowerChunk / RootChunk | 0.75 |

### 3.4 LCM 分級權重

| LCM 範圍 | Tier multiplier |
|---|---|
| ≤ 12 | 0.40 |
| 13–60 | 0.55 |
| 61–120 | 0.75 |
| 121–300 | 0.95 |
| > 300 | 1.15 |

### 3.5 兩位數乘法加成

當 LCM 或 Expand 步驟涉及 **兩位數 × 兩位數** 時：

```text
effectiveCost × 1.25
```

### 3.6 小數與換算延伸 Chunk

小數題與「小數↔分數換算」題不新增獨立壓縮常數，而是**複用既有 Chunk**，僅在必要處乘上固定的換算 scale。對應實作於 [`calculationTemplates.ts`](../src/features/questions/calculationTemplates.ts) 的 `costForTemplateSpec()` 與 `costNodeFromCalculationTemplate()`。

| CalculationTemplate kind | cost 對應 | 說明 |
|---|---|---|
| `decimal-add` / `decimal-subtract` | IntegerChunk | 小數視為 `n/10`，以整數加減計算後置回小數點（位值移動免費） |
| `decimal-multiply` | IntegerChunk | 小數 × 整數：`round(decimal×10) × integer` 的整數乘法 |
| `decimal-square` | PowerChunk（`exponent = 2`） | 小數 `d` 寫成 `n/10ᵏ`，以 `n²` 的平方 chunk 計算（與整數 `square` 同模型） |
| `decimal-fraction-add` / `-subtract` / `-multiply` / `-divide` | FractionChunk | 小數與分數混合四則：以對應 Fraction 運算 chunk 計 |
| `fraction-to-decimal` | `fractionToDecimalInternalCost(1, den) × FRACTION_TO_DECIMAL_COST_SCALE` | 舊版分數轉小數，改用補零長除法計 |
| `fraction-to-decimal-explicit` | `fractionToDecimalInternalCost(num, den) × FRACTION_TO_DECIMAL_COST_SCALE` | 分數→小數：長除法需對被除數補零（真分數如 `1/11` 實際是 `100 ÷ 11`），以「補零後的被除數 ÷ 除數」加上補零步驟計，避免 num<den 被低估成 1 |
| `decimal-to-fraction` | `fractionSimplificationCost(num, den) × DECIMAL_TO_FRACTION_COST_SCALE` | 小數→分數：理解為一次約分（如 `0.375 = 375/1000` 再約分），cost 參考分數約分計算 |

**換算 cost 常數（可調，用來平衡 cost）**

換算成本的計算方式固定：**小數→分數** 以約分（`fractionSimplificationCost`）計、**分數→小數** 以除法（`integerDivideInternalCost`）計；在此之上各乘一個可調常數以平衡 cost。**目前兩者皆設為 1**。

| 常數 | 目前值 | 計算基礎 |
|---|---|---|
| `FRACTION_TO_DECIMAL_COST_SCALE` | **1.0** | 分數→小數：`fractionToDecimalInternalCost`（補零後的被除數 ÷ 除數 ＋ 補零步驟） |
| `DECIMAL_TO_FRACTION_COST_SCALE` | **1.0** | 小數→分數：`fractionSimplificationCost`（寫成 `p/10ⁿ` 再約分） |

> **範例**：`1/11` 需補兩個零 → 以 `100 ÷ 11` 的長除法（成本 10）＋ 2 個補零步驟 = **12**，遠高於舊版固定的 1。

兩者以 `const` 定義於 [`costModel.ts`](../src/features/questions/costModel.ts)。若日後需微調平衡，可調整常數；但**禁止**為了讓個別題目落進 difficulty range 而動態調參，達標須靠 reroll 較小數字、append 步驟或換 template。

> **一致性基準**：常數為 1 時，`0.375` 換算成分數的 cost 等於 `375/1000` 直接約分的 cost，確保「小數→分數」與「既有分數約分」在同一尺度上。

---

## 4. 多步驟題目與 Memory Cost

一道題若包含多個 Chunk，總 cost 為各 Chunk effective cost 之和，再加上多步驟協調成本與答案記憶成本：

```text
questionCost = Σ chunkCost + max(0, stepCount - 1) × 1 + memoryCost(answer)
```

### 4.1 Memory Cost

答案算完後，依「最後需要在腦中暫存的答案型態」計算 `memoryCost(answer)`：

| 答案型別 | 規則 | cost |
|---|---|---|
| 整數 | 先取絕對值，再看十進位位數 | 1 位 → `0.1`；2 位 → `0.3`；3 位 → `0.8`；4 位以上 → `1` |
| 小數 | 看有效數字個數（忽略前導 0 與小數點） | 1 位 → `0.1`；2 位 → `0.3`；3 位 → `0.8`；4 位以上 → `1` |
| 分數 | 一律固定 | `1` |
| 符號答案 | 如 `|x|` | `0.1` |

範例：`7 → 0.1`、`42 → 0.3`、`350 → 0.8`、`1234 → 1`、`0.125 → 0.8`、`3/4 → 1`。

---

## 5. Difficulty 與 Cost Range（高中生水平）

**所有題型共用同一套** difficulty cost range。各題型之間的難度差異已由 Chunk constant（見 `costModel.ts`）校準到同一條 mental-cost 尺度上，因此難度範圍不再依題型分開，否則會把「題型難度」重複計算兩次（一次在 cost、一次在 range）。

| difficulty | cost range |
|---|---|
| easy | **8–12** |
| medium | **10–15** |
| hard | **13–18** |
| extreme | **17–28** |

> 全域範圍定義於 `mentalCost.ts` 的 `DIFFICULTY_COST_RANGES` 與 `costRangeForDifficulty()`。

所有模式（arithmetic / fractions / powers / mixed / weakness-focused）皆**強制**題目 cost 落在該難度的 range 內才可使用，**任何情況都不得放寬 difficulty range**。生成時會先依 difficulty 的子區間權重抽一個 target band，再在該 band 內找題。

### 5.1 難度分佈（加權子區間）

邊界採 **左閉右開**；只有每個 difficulty 的最後一段包含上界。

- `easy`（8–12）
  - `8–9`: 30%
  - `9–10`: 50%
  - `10–11.5`: 15%
  - `11.5–12`: 5%
- `medium`（10–15）
  - `10–12`: 30%
  - `12–14`: 50%
  - `14–15`: 20%
- `hard`（13–18）
  - `13–15`: 20%
  - `15–17`: 60%
  - `17–18`: 20%
- `extreme`（17–28）
  - `17–20`: 15%
  - `20–23`: 15%
  - `23–25`: 40%
  - `25–28`: 40%

powers 等天生 cost 偏低的題型（平方、根號以記憶提取為主），透過**多步冪次複合題**（如 `a² + b²`、`a² + c`）以較大的 base 與多步驟協調成本（見 §4 的 `max(0, stepCount - 1) × 1`）把 cost 抬升進入與其他題型相同的 range，而不是替 powers 另設一套較低的範圍。

### 5.2 生成策略

1. 抽 difficulty → 取得**全域** target cost range（不分題型）。
2. 依 difficulty 的權重分佈抽出一個 target band。
3. 生成 base template → 計算 cost（含 memory cost）。
4. cost 在 target band 內 → 使用題目。
5. cost 太低 → 持續追加 compatible template（整數／分數／冪次步驟），直到 cost 進入 target band；步驟數量沒有硬性上限。
6. cost 太高 → **保留 template 結構、重抽較小的數字**，讓 cost 落回範圍（而非放寬 range）。
7. 同一 template 重試 N 次仍失敗 → 換另一個 template 再試；**在任何步驟都不得放寬 difficulty range**。

### 5.3 題型數量上限（mixed / weakness-focused）

為避免高 cost 題型（如分數）壟斷整份練習，混合模式下每個題型有數量上限：

```text
cap = ceil(questionLimit / eligibleTypeCount) + 1
```

例如 10 題、3 種題型 → 每題型最多 5 題。session 透過 `context.typeCounts` 與 `context.questionLimit` 傳入已出題數，registry 會排除已達上限的題型。

---

## 6. 實作備註

- `calculationTemplates.ts` 保留 `CalculationTemplateSpec` 作為題目模板適配層，內部轉換為 `CostNode` 後交由 `costModel.ts` 計算。
- `fractionMath.ts` 的 `costNodesForExpr()` 會把分數 expression tree 轉成 cost tree。
- LCM > 100 的異分母題仍拒絕生成（`LCM_HARD_CAP`）。

---

## 7. 答案形式與雙路徑成本（有理數題）

分數 / 小數 / 混合運算等**可能產生有理數答案**的題目，其 `mentalCost` 取決於最終選定的**答案形式**（`answerFormat: "fraction" | "decimal"`）。這類題以 `needsAnswerPath` 標記，在**整題生成（含 append 墊高）之後**才由 [`answerPath.ts`](../src/features/questions/answerPath.ts) 的 `resolveAnswerPath()` 定稿，**不在**模板開頭提早決定形式。

### 7.1 路徑選擇規則

先對整條題目算出有理數結果，再依「能否除盡（有限小數）」選路徑：

| 結果 | 可選路徑 | 選路徑規則 | 採用的 `mentalCost` |
|---|---|---|---|
| 除不盡（非有限小數） | **僅分數** | 分數路徑須落在 difficulty range，否則 reroll / append | 分數路徑 cost |
| 可除盡（有限小數） | 分數 **或** 小數 | 分別算兩路 cost，優先採 in-range 路徑；兩路皆 in-range → **70% 分數 / 30% 小數** | **被選中路徑**的 cost |

- 判定「可除盡」由 `hasTerminatingDecimal()`：最簡分母的質因數僅含 2、5。
- 定稿後 prompt 補上 `（分數）` 或 `（小數）`，與 `answerFormat` 一致。
- 整數答案題不走此流程。
- **`mentalCost` 必須來自被選中路徑**，避免「顯示小數答案卻套用分數 cost」而誤過 range 檢查。

### 7.2 兩路徑 cost 組成

`resolveAnswerPath()` 透過 `buildFractionPathCost()` / `buildDecimalPathCost()` 把題目的 `costTemplates` **重新映射**成目標形式的 chunk 序列，再以 §4 公式（Σ chunk + 多步協調 + memory）計算：

**分數路徑（`answerFormat === "fraction"`）**

```text
decimal-to-fraction（每個小數運算元換成分數，× DECIMAL_TO_FRACTION_COST_SCALE）
+ 依 op 對應的 FractionChunk（same/unlike-denom、multiply、divide）
+ 必要的結果約分
```

**小數路徑（`answerFormat === "decimal"`）**

```text
fraction-to-decimal-explicit（每個分數運算元換成小數，× FRACTION_TO_DECIMAL_COST_SCALE = 1.0）
+ 依 op 對應的 decimal 運算（decimal-add / -subtract / -multiply）
```

換算常數目前皆為 1（見 §3.6）；若選中路徑 out-of-range，交由生成流程 reroll（偏高）或 append（偏低），而非為單題調整換算 scale。

### 7.3 與生成流程的銜接

沿用 §5.2，但明確化 append 與答案形式的先後：

1. `pickOne` template → 同一 template 內 reroll 較小數字（`REROLLS_PER_TEMPLATE`）。
2. cost 偏低 → append 相容步驟（整數 / 分數 / **小數** / 減法專項連減）。
3. append 完成後才 `resolveAnswerPath()`（含除盡判定 + 雙路 cost）。
4. 選中路徑 in-range → 回傳；偏高 → 續 reroll；偏低 → 續 append；reroll 用盡才換 template。
5. `constraints.ts` 於生成期驗證：prompt 後綴與 `answerFormat` 一致、分數答案最簡、小數答案為有限小數、MC 四選項格式一致。

---

## 8. 驗證基準（`mentalCost.test.ts`）

- Atomic：`3+4`、`25+36`、`34-19`
- Fraction：`1/2+1/3` 落在 easy 範圍；大 LCM 分數加減明顯高於簡單題
- Memory Cost：整數／小數有效數字／分數都符合對應分級
- 換算一致性：`0.375` 換算 cost 與 `375/1000` 約分 cost 在同一尺度
- 答案路徑：除不盡僅分數路徑；可除盡雙路皆 in-range 時 70/30；`mentalCost` 與選中路徑一致
- 生成：每種難度、每種專項訓練題型的 cost 都必須落在該難度 range 內
- 分佈：每種難度、每種專項訓練題型的 band 分佈偏差不超過 `±5%`
- mixed 模式下已達上限的題型不會再出題
