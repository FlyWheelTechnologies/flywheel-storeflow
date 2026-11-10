import { useState, useEffect } from 'react';
import { SyncService } from '../services/SyncService';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [queueState, setQueueState] = useState({ count: 0, isSyncing: false });
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      SyncService.syncQueueToSupabase();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = SyncService.subscribeToQueue((state) => {
      setQueueState(prev => {
        if (prev.count > 0 && state.count === 0 && !state.isSyncing) {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 4000);
        }
        return state;
      });
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const { count, isSyncing } = queueState;

  // If online and nothing queued and didn't just sync, show nothing
  if (isOnline && count === 0 && !isSyncing && !justSynced) {
    return null;
  }

  // Just finished syncing notification
  if (justSynced && isOnline && count === 0) {
    return (
      <div style={{
        background: '#ecfdf5',
        color: '#065f46',
        padding: '8px 20px',
        fontSize: '12.5px',
        fontWeight: '600',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #a7f3d0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✓</span>
          <span>All offline changes have synced successfully with StoreFlow cloud.</span>
        </div>
      </div>
    );
  }

  // Actively syncing in progress
  if (isSyncing) {
    return (
      <div style={{
        background: '#eff6ff',
        color: '#1e40af',
        padding: '8px 20px',
        fontSize: '12.5px',
        fontWeight: '600',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #bfdbfe'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>🔄</span>
          <span>Syncing {count > 0 ? `${count} ` : ''}offline update{count === 1 ? '' : 's'} to cloud...</span>
        </div>
      </div>
    );
  }

  // Offline banner with queue counter
  return (
    <div style={{
      background: '#fffbeb',
      color: '#92400e',
      padding: '8px 20px',
      fontSize: '12.5px',
      fontWeight: '600',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #fde68a'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '15px' }}>⚡</span>
        <span>
          {!isOnline
            ? "You are currently offline. Changes are saved locally and will auto-sync when back online."
            : "Offline changes pending sync."}
          {count > 0 && (
            <strong style={{ marginLeft: 6, background: '#fef3c7', padding: '2px 8px', borderRadius: 999, border: '1px solid #fcd34d' }}>
              {count} queued
            </strong>
          )}
        </span>
      </div>

      {isOnline && count > 0 && (
        <button
          type="button"
          onClick={() => SyncService.syncQueueToSupabase()}
          style={{
            background: '#d97706',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
