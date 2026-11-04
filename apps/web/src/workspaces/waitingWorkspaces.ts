import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId } from "@t3tools/contracts";

import { resolveSidebarFolderDot, resolveThreadLastVisitedAt } from "../components/Sidebar.logic";
import { useQuietThreadShells } from "../state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "../state/environments";
import { useUiStateStore } from "../uiStateStore";
import {
  resolveWorkspaceEnvironmentIds,
  useActiveWorkspaceBackendId,
  useEnvironmentWorkspaces,
  workspaceOptions,
} from "./activeWorkspace";
import { useWorkspacesStore } from "./workspacesStore";

export type WaitingDot = "attention" | "failed" | "unread";

const WAITING_DOT_URGENCY: ReadonlyArray<WaitingDot> = ["attention", "failed", "unread"];

type WaitingThread = Parameters<typeof resolveSidebarFolderDot>[0][number] & {
  readonly environmentId: EnvironmentId;
  readonly updatedAt: string;
};

type WaitingScope<TThread extends WaitingThread> = WorkspaceScope & {
  readonly activeBackendId: string | null;
  readonly backendIds: ReadonlyArray<string>;
  readonly threads: ReadonlyArray<TThread>;
};

type WorkspaceScope = Omit<Parameters<typeof resolveWorkspaceEnvironmentIds>[0], "activeBackendId">;

/** Threads already on screen in the active workspace never count for another one. */
export function resolveWaitingWorkspaces(
  input: WaitingScope<WaitingThread>,
): ReadonlyMap<string, WaitingDot> {
  const { activeBackendId, backendIds, threads, ...scope } = input;
  const dots = new Map<string, WaitingDot>();
  const visible = resolveWorkspaceEnvironmentIds({ ...scope, activeBackendId });
  if (visible === null) return dots;
  for (const backendId of backendIds) {
    if (backendId === activeBackendId) continue;
    const environmentIds = resolveWorkspaceEnvironmentIds({
      ...scope,
      activeBackendId: backendId,
    });
    const dot = resolveSidebarFolderDot(
      threads.filter(
        (thread) =>
          environmentIds?.has(thread.environmentId) === true && !visible.has(thread.environmentId),
      ),
    );
    if (dot !== null && dot !== "working") dots.set(backendId, dot);
  }
  return dots;
}

/** A thread that needs you beats one that only finished, then the longest wait wins. */
export function resolveNextWaitingThread<TThread extends WaitingThread>(
  input: WaitingScope<TThread>,
): { readonly backendId: string | null; readonly thread: TThread } | null {
  const { activeBackendId, backendIds, threads, ...scope } = input;
  const visible = resolveWorkspaceEnvironmentIds({ ...scope, activeBackendId });
  const places =
    visible === null
      ? [{ backendId: null, threads }]
      : backendIds
          .filter((backendId) => backendId !== activeBackendId)
          .map((backendId) => {
            const environmentIds = resolveWorkspaceEnvironmentIds({
              ...scope,
              activeBackendId: backendId,
            });
            return {
              backendId,
              threads: threads.filter(
                (thread) =>
                  environmentIds?.has(thread.environmentId) === true &&
                  !visible.has(thread.environmentId),
              ),
            };
          });
  const waiting = places.flatMap(({ backendId, threads: placeThreads }) =>
    placeThreads.flatMap((thread) => {
      const dot = resolveSidebarFolderDot([thread]);
      if (dot === null || dot === "working") return [];
      const waitingSince =
        dot === "attention"
          ? thread.updatedAt
          : (thread.latestRun?.completedAt ?? thread.updatedAt);
      return [
        { backendId, thread, needsYou: dot === "attention", since: Date.parse(waitingSince) },
      ];
    }),
  );
  const [next] = waiting.toSorted(
    (left, right) => Number(right.needsYou) - Number(left.needsYou) || left.since - right.since,
  );
  return next === undefined ? null : { backendId: next.backendId, thread: next.thread };
}

export function rankWaitingWorkspaces<TOption extends { readonly backendId: string | null }>(
  options: ReadonlyArray<TOption>,
  dots: ReadonlyMap<string, WaitingDot>,
): ReadonlyArray<{ readonly option: TOption; readonly dot: WaitingDot }> {
  return WAITING_DOT_URGENCY.flatMap((dot) =>
    options
      .filter((option) => option.backendId !== null && dots.get(option.backendId) === dot)
      .map((option) => ({ option, dot })),
  );
}

export function useWaitingScope() {
  const [activeBackendId] = useActiveWorkspaceBackendId();
  const workspaces = useWorkspacesStore((store) => store.workspaces);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const environmentWorkspaces = useEnvironmentWorkspaces();
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const threads = useQuietThreadShells()
    .filter((thread) => thread.archivedAt === null)
    .map((thread) => ({
      ...thread,
      lastVisitedAt: resolveThreadLastVisitedAt(
        thread.lastVisitedAt,
        localLastVisitedAtById[scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))],
      ),
    }));
  return {
    activeBackendId,
    backendIds: workspaceOptions(workspaces).flatMap(({ backendId }) =>
      backendId === null ? [] : [backendId],
    ),
    environments,
    environmentWorkspaces,
    primaryEnvironmentId,
    threads,
  };
}
