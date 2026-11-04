import { DesktopWorkspaceSchema } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopWorkspaces from "../../workspaces/DesktopWorkspaces.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod, makeSyncIpcMethod } from "../DesktopIpc.ts";

export const getWorkspaces = makeSyncIpcMethod({
  channel: IpcChannels.GET_WORKSPACES_CHANNEL,
  result: Schema.Array(DesktopWorkspaceSchema),
  handler: Effect.fn("desktop.ipc.workspaces.get")(function* () {
    const workspaces = yield* DesktopWorkspaces.DesktopWorkspaces;
    return yield* workspaces.list;
  }),
});

export const createWorkspace = makeIpcMethod({
  channel: IpcChannels.CREATE_WORKSPACE_CHANNEL,
  payload: Schema.Struct({ name: Schema.String }),
  result: Schema.Array(DesktopWorkspaceSchema),
  handler: Effect.fn("desktop.ipc.workspaces.create")(function* (input) {
    const workspaces = yield* DesktopWorkspaces.DesktopWorkspaces;
    return yield* workspaces.create(input);
  }),
});

export const openWorkspace = makeIpcMethod({
  channel: IpcChannels.OPEN_WORKSPACE_CHANNEL,
  payload: Schema.String,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.workspaces.open")(function* (id) {
    const workspaces = yield* DesktopWorkspaces.DesktopWorkspaces;
    yield* workspaces.open(id);
  }),
});

export const updateWorkspace = makeIpcMethod({
  channel: IpcChannels.UPDATE_WORKSPACE_CHANNEL,
  payload: DesktopWorkspaceSchema,
  result: Schema.Array(DesktopWorkspaceSchema),
  handler: Effect.fn("desktop.ipc.workspaces.update")(function* (input) {
    const workspaces = yield* DesktopWorkspaces.DesktopWorkspaces;
    return yield* workspaces.update(input);
  }),
});

export const removeWorkspace = makeIpcMethod({
  channel: IpcChannels.REMOVE_WORKSPACE_CHANNEL,
  payload: Schema.String,
  result: Schema.Array(DesktopWorkspaceSchema),
  handler: Effect.fn("desktop.ipc.workspaces.remove")(function* (id) {
    const workspaces = yield* DesktopWorkspaces.DesktopWorkspaces;
    return yield* workspaces.remove(id);
  }),
});
