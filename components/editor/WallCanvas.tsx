"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateCabinetLayout, calculateLayoutMetrics } from "@/lib/calculations";
import { normalizeRect, rectsIntersect, type Point, type Rect } from "@/lib/geometry";
import { generatePortMapping } from "@/lib/mapping";
import { useEditorStore } from "@/store/editorStore";
import { drawCabinet } from "./CabinetRenderer";
import { drawModule } from "./ModuleRenderer";

export function WallCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<Point | null>(null);
  const lastPointer = useRef<Point | null>(null);
  const hasDragged = useRef(false);
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const [cursorWorld, setCursorWorld] = useState<Point>({ x: 0, y: 0 });

  const {
    project,
    selectedModuleIds,
    activeTool,
    view,
    setView,
    selectModule,
    selectModules,
    clearSelection
  } = useEditorStore();

  const metrics = useMemo(
    () => calculateLayoutMetrics(project.wall, project.module, project.modules),
    [project.wall, project.module, project.modules]
  );

  const cabinets = useMemo(
    () => calculateCabinetLayout(project.wall, project.module, project.cabinet),
    [project.wall, project.module, project.cabinet]
  );

  const mapped = useMemo(
    () => generatePortMapping(project.modules, metrics.rows, metrics.columns, project.mapping, project.legend.ports),
    [project.modules, metrics.rows, metrics.columns, project.mapping, project.legend.ports]
  );

  const renderModules = project.mapping.enabled && project.display.showDataPaths ? mapped.modules : project.modules;

  const fitWall = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const padding = 72;
    const zoom = Math.min(
      (canvas.clientWidth - padding) / Math.max(project.wall.width, 1),
      (canvas.clientHeight - padding) / Math.max(project.wall.height, 1)
    );
    setView({
      zoom: Math.max(0.02, zoom),
      offsetX: (canvas.clientWidth - project.wall.width * zoom) / 2,
      offsetY: (canvas.clientHeight - project.wall.height * zoom) / 2
    });
  }, [project.wall.height, project.wall.width, setView]);

  useEffect(() => {
    const handler = () => fitWall();
    window.addEventListener("led-wall-fit", handler);
    return () => window.removeEventListener("led-wall-fit", handler);
  }, [fitWall]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      render();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    resize();
    return () => observer.disconnect();
  });

  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);
    drawBackground(ctx, width, height);

    ctx.save();
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.zoom, view.zoom);

    drawDimensionLines(ctx, project.wall.width, project.wall.height, project.wall.unit, project.display.showDimensions, view.zoom);
    ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
    ctx.fillRect(0, 0, project.wall.width, project.wall.height);

    const selected = new Set(selectedModuleIds);
    renderModules.forEach((module) => {
      if (!isVisible(module.x, module.y, module.width, module.height, view, width, height)) return;
      drawModule(ctx, module, {
        showGrid: project.display.showGrid,
        showNumbers: project.display.showNumbers,
        selectedIds: selected,
        zoom: view.zoom
      });
    });

    if (project.display.showCabinets) {
      cabinets.forEach((cabinet) => drawCabinet(ctx, cabinet, view.zoom));
    }

    if (project.display.showDataPaths && project.mapping.enabled) {
      drawDataPaths(ctx, mapped, renderModules, view.zoom);
    }

    if (selectionRect) {
      ctx.strokeStyle = "#38bdf8";
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.lineWidth = Math.max(2 / view.zoom, 2);
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    }

    ctx.restore();

    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.fillRect(14, height - 42, 260, 28);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`X ${cursorWorld.x.toFixed(0)} ${project.wall.unit}  Y ${cursorWorld.y.toFixed(0)} ${project.wall.unit}`, 26, height - 24);
  }

  useEffect(() => {
    render();
  });

  function screenToWorld(point: Point): Point {
    return {
      x: (point.x - view.offsetX) / view.zoom,
      y: (point.y - view.offsetY) / view.zoom
    };
  }

  function getPoint(
    event: React.PointerEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>
  ): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function hitTest(world: Point) {
    const column = Math.floor(world.x / project.module.width);
    const row = Math.floor(world.y / project.module.height);
    return project.modules.find((module) => module.row === row && module.column === column && module.enabled);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    dragStart.current = point;
    lastPointer.current = point;
    hasDragged.current = false;
    if (activeTool === "select") {
      setSelectionRect(null);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getPoint(event);
    setCursorWorld(screenToWorld(point));
    const previous = lastPointer.current;
    if (!dragStart.current || !previous) return;

    const delta = {
      x: point.x - previous.x,
      y: point.y - previous.y
    };
    if (Math.abs(point.x - dragStart.current.x) > 3 || Math.abs(point.y - dragStart.current.y) > 3) {
      hasDragged.current = true;
    }

    if (activeTool === "pan" || event.buttons === 4 || event.altKey) {
      setView({ offsetX: view.offsetX + delta.x, offsetY: view.offsetY + delta.y });
    } else if (activeTool === "select" && hasDragged.current) {
      setSelectionRect(normalizeRect(screenToWorld(dragStart.current), screenToWorld(point)));
    }
    lastPointer.current = point;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getPoint(event);
    const world = screenToWorld(point);

    if (activeTool === "select") {
      if (selectionRect && hasDragged.current) {
        const selected = project.modules
          .filter((module) => module.enabled && rectsIntersect(selectionRect, module))
          .map((module) => module.id);
        selectModules(selected, event.ctrlKey || event.metaKey);
      } else {
        const hit = hitTest(world);
        if (hit) selectModule(hit.id, event.ctrlKey || event.metaKey);
        else clearSelection();
      }
    }

    setSelectionRect(null);
    dragStart.current = null;
    lastPointer.current = null;
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const point = getPoint(event);
    const worldBefore = screenToWorld(point);
    const nextZoom = Math.min(2.5, Math.max(0.015, view.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    setView({
      zoom: nextZoom,
      offsetX: point.x - worldBefore.x * nextZoom,
      offsetY: point.y - worldBefore.y * nextZoom
    });
  }

  return (
    <div ref={wrapperRef} className="relative h-full min-h-0 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 shadow-2xl">
      <canvas
        ref={canvasRef}
        className={activeTool === "pan" ? "h-full w-full cursor-grab" : "h-full w-full cursor-crosshair"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
      <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
        <div className="font-semibold text-sky-100">Canvas</div>
        <div>Wheel zoom - Alt drag pan - Drag select</div>
      </div>
    </div>
  );
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = "rgba(30, 41, 59, 0.55)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawDimensionLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  unit: string,
  enabled: boolean,
  zoom: number
) {
  if (!enabled) return;
  const offset = Math.max(280 / zoom, 260);
  ctx.strokeStyle = "#94a3b8";
  ctx.fillStyle = "#cbd5e1";
  ctx.lineWidth = Math.max(2 / zoom, 2);
  ctx.font = `${Math.max(40 / zoom, 36)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.beginPath();
  ctx.moveTo(0, -offset);
  ctx.lineTo(width, -offset);
  ctx.moveTo(-offset, 0);
  ctx.lineTo(-offset, height);
  ctx.stroke();
  ctx.fillText(`${width} ${unit}`, width / 2, -offset - 32 / zoom);
  ctx.save();
  ctx.translate(-offset - 42 / zoom, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${height} ${unit}`, 0, 0);
  ctx.restore();
}

function drawDataPaths(
  ctx: CanvasRenderingContext2D,
  mapped: ReturnType<typeof generatePortMapping>,
  modules: ReturnType<typeof generatePortMapping>["modules"],
  zoom: number
) {
  const byId = new Map(modules.map((module) => [module.id, module]));
  mapped.paths.forEach((path) => {
    ctx.strokeStyle = path.color;
    ctx.fillStyle = path.color;
    ctx.lineWidth = Math.max(7 / zoom, 8);
    path.modules.slice(0, -1).forEach((id, index) => {
      const current = byId.get(id);
      const next = byId.get(path.modules[index + 1]);
      if (!current || !next) return;
      const start = { x: current.x + current.width / 2, y: current.y + current.height / 2 };
      const end = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      drawArrowHead(ctx, start, end, zoom);
    });
  });
}

function drawArrowHead(ctx: CanvasRenderingContext2D, start: Point, end: Point, zoom: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = Math.max(24 / zoom, 24);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function isVisible(x: number, y: number, width: number, height: number, view: { zoom: number; offsetX: number; offsetY: number }, canvasWidth: number, canvasHeight: number) {
  const screenX = x * view.zoom + view.offsetX;
  const screenY = y * view.zoom + view.offsetY;
  const screenWidth = width * view.zoom;
  const screenHeight = height * view.zoom;
  return screenX + screenWidth >= 0 && screenY + screenHeight >= 0 && screenX <= canvasWidth && screenY <= canvasHeight;
}
