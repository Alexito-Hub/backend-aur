import type { Request, Response } from 'express';
import admin from '../../../Config/firebase';
import Middlewares from '../middlewares';

const db = admin.firestore();

export default {
    name: 'Get User Detail (Admin)',
    path: '/admin/users/:uid',
    method: 'get',
    category: 'admin',
    premium: false,
    error: false,
    logger: false,
    validator: Middlewares.admin,
    execution: async (req: Request, res: Response) => {
        try {
            const { uid } = req.params;
            const userRef = db.collection('users').doc(uid);

            const [userDoc, paymentsSnap, historySnap] = await Promise.all([
                userRef.get(),
                db.collection('payments').where('userId', '==', uid).orderBy('timestamp', 'desc').limit(10).get(),
                db.collection('history').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(20).get(),
            ]);

            if (!userDoc.exists) {
                return res.status(404).json({ status: false, msg: 'Usuario no encontrado.' });
            }

            const userData = userDoc.data()!;
            const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const history = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));

            return res.status(200).json({
                status: true,
                data: {
                    uid,
                    email: userData.email,
                    name: userData.name,
                    picture: userData.picture,
                    plan: userData.plan,
                    role: userData.role || 'user',
                    requestsCount: userData.requestsCount,
                    totalLimit: userData.totalLimit,
                    subscriptionExpiresAt: userData.subscriptionExpiresAt || null,
                    lastPaymentId: userData.lastPaymentId || null,
                    createdAt: userData.createdAt,
                    recentPayments: payments,
                    recentHistory: history,
                }
            });
        } catch (error) {
            console.error('Error fetching user detail:', error);
            return res.status(500).json({ status: false, msg: 'Error al obtener usuario.' });
        }
    }
};
