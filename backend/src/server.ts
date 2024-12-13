import cors from 'cors';
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { AI_ID } from "../../common/constant/gameOption.js";
import { ActionData, Player } from "../../typing";
import GeniusInvokationRoom from "./geniusInvokationRoom.js";

const app = express();
app.use(cors({
    origin: [
        'http://127.0.0.1:5500',
        'http://taim.site',
        'http://gi-tcg.taim.site',
        'http://7szh.taim.site',
        'http://localhost:5500',
    ],
    methods: ['GET', 'POST']
}));

const httpServer = createServer(app);
const PORT = 7000;
const io = new Server(httpServer, {
    // @ts-ignore
    cors: {
        origin: [
            'http://127.0.0.1:5500',
            'http://taim.site',
            'http://gi-tcg.taim.site',
            'http://7szh.taim.site',
            'http://localhost:5500',
        ],
        methods: ['GET', 'POST']
    }
});

process.on('uncaughtException', err => console.error(err));

process.on('exit', code => console.error(code));

const isDev = process.env.NODE_ENV == 'development';
const playerList: ({ id: number, name: string, rid: number } | Player)[] = []; // 在线玩家列表
const roomList: GeniusInvokationRoom[] = []; // 创建房间列表
const removePlayerList = new Map<number, { time: NodeJS.Timeout, cancel: () => void }>(); // 玩家即将离线销毁列表

// 生成id
const genId = <T extends { id: number }[]>(arr: T, option: { len?: number, prefix?: number } = {}) => {
    const { len = 4, prefix } = option;
    let id: number | undefined;
    while (id == undefined || arr.findIndex(v => v.id == id) > -1) {
        id = Math.floor(Math.random() * (prefix ? 1 : 9) * 10 ** (len - 1) + (prefix || 1) * 10 ** (len - 1));
    }
    return id;
}
// 按id获取
const getById = <T extends { id: number }>(id: number, list: T[]) => list.find(v => v.id == id) as T | undefined;
// 按id获取idx
const getIdxById = <T extends { id: number }>(id: number, list: T[]) => list.findIndex(v => v.id == id);
// 按id去除
const removeById = <T extends { id: number }[]>(id: number, ...lists: T[]) => {
    lists.forEach(list => {
        const idx = getIdxById(id, list);
        if (idx == -1) return;
        list.splice(idx, 1);
    });
}

// 获取玩家信息
const getPlayer = (pid: number) => getById(pid, playerList);
// 获取玩家索引
const getPlayerIdx = (pid: number) => getIdxById(pid, playerList);
// 获取房间信息
const getRoom = (rid: number) => getById(rid, roomList);
// 获取房间索引
const getRoomIdx = (rid: number) => getIdxById(rid, roomList);
// 玩家离线销毁
const removePlayer = (pid: number) => {
    const time = setTimeout(() => {
        removeById(pid, playerList);
    }, 30 * 60 * 1e3);
    removePlayerList.set(pid, {
        time,
        cancel: () => {
            clearTimeout(removePlayerList.get(pid)?.time);
            removePlayerList.delete(pid);
        }
    });
}

