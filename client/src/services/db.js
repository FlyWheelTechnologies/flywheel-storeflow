import Dexie from 'dexie';

export const db = new Dexie('FlywheelInventoryDB');

// Define the schema for the local database
// ++id means auto-incremented primary key (local only). 
// When syncing from Supabase, we might use their UUIDs or remote IDs, so we keep a separate "supabase_id" or just use "id" if it matches.
// In this case, since we want to sync *to* Supabase, we can use local UUIDs or let Supabase assign them. 
// A robust offline-first app uses UUIDs generated locally as primary keys. 
db.version(3).stores({
  products: '++id, item_code, name, category, created_at, supabase_id, sync_status',
  customers: '++id, name, phone, created_at, supabase_id, sync_status',
  sales: '++id, customer_id, created_at, payment_status, supabase_id, sync_status',
  sale_items: '++id, sale_id, product_id, supabase_id, sync_status',
  expenses: '++id, category, created_at, supabase_id, sync_status',
  journal_entries: '++id, sale_id, account_type, created_at, supabase_id, sync_status',
  logs: '++id, action, created_at, supabase_id, sync_status',
  sync_queue: '++id, table, operation, payload, created_at'
});

// Self-healing: If the DB upgrade fails due to primary key changes, delete and recreate.
db.open().catch(async (err) => {
  if (err.name === 'UpgradeError' || err.message.includes('primary key')) {
    console.error("Database schema conflict. Self-healing by resetting local DB...", err);
    await db.delete();
    window.location.reload();
  } else {
    console.error("Failed to open DB:", err);
  }
});
