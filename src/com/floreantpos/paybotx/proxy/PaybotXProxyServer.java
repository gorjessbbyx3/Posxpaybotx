/**
 * PaybotX Terminal Proxy Server
 *
 * HTTP bridge between PaybotX/Valor payment terminals and Floreant POS,
 * modeled after the existing Dejavoo proxy server architecture.
 *
 * Runs on a configurable port (default 8080) and provides REST-like
 * endpoints for terminal-initiated payment flows:
 *
 *   GET  /api/tickets                - List open tickets
 *   GET  /api/tickets/{id}           - Get ticket detail
 *   GET  /api/tickets/server/{id}    - Tickets by server
 *   GET  /api/tickets/table/{num}    - Tickets by table
 *   POST /api/payment                - Process payment from terminal
 *   POST /api/payment/void           - Void a transaction
 *   POST /api/payment/tip-adjust     - Adjust tip amount
 *   POST /api/batch/settle           - Settle batch
 *   GET  /api/status                 - Terminal/server status
 *
 * Supports both XML and JSON request/response formats.
 */
package com.floreantpos.paybotx.proxy;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.util.Date;
import java.util.List;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;

import com.floreantpos.POSConstants;
import com.floreantpos.config.AppConfig;
import com.floreantpos.main.Application;
import com.floreantpos.model.PaymentStatusFilter;
import com.floreantpos.model.PaymentType;
import com.floreantpos.model.PosTransaction;
import com.floreantpos.model.Ticket;
import com.floreantpos.model.TicketItem;
import com.floreantpos.model.User;
import com.floreantpos.model.dao.TicketDAO;
import com.floreantpos.model.dao.UserDAO;
import com.floreantpos.services.PosTransactionService;
import com.floreantpos.cashdiscount.CashDiscountService;
import com.floreantpos.cashdiscount.CashDiscountCalculator;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

public class PaybotXProxyServer implements HttpHandler {
	private HttpServer server;
	private int port;
	private DecimalFormat amountFormat = new DecimalFormat("0.00");

	// Configurable CORS origin — defaults to localhost, override via env or config
	private String allowedOrigin;

	public PaybotXProxyServer() throws Exception {
		this.port = Integer.parseInt(AppConfig.getString("paybotx.proxy.port", "8080"));
		initCors();
		Application application = Application.getInstance();
		application.initializeSystemHeadless();
	}

	public PaybotXProxyServer(int port) throws Exception {
		this.port = port;
		initCors();
		Application application = Application.getInstance();
		application.initializeSystemHeadless();
	}

	private void initCors() {
		String envOrigin = System.getenv("CORS_ALLOWED_ORIGIN");
		if (envOrigin != null && !envOrigin.isEmpty()) {
			this.allowedOrigin = envOrigin;
		} else {
			this.allowedOrigin = AppConfig.getString("paybotx.cors.origin", "http://localhost");
		}
	}

	public void start() throws Exception {
		InetSocketAddress address = new InetSocketAddress("0.0.0.0", port);
		server = HttpServer.create(address, 50);
		server.createContext("/", this);
		server.setExecutor(java.util.concurrent.Executors.newFixedThreadPool(10));
		server.start();
		System.out.println("PaybotX Proxy Server started on port " + port);
	}

	public void stop() {
		if (server != null) {
			server.stop(5);
			System.out.println("PaybotX Proxy Server stopped");
		}
	}

	public static void main(String[] args) throws Exception {
		PaybotXProxyServer proxyServer;
		if (args.length > 0) {
			proxyServer = new PaybotXProxyServer(Integer.parseInt(args[0]));
		} else {
			proxyServer = new PaybotXProxyServer();
		}
		proxyServer.start();
	}

	@Override
	public void handle(HttpExchange exchange) throws IOException {
		// Restricted CORS headers
		exchange.getResponseHeaders().add("Access-Control-Allow-Origin", allowedOrigin);
		exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");
		exchange.getResponseHeaders().add("Access-Control-Allow-Credentials", "true");

		if ("OPTIONS".equals(exchange.getRequestMethod())) {
			exchange.sendResponseHeaders(204, -1);
			return;
		}

		Thread handler = new Thread(new RequestHandler(exchange));
		handler.start();
	}

	class RequestHandler implements Runnable {
		HttpExchange exchange;

		RequestHandler(HttpExchange exchange) {
			this.exchange = exchange;
		}

