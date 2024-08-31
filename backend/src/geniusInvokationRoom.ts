import * as fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, Socket } from 'socket.io';
import {
    ACTION_TYPE, CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CMD_MODE, COST_TYPE, CardSubtype, CardTag, DAMAGE_TYPE, DICE_COST_TYPE, DICE_TYPE, DamageType,
    DiceCostType, ELEMENT_TYPE, ELEMENT_TYPE_KEY, ElementType, PHASE, PLAYER_STATUS, PURE_ELEMENT_CODE, PURE_ELEMENT_CODE_KEY, PURE_ELEMENT_TYPE,
    PURE_ELEMENT_TYPE_KEY, Phase, PureElementCode, PureElementType, SKILL_TYPE, STATUS_GROUP, STATUS_TYPE, SUMMON_DESTROY_TYPE, SkillType, StatusGroup,
    StatusType, Version,
} from '../../common/constant/enum.js';
import {
    DECK_CARD_COUNT, INIT_DICE_COUNT, INIT_HANDCARDS_COUNT, INIT_PILE_COUNT, INIT_ROLL_COUNT, INIT_SWITCH_HERO_DICE, MAX_DICE_COUNT,
    MAX_HANDCARDS_COUNT, MAX_STATUS_COUNT, MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT
} from '../../common/constant/gameOption.js';
import { INIT_PLAYER, NULL_CARD } from '../../common/constant/init.js';
import { ELEMENT_NAME, SKILL_TYPE_NAME, SLOT_CODE } from '../../common/constant/UIconst.js';
import { CardHandleRes, cardsTotal, newCard, parseCard } from '../../common/data/cards.js';
import { newHero, parseHero } from '../../common/data/heros.js';
import { newSkill } from '../../common/data/skills.js';
import { StatusHandleRes, newStatus } from '../../common/data/statuses.js';
import { SummonHandleRes, newSummon } from '../../common/data/summons.js';
import { newSupport } from '../../common/data/supports.js';
import { allHidxs, checkDices, getAtkHidx, getBackHidxs, getHidById, getNearestHidx, getObjById, getObjIdxById, getTalentIdByHid, hasObjById, mergeWillHeals } from '../../common/utils/gameUtil.js';
import { arrToObj, assgin, clone, delay, isCdt, objToArr, parseShareCode, wait } from '../../common/utils/utils.js';
import {
    ActionData, Card, Cmds, Countdown, DamageVO, Hero, LogType, MinuDiceSkill, Player, Preview, ServerData, Skill, Status, StatusTask,
    Summon, Support,
    Trigger
} from '../../typing';
import TaskQueue from './taskQueue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class GeniusInvokationRoom {
    io: Server; // socket.io
    id: number; // 房间id
    name: string; // 房间名
    version: Version; // 游戏版本
    password: string; // 房间密码
    seed: string = ''; // 本局游戏种子(用于处理随机事件)
    players: Player[] = []; // 玩家数组
    watchers: Player[] = []; // 观战玩家
    isStart: boolean = false; // 是否开始游戏
    phase: Phase = PHASE.NOT_READY; // 阶段
    round: number = 1; // 回合数
    startIdx: number = 0; // 先手玩家
    onlinePlayersCnt = 0; // 在线玩家数
    winner: number = -1; // 赢家序号
    taskQueue: TaskQueue = new TaskQueue(); // 任务队列
    ischangeTurn: boolean = false; // 是否转换回合人
    entityIdIdx: number = -500000; // 实体id序号标记
    previews: Preview[] = []; // 当前出战玩家预览
    log: { content: string, type: LogType }[] = []; // 当局游戏的日志
    countdown: Countdown = { limit: 0, curr: 0, timer: undefined }; // 倒计时
    isDev: boolean = false; // 是否为开发模式
    isGettingCard: NodeJS.Timeout | null = null; // 是否正在抓牌
    isDiscarding: NodeJS.Timeout | null = null; // 是否正在弃牌
    isAddingCard: NodeJS.Timeout | null = null; // 是否正在加牌入牌库
    newStatus: (id: number, ...args: any) => Status;
    newCard: (id: number, ...args: any) => Card;
    newHero: (id: number) => Hero;
    newSummon: (id: number, ...args: any) => Summon;
    newSkill: (id: number) => Skill;
    newSupport: (id: number | Card) => Support;
    private _currentPlayerIdx: number = 0; // 当前回合玩家 currentPlayerIdx
    private _random: number = 0; // 随机数

    constructor(io: Server, id: number, name: string, version: Version, password: string, countdown: number, isDev: boolean) {
        this.io = io;
        this.id = id;
        this.name = name || `房间${id}`;
        this.version = version;
        this.password = password;
        this.countdown.limit = countdown;
        this.isDev = isDev;
        this.newStatus = newStatus(version);
        this.newCard = newCard(version);
        this.newHero = newHero(version);
        this.newSummon = newSummon(version);
        this.newSupport = (id: number | Card) => {
            if (typeof id === 'number') return newSupport(version)(this.newCard(id));
            return newSupport(version)(id);
        }
        this.newSkill = newSkill(version);
    }
    get currentPlayerIdx() {
        return this._currentPlayerIdx;
    }
    set currentPlayerIdx(val: number) {
        this._currentPlayerIdx = (val + PLAYER_COUNT) % PLAYER_COUNT;
    }
    /**
     * 手动设置种子
     * @param rt 种子
     * @returns this
     */
    setSeed(rt: string | number) {
        this.seed = rt.toString();
        this._random = +rt;
        return this;
    }
    /**
     * 获取随机数
     * @param max 随机数最大值
     * @returns 随机整数[0, max]
     */
    private _randomInt(max: number = 1) {
        this._random = (this._random * 13 + 29) % 1e10;
        return Math.floor(this._random % 1e6 / 1e6 * (max + 1));
    }
    /**
     * 获取数组中随机一项
     * @param arr 数组
     * @returns 数组中随机一项
     */
    private _randomInArr<T>(arr: T[]) {
        return arr[this._randomInt(arr.length - 1)];
    }
    /**
     * 生成一个实体id
     * @returns 实体id
     */
    private _genEntityId() {
        return this.entityIdIdx--;
    }
    /**
     * 写入日志
     * @param log 日志内容
     * @param isOnlySystem 是否只记录为系统日志
     */
    private _writeLog(log: string, type: LogType = 'log') {
        if (type != 'system') this.log.push({ content: log.replace(/{[^\{\}]+}/g, ''), type });
        fs.appendFile(`${__dirname}/../../../logs/${this.seed}.log`, log.replace(/\{|\}/g, '') + '\n', err => {
            if (err) return console.error('err:', err);
        });
    }
    /**
     * 获取预览
     * @param pidx 玩家序号
     */
    private _getPreview(pidx: number) {
        const players = clone(this.players);
        const previews: Preview[] = [];
        previews.push(...this._previewSkill(pidx));
        previews.push(...this._previewCard(pidx, players));
        previews.push(...this._previewSwitch(pidx));
        assgin(this.players, players);
        return previews;
    }
    /**
     * 触发事件
     * @param flag 触发事件标志
     * @param pidx 触发玩家序号
     * @param options.tip 提示
     * @param options.actionInfo 动作信息
     * @param options.damageVO 伤害信息
     * @param options.notPreview 不预览
     * @param options.isActionInfo 是否显示动作信息
     * @param options.notUpdate 是否更新状态
     * @param options.isQuickAction 是否为快速行动
     * @param options.isChange 是否为转回合
     */
    emit(flag: string, pidx: number, options: {
        socket?: Socket, tip?: string | string[], actionInfo?: string, damageVO?: DamageVO, notPreview?: boolean, notUpdate?: boolean,
        isQuickAction?: boolean, canAction?: boolean, isChange?: boolean,
        isActionInfo?: boolean, slotSelect?: number[], heroSelect?: number[], statusSelect?: number[], summonSelect?: number[],
    } = {}) {
        const { socket, tip = '', actionInfo = '', damageVO = -1, notPreview = false, isActionInfo = false, canAction = true,
            slotSelect = [], heroSelect = [], statusSelect = [], summonSelect = [], notUpdate = false, isQuickAction = false,
            isChange = false } = options;
        const hasDmg = damageVO != -1 && ((damageVO?.willDamages?.length ?? 0) > 0 || (damageVO?.willHeals?.length ?? 0) > 0);
        this.players.forEach(p => {
            p.handCards.forEach((c, ci) => c.cidx = ci);
            p.heros.forEach(h => {
                if (!notUpdate) h.heroStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(p.pidx, [], h.heroStatus, true, p.heros, p.combatStatus, h.hidx));
                this._calcSkillChange(p.pidx, h.hidx);
            });
            if (!notUpdate) p.combatStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(p.pidx, [], p.combatStatus, true, p.heros, p.combatStatus, p.hidx));
            p.summons.splice(0, MAX_SUMMON_COUNT, ...this._updateSummon(p.pidx, [], p.summons, p, true));
            p.canAction = canAction && (p.pidx == this.currentPlayerIdx || !isChange) &&
                (isQuickAction || p.canAction) && this.taskQueue.isTaskEmpty() &&
                this.isStart && p.phase == PHASE.ACTION && p.status == PLAYER_STATUS.PLAYING &&
                p.heros.every(h => h.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.ReadySkill))) &&
                p.combatStatus.every(sts => !sts.hasType(STATUS_TYPE.ReadySkill));
            if (p.UI.willGetCard.length > 0 && this.isGettingCard == null) {
                this._writeLog(`[${p.name}]抓${p.UI.willGetCard.length}张牌【p${p.pidx}:${p.UI.willGetCard.map(c => `[${c.name}]`).join('')}】`);
                this.isGettingCard = setTimeout(() => {
                    const rest = MAX_HANDCARDS_COUNT - p.handCards.length;
                    p.handCards.push(...p.UI.willGetCard.slice(0, rest));
                    p.UI.willGetCard = [];
                    this.isGettingCard = null;
                    this.emit(flag + '-doCmd--getCard', pidx);
                }, 1500 + (hasDmg ? 550 : 0));
            }
            if (p.UI.willDiscard[0].length + p.UI.willDiscard[1].length > 0 && this.isDiscarding == null) {
                this._writeLog(`[${p.name}]舍弃了${p.UI.willDiscard.map(cs => cs.map(c => `[${c.name}]`).join('')).join('')}`);
                this.isDiscarding = setTimeout(() => {
                    p.UI.willDiscard.forEach((_, i, a) => a[i] = []);
                    this.isDiscarding = null;
                    this.emit(flag + '-doCmd--discard', pidx);
                }, 1500 + (hasDmg ? 550 : 0));
            }
            const { scope, isRandom, cards, isNotPublic } = p.UI.willAddCard;
            if (cards.length > 0 && this.isAddingCard == null) {
                const cardMap = {};
                cards.forEach(c => cardMap[c.name] = (cardMap[c.name] ?? 0) + 1);
                const cardStr = Object.entries(cardMap).map(([name, cnt]) => `${cnt}张[${name}]`).join('');
                this._writeLog(`[${p.name}]将${isNotPublic ? `${cards.length}张牌` : `${cardStr}`}${isRandom ? '随机' : '均匀'}加入牌库${scope != 0 ? `${scope > 0 ? '顶' : '底'}${Math.abs(scope)}张` : ''}`);
                this.isAddingCard = setTimeout(() => {
                    const cnt = cards.length;
                    const cscope = scope || p.pile.length;
                    if (isRandom) {
                        const ranIdxs: number[] = [];
                        for (let i = 1; i <= cnt; ++i) {
                            let pos = this._randomInt(cscope - i) * Math.sign(cscope);
                            if (cscope < 0 && pos == 0) pos = p.pile.length;
                            ranIdxs.push(pos);
                        }
                        ranIdxs.sort((a, b) => (a - b) * cscope).forEach(pos => p.pile.splice(pos, 0, cards.shift()!));
                    } else {
                        const step = parseInt(`${cscope / (cnt + 1)}`);
                        let rest = Math.abs(cscope % (cnt + 1));
                        for (let i = 1; i <= cnt; ++i) {
                            let pos = step * i + ((i - 1 + Math.min(rest, i))) * Math.sign(step);
                            if (cscope < 0 && pos == 0) pos = p.pile.length;
                            p.pile.splice(pos, 0, cards.shift()!);
                        }
                    }
                    this._writeLog(`[${p.name}]加牌后牌库：${p.pile.map(c => `[${c.name}]`).join('')}`, 'system');
                    this.isAddingCard = null;
                    p.UI.willAddCard = {
                        cards: [],
                        scope: 0,
                        isRandom: true,
                        isNotPublic: false,
                    }
                    this.emit(flag + '-doCmd--addcard', pidx);
                }, 2250);
            }
        });
        const previews: Preview[] = [];
        this._calcCardChange(pidx);
        // 计算预测行动的所有情况
        if (this.phase == PHASE.ACTION && !notPreview && this.players[this.currentPlayerIdx].canAction) {
            previews.push(...this._getPreview(this.currentPlayerIdx));
            this.previews = previews;
        }
        const serverData: ServerData = {
            players: [],
            previews: [],
            phase: this.phase,
            isStart: this.isStart,
            round: this.round,
            currCountdown: this.countdown.curr,
            log: [],
            pileCnt: this.players.map(p => p.pile.length),
            diceCnt: this.players.map(p => p.dice.length),
            handCardsCnt: this.players.map(p => p.handCards.length),
            damageVO,
            tip: typeof tip == 'string' ? tip : '',
            actionInfo: '',
            isWin: this.winner,
            slotSelect,
            heroSelect,
            statusSelect,
            summonSelect,
            flag: `[${this.id}]${flag}-p${pidx}`,
        };
        const _serverDataVO = (pidx: number, tip: string | string[]) => {
            const log = this.log.map(lg => {
                const cpidx = +(lg.content.match(/(?<=【p)\d+(?=:)/)?.[0] ?? -1);
                if (cpidx > -1 && pidx == cpidx) return { content: lg.content.replace(/【p\d+:([^【】]+)】/g, '$1'), type: lg.type };
                if (cpidx == -1 && pidx == this.currentPlayerIdx) return { content: lg.content.replace(/[【】]/g, ''), type: lg.type };
                return { content: lg.content.replace(/【[^【】]+】/g, ''), type: lg.type }
            });
            return {
                players: this.players.map(pvo => {
                    if (pvo.pidx == pidx) {
                        return {
                            ...pvo,
                            pile: [],
                        }
                    }
                    return {
                        ...pvo,
                        UI: {
                            ...pvo.UI,
                            willGetCard: pvo.UI.willGetCard.map(() => NULL_CARD()),
                            willAddCard: {
                                ...pvo.UI.willAddCard,
                                cards: pvo.UI.willAddCard.cards.map(c => pvo.UI.willAddCard.isNotPublic ? NULL_CARD() : c),
                            }
                        },
                        pile: [],
                        playerInfo: [],
                        dice: [],
                        handCards: [],
                    }
                }),
                previews: pidx == this.currentPlayerIdx ? this.previews : [],
                ...(typeof tip != 'string' ? { tip: tip[pidx] } :
                    tip.includes('{p}') ? { tip: tip.replace(/{p}/, pidx == this.currentPlayerIdx ? '你的' : '对方') } : {}),
                log: log.map(v => v.content),
                actionInfo: actionInfo || (isActionInfo ? log.filter(lg => lg.type == 'info').at(-1)?.content ?? '' : ''),
            }
        }
        console.info(serverData.flag);
        if (socket) {
            socket.emit('getServerInfo', Object.freeze({
                ...serverData,
                ..._serverDataVO(pidx, tip),
            }));
        } else {
            this.io.to(`7szh-${this.id}`).emit('getServerInfo', Object.freeze(serverData));
            this.players.forEach(p => {
                this.io.to(`7szh-${this.id}-p${p.pidx}`).emit('getServerInfo', Object.freeze({
                    ...serverData,
                    ..._serverDataVO(p.pidx, tip),
                }));
            });
        }
    }
    /**
     * 初始化玩家信息
     * @param newPlayer 新加入房间的玩家
     * @returns 格式化后的玩家
     */
    init(newPlayer: Pick<Player, 'id' | 'name'>) {
        const pidx = this.players.length + this.watchers.length;
        const player: Player = {
            ...INIT_PLAYER(),
            id: newPlayer.id,
            name: newPlayer.name,
            rid: this.id,
        };
        if (pidx < PLAYER_COUNT) {
            this.players.push(player);
            this.onlinePlayersCnt = Math.min(PLAYER_COUNT, this.players.length);
        } else {
            this.watchers.push(player);
        }
        this.players.forEach((p, pi) => p.pidx = pi);
        console.info(`init-rid:${this.id}-[${newPlayer.name}]pid:${newPlayer.id}-pidx:${pidx}`);
        this.emit(`player[${player.name}] enter room `, pidx);
        return player;
    }
    /**
     * 开始游戏
     * @param pidx 玩家序号
     * @param flag 标志
     */
    start(pidx: number, flag: string) {
        this.seed = Math.floor(Math.random() * 1e10).toString();
        this._random = +this.seed;
        const d = new Date();
        const format = (n: number) => String(n).padStart(2, '0');
        console.info(`[${this.id}]start-seed:${this.seed}`);
        this.seed = `${d.getFullYear()}-${format(d.getMonth() + 1)}-${format(d.getDate())}-${format(d.getHours())}-${format(d.getMinutes())}-${format(d.getSeconds())}-` + this.seed;
        this.entityIdIdx = -500000;
        this.isStart = true;
        this.currentPlayerIdx = this.isDev ? 1 : this.players[1].id == 1 ? 0 : this._randomInt(PLAYER_COUNT);
        this.startIdx = this.currentPlayerIdx;
        this.phase = PHASE.CHANGE_CARD;
        this.winner = -1;
        this.round = 1;
        this.log = [];
        this.players.forEach(p => {
            p.phase = this.phase;
            p.hidx = -1;
            p.heros.forEach((h, hidx) => {
                h.entityId = this._genEntityId();
                h.hidx = hidx;
            });
            p.supports = [];
            p.summons = [];
            p.dice = [];
            p.combatStatus.splice(0, MAX_STATUS_COUNT);
            p.status = PLAYER_STATUS.WAITING;
            p.playerInfo.isUsedlegend = false;
            p.playerInfo.weaponTypeCnt = new Set(p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Weapon)).map(c => c.id)).size;
            p.playerInfo.weaponCnt = p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Weapon)).length;
            p.playerInfo.artifactTypeCnt = new Set(p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Artifact)).map(c => c.id)).size;
            p.playerInfo.artifactCnt = p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Artifact)).length;
            p.playerInfo.talentTypeCnt = new Set(p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Talent)).map(c => c.id)).size;
            p.playerInfo.talentCnt = p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Talent)).length;
            p.playerInfo.initCardIds = [...new Set(p.pile.map(c => c.id))];
            const pileIdxPool = Array.from({ length: INIT_PILE_COUNT }, (_, i) => i);
            const piles = [...p.pile];
            p.pile = [];
            while (pileIdxPool.length > 0) {
                const cidx = this._randomInt(pileIdxPool.length - 1);
                const [cardIdx] = pileIdxPool.splice(cidx, 1);
                p.pile.push(piles[cardIdx]);
            }
            for (let i = 0; i < INIT_HANDCARDS_COUNT; ++i) {
                const legendIdx = p.pile.findIndex((c, ci) => ci >= i && c.hasSubtype(CARD_SUBTYPE.Legend));
                if (legendIdx == -1) break;
                [p.pile[i], p.pile[legendIdx]] = [p.pile[legendIdx], p.pile[i]];
            }
            p.handCards = p.pile.splice(0, INIT_HANDCARDS_COUNT).map(c => c.setEntityId(this._genEntityId()));
            p.UI.info = `${this.startIdx == p.pidx ? '我方' : '对方'}先手`;
            this._writeLog(`[${p.name}]获得手牌${p.handCards.map(c => `[${c.name}]`).join('')}`, 'system');
            this._writeLog(`[${p.name}]牌库：${p.pile.map(c => `[${c.name}]`).join('')}`, 'system')
        });
        this.emit(flag, pidx);
    }
    /**
     * 获取行动
     * @param actionData 行动数据
     * @param socket 发送请求socket
     */
    getAction(actionData: ActionData, socket: Socket) {
        if (this.taskQueue.isExecuting) return;
        const { cpidx = this.currentPlayerIdx, deckIdx = -1, shareCode = '', cardIdxs = [], heroIdxs = [],
            diceSelect = [], skillId = -1, summonIdx = -1, supportIdx = -1, flag = 'noflag' } = actionData;
        const player = this.players[cpidx];
        switch (actionData.type) {
            case ACTION_TYPE.StartGame:
                player.deckIdx = deckIdx;
                const { heroIds, cardIds } = parseShareCode(shareCode);
                if (heroIds.includes(0) || cardIds.length < DECK_CARD_COUNT) return this.emit('deckCompleteError', cpidx, { socket, tip: '当前出战卡组不完整' });
                player.heros = heroIds.map(parseHero);
                player.pile = cardIds.map(parseCard);
                if (player.heros.some(h => h.version > this.version) || player.pile.some(c => c.version > this.version)) return this.emit('deckVersionError', cpidx, { socket, tip: '当前卡组版本不匹配' });
                player.phase = (player.phase ^ 1) as Phase;
                if (this.players.every(p => p.phase == PHASE.NOT_BEGIN)) { // 双方都准备开始
                    this.start(cpidx, flag);
                } else {
                    this.emit(flag, cpidx, { socket });
                }
                break;
            case ACTION_TYPE.ChangeCard:
                this._changeCard(cpidx, cardIdxs, socket, flag);
                break;
            case ACTION_TYPE.ChooseInitHero:
                this._chooseInitHero(cpidx, heroIdxs[0], socket, flag);
                break;
            case ACTION_TYPE.Reroll:
                this._reroll(diceSelect, cpidx, socket, flag);
                break;
            case ACTION_TYPE.SwitchHero:
                this._switchHero(cpidx, heroIdxs[0], flag, { socket, diceSelect });
                break;
            case ACTION_TYPE.UseSkill:
                const useDices = player.dice.filter((_, di) => diceSelect[di]);
                const isValid = checkDices(useDices, { skill: player.heros[player.hidx].skills.find(sk => sk.id == skillId) });
                if (!isValid) this.emit('useSkillDiceInvalid', cpidx, { socket, tip: '骰子不符合要求', notPreview: true });
                else {
                    player.dice = player.dice.filter((_, di) => !diceSelect[di]);
                    this._useSkill(cpidx, skillId);
                }
                break;
            case ACTION_TYPE.UseCard:
                this._useCard(cpidx, cardIdxs[0], diceSelect, socket, { selectHeros: heroIdxs, selectSummon: summonIdx, selectSupport: supportIdx });
                break;
            case ACTION_TYPE.Reconcile:
                this._reconcile(cpidx, diceSelect, cardIdxs[0], socket, flag);
                break;
            case ACTION_TYPE.EndPhase:
                this._doEndPhase(cpidx, flag);
                break;
            case ACTION_TYPE.GiveUp:
                this._giveup(cpidx);
                break;
            default:
                const a: never = actionData.type;
                throw new Error(`@getACtion: 未知的ActionType[${a}]`);
        }
    }
    /**
     * 仅开发用
     * @param actionData 开发调试数据
     */
    getActionDev(actionData: {
        cpidx: number, cmds: Cmds[], dices: DiceCostType[], hps: { hidx: number, hp: number }[],
        clearSts: { hidx: number, stsid: number }[], getSts: { hidxs: number[], stsid: number }[],
        attachs: { hidx: number, el: number, isAdd: boolean }[], disCardCnt: number, smnIds: number[],
        sptIds: number[], flag: string
    }) {
        const { cpidx, cmds, dices, attachs, hps, disCardCnt, clearSts, getSts, smnIds, sptIds, flag } = actionData;
        const player = this.players[cpidx];
        const heros = player.heros;
        for (const { hidx, el, isAdd } of attachs) {
            if (!isAdd || el == 0) {
                if (hidx >= heros.length) heros.forEach(h => (h.attachElement = []));
                else heros[hidx].attachElement = [];
            }
            if (el > 0 && el < 8) {
                if (hidx >= heros.length) heros.forEach(h => h.attachElement.push(PURE_ELEMENT_CODE_KEY[el as PureElementCode]));
                else heros[hidx].attachElement.push(PURE_ELEMENT_CODE_KEY[el as PureElementCode]);
            }
        }
        for (const { hidx, hp } of hps) {
            if (hidx >= heros.length) heros.forEach(h => h.hp = hp);
            else heros[hidx].hp = hp;
        }
        for (const { hidx, stsid } of clearSts) {
            if (stsid == 0 || stsid == -1) {
                if (hidx >= heros.length) heros.forEach(h => h.heroStatus.splice(0, MAX_STATUS_COUNT));
                else heros[hidx].heroStatus.splice(0, MAX_STATUS_COUNT);
            }
            if (stsid == 0 || stsid == -2) {
                player.combatStatus.splice(0, MAX_STATUS_COUNT);
            }
        }
        const stscmds: Cmds[] = [];
        for (const { hidxs, stsid } of getSts) {
            stscmds.push({ cmd: 'getStatus', status: [newStatus(this.version)(stsid)], hidxs });
        }
        if (dices) player.dice = dices;
        if (disCardCnt < 0) player.handCards.splice(disCardCnt, 10);
        this._doCmds(cpidx, [...cmds, ...stscmds]);
        while (smnIds.length > 0 && player.summons.length < MAX_SUMMON_COUNT) {
            player.summons.push(this.newSummon(smnIds.shift()!).setEntityId(this._genEntityId()));
        }
        while (sptIds.length > 0 && player.supports.length < MAX_SUPPORT_COUNT) {
            player.supports.push(this.newSupport(sptIds.shift()!).setEntityId(this._genEntityId()));
        }
        this.emit(flag, cpidx);
    }
    /**
     * 替换手牌
     * @param pidx 玩家序号
     * @param cardIdxs 要替换的手牌序号
     * @param flag flag
     */
    private _changeCard(pidx: number, cardIdxs: number[], socket: Socket, flag: string) { // 换牌
        const player = this.players[pidx];
        const handCardsLen = player.handCards.length;
        const blackIds = new Set<number>();
        cardIdxs.forEach(cidx => blackIds.add(player.handCards[cidx].id));
        const oldCards = player.handCards.filter((_, idx) => cardIdxs.includes(idx));
        player.handCards = player.handCards.filter((_, idx) => !cardIdxs.includes(idx));
        while (oldCards.length > 0) {
            player.pile.splice(this._randomInt(player.pile.length - 1), 0, oldCards.shift()!);
        }
        let newIdx = 0;
        while (player.handCards.length < handCardsLen && newIdx < player.pile.length - 1) {
            const newCard = player.pile[newIdx++];
            if (blackIds.has(newCard.id)) continue;
            player.pile.splice(--newIdx, 1);
            player.handCards.push(newCard);
        }
        if (player.handCards.length < handCardsLen) {
            player.handCards.push(player.pile.shift()!);
        }
        if (this.phase == PHASE.ACTION) {
            setTimeout(() => {
                player.phase = PHASE.ACTION;
                this.emit(flag + '-action', pidx);
            }, 1e3);
        } else {
            this._writeLog(player.handCards.reduce((a, c) => a + `[${c.name}]`, `[${player.name}]换牌后手牌为`), 'system');
            player.UI.info = `${this.startIdx == player.pidx ? '我方' : '对方'}先手，等待对方选择......`;
            setTimeout(() => {
                player.phase = PHASE.CHOOSE_HERO;
                this.emit(flag + '-init', pidx, { tip: '选择出战角色', socket });
            }, 1e3);
        }
        this.emit(flag, pidx, { socket });
    }
    /**
     * 选择初始出战角色
     * @param pidx 玩家序号
     * @param hidx 将要切换的角色序号
     * @param socket socket
     * @param flag flag
     */
    private _chooseInitHero(pidx: number, hidx: number, socket: Socket, flag: string) {
        const player = this.players[pidx];
        player.hidx = hidx;
        if (player.heros[hidx].isFront) { // 确认选择
            player.phase = PHASE.DICE;
            this._writeLog(`[${player.name}]选择[${player.heros[hidx].name}]出战`);
        } else { // 预选
            player.heros.forEach(h => h.isFront = h.hidx == hidx);
        }
        if (this.players.every(p => p.phase == PHASE.DICE)) { // 双方都选完出战角色
            this.phase = PHASE.DICE;
            this.players.forEach(player => {
                player.dice = this._rollDice(player.pidx);
                player.UI.showRerollBtn = true;
                this._writeLog(player.dice.reduce((a, c) => a + `[${ELEMENT_NAME[c].replace(/元素/, '')}]`, `[${player.name}]初始骰子为`), 'system');
            });
            this.emit(flag, pidx, { tip: '骰子投掷阶段' });
        } else {
            this.emit(flag, pidx, { socket });
        }
    }
    /**
     * 切换角色
     * @param pidx 玩家序号
     * @param hidx 要切换的角色序号
     * @param flag flag
     * @param options.diceSelect 骰子数组, 如果为undefined则为被动切换
     * @param options.socket socket
     * @param options.isSwitchSkill 是否为切换后直接使用技能
     * @param options.isQuickAction 是否为快速行动
     * @param options.notChangeTurn 是否不进行回合转换
     * @param options.trigger 触发切换角色的时机
     */
    private async _switchHero(pidx: number, hidx: number, flag: string,
        options: { socket?: Socket, diceSelect?: boolean[], isQuickAction?: boolean, notChangeTurn?: boolean, trigger?: Trigger } = {}) {
        const { socket, diceSelect, notChangeTurn = false, trigger } = options;
        let { isQuickAction = false } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const dieChangeBack = ([PHASE.DIE_CHANGE_ACTION, PHASE.DIE_CHANGE_ACTION_END] as Phase[]).includes(player.phase);
        const { switchHeroDiceCnt: needDices = INIT_SWITCH_HERO_DICE } = this.previews.find(pre => pre.type == ACTION_TYPE.SwitchHero && pre.heroIdxs![0] == hidx) ?? {};
        if (!dieChangeBack && diceSelect && diceSelect.filter(d => d).length != needDices) return this.emit('switchHeroDiceError', pidx, { socket, tip: '骰子不符合要求' })
        if (trigger != 'phase-end') {
            this.taskQueue.addTask('switchHero', [[async () => {
                this._doActionAfter(pidx, isQuickAction);
                this.emit(flag, pidx, { tip: isCdt(isQuickAction, '继续{p}回合'), isActionInfo: true });
                await this._execTask();
            }, 1e3]], true);
        }
        let switchHeroDiceCnt = 0;
        const cmds: Cmds[] = [];
        const ohidx = player.hidx;
        if (dieChangeBack) { // 被击倒后选择出战角色
            const { isQuickAction: slotiqa } = this._detectSlot(pidx ^ 1, 'kill', { heros: opponent.heros, isQuickAction });
            isQuickAction ||= slotiqa;
            const { isQuickAction: stsiqa } = this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'kill', { isQuickAction, isOnlyFront: true });
            isQuickAction ||= stsiqa;
            player.phase -= 3;
            const isOppoActioning = this.players[pidx ^ 1].phase == PHASE.ACTION;
            player.UI.info = isOppoActioning ? '对方行动中....' : '';
            const isActioning = player.phase == PHASE.ACTION;
            this.players[pidx ^ 1].UI.info = isActioning ? '对方行动中....' : '对方结束已结束回合...';
            if (isOppoActioning) this.players[this.currentPlayerIdx].canAction = true;
        } else if (diceSelect != undefined) { // 主动切换角色
            switchHeroDiceCnt = this._calcHeroSwitchDice(pidx, hidx, ohidx, true);
            isQuickAction = this._detectSkill(pidx, 'change-from', { hidxs: ohidx }).isQuickAction;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change', { hidxs: ohidx, switchHeroDiceCnt }).switchHeroDiceCnt;
            const { isQuickAction: stsiqaf, switchHeroDiceCnt: stschdf } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-from', { isQuickAction, switchHeroDiceCnt, hidxs: [ohidx] });
            isQuickAction = stsiqaf;
            switchHeroDiceCnt = stschdf;
            const { isQuickAction: stsiqat, switchHeroDiceCnt: stschdt } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-to', { isQuickAction, switchHeroDiceCnt, hidxs: [hidx] });
            isQuickAction = stsiqat;
            switchHeroDiceCnt = stschdt;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change-from', { hidxs: ohidx, switchHeroDiceCnt }).switchHeroDiceCnt;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change', { hidxs: getBackHidxs(player.heros), switchHeroDiceCnt }).switchHeroDiceCnt;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change-to', { hidxs: hidx, switchHeroDiceCnt }).switchHeroDiceCnt;
            isQuickAction = this._detectSummon(pidx, 'change-from', { isQuickAction }).isQuickAction;
            const { cmds: supportcmd, isQuickAction: stiqa } = this._detectSupport(pidx, 'change', { isQuickAction, switchHeroDiceCnt, hidx });
            this._detectSummon(pidx ^ 1, 'change-oppo');
            isQuickAction = stiqa;
            cmds.push(...supportcmd);
            player.dice = player.dice.filter((_, i) => !diceSelect?.[i]);
        }
        this._writeLog(`[${player.name}]切换为[${player.heros[hidx].name}]出战${isQuickAction && !dieChangeBack ? '(快速行动)' : ''}`);
        this._doSwitchHeroAfter(pidx, hidx, ohidx);
        this._detectStatus(pidx, STATUS_TYPE.Attack, 'change-from', { hidxs: [ohidx], fhidx: ohidx, isQuickAction: isCdt(isQuickAction, 2) });
        this._detectStatus(pidx, STATUS_TYPE.Attack, 'change-to', { hidxs: [hidx], isQuickAction: isCdt(isQuickAction, 2) });
        this._doCmds(pidx, cmds);
        this.emit(flag + '-immediately', pidx);
        if (dieChangeBack) {
            const { cmds: killedcmds } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'killed', { hidxs: [ohidx] });
            this._doCmds(pidx, killedcmds);
            player.heros[ohidx].heroStatus.splice(0, MAX_STATUS_COUNT, ...player.heros[ohidx].heroStatus.filter(sts => sts.hasType(STATUS_TYPE.NonDestroy)));
        }
        await this._execTask();
        this._changeTurn(pidx, isQuickAction || notChangeTurn, 'switchHero', { dieChangeBack });
        if (!isQuickAction) player.canAction = false;
    }
    /**
     * 切换角色后的处理
     * @param pidx 玩家序号
     * @param toHidx 切换到的角色序号
     * @param fromHidx 原出战角色序号
     */
    private _doSwitchHeroAfter(pidx: number, toHidx: number, fromHidx: number) {
        this.players[pidx].isFallAtk = true;
        this.players[pidx].hidx = toHidx;
        this._detectSkill(pidx, 'change-to', { hidxs: toHidx });
        this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-to', { hidxs: [toHidx] });
        this._detectStatus(pidx, STATUS_TYPE.ReadySkill, 'change-from', { hidxs: [fromHidx], isOnlyHeroStatus: true });
        this.players[pidx].heros.forEach((h, idx) => h.isFront = idx == toHidx);
    }
    /**
     * 投骰子
     * @param pidx 玩家序号
     * @param diceSelect 骰子数组
     * @returns 新的骰子数组
     */
    private _rollDice(pidx: number, diceSelect: boolean[] = []) {
        const isInit = this.phase == PHASE.DICE && diceSelect.length == 0;
        const player = this.players[pidx];
        const dices = isInit ? [] : [...player.dice];
        const diceIdxs: number[] = diceSelect.map((s, i) => ({ s, i })).filter(v => v.s).map(v => v.i);
        const scnt = dices.length - diceIdxs.length;
        const tmpDice = arrToObj<DiceCostType, number>(Object.values(DICE_COST_TYPE), 0);
        let diceLen = isInit ? INIT_DICE_COUNT : dices.length;
        dices.forEach((d, di) => { if (!diceIdxs.includes(di)) ++tmpDice[d]; });
        if (isInit) { // 投掷阶段检测
            player.heros.forEach((h, hi) => {
                for (const slot of [h.artifactSlot, h.talentSlot, h.weaponSlot]) {
                    if (slot == null) continue;
                    const slotres = slot.handle(slot, { heros: player.heros, hidxs: [hi], trigger: 'phase-dice' });
                    if (this._hasNotTriggered(slotres.trigger, 'phase-dice')) continue;
                    const { element = DICE_COST_TYPE.Omni, cnt = 0 } = slotres;
                    tmpDice[element] += cnt;
                    diceLen -= cnt;
                }
            });
            for (const support of player.supports) {
                const supportres = support.handle(support, { trigger: 'phase-dice' });
                if (this._hasNotTriggered(supportres.trigger, 'phase-dice')) continue;
                let { element = DICE_COST_TYPE.Omni, cnt = 0, addRollCnt = 0 } = supportres;
                if (element == -2) element = this._getFrontHero(pidx).element as DiceCostType;
                tmpDice[element] += cnt;
                diceLen -= cnt;
                player.rollCnt += addRollCnt;
            }
        }
        for (let i = 0; i < diceLen - scnt; ++i) {
            if (this.isDev) ++tmpDice[DICE_COST_TYPE.Omni];
            else ++tmpDice[this._randomInArr(Object.values(DICE_COST_TYPE))];
        }
        const heroEle: DiceCostType[] = [...player.heros]
            .filter(h => h.element != ELEMENT_TYPE.Physical)
            .sort((a, b) => +!a.isFront - +!b.isFront)
            .map(h => h.element as PureElementType);
        const ndices: DiceCostType[] = [];
        while (tmpDice[DICE_COST_TYPE.Omni]-- > 0) {
            ndices.push(DICE_COST_TYPE.Omni);
        }
        for (let i = 0; i < player.heros.length; ++i) { // 先排出战角色骰子，再排在场角色骰子
            while (tmpDice[heroEle[i]]-- > 0) {
                ndices.push(heroEle[i]);
            }
        }
        const restDice = objToArr(tmpDice).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a) as [DiceCostType, number][];
        for (const idx in restDice) { // 剩余骰子数量多的排前面
            while (restDice[idx][1]-- > 0) {
                ndices.push(restDice[idx][0]);
            }
        }
        return ndices;
    }
    /**
     * 重投骰子
     * @param diceSelect 骰子数组
     * @param pidx 玩家序号
     * @param socket socket
     * @param flag flag
     */
    private _reroll(diceSelect: boolean[], pidx: number, socket: Socket, flag: string) {
        const player = this.players[pidx];
        if (player.rollCnt <= 0 || !player.UI.showRerollBtn) return;
        player.dice = this._rollDice(pidx, diceSelect);
        this._writeLog(player.dice.reduce((a, c) => a + `[${ELEMENT_NAME[c].replace(/元素/, '')}]`, `[${player.name}]重投骰子后`), 'system');
        if (this.phase == PHASE.ACTION) { // 行动阶段重投
            setTimeout(() => {
                player.phase = PHASE.ACTION;
                player.rollCnt = INIT_ROLL_COUNT;
                this.emit(flag + '-action', pidx);
            }, 1e3);
        } else { // 每回合开始时重投
            if (--player.rollCnt <= 0) {
                player.UI.showRerollBtn = false;
                setTimeout(async () => {
                    player.phase = PHASE.ACTION_START;
                    if (this.players.every(p => p.phase == PHASE.ACTION_START)) { // 双方都重投完骰子
                        this._doReset();
                        await delay(1e3);
                        this._doPhaseStart(flag, pidx);
                    } else {
                        this.emit(`${flag}-finish`, pidx, { socket });
                    }
                }, 800);
            }
        }
        this.emit(flag, pidx, { socket });
    }
    /**
     * 调和骰子
     * @param pidx 玩家序号
     * @param diceSelect 骰子数组
     * @param cardIdx 要调和的卡牌序号
     * @param flag flag
     */
    private async _reconcile(pidx: number, diceSelect: boolean[], cardIdx: number, socket: Socket, flag: string) {
        if (diceSelect.indexOf(true) == -1) return this.emit('reconcileDiceError', pidx, { socket, tip: '骰子不符合要求' });
        const player = this.players[pidx];
        const currCard = player.handCards[cardIdx];
        const reconcileDice = this._getFrontHero(pidx).element as DiceCostType;
        if (player.dice.every(d => d == DICE_COST_TYPE.Omni || d == reconcileDice)) return this.emit('reconcileDiceError', pidx, { socket, tip: '没有可以调和的骰子' });
        if (currCard.hasTag(CARD_TAG.NonReconcile)) return this.emit('reconcileCardError', pidx, { socket, tip: '该卡牌不能调和' });
        this._detectStatus(pidx, STATUS_TYPE.Usage, 'reconcile', { card: currCard, isQuickAction: 2 });
        this._detectSupport(pidx, 'reconcile', { isQuickAction: true });
        player.dice = player.dice.map((d, di) => diceSelect[di] ? reconcileDice : d);
        player.dice = this._rollDice(pidx);
        player.handCards = player.handCards.filter((_, ci) => ci != cardIdx);
        ++player.playerInfo.reconcileCnt;
        this._writeLog(`[${player.name}]【将[${currCard.name}]】进行了调和`);
        this._doActionAfter(pidx);
        this.emit(flag, pidx, { isActionInfo: true });
        await delay(1100);
        await this._execTask();
        await this._doActionStart(pidx);
    }
    /**
     * 检查选择技能的骰子是否合法
     * @param pidx 玩家序号
     * @param skid 技能id
     * @param isSwitch 切换的角色序号
     * @returns 选择骰子情况的数组
     */
    private _checkSkill(pidx: number, skid: number, isSwitch: number = -1) {
        const player = this.players[pidx];
        const skill = this._calcSkillChange(pidx, player.hidx, { isSwitch, skid });
        if (!skill) throw new Error('@_checkSkill: 技能不存在');
        let anyDiceCnt = skill.cost[1].cnt - skill.costChange[1];
        let { cnt: elementDiceCnt, type: costType } = skill.cost[0];
        elementDiceCnt -= skill.costChange[0];
        const diceSelect: boolean[] = [];
        const diceLen = player.dice.length;
        if (costType == COST_TYPE.Same) {
            let maxDice: DiceCostType | null = null;
            const frontEl = this._getFrontHero(pidx).element as DiceCostType;
            const diceCnt = arrToObj<DiceCostType, number>(Object.values(DICE_COST_TYPE), 0);
            player.dice.forEach(d => ++diceCnt[d]);
            for (let i = diceLen - 1, max = 0; i >= 0; --i) {
                const dice = player.dice[i];
                if (dice == DICE_COST_TYPE.Omni) break;
                const cnt = diceCnt[dice];
                if (cnt >= elementDiceCnt) {
                    if (dice == frontEl && maxDice != null && max + diceCnt[DICE_COST_TYPE.Omni] >= elementDiceCnt) break;
                    maxDice = dice;
                    break;
                }
                if (cnt > max && (diceCnt[frontEl] <= cnt || elementDiceCnt - cnt <= diceCnt[frontEl])) {
                    max = cnt;
                    maxDice = dice;
                }
            }
            for (let i = diceLen - 1, tmpcnt = elementDiceCnt; i >= 0; --i) {
                const dice = player.dice[i];
                if (dice != maxDice && dice != DICE_COST_TYPE.Omni) diceSelect.unshift(false);
                else diceSelect.unshift(tmpcnt-- > 0);
            }
        } else {
            for (let i = diceLen - 1; i >= 0; --i) {
                const dice = player.dice[i];
                if (anyDiceCnt-- > 0) diceSelect.unshift(true);
                else if (costType == dice && elementDiceCnt > 0) {
                    diceSelect.unshift(true);
                    --elementDiceCnt;
                } else diceSelect.unshift(dice == DICE_COST_TYPE.Omni && elementDiceCnt-- > 0);
            }
        }
        return diceSelect;
    }
    /**
     * 使用技能
     * @param pidx 玩家序号
     * @param skid 技能id/技能类型 -1切换角色 -2使用卡/召唤物造成伤害
     * @param options.isPreview 是否为预览
     * @param options.withCard 是否为使用卡
     * @param options.isSwitch 是否切换角色
     * @param options.isReadySkill 是否为准备技能
     * @param options.otriggers 触发数组(出牌或切换角色时)
     * @param options.willDamages 使用卡/召唤物造成的伤害
     * @param options.dmgElement 使用卡/召唤物造成的伤害元素
     * @param options.isSummon 是否为召唤物预览
     */
    private _useSkill(pidx: number, skid: number | SkillType, options: {
        isPreview?: boolean, withCard?: Card, isSwitch?: number, isReadySkill?: boolean, otriggers?: Trigger | Trigger[],
        willDamages?: number[][], dmgElement?: DamageType, isSummon?: number,
    } = {}) {
        const { isPreview = false, withCard, isSwitch = -1, isReadySkill = false, otriggers = [], willDamages, dmgElement, isSummon = -1 } = options;
        const isExec = !isPreview || isReadySkill;
        const mergeWillSwitch = (oWillSwtich: boolean[][], resWillSwitch?: boolean[][]) => {
            if (!resWillSwitch) return;
            oWillSwtich.forEach((ws, wsi) => {
                ws.forEach((_, i) => ws[i] ||= resWillSwitch[wsi][i])
            });
        }
        const epidx = pidx ^ 1;
        const oplayers = clone(this.players);
        const players = clone(this.players);
        const player = () => players[pidx];
        const opponent = () => players[epidx];
        const aHeros = () => player().heros;
        const ahlen = aHeros().length;
        const eHeros = () => opponent().heros;
        const ehlen = eHeros().length;
        const allHeros = () => [...eHeros(), ...aHeros()];
        const aSummons = () => player().summons;
        const ahidx = () => player().hidx;
        const ehidx = () => opponent().hidx;
        const aCombatStatus = () => player().combatStatus;
        let dmgedHidx = ehidx();
        const hidx = isSwitch > -1 ? isSwitch : player().hidx;
        // 判断准备技能和切换角色的技能
        const skill = this._calcSkillChange(pidx, hidx, { isReadySkill, isSwitch, skid });
        if (skill) skid = skill.id;
        const willDamagesPre: number[][] = players.flatMap(p => Array.from({ length: p.heros.length }, () => [-1, 0]));
        const willAttachPre: PureElementType[][] = players.flatMap(p => Array.from({ length: p.heros.length }, () => []));
        const skillcmds: Cmds[] = [];
        const eskillcmds: Cmds[] = [];
        let isQuickAction = false;
        let switchAtkPre = 0;
        if (isSwitch > -1) { // 切换角色
            const changeTriggers: Trigger[] = ['change-from', 'change-to'];
            const statusAtks: StatusTask[] = [];
            statusAtks.push(...this._detectStatus(pidx, STATUS_TYPE.Attack, 'change-from', { isOnlyFront: true, isExec: false }).statusAtks);
            statusAtks.push(...this._detectStatus(pidx, STATUS_TYPE.Attack, 'change-to', { hidxs: [isSwitch], isExec: false }).statusAtks);
            switchAtkPre = statusAtks.length;
            if (statusAtks.length > 0 && !isExec) {
                for (let i = 0; i < switchAtkPre; ++i) {
                    const { entityId: stsId, group: stsGroup } = statusAtks[i];
                    const sts = [aHeros()[ahidx()].heroStatus, aCombatStatus()][stsGroup].find(sts => sts.entityId == stsId);
                    if (sts == undefined) throw new Error('@_useSkill: status not found');
                    for (const trigger of changeTriggers) {
                        const stsres = sts.handle(sts, {
                            heros: aHeros(),
                            eheros: eHeros(),
                            trigger,
                            hidx,
                        });
                        const stsreshidxs = stsres.hidxs ?? getBackHidxs(eHeros());
                        const {
                            willDamages: wdmg0, willAttachs: wath0, players: players0, elrcmds: elrcmds0, isQuickAction: iqa0,
                        } = this._calcDamage(
                            pidx,
                            (stsres.element ?? ELEMENT_TYPE.Physical) as ElementType,
                            Array.from({ length: ehlen }, ((_, i) => [
                                i == dmgedHidx ? (stsres.damage ?? -1) : -1,
                                stsreshidxs.includes(i) ? (stsres.pdmg ?? 0) : 0
                            ])),
                            dmgedHidx,
                            players,
                            {
                                isExec,
                                usedDice: skill?.cost.reduce((a, b) => a + b.cnt, 0),
                                withCard,
                                skid,
                                sktype: skill?.type,
                                isFallAtk: true,
                                minusDiceSkillIds: skill?.costChange[2],
                                minusDiceSkill: skill?.costChange[3],
                            }
                        );
                        wdmg0.forEach((dmg, di) => willDamagesPre[di] = allHeros()[di].hp > 0 ? [...dmg] : [-1, 0]);
                        for (let i = 0; i < ehlen; ++i) {
                            const wath = wath0[i];
                            if (wath == undefined) continue;
                            willAttachPre[i + epidx * ahlen].push(wath);
                        }
                        assgin(players, players0);
                        skillcmds.push(...elrcmds0[0]);
                        eskillcmds.push(...elrcmds0[1]);
                        isQuickAction ||= iqa0;
                    }
                }
            }
            if (isQuickAction) {
                // todo 如果是速动
            }
        }
        const oSummonEids = players[pidx].summons.map(smn => smn.entityId);
        const supportCnt: number[][] = players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        const aElTips: [string, PureElementType, PureElementType][] = [];
        const aDmgElements: DamageType[] = new Array(ehlen + ahlen).fill(DAMAGE_TYPE.Physical);
        const aWillAttach: PureElementType[][] = clone(willAttachPre);
        const aWillDamages: number[][] = new Array(ahlen + ehlen).fill(0).map(() => [-1, 0]);
        const aWillHeal: number[] = new Array(ahlen + ehlen).fill(-1);
        const willSwitch: boolean[][] = Array.from({ length: players.length }, (_, i) => players[i].heros.map(() => false));
        const isChargedAtk = skill?.type == SKILL_TYPE.Normal && ((player().dice.length + (!isPreview ? skill.cost[0].cnt + skill.cost[1].cnt - (withCard ? withCard.costChange : skill.costChange[0] - skill.costChange[1]) : 0)) % 2) == 0;
        const isFallAtk = skill?.type == SKILL_TYPE.Normal && (player().isFallAtk || isSwitch > -1);
        const reviveSlot = eHeros().map(h => {
            if (!h.talentSlot?.hasTag(CARD_TAG.NonDefeat)) return 0;
            return h.talentSlot.handle(h.talentSlot, { trigger: 'will-killed' }).execmds?.find(({ cmd }) => cmd == 'revive')?.cnt ?? 0
        });
        const skillres = skill?.handle({
            hero: aHeros()[hidx],
            heros: aHeros(),
            combatStatus: aCombatStatus(),
            eheros: eHeros(),
            skid,
            card: withCard,
            hcards: player().handCards,
            summons: aSummons(),
            isChargedAtk,
            isFallAtk,
            isReadySkill,
            isExec,
            swirlEl: eHeros().find(h => h.isFront)?.attachElement?.find(el => ([ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro, ELEMENT_TYPE.Cryo] as ElementType[]).includes(el)),
            playerInfo: player().playerInfo,
            trigger: `skilltype${skill.type}`,
            talent: !isPreview ? aHeros()[hidx].talentSlot : isCdt(withCard?.id == getTalentIdByHid(aHeros()[hidx].id), withCard) ?? aHeros()[hidx].talentSlot,
            randomInArr: this._randomInArr.bind(this),
        }) ?? {};
        if (isExec) skillres.exec?.();
        const atriggers: Trigger[][] = new Array(ahlen).fill(0).map(() => []);
        const etriggers: Trigger[][] = new Array(ehlen).fill(0).map(() => []);
        const bWillHeal: number[] = clone(aWillHeal);
        if (skillres.atkOffset != undefined) dmgedHidx = this._getFrontHero(epidx, { offset: skillres.atkOffset }).hidx;
        if (skillres.atkTo != undefined) dmgedHidx = skillres.atkTo;
        const skillreshidxs = skillres.hidxs ?? getBackHidxs(eHeros());
        const oWillDamages = willDamages ?? (skill ? new Array(ahlen + ehlen).fill(0).map((_, di) => {
            if (di >= ehlen) {
                const ahi = di - ehlen;
                const pierceDmgOppo = (skillres.hidxs ?? [hidx]).includes(ahi) ? (skillres.pdmgSelf ?? 0) : 0;
                return [-1, pierceDmgOppo]
            }
            const addDmg = skillres.addDmgCdt ?? 0;
            const elDmg = di == dmgedHidx && skill.damage + addDmg > 0 ? skill.damage + skill.dmgChange + addDmg : -1;
            const pierceDmg = skillreshidxs.includes(di) ? (skillres.pdmg ?? 0) : 0;
            return [elDmg, pierceDmg]
        }) : undefined);
        const dmgEl = dmgElement ?? (skill ? skillres.dmgElement ?? (skill.attachElement != ELEMENT_TYPE.Physical ? skill.attachElement : skill.dmgElement) : undefined);
        const stsprecmds: Cmds[] = [
            { cmd: 'getStatus', status: [...(skillres.statusPre ?? [])], hidxs: skillres.hidxs },
            { cmd: 'getStatus', status: [...(skillres.statusOppoPre ?? [])], hidxs: skillres.hidxs, isOppo: true },
        ];
        this._doCmds(pidx, stsprecmds, { players, ahidx: hidx, ehidx: dmgedHidx, isAction: true });
        if (skillres.summonPre) assgin(player().summons, this._updateSummon(pidx, skillres.summonPre, aSummons(), player()));
        if (skillres.heal) {
            const { willHeals } = this._doCmds(pidx, [{ cmd: 'heal', cnt: skillres.heal, hidxs: skillres.hidxs ?? [hidx] }], { players, isExec });
            mergeWillHeals(aWillHeal, willHeals?.[0]);
        }
        const { willHeals: skillheal, willSwitch: skillswitch } = this._doCmds(pidx, skillres.cmds, { players, isExec });
        mergeWillSwitch(willSwitch, skillswitch);
        mergeWillHeals(aWillHeal, skillheal?.[0]);
        if (dmgEl && oWillDamages) {
            const { willDamages: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1, supportCnt: supportCnt1,
                players: players1, elTips: elTips1, atriggers: atriggers1, etriggers: etriggers1, elrcmds: elrcmds1,
                aWillHeals: ahealres, bWillHeals: bhealres, isQuickAction: iqa1
            } = this._calcDamage(
                pidx,
                dmgEl,
                oWillDamages,
                dmgedHidx,
                players,
                {
                    isExec,
                    skid,
                    sktype: skill?.type,
                    withCard,
                    isChargedAtk,
                    isFallAtk,
                    isReadySkill,
                    isSummon,
                    multiDmg: skillres.multiDmgCdt,
                    usedDice: skill?.cost.reduce((a, b) => a + b.cnt, 0),
                    aWillHeals: aWillHeal,
                    bWillHeals: bWillHeal,
                    atriggers,
                    etriggers,
                    minusDiceSkillIds: skill?.costChange[2],
                    minusDiceSkill: skill?.costChange[3],
                }
            );
            assgin(aDmgElements, dmgElements1);
            assgin(aElTips, elTips1);
            for (let i = 0; i < ehlen; ++i) {
                const willAttachs = willAttachs1[i];
                if (willAttachs == undefined) continue;
                aWillAttach[i + epidx * ahlen].push(willAttachs);
            }
            assgin(players, players1);
            atriggers1.forEach((at, ati) => atriggers[ati].push(...at));
            etriggers1.forEach((et, eti) => etriggers[eti].push(...et));
            isQuickAction ||= iqa1;
            aWillHeal.forEach((_, awhi, awha) => awha[awhi] = ahealres[awhi]);
            bWillHeal.forEach((_, awhi, awha) => awha[awhi] = ahealres[awhi]);
            mergeWillHeals(bWillHeal, bhealres);
            supportCnt.forEach((_, sti, sta) => sta[sti].forEach((_, i, a) => a[i] += supportCnt1[sti][i]));
            skillcmds.push(...elrcmds1[0]);
            eskillcmds.push(...elrcmds1[1]);
            willDamage1.forEach((dmg, di) => { aWillDamages[di] = allHeros()[di].hp > 0 ? [...dmg] : [-1, 0] });
            const stsaftercmds: Cmds[] = [
                { cmd: 'getStatus', status: [...(skillres.statusAfter ?? [])], hidxs: skillres.hidxs },
                { cmd: 'getStatus', status: [...(skillres.statusOppoAfter ?? [])], hidxs: skillres.hidxs, isOppo: true },
            ];
            this._doCmds(pidx, stsaftercmds, { players, ahidx: hidx, ehidx: dmgedHidx, isAction: true });
            if (skillres.summon) assgin(aSummons(), this._updateSummon(pidx, skillres.summon, aSummons(), player()));
            if (skillres.isAttach) {
                const { elTips: elTips2 = [], willAttachs: willAttachs2 = [] } = this._doCmds(pidx, [{ cmd: 'attach', hidxs: [hidx] }], { players, isExec });
                for (let i = 0; i < ahlen; ++i) aElTips[i + pidx * ehlen] = elTips2[i + pidx * ehlen];
                for (let i = 0; i < ahlen; ++i) aWillAttach[i + pidx * ehlen] = willAttachs2[i + pidx * ehlen];
            }
        }

        const odmgedHidx = opponent().hidx;
        const bPlayers = clone(players);
        const bWillAttach: PureElementType[][] = clone(aWillAttach);
        const bWillDamages: number[][][] = [aWillDamages];
        if (isPreview && switchAtkPre > 0) bWillDamages.unshift(clone(willDamagesPre));
        let isSwitchAtk = false;
        const isSwitchSelf = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd.includes('switch') && !cmds.isOppo);
        const isSwitchOppo = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd.includes('switch') && cmds.isOppo);
        const calcAtk = (res: any, type: string, stsId: number, ahidx: number, ehidx: number, skid = -1, isSelf = 0) => {
            const cpidx = pidx ^ +!isSelf;
            const dmgedHidx = +!!res.isSelf ^ isSelf ? ehidx : ahidx;
            const dmgedHlen = +!!res.isSelf ^ isSelf ? ehlen : ahlen;
            const atkHidx = isSelf ? ahidx : ehidx;
            if (res?.heal) {
                let willHeals: number[] | undefined;
                if (type.includes('Status')) {
                    if (res.heal) {
                        [willHeals] = this._doCmds(cpidx, [{ cmd: 'heal', cnt: res.heal, hidxs: res.hidxs ?? [atkHidx] }], { players: bPlayers }).willHeals ?? [];
                    }
                } else {
                    [willHeals] = this._doCmds(cpidx, res?.cmds, { hidxs: [atkHidx], players: bPlayers }).willHeals ?? [];
                }
                mergeWillHeals(bWillHeal, willHeals, bPlayers);
            }
            if (res?.damage == undefined && res?.pdmg == undefined) return false;
            if (ahidx == -1) ahidx = hidx;
            if (ehidx == -1) ehidx = odmgedHidx;
            const reshidxs = res?.hidxs ?? getBackHidxs(bPlayers[cpidx ^ +!!res.isSelf].heros);
            const willDamages = new Array(dmgedHlen).fill(0).map<number[]>((_, i) => [
                i == dmgedHidx ? (res?.damage ?? -1) : -1,
                reshidxs.includes(i) ? (res?.pdmg ?? 0) : 0
            ]);
            const { willDamages: willDamage3, willAttachs: willAttachs3, supportCnt: supportCnt3,
                players: players3, elrcmds: elrcmds3, etriggers: etriggers3, atriggers: atriggers3,
            } = this._calcDamage(
                cpidx,
                res.element,
                willDamages,
                dmgedHidx,
                bPlayers,
                {
                    isExec: false,
                    skid,
                    isAtkSelf: +!!res.isSelf,
                }
            );
            const { isSwitch: csw = -1, isSwitchOppo: cswo = -1 } = this._doCmds(cpidx, elrcmds3[0], { isExec: false, isAction: true });
            if (cswo == -1 && type == 'die') return true;
            let obj: Summon | Status | undefined;
            if (type.includes('Status')) {
                if (type == 'combatStatus') obj = bPlayers[cpidx].combatStatus.find(sts3 => sts3.id == stsId);
                else if (type == 'heroStatus') obj = bPlayers[cpidx].heros[isSelf ? ahidx : ehidx].heroStatus.find(sts3 => sts3.id == stsId);
                res?.exec?.(obj, { heros: bPlayers[cpidx].heros, eheros: bPlayers[cpidx ^ 1].heros });
            }
            supportCnt.forEach((_, sti, sta) => sta[sti].forEach((_, i, a) => a[i] += supportCnt3[sti][i]));
            assgin(bPlayers, players3);
            for (let i = 0; i < dmgedHlen; ++i) {
                const willAttachs = willAttachs3[i];
                if (willAttachs == undefined) continue;
                bWillAttach[i + (cpidx ^ +!res.isSelf) * (isSelf ? ehlen : ahlen)].push(willAttachs);
            }
            bWillDamages.push(willDamage3);
            if (isSelf) {
                ahidx = cswo > -1 ? cswo : ahidx;
                ehidx = csw > -1 ? csw : ehidx;
            } else {
                ahidx = csw > -1 ? csw : ahidx;
                ehidx = cswo > -1 ? cswo : ehidx;
            }
            if (isSelf) {
                if (isSwitchOppo(elrcmds3[0])) atriggers3[hidx].push('change-from', 'change-to');
                const { statusAtks } = this._detectStatus(pidx, STATUS_TYPE.Attack, atriggers3[hidx], { hidxs: [ahidx], isExec: false });
                if (statusAtks.length > 0) isSwitchAtk = true;
                doAfterStatus(bPlayers[pidx].heros[ahidx].heroStatus, ahidx, STATUS_GROUP.heroStatus, atriggers3[ahidx], ahidx, ehidx, 1, true);
                doAfterStatus(bPlayers[pidx].combatStatus, ahidx, STATUS_GROUP.combatStatus, atriggers3[hidx], ahidx, ehidx, 1, true);
            } else {
                if (isSwitchOppo(elrcmds3[0])) etriggers3[hidx].push('change-from', 'change-to');
                const { statusAtks } = this._detectStatus(epidx, STATUS_TYPE.Attack, etriggers3[odmgedHidx], { hidxs: [ehidx], isExec: false });
                if (statusAtks.length > 0) isSwitchAtk = true;
                doAfterStatus(bPlayers[epidx].heros[ehidx].heroStatus, ehidx, STATUS_GROUP.heroStatus, etriggers3[ehidx], ahidx, ehidx, 0, true);
                doAfterStatus(bPlayers[epidx].combatStatus, ehidx, STATUS_GROUP.combatStatus, etriggers3[odmgedHidx], ahidx, ehidx, 0, true);
            }
            return false;
        }
        const doAfterStatus = (ostatus: Status[], hi: number, group: StatusGroup, trgs: Trigger[], ahidx: number, ehidx: number, isSelf = 0, isAfterSwitch = false) => {
            const status = clone(ostatus);
            if (ahidx == -1) ahidx = hidx;
            if (ehidx == -1) ehidx = odmgedHidx;
            const cpidx = pidx ^ +!isSelf;
            const chidx = isSelf ? ahidx : ehidx;
            const atkStatus: [StatusTask, boolean][] = [];
            for (const sts of status) {
                if (sts.useCnt == 0 && !sts.hasType(STATUS_TYPE.Shield)) continue;
                for (const state of trgs) {
                    const stsres = sts.handle(sts, {
                        heros: bPlayers[cpidx].heros,
                        combatStatus: bPlayers[cpidx].combatStatus,
                        eheros: bPlayers[cpidx ^ 1].heros,
                        eCombatStatus: bPlayers[cpidx ^ 1].combatStatus,
                        hidx: hi,
                        skilltype: skill?.type,
                        trigger: state,
                        dmgedHidx: ehidx,
                        hasDmg: aWillDamages[chidx + cpidx * players[0].heros.length][0] > 0,
                        isChargedAtk: isSelf ? isChargedAtk : false,
                    });
                    const isSelfAtk = +!!stsres.isSelf;
                    if (this._hasNotTriggered(stsres.trigger, state)) continue;
                    if (sts.hasType(STATUS_TYPE.Attack) && (stsres.damage || stsres.pdmg || stsres.heal)) {
                        if (isExec) {
                            atkStatus.push([{
                                id: sts.id,
                                entityId: sts.entityId,
                                group,
                                pidx: cpidx,
                                isSelf: isSelfAtk,
                                trigger: state,
                                isAfterSwitch,
                                hidx: hi,
                                skid,
                            }, state.includes('get') && !state.includes('oppo')]);
                        }
                        const dmg = new Array(ahlen + ehlen).fill(0).map((_, di) => bWillDamages.reduce((a, b) => a + b[di][0] + b[di][1], 0));
                        const willKill = isSelf ? dmg[pidx * ahlen + ehidx] >= bPlayers[cpidx ^ 1].heros[ehidx].hp : dmg[(cpidx ^ 1) * ehlen + ahidx] >= bPlayers[cpidx].heros[ahidx].hp;
                        if (calcAtk(stsres, willKill ? 'die' : (['hero', 'combat'][group] + 'Status'), sts.id, ahidx, ehidx, skid, isSelf)) continue;
                    }
                }
            }
            return { atkStatus }
        }
        const { ndices, isSwitch: swc = -1, isSwitchOppo: swco = -1, willSwitch: askswitch } = this._doCmds(pidx, skillcmds, {
            heros: bPlayers[pidx].heros,
            eheros: bPlayers[epidx].heros,
            isExec,
            isAction: true,
        });
        mergeWillSwitch(willSwitch, askswitch);
        const { ndices: edices, willSwitch: eskswitch } = this._doCmds(epidx, eskillcmds, {
            heros: bPlayers[epidx].heros,
            eheros: bPlayers[pidx].heros,
            isExec,
            isAction: true,
        });
        mergeWillSwitch(willSwitch, eskswitch);
        skillcmds.push(...(skillres.cmds ?? []));
        const dtriggers: Trigger[] = [];
        if (typeof otriggers == 'string') dtriggers.push(otriggers);
        else dtriggers.push(...otriggers);
        const aswhidx = isSwitchSelf(skillcmds) ? swc : skid == -1 && dtriggers.includes('change-to') ? isSwitch : ahidx();
        const eswhidx = isSwitchOppo(skillcmds) ? swco : dmgedHidx;
        if (skill) {
            const [_afterAOnlySkillTrgs, afterEOnlySkillTrgs] = [atriggers, etriggers]
                .map(xtrgs => xtrgs.map(trgs => trgs.filter(trg => trg.startsWith('skill')).map(trg => ('after-' + trg)) as Trigger[]));
            for (let i = 0; i < ehlen; ++i) {
                const hidxs = (dmgedHidx + i) % ehlen;
                const slotres = this._detectSlot(epidx, afterEOnlySkillTrgs[hidxs], {
                    hidxs,
                    players: bPlayers,
                    isExec,
                    getdmg: bWillDamages.reduce((a, c) => {
                        return c.slice(epidx * ahlen, epidx * ahlen + ehlen).map(([dmg, pdmg], hi) => {
                            if (dmg == -1 && pdmg == 0) return a[hi];
                            return Math.max(0, a[hi]) + Math.max(0, dmg) + pdmg;
                        });
                    }, new Array(ehlen).fill(-1)),
                });
                mergeWillHeals(bWillHeal, slotres.willHeals);
            }
            const [afterASkillTrgs, afterESkillTrgs] = [atriggers, etriggers]
                .map(xtrgs => xtrgs.map(trgs => trgs.map(trg => trg.startsWith('skill') ? 'after-' + trg : trg.startsWith('after-') ? trg.slice(6) : trg) as Trigger[]));
            const atkStatues: StatusTask[] = [];
            const atkStatuesUnshift: StatusTask[] = [];
            for (let i = 0; i < ehlen; ++i) {
                const hi = (odmgedHidx + i) % ehlen;
                const h = bPlayers[epidx].heros[hi];
                afterESkillTrgs[hi].push('status-destroy');
                const { atkStatus: atkhst } = doAfterStatus(h.heroStatus, hi, STATUS_GROUP.heroStatus, afterESkillTrgs[hi], aswhidx, eswhidx);
                atkhst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
                if (i == 0) {
                    const { atkStatus: atkcst } = doAfterStatus(bPlayers[epidx].combatStatus, hi, STATUS_GROUP.combatStatus, afterESkillTrgs[hi], aswhidx, eswhidx);
                    atkcst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
                }
            }
            for (let i = 0; i < ahlen; ++i) {
                const hi = (hidx + i) % ahlen;
                const h = bPlayers[pidx].heros[hi];
                afterASkillTrgs[hi].push('status-destroy');
                const { atkStatus: atkhst } = doAfterStatus(h.heroStatus, hi, STATUS_GROUP.heroStatus, afterASkillTrgs[hi], aswhidx, eswhidx, 1);
                atkhst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
                if (i == 0) {
                    const { atkStatus: atkcst } = doAfterStatus(bPlayers[pidx].combatStatus, hi, STATUS_GROUP.combatStatus, afterASkillTrgs[hi], aswhidx, eswhidx, 1);
                    atkcst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
                }
            }
            this.taskQueue.addStatusAtk(atkStatues);
            this.taskQueue.addStatusAtk(atkStatuesUnshift.reverse(), true);
            for (const smn of bPlayers[pidx].summons) {
                if (!oSummonEids.includes(smn.entityId)) continue;
                ([`after-skilltype${skill.type}`, 'after-skill'] as Trigger[]).forEach(trg => {
                    const { smnres } = this._detectSummon(pidx, trg, { csummon: [smn], heros: bPlayers[pidx].heros, hcard: withCard, isExec });
                    if (smnres) calcAtk(smnres, 'summon', smn.id, aswhidx, eswhidx, skid, 1);
                });
            }
        }
        if (isSwitchOppo(skillcmds)) {
            const { statusAtks } = this._detectStatus(epidx, STATUS_TYPE.Attack, ['change-from', 'change-to'], { hidxs: [odmgedHidx], isExec: false, players: bPlayers });
            if (statusAtks.length > 0) isSwitchAtk = true;
            doAfterStatus(bPlayers[epidx].heros[odmgedHidx].heroStatus, odmgedHidx, STATUS_GROUP.heroStatus, ['change-from', 'change-to'], aswhidx, eswhidx, 0, true);
            doAfterStatus(bPlayers[epidx].combatStatus, odmgedHidx, STATUS_GROUP.combatStatus, ['change-from', 'change-to'], aswhidx, eswhidx, 0, true);
        }
        if (skid == -1 || isSwitchSelf(skillcmds)) {
            const triggers: Trigger[] = skid == -1 ? dtriggers : ['change-from', 'change-to'];
            const { statusAtks } = this._detectStatus(pidx, STATUS_TYPE.Attack, triggers, { hidxs: [hidx], isExec: false, players: bPlayers });
            if (statusAtks.length > 0) isSwitchAtk = true;
            doAfterStatus(bPlayers[pidx].heros[ahidx()].heroStatus, ahidx(), STATUS_GROUP.heroStatus, triggers, aswhidx, eswhidx, 1, true);
            doAfterStatus(bPlayers[pidx].combatStatus, ahidx(), STATUS_GROUP.combatStatus, triggers, aswhidx, eswhidx, 1, true);
        }
        const stscmds: Cmds[] = [
            { cmd: 'getStatus', status: skillres.status, hidxs: skillres.hidxs },
            { cmd: 'getStatus', status: skillres.statusOppo, hidxs: skillres.hidxs, isOppo: true },
        ];
        this._doCmds(pidx, stscmds, { players, ahidx: hidx, ehidx: dmgedHidx, isExec, isAction: true });
        let willHp: (number | undefined)[] = new Array(ahlen + ehlen).fill(undefined);
        const willSummons: Summon[][] = [[], []];
        const summonCnt: number[][] = players.map(() => new Array(MAX_SUMMON_COUNT).fill(0));
        if (!isExec) {
            willHp = willHp.map((_, i) => {
                const alldamage = bWillDamages.reduce((a, b) => a + Math.max(0, b[i][0]) + Math.max(0, b[i][1]), 0);
                const hasVal = bWillDamages.some(v => v[i][0] >= 0 || v[i][1] > 0) || bWillHeal[i] > 0;
                if (!hasVal) {
                    if (bWillHeal[i] == 0) return 100;
                    return undefined;
                }
                const res = Math.max(0, bWillHeal[i]) - alldamage;
                const whpidx = Math.floor(i / (pidx == 0 ? ehlen : ahlen));
                const whhidx = i % (pidx == 0 ? ehlen : ahlen);
                const hero = this.players[whpidx].heros[whhidx];
                if (hero.hp <= 0 && res <= 0) return undefined;
                if (res + hero.hp <= 0) {
                    let restHp: number | undefined;
                    if (hero.talentSlot?.hasTag(CARD_TAG.NonDefeat) && reviveSlot[whhidx] > 0) {
                        restHp = reviveSlot[whhidx] - hero.hp;
                    }
                    if (restHp == undefined) {
                        const isReviveSts = hero.heroStatus.find(sts => sts.hasType(STATUS_TYPE.NonDefeat));
                        if (isReviveSts) {
                            restHp = (isReviveSts.handle(isReviveSts, { trigger: 'will-killed' }).cmds?.find(({ cmd }) => cmd == 'revive')?.cnt ?? 0) - hero.hp;
                        }
                    }
                    if (restHp != undefined) {
                        return restHp - 0.3;
                    }
                }
                return res;
            });
            willSummons[0] = bPlayers[epidx].summons.filter(wsmn => this.players[epidx].summons.every(smn => smn.id != wsmn.id))
                .map(wsmn => (wsmn.UI.isWill = true, wsmn));
            willSummons[1] = bPlayers[pidx].summons.filter(wsmn => this.players[pidx].summons.every(smn => smn.id != wsmn.id))
                .map(wsmn => {
                    const nsmn = wsmn.handle(wsmn, { skid }).willSummon ?? wsmn;
                    nsmn.UI.isWill = true;
                    return nsmn;
                });
            summonCnt.forEach((smns, pi, smna) => {
                const osmn = oplayers[pi].summons;
                const nsmn = bPlayers[pi].summons;
                smna[pi] = smns.map((_, si) => {
                    if (osmn.length - 1 < si || (pi == pidx && nsmn[si].handle(nsmn[si], { skid }).willSummon)) return 0;
                    const smnCnt = getObjById(nsmn, osmn[si].id)?.useCnt ?? 0;
                    return smnCnt - osmn[si].useCnt;
                });
            });
        } else if (skill || skid > 0) {
            players[pidx].isFallAtk = false;
            players[pidx].canAction = false;
            if (ndices) player().dice = ndices;
            if (edices) opponent().dice = edices;
            if (isSwitchAtk) {
                // todo 先等待？
            }
            assgin(this.players, players);
            if (skill) this._writeLog(`[${player().name}][${aHeros()[player().hidx].name}]使用了[${SKILL_TYPE_NAME[skill.type]}][${skill.name}]`, 'info');
            const damageVO: DamageVO = {
                dmgSource: 'skill',
                atkPidx: pidx,
                atkHidx: aHeros()[player().hidx].hidx,
                tarHidx: aWillDamages.slice(epidx * ahlen, epidx * ahlen + ehlen).some(([d, p]) => d > -1 || p > 0) ? dmgedHidx : -1,
                willDamages: aWillDamages,
                dmgElements: aDmgElements,
                elTips: aElTips,
                willHeals: aWillHeal,
            };
            const { isDie } = this._doDamage(pidx, damageVO, { isSwitch });
            const hasSwitch = [...skillcmds, ...eskillcmds].some(({ cmd }) => cmd.includes('switch'));
            setTimeout(async () => {
                await this._execTask();
                this._doActionAfter(pidx, isQuickAction);
                await this._execTask();
                await this._changeTurn(pidx, isQuickAction, 'useSkill', { isDie });
                await this._execTask();
            }, (hasSwitch ? 1000 : 0) + 2250);
        }
        return {
            willHp, willAttachs: bWillAttach, elTips: aElTips, dmgElements: aDmgElements, willHeal: aWillHeal,
            players, summonCnt, supportCnt, willSummons, willSwitch, willDamages: aWillDamages,
        }
    }
    /**
     * 计算伤害
     * @param pidx 发起攻击的玩家序号
     * @param dmgElement 伤害的元素附着
     * @param damages 所有角色将要受到的伤害[敌方, 我方]
     * @param dmgedHidx 受击角色索引idx
     * @param players 所有玩家信息 
     * @param options isAttach 是否为自己附着元素, isSummon 召唤物攻击id, isExec 是否执行, getcards 双方准备摸牌数
     *                isSwirl 是否为扩散伤害, isReadySkill 是否为准备技能, aWillheals 立即回血, bWillHeals 预览回血, isSwirlExec 扩散伤害是否执行,
     *                elrcmds 命令执行, atriggers 攻击者触发时机, etriggers 受击者触发时机, skid 技能id, sktype 技能类型, 
     *                usedDice 使用的骰子, isSelf 是否为对自身攻击(目前仅用于statusAtk), withCard 可能使用的卡, minusDiceSkill 技能当前被x减费后留存的骰子数
     *                willAttachs 所有角色将要附着的元素, elTips 元素反应提示, dmgElements 本次伤害元素, minusDiceSkillIds 减骰的id
     * @returns willDamages: 所有角色将要受到的伤害[敌方, 我方][普攻伤害, 穿透伤害], 
     *          willAttachs: 将要附着的元素, 
     *          dmgElements: 本次伤害元素,
     *          summon: 受击玩家召唤物,
     *          eheros: 受击玩家角色数组,
     *          summonOppo: 攻击玩家召唤物, 
     *          aheros: 攻击玩家角色数组, 
     *          elTips 元素反应提示 
     *          atriggers 攻击者触发时机
     *          etriggers 受击者触发时机
     *          willheals 回血组
     *          elrcmds 命令执行
     *          minusDiceSkill: 用技能减骰子
     *          isQuickAction: 是否为快速行动
     */
    private _calcDamage(
        pidx: number, dmgElement: DamageType, damages: number[][], dmgedHidx: number, oplayers: Player[],
        options: {
            isAttach?: boolean, isSummon?: number, isExec?: boolean, isSwirl?: boolean, discards?: Card[], isChargedAtk?: boolean,
            skid?: number, sktype?: SkillType, isFallAtk?: boolean, isReadySkill?: boolean, isSwirlExec?: boolean, aWillHeals?: number[], bWillHeals?: number[],
            elrcmds?: Cmds[][], atriggers?: Trigger[][], etriggers?: Trigger[][], usedDice?: number, dmgElements?: DamageType[],
            elTips?: [string, PureElementType, PureElementType][], willAttachs?: (PureElementType | undefined)[], multiDmg?: number, isAtkSelf?: number, withCard?: Card,
            minusDiceSkillIds?: number[], willheals?: number[][], minusDiceSkill?: number[][],
        } = {}) {
        const players = clone(oplayers);
        const epidx = pidx ^ 1;
        const { heros: { length: ahlen } } = players[pidx];
        const { heros: { length: ophlen } } = players[epidx];
        const { isAttach = false, isSummon = -1, isSwirl = false, isExec = true, multiDmg = 0, skid = -1, isAtkSelf = 0,
            isReadySkill = false, isSwirlExec = true, sktype, minusDiceSkillIds = [],
            aWillHeals = new Array<number>(ahlen + ophlen).fill(-1), bWillHeals = new Array<number>(ahlen + ophlen).fill(-1),
            elrcmds = [[], []], usedDice = 0, dmgElements = new Array<DamageType>(ophlen + ahlen).fill(DAMAGE_TYPE.Physical),
            willAttachs = new Array<PureElementType | undefined>(isAtkSelf ? ahlen : ophlen).fill(undefined),
            elTips = new Array(ahlen + ophlen).fill(0).map(() => ['', PURE_ELEMENT_TYPE.Cryo, PURE_ELEMENT_TYPE.Cryo]), minusDiceSkill = [],
            atriggers: atrg = new Array(ahlen).fill(0).map(() => []), etriggers: etrg = new Array(ophlen).fill(0).map(() => []),
            discards = [], withCard, isChargedAtk = false, isFallAtk = false,
        } = options;
        let willDamages = damages;
        if (!isSwirl) {
            if (willDamages.length == 0) willDamages = new Array(ahlen + ophlen).fill(0).map(() => [-1, 0]);
            else if (willDamages.length < ophlen + ahlen) {
                const admg = new Array(ahlen + ahlen - willDamages.length).fill(0).map(() => [-1, 0]);
                if (+(pidx == 0) ^ isAtkSelf) willDamages = admg.concat(willDamages);
                else willDamages = willDamages.concat(admg);
            } else if (+(pidx == 0) ^ isAtkSelf) {
                willDamages = willDamages.slice(ophlen).concat(willDamages.slice(0, ophlen));
            }
        }
        let res = clone({
            willDamages,
            willAttachs,
            dmgElements,
            players,
            elTips,
            atriggers: atrg,
            etriggers: etrg,
            aWillHeals,
            bWillHeals,
            elrcmds,
            supportCnt: players.map(() => new Array<number>(MAX_SUPPORT_COUNT).fill(0)),
            isQuickAction: false,
        });
        const { heros: aheros, summons: asummons, playerInfo } = res.players[pidx];
        const dmgedPidx = epidx ^ +(isAtkSelf || isAttach);
        const { heros: eheros, heros: { length: ehlen }, summons: esummons } = res.players[dmgedPidx];
        const mergeSupportCnt = (resCnt?: number[][]) => {
            if (!resCnt) return;
            res.supportCnt.forEach((spt, spti) => spt.forEach((_, i, a) => a[i] += resCnt[spti][i]));
        }
        const efhero = eheros[dmgedHidx];
        if (efhero.hp <= 0) return res;
        const getDmgIdxOffset = ehlen * dmgedPidx;
        const aGetDmgIdxOffset = ophlen * pidx;
        const getDmgIdx = dmgedHidx + getDmgIdxOffset;
        const atkHidx = getAtkHidx(aheros);
        const afhero = aheros[atkHidx];
        const atriggers: Trigger[][] = clone(res.atriggers);
        const etriggers: Trigger[][] = clone(res.etriggers);
        const trgEl = ELEMENT_TYPE_KEY[dmgElement];
        let swirlDmg: PureElementType | undefined;
        if (dmgElement != DAMAGE_TYPE.Pierce && (res.willDamages[getDmgIdx][0] >= 0 || isAttach)) {
            // const isDmgAttach = !([DAMAGE_TYPE.Physical, DAMAGE_TYPE.Anemo, DAMAGE_TYPE.Geo] as ElementType[]).includes(dmgElement);
            const isDmgAttach = dmgElement != DAMAGE_TYPE.Physical && dmgElement != DAMAGE_TYPE.Anemo && dmgElement != DAMAGE_TYPE.Geo;
            res.dmgElements[getDmgIdx] = dmgElement;
            // 将要附着的元素
            if (isDmgAttach && !efhero.attachElement.includes(dmgElement as PureElementType)) {
                res.willAttachs[dmgedHidx] = dmgElement;
            }
            if ( // 没有元素反应(不含冰草共存)
                efhero.attachElement.length == 0 ||
                (efhero.attachElement as ElementType[]).includes(dmgElement)
            ) {
                if (efhero.attachElement.length == 0 && isDmgAttach) {
                    efhero.attachElement.push(dmgElement as PureElementType);
                }
            } else if (dmgElement != DAMAGE_TYPE.Physical) {
                let isElDmg = true;
                const attachElement = efhero.attachElement.shift()!;
                const elTipIdx = (pidx ^ +!isAttach) * ehlen + dmgedHidx;
                const elTypes: ElementType[] = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro];
                if (dmgElement == ELEMENT_TYPE.Anemo && elTypes.includes(attachElement)) { // 扩散
                    res.willAttachs[dmgedHidx] = dmgElement;
                    res.elTips[elTipIdx] = ['扩散', dmgElement, attachElement];
                    atriggers[atkHidx].push('Swirl');
                    swirlDmg = attachElement;
                } else if (dmgElement == ELEMENT_TYPE.Geo && elTypes.includes(attachElement)) { // 结晶
                    res.willAttachs[dmgedHidx] = dmgElement;
                    ++res.willDamages[getDmgIdx][0];
                    res.elTips[elTipIdx] = ['结晶', dmgElement, attachElement];
                    atriggers[atkHidx].push('Crystallize');
                } else {
                    const attachType = (1 << PURE_ELEMENT_CODE[attachElement]) + (1 << PURE_ELEMENT_CODE[dmgElement]);
                    const hasEls = (el1: PureElementType, el2: PureElementType) =>
                        (attachType >> PURE_ELEMENT_CODE[el1] & 1) == 1 && (attachType >> PURE_ELEMENT_CODE[el2] & 1) == 1;
                    if (hasEls(ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Dendro)) { // 冰草共存
                        isElDmg = false;
                        efhero.attachElement = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Dendro];
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro)) { // 水火 蒸发
                        res.willDamages[getDmgIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = ['蒸发', dmgElement, attachElement];
                        atriggers[atkHidx].push('Vaporize');
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Cryo)) { // 冰火 融化
                        res.willDamages[getDmgIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = ['融化', dmgElement, attachElement];
                        atriggers[atkHidx].push('Melt');
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Electro)) { // 水雷 感电
                        if (!isAttach) {
                            for (let i = 0; i < ehlen; ++i) {
                                const dmg = res.willDamages[i + getDmgIdxOffset];
                                const idx = +(i != dmgedHidx);
                                if (dmg[idx] < 0) dmg[idx] = 0;
                                ++dmg[idx];
                            }
                        }
                        res.elTips[elTipIdx] = ['感电', dmgElement, attachElement];
                        atriggers[atkHidx].push('ElectroCharged');
                    } else if (hasEls(ELEMENT_TYPE.Electro, ELEMENT_TYPE.Cryo)) { // 冰雷 超导
                        if (!isAttach) {
                            for (let i = 0; i < ehlen; ++i) {
                                const dmg = res.willDamages[i + getDmgIdxOffset];
                                const idx = +(i != dmgedHidx);
                                if (dmg[idx] < 0) dmg[idx] = 0;
                                ++dmg[idx];
                            }
                        }
                        res.elTips[elTipIdx] = ['超导', dmgElement, attachElement];
                        atriggers[atkHidx].push('Superconduct');
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Cryo)) { // 水冰 冻结
                        res.willDamages[getDmgIdx][0] += +!isAttach;
                        efhero.heroStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(pidx, [this.newStatus(106)], efhero.heroStatus));
                        res.elTips[elTipIdx] = ['冻结', dmgElement, attachElement];
                        atriggers[atkHidx].push('Frozen');
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Dendro)) { // 水草 绽放
                        ++res.willDamages[getDmgIdx][0];
                        res.elTips[elTipIdx] = ['绽放', dmgElement, attachElement];
                        atriggers[atkHidx].push('Bloom');
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro)) { // 火雷 超载
                        res.willDamages[getDmgIdx][0] += 2;
                        if (efhero.isFront) res.elrcmds[0].push({ cmd: 'switch-after', cnt: 2500, isOppo: !isAtkSelf });
                        res.elTips[elTipIdx] = ['超载', dmgElement, attachElement];
                        atriggers[atkHidx].push('Overload');
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Dendro)) { // 火草 燃烧
                        ++res.willDamages[getDmgIdx][0];
                        const cpidx = pidx ^ isAtkSelf;
                        assgin(res.players[cpidx].summons, this._updateSummon(cpidx, [this.newSummon(115)], res.players[cpidx].summons, res.players[cpidx], isExec, { isSummon }));
                        res.elTips[elTipIdx] = ['燃烧', dmgElement, attachElement];
                        atriggers[atkHidx].push('Burning');
                    } else if (hasEls(ELEMENT_TYPE.Electro, ELEMENT_TYPE.Dendro)) { // 雷草 原激化
                        ++res.willDamages[getDmgIdx][0];
                        res.elTips[elTipIdx] = ['原激化', dmgElement, attachElement];
                        atriggers[atkHidx].push('Quicken');
                    }
                }
                if (isElDmg) {
                    const SwirlOrCrystallize = ([ELEMENT_TYPE.Anemo, ELEMENT_TYPE.Geo] as ElementType[]).includes(dmgElement) ?
                        `${ELEMENT_TYPE_KEY[attachElement]}` : '';
                    atriggers.forEach((trgs, tri) => {
                        if (tri == atkHidx) {
                            trgs.push(
                                'elReaction', 'get-elReaction-oppo',
                                `elReaction-${trgEl}:${SwirlOrCrystallize}` as Trigger,
                                `elReaction-${ELEMENT_TYPE_KEY[attachElement]}` as Trigger,
                            );
                        } else {
                            trgs.push(
                                'other-elReaction',
                                `other-elReaction-${trgEl}` as Trigger,
                                `other-elReaction-${ELEMENT_TYPE_KEY[attachElement]}` as Trigger,
                            );
                        }
                    });
                    etriggers.forEach((trgs, tri) => {
                        if (tri == dmgedHidx) {
                            trgs.push(
                                'get-elReaction',
                                `get-elReaction-${trgEl}:${SwirlOrCrystallize}` as Trigger,
                                `get-elReaction-${ELEMENT_TYPE_KEY[attachElement]}` as Trigger,
                            );
                        } else {
                            trgs.push('other-get-elReaction');
                        }
                    });
                }
            }
        }
        etriggers.forEach((trg, tidx) => {
            const [elDmg, pierceDmg] = res.willDamages[tidx + getDmgIdxOffset];
            const isOtherGetDmg = res.willDamages.slice(getDmgIdxOffset, getDmgIdxOffset + ehlen)
                .some((dmg, didx) => (dmg[0] > -1 || dmg[1] > 0) && didx != tidx);
            if (isOtherGetDmg) trg.push('other-getdmg');
            if (elDmg > 0 || pierceDmg > 0) {
                trg.push('getdmg');
                if (dmgElement != ELEMENT_TYPE.Physical) trg.push('el-getdmg');
                if (elDmg > 0) trg.push(`${trgEl}-getdmg` as Trigger);
                if (pierceDmg > 0) trg.push('Pierce-getdmg');
            }
        });
        atriggers.forEach((trg, tidx) => {
            const [elDmg, pierceDmg] = res.willDamages[tidx + aGetDmgIdxOffset];
            const isOtherGetDmg = res.willDamages.slice(aGetDmgIdxOffset, aGetDmgIdxOffset + ehlen)
                .some((dmg, didx) => (dmg[0] > -1 || dmg[1] > 0) && didx != tidx);
            if (isOtherGetDmg) trg.push('other-getdmg');
            if (elDmg > 0 || pierceDmg > 0) {
                trg.push('getdmg');
                if (elDmg > 0) trg.push(`${trgEl}-getdmg` as Trigger);
                if (pierceDmg > 0) trg.push('Pierce-getdmg');
            }
        });
        const aist: Status[][] = new Array(ahlen).fill(0).map(() => []);
        const aost: Status[] = [];
        const eist: Status[][] = new Array(ehlen).fill(0).map(() => []);
        const eost: Status[] = [];
        const getdmg = () => res.willDamages
            .slice(getDmgIdxOffset, getDmgIdxOffset + ehlen)
            .map(([dmg, pdmg]) => dmg == -1 && pdmg == 0 ? -1 : Math.max(0, dmg) + pdmg);
        const agetdmg = () => res.willDamages
            .slice(getDmgIdxOffset, getDmgIdxOffset + ehlen)
            .map(([dmg, pdmg]) => dmg == -1 && pdmg == 0 ? -1 : Math.max(0, dmg) + pdmg);

        if (!isAttach) {
            if (isSwirl) {
                etriggers[dmgedHidx].push(`${trgEl}-getdmg-Swirl` as Trigger);
                atriggers[atkHidx].push(`${trgEl}-dmg-Swirl` as Trigger, 'dmg-Swirl');
            } else {
                const eWillDamage = res.willDamages.slice(getDmgIdxOffset, getDmgIdxOffset + ehlen);
                if (eWillDamage.some(dmg => dmg[0] > -1 || dmg[1] > 0)) {
                    atriggers.forEach((trgs, ti) => {
                        if (ti == atkHidx) trgs.push('dmg');
                        else trgs.push('other-dmg');
                        trgs.push('getdmg-oppo');
                        if (dmgElement != ELEMENT_TYPE.Physical) {
                            if (ti == atkHidx) trgs.push('el-dmg');
                            trgs.push('el-getdmg-oppo');
                        }
                    });
                    if (eWillDamage.some(dmg => dmg[0] > -1)) {
                        atriggers[atkHidx].push(`${trgEl}-dmg` as Trigger, `${trgEl}-getdmg-oppo` as Trigger);
                    }
                    if (eWillDamage.some(dmg => dmg[1] > 0)) {
                        atriggers[atkHidx].push('Pierce-dmg', 'Pierce-getdmg-oppo');
                    }
                }
                if (skid > -1) {
                    atriggers.forEach((trg, ti) => {
                        const isOther = ti != atkHidx ? 'other-' : '';
                        trg.push(`${isOther}skill`, `${isOther}skilltype${sktype}` as Trigger);
                    });
                    etriggers.forEach(trgs => trgs.push('skill-oppo'));
                }
                if (isReadySkill) atriggers[atkHidx].push('useReadySkill');
            }
            if (!isAtkSelf) {
                const slotSummons: Summon[] = [];
                for (let i = 0; i < ahlen; ++i) {
                    const slotres = this._detectSlot(pidx, atriggers[isSummon > -1 ? atkHidx : i], {
                        hidxs: i,
                        players: res.players,
                        ehidx: dmgedHidx,
                        summons: asummons,
                        isChargedAtk,
                        isFallAtk,
                        skid,
                        isSummon,
                        usedDice,
                        isExec,
                        hcard: withCard,
                        minusDiceSkillIds,
                        minusDiceSkill,
                        getdmg: getdmg(),
                    });
                    aist[i].push(...slotres.heroStatus);
                    aost.push(...slotres.combatStatus);
                    slotSummons.push(...slotres.nsummons);
                    mergeWillHeals(res.bWillHeals, slotres.willHeals);
                    if (res.willDamages[getDmgIdx][0] > 0) res.willDamages[getDmgIdx][0] += slotres.addDmg + (isSummon > -1 ? slotres.addDmgSummon : 0);
                    mergeSupportCnt(slotres.supportCnt);
                }
                if (slotSummons.length > 0) {
                    assgin(res.players[pidx].summons, this._updateSummon(pidx, slotSummons, res.players[pidx].summons, res.players[pidx], isExec, { isSummon }));
                }
            }
            for (let i = 0; i < ehlen; ++i) {
                const slotres = this._detectSlot(dmgedPidx, etriggers[i], {
                    hidxs: i,
                    heros: eheros,
                    eheros: aheros,
                    isExec,
                    getdmg: getdmg(),
                });
                eist[i].push(...slotres.heroStatus);
                eost.push(...slotres.combatStatus);
                mergeWillHeals(res.bWillHeals, slotres.willHeals);
                mergeSupportCnt(slotres.supportCnt);
            }
        }
        const detectStatus = (trgs: Trigger[], hi: number, isSelf: boolean) => {
            const dmg = isSelf ? 'addDmg' : 'getDmg';
            const cpidx = pidx ^ +!isSelf;
            const stsres = this._detectStatus(cpidx, [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage], trgs, {
                hidxs: [hi],
                players: res.players,
                isExec,
                isOnlyExecSts: !isExec,
                skilltype: sktype,
                skid,
                isChargedAtk,
                isFallAtk,
                isSummon,
                dmgedHidx,
                dmgSource: skid > -1 ? afhero.id : isSummon,
                dmgElement,
                minusDiceSkillIds,
                minusDiceSkill,
                hasDmg: res.willDamages[getDmgIdx][0] > 0,
                discards,
                card: withCard,
                isUnshift: trgs.some(trg => trg.includes('get') && !trg.includes('oppo')),
            });
            if (res.willDamages[getDmgIdx][0] > 0) {
                res.willDamages[getDmgIdx][0] += (stsres?.[`${dmg}`] ?? 0) + (isSummon > -1 ? stsres.addDmgSummon ?? 0 : 0);
            }
            if (stsres.nsummons.length > 0) {
                assgin(res.players[cpidx].summons, this._updateSummon(cpidx, stsres.nsummons, res.players[cpidx].summons, res.players[cpidx]));
            }
            stsres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                if (pIsSelf == isSelf) {
                    (phidxs ?? getBackHidxs(aheros)).forEach(hi => {
                        res.willDamages[hi + aGetDmgIdxOffset][1] += pdmg;
                    });
                } else {
                    (phidxs ?? getBackHidxs(eheros)).forEach(hi => {
                        res.willDamages[hi + getDmgIdxOffset][1] += pdmg;
                    });
                }
            });
            mergeSupportCnt(stsres.supportCnt);
            mergeWillHeals(res.aWillHeals, stsres.aWillHeals);
            mergeWillHeals(res.bWillHeals, stsres.bWillHeals);
        }
        if (!isSwirl) {
            atriggers.forEach((t, ti) => {
                res.atriggers[ti] = [...new Set([...res.atriggers[ti], ...t])];
            });
        }
        etriggers.forEach((t, ti) => {
            res.etriggers[ti] = [...new Set([...res.etriggers[ti], ...t])];
        });
        res.atriggers.forEach((trgs, hi) => detectStatus(trgs, hi, true));
        res.etriggers.forEach((trgs, hi) => detectStatus(trgs, hi, false));
        if (!isSwirl) {
            this._detectSummon(dmgedPidx, [...new Set(etriggers.flat())], {
                csummon: esummons,
                players: res.players,
                isExec,
            });
            if (!isAtkSelf) {
                const asmnres = this._detectSummon(pidx, atriggers[atkHidx], {
                    csummon: asummons,
                    hasDmg: true,
                    isExec,
                    heros: aheros,
                    minusDiceSkillIds,
                    minusDiceSkill,
                    skid,
                });
                if (res.willDamages[getDmgIdx][0] > 0) res.willDamages[getDmgIdx][0] += asmnres.addDmg;
                mergeWillHeals(res.bWillHeals, asmnres.willHeals);
            }

            if (!isAtkSelf) {
                const asptres = this._detectSupport(pidx, atriggers[atkHidx], {
                    isExec,
                    skid,
                    getdmg: getdmg(),
                    minusDiceSkillIds,
                    minusDiceSkill,
                    heal: res.bWillHeals,
                    discard: discards.length,
                });
                res.elrcmds[0].push(...asptres.cmds);
                mergeSupportCnt(asptres.supportCnt);
            }
            const esptres = this._detectSupport(dmgedPidx, [...new Set(etriggers.flat())], {
                isExec,
                getdmg: getdmg(),
                skid,
            });
            res.elrcmds[1].push(...esptres.cmds);
            mergeSupportCnt(esptres.supportCnt);
        }
        if (res.atriggers[atkHidx].includes('el-getdmg-oppo')) {
            let elcnt = playerInfo.oppoGetElDmgType;
            for (const trg of res.atriggers[atkHidx]) {
                if (trg == 'el-getdmg-oppo' || !trg.endsWith('-getdmg-oppo')) continue;
                const [el] = objToArr(PURE_ELEMENT_TYPE_KEY).find(([, elname]) => elname == trg.slice(0, trg.indexOf('-getdmg-oppo'))) ?? [];
                if (el == undefined || (elcnt >> PURE_ELEMENT_CODE[el] & 1) == 1) continue;
                elcnt |= (1 << PURE_ELEMENT_CODE[el]);
            }
            if (isExec) playerInfo.oppoGetElDmgType = elcnt;
        }
        if (swirlDmg != undefined) {
            const otheridx = new Array(ehlen - 1).fill(0).map((_, i) => (dmgedHidx + i + 1) % ehlen);
            otheridx.forEach((i, idx) => {
                if (res.willDamages[i + getDmgIdxOffset][0] < 0) res.willDamages[i + getDmgIdxOffset][0] = 0;
                ++res.willDamages[i + getDmgIdxOffset][0];
                assgin(res, this._calcDamage(pidx, swirlDmg, res.willDamages, i, res.players,
                    {
                        ...options, isSwirl: true, isSwirlExec: idx == otheridx.length - 1,
                        atriggers: res.atriggers, etriggers: res.etriggers, dmgElements: res.dmgElements,
                        elTips: res.elTips, willAttachs: res.willAttachs,
                    }));
            });
        }
        if (dmgElement != DAMAGE_TYPE.Pierce && res.willDamages[getDmgIdx][0] > 0) {
            let restDmg = res.willDamages[getDmgIdx][0];
            if (efhero.isFront) {
                [efhero.weaponSlot, efhero.artifactSlot, efhero.talentSlot].forEach(slot => {
                    if (slot?.hasTag(CARD_TAG.Barrier)) {
                        const { restDmg: slotresdmg = -1, statusOppo = [], hidxs, execmds = [] }
                            = slot.handle(slot, { restDmg, heros: eheros, hidxs: [dmgedHidx], hcards: res.players[pidx].handCards });
                        restDmg = slotresdmg;
                        for (const slidx of (hidxs ?? [atkHidx])) {
                            aist[slidx].push(...statusOppo.filter(s => s.group == 0));
                        }
                        res.elrcmds[1].push(...execmds);
                    }
                });
            }
            efhero.heroStatus.filter(sts => sts.hasType(STATUS_TYPE.Barrier, STATUS_TYPE.Shield)).forEach(sts => {
                restDmg = sts.handle(sts, { restDmg, dmgElement, heros: eheros, hidx: dmgedHidx, dmgSource: skid > -1 ? afhero.id : isSummon, isSummon })?.restDmg ?? -1;
            });
            if (efhero.isFront) {
                let aMultiDmg = 0;
                res.players[pidx].combatStatus.filter(sts => sts.hasType(STATUS_TYPE.MultiDamage)).forEach(sts => {
                    aMultiDmg += sts.handle(sts)?.multiDmgCdt ?? 0;
                });
                aMultiDmg += multiDmg;
                restDmg *= Math.max(1, aMultiDmg);
                res.players[dmgedPidx].combatStatus.filter(sts => sts.hasType(STATUS_TYPE.Barrier, STATUS_TYPE.Shield)).forEach(sts => {
                    const oSummon = esummons.find(smn => smn.id == sts.summonId);
                    const { restDmg: nrdmg = -1, pdmg = 0, hidxs: piercehidxs = [] } = sts.handle(sts, {
                        restDmg,
                        summon: oSummon,
                        dmgElement,
                        heros: eheros,
                        hidx: dmgedHidx,
                    });
                    restDmg = nrdmg;
                    if (pdmg > 0 && piercehidxs.length > 0) {
                        piercehidxs.forEach(v => res.willDamages[v + getDmgIdxOffset][1] += pdmg);
                    }
                });
            }
            res.willDamages[getDmgIdx][0] = restDmg;
        }
        if (!isAtkSelf) {
            aheros.forEach((_, hi) => {
                this._detectSkill(pidx, atriggers[hi], {
                    hidxs: hi,
                    heros: aheros,
                    isExec,
                    getdmg: agetdmg(),
                    dmg: getdmg(),
                    discards,
                });
            });
        }
        eheros.forEach((_, hi) => {
            this._detectSkill(dmgedPidx, etriggers[hi], {
                hidxs: hi,
                heros: eheros,
                isExec,
                getdmg: getdmg(),
            });
        });

        if (res.atriggers[atkHidx].includes('Crystallize')) aost.push(this.newStatus(111));
        if ((res.atriggers[atkHidx].includes('Bloom') && !hasObjById([...aost, ...res.players[pidx].combatStatus], 112081))) {
            aost.push(this.newStatus(116));
        }
        if (res.atriggers[atkHidx].includes('Quicken')) aost.push(this.newStatus(117));
        const stscmds: Cmds[] = [];
        aheros.forEach((_, i) => {
            if (aist[i].length) stscmds.push({ cmd: 'getStatus', status: aist[i], hidxs: [i] })
        });
        eheros.forEach((_, i) => {
            if (eist[i].length) stscmds.push({ cmd: 'getStatus', status: eist[i], hidxs: [i], isOppo: true })
        });
        stscmds.push({ cmd: 'getStatus', status: aost, isOppo: !!isAtkSelf });
        stscmds.push({ cmd: 'getStatus', status: eost, isOppo: !isAtkSelf });
        this._doCmds(pidx, stscmds, { players: res.players, ahidx: atkHidx, ehidx: dmgedHidx });
        assgin(res.players[dmgedPidx].summons, this._updateSummon(dmgedPidx, [], esummons, res.players[dmgedPidx], isExec, { destroy: true }));
        assgin(res.players[pidx].summons, this._updateSummon(pidx, [], asummons, res.players[pidx]));
        if (isSwirlExec && isExec) {
            if (res.willDamages.some(d => Math.max(0, d[0]) + d[1] > 0)) {
                const willkilledhidxs: number[] = [];
                eheros.forEach((h, hi) => {
                    if (h.hp <= res.willDamages[hi + getDmgIdxOffset].reduce((a, b) => a + b)) {
                        willkilledhidxs.push(hi);
                    }
                });
                if (willkilledhidxs.length > 0) {
                    const dieHeros: Hero[] = clone(eheros.filter((_, hi) => willkilledhidxs.includes(hi)));
                    const { nwkhidxs } = this._detectSlot(dmgedPidx, 'will-killed', { hidxs: willkilledhidxs, players: res.players, isUnshift: true });
                    this._detectStatus(dmgedPidx, STATUS_TYPE.NonDefeat, 'will-killed', { hidxs: nwkhidxs, players: res.players, isUnshift: true });
                    const slotDestroyHidxs = dieHeros.filter(h => {
                        const isDie = h.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonDefeat)) &&
                            willkilledhidxs.length == nwkhidxs.length &&
                            (h.weaponSlot != null || h.artifactSlot != null || h.talentSlot != null);
                        const revHero = eheros.find(eh => eh.id == h.id);
                        const isRevive = revHero?.weaponSlot != h.weaponSlot || revHero?.artifactSlot != h.artifactSlot || revHero?.talentSlot != h.talentSlot;
                        return isDie || isRevive;
                    }).map(v => v.hidx);
                    if (slotDestroyHidxs.length > 0) {
                        this._detectStatus(dmgedPidx, STATUS_TYPE.Usage, 'slot-destroy', { hidxs: slotDestroyHidxs, players: res.players, isExec });
                    }
                }
            }
        }
        return res;
    }
    /**
     * 检查选择的卡的合法性并自动选择合适的骰子
     * @param pidx 玩家序号
     * @param cardIdx 要使用的卡牌序号
     * @param isReconcile 是否为调和
     * @returns isValid 选择的卡是否合法, diceSelect 是否选择骰子的数组, skillIdx 使用技能的序号, switchIdx 切换角色的序号
     */
    private _checkCard(pidx: number, players: Player[], cardIdx: number, isReconcile: boolean = false): {
        isValid: boolean,
        diceSelect: boolean[],
        supportCnt?: number[][],
        skillId?: number,
        switchIdx?: number,
        attackPreview?: Preview,
        heroCanSelect?: boolean[],
    } {
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const { dice, heros, hidx, summons, combatStatus, playerInfo: { isUsedlegend }, handCards } = player;
        const currCard = handCards[cardIdx];
        const { cost, canSelectHero, type, userType, costChange, energy } = currCard;
        let { costType, anydice } = currCard;
        let ncost = Math.max(0, cost + anydice - costChange);
        let isValid: boolean = false;
        let diceSelect: boolean[] = [];
        const diceLen = dice.length;
        const supportCnt: number[][] = players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        const cardres = currCard.handle(currCard, {
            hidxs: [hidx],
            heros,
            combatStatus,
            eheros: opponent.heros,
            ehidx: opponent.hidx,
            ephase: opponent.phase,
            round: this.round,
            dicesCnt: dice.length,
            hcards: handCards,
            ehcardsCnt: opponent.handCards.length,
            esupports: opponent.supports,
            esummons: opponent.summons,
            playerInfo: player.playerInfo,
            isExec: false,
            slotUse: type == CARD_TYPE.Equipment,
        });
        const res: {
            isValid: boolean,
            diceSelect: boolean[],
            supportCnt?: number[][],
            skillId?: number,
            switchIdx?: number,
            attackPreview?: Preview,
            heroCanSelect?: boolean[],
        } = {
            isValid,
            diceSelect,
            skillId: undefined,
            switchIdx: undefined,
            attackPreview: undefined,
            supportCnt,
            heroCanSelect: undefined,
        };
        if (
            cardres.hidxs?.length == 0 ||
            cardres.summon && summons.length == MAX_SUMMON_COUNT ||
            cardres.isValid == false ||
            currCard.hasSubtype(CARD_SUBTYPE.Legend) && isUsedlegend ||
            heros[hidx].energy < energy ||
            isReconcile && (currCard.tag.includes(CARD_TAG.NonReconcile) || dice.every(d => d == DICE_COST_TYPE.Omni || d == this._getFrontHero(pidx).element))
        ) {
            return { isValid: false, diceSelect: new Array(diceLen).fill(false) };
        }
        res.heroCanSelect = heros.map((hero, i) => {
            const canSelectHeros = cardres.canSelectHero?.[i] ?? (hero.hp > 0);
            return canSelectHero > 0 && canSelectHeros && (
                type == CARD_TYPE.Support ||
                type == CARD_TYPE.Event && currCard.subType.length == 0 ||
                currCard.hasSubtype(CARD_SUBTYPE.Weapon) && userType == hero.weaponType ||
                currCard.hasSubtype(CARD_SUBTYPE.Artifact) ||
                currCard.hasSubtype(CARD_SUBTYPE.Food) && !hasObjById(hero.heroStatus, 303300) ||
                currCard.hasSubtype(CARD_SUBTYPE.Talent) && userType == hero.id && (hero.isFront || !currCard.hasSubtype(CARD_SUBTYPE.Action)) ||
                currCard.hasSubtype(CARD_SUBTYPE.Action, CARD_SUBTYPE.Legend, CARD_SUBTYPE.ElementResonance) && userType == 0
            );
        });
        // if (userType == 0 && canSelectHero == heroIdxs.length ||
        //     userType == this._getFrontHero(pidx).id && canSelectHero == heroCanSelect.length
        // ) {
        //     const { willHeals } = this._doCmds([...(cardres.cmds ?? [])], {
        //         isCard: true,
        //         hidxs: isCdt(heros.some(h => h.isSelected), [heros.findIndex(h => h.isSelected)]),
        //         isExec: false
        //     });
        //     willHeals?.forEach(whl => this._doHeal(whl, heros, { isExec: false }));
        // }
        // todo 后续要把这canselect和isselected去掉的
        // players.forEach(p => {
        //     p.summons.forEach(smn => {
        //         smn.canSelect = canSelectSummon > -1 && (p.pidx ^ canSelectSummon) != pidx;
        //         if (canSelectSummon == -1) smn.isSelected = false;
        //     });
        //     p.supports.forEach(spt => {
        //         if (type != CARD_TYPE.Support || p.supports.length < MAX_SUPPORT_COUNT) spt.canSelect = canSelectSupport > -1 && (p.pidx ^ canSelectSupport) != pidx;
        //         if (canSelectSupport == -1 && p.supports.length < MAX_SUPPORT_COUNT) spt.isSelected = false;
        //     });
        // });
        const { isSwitch: switchIdx, attackPreview } = this._doCmds(pidx, cardres.cmds, { isExec: false });
        res.switchIdx = switchIdx;
        res.attackPreview = attackPreview;
        res.skillId = userType == 0 || userType == heros[hidx].id ? cardres.cmds?.find(({ cmd }) => cmd == 'useSkill')?.cnt ?? -1 : -1;
        if (isReconcile) [ncost, costType] = [1, DICE_TYPE.Any];
        if (ncost <= 0) {
            res.isValid = ncost == 0;
            res.diceSelect = new Array(diceLen).fill(false);
            return res;
        }
        if (costType == DICE_TYPE.Any) {
            res.isValid = ncost <= diceLen;
            if (res.isValid) {
                for (let i = 0, tmpcost = ncost; i < diceLen; ++i) {
                    res.diceSelect.unshift(tmpcost-- > 0);
                }
            }
            return res;
        }
        const diceCnt = arrToObj(Object.values(DICE_COST_TYPE), 0);
        dice.forEach(d => ++diceCnt[d]);
        if (costType != DICE_TYPE.Same) {
            ncost = Math.max(0, cost - costChange);
            anydice = Math.max(0, anydice - Math.max(0, costChange - cost));
            res.isValid = ncost <= diceCnt[costType] + diceCnt[DICE_COST_TYPE.Omni] && anydice <= diceLen - ncost;
            if (res.isValid) {
                for (let i = 0, tmpcost = anydice; i < diceLen && tmpcost > 0; ++i) {
                    res.diceSelect.unshift(tmpcost-- > 0);
                }
                for (let i = diceLen - anydice - 1, tmpcnt = ncost; i >= 0; --i) {
                    const cdice = dice[i];
                    if (cdice != costType && cdice != DICE_COST_TYPE.Omni) res.diceSelect.unshift(false);
                    else res.diceSelect.unshift(tmpcnt-- > 0);
                }
            } else {
                res.diceSelect = new Array(diceLen).fill(false);
            }
            return res;
        }
        res.isValid = objToArr(diceCnt).some(([d, cnt]) => (d != DICE_COST_TYPE.Omni ? cnt : 0) + diceCnt[DICE_COST_TYPE.Omni] >= ncost);
        if (res.isValid) {
            let maxDice: DiceCostType | undefined;
            const frontDice = this._getFrontHero(pidx).element as PureElementType;
            for (let i = diceLen - 1, max = 0; i >= 0; --i) {
                const cdice = dice[i];
                if (cdice == DICE_COST_TYPE.Omni) break;
                const cnt = diceCnt[cdice];
                if (cnt >= ncost) {
                    if (cdice == frontDice && maxDice != undefined && max + diceCnt[DICE_COST_TYPE.Omni] >= ncost) break;
                    maxDice = cdice;
                    break;
                }
                if (cnt > max && (diceCnt[frontDice] <= cnt || ncost - cnt <= diceCnt[frontDice])) {
                    max = cnt;
                    maxDice = cdice;
                }
            }
            for (let i = diceLen - 1, tmpcnt = ncost; i >= 0; --i) {
                const cdice = dice[i];
                if (cdice != maxDice && cdice != DICE_COST_TYPE.Omni) res.diceSelect.unshift(false);
                else res.diceSelect.unshift(tmpcnt-- > 0);
            }
        } else {
            res.diceSelect = new Array(diceLen).fill(false);
        }
        return res;
    }
    /**
     * 使用卡牌
     * @param pidx 玩家序号
     * @param cardIdx 使用的卡牌序号
     * @param diceSelect 选择要消耗的骰子
     * @param socket socket
     * @param options.selectHero 使用卡牌时选择的角色序号
     * @param options.selectHero2 使用卡牌时选择的角色序号2
     * @param options.selectSummon 使用卡牌时选择的召唤物序号
     * @param options.selectSupport 使用卡牌时选择的支援物序号
     */
    private async _useCard(pidx: number, cardIdx: number, diceSelect: boolean[], socket: Socket,
        options: {
            selectHeros?: number[], selectSummon?: number, selectSupport?: number,
        } = {}) {
        const { selectHeros = [], selectSummon = -1, selectSupport = -1 } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const currCard = player.handCards[cardIdx];
        this._writeLog(`[${player.name}]使用了[${currCard.name}]`, 'info');
        const isDiceValid = checkDices(player.dice.filter((_, i) => diceSelect[i]), { card: currCard });
        if (!isDiceValid) return this.emit('useCard-invalidDice', pidx, { socket, tip: '骰子不符合要求' });
        player.dice = player.dice.filter((_, i) => !diceSelect[i]);
        const hidxs = currCard.canSelectSummon != -1 ? [selectSummon] :
            currCard.canSelectSupport != -1 ? [selectSupport] :
                currCard.canSelectHero == 0 ? [player.hidx] : selectHeros;
        player.handCards = player.handCards.filter((_, ci) => ci != cardIdx);
        if (currCard.type == CARD_TYPE.Support && player.supports.length == MAX_SUPPORT_COUNT) {
            ++player.playerInfo.destroyedSupport;
        }
        const oSupportCnt = player.supports.length;
        const cardres = currCard.handle(currCard, {
            hidxs,
            heros: player.heros,
            eheros: opponent.heros,
            eCombatStatus: opponent.combatStatus,
            ehidx: opponent.hidx,
            epile: opponent.pile,
            selectHeros,
            selectSummon,
            selectSupport,
            summons: player.summons,
            esummons: opponent.summons,
            hcards: player.handCards,
            ehcardsCnt: opponent.handCards.length,
            round: this.round,
            playerInfo: player.playerInfo,
            eplayerInfo: opponent.playerInfo,
            supports: player.supports,
            esupports: opponent.supports,
            isExec: true,
            randomInArr: this._randomInArr.bind(this),
            slotUse: currCard.type == CARD_TYPE.Equipment,
        });
        player.playerInfo.isUsedCardPerRound = true;
        player.playerInfo.destroyedSupport += oSupportCnt - player.supports.length;
        const isAction = currCard.hasSubtype(CARD_SUBTYPE.Action);
        let { minusDiceCard } = this._detectSlot(pidx, 'card', { hidxs: allHidxs(player.heros), hcard: currCard, isQuickAction: !isAction });
        await this._execTask();
        const { isInvalid, minusDiceCard: stsmdc, isQuickAction: iqa } = this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'card', { card: currCard, isOnlyFront: true, minusDiceCard });
        await this._execTask();
        const cardcmds = [...(cardres.cmds ?? [])];
        const { cmds: skillcmds = [] } = this._detectSkill(pidx, 'card');
        await this._execTask();
        cardcmds.push(...skillcmds);
        const { cmds: supportcmds } = this._detectSupport(pidx, 'card', { hcard: currCard, minusDiceCard: stsmdc, isQuickAction: !isAction });
        await this._execTask();
        cardcmds.push(...supportcmds);
        let damageVOs: (DamageVO | undefined)[] = [undefined];
        const { usedCardIds } = player.playerInfo;
        if (!usedCardIds.includes(currCard.id)) usedCardIds.push(currCard.id);
        if (currCard.hasSubtype(CARD_SUBTYPE.Legend)) player.playerInfo.isUsedlegend = true;
        if (currCard.type == CARD_TYPE.Equipment && !cardres?.isDestroy) { // 装备
            const tarHero = player.heros[hidxs[0]];
            if (currCard.hasSubtype(CARD_SUBTYPE.Weapon)) { // 武器
                if (tarHero.weaponSlot?.id == currCard.id) currCard.setEntityId(tarHero.weaponSlot.entityId);
                tarHero.weaponSlot = currCard.setEntityId(this._genEntityId());
            } else if (currCard.hasSubtype(CARD_SUBTYPE.Artifact)) { // 圣遗物
                if (tarHero.artifactSlot?.id == currCard.id) currCard.setEntityId(tarHero.artifactSlot.entityId);
                tarHero.artifactSlot = currCard.setEntityId(this._genEntityId());
            } else if (currCard.hasSubtype(CARD_SUBTYPE.Talent)) { // 天赋
                tarHero.talentSlot = currCard.setEntityId(tarHero.talentSlot?.entityId ?? this._genEntityId());
            }
        }
        const isUseSkill = cardcmds.some(({ cmd }) => cmd == 'useSkill');
        if (isInvalid) {
            this._doActionAfter(pidx);
            this.emit(`useCard-${currCard.name}-invalid-${pidx}`, pidx, { isActionInfo: true, isQuickAction: true });
            await this._execTask();
            await this._doActionStart(pidx);
        } else {
            if (currCard.type == CARD_TYPE.Equipment) {
                const explIdx = currCard.UI.description.indexOf('；(');
                currCard.UI.description = currCard.UI.description.slice(0, explIdx);
                if (
                    currCard.hasSubtype(CARD_SUBTYPE.Weapon) && player.heros[hidxs[0]].weaponSlot != null ||
                    currCard.hasSubtype(CARD_SUBTYPE.Artifact) && player.heros[hidxs[0]].artifactSlot != null ||
                    currCard.hasSubtype(CARD_SUBTYPE.Talent) && player.heros[hidxs[0]].talentSlot != null
                ) {
                    const { cmds: stscmds = [] } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'slot-destroy', { isOnlyCombatStatus: true, card: currCard });
                    await this._execTask();
                    cardcmds.push(...stscmds);
                }
            } else {
                cardres.exec?.();
            }
            const { ndices, phase = player.phase, willHeals = [], isSwitch = -1, willDamages = [], dmgElements = [], elTips = [] }
                = this._doCmds(pidx, cardcmds, {
                    withCard: currCard,
                    isAction,
                    hidxs: isCdt(currCard.canSelectHero > 0, hidxs),
                });
            if (cardres.hidxs && currCard.type != CARD_TYPE.Equipment) hidxs.splice(0, 20, ...cardres.hidxs);
            let isSupportDestroy = false;
            if (cardres.support) {
                if (player.supports.length == MAX_SUPPORT_COUNT) {
                    if (selectSupport == -1) throw new Error('@_useCard: selectSupport is invalid');
                    player.supports.splice(selectSupport, 1);
                    isSupportDestroy = true;
                }
                cardres.support.forEach(support => {
                    support.handle(support, { playerInfo: player.playerInfo, trigger: 'enter' });
                    player.supports.push(support);
                });
            }
            cardres.supportOppo?.forEach(support => {
                if (opponent.supports.length < MAX_SUPPORT_COUNT) {
                    support.handle(support, { playerInfo: opponent.playerInfo, trigger: 'enter' });
                    opponent.supports.push(support);
                }
            });
            if (oSupportCnt - player.supports.length > 0) isSupportDestroy = true;
            if (isSupportDestroy) this._doSupportDestroy(pidx);
            assgin(player.summons, this._updateSummon(pidx, cardres.summon ?? [], player.summons, player));
            assgin(opponent.summons, this._updateSummon(pidx, [], opponent.summons, opponent));
            const stscmds: Cmds[] = [
                { cmd: 'getStatus', status: cardres.status, hidxs: cardres.hidxs ?? hidxs },
                { cmd: 'getStatus', status: cardres.statusOppo, hidxs: cardres.hidxs ?? hidxs, isOppo: true },
            ];
            this._doCmds(pidx, stscmds);
            if (isAction) player.canAction = false;
            if (isSwitch > -1) {
                this._detectStatus(pidx, STATUS_TYPE.Attack, 'change-from', { isQuickAction: isCdt(!isAction, 2), isSwitchAtk: isUseSkill });
            }
            if (ndices) player.dice = ndices;
            player.phase = phase;
            damageVOs = ((willDamages.length > 0 || elTips.length > 0) && willHeals.length == 0 ? [[]] : willHeals).map((hl, hli) => ({
                dmgSource: 'card',
                atkPidx: pidx,
                atkHidx: -1,
                tarHidx: hli == 0 ? opponent.hidx : -1,
                willDamages: hli == 0 ? willDamages : [],
                willHeals: hl,
                dmgElements: hli == 0 ? dmgElements : [],
                elTips: hli == 0 ? elTips : [],
            }));
            const isQuickAction = !isAction || iqa;
            const dmgvoLen = Math.max(1, damageVOs.length);
            for (let voi = 0; voi < dmgvoLen; ++voi) {
                const canAction = voi == dmgvoLen - 1 && !isAction;
                const damageVO = damageVOs[voi];
                if (damageVO != undefined && (willDamages.length > 0 || willHeals.length > 0)) {
                    if (canAction) this._doActionAfter(pidx, isQuickAction);
                    this._doDamage(pidx, damageVO, { atkname: currCard.name, canAction, isQuickAction });
                    await delay(2250);
                    if (canAction) await this._execTask();
                } else if (!isUseSkill) {
                    this._doActionAfter(pidx, isQuickAction);
                    this.emit('useCard', pidx, { canAction, damageVO, isActionInfo: true, isQuickAction });
                    await this._execTask();
                }
                if (isAction && !isUseSkill) this._changeTurn(pidx, isQuickAction, 'useCard');
                else if (canAction) this._doActionStart(pidx);
            }
        }
    }
    /**
     * 转换回合
     * @param pidx 玩家序号
     * @param isQuickAction 是否为快速行动
     * @param type 发动转换回合的来源
     * @param options.dieChangeBack 是否为被击倒后重新选择角色
     * @param options.isDie 是否有角色被击倒
     */
    private async _changeTurn(pidx: number, isQuickAction: boolean, type: string, options: { dieChangeBack?: boolean, isDie?: boolean } = {}) {
        const { dieChangeBack = false, isDie = false } = options;
        const isOppoActionEnd = this.players[pidx ^ 1]?.phase >= PHASE.ACTION_END;
        this.players[pidx].canAction = false;
        const isChange =
            !dieChangeBack && !isOppoActionEnd && !isQuickAction ||
            dieChangeBack && this.players[pidx]?.phase < PHASE.ACTION_END;
        if (isChange) {
            this.players[this.currentPlayerIdx].canAction = false;
            this.players[this.currentPlayerIdx].status = PLAYER_STATUS.WAITING;
            ++this.currentPlayerIdx;
            this.players[this.currentPlayerIdx].status = PLAYER_STATUS.PLAYING;
            if (type == 'endPhase') {
                this._startTimer();
            } else {
                this.players.forEach(p => {
                    if (p.pidx == this.currentPlayerIdx) p.UI.info = '';
                    else p.UI.info = '对方行动中....';
                });
            }
        }
        const tip = isCdt(!isQuickAction && !isDie, isChange ? '{p}回合开始' : '继续{p}回合');
        this.emit(`changeTurn-${type}-isChange:${isChange}`, pidx, { tip });
        await delay(1e3);
        await this._doActionStart(this.currentPlayerIdx);
        this.players[this.currentPlayerIdx].canAction = !isDie;
        this.emit(`changeTurn-${type}-setCanAction:${!isDie}`, pidx, { isChange });
    }
    /**
     * 玩家选择行动前
     * @param pidx 玩家序号
     */
    private async _doActionStart(pidx: number) {
        this._detectSkill(pidx, 'action-start');
        await this._execTask();
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.ReadySkill], ['action-start', 'useReadySkill'], { isOnlyFront: true, isQuickAction: 2 });
        await this._execTask();
        this._detectSummon(pidx, 'action-start');
        await this._execTask();
        this._detectSupport(pidx, 'action-start', { isQuickAction: true });
        await this._execTask();
        this._detectStatus(pidx ^ 1, STATUS_TYPE.Attack, 'action-start-oppo', { isOnlyCombatStatus: true });
        await this._execTask();
    }
    /**
     * 玩家执行任意行动后
     * @param pidx 玩家序号
     */
    private _doActionAfter(pidx: number, isQuickAction = false) {
        this._detectSkill(pidx, 'action-after');
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'action-after', { isOnlyFront: true, isQuickAction: isCdt(isQuickAction, 2) });
        this._detectSupport(pidx, 'action-after', { isQuickAction });
        this._detectSupport(pidx ^ 1, 'action-after-oppo', { isQuickAction });
    }
    /**
     * 每回合开始的重置
     */
    private _doReset() {
        this.players.forEach(player => {
            player.playerInfo.discardCnt = 0;
            player.playerInfo.reconcileCnt = 0;
            player.heros.forEach(h => { // 重置技能
                h.skills.forEach(skill => skill.handle({ reset: true, hero: h, skid: skill.id }))
            });
            player.supports.forEach(spt => spt.handle(spt, { reset: true })); // 重置支援区
            const rCombatStatus: Status[] = [];
            player.summons.forEach(smn => { // 重置召唤物
                const { rCombatStatus: sts = [] } = smn.handle(smn, { reset: true });
                rCombatStatus.push(...sts);
            });
            player.heros.forEach(h => {
                [h.weaponSlot, h.talentSlot, h.artifactSlot].forEach(slot => { // 重置装备
                    if (slot != null) slot.handle(slot, { reset: true });
                });
                h.heroStatus.forEach(sts => sts.handle(sts, { reset: true })); // 重置角色状态
            });
            player.combatStatus.forEach(sts => sts.handle(sts, { reset: true })); // 重置出战状态
            if (rCombatStatus.length > 0) player.combatStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(player.pidx, rCombatStatus, player.combatStatus, true, player.heros, player.combatStatus, player.hidx));
        });
    }
    /**
     * 执行回合开始阶段检测
     * @param flag flag
     * @param pidx 玩家序号
     */
    private async _doPhaseStart(flag: string, pidx: number) {
        this.phase = PHASE.ACTION_START;
        this.players.forEach(p => p.rollCnt = INIT_ROLL_COUNT);
        this.emit(flag + '-init', pidx, { tip: `第${this.round}轮开始` });
        this._writeLog(`第${this.round}轮开始`);
        const exchangeSupprt: [Support, number][] = [];
        await delay(1250);
        for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
            if (this.round == 1) { // 检测游戏开始 game-start
                this._detectSkill(cpidx, 'game-start');
                await this._execTask();
                this._detectSkill(cpidx, 'change-to', { hidxs: [this.players[cpidx].hidx] });
                await this._execTask();
            }
            // 检测回合开始阶段 phase-start
            this._detectSlot(cpidx, 'phase-start', { hidxs: allHidxs(this.players[cpidx].heros), isQuickAction: true });
            await this._execTask();
            this._detectStatus(cpidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'phase-start', { isQuickAction: 2 });
            await this._execTask();
            this._detectSummon(cpidx, 'phase-start');
            await this._execTask();
            const { exchangeSupport: ecs } = this._detectSupport(cpidx, 'phase-start', { firstPlayer: this.startIdx, isQuickAction: true });
            exchangeSupprt.push(...ecs);
            await this._execTask();
        }
        for (const [exspt, pidx] of exchangeSupprt) {
            this.players[pidx].supports.push(exspt);
        }
        // 回合开始阶段结束，进入行动阶段 phase-action
        this.phase = PHASE.ACTION;
        this.players[this.startIdx].status = PLAYER_STATUS.PLAYING;
        this.players.forEach(p => {
            p.phase = PHASE.ACTION;
            if (p.pidx == this.startIdx) {
                p.UI.info = '我方行动';
                p.canAction = true;
            } else p.UI.info = '对方行动中....';
        });
        this.emit(flag, pidx, { tip: '{p}回合开始' });
    }
    private _doPhaseEnd(pidx: number, flag: string) {
        setTimeout(async () => {
            for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
                this._detectSkill(cpidx, 'phase-end');
                await this._execTask();
                this._detectSlot(cpidx, 'phase-end', { hidxs: allHidxs(this.players[cpidx].heros) });
                await this._execTask();
                this._detectStatus(cpidx, [STATUS_TYPE.Attack, STATUS_TYPE.Round, STATUS_TYPE.Accumulate], 'phase-end', { hidxs: allHidxs(this.players[cpidx].heros) });
                await this._execTask();
                this._detectSummon(cpidx, 'phase-end');
                await this._execTask();
                this._detectSupport(cpidx, 'phase-end');
                await this._execTask();
            }
            await wait(() => !this.taskQueue.isExecuting);
            // 回合结束摸牌
            const getCardCmds: Cmds[] = [{ cmd: 'getCard', cnt: 2 }];
            this._doCmds(this.startIdx, getCardCmds);
            await this._execTask();
            this._doCmds(this.startIdx ^ 1, getCardCmds);
            await this._execTask();
            this.emit(flag + '--getCard', pidx);
            await delay(1600);
            // 持续回合数-1
            this.players.forEach(player => {
                player.heros.forEach((h, hi, a) => {
                    ([...h.heroStatus, ...(h.isFront ? player.combatStatus : [])]).forEach(sts => {
                        if (sts.roundCnt > 0) --sts.roundCnt;
                    });
                    a[hi].heroStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(player.pidx, [], h.heroStatus, true, a, player.combatStatus, hi));
                });
                player.combatStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(player.pidx, [], player.combatStatus, true, player.heros, player.combatStatus, player.hidx));
            });
            this.currentPlayerIdx = this.startIdx;
            this.phase = PHASE.DICE;
            ++this.round;
            this.players.forEach(player => {
                player.status = PLAYER_STATUS.WAITING;
                player.phase = PHASE.DICE;
                player.dice = this._rollDice(player.pidx);
                player.playerInfo.isKillByMyRound = false;
                player.playerInfo.isUsedCardPerRound = false;
                player.UI.showRerollBtn = true;
                player.UI.info = '等待对方选择......';
                player.heros.forEach(h => {
                    if (h.hp == 0) h.hp = -1;
                });
            });
            this.emit(flag, pidx, { tip: '骰子投掷阶段' });
        }, 800);
    }
    /**
     * 执行结束回合时检测
     * @param pidx 玩家序号
     * @param flag flag
     */
    private async _doEndPhase(pidx: number, flag: string) {
        const player = this.players[pidx];
        if (player.status == PLAYER_STATUS.WAITING || !player.canAction || player.phase != PHASE.ACTION) return;
        player.canAction = false;
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], ['end-phase', 'any-end-phase'], { phase: PHASE.ACTION_END });
        await this._execTask();
        this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'any-end-phase', { phase: PHASE.ACTION_END });
        await this._execTask();
        this._detectSummon(pidx, 'end-phase');
        await this._execTask();
        this._doActionAfter(pidx);
        await this._execTask();
        player.phase = PHASE.ACTION_END;
        if (this.players[pidx ^ 1].phase != PHASE.ACTION_END) {
            this.startIdx = pidx;
        }
        await wait(() => this.isGettingCard == null && this.isAddingCard == null && this.isDiscarding == null);
        const isActionEnd = this.players.every(p => p.phase == PHASE.ACTION_END);
        if (!isActionEnd) this._changeTurn(pidx, false, 'endPhase');
        this.players.forEach(p => {
            if (isActionEnd) p.UI.info = '结束阶段...';
            else if (p.pidx == this.currentPlayerIdx) p.UI.info = '对方行动中....';
            else p.UI.info = '对方结束已结束回合...';
        });
        this.players[this.currentPlayerIdx ^ 1].canAction = true;
        this._writeLog(`[${this.players[pidx].name}]结束了回合`);
        this.emit(flag, pidx, { tip: isCdt(isActionEnd, '回合结束阶段') });
        if (isActionEnd) { // 双方都结束回合，进入回合结束阶段
            this.phase = PHASE.ACTION_END;
            this._writeLog(`第${this.round}轮结束`);
            this._doPhaseEnd(pidx, flag);
        }
    }
    /**
     * 状态被移除时发动
     * @param pidx 
     */
    private _doStatusDestroy(pidx: number, cStatus: Status, hidx: number) {
        this._detectStatus(pidx, STATUS_TYPE.Attack, 'status-destroy', { cStatus, hidxs: [hidx], isUnshift: true, isQuickAction: 2 });
    }
    /**
     * 召唤物消失时发动
     * @param pidx 玩家序号
     */
    private _doSummonDestroy(pidx: number, summon: Summon) {
        this._detectSummon(pidx, 'summon-destroy', { csummon: [summon], isUnshift: true });
        this._detectSupport(pidx, 'summon-destroy');
    }
    /**
     * 支援物消失时发动
     * @param pidx 玩家序号
     * @param csupport 当前支援物
     */
    private _doSupportDestroy(pidx: number) {
        this._detectSupport(pidx, 'support-destroy');
    }
    /**
     * 进行伤害
     * @param pidx 造成伤害的角色
     * @param damageVO 伤害信息
     * @param options.isSwitch 是否切换角色
     * @param options.slotSelect 装备亮起
     * @param options.summonSelect 装备亮起
     * @param options.canAction 是否可行动
     * @param options.isQuickAction 是否为快速行动
     * @param options.atkname 攻击实体名称
     */
    private _doDamage(pidx: number, damageVO: DamageVO, options: {
        isSwitch?: number, slotSelect?: number[], summonSelect?: number[], canAction?: boolean, isQuickAction?: boolean, atkname?: string,
    } = {}) {
        if (damageVO == -1) return { isDie: false };
        let isDie = -1;
        const { isSwitch = -1, slotSelect, summonSelect, canAction = true, isQuickAction = false, atkname = '' } = options;
        const { atkPidx, atkHidx, dmgElements = [], willDamages = [], willHeals = [] } = damageVO;
        const logPrefix = `[${this.players[atkPidx].name}]${atkHidx > -1 ? `[${this.players[atkPidx].heros[atkHidx].name}]` : `${atkname}`}对`;
        const logs: string[] = [];
        win: for (const p of this.players) {
            let heroDie = -1;
            for (const h of p.heros) {
                const phidx = h.hidx + p.pidx * this.players[0].heros.length;
                const heal = Math.max(0, willHeals[phidx] ?? 0);
                if (h.hp > 0 || heal % 1 != 0) {
                    const damage = willDamages[phidx]?.reduce((a, b) => a + Math.max(0, b), 0) ?? 0;
                    if (heal % 1 != 0) h.hp = Math.ceil(heal);
                    else h.hp = Math.max(0, h.hp - damage + heal);
                    if ((willHeals[phidx] ?? -1) >= 0) logs.push(`${logPrefix}[${p.name}][${h.name}]治疗${Math.ceil(heal)}点`);
                    if ((willDamages[phidx]?.[0] ?? -1) >= 0) logs.push(`${logPrefix}[${p.name}][${h.name}]造成${willDamages[phidx][0]}点${ELEMENT_NAME[dmgElements[phidx]]}伤害`);
                    if ((willDamages[phidx]?.[1] ?? 0) > 0) logs.push(`${logPrefix}[${p.name}][${h.name}]造成${willDamages[phidx][1]}点穿透伤害`);
                    // 被击倒
                    if (h.hp <= 0 && h.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonDefeat)) && !h.talentSlot?.hasTag(CARD_TAG.NonDefeat)) {
                        h.heroStatus.forEach(sts => {
                            if (!sts.hasType(STATUS_TYPE.NonDestroy)) {
                                sts.useCnt = 0;
                                sts.roundCnt = 0;
                            }
                        });
                        h.talentSlot = null;
                        h.artifactSlot = null;
                        h.weaponSlot = null;
                        h.attachElement.length = 0;
                        h.energy = 0;
                        h.skills.forEach(s => {
                            s.useCnt = 0;
                            s.perCnt = 0;
                            s.useCntPerRound = 0;
                        });
                        if (this._isWin() > -1) break win;
                        this.players[p.pidx ^ 1].canAction = false;
                        if (h.isFront) {
                            isDie = p.pidx;
                            heroDie = h.hidx;
                        }
                    }
                } else {
                    willDamages[phidx] = [-1, 0];
                }
            }
            if (heroDie > -1) {
                if (isSwitch > -1 && this.players[p.pidx].heros[isSwitch].hp > 0) {
                    isDie = -1;
                    heroDie = -1;
                } else {
                    this.players[p.pidx].phase += 3;
                    this.players[p.pidx].UI.info = '请选择出战角色...';
                    this.players[p.pidx ^ 1].UI.info = '等待对方选择出战角色......';
                    this.players[p.pidx ^ 1].playerInfo.isKillByMyRound = true;
                    const diehi = heroDie;
                    // 击倒对方角色
                    if (heroDie != pidx) this._detectSlot(pidx, 'kill');
                    setTimeout(() => {
                        this.players[p.pidx].heros[diehi].isFront = false;
                        const tips = ['', ''];
                        tips[p.pidx] = '请选择出战角色';
                        tips[p.pidx ^ 1] = '等待对方选择出战角色';
                        this.emit(`${damageVO.dmgSource}-doDamage-heroDie`, isDie, { tip: tips });
                    }, 2400);
                }
            }
        }
        const isActionInfo = ['skill', 'status', 'card'].includes(damageVO.dmgSource);
        this.emit(`${damageVO.dmgSource}-doDamage`, pidx, {
            damageVO,
            isActionInfo,
            slotSelect,
            summonSelect,
            notUpdate: damageVO.dmgSource == 'status',
            canAction,
            isQuickAction,
        });
        logs.forEach(log => this._writeLog(log));
        return { isDie: isDie > -1 }
    }
    /**
     * 检测治疗
     * @param pidx 玩家序号
     * @param heal 治疗量
     * @param heros 治疗角色组
     * @param options.isExec 是否执行
     * @param options.isQuickAction 是否为快速行动
     */
    _detectHeal(pidx: number, heal: number[], heros: Hero[], options: { isExec?: boolean, isQuickAction?: boolean } = {}) {
        const { isExec = true, isQuickAction = false } = options;
        const supportCnt = this.players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        if (heal.some(hl => hl > -1)) {
            heal.forEach((h, hi) => {
                if (h > -1) this._detectSkill(pidx, 'heal', { hidxs: hi, heros, heal, isQuickAction, isExec });
            });
            this._detectSlot(pidx, 'heal', { hidxs: allHidxs(heros), heal, heros, isQuickAction, isExec });
            this._detectStatus(pidx, STATUS_TYPE.Usage, 'heal', { heal, heros, isQuickAction, isExec });
            const { supportCnt: sptCnt } = this._detectSupport(pidx, 'heal', { heal, isQuickAction, isExec });
            this._detectSupport(pidx ^ 1, 'heal-oppo', { heal, isQuickAction, isExec });
            if (!isExec) supportCnt[pidx].forEach((_, i, a) => a[i] += sptCnt[pidx][i]);
        }
        return { supportCnt }
    }
    /**
     * 弃牌后的处理
     * @param pidx 玩家序号
     * @param discards 将要舍弃的牌
     * @param options players 玩家信息, isAction 是否为战斗行动, isExec 是否执行
     */
    private _doDiscard(pidx: number, discards: Card[], options: { players?: Player[], isAction?: boolean, isExec?: boolean } = {}) {
        const { players = this.players, isAction = false, isExec = false } = options;
        const { heros, summons } = players[pidx];
        const cmds: Cmds[] = [];
        let willHeals: number[] | undefined;
        for (const card of discards) {
            const cardres = card.handle(card, { summons, trigger: 'discard', isExec });
            if (this._hasNotTriggered(cardres.trigger, 'discard')) continue;
            if (cardres.cmds) cmds.push(...cardres.cmds);
            if (cardres.summon) assgin(summons, this._updateSummon(pidx, cardres.summon, summons, players[pidx], isExec));
        }
        this._detectSkill(pidx, 'discard', { heros: players[pidx].heros, discards, isExec });
        const { bWillHeals: stsheal } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'discard', { discards, heros, isExec, isOnlyExecSts: !isExec, isQuickAction: isCdt(!isAction, 2) });
        if (!willHeals) willHeals = stsheal;
        else mergeWillHeals(willHeals, stsheal);
        this._detectSupport(pidx, 'discard', { discard: discards.length, isExec, isQuickAction: !isAction });
        return { cmds, willHeals }
    }
    /**
     * 状态攻击
     */
    async _doStatusAtk(stsTask: StatusTask, isPriority: boolean) {
        if (!this._hasNotDieChange() || !this.taskQueue.isExecuting) return false;
        if (!isPriority && this.taskQueue.priorityQueue == undefined) this.taskQueue.priorityQueue = [];
        const { entityId, group, pidx, isSelf = 0, trigger = '', hidx: ohidx = this.players[pidx].hidx,
            isSwitchAtk: isa = false, isAfterSwitch = false, discards = [], card, skid } = stsTask;
        let { isQuickAction = false } = stsTask;
        if (isAfterSwitch) await delay(2300);
        let { heros: aheros, hidx: ahidx, summons: aSummon, pile, handCards, combatStatus } = this.players[pidx];
        const { heros: eheros, hidx: eFrontIdx, combatStatus: eCombatStatus } = this.players[pidx ^ 1];
        ahidx = group == STATUS_GROUP.combatStatus ? ahidx : ohidx;
        const atkStatus = () => (group == STATUS_GROUP.heroStatus ? this.players[pidx].heros[ahidx].heroStatus : combatStatus).find(sts => sts.entityId == entityId)!;
        const atkedIdx = isSelf ? ahidx : eFrontIdx;
        if (atkStatus() == undefined) {
            console.error('@_doStatusAtk: 状态不存在');
            return true;
        }
        const stsres = atkStatus().handle(atkStatus(), {
            heros: aheros,
            combatStatus,
            eheros,
            eCombatStatus,
            trigger,
            hidx: ahidx,
            pile,
            summons: aSummon,
            hcards: handCards,
            discards,
            card,
            isExecTask: true,
        });
        const stsreshidxs = stsres.hidxs ?? getBackHidxs(isSelf ? aheros : eheros);
        let { willDamages, dmgElements, players: players1, elrcmds, elTips, isQuickAction: iqa }
            = this._calcDamage(
                pidx,
                (stsres.element ?? ELEMENT_TYPE.Physical) as ElementType,
                new Array((isSelf ? aheros : eheros).length).fill(0).map((_, i) => [
                    i == atkedIdx ? (stsres.damage ?? -1) : -1,
                    (stsreshidxs.includes(i)) ? (stsres.pdmg ?? 0) : 0,
                ]),
                atkedIdx,
                this.players,
                { isAtkSelf: isSelf, skid }
            );
        isQuickAction ||= iqa;
        assgin(this.players, players1);
        const oCnt = atkStatus().useCnt;
        const { cmds: execmds = [] } = stsres.exec?.(atkStatus(), { heros: aheros, summons: aSummon, combatStatus }) ?? {};
        let willHeals: number[][] = [];
        const cmds = [...(stsres.cmds ?? []), ...(execmds ?? []), ...elrcmds[0]];
        this._doCmds(pidx ^ +!isSelf, elrcmds[1]);
        if (stsres.heal) cmds.push({ cmd: 'heal', cnt: stsres.heal, hidxs: stsres.hidxs });
        if (cmds.length > 0) {
            const { willHeals: cmdheal, ndices } = this._doCmds(pidx, cmds);
            if (cmdheal) willHeals = cmdheal;
            if (ndices) this.players[pidx].dice = ndices;
        }
        let isSwitchAtk = isa;
        if (!isSelf && elrcmds[0].some(cmds => cmds.cmd?.includes('switch') && cmds.isOppo)) {
            const { statusAtks: stpidx } = this._detectStatus(pidx ^ 1, STATUS_TYPE.Attack, ['change-from', 'change-to'], { hidxs: [eFrontIdx] });
            if (stpidx.length > 0) isSwitchAtk = true;
        }
        if (isSwitchAtk) { // todo 是否有因为切换而产生的攻击

        }
        const atkname = atkStatus().name;
        this._writeLog(`[${this.players[pidx].name}][${atkname}]发动{${oCnt != -1 ? `useCnt:${oCnt}->${atkStatus().useCnt}` : ''}}`, 'info');
        const whLen = Math.max(1, willHeals.length);
        for (let hli = 0; hli < whLen; ++hli) {
            const hl = willHeals[hli];
            const canAction = hli == whLen - 1;
            this._doDamage(pidx ^ isSelf, {
                dmgSource: 'status',
                atkPidx: pidx ^ isSelf,
                atkHidx: -1,
                tarHidx: atkedIdx,
                willDamages,
                dmgElements,
                elTips,
                willHeals: hl,
                selected: [pidx, atkStatus().group, ahidx, atkStatus().group == STATUS_GROUP.heroStatus ? getObjIdxById(aheros[ahidx].heroStatus, atkStatus().id) : getObjIdxById(this.players[pidx].combatStatus, atkStatus().id)],
            }, { atkname, canAction, isQuickAction });
            if (!canAction) await delay(2250);
        }
        await delay(2100);
        if (!atkStatus().hasType(STATUS_TYPE.Accumulate) && (atkStatus().useCnt == 0 || atkStatus().roundCnt == 0)) {
            atkStatus().type.length = 0;
        }
        this.emit(`statusAtk-${atkname}-after`, pidx);
        return true;
    }
    /**
    * 检测技能发动
    * @param pidx 玩家序号
    * @param hidx 发动技能角色的索引idx
    * @param trigger 触发的时机
    * @param options players 玩家组, heros 角色组, eheros 敌方角色组, isExec 是否执行, getdmg 受到伤害数, cskid 只检测某技能id,
    *                heal 回血数, discards 我方弃牌, dmg 造成的伤害, hidxs 只检测某些序号角色, isExecTask 是否为执行任务, 
    *                isQuickAction 是否为快速行动, card 打出的卡牌
    * @returns isQuickAction: 是否为快速行动, heros 变化后的我方角色组, eheros 变化后的对方角色组, isTriggered 是否触发被动
    */
    _detectSkill(pidx: number, otrigger: Trigger | Trigger[],
        options: {
            players?: Player[], heros?: Hero[], eheros?: Hero[], hidxs?: number[] | number, cskid?: number,
            isExec?: boolean, getdmg?: number[], heal?: number[], discards?: Card[], isExecTask?: boolean,
            dmg?: number[], isQuickAction?: boolean, card?: Card,
        } = {}
    ) {
        const { players = this.players, isExec = true, getdmg = [], dmg = [], heal = [], discards = [], card,
            isExecTask = false, heros = players[pidx].heros, eheros = players[pidx ^ 1].heros, cskid = -1 } = options;
        let { hidxs = allHidxs(heros), isQuickAction = false } = options;
        let isTriggered = false;
        const cmds: Cmds[] = [];
        const task: [() => void | Promise<void>, number?][] = [];
        if (!Array.isArray(hidxs)) hidxs = [hidxs];
        for (const hidx of hidxs) {
            const hero = heros[hidx];
            const skills = hero.skills;
            const triggers: Trigger[] = [];
            if (typeof otrigger == 'string') triggers.push(otrigger);
            else triggers.push(...otrigger);
            for (let i = 0; i < skills.length; ++i) {
                const skill = skills[i];
                if (cskid > -1 && cskid != skill.id) continue;
                for (const trigger of triggers) {
                    const skillres = skill.handle({
                        hero,
                        combatStatus: players[pidx].combatStatus,
                        skid: skill.id,
                        getdmg,
                        trigger,
                        heros,
                        eheros,
                        heal,
                        discards,
                        dmg,
                        talent: isExec ? hero.talentSlot : isCdt(card?.id == getTalentIdByHid(hero.id), card) ?? hero.talentSlot,
                    });
                    if (this._hasNotTriggered(skillres.trigger, trigger)) continue;
                    isTriggered = true;
                    isQuickAction ||= !!skillres.isQuickAction;
                    cmds.push(...(skillres.cmds ?? []));
                    cmds.push({ cmd: 'getStatus', status: skillres.status, hidxs: [hidx] });
                    cmds.push({ cmd: 'getStatus', status: skillres.statusOppo, isOppo: true });
                    if (isExec) {
                        if (isExecTask || skillres.isNotAddTask) skillres.exec?.();
                        if (!skillres.isNotAddTask) {
                            if (!isExecTask) {
                                const args = clone(Array.from(arguments));
                                args[2] = {
                                    ...(clone(args[2]) ?? {}),
                                    isExecTask: true,
                                    cskill: i,
                                    hidxs: hidx,
                                    players: undefined,
                                    heros: undefined,
                                    eheros: undefined,
                                };
                                this.taskQueue.addTask(`skill-${skill.name}:${trigger}`, args);
                            } else {
                                let intvl = 1000;
                                if (cmds.some(({ cmd }) => cmd == 'addCard')) intvl += 1200;
                                if (cmds.some(({ cmd }) => cmd == 'getCard')) intvl += 1500;
                                const skillHandle = () => {
                                    this._doCmds(pidx, cmds);
                                    this._writeLog(`[${players[pidx].name}][${hero.name}][${skill.name}]发动`, 'info');
                                    this.emit(`_doSkill-${skill.name}`, pidx, { heroSelect: [pidx, hidx], isActionInfo: true });
                                }
                                task.push([skillHandle, intvl]);
                            }
                        } else {
                            this._doCmds(pidx, cmds, { heros, eheros, isExec });
                        }
                    }
                }
            }
        }
        return { isQuickAction, cmds, isTriggered, task }
    }
    /**
     * 检测装备发动
     * @param pidx 玩家序号
     * @param triggers 触发时机
     * @param options 配置项: isOnlyRead 是否只读, hidxs 当前角色索引, summons 当前玩家召唤物, switchHeroDiceCnt 切换角色需要骰子,
     *                        heal 回血量, heros 我方角色组, eheros 敌方角色组, hcard 使用的牌, isChargedAtk 是否为重击, skid 使用技能的id, 
     *                        taskMark 任务标记, isFallAtk 是否为下落攻击, isExec 是否执行task(配合新heros), dieChangeBack 是否为死后切换角色,
     *                        usedDice 使用的骰子数, ehidx 被攻击角色的idx, minusDiceCard 用卡减骰子, isSummon 是否为召唤物攻击id
     *                        minusDiceSkillIds 用技能减骰子id, isExecTask 是否执行任务队列, getdmg 受到的伤害, isQuickAction 是否为快速攻击,
     *                        isUnshift 是否立即加入task, minusDiceSkill 技能当前被x减费后留存的骰子数
     * @returns willHeals 将要回血, switchHeroDiceCnt 切换角色需要骰子, addDmg 条件加伤, heroStatus 新增角色状态, combatStatus 新增出战状态,
     *          addDmgSummon 召唤物加伤, nsummons 新出的召唤物, isQuickAction 是否为快速攻击, supportCnt 支援区的变化数
     */
    private _detectSlot(pidx: number, otriggers: Trigger | Trigger[], options: {
        players?: Player[], hidxs?: number | number[], summons?: Summon[], ehidx?: number, taskMark?: [number, CardSubtype],
        switchHeroDiceCnt?: number, heal?: number[], heros?: Hero[], eheros?: Hero[], minusDiceCard?: number, isUnshift?: boolean,
        hcard?: Card, isChargedAtk?: boolean, isFallAtk?: boolean, skid?: number, isSummon?: number,
        isExec?: boolean, intvl?: number[], usedDice?: number, isQuickAction?: boolean, getdmg?: number[],
        minusDiceSkillIds?: number[], minusDiceSkill?: number[][],
    } = {}) {
        const triggers: Trigger[] = [];
        if (typeof otriggers == 'string') triggers.push(otriggers);
        else triggers.push(...otriggers);
        const { players = this.players, summons = players[pidx].summons, heal, hcard, ehidx = players[pidx ^ 1].hidx,
            heros = players[pidx].heros, eheros = players[pidx ^ 1].heros, taskMark, isUnshift = false, minusDiceSkillIds = [],
            isChargedAtk = false, isFallAtk = players[pidx].isFallAtk, isExec = true, isSummon = -1, minusDiceSkill = [],
            skid = -1, usedDice = 0, getdmg } = options;
        const player = players[pidx];
        let { switchHeroDiceCnt = 0, minusDiceCard = 0, hidxs = [player.hidx], isQuickAction = false } = options;
        let addDmg = 0;
        let addDmgSummon = 0;
        const heroStatus: Status[] = [];
        const combatStatus: Status[] = [];
        let nsummons: Summon[] = [];
        const cmds: Cmds[] = [];
        let minusDiceHero = 0;
        const task: [() => void | Promise<void>, number?][] = [];
        const ahidx = player.hidx;
        if (Array.isArray(hidxs)) {
            hidxs = hidxs.map(hi => (hi - ahidx + heros.length) % heros.length).sort().map(hi => (hi + ahidx) % heros.length);
        } else if (hidxs < 0) {
            hidxs = [];
        } else {
            hidxs = [hidxs];
        }
        let exwkhidxs: number[] = [];
        for (const hidx of hidxs) {
            if (taskMark && taskMark[0] != hidx) continue;
            const fHero = heros[hidx];
            const slots = [fHero.weaponSlot, fHero.artifactSlot, fHero.talentSlot];
            if (hcard && hcard.userType == fHero.id && slots.every(slot => slot?.id != hcard.id)) slots.push(hcard);
            for (const slot of slots) {
                if (slot == null || (taskMark && !slot.hasSubtype(taskMark[1]))) continue;
                const tcmds: Cmds[] = [];
                const trgs: Trigger[] = [];
                let isAddTask: boolean = false;
                const isMinusDiceCard = hcard && hcard.cost + hcard.anydice > minusDiceCard;
                for (const trigger of triggers) {
                    const slotres = slot.handle(slot, {
                        heros,
                        combatStatus: player.combatStatus,
                        pile: player.pile,
                        hidxs: [hidx],
                        eheros,
                        ehidx,
                        eAttachments: this.players[pidx ^ 1].heros.map(h => h.attachElement),
                        summons,
                        trigger,
                        switchHeroDiceCnt,
                        hcard,
                        heal,
                        isChargedAtk,
                        isFallAtk,
                        hcards: player.handCards,
                        dicesCnt: player.dice.length - usedDice,
                        skid,
                        isSummon,
                        isExec,
                        minusDiceCard,
                        isMinusDiceTalent: isMinusDiceCard && hcard.hasSubtype(CARD_SUBTYPE.Talent) && hcard.userType == heros[hidx]?.id,
                        isMinusDiceCard,
                        isMinusDiceSkill: minusDiceSkillIds.includes(slot.entityId),
                        minusDiceSkill,
                        getdmg,
                        playerInfo: player.playerInfo,
                        isExecTask: !!taskMark,
                    });
                    if (this._hasNotTriggered(slotres.trigger, trigger)) continue;
                    trgs.push(trigger);
                    tcmds.push(...(slotres.execmds ?? []));
                    cmds.push(...(slotres.execmds ?? []));
                    if (taskMark || (isExec && !slotres.execmds?.length && !slotres.isAddTask)) {
                        slotres.exec?.();
                    }
                    isAddTask ||= !!slotres.isAddTask;
                    switchHeroDiceCnt -= slotres.minusDiceHero ?? 0;
                    minusDiceHero += slotres.minusDiceHero ?? 0;
                    minusDiceCard += slotres.minusDiceCard ?? 0;
                    addDmg += slotres.addDmgCdt ?? 0;
                    addDmgSummon += slotres.addDmgSummon ?? 0;
                    if (trigger == 'will-killed' && slot.hasTag(CARD_TAG.NonDefeat)) exwkhidxs.push(hidx);
                    if (slotres.summon) nsummons.push(...slotres.summon);
                    const slotsts = slotres.status ?? [];
                    heroStatus.push(...slotsts.filter(s => s.group == STATUS_GROUP.heroStatus));
                    combatStatus.push(...slotsts.filter(s => s.group == STATUS_GROUP.combatStatus));
                    const slotstsop = slotres.statusOppo ?? [];
                    const hstop = slotstsop.filter(s => s.group == STATUS_GROUP.heroStatus);
                    const cstop = slotstsop.filter(s => s.group == STATUS_GROUP.combatStatus);
                    if (hstop.length > 0) {
                        (slotres.hidxs ?? [eheros.findIndex(h => h.isFront)]).forEach(hi => {
                            eheros[hi].heroStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(pidx ^ 1, hstop, eheros[hi].heroStatus));
                        });
                    }
                    if (cstop.length > 0) {
                        players[pidx ^ 1].combatStatus.splice(0, MAX_STATUS_COUNT, ...this._updateStatus(pidx ^ 1, cstop, players[pidx ^ 1].combatStatus));
                    }
                }
                if (isExec && (tcmds.length > 0 || isAddTask)) {
                    if (!taskMark) {
                        const args = clone(Array.from(arguments));
                        args[2] = {
                            ...(clone(args[2]) ?? {}),
                            taskMark: [hidx, slot.subType[0]],
                            players: undefined,
                            heros: undefined,
                            eheros: undefined,
                        };
                        this.taskQueue.addTask(`slot-${slot.name}(${slot.entityId}):${trgs}`, args, isUnshift);
                    } else {
                        let intvl = 800;
                        const slotHandle = () => {
                            let willHeals: number[][] | undefined;
                            if (!isAddTask || tcmds.length > 0) {
                                const { ndices, willHeals: cmdwh } = this._doCmds(pidx, tcmds);
                                if (ndices != undefined) players[pidx].dice = ndices;
                                if (cmdwh != undefined && cmdwh.length > 0) willHeals = cmdwh;
                            }
                            this._writeLog(`[${player.name}][${heros[hidx].name}][${slot.name}]发动`, 'info');
                            const slotSelect = [pidx, hidx, SLOT_CODE[slot.subType[0]]];
                            if (willHeals) {
                                willHeals.forEach(wh => {
                                    this._doDamage(pidx, {
                                        dmgSource: 'card',
                                        atkPidx: pidx,
                                        atkHidx: -1,
                                        tarHidx: hidx,
                                        willHeals: wh,
                                        willDamages: [],
                                        dmgElements: [],
                                        elTips: [],
                                    }, { atkname: slot.name, slotSelect, isQuickAction });
                                });
                            } else {
                                this.emit(`_doSlot-${slot.name}`, pidx, { slotSelect, isQuickAction });
                            }
                        };
                        task.push([slotHandle, intvl]);
                    }
                }
            }
        }
        const { willHeals: cmdheal, supportCnt } = this._doCmds(pidx, cmds, { getdmg, isExec: false });
        const willHeals = cmdheal?.reduce((a, c) => {
            c.forEach((hl, hli) => {
                if (a[hli] == -1) a[hli] = hl;
                else a[hli] += hl;
            });
            return a;
        }, new Array<number>(heros.length + eheros.length).fill(-1));
        return {
            willHeals, nwkhidxs: hidxs.filter(hi => !exwkhidxs.includes(hi)), switchHeroDiceCnt, addDmg, addDmgSummon,
            supportCnt, heroStatus, combatStatus, minusDiceHero, nsummons, isQuickAction, minusDiceCard, cmds, task,
        }
    }
    /**
     * 状态效果发动
     * @param pidx 玩家idx
     * @param otypes 状态类型
     * @param otrigger 触发条件
     * @param options isQuickAction 是否有快速行动, isExec 是否执行, isOnlyFront 是否只执行出战角色, switchHeroDiceCnt 实际减少切换角色的骰子,
     *                phase 当前最新阶段, players 最新玩家信息, hidxs 只执行某几个角色, heal 回血数, nWillHeals 用于生命之契禁疗
     *                card 使用的卡, isOnlyHeroStatus 是否只执行角色状态, isOnlyCombatStatus 是否只执行出战状态, heros 当前角色组, eheros 敌人角色组,
     *                isSwitchAtk 是否切换攻击角色, taskMark 任务标记, skilltype 使用技能的类型, isSummon 触发的召唤物, discards 舍弃牌,
     *                isUnshift 是否插入执行, dmgSource 伤害来源id, hasDmg 是否造成伤害, minusDiceSkillIds 减骰id, dmgElement 造成伤害的元素
     *                source 触发来源id, cStatus 只检测这一个状态, minusDiceSkill 技能当前被x减费后留存的骰子数, skid 技能id
     *                isOnlyExecSts 是否只执行status的exec方法(用于calcDamage的预览), dmgedHidx 受到攻击的角色序号, fhidx 出战角色序号(用于切换时判断fromHidx)
     * @returns isQuickAction 是否有快速行动, minusDiceHero 减少切换角色的骰子,switchHeroDiceCnt 实际减少切换角色的骰子, cmds 要执行的命令, 
     *          statusIdsAndPidx 额外攻击, isInvalid 使用卡是否有效, minusDiceCard 使用卡减少骰子
    */
    private _detectStatus(pidx: number, otypes: StatusType | StatusType[], otrigger: Trigger | Trigger[], options: {
        isQuickAction?: boolean | number, isExec?: boolean, isOnlyFront?: boolean, switchHeroDiceCnt?: number, heal?: number[],
        phase?: number, players?: Player[], hidxs?: number[], skilltype?: SkillType, card?: Card, discards?: Card[],
        isOnlyHeroStatus?: boolean, isOnlyCombatStatus?: boolean, heros?: Hero[], minusDiceCard?: number, isSummon?: number, cStatus?: Status,
        eheros?: Hero[], isUnshift?: boolean, isSwitchAtk?: boolean, taskMark?: number[], dmgSource?: number, dmgedHidx?: number,
        hasDmg?: boolean, minusDiceSkillIds?: number[], source?: number, isChargedAtk?: boolean, isFallAtk?: boolean,
        minusDiceSkill?: number[][], isOnlyExecSts?: boolean, fhidx?: number, dmgElement?: DamageType, skid?: number,
    } = {}) {
        const types: StatusType[] = [];
        const triggers: Trigger[] = [];
        if (Array.isArray(otypes)) types.push(...otypes);
        else types.push(otypes);
        if (typeof otrigger == 'string') triggers.push(otrigger);
        else triggers.push(...otrigger);
        let { isQuickAction: oiqa = 0, switchHeroDiceCnt = 0, minusDiceCard = 0 } = options;
        let isQuickAction = Number(oiqa);
        const { isExec = true, isOnlyFront = false, players = this.players, phase = this.players[pidx].phase, hasDmg = false,
            hidxs, card, isOnlyHeroStatus = false, isOnlyCombatStatus = false, heal, discards = [],
            isUnshift = false, isSwitchAtk = false, taskMark, skilltype, isSummon = -1, dmgSource = -1,
            minusDiceSkillIds = [], source = -1, isChargedAtk = false, isFallAtk = false, cStatus,
            minusDiceSkill = [], isOnlyExecSts = false, dmgedHidx = -1, fhidx, dmgElement, skid = -1 } = options;
        let addDiceHero = 0;
        let minusDiceHero = 0;
        let isInvalid = false;
        const cmds: Cmds[] = [];
        const taskcmds: Cmds[] = [];
        const statusAtks: StatusTask[] = [];
        const statusAtksPre: StatusTask[] = [];
        let aWillHeals: number[] | undefined;
        let readySkill = -1;
        let iqa = false;
        const task: [() => void | Promise<void>, number?][] = [];
        let addDmg = 0;
        let getDmg = 0;
        let addDmgSummon = 0;
        const nsummons: Summon[] = [];
        const pdmgs: [number, number[] | undefined, boolean][] = [];
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const pheros = options.heros ?? player.heros;
        const peheros = options.eheros ?? opponent.heros;
        const detectStatus = (stses: Status | Status[], group: StatusGroup, hidx: number, trigger: Trigger) => {
            if (!Array.isArray(stses)) stses = [stses];
            const stsEntityIds = stses.map(sts => sts.entityId);
            for (const sts of stses) {
                const isDiffTaskMark = taskMark && ((group == STATUS_GROUP.heroStatus && taskMark[0] != hidx) || taskMark[1] != group || taskMark[2] != sts.id);
                if ((types.length > 0 && !sts.hasType(...types)) || isDiffTaskMark || !stsEntityIds.includes(sts.entityId)) continue;
                const isMinusDiceCard = card && card.cost + card.anydice > minusDiceCard;
                const stsres = sts.handle(sts, {
                    heros: pheros,
                    combatStatus: player.combatStatus,
                    eheros: peheros,
                    eCombatStatus: opponent.combatStatus,
                    hidx,
                    dmgedHidx,
                    trigger,
                    phase: pidx == player.phase ? phase : player.phase,
                    card,
                    talent: isExec ? getObjById(pheros, getHidById(sts.id))?.talentSlot : isCdt(card?.id == getTalentIdByHid(getHidById(sts.id)), card) ?? getObjById(pheros, getHidById(sts.id))?.talentSlot,
                    discards,
                    heal,
                    summons: player.summons,
                    esummons: opponent.summons,
                    hcards: player.handCards,
                    pile: player.pile,
                    playerInfo: player.playerInfo,
                    skilltype,
                    skid,
                    isSummon,
                    isFallAtk,
                    isChargedAtk,
                    dmgSource,
                    hasDmg,
                    dmgElement,
                    source,
                    minusDiceCard,
                    isMinusDiceCard,
                    isMinusDiceTalent: isMinusDiceCard && card.hasSubtype(CARD_SUBTYPE.Talent) && card.userType == pheros[hidx]?.id,
                    isMinusDiceWeapon: isMinusDiceCard && card.hasSubtype(CARD_SUBTYPE.Weapon),
                    isMinusDiceArtifact: isMinusDiceCard && card.hasSubtype(CARD_SUBTYPE.Artifact),
                    isMinusDiceSkill: minusDiceSkillIds.includes(sts.entityId),
                    minusDiceSkill,
                    randomInt: this._randomInt.bind(this),
                    randomInArr: this._randomInArr.bind(this),
                });
                if (this._hasNotTriggered(stsres.trigger, trigger)) continue;
                if (sts.hasType(STATUS_TYPE.AddDamage)) {
                    addDmg += stsres.addDmgCdt ?? 0;
                    getDmg += stsres.getDmg ?? 0;
                    addDmgSummon += stsres.addDmgSummon ?? 0;
                }
                const isTriggeredQuick = isQuickAction == 0 && stsres.isQuickAction;
                if (group == STATUS_GROUP.combatStatus) {
                    if (isQuickAction == 1 && stsres.isQuickAction && stsres.minusDiceHero == undefined) continue;
                    if (isQuickAction < 2) isQuickAction = Number(stsres.isQuickAction ?? false);
                }
                addDiceHero += stsres.addDiceHero ?? 0;
                minusDiceHero += stsres.minusDiceHero ?? 0;
                minusDiceCard += stsres.minusDiceCard ?? 0;
                nsummons.push(...(stsres.summon ?? []));
                if (!sts.hasType(STATUS_TYPE.Attack) && stsres.pdmg) pdmgs.push([stsres.pdmg, stsres.hidxs, !!stsres.isSelf]);
                isInvalid ||= stsres.isInvalid ?? false;
                let stsiqa = isQuickAction == 2 || (card && !card.hasSubtype(CARD_SUBTYPE.Action)) || !!stsres.isQuickAction;
                iqa ||= stsiqa;
                if (isExec || isOnlyExecSts) {
                    const oCnt = sts.useCnt;
                    const stsexecres = stsres.exec?.(undefined, { switchHeroDiceCnt, isQuickAction: isTriggeredQuick });
                    switchHeroDiceCnt = stsexecres?.switchHeroDiceCnt ?? switchHeroDiceCnt;
                    const stscmds = [...(stsres.cmds ?? []), ...(stsexecres?.cmds ?? [])];
                    (stsres.isAddTask ? taskcmds : cmds).push(...stscmds);
                    if (!sts.hasType(STATUS_TYPE.Attack) && stsres.heal) {
                        const { willHeals: cmdheal = [] } = this._doCmds(pidx, [{ cmd: 'heal', cnt: stsres.heal, hidxs: stsres.hidxs }], { players });
                        aWillHeals = isCdt(cmdheal.length > 0, () => cmdheal!.reduce((a, c) => (mergeWillHeals(a, c), a)));
                    }
                    if (isExec && !isOnlyExecSts) {
                        if (
                            (types.includes(STATUS_TYPE.Attack) && !trigger.startsWith('after') && (stsres.damage || stsres.pdmg || stsres.heal)) ||
                            stscmds.some(({ cmd }) => cmd == 'heal' || cmd == 'revive')
                        ) {
                            (isUnshift ? statusAtksPre : statusAtks).push({
                                id: sts.id,
                                entityId: sts.entityId,
                                group,
                                pidx,
                                isSelf: +!!stsres.isSelf,
                                trigger,
                                hidx,
                                skid,
                                isSwitchAtk,
                                isQuickAction: stsiqa,
                                discards,
                                card,
                            });
                        } else {
                            if (stsres.isAddTask) {
                                let intvl = 1000;
                                if (stsres.damage || stsres.pdmg) intvl += 1000;
                                if (!taskMark) {
                                    const args = clone(Array.from(arguments));
                                    args[3] = {
                                        ...(clone(args[3]) ?? {}),
                                        taskMark: [hidx, group, sts.id],
                                    };
                                    this.taskQueue.addTask(`status-${sts.name}(${sts.entityId}):${trigger}`, args, isUnshift);
                                } else {
                                    const statusHandle = async () => {
                                        const { hidx: ahidx, dice } = this.players[pidx];
                                        const { ndices } = this._doCmds(pidx, stscmds, {
                                            hidxs: [group == STATUS_GROUP.combatStatus ? ahidx : hidx],
                                            trigger,
                                        });
                                        if (ndices) assgin(dice, ndices);
                                        const statuses = () => group == STATUS_GROUP.heroStatus ?
                                            this.players[pidx].heros[hidx].heroStatus :
                                            this.players[pidx].combatStatus;
                                        const curStatusIdx = statuses().findIndex(s => s.entityId == sts.entityId);
                                        const curStatus = () => statuses()[curStatusIdx];
                                        if (!curStatus()) return;
                                        if (!curStatus().hasType(STATUS_TYPE.TempNonDestroy, STATUS_TYPE.Accumulate)) curStatus().type.push(STATUS_TYPE.TempNonDestroy);
                                        stsres.exec?.(curStatus(), { heros: this.players[pidx].heros });
                                        this._writeLog(`[${player.name}]${trigger}:${sts.name}${oCnt != -1 ? `.useCnt:${oCnt}->${sts.useCnt}` : ''}`, 'system');
                                        this._writeLog(`[${this.players[pidx].name}][${curStatus().name}]发动`, 'info');
                                        const flag = `_doStatus-${group == STATUS_GROUP.heroStatus ? 'hero' : 'combat'}Status-task-${curStatus().name}`;
                                        this.emit(flag, pidx, { isActionInfo: true, isQuickAction: !!isQuickAction, statusSelect: [pidx, group, hidx, curStatusIdx] });
                                        if ((curStatus().useCnt == 0 || curStatus().roundCnt == 0) && !curStatus().hasType(STATUS_TYPE.Accumulate)) {
                                            await delay(intvl + 300);
                                            curStatus().type.splice(curStatus().type.indexOf(STATUS_TYPE.TempNonDestroy), 1);
                                            this.emit(flag + '-destroy', pidx);
                                        }
                                    };
                                    task.push([statusHandle, intvl]);
                                }
                            } else {
                                this._writeLog(`[${player.name}]${trigger}:${sts.name}${oCnt != -1 ? `.useCnt:${oCnt}->${sts.useCnt}` : ''}`, 'system');
                                this._doCmds(pidx, stscmds, { players, heros: pheros, eheros: peheros, hidxs: [hidx], source: sts.id });
                            }
                        }
                        if (trigger == 'useReadySkill') {
                            if (isExec) players[pidx].canAction = false;
                            readySkill = stsres.skill ?? -1;
                        }
                    }
                }
            }
        }
        for (const trigger of triggers) {
            for (let i = 0; i < pheros.length; ++i) {
                const hidx = (i + (fhidx ?? player.hidx)) % pheros.length;
                const chero = pheros[hidx];
                if (cStatus) {
                    detectStatus(cStatus, cStatus.group, hidxs?.[0] ?? hidx, trigger);
                    break;
                }
                if (chero.heroStatus.some(sts => sts.hasType(STATUS_TYPE.NonAction)) && trigger == 'useReadySkill') continue;
                if ((hidxs ?? [hidx]).includes(hidx) && !isOnlyCombatStatus && (chero.isFront || !isOnlyFront)) {
                    detectStatus(chero.heroStatus, STATUS_GROUP.heroStatus, hidx, trigger);
                }
                if (i == 0 && !isOnlyHeroStatus) detectStatus(player.combatStatus, STATUS_GROUP.combatStatus, hidx, trigger);
            }
        }
        if (isExec && !taskMark) {
            this.taskQueue.addStatusAtk(statusAtks, isUnshift);
            this.taskQueue.addStatusAtk(statusAtksPre, true);
        }
        if (readySkill > -1) setTimeout(() => this._useSkill(pidx, readySkill, { isReadySkill: true }), 1200);
        if (!isExec) cmds.push(...taskcmds);
        const { willHeals: cmdheal = [], supportCnt } = this._doCmds(pidx, cmds, { players, heros: pheros, eheros: peheros, isExec: false });
        const bWillHeals = isCdt(cmdheal.length > 0, () => cmdheal!.reduce((a, c) => (mergeWillHeals(a, c), a)));
        return {
            isQuickAction: !!isQuickAction || iqa, addDiceHero, minusDiceHero, switchHeroDiceCnt, statusAtks, isInvalid, minusDiceCard, task,
            addDmg, getDmg, addDmgSummon, nsummons, aWillHeals, bWillHeals, supportCnt, pdmgs, cmds,
        }
    }
    /**
     * 
     * @param pidx 玩家序号
     * @param otrigger 触发条件
     * @param options types 状态触发类型, isExec 是否执行, isOnlyFront 是否只检测出战角色, isOnlyHeroStatus 是否只检测角色状态, 
     *                isOnlyCombatStatus 是否只检测出战状态, hidxs 检测角色序号, 
     */
    // private _detectSlotAndStatus(pidx: number, otrigger: Trigger | Trigger[], options: {
    //     types?: StatusType | StatusType[], players?: Player[], hidxs?: number | number[], summons?: Summon[], ehidx?: number,
    //     slotTaskMark?: [number, CardSubtype], switchHeroDiceCnt?: number, heal?: number[], heros?: Hero[], eheros?: Hero[],
    //     minusDiceCard?: number, isUnshift?: boolean, hcard?: Card, isChargedAtk?: boolean, isFallAtk?: boolean, skid?: number,
    //     isSummon?: number, isExec?: boolean, intvl?: number[], usedDice?: number, isQuickAction?: boolean, getdmg?: number[],
    //     minusDiceSkillIds?: number[], minusDiceSkill?: number[][], isOnlyFront?: boolean, phase?: number, skilltype?: SkillType,
    //     card?: Card, discards?: Card[], isOnlyHeroStatus?: boolean, isOnlyCombatStatus?: boolean, cStatus?: Status,
    //     isSwitchAtk?: boolean, statusTaskMark?: number[], dmgSource?: number, dmgedHidx?: number, hasDmg?: boolean, source?: number,
    //     isOnlyExecSts?: boolean, fhidx?: number, dmgElement?: DamageType,
    // }) {

    // }
    /**
     * 召唤物效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param options isUnshift 是否前插入事件, csummon 当前的召唤物, isExec 是否执行召唤物攻击, hasDmg 是否造成伤害, isExecTask 是否执行任务队列,
     *                hcard 使用的牌, minusDiceSkillIds 减骰id, skid 使用技能id, tsummon 执行task的召唤物, hidx 当前出战角色
     *                players 当前玩家数组, eheros 当前敌方角色组, tround 当前触发回合, minusDiceSkill 技能当前被x减费后留存的骰子数
     * @returns smncmds 命令集, addDmg 加伤, addDiceHero 增加切换角色骰子数, switchHeroDiceCnt 改变骰子数, minusDiceSkill 用技能减骰子, willheals 将回血数
     */
    private _detectSummon(pidx: number, ostate: Trigger | Trigger[],
        options: {
            isUnshift?: boolean, csummon?: Summon[], isExec?: boolean, hasDmg?: boolean, isExecTask?: boolean, hidx?: number,
            hcard?: Card, minusDiceSkillIds?: number[], skid?: number, tsummon?: Summon[], isQuickAction?: boolean,
            players?: Player[], heros?: Hero[], eheros?: Hero[], tround?: number, minusDiceSkill?: number[][],
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostate == 'string') states.push(ostate);
        else states.push(...ostate);
        const { isUnshift = false, csummon, isExec = true, hasDmg = false, minusDiceSkillIds = [],
            players = this.players, hcard, isExecTask = false, skid = -1, tsummon, tround = 0,
            hidx = players[pidx].hidx, heros = players[pidx].heros, eheros = players[pidx ^ 1].heros,
            minusDiceSkill = [] } = options;
        let { isQuickAction = false } = options;
        const player = players[pidx];
        const isChargedAtk = player.dice.length % 2 == 0;
        const smncmds: Cmds[] = [];
        let addDmg = 0;
        let addDiceHero = 0;
        let switchHeroDiceCnt = 0;
        let smnres: SummonHandleRes | undefined;
        const task: [() => void | Promise<void>, number?][] = [];
        const summons: Summon[] = tsummon ?? csummon ?? [...player.summons];
        for (const state of states) {
            for (const summon of summons) {
                const summonres = summon.handle(summon, {
                    trigger: state,
                    heros,
                    eheros,
                    hidx,
                    isChargedAtk,
                    isFallAtk: player.isFallAtk,
                    hcard,
                    talent: isExec ? getObjById(heros, getHidById(summon.id))?.talentSlot : isCdt(hcard?.id == getTalentIdByHid(getHidById(summon.id)), hcard) ?? getObjById(heros, getHidById(summon.id))?.talentSlot,
                    isExec,
                    isMinusDiceSkill: minusDiceSkillIds.includes(summon.id),
                    minusDiceSkill,
                    skid,
                    tround,
                    force: isExecTask,
                });
                if (this._hasNotTriggered(summonres.trigger, state)) continue;
                isQuickAction ||= summonres.isQuickAction ?? false;
                smnres = summonres;
                if (summonres.isNotAddTask) {
                    addDmg += summonres.addDmgCdt ?? 0;
                    addDiceHero += summonres.addDiceHero ?? 0;
                    if (!isExec) continue;
                    if (summonres.exec && (!hasDmg || summonres.damage == undefined)) {
                        const { cmds = [], switchHeroDiceCnt: smnDiceCnt = 0 } = summonres.exec?.({
                            summon,
                            heros,
                            eheros,
                            isQuickAction,
                            combatStatus: player.combatStatus,
                            eCombatStatus: players[pidx ^ 1].combatStatus,
                        }) ?? {};
                        const { changedEl } = this._doCmds(pidx, cmds, { heros, isExec });
                        if (changedEl) summon.element = changedEl;
                        smncmds.push(...cmds);
                        switchHeroDiceCnt = smnDiceCnt;
                    }
                    continue;
                }
                if (summonres.cmds) {
                    smncmds.push(...summonres.cmds);
                    this._doCmds(pidx, summonres.cmds, { heros, isExec });
                }
                let intvl = 1000;
                if (isExec) {
                    if (!isExecTask) {
                        const args = clone(Array.from(arguments));
                        args[2] = {
                            ...(clone(args[2]) ?? {}),
                            isExecTask: true,
                            tsummon: [summon],
                        };
                        this.taskQueue.addTask(`summon-${summon.name}(${summon.entityId}):${state}`, args, isUnshift);
                    } else {
                        const summonHandle1 = async () => {
                            let { heros: aHeros, summons: aSummons, combatStatus } = this.players[pidx];
                            let { heros: eHeros, hidx: eFrontIdx, combatStatus: eCombatStatus } = this.players[pidx ^ 1];
                            const smn = getObjById(aSummons, summon.id)!;
                            const oCnt = smn.useCnt;
                            const smnexecres = summonres.exec?.({
                                summon: smn,
                                heros: aHeros,
                                eheros: eHeros,
                                combatStatus,
                                eCombatStatus,
                            });
                            this._writeLog(`[${player.name}]${state}:${smn.name}${oCnt != -1 ? `.useCnt:${oCnt}->${smn.useCnt}` : ''}`, 'system');
                            if (smnexecres?.cmds) {
                                const damages = (isOppo: boolean = true, cnt?: number, element?: DamageType, hidxs?: number[]) => {
                                    const dmgElement = element ?? smn.element;
                                    return {
                                        dmgElement,
                                        willDamages: new Array((isOppo ? eHeros : aHeros).length).fill(0).map((_, i) => [
                                            (hidxs ?? [eFrontIdx]).includes(i) && dmgElement != DAMAGE_TYPE.Pierce ? (cnt ?? smn.damage ?? -1) : -1,
                                            (hidxs ?? getBackHidxs(eHeros)).includes(i) ? element == DAMAGE_TYPE.Pierce ? (cnt ?? 0) : smn.pdmg : 0,
                                        ]),
                                    }
                                }
                                const { changedEl, ndices, atkedIdx: [tarHidx] = [-1], willDamages = [], willHeals: [willHeals] = [], dmgElements = [], elTips = [] }
                                    = this._doCmds(pidx, smnexecres.cmds, {
                                        heal: isCdt(smn.shieldOrHeal > 0, smn.shieldOrHeal),
                                        damages,
                                        isSummon: smn.id,
                                    });
                                if (changedEl) smn.element = changedEl;
                                if (ndices) this.players[pidx].dice = ndices;
                                const selected = [pidx, getObjIdxById(aSummons, smn.id)];
                                this._doDamage(pidx, {
                                    dmgSource: 'summon',
                                    atkPidx: pidx,
                                    atkHidx: -1,
                                    tarHidx,
                                    willDamages,
                                    willHeals,
                                    dmgElements,
                                    elTips,
                                    selected,
                                }, { atkname: smn.name, summonSelect: isCdt(willDamages.length == 0 && (willHeals?.length ?? 0) == 0, selected) });
                                await delay(2200);
                                const osmnCnt = aSummons.length;
                                assgin(aSummons, this._updateSummon(pidx, [], aSummons, this.players[pidx], true, { trigger: state, destroy: true }));
                                if (osmnCnt != aSummons.length) {
                                    this.emit(`_doSummon-${smn.name}-updateCnt:${state}`, pidx);
                                }
                                const tround = summonres.tround ?? 0;
                                if (tround > 0) {
                                    const args = clone(Array.from(arguments));
                                    args[2] = clone(args[2]) ?? {};
                                    args[2].tsummon = [smn];
                                    args[2].tround = tround;
                                    this.taskQueue.addTask(`summon-${smn.name}(${smn.entityId}):${state}`, args, true);
                                }
                            }
                        };
                        task.push([summonHandle1, intvl]);
                    }
                }
            }
        }
        const { willHeals } = this._doCmds(pidx, smncmds, { isExec: false });
        return { smncmds, addDmg, addDiceHero, switchHeroDiceCnt, willHeals, isQuickAction, csummon, task, smnres }
    }
    /**
     * 支援物效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param options switchHeroDiceCnt 切换需要的骰子, hcard 使用的牌, players 最新的玩家信息, skid 使用的技能id
     *                hidx 将要切换的玩家, minusDiceSkill 用技能减骰子, isExecTask 是否执行任务队列, isExec 是否执行, firstPlayer 先手玩家pidx,
     *                getdmg 受伤量, heal 回血量, getcard 本次摸牌数, discard 本次舍弃牌数, minusDiceSkill 技能当前被x减费后留存的骰子数
     * @returns isQuickAction 是否快速行动, cmds 命令集, exchangeSupport 交换的支援牌, outStatus 出战状态, minusDiceHero 减少切换角色骰子, supportCnt 支援区数量,
     *          minusDiceCard 减少使用卡骰子, minusDiceSkill 用技能减骰子
     */
    private _detectSupport(pidx: number, ostates: Trigger | Trigger[],
        options: {
            switchHeroDiceCnt?: number, hcard?: Card, players?: Player[], firstPlayer?: number, minusDiceSkill?: number[][],
            isExec?: boolean, isQuickAction?: boolean, minusDiceCard?: number, csupport?: Support[], hidx?: number, skid?: number,
            minusDiceSkillIds?: number[], isExecTask?: boolean, getdmg?: number[], heal?: number[], discard?: number,
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostates == 'string') states.push(ostates);
        else states.push(...ostates);
        const { hcard, players = this.players, isExec = true, firstPlayer = -1, hidx = -1, skid = -1,
            isExecTask = false, csupport, getdmg, heal, discard = 0, minusDiceSkillIds = [], minusDiceSkill = [] } = options;
        let { switchHeroDiceCnt = 0, isQuickAction = false, minusDiceCard = 0 } = options;
        const exchangeSupport: [Support, number][] = [];
        const cmds: Cmds[] = [];
        let minusDiceHero = 0;
        const supportCnt = players.map(() => new Array<number>(MAX_SUPPORT_COUNT).fill(0));
        const task: [() => void | Promise<void>, number?][] = [];
        const player = players[pidx];
        const imdices = [...players[pidx].dice];
        const destroys: number[] = [];
        const exeSupport = csupport ?? player.supports;
        const lastSupport: Support[] = [];
        const willSummons: Summon[][] = players.map(() => []);
        let isLast = false;
        const detectSupport = (support: Support, stidx: number) => {
            for (const state of states) {
                const supportres = support.handle(support, {
                    dices: imdices,
                    trigger: state,
                    heros: player.heros,
                    eheros: players[pidx ^ 1].heros,
                    eCombatStatus: players[pidx ^ 1].combatStatus,
                    hidxs: [player.hidx],
                    hidx,
                    card: hcard,
                    hcards: players[pidx].handCards.concat(players[pidx].UI.willGetCard),
                    isFirst: firstPlayer == pidx,
                    playerInfo: player.playerInfo,
                    minusDiceCard,
                    skid,
                    isMinusDiceTalent: hcard && hcard.hasSubtype(CARD_SUBTYPE.Talent) && hcard.userType == player.heros[hidx]?.id && hcard.cost + hcard.anydice > minusDiceCard,
                    isMinusDiceSkill: minusDiceSkillIds.includes(support.entityId),
                    minusDiceSkill,
                    getdmg,
                    heal,
                    discard,
                    epile: players[pidx ^ 1].pile,
                });
                if (supportres.isLast && !isLast) lastSupport.push(support);
                if (this._hasNotTriggered(supportres.trigger, state) || (supportres.isLast && !isLast)) continue;
                isQuickAction ||= supportres.isQuickAction ?? false;
                minusDiceHero += supportres.minusDiceHero ?? 0;
                minusDiceCard += supportres.minusDiceCard ?? 0;
                const isExchange = !!supportres.isExchange && (players[pidx ^ 1].supports.length + exchangeSupport.filter(v => v[1] == (pidx ^ 1)).length) < 4;
                if (isExchange) exchangeSupport.push([support, pidx ^ 1]);
                supportCnt[pidx][stidx] += supportres.supportCnt ?? 0;
                if (isExec) {
                    if (supportres.isNotAddTask) {
                        const supportexecres = supportres.exec?.({ isQuickAction, switchHeroDiceCnt });
                        switchHeroDiceCnt = supportexecres?.switchHeroDiceCnt ?? 0;
                        cmds.push(...(supportexecres?.cmds ?? []));
                        if (supportexecres?.isDestroy && (!supportres.isExchange || isExchange)) destroys.push(stidx);
                    } else {
                        if (!isExecTask) {
                            const args = clone(Array.from(arguments));
                            args[2] = {
                                ...(clone(args[2]) ?? {}),
                                isExecTask: true,
                                csupport: [support]
                            };
                            this.taskQueue.addTask(`support-${support.card.name}(${support.entityId}):${state}`, args);
                        } else {
                            let curIntvl = 800;
                            const supportHandle = async () => {
                                const oCnt = support.cnt;
                                const oPct = support.perCnt;
                                const supportexecres = supportres.exec?.({ isQuickAction, switchHeroDiceCnt }) ?? { isDestroy: false };
                                this._writeLog(`[${player.name}]${state}:${support.card.name}-${support.entityId}.cnt:${oCnt}->${support.cnt}.perCnt:${oPct}->${support.perCnt}`, 'system');
                                if (supportexecres.cmds) {
                                    if (supportexecres.cmds.some(({ cmd }) => cmd == 'getCard')) curIntvl = 2000;
                                    if (supportexecres.cmds.some(({ cmd }) => cmd == 'heal')) curIntvl = 1000;
                                }
                                // const { ndices, heros: nh } = this._doCmds(pidx, supportexecres.cmds, { summons: this.players[pidx].summons });
                                // const heros = nh ?? this.players[pidx].heros;
                                this.players[pidx].summons = this._updateSummon(pidx, supportres.summon ?? [], this.players[pidx].summons, this.players[pidx]);
                                // this.socket.emit('sendToServer', {
                                //     cpidx: pidx,
                                //     heros,
                                //     eheros,
                                //     summonee,
                                //     currSupport: support,
                                //     dices: ndices,
                                //     supportres: supportexecres,
                                //     step: 2,
                                //     flag: `_doSupport2-${support.card.name}${support.sid}-${pidx}`,
                                // });
                                await delay(800);
                                supportexecres.isDestroy &&= (!supportres.isExchange || isExchange);
                                if (supportexecres.isDestroy) {
                                    players[pidx].supports = players[pidx].supports.filter(s => s.entityId != support.entityId);
                                    this._doSupportDestroy(pidx);
                                }
                                // this.socket.emit('sendToServer', {
                                //     cpidx: pidx,
                                //     currSupport: support,
                                //     support: players[pidx].support,
                                //     supportres: supportexecres,
                                //     isEndAtk,
                                //     isQuickAction,
                                //     step: 4,
                                //     flag: `_doSupport4-${support.card.name}${support.sid}-${pidx}`,
                                // });
                            }
                            task.push([supportHandle, curIntvl]);
                        }
                    }
                } else if (supportres.summon) {
                    willSummons[pidx].push(...supportres.summon.map(smn => {
                        const willSmn = smn.handle(smn).willSummon ?? smn;
                        willSmn.UI.isWill = true;
                        return willSmn;
                    }));
                }
                if (supportres.isOrTrigger) break;
            }
        }
        exeSupport.forEach(detectSupport);
        isLast = true;
        lastSupport.forEach(detectSupport);
        if (isExec) player.supports = player.supports.filter((_, stidx) => !destroys.includes(stidx));
        const { willHeals } = this._doCmds(pidx, cmds, { isExec: false });
        return {
            isQuickAction, cmds, exchangeSupport, minusDiceHero, supportCnt,
            willHeals, minusDiceCard, willSummons, task
        }
    }
    /**
     * 获取骰子
     * @param pidx 玩家序号
     * @param cnt 获取骰子数量
     * @param element 获取骰子元素 数字为所有一样 数组为指定元素
     * @param pidx 获取骰子的玩家idx
     * @returns 传给服务器的dice格式
     */
    private _getDice(pidx: number, cnt: number, element: DiceCostType | DiceCostType[]) {
        const ndices = [...this.players[pidx].dice];
        const newDice: DiceCostType[] = [];
        for (let i = 0; i < cnt; ++i) {
            if (Array.isArray(element)) newDice.push(element[i]);
            else newDice.push(element);
        }
        ndices.push(...newDice);
        ndices.splice(MAX_DICE_COUNT, MAX_DICE_COUNT);
        this.players[pidx].dice = [...ndices];
        return this._rollDice(pidx);
    }
    /**
     * 执行命令集
     * @param pidx 执行命令玩家序号
     * @param cmds 命令集
     * @param options withCard 是否使用卡, hidxs 角色索引组, heal 回血量, isExec 是否执行, heros 角色组, eheros 敌方角色组, diceSelect 骰子选择,
     *                ahidx 攻击角色序号, ehidx 受击角色序号, isAction 是否为战斗行动, source 触发来源的id, getdmg 受到的伤害
     *                heroIdx 选择的角色序号, trigger 触发命令的时机
     * @returns ndices 骰子, phase 阶段, heros 角色组, eheros 敌方角色组, heroStatus 获得角色状态, willHeals 回血组, changedEl 变化元素
     */
    _doCmds(pidx: number, cmds?: Cmds[],
        options: {
            players?: Player[], withCard?: Card, hidxs?: number[], heal?: number, isAction?: boolean, source?: number,
            isExec?: boolean, heros?: Hero[], eheros?: Hero[], ahidx?: number, ehidx?: number, heroIdx?: number, trigger?: Trigger,
            diceSelect?: boolean[], socket?: Socket, isSummon?: number, getdmg?: number[],
            damages?: (isOppo?: boolean, cnt?: number, element?: DamageType, hidxs?: number[]) => { dmgElement: DamageType, willDamages: number[][] },
        } = {}
    ): {
        cmds?: Cmds[], ndices?: DiceCostType[], phase?: Phase, heros?: Hero[], eheros?: Hero[], willHeals?: number[][],
        changedEl?: ElementType, isSwitch?: number, isSwitchOppo?: number, discards?: Card[], willSwitch?: boolean[][],
        supportCnt?: number[][], elTips?: [string, PureElementType, PureElementType][], willAttachs?: PureElementType[][],
        willDamages?: number[][], dmgElements?: DamageType[], atkedIdx?: number[], attackPreview?: Preview,
    } {
        const { players = this.players } = options;
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const { withCard, hidxs: chidxs, heal = 0, isExec = true, ahidx = player.hidx, ehidx = opponent.hidx,
            heros: ocheros, eheros: oceheros, isAction = false, source = -1, diceSelect = [], damages, socket,
            heroIdx = -1, isSummon = -1, trigger = '', getdmg = [] } = options;
        const cheros = ocheros ?? player.heros;
        const ceheros = oceheros ?? opponent.heros;
        let ndices: DiceCostType[] | undefined;
        if (cmds == undefined || cmds.length == 0) return {}
        let isSwitch: number = heroIdx;
        let isSwitchOppo: number = -1;
        let phase: Phase | undefined;
        let heroStatus: Status[][] | undefined;
        let combatStatus: Status[] | undefined;
        let heroStatusOppo: Status[][] | undefined;
        let combatStatusOppo: Status[] | undefined;
        let willHeals: number[][] = [];
        let changedEl: ElementType | undefined;
        let discards: Card[] | undefined;
        let attackPreview: Preview | undefined;
        const willSwitch: boolean[][] = players.map(p => new Array(p.heros.length).fill(false));
        const supportCnt: number[][] = players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        let elTips: [string, PureElementType, PureElementType][] | undefined;
        let willDamages: number[][] | undefined;
        let dmgElements: DamageType[] | undefined;
        let willAttachs: PureElementType[][] | undefined;
        let atkedIdx: number[] = [];
        const willHeals0: [number, number[]] = [0, new Array(cheros.length + ceheros.length).fill(-1)];
        for (let i = 0; i < cmds.length; ++i) {
            const { cmd = '', cnt = 0, element, isReadySkill = false, status: getsts = [],
                card, isOppo, isAttach = false, mode = 0 } = cmds[i];
            let { hidxs, subtype = [], cardTag = [] } = cmds[i];
            if (!hidxs && chidxs) hidxs = [...chidxs];
            if (cmd == 'useSkill') {
                setTimeout(async () => {
                    await wait(() => this.taskQueue.isTaskEmpty() && !this.taskQueue.isExecuting);
                    this._useSkill(pidx, cnt, { isPreview: !isExec, withCard, isSwitch, isReadySkill });
                }, 20);
            } else if (cmd.startsWith('switch-')) {
                const switchOppo = isOppo ?? false;
                if (isSwitch == -1) isSwitch = hidxs?.[0] ?? -1;
                let nhidx = -1;
                let sdir = 0;
                if (cmd == 'switch-before') sdir = -1;
                else if (cmd == 'switch-after') sdir = 1;
                const cpidx = pidx ^ +switchOppo;
                const heros = switchOppo ? ceheros : cheros;
                if (sdir == 0) {
                    nhidx = getNearestHidx(hidxs?.[0] ?? -1, heros);
                } else {
                    nhidx = this._getFrontHero(cpidx, { offset: sdir }).hidx;
                }
                if (!isExec) {
                    willSwitch[cpidx][nhidx] = true;
                    if (switchOppo) {
                        isSwitchOppo = nhidx;
                    } else if (isSwitch == -1) {
                        isSwitch = nhidx;
                    }
                    if (!cmds.some(({ cmd }) => cmd == 'useSkill')) {
                        this._useSkill(pidx, -1, { isPreview: true, isSwitch, otriggers: ['change-from', 'change-to'] });
                    }
                } else if (nhidx > -1 && !hasObjById(heros.find(h => h.isFront)?.heroStatus, 300005)) {
                    cmds[i].hidxs = [nhidx];
                    setTimeout(() => this._switchHero(cpidx, nhidx, 'doCmd--switch', { socket, notChangeTurn: true, trigger }), cnt);
                }
            } else if (['getCard', 'addCard'].includes(cmd)) {
                if (!Array.isArray(subtype)) subtype = [subtype];
                if (!Array.isArray(cardTag)) cardTag = [cardTag];
                let cards: Card[] = [];
                if (card) {
                    cards = (Array.isArray(card) ? card : Array.from({ length: cnt }, () => clone(card)))
                        .map(c => typeof c == 'number' ? this.newCard(c) : c);
                }
                const cpidx = pidx ^ +(isOppo ?? false);
                const cplayer = players[cpidx];
                if (cmd == 'getCard') {
                    const exclude = cmds[i].hidxs ?? [];
                    let restCnt = cnt;
                    while (restCnt-- > 0) {
                        let wcard: Card | null = null;
                        if (cards[restCnt]) { // 摸指定卡
                            if (isAttach) { // 从牌库摸
                                const cid = cards[restCnt].id;
                                const cardIdx = cplayer.pile.findIndex(c => c.id == cid);
                                if (cardIdx > -1 && isExec) [wcard] = cplayer.pile.splice(cardIdx, 1);
                            } else { // 直接生成
                                wcard = cards[restCnt];
                            }
                        } else if (subtype.length == 0 && cardTag.length == 0) {
                            if (exclude.length > 0) { // 在指定的某几张牌中随机模
                                wcard = this.newCard(this._randomInArr(exclude));
                            } else if (isExec) { // 从牌库直接摸牌
                                wcard = cplayer.pile.shift() ?? null;
                            }
                        } else { // 指定副类型
                            if (isAttach) {
                                if (cplayer.pile.every(c => !c.hasSubtype(...(subtype as CardSubtype[])) || !c.hasTag(...(cardTag as CardTag[])))) {
                                    break;
                                }
                                while (wcard == null) {
                                    const cardIdx = cplayer.pile.findIndex(c => (c.hasSubtype(...(subtype as CardSubtype[])) || c.hasTag(...(cardTag as CardTag[]))) && !exclude.includes(c.id));
                                    if (cardIdx > -1) {
                                        if (!isExec) break;
                                        [wcard] = cplayer.pile.splice(cardIdx, 1);
                                    }
                                }
                            } else {
                                const cardsPool = cardsTotal(this.version).filter(c => (c.hasSubtype(...(subtype as CardSubtype[])) || c.hasTag(...(cardTag as CardTag[]))) && !exclude.includes(c.id));
                                wcard = this._randomInArr(cardsPool);
                            }
                        }
                        if (wcard && wcard.id != 0 && isExec) {
                            cplayer.UI.willGetCard.push(wcard.setEntityId(this._genEntityId()));
                        }
                    }
                    for (let i = 0; i < cnt - restCnt; ++i) {
                        this._detectStatus(cpidx, STATUS_TYPE.Usage, 'getcard', { isExec, isQuickAction: isCdt(!isAction, 2) });
                        const { supportCnt: sptCnt } = this._detectSupport(cpidx ^ 1, 'getcard-oppo', { isExec, isQuickAction: !isAction });
                        supportCnt.forEach((spt, spti) => spt.forEach((_, i, a) => a[i] += sptCnt[spti][i]));
                    }
                }
                if (cmd == 'addCard' && isExec) {
                    cplayer.UI.willAddCard.cards.push(...cards);
                    cplayer.UI.willAddCard.scope = hidxs?.[0] ?? 0;
                    cplayer.UI.willAddCard.isRandom = !isAttach;
                    cplayer.UI.willAddCard.isNotPublic = mode == CMD_MODE.isNotPublic;
                }
            } else if (cmd == 'discard') {
                if (discards == undefined) discards = [];
                let discardCnt = Math.max(1, cnt);
                const unselectedCards = player.handCards.filter(c => c.entityId != withCard?.entityId);
                const discardIdxs = cmds[i].hidxs ?? [];
                if (discardIdxs.length > 0) {
                    discards.push(...clone(unselectedCards.filter((_, ci) => discardIdxs.includes(ci))));
                } else {
                    if (typeof card == 'number') {
                        const targetCard = unselectedCards.find(c => c.id == card);
                        discardCnt = Math.min(discardCnt, unselectedCards.filter(c => c.id == card).length);
                        if (unselectedCards.length > 0 && targetCard) {
                            let curIdx = -1;
                            while (discardCnt-- > 0) {
                                discards.push(clone(targetCard));
                                curIdx = unselectedCards.findIndex((c, ci) => ci > curIdx && c.id == targetCard.id);
                                discardIdxs.push(curIdx);
                            }
                        }
                    } else {
                        if (mode == CMD_MODE.AllHandCards) { // 弃置所有手牌
                            discards.push(...clone(unselectedCards));
                            discardIdxs.push(...new Array(unselectedCards.length).fill(0).map((_, ci) => ci));
                        } else {
                            const hcardsSorted = unselectedCards.slice().sort((a, b) => ((b.cost + b.anydice) - (a.cost + a.anydice)) || (this._randomInt() - 0.5));
                            const targetCnt = discardCnt;
                            while (discardCnt > 0) {
                                if (mode == CMD_MODE.Random) { // 弃置随机手牌
                                    const didx = this._randomInArr(unselectedCards).cidx;
                                    unselectedCards.splice(didx, 1);
                                    discardIdxs.push(didx);
                                } else if (mode == CMD_MODE.HighHandCard) { // 弃置花费最高的手牌 
                                    if (hcardsSorted.length == 0) break;
                                    const maxCost = hcardsSorted[0].cost + hcardsSorted[0].anydice;
                                    const didx = this._randomInArr(unselectedCards.filter(c => c.cost + c.anydice == maxCost)).cidx;
                                    const [discard] = unselectedCards.splice(didx, 1);
                                    discardIdxs.push(didx);
                                    hcardsSorted.splice(hcardsSorted.findIndex(c => c.cidx == didx), 1);
                                    discards.push(clone(discard));
                                } else if (mode == CMD_MODE.TopPileCard) { // 弃置牌堆顶的牌 
                                    if (player.pile.length == 0) break;
                                    discards.push(clone(player.pile[0]));
                                    discardIdxs.push(targetCnt - discardCnt);
                                } else if (mode == CMD_MODE.RandomPileCard) { // 弃置牌库中随机一张牌
                                    if (player.pile.length == 0) break;
                                    const disIdx = this._randomInt(player.pile.length - 1);
                                    discards.push(clone(player.pile[disIdx]));
                                    discardIdxs.push(disIdx);
                                }
                                --discardCnt;
                            }
                        }
                    }
                    hidxs = [...discardIdxs];
                    cmds[i].hidxs = [...discardIdxs];
                }
                player.playerInfo.discardCnt += discards.length;
                player.playerInfo.discardIds.push(...discards.map(c => c.id));
                const { cmds: discmds, willHeals: disheal } = this._doDiscard(pidx, discards, { players, isAction, isExec });
                cmds.push(...discmds);
                if (disheal) {
                    if (willHeals[0] == undefined) willHeals.push(disheal);
                    else mergeWillHeals(willHeals[0], disheal);
                }
                if (mode == CMD_MODE.AllHandCards || mode == CMD_MODE.HighHandCard || card) { // 舍弃手牌
                    if (isExec) discardIdxs.forEach(dcidx => player.UI.willDiscard[0].push(player.handCards[dcidx]));
                    assgin(player.handCards, player.handCards.filter((_, dcidx) => !discardIdxs.includes(dcidx)));
                } else { // 舍弃牌库中的牌
                    if (isExec) player.UI.willDiscard[1].push(...player.pile.filter((_, dcidx) => discardIdxs.includes(dcidx)));
                    player.pile = player.pile.filter((_, dcidx) => !discardIdxs.includes(dcidx));
                }
            } else if (cmd == 'getDice' && isExec) {
                let elements: DiceCostType[] = [];
                for (let j = 0; j < cnt; ++j) {
                    if (mode == CMD_MODE.Random) { // 随机不重复
                        elements.push(this._randomInArr(Object.values(PURE_ELEMENT_TYPE).filter(el => !elements.includes(el))));
                    } else if (mode == CMD_MODE.FrontHero) { // 当前出战角色(或者前后,用hidxs[0]控制)
                        elements.push(this._getFrontHero(pidx, { offset: cmds[i].hidxs?.[0] ?? 0 }).element as PureElementType);
                    }
                }
                ndices = this._getDice(pidx, cnt, (element as DiceCostType | undefined) ?? elements);
                player.dice = [...ndices];
                for (let i = 0; i < cnt; ++i) {
                    this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'getdice-oppo', { isOnlyCombatStatus: true, isQuickAction: isAction ? 0 : 2, source, isExec });
                }
            } else if (cmd == 'getEnergy' && isExec) {
                ((isOppo ? ceheros : cheros) as Hero[]).forEach((h, hi) => {
                    if (h.hp > 0 && (hidxs == undefined && h.isFront || hidxs?.includes(hi))) {
                        if ((cnt > 0 && h.energy < h.maxEnergy) || (cnt < 0 && h.energy > 0)) {
                            this._writeLog(`[${player.name}][${h.name}]${cnt > 0 ? '获得' : '失去'}${Math.abs(cnt)}点充能`, 'system');
                            h.energy += cnt;
                        }
                    }
                });
            } else if (cmd == 'reroll' && (ndices?.length ?? 0) > 0 && isExec) {
                phase = PHASE.DICE;
                player.rollCnt = cnt;
                player.UI.showRerollBtn = true;
            } else if (cmd == 'changeDice' && isExec) {
                ndices = this._rollDice(pidx, diceSelect);
                player.dice = [...ndices];
            } else if (cmd == 'changeCard' && isExec) {
                phase = PHASE.CHANGE_CARD;
            } else if (cmd == 'getStatus' && isExec) {
                if (isOppo) {
                    getsts.forEach(sts => {
                        if (sts.group == STATUS_GROUP.heroStatus) {
                            if (!heroStatusOppo) heroStatusOppo = new Array(ceheros.length).fill(0).map(() => []);
                            (cmds[i]?.hidxs ?? [ehidx]).forEach(fhidx => heroStatusOppo?.[fhidx].push(sts));
                        } else {
                            if (!combatStatusOppo) combatStatusOppo = [];
                            combatStatusOppo.push(sts);
                        }
                    });
                } else {
                    getsts.forEach(sts => {
                        if (sts.group == STATUS_GROUP.heroStatus) {
                            if (!heroStatus) heroStatus = new Array(cheros.length).fill(0).map(() => []);
                            (cmds[i]?.hidxs ?? [ahidx]).forEach(fhidx => heroStatus?.[fhidx].push(sts));
                        } else {
                            if (!combatStatus) combatStatus = [];
                            combatStatus.push(sts);
                        }
                    })
                }
            } else if (['heal', 'revive'].includes(cmd)) {
                if (mode != willHeals0[0]) {
                    willHeals.push(willHeals0[1].slice());
                    willHeals0[0] = mode;
                    willHeals0[1] = new Array(cheros.length + ceheros.length).fill(-1);
                }
                const willHeals1 = new Array(cheros.length).fill(0).map((_, hi) =>
                    (hidxs ?? [player.hidx]).includes(hi) ? Math.min(cheros[hi].maxHp - cheros[hi].hp + (!isExec ? Math.max(0, (getdmg[hi] ?? -1)) : 0), (cnt || heal) - (cmd == 'revive' ? 0.3 : 0)) : -1
                );
                this._detectHeal(pidx, willHeals1, cheros, { isExec, isQuickAction: !isAction });
                willHeals1.forEach((hl, hli) => {
                    if (hl > -1) {
                        const hlidx = hli + player.pidx * ceheros.length;
                        if (willHeals0[1][hlidx] == -1) willHeals0[1][hlidx] = 0;
                        willHeals0[1][hlidx] += hl;
                    }
                });
                if (cnt == 0) cmds[i].cnt = heal;
                if (isExec) {
                    if (cmd == 'revive') this._detectSkill(pidx, 'revive', { hidxs });
                }
            } else if (cmd == 'changeElement') {
                changedEl = element as ElementType;
            } else if (cmd == 'changePattern') {
                if (hidxs == undefined) throw new Error('hidxs is undefined');
                const newPattern = this.newHero(cnt);
                const { entityId, heroStatus: chsts, hp, isFront, hidx, attachElement, talentSlot, artifactSlot, weaponSlot, energy } = clone(cheros[hidxs[0]]);
                assgin(cheros[hidxs[0]], newPattern);
                cheros[hidxs[0]].entityId = entityId;
                assgin(cheros[hidxs[0]].heroStatus, chsts);
                cheros[hidxs[0]].hp = hp;
                cheros[hidxs[0]].isFront = isFront;
                cheros[hidxs[0]].hidx = hidx;
                assgin(cheros[hidxs[0]].attachElement, attachElement);
                cheros[hidxs[0]].talentSlot = talentSlot;
                cheros[hidxs[0]].artifactSlot = artifactSlot;
                cheros[hidxs[0]].weaponSlot = weaponSlot;
                cheros[hidxs[0]].energy = energy;
            } else if (cmd == 'getSkill' && isExec) {
                if (hidxs == undefined) throw new Error('@_doCmds-getSkill: hidxs is undefined');
                cheros[hidxs[0]].skills.splice(mode, 0, this.newSkill(cnt));
            } else if (cmd == 'loseSkill' && isExec) {
                if (hidxs == undefined) throw new Error('@_doCmds-loseSkill: hidxs is undefined');
                cheros[hidxs[0]].skills.splice(mode, 1);
            } else if (cmd == 'attach') {
                const isFront = mode == CMD_MODE.FrontHero || mode == 0;
                if (!willAttachs) willAttachs = new Array(player.heros.length + opponent.heros.length).fill(0).map(() => []);
                (hidxs ?? [player.hidx]).forEach((hidx, hi) => {
                    const { players: players1, elTips: elTips1, willAttachs: willAttachs1 }
                        = this._calcDamage(
                            pidx,
                            Array.isArray(element) ? element[hi] as ElementType : (element as ElementType | undefined ?? (isFront ? this._getFrontHero(pidx).element : DAMAGE_TYPE.Physical)),
                            [],
                            hidx,
                            players,
                            { isAttach: true },
                        );
                    for (let i = 0; i < players[pidx].heros.length; ++i) {
                        const attachEl = willAttachs1[i];
                        if (attachEl == undefined) continue;
                        willAttachs![i + pidx * players[pidx ^ 1].heros.length].push(attachEl);
                    }
                    assgin(players, players1);
                    elTips = [...elTips1];
                });
            } else if (cmd == 'attack') {
                const atkElMode = mode || CMD_MODE.FrontHero;
                const atkOppo = isOppo ?? true;
                const epidx = pidx ^ +atkOppo;
                if (!willDamages) willDamages = new Array(player.heros.length + opponent.heros.length).fill(0).map(() => [-1, 0]);
                if (!dmgElements) dmgElements = new Array(players.flatMap(p => p.heros).length).fill(DAMAGE_TYPE.Physical);
                const dmgcnt = cmds[i].cnt;
                const defaultCnt = dmgcnt ?? -1;
                (hidxs ?? [(atkOppo ? opponent : player).hidx]).forEach((hidx, hi) => {
                    atkedIdx.push(hidx);
                    const {
                        willDamages: wdmgs = new Array(players[epidx].heros.length).fill(0).map((_, i) => i == hidx ? [
                            defaultCnt >= 0 && element != DAMAGE_TYPE.Pierce ? defaultCnt : -1,
                            element == DAMAGE_TYPE.Pierce ? defaultCnt : 0] : [-1, 0]),
                        dmgElement: dmgel = (Array.isArray(element) ?
                            element[hi] : element ?? (atkElMode == CMD_MODE.FrontHero ?
                                this._getFrontHero(pidx, { players, offset: cmds[i].hidxs?.[0] }).element :
                                DAMAGE_TYPE.Physical)) as ElementType,
                    } = damages?.(atkOppo, dmgcnt, element as DamageType | undefined, hidxs) ?? {};
                    if (!isExec && dmgel != DAMAGE_TYPE.Pierce) {
                        [attackPreview] = this._previewSkill(pidx, -2, { withCard, willDamages: wdmgs, dmgElement: dmgel });
                    }
                    const { willDamages: willDamage1, elTips: elTips1, dmgElements: dmgElements1, players: players1, willHeal: willHeal1 }
                        = this._useSkill(pidx, -2, { isPreview: !isExec, isSummon, willDamages: wdmgs, dmgElement: dmgel });
                    willDamages!.forEach((wdmg, wdci) => {
                        const [nwdmg, nwpdmg] = willDamage1[wdci];
                        if (nwdmg > -1) wdmg[0] = Math.max(0, wdmg[0]) + nwdmg;
                        wdmg[1] += nwpdmg;
                    });
                    dmgElements1.forEach((de, dei) => {
                        if (de != DAMAGE_TYPE.Physical && de != DAMAGE_TYPE.Pierce) dmgElements![dei] = de;
                    });
                    willHeal1.forEach((hl, hli) => {
                        if (hl > -1) {
                            const hlidx = hli + player.pidx * ceheros.length;
                            if (willHeals0[1][hlidx] == -1) willHeals0[1][hlidx] = 0;
                            willHeals0[1][hlidx] += hl;
                        }
                    });
                    assgin(players, players1);
                    elTips = [...elTips1];
                });
            }
        }
        if (willHeals0[1].some(v => v != -1)) willHeals.push(willHeals0[1].slice());
        for (let fhidx = 0; fhidx < cheros.length; ++fhidx) {
            const fhero = cheros[fhidx];
            if (heroStatus && heroStatus[fhidx].length) {
                if (hasObjById(fhero.heroStatus, 300005)) heroStatus[fhidx] = heroStatus[fhidx].filter(sts => !sts.hasType(STATUS_TYPE.NonAction));
                assgin(fhero.heroStatus, this._updateStatus(pidx, heroStatus[fhidx], fhero.heroStatus, true, cheros, player.combatStatus, fhidx));
            }
        }
        if (combatStatus) assgin(player.combatStatus, this._updateStatus(pidx, combatStatus, player.combatStatus, true, cheros, player.combatStatus, ahidx));
        for (let fhidx = 0; fhidx < ceheros.length; ++fhidx) {
            const fhero = ceheros[fhidx];
            if (heroStatusOppo && heroStatusOppo[fhidx].length) {
                if (hasObjById(fhero.heroStatus, 300005)) heroStatusOppo[fhidx] = heroStatusOppo[fhidx].filter(sts => !sts.hasType(STATUS_TYPE.NonAction));
                assgin(fhero.heroStatus, this._updateStatus(pidx ^ 1, heroStatusOppo[fhidx], fhero.heroStatus, true, ceheros, opponent.combatStatus, fhidx));
            }
        }
        if (combatStatusOppo) assgin(opponent.combatStatus, this._updateStatus(pidx ^ 1, combatStatusOppo, opponent.combatStatus, true, ceheros, opponent.combatStatus, ehidx));
        return {
            cmds, ndices, phase, heros: cheros, eheros: ceheros, willHeals, changedEl, isSwitch, isSwitchOppo, discards,
            willSwitch, supportCnt, elTips, willAttachs, dmgElements, atkedIdx, willDamages, attackPreview,
        }
    }
    /**
     * 预览技能效果
     * @param pidx 玩家序号
     * @param skid 技能id
     * @param options.withCard 卡使用技能
     * @param options.isSwitch 切换目标角色序号
     * @param options.isSummon 召唤物攻击预览
     * @param options.willDamages 卡牌/召唤物伤害
     * @param options.dmgElement 卡牌/召唤物伤害元素
     * @returns 预览结果
     */
    private _previewSkill(pidx: number, skid?: number, options: {
        withCard?: Card, isSwitch?: number, isSummon?: number, willDamages?: number[][], dmgElement?: ElementType,
    } = {}) {
        const { withCard, isSwitch = -1, isSummon = -1, willDamages, dmgElement } = options;
        const curRandom = this._random;
        const previews: Preview[] = [];
        const hero = isSwitch != -1 ? this.players[pidx].heros[isSwitch] : this._getFrontHero(pidx);
        if (!hero) return previews;
        const { skills, energy, maxEnergy, heroStatus, hidx } = hero;
        const { dice, status } = this.players[pidx];
        const skids = skid != undefined ? [skid] : skills.map(sk => sk.id);
        const isWaiting = status == PLAYER_STATUS.WAITING;
        const isNonAction = heroStatus.some(sts => sts.hasType(STATUS_TYPE.NonAction));
        for (const sid of skids) {
            this._random = curRandom;
            const players = clone(this.players);
            const skill = players[pidx].heros[hidx].skills.find(sk => sk.id == sid);
            if (skill) {
                if (skill.type == SKILL_TYPE.Passive) continue;
                const isLen = skill.cost[0].cnt + skill.cost[1].cnt - skill.costChange[0] - skill.costChange[1] > dice.length;
                const isElDice = (skill.cost[0].type != DICE_TYPE.Same ?
                    dice.filter(d => d == DICE_COST_TYPE.Omni || d == skill.cost[0].type).length :
                    dice.filter(d => d == DICE_COST_TYPE.Omni).length + Math.max(...Object.values(dice.reduce((a, c) => {
                        if (c != DICE_COST_TYPE.Omni) ++a[c];
                        return a;
                    }, {} as Record<DiceCostType, number>)))) < skill.cost[0].cnt - skill.costChange[0];
                const isEnergy = skill.cost[2].cnt > 0 && energy < maxEnergy;
                skill.isForbidden = isWaiting || this.phase > PHASE.ACTION || isNonAction || isLen || isElDice || isEnergy;
            }
            const { willHp, willAttachs, summonCnt, supportCnt, willSummons, willSwitch }
                = this._useSkill(pidx, sid, { isPreview: true, withCard, isSummon, isSwitch, willDamages, dmgElement, otriggers: isCdt(sid == -1, ['change-from', 'change-to']) });
            const preview: Preview = {
                type: ACTION_TYPE.UseSkill,
                isValid: !skill?.isForbidden,
                skillId: +sid,
                diceSelect: sid > -1 ? this._checkSkill(pidx, +sid, isSwitch).map(v => (skill?.isForbidden ?? true) ? false : v) : undefined,
                willHp,
                willAttachs,
                willSummonChange: summonCnt,
                willSupportChange: supportCnt,
                willSummons,
                willSwitch,
            }
            previews.push(preview);
            assgin(this.players, players)
            this._random = curRandom;
        }
        return previews;
    }
    /**
     * 预览使用卡牌效果
     * @param pidx 玩家序号
     * @returns 预览结果
     */
    private _previewCard(pidx: number, players: Player[]) {
        const curRandom = this._random;
        const { handCards } = this.players[pidx];
        const previews: Preview[] = [];
        for (const cidx in handCards) {
            const { canSelectHero, canSelectSummon, canSelectSupport, type } = handCards[cidx];
            // todo 这里要考虑可选择的人数和能选择的人/支援物的所有情况
            const player = this.players[pidx];
            const { isValid: diceValid, diceSelect, skillId = -1, switchIdx, heroCanSelect = [], supportCnt, attackPreview }
                = this._checkCard(pidx, players, +cidx);
            const heroSelects: number[][] = [[]];
            const heroCanSelects: boolean[][] = [];
            if (canSelectHero > 0) {
                const heroIdxs = heroCanSelect.map((v, i) => ({ v, i })).filter(v => v.v).map(v => v.i);
                for (const hidxi of heroIdxs) {
                    heroSelects.push([hidxi]);
                    if (canSelectHero == 2) {
                        const { canSelectHero: csh } = player.handCards[cidx].handle(player.handCards[cidx], { selectHeros: [hidxi] });
                        if (!csh) continue;
                        heroCanSelects[hidxi] = csh;
                        for (const hidxj of csh.map((v, i) => ({ v, i })).filter(v => v.v).map(v => v.i)) {
                            heroSelects.push([hidxi, hidxj]);
                        }
                    }
                }
            }
            for (const heroSelect of heroSelects) {
                const players = clone(this.players);
                this._random = curRandom;
                let isValid = diceValid && canSelectHero == heroSelect.length && canSelectSummon == -1 && canSelectSupport == -1;
                const supportCanSelect: boolean[][] = players.map(() => new Array(MAX_SUPPORT_COUNT).fill(false));
                const summonCanSelect: boolean[][] = players.map(() => new Array(MAX_SUMMON_COUNT).fill(false));
                if (type == CARD_TYPE.Support) {
                    const isAvalible = player.supports.length < MAX_SUPPORT_COUNT;
                    isValid &&= isAvalible;
                    if (diceValid && !isAvalible) supportCanSelect[1].fill(true);
                }
                if (canSelectSummon != -1) summonCanSelect[canSelectSummon].fill(true);
                if (canSelectSupport != -1) supportCanSelect[canSelectSupport].fill(true);
                let hCanSelect = [...heroCanSelect];
                if (canSelectHero == 2 && heroSelect.length == 1) {
                    hCanSelect = heroCanSelects[heroSelect[0]];
                }
                let skillPreview: Preview | undefined;
                if (skillId > -1) [skillPreview] = this._previewSkill(pidx, skillId, { withCard: handCards[cidx], isSwitch: switchIdx });
                const preview: Preview = {
                    willSupportChange: supportCnt,
                    ...(attackPreview ?? {}),
                    ...(skillPreview ?? {}),
                    type: ACTION_TYPE.UseCard,
                    isValid,
                    diceSelect,
                    cardIdxs: [+cidx],
                    heroIdxs: heroSelect,
                    heroCanSelect: hCanSelect,
                    supportCanSelect,
                    summonCanSelect,
                }
                previews.push(preview);
                assgin(this.players, players);
                this._random = curRandom;
            }
            // 调和的预览
            const { isValid, diceSelect: recondice } = this._checkCard(pidx, players, +cidx, true);
            const preview: Preview = {
                type: ACTION_TYPE.Reconcile,
                isValid,
                cardIdxs: [+cidx],
                diceSelect: recondice,
            }
            previews.push(preview);
        }
        this._random = curRandom;
        return previews;
    }
    /**
     * 预览切换角色效果
     * @param pidx 玩家序号
     * @param switchHidx 切换角色的序号
     * @returns 预览结果
     */
    private _previewSwitch(pidx: number, switchHidx?: number) {
        const curRandom = this._random;
        const previews: Preview[] = [];
        const player = this.players[pidx];
        const hidxs = switchHidx ? [switchHidx] : getBackHidxs(player.heros);
        for (const hidx of hidxs) {
            this._random = curRandom;
            const players = clone(this.players);
            const switchHeroDiceCnt = this._calcHeroSwitchDice(pidx, hidx, player.hidx);
            let isQuickAction = false;
            isQuickAction = this._detectSkill(pidx, 'change-from', { hidxs: player.hidx, isExec: false }).isQuickAction;
            isQuickAction = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-from', { isQuickAction, hidxs: [player.hidx], isExec: false }).isQuickAction;
            isQuickAction = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-to', { isQuickAction, hidxs: [hidx], isExec: false }).isQuickAction;
            isQuickAction = this._detectSummon(pidx, 'change-from', { isQuickAction, isExec: false }).isQuickAction;
            isQuickAction = this._detectSupport(pidx, 'change', { isQuickAction, isExec: false }).isQuickAction;
            const diceSelect = player.dice.map(() => false);
            const isValid = player.dice.length >= switchHeroDiceCnt;
            if (isValid) {
                for (let i = player.dice.length - 1, cnt = switchHeroDiceCnt; i >= 0 && cnt > 0; --i, --cnt) {
                    diceSelect[i] = true;
                }
            }
            const [skillPreview] = this._previewSkill(pidx, -1, { isSwitch: hidx });
            const preview: Preview = {
                ...skillPreview,
                type: ACTION_TYPE.SwitchHero,
                heroIdxs: [hidx],
                isValid,
                diceSelect,
                switchHeroDiceCnt,
                heroCanSelect: player.heros.map(h => !h.isFront && h.hp > 0),
                isQuickAction,
            }
            previews.push(preview);
            this._random = curRandom;
            assgin(this.players, players);
        }
        return previews;
    }
    /**
     * 更新状态
     * @param pidx 玩家序号
     * @param nStatus 新状态
     * @param oStatus 原状态
     * @param isExec 是否执行加入任务队列
     * @param heros 角色数组，用于改变附魔状态
     * @param combatStatus 战斗状态数组，用于改变附魔状态
     * @param hidx 新附魔角色idx
     * @param ohidx 旧附魔角色idx
     * @returns 合并后状态
     */
    _updateStatus(pidx: number, nStatus: Status[], oStatus: Status[], isExec = false, heros?: Hero[], combatStatus?: Status[], hidx: number = -1, ohidx: number = -1) {
        const oriStatus: Status[] = clone(oStatus);
        const newStatus: Status[] = clone(nStatus);
        const updateAttachEl = (aheros: Hero[], ahidx: number, stype: StatusGroup, sts?: Status[]) => {
            const hero = aheros[ahidx];
            const [attachElSts] = [
                ...((stype == STATUS_GROUP.heroStatus && sts ? sts : hero.heroStatus).filter(s => s.hasType(STATUS_TYPE.Enchant) && (s.useCnt != 0 && s.roundCnt != 0))),
                ...((stype == STATUS_GROUP.combatStatus && sts ? sts : hero.isFront && combatStatus ? combatStatus : []).filter(s => s.hasType(STATUS_TYPE.Enchant) && (s.useCnt != 0 && s.roundCnt != 0))),
            ];
            const attachEl: ElementType = attachElSts == undefined ? DAMAGE_TYPE.Physical :
                attachElSts.handle(attachElSts, { heros: aheros, hidx: ahidx })?.attachEl ?? DAMAGE_TYPE.Physical;
            for (const skill of hero.skills) {
                if (skill.type == SKILL_TYPE.Passive || skill.dmgElement != DAMAGE_TYPE.Physical || skill.attachElement == attachEl) continue;
                skill.UI.description = skill.UI.description.replace(ELEMENT_NAME[skill.attachElement], ELEMENT_NAME[attachEl]);
                skill.attachElement = attachEl;
            }
        }
        newStatus.forEach(sts => {
            let cstIdx = getObjIdxById(oriStatus, sts.id);
            const oriSts = oriStatus[cstIdx];
            if (cstIdx > -1 && oriSts.isTalent != sts.isTalent) { // 如果状态是否带有天赋不同，则重新附属
                oriStatus.splice(cstIdx, 1);
                cstIdx = -1;
            }
            if (cstIdx > -1) { // 重复生成状态
                if (sts.maxCnt == 0) { // 不可叠加
                    oriStatus[cstIdx] = clone(sts).setEntityId(oriStatus[cstIdx].entityId);
                } else { // 可叠加
                    const cStatus = oriStatus[cstIdx];
                    cStatus.maxCnt = sts.maxCnt;
                    cStatus.perCnt = sts.perCnt;
                    if (cStatus.roundCnt > -1) {
                        cStatus.roundCnt = Math.max(-1, Math.min(cStatus.maxCnt, cStatus.roundCnt + sts.addCnt));
                    } else {
                        cStatus.roundCnt = sts.roundCnt;
                    }
                    if (cStatus.useCnt > -1) {
                        cStatus.useCnt = Math.max(-1, Math.min(cStatus.maxCnt, cStatus.useCnt + sts.addCnt));
                    } else {
                        cStatus.useCnt = sts.useCnt;
                    }
                }
            } else { // 新附属状态
                sts.setEntityId(this._genEntityId());
                sts.handle(sts, { heros, hidx, trigger: 'enter' });
                oriStatus.push(sts);
            }
            if (heros) {
                const stsres = sts.handle(sts, { heros, hidx });
                if (hidx > -1) {
                    if (sts.hasType(STATUS_TYPE.Enchant)) updateAttachEl(heros, hidx, sts.group, oriStatus);
                    if (stsres.onlyOne) {
                        heros.some((h, hi) => {
                            if (hi == hidx) return false;
                            const idx = getObjIdxById(h.heroStatus, sts.id);
                            if (idx > -1) h.heroStatus.splice(idx, 1);
                            return idx > -1;
                        });
                    }
                }
            }
        });
        const chidx = ohidx > -1 ? ohidx : hidx;
        oriStatus.forEach(sts => {
            if (sts.hasType(STATUS_TYPE.Enchant)) {
                const stsres = sts.handle(sts, { heros, hidx: chidx });
                if (stsres.isUpdateAttachEl && heros) updateAttachEl(heros, chidx, sts.group);
            }
            if (ohidx > -1 || ((sts.useCnt == 0 && !sts.hasType(STATUS_TYPE.Accumulate)) || sts.roundCnt == 0) && !sts.hasType(STATUS_TYPE.Attack, STATUS_TYPE.TempNonDestroy)) {
                if (sts.hasType(STATUS_TYPE.Enchant) && heros) updateAttachEl(heros, chidx, sts.group);
            }
        });
        return oriStatus.sort((a, b) => Math.sign(a.summonId) - Math.sign(b.summonId))
            .filter(sts => {
                const isNotDestroy = ((sts.useCnt != 0 || sts.hasType(STATUS_TYPE.Accumulate)) && sts.roundCnt != 0) || sts.hasType(STATUS_TYPE.TempNonDestroy);
                if (isExec && !isNotDestroy) this._doStatusDestroy(pidx, sts, hidx);
                return isNotDestroy || (sts.hasType(STATUS_TYPE.Attack, STATUS_TYPE.NonDefeat) && sts.roundCnt != 0);
            });
    }
    /**
     * 更新召唤物
     * @param pidx 玩家序号
     * @param nSummon 新召唤物
     * @param oSummon 原召唤物
     * @param player 玩家数组
     * @param options isSummon 是否是召唤物生成的新召唤物, trigger 触发时机, destroy 是否销毁
     * @returns 合并后召唤物
     */
    private _updateSummon(
        pidx: number, nSummon: Summon[], oSummon: Summon[], player: Player, isExec = false,
        options: { isSummon?: number, destroy?: boolean, trigger?: Trigger } = {}
    ) {
        const { combatStatus, heros, hidx } = player;
        const newSummon: Summon[] = clone(nSummon);
        const oriSummon: Summon[] = clone(oSummon);
        const { isSummon = -1, destroy = false, trigger } = options;
        newSummon.forEach(smn => {
            let csmnIdx = oriSummon.findIndex(osm => osm.id == smn.id);
            const oriSmn = oriSummon[csmnIdx];
            if (csmnIdx > -1 && oriSmn.isTalent != smn.isTalent) { // 如果召唤物是否带有天赋不同，则重新附属
                oriSummon.splice(csmnIdx, 1);
                csmnIdx = -1;
            }
            if (csmnIdx > -1) { // 重复生成召唤物
                oriSummon[csmnIdx].useCnt = Math.max(oriSmn.useCnt, Math.min(oriSmn.maxUse, oriSmn.useCnt + smn.useCnt));
                oriSummon[csmnIdx].perCnt = smn.perCnt;
            } else if (oriSummon.length < MAX_SUMMON_COUNT) { // 召唤区未满才能召唤
                oriSummon.push(smn.setEntityId(this._genEntityId()));
                const smnres = smn.handle(smn, { trigger: 'enter', reset: true, heros });
                if (smnres.rCombatStatus) {
                    const nsts = this._updateStatus(pidx, smnres.rCombatStatus, combatStatus, isExec, heros, combatStatus, hidx);
                    combatStatus.splice(0, MAX_STATUS_COUNT, ...nsts);
                }
            }
        });
        if (isSummon > -1) return oriSummon;
        return oriSummon.filter(smn => {
            if (smn.statusId > 0) { // 召唤物有关联状态
                const smnStatus = combatStatus.find(sts => sts.id == smn.statusId) ?? this.newStatus(smn.statusId, smn.id);
                smnStatus.useCnt = smn.useCnt;
                const nsts = this._updateStatus(pidx, [smnStatus], combatStatus, isExec, heros, combatStatus, hidx);
                combatStatus.splice(0, MAX_STATUS_COUNT, ...nsts);
            }
            if (!destroy) return true;
            if ( // 召唤物消失
                (smn.useCnt == 0 &&
                    (smn.isDestroy == SUMMON_DESTROY_TYPE.Used ||
                        (smn.isDestroy == SUMMON_DESTROY_TYPE.UsedRoundEnd && trigger == 'phase-end'))) ||
                (smn.isDestroy == SUMMON_DESTROY_TYPE.RoundEnd && trigger == 'phase-end')
            ) {
                const stsIdx = combatStatus.findIndex(sts => sts.summonId == smn.id) ?? -1;
                if (stsIdx > -1) combatStatus.splice(stsIdx, 1);
                if (isExec) this._doSummonDestroy(pidx, smn);
                return false;
            }
            return true;
        });
    }
    private _startTimer() {
        if (this.countdown.limit <= 0) return;
        if (this.countdown.timer != null) clearInterval(this.countdown.timer);
        this.countdown.curr = this.countdown.limit;
        this.countdown.timer = setInterval(() => {
            --this.countdown.curr;
            if (this.countdown.curr <= 0 || this.phase != PHASE.ACTION) {
                this.countdown.curr = 0;
                clearInterval(this.countdown.timer);
                this.countdown.timer = undefined;
            }
        }, 1000);
    }
    /**
     * 投降
     * @param pidx 发起投降玩家序号
     */
    private _giveup(pidx: number) {
        this._writeLog(`[${this.players[pidx].name}]投降`);
        this._gameEnd(pidx ^ 1);
    }
    /**
     * 检测是否有赢家
     * @returns 赢家序号 -1为无
     */
    private _isWin() {
        let winnerIdx = -1;
        this.players.forEach((p, i) => p.heros.every(h => h.hp <= 0) && (winnerIdx = i ^ 1));
        if (winnerIdx > -1) {
            setTimeout(() => this._gameEnd(winnerIdx), 2500);
        }
        return winnerIdx;
    }
    /**
     * 游戏结束
     * @param winnerIdx 赢家序号
     */
    private _gameEnd(winnerIdx: number) {
        this.winner = winnerIdx;
        this.players.forEach((p, i) => {
            p.UI.info = '';
            p.phase = PHASE.NOT_READY;
            p.status = PLAYER_STATUS.WAITING;
            if (i != this.winner) {
                p.heros.forEach(h => h.isFront = false);
            }
        });
        this.isStart = false;
        this.phase = PHASE.NOT_READY;
        clearInterval(this.countdown.timer);
        this.countdown.timer = undefined;
        this.countdown.curr = 0;
        this.emit('game-end', winnerIdx);
    }
    /**
     * 执行任务
     */
    async _execTask() {
        if (this.taskQueue.isExecuting || this.taskQueue.isTaskEmpty() || !this._hasNotDieChange()) return;
        this.taskQueue.isExecuting = true;
        let isDieChangeBack = false;
        while (this._hasNotDieChange() && !this.taskQueue.isTaskEmpty() && this.taskQueue.isExecuting) {
            const [[taskType, args], isPriority] = this.taskQueue.getTask();
            if (taskType == undefined || args == undefined) break;
            let task: [() => void | Promise<void>, number?][] | undefined;
            if (taskType.startsWith('status-')) task = this._detectStatus(...(args as Parameters<typeof this._detectStatus>)).task;
            else if (taskType.startsWith('support-')) task = this._detectSupport(...(args as Parameters<typeof this._detectSupport>)).task;
            else if (taskType.startsWith('summon-')) task = this._detectSummon(...(args as Parameters<typeof this._detectSummon>)).task;
            else if (taskType.startsWith('slot-')) task = this._detectSlot(...(args as Parameters<typeof this._detectSlot>)).task;
            else if (taskType.startsWith('skill-')) task = this._detectSkill(...(args as Parameters<typeof this._detectSkill>)).task;
            else if (taskType == 'switchHero') task = args as [() => void, number?][];
            if (taskType.startsWith('statusAtk-')) {
                const isExeced = await this._doStatusAtk(args as StatusTask, isPriority);
                if (!isExeced) {
                    this.taskQueue.addStatusAtk([args as StatusTask], true);
                    break;
                }
            } else {
                if (task == undefined) continue;
                await this.taskQueue.execTask(taskType, task, isPriority);
            }
            if (isDieChangeBack) isDieChangeBack = false;
            if (!this._hasNotDieChange()) isDieChangeBack = true;
            await wait(() => this._hasNotDieChange(), { maxtime: 1e9 });
        }
        this.taskQueue.isExecuting = false;
    }
    /**
    * 计算技能的变化伤害和骰子消耗
    * @param pidx 玩家序号
    * @param hidx 角色序号
    * @param options.isSwitch 切换的角色序号
    * @param options.isReadySkill 准备技能id
    * @param options.skid 使用的技能id
    */
    _calcSkillChange(pidx: number, hidx: number, options: { isSwitch?: number, isReadySkill?: boolean, skid?: number } = {}) {
        const { isSwitch = -1, isReadySkill, skid = -1 } = options;
        if (hidx == -1 || skid == -2) return;
        const player = this.players[pidx];
        const heros = player.heros;
        if (isSwitch > -1) {
            hidx = isSwitch;
            this._detectSkill(pidx, 'change-to', { hidxs: hidx });
        }
        const curHero = heros[hidx];
        if (!curHero) throw new Error('@_calcSkillChange: hero not found');
        const rskill = isReadySkill ? this.newSkill(skid) : null;
        const genSkillArr = <T>(item: T) => curHero.skills.filter(sk => sk.type != SKILL_TYPE.Passive).map(() => clone(item));
        const dmgChange = genSkillArr(0);
        const costChange: [number, number, number[], number[][]][] = genSkillArr([0, 0, [], []]);
        let mds: number[][] = [];
        for (const curSkill of curHero.skills) {
            if (curSkill.type == SKILL_TYPE.Passive) break;
            mds.push(curSkill.cost.slice(0, 2).map(v => v.cnt));
        }
        const statuses = [...curHero.heroStatus, ...(player.hidx == hidx ? player.combatStatus : [])];
        for (const sts of statuses) {
            const stsres = sts.handle(sts, { trigger: 'calc' });
            if (!stsres.addDiceSkill) continue;
            const { skill = [0, 0, 0] } = stsres.addDiceSkill;
            for (const sidx in curHero.skills) {
                const curskill = curHero.skills[sidx];
                if (curskill.type == SKILL_TYPE.Passive) break;
                const skilltype = stsres.addDiceSkill?.[`skilltype${curskill.type}`] ?? [0, 0, 0];
                const addDice = [0, 0];
                addDice[Math.sign(mds[sidx][1])] += skill[2] + skilltype[2];
                addDice[0] += skill[0] + skilltype[0];
                addDice[1] += skill[1] + skilltype[1];
                mds[sidx][0] += addDice[0];
                mds[sidx][1] += addDice[1];
                costChange[sidx][0] -= addDice[0];
                costChange[sidx][1] -= addDice[1];
            }
        }
        const calcDmgChange = <T extends CardHandleRes | StatusHandleRes | SummonHandleRes>(res: T) => {
            if (rskill) {
                dmgChange[0] += (res.addDmg ?? 0) + (res[`addDmgType${rskill.type}`] ?? 0);
            } else {
                dmgChange.forEach((_, i, a) => {
                    const curSkill = curHero.skills[i];
                    a[i] += (res.addDmg ?? 0) + (res[`addDmgType${curSkill.type}`] ?? 0);
                });
            }
        }
        const costChangeList: [number, number][][][] = [...genSkillArr([[], [], []])]; // [有色骰, 无色骰, 元素骰]
        const calcCostChange = <T extends { minusDiceSkill?: MinuDiceSkill }>(res: T, entityId: number) => {
            if (!res.minusDiceSkill) return;
            const { minusDiceSkill: { skill = [0, 0, 0], skills = [], elDice } } = res;
            costChange.forEach((_, i) => {
                const curSkill = curHero.skills[i];
                if (curSkill.type != SKILL_TYPE.Passive) {
                    for (let j = 0; j < 3; ++j) {
                        if (j == 0 && curSkill.cost[0].type != elDice) continue;
                        const change = skill[j] + (res.minusDiceSkill?.[`skilltype${curSkill.type}`]?.[j] ?? 0) + (skills[i]?.[j] ?? 0);
                        if (change > 0) costChangeList[i][j].push([entityId, change]);
                    }
                }
            });
        }
        curHero.skills.forEach(curSkill => {
            const skillres = curSkill.handle({ hero: curHero, skid: curSkill.id, trigger: 'calc' });
            calcCostChange(skillres, curSkill.id);
        });
        [curHero.weaponSlot, curHero.artifactSlot, curHero.talentSlot].forEach(slot => {
            if (slot != null) {
                const slotres = slot.handle(slot, {
                    heros,
                    hidxs: [hidx],
                    isChargedAtk: (player.dice.length & 1) == 0,
                    isFallAtk: player.isFallAtk,
                    hcards: player.handCards,
                    trigger: 'calc',
                });
                calcDmgChange(slotres);
                calcCostChange(slotres, slot.entityId);
            }
        });
        statuses.forEach(sts => {
            const stsres = sts.handle(sts, {
                heros,
                eheros: this.players[pidx ^ 1]?.heros,
                hidx,
                isChargedAtk: (player.dice.length & 1) == 0,
                isFallAtk: player.isFallAtk,
                hcards: player.handCards,
                trigger: 'calc',
            });
            calcDmgChange(stsres);
            calcCostChange(stsres, sts.entityId);
        });
        player.summons.forEach(smn => {
            const smnres = smn.handle(smn, {
                heros,
                hidx,
                isChargedAtk: (player.dice.length & 1) == 0,
                isFallAtk: player.isFallAtk,
                trigger: 'calc',
            });
            calcDmgChange(smnres);
            calcCostChange(smnres, smn.entityId);
        });
        player.supports.forEach(support => {
            const sptres = support.handle(support, {
                heros,
                hidxs: [hidx],
                dices: player.dice,
                hcards: player.handCards,
                trigger: 'calc',
            });
            calcCostChange(sptres, support.entityId);
        });
        if (rskill) {
            rskill.dmgChange = dmgChange[0];
            return rskill;
        }
        for (let i = 0; i < curHero.skills.length; ++i) {
            const curSkill = curHero.skills[i];
            if (curSkill.type == SKILL_TYPE.Passive) continue;
            curSkill.dmgChange = dmgChange[i];
            let [elDice, anyDice] = mds[i];
            const [elCostChangeList, anyCostChangeList, diceCostChangeList] = clone(costChangeList[i]);
            while (elCostChangeList.length > 0 && elDice > 0) {
                const [eid, cnt] = elCostChangeList.shift()!;
                elDice -= cnt;
                costChange[i][0] += cnt;
                costChange[i][2].push(eid);
                costChange[i][3].push([eid, elDice + anyDice]);
            }
            while (anyCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = anyCostChangeList.shift()!;
                anyDice -= cnt;
                costChange[i][1] += cnt;
                costChange[i][2].push(eid);
                costChange[i][3].push([eid, elDice + anyDice]);
            }
            while (elCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = elCostChangeList.shift()!;
                anyDice -= cnt;
                costChange[i][1] += cnt;
                costChange[i][2].push(eid);
                costChange[i][3].push([eid, elDice + anyDice]);
            }
            while (diceCostChangeList.length > 0 && elDice > 0) {
                const [eid, cnt] = diceCostChangeList.shift()!;
                elDice -= cnt;
                costChange[i][0] += cnt;
                costChange[i][2].push(eid);
                costChange[i][3].push([eid, elDice + anyDice]);
            }
            while (diceCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = diceCostChangeList.shift()!;
                anyDice -= cnt;
                costChange[i][1] += cnt;
                costChange[i][2].push(eid);
                costChange[i][3].push([eid, elDice + anyDice]);
            }
            curSkill.costChange = [...costChange[i]];
        }
        return curHero.skills.find(sk => sk.type == skid || sk.id == skid);
    }
    /**
     * 计算卡牌的变化骰子消耗
     * @param pidx 玩家索引
     */
    private _calcCardChange(pidx: number) {
        const player = this.players[pidx];
        if (!player) return;
        const costChange = player.handCards.map(() => 0);
        const curHero = this._getFrontHero(pidx);
        if (!curHero) return;
        player.handCards.forEach((c, ci) => {
            const isMinusDiceCard = c.cost + c.anydice > costChange[ci];
            const isMinusDiceTalent = isMinusDiceCard && c.hasSubtype(CARD_SUBTYPE.Talent) && c.userType == player.heros[player.hidx].id;
            const isMinusDiceWeapon = isMinusDiceCard && c.hasSubtype(CARD_SUBTYPE.Weapon);
            const isMinusDiceArtifact = isMinusDiceCard && c.hasSubtype(CARD_SUBTYPE.Artifact);
            player.heros.forEach(h => {
                [h.weaponSlot, h.artifactSlot].forEach(slot => {
                    if (slot != null) {
                        costChange[ci] += slot.handle(slot, {
                            heros: [h],
                            hidxs: [0],
                            hcard: c,
                            minusDiceCard: costChange[ci],
                            isMinusDiceCard,
                        })?.minusDiceCard ?? 0;
                    }
                });
            });
            for (let i = 0; i < player.heros.length; ++i) {
                const hidx = (player.hidx + i) % player.heros.length;
                [...player.heros[hidx].heroStatus, ...(i == 0 ? player.combatStatus : [])].forEach(sts => {
                    costChange[ci] += sts.handle(sts, {
                        heros: player.heros,
                        hidx,
                        card: c,
                        minusDiceCard: costChange[ci],
                        isMinusDiceCard,
                        isMinusDiceTalent,
                        isMinusDiceWeapon,
                        isMinusDiceArtifact,
                    })?.minusDiceCard ?? 0;
                });
            }
            const lastSupport: Support[] = [];
            player.supports.forEach(spt => {
                const { minusDiceCard = 0, isLast = false } = spt.handle(spt, {
                    card: c,
                    dices: player.dice,
                    hcards: player.handCards,
                    heros: player.heros,
                    hidxs: [player.hidx],
                    playerInfo: player.playerInfo,
                    minusDiceCard: costChange[ci],
                });
                if (isLast) lastSupport.push(spt);
                else costChange[ci] += minusDiceCard;
            });
            lastSupport.forEach(spt => {
                costChange[ci] += spt.handle(spt, {
                    card: c,
                    dices: player.dice,
                    hcards: player.handCards,
                    heros: player.heros,
                    hidxs: [player.hidx],
                    playerInfo: player.playerInfo,
                    minusDiceCard: costChange[ci],
                })?.minusDiceCard ?? 0;
            });
            player.summons.forEach(smn => {
                costChange[ci] += smn.handle(smn, {
                    heros: player.heros,
                    minusDiceCard: costChange[ci],
                })?.minusDiceCard ?? 0;
            });
        });
        player.handCards.forEach((c, i) => c.costChange = costChange[i]);
    }
    /**
     * 计算切换角色所需骰子
     * @param pidx 玩家索引
     * @param tohidx 切换后的角色索引
     * @param fromhidx 切换前的角色索引
     * @param isOnlyAdd 是否只计算加的骰子
     */
    private _calcHeroSwitchDice(pidx: number, tohidx: number, fromhidx: number, isOnlyAdd = false) {
        let minusDiceHero = 0;
        let addDiceHero = 0;
        const { minusDiceHero: stsmh1, addDiceHero: stsah1 } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-from', { isExec: false, hidxs: [fromhidx], isOnlyHeroStatus: true });
        const { minusDiceHero: stsmh2, addDiceHero: stsah2 } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-from', { isExec: false, isOnlyCombatStatus: true });
        addDiceHero += this._detectSummon(pidx ^ 1, 'change-oppo', { isUnshift: true, isExec: false }).addDiceHero;
        addDiceHero += stsah1 + stsah2;
        if (isOnlyAdd) return INIT_SWITCH_HERO_DICE + addDiceHero;
        minusDiceHero += stsmh1 + stsmh2;
        minusDiceHero += this._detectSlot(pidx, 'change-to', { isExec: false, hidxs: tohidx }).minusDiceHero;
        minusDiceHero += this._detectSlot(pidx, ['change', 'change-from'], { isExec: false }).minusDiceHero;
        minusDiceHero += this._detectSupport(pidx, 'change', { isExec: false }).minusDiceHero;
        return this.players[pidx].UI.heroSwitchDice = Math.max(0, INIT_SWITCH_HERO_DICE + addDiceHero - minusDiceHero);
    }
    /**
     * 是否有阵亡
     * @param players 当前玩家组
     * @returns 是否有阵亡
     */
    _hasNotDieChange(players: Player[] = this.players) {
        const diePhases: Phase[] = [PHASE.DIE_CHANGE_ACTION, PHASE.DIE_CHANGE_ACTION_END];
        return players.every(p => !diePhases.includes(p.phase));
    }
    /**
     * 是否未触发
     * @param triggers 触发组
     * @param trigger 触发值
     * @returns 是否未触发
     */
    private _hasNotTriggered(triggers: Trigger[] | undefined, trigger: Trigger) {
        return (triggers ?? []).every(tr => tr != trigger.split(':')[0]);
    }
    /**
     * 获取当前出战角色信息
     * @param pidx 玩家idx
     * @param options.players 玩家信息
     * @param options.offset 正数为后x, 负数为前x
     * @param options.isAll 是否包含被击倒角色
     * @returns 当前出战角色信息
     */
    private _getFrontHero(pidx: number, options: { players?: Player[], offset?: number, isAll?: boolean } = {}): Hero {
        const { players = this.players, offset = 0, isAll = false } = options;
        const player = players[pidx];
        const aliveHidxs = allHidxs(player.heros, { isAll });
        const fidx = aliveHidxs.findIndex(i => i == player.hidx);
        if (fidx == -1) return player.heros[fidx];
        return player.heros[aliveHidxs[(fidx + offset + aliveHidxs.length) % aliveHidxs.length]];
    }
}


