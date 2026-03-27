import { Request, Response } from 'express';
export default {
    name: 'Hub Logout',
    path: '/hub/auth/logout',
    method: 'post',
    category: 'hub',
    execution: async (req: Request, res: Response) => {
        res.clearCookie('hub_refresh', { path: '/' });
        return res.json({ status: true, msg: 'Sesión cerrada' });
    }
};