import { BoxesIcon } from "lucide-react";

import {
  ADDON_ICON_CLASS,
  ITEM_ICON_CLASS,
  type CommandPaletteSubmenuItem,
} from "../components/CommandPalette.logic";
import { isElectron } from "../env";
import {
  useActiveWorkspaceBackendId,
  useSelectWorkspace,
  workspaceOptions,
} from "./activeWorkspace";
import { useWorkspacesStore } from "./workspacesStore";

export const SWITCH_WORKSPACE_GROUP = "workspaces";

export function useSwitchWorkspaceItem(): CommandPaletteSubmenuItem | null {
  const workspaces = useWorkspacesStore((store) => store.workspaces);
  const [activeBackendId] = useActiveWorkspaceBackendId();
  const selectWorkspace = useSelectWorkspace();
  if (!isElectron) return null;

  return {
    kind: "submenu",
    value: "action:switch-workspace",
    searchTerms: ["switch workspace", "workspaces", "client"],
    title: "Switch workspace",
    icon: <BoxesIcon className={ITEM_ICON_CLASS} />,
    addonIcon: <BoxesIcon className={ADDON_ICON_CLASS} />,
    shortcutCommand: "workspaces.switch",
    groups: [
      {
        value: SWITCH_WORKSPACE_GROUP,
        label: "Workspaces",
        items: workspaceOptions(workspaces).map(({ backendId, label }) => ({
          kind: "action",
          value: `workspace:${backendId ?? "all"}`,
          title: label,
          searchTerms: [label, "workspace"],
          icon: <BoxesIcon className={ITEM_ICON_CLASS} />,
          titleTrailingContent:
            backendId === activeBackendId ? (
              <span className="text-xs text-muted-foreground/70">Current</span>
            ) : undefined,
          run: async () => selectWorkspace(backendId),
        })),
      },
    ],
  };
}
