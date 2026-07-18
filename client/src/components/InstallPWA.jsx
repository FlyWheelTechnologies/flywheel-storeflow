import { useState, useEffect } from 'react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      background: '#2563eb',
      color: 'white',
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      position: 'relative',
      zIndex: 50
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>📱</span>
        <div>
          <div style={{ fontWeight: '700', fontSize: '14px' }}>Install Flywheel StockSystem for the best experience</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Install as an app to use it offline and access it faster from your home screen.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setIsVisible(false)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Later
        </button>
        <button 
          onClick={handleInstallClick}
          style={{
            background: 'white',
            border: 'none',
            color: '#2563eb',
            padding: '6px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          Install Now
        </button>
      </div>
    </div>
  );
}
