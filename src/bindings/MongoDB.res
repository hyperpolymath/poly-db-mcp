// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// MongoDB client bindings

type client
type db
type collection
type cursor<'a>
type objectId

module ObjectId = {
  @module("npm:mongodb@6.12.0") @new
  external make: string => objectId = "ObjectId"

  @send external toString: objectId => string = "toString"
}

module Client = {
  @module("npm:mongodb@6.12.0") @new
  external make: string => client = "MongoClient"

  @send external connect: client => promise<unit> = "connect"
  @send external close: client => promise<unit> = "close"
  @send external db: (client, string) => db = "db"
}

module Db = {
  @send external collection: (db, string) => collection = "collection"
  @send external command: (db, 'a) => promise<'b> = "command"
  @send external listCollections: db => cursor<{"name": string}> = "listCollections"
}

module Collection = {
  @send external find: (collection, Js.Json.t) => cursor<Js.Json.t> = "find"
  @send external findOne: (collection, Js.Json.t) => promise<Js.Nullable.t<Js.Json.t>> = "findOne"
  @send external insertOne: (collection, Js.Json.t) => promise<{"insertedId": objectId, "acknowledged": bool}> = "insertOne"
  @send external insertMany: (collection, array<Js.Json.t>) => promise<{"insertedCount": int, "insertedIds": Js.Dict.t<objectId>}> = "insertMany"
  @send external updateOne: (collection, Js.Json.t, Js.Json.t, option<{"upsert": bool}>) => promise<{"matchedCount": int, "modifiedCount": int, "upsertedId": Js.Nullable.t<objectId>}> = "updateOne"
  @send external updateMany: (collection, Js.Json.t, Js.Json.t) => promise<{"matchedCount": int, "modifiedCount": int}> = "updateMany"
  @send external deleteOne: (collection, Js.Json.t) => promise<{"deletedCount": int}> = "deleteOne"
  @send external deleteMany: (collection, Js.Json.t) => promise<{"deletedCount": int}> = "deleteMany"
  @send external countDocuments: (collection, Js.Json.t) => promise<int> = "countDocuments"
  @send external distinct: (collection, string, Js.Json.t) => promise<array<Js.Json.t>> = "distinct"
  @send external aggregate: (collection, array<Js.Json.t>) => cursor<Js.Json.t> = "aggregate"
  @send external createIndex: (collection, Js.Json.t, Js.Json.t) => promise<string> = "createIndex"
  @send external indexes: collection => promise<array<Js.Json.t>> = "indexes"
}

module Cursor = {
  @send external toArray: cursor<'a> => promise<array<'a>> = "toArray"
  @send external limit: (cursor<'a>, int) => cursor<'a> = "limit"
  @send external skip: (cursor<'a>, int) => cursor<'a> = "skip"
  @send external sort: (cursor<'a>, Js.Json.t) => cursor<'a> = "sort"
  @send external project: (cursor<'a>, Js.Json.t) => cursor<'a> = "project"
}
