import type { DesktopWorkspace } from "@t3tools/contracts";
import { create } from "zustand";

const readBridge = () => (typeof window === "undefined" ? undefined : window.desktopBridge);

interface WorkspacesState {
  readonly workspaces: ReadonlyArray<DesktopWorkspace>;
  readonly setWorkspaces: (workspaces: ReadonlyArray<DesktopWorkspace>) => void;
}

export const useWorkspacesStore = create<WorkspacesState>((set) => ({
  workspaces: readBridge()?.getWorkspaces() ?? [],
  setWorkspaces: (workspaces) => set({ workspaces }),
}));
