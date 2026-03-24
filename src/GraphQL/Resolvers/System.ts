import Config from '../../Core/System/Config';

export default {
    Query: {
        collection: () => ({
            webserver: {
                url: process.env.WEBSERVER_URL || 'http://localhost',
                port: process.env.PORT || '3000',
                protocol: 'http',
                name: 'Auralix API',
                version: '1.0.0',
                description: 'Auralix Backend API',
                author: 'Auralix',
                license: 'MIT'
            },
            settings: {
                maintenance: false,
                logger: 'pino'
            },
            users: []
        })
    }
};
