"use client";

import { GState, jsPDF } from "jspdf";
import { annotationBounds, defaultTitleStyle, formatAcLoopLabel, pdfFontFamily } from "@/lib/annotations";
import { calculateCabinetLayout, calculateLayoutMetrics } from "@/lib/calculations";
import { getRainbowModuleColor } from "@/lib/colors";
import { generatePortMapping } from "@/lib/mapping";
import { placedScale } from "@/lib/placement";
import { effectiveSheet, normalizeSheet, pageFrames, pageSizeMm, readableScalePercent, worldPerPdfMm } from "@/lib/sheet";
import type { CanvasAnnotation, CanvasImage, LedWallProject } from "@/types/project";

export type PdfPageSize = "a4" | "a3" | "a2" | "a1" | "custom";
export type PdfOrientation = "landscape" | "portrait";
export type PdfScaleMode = "fit" | "readable" | "custom";

export interface PdfExportOptions {
  pageSize: PdfPageSize;
  customWidth: number;
  customHeight: number;
  orientation: PdfOrientation;
  margin: number;
  scaleMode: PdfScaleMode;
  scalePercent: number;
  showHeader: boolean;
  showLegend: boolean;
  showDimensions: boolean;
  showModuleNumbers: boolean;
  showRoutes: boolean;
  showPower: boolean;
  showAnnotations: boolean;
  detailPages: boolean;
}

interface DiagramOptions {
  showDimensions: boolean;
  showModuleNumbers: boolean;
  showRoutes: boolean;
  showPower: boolean;
  showAnnotations: boolean;
  includeAnnotations?: boolean;
}

export function exportProjectPdf(project: LedWallProject, options: PdfExportOptions) {
  const sheet = effectiveSheet({
    ...project,
    sheet: normalizeSheet({
      ...project.sheet,
      pageSize: options.pageSize,
      customWidth: options.customWidth,
      customHeight: options.customHeight,
      orientation: options.orientation,
      margin: options.margin,
      scaleMode: options.scaleMode === "fit" ? "fit" : "custom",
      scalePercent:
        options.scaleMode === "readable"
          ? readableScalePercent(project)
          : options.scaleMode === "custom"
            ? options.scalePercent
            : project.sheet.scalePercent
    })
  });
  const framed = { ...project, sheet };
  const frames = pageFrames(framed);
  const page = pageSizeMm(sheet);
  const pdfScale = 1 / worldPerPdfMm(framed);
  const format: [number, number] = [page.width, page.height];
  // Match the orientation to the format so jsPDF does not swap a landscape page into a tall one.
  const orientation: PdfOrientation = page.width >= page.height ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format });
  const diagramOptions: DiagramOptions = {
    showDimensions: options.showDimensions,
    showModuleNumbers: options.showModuleNumbers,
    showRoutes: options.showRoutes,
    showPower: options.showPower,
    showAnnotations: options.showAnnotations,
    includeAnnotations: false
  };

  frames.forEach((frame, index) => {
    if (index > 0) doc.addPage(format, orientation);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const originX = -frame.x * pdfScale;
    const originY = -frame.y * pdfScale;
    doc.setLineDashPattern([], 0);
    doc.saveGraphicsState();
    doc.rect(0, 0, pageWidth, pageHeight, null);
    doc.clip();
    doc.discardPath();
    drawDiagram(doc, project, originX + sheet.wallX * pdfScale, originY + sheet.wallY * pdfScale, pdfScale, diagramOptions);
    framed.placedProjects.forEach((placed) => {
      const localScale = pdfScale * placedScale(placed);
      const placedX = originX + placed.x * pdfScale;
      const placedY = originY + placed.y * pdfScale;
      drawDiagram(doc, placed.project, placedX, placedY, localScale, diagramOptions);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(placed.name, placedX, placedY - 2);
      if (options.showAnnotations) drawAnnotations(doc, placed.project.annotations ?? [], placedX, placedY, localScale);
    });
    if (options.showAnnotations) drawAnnotations(doc, project.annotations ?? [], originX, originY, pdfScale);
    drawPdfImages(doc, project.images ?? [], originX, originY, pdfScale);
    doc.restoreGraphicsState();
    drawPageBorder(doc, sheet.margin);
    if (options.showHeader) drawSheetHeader(doc, project, sheet.margin, pageWidth);
    if (options.showLegend) drawCompactLegend(doc, project, pageWidth - sheet.margin, Math.max(4, sheet.margin * 0.65));
    drawFooter(doc, index + 1, pageWidth, pageHeight, "");
  });

  if (options.detailPages) {
    const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
    if (metrics.columns > 18 || metrics.rows > 30) {
      addDetailPages(doc, project, options, diagramOptions, metrics.columns, frames.length + 1);
    }
  }

  doc.save(`${project.projectName.replace(/\s+/g, "-").toLowerCase()}-mapping.pdf`);
}

