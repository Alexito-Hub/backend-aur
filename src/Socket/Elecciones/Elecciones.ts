import { Server, Socket } from "socket.io";
import Srv from "../../Utils/Elecciones/Elecciones";

let io: Server | null = null;
let n = 0;

export default {
    name: "Elecciones",
    async execution(socket: Socket) {
        if (!io && (socket as any).server) io = (socket as any).server;
        n++;
        this.online();
        try {
            const res = await Srv.res();
            socket.emit("estado", res);
        } catch (e) {}
        socket.on("get_initial_results", async () => {
            const res = await Srv.res();
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
            const rs = await Srv.res();
            io.emit("actualizacion", rs);
            this.online();
        } catch (e) {}
    }
};
