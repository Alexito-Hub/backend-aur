import type { Request, Response } from 'express';
import Config from '../../../Core/System/Config';

const INTERNAL_EXACT_PATHS = new Set([
    '/hub/services',
    '/health',
    '/graphql',
]);

const DEFAULT_STATUS_CODES = [200, 201, 301, 304, 400, 401, 403, 404, 429, 500, 502, 503];
const API_BASE = process.env.PUBLIC_API_BASE || 'https://api.auralixpe.xyz';

function toMap(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, any>;
    }
    return {};
}

function asString(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : fallback;
    }
    if (value == null) return fallback;
    const casted = String(value).trim();
    return casted.length > 0 ? casted : fallback;
}

function asStringArray(value: unknown): string[] {
    if (!value) return [];

    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => asString(item))
            .filter(Boolean);
    }

    return [];
}

function uniqueStrings(items: string[]): string[] {
    return Array.from(new Set(items.filter(Boolean)));
}

function normalizeEndpoint(rawPath: unknown): string {
    const endpoint = asString(rawPath);
    if (!endpoint) return '/';

    const [pathOnly] = endpoint.split('?');
    const normalized = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;

    // Keep folder organization out of public URL contracts.
    if (normalized.startsWith('/hub/services/')) {
        return `/hub/${normalized.slice('/hub/services/'.length)}`;
    }

    return normalized;
}

function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');

    return slug || 'service';
}

function inferProject(endpoint: string, explicitProject: unknown): string {
    const explicit = asString(explicitProject).toLowerCase();

    const endpointCategories = inferEndpointCategories(endpoint);
    const fallbackFromEndpoint = endpointCategories[0] || 'core';

    if (explicit && !['hub', 'services', 'service', 'core'].includes(explicit)) {
        return explicit;
    }

    if (explicit === 'hub' && fallbackFromEndpoint) {
        return fallbackFromEndpoint;
    }

    return fallbackFromEndpoint;
}

function inferEndpointCategories(endpoint: string): string[] {
    const rawParts = endpoint
        .split('/')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

    if (rawParts.length === 0) return [];

    let parts = rawParts;
    if (parts[0] === 'hub') {
        parts = parts.slice(1);
    }
    if (parts[0] === 'services') {
        parts = parts.slice(1);
    }

    if (parts.length === 0) return [];
    if (parts.length === 1) return [parts[0]];

    return parts.slice(0, parts.length - 1);
}

function isGenericCategory(value: string): boolean {
    const normalized = asString(value).toLowerCase();
    return !normalized || ['hub', 'services', 'service', 'core'].includes(normalized);
}

function isServiceRoute(entry: Record<string, any>): boolean {
    const category = asString(entry.category).toLowerCase();
    if (category === 'services') return true;

    const sourceFile = asString(entry.sourceFile).replace(/\\/g, '/').toLowerCase();
    if (sourceFile.includes('/routes/hub/services/')) return true;

    const rawPath = asString(entry.raw?.path || entry.path).split('?')[0];
    return rawPath.startsWith('/hub/services/');
}

