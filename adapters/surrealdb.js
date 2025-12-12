/**
 * SurrealDB Adapter
 * Multi-model database: document, graph, relational
 */

import Surreal from "npm:surrealdb@1";

let db = null;

const config = {
  url: Deno.env.get("SURREAL_URL") || "http://localhost:8000",
  namespace: Deno.env.get("SURREAL_NAMESPACE") || "test",
  database: Deno.env.get("SURREAL_DATABASE") || "test",
  username: Deno.env.get("SURREAL_USERNAME") || "root",
  password: Deno.env.get("SURREAL_PASSWORD") || "root",
};

export async function connect() {
  if (db) return db;

  db = new Surreal();
  await db.connect(config.url);
  await db.signin({
    username: config.username,
    password: config.password,
  });
  await db.use({
    namespace: config.namespace,
    database: config.database,
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

export const name = "surrealdb";
export const description = "Multi-model database (document, graph, relational)";

export const tools = {
  surreal_query: {
    description: "Execute a SurrealQL query",
    params: {
      query: { type: "string", description: "SurrealQL query to execute" },
      vars: { type: "string", description: "Variables as JSON object (optional)" },
    },
    handler: async ({ query, vars }) => {
      const conn = await connect();
      const variables = vars ? JSON.parse(vars) : undefined;
      const result = await conn.query(query, variables);
      return { results: result };
    },
  },

  surreal_select: {
    description: "Select all records from a table",
    params: {
      table: { type: "string", description: "Table name" },
    },
    handler: async ({ table }) => {
      const conn = await connect();
      const result = await conn.select(table);
      return { count: result.length, records: result };
    },
  },

  surreal_create: {
    description: "Create a new record",
    params: {
      table: { type: "string", description: "Table name" },
      data: { type: "string", description: "Record data as JSON" },
      id: { type: "string", description: "Optional record ID" },
    },
    handler: async ({ table, data, id }) => {
      const conn = await connect();
      const record = JSON.parse(data);
      const thing = id ? `${table}:${id}` : table;
      const result = await conn.create(thing, record);
      return { created: result };
    },
  },

  surreal_update: {
    description: "Update a record (replace entirely)",
    params: {
      table: { type: "string", description: "Table name" },
      id: { type: "string", description: "Record ID" },
      data: { type: "string", description: "New record data as JSON" },
    },
    handler: async ({ table, id, data }) => {
      const conn = await connect();
      const record = JSON.parse(data);
      const result = await conn.update(`${table}:${id}`, record);
      return { updated: result };
    },
  },

  surreal_merge: {
    description: "Merge data into a record (partial update)",
    params: {
      table: { type: "string", description: "Table name" },
      id: { type: "string", description: "Record ID" },
      data: { type: "string", description: "Data to merge as JSON" },
    },
    handler: async ({ table, id, data }) => {
      const conn = await connect();
      const record = JSON.parse(data);
      const result = await conn.merge(`${table}:${id}`, record);
      return { merged: result };
    },
  },

  surreal_delete: {
    description: "Delete a record or all records from a table",
    params: {
      table: { type: "string", description: "Table name" },
      id: { type: "string", description: "Record ID (optional, deletes all if omitted)" },
    },
    handler: async ({ table, id }) => {
      const conn = await connect();
      const thing = id ? `${table}:${id}` : table;
      const result = await conn.delete(thing);
      return { deleted: result };
    },
  },

  surreal_relate: {
    description: "Create a graph relation between two records",
    params: {
      from: { type: "string", description: "Source record (table:id)" },
      relation: { type: "string", description: "Relation table name" },
      to: { type: "string", description: "Target record (table:id)" },
      data: { type: "string", description: "Optional relation data as JSON" },
    },
    handler: async ({ from, relation, to, data }) => {
      const conn = await connect();
      const relData = data ? JSON.parse(data) : {};
      const query = `RELATE ${from}->${relation}->${to} CONTENT $data`;
      const result = await conn.query(query, { data: relData });
      return { relation: result };
    },
  },

  surreal_graph_traverse: {
    description: "Traverse graph relations",
    params: {
      start: { type: "string", description: "Starting record (table:id)" },
      direction: { type: "string", description: "Direction: 'out', 'in', or 'both'" },
      relation: { type: "string", description: "Relation type to traverse" },
      depth: { type: "number", description: "Max traversal depth (default 1)" },
    },
    handler: async ({ start, direction, relation, depth = 1 }) => {
      const conn = await connect();
      const arrow = direction === "in" ? "<-" : direction === "both" ? "<->" : "->";
      const query = `SELECT * FROM ${start}${arrow}${relation}(${depth}..${depth})`;
      const result = await conn.query(query);
      return { paths: result };
    },
  },

  surreal_info: {
    description: "Get database info (tables, schema)",
    params: {},
    handler: async () => {
      const conn = await connect();
      const [dbInfo] = await conn.query("INFO FOR DB");
      return { info: dbInfo };
    },
  },

  surreal_live: {
    description: "Get live query info (for real-time subscriptions)",
    params: {
      table: { type: "string", description: "Table to describe" },
    },
    handler: async ({ table }) => {
      const conn = await connect();
      const [info] = await conn.query(`INFO FOR TABLE ${table}`);
      return { tableInfo: info };
    },
  },
};
