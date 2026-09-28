/**
 * StoreFlow PostHog Telemetry & Diagnostics Service
 *
 * Provides safe event tracking, exception capture, user identification, and session diagnostics.
 * If PostHog key is not configured or posthog-js is not installed yet, all methods
 * safely fallback / no-op without throwing errors or breaking application flow.
 */

let posthogInstance = null;
let isInitialized = false;

/**
 * Initialize PostHog client
 */
export async function initPostHog() {
  if (isInitialized) return posthogInstance;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.log('ℹ️ [PostHog] No VITE_POSTHOG_KEY configured. Diagnostics running in dry-run mode.');
    }
    return null;
  }

  try {
    // Dynamic import to allow compiling cleanly regardless of whether posthog-js is installed or loaded via CDN
    let posthogModule = null;
    try {
      const dynamicImport = new Function('mod', 'return import(mod)');
      posthogModule = await dynamicImport('posthog-js');
    } catch {
      if (typeof window !== 'undefined' && window.posthog) {
        posthogModule = { default: window.posthog };
      }
    }

    if (posthogModule?.default) {
      posthogInstance = posthogModule.default;
      posthogInstance.init(apiKey, {
        api_host: apiHost,
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        session_recording: {
          maskAllInputs: false,
          maskInputOptions: {
            password: true
          }
        },
        loaded: () => {
          console.log('⚡ [PostHog] Initialized successfully for diagnostics');
        }
      });
      isInitialized = true;
      return posthogInstance;
    } else {
      console.warn('ℹ️ [PostHog] posthog-js package not yet installed. Run "npm install posthog-js" in client.');
    }
  } catch (err) {
    console.warn('⚠️ [PostHog] Initialization error:', err);
  }

  return null;
}

/**
 * Identify authenticated user and associate with their organization group
 */
export function identifyUser(user, orgId) {
  if (!user?.id && !user?.email) return;
  try {
    if (posthogInstance) {
      posthogInstance.identify(user.id || user.email, {
        email: user.email,
        role: user.role,
        organization_id: orgId || user.organization_id,
        full_name: user.full_name
      });
      const resolvedOrgId = orgId || user.organization_id;
      if (resolvedOrgId) {
        posthogInstance.group('organization', resolvedOrgId);
      }
    }
  } catch (err) {
    console.warn('⚠️ [PostHog] Identify error:', err);
  }
}

/**
 * Reset PostHog user identity on logout
 */
export function resetUser() {
  try {
    if (posthogInstance) {
      posthogInstance.reset();
    }
  } catch (err) {
    console.warn('⚠️ [PostHog] Reset error:', err);
  }
}

/**
 * Capture custom action/event (e.g. 'sale_completed', 'deposit_recorded')
 */
export function captureEvent(eventName, properties = {}) {
  try {
    if (posthogInstance) {
      posthogInstance.capture(eventName, {
        ...properties,
        timestamp: new Date().toISOString()
      });
    } else if (import.meta.env.DEV) {
      console.log(`[Telemetry Dry-run] ${eventName}:`, properties);
    }
  } catch (err) {
    console.warn('⚠️ [PostHog] Capture error:', err);
  }
}

/**
 * Capture exceptions for diagnostic tracking
 */
export function captureException(error, context = {}) {
  try {
    if (posthogInstance) {
      posthogInstance.capture('$exception', {
        $exception_message: error?.message || String(error),
        $exception_stack_trace_raw: error?.stack,
        ...context
      });
    } else {
      console.error(`[Diagnostics Error Captured]`, error, context);
    }
  } catch (err) {
    console.warn('⚠️ [PostHog] Exception capture error:', err);
  }
}

export default {
  initPostHog,
  identifyUser,
  resetUser,
  captureEvent,
  captureException
};
