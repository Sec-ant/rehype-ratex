import type { Color, DisplayItem, DisplayList, PathCommand } from "ratex-wasm";

interface FontFace {
  family: string;
  weight: string;
  style: string;
}

export interface SvgRenderOptions {
  fontSize?: number;
  padding?: number;
  strokeWidth?: number;
}

function fontIdToFace(fontId: string): FontFace {
  switch (fontId) {
    case "Main-Regular":
      return { family: "KaTeX_Main", weight: "normal", style: "normal" };
    case "Main-Bold":
      return { family: "KaTeX_Main", weight: "bold", style: "normal" };
    case "Main-Italic":
      return { family: "KaTeX_Main", weight: "normal", style: "italic" };
    case "Main-BoldItalic":
      return { family: "KaTeX_Main", weight: "bold", style: "italic" };
    case "Math-Italic":
      return { family: "KaTeX_Math", weight: "normal", style: "italic" };
    case "Math-BoldItalic":
      return { family: "KaTeX_Math", weight: "bold", style: "italic" };
    case "AMS-Regular":
      return { family: "KaTeX_AMS", weight: "normal", style: "normal" };
    case "Caligraphic-Regular":
      return {
        family: "KaTeX_Caligraphic",
        weight: "normal",
        style: "normal",
      };
    case "Fraktur-Regular":
      return { family: "KaTeX_Fraktur", weight: "normal", style: "normal" };
    case "Fraktur-Bold":
      return { family: "KaTeX_Fraktur", weight: "bold", style: "normal" };
    case "SansSerif-Regular":
      return {
        family: "KaTeX_SansSerif",
        weight: "normal",
        style: "normal",
      };
    case "SansSerif-Bold":
      return { family: "KaTeX_SansSerif", weight: "bold", style: "normal" };
    case "SansSerif-Italic":
      return {
        family: "KaTeX_SansSerif",
        weight: "normal",
        style: "italic",
      };
    case "Script-Regular":
      return { family: "KaTeX_Script", weight: "normal", style: "normal" };
    case "Typewriter-Regular":
      return {
        family: "KaTeX_Typewriter",
        weight: "normal",
        style: "normal",
      };
    case "Size1-Regular":
      return { family: "KaTeX_Size1", weight: "normal", style: "normal" };
    case "Size2-Regular":
      return { family: "KaTeX_Size2", weight: "normal", style: "normal" };
    case "Size3-Regular":
      return { family: "KaTeX_Size3", weight: "normal", style: "normal" };
    case "Size4-Regular":
      return { family: "KaTeX_Size4", weight: "normal", style: "normal" };
    default:
      return { family: "KaTeX_Main", weight: "normal", style: "normal" };
  }
}

/**
 * Check whether a Color is effectively black (the default text color).
 */
function isBlack(c: Color): boolean {
  return c.r === 0 && c.g === 0 && c.b === 0 && c.a >= 1 - 1e-5;
}

/**
 * Convert a RaTeX Color to a CSS color string.
 * Default black is mapped to `currentColor` so SVGs adapt to the
 * page's color scheme (light/dark mode). Explicitly colored text
 * (e.g. via `\textcolor`) keeps its intended color.
 * RGB channels are in [0,1] range; multiply by 255 and round.
 */
function colorToCss(c: Color): string {
  if (isBlack(c)) {
    return "currentColor";
  }
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  if (c.a >= 1 - 1e-5) {
    return `rgb(${r},${g},${b})`;
  }
  return `rgba(${r},${g},${b},${c.a})`;
}

/**
 * Format a number, trimming trailing zeros after the decimal point.
 */
