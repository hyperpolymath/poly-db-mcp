// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell

/// MongoDB Adapter
/// Document database with flexible schemas

open Adapter

let client: ref<option<MongoDB.client>> = ref(None)
let database: ref<option<MongoDB.db>> = ref(None)

let config = {
  "url": Deno.Env.getWithDefault("MONGODB_URL", "mongodb://localhost:27017"),
  "database": Deno.Env.getWithDefault("MONGODB_DATABASE", "test"),
}

let name = "mongodb"
let description = "MongoDB - Document database with flexible schemas"

let connect = async () => {
  switch client.contents {
  | Some(_) => ()
  | None =>
    let c = MongoDB.Client.make(config["url"])
    await MongoDB.Client.connect(c)
    let db = MongoDB.Client.db(c, config["database"])
    client := Some(c)
    database := Some(db)
  }
}

let disconnect = async () => {
  switch client.contents {
  | Some(c) =>
    await MongoDB.Client.close(c)
    client := None
    database := None
  | None => ()
  }
}

let isConnected = async () => {
  try {
    await connect()
    switch database.contents {
    | Some(db) =>
      let _ = await MongoDB.Db.command(db, {"ping": 1})
      true
    | None => false
    }
  } catch {
  | _ => false
  }
}

let getDb = async (): MongoDB.db => {
  await connect()
  switch database.contents {
  | Some(db) => db
  | None => Js.Exn.raiseError("MongoDB not connected")
  }
}

// Tool handlers
let findHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let filter = args->Js.Dict.get("filter")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let limit = args->Js.Dict.get("limit")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Float.toInt)->Belt.Option.getWithDefault(100)
  let skip = args->Js.Dict.get("skip")->Belt.Option.flatMap(Js.Json.decodeNumber)->Belt.Option.map(Float.toInt)->Belt.Option.getWithDefault(0)

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let cursor = MongoDB.Collection.find(coll, Json.parse(filter))
    ->MongoDB.Cursor.skip(skip)
    ->MongoDB.Cursor.limit(limit)
  let docs = await MongoDB.Cursor.toArray(cursor)
  Obj.magic({"documents": docs, "count": Array.length(docs)})
}

let findOneHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let filter = args->Js.Dict.get("filter")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let doc = await MongoDB.Collection.findOne(coll, Json.parse(filter))
  let found = Js.Nullable.toOption(doc)->Belt.Option.isSome
  Obj.magic({"document": Js.Nullable.toOption(doc), "found": found})
}

let insertOneHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let document = args->Js.Dict.get("document")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let result = await MongoDB.Collection.insertOne(coll, Json.parse(document))
  Obj.magic({"insertedId": MongoDB.ObjectId.toString(result["insertedId"]), "acknowledged": result["acknowledged"]})
}

let insertManyHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let documents = args->Js.Dict.get("documents")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("[]")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let result = await MongoDB.Collection.insertMany(coll, Json.parse(documents))
  Obj.magic({"insertedCount": result["insertedCount"]})
}

let updateOneHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let filter = args->Js.Dict.get("filter")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let update = args->Js.Dict.get("update")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let upsert = args->Js.Dict.get("upsert")->Belt.Option.flatMap(Js.Json.decodeBoolean)->Belt.Option.getWithDefault(false)

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let opts = if upsert { Some({"upsert": true}) } else { None }
  let result = await MongoDB.Collection.updateOne(coll, Json.parse(filter), Json.parse(update), opts)
  Obj.magic({
    "matchedCount": result["matchedCount"],
    "modifiedCount": result["modifiedCount"],
  })
}

let updateManyHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let filter = args->Js.Dict.get("filter")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let update = args->Js.Dict.get("update")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let result = await MongoDB.Collection.updateMany(coll, Json.parse(filter), Json.parse(update))
  Obj.magic({"matchedCount": result["matchedCount"], "modifiedCount": result["modifiedCount"]})
}

let deleteOneHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let filter = args->Js.Dict.get("filter")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let result = await MongoDB.Collection.deleteOne(coll, Json.parse(filter))
  Obj.magic({"deletedCount": result["deletedCount"]})
}

let deleteManyHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let filter = args->Js.Dict.get("filter")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let result = await MongoDB.Collection.deleteMany(coll, Json.parse(filter))
  Obj.magic({"deletedCount": result["deletedCount"]})
}

let countHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let filter = args->Js.Dict.get("filter")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let count = await MongoDB.Collection.countDocuments(coll, Json.parse(filter))
  Obj.magic({"count": count})
}

let aggregateHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let pipeline = args->Js.Dict.get("pipeline")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("[]")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let cursor = MongoDB.Collection.aggregate(coll, Json.parse(pipeline))
  let results = await MongoDB.Cursor.toArray(cursor)
  Obj.magic({"results": results, "count": Array.length(results)})
}

let collectionsHandler = async (_args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let db = await getDb()
  let cursor = MongoDB.Db.listCollections(db)
  let colls = await MongoDB.Cursor.toArray(cursor)
  let names = colls->Array.map(c => c["name"])
  Obj.magic({"collections": names, "count": Array.length(names)})
}

let createIndexHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")
  let keys = args->Js.Dict.get("keys")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")
  let options = args->Js.Dict.get("options")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("{}")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let indexName = await MongoDB.Collection.createIndex(coll, Json.parse(keys), Json.parse(options))
  Obj.magic({"indexName": indexName, "created": true})
}

let indexesHandler = async (args: Js.Dict.t<Js.Json.t>): Js.Json.t => {
  let collection = args->Js.Dict.get("collection")->Belt.Option.flatMap(Js.Json.decodeString)->Belt.Option.getWithDefault("")

  let db = await getDb()
  let coll = MongoDB.Db.collection(db, collection)
  let indexes = await MongoDB.Collection.indexes(coll)
  Obj.magic({"indexes": indexes})
}

// Tools dictionary
let tools: Js.Dict.t<toolDefAny> = {
  let dict = Js.Dict.empty()

  Js.Dict.set(dict, "mongo_find", {
    description: "Find documents matching a filter",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("filter", stringParam("Query filter as JSON (default: {})")),
      ("limit", numberParam("Max documents (default 100)")),
      ("skip", numberParam("Documents to skip (default 0)")),
    ]),
    handler: findHandler,
  })

  Js.Dict.set(dict, "mongo_find_one", {
    description: "Find a single document",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("filter", stringParam("Query filter as JSON")),
    ]),
    handler: findOneHandler,
  })

  Js.Dict.set(dict, "mongo_insert_one", {
    description: "Insert a single document",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("document", stringParam("Document as JSON")),
    ]),
    handler: insertOneHandler,
  })

  Js.Dict.set(dict, "mongo_insert_many", {
    description: "Insert multiple documents",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("documents", stringParam("Array of documents as JSON")),
    ]),
    handler: insertManyHandler,
  })

  Js.Dict.set(dict, "mongo_update_one", {
    description: "Update a single document",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("filter", stringParam("Query filter as JSON")),
      ("update", stringParam("Update operations as JSON (e.g., {$set: {...}})")),
      ("upsert", boolParam("Create if not exists (default false)")),
    ]),
    handler: updateOneHandler,
  })

  Js.Dict.set(dict, "mongo_update_many", {
    description: "Update multiple documents",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("filter", stringParam("Query filter as JSON")),
      ("update", stringParam("Update operations as JSON")),
    ]),
    handler: updateManyHandler,
  })

  Js.Dict.set(dict, "mongo_delete_one", {
    description: "Delete a single document",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("filter", stringParam("Query filter as JSON")),
    ]),
    handler: deleteOneHandler,
  })

  Js.Dict.set(dict, "mongo_delete_many", {
    description: "Delete multiple documents",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("filter", stringParam("Query filter as JSON")),
    ]),
    handler: deleteManyHandler,
  })

  Js.Dict.set(dict, "mongo_count", {
    description: "Count documents matching a filter",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("filter", stringParam("Query filter as JSON (default: {})")),
    ]),
    handler: countHandler,
  })

  Js.Dict.set(dict, "mongo_aggregate", {
    description: "Run an aggregation pipeline",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("pipeline", stringParam("Aggregation pipeline as JSON array")),
    ]),
    handler: aggregateHandler,
  })

  Js.Dict.set(dict, "mongo_collections", {
    description: "List all collections in the database",
    params: makeParams([]),
    handler: collectionsHandler,
  })

  Js.Dict.set(dict, "mongo_create_index", {
    description: "Create an index on a collection",
    params: makeParams([
      ("collection", stringParam("Collection name")),
      ("keys", stringParam("Index keys as JSON (e.g., {field: 1})")),
      ("options", stringParam("Index options as JSON (optional)")),
    ]),
    handler: createIndexHandler,
  })

  Js.Dict.set(dict, "mongo_indexes", {
    description: "List indexes on a collection",
    params: makeParams([("collection", stringParam("Collection name"))]),
    handler: indexesHandler,
  })

  dict
}
