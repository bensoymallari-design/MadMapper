"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldGroup, NumberInput, SelectInput } from "@/components/ui/Field";
import { exportProjectPdf, type PdfExportOptions, type PdfOrientation, type PdfPageSize, type PdfScaleMode } from "@/lib/pdf";
import { generateProjectSvg } from "@/lib/svg";
import { useEditorStore } from "@/store/editorStore";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

const initialOptions: PdfExportOptions = {
  pageSize: "a3",
  customWidth: 420,
  customHeight: 297,
  orientation: "landscape",
  margin: 12,
  scaleMode: "fit",
  scalePercent: 100,
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
  const { project } = useEditorStore();
  const [options, setOptions] = useState<PdfExportOptions>(initialOptions);

  if (!open) return null;

  function update(partial: Partial<PdfExportOptions>) {
    setOptions((current) => ({ ...current, ...partial }));
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
            <SelectInput value={options.pageSize} onChange={(event) => update({ pageSize: event.target.value as PdfPageSize })}>
              <option value="a4">A4</option>
              <option value="a3">A3</option>
              <option value="a2">A2</option>
              <option value="a1">A1</option>
              <option value="custom">Custom</option>
            </SelectInput>
          </FieldGroup>
          <FieldGroup label="Orientation">
            <SelectInput value={options.orientation} onChange={(event) => update({ orientation: event.target.value as PdfOrientation })}>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </SelectInput>
          </FieldGroup>
          {options.pageSize === "custom" && (
            <>
              <FieldGroup label="Width (mm)">
                <NumberInput min={80} value={options.customWidth} onValueChange={(value) => update({ customWidth: value })} />
              </FieldGroup>
              <FieldGroup label="Height (mm)">
                <NumberInput min={80} value={options.customHeight} onValueChange={(value) => update({ customHeight: value })} />
              </FieldGroup>
            </>
          )}
          <FieldGroup label="Margin (mm)">
            <NumberInput min={8} value={options.margin} onValueChange={(value) => update({ margin: value })} />
          </FieldGroup>
          <FieldGroup label="Scale">
            <SelectInput value={options.scaleMode} onChange={(event) => update({ scaleMode: event.target.value as PdfScaleMode })}>
              <option value="fit">Fit on one page</option>
              <option value="readable">Keep labels readable</option>
              <option value="custom">Custom percent</option>
            </SelectInput>
          </FieldGroup>
          {options.scaleMode === "custom" && (
            <FieldGroup label="Scale percent">
              <NumberInput min={25} value={options.scalePercent} onValueChange={(value) => update({ scalePercent: value })} />
            </FieldGroup>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Toggle label="Header and title" checked={options.showHeader} onChange={(checked) => update({ showHeader: checked })} />
          <Toggle label="Port legend" checked={options.showLegend} onChange={(checked) => update({ showLegend: checked })} />
          <Toggle label="Dimension lines" checked={options.showDimensions} onChange={(checked) => update({ showDimensions: checked })} />
          <Toggle label="Module numbers" checked={options.showModuleNumbers} onChange={(checked) => update({ showModuleNumbers: checked })} />
          <Toggle label="Receiver routes" checked={options.showRoutes} onChange={(checked) => update({ showRoutes: checked })} />
          <Toggle label="AC loops" checked={options.showPower} onChange={(checked) => update({ showPower: checked })} />
          <Toggle label="Text and shapes" checked={options.showAnnotations} onChange={(checked) => update({ showAnnotations: checked })} />
          <Toggle label="Column detail pages" checked={options.detailPages} onChange={(checked) => update({ detailPages: checked })} />
        </div>

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-400">
          The project title uses the font, color, size, offset, and wrap width from Wall & Modules. Readable scale and custom scale add extra
          pages when the wall does not fit, instead of shrinking labels until they disappear. Very large walls stay within 8 tiles on each side.
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={downloadPng}>
            Export PNG
          </Button>
          <Button variant="secondary" onClick={downloadSvg}>
            Export SVG
          </Button>
          <Button variant="primary" onClick={() => exportProjectPdf(project, options)}>
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
