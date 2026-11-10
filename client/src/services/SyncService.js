import { db } from './db';
import { supabase } from './supabaseClient';
import { dataCache } from './dataCache';

let isSyncing = false;
const queueListeners = new Set();

function notifyQueueListeners(count, syncingState) {
  queueListeners.forEach(listener => {
    try {
      listener({ count, isSyncing: syncingState ?? isSyncing });
    } catch (e) {
      console.error("Error in sync queue listener:", e);
    }
  });
}

async function ensureDbOpen() {
  try {
    if (typeof db.isOpen === 'function') {
      if (!db.isOpen() && typeof db.open === 'function') {
        await db.open();
      }
    } else if (typeof db.open === 'function') {
      await db.open();
    }
  } catch (e) {
    console.warn("Could not open indexedDB:", e);
  }
}

export const SyncService = {
  /**
   * Queue a local table mutation to be synced to Supabase when online.
   */
  async queueMutation(table, operation, payload) {
    if (!payload.supabase_id && !payload.id) {
      payload.supabase_id = crypto.randomUUID();
    }

    try {
      await ensureDbOpen();

      // Add to local Dexie table if it exists
      if (db[table]) {
        try {
          payload.sync_status = 'pending';
          await db[table].put(payload);
        } catch (dexieErr) {
          console.warn(`Could not save to local ${table} table:`, dexieErr);
        }
      }

      // Add to persistent sync queue
      const queuePayload = { ...payload };
      const queueId = await db.sync_queue.add({
        table,
        operation,
        payload: queuePayload,
        created_at: new Date().toISOString()
      });

      const count = await this.getQueueCount();
      notifyQueueListeners(count, isSyncing);

      // Try to sync immediately if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.syncQueueToSupabase();
      }

      return { ...payload, _queueId: queueId };
    } catch (err) {
      console.error(`Failed to queue mutation for ${table}:`, err);
      return payload;
    }
  },

  /**
   * Queue an RPC call (e.g. record_sale_transaction, record_pure_deposit) for offline execution
   */
  async queueRpc(rpcName, params, meta = {}) {
    try {
      await ensureDbOpen();

      const queueId = await db.sync_queue.add({
        table: 'rpc',
        operation: 'RPC',
        payload: { rpcName, params, meta },
        created_at: new Date().toISOString()
      });

      const count = await this.getQueueCount();
      notifyQueueListeners(count, isSyncing);

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.syncQueueToSupabase();
      }

      return { success: true, _queueId: queueId, isOffline: true };
    } catch (err) {
      console.error(`Failed to queue RPC ${rpcName}:`, err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Process the sync queue and push to Supabase in FIFO order
   */
  async syncQueueToSupabase() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isSyncing) return;

    try {
      await ensureDbOpen();
      const queue = await db.sync_queue.toArray();
      if (!queue || queue.length === 0) {
        notifyQueueListeners(0, false);
        return;
      }

      isSyncing = true;
      notifyQueueListeners(queue.length, true);

      let processedAny = false;

      for (const item of queue) {
        // If we lost connection mid-sync, halt until back online
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }

        try {
          console.log(`🔄 Processing sync item #${item.id} (${item.operation} on ${item.table})`);

          if (item.operation === 'RPC') {
            const { rpcName, params } = item.payload;
            const { error } = await supabase.rpc(rpcName, params);
            if (!error) {
              console.log(`✅ Successfully synced RPC ${rpcName}`);
              await db.sync_queue.delete(item.id);
              processedAny = true;
            } else {
              console.error(`❌ RPC sync failed for ${rpcName}:`, error);
              // If it's a conflict or foreign key error that cannot be resolved, discard to avoid poison pill
              if (error.code === '23505' || error.code === 'P0001') {
                console.warn(`Discarding unresolvable RPC ${rpcName} item #${item.id}`);
                await db.sync_queue.delete(item.id);
                processedAny = true;
              } else {
                // Network or transient server error - stop loop and retry later
                break;
              }
            }
          } else if (item.operation === 'INSERT') {
            const pushPayload = { ...item.payload };
            if (pushPayload.supabase_id) {
              pushPayload.id = pushPayload.supabase_id;
              delete pushPayload.supabase_id;
            }
            delete pushPayload.sync_status;
            delete pushPayload._queueId;

            // Normalize numeric types
            if (item.table === 'expenses' && pushPayload.amount) pushPayload.amount = Number(pushPayload.amount);
            if (item.table === 'products') {
              if (pushPayload.cost_price != null) pushPayload.cost_price = Number(pushPayload.cost_price);
              if (pushPayload.selling_price != null) pushPayload.selling_price = Number(pushPayload.selling_price);
              if (pushPayload.stock_quantity != null) pushPayload.stock_quantity = Number(pushPayload.stock_quantity);
              if (pushPayload.conversion_factor != null) pushPayload.conversion_factor = Number(pushPayload.conversion_factor);
            }
            if (item.table === 'sales') {
              if (pushPayload.total_amount != null) pushPayload.total_amount = Number(pushPayload.total_amount);
              if (pushPayload.amount_paid != null) pushPayload.amount_paid = Number(pushPayload.amount_paid);
              if (pushPayload.balance_due != null) pushPayload.balance_due = Number(pushPayload.balance_due);
            }

            const { error } = await supabase.from(item.table).insert([pushPayload]);
            if (!error || error.code === '23505') {
              console.log(`✅ Successfully synced INSERT for ${item.table}`);
              if (db[item.table] && pushPayload.id) {
                try {
                  await db[item.table].where('id').equals(pushPayload.id).modify({ sync_status: 'synced' });
                } catch (e) {}
              }
              await db.sync_queue.delete(item.id);
              processedAny = true;
            } else {
              console.error(`❌ Failed to sync INSERT for ${item.table}:`, error);
              break;
            }
          } else if (item.operation === 'UPDATE') {
            const pushPayload = { ...item.payload };
            const remoteId = pushPayload.supabase_id || pushPayload.id;
            delete pushPayload.supabase_id;
            delete pushPayload.sync_status;
            delete pushPayload._queueId;

            const { error } = await supabase.from(item.table).update(pushPayload).eq('id', remoteId);
            if (!error) {
              console.log(`✅ Successfully synced UPDATE for ${item.table}`);
              await db.sync_queue.delete(item.id);
              processedAny = true;
            } else {
              console.error(`❌ Failed to sync UPDATE for ${item.table}:`, error);
              break;
            }
          } else if (item.operation === 'DELETE') {
            const remoteId = item.payload.supabase_id || item.payload.id;
            const { error } = await supabase.from(item.table).delete().eq('id', remoteId);
            if (!error) {
              console.log(`✅ Successfully synced DELETE for ${item.table}`);
              await db.sync_queue.delete(item.id);
              processedAny = true;
            } else {
              console.error(`❌ Failed to sync DELETE for ${item.table}:`, error);
              break;
            }
          }
        } catch (itemErr) {
          console.error(`Critical error processing sync item #${item.id}:`, itemErr);
          break;
        }
      }

      const remaining = await this.getQueueCount();
      notifyQueueListeners(remaining, false);

      // Revalidate active organization cache if any queued mutations were synced
      if (processedAny) {
        try {
          const cachedOrgId = localStorage.getItem("selected_org_id") || 
            (localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user"))?.organization_id : null);
          if (cachedOrgId) {
            dataCache.clearOrg(cachedOrgId);
            dataCache.prefetch(cachedOrgId);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Sync queue execution encountered an error:", err);
    } finally {
      isSyncing = false;
      const count = await this.getQueueCount();
      notifyQueueListeners(count, false);
    }
  },

  /**
   * Get current number of items waiting in offline sync queue
   */
  async getQueueCount() {
    try {
      await ensureDbOpen();
      return await db.sync_queue.count();
    } catch (e) {
      return 0;
    }
  },

  /**
   * Subscribe to sync queue state changes (count and isSyncing)
   */
  subscribeToQueue(callback) {
    if (typeof callback !== 'function') return () => {};
    queueListeners.add(callback);

    // Send initial status
    this.getQueueCount().then(count => {
      callback({ count, isSyncing });
    });

    return () => {
      queueListeners.delete(callback);
    };
  }
};

// Global online event listener to automatically drain queue when connection returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("⚡ Connection restored. Draining offline sync queue...");
    SyncService.syncQueueToSupabase();
  });

  // Periodic safety check every 30 seconds
  setInterval(() => {
    if (navigator.onLine) {
      SyncService.getQueueCount().then(count => {
        if (count > 0 && !isSyncing) {
          SyncService.syncQueueToSupabase();
        }
      });
    }
  }, 30000);
}
