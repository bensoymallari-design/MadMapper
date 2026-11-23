"use client";

import { create } from "zustand";
import { defaultTitleStyle, measureTextAnnotation } from "@/lib/annotations";
import { calculateCabinetLayout } from "@/lib/calculations";
import { buildLabel, findCabinetForModule, getModulesInCabinet, orderModulesForCabinet, parseLabelRange } from "@/lib/labeling";
import { generatePortMapping } from "@/lib/mapping";
import { fitPlacedInFrame, frameContaining, mainWallBox, placedSize } from "@/lib/placement";
import { createSampleProject, parseProject, regenerateModuleGeometry, serializeProject } from "@/lib/project";
import { effectiveSheet, normalizeSheet, pageFrames, pagesToCover } from "@/lib/sheet";
import type {
  CabinetSettings,
  CabinetSequenceDirection,
  CanvasAnnotation,
  CanvasImage,
  CanvasProjectDraft,
  DisplaySettings,
  LedModule,
  LedWallProject,
  MappingSettings,
  ModuleSettings,
  NumberingSettings,
  PlacedProject,
  PowerLoopRoute,
  PowerSettings,
  RoutingSettings,
  ShapeKind,
  SheetSettings,
  TitleStyle,
  ToolMode,
  WallSettings
} from "@/types/project";

interface ViewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface EditorState {
  project: LedWallProject;
  selectedModuleIds: string[];
  activeTool: ToolMode;
  activeRouteId: string | null;
  activePowerRouteId: string | null;
  selectedPowerCabinetId: string | null;
  selectedAnnotationId: string | null;
  selectedImageId: string | null;
  selectedPlacedId: string | null;
  selectedMainWall: boolean;
  shapeKind: ShapeKind;
  selectedColor: string;
  view: ViewState;
  past: LedWallProject[];
  future: LedWallProject[];
  setProjectName: (name: string) => void;
  updateTitleStyle: (settings: Partial<TitleStyle>) => void;
  updateWall: (settings: Partial<WallSettings>) => void;
  updateModuleSettings: (settings: Partial<ModuleSettings>) => void;
  updateNumbering: (settings: Partial<NumberingSettings>) => void;
  updateCabinet: (settings: Partial<CabinetSettings>) => void;
  createManualCabinetFromSelection: () => void;
  deleteManualCabinet: (cabinetId: string) => void;
  clearManualCabinets: () => void;
  updateMapping: (settings: Partial<MappingSettings>) => void;
  updateRouting: (settings: Partial<Omit<RoutingSettings, "routes">>) => void;
  updatePower: (settings: Partial<Omit<PowerSettings, "routes" | "cabinetSupplies">>) => void;
  updateDisplay: (settings: Partial<DisplaySettings>) => void;
  setActiveTool: (tool: ToolMode) => void;
  setSelectedColor: (color: string) => void;
  updatePortColor: (port: number, color: string) => void;
  updateReceivingRouteLabelColor: (routeId: string, color: string) => void;
  updatePowerRouteLabelColor: (routeId: string, color: string) => void;
  updatePowerRoute: (routeId: string, settings: Partial<Pick<PowerLoopRoute, "name" | "sourceLabel" | "endLabel" | "color">>) => void;
  setShapeKind: (kind: ShapeKind) => void;
  selectAnnotation: (id: string | null) => void;
  addAnnotation: (annotation: Omit<CanvasAnnotation, "id">) => void;
  updateAnnotation: (id: string, settings: Partial<CanvasAnnotation>, recordHistory?: boolean) => void;
  deleteAnnotation: (id: string) => void;
  deleteSelectedAnnotation: () => void;
  bringAnnotationToFront: (id: string) => void;
  updateSheet: (settings: Partial<SheetSettings>, recordHistory?: boolean) => void;
  addPage: () => void;
  coverPages: () => void;
  addPlacedProject: (json: string) => void;
  addCanvasProject: (draft: CanvasProjectDraft) => void;
  updatePlacedProject: (id: string, settings: Partial<Pick<PlacedProject, "name" | "x" | "y" | "scale">>, recordHistory?: boolean) => void;
  fitPlacedProject: (id: string) => void;
  fitMainWall: () => void;
  deletePlacedProject: (id: string) => void;
  addImage: (image: Omit<CanvasImage, "id">) => void;
  updateImage: (id: string, settings: Partial<Pick<CanvasImage, "name" | "x" | "y" | "width" | "height">>, recordHistory?: boolean) => void;
  deleteImage: (id: string) => void;
  selectImage: (id: string | null) => void;
  selectPlaced: (id: string | null) => void;
  selectMainWall: (selected: boolean) => void;
  pushHistorySnapshot: () => void;
  setView: (view: Partial<ViewState>) => void;
  selectModule: (id: string, append?: boolean) => void;
  selectModules: (ids: string[], append?: boolean) => void;
  selectAll: () => void;
  selectRow: (row: number) => void;
  selectColumn: (column: number) => void;
  clearSelection: () => void;
  updateSelectedModules: (changes: Partial<Pick<LedModule, "color" | "status" | "enabled" | "port" | "customLabel">>) => void;
  applySequentialLabelsToSelection: (prefix: string, startNumber: number, pad: number) => void;
  selectCurrentCabinetModules: () => void;
  applyCabinetSequenceLabels: (rangeInput: string, direction: CabinetSequenceDirection, scope: "currentCabinet" | "allCabinets") => void;
  assignMapping: () => void;
  startReceivingCardRoute: () => void;
  addCabinetToActiveRoute: (cabinetId: string) => void;
  finishReceivingCardRoute: () => void;
  clearReceivingCardRoutes: () => void;
  startPowerLoopRoute: () => void;
  addCabinetToActivePowerLoop: (cabinetId: string) => void;
  finishPowerLoopRoute: () => void;
  clearPowerLoopRoutes: () => void;
  selectPowerCabinet: (cabinetId: string | null) => void;
  setCabinetPowerSupplies: (cabinetId: string, count: number) => void;
  newProject: () => void;
  importProject: (json: string) => void;
  exportProjectJson: () => string;
  saveLocal: () => void;
  loadLocal: () => boolean;
  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 60;

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createSampleProject(),
  selectedModuleIds: [],
  activeTool: "select",
  activeRouteId: null,
  activePowerRouteId: null,
  selectedPowerCabinetId: null,
  selectedAnnotationId: null,
  selectedImageId: null,
  selectedPlacedId: null,
  selectedMainWall: false,
  shapeKind: "rect",
  selectedColor: "#2563eb",
  view: {
    zoom: 0.08,
    offsetX: 60,
    offsetY: 60
  },
  past: [],
  future: [],

