import { calculateCabinetLayout, calculateLayoutMetrics } from "@/lib/calculations";
import { generatePortMapping } from "@/lib/mapping";
import type { LedWallProject } from "@/types/project";

export function generateProjectSvg(project: LedWallProject) {
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const scale = 0.12;
  const margin = 90;
  const width = project.wall.width * scale + margin * 2;
  const height = project.wall.height * scale + margin * 2;
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
      const x = margin + module.x * scale;
      const y = margin + module.y * scale;
      const moduleWidth = module.width * scale;
      const moduleHeight = module.height * scale;
      const fill = module.enabled ? module.color : "#111827";
      const opacity = module.enabled ? "0.72" : "0.32";
      return `<g><rect x="${x}" y="${y}" width="${moduleWidth}" height="${moduleHeight}" fill="${fill}" opacity="${opacity}" stroke="#1e293b" stroke-width="0.5"/><text x="${x + moduleWidth / 2}" y="${y + moduleHeight / 2 + 3}" text-anchor="middle" font-size="6" fill="#e2e8f0">${escapeXml(module.number)}</text></g>`;
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
              return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${route.color}" stroke-width="3" marker-end="url(#route-arrow)"/>`;
            })
            .join("");
          const nodes = routeCabinets
            .map((cabinet, index) => {
              if (!cabinet) return "";
              const cx = margin + (cabinet.x + cabinet.width / 2) * scale;
              const cy = margin + (cabinet.y + cabinet.height / 2) * scale;
              return `<g><circle cx="${cx}" cy="${cy}" r="8" fill="${route.color}" stroke="#f8fafc" stroke-width="1.5"/><text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="8" fill="#ffffff">${index + 1}</text></g>`;
            })
            .join("");
          const first = routeCabinets[0];
          const last = routeCabinets.at(-1);
          const labels =
            project.routing.showLabels && first
              ? `<text x="${margin + (first.x + first.width / 2) * scale}" y="${margin + (first.y + first.height / 2) * scale - 14}" text-anchor="middle" font-size="9" fill="#e0f2fe">${escapeXml(route.startLabel)}</text>${
                  last && last !== first
                    ? `<text x="${margin + (last.x + last.width / 2) * scale}" y="${margin + (last.y + last.height / 2) * scale + 20}" text-anchor="middle" font-size="9" fill="#e0f2fe">${escapeXml(`${route.endLabel} / ${route.backupLabel}`)}</text>`
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
    defaultSuppliesPerCabinet: 1,
    cabinetSupplies: {},
    routes: []
  };

  const powerBadges = power.enabled
    ? cabinets
        .map((cabinet) => {
          const count = power.cabinetSupplies[cabinet.id] ?? power.defaultSuppliesPerCabinet;
          if (count <= 1) return "";
          const x = margin + (cabinet.x + cabinet.width) * scale - 42;
          const y = margin + cabinet.y * scale + 8;
          return `<g><rect x="${x}" y="${y}" width="38" height="16" fill="#7c2d12" stroke="#fed7aa" stroke-width="1"/><text x="${x + 19}" y="${y + 11}" text-anchor="middle" font-size="8" fill="#fff7ed">PSU x${count}</text></g>`;
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
              return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${route.color}" stroke-width="4" marker-end="url(#power-arrow)"/>`;
            })
            .join("");
          const nodes = routeCabinets
            .map((cabinet, index) => {
              if (!cabinet) return "";
              const x = margin + (cabinet.x + cabinet.width / 2) * scale;
              const y = margin + (cabinet.y + cabinet.height * 0.72) * scale - 12;
              return `<g><rect x="${x - 10}" y="${y - 8}" width="20" height="16" fill="${route.color}" stroke="#fff7ed" stroke-width="1.5"/><text x="${x}" y="${y + 3}" text-anchor="middle" font-size="7" fill="#ffffff">DC${index + 1}</text></g>`;
            })
            .join("");
          const first = routeCabinets[0];
          const last = routeCabinets.at(-1);
          const labels =
            power.showLabels && first
              ? `<text x="${margin + (first.x + first.width / 2) * scale}" y="${margin + (first.y + first.height * 0.72) * scale - 28}" text-anchor="middle" font-size="9" fill="#fff7ed">${escapeXml(route.sourceLabel)}</text>${
                  last && last !== first
                    ? `<text x="${margin + (last.x + last.width / 2) * scale}" y="${margin + (last.y + last.height * 0.72) * scale + 28}" text-anchor="middle" font-size="9" fill="#fff7ed">${escapeXml(route.endLabel)}</text>`
                    : ""
                }`
              : "";
          return `<g>${lines}${nodes}${labels}</g>`;
        })
        .join("")
    : "";

  const pathLines =
    project.display.showDataPaths && project.mapping.enabled
      ? paths
          .flatMap((path) =>
            path.modules.slice(0, -1).map((id, index) => {
              const current = modules.find((module) => module.id === id);
              const next = modules.find((module) => module.id === path.modules[index + 1]);
              if (!current || !next) return "";
              return `<line x1="${margin + (current.x + current.width / 2) * scale}" y1="${margin + (current.y + current.height / 2) * scale}" x2="${margin + (next.x + next.width / 2) * scale}" y2="${margin + (next.y + next.height / 2) * scale}" stroke="${path.color}" stroke-width="1" marker-end="url(#arrow)"/>`;
            })
          )
          .join("")
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#38bdf8"/>
    </marker>
    <marker id="power-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#f97316"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#020617"/>
  <text x="${margin}" y="36" font-size="18" fill="#e0f2fe" font-family="Arial">LED WALL MAPPING - ${escapeXml(project.projectName)}</text>
  <text x="${margin}" y="58" font-size="10" fill="#94a3b8" font-family="Arial">${project.wall.width} x ${project.wall.height} ${project.wall.unit} | ${metrics.columns} x ${metrics.rows} modules | ${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px</text>
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
</svg>`;
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
