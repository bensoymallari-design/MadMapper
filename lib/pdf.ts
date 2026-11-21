"use client";

import { GState, jsPDF } from "jspdf";
import { annotationBounds, defaultTitleStyle, formatAcLoopLabel, pdfFontFamily } from "@/lib/annotations";
import { calculateCabinetLayout, calculateLayoutMetrics } from "@/lib/calculations";
import { getRainbowModuleColor } from "@/lib/colors";
import { generatePortMapping } from "@/lib/mapping";
import type { CanvasAnnotation, LedWallProject } from "@/types/project";

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
}

export function exportProjectPdf(project: LedWallProject, options: PdfExportOptions) {
  const format = resolveFormat(options);
  const doc = new jsPDF({
    orientation: options.orientation,
    unit: "mm",
    format
  });
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const margin = clamp(options.margin, 8, 30);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const legendWidth = options.showLegend ? 58 : 0;
  const titleWidth = Math.max(40, pageWidth - margin * 2 - legendWidth - 4);
  const titleLayout = measureTitle(doc, project, titleWidth);
  const stats = statLines(doc, project, metrics, titleWidth);
  const legendHeight = options.showLegend ? 8 + Math.min(project.mapping.portCount, Object.keys(project.legend.ports).length) * 5 : 0;
  const titleBlock = options.showHeader ? 10 + titleLayout.blockHeight + 3 + stats.length * 4 : 0;
  const headerHeight = Math.max(titleBlock, legendHeight);
  const contentTop = margin + headerHeight + 2;
  const contentHeight = pageHeight - contentTop - 10;
  const contentWidth = pageWidth - margin * 2;
  const dimLeft = options.showDimensions ? 14 : 0;
  const dimTop = options.showDimensions ? 8 : 0;
  const availW = Math.max(20, contentWidth - dimLeft);
  const availH = Math.max(20, contentHeight - dimTop);
  const fitScale = Math.min(availW / Math.max(project.wall.width, 1), availH / Math.max(project.wall.height, 1));
  let scale = fitScale;
  if (options.scaleMode === "custom") scale = fitScale * (clamp(options.scalePercent, 25, 400) / 100);
  if (options.scaleMode === "readable" && project.module.width > 0) {
    scale = Math.max(fitScale, 6.5 / project.module.width);
  }
  if (options.scaleMode !== "fit") {
    scale = Math.min(scale, (availW * 8) / Math.max(project.wall.width, 1), (availH * 8) / Math.max(project.wall.height, 1));
  }
  const tilesX = Math.max(1, Math.ceil((project.wall.width * scale) / availW - 1e-6));
  const tilesY = Math.max(1, Math.ceil((project.wall.height * scale) / availH - 1e-6));
  const diagramOptions: DiagramOptions = {
    showDimensions: options.showDimensions,
    showModuleNumbers: options.showModuleNumbers,
    showRoutes: options.showRoutes,
    showPower: options.showPower,
    showAnnotations: options.showAnnotations
  };

  let page = 1;
  for (let tileY = 0; tileY < tilesY; tileY += 1) {
    for (let tileX = 0; tileX < tilesX; tileX += 1) {
      if (page > 1) doc.addPage(format, options.orientation);
      if (options.showHeader) drawHeader(doc, project, margin, titleLayout, stats, titleWidth);
      if (options.showLegend) drawLegend(doc, project, pageWidth - margin - 52, margin);
      doc.saveGraphicsState();
      // A style of null keeps the rectangle as a clip path. The default stroke
      // style would paint and discard the path, and the following clip would hide the wall.
      doc.rect(margin, contentTop, contentWidth, contentHeight, null);
      doc.clip();
      doc.discardPath();
      drawDiagram(
        doc,
        project,
        margin + dimLeft - tileX * availW,
        contentTop + dimTop - tileY * availH,
        scale,
        diagramOptions
      );
      doc.restoreGraphicsState();
      const tileLabel = tilesX * tilesY > 1 ? `Tile ${tileY + 1}-${tileX + 1}` : "";
      drawFooter(doc, page, pageWidth, pageHeight, tileLabel);
      page += 1;
    }
  }

  if (options.detailPages && tilesX === 1 && tilesY === 1 && (metrics.columns > 18 || metrics.rows > 30)) {
    addDetailPages(doc, project, options, diagramOptions, metrics.columns, page);
  }

  doc.save(`${project.projectName.replace(/\s+/g, "-").toLowerCase()}-mapping.pdf`);
}

function resolveFormat(options: PdfExportOptions): PdfPageSize | [number, number] {
  if (options.pageSize !== "custom") return options.pageSize;
  return [clamp(options.customWidth, 80, 2000), clamp(options.customHeight, 80, 2000)];
}