		@Override
		public void run() {
			try {
				String path = exchange.getRequestURI().getPath();
				String method = exchange.getRequestMethod();
				String body = readBody(exchange);

				String response;

				// Route requests
				if (path.equals("/api/status") && "GET".equals(method)) {
					response = handleStatus();
				} else if (path.equals("/api/tickets") && "GET".equals(method)) {
					response = handleListTickets();
				} else if (path.matches("/api/tickets/\\d+") && "GET".equals(method)) {
					String id = path.substring(path.lastIndexOf('/') + 1);
					response = handleGetTicket(id);
				} else if (path.matches("/api/tickets/server/\\d+") && "GET".equals(method)) {
					String id = path.substring(path.lastIndexOf('/') + 1);
					response = handleTicketsByServer(id);
				} else if (path.matches("/api/tickets/table/\\d+") && "GET".equals(method)) {
					String num = path.substring(path.lastIndexOf('/') + 1);
					response = handleTicketsByTable(num);
				} else if (path.equals("/api/payment") && "POST".equals(method)) {
					response = handlePayment(body);
				} else if (path.equals("/api/payment/void") && "POST".equals(method)) {
					response = handleVoid(body);
				} else if (path.equals("/api/payment/tip-adjust") && "POST".equals(method)) {
					response = handleTipAdjust(body);
				} else if (path.equals("/api/batch/settle") && "POST".equals(method)) {
					response = handleBatchSettle(body);
				} else {
					response = jsonError("Not Found", 404);
					sendResponse(exchange, response, 404);
					return;
				}

				sendResponse(exchange, response, 200);
			} catch (Exception e) {
				try {
					String error = jsonError(e.getMessage(), 500);
					sendResponse(exchange, error, 500);
				} catch (IOException ex) {
					ex.printStackTrace();
				}
			}
		}
	}

	// --- Handlers ---

	private String handleStatus() {
		StringBuilder json = new StringBuilder();
		json.append("{");
		json.append("\"status\":\"online\",");
		json.append("\"server\":\"PaybotX Proxy\",");
		json.append("\"version\":\"1.0\",");
		json.append("\"timestamp\":\"").append(new Date()).append("\",");
		json.append("\"port\":").append(port);
		json.append("}");
		return json.toString();
	}

	private String handleListTickets() throws Exception {
		List<Ticket> tickets = TicketDAO.getInstance().findOpenTickets();
		return buildTicketListJson(tickets);
	}

	private String handleTicketsByServer(String serverId) throws Exception {
		User user = UserDAO.getInstance().get(Integer.parseInt(serverId));
		List<Ticket> tickets = TicketDAO.getInstance().findTicketsForUser(
				PaymentStatusFilter.OPEN, POSConstants.ALL, user);
		return buildTicketListJson(tickets);
	}

	private String handleTicketsByTable(String tableNum) throws Exception {
		List<Ticket> tickets = TicketDAO.getInstance().findTicketsByTableNum(
				Integer.parseInt(tableNum));
		return buildTicketListJson(tickets);
	}

	private String handleGetTicket(String ticketId) throws Exception {
		Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
		if (ticket == null) {
			return jsonError("Ticket not found", 404);
		}
		return buildTicketDetailJson(ticket);
	}

