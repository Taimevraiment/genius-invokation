<template>
  <div class="container" :class="{ 'mobile-container': isMobile }" @click.stop="cancel">
    <button v-if="!client.isStart || isLookon > -1 || hasAI" class="exit" @click.stop="exit">
      返回
    </button>
    <div style="position: absolute;left: 60px;color: white;">[{{ version }}] 房间号{{ roomId }}</div>
    <button v-if="client.isStart && isLookon == -1 && client.phase >= PHASE.ACTION" class="exit" @click.stop="giveup">
      投降
    </button>
    <div class="player-info">{{ client.player?.UI.info }}</div>

    <div class="menu">
      <button v-if="isLookon == -1 && client.phase <= PHASE.NOT_BEGIN" class="start" @click.stop="startGame">
        {{ client.player?.phase == PHASE.NOT_READY ? "准备开始" : "取消准备" }}
      </button>
      <button v-if="isLookon == -1 && client.player?.phase == PHASE.NOT_READY" class="deck-open"
        @click.stop="enterEditDeck">
        查看卡组
      </button>
      <div class="warn" v-if="!client.isDeckCompleteValid.isValid">{{ client.isDeckCompleteValid.error }}</div>
      <div class="warn" v-if="!client.isDeckVersionValid.isValid">{{ client.isDeckVersionValid.error }}</div>
    </div>

    <div :class="{
      'player-display': true,
      'curr-player': client.player?.status == PLAYER_STATUS.PLAYING && client.phase <= PHASE.ACTION && client.phase >= PHASE.CHOOSE_HERO && client.isWin == -1,
      'mobile-player-display': isMobile,
    }" @click.stop="devOps()">
      <span v-if="isLookon > -1">旁观中......</span>
      <p>{{ client.player?.name }}</p>
      <div v-if="client.isWin > -1 || client.isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
        {{ handCardsCnt[client.playerIdx] }}
      </div>
      <img class="legend" :src="getDiceBgIcon('legend-empty')" />
      <img v-if="!client.player?.playerInfo.isUsedLegend" class="legend" :src="getDiceBgIcon('legend')" />
    </div>

    <div v-if="client.opponent" :class="{
      'player-display-oppo': true,
      'curr-player': client.opponent?.status == PLAYER_STATUS.PLAYING && client.phase <= PHASE.ACTION && client.phase >= PHASE.CHOOSE_HERO && client.isWin == -1,
      'mobile-player-display': isMobile,
    }" @click.stop="devOps(1)">
      <p v-if="client.opponent?.name">{{ client.opponent?.name }}</p>
      <p class="ai-btn" v-if="!client.opponent?.name" style="color: aquamarine;" @click.stop="addAI">+添加bot</p>
      <p class="ai-btn" v-if="client.opponent.id == AI_ID && client.phase <= PHASE.NOT_BEGIN" style="color: red"
        @click.stop="removeAI">
        -删除bot
      </p>
      <div v-if="client.isWin > -1 || client.isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
        {{ handCardsCnt[client.playerIdx ^ 1] }}
      </div>
      <img v-if="client.opponent?.isOffline" src="@@/svg/offline.svg" class="offline" alt="断线..." />
      <img v-if="isLookon > -1" src="@@/svg/lookon.svg" class="lookon" alt="旁观"
        @click.stop="lookonTo(client.opponent?.pidx ?? -1)" />
      <img class="legend-oppo" :src="getDiceBgIcon('legend-empty')" />
      <img v-if="!client.opponent.playerInfo.isUsedLegend" class="legend-oppo" :src="getDiceBgIcon('legend')" />
    </div>

    <MainDesk v-if="client.phase >= PHASE.CHANGE_CARD || client.isWin > -1" :isMobile="isMobile" :canAction="canAction"
      :afterWinHeros="afterWinHeros" :isLookon="isLookon" :client="client" :version="version"
      @select-change-card="selectChangeCard" @change-card="changeCard" @reroll="reroll" @select-hero="selectHero"
      @select-use-dice="selectUseDice" @select-support="selectCardSupport" @select-summon="selectCardSummon"
      @end-phase="endPhase" @show-history="showHistory" @update:dice-select="updateDiceSelect"
      @select-card-pick="selectCardPick" @pick-card="pickCard" />

    <div class="hand-card"
      v-if="((client.player?.phase ?? PHASE.NOT_READY) >= PHASE.CHOOSE_HERO && client.currSkill.id < 0) || client.isWin > -1"
      :class="{ 'mobile-hand-card': isMobile, 'skill-will': canAction && client.currSkill.id != -1 }"
      :style="{ transform: `translateX(-${12 * client.handcardsPos.length}px)` }">
      <handcard v-for="(card, idx) in client.player.handCards" :key="`${idx}-${card.id}-myhandcard`"
        :class="{ selected: client.handcardsSelect == idx }" :card="card" :isMobile="isMobile"
        :style="{ left: `${client.handcardsPos[idx]}px` }" @click.stop="selectCard(idx)" @mouseenter="mouseenter(idx)"
        @mouseleave="mouseleave(idx)">
      </handcard>
    </div>

    <div class="btn-group" v-if="client.isShowButton">
      <button :class="{ forbidden: !client.isValid }" v-if="!client.isReconcile && client.currCard.id > 0 && canAction"
        @click.stop="useCard">
        出牌
      </button>
      <button v-if="client.currCard.id > 0 && canAction" @click.stop="reconcile(true)"
        :style="{ backgroundColor: ELEMENT_COLOR[client.getFrontHero()?.element ?? ELEMENT_TYPE.Physical] }"
        :class="{ forbidden: !client.reconcileValid[client.currCard.cidx] }">
        调和
      </button>
      <button v-if="client.isReconcile && client.currCard.id > 0" @click.stop="reconcile(false)">
        取消
      </button>
      <div v-if="(client.isShowSwitchHero > 0 && client.currCard.id <= 0) ||
        (client.player.phase == PHASE.CHOOSE_HERO && client.heroSelect.some(v => v))"
        style="display: flex; flex-direction: column; align-items: center; transform: translateY(20px);">
        <div class="quick-action" v-if="client.isShowSwitchHero == 3">
          快速行动
        </div>
        <div class="switch-button" v-if="client.player.hidx != -1"
          @click.stop="client.isShowSwitchHero < 2 ? chooseHero() : switchHero()"
          :style="{ filter: !client.isValid && client.player.phase != PHASE.CHOOSE_HERO ? 'brightness(0.4)' : '' }">
        </div>
        <div class="skill-cost" v-if="client.player.phase == PHASE.ACTION"
          :style="{ marginTop: '10px', opacity: +(client.isShowSwitchHero >= 2) }">
          <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Any])" />
          <span :style="{ zIndex: 1, color: client.heroSwitchDiceColor }">
            {{ client.heroSwitchDice }}
          </span>
        </div>
      </div>
    </div>
    <div class="skills" v-else-if="client.isShowSkills">
      <div class="skill" :class="{ 'skill-will': canAction && client.currSkill.id == skill.id }"
        v-for="skill in client.skills" :key="skill.id">
        <div class="skill-btn" :class="{ 'skill-vehicle': skill.type == SKILL_TYPE.Vehicle }"
          @click.stop="useSkill(skill.id, false)" :style="{ boxShadow: skill.style.fullEnergy }">
          <div class="skill3-bg" v-if="skill.isNotFullEnergy" :style="{ background: skill.style.notFullEnergy }">
            <div class="skill-btn" style="left: 2px;top: 2px;width: 90%;height: 90%;border: 2px solid transparent;">
            </div>
          </div>
          <img class="skill-img" :src="skill.UI.src" v-if="skill.UI.src.length > 0"
            :alt="SKILL_TYPE_ABBR[skill.type]" />
          <span v-else class="skill-img">{{ SKILL_TYPE_ABBR[skill.type] }}</span>
          <div class="skill-forbidden" v-if="skill.isForbidden" @click.stop="useSkill(skill.id, true)"></div>
        </div>
        <div class="skill-cost" v-for="(cost, cidx) in skill.cost.filter(c => c.cnt > 0)" :key="cidx"
          :style="{ color: skill.style.costColors[cidx] }">
          <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[cost.type])" />
          <span style="z-index: 1">{{ skill.CurrCnts[cidx] }}</span>
        </div>
      </div>
    </div>

    <InfoModal v-if="client.phase >= PHASE.CHANGE_CARD" :info="client.modalInfo" :isMobile="isMobile" :isInGame="true"
      :round="client.round" :playerInfo="client.player.playerInfo" style="z-index: 10" />

    <h1 v-if="client.isWin != -1 && client.players[client.isWin % PLAYER_COUNT]?.name" class="win-banner"
      :class="{ 'mobile-win-banner': isMobile }">
      <span v-if="client.isWin == -2">——无人获胜——</span>
      <span v-else> {{ client.players[client.isWin % PLAYER_COUNT]?.name }}获胜！！！</span>
    </h1>

    <h1 v-if="client.error != '' && isDev" class="error">{{ client.error }}</h1>

    <div class="tip" :class="{ 'tip-enter': client.tip != '', 'tip-leave': client.tip == '' }">
      {{ client.tip }}
    </div>

    <div class="modal-action" :class="{
      'modal-action-my': client.player?.status == PLAYER_STATUS.PLAYING && client.actionInfo != '',
      'modal-action-oppo': client.opponent?.status == PLAYER_STATUS.PLAYING && client.actionInfo != '',
      'modal-action-leave': client.actionInfo == '',
    }">
      {{ client.actionInfo }}
    </div>
    <div class="debug-mask" v-if="isOpenMask" :style="{ opacity: maskOpacity }"></div>
    <div class="willskill-mask" v-if="client.player.status == PLAYER_STATUS.PLAYING &&
      ((client.currSkill.id != -1 && client.currSkill.canSelectSummon == -1) ||
        client.isShowSwitchHero >= 2 ||
        client.willHp.some(v => v != undefined))">
    </div>

  </div>
