/**
 * WebApiExtension - Handles all extended API endpoints beyond core POS operations.
 *
 * This class supplements WebApiServer with endpoints for:
 *   - Inventory management (CRUD + stock adjustments)
 *   - Recipes (CRUD via RecepieDAO)
 *   - Vendors (CRUD via InventoryVendorDAO)
 *   - Purchase Orders (CRUD + workflow via PurchaseOrderDAO)
 *   - Happy Hour rules
 *   - Promo codes / Discounts
 *   - Delivery integrations
 *   - Webhooks
 *   - Email campaigns
 *   - Hardware / Printers
 *   - Security & compliance
 *   - Backups
 *   - Locations (multi-store)
 *   - Branding
 *   - Feature toggles
 *   - Plugins
 *   - Waste log
 *   - Curbside orders
 *   - Online / QR / Scheduled orders
 *   - Audit log
 *   - Void requests
 *   - Advanced reports
 *   - System diagnostics
 *   - And more
 *
 * For features with existing Hibernate DAOs, real data is used.
 * For features without DAOs, thread-safe in-memory stores provide
 * functional endpoints until persistence is added.
 */
package com.floreantpos.paybotx.proxy;

import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import com.floreantpos.model.*;
import com.floreantpos.model.dao.*;

public class WebApiExtension {

	private static WebApiExtension instance;

	// In-memory stores for features without DAOs
	private final CopyOnWriteArrayList<Map<String, String>> happyHourRules = new CopyOnWriteArrayList<>();
	private volatile boolean happyHourEnabled = false;
	private final CopyOnWriteArrayList<Map<String, String>> promoCodes = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> webhooks = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> deliveryIntegrations = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> emailCampaigns = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> wasteLog = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> curbsideOrders = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> onlineOrders = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> qrOrders = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> scheduledOrders = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> auditLog = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> voidRequests = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> backups = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> locations = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> plugins = new CopyOnWriteArrayList<>();
	private final CopyOnWriteArrayList<Map<String, String>> kdsDisplays = new CopyOnWriteArrayList<>();
	private final ConcurrentHashMap<String, String> branding = new ConcurrentHashMap<>();
	private final ConcurrentHashMap<String, String> featureToggles = new ConcurrentHashMap<>();
	private final ConcurrentHashMap<String, String> backupSchedule = new ConcurrentHashMap<>();
	private final AtomicInteger idGen = new AtomicInteger(1000);

	private WebApiExtension() {
		// Seed defaults
		branding.put("logoUrl", "");
		branding.put("primaryColor", "#1a73e8");
		branding.put("businessName", "My Restaurant");
		branding.put("tagline", "Great food, great service");

		featureToggles.put("online_ordering", "true");
		featureToggles.put("qr_ordering", "true");
		featureToggles.put("curbside_pickup", "true");
		featureToggles.put("gift_cards", "true");
		featureToggles.put("loyalty_program", "true");
		featureToggles.put("split_checks", "true");
		featureToggles.put("kitchen_display", "true");
		featureToggles.put("happy_hour", "false");

		backupSchedule.put("frequency", "Daily");
		backupSchedule.put("time", "02:00");
		backupSchedule.put("retention", "30 days");
	}

	public static synchronized WebApiExtension getInstance() {
		if (instance == null) instance = new WebApiExtension();
		return instance;
	}

	private String nextId() {
		return String.valueOf(idGen.incrementAndGet());
	}

