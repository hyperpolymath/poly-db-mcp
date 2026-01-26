// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// Deno runtime bindings

module Env = {
  @scope(("Deno", "env")) @val
  external get: string => option<string> = "get"

  let getWithDefault = (key: string, default: string): string => {
    switch get(key) {
    | Some(v) => v
    | None => default
    }
  }
}

module Kv = {
  type t
  type kvEntry<'a> = {key: array<string>, value: 'a, versionstamp: string}
  type kvListResult<'a> = {done: bool, value: option<kvEntry<'a>>}

  @scope("Deno") @val
  external openKv: option<string> => promise<t> = "openKv"

  @send external get: (t, array<string>) => promise<kvEntry<'a>> = "get"
  @send external set: (t, array<string>, 'a) => promise<unit> = "set"
  @send external delete: (t, array<string>) => promise<unit> = "delete"
  @send external close: t => unit = "close"

  type listOptions = {prefix: array<string>}
  type kvIterator<'a>

  @send external list: (t, listOptions) => kvIterator<'a> = "list"
}
