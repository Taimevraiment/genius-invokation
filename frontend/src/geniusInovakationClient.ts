import type { Socket } from "socket.io-client";

import { ACTION_TYPE, CARD_SUBTYPE, ElementType, INFO_TYPE, InfoType, PHASE, PLAYER_STATUS, Phase, SKILL_TYPE, STATUS_GROUP, STATUS_TYPE, Version } from "@@@/constant/enum";
import { DECK_CARD_COUNT, INIT_SWITCH_HERO_DICE, MAX_DICE_COUNT, MAX_STATUS_COUNT, MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT } from "@@@/constant/gameOption";
import { INIT_PLAYER, NULL_CARD, NULL_MODAL, NULL_SKILL } from "@@@/constant/init";
import {
    CHANGE_BAD_COLOR, CHANGE_GOOD_COLOR, ELEMENT_COLOR, HANDCARDS_GAP_MOBILE, HANDCARDS_GAP_PC, HANDCARDS_OFFSET_MOBILE, HANDCARDS_OFFSET_PC, SLOT_CODE_KEY,
} from "@@@/constant/UIconst";
import { GICard } from "@@@/data/builder/cardBuilder";
import { GIHero } from "@@@/data/builder/heroBuilder";
import { GIStatus } from "@@@/data/builder/statusBuilder";
import { GISummon } from "@@@/data/builder/summonBuilder";
import { GISupport } from "@@@/data/builder/supportBuilder";
import { parseCard } from "@@@/data/cards";
import { parseHero } from "@@@/data/heros";
import { newSummon } from "@@@/data/summons";
import { checkDices } from "@@@/utils/gameUtil";
import { clone, delay, isCdt, parseShareCode } from "@@@/utils/utils";
import {
    ActionData, ActionInfo, Card, Countdown, CustomVersionConfig, DamageVO, EnergyIcons, Hero, InfoVO, PickCard, PickCardType, Player, Preview, RecordData, ServerData, Skill, Status, Summon
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
    willAttachs: (ElementType | [ElementType, ElementType])[][][] = []; // 将要附着的元素
    willHp: (number | undefined)[] = []; // 总共的血量变化
    damageVO: Exclude<DamageVO, -1> = this._resetDamageVO(); // 显示伤害
    isShowDmg: boolean = false; // 是否显示伤害数
    isShowSwitchHero: number = 0; // 是否显示切换角色按钮 0不显示 1显示 2显示且显示所需骰子 3显示且为快速行动
    isShowHistory: boolean = false; // 是否显示历史信息
    isShowEndPhase: boolean = false; // 是否显示确认结束回合按钮
    isShowHandCardInfo: boolean = false;  // 是否显示手牌信息
    changedSummons: (Summon | undefined)[][] = Array.from({ length: PLAYER_COUNT }, () => []); // 召唤物变化
    changedHeros: (string | undefined)[][] = Array.from({ length: PLAYER_COUNT }, () => []); // 角色变化
    willSummons: Summon[][] = this._resetWillSummons(); // 将要召唤的召唤物
    willSwitch: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => []); // 是否将要切换角色
    supportCnt: number[][] = this._resetSupportCnt(); // 支援物变化数
    summonCnt: number[][] = this._resetSummonCnt(); // 召唤物变化数
    energyIcons: EnergyIcons[][] | undefined; // 充能图标
    round: number = 1; // 回合数
    isWin: number = -1; // 胜者idx
    modalInfo: InfoVO = NULL_MODAL(); // 展示信息
    tip: string = ''; // 提示信息
    actionInfo: ActionInfo = { content: '' }; // 行动信息
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
    handCardsInfo: ServerData['handCardsInfo'] = {
        count: new Array(PLAYER_COUNT).fill(0), // 手牌数量
        info: new Array(PLAYER_COUNT).fill(0).map(() => ({
            forbiddenKnowledge: 0, // 禁忌知识数量
            conductive: 0, // 电击数量
        })),
    };
    isMobile: boolean; // 是否为手机
    diceSelect: boolean[]; // 骰子是否选中
    initcardsPos: string[] = []; // 换牌手牌位置
    handcardsGap: number; // 手牌间隔
    handcardsOffset: number; // 手牌偏移
    handcardsPos: number[]; // 手牌位置
    handcardsOverPos: number[] = []; // 超出限额的手牌位置
    handcardsGroupOffset: Record<string, string> = {}; // 手牌组偏移
    handcardsSelect: number = -1; // 被选中的手牌序号
    reconcileValid: boolean[] = []; // 是否允许调和
    heroSelect: number[][] = Array.from({ length: PLAYER_COUNT }, () => []); // 角色是否选中
    heroCanSelect: boolean[] = []; // 角色是否可选
    heroSwitchDice: number = INIT_SWITCH_HERO_DICE; // 切换角色所需骰子数
    supportSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(false)); // 支援物是否选中
    supportCanSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUPPORT_COUNT).fill(false)); // 支援物是否可选
    summonSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(false)); // 召唤物是否选中
    summonCanSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(false)); // 召唤物是否可选
    statusSelect: boolean[][][][] = Array.from({ length: PLAYER_COUNT }, () => Array.from({ length: 2 }, () => [])); // 状态是否发光
    targetSelect: boolean[][] = Array.from({ length: PLAYER_COUNT }, () => []); // 目标是否选中
    slotSelect: boolean[][][] = Array.from({ length: PLAYER_COUNT }, () => []); // 装备是否发光
    handcardSelect: number[] = Array.from({ length: PLAYER_COUNT }, () => -1); // 手牌是否发光
    pickModal: PickCard = { cards: [], selectIdx: -1, cardType: 'getCard' }; // 挑选卡牌
    watchers: number = 0; // 观战人数
    recordData: RecordData = { seed: '', name: '', pidx: -1, username: [], shareCode: [], version: 'v3.3.0', actionLog: [] }; // 行动日志
    customVersion?: CustomVersionConfig; // 自定义版本配置
    isDev: boolean; // 是否为开发模式
    error: string = ''; // 服务器发生的错误信息
    emit: (actionData: ActionData) => void; // 发送事件

    constructor(
        socket: Socket, roomId: number, userid: number, version: Version, players: Player[], isMobile: boolean, timelimit: number, isDev: boolean,
        decks: { name: string, shareCode: string, version: Version }[], deckIdx: number, isLookon: number, customVersion?: CustomVersionConfig,
    ) {
        this.socket = socket;
        this.emit = data => roomId > 0 && socket.emit('sendToServer', data);
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
        const { shareCode = 'null', version: ver = 'null' } = this.decks[this.deckIdx] ?? {};
        let { heroIds, cardIds } = parseShareCode(shareCode);
        if (customVersion) {
            this.customVersion = customVersion;
            const { baseVersion: version, diff, banList } = customVersion;
            this.version = version;
            heroIds = heroIds.map(v => parseHero(v, version, { diff, banList }).id == 0 ? 0 : v);
            cardIds = cardIds.filter(v => parseCard(v, version, { diff, banList }).id > 0);
        }
        this.isDeckCompleteValid = {
            isValid: !heroIds.includes(0) && cardIds.length == DECK_CARD_COUNT,
            error: '当前出战卡组不完整',
        };
        this.isDeckVersionValid = {
            isValid: ver == 'null' || !!customVersion || !heroIds.some(hid => parseHero(hid, version).id == 0) && !cardIds.some(cid => parseCard(cid, version).id == 0),
            error: '当前卡组版本不匹配',
        };
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
        return this.player.canAction &&
            this.tip == '' &&
            this.actionInfo.content == '' &&
            this.damageVO.dmgSource == 'null' &&
            this.roomId > 0 &&
            this.players.every(p =>
                p.UI.willGetCard.cards.length == 0 &&
                p.UI.willAddCard.cards.length == 0 &&
                p.UI.willDiscard.hcards.length == 0 &&
                p.UI.willDiscard.pile.length == 0
            );
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
        const energy = Math.max(0, fhero.energy);
        return skills.filter(skill => skill.type != SKILL_TYPE.Passive).map(skill => {
            const elColor = ELEMENT_COLOR[skill.type == SKILL_TYPE.Vehicle ? fhero.element : skill.cost[0].type];
            const energyPer = energy / skill.cost[2].cnt * 100;
            const isValid = !!this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.skillId == skill.id)?.isValid;
            return {
                ...skill,
                isReadySkill: false,
                isForbidden: skill.isForbidden || this.isLookon > -1 || !this.canAction || !isValid,
                CurrCnts: skill.cost.map((cost, cidx) => [cost.cnt, Math.max(cost.cnt - (cidx < 2 ? (skill.costChange[cidx] as number) : 0), 0)])
                    .filter(([c]) => c).map(([, c]) => c),
                isNotFullEnergy: skill.cost[2].cnt > 0 && energy < skill.cost[2].cnt,
                style: {
                    fullEnergy: skill.cost[2].cnt > 0 && energy >= skill.cost[2].cnt ? `0px 0px 10px 5px ${elColor}` : '',
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
            (((this.player.status == PLAYER_STATUS.PLAYING && this.canAction && this.tip == '' && this.actionInfo.content == '' ||
                this.player.status == PLAYER_STATUS.DIESWITCH) &&
                this.player.phase >= PHASE.CHOOSE_HERO && (this.currCard.id > 0 || this.isShowSwitchHero > 0)) ||
                this.player.phase == PHASE.CHOOSE_HERO
            );
    }
    /**
     * 设置错误信息
     * @param err 错误信息
     */
    setError(err: string) {
        this.error = err;
    }
    /**
     * 取消选择
     */
    cancel(options: {
        onlyCard?: boolean, notCard?: boolean, notHeros?: boolean, onlyHeros?: boolean,
        onlySupportAndSummon?: boolean, notTarget?: boolean, notSummonSelect?: boolean,
    } = {}) {
        const { onlyCard, notCard, notHeros, onlyHeros, onlySupportAndSummon, notTarget, notSummonSelect } = options;
        this.isShowEndPhase = false;
        this.isShowHandCardInfo = false;
        this._resetWillHp();
        if (!onlyCard) {
            if ((!notHeros || onlyHeros) && !onlySupportAndSummon) {
                this._resetHeroSelect();
                this._resetHeroCanSelect();
                if (onlyHeros) return;
            }
            if (!notSummonSelect) this._resetSummonSelect();
            this._resetSummonCanSelect();
            this._resetSupportSelect();
            this._resetSupportCanSelect();
            this._resetHandcardSelect();
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
        this.currCard = NULL_CARD();
        this._resetWillSwitch();
        this._resetWillSummons();
        this._resetSummonCnt();
        this._resetWillAttachs();
        this._resetSupportCnt();
        this._resetEnergyIcons();
        if (!notTarget) {
            this.modalInfo = NULL_MODAL();
            this.currSkill = NULL_SKILL();
            this._resetTargetSelect();
            this.isValid = false;
        }
        if (this.phase != PHASE.DICE && this.player.phase != PHASE.DICE && !notTarget) this.resetDiceSelect();
        this.isShowSwitchHero = 0;
        this.isShowHistory = false;
        this.isReconcile = false;
    }
    /**
     * 更新手牌位置
     * @param player 最新的玩家数据
     */
    updateHandCardsPos(player: Player) {
        if (!this.isStart || !player) return;
        const isGetCard = (c: Card) => c.UI.class?.includes('getcard');
        const newCards = player.handCards.filter(isGetCard);
        const validNewCards = newCards.filter(c => !c.UI.class?.includes('over'));
        let newCardIdx = 0;
        const getNewCardIdx = () => {
            const cardWidth = this.isMobile ? 60 : 90;
            const newCardsOffset = (player.handCards.length / 2) * this.handcardsGap - newCards.length / 2 * cardWidth;
            return newCardIdx++ * (cardWidth + 5) + newCardsOffset;
        };
        this.handcardsPos = player.handCards.map(c => {
            if (isGetCard(c)) return getNewCardIdx();
            const newCidxGap = validNewCards.filter(v => v.cidx < c.cidx).length;
            return (c.cidx - newCidxGap) * this.handcardsGap;
        });
        this.handcardsOverPos = [];
        player.UI.willGetCard.cards
            .filter(c => c.UI.class?.includes('over'))
            .forEach(() => this.handcardsOverPos.push(getNewCardIdx()));
        const isDiscard = (c: Card) => c.UI.class?.includes('discard');
        const discardIdxs = player.handCards.filter(isDiscard).map(c => c.cidx);
        if (newCards.length + discardIdxs.length) {
            setTimeout(() => {
                this.handcardsPos = this.player.handCards.map(c => {
                    const discardCidxGap = isDiscard(c) ? 0 : discardIdxs.filter(v => v < c.cidx).length;
                    return (c.cidx - discardCidxGap) * this.handcardsGap;
                });
                this.handcardsGroupOffset = { transform: `translateX(-${12 * (this.handcardsPos.length - discardIdxs.length)}px)` }
            }, 1200);
            setTimeout(() => {
                this.player.handCards = this.player.handCards.filter(c => !isDiscard(c));
                this.player.handCards.forEach((c, ci) => c.cidx = ci);
                this.handcardsPos = this.player.handCards.map(c => c.cidx * this.handcardsGap);
                this.players.forEach(p => p.handCards.forEach(c => delete c.UI.class));
            }, 1500);
        } else {
            this.handcardsGroupOffset = { transform: `translateX(-${12 * (this.handcardsPos.length)}px)` }
        }
        setTimeout(() => {
            const hasGetCard = this.players.some(p => p.UI.willGetCard.cards.length);
            const hasAddCard = this.players.some(p => p.UI.willAddCard.cards.length);
            const hasDiscard = this.players.some(p => p.UI.willDiscard.hcards.length + p.UI.willDiscard.pile.length);
            setTimeout(() => {
                this.players.forEach(p => {
                    if (hasGetCard) p.UI.willGetCard = { cards: [], isFromPile: true, isNotPublic: true };
                    if (hasAddCard) p.UI.willAddCard = { cards: [], isNotPublic: false };
                    if (hasDiscard) p.UI.willDiscard = { hcards: [], pile: [], isNotPublic: false };
                });
            }, 1500);
        });
    }
    /**
     * 更新初始手牌位置
     * @param player 最新的玩家数据
     */
    updateInitCardsPos(player: Player) {
        if (!player) return;
        const width = this.isMobile ? 60 : 90;
        const isChangedCard = (c: Card) => c.UI.class == 'changed-card';
        const isChangeCard = (c: Card) => c.UI.class == 'change-card';
        const { handCards } = player;
        const changeCards = handCards.filter(isChangeCard);
        const changedCards = handCards.filter(isChangedCard);
        const handCardsLen = handCards.length - changeCards.length;
        this.initcardsPos = handCards.map(c => {
            const idx = isChangeCard(c) ?
                c.cidx - changedCards.filter(v => v.cidx < c.cidx).length :
                c.cidx - changeCards.filter(v => v.cidx < c.cidx).length;
            return `calc(${idx * width}px + ${idx + 1} * (100% - ${handCardsLen * width}px) / ${handCardsLen + 1})`;
        });
        setTimeout(() => {
            this.initcardsPos = this.player.handCards.map(c => {
                const idx = isChangedCard(c) ?
                    c.cidx - changeCards.filter(v => v.cidx < c.cidx).length :
                    c.cidx - changedCards.filter(v => v.cidx < c.cidx).length;
                return `calc(${idx * width}px + ${idx + 1} * (100% - ${handCardsLen * width}px) / ${handCardsLen + 1})`;
            });
        });
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
        this.isShowEndPhase = false;
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
            if (this.player.status == PLAYER_STATUS.PLAYING && this.player.canAction && this.isLookon == -1 && this.roomId > 0) {
                const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && cardIdx == pre.cardIdxs![0]);
                if (!preview) throw new Error('卡牌预览未找到');
                this.diceSelect.fill(false);
                this.willHp = preview.willHp?.slice() ?? this._resetWillHp();
                this.willAttachs = clone(preview.willAttachs) ?? this._resetWillAttachs();
                this.willSummons = clone(preview.willSummons) ?? this._resetWillSummons();
                this.willSwitch = clone(preview.willSwitch) ?? this._resetWillSwitch();
                if (preview.changedSummons) this.changedSummons = clone(preview.changedSummons);
                if (preview.changedHeros) this.changedHeros = clone(preview.changedHeros);
                this.energyIcons = clone(preview.energyIcons);
                this.isValid = preview.isValid;
                this.heroCanSelect = clone(preview.heroCanSelect) ?? this._resetHeroCanSelect();
                this.summonCanSelect = clone(preview.summonCanSelect) ?? this._resetSummonCanSelect();
                this.supportCanSelect = clone(preview.supportCanSelect) ?? this._resetSupportCanSelect();
                if (this.isValid) {
                    const { canSelectHero, canSelectSummon, canSelectSupport } = this.currCard;
                    if (canSelectHero == 1 && preview.heroIdxs) this.heroSelect[1][preview.heroIdxs[0]] = 1;
                    if (preview.summonIdx != undefined) this.summonSelect[canSelectSummon][preview.summonIdx] = true;
                    if (preview.supportIdx != undefined) this.supportSelect[Math.abs(canSelectSupport)][preview.supportIdx] = true;
                    this.summonCnt = clone(preview.willSummonChange) ?? this._resetSummonCnt();
                    this.supportCnt = clone(preview.willSupportChange) ?? this._resetSupportCnt();
                    this.diceSelect = [...preview.diceSelect!];
                }
                if (
                    this.willHp.some(v => v != undefined) ||
                    this.willSummons.some(smns => smns.length > 0) ||
                    this.summonCnt.some(smns => smns.some(v => v != 0)) ||
                    this.willSwitch.some(ws => ws.some(v => v))
                ) {
                    this.currSkill.id = -2;
                }
            }
        }
    }
    /**
     * 使用卡
     */
    useCard() {
        if (!this.isValid) return;
        this.emit({
            type: ACTION_TYPE.UseCard,
            cardIdxs: [this.handcardsSelect],
            diceSelect: this.diceSelect,
            heroIdxs: this.heroSelect[1].map((v, i) => ({ v, i })).filter(v => v.v).sort((a, b) => a.v - b.v).map(v => v.i),
            supportIdx: this.supportSelect.reduce((a, c) => Math.max(a, c.indexOf(true)), -1),
            summonIdx: this.summonSelect.reduce((a, c) => Math.max(a, c.indexOf(true)), -1),
            flag: 'useCard',
        });
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
        this.handcardsPos.forEach((_, cpi, cpa) => { cpi > idx && (cpa[cpi] += this.handcardsOffset) });
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
    startGame(shareCode: string = '') {
        if (this.players.length < PLAYER_COUNT) return alert(`玩家为${PLAYER_COUNT}人才能开始游戏`);
        if (shareCode == '') ({ shareCode = 'null' } = this.decks[this.deckIdx] ?? {});
        if (shareCode == 'null') return console.error('卡组未找到');
        if (!this.isDeckCompleteValid.isValid) return alert(this.isDeckCompleteValid.error);
        if (!this.isDeckVersionValid.isValid) return alert(this.isDeckVersionValid.error);
        console.info(`player[${this.player.name}]:${this.isStart ? 'cancelReady' : 'startGame'}-${this.playerIdx}`);
        let heroIds: number[] = [];
        let cardIds: number[] = [];
        if (!this.isStart) ({ heroIds, cardIds } = parseShareCode(shareCode));
        this.isStart = !this.isStart;
        this.emit({
            type: ACTION_TYPE.StartGame,
            heroIds,
            cardIds,
            shareCode,
            flag: 'startGame',
        });
    }
    /**
     * 投降
     */
    giveup() {
        this.emit({ type: ACTION_TYPE.GiveUp, flag: 'giveup' });
    }
    /**
     * 从服务器获取数据
     * @param data
     */
    getServerInfo(data: Readonly<ServerData>) {
        const { players, previews, phase, isStart, round, currCountdown, pileCnt, diceCnt, handCardsInfo, damageVO,
            tip, actionInfo, slotSelect, heroSelect, statusSelect, summonSelect, supportSelect, log, isWin, pickModal,
            watchers, recordData, handcardSelect, flag } = data;
        if (this.isDev) console.info(flag);
        const hasDmg = damageVO && (!!damageVO?.willDamages?.some(([d, p]) => d >= 0 || p > 0) || !!damageVO?.willHeals?.some(h => h != -1));
        this.isWin = isWin;
        if (recordData) {
            this.recordData = recordData;
            if (this.recordData.pidx == -1) this.recordData.pidx = this.playerIdx;
        }
        if ((this.isLookon > -1 && this.isLookon != this.playerIdx) || players.length == 0) return;
        this.previews = previews;
        this.reconcileValid = previews.filter(pre => pre.type == ACTION_TYPE.Reconcile).sort((a, b) => a.cardIdxs![0] - b.cardIdxs![0]).map(v => v.isValid);
        this.phase = phase;
        this.isStart = isStart;
        this.round = round;
        this.countdown.curr = currCountdown;
        if (this.countdown.timer != undefined) clearInterval(this.countdown.timer);
        if (currCountdown > 0) this.countdown.timer = setInterval(() => --this.countdown.curr, 1e3);
        this.diceCnt = diceCnt;
        setTimeout(() => this.pileCnt = pileCnt, players.some(p => p.UI.willAddCard.cards.length) ? 1500 : 0);
        setTimeout(() => this.handCardsInfo = handCardsInfo, players.some(p => p.UI.willDiscard.hcards.length + p.UI.willDiscard.pile.length) ? 1500 : 0);
        this.showRerollBtn = players[this.playerIdx]?.UI.showRerollBtn ?? false;
        this.pickModal = pickModal;
        this.watchers = watchers;
        if (flag.includes('startGame') || flag.includes('roomInfoUpdate')) {
            this._resetWillAttachs(players);
            this.initSelect(players);
            this.updateInitCardsPos(players[this.playerIdx]);
        } else if (flag.includes('changeCard')) this.updateInitCardsPos(players[this.playerIdx]);
        if (this.willSwitch[0].length == 0 && phase >= PHASE.CHANGE_CARD) this._resetWillSwitch();
        this._sendTip(tip);
        if (actionInfo.content != '' || !!actionInfo.card) {
            this.actionInfo = actionInfo;
            setTimeout(() => this.actionInfo.isShow = false, 800);
            setTimeout(() => this.actionInfo = { content: '' }, 1e3);
        }
        players.forEach(p => {
            p.combatStatus.forEach(s => Reflect.setPrototypeOf(s, GIStatus.prototype));
            p.heros.forEach(h => {
                Reflect.setPrototypeOf(h, GIHero.prototype);
                h.heroStatus.forEach(s => Reflect.setPrototypeOf(s, GIStatus.prototype));
                h.equipments.forEach(s => s && Reflect.setPrototypeOf(s, GICard.prototype));
            });
            p.handCards.forEach(c => {
                Reflect.setPrototypeOf(c, GICard.prototype);
                c.attachments.forEach(a => Reflect.setPrototypeOf(a, GIStatus.prototype));
            });
            p.summons.forEach(s => Reflect.setPrototypeOf(s, GISummon.prototype))
            p.supports.forEach(s => {
                Reflect.setPrototypeOf(s, GISupport.prototype);
                Reflect.setPrototypeOf(s.card, GICard.prototype);
            });
        });
        pickModal.cards.forEach(c => Reflect.setPrototypeOf(c, GICard.prototype));
        const setSelect = (retry = 0) => {
            setTimeout(async () => {
                try {
                    if (slotSelect.length > 0) {
                        const [p, h, s, isDestroy] = slotSelect;
                        this.slotSelect[+(p == this.playerIdx)][h][s] = true;
                        setTimeout(() => this._resetSlotSelect(), 500);
                        if (isDestroy) setTimeout(() => this.players[p].heros[h][SLOT_CODE_KEY[s]] = null, 800);
                    }
                    if (heroSelect.length > 0) {
                        const [p, h] = heroSelect;
                        this.heroSelect[+(p == this.playerIdx)][h] = 1;
                        setTimeout(() => this._resetHeroSelect(), 500);
                    }
                    if (statusSelect.length > 0) {
                        const [p, g, h, s, isDestroy] = statusSelect;
                        this.statusSelect[+(p == this.playerIdx)][g][h][s] = true;
                        setTimeout(() => this._resetStatusSelect(), 500);
                        if (isDestroy) {
                            const stsEid = g == STATUS_GROUP.combatStatus ?
                                this.players[p].combatStatus[s]?.entityId :
                                this.players[p].heros[h].heroStatus[s]?.entityId;
                            setTimeout(() => {
                                if ((g == STATUS_GROUP.combatStatus ?
                                    this.players[p].combatStatus[s]?.entityId :
                                    this.players[p].heros[h].heroStatus[s]?.entityId) != stsEid) return;
                                if (g == STATUS_GROUP.combatStatus) this.players[p].combatStatus.splice(s, 1)
                                else this.players[p].heros[h].heroStatus.splice(s, 1);
                            }, 2250);
                        }
                    }
                    if (summonSelect.length > 0) {
                        const [p, s, isDestroy] = summonSelect;
                        this.summonSelect[+(p == this.playerIdx)][s] = true;
                        const smnEid = this.players[p].summons[s]?.entityId;
                        setTimeout(() => this._resetSummonSelect(), 500);
                        if (isDestroy) {
                            setTimeout(() => {
                                if (this.players[p].summons[s]?.entityId != smnEid) return;
                                this.players[p].summons.splice(s, 1);
                            }, 2200);
                        }
                    }
                    if (supportSelect.length > 0) {
                        const [p, s, isDestroy] = supportSelect;
                        this.supportSelect[+(p == this.playerIdx)][s] = true;
                        const sptEid = this.players[p].supports[s]?.entityId;
                        setTimeout(() => this._resetSupportSelect(), 500);
                        if (isDestroy) {
                            setTimeout(() => {
                                if (this.players[p].supports[s]?.entityId != sptEid) return;
                                this.players[p].supports.splice(s, 1);
                            }, 800);
                        }
                    }
                    if (handcardSelect.length > 0) {
                        const [p, cidx] = handcardSelect;
                        this.handcardSelect[p] = cidx;
                        setTimeout(() => this._resetHandcardSelect(), 500);
                    }
                } catch (e) {
                    this.initSelect(players);
                    if (retry < 2) {
                        await delay(500);
                        setSelect(retry + 1);
                    } else console.error(e);
                }
            });
        }
        setSelect();
        const destroySts = (hasDmg: boolean = false) => {
            const stsDestroy = (s: Status) =>
                s.hasType(STATUS_TYPE.Accumulate) ||
                !(s.useCnt == 0 || s.roundCnt == 0) ||
                (!hasDmg && s.hasType(STATUS_TYPE.Attack));
            this.players.forEach(p => {
                p.heros.forEach(h => h.heroStatus = h.heroStatus.filter(stsDestroy));
                p.combatStatus = p.combatStatus.filter(stsDestroy);
            });
        }
        if (hasDmg) {
            this.damageVO.dmgSource = damageVO?.dmgSource ?? 'null';
            this.damageVO.dmgElements = damageVO?.dmgElements ?? [];
            this.damageVO.atkPidx = damageVO?.atkPidx ?? -1;
            this.damageVO.atkHidx = damageVO?.atkHidx ?? -1;
            this.damageVO.tarHidx = damageVO?.tarHidx ?? -1;
            const curWillDamages = damageVO?.willDamages ?? [];
            const hasDoubleDmg = curWillDamages.some(([d, p]) => d >= 0 && p > 0);
            this.isShowDmg = true;
            setTimeout(() => {
                this.updateHandCardsPos(players[this.playerIdx]);
                this.players = players;
                this.damageVO.elTips = damageVO?.elTips ?? [];
                this.damageVO.willDamages = hasDoubleDmg ? curWillDamages.map(([d]) => [d, 0]) : curWillDamages;
                this.damageVO.willHeals = damageVO?.willHeals ?? [];
                const setDmgSelect = (retry = 0) => {
                    try {
                        if (damageVO?.dmgSource == 'summon') {
                            const [saidx, suidx] = damageVO.selected ?? [-1, -1];
                            this.summonSelect[+(saidx == this.playerIdx)][suidx] = true;
                        } else if (damageVO?.dmgSource == 'status') {
                            const [spidx, sgroup, shidx, sidx] = damageVO.selected ?? [-1, -1, -1, -1];
                            if (sidx > -1) this.statusSelect[+(spidx == this.playerIdx)][sgroup][shidx][sidx] = true;
                            setTimeout(() => destroySts(true), 2000);
                        }
                    } catch (e) {
                        this.initSelect(players);
                        if (retry < 2) {
                            console.warn(e);
                            setDmgSelect(retry + 1);
                        } else console.error(e);
                    }
                }
                setDmgSelect();
                setTimeout(() => {
                    this.isShowDmg = false;
                    if (damageVO?.dmgSource == 'summon') this._resetSummonSelect();
                    else if (damageVO?.dmgSource == 'status') this._resetStatusSelect();
                }, 1100);
                setTimeout(() => {
                    this._resetDamageVO();
                    if (hasDoubleDmg) {
                        this.damageVO.willDamages = curWillDamages.map(([, p]) => [-1, p]);
                        setTimeout(() => {
                            this.isShowDmg = true;
                            setTimeout(() => this.isShowDmg = false, 1100);
                            setTimeout(() => this._resetDamageVO(), 1600);
                        }, 550);
                    }
                }, 1600);
            }, 550);
        } else {
            this.updateHandCardsPos(players[this.playerIdx]);
            this.players = players;
            if (damageVO && damageVO?.elTips.some(([v]) => v != '')) {
                this.damageVO.elTips = damageVO?.elTips ?? [];
                setTimeout(() => this._resetDamageVO(), 1100);
            }
            // setTimeout(() => destroySts(), 1300);
        }
        this.log = [...log];
    }
    /**
     * 游戏开始时换卡
     * @param cardIdxs 要换的卡的索引数组
     */
    changeCard(cardIdxs: number[]) {
        this.emit({ type: ACTION_TYPE.ChangeCard, cardIdxs, flag: 'changeCard' });
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
            this.isValid = this.player.heros[hidx].hp > 0;
            return this.switchHero();
        }
        if (this.player.phase >= PHASE.ACTION_START && (this.isShowSwitchHero > 0 || this.currSkill.canSelectHero == 1)) { // 准备切换角色
            const hidx = this.player.heros.findIndex(h => this.heroSelect[1][h.hidx] || (this.currSkill.canSelectHero == -1 && h.id == this.modalInfo.info?.id));
            const preview = this.previews.find(pre => pre.type == (this.isShowSwitchHero > 0 ? ACTION_TYPE.SwitchHero : ACTION_TYPE.UseSkill) && pre.heroIdxs?.[0] == hidx);
            if (preview == undefined) throw new Error('未找到切换角色预览');
            if (this.isShowSwitchHero > 0) {
                this.heroSwitchDice = preview.switchHeroDiceCnt!;
                this.isShowSwitchHero = 2 + +!!preview.isQuickAction;
            }
            this.diceSelect = preview.diceSelect!.slice();
            this.heroCanSelect = preview.heroCanSelect!.slice();
            this.heroSelect[1].forEach((_, hidx, harr) => harr[hidx] = +!!preview.heroIdxs!.includes(hidx));
            this.targetSelect[1].forEach((_, hidx, harr) => harr[hidx] = !!preview.heroIdxs!.includes(hidx));
            this.willHp = preview.willHp?.slice() ?? this._resetWillHp();
            this.willAttachs = preview.willAttachs?.slice() ?? this._resetWillAttachs();
            this.willSummons = preview.willSummons?.slice() ?? this._resetWillSummons();
            this.willSwitch = preview.willSwitch?.slice() ?? this._resetWillSwitch();
            this.supportCnt = clone(preview.willSupportChange)!;
            this.energyIcons = clone(preview.energyIcons);
            this.isValid = preview.isValid;
            if (this.currSkill.canSelectHero == -1) this.modalInfo = NULL_MODAL();
        }
    }
    /**
     * 选中角色
     * @param pidx 玩家识别符: 0对方 1我方
     * @param hidx 角色索引idx
     */
    selectHero(pidx: number, hidx: number) {
        if (this.targetSelect[pidx]?.[hidx] && this.currSkill.id > 0) {
            return this.useSkill(this.currSkill.id);
        }
        const isTargetSelect = this.targetSelect[1][hidx];
        this.cancel({ onlySupportAndSummon: true });
        if (this.currSkill.canSelectHero == -1) this._resetTargetSelect();
        if (this.currCard.canSelectHero == 0 || this.player.status == PLAYER_STATUS.DIESWITCH) {
            this.currCard = NULL_CARD();
            if (this.isMobile && this.handcardsSelect > -1) this.mouseleave(this.handcardsSelect, true);
            this.handcardsSelect = -1;
            if (this.currSkill.canSelectHero == -1) {
                const hero = this.players[this.playerIdx ^ pidx ^ 1].heros[hidx];
                this.modalInfo = {
                    version: this.version,
                    isShow: true,
                    type: INFO_TYPE.Hero,
                    info: hero,
                    combatStatus: isCdt(hero?.isFront, this.players[this.playerIdx ^ pidx ^ 1].combatStatus),
                };
            }
            if (pidx == 1 && this.player.status == PLAYER_STATUS.DIESWITCH) {
                if (isTargetSelect) return this.chooseHero();
                this.targetSelect[1].forEach((_, hi, ha) => ha[hi] = hi == hidx && this.player.heros[hi].hp > 0);
            }
        }
        if (this.isLookon > -1) return;
        if (this.currSkill.canSelectHero == -1 && (!this.currCard.hasSubtype(CARD_SUBTYPE.Action) || this.currCard.canSelectHero == 0)) {
            this.currSkill = NULL_SKILL();
        }
        this._resetWillSummons();
        this._resetSummonCnt();
        this._resetWillAttachs();
        if (this.player.phase == PHASE.CHOOSE_HERO && pidx == 1) { // 选择初始出战角色
            this.cancel({ onlyCard: true, notHeros: true });
            if (this.player.heros[hidx]?.isFront) {
                this.modalInfo = NULL_MODAL();
                this.emit({ type: ACTION_TYPE.ChooseInitHero, heroIdxs: [hidx], flag: 'chooseInitHero' });
            } else {
                this.isShowSwitchHero = 1;
                this.targetSelect[pidx].forEach((_, hi, ha) => ha[hi] = hi == hidx);
                this.player.heros.forEach(h => h.isFront = h.hidx == hidx);
                this.player.hidx = hidx;
            }
        } else {
            if ((this.isShowSwitchHero > 1 || this.currSkill.canSelectHero == 1) && pidx == 1 && this.heroCanSelect[hidx]) {
                if (this.heroSelect[1][hidx] > 0) return this.switchHero();
                this.heroSelect[1].forEach((_, hi, ha) => ha[hi] = +(hi == hidx));
                this.targetSelect[1].forEach((_, hi, ha) => ha[hi] = hi == hidx);
                this.chooseHero();
                if (this.currSkill.canSelectHero == -1) this.modalInfo = NULL_MODAL();
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
        if (this.phase != PHASE.ACTION || this.isShowSwitchHero > 1 || this.currSkill.canSelectHero != -1) return true;
        const { id, canSelectHero } = this.currCard;
        if (pidx == 0 || id <= 0 || !this.heroCanSelect[hidx]) {
            this.cancel({ notTarget: true, notSummonSelect: true });
            return true;
        }
        if (this.heroSelect[pidx][hidx] > 0) {
            this.useCard();
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
        if ((this.currCard.id <= 0 && this.currSkill.id == -1) || !this.summonCanSelect[pidx][suidx]) {
            this.cancel();
            return this.showSummonInfo(pidx, suidx);
        }
        const newVal = !this.summonSelect[pidx][suidx];
        if (newVal) {
            this.summonSelect[pidx].forEach((_, i, a) => a[i] = i == suidx);
            this.showSummonInfo(pidx, suidx);
        } else if (this.currSkill.id <= 0) return this.useCard();
        if (this.currSkill.id > 0) return this.selectSkillSummon(suidx, newVal);
        const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseCard && pre.cardIdxs![0] == this.currCard.cidx && pre.summonIdx == (newVal ? suidx : -1));
        this.isValid = !!preview?.isValid;
        this.summonCnt = preview?.willSummonChange ?? this._resetSummonCnt();
        this.willHp = preview?.willHp ?? this._resetWillHp();
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
        if (!newVal) return this.useSkill(this.currSkill.id);
        const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.summonIdx == suidx);
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
                this.currSkill.id = -1;
                this._resetHeroSelect();
                this._resetHeroCanSelect();
                this._resetWillHp();
                this._resetWillSwitch();
                this._resetWillSummons();
                this._resetSummonCnt();
                this._resetWillAttachs();
                this._resetSupportCnt();
                this._resetEnergyIcons();
            } else {
                if (this.diceSelect.indexOf(true) == -1) return this._sendTip('骰子不符合要求');
                this.emit({
                    type: ACTION_TYPE.Reconcile,
                    cardIdxs: [cardIdx],
                    diceSelect: this.diceSelect,
                    flag: 'reconcile',
                });
                this.cancel();
            }
        } else {
            this.cancel();
        }
        return true;
    }
    /**
     * 使用技能
     * @param skid 选组技能的id -1切换角色
     * @param options isOnlyRead 是否为只读
     */
    async useSkill(skid: number, options: { isOnlyRead?: boolean } = {}) {
        this.isShowEndPhase = false;
        this.isShowHandCardInfo = false;
        const { isOnlyRead = false } = options;
        const skidx = this.skills.findIndex(sk => sk.id == skid);
        const isExec = !isOnlyRead && this.modalInfo.skidx == skidx && this.isValid;
        if (skid > -1) this.currSkill = [this.getFrontHero().vehicleSlot?.[1], ...this.getFrontHero().skills].find(sk => sk?.id == skid)!;
        if (this.currCard.id <= 0 && skid > -1 && !isExec) {
            this.modalInfo = {
                version: this.version,
                isShow: true,
                type: INFO_TYPE.Skill,
                skidx,
                info: this.getFrontHero(),
                combatStatus: this.player.combatStatus,
            };
        }
        if (this.opponent.status == PLAYER_STATUS.DIESWITCH || !this.canAction || skid == -1) return;
        if (isExec) {
            this.modalInfo = NULL_MODAL();
            const diceValid = checkDices(this.player.dice.filter((_, di) => this.diceSelect[di]), { skill: this.currSkill });
            const summonSelectValid = this.currSkill.canSelectSummon == -1 || this.summonSelect.reduce((a, c) => Math.max(a, c.indexOf(true)), -1) > -1;
            const heroSelectValid = this.currSkill.canSelectHero == -1 || this.heroSelect[1].indexOf(1) > -1;
            if (!diceValid || !this.isValid || !summonSelectValid || !heroSelectValid) {
                this.cancel();
                return this._sendTip('技能不符合要求');
            }
            this.emit({
                type: ACTION_TYPE.UseSkill,
                skillId: skid,
                diceSelect: this.diceSelect,
                summonIdx: this.summonSelect.reduce((a, c) => Math.max(a, c.indexOf(true)), -1),
                heroIdxs: [this.heroSelect[1].indexOf(1)],
                flag: `useSkill-${this.currSkill.name}-${this.playerIdx}`,
            });
            this.player.dice = this.player.dice.filter((_, i) => !this.diceSelect[i]);
            this.cancel();
            return;
        } else {
            const { canSelectSummon } = this.currSkill;
            const preview = this.previews.find(pre => pre.type == ACTION_TYPE.UseSkill && pre.skillId == skid);
            if (!preview) throw new Error('技能预览未找到');
            this.willHp = [...preview.willHp!.slice()];
            this.willAttachs = clone(preview.willAttachs)!;
            this.willSummons = clone(preview.willSummons)!;
            this.changedSummons = clone(preview.changedSummons)!;
            this.changedHeros = clone(preview.changedHeros)!;
            this.summonCnt = clone(preview.willSummonChange)!;
            this.supportCnt = clone(preview.willSupportChange)!;
            this.willSwitch = preview.willSwitch!;
            this.summonCanSelect = clone(preview.summonCanSelect)!;
            this.heroCanSelect = clone(preview.heroCanSelect)!;
            this.energyIcons = clone(preview.energyIcons);
            this.heroSelect[1].forEach((_, i, a) => a[i] = +(preview.heroIdxs?.[0] == i));
            this._resetTargetSelect();
            this._resetSummonSelect();
            if ((preview.tarHidx ?? -1) != -1) this.targetSelect[0][preview.tarHidx!] = true;
            else if (preview.isValid) this.targetSelect[1][this.player.hidx] = true;
            this.isValid = preview.isValid;
            if (this.isValid) {
                if (canSelectSummon != -1) this.summonSelect[canSelectSummon][0] = true;
                this.diceSelect = [...preview.diceSelect!];
            }
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
        this.emit({
            type: ACTION_TYPE.SwitchHero,
            heroIdxs: [hidx],
            diceSelect: this.diceSelect,
            flag: 'switchHero',
        });
        this.cancel();
    }
    /**
     * 重投骰子
     */
    reroll() {
        this.emit({ type: ACTION_TYPE.Reroll, diceSelect: this.diceSelect, flag: 'reroll' });
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
                type: ({
                    getCard: INFO_TYPE.Card,
                    useCard: INFO_TYPE.Card,
                    getSummon: INFO_TYPE.Summon,
                } as Record<PickCardType, InfoType>)[cardType],
                info: cardType == 'getSummon' ? newSummon(this.version)(this.pickModal.cards[pcidx].id) : this.pickModal.cards[pcidx],
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
        this.emit({
            type: ACTION_TYPE.PickCard,
            cardIdxs: [this.pickModal.selectIdx],
            flag: 'pickCard',
        });
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
        this.emit({ type: ACTION_TYPE.EndPhase, flag: 'endPhase' });
        this.cancel();
    }
    /**
     * 选择观战玩家
     * @param pidx 要观战的玩家idx
     */
    lookonTo(pidx: number) {
        if (this.isLookon == -1 && this.roomId > 0) return;
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
        return this.supportCanSelect;
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
        return this.summonCanSelect;
    }
    /**
     * 重置召唤物次数预览
     */
    private _resetSummonCnt() {
        return this.summonCnt = Array.from({ length: PLAYER_COUNT }, () => new Array(MAX_SUMMON_COUNT).fill(0));
    }
    /**
     * 重置召唤物预览/召唤物变化/角色变化
     */
    private _resetWillSummons(): Summon[][] {
        this.changedSummons.forEach(smns => smns.fill(undefined));
        this.changedHeros.forEach(srcs => srcs.fill(undefined));
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
     * 重置手牌发光
     */
    private _resetHandcardSelect() {
        this.handcardSelect = Array.from({ length: PLAYER_COUNT }, () => -1);
    }
    /**
     * 重置附着预览
     */
    private _resetWillAttachs(players?: Player[]): (ElementType | [ElementType, ElementType])[][][] {
        return this.willAttachs = (players ?? this.players).map(p => p.heros.map(() => []));
    }
    /**
     * 重置伤害预览
     */
    private _resetWillHp() {
        return this.willHp = new Array(this.players.flatMap(p => p.heros).length).fill(undefined);
    }
    /**
     * 重置切人预览
     */
    private _resetWillSwitch() {
        return this.willSwitch = Array.from({ length: PLAYER_COUNT }, (_, i) => new Array(this.players[i]?.heros.length ?? 0).fill(false));
    }
    /**
     * 重置充能预览
     */
    private _resetEnergyIcons() {
        this.energyIcons = undefined;
    }
    /**
     * 重置目标选择预览
     */
    private _resetTargetSelect() {
        this.targetSelect.forEach(p => p.fill(false));
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
    private _resetDamageVO() {
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
     * 初始化闪光数组
     * @param players 玩家数组
     */
    initSelect(players: Player[] = this.players) {
        this.heroCanSelect = (players[this.playerIdx]?.heros ?? []).map(() => false);
        this.targetSelect = players.map(p => p?.heros.map(() => false) ?? []);
        this.statusSelect.forEach((p, pi) => {
            p.forEach((_, i, a) => {
                a[i] = Array.from({ length: players[+(pi == this.playerIdx)]?.heros.length ?? 0 }, () => new Array(MAX_STATUS_COUNT).fill(false));
            });
        });
        this.slotSelect.forEach((_, pi, pa) => {
            pa[pi] = Array.from({ length: players[+(pi == this.playerIdx)]?.heros.length ?? 0 }, () => new Array(4).fill(false));
        });
        this.heroSelect.forEach((_, pi, pa) => {
            pa[pi] = Array.from({ length: players[+(pi == this.playerIdx)]?.heros.length ?? 0 }, () => 0);
        });
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

