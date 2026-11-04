import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import {
  PRIMARY_LOCAL_ENVIRONMENT_ID,
  WORKSPACE_BACKEND_ID_PREFIX,
  type ClientSettings,
  type DesktopWorkspace,
  type EnvironmentId,
  type ProjectIconOverride,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";

import { desktopLocalBackendId } from "../connection/desktopLocal";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useClientSettings } from "../hooks/useSettings";
import { useEnvironments, usePrimaryEnvironmentId } from "../state/environments";
import { useWorkspacesStore } from "./workspacesStore";

const ACTIVE_WORKSPACE_STORAGE_KEY = "t3code:active-workspace:v1";
const ActiveWorkspaceSchema = Schema.NullOr(Schema.String);
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
  readonly icon: ProjectIconOverride | null;
  readonly label: string;
  readonly workspaceId: string | null;
}

interface WorkspaceEnvironment {
  readonly environmentId: EnvironmentId;
  readonly entry: { readonly target: ConnectionTarget };
}

export const workspaceBackendId = (workspace: Pick<DesktopWorkspace, "id">) =>
  `${WORKSPACE_BACKEND_ID_PREFIX}${workspace.id}`;

export type BuiltInWorkspaces = Pick<
  ClientSettings,
  | "allWorkspacesIcon"
  | "allWorkspacesName"
  | "defaultWorkspaceIcon"
  | "defaultWorkspaceName"
  | "workspaceOrder"
>;

export const DEFAULT_WORKSPACE_LABEL = "Default";
export const ALL_WORKSPACES_LABEL = "All workspaces";

const ALL_WORKSPACES_KEY = "all";

export const workspaceOptionKey = (option: Pick<WorkspaceOption, "backendId">) =>
  option.backendId ?? ALL_WORKSPACES_KEY;

function orderWorkspaceOptions(
  options: ReadonlyArray<WorkspaceOption>,
  order: ReadonlyArray<string>,
): ReadonlyArray<WorkspaceOption> {
  const positions = new Map(order.map((key, index) => [key, index]));
  const position = (option: WorkspaceOption) =>
    positions.get(workspaceOptionKey(option)) ?? order.length;
  return options.toSorted((left, right) => position(left) - position(right));
}

export const resolveDefaultWorkspaceLabel = (name: string) =>
  name.trim() || DEFAULT_WORKSPACE_LABEL;

export const resolveAllWorkspacesLabel = (name: string) => name.trim() || ALL_WORKSPACES_LABEL;

export function workspaceOptions(
  workspaces: ReadonlyArray<DesktopWorkspace>,
  builtIn: Partial<BuiltInWorkspaces> = {},
): ReadonlyArray<WorkspaceOption> {
  const options = [
    {
      backendId: null,
      icon: builtIn.allWorkspacesIcon ?? null,
      label: resolveAllWorkspacesLabel(builtIn.allWorkspacesName ?? ""),
      workspaceId: null,
    },
    {
      backendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      icon: builtIn.defaultWorkspaceIcon ?? null,
      label: resolveDefaultWorkspaceLabel(builtIn.defaultWorkspaceName ?? ""),
      workspaceId: null,
    },
    ...workspaces.map((workspace) => ({
      backendId: workspaceBackendId(workspace),
      icon: workspace.icon,
      label: workspace.name,
      workspaceId: workspace.id,
    })),
  ];
  return orderWorkspaceOptions(options, builtIn.workspaceOrder ?? []);
}

