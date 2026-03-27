import { Request, Response } from 'express';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub Me',
    path: '/hub/auth/me',
    method: 'get',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        if (!user) return res.status(401).json({ status: false, msg: 'No autenticado' });
        const { passwordHash, emailVerifyToken, emailVerifyExpiry, __v, ...safe } = user.toObject ? user.toObject() : user;
        return res.json({ status: true, data: safe });
    }
};