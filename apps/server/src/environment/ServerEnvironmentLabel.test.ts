import { describe, expect, it } from "vite-plus/test";

import { parseEnvironmentIcon } from "./ServerEnvironmentLabel.ts";

describe("parseEnvironmentIcon", () => {
  it.each([
    { name: "no variable", raw: undefined, expected: null },
    { name: "invalid JSON", raw: "{", expected: null },
    { name: "an unknown icon kind", raw: '{"kind":"future"}', expected: null },
    { name: "a malformed emoji icon", raw: '{"kind":"emoji"}', expected: null },
    {
      name: "an emoji icon",
      raw: '{"kind":"emoji","emoji":"🧪"}',
      expected: { kind: "emoji", emoji: "🧪" },
    },
    {
      name: "a lucide icon",
      raw: '{"kind":"lucide","name":"castle","color":"amber"}',
      expected: { kind: "lucide", name: "castle", color: "amber" },
    },
  ])("handles $name", ({ raw, expected }) => {
    expect(parseEnvironmentIcon(raw)).toEqual(expected);
  });
});
