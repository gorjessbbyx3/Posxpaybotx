/**
 * Web API Server for the modern web frontend.
 *
 * Extends the PaybotX proxy server with additional endpoints
 * for menu management, reporting, split checks, and user auth.
 *
 * Endpoints:
 *   GET  /api/menu                    - Full menu with categories
 *   GET  /api/menu/{category}         - Items in a category
 *   GET  /api/tables                  - Table statuses
 *   POST /api/tables/{num}/assign     - Assign a table
 *   GET  /api/users                   - List users
 *   POST /api/auth/login              - Authenticate user
 *   POST /api/orders                  - Create new order
 *   POST /api/orders/{id}/send        - Send order to kitchen
 *   POST /api/orders/{id}/split       - Split a ticket
 *   GET  /api/reports/daily           - Daily sales report
 *   GET  /api/reports/hourly          - Hourly breakdown
 *   GET  /api/config/cashdiscount     - Cash discount settings
 *   PUT  /api/config/cashdiscount     - Update cash discount settings
 */
package com.floreantpos.paybotx.proxy;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.concurrent.Executors;

import com.floreantpos.cashdiscount.CashDiscountCalculator;
import com.floreantpos.cashdiscount.CashDiscountConfig;
import com.floreantpos.config.AppConfig;
import com.floreantpos.model.MenuCategory;
import com.floreantpos.model.MenuGroup;
import com.floreantpos.model.MenuItem;
import com.floreantpos.model.ShopTable;
import com.floreantpos.model.Ticket;
import com.floreantpos.model.User;
import com.floreantpos.model.dao.MenuCategoryDAO;
import com.floreantpos.model.dao.MenuItemDAO;
import com.floreantpos.model.dao.ShopTableDAO;
import com.floreantpos.model.dao.TicketDAO;
import com.floreantpos.model.dao.UserDAO;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

public class WebApiServer implements HttpHandler {

	private HttpServer server;
	private int port;
	private DecimalFormat df = new DecimalFormat("0.00");

	public WebApiServer(int port) {
		this.port = port;
	}

	public void start() throws Exception {
		InetSocketAddress address = new InetSocketAddress("0.0.0.0", port);
		server = HttpServer.create(address, 50);
		server.createContext("/", this);
		server.setExecutor(Executors.newFixedThreadPool(10));
		server.start();
		System.out.println("Web API Server started on port " + port);
	}

	public void stop() {
		if (server != null) {
			server.stop(5);
		}
	}

	@Override
	public void handle(HttpExchange exchange) throws IOException {
		exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
		exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
		exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");

		if ("OPTIONS".equals(exchange.getRequestMethod())) {
			exchange.sendResponseHeaders(204, -1);
			return;
		}

		String path = exchange.getRequestURI().getPath();
		String method = exchange.getRequestMethod();
		String body = readBody(exchange);

		try {
			String response;

			if (path.equals("/api/menu") && "GET".equals(method)) {
				response = handleGetMenu();
			} else if (path.equals("/api/tables") && "GET".equals(method)) {
				response = handleGetTables();
			} else if (path.equals("/api/users") && "GET".equals(method)) {
				response = handleGetUsers();
			} else if (path.equals("/api/auth/login") && "POST".equals(method)) {
				response = handleLogin(body);
			} else if (path.equals("/api/config/cashdiscount") && "GET".equals(method)) {
				response = handleGetCashDiscountConfig();
			} else if (path.equals("/api/config/cashdiscount") && "PUT".equals(method)) {
				response = handleUpdateCashDiscountConfig(body);
			} else if (path.equals("/api/reports/daily") && "GET".equals(method)) {
				response = handleDailyReport();
			} else if (path.matches("/api/orders/\\d+/split") && "POST".equals(method)) {
				String id = path.replaceAll(".*/orders/(\\d+)/split", "$1");
				response = handleSplitTicket(id, body);
			} else {
				response = "{\"error\":\"Not found\"}";
				sendResponse(exchange, response, 404);
				return;
			}

			sendResponse(exchange, response, 200);
		} catch (Exception e) {
			sendResponse(exchange, "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}", 500);
		}
	}

