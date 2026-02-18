/**
 * Batch Settlement Service for PaybotX/Valor terminals.
 *
 * Handles automatic end-of-day batch settlement:
 * - Closes all open batches on the terminal
 * - Generates settlement reports
 * - Can be scheduled for automatic execution
 */
package com.floreantpos.paybotx;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;
import java.util.Calendar;

import com.floreantpos.PosLog;
import com.floreantpos.paybotx.config.PaybotXConfig;

public class BatchSettlementService {
	private static BatchSettlementService instance;
	private Timer scheduleTimer;

	public static class BatchResult {
		public boolean success;
		public String batchId;
		public int transactionCount;
		public double totalAmount;
		public String message;
		public Date settledAt;

		@Override
		public String toString() {
			return String.format("BatchResult{success=%s, batchId='%s', txns=%d, total=$%.2f}",
					success, batchId, transactionCount, totalAmount);
		}
	}

	private BatchSettlementService() {}

	public static synchronized BatchSettlementService getInstance() {
		if (instance == null) {
			instance = new BatchSettlementService();
		}
		return instance;
	}

	/**
	 * Settle the current batch on the terminal.
	 */
	public BatchResult settleBatch() {
		BatchResult result = new BatchResult();
		result.settledAt = new Date();

		try {
			PaybotXTerminal terminal = PaybotXConfig.getActiveTerminal();
			if (terminal == null) {
				result.success = false;
				result.message = "No terminal configured";
				return result;
			}

			String requestXml = buildBatchSettleRequest(terminal);
			String response = sendRequest(requestXml, terminal);

			// Parse response
			result.success = response.contains("Approved") || response.contains("Success");
			result.message = result.success ? "Batch settled successfully" : "Batch settlement failed";

			PosLog.info(BatchSettlementService.class, "Batch settlement: {}", result);

		} catch (Exception e) {
			result.success = false;
			result.message = "Error: " + e.getMessage();
			PosLog.error(BatchSettlementService.class, "Batch settlement failed: " + e.getMessage());
		}

		return result;
	}

	/**
	 * Schedule automatic batch settlement at a specific time daily.
	 * @param hour   Hour of day (0-23)
	 * @param minute Minute (0-59)
	 */
	public void scheduleAutoSettle(int hour, int minute) {
		if (scheduleTimer != null) {
			scheduleTimer.cancel();
		}

		scheduleTimer = new Timer("BatchAutoSettle", true);

		Calendar now = Calendar.getInstance();
		Calendar nextRun = Calendar.getInstance();
		nextRun.set(Calendar.HOUR_OF_DAY, hour);
		nextRun.set(Calendar.MINUTE, minute);
		nextRun.set(Calendar.SECOND, 0);
		nextRun.set(Calendar.MILLISECOND, 0);

		if (nextRun.before(now)) {
			nextRun.add(Calendar.DAY_OF_MONTH, 1);
		}

		long delay = nextRun.getTimeInMillis() - now.getTimeInMillis();
		long period = 24 * 60 * 60 * 1000; // 24 hours

		scheduleTimer.scheduleAtFixedRate(new TimerTask() {
			@Override
			public void run() {
				PosLog.info(BatchSettlementService.class, "Running scheduled batch settlement");
				BatchResult result = settleBatch();
				PosLog.info(BatchSettlementService.class, "Scheduled settlement result: {}", result);
			}
		}, delay, period);

		SimpleDateFormat sdf = new SimpleDateFormat("HH:mm");
		PosLog.info(BatchSettlementService.class,
				"Auto batch settlement scheduled for {} daily", sdf.format(nextRun.getTime()));
	}

	public void cancelSchedule() {
		if (scheduleTimer != null) {
			scheduleTimer.cancel();
			scheduleTimer = null;
		}
	}

	private String buildBatchSettleRequest(PaybotXTerminal terminal) {
		StringBuilder xml = new StringBuilder();
		xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
		xml.append("<PaybotXRequest>");
		xml.append("<MerchantId>").append(terminal.getMerchantId()).append("</MerchantId>");
		xml.append("<TerminalId>").append(terminal.getTerminalId()).append("</TerminalId>");
		xml.append("<ApiKey>").append(terminal.getApiKey()).append("</ApiKey>");
		xml.append("<TransType>BatchSettle</TransType>");
		xml.append("</PaybotXRequest>");
		return xml.toString();
	}

	private String sendRequest(String requestXml, PaybotXTerminal terminal) throws Exception {
		String endpoint;
		String localUrl = terminal.getLocalBaseUrl();
		if (localUrl != null) {
			endpoint = localUrl + "/api/v1/batch";
		} else {
			endpoint = PaybotXConfig.getGatewayUrl() + "/api/v1/batch";
		}

		URL url = new URL(endpoint);
		HttpURLConnection connection = (HttpURLConnection) url.openConnection();

		try {
			connection.setRequestMethod("POST");
			connection.setRequestProperty("Content-Type", "application/xml");
			connection.setRequestProperty("X-Api-Key", terminal.getApiKey());
			connection.setDoOutput(true);
			connection.setConnectTimeout(60000);
			connection.setReadTimeout(60000);

			try (OutputStream os = connection.getOutputStream()) {
				os.write(requestXml.getBytes(StandardCharsets.UTF_8));
			}

			BufferedReader reader = new BufferedReader(
					new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
			StringBuilder response = new StringBuilder();
			String line;
			while ((line = reader.readLine()) != null) {
				response.append(line);
			}
			reader.close();

			return response.toString();
		} finally {
			connection.disconnect();
		}
	}

	public void shutdown() {
		cancelSchedule();
	}
}
