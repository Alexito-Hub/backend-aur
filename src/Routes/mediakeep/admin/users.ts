import type { Request, Response } from 'express';
import admin from '../../../Config/firebase';
import Middlewares from '../middlewares';

const db = admin.firestore();

export default {
    name: 'List Users (Admin)',
    path: '/admin/users',
    method: 'get',
    category: 'admin',
    premium: false,
    error: false,
    logger: false,
    validator: Middlewares.admin,
    execution: async (req: Request, res: Response) => {
        try {
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
            const cursor = req.query.cursor as string | undefined;
            const planFilter = req.query.plan as string | undefined;

            let query: FirebaseFirestore.Query = db.collection('users')
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (planFilter) {
                query = query.where('plan', '==', planFilter);
            }

            if (cursor) {
                const cursorDoc = await db.collection('users').doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            const snapshot = await query.get();
            const users = snapshot.docs.map(doc => ({
                uid: doc.id,
                email: doc.data().email,
                name: doc.data().name,
                plan: doc.data().plan,
                role: doc.data().role || 'user',
                requestsCount: doc.data().requestsCount,
                totalLimit: doc.data().totalLimit,
                createdAt: doc.data().createdAt,
                lastPaymentId: doc.data().lastPaymentId || null
            }));

            const nextCursor = users.length === limit ? snapshot.docs[snapshot.docs.length - 1].id : null;

            return res.status(200).json({
                status: true,
                data: users,
                nextCursor,
                count: users.length
            });
        } catch (error) {
            console.error('Error listing users:', error);
            return res.status(500).json({ status: false, msg: 'Error al listar usuarios.' });
        }
    }
};
