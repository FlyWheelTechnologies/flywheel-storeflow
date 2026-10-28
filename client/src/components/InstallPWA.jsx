import { useState, useEffect } from 'react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if previously dismissed in this session
    if (sessionStorage.getItem('storeflow_pwa_dismissed') === 'true') {
      return;
    }

    const handler = (e) => {
      // Prevent mini-infobar on mobile
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app is already running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('storeflow_pwa_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt response: ${outcome}`);

    setDeferredPrompt(null);
    setIsVisible(false);
    sessionStorage.setItem('storeflow_pwa_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      borderBottom: '1px solid rgba(241, 90, 36, 0.25)',
      color: '#f8fafc',
      padding: '12px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
      position: 'relative',
      zIndex: 60,
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '260px', flex: '1 1 auto' }}>
        <img 
          src="/pwa-192x192.png" 
          alt="StoreFlow" 
          style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            boxShadow: '0 2px 8px rgba(241, 90, 36, 0.3)',
            flexShrink: 0
          }} 
        />
        <div>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Install StoreFlow App</span>
            <span style={{ 
              fontSize: '10px', 
              background: 'rgba(241, 90, 36, 0.2)', 
              color: '#f15a24', 
              padding: '1px 6px', 
              borderRadius: '999px',
              fontWeight: '600'
            }}>
              OFFLINE READY
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Faster access from home screen, offline stock sync, and instant sales receipts.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <button 
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: '#cbd5e1',
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
        >
          Later
        </button>
        <button 
          onClick={handleInstallClick}
          style={{
            background: 'linear-gradient(135deg, #f15a24 0%, #ea580c 100%)',
            border: 'none',
            color: '#ffffff',
            padding: '7px 18px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(241, 90, 36, 0.4)',
            transition: 'transform 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Install App
        </button>
      </div>
    </div>
  );
}

