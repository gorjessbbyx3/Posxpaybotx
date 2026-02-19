/**
 * Offline Payment Queue (Store & Forward)
 *
 * Queues payment transactions when the terminal or gateway is offline,
 * then processes them automatically when connectivity is restored.
 *
 * This implements the "store and forward" pattern required for
 * reliable payment processing in restaurant environments where
 * internet connectivity may be intermittent.
 */
package com.floreantpos.paybotx;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ConcurrentLinkedQueue;

import com.floreantpos.PosLog;
import com.floreantpos.model.Ticket;
import com.floreantpos.model.dao.TicketDAO;
import com.floreantpos.paybotx.config.PaybotXConfig;

public class OfflinePaymentQueue {
	private static OfflinePaymentQueue instance;
	private final ConcurrentLinkedQueue<QueuedPayment> queue;
	private final String queueFilePath;
	private Timer retryTimer;
	private boolean processing = false;
	private static final int RETRY_INTERVAL_MS = 30000; // 30 seconds
	private static final int MAX_RETRIES = 10;

	public static class QueuedPayment {
		public String ticketId;
		public double amount;
		public double tipAmount;
		public String paymentType;
		public String cardType;
		public String cardLast4;
		public String refId;
		public Date queuedAt;
		public int retryCount;
		public String status; // queued, processing, failed, completed

		@Override
		public String toString() {
			SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
			return String.format("%s|%s|%.2f|%.2f|%s|%s|%s|%s|%d|%s",
					ticketId, sdf.format(queuedAt), amount, tipAmount,
					paymentType, cardType != null ? cardType : "",
					cardLast4 != null ? cardLast4 : "",
					refId != null ? refId : "", retryCount, status);
		}

		public static QueuedPayment fromString(String line) {
			String[] parts = line.split("\\|", -1);
			if (parts.length < 10) return null;

			QueuedPayment qp = new QueuedPayment();
			try {
				SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
				qp.ticketId = parts[0];
				qp.queuedAt = sdf.parse(parts[1]);
				qp.amount = Double.parseDouble(parts[2]);
				qp.tipAmount = Double.parseDouble(parts[3]);
				qp.paymentType = parts[4];
				qp.cardType = parts[5].isEmpty() ? null : parts[5];
				qp.cardLast4 = parts[6].isEmpty() ? null : parts[6];
				qp.refId = parts[7].isEmpty() ? null : parts[7];
				qp.retryCount = Integer.parseInt(parts[8]);
				qp.status = parts[9];
				return qp;
			} catch (Exception e) {
				return null;
			}
		}
	}

	private OfflinePaymentQueue() {
		this.queue = new ConcurrentLinkedQueue<>();
		this.queueFilePath = System.getProperty("user.home") + File.separator
				+ ".floreantpos" + File.separator + "offline-payments.queue";
		loadFromDisk();
		startRetryTimer();
	}

	public static synchronized OfflinePaymentQueue getInstance() {
		if (instance == null) {
			instance = new OfflinePaymentQueue();
		}
		return instance;
	}

	/**
	 * Add a payment to the offline queue.
	 */
	public void enqueue(QueuedPayment payment) {
		payment.queuedAt = new Date();
		payment.status = "queued";
		payment.retryCount = 0;
		queue.add(payment);
		saveToDisk();
		PosLog.info(OfflinePaymentQueue.class,
				"Payment queued for ticket {}: ${}", payment.ticketId,
				String.format("%.2f", payment.amount));
	}

	/**
	 * Get all queued payments.
	 */
	public List<QueuedPayment> getQueuedPayments() {
		return new ArrayList<>(queue);
	}

