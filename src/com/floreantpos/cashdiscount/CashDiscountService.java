/**
 * Service layer for applying cash discount / surcharge adjustments to tickets.
 *
 * This service is called during ticket settlement to apply the appropriate
 * pricing adjustment based on the payment method.
 */
package com.floreantpos.cashdiscount;

import com.floreantpos.PosLog;
import com.floreantpos.cashdiscount.CashDiscountCalculator.PricingAdjustment;
import com.floreantpos.model.CashTransaction;
import com.floreantpos.model.DebitCardTransaction;
import com.floreantpos.model.PosTransaction;
import com.floreantpos.model.Ticket;

public class CashDiscountService {

	private static CashDiscountService instance = new CashDiscountService();

	public static CashDiscountService getInstance() {
		return instance;
	}

	/**
	 * Apply the cash discount or card surcharge adjustment to the ticket
	 * based on the transaction payment type.
	 *
	 * This should be called BEFORE PosTransactionService.settleTicket()
	 * so the adjusted total is reflected in the ticket.
	 *
	 * @param ticket      the ticket being settled
	 * @param transaction the payment transaction
	 * @return the pricing adjustment that was applied, or null if none
	 */
	public PricingAdjustment applyAdjustment(Ticket ticket, PosTransaction transaction) {
		if (!CashDiscountConfig.isEnabled()) {
			return null;
		}

		PricingAdjustment adjustment;
		boolean isCash = transaction instanceof CashTransaction;
		boolean isDebit = transaction instanceof DebitCardTransaction;

		if (isCash) {
			adjustment = CashDiscountCalculator.calculateForCash(ticket);
		} else {
			adjustment = CashDiscountCalculator.calculateForCard(ticket, isDebit);
		}

		if (adjustment.getAdjustmentAmount() == 0) {
			return null;
		}

		// Store the adjustment in the ticket properties for receipt printing
		ticket.addProperty("cashDiscount.applied", "true");
		ticket.addProperty("cashDiscount.label", adjustment.getLabel());
		ticket.addProperty("cashDiscount.amount", String.valueOf(adjustment.getAdjustmentAmount()));
		ticket.addProperty("cashDiscount.isDiscount", String.valueOf(adjustment.isDiscount()));
		ticket.addProperty("cashDiscount.rate", String.valueOf(CashDiscountConfig.getRate()));

		// Apply the adjustment to the ticket's adjustment amount field
		double currentAdj = ticket.getAdjustmentAmount();
		if (adjustment.isDiscount()) {
			ticket.setAdjustmentAmount(currentAdj - adjustment.getAdjustmentAmount());
		} else {
			ticket.setAdjustmentAmount(currentAdj + adjustment.getAdjustmentAmount());
		}

		ticket.calculatePrice();

		PosLog.info(CashDiscountService.class,
				"Applied {} of ${} to ticket #{} ({}% {})",
				adjustment.getLabel(),
				String.format("%.2f", adjustment.getAdjustmentAmount()),
				ticket.getId(),
				String.format("%.1f", CashDiscountConfig.getRate()),
				adjustment.isDiscount() ? "discount" : "surcharge");

		return adjustment;
	}

	/**
	 * Remove any previously applied cash discount/surcharge from the ticket.
	 * Call this if the payment method changes during settlement.
	 */
	public void removeAdjustment(Ticket ticket) {
		String appliedStr = ticket.getProperty("cashDiscount.applied");
		if (!"true".equals(appliedStr)) {
			return;
		}

		String amountStr = ticket.getProperty("cashDiscount.amount");
		String isDiscountStr = ticket.getProperty("cashDiscount.isDiscount");

		if (amountStr != null) {
			try {
				double amount = Double.parseDouble(amountStr);
				boolean isDiscount = Boolean.parseBoolean(isDiscountStr);
				double currentAdj = ticket.getAdjustmentAmount();

				if (isDiscount) {
					ticket.setAdjustmentAmount(currentAdj + amount);
				} else {
					ticket.setAdjustmentAmount(currentAdj - amount);
				}
			} catch (NumberFormatException e) {
				PosLog.error(CashDiscountService.class, "Failed to parse cash discount amount: " + amountStr);
			}
		}

		ticket.removeProperty("cashDiscount.applied");
		ticket.removeProperty("cashDiscount.label");
		ticket.removeProperty("cashDiscount.amount");
		ticket.removeProperty("cashDiscount.isDiscount");
		ticket.removeProperty("cashDiscount.rate");

		ticket.calculatePrice();
	}

	/**
	 * Check whether a cash discount/surcharge is currently applied to the ticket.
	 */
	public boolean hasAdjustment(Ticket ticket) {
		return "true".equals(ticket.getProperty("cashDiscount.applied"));
	}

	/**
	 * Get a receipt-formatted string for the applied adjustment.
	 */
	public String getReceiptLine(Ticket ticket) {
		if (!hasAdjustment(ticket)) {
			return "";
		}

		String label = ticket.getProperty("cashDiscount.label");
		String amountStr = ticket.getProperty("cashDiscount.amount");
		String isDiscountStr = ticket.getProperty("cashDiscount.isDiscount");
		String rateStr = ticket.getProperty("cashDiscount.rate");

		if (label == null || amountStr == null) {
			return "";
		}

		boolean isDiscount = Boolean.parseBoolean(isDiscountStr);
		StringBuilder sb = new StringBuilder();
		sb.append(label);

		if (rateStr != null) {
			sb.append(" (").append(rateStr).append("%)");
		}

		sb.append(": ");
		sb.append(isDiscount ? "-$" : "+$");
		sb.append(amountStr);

		return sb.toString();
	}
}