  setProjectName: (name) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      projectName: name,
      updatedAt: new Date().toISOString()
    })),

  updateTitleStyle: (settings) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      titleStyle: { ...defaultTitleStyle, ...project.titleStyle, ...settings },
      updatedAt: new Date().toISOString()
    })),

  updateWall: (settings) =>
    setWithHistory(set, get, (project) =>
      regenerateModuleGeometry({
        ...project,
        wall: { ...project.wall, ...settings }
      })
    ),

  updateModuleSettings: (settings) =>
    setWithHistory(set, get, (project) =>
      regenerateModuleGeometry({
        ...project,
        module: { ...project.module, ...settings }
      })
    ),

  updateNumbering: (settings) =>
    setWithHistory(set, get, (project) =>
      regenerateModuleGeometry({
        ...project,
        numbering: { ...project.numbering, ...settings }
      })
    ),

  updateCabinet: (settings) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      cabinet: { ...project.cabinet, ...settings },
      updatedAt: new Date().toISOString()
    })),

  createManualCabinetFromSelection: () =>
    setWithHistory(set, get, (project) => {
      const selected = new Set(get().selectedModuleIds);
      const selectedModules = project.modules.filter((module) => selected.has(module.id));
      if (selectedModules.length === 0) return project;

      const minX = Math.min(...selectedModules.map((module) => module.x));
      const minY = Math.min(...selectedModules.map((module) => module.y));
      const maxX = Math.max(...selectedModules.map((module) => module.x + module.width));
      const maxY = Math.max(...selectedModules.map((module) => module.y + module.height));
      const row = Math.min(...selectedModules.map((module) => module.row));
      const column = Math.min(...selectedModules.map((module) => module.column));
      const modulesWide = new Set(selectedModules.map((module) => module.column)).size;
      const modulesHigh = new Set(selectedModules.map((module) => module.row)).size;
      const customCabinets = project.cabinet.customCabinets ?? [];
      const index = customCabinets.length + 1;

      return {
        ...project,
        cabinet: {
          ...project.cabinet,
          enabled: true,
          mode: "manual",
          customCabinets: [
            ...customCabinets,
            {
              id: `manual-cabinet-${Date.now()}`,
              index,
              row,
              column,
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
              modulesWide,
              modulesHigh,
              rotation: project.cabinet.rotation
            }
          ]
        },
        updatedAt: new Date().toISOString()
      };
    }),

  deleteManualCabinet: (cabinetId) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      cabinet: {
        ...project.cabinet,
        customCabinets: (project.cabinet.customCabinets ?? []).filter((cabinet) => cabinet.id !== cabinetId)
      },
      updatedAt: new Date().toISOString()
    })),

  clearManualCabinets: () =>
    setWithHistory(set, get, (project) => ({
      ...project,
      cabinet: {
        ...project.cabinet,
        customCabinets: []
      },
      updatedAt: new Date().toISOString()
    })),

  updateMapping: (settings) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      mapping: { ...project.mapping, ...settings },
      updatedAt: new Date().toISOString()
    })),

  updateRouting: (settings) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      routing: { ...getDefaultRouting(), ...project.routing, ...settings },
      updatedAt: new Date().toISOString()
    })),

  updatePower: (settings) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      power: { ...getDefaultPower(), ...project.power, ...settings },
      updatedAt: new Date().toISOString()
    })),

  updateDisplay: (settings) =>
    set((state) => ({
      project: patchContent(state, (project) => ({
        ...project,
        display: { ...project.display, ...settings },
        updatedAt: new Date().toISOString()
      }))
    })),

  setActiveTool: (activeTool) => set({ activeTool }),
  setSelectedColor: (selectedColor) => set({ selectedColor }),
  updatePortColor: (port, color) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      legend: {
        ...project.legend,
        ports: {
          ...project.legend.ports,
          [port]: color
        }
      },
      modules: project.modules.map((module) => (module.port === port ? { ...module, color } : module)),
      routing: {
        ...getDefaultRouting(),
        ...project.routing,
        routes: (project.routing?.routes ?? []).map((route) => (route.port === port ? { ...route, color } : route))
      },
      updatedAt: new Date().toISOString()
    })),

  updateReceivingRouteLabelColor: (routeId, color) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      routing: {
        ...getDefaultRouting(),
        ...project.routing,
        routes: (project.routing?.routes ?? []).map((route) => (route.id === routeId ? { ...route, labelColor: color } : route))
      },
      updatedAt: new Date().toISOString()
    })),

  updatePowerRouteLabelColor: (routeId, color) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      power: {
        ...getDefaultPower(),
        ...project.power,
        routes: (project.power?.routes ?? []).map((route) => (route.id === routeId ? { ...route, labelColor: color } : route))
      },
      updatedAt: new Date().toISOString()
    })),

  updatePowerRoute: (routeId, settings) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      power: {
        ...getDefaultPower(),
        ...project.power,
        routes: (project.power?.routes ?? []).map((route) => (route.id === routeId ? { ...route, ...settings } : route))
      },
      updatedAt: new Date().toISOString()
    })),

  setShapeKind: (shapeKind) => set({ shapeKind }),

  selectAnnotation: (selectedAnnotationId) =>
    set({ selectedAnnotationId, selectedImageId: null, selectedMainWall: false }),

  selectImage: (selectedImageId) =>
    set({ selectedImageId, selectedAnnotationId: null, selectedPlacedId: null, selectedMainWall: false, selectedModuleIds: [] }),

  selectPlaced: (selectedPlacedId) =>
    set({ selectedPlacedId, selectedAnnotationId: null, selectedImageId: null, selectedMainWall: false, selectedModuleIds: [] }),

  selectMainWall: (selectedMainWall) =>
    set({
      selectedMainWall,
      selectedPlacedId: selectedMainWall ? null : get().selectedPlacedId,
      selectedAnnotationId: selectedMainWall ? null : get().selectedAnnotationId,
      selectedImageId: selectedMainWall ? null : get().selectedImageId,
      selectedModuleIds: selectedMainWall ? [] : get().selectedModuleIds
    }),

  addAnnotation: (draft) => {
    const annotation = measureTextAnnotation({
      ...draft,
      id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    });
    setWithHistory(set, get, (project) => ({
      ...project,
      annotations: [...(project.annotations ?? []), annotation],
      updatedAt: new Date().toISOString()
    }));
    set({ selectedAnnotationId: annotation.id, selectedModuleIds: [] });
    if (annotation.kind === "text") set({ activeTool: "select" });
  },

  updateAnnotation: (id, settings, recordHistory = true) => {
    const apply = (project: LedWallProject) => ({
      ...project,
      annotations: (project.annotations ?? []).map((annotation) => {
        if (annotation.id !== id) return annotation;
        const next = { ...annotation, ...settings };
        return next.kind === "text" ? measureTextAnnotation(next) : next;
      }),
      updatedAt: new Date().toISOString()
    });
    if (recordHistory) setWithHistory(set, get, apply, "content");
    else set((state) => ({ project: patchContent(state, apply) }));
  },

  deleteAnnotation: (id) => {
    setWithHistory(set, get, (project) => ({
      ...project,
      annotations: (project.annotations ?? []).filter((annotation) => annotation.id !== id),
      updatedAt: new Date().toISOString()
    }));
    if (get().selectedAnnotationId === id) set({ selectedAnnotationId: null });
  },

  deleteSelectedAnnotation: () => {
    const id = get().selectedAnnotationId;
    if (id) get().deleteAnnotation(id);
  },

  bringAnnotationToFront: (id) =>
    setWithHistory(set, get, (project) => {
      const annotations = project.annotations ?? [];
      const selected = annotations.find((annotation) => annotation.id === id);
      if (!selected) return project;
      return {
        ...project,
        annotations: [...annotations.filter((annotation) => annotation.id !== id), selected],
        updatedAt: new Date().toISOString()
      };
    }),

  updateSheet: (settings, recordHistory = true) => {
    const apply = (project: LedWallProject) => ({
      ...project,
      sheet: normalizeSheet({ ...project.sheet, ...settings }),
      updatedAt: new Date().toISOString()
    });
    if (recordHistory) setWithHistory(set, get, apply, "root");
    else set((state) => ({ project: apply(state.project) }));
  },

  addPage: () =>
    setWithHistory(set, get, (project) => {
      const fitted = effectiveSheet(project);
      return {
        ...project,
        sheet: normalizeSheet({ ...fitted, pageCount: fitted.pageCount + 1, showGuides: true, lockOrientation: true }),
        updatedAt: new Date().toISOString()
      };
    }, "root"),

  coverPages: () =>
    setWithHistory(set, get, (project) => {
      const fitted = effectiveSheet(project);
      const cover = pagesToCover({ ...project, sheet: { ...fitted, lockOrientation: true } });
      return {
        ...project,
        sheet: normalizeSheet({
          ...fitted,
          pageCount: cover.pageCount,
          columns: cover.columns,
          showGuides: true,
          lockOrientation: true
        }),
        updatedAt: new Date().toISOString()
      };
    }, "root"),

  addPlacedProject: (json) => {
    const nested = parseProject(json);
    const placedProject: LedWallProject = { ...nested, placedProjects: [], images: [] };
    let placedId = "";
    setWithHistory(set, get, (project) => {
      const placed = withPlacedProject(project, placedProject, placedProject.projectName || `Project ${project.placedProjects.length + 2}`);
      placedId = placed.id;
      return placed.project;
    }, "root");
    set({ selectedPlacedId: placedId, selectedMainWall: false, selectedAnnotationId: null, selectedImageId: null, selectedModuleIds: [] });
  },

  addCanvasProject: (draft) => {
    const base = createSampleProject();
    const placedProject = regenerateModuleGeometry({
      ...base,
      projectName: draft.name.trim() || "New project",
      wall: { ...base.wall, width: draft.wallWidth, height: draft.wallHeight, unit: draft.unit },
      module: {
        width: draft.moduleWidth,
        height: draft.moduleHeight,
        pixelWidth: draft.pixelWidth,
        pixelHeight: draft.pixelHeight
      },
      cabinet: {
        ...base.cabinet,
        enabled: draft.cabinetWidth > 0 && draft.cabinetHeight > 0,
        mode: "auto",
        width: draft.cabinetWidth,
        height: draft.cabinetHeight
      }
    });
    let placedId = "";
    setWithHistory(set, get, (project) => {
      const placed = withPlacedProject(project, placedProject, placedProject.projectName);
      placedId = placed.id;
      return placed.project;
    }, "root");
    set({ selectedPlacedId: placedId, selectedMainWall: false, selectedAnnotationId: null, selectedImageId: null, selectedModuleIds: [] });
  },

  fitPlacedProject: (id) =>
    setWithHistory(set, get, (project) => {
      const frames = pageFrames(project);
      return {
        ...project,
        placedProjects: project.placedProjects.map((placed) => {
          if (placed.id !== id || frames.length === 0) return placed;
          const size = placedSize(placed);
          const frame = frameContaining(frames, placed.x + size.width / 2, placed.y + size.height / 2);
          return { ...placed, ...fitPlacedInFrame(placed.project.wall.width, placed.project.wall.height, frame) };
        }),
        updatedAt: new Date().toISOString()
      };
    }, "root"),

  fitMainWall: () =>
    setWithHistory(set, get, (project) => {
      const frames = pageFrames(project);
      if (frames.length === 0) return project;
      const box = mainWallBox(project);
      const frame = frameContaining(frames, box.x + box.width / 2, box.y + box.height / 2);
      const fitted = fitPlacedInFrame(project.wall.width, project.wall.height, frame);
      return {
        ...project,
        sheet: normalizeSheet({ ...project.sheet, wallX: fitted.x, wallY: fitted.y, wallScale: fitted.scale }),
        updatedAt: new Date().toISOString()
      };
    }, "root"),

  updatePlacedProject: (id, settings, recordHistory = true) => {
    const apply = (project: LedWallProject) => ({
      ...project,
      placedProjects: project.placedProjects.map((placed) => (placed.id === id ? { ...placed, ...settings } : placed)),
      updatedAt: new Date().toISOString()
    });
    if (recordHistory) setWithHistory(set, get, apply, "root");
    else set((state) => ({ project: apply(state.project) }));
  },

  deletePlacedProject: (id) => {
    setWithHistory(set, get, (project) => ({
      ...project,
      placedProjects: project.placedProjects.filter((placed) => placed.id !== id),
      updatedAt: new Date().toISOString()
    }), "root");
    if (get().selectedPlacedId === id) set({ selectedPlacedId: null });
  },

  addImage: (draft) => {
    const image: CanvasImage = {
      ...draft,
      id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    };
    setWithHistory(set, get, (project) => ({
      ...project,
      images: [...project.images, image],
      updatedAt: new Date().toISOString()
    }), "root");
    set({ selectedImageId: image.id, selectedAnnotationId: null, selectedPlacedId: null, selectedModuleIds: [] });
  },

  updateImage: (id, settings, recordHistory = true) => {
    const apply = (project: LedWallProject) => ({
      ...project,
      images: project.images.map((image) => (image.id === id ? { ...image, ...settings } : image)),
      updatedAt: new Date().toISOString()
    });
    if (recordHistory) setWithHistory(set, get, apply, "root");
    else set((state) => ({ project: apply(state.project) }));
  },

  deleteImage: (id) => {
    setWithHistory(set, get, (project) => ({
      ...project,
      images: project.images.filter((image) => image.id !== id),
      updatedAt: new Date().toISOString()
    }), "root");
    if (get().selectedImageId === id) set({ selectedImageId: null });
  },

  pushHistorySnapshot: () =>
    set((state) => ({
      past: [...state.past, cloneProject(state.project)].slice(-HISTORY_LIMIT),
      future: []
    })),
  setView: (view) => set((state) => ({ view: { ...state.view, ...view } })),

  selectModule: (id, append = false) =>
    set((state) => {
      if (!append) return { selectedModuleIds: [id], selectedMainWall: false };
      const selected = new Set(state.selectedModuleIds);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return { selectedModuleIds: Array.from(selected), selectedMainWall: false };
    }),

  selectModules: (ids, append = false) =>
    set((state) => ({
      selectedModuleIds: append ? Array.from(new Set([...state.selectedModuleIds, ...ids])) : ids
    })),

  selectAll: () =>
    set((state) => ({
      selectedModuleIds: editedProject(state).modules.map((module) => module.id)
    })),

  selectRow: (row) =>
    set((state) => ({
      selectedModuleIds: editedProject(state).modules.filter((module) => module.row === row).map((module) => module.id)
    })),

  selectColumn: (column) =>
    set((state) => ({
      selectedModuleIds: editedProject(state).modules
        .filter((module) => module.column === column)
        .map((module) => module.id)
    })),

  clearSelection: () => set({ selectedModuleIds: [], selectedMainWall: false }),

  updateSelectedModules: (changes) =>
    setWithHistory(set, get, (project) => {
      const selected = new Set(get().selectedModuleIds);
      return {
        ...project,
        modules: project.modules.map((module) =>
          selected.has(module.id)
            ? {
                ...module,
                ...changes
              }
            : module
        ),
        updatedAt: new Date().toISOString()
      };
    }),

  applySequentialLabelsToSelection: (prefix, startNumber, pad) =>
    setWithHistory(set, get, (project) => {
      const selected = new Set(get().selectedModuleIds);
      const selectedModules = project.modules
        .filter((module) => selected.has(module.id))
        .sort((a, b) => a.row - b.row || a.column - b.column);
      const labelById = new Map(
        selectedModules.map((module, index) => [
          module.id,
          `${prefix}${String(startNumber + index).padStart(Math.max(1, pad), "0")}`
        ])
      );

      return {
        ...project,
        modules: project.modules.map((module) => ({
          ...module,
          customLabel: labelById.get(module.id) ?? module.customLabel
        })),
        updatedAt: new Date().toISOString()
      };
    }),

  selectCurrentCabinetModules: () =>
    set((state) => {
      const project = editedProject(state);
      const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
      const selected = new Set(state.selectedModuleIds);
      const firstSelected = project.modules.find((module) => selected.has(module.id));
      const cabinet = findCabinetForModule(cabinets, firstSelected);
      if (!cabinet) return state;

      return {
        selectedModuleIds: getModulesInCabinet(cabinet, project.modules).map((module) => module.id)
      };
    }),

  applyCabinetSequenceLabels: (rangeInput, direction, scope) =>
    setWithHistory(set, get, (project) => {
      const range = parseLabelRange(rangeInput);
      const cabinets = calculateCabinetLayout(project.wall, project.module, project.cabinet);
      const selected = new Set(get().selectedModuleIds);
      const firstSelected = project.modules.find((module) => selected.has(module.id));
      const currentCabinet = findCabinetForModule(cabinets, firstSelected);
      const targetCabinets = scope === "allCabinets" ? cabinets : currentCabinet ? [currentCabinet] : [];

      if (targetCabinets.length === 0) return project;

      const labelById = new Map<string, string>();
      targetCabinets.forEach((cabinet) => {
        const cabinetModules = orderModulesForCabinet(getModulesInCabinet(cabinet, project.modules), direction);
        cabinetModules.forEach((module, index) => {
          const label = buildLabel(range, index);
          if (label) labelById.set(module.id, label);
        });
      });

      return {
        ...project,
        modules: project.modules.map((module) => ({
          ...module,
          customLabel: labelById.get(module.id) ?? module.customLabel
        })),
        updatedAt: new Date().toISOString()
      };
    }),

  assignMapping: () =>
    setWithHistory(set, get, (project) => {
      const { modules } = generatePortMapping(
        project.modules,
        Math.max(...project.modules.map((module) => module.row)) + 1,
        Math.max(...project.modules.map((module) => module.column)) + 1,
        project.mapping,
        project.legend.ports
      );
      return {
        ...project,
        modules,
        updatedAt: new Date().toISOString()
      };
    }),

  startReceivingCardRoute: () => {
    const state = get();
    const currentRouting = editedProject(state).routing ?? getDefaultRouting();
    const nextIndex = currentRouting.routes.length + 1;
    const routeId = `route-${Date.now()}`;
    setWithHistory(set, get, (project) => ({
      ...project,
      routing: {
        ...getDefaultRouting(),
        ...project.routing,
        enabled: true,
        showLabels: true,
        routes: [
          ...(project.routing?.routes ?? []),
          {
            id: routeId,
            name: `Receiver Route ${nextIndex}`,
            port: nextIndex,
            color: project.legend.ports[nextIndex] ?? "#38bdf8",
            labelColor: "#e0f2fe",
            cabinetIds: [],
            startLabel: `MAIN PORT ${nextIndex}`,
            endLabel: "END",
            backupLabel: `BACKUP PORT ${nextIndex}`
          }
        ]
      },
      updatedAt: new Date().toISOString()
    }));
    set({ activeRouteId: routeId, activeTool: "mapping" });
  },

  addCabinetToActiveRoute: (cabinetId) =>
    setWithHistory(set, get, (project) => {
      const activeRouteId = get().activeRouteId;
      if (!activeRouteId) return project;

      return {
        ...project,
        routing: {
          ...getDefaultRouting(),
          ...project.routing,
          routes: (project.routing?.routes ?? []).map((route) => {
            if (route.id !== activeRouteId || route.cabinetIds.includes(cabinetId)) return route;
            return {
              ...route,
              cabinetIds: [...route.cabinetIds, cabinetId]
            };
          })
        },
        updatedAt: new Date().toISOString()
      };
    }),

  finishReceivingCardRoute: () => set({ activeRouteId: null }),

  clearReceivingCardRoutes: () =>
    setWithHistory(set, get, (project) => ({
      ...project,
      routing: {
        ...getDefaultRouting(),
        ...project.routing,
        routes: []
      },
      updatedAt: new Date().toISOString()
    })),

  startPowerLoopRoute: () => {
    const state = get();
    const currentPower = editedProject(state).power ?? getDefaultPower();
    const nextIndex = currentPower.routes.length + 1;
    const routeId = `power-route-${Date.now()}`;
    setWithHistory(set, get, (project) => ({
      ...project,
      power: {
        ...getDefaultPower(),
        ...project.power,
        enabled: true,
        showLabels: true,
        routes: [
          ...(project.power?.routes ?? []),
          {
            id: routeId,
            name: `AC loop ${nextIndex}`,
            color: "#f97316",
            labelColor: "#fff7ed",
            cabinetIds: [],
            sourceLabel: `AC loop ${nextIndex}`,
            endLabel: `AC loop end ${nextIndex}`
          }
        ]
      },
      updatedAt: new Date().toISOString()
    }));
    set({ activePowerRouteId: routeId, activeTool: "power" });
  },

  addCabinetToActivePowerLoop: (cabinetId) =>
    setWithHistory(set, get, (project) => {
      const activePowerRouteId = get().activePowerRouteId;
      if (!activePowerRouteId) return project;

      return {
        ...project,
        power: {
          ...getDefaultPower(),
          ...project.power,
          routes: (project.power?.routes ?? []).map((route) => {
            if (route.id !== activePowerRouteId || route.cabinetIds.includes(cabinetId)) return route;
            return {
              ...route,
              cabinetIds: [...route.cabinetIds, cabinetId]
            };
          })
        },
        updatedAt: new Date().toISOString()
      };
    }),

  finishPowerLoopRoute: () => set({ activePowerRouteId: null }),

  clearPowerLoopRoutes: () =>
    {
      setWithHistory(set, get, (project) => ({
        ...project,
        power: {
          ...getDefaultPower(),
          ...project.power,
          routes: []
        },
        updatedAt: new Date().toISOString()
      }));
      set({ activePowerRouteId: null });
    },

  selectPowerCabinet: (cabinetId) => set({ selectedPowerCabinetId: cabinetId }),

  setCabinetPowerSupplies: (cabinetId, count) =>
    setWithHistory(set, get, (project) => ({
      ...project,
      power: {
        ...getDefaultPower(),
        ...project.power,
        cabinetSupplies: {
          ...(project.power?.cabinetSupplies ?? {}),
          [cabinetId]: Math.max(0, Math.round(count))
        }
      },
      updatedAt: new Date().toISOString()
    })),

  newProject: () =>
    set((state) => ({
      project: createSampleProject(),
      selectedModuleIds: [],
      activeRouteId: null,
      activePowerRouteId: null,
      selectedPowerCabinetId: null,
      selectedAnnotationId: null,
      past: [...state.past.slice(-HISTORY_LIMIT + 1), cloneProject(state.project)],
      future: []
    })),

  importProject: (json) =>
    set((state) => ({
      project: parseProject(json),
      selectedModuleIds: [],
      activeRouteId: null,
      activePowerRouteId: null,
      selectedPowerCabinetId: null,
      selectedAnnotationId: null,
      past: [...state.past.slice(-HISTORY_LIMIT + 1), cloneProject(state.project)],
      future: []
    })),

  exportProjectJson: () => serializeProject(get().project),

  saveLocal: () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("led-wall-mapper-project", serializeProject(get().project));
    }
  },

  loadLocal: () => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("led-wall-mapper-project");
    if (!stored) return false;
    get().importProject(stored);
    return true;
  },

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        project: previous,
        past: state.past.slice(0, -1),
        future: [cloneProject(state.project), ...state.future].slice(0, HISTORY_LIMIT),
        activeRouteId: null,
        activePowerRouteId: null,
        selectedPowerCabinetId: null,
        selectedAnnotationId: null,
        selectedImageId: null,
        selectedPlacedId: null,
        selectedMainWall: false,
        selectedModuleIds: []
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        project: next,
        past: [...state.past, cloneProject(state.project)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        activeRouteId: null,
        activePowerRouteId: null,
        selectedPowerCabinetId: null,
        selectedAnnotationId: null,
        selectedImageId: null,
        selectedPlacedId: null,
        selectedMainWall: false,
        selectedModuleIds: []
      };
    })
}));

