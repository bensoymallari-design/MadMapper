"use client";

import { create } from "zustand";
import { generatePortMapping } from "@/lib/mapping";
import { createSampleProject, parseProject, regenerateModuleGeometry, serializeProject } from "@/lib/project";
import type {
  CabinetSettings,
  DisplaySettings,
  LedModule,
  LedWallProject,
  MappingSettings,
  ModuleSettings,
  NumberingSettings,
  PowerSettings,
  RoutingSettings,
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
  selectedColor: string;
  view: ViewState;
  past: LedWallProject[];
  future: LedWallProject[];
  setProjectName: (name: string) => void;
  updateWall: (settings: Partial<WallSettings>) => void;
  updateModuleSettings: (settings: Partial<ModuleSettings>) => void;
  updateNumbering: (settings: Partial<NumberingSettings>) => void;
  updateCabinet: (settings: Partial<CabinetSettings>) => void;
  updateMapping: (settings: Partial<MappingSettings>) => void;
  updateRouting: (settings: Partial<Omit<RoutingSettings, "routes">>) => void;
  updatePower: (settings: Partial<Omit<PowerSettings, "routes" | "cabinetSupplies">>) => void;
  updateDisplay: (settings: Partial<DisplaySettings>) => void;
  setActiveTool: (tool: ToolMode) => void;
  setSelectedColor: (color: string) => void;
  updatePortColor: (port: number, color: string) => void;
  setView: (view: Partial<ViewState>) => void;
  selectModule: (id: string, append?: boolean) => void;
  selectModules: (ids: string[], append?: boolean) => void;
  selectAll: () => void;
  selectRow: (row: number) => void;
  selectColumn: (column: number) => void;
  clearSelection: () => void;
  updateSelectedModules: (changes: Partial<Pick<LedModule, "color" | "status" | "enabled" | "port" | "customLabel">>) => void;
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
      project: {
        ...state.project,
        display: { ...state.project.display, ...settings },
        updatedAt: new Date().toISOString()
      }
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
  setView: (view) => set((state) => ({ view: { ...state.view, ...view } })),

  selectModule: (id, append = false) =>
    set((state) => {
      if (!append) return { selectedModuleIds: [id] };
      const selected = new Set(state.selectedModuleIds);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return { selectedModuleIds: Array.from(selected) };
    }),

  selectModules: (ids, append = false) =>
    set((state) => ({
      selectedModuleIds: append ? Array.from(new Set([...state.selectedModuleIds, ...ids])) : ids
    })),

  selectAll: () =>
    set((state) => ({
      selectedModuleIds: state.project.modules.map((module) => module.id)
    })),

  selectRow: (row) =>
    set((state) => ({
      selectedModuleIds: state.project.modules.filter((module) => module.row === row).map((module) => module.id)
    })),

  selectColumn: (column) =>
    set((state) => ({
      selectedModuleIds: state.project.modules
        .filter((module) => module.column === column)
        .map((module) => module.id)
    })),

  clearSelection: () => set({ selectedModuleIds: [] }),

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
    const currentRouting = state.project.routing ?? getDefaultRouting();
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
    const currentPower = state.project.power ?? getDefaultPower();
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
            name: `DC Power Loop ${nextIndex}`,
            color: "#f97316",
            cabinetIds: [],
            sourceLabel: `DC PSU SOURCE ${nextIndex}`,
            endLabel: `DC LOOP END ${nextIndex}`
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
        selectedModuleIds: []
      };
    })
}));

function setWithHistory(
  set: (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  updater: (project: LedWallProject) => LedWallProject
) {
  const current = get().project;
  set({
    project: updater(cloneProject(current)),
    past: [...get().past, cloneProject(current)].slice(-HISTORY_LIMIT),
    future: []
  });
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
    enabled: true,
    showLabels: true,
    showSupplyBadges: true,
    defaultSuppliesPerCabinet: 1,
    cabinetSupplies: {},
    routes: []
  };
}
