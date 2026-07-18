export const formatCurrency = (num) => {
  if (num === null || num === undefined) return '0.0';
  return new Intl.NumberFormat('en-GH', { 
    minimumFractionDigits: 1, 
    maximumFractionDigits: 1 
  }).format(num);
};

export const formatPhone = (val) => {
  if (!val) return '+233';
  if (val.startsWith('0')) return '+233' + val.substring(1);
  if (!val.startsWith('+')) return '+233' + val;
  return val;
};
