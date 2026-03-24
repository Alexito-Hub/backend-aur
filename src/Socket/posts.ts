import { Server, Socket } from "socket.io";
import logger from "../Core/Logger/Log";

let _io: Server | null = null;

export default {
    name: "posts",
    description: "Real-time posts updates handler",
    events: ["subscribe_posts", "unsubscribe_posts"],
    file: "posts.ts",

    init(io: Server) {
        _io = io;
    },

    execution(socket: Socket) {
        socket.on("subscribe_posts", () => {
            socket.join("posts_feed");
            socket.emit("subscribed_posts", {
                message: "Suscrito a actualizaciones de posts"
            });
            logger.debug({ socketId: socket.id }, "Cliente suscrito a posts");
        });

        socket.on("unsubscribe_posts", () => {
            socket.leave("posts_feed");
            logger.debug({ socketId: socket.id }, "Cliente desuscrito de posts");
        });
    },

    emitNewPost(postData: any) {
        if (!_io) return;
        _io.to("posts_feed").emit("new_post", {
            action:    "create",
            post:      postData,
            timestamp: Date.now()
        });
        logger.info({ postId: postData._id }, "Nuevo post emitido a suscriptores");
    },

    emitUpdatePost(postData: any) {
        if (!_io) return;
        _io.to("posts_feed").emit("update_post", {
            action:    "update",
            post:      postData,
            timestamp: Date.now()
        });
        logger.info({ postId: postData._id }, "Post actualizado emitido a suscriptores");
    },

    emitDeletePost(postId: string) {
        if (!_io) return;
        _io.to("posts_feed").emit("delete_post", {
            action:    "delete",
            postId,
            timestamp: Date.now()
        });
        logger.info({ postId }, "Post eliminado emitido a suscriptores");
    },

    emitLikeUpdate(postId: string, likesCount: number, userId: string, isLiked: boolean) {
        if (!_io) return;
        _io.to("posts_feed").emit("post_like_update", {
            action:     isLiked ? "like" : "unlike",
            postId,
            likesCount,
            userId,
            timestamp:  Date.now()
        });
        logger.debug({ postId, likesCount }, "Like actualizado emitido");
    },

    emitFavoriteUpdate(postId: string, favoritesCount: number, userId: string, isFavorited: boolean) {
        if (!_io) return;
        _io.to("posts_feed").emit("post_favorite_update", {
            action:         isFavorited ? "favorite" : "unfavorite",
            postId,
            favoritesCount,
            userId,
            timestamp:      Date.now()
        });
        logger.debug({ postId, favoritesCount }, "Favorito actualizado emitido");
    }
};