function parseStatusCode(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
    if (typeof raw === 'string') {
        const parsed = Number.parseInt(raw.trim(), 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function inferStatusCodes(entry: Record<string, any>, meta: Record<string, any>): number[] {
    const base = new Set<number>();

    const fromEntry = Array.isArray(entry.statusCodes) ? entry.statusCodes : [];
    for (const code of fromEntry) {
        const parsed = parseStatusCode(code);
        if (parsed != null) base.add(parsed);
    }

    const responseMap = toMap(meta.responses || entry.response?.statusCodes);
    for (const key of Object.keys(responseMap)) {
        const parsed = parseStatusCode(key);
        if (parsed != null) base.add(parsed);
    }

    if (base.size === 0) {
        for (const code of DEFAULT_STATUS_CODES) {
            base.add(code);
        }
    }

    return Array.from(base).sort((a, b) => a - b);
}

function inferParameters(
    entry: Record<string, any>,
    meta: Record<string, any>,
    method: string,
): Array<Record<string, any>> {
    const candidates = [
        meta.parameters,
        entry.request?.parameters,
        entry.parameters,
        entry.parameter,
    ];

    const parameterLocation = method === 'GET' ? 'query' : 'body';

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            const parameters = candidate
                .map((item) => {
                    if (typeof item === 'string') {
                        return {
                            name: item,
                            type: 'string',
                            required: true,
                            location: parameterLocation,
                            description: '',
                            example: '',
                        };
                    }

                    const map = toMap(item);
                    const name = asString(map.name || map.key);
                    if (!name) return null;

                    return {
                        name,
                        type: asString(map.type, 'string'),
                        required: Boolean(map.required ?? map.isRequired ?? false),
                        location: asString(map.location || map.in, parameterLocation),
                        description: asString(map.description || map.desc || map.label),
                        example: map.example ?? map.value ?? '',
                    };
                })
                .filter(Boolean);

            return parameters as Array<Record<string, any>>;
        }

        if (candidate && typeof candidate === 'object') {
            const map = toMap(candidate);
            return Object.keys(map).map((key) => ({
                name: key,
                type: 'string',
                required: true,
                location: parameterLocation,
                description: '',
                example: map[key],
            }));
        }
    }

    return [];
}

function normalizeJson(value: unknown): string {
    if (value == null) return '';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';

        try {
            const parsed = JSON.parse(trimmed);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return trimmed;
        }
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return asString(value);
    }
}

function inferRequestExample(entry: Record<string, any>, meta: Record<string, any>): string {
    return normalizeJson(
        meta.requestExample ||
        entry.request?.example ||
        entry.raw?.example?.body ||
        entry.raw?.example ||
        {},
    );
}

function inferResponseExample(entry: Record<string, any>, meta: Record<string, any>): string {
    return normalizeJson(
        meta.responseExample ||
        entry.response?.example ||
        {
            status: true,
            data: {},
        },
    );
}

function buildDefaultExamples(method: string, endpoint: string, requestExample: string, requiresAuth: boolean): Record<string, string> {
    const methodUpper = method.toUpperCase();
    const authHeaders = requiresAuth ?
        '-H "Authorization: Bearer <token>" \\\n  ' :
        '';

    let curlBody = '';
    let nodeBody = '';
    let pyBody = '';
    let normalizedBody = '{}';

    if (requestExample.trim()) {
        try {
            normalizedBody = JSON.stringify(JSON.parse(requestExample));
        } catch {
            normalizedBody = '{}';
        }
    }

    if (methodUpper !== 'GET') {
        curlBody = ` \\\n+  -d '${normalizedBody}'`;
        nodeBody = `\n  body: JSON.stringify(${normalizedBody}),`;
        pyBody = `\n    json=${normalizedBody},`;
    }

    return {
        curl: `curl -X ${methodUpper} "${API_BASE}${endpoint}" \\\n  ${authHeaders}-H "Content-Type: application/json"${curlBody}`,
        nodejs: `const response = await fetch('${API_BASE}${endpoint}', {\n  method: '${methodUpper}',\n  headers: {\n    ${requiresAuth ? "'Authorization': 'Bearer <token>',\\n    " : ''}'Content-Type': 'application/json',\n  },${nodeBody}\n});\nconst data = await response.json();\nconsole.log(data);`,
        python: `import requests\n\nresponse = requests.request(\n    '${methodUpper}',\n    '${API_BASE}${endpoint}',\n    headers={\n        ${requiresAuth ? "'Authorization': 'Bearer <token>',\\n        " : ''}'Content-Type': 'application/json',\n    },${pyBody}\n)\nprint(response.json())`,
        javascript: `const res = await fetch('${API_BASE}${endpoint}', {\n  method: '${methodUpper}',\n  headers: {\n    ${requiresAuth ? "'Authorization': 'Bearer <token>',\\n    " : ''}'Content-Type': 'application/json',\n  },${nodeBody}\n});\nconsole.log(await res.json());`,
    };
}

function inferExamples(
    entry: Record<string, any>,
    meta: Record<string, any>,
    method: string,
    endpoint: string,
    requestExample: string,
    requiresAuth: boolean,
): Record<string, string> {
    const extracted = toMap(meta.examples || entry.examples);
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(extracted)) {
        const language = asString(key).toLowerCase();
        const snippet = normalizeJson(value);
        if (!language || !snippet) continue;
        normalized[language] = snippet;
    }

    const defaults = buildDefaultExamples(method, endpoint, requestExample, requiresAuth);
    for (const [language, snippet] of Object.entries(defaults)) {
        if (!normalized[language]) {
            normalized[language] = snippet;
        }
    }

    return normalized;
}

