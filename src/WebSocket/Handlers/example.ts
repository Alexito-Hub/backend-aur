import { WebSocket } from 'ws';
import logger from '../../Core/Logger/Log';

export default {
    name: 'example_ws',
    enabled: true,
    description: 'An example pure websocket connection that echoes messages',

    execution: (ws: WebSocket, req: any) => {
        logger.info('New incoming WS example connection');
        
        ws.on('message', (message: string) => {
            logger.info({ msg: message.toString() }, 'Received WS message');
            ws.send(`Echo base branch: ${message}`);
        });

        ws.on('close', () => {
             logger.info('WS closed');
        });
    }
};
