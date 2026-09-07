import type { Cabinet, CabinetSequenceDirection, LedModule } from "@/types/project";

export interface ParsedLabelRange {
  prefix: string;
  start: number;
  end: number;
  pad: number;
}

export function parseLabelRange(input: string): ParsedLabelRange {
  const trimmed = input.trim();
  const match = trimmed.match(/^([A-Za-z_-]*)(\d+)\s*-\s*([A-Za-z_-]*)(\d+)$/);

  if (!match) {
    throw new Error("Use a range like JH1-JH10.");
  }

  const [, startPrefix, startText, endPrefix, endText] = match;
  const prefix = endPrefix && endPrefix !== startPrefix ? startPrefix : startPrefix;
  const start = Number(startText);
  const end = Number(endText);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("Label range end must be greater than or equal to the start.");
  }

  return {
    prefix,
    start,
    end,
    pad: startText.length
  };
}

export function buildLabel(range: ParsedLabelRange, index: number) {
  const next = range.start + index;
  if (next > range.end) return null;
  return `${range.prefix}${String(next).padStart(range.pad, "0")}`;
}

export function orderModulesForCabinet(modules: LedModule[], direction: CabinetSequenceDirection) {
  const ordered = [...modules];

  if (direction === "leftToRight") {
    return ordered.sort((a, b) => a.row - b.row || a.column - b.column);
  }

  if (direction === "rightToLeft") {
    return ordered.sort((a, b) => a.row - b.row || b.column - a.column);
  }

  if (direction === "bottomToTop") {
    return ordered.sort((a, b) => a.column - b.column || b.row - a.row);
  }

  return ordered.sort((a, b) => a.column - b.column || a.row - b.row);
}

export function getModulesInCabinet(cabinet: Cabinet, modules: LedModule[]) {
  return modules.filter(
    (module) =>
      module.x >= cabinet.x &&
      module.y >= cabinet.y &&
      module.x < cabinet.x + cabinet.width &&
      module.y < cabinet.y + cabinet.height
  );
}

export function findCabinetForModule(cabinets: Cabinet[], module: LedModule | undefined) {
  if (!module) return null;
  return (
    cabinets.find(
      (cabinet) =>
        module.x >= cabinet.x &&
        module.y >= cabinet.y &&
        module.x < cabinet.x + cabinet.width &&
        module.y < cabinet.y + cabinet.height
    ) ?? null
  );
}
