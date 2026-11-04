import { type DesktopWorkspace, type DesktopWorkspaceTool } from "@t3tools/contracts";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { readLocalApi } from "../../localApi";
import { useActiveWorkspaceBackendId, workspaceBackendId } from "../../workspaces/activeWorkspace";
import { NewWorkspaceDialog } from "../../workspaces/NewWorkspaceDialog";
import { formatWorkspaceEnv, parseWorkspaceEnv } from "../../workspaces/workspaceEnv";
import { useWorkspacesStore } from "../../workspaces/workspacesStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";

const SEPARATE_TOOLS: ReadonlyArray<{
  readonly tool: DesktopWorkspaceTool;
  readonly label: string;
  readonly signInCommand: string;
  readonly threadsFollowConfig: boolean;
}> = [
  {
    tool: "claude",
    label: "Claude",
    signInCommand: "claude auth login",
    threadsFollowConfig: true,
  },
  { tool: "codex", label: "Codex", signInCommand: "codex login", threadsFollowConfig: true },
  {
    tool: "github",
    label: "GitHub CLI",
    signInCommand: "gh auth login",
    threadsFollowConfig: false,
  },
];

function WorkspaceSettingsSection({ workspace }: { workspace: DesktopWorkspace }) {
  const setWorkspaces = useWorkspacesStore((store) => store.setWorkspaces);
  const [activeBackendId, setActiveBackendId] = useActiveWorkspaceBackendId();
  const nameEditedRef = useRef(false);
  const envText = formatWorkspaceEnv(workspace.env);

  const update = async (changes: Partial<Omit<DesktopWorkspace, "id">>, errorTitle: string) => {
    const bridge = window.desktopBridge;
    if (bridge === undefined) return;
    try {
      setWorkspaces(await bridge.updateWorkspace({ ...workspace, ...changes }));
    } catch {
      toastManager.add({ type: "error", title: errorTitle });
    }
  };

  const setToolSeparate = async (entry: (typeof SEPARATE_TOOLS)[number], separate: boolean) => {
    if (entry.threadsFollowConfig) {
      const confirmed = await readLocalApi()?.dialogs.confirm(
        `Change ${entry.label} for "${workspace.name}"? Existing ${entry.label} threads in this workspace can't continue after its config folder changes. The workspace restarts.`,
      );
      if (!confirmed) return;
    }
    await update(
      {
        separate: separate
          ? [...workspace.separate, entry.tool]
          : workspace.separate.filter((tool) => tool !== entry.tool),
      },
      "Failed to update workspace",
    );
  };

  const saveEnv = (text: string) => {
    const { env, invalidLines } = parseWorkspaceEnv(text);
    if (invalidLines.length > 0) {
      toastManager.add({
        type: "error",
        title: "Environment variables not saved",
        description: `Use KEY=value on each line. Check: ${invalidLines.join(", ")}`,
      });
      return;
    }
    if (formatWorkspaceEnv(env) !== envText) {
      void update({ env }, "Failed to update workspace");
    }
  };

  const remove = async () => {
    const bridge = window.desktopBridge;
    const api = readLocalApi();
    if (bridge === undefined || !api) return;
    const confirmed = await api.dialogs.confirm(
      `Delete workspace "${workspace.name}"? This permanently deletes its threads, settings and separate logins and stops anything running in it. Project files and worktrees stay on disk.`,
      { variant: "destructive" },
    );
    if (!confirmed) return;
    try {
      const next = await bridge.removeWorkspace(workspace.id);
      if (activeBackendId === workspaceBackendId(workspace)) {
        setActiveBackendId(null);
      }
      setWorkspaces(next);
    } catch {
      toastManager.add({ type: "error", title: "Failed to delete workspace" });
    }
  };

  return (
    <SettingsSection id={`workspace-${workspace.id}`} title={workspace.name}>
      <SettingsRow
        title="Name"
        description="Shown in the sidebar workspace switcher."
        control={
          <Input
            key={workspace.name}
            size="sm"
            className="w-full sm:w-64"
            aria-label={`Name of ${workspace.name}`}
            defaultValue={workspace.name}
            onChange={() => {
              nameEditedRef.current = true;
            }}
            onBlur={(event) => {
              const wasEdited = nameEditedRef.current;
              nameEditedRef.current = false;
              if (wasEdited && event.currentTarget.value.trim() !== workspace.name) {
                void update({ name: event.currentTarget.value }, "Failed to rename workspace");
              }
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        }
      />
      {SEPARATE_TOOLS.map((entry) => (
        <SettingsRow
          key={entry.tool}
          title={`Separate ${entry.label}`}
          description={
            <>
              Off uses Default's login and config. On gives this workspace its own: run{" "}
              <code>{entry.signInCommand}</code> in a terminal here to sign in.
            </>
          }
          control={
            <Switch
              checked={workspace.separate.includes(entry.tool)}
              onCheckedChange={(checked) => void setToolSeparate(entry, Boolean(checked))}
              aria-label={`Separate ${entry.label} for ${workspace.name}`}
            />
          }
        />
      ))}
      <SettingsRow
        title="Environment variables"
        description="One KEY=value per line, for this workspace's terminals and agents. Stored in plain text, so keep secrets out. Saving restarts the workspace."
        control={
          <Textarea
            key={envText}
            size="sm"
            rows={3}
            className="w-full sm:w-64"
            aria-label={`Environment variables for ${workspace.name}`}
            placeholder="KEY=value"
            defaultValue={envText}
            onBlur={(event) => saveEnv(event.currentTarget.value)}
          />
        }
      />
      <SettingsRow
        title="Delete workspace"
        description="Deletes its threads, settings and separate logins. Project files and worktrees stay on disk."
        control={
          <Button size="sm" variant="destructive-outline" onClick={() => void remove()}>
            <Trash2Icon />
            Delete workspace
          </Button>
        }
      />
    </SettingsSection>
  );
}

export function WorkspacesSettingsPanel() {
  const workspaces = useWorkspacesStore((store) => store.workspaces);
  const [, setActiveBackendId] = useActiveWorkspaceBackendId();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <SettingsPageContainer className="gap-6">
      <SettingsSection
        id="workspaces"
        title="Workspaces"
        headerAction={
          <Button size="xs" variant="outline" onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            New workspace
          </Button>
        }
      >
        <SettingsRow
          title="Inherited from Default"
          description="Workspaces keep their own threads and projects. Logins, tools and MCP servers come from Default unless you separate them below."
        />
      </SettingsSection>
      {workspaces.map((workspace) => (
        <WorkspaceSettingsSection key={workspace.id} workspace={workspace} />
      ))}
      <NewWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setActiveBackendId}
      />
    </SettingsPageContainer>
  );
}
