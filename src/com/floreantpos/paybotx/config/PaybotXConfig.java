/**
 * Configuration for PaybotX/Valor payment terminal integration.
 *
 * Stores terminal credentials, gateway URLs, and operational settings.
 */
package com.floreantpos.paybotx.config;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import com.floreantpos.PosLog;
import com.floreantpos.config.AppConfig;
import com.floreantpos.paybotx.PaybotXTerminal;

public class PaybotXConfig {

	private static final String GATEWAY_URL = "paybotx.gatewayUrl";
	private static final String MERCHANT_ID = "paybotx.merchantId";
	private static final String API_KEY = "paybotx.apiKey";
	private static final String TERMINAL_ID = "paybotx.terminalId";
	private static final String TERMINAL_IP = "paybotx.terminalIp";
	private static final String TERMINAL_PORT = "paybotx.terminalPort";
	private static final String TERMINAL_MODEL = "paybotx.terminalModel";
	private static final String AUTO_SETTLE = "paybotx.autoSettle";
	private static final String TIP_ON_TERMINAL = "paybotx.tipOnTerminal";
	private static final String PRINT_ON_TERMINAL = "paybotx.printOnTerminal";
	private static final String CLOUD_MODE = "paybotx.cloudMode";

	// Default Valor Gateway URL
	private static final String DEFAULT_GATEWAY_URL = "https://vt.isoaccess.com";

	// Cached terminal list from XML config
	private static List<PaybotXTerminal> terminalList;

	public static String getGatewayUrl() {
		String envVal = System.getenv("PAYBOTX_GATEWAY_URL");
		if (envVal != null && !envVal.isEmpty()) {
			return envVal;
		}
		return AppConfig.getString(GATEWAY_URL, DEFAULT_GATEWAY_URL);
	}

	public static void setGatewayUrl(String url) {
		AppConfig.put(GATEWAY_URL, url);
	}

	public static String getMerchantId() {
		// Environment variable takes priority over config file
		String envVal = System.getenv("PAYBOTX_MERCHANT_ID");
		if (envVal != null && !envVal.isEmpty()) {
			return envVal;
		}
		return AppConfig.getString(MERCHANT_ID, "");
	}

	public static void setMerchantId(String id) {
		AppConfig.put(MERCHANT_ID, id);
	}

	public static String getApiKey() {
		// Environment variable takes priority over config file
		String envVal = System.getenv("PAYBOTX_API_KEY");
		if (envVal != null && !envVal.isEmpty()) {
			return envVal;
		}
		return AppConfig.getString(API_KEY, "");
	}

	public static void setApiKey(String key) {
		AppConfig.put(API_KEY, key);
	}

	public static String getTerminalId() {
		return AppConfig.getString(TERMINAL_ID, "");
	}

	public static void setTerminalId(String id) {
		AppConfig.put(TERMINAL_ID, id);
	}

	public static String getTerminalIp() {
		return AppConfig.getString(TERMINAL_IP, "");
	}

	public static void setTerminalIp(String ip) {
		AppConfig.put(TERMINAL_IP, ip);
	}

	public static int getTerminalPort() {
		try {
			return Integer.parseInt(AppConfig.getString(TERMINAL_PORT, "8443"));
		} catch (NumberFormatException e) {
			return 8443;
		}
	}

	public static void setTerminalPort(int port) {
		AppConfig.put(TERMINAL_PORT, String.valueOf(port));
	}

	public static String getTerminalModel() {
		return AppConfig.getString(TERMINAL_MODEL, "VP8800");
	}

	public static void setTerminalModel(String model) {
		AppConfig.put(TERMINAL_MODEL, model);
	}

	public static boolean isAutoSettle() {
		return AppConfig.getBoolean(AUTO_SETTLE, true);
	}

	public static void setAutoSettle(boolean auto) {
		AppConfig.put(AUTO_SETTLE, auto);
	}

	public static boolean isTipOnTerminal() {
		return AppConfig.getBoolean(TIP_ON_TERMINAL, true);
	}

	public static void setTipOnTerminal(boolean tip) {
		AppConfig.put(TIP_ON_TERMINAL, tip);
	}

	public static boolean isPrintOnTerminal() {
		return AppConfig.getBoolean(PRINT_ON_TERMINAL, false);
	}

	public static void setPrintOnTerminal(boolean print) {
		AppConfig.put(PRINT_ON_TERMINAL, print);
	}

	public static boolean isCloudMode() {
		return AppConfig.getBoolean(CLOUD_MODE, true);
	}

