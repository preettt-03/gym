import { Router } from 'express';

interface RouteMount {
  prefix: string;
  router: Router;
  tag: string;
}

interface RouteEntry {
  method: string;
  path: string;
}

// Express stores route params as `:id`; OpenAPI wants `{id}`.
function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function extractPathParams(path: string): string[] {
  const matches = path.match(/:([A-Za-z0-9_]+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

// Walks a single (non-nested) Express Router's internal stack to list every
// route it registers. Our routers are all flat — mounted directly on `app`
// with no further nested `router.use(subRouter)` calls — so this doesn't
// need to recurse into nested routers.
function extractRoutes(router: Router): RouteEntry[] {
  const entries: RouteEntry[] = [];
  const stack = (router as unknown as { stack: Array<Record<string, unknown>> }).stack ?? [];

  for (const layer of stack) {
    const route = layer.route as { path: string; methods: Record<string, boolean> } | undefined;
    if (!route) continue;
    for (const method of Object.keys(route.methods)) {
      if (route.methods[method]) {
        entries.push({ method, path: route.path });
      }
    }
  }

  return entries;
}

export function buildOpenApiSpec(mounts: RouteMount[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  const tagsSeen = new Set<string>();

  for (const { prefix, router, tag } of mounts) {
    tagsSeen.add(tag);
    const routes = extractRoutes(router);

    for (const { method, path } of routes) {
      const fullPath = `${prefix}${path === '/' ? '' : path}` || '/';
      const openApiPath = toOpenApiPath(fullPath);
      const params = extractPathParams(fullPath);

      paths[openApiPath] ??= {};
      paths[openApiPath][method] = {
        tags: [tag],
        summary: `${method.toUpperCase()} ${openApiPath}`,
        security: [{ bearerAuth: [] }],
        parameters: params.map((name) => ({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        })),
        responses: {
          '200': { description: 'Success' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
        },
      };
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Gym Management Platform API',
      version: '1.0.0',
      description:
        'Auto-generated from the mounted Express routers — every path/method below is ' +
        'live on this server. Most endpoints require a Bearer access token (obtained via ' +
        'POST /api/v1/auth/login or /api/v1/auth/verify-otp); admin-only endpoints additionally ' +
        'require the authenticated user to have the ADMIN role. Use the "Authorize" button ' +
        'above with the accessToken returned from login to try requests directly from this UI.',
    },
    servers: [{ url: '/', description: 'Current server' }],
    tags: Array.from(tagsSeen).map((name) => ({ name })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths,
  };
}
