#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * Polyglot DB MCP Server - Dual Mode Entry Point
 * ReScript-based implementation with minimal JS shim
 *
 * Supports both:
 * - STDIO transport (default, for local MCP clients)
 * - Streamable HTTP transport (for remote/cloud deployment)
 *
 * Usage:
 *   Local:  deno task start
 *   HTTP:   deno task serve
 *   Deploy: deno deploy (auto-detects HTTP mode)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  StreamableHttpTransport,
  McpHttpAdapter,
} from "./transport/streamable-http.js";

// Import all ReScript-compiled adapters
import * as Postgresql from "./lib/es6/src/adapters/Postgresql.res.js";
import * as Sqlite from "./lib/es6/src/adapters/Sqlite.res.js";
import * as Mongodb from "./lib/es6/src/adapters/Mongodb.res.js";
import * as Elasticsearch from "./lib/es6/src/adapters/Elasticsearch.res.js";
import * as Dragonfly from "./lib/es6/src/adapters/Dragonfly.res.js";
import * as Xtdb from "./lib/es6/src/adapters/Xtdb.res.js";
import * as Lmdb from "./lib/es6/src/adapters/Lmdb.res.js";
import * as Couchdb from "./lib/es6/src/adapters/Couchdb.res.js";
import * as Itop from "./lib/es6/src/adapters/Itop.res.js";
import * as Duckdb from "./lib/es6/src/adapters/Duckdb.res.js";
import * as Virtuoso from "./lib/es6/src/adapters/Virtuoso.res.js";
import * as Influxdb from "./lib/es6/src/adapters/Influxdb.res.js";
import * as Surrealdb from "./lib/es6/src/adapters/Surrealdb.res.js";
import * as Arangodb from "./lib/es6/src/adapters/Arangodb.res.js";
import * as Meilisearch from "./lib/es6/src/adapters/Meilisearch.res.js";
import * as Qdrant from "./lib/es6/src/adapters/Qdrant.res.js";
import * as Mariadb from "./lib/es6/src/adapters/Mariadb.res.js";
import * as Neo4j from "./lib/es6/src/adapters/Neo4j.res.js";
import * as Cassandra from "./lib/es6/src/adapters/Cassandra.res.js";
import * as Memcached from "./lib/es6/src/adapters/Memcached.res.js";

// Registry of all adapters (using ReScript module exports)
const adapters = {
  postgresql: Postgresql,
  sqlite: Sqlite,
  mongodb: Mongodb,
  elasticsearch: Elasticsearch,
  dragonfly: Dragonfly,
  xtdb: Xtdb,
  lmdb: Lmdb,
  couchdb: Couchdb,
  itop: Itop,
  duckdb: Duckdb,
  virtuoso: Virtuoso,
  influxdb: Influxdb,
  surrealdb: Surrealdb,
  arangodb: Arangodb,
  meilisearch: Meilisearch,
  qdrant: Qdrant,
  mariadb: Mariadb,
  neo4j: Neo4j,
  cassandra: Cassandra,
  memcached: Memcached,
};

const PACKAGE_VERSION = "2.0.0";
const FEEDBACK_URL =
  "https://github.com/hyperpolymath/poly-db-mcp/issues";

/**
 * Create and configure the MCP server with all tools
 */
