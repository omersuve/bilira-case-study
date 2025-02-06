export interface BinanceTradeMessage {
  e: string; // Event type (e.g., "trade")
  E: number; // Event time
  s: string; // Symbol (e.g., "BTCUSDT")
  t: number; // Trade ID
  p: string; // Last traded price (as a string)
  q: string; // Quantity traded
  T: number; // Trade time
  m: boolean; // Is the buyer the market maker?
  M: boolean; // Ignore
}

export interface BinanceMarkPriceMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  p: string; // Mark price
  i: string; // Index price
  P: string; // Estimated Settle Price, only useful in the last hour before the settlement starts
  r: string; // Funding rate
  T: number; // Next funding time
}
