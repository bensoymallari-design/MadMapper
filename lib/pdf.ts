"use client";

import { jsPDF } from "jspdf";
import { calculateCabinetLayout, calculateLayoutMetrics } from "@/lib/calculations";
import { generatePortMapping } from "@/lib/mapping";
import type { LedWallProject } from "@/types/project";

export type PdfPageSize = "a4" | "a3" | "a2" | "a1";
export type PdfOrientation = "landscape" | "portrait";

export function exportProjectPdf(
  project: LedWallProject,
  options: { pageSize: PdfPageSize; orientation: PdfOrientation }
) {
  const doc = new jsPDF({
    orientation: options.orientation,
    unit: "mm",
    format: options.pageSize
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const diagramX = 14;
  const diagramY = 62;
  const diagramWidth = pageWidth - 28;
  const diagramHeight = pageHeight - 92;
  const scale = Math.min(diagramWidth / project.wall.width, diagramHeight / project.wall.height);

  drawHeader(doc, project, metrics, pageWidth);
  drawDiagram(doc, project, diagramX, diagramY, scale);
  drawLegend(doc, project, pageWidth - 72, 16);
  drawFooter(doc, 1, pageWidth, pageHeight);

  if (metrics.columns > 18 || metrics.rows > 30) {
    addDetailPages(doc, project, options, metrics.columns);
  }

  doc.save(`${project.projectName.replace(/\s+/g, "-").toLowerCase()}-mapping.pdf`);
}

function drawHeader(
  doc: jsPDF,
  project: LedWallProject,
  metrics: ReturnType<typeof calculateLayoutMetrics>,
  pageWidth: number
) {
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, pageWidth, 52, "F");
  doc.setTextColor(224, 242, 254);
  doc.setFontSize(18);
  doc.text("LED WALL MAPPING", 14, 17);
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text(project.projectName, 14, 25);
  doc.setFontSize(8);
  doc.text(`Wall Dimensions: ${project.wall.width} x ${project.wall.height} ${project.wall.unit}`, 14, 36);
  doc.text(`Module Dimensions: ${project.module.width} x ${project.module.height} ${project.wall.unit}`, 14, 42);
  doc.text(`Module Resolution: ${project.module.pixelWidth} x ${project.module.pixelHeight} px`, 86, 36);
  doc.text(`Module Layout: ${metrics.columns} x ${metrics.rows}`, 86, 42);
  doc.text(`Total Modules: ${metrics.activeModules} active / ${metrics.totalModules} generated`, 148, 36);
  doc.text(`Wall Resolution: ${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px`, 148, 42);
}

function drawDiagram(doc: jsPDF, project: LedWallProject, x: number, y: number, scale: number) {
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const mapped = generatePortMapping(project.modules, metrics.rows, metrics.columns, project.mapping, project.legend.ports);
  const modules = project.mapping.enabled ? mapped.modules : project.modules;
  const wallWidth = project.wall.width * scale;
  const wallHeight = project.wall.height * scale;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.line(x, y - 5, x + wallWidth, y - 5);
  doc.text(`${project.wall.width} ${project.wall.unit}`, x + wallWidth / 2 - 10, y - 7);
  doc.line(x - 5, y, x - 5, y + wallHeight);
  doc.text(`${project.wall.height} ${project.wall.unit}`, x - 12, y + wallHeight / 2, { angle: 90 });

  modules.forEach((module) => {
    const rgb = hexToRgb(module.enabled ? module.color : "#111827");
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setDrawColor(30, 41, 59);
    doc.rect(x + module.x * scale, y + module.y * scale, module.width * scale, module.height * scale, "FD");
    if (project.display.showNumbers && module.width * scale > 5 && module.height * scale > 3) {
      doc.setTextColor(226, 232, 240);
      doc.setFontSize(Math.max(3, Math.min(6, module.height * scale * 0.35)));
      doc.text(module.number, x + (module.x + module.width / 2) * scale, y + (module.y + module.height / 2) * scale, {
        align: "center",
        baseline: "middle"
      });
    }
  });

  if (project.display.showCabinets) {
    const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
    doc.setDrawColor(248, 250, 252);
    doc.setLineWidth(0.35);
    cabinets.forEach((cabinet) => {
      doc.rect(x + cabinet.x * scale, y + cabinet.y * scale, cabinet.width * scale, cabinet.height * scale);
    });
  }

  if (project.routing.enabled) {
    const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
    drawReceivingCardRoutes(doc, project, cabinets, x, y, scale);
  }

  if (project.power?.enabled) {
    const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
    drawPowerLoops(doc, project, cabinets, x, y, scale);
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
    doc.setLineWidth(0.8);
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
      doc.circle(end.x, end.y, 1.2, "F");
    });

    routeCabinets.forEach((cabinet, index) => {
      if (!cabinet) return;
      const cx = x + (cabinet.x + cabinet.width / 2) * scale;
      const cy = y + (cabinet.y + cabinet.height / 2) * scale;
      doc.setDrawColor(248, 250, 252);
      doc.circle(cx, cy, 2.5, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5);
      doc.text(String(index + 1), cx, cy + 1.4, { align: "center" });
    });

    if (project.routing.showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      doc.setTextColor(224, 242, 254);
      doc.setFontSize(6);
      if (first) {
        doc.text(route.startLabel, x + (first.x + first.width / 2) * scale, y + (first.y + first.height / 2) * scale - 4, {
          align: "center"
        });
      }
      if (last && last !== first) {
        doc.text(
          `${route.endLabel} / ${route.backupLabel}`,
          x + (last.x + last.width / 2) * scale,
          y + (last.y + last.height / 2) * scale + 7,
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
      const badgeX = x + (cabinet.x + cabinet.width) * scale - 13;
      const badgeY = y + cabinet.y * scale + 2;
      doc.setFillColor(124, 45, 18);
      doc.setDrawColor(254, 215, 170);
      doc.rect(badgeX, badgeY, 12, 5, "FD");
      doc.setTextColor(255, 247, 237);
      doc.setFontSize(4);
      doc.text(`PSU x${count}`, badgeX + 6, badgeY + 3.5, { align: "center" });
    });
  }

  const byId = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]));
  power.routes.forEach((route) => {
    const rgb = hexToRgb(route.color);
    const routeCabinets = route.cabinetIds.map((id) => byId.get(id)).filter((cabinet) => Boolean(cabinet));
    if (routeCabinets.length === 0) return;

    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(1);
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
      doc.rect(end.x - 1, end.y - 1, 2, 2, "F");
    });

    routeCabinets.forEach((cabinet, index) => {
      if (!cabinet) return;
      const markerX = x + (cabinet.x + cabinet.width / 2) * scale;
      const markerY = y + (cabinet.y + cabinet.height * 0.72) * scale - 4;
      doc.setDrawColor(255, 247, 237);
      doc.rect(markerX - 2.7, markerY - 2, 5.4, 4, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(3.5);
      doc.text(`DC${index + 1}`, markerX, markerY + 1.2, { align: "center" });
    });

    if (power.showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      doc.setTextColor(255, 247, 237);
      doc.setFontSize(5);
      if (first) {
        doc.text(route.sourceLabel, x + (first.x + first.width / 2) * scale, y + (first.y + first.height * 0.72) * scale - 9, {
          align: "center"
        });
      }
      if (last && last !== first) {
        doc.text(route.endLabel, x + (last.x + last.width / 2) * scale, y + (last.y + last.height * 0.72) * scale + 9, {
          align: "center"
        });
      }
    }
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
      doc.rect(x, y + 6 + index * 5, 4, 4, "F");
      doc.text(`Port ${port}`, x + 7, y + 9 + index * 5);
    });
}

function drawFooter(doc: jsPDF, page: number, pageWidth: number, pageHeight: number) {
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Page ${page}`, pageWidth - 24, pageHeight - 8);
  doc.text("Generated by LED Wall Mapping Designer", 14, pageHeight - 8);
}

function addDetailPages(
  doc: jsPDF,
  project: LedWallProject,
  options: { pageSize: PdfPageSize; orientation: PdfOrientation },
  columns: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const columnsPerPage = Math.max(6, Math.floor(columns / Math.ceil(columns / 10)));
  let page = 2;

  for (let start = 0; start < columns; start += columnsPerPage) {
    doc.addPage(options.pageSize, options.orientation);
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
    const scale = Math.min((pageWidth - 28) / slice.wall.width, (pageHeight - 42) / slice.wall.height);
    drawDiagram(doc, slice, 14, 28, scale);
    drawFooter(doc, page, pageWidth, pageHeight);
    page += 1;
  }
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "");
  const value = Number.parseInt(sanitized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}
