# Polyglot DB MCP

Unified MCP server for multiple databases. One tool to query them all.

## Supported Databases

| Database | Type | Tools Prefix |
|----------|------|--------------|
| **SurrealDB** | Multi-model (doc/graph/SQL) | `surreal_*` |
| **Dragonfly/Redis** | In-memory cache/KV | `redis_*` |
| **XTDB** | Bitemporal, immutable | `xtdb_*` |
| **SQLite** | Embedded SQL | `sqlite_*` |
| **DuckDB** | Analytics (CSV/Parquet/JSON) | `duck_*` |
| **Qdrant** | Vector/embeddings | `qdrant_*` |
| **Meilisearch** | Full-text search | `meili_*` |
| **MariaDB** | Relational SQL | `maria_*` |
| **Memcached** | Distributed cache | `memcached_*` |
| **LMDB** | Embedded KV | `lmdb_*` |
| **iTop** | CMDB/ITSM | `itop_*` |

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
DRAGONFLY_HOST=localhost  # or REDIS_HOST
DRAGONFLY_PORT=6379       # or REDIS_PORT
DRAGONFLY_PASSWORD=       # optional
```

### XTDB
```bash
XTDB_URL=http://localhost:3000
```

### SQLite
```bash
SQLITE_PATH=./data.db     # or :memory:
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
- "Query all users from SurrealDB"
- "Search for 'authentication' in Meilisearch"
- "Find similar vectors to this embedding in Qdrant"
- "Run this SQL on DuckDB: SELECT * FROM 'data.csv'"
- "Get the history of document X from XTDB"

## Architecture

```
polyglot-db-mcp/
├── index.js              # Main MCP server
├── deno.json             # Deno config
├── adapters/
│   ├── surrealdb.js
│   ├── dragonfly.js
│   ├── xtdb.js
│   ├── sqlite.js
│   ├── duckdb.js
│   ├── qdrant.js
│   ├── meilisearch.js
│   ├── mariadb.js
│   ├── memcached.js
│   ├── lmdb.js
│   └── itop.js
└── README.md
```

## Adding New Databases

Create an adapter in `adapters/`:

```javascript
export const name = "mydb";
export const description = "My database description";

export async function connect() { /* ... */ }
export async function disconnect() { /* ... */ }
export async function isConnected() { /* ... */ }

export const tools = {
  mydb_query: {
    description: "Execute a query",
    params: {
      query: { type: "string", description: "Query to run" }
    },
    handler: async ({ query }) => {
      // Implementation
      return { results: [] };
    }
  }
};
```

Then import it in `index.js`.

## License

MIT

## Author

hyperpolymath
