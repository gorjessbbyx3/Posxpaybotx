/**
 * Configuration UI panel for Cash Discount / Card Surcharge settings.
 * Integrates into the Floreant POS back-office configuration system.
 */
package com.floreantpos.cashdiscount;

import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.BorderFactory;
import javax.swing.ButtonGroup;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JRadioButton;
import javax.swing.JTextField;

import com.floreantpos.cashdiscount.CashDiscountConfig.PricingMode;
import com.floreantpos.config.ui.ConfigurationView;
import com.floreantpos.ui.dialog.POSMessageDialog;

import net.miginfocom.swing.MigLayout;

public class CashDiscountConfigView extends ConfigurationView {

	private JCheckBox chkEnabled;
	private JRadioButton rbCashDiscount;
	private JRadioButton rbCardSurcharge;
	private JTextField tfRate;
	private JTextField tfCashDiscountLabel;
	private JTextField tfSurchargeLabel;
	private JCheckBox chkApplyBeforeTax;
	private JCheckBox chkShowDualPricing;
	private JTextField tfMinCardAmount;
	private JCheckBox chkExemptDebit;

	public CashDiscountConfigView() {
		setLayout(new BorderLayout());
		initComponents();
	}

	private void initComponents() {
		JPanel mainPanel = new JPanel(new MigLayout("wrap 2", "[right][grow,fill]", ""));
		mainPanel.setBorder(BorderFactory.createTitledBorder("Cash Discount / Card Surcharge Settings"));

		// Enable checkbox
		chkEnabled = new JCheckBox("Enable Cash Discount / Card Surcharge");
		mainPanel.add(chkEnabled, "span 2, wrap");

		// Pricing Mode
		JPanel modePanel = new JPanel(new GridLayout(2, 1));
		modePanel.setBorder(BorderFactory.createTitledBorder("Pricing Mode"));

		rbCashDiscount = new JRadioButton("Cash Discount (menu prices = card prices, cash gets discount)");
		rbCardSurcharge = new JRadioButton("Card Surcharge (menu prices = cash prices, card pays surcharge)");

		ButtonGroup modeGroup = new ButtonGroup();
		modeGroup.add(rbCashDiscount);
		modeGroup.add(rbCardSurcharge);

		modePanel.add(rbCashDiscount);
		modePanel.add(rbCardSurcharge);
		mainPanel.add(modePanel, "span 2, wrap");

		// Rate
		mainPanel.add(new JLabel("Rate (%):"));
		tfRate = new JTextField(10);
		mainPanel.add(tfRate);

		// Labels
		mainPanel.add(new JLabel("Cash Discount Label:"));
		tfCashDiscountLabel = new JTextField(20);
		mainPanel.add(tfCashDiscountLabel);

		mainPanel.add(new JLabel("Surcharge Label:"));
		tfSurchargeLabel = new JTextField(20);
		mainPanel.add(tfSurchargeLabel);

		// Options
		chkApplyBeforeTax = new JCheckBox("Apply adjustment before tax calculation");
		mainPanel.add(chkApplyBeforeTax, "span 2, wrap");

		chkShowDualPricing = new JCheckBox("Show dual pricing (cash & card) on order screen");
		mainPanel.add(chkShowDualPricing, "span 2, wrap");

		// Minimum card amount
		mainPanel.add(new JLabel("Min Card Amount for Surcharge ($):"));
		tfMinCardAmount = new JTextField(10);
		mainPanel.add(tfMinCardAmount);

		// Debit exemption
		chkExemptDebit = new JCheckBox("Exempt debit card transactions from surcharge");
		mainPanel.add(chkExemptDebit, "span 2, wrap");

		// Enable/disable controls based on enabled state
		chkEnabled.addActionListener(new ActionListener() {
			@Override
			public void actionPerformed(ActionEvent e) {
				setFieldsEnabled(chkEnabled.isSelected());
			}
		});

		add(mainPanel, BorderLayout.CENTER);
	}

	private void setFieldsEnabled(boolean enabled) {
		rbCashDiscount.setEnabled(enabled);
		rbCardSurcharge.setEnabled(enabled);
		tfRate.setEnabled(enabled);
		tfCashDiscountLabel.setEnabled(enabled);
		tfSurchargeLabel.setEnabled(enabled);
		chkApplyBeforeTax.setEnabled(enabled);
		chkShowDualPricing.setEnabled(enabled);
		tfMinCardAmount.setEnabled(enabled);
		chkExemptDebit.setEnabled(enabled);
	}

	@Override
	public boolean save() throws Exception {
		try {
			double rate = Double.parseDouble(tfRate.getText().trim());
			if (rate < 0 || rate > 10) {
				POSMessageDialog.showError(this, "Rate must be between 0 and 10 percent.");
				return false;
			}

			double minAmount = Double.parseDouble(tfMinCardAmount.getText().trim());
			if (minAmount < 0) {
				POSMessageDialog.showError(this, "Minimum card amount cannot be negative.");
				return false;
			}

			CashDiscountConfig.setEnabled(chkEnabled.isSelected());
			CashDiscountConfig.setPricingMode(
					rbCashDiscount.isSelected() ? PricingMode.CASH_DISCOUNT : PricingMode.CARD_SURCHARGE);
			CashDiscountConfig.setRate(rate);
			CashDiscountConfig.setCashDiscountLabel(tfCashDiscountLabel.getText().trim());
			CashDiscountConfig.setSurchargeLabel(tfSurchargeLabel.getText().trim());
			CashDiscountConfig.setApplyBeforeTax(chkApplyBeforeTax.isSelected());
			CashDiscountConfig.setShowDualPricing(chkShowDualPricing.isSelected());
			CashDiscountConfig.setMinCardAmount(minAmount);
			CashDiscountConfig.setExemptDebit(chkExemptDebit.isSelected());

			return true;
		} catch (NumberFormatException e) {
			POSMessageDialog.showError(this, "Please enter valid numeric values for rate and minimum amount.");
			return false;
		}
	}

	@Override
	public void initialize() throws Exception {
		chkEnabled.setSelected(CashDiscountConfig.isEnabled());

		PricingMode mode = CashDiscountConfig.getPricingMode();
		rbCashDiscount.setSelected(mode == PricingMode.CASH_DISCOUNT);
		rbCardSurcharge.setSelected(mode == PricingMode.CARD_SURCHARGE);

		tfRate.setText(String.valueOf(CashDiscountConfig.getRate()));
		tfCashDiscountLabel.setText(CashDiscountConfig.getCashDiscountLabel());
		tfSurchargeLabel.setText(CashDiscountConfig.getSurchargeLabel());
		chkApplyBeforeTax.setSelected(CashDiscountConfig.isApplyBeforeTax());
		chkShowDualPricing.setSelected(CashDiscountConfig.isShowDualPricing());
		tfMinCardAmount.setText(String.valueOf(CashDiscountConfig.getMinCardAmount()));
		chkExemptDebit.setSelected(CashDiscountConfig.isExemptDebit());

		setFieldsEnabled(chkEnabled.isSelected());
	}

	@Override
	public String getName() {
		return "Cash Discount";
	}
}