function resolveFormat(options: PdfExportOptions): PdfPageSize | [number, number] {
  if (options.pageSize !== "custom") return options.pageSize;
  return [clamp(options.customWidth, 80, 2000), clamp(options.customHeight, 80, 2000)];
}

function drawDiagram(
  doc: jsPDF,
  project: LedWallProject,
  x: number,
  y: number,
  scale: number,
  options: DiagramOptions
) {
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const mapped = generatePortMapping(project.modules, metrics.rows, metrics.columns, project.mapping, project.legend.ports);
  const modules = project.mapping.enabled ? mapped.modules : project.modules;
  const wallWidth = project.wall.width * scale;
  const wallHeight = project.wall.height * scale;

  if (options.showDimensions) {
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.2);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(7);
    doc.line(x, y - 4, x + wallWidth, y - 4);
    doc.text(`${project.wall.width} ${project.wall.unit}`, x + wallWidth / 2, y - 5.5, { align: "center" });
    doc.line(x - 4, y, x - 4, y + wallHeight);
    doc.text(`${project.wall.height} ${project.wall.unit}`, x - 6, y + wallHeight / 2, { angle: 90, align: "center" });
  }

  modules.forEach((module) => {
    const disabled = !module.enabled || module.status === "unused";
    const moduleColor = project.display.rainbowGradient ? getRainbowModuleColor(module, project.wall) : module.color;
    const rgb = hexToRgb(disabled ? "#111827" : moduleColor);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.08);
    doc.rect(x + module.x * scale, y + module.y * scale, Math.max(module.width * scale, 0.05), Math.max(module.height * scale, 0.05), "FD");
    if (options.showModuleNumbers && !disabled) {
      const label = module.customLabel || module.number;
      const boxW = module.width * scale;
      const boxH = module.height * scale;
      if (boxW >= 1.6 && boxH >= 1.3 && label) {
        const textRgb = contrastingText(rgb, hexToRgb(project.display.moduleTextColor ?? "#e2e8f0"));
        const fitted = Math.min(boxH * 0.46, (boxW * 1.35) / Math.max(label.length, 1));
        const fontSize = Math.max(1.7, Math.min(7, fitted));
        doc.setTextColor(textRgb.r, textRgb.g, textRgb.b);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        doc.text(label, x + (module.x + module.width / 2) * scale, y + (module.y + module.height / 2) * scale, {
          align: "center",
          baseline: "middle"
        });
      }
    }
  });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.rect(x, y, wallWidth, wallHeight);

  if (project.display.showCabinets) {
    const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
    cabinets.forEach((cabinet) => {
      const left = x + cabinet.x * scale;
      const top = y + cabinet.y * scale;
      const width = cabinet.width * scale;
      const height = cabinet.height * scale;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.45);
      doc.rect(left, top, width, height);
      drawCabinetLabel(doc, `Cabinet ${cabinet.index}`, left, top, width, height);
    });
  }

  if (options.showRoutes && project.routing.enabled) {
    const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
    drawReceivingCardRoutes(doc, project, cabinets, x, y, scale);
  }

  if (options.showPower && project.power?.enabled) {
    const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
    drawPowerLoops(doc, project, cabinets, x, y, scale);
  }

  if (options.showAnnotations && options.includeAnnotations !== false) {
    drawAnnotations(doc, project.annotations ?? [], x, y, scale);
  }
}

