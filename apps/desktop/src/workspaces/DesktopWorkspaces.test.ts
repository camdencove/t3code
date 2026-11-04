import { describe, expect, it } from "vite-plus/test";

import {
  hasSameBackendEnv,
  isWorkspaceNameAvailable,
  workspaceIdFromName,
} from "./DesktopWorkspaces.ts";

const workspaces = [
  { id: "alpha", name: "Alpha Live" },
  { id: "beta", name: "Beta" },
];

describe("isWorkspaceNameAvailable", () => {
  it.each([
    { name: "a new name", input: "gamma", ownId: null, expected: true },
    { name: "an existing name", input: "beta", ownId: null, expected: false },
    { name: "a taken folder id", input: "alpha", ownId: null, expected: false },
    { name: "an empty name", input: "   ", ownId: null, expected: false },
    { name: "a rename to a new name", input: "Alpha", ownId: "alpha", expected: true },
    { name: "keeping its own name", input: "alpha live", ownId: "alpha", expected: true },
    { name: "a rename to another workspace", input: "Beta", ownId: "alpha", expected: false },
    { name: "a rename to nothing", input: "---", ownId: "alpha", expected: false },
  ])("handles $name", ({ input, ownId, expected }) => {
    expect(isWorkspaceNameAvailable(workspaces, input, ownId)).toBe(expected);
  });
});

describe("hasSameBackendEnv", () => {
  it.each([
    {
      name: "identical settings",
      left: { separate: ["claude"], env: { A: "1" } },
      right: { separate: ["claude"], env: { A: "1" } },
      expected: true,
    },
    {
      name: "the same settings in another order",
      left: { separate: ["claude", "github"], env: { A: "1", B: "2" } },
      right: { separate: ["github", "claude"], env: { B: "2", A: "1" } },
      expected: true,
    },
    {
      name: "an override the backend ignores",
      left: { separate: [], env: {} },
      right: { separate: [], env: { T3CODE_HOME: "/elsewhere" } },
      expected: true,
    },
    {
      name: "a newly separate tool",
      left: { separate: [], env: {} },
      right: { separate: ["codex"], env: {} },
      expected: false,
    },
    {
      name: "a changed variable",
      left: { separate: [], env: { A: "1" } },
      right: { separate: [], env: { A: "2" } },
      expected: false,
    },
  ] as const)("compares $name", ({ left, right, expected }) => {
    expect(hasSameBackendEnv(left, right)).toBe(expected);
  });
});

describe("workspaceIdFromName", () => {
  it.each([
    { name: "alpha", expected: "alpha" },
    { name: "  Gamma  ", expected: "gamma" },
    { name: "Beta Labs", expected: "beta-labs" },
    { name: "a/../b", expected: "a-b" },
    { name: "---", expected: "" },
    { name: "   ", expected: "" },
  ])("maps $name to $expected", ({ name, expected }) => {
    expect(workspaceIdFromName(name)).toBe(expected);
  });
});
