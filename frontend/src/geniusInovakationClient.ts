import type { Socket } from "socket.io-client";

import { ACTION_TYPE, CARD_SUBTYPE, ElementType, INFO_TYPE, PHASE, PLAYER_STATUS, Phase, SKILL_TYPE, Version } from "@@@/constant/enum";
import { DECK_CARD_COUNT, INIT_SWITCH_HERO_DICE, MAX_DICE_COUNT, MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT } from "@@@/constant/gameOption";
import { INIT_PLAYER, NULL_CARD, NULL_MODAL, NULL_SKILL } from "@@@/constant/init";
import {
    CHANGE_BAD_COLOR, CHANGE_GOOD_COLOR, ELEMENT_COLOR, HANDCARDS_GAP_MOBILE, HANDCARDS_GAP_PC, HANDCARDS_OFFSET_MOBILE,
    HANDCARDS_OFFSET_PC,
} from "@@@/constant/UIconst";
import { checkDices } from "@@@/utils/gameUtil";
import { clone, isCdt, parseShareCode } from "@@@/utils/utils";
import {
    ActionData,
    Card, Countdown, DamageVO, Hero,
    InfoVO,
    Player,
    Preview,
    ServerData, Skill, Summon,
} from "../../typing";

export default class GeniusInvokationClient {
    socket: Socket;
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
    isShowHeal: boolean = false; // 是否显示加血数
    isShowChangeHero: number = 0; // 是否显示切换角色按钮 0不显示 1显示 2显示且显示所需骰子 3显示且为快速行动
    isShowHistory: boolean = false; // 是否显示历史信息
    willSummons: Summon[][] = this._resetWillSummons(); // 将要召唤的召唤物
    willSwitch: boolean[] = []; // 是否将要切换角色
    supportCnt = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(0)); // 支援物变化数
    summonCnt = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(0)); // 召唤物变化数
    canSelectHero: number = 0; // 可以选择角色的数量
    round: number = 1; // 回合数
    isWin: number = -1; // 胜者idx
    modalInfo: InfoVO = NULL_MODAL(); // 展示信息
    tip: string = ''; // 提示信息
    actionInfo: string = ''; // 行动信息
    currCard: Card = NULL_CARD(); // 当前选择的卡
    currSkill: Skill = NULL_SKILL(); // 当前选择的技能
    decks: { name: string, shareCode: string, version: Version }[] = [];
    deckIdx: number; // 出战卡组id
    editDeckIdx: number; // 当前编辑卡组idx
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
    heroSelect: number[] = []; // 角色是否选中
    heroCanSelect: boolean[] = []; // 角色是否可选
    heroSwitchDice: number = INIT_SWITCH_HERO_DICE; // 切换角色所需骰子数
    supportSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(false)); // 支援物是否选中
    supportCanSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(false)); // 支援物是否可选
    summonSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(false)); // 召唤物是否选中
    summonCanSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(false)); // 召唤物是否可选
    error: string = ''; // 服务器发生的错误信息

    constructor(
        socket: Socket, userid: number, version: Version, players: Player[], isMobile: boolean, timelimit: number,
        decks: { name: string, shareCode: string, version: Version }[], deckIdx: number, isLookon: number
    ) {
        this.socket = socket;
        this.userid = userid;
        this.version = version;
        this.players = players;
        this.isLookon = isLookon;
        this.deckIdx = deckIdx;
        this.editDeckIdx = deckIdx;
        this.decks = decks;
        this.isMobile = isMobile;
        this.countdown.limit = timelimit;
        this.diceSelect = new Array(MAX_DICE_COUNT).fill(false);
        this.handcardsGap = isMobile ? HANDCARDS_GAP_MOBILE : HANDCARDS_GAP_PC;
        this.handcardsOffset = isMobile ? HANDCARDS_OFFSET_MOBILE : HANDCARDS_OFFSET_PC;
        this.handcardsPos = this.player.handCards.map((_, ci) => ci * this.handcardsGap);
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
        return this.player.canAction && this.tip == '';
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
        return fhero.skills.map((skill, skidx) => {
            const elColor = ELEMENT_COLOR[skill.cost[0].type];
            const energyPer = fhero.energy / skill.cost[2].cnt * 100;
            const isValid = !!this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.skillIdx == skidx)?.isValid;
            return {
                ...skill,
                isForbidden: skill.isForbidden || this.isLookon > -1 || !this.canAction || !isValid,
                CurrCnts: skill.cost.filter(c => c.cnt > 0).map((cost, cidx) => {
                    return Math.max(cost.cnt - (cidx < 2 ? (skill.costChange[cidx] as number) : 0), 0);
                }),
                isNotFullEnergy: skill.type == SKILL_TYPE.Burst && fhero.energy < skill.cost[2].cnt,
                style: {
                    fullEnergy: skill.type == SKILL_TYPE.Burst && fhero.energy >= skill.cost[2].cnt ? `0px 0px 8px 3px ${elColor}` : '',
                    notFullEnergy: `linear-gradient(to top, ${elColor} 0%, ${elColor} ${energyPer}%, transparent ${energyPer}%, transparent 100%)`,
                    costColors: skill.cost.filter(c => c.cnt > 0).map((_, cidx) => {
                        return cidx < 2 && (skill.costChange[cidx] as number) > 0 ? CHANGE_GOOD_COLOR :
                            cidx < 2 && (skill.costChange[cidx] as number) < 0 ? CHANGE_BAD_COLOR : 'white'
                    }),
                },
            }
        });
    }
    get isShowButton() {
        return this.isLookon == -1 &&
            (((this.player.status == PLAYER_STATUS.PLAYING && this.canAction && this.tip == '' && this.actionInfo == '' ||
                this.player.phase >= PHASE.DIE_CHANGE_ACTION) &&
                this.player.phase >= PHASE.CHOOSE_HERO && (this.currCard.id > 0 || this.isShowChangeHero > 0)) ||
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
            if (onlySupportAndSummon) {
                this._resetSummonSelect();
                this._resetSummonCanSelect();
                this._resetSupportSelect();
                this._resetSupportCanSelect();
                if (onlySupportAndSummon) return;
            }
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
        this.willSwitch = new Array(this.players.reduce((a, c) => a + c.heros.length, 0)).fill(false);
        this._resetWillSummons();
        this._resetWillAttachs();
        if (this.phase == PHASE.ACTION) this.resetDiceSelect();
        this.supportCnt = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(0));
        this.summonCnt = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(0));
        this.isValid = false;
        this.isShowChangeHero = 0;
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
        this._resetHeroSelect();
        this.isShowChangeHero = 0;
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
            if (this.player.status == PLAYER_STATUS.PLAYING) {
                const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && cardIdx == pre.cardIdxs![0]);
                if (!preview) throw new Error('预览未找到');
                this.heroCanSelect = [...preview.heroCanSelect!];
                this.summonCanSelect = [...preview.summonCanSelect!.slice()];
                this.supportCanSelect = [...preview.supportCanSelect!.slice()];
                this.willHp = preview.willHp ?? this._resetWillHp();
                this.willAttachs = preview.willAttachs ?? this._resetWillAttachs();
                this.willSummons = preview.willSummons ?? this._resetWillSummons();
                const { canSelectHero, canSelectSummon, canSelectSupport } = this.currCard;
                this.isValid = preview.isValid && canSelectHero == 0 && canSelectSummon == -1 && canSelectSupport == -1;
                if (canSelectHero == 1 && this.heroCanSelect.filter(v => v).length == 1 ||
                    canSelectSummon != -1 && this.summonCanSelect[canSelectSummon].filter(v => v).length == 1 ||
                    canSelectSupport != -1 && this.supportCanSelect[canSelectSupport].filter(v => v).length == 1) {
                    const preview1 = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && cardIdx == pre.cardIdxs![0] && pre.heroIdxs?.length == 1);
                    if (!preview1) throw new Error('预览未找到');
                    this.isValid = preview1.isValid;
                    if (this.isValid) {
                        if (canSelectHero == 1) {
                            this.heroSelect[this.heroCanSelect.indexOf(true)] = 1;
                        }
                        if (canSelectSummon != -1) {
                            this.summonSelect[canSelectSummon][this.summonCanSelect[canSelectSummon].indexOf(true)] = true;
                        }
                        if (canSelectSupport != -1) {
                            this.supportSelect[canSelectSupport][this.supportCanSelect[canSelectSupport].indexOf(true)] = true;
                        }
                    }
                }
                if (this.isValid) this.diceSelect = [...preview.diceSelect!];
            }
        }
        if (this.player.phase < PHASE.ACTION || this.isLookon > -1) return;
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
            heroIdxs: this.heroSelect.map((v, i) => ({ v, i })).filter(v => v.v).map(v => v.i),
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
        const { shareCode = 'null', version } = this.decks[this.deckIdx] ?? {};
        if (shareCode == 'null') return console.error('卡组未找到');
        const { heroIds, cardIds } = parseShareCode(shareCode);
        if (heroIds.includes(0) || cardIds.length < DECK_CARD_COUNT) return alert('当前出战卡组不完整');
        if (version != this.version) return alert('当前卡组版本不匹配');
        console.info(`player[${this.player.name}]:${this.isStart ? 'cancelReady' : 'startGame'}-${this.playerIdx}`);
        this.isStart = !this.isStart;
        this._resetWillAttachs();
        this.isWin = -1;
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.StartGame,
            cpidx: this.playerIdx,
            deckIdx: this.deckIdx,
            shareCode,
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
        const { players, previews, phase, isStart, round, currCountdown, pileCnt, diceCnt,
            handCardsCnt, damageVO, tip, actionInfo, log, isWin, flag } = data;
        console.info(flag);
        const hasDmg = damageVO != -1 && ((damageVO?.willDamages?.length ?? 0) > 0 || (damageVO?.willHeals?.length ?? 0) > 0);
        this.isWin = isWin;
        if (this.isLookon > -1 && this.isLookon != this.playerIdx) return;
        this.previews = previews;
        this.reconcileValid = previews.filter(pre => pre.type == ACTION_TYPE.Reconcile).sort((a, b) => a.cardIdxs![0] - b.cardIdxs![0]).map(v => v.isValid);
        this.phase = phase;
        this.isStart = isStart;
        this.round = round;
        this.countdown.curr = currCountdown;
        this.pileCnt = pileCnt;
        this.diceCnt = diceCnt;
        this.handCardsCnt = handCardsCnt;
        this.showRerollBtn = players[this.playerIdx].UI.showRerollBtn;
        this._sendTip(tip);
        if (actionInfo != '') {
            this.actionInfo = actionInfo;
            setTimeout(() => this.actionInfo = '', 1000);
        }
        if (damageVO != -1) {
            this.damageVO.dmgSource = damageVO?.dmgSource ?? 'null';
            this.damageVO.dmgElements = damageVO?.dmgElements ?? [];
            this.damageVO.elTips = damageVO?.elTips ?? [];
            this.damageVO.atkPidx = damageVO?.atkPidx ?? -1;
            this.damageVO.atkHidx = damageVO?.atkHidx ?? -1;
            this.damageVO.tarHidx = damageVO?.tarHidx ?? -1;
        }
        if (hasDmg) {
            this.isShowDmg = true;
            setTimeout(() => {
                this.players = players;
                this.updateHandCardsPos();
                this.damageVO.willDamages = damageVO?.willDamages ?? [];
                this.damageVO.willHeals = damageVO?.willHeals ?? [];
                setTimeout(() => {
                    this.isShowDmg = false;
                    setTimeout(() => this.resetDamageVO(), 500);
                }, 1100);
            }, 550);
        } else {
            this.players = players;
        }
        this.updateHandCardsPos();
        this.log = [...log];
    }
    /**
     * 游戏开始时换卡
     * @param cardIdxs 要换的卡的索引数组
     */
    changeCard(cardIdxs: number[]) {
        this.heroSelect = this.player.heros.map(() => 0);
        this.heroCanSelect = this.player.heros.map(() => false);
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
        const hidx = this.player.heros.findIndex(h => this.heroSelect[h.hidx] > 0 || h.id == this.modalInfo.info?.id);
        if (this.player.phase == PHASE.CHOOSE_HERO) { // 选择初始出战角色
            return this.selectHero(1, hidx);
        }
        if (([PHASE.DIE_CHANGE_ACTION, PHASE.DIE_CHANGE_ACTION_END] as Phase[]).includes(this.player.phase)) { // 阵亡选择角色
            this.isValid = true;
            return this.changeHero();
        }
        if (this.player.phase >= PHASE.ACTION_START && this.isShowChangeHero > 0) { // 准备切换角色
            const hidx = this.player.heros.findIndex(h => this.heroSelect[h.hidx] || h.id == this.modalInfo.info?.id);
            const preview = this.previews.find(pre => pre.type == ACTION_TYPE.SwitchHero && pre.heroIdxs![0] == hidx);
            if (preview == undefined) throw new Error('未找到切换角色预览');
            this.heroSwitchDice = preview.switchHeroDiceCnt!;
            this.diceSelect = [...preview.diceSelect!];
            this.heroCanSelect = [...preview.heroCanSelect!];
            this.heroSelect = this.heroSelect.map((_, hidx) => +!!preview.heroIdxs!.includes(hidx));
            this.isShowChangeHero = 2 + +!!preview.isQuickAction;
        }
    }
    /**
     * 选中角色
     * @param pidx 玩家识别符: 0对方 1我方
     * @param hidx 角色索引idx
     */
    selectHero(pidx: number, hidx: number, force: boolean = false) {
        this.cancel({ onlySupportAndSummon: true });
        if (this.currCard.canSelectHero == 0 || ([PHASE.DIE_CHANGE_ACTION, PHASE.DIE_CHANGE_ACTION_END] as Phase[]).includes(this.player.phase) || force) {
            this.currCard = NULL_CARD();
            if (this.isMobile && this.handcardsSelect > -1) this.mouseleave(this.handcardsSelect, true);
            this.handcardsSelect = -1;
            const hero = this.players[this.playerIdx ^ pidx ^ 1].heros[hidx];
            this.modalInfo = {
                version: this.version,
                isShow: true,
                type: INFO_TYPE.Hero,
                info: hero,
                combatStatus: isCdt(hero.isFront, this.players[this.playerIdx ^ pidx ^ 1].combatStatus),
            };
        }
        if (this.isLookon > -1) return;
        if (!this.currCard.subType.includes(CARD_SUBTYPE.Action) || this.currCard.canSelectHero == 0) {
            this.currSkill = NULL_SKILL();
        }
        this._resetWillSummons();
        this._resetWillAttachs();
        if (this.player.phase == PHASE.CHOOSE_HERO && pidx == 1) { // 选择初始出战角色
            this.cancel({ onlyCard: true, notHeros: true });
            if (this.player.heros[hidx].isFront) this.modalInfo = NULL_MODAL();
            else this.isShowChangeHero = 1;
            this.socket.emit('sendToServer', {
                type: ACTION_TYPE.ChooseInitHero,
                cpidx: this.playerIdx,
                heroIdxs: [hidx],
                flag: 'chooseInitHero',
            } as ActionData);
        } else {
            if (this.isShowChangeHero > 1 && pidx == 1 && this.heroCanSelect[hidx]) {
                this.heroSelect.forEach((_, hi, ha) => ha[hi] = +(hi == hidx));
                this.chooseHero();
                this.modalInfo = NULL_MODAL();
            } else {
                this.cancel({ onlyHeros: true });
                this.isValid = true;
                this.isShowChangeHero = +((this.player.status == PLAYER_STATUS.PLAYING ||
                    (this.player.phase == PHASE.DIE_CHANGE_ACTION || this.player.phase == PHASE.DIE_CHANGE_ACTION_END)) &&
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
        if (this.phase != PHASE.ACTION || this.isShowChangeHero > 1) return true;
        const { id, canSelectHero } = this.currCard;
        if (pidx == 0 || id <= 0 || !this.heroCanSelect[hidx]) {
            this.cancel();
            return true;
        }
        if (this.heroSelect[hidx] > 0) {
            this._resetHeroSelect();
        } else {
            const selected = this.heroSelect.filter(v => v > 0).length;
            if (selected >= canSelectHero) {
                this.heroSelect.forEach((v, i, a) => {
                    if (canSelectHero == 1) a[i] = +(i == hidx);
                    else if (v != 1) a[i] = +(i == hidx) * 2;
                });
            } else {
                this.heroSelect[hidx] = selected + 1;
            }
        }
        const preview = this.previews.find(pre =>
            pre.type == ACTION_TYPE.UseCard &&
            pre.cardIdxs?.[0] == this.currCard.cidx &&
            (pre.heroIdxs?.length ?? 0) > 0 && pre.heroIdxs?.every(hi => this.heroSelect[hi] > 0)
        );
        this.isValid = !!preview?.isValid;
        if (this.isValid) this.diceSelect = [...preview?.diceSelect!];
        return false;
    }
    /**
     * 选择卡需要的召唤物
     * @param pidx 玩家识别符: 0对方 1我方
     * @param suidx 召唤物索引idx
     */
    selectCardSummon(pidx: number, suidx: number) {
        if (this.currCard.id <= 0 || !this.summonCanSelect[pidx][suidx]) return this.cancel();
        const newVal = !this.summonSelect[pidx][suidx];
        this.summonSelect[pidx][suidx] = newVal;
        if (newVal) this.summonSelect[pidx].forEach((_, i, a) => a[i] = i == suidx);
        const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && pre.summonIdx == suidx);
        this.isValid = !!preview?.isValid;
    }
    /**
     * 选择卡需要的场地
     * @param pidx 玩家识别符: 0对方 1我方
     * @param suidx 场地索引idx
     */
    selectCardSupport(pidx: number, siidx: number) {
        if (this.currCard.id <= 0 || !this.supportCanSelect[pidx][siidx]) return this.cancel();
        const newVal = !this.supportSelect[siidx];
        this.supportSelect[pidx][siidx] = newVal;
        if (newVal) this.supportSelect[pidx].forEach((_, i, a) => a[i] = i == siidx);
        const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && pre.supportIdx == siidx);
        this.isValid = !!preview?.isValid;
    }
    /**
     * 选择要消耗的骰子
     */
    selectUseDice() {
        this.isValid = checkDices(this.player.dice.filter((_, di) => this.diceSelect[di]), {
            card: isCdt(this.currCard.id > 0, this.currCard),
            skill: isCdt(this.currSkill.type != SKILL_TYPE.Passive, this.currSkill),
        })
        if (this.isShowChangeHero > 0) { // 切换角色所消耗的骰子
            const preview = this.previews.find(pre => pre.type == ACTION_TYPE.SwitchHero && this.heroSelect[pre.heroIdxs![0]]);
            this.isValid = preview?.diceSelect?.filter(v => v).length == this.heroSwitchDice;
        }
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
     * @param skidx 选组技能的索引idx -1切换角色
     * @param options isOnlyRead 是否为只读, isCard 是否为使用卡, isSwitch 是否切换角色, isReadySkill 是否为准备技能, triggers 触发数组(出牌或切换角色时)
     */
    async useSkill(skidx: number, options: { isOnlyRead?: boolean, isCard?: boolean, isSwitch?: number, isReadySkill?: boolean } = {}) {
        const { isOnlyRead = false, isCard = false, isReadySkill = false } = options;
        const isExec = !isOnlyRead && this.modalInfo.skidx == skidx || isReadySkill;
        this.currSkill = this.skills[skidx];
        if (this.currCard.id <= 0 && skidx > -1) {
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
        if (([PHASE.DIE_CHANGE_ACTION, PHASE.DIE_CHANGE_ACTION_END] as Phase[]).includes(this.opponent.phase) || (!this.canAction && !isReadySkill)) return;
        if (skidx > -1 && (!this.currCard.subType.includes(CARD_SUBTYPE.Action) || !isCard)) {
            this.currCard = NULL_CARD();
            this.cancel({ onlyCard: true });
        }
        if (skidx == -1 || !this.canAction) return;

        if (isExec) {
            this.isValid = checkDices(this.player.dice.filter((_, di) => this.diceSelect[di]), { skill: this.currSkill });
            if (!this.isValid) {
                this.cancel();
                return this._sendTip('骰子不符合要求');
            }
            this.socket.emit('sendToServer', {
                type: ACTION_TYPE.UseSkill,
                skillIdx: skidx,
                diceSelect: this.diceSelect,
                flag: `useSkill-${this.currSkill.name}-${this.playerIdx}`,
            } as ActionData);
            this.player.dice = this.player.dice.filter((_, i) => !this.diceSelect[i]);
            this.currSkill = NULL_SKILL();
            this.resetDiceSelect();
            this._resetWillAttachs();
            this._resetWillSummons();
            return;
        } else {
            const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.skillIdx == skidx);
            if (!preview) throw new Error('预览未找到');
            this.diceSelect = [...preview.diceSelect!];
            this.willHp = preview.willHp!;
            this.willAttachs = preview.willAttachs!;
            this.willSummons = preview.willSummons!;
        }
        // if (!isCard) {
        //     if (!isOnlyRead) {
        //         this.isValid = true;
        //     }
        // }
    }
    /**
     * 切换角色
     */
    changeHero() {
        const hidx = this.player.heros.findIndex(h => this.heroSelect[h.hidx] || h.id == this.modalInfo.info?.id);
        if (this.player.phase == PHASE.CHOOSE_HERO) {
            this.chooseHero();
            this.cancel();
            return;
        }
        if (!this.isValid) return;
        this.cancel({ onlyHeros: true });
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.SwitchHero,
            cpidx: this.playerIdx,
            heroIdxs: [hidx],
            diceSelect: this.diceSelect,
            flag: 'changeHero',
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
     * 展示召唤物信息
     * @param pidx 玩家idx
     * @param suidx 召唤物idx
     */
    showSummonInfo(pidx: number, suidx: number) {
        if (this.currCard.canSelectSummon > -1 || this.currCard.canSelectSupport > -1) return;
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
        if (this.player.supports.some(s => s.canSelect)) {
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
        this.socket.emit('sendToServer', {
            type: ACTION_TYPE.EndPhase,
            flag: 'endPhase',
        } as ActionData);
        this.cancel();
    }
    /**
     * 选择观战玩家
     * @param idx 要观战的玩家idx
     */
    lookonTo(idx: number) {
        if (this.isLookon == -1) return;
        this.isLookon = idx;
        this.socket.emit('roomInfoUpdate',);
    }
    _sendTip(tip: string) {
        if (tip == '') return;
        if (this.tip != '') this.tip = '';
        setTimeout(() => {
            this.tip = tip;
            setTimeout(() => this.tip = '', 1200);
        }, 100);
    }
    /**
     * 重置角色选择
     */
    private _resetHeroSelect() {
        return this.heroSelect.fill(0);
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
        return this.supportSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置支援物可选
     */
    private _resetSupportCanSelect() {
        return this.supportCanSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置召唤物选择
     */
    private _resetSummonSelect() {
        return this.summonSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置召唤物可选
     */
    private _resetSummonCanSelect() {
        return this.summonCanSelect.forEach(v => v.fill(false));
    }
    /**
     * 重置附着预览
     */
    private _resetWillAttachs(): ElementType[][] {
        return this.willAttachs = new Array(this.players.reduce((a, c) => a + c.heros.length, 0)).fill(0).map(() => []);
    }
    /**
     * 重置召唤物预览
     */
    private _resetWillSummons(): Summon[][] {
        return this.willSummons = new Array(PLAYER_COUNT).fill(0).map(() => []);
    }
    /**
     * 重置伤害预览
     */
    private _resetWillHp() {
        return this.willHp = new Array(this.players.flatMap(p => p.heros).length).fill(undefined);
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
            dmgSource: 'null',
            atkPidx: -1,
            atkHidx: -1,
            tarHidx: -1,
            willDamages: [],
            dmgElements: [],
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

