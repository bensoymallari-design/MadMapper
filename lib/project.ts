import { calculateModuleCount, calculateModulePosition } from "@/lib/calculations";
import { generateNumbering } from "@/lib/numbering";
import type {
  LedModule,
  LedWallProject,
  ModuleStatus,
  NumberingSettings
} from "@/types/project";

export const statusColors: Record<ModuleStatus, string> = {
  installed: "#2563eb",
  missing: "#475569",
  damaged: "#dc2626",
  spare: "#f59e0b",
  unused: "#1f2937"
};

export const defaultPortColors: Record<number, string> = {
  1: "#2563eb",
  2: "#16a34a",
  3: "#eab308",
  4: "#dc2626",
  5: "#8b5cf6",
  6: "#06b6d4",
  7: "#f97316",
  8: "#ec4899"
};

export const defaultNumbering: NumberingSettings = {
  mode: "rowColumn",
  startNumber: 0,
  prefix: "",
  separator: "_",
  pad: 1,
  startingCorner: "topLeft",
  horizontalDirection: "leftToRight",
  verticalDirection: "topToBottom",
  snake: false
};

export function createSampleProject(): LedWallProject {
  const project: LedWallProject = {
    version: 1,
    projectName: "7.2m LED Wall",
    wall: {
      width: 7200,
      height: 7200,
      unit: "mm",
      orientation: "landscape",
      rotation: 0
    },
    module: {
      width: 360,
      height: 160,
      pixelWidth: 192,
      pixelHeight: 86
    },
    numbering: defaultNumbering,
    cabinet: {
      enabled: true,
      width: 1440,
      height: 640,
      rotation: 0
    },
    mapping: {
      enabled: false,
      portCount: 4,
      modulesPerPort: 50,
      snake: true,
      direction: "horizontal",
      startingCorner: "topLeft"
    },
    routing: {
      enabled: true,
      showLabels: true,
      routes: []
    },
    power: {
      enabled: true,
      showLabels: true,
      showSupplyBadges: true,
      defaultSuppliesPerCabinet: 1,
      cabinetSupplies: {},
      routes: []
    },
    display: {
      showGrid: true,
      showNumbers: true,
      moduleTextColor: "#e2e8f0",
      showCabinets: true,
      showDataPaths: false,
      showDimensions: true,
      showCoordinates: false
    },
    modules: [],
    legend: {
      ports: defaultPortColors,
      statuses: statusColors
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return {
    ...project,
    modules: generateModules(project)
  };
}

export function generateModules(project: Pick<LedWallProject, "wall" | "module" | "numbering">): LedModule[] {
  const { columns, rows } = calculateModuleCount(project.wall, project.module);
  const modules: LedModule[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const position = calculateModulePosition(row, column, project.module);
      modules.push({
        id: `${row}-${column}`,
        row,
        column,
        number: generateNumbering(row, column, rows, columns, project.numbering),
        x: position.x,
        y: position.y,
        width: project.module.width,
        height: project.module.height,
        pixelWidth: project.module.pixelWidth,
        pixelHeight: project.module.pixelHeight,
        status: "installed",
        enabled: true,
        color: statusColors.installed,
        port: null
      });
    }
  }

  return modules;
}

export function regenerateModuleGeometry(project: LedWallProject): LedWallProject {
  const previous = new Map(project.modules.map((module) => [module.id, module]));
  const modules = generateModules(project).map((module) => {
    const existing = previous.get(module.id);
    return existing
      ? {
          ...module,
          status: existing.status,
          enabled: existing.enabled,
          color: existing.color,
          port: existing.port,
          customLabel: existing.customLabel
        }
      : module;
  });

  return {
    ...project,
    modules,
    updatedAt: new Date().toISOString()
  };
}

export function serializeProject(project: LedWallProject) {
  return JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2);
}

export function parseProject(json: string): LedWallProject {
  const parsed = JSON.parse(json) as LedWallProject;
  if (!parsed.version || !parsed.wall || !parsed.module || !Array.isArray(parsed.modules)) {
    throw new Error("Invalid LED wall project file.");
  }
  const parsedPower = (parsed as { power?: Partial<LedWallProject["power"]> }).power;
  const parsedDisplay = (parsed as { display?: Partial<LedWallProject["display"]> }).display;
  const parsedRouting = (parsed as { routing?: Partial<LedWallProject["routing"]> }).routing;
  return {
    ...parsed,
    display: {
      showGrid: true,
      showNumbers: true,
      moduleTextColor: "#e2e8f0",
      showCabinets: true,
      showDataPaths: false,
      showDimensions: true,
      showCoordinates: false,
      ...parsedDisplay
    },
    routing: {
      enabled: true,
      showLabels: true,
      routes: [],
      ...parsedRouting,
      routes: (parsedRouting?.routes ?? []).map((route) => ({
        ...route,
        labelColor: route.labelColor ?? "#e0f2fe"
      }))
    },
    power: {
      enabled: true,
      showLabels: true,
      showSupplyBadges: true,
      defaultSuppliesPerCabinet: 1,
      cabinetSupplies: {},
      routes: [],
      ...parsedPower,
      routes: (parsedPower?.routes ?? []).map((route) => ({
        ...route,
        labelColor: route.labelColor ?? "#fff7ed"
      }))
    }
  };
}
