import { WORKSPACE_JUMP_KEYBINDING_COMMANDS } from "@t3tools/contracts";
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
  useWorkspaceOptions,
} from "./activeWorkspace";
import { WorkspaceIcon } from "./WorkspaceIcon";

export const SWITCH_WORKSPACE_GROUP = "workspaces";

export function useSwitchWorkspaceItem(): CommandPaletteSubmenuItem | null {
  const options = useWorkspaceOptions();
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
        items: options.map((option, index) => ({
          kind: "action",
          value: `workspace:${option.backendId ?? "all"}`,
          title: option.label,
          searchTerms: [option.label, "workspace"],
          ...(WORKSPACE_JUMP_KEYBINDING_COMMANDS[index]
            ? { shortcutCommand: WORKSPACE_JUMP_KEYBINDING_COMMANDS[index] }
            : {}),
          icon: (
            <WorkspaceIcon option={option} fallback={<BoxesIcon className={ITEM_ICON_CLASS} />} />
          ),
          titleTrailingContent:
            option.backendId === activeBackendId ? (
              <span className="text-xs text-muted-foreground/70">Current</span>
            ) : undefined,
          run: async () => selectWorkspace(option.backendId),
        })),
      },
    ],
  };
}
