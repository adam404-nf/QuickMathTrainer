import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MathPrompt } from "./MathPrompt";

type ResizeCallback = ResizeObserverCallback;

function installResizeObserverMock() {
  const observers = new Set<{ callback: ResizeCallback }>();

  class MockResizeObserver {
    private readonly entry: { callback: ResizeCallback };

    constructor(callback: ResizeCallback) {
      this.entry = { callback };
      observers.add(this.entry);
    }

    observe() {
      this.entry.callback([], this as unknown as ResizeObserver);
    }

    unobserve() {}

    disconnect() {
      observers.delete(this.entry);
    }
  }

  vi.stubGlobal("ResizeObserver", MockResizeObserver);

  return {
    notify() {
      for (const observer of observers) {
        observer.callback([], {} as ResizeObserver);
      }
    },
  };
}

function stubWidth(element: HTMLElement, width: number) {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(element, "offsetWidth", {
    configurable: true,
    get: () => width,
  });
}

function stubHeight(element: HTMLElement, height: number) {
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
}

describe("MathPrompt", () => {
  let resizeMock: ReturnType<typeof installResizeObserverMock>;
  let resolveFonts!: () => void;
  let originalFonts: FontFaceSet | undefined;

  beforeEach(() => {
    resizeMock = installResizeObserverMock();
    originalFonts = document.fonts;
    const fontsPromise = new Promise<FontFaceSet>((resolve) => {
      resolveFonts = () => resolve(originalFonts ?? ({} as FontFaceSet));
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: fontsPromise },
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: originalFonts,
    });
    vi.unstubAllGlobals();
  });

  it("renders a latex-styled prompt with an accessible raw label", () => {
    const { container } = render(<MathPrompt text="5/6 + 1/3 = ?" />);

    expect(screen.getByLabelText("5/6 + 1/3 = ?")).toBeInTheDocument();
    expect(container.querySelector(".mfrac")).not.toBeNull();
  });

  it("keeps scale at 1 when the expression fits the container", async () => {
    render(<MathPrompt text="3 + 4 = ?" />);

    const root = screen.getByLabelText("3 + 4 = ?");
    const probe = root.querySelector("[data-math-width-probe]") as HTMLElement;
    const content = root.querySelector("[data-math-content]") as HTMLElement;
    expect(probe).not.toBeNull();
    expect(content).not.toBeNull();

    stubWidth(probe, 400);
    stubWidth(content, 200);
    stubHeight(content, 80);
    resizeMock.notify();

    await waitFor(() => {
      expect(content.style.transform).toBe("scale(1)");
    });
    expect(content.style.transformOrigin).toBe("top left");
    expect(content.style.marginBottom).toBe("0px");
    expect(content.style.marginLeft).toBe("100px");
  });

  it("scales from the top-left and pads so edge glyphs are not clipped", async () => {
    render(
      <MathPrompt text="|1/3 - 1/2| + 1/5 ÷ 3/8 = ? （分數）" />,
    );

    const root = screen.getByLabelText("|1/3 - 1/2| + 1/5 ÷ 3/8 = ? （分數）");
    const probe = root.querySelector("[data-math-width-probe]") as HTMLElement;
    const content = root.querySelector("[data-math-content]") as HTMLElement;
    expect(content).not.toBeNull();

    stubWidth(probe, 320);
    stubWidth(content, 800);
    stubHeight(content, 100);
    resizeMock.notify();

    await waitFor(() => {
      expect(content.style.transform).toBe("scale(0.39)");
    });
    expect(content.style.transformOrigin).toBe("top left");
    expect(content.style.marginLeft).toBe("4px");
    expect(content.style.marginBottom).toBe("-61px");
    expect(root.style.overflow).toBe("hidden");
  });

  it("remeasures after fonts become ready when the first paint used fallback metrics", async () => {
    render(<MathPrompt text="|1/3 - 1/2| + 1/5 = ?" />);

    const root = screen.getByLabelText("|1/3 - 1/2| + 1/5 = ?");
    const probe = root.querySelector("[data-math-width-probe]") as HTMLElement;
    const content = root.querySelector("[data-math-content]") as HTMLElement;

    // First paint: container ready, but KaTeX fonts not loaded yet → narrower metrics.
    stubWidth(probe, 320);
    stubWidth(content, 300);
    stubHeight(content, 100);
    resizeMock.notify();

    await waitFor(() => {
      expect(content.style.transform).toBe("scale(1)");
    });

    // Fonts settle: expression becomes wider than the card.
    stubWidth(content, 800);
    resolveFonts();

    await waitFor(() => {
      expect(content.style.transform).toBe("scale(0.39)");
    });
    expect(content.style.marginLeft).toBe("4px");
  });

  it("does not oscillate when ResizeObserver fires again after scaling", async () => {
    render(
      <MathPrompt text="((((43 + 14) ÷ 3 + 21 - 2) × 5) + 8) ÷ 2 = ?" />,
    );

    const root = screen.getByLabelText("((((43 + 14) ÷ 3 + 21 - 2) × 5) + 8) ÷ 2 = ?");
    const probe = root.querySelector("[data-math-width-probe]") as HTMLElement;
    const content = root.querySelector("[data-math-content]") as HTMLElement;

    stubWidth(probe, 320);
    stubWidth(content, 800);
    stubHeight(content, 100);
    resizeMock.notify();

    await waitFor(() => {
      expect(content.style.transform).toBe("scale(0.39)");
    });

    resizeMock.notify();
    resizeMock.notify();
    resizeMock.notify();

    expect(content.style.transform).toBe("scale(0.39)");
    expect(content.style.marginLeft).toBe("4px");
  });
});
