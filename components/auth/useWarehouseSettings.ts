"use client";

import { useEffect, useState } from "react";
import { DEFAULT_WAREHOUSE_SETTINGS, type WarehouseSettings } from "@/lib/app-settings";

export function useWarehouseSettings() {
  const [settings, setSettings] = useState<WarehouseSettings>(DEFAULT_WAREHOUSE_SETTINGS);
  useEffect(() => {
    void fetch("/api/configuracion/almacen-desguace", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { settings?: WarehouseSettings }) => setSettings(payload.settings || DEFAULT_WAREHOUSE_SETTINGS))
      .catch(() => setSettings(DEFAULT_WAREHOUSE_SETTINGS));
  }, []);
  return settings;
}
