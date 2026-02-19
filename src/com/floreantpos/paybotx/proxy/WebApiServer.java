/**
 * Web API Server for the modern web frontend.
 *
 * Extends the PaybotX proxy server with additional endpoints
 * for menu management, reporting, split checks, user auth,
 * kitchen display, order lifecycle, and tip management.
 *
 * SECURITY:
 *   - Token-based authentication via SessionManager
 *   - CORS restricted to configured origin
 *   - PIN-based login validates against stored secret key
 *   - /api/users requires manager-level auth
 *
 * Endpoints:
 *   POST /api/auth/login              - Authenticate user (public)
 *   POST /api/auth/logout             - Invalidate session
 *   GET  /api/menu                    - Full menu with categories
 *   GET  /api/tables                  - Table statuses
 *   GET  /api/users                   - List users (manager only)
 *   POST /api/orders                  - Create new order
 *   POST /api/orders/{id}/items       - Add items to order
 *   POST /api/orders/{id}/send        - Send order to kitchen
 *   POST /api/orders/{id}/split       - Split a ticket
 *   GET  /api/kitchen                 - Get kitchen tickets (KDS)
 *   POST /api/kitchen/{id}/bump       - Bump a kitchen ticket
 *   POST /api/kitchen/{id}/recall     - Recall a bumped ticket
 *   GET  /api/reports/daily           - Daily sales report
 *   GET  /api/reports/hourly          - Hourly breakdown
 *   GET  /api/config/cashdiscount     - Cash discount settings
 *   PUT  /api/config/cashdiscount     - Update cash discount settings (manager only)
 *   POST /api/tips/adjust             - Adjust tip on a ticket
 *   POST /api/tips/preset             - Get preset tip amounts
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
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;

import com.floreantpos.cashdiscount.CashDiscountCalculator;
import com.floreantpos.cashdiscount.CashDiscountConfig;
import com.floreantpos.config.AppConfig;
import com.floreantpos.model.Gratuity;
import com.floreantpos.model.KitchenTicket;
import com.floreantpos.model.KitchenTicket.KitchenTicketStatus;
import com.floreantpos.model.KitchenTicketItem;
import com.floreantpos.model.MenuCategory;
import com.floreantpos.model.MenuGroup;
import com.floreantpos.model.MenuItem;
import com.floreantpos.model.OrderType;
import com.floreantpos.model.PosTransaction;
import com.floreantpos.model.ShopTable;
import com.floreantpos.model.Ticket;
import com.floreantpos.model.TicketItem;
import com.floreantpos.model.User;
import com.floreantpos.model.dao.KitchenTicketDAO;
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
	private SessionManager sessionManager = SessionManager.getInstance();

	// Configurable CORS origin — defaults to same-host, override via env or config
	private String allowedOrigin;

	public WebApiServer(int port) {
		this.port = port;
		// Read allowed origin from env > config > default
		String envOrigin = System.getenv("CORS_ALLOWED_ORIGIN");
		if (envOrigin != null && !envOrigin.isEmpty()) {
			this.allowedOrigin = envOrigin;
		} else {
			this.allowedOrigin = AppConfig.getString("webapi.cors.origin", "http://localhost");
		}
	}

	public void start() throws Exception {
		InetSocketAddress address = new InetSocketAddress("0.0.0.0", port);
		server = HttpServer.create(address, 50);
		server.createContext("/", this);
		server.setExecutor(Executors.newFixedThreadPool(10));
		server.start();
		System.out.println("Web API Server started on port " + port);
		System.out.println("CORS allowed origin: " + allowedOrigin);
	}

	public void stop() {
		if (server != null) {
			server.stop(5);
		}
	}

	@Override
	public void handle(HttpExchange exchange) throws IOException {
		// Restricted CORS headers
		exchange.getResponseHeaders().add("Access-Control-Allow-Origin", allowedOrigin);
		exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
		exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");
		exchange.getResponseHeaders().add("Access-Control-Allow-Credentials", "true");

		if ("OPTIONS".equals(exchange.getRequestMethod())) {
			exchange.sendResponseHeaders(204, -1);
			return;
		}

		String path = exchange.getRequestURI().getPath();
		String method = exchange.getRequestMethod();
		String body = readBody(exchange);
		String authHeader = exchange.getRequestHeaders().getFirst("Authorization");

		try {
			String response;

			// --- Public endpoints (no auth required) ---
			if (path.equals("/api/auth/login") && "POST".equals(method)) {
				response = handleLogin(body);
				sendResponse(exchange, response, 200);
				return;
			}

			// --- All other endpoints require authentication ---
			SessionManager.Session session = sessionManager.validateToken(authHeader);
			if (session == null) {
				sendResponse(exchange, "{\"error\":\"Authentication required\",\"code\":401}", 401);
				return;
			}

			// Route authenticated requests
			if (path.equals("/api/auth/logout") && "POST".equals(method)) {
				sessionManager.invalidateSession(authHeader);
				response = "{\"status\":\"success\",\"message\":\"Logged out\"}";
			} else if (path.equals("/api/menu") && "GET".equals(method)) {
				response = handleGetMenu();
			} else if (path.equals("/api/tables") && "GET".equals(method)) {
				response = handleGetTables();
			} else if (path.equals("/api/users") && "GET".equals(method)) {
				// Manager-only endpoint
				if (!session.isManager()) {
					sendResponse(exchange, "{\"error\":\"Manager access required\",\"code\":403}", 403);
					return;
				}
				response = handleGetUsers();
			} else if (path.equals("/api/config/cashdiscount") && "GET".equals(method)) {
				response = handleGetCashDiscountConfig();
			} else if (path.equals("/api/config/cashdiscount") && "PUT".equals(method)) {
				if (!session.isManager()) {
					sendResponse(exchange, "{\"error\":\"Manager access required\",\"code\":403}", 403);
					return;
				}
				response = handleUpdateCashDiscountConfig(body);
			} else if (path.equals("/api/reports/daily") && "GET".equals(method)) {
				response = handleDailyReport();
			} else if (path.equals("/api/reports/hourly") && "GET".equals(method)) {
				response = handleHourlyReport();
			} else if (path.matches("/api/orders/\\d+/split") && "POST".equals(method)) {
				String id = path.replaceAll(".*/orders/(\\d+)/split", "$1");
				response = handleSplitTicket(id, body);
			} else if (path.equals("/api/orders") && "POST".equals(method)) {
				response = handleCreateOrder(body, session);
			} else if (path.matches("/api/orders/\\d+/items") && "POST".equals(method)) {
				String id = path.replaceAll(".*/orders/(\\d+)/items", "$1");
				response = handleAddItems(id, body);
			} else if (path.matches("/api/orders/\\d+/send") && "POST".equals(method)) {
				String id = path.replaceAll(".*/orders/(\\d+)/send", "$1");
				response = handleSendToKitchen(id);
			} else if (path.equals("/api/kitchen") && "GET".equals(method)) {
				response = handleGetKitchenTickets();
			} else if (path.matches("/api/kitchen/\\d+/bump") && "POST".equals(method)) {
				String id = path.replaceAll(".*/kitchen/(\\d+)/bump", "$1");
				response = handleBumpKitchenTicket(id);
			} else if (path.matches("/api/kitchen/\\d+/recall") && "POST".equals(method)) {
				String id = path.replaceAll(".*/kitchen/(\\d+)/recall", "$1");
				response = handleRecallKitchenTicket(id);
			} else if (path.equals("/api/tips/adjust") && "POST".equals(method)) {
				response = handleTipAdjust(body);
			} else if (path.equals("/api/tips/presets") && "POST".equals(method)) {
				response = handleTipPresets(body);
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

	// --- Menu (fixed N+1 query) ---

	private String handleGetMenu() {
		try {
			List<MenuCategory> categories = MenuCategoryDAO.getInstance().findAll();
			// Single load of all menu items — avoids N+1 query per category
			List<MenuItem> allItems = MenuItemDAO.getInstance().findAll();

			// Group items by category ID
			Map<Integer, List<MenuItem>> itemsByCategory = new HashMap<>();
			for (MenuItem item : allItems) {
				if (item.getParent() != null &&
						item.getParent().getParent() != null) {
					Integer catId = item.getParent().getParent().getId();
					itemsByCategory.computeIfAbsent(catId, k -> new ArrayList<>()).add(item);
				}
			}

			StringBuilder json = new StringBuilder();
			json.append("{\"categories\":[");

			for (int i = 0; i < categories.size(); i++) {
				MenuCategory cat = categories.get(i);
				if (i > 0) json.append(",");
				json.append("{");
				json.append("\"id\":").append(cat.getId()).append(",");
				json.append("\"name\":\"").append(escapeJson(cat.getName())).append("\",");

				json.append("\"items\":[");
				List<MenuItem> catItems = itemsByCategory.get(cat.getId());
				if (catItems != null) {
					for (int j = 0; j < catItems.size(); j++) {
						if (j > 0) json.append(",");
						appendMenuItemJson(json, catItems.get(j));
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

	// --- Users (manager-only, no secret keys exposed) ---

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

	// --- Auth (validates PIN against stored secret key) ---

	private String handleLogin(String body) {
		try {
			Map<String, String> params = parseJson(body);
			String pin = params.get("pin");

			if (pin == null || pin.isEmpty()) {
				return "{\"error\":\"PIN is required\",\"authenticated\":false}";
			}

			// Validate PIN length (prevent brute-force via absurd inputs)
			if (pin.length() < 1 || pin.length() > 10) {
				return "{\"error\":\"Invalid PIN format\",\"authenticated\":false}";
			}

			int secret;
			try {
				secret = Integer.parseInt(pin);
			} catch (NumberFormatException e) {
				return "{\"error\":\"PIN must be numeric\",\"authenticated\":false}";
			}

			// Authenticate against the user's stored secret key
			User user = UserDAO.getInstance().findUserBySecretKey(secret);
			if (user == null) {
				// Small delay to slow brute-force attempts
				try { Thread.sleep(500); } catch (InterruptedException ignored) {}
				return "{\"error\":\"Invalid PIN\",\"authenticated\":false}";
			}

			// Create session token
			String token = sessionManager.createSession(user);

			StringBuilder json = new StringBuilder();
			json.append("{");
			json.append("\"authenticated\":true,");
			json.append("\"token\":\"").append(token).append("\",");
			json.append("\"id\":").append(user.getUserId()).append(",");
			json.append("\"firstName\":\"").append(escapeJson(user.getFirstName())).append("\",");
			json.append("\"lastName\":\"").append(escapeJson(user.getLastName())).append("\",");
			json.append("\"type\":\"").append(user.getType()).append("\"");
			json.append("}");
			return json.toString();

		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\",\"authenticated\":false}";
		}
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
			Map<String, String> params = parseJson(body);

			String enabled = params.get("enabled");
			String mode = params.get("mode");
			String rate = params.get("rate");
			String cashLabel = params.get("cashLabel");
			String surchargeLabel = params.get("surchargeLabel");

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

	// --- Reports (fixed: filters by today, populates cash/card counts) ---

	private String handleDailyReport() {
		try {
			SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
			String today = sdf.format(new Date());

			// Get start and end of today
			Calendar calStart = Calendar.getInstance();
			calStart.set(Calendar.HOUR_OF_DAY, 0);
			calStart.set(Calendar.MINUTE, 0);
			calStart.set(Calendar.SECOND, 0);
			calStart.set(Calendar.MILLISECOND, 0);
			Date todayStart = calStart.getTime();

			Calendar calEnd = Calendar.getInstance();
			calEnd.set(Calendar.HOUR_OF_DAY, 23);
			calEnd.set(Calendar.MINUTE, 59);
			calEnd.set(Calendar.SECOND, 59);
			calEnd.set(Calendar.MILLISECOND, 999);
			Date todayEnd = calEnd.getTime();

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
					// Filter to today's tickets only
					Date ticketDate = t.getClosingDate() != null ? t.getClosingDate() : t.getCreateDate();
					if (ticketDate == null || ticketDate.before(todayStart) || ticketDate.after(todayEnd)) {
						continue;
					}

					ticketCount++;
					totalSales += t.getTotalAmount();
					totalTax += t.getTaxAmount();
					totalDiscount += t.getDiscountAmount();
					if (t.getGratuity() != null) {
						totalTips += t.getGratuity().getAmount();
					}

					// Count cash vs card transactions
					Set<PosTransaction> transactions = t.getTransactions();
					if (transactions != null) {
						for (PosTransaction txn : transactions) {
							String payType = txn.getPaymentType();
							if ("CASH".equalsIgnoreCase(payType)) {
								cashCount++;
								cashTotal += txn.getAmount();
							} else if (payType != null) {
								// Credit, Debit, Gift Card — all non-cash
								cardCount++;
								cardTotal += txn.getAmount();
							}
						}
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

	// --- Hourly Report (filtered to today) ---

	private String handleHourlyReport() {
		try {
			// Get start of today
			Calendar calStart = Calendar.getInstance();
			calStart.set(Calendar.HOUR_OF_DAY, 0);
			calStart.set(Calendar.MINUTE, 0);
			calStart.set(Calendar.SECOND, 0);
			calStart.set(Calendar.MILLISECOND, 0);
			Date todayStart = calStart.getTime();

			List<Ticket> closedTickets = TicketDAO.getInstance().getClosedTickets();
			double[] hourlyTotals = new double[24];
			int[] hourlyCounts = new int[24];

			if (closedTickets != null) {
				Calendar cal = Calendar.getInstance();
				for (Ticket t : closedTickets) {
					if (t.getCreateDate() != null && !t.getCreateDate().before(todayStart)) {
						cal.setTime(t.getCreateDate());
						int hour = cal.get(Calendar.HOUR_OF_DAY);
						hourlyTotals[hour] += t.getTotalAmount();
						hourlyCounts[hour]++;
					}
				}
			}

			StringBuilder json = new StringBuilder();
			json.append("{\"hours\":[");
			for (int h = 0; h < 24; h++) {
				if (h > 0) json.append(",");
				json.append("{\"hour\":").append(h);
				json.append(",\"label\":\"").append(String.format("%02d:00", h)).append("\"");
				json.append(",\"sales\":").append(df.format(hourlyTotals[h]));
				json.append(",\"tickets\":").append(hourlyCounts[h]).append("}");
			}
			json.append("]}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Order Lifecycle ---

	private String handleCreateOrder(String body, SessionManager.Session session) {
		try {
			Map<String, String> params = parseJson(body);
			String orderType = params.get("orderType");
			String tableNum = params.get("tableNumber");
			String guestCount = params.get("guestCount");

			Ticket ticket = new Ticket();
			ticket.setCreateDate(new Date());
			ticket.setPaid(false);
			ticket.setClosed(false);
			ticket.setVoided(false);

			if (orderType != null) {
				ticket.setTicketType(orderType);
			} else {
				ticket.setTicketType("DINE_IN");
			}

			if (tableNum != null) {
				try {
					ticket.addProperty("tableNumber", tableNum);
				} catch (Exception ignored) {}
			}

			if (guestCount != null) {
				try {
					ticket.setNumberOfGuests(Integer.parseInt(guestCount));
				} catch (Exception ignored) {}
			}

			// Set owner from authenticated session
			try {
				User user = UserDAO.getInstance().get(session.getUserId());
				if (user != null) {
					ticket.setOwner(user);
				}
			} catch (Exception ignored) {}

			TicketDAO.getInstance().saveOrUpdate(ticket);

			StringBuilder json = new StringBuilder();
			json.append("{\"status\":\"success\"");
			json.append(",\"ticketId\":").append(ticket.getId());
			json.append(",\"orderType\":\"").append(escapeJson(ticket.getTicketType())).append("\"");
			json.append("}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	private String handleAddItems(String ticketId, String body) {
		try {
			Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
			if (ticket == null) {
				return "{\"error\":\"Ticket not found\"}";
			}

			Map<String, String> params = parseJson(body);
			String menuItemIdStr = params.get("menuItemId");
			String qtyStr = params.get("qty");
			int addedCount = 0;

			if (menuItemIdStr != null) {
				int menuItemId = Integer.parseInt(menuItemIdStr);
				int qty = qtyStr != null ? Integer.parseInt(qtyStr) : 1;

				MenuItem menuItem = MenuItemDAO.getInstance().get(menuItemId);
				if (menuItem != null) {
					TicketItem ticketItem = new TicketItem();
					ticketItem.setItemCount(qty);
					ticketItem.setName(menuItem.getName());
					ticketItem.setUnitPrice(menuItem.getPrice());
					ticketItem.setItemId(menuItem.getId());
					ticketItem.setTicket(ticket);
					ticket.addToticketItems(ticketItem);
					addedCount++;
				}
			}

			ticket.calculatePrice();
			TicketDAO.getInstance().saveOrUpdate(ticket);

			StringBuilder json = new StringBuilder();
			json.append("{\"status\":\"success\"");
			json.append(",\"ticketId\":").append(ticket.getId());
			json.append(",\"itemsAdded\":").append(addedCount);
			json.append(",\"subtotal\":").append(df.format(ticket.getSubtotalAmount()));
			json.append(",\"tax\":").append(df.format(ticket.getTaxAmount()));
			json.append(",\"total\":").append(df.format(ticket.getTotalAmount()));
			json.append("}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	private String handleSendToKitchen(String ticketId) {
		try {
			Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
			if (ticket == null) {
				return "{\"error\":\"Ticket not found\"}";
			}

			List<KitchenTicket> kitchenTickets = KitchenTicket.fromTicket(ticket);
			if (kitchenTickets != null) {
				for (KitchenTicket kt : kitchenTickets) {
					KitchenTicketDAO.getInstance().saveOrUpdate(kt);
				}
			}

			ticket.addProperty("sentToKitchen", "true");
			ticket.addProperty("kitchenSentTime", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
			TicketDAO.getInstance().saveOrUpdate(ticket);

			StringBuilder json = new StringBuilder();
			json.append("{\"status\":\"success\"");
			json.append(",\"ticketId\":").append(ticket.getId());
			json.append(",\"kitchenTickets\":").append(kitchenTickets != null ? kitchenTickets.size() : 0);
			json.append(",\"message\":\"Order sent to kitchen\"");
			json.append("}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Kitchen Display System ---

	private String handleGetKitchenTickets() {
		try {
			List<KitchenTicket> tickets = KitchenTicketDAO.getInstance().findAllOpen();

			StringBuilder json = new StringBuilder();
			json.append("{\"kitchenTickets\":[");

			if (tickets != null) {
				for (int i = 0; i < tickets.size(); i++) {
					KitchenTicket kt = tickets.get(i);
					if (i > 0) json.append(",");

					json.append("{");
					json.append("\"id\":").append(kt.getId()).append(",");
					json.append("\"ticketId\":").append(kt.getTicketId()).append(",");
					json.append("\"status\":\"").append(kt.getStatus() != null ? kt.getStatus() : "WAITING").append("\",");
					json.append("\"serverName\":\"").append(escapeJson(kt.getServerName())).append("\",");
					json.append("\"ticketType\":\"").append(escapeJson(kt.getTicketType())).append("\",");

					// Time tracking
					if (kt.getCreateDate() != null) {
						long elapsed = (new Date().getTime() - kt.getCreateDate().getTime()) / 1000;
						int minutes = (int)(elapsed / 60);
						int seconds = (int)(elapsed % 60);
						json.append("\"elapsedSeconds\":").append(elapsed).append(",");
						json.append("\"elapsedFormatted\":\"").append(minutes).append(":").append(String.format("%02d", seconds)).append("\",");

						String urgency = "green";
						if (minutes >= 10) urgency = "red";
						else if (minutes >= 5) urgency = "yellow";
						json.append("\"urgency\":\"").append(urgency).append("\",");
					}

					// Table numbers
					if (kt.getTableNumbers() != null && !kt.getTableNumbers().isEmpty()) {
						json.append("\"tables\":[");
						int t = 0;
						for (Object tn : kt.getTableNumbers()) {
							if (t > 0) json.append(",");
							json.append(tn);
							t++;
						}
						json.append("],");
					}

					// Printer group / station
					if (kt.getPrinterGroup() != null) {
						json.append("\"station\":\"").append(escapeJson(kt.getPrinterGroup().getName())).append("\",");
					}

					// Items
					json.append("\"items\":[");
					List<KitchenTicketItem> items = kt.getTicketItems();
					if (items != null) {
						for (int j = 0; j < items.size(); j++) {
							KitchenTicketItem item = items.get(j);
							if (j > 0) json.append(",");
							json.append("{");
							json.append("\"name\":\"").append(escapeJson(item.getMenuItemName())).append("\",");
							json.append("\"quantity\":").append(item.getQuantity());
							if (item.getStatus() != null) {
								json.append(",\"status\":\"").append(item.getStatus()).append("\"");
							}
							json.append("}");
						}
					}
					json.append("]");
					json.append("}");
				}
			}

			json.append("],\"count\":").append(tickets != null ? tickets.size() : 0).append("}");
			return json.toString();
		} catch (Exception e) {
			return "{\"kitchenTickets\":[],\"count\":0,\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	private String handleBumpKitchenTicket(String kitchenTicketId) {
		try {
			KitchenTicket kt = KitchenTicketDAO.getInstance().get(Integer.parseInt(kitchenTicketId));
			if (kt == null) {
				return "{\"error\":\"Kitchen ticket not found\"}";
			}

			kt.setStatus(KitchenTicketStatus.DONE.name());
			kt.setClosingDate(new Date());
			KitchenTicketDAO.getInstance().saveOrUpdate(kt);

			long elapsed = 0;
			if (kt.getCreateDate() != null) {
				elapsed = (kt.getClosingDate().getTime() - kt.getCreateDate().getTime()) / 1000;
			}

			return "{\"status\":\"success\",\"message\":\"Order bumped\"" +
					",\"kitchenTicketId\":" + kt.getId() +
					",\"completionTime\":" + elapsed + "}";
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	private String handleRecallKitchenTicket(String kitchenTicketId) {
		try {
			KitchenTicket kt = KitchenTicketDAO.getInstance().get(Integer.parseInt(kitchenTicketId));
			if (kt == null) {
				return "{\"error\":\"Kitchen ticket not found\"}";
			}

			kt.setStatus(KitchenTicketStatus.WAITING.name());
			kt.setClosingDate(null);
			KitchenTicketDAO.getInstance().saveOrUpdate(kt);

			return "{\"status\":\"success\",\"message\":\"Order recalled to kitchen\"" +
					",\"kitchenTicketId\":" + kt.getId() + "}";
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Tip Management ---

	private String handleTipAdjust(String body) {
		try {
			Map<String, String> params = parseJson(body);
			String ticketId = params.get("ticketId");
			String tipAmount = params.get("tipAmount");
			String tipPercent = params.get("tipPercent");

			if (ticketId == null) {
				return "{\"error\":\"ticketId is required\"}";
			}

			Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(ticketId));
			if (ticket == null) {
				return "{\"error\":\"Ticket not found\"}";
			}

			double tip;
			if (tipPercent != null) {
				double percent = Double.parseDouble(tipPercent);
				tip = ticket.getSubtotalAmount() * (percent / 100);
			} else if (tipAmount != null) {
				tip = Double.parseDouble(tipAmount);
			} else {
				return "{\"error\":\"tipAmount or tipPercent is required\"}";
			}

			tip = Math.round(tip * 100.0) / 100.0;

			Gratuity gratuity = ticket.getGratuity();
			if (gratuity == null) {
				gratuity = ticket.createGratuity();
			}
			gratuity.setAmount(tip);
			ticket.setGratuity(gratuity);
			ticket.setGratuityAmount(tip);
			ticket.calculatePrice();
			TicketDAO.getInstance().saveOrUpdate(ticket);

			Set<PosTransaction> transactions = ticket.getTransactions();
			if (transactions != null) {
				for (PosTransaction txn : transactions) {
					txn.setTipsAmount(tip);
				}
			}

			StringBuilder json = new StringBuilder();
			json.append("{\"status\":\"success\"");
			json.append(",\"ticketId\":").append(ticket.getId());
			json.append(",\"tipAmount\":").append(df.format(tip));
			json.append(",\"newTotal\":").append(df.format(ticket.getTotalAmount()));

			double[] dualPrices = CashDiscountCalculator.getDualPrices(ticket.getTotalAmount());
			json.append(",\"cashTotal\":").append(df.format(dualPrices[0]));
			json.append(",\"cardTotal\":").append(df.format(dualPrices[1]));

			json.append("}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	private String handleTipPresets(String body) {
		try {
			Map<String, String> params = parseJson(body);
			String subtotalStr = params.get("subtotal");
			if (subtotalStr == null) {
				return "{\"error\":\"subtotal is required\"}";
			}

			double subtotal = Double.parseDouble(subtotalStr);

			double[] percents = {15.0, 18.0, 20.0, 25.0};
			StringBuilder json = new StringBuilder();
			json.append("{\"presets\":[");

			for (int i = 0; i < percents.length; i++) {
				if (i > 0) json.append(",");
				double tipAmt = Math.round(subtotal * (percents[i] / 100) * 100.0) / 100.0;
				double totalWithTip = subtotal + tipAmt;
				double[] dualPrices = CashDiscountCalculator.getDualPrices(totalWithTip);

				json.append("{");
				json.append("\"percent\":").append(percents[i]);
				json.append(",\"amount\":").append(df.format(tipAmt));
				json.append(",\"total\":").append(df.format(totalWithTip));
				json.append(",\"cashTotal\":").append(df.format(dualPrices[0]));
				json.append(",\"cardTotal\":").append(df.format(dualPrices[1]));
				json.append("}");
			}

			json.append("],\"customAllowed\":true}");
			return json.toString();
		} catch (Exception e) {
			return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
		}
	}

	// --- Split Ticket ---

	private String handleSplitTicket(String ticketId, String body) {
		try {
			Map<String, String> params = parseJson(body);
			String waysStr = params.get("ways");
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

	// ====================================================================
	// JSON PARSER — replaces fragile extractJsonValue with proper parsing
	// ====================================================================

	/**
	 * Parse a flat JSON object into a key-value map.
	 * Handles strings, numbers, booleans, nulls, and escaped quotes.
	 * Does NOT handle nested objects/arrays (returns them as raw strings).
	 */
	private Map<String, String> parseJson(String json) {
		Map<String, String> result = new HashMap<>();
		if (json == null || json.trim().isEmpty()) return result;

		json = json.trim();
		if (json.startsWith("{")) json = json.substring(1);
		if (json.endsWith("}")) json = json.substring(0, json.length() - 1);

		int pos = 0;
		int len = json.length();

		while (pos < len) {
			// Skip whitespace and commas
			while (pos < len && (json.charAt(pos) == ',' || Character.isWhitespace(json.charAt(pos)))) {
				pos++;
			}
			if (pos >= len) break;

			// Parse key (must be a quoted string)
			if (json.charAt(pos) != '"') break;
			int keyStart = pos + 1;
			int keyEnd = findClosingQuote(json, keyStart);
			if (keyEnd < 0) break;
			String key = json.substring(keyStart, keyEnd);
			pos = keyEnd + 1;

			// Skip whitespace and colon
			while (pos < len && Character.isWhitespace(json.charAt(pos))) pos++;
			if (pos >= len || json.charAt(pos) != ':') break;
			pos++;
			while (pos < len && Character.isWhitespace(json.charAt(pos))) pos++;
			if (pos >= len) break;

			// Parse value
			char ch = json.charAt(pos);
			String value;

			if (ch == '"') {
				// String value
				int valStart = pos + 1;
				int valEnd = findClosingQuote(json, valStart);
				if (valEnd < 0) break;
				value = unescapeJsonString(json.substring(valStart, valEnd));
				pos = valEnd + 1;
			} else if (ch == '{' || ch == '[') {
				// Nested object/array — find matching close bracket
				char open = ch;
				char close = (ch == '{') ? '}' : ']';
				int depth = 1;
				int valStart = pos;
				pos++;
				while (pos < len && depth > 0) {
					char c = json.charAt(pos);
					if (c == '"') {
						pos = findClosingQuote(json, pos + 1) + 1;
						if (pos <= 0) break;
						continue;
					}
					if (c == open) depth++;
					else if (c == close) depth--;
					pos++;
				}
				value = json.substring(valStart, pos);
			} else {
				// Number, boolean, null
				int valStart = pos;
				while (pos < len && json.charAt(pos) != ',' && json.charAt(pos) != '}' &&
						json.charAt(pos) != ']' && !Character.isWhitespace(json.charAt(pos))) {
					pos++;
				}
				value = json.substring(valStart, pos).trim();
				if ("null".equals(value)) {
					value = null;
				}
			}

			result.put(key, value);
		}

		return result;
	}

	/**
	 * Find the closing quote, handling escaped quotes.
	 */
	private int findClosingQuote(String json, int startAfterQuote) {
		int pos = startAfterQuote;
		while (pos < json.length()) {
			char ch = json.charAt(pos);
			if (ch == '\\') {
				pos += 2; // skip escaped character
				continue;
			}
			if (ch == '"') {
				return pos;
			}
			pos++;
		}
		return -1;
	}

	/**
	 * Unescape a JSON string value.
	 */
	private String unescapeJsonString(String s) {
		if (s == null || !s.contains("\\")) return s;
		StringBuilder sb = new StringBuilder(s.length());
		for (int i = 0; i < s.length(); i++) {
			char ch = s.charAt(i);
			if (ch == '\\' && i + 1 < s.length()) {
				char next = s.charAt(i + 1);
				switch (next) {
					case '"': sb.append('"'); i++; break;
					case '\\': sb.append('\\'); i++; break;
					case '/': sb.append('/'); i++; break;
					case 'n': sb.append('\n'); i++; break;
					case 'r': sb.append('\r'); i++; break;
					case 't': sb.append('\t'); i++; break;
					default: sb.append(ch); break;
				}
			} else {
				sb.append(ch);
			}
		}
		return sb.toString();
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

	private String escapeJson(String input) {
		if (input == null) return "";
		return input.replace("\\", "\\\\").replace("\"", "\\\"")
				.replace("\n", "\\n").replace("\r", "\\r");
	}
}
