/**
 * Origem fixa: Rua Angelina Cavalli, 736 – Maracanã – Colombo/PR (CEP 83408-477).
 * Referência municipal (IBGE, aprox. sede): lat -25,3648956 · lng -49,1771888.
 * Sobrescreva com STORE_LAT / STORE_LNG no ambiente se precisar ajustar.
 */
export const STORE = {
  label: 'Loja — Rua Angelina Cavalli, 736, Maracanã, Colombo/PR',
  lat: Number(process.env.STORE_LAT ?? -25.3648956),
  lng: Number(process.env.STORE_LNG ?? -49.1771888),
};
