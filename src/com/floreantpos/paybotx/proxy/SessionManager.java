/**
 * Simple token-based session manager for the Web API.
 *
 * Generates secure random tokens at login, validates them on subsequent
 * requests via the Authorization header, and expires them after a
 * configurable timeout (default 8 hours — one restaurant shift).
 *
 * NOT a full JWT implementation — this is a lightweight session store
 * appropriate for a single-instance POS deployment.
 */
package com.floreantpos.paybotx.proxy;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.floreantpos.model.User;

public class SessionManager {

	private static SessionManager instance;

	// token -> session
	private final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();
	private final SecureRandom secureRandom = new SecureRandom();

	// 8 hours default session timeout (one shift)
	private static final long SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000L;

	// Clean up expired sessions every 30 minutes
	private static final long CLEANUP_INTERVAL_MS = 30 * 60 * 1000L;

	public static class Session {
		private final String token;
		private final int userId;
		private final String userName;
		private final String userType;
		private final long createdAt;
		private long lastAccessedAt;

		public Session(String token, int userId, String userName, String userType) {
			this.token = token;
			this.userId = userId;
			this.userName = userName;
			this.userType = userType;
			this.createdAt = System.currentTimeMillis();
			this.lastAccessedAt = this.createdAt;
		}

		public String getToken() { return token; }
		public int getUserId() { return userId; }
		public String getUserName() { return userName; }
		public String getUserType() { return userType; }
		public long getCreatedAt() { return createdAt; }
		public long getLastAccessedAt() { return lastAccessedAt; }

		public void touch() {
			this.lastAccessedAt = System.currentTimeMillis();
		}

		public boolean isExpired() {
			return (System.currentTimeMillis() - lastAccessedAt) > SESSION_TIMEOUT_MS;
		}

		public boolean isManager() {
			return "MANAGER".equalsIgnoreCase(userType) || "ADMIN".equalsIgnoreCase(userType);
		}
	}

	private SessionManager() {
		// Start background cleanup thread
		Thread cleanup = new Thread(() -> {
			while (true) {
				try {
					Thread.sleep(CLEANUP_INTERVAL_MS);
					purgeExpired();
				} catch (InterruptedException e) {
					Thread.currentThread().interrupt();
					break;
				}
			}
		}, "SessionCleanup");
		cleanup.setDaemon(true);
		cleanup.start();
	}

	public static synchronized SessionManager getInstance() {
		if (instance == null) {
			instance = new SessionManager();
		}
		return instance;
	}

	/**
	 * Create a new session for an authenticated user.
	 * Returns the session token.
	 */
	public String createSession(User user) {
		String token = generateToken();
		Session session = new Session(
				token,
				user.getUserId(),
				user.getFirstName() + " " + user.getLastName(),
				String.valueOf(user.getType()));
		sessions.put(token, session);
		return token;
	}

	/**
	 * Validate a token from the Authorization header.
	 * Expected format: "Bearer <token>"
	 * Returns the Session if valid, null otherwise.
	 */
	public Session validateToken(String authHeader) {
		if (authHeader == null || authHeader.isEmpty()) {
			return null;
		}

		String token;
		if (authHeader.startsWith("Bearer ")) {
			token = authHeader.substring(7).trim();
		} else {
			token = authHeader.trim();
		}

		if (token.isEmpty()) {
			return null;
		}

		Session session = sessions.get(token);
		if (session == null) {
			return null;
		}

		if (session.isExpired()) {
			sessions.remove(token);
			return null;
		}

		// Slide the expiration window
		session.touch();
		return session;
	}

	/**
	 * Invalidate (logout) a session.
	 */
	public void invalidateSession(String token) {
		if (token != null) {
			if (token.startsWith("Bearer ")) {
				token = token.substring(7).trim();
			}
			sessions.remove(token);
		}
	}

	/**
	 * Get count of active sessions.
	 */
	public int getActiveSessionCount() {
		purgeExpired();
		return sessions.size();
	}

	/**
	 * Remove all expired sessions.
	 */
	private void purgeExpired() {
		Iterator<Map.Entry<String, Session>> it = sessions.entrySet().iterator();
		while (it.hasNext()) {
			Map.Entry<String, Session> entry = it.next();
			if (entry.getValue().isExpired()) {
				it.remove();
			}
		}
	}

	/**
	 * Generate a cryptographically secure random token.
	 */
	private String generateToken() {
		byte[] bytes = new byte[32];
		secureRandom.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}
}
