"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldGroup, NumberInput, SelectInput, TextInput } from "@/components/ui/Field";
import { calculateLayoutMetrics } from "@/lib/calculations";
import { useEditorStore } from "@/store/editorStore";
import type { CanvasProjectDraft, Unit } from "@/types/project";

interface NewCanvasProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewCanvasProjectDialog({ open, onClose }: NewCanvasProjectDialogProps) {
  const project = useEditorStore((state) => state.project);
  const addCanvasProject = useEditorStore((state) => state.addCanvasProject);
  const [draft, setDraft] = useState<CanvasProjectDraft>(() => draftFromProject(project));
  const [error, setError] = useState("");

  if (!open) return null;

  const columns = draft.moduleWidth > 0 ? Math.floor(draft.wallWidth / draft.moduleWidth) : 0;
  const rows = draft.moduleHeight > 0 ? Math.floor(draft.wallHeight / draft.moduleHeight) : 0;
  const metrics = calculateLayoutMetrics(
    { width: draft.wallWidth, height: draft.wallHeight, unit: draft.unit, orientation: "landscape", rotation: 0 },
    { width: draft.moduleWidth, height: draft.moduleHeight, pixelWidth: draft.pixelWidth, pixelHeight: draft.pixelHeight },
    []
  );

  function update(partial: Partial<CanvasProjectDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setError("");
  }

  function addProject() {
    if (draft.wallWidth <= 0 || draft.wallHeight <= 0 || draft.moduleWidth <= 0 || draft.moduleHeight <= 0) {
      setError("Enter a wall size and a module size before adding the project.");
      return;
    }
    addCanvasProject(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-lg rounded-2xl p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-sky-50">New project on this canvas</h2>
            <p className="mt-1 text-sm text-slate-400">
              The new wall is fitted to the next page and lined up with the margin. Drag it, or drag a corner to resize it.
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <FieldGroup label="Project name">
            <TextInput value={draft.name} onChange={(event) => update({ name: event.target.value })} />
          </FieldGroup>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">1. Module size</div>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Width">
                <NumberInput value={draft.moduleWidth} onValueChange={(moduleWidth) => update({ moduleWidth })} />
              </FieldGroup>
              <FieldGroup label="Height">
                <NumberInput value={draft.moduleHeight} onValueChange={(moduleHeight) => update({ moduleHeight })} />
              </FieldGroup>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">2. Wall size</div>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Width">
                <NumberInput value={draft.wallWidth} onValueChange={(wallWidth) => update({ wallWidth })} />
              </FieldGroup>
              <FieldGroup label="Height">
                <NumberInput value={draft.wallHeight} onValueChange={(wallHeight) => update({ wallHeight })} />
              </FieldGroup>
            </div>
            <div className="mt-3">
              <FieldGroup label="Unit">
                <SelectInput value={draft.unit} onChange={(event) => update({ unit: event.target.value as Unit })}>
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">meters</option>
                </SelectInput>
              </FieldGroup>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">3. Cabinet size</div>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Width">
                <NumberInput value={draft.cabinetWidth} onValueChange={(cabinetWidth) => update({ cabinetWidth })} />
              </FieldGroup>
              <FieldGroup label="Height">
                <NumberInput value={draft.cabinetHeight} onValueChange={(cabinetHeight) => update({ cabinetHeight })} />
              </FieldGroup>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">4. Pixel resolution</div>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Pixel width">
                <NumberInput value={draft.pixelWidth} onValueChange={(pixelWidth) => update({ pixelWidth })} />
              </FieldGroup>
              <FieldGroup label="Pixel height">
                <NumberInput value={draft.pixelHeight} onValueChange={(pixelHeight) => update({ pixelHeight })} />
              </FieldGroup>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
            {columns > 0 && rows > 0
              ? `${columns} x ${rows} modules · ${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px`
              : "The module size has to divide the wall before the layout can be calculated."}
          </div>
          {error ? <p className="text-xs text-amber-200">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={addProject}>
            Add to canvas
          </Button>
        </div>
      </div>
    </div>
  );
}

function draftFromProject(project: { projectName: string; placedProjects: unknown[]; wall: { width: number; height: number; unit: Unit }; module: { width: number; height: number; pixelWidth: number; pixelHeight: number }; cabinet: { width: number; height: number } }): CanvasProjectDraft {
  return {
    name: `Project ${project.placedProjects.length + 2}`,
    unit: project.wall.unit,
    wallWidth: project.wall.width,
    wallHeight: project.wall.height,
    moduleWidth: project.module.width,
    moduleHeight: project.module.height,
    pixelWidth: project.module.pixelWidth,
    pixelHeight: project.module.pixelHeight,
    cabinetWidth: project.cabinet.width,
    cabinetHeight: project.cabinet.height
  };
}
