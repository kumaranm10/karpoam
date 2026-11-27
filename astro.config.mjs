import { defineConfig } from 'astro/config';
import site from './src/site.json' with { type: 'json' };

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  build: { format: 'directory' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
