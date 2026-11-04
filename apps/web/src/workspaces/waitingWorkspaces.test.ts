import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import { EnvironmentId, PRIMARY_LOCAL_ENVIRONMENT_ID } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  rankWaitingWorkspaces,
  resolveNextWaitingThread,
  resolveWaitingWorkspaces,
} from "./waitingWorkspaces";

const primaryId = EnvironmentId.make("env-primary");
const alphaId = EnvironmentId.make("env-alpha");
const betaId = EnvironmentId.make("env-beta");
const remoteId = EnvironmentId.make("env-remote");

const target = (connectionId: string) =>
  ({ _tag: "BearerConnectionTarget", connectionId }) as unknown as ConnectionTarget;

const environments = [
  { environmentId: alphaId, entry: { target: target("local:workspace:alpha") } },
  { environmentId: betaId, entry: { target: target("local:workspace:beta") } },
  { environmentId: remoteId, entry: { target: target("ssh:remote") } },
];

const idleThread = {
  hasActionableProposedPlan: false,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  interactionMode: "default",
  latestRun: null,
  pendingGuestMessageCount: 0,
  pendingSubagentRequest: null,
  runtime: null,
} as const;

const backendIds = [PRIMARY_LOCAL_ENVIRONMENT_ID, "workspace:alpha", "workspace:beta"];

const resolve = (input: {
  activeBackendId: string | null;
  threads: Parameters<typeof resolveWaitingWorkspaces>[0]["threads"];
  environmentWorkspaces?: Readonly<Record<string, string>>;
}) =>
  Object.fromEntries(
    resolveWaitingWorkspaces({
      backendIds,
      environments,
      environmentWorkspaces: {},
      primaryEnvironmentId: primaryId,
      ...input,
    }),
  );

describe("resolveWaitingWorkspaces", () => {
  it.each([
    {
      name: "approval in another workspace",
      thread: { ...idleThread, environmentId: betaId, hasPendingApprovals: true },
      expected: { "workspace:beta": "attention" },
    },
    {
      name: "question in Default",
      thread: { ...idleThread, environmentId: primaryId, hasPendingUserInput: true },
      expected: { [PRIMARY_LOCAL_ENVIRONMENT_ID]: "attention" },
    },
    {
      name: "unread finished run in another workspace",
      thread: {
        ...idleThread,
        environmentId: betaId,
        lastVisitedAt: "2026-11-04T10:00:00.000Z",
        latestRun: { completedAt: "2026-11-04T11:00:00.000Z", status: "completed" },
      },
      expected: { "workspace:beta": "unread" },
    },
    {
      name: "failed run in another workspace",
      thread: {
        ...idleThread,
        environmentId: betaId,
        latestRun: { completedAt: "2026-11-04T11:00:00.000Z", status: "failed" },
        runtime: { status: "failed", lastErrorClass: null },
      },
      expected: { "workspace:beta": "failed" },
    },
    {
      name: "running work, which is not waiting on you",
      thread: { ...idleThread, environmentId: betaId, runtime: { status: "preparing" } },
      expected: {},
    },
    {
      name: "a thread in the active workspace",
      thread: { ...idleThread, environmentId: alphaId, hasPendingApprovals: true },
      expected: {},
    },
    {
      name: "a remote thread shown in every workspace",
      thread: { ...idleThread, environmentId: remoteId, hasPendingApprovals: true },
      expected: {},
    },
  ])("handles $name", ({ thread, expected }) => {
    expect(
      resolve({
        activeBackendId: "workspace:alpha",
        threads: [thread] as unknown as Parameters<typeof resolve>[0]["threads"],
      }),
    ).toEqual(expected);
  });

  it("marks only the workspace a remote environment is assigned to", () => {
    expect(
      resolve({
        activeBackendId: "workspace:alpha",
        environmentWorkspaces: { [remoteId]: "workspace:beta" },
        threads: [
          { ...idleThread, environmentId: remoteId, hasPendingApprovals: true },
        ] as unknown as Parameters<typeof resolve>[0]["threads"],
      }),
    ).toEqual({ "workspace:beta": "attention" });
  });

  it("marks nothing in all workspaces, where every thread is on screen", () => {
    expect(
      resolve({
        activeBackendId: null,
        threads: [
          { ...idleThread, environmentId: betaId, hasPendingApprovals: true },
        ] as unknown as Parameters<typeof resolve>[0]["threads"],
      }),
    ).toEqual({});
  });
});

