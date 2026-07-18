const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { sendReceiptEmail, sendLowStockAlert } = require('./utils/mailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'florzy_angel_secret_key';

app.use(cors());
app.use(express.json());

// ── Database Setup ──────────────────────────────────
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('Connected to local SQLite database.');
});

// Helper: run as promise
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows || []); });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => { err ? reject(err) : resolve(row); });
});

// ── Initialize Tables ───────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'storekeeper',
    full_name TEXT,
    avatar_url TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    buying_uom TEXT DEFAULT 'Piece',
    selling_uom TEXT DEFAULT 'Piece',
    conversion_factor REAL DEFAULT 1,
    cost_price REAL DEFAULT 0,
    selling_price REAL DEFAULT 0,
    stock_quantity REAL DEFAULT 0,
    low_stock_threshold REAL DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_contractor BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    customer_name TEXT,
    attendant_email TEXT,
    total_amount REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'PAID',
    payment_method TEXT DEFAULT 'Cash',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    product_name TEXT,
    quantity REAL,
    unit_price REAL,
    subtotal REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    account_type TEXT,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'Misc',
    amount REAL NOT NULL,
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    action TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migration: Ensure users has full_name and avatar_url
  db.run(`ALTER TABLE users ADD COLUMN full_name TEXT`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, (err) => {});
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'storekeeper'`, (err) => {});

  // Migration: Ensure customers has email and address
  db.run(`ALTER TABLE customers ADD COLUMN email TEXT`, (err) => {});
  db.run(`ALTER TABLE customers ADD COLUMN address TEXT`, (err) => {});

  // Default admin
  const adminEmail = 'admin@florzyangel.com';
  db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [adminEmail, hash, 'admin']);
      console.log('Default admin created.');
    }
  });

  // Seed sample products if empty
  db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
    if (row && row.count === 0) {
      const seeds = [
        ['CEM001', 'Cement (Ghacem)', 'Building Materials', 'Pallet', 'Bag', 40, 280, 38, 240],
        ['IRB012', 'Iron Rod 12mm', 'Building Materials', 'Bundle', 'Piece', 12, 45, 55, 1100],
        ['IRB016', 'Iron Rod 16mm', 'Building Materials', 'Bundle', 'Piece', 12, 65, 78, 950],
        ['RFS001', 'Roofing Sheet (0.4mm)', 'Roofing', 'Pack', 'Sheet', 20, 35, 45, 500],
        ['NAL001', 'Nails 3 inch', 'General', 'Carton', 'Kg', 25, 8, 12, 300],
        ['PNT001', 'Emulsion Paint 4L', 'Paint', 'Carton', 'Gallon', 4, 85, 110, 60],
        ['PLB001', 'PVC Pipe 1 inch', 'Plumbing', 'Bundle', 'Piece', 10, 15, 22, 200],
        ['ELC001', 'Cable 1.5mm (100m)', 'Electrical', 'Roll', 'Meter', 100, 1.5, 2.5, 50],
      ];
      seeds.forEach(s => {
        db.run('INSERT INTO products (item_code, name, category, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity) VALUES (?,?,?,?,?,?,?,?,?)', s);
      });
      console.log('Seeded 8 sample products.');
    }
  });

  // Seed sample customers
  db.get('SELECT COUNT(*) as count FROM customers', [], (err, row) => {
    if (row && row.count === 0) {
      db.run("INSERT INTO customers (name, phone, is_contractor) VALUES ('Walk-in Customer', '', 0)");
      db.run("INSERT INTO customers (name, phone, is_contractor) VALUES ('Kwame Mensah (Contractor)', '0244123456', 1)");
      db.run("INSERT INTO customers (name, phone, is_contractor) VALUES ('Ama Serwaa', '0201234567', 0)");
      console.log('Seeded sample customers.');
    }
  });
});

// ── Helpers ──────────────────────────────────────────
const logAction = (email, action, details) => {
  db.run('INSERT INTO logs (user_email, action, details) VALUES (?, ?, ?)', [email, action, details]);
};

// RBAC middleware
function requireRole(...roles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.user = decoded;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// Item code generator
async function generateItemCode(category) {
  const prefixes = {
    'Building Materials': 'BLD', 'Plumbing': 'PLB', 'Electrical': 'ELC',
    'Roofing': 'RFS', 'Paint': 'PNT', 'General': 'GEN'
  };
  const prefix = prefixes[category] || 'GEN';
  const rows = await dbAll("SELECT item_code FROM products WHERE item_code LIKE ? ORDER BY item_code DESC LIMIT 1", [`${prefix}%`]);
  const lastNum = rows.length > 0 ? parseInt(rows[0].item_code.slice(3)) : 0;
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
}

// ── Auth Routes ─────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash], (err) => {
    if (err) return res.status(400).json({ error: 'Email already exists' });
    logAction(email, 'SIGNUP', 'New user registered');
    res.json({ message: 'User created' });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });
    logAction(email, 'LOGIN', 'User logged in');
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, full_name: user.full_name, avatar_url: user.avatar_url }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name, avatar_url: user.avatar_url } });
  });
});

app.put('/api/auth/profile', requireRole('admin', 'storekeeper', 'auditor'), async (req, res) => {
  const { full_name, avatar_url } = req.body;
  const userId = req.user.id;
  
  db.run('UPDATE users SET full_name = ?, avatar_url = ? WHERE id = ?', [full_name, avatar_url, userId], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction(req.user.email, 'PROFILE_UPDATE', `Updated profile for ${req.user.email}`);
    res.json({ success: true, full_name, avatar_url });
  });
});

// ── Products ────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  const rows = await dbAll('SELECT * FROM products ORDER BY created_at DESC');
  res.json(rows);
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity, low_stock_threshold, user_email } = req.body;
    const item_code = req.body.item_code || await generateItemCode(category || 'General');
    await dbRun(
      'INSERT INTO products (item_code, name, category, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity, low_stock_threshold) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [item_code, name, category || 'General', buying_uom || 'Piece', selling_uom || 'Piece', conversion_factor || 1, cost_price || 0, selling_price || 0, stock_quantity || 0, low_stock_threshold || 10]
    );
    logAction(user_email || 'System', 'PRODUCT_CREATE', `Added ${name} [${item_code}]`);
    res.json({ item_code });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { name, category, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity, low_stock_threshold } = req.body;
  await dbRun(
    'UPDATE products SET name=?, category=?, buying_uom=?, selling_uom=?, conversion_factor=?, cost_price=?, selling_price=?, stock_quantity=?, low_stock_threshold=? WHERE id=?',
    [name, category, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity, low_stock_threshold, req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/products/:id', async (req, res) => {
  await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
  logAction('System', 'PRODUCT_DELETE', `Deleted product #${req.params.id}`);
  res.json({ success: true });
});

