/**
 * Cabeçalhos HTTP defensivos (sem dependências extra).
 * O proxy (nginx) pode acrescentar HSTS, CSP, etc.
 */
export function securityHeadersMiddleware() {
  return function securityHeaders(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  };
}
