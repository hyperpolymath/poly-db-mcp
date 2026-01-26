;; SPDX-License-Identifier: PMPL-1.0-or-later
;; ECOSYSTEM.scm - Project ecosystem positioning

(ecosystem
  ((version . "1.1.0")
   (name . "poly-db-mcp")
   (type . "mcp-server")
   (purpose . "Unified MCP server for 20+ databases - query PostgreSQL, MongoDB, Neo4j, Elasticsearch, Redis and more through a single interface")

   (position-in-ecosystem
     "poly-db-mcp is the database access layer for the hyperpolymath ecosystem.
      It provides Claude and other MCP clients direct access to multiple databases
      through natural language queries.")

   (related-projects
     ((rhodium-standard
        ((relationship . sibling-standard)
         (description . "RSR compliance framework")))

      (git-hud
        ((relationship . infrastructure)
         (description . "Git repository management")))

      (formdb
        ((relationship . future-integration)
         (status . planned-v2.0)
         (description . "Narrative-first, reversible, audit-grade database")
         (note . "FormDB is in PoC stage - adapter will be added when API stabilizes")
         (integration . "formdb_* tools for narrative queries and audit trails")))))

   (what-this-is
     ("Unified database MCP server for 20+ databases"
      "ReScript core with Deno runtime"
      "Direct database drivers - no CLI wrapping"
      "Natural language to database queries"))

   (what-this-is-not
     ("Not an ORM or query builder"
      "Not a database itself"
      "Not a drop-in replacement for direct database clients")))
  (opsm-integration
    (relationship "core")
    (description "database adapter layer for OPSM.")
    (direction "opsm -> poly-db-mcp"))
)
