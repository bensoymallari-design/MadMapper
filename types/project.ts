export type Unit = "mm" | "cm" | "m";

export type Orientation = "landscape" | "portrait" | "custom";

export type ModuleStatus = "installed" | "missing" | "damaged" | "spare" | "unused";

export type NumberingMode =
  | "rowColumn"
  | "snake"
  | "vertical"
  | "reverseRow"
  | "reverseColumn"
  | "custom";

export type StartingCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export type ToolMode =
  | "select"
  | "pan"
  | "color"
  | "mapping"
  | "power"
  | "cabinet"
  | "measure"
  | "dimension";

export interface WallSettings {
  width: number;
  height: number;
  unit: Unit;
  orientation: Orientation;
  rotation: 0 | 90 | 180 | 270;
}

export interface ModuleSettings {
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface NumberingSettings {
  mode: NumberingMode;
  startNumber: number;
  prefix: string;
  separator: string;
  pad: number;
  startingCorner: StartingCorner;
  horizontalDirection: "leftToRight" | "rightToLeft";
  verticalDirection: "topToBottom" | "bottomToTop";
  snake: boolean;
}

export interface CabinetSettings {
  enabled: boolean;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface MappingSettings {
  enabled: boolean;
  portCount: number;
  modulesPerPort: number;
  snake: boolean;
  direction: "horizontal" | "vertical";
  startingCorner: StartingCorner;
}

export interface ReceivingCardRoute {
  id: string;
  name: string;
  port: number;
  color: string;
  labelColor: string;
  cabinetIds: string[];
  startLabel: string;
  endLabel: string;
  backupLabel: string;
}

export interface RoutingSettings {
  enabled: boolean;
  showLabels: boolean;
  routes: ReceivingCardRoute[];
}

export interface PowerLoopRoute {
  id: string;
  name: string;
  color: string;
  labelColor: string;
  cabinetIds: string[];
  sourceLabel: string;
  endLabel: string;
}

export interface PowerSettings {
  enabled: boolean;
  showLabels: boolean;
  showSupplyBadges: boolean;
  defaultSuppliesPerCabinet: number;
  cabinetSupplies: Record<string, number>;
  routes: PowerLoopRoute[];
}

export interface DisplaySettings {
  showGrid: boolean;
  showNumbers: boolean;
  moduleTextColor: string;
  showCabinets: boolean;
  showDataPaths: boolean;
  showDimensions: boolean;
  showCoordinates: boolean;
}

export interface LedModule {
  id: string;
  row: number;
  column: number;
  number: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  status: ModuleStatus;
  enabled: boolean;
  color: string;
  port: number | null;
  customLabel?: string;
}

export interface Cabinet {
  id: string;
  index: number;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  modulesWide: number;
  modulesHigh: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface PortPath {
  port: number;
  color: string;
  modules: string[];
}

export interface ValidationWarning {
  id: string;
  severity: "warning" | "error";
  message: string;
  action?: "keepPartial" | "adjustWall" | "adjustModule";
}

export interface LedWallProject {
  version: 1;
  projectName: string;
  wall: WallSettings;
  module: ModuleSettings;
  numbering: NumberingSettings;
  cabinet: CabinetSettings;
  mapping: MappingSettings;
  routing: RoutingSettings;
  power: PowerSettings;
  display: DisplaySettings;
  modules: LedModule[];
  legend: {
    ports: Record<number, string>;
    statuses: Record<ModuleStatus, string>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LayoutMetrics {
  columns: number;
  rows: number;
  totalModules: number;
  activeModules: number;
  partialWidth: number;
  partialHeight: number;
  wallPixelWidth: number;
  wallPixelHeight: number;
  totalPixels: number;
  modulesWideExact: number;
  modulesHighExact: number;
}
