import { Request, Response, NextFunction } from 'express';
import admin from '../Config/firebase';

export default new class FirebaseAuth {
    /**
     * Validates the Firebase ID token for authenticated routes.
     */
    public auth = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: false,
                msg: 'No autorizado: Token de Firebase ausente.'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            // Inject user info into the request object
            (req as any).user = decodedToken;
            next();
        } catch (error) {
            console.error('Error verifying Firebase token:', error);
            return res.status(401).json({
                status: false,
                msg: 'No autorizado: Token de Firebase inválido o expirado.'
            });
        }
    };

    /**
     * Middleware to strictly verify administrative privileges.
     */
    public admin = async (req: Request, res: Response, next: NextFunction) => {
        // First ensure user is authenticated via the .auth middleware
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ status: false, msg: 'Acceso denegado.' });
        }

        // TODO: En el futuro, puedes usar Custom Claims de Firebase o una lista en DB.
        // Por ahora validamos por correos autorizados por ti en la consola.
        const isAdmin = user.email_verified === true; // Placeholder logic: Only verified emails can access admin

        if (!isAdmin) {
            return res.status(403).json({
                status: false,
                msg: 'No autorizado: Se requieren privilegios de administrador.'
            });
        }

        next();
    };
}
