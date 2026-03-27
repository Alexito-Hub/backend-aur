import { Request, Response } from 'express';
import { HubTransaction, HubUser } from '../../../Modules/Hub/Models';

export default {
    name: 'Hub Cryptomus Webhook',
    path: '/hub/payments/cryptomus/webhook',
    method: 'post',
    category: 'hub',
    execution: async (req: Request, res: Response) => {
        const { order_id, status, sign } = req.body;
        const apiKey = process.env.CRYPTOMUS_API_KEY || '';
        if (apiKey) {
            const body = { ...req.body }; delete body.sign;
            const expectedSign = require('crypto').createHash('md5').update(Buffer.from(JSON.stringify(body)).toString('base64') + apiKey).digest('hex');
            if (sign !== expectedSign) return res.status(400).json({ status: false, msg: 'Invalid signature' });
        }

        if (status === 'paid' || status === 'paid_over') {
            const tx = await HubTransaction.findById(order_id);
            if (tx && tx.status === 'pending') {
                tx.status = 'completed'; await tx.save();
                if (tx.credits > 0) await HubUser.updateOne({ _id: tx.userId }, { $inc: { credits: tx.credits } });
                else await HubUser.updateOne({ _id: tx.userId }, { plan: 'weekly', credits: 9999 });
            }
        }
        return res.json({ status: true });
    }
};