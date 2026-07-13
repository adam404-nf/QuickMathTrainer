import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { promptToLatex } from "../math/promptToLatex";

interface MathPromptProps {
  text: string;
  className?: string;
}

interface FitState {
  naturalHeight: number;
  scale: number;
}

const SCALE_EPSILON = 0.001;
const HEIGHT_EPSILON = 0.5;

function measureFit(widthTarget: HTMLElement, content: HTMLElement): FitState {
  const available = widthTarget.clientWidth;
  const needed = content.scrollWidth;
  const scale =
    available <= 0 || needed <= 0 ? 1 : Math.min(1, available / needed);

  return {
    scale,
    // scrollHeight includes ink that may overflow the border box (e.g. accents).
    naturalHeight: Math.max(content.scrollHeight, content.offsetHeight),
  };
}

function fitsEqual(a: FitState, b: FitState): boolean {
  return (
    Math.abs(a.scale - b.scale) < SCALE_EPSILON &&
    Math.abs(a.naturalHeight - b.naturalHeight) < HEIGHT_EPSILON
  );
}

export function MathPrompt({ text, className }: MathPromptProps) {
  const widthRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitState>({ naturalHeight: 0, scale: 1 });
  const [fit, setFit] = useState<FitState>({ naturalHeight: 0, scale: 1 });

  const html = useMemo(
    () =>
      katex.renderToString(promptToLatex(text), {
        displayMode: true,
        throwOnError: false,
      }),
    [text],
  );

  const applyFit = (next: FitState) => {
    if (fitsEqual(fitRef.current, next)) {
      return;
    }
    fitRef.current = next;
    setFit(next);
  };

  useLayoutEffect(() => {
    const widthTarget = widthRef.current;
    const content = contentRef.current;
    if (!widthTarget || !content) {
      return;
    }
    applyFit(measureFit(widthTarget, content));
  }, [html]);

  useEffect(() => {
    const widthTarget = widthRef.current;
    const content = contentRef.current;
    if (!widthTarget || !content || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateFit = () => {
      applyFit(measureFit(widthTarget, content));
    };

    // Observe a zero-height width probe only. Never observe the scaled node —
    // that feedback loop causes flicker/ghosting.
    const observer = new ResizeObserver(updateFit);
    observer.observe(widthTarget);
    updateFit();

    return () => observer.disconnect();
  }, [html]);

  const marginBottom =
    fit.naturalHeight > 0 ? fit.naturalHeight * (fit.scale - 1) : 0;

  return (
    <div
      aria-label={text}
      className={className}
      style={{ overflow: "hidden" }}
    >
      <div
        ref={widthRef}
        aria-hidden="true"
        data-math-width-probe
        style={{ height: 0, overflow: "hidden", width: "100%" }}
      />
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          ref={contentRef}
          data-math-content
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            display: "inline-block",
            marginBottom,
            maxWidth: "none",
            transform: `scale(${fit.scale})`,
            transformOrigin: "top center",
            width: "max-content",
          }}
        />
      </div>
    </div>
  );
}