</template>

<script setup lang='ts'>
import type { Socket } from 'socket.io-client';
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Handcard from '@/components/Card.vue';
import InfoModal from '@/components/InfoModal.vue';
import MainDesk from '@/components/MainDesk.vue';
import GeniusInvokationClient from '@/geniusInovakationClient';
import { getSocket } from '@/store/socket';
import {
  COST_TYPE,
  DICE_COST_TYPE_CODE_KEY,
  DiceCostType,
  DiceCostTypeCode,
  ELEMENT_TYPE,
  PHASE,
  PLAYER_STATUS,
  SKILL_TYPE,
  Version
} from '@@@/constant/enum';
import { AI_ID, PLAYER_COUNT } from '@@@/constant/gameOption';
import { ELEMENT_COLOR, ELEMENT_ICON, SKILL_TYPE_ABBR } from '@@@/constant/UIconst';
import { getTalentIdByHid } from '@@@/utils/gameUtil';
import { debounce } from '@@@/utils/utils';
import { Card, Cmds, Hero, Player } from '../../../typing';

const router = useRouter();
const route = useRoute();

const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
const { players: cplayers, version: cversion, isLookon: cisLookon, countdown, follow, isDev } = history.state;
const socket: Socket = getSocket(isDev);

const userid = Number(localStorage.getItem('7szh_userid') || '-1'); // 玩家id
const roomId: number = +route.params.roomId; // 房间id
const version = ref<Version>(cversion); // 版本
const isLookon = ref<number>(cisLookon ? follow ?? Math.floor(Math.random() * PLAYER_COUNT) : -1); // 是否旁观
const client = ref(new GeniusInvokationClient(socket, roomId, userid, version.value, cplayers, isMobile.value, countdown, isDev,
  JSON.parse(localStorage.getItem('GIdecks') || '[]'),
  Number(localStorage.getItem('GIdeckIdx') || '0'), isLookon.value,
));