	public static void setCloudMode(boolean cloud) {
		AppConfig.put(CLOUD_MODE, cloud);
	}

	/**
	 * Get the active terminal configuration.
	 * First tries XML config file, then falls back to AppConfig properties.
	 */
	public static PaybotXTerminal getActiveTerminal() {
		// Try XML config first (for multi-terminal setups)
		List<PaybotXTerminal> terminals = getTerminals();
		if (terminals != null && !terminals.isEmpty()) {
			for (PaybotXTerminal t : terminals) {
				if (t.isActive()) {
					return t;
				}
			}
			return terminals.get(0);
		}

		// Fall back to single terminal from AppConfig
		String tid = getTerminalId();
		String mid = getMerchantId();
		String key = getApiKey();

		if (tid.isEmpty() || mid.isEmpty() || key.isEmpty()) {
			return null;
		}

		PaybotXTerminal terminal = new PaybotXTerminal(tid, mid, key);
		terminal.setIpAddress(getTerminalIp());
		terminal.setPort(getTerminalPort());
		terminal.setModel(getTerminalModel());
		return terminal;
	}

	/**
	 * Load terminal list from XML configuration file.
	 * Expected format:
	 * <pre>
	 * &lt;terminals&gt;
	 *   &lt;terminal id="TID001" active="true"&gt;
	 *     &lt;merchantId&gt;MID123&lt;/merchantId&gt;
	 *     &lt;apiKey&gt;KEY123&lt;/apiKey&gt;
	 *     &lt;ipAddress&gt;192.168.1.100&lt;/ipAddress&gt;
	 *     &lt;port&gt;8443&lt;/port&gt;
	 *     &lt;model&gt;VP8800&lt;/model&gt;
	 *   &lt;/terminal&gt;
	 * &lt;/terminals&gt;
	 * </pre>
	 */
	public static List<PaybotXTerminal> getTerminals() {
		if (terminalList != null) {
			return terminalList;
		}

		terminalList = new ArrayList<>();

		try {
			java.net.URL resource = PaybotXConfig.class.getResource("/paybotx-terminals.xml");
			if (resource == null) {
				return terminalList;
			}

			File xmlFile = new File(resource.getFile());
			DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
			DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
			Document document = dBuilder.parse(xmlFile);
			document.getDocumentElement().normalize();

			NodeList nodeList = document.getElementsByTagName("terminal");

			for (int i = 0; i < nodeList.getLength(); i++) {
				Node node = nodeList.item(i);
				if (node.getNodeType() == Node.ELEMENT_NODE) {
					Element element = (Element) node;

					PaybotXTerminal terminal = new PaybotXTerminal();
					terminal.setTerminalId(element.getAttribute("id"));
					terminal.setActive("true".equalsIgnoreCase(element.getAttribute("active")));

					NodeList merchantIdNodes = element.getElementsByTagName("merchantId");
					if (merchantIdNodes.getLength() > 0) {
						terminal.setMerchantId(merchantIdNodes.item(0).getTextContent());
					}

					NodeList apiKeyNodes = element.getElementsByTagName("apiKey");
					if (apiKeyNodes.getLength() > 0) {
						terminal.setApiKey(apiKeyNodes.item(0).getTextContent());
					}

					NodeList ipNodes = element.getElementsByTagName("ipAddress");
					if (ipNodes.getLength() > 0) {
						terminal.setIpAddress(ipNodes.item(0).getTextContent());
					}

					NodeList portNodes = element.getElementsByTagName("port");
					if (portNodes.getLength() > 0) {
						try {
							terminal.setPort(Integer.parseInt(portNodes.item(0).getTextContent()));
						} catch (NumberFormatException e) {
							terminal.setPort(8443);
						}
					}

					NodeList modelNodes = element.getElementsByTagName("model");
					if (modelNodes.getLength() > 0) {
						terminal.setModel(modelNodes.item(0).getTextContent());
					}

					NodeList serialNodes = element.getElementsByTagName("serialNumber");
					if (serialNodes.getLength() > 0) {
						terminal.setSerialNumber(serialNodes.item(0).getTextContent());
					}

					terminalList.add(terminal);
				}
			}
		} catch (Exception e) {
			PosLog.error(PaybotXConfig.class, "Failed to load PaybotX terminal config: " + e.getMessage());
		}

		return terminalList;
	}

	/**
	 * Reload terminal configuration (e.g. after config file change).
	 */
	public static void reloadTerminals() {
		terminalList = null;
	}
}
