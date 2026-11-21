"use client";

import { annotationFonts } from "@/lib/annotations";
import { Button } from "@/components/ui/Button";
import { FieldGroup, NumberInput, SelectInput, TextInput } from "@/components/ui/Field";
import { useEditorStore } from "@/store/editorStore";
import type { ShapeKind } from "@/types/project";

const shapeOptions: { id: ShapeKind; label: string }[] = [
  { id: "rect", label: "Rectangle" },
  { id: "ellipse", label: "Ellipse" },
  { id: "line", label: "Line" }
];

export function AnnotationSettings() {
  const {
    project,
    selectedAnnotationId,
    shapeKind,
    setShapeKind,
    setActiveTool,
    selectAnnotation,
    updateAnnotation,
    deleteAnnotation,
    bringAnnotationToFront
  } = useEditorStore();
  const annotations = project.annotations ?? [];
  const selected = annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;

  return (
    <section className="space-y-3">
      <h2 className="border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Annotations</h2>
      <p className="text-xs text-slate-400">
        Use Text to click anywhere on the wall, or Shape to drag a rectangle, ellipse, or line. Select an item to move it and change its font
        or color.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setActiveTool("text")}>
          Add text
        </Button>
        <Button variant="secondary" onClick={() => setActiveTool("shape")}>
          Add shape
        </Button>
      </div>
      <FieldGroup label="Shape">
        <SelectInput value={shapeKind} onChange={(event) => setShapeKind(event.target.value as ShapeKind)}>
          {shapeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FieldGroup>

      {annotations.length === 0 ? (
        <div className="text-xs text-slate-500">No text or shapes yet.</div>
      ) : (
        <div className="max-h-36 space-y-1 overflow-y-auto">
          {annotations.map((annotation, index) => (
            <button
              key={annotation.id}
              type="button"
              onClick={() => selectAnnotation(annotation.id)}
              className={`block w-full rounded-lg border px-2 py-1.5 text-left text-xs ${
                annotation.id === selectedAnnotationId
                  ? "border-sky-400/70 bg-sky-950/40 text-sky-100"
                  : "border-slate-800 bg-slate-950/50 text-slate-300"
              }`}
            >
              {annotation.kind === "text" ? annotation.text.split("\n")[0] || "Text" : `${annotation.kind} ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
          {selected.kind === "text" ? (
            <>
              <FieldGroup label="Text">
                <textarea
                  className="field min-h-20 resize-y"
                  value={selected.text}
                  onChange={(event) => updateAnnotation(selected.id, { text: event.target.value })}
                />
              </FieldGroup>
              <FieldGroup label="Font">
                <SelectInput
                  value={selected.fontFamily}
                  onChange={(event) => updateAnnotation(selected.id, { fontFamily: event.target.value })}
                >
                  {annotationFonts.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </SelectInput>
              </FieldGroup>
              <div className="grid grid-cols-2 gap-2">
                <FieldGroup label={`Size (${project.wall.unit})`}>
                  <NumberInput
                    min={1}
                    value={selected.fontSize}
                    onValueChange={(value) => updateAnnotation(selected.id, { fontSize: Math.max(1, value) })}
                  />
                </FieldGroup>
                <FieldGroup label="Color">
                  <TextInput type="color" value={selected.color} onChange={(event) => updateAnnotation(selected.id, { color: event.target.value })} />
                </FieldGroup>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <FieldGroup label="Stroke">
                  <TextInput type="color" value={selected.color} onChange={(event) => updateAnnotation(selected.id, { color: event.target.value })} />
                </FieldGroup>
                <FieldGroup label="Fill">
                  <TextInput type="color" value={toColorInput(selected.fill)} onChange={(event) => updateAnnotation(selected.id, { fill: event.target.value })} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldGroup label="Fill opacity %">
                  <NumberInput
                    value={Math.round(selected.fillOpacity * 100)}
                    onValueChange={(value) => updateAnnotation(selected.id, { fillOpacity: Math.min(100, value) / 100 })}
                  />
                </FieldGroup>
                <FieldGroup label={`Stroke (${project.wall.unit})`}>
                  <NumberInput
                    min={0.5}
                    value={selected.strokeWidth}
                    onValueChange={(value) => updateAnnotation(selected.id, { strokeWidth: Math.max(0.5, value) })}
                  />
                </FieldGroup>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <FieldGroup label={`X (${project.wall.unit})`}>
              <NumberInput allowNegative value={Math.round(selected.x)} onValueChange={(value) => updateAnnotation(selected.id, { x: value })} />
            </FieldGroup>
            <FieldGroup label={`Y (${project.wall.unit})`}>
              <NumberInput allowNegative value={Math.round(selected.y)} onValueChange={(value) => updateAnnotation(selected.id, { y: value })} />
            </FieldGroup>
          </div>
          {selected.kind !== "text" && (
            <div className="grid grid-cols-2 gap-2">
              <FieldGroup label={`Width (${project.wall.unit})`}>
                <NumberInput allowNegative value={Math.round(selected.width)} onValueChange={(value) => updateAnnotation(selected.id, { width: value })} />
              </FieldGroup>
              <FieldGroup label={`Height (${project.wall.unit})`}>
                <NumberInput allowNegative value={Math.round(selected.height)} onValueChange={(value) => updateAnnotation(selected.id, { height: value })} />
              </FieldGroup>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => bringAnnotationToFront(selected.id)}>
              Bring to front
            </Button>
            <Button size="sm" variant="danger" onClick={() => deleteAnnotation(selected.id)}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function toColorInput(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#38bdf8";
}
