import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { WORKSPACE_JUMP_KEYBINDING_COMMANDS } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent } from "react";

import { toastManager } from "../components/ui/toast";
import { type CommandHandlers, registerCommands } from "../shortcuts/dispatcher";
import { buildThreadRouteParams } from "../threadRoutes";
import {
  useActiveWorkspaceBackendId,
  useSelectWorkspace,
  useWorkspaceOptions,
} from "./activeWorkspace";
import { resolveNextWaitingThread, useWaitingScope } from "./waitingWorkspaces";

function consume(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

export function WorkspaceShortcuts() {
  const navigate = useNavigate();
  const options = useWorkspaceOptions();
  const selectWorkspace = useSelectWorkspace();
  const [, setActiveBackendId] = useActiveWorkspaceBackendId();
  const waitingScope = useWaitingScope();

  const jumpToWorkspace = useEffectEvent((index: number, event: KeyboardEvent) => {
    const option = options[index];
    if (option === undefined) return false;
    consume(event);
    if (!event.repeat) selectWorkspace(option.backendId);
    return undefined;
  });

  const goToNextWaiting = useEffectEvent((event: KeyboardEvent) => {
    consume(event);
    if (event.repeat) return;
    const next = resolveNextWaitingThread(waitingScope);
    if (next === null) {
      toastManager.add({
        id: "workspace-nothing-waiting",
        title: "Nothing waiting",
        timeout: 1500,
      });
      return;
    }
    if (next.backendId !== null) setActiveBackendId(next.backendId);
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(next.thread.environmentId, next.thread.id)),
    });
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- registers global key handlers for as long as the workspace switcher is mounted
  useEffect(() => {
    const commands: CommandHandlers = {
      "workspaces.nextWaiting": (event) => goToNextWaiting(event),
    };
    WORKSPACE_JUMP_KEYBINDING_COMMANDS.forEach((command, index) => {
      commands[command] = (event) => jumpToWorkspace(index, event);
    });
    return registerCommands(commands);
  }, []);

  return null;
}
