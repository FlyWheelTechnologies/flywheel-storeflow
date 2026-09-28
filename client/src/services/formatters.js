/**
 * Currency formatting utility supporting multi-tenant currency settings.
 * Defaults to Ghanaian Cedi (GHS) if no currency specified.
 */
export const formatCurrency = (num, currency = 'GHS') => {
  if (num === null || num === undefined) return '0.0';

  // Map common currency codes to locale for Intl.NumberFormat
  const currencyLocales = {
    'GHS': 'en-GH',    // Ghana
    'NGN': 'en-NG',    // Nigeria
    'KES': 'en-KE',    // Kenya
    'ZAR': 'en-ZA',    // South Africa
    'USD': 'en-US',    // United States
    'EUR': 'de-DE',    // Eurozone
    'GBP': 'en-GB',    // United Kingdom
    'XOF': 'fr-CI',    // West African CFA (Ivory Coast)
    'XAF': 'fr-CM',    // Central African CFA (Cameroon)
    'EGP': 'ar-EG',    // Egypt
    'MAD': 'ar-MA',    // Morocco
    'TZS': 'sw-TZ',    // Tanzania
    'UGX': 'en-UG',    // Uganda
    'RWF': 'en-RW',    // Rwanda
    'ETB': 'am-ET',    // Ethiopia
  };

  const locale = currencyLocales[currency] || 'en-GH';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 1,
    maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
  }).format(num);
};

/**
 * Formats a number as a plain currency value without symbol (for display alongside currency label)
 */
export const formatCurrencyPlain = (num, currency = 'GHS') => {
  if (num === null || num === undefined) return '0.0';

  const currencyLocales = {
    'GHS': 'en-GH', 'NGN': 'en-NG', 'KES': 'en-KE', 'ZAR': 'en-ZA',
    'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'XOF': 'fr-CI',
    'XAF': 'fr-CM', 'EGP': 'ar-EG', 'MAD': 'ar-MA', 'TZS': 'sw-TZ',
    'UGX': 'en-UG', 'RWF': 'en-RW', 'ETB': 'am-ET',
  };

  const locale = currencyLocales[currency] || 'en-GH';

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 1,
    maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
  }).format(num);
};

export const formatPhone = (val) => {
  if (!val) return '+233';
  if (val.startsWith('0')) return '+233' + val.substring(1);
  if (!val.startsWith('+')) return '+233' + val;
  return val;
};