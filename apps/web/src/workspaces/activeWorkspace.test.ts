import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import { EnvironmentId, PRIMARY_LOCAL_ENVIRONMENT_ID } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  keepExistingWorkspaceAssignments,
  keepInActiveWorkspace,
  resolveWorkspaceEnvironmentIds,
  resolveWorkspaceLocalEnvironmentId,
  workspaceOptions,
} from "./activeWorkspace";

const primaryId = EnvironmentId.make("env-primary");
const alphaId = EnvironmentId.make("env-alpha");
const alpha = {
  environmentId: alphaId,
  entry: {
    target: {
      _tag: "BearerConnectionTarget",
      connectionId: "local:workspace:alpha",
    } as unknown as ConnectionTarget,
  },
};

const remoteId = EnvironmentId.make("env-remote");
const remote = {
  environmentId: remoteId,
  entry: {
    target: {
      _tag: "BearerConnectionTarget",
      connectionId: "ssh:remote",
    } as unknown as ConnectionTarget,
  },
};
const environments = [alpha, remote];

describe("resolveWorkspaceEnvironmentIds", () => {
  it.each([
    { name: "no active workspace", activeBackendId: null, expected: null },
    {
      name: "the default workspace",
      activeBackendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      expected: [primaryId],
    },
    { name: "a connected workspace", activeBackendId: "workspace:alpha", expected: [alphaId] },
    { name: "a workspace still starting", activeBackendId: "workspace:beta", expected: [] },
  ])("resolves $name", ({ activeBackendId, expected }) => {
    const resolved = resolveWorkspaceEnvironmentIds({
      activeBackendId,
      primaryEnvironmentId: primaryId,
      environments: [alpha],
      environmentWorkspaces: {},
    });
    expect(resolved === null ? null : [...resolved]).toEqual(expected);
  });

  it.each([
    {
      name: "Default when in all workspaces",
      activeBackendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      environmentWorkspaces: {},
      expected: [primaryId, remoteId],
    },
    {
      name: "a workspace when in all workspaces",
      activeBackendId: "workspace:alpha",
      environmentWorkspaces: {},
      expected: [alphaId, remoteId],
    },
    {
      name: "a workspace still starting when in all workspaces",
      activeBackendId: "workspace:beta",
      environmentWorkspaces: {},
      expected: [remoteId],
    },
    {
      name: "its own workspace",
      activeBackendId: "workspace:alpha",
      environmentWorkspaces: { [remoteId]: "workspace:alpha" },
      expected: [alphaId, remoteId],
    },
    {
      name: "Default when it belongs to Default",
      activeBackendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      environmentWorkspaces: { [remoteId]: PRIMARY_LOCAL_ENVIRONMENT_ID },
      expected: [primaryId, remoteId],
    },
    {
      name: "Default when it belongs to a workspace",
      activeBackendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      environmentWorkspaces: { [remoteId]: "workspace:alpha" },
      expected: [primaryId],
    },
    {
      name: "another workspace",
      activeBackendId: "workspace:alpha",
      environmentWorkspaces: { [remoteId]: "workspace:beta" },
      expected: [alphaId],
    },
  ])(
    "scopes a remote environment for $name",
    ({ activeBackendId, environmentWorkspaces, expected }) => {
      const resolved = resolveWorkspaceEnvironmentIds({
        activeBackendId,
        primaryEnvironmentId: primaryId,
        environments,
        environmentWorkspaces,
      });
      expect([...(resolved ?? [])]).toEqual(expected);
    },
  );

  it("shows only the chosen environment when a remote environment is selected", () => {
    const resolved = resolveWorkspaceEnvironmentIds({
      activeBackendId: `remote:${remoteId}`,
      primaryEnvironmentId: primaryId,
      environments,
      environmentWorkspaces: { [remoteId]: "workspace:alpha" },
    });
    expect([...(resolved ?? [])]).toEqual([remoteId]);
  });

  it("shows nothing for a removed remote environment", () => {
    const resolved = resolveWorkspaceEnvironmentIds({
      activeBackendId: "remote:env-gone",
      primaryEnvironmentId: primaryId,
      environments,
      environmentWorkspaces: {},
    });
    expect(resolved?.size).toBe(0);
  });

  it("keeps every environment in all workspaces", () => {
    const resolved = resolveWorkspaceEnvironmentIds({
      activeBackendId: null,
      primaryEnvironmentId: primaryId,
      environments,
      environmentWorkspaces: { [remoteId]: "workspace:alpha" },
    });
    expect(resolved).toBeNull();
  });

  it("shows nothing for the default workspace before the primary connects", () => {
    const resolved = resolveWorkspaceEnvironmentIds({
      activeBackendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      primaryEnvironmentId: null,
      environments: [alpha],
      environmentWorkspaces: {},
    });
    expect(resolved?.size).toBe(0);
  });
});

