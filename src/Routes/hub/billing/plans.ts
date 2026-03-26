import { Request, Response } from 'express';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';
const PLANS = [
    { id: 'p50', name: '50 solicitudes', credits: 50, price: 1.50, currency: 'USD' },
    { id: 'p100', name: '100 solicitudes', credits: 100, price: 2.50, currency: 'USD' },
    { id: 'p250', name: '250 solicitudes', credits: 250, price: 5.00, currency: 'USD' },
    { id: 'p500', name: '500 solicitudes', credits: 500, price: 9.00, currency: 'USD' },
    { id: 'p1000', name: '1000 solicitudes', credits: 1000, price: 15.00, currency: 'USD' },
    { id: 'weekly', name: 'Semanal ilimitado', credits: -1, price: 20.00, currency: 'USD', badge: 'Popular' },
];
export default {
    name: 'Hub Billing Plans', path: '/api/hub/billing/plans', method: 'get', category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => res.json({ status: true, data: PLANS })
};