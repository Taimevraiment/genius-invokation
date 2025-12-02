<template>
  <span v-if="route.redirectedFrom?.query.bot" style="position: absolute;font-family: HYWH;">7</span>
  <div class="container">
    <div :class="{ title: true, 'title-mobile': isMobile }">七圣召唤模拟器</div>
    <div style="position: absolute;right: 10px;top: 10px;">（更新至6.2）</div>
    <div v-if="isShowEditName" class="edit-name">
      <input type="text" placeholder="请输入昵称(不超过10字)" maxlength="10" v-model="inputName" @keyup.enter="register" />
      <button style="display: block; margin: 10px auto;" @click="register">
        {{ username == "" ? "确认" : inputName == "" ? "取消" : "修改" }}
      </button>
    </div>
    <div v-if="username != ''">
      <div class="lobby">
        <div class="game-list-container">
          <div class="game-list-title">
            <span class="game-room-id">房间号</span>
            <span class="game-room-name">房间名</span>
            <span class="game-room-version">版本</span>
            <span class="game-room-status">状态</span>
          </div>
          <div class="game-list">
            <div class="game-room" v-for="(room, ri) in roomList" :key="'roomList' + ri"
              @click="enterRoom(room.id.toString())">
              <span class="game-room-id">{{ room.id }}</span>
              <span class="game-room-name">{{ room.name }}</span>
              <span class="game-room-version">
                <span v-if="(OFFLINE_VERSION as unknown as string[]).includes(room.version)">实体版</span>
                {{ room.version }}
              </span>
              <span class="game-room-status">
                {{ room.isStart ? "游戏中" : "等待中" }}({{ room.playerCnt }}/{{ PLAYER_COUNT }})
              </span>
            </div>
          </div>
        </div>
        <div class="player-list-container">
          <div class="name-self">{{ username }}</div>
          <div class="player-list">
            <div class="player-item" v-for="(player, pi) in playerList.filter(p => p.id != userid)"
              :key="'playerList' + pi">
              <div class="player-name">{{ player.name }}</div>
              <div class="player-status">
                <button v-if="player.status > 0" @click=" enterRoom(player.rid.toString(), { follow: player.id })">
                  跟随
                </button>
                <span :style="{ color: playerStatus[player.status].color }">
                  {{ playerStatus[player.status].name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="btn-group">
        <button v-if="isDev">导入回放<input type="file" accept=".gi" @change="importRecord" /></button>
        <button @click="openRename">改名</button>
        <button @click="enterEditDeck">查看卡组</button>
        <button @click="openEnterRoom()">加入房间</button>
        <button @click="openCreateRoom">创建房间</button>
      </div>
    </div>
    <div class="version">v1.2.2</div>
  </div>
  <CreateRoomModal v-if="isShowCreateRoom" @create-room-cancel="cancelCreateRoom" @create-room="createRoom"
    @create-config="createConfig" @edit-config="editConfig" />
  <EnterRoomModal v-if="isShowEnterRoom" :select-room-id="selectRoomId" @enter-room-cancel="cancelEnterRoom"
    @enter-room="enterRoom" />
  <InfoModal id="info-modal" v-if="info.info != null" :is-mobile="isMobile" :info="info" isBot />
  <input id="taimbot" type="text" v-model="infoContent" @change="showInfo" />
</template>

<script setup lang='ts'>
import CreateRoomModal from '@/components/CreateRoomModal.vue';
import EnterRoomModal from '@/components/EnterRoomModal.vue';
import InfoModal from '@/components/InfoModal.vue';
import { getSocket } from '@/store/socket';
import { ACTION_TYPE, OFFLINE_VERSION, VERSION, Version } from '@@@/constant/enum';
import { MIN_DECK_COUNT, PLAYER_COUNT } from '@@@/constant/gameOption';
import { cardsTotal } from '@@@/data/cards';
import { herosTotal } from '@@@/data/heros';
import { summonsTotal } from '@@@/data/summons';
import { getTalentIdByHid } from '@@@/utils/gameUtil';
import { genShareCode, getSecretData, importFile } from '@@@/utils/utils';
import LZString from 'lz-string';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Card, CustomVersionConfig, Hero, InfoVO, Player, PlayerList, RecordData, RoomList, Summon } from '../../../typing';

const isDev = process.env.NODE_ENV == 'development';
const isMobile = ref(/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
const socket = getSocket(isDev);
const router = useRouter();
const route = useRoute();

const userid = ref<number>(Number(localStorage.getItem('7szh_userid') || '-1')); // 玩家id
const username = ref<string>(localStorage.getItem('7szh_username') || ''); // 昵称
const inputName = ref<string>(''); // 注册/修改昵称
const roomList = ref<RoomList>([]); // 当前房间列表
const playerList = ref<PlayerList>([]); // 当前玩家列表
const isShowEditName = ref<boolean>(username.value == ''); // 是否显示改名界面
const isShowCreateRoom = ref<boolean>(false); // 是否显示创建房间界面
const isShowEnterRoom = ref<boolean>(false); // 是否显示加入房间界面
const selectRoomId = ref<number>(-1); // 选择的房间的id
const playerStatus = ref([
  { name: '空闲', color: '#38b100' },
  { name: '房间中', color: 'black' },
  { name: '游戏中', color: '#eb7e00' },
]); // 玩家状态
const info = ref<InfoVO>({ version: 'v3.3.0', isShow: true, type: null, info: null }); // 为pupeteer截图时使用
const infoContent = ref<string>('');
const allEntities = (version: Version) => [...herosTotal(version, true), ...cardsTotal(version, { force: true }), ...summonsTotal(version)];
let followIdx: number = -1; // 跟随的玩家id

if (username.value != '') {
  socket.emit('login', { id: userid.value, name: username.value });
}

// 初始化卡组
if (localStorage.getItem('GIdecks') == null) {
  const gidecks = JSON.stringify(
    new Array(MIN_DECK_COUNT).fill(0).map(() => ({
      name: '默认卡组',
      shareCode: genShareCode([0, 0, 0]),
    }))
  );
  localStorage.setItem('GIdecks', gidecks);
}

if (history.state.saveConfig) {
  history.state.saveConfig = false;
  isShowCreateRoom.value = true;
}

// 注册昵称
const register = () => {
  if (inputName.value == '' && username.value == '') return alert('不能为空！');
  if (inputName.value != '') username.value = inputName.value;
  isShowEditName.value = false;
  inputName.value = '';
  localStorage.setItem('7szh_username', username.value);
  socket.emit('login', { id: userid.value, name: username.value });
};

// 显示改名界面
const openRename = () => {
  isShowEditName.value = true;
};

// 查看卡组
const enterEditDeck = () => {
  router.push({ name: 'editDeck' });
};

// 打开创建房间界面
const openCreateRoom = () => {
  if ((playerList.value.find(p => p.id == userid.value)?.rid ?? -1) > 0) {
    return alert('你还有正在进行的游戏！');
  }
  isShowCreateRoom.value = true;
};

// 关闭创建房间界面
const cancelCreateRoom = () => {
  isShowCreateRoom.value = false;
};

// 创建房间
const createRoom = (roomName: string, version: Version, roomPassword: string, countdown: number,
  allowLookon: boolean, customVersion?: CustomVersionConfig, isRecord?: { pidx: number, username: string[] }) => {
  isShowCreateRoom.value = false;
  socket.emit('createRoom', { roomName, version, roomPassword, countdown, allowLookon, customVersion, isRecord });
};

// 打开加入房间界面
const openEnterRoom = (rid: number = -1) => {
  const prid = playerList.value.find(p => p.id == userid.value)?.rid ?? -1;
  if (prid > 0) {
    enterRoom(prid.toString(), { isForce: true });
    return;
  }
  selectRoomId.value = rid;
  isShowEnterRoom.value = true;
};

// 关闭加入房间界面
const cancelEnterRoom = () => {
  isShowEnterRoom.value = false;
};

// 加入房间
const enterRoom = (roomId: string, options: { roomPassword?: string; isForce?: boolean; follow?: number } = {}) => {
  const { roomPassword = '', isForce = false, follow = -1 } = options;
  isShowEnterRoom.value = false;
  const room = roomList.value.find(r => r.id == Number(roomId));
  if (!room) return console.error(`room${roomId} not found`);
  if (follow > -1) followIdx = follow;
  if (room.hasPassWord && roomPassword == '') return openEnterRoom(room.id);
  socket.emit('enterRoom', { roomId: Number(roomId), roomPassword, isForce });
};

// 导入回放
const importRecord = (e: Event) => {
  importFile(e, res => {
    const recordData: RecordData = JSON.parse(LZString.decompressFromBase64(res ?? '{}'));
    if (isDev) console.info(recordData);
    const pidx = Math.max(0, recordData.pidx);
    createRoom(recordData.name, recordData.version, '', 0, false, recordData.customVersionConfig, {
      pidx,
      username: recordData.username,
    });
    socket.emit('sendToServer', {
      type: ACTION_TYPE.PlayRecord,
      recordData,
      flag: 'play-record',
    });
  }, 'gi');
}

// 新增自定义版本配置
const createConfig = () => {
  router.push({ name: 'versionConfig', params: { mode: 'create' } });
}

// 编辑自定义版本配置
const editConfig = (configName: string) => {
  router.push({ name: 'versionConfig', params: { mode: 'edit' }, state: { configName } });
}

// 获取玩家和房间列表
const getPlayerAndRoomList = ({ plist, rlist }: { plist: Player[]; rlist: RoomList; }) => {
  roomList.value = rlist;
  playerList.value = plist.map(p => ({
    ...p,
    status: p.rid < 0 ? 0 : roomList.value.find(r => r.id == p.rid)?.isStart ? 2 : 1,
  }));
};

// 显示实体信息(用于puppeteer截图)
const showInfo = () => {
  try {
    const [query, ver] = infoContent.value.split(' ');
    const isTalent = query.endsWith('天赋');
    const findEntity = (e: Hero | Card | Summon) => e.id.toString() == query || e.name.includes(query.slice(0, isTalent ? -2 : 100));
    const [, v1, v2, v3] = ver.match(/v?(\d)\.?(\d?)\.?(\d?)/) ?? VERSION[0];
    const isOffline = ver.startsWith('实体');
    const rawVersion = `v${v1}.${v2 || 0}.${v3 || 0}`;
    const version = isOffline ? OFFLINE_VERSION.find(v => allEntities(v).some(findEntity)) :
      Array.from<string>(VERSION).includes(rawVersion) ? rawVersion as Version : VERSION[0];
    if (!version) throw new Error('版本错误');
    let infoEntity = allEntities(version).find(findEntity);
    if (isTalent && infoEntity) {
      infoEntity = allEntities(version).find(e => e.id == getTalentIdByHid(infoEntity!.id));
    }
    if (!infoEntity) throw new Error('未找到');
    info.value = {
      version,
      isShow: true,
      type: 'maxUse' in infoEntity ? 'summon' : 'cost' in infoEntity ? 'card' : 'hero',
      info: infoEntity,
    };
  } catch {
    infoContent.value = '';
    return info.value.info = null;
  }
}

onMounted(async () => {
  // 获取登录pid
  socket.on('login', async ({ pid, name }) => {
    userid.value = pid;
    username.value = name;
    localStorage.setItem('7szh_userid', pid.toString());
    let loginApi = await getSecretData('loginApi');
    if (isDev) loginApi = loginApi.replace(/.+\.site/, 'http://localhost:7000');
    fetch(`${loginApi}${pid}`);
  });
  socket.on('getPlayerAndRoomList', getPlayerAndRoomList);
  // 进入房间
  socket.on('enterRoom', ({ roomId, isLookon, players, version, countdown, allowLookon, customVersion, err }) => {
    if (err) return alert(err);
    if (isLookon) alert('游戏已满员！进入成为旁观者');
    router.push({
      name: 'gameRoom',
      params: { roomId },
      state: {
        isDev,
        isLookon,
        players,
        version,
        countdown,
        allowLookon,
        customVersion,
        follow: players.find((p: Player) => p.id == followIdx)?.pidx,
      },
    });
    followIdx = -1;
  });
  // 继续游戏
  socket.on('continueGame', data => socket.emit('enterRoom', data));
});

const loadedFonts = new Set<string>();
document.fonts.onloadingdone = event => {
  (event as FontFaceSetLoadEvent).fontfaces.forEach(fontface => {
    if (!loadedFonts.has(fontface.family) && fontface.status === 'loaded') {
      loadedFonts.add(fontface.family);
      console.log(`font ${fontface.family} loaded`);
    }
  });
};

onUnmounted(() => {
  socket.removeAllListeners();
});
</script>

<style scoped>
body {
  user-select: none;
}

.container {
  width: 100%;
  height: 95vh;
  background-color: #aed1c8;
  position: relative;
  user-select: none;
  overflow: hidden;
}

.title {
  font-size: 25px;
  width: 100%;
  text-align: center;
  margin: 20px 0;
  font-weight: bolder;
}

.title-mobile {
  margin: 5px 0;
}

input[type=text] {
  height: 20px;
  width: 50%;
  margin: 0 auto;
  display: block;
  border-radius: 10px;
  padding: 5px 10px;
}

input[type=file] {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

button {
  position: relative;
  background-color: #00a4db;
  border-radius: 5px;
  border: 0;
  padding: 5px 10px;
  width: 100px;
  border: 3px outset #0093c4;
}

button:hover {
  background-color: #0093c4;
  cursor: pointer;
  border: 3px outset #005f7f;
}

button:active {
  background-color: #005f7f;
  border: 3px outset #00a4db;
}

.lobby {
  display: flex;
  justify-content: space-between;
  margin: 0 10px;
  gap: 10px;
}

.game-list-container {
  height: 70vh;
  border-radius: 5px;
  flex-grow: 10;
  border: 4px double black;
  background-color: #aac4f4;
  display: flex;
  flex-direction: column;
}

.player-list-container {
  height: 70vh;
  border-radius: 5px;
  flex-grow: 1;
  border: 4px double black;
  background-color: #faebd7;
  display: flex;
  flex-direction: column;
}

.btn-group {
  width: 90%;
  display: flex;
  margin: 10px;
  gap: 15px;
  flex-direction: row-reverse;
}

.game-list-title {
  padding: 5px 10px;
  display: flex;
  color: white;
  border-bottom: 2px solid black;
  background-color: #3a5890;
}

.game-list,
.player-list {
  overflow-y: scroll;
}

.game-list::-webkit-scrollbar,
.player-list::-webkit-scrollbar {
  display: none;
}

.game-room,
.player-item {
  display: flex;
  padding: 5px 10px;
  border-bottom: 1px solid black;
}

.game-room:hover {
  cursor: pointer;
  background-color: #74a2f6;
}

.game-room-id {
  flex: 1;
}

.game-room-name {
  flex: 3;
}

.game-room-version {
  flex: 1;
}

.game-room-status {
  flex: 1;
}

.name-self {
  text-align: center;
  padding: 5px 0;
  color: white;
  border-bottom: 2px solid black;
  background-color: #ba7317;
}

.player-item {
  justify-content: space-between;
}

.player-status>button {
  width: auto;
  padding: 0 3px;
  margin-right: 5px;
}

.version {
  position: absolute;
  bottom: 0;
  right: 3px;
  color: gray;
  font-size: 10px;
}

#taimbot {
  opacity: 0;
  position: absolute;
  top: 20%;
  z-index: -1;
}
</style>
