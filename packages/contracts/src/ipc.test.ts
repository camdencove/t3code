import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { DesktopWorkspaceSchema } from "./ipc.ts";

const decodeWorkspace = Schema.decodeUnknownSync(DesktopWorkspaceSchema);

describe("DesktopWorkspaceSchema", () => {
  it.each([
    { name: "a workspace saved before icons", icon: undefined, expected: null },
    { name: "a removed icon", icon: null, expected: null },
    {
      name: "an emoji icon",
      icon: { kind: "emoji", emoji: "🧪" },
      expected: { kind: "emoji", emoji: "🧪" },
    },
    { name: "an icon kind from a newer version", icon: { kind: "future" }, expected: null },
  ])("decodes $name", ({ icon, expected }) => {
    const workspace = decodeWorkspace({
      id: "alpha",
      name: "Alpha",
      ...(icon === undefined ? {} : { icon }),
    });
    expect(workspace.icon).toEqual(expected);
  });
});
