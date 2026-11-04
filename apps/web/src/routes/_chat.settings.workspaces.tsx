import { createFileRoute } from "@tanstack/react-router";
import { WorkspacesSettingsPanel } from "../components/settings/WorkspacesSettingsPanel";

export const Route = createFileRoute("/_chat/settings/workspaces")({
  component: WorkspacesSettingsPanel,
});
