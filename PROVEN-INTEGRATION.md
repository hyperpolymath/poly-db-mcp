# Proven Library Integration Plan

This document outlines how the [proven](https://github.com/hyperpolymath/proven) library's formally verified modules can be integrated into poly-db-mcp.

## Applicable Modules

### High Priority

| Module | Use Case | Formal Guarantee |
|--------|----------|------------------|
| `SafeQuery` | SQL query validation | Injection prevention |
| `SafeSchema` | Schema validation | Type-safe table definitions |
| `SafeTransaction` | Transaction management | ACID compliance proofs |

### Medium Priority

| Module | Use Case | Formal Guarantee |
|--------|----------|------------------|
| `SafeBuffer` | Query result buffering | Bounded result sets |
| `SafeResource` | Connection lifecycle | Valid connection states |
| `SafeCapability` | Database permissions | Scoped access |

## Integration Points

### 1. Query Validation (SafeQuery)

```
user_query → SafeQuery.parse → typed AST → SafeQuery.validate → safe execution
```

Prevents SQL injection by construction:
- Parameterized queries only
- Identifier quoting enforced
- No dynamic SQL concatenation

### 2. Schema Validation (SafeSchema)

```
CREATE TABLE → SafeSchema.validateDDL → typed TableDef
SELECT * FROM → SafeSchema.checkColumns → validated projection
```

Ensures queries reference valid columns and tables.

### 3. Transaction State Machine (SafeTransaction)

```
:idle → :active → :prepared → :committed
                      ↓
                  :rolled_back
```

State transitions:
- `BEGIN`: idle → active
- `PREPARE`: active → prepared (2PC)
- `COMMIT`: prepared → committed
- `ROLLBACK`: active|prepared → rolled_back

## Database-Specific Integrations

| Database | Key Integration | proven Module |
|----------|-----------------|---------------|
| PostgreSQL | Type system | SafeSchema |
| SQLite | Single-writer | SafeResource |
| DuckDB | Analytics | SafeBuffer |
| SurrealDB | Graph queries | SafeGraph |
| CockroachDB | Distributed | SafeTransaction |

## Query Builder Integration

For type-safe query building:

```
SafeQuery.select ["name", "email"]
  |> SafeQuery.from "users"
  |> SafeQuery.where (SafeQuery.eq "id" paramId)
  |> SafeQuery.toSQL
```

Returns: `SELECT name, email FROM users WHERE id = $1`

## Implementation Notes

All user input flows through proven's query validator:

```
raw_sql → SafeQuery.parse → AST → SafeQuery.parameterize → safe_sql
```

Queries that cannot be parameterized are rejected.

## Status

- [ ] Add SafeQuery bindings for SQL validation
- [ ] Implement SafeSchema for DDL validation
- [ ] Integrate SafeTransaction for connection state
- [ ] Add SafeBuffer for result pagination
