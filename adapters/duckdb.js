/**
 * DuckDB Adapter
 * Analytical SQL database - query CSV, Parquet, JSON files directly
 */

import * as duckdb from "npm:duckdb-async@1";

let db = null;

const config = {
  path: Deno.env.get("DUCKDB_PATH") || ":memory:",
};

export async function connect() {
  if (db) return db;
  db = await duckdb.Database.create(config.path);
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

export const name = "duckdb";
export const description = "Analytical database - query CSV, Parquet, JSON files directly";

export const tools = {
  duck_query: {
    description: "Execute a SQL query",
    params: {
      sql: { type: "string", description: "SQL query" },
    },
    handler: async ({ sql }) => {
      const conn = await connect();
      const rows = await conn.all(sql);
      return { count: rows.length, rows: rows.slice(0, 1000) };
    },
  },

  duck_exec: {
    description: "Execute a SQL statement (CREATE, INSERT, etc.)",
    params: {
      sql: { type: "string", description: "SQL statement" },
    },
    handler: async ({ sql }) => {
      const conn = await connect();
      await conn.exec(sql);
      return { success: true };
    },
  },

  duck_read_csv: {
    description: "Query a CSV file directly",
    params: {
      path: { type: "string", description: "Path to CSV file" },
      query: { type: "string", description: "SQL query using 'csv' as table name (optional)" },
      limit: { type: "number", description: "Limit rows (default 100)" },
    },
    handler: async ({ path, query, limit = 100 }) => {
      const conn = await connect();
      const sql = query
        ? query.replace(/\bcsv\b/gi, `read_csv_auto('${path}')`)
        : `SELECT * FROM read_csv_auto('${path}') LIMIT ${limit}`;
      const rows = await conn.all(sql);
      return { count: rows.length, rows };
    },
  },

  duck_read_parquet: {
    description: "Query a Parquet file directly",
    params: {
      path: { type: "string", description: "Path to Parquet file (can be local or S3)" },
      query: { type: "string", description: "SQL query using 'parquet' as table name (optional)" },
      limit: { type: "number", description: "Limit rows (default 100)" },
    },
    handler: async ({ path, query, limit = 100 }) => {
      const conn = await connect();
      const sql = query
        ? query.replace(/\bparquet\b/gi, `read_parquet('${path}')`)
        : `SELECT * FROM read_parquet('${path}') LIMIT ${limit}`;
      const rows = await conn.all(sql);
      return { count: rows.length, rows };
    },
  },

  duck_read_json: {
    description: "Query a JSON file directly",
    params: {
      path: { type: "string", description: "Path to JSON file" },
      query: { type: "string", description: "SQL query using 'json' as table name (optional)" },
      limit: { type: "number", description: "Limit rows (default 100)" },
    },
    handler: async ({ path, query, limit = 100 }) => {
      const conn = await connect();
      const sql = query
        ? query.replace(/\bjson\b/gi, `read_json_auto('${path}')`)
        : `SELECT * FROM read_json_auto('${path}') LIMIT ${limit}`;
      const rows = await conn.all(sql);
      return { count: rows.length, rows };
    },
  },

  duck_export_parquet: {
    description: "Export query results to Parquet file",
    params: {
      sql: { type: "string", description: "SQL query to export" },
      path: { type: "string", description: "Output Parquet file path" },
    },
    handler: async ({ sql, path }) => {
      const conn = await connect();
      await conn.exec(`COPY (${sql}) TO '${path}' (FORMAT PARQUET)`);
      return { exported_to: path };
    },
  },

  duck_export_csv: {
    description: "Export query results to CSV file",
    params: {
      sql: { type: "string", description: "SQL query to export" },
      path: { type: "string", description: "Output CSV file path" },
    },
    handler: async ({ sql, path }) => {
      const conn = await connect();
      await conn.exec(`COPY (${sql}) TO '${path}' (FORMAT CSV, HEADER)`);
      return { exported_to: path };
    },
  },

  duck_tables: {
    description: "List all tables",
    params: {},
    handler: async () => {
      const conn = await connect();
      const tables = await conn.all("SHOW TABLES");
      return { tables };
    },
  },

  duck_describe: {
    description: "Describe a table or query result structure",
    params: {
      target: { type: "string", description: "Table name or SQL query" },
    },
    handler: async ({ target }) => {
      const conn = await connect();
      const sql = target.toUpperCase().includes("SELECT")
        ? `DESCRIBE (${target})`
        : `DESCRIBE ${target}`;
      const columns = await conn.all(sql);
      return { columns };
    },
  },

  duck_summarize: {
    description: "Get statistical summary of a table or query",
    params: {
      target: { type: "string", description: "Table name or SQL query" },
    },
    handler: async ({ target }) => {
      const conn = await connect();
      const sql = target.toUpperCase().includes("SELECT")
        ? `SUMMARIZE (${target})`
        : `SUMMARIZE ${target}`;
      const summary = await conn.all(sql);
      return { summary };
    },
  },

  duck_import_csv: {
    description: "Import CSV file into a table",
    params: {
      path: { type: "string", description: "Path to CSV file" },
      table: { type: "string", description: "Target table name" },
    },
    handler: async ({ path, table }) => {
      const conn = await connect();
      await conn.exec(`CREATE TABLE ${table} AS SELECT * FROM read_csv_auto('${path}')`);
      const count = await conn.all(`SELECT COUNT(*) as count FROM ${table}`);
      return { table, rows_imported: count[0].count };
    },
  },
};
