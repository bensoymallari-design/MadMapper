import type { LedModule, WallSettings } from "@/types/project";

export function getRainbowModuleColor(module: LedModule, wall: WallSettings) {
  const centerX = module.x + module.width / 2;
  const centerY = module.y + module.height / 2;
  const horizontal = wall.width > 0 ? centerX / wall.width : 0;
  const vertical = wall.height > 0 ? centerY / wall.height : 0;
  const hue = (horizontal * 330 + vertical * 28) % 360;
  return hslToHex(hue, 92, 54);
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = l - chroma / 2;
  const [r, g, b] = hueToRgb(hue, chroma, x).map((value) => Math.round((value + match) * 255));

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hueToRgb(hue: number, chroma: number, x: number) {
  if (hue < 60) return [chroma, x, 0];
  if (hue < 120) return [x, chroma, 0];
  if (hue < 180) return [0, chroma, x];
  if (hue < 240) return [0, x, chroma];
  if (hue < 300) return [x, 0, chroma];
  return [chroma, 0, x];
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0");
}
