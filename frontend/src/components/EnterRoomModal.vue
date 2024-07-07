<template>
  <div class="enter-room-dialogue" @click="cancel">
    <div class="enter-room-main" @click.stop="" @keyup.enter="enter">
      <input type="text" placeholder="房间号" v-model="roomId" />
      <input type="text" placeholder="密码(选填)" v-model="roomPassword" />
      <button style="margin: 5% 0" @click="enter">加入</button>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';

const props = defineProps({
  selectRoomId: {
    type: Number,
    default: -1,
  },
});
const emit = defineEmits(['enter-room', 'enter-room-cancel']);
const roomId = ref<string>(props.selectRoomId == -1 ? '' : props.selectRoomId.toString()); // 房间号
const roomPassword = ref<string>(''); // 房间密码

const enter = () => emit('enter-room', roomId.value, roomPassword.value);
const cancel = () => emit('enter-room-cancel');
</script>

<style scoped>
.enter-room-dialogue {
  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  background-color: #00000098;
  display: flex;
  justify-content: center;
  align-items: center;
}

.enter-room-main {
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
