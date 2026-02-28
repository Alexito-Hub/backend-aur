import type { Request, Response } from 'express';
import admin from '../../../Config/firebase';
import Middlewares from '../middlewares';

const db = admin.firestore();

export default {
    name: 'Get Platform Stats (Admin)',
    path: '/admin/stats',
    method: 'get',
    category: 'admin',
    premium: false,
    error: false,
    logger: false,
    validator: Middlewares.admin,
    execution: async (req: Request, res: Response) => {
        try {
            // Run all aggregation queries in parallel for speed
            const [usersSnap, paymentsSnap, unauthSnap] = await Promise.all([
                db.collection('users').get(),
                db.collection('payments').where('status', '==', 'approved').get(),
                db.collection('unauth_usage').get()
            ]);

            const users = usersSnap.docs.map(d => d.data());
            const payments = paymentsSnap.docs.map(d => d.data());

            // Plan breakdown
            const planCounts: Record<string, number> = {};
            let totalRequests = 0;
            for (const u of users) {
                const plan = u.plan || 'free';
                planCounts[plan] = (planCounts[plan] || 0) + 1;
                totalRequests += u.requestsCount || 0;
            }

            // Revenue
            const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

            // Today's payments
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const paymentsToday = payments.filter(p => {
                if (!p.timestamp) return false;
                return new Date(p.timestamp) >= today;
            }).length;

            return res.status(200).json({
                status: true,
                data: {
                    totalUsers: users.length,
                    planBreakdown: planCounts,
                    totalRequests,
                    anonymousTracked: unauthSnap.size,
                    payments: {
                        total: payments.length,
                        today: paymentsToday,
                        totalRevenueMXN: totalRevenue
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching admin stats:', error);
            return res.status(500).json({ status: false, msg: 'Error al obtener estadísticas.' });
        }
    }
};