function drawReceivingCardRoutes(
  doc: jsPDF,
  project: LedWallProject,
  cabinets: ReturnType<typeof calculateCabinetLayout>,
  x: number,
  y: number,
  scale: number
) {
  const byId = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]));
  project.routing.routes.forEach((route) => {
    const rgb = hexToRgb(route.color);
    const routeCabinets = route.cabinetIds.map((id) => byId.get(id)).filter((cabinet) => Boolean(cabinet));
    if (routeCabinets.length === 0) return;

    const width = visibleRouteWidth(routeCabinets[0] ? routeCabinets[0].height * scale : 8);
    routeCabinets.slice(0, -1).forEach((cabinet, index) => {
      const next = routeCabinets[index + 1];
      if (!cabinet || !next) return;
      const start = {
        x: x + (cabinet.x + cabinet.width / 2) * scale,
        y: y + (cabinet.y + cabinet.height / 2) * scale
      };
      const end = {
        x: x + (next.x + next.width / 2) * scale,
        y: y + (next.y + next.height / 2) * scale
      };
      strokeVisibleLine(doc, start.x, start.y, end.x, end.y, rgb, width);
    });

    routeCabinets.forEach((cabinet, index) => {
      if (!cabinet) return;
      const cx = x + (cabinet.x + cabinet.width / 2) * scale;
      const cy = y + (cabinet.y + cabinet.height / 2) * scale;
      const radius = Math.max(1.7, width * 0.95);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.circle(cx, cy, radius, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(Math.max(5, radius * 2.1));
      doc.text(String(index + 1), cx, cy, { align: "center", baseline: "middle" });
    });

    if (project.routing.showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      const offset = Math.max(5.5, width * 3.2);
      if (first) {
        drawRouteChip(doc, route.startLabel, x + (first.x + first.width / 2) * scale, y + (first.y + first.height / 2) * scale - offset, rgb);
      }
      if (last && last !== first) {
        drawRouteChip(
          doc,
          `${route.endLabel} / ${route.backupLabel}`,
          x + (last.x + last.width / 2) * scale,
          y + (last.y + last.height / 2) * scale + offset,
          rgb
        );
      }
    }
  });
}

function drawPowerLoops(
  doc: jsPDF,
  project: LedWallProject,
  cabinets: ReturnType<typeof calculateCabinetLayout>,
  x: number,
  y: number,
  scale: number
) {
  const power = project.power;
  if (!power) return;

  if (power.showSupplyBadges) {
    cabinets.forEach((cabinet) => {
      const count = Number(power.cabinetSupplies[cabinet.id] ?? power.defaultSuppliesPerCabinet);
      if (!Number.isFinite(count) || count <= 0) return;
      const badgeX = x + (cabinet.x + cabinet.width) * scale - 11;
      const badgeY = y + cabinet.y * scale + 1.2;
      doc.setFillColor(124, 45, 18);
      doc.setDrawColor(254, 215, 170);
      doc.rect(badgeX, badgeY, 10, 3.4, "FD");
      doc.setTextColor(255, 247, 237);
      doc.setFontSize(3);
      doc.text(`PSU x${count}`, badgeX + 5, badgeY + 2.4, { align: "center" });
    });
  }

  const byId = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]));
  power.routes.forEach((route) => {
    const rgb = hexToRgb(route.color);
    const routeCabinets = route.cabinetIds.map((id) => byId.get(id)).filter((cabinet) => Boolean(cabinet));
    if (routeCabinets.length === 0) return;

    const width = visibleRouteWidth(routeCabinets[0] ? routeCabinets[0].height * scale : 8);
    routeCabinets.slice(0, -1).forEach((cabinet, index) => {
      const next = routeCabinets[index + 1];
      if (!cabinet || !next) return;
      const start = {
        x: x + (cabinet.x + cabinet.width / 2) * scale,
        y: y + (cabinet.y + cabinet.height * 0.72) * scale
      };
      const end = {
        x: x + (next.x + next.width / 2) * scale,
        y: y + (next.y + next.height * 0.72) * scale
      };
      strokeVisibleLine(doc, start.x, start.y, end.x, end.y, rgb, width);
    });

    routeCabinets.forEach((cabinet) => {
      if (!cabinet) return;
      const markerX = x + (cabinet.x + cabinet.width / 2) * scale;
      const markerY = y + (cabinet.y + cabinet.height * 0.72) * scale;
      const badgeW = Math.max(6.2, width * 4.8);
      const badgeH = Math.max(3.4, width * 2.5);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.rect(markerX - badgeW / 2, markerY - badgeH / 2, badgeW, badgeH, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(Math.max(5.5, badgeH * 1.7));
      doc.text("AC", markerX, markerY, { align: "center", baseline: "middle" });
    });

    if (power.showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      const offset = Math.max(5.5, width * 3.2);
      if (first) {
        drawRouteChip(
          doc,
          formatAcLoopLabel(route.sourceLabel),
          x + (first.x + first.width / 2) * scale,
          y + (first.y + first.height * 0.72) * scale - offset,
          rgb
        );
      }
      if (last && last !== first) {
        drawRouteChip(
          doc,
          formatAcLoopLabel(route.endLabel),
          x + (last.x + last.width / 2) * scale,
          y + (last.y + last.height * 0.72) * scale + offset,
          rgb
        );
      }
    }
  });
}

