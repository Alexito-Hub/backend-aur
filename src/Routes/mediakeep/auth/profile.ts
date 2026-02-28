import type { Request, Response } from 'express';
import admin from '../../../Config/firebase';
import Middlewares from '../middlewares';

const db = admin.firestore();

export default {
    name: 'Get User Profile',
    path: '/auth/profile',
    method: 'get',
    category: 'auth',
    premium: false,
    error: false,
    logger: false,
    validator: Middlewares.member,
    execution: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();

            if (!doc.exists) {
                // Auto-initialize user if not found (first access with token)
                const newUser = {
                    email: user.email || '',
                    name: user.name || user.display_name || '',
                    picture: user.picture || '',
                    plan: 'free',
                    role: 'user',
                    requestsCount: 0,
                    totalLimit: 10,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };
                await userRef.set(newUser);
                return res.status(200).json({ status: true, data: { uid: user.uid, ...newUser } });
            }

            const data = doc.data()!;
            return res.status(200).json({
                status: true,
                data: {
                    uid: user.uid,
                    email: data.email,
                    name: data.name,
                    picture: data.picture,
                    plan: data.plan,
                    requestsCount: data.requestsCount,
                    totalLimit: data.totalLimit,
                    subscriptionExpiresAt: data.subscriptionExpiresAt || null,
                    createdAt: data.createdAt
                }
            });
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return res.status(500).json({ status: false, msg: 'Error al obtener perfil de usuario.' });
        }
    }
};
