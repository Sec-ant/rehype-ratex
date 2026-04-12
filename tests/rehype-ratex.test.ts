import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import rehypeRatex from "../src/index";

test("should expose the public api", async () => {
  const mod = await import("../src/index");
  expect(mod.default).toBeDefined();
  expect(typeof mod.default).toBe("function");
  expect(mod.initRatex).toBeDefined();
  expect(typeof mod.initRatex).toBe("function");
  const keys = Object.keys(mod).filter(
    (k) => k !== "default" && k !== "__esModule",
  );
  expect(keys).toEqual(["initRatex"]);
});

test("should transform inline math (math-inline class)", async () => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRatex)
    .use(rehypeStringify)
    .process('<span class="math-inline">x^2</span>');

  const html = String(file);
  expect(html).toContain("<svg");
  expect(html).toContain("</svg>");
  expect(html).not.toContain("ratex-display");
});

test("should transform display math (math-display class)", async () => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRatex)
    .use(rehypeStringify)
    .process('<span class="math-display">\\frac{1}{2}</span>');

  const html = String(file);
  expect(html).toContain("ratex-display");
  expect(html).toContain("<svg");
  expect(html).toContain("display:block");
});

test("should support markdown fenced code block (```math)", async () => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRatex)
    .use(rehypeStringify)
    .process('<pre><code class="language-math">\\sqrt{2}</code></pre>');

  const html = String(file);
  expect(html).toContain("<svg");
  expect(html).toContain("ratex-display");
  expect(html).not.toContain("<pre>");
});

test("should integrate with remark-math", async () => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeRatex)
    .use(rehypeStringify)
    .process("Inline $x^2$ and display:\n\n$$\n\\frac{a}{b}\n$$");

  const html = String(file);
  const svgCount = (html.match(/<svg/g) || []).length;
  expect(svgCount).toBeGreaterThanOrEqual(2);
  expect(html).toContain("ratex-display");
});

test("should handle errors gracefully", async () => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRatex)
    .use(rehypeStringify)
    .process('<span class="math-inline">\\invalid_command_xxx</span>');

  const html = String(file);
  expect(file.messages.length).toBeGreaterThan(0);
  expect(file.messages[0]?.message).toContain(
    "Could not render math with RaTeX",
  );
  expect(html).toContain("ratex-error");
});

test("should support errorColor option", async () => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRatex, { errorColor: "#ff0000" })
    .use(rehypeStringify)
    .process('<span class="math-inline">\\invalid_command_xxx</span>');

  const html = String(file);
  expect(html).toContain("ratex-error");
  expect(html).toContain("#ff0000");
});

test("should add aria-label with LaTeX source for accessibility", async () => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRatex)
    .use(rehypeStringify)
    .process('<span class="math-inline">x^2</span>');

  const html = String(file);
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="x^2"');
});

test("should escape special characters in aria-label", async () => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRatex)
    .use(rehypeStringify)
    .process('<span class="math-inline">a &lt; b</span>');

  const html = String(file);
  expect(html).toContain('role="img"');
  // The aria-label should contain the escaped text
  expect(html).toContain("aria-label=");
});
