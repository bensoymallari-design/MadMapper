"use client";

import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { NewCanvasProjectDialog } from "@/components/editor/NewCanvasProjectDialog";
import { Button } from "@/components/ui/Button";
import { FieldGroup, NumberInput, SelectInput } from "@/components/ui/Field";
import { prepareImageFile } from "@/lib/images";
import { effectiveSheet, pageFrames, pagesToCover, readableScalePercent } from "@/lib/sheet";
import { useEditorStore } from "@/store/editorStore";
import type { SheetSettings } from "@/types/project";

export function SheetSettingsPanel() {
  const projectRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const {
    project,
    selectedImageId,
    selectedPlacedId,
    selectedMainWall,
    updateSheet,
    addPage,
    coverPages,
    addPlacedProject,
    updatePlacedProject,
    fitPlacedProject,
    fitMainWall,
    deletePlacedProject,
    addImage,
    updateImage,
    deleteImage,
    selectImage,
    selectPlaced,
    selectMainWall
  } = useEditorStore();
  const sheet = project.sheet;
  const fitted = effectiveSheet(project);
  const frames = pageFrames(project);
  const cover = pagesToCover(project);

  async function importImage(file: File) {
    const prepared = await prepareImageFile(file);
    const frame = frames[0];
    const worldWidth = Math.max(project.wall.width, frame.width - frame.margin * 2);
    const displayWidth = Math.min(worldWidth * 0.35, 900);
    addImage({
      name: prepared.name,
      dataUrl: prepared.dataUrl,
      x: sheet.wallX + 24,
      y: sheet.wallY + 24,
      width: displayWidth,
      height: displayWidth * (prepared.height / prepared.width)
    });
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-slate-400">
        Page borders match the PDF. The inner line is the margin, so anything inside it prints on that page. A new project is fitted to
        that area. Drag it to move, or drag a corner to resize. Edges snap to the margin and to other walls.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <FieldGroup label="Page size">
          <SelectInput
            value={sheet.pageSize}
            onChange={(event) => updateSheet({ pageSize: event.target.value as SheetSettings["pageSize"] })}
          >
            <option value="a4">A4</option>
            <option value="a3">A3</option>
            <option value="a2">A2</option>
            <option value="a1">A1</option>
            <option value="custom">Custom</option>
          </SelectInput>
        </FieldGroup>
        <FieldGroup label="Orientation">
          <SelectInput
            value={fitted.orientation}
            onChange={(event) => updateSheet({ orientation: event.target.value as SheetSettings["orientation"], lockOrientation: true })}
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </SelectInput>
        </FieldGroup>
        {sheet.pageSize === "custom" && (
          <>
            <FieldGroup label="Width (mm)">
              <NumberInput min={80} value={sheet.customWidth} onValueChange={(customWidth) => updateSheet({ customWidth })} />
            </FieldGroup>
            <FieldGroup label="Height (mm)">
              <NumberInput min={80} value={sheet.customHeight} onValueChange={(customHeight) => updateSheet({ customHeight })} />
            </FieldGroup>
          </>
        )}
        <FieldGroup label="Margin (mm)">
          <NumberInput min={0} value={sheet.margin} onValueChange={(margin) => updateSheet({ margin })} />
        </FieldGroup>
        <FieldGroup label="Columns">
          <NumberInput min={1} value={sheet.columns} onValueChange={(columns) => updateSheet({ columns })} />
        </FieldGroup>
        <FieldGroup label="Scale">
          <SelectInput
            value={sheet.scaleMode}
            onChange={(event) => {
              const scaleMode = event.target.value === "custom" ? "custom" : "fit";
              updateSheet(
                scaleMode === "fit"
                  ? { scaleMode, scalePercent: 100 }
                  : { scaleMode, orientation: fitted.orientation, lockOrientation: true }
              );
            }}
          >
            <option value="fit">Fit on page 1</option>
            <option value="custom">Custom percent</option>
          </SelectInput>
        </FieldGroup>
        {sheet.scaleMode === "custom" && (
          <FieldGroup label="Scale percent">
            <NumberInput min={25} value={sheet.scalePercent} onValueChange={(scalePercent) => updateSheet({ scalePercent })} />
          </FieldGroup>
        )}
        <FieldGroup label="Wall X">
          <NumberInput allowNegative value={sheet.wallX} onValueChange={(wallX) => updateSheet({ wallX })} />
        </FieldGroup>
        <FieldGroup label="Wall Y">
          <NumberInput allowNegative value={sheet.wallY} onValueChange={(wallY) => updateSheet({ wallY })} />
        </FieldGroup>
      </div>
      {sheet.lockOrientation ? (
        <button type="button" className="text-xs text-sky-300" onClick={() => updateSheet({ lockOrientation: false })}>
          Match the page to the wall
        </button>
      ) : (
        <p className="text-xs text-slate-500">One fitted page follows the wall, so the border wraps the project instead of leaving an empty sheet.</p>
      )}
      <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
        Show page borders
        <input type="checkbox" checked={sheet.showGuides} onChange={(event) => updateSheet({ showGuides: event.target.checked })} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={addPage}>
          <Plus className="h-4 w-4" />
          Add page
        </Button>
        <Button variant="secondary" size="sm" onClick={coverPages}>
          Cover project ({cover.pageCount})
        </Button>
        <Button variant="ghost" size="sm" onClick={() => updateSheet({ scaleMode: "custom", scalePercent: readableScalePercent(project) })}>
          Readable labels
        </Button>
      </div>
      <div className="text-xs text-slate-400">
        {frames.length} page{frames.length === 1 ? "" : "s"} on the canvas. The safe area of page 1 starts at 0, 0.
      </div>

      <div className={`rounded-lg border p-2 ${selectedMainWall ? "border-sky-400/70 bg-sky-950/40" : "border-slate-800 bg-slate-950/50"}`}>
        <button type="button" className="mb-2 block w-full text-left text-xs text-slate-200" onClick={() => selectMainWall(true)}>
          {project.projectName || "This project"}
        </button>
        <p className="mb-2 text-xs text-slate-500">Click the name on the canvas, then drag to move it. Drag a corner to resize. Edges snap to the margin.</p>
        <div className="grid grid-cols-2 gap-2">
          <FieldGroup label="X">
            <NumberInput allowNegative value={sheet.wallX} onValueChange={(wallX) => updateSheet({ wallX })} />
          </FieldGroup>
          <FieldGroup label="Y">
            <NumberInput allowNegative value={sheet.wallY} onValueChange={(wallY) => updateSheet({ wallY })} />
          </FieldGroup>
          <FieldGroup label="Scale %">
            <NumberInput
              min={5}
              value={Math.round((sheet.wallScale || 1) * 100)}
              onValueChange={(percent) => updateSheet({ wallScale: Math.min(2000, Math.max(5, percent)) / 100 })}
            />
          </FieldGroup>
        </div>
        <Button className="mt-2" variant="secondary" size="sm" onClick={fitMainWall}>
          Fit & align
        </Button>
      </div>

      <div className="border-t border-slate-800 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Other projects</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setNewProjectOpen(true)}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
          <Button variant="secondary" size="sm" onClick={() => projectRef.current?.click()}>
            <Plus className="h-4 w-4" />
            Add project JSON
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {project.placedProjects.length === 0 ? (
            <div className="text-xs text-slate-500">The canvas has only this project.</div>
          ) : (
            project.placedProjects.map((placed) => (
              <div
                key={placed.id}
                className={`rounded-lg border p-2 ${placed.id === selectedPlacedId ? "border-sky-400/70 bg-sky-950/40" : "border-slate-800 bg-slate-950/50"}`}
              >
                <button type="button" className="mb-2 block w-full text-left text-xs text-slate-200" onClick={() => selectPlaced(placed.id)}>
                  {placed.name}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <FieldGroup label="X">
                    <NumberInput allowNegative value={placed.x} onValueChange={(x) => updatePlacedProject(placed.id, { x })} />
                  </FieldGroup>
                  <FieldGroup label="Y">
                    <NumberInput allowNegative value={placed.y} onValueChange={(y) => updatePlacedProject(placed.id, { y })} />
                  </FieldGroup>
                  <FieldGroup label="Scale %">
                    <NumberInput
                      min={5}
                      value={Math.round((placed.scale || 1) * 100)}
                      onValueChange={(percent) => updatePlacedProject(placed.id, { scale: Math.min(2000, Math.max(5, percent)) / 100 })}
                    />
                  </FieldGroup>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fitPlacedProject(placed.id)}>
                    Fit & align
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deletePlacedProject(placed.id)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Images</div>
        <Button variant="secondary" size="sm" onClick={() => imageRef.current?.click()}>
          <ImagePlus className="h-4 w-4" />
          Import image
        </Button>
        <div className="mt-2 space-y-2">
          {project.images.length === 0 ? (
            <div className="text-xs text-slate-500">No images on the canvas.</div>
          ) : (
            project.images.map((image) => (
              <div
                key={image.id}
                className={`rounded-lg border p-2 ${image.id === selectedImageId ? "border-sky-400/70 bg-sky-950/40" : "border-slate-800 bg-slate-950/50"}`}
              >
                <button type="button" className="mb-2 block w-full text-left text-xs text-slate-200" onClick={() => selectImage(image.id)}>
                  {image.name}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <FieldGroup label="X">
                    <NumberInput allowNegative value={image.x} onValueChange={(x) => updateImage(image.id, { x })} />
                  </FieldGroup>
                  <FieldGroup label="Y">
                    <NumberInput allowNegative value={image.y} onValueChange={(y) => updateImage(image.id, { y })} />
                  </FieldGroup>
                  <FieldGroup label="Width">
                    <NumberInput min={1} value={image.width} onValueChange={(width) => updateImage(image.id, { width })} />
                  </FieldGroup>
                  <FieldGroup label="Height">
                    <NumberInput min={1} value={image.height} onValueChange={(height) => updateImage(image.id, { height })} />
                  </FieldGroup>
                </div>
                <Button className="mt-2" variant="ghost" size="sm" onClick={() => deleteImage(image.id)}>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {newProjectOpen ? <NewCanvasProjectDialog open onClose={() => setNewProjectOpen(false)} /> : null}
      <input
        ref={projectRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void file.text().then((json) => {
            try {
              addPlacedProject(json);
            } catch (error) {
              alert(error instanceof Error ? error.message : "Unable to add that project.");
            }
          });
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importImage(file).catch((error: unknown) => {
              alert(error instanceof Error ? error.message : "Unable to import that image.");
            });
          }
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
