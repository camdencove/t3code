import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { removeWorkspaceData, seedWorkspaceState } from "./workspaceState.ts";

const PARENT_WORKTREES = "/parent/worktrees";

const seedFrom = Effect.fn("seedFrom")(function* (parentFiles: Readonly<Record<string, string>>) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fileSystem.makeTempDirectoryScoped();
  const parentStateDir = path.join(root, "parent");
  const workspaceDir = path.join(root, "workspace");
  yield* fileSystem.makeDirectory(parentStateDir, { recursive: true });
  for (const [name, contents] of Object.entries(parentFiles)) {
    yield* fileSystem.makeDirectory(path.dirname(path.join(parentStateDir, name)), {
      recursive: true,
    });
    yield* fileSystem.writeFileString(path.join(parentStateDir, name), contents);
  }
  yield* seedWorkspaceState({
    parentStateDir,
    parentWorktreesDir: PARENT_WORKTREES,
    workspaceDir,
  });
  return path.join(workspaceDir, "t3", "userdata");
});

describe("seedWorkspaceState", () => {
  it.effect.each([
    {
      name: "no parent settings",
      parentFiles: {},
      expected: { worktreesDirectory: PARENT_WORKTREES },
    },
    {
      name: "unreadable parent settings",
      parentFiles: { "settings.json": "{" },
      expected: { worktreesDirectory: PARENT_WORKTREES },
    },
    {
      name: "parent settings with no worktree location",
      parentFiles: { "settings.json": '{"idleCompaction":"never"}' },
      expected: { idleCompaction: "never", worktreesDirectory: PARENT_WORKTREES },
    },
    {
      name: "a blank parent worktree location",
      parentFiles: { "settings.json": '{"worktreesDirectory":"  "}' },
      expected: { worktreesDirectory: PARENT_WORKTREES },
    },
    {
      name: "a custom parent worktree location",
      parentFiles: { "settings.json": '{"worktreesDirectory":"/code/worktrees"}' },
      expected: { worktreesDirectory: "/code/worktrees" },
    },
  ])("writes settings from $name", ({ parentFiles, expected }) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const stateDir = yield* seedFrom(parentFiles);
      const settings = yield* fileSystem.readFileString(path.join(stateDir, "settings.json"));
      assert.deepStrictEqual(JSON.parse(settings), expected);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect.each([
    { file: "keybindings.json", copied: true },
    { file: "themes/custom.json", copied: true },
    { file: "secrets/provider-config-a-b-c.bin", copied: true },
    { file: "secrets/provider-env-a-b.bin", copied: true },
    { file: "secrets/source-control-a-b.bin", copied: true },
    { file: "secrets/usage-limit-source-a.bin", copied: true },
    { file: "secrets/device-host-a-b.bin", copied: true },
    { file: "secrets/simlock-device-host-a-b.bin", copied: true },
    { file: "secrets/server-signing-key.bin", copied: false },
    { file: "secrets/asset-access-signing-key.bin", copied: false },
    { file: "secrets/cloud-link-ed25519-key-pair.bin", copied: false },
    { file: "secrets/mcp-oauth-signing-key.bin", copied: false },
    { file: "secrets/secret-request-salt.bin", copied: false },
    { file: "statev2.sqlite", copied: false },
    { file: "environment-id", copied: false },
  ])("handles $file with copied=$copied", ({ file, copied }) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const stateDir = yield* seedFrom({ [file]: "contents" });
      assert.strictEqual(yield* fileSystem.exists(path.join(stateDir, file)), copied);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});

describe("removeWorkspaceData", () => {
  it.effect.each([
    { name: "no worktrees folder", files: ["t3/userdata/statev2.sqlite"], kept: [] },
    { name: "an empty worktrees folder", files: ["t3/userdata/a", "t3/worktrees/"], kept: [] },
    {
      name: "a worktree",
      files: ["claude/.claude.json", "t3/userdata/a", "t3/worktrees/repo/branch/file"],
      kept: ["t3/worktrees/repo/branch/file"],
    },
  ])("handles $name", ({ files, kept }) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const workspaceDir = path.join(yield* fileSystem.makeTempDirectoryScoped(), "workspace");
      for (const file of files) {
        const target = path.join(workspaceDir, file);
        if (file.endsWith("/")) {
          yield* fileSystem.makeDirectory(target, { recursive: true });
          continue;
        }
        yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
        yield* fileSystem.writeFileString(target, "contents");
      }

      yield* removeWorkspaceData(workspaceDir);

      for (const file of files.filter((candidate) => !candidate.endsWith("/"))) {
        assert.strictEqual(
          yield* fileSystem.exists(path.join(workspaceDir, file)),
          kept.includes(file),
          file,
        );
      }
      assert.strictEqual(yield* fileSystem.exists(workspaceDir), kept.length > 0);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
