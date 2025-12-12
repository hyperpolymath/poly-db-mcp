// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * Meilisearch Adapter
 * Fast full-text search engine
 */

import { MeiliSearch } from "npm:meilisearch@0.44";

let client = null;

const config = {
  host: Deno.env.get("MEILISEARCH_URL") || "http://localhost:7700",
  apiKey: Deno.env.get("MEILISEARCH_API_KEY") || undefined,
};

export async function connect() {
  if (client) return client;
  client = new MeiliSearch({
    host: config.host,
    apiKey: config.apiKey,
  });
  return client;
}

export async function disconnect() {
  client = null;
}

export async function isConnected() {
  try {
    const conn = await connect();
    await conn.health();
    return true;
  } catch {
    return false;
  }
}

export const name = "meilisearch";
export const description = "Fast full-text search engine";

export const tools = {
  meili_search: {
    description: "Search for documents",
    params: {
      index: { type: "string", description: "Index name" },
      query: { type: "string", description: "Search query" },
      limit: { type: "number", description: "Max results (default 20)" },
      filter: { type: "string", description: "Filter expression (optional)" },
      sort: { type: "string", description: "Sort expression (optional)" },
    },
    handler: async ({ index, query, limit = 20, filter, sort }) => {
      const conn = await connect();
      const idx = conn.index(index);

      const options = { limit };
      if (filter) options.filter = filter;
      if (sort) options.sort = sort.split(",");

      const results = await idx.search(query, options);
      return {
        hits: results.hits,
        estimatedTotalHits: results.estimatedTotalHits,
        processingTimeMs: results.processingTimeMs,
      };
    },
  },

  meili_indexes: {
    description: "List all indexes",
    params: {},
    handler: async () => {
      const conn = await connect();
      const indexes = await conn.getIndexes();
      return {
        indexes: indexes.results.map((i) => ({
          uid: i.uid,
          primaryKey: i.primaryKey,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        })),
      };
    },
  },

  meili_create_index: {
    description: "Create a new index",
    params: {
      index: { type: "string", description: "Index name" },
      primaryKey: { type: "string", description: "Primary key field (optional)" },
    },
    handler: async ({ index, primaryKey }) => {
      const conn = await connect();
      const task = await conn.createIndex(index, { primaryKey });
      return { task };
    },
  },

  meili_delete_index: {
    description: "Delete an index",
    params: {
      index: { type: "string", description: "Index name" },
    },
    handler: async ({ index }) => {
      const conn = await connect();
      const task = await conn.deleteIndex(index);
      return { task };
    },
  },

  meili_add_documents: {
    description: "Add or update documents",
    params: {
      index: { type: "string", description: "Index name" },
      documents: { type: "string", description: "JSON array of documents" },
      primaryKey: { type: "string", description: "Primary key field (optional)" },
    },
    handler: async ({ index, documents, primaryKey }) => {
      const conn = await connect();
      const idx = conn.index(index);
      const docs = JSON.parse(documents);
      const task = await idx.addDocuments(docs, { primaryKey });
      return { task, documentsAdded: docs.length };
    },
  },

  meili_get_document: {
    description: "Get a document by ID",
    params: {
      index: { type: "string", description: "Index name" },
      id: { type: "string", description: "Document ID" },
    },
    handler: async ({ index, id }) => {
      const conn = await connect();
      const idx = conn.index(index);
      const doc = await idx.getDocument(id);
      return { document: doc };
    },
  },

  meili_get_documents: {
    description: "Get documents from an index",
    params: {
      index: { type: "string", description: "Index name" },
      limit: { type: "number", description: "Max documents (default 20)" },
      offset: { type: "number", description: "Offset (default 0)" },
    },
    handler: async ({ index, limit = 20, offset = 0 }) => {
      const conn = await connect();
      const idx = conn.index(index);
      const result = await idx.getDocuments({ limit, offset });
      return { documents: result.results, total: result.total };
    },
  },

  meili_delete_document: {
    description: "Delete a document by ID",
    params: {
      index: { type: "string", description: "Index name" },
      id: { type: "string", description: "Document ID" },
    },
    handler: async ({ index, id }) => {
      const conn = await connect();
      const idx = conn.index(index);
      const task = await idx.deleteDocument(id);
      return { task };
    },
  },

  meili_delete_documents: {
    description: "Delete documents by filter or IDs",
    params: {
      index: { type: "string", description: "Index name" },
      ids: { type: "string", description: "Comma-separated document IDs (optional)" },
      filter: { type: "string", description: "Filter expression (optional)" },
    },
    handler: async ({ index, ids, filter }) => {
      const conn = await connect();
      const idx = conn.index(index);

      if (ids) {
        const idList = ids.split(",").map((id) => id.trim());
        const task = await idx.deleteDocuments(idList);
        return { task };
      } else if (filter) {
        const task = await idx.deleteDocuments({ filter });
        return { task };
      }
      return { error: "Provide either ids or filter" };
    },
  },

  meili_settings: {
    description: "Get index settings",
    params: {
      index: { type: "string", description: "Index name" },
    },
    handler: async ({ index }) => {
      const conn = await connect();
      const idx = conn.index(index);
      const settings = await idx.getSettings();
      return { settings };
    },
  },

  meili_update_settings: {
    description: "Update index settings",
    params: {
      index: { type: "string", description: "Index name" },
      settings: { type: "string", description: "Settings as JSON object" },
    },
    handler: async ({ index, settings }) => {
      const conn = await connect();
      const idx = conn.index(index);
      const settingsObj = JSON.parse(settings);
      const task = await idx.updateSettings(settingsObj);
      return { task };
    },
  },

  meili_stats: {
    description: "Get index statistics",
    params: {
      index: { type: "string", description: "Index name" },
    },
    handler: async ({ index }) => {
      const conn = await connect();
      const idx = conn.index(index);
      const stats = await idx.getStats();
      return { stats };
    },
  },

  meili_tasks: {
    description: "Get recent tasks",
    params: {
      limit: { type: "number", description: "Max tasks (default 20)" },
      status: { type: "string", description: "Filter by status (optional)" },
    },
    handler: async ({ limit = 20, status }) => {
      const conn = await connect();
      const options = { limit };
      if (status) options.statuses = [status];
      const tasks = await conn.getTasks(options);
      return { tasks: tasks.results };
    },
  },
};
