export interface PriceResponse {
  [key: string]: { usd: number };
}

export type PriceMap = Record<string, number>;
