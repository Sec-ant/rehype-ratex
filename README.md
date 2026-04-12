# rehype-ratex

[rehype](https://github.com/rehypejs/rehype) plugin to render math with [RaTeX](https://github.com/erweixin/RaTeX) — a Rust/WASM alternative to KaTeX. Outputs inline SVGs at build time, so no client-side JavaScript or CSS is needed to display math.

## Features

- Drop-in replacement for [rehype-katex](https://github.com/remarkjs/remark-math/tree/main/packages/rehype-katex) — same class conventions (`math-inline`, `math-display`, `language-math`)
- Works with [remark-math](https://github.com/remarkjs/remark-math) out of the box
- Renders to inline SVG (no client-side JS, no CSS, no font loading)
- Accessible — SVGs include `role="img"` and `aria-label` with the original LaTeX source
- Powered by [ratex-wasm](https://www.npmjs.com/package/ratex-wasm) (Rust compiled to WebAssembly)
- Zero client-side runtime — SVGs are embedded in the HTML at build time
- ESM-only with full TypeScript declarations

## Installation

```bash
npm install @sec-ant/rehype-ratex
```

## Quick Start

```ts
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import rehypeRatex from "@sec-ant/rehype-ratex";

const file = await unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeRatex)
  .use(rehypeStringify)
  .process('<span class="math-inline">x^2 + y^2 = z^2</span>');

console.log(String(file));
```

## KaTeX Fonts

The rendered SVGs use `<text>` elements referencing KaTeX font families (`KaTeX_Main`, `KaTeX_Math`, etc.). You need to load KaTeX fonts on any page that displays the output. The simplest way is to include the KaTeX CSS from a CDN:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css"
  crossorigin="anonymous"
/>
```

Only the `@font-face` declarations are needed — the layout CSS in `katex.min.css` won't interfere with the SVG output.

### With remark-math (Markdown)

```ts
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import rehypeRatex from "@sec-ant/rehype-ratex";

const file = await unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeRatex)
  .use(rehypeStringify)
  .process("Inline $E = mc^2$ and display:\n\n$$\n\\int_0^\\infty e^{-x} dx = 1\n$$");

console.log(String(file));
```

## API Reference

### `rehypeRatex(options?)`

```ts
import rehypeRatex from "@sec-ant/rehype-ratex";
```

The plugin function. Pass it to `.use()` on a unified processor.

### `Options`

```ts
interface Options {
  errorColor?: string;
  fontSize?: number;
  padding?: number;
  strokeWidth?: number;
}
```

| Option        | Type     | Default     | Description                                         |
| ------------- | -------- | ----------- | --------------------------------------------------- |
| `errorColor`  | `string` | `"#cc0000"` | Color for error fallback text when rendering fails  |
| `fontSize`    | `number` | `1.21`      | Font size scale factor (em units) for SVG rendering |
| `padding`     | `number` | `0`         | Padding around the SVG content (in pixels)          |
| `strokeWidth` | `number` | `0.04`      | Stroke width for path elements (in em units)        |

WASM is loaded automatically — from disk in Node.js, via `fetch` in browsers. No manual initialisation is needed.

### Custom WASM Loading

For non-standard environments (edge runtimes, custom bundler setups), the native `initRatex` from `ratex-wasm` is re-exported. Call it before using the plugin to take full control of WASM loading:

```ts
import rehypeRatex, { initRatex } from "@sec-ant/rehype-ratex";

// Call initRatex with a custom loader before using the plugin
await initRatex(async () => {
  // Your custom WASM loading logic here
  // Must return { renderLatex: (s: string) => string }
});

// The plugin detects that WASM is already initialised and skips its own init
unified().use(rehypeParse).use(rehypeRatex).use(rehypeStringify);
```

See the [ratex-wasm documentation](https://www.npmjs.com/package/ratex-wasm) for the full `initRatex` API.

## Supported Input Formats

The plugin recognizes the same HTML class conventions as rehype-katex:

| Class           | Behavior                         | Typical source               |
| --------------- | -------------------------------- | ---------------------------- |
| `math-inline`   | Inline math                      | `$...$` via remark-math      |
| `math-display`  | Display (block) math             | `$$...$$` via remark-math    |
| `language-math` | Fenced code block (`\`\`\`math`) | Markdown code fences         |

## Error Handling

When a LaTeX expression fails to render, the plugin:

1. Emits a [VFile message](https://github.com/vfile/vfile#message) with source `"rehype-ratex"` and rule `"ratex"`
2. Replaces the element with a `<span class="ratex-error">` containing the original LaTeX text, styled with `errorColor`

This matches rehype-katex's error behavior — your build won't break on invalid math, and errors are visible in the output.

## How It Works

1. The plugin walks the hast (HTML AST) tree looking for elements with math classes
2. LaTeX text is extracted and passed to `ratex-wasm`, which returns a DisplayList (a flat list of drawing commands)
3. The DisplayList is converted to SVG elements — text glyphs, paths, lines, and rects
4. The SVG replaces the original math element in the tree

Display math uses `\displaystyle` mode. The WASM module is initialized once and reused across all math elements.

## License

[MIT](./LICENSE)
