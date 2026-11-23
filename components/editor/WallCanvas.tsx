"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawAnnotation, drawAnnotations, formatAcLoopLabel, hitTestAnnotations } from "@/lib/annotations";
import { calculateCabinetLayout, calculateLayoutMetrics } from "@/lib/calculations";
import { getRainbowModuleColor } from "@/lib/colors";
import { normalizeRect, rectsIntersect, type Point, type Rect } from "@/lib/geometry";
import { generatePortMapping } from "@/lib/mapping";
import {
  alignmentTargets,
  placedScale,
  placedSize,
  resizePlaced,
  snapTranslation,
  type ResizeCorner,
  type SnapGuides
} from "@/lib/placement";
import { pageFrames, sheetBounds } from "@/lib/sheet";
import { useEditorStore } from "@/store/editorStore";
import type { CanvasAnnotation, CanvasImage, LedWallProject, PlacedProject } from "@/types/project";
import { drawCabinet } from "./CabinetRenderer";
import { drawModule } from "./ModuleRenderer";

export function WallCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<Point | null>(null);
  const lastPointer = useRef<Point | null>(null);
  const hasDragged = useRef(false);
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const [draftShape, setDraftShape] = useState<Pick<CanvasAnnotation, "x" | "y" | "width" | "height"> | null>(null);
  const draftShapeRef = useRef<Pick<CanvasAnnotation, "x" | "y" | "width" | "height"> | null>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const renderRef = useRef<() => void>(() => undefined);
  const [cursorWorld, setCursorWorld] = useState<Point>({ x: 0, y: 0 });
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({ xs: [], ys: [] });
  const objectDrag = useRef<{
    kind: "annotation" | "image" | "placed" | "placed-resize";
    id: string;
    originX: number;
    originY: number;
    corner?: ResizeCorner;
    startWorld: Point;
    pushedHistory: boolean;
  } | null>(null);

  const {
    project,
    selectedModuleIds,
    activeTool,
    view,
    setView,
    selectModule,
    selectModules,
    clearSelection,
    addCabinetToActiveRoute,
    activeRouteId,
    addCabinetToActivePowerLoop,
    activePowerRouteId,
    selectedPowerCabinetId,
    selectPowerCabinet,
    selectedAnnotationId,
    selectedImageId,
    selectedPlacedId,
    shapeKind,
    selectedColor,
    selectAnnotation,
    selectImage,
    selectPlaced,
    addAnnotation,
    updateAnnotation,
    updateImage,
    updatePlacedProject,
    pushHistorySnapshot
  } = useEditorStore();

  const cabinets = useMemo(
    () => calculateCabinetLayout(project.wall, project.module, project.cabinet),
    [project.wall, project.module, project.cabinet]
  );

  const routing = project.routing ?? { enabled: false, showLabels: true, routes: [] };
  const power = project.power ?? {
    enabled: false,
    showLabels: true,
    showSupplyBadges: false,
    defaultSuppliesPerCabinet: 1,
    cabinetSupplies: {},
    routes: []
  };

  const fitWall = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const padding = 72;
    const bounds = sheetBounds(project);
    const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const zoom = Math.min((canvas.clientWidth - padding) / boundsWidth, (canvas.clientHeight - padding) / boundsHeight);
    setView({
      zoom: Math.max(0.002, Math.min(2.5, zoom)),
      offsetX: (canvas.clientWidth - boundsWidth * zoom) / 2 - bounds.minX * zoom,
      offsetY: (canvas.clientHeight - boundsHeight * zoom) / 2 - bounds.minY * zoom
    });
  }, [project, setView]);

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
    renderRef.current = render;
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

    if (project.sheet.showGuides) drawPageGuides(ctx, pageFrames(project), view.zoom);

    ctx.save();
    ctx.translate(project.sheet.wallX, project.sheet.wallY);
    paintWall(ctx, project, view.zoom, new Set(selectedModuleIds), activeRouteId, activePowerRouteId, selectedPowerCabinetId);
    ctx.restore();

    project.placedProjects.forEach((placed) => {
      const scale = placedScale(placed);
      ctx.save();
      ctx.translate(placed.x, placed.y);
      ctx.scale(scale, scale);
      paintWall(ctx, placed.project, view.zoom * scale, new Set(), null, null, null);
      drawAnnotations(ctx, placed.project.annotations ?? [], null, view.zoom * scale);
      ctx.restore();
      if (placed.id === selectedPlacedId) {
        const size = placedSize(placed);
        strokeWorldRect(ctx, placed.x, placed.y, size.width, size.height, view.zoom);
        drawResizeHandles(ctx, placed.x, placed.y, size.width, size.height, view.zoom);
      }
    });

    drawCanvasImages(ctx, project.images ?? [], selectedImageId, view.zoom, imageCache.current, () => renderRef.current());
    drawAnnotations(ctx, project.annotations ?? [], selectedAnnotationId, view.zoom);
    drawSnapGuides(ctx, snapGuides, pageFrames(project), view.zoom);

    if (draftShape && (draftShape.width !== 0 || draftShape.height !== 0)) {
      drawAnnotation(
        ctx,
        {
          id: "draft",
          kind: activeTool === "line" ? "line" : shapeKind,
          x: draftShape.x,
          y: draftShape.y,
          width: draftShape.width,
          height: draftShape.height,
          text: "",
          fontFamily: "Arial",
          fontSize: 48,
          color: selectedColor,
          fill: selectedColor,
          fillOpacity: activeTool === "line" || shapeKind === "line" ? 0 : 0.18,
          strokeWidth: Math.max(8, 2 / view.zoom)
        },
        false,
        view.zoom
      );
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

  function wallLocal(world: Point): Point {
    return { x: world.x - project.sheet.wallX, y: world.y - project.sheet.wallY };
  }

  function hitTest(world: Point) {
    const local = wallLocal(world);
    const column = Math.floor(local.x / project.module.width);
    const row = Math.floor(local.y / project.module.height);
    return project.modules.find((module) => module.row === row && module.column === column);
  }

  function hitTestCabinet(world: Point) {
    const local = wallLocal(world);
    return cabinets.find(
      (cabinet) =>
        local.x >= cabinet.x &&
        local.y >= cabinet.y &&
        local.x <= cabinet.x + cabinet.width &&
        local.y <= cabinet.y + cabinet.height
    );
  }

  function hitTestImage(world: Point) {
    return [...(project.images ?? [])].reverse().find(
      (image) => world.x >= image.x && world.y >= image.y && world.x <= image.x + image.width && world.y <= image.y + image.height
    );
  }

  function hitTestPlaced(world: Point) {
    return [...project.placedProjects].reverse().find((placed) => {
      const size = placedSize(placed);
      return world.x >= placed.x && world.y >= placed.y && world.x <= placed.x + size.width && world.y <= placed.y + size.height;
    });
  }

  function hitTestPlacedHandle(world: Point) {
    const reach = Math.max(14 / view.zoom, 8);
    const ordered = [...project.placedProjects].reverse();
    const selected = ordered.find((placed) => placed.id === selectedPlacedId);
    const candidates = selected ? [selected, ...ordered.filter((placed) => placed.id !== selected.id)] : ordered;
    for (const placed of candidates) {
      const size = placedSize(placed);
      const corners: Array<{ corner: ResizeCorner; x: number; y: number }> = [
        { corner: "nw", x: placed.x, y: placed.y },
        { corner: "ne", x: placed.x + size.width, y: placed.y },
        { corner: "sw", x: placed.x, y: placed.y + size.height },
        { corner: "se", x: placed.x + size.width, y: placed.y + size.height }
      ];
      const hit = corners.find((corner) => Math.abs(world.x - corner.x) <= reach && Math.abs(world.y - corner.y) <= reach);
      if (hit) return { placed, corner: hit.corner };
    }
    return null;
  }

  function resizeCursor(corner: ResizeCorner) {
    return corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize";
  }

  function anchorFor(placed: PlacedProject, corner: ResizeCorner) {
    const size = placedSize(placed);
    if (corner === "nw") return { x: placed.x + size.width, y: placed.y + size.height };
    if (corner === "ne") return { x: placed.x, y: placed.y + size.height };
    if (corner === "sw") return { x: placed.x + size.width, y: placed.y };
    return { x: placed.x, y: placed.y };
  }

  function updateDraftShape(next: Pick<CanvasAnnotation, "x" | "y" | "width" | "height"> | null) {
    draftShapeRef.current = next;
    setDraftShape(next);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    const world = screenToWorld(point);
    dragStart.current = point;
    lastPointer.current = point;
    hasDragged.current = false;
    objectDrag.current = null;

    if (activeTool === "select" || activeTool === "text") {
      const hit = hitTestAnnotations(project.annotations ?? [], world, view.zoom);
      if (hit) {
        selectAnnotation(hit.id);
        clearSelection();
        objectDrag.current = { kind: "annotation", id: hit.id, originX: hit.x, originY: hit.y, startWorld: world, pushedHistory: false };
        return;
      }
      const image = hitTestImage(world);
      if (image && activeTool === "select") {
        selectImage(image.id);
        objectDrag.current = { kind: "image", id: image.id, originX: image.x, originY: image.y, startWorld: world, pushedHistory: false };
        return;
      }
      const handle = activeTool === "select" ? hitTestPlacedHandle(world) : null;
      if (handle) {
        const anchor = anchorFor(handle.placed, handle.corner);
        selectPlaced(handle.placed.id);
        objectDrag.current = {
          kind: "placed-resize",
          id: handle.placed.id,
          originX: anchor.x,
          originY: anchor.y,
          corner: handle.corner,
          startWorld: world,
          pushedHistory: false
        };
        return;
      }
      const placed = hitTestPlaced(world);
      if (placed && activeTool === "select") {
        selectPlaced(placed.id);
        objectDrag.current = { kind: "placed", id: placed.id, originX: placed.x, originY: placed.y, startWorld: world, pushedHistory: false };
        return;
      }
      if (activeTool === "select") {
        selectAnnotation(null);
        selectImage(null);
        selectPlaced(null);
        setSelectionRect(null);
      }
    }

    if (activeTool === "shape" || activeTool === "line") {
      updateDraftShape({ x: world.x, y: world.y, width: 0, height: 0 });
    } else if (activeTool === "select") {
      setSelectionRect(null);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getPoint(event);
    const hoverWorld = screenToWorld(point);
    setCursorWorld(hoverWorld);
    const resizing = objectDrag.current?.kind === "placed-resize" ? objectDrag.current.corner : null;
    const hoverHandle = !resizing && activeTool === "select" ? hitTestPlacedHandle(hoverWorld) : null;
    if (canvasRef.current) {
      const corner = resizing ?? hoverHandle?.corner;
      canvasRef.current.style.cursor = corner ? resizeCursor(corner) : "";
    }
    const previous = lastPointer.current;
    if (!dragStart.current || !previous) return;

    const delta = {
      x: point.x - previous.x,
      y: point.y - previous.y
    };
    if (Math.abs(point.x - dragStart.current.x) > 3 || Math.abs(point.y - dragStart.current.y) > 3) {
      hasDragged.current = true;
    }

    if (objectDrag.current) {
      if (hasDragged.current) {
        const world = screenToWorld(point);
        const drag = objectDrag.current;
        if (!drag.pushedHistory) {
          pushHistorySnapshot();
          drag.pushedHistory = true;
        }
        const current = useEditorStore.getState().project;
        if (drag.kind === "placed-resize" && drag.corner) {
          const placed = current.placedProjects.find((item) => item.id === drag.id);
          if (placed) {
            const resized = resizePlaced({
              corner: drag.corner,
              anchorX: drag.originX,
              anchorY: drag.originY,
              wallWidth: placed.project.wall.width,
              wallHeight: placed.project.wall.height,
              pointerX: world.x,
              pointerY: world.y,
              targets: alignmentTargets(current, drag.id),
              threshold: Math.max(8, 14 / view.zoom)
            });
            setSnapGuides(resized.guides);
            updatePlacedProject(drag.id, { x: resized.x, y: resized.y, scale: resized.scale }, false);
          }
        } else if (drag.kind === "placed") {
          const placed = current.placedProjects.find((item) => item.id === drag.id);
          const raw = {
            x: drag.originX + (world.x - drag.startWorld.x),
            y: drag.originY + (world.y - drag.startWorld.y)
          };
          if (placed) {
            const size = placedSize(placed);
            const snapped = snapTranslation(raw.x, raw.y, size.width, size.height, alignmentTargets(current, drag.id), Math.max(8, 14 / view.zoom));
            setSnapGuides(snapped.guides);
            updatePlacedProject(drag.id, { x: snapped.x, y: snapped.y }, false);
          }
        } else {
          const next = {
            x: drag.originX + (world.x - drag.startWorld.x),
            y: drag.originY + (world.y - drag.startWorld.y)
          };
          if (drag.kind === "annotation") updateAnnotation(drag.id, next, false);
          else updateImage(drag.id, next, false);
        }
      }
      lastPointer.current = point;
      return;
    }

    if ((activeTool === "shape" || activeTool === "line") && dragStart.current) {
      const start = screenToWorld(dragStart.current);
      const world = screenToWorld(point);
      updateDraftShape({ x: start.x, y: start.y, width: world.x - start.x, height: world.y - start.y });
      return;
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

    if (objectDrag.current) {
      objectDrag.current = null;
      dragStart.current = null;
      lastPointer.current = null;
      hasDragged.current = false;
      setSnapGuides({ xs: [], ys: [] });
      return;
    }

    if (activeTool === "text" && !hasDragged.current) {
      const fontSize = Math.max(48, (project.module.height || 160) * 0.42);
      addAnnotation({
        kind: "text",
        x: world.x,
        y: world.y,
        width: fontSize * 2,
        height: fontSize * 1.25,
        text: "Text",
        fontFamily: "Arial",
        fontSize,
        color: "#f8fafc",
        fill: "#38bdf8",
        fillOpacity: 0,
        strokeWidth: 2
      });
      dragStart.current = null;
      lastPointer.current = null;
      hasDragged.current = false;
      return;
    }

    if (activeTool === "shape" || activeTool === "line") {
      const draft = draftShapeRef.current;
      const kind = activeTool === "line" ? "line" : shapeKind;
      updateDraftShape(null);
      if (draft && (Math.abs(draft.width) > 4 || Math.abs(draft.height) > 4)) {
        addAnnotation({
          kind,
          x: draft.x,
          y: draft.y,
          width: draft.width,
          height: draft.height,
          text: "",
          fontFamily: "Arial",
          fontSize: 48,
          color: selectedColor,
          fill: selectedColor,
          fillOpacity: kind === "line" ? 0 : 0.18,
          strokeWidth: Math.max(8, 2 / view.zoom)
        });
      }
      dragStart.current = null;
      lastPointer.current = null;
      hasDragged.current = false;
      return;
    }

    if (activeTool === "mapping" && routing.enabled && activeRouteId && !hasDragged.current) {
      const cabinet = hitTestCabinet(world);
      if (cabinet) {
        addCabinetToActiveRoute(cabinet.id);
      }
    } else if (activeTool === "power" && power.enabled && !hasDragged.current) {
      const cabinet = hitTestCabinet(world);
      selectPowerCabinet(cabinet?.id ?? null);
      if (cabinet && activePowerRouteId) {
        addCabinetToActivePowerLoop(cabinet.id);
      }
    } else if (activeTool === "select") {
      if (selectionRect && hasDragged.current) {
        const localRect = {
          x: selectionRect.x - project.sheet.wallX,
          y: selectionRect.y - project.sheet.wallY,
          width: selectionRect.width,
          height: selectionRect.height
        };
        const selected = project.modules
          .filter((module) => rectsIntersect(localRect, module))
          .map((module) => module.id);
        selectModules(selected, event.ctrlKey || event.metaKey);
      } else {
        const hit = hitTest(world);
        selectAnnotation(null);
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
        className={
          activeTool === "pan" ? "h-full w-full cursor-grab" : activeTool === "text" ? "h-full w-full cursor-text" : "h-full w-full cursor-crosshair"
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
      <div className="pointer-events-none absolute right-4 top-4 max-w-56 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
        <div className="font-semibold text-sky-100">Canvas</div>
        <div>
          {activeTool === "text"
            ? "Click anywhere to place text. Change the font and color in Annotations."
            : activeTool === "line"
              ? "Drag to draw a line. Change the color and thickness in Annotations."
            : activeTool === "shape"
              ? "Drag to draw the selected shape."
              : "Page borders show the PDF margin. Drag a project to move it, or a corner to resize. Edges snap into alignment."}
        </div>
      </div>
    </div>
  );
}

function paintWall(
  ctx: CanvasRenderingContext2D,
  source: LedWallProject,
  zoom: number,
  selectedIds: Set<string>,
  activeRouteId: string | null,
  activePowerRouteId: string | null,
  selectedPowerCabinetId: string | null
) {
  const metrics = calculateLayoutMetrics(source.wall, source.module, source.modules);
  const sourceCabinets = calculateCabinetLayout(source.wall, source.module, source.cabinet);
  const mapped = generatePortMapping(source.modules, metrics.rows, metrics.columns, source.mapping, source.legend.ports);
  const modules = source.mapping.enabled && source.display.showDataPaths ? mapped.modules : source.modules;
  const routing = source.routing ?? { enabled: false, showLabels: true, routes: [] };
  const power = source.power ?? {
    enabled: false,
    showLabels: true,
    showSupplyBadges: false,
    defaultSuppliesPerCabinet: 1,
    cabinetSupplies: {},
    routes: []
  };

  drawDimensionLines(ctx, source.wall.width, source.wall.height, source.wall.unit, source.display.showDimensions, zoom);
  ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
  ctx.fillRect(0, 0, source.wall.width, source.wall.height);
  modules.forEach((module) => {
    const displayModule = source.display.rainbowGradient ? { ...module, color: getRainbowModuleColor(module, source.wall) } : module;
    drawModule(ctx, displayModule, {
      showGrid: source.display.showGrid,
      showNumbers: source.display.showNumbers,
      selectedIds,
      labelColor: source.display.moduleTextColor ?? "#e2e8f0",
      zoom
    });
  });
  if (source.display.showCabinets) sourceCabinets.forEach((cabinet) => drawCabinet(ctx, cabinet, zoom));
  if (source.display.showDataPaths && source.mapping.enabled) drawDataPaths(ctx, mapped, modules, zoom);
  if (routing.enabled) drawReceivingCardRoutes(ctx, routing.routes, sourceCabinets, activeRouteId, routing.showLabels, zoom);
  if (power.enabled) {
    drawPowerLoopRoutes(ctx, power.routes, sourceCabinets, activePowerRouteId, power.showLabels, zoom);
    drawPowerSupplyBadges(
      ctx,
      sourceCabinets,
      power.cabinetSupplies,
      power.defaultSuppliesPerCabinet,
      selectedPowerCabinetId,
      power.showSupplyBadges,
      zoom
    );
  }
  ctx.save();
  ctx.fillStyle = "#e0f2fe";
  ctx.font = `${Math.max(18 / zoom, 16)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(source.projectName || "Untitled LED Wall", 0, -8 / zoom);
  ctx.restore();
}

function drawPageGuides(ctx: CanvasRenderingContext2D, frames: ReturnType<typeof pageFrames>, zoom: number) {
  frames.forEach((frame) => {
    ctx.save();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = Math.max(2.4 / zoom, 1.6);
    ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = Math.max(1.4 / zoom, 1);
    ctx.strokeRect(frame.x + frame.margin, frame.y + frame.margin, Math.max(frame.width - frame.margin * 2, 1), Math.max(frame.height - frame.margin * 2, 1));
    ctx.fillStyle = "#e0f2fe";
    ctx.font = `${Math.max(16 / zoom, 14)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(frame.label, frame.x + 10 / zoom, frame.y + 8 / zoom);
    ctx.restore();
  });
}

function drawResizeHandles(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, zoom: number) {
  const size = Math.max(10 / zoom, 7);
  const corners = [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height]
  ];
  ctx.save();
  corners.forEach(([cx, cy]) => {
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = Math.max(1.5 / zoom, 1);
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
  });
  ctx.restore();
}

function drawSnapGuides(ctx: CanvasRenderingContext2D, guides: SnapGuides, frames: ReturnType<typeof pageFrames>, zoom: number) {
  if (guides.xs.length === 0 && guides.ys.length === 0) return;
  const bounds = frames.reduce(
    (box, frame) => ({
      minX: Math.min(box.minX, frame.x),
      minY: Math.min(box.minY, frame.y),
      maxX: Math.max(box.maxX, frame.x + frame.width),
      maxY: Math.max(box.maxY, frame.y + frame.height)
    }),
    { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  );
  ctx.save();
  ctx.strokeStyle = "rgba(125, 211, 252, 0.95)";
  ctx.lineWidth = Math.max(1.5 / zoom, 1);
  ctx.setLineDash([10 / zoom, 7 / zoom]);
  guides.xs.forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, bounds.minY);
    ctx.lineTo(x, bounds.maxY);
    ctx.stroke();
  });
  guides.ys.forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(bounds.minX, y);
    ctx.lineTo(bounds.maxX, y);
    ctx.stroke();
  });
  ctx.restore();
}

function strokeWorldRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, zoom: number) {
  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = Math.max(3 / zoom, 2);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function drawCanvasImages(
  ctx: CanvasRenderingContext2D,
  images: CanvasImage[],
  selectedId: string | null,
  zoom: number,
  cache: Map<string, HTMLImageElement>,
  onLoad: () => void
) {
  images.forEach((image) => {
    let element = cache.get(image.id);
    if (!element || element.src !== image.dataUrl) {
      element = new Image();
      element.onload = onLoad;
      element.src = image.dataUrl;
      cache.set(image.id, element);
    }
    if (element.complete && element.naturalWidth > 0) ctx.drawImage(element, image.x, image.y, image.width, image.height);
    else {
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.fillRect(image.x, image.y, image.width, image.height);
    }
    if (image.id === selectedId) strokeWorldRect(ctx, image.x, image.y, image.width, image.height, zoom);
  });
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
    ctx.lineWidth = px(zoom, 1.6);
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

function drawReceivingCardRoutes(
  ctx: CanvasRenderingContext2D,
  routes: {
    id: string;
    name: string;
    color: string;
    labelColor?: string;
    cabinetIds: string[];
    startLabel: string;
    endLabel: string;
    backupLabel: string;
  }[],
  cabinets: { id: string; index: number; x: number; y: number; width: number; height: number }[],
  activeRouteId: string | null,
  showLabels: boolean,
  zoom: number
) {
  const byId = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]));

  routes.forEach((route) => {
    const routeCabinets = route.cabinetIds
      .map((id) => byId.get(id))
      .filter((cabinet): cabinet is { id: string; index: number; x: number; y: number; width: number; height: number } =>
        Boolean(cabinet)
      );
    if (routeCabinets.length === 0) return;

    ctx.save();
    ctx.strokeStyle = route.color;
    ctx.fillStyle = route.color;
    ctx.lineWidth = px(zoom, 1.7);
    ctx.setLineDash(route.id === activeRouteId ? [px(zoom, 8), px(zoom, 4)] : []);
    const markerRadius = px(zoom, 8);

    routeCabinets.slice(0, -1).forEach((cabinet, index) => {
      const next = routeCabinets[index + 1];
      if (!cabinet || !next) return;
      const trimmed = shortenSegment(cabinetCenter(cabinet), cabinetCenter(next), markerRadius, markerRadius + px(zoom, 2));
      ctx.beginPath();
      ctx.moveTo(trimmed.start.x, trimmed.start.y);
      ctx.lineTo(trimmed.end.x, trimmed.end.y);
      ctx.stroke();
      drawArrowHead(ctx, trimmed.start, trimmed.end, zoom);
    });

    routeCabinets.forEach((cabinet, index) => {
      if (!cabinet) return;
      const center = cabinetCenter(cabinet);
      ctx.beginPath();
      ctx.arc(center.x, center.y, markerRadius, 0, Math.PI * 2);
      ctx.fillStyle = route.color;
      ctx.fill();
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = px(zoom, 1);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `${px(zoom, 8)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), center.x, center.y);
      ctx.fillStyle = route.color;
    });

    if (showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      if (first) {
        const center = cabinetCenter(first);
        drawRouteLabel(ctx, route.startLabel, center.x, center.y - px(zoom, 16), route.color, route.labelColor ?? "#e0f2fe", zoom);
      }
      if (last && last !== first) {
        const center = cabinetCenter(last);
        drawRouteLabel(
          ctx,
          `${route.endLabel} / ${route.backupLabel}`,
          center.x,
          center.y + px(zoom, 18),
          route.color,
          route.labelColor ?? "#e0f2fe",
          zoom
        );
      }
    }

    ctx.restore();
  });
}

function drawPowerSupplyBadges(
  ctx: CanvasRenderingContext2D,
  cabinets: { id: string; x: number; y: number; width: number; height: number }[],
  cabinetSupplies: Record<string, number>,
  defaultSuppliesPerCabinet: number,
  selectedPowerCabinetId: string | null,
  showSupplyBadges: boolean,
  zoom: number
) {
  if (!showSupplyBadges) return;

  cabinets.forEach((cabinet) => {
    const count = Number(cabinetSupplies[cabinet.id] ?? defaultSuppliesPerCabinet);
    const isSelected = selectedPowerCabinetId === cabinet.id;
    if (!Number.isFinite(count) || count <= 0) return;

    const x = cabinet.x + px(zoom, 6);
    const y = cabinet.y + px(zoom, 6);
    const width = px(zoom, 42);
    const height = px(zoom, 14);

    ctx.save();
    ctx.fillStyle = isSelected ? "rgba(249, 115, 22, 0.95)" : "rgba(120, 53, 15, 0.86)";
    ctx.strokeStyle = "#fed7aa";
    ctx.lineWidth = px(zoom, 1);
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#fff7ed";
    ctx.font = `${px(zoom, 8)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`PSU x${count}`, x + width / 2, y + height / 2);
    ctx.restore();
  });
}

function drawPowerLoopRoutes(
  ctx: CanvasRenderingContext2D,
  routes: { id: string; name: string; color: string; labelColor?: string; cabinetIds: string[]; sourceLabel: string; endLabel: string }[],
  cabinets: { id: string; x: number; y: number; width: number; height: number }[],
  activePowerRouteId: string | null,
  showLabels: boolean,
  zoom: number
) {
  const byId = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]));

  routes.forEach((route) => {
    const routeCabinets = route.cabinetIds
      .map((id) => byId.get(id))
      .filter((cabinet): cabinet is { id: string; x: number; y: number; width: number; height: number } => Boolean(cabinet));
    if (routeCabinets.length === 0) return;

    ctx.save();
    ctx.strokeStyle = route.color;
    ctx.fillStyle = route.color;
    ctx.lineWidth = px(zoom, 1.7);
    ctx.setLineDash(activePowerRouteId === route.id ? [px(zoom, 8), px(zoom, 4)] : []);

    routeCabinets.slice(0, -1).forEach((cabinet, index) => {
      const next = routeCabinets[index + 1];
      if (!next) return;
      const trimmed = shortenSegment(powerAnchor(cabinet), powerAnchor(next), px(zoom, 4), px(zoom, 8));
      ctx.beginPath();
      ctx.moveTo(trimmed.start.x, trimmed.start.y);
      ctx.lineTo(trimmed.end.x, trimmed.end.y);
      ctx.stroke();
      drawArrowHead(ctx, trimmed.start, trimmed.end, zoom);
    });

    routeCabinets.forEach((cabinet) => {
      const anchor = powerMarkerAnchor(cabinet, zoom);
      const width = px(zoom, 22);
      const height = px(zoom, 12);
      ctx.beginPath();
      ctx.rect(anchor.x - width / 2, anchor.y - height / 2, width, height);
      ctx.fillStyle = route.color;
      ctx.fill();
      ctx.strokeStyle = "#fff7ed";
      ctx.lineWidth = px(zoom, 1);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `${px(zoom, 8)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AC", anchor.x, anchor.y);
    });

    if (showLabels) {
      const first = routeCabinets[0];
      const last = routeCabinets.at(-1);
      if (first) {
        const anchor = powerMarkerAnchor(first, zoom);
        drawRouteLabel(ctx, formatAcLoopLabel(route.sourceLabel), anchor.x, anchor.y - px(zoom, 14), route.color, route.labelColor ?? "#fff7ed", zoom);
      }
      if (last && last !== first) {
        const anchor = powerMarkerAnchor(last, zoom);
        drawRouteLabel(ctx, formatAcLoopLabel(route.endLabel), anchor.x, anchor.y + px(zoom, 14), route.color, route.labelColor ?? "#fff7ed", zoom);
      }
    }

    ctx.restore();
  });
}

function powerAnchor(cabinet: { x: number; y: number; width: number; height: number }) {
  return {
    x: cabinet.x + cabinet.width / 2,
    y: cabinet.y + cabinet.height * 0.72
  };
}

function powerMarkerAnchor(cabinet: { x: number; y: number; width: number; height: number }, zoom: number) {
  const anchor = powerAnchor(cabinet);
  return {
    x: anchor.x,
    y: anchor.y - px(zoom, 14)
  };
}

function cabinetCenter(cabinet: { x: number; y: number; width: number; height: number }) {
  return {
    x: cabinet.x + cabinet.width / 2,
    y: cabinet.y + cabinet.height / 2
  };
}

function drawRouteLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  color: string,
  textColor: string,
  zoom: number
) {
  const padding = px(zoom, 4);
  const height = px(zoom, 16);
  ctx.font = `${px(zoom, 11)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = ctx.measureText(label).width + padding * 2;
  ctx.fillStyle = "rgba(2, 6, 23, 0.9)";
  ctx.strokeStyle = color;
  ctx.lineWidth = px(zoom, 1);
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.strokeRect(x - width / 2, y - height / 2, width, height);
  ctx.fillStyle = textColor;
  ctx.fillText(label, x, y);
  ctx.fillStyle = color;
}

function drawArrowHead(ctx: CanvasRenderingContext2D, start: Point, end: Point, zoom: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = px(zoom, 9);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function px(zoom: number, pixels: number) {
  return pixels / Math.max(zoom, 0.0001);
}

function shortenSegment(start: Point, end: Point, trimStart: number, trimEnd: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= trimStart + trimEnd + 0.5) return { start, end };
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: start.x + ux * trimStart, y: start.y + uy * trimStart },
    end: { x: end.x - ux * trimEnd, y: end.y - uy * trimEnd }
  };
}

