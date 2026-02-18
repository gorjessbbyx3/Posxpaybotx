/**
 * Floreant POS Payment Gateway Plugin for PaybotX/Valor terminals.
 *
 * This plugin integrates external PaybotX payment terminals into the
 * Floreant POS payment flow. It follows the same plugin architecture
 * as the existing Authorize.Net and Mercury gateway plugins.
 *
 * Features:
 * - External EMV terminal support (chip, tap, swipe)
 * - Pre-auth and capture for bar tabs
 * - Tip adjustment after settlement
 * - Void/refund support
 * - Receipt printing via POS or terminal
 * - Cloud and local/LAN communication modes
 */
package com.floreantpos.paybotx;

import java.awt.Component;
import java.util.List;

import javax.swing.AbstractAction;
import javax.swing.JDialog;

import net.xeoh.plugins.base.annotations.PluginImplementation;

import com.floreantpos.config.ui.ConfigurationView;
import com.floreantpos.extension.PaymentGatewayPlugin;
import com.floreantpos.model.PosTransaction;
import com.floreantpos.model.Ticket;
import com.floreantpos.paybotx.config.PaybotXConfig;
import com.floreantpos.paybotx.config.PaybotXConfigView;
import com.floreantpos.report.ReceiptPrintService;
import com.floreantpos.ui.views.payment.CardProcessor;

@PluginImplementation
public class PaybotXGatewayPlugin extends PaymentGatewayPlugin {
	public static final String ID = "PaybotX/Valor";

	private PaybotXConfigView configView;
	private PaybotXProcessor processor;

	@Override
	public String getId() {
		return ID;
	}

	@Override
	public String getProductName() {
		return "PaybotX/Valor Gateway";
	}

	@Override
	public String getProductVersion() {
		return "1.0";
	}

	@Override
	public boolean requireLicense() {
		return false;
	}

	@Override
	public boolean hasValidLicense() {
		return true;
	}

	@Override
	public String getSecurityCode() {
		return "-1234567890";
	}

	/**
	 * Returns false because PaybotX uses an external terminal.
	 * The terminal handles card input directly (EMV chip/tap/swipe).
	 * No need for POS-side card input dialogs.
	 */
	@Override
	public boolean shouldShowCardInputProcessor() {
		return false;
	}

	@Override
	public CardProcessor getProcessor() {
		if (processor == null) {
			processor = new PaybotXProcessor();
		}
		return processor;
	}

	@Override
	public ConfigurationView getConfigurationPane() throws Exception {
		if (configView == null) {
			configView = new PaybotXConfigView();
			configView.initialize();
		}
		return configView;
	}

	@Override
	public boolean printUsingThisTerminal() {
		return PaybotXConfig.isPrintOnTerminal();
	}

	@Override
	public void printTicket(Ticket ticket) {
		if (printUsingThisTerminal()) {
			// When print-on-terminal is enabled, the PaybotX terminal
			// handles receipt printing. This is a no-op on the POS side.
			return;
		}
		try {
			ReceiptPrintService.printTicket(ticket);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	@Override
	public void printTicketWithTipsBlock(Ticket ticket) {
		try {
			ReceiptPrintService.printTicket(ticket);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	@Override
	public void printTransaction(PosTransaction transaction, boolean storeCopy, boolean customerCopy) {
		if (printUsingThisTerminal()) {
			return;
		}
		try {
			ReceiptPrintService.printTransaction(transaction);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	@Override
	public void initUI() {
		// No additional UI initialization needed
	}

	@Override
	public void initBackoffice() {
		// No additional back-office initialization needed
	}

	@Override
	public void initConfigurationView(JDialog dialog) {
		// No additional configuration dialog initialization
	}

	@Override
	public void initLicense() {
		// No license required
	}

	@Override
	public List<AbstractAction> getSpecialFunctionActions() {
		return null;
	}

	@Override
	public Component getParent() {
		return null;
	}

	@Override
	public String toString() {
		return getProductName();
	}
}
