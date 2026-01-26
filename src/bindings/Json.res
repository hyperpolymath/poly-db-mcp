// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// JSON utilities

@scope("JSON") @val
external parse: string => 'a = "parse"

@scope("JSON") @val
external stringify: 'a => string = "stringify"

@scope("JSON") @val
external stringifyPretty: ('a, @as(json`null`) _, @as(2) _) => string = "stringify"

let parseOption = (str: string): option<'a> => {
  try {
    Some(parse(str))
  } catch {
  | _ => None
  }
}

let parseWithDefault = (str: string, default: 'a): 'a => {
  switch parseOption(str) {
  | Some(v) => v
  | None => default
  }
}
