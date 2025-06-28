<template>
  <div class="create-room-dialogue" @click="cancel">
    <div class="create-room-main" @click.stop="" @keyup.enter="create">
      <select name="version" id="custom-version" v-model="customVersion.name" v-if="isCustom">
        <option v-for="(item, idx) in customVersionList" :key="idx" :value="item.name">
          {{ item.name || '无' }}
        </option>
      </select>
      <select name="version" id="version" v-model="version" v-else>
        <option v-for="ver in officialVersionList" :key="ver" :value="ver">
          {{ isOfflineVersion(ver) ? '实体版' : '' }}{{ ver }}
        </option>
      </select>
      <input type="text" placeholder="房间名(选填)" v-model="roomName" />
      <input type="text" placeholder="密码(选填)" v-model="roomPassword" />
      <input type="number" placeholder="倒计时(秒)(选填)" v-model="countdown" />
      <div class="options">
        <input type="checkbox" id="allowLookon" :checked="allowLookon" @click="allowLookon = !allowLookon" />
        <label for="allowLookon" style="cursor: pointer;">允许观战</label>
        <input type="checkbox" id="isCustom" :checked="isCustom" @click="isCustom = !isCustom" />
        <label for="isCustom" style="cursor: pointer;">自定义版本</label>
      </div>
      <div class="btn-group">
        <button v-if="isCustom" @click="createConfig">新增</button>
        <button v-if="isCustom && !isDiffEmpty" @click="editConfig">编辑</button>
        <button v-if="isCustom && !isDiffEmpty" @click="deleteConfig">删除</button>
        <button v-if="isCustom">导入<input type="file" accept=".json" @change="importConfig" /></button>
        <button :class="{ 'btn-forbidden': isCustom && isDiffEmpty }" @click="create">创建</button>
      </div>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { OFFLINE_VERSION, OfflineVersion, VERSION, Version } from '@@@/constant/enum';
import { compareVersionFn } from '@@@/utils/gameUtil';
import { computed, ref } from 'vue';
import { CustomVersionConfig } from '../../../typing';
import { NULL_CUSTOM_VERSION_CONFIG } from '@@@/constant/init';
import { importFile } from '@@@/utils/utils';

const emit = defineEmits<{
  'create-room': [roomName: string, version: Version, roomPassword: string, countdown: number, versionDiff: Record<number, Version>, allowLookon: boolean],
  'create-room-cancel': [],
  'create-config': [],
  'edit-config': [name: string],
}>();

const roomName = ref<string>(''); // 房间名
const roomPassword = ref<string>(''); // 房间密码
const oriVersion: Version = (JSON.parse(localStorage.getItem('GIdecks') || '[]')[Number(localStorage.getItem('GIdeckIdx') || '0')])?.version ?? 'vlatest';
const version = ref<Version>(compareVersionFn(oriVersion).value); // 版本
const countdown = ref<number | string>(''); // 倒计时
const allowLookon = ref<boolean>(true); // 是否允许观战
const officialVersionList = ref<Version[]>([...VERSION, ...OFFLINE_VERSION]); // 官方版本列表
const isCustom = ref<boolean>(false); // 是否创建自定义版本房间
const rawCustomVersionList: CustomVersionConfig[] = JSON.parse(localStorage.getItem('7szh_custom_version_list') || '[]');
const customVersionList = ref<CustomVersionConfig[]>(rawCustomVersionList.length ? rawCustomVersionList : [NULL_CUSTOM_VERSION_CONFIG()]); // 自定义版本列表
const customVersion = ref<CustomVersionConfig>(customVersionList.value[0]); // 当前选择的版本配置
const isDiffEmpty = computed(() => Object.keys(customVersion.value.diff).length == 0);

const create = () => {
  if (isCustom.value && isDiffEmpty.value) return;
  const selectedVersion = isCustom.value ? customVersion.value.baseVersion : version.value;
  emit('create-room', roomName.value, selectedVersion, roomPassword.value,
    +countdown.value || 0, customVersion.value.diff, allowLookon.value)
};
const cancel = () => emit('create-room-cancel');
const isOfflineVersion = (version: Version) => OFFLINE_VERSION.includes(version as OfflineVersion);

const createConfig = () => emit('create-config');

const editConfig = () => emit('edit-config', customVersion.value.name);

const deleteConfig = () => {
  const isConfirm = confirm('确定删除吗？');
  if (isConfirm) {
    const delIdx = customVersionList.value.findIndex(v => v.name == customVersion.value.name);
    customVersionList.value.splice(delIdx, 1);
    localStorage.setItem('7szh_custom_version_list', JSON.stringify(customVersionList.value));
    if (customVersionList.value.length == 0) customVersionList.value.push(NULL_CUSTOM_VERSION_CONFIG());
    customVersion.value = customVersionList.value[0];
  }
}

const importConfig = (e: Event) => {
  importFile(e, res => {
    const config: CustomVersionConfig = JSON.parse(res ?? '{}');
    if (!config.name || !config.baseVersion || !Object.keys(config.diff ?? '').length) return alert('请选择正确的配置文件');
    const hasSameName = customVersionList.value.findIndex(v => v.name == config.name);
    if (hasSameName > -1) {
      if (!confirm('有同名配置，要覆盖吗？')) return;
      customVersionList.value[hasSameName] = config;
    } else {
      customVersionList.value.push(config);
      if (Object.keys(customVersionList.value[0].diff).length == 0) customVersionList.value.shift();
    }
    customVersion.value = customVersionList.value.at(hasSameName)!;
    localStorage.setItem('7szh_custom_version_list', JSON.stringify(customVersionList.value));
  }, 'json');
}

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
  min-width: 40vw;
  border-radius: 5px;
  background-color: #cccccc;
  border: 3px solid black;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 5%;
}

.options {
  margin-top: 5%;
}

.options>input {
  width: fit-content;
  height: 100%;
}

.btn-group {
  display: flex;
  margin: 5% 0;
  gap: 2%;
}

.btn-forbidden {
  cursor: default;
  background-color: #9a9a9a;
  border: 3px outset #5a5a5a;
}

input {
  width: 100%;
  height: 5vh;
  margin-top: 3%;
  padding: 0 2%;
  border-radius: 5px;
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

select {
  height: 5vh;
  margin-top: 5%;
  padding: 0 2%;
  border-radius: 5px;
  border: 2px inset black;
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

button:not(.btn-forbidden):hover {
  background-color: #0093c4;
  cursor: pointer;
  border: 3px outset #005f7f;
}

button:not(.btn-forbidden):active {
  background-color: #005f7f;
  border: 3px outset #00a4db;
}
</style>
