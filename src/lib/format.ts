export const fmt = (n: number, decimals: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

export const shortUnit = (u: string) => (u === '% of pre-flight' ? '%' : u)

export const signed = (n: number, decimals: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n), decimals)}`
