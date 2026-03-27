import { Request, Response } from 'express';
import { HubTransaction } from '../../../Modules/Hub/Models';
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
    name: 'Hub Billing Purchase',
    path: '/hub/billing/purchase',
    method: 'post',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const { planId, customCredits } = req.body;
        
        let plan = PLANS.find(p => p.id === planId);
        if (customCredits && !plan) {
            plan = { id: 'custom', name: `${customCredits} solicitudes`, credits: Number(customCredits), price: Number(customCredits) * 0.015, currency: 'USD' };
        }
        if (!plan) return res.status(400).json({ status: false, msg: 'Plan o créditos inválidos' });

        const transaction = await HubTransaction.create({ userId: user._id, type: 'purchase', planId: plan.id, credits: plan.credits, provider: 'cryptomus', status: 'pending', metadata: { price: plan.price, currency: plan.currency } });

        const cryptomusApiKey = process.env.CRYPTOMUS_API_KEY || '';
        let paymentUrl = `https://pay.cryptomus.com/pay/${(transaction as any)._id}`;

        if (cryptomusApiKey) {
            try {
                const { default: axios } = await import('axios');
                const payload = { amount: plan.price.toFixed(2), currency: 'USD', order_id: (transaction as any)._id.toString(), url_return: `${process.env.FRONTEND_URL}/billing`, url_callback: `${process.env.BACKEND_URL || 'https://api.auralixpe.xyz'}/api/hub/payments/cryptomus/webhook`, lifetime: 3600 };
                const sign = require('crypto').createHash('md5').update(Buffer.from(JSON.stringify(payload)).toString('base64') + cryptomusApiKey).digest('hex');
                const res2 = await axios.post('https://api.cryptomus.com/v1/payment', payload, { headers: { merchant: process.env.CRYPTOMUS_MERCHANT_ID, sign, 'Content-Type': 'application/json' } });
                paymentUrl = res2.data?.result?.url || paymentUrl;
            } catch { } // fallback
        }
        return res.json({ status: true, data: { transactionId: (transaction as any)._id, paymentUrl } });
    }
};