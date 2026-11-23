import { annotationBounds } from "@/lib/annotations";
import type { LedWallProject, SheetSettings } from "@/types/project";

const PAGE_SIZES: Record<Exclude<SheetSettings["pageSize"], "custom">, [number, number]> = {
  a4: [210, 297],
  a3: [297, 420],
  a2: [420, 594],
  a1: [594, 841]
};

export function defaultSheet(): SheetSettings {
  return {
    pageSize: "a3",
    customWidth: 420,
    customHeight: 297,
    orientation: "landscape",
    margin: 12,
    pageCount: 1,
    columns: 2,
    scaleMode: "fit",
    scalePercent: 100,
    showGuides: true,
    lockOrientation: false,
    wallX: 0,
    wallY: 0
  };
}

export function normalizeSheet(value?: Partial<SheetSettings> | null): SheetSettings {
  const sheet = { ...defaultSheet(), ...value };
  const pageSize = ["a4", "a3", "a2", "a1", "custom"].includes(sheet.pageSize) ? sheet.pageSize : "a3";
  const orientation = sheet.orientation === "portrait" ? "portrait" : "landscape";
  return {
    pageSize,
    customWidth: clamp(Number(sheet.customWidth) || 420, 80, 2000),
    customHeight: clamp(Number(sheet.customHeight) || 297, 80, 2000),
    orientation,
    margin: clamp(Number(sheet.margin) || 0, 0, 80),
    pageCount: Math.round(clamp(Number(sheet.pageCount) || 1, 1, 24)),
    columns: Math.round(clamp(Number(sheet.columns) || 1, 1, 8)),
    scaleMode: sheet.scaleMode === "custom" ? "custom" : "fit",
    scalePercent: clamp(Number(sheet.scalePercent) || 100, 25, 800),
    showGuides: sheet.showGuides !== false,
    lockOrientation: sheet.lockOrientation === true,
    wallX: Number.isFinite(Number(sheet.wallX)) ? Number(sheet.wallX) : 0,
    wallY: Number.isFinite(Number(sheet.wallY)) ? Number(sheet.wallY) : 0
  };
}

/**
 * A single fitted page follows the wall, so a wide wall is not stranded
 * at the top of a tall empty sheet. An explicit orientation choice stays put.
 */
export function effectiveSheet(project: LedWallProject): SheetSettings {
  const sheet = normalizeSheet(project.sheet);
  if (sheet.lockOrientation || sheet.scaleMode !== "fit" || sheet.pageCount > 1 || (project.placedProjects?.length ?? 0) > 0) {
    return sheet;
  }
  const orientation = orientationThatFits(project.wall.width, project.wall.height, sheet);
  return orientation === sheet.orientation ? sheet : { ...sheet, orientation };
}

export function orientationThatFits(width: number, height: number, sheet: SheetSettings): "landscape" | "portrait" {
  const landscape = pageSizeMm({ ...sheet, orientation: "landscape" });
  const wallRatio = Math.max(width, 1) / Math.max(height, 1);
  const landRatio = landscape.width / landscape.height;
  const landGap = Math.abs(Math.log(wallRatio / landRatio));
  const portGap = Math.abs(Math.log(wallRatio / (1 / landRatio)));
  return landGap <= portGap ? "landscape" : "portrait";
}

export interface PageFrame {
  index: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  margin: number;
}

export function pageSizeMm(sheet: SheetSettings) {
  const source = sheet.pageSize === "custom" ? [sheet.customWidth, sheet.customHeight] : PAGE_SIZES[sheet.pageSize];
  const [shortSide, longSide] = source[0] <= source[1] ? source : [source[1], source[0]];
  return sheet.orientation === "landscape"
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}

