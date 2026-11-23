import { contentOrigin, pageFrames, type PageFrame } from "@/lib/sheet";
import type { LedWallProject, PlacedProject } from "@/types/project";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

export function placedScale(placed: { scale?: number }) {
  const scale = Number(placed.scale);
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(20, Math.max(0.05, scale));
}

export function placedSize(placed: PlacedProject) {
  const scale = placedScale(placed);
  return {
    width: Math.max(placed.project.wall.width, 0) * scale,
    height: Math.max(placed.project.wall.height, 0) * scale
  };
}

/** Scale a project so it fills the page's printable area, aligned to the margin. */
export function fitPlacedInFrame(wallWidth: number, wallHeight: number, frame: PageFrame) {
  const origin = contentOrigin(frame);
  if (wallWidth <= 0 || wallHeight <= 0) return { x: origin.x, y: origin.y, scale: 1 };
  const contentW = Math.max(frame.width - frame.margin * 2, 1);
  const contentH = Math.max(frame.height - frame.margin * 2, 1);
  const scale = Math.min(20, Math.max(0.05, Math.min(contentW / wallWidth, contentH / wallHeight)));
  return { x: origin.x, y: origin.y, scale };
}

export function frameContaining(frames: PageFrame[], x: number, y: number) {
  if (frames.length === 0) {
    return { index: 0, label: "Page 1", x: 0, y: 0, width: 1, height: 1, margin: 0 };
  }
  const inside = frames.find((frame) => x >= frame.x && y >= frame.y && x <= frame.x + frame.width && y <= frame.y + frame.height);
  if (inside) return inside;
  return frames.reduce((best, frame) => {
    const bestDistance = (x - (best.x + best.width / 2)) ** 2 + (y - (best.y + best.height / 2)) ** 2;
    const distance = (x - (frame.x + frame.width / 2)) ** 2 + (y - (frame.y + frame.height / 2)) ** 2;
    return distance < bestDistance ? frame : best;
  });
}

export interface AlignmentTargets {
  xs: number[];
  ys: number[];
}

export function alignmentTargets(project: LedWallProject, ignoreId?: string): AlignmentTargets {
  const xs: number[] = [];
  const ys: number[] = [];
  xs.push(project.sheet.wallX, project.sheet.wallX + project.wall.width / 2, project.sheet.wallX + project.wall.width);
  ys.push(project.sheet.wallY, project.sheet.wallY + project.wall.height / 2, project.sheet.wallY + project.wall.height);
  for (const frame of pageFrames(project)) {
    const origin = contentOrigin(frame);
    const right = origin.x + Math.max(frame.width - frame.margin * 2, 0);
    const bottom = origin.y + Math.max(frame.height - frame.margin * 2, 0);
    xs.push(frame.x, origin.x, (origin.x + right) / 2, right, frame.x + frame.width);
    ys.push(frame.y, origin.y, (origin.y + bottom) / 2, bottom, frame.y + frame.height);
  }
  for (const placed of project.placedProjects) {
    if (placed.id === ignoreId) continue;
    const size = placedSize(placed);
    xs.push(placed.x, placed.x + size.width / 2, placed.x + size.width);
    ys.push(placed.y, placed.y + size.height / 2, placed.y + size.height);
  }
  return { xs, ys };
}

export interface SnapGuides {
  xs: number[];
  ys: number[];
}

function nearest(value: number, targets: number[], threshold: number) {
  let best: number | null = null;
  let delta = threshold;
  for (const target of targets) {
    const distance = Math.abs(value - target);
    if (distance <= delta) {
      best = target;
      delta = distance;
    }
  }
  return best;
}

function bestEdge(edges: number[], targets: number[], threshold: number) {
  let best: { index: number; target: number; delta: number } | null = null;
  for (let index = 0; index < edges.length; index += 1) {
    const target = nearest(edges[index], targets, threshold);
    if (target === null) continue;
    const delta = Math.abs(edges[index] - target);
    if (!best || delta < best.delta) best = { index, target, delta };
  }
  return best;
}

export function snapTranslation(
  x: number,
  y: number,
  width: number,
  height: number,
  targets: AlignmentTargets,
  threshold: number
) {
  const guides: SnapGuides = { xs: [], ys: [] };
  const xSnap = bestEdge([x, x + width / 2, x + width], targets.xs, threshold);
  const ySnap = bestEdge([y, y + height / 2, y + height], targets.ys, threshold);
  let nextX = x;
  let nextY = y;
  if (xSnap) {
    nextX = xSnap.target - [0, width / 2, width][xSnap.index];
    guides.xs.push(xSnap.target);
  }
  if (ySnap) {
    nextY = ySnap.target - [0, height / 2, height][ySnap.index];
    guides.ys.push(ySnap.target);
  }
  return { x: nextX, y: nextY, guides };
}

export function resizePlaced(options: {
  corner: ResizeCorner;
  anchorX: number;
  anchorY: number;
  wallWidth: number;
  wallHeight: number;
  pointerX: number;
  pointerY: number;
  targets?: AlignmentTargets;
  threshold?: number;
}) {
  const wallW = Math.max(options.wallWidth, 1);
  const wallH = Math.max(options.wallHeight, 1);
  const dx = Math.abs(options.pointerX - options.anchorX);
  const dy = Math.abs(options.pointerY - options.anchorY);
  let scale = (dx * wallW + dy * wallH) / (wallW * wallW + wallH * wallH);
  const guides: SnapGuides = { xs: [], ys: [] };
  if (options.targets && options.threshold && options.threshold > 0) {
    const movingX = options.corner === "nw" || options.corner === "sw" ? options.anchorX - wallW * scale : options.anchorX + wallW * scale;
    const movingY = options.corner === "nw" || options.corner === "ne" ? options.anchorY - wallH * scale : options.anchorY + wallH * scale;
    const snapX = nearest(movingX, options.targets.xs, options.threshold);
    const snapY = nearest(movingY, options.targets.ys, options.threshold);
    const scaleX = snapX === null ? null : Math.abs(snapX - options.anchorX) / wallW;
    const scaleY = snapY === null ? null : Math.abs(snapY - options.anchorY) / wallH;
    if (scaleX !== null && scaleY !== null) {
      if (Math.abs(scaleX - scale) <= Math.abs(scaleY - scale)) {
        scale = scaleX;
        guides.xs.push(snapX as number);
      } else {
        scale = scaleY;
        guides.ys.push(snapY as number);
      }
    } else if (scaleX !== null && snapX !== null) {
      scale = scaleX;
      guides.xs.push(snapX);
    } else if (scaleY !== null && snapY !== null) {
      scale = scaleY;
      guides.ys.push(snapY);
    }
  }
  scale = Math.min(20, Math.max(0.05, scale));
  const width = wallW * scale;
  const height = wallH * scale;
  const x = options.corner === "nw" || options.corner === "sw" ? options.anchorX - width : options.anchorX;
  const y = options.corner === "nw" || options.corner === "ne" ? options.anchorY - height : options.anchorY;
  return { x, y, scale, guides };
}
