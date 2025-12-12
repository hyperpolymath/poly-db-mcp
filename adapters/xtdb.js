// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * XTDB Adapter
 * Bitemporal database with immutable history
 */

const config = {
  url: Deno.env.get("XTDB_URL") || "http://localhost:3000",
};

async function xtdbRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${config.url}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`XTDB error: ${response.status} ${await response.text()}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

export async function connect() {
  return true; // HTTP-based, no persistent connection
}

export async function disconnect() {
  return true;
}

export async function isConnected() {
  try {
    await xtdbRequest("/status");
    return true;
  } catch {
    return false;
  }
}

export const name = "xtdb";
export const description = "Bitemporal database with immutable history";

export const tools = {
  xtdb_status: {
    description: "Get XTDB server status",
    params: {},
    handler: async () => {
      const status = await xtdbRequest("/status");
      return { status };
    },
  },

  xtdb_query: {
    description: "Execute an XTQL or SQL query",
    params: {
      query: { type: "string", description: "XTQL or SQL query" },
      args: { type: "string", description: "Query arguments as JSON (optional)" },
    },
    handler: async ({ query, args }) => {
      const body = { query };
      if (args) {
        body.args = JSON.parse(args);
      }
      const result = await xtdbRequest("/query", "POST", body);
      return { results: result };
    },
  },

  xtdb_put: {
    description: "Put a document into XTDB",
    params: {
      table: { type: "string", description: "Table name" },
      id: { type: "string", description: "Document ID" },
      doc: { type: "string", description: "Document as JSON" },
      validFrom: { type: "string", description: "Valid-from time (ISO 8601, optional)" },
    },
    handler: async ({ table, id, doc, validFrom }) => {
      const document = JSON.parse(doc);
      document._id = id;

      const tx = {
        txOps: [
          {
            put: {
              table,
              doc: document,
              ...(validFrom && { validFrom }),
            },
          },
        ],
      };

      const result = await xtdbRequest("/tx", "POST", tx);
      return { transaction: result };
    },
  },

  xtdb_delete: {
    description: "Delete a document from XTDB",
    params: {
      table: { type: "string", description: "Table name" },
      id: { type: "string", description: "Document ID" },
      validFrom: { type: "string", description: "Valid-from time (ISO 8601, optional)" },
    },
    handler: async ({ table, id, validFrom }) => {
      const tx = {
        txOps: [
          {
            delete: {
              table,
              id,
              ...(validFrom && { validFrom }),
            },
          },
        ],
      };

      const result = await xtdbRequest("/tx", "POST", tx);
      return { transaction: result };
    },
  },

  xtdb_entity: {
    description: "Get an entity by ID",
    params: {
      table: { type: "string", description: "Table name" },
      id: { type: "string", description: "Document ID" },
      validTime: { type: "string", description: "Valid time to query at (ISO 8601, optional)" },
      txTime: { type: "string", description: "Transaction time to query at (ISO 8601, optional)" },
    },
    handler: async ({ table, id, validTime, txTime }) => {
      let query = `SELECT * FROM ${table} WHERE _id = '${id}'`;

      const body = { query };
      if (validTime) body.validTime = validTime;
      if (txTime) body.txTime = txTime;

      const result = await xtdbRequest("/query", "POST", body);
      return { entity: result[0] || null };
    },
  },

  xtdb_history: {
    description: "Get the history of an entity",
    params: {
      table: { type: "string", description: "Table name" },
      id: { type: "string", description: "Document ID" },
    },
    handler: async ({ table, id }) => {
      const query = `SELECT *, _valid_from, _valid_to, _system_from, _system_to
                     FROM ${table} FOR ALL VALID_TIME FOR ALL SYSTEM_TIME
                     WHERE _id = '${id}'`;

      const result = await xtdbRequest("/query", "POST", { query });
      return { history: result };
    },
  },

  xtdb_as_of: {
    description: "Query the database as of a specific point in time",
    params: {
      query: { type: "string", description: "SQL query" },
      validTime: { type: "string", description: "Valid time (ISO 8601)" },
      txTime: { type: "string", description: "Transaction time (ISO 8601, optional)" },
    },
    handler: async ({ query, validTime, txTime }) => {
      const body = { query, validTime };
      if (txTime) body.txTime = txTime;

      const result = await xtdbRequest("/query", "POST", body);
      return { results: result };
    },
  },

  xtdb_tx: {
    description: "Submit a transaction with multiple operations",
    params: {
      operations: { type: "string", description: "Transaction operations as JSON array" },
    },
    handler: async ({ operations }) => {
      const txOps = JSON.parse(operations);
      const result = await xtdbRequest("/tx", "POST", { txOps });
      return { transaction: result };
    },
  },

  xtdb_recent_txs: {
    description: "Get recent transactions",
    params: {
      limit: { type: "number", description: "Number of transactions (default 10)" },
    },
    handler: async ({ limit = 10 }) => {
      const result = await xtdbRequest(`/tx-log?limit=${limit}`);
      return { transactions: result };
    },
  },
};
