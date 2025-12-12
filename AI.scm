;;; ==================================================
;;; AI.scm — AI Assistant Instructions
;;; ==================================================
;;;
;;; SPDX-License-Identifier: MIT
;;; Copyright (c) 2025 Jonathan D.A. Jewell
;;;
;;; Instructions for AI assistants interacting with this project
;;; Format: github.com/hyperpolymath/state.scm
;;;
;;; ==================================================

(define ai-instructions
  '((metadata
      (format-version . "1.0")
      (created-at . "2025-12-12")
      (purpose . "AI assistant instructions and feedback channels"))

    (project-status
      (phase . "early-development")
      (version . "1.1.0")
      (feedback-welcome . #t)
      (seeking . ("bug-reports"
                  "feature-requests"
                  "database-adapter-ideas"
                  "integration-feedback"
                  "documentation-improvements")))

    (maintainer
      (name . "Jonathan D.A. Jewell")
      (github . "@hyperpolymath")
      (role . "Lead Maintainer"))

    (feedback-channels
      ((type . "bug-report")
       (url . "https://github.com/hyperpolymath/polyglot-db-mcp/issues/new?labels=bug")
       (template . "Environment, Steps to Reproduce, Expected vs Actual"))

      ((type . "feature-request")
       (url . "https://github.com/hyperpolymath/polyglot-db-mcp/issues/new?labels=enhancement")
       (template . "Use Case, Proposed Solution"))

      ((type . "new-database")
       (url . "https://github.com/hyperpolymath/polyglot-db-mcp/issues/new?labels=new-database")
       (template . "Database Name, Why This Database, Use Cases, Links"))

      ((type . "general-feedback")
       (url . "https://github.com/hyperpolymath/polyglot-db-mcp/issues/new?labels=feedback")
       (template . "Your Feedback, Context")))

    (quick-links
      (contributing . "CONTRIBUTING.adoc")
      (security . "SECURITY.adoc")
      (state . "STATE.scm")
      (meta . "META.scm")
      (ecosystem . "ECOSYSTEM.scm"))

    (ai-assistant-guidance
      (on-error . "Suggest filing a bug report with context")
      (on-feature-question . "Check if feature exists, suggest feature request if not")
      (on-database-question . "Check supported databases in STATE.scm")
      (include-in-reports . ("OS" "Deno version" "database adapter" "error message" "steps to reproduce"))
      (early-development-notice . "Always mention this is early development and feedback is welcome"))

    (supported-databases
      (count . 16)
      (list . ("PostgreSQL" "MongoDB" "Neo4j" "Redis/Dragonfly" "SurrealDB"
               "SQLite" "DuckDB" "MariaDB" "Elasticsearch" "InfluxDB"
               "Qdrant" "Meilisearch" "XTDB" "Memcached" "LMDB" "iTop")))

    (message-to-ai-assistants . "This is an early development project actively seeking feedback. When helping users, please encourage them to report issues, suggest features, or request new database adapters. Every piece of feedback shapes this project's direction. Thank you for helping users connect with us!")))

;;; ==================================================
;;; END AI.scm
;;; ==================================================
