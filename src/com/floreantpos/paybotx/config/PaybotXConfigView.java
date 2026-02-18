/**
 * Configuration UI panel for PaybotX/Valor terminal settings.
 * Integrates into the Floreant POS back-office configuration system.
 */
package com.floreantpos.paybotx.config;

import java.awt.BorderLayout;

import javax.swing.BorderFactory;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;

import com.floreantpos.config.ui.ConfigurationView;
import com.floreantpos.ui.dialog.POSMessageDialog;

import net.miginfocom.swing.MigLayout;

public class PaybotXConfigView extends ConfigurationView {

	private JTextField tfGatewayUrl;
	private JTextField tfMerchantId;
	private JPasswordField tfApiKey;
	private JTextField tfTerminalId;
	private JTextField tfTerminalIp;
	private JTextField tfTerminalPort;
	private JComboBox<String> cbTerminalModel;
	private JCheckBox chkCloudMode;
	private JCheckBox chkAutoSettle;
	private JCheckBox chkTipOnTerminal;
	private JCheckBox chkPrintOnTerminal;

	private static final String[] TERMINAL_MODELS = {
			"VP8800", "VX520", "VX680", "VX690", "VP3300",
			"Pax A920", "Pax A80", "Pax S300", "Ingenico Lane/3000",
			"Ingenico Move/5000", "Other"
	};

	public PaybotXConfigView() {
		setLayout(new BorderLayout());
		initComponents();
	}

	private void initComponents() {
		JPanel mainPanel = new JPanel(new MigLayout("wrap 2", "[right][grow,fill]", ""));
		mainPanel.setBorder(BorderFactory.createTitledBorder("PaybotX / Valor Gateway Settings"));

		// Gateway settings
		JPanel gatewayPanel = new JPanel(new MigLayout("wrap 2", "[right][grow,fill]", ""));
		gatewayPanel.setBorder(BorderFactory.createTitledBorder("Gateway Connection"));

		gatewayPanel.add(new JLabel("Gateway URL:"));
		tfGatewayUrl = new JTextField(30);
		gatewayPanel.add(tfGatewayUrl);

		gatewayPanel.add(new JLabel("Merchant ID:"));
		tfMerchantId = new JTextField(20);
		gatewayPanel.add(tfMerchantId);

		gatewayPanel.add(new JLabel("API Key:"));
		tfApiKey = new JPasswordField(30);
		gatewayPanel.add(tfApiKey);

		chkCloudMode = new JCheckBox("Cloud Mode (communicate via Valor Gateway cloud)");
		gatewayPanel.add(chkCloudMode, "span 2");

		mainPanel.add(gatewayPanel, "span 2, growx, wrap");

		// Terminal settings
		JPanel terminalPanel = new JPanel(new MigLayout("wrap 2", "[right][grow,fill]", ""));
		terminalPanel.setBorder(BorderFactory.createTitledBorder("Terminal Device"));

		terminalPanel.add(new JLabel("Terminal ID:"));
		tfTerminalId = new JTextField(15);
		terminalPanel.add(tfTerminalId);

		terminalPanel.add(new JLabel("Terminal IP (LAN):"));
		tfTerminalIp = new JTextField(15);
		terminalPanel.add(tfTerminalIp);

		terminalPanel.add(new JLabel("Terminal Port:"));
		tfTerminalPort = new JTextField(6);
		terminalPanel.add(tfTerminalPort);

		terminalPanel.add(new JLabel("Terminal Model:"));
		cbTerminalModel = new JComboBox<>(TERMINAL_MODELS);
		cbTerminalModel.setEditable(true);
		terminalPanel.add(cbTerminalModel);

		mainPanel.add(terminalPanel, "span 2, growx, wrap");

		// Operation settings
		JPanel opPanel = new JPanel(new MigLayout("wrap 1", "[grow,fill]", ""));
		opPanel.setBorder(BorderFactory.createTitledBorder("Operations"));

		chkAutoSettle = new JCheckBox("Auto-settle batch at end of day");
		opPanel.add(chkAutoSettle);

		chkTipOnTerminal = new JCheckBox("Prompt for tip on terminal device");
		opPanel.add(chkTipOnTerminal);

		chkPrintOnTerminal = new JCheckBox("Print receipt on terminal device (instead of POS printer)");
		opPanel.add(chkPrintOnTerminal);

		mainPanel.add(opPanel, "span 2, growx, wrap");

		add(mainPanel, BorderLayout.CENTER);
	}

	@Override
	public boolean save() throws Exception {
		String merchantId = tfMerchantId.getText().trim();
		String apiKey = new String(tfApiKey.getPassword()).trim();
		String terminalId = tfTerminalId.getText().trim();

		if (merchantId.isEmpty() || apiKey.isEmpty() || terminalId.isEmpty()) {
			POSMessageDialog.showError(this,
					"Merchant ID, API Key, and Terminal ID are required.");
			return false;
		}

		int port;
		try {
			port = Integer.parseInt(tfTerminalPort.getText().trim());
		} catch (NumberFormatException e) {
			POSMessageDialog.showError(this, "Terminal port must be a valid number.");
			return false;
		}

		PaybotXConfig.setGatewayUrl(tfGatewayUrl.getText().trim());
		PaybotXConfig.setMerchantId(merchantId);
		PaybotXConfig.setApiKey(apiKey);
		PaybotXConfig.setTerminalId(terminalId);
		PaybotXConfig.setTerminalIp(tfTerminalIp.getText().trim());
		PaybotXConfig.setTerminalPort(port);
		PaybotXConfig.setTerminalModel((String) cbTerminalModel.getSelectedItem());
		PaybotXConfig.setCloudMode(chkCloudMode.isSelected());
		PaybotXConfig.setAutoSettle(chkAutoSettle.isSelected());
		PaybotXConfig.setTipOnTerminal(chkTipOnTerminal.isSelected());
		PaybotXConfig.setPrintOnTerminal(chkPrintOnTerminal.isSelected());

		// Reload terminal config
		PaybotXConfig.reloadTerminals();

		return true;
	}

	@Override
	public void initialize() throws Exception {
		tfGatewayUrl.setText(PaybotXConfig.getGatewayUrl());
		tfMerchantId.setText(PaybotXConfig.getMerchantId());
		tfApiKey.setText(PaybotXConfig.getApiKey());
		tfTerminalId.setText(PaybotXConfig.getTerminalId());
		tfTerminalIp.setText(PaybotXConfig.getTerminalIp());
		tfTerminalPort.setText(String.valueOf(PaybotXConfig.getTerminalPort()));
		cbTerminalModel.setSelectedItem(PaybotXConfig.getTerminalModel());
		chkCloudMode.setSelected(PaybotXConfig.isCloudMode());
		chkAutoSettle.setSelected(PaybotXConfig.isAutoSettle());
		chkTipOnTerminal.setSelected(PaybotXConfig.isTipOnTerminal());
		chkPrintOnTerminal.setSelected(PaybotXConfig.isPrintOnTerminal());
	}

	@Override
	public String getName() {
		return "PaybotX / Valor";
	}
}
