import {
  DesktopWorkspaceSchema,
  WORKSPACE_BACKEND_ID_PREFIX,
  type DesktopWorkspace,
} from "@t3tools/contracts";
import * as NetService from "@t3tools/shared/Net";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as DesktopObservability from "../app/DesktopObservability.ts";
import * as DesktopBackendConfiguration from "../backend/DesktopBackendConfiguration.ts";
import * as DesktopBackendPool from "../backend/DesktopBackendPool.ts";
import * as DesktopServerExposure from "../backend/DesktopServerExposure.ts";
import { workspaceBackendEnv } from "./workspaceBackendEnv.ts";
import { removeWorkspaceData, seedWorkspaceState } from "./workspaceState.ts";

const WORKSPACE_PORT_OFFSET = 100;
const WORKSPACE_PORT_RANGE = 1000;
const MAX_TCP_PORT = 65_535;
const WORKSPACE_READY_TIMEOUT = Duration.seconds(60);

const WorkspacesDocument = Schema.fromJsonString(Schema.Array(DesktopWorkspaceSchema));
const decodeWorkspacesDocument = Schema.decodeEffect(WorkspacesDocument);
const encodeWorkspacesDocument = Schema.encodeEffect(WorkspacesDocument);

const { logWarning: logWorkspaceWarning } =
  DesktopObservability.makeComponentLogger("desktop-workspaces");

export class DesktopWorkspaceNameError extends Schema.TaggedError<DesktopWorkspaceNameError>()(
  "DesktopWorkspaceNameError",
  { name: Schema.String },
) {
  override get message(): string {
    return `Workspace name "${this.name}" is invalid or already in use.`;
  }
}

export class DesktopWorkspaceNotFoundError extends Schema.TaggedError<DesktopWorkspaceNotFoundError>()(
  "DesktopWorkspaceNotFoundError",
  { id: Schema.String },
) {
  override get message(): string {
    return `Workspace "${this.id}" does not exist.`;
  }
}

export class DesktopWorkspaceStartError extends Schema.TaggedError<DesktopWorkspaceStartError>()(
  "DesktopWorkspaceStartError",
  { id: Schema.String },
) {
  override get message(): string {
    return `Workspace "${this.id}" did not start.`;
  }
}

export const workspaceIdFromName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isWorkspaceNameAvailable = (
  workspaces: ReadonlyArray<Pick<DesktopWorkspace, "id" | "name">>,
  name: string,
  ownId: string | null,
): boolean => {
  const id = workspaceIdFromName(name);
  const normalizedName = name.trim().toLowerCase();
  return (
    id.length > 0 &&
    !workspaces.some(
      (workspace) =>
        workspace.id !== ownId &&
        (workspace.name.toLowerCase() === normalizedName ||
          (ownId === null && workspace.id === id)),
    )
  );
};

const backendEnvKey = (workspace: Pick<DesktopWorkspace, "separate" | "env">): string =>
  JSON.stringify(
    Object.entries(workspaceBackendEnv({ workspacePath: (name) => name, workspace })).toSorted(),
  );

