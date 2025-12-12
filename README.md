# Polyglot DB MCP

Unified MCP server for 16 databases. One interface to query them all.

**Primary Language:** ReScript (compiles to JavaScript, runs on Deno)

## Supported Databases

### Relational Databases

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **PostgreSQL** | PostgreSQL License (FOSS) | The world's most advanced open-source relational database. Excellent for complex queries, ACID compliance, and extensibility via extensions like PostGIS, pgvector | `pg_*` |
| **MariaDB** | GPL v2 (FOSS) | Community-developed fork of MySQL. Drop-in MySQL replacement with better performance and new features. Ideal for web applications | `maria_*` |
| **SQLite** | Public Domain (FOSS) | Self-contained, serverless, embedded SQL database. Perfect for local storage, mobile apps, and single-file databases | `sqlite_*` |

### Document Databases

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **MongoDB** | SSPL (Source-Available) | Leading document database for JSON-like documents. Flexible schemas, horizontal scaling, powerful aggregation pipeline | `mongo_*` |
| **SurrealDB** | BSL/Apache 2.0 (FOSS) | Multi-model database combining documents, graphs, and SQL. Real-time subscriptions, embedded and server modes | `surreal_*` |

### Graph Databases

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **Neo4j** | GPL v3 / Commercial | Industry-leading graph database. Cypher query language for traversing relationships. Social networks, recommendations, fraud detection | `neo4j_*` |

### Key-Value & Cache

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **Dragonfly** | BSL (Source-Available) | Modern Redis replacement with 25x better performance. Drop-in compatible, multi-threaded architecture | `dragonfly_*` |
| **Memcached** | BSD (FOSS) | Simple, distributed memory caching. Session storage, page caching, reducing database load | `memcached_*` |
| **LMDB** | OpenLDAP Public License (FOSS) | Lightning Memory-Mapped Database. Embedded key-value store with ACID transactions. Uses Deno.Kv backend | `lmdb_*` |

### Search Engines

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **Elasticsearch** | Elastic License 2.0 (Source-Available) | Distributed search and analytics engine. Full-text search, log analytics, APM. Powers search for major websites | `es_*` |
| **Meilisearch** | MIT (FOSS) | Lightning-fast, typo-tolerant search engine. Instant search experiences, easy to set up and use | `meili_*` |

### Vector Databases

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **Qdrant** | Apache 2.0 (FOSS) | Vector similarity search engine. Store and search embeddings for AI/ML applications, semantic search, recommendations | `qdrant_*` |

### Time Series Databases

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **InfluxDB** | MIT (FOSS, v1.x) / Proprietary (v2.x Cloud) | Purpose-built for time series data. IoT, monitoring, real-time analytics. Flux query language | `influx_*` |

### Analytics Databases

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **DuckDB** | MIT (FOSS) | In-process OLAP database. Query CSV, Parquet, JSON directly. SQLite for analytics | `duck_*` |

### Specialized Databases

| Database | License | Description | Tools |
|----------|---------|-------------|-------|
| **XTDB** | MIT (FOSS) | Bitemporal database with immutable history. Point-in-time queries, audit trails, compliance. Datalog queries | `xtdb_*` |
| **iTop** | AGPL v3 (FOSS) | IT Service Management CMDB. Track IT assets, tickets, changes. Configuration management database | `itop_*` |

### License Legend

- **FOSS**: Free and Open Source Software
- **Source-Available**: Source code viewable but with usage restrictions
- **Proprietary**: Closed source, commercial license required

## Installation

### Add to Claude Code

```bash
claude mcp add polyglot-db deno run --allow-net --allow-read --allow-write --allow-env /path/to/polyglot-db-mcp/index.js
```

### Run directly

```bash
deno task start
```

## Configuration

Set environment variables for each database you want to use:

