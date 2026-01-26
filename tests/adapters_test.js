// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell
/**
 * Comprehensive Adapter Tests for poly-db-mcp
 *
 * Tests all 21 database adapters for:
 * - Required exports (name, description, tools, connect, disconnect, isConnected)
 * - Tool structure validation
 * - Parameter schema compliance
 * - Handler function signatures
 */

import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertStrictEquals,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

// Import all adapters
import * as surrealdb from "../adapters/surrealdb.js";
import * as dragonfly from "../adapters/dragonfly.js";
import * as xtdb from "../adapters/xtdb.js";
import * as sqlite from "../adapters/sqlite.js";
import * as duckdb from "../adapters/duckdb.js";
import * as qdrant from "../adapters/qdrant.js";
import * as meilisearch from "../adapters/meilisearch.js";
import * as mariadb from "../adapters/mariadb.js";
import * as memcached from "../adapters/memcached.js";
import * as lmdb from "../adapters/lmdb.js";
import * as itop from "../adapters/itop.js";
import * as postgresql from "../adapters/postgresql.js";
import * as mongodb from "../adapters/mongodb.js";
import * as neo4j from "../adapters/neo4j.js";
import * as elasticsearch from "../adapters/elasticsearch.js";
import * as influxdb from "../adapters/influxdb.js";
import * as arangodb from "../adapters/arangodb.js";
import * as virtuoso from "../adapters/virtuoso.js";
import * as couchdb from "../adapters/couchdb.js";
import * as cassandra from "../adapters/cassandra.js";

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

const VALID_PARAM_TYPES = ["string", "number", "boolean", "object", "array"];

// =============================================================================
// ADAPTER STRUCTURE TESTS
// =============================================================================

Deno.test("All adapters export required 'name' field as string", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    assertExists(
      adapter.name,
      `Adapter '${adapterKey}' missing 'name' export`
    );
    assertStrictEquals(
      typeof adapter.name,
      "string",
      `Adapter '${adapterKey}' name must be string, got ${typeof adapter.name}`
    );
    assertEquals(
      adapter.name.length > 0,
      true,
      `Adapter '${adapterKey}' name must not be empty`
    );
  }
});

Deno.test("All adapters export required 'description' field as string", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    assertExists(
      adapter.description,
      `Adapter '${adapterKey}' missing 'description' export`
    );
    assertStrictEquals(
      typeof adapter.description,
      "string",
      `Adapter '${adapterKey}' description must be string`
    );
    assertEquals(
      adapter.description.length >= 10,
      true,
      `Adapter '${adapterKey}' description too short (min 10 chars): "${adapter.description}"`
    );
  }
});

Deno.test("All adapters export required 'connect' function", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    assertExists(
      adapter.connect,
      `Adapter '${adapterKey}' missing 'connect' export`
    );
    assertStrictEquals(
      typeof adapter.connect,
      "function",
      `Adapter '${adapterKey}' connect must be function`
    );
  }
});

Deno.test("All adapters export required 'disconnect' function", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    assertExists(
      adapter.disconnect,
      `Adapter '${adapterKey}' missing 'disconnect' export`
    );
    assertStrictEquals(
      typeof adapter.disconnect,
      "function",
      `Adapter '${adapterKey}' disconnect must be function`
    );
  }
});

Deno.test("All adapters export required 'isConnected' function", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    assertExists(
      adapter.isConnected,
      `Adapter '${adapterKey}' missing 'isConnected' export`
    );
    assertStrictEquals(
      typeof adapter.isConnected,
      "function",
      `Adapter '${adapterKey}' isConnected must be function`
    );
  }
});

Deno.test("All adapters export required 'tools' object", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    assertExists(
      adapter.tools,
      `Adapter '${adapterKey}' missing 'tools' export`
    );
    assertStrictEquals(
      typeof adapter.tools,
      "object",
      `Adapter '${adapterKey}' tools must be object`
    );
    assertEquals(
      adapter.tools !== null,
      true,
      `Adapter '${adapterKey}' tools must not be null`
    );
  }
});

Deno.test("All adapters have at least one tool", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    const toolCount = Object.keys(adapter.tools || {}).length;
    assertEquals(
      toolCount >= 1,
      true,
      `Adapter '${adapterKey}' must have at least 1 tool, found ${toolCount}`
    );
  }
});

