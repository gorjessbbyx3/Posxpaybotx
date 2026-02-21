FROM maven:3.9-eclipse-temurin-17 AS builder

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
          -DartifactId="$artifactId" -Dversion="$version" -Dpackaging=jar -q \
          || echo "WARNING: Failed to install $jar"; \
      else \
        echo "WARNING: Local dependency not found: $jar"; \
      fi; \
    done

# Build — fail loudly if compilation fails
RUN mvn package -DskipTests

# --- Runtime ---
FROM eclipse-temurin:17-jre

WORKDIR /opt/floreantpos

# Copy build artifacts or raw classes
# Copy build artifacts
COPY --from=builder /build/target/ target/
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
# CVE-2025-10492: JVM deserialization filter restricts classes that can be deserialized.
# Java 17+ also provides built-in deserialization protections that mitigate this CVE.
CMD ["java", \
     "-Djdk.serialFilter=!org.apache.commons.collections.functors.*;!org.apache.xalan.*;!com.sun.org.apache.xalan.*;!org.codehaus.groovy.runtime.*;!org.springframework.*;!javax.management.*;maxdepth=5;maxarray=1000", \
     "-cp", "target/classes:local-lib/*", \
     "com.floreantpos.paybotx.proxy.PaybotXProxyServer"]