### PostgreSQL
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=mydb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
```

### MongoDB
```bash
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=mydb
```

### Neo4j
```bash
NEO4J_URL=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=
```

### Elasticsearch
```bash
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=         # optional
ELASTICSEARCH_PASSWORD=         # optional
```

### InfluxDB
```bash
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-token
INFLUXDB_ORG=your-org
INFLUXDB_BUCKET=your-bucket
```

### SurrealDB
```bash
SURREAL_URL=http://localhost:8000
SURREAL_NAMESPACE=test
SURREAL_DATABASE=test
SURREAL_USERNAME=root
SURREAL_PASSWORD=root
```

### Dragonfly/Redis
```bash
DRAGONFLY_HOST=localhost
DRAGONFLY_PORT=6379
DRAGONFLY_PASSWORD=       # optional
```

### XTDB
```bash
XTDB_URL=http://localhost:3000
```

### SQLite
```bash
SQLITE_PATH=./data.db     # or :memory: for in-memory
```

### DuckDB
```bash
DUCKDB_PATH=./analytics.db  # or :memory:
```

### Qdrant
```bash
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=            # optional
```

### Meilisearch
```bash
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_API_KEY=       # optional
```

### MariaDB
```bash
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_USER=root
MARIADB_PASSWORD=
MARIADB_DATABASE=mydb
```

### Memcached
```bash
MEMCACHED_SERVERS=localhost:11211
```

### LMDB
```bash
LMDB_PATH=./lmdb-data
```

### iTop
```bash
ITOP_URL=http://localhost/itop
ITOP_USERNAME=admin
ITOP_PASSWORD=
```

## Usage

### Unified Tools

```
db_list          - List all available databases
db_status        - Check which databases are connected
db_help          - Get help for a specific database
```

### Example Prompts

Ask Claude:

- "What databases do I have connected?"
- "Query all users from PostgreSQL where status = 'active'"
- "Find documents in MongoDB where age > 25"
- "Search for 'authentication' in Elasticsearch"
- "Find similar vectors to this embedding in Qdrant"
- "Run this SQL on DuckDB: SELECT * FROM 'data.csv'"
- "Get the history of document X from XTDB"
- "Write time series data to InfluxDB"
- "Find paths between nodes A and B in Neo4j"

## Architecture

```
polyglot-db-mcp/
├── index.js                    # Main MCP server entry point
├── deno.json                   # Deno configuration
├── rescript.json               # ReScript compiler config
├── package.json                # Node dependencies (for ReScript)
├── src/                        # ReScript source (primary)
│   ├── Adapter.res             # Common adapter types
│   ├── bindings/               # ReScript FFI bindings
│   │   ├── Deno.res
│   │   ├── Postgres.res
│   │   ├── MongoDB.res
│   │   ├── Redis.res
│   │   ├── SQLite.res
│   │   └── ...
│   └── adapters/               # ReScript adapters (core)
│       ├── Postgresql.res
│       ├── Mongodb.res
│       ├── Sqlite.res
│       ├── Dragonfly.res
│       └── Elasticsearch.res
├── lib/es6/                    # Compiled ReScript output
├── adapters/                   # JavaScript adapters (legacy, v1.x)
│   ├── surrealdb.js
│   ├── neo4j.js
│   ├── influxdb.js
│   └── ...
├── STATE.scm                   # Project state (Guile Scheme)
├── META.scm                    # Architectural decisions
└── ECOSYSTEM.scm               # Related projects
```

## Language Policy

This project is transitioning from JavaScript to **ReScript** for type safety:

| Version | Language Mix |
|---------|--------------|
| v1.x | Core adapters in ReScript, exotic adapters in JavaScript |
| v2.0.0 | 100% ReScript |

**TypeScript is explicitly prohibited.** ReScript provides superior type inference and smaller bundle sizes.

### Building ReScript

```bash
npm install           # Install ReScript compiler
npm run res:build     # Compile ReScript to JavaScript
npm run res:watch     # Watch mode for development
```

### Git Hooks

Install the pre-commit hook to enforce language policy:

```bash
git config core.hooksPath .githooks
```

## Adding New Databases

### v2.0.0+ (ReScript)

Create an adapter in `src/adapters/YourDb.res`:

```rescript
// SPDX-License-Identifier: MIT
open Adapter

let name = "yourdb"
let description = "Your database description"

let connect = async () => { /* ... */ }
let disconnect = async () => { /* ... */ }
let isConnected = async () => { /* ... */ }

let tools: Js.Dict.t<toolDefAny> = {
  let dict = Js.Dict.empty()

  Js.Dict.set(dict, "yourdb_query", {
    description: "Execute a query",
    params: makeParams([("query", stringParam("Query to run"))]),
    handler: queryHandler,
  })

  dict
}
```

### v1.x (JavaScript - Legacy)

Create an adapter in `adapters/yourdb.js`:

```javascript
// SPDX-License-Identifier: MIT
export const name = "yourdb";
export const description = "Your database description";

export async function connect() { /* ... */ }
export async function disconnect() { /* ... */ }
export async function isConnected() { /* ... */ }

export const tools = {
  yourdb_query: {
    description: "Execute a query",
    params: { query: { type: "string", description: "Query to run" } },
    handler: async ({ query }) => { return { results: [] }; }
  }
};
```

Then import it in `index.js`.

## Roadmap

| Version | Status | Features |
|---------|--------|----------|
| 1.0.0 | Current | 16 databases, core ReScript adapters |
| 1.1.0 | Planned | Connection pooling, better error handling |
| 2.0.0 | Vision | 100% ReScript, RSR Gold compliance |

## Related Projects

- [arango-mcp](https://github.com/hyperpolymath/arango-mcp) - ArangoDB MCP server
- [virtuoso-mcp](https://github.com/hyperpolymath/virtuoso-mcp) - Virtuoso SPARQL MCP server

## License

MIT

## Author

Jonathan D.A. Jewell (hyperpolymath)
