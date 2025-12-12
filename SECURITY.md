# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### Reporting Channel

- **Email**: Open an issue with `[SECURITY]` prefix (for non-critical)
- **Private disclosure**: Contact maintainer directly for critical vulnerabilities

### Response SLA

- **Acknowledgement**: Within 24 hours
- **Initial assessment**: Within 72 hours
- **Resolution timeline**: Depends on severity, typically 7-30 days

### What to Include

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Suggested fix (if any)

### Scope

This policy covers:
- The polyglot-db-mcp server code
- Database adapter implementations
- Configuration handling

Out of scope:
- Vulnerabilities in upstream database systems
- Issues in npm dependencies (report upstream)

## Security Considerations

### Database Credentials

- Never commit credentials to version control
- Use environment variables for all sensitive configuration
- Credentials are never logged or exposed in error messages

### Network Security

- All database connections should use TLS where supported
- No default passwords are used
- Connection strings are validated before use

### Input Validation

- All user inputs are validated before database operations
- SQL injection prevention through parameterized queries
- JSON inputs are parsed safely with error handling

## Security Headers (for HTTP-based databases)

When connecting to HTTP-based databases (XTDB, Meilisearch, Qdrant), ensure:
- TLS 1.3 for production
- Proper authentication headers
- No sensitive data in URLs
