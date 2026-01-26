// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// SQLite Adapter
/// Embedded SQL database

open Adapter

let sqlJs: ref<option<SQLite.SqlJs.sqlJsStatic>> = ref(None)
let database: ref<option<SQLite.database>> = ref(None)

let config = {
  "path": Deno.Env.get("SQLITE_PATH"),
}

let name = "sqlite"
let description = "SQLite - Embedded SQL database engine"

let connect = async () => {
  switch database.contents {
  | Some(_) => ()
  | None =>
    let sql = switch sqlJs.contents {
    | Some(s) => s
    | None =>
      let s = await SQLite.SqlJs.initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`,
      })
      sqlJs := Some(s)
      s
    }
    // For now, create in-memory database
    // File persistence would require reading/writing with Deno.readFile/writeFile
    let db = SQLite.SqlJs.makeDatabase(sql, None)
    database := Some(db)
  }
}

let disconnect = async () => {
  switch database.contents {
  | Some(db) =>
    SQLite.close(db)
    database := None
  | None => ()
  }
}

let isConnected = async () => {
  try {
    await connect()
    database.contents->Belt.Option.isSome
  } catch {
  | _ => false
  }
}

let getDb = async (): SQLite.database => {
  await connect()
  switch database.contents {
  | Some(db) => db
  | None => Js.Exn.raiseError("SQLite not connected")
  }
}

// Tool handlers
let queryHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let query = args->Js.Dict.get("query")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let db = await getDb()
  let results = SQLite.execToObjects(db, query)
  Obj.magic({"rows": results, "count": Array.length(results)})
}

let execHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let sql = args->Js.Dict.get("sql")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let db = await getDb()
  SQLite.run(db, sql)
  Obj.magic({"success": true})
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

  let db = await getDb()
  let results = SQLite.execToObjects(db, query.contents)
  Obj.magic({"rows": results, "count": Array.length(results)})
}

let insertHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let data = args->Js.Dict.get("data")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

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

  let query = `INSERT INTO ${table} (${columns}) VALUES (${values})`
  let db = await getDb()
  SQLite.run(db, query)
  Obj.magic({"inserted": true})
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
    let db = await getDb()
    SQLite.run(db, query)
    Obj.magic({"updated": true})
  }
}

let deleteHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let where = args->Js.Dict.get("where")->Belt.Option.flatMap(Js.Json.decodeString)

  switch where {
  | None => Obj.magic({"error": "WHERE clause required for DELETE"})
  | Some(w) =>
    let query = `DELETE FROM ${table} WHERE ${w}`
    let db = await getDb()
    SQLite.run(db, query)
    Obj.magic({"deleted": true})
  }
}

let tablesHandler = async (_args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let query = "SELECT name, type FROM sqlite_master WHERE type='table' ORDER BY name"
  let db = await getDb()
  let results = SQLite.execToObjects(db, query)
  Obj.magic({"tables": results, "count": Array.length(results)})
}

let schemaHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let query = `PRAGMA table_info(${table})`
  let db = await getDb()
  let results = SQLite.execToObjects(db, query)
  Obj.magic({"columns": results})
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
  let db = await getDb()
  SQLite.run(db, query)
  Obj.magic({"created": true, "table": table})
}

let dropTableHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let table = args->Js.Dict.get("table")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let query = `DROP TABLE IF EXISTS ${table}`
  let db = await getDb()
  SQLite.run(db, query)
  Obj.magic({"dropped": true, "table": table})
}

// Tools dictionary
let tools: Js.Dict.t<toolDefAny> = {
  let dict = Js.Dict.empty()

  Js.Dict.set(dict, "sqlite_query", {
    description: "Execute a SQL query and return results",
    params: makeParams([("query", stringParam("SQL query to execute"))]),
    handler: queryHandler,
  })

  Js.Dict.set(dict, "sqlite_exec", {
    description: "Execute SQL without returning results (CREATE, INSERT, etc.)",
    params: makeParams([("sql", stringParam("SQL statement to execute"))]),
    handler: execHandler,
  })

  Js.Dict.set(dict, "sqlite_select", {
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

  Js.Dict.set(dict, "sqlite_insert", {
    description: "Insert a row into a table",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("data", stringParam("JSON object of column: value pairs")),
    ]),
    handler: insertHandler,
  })

  Js.Dict.set(dict, "sqlite_update", {
    description: "Update rows in a table (WHERE required)",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("data", stringParam("JSON object of column: value pairs to update")),
      ("where", stringParam("WHERE clause (required for safety)")),
    ]),
    handler: updateHandler,
  })

  Js.Dict.set(dict, "sqlite_delete", {
    description: "Delete rows from a table (WHERE required)",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("where", stringParam("WHERE clause (required for safety)")),
    ]),
    handler: deleteHandler,
  })

  Js.Dict.set(dict, "sqlite_tables", {
    description: "List all tables in the database",
    params: makeParams([]),
    handler: tablesHandler,
  })

  Js.Dict.set(dict, "sqlite_schema", {
    description: "Get column information for a table",
    params: makeParams([("table", stringParam("Table name"))]),
    handler: schemaHandler,
  })

  Js.Dict.set(dict, "sqlite_create_table", {
    description: "Create a new table",
    params: makeParams([
      ("table", stringParam("Table name")),
      ("columns", stringParam("Column definitions as JSON array [{name, type, constraints}]")),
    ]),
    handler: createTableHandler,
  })

  Js.Dict.set(dict, "sqlite_drop_table", {
    description: "Drop a table",
    params: makeParams([("table", stringParam("Table name"))]),
    handler: dropTableHandler,
  })

  dict
}
