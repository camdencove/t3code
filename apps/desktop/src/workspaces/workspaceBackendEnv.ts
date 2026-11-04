import type { DesktopWorkspace, DesktopWorkspaceTool } from "@t3tools/contracts";

const SEPARATE_TOOL_ENV: Record<DesktopWorkspaceTool, string> = {
  claude: "CLAUDE_CONFIG_DIR",
  codex: "CODEX_HOME",
  github: "GH_CONFIG_DIR",
};

export function workspaceBackendEnv(input: {
  readonly workspacePath: (name: string) => string;
  readonly workspace: Pick<DesktopWorkspace, "separate" | "env">;
}): Record<string, string> {
  const { workspacePath, workspace } = input;
  return {
    ...Object.fromEntries(
      Object.entries(workspace.env).filter(([name]) => !name.toUpperCase().startsWith("T3CODE_")),
    ),
    ...Object.fromEntries(
      workspace.separate.map((tool) => [SEPARATE_TOOL_ENV[tool], workspacePath(tool)]),
    ),
    T3CODE_HOME: workspacePath("t3"),
  };
}
