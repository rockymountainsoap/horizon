const ALLOWED_ORIGINS = (env) => {
  const domains = [env.SHOP_DOMAIN, env.SHOP_MYSHOPIFY_DOMAIN].filter(Boolean);
  return domains.map((d) => `https://${d}`);
};

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS(env);
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0] ?? '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function secureHeaders(request, env) {
  return {
    ...corsHeaders(request, env),
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };
}

export function jsonResponse(data, status = 200, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: secureHeaders(request, env),
  });
}

export function errorResponse(message, status, request, env) {
  return new Response(JSON.stringify({ ok: false, reason: message }), {
    status,
    headers: secureHeaders(request, env),
  });
}
