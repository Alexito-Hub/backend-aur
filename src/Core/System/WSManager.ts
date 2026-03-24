import { WebSocket } from 'ws';

/**
 * Gestor de salas nativo para WebSockets puros.
 * Proporciona capacidades de "join", "leave" y "broadcast" similares a Socket.io.
 */
export default new class WSManager {
    private rooms: Map<string, Set<WebSocket>> = new Map();

    /**
     * Une un cliente a una sala.
     */
    public join(room: string, socket: WebSocket): void {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room)!.add(socket);
    }

    /**
     * Saca a un cliente de una sala.
     */
    public leave(room: string, socket: WebSocket): void {
        const clients = this.rooms.get(room);
        if (clients) {
            clients.delete(socket);
            if (clients.size === 0) this.rooms.delete(room);
        }
    }

    /**
     * Emite un mensaje JSON a todos los miembros de una sala.
     */
    public to(room: string, data: any): void {
        const clients = this.rooms.get(room);
        if (clients) {
            const message = JSON.stringify(data);
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    }

    /**
     * Limpia un socket de todas las salas (al desconectarse).
     */
    public remove(socket: WebSocket): void {
        this.rooms.forEach((clients) => clients.delete(socket));
    }
}
