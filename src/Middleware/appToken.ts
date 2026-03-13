import { Request, Response, NextFunction } from 'express';

export default new class Token {
    public token = (req: Request, res: Response, next: NextFunction) => {
        const tk = req.headers['x-app-token'];
        const ex = process.env.APP_SECRET_TOKEN;
        if (!ex || tk !== ex) return res.status(403).json({ status: false });
        next();
    };
}
