<template>
  <div class="create-room-dialogue" @click="cancel">
    <div class="create-room-main" @click.stop="" @keyup.enter="create">
      <select name="version" id="version" v-model="version">
        <option v-for="ver in [...VERSION, ...OFFLINE_VERSION]" :key="ver" :value="ver">
          {{ isOfflineVersion(ver) ? '实体版' : '' }}{{ ver }}
        </option>
      </select>
      <input type="text" placeholder="房间名(选填)" v-model="roomName" />
      <input type="text" placeholder="密码(选填)" v-model="roomPassword" />
      <input type="number" placeholder="倒计时(秒)(选填)" v-model="countdown" />
      <div style="margin-top: 5%;">
        <input type="checkbox" id="allowLookon" style="width: fit-content;height: 100%;" :checked="allowLookon"
          @click="allowLookon = !allowLookon" />
        <label for="allowLookon" style="cursor: pointer;">是否允许观战</label>
      </div>
      <button style="margin: 5% 0" @click="create">创建</button>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { OFFLINE_VERSION, OfflineVersion, VERSION, Version } from '@@@/constant/enum';
import { ref } from 'vue';

const emit = defineEmits<{
  'create-room': [roomName: string, version: Version, roomPassword: string, countdown: number, allowLookon: boolean],
  'create-room-cancel': []
}>();

const roomName = ref<string>(''); // 房间名
const roomPassword = ref<string>(''); // 房间密码
const version = ref<Version>((JSON.parse(localStorage.getItem('GIdecks') || '[]')[Number(localStorage.getItem('GIdeckIdx') || '0')])?.version ?? VERSION[0]); // 版本
const countdown = ref<number | string>(''); // 倒计时
const allowLookon = ref<boolean>(true); // 是否允许观战

const create = () => emit('create-room', roomName.value, version.value, roomPassword.value, +countdown.value || 0, allowLookon.value);
const cancel = () => emit('create-room-cancel');
const isOfflineVersion = (version: Version) => OFFLINE_VERSION.includes(version as OfflineVersion);
</script>

<style scoped>
.create-room-dialogue {
  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  background-color: #00000098;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
}

.create-room-main {
  width: 50vw;
  border-radius: 5px;
  background-color: #cccccc;
  border: 3px solid black;
  display: flex;
  flex-direction: column;
  align-items: center;
}

input {
  width: 80%;
  height: 5vh;
  margin-top: 5%;
  padding: 0 2%;
  border-radius: 5px;
}

select {
  height: 5vh;
  margin-top: 5%;
  padding: 0 2%;
  border-radius: 5px;
  border: 2px inset black;
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
</style>