// ── Customers ───────────────────────────────────────
app.get('/api/customers', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT c.*, 
      (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as transaction_count,
      (SELECT SUM(total_amount) FROM sales WHERE customer_id = c.id) as total_spent
      FROM customers c ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { name, phone, email, address, is_contractor } = req.body;
  const result = await dbRun(
    'INSERT INTO customers (name, phone, email, address, is_contractor) VALUES (?,?,?,?,?)',
    [name, phone, email || '', address || '', is_contractor ? 1 : 0]
  );
  logAction(req.body.user_email || 'System', 'CUSTOMER_CREATE', `Added ${name}`);
  res.json({ id: result.lastID });
});

app.get('/api/customers/:id/sales', async (req, res) => {
  const rows = await dbAll('SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json(rows);
});

// ── Debtors ─────────────────────────────────────────
app.get('/api/debtors', async (req, res) => {
  const rows = await dbAll(`
    SELECT c.id, c.name, c.phone, c.is_contractor,
      COALESCE(SUM(s.balance_due), 0) as total_debt,
      COUNT(s.id) as transaction_count
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id AND s.balance_due > 0
    GROUP BY c.id
    HAVING total_debt > 0
    ORDER BY total_debt DESC
  `);
  res.json(rows);
});

// ── Sales (with line items + double-entry) ──────────
app.get('/api/sales', async (req, res) => {
  const rows = await dbAll('SELECT * FROM sales ORDER BY created_at DESC');
  res.json(rows);
});

app.get('/api/sales/:id/items', async (req, res) => {
  const rows = await dbAll('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
  res.json(rows);
});

app.post('/api/sales', async (req, res) => {
  try {
    const { customer_id, customer_name, items, amount_paid, payment_method, notes, user_email } = req.body;
    
    // Calculate totals
    let total_amount = 0;
    if (items && items.length > 0) {
      items.forEach(item => { total_amount += item.quantity * item.unit_price; });
    } else {
      total_amount = req.body.total_amount || 0;
    }
    
    const paid = parseFloat(amount_paid) || 0;
    const balance = total_amount - paid;
    const status = balance <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'CREDIT';
    const method = payment_method || 'Cash';

    // Insert sale
    const saleResult = await dbRun(
      'INSERT INTO sales (customer_id, customer_name, attendant_email, total_amount, amount_paid, balance_due, payment_status, payment_method, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [customer_id || null, customer_name || 'Walk-in', user_email || 'System', total_amount, paid, balance, status, method, notes || '']
    );
    const saleId = saleResult.lastID;

    // Insert line items & deduct stock
    if (items && items.length > 0) {
      for (const item of items) {
        const subtotal = item.quantity * item.unit_price;
        await dbRun('INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)',
          [saleId, item.product_id, item.product_name, item.quantity, item.unit_price, subtotal]);
        // Deduct stock
        await dbRun('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }

    // Double-entry journal entries
    if (paid > 0) {
      const journalAccount = method.toUpperCase().replace(/\s+/g, '_');
      await dbRun('INSERT INTO journal_entries (sale_id, account_type, debit, credit, description) VALUES (?,?,?,?,?)',
        [saleId, journalAccount, paid, 0, `${method} received - Sale #${saleId}`]);
    }
    if (balance > 0) {
      await dbRun('INSERT INTO journal_entries (sale_id, account_type, debit, credit, description) VALUES (?,?,?,?,?)',
        [saleId, 'ACCOUNTS_RECEIVABLE', balance, 0, `Credit given - Sale #${saleId} to ${customer_name}`]);
    }
    await dbRun('INSERT INTO journal_entries (sale_id, account_type, debit, credit, description) VALUES (?,?,?,?,?)',
      [saleId, 'REVENUE', 0, total_amount, `Revenue from Sale #${saleId}`]);

    logAction(user_email || 'System', 'SALE_CREATE', `Sale #${saleId} - GHS ${total_amount} (${status})`);
    
    // Background Tasks: Emails
    (async () => {
      try {
        // Fetch Admin
        const admin = await dbGet('SELECT email FROM users WHERE role = "admin" LIMIT 1');
        const adminEmail = admin ? admin.email : null;

        // 1. Send Receipt to Customer and/or Admin
        let customer = null;
        if (customer_id) {
          customer = await dbGet('SELECT * FROM customers WHERE id = ?', [customer_id]);
        }
        await sendReceiptEmail(
          { 
            id: saleId, 
            total_amount, 
            amount_paid: paid, 
            balance_due: balance, 
            payment_status: status, 
            customer_name,
            created_at: new Date().toISOString()
          }, 
          customer, 
          adminEmail
        );

        // 2. Check Low Stock & Notify Admin
        if (items && items.length > 0 && adminEmail) {
          for (const item of items) {
            const product = await dbGet('SELECT * FROM products WHERE id = ?', [item.product_id]);
            if (product && product.stock_quantity < product.low_stock_threshold) {
              await sendLowStockAlert(adminEmail, product);
            }
          }
        }
      } catch (err) {
        console.error('Background Notification Error:', err);
      }
    })();

    res.json({ id: saleId, total_amount, balance_due: balance, payment_status: status });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Record payment against existing debt
app.post('/api/sales/:id/payment', async (req, res) => {
  const { amount, user_email } = req.body;
  const sale = await dbGet('SELECT * FROM sales WHERE id = ?', [req.params.id]);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  
  const newPaid = sale.amount_paid + parseFloat(amount);
  const newBalance = sale.total_amount - newPaid;
  const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';
  
  await dbRun('UPDATE sales SET amount_paid = ?, balance_due = ?, payment_status = ? WHERE id = ?',
    [newPaid, Math.max(0, newBalance), newStatus, req.params.id]);
  
  // Journal entry for payment
  await dbRun('INSERT INTO journal_entries (sale_id, account_type, debit, credit, description) VALUES (?,?,?,?,?)',
    [req.params.id, 'CASH', parseFloat(amount), 0, `Payment received - Sale #${req.params.id}`]);
  await dbRun('INSERT INTO journal_entries (sale_id, account_type, debit, credit, description) VALUES (?,?,?,?,?)',
    [req.params.id, 'ACCOUNTS_RECEIVABLE', 0, parseFloat(amount), `Debt reduced - Sale #${req.params.id}`]);
  
  logAction(user_email || 'System', 'PAYMENT', `GHS ${amount} received for Sale #${req.params.id}`);
  res.json({ success: true, new_balance: Math.max(0, newBalance), status: newStatus });
});

// ── Journal Entries ─────────────────────────────────
app.get('/api/journal', async (req, res) => {
  const rows = await dbAll('SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
});

// ── Expenses ────────────────────────────────────────
app.get('/api/expenses', async (req, res) => {
  const rows = await dbAll('SELECT * FROM expenses ORDER BY created_at DESC');
  res.json(rows);
});

app.post('/api/expenses', async (req, res) => {
  const { description, category, amount, user_email } = req.body;
  const result = await dbRun('INSERT INTO expenses (description, category, amount, recorded_by) VALUES (?,?,?,?)',
    [description, category || 'Misc', amount, user_email || 'System']);
  // Journal entry for expense
  await dbRun('INSERT INTO journal_entries (sale_id, account_type, debit, credit, description) VALUES (?,?,?,?,?)',
    [null, 'EXPENSE', parseFloat(amount), 0, `Expense: ${description}`]);
  await dbRun('INSERT INTO journal_entries (sale_id, account_type, debit, credit, description) VALUES (?,?,?,?,?)',
    [null, 'CASH', 0, parseFloat(amount), `Cash out: ${description}`]);
  logAction(user_email || 'System', 'EXPENSE_CREATE', `GHS ${amount} - ${description}`);
  res.json({ id: result.lastID });
});

// ── Daily Report ────────────────────────────────────
app.get('/api/reports/daily', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const salesData = await dbAll("SELECT * FROM sales WHERE date(created_at) = date('now')");
  const expensesData = await dbAll("SELECT * FROM expenses WHERE date(created_at) = date('now')");
  const totalSales = salesData.reduce((a, s) => a + s.total_amount, 0);
  const totalPaid = salesData.reduce((a, s) => a + s.amount_paid, 0);
  const totalCredit = salesData.reduce((a, s) => a + s.balance_due, 0);
  const totalExpenses = expensesData.reduce((a, e) => a + e.amount, 0);
  const topProducts = await dbAll(`
    SELECT si.product_name, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) = date('now')
    GROUP BY si.product_name ORDER BY total_revenue DESC LIMIT 5
  `);
  res.json({ date: today, totalSales, totalPaid, totalCredit, totalExpenses, netCash: totalPaid - totalExpenses, salesCount: salesData.length, topProducts });
});

// ── Logs ────────────────────────────────────────────
app.get('/api/logs', async (req, res) => {
  const rows = await dbAll('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
  res.json(rows);
});

// ── Users (Admin) ───────────────────────────────────
app.get('/api/users', requireRole('admin'), async (req, res) => {
  try {
    const rows = await dbAll('SELECT id, email, role, full_name, avatar_url FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', requireRole('admin'), async (req, res) => {
  const { email, password, role, full_name } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (email, password, role, full_name) VALUES (?, ?, ?, ?)', [email, hash, role || 'storekeeper', full_name || ''], function(err) {
    if (err) return res.status(400).json({ error: 'Email already exists' });
    logAction(req.user.email, 'USER_CREATE', `Created new user: ${email} with role ${role}`);
    res.json({ success: true, id: this.lastID });
  });
});

app.put('/api/users/:id', requireRole('admin'), async (req, res) => {
  const { email, full_name, password, role } = req.body;
  const targetId = parseInt(req.params.id);
  
  try {
    let sql = 'UPDATE users SET email = ?, full_name = ?, role = ?';
    let params = [email, full_name, role];
    
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sql += ', password = ?';
      params.push(hash);
    }
    
    sql += ' WHERE id = ?';
    params.push(targetId);
    
    db.run(sql, params, function(err) {
      if (err) return res.status(400).json({ error: err.message });
      logAction(req.user.email, 'USER_UPDATE', `Updated user #${targetId} (${email})`);
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  const targetId = parseInt(req.params.id);
  const currentUserId = req.user.id;

  if (targetId === currentUserId) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  db.run('DELETE FROM users WHERE id = ?', [targetId], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction(req.user.email, 'USER_DELETE', `Deleted user #${targetId}`);
    res.json({ success: true });
  });
});

app.put('/api/users/:id/role', requireRole('admin'), async (req, res) => {
  const { role } = req.body;
  const targetId = parseInt(req.params.id);
  const currentUserId = req.user.id;

  if (targetId === currentUserId) {
    return res.status(400).json({ error: 'You cannot change your own role to prevent accidental lockout.' });
  }

  if (!['admin', 'storekeeper', 'auditor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  db.run('UPDATE users SET role = ? WHERE id = ?', [role, targetId], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    logAction(req.user.email, 'ROLE_CHANGE', `Changed user #${targetId} role to ${role}`);
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`FlorzyAngel API running on http://localhost:${PORT}`);
});
