"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { exportProjectPdf, type PdfOrientation, type PdfPageSize } from "@/lib/pdf";
import { generateProjectSvg } from "@/lib/svg";
import { useEditorStore } from "@/store/editorStore";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { project } = useEditorStore();
  const [pageSize, setPageSize] = useState<PdfPageSize>("a3");
  const [orientation, setOrientation] = useState<PdfOrientation>("landscape");

  if (!open) return null;

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
      canvas.width = Math.min(6000, image.width * 2);
      canvas.height = Math.min(6000, image.height * 2);
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
      <div className="panel w-full max-w-xl rounded-2xl p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-sky-50">Export technical documentation</h2>
            <p className="text-sm text-slate-400">Generate PDF, SVG, or PNG assets for the current LED-wall layout.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">PDF page size</span>
            <select className="field" value={pageSize} onChange={(event) => setPageSize(event.target.value as PdfPageSize)}>
              <option value="a4">A4</option>
              <option value="a3">A3</option>
              <option value="a2">A2</option>
              <option value="a1">A1</option>
            </select>
          </label>
          <label>
            <span className="label">Orientation</span>
            <select className="field" value={orientation} onChange={(event) => setOrientation(event.target.value as PdfOrientation)}>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-300">
          <div className="font-semibold text-sky-100">PDF includes</div>
          <p className="mt-1 text-xs text-slate-400">
            Project information, wall/module dimensions, module layout, total resolution, vector module grid, cabinet boundaries, port legend,
            dimensions, and automatic detail pages for dense layouts.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={downloadPng}>
            Export PNG
          </Button>
          <Button variant="secondary" onClick={downloadSvg}>
            Export SVG
          </Button>
          <Button variant="primary" onClick={() => exportProjectPdf(project, { pageSize, orientation })}>
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
