import { Socket } from "socket.io";
import logger from "../Core/Logger/Log";

export default {
    name: "example_ping",
    description: "Example ping pong connection test",
    events: ["ping"],
    enabled: true,
    file: "example.ts",
    
    execution(socket: Socket) {
        socket.on("ping", () => {
            logger.info({ socketId: socket.id }, "ping received in example socket");
            socket.emit("pong", {
                timestamp: Date.now(),
                message: "pong from base branch"
            });
        });
    }
};
