import { Request, Response, NextFunction } from 'express';
import admin from '../Config/firebase';

const db = admin.firestore();

export default new class AdminCheck {
    /**
     * Verifies that the authenticated user has the admin role in Firestore.
     * Must be used AFTER firebaseAuth.ts injects req.user.
     */
    public check = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            if (!user || !user.uid) {
                return res.status(401).json({
                    status: false,
                    msg: 'No autorizado: Sin usuario autenticado.'
                });
            }

            const userDoc = await db.collection('users').doc(user.uid).get();

            if (!userDoc.exists) {
                return res.status(403).json({
                    status: false,
                    msg: 'Acceso denegado: Perfil de usuario no encontrado.'
                });
            }

            const role = userDoc.data()?.role;
            if (role !== 'admin') {
                return res.status(403).json({
                    status: false,
                    msg: 'Acceso denegado: Se requieren privilegios de administrador.'
                });
            }

            next();
        } catch (error) {
            console.error('Error verifying admin role:', error);
            return res.status(500).json({
                status: false,
                msg: 'Error interno al verificar permisos de administrador.'
            });
        }
    };
}
