module.exports = function(symbol) {
  symbol = symbol.toUpperCase().trim();

  // If it ends with .BSE or .NSE, replace with Yahoo format suffixes
  if (symbol.endsWith('.BSE')) {
    return symbol.replace('.BSE', '.BO');
  }
  if (symbol.endsWith('.NSE')) {
    return symbol.replace('.NSE', '.NS');
  }

  // If it already has an exchange suffix (.NS or .BO), return it
  if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
    return symbol;
  }

  // If it has a colon (Twelve Data format), convert to Yahoo format
  if (symbol.includes(':')) {
    const [sym, exchange] = symbol.split(':');
    if (exchange === 'NSE') return `${sym}.NS`;
    if (exchange === 'BSE' || exchange === 'BOM') return `${sym}.BO`;
    return sym; // Default fallback
  }

  // Default to .NS if no suffix is present
  return `${symbol}.NS`;
};
