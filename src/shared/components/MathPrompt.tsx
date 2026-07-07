import { useMemo } from "react";
import katex from "katex";
import { promptToLatex } from "../math/promptToLatex";

interface MathPromptProps {
  text: string;
  className?: string;
}

export function MathPrompt({ text, className }: MathPromptProps) {
  const html = useMemo(
    () =>
      katex.renderToString(promptToLatex(text), {
        displayMode: true,
        throwOnError: false,
      }),
    [text],
  );

  return <div aria-label={text} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
