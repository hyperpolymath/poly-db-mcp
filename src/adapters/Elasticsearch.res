// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// Elasticsearch/OpenSearch Adapter
/// Distributed search and analytics engine

open Adapter

// Configuration from environment
let config = {
  "url": Deno.Env.getWithDefault("ELASTICSEARCH_URL", "http://localhost:9200"),
  "username": Deno.Env.getWithDefault("ELASTICSEARCH_USER", ""),
  "password": Deno.Env.getWithDefault("ELASTICSEARCH_PASSWORD", ""),
  "apiKey": Deno.Env.getWithDefault("ELASTICSEARCH_API_KEY", ""),
}

// Build authorization headers
let getHeaders = (): Js.Dict.t<string> => {
  let headers = Js.Dict.empty()
  Js.Dict.set(headers, "Content-Type", "application/json")

  let apiKey = config["apiKey"]
  let username = config["username"]
  let password = config["password"]

  if apiKey != "" {
    Js.Dict.set(headers, "Authorization", `ApiKey ${apiKey}`)
  } else if username != "" && password != "" {
    // btoa is a global function in browser/Deno
    let encoded = %raw(`btoa(username + ":" + password)`)
    Js.Dict.set(headers, "Authorization", `Basic ${encoded}`)
  }

  headers
}

// HTTP request helper
let esRequest = async (method: string, path: string, ~body: option<Js.Json.t>=?, ()): Js.Json.t => {
  let url = `${config["url"]}${path}`
  let headers = getHeaders()

  let response = await Fetch.fetch(url, {
    method,
    headers,
    body: body->Option.map(Json.stringify),
  })

  if !Fetch.ok(response) {
    let errorText = await Fetch.text(response)
    Js.Exn.raiseError(`Elasticsearch error: ${Fetch.status(response)->Int.toString} - ${errorText}`)
  }

  await Fetch.json(response)
}

// Adapter exports
let name = "elasticsearch"
let description = "Elasticsearch/OpenSearch - Distributed search and analytics engine"

let connect = async () => ()
let disconnect = async () => ()

let isConnected = async () => {
  try {
    let _ = await esRequest("GET", "/", ())
    true
  } catch {
  | _ => false
  }
}

// Tool implementations
let searchHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let query = args->Js.Dict.get("query")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let size = args->Js.Dict.get("size")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.getWithDefault(10.0)
  let from = args->Js.Dict.get("from")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.getWithDefault(0.0)

  let body = {
    "query": Json.parse(query),
    "size": size->Float.toInt,
    "from": from->Float.toInt,
  }

  let result = await esRequest("POST", `/${index}/_search`, ~body=Obj.magic(body), ())
  result
}

let matchHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let field = args->Js.Dict.get("field")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let text = args->Js.Dict.get("text")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let size = args->Js.Dict.get("size")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.getWithDefault(10.0)

  let matchQuery = Js.Dict.empty()
  Js.Dict.set(matchQuery, field, Obj.magic(text))

  let body = {
    "query": {"match": matchQuery},
    "size": size->Float.toInt,
  }

  await esRequest("POST", `/${index}/_search`, ~body=Obj.magic(body), ())
}

let indexDocHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let id = args->Js.Dict.get("id")->Belt.Option.flatMap(Js.Json.decodeString)
  let document = args->Js.Dict.get("document")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let path = switch id {
  | Some(docId) => `/${index}/_doc/${docId}`
  | None => `/${index}/_doc`
  }
  let method = id->Option.isSome ? "PUT" : "POST"

  await esRequest(method, path, ~body=Json.parse(document), ())
}

let getDocHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let id = args->Js.Dict.get("id")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")

  await esRequest("GET", `/${index}/_doc/${id}`, ())
}

let deleteDocHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let id = args->Js.Dict.get("id")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")

  await esRequest("DELETE", `/${index}/_doc/${id}`, ())
}

let countHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let query = args->Js.Dict.get("query")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{\"match_all\":{}}")

  let body = {"query": Json.parse(query)}
  await esRequest("POST", `/${index}/_count`, ~body=Obj.magic(body), ())
}

let indicesHandler = async (_args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  await esRequest("GET", "/_cat/indices?format=json", ())
}

let createIndexHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let mappings = args->Js.Dict.get("mappings")->Belt.Option.flatMap(Js.Json.decodeString)
  let settings = args->Js.Dict.get("settings")->Belt.Option.flatMap(Js.Json.decodeString)

  let body = Js.Dict.empty()
  mappings->Option.forEach(m => Js.Dict.set(body, "mappings", Json.parse(m)))
  settings->Option.forEach(s => Js.Dict.set(body, "settings", Json.parse(s)))

  let bodyOpt = Js.Dict.keys(body)->Array.length > 0 ? Some(Obj.magic(body)) : None
  await esRequest("PUT", `/${index}`, ~body=?bodyOpt, ())
}

let deleteIndexHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let index = args->Js.Dict.get("index")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  await esRequest("DELETE", `/${index}`, ())
}

let clusterHealthHandler = async (_args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  await esRequest("GET", "/_cluster/health", ())
}

// Tools dictionary
let tools: Js.Dict.t<toolDefAny> = {
  let dict = Js.Dict.empty()

  Js.Dict.set(dict, "es_search", {
    description: "Search documents in an index using Query DSL",
    params: makeParams([
      ("index", stringParam("Index name (or pattern like logs-*)")),
      ("query", stringParam("Query DSL as JSON")),
      ("size", numberParam("Max results (default 10)")),
      ("from", numberParam("Offset for pagination (default 0)")),
    ]),
    handler: searchHandler,
  })

  Js.Dict.set(dict, "es_match", {
    description: "Simple full-text match query on a single field",
    params: makeParams([
      ("index", stringParam("Index name")),
      ("field", stringParam("Field to search")),
      ("text", stringParam("Search text")),
      ("size", numberParam("Max results (default 10)")),
    ]),
    handler: matchHandler,
  })

  Js.Dict.set(dict, "es_index_doc", {
    description: "Index (insert/update) a document",
    params: makeParams([
      ("index", stringParam("Index name")),
      ("id", stringParam("Document ID (optional, auto-generated if omitted)")),
      ("document", stringParam("Document as JSON")),
    ]),
    handler: indexDocHandler,
  })

  Js.Dict.set(dict, "es_get", {
    description: "Get a document by ID",
    params: makeParams([
      ("index", stringParam("Index name")),
      ("id", stringParam("Document ID")),
    ]),
    handler: getDocHandler,
  })

  Js.Dict.set(dict, "es_delete", {
    description: "Delete a document by ID",
    params: makeParams([
      ("index", stringParam("Index name")),
      ("id", stringParam("Document ID")),
    ]),
    handler: deleteDocHandler,
  })

  Js.Dict.set(dict, "es_count", {
    description: "Count documents matching a query",
    params: makeParams([
      ("index", stringParam("Index name")),
      ("query", stringParam("Query DSL as JSON (optional)")),
    ]),
    handler: countHandler,
  })

  Js.Dict.set(dict, "es_indices", {
    description: "List all indices",
    params: makeParams([]),
    handler: indicesHandler,
  })

  Js.Dict.set(dict, "es_create_index", {
    description: "Create a new index with optional mappings",
    params: makeParams([
      ("index", stringParam("Index name")),
      ("mappings", stringParam("Mappings as JSON (optional)")),
      ("settings", stringParam("Settings as JSON (optional)")),
    ]),
    handler: createIndexHandler,
  })

  Js.Dict.set(dict, "es_delete_index", {
    description: "Delete an index",
    params: makeParams([
      ("index", stringParam("Index name")),
    ]),
    handler: deleteIndexHandler,
  })

  Js.Dict.set(dict, "es_cluster_health", {
    description: "Get cluster health status",
    params: makeParams([]),
    handler: clusterHealthHandler,
  })

  dict
}
