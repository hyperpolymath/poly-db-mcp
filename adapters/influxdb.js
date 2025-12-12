// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/**
 * InfluxDB Adapter
 * Time series database optimized for metrics and events
 */

const config = {
  url: Deno.env.get("INFLUXDB_URL") || "http://localhost:8086",
  token: Deno.env.get("INFLUXDB_TOKEN") || "",
  org: Deno.env.get("INFLUXDB_ORG") || "default",
  bucket: Deno.env.get("INFLUXDB_BUCKET") || "default",
};

async function influxRequest(method, path, body = null, isWrite = false) {
  const headers = {
    Authorization: `Token ${config.token}`,
  };

  if (!isWrite) {
    headers["Content-Type"] = "application/json";
  }

  const options = { method, headers };
  if (body) {
    options.body = isWrite ? body : JSON.stringify(body);
  }

  const response = await fetch(`${config.url}${path}`, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`InfluxDB error: ${response.status} - ${error}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  } else if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
    return response.text();
  }
  return response.text();
}

function parseCSV(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith("#") || !lines[i].trim()) continue;
    const values = lines[i].split(",");
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });
    results.push(row);
  }
  return results;
}

export async function connect() {
  return true;
}

export async function disconnect() {
  return true;
}

export async function isConnected() {
  try {
    await influxRequest("GET", "/ping");
    return true;
  } catch {
    return false;
  }
}

export const name = "influxdb";
export const description = "InfluxDB - Time series database for metrics and events";

export const tools = {
  influx_query: {
    description: "Execute a Flux query",
    params: {
      query: { type: "string", description: "Flux query to execute" },
      org: { type: "string", description: "Organization (optional, uses default)" },
    },
    handler: async ({ query, org }) => {
      const result = await influxRequest(
        "POST",
        `/api/v2/query?org=${encodeURIComponent(org || config.org)}`,
        {
          query,
          type: "flux",
        }
      );

      if (typeof result === "string") {
        const parsed = parseCSV(result);
        return { records: parsed, count: parsed.length };
      }
      return { result };
    },
  },

  influx_write: {
    description: "Write data points in line protocol format",
    params: {
      data: { type: "string", description: "Line protocol data (measurement,tags fields timestamp)" },
      bucket: { type: "string", description: "Bucket name (optional, uses default)" },
      precision: { type: "string", description: "Timestamp precision: ns, us, ms, s (default: ns)" },
    },
    handler: async ({ data, bucket, precision = "ns" }) => {
      await influxRequest(
        "POST",
        `/api/v2/write?org=${encodeURIComponent(config.org)}&bucket=${encodeURIComponent(bucket || config.bucket)}&precision=${precision}`,
        data,
        true
      );
      return { success: true, linesWritten: data.split("\n").filter((l) => l.trim()).length };
    },
  },

  influx_write_point: {
    description: "Write a single data point with structured input",
    params: {
      measurement: { type: "string", description: "Measurement name" },
      tags: { type: "string", description: "Tags as JSON object (optional)" },
      fields: { type: "string", description: "Fields as JSON object" },
      timestamp: { type: "string", description: "Unix timestamp in nanoseconds (optional)" },
      bucket: { type: "string", description: "Bucket name (optional)" },
    },
    handler: async ({ measurement, tags = "{}", fields, timestamp, bucket }) => {
      const tagsObj = JSON.parse(tags);
      const fieldsObj = JSON.parse(fields);

      // Build line protocol
      let line = measurement;

      // Add tags
      const tagParts = Object.entries(tagsObj)
        .map(([k, v]) => `${k}=${v}`)
        .join(",");
      if (tagParts) line += `,${tagParts}`;

      // Add fields
      const fieldParts = Object.entries(fieldsObj)
        .map(([k, v]) => {
          if (typeof v === "string") return `${k}="${v}"`;
          if (typeof v === "boolean") return `${k}=${v}`;
          return `${k}=${v}`;
        })
        .join(",");
      line += ` ${fieldParts}`;

      // Add timestamp
      if (timestamp) line += ` ${timestamp}`;

      await influxRequest(
        "POST",
        `/api/v2/write?org=${encodeURIComponent(config.org)}&bucket=${encodeURIComponent(bucket || config.bucket)}&precision=ns`,
        line,
        true
      );
      return { success: true, measurement, line };
    },
  },

  influx_query_simple: {
    description: "Simple query for a measurement over a time range",
    params: {
      measurement: { type: "string", description: "Measurement name" },
      range: { type: "string", description: "Time range (e.g., -1h, -7d, -30d)" },
      bucket: { type: "string", description: "Bucket name (optional)" },
      filter: { type: "string", description: "Additional Flux filter (optional)" },
      limit: { type: "number", description: "Max records (default 100)" },
    },
    handler: async ({ measurement, range = "-1h", bucket, filter, limit = 100 }) => {
      let query = `
        from(bucket: "${bucket || config.bucket}")
          |> range(start: ${range})
          |> filter(fn: (r) => r._measurement == "${measurement}")
      `;
      if (filter) query += `  |> filter(fn: (r) => ${filter})\n`;
      query += `  |> limit(n: ${limit})`;

      const result = await influxRequest(
        "POST",
        `/api/v2/query?org=${encodeURIComponent(config.org)}`,
        { query, type: "flux" }
      );

      if (typeof result === "string") {
        const parsed = parseCSV(result);
        return { records: parsed, count: parsed.length };
      }
      return { result };
    },
  },

  influx_aggregate: {
    description: "Aggregate data over time windows",
    params: {
      measurement: { type: "string", description: "Measurement name" },
      range: { type: "string", description: "Time range (e.g., -1h, -7d)" },
      window: { type: "string", description: "Aggregation window (e.g., 1m, 5m, 1h)" },
      fn: { type: "string", description: "Aggregation function: mean, sum, count, min, max, last" },
      bucket: { type: "string", description: "Bucket name (optional)" },
      field: { type: "string", description: "Field to aggregate (default: _value)" },
    },
    handler: async ({ measurement, range = "-1h", window = "5m", fn = "mean", bucket, field = "_value" }) => {
      const query = `
        from(bucket: "${bucket || config.bucket}")
          |> range(start: ${range})
          |> filter(fn: (r) => r._measurement == "${measurement}")
          |> filter(fn: (r) => r._field == "${field}")
          |> aggregateWindow(every: ${window}, fn: ${fn}, createEmpty: false)
          |> yield(name: "${fn}")
      `;

      const result = await influxRequest(
        "POST",
        `/api/v2/query?org=${encodeURIComponent(config.org)}`,
        { query, type: "flux" }
      );

      if (typeof result === "string") {
        const parsed = parseCSV(result);
        return { records: parsed, count: parsed.length };
      }
      return { result };
    },
  },

  influx_buckets: {
    description: "List all buckets",
    params: {
      org: { type: "string", description: "Organization (optional)" },
    },
    handler: async ({ org }) => {
      const result = await influxRequest(
        "GET",
        `/api/v2/buckets?org=${encodeURIComponent(org || config.org)}`
      );
      return {
        buckets: result.buckets?.map((b) => ({
          name: b.name,
          id: b.id,
          retentionRules: b.retentionRules,
        })),
        count: result.buckets?.length || 0,
      };
    },
  },

  influx_measurements: {
    description: "List measurements in a bucket",
    params: {
      bucket: { type: "string", description: "Bucket name (optional)" },
      range: { type: "string", description: "Time range to search (default: -30d)" },
    },
    handler: async ({ bucket, range = "-30d" }) => {
      const query = `
        import "influxdata/influxdb/schema"
        schema.measurements(bucket: "${bucket || config.bucket}", start: ${range})
      `;

      const result = await influxRequest(
        "POST",
        `/api/v2/query?org=${encodeURIComponent(config.org)}`,
        { query, type: "flux" }
      );

      if (typeof result === "string") {
        const parsed = parseCSV(result);
        const measurements = parsed.map((r) => r._value).filter(Boolean);
        return { measurements, count: measurements.length };
      }
      return { result };
    },
  },

  influx_tags: {
    description: "List tag keys for a measurement",
    params: {
      measurement: { type: "string", description: "Measurement name" },
      bucket: { type: "string", description: "Bucket name (optional)" },
      range: { type: "string", description: "Time range (default: -30d)" },
    },
    handler: async ({ measurement, bucket, range = "-30d" }) => {
      const query = `
        import "influxdata/influxdb/schema"
        schema.tagKeys(
          bucket: "${bucket || config.bucket}",
          predicate: (r) => r._measurement == "${measurement}",
          start: ${range}
        )
      `;

      const result = await influxRequest(
        "POST",
        `/api/v2/query?org=${encodeURIComponent(config.org)}`,
        { query, type: "flux" }
      );

      if (typeof result === "string") {
        const parsed = parseCSV(result);
        const tags = parsed.map((r) => r._value).filter(Boolean);
        return { tags, count: tags.length };
      }
      return { result };
    },
  },

  influx_delete: {
    description: "Delete data by time range and optional predicate",
    params: {
      start: { type: "string", description: "Start time (RFC3339 format)" },
      stop: { type: "string", description: "Stop time (RFC3339 format)" },
      predicate: { type: "string", description: "Delete predicate (e.g., _measurement=\"cpu\")" },
      bucket: { type: "string", description: "Bucket name (optional)" },
    },
    handler: async ({ start, stop, predicate, bucket }) => {
      const body = { start, stop };
      if (predicate) body.predicate = predicate;

      await influxRequest(
        "POST",
        `/api/v2/delete?org=${encodeURIComponent(config.org)}&bucket=${encodeURIComponent(bucket || config.bucket)}`,
        body
      );
      return { deleted: true, start, stop, predicate };
    },
  },

  influx_health: {
    description: "Get InfluxDB health status",
    params: {},
    handler: async () => {
      const result = await influxRequest("GET", "/health");
      return result;
    },
  },
};
