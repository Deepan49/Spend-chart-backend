module.exports = function(symbol) {
  symbol = symbol.toUpperCase();

  // If it already has an exchange suffix (.NS or .BO), return it
  if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
    return symbol;
  }

  // If it has a colon (Twelve Data format), convert to Yahoo format
  if (symbol.includes(':')) {
    const [sym, exchange] = symbol.split(':');
    if (exchange === 'NSE') return `${sym}.NS`;
    if (exchange === 'BSE') return `${sym}.BO`;
    return sym; // Default fallback
  }

  // Default to .NS if no suffix is present
  return `${symbol}.NS`;
};
