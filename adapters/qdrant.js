/**
 * Qdrant Adapter
 * Vector database for embeddings and similarity search
 */

import { QdrantClient } from "npm:@qdrant/js-client-rest@1";

let client = null;

const config = {
  url: Deno.env.get("QDRANT_URL") || "http://localhost:6333",
  apiKey: Deno.env.get("QDRANT_API_KEY") || undefined,
};

export async function connect() {
  if (client) return client;
  client = new QdrantClient({
    url: config.url,
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
    await conn.getCollections();
    return true;
  } catch {
    return false;
  }
}

export const name = "qdrant";
export const description = "Vector database for embeddings and semantic search";

export const tools = {
  qdrant_collections: {
    description: "List all collections",
    params: {},
    handler: async () => {
      const conn = await connect();
      const result = await conn.getCollections();
      return { collections: result.collections };
    },
  },

  qdrant_collection_info: {
    description: "Get collection details",
    params: {
      collection: { type: "string", description: "Collection name" },
    },
    handler: async ({ collection }) => {
      const conn = await connect();
      const info = await conn.getCollection(collection);
      return { info };
    },
  },

  qdrant_create_collection: {
    description: "Create a new collection",
    params: {
      collection: { type: "string", description: "Collection name" },
      vectorSize: { type: "number", description: "Vector dimension size" },
      distance: { type: "string", description: "Distance metric: Cosine, Euclid, or Dot" },
    },
    handler: async ({ collection, vectorSize, distance = "Cosine" }) => {
      const conn = await connect();
      await conn.createCollection(collection, {
        vectors: {
          size: vectorSize,
          distance,
        },
      });
      return { created: collection, vectorSize, distance };
    },
  },

  qdrant_delete_collection: {
    description: "Delete a collection",
    params: {
      collection: { type: "string", description: "Collection name" },
    },
    handler: async ({ collection }) => {
      const conn = await connect();
      await conn.deleteCollection(collection);
      return { deleted: collection };
    },
  },

  qdrant_upsert: {
    description: "Insert or update points (vectors with payload)",
    params: {
      collection: { type: "string", description: "Collection name" },
      points: { type: "string", description: "JSON array of {id, vector, payload} objects" },
    },
    handler: async ({ collection, points }) => {
      const conn = await connect();
      const data = JSON.parse(points);
      await conn.upsert(collection, {
        wait: true,
        points: data,
      });
      return { upserted: data.length };
    },
  },

  qdrant_search: {
    description: "Search for similar vectors",
    params: {
      collection: { type: "string", description: "Collection name" },
      vector: { type: "string", description: "Query vector as JSON array" },
      limit: { type: "number", description: "Number of results (default 10)" },
      filter: { type: "string", description: "Filter conditions as JSON (optional)" },
      withPayload: { type: "boolean", description: "Include payload (default true)" },
    },
    handler: async ({ collection, vector, limit = 10, filter, withPayload = true }) => {
      const conn = await connect();
      const queryVector = JSON.parse(vector);
      const filterObj = filter ? JSON.parse(filter) : undefined;

      const results = await conn.search(collection, {
        vector: queryVector,
        limit,
        filter: filterObj,
        with_payload: withPayload,
      });

      return { results };
    },
  },

  qdrant_search_batch: {
    description: "Search for multiple vectors at once",
    params: {
      collection: { type: "string", description: "Collection name" },
      vectors: { type: "string", description: "JSON array of query vectors" },
      limit: { type: "number", description: "Results per query (default 10)" },
    },
    handler: async ({ collection, vectors, limit = 10 }) => {
      const conn = await connect();
      const queryVectors = JSON.parse(vectors);

      const searches = queryVectors.map((vector) => ({
        vector,
        limit,
        with_payload: true,
      }));

      const results = await conn.searchBatch(collection, { searches });
      return { results };
    },
  },

  qdrant_get: {
    description: "Get points by IDs",
    params: {
      collection: { type: "string", description: "Collection name" },
      ids: { type: "string", description: "Comma-separated point IDs" },
    },
    handler: async ({ collection, ids }) => {
      const conn = await connect();
      const idList = ids.split(",").map((id) => {
        const num = parseInt(id.trim());
        return isNaN(num) ? id.trim() : num;
      });
      const result = await conn.retrieve(collection, { ids: idList, with_payload: true, with_vector: true });
      return { points: result };
    },
  },

  qdrant_delete: {
    description: "Delete points by IDs or filter",
    params: {
      collection: { type: "string", description: "Collection name" },
      ids: { type: "string", description: "Comma-separated point IDs (optional)" },
      filter: { type: "string", description: "Filter conditions as JSON (optional)" },
    },
    handler: async ({ collection, ids, filter }) => {
      const conn = await connect();

      if (ids) {
        const idList = ids.split(",").map((id) => {
          const num = parseInt(id.trim());
          return isNaN(num) ? id.trim() : num;
        });
        await conn.delete(collection, { wait: true, points: idList });
        return { deleted_ids: idList };
      } else if (filter) {
        const filterObj = JSON.parse(filter);
        await conn.delete(collection, { wait: true, filter: filterObj });
        return { deleted_by_filter: true };
      }
      return { error: "Provide either ids or filter" };
    },
  },

  qdrant_scroll: {
    description: "Scroll through all points in a collection",
    params: {
      collection: { type: "string", description: "Collection name" },
      limit: { type: "number", description: "Points per page (default 100)" },
      offset: { type: "string", description: "Offset point ID (optional)" },
      filter: { type: "string", description: "Filter conditions as JSON (optional)" },
    },
    handler: async ({ collection, limit = 100, offset, filter }) => {
      const conn = await connect();
      const filterObj = filter ? JSON.parse(filter) : undefined;

      const result = await conn.scroll(collection, {
        limit,
        offset,
        filter: filterObj,
        with_payload: true,
      });

      return {
        points: result.points,
        next_offset: result.next_page_offset,
      };
    },
  },

  qdrant_count: {
    description: "Count points in a collection",
    params: {
      collection: { type: "string", description: "Collection name" },
      filter: { type: "string", description: "Filter conditions as JSON (optional)" },
    },
    handler: async ({ collection, filter }) => {
      const conn = await connect();
      const filterObj = filter ? JSON.parse(filter) : undefined;
      const result = await conn.count(collection, { filter: filterObj, exact: true });
      return { count: result.count };
    },
  },

  qdrant_create_index: {
    description: "Create payload index for filtering",
    params: {
      collection: { type: "string", description: "Collection name" },
      field: { type: "string", description: "Payload field name" },
      type: { type: "string", description: "Field type: keyword, integer, float, bool, geo, text" },
    },
    handler: async ({ collection, field, type }) => {
      const conn = await connect();
      await conn.createPayloadIndex(collection, {
        field_name: field,
        field_schema: type,
      });
      return { indexed: field, type };
    },
  },
};
