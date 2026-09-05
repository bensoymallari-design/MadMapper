import type { LedModule } from "@/types/project";

export interface CanvasRenderOptions {
  showNumbers: boolean;
  showGrid: boolean;
  selectedIds: Set<string>;
  zoom: number;
}

export function drawModule(ctx: CanvasRenderingContext2D, module: LedModule, options: CanvasRenderOptions) {
  const disabled = !module.enabled || module.status === "unused";
  ctx.globalAlpha = disabled ? 0.32 : 1;
  ctx.fillStyle = disabled ? "#111827" : module.color;
  ctx.fillRect(module.x, module.y, module.width, module.height);
  ctx.globalAlpha = 1;

  if (options.showGrid) {
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = Math.max(1 / options.zoom, 0.8);
    ctx.strokeRect(module.x, module.y, module.width, module.height);
  }

  if (options.showNumbers && options.zoom > 0.035 && module.enabled) {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(28, Math.min(module.height * 0.28, 70))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(module.customLabel || module.number, module.x + module.width / 2, module.y + module.height / 2);
  }

  if (options.selectedIds.has(module.id)) {
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = Math.max(5 / options.zoom, 6);
    ctx.strokeRect(module.x + 2, module.y + 2, module.width - 4, module.height - 4);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = Math.max(2 / options.zoom, 2);
    ctx.strokeRect(module.x + 8, module.y + 8, module.width - 16, module.height - 16);
  }
}
