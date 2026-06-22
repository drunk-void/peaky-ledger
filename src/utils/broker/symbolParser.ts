export interface ParsedSymbol {
  exchange: string;
  underlying: string;
  isDerivative: boolean;
  expiryDate?: string; // Format: DD/MM/YYYY
  strike?: number;
  optionType?: 'CE' | 'PE';
  series?: string;
  formattedString: string;
}

export function parseBrokerSymbol(symbol: string): ParsedSymbol {
  const parts = symbol.split(':');
  if (parts.length !== 2) {
    return {
      exchange: '',
      underlying: symbol,
      isDerivative: false,
      formattedString: symbol,
    };
  }

  const exchange = parts[0];
  const rest = parts[1];

  // Fyers Options pattern: e.g. NIFTY2662323800PE
  // Captures: 
  // 1: Underlying (e.g. NIFTY)
  // 2: YY (e.g. 26)
  // 3: M (1-9 or O,N,D)
  // 4: DD (e.g. 23)
  // 5: Strike (e.g. 23800)
  // 6: CE or PE
  const optMatch = rest.match(/^([A-Z0-9_]+?)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/i);
  if (optMatch) {
    const underlying = optMatch[1];
    const yy = optMatch[2];
    const m = optMatch[3].toUpperCase();
    const dd = optMatch[4];
    const strike = parseInt(optMatch[5], 10);
    const optionType = optMatch[6].toUpperCase() as 'CE' | 'PE';

    const monthMap: Record<string, string> = {
      '1': '01', '2': '02', '3': '03', '4': '04', '5': '05', '6': '06',
      '7': '07', '8': '08', '9': '09', 'O': '10', 'N': '11', 'D': '12'
    };
    
    const month = monthMap[m] || '01';
    const year = `20${yy}`;
    const expiryDate = `${dd}/${month}/${year}`;
    
    const formattedString = `${underlying} ${strike} ${optionType} (${expiryDate})`;
    
    return {
      exchange,
      underlying,
      isDerivative: true,
      expiryDate,
      strike,
      optionType,
      formattedString
    };
  }

  // Fyers Equity pattern: e.g. RELIANCE-EQ
  const eqMatch = rest.match(/^([A-Z0-9]+)-([A-Z]+)$/i);
  if (eqMatch) {
    const underlying = eqMatch[1];
    const series = eqMatch[2];
    return {
      exchange,
      underlying,
      isDerivative: false,
      series,
      formattedString: `${underlying} (${series})`
    };
  }

  // Monthly or Weekly Futures pattern: e.g. NIFTY26JANFUT
  const futMatch = rest.match(/^([A-Z0-9_]+?)(\d{2})([A-Z]{3})FUT$/i);
  if (futMatch) {
    const underlying = futMatch[1];
    const yy = futMatch[2];
    const mmm = futMatch[3];
    return {
      exchange,
      underlying,
      isDerivative: true,
      formattedString: `${underlying} FUT (${mmm} '20${yy})`
    };
  }

  // Fallback
  return {
    exchange,
    underlying: rest,
    isDerivative: false,
    formattedString: rest
  };
}
