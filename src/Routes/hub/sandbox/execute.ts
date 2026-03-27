import { Request, Response } from 'express';
import axios from 'axios';
import { HubUser, HubRequestLog } from '../../../Modules/Hub/Models';
import { emitRequestLog } from '../../../Socket/hub';
import { hubAuthMiddleware, sandboxLimiter } from '../../../Modules/Hub/Middleware';

const BACKEND_BASE = process.env.INTERNAL_API_BASE || 'http://localhost:3000';

export default {
    name: 'Hub Sandbox Execute',
    path: '/hub/sandbox/execute',
    method: 'post',
    category: 'hub',
    requires: hubAuthMiddleware, validator: [sandboxLimiter],
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const { path, method, headers, body } = req.body;
        if (!path || !method) return res.status(400).json({ status: false, msg: 'path y method requeridos' });

        if (user.sandboxCredits <= 0) return res.status(403).json({ status: false, msg: 'Créditos de sandbox agotados' });
        
        const start = Date.now();
        let statusCode = 500;
        let responseHeaders = {};
        let responseBody: any = null;
        let creditsDeducted = 0;

        try {
            const result = await axios({ url: `${BACKEND_BASE}${path}`, method, headers: headers || {}, data: body || undefined, validateStatus: () => true, timeout: 15000 });
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
        await HubRequestLog.create({ userId: user._id, endpoint: path, method, statusCode, responseTimeMs, isSandbox: true, creditsDeducted, ip: (req as any).clientIp });
        
        emitRequestLog(String(user._id), { method, path, statusCode, durationMs: responseTimeMs, creditsUsed: creditsDeducted, timestamp: new Date() });
        return res.json({ status: true, data: { statusCode, headers: responseHeaders, body: responseBody, responseTimeMs, creditsDeducted, sandboxCreditsRemaining: user.sandboxCredits } });
    }
};