	private String handlePayment(String body) throws Exception {
		// Parse JSON payment request
		String payType = extractJsonValue(body, "paymentType");
		String ticketId = extractJsonValue(body, "ticketId");
		String amountStr = extractJsonValue(body, "amount");
		String tipsStr = extractJsonValue(body, "tipAmount");
		String refId = extractJsonValue(body, "refId");
		String authCode = extractJsonValue(body, "authCode");
		String cardType = extractJsonValue(body, "cardType");
		String lastFour = extractJsonValue(body, "cardLast4");
		String batchNum = extractJsonValue(body, "batchNum");

		if (StringUtils.isEmpty(ticketId) || StringUtils.isEmpty(amountStr)) {
			return jsonError("ticketId and amount are required", 400);
		}

		Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
		if (ticket == null) {
			return jsonError("Ticket not found", 404);
		}

		double amount = Double.parseDouble(amountStr);
		double tips = 0;

		if (StringUtils.isNotEmpty(tipsStr)) {
			tips = Double.parseDouble(tipsStr);
			amount = amount + tips;
			ticket.setGratuityAmount(tips);
			ticket.calculatePrice();
		}

		// Determine payment type and create transaction
		PosTransaction transaction;
		boolean isCash = "Cash".equalsIgnoreCase(payType);
		boolean isDebit = "Debit".equalsIgnoreCase(payType);

		if (isCash) {
			transaction = PaymentType.CASH.createTransaction();
		} else if (isDebit) {
			transaction = PaymentType.DEBIT_CARD.createTransaction();
		} else {
			transaction = PaymentType.CREDIT_CARD.createTransaction();
		}

		transaction.setTicket(ticket);
		transaction.setAmount(amount);
		transaction.setTenderAmount(amount);
		transaction.setTipsAmount(tips);
		transaction.setCaptured(true);

		if (StringUtils.isNotEmpty(refId)) {
			transaction.setCardTransactionId(refId);
		}
		if (StringUtils.isNotEmpty(authCode)) {
			transaction.setCardAuthCode(authCode);
		}
		if (StringUtils.isNotEmpty(cardType)) {
			transaction.setCardType(cardType);
		}
		if (StringUtils.isNotEmpty(lastFour)) {
			transaction.setCardNumber("****" + lastFour);
		}
		if (StringUtils.isNotEmpty(batchNum)) {
			transaction.addProperty("paybotx.batchNum", batchNum);
		}

		transaction.setCardMerchantGateway("PaybotX/Valor");
		transaction.addProperty("paybotx.gateway", "PaybotX/Valor");

		// Apply cash discount/surcharge if enabled
		CashDiscountService discountService = CashDiscountService.getInstance();
		discountService.applyAdjustment(ticket, transaction);

		// Settle the ticket
		PosTransactionService.getInstance().settleTicket(ticket, transaction);

		// Build response
		StringBuilder json = new StringBuilder();
		json.append("{");
		json.append("\"status\":\"success\",");
		json.append("\"message\":\"Payment processed\",");
		json.append("\"ticketId\":").append(ticket.getId()).append(",");
		json.append("\"amountPaid\":").append(amountFormat.format(transaction.getAmount())).append(",");
		json.append("\"dueAmount\":").append(amountFormat.format(ticket.getDueAmount())).append(",");
		json.append("\"paid\":").append(ticket.isPaid()).append(",");
		json.append("\"closed\":").append(ticket.isClosed());

		// Include cash discount info if applied
		if (discountService.hasAdjustment(ticket)) {
			json.append(",\"cashDiscount\":{");
			json.append("\"label\":\"").append(escapeJson(ticket.getProperty("cashDiscount.label"))).append("\",");
			json.append("\"amount\":").append(ticket.getProperty("cashDiscount.amount")).append(",");
			json.append("\"isDiscount\":").append(ticket.getProperty("cashDiscount.isDiscount"));
			json.append("}");
		}

		json.append("}");
		return json.toString();
	}

	private String handleVoid(String body) throws Exception {
		String ticketId = extractJsonValue(body, "ticketId");
		String transactionId = extractJsonValue(body, "transactionId");

		if (StringUtils.isEmpty(ticketId)) {
			return jsonError("ticketId is required", 400);
		}

		Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
		if (ticket == null) {
			return jsonError("Ticket not found", 404);
		}

		// Find the transaction to void
		Set<PosTransaction> transactions = ticket.getTransactions();
		PosTransaction targetTransaction = null;
		if (transactions != null) {
			for (PosTransaction t : transactions) {
				if (StringUtils.isNotEmpty(transactionId) &&
						transactionId.equals(String.valueOf(t.getId()))) {
					targetTransaction = t;
					break;
				}
			}
		}

		if (targetTransaction == null && transactions != null && !transactions.isEmpty()) {
			// Void the last transaction
			targetTransaction = transactions.iterator().next();
		}

		if (targetTransaction == null) {
			return jsonError("No transaction found to void", 404);
		}

		targetTransaction.setVoided(true);

		return "{\"status\":\"success\",\"message\":\"Transaction voided\"}";
	}

	private String handleTipAdjust(String body) throws Exception {
		String ticketId = extractJsonValue(body, "ticketId");
		String tipAmount = extractJsonValue(body, "tipAmount");

		if (StringUtils.isEmpty(ticketId) || StringUtils.isEmpty(tipAmount)) {
			return jsonError("ticketId and tipAmount are required", 400);
		}

		Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
		if (ticket == null) {
			return jsonError("Ticket not found", 404);
		}

		double tips = Double.parseDouble(tipAmount);
		ticket.setGratuityAmount(tips);
		ticket.calculatePrice();
		TicketDAO.getInstance().saveOrUpdate(ticket);

		return "{\"status\":\"success\",\"message\":\"Tip adjusted\",\"newTipAmount\":" +
				amountFormat.format(tips) + "}";
	}

