import type { tlsFetch } from "./tlsTransport"

const configured = process.env.TIER1_TRANSPORT?.trim().toLowerCase() || "bun"
if (configured !== "bun" && configured !== "wreq") {
  throw new Error(`Invalid TIER1_TRANSPORT ${JSON.stringify(process.env.TIER1_TRANSPORT)}; expected "bun" or "wreq"`)
}
export const TIER1_TRANSPORT = configured

// Load the optional binding before serving requests, without loading it for Bun.
const native = TIER1_TRANSPORT === "wreq" ? await import("./tlsTransport") : undefined

export const tier1Transport: { fetch: typeof tlsFetch } = {
  fetch: native?.tlsFetch ?? ((url, init) => fetch(url, init)),
}

export function tier1UserAgent(fallback: string): string {
  return native?.TIER1_USER_AGENT ?? fallback
}

export async function verifyTier1Transport(): Promise<void> {
  native?.verifyTlsTransport()
}