const handCardsCnt = computed<number[]>(() => client.value.handCardsCnt);
const canAction = computed<boolean>(() => client.value.canAction); // 是否可以操作
const afterWinHeros = ref<Hero[][]>([]); // 游戏结束后显示的角色信息
const hasAI = ref<boolean>(false); // 是否有AI

// 获取骰子背景
const getDiceBgIcon = (name: string) => {
  return `/image/${name}-dice-bg.png`;
};

// 获取png图片
// const getPngIcon = (name: string) => {
//   if (name.startsWith('http')) return name;
//   return `/image/${name}.png`;
// };

// 获取svg图片
// const getSvgIcon = (name: string) => {
//   return `/svg/${name}.svg`;
// };

watchEffect(() => {
  if (client.value.isWin < 2) {
    afterWinHeros.value = client.value.players.map(p => p.heros);
  }
});

// 鼠标放入
const mouseenter = (idx: number) => {
  client.value.mouseenter(idx);
};
// 鼠标离开
const mouseleave = (idx: number) => {
  client.value.mouseleave(idx);
};
// 取消选择
const cancel = () => {
  if (client.value.player.phase <= PHASE.NOT_BEGIN) return;
  client.value.cancel();
};
// 选择要换的卡牌
const selectChangeCard = (idx: number, val: boolean) => {
  client.value.selectChangeCard(idx, val);
};
// 选择卡牌
const selectCard = (cardIdx: number) => {
  client.value.selectCard(cardIdx);
};
// 开始游戏
const startGame = () => {
  client.value.startGame();
};
// 查看卡组
const enterEditDeck = () => {
  router.push({ name: 'editDeck' });
};
// 返回
const exit = () => {
  socket.emit('exitRoom');
  if (isLookon.value > -1) router.back();
};
// 投降
const giveup = () => {
  const isConfirm = confirm('确定投降吗？');
  if (isConfirm) {
    client.value.giveup();
  }
};
// 换卡
const changeCard = (cidxs: number[]) => {
  client.value.changeCard(cidxs);
};
// 重掷骰子
const reroll = () => {
  client.value.reroll();
};
// 选择出战角色
const chooseHero = () => {
  client.value.chooseHero();
};
// 选择角色
const selectHero = (pidx: number, hidx: number) => {
  if (client.value.selectCardHero(pidx, hidx)) {
    client.value.selectHero(pidx, hidx);
  }
};
// 选择召唤物
const selectCardSummon = (pidx: number, suidx: number, isNotShow: boolean) => {
  client.value.selectCardSummon(pidx, suidx);
  if (!isNotShow) client.value.showSummonInfo(pidx, suidx);
};
// 选择支援物
const selectCardSupport = (pidx: number, siidx: number) => {
  client.value.selectCardSupport(pidx, siidx);
  client.value.showSupportInfo(pidx, siidx);
};
// 选择要消费的骰子
const selectUseDice = () => {
  client.value.selectUseDice();
};
// 选择挑选的卡牌
const selectCardPick = (pcidx: number) => {
  client.value.selectCardPick(pcidx);
}
// 挑选卡牌
const pickCard = () => {
  client.value.pickCard();
}
// 进入调和模式
const reconcile = (bool: boolean) => {
  client.value.reconcile(bool, client.value.handcardsSelect);
};
// 使用技能
const useSkill = (skid: number, isOnlyRead: boolean) => {
  client.value.useSkill(skid, { isOnlyRead });
};
// 切换角色
const switchHero = debounce(() => {
  client.value.switchHero();
});
// 结束回合
const endPhase = () => {
  client.value.endPhase();
};
// 使用卡
const useCard = () => {
  client.value.useCard();
};
// 显示历史信息
const showHistory = () => {
  client.value.isShowHistory = true;
};
// 更新diceSelect
const updateDiceSelect = (didx: number, newVal?: boolean) => {
  if (didx == -1) client.value.resetDiceSelect();
  if (newVal == undefined) client.value.diceSelect.forEach((_, i, a) => a[i] = i == didx);
  else client.value.diceSelect[didx] = newVal;
}
// 切换旁观人
const lookonTo = (idx: number) => {
  client.value.lookonTo(idx);
};
// 添加AI
const addAI = () => {
  socket.emit('addAI');
  hasAI.value = true;
};
// 移除AI
const removeAI = () => {
  socket.emit('removeAI');
  hasAI.value = false;
};

