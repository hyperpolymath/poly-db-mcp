/**
 * DuckDB Adapter (Stub)
 * Note: DuckDB native module requires compiled binaries.
 * Use duckdb CLI or HTTP API for Deno compatibility.
 *
 * Alternative: Run `duckdb -httpd` for HTTP interface
 */

const config = {
  httpUrl: Deno.env.get("DUCKDB_HTTP_URL") || null,
};

let available = false;

async function httpQuery(sql) {
  if (!config.httpUrl) {
    throw new Error(
      "DuckDB not available. Set DUCKDB_HTTP_URL or use duckdb CLI directly."
    );
  }
  const response = await fetch(`${config.httpUrl}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) {
    throw new Error(`DuckDB HTTP error: ${response.status}`);
  }
  return await response.json();
}

export async function connect() {
  if (config.httpUrl) {
    try {
      await httpQuery("SELECT 1");
      available = true;
    } catch {
      available = false;
    }
  }
  return available;
}

export async function disconnect() {
  return true;
}

export async function isConnected() {
  if (!config.httpUrl) return false;
  try {
    await httpQuery("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export const name = "duckdb";
export const description =
  "Analytical database (requires DUCKDB_HTTP_URL or duckdb CLI)";

export const tools = {
  duck_query: {
    description: "Execute a SQL query",
    params: {
      sql: { type: "string", description: "SQL query" },
    },
    handler: async ({ sql }) => {
      if (!config.httpUrl) {
        return {
          error: "DuckDB not configured",
          hint: "Set DUCKDB_HTTP_URL to use DuckDB HTTP API, or run: duckdb -httpd localhost:4321",
        };
      }
      const result = await httpQuery(sql);
      return { rows: result };
    },
  },

  duck_read_csv: {
    description: "Query a CSV file directly",
    params: {
      path: { type: "string", description: "Path to CSV file" },
      limit: { type: "number", description: "Limit rows (default 100)" },
    },
    handler: async ({ path, limit = 100 }) => {
      if (!config.httpUrl) {
        return {
          error: "DuckDB not configured",
          hint: "Use duckdb CLI: duckdb -c \"SELECT * FROM '${path}' LIMIT ${limit}\"",
        };
      }
      const sql = `SELECT * FROM read_csv_auto('${path}') LIMIT ${limit}`;
      const result = await httpQuery(sql);
      return { rows: result };
    },
  },

  duck_read_parquet: {
    description: "Query a Parquet file directly",
    params: {
      path: { type: "string", description: "Path to Parquet file" },
      limit: { type: "number", description: "Limit rows (default 100)" },
    },
    handler: async ({ path, limit = 100 }) => {
      if (!config.httpUrl) {
        return {
          error: "DuckDB not configured",
          hint: "Use duckdb CLI: duckdb -c \"SELECT * FROM '${path}' LIMIT ${limit}\"",
        };
      }
      const sql = `SELECT * FROM read_parquet('${path}') LIMIT ${limit}`;
      const result = await httpQuery(sql);
      return { rows: result };
    },
  },

  duck_tables: {
    description: "List all tables",
    params: {},
    handler: async () => {
      if (!config.httpUrl) {
        return {
          error: "DuckDB not configured",
          hint: "Set DUCKDB_HTTP_URL or use duckdb CLI",
        };
      }
      const result = await httpQuery("SHOW TABLES");
      return { tables: result };
    },
  },
};
