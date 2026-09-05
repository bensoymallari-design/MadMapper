"use client";

import { Route } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldGroup, SelectInput, TextInput } from "@/components/ui/Field";
import { useEditorStore } from "@/store/editorStore";

export function MappingSettingsPanel() {
  const { project, updateMapping, updateDisplay, assignMapping, updateCabinet, updateNumbering } = useEditorStore();

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <h2 className="border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Numbering</h2>
        <FieldGroup label="Mode">
          <SelectInput value={project.numbering.mode} onChange={(event) => updateNumbering({ mode: event.target.value as typeof project.numbering.mode })}>
            <option value="rowColumn">Row / Column</option>
            <option value="snake">Snake</option>
            <option value="vertical">Vertical</option>
            <option value="reverseRow">Reverse Row</option>
            <option value="reverseColumn">Reverse Column</option>
            <option value="custom">Custom Sequence</option>
          </SelectInput>
        </FieldGroup>
        <div className="grid grid-cols-3 gap-2">
          <FieldGroup label="Prefix">
            <TextInput value={project.numbering.prefix} onChange={(event) => updateNumbering({ prefix: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="Separator">
            <TextInput value={project.numbering.separator} onChange={(event) => updateNumbering({ separator: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="Start">
            <TextInput type="number" value={project.numbering.startNumber} onChange={(event) => updateNumbering({ startNumber: Number(event.target.value) })} />
          </FieldGroup>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Port Mapping</h2>
        <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          Enable mapping
          <input type="checkbox" checked={project.mapping.enabled} onChange={(event) => updateMapping({ enabled: event.target.checked })} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <FieldGroup label="Ports">
            <TextInput type="number" min={1} value={project.mapping.portCount} onChange={(event) => updateMapping({ portCount: Number(event.target.value) })} />
          </FieldGroup>
          <FieldGroup label="Modules / port">
            <TextInput type="number" min={1} value={project.mapping.modulesPerPort} onChange={(event) => updateMapping({ modulesPerPort: Number(event.target.value) })} />
          </FieldGroup>
        </div>
        <FieldGroup label="Direction">
          <SelectInput value={project.mapping.direction} onChange={(event) => updateMapping({ direction: event.target.value as typeof project.mapping.direction })}>
            <option value="horizontal">Horizontal cascade</option>
            <option value="vertical">Vertical cascade</option>
          </SelectInput>
        </FieldGroup>
        <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          Snake data path
          <input type="checkbox" checked={project.mapping.snake} onChange={(event) => updateMapping({ snake: event.target.checked })} />
        </label>
        <Button variant="primary" className="w-full" onClick={assignMapping}>
          <Route className="h-4 w-4" />
          Generate port mapping
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Cabinets</h2>
        <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          Cabinet mode
          <input type="checkbox" checked={project.cabinet.enabled} onChange={(event) => updateCabinet({ enabled: event.target.checked })} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <FieldGroup label="Cabinet width">
            <TextInput type="number" value={project.cabinet.width} onChange={(event) => updateCabinet({ width: Number(event.target.value) })} />
          </FieldGroup>
          <FieldGroup label="Cabinet height">
            <TextInput type="number" value={project.cabinet.height} onChange={(event) => updateCabinet({ height: Number(event.target.value) })} />
          </FieldGroup>
        </div>
        <FieldGroup label="Cabinet rotation">
          <SelectInput value={project.cabinet.rotation} onChange={(event) => updateCabinet({ rotation: Number(event.target.value) as typeof project.cabinet.rotation })}>
            <option value={0}>0deg</option>
            <option value={90}>90deg</option>
            <option value={180}>180deg</option>
            <option value={270}>270deg</option>
          </SelectInput>
        </FieldGroup>
      </div>

      <div className="space-y-2">
        <h2 className="border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Canvas Layers</h2>
        {[
          ["showGrid", "Grid"],
          ["showNumbers", "Module numbers"],
          ["showCabinets", "Cabinet boundaries"],
          ["showDataPaths", "Data paths"],
          ["showDimensions", "Dimension lines"],
          ["showCoordinates", "Coordinate labels"]
        ].map(([key, label]) => (
          <label key={key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
            {label}
            <input
              type="checkbox"
              checked={Boolean(project.display[key as keyof typeof project.display])}
              onChange={(event) => updateDisplay({ [key]: event.target.checked })}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
