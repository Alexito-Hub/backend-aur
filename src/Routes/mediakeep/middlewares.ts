import { Request, Response, NextFunction } from 'express';
import AppToken from '../../Middleware/appToken';
import FirebaseAuth from '../../Middleware/firebaseAuth';
import UsageLimit from '../../Middleware/usageLimit';
import AdminCheck from '../../Middleware/adminCheck';
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
            const passed = await this.run([AppToken.token, UsageLimit.user, UsageLimit.limit], req, res, next);
            if (!passed) return;

            const url = req.body?.url || req.query?.url;
            if (url && typeof url === 'string') {
                const key = `${name}_${url}`;
                const cached = Cache.get(key);
                if (cached) {
                    return res.json(cached);
                }

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

    public member = async (req: Request, res: Response, next: NextFunction) => {
        const passed = await this.run([AppToken.token, FirebaseAuth.auth, UsageLimit.limit], req, res, next);
        if (passed) next();
    };

    public pay = async (req: Request, res: Response, next: NextFunction) => {
        const passed = await this.run([AppToken.token, FirebaseAuth.auth], req, res, next);
        if (passed) next();
    };

    /**
     * Admin stack: AppToken → FirebaseAuth → AdminCheck
     * Use for routes that require administrative privileges.
     */
    public admin = async (req: Request, res: Response, next: NextFunction) => {
        const passed = await this.run([AppToken.token, FirebaseAuth.auth, AdminCheck.check], req, res, next);
        if (passed) next();
    };
}
