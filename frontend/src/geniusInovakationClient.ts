import type { Socket } from "socket.io-client";

import { ACTION_TYPE, CARD_SUBTYPE, ElementType, INFO_TYPE, PHASE, PLAYER_STATUS, Phase, SKILL_TYPE, Version } from "@@@/constant/enum";
import { DECK_CARD_COUNT, INIT_SWITCH_HERO_DICE, MAX_DICE_COUNT, MAX_STATUS_COUNT, MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT } from "@@@/constant/gameOption";
import { INIT_PLAYER, NULL_CARD, NULL_MODAL, NULL_SKILL } from "@@@/constant/init";
import {
    CHANGE_BAD_COLOR, CHANGE_GOOD_COLOR, ELEMENT_COLOR, HANDCARDS_GAP_MOBILE, HANDCARDS_GAP_PC, HANDCARDS_OFFSET_MOBILE,
    HANDCARDS_OFFSET_PC,
} from "@@@/constant/UIconst";
import { newSummon } from "@@@/data/summons";
import { checkDices } from "@@@/utils/gameUtil";
import { clone, isCdt, parseShareCode } from "@@@/utils/utils";
import {
    ActionData, Card, Countdown, DamageVO, Hero, InfoVO, PickCard, Player, Preview, ServerData, Skill, Summon,
} from "../../typing";

type DeckValid = {
    isValid: boolean,
    error: string,
}

