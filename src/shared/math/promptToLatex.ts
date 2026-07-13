const SUPERSCRIPT_MAP: Record<string, string> = {
  "²": "2",
  "³": "3",
  "⁴": "4",
};

/** Match √ radicand: digits, or a paren group with at most one nesting level. */
const SQRT_RADICAND = String.raw`(?:\d+|\((?:[^()]|\([^()]*\))*\))`;

export function promptToLatex(prompt: string): string {
  let latex = prompt;

  latex = latex.replace(/ \((小數)\)$/, " \\text{（$1）}");
  latex = latex.replace(/⁴√(\d+)/g, "\\sqrt[4]{$1}");
  latex = latex.replace(/∛(\d+)/g, "\\sqrt[3]{$1}");
  latex = latex.replace(new RegExp(`√(${SQRT_RADICAND})`, "g"), (_, radicand: string) => {
    // Unicode √ 用括號標範圍；\sqrt{} 已有橫線，剝掉最外層括號
    const content =
      radicand.startsWith("(") && radicand.endsWith(")") ? radicand.slice(1, -1) : radicand;
    return `\\sqrt{${content}}`;
  });
  latex = latex.replace(/([²³⁴])/g, (_, power: string) => `^{${SUPERSCRIPT_MAP[power]}}`);
  latex = latex.replace(/(-?\d+)\/(\d+)/g, "\\frac{$1}{$2}");
  latex = latex.replace(/×/g, "\\times");
  latex = latex.replace(/÷/g, "\\div");
  latex = latex.replace(/−/g, "-");

  return latex;
}
