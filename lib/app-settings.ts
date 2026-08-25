export interface ToolSettings {
  requireLocationScanOnReturn: boolean;
  allowManualLocationCode: boolean;
  askVehicleOnLoan: boolean;
  requireVehicleOnLoan: boolean;
  employeesCanMarkMissing: boolean;
  requirePhotoOnCreate: boolean;
  allowReturnIncidents: boolean;
  requireIncidentComment: boolean;
  loanOverdueHours: number;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  requireLocationScanOnReturn: true,
  allowManualLocationCode: true,
  askVehicleOnLoan: true,
  requireVehicleOnLoan: false,
  employeesCanMarkMissing: true,
  requirePhotoOnCreate: false,
  allowReturnIncidents: true,
  requireIncidentComment: true,
  loanOverdueHours: 24,
};

export function normalizeToolSettings(value: unknown): ToolSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_TOOL_SETTINGS };
  const booleanKeys: Array<Exclude<keyof ToolSettings, "loanOverdueHours">> = ["requireLocationScanOnReturn", "allowManualLocationCode", "askVehicleOnLoan", "requireVehicleOnLoan", "employeesCanMarkMissing", "requirePhotoOnCreate", "allowReturnIncidents", "requireIncidentComment"];
  for (const key of booleanKeys) {
    if (typeof input[key] === "boolean") result[key] = input[key];
  }
  const overdueHours = Number(input.loanOverdueHours);
  if (Number.isFinite(overdueHours)) result.loanOverdueHours = Math.min(24 * 30, Math.max(1, Math.round(overdueHours)));
  if (!result.askVehicleOnLoan) result.requireVehicleOnLoan = false;
  if (!result.allowReturnIncidents) result.requireIncidentComment = false;
  return result;
}

export interface WarehouseSettings {
  employeesCanCreatePieces: boolean;
  employeesCanUploadPhotos: boolean;
  employeesCanChooseMainPhoto: boolean;
  employeesCanLocatePieces: boolean;
  employeesCanManageDrawerContents: boolean;
  employeesCanRegisterSales: boolean;
}

export const DEFAULT_WAREHOUSE_SETTINGS: WarehouseSettings = {
  employeesCanCreatePieces: true,
  employeesCanUploadPhotos: true,
  employeesCanChooseMainPhoto: true,
  employeesCanLocatePieces: true,
  employeesCanManageDrawerContents: true,
  employeesCanRegisterSales: true,
};

export function normalizeWarehouseSettings(value: unknown): WarehouseSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_WAREHOUSE_SETTINGS };
  for (const key of Object.keys(result) as Array<keyof WarehouseSettings>) {
    if (typeof input[key] === "boolean") result[key] = input[key];
  }
  if (!result.employeesCanUploadPhotos) result.employeesCanChooseMainPhoto = false;
  return result;
}
