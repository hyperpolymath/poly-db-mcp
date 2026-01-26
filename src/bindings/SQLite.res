// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// SQLite bindings using Deno's FFI or sql.js
/// Using sql.js for cross-platform compatibility

type database
type statement
type queryResult = array<Js.Dict.t<Js.Json.t>>

module SqlJs = {
  type sqlJsStatic
  type config = {locateFile: string => string}

  @module("npm:sql.js@1.11.0")
  external initSqlJs: config => promise<sqlJsStatic> = "default"

  @send external makeDatabase: (sqlJsStatic, option<Js.TypedArray2.Uint8Array.t>) => database = "Database"
}

@send external run: (database, string) => unit = "run"
@send external exec: (database, string) => array<{"columns": array<string>, "values": array<array<Js.Json.t>>}> = "exec"
@send external prepare: (database, string) => statement = "prepare"
@send external close: database => unit = "close"
@send external export: database => Js.TypedArray2.Uint8Array.t = "export"

@send external step: statement => bool = "step"
@send external getAsObject: statement => Js.Dict.t<Js.Json.t> = "getAsObject"
@send external free: statement => unit = "free"
@send external bind: (statement, array<Js.Json.t>) => bool = "bind"
@send external reset: statement => unit = "reset"

// Helper to convert exec result to array of objects
let execToObjects = (db: database, sql: string): queryResult => {
  let results = exec(db, sql)
  if Array.length(results) == 0 {
    []
  } else {
    let first = results[0]->Belt.Option.getExn
    let columns = first["columns"]
    first["values"]->Array.map(row => {
      let obj = Js.Dict.empty()
      columns->Array.forEachWithIndex((i, col) => {
        row[i]->Belt.Option.forEach(v => Js.Dict.set(obj, col, v))
      })
      obj
    })
  }
}
