const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const cache = require('../utils/cache');
const normalize = require('../utils/normalize');

exports.getStockPrice = async (symbol) => {
  const normalizedSymbol = normalize(symbol);
  const cacheKey = `price_${normalizedSymbol}`;
  
  const cachedPrice = cache.get(cacheKey);
  if (cachedPrice) return cachedPrice;

  try {
    const result = await yahooFinance.quote(normalizedSymbol);
    
    if (!result || !result.regularMarketPrice) {
      throw new Error(`Price not found for ${normalizedSymbol}`);
    }

    const price = result.regularMarketPrice;
    cache.set(cacheKey, price);
    return price;
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error.message);
    throw error;
  }
};

exports.getBatchPrices = async (symbols) => {
  const results = {};
  const toFetch = [];
  const symbolMap = {}; // Map normalized -> original

  // 1. Prepare symbols and check cache
  symbols.forEach(originalSym => {
    const normalized = normalize(originalSym);
    symbolMap[normalized] = originalSym;
    
    const cached = cache.get(`price_${normalized}`);
    if (cached) {
      results[originalSym] = cached;
    } else {
      toFetch.push(normalized);
    }
  });

  if (toFetch.length === 0) return results;

  try {
    // 2. Fetch missing quotes in batch
    const quotes = await yahooFinance.quote(toFetch);
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    quotesArray.forEach(quote => {
      if (quote && quote.regularMarketPrice) {
        const originalSym = symbolMap[quote.symbol];
        results[originalSym] = quote.regularMarketPrice;
        cache.set(`price_${quote.symbol}`, quote.regularMarketPrice);
      }
    });

    // 3. Handle any symbols that failed to return a price
    toFetch.forEach(normalized => {
      const originalSym = symbolMap[normalized];
      if (results[originalSym] === undefined) {
        results[originalSym] = null;
      }
    });

    return results;
  } catch (error) {
    console.error('Yahoo Finance batch error:', error.message);
    // Fallback to individual fetching if batch fails
    for (const normalized of toFetch) {
      const originalSym = symbolMap[normalized];
      try {
        results[originalSym] = await exports.getStockPrice(normalized);
      } catch (e) {
        results[originalSym] = null;
      }
    }
    return results;
  }
};

exports.search = async (query) => {
  try {
    const result = await yahooFinance.search(query);
    // Filter for stocks/equities and format results
    return result.quotes
      .filter(q => q.quoteType === 'EQUITY')
      .map(q => ({
        symbol: q.symbol,
        name: q.shortname || q.longname,
        exchange: q.exchange
      }));
  } catch (error) {
    console.error(`Yahoo Finance search error for ${query}:`, error.message);
    throw error;
  }
};
