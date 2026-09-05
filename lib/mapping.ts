import type { LedModule, MappingSettings, PortPath } from "@/types/project";

export function generatePortMapping(
  modules: LedModule[],
  rows: number,
  columns: number,
  settings: MappingSettings,
  portColors: Record<number, string>
): { modules: LedModule[]; paths: PortPath[] } {
  if (!settings.enabled || settings.portCount <= 0 || settings.modulesPerPort <= 0) {
    return {
      modules: modules.map((module) => ({ ...module, port: null })),
      paths: []
    };
  }

  const ordered = orderModules(modules.filter((module) => module.enabled), rows, columns, settings);
  const paths: PortPath[] = Array.from({ length: settings.portCount }, (_, index) => ({
    port: index + 1,
    color: portColors[index + 1] ?? "#38bdf8",
    modules: []
  }));

  const updated = new Map<string, LedModule>();
  modules.forEach((module) => updated.set(module.id, { ...module, port: null }));

  ordered.forEach((module, index) => {
    const port = Math.floor(index / settings.modulesPerPort) % settings.portCount;
    const portNumber = port + 1;
    const next = { ...module, port: portNumber, color: portColors[portNumber] ?? module.color };
    updated.set(module.id, next);
    paths[port].modules.push(module.id);
  });

  return {
    modules: Array.from(updated.values()).sort((a, b) => a.row - b.row || a.column - b.column),
    paths
  };
}

function orderModules(
  modules: LedModule[],
  rows: number,
  columns: number,
  settings: MappingSettings
) {
  const moduleByCoordinate = new Map(modules.map((module) => [`${module.row}-${module.column}`, module]));
  const rowOrder = range(rows);
  const columnOrder = range(columns);

  if (settings.startingCorner.includes("bottom")) rowOrder.reverse();
  if (settings.startingCorner.includes("Right")) columnOrder.reverse();

  const ordered: LedModule[] = [];

  if (settings.direction === "vertical") {
    columnOrder.forEach((column, columnIndex) => {
      const rowsForColumn = settings.snake && columnIndex % 2 === 1 ? [...rowOrder].reverse() : rowOrder;
      rowsForColumn.forEach((row) => {
        const ledModule = moduleByCoordinate.get(`${row}-${column}`);
        if (ledModule) ordered.push(ledModule);
      });
    });
    return ordered;
  }

  rowOrder.forEach((row, rowIndex) => {
    const columnsForRow = settings.snake && rowIndex % 2 === 1 ? [...columnOrder].reverse() : columnOrder;
    columnsForRow.forEach((column) => {
      const ledModule = moduleByCoordinate.get(`${row}-${column}`);
      if (ledModule) ordered.push(ledModule);
    });
  });

  return ordered;
}

function range(length: number) {
  return Array.from({ length }, (_, index) => index);
}
