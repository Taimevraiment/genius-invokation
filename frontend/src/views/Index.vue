<template>
  <div class="container">
    <div :class="{ title: true, 'title-mobile': isMobile }">七圣召唤模拟器</div>
    <div style="position: absolute;right: 10px;top: 10px;">（更新至5.4）</div>
    <div v-if="isShowEditName" class="edit-name">
      <input type="text" placeholder="请输入昵称" v-model="inputName" @keyup.enter="register" />
      <button style="display: block; margin: 10px auto" @click="register">
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
              <span class="game-room-version">{{ room.version }}</span>
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
        <button @click="openRename">改名</button>
        <button @click="enterEditDeck">查看卡组</button>
        <button @click="openEnterRoom()">加入房间</button>
        <button @click="openCreateRoom">创建房间</button>
      </div>
    </div>
  </div>
  <CreateRoomModal v-if="isShowCreateRoom" @create-room-cancel="cancelCreateRoom" @create-room="createRoom" />
  <EnterRoomModal v-if="isShowEnterRoom" :select-room-id="selectRoomId" @enter-room-cancel="cancelEnterRoom"
    @enter-room="enterRoom" />
</template>

<script setup lang='ts'>
import CreateRoomModal from '@/components/CreateRoomModal.vue';
import EnterRoomModal from '@/components/EnterRoomModal.vue';
import { getSocket } from '@/store/socket';
import { Version } from '@@@/constant/enum';
import { MAX_DECK_COUNT, PLAYER_COUNT } from '@@@/constant/gameOption';
import { genShareCode } from '@@@/utils/utils';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Player, PlayerList, RoomList } from '../../../typing';

const isDev = process.env.NODE_ENV == 'development';
const isMobile = ref(/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
const socket = getSocket(isDev);
const router = useRouter();

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
let followIdx: number = -1; // 跟随的玩家id

if (username.value != '' && userid.value > 0) {
  socket.emit('login', { id: userid.value, name: username.value });
}

// 初始化卡组
if (localStorage.getItem('GIdecks') == null) {
  localStorage.setItem(
    'GIdecks',
    JSON.stringify(
      new Array(MAX_DECK_COUNT).fill(0).map(() => ({
        name: '默认卡组',
        shareCode: genShareCode([0, 0, 0]),
      }))
    )
  );
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
const createRoom = (roomName: string, version: Version, roomPassword: string, countdown: number, allowLookon: boolean) => {
  isShowCreateRoom.value = false;
  socket.emit('createRoom', { roomName, version, roomPassword, countdown, allowLookon });
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

// 获取玩家和房间列表
const getPlayerAndRoomList = ({ plist, rlist }: { plist: Player[]; rlist: RoomList; }) => {
  roomList.value = rlist;
  playerList.value = plist.map(p => ({
    ...p,
    status: p.rid < 0 ? 0 : roomList.value.find(r => r.id == p.rid)?.isStart ? 2 : 1,
  }));
};
onMounted(() => {
  // 获取登录pid
  socket.on('login', ({ pid, name }) => {
    userid.value = pid;
    username.value = name;
    localStorage.setItem('7szh_userid', pid.toString());
  });
  socket.on('getPlayerAndRoomList', getPlayerAndRoomList);
  // 进入房间
  socket.on('enterRoom', ({ roomId, isLookon, players, version, countdown, allowLookon, err }) => {
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
        follow: players.find((p: Player) => p.id == followIdx)?.pidx,
      },
    });
    followIdx = -1;
  });
  // 继续游戏
  socket.on('continueGame', data => socket.emit('enterRoom', data));
});

onUnmounted(() => {
  socket.off('login');
  socket.off('getPlayerAndRoomList', getPlayerAndRoomList);
  socket.off('enterRoom');
  socket.off('continueGame');
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

input {
  height: 20px;
  width: 50%;
  margin: 0 auto;
  display: block;
  border-radius: 10px;
  padding: 5px 10px;
}

button {
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
</style>