	private String handleBatchSettle(String body) throws Exception {
		// Batch settlement - close all open tickets that are fully paid
		List<Ticket> tickets = TicketDAO.getInstance().findOpenTickets();
		int settled = 0;
		for (Ticket ticket : tickets) {
			if (ticket.isPaid()) {
				ticket.setClosed(true);
				ticket.setClosingDate(new Date());
				TicketDAO.getInstance().saveOrUpdate(ticket);
				settled++;
			}
		}

		return "{\"status\":\"success\",\"message\":\"Batch settled\"," +
				"\"ticketsSettled\":" + settled + "}";
	}

	// --- JSON builders ---

	private String buildTicketListJson(List<Ticket> tickets) {
		StringBuilder json = new StringBuilder();
		json.append("{\"tickets\":[");

		for (int i = 0; i < tickets.size(); i++) {
			Ticket ticket = tickets.get(i);
			if (i > 0) json.append(",");

			json.append("{");
			json.append("\"id\":").append(ticket.getId()).append(",");

			String name = ticket.getCustomer() == null ?
					(ticket.getOwner() != null ? ticket.getOwner().getFirstName() : "Unknown") :
					ticket.getCustomer().getName();
			json.append("\"name\":\"").append(escapeJson(name)).append("\",");
			json.append("\"totalAmount\":").append(amountFormat.format(ticket.getTotalAmount())).append(",");
			json.append("\"dueAmount\":").append(amountFormat.format(ticket.getDueAmount())).append(",");
			json.append("\"status\":\"").append(ticket.isClosed() ? "closed" : "open").append("\",");

			// Include dual pricing if enabled
			CashDiscountCalculator.PricingAdjustment cashAdj =
					CashDiscountCalculator.calculateForCash(ticket);
			json.append("\"cashPrice\":").append(amountFormat.format(cashAdj.getCashPrice())).append(",");
			json.append("\"cardPrice\":").append(amountFormat.format(cashAdj.getCardPrice()));

			json.append("}");
		}

		json.append("],\"count\":").append(tickets.size()).append("}");
		return json.toString();
	}

	private String buildTicketDetailJson(Ticket ticket) {
		StringBuilder json = new StringBuilder();
		json.append("{");
		json.append("\"id\":").append(ticket.getId()).append(",");

		String name = ticket.getCustomer() == null ?
				(ticket.getOwner() != null ? ticket.getOwner().getFirstName() : "Unknown") :
				ticket.getCustomer().getName();
		json.append("\"name\":\"").append(escapeJson(name)).append("\",");
		json.append("\"subtotalAmount\":").append(amountFormat.format(ticket.getSubtotalAmount())).append(",");
		json.append("\"taxAmount\":").append(amountFormat.format(ticket.getTaxAmount())).append(",");
		json.append("\"totalAmount\":").append(amountFormat.format(ticket.getTotalAmount())).append(",");
		json.append("\"dueAmount\":").append(amountFormat.format(ticket.getDueAmount())).append(",");
		json.append("\"paidAmount\":").append(amountFormat.format(ticket.getPaidAmount())).append(",");
		json.append("\"adjustmentAmount\":").append(amountFormat.format(ticket.getAdjustmentAmount())).append(",");
		json.append("\"status\":\"").append(ticket.isClosed() ? "closed" : "open").append("\",");

		// Items
		json.append("\"items\":[");
		List<TicketItem> items = ticket.getTicketItems();
		if (items != null) {
			for (int i = 0; i < items.size(); i++) {
				TicketItem item = items.get(i);
				if (i > 0) json.append(",");
				json.append("{");
				json.append("\"name\":\"").append(escapeJson(item.getName())).append("\",");
				json.append("\"quantity\":").append(item.getItemCount()).append(",");
				json.append("\"unitPrice\":").append(amountFormat.format(item.getUnitPrice())).append(",");
				json.append("\"totalAmount\":").append(amountFormat.format(item.getTotalAmount()));

				// Dual pricing per item
				double[] dualPrices = CashDiscountCalculator.getDualPrices(item.getUnitPrice());
				json.append(",\"cashPrice\":").append(amountFormat.format(dualPrices[0]));
				json.append(",\"cardPrice\":").append(amountFormat.format(dualPrices[1]));

				json.append("}");
			}
		}
		json.append("],");

		// Transactions
		json.append("\"transactions\":[");
		Set<PosTransaction> transactions = ticket.getTransactions();
		if (transactions != null) {
			int i = 0;
			for (PosTransaction trans : transactions) {
				if (i > 0) json.append(",");
				json.append("{");
				json.append("\"id\":").append(trans.getId()).append(",");
				json.append("\"paymentType\":\"").append(escapeJson(trans.getPaymentType())).append("\",");
				json.append("\"amount\":").append(amountFormat.format(trans.getAmount())).append(",");
				json.append("\"tipAmount\":").append(amountFormat.format(trans.getTipsAmount()));

				if (trans.getCardTransactionId() != null) {
					json.append(",\"refId\":\"").append(escapeJson(trans.getCardTransactionId())).append("\"");
				}
				if (trans.getCardType() != null) {
					json.append(",\"cardType\":\"").append(escapeJson(trans.getCardType())).append("\"");
				}

				json.append("}");
				i++;
			}
		}
		json.append("],");

		// Cash discount pricing
		CashDiscountCalculator.PricingAdjustment cashAdj =
				CashDiscountCalculator.calculateForCash(ticket);
		json.append("\"cashPrice\":").append(amountFormat.format(cashAdj.getCashPrice())).append(",");
		json.append("\"cardPrice\":").append(amountFormat.format(cashAdj.getCardPrice()));

		CashDiscountService discountService = CashDiscountService.getInstance();
		if (discountService.hasAdjustment(ticket)) {
			json.append(",\"appliedDiscount\":{");
			json.append("\"label\":\"").append(escapeJson(ticket.getProperty("cashDiscount.label"))).append("\",");
			json.append("\"amount\":").append(ticket.getProperty("cashDiscount.amount")).append(",");
			json.append("\"isDiscount\":").append(ticket.getProperty("cashDiscount.isDiscount"));
			json.append("}");
		}

		json.append("}");
		return json.toString();
	}

