/**
 * Origem fixa: Rua Angelina Cavalli, 736 – Maracanã – Colombo/PR (CEP 83408-477).
 * Sobrescreva com STORE_LAT / STORE_LNG no ambiente se precisar ajustar.
 */
export const STORE = {
  label: 'Loja — Rua Angelina Cavalli, 736, Maracanã, Colombo/PR',
  lat: Number(process.env.STORE_LAT ?? -25.36486),
  lng: Number(process.env.STORE_LNG ?? -49.17735),
};