describe("resolveNextWaitingThread", () => {
  const asking = (environmentId: EnvironmentId, updatedAt: string) => ({
    ...idleThread,
    environmentId,
    hasPendingApprovals: true,
    updatedAt,
  });
  const finished = (environmentId: EnvironmentId, completedAt: string) => ({
    ...idleThread,
    environmentId,
    lastVisitedAt: "2026-11-01T00:00:00.000Z",
    latestRun: { completedAt, status: "completed" },
    updatedAt: completedAt,
  });
  const next = (input: { activeBackendId: string | null; threads: ReadonlyArray<unknown> }) =>
    resolveNextWaitingThread({
      backendIds,
      environments,
      environmentWorkspaces: {},
      primaryEnvironmentId: primaryId,
      ...input,
      threads: input.threads as Parameters<typeof resolveWaitingWorkspaces>[0]["threads"],
    });

  const older = "2026-11-04T09:00:00.000Z";
  const newer = "2026-11-04T10:00:00.000Z";

  it.each([
    { name: "nothing waiting", threads: [], expected: null },
    {
      name: "the thread that asked first",
      threads: [asking(betaId, newer), asking(primaryId, older)],
      expected: { backendId: PRIMARY_LOCAL_ENVIRONMENT_ID, environmentId: primaryId },
    },
    {
      name: "a question over an older finished run",
      threads: [finished(primaryId, older), asking(betaId, newer)],
      expected: { backendId: "workspace:beta", environmentId: betaId },
    },
    {
      name: "the oldest finished run when nothing is asking",
      threads: [finished(betaId, newer), finished(primaryId, older)],
      expected: { backendId: PRIMARY_LOCAL_ENVIRONMENT_ID, environmentId: primaryId },
    },
    {
      name: "another workspace over the active one",
      threads: [asking(alphaId, older), asking(betaId, newer)],
      expected: { backendId: "workspace:beta", environmentId: betaId },
    },
  ])("picks $name", ({ threads, expected }) => {
    const result = next({ activeBackendId: "workspace:alpha", threads });
    expect(
      result === null
        ? null
        : { backendId: result.backendId, environmentId: result.thread.environmentId },
    ).toEqual(expected);
  });

  it("stays in all workspaces and picks across everything", () => {
    const result = next({
      activeBackendId: null,
      threads: [asking(alphaId, newer), asking(betaId, older)],
    });
    expect(result?.backendId).toBeNull();
    expect(result?.thread.environmentId).toBe(betaId);
  });
});

describe("rankWaitingWorkspaces", () => {
  const options = [
    { backendId: null },
    { backendId: "primary" },
    { backendId: "workspace:alpha" },
    { backendId: "workspace:beta" },
  ];

  it.each([
    { name: "nothing waiting", dots: {}, expected: [] },
    { name: "one workspace", dots: { "workspace:beta": "unread" }, expected: ["workspace:beta"] },
    {
      name: "urgent workspaces first",
      dots: { primary: "unread", "workspace:beta": "attention", "workspace:alpha": "failed" },
      expected: ["workspace:beta", "workspace:alpha", "primary"],
    },
    {
      name: "list order within the same urgency",
      dots: { "workspace:beta": "unread", primary: "unread" },
      expected: ["primary", "workspace:beta"],
    },
  ] as const)("orders $name", ({ dots, expected }) => {
    const ranked = rankWaitingWorkspaces(options, new Map(Object.entries(dots)));
    expect(ranked.map(({ option }) => option.backendId)).toEqual(expected);
  });
});
