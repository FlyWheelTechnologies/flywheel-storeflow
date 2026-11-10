import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Supabase
vi.mock('./services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock Dexie
vi.mock('./services/db', () => ({
  db: {
    version: vi.fn().mockReturnThis(),
    stores: vi.fn().mockReturnThis(),
    isOpen: vi.fn(() => true),
    open: vi.fn().mockResolvedValue({}),
    products: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue(1) },
    sales: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue(1) },
    customers: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue(1) },
    expenses: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue(1) },
    journal_entries: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue(1) },
    logs: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn().mockResolvedValue(1) },
    sync_queue: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(1),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(true),
    },
  },
}));
