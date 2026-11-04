const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseWorkspaceEnv(text: string): {
  readonly env: Readonly<Record<string, string>>;
  readonly invalidLines: ReadonlyArray<string>;
} {
  const env: Record<string, string> = {};
  const invalidLines: Array<string> = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    const name = line.slice(0, Math.max(separator, 0)).trim();
    if (VARIABLE_NAME.test(name)) {
      env[name] = line.slice(separator + 1).trim();
    } else {
      invalidLines.push(line);
    }
  }
  return { env, invalidLines };
}

export function formatWorkspaceEnv(env: Readonly<Record<string, string>>): string {
  return Object.entries(env)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
}
