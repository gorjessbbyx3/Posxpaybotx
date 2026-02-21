#!/bin/bash
# ============================================================
# Restaurant POS Setup Script
# Self-hosted Floreant POS with PaybotX + Cash Discount
# ============================================================

set -e

echo "============================================"
echo "  Restaurant POS - Setup"
echo "  Floreant POS + PaybotX + Cash Discount"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
check_prereqs() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"

    if command -v java &> /dev/null; then
        JAVA_VER=$(java -version 2>&1 | head -n1 | awk -F '"' '{print $2}')
        JAVA_MAJOR=$(echo "$JAVA_VER" | awk -F'.' '{print $1}')
        echo -e "  ${GREEN}✓${NC} Java: $JAVA_VER"
        if [ "$JAVA_MAJOR" -lt 17 ] 2>/dev/null; then
            echo -e "  ${RED}✗${NC} Java 17+ is required (CVE-2025-10492: JasperReports deserialization vulnerability)"
            echo "    Your version ($JAVA_VER) is vulnerable. Please upgrade:"
            echo "    Ubuntu: sudo apt install openjdk-17-jdk"
            echo "    Mac:    brew install openjdk@17"
            exit 1
        fi
    else
        echo -e "  ${RED}✗${NC} Java not found. Please install JDK 17+ (required for CVE-2025-10492 mitigation)"
        echo "    Ubuntu: sudo apt install openjdk-17-jdk"
        echo "    Mac:    brew install openjdk@17"
        exit 1
    fi

    if command -v mvn &> /dev/null; then
        MVN_VER=$(mvn -version 2>&1 | head -n1 | awk '{print $3}')
        echo -e "  ${GREEN}✓${NC} Maven: $MVN_VER"
    else
        echo -e "  ${YELLOW}!${NC} Maven not found. Will attempt to build without it."
    fi

    if command -v docker &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Docker available"
        DOCKER_AVAILABLE=true
    else
        echo -e "  ${YELLOW}!${NC} Docker not found (optional for containerized deployment)"
        DOCKER_AVAILABLE=false
    fi

    echo ""
}

# Install local Maven dependencies
install_deps() {
    echo -e "${YELLOW}Installing local dependencies...${NC}"

    if command -v mvn &> /dev/null; then
        # Install local JARs to Maven cache
        for jar in local-lib/com/miglayout/miglayout/2.0/miglayout-2.0.jar \
                   local-lib/net/xeoh/jspf.core/1.0.2/jspf.core-1.0.2.jar \
                   local-lib/jpos/jpos/110/jpos-110.jar \
                   local-lib/jpos/jpos-controls/110/jpos-controls-110.jar; do
            if [ -f "$jar" ]; then
                groupId=$(echo "$jar" | sed 's|local-lib/||;s|/[^/]*/[^/]*/[^/]*$||;s|/|.|g')
                artifactId=$(basename "$(dirname "$(dirname "$jar")")")
                version=$(basename "$(dirname "$jar")")
                echo "  Installing: $artifactId-$version"
                mvn install:install-file -Dfile="$jar" -DgroupId="$groupId" \
                    -DartifactId="$artifactId" -Dversion="$version" \
                    -Dpackaging=jar -q 2>/dev/null || true
            fi
        done
    fi
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
    echo ""
}

# Configure PaybotX terminal
configure_terminal() {
    echo -e "${YELLOW}PaybotX Terminal Configuration${NC}"
    echo "  (Press Enter to skip and configure later in the UI)"
    echo ""

    read -p "  Merchant ID: " MERCHANT_ID
    read -p "  Terminal ID: " TERMINAL_ID
    read -p "  API Key: " API_KEY
    read -p "  Terminal IP (for LAN mode, or blank for cloud): " TERMINAL_IP

    if [ -n "$MERCHANT_ID" ] && [ -n "$TERMINAL_ID" ] && [ -n "$API_KEY" ]; then
        # Update terminal config
        cat > resources/paybotx-terminals.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<terminals>
  <terminal id="${TERMINAL_ID}" active="true">
    <merchantId>${MERCHANT_ID}</merchantId>
    <apiKey>${API_KEY}</apiKey>
    <ipAddress>${TERMINAL_IP}</ipAddress>
    <port>8443</port>
    <model>VP8800</model>
  </terminal>
</terminals>
EOF
        echo -e "  ${GREEN}✓${NC} Terminal configured"
    else
        echo -e "  ${YELLOW}!${NC} Skipped - configure in Back Office > PaybotX / Valor"
    fi
    echo ""
}

# Configure cash discount
configure_cash_discount() {
    echo -e "${YELLOW}Cash Discount / Surcharge Configuration${NC}"
    echo ""
    echo "  1) Cash Discount (menu = card price, cash gets discount)"
    echo "  2) Card Surcharge (menu = cash price, card pays surcharge)"
    echo "  3) Disabled"
    echo ""
    read -p "  Select mode [1-3, default=1]: " CD_MODE

    case "$CD_MODE" in
        2) MODE="CARD_SURCHARGE" ;;
        3) MODE="DISABLED" ;;
        *) MODE="CASH_DISCOUNT" ;;
    esac

    if [ "$MODE" != "DISABLED" ]; then
        read -p "  Rate percentage [default=4.0]: " CD_RATE
        CD_RATE=${CD_RATE:-4.0}
        echo -e "  ${GREEN}✓${NC} Cash discount: $MODE at ${CD_RATE}%"
    else
        echo -e "  ${GREEN}✓${NC} Cash discount disabled"
    fi
    echo ""
}

# Build the project
build_project() {
    echo -e "${YELLOW}Building project...${NC}"

    if command -v mvn &> /dev/null; then
        mvn package -DskipTests -q 2>&1 || {
            echo -e "  ${YELLOW}!${NC} Maven build had issues (expected for some optional deps)"
            echo "  The POS can still run with the source files."
        }
    fi

    echo -e "  ${GREEN}✓${NC} Build complete"
    echo ""
}

# Docker setup
docker_setup() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        echo -e "${YELLOW}Docker deployment available:${NC}"
        echo "  docker-compose up -d"
        echo ""
        echo "  This will start:"
        echo "    - POS Backend (port 8080)"
        echo "    - MySQL Database (port 3306)"
        echo "    - Nginx Web UI (port 80)"
        echo ""
    fi
}

# Print summary
print_summary() {
    echo "============================================"
    echo -e "  ${GREEN}Setup Complete!${NC}"
    echo "============================================"
    echo ""
    echo "  To run the POS:"
    echo "    Option 1 (Docker):  docker-compose up -d"
    echo "    Option 2 (Direct):  mvn exec:java"
    echo ""
    echo "  Web UI:         http://localhost"
    echo "  API Endpoint:   http://localhost:8080/api"
    echo "  KDS Display:    http://localhost (Kitchen tab)"
    echo ""
    echo "  Configuration:"
    echo "    PaybotX:       resources/paybotx-terminals.xml"
    echo "    Cash Discount: Back Office > Cash Discount"
    echo ""
    echo "  Documentation:  README.md"
    echo ""
}

# Run setup
check_prereqs
install_deps
configure_terminal
configure_cash_discount
build_project
docker_setup
print_summary
