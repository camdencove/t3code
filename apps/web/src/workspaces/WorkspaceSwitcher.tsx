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
  workspaceColorClass,
  workspaceOptions,
  type WorkspaceOption,
} from "./activeWorkspace";
import { NewWorkspaceDialog } from "./NewWorkspaceDialog";
import { useWorkspacesStore } from "./workspacesStore";

const ALL_WORKSPACES_VALUE = "all";

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

function WorkspaceColorDot({ workspaceId }: { workspaceId: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-full", workspaceColorClass(workspaceId))}
    />
  );
}

function WorkspaceRadioLabel({ option }: { option: WorkspaceOption }) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        {option.workspaceId === null ? null : (
          <WorkspaceColorDot workspaceId={option.workspaceId} />
        )}
        <span className="min-w-0 truncate">{option.label}</span>
      </span>
      <MenuRadioItemIndicator />
    </span>
  );
}

export function WorkspaceSwitcher() {
  const bridge = window.desktopBridge;
  const navigate = useNavigate();
  const [activeBackendId, setActiveBackendId] = useActiveWorkspaceBackendId();
  const selectWorkspace = useSelectWorkspace();
  const workspaces = useWorkspacesStore((store) => store.workspaces);
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

  const options = workspaceOptions(workspaces);
  const activeOption = options.find((option) => option.backendId === activeBackendId) ?? options[0];

  return (
    <>
      <Menu>
        <MenuTrigger
          render={<SidebarMenuButton aria-label="Switch workspace" className="mb-0.5" />}
        >
          {activeOption?.workspaceId ? (
            <WorkspaceColorDot workspaceId={activeOption.workspaceId} />
          ) : (
            <BoxesIcon className="size-4 shrink-0 text-(--sidebar-icon-color)" />
          )}
          <span className="min-w-0 flex-1 truncate">{activeOption?.label}</span>
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
                <WorkspaceRadioLabel option={option} />
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
