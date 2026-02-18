/**
 * Core calculation engine for cash discount / card surcharge pricing.
 *
 * Integrates with the Floreant POS Ticket model to adjust pricing
 * based on the payment method selected at settlement time.
 */
package com.floreantpos.cashdiscount;

import com.floreantpos.cashdiscount.CashDiscountConfig.PricingMode;
import com.floreantpos.model.Ticket;
import com.floreantpos.util.NumberUtil;

public class CashDiscountCalculator {

	/**
	 * Result of a cash discount / surcharge calculation.
	 */
	public static class PricingAdjustment {
		private final double adjustmentAmount;
		private final String label;
		private final boolean isDiscount;
		private final double adjustedSubtotal;
		private final double adjustedTotal;
		private final double cashPrice;
		private final double cardPrice;

		public PricingAdjustment(double adjustmentAmount, String label, boolean isDiscount,
				double adjustedSubtotal, double adjustedTotal, double cashPrice, double cardPrice) {
			this.adjustmentAmount = NumberUtil.roundToTwoDecimal(adjustmentAmount);
			this.label = label;
			this.isDiscount = isDiscount;
			this.adjustedSubtotal = NumberUtil.roundToTwoDecimal(adjustedSubtotal);
			this.adjustedTotal = NumberUtil.roundToTwoDecimal(adjustedTotal);
			this.cashPrice = NumberUtil.roundToTwoDecimal(cashPrice);
			this.cardPrice = NumberUtil.roundToTwoDecimal(cardPrice);
		}

		public double getAdjustmentAmount() {
			return adjustmentAmount;
		}

		public String getLabel() {
			return label;
		}

		public boolean isDiscount() {
			return isDiscount;
		}

		public double getAdjustedSubtotal() {
			return adjustedSubtotal;
		}

		public double getAdjustedTotal() {
			return adjustedTotal;
		}

		public double getCashPrice() {
			return cashPrice;
		}

		public double getCardPrice() {
			return cardPrice;
		}
	}

	/**
	 * Calculate cash discount for a ticket (customer is paying cash).
	 * In CASH_DISCOUNT mode: menu price is card price, so we subtract the discount.
	 * In CARD_SURCHARGE mode: menu price is cash price, no adjustment needed.
	 */
	public static PricingAdjustment calculateForCash(Ticket ticket) {
		if (!CashDiscountConfig.isEnabled()) {
			return noAdjustment(ticket);
		}

		PricingMode mode = CashDiscountConfig.getPricingMode();
		double rate = CashDiscountConfig.getRate() / 100.0;
		double subtotal = ticket.getSubtotalAmount();
		double taxAmount = ticket.getTaxAmount();
		double totalBeforeAdj = subtotal + taxAmount;

		switch (mode) {
			case CASH_DISCOUNT:
				// Menu price includes surcharge. Cash customers get the discount.
				double discountAmount;
				double adjustedSubtotal;
				double adjustedTotal;

				if (CashDiscountConfig.isApplyBeforeTax()) {
					discountAmount = subtotal * rate;
					adjustedSubtotal = subtotal - discountAmount;
					// Tax recalculated on adjusted subtotal would be done by the ticket engine
					adjustedTotal = totalBeforeAdj - discountAmount;
				} else {
					discountAmount = totalBeforeAdj * rate;
					adjustedSubtotal = subtotal;
					adjustedTotal = totalBeforeAdj - discountAmount;
				}

				double cashPrice = adjustedTotal;
				double cardPrice = totalBeforeAdj;

				return new PricingAdjustment(
						discountAmount,
						CashDiscountConfig.getCashDiscountLabel(),
						true, // is a discount
						adjustedSubtotal,
						adjustedTotal,
						cashPrice,
						cardPrice);

			case CARD_SURCHARGE:
				// Menu price is cash price. No adjustment for cash.
				return noAdjustment(ticket);

			default:
				return noAdjustment(ticket);
		}
	}

	/**
	 * Calculate card surcharge for a ticket (customer is paying by card).
	 * In CASH_DISCOUNT mode: menu price is card price, no adjustment needed.
	 * In CARD_SURCHARGE mode: menu price is cash price, so we add the surcharge.
	 */
	public static PricingAdjustment calculateForCard(Ticket ticket) {
		return calculateForCard(ticket, false);
	}

