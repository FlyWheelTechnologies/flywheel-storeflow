import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataCache } from '../services/dataCache';
import { SyncService } from '../services/SyncService';

describe('StoreFlow DataCache & Offline Sync', () => {
  const testOrgId = 'test-org-12345';

  beforeEach(() => {
    dataCache.clearOrg(testOrgId);
  });

  it('provides instant synchronous retrieval of cached data', () => {
    expect(dataCache.hasCachedData('products', testOrgId)).toBe(false);
    expect(dataCache.getCachedData('products', testOrgId)).toBeNull();

    const mockProducts = [
      { id: 'p1', name: 'Milo 400g', stock_quantity: 25, selling_price: 35.0 },
      { id: 'p2', name: 'Ideal Milk', stock_quantity: 40, selling_price: 12.0 }
    ];

    dataCache.setCachedData('products', testOrgId, mockProducts);

    expect(dataCache.hasCachedData('products', testOrgId)).toBe(true);
    const retrieved = dataCache.getCachedData('products', testOrgId);
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].name).toBe('Milo 400g');
  });

  it('notifies subscribers synchronously when cached data updates', () => {
    const listener = vi.fn();
    const unsubscribe = dataCache.subscribe('products', testOrgId, listener);

    dataCache.setCachedData('products', testOrgId, [{ id: 'p1', name: 'Sugar' }]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith([{ id: 'p1', name: 'Sugar' }]);

    unsubscribe();
    dataCache.setCachedData('products', testOrgId, [{ id: 'p2', name: 'Salt' }]);
    expect(listener).toHaveBeenCalledTimes(1); // not called after unsubscribe
  });

  it('supports updater function in setCachedData (optimistic updates)', () => {
    dataCache.setCachedData('products', testOrgId, [{ id: 'p1', name: 'Bread', stock_quantity: 10 }]);

    dataCache.setCachedData('products', testOrgId, (prev) => [
      { id: 'p2', name: 'Butter', stock_quantity: 5 },
      ...prev
    ]);

    const updated = dataCache.getCachedData('products', testOrgId);
    expect(updated).toHaveLength(2);
    expect(updated[0].name).toBe('Butter');
    expect(updated[1].name).toBe('Bread');
  });

  it('queues offline RPC calls and manages queue subscribers', async () => {
    const queueListener = vi.fn();
    const unsub = SyncService.subscribeToQueue(queueListener);

    const rpcPayload = {
      p_customer_name: 'Ama Serwaa',
      p_items: [{ product_id: 'p1', quantity: 2, unit_price: 15 }]
    };

    const res = await SyncService.queueRpc('record_sale_transaction', rpcPayload);
    expect(res.success).toBe(true);
    expect(res.isOffline).toBe(true);

    const count = await SyncService.getQueueCount();
    expect(typeof count).toBe('number');

    unsub();
  });
});
