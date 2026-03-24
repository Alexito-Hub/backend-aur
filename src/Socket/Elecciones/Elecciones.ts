import { Server, Socket } from "socket.io";
import Service from "../../Modules/Elecciones/Service";

let io: Server | null = null;
let n = 0;

export default {
    name: "Elecciones",
    async execution(socket: Socket) {
        if (!io && (socket as any).server) io = (socket as any).server;
        n++;
        this.online();
        try {
            const res = await Service.res();
            socket.emit("estado", res);
        } catch (e) {}
        socket.on("get_initial_results", async () => {
            const res = await Service.res();
            socket.emit("estado", res);
        });
        socket.on("disconnect", () => {
            n = Math.max(0, n - 1);
            this.online();
        });
    },
    online() {
        if (io) io.emit("presencia", { online: n });
    },
    async update() {
        if (!io) return;
        try {
            const rs = await Service.res();
            io.emit("actualizacion", rs);
            this.online();
        } catch (e) {}
    }
};