describe("resolveWorkspaceLocalEnvironmentId", () => {
  it.each([
    { name: "no active workspace", activeBackendId: null, expected: null },
    {
      name: "the default workspace",
      activeBackendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      expected: primaryId,
    },
    { name: "a connected workspace", activeBackendId: "workspace:alpha", expected: alphaId },
    { name: "a workspace still starting", activeBackendId: "workspace:beta", expected: null },
    {
      name: "a selected remote environment",
      activeBackendId: `remote:${remoteId}`,
      expected: remoteId,
    },
  ])("resolves the environment for $name", ({ activeBackendId, expected }) => {
    expect(
      resolveWorkspaceLocalEnvironmentId({
        activeBackendId,
        primaryEnvironmentId: primaryId,
        environments,
      }),
    ).toBe(expected);
  });
});

describe("workspaceOptions", () => {
  const workspaces = [{ id: "alpha", name: "Alpha", separate: [], env: {}, icon: null }];
  const defaultIcon = { kind: "emoji", emoji: "🧪" } as const;
  const allIcon = { kind: "emoji", emoji: "🌍" } as const;

  it.each([
    {
      name: "built-in names and no icons",
      builtIn: {},
      labels: ["All workspaces", "Default", "Alpha"],
      icons: [null, null, null],
    },
    {
      name: "blank names",
      builtIn: { allWorkspacesName: "  ", defaultWorkspaceName: "" },
      labels: ["All workspaces", "Default", "Alpha"],
      icons: [null, null, null],
    },
    {
      name: "a renamed Default",
      builtIn: { defaultWorkspaceName: " Personal " },
      labels: ["All workspaces", "Personal", "Alpha"],
      icons: [null, null, null],
    },
    {
      name: "a renamed all workspaces",
      builtIn: { allWorkspacesName: "Everything" },
      labels: ["Everything", "Default", "Alpha"],
      icons: [null, null, null],
    },
    {
      name: "a Default icon only",
      builtIn: { defaultWorkspaceIcon: defaultIcon },
      labels: ["All workspaces", "Default", "Alpha"],
      icons: [null, defaultIcon, null],
    },
    {
      name: "an all workspaces icon only",
      builtIn: { allWorkspacesIcon: allIcon },
      labels: ["All workspaces", "Default", "Alpha"],
      icons: [allIcon, null, null],
    },
  ])("applies $name", ({ builtIn, labels, icons }) => {
    const options = workspaceOptions(workspaces, builtIn);
    expect(options.map((option) => option.label)).toEqual(labels);
    expect(options.map((option) => option.icon)).toEqual(icons);
  });

  it("lists remote environments after workspaces, with their saved icons", () => {
    const options = workspaceOptions(workspaces, { environmentIcons: { [remoteId]: allIcon } }, [
      { environmentId: remoteId, label: "Box" },
    ]);
    expect(options.at(-1)).toEqual({
      backendId: `remote:${remoteId}`,
      colorKey: remoteId,
      icon: allIcon,
      label: "Box",
    });
  });

  it("sorts remote environments with the saved order", () => {
    const options = workspaceOptions(workspaces, { workspaceOrder: [`remote:${remoteId}`] }, [
      { environmentId: remoteId, label: "Box" },
    ]);
    expect(options[0]?.label).toBe("Box");
  });

  it.each([
    { name: "no saved order", order: [], labels: ["All workspaces", "Default", "Alpha"] },
    {
      name: "a full order",
      order: ["workspace:alpha", "all", PRIMARY_LOCAL_ENVIRONMENT_ID],
      labels: ["Alpha", "All workspaces", "Default"],
    },
    {
      name: "a partial order, with the rest after it",
      order: ["workspace:alpha"],
      labels: ["Alpha", "All workspaces", "Default"],
    },
    {
      name: "an order naming a deleted workspace",
      order: ["workspace:beta", PRIMARY_LOCAL_ENVIRONMENT_ID],
      labels: ["Default", "All workspaces", "Alpha"],
    },
  ])("sorts by $name", ({ order, labels }) => {
    const options = workspaceOptions(workspaces, { workspaceOrder: order });
    expect(options.map((option) => option.label)).toEqual(labels);
  });
});

describe("keepExistingWorkspaceAssignments", () => {
  const workspaces = [{ id: "alpha", name: "Alpha", separate: [], env: {}, icon: null }];

  it.each([
    { name: "an existing workspace", backendId: "workspace:alpha", kept: true },
    { name: "Default", backendId: PRIMARY_LOCAL_ENVIRONMENT_ID, kept: true },
    { name: "a deleted workspace", backendId: "workspace:beta", kept: false },
  ])("handles $name", ({ backendId, kept }) => {
    expect(keepExistingWorkspaceAssignments({ [remoteId]: backendId }, workspaces)).toEqual(
      kept ? { [remoteId]: backendId } : {},
    );
  });
});

describe("keepInActiveWorkspace", () => {
  const items = [{ environmentId: primaryId }, { environmentId: alphaId }];

  it.each([
    { name: "every item with no active workspace", ids: null, expected: items },
    { name: "only matching items", ids: new Set([alphaId]), expected: [items[1]] },
    { name: "nothing for an empty workspace", ids: new Set<EnvironmentId>(), expected: [] },
  ])("keeps $name", ({ ids, expected }) => {
    expect(keepInActiveWorkspace(items, ids)).toEqual(expected);
  });
});
