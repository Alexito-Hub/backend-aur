import { Request, Response, NextFunction } from 'express';
import AppToken from '../../Middleware/appToken';
import Cache from '../../Utils/System/cache';

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
            // 1) Always validate the app token first
            const tokenPassed = await this.run([AppToken.token], req, res, next);
            if (!tokenPassed) return;

            // 2) Check cache BEFORE incrementing the usage counter so cached
            //    responses don't consume quota
            const url = req.body?.url || req.query?.url;
            if (url && typeof url === 'string') {
                const key = `${name}_${url}`;
                const cached = Cache.get(key);
                if (cached) {
                    return res.json(cached);
                }
            }

            // 3) No cache hit -> proceed without limits

            // 4) Wrap res.json to populate the cache on success
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
