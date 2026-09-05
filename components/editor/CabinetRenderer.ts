import type { Cabinet } from "@/types/project";

export function drawCabinet(ctx: CanvasRenderingContext2D, cabinet: Cabinet, zoom: number) {
  ctx.save();
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = Math.max(4 / zoom, 5);
  ctx.setLineDash([Math.max(18 / zoom, 18), Math.max(10 / zoom, 10)]);
  ctx.strokeRect(cabinet.x, cabinet.y, cabinet.width, cabinet.height);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(248, 250, 252, 0.86)";
  ctx.font = `${Math.max(36, Math.min(cabinet.height * 0.14, 80))}px ui-monospace, monospace`;
  ctx.fillText(`CAB ${cabinet.index}`, cabinet.x + 22, cabinet.y + 52);
  if (cabinet.rotation !== 0) {
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`${cabinet.rotation}deg`, cabinet.x + 22, cabinet.y + 100);
  }
  ctx.restore();
}