export default class GeniusInvokationClient {
    socket: Socket;
    roomId: number; // 房间id
    userid: number; // 用户id
    version: Version; // 版本
    players: Player[]; // 所有玩家信息数组
    previews: Preview[] = []; // 预览效果
    isLookon: number; // 是否为观战玩家
    isValid: boolean = false; // 是否合法
    isStart: boolean = false; // 是否开始游戏
    isDeckEdit: boolean = false; // 是否进入编辑卡组界面
    phase: Phase = PHASE.NOT_BEGIN; // 阶段
    showRerollBtn: boolean = true; // 是否显示重投按钮
    isReconcile: boolean = false; // 是否进入调和模式
    willAttachs: ElementType[][] = []; // 将要附着的元素
    willHp: (number | undefined)[] = []; // 总共的血量变化
    damageVO: Exclude<DamageVO, -1> = this.resetDamageVO(); // 显示伤害
    isShowDmg: boolean = false; // 是否显示伤害数
    isShowSwitchHero: number = 0; // 是否显示切换角色按钮 0不显示 1显示 2显示且显示所需骰子 3显示且为快速行动
    isShowHistory: boolean = false; // 是否显示历史信息
    willSummons: Summon[][] = this._resetWillSummons(); // 将要召唤的召唤物
    willSwitch: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => []); // 是否将要切换角色
    supportCnt: number[][] = this._resetSupportCnt(); // 支援物变化数
    summonCnt: number[][] = this._resetSummonCnt(); // 召唤物变化数
    energyCnt: number[][]; // 充能变化数
    round: number = 1; // 回合数
    isWin: number = -1; // 胜者idx
    modalInfo: InfoVO = NULL_MODAL(); // 展示信息
    tip: string = ''; // 提示信息
    actionInfo: string = ''; // 行动信息
    currCard: Card = NULL_CARD(); // 当前选择的卡
    currSkill: Skill = NULL_SKILL(); // 当前选择的技能
    vehicleSkill: Skill | null = null; // 当前特技
    decks: { name: string, shareCode: string, version: Version }[] = [];
    deckIdx: number; // 出战卡组id
    editDeckIdx: number; // 当前编辑卡组idx
    isDeckVersionValid: DeckValid; // 卡组是否匹配版本
    isDeckCompleteValid: DeckValid; // 卡组是否完整
    countdown: Countdown = { curr: 0, limit: 0, timer: undefined }; // 倒计时配置
    log: string[] = []; // 当局游戏日志
    pileCnt: number[] = new Array(PLAYER_COUNT).fill(0); // 牌库数量
    diceCnt: number[] = new Array(PLAYER_COUNT).fill(0); // 骰子数量
    handCardsCnt: number[] = new Array(PLAYER_COUNT).fill(0); // 手牌数量
    isMobile: boolean; // 是否为手机
    diceSelect: boolean[]; // 骰子是否选中
    handcardsGap: number; // 手牌间隔
    handcardsOffset: number; // 手牌偏移
    handcardsPos: number[]; // 手牌位置
    handcardsSelect: number = -1; // 被选中的手牌序号
    reconcileValid: boolean[] = []; // 是否允许调和
    heroSelect: number[][] = Array.from({ length: PLAYER_COUNT }, () => []); // 角色是否选中
    heroCanSelect: boolean[]; // 角色是否可选
    heroSwitchDice: number = INIT_SWITCH_HERO_DICE; // 切换角色所需骰子数
    supportSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(false)); // 支援物是否选中
    supportCanSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(false)); // 支援物是否可选
    summonSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(false)); // 召唤物是否选中
    summonCanSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(false)); // 召唤物是否可选
    statusSelect: boolean[][][][] = Array.from({ length: PLAYER_COUNT }, () => Array.from({ length: 2 }, () => [])); // 状态是否发光
    slotSelect: boolean[][][] = Array.from({ length: PLAYER_COUNT }, () => []); // 装备是否发光
    pickModal: PickCard = { cards: [], selectIdx: -1, cardType: 'card', actionType: 'getCard', skillId: -1 }; // 挑选卡牌
    isDev: boolean; // 是否为开发模式
    error: string = ''; // 服务器发生的错误信息

    constructor(
        socket: Socket, roomId: number, userid: number, version: Version, players: Player[], isMobile: boolean, timelimit: number, isDev: boolean,
        decks: { name: string, shareCode: string, version: Version }[], deckIdx: number, isLookon: number
    ) {
        this.socket = socket;
        this.roomId = roomId;
        this.userid = userid;
        this.version = version;
        this.players = players;
        this.isLookon = isLookon;
        this.deckIdx = deckIdx;
        this.editDeckIdx = deckIdx;
        this.decks = decks;
        this.isMobile = isMobile;
        this.countdown.limit = timelimit;
        this.isDev = isDev;
        this.diceSelect = new Array(MAX_DICE_COUNT).fill(false);
        this.handcardsGap = isMobile ? HANDCARDS_GAP_MOBILE : HANDCARDS_GAP_PC;
        this.handcardsOffset = isMobile ? HANDCARDS_OFFSET_MOBILE : HANDCARDS_OFFSET_PC;
        this.handcardsPos = this.player.handCards.map((_, ci) => ci * this.handcardsGap);
        const { shareCode = 'null', version: ver } = this.decks[this.deckIdx] ?? {};
        const { heroIds, cardIds } = parseShareCode(shareCode);
        this.isDeckCompleteValid = {
            isValid: !heroIds.includes(0) && cardIds.length == DECK_CARD_COUNT,
            error: '当前出战卡组不完整',
        };
        this.isDeckVersionValid = {
            isValid: ver == version,
            error: '当前卡组版本不匹配',
        };
        this.heroCanSelect = (players[this.playerIdx]?.heros ?? []).map(() => false);
        this.energyCnt = players.map(p => p.heros.map(() => 0));
    }
    get playerIdx() { // 该玩家序号
        return this.isLookon > -1 ? this.isLookon : this.players.findIndex(p => p.id == this.userid);
    }
    get player() { // 本玩家
        return this.players[this.playerIdx] ?? INIT_PLAYER();
    }
    get rollCnt() { // 可重投的次数
        return this.player.rollCnt;
    }
    get opponent() { // 敌方玩家
        return this.players[this.playerIdx ^ 1] ?? INIT_PLAYER();
    }
    get canAction() {// 是否可以操作
        return this.player.canAction && this.tip == '' && this.actionInfo == '' && this.damageVO.dmgSource == 'null';
    }
    get heroSwitchDiceColor() { // 切换角色骰子颜色
        return this.heroSwitchDice > INIT_SWITCH_HERO_DICE ? CHANGE_BAD_COLOR :
            this.heroSwitchDice < INIT_SWITCH_HERO_DICE ? CHANGE_GOOD_COLOR : 'white';
    }
    get isShowSkills() { // 是否显示技能栏
        return this.phase >= PHASE.CHOOSE_HERO &&
            this.player.phase >= PHASE.CHOOSE_HERO &&
            this.getFrontHero().hp > 0;
    }
    get skills() { // 技能组
        const fhero = this.getFrontHero();
        if (fhero == undefined) return [];
        const skills = [...fhero.skills];
        if (fhero.vehicleSlot) skills.unshift(fhero.vehicleSlot[1]);
        return skills.filter(skill => skill.type != SKILL_TYPE.Passive).map(skill => {
            const elColor = ELEMENT_COLOR[skill.cost[0].type];
            const energyPer = fhero.energy / skill.cost[2].cnt * 100;
            const isValid = !!this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.skillId == skill.id)?.isValid;
            return {
                ...skill,
                isForbidden: skill.isForbidden || this.isLookon > -1 || !this.canAction || !isValid,
                CurrCnts: skill.cost.map((cost, cidx) => [cost.cnt, Math.max(cost.cnt - (cidx < 2 ? (skill.costChange[cidx] as number) : 0), 0)])
                    .filter(([c]) => c).map(([, c]) => c),
                isNotFullEnergy: skill.type == SKILL_TYPE.Burst && fhero.energy < skill.cost[2].cnt,
                style: {
                    fullEnergy: skill.type == SKILL_TYPE.Burst && fhero.energy >= skill.cost[2].cnt ? `0px 0px 8px 3px ${elColor}` : '',
                    notFullEnergy: `linear-gradient(to top, ${elColor} 0%, ${elColor} ${energyPer}%, transparent ${energyPer}%, transparent 100%)`,
                    costColors: skill.cost.map((cost, cidx) => ({
                        cnt: cost.cnt,
                        color: cidx < 2 && (skill.costChange[cidx] as number) > 0 ? CHANGE_GOOD_COLOR :
                            cidx < 2 && (skill.costChange[cidx] as number) < 0 ? CHANGE_BAD_COLOR : 'white'
                    })).filter(({ cnt }) => cnt).map(({ color }) => color),
                },
            }
        });
    }
    get isShowButton() {
        return this.isLookon == -1 &&
            (((this.player.status == PLAYER_STATUS.PLAYING && this.canAction && this.tip == '' && this.actionInfo == '' ||
                this.player.status == PLAYER_STATUS.DIESWITCH) &&
                this.player.phase >= PHASE.CHOOSE_HERO && (this.currCard.id > 0 || this.isShowSwitchHero > 0)) ||
                this.player.phase == PHASE.CHOOSE_HERO
            );
    }
    /**
     * 取消选择
     */
    cancel(options: { onlyCard?: boolean, notCard?: boolean, notHeros?: boolean, onlyHeros?: boolean, onlySupportAndSummon?: boolean } = {}) {
        const { onlyCard = false, notCard = false, notHeros = false, onlyHeros = false, onlySupportAndSummon = false } = options;
        this._resetWillHp();
        if (!onlyCard) {
            if ((!notHeros || onlyHeros) && !onlySupportAndSummon) {
                this._resetHeroSelect();
                this._resetHeroCanSelect();
                if (onlyHeros) return;
            }
            this._resetSummonSelect();
            this._resetSummonCanSelect();
            this._resetSupportSelect();
            this._resetSupportCanSelect();
            if (onlySupportAndSummon) return;
        }
        if (this.currCard.canSelectSupport != -1 && this.modalInfo.type != null) {
            this.modalInfo = NULL_MODAL()
            return;
        }
        if (this.isMobile && this.handcardsSelect > -1) {
            this.mouseleave(this.handcardsSelect, true);
        }
        if (!notCard) {
            this.handcardsSelect = -1;
        }
        if (onlyCard) return;
        this.modalInfo = NULL_MODAL();
        this.currCard = NULL_CARD();
        this.currSkill = NULL_SKILL();
        this._resetWillSwitch();
        this._resetWillSummons();
        this._resetSummonCnt();
        this._resetWillAttachs();
        this._resetSupportCnt();
        this._resetEnergyCnt();
        if (this.phase != PHASE.DICE && this.player.phase != PHASE.DICE) this.resetDiceSelect();
        this.isValid = false;
        this.isShowSwitchHero = 0;
        this.isShowHistory = false;
        this.isReconcile = false;
    }
    /**
     * 更新手牌位置
     */
    updateHandCardsPos() {
        this.handcardsPos = this.player.handCards.map((_, ci) => ci * this.handcardsGap);
    }
    /**
     * 展示选择卡的信息
     * @param idx 选择卡的索引idx
     * @param val 是否为选中
     */
    selectChangeCard(idx: number, val: boolean) {
        if (val) {
            this.modalInfo = {
                version: this.version,
                isShow: true,
                type: INFO_TYPE.Card,
                info: this.player.handCards[idx],
            }
        } else {
            this.modalInfo = NULL_MODAL();
        }
    }
    /**
     * 选择卡
     * @param cardIdx 选择的卡牌序号
     */
    selectCard(cardIdx: number) {
        if (this.phase < PHASE.CHANGE_CARD) return;
        if (this.player.status == PLAYER_STATUS.PLAYING) this.reconcile(false, cardIdx);
        this.currSkill = NULL_SKILL();
        this._resetWillSummons();
        this._resetSummonCnt();
        this._resetHeroSelect();
        this.isShowSwitchHero = 0;
        if (this.phase == PHASE.ACTION) {
            if (this.handcardsSelect != -1 && this.handcardsSelect != cardIdx && this.isMobile) this.mouseleave(this.handcardsSelect, true);
            this.handcardsSelect = this.handcardsSelect == cardIdx ? -1 : cardIdx;
            if (this.isMobile) {
                if (this.handcardsSelect == cardIdx) this.mouseenter(cardIdx, true);
                else this.mouseleave(cardIdx, true);
            }
        }
        if (this.handcardsSelect == -1) this.cancel();
        else {
            this.currCard = clone(this.player.handCards[cardIdx]);
            this.currCard.cidx = cardIdx;
            this.modalInfo = {
                version: this.version,
                isShow: true,
                type: INFO_TYPE.Card,
                info: this.currCard,
            }
            if (this.player.status == PLAYER_STATUS.PLAYING && this.player.canAction && this.isLookon == -1) {
                const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && cardIdx == pre.cardIdxs![0]);
                if (!preview) throw new Error('卡牌预览未找到');
                this.diceSelect.fill(false);
                this.heroCanSelect = [...(preview.heroCanSelect ?? [])];
                this.summonCanSelect = clone(preview.summonCanSelect!);
                this.supportCanSelect = clone(preview.supportCanSelect!.slice());
                this.willHp = preview.willHp?.slice() ?? this._resetWillHp();
                this.willAttachs = clone(preview.willAttachs) ?? this._resetWillAttachs();
                this.willSummons = clone(preview.willSummons) ?? this._resetWillSummons();
                this.willSwitch = clone(preview.willSwitch) ?? this._resetWillSwitch();
                this.summonCnt = clone(preview.willSummonChange) ?? this._resetSummonCnt();
                const { canSelectHero, canSelectSummon, canSelectSupport } = this.currCard;
                this.isValid = preview.isValid && canSelectHero == 0 && canSelectSummon == -1 && canSelectSupport == -1;
                if (
                    this.willHp.some(v => v != undefined) ||
                    this.willSummons.some(smns => smns.length > 0) ||
                    this.summonCnt.some(smns => smns.some(v => v != 0)) ||
                    this.willSwitch.some(ws => ws.some(v => v))
                ) {
                    this.currSkill.id = -2;
                }
                if (
                    canSelectHero == 1 && this.heroCanSelect.filter(v => v).length == 1 ||
                    canSelectSummon != -1 && this.players[+(canSelectSummon == this.playerIdx)].summons.length == 1 ||
                    canSelectSupport != -1 && this.players[+(canSelectSupport == this.playerIdx)].supports.length == 1
                ) {
                    const preview1 = this.previews.find(pre =>
                        pre.type == ACTION_TYPE.UseCard && cardIdx == pre.cardIdxs![0] &&
                        (pre.heroIdxs?.length == 1 || pre.summonIdx == 0 || pre.supportIdx == 0)
                    );
                    if (!preview1) return;
                    this.isValid = preview1.isValid;
                    if (this.isValid) {
                        if (canSelectHero == 1) {
                            this.heroSelect[1][this.heroCanSelect.indexOf(true)] = 1;
                        }
                        if (canSelectSummon != -1) {
                            this.summonSelect[canSelectSummon][0] = true;
                        }
                        if (canSelectSupport != -1) {
                            this.supportSelect[canSelectSupport][0] = true;
                        }
                    }
                }
                if (this.isValid) this.diceSelect = [...preview.diceSelect!];
            }
        }
    }
    /**
     * 使用卡
     */
    useCard() {
        if (!this.isValid) return;
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.UseCard,
            cardIdxs: [this.handcardsSelect],
            diceSelect: this.diceSelect,
            heroIdxs: this.heroSelect[1].map((v, i) => ({ v, i })).filter(v => v.v).sort((a, b) => a.v - b.v).map(v => v.i),
            supportIdx: this.supportSelect.reduce((a, c) => Math.max(a, c.indexOf(true)), -1),
            summonIdx: this.summonSelect.reduce((a, c) => Math.max(a, c.indexOf(true)), -1),
            flag: 'useCard',
        } as ActionData);
        this.player.dice = this.player.dice.filter((_, i) => !this.diceSelect[i]);
        this.player.handCards = this.player.handCards.filter((_, ci) => ci != this.handcardsSelect);
        this.cancel();
    }
    /**
     * 鼠标进入卡
     * @param idx 进入的卡的索引idx
     * @param force 是否强制执行该函数
     */
    mouseenter(idx: number, force = false) {
        if (this.isMobile && !force) return;
        this.handcardsPos.forEach((_, cpi, cpa) => {
            if (cpi > idx) cpa[cpi] += this.handcardsOffset;
        });
    }
    /**
     * 鼠标离开卡
     * @param idx 离开的卡的索引idx
     * @param force 是否强制执行该函数
     */
    mouseleave(idx: number, force = false) {
        if (this.isMobile && !force) return;
        this.handcardsPos.forEach((cp, cpi, cpa) => {
            if (cpi > idx) cpa[cpi] = Math.max(cpi * this.handcardsGap, cp - this.handcardsOffset);
        });
    }
    /**
     * 开始游戏
     */
    startGame() {
        if (this.players.length < PLAYER_COUNT) return alert(`玩家为${PLAYER_COUNT}人才能开始游戏`);
        const { shareCode = 'null' } = this.decks[this.deckIdx] ?? {};
        if (shareCode == 'null') return console.error('卡组未找到');
        if (!this.isDeckCompleteValid.isValid) return alert(this.isDeckCompleteValid.error);
        if (!this.isDeckVersionValid.isValid) return alert(this.isDeckVersionValid.error);
        console.info(`player[${this.player.name}]:${this.isStart ? 'cancelReady' : 'startGame'}-${this.playerIdx}`);
        const { heroIds, cardIds } = parseShareCode(shareCode);
        this.isStart = !this.isStart;
        this._resetWillAttachs();
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.StartGame,
            cpidx: this.playerIdx,
            deckIdx: this.deckIdx,
            heroIds,
            cardIds,
            flag: 'startGame',
        } as ActionData);
    }
    /**
     * 投降
     */
    giveup() {
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.GiveUp,
            cpidx: this.playerIdx,
            flag: 'giveup',
        } as ActionData);
    }
    /**
     * 从服务器获取数据
     * @param data
     */
    getServerInfo(data: Readonly<ServerData>) {
        const { players, previews, phase, isStart, round, currCountdown, pileCnt, diceCnt, handCardsCnt, damageVO,
            tip, actionInfo, slotSelect, heroSelect, statusSelect, summonSelect, supportSelect, log, isWin, pickModal,
            flag } = data;
        if (this.isDev) console.info(flag);
        const hasDmg = damageVO != -1 && (!!damageVO?.willDamages?.some(([d, p]) => d >= 0 || p > 0) || !!damageVO?.willHeals?.some(h => h != -1));
        this.isWin = isWin;
        if (this.isLookon > -1 && this.isLookon != this.playerIdx || players.length == 0) return;
        this.previews = previews;
        this.reconcileValid = previews.filter(pre => pre.type == ACTION_TYPE.Reconcile).sort((a, b) => a.cardIdxs![0] - b.cardIdxs![0]).map(v => v.isValid);
        this.phase = phase;
        this.isStart = isStart;
        this.round = round;
        this.countdown.curr = currCountdown;
        if (this.countdown.timer != undefined) clearInterval(this.countdown.timer);
        if (currCountdown > 0) this.countdown.timer = setInterval(() => --this.countdown.curr, 1e3);
        this.pileCnt = pileCnt;
        this.diceCnt = diceCnt;
        this.handCardsCnt = handCardsCnt;
        this.showRerollBtn = players[this.playerIdx].UI.showRerollBtn;
        this.pickModal = pickModal;
        if (this.statusSelect[0][0].length == 0 && this.players.length > 1 && phase >= PHASE.CHANGE_CARD) {
            this.statusSelect.forEach((p, pi) => {
                p.forEach((_, i, a) => {
                    a[i] = Array.from({ length: this.players[+(pi == this.playerIdx)].heros.length }, () => new Array(MAX_STATUS_COUNT).fill(false));
                });
            });
        }
        if (this.slotSelect[0].length == 0 && this.players.length > 1 && phase >= PHASE.CHANGE_CARD) {
            this.slotSelect.forEach((_, pi, pa) => {
                pa[pi] = Array.from({ length: this.players[+(pi == this.playerIdx)].heros.length }, () => new Array(4).fill(false));
            });
        }
        if (this.heroSelect[0].length == 0 && this.players.length > 1 && phase >= PHASE.CHANGE_CARD) {
            this.heroSelect.forEach((_, pi, pa) => {
                pa[pi] = Array.from({ length: players[+(pi == this.playerIdx)].heros.length }, () => 0);
            });
        }
        if (this.willSwitch[0].length == 0 && phase >= PHASE.CHANGE_CARD) {
            this._resetWillSwitch();
        }
        this._sendTip(tip);
        if (actionInfo != '') {
            this.actionInfo = actionInfo;
            setTimeout(() => this.actionInfo = '', 1000);
        }
        if (slotSelect.length > 0) {
            const [p, h, s] = slotSelect;
            this.slotSelect[+(p == this.playerIdx)][h][s] = true;
            setTimeout(() => this._resetSlotSelect(), 500);
        }
        if (heroSelect.length > 0) {
            const [p, h] = heroSelect;
            this.heroSelect[+(p == this.playerIdx)][h] = 1;
            setTimeout(() => this._resetHeroSelect(), 500);
        }
        if (statusSelect.length > 0) {
            const [p, g, h, s] = statusSelect;
            this.statusSelect[+(p == this.playerIdx)][g][h][s] = true;
            setTimeout(() => this._resetStatusSelect(), 500);
        }
        if (summonSelect.length > 0) {
            const [p, s] = summonSelect;
            this.summonSelect[+(p == this.playerIdx)][s] = true;
            setTimeout(() => this._resetSummonSelect(), 500);
        }
        if (supportSelect.length > 0) {
            const [p, s] = supportSelect;
            this.supportSelect[+(p == this.playerIdx)][s] = true;
            setTimeout(() => this._resetSupportSelect(), 500);
        }
        if (hasDmg) {
            this.damageVO.dmgSource = damageVO?.dmgSource ?? 'null';
            this.damageVO.dmgElements = damageVO?.dmgElements ?? [];
            this.damageVO.atkPidx = damageVO?.atkPidx ?? -1;
            this.damageVO.atkHidx = damageVO?.atkHidx ?? -1;
            this.damageVO.tarHidx = damageVO?.tarHidx ?? -1;
            this.isShowDmg = true;
            setTimeout(() => {
                this.players = players;
                this.updateHandCardsPos();
                this.damageVO.elTips = damageVO?.elTips ?? [];
                this.damageVO.willDamages = damageVO?.willDamages ?? [];
                this.damageVO.willHeals = damageVO?.willHeals ?? [];
                if (damageVO?.dmgSource == 'summon') {
                    const [saidx, suidx] = damageVO.selected ?? [-1, -1];
                    this.summonSelect[+(saidx == this.playerIdx)][suidx] = true;
                } else if (damageVO?.dmgSource == 'status') {
                    const [spidx, sgroup, shidx, sidx] = damageVO.selected ?? [-1, -1, -1, -1];
                    this.statusSelect[+(spidx == this.playerIdx)][sgroup][shidx][sidx] = true;
                }
                setTimeout(() => {
                    this.isShowDmg = false;
                    if (damageVO?.dmgSource == 'summon') this._resetSummonSelect();
                    else if (damageVO?.dmgSource == 'status') this._resetStatusSelect();
                    setTimeout(() => this.resetDamageVO(), 500);
                }, 1100);
            }, 550);
        } else {
            this.players = players;
            if (damageVO != -1 && damageVO?.elTips.some(([v]) => v != '')) {
                this.damageVO.elTips = damageVO?.elTips ?? [];
                setTimeout(() => this.resetDamageVO(), 1100);
            }
        }
        this.updateHandCardsPos();
        this.log = [...log];
        if (this.heroCanSelect.length == 0) this.heroCanSelect = this.player.heros.map(() => false);
    }
    /**
     * 游戏开始时换卡
     * @param cardIdxs 要换的卡的索引数组
     */
    changeCard(cardIdxs: number[]) {
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.ChangeCard,
            cpidx: this.playerIdx,
            cardIdxs,
            flag: 'changeCard',
        } as ActionData);
    }
    /**
     * 选择出战角色
     * @param hidx 选择的角色的索引idx
     */
    chooseHero() {
        if (this.isLookon > -1) return;
        const hidx = this.player.heros.findIndex(h => this.heroSelect[1][h.hidx] > 0 || h.id == this.modalInfo.info?.id || h.isFront);
        if (this.player.phase == PHASE.CHOOSE_HERO) { // 选择初始出战角色
            return this.selectHero(1, hidx);
        }
        if (this.player.status == PLAYER_STATUS.DIESWITCH) { // 阵亡选择角色
            this.isValid = true;
            return this.switchHero();
        }
        if (this.player.phase >= PHASE.ACTION_START && this.isShowSwitchHero > 0) { // 准备切换角色
            const hidx = this.player.heros.findIndex(h => this.heroSelect[1][h.hidx] || h.id == this.modalInfo.info?.id);
            const preview = this.previews.find(pre => pre.type == ACTION_TYPE.SwitchHero && pre.heroIdxs![0] == hidx);
            if (preview == undefined) throw new Error('未找到切换角色预览');
            this.heroSwitchDice = preview.switchHeroDiceCnt!;
            this.diceSelect = preview.diceSelect!.slice();
            this.heroCanSelect = preview.heroCanSelect!.slice();
            this.heroSelect[1] = this.heroSelect[1].map((_, hidx) => +!!preview.heroIdxs!.includes(hidx));
            this.isShowSwitchHero = 2 + +!!preview.isQuickAction;
            this.willHp = preview.willHp?.slice() ?? this._resetWillHp();
            this.willAttachs = preview.willAttachs?.slice() ?? this._resetWillAttachs();
            this.willSummons = preview.willSummons?.slice() ?? this._resetWillSummons();
            this.willSwitch = preview.willSwitch?.slice() ?? this._resetWillSwitch();
            this.isValid = preview.isValid;
            this.modalInfo = NULL_MODAL();
        }
    }
    /**
     * 选中角色
     * @param pidx 玩家识别符: 0对方 1我方
     * @param hidx 角色索引idx
     */
    selectHero(pidx: number, hidx: number, force: boolean = false) {
        this.cancel({ onlySupportAndSummon: true });
        if (this.currCard.canSelectHero == 0 || this.player.status == PLAYER_STATUS.DIESWITCH || force) {
            this.currCard = NULL_CARD();
            if (this.isMobile && this.handcardsSelect > -1) this.mouseleave(this.handcardsSelect, true);
            this.handcardsSelect = -1;
            const hero = this.players[this.playerIdx ^ pidx ^ 1].heros[hidx];
            this.modalInfo = {
                version: this.version,
                isShow: true,
                type: INFO_TYPE.Hero,
                info: hero,
                combatStatus: isCdt(hero?.isFront, this.players[this.playerIdx ^ pidx ^ 1].combatStatus),
            };
        }
        if (this.isLookon > -1) return;
        if (!this.currCard.subType.includes(CARD_SUBTYPE.Action) || this.currCard.canSelectHero == 0) {
            this.currSkill = NULL_SKILL();
        }
        this._resetWillSummons();
        this._resetSummonCnt();
        this._resetWillAttachs();
        if (this.player.phase == PHASE.CHOOSE_HERO && pidx == 1) { // 选择初始出战角色
            this.cancel({ onlyCard: true, notHeros: true });
            if (this.player.heros[hidx]?.isFront) this.modalInfo = NULL_MODAL();
            else this.isShowSwitchHero = 1;
            this.socket.emit('sendToServer', {
                type: ACTION_TYPE.ChooseInitHero,
                cpidx: this.playerIdx,
                heroIdxs: [hidx],
                flag: 'chooseInitHero',
            } as ActionData);
        } else {
            if (this.isShowSwitchHero > 1 && pidx == 1 && this.heroCanSelect[hidx]) {
                this.heroSelect[1].forEach((_, hi, ha) => ha[hi] = +(hi == hidx));
                this.chooseHero();
                this.modalInfo = NULL_MODAL();
            } else {
                this.cancel({ onlyHeros: true });
                this.isValid = true;
                this.isShowSwitchHero = +((this.player.status == PLAYER_STATUS.PLAYING || this.player.status == PLAYER_STATUS.DIESWITCH) &&
                    pidx == 1 && !this.player.heros[hidx].isFront && this.currCard.id <= 0 && this.player.heros[hidx].hp > 0)
            }
        }
    }
    /**
     * 选择卡需要的角色
     * @param pidx 玩家识别符: 0对方 1我方
     * @param hidx 角色索引idx
     * @returns 是否执行接下来的selectHero
     */
    selectCardHero(pidx: number, hidx: number) {
        if (this.phase != PHASE.ACTION || this.isShowSwitchHero > 1) return true;
        const { id, canSelectHero } = this.currCard;
        if (pidx == 0 || id <= 0 || !this.heroCanSelect[hidx]) {
            this.cancel();
            return true;
        }
        if (this.heroSelect[pidx][hidx] > 1) {
            this.heroSelect[pidx][hidx] = 0;
        } else if (this.heroSelect[pidx][hidx] > 0) {
            this._resetHeroSelect();
        } else {
            const selected = this.heroSelect[pidx].filter(v => v > 0).length;
            if (selected >= canSelectHero) {
                this.heroSelect[pidx].forEach((v, i, a) => {
                    if (canSelectHero == 1) a[i] = +(i == hidx);
                    else if (v != 1) a[i] = +(i == hidx) * 2;
                });
            } else {
                this.heroSelect[pidx][hidx] = selected + 1;
            }
        }
        const preview = this.previews.find(pre =>
            pre.type == ACTION_TYPE.UseCard &&
            pre.cardIdxs?.[0] == this.currCard.cidx &&
            (pre.heroIdxs?.length ?? 0) == this.heroSelect[pidx].filter(v => v > 0).length &&
            pre.heroIdxs?.every(hi => this.heroSelect[pidx][hi] > 0)
        );
        this.isValid = !!preview?.isValid;
        if (!preview) return false;
        if (this.isValid) this.diceSelect = [...preview.diceSelect!];
        this.heroCanSelect = [...(preview.heroCanSelect ?? [])];
        this.summonCanSelect = clone(preview.summonCanSelect!);
        this.supportCanSelect = clone(preview.supportCanSelect!.slice());
        this.willHp = preview.willHp?.slice() ?? this._resetWillHp();
        this.willAttachs = clone(preview.willAttachs) ?? this._resetWillAttachs();
        this.willSummons = clone(preview.willSummons) ?? this._resetWillSummons();
        this.willSwitch = clone(preview.willSwitch) ?? this._resetWillSwitch();
        this.summonCnt = clone(preview.willSummonChange) ?? this._resetSummonCnt();
        return false;
    }
    /**
     * 选择卡需要的召唤物
     * @param pidx 玩家识别符: 0对方 1我方
     * @param suidx 召唤物索引idx
     */
    selectCardSummon(pidx: number, suidx: number) {
        if ((this.currCard.id <= 0 && this.currSkill.id == -1) || !this.summonCanSelect[pidx][suidx]) return this.cancel();
        const newVal = !this.summonSelect[pidx][suidx];
        this.summonSelect[pidx][suidx] = newVal;
        if (newVal) this.summonSelect[pidx].forEach((_, i, a) => a[i] = i == suidx);
        if (this.currSkill.id > 0) return this.selectSkillSummon(suidx, newVal);
        const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && pre.summonIdx == (newVal ? suidx : -1));
        this.isValid = !!preview?.isValid;
        if (this.isValid) this.diceSelect = [...preview?.diceSelect!];
    }
    /**
     * 选择卡需要的场地
     * @param pidx 玩家识别符: 0对方 1我方
     * @param suidx 场地索引idx
     */
    selectCardSupport(pidx: number, siidx: number) {
        if (this.currCard.id <= 0 || !this.supportCanSelect[pidx][siidx]) return this.cancel();
        const newVal = !this.supportSelect[pidx][siidx];
        this.supportSelect[pidx][siidx] = newVal;
        if (newVal) this.supportSelect[pidx].forEach((_, i, a) => a[i] = i == siidx);
        const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && pre.cardIdxs![0] == this.currCard.cidx && pre.supportIdx == (newVal ? siidx : -1));
        if (!preview) return this.isValid = false;
        this.isValid = preview.isValid;
        if (this.isValid) this.diceSelect = [...preview.diceSelect!];
    }
    /**
     * 选择技能需要的召唤物
     * @param suidx 召唤物索引idx
     * @param newVal 选择的值
     */
    selectSkillSummon(suidx: number, newVal: boolean) {
        const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.summonIdx == (newVal ? suidx : -1));
        if (!preview) throw new Error('技能预览未找到');
        this.isValid = preview.isValid;
        if (this.isValid) this.diceSelect = [...preview.diceSelect!];
        this.willHp = [...preview.willHp!];
        this.willAttachs = [...clone(preview.willAttachs)!];
        this.willSummons = [...clone(preview.willSummons)!];
        this.summonCnt = [...clone(preview.willSummonChange)!];
        this.supportCnt = [...clone(preview.willSupportChange)!];
        this.willSwitch = [...preview.willSwitch!];
    }
    /**
     * 选择要消耗的骰子
     */
    selectUseDice() {
        this.isValid = checkDices(this.player.dice.filter((_, di) => this.diceSelect[di]), {
            card: isCdt(this.currCard.id > 0, this.currCard),
            skill: isCdt(this.currSkill.type != SKILL_TYPE.Passive, this.currSkill),
            heroSwitchDice: isCdt(this.isShowSwitchHero > 0, this.heroSwitchDice),
        });
    }
    /**
     * 调和骰子
     * @param bool 是否进行调和
     * @param cardIdx 用来调和的手牌序号
     * @returns 是否调和成功
     */
    reconcile(bool: boolean, cardIdx: number) {
        const { isValid, diceSelect } = this.previews.find(pr => pr.type == ACTION_TYPE.Reconcile && pr.cardIdxs![0] == cardIdx) ?? {};
        if (!isValid) return false;
        if (bool) {
            if (!this.isReconcile) {
                this.isReconcile = true;
                this.diceSelect = [...diceSelect!];
                this._resetHeroSelect();
                this._resetHeroCanSelect();
            } else {
                if (this.diceSelect.indexOf(true) == -1) return this._sendTip('骰子不符合要求');
                this.socket.emit('sendToServer', {
                    type: ACTION_TYPE.Reconcile,
                    cpidx: this.playerIdx,
                    cardIdxs: [cardIdx],
                    diceSelect: this.diceSelect,
                    flag: 'reconcile',
                } as ActionData);
                this.cancel();
            }
        } else {
            this.isReconcile = bool;
        }
        return true;
    }
    /**
     * 使用技能
     * @param skid 选组技能的id -1切换角色
     * @param options isOnlyRead 是否为只读, isCard 是否为使用卡, isSwitch 是否切换角色, isReadySkill 是否为准备技能, triggers 触发数组(出牌或切换角色时)
     */
    async useSkill(skid: number, options: { isOnlyRead?: boolean, isCard?: boolean, isSwitch?: number, isReadySkill?: boolean } = {}) {
        const { isOnlyRead = false, isCard = false, isReadySkill = false } = options;
        const skidx = this.skills.findIndex(sk => sk.id == skid);
        const isExec = !isOnlyRead && this.modalInfo.skidx == skidx || isReadySkill;
        if (skid > -1) this.currSkill = this.skills.find(sk => sk.id == skid)!;
        if (this.currCard.id <= 0 && skid > -1) {
            if (!isExec) {
                this.modalInfo = {
                    version: this.version,
                    isShow: true,
                    type: INFO_TYPE.Skill,
                    skidx,
                    info: this.getFrontHero(),
                    combatStatus: this.player.combatStatus,
                };
            } else {
                this.modalInfo = NULL_MODAL();
            }
        }
        if (this.opponent.status == PLAYER_STATUS.DIESWITCH || (!this.canAction && !isReadySkill)) return;
        if (skid > -1 && (!this.currCard.subType.includes(CARD_SUBTYPE.Action) || !isCard)) {
            this.currCard = NULL_CARD();
            this.cancel({ onlyCard: true });
        }
        if (skid == -1 || !this.canAction) return;

        if (isExec) {
            const diceValid = checkDices(this.player.dice.filter((_, di) => this.diceSelect[di]), { skill: this.currSkill });
            if (!diceValid || !this.isValid) {
                this.cancel();
                return this._sendTip('不符合要求');
            }
            this.socket.emit('sendToServer', {
                type: ACTION_TYPE.UseSkill,
                skillId: skid,
                diceSelect: this.diceSelect,
                summonIdx: this.summonSelect.reduce((a, c) => Math.max(a, c.indexOf(true)), -1),
                flag: `useSkill-${this.currSkill.name}-${this.playerIdx}`,
            } as ActionData);
            this.player.dice = this.player.dice.filter((_, i) => !this.diceSelect[i]);
            this.cancel();
            return;
        } else {
            const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.skillId == skid);
            if (!preview) throw new Error('技能预览未找到');
            this.willHp = [...preview.willHp!.slice()];
            this.willAttachs = [...clone(preview.willAttachs)!];
            this.willSummons = [...clone(preview.willSummons)!];
            this.summonCnt = [...clone(preview.willSummonChange)!];
            this.supportCnt = [...clone(preview.willSupportChange)!];
            this.willSwitch = [...preview.willSwitch!];
            this.summonCanSelect = [...clone(preview.summonCanSelect)!];
            this.energyCnt = [...clone(preview.willEnergy)!];
            this.isValid = preview.isValid;
            const { canSelectSummon } = this.currSkill;
            if (canSelectSummon != -1 && this.players[+(canSelectSummon == this.playerIdx)].summons.length == 1) {
                const preview1 = this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.skillId == skid && pre.summonIdx == 0);
                if (preview1) {
                    this.isValid = preview1.isValid;
                    if (this.isValid) {
                        this.willHp = [...preview1.willHp!.slice()];
                        this.willAttachs = [...clone(preview1.willAttachs)!];
                        this.willSummons = [...clone(preview1.willSummons)!];
                        this.summonCnt = [...clone(preview1.willSummonChange)!];
                        this.supportCnt = [...clone(preview1.willSupportChange)!];
                        this.willSwitch = [...preview1.willSwitch!];
                        this.summonCanSelect = [...clone(preview1.summonCanSelect)!];
                        this.summonSelect[canSelectSummon][0] = true;
                    }
                }
            }
            if (this.isValid) this.diceSelect = [...preview.diceSelect!];
        }
    }
    /**
     * 切换角色
     */
    switchHero() {
        const hidx = this.player.heros.findIndex(h => this.heroSelect[1][h.hidx] || h.id == this.modalInfo.info?.id);
        if (this.player.phase == PHASE.CHOOSE_HERO) {
            this.chooseHero();
            this.cancel();
            return;
        }
        if (!this.isValid) return;
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.SwitchHero,
            cpidx: this.playerIdx,
            heroIdxs: [hidx],
            diceSelect: this.diceSelect,
            flag: 'switchHero',
        } as ActionData);
        this.cancel();
    }
    /**
     * 重投骰子
     */
    reroll() {
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.Reroll,
            cpidx: this.playerIdx,
            diceSelect: this.diceSelect,
            flag: 'reroll',
        } as ActionData);
        this.resetDiceSelect();
    }
    /**
     * 选择挑选卡牌
     */
    selectCardPick(pcidx: number) {
        if (this.pickModal.selectIdx != pcidx) {
            this.pickModal.selectIdx = pcidx;
            const { cardType } = this.pickModal;
            this.modalInfo = {
                version: this.version,
                isShow: true,
                type: {
                    card: INFO_TYPE.Card,
                    summon: INFO_TYPE.Summon,
                }[cardType],
                info: cardType == 'summon' ? newSummon(this.version)(this.pickModal.cards[pcidx].id) : this.pickModal.cards[pcidx],
            }
        } else {
            this.pickModal.selectIdx = -1;
            this.cancel();
        }
    }
    /**
     * 挑选卡牌
     */
    pickCard() {
        if (this.pickModal.selectIdx == -1) return;
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.PickCard,
            cardIdxs: [this.pickModal.selectIdx],
            skillId: this.pickModal.skillId,
            flag: 'pickCard',
        } as ActionData);
        this.cancel();
    }
    /**
     * 展示召唤物信息
     * @param pidx 玩家idx
     * @param suidx 召唤物idx
     */
    showSummonInfo(pidx: number, suidx: number) {
        if (this.currCard.canSelectSummon > -1 || this.currCard.canSelectSupport > -1 || this.currSkill.canSelectSummon > -1) return;
        this.cancel();
        const summons = [this.opponent.summons, this.player.summons];
        this.modalInfo = {
            version: this.version,
            isShow: true,
            type: INFO_TYPE.Summon,
            info: summons[pidx][suidx],
        }
    }
    /**
     * 展示支援区信息
     * @param pidx 0敌方 1我方
     * @param siidx 场地idx
     */
    showSupportInfo(pidx: number, siidx: number) {
        if (this.supportCanSelect.flat().some(v => v)) {
            this.modalInfo = NULL_MODAL();
        } else {
            const supports = [this.opponent.supports, this.player.supports];
            this.modalInfo = {
                version: this.version,
                isShow: true,
                type: INFO_TYPE.Support,
                info: supports[pidx][siidx].card,
            }
        }
    }
    /**
     * 结束回合
     */
    endPhase() {
        if (this.player.status == PLAYER_STATUS.WAITING || !this.canAction || this.phase != PHASE.ACTION) return;
        this.socket.emit('sendToServer', { type: ACTION_TYPE.EndPhase, flag: 'endPhase' } as ActionData);
        this.cancel();
    }
    /**
     * 选择观战玩家
     * @param pidx 要观战的玩家idx
     */
    lookonTo(pidx: number) {
        if (this.isLookon == -1) return;
        this.isLookon = pidx;
        this.socket.emit('roomInfoUpdate', { roomId: this.roomId, pidx });
    }
    _sendTip(tip: string) {
        if (tip == '') return;
        if (this.tip != '') this.tip = '';
        this.tip = tip;
        setTimeout(() => this.tip = '', 1200);
    }
    /**
     * 重置角色选择
     */
    private _resetHeroSelect() {
        this.heroSelect.forEach((_, i, a) => a[i].fill(0));
    }
    /**
     * 重置角色可选
     */
    private _resetHeroCanSelect() {
        return this.heroCanSelect.fill(false);
    }
    /**
     * 重置支援物选择
     */
    private _resetSupportSelect() {
        this.supportSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置支援物可选
     */
    private _resetSupportCanSelect() {
        this.supportCanSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置支援物预览
     */
    private _resetSupportCnt() {
        return this.supportCnt = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(0));
    }
    /**
     * 重置召唤物选择
     */
    private _resetSummonSelect() {
        this.summonSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置召唤物可选
     */
    private _resetSummonCanSelect() {
        this.summonCanSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置召唤物次数预览
     */
    private _resetSummonCnt() {
        return this.summonCnt = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(0));
    }
    /**
     * 重置召唤物预览
     */
    private _resetWillSummons(): Summon[][] {
        return this.willSummons = new Array(PLAYER_COUNT).fill(0).map(() => []);
    }
    /**
     * 重置状态发光
     */
    private _resetStatusSelect() {
        this.statusSelect.forEach(p => p.forEach(g => g.forEach(h => h.fill(false))));
    }
    /**
     * 重置装备发光
     */
    private _resetSlotSelect() {
        this.slotSelect.forEach(p => p.forEach(h => h.fill(false)));
    }
    /**
     * 重置附着预览
     */
    private _resetWillAttachs(): ElementType[][] {
        return this.willAttachs = new Array(this.players.reduce((a, c) => a + c.heros.length, 0)).fill(0).map(() => []);
    }
    /**
     * 重置伤害预览
     */
    private _resetWillHp() {
        return this.willHp = new Array(this.players.flatMap(p => p.heros).length).fill(undefined);
    }
    private _resetWillSwitch() {
        return this.willSwitch = Array.from({ length: PLAYER_COUNT }, (_, i) => new Array(this.players[i]?.heros.length ?? 0).fill(false));
    }
    /**
     * 重置充能预览
     */
    private _resetEnergyCnt() {
        this.energyCnt.forEach(v => v.fill(0));
    }
    /**
     * 重置骰子选择
     */
    resetDiceSelect() {
        this.diceSelect.forEach((_, i, a) => a[i] = false);
    }
    /**
     * 重置damageVO
     */
    resetDamageVO() {
        return this.damageVO = {
            ...this.damageVO,
            dmgSource: 'null',
            atkPidx: -1,
            atkHidx: -1,
            tarHidx: -1,
            willDamages: [],
            // dmgElements: [],
            willHeals: [],
            elTips: [],
        }
    }
    /**
     * 获取当前出战角色信息
     * @param pidx 玩家idx 默认为playerIdx -1为playerIdx^1
     * @returns 当前出战角色信息
     */
    getFrontHero(pidx: number = this.playerIdx): Hero {
        if (pidx == -1) pidx = this.playerIdx ^ 1;
        const player = this.players[pidx];
        return player?.heros?.[player?.hidx] ?? {};
    }
}

