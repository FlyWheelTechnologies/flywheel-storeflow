import { useAuth } from "../context/AuthContext";

/**
 * Hook to get the active organization ID
 * Resolves from impersonated org > user org_id > user organizations > user metadata
 */
export function useActiveOrgId() {
  const { activeOrgId, user } = useAuth();

  return activeOrgId
    || user?.organization_id
    || user?.organizations?.id
    || user?.user_metadata?.organization_id
    || null;
}

/**
 * Hook to get the active organization data
 */
export function useActiveOrg() {
  const { activeOrg, user } = useAuth();

  return activeOrg
    || user?.organizations
    || (user?.role === 'super_admin' ? {
        name: 'StoreFlow Admin',
        primary_color: '#f97316',
        currency: 'GHS',
        logo_url: null
      } : null)
    || null;
}