function createMcpServer() {
  const server = new McpServer({
    name: "polyglot-db-mcp",
    version: PACKAGE_VERSION,
  });

  // =============================================================================
  // UNIFIED TOOLS - Work across all databases
  // =============================================================================

  server.tool(
    "db_list",
    {
      checkConnections: {
        type: "boolean",
        description: "Check which databases are actually connected (slower)",
      },
    },
    async ({ checkConnections = false }) => {
      const databases = [];

      for (const [adapterKey, adapter] of Object.entries(adapters)) {
        const db = {
          name: adapter.name || adapterKey,
          description: adapter.description,
          tools: Object.keys(adapter.tools || {}),
        };

        if (checkConnections) {
          try {
            db.connected = await adapter.isConnected();
          } catch {
            db.connected = false;
          }
        }

        databases.push(db);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { databases, total: databases.length },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "db_help",
    {
      database: {
        type: "string",
        description:
          "Database name to get help for (optional, shows all if omitted)",
      },
    },
    async ({ database }) => {
      if (database) {
        const adapter = adapters[database];
        if (!adapter) {
          return {
            content: [
              {
                type: "text",
                text: `Unknown database: ${database}. Use db_list to see available databases.`,
              },
            ],
          };
        }

        const tools = Object.entries(adapter.tools || {}).map(
          ([toolName, tool]) => ({
            name: toolName,
            description: tool.description,
            params: Object.entries(tool.params || {}).map(([pname, pdef]) => ({
              name: pname,
              ...pdef,
            })),
          })
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  database,
                  description: adapter.description,
                  tools,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Show summary of all databases
      const summary = Object.entries(adapters).map(([key, adapter]) => ({
        name: adapter.name || key,
        description: adapter.description,
        toolCount: Object.keys(adapter.tools || {}).length,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ databases: summary }, null, 2),
          },
        ],
      };
    }
  );

  server.tool("db_status", {}, async () => {
    const status = {};

    for (const [key, adapter] of Object.entries(adapters)) {
      try {
        status[adapter.name || key] = await adapter.isConnected();
      } catch {
        status[adapter.name || key] = false;
      }
    }

    const connected = Object.entries(status)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const disconnected = Object.entries(status)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              connected,
              disconnected,
              summary: `${connected.length}/${Object.keys(status).length} databases connected`,
            },
            null,
            2
          ),
        },
      ],
    };
  });

  // =============================================================================
  // REGISTER ALL ADAPTER TOOLS
  // =============================================================================

  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    const adapterName = adapter.name || adapterKey;
    for (const [toolName, toolDef] of Object.entries(adapter.tools || {})) {
      const params = {};
      for (const [paramName, paramDef] of Object.entries(
        toolDef.params || {}
      )) {
        params[paramName] = paramDef;
      }

      server.tool(toolName, params, async (args) => {
        try {
          const result = await toolDef.handler(args);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const feedbackUrl = `${FEEDBACK_URL}/new?title=${encodeURIComponent(`[BUG] ${toolName}: ${error.message.substring(0, 50)}`)}&labels=bug`;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: error.message,
                    tool: toolName,
                    adapter: adapterName,
                    feedback: {
                      message:
                        "Found a bug? Your feedback helps!",
                      reportUrl: feedbackUrl,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      });
    }
  }

  // =============================================================================
  // CROSS-DATABASE TOOLS
  // =============================================================================

  server.tool(
    "db_copy",
    {
      from_db: { type: "string", description: "Source database name" },
      from_query: {
        type: "string",
        description: "Query to get source data (db-specific)",
      },
      to_db: { type: "string", description: "Target database name" },
      to_target: {
        type: "string",
        description: "Target location (table/collection/key prefix)",
      },
      transform: {
        type: "string",
        description: "JS transform function as string (optional)",
      },
    },
    async ({ from_db, from_query, to_db, to_target, transform }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message:
                  "Cross-database copy requires specific implementation per DB pair",
                hint: "Use the individual query and insert tools for now",
                from: from_db,
                to: to_db,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Detect if running in Deno Deploy or similar serverless environment
 */
function isServerlessEnvironment() {
  return (
    Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined ||
    Deno.env.get("MCP_HTTP_MODE") === "true" ||
    Deno.args.includes("--http")
  );
}

/**
 * Start the server in STDIO mode (local MCP client)
 */
async function startStdioMode(server) {
  console.error(`polyglot-db-mcp v${PACKAGE_VERSION} (STDIO mode)`);
  console.error(`${Object.keys(adapters).length} database adapters available`);
  console.error(`Feedback: ${FEEDBACK_URL}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Start the server in HTTP mode (remote/cloud)
 */
async function startHttpMode(server) {
  const port = parseInt(Deno.env.get("PORT") || "8000");
  const host = Deno.env.get("HOST") || "0.0.0.0";

  console.error(`polyglot-db-mcp v${PACKAGE_VERSION} (HTTP mode)`);
  console.error(`${Object.keys(adapters).length} database adapters available`);
  console.error(`Listening on http://${host}:${port}/mcp`);
  console.error(`Feedback: ${FEEDBACK_URL}`);

  const httpAdapter = new McpHttpAdapter(server);
  const transport = new StreamableHttpTransport(null, { path: "/mcp" });

  transport.onMessage(async (message) => {
    if (server._handleRequest) {
      return await server._handleRequest(message);
    }

    if (message.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: { listChanged: true },
          },
          serverInfo: {
            name: "polyglot-db-mcp",
            version: PACKAGE_VERSION,
          },
        },
      };
    }

    if (message.method === "tools/list") {
      const tools = [];
      tools.push(
        { name: "db_list", description: "List all available databases" },
        { name: "db_help", description: "Get help for a database" },
        { name: "db_status", description: "Check database connection status" },
        { name: "db_copy", description: "Copy data between databases" }
      );
      for (const [, adapter] of Object.entries(adapters)) {
        for (const [toolName, toolDef] of Object.entries(
          adapter.tools || {}
        )) {
          tools.push({
            name: toolName,
            description: toolDef.description,
            inputSchema: {
              type: "object",
              properties: toolDef.params || {},
            },
          });
        }
      }
      return {
        jsonrpc: "2.0",
        id: message.id,
        result: { tools },
      };
    }

    if (message.method === "tools/call") {
      const { name, arguments: args } = message.params;

      for (const [adapterKey, adapter] of Object.entries(adapters)) {
        if (adapter.tools && adapter.tools[name]) {
          try {
            const result = await adapter.tools[name].handler(args || {});
            return {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              },
            };
          } catch (error) {
            return {
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: error.message,
              },
            };
          }
        }
      }

      return {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32601,
          message: `Tool not found: ${name}`,
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32601,
        message: `Method not found: ${message.method}`,
      },
    };
  });

  const handler = async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          version: PACKAGE_VERSION,
          databases: Object.keys(adapters).length,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname === "/" || url.pathname === "/info") {
      return new Response(
        JSON.stringify({
          name: "polyglot-db-mcp",
          version: PACKAGE_VERSION,
          protocol: "MCP Streamable HTTP",
          protocolVersion: "2025-06-18",
          endpoint: "/mcp",
          databases: Object.keys(adapters),
          documentation: "https://github.com/hyperpolymath/poly-db-mcp",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return transport.handleRequest(request);
  };

  Deno.serve({ port, hostname: host }, handler);
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

const server = createMcpServer();

if (isServerlessEnvironment()) {
  await startHttpMode(server);
} else {
  await startStdioMode(server);
}
