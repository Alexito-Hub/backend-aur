import { Request, Response } from 'express';
import axios from 'axios';
import { HubUser, HubRequestLog } from '../../../Modules/Hub/Models';
import { emitRequestLog } from '../../../Socket/hub';
import { hubAuthMiddleware, sandboxLimiter } from '../../../Modules/Hub/Middleware';

const BACKEND_BASE = process.env.INTERNAL_API_BASE || 'http://localhost:3000';
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const ALLOWED_PATH_PREFIX = /^\/hub\/(ai|search|download|tools|info|trending)(\/|$)/i;

const MAX_PATH_LENGTH = 512;
const MAX_QUERY_LENGTH = 800;
const MAX_HEADER_COUNT = 20;
const MAX_HEADER_KEY = 64;
const MAX_HEADER_VALUE = 2048;
const MAX_BODY_CHARS = 100000;
const MAX_BODY_DEPTH = 8;
const MAX_BODY_KEYS = 300;
const MAX_BODY_ITEMS = 400;

const BLOCKED_HEADER_KEYS = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'cookie',
    'set-cookie',
    'authorization',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'origin',
    'referer',
]);

function normalizeMethod(value: unknown): string | null {
    const method = typeof value === 'string' ? value.toUpperCase().trim() : '';
    if (!ALLOWED_METHODS.has(method)) return null;
    return method;
}

function sanitizePath(value: unknown): { ok: true; path: string } | { ok: false; msg: string } {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return { ok: false, msg: 'path requerido' };
    if (raw.length > MAX_PATH_LENGTH) return { ok: false, msg: 'path demasiado largo' };
    if (!raw.startsWith('/')) return { ok: false, msg: 'path inválido: debe iniciar con /' };
    if (/[\r\n]/.test(raw)) return { ok: false, msg: 'path inválido' };
    if (/(\.\.|%2e%2e|%00|\\)/i.test(raw)) {
        return { ok: false, msg: 'path inválido: traversal no permitido' };
    }

    const base = new URL(BACKEND_BASE);
    const target = new URL(raw, BACKEND_BASE);

    if (target.origin !== base.origin) {
        return { ok: false, msg: 'path inválido: dominio no permitido' };
    }

    const normalizedPath = target.pathname.replace(/\/{2,}/g, '/');
    if (!ALLOWED_PATH_PREFIX.test(normalizedPath)) {
        return { ok: false, msg: 'Sandbox solo permite ejecutar rutas de servicios públicas' };
    }

    if (target.search.length > MAX_QUERY_LENGTH) {
        return { ok: false, msg: 'Query string demasiado largo' };
    }

    return { ok: true, path: `${normalizedPath}${target.search}` };
}

function sanitizeHeaders(raw: unknown, req: Request): Record<string, string> {
    const output: Record<string, string> = {};

    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const entries = Object.entries(raw as Record<string, unknown>).slice(0, MAX_HEADER_COUNT);

        for (const [keyRaw, valueRaw] of entries) {
            const key = String(keyRaw).trim();
            const normalizedKey = key.toLowerCase();
            if (!key || key.length > MAX_HEADER_KEY) continue;
            if (!/^[a-zA-Z0-9-]+$/.test(key)) continue;
            if (BLOCKED_HEADER_KEYS.has(normalizedKey)) continue;
            if (normalizedKey.startsWith('sec-')) continue;

            const value = valueRaw == null ? '' : String(valueRaw).trim();
            if (value.length > MAX_HEADER_VALUE) continue;

            output[key] = value;
        }
    }

    const authHeader = typeof req.headers.authorization === 'string'
        ? req.headers.authorization.trim()
        : '';
    const cookieToken = typeof req.cookies?.hub_token === 'string'
        ? req.cookies.hub_token.trim()
        : '';

    if (authHeader) {
        output.Authorization = authHeader;
    } else if (cookieToken) {
        output.Authorization = `Bearer ${cookieToken}`;
    }

    output['x-sandbox-execution'] = '1';
    return output;
}

