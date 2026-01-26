// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// PostgreSQL Adapter
/// Advanced open source relational database

open Adapter

let client: ref<option<Postgres.t>> = ref(None)

let config = {
  "host": Deno.Env.getWithDefault("POSTGRES_HOST", "localhost"),
  "port": Deno.Env.getWithDefault("POSTGRES_PORT", "5432")->Int.fromString->Belt.Option.getWithDefault(5432),
  "database": Deno.Env.getWithDefault("POSTGRES_DATABASE", "postgres"),
  "username": Deno.Env.getWithDefault("POSTGRES_USER", "postgres"),
  "password": Deno.Env.getWithDefault("POSTGRES_PASSWORD", ""),
}

let name = "postgresql"
let description = "PostgreSQL - Advanced open source relational database"

let connect = async () => {
  switch client.contents {
  | Some(_) => ()
  | None =>
    let c = Postgres.make({
      host: config["host"],
      port: config["port"],
      database: config["database"],
      username: config["username"],
      password: config["password"],
    })
    client := Some(c)
  }
}

let disconnect = async () => {
  switch client.contents {
  | Some(c) =>
    await Postgres.end(c)
    client := None
  | None => ()
  }
}

let isConnected = async () => {
  try {
    await connect()
    switch client.contents {
    | Some(c) =>
      let _ = await Postgres.query(c, "SELECT 1")
      true
    | None => false
    }
  } catch {
  | _ => false
  }
}

let getClient = async (): Postgres.t => {
  await connect()
  switch client.contents {
  | Some(c) => c
  | None => Js.Exn.raiseError("PostgreSQL client not connected")
  }
}

// Tool handlers
let queryHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let query = args->Js.Dict.get("query")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let result = await Postgres.query(c, query)
  Obj.magic({"rows": result, "count": Array.length(result)})
}

let selectHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let columns = args->Js.Dict.get("columns")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("*")
  let where = args->Js.Dict.get("where")->Belt.Option.flatMap(Js.Json.decodeString)
  let orderBy = args->Js.Dict.get("orderBy")->Belt.Option.flatMap(Js.Json.decodeString)
  let limit = args->Js.Dict.get("limit")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Float.toInt)->Belt.Option.getWithDefault(100)

  let query = ref(`SELECT ${columns} FROM ${table}`)
  where->Belt.Option.forEach(w => query := query.contents ++ ` WHERE ${w}`)
  orderBy->Belt.Option.forEach(o => query := query.contents ++ ` ORDER BY ${o}`)
  query := query.contents ++ ` LIMIT ${Int.toString(limit)}`

  let c = await getClient()
  let result = await Postgres.query(c, query.contents)
  Obj.magic({"rows": result, "count": Array.length(result)})
}

let insertHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let data = args->Js.Dict.get("data")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let returning = args->Js.Dict.get("returning")->Belt.Option.flatMap(Js.Json.decodeString)

  let obj: Js.Dict.t<Js.Json.t> = Json.parse(data)
  let columns = Js.Dict.keys(obj)->Js.Array2.joinWith(", ")
  let values = Js.Dict.values(obj)
    ->Array.map(v => {
      switch Js.Json.decodeString(v) {
      | Some(s) => `'${s}'`
      | None => Json.stringify(v)
      }
    })
    ->Js.Array2.joinWith(", ")

  let query = ref(`INSERT INTO ${table} (${columns}) VALUES (${values})`)
  returning->Belt.Option.forEach(r => query := query.contents ++ ` RETURNING ${r}`)

  let c = await getClient()
  let result = await Postgres.query(c, query.contents)
  Obj.magic({"inserted": true, "result": result})
}

let updateHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let data = args->Js.Dict.get("data")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let where = args->Js.Dict.get("where")->Belt.Option.flatMap(Js.Json.decodeString)

  switch where {
  | None => Obj.magic({"error": "WHERE clause required for UPDATE"})
  | Some(w) =>
    let obj: Js.Dict.t<Js.Json.t> = Json.parse(data)
    let sets = Js.Dict.entries(obj)
      ->Array.map(((k, v)) => {
        let val = switch Js.Json.decodeString(v) {
        | Some(s) => `'${s}'`
        | None => Json.stringify(v)
        }
        `${k} = ${val}`
      })
      ->Js.Array2.joinWith(", ")

    let query = `UPDATE ${table} SET ${sets} WHERE ${w}`
    let c = await getClient()
    let result = await Postgres.query(c, query)
    Obj.magic({"updated": true, "result": result})
  }
}

let deleteHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let where = args->Js.Dict.get("where")->Belt.Option.flatMap(Js.Json.decodeString)

  switch where {
  | None => Obj.magic({"error": "WHERE clause required for DELETE"})
  | Some(w) =>
    let query = `DELETE FROM ${table} WHERE ${w}`
    let c = await getClient()
    let result = await Postgres.query(c, query)
    Obj.magic({"deleted": true, "result": result})
  }
}

let tablesHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let schema = args->Js.Dict.get("schema")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("public")
  let query = `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = '${schema}' ORDER BY table_name`
  let c = await getClient()
  let result = await Postgres.query(c, query)
  Obj.magic({"tables": result, "count": Array.length(result)})
}

let columnsHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let schema = args->Js.Dict.get("schema")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("public")
  let query = `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}' ORDER BY ordinal_position`
  let c = await getClient()
  let result = await Postgres.query(c, query)
  Obj.magic({"columns": result})
}

let createTableHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let columns = args->Js.Dict.get("columns")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("[]")

  let cols: array<{"name": string, "type": string, "constraints": option<string>}> = Json.parse(columns)
  let colDefs = cols
    ->Array.map(c => {
      let constraints = c["constraints"]->Belt.Option.getWithDefault("")
      `${c["name"]} ${c["type"]} ${constraints}`->String.trim
    })
    ->Js.Array2.joinWith(", ")

  let query = `CREATE TABLE ${table} (${colDefs})`
  let c = await getClient()
  let _ = await Postgres.query(c, query)
  Obj.magic({"created": true, "table": table})
}

let extensionsHandler = async (_args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let query = "SELECT extname, extversion FROM pg_extension ORDER BY extname"
  let c = await getClient()
  let result = await Postgres.query(c, query)
  Obj.magic({"extensions": result})
}

// Tools dictionary
let tools: Js.Dict.t<toolDefAny> = {
  let dict = Js.Dict.empty()

  Js.Dict.set(dict, "pg_query", {
    description: "Execute a raw SQL query",
    params: makeParams([("query", stringParam("SQL query to execute"))]),
    handler: queryHandler,
  })

  Js.Dict.set(dict, "pg_select", {
    description: "Select rows from a table with optional filtering",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("columns", stringParam("Columns to select (default: *)")),
      ("where", stringParam("WHERE clause (optional)")),
      ("orderBy", stringParam("ORDER BY clause (optional)")),
      ("limit", numberParam("Max rows (default 100)")),
    ]),
    handler: selectHandler,
  })

  Js.Dict.set(dict, "pg_insert", {
    description: "Insert a row into a table",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("data", stringParam("JSON object of column: value pairs")),
      ("returning", stringParam("Columns to return (optional)")),
    ]),
    handler: insertHandler,
  })

  Js.Dict.set(dict, "pg_update", {
    description: "Update rows in a table (WHERE required)",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("data", stringParam("JSON object of column: value pairs to update")),
      ("where", stringParam("WHERE clause (required for safety)")),
    ]),
    handler: updateHandler,
  })

  Js.Dict.set(dict, "pg_delete", {
    description: "Delete rows from a table (WHERE required)",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("where", stringParam("WHERE clause (required for safety)")),
    ]),
    handler: deleteHandler,
  })

  Js.Dict.set(dict, "pg_tables", {
    description: "List all tables in the database",
    params: makeParams([("schema", stringParam("Schema name (default: public)"))]),
    handler: tablesHandler,
  })

  Js.Dict.set(dict, "pg_columns", {
    description: "Get column information for a table",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("schema", stringParam("Schema name (default: public)")),
    ]),
    handler: columnsHandler,
  })

  Js.Dict.set(dict, "pg_create_table", {
    description: "Create a new table",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("columns", stringParam("Column definitions as JSON array [{name, type, constraints}]")),
    ]),
    handler: createTableHandler,
  })

  Js.Dict.set(dict, "pg_extensions", {
    description: "List installed PostgreSQL extensions",
    params: makeParams([]),
    handler: extensionsHandler,
  })

  dict
}
