#!/usr/bin/env bash
# ==========================================
# Database Migration Runner
# ==========================================
#
# Applies pending migrations in order, tracking versions
# in the schema_version table.
#
# Usage:
#   ./migrate.sh [--db-url URL] [--db-user USER] [--db-pass PASS]
#   ./migrate.sh --status    # Show applied migrations
#   ./migrate.sh --pending   # Show pending migrations
#
# Environment variables:
#   DB_URL   - JDBC-style connection URL
#   DB_USER  - Database username
#   DB_PASS  - Database password
#   DB_TYPE  - mysql | postgresql | derby (auto-detected from URL)
#
# ==========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Migration registry: version | file | description
MIGRATIONS=(
    "1|migration-cashdiscount-paybotx.sql|Cash discount and PaybotX terminal integration"
    "2|migration-002-refunds-timeclock-held.sql|Refunds, time clock, held orders, delivery, promos"
    "3|migration-003-giftcards-tabs-inventory.sql|Gift cards, customer tabs, inventory tracking, batch settlement"
)

# Parse arguments
DB_URL="${DB_URL:-}"
DB_USER="${DB_USER:-}"
DB_PASS="${DB_PASS:-}"
DB_TYPE="${DB_TYPE:-}"
ACTION="migrate"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --db-url)   DB_URL="$2"; shift 2 ;;
        --db-user)  DB_USER="$2"; shift 2 ;;
        --db-pass)  DB_PASS="$2"; shift 2 ;;
        --status)   ACTION="status"; shift ;;
        --pending)  ACTION="pending"; shift ;;
        --help)     ACTION="help"; shift ;;
        *)          echo "Unknown argument: $1"; exit 1 ;;
    esac
done

# Auto-detect DB type
if [[ -z "$DB_TYPE" && -n "$DB_URL" ]]; then
    case "$DB_URL" in
        *mysql*)      DB_TYPE="mysql" ;;
        *postgres*)   DB_TYPE="postgresql" ;;
        *derby*)      DB_TYPE="derby" ;;
    esac
fi

# SQL client command builder
run_sql() {
    local sql="$1"
    case "$DB_TYPE" in
        mysql)
            mysql -h "${DB_HOST:-localhost}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "$sql" 2>/dev/null
            ;;
        postgresql)
            PGPASSWORD="$DB_PASS" psql -h "${DB_HOST:-localhost}" -U "$DB_USER" -d "$DB_NAME" -c "$sql" 2>/dev/null
            ;;
        *)
            echo "ERROR: Unsupported or undetected database type: $DB_TYPE"
            echo "Set DB_TYPE to mysql or postgresql"
            exit 1
            ;;
    esac
}

run_sql_file() {
    local file="$1"
    case "$DB_TYPE" in
        mysql)
            mysql -h "${DB_HOST:-localhost}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$file" 2>/dev/null
            ;;
        postgresql)
            PGPASSWORD="$DB_PASS" psql -h "${DB_HOST:-localhost}" -U "$DB_USER" -d "$DB_NAME" -f "$file" 2>/dev/null
            ;;
    esac
}

# Help
if [[ "$ACTION" == "help" ]]; then
    echo "Database Migration Runner"
    echo ""
    echo "Usage:"
    echo "  ./migrate.sh [--db-url URL] [--db-user USER] [--db-pass PASS]"
    echo "  ./migrate.sh --status    Show applied migrations"
    echo "  ./migrate.sh --pending   Show pending migrations"
    echo ""
    echo "Available migrations:"
    for entry in "${MIGRATIONS[@]}"; do
        IFS='|' read -r ver file desc <<< "$entry"
        echo "  v$ver: $desc ($file)"
    done
    exit 0
fi

# Ensure schema_version table exists
ensure_version_table() {
    run_sql "CREATE TABLE IF NOT EXISTS schema_version (
        version INT NOT NULL PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        script VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        applied_by VARCHAR(100) DEFAULT 'migrate.sh',
        execution_time INT DEFAULT 0,
        checksum VARCHAR(64),
        success BOOLEAN DEFAULT TRUE
    );"
}

# Get applied versions
get_applied_versions() {
    run_sql "SELECT version FROM schema_version WHERE success = TRUE ORDER BY version;" 2>/dev/null | tail -n +2
}

# Status
if [[ "$ACTION" == "status" ]]; then
    if [[ -z "$DB_TYPE" ]]; then
        echo "No database configured. Showing migration registry:"
        echo ""
        for entry in "${MIGRATIONS[@]}"; do
            IFS='|' read -r ver file desc <<< "$entry"
            printf "  v%-3s %-50s %s\n" "$ver" "$file" "$desc"
        done
        exit 0
    fi

    ensure_version_table
    echo "Applied migrations:"
    run_sql "SELECT version, description, applied_at, applied_by FROM schema_version ORDER BY version;"
    exit 0
fi

# Pending
if [[ "$ACTION" == "pending" ]]; then
    echo "Registered migrations:"
    echo ""
    for entry in "${MIGRATIONS[@]}"; do
        IFS='|' read -r ver file desc <<< "$entry"
        if [[ -f "$SCRIPT_DIR/$file" ]]; then
            status="READY"
        else
            status="MISSING"
        fi
        printf "  v%-3s [%s] %-50s %s\n" "$ver" "$status" "$file" "$desc"
    done
    exit 0
fi

# Migrate
if [[ -z "$DB_TYPE" ]]; then
    echo "ERROR: No database configured."
    echo "Set DB_URL, DB_USER, DB_PASS environment variables or use --db-url flag."
    echo ""
    echo "Run './migrate.sh --pending' to see available migrations."
    exit 1
fi

ensure_version_table
applied=$(get_applied_versions)

echo "=== Database Migration Runner ==="
echo "Database: $DB_TYPE"
echo ""

pending_count=0
for entry in "${MIGRATIONS[@]}"; do
    IFS='|' read -r ver file desc <<< "$entry"

    if echo "$applied" | grep -q "^${ver}$"; then
        echo "  v$ver: ALREADY APPLIED - $desc"
        continue
    fi

    if [[ ! -f "$SCRIPT_DIR/$file" ]]; then
        echo "  v$ver: SCRIPT MISSING - $file"
        continue
    fi

    echo "  v$ver: APPLYING - $desc ($file)..."
    start_time=$(date +%s%N)

    if run_sql_file "$SCRIPT_DIR/$file"; then
        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 ))

        checksum=$(sha256sum "$SCRIPT_DIR/$file" | cut -d' ' -f1)
        run_sql "INSERT INTO schema_version (version, description, script, applied_by, execution_time, checksum, success) VALUES ($ver, '$desc', '$file', 'migrate.sh', $duration, '$checksum', TRUE);"

        echo "    DONE (${duration}ms)"
        pending_count=$((pending_count + 1))
    else
        run_sql "INSERT INTO schema_version (version, description, script, applied_by, success) VALUES ($ver, '$desc', '$file', 'migrate.sh', FALSE);"
        echo "    FAILED!"
        exit 1
    fi
done

if [[ $pending_count -eq 0 ]]; then
    echo ""
    echo "All migrations are up to date."
else
    echo ""
    echo "$pending_count migration(s) applied successfully."
fi
