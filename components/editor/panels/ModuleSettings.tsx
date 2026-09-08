"use client";

import { Palette } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldGroup, NumberInput, SelectInput, TextInput } from "@/components/ui/Field";
import { useEditorStore } from "@/store/editorStore";
import type { CabinetSequenceDirection, ModuleStatus } from "@/types/project";

const statuses: ModuleStatus[] = ["installed", "missing", "damaged", "spare", "unused"];

export function ModuleSettingsPanel() {
  const {
    project,
    selectedModuleIds,
    selectedColor,
    setSelectedColor,
    updateSelectedModules,
    applySequentialLabelsToSelection,
    selectCurrentCabinetModules,
    applyCabinetSequenceLabels,
    selectAll,
    clearSelection
  } = useEditorStore();
  const [labelPrefix, setLabelPrefix] = useState("JH");
  const [labelStart, setLabelStart] = useState(1);
  const [labelPad, setLabelPad] = useState(1);
  const [cabinetRange, setCabinetRange] = useState("JH1-JH10");
  const [cabinetDirection, setCabinetDirection] = useState<CabinetSequenceDirection>("leftToRight");
  const selected = project.modules.filter((module) => selectedModuleIds.includes(module.id));
  const first = selected[0];

  function applyCabinetLabels(scope: "currentCabinet" | "allCabinets") {
    try {
      applyCabinetSequenceLabels(cabinetRange, cabinetDirection, scope);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to apply cabinet labels.");
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Properties</h2>

      {!first ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
          Select a module or empty disabled slot to inspect it, disable it, or place it back into the wall.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="text-sm font-semibold text-sky-100">
              {selected.length === 1 ? `Module ${first.number}` : `${selected.length} modules selected`}
            </div>
            {selected.length === 1 && (
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-slate-500">Row</dt>
                <dd className="text-right font-mono">{first.row}</dd>
                <dt className="text-slate-500">Column</dt>
                <dd className="text-right font-mono">{first.column}</dd>
                <dt className="text-slate-500">Physical X</dt>
                <dd className="text-right font-mono">
                  {first.x} {project.wall.unit}
                </dd>
                <dt className="text-slate-500">Physical Y</dt>
                <dd className="text-right font-mono">
                  {first.y} {project.wall.unit}
                </dd>
                <dt className="text-slate-500">Size</dt>
                <dd className="text-right font-mono">
                  {first.width} x {first.height} {project.wall.unit}
                </dd>
                <dt className="text-slate-500">Resolution</dt>
                <dd className="text-right font-mono">
                  {first.pixelWidth} x {first.pixelHeight} px
                </dd>
              </dl>
            )}
          </div>

          <FieldGroup label="Status">
            <SelectInput
              value={first.status}
              onChange={(event) => updateSelectedModules({ status: event.target.value as ModuleStatus, enabled: event.target.value !== "unused" })}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </SelectInput>
          </FieldGroup>

          <FieldGroup label="Port">
            <SelectInput
              value={first.port ?? ""}
              onChange={(event) => updateSelectedModules({ port: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">Unassigned</option>
              {Array.from({ length: project.mapping.portCount }, (_, index) => index + 1).map((port) => (
                <option key={port} value={port}>
                  Port {port}
                </option>
              ))}
            </SelectInput>
          </FieldGroup>

          <FieldGroup label="Custom label">
            <TextInput
              value={selected.length === 1 ? first.customLabel ?? "" : ""}
              placeholder={selected.length > 1 ? "Multiple selection" : first.number}
              onChange={(event) => updateSelectedModules({ customLabel: event.target.value || undefined })}
            />
          </FieldGroup>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Batch module labels</div>
            <div className="grid grid-cols-3 gap-2">
              <FieldGroup label="Prefix">
                <TextInput value={labelPrefix} onChange={(event) => setLabelPrefix(event.target.value)} />
              </FieldGroup>
              <FieldGroup label="Start">
                <NumberInput value={labelStart} onValueChange={setLabelStart} />
              </FieldGroup>
              <FieldGroup label="Pad">
                <NumberInput value={labelPad} min={1} onValueChange={setLabelPad} />
              </FieldGroup>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Preview: {labelPrefix}
              {String(labelStart).padStart(Math.max(1, labelPad), "0")}, {labelPrefix}
              {String(labelStart + 1).padStart(Math.max(1, labelPad), "0")}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={selected.length === 0}
                onClick={() => applySequentialLabelsToSelection(labelPrefix, labelStart, labelPad)}
              >
                Apply sequence
              </Button>
              <Button size="sm" variant="ghost" disabled={selected.length === 0} onClick={() => updateSelectedModules({ customLabel: undefined })}>
                Clear labels
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Cabinet module sequence</div>
            <FieldGroup label="Label range">
              <TextInput value={cabinetRange} onChange={(event) => setCabinetRange(event.target.value)} placeholder="JH1-JH10" />
            </FieldGroup>
            <div className="mt-3">
              <FieldGroup label="Sequence direction">
                <SelectInput
                  value={cabinetDirection}
                  onChange={(event) => setCabinetDirection(event.target.value as CabinetSequenceDirection)}
                >
                  <option value="leftToRight">Left to right</option>
                  <option value="rightToLeft">Right to left</option>
                  <option value="topToBottom">Top to bottom</option>
                  <option value="bottomToTop">Down to up</option>
                </SelectInput>
              </FieldGroup>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Select one module inside a cabinet, then select all modules in that cabinet or apply the range to that cabinet. Apply to all
              cabinets repeats the same range in every cabinet.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Button size="sm" variant="ghost" disabled={selected.length === 0} onClick={selectCurrentCabinetModules}>
                Select current cabinet modules
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="primary" disabled={selected.length === 0} onClick={() => applyCabinetLabels("currentCabinet")}>
                  Apply cabinet
                </Button>
                <Button size="sm" variant="secondary" onClick={() => applyCabinetLabels("allCabinets")}>
                  Apply all cabinets
                </Button>
              </div>
            </div>
          </div>

          <FieldGroup label="Module color">
            <div className="flex gap-2">
              <TextInput type="color" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} />
              <Button onClick={() => updateSelectedModules({ color: selectedColor })}>
                <Palette className="h-4 w-4" />
                Apply
              </Button>
            </div>
          </FieldGroup>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => updateSelectedModules({ enabled: true, status: "installed" })}>
              Enable / place
            </Button>
            <Button variant="danger" onClick={() => updateSelectedModules({ enabled: false, status: "unused" })}>
              Disable / remove
            </Button>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={selectAll}>
          Select all
        </Button>
        <Button variant="ghost" onClick={clearSelection}>
          Deselect
        </Button>
      </div>
    </section>
  );
}
