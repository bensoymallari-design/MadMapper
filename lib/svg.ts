import { defaultTitleStyle, formatAcLoopLabel, measureTextAnnotation, wrapText } from "@/lib/annotations";
import { calculateCabinetLayout, calculateLayoutMetrics } from "@/lib/calculations";
import { getRainbowModuleColor } from "@/lib/colors";
import { generatePortMapping } from "@/lib/mapping";
import { pageFrames, sheetBounds } from "@/lib/sheet";
import type { CanvasAnnotation, LedWallProject } from "@/types/project";

export function generateProjectSvg(project: LedWallProject) {
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const scale = 0.12;
  const titleStyle = { ...defaultTitleStyle, ...project.titleStyle };
  const titleMaxWidth = titleStyle.maxWidth > 0 ? titleStyle.maxWidth : Math.max(280, project.wall.width * scale * 0.72);
  const titleLines = wrapText(project.projectName || "Untitled LED Wall", titleMaxWidth, titleStyle.fontSize);
  const titleOffset = Math.max(0, titleStyle.offsetY);
  const titleBlock = Math.max(titleStyle.fontSize, titleOffset + titleLines.length * titleStyle.fontSize * 1.3);
  const statsY = 34 + titleBlock + 8;
  const bounds = sheetBounds(project);
  const pad = 48;
  const header = Math.max(110, statsY + 20);
  const minX = Math.min(0, bounds.minX);
  const minY = Math.min(0, bounds.minY);
  const maxX = Math.max(project.wall.width, bounds.maxX, 1);
  const maxY = Math.max(project.wall.height, bounds.maxY, 1);
  const width = (maxX - minX) * scale + pad * 2;
  const height = header + (maxY - minY) * scale + pad;
  const ox = pad - minX * scale;
  const oy = header - minY * scale;
  const margin = 0;
  const wallShift = `translate(${ox + project.sheet.wallX * scale} ${oy + project.sheet.wallY * scale})`;
  const mapped = generatePortMapping(
    project.modules,
    metrics.rows,
    metrics.columns,
    project.mapping,
    project.legend.ports
  );
  const modules = project.mapping.enabled ? mapped.modules : project.modules;
  const paths = project.mapping.enabled ? mapped.paths : [];
  const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);

  const moduleRects = modules
    .map((module) => {
      const disabled = !module.enabled || module.status === "unused";
      const x = margin + module.x * scale;
      const y = margin + module.y * scale;
      const moduleWidth = module.width * scale;
      const moduleHeight = module.height * scale;
      const fill = !disabled
        ? project.display.rainbowGradient
          ? getRainbowModuleColor(module, project.wall)
          : module.color
        : "#111827";
      const opacity = disabled ? "0.32" : "0.72";
      const label = disabled
        ? ""
        : `<text x="${x + moduleWidth / 2}" y="${y + moduleHeight / 2 + 3}" text-anchor="middle" font-size="6" fill="${project.display.moduleTextColor ?? "#e2e8f0"}">${escapeXml(module.customLabel || module.number)}</text>`;
      return `<g><rect x="${x}" y="${y}" width="${moduleWidth}" height="${moduleHeight}" fill="${fill}" opacity="${opacity}" stroke="#1e293b" stroke-width="0.5"/>${label}</g>`;
    })
    .join("");

  const cabinetRects = project.display.showCabinets
    ? cabinets
        .map(
          (cabinet) =>
            `<g><rect x="${margin + cabinet.x * scale}" y="${margin + cabinet.y * scale}" width="${cabinet.width * scale}" height="${cabinet.height * scale}" fill="none" stroke="#f8fafc" stroke-width="1.4"/><text x="${margin + cabinet.x * scale + 5}" y="${margin + cabinet.y * scale + 12}" font-size="9" fill="#f8fafc">Cabinet ${cabinet.index}</text></g>`
        )
        .join("")
    : "";

  const receiverRoutes = project.routing.enabled
    ? project.routing.routes
        .map((route) => {
          const routeCabinets = route.cabinetIds
            .map((id) => cabinets.find((cabinet) => cabinet.id === id))
            .filter((cabinet) => Boolean(cabinet));
          const lines = routeCabinets
            .slice(0, -1)
            .map((cabinet, index) => {
              const next = routeCabinets[index + 1];
              if (!cabinet || !next) return "";
              const start = {
                x: margin + (cabinet.x + cabinet.width / 2) * scale,
                y: margin + (cabinet.y + cabinet.height / 2) * scale
              };
              const end = {
                x: margin + (next.x + next.width / 2) * scale,
                y: margin + (next.y + next.height / 2) * scale
              };
              return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${route.color}" stroke-width="1.25" marker-end="url(#route-arrow)"/>`;
            })
            .join("");
          const nodes = routeCabinets
            .map((cabinet, index) => {
              if (!cabinet) return "";
              const cx = margin + (cabinet.x + cabinet.width / 2) * scale;
              const cy = margin + (cabinet.y + cabinet.height / 2) * scale;
              return `<g><circle cx="${cx}" cy="${cy}" r="4.5" fill="${route.color}" stroke="#f8fafc" stroke-width="0.8"/><text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="5" fill="#ffffff">${index + 1}</text></g>`;
            })
            .join("");
          const first = routeCabinets[0];
          const last = routeCabinets.at(-1);
          const labels =
            project.routing.showLabels && first
              ? `<text x="${margin + (first.x + first.width / 2) * scale}" y="${margin + (first.y + first.height / 2) * scale - 8}" text-anchor="middle" font-size="7" fill="${route.labelColor ?? "#e0f2fe"}">${escapeXml(route.startLabel)}</text>${
                  last && last !== first
                    ? `<text x="${margin + (last.x + last.width / 2) * scale}" y="${margin + (last.y + last.height / 2) * scale + 12}" text-anchor="middle" font-size="7" fill="${route.labelColor ?? "#e0f2fe"}">${escapeXml(`${route.endLabel} / ${route.backupLabel}`)}</text>`
                    : ""
                }`
              : "";
          return `<g>${lines}${nodes}${labels}</g>`;
        })
        .join("")
    : "";

  const power = project.power ?? {
    enabled: false,
    showLabels: true,
    showSupplyBadges: false,
    defaultSuppliesPerCabinet: 1,
    cabinetSupplies: {},
    routes: []
  };

  const powerBadges = power.enabled && power.showSupplyBadges
    ? cabinets
        .map((cabinet) => {
          const count = Number(power.cabinetSupplies[cabinet.id] ?? power.defaultSuppliesPerCabinet);
          if (!Number.isFinite(count) || count <= 0) return "";
          const x = margin + (cabinet.x + cabinet.width) * scale - 42;
          const y = margin + cabinet.y * scale + 8;
          return `<g><rect x="${x}" y="${y}" width="28" height="12" fill="#7c2d12" stroke="#fed7aa" stroke-width="0.6"/><text x="${x + 14}" y="${y + 8}" text-anchor="middle" font-size="6" fill="#fff7ed">PSU x${count}</text></g>`;
        })
        .join("")
    : "";

  const powerRoutes = power.enabled
    ? power.routes
        .map((route) => {
          const routeCabinets = route.cabinetIds
            .map((id) => cabinets.find((cabinet) => cabinet.id === id))
            .filter((cabinet) => Boolean(cabinet));
          const lines = routeCabinets
            .slice(0, -1)
            .map((cabinet, index) => {
              const next = routeCabinets[index + 1];
              if (!cabinet || !next) return "";
              const start = {
                x: margin + (cabinet.x + cabinet.width / 2) * scale,
                y: margin + (cabinet.y + cabinet.height * 0.72) * scale
              };
              const end = {
                x: margin + (next.x + next.width / 2) * scale,
                y: margin + (next.y + next.height * 0.72) * scale
              };
              return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${route.color}" stroke-width="1.25" marker-end="url(#power-arrow)"/>`;
            })
            .join("");
          const nodes = routeCabinets
            .map((cabinet) => {
              if (!cabinet) return "";
              const x = margin + (cabinet.x + cabinet.width / 2) * scale;
              const y = margin + (cabinet.y + cabinet.height * 0.72) * scale - 12;
              return `<g><rect x="${x - 8}" y="${y - 5}" width="16" height="10" fill="${route.color}" stroke="#fff7ed" stroke-width="0.7"/><text x="${x}" y="${y + 2.5}" text-anchor="middle" font-size="5" fill="#ffffff">AC</text></g>`;
            })
            .join("");
          const first = routeCabinets[0];
          const last = routeCabinets.at(-1);
          const labels =
            power.showLabels && first
              ? `<text x="${margin + (first.x + first.width / 2) * scale}" y="${margin + (first.y + first.height * 0.72) * scale - 14}" text-anchor="middle" font-size="7" fill="${route.labelColor ?? "#fff7ed"}">${escapeXml(formatAcLoopLabel(route.sourceLabel))}</text>${
                  last && last !== first
                    ? `<text x="${margin + (last.x + last.width / 2) * scale}" y="${margin + (last.y + last.height * 0.72) * scale + 16}" text-anchor="middle" font-size="7" fill="${route.labelColor ?? "#fff7ed"}">${escapeXml(formatAcLoopLabel(route.endLabel))}</text>`
                    : ""
                }`
              : "";
          return `<g>${lines}${nodes}${labels}</g>`;
        })
        .join("")
    : "";

  const annotationMarkup = (project.annotations ?? []).map((annotation) => renderAnnotation(annotation, ox, oy, scale)).join("");
  const titleX = pad + titleStyle.offsetX + (titleStyle.align === "center" ? titleMaxWidth / 2 : 0);
  const titleAnchor = titleStyle.align === "center" ? "middle" : "start";
  const titleSpans = titleLines
    .map(
      (line, index) =>
        `<tspan x="${titleX}" dy="${index === 0 ? 0 : titleStyle.fontSize * 1.3}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const pathLines =
    project.display.showDataPaths && project.mapping.enabled
      ? paths
          .flatMap((path) =>
            path.modules.slice(0, -1).map((id, index) => {
              const current = modules.find((module) => module.id === id);
              const next = modules.find((module) => module.id === path.modules[index + 1]);
              if (!current || !next) return "";
              return `<line x1="${margin + (current.x + current.width / 2) * scale}" y1="${margin + (current.y + current.height / 2) * scale}" x2="${margin + (next.x + next.width / 2) * scale}" y2="${margin + (next.y + next.height / 2) * scale}" stroke="${path.color}" stroke-width="0.8" marker-end="url(#arrow)"/>`;
            })
          )
          .join("")
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L7,3.5 L0,7 Z" fill="context-stroke"/>
    </marker>
    <marker id="route-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L7,3.5 L0,7 Z" fill="context-stroke"/>
    </marker>
    <marker id="power-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L7,3.5 L0,7 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#020617"/>
  <text x="${pad}" y="20" font-size="11" fill="#7dd3fc" font-family="Arial">LED WALL MAPPING</text>
  <text x="${titleX}" y="${34 + titleOffset}" font-size="${titleStyle.fontSize}" fill="${titleStyle.color}" font-family="${escapeXml(titleStyle.fontFamily)}" text-anchor="${titleAnchor}">${titleSpans}</text>
  <text x="${pad}" y="${statsY}" font-size="10" fill="#94a3b8" font-family="Arial">${project.wall.width} x ${project.wall.height} ${project.wall.unit} | ${metrics.columns} x ${metrics.rows} modules | ${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px</text>
  ${renderPageFrames(project, ox, oy, scale)}
  <g transform="${wallShift}">
  <line x1="${margin}" y1="${margin - 18}" x2="${margin + project.wall.width * scale}" y2="${margin - 18}" stroke="#94a3b8"/>
  <text x="${margin + (project.wall.width * scale) / 2}" y="${margin - 25}" text-anchor="middle" font-size="10" fill="#cbd5e1">${project.wall.width} ${project.wall.unit}</text>
  <line x1="${margin - 18}" y1="${margin}" x2="${margin - 18}" y2="${margin + project.wall.height * scale}" stroke="#94a3b8"/>
  <text transform="translate(${margin - 30},${margin + (project.wall.height * scale) / 2}) rotate(-90)" text-anchor="middle" font-size="10" fill="#cbd5e1">${project.wall.height} ${project.wall.unit}</text>
  ${moduleRects}
  ${cabinetRects}
  ${pathLines}
  ${receiverRoutes}
  ${powerBadges}
  ${powerRoutes}
  </g>
  ${renderPlacedProjects(project, ox, oy, scale)}
  ${renderImages(project, ox, oy, scale)}
  ${annotationMarkup}
</svg>`;
}

function renderPageFrames(project: LedWallProject, ox: number, oy: number, scale: number) {
  if (!project.sheet.showGuides) return "";
  return pageFrames(project)
    .map((frame) => {
      const x = ox + frame.x * scale;
      const y = oy + frame.y * scale;
      const width = frame.width * scale;
      const height = frame.height * scale;
      const margin = frame.margin * scale;
      return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#38bdf8" stroke-width="1.6"/><rect x="${x + margin}" y="${y + margin}" width="${Math.max(width - margin * 2, 1)}" height="${Math.max(height - margin * 2, 1)}" fill="none" stroke="#7dd3fc" stroke-width="1"/><text x="${x + 8}" y="${y + 16}" font-size="12" fill="#e0f2fe" font-family="Arial">${frame.label}</text></g>`;
    })
    .join("");
}

