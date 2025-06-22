<template>
  <div class="container" :class="{ 'mobile-container': isMobile }" @click.stop="cancel">
    <button v-if="!client.isStart || isLookon > -1 || hasAI || roomId < -1" class="exit" @click.stop="exit">
      返回
    </button>
    <div style="position: absolute;left: 60px;color: white;z-index: 6;">
      [{{ OFFLINE_VERSION.includes(version as OfflineVersion) ? '实体版' : '' }}{{ version }}]
      <span v-if="roomId > 0">房间号{{ roomId }}</span>
      <span v-else>回放</span>
      <u v-if="client.roomId > 0" @click.stop="sendLog" style="margin-left: 5px;cursor: pointer;">发送日志</u>
      <u v-if="client.recordData.actionLog.length && client.roomId > 0 && false" @click.stop="exportLog"
        style="margin-left: 5px;cursor: pointer;">导出录像数据</u>
    </div>
    <div class="lookon-count" v-if="client.watchers > 0">
      <img src="@@/svg/lookon.svg" alt="旁观人数" />
      <div>{{ client.watchers }}</div>
    </div>
    <button v-if="client.isStart && isLookon == -1 && client.phase >= PHASE.ACTION && roomId > 0" class="exit"
      @click.stop="giveup">
      投降
    </button>
    <div class="player-info">{{ client.player?.UI.info }}</div>

    <div class="menu" v-if="isLookon == -1 && client.phase <= PHASE.NOT_BEGIN && client.roomId > 0">
      <button class="start" @click.stop="startGame">
        {{ client.player?.phase == PHASE.NOT_READY ? '准备开始' : '取消准备' }}
      </button>
      <button v-if="isLookon == -1 && client.player?.phase == PHASE.NOT_READY" class="deck-open"
        @click.stop="enterEditDeck">
        查看卡组
      </button>
      <div class="warn" v-if="!client.isDeckCompleteValid.isValid && isLookon == -1">
        {{ client.isDeckCompleteValid.error }}
      </div>
      <div class="warn" v-if="!client.isDeckVersionValid.isValid && isLookon == -1">
        {{ client.isDeckVersionValid.error }}
      </div>
      <div class="curr-deck">
        <div class="hero-avatar">
          <div v-for="(hero, aidx) in currDeck.heros" :key="aidx" :style="{ backgroundColor: hero.elColor }">
            <img v-if="hero.avatar" :src="hero.avatar" />
            <span style="line-height: 60px;">{{ hero.name }}</span>
          </div>
        </div>
        当前卡组: <span class="deck-name">{{ currDeck.name }}</span>
      </div>
    </div>

    <div :class="{
      'player-display': true,
      'curr-player': client.player?.status == PLAYER_STATUS.PLAYING && client.phase <= PHASE.ACTION && client.phase >= PHASE.CHOOSE_HERO && client.isWin == -1,
      'mobile-player-display': isMobile,
    }" @click.stop="devOps()">
      <span v-if="isLookon > -1">旁观中......</span>
      <p>{{ client.player?.name }}</p>
      <div v-if="client.isWin > -1 || client.isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
        <StrokedText>{{ handCardsCnt[client.playerIdx] }}</StrokedText>
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
      <p class="ai-btn" v-if="!client.opponent?.name && isDev" style="color: aquamarine;" @click.stop="addAI">+添加bot</p>
      <p class="ai-btn" v-if="client.opponent.id == AI_ID && client.phase <= PHASE.NOT_BEGIN" style="color: red"
        @click.stop="removeAI">
        -删除bot
      </p>
      <strong v-if="client.opponent.id != -1 && client.opponent.phase == PHASE.NOT_READY" style="color: #ffbaba;">
        未准备
      </strong>
      <strong v-if="client.opponent.id != AI_ID && client.opponent.phase == PHASE.NOT_BEGIN" style="color: #eaff8d;">
        已准备
      </strong>
      <div v-if="client.isWin > -1 || client.isStart" class="rest-card" :class="{ 'mobile-rest-card': isMobile }">
        <StrokedText>{{ handCardsCnt[client.playerIdx ^ 1] }}</StrokedText>
      </div>
      <img v-if="client.opponent?.isOffline" src="@@/svg/offline.svg" class="offline" alt="断线..." />
      <img v-if="isLookon > -1 || client.roomId < -1" src="@@/svg/lookon.svg" class="lookon" alt="旁观"
        @click.stop="lookonTo(client.opponent?.pidx ?? -1)" />
      <img class="legend-oppo" :src="getDiceBgIcon('legend-empty')" />
      <img v-if="!client.opponent.playerInfo.isUsedLegend" class="legend-oppo" :src="getDiceBgIcon('legend')" />
    </div>

    <MainDesk v-if="client.phase >= PHASE.CHANGE_CARD || client.isWin > -1" :isMobile="isMobile" :canAction="canAction"
      :afterWinHeros="afterWinHeros" :isLookon="isLookon" :client="(client as GeniusInvokationClient)"
      :version="version" @select-change-card="selectChangeCard" @change-card="changeCard" @reroll="reroll"
      @select-hero="selectHero" @select-use-dice="selectUseDice" @select-support="selectCardSupport"
      @select-summon="selectCardSummon" @end-phase="endPhase" @show-history="showHistory"
      @update:dice-select="updateDiceSelect" @select-card-pick="selectCardPick" @pick-card="pickCard"
      @update:is-show-end-phase="updateIsShowEndPhase" />

    <div class="hand-card"
      v-if="((client.player?.phase ?? PHASE.NOT_READY) >= PHASE.CHOOSE_HERO && client.currSkill.id < 0 && client.isShowSwitchHero < 2) || client.isWin > -1"
      :class="{ 'mobile-hand-card': isMobile, 'skill-will': canAction && client.currSkill.id != -1 }"
      :style="client.handcardsGroupOffset">
      <Handcard v-for="(card, idx) in client.player.handCards" :key="`${card.entityId}-myhandcard`"
        :class="[{ selected: client.handcardsSelect == idx }, card.UI.class ?? '']" :card="card" :isMobile="isMobile"
        :style="{ left: `${client.handcardsPos[idx]}px` }" @click.stop="selectCard(idx)" @mouseenter="mouseenter(idx)"
        @mouseleave="mouseleave(idx)">
        <img :src="STATUS_ICON.DebuffCountered01" alt="" v-if="card.type == CARD_TYPE.Event && isNonEvent"
          style="position: absolute;top: 3%;width: 30%;opacity: 0.8;">
      </Handcard>
      <Handcard v-for="(card, idx) in client.player.UI.willGetCard.cards.filter(c => c.UI.class?.includes('over'))"
        :key="`${card.entityId}-myhandcard-over`" :card="card" :isMobile="isMobile" :class="card.UI.class ?? ''"
        :style="{ left: `${client.handcardsOverPos[idx]}px` }">
      </Handcard>
    </div>

    <div class="btn-group" v-if="client.isShowButton">
      <div class="forbidden-card"
        v-if="client.currCard.id > 0 && client.currCard.type == CARD_TYPE.Event && isNonEvent">
        <StrokedText stroke-color="red">此牌效果将被无效</StrokedText>
      </div>
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
          <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Any])" draggable="false" />
          <StrokedText :style="{ zIndex: 1, color: client.heroSwitchDiceColor }">
            {{ client.heroSwitchDice }}
          </StrokedText>
        </div>
      </div>
    </div>
    <div class="skills" v-else-if="client.isShowSkills">
      <div class="skill" :class="{ 'skill-will': canAction && client.currSkill.id == skill.id }"
        v-for="skill in client.skills" :key="skill.id">
        <div class="skill-btn" :class="{ 'skill-vehicle': skill.type == SKILL_TYPE.Vehicle }"
          @click.stop="useSkill(skill.id)" :style="{ boxShadow: skill.style.fullEnergy }">
          <img class="skill-bg" :src="getPngIcon('skill_btn_bg')" alt="" />
          <div class="skill3-bg" :style="{ background: skill.style.notFullEnergy }"></div>
          <img class="skill3-btn" v-if="skill.cost[2].cnt > 0" :src="getPngIcon('skill3_btn_bg')" alt="" />
          <img class="skill-img" :src="skill.UI.src" v-if="skill.UI.src.length > 0" :alt="SKILL_TYPE_ABBR[skill.type]"
            draggable="false" />
          <span v-else class="skill-img">{{ SKILL_TYPE_ABBR[skill.type] }}</span>
          <div class="skill-forbidden" v-if="skill.isForbidden" @click.stop="useSkill(skill.id, true)"></div>
          <img class="skill-forbidden-icon" v-if="skill.isForbidden && isLookon == -1" :src="getSvgIcon('forbidden')"
            alt="" />
        </div>
        <div class="skill-cost"
          v-for="(cost, cidx) in skill.cost.every(c => c.cnt <= 0) ? skill.cost.slice(0, 1) : skill.cost.filter(c => c.cnt > 0)"
          :key="cidx" :style="{ color: skill.style.costColors[cidx] }">
          <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[cost.type])" draggable="false" />
          <StrokedText style="z-index: 1">{{ skill.CurrCnts[cidx] }}</StrokedText>
        </div>
      </div>
    </div>

    <div class="record-control" v-if="client.roomId < 0">
      <div class="record-btn" :class="{ active: client.recordData.isPlaying }" @click.stop="playRecord">▶</div>
      <div class="record-btn" :class="{ active: !client.recordData.isPlaying }" @click.stop="puaseRecord">| |</div>
    </div>

    <InfoModal v-if="client.phase >= PHASE.CHANGE_CARD" :info="client.modalInfo" :isMobile="isMobile" isInGame
      :round="client.round" :playerInfo="client.player.playerInfo" style="z-index: 10" />

    <h1 v-if="client.isWin != -1 && client.players[client.isWin % PLAYER_COUNT]?.name" class="win-banner"
      :class="{ 'mobile-win-banner': isMobile }">
      <span v-if="client.isWin == -2">——无人获胜——</span>
      <span v-else> {{ client.players[client.isWin % PLAYER_COUNT]?.name }}获胜！！！</span>
    </h1>

    <h1 class="error" v-if="client.error != ''">{{ isDev ? client.error : '发生了错误' }}</h1>

    <div class="tip" :class="{ 'tip-enter': client.tip != '', 'tip-leave': client.tip == '' }">
      {{ client.tip }}
    </div>

    <div class="modal-action" :class="{
      'modal-action-my': !client.actionInfo.isOppo && client.actionInfo.isShow,
      'modal-action-oppo': client.actionInfo.isOppo && client.actionInfo.isShow,
      'modal-action-my-leave': !client.actionInfo.isOppo && !client.actionInfo.isShow,
      'modal-action-oppo-leave': client.actionInfo.isOppo && !client.actionInfo.isShow,
      'modal-action-gradient': !client.actionInfo.card,
    }">
      <div class="modal-action-content" v-if="client.actionInfo.content != ''">
        <img v-if="client.actionInfo.avatar" :src="client.actionInfo.avatar" alt="">
        <div class="modal-action-content-info">
          <div style="font-size: 1.2em;">{{ client.actionInfo.content }}</div>
          <div v-if="client.actionInfo.subContent" style="color: #f4dca2;">{{ client.actionInfo.subContent }}</div>
        </div>
      </div>
      <Handcard v-if="client.actionInfo.card" style="position: relative;margin-top: 10px;"
        :card="client.actionInfo.card" :isMobile="isMobile" isHideCost>
      </Handcard>
    </div>
    <div class="willskill-mask" v-if="client.player.status == PLAYER_STATUS.PLAYING &&
      (client.currSkill.id != -1 ||
        client.summonCanSelect.some(s => s.some(s => s)) ||
        client.supportCanSelect.some(s => s.some(s => s)) ||
        client.isShowSwitchHero >= 2 ||
        client.willHp.some(v => v != undefined) ||
        client.changedSummons.some(s => s.some(s => s)) ||
        client.changedHeros.some(h => h.some(h => h)))">
    </div>
    <div class="debug-mask" v-if="isOpenMask" :style="{ opacity: maskOpacity }"></div>

  </div>
