/**
 * StoreFlow PostHog Telemetry & Diagnostics Service
 *
 * Provides safe event tracking, exception capture, user identification, and session diagnostics.
 * If PostHog key is not configured, all methods safely fallback / no-op without throwing errors.
 */

import posthog from 'posthog-js';

let isInitialized = false;

/**
 * Drop cross-origin "Script error." events. The browser hides the message and stack,
 * so these events carry no diagnostic data.
 */
export function dropMaskedScriptErrors(event) {
  if (event?.event !== '$exception') return event;
  const exceptions = event.properties?.$exception_list;
  if (!Array.isArray(exceptions) || exceptions.length === 0) return event;
  const isMasked = exceptions.every(
    (ex) => ex?.value === 'Script error.' && !ex?.stacktrace?.frames?.length
  );
  return isMasked ? null : event;
}

/**
 * Initialize PostHog client
 */
export function initPostHog() {
  if (isInitialized) return posthog;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY || 'phc_nfTiY9aGg8WY6Z8kPVGAXc7R8cLeQEzZeXUSwRRkdqRY';
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  const projectId = import.meta.env.VITE_POSTHOG_PROJECT_ID || '632874';

  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.log('ℹ️ [PostHog] No VITE_POSTHOG_KEY configured. Diagnostics running in dry-run mode.');
    }
    return null;
  }

  try {
    posthog.init(apiKey, {
      api_host: apiHost,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      // posthog-js captures uncaught errors and unhandled rejections itself
      capture_exceptions: true,
      before_send: dropMaskedScriptErrors,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true
        }
      },
      loaded: () => {
        console.log('⚡ [PostHog] Initialized successfully for diagnostics (Project:', projectId, ')');
      }
    });

    if (typeof window !== 'undefined') {
      if (import.meta.env.DEV) {
        window.__posthog = posthog;
      }
    }

    isInitialized = true;
    return posthog;
  } catch (err) {
    console.warn('⚠️ [PostHog] Initialization error:', err);
    return null;
  }
}

/**
 * Identify authenticated user and associate with their organization group
 */
export function identifyUser(user, orgId) {
  if (!user?.id && !user?.email) return;
  try {
    if (isInitialized) {
      posthog.identify(user.id || user.email, {
        email: user.email,
        role: user.role,
        organization_id: orgId || user.organization_id,
        full_name: user.full_name
      });
      const resolvedOrgId = orgId || user.organization_id;
      if (resolvedOrgId) {
        posthog.group('organization', resolvedOrgId);
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
    if (isInitialized) {
      posthog.reset();
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
    if (isInitialized) {
      posthog.capture(eventName, {
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
    if (isInitialized) {
      posthog.captureException(error, context);
    } else {
      console.error(`[Diagnostics Error Captured]`, error, context);
    }
  } catch (err) {
    console.warn('⚠️ [PostHog] Exception capture error:', err);
  }
}

export default {
  posthog,
  initPostHog,
  identifyUser,
  resetUser,
  captureEvent,
  captureException
};