const getPlayerList = ({ plist }: { plist: Player[] }) => {
  const me = plist.find(p => p.id == userid);
  if (me?.rid == -1) router.back();
};
onMounted(() => {
  socket.emit('roomInfoUpdate', { roomId });
  socket.on('getServerInfo', data => client.value.getServerInfo(data));
  socket.on('getPlayerAndRoomList', getPlayerList);
});

onUnmounted(() => {
  socket.off('roomInfoUpdate');
  socket.off('getServerInfo');
  socket.off('getPlayerAndRoomList', getPlayerList);
});

// dev
let prodEnv = 0;
const maskOpacity = ref<number>(0.7);
// const isOpenMask = ref<boolean>(true);
const isOpenMask = ref<boolean>(false);
const devOps = (cidx = 0) => {
  if (client.value.phase < 5 || !isDev && ++prodEnv < 3) return;
  let opses = prompt(isDev ? '摸牌id/#骰子/@充能/%血量/&附着/=状态/-弃牌/+加牌:' : '');
  let rid = roomId;
  let seed = 0;
  if (opses?.startsWith('--')) {
    const opacity = +opses.slice(2);
    if (opacity == 1) isOpenMask.value = false;
    else {
      if (opacity > 0) maskOpacity.value = opacity;
      isOpenMask.value = opacity > 0 || !isOpenMask.value;
    }
    opses = null;
  }
  if (!isDev) {
    if (!opses?.startsWith('-r')) return;
    rid = parseInt(opses.slice(2));
    opses = opses.slice(opses.match(/-r\d+/)![0].length);
    if (!opses?.startsWith('-s')) return;
    seed = parseInt(opses.slice(2));
    opses = opses.slice(opses.match(/-s\d+/)![0].length);
    prodEnv = 0;
  }
  if (!opses) return;
  const ops = opses.trim().split(/[,，\.\/、]+/).filter(v => v != '');
  const cpidx = client.value.playerIdx ^ cidx;
  const heros = client.value.players[cpidx].heros;
  let dices: DiceCostType[] | undefined;
  let flag = new Set<string>();
  let disCardCnt = 0;
  const cmds: Cmds[] = [];
  const attachs: { hidx: number, el: number, isAdd: boolean }[] = [];
  const hps: { hidx: number, hp: number }[] = [];
  const clearSts: { hidx: number, stsid: number }[] = [];
  const smnIds: number[] = [];
  const sptIds: number[] = [];
  const h = (v: string) => (v == '' ? undefined : Number(v));
  for (let op of ops) {
    const index = op.indexOf(' ');
    if (index > -1) {
      ops.push(op[0] + op.slice(index + 1).trim());
      op = op.slice(0, index).trim();
    }
    if (op.startsWith('log')) { // 导出日志
      flag.add('log');
    } else if (op.startsWith('&')) { // 附着
      const isAdd = op[1] == '+';
      const [el = 0, hidx = heros.findIndex(h => h.isFront)] = op.slice(isAdd ? 2 : 1).split(/[:：]+/).map(h);
      attachs.push({ hidx, el, isAdd });
      flag.add('setEl');
    } else if (op.startsWith('%')) { // 血量
      const [hp = 10, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      hps.push({ hidx, hp });
      flag.add('setHp');
    } else if (op.startsWith('@')) { // 充能
      const [cnt = 3, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      cmds.push({ cmd: 'getEnergy', cnt, hidxs: hidx > 2 ? new Array(heros.length).fill(0).map((_, i) => i) : [hidx] });
      flag.add('setEnergy');
    } else if (op.startsWith('#')) { // 骰子
      if (op[1] == '-') {
        dices = client.value.players[cpidx].dice.slice(0, -op.slice(2));
        flag.add('reduceDice');
      } else {
        const [cnt = 16, el = 0] = op.slice(1).split(/[:：]+/).map(h);
        cmds.push({ cmd: 'getDice', cnt, element: DICE_COST_TYPE_CODE_KEY[el as DiceCostTypeCode] });
        flag.add('getDice');
      }
    } else if (op.startsWith('-')) { // 弃牌
      if (isNaN(+op)) {
        const rest = op.slice(1);
        const midx = rest.indexOf('m');
        const cidx = rest.indexOf('c');
        const cdidx = rest.indexOf('cd');
        const hidx = rest.indexOf('h');
        const mode = midx == -1 ? 0 : (parseInt(rest.slice(midx + 1)) || 0);
        const cnt = cidx == -1 ? 1 : (parseInt(rest.slice(cidx + 1)) || 1);
        const card = cdidx == -1 ? undefined : (parseInt(rest.slice(cdidx + 2)) || undefined);
        const hidxs = hidx == -1 ? undefined : (parseInt(rest.slice(cdidx + 1)) || undefined)?.toString().split('').map(Number) || undefined;
        const dcmds: Cmds[] = [{ cmd: 'discard', mode, cnt, card, hidxs }];
        cmds.push(...dcmds);
      } else {
        disCardCnt = +op;
      }
      flag.add('disCard');
    } else if (op.startsWith('=')) { // 状态
      const [stsid = 0, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      if (stsid <= 0) {
        clearSts.push({ hidx, stsid });
      } else {
        cmds.push({ cmd: 'getStatus', hidxs: hidx > 2 ? new Array(heros.length).fill(0).map((_, i) => i) : [hidx], status: stsid });
      }
      flag.add('setStatus');
    } else if (op.startsWith('+')) { // 在牌库中加牌
      const rest = op.slice(1);
      const cid = parseInt(rest);
      const cidx = rest.indexOf('c');
      const aidx = rest.indexOf('a');
      const hidx = rest.indexOf('h');
      const isAttach = !!(aidx == -1 ? 0 : (parseInt(rest.slice(aidx + 1)) || 0));
      const cnt = cidx == -1 ? 1 : (parseInt(rest.slice(cidx + 1)) || 1);
      const hidxs = hidx == -1 ? undefined : (parseInt(rest.slice(hidx + 1)) || undefined)?.toString().split('```').map(Number) || undefined;
      flag.add('addCard');
      cmds.push({ cmd: 'addCard', card: cid, isAttach, cnt, hidxs });
    } else if (op.startsWith('m')) { // 召唤物
      const rest = op.slice(1);
      smnIds.push(+rest);
      flag.add('setSummon');
    } else if (op.startsWith('p')) { // 支援物
      const rest = op.slice(1);
      sptIds.push(+rest);
      flag.add('setSupport');
    } else { // 摸牌
      const cards: (number | Card)[] = [];
      const isAttach = op.endsWith('~');
      const [cid = -1, cnt = 1] = op.slice(0, isAttach ? -1 : undefined).split('*').map(h);
      if (cid != -1) cards.push(...new Array(cnt).fill(cid || getTalentIdByHid(heros[client.value.players[cpidx].hidx].id)));
      cmds.push({ cmd: 'getCard', cnt, card: cards, isAttach });
      flag.add('getCard');
    }
  }
  socket.emit('sendToServerDev', { cpidx, rid, seed, dices, cmds, attachs, hps, clearSts, smnIds, sptIds, disCardCnt, flag: 'dev-' + [...flag].join('&') });
};
</script>

<style scoped>
body {
  user-select: none;
}

.container {
  width: 100%;
  height: 95vh;
  background-color: #aed1c8;
  background: url(@@/image/desk-bg.png);
  background-size: cover;
  background-position: center center;
  position: relative;
  user-select: none;
  overflow: hidden;
}

.player-info {
  position: absolute;
  right: 0;
  top: 0;
  width: 30%;
  height: 20px;
  color: white;
}

.hand-card {
  display: flex;
  flex-direction: row;
  justify-content: center;
  position: absolute;
  left: 30%;
  background-color: red;
  bottom: 95px;
  font-size: medium;
}

.card.selected {
  transform: translateY(-15px);
}

.skills {
  position: absolute;
  height: 20%;
  bottom: 0;
  right: 5%;
  pointer-events: none;
}

.skill {
  position: relative;
  display: inline-flex;
  width: 50px;
  flex-wrap: wrap;
  justify-content: center;
  margin-right: 5px;
  pointer-events: auto;
}

.skill-will {
  z-index: 5;
}

.skill-vehicle {
  width: 38px !important;
  height: 38px !important;
}

.skill3-bg {
  position: absolute;
  width: 108%;
  height: 108%;
  border-radius: 50%;
}

.skill-btn {
  position: relative;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background-color: #efbb61;
  border: 2px solid #9b8868;
  margin-bottom: 5px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fceacf;
  font-weight: bolder;
  font-size: medium;
  cursor: pointer;
  box-sizing: border-box;
}

.skill-img {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.skill-forbidden {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: #7e5f2ab9;
}

.switch-button {
  width: 55px;
  height: 55px;
  background-image: url(@@/image/Select_Replace.png);
  background-size: cover;
}

.switch-button:hover {
  cursor: pointer;
  filter: brightness(1.2);
}

.switch-button:active {
  transform: translateY(2px);
}

.quick-action {
  text-align: center;
  color: #fff581;
  font-weight: bold;
  margin-bottom: 5px;
}

.skill-cost {
  width: 17px;
  height: 17px;
  border-radius: 40%;
  margin: 0 2px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-weight: bolder;
  font-size: medium;
  -webkit-text-stroke: 1px black;
}

.cost-img {
  position: absolute;
  width: 25px;
  height: 25px;
}

.cost-img.hcard {
  width: 30px;
  height: 30px;
}

.menu {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.start {
  padding: 5px;
  background-color: #0077ff;
  border-radius: 5px;
  width: 200px;
  height: 50px;
  font-size: larger;
  margin-bottom: 3%;
  user-select: none;
  cursor: pointer;
  border: 4px outset #0053b1;
  z-index: 5;
}

.deck-open {
  padding: 5px;
  background-color: #0077ff;
  border-radius: 5px;
  width: 200px;
  height: 50px;
  font-size: larger;
  margin-bottom: 3%;
  user-select: none;
  cursor: pointer;
  border: 4px outset #0053b1;
  z-index: 5;
}

.start:hover,
.deck-open:hover {
  background-color: #016ce7;
}

.start:active,
.deck-open:active {
  background-color: #004a9e;
  border: 4px inset #0053b1;
}

.warn {
  padding: 0 5%;
  color: red;
  margin-bottom: 1%;
  background: linear-gradient(to right, transparent, #feb4b4 50%, transparent);
}

.exit {
  position: absolute;
  top: 0;
  left: 0;
  border: 5px outset orange;
  background-color: #be7b00;
  border-radius: 5px;
  cursor: pointer;
  z-index: 6;
}

.exit:hover {
  background-color: #e0aa46;
  border: 5px outset #ffd27e;
}

.exit:active {
  border: 5px inset orange;
}

[class*='player-display'] {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100px;
  height: 150px;
  border: 2px solid black;
  border-radius: 5px;
}

.player-display {
  position: absolute;
  left: 10px;
  bottom: 10px;
  background-color: #e0b97e;
}

.player-display-oppo {
  position: absolute;
  top: 10px;
  right: 10px;
  min-height: 100px;
  background-color: #63a0e6;
}

.rest-card {
  border: 2px solid black;
  border-radius: 5px;
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  bottom: 5px;
  left: 5px;
  background-color: #00000042;
  /* background-color: #5f7b9c; */
  color: white;
}

.curr-player {
  box-shadow: 4px 4px 6px #ffeb56, -4px 4px 6px #ffeb56, 4px -4px 6px #ffeb56,
    -4px -4px 6px #ffeb56;
}

.legend {
  position: absolute;
  right: -10px;
  top: -10px;
}

.legend-oppo {
  position: absolute;
  left: -10px;
  top: -10px;
}

.tip {
  position: absolute;
  height: 30px;
  width: 95%;
  top: 40%;
  color: black;
  pointer-events: none;
  background-image: linear-gradient(to left,
      transparent 0%,
      #ad56006c 35%,
      #ad56006c 50%,
      #ad56006c 65%,
      transparent 100%);
  transition: 1s;
  text-align: center;
  line-height: 30px;
  font-weight: bolder;
  font-size: medium;
  z-index: 20;
}

.tip-enter {
  transform: translateY(-10px);
}

.tip-leave {
  opacity: 0;
}

.modal-action {
  position: absolute;
  top: 40px;
  max-width: 20%;
  min-height: 10%;
  padding: 10px;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: 1s;
  color: white;
  background-color: #254162b9;
  border: 5px solid #1c3149b9;
  border-radius: 10px;
  z-index: 2;
}

.modal-action-my {
  left: 20px;
}

.modal-action-oppo {
  right: 20px;
}

.modal-action-leave {
  opacity: 0;
}

.btn-group {
  position: absolute;
  bottom: 10%;
  width: 25%;
  right: 5%;
  display: flex;
  justify-content: space-evenly;
  z-index: 5;
}

.btn-group button {
  background-color: #ffe122;
  border: 3px outset #e1c300;
  border-radius: 5px;
  cursor: pointer;
  padding: 3px 15px;
}

.btn-group button:active {
  background-color: #d0b81d;
  border: 3px inset #e1c300;
}

.btn-group .forbidden {
  background-color: #a8a8a8 !important;
  border: 3px outset #bdbdbd !important;
}

.win-banner {
  position: absolute;
  left: 50%;
  top: 20%;
  transform: translate(-50%, -50%);
  text-shadow: 4px 4px 4px #ffca5f, 4px 0px 4px #ffca5f, -4px -4px 4px #ffca5f,
    -4px 0px 4px #ffca5f, 4px -4px 4px #ffca5f, 0px -4px 4px #ffca5f,
    -4px 4px 4px #ffca5f, 0px 4px 4px #ffca5f;
}

.offline {
  width: 20px;
  height: 30px;
  position: absolute;
  bottom: 3px;
  right: 5px;
}

.lookon {
  width: 30px;
  height: 20px;
  position: absolute;
  left: 50%;
  top: 40px;
  transform: translateX(-50%);
  cursor: pointer;
  z-index: 6;
}

.debug-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #dedede;
  z-index: 50;
  pointer-events: none;
}

.willskill-mask {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 4;
  width: 100%;
  height: 100%;
  background-color: #0000006c;
  pointer-events: none;
}

.ai-btn {
  cursor: pointer;
  padding-top: 20px;
  z-index: 2;
}

.error {
  color: red;
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
}

@media screen and (orientation: portrait) {
  .container {
    height: 95vw;
    width: 95vh;
    transform-origin: 0 0;
    transform: rotateZ(90deg) translateY(-100%);
  }

  [class*='player-display'] {
    width: 70px;
    height: 100px;
  }

  .btn-group button {
    font-size: 12px;
    padding: 3px 12px;
  }

  .rest-card {
    width: 16px;
    height: 16px;
    bottom: 3px;
    left: 3px;
  }

  .hand-pile.oppo {
    transform: translate(-30px, 108px);
  }

  .win-banner {
    top: 20%;
  }
}

.mobile-container {
  font-size: 12px;
}

.mobile-player-display {
  width: 70px;
  height: 100px;
}

.mobile-hand-card {
  bottom: 70px;
  font-size: medium;
}

.mobile-rest-card {
  width: 16px;
  height: 16px;
  bottom: 3px;
  left: 3px;
}

.hand-pile.mobile-oppo {
  transform: translate(-30px, 108px);
}

.mobile-btn-group button {
  font-size: 12px;
  padding: 3px 12px;
}

.mobile-win-banner {
  top: 20%;
}

::-webkit-scrollbar {
  width: 5px;
  height: 5px;
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border-radius: 5px;
  background: #8caee1d0;
}

::-webkit-scrollbar-track {
  background: transparent;
}
</style>
