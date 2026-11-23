"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldGroup, NumberInput, SelectInput } from "@/components/ui/Field";
import { exportProjectPdf, type PdfExportOptions, type PdfScaleMode } from "@/lib/pdf";
import { effectiveSheet, readableScalePercent } from "@/lib/sheet";
import { generateProjectSvg } from "@/lib/svg";
import { useEditorStore } from "@/store/editorStore";
import type { SheetSettings } from "@/types/project";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

const initialLayers = {
  showHeader: true,
  showLegend: true,
  showDimensions: true,
  showModuleNumbers: true,
  showRoutes: true,
  showPower: true,
  showAnnotations: true,
  detailPages: false
};

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { project, updateSheet } = useEditorStore();
  const [layers, setLayers] = useState(initialLayers);
  const sheet = project.sheet;
  const fitted = effectiveSheet(project);

  if (!open) return null;

  function updateLayers(partial: Partial<typeof initialLayers>) {
    setLayers((current) => ({ ...current, ...partial }));
  }

  function exportPdf() {
    const current = useEditorStore.getState().project;
    const options: PdfExportOptions = {
      pageSize: current.sheet.pageSize,
      customWidth: current.sheet.customWidth,
      customHeight: current.sheet.customHeight,
      orientation: current.sheet.orientation,
      margin: current.sheet.margin,
      scaleMode: current.sheet.scaleMode === "custom" ? "custom" : "fit",
      scalePercent: current.sheet.scalePercent,
      ...layers
    };
    exportProjectPdf(current, options);
  }

  function downloadSvg() {
    const blob = new Blob([generateProjectSvg(project)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.projectName.replace(/\s+/g, "-").toLowerCase()}-mapping.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    const svg = generateProjectSvg(project);
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(8000, Math.max(1, image.width * 2));
      canvas.height = Math.min(8000, Math.max(1, image.height * 2));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const anchor = document.createElement("a");
      anchor.download = `${project.projectName.replace(/\s+/g, "-").toLowerCase()}-mapping.png`;
      anchor.href = canvas.toDataURL("image/png");
      anchor.click();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-sky-50">Export technical documentation</h2>
            <p className="text-sm text-slate-400">Choose the page, scale, and which labels stay on the sheet.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="PDF page size">
            <SelectInput value={sheet.pageSize} onChange={(event) => updateSheet({ pageSize: event.target.value as SheetSettings["pageSize"] })}>
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
          <FieldGroup label="Scale">
            <SelectInput
              value={sheet.scaleMode}
              onChange={(event) => {
                const scaleMode = event.target.value as PdfScaleMode;
                if (scaleMode === "readable") {
                  updateSheet({
                    scaleMode: "custom",
                    scalePercent: readableScalePercent(project),
                    orientation: fitted.orientation,
                    lockOrientation: true
                  });
                } else if (scaleMode === "custom") updateSheet({ scaleMode: "custom", orientation: fitted.orientation, lockOrientation: true });
                else updateSheet({ scaleMode: "fit", scalePercent: 100 });
              }}
            >
              <option value="fit">Fit on page 1</option>
              <option value="readable">Keep labels readable</option>
              <option value="custom">Custom percent</option>
            </SelectInput>
          </FieldGroup>
          {sheet.scaleMode === "custom" && (
            <FieldGroup label="Scale percent">
              <NumberInput min={25} value={sheet.scalePercent} onValueChange={(scalePercent) => updateSheet({ scalePercent })} />
            </FieldGroup>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Toggle label="Header and title" checked={layers.showHeader} onChange={(showHeader) => updateLayers({ showHeader })} />
          <Toggle label="Port legend" checked={layers.showLegend} onChange={(showLegend) => updateLayers({ showLegend })} />
          <Toggle label="Dimension lines" checked={layers.showDimensions} onChange={(showDimensions) => updateLayers({ showDimensions })} />
          <Toggle label="Module numbers" checked={layers.showModuleNumbers} onChange={(showModuleNumbers) => updateLayers({ showModuleNumbers })} />
          <Toggle label="Receiver routes" checked={layers.showRoutes} onChange={(showRoutes) => updateLayers({ showRoutes })} />
          <Toggle label="AC loops" checked={layers.showPower} onChange={(showPower) => updateLayers({ showPower })} />
          <Toggle label="Text, lines, and shapes" checked={layers.showAnnotations} onChange={(showAnnotations) => updateLayers({ showAnnotations })} />
          <Toggle label="Column detail pages" checked={layers.detailPages} onChange={(detailPages) => updateLayers({ detailPages })} />
        </div>

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-400">
          The PDF uses the same pages and margin shown on the canvas. Cabinet names, receiver routes, and AC loops stay on the sheet. Images,
          lines, and extra projects export on the page that contains them.
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={downloadPng}>
            Export PNG
          </Button>
          <Button variant="secondary" onClick={downloadSvg}>
            Export SVG
          </Button>
          <Button variant="primary" onClick={exportPdf}>
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
