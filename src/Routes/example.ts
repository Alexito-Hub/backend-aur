import type { Request, Response } from 'express';

export default {
    name: 'Example Route',
    path: '/example',
    method: 'get',
    category: 'core',
    enabled: true,
    description: 'A simple example route that returns Hello World.',
    
    execution: async (req: Request, res: Response) => {
        return res.status(200).json({
            status: true,
            msg: 'Hello World from Base Branch!',
            timestamp: new Date().toISOString()
        });
    }
};
