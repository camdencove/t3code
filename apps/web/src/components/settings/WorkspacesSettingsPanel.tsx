import {
  type DesktopWorkspace,
  type DesktopWorkspaceTool,
  type EnvironmentId,
  type ProjectIconOverride,
} from "@t3tools/contracts";
import { BoxesIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";

import { updateClientSettings, useClientSettingsHydrated } from "../../hooks/useSettings";
import { readLocalApi } from "../../localApi";
import { useEnvironments } from "../../state/environments";
import {
  ALL_WORKSPACES_LABEL,
  DEFAULT_WORKSPACE_LABEL,
  isRemoteEnvironment,
  resolveAllWorkspacesLabel,
  resolveDefaultWorkspaceLabel,
  useActiveWorkspaceBackendId,
  useBuiltInWorkspaces,
  useDefaultWorkspaceLabel,
  useEnvironmentWorkspaces,
  useWorkspaceOptions,
  workspaceBackendId,
} from "../../workspaces/activeWorkspace";
import { NewWorkspaceDialog } from "../../workspaces/NewWorkspaceDialog";
import { formatWorkspaceEnv, parseWorkspaceEnv } from "../../workspaces/workspaceEnv";
import { WorkspaceIcon } from "../../workspaces/WorkspaceIcon";
import { useWorkspacesStore } from "../../workspaces/workspacesStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { WorkspaceOrderSection } from "./WorkspaceOrderSection";

const ProjectIconPickerDialog = lazy(() =>
  import("./ProjectIconPickerDialog").then((module) => ({
    default: module.ProjectIconPickerDialog,
  })),
);

const ALL_WORKSPACES_VALUE = "all";

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

function BuiltInNameRow({
  title,
  builtInName,
  value,
  onChange,
}: {
  title: string;
  builtInName: string;
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <SettingsRow
      title={title}
      description="Shown in the sidebar workspace switcher. Leave empty to use the built-in name."
      control={
        <Input
          key={value}
          size="sm"
          className="w-full sm:w-64"
          aria-label={title}
          placeholder={builtInName}
          defaultValue={value}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next !== value) onChange(next);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      }
    />
  );
}

function WorkspaceIconRow({
  title,
  name,
  icon,
  workspaceId,
  onChange,
}: {
  title: string;
  name: string;
  icon: ProjectIconOverride | null;
  workspaceId: string | null;
  onChange: (icon: ProjectIconOverride | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <>
      <SettingsRow
        title={title}
        description="Shown in the sidebar workspace switcher."
        control={
          <div className="flex items-center gap-2">
            {icon === null ? null : (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                Remove
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              <WorkspaceIcon option={{ icon, workspaceId }} fallback={<BoxesIcon />} />
              Choose icon
            </Button>
          </div>
        }
      />
      {pickerOpen ? (
        <Suspense fallback={null}>
          <ProjectIconPickerDialog
            current={icon}
            projectName={name}
            title="Choose workspace icon"
            open
            onOpenChange={setPickerOpen}
            onSelect={onChange}
          />
        </Suspense>
      ) : null}
    </>
  );
}

function WorkspaceSettingsSection({ workspace }: { workspace: DesktopWorkspace }) {
  const setWorkspaces = useWorkspacesStore((store) => store.setWorkspaces);
  const defaultLabel = useDefaultWorkspaceLabel();
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
      <WorkspaceIconRow
        title="Icon"
        name={workspace.name}
        icon={workspace.icon}
        workspaceId={workspace.id}
        onChange={(icon) => void update({ icon }, "Failed to update icon")}
      />
      {SEPARATE_TOOLS.map((entry) => (
        <SettingsRow
          key={entry.tool}
          title={`Separate ${entry.label}`}
          description={
            <>
              Off uses {defaultLabel}'s login and config. On gives this workspace its own: run{" "}
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

function RemoteEnvironmentsSection() {
  const { environments } = useEnvironments();
  const options = useWorkspaceOptions();
  const assignments = useEnvironmentWorkspaces();
  const settingsHydrated = useClientSettingsHydrated();
  const remoteEnvironments = environments.filter(isRemoteEnvironment);
  if (remoteEnvironments.length === 0) return null;

  const assign = (environmentId: EnvironmentId, value: string) => {
    const others = Object.fromEntries(
      Object.entries(assignments).filter(([assignedId]) => assignedId !== environmentId),
    );
    updateClientSettings({
      environmentWorkspaces:
        value === ALL_WORKSPACES_VALUE ? others : { ...others, [environmentId]: value },
    });
  };

  return (
    <SettingsSection id="workspace-remote-environments" title="Remote environments">
      {remoteEnvironments.map((environment) => {
        const value = assignments[environment.environmentId] ?? ALL_WORKSPACES_VALUE;
        const selected = options.find(
          (option) => (option.backendId ?? ALL_WORKSPACES_VALUE) === value,
        );
        return (
          <SettingsRow
            key={environment.environmentId}
            title={environment.label}
            description="Choose where its projects and threads show. Agents there use that server's own logins, not this workspace's."
            control={
              <Select
                value={value}
                onValueChange={(next) => {
                  if (next !== null) assign(environment.environmentId, next);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full sm:w-48"
                  aria-label={`Workspace for ${environment.label}`}
                  disabled={!settingsHydrated}
                >
                  <SelectValue>{selected?.label}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  {options.map((option) => {
                    const optionValue = option.backendId ?? ALL_WORKSPACES_VALUE;
                    return (
                      <SelectItem hideIndicator key={optionValue} value={optionValue}>
                        {option.label}
                      </SelectItem>
                    );
                  })}
                </SelectPopup>
              </Select>
            }
          />
        );
      })}
    </SettingsSection>
  );
}

export function WorkspacesSettingsPanel() {
  const workspaces = useWorkspacesStore((store) => store.workspaces);
  const builtIn = useBuiltInWorkspaces();
  const defaultLabel = resolveDefaultWorkspaceLabel(builtIn.defaultWorkspaceName);
  const allLabel = resolveAllWorkspacesLabel(builtIn.allWorkspacesName);
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
          title={`Inherited from ${defaultLabel}`}
          description={`Workspaces keep their own threads and projects. Logins, tools and MCP servers come from ${defaultLabel} unless you separate them below.`}
        />
        <BuiltInNameRow
          title="Default name"
          builtInName={DEFAULT_WORKSPACE_LABEL}
          value={builtIn.defaultWorkspaceName}
          onChange={(defaultWorkspaceName) => void updateClientSettings({ defaultWorkspaceName })}
        />
        <WorkspaceIconRow
          title="Default icon"
          name={defaultLabel}
          icon={builtIn.defaultWorkspaceIcon}
          workspaceId={null}
          onChange={(defaultWorkspaceIcon) => void updateClientSettings({ defaultWorkspaceIcon })}
        />
        <BuiltInNameRow
          title="All workspaces name"
          builtInName={ALL_WORKSPACES_LABEL}
          value={builtIn.allWorkspacesName}
          onChange={(allWorkspacesName) => void updateClientSettings({ allWorkspacesName })}
        />
        <WorkspaceIconRow
          title="All workspaces icon"
          name={allLabel}
          icon={builtIn.allWorkspacesIcon}
          workspaceId={null}
          onChange={(allWorkspacesIcon) => void updateClientSettings({ allWorkspacesIcon })}
        />
      </SettingsSection>
      <WorkspaceOrderSection />
      <RemoteEnvironmentsSection />
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