function withPlacedProject(project: LedWallProject, placedProject: LedWallProject, name: string) {
  const fitted = effectiveSheet(project);
  const pageCount = Math.max(fitted.pageCount, project.placedProjects.length + 2);
  const frames = pageFrames({ ...project, sheet: { ...fitted, pageCount, lockOrientation: true } });
  const index = Math.min(project.placedProjects.length + 1, frames.length - 1);
  const fittedPlacement = fitPlacedInFrame(placedProject.wall.width, placedProject.wall.height, frames[index]);
  const id = `placed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    project: {
      ...project,
      sheet: normalizeSheet({ ...fitted, pageCount: Math.max(pageCount, index + 1), showGuides: true, lockOrientation: true }),
      placedProjects: [
        ...project.placedProjects,
        {
          id,
          name,
          ...fittedPlacement,
          project: { ...placedProject, placedProjects: [], images: [] }
        }
      ],
      updatedAt: new Date().toISOString()
    }
  };
}

function setWithHistory(
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  updater: (project: LedWallProject) => LedWallProject,
  target: "root" | "content" = "content"
) {
  const state = get();
  const root = state.project;
  const placedId = target === "content" ? state.selectedPlacedId : null;
  const current = placedId ? editedProject(state) : root;
  const nextContent = updater(cloneProject(current));
  const next = placedId && current !== root ? writeContent(root, placedId, nextContent) : nextContent;
  set({
    project: next,
    past: [...state.past, cloneProject(root)].slice(-HISTORY_LIMIT),
    future: []
  });
}

export function useEditedProject() {
  return useEditorStore((state) => editedProject(state));
}

function editedProject(state: Pick<EditorState, "project" | "selectedPlacedId">) {
  const placed = state.selectedPlacedId
    ? state.project.placedProjects.find((item) => item.id === state.selectedPlacedId)
    : null;
  return placed?.project ?? state.project;
}

function writeContent(root: LedWallProject, placedId: string, next: LedWallProject): LedWallProject {
  return {
    ...root,
    placedProjects: root.placedProjects.map((placed) =>
      placed.id === placedId
        ? {
            ...placed,
            name: next.projectName?.trim() || placed.name,
            project: { ...next, placedProjects: [], images: next.images ?? [] }
          }
        : placed
    ),
    updatedAt: new Date().toISOString()
  };
}

function patchContent(state: EditorState, updater: (project: LedWallProject) => LedWallProject) {
  const current = editedProject(state);
  const next = updater(current);
  return state.selectedPlacedId && current !== state.project ? writeContent(state.project, state.selectedPlacedId, next) : next;
}

function cloneProject(project: LedWallProject): LedWallProject {
  return JSON.parse(JSON.stringify(project)) as LedWallProject;
}

function getDefaultRouting(): RoutingSettings {
  return {
    enabled: true,
    showLabels: true,
    routes: []
  };
}

function getDefaultPower(): PowerSettings {
  return {
    enabled: false,
    showLabels: true,
    showSupplyBadges: false,
    defaultSuppliesPerCabinet: 1,
    cabinetSupplies: {},
    routes: []
  };
}