io.on('connection', socket => {
    let pid = -1;
    // 发送玩家和房间列表
    const emitPlayerAndRoomList = () => {
        io.emit('getPlayerAndRoomList', {
            plist: playerList.map(p => ({
                id: p.id,
                name: p.name,
                rid: p.rid ?? -1,
            })).filter(p => !removePlayerList.has(p.id)),
            rlist: roomList.map(r => ({
                id: r.id,
                name: r.name,
                isStart: r.isStart,
                version: r.version.value,
                playerCnt: r.players.length,
                hasPassWord: r.password != '',
            })),
        });
    }
    // 离开房间
    const leaveRoom = (eventName: string, player?: Player) => {
        if (player) pid = player.id;
        if (pid == -1) return;
        const me = player ?? getPlayer(pid) as Player;
        if (!me) return console.error(`ERROR@leaveRoom:${eventName}:未找到玩家,me:${JSON.stringify(me)}`);
        const log = `[${new Date()}]:玩家[${me.name}]-pid:${me.id} ` + ({
            exitRoom: `离开了房间[${me.rid}]...`,
            disconnect: `断开连接了...`,
            close: `关闭了连接...`,
        }[eventName] ?? `未知原因[${eventName}]断开...`);
        console.info(log);
        if (me.rid > 0) {
            socket.leave(`7szh-${me.rid}`);
            const room = getRoom(me.rid);
            if (!room) return console.error(`ERROR@leaveRoom:${eventName}:未找到房间,rid:${me.rid}`);
            const pidx = getIdxById(me.id, room.players);
            if (pidx > -1) {
                if (me.pidx < 2) --room.onlinePlayersCnt;
                if (room.isStart) me.isOffline = true;
                if (room.players?.[1]?.id == AI_ID) --room.onlinePlayersCnt;
            }
            if (!room.isStart || pidx == -1 || me.pidx > 1) {
                me.rid = -1;
                removeById(pid, room.players, room.watchers);
            }
            if (room.onlinePlayersCnt <= 0 || room.players.every(p => p.isOffline)) {
                room.players.forEach(p => p.rid = -1);
                if (room.countdown.timer != null) clearInterval(room.countdown.timer);
                removeById(room.id, roomList);
            } else {
                room.emit('leaveRoom', pidx);
            }
        }
        if (eventName == 'disconnect') removePlayer(me.id);
        emitPlayerAndRoomList();
    }
    // 登录/改名/重连
    socket.on('login', data => {
        const { id = -1, name = '' } = data;
        let username = name;
        pid = id;
        const player = getPlayer(id);
        if (id > 0 && player) {
            const prevname = player.name;
            if (name != '' && prevname != name) {
                player.name = name;
                console.info(`[${new Date()}]:玩家[${prevname}]-pid${pid} 改名为[${name}]`);
            } else {
                username = prevname;
                console.info(`[${new Date()}]:玩家[${prevname}]-pid${pid} 重新连接了...`);
                removePlayerList.get(id)?.cancel();
                if (player.rid > 0 && getRoomIdx(player.rid) > -1) {
                    console.info(`[${new Date()}]:玩家[${prevname}]-pid${pid} 重新进入房间[${player.rid}]`);
                    socket.emit('continueGame', { roomId: player.rid });
                }
            }
        } else {
            console.info(`[${new Date()}]:新玩家[${name}]-pid${pid} 连接了...`);
            pid = genId(playerList);
            playerList.push({ id: pid, name, rid: -1 });
        }
        socket.emit('login', { pid, name: username });
        emitPlayerAndRoomList();
    });
    // 发送玩家和房间列表
    socket.on('getPlayerAndRoomList', emitPlayerAndRoomList);
    // 断开连接
    socket.on('disconnect', () => leaveRoom('disconnect'));
    socket.on('close', () => leaveRoom('close'));
    // 创建房间
    socket.on('createRoom', data => {
        const { roomName, version, roomPassword, countdown } = data;
        const roomId = genId(roomList);
        const me = getPlayer(pid) as Player;
        const newRoom = new GeniusInvokationRoom(io, roomId, roomName, version, roomPassword, leaveRoom, countdown, isDev);
        const player = newRoom.init(me);
        playerList[getPlayerIdx(pid)] = player;
        roomList.push(newRoom);
        socket.join(`7szh-${roomId}-p${player.pidx}`);
        emitPlayerAndRoomList();
        socket.emit('enterRoom', {
            roomId,
            players: newRoom.players.map(p => p.id == me.id ? p : ({ ...p, id: -2 })),
            version: newRoom.version.value,
            countdown: newRoom.countdown.limit,
        });
    });
    // 加入房间
    socket.on('enterRoom', data => {
        const { roomId, roomPassword = '' } = data;
        let me = getPlayer(pid)!;
        const room = getRoom(roomId);
        if (!room) return socket.emit('enterRoom', { err: `房间号${roomId}不存在！` });
        const pidx = getIdxById(me.id, room.players);
        const isInGame = pidx > -1;
        if (room.password != roomPassword && !isInGame) return socket.emit('enterRoom', { err: '密码错误！' });
        if (me.rid > 0 && me.rid != roomId) return socket.emit('enterRoom', { err: `你还有正在进行的游戏！rid:${me.rid}` });
        const isLookon = room.players.length >= 2 && !isInGame;
        if (room.isStart && isInGame) {
            ++room.onlinePlayersCnt;
            room.players[pidx].isOffline = false;
            setTimeout(() => room.emit('continueGame', (me as Player).pidx, { socket }), 500);
        } else {
            me = room.init(me);
            playerList[getPlayerIdx(pid)] = me;
        }
        if (isLookon) {
            socket.join(`7szh-${roomId}`);
        } else {
            socket.join(`7szh-${roomId}-p${(me as Player).pidx}`);
        }
        emitPlayerAndRoomList();
        socket.emit('enterRoom', {
            roomId,
            isLookon,
            players: room.players.map(p => p.id == me.id ? p : ({ ...p, id: -2 })),
            version: room.version.value,
            countdown: room.countdown.limit,
        });
    });
    // 退出房间
    socket.on('exitRoom', () => leaveRoom('exitRoom'));
    // 发送日志
    socket.on('sendLog', data => {
        const room = getRoom(data.roomId);
        const me = getPlayer(pid);
        room?.exportLog(`>>>由[${me?.name}]发送`);
    });
    // 房间信息更新
    socket.on('roomInfoUpdate', data => {
        const room = getRoom(data.roomId);
        if (!room) return console.error(`ERROR@roomInfoUpdate:未找到房间`);
        room.emit('roomInfoUpdate', data.pidx || 0);
    });
    // 发送数据到服务器
    socket.on('sendToServer', async (actionData: ActionData) => {
        const me = getPlayer(pid);
        if (!me) return console.error(`ERROR@sendToServer:未找到玩家-pid:${pid}`);
        const room = getRoom(me.rid);
        if (!room) return console.error(`ERROR@sendToServer:未找到房间-rid:${me.rid}`);
        let isStart = room.isStart;
        try {
            room.getAction(actionData, socket, (me as Player)?.pidx);
        } catch (e) {
            const error: Error = e as Error;
            console.error(error);
            room.exportLog(error.stack);
        }
        if (isStart != room.isStart) emitPlayerAndRoomList();
    });
    // 发送数据到服务器(开发用)
    socket.on('sendToServerDev', (actionData) => {
        const me = getPlayer(pid);
        if (pid == -1) console.warn(`pidx未找到`);
        if (!me) return console.error(`ERROR@sendToServerDev:未找到玩家-pid:${pid}`);
        const room = getRoom(isDev ? me.rid : actionData.rid);
        if (!room) return console.error(`ERROR@sendToServer:未找到房间-rid:${me.rid}`);
        let isStart = room.isStart;
        room.getActionDev(actionData);
        if (isStart != room.isStart) emitPlayerAndRoomList();
    });
    // 接收心跳
    socket.on('sendHeartBreak', () => {
        const me = getPlayer(pid);
        if (!me) return console.error(`ERROR@sendToServerDev:未找到玩家-pid:${pid}`);
        const room = getRoom(me.rid);
        if (!room) return console.error(`ERROR@sendToServer:未找到房间-rid:${me.rid}`);
        room.resetHeartBreak((me as Player).pidx);
    });
    // 添加AI
    socket.on('addAI', () => {
        const me = getPlayer(pid)!;
        const room = getRoom(me.rid)!;
        room.init({ id: AI_ID, name: '机器人' });
        emitPlayerAndRoomList();
    });
    // 移除AI
    socket.on('removeAI', () => {
        const me = getPlayer(pid)!;
        const room = getRoom(me.rid)!;
        removeById(1, room.players);
        room.emit('removeAI', 0);
        emitPlayerAndRoomList();
    });


});

httpServer.listen(PORT, () => console.info(`服务器已在${process.env.NODE_ENV ?? 'production'}端口${PORT}启动......`));