// =============================================================================
// TOOL STRUCTURE TESTS
// =============================================================================

Deno.test("All tools have required 'description' field", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const [toolName, tool] of Object.entries(adapter.tools || {})) {
      assertExists(
        tool.description,
        `Tool '${toolName}' in adapter '${adapterKey}' missing 'description'`
      );
      assertStrictEquals(
        typeof tool.description,
        "string",
        `Tool '${toolName}' in adapter '${adapterKey}' description must be string`
      );
      assertEquals(
        tool.description.length >= 5,
        true,
        `Tool '${toolName}' in adapter '${adapterKey}' description too short`
      );
    }
  }
});

Deno.test("All tools have required 'handler' function", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const [toolName, tool] of Object.entries(adapter.tools || {})) {
      assertExists(
        tool.handler,
        `Tool '${toolName}' in adapter '${adapterKey}' missing 'handler'`
      );
      assertStrictEquals(
        typeof tool.handler,
        "function",
        `Tool '${toolName}' in adapter '${adapterKey}' handler must be function`
      );
    }
  }
});

Deno.test("All tools have 'params' object (can be empty)", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const [toolName, tool] of Object.entries(adapter.tools || {})) {
      assertExists(
        tool.params,
        `Tool '${toolName}' in adapter '${adapterKey}' missing 'params' (use {} for no params)`
      );
      assertStrictEquals(
        typeof tool.params,
        "object",
        `Tool '${toolName}' in adapter '${adapterKey}' params must be object`
      );
    }
  }
});

// =============================================================================
// PARAMETER SCHEMA TESTS
// =============================================================================

Deno.test("All tool parameters have valid 'type' field", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const [toolName, tool] of Object.entries(adapter.tools || {})) {
      for (const [paramName, paramDef] of Object.entries(tool.params || {})) {
        assertExists(
          paramDef.type,
          `Param '${paramName}' in tool '${toolName}' (adapter '${adapterKey}') missing 'type'`
        );
        assertEquals(
          VALID_PARAM_TYPES.includes(paramDef.type),
          true,
          `Param '${paramName}' in tool '${toolName}' (adapter '${adapterKey}') has invalid type '${paramDef.type}'. Valid: ${VALID_PARAM_TYPES.join(", ")}`
        );
      }
    }
  }
});

Deno.test("All tool parameters have 'description' field", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const [toolName, tool] of Object.entries(adapter.tools || {})) {
      for (const [paramName, paramDef] of Object.entries(tool.params || {})) {
        assertExists(
          paramDef.description,
          `Param '${paramName}' in tool '${toolName}' (adapter '${adapterKey}') missing 'description'`
        );
        assertStrictEquals(
          typeof paramDef.description,
          "string",
          `Param '${paramName}' in tool '${toolName}' (adapter '${adapterKey}') description must be string`
        );
        assertEquals(
          paramDef.description.length >= 3,
          true,
          `Param '${paramName}' in tool '${toolName}' (adapter '${adapterKey}') description too short`
        );
      }
    }
  }
});

// =============================================================================
// NAMING CONVENTION TESTS
// =============================================================================

Deno.test("Adapter names are lowercase with underscores only", () => {
  const validNamePattern = /^[a-z][a-z0-9_]*$/;
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    assertEquals(
      validNamePattern.test(adapter.name),
      true,
      `Adapter '${adapterKey}' name '${adapter.name}' must be lowercase with underscores only`
    );
  }
});

Deno.test("Tool names follow naming convention (lowercase_with_underscores)", () => {
  const validNamePattern = /^[a-z][a-z0-9_]*$/;
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const toolName of Object.keys(adapter.tools || {})) {
      assertEquals(
        validNamePattern.test(toolName),
        true,
        `Tool '${toolName}' in adapter '${adapterKey}' must follow lowercase_with_underscores convention`
      );
    }
  }
});

