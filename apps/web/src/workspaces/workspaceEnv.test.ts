import { describe, expect, it } from "vite-plus/test";

import { formatWorkspaceEnv, parseWorkspaceEnv } from "./workspaceEnv";

describe("parseWorkspaceEnv", () => {
  it.each([
    { name: "nothing", text: "", env: {}, invalidLines: [] },
    {
      name: "one variable",
      text: "AWS_PROFILE=staging",
      env: { AWS_PROFILE: "staging" },
      invalidLines: [],
    },
    { name: "spaces around parts", text: "  A = 1  ", env: { A: "1" }, invalidLines: [] },
    { name: "an equals sign in the value", text: "A=b=c", env: { A: "b=c" }, invalidLines: [] },
    { name: "an empty value", text: "A=", env: { A: "" }, invalidLines: [] },
    { name: "blank lines and comments", text: "# note\n\nA=1", env: { A: "1" }, invalidLines: [] },
    { name: "a repeated variable", text: "A=1\nA=2", env: { A: "2" }, invalidLines: [] },
    { name: "no equals sign", text: "A", env: {}, invalidLines: ["A"] },
    { name: "no name", text: "=1", env: {}, invalidLines: ["=1"] },
    { name: "an invalid name", text: "1A=1", env: {}, invalidLines: ["1A=1"] },
    { name: "valid and invalid lines", text: "A=1\nnope", env: { A: "1" }, invalidLines: ["nope"] },
  ])("parses $name", ({ text, env, invalidLines }) => {
    expect(parseWorkspaceEnv(text)).toEqual({ env, invalidLines });
  });

  it("reads back what formatWorkspaceEnv writes", () => {
    const env = { A: "1", B: "b=c" };
    expect(parseWorkspaceEnv(formatWorkspaceEnv(env)).env).toEqual(env);
  });
});
