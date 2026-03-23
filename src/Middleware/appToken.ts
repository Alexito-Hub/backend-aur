import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export default new class Token {
    public token = (req: Request, res: Response, next: NextFunction) => {
        const tk = req.headers['x-app-token'];
        const ex = process.env.APP_SECRET_TOKEN;
        if (!ex || !tk || typeof tk !== 'string') return res.status(403).json({ status: false });
        // Length check prevents timingSafeEqual from throwing on different-length buffers
        if (tk.length !== ex.length) return res.status(403).json({ status: false });
        const match = crypto.timingSafeEqual(Buffer.from(tk), Buffer.from(ex));
        if (!match) return res.status(403).json({ status: false });
        next();
    };
}