function renderImages(project: LedWallProject, ox: number, oy: number, scale: number) {
  return (project.images ?? [])
    .map((image) => {
      const href = image.dataUrl.replace(/"/g, "");
      return `<image href="${href}" x="${ox + image.x * scale}" y="${oy + image.y * scale}" width="${image.width * scale}" height="${image.height * scale}"/>`;
    })
    .join("");
}

function renderPlacedProjects(project: LedWallProject, ox: number, oy: number, scale: number) {
  return (project.placedProjects ?? [])
    .map((placed) => {
      const placedScale = Number(placed.scale);
      const local = scale * (Number.isFinite(placedScale) && placedScale > 0 ? placedScale : 1);
      const originX = ox + placed.x * scale;
      const originY = oy + placed.y * scale;
      const metrics = calculateLayoutMetrics(placed.project.wall, placed.project.module, placed.project.modules);
      const mapped = generatePortMapping(
        placed.project.modules,
        metrics.rows,
        metrics.columns,
        placed.project.mapping,
        placed.project.legend.ports
      );
      const modules = placed.project.mapping.enabled ? mapped.modules : placed.project.modules;
      const moduleRects = modules
        .map((module) => {
          const disabled = !module.enabled || module.status === "unused";
          const fill = !disabled
            ? placed.project.display.rainbowGradient
              ? getRainbowModuleColor(module, placed.project.wall)
              : module.color
            : "#111827";
          return `<rect x="${originX + module.x * local}" y="${originY + module.y * local}" width="${module.width * local}" height="${module.height * local}" fill="${fill}" opacity="${disabled ? 0.32 : 0.72}" stroke="#1e293b" stroke-width="0.5"/>`;
        })
        .join("");
      const annotations = (placed.project.annotations ?? []).map((annotation) => renderAnnotation(annotation, originX, originY, local)).join("");
      return `<g>${moduleRects}<text x="${originX}" y="${originY - 8}" font-size="11" fill="#e0f2fe" font-family="Arial">${escapeXml(placed.name)}</text>${annotations}</g>`;
    })
    .join("");
}

function renderAnnotation(annotation: CanvasAnnotation, originX: number, originY: number, scale: number) {
  const x = originX + annotation.x * scale;
  const y = originY + annotation.y * scale;
  const width = annotation.width * scale;
  const height = annotation.height * scale;
  if (annotation.kind === "text") {
    const measured = measureTextAnnotation(annotation);
    const lines = measured.text.split("\n");
    const spans = lines
      .map(
        (line, index) =>
          `<tspan x="${originX + measured.x * scale}" dy="${index === 0 ? 0 : measured.fontSize * scale * 1.25}">${escapeXml(line)}</tspan>`
      )
      .join("");
    return `<text x="${originX + measured.x * scale}" y="${originY + measured.y * scale}" fill="${annotation.color}" font-family="${escapeXml(annotation.fontFamily)}" font-size="${measured.fontSize * scale}">${spans}</text>`;
  }
  if (annotation.kind === "line") {
    return `<line x1="${x}" y1="${y}" x2="${x + width}" y2="${y + height}" stroke="${annotation.color}" stroke-width="${Math.max(0.4, annotation.strokeWidth * scale)}" fill="none"/>`;
  }
  const left = width < 0 ? x + width : x;
  const top = height < 0 ? y + height : y;
  const shapeWidth = Math.abs(width);
  const shapeHeight = Math.abs(height);
  const fill = annotation.fillOpacity > 0 ? annotation.fill : "none";
  const opacity = annotation.fillOpacity > 0 ? annotation.fillOpacity : 1;
  if (annotation.kind === "ellipse") {
    return `<ellipse cx="${left + shapeWidth / 2}" cy="${top + shapeHeight / 2}" rx="${shapeWidth / 2}" ry="${shapeHeight / 2}" fill="${fill}" fill-opacity="${opacity}" stroke="${annotation.color}" stroke-width="${Math.max(0.4, annotation.strokeWidth * scale)}"/>`;
  }
  return `<rect x="${left}" y="${top}" width="${shapeWidth}" height="${shapeHeight}" fill="${fill}" fill-opacity="${opacity}" stroke="${annotation.color}" stroke-width="${Math.max(0.4, annotation.strokeWidth * scale)}"/>`;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}
