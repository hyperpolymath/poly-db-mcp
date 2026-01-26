# SPDX-License-Identifier: PMPL-1.0-or-later
# SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell
# polyglot-db-mcp justfile

# Default recipe
default:
    @just --list

# Start the MCP server
start:
    deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv index.js

# Start with watch mode for development
dev:
    deno run --watch --allow-net --allow-read --allow-write --allow-env --unstable-kv index.js

# Check syntax without running
check:
    deno check index.js

# Format all files
fmt:
    deno fmt

# Lint all files
lint:
    deno lint

# Run all validation checks
validate: check lint
    @echo "Validation complete"

# Cache dependencies
cache:
    deno cache index.js

# Show database status (requires running server)
status:
    @echo "Use db_status tool via MCP client"

# Clean generated files
clean:
    rm -rf node_modules .deno *.db lmdb-data

# Audit SPDX license headers
audit-licence:
    @echo "Checking SPDX headers..."
    @grep -L "SPDX-License-Identifier" *.js adapters/*.js || echo "All files have SPDX headers"

# Show project info
info:
    @echo "polyglot-db-mcp - Unified MCP server for multiple databases"
    @echo "Runtime: Deno"
    @echo "License: PMPL-1.0-or-later"
    @echo "Databases: 11 supported"

# List supported databases
databases:
    @echo "Supported databases:"
    @echo "  - SurrealDB (multi-model)"
    @echo "  - Dragonfly/Redis (cache/KV)"
    @echo "  - XTDB (bitemporal)"
    @echo "  - SQLite (embedded SQL)"
    @echo "  - DuckDB (analytics)"
    @echo "  - Qdrant (vector)"
    @echo "  - Meilisearch (search)"
    @echo "  - MariaDB (relational)"
    @echo "  - Memcached (cache)"
    @echo "  - LMDB/Deno.Kv (embedded KV)"
    @echo "  - iTop (CMDB/ITSM)"

# RSR compliance check
rsr-check:
    @echo "RSR Compliance Check"
    @echo "===================="
    @test -f LICENSE.txt && echo "✓ LICENSE.txt" || echo "✗ LICENSE.txt"
    @test -f SECURITY.md && echo "✓ SECURITY.md" || echo "✗ SECURITY.md"
    @test -f CODE_OF_CONDUCT.adoc && echo "✓ CODE_OF_CONDUCT.adoc" || echo "✗ CODE_OF_CONDUCT.adoc"
    @test -f CONTRIBUTING.adoc && echo "✓ CONTRIBUTING.adoc" || echo "✗ CONTRIBUTING.adoc"
    @test -f FUNDING.yml && echo "✓ FUNDING.yml" || echo "✗ FUNDING.yml"
    @test -f GOVERNANCE.adoc && echo "✓ GOVERNANCE.adoc" || echo "✗ GOVERNANCE.adoc"
    @test -f MAINTAINERS.md && echo "✓ MAINTAINERS.md" || echo "✗ MAINTAINERS.md"
    @test -f .gitattributes && echo "✓ .gitattributes" || echo "✗ .gitattributes"
    @test -d .well-known && echo "✓ .well-known/" || echo "✗ .well-known/"
    @test -f justfile && echo "✓ justfile" || echo "✗ justfile"