	/**
	 * Get count of pending payments.
	 */
	public int getPendingCount() {
		int count = 0;
		for (QueuedPayment qp : queue) {
			if ("queued".equals(qp.status) || "processing".equals(qp.status)) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Process all queued payments (called when connectivity is restored).
	 */
	public synchronized void processQueue() {
		if (processing) return;
		processing = true;

		try {
			List<QueuedPayment> toProcess = new ArrayList<>();
			for (QueuedPayment qp : queue) {
				if ("queued".equals(qp.status) && qp.retryCount < MAX_RETRIES) {
					toProcess.add(qp);
				}
			}

			for (QueuedPayment qp : toProcess) {
				try {
					qp.status = "processing";
					qp.retryCount++;

					PosLog.info(OfflinePaymentQueue.class,
							"Processing queued payment for ticket {}, attempt {}",
							qp.ticketId, qp.retryCount);

					// Verify terminal connectivity before processing
					PaybotXTerminal terminal = PaybotXConfig.getActiveTerminal();
					if (terminal == null) {
						qp.status = "queued"; // No terminal configured, stay in queue
						PosLog.warn(OfflinePaymentQueue.class,
								"No active terminal — deferring ticket {}", qp.ticketId);
						continue;
					}

					// Load the ticket from DB
					Ticket ticket = TicketDAO.getInstance().get(Integer.parseInt(qp.ticketId));
					if (ticket == null) {
						PosLog.error(OfflinePaymentQueue.class,
								"Ticket {} not found — removing from queue", qp.ticketId);
						qp.status = "failed";
						continue;
					}

					// Process via PaybotXProcessor
					PaybotXProcessor processor = new PaybotXProcessor();
					processor.chargeAmount(ticket, qp.amount, qp.tipAmount, terminal);

					// Mark as completed on success
					qp.status = "completed";
					queue.remove(qp);
					PosLog.info(OfflinePaymentQueue.class,
							"Successfully processed queued payment for ticket {}", qp.ticketId);

				} catch (Exception e) {
					qp.status = "queued"; // Back to queue for retry
					PosLog.error(OfflinePaymentQueue.class,
							"Failed to process queued payment for ticket {}: {}",
							qp.ticketId, e.getMessage());
				}
			}

			// Remove completed and max-retry items
			queue.removeIf(qp ->
					"completed".equals(qp.status) || qp.retryCount >= MAX_RETRIES);

			saveToDisk();

		} finally {
			processing = false;
		}
	}

	/**
	 * Clear all queued payments.
	 */
	public void clear() {
		queue.clear();
		saveToDisk();
	}

	private void startRetryTimer() {
		retryTimer = new Timer("OfflinePaymentRetry", true);
		retryTimer.scheduleAtFixedRate(new TimerTask() {
			@Override
			public void run() {
				if (!queue.isEmpty()) {
					processQueue();
				}
			}
		}, RETRY_INTERVAL_MS, RETRY_INTERVAL_MS);
	}

	private void saveToDisk() {
		try {
			File file = new File(queueFilePath);
			file.getParentFile().mkdirs();

			try (PrintWriter writer = new PrintWriter(new FileWriter(file))) {
				for (QueuedPayment qp : queue) {
					writer.println(qp.toString());
				}
			}
		} catch (Exception e) {
			PosLog.error(OfflinePaymentQueue.class,
					"Failed to save payment queue: " + e.getMessage());
		}
	}

	private void loadFromDisk() {
		File file = new File(queueFilePath);
		if (!file.exists()) return;

		try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
			String line;
			while ((line = reader.readLine()) != null) {
				QueuedPayment qp = QueuedPayment.fromString(line.trim());
				if (qp != null && !"completed".equals(qp.status)) {
					qp.status = "queued"; // Reset status for retry
					queue.add(qp);
				}
			}
			PosLog.info(OfflinePaymentQueue.class,
					"Loaded {} queued payments from disk", queue.size());
		} catch (Exception e) {
			PosLog.error(OfflinePaymentQueue.class,
					"Failed to load payment queue: " + e.getMessage());
		}
	}

	public void shutdown() {
		if (retryTimer != null) {
			retryTimer.cancel();
		}
		saveToDisk();
	}
}