</template>

<script setup lang='ts'>
import type { Socket } from 'socket.io-client';
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Handcard from '@/components/Card.vue';
import InfoModal from '@/components/InfoModal.vue';
import MainDesk from '@/components/MainDesk.vue';
import StrokedText from '@/components/StrokedText.vue';
import GeniusInvokationClient from '@/geniusInovakationClient';
import { getSocket } from '@/store/socket';
import {
  ACTION_TYPE,
  CARD_TYPE,
  COST_TYPE,
  DICE_COST_TYPE_CODE_KEY,
  DiceCostType,
  DiceCostTypeCode,
  ELEMENT_TYPE,
  OFFLINE_VERSION,
  OfflineVersion,
  PHASE,
  PLAYER_STATUS,
  SKILL_TYPE,
  STATUS_TYPE,
  Version
} from '@@@/constant/enum';
import { AI_ID, PLAYER_COUNT } from '@@@/constant/gameOption';
import { ELEMENT_COLOR, ELEMENT_ICON, SKILL_TYPE_ABBR, STATUS_ICON } from '@@@/constant/UIconst';
import { parseHero } from '@@@/data/heros';
import { getTalentIdByHid } from '@@@/utils/gameUtil';
import { debounce, isCdt, parseShareCode } from '@@@/utils/utils';
import { Card, Cmds, Hero, Player } from '../../../typing';

