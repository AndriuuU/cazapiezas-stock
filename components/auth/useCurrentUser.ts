"use client";

import { useEffect, useState } from "react";
import type { AppUser } from "@/lib/app-users";

export function useCurrentUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then((payload: { user?: AppUser }) => setUser(payload.user || null)).catch(() => setUser(null));
  }, []);
  return user;
}
