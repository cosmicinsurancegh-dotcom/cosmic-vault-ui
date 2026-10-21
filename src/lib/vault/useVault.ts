import { useAuth } from "@/hooks/use-auth";
import { isStaff } from "@/lib/permissions";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { DEMO_OWNER } from "./demoData";
import {
  activitiesForMinerals,
  getServerSnapshot,
  getSnapshot,
  metricsForMinerals,
  mineralsForActor,
  subscribe,
} from "./store";
import type { Mineral, VaultActor, VaultMetrics } from "./types";

const DEMO_ROLE_KEY = "cosmic-vault.demo-operations";
const demoListeners = new Set<() => void>();
let demoRole = false;
let demoRoleLoaded = false;

function readDemoRole() {
  if (typeof window === "undefined") return false;
  if (demoRoleLoaded) return demoRole;
  demoRoleLoaded = true;
  try {
    demoRole = window.localStorage.getItem(DEMO_ROLE_KEY) === "1";
  } catch {
    demoRole = false;
  }
  return demoRole;
}

function subscribeDemoRole(listener: () => void) {
  demoListeners.add(listener);
  return () => demoListeners.delete(listener);
}

export function setDemoOperations(enabled: boolean) {
  demoRole = enabled;
  demoRoleLoaded = true;
  try {
    if (enabled) {
      window.localStorage.setItem(DEMO_ROLE_KEY, "1");
    } else {
      window.localStorage.removeItem(DEMO_ROLE_KEY);
    }
  } catch {
    // The in-memory switch still works for this session.
  }
  demoListeners.forEach((listener) => listener());
}

export function useDemoOperations() {
  return useSyncExternalStore(
    subscribeDemoRole,
    readDemoRole,
    () => false,
  );
}

export function useVaultActor() {
  const { user, isLoading } = useAuth();
  const demoOperations = useDemoOperations();
  const anonymous = Boolean(user?.isAnonymous);
  const staff = isStaff(user?.role);
  const demoAdmin = anonymous && demoOperations;

  const actor = useMemo<VaultActor>(() => {
    if (staff) {
      return {
        role: "admin",
        userId: user?._id ?? "staff",
        ownerId: user?._id ?? "staff",
        name: user?.name ?? "Vault operations",
        email: user?.email ?? "",
        isDemo: false,
      };
    }
    if (demoAdmin) {
      return {
        role: "admin",
        userId: "demo-staff",
        ownerId: "demo-staff",
        name: "Iris Chen",
        email: "iris.chen@cosmicvault.example",
        isDemo: true,
      };
    }
    if (anonymous) {
      return {
        role: "client",
        userId: "demo-viewer",
        ownerId: DEMO_OWNER.id,
        name: DEMO_OWNER.name,
        email: DEMO_OWNER.email,
        isDemo: true,
      };
    }
    return {
      role: "client",
      userId: user?._id ?? "guest",
      ownerId: user?._id ?? "guest",
      name: user?.name ?? "Vault member",
      email: user?.email ?? "",
      isDemo: false,
    };
  }, [
    anonymous,
    demoAdmin,
    staff,
    user?._id,
    user?.email,
    user?.name,
  ]);

  return {
    actor,
    isLoading,
    canSwitchDemoRole: anonymous,
    demoOperations,
    setDemoOperations,
  };
}

export type VaultData = {
  ready: boolean;
  minerals: Mineral[];
  metrics: VaultMetrics;
  activities: ReturnType<typeof activitiesForMinerals>;
  savedAt: number;
  allMinerals: Mineral[];
};

export function useVaultData(actor: VaultActor): VaultData {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return useMemo(() => {
    const minerals = mineralsForActor(actor, snapshot.minerals);
    return {
      ready: snapshot.ready,
      minerals,
      allMinerals: snapshot.minerals,
      metrics: metricsForMinerals(minerals),
      activities: activitiesForMinerals(actor, minerals),
      savedAt: snapshot.savedAt,
    };
  }, [actor, snapshot]);
}

export function useVaultMineral(actor: VaultActor, mineralId: string | null) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return useMemo(() => {
    if (!mineralId) return null;
    const mineral = snapshot.minerals.find((item) => item.id === mineralId);
    if (!mineral) return null;
    if (actor.role !== "admin" && mineral.ownerId !== actor.ownerId) return null;
    return mineral;
  }, [actor, mineralId, snapshot.minerals]);
}

/** Refresh the demo role when the signed-in identity changes underneath it. */
export function useResetDemoRoleOnSignOut(isAnonymous: boolean) {
  useEffect(() => {
    if (!isAnonymous && readDemoRole()) {
      setDemoOperations(false);
    }
  }, [isAnonymous]);
}
