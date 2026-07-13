import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { promptToLatex } from "../math/promptToLatex";

interface MathPromptProps {
  text: string;
  className?: string;
}

interface FitState {
  naturalHeight: number;
  naturalWidth: number;
  offsetX: number;
  scale: number;
}

/** Keep thin glyphs (e.g. absolute-value bars) inside the clip box. */
const FIT_PADDING_PX = 8;
const SCALE_EPSILON = 0.001;
const SIZE_EPSILON = 0.5;

const INITIAL_FIT: FitState = {
  naturalHeight: 0,
  naturalWidth: 0,
  offsetX: 0,
  scale: 1,
};

function measureFit(widthTarget: HTMLElement, content: HTMLElement): FitState {
  const available = widthTarget.clientWidth;
  const needed = Math.max(content.scrollWidth, content.offsetWidth);
  const usable = Math.max(0, available - FIT_PADDING_PX);
  const scale =
    usable <= 0 || needed <= 0 ? 1 : Math.min(1, usable / needed);
  const naturalHeight = Math.max(content.scrollHeight, content.offsetHeight);
  const scaledWidth = needed * scale;
  const offsetX = available > 0 ? Math.max(0, (available - scaledWidth) / 2) : 0;

  return {
    scale,
    naturalHeight,
    naturalWidth: needed,
    offsetX,
  };
}

function fitsEqual(a: FitState, b: FitState): boolean {
  return (
    Math.abs(a.scale - b.scale) < SCALE_EPSILON &&
    Math.abs(a.naturalHeight - b.naturalHeight) < SIZE_EPSILON &&
    Math.abs(a.naturalWidth - b.naturalWidth) < SIZE_EPSILON &&
    Math.abs(a.offsetX - b.offsetX) < SIZE_EPSILON
  );
}

export function MathPrompt({ text, className }: MathPromptProps) {
  const widthRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitState>(INITIAL_FIT);
  const [fit, setFit] = useState<FitState>(INITIAL_FIT);

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
    if (!widthTarget || !content) {
      return;
    }

    let cancelled = false;

    const updateFit = () => {
      if (cancelled) {
        return;
      }
      applyFit(measureFit(widthTarget, content));
    };

    updateFit();

    // First question on cold load often measures before KaTeX webfonts settle.
    const fontsReady = document.fonts?.ready;
    void fontsReady?.then(() => {
      updateFit();
    });

    // Catch late layout after the first paint (card width / flex settle).
    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(updateFit);
    });

    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateFit);
    // Width probe tracks card resize. Content observation catches font metric
    // changes; transform/margins do not affect layout size so this stays stable.
    observer?.observe(widthTarget);
    observer?.observe(content);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
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
        ref={contentRef}
        data-math-content
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          display: "inline-block",
          marginBottom,
          marginLeft: fit.offsetX,
          maxWidth: "none",
          // top left + marginLeft avoids center-origin clipping of edge glyphs
          // such as absolute-value bars when the layout box overflows.
          transform: `scale(${fit.scale})`,
          transformOrigin: "top left",
          width: "max-content",
        }}
      />
    </div>
  );
}
