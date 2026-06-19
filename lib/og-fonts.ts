import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_FONT_FAMILY = "Noto Sans SC";

interface OgFontFile {
  path: string;
  weight: 400 | 700;
}

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  style: "normal";
  weight: 400 | 700;
}

const ogFontPath = (...segments: string[]) =>
  join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "noto-sans-sc",
    ...segments,
  );

const FONT_FILES: OgFontFile[] = [
  {
    path: ogFontPath(
      "files",
      "noto-sans-sc-chinese-simplified-400-normal.woff",
    ),
    weight: 400,
  },
  {
    path: ogFontPath(
      "files",
      "noto-sans-sc-chinese-simplified-700-normal.woff",
    ),
    weight: 700,
  },
];

let fontPromise: Promise<OgFont[]> | null = null;

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

async function loadFont({ path, weight }: OgFontFile): Promise<OgFont> {
  const font = await readFile(path);
  return {
    name: OG_FONT_FAMILY,
    data: toArrayBuffer(font),
    style: "normal",
    weight,
  };
}

export function getOgFonts(): Promise<OgFont[]> {
  fontPromise ??= Promise.all(FONT_FILES.map(loadFont));
  return fontPromise;
}
