const SUPERSCRIPT_MAP: Record<string, string> = {
  "²": "2",
  "³": "3",
  "⁴": "4",
};

export function promptToLatex(prompt: string): string {
  let latex = prompt;

  latex = latex.replace(/ \((小數)\)$/, " \\text{（$1）}");
  latex = latex.replace(/⁴√(\d+)/g, "\\sqrt[4]{$1}");
  latex = latex.replace(/∛(\d+)/g, "\\sqrt[3]{$1}");
  latex = latex.replace(/(\d+)([²³⁴])/g, (_, value: string, power: string) => `${value}^{${SUPERSCRIPT_MAP[power]}}`);
  latex = latex.replace(/(-?\d+)\/(\d+)/g, "\\frac{$1}{$2}");
  latex = latex.replace(/×/g, "\\times");
  latex = latex.replace(/÷/g, "\\div");
  latex = latex.replace(/−/g, "-");

  return latex;
}
