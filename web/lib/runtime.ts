// Wires config, Redis and the Graph client together for the route handlers.

import { Redis } from "@upstash/redis";
import { readConfig, type Config } from "./config";
import { Graph } from "./graph";
import { MemoryKV, Store, type KV } from "./store";

// Route handlers are bundled separately, so share the dev store via globalThis.
const g = globalThis as typeof globalThis & { __whatsMcpMemory?: MemoryKV };

export function storeFor(cfg: Config): Store {
  if (cfg.redisUrl && cfg.redisToken) {
    return new Store(new Redis({ url: cfg.redisUrl, token: cfg.redisToken }) as unknown as KV);
  }
  // Local development only: data lives as long as the process does.
  g.__whatsMcpMemory ??= new MemoryKV();
  return new Store(g.__whatsMcpMemory);
}

export function runtime() {
  const cfg = readConfig();
  return { cfg, store: storeFor(cfg), graph: new Graph(cfg) };
}
