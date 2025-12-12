// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * LMDB Adapter - using Deno.Kv as backend
 * Deno.Kv provides similar KV semantics with native Deno support
 */

let kv = null;

const config = {
  path: Deno.env.get("LMDB_PATH") || null, // null = in-memory
};

export async function connect() {
  if (kv) return kv;
  kv = await Deno.openKv(config.path || undefined);
  return kv;
}

export async function disconnect() {
  if (kv) {
    kv.close();
    kv = null;
  }
}

export async function isConnected() {
  try {
    await connect();
    return true;
  } catch {
    return false;
  }
}

export const name = "lmdb";
export const description = "Embedded KV store (Deno.Kv backend)";

export const tools = {
  lmdb_get: {
    description: "Get a value by key",
    params: {
      key: { type: "string", description: "Key to get" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const result = await conn.get([key]);
      return { key, value: result.value, found: result.value !== null };
    },
  },

  lmdb_put: {
    description: "Put a key-value pair",
    params: {
      key: { type: "string", description: "Key to set" },
      value: { type: "string", description: "Value (JSON for objects)" },
    },
    handler: async ({ key, value }) => {
      const conn = await connect();
      let val;
      try {
        val = JSON.parse(value);
      } catch {
        val = value;
      }
      await conn.set([key], val);
      return { success: true, key };
    },
  },

  lmdb_delete: {
    description: "Delete a key",
    params: {
      key: { type: "string", description: "Key to delete" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const existing = await conn.get([key]);
      await conn.delete([key]);
      return { deleted: existing.value !== null, key };
    },
  },

  lmdb_exists: {
    description: "Check if a key exists",
    params: {
      key: { type: "string", description: "Key to check" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const result = await conn.get([key]);
      return { key, exists: result.value !== null };
    },
  },

  lmdb_range: {
    description: "Get a range of key-value pairs",
    params: {
      prefix: { type: "string", description: "Key prefix (optional)" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
    handler: async ({ prefix = "", limit = 100 }) => {
      const conn = await connect();
      const entries = [];
      const iter = conn.list({ prefix: prefix ? [prefix] : [] });

      for await (const entry of iter) {
        entries.push({
          key: entry.key.join("/"),
          value: entry.value,
        });
        if (entries.length >= limit) break;
      }

      return { count: entries.length, entries };
    },
  },

  lmdb_keys: {
    description: "Get all keys matching a prefix",
    params: {
      prefix: { type: "string", description: "Key prefix to match" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
    handler: async ({ prefix = "", limit = 100 }) => {
      const conn = await connect();
      const keys = [];
      const iter = conn.list({ prefix: prefix ? [prefix] : [] });

      for await (const entry of iter) {
        keys.push(entry.key.join("/"));
        if (keys.length >= limit) break;
      }

      return { count: keys.length, keys };
    },
  },

  lmdb_batch: {
    description: "Execute multiple put/delete operations atomically",
    params: {
      operations: {
        type: "string",
        description: "JSON array of {op: 'put'|'delete', key, value?}",
      },
    },
    handler: async ({ operations }) => {
      const conn = await connect();
      const ops = JSON.parse(operations);
      let atomic = conn.atomic();

      for (const op of ops) {
        if (op.op === "put") {
          let val;
          try {
            val = typeof op.value === "string" ? JSON.parse(op.value) : op.value;
          } catch {
            val = op.value;
          }
          atomic = atomic.set([op.key], val);
        } else if (op.op === "delete") {
          atomic = atomic.delete([op.key]);
        }
      }

      const result = await atomic.commit();
      return { success: result.ok, operations: ops.length };
    },
  },

  lmdb_stats: {
    description: "Get database statistics",
    params: {},
    handler: async () => {
      const conn = await connect();
      let count = 0;
      for await (const _ of conn.list({ prefix: [] })) {
        count++;
      }
      return {
        backend: "Deno.Kv",
        path: config.path || ":memory:",
        count,
      };
    },
  },
};
