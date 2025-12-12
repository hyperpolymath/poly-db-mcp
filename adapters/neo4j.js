// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * Neo4j Adapter
 * Graph database with Cypher query language
 */

import neo4j from "npm:neo4j-driver@5.27.0";

let driver = null;

const config = {
  url: Deno.env.get("NEO4J_URL") || "bolt://localhost:7687",
  username: Deno.env.get("NEO4J_USER") || "neo4j",
  password: Deno.env.get("NEO4J_PASSWORD") || "neo4j",
  database: Deno.env.get("NEO4J_DATABASE") || "neo4j",
};

export async function connect() {
  if (driver) return driver;
  driver = neo4j.driver(
    config.url,
    neo4j.auth.basic(config.username, config.password)
  );
  return driver;
}

export async function disconnect() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export async function isConnected() {
  try {
    const d = await connect();
    await d.verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}

export const name = "neo4j";
export const description = "Neo4j - Native graph database with Cypher query language";

function recordToObject(record) {
  const obj = {};
  record.keys.forEach((key, i) => {
    const value = record._fields[i];
    if (value && typeof value === "object" && value.properties) {
      obj[key] = { ...value.properties, _labels: value.labels, _id: value.identity?.toString() };
    } else if (value && typeof value === "object" && value.start && value.end) {
      obj[key] = {
        type: value.type,
        properties: value.properties,
        _startId: value.start?.toString(),
        _endId: value.end?.toString(),
      };
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

export const tools = {
  neo4j_query: {
    description: "Execute a Cypher query",
    params: {
      query: { type: "string", description: "Cypher query to execute" },
      params: { type: "string", description: "Query parameters as JSON (optional)" },
    },
    handler: async ({ query, params = "{}" }) => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const result = await session.run(query, JSON.parse(params));
        const records = result.records.map(recordToObject);
        return {
          records,
          count: records.length,
          summary: {
            nodesCreated: result.summary.counters._stats.nodesCreated,
            nodesDeleted: result.summary.counters._stats.nodesDeleted,
            relationshipsCreated: result.summary.counters._stats.relationshipsCreated,
            relationshipsDeleted: result.summary.counters._stats.relationshipsDeleted,
          },
        };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_create_node: {
    description: "Create a node with labels and properties",
    params: {
      labels: { type: "string", description: "Node labels (comma-separated)" },
      properties: { type: "string", description: "Node properties as JSON" },
    },
    handler: async ({ labels, properties }) => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const labelStr = labels.split(",").map((l) => l.trim()).join(":");
        const query = `CREATE (n:${labelStr} $props) RETURN n`;
        const result = await session.run(query, { props: JSON.parse(properties) });
        const node = result.records[0]?.get("n");
        return {
          created: true,
          node: node ? { ...node.properties, _labels: node.labels, _id: node.identity?.toString() } : null,
        };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_create_relationship: {
    description: "Create a relationship between nodes",
    params: {
      fromLabel: { type: "string", description: "Label of source node" },
      fromMatch: { type: "string", description: "Property match for source (e.g., {name: 'Alice'})" },
      toLabel: { type: "string", description: "Label of target node" },
      toMatch: { type: "string", description: "Property match for target" },
      relType: { type: "string", description: "Relationship type (e.g., KNOWS)" },
      properties: { type: "string", description: "Relationship properties as JSON (optional)" },
    },
    handler: async ({ fromLabel, fromMatch, toLabel, toMatch, relType, properties = "{}" }) => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const query = `
          MATCH (a:${fromLabel} ${fromMatch})
          MATCH (b:${toLabel} ${toMatch})
          CREATE (a)-[r:${relType} $props]->(b)
          RETURN a, r, b
        `;
        const result = await session.run(query, { props: JSON.parse(properties) });
        return { created: true, count: result.records.length };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_find_nodes: {
    description: "Find nodes by label and optional properties",
    params: {
      label: { type: "string", description: "Node label" },
      where: { type: "string", description: "WHERE clause conditions (optional)" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
    handler: async ({ label, where, limit = 100 }) => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        let query = `MATCH (n:${label})`;
        if (where) query += ` WHERE ${where}`;
        query += ` RETURN n LIMIT ${limit}`;
        const result = await session.run(query);
        const nodes = result.records.map((r) => {
          const n = r.get("n");
          return { ...n.properties, _labels: n.labels, _id: n.identity?.toString() };
        });
        return { nodes, count: nodes.length };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_find_relationships: {
    description: "Find relationships between nodes",
    params: {
      fromLabel: { type: "string", description: "Source node label (optional)" },
      relType: { type: "string", description: "Relationship type (optional)" },
      toLabel: { type: "string", description: "Target node label (optional)" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
    handler: async ({ fromLabel = "", relType = "", toLabel = "", limit = 100 }) => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const fromPart = fromLabel ? `:${fromLabel}` : "";
        const relPart = relType ? `:${relType}` : "";
        const toPart = toLabel ? `:${toLabel}` : "";
        const query = `MATCH (a${fromPart})-[r${relPart}]->(b${toPart}) RETURN a, r, b LIMIT ${limit}`;
        const result = await session.run(query);
        const relationships = result.records.map(recordToObject);
        return { relationships, count: relationships.length };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_shortest_path: {
    description: "Find shortest path between two nodes",
    params: {
      fromLabel: { type: "string", description: "Source node label" },
      fromMatch: { type: "string", description: "Source node match (e.g., {name: 'Alice'})" },
      toLabel: { type: "string", description: "Target node label" },
      toMatch: { type: "string", description: "Target node match" },
      relTypes: { type: "string", description: "Relationship types to traverse (optional, comma-separated)" },
      maxDepth: { type: "number", description: "Maximum path depth (default 10)" },
    },
    handler: async ({ fromLabel, fromMatch, toLabel, toMatch, relTypes, maxDepth = 10 }) => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const relPart = relTypes ? `:${relTypes.split(",").join("|")}` : "";
        const query = `
          MATCH (a:${fromLabel} ${fromMatch}), (b:${toLabel} ${toMatch})
          MATCH p = shortestPath((a)-[${relPart}*..${maxDepth}]-(b))
          RETURN p
        `;
        const result = await session.run(query);
        const paths = result.records.map((r) => {
          const path = r.get("p");
          return {
            length: path.length,
            nodes: path.segments.map((s) => ({ ...s.start.properties })),
            relationships: path.segments.map((s) => s.relationship.type),
          };
        });
        return { paths, count: paths.length };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_delete_node: {
    description: "Delete a node (and its relationships)",
    params: {
      label: { type: "string", description: "Node label" },
      match: { type: "string", description: "Property match (e.g., {id: 123})" },
      detach: { type: "boolean", description: "Also delete relationships (default true)" },
    },
    handler: async ({ label, match, detach = true }) => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const detachStr = detach ? "DETACH " : "";
        const query = `MATCH (n:${label} ${match}) ${detachStr}DELETE n`;
        const result = await session.run(query);
        return { deleted: true, nodesDeleted: result.summary.counters._stats.nodesDeleted };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_labels: {
    description: "List all node labels in the database",
    params: {},
    handler: async () => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const result = await session.run("CALL db.labels()");
        const labels = result.records.map((r) => r.get("label"));
        return { labels, count: labels.length };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_relationship_types: {
    description: "List all relationship types in the database",
    params: {},
    handler: async () => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const result = await session.run("CALL db.relationshipTypes()");
        const types = result.records.map((r) => r.get("relationshipType"));
        return { types, count: types.length };
      } finally {
        await session.close();
      }
    },
  },

  neo4j_stats: {
    description: "Get database statistics",
    params: {},
    handler: async () => {
      const d = await connect();
      const session = d.session({ database: config.database });
      try {
        const nodesResult = await session.run("MATCH (n) RETURN count(n) as count");
        const relsResult = await session.run("MATCH ()-[r]->() RETURN count(r) as count");
        return {
          nodeCount: nodesResult.records[0]?.get("count")?.toNumber() || 0,
          relationshipCount: relsResult.records[0]?.get("count")?.toNumber() || 0,
        };
      } finally {
        await session.close();
      }
    },
  },
};
