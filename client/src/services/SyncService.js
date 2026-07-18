import { db } from './db';
import { supabase } from './supabaseClient';

export const SyncService = {
  /**
   * Queue a local mutation to be synced to Supabase when online.
   */
  async queueMutation(table, operation, payload) {
    if (!payload.supabase_id) {
      payload.supabase_id = crypto.randomUUID(); // Give it a UUID for Supabase
    }
    
    // Add to local IndexedDB table
    payload.sync_status = 'pending';
    const localId = await db[table].add(payload);
    
    // Add to sync queue
    await db.sync_queue.add({
      table,
      operation,
      payload: { ...payload, id: undefined }, // strip local auto-incremented ID
      created_at: new Date().toISOString()
    });

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.syncQueueToSupabase();
    }
    
    return { ...payload, id: localId };
  },

  /**
   * Process the sync queue and push to Supabase
   */
  async syncQueueToSupabase() {
    if (!navigator.onLine) return;

    const queue = await db.sync_queue.toArray();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        console.log(`🔄 Processing sync item ${item.id} (${item.operation} on ${item.table})`);
        
        if (item.operation === 'INSERT') {
          // ... (keep the logic I just added)
          const pushPayload = { ...item.payload, id: item.payload.supabase_id };
          delete pushPayload.supabase_id;

          // Ensure numeric fields are numbers (Supabase can be strict)
          if (item.table === 'expenses' && pushPayload.amount) pushPayload.amount = Number(pushPayload.amount);
          if (item.table === 'products') {
             if (pushPayload.cost_price) pushPayload.cost_price = Number(pushPayload.cost_price);
             if (pushPayload.selling_price) pushPayload.selling_price = Number(pushPayload.selling_price);
             if (pushPayload.stock_quantity) pushPayload.stock_quantity = Number(pushPayload.stock_quantity);
             if (pushPayload.conversion_factor) pushPayload.conversion_factor = Number(pushPayload.conversion_factor);
          }
          if (item.table === 'sales') {
            if (pushPayload.total_amount) pushPayload.total_amount = Number(pushPayload.total_amount);
            if (pushPayload.amount_paid) pushPayload.amount_paid = Number(pushPayload.amount_paid);
            if (pushPayload.balance_due) pushPayload.balance_due = Number(pushPayload.balance_due);
          }

          const { error } = await supabase.from(item.table).insert([pushPayload]);
          if (!error) {
            console.log(`✅ Successfully synced INSERT for ${item.table}`);
            await db[item.table].where('supabase_id').equals(item.payload.supabase_id).modify({ sync_status: 'synced' });
            await db.sync_queue.delete(item.id);
          } else {
            console.error(`❌ Failed to sync INSERT for ${item.table}`, error);
            if (error.code === '23505') {
              await db[item.table].where('supabase_id').equals(item.payload.supabase_id).modify({ sync_status: 'synced' });
              await db.sync_queue.delete(item.id);
            }
          }
        } else if (item.operation === 'UPDATE') {
          const pushPayload = { ...item.payload };
          const remoteId = pushPayload.supabase_id || pushPayload.id;
          delete pushPayload.supabase_id;
          delete pushPayload.id;

          const { error } = await supabase.from(item.table).update(pushPayload).eq('id', remoteId);
          if (!error) {
            await db.sync_queue.delete(item.id);
          } else {
            console.error(`❌ Failed to sync UPDATE for ${item.table}`, error);
          }
        } else if (item.operation === 'DELETE') {
          const remoteId = item.payload.supabase_id || item.payload.id;
          const { error } = await supabase.from(item.table).delete().eq('id', remoteId);
          if (!error) {
            await db.sync_queue.delete(item.id);
          } else {
            console.error(`❌ Failed to sync DELETE for ${item.table}`, error);
          }
        }
      } catch (err) {
        console.error(`🔥 Critical sync error for item ${item.id}:`, err);
        // Continue to next item in queue
      }
    }
  },

  /**
   * Fetch latest data from Supabase and populate local DB.
   * Call this on login or initial app load if online.
   */
  async initialSyncFromSupabase(table) {
    if (!navigator.onLine) return;

    try {
      if (!db.isOpen()) await db.open();

      const { data, error } = await supabase.from(table).select('*');
      if (!error && data) {
        // Fetch pending items to avoid overwriting local-only data
        const pendingItems = await db[table].where('sync_status').equals('pending').toArray();
        const unsyncedIds = new Set(pendingItems.map(x => x.supabase_id));
        
        const toUpsert = data.map(item => ({
          ...item,
          supabase_id: item.id,
          sync_status: 'synced'
        })).filter(item => !unsyncedIds.has(item.supabase_id));

        if (toUpsert.length > 0) {
          await db[table].bulkPut(toUpsert);
        }
      }
    } catch (err) {
      console.warn(`Sync failed for table ${table}:`, err);
    }
  },

  async syncAllTables() {
    if (!navigator.onLine) return;
    const tables = ['products', 'customers', 'sales', 'expenses', 'sale_items', 'journal_entries', 'logs'];
    for (const table of tables) {
      await this.initialSyncFromSupabase(table);
    }
  },

  async getQueueCount() {
    try {
      if (!db.isOpen()) await db.open();
      return await db.sync_queue.count();
    } catch (e) {
      return 0;
    }
  }
};
