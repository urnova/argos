import { z } from 'zod';
import { insertAlertSchema, alerts, apiKeys, insertApiKeySchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  alerts: {
    list: {
      method: 'GET' as const,
      path: '/api/alerts' as const,
      responses: {
        200: z.array(z.custom<typeof alerts.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/alerts/:id' as const,
      responses: {
        200: z.custom<typeof alerts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/alerts' as const,
      input: insertAlertSchema,
      responses: {
        201: z.custom<typeof alerts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/alerts/:id' as const,
      input: insertAlertSchema.partial(),
      responses: {
        200: z.custom<typeof alerts.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/alerts/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  keys: {
    list: {
      method: 'GET' as const,
      path: '/api/keys' as const,
      responses: {
        200: z.array(z.custom<typeof apiKeys.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/keys' as const,
      input: insertApiKeySchema,
      responses: {
        201: z.custom<typeof apiKeys.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/keys/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export const ws = {
  send: {},
  receive: {
    alertCreated: z.custom<typeof alerts.$inferSelect>(),
  },
};
