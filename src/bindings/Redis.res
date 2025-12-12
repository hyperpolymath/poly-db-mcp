// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// Redis/ioredis bindings

type t

type redisOptions = {
  host: string,
  port: int,
  password: option<string>,
  db: option<int>,
}

@module("npm:ioredis@5.4.2") @new
external make: redisOptions => t = "default"

@send external get: (t, string) => promise<Js.Nullable.t<string>> = "get"
@send external set: (t, string, string) => promise<string> = "set"
@send external setex: (t, string, int, string) => promise<string> = "setex"
@send external del: (t, string) => promise<int> = "del"
@send external exists: (t, string) => promise<int> = "exists"
@send external keys: (t, string) => promise<array<string>> = "keys"
@send external ttl: (t, string) => promise<int> = "ttl"
@send external expire: (t, string, int) => promise<int> = "expire"
@send external incr: (t, string) => promise<int> = "incr"
@send external incrby: (t, string, int) => promise<int> = "incrby"
@send external decr: (t, string) => promise<int> = "decr"

// Hash operations
@send external hget: (t, string, string) => promise<Js.Nullable.t<string>> = "hget"
@send external hset: (t, string, string, string) => promise<int> = "hset"
@send external hgetall: (t, string) => promise<Js.Dict.t<string>> = "hgetall"
@send external hdel: (t, string, string) => promise<int> = "hdel"
@send external hexists: (t, string, string) => promise<int> = "hexists"
@send external hkeys: (t, string) => promise<array<string>> = "hkeys"
@send external hvals: (t, string) => promise<array<string>> = "hvals"

// List operations
@send external lpush: (t, string, string) => promise<int> = "lpush"
@send external rpush: (t, string, string) => promise<int> = "rpush"
@send external lpop: (t, string) => promise<Js.Nullable.t<string>> = "lpop"
@send external rpop: (t, string) => promise<Js.Nullable.t<string>> = "rpop"
@send external lrange: (t, string, int, int) => promise<array<string>> = "lrange"
@send external llen: (t, string) => promise<int> = "llen"

// Set operations
@send external sadd: (t, string, string) => promise<int> = "sadd"
@send external srem: (t, string, string) => promise<int> = "srem"
@send external smembers: (t, string) => promise<array<string>> = "smembers"
@send external sismember: (t, string, string) => promise<int> = "sismember"
@send external scard: (t, string) => promise<int> = "scard"

// Sorted set operations
@send external zadd: (t, string, float, string) => promise<int> = "zadd"
@send external zrange: (t, string, int, int) => promise<array<string>> = "zrange"
@send external zrangeWithScores: (t, string, int, int, @as("WITHSCORES") _) => promise<array<string>> = "zrange"
@send external zrem: (t, string, string) => promise<int> = "zrem"
@send external zscore: (t, string, string) => promise<Js.Nullable.t<string>> = "zscore"
@send external zcard: (t, string) => promise<int> = "zcard"

// Connection
@send external ping: t => promise<string> = "ping"
@send external quit: t => promise<string> = "quit"
@send external disconnect: t => unit = "disconnect"
@send external info: (t, option<string>) => promise<string> = "info"
@send external dbsize: t => promise<int> = "dbsize"
@send external flushdb: t => promise<string> = "flushdb"

// Pub/Sub
@send external publish: (t, string, string) => promise<int> = "publish"
@send external subscribe: (t, string) => promise<int> = "subscribe"
