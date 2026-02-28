import type { Request, Response } from 'express';
import admin from '../../../Config/firebase';
import Middlewares from '../middlewares';

const db = admin.firestore();

const GET_HISTORY: any = {
    name: 'Get Download History',
    path: '/auth/history',
    method: 'get',
    category: 'auth',
    premium: false,
    error: false,
    logger: false,
    validator: Middlewares.member,
    execution: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
            const cursor = req.query.cursor as string | undefined;

            let query = db.collection('history')
                .where('userId', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (cursor) {
                const cursorDoc = await db.collection('history').doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            const snapshot = await query.get();
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const nextCursor = items.length === limit ? snapshot.docs[snapshot.docs.length - 1].id : null;

            return res.status(200).json({
                status: true,
                data: items,
                nextCursor,
                count: items.length
            });
        } catch (error) {
            console.error('Error fetching history:', error);
            return res.status(500).json({ status: false, msg: 'Error al obtener el historial.' });
        }
    }
};

const POST_HISTORY: any = {
    name: 'Add Download to History',
    path: '/auth/history',
    method: 'post',
    category: 'auth',
    premium: false,
    error: false,
    logger: false,
    requires: (req: Request, res: Response, next: Function) => {
        const { fileName, filePath, platform, type } = req.body;
        if (!fileName || !filePath || !platform || !type) {
            return res.status(400).json({ status: false, msg: 'Faltan campos requeridos: fileName, filePath, platform, type.' });
        }
        next();
    },
    validator: Middlewares.member,
    execution: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const { fileName, filePath, platform, type, sourceUrl, contentId, fileSize } = req.body;

            const historyRef = db.collection('history').doc();
            await historyRef.set({
                userId: user.uid,
                fileName,
                filePath,
                platform,
                type,
                sourceUrl: sourceUrl || null,
                contentId: contentId || null,
                fileSize: fileSize || 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.status(200).json({ status: true, id: historyRef.id });
        } catch (error) {
            console.error('Error adding history entry:', error);
            return res.status(500).json({ status: false, msg: 'Error al guardar en historial.' });
        }
    }
};

const DELETE_HISTORY: any = {
    name: 'Delete History Item',
    path: '/auth/history/:id',
    method: 'delete',
    category: 'auth',
    premium: false,
    error: false,
    logger: false,
    validator: Middlewares.member,
    execution: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const { id } = req.params;

            const docRef = db.collection('history').doc(id);
            const doc = await docRef.get();

            if (!doc.exists) {
                return res.status(404).json({ status: false, msg: 'Entrada de historial no encontrada.' });
            }

            if (doc.data()?.userId !== user.uid) {
                return res.status(403).json({ status: false, msg: 'Sin acceso para eliminar esta entrada.' });
            }

            await docRef.delete();
            return res.status(200).json({ status: true, msg: 'Entrada eliminada.' });
        } catch (error) {
            console.error('Error deleting history entry:', error);
            return res.status(500).json({ status: false, msg: 'Error al eliminar entrada del historial.' });
        }
    }
};

// Export all three as named exports so the dynamic loader picks them up
export { GET_HISTORY as default, POST_HISTORY, DELETE_HISTORY };
