import { Request, Response } from 'express';
import { HubRequestLog } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub User History',
    path: '/hub/user/history',
    method: 'get',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const page = Math.max(1, parseInt(String(req.query.page ?? 1)));
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? 20))));
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            HubRequestLog.find({ userId: user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            HubRequestLog.countDocuments({ userId: user._id }),
        ]);
        return res.json({ status: true, data: { logs, total, page, pages: Math.ceil(total / limit) } });
    }
};