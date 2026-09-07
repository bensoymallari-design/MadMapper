"use client";

import { FieldGroup, SelectInput, TextInput } from "@/components/ui/Field";
import { calculateLayoutMetrics } from "@/lib/calculations";
import { useEditorStore } from "@/store/editorStore";

export function QuickSetupForm() {
  const { project, setProjectName, updateWall, updateModuleSettings, updateCabinet } = useEditorStore();
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);

  return (
    <div className="space-y-4">
      <FieldGroup label="Project name">
        <TextInput value={project.projectName} onChange={(event) => setProjectName(event.target.value)} />
      </FieldGroup>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">1. Module size</div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Width">
            <NumberInput value={project.module.width} onChange={(value) => updateModuleSettings({ width: value })} />
          </FieldGroup>
          <FieldGroup label="Height">
            <NumberInput value={project.module.height} onChange={(value) => updateModuleSettings({ height: value })} />
          </FieldGroup>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">2. Wall size</div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Width">
            <NumberInput value={project.wall.width} onChange={(value) => updateWall({ width: value })} />
          </FieldGroup>
          <FieldGroup label="Height">
            <NumberInput value={project.wall.height} onChange={(value) => updateWall({ height: value })} />
          </FieldGroup>
        </div>
        <div className="mt-3">
          <FieldGroup label="Unit">
            <SelectInput value={project.wall.unit} onChange={(event) => updateWall({ unit: event.target.value as typeof project.wall.unit })}>
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
            <NumberInput value={project.cabinet.width} onChange={(value) => updateCabinet({ width: value })} />
          </FieldGroup>
          <FieldGroup label="Height">
            <NumberInput value={project.cabinet.height} onChange={(value) => updateCabinet({ height: value })} />
          </FieldGroup>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">4. Pixel resolution</div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Pixel width">
            <NumberInput value={project.module.pixelWidth} onChange={(value) => updateModuleSettings({ pixelWidth: value })} />
          </FieldGroup>
          <FieldGroup label="Pixel height">
            <NumberInput value={project.module.pixelHeight} onChange={(value) => updateModuleSettings({ pixelHeight: value })} />
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Calculated preview</div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Metric label="Modules" value={`${metrics.columns} x ${metrics.rows}`} />
          <Metric label="Total" value={`${metrics.totalModules}`} />
          <Metric label="Resolution" value={`${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px`} />
          <Metric label="Active" value={`${metrics.activeModules}`} />
        </dl>
      </div>
    </div>
  );
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
