// Wires config, Redis and the API clients together for the route handlers.

import { Redis } from "@upstash/redis";
import { readConfig, type Config } from "./config";
import { Graph } from "./graph";
import { MemoryKV, Store, type KV } from "./store";
import { MemoryRawKV, type RawKV } from "./wa/auth";

// Route handlers are bundled separately, so share the dev stores via globalThis.
const g = globalThis as typeof globalThis & { __whatsMcpMemory?: MemoryKV; __whatsMcpRaw?: MemoryRawKV };

function redis(cfg: Config, raw = false) {
  return new Redis({ url: cfg.redisUrl, token: cfg.redisToken, automaticDeserialization: !raw });
}

export function storeFor(cfg: Config, prefix = ""): Store {
  if (cfg.redisUrl && cfg.redisToken) return new Store(redis(cfg) as unknown as KV, prefix);
  // Local development only: data lives as long as the process does.
  g.__whatsMcpMemory ??= new MemoryKV();
  return new Store(g.__whatsMcpMemory, prefix);
}

export function rawFor(cfg: Config): RawKV {
  if (cfg.redisUrl && cfg.redisToken) return redis(cfg, true) as unknown as RawKV;
  g.__whatsMcpRaw ??= new MemoryRawKV();
  return g.__whatsMcpRaw;
}

/** Official mode (Cloud API). */
export function runtime() {
  const cfg = readConfig();
  return { cfg, store: storeFor(cfg), graph: new Graph(cfg) };
}

/** Personal mode (linked device, connect on demand). */
export function personal() {
  const cfg = readConfig();
  return { cfg, store: storeFor(cfg, "p:"), raw: rawFor(cfg) };
}
