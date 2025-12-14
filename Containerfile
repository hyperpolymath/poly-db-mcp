# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell
#
# Containerfile - works with podman, nerdctl, docker, buildah
# Uses official Deno image (distroless-based, minimal attack surface)
# Alternative: cerro-terro or Chainguard Wolfi (when available/authenticated)

FROM denoland/deno:2.1.4

LABEL org.opencontainers.image.title="poly-db-mcp"
LABEL org.opencontainers.image.description="Unified MCP server for 20 databases"
LABEL org.opencontainers.image.authors="Jonathan D.A. Jewell"
LABEL org.opencontainers.image.source="https://github.com/hyperpolymath/poly-db-mcp"
LABEL org.opencontainers.image.licenses="MIT"
LABEL io.modelcontextprotocol.server.name="io.github.hyperpolymath/poly-db-mcp"

WORKDIR /app

# Copy source files
COPY index.js deno.json ./
COPY adapters/ ./adapters/
# src/ contains ReScript source (optional)
COPY src/ ./src/

# Cache dependencies using deno.json config
RUN deno cache --config=deno.json index.js

# Create non-root user
RUN addgroup --system polyglot && adduser --system --ingroup polyglot polyglot
USER polyglot

# MCP server runs on stdio, expose for HTTP mode if needed
EXPOSE 8080

# Default entrypoint using deno.json config
ENTRYPOINT ["deno", "run", "--config=deno.json", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--unstable-kv", "index.js"]
