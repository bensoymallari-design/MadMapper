import type { CanvasAnnotation, TitleStyle } from "@/types/project";

export const annotationFonts = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New"
] as const;

export const defaultTitleStyle: TitleStyle = {
  fontFamily: "Arial",
  fontSize: 16,
  color: "#e0f2fe",
  offsetX: 0,
  offsetY: 0,
  maxWidth: 0,
  align: "left"
};

export function formatAcLoopLabel(value: string) {
  return value
    .replace(/\bdc power loops\b/gi, "AC loops")
    .replace(/\bdc power loop\b/gi, "AC loop")
    .replace(/\bdc psu source\b/gi, "AC loop")
    .replace(/\bdc loop end\b/gi, "AC loop end")
    .replace(/\bdc loops\b/gi, "AC loops")
    .replace(/\bdc loop\b/gi, "AC loop")
    .replace(/\bac loops\b/gi, "AC loops")
    .replace(/\bac loop\b/gi, "AC loop");
}

export function pdfFontFamily(fontFamily: string) {
  const name = fontFamily.toLowerCase();
  if (name.includes("courier") || name.includes("mono")) return "courier";
  if (name.includes("times") || name.includes("georgia")) return "times";
  return "helvetica";
}

export function measureTextAnnotation(annotation: CanvasAnnotation): CanvasAnnotation {
  if (annotation.kind !== "text") return annotation;
  const lines = (annotation.text || " ").split("\n");
  const width = Math.max(
    annotation.fontSize,
    ...lines.map((line) => Math.max(1, line.length) * annotation.fontSize * 0.56)
  );
  const height = Math.max(annotation.fontSize * 1.15, lines.length * annotation.fontSize * 1.25);
  return { ...annotation, width, height };
}

export function normalizeAnnotation(value: Partial<CanvasAnnotation> | null | undefined, index: number): CanvasAnnotation | null {
  if (!value) return null;
  const kind = value.kind;
  if (kind !== "text" && kind !== "rect" && kind !== "ellipse" && kind !== "line") return null;
  const fontSize = Number(value.fontSize);
  const strokeWidth = Number(value.strokeWidth);
  const fillOpacity = Number(value.fillOpacity);
  const annotation: CanvasAnnotation = {
    id: value.id || `annotation-${index + 1}`,
    kind,
    x: Number.isFinite(Number(value.x)) ? Number(value.x) : 0,
    y: Number.isFinite(Number(value.y)) ? Number(value.y) : 0,
    width: Number.isFinite(Number(value.width)) ? Number(value.width) : 0,
    height: Number.isFinite(Number(value.height)) ? Number(value.height) : 0,
    text: value.text ?? "",
    fontFamily: value.fontFamily || "Arial",
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 80,
    color: value.color || "#f8fafc",
    fill: value.fill || "#38bdf8",
    fillOpacity: Number.isFinite(fillOpacity) ? Math.min(1, Math.max(0, fillOpacity)) : kind === "text" || kind === "line" ? 0 : 0.18,
    strokeWidth: Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : 12
  };
  return annotation.kind === "text" ? measureTextAnnotation(annotation) : annotation;
}

export function annotationBounds(annotation: CanvasAnnotation) {
  if (annotation.kind === "line") {
    return {
      x: Math.min(annotation.x, annotation.x + annotation.width),
      y: Math.min(annotation.y, annotation.y + annotation.height),
      width: Math.abs(annotation.width),
      height: Math.abs(annotation.height)
    };
  }
  if (annotation.kind === "text") {
    const measured = measureTextAnnotation(annotation);
    return { x: measured.x, y: measured.y, width: measured.width, height: measured.height };
  }
  const width = annotation.width;
  const height = annotation.height;
  return {
    x: width < 0 ? annotation.x + width : annotation.x,
    y: height < 0 ? annotation.y + height : annotation.y,
    width: Math.abs(width),
    height: Math.abs(height)
  };
}

