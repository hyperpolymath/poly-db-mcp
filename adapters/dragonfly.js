// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * Dragonfly/Redis Adapter
 * Redis-compatible in-memory data store
 */

import Redis from "npm:ioredis@5";

let client = null;

const config = {
  host: Deno.env.get("DRAGONFLY_HOST") || Deno.env.get("REDIS_HOST") || "localhost",
  port: parseInt(Deno.env.get("DRAGONFLY_PORT") || Deno.env.get("REDIS_PORT") || "6379"),
  password: Deno.env.get("DRAGONFLY_PASSWORD") || Deno.env.get("REDIS_PASSWORD") || undefined,
  db: parseInt(Deno.env.get("DRAGONFLY_DB") || Deno.env.get("REDIS_DB") || "0"),
};

export async function connect() {
  if (client) return client;
  client = new Redis(config);
  return client;
}

export async function disconnect() {
  if (client) {
    await client.quit();
    client = null;
  }
}

export async function isConnected() {
  try {
    const conn = await connect();
    await conn.ping();
    return true;
  } catch {
    return false;
  }
}

export const name = "dragonfly";
export const description = "Redis-compatible in-memory data store (works with Redis too)";

export const tools = {
  redis_get: {
    description: "Get a string value by key",
    params: {
      key: { type: "string", description: "Key to get" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const value = await conn.get(key);
      return { key, value };
    },
  },

  redis_set: {
    description: "Set a string value",
    params: {
      key: { type: "string", description: "Key to set" },
      value: { type: "string", description: "Value to set" },
      ttl: { type: "number", description: "TTL in seconds (optional)" },
    },
    handler: async ({ key, value, ttl }) => {
      const conn = await connect();
      if (ttl) {
        await conn.setex(key, ttl, value);
      } else {
        await conn.set(key, value);
      }
      return { success: true, key };
    },
  },

  redis_del: {
    description: "Delete one or more keys",
    params: {
      keys: { type: "string", description: "Comma-separated keys to delete" },
    },
    handler: async ({ keys }) => {
      const conn = await connect();
      const keyList = keys.split(",").map((k) => k.trim());
      const deleted = await conn.del(...keyList);
      return { deleted };
    },
  },

  redis_keys: {
    description: "Find keys matching a pattern",
    params: {
      pattern: { type: "string", description: "Pattern (e.g., 'user:*')" },
    },
    handler: async ({ pattern }) => {
      const conn = await connect();
      const keys = await conn.keys(pattern);
      return { count: keys.length, keys };
    },
  },

  redis_hget: {
    description: "Get a hash field value",
    params: {
      key: { type: "string", description: "Hash key" },
      field: { type: "string", description: "Field name" },
    },
    handler: async ({ key, field }) => {
      const conn = await connect();
      const value = await conn.hget(key, field);
      return { key, field, value };
    },
  },

  redis_hgetall: {
    description: "Get all fields and values in a hash",
    params: {
      key: { type: "string", description: "Hash key" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const data = await conn.hgetall(key);
      return { key, data };
    },
  },

  redis_hset: {
    description: "Set hash field(s)",
    params: {
      key: { type: "string", description: "Hash key" },
      fields: { type: "string", description: "Fields as JSON object" },
    },
    handler: async ({ key, fields }) => {
      const conn = await connect();
      const data = JSON.parse(fields);
      await conn.hset(key, data);
      return { success: true, key };
    },
  },

  redis_lpush: {
    description: "Push values to the left of a list",
    params: {
      key: { type: "string", description: "List key" },
      values: { type: "string", description: "Comma-separated values" },
    },
    handler: async ({ key, values }) => {
      const conn = await connect();
      const items = values.split(",").map((v) => v.trim());
      const length = await conn.lpush(key, ...items);
      return { key, length };
    },
  },

  redis_lrange: {
    description: "Get a range of elements from a list",
    params: {
      key: { type: "string", description: "List key" },
      start: { type: "number", description: "Start index (default 0)" },
      stop: { type: "number", description: "Stop index (default -1 for all)" },
    },
    handler: async ({ key, start = 0, stop = -1 }) => {
      const conn = await connect();
      const items = await conn.lrange(key, start, stop);
      return { key, items };
    },
  },

  redis_sadd: {
    description: "Add members to a set",
    params: {
      key: { type: "string", description: "Set key" },
      members: { type: "string", description: "Comma-separated members" },
    },
    handler: async ({ key, members }) => {
      const conn = await connect();
      const items = members.split(",").map((m) => m.trim());
      const added = await conn.sadd(key, ...items);
      return { key, added };
    },
  },

  redis_smembers: {
    description: "Get all members of a set",
    params: {
      key: { type: "string", description: "Set key" },
    },
    handler: async ({ key }) => {
      const conn = await connect();
      const members = await conn.smembers(key);
      return { key, members };
    },
  },

  redis_zadd: {
    description: "Add members to a sorted set",
    params: {
      key: { type: "string", description: "Sorted set key" },
      members: { type: "string", description: "JSON array of {score, value} objects" },
    },
    handler: async ({ key, members }) => {
      const conn = await connect();
      const items = JSON.parse(members);
      const args = items.flatMap((m) => [m.score, m.value]);
      const added = await conn.zadd(key, ...args);
      return { key, added };
    },
  },

  redis_zrange: {
    description: "Get range from sorted set by index",
    params: {
      key: { type: "string", description: "Sorted set key" },
      start: { type: "number", description: "Start index" },
      stop: { type: "number", description: "Stop index" },
      withScores: { type: "boolean", description: "Include scores" },
    },
    handler: async ({ key, start = 0, stop = -1, withScores = false }) => {
      const conn = await connect();
      const result = withScores
        ? await conn.zrange(key, start, stop, "WITHSCORES")
        : await conn.zrange(key, start, stop);
      return { key, result };
    },
  },

  redis_info: {
    description: "Get server info",
    params: {
      section: { type: "string", description: "Info section (optional)" },
    },
    handler: async ({ section }) => {
      const conn = await connect();
      const info = section ? await conn.info(section) : await conn.info();
      return { info };
    },
  },

  redis_dbsize: {
    description: "Get the number of keys in the database",
    params: {},
    handler: async () => {
      const conn = await connect();
      const size = await conn.dbsize();
      return { keys: size };
    },
  },
};
