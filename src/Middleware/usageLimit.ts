import { Request, Response, NextFunction } from 'express';
import admin from '../Config/firebase';
import crypto from 'crypto';

export default new class UsageLimit {
    /**
     * Validates strictly the 5 limit for unauth and 10 limit for auth.
     */
    public limit = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const db = admin.firestore();
            const user = (req as any).user; // Set by requireFirebaseAuth if present

            if (user) {
                // Authenticated user limit check
                const userRef = db.collection('users').doc(user.uid);
                await db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(userRef);

                    if (!doc.exists) {
                        transaction.set(userRef, {
                            email: user.email,
                            name: user.name || '',
                            picture: user.picture || '',
                            requestsCount: 1,
                            plan: 'free',
                            totalLimit: 10,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        return;
                    }

                    const data = doc.data()!;
                    const currentCount = data.requestsCount || 0;
                    const limit = data.totalLimit || 10;
                    const plan = data.plan || 'free';

                    // Check if premium subscription has expired
                    let effectivePlan = plan;
                    if (plan === 'premium' && data.subscriptionExpiresAt) {
                        const expiresAt = new Date(data.subscriptionExpiresAt);
                        if (expiresAt < new Date()) {
                            effectivePlan = 'free';
                            // Downgrade expired subscription atomically
                            transaction.update(userRef, { plan: 'free' });
                        }
                    }

                    if (effectivePlan === 'free' && currentCount >= limit) {
                        throw new Error('AUTH_LIMIT_REACHED');
                    }

                    transaction.update(userRef, { requestsCount: currentCount + 1 });
                });
                next();
            } else {
                // Unauthenticated user limit check
                const ip = req.ip || req.connection.remoteAddress || 'unknown';
                const fingerprint = req.headers['x-device-fingerprint'] || 'unknown';

                const hash = crypto.createHash('sha256').update(`${ip}-${fingerprint}`).digest('hex');

                const unauthRef = db.collection('unauth_usage').doc(hash);
                await db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(unauthRef);

                    if (!doc.exists) {
                        transaction.set(unauthRef, { requestsCount: 1, ip, fingerprint, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                        return;
                    }

                    const data = doc.data()!;
                    const currentCount = data.requestsCount || 0;

                    if (currentCount >= 5) {
                        throw new Error('UNAUTH_LIMIT_REACHED');
                    }

                    transaction.update(unauthRef, { requestsCount: currentCount + 1, lastUsed: admin.firestore.FieldValue.serverTimestamp() });
                });
                next();
            }
        } catch (error: any) {
            if (error.message === 'AUTH_LIMIT_REACHED') {
                return res.status(403).json({
                    status: false,
                    code: 'AUTH_LIMIT_REACHED',
                    msg: 'Has alcanzado el límite de descargas gratuitas en tu cuenta. Explora nuestros planes premium.'
                });
            }
            if (error.message === 'UNAUTH_LIMIT_REACHED') {
                return res.status(403).json({
                    status: false,
                    code: 'UNAUTH_LIMIT_REACHED',
                    msg: 'Has alcanzado el límite de 5 descargas gratuitas. Crea una cuenta para continuar.'
                });
            }
            console.error('Error checking usage limit:', error);
            return res.status(500).json({ status: false, msg: 'Error interno verificando límites.' });
        }
    };

    /**
     * Optional middleware to inject the decoded Token without failing if absent
     * Useful for public endpoints that track usage.
     */
    public user = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                (req as any).user = decodedToken;
            } catch (e) {
                // Ignore token error, proceed as unauth
            }
        }
        next();
    };
}
