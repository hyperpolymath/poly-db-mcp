// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * Memcached Adapter
 * Distributed memory caching system
 */

import memjs from "npm:memjs@1";

let client = null;

const config = {
  servers: Deno.env.get("MEMCACHED_SERVERS") || "localhost:11211",
  username: Deno.env.get("MEMCACHED_USERNAME") || undefined,
  password: Deno.env.get("MEMCACHED_PASSWORD") || undefined,
};

export async function connect() {
  if (client) return client;
  client = memjs.Client.create(config.servers, {
    username: config.username,
    password: config.password,
  });
  return client;
}

export async function disconnect() {
  if (client) {
    client.close();
    client = null;
  }
}

export async function isConnected() {
  try {
    const conn = await connect();
    return new Promise((resolve) => {
      conn.stats((err, server, stats) => {
        resolve(!err && stats);
      });
    });
  } catch {
    return false;
  }
}

export const name = "memcached";
export const description = "Distributed memory caching system";

// Helper to promisify memjs callbacks
function promisify(client, method, ...args) {
  return new Promise((resolve, reject) => {
    client[method](...args, (err, result, flags) => {
      if (err) reject(err);
      else resolve({ result, flags });
    });
  });
}

export const tools = {
  memcached_get: {
    description: "Get a value by key",
    params: {
      key: { type: "string", description: "Key to get" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const { result } = await promisify(conn, "get", key);
      return {
        key,
        value: result ? result.toString() : null,
        found: result !== null,
      };
    },
  },

  memcached_set: {
    description: "Set a value",
    params: {
      key: { type: "string", description: "Key to set" },
      value: { type: "string", description: "Value to set" },
      ttl: { type: "number", description: "TTL in seconds (default 0 = no expiry)" },
    },
    handler: async ({ key, value, ttl = 0 }) => {
      const conn = await connect();
      await promisify(conn, "set", key, value, { expires: ttl });
      return { success: true, key, ttl };
    },
  },

  memcached_add: {
    description: "Add a value only if key doesn't exist",
    params: {
      key: { type: "string", description: "Key to add" },
      value: { type: "string", description: "Value to set" },
      ttl: { type: "number", description: "TTL in seconds (default 0)" },
    },
    handler: async ({ key, value, ttl = 0 }) => {
      const conn = await connect();
      try {
        await promisify(conn, "add", key, value, { expires: ttl });
        return { success: true, key };
      } catch (err) {
        return { success: false, error: "Key already exists" };
      }
    },
  },

  memcached_replace: {
    description: "Replace a value only if key exists",
    params: {
      key: { type: "string", description: "Key to replace" },
      value: { type: "string", description: "New value" },
      ttl: { type: "number", description: "TTL in seconds (default 0)" },
    },
    handler: async ({ key, value, ttl = 0 }) => {
      const conn = await connect();
      try {
        await promisify(conn, "replace", key, value, { expires: ttl });
        return { success: true, key };
      } catch (err) {
        return { success: false, error: "Key does not exist" };
      }
    },
  },

  memcached_delete: {
    description: "Delete a key",
    params: {
      key: { type: "string", description: "Key to delete" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      await promisify(conn, "delete", key);
      return { deleted: key };
    },
  },

  memcached_incr: {
    description: "Increment a numeric value",
    params: {
      key: { type: "string", description: "Key to increment" },
      amount: { type: "number", description: "Amount to increment (default 1)" },
    },
    handler: async ({ key, amount = 1 }) => {
      const conn = await connect();
      const { result } = await promisify(conn, "increment", key, amount);
      return { key, value: result ? parseInt(result.toString()) : null };
    },
  },

  memcached_decr: {
    description: "Decrement a numeric value",
    params: {
      key: { type: "string", description: "Key to decrement" },
      amount: { type: "number", description: "Amount to decrement (default 1)" },
    },
    handler: async ({ key, amount = 1 }) => {
      const conn = await connect();
      const { result } = await promisify(conn, "decrement", key, amount);
      return { key, value: result ? parseInt(result.toString()) : null };
    },
  },

  memcached_append: {
    description: "Append data to existing value",
    params: {
      key: { type: "string", description: "Key to append to" },
      value: { type: "string", description: "Value to append" },
    },
    handler: async ({ key, value }) => {
      const conn = await connect();
      await promisify(conn, "append", key, value);
      return { success: true, key };
    },
  },

  memcached_prepend: {
    description: "Prepend data to existing value",
    params: {
      key: { type: "string", description: "Key to prepend to" },
      value: { type: "string", description: "Value to prepend" },
    },
    handler: async ({ key, value }) => {
      const conn = await connect();
      await promisify(conn, "prepend", key, value);
      return { success: true, key };
    },
  },

  memcached_flush: {
    description: "Flush all keys from cache",
    params: {},
    handler: async () => {
      const conn = await connect();
      await promisify(conn, "flush");
      return { flushed: true };
    },
  },

  memcached_stats: {
    description: "Get server statistics",
    params: {},
    handler: async () => {
      const conn = await connect();
      return new Promise((resolve) => {
        conn.stats((err, server, stats) => {
          if (err) resolve({ error: err.message });
          else resolve({ server, stats });
        });
      });
    },
  },
};
