import type { QuestionTechnique } from "./types";

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+ ${delta}`;
  if (delta < 0) return `− ${Math.abs(delta)}`;
  return "";
}

export function multiplicationTechnique(left: number, right: number): QuestionTechnique {
  const rounded = Math.round(left / 10) * 10;
  const delta = rounded - left;

  if (delta !== 0 && [1, 2, 5].includes(Math.abs(delta))) {
    const product = left * right;
    const roundedProduct = rounded * right;
    const adjustment = Math.abs(delta) * right;
    const adjustmentExpr = delta > 0 ? `${roundedProduct} − ${adjustment}` : `${roundedProduct} + ${adjustment}`;
    return {
      name: "補償法",
      steps: [
        `${left} × ${right} = (${rounded} ${formatSignedDelta(-delta)}) × ${right}`,
        `${rounded} × ${right} = ${roundedProduct}`,
        `${adjustmentExpr} = ${product}`,
      ],
    };
  }

  const tens = Math.floor(left / 10) * 10;
  const ones = left - tens;
  const tensProduct = tens * right;
  const onesProduct = ones * right;
  return {
    name: "拆分乘法",
    steps: [
      `${left} × ${right} = (${tens} + ${ones}) × ${right}`,
      `${tens} × ${right} = ${tensProduct}，${ones} × ${right} = ${onesProduct}`,
      `${tensProduct} + ${onesProduct} = ${left * right}`,
    ],
  };
}

export function additionTechnique(left: number, right: number): QuestionTechnique {
  const answer = left + right;
  const leftGap = 10 - (left % 10);
  const rightGap = 10 - (right % 10);

  if (left % 10 !== 0 && leftGap <= 5) {
    const rounded = left + leftGap;
    const remaining = right - leftGap;
    return {
      name: "湊整十",
      steps: [
        `${left} 距離下一個整十差 ${leftGap}，先加 ${leftGap} 得 ${rounded}`,
        `${rounded} + ${remaining} = ${answer}`,
      ],
    };
  }

  if (right % 10 !== 0 && rightGap <= 5) {
    const rounded = right + rightGap;
    const remaining = left - rightGap;
    return {
      name: "湊整十",
      steps: [
        `${right} 距離下一個整十差 ${rightGap}，先加 ${rightGap} 得 ${rounded}`,
        `${remaining} + ${rounded} = ${answer}`,
      ],
    };
  }

  return {
    name: "分位相加",
    steps: [`${left} + ${right} = ${answer}`],
  };
}

export function divisionTechnique(dividend: number, divisor: number, answer: number): QuestionTechnique {
  return {
    name: "乘法反推",
    steps: [
      `想：${divisor} × ? = ${dividend}`,
      `${divisor} × ${answer} = ${dividend}`,
    ],
  };
}

export function parenthesesMultiplyTechnique(a: number, b: number, c: number, answer: number): QuestionTechnique {
  const sum = a + b;
  return {
    name: "先算括號",
    steps: [`括號內：${a} + ${b} = ${sum}`, `${sum} × ${c} = ${answer}`],
  };
}

export function multiplyThenAddTechnique(a: number, b: number, c: number, answer: number): QuestionTechnique {
  const product = a * b;
  return {
    name: "先乘後加",
    steps: [`${a} × ${b} = ${product}`, `${product} + ${c} = ${answer}`],
  };
}

export function differenceOfSquaresTechnique(a: number, b: number): QuestionTechnique {
  const direct = a * a - b * b;
  if (a <= 12 && b <= 10) {
    return {
      name: "先算兩個平方",
      steps: [`${a}² = ${a * a}，${b}² = ${b * b}`, `${a * a} − ${b * b} = ${direct}`],
    };
  }

  const sum = a + b;
  const diff = a - b;
  return {
    name: "平方差公式",
    steps: [
      `${a}² − ${b}² = (${a}+${b})(${a}−${b})`,
      `${a}+${b} = ${sum}，${a}−${b} = ${diff}`,
      `${sum} × ${diff} = ${direct}`,
    ],
  };
}

export function sumDiffProductTechnique(a: number, b: number): QuestionTechnique {
  const sum = a + b;
  const diff = a - b;
  const answer = sum * diff;
  if (a <= 10 && b <= 8 && a * a - b * b === answer) {
    return {
      name: "反向平方差",
      steps: [
        `(${a}+${b})(${a}−${b}) = ${a}² − ${b}²`,
        `${a}² = ${a * a}，${b}² = ${b * b}`,
        `${a * a} − ${b * b} = ${answer}`,
      ],
    };
  }

  return {
    name: "和差相乘",
    steps: [`${a} + ${b} = ${sum}`, `${a} − ${b} = ${diff}`, `${sum} × ${diff} = ${answer}`],
  };
}

export function squareTechnique(value: number): QuestionTechnique {
  const answer = value * value;
  const rounded = Math.round(value / 10) * 10;
  const delta = value - rounded;

  if (delta !== 0 && Math.abs(delta) <= 2) {
    const roundedSquare = rounded * rounded;
    return {
      name: "補償平方",
      steps: [
        `${value}² = (${rounded} ${formatSignedDelta(delta)})²`,
        `${rounded}² = ${roundedSquare}，再依完全平方公式調整得 ${answer}`,
      ],
    };
  }

  return {
    name: "常見平方",
    steps: [`${value} × ${value} = ${answer}`],
  };
}

export function squareRootTechnique(root: number, radicand: number): QuestionTechnique {
  return {
    name: "完全平方辨識",
    steps: [`${root}² = ${radicand}`, `√${radicand} = ${root}`],
  };
}

export function cubeTechnique(base: number): QuestionTechnique {
  const answer = base ** 3;
  if (base <= 3) {
    return {
      name: "連乘",
      steps: [`${base}³ = ${base} × ${base} × ${base} = ${answer}`],
    };
  }

  const square = base * base;
  return {
    name: "先平方再乘",
    steps: [`${base}² = ${square}`, `${square} × ${base} = ${answer}`],
  };
}

export function fourthPowerTechnique(base: number): QuestionTechnique {
  const square = base * base;
  const answer = square * square;
  return {
    name: "兩次平方",
    steps: [`${base}² = ${square}`, `${base}⁴ = (${base}²)² = ${square}² = ${answer}`],
  };
}

export function cubeRootTechnique(root: number, radicand: number): QuestionTechnique {
  return {
    name: "冪次反推",
    steps: [`${root}³ = ${radicand}`, `∛${radicand} = ${root}`],
  };
}

export function fourthRootTechnique(root: number, radicand: number): QuestionTechnique {
  const inner = root * root;
  return {
    name: "冪次反推",
    steps: [`${root}⁴ = ${radicand}`, `⁴√${radicand} = ${root}`, `或 √(√${radicand}) = √${inner} = ${root}`],
  };
}

export function sqrtSignedSquareTechnique(signed: number, answer: number): QuestionTechnique {
  return {
    name: "先平方再開方",
    steps: [`(${signed})² = ${signed * signed}`, `√${signed * signed} = ${answer}`],
  };
}

export function symbolicAbsTechnique(variable: string): QuestionTechnique {
  return {
    name: "絕對值化簡",
    steps: [`√(${variable}²) 的結果要寫成 |${variable}|`, `符號 x 可能為負，需用絕對值保留非負性`],
  };
}

export function sameDenominatorAddTechnique(
  leftNumerator: number,
  rightNumerator: number,
  denominator: number,
): QuestionTechnique {
  return {
    name: "同分母相加",
    steps: [
      `分母相同，只加分子`,
      `${leftNumerator}/${denominator} + ${rightNumerator}/${denominator} = ${leftNumerator + rightNumerator}/${denominator}`,
    ],
  };
}

export function decimalConversionTechnique(numerator: number, denominator: number, answer: number): QuestionTechnique {
  return {
    name: "分數轉小數",
    steps: [`${numerator} ÷ ${denominator} = ${answer}`],
  };
}

export function decimalAddTechnique(left: number, right: number, answer: number): QuestionTechnique {
  return {
    name: "小數相加",
    steps: [`對齊小數位：${left} + ${right} = ${answer}`],
  };
}

export function decimalMultiplyTechnique(left: number, right: number, answer: number): QuestionTechnique {
  return {
    name: "整數化小數",
    steps: [`先當 ${left * 10} ÷ 10 × ${right} 計算`, `${left} × ${right} = ${answer}`],
  };
}

export function decimalSubtractTechnique(whole: number, fraction: number, answer: number): QuestionTechnique {
  return {
    name: "借位減小數",
    steps: [`${whole} 可視為 ${whole - 1} + 1`, `${whole - 1}.${10 - fraction * 10} 或直接 ${whole} − ${fraction} = ${answer}`],
  };
}

export function integerAbsCompositeTechnique(
  a: number,
  b: number,
  c: number,
  prompt: string,
  answer: number,
): QuestionTechnique {
  const absA = Math.abs(a);
  const product = b * c;
  return {
    name: "絕對值與運算次序",
    steps: [`|${a}| = ${absA}`, `${absA} + ${b} × ${c} = ${absA} + ${product} = ${answer}`, `原式：${prompt.replace(" = ?", "")}`],
  };
}

export function doubleAbsTechnique(a: number, b: number, answer: number): QuestionTechnique {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  return {
    name: "雙絕對值",
    steps: [`|${a}| = ${absA}，|${b}| = ${absB}`, `${absA} − ${absB} = ${answer}`],
  };
}

export function powersAbsCompositeTechnique(a: number, answer: number, squared: boolean): QuestionTechnique {
  const absA = Math.abs(a);
  if (squared) {
    return {
      name: "先絕對值再平方",
      steps: [`|${a}| = ${absA}`, `${absA}² = ${answer}`],
    };
  }

  const partner = answer - absA;
  return {
    name: "絕對值再運算",
    steps: [`|${a}| = ${absA}`, `${absA} + ${partner} = ${answer}`],
  };
}

export function genericTechnique(name: string, steps: readonly string[]): QuestionTechnique {
  return { name, steps };
}
