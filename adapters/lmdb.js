/**
 * LMDB Adapter
 * Lightning Memory-Mapped Database - fast embedded key-value store
 */

import { open } from "npm:lmdb@3";

let db = null;

const config = {
  path: Deno.env.get("LMDB_PATH") || "./lmdb-data",
  compression: Deno.env.get("LMDB_COMPRESSION") === "true",
};

export async function connect() {
  if (db) return db;
  db = open({
    path: config.path,
    compression: config.compression,
  });
  return db;
}

export async function disconnect() {
  if (db) {
    await db.close();
    db = null;
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
export const description = "Lightning Memory-Mapped Database - fast embedded key-value store";

export const tools = {
  lmdb_get: {
    description: "Get a value by key",
    params: {
      key: { type: "string", description: "Key to get" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const value = conn.get(key);
      return { key, value, found: value !== undefined };
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
      // Try to parse as JSON, otherwise store as string
      let val;
      try {
        val = JSON.parse(value);
      } catch {
        val = value;
      }
      await conn.put(key, val);
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
      const existed = conn.get(key) !== undefined;
      await conn.remove(key);
      return { deleted: existed, key };
    },
  },

  lmdb_exists: {
    description: "Check if a key exists",
    params: {
      key: { type: "string", description: "Key to check" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const exists = conn.doesExist(key);
      return { key, exists };
    },
  },

  lmdb_range: {
    description: "Get a range of key-value pairs",
    params: {
      start: { type: "string", description: "Start key (optional)" },
      end: { type: "string", description: "End key (optional)" },
      limit: { type: "number", description: "Max results (default 100)" },
      reverse: { type: "boolean", description: "Reverse order (default false)" },
    },
    handler: async ({ start, end, limit = 100, reverse = false }) => {
      const conn = await connect();
      const options = { limit, reverse };
      if (start) options.start = start;
      if (end) options.end = end;

      const entries = [];
      for (const { key, value } of conn.getRange(options)) {
        entries.push({ key, value });
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
    handler: async ({ prefix, limit = 100 }) => {
      const conn = await connect();
      const keys = [];
      for (const { key } of conn.getRange({ start: prefix })) {
        if (!key.startsWith(prefix)) break;
        keys.push(key);
        if (keys.length >= limit) break;
      }
      return { count: keys.length, keys };
    },
  },

  lmdb_count: {
    description: "Count entries in the database",
    params: {
      prefix: { type: "string", description: "Key prefix to count (optional)" },
    },
    handler: async ({ prefix }) => {
      const conn = await connect();
      if (prefix) {
        let count = 0;
        for (const { key } of conn.getRange({ start: prefix })) {
          if (!key.startsWith(prefix)) break;
          count++;
        }
        return { count, prefix };
      }
      return { count: conn.getCount() };
    },
  },

  lmdb_batch: {
    description: "Execute multiple put/delete operations atomically",
    params: {
      operations: { type: "string", description: "JSON array of {op: 'put'|'delete', key, value?}" },
    },
    handler: async ({ operations }) => {
      const conn = await connect();
      const ops = JSON.parse(operations);

      await conn.transaction(() => {
        for (const op of ops) {
          if (op.op === "put") {
            let val;
            try {
              val = typeof op.value === "string" ? JSON.parse(op.value) : op.value;
            } catch {
              val = op.value;
            }
            conn.put(op.key, val);
          } else if (op.op === "delete") {
            conn.remove(op.key);
          }
        }
      });

      return { success: true, operations: ops.length };
    },
  },

  lmdb_clear: {
    description: "Clear all entries with a given prefix",
    params: {
      prefix: { type: "string", description: "Key prefix to clear" },
    },
    handler: async ({ prefix }) => {
      const conn = await connect();
      let cleared = 0;

      await conn.transaction(() => {
        for (const { key } of conn.getRange({ start: prefix })) {
          if (!key.startsWith(prefix)) break;
          conn.remove(key);
          cleared++;
        }
      });

      return { cleared, prefix };
    },
  },

  lmdb_stats: {
    description: "Get database statistics",
    params: {},
    handler: async () => {
      const conn = await connect();
      return {
        path: config.path,
        count: conn.getCount(),
      };
    },
  },
};
