export enum Symbols {
  SOL = "sol",
  BTC = "btc",
  ETH = "eth",
  DOGE = "doge",
  ADA = "ada",
  XRP = "xrp",
}

export const SymbolNames: Record<Symbols, string> = {
  [Symbols.SOL]: "solana",
  [Symbols.BTC]: "bitcoin",
  [Symbols.ETH]: "ethereum",
  [Symbols.DOGE]: "dogecoin",
  [Symbols.ADA]: "cardano",
  [Symbols.XRP]: "ripple",
};
