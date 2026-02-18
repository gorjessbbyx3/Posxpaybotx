/**
 * Cash Discount / Card Surcharge Configuration
 *
 * Supports dual-pricing models used with payment processors like PaybotX/Valor:
 * - Cash Discount: Menu prices include card surcharge; cash customers get a discount
 * - Card Surcharge: Menu prices are cash prices; card customers pay a surcharge
 *
 * This module integrates with the existing Floreant POS ticket pricing engine.
 */
package com.floreantpos.cashdiscount;

import com.floreantpos.config.AppConfig;

public class CashDiscountConfig {

	private static final String CASH_DISCOUNT_ENABLED = "cashDiscount.enabled";
	private static final String CASH_DISCOUNT_MODE = "cashDiscount.mode";
	private static final String CASH_DISCOUNT_RATE = "cashDiscount.rate";
	private static final String CASH_DISCOUNT_LABEL = "cashDiscount.label";
	private static final String SURCHARGE_LABEL = "cashDiscount.surchargeLabel";
	private static final String APPLY_BEFORE_TAX = "cashDiscount.applyBeforeTax";
	private static final String SHOW_DUAL_PRICING = "cashDiscount.showDualPricing";
	private static final String MIN_CARD_AMOUNT = "cashDiscount.minCardAmount";
	private static final String EXEMPT_DEBIT = "cashDiscount.exemptDebit";

	/**
	 * Pricing mode determines how the base menu price is interpreted.
	 */
	public enum PricingMode {
		/**
		 * Menu price IS the card price (includes surcharge).
		 * Cash customers receive a discount equal to the configured rate.
		 * This is the most common compliant model in the US.
		 */
		CASH_DISCOUNT,

		/**
		 * Menu price IS the cash price.
		 * Card customers pay an additional surcharge at the configured rate.
		 * Must comply with card brand rules (max 3% for Visa/MC).
		 */
		CARD_SURCHARGE,

		/**
		 * No cash discount or card surcharge applied.
		 */
		DISABLED
	}

	public static boolean isEnabled() {
		return AppConfig.getBoolean(CASH_DISCOUNT_ENABLED, false);
	}

	public static void setEnabled(boolean enabled) {
		AppConfig.put(CASH_DISCOUNT_ENABLED, enabled);
	}

	public static PricingMode getPricingMode() {
		String mode = AppConfig.getString(CASH_DISCOUNT_MODE, PricingMode.CASH_DISCOUNT.name());
		try {
			return PricingMode.valueOf(mode);
		} catch (IllegalArgumentException e) {
			return PricingMode.CASH_DISCOUNT;
		}
	}

	public static void setPricingMode(PricingMode mode) {
		AppConfig.put(CASH_DISCOUNT_MODE, mode.name());
	}

	/**
	 * The discount/surcharge rate as a percentage (e.g. 4.0 for 4%).
	 * For CARD_SURCHARGE mode, card brand rules typically cap this at 3-4%.
	 */
	public static double getRate() {
		try {
			return Double.parseDouble(AppConfig.getString(CASH_DISCOUNT_RATE, "4.0"));
		} catch (NumberFormatException e) {
			return 4.0;
		}
	}

	public static void setRate(double rate) {
		AppConfig.put(CASH_DISCOUNT_RATE, String.valueOf(rate));
	}

	/**
	 * Label shown on receipts for the cash discount line.
	 */
	public static String getCashDiscountLabel() {
		return AppConfig.getString(CASH_DISCOUNT_LABEL, "Cash Discount");
	}

	public static void setCashDiscountLabel(String label) {
		AppConfig.put(CASH_DISCOUNT_LABEL, label);
	}

	/**
	 * Label shown on receipts for the card surcharge line.
	 */
	public static String getSurchargeLabel() {
		return AppConfig.getString(SURCHARGE_LABEL, "Non-Cash Adjustment");
	}

	public static void setSurchargeLabel(String label) {
		AppConfig.put(SURCHARGE_LABEL, label);
	}

	/**
	 * Whether the discount/surcharge is applied before or after tax calculation.
	 * Before tax: adjustment is on subtotal, tax is calculated on adjusted amount.
	 * After tax: adjustment is on total including tax.
	 */
	public static boolean isApplyBeforeTax() {
		return AppConfig.getBoolean(APPLY_BEFORE_TAX, true);
	}

	public static void setApplyBeforeTax(boolean beforeTax) {
		AppConfig.put(APPLY_BEFORE_TAX, beforeTax);
	}

	/**
	 * Whether to show both cash and card prices on the order screen.
	 */
	public static boolean isShowDualPricing() {
		return AppConfig.getBoolean(SHOW_DUAL_PRICING, true);
	}

	public static void setShowDualPricing(boolean show) {
		AppConfig.put(SHOW_DUAL_PRICING, show);
	}

	/**
	 * Minimum transaction amount for card surcharge to apply.
	 * Transactions below this amount are not surcharged.
	 */
	public static double getMinCardAmount() {
		try {
			return Double.parseDouble(AppConfig.getString(MIN_CARD_AMOUNT, "0.00"));
		} catch (NumberFormatException e) {
			return 0.0;
		}
	}

	public static void setMinCardAmount(double amount) {
		AppConfig.put(MIN_CARD_AMOUNT, String.valueOf(amount));
	}

	/**
	 * Whether debit card transactions are exempt from surcharge.
	 * Some jurisdictions and card brand rules require debit exemption.
	 */
	public static boolean isExemptDebit() {
		return AppConfig.getBoolean(EXEMPT_DEBIT, true);
	}

	public static void setExemptDebit(boolean exempt) {
		AppConfig.put(EXEMPT_DEBIT, exempt);
	}
}
