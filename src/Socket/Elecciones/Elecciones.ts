import { Server, Socket } from "socket.io";
import Service from "../../Modules/Elecciones/Service";

let _io: Server | null = null;
let _online = 0;

export default {
    name: "Elecciones",

    init(io: Server) {
        _io = io;
    },

    async execution(socket: Socket) {
        _online++;
        this.emitOnline();

        // Enviar estado actual al cliente que se conecta
        try {
            const res = await Service.res();
            socket.emit("estado", res);
        } catch (e) {}

        // Cliente pide resultados manualmente
        socket.on("get_initial_results", async () => {
            try {
                const res = await Service.res();
                socket.emit("estado", res);
            } catch (e) {}
        });

        socket.on("disconnect", () => {
            _online = Math.max(0, _online - 1);
            this.emitOnline();
        });
    },

    emitOnline() {
        _io?.emit("presencia", { online: _online });
    },

    async update() {
        if (!_io) return;
        try {
            const rs = await Service.res();
            _io.emit("actualizacion", rs);
            this.emitOnline();
        } catch (e) {}
    }
};