function drawAnnotations(doc: jsPDF, annotations: CanvasAnnotation[], x: number, y: number, scale: number) {
  annotations.forEach((annotation) => {
    if (annotation.kind === "text") {
      const rgb = hexToRgb(annotation.color);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.setFont(pdfFontFamily(annotation.fontFamily), "normal");
      doc.setFontSize(Math.max(1.5, annotation.fontSize * scale * (72 / 25.4)));
      annotation.text.split("\n").forEach((line, index) => {
        doc.text(line, x + annotation.x * scale, y + (annotation.y + annotation.fontSize * 0.82 + index * annotation.fontSize * 1.25) * scale);
      });
      return;
    }

    const stroke = hexToRgb(annotation.color);
    doc.setDrawColor(stroke.r, stroke.g, stroke.b);
    doc.setLineWidth(Math.max(0.12, annotation.strokeWidth * scale));
    if (annotation.kind === "line") {
      doc.line(x + annotation.x * scale, y + annotation.y * scale, x + (annotation.x + annotation.width) * scale, y + (annotation.y + annotation.height) * scale);
      return;
    }

    const bounds = annotationBounds(annotation);
    const left = x + bounds.x * scale;
    const top = y + bounds.y * scale;
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    const style = annotation.fillOpacity > 0 ? "FD" : "S";
    if (annotation.fillOpacity > 0) {
      const fill = hexToRgb(annotation.fill);
      doc.setFillColor(fill.r, fill.g, fill.b);
      doc.setGState(new GState({ opacity: annotation.fillOpacity }));
    }
    if (annotation.kind === "ellipse") {
      doc.ellipse(left + width / 2, top + height / 2, Math.max(width / 2, 0.1), Math.max(height / 2, 0.1), style);
    } else {
      doc.rect(left, top, Math.max(width, 0.1), Math.max(height, 0.1), style);
    }
    if (annotation.fillOpacity > 0) doc.setGState(new GState({ opacity: 1 }));
  });
}

function drawSheetHeader(doc: jsPDF, project: LedWallProject, margin: number, pageWidth: number) {
  const style = { ...defaultTitleStyle, ...project.titleStyle };
  const y = Math.max(4, margin * 0.62);
  doc.setFont(pdfFontFamily(style.fontFamily), "bold");
  doc.setFontSize(8);
  doc.setTextColor(3, 105, 161);
  doc.text("LED WALL MAPPING", margin, y);
  const rgb = hexToRgb(style.color || "#0f172a");
  const darkEnough = rgb.r + rgb.g + rgb.b < 520;
  doc.setTextColor(darkEnough ? rgb.r : 15, darkEnough ? rgb.g : 23, darkEnough ? rgb.b : 42);
  doc.setFont(pdfFontFamily(style.fontFamily), "normal");
  doc.setFontSize(Math.min(style.fontSize, 11));
  const title = doc.splitTextToSize(project.projectName || "Untitled LED Wall", Math.max(40, pageWidth * 0.46)) as string[];
  doc.text(title[0] ?? "", margin + 42, y);
}

function drawCompactLegend(doc: jsPDF, project: LedWallProject, right: number, y: number) {
  const ports = Object.entries(project.legend.ports).slice(0, project.mapping.portCount);
  let x = right;
  for (let index = ports.length - 1; index >= 0; index -= 1) {
    const [port, color] = ports[index];
    const rgb = hexToRgb(color);
    x -= 16;
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(x, y - 2.4, 3.2, 2.4, "F");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(7);
    doc.text(port, x + 4, y);
  }
}

function drawPageBorder(doc: jsPDF, margin: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(14, 116, 144);
  doc.setLineWidth(0.45);
  doc.rect(0.4, 0.4, Math.max(pageWidth - 0.8, 1), Math.max(pageHeight - 0.8, 1));
  if (margin <= 0) return;
  doc.setDrawColor(3, 105, 161);
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, Math.max(pageWidth - margin * 2, 1), Math.max(pageHeight - margin * 2, 1));
}

