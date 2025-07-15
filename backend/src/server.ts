import cors from "cors";
import express from "express";
import { createServer } from "http";
import cron from "node-cron";
import { Server } from "socket.io";
import { versionChanges } from "../../common/constant/dependancyDict.js";
import { PHASE, PLAYER_STATUS, PlayerStatus } from "../../common/constant/enum.js";
import { AI_ID, PLAYER_COUNT } from "../../common/constant/gameOption.js";
import { cardsTotal } from "../../common/data/cards.js";
import { herosTotal } from "../../common/data/heros.js";
import { summonsTotal } from "../../common/data/summons.js";
import { compareVersion } from '../../common/utils/gameUtil.js';
import { convertToArray, getSecretData, parseDate } from '../../common/utils/utils.js';
import { ActionData, Player } from "../../typing";
import GeniusInvokationRoom from "./geniusInvokationRoom.js";

const app = express();
const origin = [
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://taim.site',
    'https://taim.site',
    'http://gi-tcg.taim.site',
    'https://gi-tcg.taim.site',
    'http://7szh.taim.site',
    'http://localhost:5500',
    'http://localhost:5501',
]
app.use(cors({ origin, methods: ['GET', 'POST'] }));

const isDev = process.env.NODE_ENV == 'development';
const httpServer = createServer(app);
const PORT = 7000;
const io = new Server(httpServer, {
    cors: { origin, methods: ['GET', 'POST'] }
});

process.on('uncaughtException', err => console.error(err));

process.on('exit', code => console.error(code));

const serverSecretKey = await getSecretData('secretKey');
const playerList: ({ id: number, name: string, rid: number, status: PlayerStatus } | Player)[] = []; // 在线玩家列表
const roomList: GeniusInvokationRoom[] = []; // 创建房间列表
const removePlayerList = new Map<number, { time: NodeJS.Timeout, status: PlayerStatus, cancel: () => void }>(); // 玩家即将离线销毁列表
const todayPlayersHistory = new Map<number, {
    name: string,
    duration: number,
    loginTime: number,
    logoutTime: number,
    currLogin: number,
}>(); // 当日玩家登录信息
cron.schedule('0 0 5 * * *', () => todayPlayersHistory.clear());

