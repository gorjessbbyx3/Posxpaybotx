/**
 * Represents a PaybotX/Valor payment terminal device.
 *
 * Each terminal is identified by its terminal ID (TID) and communicates
 * via the Valor Gateway API. Multiple terminals can be configured
 * for multi-register setups.
 */
package com.floreantpos.paybotx;

public class PaybotXTerminal {
	private String terminalId;
	private String merchantId;
	private String apiKey;
	private String ipAddress;
	private int port;
	private String serialNumber;
	private String model;
	private boolean active;

	public PaybotXTerminal() {
		this.port = 8443;
		this.active = true;
	}

	public PaybotXTerminal(String terminalId, String merchantId, String apiKey) {
		this();
		this.terminalId = terminalId;
		this.merchantId = merchantId;
		this.apiKey = apiKey;
	}

	public String getTerminalId() {
		return terminalId;
	}

	public void setTerminalId(String terminalId) {
		this.terminalId = terminalId;
	}

	public String getMerchantId() {
		return merchantId;
	}

	public void setMerchantId(String merchantId) {
		this.merchantId = merchantId;
	}

	public String getApiKey() {
		return apiKey;
	}

	public void setApiKey(String apiKey) {
		this.apiKey = apiKey;
	}

	public String getIpAddress() {
		return ipAddress;
	}

	public void setIpAddress(String ipAddress) {
		this.ipAddress = ipAddress;
	}

	public int getPort() {
		return port;
	}

	public void setPort(int port) {
		this.port = port;
	}

	public String getSerialNumber() {
		return serialNumber;
	}

	public void setSerialNumber(String serialNumber) {
		this.serialNumber = serialNumber;
	}

	public String getModel() {
		return model;
	}

	public void setModel(String model) {
		this.model = model;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	/**
	 * Get the base URL for local terminal communication.
	 * Used when the terminal supports local/LAN API access.
	 */
	public String getLocalBaseUrl() {
		if (ipAddress != null && !ipAddress.isEmpty()) {
			return "https://" + ipAddress + ":" + port;
		}
		return null;
	}

	@Override
	public String toString() {
		return "PaybotXTerminal{" +
				"terminalId='" + terminalId + '\'' +
				", model='" + model + '\'' +
				", active=" + active +
				'}';
	}
}
