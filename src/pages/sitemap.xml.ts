import type { APIRoute } from 'astro';
import { LEVELS, lessonUrl, readyLessons, SUBJECTS } from '../config';

export const GET: APIRoute = ({ site }) => {
  const paths = [
    '/',
    '/parents/',
    '/about/',
    '/privacy/',
    ...SUBJECTS.map((s) => `/${s.id}/`),
    ...SUBJECTS.flatMap((s) => LEVELS.filter((l) => l.open).map((l) => `/${s.id}/${l.id}/`)),
    ...readyLessons().map(lessonUrl),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
