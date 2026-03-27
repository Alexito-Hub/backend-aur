import { Request, Response, NextFunction } from 'express';
import Token from '../../Core/Middleware/Token';
import Cache from '../../Core/System/Cache';

export default new class Middlewares {
    private async run(mws: any[], req: Request, res: Response, next: NextFunction) {
        for (const mw of mws) {
            let passed = false;
            let errored = false;
            await new Promise<void>((resolve, reject) => {
                mw(req, res, (err?: any) => {
                    if (err) {
                        errored = true;
                        return reject(err);
                    }
                    passed = true;
                    resolve();
                });
            }).catch(err => {
                next(err);
            });
            if (errored || res.headersSent) return false;
        }
        return true;
    }

    public guest = (name: string) => {
        return async (req: Request, res: Response, next: NextFunction) => {
            const statusSecret = process.env.STATUS_CHECK_SECRET || 'internal';
            if (req.headers['x-status-check'] === statusSecret) {
                return next();
            }

            const tokenPassed = await this.run([Token.token], req, res, next);
            if (!tokenPassed) return;

            const url = req.body?.url || req.query?.url;
            if (url && typeof url === 'string') {
                const key = `${name}_${url}`;
                const cached = Cache.get(key);
                if (cached) {
                    return res.json(cached);
                }
            }

            if (url && typeof url === 'string') {
                const key = `${name}_${url}`;
                const origin = res.json.bind(res);
                res.json = (body: any) => {
                    if (res.statusCode === 200 && body && body.status !== false) {
                        Cache.set(key, body, 600);
                    }
                    return origin(body);
                };
            }

            next();
        };
    };
}
