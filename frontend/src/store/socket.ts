import { Socket, io } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (isDev = true): Socket => {
    const wsurl = isDev ? 'ws://localhost:7000' : 'ws://124.221.116.109:7000';
    if (socket == null) socket = io(wsurl);
    return socket;
}
