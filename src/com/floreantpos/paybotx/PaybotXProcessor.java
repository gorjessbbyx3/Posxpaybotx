/**
 * CardProcessor implementation for PaybotX/Valor payment terminals.
 *
 * Communicates with external PaybotX terminals via HTTP/REST API.
 * Supports sale, pre-auth, capture, void, and tip adjustment operations.
 *
 * The processor sends transaction requests to the Valor Gateway or directly
 * to a local terminal (if configured for LAN communication).
 */
package com.floreantpos.paybotx;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathFactory;

import org.apache.commons.lang3.StringUtils;
import org.w3c.dom.Document;
import org.xml.sax.InputSource;

import com.floreantpos.PosLog;
import com.floreantpos.model.PosTransaction;
import com.floreantpos.paybotx.config.PaybotXConfig;
import com.floreantpos.ui.views.payment.CardProcessor;

import java.io.StringReader;

public class PaybotXProcessor implements CardProcessor {

	private static final DecimalFormat AMOUNT_FORMAT = new DecimalFormat("0.00");
	private static final int TIMEOUT_MS = 120000; // 2 minutes for terminal interaction

	private volatile boolean cancelled = false;

	@Override
	public void preAuth(PosTransaction transaction) throws Exception {
		cancelled = false;
		String amount = formatAmount(transaction.getAmount());
		String tipsAmount = formatAmount(transaction.getTipsAmount());

		PaybotXTerminal terminal = getTerminal();

		String requestXml = buildTransactionRequest(
				"PreAuth",
				amount,
				tipsAmount,
				String.valueOf(transaction.getTicket().getId()),
				terminal);

		String response = sendToTerminal(requestXml, terminal);
		processResponse(response, transaction);
	}

	@Override
	public void captureAuthAmount(PosTransaction transaction) throws Exception {
		cancelled = false;
		String amount = formatAmount(transaction.getAmount());
		String tipsAmount = formatAmount(transaction.getTipsAmount());

		PaybotXTerminal terminal = getTerminal();

		String requestXml = buildCaptureRequest(
				amount,
				tipsAmount,
				transaction.getCardTransactionId(),
				terminal);

		String response = sendToTerminal(requestXml, terminal);
		processCaptureResponse(response, transaction);
	}

	@Override
	public void chargeAmount(PosTransaction transaction) throws Exception {
		cancelled = false;
		String amount = formatAmount(transaction.getAmount());
		String tipsAmount = formatAmount(transaction.getTipsAmount());

		PaybotXTerminal terminal = getTerminal();

		String requestXml = buildTransactionRequest(
				"Sale",
				amount,
				tipsAmount,
				String.valueOf(transaction.getTicket().getId()),
				terminal);

		String response = sendToTerminal(requestXml, terminal);
		processResponse(response, transaction);

		transaction.setCaptured(true);
	}

	@Override
	public void voidTransaction(PosTransaction transaction) throws Exception {
		cancelled = false;
		PaybotXTerminal terminal = getTerminal();

		String requestXml = buildVoidRequest(
				transaction.getCardTransactionId(),
				terminal);

		String response = sendToTerminal(requestXml, terminal);
		processVoidResponse(response, transaction);
	}

	@Override
	public String getCardInformationForReceipt(PosTransaction transaction) {
		StringBuilder sb = new StringBuilder();

		String cardType = transaction.getCardType();
		if (StringUtils.isNotEmpty(cardType)) {
			sb.append(cardType);
		}

		String cardNumber = transaction.getCardNumber();
		if (StringUtils.isNotEmpty(cardNumber)) {
			// Only show last 4 digits
			if (cardNumber.length() > 4) {
				sb.append(" ****").append(cardNumber.substring(cardNumber.length() - 4));
			} else {
				sb.append(" ").append(cardNumber);
			}
		}

		String authCode = transaction.getCardAuthCode();
		if (StringUtils.isNotEmpty(authCode)) {
			sb.append(" Auth: ").append(authCode);
		}

		String transId = transaction.getCardTransactionId();
		if (StringUtils.isNotEmpty(transId)) {
			sb.append(" Ref: ").append(transId);
		}

		return sb.toString();
	}

