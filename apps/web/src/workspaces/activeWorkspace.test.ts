import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import { EnvironmentId, PRIMARY_LOCAL_ENVIRONMENT_ID } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { keepInActiveWorkspace, resolveWorkspaceEnvironmentIds } from "./activeWorkspace";

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
    });
    expect(resolved === null ? null : [...resolved]).toEqual(expected);
  });

  it("shows nothing for the default workspace before the primary connects", () => {
    const resolved = resolveWorkspaceEnvironmentIds({
      activeBackendId: PRIMARY_LOCAL_ENVIRONMENT_ID,
      primaryEnvironmentId: null,
      environments: [alpha],
    });
    expect(resolved?.size).toBe(0);
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