function measureTitle(doc: jsPDF, project: LedWallProject, titleWidth: number) {
  const style = { ...defaultTitleStyle, ...project.titleStyle };
  const fontSize = clamp(style.fontSize || 16, 8, 72);
  const width = style.maxWidth > 0 ? Math.min(style.maxWidth, titleWidth) : titleWidth;
  doc.setFont(pdfFontFamily(style.fontFamily), "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(project.projectName || "Untitled LED Wall", Math.max(24, width)) as string[];
  const lineMm = fontSize * 0.3528 * 1.25;
  return {
    style,
    fontSize,
    width,
    lines,
    lineMm,
    blockHeight: Math.max(0, style.offsetY) + lines.length * lineMm
  };
}

function statLines(
  doc: jsPDF,
  project: LedWallProject,
  metrics: ReturnType<typeof calculateLayoutMetrics>,
  width: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const text = [
    `Wall ${project.wall.width} x ${project.wall.height} ${project.wall.unit}`,
    `Module ${project.module.width} x ${project.module.height} ${project.wall.unit}`,
    `Module px ${project.module.pixelWidth} x ${project.module.pixelHeight}`,
    `Layout ${metrics.columns} x ${metrics.rows}`,
    `Active ${metrics.activeModules}/${metrics.totalModules}`,
    `Resolution ${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px`
  ].join("   ");
  return doc.splitTextToSize(text, Math.max(24, width)) as string[];
}

function drawHeader(
  doc: jsPDF,
  project: LedWallProject,
  margin: number,
  titleLayout: ReturnType<typeof measureTitle>,
  stats: string[],
  titleWidth: number
) {
  const { style, fontSize, width, lines, lineMm } = titleLayout;
  doc.setFont(pdfFontFamily(style.fontFamily), "bold");
  doc.setFontSize(9);
  doc.setTextColor(125, 211, 252);
  doc.text("LED WALL MAPPING", margin, margin + 4);

  const rgb = hexToRgb(style.color || "#e0f2fe");
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFont(pdfFontFamily(style.fontFamily), "normal");
  doc.setFontSize(fontSize);
  const align = style.align === "center" ? "center" : "left";
  const titleX = margin + Math.max(0, style.offsetX) + (align === "center" ? width / 2 : 0);
  doc.text(lines, titleX, Math.max(margin + 8, margin + 9 + style.offsetY), { align, maxWidth: width });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const statsY = margin + 9 + Math.max(0, style.offsetY) + lines.length * lineMm + 4;
  stats.forEach((line, index) => {
    doc.text(line, margin, statsY + index * 4, { maxWidth: titleWidth });
  });
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
        const textRgb = hexToRgb(project.display.moduleTextColor ?? "#e2e8f0");
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
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    cabinets.forEach((cabinet) => {
      doc.rect(x + cabinet.x * scale, y + cabinet.y * scale, cabinet.width * scale, cabinet.height * scale);
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

  if (options.showAnnotations) {
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

    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(0.28);
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
      doc.line(start.x, start.y, end.x, end.y);
      doc.circle(end.x, end.y, 0.55, "F");
    });

    routeCabinets.forEach((cabinet, index) => {
      if (!cabinet) return;
      const cx = x + (cabinet.x + cabinet.width / 2) * scale;
      const cy = y + (cabinet.y + cabinet.height / 2) * scale;
      doc.setDrawColor(248, 250, 252);
      doc.circle(cx, cy, 1.15, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(3.5);
      doc.text(String(index + 1), cx, cy, { align: "center", baseline: "middle" });
    });

    if (project.routing.showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      const labelRgb = hexToRgb(route.labelColor ?? "#e0f2fe");
      doc.setTextColor(labelRgb.r, labelRgb.g, labelRgb.b);
      doc.setFontSize(4.5);
      if (first) {
        doc.text(route.startLabel, x + (first.x + first.width / 2) * scale, y + (first.y + first.height / 2) * scale - 2.2, {
          align: "center"
        });
      }
      if (last && last !== first) {
        doc.text(
          `${route.endLabel} / ${route.backupLabel}`,
          x + (last.x + last.width / 2) * scale,
          y + (last.y + last.height / 2) * scale + 3.2,
          { align: "center" }
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

    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(0.28);
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
      doc.line(start.x, start.y, end.x, end.y);
      doc.circle(end.x, end.y, 0.45, "F");
    });

    routeCabinets.forEach((cabinet) => {
      if (!cabinet) return;
      const markerX = x + (cabinet.x + cabinet.width / 2) * scale;
      const markerY = y + (cabinet.y + cabinet.height * 0.72) * scale - 2.2;
      doc.setDrawColor(255, 247, 237);
      doc.rect(markerX - 1.6, markerY - 1.1, 3.2, 2.2, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(2.6);
      doc.text("AC", markerX, markerY + 0.5, { align: "center" });
    });

    if (power.showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      const labelRgb = hexToRgb(route.labelColor ?? "#fff7ed");
      doc.setTextColor(labelRgb.r, labelRgb.g, labelRgb.b);
      doc.setFontSize(4.5);
      if (first) {
        doc.text(
          formatAcLoopLabel(route.sourceLabel),
          x + (first.x + first.width / 2) * scale,
          y + (first.y + first.height * 0.72) * scale - 4.2,
          { align: "center" }
        );
      }
      if (last && last !== first) {
        doc.text(
          formatAcLoopLabel(route.endLabel),
          x + (last.x + last.width / 2) * scale,
          y + (last.y + last.height * 0.72) * scale + 4.2,
          { align: "center" }
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

function drawLegend(doc: jsPDF, project: LedWallProject, x: number, y: number) {
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9);
  doc.text("Legend", x, y);
  Object.entries(project.legend.ports)
    .slice(0, project.mapping.portCount)
    .forEach(([port, color], index) => {
      const rgb = hexToRgb(color);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(x, y + 4 + index * 5, 4, 3.2, "F");
      doc.setTextColor(226, 232, 240);
      doc.text(`Port ${port}`, x + 6, y + 6.6 + index * 5);
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
