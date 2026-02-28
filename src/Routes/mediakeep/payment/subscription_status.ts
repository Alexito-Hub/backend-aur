import type { Request, Response } from 'express';
import admin from '../../../Config/firebase';
import Middlewares from '../middlewares';

const db = admin.firestore();

export default {
    name: 'Get Subscription Status',
    path: '/payment/subscription',
    method: 'get',
    category: 'payment',
    premium: false,
    error: false,
    logger: false,
    // Uses pay stack (AppToken + FirebaseAuth) — no usage decrement
    validator: Middlewares.pay,
    execution: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const doc = await db.collection('users').doc(user.uid).get();

            if (!doc.exists) {
                return res.status(200).json({
                    status: true,
                    data: {
                        plan: 'free',
                        isActive: false,
                        subscriptionExpiresAt: null,
                        daysRemaining: 0
                    }
                });
            }

            const data = doc.data()!;
            const plan = data.plan || 'free';
            const subscriptionExpiresAt = data.subscriptionExpiresAt || null;

            let isActive = false;
            let daysRemaining = 0;

            if (plan === 'premium' && subscriptionExpiresAt) {
                const expiresAt = new Date(subscriptionExpiresAt);
                const now = new Date();
                isActive = expiresAt > now;
                if (isActive) {
                    daysRemaining = Math.ceil(
                        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    );
                }
            }

            return res.status(200).json({
                status: true,
                data: {
                    plan,
                    isActive,
                    subscriptionExpiresAt,
                    daysRemaining,
                    requestsCount: data.requestsCount || 0,
                    totalLimit: data.totalLimit || 10
                }
            });
        } catch (error) {
            console.error('Error fetching subscription status:', error);
            return res.status(500).json({ status: false, msg: 'Error al consultar suscripción.' });
        }
    }
};