const router = useRouter();
const route = useRoute();

const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
const { players: cplayers, version: cversion, isLookon: cisLookon, countdown, follow, isDev } = history.state;
const socket: Socket = getSocket(isDev);

const userid = Number(localStorage.getItem('7szh_userid') || '-1'); // 玩家id
const roomId: number = +route.params.roomId; // 房间id
const version = ref<Version>(cversion); // 版本
const isLookon = ref<number>(cisLookon ? (follow ?? Math.floor(Math.random() * PLAYER_COUNT)) : -1); // 是否旁观
const client = ref<GeniusInvokationClient>(new GeniusInvokationClient(
  socket, roomId, userid, version.value,
  cplayers, isMobile.value, countdown, isDev,
  JSON.parse(localStorage.getItem('GIdecks') || '[]'),
  Number(localStorage.getItem('GIdeckIdx') || '0'), isLookon.value
));

const handCardsCnt = computed<number[]>(() => client.value.handCardsCnt); // 双方手牌数
const canAction = computed<boolean>(() => client.value.canAction && isLookon.value == -1); // 是否可以操作
const isNonEvent = computed<boolean>(() => client.value.player.combatStatus.some(s => s.type.includes(STATUS_TYPE.NonEvent))); // 是否使事件牌失效
const currDeck = computed(() => { // 当前出战卡组
  const deck = client.value.decks[client.value.editDeckIdx];
  const { heroIds } = parseShareCode(deck.shareCode);
  return {
    name: deck.name,
    heros: heroIds.map(hid => {
      const hero = parseHero(hid);
      return { avatar: hero.UI.avatar, elColor: ELEMENT_COLOR[hero.element], name: hero.name }
    }),
  }
});
const afterWinHeros = ref<Hero[][]>([]); // 游戏结束后显示的角色信息
const hasAI = ref<boolean>(false); // 是否有AI