	@Override
	public void cancelTransaction() {
		cancelled = true;
		PosLog.info(PaybotXProcessor.class, "Transaction cancelled by user");
	}

	@Override
	public boolean supportTipsAdjustMent() {
		return true;
	}

	@Override
	public void adjustTips(PosTransaction transaction) throws Exception {
		cancelled = false;
		PaybotXTerminal terminal = getTerminal();
		String tipsAmount = formatAmount(transaction.getTipsAmount());

		String requestXml = buildTipAdjustRequest(
				transaction.getCardTransactionId(),
				tipsAmount,
				terminal);

		String response = sendToTerminal(requestXml, terminal);
		processTipAdjustResponse(response, transaction);
	}

	// --- Request builders ---

	private String buildTransactionRequest(String transType, String amount, String tips,
			String invoiceNum, PaybotXTerminal terminal) {
		StringBuilder xml = new StringBuilder();
		xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
		xml.append("<PaybotXRequest>");
		xml.append("<MerchantId>").append(escapeXml(terminal.getMerchantId())).append("</MerchantId>");
		xml.append("<TerminalId>").append(escapeXml(terminal.getTerminalId())).append("</TerminalId>");
		xml.append("<ApiKey>").append(escapeXml(terminal.getApiKey())).append("</ApiKey>");
		xml.append("<TransType>").append(transType).append("</TransType>");
		xml.append("<Amount>").append(amount).append("</Amount>");
		if (tips != null && !"0.00".equals(tips)) {
			xml.append("<TipAmount>").append(tips).append("</TipAmount>");
		}
		xml.append("<InvoiceNum>").append(escapeXml(invoiceNum)).append("</InvoiceNum>");
		xml.append("<EntryMode>EMV</EntryMode>");
		xml.append("</PaybotXRequest>");
		return xml.toString();
	}

	private String buildCaptureRequest(String amount, String tips, String refId,
			PaybotXTerminal terminal) {
		StringBuilder xml = new StringBuilder();
		xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
		xml.append("<PaybotXRequest>");
		xml.append("<MerchantId>").append(escapeXml(terminal.getMerchantId())).append("</MerchantId>");
		xml.append("<TerminalId>").append(escapeXml(terminal.getTerminalId())).append("</TerminalId>");
		xml.append("<ApiKey>").append(escapeXml(terminal.getApiKey())).append("</ApiKey>");
		xml.append("<TransType>Capture</TransType>");
		xml.append("<Amount>").append(amount).append("</Amount>");
		if (tips != null && !"0.00".equals(tips)) {
			xml.append("<TipAmount>").append(tips).append("</TipAmount>");
		}
		xml.append("<RefId>").append(escapeXml(refId)).append("</RefId>");
		xml.append("</PaybotXRequest>");
		return xml.toString();
	}

	private String buildVoidRequest(String refId, PaybotXTerminal terminal) {
		StringBuilder xml = new StringBuilder();
		xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
		xml.append("<PaybotXRequest>");
		xml.append("<MerchantId>").append(escapeXml(terminal.getMerchantId())).append("</MerchantId>");
		xml.append("<TerminalId>").append(escapeXml(terminal.getTerminalId())).append("</TerminalId>");
		xml.append("<ApiKey>").append(escapeXml(terminal.getApiKey())).append("</ApiKey>");
		xml.append("<TransType>Void</TransType>");
		xml.append("<RefId>").append(escapeXml(refId)).append("</RefId>");
		xml.append("</PaybotXRequest>");
		return xml.toString();
	}

