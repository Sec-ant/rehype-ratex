import type { Element, ElementContent, Root } from "hast";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toText } from "hast-util-to-text";
import type { DisplayList } from "ratex-wasm";
import { initRatex, renderLatex } from "ratex-wasm";

export { initRatex } from "ratex-wasm";

import { SKIP, visitParents } from "unist-util-visit-parents";
import type { VFile } from "vfile";
import type { SvgRenderOptions } from "./svg-renderer";
import { renderToSvg } from "./svg-renderer";

export type { SvgRenderOptions } from "./svg-renderer";

export interface Options extends SvgRenderOptions {
  /** Color for error fallback text (default: `'#cc0000'`) */
  errorColor?: string;
}

/** Shape of the raw WASM glue module (`ratex-wasm/pkg/ratex_wasm.js`). */
interface RatexPkg {
  initSync: (
    input:
      | { module: ArrayBufferView | ArrayBuffer }
      | ArrayBufferView
      | ArrayBuffer,
  ) => void;
  renderLatex: (s: string) => string;
}

let initPromise: Promise<void> | undefined;

/**
 * Ensure the RaTeX WASM module is initialised exactly once.
 */
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = doInit().catch((error: unknown) => {
      initPromise = undefined;
      throw error;
    });
  }
  return initPromise;
}

function isNodeEnv(): boolean {
  return (
    typeof globalThis.process !== "undefined" &&
    globalThis.process.versions != null &&
    globalThis.process.versions.node != null
  );
}

async function doInit(): Promise<void> {
  // Browser: let wasm-bindgen's default fetch-based loading handle it
  if (!isNodeEnv()) {
    await initRatex();
    return;
  }

  // Node.js: read .wasm from disk (fetch doesn't support file:// URLs)
  await initRatex(async () => {
    const ratexMainUrl = import.meta.resolve("ratex-wasm");
    const pkgUrl = new URL("../pkg/ratex_wasm.js", ratexMainUrl);
    const pkg = (await import(pkgUrl.href)) as RatexPkg;

    const { readFile } = await import("node:fs/promises");
    const wasmFileUrl = new URL("../pkg/ratex_wasm_bg.wasm", ratexMainUrl);
    const wasmBytes = await readFile(wasmFileUrl);
    pkg.initSync({ module: wasmBytes });

    return { renderLatex: pkg.renderLatex };
  });
}

/**
 * Rehype plugin to render math elements using RaTeX.
 *
 * Looks for elements with `language-math`, `math-display`, or `math-inline`
 * classes (same convention as rehype-katex / remark-math) and replaces them
 * with inline SVGs rendered via ratex-wasm.
 */
export default function rehypeRatex(options?: Options) {
  const errorColor = options?.errorColor ?? "#cc0000";
  const svgOptions: SvgRenderOptions = {
    fontSize: options?.fontSize,
    padding: options?.padding,
    strokeWidth: options?.strokeWidth,
  };

  return async (tree: Root, file: VFile): Promise<void> => {
    await ensureInit();

    visitParents(tree, "element", (element, parents) => {
      const classes = Array.isArray(element.properties.className)
        ? (element.properties.className as string[])
        : [];

      const isLanguageMath = classes.includes("language-math");
      const isMathDisplay = classes.includes("math-display");
      const isMathInline = classes.includes("math-inline");

      if (!isLanguageMath && !isMathDisplay && !isMathInline) {
        return;
      }

      let displayMode = isMathDisplay;
      let target: Element = element;
      const parent = parents[parents.length - 1];

      // For <code class="language-math"> inside <pre>, replace the <pre>
      // and treat as display mode (same behavior as rehype-katex)
      if (
        isLanguageMath &&
        element.tagName === "code" &&
        parent &&
        "tagName" in parent &&
        (parent as Element).tagName === "pre"
      ) {
        target = parent as Element;
        displayMode = true;
      }

      const value = toText(element, { whitespace: "pre" });
      // For display mode, prepend \displaystyle since ratex-wasm
      // doesn't have a separate displayMode option
      const latex = displayMode ? `\\displaystyle ${value}` : value;

      try {
        const json = renderLatex(latex);
        const displayList = JSON.parse(json) as DisplayList;
        const svg = renderToSvg(displayList, svgOptions);

        // Add aria-label for accessibility — screen readers can read
        // the original LaTeX source as a fallback
        const accessibleSvg = svg.replace(
          "<svg ",
          `<svg role="img" aria-label="${xmlEscapeAttr(value)}" `,
        );

        let html: string;
        if (displayMode) {
          html = `<span class="ratex-display" style="display:block;text-align:center;">${accessibleSvg}</span>`;
        } else {
          html = accessibleSvg;
        }

        const fragment = fromHtmlIsomorphic(html, { fragment: true });
        const newNodes = fragment.children as ElementContent[];

        const targetParent =
          target === element ? parent : parents[parents.length - 2];
        if (targetParent && "children" in targetParent) {
          const index = targetParent.children.indexOf(target);
          if (index !== -1) {
            targetParent.children.splice(index, 1, ...newNodes);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        file.message("Could not render math with RaTeX", {
          ancestors: [...parents, element],
          cause: error instanceof Error ? error : new Error(String(error)),
          place: element.position,
          ruleId: "ratex",
          source: "rehype-ratex",
        });

        const escapedTitle = xmlEscapeAttr(message);
        const escapedValue = xmlEscapeContent(value);
        const fallback = `<span class="ratex-error" style="color:${errorColor}" title="${escapedTitle}">${escapedValue}</span>`;

        const fragment = fromHtmlIsomorphic(fallback, { fragment: true });
        const newNodes = fragment.children as ElementContent[];

        const targetParent =
          target === element ? parent : parents[parents.length - 2];
        if (targetParent && "children" in targetParent) {
          const index = targetParent.children.indexOf(target);
          if (index !== -1) {
            targetParent.children.splice(index, 1, ...newNodes);
          }
        }
      }

      return SKIP;
    });
  };
}

function xmlEscapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlEscapeContent(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
