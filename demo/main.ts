import type { DisplayList } from "ratex-wasm";
import { initRatex, renderLatex } from "ratex-wasm";
import { renderToSvg } from "../src/svg-renderer";

// --- DOM elements ---

const latexEl = document.getElementById("latex") as HTMLTextAreaElement;
const previewEl = document.getElementById("preview") as HTMLDivElement;
const errorEl = document.getElementById("error") as HTMLDivElement;
const svgSourceEl = document.getElementById("svg-source") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const examplesEl = document.getElementById("examples") as HTMLDivElement;
const optDisplay = document.getElementById("opt-display") as HTMLInputElement;

// --- Examples ---

interface Example {
  label: string;
  latex: string;
  display?: boolean;
}

const EXAMPLES: Example[] = [
  {
    label: "Quadratic",
    latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    display: true,
  },
  {
    label: "Euler's identity",
    latex: "e^{i\\pi} + 1 = 0",
  },
  {
    label: "Integral",
    latex: "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
    display: true,
  },
  {
    label: "Summation",
    latex: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",
    display: true,
  },
  {
    label: "Matrix",
    latex:
      "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} ax + by \\\\ cx + dy \\end{pmatrix}",
    display: true,
  },
  {
    label: "Greek letters",
    latex: "\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\zeta, \\theta",
  },
  {
    label: "Fractions",
    latex: "\\frac{1}{1 + \\frac{1}{1 + \\frac{1}{x}}}",
    display: true,
  },
  {
    label: "Subscripts",
    latex: "a_1^2 + a_2^2 + \\cdots + a_n^2",
  },
  {
    label: "Square root",
    latex: "\\sqrt{\\sqrt{\\sqrt{x}}}",
  },
  {
    label: "Limit",
    latex: "\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e",
    display: true,
  },
];

function renderExamples() {
  for (const ex of EXAMPLES) {
    const btn = document.createElement("button");
    btn.textContent = ex.label;
    btn.addEventListener("click", () => loadExample(ex));
    examplesEl.appendChild(btn);
  }
}

function loadExample(ex: Example) {
  latexEl.value = ex.latex;
  optDisplay.checked = ex.display ?? false;
  update();
}

// --- Core logic ---

let ready = false;

async function init() {
  statusEl.textContent = "Loading WASM\u2026";
  try {
    await initRatex();
    ready = true;
    statusEl.textContent = "";
    update();
  } catch (e: unknown) {
    statusEl.textContent = `WASM init failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function update() {
  errorEl.classList.remove("visible");
  errorEl.textContent = "";
  previewEl.innerHTML = "";
  svgSourceEl.textContent = "";

  const latex = latexEl.value;
  if (!latex || !ready) return;

  const displayMode = optDisplay.checked;
  const input = displayMode ? `\\displaystyle ${latex}` : latex;

  try {
    const json = renderLatex(input);
    const displayList = JSON.parse(json) as DisplayList;
    const svg = renderToSvg(displayList);

    previewEl.innerHTML = svg;
    svgSourceEl.textContent = svg;

    const bytes = new Blob([svg]).size;
    statusEl.textContent = `${bytes.toLocaleString()} bytes SVG`;
  } catch (e: unknown) {
    errorEl.textContent = e instanceof Error ? e.message : String(e);
    errorEl.classList.add("visible");
    statusEl.textContent = "";
  }
}

// --- Event listeners ---

latexEl.addEventListener("input", update);
optDisplay.addEventListener("change", update);

// --- Init ---

renderExamples();
loadExample(EXAMPLES[0]!);
init();
