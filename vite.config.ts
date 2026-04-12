import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    minify: false,
    lib: {
      entry: "src/index.ts",
      fileName: "rehype-ratex",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "ratex-wasm",
        "hast-util-from-html-isomorphic",
        "hast-util-to-text",
        "unist-util-visit-parents",
        "vfile",
        /^node:/,
      ],
    },
  },
  plugins: [dts()],
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
