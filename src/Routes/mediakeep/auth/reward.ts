import type { Request, Response } from 'express';
import Middlewares from '../middlewares';
import admin from '../../../Config/firebase';
import crypto from 'crypto';

export default {
    name: 'Grant Reward Request',
    path: '/auth/reward',
    method: 'post',
    category: 'auth',
    example: {
        url: '/auth/reward',
    },
    parameter: [],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        next();
    },
    validator: Middlewares.reward,
    execution: async (req: Request, res: Response) => {
        try {
            const db = admin.firestore();
            const user = (req as any).user;

            // Extract the reward amount from the request body (default is 1 if missing)
            let amount = 1;
            if (req.body && req.body.amount && typeof req.body.amount === 'number' && req.body.amount > 0) {
                amount = req.body.amount;
            }

            if (user) {
                // Authenticated user
                const userRef = db.collection('users').doc(user.uid);
                await db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(userRef);

                    if (doc.exists) {
                        const data = doc.data()!;
                        const currentCount = data.requestsCount || 0;
                        // Decrement requestsCount by the reward amount (gives them free queries)
                        const newCount = Math.max(0, currentCount - amount);
                        transaction.update(userRef, { requestsCount: newCount });
                    }
                });

            } else {
                // Unauthenticated user
                const ip = req.ip || req.connection?.remoteAddress || 'unknown';
                const fingerprint = req.headers['x-device-fingerprint'] || 'unknown';
                const hash = crypto.createHash('sha256').update(`${ip}-${fingerprint}`).digest('hex');

                const unauthRef = db.collection('unauth_usage').doc(hash);
                await db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(unauthRef);

                    if (doc.exists) {
                        const data = doc.data()!;
                        const currentCount = data.requestsCount || 0;
                        // Decrement requestsCount by the reward amount
                        const newCount = Math.max(0, currentCount - amount);
                        transaction.update(unauthRef, { requestsCount: newCount, lastUsed: admin.firestore.FieldValue.serverTimestamp() });
                    }
                });
            }

            return res.status(200).json({ status: true, msg: `Recompensa de ${amount} obtenida exitosamente.` });

        } catch (e) {
            console.error('Error granting reward:', e);
            return res.status(500).json({ status: false, msg: 'Error interno otorgando recompensa.' });
        }
    }
};
