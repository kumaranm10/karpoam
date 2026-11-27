import type { APIRoute } from 'astro';
import { SITE } from '../config';
/** Generated from src/site.json. Empty until ads.client is set. */
export const GET: APIRoute = () => {
  const pub = SITE.ads.client.replace(/^ca-/, '');
  return new Response(pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# Ads are off.\n');
};