// 获取骰子背景
const getDiceBgIcon = (name: string) => {
  return `/image/${name}-dice-bg.png`;
};

// 获取png图片
const getPngIcon = (name: string) => {
  if (name.startsWith('http')) return name;
  return `/image/${name}.png`;
};

// 获取svg图片
const getSvgIcon = (name: string) => {
  return `/svg/${name}.svg`;
};

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
  router.push({ name: 'editDeck', state: { maskOpacity: isOpenMask.value ? maskOpacity.value : 0 } });
};
// 返回
const exit = () => {
  socket.emit('exitRoom');
};
// 发送日志
const sendLog = () => {
  if (client.value.phase <= PHASE.NOT_BEGIN || isLookon.value != -1) return;
  const description = prompt('发生了什么问题');
  if (description != null) {
    socket.emit('sendLog', { roomId, description });
    alert('日志已发送');
  }
}
// 导出行动日志
const exportLog = () => {
  if (client.value.recordData.actionLog.length == 0) return;
  const blob = new Blob([JSON.stringify(client.value.recordData)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `game${version.value.replace(/\./g, '_')}-r${roomId}.gi`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  client.value.recordData.actionLog = [];
}
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
const selectCardSummon = (pidx: number, suidx: number) => {
  client.value.selectCardSummon(pidx, suidx);
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
const useSkill = (skid: number, isOnlyRead?: boolean) => {
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
// 更新isShowEndPhase
const updateIsShowEndPhase = (newVal: boolean) => {
  client.value.isShowEndPhase = newVal;
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
// 播放录像
const playRecord = () => {
  client.value.recordData.isPlaying = true;
  socket.emit('sendToServer', { type: ACTION_TYPE.PlayRecord, flag: 'playRecord' });
}
// 暂停录像
const puaseRecord = () => {
  client.value.recordData.isPlaying = false;
  socket.emit('sendToServer', { type: ACTION_TYPE.PuaseRecord, flag: 'puaseRecord' });
}

const getPlayerList = ({ plist }: { plist: Player[] }) => {
  const me = plist.find(p => p.id == userid);
  if ((me?.rid ?? -1) == -1) router.back();
};
onMounted(async () => {
  client.value.initSelect();
  socket.emit('roomInfoUpdate', { roomId, pidx: isCdt(isLookon.value > -1, isLookon.value) });
  socket.on('getServerInfo', data => client.value.getServerInfo(data));
  socket.on('getPlayerAndRoomList', getPlayerList);
  socket.on('updatePlayers', players => client.value.players = players);
  socket.on('updateSocketRoom', () => socket.emit('updateSocketRoom'));
  socket.on('error', err => {
    console.error(err);
    client.value.setError(err);
  });
  // socket.on('getHeartBreak', () => socket.emit('sendHeartBreak'));
});

onUnmounted(() => {
  socket.removeAllListeners();
});

// dev
let prodEnv = 0;
const maskOpacity = ref<number>(0.7);
// const isOpenMask = ref<boolean>(true);
const isOpenMask = ref<boolean>(false);
const devOps = (cidx = 0) => {
  if ((client.value.phase < PHASE.DICE && client.value.phase != 0) || (!isDev && ++prodEnv < 3)) return;
  let opses = prompt(isDev ? '摸牌id/#骰子/@充能/%血量/&附着/=状态/-弃牌/+加牌:' : '');
  let rid = roomId;
  let seed: string = '';
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
    seed = parseInt(opses.slice(2)).toString();
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
  const setStsCnt: { hidx: number, stsid: number, type: string, val: number }[] = [];
  const setSmnCnt: { smnidx: number, type: string, val: number }[] = [];
  const setSptCnt: { sptidx: number, type: string, val: number }[] = [];
  const smnIds: number[] = [];
  const sptIds: number[] = [];
  const h = (v: string) => (v == '' ? undefined : Number(v));
  for (let op of ops) {
    const index = op.indexOf(' ');
    if (index > -1) {
      ops.push(op[0] + op.slice(index + 1).trim());
      op = op.slice(0, index).trim();
    }
    if (op.startsWith('seed')) { // 设置种子
      seed = op.slice(4).trim();
      flag.add('seed');
    } else if (op.startsWith('log')) { // 导出日志
      flag.add('log');
    } else if (op.startsWith('&')) { // 附着
      const isAdd = op[1] == '+';
      const [el = 0, hidx = heros.findIndex(h => h.isFront)] = op.slice(isAdd ? 2 : 1).split(/[:：]+/).map(h);
      attachs.push({ hidx, el, isAdd });
      flag.add('setEl');
    } else if (op.startsWith('%')) { // 血量
      let [hp, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      if (hidx > heros.length) {
        for (let i = 0; i < heros.length; ++i) {
          const chp = hp || heros[i].maxHp;
          hps.push({ hidx: i, hp: chp });
        }
      } else {
        hp ||= heros[hidx].maxHp;
        hps.push({ hidx, hp });
      }
      flag.add('setHp');
    } else if (op.startsWith('@')) { // 充能
      const isSpEnergy = op[1] == '@';
      const [cnt = 6, hidx = heros.findIndex(h => h.isFront)] = op.slice(isSpEnergy ? 2 : 1).split(/[:：]+/).map(h);
      cmds.push({ cmd: 'getEnergy', cnt, isAttach: isSpEnergy, hidxs: hidx > 2 ? new Array(heros.length).fill(0).map((_, i) => i) : [hidx] });
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
        const hidxs = hidx == -1 ? undefined : (parseInt(rest.slice(hidx + 1)) || 0)?.toString().split('').map(Number) || undefined;
        const dcmds: Cmds[] = [{ cmd: 'discard', mode, cnt, card, hidxs }];
        cmds.push(...dcmds);
      } else {
        disCardCnt = +op;
      }
      flag.add('disCard');
    } else if (op.startsWith('=')) { // 状态
      const isSetCnt = op[1] == '+';
      const setType = op[2];
      const [stsid = 0, hidx = heros.findIndex(h => h.isFront), val = 0] = op.slice(isSetCnt ? 3 : 1).split(/[:：]/).map(h);
      if (isSetCnt) {
        setStsCnt.push({ hidx, stsid, type: setType, val });
      } else if (stsid <= 0) {
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
      const isSetCnt = op[1] == '+';
      const setType = op[2];
      const [smnid = 0, val = 0] = op.slice(isSetCnt ? 3 : 1).split(/[:：]+/).map(h);
      if (isSetCnt) setSmnCnt.push({ smnidx: smnid, type: setType, val });
      else smnIds.push(smnid);
      flag.add('setSummon');
    } else if (op.startsWith('p')) { // 支援物
      const isSetCnt = op[1] == '+';
      const setType = op[2];
      const [sptid = 0, val = 0] = op.slice(isSetCnt ? 3 : 1).split(/[:：]+/).map(h);
      if (isSetCnt) setSptCnt.push({ sptidx: sptid, type: setType, val });
      else sptIds.push(sptid);
      flag.add('setSupport');
    } else if (op.startsWith('q')) { // 附属装备
      const [card = 0, hidx = heros.findIndex(h => h.isFront)] = op.slice(1).split(/[:：]+/).map(h);
      const hidxs = hidx > heros.length ? heros.map(h => h.hidx) : [hidx];
      cmds.push({ cmd: 'equip', hidxs, card: card || getTalentIdByHid(heros[hidx].id) });
      flag.add('equip');
    } else { // 摸牌
      const cards: (number | Card)[] = [];
      const isAttach = op.endsWith('~');
      const [cid = -1, cnt = 1] = op.slice(0, isAttach ? -1 : undefined).split('*').map(h);
      if (cid != -1) cards.push(...new Array(cnt).fill(cid || getTalentIdByHid(heros[client.value.players[cpidx].hidx].id)));
      cmds.push({ cmd: 'getCard', cnt, card: cards, isAttach });
      flag.add('getCard');
    }
  }
  socket.emit('sendToServerDev', {
    cpidx, rid, seed, dices, cmds, attachs, hps, clearSts, setStsCnt, setSmnCnt, setSptCnt,
    smnIds, sptIds, disCardCnt, flag: 'dev-' + [...flag].join('&'),
  });
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
  font-family: HYWH;
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
  bottom: 95px;
  font-size: medium;
  z-index: 1;
  transition: .3s;
}

.card.selected {
  filter: brightness(1.2);
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
  width: 107%;
  height: 107%;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.skill3-btn {
  position: absolute;
  width: 110%;
  height: 110%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.skill-btn {
  position: relative;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  /* background-color: #efbb61;
  border: 2px solid #9b8868; */
  margin-bottom: 5px;
  color: #fceacf;
  font-weight: bolder;
  font-size: medium;
  cursor: pointer;
  box-sizing: border-box;
}

.skill-btn:hover {
  filter: brightness(1.05);
}

.skill-btn:active {
  filter: brightness(1.1);
}

.skill-bg {
  position: absolute;
  width: 110%;
  height: 110%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.skill-img {
  position: absolute;
  width: 80%;
  height: 80%;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  text-align: center;
  align-content: center;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.skill-forbidden {
  position: absolute;
  width: 85%;
  height: 85%;
  border-radius: 50%;
  background-color: #7e5f2ab9;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
}

.skill-forbidden-icon {
  position: absolute;
  width: 40%;
  height: 40%;
  filter: brightness(1.5);
  right: -5%;
  bottom: -5%;
  background: #644828;
  border-radius: 50%;
  padding: 5%;
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

.forbidden-card {
  position: absolute;
  color: #fda3a3;
  top: -100%;
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
  font-size: medium;
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

.record-control {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  height: 70px;
  width: 30px;
  bottom: 1%;
  right: 1%;
  background-color: #a16c41;
  border-radius: 10px;
  border: #cb8a53 3px solid;
  z-index: 6;
}

.record-btn {
  cursor: pointer;
}

.record-btn:hover {
  color: #fed691;
}

.record-btn.active {
  color: #ffbe4d;
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

button {
  font-family: HYWH;
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

.curr-deck {
  position: absolute;
  right: 10px;
  bottom: 10px;
  color: white;
  text-align: center;
}

.hero-avatar {
  width: 200px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.hero-avatar>div {
  width: 30%;
  filter: drop-shadow(0 0 2px white);
  aspect-ratio: 1/1;
  border-radius: 50%;
  overflow: hidden;
}

.hero-avatar img {
  width: 100%;
  height: 100%;
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
  height: 120px;
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
  max-width: 30%;
  min-height: 10%;
  padding: 10px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: .5s;
  color: white;
  background-color: #254162;
  border: 3px solid #1c3149;
  border-radius: 10px;
  z-index: 6;
}

.modal-action-my {
  left: 20px;
  opacity: 1;
}

.modal-action-oppo {
  right: 20px;
  opacity: 1;
}

.modal-action-my-leave {
  left: 0;
  opacity: 0;
}

.modal-action-oppo-leave {
  right: 0;
  opacity: 0;
}

.modal-action-content {
  display: flex;
}

.modal-action-content>img {
  width: 15%;
  height: 15%;
  margin-right: 10px;
}

.modal-action-content-info {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
}

.modal-action-gradient {
  background: linear-gradient(to right, #254162 40%, #2c76ca);
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

.lookon-count {
  position: absolute;
  left: 60px;
  top: 1.2em;
  color: white;
  display: flex;
  flex-direction: row;
  align-items: center;
  z-index: 6;
}

.lookon-count>img {
  width: 30px;
  height: 20px;
  filter: grayscale(1) brightness(10);
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
    height: 70px;
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
  height: 70px;
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

.will-getcard-my-pile {
  animation: getcard-my-pile 1.5s linear forwards;
}

@keyframes getcard-my-pile {
  0% {
    transform: perspective(500px) translate(-1000%, -100%) rotate(90deg) rotateY(180deg);
  }

  40% {
    transform: translateY(-50vh) rotateY(180deg);
  }

  60% {
    transform: translateY(-50vh);
  }

  80% {
    transform: translateY(-50vh);
  }
}

.will-getcard-my-generate {
  animation: getcard-my-generate 1.5s linear forwards;
}

@keyframes getcard-my-generate {
  0% {
    transform: translateY(-50vh);
    opacity: 0;
  }

  40% {
    transform: translateY(-50vh);
    opacity: 1;
  }

  75% {
    transform: translateY(-50vh);
  }
}

.will-getcard-my-pile-over {
  animation: getcard-my-pile-over 1.5s linear forwards;
}

@keyframes getcard-my-pile-over {
  0% {
    transform: perspective(500px) translate(-1000%, -100%) rotate(90deg) rotateY(180deg);
    opacity: 1;
  }

  40% {
    transform: translateY(-50vh);
    opacity: 1;
  }

  85% {
    transform: translateY(-50vh);
    opacity: 1;
  }

  100% {
    transform: translateY(-50vh);
    opacity: 0;
  }
}

.will-getcard-my-generate-over {
  animation: getcard-my-generate-over 1.5s linear forwards;
}

@keyframes getcard-my-generate-over {
  0% {
    transform: translateY(-50vh);
    opacity: 0;
  }

  40% {
    transform: translateY(-50vh);
    opacity: 1;
  }

  85% {
    transform: translateY(-50vh);
    opacity: 1;
  }

  100% {
    transform: translateY(-50vh);
    opacity: 0;
  }
}

.will-discard-hcard-my {
  animation: discard-hcard-my 1.5s linear forwards;
}

@keyframes discard-hcard-my {
  40% {
    transform: translateY(-50vh);
    opacity: 1;
  }

  80% {
    transform: translateY(-50vh);
    opacity: 1;
  }

  100% {
    transform: translateY(-50vh);
    opacity: 0;
  }
}
</style>