function fmt(n: number): string {
  let s = n.toFixed(6);
  if (s.includes(".")) {
    s = s.replace(/0+$/, "");
    s = s.replace(/\.$/, "");
  }
  if (s === "-0") return "0";
  return s;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert an array of PathCommands to an SVG `d` attribute string.
 * Coordinates are transformed by the given em scale and offset.
 */
function commandsToD(
  commands: PathCommand[],
  em: number,
  ox: number,
  oy: number,
): string {
  const parts: string[] = [];
  for (const cmd of commands) {
    switch (cmd.type) {
      case "MoveTo":
        parts.push(`M${fmt(ox + cmd.x * em)} ${fmt(oy + cmd.y * em)}`);
        break;
      case "LineTo":
        parts.push(`L${fmt(ox + cmd.x * em)} ${fmt(oy + cmd.y * em)}`);
        break;
      case "CubicTo":
        parts.push(
          `C${fmt(ox + cmd.x1 * em)} ${fmt(oy + cmd.y1 * em)} ${fmt(ox + cmd.x2 * em)} ${fmt(oy + cmd.y2 * em)} ${fmt(ox + cmd.x * em)} ${fmt(oy + cmd.y * em)}`,
        );
        break;
      case "QuadTo":
        parts.push(
          `Q${fmt(ox + cmd.x1 * em)} ${fmt(oy + cmd.y1 * em)} ${fmt(ox + cmd.x * em)} ${fmt(oy + cmd.y * em)}`,
        );
        break;
      case "Close":
        parts.push("Z");
        break;
      default:
        break;
    }
  }
  return parts.join("");
}

type GlyphPathItem = Extract<DisplayItem, { type: "GlyphPath" }>;
type LineItem = Extract<DisplayItem, { type: "Line" }>;
type RectItem = Extract<DisplayItem, { type: "Rect" }>;
type PathItem = Extract<DisplayItem, { type: "Path" }>;

function renderGlyph(item: GlyphPathItem, em: number, padding: number): string {
  const face = fontIdToFace(item.font);
  const x = fmt(item.x * em + padding);
  const y = fmt(item.y * em + padding);
  const fontSize = fmt(item.scale * em);
  const fill = colorToCss(item.color);
  const ch = xmlEscape(String.fromCodePoint(item.char_code));
  return `<text x="${x}" y="${y}" font-family="${face.family}" font-size="${fontSize}" font-weight="${face.weight}" font-style="${face.style}" fill="${fill}" dominant-baseline="alphabetic">${ch}</text>`;
}

function renderLine(item: LineItem, em: number, padding: number): string {
  const x = fmt(item.x * em + padding);
  const thickness = item.thickness * em;
  const y = fmt(item.y * em + padding - thickness / 2);
  const width = fmt(item.width * em);
  const height = fmt(thickness);
  const fill = colorToCss(item.color);
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

function renderRect(item: RectItem, em: number, padding: number): string {
  const x = fmt(item.x * em + padding);
  const y = fmt(item.y * em + padding);
  const width = fmt(item.width * em);
  const height = fmt(item.height * em);
  const fill = colorToCss(item.color);
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

/**
 * Render a filled Path item. Split on MoveTo boundaries so each
 * sub-path gets its own `<path>` element.
 */
function renderFilledPath(item: PathItem, em: number, padding: number): string {
  const ox = item.x * em + padding;
  const oy = item.y * em + padding;
  const fill = colorToCss(item.color);

  const subPaths: PathCommand[][] = [];
  let current: PathCommand[] = [];

  for (const cmd of item.commands) {
    if (cmd.type === "MoveTo" && current.length > 0) {
      subPaths.push(current);
      current = [];
    }
    current.push(cmd);
  }

  if (current.length > 0) {
    subPaths.push(current);
  }

  const elements: string[] = [];
  for (const sub of subPaths) {
    const d = commandsToD(sub, em, ox, oy);
    if (d) {
      elements.push(
        `<path d="${d}" fill="${fill}" fill-rule="nonzero" stroke="none"/>`,
      );
    }
  }

  return elements.join("");
}

function renderStrokedPath(
  item: PathItem,
  em: number,
  padding: number,
  strokeWidth: number,
): string {
  const ox = item.x * em + padding;
  const oy = item.y * em + padding;
  const stroke = colorToCss(item.color);
  const d = commandsToD(item.commands, em, ox, oy);

  if (!d) return "";

  const sw = fmt(strokeWidth * em);
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/**
 * Render a DisplayList to an SVG string.
 */
export function renderToSvg(
  displayList: DisplayList,
  options?: SvgRenderOptions,
): string {
  const em = options?.fontSize ?? 1.21;
  const padding = options?.padding ?? 0;
  const strokeWidth = options?.strokeWidth ?? 0.04;

  const totalH = displayList.height + displayList.depth;
  const viewW = displayList.width * em + 2 * padding;
  const viewH = totalH * em + 2 * padding;

  const widthEm = fmt(displayList.width);
  const heightEm = fmt(totalH);
  const depthEm = fmt(displayList.depth);

  const body: string[] = [];
  for (const item of displayList.items) {
    switch (item.type) {
      case "GlyphPath":
        body.push(renderGlyph(item as GlyphPathItem, em, padding));
        break;
      case "Line":
        body.push(renderLine(item as LineItem, em, padding));
        break;
      case "Rect":
        body.push(renderRect(item as RectItem, em, padding));
        break;
      case "Path":
        if ((item as PathItem).fill) {
          body.push(renderFilledPath(item as PathItem, em, padding));
        } else {
          body.push(
            renderStrokedPath(item as PathItem, em, padding, strokeWidth),
          );
        }
        break;
      default:
        break;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` viewBox="0 0 ${fmt(viewW)} ${fmt(viewH)}"` +
    ` width="${widthEm}em" height="${heightEm}em"` +
    ` style="vertical-align: -${depthEm}em;">` +
    body.join("") +
    "</svg>"
  );
}
