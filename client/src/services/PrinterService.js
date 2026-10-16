/**
 * StoreFlow by Flywheel — POS Hardware & Thermal Printer Service
 * 
 * Supports:
 * 1. Browser Silent Kiosk / Thermal HTML printing (80mm & 58mm)
 * 2. Direct WebUSB ESC/POS printing (zero drivers required)
 * 3. Direct Web Bluetooth ESC/POS printing (mobile / tablet registers)
 * 4. Cash drawer kick pulse (ESC p)
 * 5. Automatic paper cutting (GS V)
 */

import { supabase } from "./supabaseClient";

// Active hardware device connections cached in memory for current register session
let activeUsbDevice = null;
let activeBluetoothCharacteristic = null;

export const PrinterService = {
  // ==========================================
  // 1. HARDWARE SUPPORT DETECTION & STORAGE
  // ==========================================

  isWebUsbSupported() {
    return typeof navigator !== 'undefined' && !!navigator.usb;
  },

  isWebBluetoothSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  },

  getLocalHardwareConfig() {
    try {
      const saved = localStorage.getItem('storeflow_pos_hardware');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      modeOverride: null, // null means use organization default
      deviceName: null,
      deviceType: null,
      autoPrint: null
    };
  },

  saveLocalHardwareConfig(config) {
    try {
      const current = this.getLocalHardwareConfig();
      const updated = { ...current, ...config };
      localStorage.setItem('storeflow_pos_hardware', JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.warn("Could not save hardware config locally:", err);
    }
  },

  // ==========================================
  // 2. DEVICE PAIRING (WEBUSB & BLUETOOTH)
  // ==========================================

  async pairUsbPrinter() {
    if (!this.isWebUsbSupported()) {
      throw new Error("WebUSB is not supported by your current browser. Please use Chrome, Edge, or Opera over HTTPS.");
    }

    try {
      // Request any USB device or filter by common POS vendor classes
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Claim interface 0 (standard for USB printers)
      const iface = device.configuration.interfaces[0];
      await device.claimInterface(iface.interfaceNumber);

      activeUsbDevice = device;
      const deviceName = device.productName || `USB Printer (Vendor: ${device.vendorId})`;

      this.saveLocalHardwareConfig({
        deviceName,
        deviceType: 'webusb',
        pairedAt: new Date().toISOString()
      });

      return { success: true, deviceName, device };
    } catch (err) {
      if (err.name === 'NotFoundError') {
        throw new Error("No USB printer selected.");
      }
      console.error("USB Pairing Error:", err);
      throw new Error(`Failed to pair USB printer: ${err.message}`);
    }
  },

  async pairBluetoothPrinter() {
    if (!this.isWebBluetoothSupported()) {
      throw new Error("Web Bluetooth is not supported by this browser. Please use Chrome on Android, Windows, or Mac.");
    }

    try {
      // Common POS / Serial Port Service UUIDs for thermal printers
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Generic Thermal SPP
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
          '0000ff00-0000-1000-8000-00805f9b34fb'  // Vendor custom
        ]
      });

      const server = await device.gatt.connect();
      // Locate the primary service and writable characteristic
      const services = await server.getPrimaryServices();
      let writeChar = null;

      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error("Could not locate a writable printer channel on this Bluetooth device.");
      }

      activeBluetoothCharacteristic = writeChar;
      const deviceName = device.name || 'Bluetooth Thermal Printer';

      this.saveLocalHardwareConfig({
        deviceName,
        deviceType: 'bluetooth',
        pairedAt: new Date().toISOString()
      });

      return { success: true, deviceName, characteristic: writeChar };
    } catch (err) {
      if (err.name === 'NotFoundError') {
        throw new Error("No Bluetooth printer selected.");
      }
      console.error("Bluetooth Pairing Error:", err);
      throw new Error(`Failed to pair Bluetooth printer: ${err.message}`);
    }
  },

  forgetPrinter() {
    activeUsbDevice = null;
    activeBluetoothCharacteristic = null;
    this.saveLocalHardwareConfig({
      deviceName: null,
      deviceType: null,
      pairedAt: null
    });
  },

  // ==========================================
  // 3. ESC/POS BINARY COMMAND GENERATOR
  // ==========================================

  buildEscPos(options = {}) {
    const {
      org = {},
      sale = {},
      items = [],
      paperWidth = '80mm',
      kickDrawer = false,
      footerNote = 'Thank you for your business!'
    } = options;

    const is58mm = paperWidth === '58mm';
    const charWidth = is58mm ? 32 : 48; // Max characters per line on thermal roll

    const encoder = new TextEncoder();
    const chunks = [];

    // Helper: Push raw bytes
    const pushBytes = (...bytes) => chunks.push(new Uint8Array(bytes));
    // Helper: Push text string
    const pushText = (str) => chunks.push(encoder.encode(str));
    // Helper: Centered line
    const pushCentered = (text) => {
      pushBytes(0x1B, 0x61, 0x01); // Center
      pushText(text + '\n');
    };
    // Helper: Left aligned line
    const pushLeft = (text) => {
      pushBytes(0x1B, 0x61, 0x00); // Left
      pushText(text + '\n');
    };
    // Helper: Two-column line (Left label, Right value)
    const pushTwoCol = (left, right) => {
      pushBytes(0x1B, 0x61, 0x00);
      const spaceCount = Math.max(1, charWidth - left.length - right.length);
      pushText(left + ' '.repeat(spaceCount) + right + '\n');
    };
    // Helper: Separator line
    const pushDivider = (char = '-') => {
      pushBytes(0x1B, 0x61, 0x00);
      pushText(char.repeat(charWidth) + '\n');
    };

    // 1. Initialize printer (ESC @)
    pushBytes(0x1B, 0x40);

    // 2. Header (Double Height/Width)
    pushBytes(0x1B, 0x61, 0x01); // Center align
    pushBytes(0x1D, 0x21, 0x11); // Double size
    pushText((org.name || 'StoreFlow').toUpperCase() + '\n');
    pushBytes(0x1D, 0x21, 0x00); // Reset font size

    if (org.address) pushCentered(org.address);
    if (org.phone) pushCentered(`Tel: ${org.phone}`);
    
    // TIN (respecting privacy guard)
    const isPersonalGhanaCard = org.tin && (org.tin.trim().toUpperCase().startsWith('GHA') || /^GHA-\d+/i.test(org.tin.trim()));
    if (org.tin && org.print_tin_on_receipts && !isPersonalGhanaCard) {
      pushCentered(`TIN: ${org.tin.trim()}`);
    }

    pushDivider('=');

    // 3. Invoice & Metadata
    pushBytes(0x1B, 0x45, 0x01); // Bold ON
    const invNo = sale.invoice_no || `INV-${String(sale.id || '000').slice(-6).padStart(3, '0')}`;
    pushTwoCol(`INVOICE: ${invNo}`, sale.payment_status || 'PAID');
    pushBytes(0x1B, 0x45, 0x00); // Bold OFF

    const saleDate = sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date().toLocaleString();
    pushTwoCol('Date:', saleDate);
    if (sale.customer_name) pushTwoCol('Customer:', sale.customer_name);
    if (sale.recorded_by) pushTwoCol('Cashier:', sale.recorded_by);

    pushDivider('-');

    // 4. Items Table
    pushBytes(0x1B, 0x45, 0x01); // Bold headers
    if (is58mm) {
      pushTwoCol('ITEM / QTY', 'TOTAL');
    } else {
      pushText('ITEM'.padEnd(24) + 'QTY'.padEnd(6) + 'PRICE'.padStart(8) + 'TOTAL'.padStart(10) + '\n');
    }
    pushBytes(0x1B, 0x45, 0x00);
    pushDivider('-');

    items.forEach(item => {
      const name = item.product_name || 'Item';
      const qty = String(item.quantity || 1);
      const price = Number(item.unit_price || 0).toFixed(2);
      const total = Number(item.subtotal || 0).toFixed(2);

      if (is58mm) {
        pushLeft(name);
        pushTwoCol(`  x${qty} @ ${price}`, total);
      } else {
        const truncatedName = name.length > 22 ? name.substring(0, 21) + '.' : name;
        const line = truncatedName.padEnd(24) + qty.padEnd(6) + price.padStart(8) + total.padStart(10);
        pushText(line + '\n');
      }
    });

    pushDivider('-');

    // 5. Totals & Tax
    const currency = org.currency || 'GHS';
    const totalAmt = Number(sale.total_amount || 0).toFixed(2);
    const taxAmt = parseFloat(sale.tax_amount || 0);

    if (taxAmt > 0) {
      pushTwoCol('Tax Amount:', `${currency} ${taxAmt.toFixed(2)}`);
    }

    pushBytes(0x1B, 0x45, 0x01); // Bold
    pushBytes(0x1D, 0x21, 0x01); // Double height for total
    pushTwoCol('TOTAL:', `${currency} ${totalAmt}`);
    pushBytes(0x1D, 0x21, 0x00); // Reset font
    pushBytes(0x1B, 0x45, 0x00);

    const amountPaid = Number(sale.amount_paid || totalAmt).toFixed(2);
    const balance = Number(sale.balance_due || 0).toFixed(2);
    pushTwoCol('Amount Paid:', `${currency} ${amountPaid}`);
    if (Number(balance) > 0) {
      pushTwoCol('Balance Due:', `${currency} ${balance}`);
    }

    pushDivider('=');

    // 6. Footer Note
    pushCentered(footerNote);
    pushCentered('powered by StoreFlow • bookflywheel.com');
    pushText('\n\n'); // Feed lines before cut

    // 7. Cash Drawer Kick Pulse (ESC p) if requested
    if (kickDrawer) {
      pushBytes(0x1B, 0x70, 0x00, 0x19, 0xFA);
    }

    // 8. Auto-Cut Paper (GS V 65 0)
    pushBytes(0x1D, 0x56, 0x41, 0x00);

    // Merge into single Uint8Array
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  },

  // ==========================================
  // 4. THERMAL HTML PRINTING (BROWSER KIOSK)
  // ==========================================

  printThermalHtmlReceipt(options = {}) {
    const {
      org = {},
      sale = {},
      items = [],
      paperWidth = '80mm',
      footerNote = 'Thank you for your business!'
    } = options;

    const widthPx = paperWidth === '58mm' ? '58mm' : '80mm';
    const currency = org.currency || 'GHS';
    const invNo = sale.invoice_no || `INV-${String(sale.id || '000').slice(-6).padStart(3, '0')}`;
    const saleDate = sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date().toLocaleString();
    const totalAmt = Number(sale.total_amount || 0).toFixed(2);
    const amountPaid = Number(sale.amount_paid || totalAmt).toFixed(2);
    const balance = Number(sale.balance_due || 0).toFixed(2);

    const isPersonalGhanaCard = org.tin && (org.tin.trim().toUpperCase().startsWith('GHA') || /^GHA-\d+/i.test(org.tin.trim()));
    const showTin = org.tin && org.print_tin_on_receipts && !isPersonalGhanaCard;

    // Create an isolated printable iframe
    let printIframe = document.getElementById('storeflow-thermal-print-frame');
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'storeflow-thermal-print-frame';
      printIframe.style.position = 'fixed';
      printIframe.style.top = '-9999px';
      printIframe.style.left = '-9999px';
      printIframe.style.width = '0px';
      printIframe.style.height = '0px';
      printIframe.style.border = 'none';
      document.body.appendChild(printIframe);
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${invNo}</title>
        <style>
          @page {
            size: ${widthPx} auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
            color: #000;
          }
          body {
            width: ${widthPx};
            padding: 8px;
            font-size: 11px;
            line-height: 1.35;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .store-name { font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
          .meta-row, .item-row, .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .table-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-bottom: 4px;
          }
          .grand-total {
            font-size: 14px;
            font-weight: 900;
            margin: 4px 0;
          }
          .footer-note {
            font-size: 10px;
            margin-top: 8px;
            text-align: center;
          }
          .branding {
            font-size: 8.5px;
            color: #555;
            text-align: center;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="store-name">${org.name || 'StoreFlow'}</div>
          ${org.address ? `<div>${org.address}</div>` : ''}
          ${org.phone ? `<div>Tel: ${org.phone}</div>` : ''}
          ${showTin ? `<div>TIN: ${org.tin.trim()}</div>` : ''}
        </div>

        <div class="double-divider"></div>

        <div class="meta-row bold">
          <span>INVOICE: ${invNo}</span>
          <span>${sale.payment_status || 'PAID'}</span>
        </div>
        <div class="meta-row">
          <span>Date:</span>
          <span>${saleDate}</span>
        </div>
        ${sale.customer_name ? `<div class="meta-row"><span>Customer:</span><span>${sale.customer_name}</span></div>` : ''}
        ${sale.recorded_by ? `<div class="meta-row"><span>Cashier:</span><span>${sale.recorded_by}</span></div>` : ''}

        <div class="divider"></div>

        <div class="table-header">
          <span style="flex: 2;">ITEM</span>
          <span style="flex: 1; text-align: center;">QTY</span>
          <span style="flex: 1.2; text-align: right;">TOTAL</span>
        </div>

        ${items.map(item => `
          <div class="item-row">
            <span style="flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.product_name}</span>
            <span style="flex: 1; text-align: center;">x${item.quantity}</span>
            <span style="flex: 1.2; text-align: right;">${Number(item.subtotal || 0).toFixed(2)}</span>
          </div>
        `).join('')}

        <div class="divider"></div>

        ${parseFloat(sale.tax_amount || 0) > 0 ? `
          <div class="total-row">
            <span>Tax:</span>
            <span>${currency} ${parseFloat(sale.tax_amount).toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="total-row grand-total">
          <span>TOTAL:</span>
          <span>${currency} ${totalAmt}</span>
        </div>

        <div class="total-row">
          <span>Paid:</span>
          <span>${currency} ${amountPaid}</span>
        </div>
        ${Number(balance) > 0 ? `
          <div class="total-row bold">
            <span>Balance Due:</span>
            <span>${currency} ${balance}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>

        <div class="footer-note">${footerNote}</div>
        <div class="branding">powered by StoreFlow • bookflywheel.com</div>
      </body>
      </html>
    `;

    const frameDoc = printIframe.contentWindow.document;
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    setTimeout(() => {
      printIframe.contentWindow.focus();
      printIframe.contentWindow.print();
    }, 250);

    return { success: true };
  },

  // ==========================================
  // 5. MASTER PRINT DISPATCHER
  // ==========================================

  async printSale(sale, org, items = [], customOptions = {}) {
    const localConfig = this.getLocalHardwareConfig();
    const mode = customOptions.mode || localConfig.modeOverride || org.receipt_mode || 'browser';
    const paperWidth = customOptions.paperWidth || org.receipt_paper_width || '80mm';
    const kickDrawer = customOptions.kickDrawer ?? (org.kick_cash_drawer && sale.payment_method?.toLowerCase() === 'cash');
    const footerNote = org.receipt_footer_note || 'Thank you for your business!';

    // If sale items not passed, fetch them
    let saleItems = items;
    if (!saleItems || saleItems.length === 0) {
      const { data } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
      saleItems = data || [];
    }

    if (mode === 'webusb') {
      return await this.sendEscPosToUsb({ org, sale, items: saleItems, paperWidth, kickDrawer, footerNote });
    } else if (mode === 'bluetooth') {
      return await this.sendEscPosToBluetooth({ org, sale, items: saleItems, paperWidth, kickDrawer, footerNote });
    } else {
      // Default / Browser thermal printing
      return this.printThermalHtmlReceipt({ org, sale, items: saleItems, paperWidth, footerNote });
    }
  },

  async sendEscPosToUsb(options) {
    if (!activeUsbDevice) {
      await this.pairUsbPrinter();
    }
    const data = this.buildEscPos(options);
    const iface = activeUsbDevice.configuration.interfaces[0];
    const outEndpoint = iface.alternate.endpoints.find(e => e.direction === 'out');
    if (!outEndpoint) throw new Error("No USB write endpoint found on printer.");

    await activeUsbDevice.transferOut(outEndpoint.endpointNumber, data);
    return { success: true, mode: 'webusb' };
  },

  async sendEscPosToBluetooth(options) {
    if (!activeBluetoothCharacteristic) {
      await this.pairBluetoothPrinter();
    }
    const data = this.buildEscPos(options);
    
    // BLE characteristic write limit is often 512 bytes or 20 bytes (chunked)
    const CHUNK_SIZE = 128;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const slice = data.slice(i, i + CHUNK_SIZE);
      if (activeBluetoothCharacteristic.writeValueWithoutResponse) {
        await activeBluetoothCharacteristic.writeValueWithoutResponse(slice);
      } else {
        await activeBluetoothCharacteristic.writeValue(slice);
      }
    }
    return { success: true, mode: 'bluetooth' };
  },

  // ==========================================
  // 6. HARDWARE DIAGNOSTICS & TEST ACTIONS
  // ==========================================

  async testPrint(org = {}, mode = 'browser', paperWidth = '80mm') {
    const testSale = {
      id: 999999,
      invoice_no: 'TEST-001',
      created_at: new Date().toISOString(),
      customer_name: 'Test Customer',
      recorded_by: 'Staff',
      payment_method: 'cash',
      payment_status: 'PAID',
      total_amount: 15.00,
      amount_paid: 15.00,
      balance_due: 0.00
    };

    const testItems = [
      { product_name: 'StoreFlow Sample Item A', quantity: 1, unit_price: 10.00, subtotal: 10.00 },
      { product_name: 'StoreFlow Sample Item B', quantity: 1, unit_price: 5.00, subtotal: 5.00 }
    ];

    return await this.printSale(testSale, org, testItems, {
      mode,
      paperWidth,
      kickDrawer: false,
      footerNote: 'Hardware Verification Test Successful!'
    });
  },

  async kickCashDrawer(mode = 'webusb') {
    const kickBytes = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    if (mode === 'webusb') {
      if (!activeUsbDevice) await this.pairUsbPrinter();
      const iface = activeUsbDevice.configuration.interfaces[0];
      const outEndpoint = iface.alternate.endpoints.find(e => e.direction === 'out');
      await activeUsbDevice.transferOut(outEndpoint.endpointNumber, kickBytes);
      return { success: true };
    } else {
      throw new Error("Cash drawer kick pulse requires a direct WebUSB or Bluetooth thermal printer connection.");
    }
  }
};
