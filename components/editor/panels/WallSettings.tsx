"use client";

import { AlertTriangle } from "lucide-react";
import { annotationFonts } from "@/lib/annotations";
import { calculateLayoutMetrics, validateDimensions } from "@/lib/calculations";
import { useEditedProject, useEditorStore } from "@/store/editorStore";
import { FieldGroup, NumberInput, SelectInput, TextInput } from "@/components/ui/Field";

export function WallSettingsPanel() {
  const { setProjectName, updateTitleStyle, updateWall, updateModuleSettings, updateCabinet, selectedPlacedId } = useEditorStore();
  const project = useEditedProject();
  const title = project.titleStyle;
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const warnings = validateDimensions(project.wall, project.module);

  return (
    <section className="space-y-4">
      <PanelTitle title={selectedPlacedId ? "Editing this wall" : "Project"} />
      {selectedPlacedId ? (
        <p className="text-xs text-sky-200">Changes here apply to the selected wall. Click the main wall to edit that one again.</p>
      ) : null}
      <FieldGroup label="Project name">
        <TextInput value={project.projectName} onChange={(event) => setProjectName(event.target.value)} />
      </FieldGroup>
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Export title</div>
        <p className="mb-3 text-xs text-slate-500">
          Size, color, font, offset, and wrap width control the title on PDF, SVG, and PNG so it stays clear of the other export text.
        </p>
        <div className="space-y-2">
          <FieldGroup label="Font">
            <SelectInput value={title?.fontFamily ?? "Arial"} onChange={(event) => updateTitleStyle({ fontFamily: event.target.value })}>
              {annotationFonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </SelectInput>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-2">
            <FieldGroup label="Size (pt)">
              <NumberInput min={8} value={title?.fontSize ?? 16} onValueChange={(value) => updateTitleStyle({ fontSize: Math.max(8, value) })} />
            </FieldGroup>
            <FieldGroup label="Color">
              <TextInput type="color" value={title?.color ?? "#e0f2fe"} onChange={(event) => updateTitleStyle({ color: event.target.value })} />
            </FieldGroup>
            <FieldGroup label="X offset (mm)">
              <NumberInput allowNegative value={title?.offsetX ?? 0} onValueChange={(value) => updateTitleStyle({ offsetX: value })} />
            </FieldGroup>
            <FieldGroup label="Y offset (mm)">
              <NumberInput allowNegative value={title?.offsetY ?? 0} onValueChange={(value) => updateTitleStyle({ offsetY: value })} />
            </FieldGroup>
            <FieldGroup label="Wrap width (mm)">
              <NumberInput value={title?.maxWidth ?? 0} onValueChange={(value) => updateTitleStyle({ maxWidth: value })} />
            </FieldGroup>
            <FieldGroup label="Align">
              <SelectInput
                value={title?.align ?? "left"}
                onChange={(event) => updateTitleStyle({ align: event.target.value as "left" | "center" })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </SelectInput>
            </FieldGroup>
          </div>
          <p className="text-[11px] text-slate-500">Wrap width 0 uses the space beside the legend. The specification lines move below the title.</p>
        </div>
      </div>

      <PanelTitle title="1. Module Size" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Module width">
          <NumberInput value={project.module.width} onValueChange={(value) => updateModuleSettings({ width: value })} />
        </FieldGroup>
        <FieldGroup label="Module height">
          <NumberInput value={project.module.height} onValueChange={(value) => updateModuleSettings({ height: value })} />
        </FieldGroup>
      </div>

      <PanelTitle title="2. Wall Size" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Wall width">
          <NumberInput value={project.wall.width} onValueChange={(value) => updateWall({ width: value })} />
        </FieldGroup>
        <FieldGroup label="Wall height">
          <NumberInput value={project.wall.height} onValueChange={(value) => updateWall({ height: value })} />
        </FieldGroup>
        <FieldGroup label="Unit">
          <SelectInput value={project.wall.unit} onChange={(event) => updateWall({ unit: event.target.value as typeof project.wall.unit })}>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">meters</option>
          </SelectInput>
        </FieldGroup>
        <FieldGroup label="Wall rotation">
          <SelectInput value={project.wall.rotation} onChange={(event) => updateWall({ rotation: Number(event.target.value) as typeof project.wall.rotation })}>
            <option value={0}>0deg</option>
            <option value={90}>90deg</option>
            <option value={180}>180deg</option>
            <option value={270}>270deg</option>
          </SelectInput>
        </FieldGroup>
      </div>

      <PanelTitle title="3. Cabinet Size" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Cabinet width">
          <NumberInput value={project.cabinet.width} onValueChange={(value) => updateCabinet({ width: value })} />
        </FieldGroup>
        <FieldGroup label="Cabinet height">
          <NumberInput value={project.cabinet.height} onValueChange={(value) => updateCabinet({ height: value })} />
        </FieldGroup>
      </div>

      <PanelTitle title="4. Pixel Resolution" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Pixel width">
          <NumberInput value={project.module.pixelWidth} onValueChange={(value) => updateModuleSettings({ pixelWidth: value })} />
        </FieldGroup>
        <FieldGroup label="Pixel height">
          <NumberInput value={project.module.pixelHeight} onValueChange={(value) => updateModuleSettings({ pixelHeight: value })} />
        </FieldGroup>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Calculated Layout</div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Metric label="Modules" value={`${metrics.columns} x ${metrics.rows}`} />
          <Metric label="Total" value={`${metrics.totalModules}`} />
          <Metric label="Resolution" value={`${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px`} />
          <Metric label="Active" value={`${metrics.activeModules}`} />
        </dl>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <div key={warning.id} className="rounded-lg border border-amber-500/40 bg-amber-950/25 p-3 text-xs text-amber-100">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div>{warning.message}</div>
                  {warning.severity === "warning" && (
                    <div className="mt-1 text-amber-200/70">Choose to keep the partial area, adjust wall size, or adjust module size.</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PanelTitle({ title }: { title: string }) {
  return <h2 className="border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{title}</h2>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-mono text-slate-100">{value}</dd>
    </>
  );
}
