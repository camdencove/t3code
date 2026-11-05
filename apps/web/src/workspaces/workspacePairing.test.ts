import type { AdvertisedEndpoint } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveWorkspacePairingUrl } from "./workspacePairing";

const endpoint = (overrides: Partial<AdvertisedEndpoint>) =>
  ({
    id: "lan",
    label: "LAN",
    provider: { id: "desktop-core", label: "Desktop", kind: "core", isAddon: false },
    httpBaseUrl: "http://192.168.1.20:3773/",
    wsBaseUrl: "ws://192.168.1.20:3773/",
    reachability: "lan",
    compatibility: { hostedHttpsApp: "mixed-content-blocked" },
    source: "desktop-core",
    status: "available",
    ...overrides,
  }) as AdvertisedEndpoint;

const loopback = endpoint({ httpBaseUrl: "http://127.0.0.1:3773/", reachability: "loopback" });
const lan = endpoint({});
const tailnetHttps = endpoint({
  httpBaseUrl: "https://mac.tailnet.ts.net/",
  reachability: "private-network",
});
const unavailable = endpoint({ httpBaseUrl: "http://192.168.1.99:3773/", status: "unavailable" });

describe("resolveWorkspacePairingUrl", () => {
  it.each([
    { name: "no endpoints", endpoints: [], host: null },
    { name: "only loopback", endpoints: [loopback], host: null },
    { name: "only an HTTPS proxy for the primary server", endpoints: [tailnetHttps], host: null },
    { name: "only an unavailable address", endpoints: [unavailable], host: null },
    { name: "a LAN address", endpoints: [loopback, lan], host: "192.168.1.20:3990" },
    {
      name: "a LAN address after an HTTPS proxy",
      endpoints: [tailnetHttps, lan],
      host: "192.168.1.20:3990",
    },
  ])("handles $name", ({ endpoints, host }) => {
    const url = resolveWorkspacePairingUrl({
      advertisedEndpoints: endpoints,
      workspaceHttpBaseUrl: "http://127.0.0.1:3990",
      credential: "code",
    });
    expect(url === null ? null : new URL(url).host).toBe(host);
    if (url !== null) expect(url).toContain("code");
  });
});
