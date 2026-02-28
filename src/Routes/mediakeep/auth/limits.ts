import type { Request, Response } from 'express';
import admin from '../../../Config/firebase';
import Middlewares from '../middlewares';

const db = admin.firestore();

export default {
    name: 'Get Usage Limits',
    path: '/auth/limits',
    method: 'get',
    category: 'auth',
    premium: false,
    error: false,
    logger: false,
    // Uses FirebaseAuth but NOT UsageLimit so we don't consume a request just by checking
    validator: Middlewares.pay, // AppToken + FirebaseAuth only (no usage decrement)
    execution: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const doc = await db.collection('users').doc(user.uid).get();

            if (!doc.exists) {
                return res.status(200).json({
                    status: true,
                    data: {
                        plan: 'free',
                        requestsCount: 0,
                        totalLimit: 10,
                        remaining: 10,
                        subscriptionExpiresAt: null,
                        isExpired: false
                    }
                });
            }

            const data = doc.data()!;
            const plan = data.plan || 'free';
            const requestsCount = data.requestsCount || 0;
            const totalLimit = data.totalLimit || 10;
            const subscriptionExpiresAt = data.subscriptionExpiresAt || null;

            let isExpired = false;
            if (plan === 'premium' && subscriptionExpiresAt) {
                isExpired = new Date(subscriptionExpiresAt) < new Date();
            }

            return res.status(200).json({
                status: true,
                data: {
                    plan,
                    requestsCount,
                    totalLimit,
                    remaining: plan === 'free' ? Math.max(0, totalLimit - requestsCount) : null,
                    subscriptionExpiresAt,
                    isExpired
                }
            });
        } catch (error) {
            console.error('Error fetching usage limits:', error);
            return res.status(500).json({ status: false, msg: 'Error al consultar límites.' });
        }
    }
};