	private String buildTipAdjustRequest(String refId, String tipAmount, PaybotXTerminal terminal) {
		StringBuilder xml = new StringBuilder();
		xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
		xml.append("<PaybotXRequest>");
		xml.append("<MerchantId>").append(escapeXml(terminal.getMerchantId())).append("</MerchantId>");
		xml.append("<TerminalId>").append(escapeXml(terminal.getTerminalId())).append("</TerminalId>");
		xml.append("<ApiKey>").append(escapeXml(terminal.getApiKey())).append("</ApiKey>");
		xml.append("<TransType>TipAdjust</TransType>");
		xml.append("<RefId>").append(escapeXml(refId)).append("</RefId>");
		xml.append("<TipAmount>").append(tipAmount).append("</TipAmount>");
		xml.append("</PaybotXRequest>");
		return xml.toString();
	}

	// --- Response processors ---

	private void processResponse(String response, PosTransaction transaction) throws Exception {
		String status = getXpathValue("/PaybotXResponse/Status", response);
		String message = getXpathValue("/PaybotXResponse/Message", response);

		if (!"Approved".equalsIgnoreCase(status) && !"Success".equalsIgnoreCase(status)) {
			throw new Exception("PaybotX transaction declined: " + message);
		}

		String refId = getXpathValue("/PaybotXResponse/RefId", response);
		String authCode = getXpathValue("/PaybotXResponse/AuthCode", response);
		String cardType = getXpathValue("/PaybotXResponse/CardType", response);
		String lastFour = getXpathValue("/PaybotXResponse/CardLast4", response);
		String batchNum = getXpathValue("/PaybotXResponse/BatchNum", response);
		String entryMode = getXpathValue("/PaybotXResponse/EntryMode", response);
		String cardHolderName = getXpathValue("/PaybotXResponse/CardHolderName", response);
		String aid = getXpathValue("/PaybotXResponse/AID", response);
		String arqc = getXpathValue("/PaybotXResponse/ARQC", response);

		transaction.setCardTransactionId(refId);
		transaction.setCardAuthCode(authCode);

		if (StringUtils.isNotEmpty(cardType)) {
			transaction.setCardType(cardType);
		}
		if (StringUtils.isNotEmpty(lastFour)) {
			transaction.setCardNumber("****" + lastFour);
		}
		if (StringUtils.isNotEmpty(cardHolderName)) {
			transaction.setCardHolderName(cardHolderName);
		}
		if (StringUtils.isNotEmpty(aid)) {
			transaction.setCardAID(aid);
		}
		if (StringUtils.isNotEmpty(arqc)) {
			transaction.setCardARQC(arqc);
		}
		if (StringUtils.isNotEmpty(entryMode)) {
			transaction.setCardReader(entryMode);
		}

		transaction.addProperty("paybotx.batchNum", batchNum);
		transaction.addProperty("paybotx.refId", refId);
		transaction.addProperty("paybotx.gateway", "PaybotX/Valor");

		transaction.setCardMerchantGateway("PaybotX/Valor");

		PosLog.info(PaybotXProcessor.class,
				"PaybotX {} approved: ref={}, auth={}, card={}",
				status, refId, authCode, cardType);
	}

	private void processCaptureResponse(String response, PosTransaction transaction) throws Exception {
		String status = getXpathValue("/PaybotXResponse/Status", response);
		String message = getXpathValue("/PaybotXResponse/Message", response);

		if (!"Approved".equalsIgnoreCase(status) && !"Success".equalsIgnoreCase(status)) {
			throw new Exception("PaybotX capture failed: " + message);
		}

		transaction.setCaptured(true);
		PosLog.info(PaybotXProcessor.class, "PaybotX capture approved for ref: {}",
				transaction.getCardTransactionId());
	}

	private void processVoidResponse(String response, PosTransaction transaction) throws Exception {
		String status = getXpathValue("/PaybotXResponse/Status", response);
		String message = getXpathValue("/PaybotXResponse/Message", response);

		if (!"Approved".equalsIgnoreCase(status) && !"Success".equalsIgnoreCase(status)) {
			throw new Exception("PaybotX void failed: " + message);
		}

		transaction.setVoided(true);
		PosLog.info(PaybotXProcessor.class, "PaybotX void approved for ref: {}",
				transaction.getCardTransactionId());
	}