export function hitTestAnnotations(annotations: CanvasAnnotation[], point: { x: number; y: number }, zoom: number) {
  const pad = 8 / Math.max(zoom, 0.0001);
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (annotation.kind === "line") {
      const distance = distanceToSegment(
        point,
        { x: annotation.x, y: annotation.y },
        { x: annotation.x + annotation.width, y: annotation.y + annotation.height }
      );
      if (distance <= Math.max(annotation.strokeWidth, pad)) return annotation;
      continue;
    }

    const bounds = annotationBounds(annotation);
    const inside =
      point.x >= bounds.x - pad &&
      point.y >= bounds.y - pad &&
      point.x <= bounds.x + bounds.width + pad &&
      point.y <= bounds.y + bounds.height + pad;
    if (!inside) continue;
    if (annotation.kind === "ellipse") {
      const rx = Math.max(bounds.width / 2, 1);
      const ry = Math.max(bounds.height / 2, 1);
      const nx = (point.x - (bounds.x + bounds.width / 2)) / rx;
      const ny = (point.y - (bounds.y + bounds.height / 2)) / ry;
      if (nx * nx + ny * ny > 1.2) continue;
    }
    return annotation;
  }
  return null;
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: CanvasAnnotation[],
  selectedId: string | null,
  zoom: number
) {
  annotations.forEach((annotation) => {
    drawAnnotation(ctx, annotation, annotation.id === selectedId, zoom);
  });
}

export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: CanvasAnnotation,
  selected: boolean,
  zoom: number
) {
  ctx.save();
  if (annotation.kind === "text") {
    const measured = measureTextAnnotation(annotation);
    ctx.fillStyle = annotation.color;
    ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    measured.text.split("\n").forEach((line, index) => {
      ctx.fillText(line, measured.x, measured.y + index * measured.fontSize * 1.25);
    });
    if (selected) strokeBounds(ctx, annotationBounds(measured), zoom);
  } else if (annotation.kind === "line") {
    ctx.beginPath();
    ctx.moveTo(annotation.x, annotation.y);
    ctx.lineTo(annotation.x + annotation.width, annotation.y + annotation.height);
    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = annotation.strokeWidth;
    ctx.stroke();
    if (selected) strokeBounds(ctx, annotationBounds(annotation), zoom);
  } else if (annotation.kind === "ellipse") {
    const bounds = annotationBounds(annotation);
    ctx.beginPath();
    ctx.ellipse(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      Math.max(bounds.width / 2, 0.5),
      Math.max(bounds.height / 2, 0.5),
      0,
      0,
      Math.PI * 2
    );
    paintShape(ctx, annotation);
    if (selected) strokeBounds(ctx, bounds, zoom);
  } else {
    const bounds = annotationBounds(annotation);
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    paintShape(ctx, annotation);
    if (selected) strokeBounds(ctx, bounds, zoom);
  }
  ctx.restore();
}

export function wrapText(text: string, maxWidth: number, fontSize: number) {
  const source = text.trim() || "Untitled LED Wall";
  if (maxWidth <= 0) return [source];
  const maxChars = Math.max(1, Math.floor(maxWidth / Math.max(fontSize * 0.52, 1)));
  const words = source.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  const pushLongWord = (word: string) => {
    for (let index = 0; index < word.length; index += maxChars) {
      lines.push(word.slice(index, index + maxChars));
    }
  };

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (word.length > maxChars) {
      if (current) lines.push(current);
      pushLongWord(word);
      current = "";
      return;
    }
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [source];
}

function paintShape(ctx: CanvasRenderingContext2D, annotation: CanvasAnnotation) {
  if (annotation.fillOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = annotation.fillOpacity;
    ctx.fillStyle = annotation.fill;
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = annotation.strokeWidth;
  ctx.stroke();
}

function strokeBounds(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number
) {
  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.5 / Math.max(zoom, 0.0001);
  ctx.setLineDash([6 / Math.max(zoom, 0.0001), 4 / Math.max(zoom, 0.0001)]);
  ctx.strokeRect(bounds.x, bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1));
  ctx.restore();
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