function sanitizeBody(value: unknown, depth = 0): unknown {
    if (depth > MAX_BODY_DEPTH) {
        throw new Error('Payload demasiado profundo');
    }

    if (value == null) return value;

    if (typeof value === 'string') {
        if (value.length > MAX_BODY_CHARS) {
            throw new Error('Payload de texto demasiado largo');
        }
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        if (value.length > MAX_BODY_ITEMS) {
            throw new Error('Array demasiado grande');
        }
        return value.map((item) => sanitizeBody(item, depth + 1));
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length > MAX_BODY_KEYS) {
            throw new Error('Objeto demasiado grande');
        }

        const clean: Record<string, unknown> = {};
        for (const [keyRaw, item] of entries) {
            const key = String(keyRaw).trim();
            if (!key || key.length > 120) continue;

            const lower = key.toLowerCase();
            if (lower === '__proto__' || lower === 'prototype' || lower === 'constructor') {
                continue;
            }

            clean[key] = sanitizeBody(item, depth + 1);
        }
        return clean;
    }

    return String(value).slice(0, 1000);
}

export default {
    name: 'Hub Sandbox Execute',
    path: '/hub/sandbox/execute',
    method: 'post',
    category: 'hub',
    requires: hubAuthMiddleware, validator: [sandboxLimiter],
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const { path, method, headers, body } = req.body;

        const normalizedMethod = normalizeMethod(method);
        if (!normalizedMethod) {
            return res.status(400).json({ status: false, msg: 'Método no permitido para sandbox' });
        }

        const safePath = sanitizePath(path);
        if (!safePath.ok) {
            return res.status(400).json({ status: false, msg: safePath.msg });
        }

        let safeBody: unknown = undefined;
        if (normalizedMethod !== 'GET' && body != null) {
            try {
                safeBody = sanitizeBody(body);
                const serialized = JSON.stringify(safeBody ?? {});
                if (serialized.length > MAX_BODY_CHARS) {
                    return res.status(413).json({ status: false, msg: 'Payload demasiado largo para sandbox' });
                }
            } catch (error: any) {
                return res.status(400).json({ status: false, msg: error?.message || 'Payload inválido para sandbox' });
            }
        }

        const safeHeaders = sanitizeHeaders(headers, req);

        if (user.sandboxCredits <= 0) return res.status(403).json({ status: false, msg: 'Créditos de sandbox agotados' });

        const start = Date.now();
        let statusCode = 500;
        let responseHeaders = {};
        let responseBody: any = null;
        let creditsDeducted = 0;

        try {
            const targetUrl = new URL(safePath.path, BACKEND_BASE).toString();

            const result = await axios({
                url: targetUrl,
                method: normalizedMethod,
                headers: safeHeaders,
                data: normalizedMethod === 'GET' ? undefined : safeBody,
                validateStatus: () => true,
                timeout: 10000,
                maxBodyLength: MAX_BODY_CHARS,
                maxContentLength: 2 * 1024 * 1024,
            });

            statusCode = result.status;
            responseHeaders = result.headers;
            responseBody = result.data;
            if (statusCode >= 200 && statusCode < 300) {
                user.sandboxCredits -= 1;
                await user.save();
                creditsDeducted = 1;
            }
        } catch (err: any) {
            statusCode = 502; responseBody = { error: 'Gateway error', message: err.message };
        }

        const responseTimeMs = Date.now() - start;
        await HubRequestLog.create({
            userId: user._id,
            endpoint: safePath.path,
            method: normalizedMethod,
            statusCode,
            responseTimeMs,
            isSandbox: true,
            creditsDeducted,
            ip: (req as any).clientIp,
        });

        emitRequestLog(String(user._id), {
            method: normalizedMethod,
            path: safePath.path,
            statusCode,
            durationMs: responseTimeMs,
            creditsUsed: creditsDeducted,
            timestamp: new Date(),
        });

        return res.json({ status: true, data: { statusCode, headers: responseHeaders, body: responseBody, responseTimeMs, creditsDeducted, sandboxCreditsRemaining: user.sandboxCredits } });
    }
};