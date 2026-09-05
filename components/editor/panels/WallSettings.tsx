"use client";

import { AlertTriangle } from "lucide-react";
import { calculateLayoutMetrics, validateDimensions } from "@/lib/calculations";
import { useEditorStore } from "@/store/editorStore";
import { FieldGroup, SelectInput, TextInput } from "@/components/ui/Field";

export function WallSettingsPanel() {
  const { project, setProjectName, updateWall, updateModuleSettings } = useEditorStore();
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);
  const warnings = validateDimensions(project.wall, project.module);

  return (
    <section className="space-y-4">
      <PanelTitle title="Project" />
      <FieldGroup label="Project name">
        <TextInput value={project.projectName} onChange={(event) => setProjectName(event.target.value)} />
      </FieldGroup>

      <PanelTitle title="Wall Settings" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Width">
          <NumberInput value={project.wall.width} onChange={(value) => updateWall({ width: value })} />
        </FieldGroup>
        <FieldGroup label="Height">
          <NumberInput value={project.wall.height} onChange={(value) => updateWall({ height: value })} />
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
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

      <PanelTitle title="Module" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Module width">
          <NumberInput value={project.module.width} onChange={(value) => updateModuleSettings({ width: value })} />
        </FieldGroup>
        <FieldGroup label="Module height">
          <NumberInput value={project.module.height} onChange={(value) => updateModuleSettings({ height: value })} />
        </FieldGroup>
        <FieldGroup label="Pixel width">
          <NumberInput value={project.module.pixelWidth} onChange={(value) => updateModuleSettings({ pixelWidth: value })} />
        </FieldGroup>
        <FieldGroup label="Pixel height">
          <NumberInput value={project.module.pixelHeight} onChange={(value) => updateModuleSettings({ pixelHeight: value })} />
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

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <TextInput type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-mono text-slate-100">{value}</dd>
    </>
  );
}
