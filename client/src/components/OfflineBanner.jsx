import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div style={{
      background: '#fee2e2',
      color: '#991b1b',
      padding: '10px 24px',
      fontSize: '13px',
      fontWeight: '600',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #fecaca'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>⚠️</span> 
        <span>You are currently offline. Changes will not be saved until your connection is restored.</span>
      </div>
    </div>
  );
}
