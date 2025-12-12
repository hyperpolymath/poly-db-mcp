// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * Elasticsearch/OpenSearch Adapter
 * Distributed search and analytics engine
 */

let client = null;

const config = {
  url: Deno.env.get("ELASTICSEARCH_URL") || "http://localhost:9200",
  username: Deno.env.get("ELASTICSEARCH_USER") || "",
  password: Deno.env.get("ELASTICSEARCH_PASSWORD") || "",
  apiKey: Deno.env.get("ELASTICSEARCH_API_KEY") || "",
};

function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers["Authorization"] = `ApiKey ${config.apiKey}`;
  } else if (config.username && config.password) {
    headers["Authorization"] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
  }
  return headers;
}

async function esRequest(method, path, body = null) {
  const options = {
    method,
    headers: getHeaders(),
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${config.url}${path}`, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Elasticsearch error: ${response.status} - ${error}`);
  }
  return response.json();
}

export async function connect() {
  return true;
}

export async function disconnect() {
  return true;
}

export async function isConnected() {
  try {
    await esRequest("GET", "/");
    return true;
  } catch {
    return false;
  }
}

export const name = "elasticsearch";
export const description = "Elasticsearch/OpenSearch - Distributed search and analytics engine";

export const tools = {
  es_search: {
    description: "Search documents in an index",
    params: {
      index: { type: "string", description: "Index name (or pattern like logs-*)" },
      query: { type: "string", description: "Query DSL as JSON" },
      size: { type: "number", description: "Max results (default 10)" },
      from: { type: "number", description: "Offset for pagination (default 0)" },
      sort: { type: "string", description: "Sort specification as JSON (optional)" },
    },
    handler: async ({ index, query, size = 10, from = 0, sort }) => {
      const body = { query: JSON.parse(query), size, from };
      if (sort) body.sort = JSON.parse(sort);
      const result = await esRequest("POST", `/${index}/_search`, body);
      return {
        total: result.hits.total?.value || result.hits.total,
        hits: result.hits.hits.map((h) => ({ _id: h._id, _score: h._score, ...h._source })),
        count: result.hits.hits.length,
      };
    },
  },

  es_match: {
    description: "Simple match query (full-text search)",
    params: {
      index: { type: "string", description: "Index name" },
      field: { type: "string", description: "Field to search" },
      text: { type: "string", description: "Search text" },
      size: { type: "number", description: "Max results (default 10)" },
    },
    handler: async ({ index, field, text, size = 10 }) => {
      const body = { query: { match: { [field]: text } }, size };
      const result = await esRequest("POST", `/${index}/_search`, body);
      return {
        total: result.hits.total?.value || result.hits.total,
        hits: result.hits.hits.map((h) => ({ _id: h._id, _score: h._score, ...h._source })),
        count: result.hits.hits.length,
      };
    },
  },

  es_multi_match: {
    description: "Search across multiple fields",
    params: {
      index: { type: "string", description: "Index name" },
      fields: { type: "string", description: "Fields to search (comma-separated)" },
      text: { type: "string", description: "Search text" },
      type: { type: "string", description: "Match type: best_fields, most_fields, cross_fields, phrase" },
      size: { type: "number", description: "Max results (default 10)" },
    },
    handler: async ({ index, fields, text, type = "best_fields", size = 10 }) => {
      const body = {
        query: {
          multi_match: {
            query: text,
            fields: fields.split(",").map((f) => f.trim()),
            type,
          },
        },
        size,
      };
      const result = await esRequest("POST", `/${index}/_search`, body);
      return {
        total: result.hits.total?.value || result.hits.total,
        hits: result.hits.hits.map((h) => ({ _id: h._id, _score: h._score, ...h._source })),
      };
    },
  },

  es_index_doc: {
    description: "Index (insert/update) a document",
    params: {
      index: { type: "string", description: "Index name" },
      id: { type: "string", description: "Document ID (optional, auto-generated if omitted)" },
      document: { type: "string", description: "Document as JSON" },
    },
    handler: async ({ index, id, document }) => {
      const path = id ? `/${index}/_doc/${id}` : `/${index}/_doc`;
      const result = await esRequest(id ? "PUT" : "POST", path, JSON.parse(document));
      return { _id: result._id, _version: result._version, result: result.result };
    },
  },

  es_bulk: {
    description: "Bulk index multiple documents",
    params: {
      index: { type: "string", description: "Default index name" },
      operations: { type: "string", description: "Array of {action, doc, id?} as JSON" },
    },
    handler: async ({ index, operations }) => {
      const ops = JSON.parse(operations);
      const lines = [];
      for (const op of ops) {
        const action = op.action || "index";
        const meta = { [action]: { _index: index } };
        if (op.id) meta[action]._id = op.id;
        lines.push(JSON.stringify(meta));
        if (op.doc) lines.push(JSON.stringify(op.doc));
      }
      const body = lines.join("\n") + "\n";
      const response = await fetch(`${config.url}/_bulk`, {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/x-ndjson" },
        body,
      });
      const result = await response.json();
      return { took: result.took, errors: result.errors, items: result.items?.length };
    },
  },

  es_get: {
    description: "Get a document by ID",
    params: {
      index: { type: "string", description: "Index name" },
      id: { type: "string", description: "Document ID" },
    },
    handler: async ({ index, id }) => {
      const result = await esRequest("GET", `/${index}/_doc/${id}`);
      return { _id: result._id, found: result.found, document: result._source };
    },
  },

  es_delete: {
    description: "Delete a document by ID",
    params: {
      index: { type: "string", description: "Index name" },
      id: { type: "string", description: "Document ID" },
    },
    handler: async ({ index, id }) => {
      const result = await esRequest("DELETE", `/${index}/_doc/${id}`);
      return { _id: result._id, result: result.result };
    },
  },

  es_delete_by_query: {
    description: "Delete documents matching a query",
    params: {
      index: { type: "string", description: "Index name" },
      query: { type: "string", description: "Query DSL as JSON" },
    },
    handler: async ({ index, query }) => {
      const result = await esRequest("POST", `/${index}/_delete_by_query`, {
        query: JSON.parse(query),
      });
      return { deleted: result.deleted, total: result.total };
    },
  },

  es_count: {
    description: "Count documents matching a query",
    params: {
      index: { type: "string", description: "Index name" },
      query: { type: "string", description: "Query DSL as JSON (optional)" },
    },
    handler: async ({ index, query = '{"match_all": {}}' }) => {
      const result = await esRequest("POST", `/${index}/_count`, {
        query: JSON.parse(query),
      });
      return { count: result.count };
    },
  },

  es_aggregate: {
    description: "Run an aggregation query",
    params: {
      index: { type: "string", description: "Index name" },
      aggs: { type: "string", description: "Aggregations as JSON" },
      query: { type: "string", description: "Filter query as JSON (optional)" },
    },
    handler: async ({ index, aggs, query = '{"match_all": {}}' }) => {
      const body = { size: 0, query: JSON.parse(query), aggs: JSON.parse(aggs) };
      const result = await esRequest("POST", `/${index}/_search`, body);
      return { aggregations: result.aggregations };
    },
  },

  es_create_index: {
    description: "Create a new index with mappings",
    params: {
      index: { type: "string", description: "Index name" },
      mappings: { type: "string", description: "Mappings as JSON (optional)" },
      settings: { type: "string", description: "Settings as JSON (optional)" },
    },
    handler: async ({ index, mappings, settings }) => {
      const body = {};
      if (mappings) body.mappings = JSON.parse(mappings);
      if (settings) body.settings = JSON.parse(settings);
      const result = await esRequest("PUT", `/${index}`, Object.keys(body).length ? body : undefined);
      return { acknowledged: result.acknowledged, index: result.index };
    },
  },

  es_delete_index: {
    description: "Delete an index",
    params: {
      index: { type: "string", description: "Index name" },
    },
    handler: async ({ index }) => {
      const result = await esRequest("DELETE", `/${index}`);
      return { acknowledged: result.acknowledged };
    },
  },

  es_indices: {
    description: "List all indices",
    params: {
      pattern: { type: "string", description: "Index pattern (default: *)" },
    },
    handler: async ({ pattern = "*" }) => {
      const result = await esRequest("GET", `/_cat/indices/${pattern}?format=json`);
      return {
        indices: result.map((i) => ({
          index: i.index,
          health: i.health,
          status: i.status,
          docsCount: i["docs.count"],
          storeSize: i["store.size"],
        })),
        count: result.length,
      };
    },
  },

  es_mapping: {
    description: "Get index mapping",
    params: {
      index: { type: "string", description: "Index name" },
    },
    handler: async ({ index }) => {
      const result = await esRequest("GET", `/${index}/_mapping`);
      return { mapping: result[index]?.mappings };
    },
  },

  es_cluster_health: {
    description: "Get cluster health status",
    params: {},
    handler: async () => {
      const result = await esRequest("GET", "/_cluster/health");
      return {
        status: result.status,
        numberOfNodes: result.number_of_nodes,
        activeShards: result.active_primary_shards,
        relocatingShards: result.relocating_shards,
      };
    },
  },
};
