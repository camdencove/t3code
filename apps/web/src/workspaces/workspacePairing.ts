import type { AdvertisedEndpoint } from "@t3tools/contracts";

import { resolveDesktopPairingUrl } from "../components/settings/pairingUrls";

/** Workspaces listen on their own port on the same addresses as the desktop's primary server. */
export function resolveWorkspacePairingUrl(input: {
  readonly advertisedEndpoints: ReadonlyArray<AdvertisedEndpoint>;
  readonly workspaceHttpBaseUrl: string;
  readonly credential: string;
}): string | null {
  const endpoint = input.advertisedEndpoints.find(
    (candidate) =>
      candidate.reachability !== "loopback" &&
      candidate.status !== "unavailable" &&
      new URL(candidate.httpBaseUrl).protocol === "http:",
  );
  if (endpoint === undefined) return null;
  const url = new URL(endpoint.httpBaseUrl);
  url.port = new URL(input.workspaceHttpBaseUrl).port;
  return resolveDesktopPairingUrl(url.toString(), input.credential);
}
