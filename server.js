#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * Polyglot DB MCP Server - Dual Mode Entry Point
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

// Import all adapters
import * as surrealdb from "./adapters/surrealdb.js";
import * as dragonfly from "./adapters/dragonfly.js";
import * as xtdb from "./adapters/xtdb.js";
import * as sqlite from "./adapters/sqlite.js";
import * as duckdb from "./adapters/duckdb.js";
import * as qdrant from "./adapters/qdrant.js";
import * as meilisearch from "./adapters/meilisearch.js";
import * as mariadb from "./adapters/mariadb.js";
import * as memcached from "./adapters/memcached.js";
import * as lmdb from "./adapters/lmdb.js";
import * as itop from "./adapters/itop.js";
import * as postgresql from "./adapters/postgresql.js";
import * as mongodb from "./adapters/mongodb.js";
import * as neo4j from "./adapters/neo4j.js";
import * as elasticsearch from "./adapters/elasticsearch.js";
import * as influxdb from "./adapters/influxdb.js";
import * as arangodb from "./adapters/arangodb.js";
import * as virtuoso from "./adapters/virtuoso.js";
import * as couchdb from "./adapters/couchdb.js";
import * as cassandra from "./adapters/cassandra.js";

// Registry of all adapters
const adapters = {
  surrealdb,
  dragonfly,
  xtdb,
  sqlite,
  duckdb,
  qdrant,
  meilisearch,
  mariadb,
  memcached,
  lmdb,
  itop,
  postgresql,
  mongodb,
  neo4j,
  elasticsearch,
  influxdb,
  arangodb,
  virtuoso,
  couchdb,
  cassandra,
};

const PACKAGE_VERSION = "1.2.0";
const FEEDBACK_URL =
  "https://github.com/hyperpolymath/polyglot-db-mcp/issues";

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

      for (const [name, adapter] of Object.entries(adapters)) {
        const db = {
          name,
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
          ([name, tool]) => ({
            name,
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
      const summary = Object.entries(adapters).map(([name, adapter]) => ({
        name,
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

    for (const [name, adapter] of Object.entries(adapters)) {
      try {
        status[name] = await adapter.isConnected();
      } catch {
        status[name] = false;
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

  for (const [adapterName, adapter] of Object.entries(adapters)) {
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
                        "🐛 Found a bug? This is early development - your feedback helps!",
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
  // Deno Deploy sets DENO_DEPLOYMENT_ID
  // Also check for explicit HTTP mode flag
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

  // Create HTTP adapter that wraps the MCP server
  const httpAdapter = new McpHttpAdapter(server);

  // Register all handlers from the MCP server to the HTTP adapter
  // This bridges the MCP SDK server pattern to our HTTP transport

  // For the HTTP mode, we need to handle requests directly
  // The MCP SDK's McpServer has internal state we need to bridge

  const transport = new StreamableHttpTransport(null, { path: "/mcp" });

  transport.onMessage(async (message) => {
    // Forward to MCP server's internal handler
    // This requires accessing the server's private method
    if (server._handleRequest) {
      return await server._handleRequest(message);
    }

    // Fallback: handle common methods manually
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
      // Meta tools
      tools.push(
        { name: "db_list", description: "List all available databases" },
        { name: "db_help", description: "Get help for a database" },
        { name: "db_status", description: "Check database connection status" },
        { name: "db_copy", description: "Copy data between databases" }
      );
      // Adapter tools
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

      // Find and execute the tool
      // Check meta tools first
      if (name === "db_list" || name === "db_help" || name === "db_status") {
        // These are registered on the server but we need to handle them here
        // For simplicity, return an error suggesting to use the SDK transport
      }

      // Check adapter tools
      for (const [adapterName, adapter] of Object.entries(adapters)) {
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

  // Health check and info endpoint
  const handler = async (request) => {
    const url = new URL(request.url);

    // Health check
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

    // Server info
    if (url.pathname === "/" || url.pathname === "/info") {
      return new Response(
        JSON.stringify({
          name: "polyglot-db-mcp",
          version: PACKAGE_VERSION,
          protocol: "MCP Streamable HTTP",
          protocolVersion: "2025-06-18",
          endpoint: "/mcp",
          databases: Object.keys(adapters),
          documentation: "https://github.com/hyperpolymath/polyglot-db-mcp",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // MCP endpoint
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