function drawCabinetLabel(doc: jsPDF, label: string, left: number, top: number, width: number, height: number) {
  if (width < 8 || height < 4) return;
  const fontSize = Math.max(3.4, Math.min(7.5, height * 0.18));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const chipW = Math.min(width - 1, doc.getTextWidth(label) + 1.8);
  const chipH = fontSize * 0.62;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.2);
  doc.rect(left + 0.45, top + 0.45, chipW, chipH, "FD");
  doc.setTextColor(15, 23, 42);
  doc.text(label, left + 0.45 + chipW / 2, top + 0.45 + chipH / 2, { align: "center", baseline: "middle" });
}

function contrastingText(fill: { r: number; g: number; b: number }, preferred: { r: number; g: number; b: number }) {
  const luminance = (color: { r: number; g: number; b: number }) => color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
  if (Math.abs(luminance(fill) - luminance(preferred)) >= 90) return preferred;
  return luminance(fill) > 160 ? { r: 15, g: 23, b: 42 } : { r: 248, g: 250, b: 252 };
}

function drawPdfImages(doc: jsPDF, images: CanvasImage[], x: number, y: number, scale: number) {
  images.forEach((image) => {
    const format = image.dataUrl.includes("image/png") ? "PNG" : "JPEG";
    try {
      doc.addImage(image.dataUrl, format, x + image.x * scale, y + image.y * scale, Math.max(image.width * scale, 0.2), Math.max(image.height * scale, 0.2));
    } catch {
      // A damaged image should not blank the rest of the sheet.
    }
  });
}

function drawFooter(doc: jsPDF, page: number, pageWidth: number, pageHeight: number, tileLabel: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(tileLabel ? `${tileLabel}  Page ${page}` : `Page ${page}`, pageWidth - 14, pageHeight - 6, { align: "right" });
  doc.text("Generated by LED Wall Mapping Designer", 14, pageHeight - 6);
}

function addDetailPages(
  doc: jsPDF,
  project: LedWallProject,
  options: PdfExportOptions,
  diagramOptions: DiagramOptions,
  columns: number,
  startPage: number
) {
  const format = resolveFormat(options);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const columnsPerPage = Math.max(6, Math.floor(columns / Math.ceil(columns / 10)));
  let page = startPage;

  for (let start = 0; start < columns; start += columnsPerPage) {
    doc.addPage(format, options.orientation);
    doc.setTextColor(224, 242, 254);
    doc.setFontSize(14);
    doc.text(`Module Detail Columns ${start}-${Math.min(columns - 1, start + columnsPerPage - 1)}`, 14, 16);
    const slice = {
      ...project,
      wall: {
        ...project.wall,
        width: columnsPerPage * project.module.width
      },
      modules: project.modules
        .filter((module) => module.column >= start && module.column < start + columnsPerPage)
        .map((module) => ({ ...module, x: (module.column - start) * module.width }))
    };
    const scale = Math.min((pageWidth - 28) / Math.max(slice.wall.width, 1), (pageHeight - 42) / Math.max(slice.wall.height, 1));
    drawDiagram(doc, slice, 14, 28, scale, diagramOptions);
    drawFooter(doc, page, pageWidth, pageHeight, "Detail");
    page += 1;
  }
}

function drawRouteChip(doc: jsPDF, text: string, x: number, y: number, border: { r: number; g: number; b: number }) {
  const label = text.trim();
  if (!label) return;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  const width = Math.min(70, Math.max(10, doc.getTextWidth(label) + 2.4));
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(border.r, border.g, border.b);
  doc.setLineWidth(0.4);
  doc.rect(x - width / 2, y - 2.4, width, 4.2, "FD");
  doc.setTextColor(15, 23, 42);
  doc.text(label, x, y + 0.4, { align: "center" });
}

function visibleRouteWidth(spanMm: number) {
  return clamp(spanMm * 0.07, 0.85, 1.6);
}

function strokeVisibleLine(
  doc: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rgb: { r: number; g: number; b: number },
  width: number
) {
  doc.setLineDashPattern([], 0);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(width + 0.85);
  doc.line(x1, y1, x2, y2);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(width + 0.35);
  doc.line(x1, y1, x2, y2);
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(width);
  doc.line(x1, y1, x2, y2);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "");
  const value = Number.parseInt(sanitized.length === 3 ? sanitized.split("").map((char) => char + char).join("") : sanitized, 16);
  if (!Number.isFinite(value)) return { r: 226, g: 232, b: 240 };
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}
