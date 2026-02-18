FROM maven:3.8-openjdk-11 AS builder

WORKDIR /build
COPY pom.xml .
COPY src/ src/
COPY local-lib/ local-lib/
COPY resources/ resources/
COPY profiles/ profiles/
COPY config/ config/

# Install local dependencies
RUN for jar in local-lib/com/miglayout/miglayout/2.0/miglayout-2.0.jar \
               local-lib/net/xeoh/jspf.core/1.0.2/jspf.core-1.0.2.jar; do \
      if [ -f "$jar" ]; then \
        groupId=$(echo "$jar" | sed 's|local-lib/||;s|/[^/]*/[^/]*/[^/]*$||;s|/|.|g'); \
        artifactId=$(basename "$(dirname "$(dirname "$jar")")"); \
        version=$(basename "$(dirname "$jar")"); \
        mvn install:install-file -Dfile="$jar" -DgroupId="$groupId" \
          -DartifactId="$artifactId" -Dversion="$version" -Dpackaging=jar -q 2>/dev/null || true; \
      fi; \
    done

# Build (allow failures for missing deps in headless env)
RUN mvn package -DskipTests -q 2>/dev/null || true

# --- Runtime ---
FROM openjdk:11-jre-slim

WORKDIR /opt/floreantpos

# Copy build artifacts or raw classes
COPY --from=builder /build/target/ target/ 2>/dev/null || true
COPY --from=builder /build/src/ src/
COPY --from=builder /build/resources/ resources/
COPY --from=builder /build/config/ config/
COPY --from=builder /build/local-lib/ local-lib/

# Copy web frontend
COPY webapp/ webapp/

# Copy database schema
COPY database/ database/

# Expose ports
# 8080 = Web UI / PaybotX Proxy API
# 8000 = Dejavoo Proxy (legacy)
EXPOSE 8080 8000

# Default: start the PaybotX proxy server
CMD ["java", "-cp", "target/classes:local-lib/*", \
     "com.floreantpos.paybotx.proxy.PaybotXProxyServer"]
