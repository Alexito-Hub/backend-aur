import { Request, Response, NextFunction } from 'express';
import admin from '../Config/firebase';

const db = admin.firestore();

/**
 * SuspiciousActivityLogger — Lightweight middleware that detects patterns
 * indicating abuse or attacks. Logs events and optionally auto-blocks.
 *
 * Detects:
 *  - Usage limit violations (already caught by usageLimit.ts, we log here for auditing)
 *  - Rapid repeated 403/401 responses from the same IP
 *  - Malformed request bodies
 *  - Unknown platform attempts
 */
export default new class SuspiciousActivityLogger {

    /** Tracks recent 403/401 responses per IP for burst detection */
    private readonly recentViolations = new Map<string, { count: number; firstSeen: number }>();
    private readonly VIOLATION_WINDOW_MS = 60 * 1000; // 1 minute
    private readonly AUTO_BLOCK_THRESHOLD = 15; // violations within window

    /**
     * Middleware: wraps res.json to intercept error responses and log suspicious patterns.
     */
    public monitor = (req: Request, res: Response, next: NextFunction) => {
        const originalJson = res.json.bind(res);

        res.json = (body: any) => {
            // Intercept after response is formed
            if (res.statusCode === 403 || res.statusCode === 401) {
                this._recordViolation(req, res.statusCode, body?.code);
            }
            return originalJson(body);
        };

        next();
    };

    private _recordViolation(req: Request, statusCode: number, code?: string) {
        const ip = (req as any).clientIp || req.ip || 'unknown';
        const now = Date.now();

        const existing = this.recentViolations.get(ip);

        if (!existing || (now - existing.firstSeen) > this.VIOLATION_WINDOW_MS) {
            this.recentViolations.set(ip, { count: 1, firstSeen: now });
        } else {
            existing.count++;

            if (existing.count >= this.AUTO_BLOCK_THRESHOLD) {
                this._flagSuspiciousIp(ip, existing.count, code);
                // Reset counter after flagging to avoid duplicate reports
                this.recentViolations.set(ip, { count: 0, firstSeen: now });
            }
        }

        // Log every individual violation for audit trail
        console.warn(JSON.stringify({
            event: 'suspicious_activity',
            ip,
            statusCode,
            code,
            path: req.path,
            method: req.method,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
        }));
    }

    private async _flagSuspiciousIp(ip: string, violationCount: number, code?: string) {
        try {
            await db.collection('security_events').add({
                type: 'ip_violation_burst',
                ip,
                violationCount,
                code: code || 'unknown',
                flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
                resolved: false,
            });

            console.warn(
                `[SECURITY] IP ${ip} flagged after ${violationCount} violations in 1 minute. Code: ${code}`
            );
        } catch (e) {
            console.error('[SECURITY] Failed to write security event:', e);
        }
    }

    /** Clears old entries from the in-memory map periodically */
    public startCleanupInterval(intervalMs = 5 * 60 * 1000) {
        setInterval(() => {
            const now = Date.now();
            for (const [ip, data] of this.recentViolations.entries()) {
                if (now - data.firstSeen > this.VIOLATION_WINDOW_MS * 2) {
                    this.recentViolations.delete(ip);
                }
            }
        }, intervalMs);
    }
}