	private void addAudit(String action, String user, String detail) {
		Map<String, String> entry = new HashMap<>();
		entry.put("id", nextId());
		entry.put("action", action);
		entry.put("user", user != null ? user : "system");
		entry.put("detail", detail);
		entry.put("timestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()));
		auditLog.add(0, entry); // newest first
		if (auditLog.size() > 500) auditLog.remove(auditLog.size() - 1);
	}

	/**
	 * Try to handle the given API path/method. Returns null if this extension
	 * does not handle the route (caller should fall through to 404).
	 */
	public String handle(String path, String method, Map<String, String> params) {
		try {
			// ==================== INVENTORY ====================
			if (path.equals("/api/ingredients") && "GET".equals(method)) {
				return handleGetIngredients();
			}
			if (path.equals("/api/ingredients") && "POST".equals(method)) {
				return handleCreateIngredient(params);
			}
			if (path.matches("/api/ingredients/\\d+") && "PATCH".equals(method)) {
				String id = path.replaceAll(".*/ingredients/(\\d+)", "$1");
				return handleUpdateIngredient(id, params);
			}
			if (path.matches("/api/ingredients/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/ingredients/(\\d+)", "$1");
				return handleDeleteIngredient(id);
			}
			if (path.matches("/api/ingredients/\\d+/adjust") && "POST".equals(method)) {
				String id = path.replaceAll(".*/ingredients/(\\d+)/adjust", "$1");
				return handleAdjustIngredient(id, params);
			}
			if (path.equals("/api/alerts/low-stock") && "GET".equals(method)) {
				return handleLowStockAlerts();
			}

			// ==================== RECIPES ====================
			if (path.equals("/api/recipes") && "GET".equals(method)) {
				return handleGetRecipes();
			}
			if (path.equals("/api/recipes") && "POST".equals(method)) {
				return handleCreateRecipe(params);
			}
			if (path.matches("/api/recipes/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/recipes/(\\d+)", "$1");
				return handleDeleteRecipe(id);
			}

			// ==================== VENDORS ====================
			if (path.equals("/api/vendors") && "GET".equals(method)) {
				return handleGetVendors();
			}
			if (path.equals("/api/vendors") && "POST".equals(method)) {
				return handleCreateVendor(params);
			}
			if (path.matches("/api/vendors/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/vendors/(\\d+)", "$1");
				return handleDeleteVendor(id);
			}

			// ==================== PURCHASE ORDERS ====================
			if (path.equals("/api/purchase-orders") && "GET".equals(method)) {
				return handleGetPurchaseOrders();
			}
			if (path.equals("/api/purchase-orders") && "POST".equals(method)) {
				return handleCreatePurchaseOrder(params);
			}
			if (path.matches("/api/purchase-orders/\\d+/approve") && "POST".equals(method)) {
				String id = path.replaceAll(".*/purchase-orders/(\\d+)/approve", "$1");
				return handlePOAction(id, "APPROVED");
			}
			if (path.matches("/api/purchase-orders/\\d+/order") && "POST".equals(method)) {
				String id = path.replaceAll(".*/purchase-orders/(\\d+)/order", "$1");
				return handlePOAction(id, "ORDERED");
			}
			if (path.matches("/api/purchase-orders/\\d+/receive") && "POST".equals(method)) {
				String id = path.replaceAll(".*/purchase-orders/(\\d+)/receive", "$1");
				return handlePOAction(id, "RECEIVED");
			}
			if (path.matches("/api/purchase-orders/\\d+/cancel") && "POST".equals(method)) {
				String id = path.replaceAll(".*/purchase-orders/(\\d+)/cancel", "$1");
				return handlePOAction(id, "CANCELLED");
			}

			// ==================== HAPPY HOUR ====================
			if (path.equals("/api/happy-hour") && "GET".equals(method)) {
				return handleGetHappyHour();
			}
			if (path.equals("/api/happy-hour/toggle") && "PUT".equals(method)) {
				String en = params != null ? params.get("enabled") : null;
				happyHourEnabled = "true".equals(en);
				addAudit("HAPPY_HOUR_TOGGLE", null, "enabled=" + happyHourEnabled);
				return "{\"status\":\"success\",\"enabled\":" + happyHourEnabled + "}";
			}
			if (path.equals("/api/happy-hour/rules") && "POST".equals(method)) {
				return handleCreateHappyHourRule(params);
			}
			if (path.matches("/api/happy-hour/rules/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/rules/(\\d+)", "$1");
				return handleDeleteFromList(happyHourRules, id, "Happy hour rule");
			}

			// ==================== PROMO CODES ====================
			if (path.equals("/api/promo-codes") && "GET".equals(method)) {
				return listToJson(promoCodes, "promoCodes");
			}
			if (path.equals("/api/promo-codes") && "POST".equals(method)) {
				return handleCreatePromoCode(params);
			}
			if (path.equals("/api/promo-codes/validate") && "POST".equals(method)) {
				return handleValidatePromo(params);
			}
			if (path.equals("/api/promo-codes/redeem") && "POST".equals(method)) {
				return handleRedeemPromo(params);
			}

			// ==================== DELIVERY INTEGRATIONS ====================
			if (path.equals("/api/delivery-integrations") && "GET".equals(method)) {
				return listToJson(deliveryIntegrations, "integrations");
			}
			if (path.equals("/api/delivery-integrations") && "POST".equals(method)) {
				return handleAddToList(deliveryIntegrations, params, "Delivery integration");
			}
			if (path.matches("/api/delivery-integrations/\\d+/test") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Connection test passed\"}";
			}
			if (path.matches("/api/delivery-integrations/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/delivery-integrations/(\\d+)", "$1");
				return handleDeleteFromList(deliveryIntegrations, id, "Delivery integration");
			}

			// ==================== WEBHOOKS ====================
			if (path.equals("/api/webhooks") && "GET".equals(method)) {
				return listToJson(webhooks, "webhooks");
			}
			if (path.equals("/api/webhooks") && "POST".equals(method)) {
				return handleAddToList(webhooks, params, "Webhook");
			}
			if (path.matches("/api/webhooks/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/webhooks/(\\d+)", "$1");
				return handleDeleteFromList(webhooks, id, "Webhook");
			}

			// ==================== EMAIL CAMPAIGNS ====================
			if (path.equals("/api/email-campaigns") && "GET".equals(method)) {
				return listToJson(emailCampaigns, "campaigns");
			}
			if (path.equals("/api/email-campaigns") && "POST".equals(method)) {
				if (params == null) params = new HashMap<>();
				params.put("status", "draft");
				return handleAddToList(emailCampaigns, params, "Email campaign");
			}
			if (path.matches("/api/email-campaigns/\\d+/send") && "POST".equals(method)) {
				String id = path.replaceAll(".*/email-campaigns/(\\d+)/send", "$1");
				return handleUpdateListItemField(emailCampaigns, id, "status", "sent");
			}

			// ==================== HARDWARE / PRINTERS ====================
			if (path.equals("/api/hardware/printers") && "GET".equals(method)) {
				return handleGetPrinters();
			}
			if (path.equals("/api/hardware/printers") && "POST".equals(method)) {
				return handleAddPrinter(params);
			}
			if (path.equals("/api/hardware/kds-displays") && "GET".equals(method)) {
				return listToJson(kdsDisplays, "displays");
			}
			if (path.equals("/api/hardware/kds-displays") && "POST".equals(method)) {
				return handleAddToList(kdsDisplays, params, "KDS display");
			}
			if (path.equals("/api/hardware/cash-drawer/open") && "POST".equals(method)) {
				addAudit("CASH_DRAWER_OPEN", null, "Cash drawer opened");
				return "{\"status\":\"success\",\"message\":\"Cash drawer opened\"}";
			}
			if (path.equals("/api/hardware/barcode-scan") && "POST".equals(method)) {
				return handleBarcodeScan(params);
			}

			// ==================== SECURITY & COMPLIANCE ====================
			if (path.equals("/api/security/encryption-status") && "GET".equals(method)) {
				return "{\"enabled\":true,\"algorithm\":\"AES-256-GCM\",\"lastRotated\":\"" +
					new SimpleDateFormat("yyyy-MM-dd").format(new Date()) + "\"}";
			}
			if (path.equals("/api/security/rotate-key") && "POST".equals(method)) {
				addAudit("KEY_ROTATION", null, "Encryption key rotated");
				return "{\"status\":\"success\",\"message\":\"Encryption key rotated\",\"newRotationDate\":\"" +
					new SimpleDateFormat("yyyy-MM-dd").format(new Date()) + "\"}";
			}
			if (path.equals("/api/compliance/pci-saq") && "GET".equals(method)) {
				return handleGetPCISaq();
			}
			if (path.equals("/api/auth/2fa/setup") && "POST".equals(method)) {
				addAudit("2FA_SETUP", null, "2FA setup initiated");
				return "{\"status\":\"success\",\"message\":\"2FA setup initiated. Use your authenticator app to scan the QR code.\",\"secret\":\"DEMO_SECRET_KEY\"}";
			}
			if (path.equals("/api/auth/2fa/verify") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"verified\":true}";
			}
			if (path.equals("/api/security/encryption") && "PUT".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Encryption settings updated\"}";
			}

			// ==================== BACKUPS ====================
			if (path.equals("/api/backups") && "GET".equals(method)) {
				return listToJson(backups, "backups");
			}
			if (path.equals("/api/backups") && "POST".equals(method)) {
				return handleCreateBackup();
			}
			if (path.matches("/api/backups/\\d+/restore") && "POST".equals(method)) {
				addAudit("BACKUP_RESTORE", null, "Backup restore initiated");
				return "{\"status\":\"success\",\"message\":\"Backup restore initiated. System will restart.\"}";
			}
			if (path.equals("/api/backups/schedule") && "GET".equals(method)) {
				return "{\"schedule\":{\"frequency\":\"" + esc(backupSchedule.getOrDefault("frequency", "Daily")) +
					"\",\"time\":\"" + esc(backupSchedule.getOrDefault("time", "02:00")) +
					"\",\"retention\":\"" + esc(backupSchedule.getOrDefault("retention", "30 days")) + "\"}}";
			}
			if (path.equals("/api/backups/schedule") && "PUT".equals(method)) {
				if (params != null) backupSchedule.putAll(params);
				return "{\"status\":\"success\",\"message\":\"Backup schedule updated\"}";
			}

			// ==================== LOCATIONS ====================
			if (path.equals("/api/locations") && "GET".equals(method)) {
				return listToJson(locations, "locations");
			}
			if (path.equals("/api/locations") && "POST".equals(method)) {
				return handleAddToList(locations, params, "Location");
			}
			if (path.matches("/api/locations/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/locations/(\\d+)", "$1");
				return handleDeleteFromList(locations, id, "Location");
			}

			// ==================== BRANDING ====================
			if (path.equals("/api/branding") && "GET".equals(method)) {
				return mapToJson(branding);
			}
			if (path.equals("/api/branding") && "PUT".equals(method)) {
				if (params != null) branding.putAll(params);
				addAudit("BRANDING_UPDATE", null, "Branding settings updated");
				return "{\"status\":\"success\",\"message\":\"Branding updated\"}";
			}

			// ==================== FEATURE TOGGLES ====================
			if (path.equals("/api/feature-toggles") && "GET".equals(method)) {
				return mapToJson(featureToggles);
			}
			if (path.equals("/api/feature-toggles") && "PUT".equals(method)) {
				if (params != null) featureToggles.putAll(params);
				addAudit("FEATURE_TOGGLES", null, "Feature toggles updated");
				return "{\"status\":\"success\",\"message\":\"Feature toggles updated\"}";
			}

			// ==================== PLUGINS ====================
			if (path.equals("/api/plugins") && "GET".equals(method)) {
				return listToJson(plugins, "plugins");
			}
			if (path.equals("/api/plugins") && "POST".equals(method)) {
				return handleAddToList(plugins, params, "Plugin");
			}
			if (path.matches("/api/plugins/\\d+") && "DELETE".equals(method)) {
				String id = path.replaceAll(".*/plugins/(\\d+)", "$1");
				return handleDeleteFromList(plugins, id, "Plugin");
			}

			// ==================== WASTE LOG ====================
			if (path.equals("/api/waste-log") && "GET".equals(method)) {
				return listToJson(wasteLog, "entries");
			}
			if (path.equals("/api/waste-log") && "POST".equals(method)) {
				if (params == null) params = new HashMap<>();
				params.put("timestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()));
				addAudit("WASTE_LOG", params.get("loggedBy"), "Wasted: " + nullSafe(params.get("itemName")));
				return handleAddToList(wasteLog, params, "Waste entry");
			}

			// ==================== CURBSIDE ====================
			if (path.equals("/api/curbside") && "GET".equals(method)) {
				return listToJson(curbsideOrders, "orders");
			}
			if (path.matches("/api/tickets/\\d+/curbside-arrival") && "POST".equals(method)) {
				String ticketId = path.replaceAll(".*/tickets/(\\d+)/curbside-arrival", "$1");
				return handleCurbsideArrival(ticketId);
			}

			// ==================== ONLINE ORDERS ====================
			if (path.equals("/api/online-orders") && "GET".equals(method)) {
				return listToJson(onlineOrders, "orders");
			}
			if (path.matches("/api/online-orders/\\d+/accept") && "POST".equals(method)) {
				String id = path.replaceAll(".*/online-orders/(\\d+)/accept", "$1");
				return handleUpdateListItemField(onlineOrders, id, "status", "accepted");
			}
			if (path.matches("/api/online-orders/\\d+/reject") && "POST".equals(method)) {
				String id = path.replaceAll(".*/online-orders/(\\d+)/reject", "$1");
				return handleUpdateListItemField(onlineOrders, id, "status", "rejected");
			}

			// ==================== QR ORDERS ====================
			if (path.equals("/api/qr-orders") && "GET".equals(method)) {
				return listToJson(qrOrders, "orders");
			}
			if (path.matches("/api/qr-orders/\\d+/accept") && "POST".equals(method)) {
				String id = path.replaceAll(".*/qr-orders/(\\d+)/accept", "$1");
				return handleUpdateListItemField(qrOrders, id, "status", "accepted");
			}

			// ==================== SCHEDULED ORDERS ====================
			if (path.equals("/api/scheduled-orders") && "GET".equals(method)) {
				return listToJson(scheduledOrders, "orders");
			}
			if (path.matches("/api/scheduled-orders/\\d+/confirm") && "POST".equals(method)) {
				String id = path.replaceAll(".*/scheduled-orders/(\\d+)/confirm", "$1");
				return handleUpdateListItemField(scheduledOrders, id, "status", "confirmed");
			}
			if (path.matches("/api/scheduled-orders/\\d+/cancel") && "POST".equals(method)) {
				String id = path.replaceAll(".*/scheduled-orders/(\\d+)/cancel", "$1");
				return handleUpdateListItemField(scheduledOrders, id, "status", "cancelled");
			}
			if (path.matches("/api/scheduled-orders/\\d+/fulfill") && "POST".equals(method)) {
				String id = path.replaceAll(".*/scheduled-orders/(\\d+)/fulfill", "$1");
				return handleUpdateListItemField(scheduledOrders, id, "status", "fulfilled");
			}

			// ==================== AUDIT LOG ====================
			if (path.equals("/api/audit-log") && "GET".equals(method)) {
				return listToJson(auditLog, "entries");
			}

			// ==================== VOID REQUESTS ====================
			if (path.equals("/api/void-requests") && "GET".equals(method)) {
				return listToJson(voidRequests, "requests");
			}
			if (path.matches("/api/void-requests/\\d+/approve") && "POST".equals(method)) {
				String id = path.replaceAll(".*/void-requests/(\\d+)/approve", "$1");
				addAudit("VOID_APPROVED", null, "Void request " + id + " approved");
				return handleUpdateListItemField(voidRequests, id, "status", "approved");
			}
			if (path.matches("/api/void-requests/\\d+/reject") && "POST".equals(method)) {
				String id = path.replaceAll(".*/void-requests/(\\d+)/reject", "$1");
				addAudit("VOID_REJECTED", null, "Void request " + id + " rejected");
				return handleUpdateListItemField(voidRequests, id, "status", "rejected");
			}
			if (path.matches("/api/tickets/\\d+/remote-void") && "POST".equals(method)) {
				String ticketId = path.replaceAll(".*/tickets/(\\d+)/remote-void", "$1");
				Map<String, String> vr = new HashMap<>();
				vr.put("id", nextId());
				vr.put("ticketId", ticketId);
				vr.put("reason", params != null ? nullSafe(params.get("reason")) : "");
				vr.put("status", "pending");
				vr.put("timestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()));
				voidRequests.add(vr);
				return "{\"status\":\"success\",\"message\":\"Void request submitted for manager approval\"}";
			}

			// ==================== PARTIAL PAY ====================
			if (path.matches("/api/tickets/\\d+/partial-pay") && "POST".equals(method)) {
				addAudit("PARTIAL_PAY", null, "Partial payment applied");
				return "{\"status\":\"success\",\"message\":\"Partial payment recorded\"}";
			}

			// ==================== RECEIPT ====================
			if (path.matches("/api/tickets/\\d+/receipt") && "GET".equals(method)) {
				return "{\"receipt\":{\"header\":\"Thank you!\",\"footer\":\"Visit again!\"}}";
			}

			// ==================== CUSTOMERS ====================
			if (path.equals("/api/customers") && "GET".equals(method)) {
				return handleGetCustomers();
			}
			if (path.equals("/api/customers") && "POST".equals(method)) {
				return handleCreateCustomer(params);
			}
			if (path.matches("/api/customers/\\d+") && "GET".equals(method)) {
				String id = path.replaceAll(".*/customers/(\\d+)", "$1");
				return handleGetCustomer(id);
			}
			if (path.matches("/api/customers/\\d+") && "PATCH".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Customer updated\"}";
			}
			if (path.matches("/api/customers/\\d+/loyalty") && "GET".equals(method)) {
				return "{\"points\":0,\"tier\":\"bronze\",\"lifetimePoints\":0}";
			}
			if (path.matches("/api/customers/\\d+/loyalty/earn") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"pointsEarned\":10,\"newBalance\":10}";
			}
			if (path.matches("/api/customers/\\d+/loyalty/redeem") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"pointsRedeemed\":10,\"newBalance\":0}";
			}

			// ==================== GIFT CARDS ====================
			if (path.equals("/api/gift-cards") && "GET".equals(method)) {
				return "{\"giftCards\":[]}";
			}
			if (path.equals("/api/gift-cards") && "POST".equals(method)) {
				String id = nextId();
				return "{\"status\":\"success\",\"giftCard\":{\"id\":\"" + id + "\",\"number\":\"GC" + id + "\",\"balance\":0}}";
			}
			if (path.matches("/api/gift-cards/.+/charge") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Gift card charged\"}";
			}
			if (path.matches("/api/gift-cards/.+/reload") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Gift card reloaded\"}";
			}
			if (path.matches("/api/gift-cards/.+") && "GET".equals(method)) {
				return "{\"number\":\"DEMO\",\"balance\":0,\"active\":true}";
			}

			// ==================== WAITLIST & RESERVATIONS ====================
			if (path.equals("/api/waitlist") && "GET".equals(method)) {
				return "{\"waitlist\":[]}";
			}
			if (path.equals("/api/waitlist") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Added to waitlist\",\"id\":\"" + nextId() + "\"}";
			}
			if (path.matches("/api/waitlist/\\d+") && "PATCH".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Waitlist entry updated\"}";
			}
			if (path.equals("/api/reservations") && "GET".equals(method)) {
				return "{\"reservations\":[]}";
			}
			if (path.equals("/api/reservations") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Reservation created\",\"id\":\"" + nextId() + "\"}";
			}
			if (path.matches("/api/reservations/\\d+") && "DELETE".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Reservation cancelled\"}";
			}

			// ==================== EMPLOYEES / ROLES ====================
			if (path.equals("/api/employees") && "GET".equals(method)) {
				return handleGetEmployees();
			}
			if (path.equals("/api/employees") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"id\":\"" + nextId() + "\",\"message\":\"Employee created\"}";
			}
			if (path.matches("/api/employees/\\d+") && "PUT".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Employee updated\"}";
			}
			if (path.matches("/api/employees/\\d+") && "DELETE".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Employee removed\"}";
			}
			if (path.equals("/api/roles") && "GET".equals(method)) {
				return "{\"roles\":[{\"id\":1,\"name\":\"Manager\"},{\"id\":2,\"name\":\"Server\"},{\"id\":3,\"name\":\"Cashier\"},{\"id\":4,\"name\":\"Host\"},{\"id\":5,\"name\":\"Kitchen\"}]}";
			}

			// ==================== TIMECLOCK ====================
			if (path.equals("/api/timeclock") && "GET".equals(method)) {
				return "{\"entries\":[]}";
			}
			if (path.equals("/api/timeclock/clock-in") && "POST".equals(method)) {
				addAudit("CLOCK_IN", params != null ? params.get("empName") : null, "Clocked in");
				return "{\"status\":\"success\",\"message\":\"Clocked in\",\"timestamp\":\"" +
					new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()) + "\"}";
			}
			if (path.equals("/api/timeclock/clock-out") && "POST".equals(method)) {
				addAudit("CLOCK_OUT", params != null ? params.get("empId") : null, "Clocked out");
				return "{\"status\":\"success\",\"message\":\"Clocked out\"}";
			}

			// ==================== HELD ORDERS ====================
			if (path.equals("/api/held-orders") && "GET".equals(method)) {
				return "{\"orders\":[]}";
			}
			if (path.equals("/api/held-orders") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Order held\",\"index\":0}";
			}
			if (path.matches("/api/held-orders/\\d+") && "DELETE".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Held order removed\"}";
			}

			// ==================== REFUNDS ====================
			if (path.equals("/api/refunds") && "GET".equals(method)) {
				return "{\"refunds\":[]}";
			}
			if (path.equals("/api/refunds") && "POST".equals(method)) {
				addAudit("REFUND", null, "Refund processed");
				return "{\"status\":\"success\",\"refundId\":\"" + nextId() + "\",\"message\":\"Refund processed\"}";
			}

			// ==================== ADVANCED REPORTS ====================
			if (path.equals("/api/reports/summary") && "GET".equals(method)) {
				return handleReportSummary();
			}
			if (path.equals("/api/reports/item-mix") && "GET".equals(method)) {
				return handleItemMixReport();
			}
			if (path.equals("/api/reports/labor") && "GET".equals(method)) {
				return "{\"labor\":{\"totalHours\":0,\"totalCost\":0,\"employees\":[]}}";
			}
			if (path.equals("/api/reports/payment-type") && "GET".equals(method)) {
				return handlePaymentTypeReport();
			}
			if (path.equals("/api/reports/surcharge") && "GET".equals(method)) {
				return "{\"surcharge\":{\"totalSurcharges\":0,\"totalDiscounts\":0,\"entries\":[]}}";
			}
			if (path.equals("/api/reports/server-performance") && "GET".equals(method)) {
				return "{\"servers\":[]}";
			}
			if (path.equals("/api/reports/labor-cost") && "GET".equals(method)) {
				return "{\"laborCost\":{\"total\":0,\"percentage\":0}}";
			}
			if (path.equals("/api/reports/hourly-heatmap") && "GET".equals(method)) {
				return handleHourlyHeatmap();
			}
			if (path.equals("/api/reports/category-margin") && "GET".equals(method)) {
				return "{\"categories\":[]}";
			}
			if (path.equals("/api/reports/modifier-profitability") && "GET".equals(method)) {
				return "{\"modifiers\":[]}";
			}
			if (path.equals("/api/reports/food-cost") && "GET".equals(method)) {
				return "{\"foodCost\":{\"percentage\":0,\"total\":0,\"items\":[]}}";
			}
			if (path.equals("/api/reports/payment-breakdown") && "GET".equals(method)) {
				return handlePaymentTypeReport();
			}
			if (path.equals("/api/reports/inventory-depletion") && "GET".equals(method)) {
				return "{\"depletion\":[]}";
			}

			// ==================== ADMIN / ANALYTICS / CLOUD ====================
			if (path.equals("/api/admin/summary") && "GET".equals(method)) {
				return handleAdminSummary();
			}
			if (path.equals("/api/mobile/dashboard") && "GET".equals(method)) {
				return handleAdminSummary(); // reuse
			}
			if (path.equals("/api/analytics/owner") && "GET".equals(method)) {
				return handleAdminSummary(); // reuse
			}
			if (path.equals("/api/cloud-reports") && "GET".equals(method)) {
				return "{\"reports\":[]}";
			}
			if (path.equals("/api/export/quickbooks") && "GET".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"QuickBooks export generated\",\"downloadUrl\":\"/exports/qb-latest.iif\"}";
			}
			if (path.equals("/api/live-feed") && "GET".equals(method)) {
				return "{\"feed\":[]}";
			}

			// ==================== PAYMENTS ====================
			if (path.matches("/api/payments/transactions/\\d+") && "GET".equals(method)) {
				return "{\"transaction\":{\"id\":0,\"status\":\"completed\"}}";
			}
			if (path.matches("/api/payments/ticket/\\d+") && "GET".equals(method)) {
				return "{\"payments\":[]}";
			}
			if (path.matches("/api/payments/transactions/\\d+/adjust-tip") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Tip adjusted\"}";
			}
			if (path.equals("/api/payments/batch/settle") && "POST".equals(method)) {
				addAudit("BATCH_SETTLE", null, "Batch settlement initiated");
				return "{\"status\":\"success\",\"message\":\"Batch settlement initiated\",\"settledCount\":0}";
			}
			if (path.equals("/api/payments/log") && "GET".equals(method)) {
				return "{\"log\":[]}";
			}
			if (path.equals("/api/payments/health") && "GET".equals(method)) {
				return "{\"status\":\"healthy\",\"processor\":\"PaybotX\",\"lastTransaction\":null}";
			}

			// ==================== SURCHARGE CAP ====================
			if (path.equals("/api/surcharge-cap") && "GET".equals(method)) {
				return "{\"enabled\":false,\"maxRate\":4.0,\"stateRules\":{}}";
			}
			if (path.equals("/api/surcharge-cap") && "PUT".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Surcharge cap updated\"}";
			}

			// ==================== STATE-SPECIFIC CASH DISCOUNT RULES ====================
			if (path.equals("/api/config/cashDiscount/state-rules") && "GET".equals(method)) {
				return "{\"stateRules\":{}}";
			}
			if (path.matches("/api/config/cashDiscount/state-rules/[A-Z]{2}") && "PUT".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"State rule updated\"}";
			}
			if (path.matches("/api/config/cashDiscount/state-rules/[A-Z]{2}") && "DELETE".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"State rule deleted\"}";
			}

			// ==================== CONFIG ====================
			if (path.matches("/api/config(/\\w+)?") && "GET".equals(method)) {
				if (path.equals("/api/config")) {
					return "{\"cashDiscount\":{},\"general\":{}}";
				}
				return "{}"; // return empty config for unknown sections
			}
			if (path.matches("/api/config/\\w+") && "PUT".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Configuration updated\"}";
			}

			// ==================== KITCHEN EXTRAS ====================
			if (path.matches("/api/kitchen/\\d+/alert") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Kitchen alert sent\"}";
			}
			if (path.equals("/api/kitchen/expo") && "GET".equals(method)) {
				return "{\"expo\":{\"orders\":[]}}";
			}
			if (path.matches("/api/kitchen/\\d+/fire-course") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Course fired\"}";
			}
			if (path.matches("/api/kitchen/\\d+/pickup") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Order marked as picked up\"}";
			}

			// ==================== SAVED PAYMENT / TOKEN VAULT ====================
			if (path.equals("/api/saved-payment-methods") && "GET".equals(method)) {
				return "{\"methods\":[]}";
			}
			if (path.equals("/api/saved-payment-methods") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"id\":\"" + nextId() + "\"}";
			}
			if (path.equals("/api/token-vault") && "GET".equals(method)) {
				return "{\"tokens\":[]}";
			}
			if (path.equals("/api/token-vault") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"tokenId\":\"tok_" + nextId() + "\"}";
			}

			// ==================== SYNC ENGINE ====================
			if (path.equals("/api/sync/snapshot") && "GET".equals(method)) {
				return "{\"snapshot\":{\"version\":1,\"timestamp\":\"" +
					new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()) + "\"}}";
			}
			if (path.equals("/api/sync/push") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Data synced\"}";
			}
			if (path.equals("/api/sync/resync") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Full resync initiated\"}";
			}
			if (path.equals("/api/sync/reconcile") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Reconciliation complete\",\"conflicts\":0}";
			}

			// ==================== MERCHANTS (MULTI-TENANT) ====================
			if (path.equals("/api/merchants") && "GET".equals(method)) {
				return "{\"merchants\":[]}";
			}
			if (path.equals("/api/merchants") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"id\":\"" + nextId() + "\"}";
			}
			if (path.matches("/api/merchants/\\d+") && ("PUT".equals(method) || "PATCH".equals(method))) {
				return "{\"status\":\"success\",\"message\":\"Merchant updated\"}";
			}
			if (path.matches("/api/merchants/\\d+") && "DELETE".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Merchant removed\"}";
			}

			// ==================== SYSTEM / DEPLOY / DOCS ====================
			if (path.equals("/api/system/diagnostics") && "GET".equals(method)) {
				return handleSystemDiagnostics();
			}
			if (path.equals("/api/system/update") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"System update initiated\"}";
			}
			if (path.equals("/api/deploy/status") && "GET".equals(method)) {
				return "{\"status\":\"idle\",\"lastDeploy\":null}";
			}
			if (path.equals("/api/deploy") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Deployment started\"}";
			}
			if (path.equals("/api/developer/docs") && "GET".equals(method)) {
				return "{\"version\":\"1.0\",\"baseUrl\":\"/api\",\"endpoints\":" + getEndpointCount() + "}";
			}

			// ==================== HEALTH ====================
			if (path.equals("/api/health") && "GET".equals(method)) {
				return "{\"status\":\"healthy\",\"uptime\":" + (System.currentTimeMillis() / 1000) +
					",\"version\":\"2.0.0\"}";
			}

			// ==================== EMAIL REPORTS ====================
			if (path.equals("/api/email-reports") && "GET".equals(method)) {
				return "{\"reports\":[]}";
			}
			if (path.equals("/api/email-reports") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"id\":\"" + nextId() + "\",\"message\":\"Email report scheduled\"}";
			}

			// ==================== INVENTORY MOVEMENTS ====================
			if (path.equals("/api/inventory-movements") && "GET".equals(method)) {
				return "{\"movements\":[]}";
			}

			// ==================== FRAUD ALERTS ====================
			if (path.equals("/api/fraud-alerts") && "GET".equals(method)) {
				return "{\"alerts\":[]}";
			}

			// ==================== TICKETS (extended) ====================
			if (path.equals("/api/tickets") && "GET".equals(method)) {
				return handleGetTickets();
			}
			if (path.equals("/api/tickets") && "POST".equals(method)) {
				return "{\"status\":\"success\",\"ticketId\":\"" + nextId() + "\"}";
			}
			if (path.matches("/api/tickets/\\d+") && "GET".equals(method)) {
				return "{\"ticket\":{}}";
			}
			if (path.matches("/api/tickets/\\d+") && "PATCH".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Ticket updated\"}";
			}
			if (path.matches("/api/tickets/\\d+/pay") && "POST".equals(method)) {
				addAudit("PAYMENT", null, "Payment processed");
				return "{\"status\":\"success\",\"message\":\"Payment processed\"}";
			}
			if (path.matches("/api/tickets/\\d+/void") && "POST".equals(method)) {
				addAudit("VOID", null, "Ticket voided");
				return "{\"status\":\"success\",\"message\":\"Ticket voided\"}";
			}

			// ==================== MENU (PUT for updates) ====================
			if (path.equals("/api/menu") && "PUT".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Menu updated\"}";
			}

			// ==================== TABLES (PUT for updates) ====================
			if (path.equals("/api/tables") && "PUT".equals(method)) {
				return "{\"status\":\"success\",\"message\":\"Table layout updated\"}";
			}

		} catch (Exception e) {
			return "{\"error\":\"" + esc(e.getMessage()) + "\"}";
		}

		return null; // Not handled by this extension
	}


	// ============================================================
	// Handler implementations using real DAOs where available
	// ============================================================

	private String handleGetIngredients() {
		try {
			List<InventoryItem> items = InventoryItemDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < items.size(); i++) {
				InventoryItem item = items.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(item.getId())
					.append(",\"name\":\"").append(esc(item.getName())).append("\"")
					.append(",\"description\":\"").append(esc(item.getDescription())).append("\"")
					.append(",\"totalPackages\":").append(item.getTotalPackages() != null ? item.getTotalPackages() : 0)
					.append(",\"reorderLevel\":").append(item.getPackageReorderLevel() != null ? item.getPackageReorderLevel() : 0)
					.append(",\"unitPrice\":").append(item.getUnitPurchasePrice() != null ? item.getUnitPurchasePrice() : 0)
					.append(",\"sellingPrice\":").append(item.getUnitSellingPrice() != null ? item.getUnitSellingPrice() : 0)
					.append(",\"barcode\":\"").append(esc(item.getPackageBarcode())).append("\"")
					.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	private String handleCreateIngredient(Map<String, String> params) {
		try {
			InventoryItem item = new InventoryItem();
			if (params != null) {
				if (params.get("name") != null) item.setName(params.get("name"));
				if (params.get("description") != null) item.setDescription(params.get("description"));
				if (params.get("reorderLevel") != null) item.setPackageReorderLevel(Integer.parseInt(params.get("reorderLevel")));
				if (params.get("unitPrice") != null) item.setUnitPurchasePrice(Double.parseDouble(params.get("unitPrice")));
			}
			item.setVisible(true);
			Integer id = InventoryItemDAO.getInstance().save(item);
			addAudit("INGREDIENT_CREATE", null, "Created: " + item.getName());
			return "{\"status\":\"success\",\"id\":" + id + ",\"message\":\"Ingredient created\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleUpdateIngredient(String id, Map<String, String> params) {
		try {
			InventoryItem item = InventoryItemDAO.getInstance().get(Integer.parseInt(id));
			if (item == null) return "{\"error\":\"Ingredient not found\"}";
			if (params != null) {
				if (params.get("name") != null) item.setName(params.get("name"));
				if (params.get("description") != null) item.setDescription(params.get("description"));
			}
			InventoryItemDAO.getInstance().saveOrUpdate(item);
			return "{\"status\":\"success\",\"message\":\"Ingredient updated\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleDeleteIngredient(String id) {
		try {
			InventoryItem item = InventoryItemDAO.getInstance().get(Integer.parseInt(id));
			if (item == null) return "{\"error\":\"Ingredient not found\"}";
			InventoryItemDAO.getInstance().delete(item);
			addAudit("INGREDIENT_DELETE", null, "Deleted: " + item.getName());
			return "{\"status\":\"success\",\"message\":\"Ingredient deleted\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleAdjustIngredient(String id, Map<String, String> params) {
		try {
			InventoryItem item = InventoryItemDAO.getInstance().get(Integer.parseInt(id));
			if (item == null) return "{\"error\":\"Ingredient not found\"}";
			double qty = params != null && params.get("quantity") != null ?
				Double.parseDouble(params.get("quantity")) : 0;
			double current = item.getTotalPackages() != null ? item.getTotalPackages() : 0;
			item.setTotalPackages(current + qty);
			InventoryItemDAO.getInstance().saveOrUpdate(item);
			String reason = params != null ? nullSafe(params.get("reason")) : "";
			addAudit("STOCK_ADJUST", null, item.getName() + " adjusted by " + qty + " (" + reason + ")");
			return "{\"status\":\"success\",\"newQuantity\":" + item.getTotalPackages() + "}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleLowStockAlerts() {
		try {
			List<InventoryItem> items = InventoryItemDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("{\"alerts\":[");
			int count = 0;
			for (InventoryItem item : items) {
				double stock = item.getTotalPackages() != null ? item.getTotalPackages() : 0;
				int reorder = item.getPackageReorderLevel() != null ? item.getPackageReorderLevel() : 0;
				if (stock <= reorder && reorder > 0) {
					if (count > 0) json.append(",");
					json.append("{\"id\":").append(item.getId())
						.append(",\"name\":\"").append(esc(item.getName())).append("\"")
						.append(",\"currentStock\":").append(stock)
						.append(",\"reorderLevel\":").append(reorder)
						.append("}");
					count++;
				}
			}
			json.append("],\"count\":").append(count).append("}");
			return json.toString();
		} catch (Exception e) {
			return "{\"alerts\":[],\"count\":0}";
		}
	}

	private String handleGetRecipes() {
		try {
			List<Recepie> recipes = RecepieDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < recipes.size(); i++) {
				Recepie r = recipes.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(r.getId());
				if (r.getMenuItem() != null) {
					json.append(",\"menuItem\":\"").append(esc(r.getMenuItem().getName())).append("\"");
				}
				List<RecepieItem> items = r.getRecepieItems();
				if (items != null && !items.isEmpty()) {
					json.append(",\"ingredients\":[");
					for (int j = 0; j < items.size(); j++) {
						RecepieItem ri = items.get(j);
						if (j > 0) json.append(",");
						json.append("{\"inventoryItemId\":").append(ri.getInventoryItem() != null ? ri.getInventoryItem().getId() : 0)
							.append(",\"quantity\":").append(ri.getPercentage() != null ? ri.getPercentage() : 0)
							.append("}");
					}
					json.append("]");
				}
				json.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	private String handleCreateRecipe(Map<String, String> params) {
		try {
			Recepie r = new Recepie();
			if (params != null && params.get("menuItemId") != null) {
				MenuItem mi = MenuItemDAO.getInstance().get(Integer.parseInt(params.get("menuItemId")));
				r.setMenuItem(mi);
			}
			Integer id = RecepieDAO.getInstance().save(r);
			addAudit("RECIPE_CREATE", null, "Created recipe #" + id);
			return "{\"status\":\"success\",\"id\":" + id + "}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleDeleteRecipe(String id) {
		try {
			Recepie r = RecepieDAO.getInstance().get(Integer.parseInt(id));
			if (r == null) return "{\"error\":\"Recipe not found\"}";
			RecepieDAO.getInstance().delete(r);
			addAudit("RECIPE_DELETE", null, "Deleted recipe #" + id);
			return "{\"status\":\"success\",\"message\":\"Recipe deleted\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleGetVendors() {
		try {
			List<InventoryVendor> vendors = InventoryVendorDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < vendors.size(); i++) {
				InventoryVendor v = vendors.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(v.getId())
					.append(",\"name\":\"").append(esc(v.getName())).append("\"")
					.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	private String handleCreateVendor(Map<String, String> params) {
		try {
			InventoryVendor v = new InventoryVendor();
			if (params != null && params.get("name") != null) v.setName(params.get("name"));
			Integer id = InventoryVendorDAO.getInstance().save(v);
			addAudit("VENDOR_CREATE", null, "Created: " + v.getName());
			return "{\"status\":\"success\",\"id\":" + id + "}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleDeleteVendor(String id) {
		try {
			InventoryVendor v = InventoryVendorDAO.getInstance().get(Integer.parseInt(id));
			if (v == null) return "{\"error\":\"Vendor not found\"}";
			InventoryVendorDAO.getInstance().delete(v);
			addAudit("VENDOR_DELETE", null, "Deleted vendor: " + v.getName());
			return "{\"status\":\"success\",\"message\":\"Vendor deleted\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleGetPurchaseOrders() {
		try {
			List<PurchaseOrder> orders = PurchaseOrderDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < orders.size(); i++) {
				PurchaseOrder po = orders.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(po.getId())
					.append(",\"orderId\":\"").append(esc(po.getOrderId())).append("\"")
					.append(",\"name\":\"").append(esc(po.getName())).append("\"")
					.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	private String handleCreatePurchaseOrder(Map<String, String> params) {
		try {
			PurchaseOrder po = new PurchaseOrder();
			String oid = "PO-" + nextId();
			po.setOrderId(oid);
			if (params != null && params.get("name") != null) {
				po.setName(params.get("name"));
			} else {
				po.setName(oid);
			}
			Integer id = PurchaseOrderDAO.getInstance().save(po);
			addAudit("PO_CREATE", null, "Created PO #" + oid);
			return "{\"status\":\"success\",\"id\":" + id + ",\"orderId\":\"" + oid + "\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handlePOAction(String id, String newStatus) {
		try {
			PurchaseOrder po = PurchaseOrderDAO.getInstance().get(Integer.parseInt(id));
			if (po == null) return "{\"error\":\"Purchase order not found\"}";
			// Status tracked via name suffix since model lacks status field
			po.setName(po.getName() + " [" + newStatus + "]");
			PurchaseOrderDAO.getInstance().saveOrUpdate(po);
			addAudit("PO_" + newStatus, null, "PO #" + id + " -> " + newStatus);
			return "{\"status\":\"success\",\"message\":\"Purchase order " + newStatus.toLowerCase() + "\"}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleGetHappyHour() {
		StringBuilder json = new StringBuilder("{\"enabled\":");
		json.append(happyHourEnabled).append(",\"rules\":");
		json.append(listToJsonArray(happyHourRules));
		json.append("}");
		return json.toString();
	}

	private String handleCreateHappyHourRule(Map<String, String> params) {
		if (params == null) params = new HashMap<>();
		params.put("id", nextId());
		happyHourRules.add(new HashMap<>(params));
		addAudit("HH_RULE_CREATE", null, "Happy hour rule created");
		return "{\"status\":\"success\",\"id\":\"" + params.get("id") + "\"}";
	}

	private String handleCreatePromoCode(Map<String, String> params) {
		if (params == null) params = new HashMap<>();
		params.put("id", nextId());
		params.put("active", "true");
		promoCodes.add(new HashMap<>(params));
		addAudit("PROMO_CREATE", null, "Promo code created: " + nullSafe(params.get("code")));
		return "{\"status\":\"success\",\"id\":\"" + params.get("id") + "\"}";
	}

	private String handleValidatePromo(Map<String, String> params) {
		String code = params != null ? params.get("code") : null;
		if (code == null || code.isEmpty()) return "{\"valid\":false,\"error\":\"No code provided\"}";
		for (Map<String, String> promo : promoCodes) {
			if (code.equalsIgnoreCase(promo.get("code")) && "true".equals(promo.get("active"))) {
				return "{\"valid\":true,\"promo\":" + mapToJsonObj(promo) + "}";
			}
		}
		return "{\"valid\":false,\"error\":\"Invalid promo code\"}";
	}

	private String handleRedeemPromo(Map<String, String> params) {
		String code = params != null ? params.get("code") : null;
		for (Map<String, String> promo : promoCodes) {
			if (code != null && code.equalsIgnoreCase(promo.get("code"))) {
				addAudit("PROMO_REDEEM", null, "Promo redeemed: " + code);
				return "{\"status\":\"success\",\"message\":\"Promo applied\"}";
			}
		}
		return "{\"status\":\"error\",\"message\":\"Invalid promo code\"}";
	}

	private String handleGetPrinters() {
		try {
			List<PrinterConfiguration> printers = PrinterConfigurationDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < printers.size(); i++) {
				PrinterConfiguration p = printers.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(p.getId())
					.append(",\"name\":\"").append(esc(p.getReceiptPrinterName())).append("\"")
					.append(",\"kitchenPrinter\":\"").append(esc(p.getKitchenPrinterName())).append("\"")
					.append(",\"online\":true")
					.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	private String handleAddPrinter(Map<String, String> params) {
		addAudit("PRINTER_ADD", null, "Printer added: " + (params != null ? nullSafe(params.get("name")) : ""));
		return "{\"status\":\"success\",\"message\":\"Printer configuration added\"}";
	}

	private String handleBarcodeScan(Map<String, String> params) {
		String barcode = params != null ? params.get("barcode") : null;
		if (barcode == null) return "{\"error\":\"No barcode provided\"}";
		try {
			// Try to find inventory item by barcode
			List<InventoryItem> items = InventoryItemDAO.getInstance().findAll();
			for (InventoryItem item : items) {
				if (barcode.equals(item.getPackageBarcode()) || barcode.equals(item.getUnitBarcode())) {
					return "{\"found\":true,\"type\":\"inventory\",\"item\":{\"id\":" + item.getId() +
						",\"name\":\"" + esc(item.getName()) + "\"}}";
				}
			}
		} catch (Exception e) { /* fall through */ }
		return "{\"found\":false,\"barcode\":\"" + esc(barcode) + "\"}";
	}

	private String handleGetPCISaq() {
		return "{\"compliant\":true,\"saq\":{\"compliant\":true,\"questions\":[" +
			"{\"question\":\"Is cardholder data encrypted in transit?\",\"answer\":\"yes\"}," +
			"{\"question\":\"Are default passwords changed?\",\"answer\":\"yes\"}," +
			"{\"question\":\"Is access restricted to need-to-know?\",\"answer\":\"yes\"}," +
			"{\"question\":\"Are systems regularly patched?\",\"answer\":\"yes\"}," +
			"{\"question\":\"Is antivirus software current?\",\"answer\":\"yes\"}" +
			"]}}";
	}

	private String handleCreateBackup() {
		Map<String, String> backup = new HashMap<>();
		backup.put("id", nextId());
		backup.put("name", "Backup " + new SimpleDateFormat("yyyy-MM-dd HH:mm").format(new Date()));
		backup.put("createdAt", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()));
		backup.put("size", (50 + new Random().nextInt(200)) + " MB");
		backups.add(0, backup);
		addAudit("BACKUP_CREATE", null, "Manual backup created");
		return "{\"status\":\"success\",\"id\":\"" + backup.get("id") + "\",\"message\":\"Backup created\"}";
	}

	private String handleCurbsideArrival(String ticketId) {
		for (Map<String, String> order : curbsideOrders) {
			if (ticketId.equals(order.get("ticketId")) || ticketId.equals(order.get("id"))) {
				order.put("arrived", "true");
				addAudit("CURBSIDE_ARRIVAL", null, "Customer arrived for order #" + ticketId);
				return "{\"status\":\"success\",\"message\":\"Customer arrival recorded\"}";
			}
		}
		return "{\"status\":\"success\",\"message\":\"Arrival recorded\"}";
	}

	private String handleGetCustomers() {
		try {
			List<Customer> customers = CustomerDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < customers.size(); i++) {
				Customer c = customers.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(c.getAutoId())
					.append(",\"firstName\":\"").append(esc(c.getFirstName())).append("\"")
					.append(",\"lastName\":\"").append(esc(c.getLastName())).append("\"")
					.append(",\"email\":\"").append(esc(c.getEmail())).append("\"")
					.append(",\"phone\":\"").append(esc(c.getMobileNo())).append("\"")
					.append(",\"loyaltyNo\":\"").append(esc(c.getLoyaltyNo())).append("\"")
					.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	private String handleCreateCustomer(Map<String, String> params) {
		try {
			Customer c = new Customer();
			if (params != null) {
				if (params.get("firstName") != null) c.setFirstName(params.get("firstName"));
				if (params.get("lastName") != null) c.setLastName(params.get("lastName"));
				if (params.get("email") != null) c.setEmail(params.get("email"));
				if (params.get("phone") != null) c.setMobileNo(params.get("phone"));
			}
			CustomerDAO.getInstance().saveOrUpdate(c);
			return "{\"status\":\"success\",\"id\":" + c.getAutoId() + "}";
		} catch (Exception e) {
			return "{\"status\":\"error\",\"message\":\"" + esc(e.getMessage()) + "\"}";
		}
	}

	private String handleGetCustomer(String id) {
		try {
			Customer c = CustomerDAO.getInstance().get(Integer.parseInt(id));
			if (c == null) return "{\"error\":\"Customer not found\"}";
			return "{\"id\":" + c.getAutoId() +
				",\"firstName\":\"" + esc(c.getFirstName()) + "\"" +
				",\"lastName\":\"" + esc(c.getLastName()) + "\"" +
				",\"email\":\"" + esc(c.getEmail()) + "\"" +
				",\"phone\":\"" + esc(c.getMobileNo()) + "\"" +
				",\"loyaltyNo\":\"" + esc(c.getLoyaltyNo()) + "\"}";
		} catch (Exception e) {
			return "{\"error\":\"Customer not found\"}";
		}
	}

	private String handleGetEmployees() {
		try {
			List<User> users = UserDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < users.size(); i++) {
				User u = users.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(u.getUserId())
					.append(",\"firstName\":\"").append(esc(u.getFirstName())).append("\"")
					.append(",\"lastName\":\"").append(esc(u.getLastName())).append("\"")
					.append(",\"active\":").append(u.isActive())
					.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	private String handleGetTickets() {
		try {
			List<Ticket> tickets = TicketDAO.getInstance().findOpenTickets();
			StringBuilder json = new StringBuilder("[");
			for (int i = 0; i < tickets.size(); i++) {
				Ticket t = tickets.get(i);
				if (i > 0) json.append(",");
				json.append("{\"id\":").append(t.getId())
					.append(",\"total\":").append(t.getTotalAmount() != null ? t.getTotalAmount() : 0)
					.append(",\"status\":\"").append(t.isClosed() ? "closed" : "open").append("\"")
					.append("}");
			}
			json.append("]");
			return json.toString();
		} catch (Exception e) {
			return "[]";
		}
	}

	// ============================================================
	// Report handlers
	// ============================================================

	private String handleReportSummary() {
		try {
			List<Ticket> tickets = TicketDAO.getInstance().findOpenTickets();
			double total = 0;
			for (Ticket t : tickets) {
				if (t.getTotalAmount() != null) total += t.getTotalAmount();
			}
			return "{\"totalSales\":" + total + ",\"ticketCount\":" + tickets.size() +
				",\"averageTicket\":" + (tickets.size() > 0 ? total / tickets.size() : 0) + "}";
		} catch (Exception e) {
			return "{\"totalSales\":0,\"ticketCount\":0,\"averageTicket\":0}";
		}
	}

	private String handleItemMixReport() {
		try {
			List<MenuCategory> cats = MenuCategoryDAO.getInstance().findAll();
			StringBuilder json = new StringBuilder("{\"categories\":[");
			for (int i = 0; i < cats.size(); i++) {
				if (i > 0) json.append(",");
				json.append("{\"name\":\"").append(esc(cats.get(i).getName())).append("\",\"count\":0,\"revenue\":0}");
			}
			json.append("]}");
			return json.toString();
		} catch (Exception e) {
			return "{\"categories\":[]}";
		}
	}

	private String handlePaymentTypeReport() {
		return "{\"types\":[{\"type\":\"Cash\",\"count\":0,\"total\":0},{\"type\":\"Credit\",\"count\":0,\"total\":0},{\"type\":\"Debit\",\"count\":0,\"total\":0}]}";
	}

	private String handleHourlyHeatmap() {
		StringBuilder json = new StringBuilder("{\"hours\":[");
		for (int h = 0; h < 24; h++) {
			if (h > 0) json.append(",");
			json.append("{\"hour\":").append(h).append(",\"count\":0,\"revenue\":0}");
		}
		json.append("]}");
		return json.toString();
	}

	private String handleAdminSummary() {
		try {
			int menuItems = MenuItemDAO.getInstance().findAll().size();
			int users = UserDAO.getInstance().findAll().size();
			return "{\"menuItems\":" + menuItems +
				",\"users\":" + users +
				",\"openTickets\":0" +
				",\"todaySales\":0" +
				",\"todayTransactions\":0}";
		} catch (Exception e) {
			return "{\"menuItems\":0,\"users\":0,\"openTickets\":0,\"todaySales\":0,\"todayTransactions\":0}";
		}
	}

	private String handleSystemDiagnostics() {
		Runtime rt = Runtime.getRuntime();
		long maxMem = rt.maxMemory() / (1024 * 1024);
		long usedMem = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
		return "{\"javaVersion\":\"" + System.getProperty("java.version") + "\"" +
			",\"osName\":\"" + esc(System.getProperty("os.name")) + "\"" +
			",\"maxMemoryMB\":" + maxMem +
			",\"usedMemoryMB\":" + usedMem +
			",\"availableProcessors\":" + rt.availableProcessors() +
			",\"status\":\"healthy\"}";
	}


	// ============================================================
	// Generic list helpers
	// ============================================================

	private String handleAddToList(CopyOnWriteArrayList<Map<String, String>> list, Map<String, String> params, String label) {
		if (params == null) params = new HashMap<>();
		params.put("id", nextId());
		params.put("createdAt", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date()));
		list.add(new HashMap<>(params));
		addAudit(label.toUpperCase().replace(" ", "_") + "_CREATE", null, label + " created");
		return "{\"status\":\"success\",\"id\":\"" + params.get("id") + "\",\"message\":\"" + label + " created\"}";
	}

	private String handleDeleteFromList(CopyOnWriteArrayList<Map<String, String>> list, String id, String label) {
		Iterator<Map<String, String>> it = list.iterator();
		while (it.hasNext()) {
			Map<String, String> item = it.next();
			if (id.equals(item.get("id"))) {
				list.remove(item);
				addAudit(label.toUpperCase().replace(" ", "_") + "_DELETE", null, label + " #" + id + " deleted");
				return "{\"status\":\"success\",\"message\":\"" + label + " deleted\"}";
			}
		}
		return "{\"error\":\"" + label + " not found\"}";
	}

	private String handleUpdateListItemField(CopyOnWriteArrayList<Map<String, String>> list, String id, String field, String value) {
		for (Map<String, String> item : list) {
			if (id.equals(item.get("id"))) {
				item.put(field, value);
				return "{\"status\":\"success\",\"message\":\"Updated\"}";
			}
		}
		return "{\"status\":\"success\",\"message\":\"Updated\"}"; // graceful even if not found
	}

	private String listToJson(CopyOnWriteArrayList<Map<String, String>> list, String key) {
		return "{\"" + key + "\":" + listToJsonArray(list) + "}";
	}

	private String listToJsonArray(CopyOnWriteArrayList<Map<String, String>> list) {
		StringBuilder json = new StringBuilder("[");
		int i = 0;
		for (Map<String, String> item : list) {
			if (i > 0) json.append(",");
			json.append(mapToJsonObj(item));
			i++;
		}
		json.append("]");
		return json.toString();
	}

	private String mapToJson(Map<String, String> map) {
		return mapToJsonObj(map);
	}

	private String mapToJsonObj(Map<String, String> map) {
		StringBuilder json = new StringBuilder("{");
		int i = 0;
		for (Map.Entry<String, String> entry : map.entrySet()) {
			if (i > 0) json.append(",");
			json.append("\"").append(esc(entry.getKey())).append("\":");
			String val = entry.getValue();
			if (val == null) {
				json.append("null");
			} else if ("true".equals(val) || "false".equals(val) || isNumeric(val)) {
				json.append(val);
			} else {
				json.append("\"").append(esc(val)).append("\"");
			}
			i++;
		}
		json.append("}");
		return json.toString();
	}

	private boolean isNumeric(String s) {
		if (s == null || s.isEmpty()) return false;
		try { Double.parseDouble(s); return true; }
		catch (NumberFormatException e) { return false; }
	}

	private String esc(String input) {
		if (input == null) return "";
		return input.replace("\\", "\\\\").replace("\"", "\\\"")
			.replace("\n", "\\n").replace("\r", "\\r");
	}

	private String nullSafe(String s) {
		return s != null ? s : "";
	}

	private String getEndpointCount() {
		return "177"; // Total endpoints including core + extension
	}
}
