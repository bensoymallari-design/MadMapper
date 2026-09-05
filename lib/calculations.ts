import type {
  Cabinet,
  CabinetSettings,
  LayoutMetrics,
  LedModule,
  ModuleSettings,
  ValidationWarning,
  WallSettings
} from "@/types/project";

export function calculateModuleCount(wall: WallSettings, module: ModuleSettings) {
  if (module.width <= 0 || module.height <= 0 || wall.width <= 0 || wall.height <= 0) {
    return {
      columns: 0,
      rows: 0,
      modulesWideExact: 0,
      modulesHighExact: 0,
      partialWidth: 0,
      partialHeight: 0
    };
  }

  const modulesWideExact = wall.width / module.width;
  const modulesHighExact = wall.height / module.height;
  const columns = Math.ceil(modulesWideExact);
  const rows = Math.ceil(modulesHighExact);

  return {
    columns,
    rows,
    modulesWideExact,
    modulesHighExact,
    partialWidth: wall.width - Math.floor(modulesWideExact) * module.width,
    partialHeight: wall.height - Math.floor(modulesHighExact) * module.height
  };
}

export function calculateTotalModules(columns: number, rows: number) {
  return columns * rows;
}

export function calculateWallResolution(columns: number, rows: number, module: ModuleSettings) {
  return {
    wallPixelWidth: columns * module.pixelWidth,
    wallPixelHeight: rows * module.pixelHeight,
    totalPixels: columns * module.pixelWidth * rows * module.pixelHeight
  };
}

export function calculateModulePosition(row: number, column: number, module: ModuleSettings) {
  return {
    x: column * module.width,
    y: row * module.height
  };
}

export function calculateLayoutMetrics(
  wall: WallSettings,
  module: ModuleSettings,
  modules: LedModule[] = []
): LayoutMetrics {
  const count = calculateModuleCount(wall, module);
  const resolution = calculateWallResolution(count.columns, count.rows, module);
  const activeModules = modules.length
    ? modules.filter((item) => item.enabled && item.status !== "unused").length
    : calculateTotalModules(count.columns, count.rows);

  return {
    ...count,
    ...resolution,
    totalModules: calculateTotalModules(count.columns, count.rows),
    activeModules
  };
}

export function calculateCabinetLayout(
  wall: WallSettings,
  module: ModuleSettings,
  cabinet: CabinetSettings
): Cabinet[] {
  if (!cabinet.enabled || cabinet.width <= 0 || cabinet.height <= 0) {
    return [];
  }

  const modulesWide = Math.max(1, Math.round(cabinet.width / module.width));
  const modulesHigh = Math.max(1, Math.round(cabinet.height / module.height));
  const { columns, rows } = calculateModuleCount(wall, module);
  const cabinetColumns = Math.ceil(columns / modulesWide);
  const cabinetRows = Math.ceil(rows / modulesHigh);
  const cabinets: Cabinet[] = [];

  for (let row = 0; row < cabinetRows; row += 1) {
    for (let column = 0; column < cabinetColumns; column += 1) {
      const index = row * cabinetColumns + column + 1;
      cabinets.push({
        id: `cabinet-${row}-${column}`,
        index,
        row,
        column,
        x: column * modulesWide * module.width,
        y: row * modulesHigh * module.height,
        width: Math.min(modulesWide, columns - column * modulesWide) * module.width,
        height: Math.min(modulesHigh, rows - row * modulesHigh) * module.height,
        modulesWide,
        modulesHigh,
        rotation: cabinet.rotation
      });
    }
  }

  return cabinets;
}

export function validateDimensions(wall: WallSettings, module: ModuleSettings): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (wall.width <= 0 || wall.height <= 0) {
    warnings.push({
      id: "empty-wall",
      severity: "error",
      message: "Wall dimensions must be greater than zero."
    });
  }

  if (module.width <= 0 || module.height <= 0) {
    warnings.push({
      id: "invalid-module-size",
      severity: "error",
      message: "Module dimensions must be greater than zero."
    });
  }

  if (module.pixelWidth <= 0 || module.pixelHeight <= 0) {
    warnings.push({
      id: "invalid-pixel-resolution",
      severity: "error",
      message: "Module pixel resolution must be greater than zero."
    });
  }

  if (wall.width > 0 && module.width > 0 && wall.width % module.width !== 0) {
    warnings.push({
      id: "partial-width",
      severity: "warning",
      message: "Warning: wall width is not an exact multiple of module width.",
      action: "keepPartial"
    });
  }

  if (wall.height > 0 && module.height > 0 && wall.height % module.height !== 0) {
    warnings.push({
      id: "partial-height",
      severity: "warning",
      message: "Warning: wall height is not an exact multiple of module height.",
      action: "keepPartial"
    });
  }

  return warnings;
}