	// --- Utilities ---

	private String readBody(HttpExchange exchange) throws IOException {
		BufferedReader reader = new BufferedReader(
				new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8));
		StringBuilder body = new StringBuilder();
		String line;
		while ((line = reader.readLine()) != null) {
			body.append(line);
		}
		reader.close();
		return body.toString();
	}

	private void sendResponse(HttpExchange exchange, String response, int statusCode) throws IOException {
		exchange.getResponseHeaders().add("Content-Type", "application/json");
		byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
		exchange.sendResponseHeaders(statusCode, bytes.length);
		OutputStream os = exchange.getResponseBody();
		os.write(bytes);
		os.flush();
		os.close();
	}

	private String jsonError(String message, int code) {
		return "{\"status\":\"error\",\"code\":" + code +
				",\"message\":\"" + escapeJson(message) + "\"}";
	}

	/**
	 * Simple JSON value extractor — handles escaped quotes correctly.
	 */
	private String extractJsonValue(String json, String key) {
		String search = "\"" + key + "\"";
		int keyIndex = json.indexOf(search);
		if (keyIndex == -1) return null;

		int colonIndex = json.indexOf(':', keyIndex + search.length());
		if (colonIndex == -1) return null;

		// Skip whitespace after colon
		int valueStart = colonIndex + 1;
		while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
			valueStart++;
		}

		if (valueStart >= json.length()) return null;

		char firstChar = json.charAt(valueStart);

		if (firstChar == '"') {
			// String value — find closing quote, handling escapes
			int pos = valueStart + 1;
			while (pos < json.length()) {
				char ch = json.charAt(pos);
				if (ch == '\\') {
					pos += 2; // skip escaped character
					continue;
				}
				if (ch == '"') {
					return json.substring(valueStart + 1, pos);
				}
				pos++;
			}
			return null;
		} else {
			// Number/boolean/null value
			int valueEnd = valueStart;
			while (valueEnd < json.length() &&
					json.charAt(valueEnd) != ',' &&
					json.charAt(valueEnd) != '}' &&
					json.charAt(valueEnd) != ']') {
				valueEnd++;
			}
			String value = json.substring(valueStart, valueEnd).trim();
			return "null".equals(value) ? null : value;
		}
	}

	private String escapeJson(String input) {
		if (input == null) return "";
		return input
				.replace("\\", "\\\\")
				.replace("\"", "\\\"")
				.replace("\n", "\\n")
				.replace("\r", "\\r")
				.replace("\t", "\\t");
	}
}
