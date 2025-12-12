// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// Core adapter types for polyglot-db-mcp

type paramDef = {
  @as("type") type_: string,
  description: string,
}

type toolDef<'params, 'result> = {
  description: string,
  params: Js.Dict.t<paramDef>,
  handler: 'params => promise<'result>,
}

type toolDefAny = {
  description: string,
  params: Js.Dict.t<paramDef>,
  handler: Js.Dict.t<Js.Json.t> => promise<Js.Json.t>,
}

/// Standard adapter interface
module type Adapter = {
  let name: string
  let description: string
  let connect: unit => promise<unit>
  let disconnect: unit => promise<unit>
  let isConnected: unit => promise<bool>
  let tools: Js.Dict.t<toolDefAny>
}

/// Helper to create param definitions
let stringParam = (desc: string): paramDef => {type_: "string", description: desc}
let numberParam = (desc: string): paramDef => {type_: "number", description: desc}
let boolParam = (desc: string): paramDef => {type_: "boolean", description: desc}

/// Helper to create a params dict
let makeParams = (pairs: array<(string, paramDef)>): Js.Dict.t<paramDef> => {
  let dict = Js.Dict.empty()
  pairs->Array.forEach(((k, v)) => Js.Dict.set(dict, k, v))
  dict
}

/// Result helpers
let okResult = (data: 'a): Js.Json.t => Obj.magic(data)
let errorResult = (msg: string): Js.Json.t => Obj.magic({"error": msg})