// 生成id
const genId = <T extends { id: number }[]>(arr: T, option: { len?: number, prefix?: number, isMinus?: boolean } = {}) => {
    const { len = 4, prefix, isMinus } = option;
    let id: number | undefined;
    while (id == undefined || arr.findIndex(v => v.id == id) > -1) {
        id = Math.floor(Math.random() * (prefix ? 1 : 9) * 10 ** (len - 1) + (prefix || 1) * 10 ** (len - 1)) * (isMinus ? -1 : 1);
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
const removePlayer = (player: Player) => {
    const { id: pid, status } = player;
    player.status = PLAYER_STATUS.OFFLINE;
    const time = setTimeout(() => removeById(pid, playerList), 24 * 60 * 60 * 1e3);
    removePlayerList.set(pid, {
        time,
        status,
        cancel: () => {
            clearTimeout(removePlayerList.get(pid)?.time);
            removePlayerList.delete(pid);
            player.status = status;
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
            rlist: roomList.filter(r => r.id > 0).map(r => ({
                id: r.id,
                name: r.name,
                isStart: r.isStart,
                version: r.customVersionConfig ? r.customVersionConfig.name : r.version.value,
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
        const date = new Date();
        const log = `[${date}]:玩家[${me.name}]-pid:${me.id}-rid:${me.rid} ` + ({
            exitRoom: `离开了房间[${me.rid}]...`,
            disconnect: `断开连接了...`,
            close: `关闭了连接...`,
        }[eventName] ?? `未知原因[${eventName}]断开...`);
        console.info(log);
        if (me.rid != -1) {
            const room = getRoom(me.rid);
            if (!room) return console.error(`ERROR@leaveRoom:${eventName}:未找到房间,rid:${me.rid}`);
            if (me.pidx > -1) {
                --room.onlinePlayersCnt;
                if (room.isStart) me.isOffline = true;
            }
            if (!room.isStart || me.pidx == -1) {
                me.rid = -1;
                removeById(pid, room.players, room.watchers);
                if (room.players[0]?.id == AI_ID) --room.onlinePlayersCnt;
                if (me.pidx != -1) room.players.forEach(p => p.phase = PHASE.NOT_READY);
            }
            if (room.onlinePlayersCnt <= 0 || room.players.every(p => p.isOffline) || me.rid < -1) {
                [...room.players, ...room.watchers].forEach(p => p.rid = -1);
                if (room.countdown.timer != null) clearInterval(room.countdown.timer);
                removeById(room.id, roomList);
            } else {
                room.emit('leaveRoom', me.pidx > -1 ? me.pidx : PLAYER_COUNT);
            }
        }
        if (eventName != 'exitRoom') {
            removePlayer(me);
            const info = todayPlayersHistory.get(me.id);
            if (!info) return console.error(`ERROR@leaveRoom:${eventName}:未找到玩家,rid:${me.id}`);
            info.logoutTime = date.getTime();
            info.duration += info.logoutTime - info.currLogin;
        }
        emitPlayerAndRoomList();
    }
    // 登录/改名/重连
    socket.on('login', data => {
        const { id = -1, name = '' } = data;
        if (name == '') return;
        let username = name;
        const player = getPlayer(id);
        const date = new Date();
        if (id > 0 && player) {
            const prevname = player.name;
            const playerInfo = () => `[${date}]:玩家[${prevname}]-pid:${pid}`;
            if (prevname != name) {
                player.name = name;
                console.info(`${playerInfo()} 改名为[${name}]`);
            } else {
                username = prevname;
                const leavePlayer = removePlayerList.get(id);
                if (leavePlayer) {
                    leavePlayer.cancel();
                    pid = id;
                    console.info(`${playerInfo()} 重新连接了...`);
                }
                if (pid == id && player.rid > 0 && getRoomIdx(player.rid) > -1) {
                    console.info(`${playerInfo()} 重新进入房间[${player.rid}]`);
                    socket.emit('continueGame', { roomId: player.rid, isLeave: !!leavePlayer });
                }
            }
        } else {
            pid = genId(playerList);
            console.info(`[${date}]:新玩家[${name}]-pid:${pid} 连接了...`);
            playerList.push({ id: pid, name, rid: -1, status: PLAYER_STATUS.WAITING });
        }
        if (id > 0 && player && pid != id) return console.info(`WARN@login:非法的登录 pid:${pid}, id:${id}`);
        const loginTime = date.getTime();
        if (todayPlayersHistory.has(id)) {
            const info = todayPlayersHistory.get(id)!;
            info.currLogin = loginTime;
        } else {
            todayPlayersHistory.set(pid, { name, duration: 0, loginTime, logoutTime: -1, currLogin: loginTime });
        }
        socket.emit('login', { pid, name: username });
        emitPlayerAndRoomList();
    });
    // 发送玩家和房间列表
    socket.on('getPlayerAndRoomList', emitPlayerAndRoomList);
    // 断开连接
    socket.on('disconnect', () => leaveRoom('disconnect'));
    // 创建房间
    socket.on('createRoom', data => {
        const { roomName, version, roomPassword, countdown, customVersion, allowLookon, isRecord } = data;
        const roomId = genId(roomList, { isMinus: !!isRecord });
        const me = getPlayer(pid) as Player;
        const newRoom = new GeniusInvokationRoom(roomId, roomName, version, roomPassword, countdown, allowLookon, isDev ? 'dev' : 'prod', customVersion, io);
        if (isRecord && isRecord.pidx == 1) newRoom.init({ id: 0, name: isRecord.oppoName });
        const player = newRoom.init(me);
        if (isRecord && isRecord.pidx == 0) newRoom.init({ id: 0, name: isRecord.oppoName });
        playerList[getPlayerIdx(pid)] = player;
        roomList.push(newRoom);
        socket.join(`7szh-${roomId}-p${player.pidx}`);
        emitPlayerAndRoomList();
        socket.emit('enterRoom', {
            roomId,
            players: newRoom.players,
            version: newRoom.version.value,
            countdown: newRoom.countdown.limit,
            customVersion: newRoom.customVersionConfig,
        });
    });
    // 加入房间
    socket.on('enterRoom', data => {
        const { roomId, roomPassword = '', isLeave = true } = data;
        let me = getPlayer(pid)!;
        const room = getRoom(roomId);
        if (!room) return socket.emit('enterRoom', { err: `房间号${roomId}不存在！` });
        const pidx = getById(me.id, room.players)?.pidx ?? -1;
        const isInGame = pidx > -1;
        if (room.password != roomPassword && !isInGame) return socket.emit('enterRoom', { err: '密码错误！' });
        if (me.rid > 0 && me.rid != roomId && getRoom(me.rid)) return socket.emit('enterRoom', { err: `你还有正在进行的游戏！rid:${me.rid}` });
        const isLookon = room.players.length == PLAYER_COUNT && !isInGame;
        if (isInGame) {
            if (isLeave) ++room.onlinePlayersCnt;
            room.players[pidx].isOffline = false;
            setTimeout(() => room.emit('continueGame', (me as Player).pidx), 500);
        } else {
            if (isLookon && !room.allowLookon) return socket.emit('enterRoom', { err: '该房间不允许观战！' });
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
            players: room.players,
            version: room.version.value,
            countdown: room.countdown.limit,
            customVersion: room.customVersionConfig,
        });
    });
    // 退出房间
    socket.on('exitRoom', () => leaveRoom('exitRoom'));
    // 发送日志
    socket.on('sendLog', data => {
        const room = getRoom(data.roomId);
        if (!room) return console.error(`ERROR@roomInfoUpdate:未找到房间`);
        const me = getPlayer(pid);
        if (!me) return console.error(`ERROR@sendToServer:未找到玩家-pid:${pid}`);
        room.setReporterLog(me.name, data.description);
        room.exportLog();
    });
    // 房间信息更新
    socket.on('roomInfoUpdate', data => {
        const { roomId, pidx } = data;
        const room = getRoom(roomId);
        if (!room) return console.error(`ERROR@roomInfoUpdate:未找到房间`);
        room.emit('roomInfoUpdate', pidx ?? getById(pid, room.players)?.pidx, { socket });
    });
    // 更新socket监听的房间
    socket.on('updateSocketRoom', () => {
        const me = getPlayer(pid);
        if (!me) return console.error(`ERROR@sendToServer:未找到玩家-pid:${pid}`);
        socket.leave(`7szh-${me.rid}-p${(me as Player).pidx}`);
        const room = getRoom(me.rid);
        if (!room) return console.error(`ERROR@roomInfoUpdate:未找到房间`);
        socket.join(`7szh-${me.rid}-p${getIdxById(pid, room.players)}`);
    });
    // 发送数据到服务器
    socket.on('sendToServer', async (actionData: ActionData) => {
        const me = getPlayer(pid);
        if (!me) return console.error(`ERROR@sendToServer:未找到玩家-pid:${pid}`);
        const room = getRoom(me.rid);
        if (!room) return console.error(`ERROR@sendToServer:未找到房间-rid:${me.rid}`);
        let isStart = room.isStart;
        try {
            room.getAction(actionData, (me as Player)?.pidx, socket);
        } catch (e) {
            const error: Error = e as Error;
            console.error(error);
            room.emitError(error);
        }
        if (isStart != room.isStart) emitPlayerAndRoomList();
    });
    // 发送数据到服务器(开发用)
    socket.on('sendToServerDev', actionData => {
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
    // socket.on('sendHeartBreak', () => {
    //     const me = getPlayer(pid);
    //     if (!me) return console.error(`ERROR@sendToServerDev:未找到玩家-pid:${pid}`);
    //     const room = getRoom(me.rid);
    //     if (!room) return console.error(`ERROR@sendToServer:未找到房间-rid:${me.rid}`);
    //     room.resetHeartBreak((me as Player).pidx);
    // });
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
        removeById(AI_ID, room.players);
        room.emit('removeAI', 0);
        emitPlayerAndRoomList();
    });


});


const validateSK = (req, res) => {
    if (serverSecretKey == 'wrong') {
        console.info(`获取serverSecretKey失败`);
        return false;
    }
    if (!isDev && req.headers.flag != serverSecretKey) {
        console.info(`[${new Date()}]请求失败\nurl:${JSON.stringify(req.url)}, headers:${JSON.stringify(req.headers)}`);
        res.status(403).json({ err: '非法请求！' });
        return false;
    }
    return true;
};

app.get('/test', (_, res) => res.json({ ok: true }));

app.get('/detail', (req, res) => {
    if (!validateSK(req, res)) return res.json({ err: '非法请求！' });
    res.json({
        roomList: roomList.map(r => ({
            id: r.id,
            name: r.name,
            isStart: r.isStart,
            detail: r.string,
            preview: JSON.stringify(r.previews),
        })),
        playerList: playerList.map(p => ({
            id: p.id,
            name: p.name,
            rid: p.rid,
            status: p.status,
        })),
    });
});

app.get('/info', (req, res) => {
    if (!validateSK(req, res)) return res.json({ err: '非法请求！' });
    res.json({
        roomsInfo: roomList.map(r => `${r.players[0]?.name ?? '[空位]'} vs ${r.players[1]?.name ?? '[空位]'}`),
        playersInfo: playerList.map(p => `${p.name}[${p.status == 3 ? '下线' : p.rid < 0 ? '空闲' : roomList.find(r => r.id == p.rid)?.isStart ? '游戏中' : '房间中'}]`),
        todayPlayersHistory: Array.from(todayPlayersHistory.entries())
            .map(([id, { name, duration, loginTime, logoutTime }]) => ({
                id,
                name,
                duration: (duration / 1000 / 60).toFixed(2),
                loginTime: parseDate(loginTime).time,
                logoutTime: parseDate(logoutTime).time,
            })),
    });
});

app.get('/versions', (req, res) => {
    const result = {};
    (convertToArray(req.query.query) as string[]).forEach(query => {
        const entity = [...herosTotal(undefined, true), ...cardsTotal(undefined, true), ...summonsTotal()].find(e => {
            return e.id.toString() == query || e.name.includes(query);
        });
        if (!entity) return;
        result[entity.name] = [...entity.UI.versionChanges, ...versionChanges[entity.id]].sort((a, b) => compareVersion(a, b));
    });
    res.json(result);
});

httpServer.listen(PORT, () => console.info(`服务器已在${process.env.NODE_ENV ?? 'production'}端口${PORT}启动......`));
