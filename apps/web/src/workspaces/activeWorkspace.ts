import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import {
  PRIMARY_LOCAL_ENVIRONMENT_ID,
  WORKSPACE_BACKEND_ID_PREFIX,
  type DesktopWorkspace,
  type EnvironmentId,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";

import { desktopLocalBackendId } from "../connection/desktopLocal";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useEnvironments, usePrimaryEnvironmentId } from "../state/environments";

const ACTIVE_WORKSPACE_STORAGE_KEY = "t3code:active-workspace:v1";
const ActiveWorkspaceSchema = Schema.NullOr(Schema.String);
const NO_ENVIRONMENTS: ReadonlySet<EnvironmentId> = new Set();
const WORKSPACE_COLOR_CLASSES = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-pink-500",
] as const;

export interface WorkspaceOption {
  readonly backendId: string | null;
  readonly label: string;
  readonly workspaceId: string | null;
}

export const workspaceBackendId = (workspace: Pick<DesktopWorkspace, "id">) =>
  `${WORKSPACE_BACKEND_ID_PREFIX}${workspace.id}`;

export function workspaceOptions(
  workspaces: ReadonlyArray<DesktopWorkspace>,
): ReadonlyArray<WorkspaceOption> {
  return [
    { backendId: null, label: "All workspaces", workspaceId: null },
    { backendId: PRIMARY_LOCAL_ENVIRONMENT_ID, label: "Default", workspaceId: null },
    ...workspaces.map((workspace) => ({
      backendId: workspaceBackendId(workspace),
      label: workspace.name,
      workspaceId: workspace.id,
    })),
  ];
}

export function workspaceColorClass(workspaceId: string): string {
  let hash = 0;
  for (const character of workspaceId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return WORKSPACE_COLOR_CLASSES[hash % WORKSPACE_COLOR_CLASSES.length] ?? "bg-sky-500";
}

export function resolveWorkspaceEnvironmentIds(input: {
  readonly activeBackendId: string | null;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly environments: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly entry: { readonly target: ConnectionTarget };
  }>;
}): ReadonlySet<EnvironmentId> | null {
  const { activeBackendId, primaryEnvironmentId, environments } = input;
  if (activeBackendId === null) return null;
  if (activeBackendId === PRIMARY_LOCAL_ENVIRONMENT_ID) {
    return primaryEnvironmentId === null ? NO_ENVIRONMENTS : new Set([primaryEnvironmentId]);
  }
  const environment = environments.find(
    (candidate) => desktopLocalBackendId(candidate.entry.target) === activeBackendId,
  );
  return environment === undefined ? NO_ENVIRONMENTS : new Set([environment.environmentId]);
}

export function keepInActiveWorkspace<TItem extends { readonly environmentId: EnvironmentId }>(
  items: ReadonlyArray<TItem>,
  environmentIds: ReadonlySet<EnvironmentId> | null,
): ReadonlyArray<TItem> {
  if (environmentIds === null) return items;
  return items.filter((item) => environmentIds.has(item.environmentId));
}

export function useActiveWorkspaceBackendId() {
  return useLocalStorage(ACTIVE_WORKSPACE_STORAGE_KEY, null, ActiveWorkspaceSchema);
}

export function useActiveWorkspaceEnvironmentIds(): ReadonlySet<EnvironmentId> | null {
  const [activeBackendId] = useActiveWorkspaceBackendId();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  return resolveWorkspaceEnvironmentIds({ activeBackendId, primaryEnvironmentId, environments });
}

export function useActiveWorkspaceEnvironmentId(): EnvironmentId | null {
  const environmentIds = useActiveWorkspaceEnvironmentIds();
  return environmentIds === null ? null : ([...environmentIds][0] ?? null);
}

export function useSelectWorkspace() {
  const navigate = useNavigate();
  const [, setActiveBackendId] = useActiveWorkspaceBackendId();
  return (backendId: string | null) => {
    setActiveBackendId(backendId);
    void navigate({ to: "/" });
  };
}