	private void processTipAdjustResponse(String response, PosTransaction transaction) throws Exception {
		String status = getXpathValue("/PaybotXResponse/Status", response);
		String message = getXpathValue("/PaybotXResponse/Message", response);

		if (!"Approved".equalsIgnoreCase(status) && !"Success".equalsIgnoreCase(status)) {
			throw new Exception("PaybotX tip adjustment failed: " + message);
		}

		PosLog.info(PaybotXProcessor.class, "PaybotX tip adjustment approved for ref: {}",
				transaction.getCardTransactionId());
	}

	// --- Communication ---

	private String sendToTerminal(String requestXml, PaybotXTerminal terminal) throws Exception {
		String endpoint;

		// Prefer local terminal communication if IP is configured
		String localUrl = terminal.getLocalBaseUrl();
		if (localUrl != null) {
			endpoint = localUrl + "/api/v1/transaction";
		} else {
			// Fall back to Valor Gateway cloud endpoint
			endpoint = PaybotXConfig.getGatewayUrl() + "/api/v1/transaction";
		}

		PosLog.info(PaybotXProcessor.class, "Sending PaybotX request to: {}", endpoint);

		URL url = new URL(endpoint);
		HttpURLConnection connection = (HttpURLConnection) url.openConnection();

		try {
			connection.setRequestMethod("POST");
			connection.setRequestProperty("Content-Type", "application/xml");
			connection.setRequestProperty("Accept", "application/xml");
			connection.setRequestProperty("X-Api-Key", terminal.getApiKey());
			connection.setRequestProperty("X-Terminal-Id", terminal.getTerminalId());
			connection.setDoOutput(true);
			connection.setConnectTimeout(TIMEOUT_MS);
			connection.setReadTimeout(TIMEOUT_MS);

			// Send request
			byte[] requestBytes = requestXml.getBytes(StandardCharsets.UTF_8);
			try (OutputStream os = connection.getOutputStream()) {
				os.write(requestBytes);
				os.flush();
			}

			// Check for cancellation
			if (cancelled) {
				connection.disconnect();
				throw new Exception("Transaction cancelled by user");
			}

			// Read response
			int responseCode = connection.getResponseCode();
			BufferedReader reader;

			if (responseCode >= 200 && responseCode < 300) {
				reader = new BufferedReader(
						new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
			} else {
				reader = new BufferedReader(
						new InputStreamReader(connection.getErrorStream(), StandardCharsets.UTF_8));
			}

			StringBuilder response = new StringBuilder();
			String line;
			while ((line = reader.readLine()) != null) {
				response.append(line);
			}
			reader.close();

			String responseStr = response.toString();
			PosLog.info(PaybotXProcessor.class, "PaybotX response (HTTP {}): {}", responseCode, responseStr);

			if (responseCode < 200 || responseCode >= 300) {
				throw new Exception("PaybotX communication error (HTTP " + responseCode + "): " + responseStr);
			}

			return responseStr;

		} finally {
			connection.disconnect();
		}
	}

	// --- Utilities ---

	private PaybotXTerminal getTerminal() throws Exception {
		PaybotXTerminal terminal = PaybotXConfig.getActiveTerminal();
		if (terminal == null) {
			throw new Exception("No PaybotX terminal configured. Please configure a terminal in the back office.");
		}
		return terminal;
	}

	private String formatAmount(double amount) {
		return AMOUNT_FORMAT.format(amount);
	}

	private String getXpathValue(String xpath, String xml) {
		try {
			XPathFactory xPathFactory = XPathFactory.newInstance();
			XPath newXPath = xPathFactory.newXPath();
			return newXPath.evaluate(xpath, new InputSource(new StringReader(xml)));
		} catch (Exception e) {
			return "";
		}
	}

	private String escapeXml(String input) {
		if (input == null) return "";
		return input
				.replace("&", "&amp;")
				.replace("<", "&lt;")
				.replace(">", "&gt;")
				.replace("\"", "&quot;")
				.replace("'", "&apos;");
	}
}
