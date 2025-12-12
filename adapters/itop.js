/**
 * iTop Adapter
 * IT Operations Portal - CMDB and ITSM
 */

const config = {
  url: Deno.env.get("ITOP_URL") || "http://localhost/itop",
  username: Deno.env.get("ITOP_USERNAME") || "admin",
  password: Deno.env.get("ITOP_PASSWORD") || "",
  version: Deno.env.get("ITOP_API_VERSION") || "1.3",
};

async function itopRequest(operation, params = {}) {
  const body = new URLSearchParams();
  body.append("version", config.version);
  body.append("auth_user", config.username);
  body.append("auth_pwd", config.password);
  body.append(
    "json_data",
    JSON.stringify({
      operation,
      ...params,
    })
  );

  const response = await fetch(`${config.url}/webservices/rest.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`iTop error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  if (result.code !== 0) {
    throw new Error(`iTop API error: ${result.message}`);
  }

  return result;
}

export async function connect() {
  return true;
}

export async function disconnect() {
  return true;
}

export async function isConnected() {
  try {
    await itopRequest("core/check_credentials");
    return true;
  } catch {
    return false;
  }
}

export const name = "itop";
export const description = "iTop CMDB/ITSM - IT service management and configuration database";

export const tools = {
  itop_get: {
    description: "Get objects by OQL query",
    params: {
      class: { type: "string", description: "iTop class name (e.g., Server, NetworkDevice)" },
      oql: { type: "string", description: "OQL WHERE clause (optional)" },
      fields: { type: "string", description: "Comma-separated field names to return (optional)" },
      limit: { type: "number", description: "Max results (default 100)" },
    },
    handler: async ({ class: className, oql, fields, limit = 100 }) => {
      const key = oql ? `SELECT ${className} WHERE ${oql}` : `SELECT ${className}`;
      const params = {
        class: className,
        key,
        output_fields: fields || "*",
        limit: limit.toString(),
      };

      const result = await itopRequest("core/get", params);
      return {
        count: Object.keys(result.objects || {}).length,
        objects: result.objects,
      };
    },
  },

  itop_get_by_id: {
    description: "Get a single object by ID",
    params: {
      class: { type: "string", description: "iTop class name" },
      id: { type: "number", description: "Object ID" },
      fields: { type: "string", description: "Comma-separated field names (optional)" },
    },
    handler: async ({ class: className, id, fields }) => {
      const result = await itopRequest("core/get", {
        class: className,
        key: id,
        output_fields: fields || "*",
      });
      return { object: result.objects?.[`${className}::${id}`] };
    },
  },

  itop_create: {
    description: "Create a new object",
    params: {
      class: { type: "string", description: "iTop class name" },
      fields: { type: "string", description: "Field values as JSON object" },
      comment: { type: "string", description: "Change comment (optional)" },
    },
    handler: async ({ class: className, fields, comment }) => {
      const result = await itopRequest("core/create", {
        class: className,
        fields: JSON.parse(fields),
        comment: comment || "Created via API",
      });
      return { created: result.objects };
    },
  },

  itop_update: {
    description: "Update an existing object",
    params: {
      class: { type: "string", description: "iTop class name" },
      id: { type: "number", description: "Object ID" },
      fields: { type: "string", description: "Field values to update as JSON object" },
      comment: { type: "string", description: "Change comment (optional)" },
    },
    handler: async ({ class: className, id, fields, comment }) => {
      const result = await itopRequest("core/update", {
        class: className,
        key: id,
        fields: JSON.parse(fields),
        comment: comment || "Updated via API",
      });
      return { updated: result.objects };
    },
  },

  itop_delete: {
    description: "Delete an object",
    params: {
      class: { type: "string", description: "iTop class name" },
      id: { type: "number", description: "Object ID" },
      comment: { type: "string", description: "Deletion comment (optional)" },
    },
    handler: async ({ class: className, id, comment }) => {
      const result = await itopRequest("core/delete", {
        class: className,
        key: id,
        comment: comment || "Deleted via API",
      });
      return { deleted: true, result };
    },
  },

  itop_apply_stimulus: {
    description: "Apply a lifecycle stimulus (state transition)",
    params: {
      class: { type: "string", description: "iTop class name" },
      id: { type: "number", description: "Object ID" },
      stimulus: { type: "string", description: "Stimulus code (e.g., ev_assign, ev_resolve)" },
      fields: { type: "string", description: "Additional fields as JSON (optional)" },
      comment: { type: "string", description: "Transition comment (optional)" },
    },
    handler: async ({ class: className, id, stimulus, fields, comment }) => {
      const params = {
        class: className,
        key: id,
        stimulus,
        comment: comment || "State changed via API",
      };
      if (fields) {
        params.fields = JSON.parse(fields);
      }
      const result = await itopRequest("core/apply_stimulus", params);
      return { result: result.objects };
    },
  },

  itop_classes: {
    description: "List available classes",
    params: {},
    handler: async () => {
      const result = await itopRequest("core/get", {
        class: "CMDBClass",
        key: "SELECT CMDBClass",
        output_fields: "name,description",
      });
      return { classes: result.objects };
    },
  },

  itop_relations: {
    description: "Get related objects",
    params: {
      class: { type: "string", description: "iTop class name" },
      id: { type: "number", description: "Object ID" },
      relation: { type: "string", description: "Relation name (e.g., impacts, depends on)" },
      depth: { type: "number", description: "Relation depth (default 1)" },
    },
    handler: async ({ class: className, id, relation, depth = 1 }) => {
      const result = await itopRequest("core/get_related", {
        class: className,
        key: id,
        relation,
        depth,
      });
      return { related: result.objects };
    },
  },

  itop_search: {
    description: "Full-text search across objects",
    params: {
      class: { type: "string", description: "iTop class name" },
      query: { type: "string", description: "Search text" },
      fields: { type: "string", description: "Fields to return (optional)" },
    },
    handler: async ({ class: className, query, fields }) => {
      // Full-text search via OQL LIKE
      const oql = `SELECT ${className} WHERE friendlyname LIKE '%${query}%' OR description LIKE '%${query}%'`;
      const result = await itopRequest("core/get", {
        class: className,
        key: oql,
        output_fields: fields || "*",
        limit: "50",
      });
      return {
        count: Object.keys(result.objects || {}).length,
        objects: result.objects,
      };
    },
  },

  itop_tickets: {
    description: "Get tickets (UserRequests, Incidents)",
    params: {
      type: { type: "string", description: "Ticket type: UserRequest, Incident, Change, Problem" },
      status: { type: "string", description: "Filter by status (optional)" },
      limit: { type: "number", description: "Max results (default 50)" },
    },
    handler: async ({ type = "UserRequest", status, limit = 50 }) => {
      const oql = status
        ? `SELECT ${type} WHERE status = '${status}'`
        : `SELECT ${type}`;

      const result = await itopRequest("core/get", {
        class: type,
        key: oql,
        output_fields: "ref,title,status,priority,caller_id_friendlyname,team_id_friendlyname",
        limit: limit.toString(),
      });
      return {
        count: Object.keys(result.objects || {}).length,
        tickets: result.objects,
      };
    },
  },

  itop_ci_types: {
    description: "Get Configuration Item types",
    params: {},
    handler: async () => {
      const ciTypes = [
        "Server",
        "VirtualMachine",
        "NetworkDevice",
        "PC",
        "Printer",
        "Phone",
        "Rack",
        "ApplicationSolution",
        "DBServer",
        "WebServer",
        "Middleware",
      ];
      return { ci_types: ciTypes };
    },
  },
};