/** Saved links on other devices name a workspace's port, so it must not depend on start order. */
export function workspacePortCandidates(
  workspaceId: string,
  primaryPort: number,
): ReadonlyArray<number> {
  let hash = 0;
  for (const character of workspaceId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  const firstPort = primaryPort + WORKSPACE_PORT_OFFSET;
  return Array.from(
    { length: WORKSPACE_PORT_RANGE },
    (_, attempt) => firstPort + ((hash + attempt) % WORKSPACE_PORT_RANGE),
  ).filter((port) => port <= MAX_TCP_PORT);
}

export const hasSameBackendEnv = (
  left: Pick<DesktopWorkspace, "separate" | "env">,
  right: Pick<DesktopWorkspace, "separate" | "env">,
): boolean => backendEnvKey(left) === backendEnvKey(right);

export class DesktopWorkspaces extends Context.Service<
  DesktopWorkspaces,
  {
    readonly list: Effect.Effect<ReadonlyArray<DesktopWorkspace>>;
    readonly create: (input: {
      readonly name: string;
    }) => Effect.Effect<ReadonlyArray<DesktopWorkspace>, DesktopWorkspaceNameError>;
    readonly open: (
      id: string,
    ) => Effect.Effect<void, DesktopWorkspaceNotFoundError | DesktopWorkspaceStartError>;
    readonly startAll: Effect.Effect<void>;
    readonly update: (
      workspace: DesktopWorkspace,
    ) => Effect.Effect<
      ReadonlyArray<DesktopWorkspace>,
      DesktopWorkspaceNameError | DesktopWorkspaceNotFoundError
    >;
    readonly remove: (
      id: string,
    ) => Effect.Effect<ReadonlyArray<DesktopWorkspace>, DesktopWorkspaceNotFoundError>;
  }
>()("@t3tools/desktop/workspaces/DesktopWorkspaces") {}

export const layer = Layer.effect(
  DesktopWorkspaces,
  Effect.gen(function* () {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    const fileSystem = yield* FileSystem.FileSystem;
    const pool = yield* DesktopBackendPool.DesktopBackendPool;
    const configuration = yield* DesktopBackendConfiguration.DesktopBackendConfiguration;
    const serverExposure = yield* DesktopServerExposure.DesktopServerExposure;
    const net = yield* NetService.NetService;

    const workspacesRoot = environment.path.join(environment.baseDir, "workspaces");
    const documentPath = environment.path.join(workspacesRoot, "workspaces.json");
    const workspaceDir = (id: string) => environment.path.join(workspacesRoot, id);
    const mutex = yield* Semaphore.make(1);

    const persisted = yield* fileSystem.readFileString(documentPath).pipe(
      Effect.flatMap(decodeWorkspacesDocument),
      Effect.catch((error) =>
        fileSystem.exists(documentPath).pipe(
          Effect.orElseSucceed(() => false),
          Effect.flatMap((exists) =>
            exists
              ? logWorkspaceWarning("could not read workspaces", { error: error.message })
              : Effect.void,
          ),
          Effect.as<ReadonlyArray<DesktopWorkspace>>([]),
        ),
      ),
    );
    const workspacesRef = yield* Ref.make(persisted);
    const allocatedPortsRef = yield* Ref.make<ReadonlySet<number>>(new Set());
    const failedStartsRef = yield* Ref.make<ReadonlySet<string>>(new Set());
    const provideFileAccess = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(Path.Path, environment.path),
      );

    const allocatePort = Effect.fn("desktop.workspaces.allocatePort")(function* (
      workspaceId: string,
    ) {
      const primaryConfig = yield* serverExposure.backendConfig;
      const allocated = yield* Ref.get(allocatedPortsRef);
      for (const port of workspacePortCandidates(workspaceId, primaryConfig.port)) {
        if (allocated.has(port)) continue;
        if (yield* net.canListenOnHost(port, primaryConfig.bindHost)) {
          yield* Ref.set(allocatedPortsRef, new Set([...allocated, port]));
          return port;
        }
      }
      return yield* new NetService.NetError({
        message: "No port available for a workspace backend.",
      });
    });

    const backendInstanceId = (workspaceId: string) =>
      DesktopBackendPool.BackendInstanceId(`${WORKSPACE_BACKEND_ID_PREFIX}${workspaceId}`);

    const persist = Effect.fn("desktop.workspaces.persist")(function* (
      next: ReadonlyArray<DesktopWorkspace>,
    ) {
      const encoded = yield* encodeWorkspacesDocument(next).pipe(Effect.orDie);
      yield* fileSystem.makeDirectory(workspacesRoot, { recursive: true }).pipe(Effect.orDie);
      yield* fileSystem.writeFileString(documentPath, encoded).pipe(Effect.orDie);
      yield* Ref.set(workspacesRef, next);
    });

    const restartIfRunning = Effect.fn("desktop.workspaces.restartIfRunning")(function* (
      workspaceId: string,
    ) {
      const instance = yield* pool.get(backendInstanceId(workspaceId));
      if (Option.isNone(instance)) return;
      yield* instance.value.stop();
      yield* instance.value.start;
    });

    const start = Effect.fn("desktop.workspaces.start")(function* (workspace: DesktopWorkspace) {
      const id = backendInstanceId(workspace.id);
      const existing = yield* pool.get(id);
      if (Option.isSome(existing)) {
        yield* existing.value.start;
        return existing.value;
      }
      const port = yield* allocatePort(workspace.id);
      const instance = yield* pool.register({
        id,
        onReady: () =>
          Ref.update(
            failedStartsRef,
            (failed) => new Set([...failed].filter((failedId) => failedId !== workspace.id)),
          ),
        onStartupFailure: () =>
          Ref.update(failedStartsRef, (failed) => new Set([...failed, workspace.id])),
        label: Ref.get(workspacesRef).pipe(
          Effect.map(
            (workspaces) =>
              workspaces.find((candidate) => candidate.id === workspace.id)?.name ?? workspace.name,
          ),
        ),
        configResolve: Effect.suspend(() =>
          Effect.gen(function* () {
            const workspaces = yield* Ref.get(workspacesRef);
            return yield* configuration.resolveWorkspace({
              port,
              workspaceDir: workspaceDir(workspace.id),
              workspace: workspaces.find((candidate) => candidate.id === workspace.id) ?? workspace,
            });
          }),
        ),
      });
      yield* instance.start;
      return instance;
    });

    return DesktopWorkspaces.of({
      list: Ref.get(workspacesRef),
      create: Effect.fn("desktop.workspaces.create")(function* ({ name }) {
        const id = workspaceIdFromName(name);
        return yield* mutex.withPermits(1)(
          Effect.gen(function* () {
            const current = yield* Ref.get(workspacesRef);
            if (!isWorkspaceNameAvailable(current, name, null)) {
              return yield* new DesktopWorkspaceNameError({ name });
            }
            const next = [...current, { id, name: name.trim(), separate: [], env: {}, icon: null }];
            yield* persist(next);
            yield* seedWorkspaceState({
              parentStateDir: environment.stateDir,
              parentWorktreesDir: environment.path.join(environment.baseDir, "worktrees"),
              workspaceDir: workspaceDir(id),
            }).pipe(
              provideFileAccess,
              Effect.catch((error) =>
                logWorkspaceWarning("could not seed workspace state", {
                  id,
                  error: error.message,
                }),
              ),
            );
            return next;
          }),
        );
      }),
      update: Effect.fn("desktop.workspaces.update")(function* (workspace) {
        const { id, name } = workspace;
        return yield* mutex.withPermits(1)(
          Effect.gen(function* () {
            const current = yield* Ref.get(workspacesRef);
            const target = current.find((workspace) => workspace.id === id);
            if (target === undefined) {
              return yield* new DesktopWorkspaceNotFoundError({ id });
            }
            if (!isWorkspaceNameAvailable(current, name, id)) {
              return yield* new DesktopWorkspaceNameError({ name });
            }
            const updated = { ...workspace, name: name.trim() };
            const next = current.map((candidate) => (candidate.id === id ? updated : candidate));
            yield* persist(next);
            if (!hasSameBackendEnv(target, updated)) {
              yield* restartIfRunning(id);
            }
            return next;
          }),
        );
      }),
      remove: Effect.fn("desktop.workspaces.remove")(function* (id) {
        return yield* mutex.withPermits(1)(
          Effect.gen(function* () {
            const current = yield* Ref.get(workspacesRef);
            if (!current.some((workspace) => workspace.id === id)) {
              return yield* new DesktopWorkspaceNotFoundError({ id });
            }
            yield* pool.unregister(backendInstanceId(id)).pipe(Effect.orDie);
            const next = current.filter((workspace) => workspace.id !== id);
            yield* persist(next);
            yield* removeWorkspaceData(workspaceDir(id)).pipe(
              provideFileAccess,
              Effect.catch((error) =>
                logWorkspaceWarning("could not delete workspace data", {
                  id,
                  error: error.message,
                }),
              ),
            );
            return next;
          }),
        );
      }),
      open: Effect.fn("desktop.workspaces.open")(function* (id) {
        const workspaces = yield* Ref.get(workspacesRef);
        const workspace = workspaces.find((candidate) => candidate.id === id);
        if (workspace === undefined) {
          return yield* new DesktopWorkspaceNotFoundError({ id });
        }
        const instance = yield* mutex
          .withPermits(1)(start(workspace))
          .pipe(
            Effect.tapError((error) =>
              logWorkspaceWarning("could not start workspace backend", {
                id,
                error: error.message,
              }),
            ),
            Effect.mapError(() => new DesktopWorkspaceStartError({ id })),
          );
        // A deliberate restart also ends this wait unready, so only a recorded failure counts.
        const ready = yield* instance.waitForReady(WORKSPACE_READY_TIMEOUT);
        const failedStarts = yield* Ref.get(failedStartsRef);
        if (!ready && failedStarts.has(id)) {
          return yield* new DesktopWorkspaceStartError({ id });
        }
      }),
      startAll: Effect.gen(function* () {
        const workspaces = yield* Ref.get(workspacesRef);
        yield* Effect.forEach(
          workspaces,
          (workspace) =>
            mutex
              .withPermits(1)(start(workspace))
              .pipe(
                Effect.catch((error) =>
                  logWorkspaceWarning("could not start workspace backend", {
                    id: workspace.id,
                    error: error.message,
                  }),
                ),
              ),
          { discard: true },
        );
      }).pipe(Effect.withSpan("desktop.workspaces.startAll")),
    });
  }),
);
