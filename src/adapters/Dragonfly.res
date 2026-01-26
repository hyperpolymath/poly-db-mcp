// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// Dragonfly/Redis Adapter
/// High-performance Redis-compatible cache

open Adapter

let client: ref<option<Redis.t>> = ref(None)

let config = {
  "host": Deno.Env.getWithDefault("DRAGONFLY_HOST", "localhost"),
  "port": Deno.Env.getWithDefault("DRAGONFLY_PORT", "6379")->Int.fromString->Belt.Option.getWithDefault(6379),
  "password": Deno.Env.get("DRAGONFLY_PASSWORD"),
  "db": Deno.Env.get("DRAGONFLY_DB")->Belt.Option.flatMap(Int.fromString),
}

let name = "dragonfly"
let description = "Dragonfly/Redis - High-performance Redis-compatible cache"

let connect = async () => {
  switch client.contents {
  | Some(_) => ()
  | None =>
    let c = Redis.make({
      host: config["host"],
      port: config["port"],
      password: config["password"],
      db: config["db"],
    })
    client := Some(c)
  }
}

let disconnect = async () => {
  switch client.contents {
  | Some(c) =>
    Redis.disconnect(c)
    client := None
  | None => ()
  }
}

let isConnected = async () => {
  try {
    await connect()
    switch client.contents {
    | Some(c) =>
      let _ = await Redis.ping(c)
      true
    | None => false
    }
  } catch {
  | _ => false
  }
}

let getClient = async (): Redis.t => {
  await connect()
  switch client.contents {
  | Some(c) => c
  | None => Js.Exn.raiseError("Redis client not connected")
  }
}

// Tool handlers
let getHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let value = await Redis.get(c, key)
  Obj.magic({
    "key": key,
    "value": Js.Nullable.toOption(value),
    "found": Js.Nullable.toOption(value)->Belt.Option.isSome,
  })
}

let setHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let value = args->Js.Dict.get("value")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let ttl = args->Js.Dict.get("ttl")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Float.toInt)
  let c = await getClient()

  switch ttl {
  | Some(seconds) => {
      let _ = await Redis.setex(c, key, seconds, value)
    }
  | None => {
      let _ = await Redis.set(c, key, value)
    }
  }

  Obj.magic({"success": true, "key": key})
}

let deleteHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let deleted = await Redis.del(c, key)
  Obj.magic({"deleted": deleted > 0, "key": key})
}

let keysHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let pattern = args->Js.Dict.get("pattern")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("*")
  let c = await getClient()
  let keys = await Redis.keys(c, pattern)
  Obj.magic({"keys": keys, "count": Array.length(keys)})
}

let existsHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let exists = await Redis.exists(c, key)
  Obj.magic({"key": key, "exists": exists > 0})
}

let ttlHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let ttl = await Redis.ttl(c, key)
  Obj.magic({"key": key, "ttl": ttl, "persistent": ttl == -1, "notFound": ttl == -2})
}

let incrHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let by = args->Js.Dict.get("by")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Float.toInt)->Belt.Option.getWithDefault(1)
  let c = await getClient()
  let value = if by == 1 {
    await Redis.incr(c, key)
  } else {
    await Redis.incrby(c, key, by)
  }
  Obj.magic({"key": key, "value": value})
}

let hgetHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let field = args->Js.Dict.get("field")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let value = await Redis.hget(c, key, field)
  Obj.magic({"key": key, "field": field, "value": Js.Nullable.toOption(value)})
}

let hsetHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let field = args->Js.Dict.get("field")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let value = args->Js.Dict.get("value")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let _ = await Redis.hset(c, key, field, value)
  Obj.magic({"success": true, "key": key, "field": field})
}

let hgetallHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let data = await Redis.hgetall(c, key)
  Obj.magic({"key": key, "data": data})
}

let lpushHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let value = args->Js.Dict.get("value")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let length = await Redis.lpush(c, key, value)
  Obj.magic({"key": key, "length": length})
}

let lrangeHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let start = args->Js.Dict.get("start")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Float.toInt)->Belt.Option.getWithDefault(0)
  let stop = args->Js.Dict.get("stop")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Float.toInt)->Belt.Option.getWithDefault(-1)
  let c = await getClient()
  let values = await Redis.lrange(c, key, start, stop)
  Obj.magic({"key": key, "values": values, "count": Array.length(values)})
}

let saddHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let member = args->Js.Dict.get("member")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let added = await Redis.sadd(c, key, member)
  Obj.magic({"key": key, "added": added > 0})
}

let smembersHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let key = args->Js.Dict.get("key")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let c = await getClient()
  let members = await Redis.smembers(c, key)
  Obj.magic({"key": key, "members": members, "count": Array.length(members)})
}

let infoHandler = async (_args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let c = await getClient()
  let info = await Redis.info(c, None)
  Obj.magic({"info": info})
}

let dbsizeHandler = async (_args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let c = await getClient()
  let size = await Redis.dbsize(c)
  Obj.magic({"keys": size})
}

// Tools dictionary
let tools: Js.Dict.t<toolDefAny> = {
  let dict = Js.Dict.empty()

  Js.Dict.set(dict, "dragonfly_get", {
    description: "Get a value by key",
    params: makeParams([("key", stringParam("Key to get"))]),
    handler: getHandler,
  })

  Js.Dict.set(dict, "dragonfly_set", {
    description: "Set a key-value pair with optional TTL",
    params: makeParams([
      ("key", stringParam("Key to set")),
      ("value", stringParam("Value to store")),
      ("ttl", numberParam("Time-to-live in seconds (optional)")),
    ]),
    handler: setHandler,
  })

  Js.Dict.set(dict, "dragonfly_delete", {
    description: "Delete a key",
    params: makeParams([("key", stringParam("Key to delete"))]),
    handler: deleteHandler,
  })

  Js.Dict.set(dict, "dragonfly_keys", {
    description: "List keys matching a pattern",
    params: makeParams([("pattern", stringParam("Pattern to match (e.g., user:*)"))]),
    handler: keysHandler,
  })

  Js.Dict.set(dict, "dragonfly_exists", {
    description: "Check if a key exists",
    params: makeParams([("key", stringParam("Key to check"))]),
    handler: existsHandler,
  })

  Js.Dict.set(dict, "dragonfly_ttl", {
    description: "Get remaining TTL for a key",
    params: makeParams([("key", stringParam("Key to check"))]),
    handler: ttlHandler,
  })

  Js.Dict.set(dict, "dragonfly_incr", {
    description: "Increment a numeric value",
    params: makeParams([
      ("key", stringParam("Key to increment")),
      ("by", numberParam("Amount to increment by (default 1)")),
    ]),
    handler: incrHandler,
  })

  Js.Dict.set(dict, "dragonfly_hget", {
    description: "Get a hash field value",
    params: makeParams([
      ("key", stringParam("Hash key")),
      ("field", stringParam("Field name")),
    ]),
    handler: hgetHandler,
  })

  Js.Dict.set(dict, "dragonfly_hset", {
    description: "Set a hash field value",
    params: makeParams([
      ("key", stringParam("Hash key")),
      ("field", stringParam("Field name")),
      ("value", stringParam("Value to set")),
    ]),
    handler: hsetHandler,
  })

  Js.Dict.set(dict, "dragonfly_hgetall", {
    description: "Get all fields and values in a hash",
    params: makeParams([("key", stringParam("Hash key"))]),
    handler: hgetallHandler,
  })

  Js.Dict.set(dict, "dragonfly_lpush", {
    description: "Push a value to the head of a list",
    params: makeParams([
      ("key", stringParam("List key")),
      ("value", stringParam("Value to push")),
    ]),
    handler: lpushHandler,
  })

  Js.Dict.set(dict, "dragonfly_lrange", {
    description: "Get a range of values from a list",
    params: makeParams([
      ("key", stringParam("List key")),
      ("start", numberParam("Start index (default 0)")),
      ("stop", numberParam("Stop index (default -1 for all)")),
    ]),
    handler: lrangeHandler,
  })

  Js.Dict.set(dict, "dragonfly_sadd", {
    description: "Add a member to a set",
    params: makeParams([
      ("key", stringParam("Set key")),
      ("member", stringParam("Member to add")),
    ]),
    handler: saddHandler,
  })

  Js.Dict.set(dict, "dragonfly_smembers", {
    description: "Get all members of a set",
    params: makeParams([("key", stringParam("Set key"))]),
    handler: smembersHandler,
  })

  Js.Dict.set(dict, "dragonfly_info", {
    description: "Get server information",
    params: makeParams([]),
    handler: infoHandler,
  })

  Js.Dict.set(dict, "dragonfly_dbsize", {
    description: "Get the number of keys in the database",
    params: makeParams([]),
    handler: dbsizeHandler,
  })

  dict
}