function shouldExpose(entry: Record<string, any>): boolean {
    const meta = toMap(entry.meta);
    const config = toMap(entry.config);
    const endpoint = normalizeEndpoint(entry.raw?.path || entry.path);

    if (!isServiceRoute(entry)) return false;
    if (!endpoint || INTERNAL_EXACT_PATHS.has(endpoint)) return false;
    if (endpoint.toLowerCase().includes('/webhook')) return false;
    if (asString(meta.visibility).toLowerCase() === 'private') return false;
    if (config.expose === false) return false;

    return true;
}

function normalizeRoute(entry: Record<string, any>): Record<string, any> | null {
    if (!entry || typeof entry !== 'object') return null;
    if (!shouldExpose(entry)) return null;

    const meta = toMap(entry.meta);
    const endpoint = normalizeEndpoint(entry.raw?.path || entry.path);
    const method = asString(meta.method || entry.method, 'GET').toUpperCase();
    const project = inferProject(endpoint, meta.project || entry.project);
    const categories = uniqueStrings([
        ...inferEndpointCategories(endpoint),
        ...asStringArray(meta.categories),
        ...asStringArray(entry.categories),
        asString(entry.category),
        project,
    ]).filter((category) => !isGenericCategory(category));
    if (categories.length === 0 && project) {
        categories.push(project);
    }
    const tags = uniqueStrings([
        ...asStringArray(meta.tags),
        ...asStringArray(entry.tags),
    ]);
    const requiresAuth = Boolean(meta.requiresAuth ?? entry.requiresAuth ?? false);

    const name = asString(meta.name, asString(entry.name, endpoint));
    const description = asString(
        meta.description || entry.description,
        `Service ${name} available at ${endpoint}.`,
    );
    const id = asString(meta.id, `svc-${slugify(`${project}-${method}-${endpoint}`)}`);
    const slug = asString(meta.slug, slugify(`${project}-${name}`));

    const parameters = inferParameters(entry, meta, method);
    const requestExample = inferRequestExample(entry, meta);
    const responseExample = inferResponseExample(entry, meta);
    const examples = inferExamples(
        entry,
        meta,
        method,
        endpoint,
        requestExample,
        requiresAuth,
    );

    const statusCodes = inferStatusCodes(entry, meta);
    const related = uniqueStrings([
        ...asStringArray(meta.related),
        ...asStringArray(entry.related),
    ]);

    const sandboxMeta = toMap(meta.sandbox || entry.sandbox);
    const sandboxEnabled = Boolean(sandboxMeta.enabled ?? true);

    return {
        id,
        slug,
        name,
        description,
        project,
        categories,
        tags,
        method,
        endpoint,
        requiresAuth,
        parameters,
        examples,
        codeExamples: examples,
        requestExample,
        responseExample,
        statusCodes,
        responses: toMap(meta.responses || entry.response?.statusCodes),
        sandbox: {
            enabled: sandboxEnabled,
            ...sandboxMeta,
        },
        related,
        source: {
            category: asString(entry.category),
            file: asString(entry.sourceFile),
            handler: asString(entry.raw?.handler),
        },
    };
}

export default {
    name: 'Hub Services Catalog',
    path: '/hub/services',
    method: 'get',
    category: 'services',
    premium: false,
    logger: false,
    execution: async (_req: Request, res: Response) => {
        try {
            const services = (Config.routes || [])
                .map((route: any) => normalizeRoute(toMap(route)))
                .filter(Boolean)
                .sort((a: any, b: any) => a.name.localeCompare(b.name));

            return res.status(200).json({
                status: true,
                version: '1.0',
                total: services.length,
                services,
                data: {
                    services,
                    total: services.length,
                    generatedAt: new Date().toISOString(),
                },
            });
        } catch (err: any) {
            return res.status(500).json({
                status: false,
                msg: 'Failed to build services catalog',
                error: err?.message || 'Unknown error',
            });
        }
    },
};