/** World millimeters represented by one millimeter on the PDF page. */
export function worldPerPdfMm(project: LedWallProject) {
  const sheet = effectiveSheet(project);
  const page = pageSizeMm(sheet);
  const margin = usableMargin(sheet, page);
  const contentW = Math.max(1, page.width - margin * 2);
  const contentH = Math.max(1, page.height - margin * 2);
  const wallW = project.wall.width > 0 ? project.wall.width : contentW;
  const wallH = project.wall.height > 0 ? project.wall.height : contentH;
  const fit = Math.max(wallW / contentW, wallH / contentH);
  if (sheet.scaleMode === "custom") return fit / (sheet.scalePercent / 100);
  return fit;
}

export function readableScalePercent(project: LedWallProject) {
  const fit = worldPerPdfMm({
    ...project,
    sheet: { ...normalizeSheet(project.sheet), scaleMode: "fit", scalePercent: 100 }
  });
  if (project.module.width <= 0) return 100;
  const largestWorldPerPdf = project.module.width / 6.5;
  if (fit <= largestWorldPerPdf) return 100;
  return clamp((fit / largestWorldPerPdf) * 100, 100, 800);
}

export function pageFrames(project: LedWallProject): PageFrame[] {
  const sheet = effectiveSheet(project);
  const page = pageSizeMm(sheet);
  const world = worldPerPdfMm(project);
  const width = page.width * world;
  const height = page.height * world;
  const margin = usableMargin(sheet, page) * world;
  const columns = Math.max(1, Math.min(sheet.columns, sheet.pageCount));
  return Array.from({ length: sheet.pageCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      index,
      label: `Page ${index + 1}`,
      x: -margin + column * width,
      y: -margin + row * height,
      width,
      height,
      margin
    };
  });
}

export function contentOrigin(frame: PageFrame) {
  return { x: frame.x + frame.margin, y: frame.y + frame.margin };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function contentBounds(project: LedWallProject): Bounds {
  const sheet = normalizeSheet(project.sheet);
  const boxes = [
    { x: sheet.wallX, y: sheet.wallY, width: Math.max(project.wall.width, 0), height: Math.max(project.wall.height, 0) }
  ];
  for (const placed of project.placedProjects ?? []) {
    const scale = Number(placed.scale);
    const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
    boxes.push({
      x: placed.x,
      y: placed.y,
      width: Math.max(placed.project.wall.width, 0) * safe,
      height: Math.max(placed.project.wall.height, 0) * safe
    });
  }
  for (const image of project.images ?? []) {
    boxes.push(image);
  }
  for (const annotation of project.annotations ?? []) {
    boxes.push(annotationBounds(annotation));
  }
  return boundsOf(boxes);
}

export function sheetBounds(project: LedWallProject): Bounds {
  const content = contentBounds(project);
  const frames = normalizeSheet(project.sheet).showGuides ? pageFrames(project) : [];
  return boundsOf([
    { x: content.minX, y: content.minY, width: content.maxX - content.minX, height: content.maxY - content.minY },
    ...frames
  ]);
}

export function pagesToCover(project: LedWallProject) {
  const sheet = effectiveSheet(project);
  const probe = pageFrames({
    ...project,
    sheet: { ...sheet, pageCount: 1, columns: 1, lockOrientation: true }
  })[0];
  const bounds = contentBounds(project);
  const pagesX = Math.max(1, Math.ceil((bounds.maxX - probe.x) / probe.width - 1e-6));
  const pagesY = Math.max(1, Math.ceil((bounds.maxY - probe.y) / probe.height - 1e-6));
  return {
    pagesX,
    pagesY,
    columns: pagesX,
    pageCount: pagesX * pagesY
  };
}

function usableMargin(sheet: SheetSettings, page: { width: number; height: number }) {
  return Math.min(sheet.margin, page.width / 2 - 1, page.height / 2 - 1);
}

function boundsOf(boxes: Array<{ x: number; y: number; width: number; height: number }>): Bounds {
  if (boxes.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return {
    minX: Math.min(...boxes.map((box) => box.x)),
    minY: Math.min(...boxes.map((box) => box.y)),
    maxX: Math.max(...boxes.map((box) => box.x + Math.max(box.width, 0))),
    maxY: Math.max(...boxes.map((box) => box.y + Math.max(box.height, 0)))
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
