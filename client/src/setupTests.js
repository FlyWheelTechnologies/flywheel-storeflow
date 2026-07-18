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
    open: vi.fn().mockResolvedValue({}),
    products: { toArray: vi.fn().mockResolvedValue([]) },
    sales: { toArray: vi.fn().mockResolvedValue([]) },
    customers: { toArray: vi.fn().mockResolvedValue([]) },
    expenses: { toArray: vi.fn().mockResolvedValue([]) },
    journal_entries: { toArray: vi.fn().mockResolvedValue([]) },
    logs: { toArray: vi.fn().mockResolvedValue([]) },
    sync_queue: { toArray: vi.fn().mockResolvedValue([]) },
  },
}));