	/**
	 * Calculate card surcharge for a ticket with debit card consideration.
	 *
	 * @param ticket    the ticket to calculate for
	 * @param isDebit   whether the card is a debit card
	 */
	public static PricingAdjustment calculateForCard(Ticket ticket, boolean isDebit) {
		if (!CashDiscountConfig.isEnabled()) {
			return noAdjustment(ticket);
		}

		// Check debit exemption
		if (isDebit && CashDiscountConfig.isExemptDebit()) {
			return noAdjustment(ticket);
		}

		PricingMode mode = CashDiscountConfig.getPricingMode();
		double rate = CashDiscountConfig.getRate() / 100.0;
		double subtotal = ticket.getSubtotalAmount();
		double taxAmount = ticket.getTaxAmount();
		double totalBeforeAdj = subtotal + taxAmount;

		// Check minimum card amount
		if (totalBeforeAdj < CashDiscountConfig.getMinCardAmount()) {
			return noAdjustment(ticket);
		}

		switch (mode) {
			case CARD_SURCHARGE:
				// Menu price is cash price. Card customers pay surcharge.
				double surchargeAmount;
				double adjustedSubtotal;
				double adjustedTotal;

				if (CashDiscountConfig.isApplyBeforeTax()) {
					surchargeAmount = subtotal * rate;
					adjustedSubtotal = subtotal + surchargeAmount;
					adjustedTotal = totalBeforeAdj + surchargeAmount;
				} else {
					surchargeAmount = totalBeforeAdj * rate;
					adjustedSubtotal = subtotal;
					adjustedTotal = totalBeforeAdj + surchargeAmount;
				}

				double cashPrice = totalBeforeAdj;
				double cardPrice = adjustedTotal;

				return new PricingAdjustment(
						surchargeAmount,
						CashDiscountConfig.getSurchargeLabel(),
						false, // is a surcharge, not a discount
						adjustedSubtotal,
						adjustedTotal,
						cashPrice,
						cardPrice);

			case CASH_DISCOUNT:
				// Menu price is card price. No adjustment for card.
				return noAdjustment(ticket);

			default:
				return noAdjustment(ticket);
		}
	}

	/**
	 * Get dual pricing display values for a given item price.
	 * Returns [cashPrice, cardPrice].
	 */
	public static double[] getDualPrices(double menuPrice) {
		if (!CashDiscountConfig.isEnabled()) {
			return new double[] { menuPrice, menuPrice };
		}

		double rate = CashDiscountConfig.getRate() / 100.0;
		PricingMode mode = CashDiscountConfig.getPricingMode();

		switch (mode) {
			case CASH_DISCOUNT:
				// Menu price = card price. Cash price = menu - discount.
				double cashPrice = menuPrice * (1.0 - rate);
				return new double[] {
						NumberUtil.roundToTwoDecimal(cashPrice),
						NumberUtil.roundToTwoDecimal(menuPrice)
				};

			case CARD_SURCHARGE:
				// Menu price = cash price. Card price = menu + surcharge.
				double cardPrice = menuPrice * (1.0 + rate);
				return new double[] {
						NumberUtil.roundToTwoDecimal(menuPrice),
						NumberUtil.roundToTwoDecimal(cardPrice)
				};

			default:
				return new double[] { menuPrice, menuPrice };
		}
	}

	/**
	 * Format the adjustment line for receipt printing.
	 */
	public static String formatForReceipt(PricingAdjustment adjustment) {
		if (adjustment.getAdjustmentAmount() == 0) {
			return "";
		}

		StringBuilder sb = new StringBuilder();
		sb.append(adjustment.getLabel());
		sb.append(" (");
		sb.append(String.format("%.1f%%", CashDiscountConfig.getRate()));
		sb.append("): ");

		if (adjustment.isDiscount()) {
			sb.append("-$");
		} else {
			sb.append("+$");
		}
		sb.append(String.format("%.2f", adjustment.getAdjustmentAmount()));

		return sb.toString();
	}

	private static PricingAdjustment noAdjustment(Ticket ticket) {
		double subtotal = ticket.getSubtotalAmount();
		double total = subtotal + ticket.getTaxAmount();
		return new PricingAdjustment(0, "", false, subtotal, total, total, total);
	}
}
