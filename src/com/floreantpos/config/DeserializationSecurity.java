/**
 * CVE-2025-10492 mitigation — JasperReports deserialization vulnerability.
 *
 * Installs a JVM-wide ObjectInputFilter that blocks known dangerous classes
 * used in Java deserialization attacks. This provides defense-in-depth on top
 * of the Java 17+ runtime requirement (which already hardens deserialization).
 *
 * Must be called early in main() before any report loading occurs.
 */
package com.floreantpos.config;

import java.io.ObjectInputFilter;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

public class DeserializationSecurity {

	private static final Log logger = LogFactory.getLog(DeserializationSecurity.class);

	private static final String SERIAL_FILTER =
		"!org.apache.commons.collections.functors.*;" +
		"!org.apache.commons.collections4.functors.*;" +
		"!org.apache.xalan.*;" +
		"!com.sun.org.apache.xalan.*;" +
		"!org.codehaus.groovy.runtime.*;" +
		"!org.springframework.*;" +
		"!javax.management.*;" +
		"!com.sun.rowset.*;" +
		"maxdepth=5;maxarray=1000";

	private static boolean installed = false;

	public static synchronized void install() {
		if (installed) {
			return;
		}

		// Only install if no filter was set via -Djdk.serialFilter JVM arg
		if (ObjectInputFilter.Config.getSerialFilter() == null) {
			ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(SERIAL_FILTER);
			ObjectInputFilter.Config.setSerialFilter(filter);
			logger.info("Deserialization filter installed (CVE-2025-10492 mitigation)");
		} else {
			logger.info("JVM deserialization filter already set via system property");
		}

		installed = true;
	}
}
