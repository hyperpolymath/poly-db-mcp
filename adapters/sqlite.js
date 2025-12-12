// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * SQLite Adapter (Deno version)
 * Embedded SQL database
 */

import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

let db = null;

const config = {
  path: Deno.env.get("SQLITE_PATH") || ":memory:",
};

export async function connect() {
  if (db) return db;
  db = new DB(config.path);
  return db;
}

export async function disconnect() {
  if (db) {
    db.close();
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

export const name = "sqlite";
export const description = "Embedded SQL database";

export const tools = {
  sqlite_query: {
    description: "Execute a SELECT query",
    params: {
      sql: { type: "string", description: "SQL SELECT query" },
      params: { type: "string", description: "Query parameters as JSON array (optional)" },
    },
    handler: async ({ sql, params }) => {
      const conn = await connect();
      const parameters = params ? JSON.parse(params) : [];
      const rows = [...conn.query(sql, parameters)].map((row) => {
        const columns = conn.columns(sql);
        const obj = {};
        columns.forEach((col, i) => {
          obj[col.name] = row[i];
        });
        return obj;
      });
      return { count: rows.length, rows };
    },
  },

  sqlite_exec: {
    description: "Execute a SQL statement (INSERT, UPDATE, DELETE, CREATE, etc.)",
    params: {
      sql: { type: "string", description: "SQL statement" },
      params: { type: "string", description: "Statement parameters as JSON array (optional)" },
    },
    handler: async ({ sql, params }) => {
      const conn = await connect();
      const parameters = params ? JSON.parse(params) : [];
      conn.query(sql, parameters);
      return {
        changes: conn.changes,
        lastInsertRowId: conn.lastInsertRowId?.toString(),
      };
    },
  },

  sqlite_tables: {
    description: "List all tables in the database",
    params: {},
    handler: async () => {
      const conn = await connect();
      const tables = [...conn.query(
        "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
      )].map(([name, sql]) => ({ name, sql }));
      return { tables };
    },
  },

  sqlite_schema: {
    description: "Get the schema of a table",
    params: {
      table: { type: "string", description: "Table name" },
    },
    handler: async ({ table }) => {
      const conn = await connect();
      const columns = [...conn.query(`PRAGMA table_info(${table})`)].map(
        ([cid, name, type, notnull, dflt_value, pk]) => ({
          cid,
          name,
          type,
          notnull: !!notnull,
          default: dflt_value,
          pk: !!pk,
        })
      );
      const indexes = [...conn.query(`PRAGMA index_list(${table})`)].map(
        ([seq, name, unique]) => ({ seq, name, unique: !!unique })
      );
      return { table, columns, indexes };
    },
  },

  sqlite_insert: {
    description: "Insert a row into a table",
    params: {
      table: { type: "string", description: "Table name" },
      data: { type: "string", description: "Row data as JSON object" },
    },
    handler: async ({ table, data }) => {
      const conn = await connect();
      const row = JSON.parse(data);
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = columns.map(() => "?").join(", ");

      const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
      conn.query(sql, values);

      return {
        inserted: true,
        lastInsertRowId: conn.lastInsertRowId?.toString(),
      };
    },
  },

  sqlite_update: {
    description: "Update rows in a table",
    params: {
      table: { type: "string", description: "Table name" },
      data: { type: "string", description: "Update data as JSON object" },
      where: { type: "string", description: "WHERE clause (without 'WHERE')" },
      whereParams: { type: "string", description: "WHERE parameters as JSON array (optional)" },
    },
    handler: async ({ table, data, where, whereParams }) => {
      const conn = await connect();
      const row = JSON.parse(data);
      const wParams = whereParams ? JSON.parse(whereParams) : [];

      const setClause = Object.keys(row)
        .map((k) => `${k} = ?`)
        .join(", ");
      const values = [...Object.values(row), ...wParams];

      const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
      conn.query(sql, values);

      return { changes: conn.changes };
    },
  },

  sqlite_delete: {
    description: "Delete rows from a table",
    params: {
      table: { type: "string", description: "Table name" },
      where: { type: "string", description: "WHERE clause (without 'WHERE')" },
      whereParams: { type: "string", description: "WHERE parameters as JSON array (optional)" },
    },
    handler: async ({ table, where, whereParams }) => {
      const conn = await connect();
      const params = whereParams ? JSON.parse(whereParams) : [];
      const sql = `DELETE FROM ${table} WHERE ${where}`;
      conn.query(sql, params);
      return { deleted: conn.changes };
    },
  },

  sqlite_transaction: {
    description: "Execute multiple statements in a transaction",
    params: {
      statements: { type: "string", description: "JSON array of {sql, params} objects" },
    },
    handler: async ({ statements }) => {
      const conn = await connect();
      const stmts = JSON.parse(statements);
      const results = [];

      conn.query("BEGIN TRANSACTION");
      try {
        for (const { sql, params = [] } of stmts) {
          if (sql.trim().toUpperCase().startsWith("SELECT")) {
            const rows = [...conn.query(sql, params)];
            results.push({ sql, rows });
          } else {
            conn.query(sql, params);
            results.push({ sql, changes: conn.changes });
          }
        }
        conn.query("COMMIT");
        return { success: true, results };
      } catch (error) {
        conn.query("ROLLBACK");
        throw error;
      }
    },
  },
};
