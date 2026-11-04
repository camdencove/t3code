import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

// Everything else in secrets/ is a key that identifies one server, so it must never be shared.
const SETTINGS_SECRET_PREFIXES = [
  "provider-config-",
  "provider-env-",
  "source-control-",
  "usage-limit-source-",
  "device-host-",
  "simlock-device-host-",
];

const SettingsDocument = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const decodeSettings = Schema.decodeEffect(SettingsDocument);
const encodeSettings = Schema.encodeEffect(SettingsDocument);

export const seedWorkspaceState = Effect.fn("desktop.workspaces.seedState")(function* (input: {
  readonly parentStateDir: string;
  readonly parentWorktreesDir: string;
  readonly workspaceDir: string;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stateDir = path.join(input.workspaceDir, "t3", "userdata");
  const secretsDir = path.join(stateDir, "secrets");
  const parentSecretsDir = path.join(input.parentStateDir, "secrets");
  yield* fileSystem.makeDirectory(secretsDir, { recursive: true, mode: 0o700 });

  const copyIfPresent = (name: string) =>
    fileSystem
      .exists(path.join(input.parentStateDir, name))
      .pipe(
        Effect.flatMap((exists) =>
          exists
            ? fileSystem.copy(path.join(input.parentStateDir, name), path.join(stateDir, name))
            : Effect.void,
        ),
      );
  yield* copyIfPresent("keybindings.json");
  yield* copyIfPresent("themes");

  const settings = yield* fileSystem
    .readFileString(path.join(input.parentStateDir, "settings.json"))
    .pipe(
      Effect.flatMap(decodeSettings),
      Effect.orElseSucceed((): Readonly<Record<string, unknown>> => ({})),
    );
  const { worktreesDirectory } = settings;
  yield* encodeSettings({
    ...settings,
    worktreesDirectory:
      typeof worktreesDirectory === "string" && worktreesDirectory.trim().length > 0
        ? worktreesDirectory
        : input.parentWorktreesDir,
  }).pipe(
    Effect.flatMap((encoded) =>
      fileSystem.writeFileString(path.join(stateDir, "settings.json"), encoded),
    ),
  );

  const secretFiles = yield* fileSystem
    .readDirectory(parentSecretsDir)
    .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
  yield* Effect.forEach(
    secretFiles.filter((name) =>
      SETTINGS_SECRET_PREFIXES.some((prefix) => name.startsWith(prefix)),
    ),
    (name) => fileSystem.copyFile(path.join(parentSecretsDir, name), path.join(secretsDir, name)),
    { discard: true },
  );
});

export const removeWorkspaceData = Effect.fn("desktop.workspaces.removeData")(function* (
  workspaceDir: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const t3Dir = path.join(workspaceDir, "t3");
  const worktrees = yield* fileSystem
    .readDirectory(path.join(t3Dir, "worktrees"))
    .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
  if (worktrees.length === 0) {
    return yield* fileSystem.remove(workspaceDir, { recursive: true, force: true });
  }

  const removeEntriesExcept = Effect.fnUntraced(function* (directory: string, kept: string) {
    const entries = yield* fileSystem.readDirectory(directory);
    yield* Effect.forEach(
      entries.filter((entry) => entry !== kept),
      (entry) => fileSystem.remove(path.join(directory, entry), { recursive: true, force: true }),
      { discard: true },
    );
  });
  yield* removeEntriesExcept(workspaceDir, "t3");
  yield* removeEntriesExcept(t3Dir, "worktrees");
});
