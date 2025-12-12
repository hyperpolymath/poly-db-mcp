// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// PostgreSQL (postgres.js) bindings

type t
type result = array<Js.Dict.t<Js.Json.t>>

type options = {
  host: string,
  port: int,
  database: string,
  username: string,
  password: string,
}

@module("npm:postgres@3.4.4")
external make: options => t = "default"

// Tagged template literal for queries - we'll use unsafe for dynamic queries
@send external unsafe: (t, string) => promise<result> = "unsafe"

// For parameterized queries, we use a different approach
@send external end: t => promise<unit> = "end"

// Helper to run a simple query
let query = async (sql: t, queryStr: string): result => {
  await unsafe(sql, queryStr)
}
