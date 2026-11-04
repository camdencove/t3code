import {
  WORKSPACE_BACKEND_ID_PREFIX,
  type DesktopBridge,
  type DesktopWorkspace,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { BoxesIcon, ChevronsUpDownIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSeparator,
  MenuTrigger,
} from "../components/ui/menu";
import { SidebarMenuButton } from "../components/ui/sidebar";
import { toastManager } from "../components/ui/toast";
import { cn } from "../lib/utils";
import {
  useActiveWorkspaceBackendId,
  useSelectWorkspace,
  useWorkspaceOptions,
  type WorkspaceOption,
} from "./activeWorkspace";
import { NewWorkspaceDialog } from "./NewWorkspaceDialog";
import {
  rankWaitingWorkspaces,
  resolveWaitingWorkspaces,
  useWaitingScope,
  type WaitingDot as WaitingDotKind,
} from "./waitingWorkspaces";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { WorkspaceShortcuts } from "./WorkspaceShortcuts";
import { useWorkspacesStore } from "./workspacesStore";

const ALL_WORKSPACES_VALUE = "all";

const WAITING_STACK_LIMIT = 3;

const WAITING_DOT_CLASS_NAME: Record<WaitingDotKind, string> = {
  attention: "bg-warning",
  failed: "bg-error",
  unread: "bg-success",
};

const WAITING_DOT_LABEL: Record<WaitingDotKind, string> = {
  attention: "Needs you",
  failed: "Failed",
  unread: "Done, unread",
};

function openWorkspaceOrOfferRetry(
  bridge: DesktopBridge,
  workspace: Pick<DesktopWorkspace, "id" | "name">,
): void {
  const toastId = `workspace-start-${workspace.id}`;
  void bridge.openWorkspace(workspace.id).then(
    () => toastManager.close(toastId),
    () => {
      toastManager.add({
        id: toastId,
        type: "error",
        title: `Could not start ${workspace.name}`,
        description: "Its server did not come up. Check the desktop logs if this keeps happening.",
        timeout: 0,
        actionProps: {
          children: "Retry",
          onClick: () => openWorkspaceOrOfferRetry(bridge, workspace),
        },
      });
    },
  );
}

function WaitingDot({ dot }: { dot: WaitingDotKind }) {
  return (
    <span
      role="img"
      aria-label={WAITING_DOT_LABEL[dot]}
      className={cn("size-2 shrink-0 rounded-full", WAITING_DOT_CLASS_NAME[dot])}
    />
  );
}

function WaitingWorkspaceStack({
  waiting,
}: {
  waiting: ReadonlyArray<{ readonly option: WorkspaceOption; readonly dot: WaitingDotKind }>;
}) {
  const hiddenCount = waiting.length - WAITING_STACK_LIMIT;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {/* Painted in reverse so each icon overlaps the next and keeps its status corner visible. */}
      <span className="flex flex-row-reverse items-center">
        {waiting
          .slice(0, WAITING_STACK_LIMIT)
          .toReversed()
          .map(({ option, dot }) => (
            <span
              key={option.backendId ?? ALL_WORKSPACES_VALUE}
              role="img"
              aria-label={`${option.label}: ${WAITING_DOT_LABEL[dot]}`}
              className="relative -ml-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sidebar ring-1 ring-border last:ml-0"
            >
              <WorkspaceIcon
                option={option}
                fallback={<BoxesIcon className="size-3.5 text-(--sidebar-icon-color)" />}
              />
              <span
                aria-hidden
                className={cn(
                  "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-sidebar",
                  WAITING_DOT_CLASS_NAME[dot],
                )}
              />
            </span>
          ))}
      </span>
      {hiddenCount > 0 ? (
        <span className="text-xs text-muted-foreground">+{hiddenCount}</span>
      ) : null}
    </span>
  );
}

function WorkspaceRadioLabel({
  option,
  waiting,
}: {
  option: WorkspaceOption;
  waiting: WaitingDotKind | undefined;
}) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        <WorkspaceIcon option={option} />
        <span className="min-w-0 truncate">{option.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {waiting ? <WaitingDot dot={waiting} /> : null}
        <MenuRadioItemIndicator />
      </span>
    </span>
  );
}

export function WorkspaceSwitcher() {
  const bridge = window.desktopBridge;
  const navigate = useNavigate();
  const [activeBackendId, setActiveBackendId] = useActiveWorkspaceBackendId();
  const selectWorkspace = useSelectWorkspace();
  const workspaces = useWorkspacesStore((store) => store.workspaces);
  const options = useWorkspaceOptions();
  const waitingWorkspaces = resolveWaitingWorkspaces(useWaitingScope());
  const [createOpen, setCreateOpen] = useState(false);
  const activeWorkspaceId = activeBackendId?.startsWith(WORKSPACE_BACKEND_ID_PREFIX)
    ? activeBackendId.slice(WORKSPACE_BACKEND_ID_PREFIX.length)
    : null;
  const activeWorkspaceName = workspaces.find(({ id }) => id === activeWorkspaceId)?.name ?? null;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- confirms the selected workspace's backend came up, reports a failure, and drops a selection whose workspace is gone
  useEffect(() => {
    if (activeWorkspaceId === null) return;
    if (activeWorkspaceName === null) {
      setActiveBackendId(null);
    } else if (bridge !== undefined) {
      openWorkspaceOrOfferRetry(bridge, { id: activeWorkspaceId, name: activeWorkspaceName });
    }
  }, [activeWorkspaceId, activeWorkspaceName, bridge, setActiveBackendId]);

  if (bridge === undefined) return null;

  const activeOption = options.find((option) => option.backendId === activeBackendId) ?? options[0];
  const waitingElsewhere = rankWaitingWorkspaces(options, waitingWorkspaces);

  return (
    <>
      <WorkspaceShortcuts />
      <Menu>
        <MenuTrigger
          render={<SidebarMenuButton aria-label="Switch workspace" className="mb-0.5" />}
        >
          <WorkspaceIcon
            option={activeOption ?? { icon: null, workspaceId: null }}
            fallback={<BoxesIcon className="size-4 shrink-0 text-(--sidebar-icon-color)" />}
          />
          <span className="min-w-0 flex-1 truncate">{activeOption?.label}</span>
          {waitingElsewhere.length > 0 ? (
            <WaitingWorkspaceStack waiting={waitingElsewhere} />
          ) : null}
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-(--sidebar-icon-color)" />
        </MenuTrigger>
        <MenuPopup align="start" className="w-(--anchor-width)">
          <MenuRadioGroup
            value={activeBackendId ?? ALL_WORKSPACES_VALUE}
            onValueChange={(value: string) =>
              selectWorkspace(value === ALL_WORKSPACES_VALUE ? null : value)
            }
          >
            {options.map((option) => (
              <MenuRadioItem
                closeOnClick
                key={option.backendId ?? ALL_WORKSPACES_VALUE}
                value={option.backendId ?? ALL_WORKSPACES_VALUE}
              >
                <WorkspaceRadioLabel
                  option={option}
                  waiting={
                    option.backendId === null ? undefined : waitingWorkspaces.get(option.backendId)
                  }
                />
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            New workspace
          </MenuItem>
          <MenuItem onClick={() => void navigate({ to: "/settings/workspaces" })}>
            <Settings2Icon />
            Manage workspaces
          </MenuItem>
        </MenuPopup>
      </Menu>
      <NewWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={selectWorkspace}
      />
    </>
  );
}
