import type { LedModule, NumberingSettings } from "@/types/project";

export function generateNumbering(
  row: number,
  column: number,
  rows: number,
  columns: number,
  settings: NumberingSettings
) {
  const normalized = normalizeCoordinates(row, column, rows, columns, settings);

  if (settings.mode === "custom") {
    return `${settings.prefix}${String(settings.startNumber + row * columns + column).padStart(settings.pad, "0")}`;
  }

  if (settings.mode === "vertical") {
    const sequence = normalized.column * rows + normalized.row + settings.startNumber;
    return `${settings.prefix}${String(sequence).padStart(settings.pad, "0")}`;
  }

  if (settings.mode === "reverseRow") {
    return formatPair(normalized.row, columns - 1 - normalized.column, settings);
  }

  if (settings.mode === "reverseColumn") {
    return formatPair(rows - 1 - normalized.row, normalized.column, settings);
  }

  if (settings.mode === "snake" || settings.snake) {
    const snakeColumn = normalized.row % 2 === 0 ? normalized.column : columns - 1 - normalized.column;
    return formatPair(normalized.row, snakeColumn, settings);
  }

  return formatPair(normalized.row, normalized.column, settings);
}

export function generateSnakeNumbering(
  modules: LedModule[],
  rows: number,
  columns: number,
  settings: NumberingSettings
) {
  return modules.map((module) => ({
    ...module,
    number: generateNumbering(module.row, module.column, rows, columns, {
      ...settings,
      snake: true,
      mode: "snake"
    })
  }));
}

function normalizeCoordinates(
  row: number,
  column: number,
  rows: number,
  columns: number,
  settings: NumberingSettings
) {
  let normalizedRow = settings.verticalDirection === "topToBottom" ? row : rows - 1 - row;
  let normalizedColumn = settings.horizontalDirection === "leftToRight" ? column : columns - 1 - column;

  if (settings.startingCorner === "topRight") {
    normalizedColumn = columns - 1 - normalizedColumn;
  }
  if (settings.startingCorner === "bottomLeft") {
    normalizedRow = rows - 1 - normalizedRow;
  }
  if (settings.startingCorner === "bottomRight") {
    normalizedRow = rows - 1 - normalizedRow;
    normalizedColumn = columns - 1 - normalizedColumn;
  }

  return { row: normalizedRow, column: normalizedColumn };
}

function formatPair(row: number, column: number, settings: NumberingSettings) {
  const left = String(row + settings.startNumber).padStart(settings.pad, "0");
  const right = String(column + settings.startNumber).padStart(settings.pad, "0");
  return `${settings.prefix}${left}${settings.separator}${right}`;
}