export function workspaceColorClass(workspaceId: string): string {
  let hash = 0;
  for (const character of workspaceId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return WORKSPACE_COLOR_CLASSES[hash % WORKSPACE_COLOR_CLASSES.length] ?? "bg-sky-500";
}

export function isRemoteEnvironment(environment: Pick<WorkspaceEnvironment, "entry">): boolean {
  const { target } = environment.entry;
  return target._tag !== "PrimaryConnectionTarget" && desktopLocalBackendId(target) === null;
}

export function keepExistingWorkspaceAssignments(
  assignments: Readonly<Record<string, string>>,
  workspaces: ReadonlyArray<DesktopWorkspace>,
): Readonly<Record<string, string>> {
  const backendIds = new Set(workspaceOptions(workspaces).map((option) => option.backendId));
  return Object.fromEntries(
    Object.entries(assignments).filter(([, backendId]) => backendIds.has(backendId)),
  );
}

export function resolveWorkspaceLocalEnvironmentId(input: {
  readonly activeBackendId: string | null;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly environments: ReadonlyArray<WorkspaceEnvironment>;
}): EnvironmentId | null {
  const { activeBackendId, primaryEnvironmentId, environments } = input;
  if (activeBackendId === null) return null;
  if (activeBackendId === PRIMARY_LOCAL_ENVIRONMENT_ID) return primaryEnvironmentId;
  const environment = environments.find(
    (candidate) => desktopLocalBackendId(candidate.entry.target) === activeBackendId,
  );
  return environment?.environmentId ?? null;
}

export function resolveWorkspaceEnvironmentIds(input: {
  readonly activeBackendId: string | null;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly environments: ReadonlyArray<WorkspaceEnvironment>;
  readonly environmentWorkspaces: Readonly<Record<string, string>>;
}): ReadonlySet<EnvironmentId> | null {
  const { activeBackendId, environments, environmentWorkspaces } = input;
  if (activeBackendId === null) return null;
  const localEnvironmentId = resolveWorkspaceLocalEnvironmentId(input);
  const remoteEnvironmentIds = environments
    .filter((environment) => {
      const assigned = environmentWorkspaces[environment.environmentId];
      return (
        isRemoteEnvironment(environment) && (assigned === undefined || assigned === activeBackendId)
      );
    })
    .map((environment) => environment.environmentId);
  return new Set([
    ...(localEnvironmentId === null ? [] : [localEnvironmentId]),
    ...remoteEnvironmentIds,
  ]);
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

const selectBuiltInWorkspaces = (settings: ClientSettings): BuiltInWorkspaces => ({
  allWorkspacesIcon: settings.allWorkspacesIcon,
  allWorkspacesName: settings.allWorkspacesName,
  defaultWorkspaceIcon: settings.defaultWorkspaceIcon,
  defaultWorkspaceName: settings.defaultWorkspaceName,
  workspaceOrder: settings.workspaceOrder,
});

export function useBuiltInWorkspaces(): BuiltInWorkspaces {
  return useClientSettings(selectBuiltInWorkspaces);
}

export function useDefaultWorkspaceLabel(): string {
  return useClientSettings((settings) =>
    resolveDefaultWorkspaceLabel(settings.defaultWorkspaceName),
  );
}

export function useWorkspaceOptions(): ReadonlyArray<WorkspaceOption> {
  const workspaces = useWorkspacesStore((store) => store.workspaces);
  const builtIn = useBuiltInWorkspaces();
  return workspaceOptions(workspaces, builtIn);
}

export function useEnvironmentWorkspaces(): Readonly<Record<string, string>> {
  const assignments = useClientSettings((settings) => settings.environmentWorkspaces);
  const workspaces = useWorkspacesStore((store) => store.workspaces);
  return keepExistingWorkspaceAssignments(assignments, workspaces);
}

export function useActiveWorkspaceEnvironmentIds(): ReadonlySet<EnvironmentId> | null {
  const [activeBackendId] = useActiveWorkspaceBackendId();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const environmentWorkspaces = useEnvironmentWorkspaces();
  return resolveWorkspaceEnvironmentIds({
    activeBackendId,
    primaryEnvironmentId,
    environments,
    environmentWorkspaces,
  });
}

export function useActiveWorkspaceEnvironmentId(): EnvironmentId | null {
  const [activeBackendId] = useActiveWorkspaceBackendId();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  return resolveWorkspaceLocalEnvironmentId({
    activeBackendId,
    primaryEnvironmentId,
    environments,
  });
}

export function useSelectWorkspace() {
  const navigate = useNavigate();
  const [, setActiveBackendId] = useActiveWorkspaceBackendId();
  return (backendId: string | null) => {
    setActiveBackendId(backendId);
    void navigate({ to: "/" });
  };
}