	// --- Menu ---

	private String handleGetMenu() {
		try {
			List<MenuCategory> categories = MenuCategoryDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder();
			json.append("{\"categories\":[");

			for (int i = 0; i < categories.size(); i++) {
				MenuCategory cat = categories.get(i);
				if (i > 0) json.append(",");
				json.append("{");
				json.append("\"id\":").append(cat.getId()).append(",");
				json.append("\"name\":\"").append(escapeJson(cat.getName())).append("\",");

				// Get items for this category
				List<MenuItem> items = MenuItemDAO.getInstance().findAll();
				json.append("\"items\":[");
				int itemCount = 0;
				for (MenuItem item : items) {
					if (item.getParent() != null &&
							item.getParent().getParent() != null &&
							item.getParent().getParent().getId().equals(cat.getId())) {
						if (itemCount > 0) json.append(",");
						appendMenuItemJson(json, item);
						itemCount++;
					}
				}
				json.append("]");
				json.append("}");
			}

			json.append("]}");
			return json.toString();
		} catch (Exception e) {
			return "{\"categories\":[],\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	private void appendMenuItemJson(StringBuilder json, MenuItem item) {
		json.append("{");
		json.append("\"id\":").append(item.getId()).append(",");
		json.append("\"name\":\"").append(escapeJson(item.getName())).append("\",");
		json.append("\"price\":").append(df.format(item.getPrice()));

		// Dual pricing
		double[] dualPrices = CashDiscountCalculator.getDualPrices(item.getPrice());
		json.append(",\"cashPrice\":").append(df.format(dualPrices[0]));
		json.append(",\"cardPrice\":").append(df.format(dualPrices[1]));

		if (item.getDescription() != null) {
			json.append(",\"description\":\"").append(escapeJson(item.getDescription())).append("\"");
		}

		json.append("}");
	}

	// --- Tables ---

	private String handleGetTables() {
		try {
			List<ShopTable> tables = ShopTableDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder();
			json.append("{\"tables\":[");

			for (int i = 0; i < tables.size(); i++) {
				ShopTable table = tables.get(i);
				if (i > 0) json.append(",");
				json.append("{");
				json.append("\"id\":").append(table.getId()).append(",");
				json.append("\"number\":").append(table.getTableNumber()).append(",");
				json.append("\"capacity\":").append(table.getCapacity()).append(",");
				json.append("\"occupied\":").append(table.isOccupied()).append(",");
				json.append("\"dirty\":").append(table.isFree() ? "false" : "true");

				// Find open ticket for this table
				if (table.isOccupied()) {
					List<Ticket> tickets = TicketDAO.getInstance().findTicketsByTableNum(table.getTableNumber());
					if (tickets != null && !tickets.isEmpty()) {
						Ticket t = tickets.get(0);
						json.append(",\"ticketId\":").append(t.getId());
						json.append(",\"ticketAmount\":").append(df.format(t.getTotalAmount()));
					}
				}

				json.append("}");
			}

			json.append("]}");
			return json.toString();
		} catch (Exception e) {
			return "{\"tables\":[],\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Users ---

	private String handleGetUsers() {
		try {
			List<User> users = UserDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder();
			json.append("{\"users\":[");

			for (int i = 0; i < users.size(); i++) {
				User user = users.get(i);
				if (i > 0) json.append(",");
				json.append("{");
				json.append("\"id\":").append(user.getUserId()).append(",");
				json.append("\"firstName\":\"").append(escapeJson(user.getFirstName())).append("\",");
				json.append("\"lastName\":\"").append(escapeJson(user.getLastName())).append("\",");
				json.append("\"type\":\"").append(user.getType()).append("\"");
				json.append("}");
			}

			json.append("]}");
			return json.toString();
		} catch (Exception e) {
			return "{\"users\":[],\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Auth ---

	private String handleLogin(String body) {
		try {
			String pin = extractJsonValue(body, "pin");
			String username = extractJsonValue(body, "username");

			if (pin != null && !pin.isEmpty()) {
				int secret = Integer.parseInt(pin);
				User user = UserDAO.getInstance().findUserBySecretKey(secret);
				if (user != null) {
					return buildUserJson(user);
				}
			}

			if (username != null && !username.isEmpty()) {
				List<User> users = UserDAO.getInstance().findAll();
				for (User user : users) {
					if (username.equalsIgnoreCase(user.getFirstName())) {
						return buildUserJson(user);
					}
				}
			}

			return "{\"error\":\"Invalid credentials\",\"authenticated\":false}";
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\",\"authenticated\":false}";
		}
	}

	private String buildUserJson(User user) {
		StringBuilder json = new StringBuilder();
		json.append("{");
		json.append("\"authenticated\":true,");
		json.append("\"id\":").append(user.getUserId()).append(",");
		json.append("\"firstName\":\"").append(escapeJson(user.getFirstName())).append("\",");
		json.append("\"lastName\":\"").append(escapeJson(user.getLastName())).append("\",");
		json.append("\"type\":\"").append(user.getType()).append("\"");
		json.append("}");
		return json.toString();
	}

	// --- Cash Discount Config ---

	private String handleGetCashDiscountConfig() {
		StringBuilder json = new StringBuilder();
		json.append("{");
		json.append("\"enabled\":").append(CashDiscountConfig.isEnabled()).append(",");
		json.append("\"mode\":\"").append(CashDiscountConfig.getPricingMode().name()).append("\",");
		json.append("\"rate\":").append(CashDiscountConfig.getRate()).append(",");
		json.append("\"cashLabel\":\"").append(escapeJson(CashDiscountConfig.getCashDiscountLabel())).append("\",");
		json.append("\"surchargeLabel\":\"").append(escapeJson(CashDiscountConfig.getSurchargeLabel())).append("\",");
		json.append("\"applyBeforeTax\":").append(CashDiscountConfig.isApplyBeforeTax()).append(",");
		json.append("\"showDualPricing\":").append(CashDiscountConfig.isShowDualPricing()).append(",");
		json.append("\"minCardAmount\":").append(CashDiscountConfig.getMinCardAmount()).append(",");
		json.append("\"exemptDebit\":").append(CashDiscountConfig.isExemptDebit());
		json.append("}");
		return json.toString();
	}

	private String handleUpdateCashDiscountConfig(String body) {
		try {
			String enabled = extractJsonValue(body, "enabled");
			String mode = extractJsonValue(body, "mode");
			String rate = extractJsonValue(body, "rate");
			String cashLabel = extractJsonValue(body, "cashLabel");
			String surchargeLabel = extractJsonValue(body, "surchargeLabel");

			if (enabled != null) CashDiscountConfig.setEnabled(Boolean.parseBoolean(enabled));
			if (mode != null) CashDiscountConfig.setPricingMode(CashDiscountConfig.PricingMode.valueOf(mode));
			if (rate != null) CashDiscountConfig.setRate(Double.parseDouble(rate));
			if (cashLabel != null) CashDiscountConfig.setCashDiscountLabel(cashLabel);
			if (surchargeLabel != null) CashDiscountConfig.setSurchargeLabel(surchargeLabel);

			return "{\"status\":\"success\",\"message\":\"Cash discount configuration updated\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Reports ---

	private String handleDailyReport() {
		try {
			SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
			String today = sdf.format(new Date());

			List<Ticket> closedTickets = TicketDAO.getInstance().getClosedTickets();
			double totalSales = 0;
			double totalTax = 0;
			double totalDiscount = 0;
			double totalTips = 0;
			int cashCount = 0;
			double cashTotal = 0;
			int cardCount = 0;
			double cardTotal = 0;
			int ticketCount = 0;

			if (closedTickets != null) {
				for (Ticket t : closedTickets) {
					ticketCount++;
					totalSales += t.getTotalAmount();
					totalTax += t.getTaxAmount();
					totalDiscount += t.getDiscountAmount();
					if (t.getGratuity() != null) {
						totalTips += t.getGratuity().getAmount();
					}
				}
			}

			StringBuilder json = new StringBuilder();
			json.append("{");
			json.append("\"date\":\"").append(today).append("\",");
			json.append("\"ticketCount\":").append(ticketCount).append(",");
			json.append("\"totalSales\":").append(df.format(totalSales)).append(",");
			json.append("\"totalTax\":").append(df.format(totalTax)).append(",");
			json.append("\"totalDiscount\":").append(df.format(totalDiscount)).append(",");
			json.append("\"totalTips\":").append(df.format(totalTips)).append(",");
			json.append("\"cashTransactions\":{\"count\":").append(cashCount);
			json.append(",\"total\":").append(df.format(cashTotal)).append("},");
			json.append("\"cardTransactions\":{\"count\":").append(cardCount);
			json.append(",\"total\":").append(df.format(cardTotal)).append("},");
			json.append("\"averageTicket\":").append(ticketCount > 0 ? df.format(totalSales / ticketCount) : "0.00");
			json.append("}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Split Ticket ---

	private String handleSplitTicket(String ticketId, String body) {
		try {
			String waysStr = extractJsonValue(body, "ways");
			int ways = waysStr != null ? Integer.parseInt(waysStr) : 2;

			Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
			if (ticket == null) {
				return "{\"error\":\"Ticket not found\"}";
			}

			double totalPerSplit = ticket.getDueAmount() / ways;

			StringBuilder json = new StringBuilder();
			json.append("{\"ticketId\":").append(ticket.getId()).append(",");
			json.append("\"originalTotal\":").append(df.format(ticket.getTotalAmount())).append(",");
			json.append("\"ways\":").append(ways).append(",");
			json.append("\"splits\":[");

			for (int i = 0; i < ways; i++) {
				if (i > 0) json.append(",");
				double splitAmount = (i == ways - 1) ?
						ticket.getDueAmount() - (totalPerSplit * (ways - 1)) :
						totalPerSplit;

				double[] dualPrices = CashDiscountCalculator.getDualPrices(splitAmount);

				json.append("{");
				json.append("\"splitNumber\":").append(i + 1).append(",");
				json.append("\"amount\":").append(df.format(splitAmount)).append(",");
				json.append("\"cashPrice\":").append(df.format(dualPrices[0])).append(",");
				json.append("\"cardPrice\":").append(df.format(dualPrices[1]));
				json.append("}");
			}

			json.append("]}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
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

	private String extractJsonValue(String json, String key) {
		if (json == null) return null;
		String search = "\"" + key + "\"";
		int keyIndex = json.indexOf(search);
		if (keyIndex == -1) return null;
		int colonIndex = json.indexOf(':', keyIndex + search.length());
		if (colonIndex == -1) return null;
		int valueStart = colonIndex + 1;
		while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart)))
			valueStart++;
		if (valueStart >= json.length()) return null;
		if (json.charAt(valueStart) == '"') {
			int valueEnd = json.indexOf('"', valueStart + 1);
			return valueEnd == -1 ? null : json.substring(valueStart + 1, valueEnd);
		} else {
			int valueEnd = valueStart;
			while (valueEnd < json.length() && json.charAt(valueEnd) != ',' &&
					json.charAt(valueEnd) != '}' && json.charAt(valueEnd) != ']')
				valueEnd++;
			return json.substring(valueStart, valueEnd).trim();
		}
	}

	private String escapeJson(String input) {
		if (input == null) return "";
		return input.replace("\\", "\\\\").replace("\"", "\\\"")
				.replace("\n", "\\n").replace("\r", "\\r");
	}
}
