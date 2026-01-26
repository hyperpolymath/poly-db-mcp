// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2026 Jonathan D.A. Jewell

/**
 * VeriSimDB Adapter - Multimodal federated database
 * https://github.com/hyperpolymath/verisimdb
 */

export const description =
  "Multimodal federated database with 6 modalities (Graph, Vector, Tensor, Semantic, Document, Temporal)";

// Connection state
let url = null;
let apiKey = null;

export async function connect() {
  url = Deno.env.get("VERISIMDB_URL") || "http://localhost:8080";
  apiKey = Deno.env.get("VERISIMDB_API_KEY") || "";
}

export async function disconnect() {
  url = null;
  apiKey = null;
}

export async function isConnected() {
  if (!url) return false;
  try {
    const response = await fetch(`${url}/health`, {
      headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper for API calls
async function apiCall(path, options = {}) {
  if (!url) throw new Error("Not connected to VeriSimDB");

  const headers = {
    "Content-Type": "application/json",
    ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${url}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VeriSimDB error: ${response.status} ${text}`);
  }

  return await response.json();
}

// Tools
export const tools = {
  verisimdb_status: {
    description: "Get VeriSimDB server status and connected modalities",
    params: {},
    handler: async () => {
      const health = await apiCall("/health");
      return {
        status: "connected",
        url,
        modalities: health.modalities || ["graph", "vector", "tensor", "semantic", "document", "temporal"],
        deployment_mode: health.deployment_mode || "standalone",
      };
    },
  },

  verisimdb_create_hexad: {
    description: "Create a new hexad (knowledge unit) with multi-modal representations",
    params: {
      title: { type: "string", description: "Hexad title" },
      body: { type: "string", description: "Document body content" },
      embedding: { type: "string", description: "JSON array of embedding values (optional)" },
      types: { type: "string", description: "JSON array of RDF types (optional)" },
      relationships: { type: "string", description: "JSON array of [predicate, target_id] pairs (optional)" },
    },
    handler: async ({ title, body, embedding, types, relationships }) => {
      const data = { title, body };
      if (embedding) data.embedding = JSON.parse(embedding);
      if (types) data.types = JSON.parse(types);
      if (relationships) data.relationships = JSON.parse(relationships);

      return await apiCall("/api/v1/hexads", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },

  verisimdb_query_vql: {
    description: "Execute a VQL (VeriSim Query Language) query across modalities",
    params: {
      query: { type: "string", description: "VQL query string" },
      explain: { type: "boolean", description: "Return query plan instead of executing (optional)" },
    },
    handler: async ({ query, explain = false }) => {
      const path = explain ? "/api/v1/query/explain" : "/api/v1/query";
      return await apiCall(path, {
        method: "POST",
        body: JSON.stringify({ query }),
      });
    },
  },

  verisimdb_search: {
    description: "Search across modalities with natural language query",
    params: {
      query: { type: "string", description: "Search query" },
      modalities: { type: "string", description: "Comma-separated list (e.g., 'document,vector,graph')" },
      limit: { type: "number", description: "Max results (default: 10)" },
    },
    handler: async ({ query, modalities = "document,vector", limit = 10 }) => {
      const params = new URLSearchParams({
        q: query,
        modalities,
        limit: String(limit),
      });
      return await apiCall(`/api/v1/search?${params}`);
    },
  },

  verisimdb_federation_search: {
    description: "Search across federated stores (federated deployment mode only)",
    params: {
      query: { type: "string", description: "Search query" },
      modalities: { type: "string", description: "Comma-separated list of modalities" },
      limit: { type: "number", description: "Max results" },
    },
    handler: async ({ query, modalities, limit = 10 }) => {
      const params = new URLSearchParams({
        q: query,
        modalities,
        limit: String(limit),
      });
      return await apiCall(`/api/v1/federation/search?${params}`);
    },
  },

  verisimdb_register_store: {
    description: "Register a federated store in the namespace (federated mode)",
    params: {
      hexad_id: { type: "string", description: "128-bit UUID for hexad" },
      store_endpoint: { type: "string", description: "HTTPS URL of the store" },
      modalities: { type: "string", description: "JSON array of modality names" },
      policy_hash: { type: "string", description: "SHA-256 hash of store policy" },
    },
    handler: async ({ hexad_id, store_endpoint, modalities, policy_hash }) => {
      return await apiCall("/api/v1/registry/hexads", {
        method: "POST",
        body: JSON.stringify({
          hexad_id,
          store_endpoint,
          modalities: JSON.parse(modalities),
          policy_hash,
        }),
      });
    },
  },

  verisimdb_verify_zkp: {
    description: "Verify a zero-knowledge proof without accessing the data",
    params: {
      hexad_id: { type: "string", description: "Hexad UUID" },
      contract: { type: "string", description: "Contract name (e.g., CitationContract)" },
      witness: { type: "string", description: "Hex-encoded witness data" },
    },
    handler: async ({ hexad_id, contract, witness }) => {
      return await apiCall("/api/v1/verify/zkp", {
        method: "POST",
        body: JSON.stringify({ hexad_id, contract, witness }),
      });
    },
  },

  verisimdb_drift_status: {
    description: "Get drift detection status across modalities",
    params: {
      hexad_id: { type: "string", description: "Hexad UUID (optional, checks all if omitted)" },
    },
    handler: async ({ hexad_id }) => {
      const path = hexad_id
        ? `/api/v1/drift/${hexad_id}`
        : "/api/v1/drift/status";
      return await apiCall(path);
    },
  },

  verisimdb_list_hexads: {
    description: "List all hexads in the namespace",
    params: {
      modality: { type: "string", description: "Filter by modality (optional)" },
      limit: { type: "number", description: "Max results" },
      offset: { type: "number", description: "Pagination offset" },
    },
    handler: async ({ modality, limit = 50, offset = 0 }) => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (modality) params.set("modality", modality);
      return await apiCall(`/api/v1/hexads?${params}`);
    },
  },
};
