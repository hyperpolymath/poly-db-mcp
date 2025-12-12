// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// Fetch API bindings for HTTP requests

type response

type requestInit = {
  method: string,
  headers: Js.Dict.t<string>,
  body: option<string>,
}

@val external fetch: (string, requestInit) => promise<response> = "fetch"
@val external fetchGet: string => promise<response> = "fetch"

@get external ok: response => bool = "ok"
@get external status: response => int = "status"
@send external json: response => promise<'a> = "json"
@send external text: response => promise<string> = "text"

@scope("response") @get
external headers: response => Js.Dict.t<string> = "headers"

let makeHeaders = (pairs: array<(string, string)>): Js.Dict.t<string> => {
  let dict = Js.Dict.empty()
  pairs->Array.forEach(((k, v)) => Js.Dict.set(dict, k, v))
  dict
}

let post = async (url: string, ~headers: Js.Dict.t<string>, ~body: string): response => {
  await fetch(url, {method: "POST", headers, body: Some(body)})
}

let get = async (url: string, ~headers: Js.Dict.t<string>): response => {
  await fetch(url, {method: "GET", headers, body: None})
}

let put = async (url: string, ~headers: Js.Dict.t<string>, ~body: string): response => {
  await fetch(url, {method: "PUT", headers, body: Some(body)})
}

let delete = async (url: string, ~headers: Js.Dict.t<string>): response => {
  await fetch(url, {method: "DELETE", headers, body: None})
}
