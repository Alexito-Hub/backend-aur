import { Request, Response, NextFunction } from 'express';

export default new class Bot {
    private readonly bots = ['curl', 'wget', 'python', 'go-http', 'java', 'scrapy', 'httpx', 'libwww', 'okhttp', 'headless'];
    public detect = (req: Request, res: Response, next: NextFunction) => {
        const ua = (req.headers['user-agent'] || '').toLowerCase();
        if (this.bots.some(b => ua.includes(b)) || ua.includes('headless') || (ua.length < 10 && !ua.includes('mozilla'))) return res.status(403).json({ status: false });
        if (req.body && (req.body.website || req.body.email_confirm || req.body.honeypot)) return res.json({ status: true });
        next();
    };
}