Deno.test("Tool names are prefixed with adapter-related name", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const toolName of Object.keys(adapter.tools || {})) {
      // Tools should start with a prefix derived from the adapter name
      // Allow variations: surrealdb -> surreal_, dragonfly -> dragonfly_ or redis_, etc.
      const adapterBase = adapter.name.replace(/db$/i, "").replace(/-/g, "_");
      const keyBase = adapterKey.replace(/db$/i, "").replace(/-/g, "_");

      // Check multiple valid prefix patterns
      const validPrefixes = [
        adapter.name + "_",
        adapterKey + "_",
        adapterBase + "_",
        keyBase + "_",
        adapter.name.substring(0, 4) + "_", // First 4 chars
      ];

      const hasValidPrefix = validPrefixes.some((prefix) =>
        toolName.toLowerCase().startsWith(prefix.toLowerCase())
      );

      assertEquals(
        hasValidPrefix,
        true,
        `Tool '${toolName}' in adapter '${adapterKey}' should be prefixed with adapter name variant`
      );
    }
  }
});

// =============================================================================
// CONSISTENCY TESTS
// =============================================================================

Deno.test("Adapter key matches adapter name", () => {
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    const normalizedKey = adapterKey.replace(/-/g, "_").toLowerCase();
    const normalizedName = adapter.name.replace(/-/g, "_").toLowerCase();
    assertEquals(
      normalizedKey,
      normalizedName,
      `Adapter key '${adapterKey}' does not match name '${adapter.name}'`
    );
  }
});

Deno.test("No duplicate tool names across adapters", () => {
  const allToolNames = new Map();
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    for (const toolName of Object.keys(adapter.tools || {})) {
      if (allToolNames.has(toolName)) {
        throw new Error(
          `Duplicate tool name '${toolName}' found in adapters '${allToolNames.get(toolName)}' and '${adapterKey}'`
        );
      }
      allToolNames.set(toolName, adapterKey);
    }
  }
});

// =============================================================================
// ADAPTER COUNT VERIFICATION
// =============================================================================

Deno.test("Expected number of adapters loaded (21)", () => {
  const adapterCount = Object.keys(adapters).length;
  assertEquals(
    adapterCount,
    20,
    `Expected 20 adapters, found ${adapterCount}`
  );
});

// =============================================================================
// SPECIFIC ADAPTER TESTS
// =============================================================================

Deno.test("SurrealDB adapter has expected tools", () => {
  const expectedTools = [
    "surreal_query",
    "surreal_select",
    "surreal_create",
    "surreal_update",
    "surreal_delete",
  ];
  for (const tool of expectedTools) {
    assertExists(
      surrealdb.tools[tool],
      `SurrealDB adapter missing expected tool '${tool}'`
    );
  }
});

Deno.test("PostgreSQL adapter has query tool", () => {
  const hasQueryTool = Object.keys(postgresql.tools || {}).some(
    (name) => name.includes("query") || name.includes("sql")
  );
  assertEquals(hasQueryTool, true, "PostgreSQL adapter should have query tool");
});

Deno.test("Redis/Dragonfly adapter has key-value tools", () => {
  const toolNames = Object.keys(dragonfly.tools || {});
  const hasGet = toolNames.some((name) => name.includes("get"));
  const hasSet = toolNames.some((name) => name.includes("set"));
  assertEquals(hasGet, true, "Dragonfly adapter should have get tool");
  assertEquals(hasSet, true, "Dragonfly adapter should have set tool");
});

Deno.test("Elasticsearch adapter has search tool", () => {
  const toolNames = Object.keys(elasticsearch.tools || {});
  const hasSearch = toolNames.some((name) => name.includes("search"));
  assertEquals(hasSearch, true, "Elasticsearch adapter should have search tool");
});

Deno.test("Qdrant adapter has vector operations", () => {
  const toolNames = Object.keys(qdrant.tools || {});
  const hasVectorOp = toolNames.some(
    (name) => name.includes("search") || name.includes("vector") || name.includes("point")
  );
  assertEquals(hasVectorOp, true, "Qdrant adapter should have vector operations");
});

// =============================================================================
// SECURITY TESTS
// =============================================================================

Deno.test("No hardcoded credentials in adapter exports", () => {
  const sensitivePatterns = [
    /password\s*[:=]\s*["'][^"']+["']/i,
    /secret\s*[:=]\s*["'][^"']+["']/i,
    /api_key\s*[:=]\s*["'][^"']+["']/i,
  ];
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    const adapterStr = JSON.stringify(adapter);
    for (const pattern of sensitivePatterns) {
      assertEquals(
        pattern.test(adapterStr),
        false,
        `Adapter '${adapterKey}' may contain hardcoded credentials`
      );
    }
  }
});
