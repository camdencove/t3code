import { describe, expect, it } from "vite-plus/test";

import { workspaceBackendEnv } from "./workspaceBackendEnv.ts";

const workspacePath = (name: string) => `/workspaces/alpha/${name}`;
const t3Home = { T3CODE_HOME: "/workspaces/alpha/t3" };
const ownClaude = { CLAUDE_CONFIG_DIR: "/workspaces/alpha/claude" };
const ownCodex = { CODEX_HOME: "/workspaces/alpha/codex" };
const ownGithub = { GH_CONFIG_DIR: "/workspaces/alpha/github" };

describe("workspaceBackendEnv", () => {
  it.each([
    {
      name: "a workspace that inherits everything",
      separate: [],
      env: {},
      expected: t3Home,
    },
    {
      name: "separate Claude only",
      separate: ["claude"],
      env: {},
      expected: { ...t3Home, ...ownClaude },
    },
    {
      name: "separate Codex only",
      separate: ["codex"],
      env: {},
      expected: { ...t3Home, ...ownCodex },
    },
    {
      name: "separate GitHub only",
      separate: ["github"],
      env: {},
      expected: { ...t3Home, ...ownGithub },
    },
    {
      name: "every tool separate",
      separate: ["claude", "codex", "github"],
      env: {},
      expected: { ...t3Home, ...ownClaude, ...ownCodex, ...ownGithub },
    },
    {
      name: "environment overrides",
      separate: [],
      env: { AWS_PROFILE: "alpha" },
      expected: { ...t3Home, AWS_PROFILE: "alpha" },
    },
    {
      name: "an override of a separate tool's variable",
      separate: ["claude"],
      env: { CLAUDE_CONFIG_DIR: "/elsewhere" },
      expected: { ...t3Home, ...ownClaude },
    },
    {
      name: "an override of the T3 home",
      separate: [],
      env: { T3CODE_HOME: "/elsewhere" },
      expected: t3Home,
    },
    {
      name: "an override of another T3 variable",
      separate: [],
      env: { t3code_port: "1" },
      expected: t3Home,
    },
  ] as const)("builds the env for $name", ({ separate, env, expected }) => {
    expect(workspaceBackendEnv({ workspacePath, workspace: { separate, env } })).toEqual(expected);
  });
});
