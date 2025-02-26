import * as fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, Socket } from 'socket.io';
import {
    ACTION_TYPE, ActionType, CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CMD_MODE, COST_TYPE, CardSubtype, CardTag, CostType, DAMAGE_TYPE,
    DICE_COST_TYPE, DICE_TYPE, DamageType, DiceCostType, ELEMENT_TYPE, ELEMENT_TYPE_KEY, ElementCode, ElementType, HERO_LOCAL, HERO_LOCAL_CODE,
    PHASE, PLAYER_STATUS, PURE_ELEMENT_CODE, PURE_ELEMENT_CODE_KEY, PURE_ELEMENT_TYPE, PURE_ELEMENT_TYPE_KEY, Phase,
    PureElementType, SKILL_TYPE, STATUS_GROUP, STATUS_TYPE, SUMMON_DESTROY_TYPE, SkillType, StatusGroup, StatusType, Version
} from '../../common/constant/enum.js';
import {
    AI_ID, DECK_CARD_COUNT, INIT_DICE_COUNT, INIT_HANDCARDS_COUNT, INIT_PILE_COUNT, INIT_ROLL_COUNT, INIT_SWITCH_HERO_DICE, MAX_DICE_COUNT,
    MAX_GAME_ROUND, MAX_HANDCARDS_COUNT, MAX_STATUS_COUNT, MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT
} from '../../common/constant/gameOption.js';
import { INIT_PLAYER, INIT_SUMMONCNT, INIT_SUPPORTCNT, NULL_CARD } from '../../common/constant/init.js';
import { DICE_WEIGHT, ELEMENT_NAME, SKILL_TYPE_NAME, SLOT_CODE } from '../../common/constant/UIconst.js';
import { CardHandleRes, cardsTotal, newCard, parseCard } from '../../common/data/cards.js';
import { herosTotal, newHero, parseHero } from '../../common/data/heros.js';
import { newSkill } from '../../common/data/skills.js';
import { StatusHandleRes, newStatus } from '../../common/data/statuses.js';
import { SummonHandleRes, newSummon } from '../../common/data/summons.js';
import { newSupport } from '../../common/data/supports.js';
import {
    allHidxs, checkDices, compareVersionFn, getAtkHidx, getBackHidxs, getHidById, getNearestHidx, getObjById, getObjIdxById,
    getTalentIdByHid, hasObjById, heroToString, mergeWillHeals, playerToString, supportToString
} from '../../common/utils/gameUtil.js';
import { arrToObj, assgin, clone, delay, isCdt, objToArr, wait } from '../../common/utils/utils.js';
import {
    ActionData, ActionInfo, AtkTask, CalcAtkRes, Card, Cmds, Countdown, DamageVO, Env, Hero, LogType, MinusDiceSkill, PickCard,
    Player, Preview, ServerData, Skill, SmnDamageHandle, Status, StatusTask, Summon, Support, Trigger, VersionCompareFn
} from '../../typing';
import TaskQueue from './taskQueue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class GeniusInvokationRoom {
    private io?: Server; // socket.io
    id: number; // 房间id
    name: string; // 房间名
    version: VersionCompareFn; // 游戏版本
    password: string; // 房间密码
    private seed: string = ''; // 本局游戏种子(用于处理随机事件)
    players: Player[] = []; // 玩家数组
    watchers: Player[] = []; // 观战玩家
    isStart: boolean = false; // 是否开始游戏
    private phase: Phase = PHASE.NOT_READY; // 阶段
    private round: number = 1; // 回合数
    private startIdx: number = 0; // 先手玩家
    onlinePlayersCnt = 0; // 在线玩家数
    private winner: number = -1; // 赢家序号
    private taskQueue: TaskQueue; // 任务队列
    private entityIdIdx: number = -500000; // 实体id序号标记
    previews: Preview[] = []; // 当前出战玩家预览
    private log: { content: string, type: LogType }[] = []; // 当局游戏的日志
    private systemLog: string = ''; // 系统日志
    private errorLog: string[] = []; // 错误日志
    private reporterLog: { name: string, message: string }[] = []; // 报告者问题
    countdown: Countdown = { limit: 0, curr: 0, timer: undefined }; // 倒计时
    private isDieBackChange: boolean = true; // 用于记录角色被击倒切换角色后是否转换回合
    private pickModal: PickCard = { cards: [], selectIdx: -1, cardType: 'getCard', skillId: -1 };// 挑选卡牌信息
    private shareCodes: string[] = ['', '']; // 卡组码
    allowLookon: boolean; // 是否允许观战
    private env: Env; // 环境
    private newStatus: (id: number, ...args: any) => Status;
    private newCard: (id: number, ...args: any) => Card;
    private newHero: (id: number) => Hero;
    private newSummon: (id: number, ...args: any) => Summon;
    private newSkill: (id: number) => Skill;
    private newSupport: (id: number | Card, ...args: any) => Support;
    private _currentPlayerIdx: number = 0; // 当前回合玩家 currentPlayerIdx
    private _random: number = 0; // 随机数
    private delay: (time?: number, fn?: () => any) => Promise<void> | void;
    testDmgFn: (() => void)[] = []; // 伤害测试用
    testTaskFn: (() => void)[] = []; // 任务测试用
    // private _heartBreak: (NodeJS.Timeout | undefined)[][] = [[undefined, undefined], [undefined, undefined]]; // 心跳包的标记

    constructor(id: number, name: string, version: Version, password: string, countdown: number, allowLookon: boolean, env: Env, io?: Server) {
        this.io = io;
        this.id = id;
        this.name = name || `房间${id}`;
        this.version = compareVersionFn(version);
        this.password = password;
        this.countdown.limit = countdown;
        this.allowLookon = allowLookon;
        this.env = env;
        this.newStatus = newStatus(version);
        this.newCard = newCard(version);
        this.newHero = newHero(version);
        this.newSummon = newSummon(version);
        this.newSupport = (id: number | Card, ...args: any[]) => {
            if (typeof id === 'number') return newSupport(version)(this.newCard(id), ...args);
            return newSupport(version)(id, ...args);
        }
        this.newSkill = newSkill(version);
        this.taskQueue = new TaskQueue(this._writeLog.bind(this), this.env);
        this.delay = async (time?: number, fn?: () => any) => {
            if (this.env == 'test') return fn?.();
            await delay(time, fn);
        }
    }
    get isDev() {
        return this.env === 'dev';
    }
    get currentPlayerIdx() {
        return this._currentPlayerIdx;
    }
    set currentPlayerIdx(val: number) {
        this._currentPlayerIdx = (val + PLAYER_COUNT) % PLAYER_COUNT;
    }
    get needWait() {
        return this.taskQueue.isTaskEmpty() && !this.taskQueue.isExecuting && this.players.every(p => p.status != PLAYER_STATUS.DIESWITCH);
    }
    get string() {
        return `{\n`
            + `  name: ${this.name}\n`
            + `  id: ${this.id}\n`
            + `  version: ${this.version.value}\n`
            + `  password: ${this.password}\n`
            + `  seed: ${this.seed}\n`
            + `  onlinePlayersCnt: ${this.onlinePlayersCnt}\n`
            + `  players: [\n`
            + `${this.players.map(p => playerToString(p, 2)).join('') || '    \n'}`
            + `  ]\n`
            + `  watchers: [${this.watchers.map(p => `${p.name}(${p.id})`).join(', ')}]\n`
            + `  isStart: ${this.isStart}\n`
            + `  phase: ${Object.keys(PHASE)[this.phase]}\n`
            + `  round: ${this.round}\n`
            + `  startIdx: ${this.startIdx}\n`
            + `  winner: ${this.winner}\n`
            + `  taskQueue: ${this.taskQueue.queueList}\n`
            + `  entityIdIdx: ${this.entityIdIdx}\n`
            + `  isDieBackChange: ${this.isDieBackChange}\n`
            + `  _currentPlayerIdx: ${this._currentPlayerIdx}\n`
            + `  _random: ${this._random}\n`
            + `  systemLog:\n`
            + `${this.systemLog.replace(/【p?\d*:?([^【】]+)】/g, '$1').split('\n').map(l => '    ' + l).join('\n')}\n`
            + `}`;
    }
    get roomInfoLog() {
        return '\nroomInfo: {\n'
            + `  phase: ${this.phase}\n`
            + `  round: ${this.round}\n`
            + `  startIdx: ${this.startIdx}\n`
            + `  onlinePlayersCnt: ${this.onlinePlayersCnt}\n`
            + `  taskQueue: ${this.taskQueue.queueList}\n`
            + `  isDieBackChange: ${this.isDieBackChange}\n`
            + `  players: [\n`
            + `${this.players.map(p => playerToString(p, 2)).join('')}\n`
            + `  ]\n`
            + `}`;
    }
    /**
     * 手动设置种子
     * @param rt 种子
     * @returns this
     */
    private _setSeed(rt: string | number) {
        this.seed = rt.toString();
        this._random = +rt;
        return this;
    }
    /**
     * 获取随机数
     * @param max 随机数最大值
     * @returns 随机整数 max > 0: [0, max]; max < 0: [max, 0]
     */
    private _randomInt(max: number = 1) {
        this._random = (this._random * 13 + 29) % 1e10;
        const randomInt = parseInt(`${this._random % 1e6 / 1e6 * (max + Math.sign(max))}`);
        return randomInt;
    }
    /**
     * 获取数组中随机n项
     * @param arr 数组
     * @returns 数组中随机n项
     */
    private _randomInArr<T>(arr: T[], cnt: number = 1) {
        const selected: number[] = [];
        if (arr.length <= cnt) return arr;
        while (cnt > 0) {
            const idx = this._randomInt(arr.length - 1);
            if (selected.includes(idx)) continue;
            selected.push(idx);
            --cnt;
        }
        return arr.filter((_, idx) => selected.includes(idx));
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
        if (this.env == 'test') return;
        if (type != 'system' && type != 'emit') this.log.push({ content: log.replace(/{[^\{\}]+}/g, ''), type });
        this.systemLog += log.replace(/\{|\}/g, '') + '\n';
    }
    /**
     * 导出日志
     */
    exportLog(options: { isShowRoomInfo?: boolean } = {}) {
        if (this.env == 'test') return;
        const { isShowRoomInfo = true } = options;
        let log = this.systemLog.replace(/【p?\d*:?([^【】]+)】/g, '$1') + '\n' +
            this.errorLog.join('\n') + '\n' +
            this.reporterLog.map(l => `[${l.name}]: ${l.message}\n`).join('');
        if (isShowRoomInfo) log += this.roomInfoLog;
        const path = `${__dirname}/../../../logs/${this.seed || `${this.version.value.replace(/\./g, '_')}-r${this.id}`}.log`;
        fs.writeFile(path, log, err => {
            if (err) return console.error('err:', err);
        });
    }
    /**
     * 记录报告者问题
     * @param name 报告者名字
     * @param message 报告者问题
     */
    setReporterLog(name: string, message: string) {
        this.reporterLog.push({ name, message });
    }
    /**
     * 重置心跳
     * @param pidx 玩家序号
     */
    // resetHeartBreak(pidx: number) {
    //     if (this.players[pidx].id == AI_ID) return;
    //     clearInterval(this._heartBreak[pidx][0]);
    //     clearInterval(this._heartBreak[pidx][1]);
    //     this._heartBreak[pidx][0] = this.delay(30e3, () => {
    //         this.io.to(`7szh-${this.id}-p${pidx}`).emit('getHeartBreak');
    //         this._heartBreak[pidx][1] = this.delay(5e3, () => this.leaveRoom('close', this.players[pidx]));
    //     });
    // }
    /**
     * 获取预览
     * @param pidx 玩家序号
     */
    private _getPreview(pidx: number) {
        const players = clone(this.players);
        const previews: Preview[] = [];
        previews.push(...this._previewSkill(pidx));
        previews.push(...this._previewCard(pidx));
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
     * @param options.hasReadyskill 是否有准备技能
     * @param options.ohidx 切换前角色序号
     */
    emit(flag: string, pidx: number, options: {
        socket?: Socket, tip?: string | string[], damageVO?: DamageVO, notPreview?: boolean, notUpdate?: boolean, actionInfo?: ActionInfo,
        isQuickAction?: boolean, canAction?: boolean, isChange?: boolean, isActionInfo?: boolean, slotSelect?: number[], ohidx?: number,
        heroSelect?: number[], statusSelect?: number[], summonSelect?: number[], supportSelect?: number[], hasReadyskill?: boolean,
    } = {}) {
        if (pidx < 0) return;
        try {
            const { socket, tip = '', actionInfo, damageVO = -1, notPreview, isActionInfo, canAction = true,
                slotSelect = [], heroSelect = [], statusSelect = [], summonSelect = [], supportSelect = [], notUpdate,
                isQuickAction, isChange, hasReadyskill, ohidx,
            } = options;
            this.players.forEach(p => {
                p.handCards.sort((a, b) => a.id - b.id || b.entityId - a.entityId).forEach((c, ci) => c.cidx = ci);
                p.heros.forEach(h => {
                    if (!notUpdate) this._updateStatus(p.pidx, [], h.heroStatus, this.players, { hidx: h.hidx, isExec: true, isQuickAction, isAddAtkStsTask: true });
                    this._calcSkillChange(p.pidx, h.hidx);
                });
                if (!notUpdate) {
                    this._updateStatus(p.pidx, [], p.combatStatus, this.players, {
                        hidx: p.hidx, isExec: true, ohidx: isCdt(p.pidx == pidx, ohidx), isQuickAction, isAddAtkStsTask: true,
                    });
                }
                p.canAction = canAction && (p.pidx == this.currentPlayerIdx || !isChange) &&
                    (p.pidx != this.currentPlayerIdx || !hasReadyskill) &&
                    (isQuickAction || p.canAction) && this.taskQueue.isTaskEmpty() &&
                    this.isStart && p.phase == PHASE.ACTION && p.status == PLAYER_STATUS.PLAYING &&
                    (p.heros[p.hidx].heroStatus.some(s => s.hasType(STATUS_TYPE.NonAction)) ||
                        p.heros[p.hidx].heroStatus.every(s => !s.hasType(STATUS_TYPE.ReadySkill)));
                this._calcCardChange(p.pidx);
            });
            const previews: Preview[] = [];
            // 计算预测行动的所有情况
            const cplayer = this.players[this.currentPlayerIdx];
            if (
                this.phase == PHASE.ACTION && !notPreview && cplayer.canAction && !flag.includes('update') &&
                this._hasNotDieSwitch() && this.taskQueue.isTaskEmpty() && cplayer.status == PLAYER_STATUS.PLAYING
            ) {
                previews.push(...this._getPreview(this.currentPlayerIdx));
                this.previews = previews;
                if (this.env == 'test') return;
                if ( // AI行动
                    (flag.startsWith('changeTurn') && flag.includes('setCanAction') ||
                        flag.includes('reroll') || flag.includes('reconcile') ||
                        ((flag.includes('useCard') || flag.includes('card-doDamage') || flag.endsWith('card')) && !isChange)
                    ) && cplayer.id == AI_ID
                ) {
                    this.delay(2e3, () => {
                        const actionType: ActionType[] = [ACTION_TYPE.UseCard, ACTION_TYPE.UseSkill, ACTION_TYPE.Reconcile, ACTION_TYPE.SwitchHero];
                        const { pidx: cpidx, dice, heros } = cplayer;
                        if (cplayer.phase == PHASE.DICE) {
                            this._reroll(dice.map(d => d != DICE_COST_TYPE.Omni && !heros.map(h => h.element).includes(d)), cpidx, 'reroll-ai');
                            return;
                        }
                        if (cplayer.phase == PHASE.PICK_CARD) {
                            this._pickCard(cpidx, 0, this.pickModal.skillId);
                            return;
                        }
                        while (true) {
                            const [action] = this._randomInArr(actionType);
                            const pres = previews.filter(p => p.type == action && p.isValid);
                            if (pres.length > 0) {
                                const [preview] = this._randomInArr(pres);
                                switch (preview.type) {
                                    case ACTION_TYPE.UseCard:
                                        this._useCard(cpidx, preview.cardIdxs![0], preview.diceSelect!, {
                                            selectHeros: preview.heroIdxs,
                                            selectSummon: preview.summonIdx,
                                            selectSupport: preview.supportIdx,
                                        });
                                        break;
                                    case ACTION_TYPE.UseSkill:
                                        assgin(dice, dice.filter((_, di) => !preview.diceSelect![di]));
                                        this._useSkill(cpidx, preview.skillId!, { selectSummon: preview.summonIdx });
                                        break;
                                    case ACTION_TYPE.Reconcile:
                                        this._reconcile(cpidx, preview.diceSelect!, preview.cardIdxs![0], 'reconcile-ai');
                                        break;
                                    case ACTION_TYPE.SwitchHero:
                                        this._switchHero(cpidx, preview.heroIdxs![0], 'switchHero-ai', { diceSelect: preview.diceSelect });
                                        break;
                                    default:
                                        const a: never = preview.type as never;
                                        throw new Error(`@emit-aiAction: 未知的ActionType[${a}]`);
                                }
                                break;
                            }
                            actionType.splice(actionType.indexOf(action), 1);
                            if (actionType.length == 0) {
                                this._doEndPhase(cpidx, 'endPhase-ai');
                                break;
                            }
                        }
                    });
                }
            }
            // AI挑选卡牌
            if (cplayer?.id == AI_ID && cplayer?.phase == PHASE.PICK_CARD && flag.startsWith('pickCard')) {
                this.delay(1e3, () => this._pickCard(cplayer.pidx, this._randomInt(this.pickModal.cards.length - 1), this.pickModal.skillId));
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
                actionInfo: { content: '' },
                isWin: this.winner,
                slotSelect,
                heroSelect,
                statusSelect,
                summonSelect,
                supportSelect,
                pickModal: this.pickModal,
                watchers: this.watchers.length,
                flag: `[${this.id}]${flag}-p${pidx}`,
            };
            const _serverDataVO = (vopidx: number, tip: string | string[]) => {
                const log = this.log.map(lg => {
                    const cpidxs = lg.content.match(/(?<=【p)\d+(?=:)/g)?.map(Number) ?? [];
                    if (vopidx == -1) return { content: lg.content.replace(/【p\d+:([^【】]+)】/g, '$1'), type: lg.type }
                    const logctt = lg.content
                        .replace(new RegExp(`\\[${this.players[vopidx]?.name}\\]\\(${vopidx}\\)`), '[我方]')
                        .replace(new RegExp(`\\[${this.players[vopidx ^ 1]?.name}\\]\\(${vopidx ^ 1}\\)`), '[对方]');
                    if (cpidxs.length == 0) return { content: logctt.replace(/【[^【】]+】/g, ''), type: lg.type }
                    const content = cpidxs.reduce((a, c) => {
                        return a.replace(new RegExp(`【p${c}:([^【】]+)】`, 'g'), c == vopidx ? '$1' : '');
                    }, logctt).replace(/【[^【】]+】/g, '');
                    return { content, type: lg.type }
                });
                const content = actionInfo?.content || (isActionInfo ? log.filter(lg => lg.type == 'info').at(-1)?.content.replace(/\s*\d→\d/g, '') ?? '' : '');
                return {
                    players: this.players.map(pvo => {
                        const heros = clone(pvo.heros).map(h => {
                            h.heroStatus = h.heroStatus.filter(s => !s.hasType(STATUS_TYPE.Hide));
                            h.skills = h.skills.filter(s => s.type != SKILL_TYPE.PassiveHidden);
                            return h;
                        });
                        const combatStatus = pvo.combatStatus.filter(s => !s.hasType(STATUS_TYPE.Hide));
                        if (pvo.pidx == vopidx || vopidx == -1) {
                            return {
                                ...pvo,
                                pile: [],
                                heros,
                                combatStatus,
                            }
                        }
                        return {
                            ...pvo,
                            heros,
                            combatStatus,
                            UI: {
                                ...pvo.UI,
                                willGetCard: {
                                    ...pvo.UI.willGetCard,
                                    cards: pvo.UI.willGetCard.cards.map(c => pvo.UI.willGetCard.isNotPublic ? NULL_CARD() : c)
                                },
                                willAddCard: {
                                    ...pvo.UI.willAddCard,
                                    cards: pvo.UI.willAddCard.cards.map(c => pvo.UI.willAddCard.isNotPublic ? NULL_CARD() : c),
                                },
                                willDiscard: {
                                    ...pvo.UI.willDiscard,
                                    hcards: pvo.UI.willDiscard.hcards.map(c => pvo.UI.willDiscard.isNotPublic ? NULL_CARD() : c),
                                    pile: pvo.UI.willDiscard.pile.map(c => pvo.UI.willDiscard.isNotPublic ? NULL_CARD() : c),
                                }
                            },
                            pile: [],
                            playerInfo: {
                                isUsedLegend: pvo.playerInfo.isUsedLegend,
                            },
                            dice: [],
                            handCards: [],
                        }
                    }),
                    previews: vopidx == this.currentPlayerIdx ? this.previews : [],
                    ...(typeof tip != 'string' ? { tip: tip[vopidx] } :
                        tip.includes('{p}') ? { tip: tip.replace(/{p}/, vopidx == this.currentPlayerIdx ? '你的' : '对方') } : {}),
                    log: log.map(v => v.content),
                    actionInfo: {
                        ...actionInfo,
                        content,
                        isShow: content != '' || !!actionInfo?.card,
                        isOppo: pidx != vopidx,
                    },
                }
            }
            this._writeLog(serverData.flag, 'emit');
            if (socket) {
                socket.emit('getServerInfo', Object.freeze({
                    ...serverData,
                    ..._serverDataVO(pidx, tip),
                }));
            } else {
                this.io?.to(`7szh-${this.id}`).emit('getServerInfo', Object.freeze({
                    ...serverData,
                    ..._serverDataVO(-1, tip),
                }));
                this.players.forEach(p => {
                    this.io?.to(`7szh-${this.id}-p${p.pidx}`).emit('getServerInfo', Object.freeze({
                        ...serverData,
                        ..._serverDataVO(p.pidx, tip),
                    }));
                    if (flag == 'leaveRoom' && pidx == 0 && p.pidx != 0) {
                        this.io?.to(`7szh-${this.id}-p${p.pidx}`).emit('updateSocketRoom');
                    }
                });
            }
        } catch (e) {
            const error: Error = e as Error;
            console.error(error);
            this.emitError(error);
        }
    }
    /**
     * 发送错误信息
     * @param err 错误信息
     */
    emitError(err: Error) {
        if (err.stack) this.errorLog.push(err.stack);
        this.io?.to([`7szh-${this.id}`, `7szh-${this.id}-p0`, `7szh-${this.id}-p1`]).emit('error', err.message);
        this.exportLog();
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
        if (newPlayer.id == AI_ID) player.phase = PHASE.NOT_BEGIN;
        if (pidx < PLAYER_COUNT) {
            this.players.push(player);
            this.onlinePlayersCnt = Math.min(PLAYER_COUNT, this.players.length);
        } else {
            this.watchers.push(player);
        }
        this.players.forEach((p, pi) => p.pidx = pi);
        if (this.env != 'test') console.info(`init-rid:${this.id}-[${newPlayer.name}]-pid:${newPlayer.id}-pidx:${pidx}`);
        this.emit(`player[${player.name}](${player.id}) enter room`, pidx);
        return player;
    }
    /**
     * 创建AI玩家
     */
    private _initAI() {
        const aiPlayer = this.players[1];
        aiPlayer.heros = [];
        const heroIds = new Set<number>();
        const heroIdsPool = herosTotal(this.version.value).map(h => h.id);
        const elMap = arrToObj(Object.values(ELEMENT_TYPE), 0);
        const lcMap = arrToObj(Object.values(HERO_LOCAL), 0);
        while (heroIds.size < 3) {
            const [hid] = this._randomInArr(heroIdsPool);
            if (heroIds.has(hid)) continue;
            heroIds.add(hid);
            aiPlayer.heros.push(this.newHero(hid));
        }
        aiPlayer.heros.forEach(h => {
            ++elMap[h.element];
            h.tags.forEach(lc => lc in lcMap && ++lcMap[lc]);
        });
        const cardIdsMap = new Map<number, number>();
        const cardIdsPool = this._getCardIds();
        let hasLegend = false;
        while (aiPlayer.pile.length < DECK_CARD_COUNT) {
            const card = this.newCard(this._randomInArr(cardIdsPool)[0]);
            const cid = card.id;
            const cnt = cardIdsMap.get(cid) || 0;
            if (cnt < 2) {
                if (card.hasSubtype(CARD_SUBTYPE.Legend)) {
                    if (!hasLegend) hasLegend = true;
                    else continue;
                }
                if (card.hasSubtype(CARD_SUBTYPE.ElementResonance)) {
                    const [element] = objToArr(elMap).find(([, el]) => el > 1) ?? [ELEMENT_TYPE.Physical];
                    if (element == ELEMENT_TYPE.Physical) continue;
                    const elCode = PURE_ELEMENT_CODE[element] * 100;
                    if (![331001 + elCode, 331002 + elCode].includes(cid)) continue;
                }
                if (card.hasSubtype(CARD_SUBTYPE.ElementResonance)) {
                    const [local] = objToArr(lcMap).find(([, lc]) => lc > 1) ?? [];
                    if (local == undefined || cid != 331800 + HERO_LOCAL_CODE[local]) continue;
                }
                if (card.hasSubtype(CARD_SUBTYPE.Talent) && !heroIds.has(+card.userType)) continue;
                cardIdsMap.set(cid, cnt + 1);
            }
            aiPlayer.pile.push(card);
        }
    }
    /**
     * 开始游戏
     * @param pidx 玩家序号
     * @param flag 标志
     */
    start(pidx: number, flag: string, seed?: string) {
        this.seed ||= isCdt(this.env == 'test', seed) ?? Math.floor(Math.random() * 1e10).toString();
        this._random = +this.seed;
        const d = new Date();
        const format = (n: number) => String(n).padStart(2, '0');
        if (this.env != 'test') console.info(`[${this.id}]start-seed:${this.seed}`);
        this.seed = `${d.getFullYear()}-${format(d.getMonth() + 1)}-${format(d.getDate())}-${format(d.getHours())}-${format(d.getMinutes())}-${format(d.getSeconds())}-${this.version.value.replace(/\./g, '_')}-r${this.id}-s${this.seed}`;
        this.entityIdIdx = -500000;
        this.isStart = true;
        this.currentPlayerIdx = this.players[1].id == AI_ID ? 0 : this.env != 'prod' ? 1 : this._randomInt(PLAYER_COUNT);
        this.startIdx = this.currentPlayerIdx;
        this.phase = PHASE.CHANGE_CARD;
        this.winner = -1;
        this.round = 1;
        this.log = [];
        this.systemLog = '';
        this.errorLog = [];
        this.reporterLog = [];
        this.taskQueue.init();
        if (this.players[1].id == AI_ID) this._initAI();
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
            p.playerInfo.isUsedLegend = false;
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
            this._writeLog(`player${p.pidx}[${p.name}]卡组码: ${this.shareCodes[p.pidx]}`, 'system')
            this._writeLog(`[${p.name}](${p.pidx})获得手牌${p.handCards.map(c => `[${c.name}](${c.entityId})`).join('')}`, 'system');
            this._writeLog(`[${p.name}](${p.pidx})牌库：${p.pile.map(c => `[${c.name}]`).join('')}`, 'system');
            // this.resetHeartBreak(p.pidx);
        });
        if (this.players[1].id == AI_ID) {
            const aiPlayer = this.players[1];
            aiPlayer.hidx = this._randomInt(aiPlayer.heros.length - 1);
            aiPlayer.heros[aiPlayer.hidx].isFront = true;
            aiPlayer.phase == PHASE.DICE;
        }
        this.emit(flag, pidx);
    }
    /**
     * 获取行动
     * @param actionData 行动数据
     * @param pidx 发起行动的玩家序号
     * @param socket 发送请求socket
     */
    getAction(actionData: ActionData, pidx: number = this.currentPlayerIdx, socket?: Socket) {
        if (this.taskQueue.isExecuting) return;
        const { heroIds = [], cardIds = [], cardIdxs = [], heroIdxs = [], diceSelect = [], skillId = -1,
            summonIdx = -1, supportIdx = -1, shareCode = '', flag = 'noflag' } = actionData;
        const player = this.players[pidx];
        // this.resetHeartBreak(pidx);
        switch (actionData.type) {
            case ACTION_TYPE.StartGame:
                if (this.players.length < PLAYER_COUNT) return this.emit('playersError', pidx, { socket, tip: `玩家为${PLAYER_COUNT}人才能开始游戏` });
                if (this.shareCodes[pidx] != shareCode && heroIds.length > 0 && cardIds.length > 0) {
                    if (heroIds.includes(0) || cardIds.length < DECK_CARD_COUNT) return this.emit('deckCompleteError', pidx, { socket, tip: '当前出战卡组不完整' });
                    player.heros = heroIds.map(hid => parseHero(hid, this.version.value));
                    player.pile = cardIds.map(cid => parseCard(cid, this.version.value));
                    if (player.heros.some(h => h.id == 0) || player.pile.some(c => c.id == 0)) {
                        return this.emit('deckVersionError', pidx, { socket, tip: '当前卡组版本不匹配' });
                    }
                }
                player.phase = (player.phase ^ 1) as Phase;
                if (player.phase == PHASE.NOT_BEGIN) this.shareCodes[pidx] = shareCode;
                if (this.winner > -1 && this.winner < PLAYER_COUNT) this.winner += PLAYER_COUNT;
                if (this.players.every(p => p.phase == PHASE.NOT_BEGIN)) { // 双方都准备开始
                    this.start(pidx, flag);
                } else {
                    this.emit(flag, pidx);
                }
                break;
            case ACTION_TYPE.ChangeCard:
                this._changeCard(pidx, cardIdxs, flag, socket);
                break;
            case ACTION_TYPE.ChooseInitHero:
                this._chooseInitHero(pidx, heroIdxs[0], flag, socket);
                break;
            case ACTION_TYPE.Reroll:
                this._reroll(diceSelect, pidx, flag, socket);
                break;
            case ACTION_TYPE.SwitchHero:
                this._switchHero(pidx, heroIdxs[0], flag, { socket, diceSelect });
                break;
            case ACTION_TYPE.UseSkill:
                const useDices = player.dice.filter((_, di) => diceSelect[di]);
                const skill = [player.heros[player.hidx].vehicleSlot?.[1], ...player.heros[player.hidx].skills].find(sk => sk?.id == skillId || sk?.type == skillId);
                const isValid = checkDices(useDices, { skill });
                if (!isValid) this.emit('useSkillDiceInvalid', pidx, { socket, tip: '骰子不符合要求', notPreview: true });
                else {
                    const odice = player.dice.slice();
                    player.dice = player.dice.filter((_, di) => !diceSelect[di]);
                    const { invalidInfo } = this._useSkill(pidx, skillId, {
                        selectSummon: summonIdx,
                        selectHero: heroIdxs[0],
                        isChargedAtk: odice.length % 2 == 0,
                    });
                    if (invalidInfo.flag != '') {
                        player.dice = odice;
                        this.emit(invalidInfo.flag, pidx, { socket, tip: invalidInfo.tip, notPreview: true });
                    }
                }
                break;
            case ACTION_TYPE.UseCard:
                this._useCard(pidx, cardIdxs[0], diceSelect, { socket, selectHeros: heroIdxs, selectSummon: summonIdx, selectSupport: supportIdx });
                break;
            case ACTION_TYPE.Reconcile:
                this._reconcile(pidx, diceSelect, cardIdxs[0], flag, socket);
                break;
            case ACTION_TYPE.EndPhase:
                this._doEndPhase(pidx, flag);
                break;
            case ACTION_TYPE.GiveUp:
                this._giveup(pidx);
                break;
            case ACTION_TYPE.PickCard:
                this._pickCard(pidx, cardIdxs[0], skillId);
                break;
            default:
                const a: never = actionData.type;
                throw new Error(`@getAction: 未知的ActionType[${a}]`);
        }
    }
    /**
     * 仅开发用
     * @param actionData 开发调试数据
     */
    getActionDev(actionData: {
        cpidx: number, cmds: Cmds[], dices: DiceCostType[], hps: { hidx: number, hp: number }[],
        clearSts: { hidx: number, stsid: number }[], attachs: { hidx: number, el: ElementCode, isAdd: boolean }[],
        setStsCnt: { hidx: number, stsid: number, type: string, val: number }[],
        setSmnCnt: { smnidx: number, type: string, val: number }[],
        setSptCnt: { sptidx: number, type: string, val: number }[],
        disCardCnt: number, smnIds: number[], sptIds: number[], seed: string, flag: string
    }) {
        const { cpidx, cmds, dices, attachs = [], hps = [], disCardCnt = 0, clearSts = [], setStsCnt = [],
            setSmnCnt = [], setSptCnt = [], smnIds = [], sptIds = [], seed = '', flag = '' } = actionData;
        if (flag.includes('seed')) {
            if (!this.isStart) this._setSeed(seed);
            return;
        }
        if (this.env == 'prod' && !this.seed.endsWith(`-s${seed}`)) return;
        if (flag.includes('log')) return this.exportLog({ isShowRoomInfo: false });
        const player = this.players[cpidx];
        const heros = player.heros;
        for (const { hidx, el, isAdd } of attachs) {
            if (!isAdd || el == 0) {
                if (hidx >= heros.length) heros.forEach(h => (h.attachElement = []));
                else heros[hidx].attachElement = [];
            }
            if (el > 0 && el < 8) {
                if (hidx >= heros.length) heros.forEach(h => h.attachElement.push(PURE_ELEMENT_CODE_KEY[el]));
                else heros[hidx].attachElement.push(PURE_ELEMENT_CODE_KEY[el]);
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
        for (const { hidx, stsid, type, val } of setStsCnt) {
            const hero = heros[hidx];
            const sts = [...player.combatStatus, ...(hero?.heroStatus ?? [])].find(s => s.id == stsid);
            if (!sts) continue;
            if (type == 'p') sts.perCnt = val;
            else if (type == 'u') sts.useCnt = val;
            else if (type == 'r') sts.roundCnt = val;
        }
        if (dices) player.dice = dices;
        if (disCardCnt < 0) player.handCards.sort((a, b) => b.entityId - a.entityId).splice(disCardCnt, 10);
        this._doCmds(cpidx, cmds);
        if (smnIds[0] == 0) player.summons = [];
        else if (smnIds[0] < 0) player.summons.splice(smnIds[0]);
        else if (smnIds.length > 0) {
            this._updateSummon(cpidx, smnIds.map(smnid => this.newSummon(smnid)), this.players);
        }
        for (const { smnidx, type, val } of setSmnCnt) {
            const smn = player.summons[smnidx];
            if (!smn) continue;
            if (type == 'p') smn.perCnt = val;
            else if (type == 'u') smn.useCnt = val;
        }
        if (sptIds[0] == 0) player.supports = [];
        else if (sptIds[0] < 0) player.supports.splice(sptIds[0]);
        else {
            while (sptIds.length > 0 && player.supports.length < MAX_SUPPORT_COUNT) {
                player.supports.push(this.newSupport(sptIds.shift()!).setEntityId(this._genEntityId()));
            }
        }
        for (const { sptidx, type, val } of setSptCnt) {
            const spt = player.supports[sptidx];
            if (!spt) continue;
            if (type == 'p') spt.perCnt = val;
            else if (type == 'u') spt.cnt = val;
        }
        this.emit(flag, cpidx, { isQuickAction: true });
        this._execTask();
    }
    /**
     * 替换手牌
     * @param pidx 玩家序号
     * @param cardIdxs 要替换的手牌序号
     * @param flag flag
     */
    private _changeCard(pidx: number, cardIdxs: number[], flag: string, socket?: Socket) { // 换牌
        const player = this.players[pidx];
        const handCardsLen = player.handCards.length;
        const blackIds = new Set<number>();
        cardIdxs.forEach(cidx => blackIds.add(player.handCards[cidx].id));
        const oldCards = player.handCards.filter((_, idx) => cardIdxs.includes(idx));
        assgin(player.handCards, player.handCards.filter((_, idx) => !cardIdxs.includes(idx)));
        while (oldCards.length > 0) {
            player.pile.splice(this._randomInt(player.pile.length - 1), 0, oldCards.shift()!);
        }
        let newIdx = 0;
        while (player.handCards.length < handCardsLen && newIdx < player.pile.length - 1) {
            const newCard = player.pile[newIdx++];
            if (blackIds.has(newCard.id)) continue;
            player.pile.splice(--newIdx, 1);
            player.handCards.push(clone(newCard).setEntityId(this._genEntityId()));
        }
        if (player.handCards.length < handCardsLen) {
            player.handCards.push(clone(player.pile.shift()!).setEntityId(this._genEntityId()));
        }
        if (this.phase == PHASE.ACTION) {
            this.delay(1e3, () => {
                player.phase = PHASE.ACTION;
                this.emit(flag + '-action', pidx, { isQuickAction: true });
            });
        } else {
            this._writeLog(player.handCards.reduce((a, c) => a + `[${c.name}](${c.entityId})`, `[${player.name}](${player.pidx})换牌后手牌为`), 'system');
            player.UI.info = `${this.startIdx == player.pidx ? '我方' : '对方'}先手，等待对方选择......`;
            this.delay(1e3, () => {
                player.phase = PHASE.CHOOSE_HERO;
                this.emit(flag + '-init', pidx, { tip: '选择出战角色', socket });
            });
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
    private _chooseInitHero(pidx: number, hidx: number, flag: string, socket?: Socket) {
        const player = this.players[pidx];
        player.hidx = hidx;
        player.heros[hidx].isFront = true;
        player.phase = PHASE.DICE;
        this._writeLog(`[${player.name}](${player.pidx})选择[${player.heros[hidx].name}]出战`);
        if (this.players.every(p => p.phase == PHASE.DICE || p.id == AI_ID)) { // 双方都选完出战角色
            this.phase = PHASE.DICE;
            this.players.forEach(player => {
                player.dice = this._rollDice(player.pidx);
                player.UI.showRerollBtn = true;
                this._writeLog(player.dice.reduce((a, c) => a + `[${ELEMENT_NAME[c].replace(/元素/, '')}]`, `[${player.name}](${player.pidx})初始骰子为`), 'system');
                if (player.id == AI_ID) this._reroll(player.dice.map(d => d != DICE_COST_TYPE.Omni && !player.heros.map(h => h.element).includes(d)), player.pidx, 'reroll-ai');
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
     * @param options.trigger 触发切换角色的时机
     */
    private async _switchHero(pidx: number, hidx: number, flag: string,
        options: { socket?: Socket, diceSelect?: boolean[], isQuickAction?: boolean, trigger?: Trigger } = {}) {
        const { socket, diceSelect } = options;
        let { isQuickAction = false } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const isDieSwitch = player.status == PLAYER_STATUS.DIESWITCH;
        const { switchHeroDiceCnt: needDices = INIT_SWITCH_HERO_DICE } = this.previews.find(pre => pre.type == ACTION_TYPE.SwitchHero && pre.heroIdxs![0] == hidx) ?? {};
        if (!isDieSwitch && diceSelect && diceSelect.filter(d => d).length != needDices) return this.emit('switchHeroDiceError', pidx, { socket, tip: '骰子不符合要求' });
        const ohidx = player.hidx;
        if (isDieSwitch) { // 被击倒后选择出战角色
            isQuickAction = !this.isDieBackChange;
            const isOppoActioning = opponent.phase == PHASE.ACTION && isQuickAction;
            player.UI.info = isOppoActioning ? '对方行动中....' : '我方行动中....';
            player.status = PLAYER_STATUS.WAITING;
            const isActioning = player.phase == PHASE.ACTION && !isQuickAction;
            opponent.UI.info = isActioning ? '对方行动中....' : player.phase > PHASE.ACTION ? '对方结束已结束回合...' : '我方行动中....';
            if (isOppoActioning) this.players[this.currentPlayerIdx].canAction = true;
            this.taskQueue.isDieWaiting = false;
        } else if (diceSelect != undefined) { // 主动切换角色
            ({ isQuickAction } = this._calcHeroSwitch(pidx, hidx, ohidx, true));
            for (let i = 0; i < player.heros.length; ++i) {
                const chi = (ohidx + i) % player.heros.length;
                const triggers: Trigger[] = ['active-switch'];
                if (chi == ohidx) triggers.push('active-switch-from');
                else if (chi == hidx) triggers.push('active-switch-to');
                this._detectSlotAndStatus(pidx, triggers, { hidxs: chi, types: STATUS_TYPE.Usage, isQuickAction });
            }
            this._detectSummon(pidx, 'active-switch', { isQuickAction });
            this._detectSupport(pidx, 'active-switch', { hidx, isQuickAction });
            player.dice = player.dice.filter((_, i) => !diceSelect?.[i]);
        }
        const isQuickSwitch = isQuickAction && !isDieSwitch && this.phase == PHASE.ACTION && diceSelect;
        this._writeLog(`[${player.name}](${player.pidx})切换为[${player.heros[hidx].name}]出战${isQuickSwitch ? '（快速行动）' : ''}`, 'info');
        this.taskQueue.addTask('switchHero', [[async () => {
            if (diceSelect != undefined) this._doActionAfter(pidx, isQuickAction);
            const player = this.players[pidx];
            this._detectSkill(pidx, 'switch-to', { hidxs: hidx, isQuickAction });
            for (let i = 0; i < player.heros.length; ++i) {
                const chi = (hidx + i) % player.heros.length;
                const triggers: Trigger[] = ['switch'];
                const types: StatusType[] = [STATUS_TYPE.Usage, STATUS_TYPE.Attack];
                if (chi == ohidx) {
                    triggers.push('switch-from');
                    types.push(STATUS_TYPE.ReadySkill);
                } else if (chi == hidx) {
                    triggers.push('switch-to');
                } else continue;
                this._detectSlotAndStatus(pidx, triggers, { hidxs: chi, types, fhidx: ohidx, isQuickAction });
            }
            this._detectSupport(pidx, 'switch', { hidx, isQuickAction });
            player.isFallAtk = true;
            player.hidx = hidx;
            player.heros.forEach((h, idx) => h.isFront = idx == hidx);
            this._detectSlotAndStatus(pidx ^ 1, 'switch-oppo', { hidxs: opponent.hidx, types: [STATUS_TYPE.Usage], isQuickAction });
            if (player.heros[ohidx].hp == 0) player.heros[ohidx].hp = -1;
            this.emit(flag, pidx, {
                isQuickAction,
                ohidx,
                actionInfo: {
                    content: `${pidx == player.pidx ? '我方' : '对方'}切换角色：${player.heros[hidx].name}`,
                    avatar: player.heros[hidx].UI.avatar,
                    subContent: isCdt(!!isQuickSwitch, '（快速行动）'),
                }
            });
        }, 1e3]], { isUnshift: true, orderAfter: 'minus-switch' });
        await this._execTask();
        if (isDieSwitch) {
            const { cmds: killedicmds } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'killed', { isOnlyHeroStatus: true, hidxs: [ohidx] });
            const { cmds: killedocmds } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'killed', { isOnlyCombatStatus: true });
            this._doCmds(pidx, [...killedicmds, ...killedocmds]);
            assgin(player.heros[ohidx].heroStatus, player.heros[ohidx].heroStatus.filter(sts => sts.hasType(STATUS_TYPE.NonDestroy)));
        }
        await this._execTask();
        if ((isDieSwitch || diceSelect != undefined) && this._hasNotDieSwitch()) {
            this._changeTurn(pidx, isQuickAction, 'switchHero', { isDieSwitch });
        }
        if (!isQuickAction) player.canAction = false;
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
        dices.forEach((d, di) => !diceIdxs.includes(di) && ++tmpDice[d]);
        if (isInit) { // 投掷阶段检测
            player.heros.forEach(h => {
                for (const slot of h.equipments) {
                    if (diceLen == 0) continue;
                    const slotres = slot.handle(slot, { heros: player.heros, trigger: 'phase-dice' });
                    if (this._hasNotTriggered(slotres.trigger, 'phase-dice')) continue;
                    const { element = DICE_COST_TYPE.Omni, cnt = 0 } = slotres;
                    const dcnt = Math.min(diceLen, cnt);
                    tmpDice[element] += dcnt;
                    diceLen -= dcnt;
                }
            });
            for (const support of player.supports) {
                const supportres = support.handle(support, { trigger: 'phase-dice' });
                if (this._hasNotTriggered(supportres.trigger, 'phase-dice') || diceLen == 0) continue;
                let { element = DICE_COST_TYPE.Omni, cnt = 0, addRollCnt = 0 } = supportres;
                if (element == -2) element = this._getFrontHero(pidx).element as DiceCostType;
                const dcnt = Math.min(diceLen, cnt);
                tmpDice[element] += dcnt;
                diceLen -= dcnt;
                player.rollCnt += addRollCnt;
            }
        }
        for (let i = 0; i < diceLen - scnt; ++i) {
            if (this.isDev) ++tmpDice[DICE_COST_TYPE.Omni];
            else ++tmpDice[this._randomInArr(Object.values(DICE_COST_TYPE))[0]];
        }
        const ndices: DiceCostType[] = [];
        const effDice = (d: DiceCostType) => d == DICE_COST_TYPE.Omni ? 2 : +player.heros.map(h => h.element).includes(d);
        const restDice = objToArr(tmpDice).filter(([, v]) => v > 0).sort((a, b) => {
            return effDice(b[0]) - effDice(a[0]) || b[1] - a[1] || DICE_WEIGHT.indexOf(a[0]) - DICE_WEIGHT.indexOf(b[0])
        });
        for (const idx in restDice) {
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
    private _reroll(diceSelect: boolean[], pidx: number, flag: string, socket?: Socket) {
        const player = this.players[pidx];
        if (player.rollCnt <= 0 || !player.UI.showRerollBtn) return;
        player.dice = this._rollDice(pidx, diceSelect);
        this._writeLog(player.dice.reduce((a, c) => a + `[${ELEMENT_NAME[c].replace('元素', '')}]`, `[${player.name}](${player.pidx})重投骰子后`), 'system');
        if (--player.rollCnt <= 0) {
            player.UI.showRerollBtn = false;
            this.delay(800, async () => {
                if (this.phase == PHASE.ACTION) { // 行动阶段重投
                    player.phase = PHASE.ACTION;
                    this.emit(`${flag}-action`, pidx, { isQuickAction: true });
                } else { // 每回合开始时重投
                    player.phase = PHASE.ACTION_START;
                    if (this.players.every(p => p.phase == PHASE.ACTION_START)) { // 双方都重投完骰子
                        this._doReset();
                        await this.delay(1e3);
                        await this._doPhaseStart(flag, pidx);
                    } else if (player.id != AI_ID) {
                        this.emit(`${flag}-finish`, pidx, { socket });
                    }
                }
            });
        }
        this.emit(flag, pidx, { socket });
    }
    /**
     * 调和骰子
     * @param pidx 玩家序号
     * @param diceSelect 骰子数组
     * @param cardIdx 要调和的卡牌序号
     * @param flag flag
     * @param socket socket
     */
    private async _reconcile(pidx: number, diceSelect: boolean[], cardIdx: number, flag: string, socket?: Socket) {
        if (diceSelect.indexOf(true) == -1) return this.emit('reconcileDiceError', pidx, { socket, tip: '骰子不符合要求' });
        const player = this.players[pidx];
        const currCard = player.handCards[cardIdx];
        const reconcileDice = this._getFrontHero(pidx).element as DiceCostType;
        if (player.dice.every(d => d == DICE_COST_TYPE.Omni || d == reconcileDice)) return this.emit('reconcileDiceError', pidx, { socket, tip: '没有可以调和的骰子' });
        if (currCard.hasTag(CARD_TAG.NonReconcile)) return this.emit('reconcileCardError', pidx, { socket, tip: '该卡牌不能调和' });
        this._detectStatus(pidx, STATUS_TYPE.Usage, 'reconcile', { hcard: currCard, isQuickAction: true });
        this._detectSupport(pidx, 'reconcile', { isQuickAction: true });
        player.dice = player.dice.map((d, di) => diceSelect[di] ? reconcileDice : d);
        player.dice = this._rollDice(pidx);
        player.handCards = player.handCards.filter((_, ci) => ci != cardIdx);
        ++player.playerInfo.reconcileCnt;
        this._writeLog(`[${player.name}](${player.pidx})【p${player.pidx}:将[${currCard.name}]】进行了调和`, 'info');
        this._doActionAfter(pidx);
        this.emit(flag, pidx, { isActionInfo: true });
        await this.delay(1100);
        await this._execTask();
        await this._doActionStart(pidx);
    }
    /**
     * 选择骰子
     * @param player 选骰玩家
     * @param costType 骰子类型
     * @param elDiceCnt 有色骰数量
     * @param anyDiceCnt 任意骰数量
     * @returns 选择骰子的数组
     */
    private _selectDice(player: Player, costType: CostType, elDiceCnt: number, anyDiceCnt: number) {
        const diceLen = player.dice.length;
        const diceSelect: boolean[] = new Array(diceLen).fill(false);
        const diceCnt = arrToObj<DiceCostType, number>(Object.values(DICE_COST_TYPE), 0);
        player.dice.forEach(d => ++diceCnt[d]);
        if (costType == COST_TYPE.Any) {
            anyDiceCnt = elDiceCnt;
            elDiceCnt = 0;
        }
        const heroEle = player.heros.filter(h => h.element != ELEMENT_TYPE.Physical && h.hp > 0).map(h => h.element) as DiceCostType[];
        const frontEle = this._getFrontHero(player.pidx).element as DiceCostType;
        if (costType == COST_TYPE.Same && elDiceCnt > 0) {
            let maxDice: DiceCostType | null = null;
            const weight = (el: DiceCostType, cnt = 0) => {
                return +(el == DICE_COST_TYPE.Omni) * 1000
                    + +(el == frontEle) * 500
                    + +heroEle.includes(el) * 400
                    - +(cnt == elDiceCnt) * 300
                    - cnt * 10
                    - DICE_WEIGHT.indexOf(el);
            };
            const omniCnt = player.dice.filter(d => d == DICE_COST_TYPE.Omni).length;
            const diceCnts = objToArr(diceCnt).filter(([el, cnt]) => cnt > 0 && el != DICE_COST_TYPE.Omni).sort((a, b) => weight(...a) - weight(...b));
            const dice1 = diceCnts.find(([el]) => !heroEle.includes(el));
            if (dice1 && dice1[1] + omniCnt >= elDiceCnt) maxDice = dice1[0];
            else {
                const dice2 = diceCnts.find(([el]) => heroEle.includes(el));
                if (dice2 && dice2[1] + omniCnt >= elDiceCnt) maxDice = dice2[0];
                else maxDice = DICE_COST_TYPE.Omni;
            }
            const dices = player.dice.map((d, di) => [d, di] as const).sort(([a], [b]) => weight(a, diceCnt[a]) - weight(b, diceCnt[a]));
            for (const [el, didx] of dices) {
                if (el != maxDice && el != DICE_COST_TYPE.Omni) continue;
                if (elDiceCnt-- <= 0) break;
                diceSelect[didx] = true;
            }
        } else {
            const weight = (el: DiceCostType) => {
                return +(el == DICE_COST_TYPE.Omni) * 900
                    + +(el == costType || el == frontEle) * 400
                    + +heroEle.includes(el) * 300
                    + diceCnt[el] * 10
                    - DICE_WEIGHT.indexOf(el);
            };
            const dices = player.dice.map((d, di) => [d, di] as const).sort(([a], [b]) => weight(a) - weight(b));
            for (const [dice, didx] of dices) {
                if (anyDiceCnt-- > 0) diceSelect[didx] = true;
                else if (elDiceCnt > 0) {
                    const selected = dice == costType || dice == DICE_COST_TYPE.Omni;
                    diceSelect[didx] = selected;
                    if (selected) --elDiceCnt;
                } else break;
            }
        }
        return diceSelect;
    }
    /**
     * 默认选择技能的骰子
     * @param pidx 玩家序号
     * @param skid 技能id
     * @param isSwitch 切换的角色序号
     * @returns 选择骰子情况的数组
     */
    private _checkSkill(pidx: number, skid: number, isForbidden: boolean = true, isSwitch: number = -1) {
        const player = this.players[pidx];
        if (isForbidden) return new Array(player.dice.length).fill(false);
        const skill = this._calcSkillChange(pidx, player.hidx, { isSwitch, skid });
        if (!skill) return player.dice.map(() => false);
        let anyDiceCnt = skill.cost[1].cnt - skill.costChange[1];
        let { cnt: elementDiceCnt, type: costType } = skill.cost[0];
        elementDiceCnt -= skill.costChange[0];
        return this._selectDice(player, costType, elementDiceCnt, anyDiceCnt);
    }
    /**
     * 使用技能
     * @param pidx 玩家序号
     * @param skid 技能id/技能类型 -1切换角色 -2使用卡/召唤物造成伤害
     * @param options.isPreview 是否为预览
     * @param options.withCard 是否为使用卡
     * @param options.isSwitch 是否切换角色
     * @param options.isReadySkill 是否为准备技能
     * @param options.otriggers 触发数组(出牌或切换角色)
     * @param options.willDamages 使用卡/召唤物造成的伤害
     * @param options.dmgElements 使用卡/召唤物造成的伤害元素
     * @param options.isSummon 是否为召唤物预览
     * @param options.atkedIdxs 受伤角色序号
     * @param options.players 玩家数组
     * @param options.selectSummon 使用技能时选择的召唤物序号
     * @param options.supportCnt 支援物预览增减
     * @param options.pickSummon 挑选的召唤物
     * @param options.isPickCard 是否为挑选卡牌
     * @param options.isQuickAction 是否为快速行动
     * @param options.tasks 切换角色前生成的攻击任务(如弃弹头)
     * @param options.willHeals 使用卡/召唤物回血
     * @param options.selectHero 使用技能时选择的角色序号
     * @param options.isChargedAtk 是否为重击
     */
    private _useSkill(pidx: number, skid: number | SkillType, options: {
        isPreview?: boolean, withCard?: Card, isSwitch?: number, isReadySkill?: boolean, otriggers?: Trigger | Trigger[],
        willDamages?: number[][][], dmgElements?: DamageType[], isSummon?: number, atkedIdxs?: number[], players?: Player[],
        selectSummon?: number, supportCnt?: number[][], pickSummon?: Summon[], isPickCard?: boolean, isQuickAction?: boolean,
        tasks?: AtkTask[], willHeals?: number[][], selectHero?: number, isChargedAtk?: boolean,
    } = {}) {
        const { isPreview, withCard, isSwitch = -1, isReadySkill, otriggers = [],
            willDamages, dmgElements, willHeals, isSummon = -1, atkedIdxs, players: cplayers = this.players,
            selectSummon = -1, supportCnt = INIT_SUPPORTCNT(), pickSummon, isPickCard, tasks: pretasks,
            selectHero = -1,
        } = options;
        let isExec = !isPreview || !!isReadySkill;
        const epidx = pidx ^ 1;
        const oplayers = clone(cplayers);
        const players = clone(cplayers);
        const player = () => players[pidx];
        const opponent = () => players[epidx];
        const aHeros = () => player().heros;
        const ahlen = aHeros().length;
        const eHeros = () => opponent().heros;
        const ehlen = eHeros().length;
        const aSummons = () => player().summons;
        const ahidx = () => player().hidx;
        const ohidx = oplayers[pidx].hidx;
        const ehidx = () => opponent().hidx;
        const aCombatStatus = () => player().combatStatus;
        const odmgedHidx = ehidx();
        let cahidx = ahidx();
        let cehidx = ehidx();
        let dmgedHidx = atkedIdxs?.[0] ?? odmgedHidx;
        if (!isExec && withCard?.type == CARD_TYPE.Equipment && withCard.hasSubtype(CARD_SUBTYPE.Talent)) {
            aHeros()[ahidx()].talentSlot = withCard;
        }
        let { isQuickAction = false, isChargedAtk = player().dice.length % 2 == 0 } = options;
        // 判断准备技能和切换角色的技能
        let skill = this._calcSkillChange(pidx, cahidx, { isReadySkill, isSwitch, skid, players, isExec, isChargedAtk });
        if (skill) skid = skill.id;
        const willAttachPre: PureElementType[][] = players.flatMap(p => Array.from({ length: p.heros.length }, () => []));
        const skillcmds: Cmds[] = [];
        // const isChargedAtk = skill?.type == SKILL_TYPE.Normal && ((player().dice.length + (!isPreview ? (withCard ? withCard.cost + withCard.anydice - withCard.costChange : skill.cost[0].cnt + skill.cost[1].cnt - skill.costChange[0] - skill.costChange[1]) : 0)) % 2) == 0;
        const isFallAtk = skill?.type == SKILL_TYPE.Normal && (player().isFallAtk || isSwitch > -1);
        const reviveCnt = players.map(p => {
            return p.heros.map(h => {
                return this._getHeroField(p.pidx, { players, hidx: h.hidx }).map(s => {
                    if ('group' in s) return s?.handle(s, { trigger: 'will-killed' }).cmds?.find(({ cmd }) => cmd == 'revive')?.cnt ?? -1;
                    return s?.handle(s, { trigger: 'will-killed' }).execmds?.find(({ cmd }) => cmd == 'revive')?.cnt ?? -1;
                }).filter(v => v > 0);
            });
        });
        const reviveTriggeredCnt = players.map(p => p.heros.map(() => 0));
        const aElTips: [string, PureElementType, PureElementType][] = Array.from({ length: ahlen + ehlen }, () => ['', ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Cryo]);
        const aDmgElements: DamageType[] = new Array(ehlen + ahlen).fill(DAMAGE_TYPE.Physical);
        const aWillAttach: PureElementType[][] = clone(willAttachPre);
        const aWillDamages: number[][] = new Array(ahlen + ehlen).fill(0).map(() => [-1, 0]);
        const aWillHeal: number[] = willHeals ?? new Array(ahlen + ehlen).fill(-1);
        const willSwitch: boolean[][] = players.map(p => p.heros.map(() => false));
        const bWillAttach: PureElementType[][] = Array.from({ length: ahlen + ehlen }, () => []);
        const bWillDamages: number[][][] = [];
        const bWillHeal: number[] = new Array(ahlen + ehlen).fill(-1);
        let willHp: (number | undefined)[] = new Array(ahlen + ehlen).fill(undefined);
        const willKill = new Array(ahlen + ehlen).fill(0);
        const summonCnt: number[][] = INIT_SUMMONCNT();
        const energyCnt: number[][] = players.map(p => p.heros.map(() => 0));
        const willSummons: Summon[][] = [[], []];
        const selectSummonInvalid = skill && skill.canSelectSummon != -1 && selectSummon == -1;
        const selectHeroInvalid = skill && skill.canSelectHero != -1 && selectHero == -1;
        const nonAction = player().heros[isSwitch > -1 ? isSwitch : cahidx].heroStatus.some(s => s.hasType(STATUS_TYPE.NonAction));
        const invalidInfo = { flag: '', tip: '' };
        const res = {
            willHp, willAttachs: bWillAttach, elTips: aElTips, dmgElements: aDmgElements, willHeal: aWillHeal, players,
            summonCnt, supportCnt, willSummons, willSwitch, willDamages: aWillDamages, energyCnt, tarHidx: -1, invalidInfo,
        };
        if (skill && (selectSummonInvalid || selectHeroInvalid || nonAction)) {
            if (isExec) {
                if (selectSummonInvalid) res.invalidInfo = { flag: 'useSkillSelectSummonInvalid', tip: '未选择召唤物' };
                if (selectHeroInvalid) res.invalidInfo = { flag: 'useSkillSelectHeroInvalid', tip: '未选择角色' };
                if (nonAction) {
                    this.delay(0, async () => {
                        await this._execTask();
                        this._doActionAfter(pidx, isQuickAction);
                        await this._execTask();
                        await this._changeTurn(pidx, isQuickAction, 'useSkill');
                        await this._execTask();
                    });
                }
            }
            return res;
        }
        const calcTasks = (tasks: AtkTask[], cplayers: Player[], cpidx: number) => {
            tasks.some(task => {
                const { cmds: [{ cmd }], cmds, pidx: tpidx } = task;
                if (!['attack', 'heal'].includes(cmd)) return false;
                return calcAtk(cplayers, { cmds }, cmd, -1, -1, +(tpidx == cpidx));
            });
        }
        const calcAtk = (oplayers: Player[], res: CalcAtkRes, type: string, stsId: number, skid = -1, isSelf = 0) => {
            if (res.element == DICE_COST_TYPE.Omni) return false;
            const cpidx = pidx ^ +!isSelf;
            const atkcmds: Cmds[] = [...(res?.cmds ?? []), ...(res?.execmds ?? []), ...(isCdt(type != 'summon', () => res.exec?.()?.cmds) ?? [])];
            res.isSelf ??= !(atkcmds[0]?.isOppo ?? true);
            const dmgedHlen = +!!res.isSelf ^ isSelf ? ehlen : ahlen;
            const atkHidx = isSelf ? cahidx : cehidx;
            if (res.heal && type != 'summon') {
                const { willHeals: whl } = this._doCmds(cpidx, [{ cmd: 'heal', cnt: res.heal, hidxs: res.hidxs ?? [atkHidx] }], {
                    players: oplayers,
                    isAction: !isQuickAction,
                    supportCnt,
                    isExec: false,
                });
                mergeWillHeals(bWillHeal, whl?.[0], oplayers);
            }
            const { willHeals: whl, aWillDamages: smndmg, atkedIdxs, tasks = [] } = this._doCmds(cpidx, atkcmds, {
                hidxs: [atkHidx],
                players: oplayers,
                isAction: !isQuickAction,
                supportCnt,
                willSwitch,
                energyCnt,
                isSummon: isCdt(type == 'summon', stsId),
                isExec: false,
                isOnlyGetWillDamages: true,
                heal: res.heal,
                damages: res.damages,
            });
            mergeWillHeals(bWillHeal, whl?.[0], oplayers);
            const dmgedHidxs = atkedIdxs ?? [+!!res.isSelf ^ isSelf ? cehidx : cahidx];
            const dmgEl = atkcmds[0]?.element;
            calcTasks(tasks, oplayers, cpidx);
            oplayers.forEach(p => {
                p.heros.forEach(h => {
                    h.heroStatus.forEach(s => {
                        if (s.useCnt == 0 && !s.hasType(STATUS_TYPE.Accumulate)) {
                            const { bWillHeals: sdhl } = this._detectStatus(p.pidx, STATUS_TYPE.Usage, 'status-destroy',
                                { hidxs: allHidxs(p.heros), source: s.id, sourceHidx: h.hidx, isExec: false, isOnlyExec: true });
                            mergeWillHeals(bWillHeal, sdhl, oplayers);
                        }
                    });
                });
            });
            if (dmgEl) res.element = dmgEl as DamageType;
            if (res.damage == undefined && res.pdmg == undefined && !smndmg) return false;
            const reshidxs = res.hidxs ?? getBackHidxs(oplayers[cpidx ^ +!!res.isSelf].heros);
            const willDamages = smndmg ?? [new Array(dmgedHlen).fill(0).map<number[]>((_, i) => [
                i == dmgedHidxs[0] ? (res.damage ?? -1) : -1,
                reshidxs.includes(i) ? (res.pdmg ?? 0) : 0
            ])];
            let isKilled = false;
            willDamages.forEach((wdmgs, wi) => {
                const { willDamages: willDamage3, willAttachs: willAttachs3, players: players3,
                    etriggers: etriggers3, atriggers: atriggers3, tasks: tasks3 } = this._calcDamage(
                        cpidx,
                        (res.element ?? DAMAGE_TYPE.Physical) as DamageType,
                        wdmgs,
                        dmgedHidxs[wi],
                        oplayers,
                        {
                            isExec: false,
                            skid,
                            isAtkSelf: +!!res.isSelf,
                            supportCnt,
                            energyCnt,
                            willSwitch,
                            isSummon: isCdt(type == 'summon', stsId),
                            atkId: stsId,
                        }
                    );
                if (type.includes('Status')) {
                    let obj: Status | undefined;
                    if (type == 'combatStatus') obj = players3[cpidx].combatStatus.find(sts3 => sts3.id == stsId);
                    else if (type == 'heroStatus') obj = players3[cpidx].heros[isSelf ? cahidx : cehidx].heroStatus.find(sts3 => sts3.id == stsId);
                    res.exec?.(obj, { heros: players3[cpidx].heros, eheros: players3[cpidx ^ 1].heros });
                }
                players3.forEach(p => {
                    p.heros.forEach(h => {
                        if (h.hp > 0) {
                            const killedHp = h.hp - willDamage3[p.pidx * players3[0].heros.length + h.hidx].reduce((a, b) => a + Math.max(0, b), 0);
                            if (killedHp < 0) willKill[p.pidx * players3[0].heros.length + h.hidx] = killedHp - h.hp;
                            h.hp = Math.max(0, killedHp);
                            if (h.hp == 0) {
                                if (reviveCnt[p.pidx][h.hidx].length) {
                                    h.hp = reviveCnt[p.pidx][h.hidx].shift()!;
                                    reviveTriggeredCnt[p.pidx][h.hidx] = h.hp;
                                } else isKilled = true;
                            }
                        }
                    });
                });
                assgin(oplayers, players3);
                const nahidx = oplayers[pidx].hidx;
                const isSwitchSelf = nahidx != cahidx;
                const nehidx = oplayers[pidx ^ 1].hidx;
                const isSwitchOppo = nehidx != cehidx;
                const oahidx = cahidx;
                const oehidx = cehidx;
                cahidx = nahidx;
                cehidx = nehidx;
                for (let i = 0; i < dmgedHlen; ++i) {
                    const willAttachs = willAttachs3[i];
                    if (willAttachs == undefined) continue;
                    bWillAttach[i + (cpidx ^ +!res.isSelf) * (isSelf ? ehlen : ahlen)].push(willAttachs);
                }
                bWillDamages.push(willDamage3);
                calcTasks(tasks3, oplayers, cpidx);
                let { isPreviewEnd } = doPreviewHfield(oplayers, this._getHeroField(pidx, { players: oplayers, hidx: oahidx, isOnlyHeroStatus: true }), oahidx, STATUS_GROUP.heroStatus, ['status-destroy', ...atriggers3[oahidx], ...(isSwitchSelf ? ['switch-from' as Trigger] : [])], isExec, 1);
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(oplayers, this._getHeroField(pidx, { players: oplayers, hidx: nahidx, isOnlyHeroStatus: true }), nahidx, STATUS_GROUP.heroStatus, [...atriggers3[nahidx], ...(isSwitchSelf ? ['switch-to' as Trigger] : [])], isExec, 1));
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(oplayers, oplayers[pidx].combatStatus, nahidx, STATUS_GROUP.combatStatus, [...atriggers3[nahidx], ...(isSwitchSelf ? ['switch-from', 'switch-to', 'switch'] as Trigger[] : [])], isExec, 1));
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(oplayers, this._getHeroField(epidx, { players: oplayers, hidx: oehidx, isOnlyHeroStatus: true }), oehidx, STATUS_GROUP.heroStatus, ['status-destroy', ...etriggers3[oehidx], ...(isSwitchOppo ? ['switch-from' as Trigger] : [])], isExec));
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(oplayers, this._getHeroField(epidx, { players: oplayers, hidx: nehidx, isOnlyHeroStatus: true }), nehidx, STATUS_GROUP.heroStatus, [...etriggers3[nehidx], ...(isSwitchOppo ? ['switch-to' as Trigger] : [])], isExec));
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(oplayers, oplayers[epidx].combatStatus, nehidx, STATUS_GROUP.combatStatus, [...etriggers3[nehidx], ...(isSwitchOppo ? ['switch-from', 'switch-to', 'switch'] as Trigger[] : [])], isExec));
            });
            return isKilled;
        }
        const doPreviewHfield = (oplayers: Player[], ohfield: (Status | Card)[], hi: number, group: StatusGroup, trgs: Trigger[], isExec: boolean, isSelf = 0, notDetectSkill = false) => {
            const hfields = clone(ohfield);
            const cpidx = pidx ^ +!isSelf;
            const chidx = isSelf ? cahidx : cehidx;
            if (isSelf) {
                oplayers[pidx].hidx = cahidx;
                oplayers[pidx].heros.forEach(h => h.isFront = h.hidx == cahidx);
            } else {
                oplayers[pidx ^ 1].hidx = cehidx;
                oplayers[pidx ^ 1].heros.forEach(h => h.isFront = h.hidx == cehidx);
            }
            trgs = trgs.filter(t => !t.startsWith('other-skill'));
            const afterAndSwitchTrgs = trgs.filter(t => /^after|switch/.test(t));
            if (group == STATUS_GROUP.heroStatus && !notDetectSkill) {
                this._detectSkill(cpidx, afterAndSwitchTrgs, { players: oplayers, energyCnt, hidxs: chidx, isExec });
            }
            if (group == STATUS_GROUP.combatStatus) {
                this._detectSupport(cpidx, afterAndSwitchTrgs, { players: oplayers, supportCnt, energyCnt, hidx: chidx, isExec });
            }
            const atkStatus: [StatusTask, boolean?][] = [];
            let isPreviewEnd: boolean = false;
            preview_end: for (const hfield of hfields) {
                const isSts = 'group' in hfield;
                if (isSts && hfield.useCnt == 0 && !hfield.hasType(STATUS_TYPE.Shield, STATUS_TYPE.Accumulate)) continue;
                for (const state of trgs) {
                    const fieldres = hfield.handle(hfield as any, {
                        heros: oplayers[cpidx].heros,
                        hero: oplayers[cpidx].heros[hi],
                        combatStatus: oplayers[cpidx].combatStatus,
                        summons: oplayers[cpidx].summons,
                        eheros: oplayers[cpidx ^ 1].heros,
                        eCombatStatus: oplayers[cpidx ^ 1].combatStatus,
                        hidx: hi,
                        sktype: skill?.type,
                        skid,
                        trigger: state,
                        dmgedHidx: cehidx,
                        hasDmg: aWillDamages[chidx + cpidx * oplayers[0].heros.length][0] > 0,
                        isChargedAtk: isSelf ? isChargedAtk : false,
                        talent: isCdt(!isExec && withCard?.id == getTalentIdByHid(getHidById(hfield.id)), withCard) ??
                            getObjById(oplayers[cpidx].heros, getHidById(hfield.id))?.talentSlot,
                        isExec,
                        randomInt: this._randomInt.bind(this),
                    });
                    const isSelfAtk = +('isSelf' in fieldres && !!fieldres.isSelf);
                    if (this._hasNotTriggered(fieldres.trigger, state)) continue;
                    if (fieldres.summon) this._updateSummon(cpidx, this._getSummonById(fieldres.summon), oplayers, isExec, { supportCnt });
                    const isStsRes = 'damage' in fieldres || 'heal' in fieldres || 'pdmg' in fieldres;
                    if (!isSts || hfield.hasType(STATUS_TYPE.Attack) && isStsRes && (fieldres.damage || fieldres.pdmg || fieldres.heal)) {
                        if (isExec && /after|elReaction|getdmg/i.test(state) && isSts) {
                            atkStatus.push([{
                                id: hfield.id,
                                name: hfield.name,
                                entityId: hfield.entityId,
                                group,
                                pidx: cpidx,
                                isSelf: isSelfAtk,
                                trigger: state,
                                hidx: hi,
                                skid,
                            }, state == 'getdmg']);
                        }
                        if (!isStsRes) fieldres.element = undefined;
                        if (state == 'status-destroy' && group == STATUS_GROUP.heroStatus) {
                            oplayers[cpidx].heros[hi].heroStatus.splice(oplayers[cpidx].heros[hi].heroStatus.findIndex(s => s.entityId == hfield.entityId), 1);
                        }
                        if (fieldres.notPreview || calcAtk(oplayers, fieldres, isSts ? ['hero', 'combat'][group] + 'Status' : 'slot', hfield.id, skid, isSelf)) {
                            isPreviewEnd = true;
                            break preview_end;
                        }
                    }
                }
            }
            return { atkStatus, isPreviewEnd }
        }
        if (!isExec && pretasks?.length) calcTasks(pretasks, players, pidx);
        if (isSwitch > -1 && !isExec) { // 切换角色后的协同攻击预览
            cahidx = isSwitch;
            let { isPreviewEnd } = doPreviewHfield(players, this._getHeroField(pidx, { players, hidx: ahidx(), isOnlyHeroStatus: true }), ahidx(), STATUS_GROUP.heroStatus, ['switch-from'], false, 1);
            if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(players, this._getHeroField(pidx, { players, hidx: cahidx, isOnlyHeroStatus: true }), cahidx, STATUS_GROUP.heroStatus, ['switch-to'], false, 1));
            if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(players, player().combatStatus, ohidx, STATUS_GROUP.combatStatus, ['switch-from', 'switch'], false, 1));
            if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(players, player().combatStatus, cahidx, STATUS_GROUP.combatStatus, ['switch-to'], false, 1));
        }
        skill = this._calcSkillChange(pidx, cahidx, { isReadySkill, skid, players, isExec, isChargedAtk });
        isChargedAtk &&= skill?.type == SKILL_TYPE.Normal;
        if (skill) skid = skill.id;
        const hero = aHeros()[cahidx];
        const skillres = skill?.handle({
            skill,
            hero,
            heros: aHeros(),
            combatStatus: aCombatStatus(),
            eheros: eHeros(),
            card: withCard,
            hcards: player().handCards,
            ehcards: opponent().handCards,
            summons: aSummons(),
            isChargedAtk,
            isFallAtk,
            isReadySkill,
            isExec,
            swirlEl: eHeros().find(h => h.isFront)?.attachElement?.find(el => ([ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro, ELEMENT_TYPE.Cryo] as ElementType[]).includes(el)),
            playerInfo: player().playerInfo,
            pile: player().pile,
            trigger: `skilltype${skill.type}`,
            talent: aHeros()[cahidx].talentSlot,
            selectHero,
            randomInArr: this._randomInArr.bind(this),
            getCardIds: this._getCardIds.bind(this),
        }) ?? {};
        if (isExec && skillres.pickCard) {
            if (isPickCard) {
                if (!skillres.summonPre) skillres.summonPre = [];
                if (typeof skillres.summonPre == 'number') skillres.summonPre = [skillres.summonPre];
                if (pickSummon?.length) skillres.summonPre.push(...pickSummon);
            } else {
                this._doCmds(pidx, [{
                    cmd: 'pickCard',
                    cnt: skillres.pickCard.cnt,
                    mode: skillres.pickCard.mode,
                    card: skillres.pickCard.card,
                    subtype: skillres.pickCard.subtype,
                    isAttach: skillres.pickCard.isOrdered,
                    hidxs: [skid],
                }], { isAction: !isQuickAction });
                this._execTask();
                return res;
            }
        }
        skillres.exec?.();
        const atriggers: Trigger[][] = new Array(ahlen).fill(0).map(() => []);
        const etriggers: Trigger[][] = new Array(ehlen).fill(0).map(() => []);
        mergeWillHeals(bWillHeal, aWillHeal);
        if (skillres.atkOffset != undefined) dmgedHidx = this._getFrontHero(epidx, { offset: skillres.atkOffset }).hidx;
        if (skillres.atkTo != undefined) dmgedHidx = skillres.atkTo;
        const skillreshidxs = skillres.hidxs ?? getBackHidxs(eHeros());
        const oWillDamages = willDamages ?? (skill ? [new Array(ahlen + ehlen).fill(0).map((_, di) => {
            if (di >= ehlen) {
                const ahi = di - ehlen;
                const pierceDmgOppo = (skillres.hidxs ?? [cahidx]).includes(ahi) ? (skillres.pdmgSelf ?? 0) : 0;
                return [-1, pierceDmgOppo]
            }
            const addDmg = skillres.addDmgCdt ?? 0;
            const elDmg = di == dmgedHidx && skill.damage + addDmg > 0 ? skill.damage + skill.dmgChange + addDmg : -1;
            const pierceDmg = skillreshidxs.includes(di) ? (skillres.pdmg ?? 0) : 0;
            return [elDmg, pierceDmg]
        })] : undefined);
        const { dmgElement: skiDmgEl = undefined } = skill ? this._detectSkill(pidx, 'skill', { type: [SKILL_TYPE.Passive, SKILL_TYPE.PassiveHidden], hidxs: cahidx, players, isExec }) : {};
        const dmgEl = dmgElements ?? (skill ? [skiDmgEl ?? skillres.dmgElement ?? (skill.attachElement != ELEMENT_TYPE.Physical ? skill.attachElement : skill.dmgElement)] : undefined);
        const stsprecmds: Cmds[] = [
            { cmd: 'getStatus', status: skillres.statusPre, hidxs: skillres.hidxs },
            { cmd: 'getStatus', status: skillres.statusOppoPre, hidxs: skillres.hidxs, isOppo: true },
        ];
        this._doCmds(pidx, stsprecmds, { players, ahidx: cahidx, ehidx: dmgedHidx, isAction: !isQuickAction, isExec });
        if (skillres.summonPre) this._updateSummon(pidx, this._getSummonById(skillres.summonPre), players, isExec, { supportCnt });
        const oSummonEids = players[pidx].summons.map(smn => smn.entityId);
        if (skillres.heal != undefined) {
            const { willHeals } = this._doCmds(pidx, [{ cmd: 'heal', cnt: skillres.heal, hidxs: skillres.hidxs ?? [cahidx] }], {
                players,
                isExec,
                isAction: !isQuickAction,
                supportCnt,
                source: skid,
            });
            mergeWillHeals(aWillHeal, willHeals);
        }
        if (isExec) {
            const { willHeals: skillheal } = this._doCmds(pidx, skillres.cmds, {
                players,
                isExec,
                isAction: !!skill && !isQuickAction,
            });
            mergeWillHeals(aWillHeal, skillheal);
        }
        if (skill && !isExec) {
            if (skill.cost[2].cnt == 0) energyCnt[pidx][ohidx]++;
            else if (skill.cost[2].cnt > 0) energyCnt[pidx][ohidx] -= skill.cost[2].cnt;
        }
        let ifa = false;
        const tasks0: AtkTask[] = [];
        if (dmgEl && oWillDamages) {
            oWillDamages.forEach((wdmgs, wi) => {
                const { willDamages: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1,
                    players: players1, elTips: elTips1, atriggers: atriggers1, etriggers: etriggers1,
                    aWillHeals: ahealres, bWillHeals: bhealres, isQuickAction: iqa1, isFallAtk: ifa1, tasks: tasks1,
                } = this._calcDamage(
                    pidx,
                    dmgEl[wi],
                    wdmgs,
                    atkedIdxs?.[wi] ?? dmgedHidx,
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
                        supportCnt,
                        willSwitch,
                        energyCnt,
                        isAtkSelf: +(wdmgs.slice(ehlen, ehlen + ahlen).some(([d, p]) => d >= 0 || p > 0) &&
                            wdmgs.slice(0, ehlen).every(([d, p]) => d == -1 && p == 0)),
                        isSwitch,
                        isQuickAction: !skill || isQuickAction,
                    }
                );
                dmgElements1.forEach((dmg, di) => dmg != DAMAGE_TYPE.Physical && dmg != DAMAGE_TYPE.Pierce && (aDmgElements[di] = dmg));
                elTips1.forEach((elt, elti) => elt[0] != '' && (aElTips[elti] = elt));
                for (let i = 0; i < ehlen; ++i) {
                    const willAttachs = willAttachs1[i];
                    if (willAttachs == undefined) continue;
                    aWillAttach[i + epidx * ahlen].push(willAttachs);
                }
                assgin(players, players1);
                atriggers1.forEach((at, ati) => atriggers[ati].push(...at));
                etriggers1.forEach((et, eti) => etriggers[eti].push(...et));
                isQuickAction ||= iqa1;
                ifa ||= ifa1;
                aWillHeal.forEach((_, awhi, awha) => awha[awhi] = ahealres[awhi]);
                bWillHeal.forEach((_, awhi, awha) => awha[awhi] = ahealres[awhi]);
                mergeWillHeals(bWillHeal, bhealres);
                skillcmds.push(...(skillres.cmds ?? []));
                const allHeros = players.flatMap(p => p.heros);
                willDamage1.forEach((dmg, di) => { aWillDamages[di] = allHeros[di].hp > 0 ? [...dmg] : [-1, 0] });
                tasks0.push(...tasks1);
            });
        }
        const stsaftercmds: Cmds[] = [
            { cmd: 'getStatus', status: skillres.statusAfter, hidxs: skillres.hidxs },
            { cmd: 'getStatus', status: skillres.statusOppoAfter, hidxs: skillres.hidxs, isOppo: true },
        ];
        this._doCmds(pidx, stsaftercmds, { players, ahidx: cahidx, ehidx: dmgedHidx, isAction: !isQuickAction });
        if (skillres.summon) this._updateSummon(pidx, this._getSummonById(skillres.summon), players, isExec, { supportCnt });
        if (skillres.isAttach) {
            const { elTips: elTips2 = [], willAttachs: willAttachs2 = [] } = this._doCmds(pidx,
                [{ cmd: 'attach', hidxs: [ohidx], element: oplayers[pidx].heros[ohidx].element }],
                { players, isExec, isAction: !isQuickAction, skid, sktype: skill?.type });
            for (let i = 0; i < ahlen; ++i) aElTips[i + pidx * ehlen] = elTips2[i + pidx * ehlen];
            for (let i = 0; i < ahlen; ++i) aWillAttach[i + pidx * ehlen].push(...willAttachs2[i + pidx * ehlen]);
        }
        const bPlayers = clone(players);
        bPlayers.forEach(p => {
            p.heros.forEach(h => {
                if (h.hp > 0) {
                    const killedHp = h.hp - aWillDamages[p.pidx * bPlayers[0].heros.length + h.hidx].reduce((a, b) => a + Math.max(0, b), 0);
                    if (killedHp < 0) willKill[p.pidx * bPlayers[0].heros.length + h.hidx] = killedHp - h.hp;
                    h.hp = Math.max(0, killedHp);
                    if (h.hp == 0 && reviveCnt[p.pidx][h.hidx].length) {
                        h.hp = reviveCnt[p.pidx][h.hidx].shift()!;
                        reviveTriggeredCnt[p.pidx][h.hidx] = h.hp;
                    }
                }
            });
        });
        const hfieldcmds: Cmds[] = [
            { cmd: 'equip', hidxs: skillres.hidxs ?? [hero.hidx], card: skillres.equip },
            { cmd: 'getStatus', status: skillres.status, hidxs: skillres.hidxs },
            { cmd: 'getStatus', status: skillres.statusOppo, hidxs: skillres.hidxs, isOppo: true },
        ];
        this._doCmds(pidx, hfieldcmds, { players, ahidx: cahidx, ehidx: dmgedHidx, isExec, isAction: !isQuickAction });
        const tarHidx = aWillDamages.slice(epidx * ahlen, epidx * ahlen + ehlen).some(([d, p]) => d > -1 || p > 0) ? dmgedHidx : -1;
        if (skill && isExec) {
            players[pidx].isFallAtk = ifa;
            players[pidx].canAction = false;
            this.taskQueue.addTask(`useSkill-${skill.name}`, [[async () => {
                assgin(this.players, players);
                this._writeLog(`[${player().name}](${player().pidx})[${aHeros()[player().hidx].name}]使用了[${SKILL_TYPE_NAME[skill.type]}][${skill.name}]`, 'info');
                const energyCmds: Cmds[] = [];
                if (skill.cost[2].cnt == 0) energyCmds.push({ cmd: 'getEnergy', cnt: 1 });
                else if (skill.cost[2].cnt > 0) energyCmds.push({ cmd: 'getEnergy', cnt: -skill.cost[2].cnt });
                if (skillres.energy) energyCmds.push({ cmd: 'getEnergy', cnt: skillres.energy });
                const isVehicle = skill.type == SKILL_TYPE.Vehicle;
                const atkHidx = aHeros()[player().hidx].hidx;
                await this._doDamage(pidx, {
                    dmgSource: 'skill',
                    atkPidx: pidx,
                    atkHidx: isVehicle ? -1 : atkHidx,
                    tarHidx,
                    willDamages: aWillDamages,
                    dmgElements: aDmgElements,
                    elTips: aElTips,
                    willHeals: aWillHeal,
                }, {
                    atkname: skill.name,
                    skid,
                    cmds: energyCmds,
                    slotSelect: isCdt(isVehicle, [pidx, atkHidx, SLOT_CODE.Vehicle]),
                    heroSelect: isCdt(tarHidx == -1, [pidx, ahidx()]),
                    actionInfo: {
                        avatar: hero.UI.avatar,
                        content: skill.name,
                        subContent: SKILL_TYPE_NAME[skill.type],
                    }
                });
            }]], { isPriority: true, isUnshift: true });
        }
        const { willHeals: skillheal, tasks = [] }
            = this._doCmds(pidx, skillcmds, {
                players: bPlayers,
                isExec: false,
                isAction: !!skill && !isQuickAction,
                supportCnt,
                willSwitch,
                energyCnt,
            });
        mergeWillHeals(bWillHeal, skillheal);
        const dtriggers: Trigger[] = [];
        if (typeof otriggers == 'string') dtriggers.push(otriggers);
        else dtriggers.push(...otriggers);
        cahidx = skid == -1 && dtriggers.includes('switch-to') ? isSwitch : bPlayers[pidx].hidx;
        cehidx = bPlayers[pidx ^ 1].hidx;
        dmgedHidx = cehidx;
        tasks.push(...tasks0);
        if (!isExec) {
            mergeWillHeals(aWillHeal, skillheal);
            calcTasks(tasks, bPlayers, pidx);
        }
        bWillAttach.forEach((a, i) => a.push(...aWillAttach[i]));
        bWillDamages.push(aWillDamages);
        const [afterASkillTrgs, afterESkillTrgs] = [atriggers, etriggers]
            .map(xtrgs => xtrgs.map(trgs => trgs
                .filter(trg => /skill|elReaction|getdmg/i.test(trg))
                .map(trg => trg.startsWith('skill') ? 'after-' + trg : trg.startsWith('after-') ? trg.slice(6) : trg) as Trigger[])
            );
        const atkStatues: StatusTask[] = [];
        const atkStatuesUnshift: StatusTask[] = [];
        for (let i = 0; i < ahlen; ++i) {
            const hi = (ohidx + i) % ahlen;
            this._detectSkill(pidx, afterASkillTrgs[hi], {
                isExec,
                hidxs: hi,
                dmg: aWillDamages.slice(epidx * ahlen, epidx * ahlen + ehlen).map(d => Math.max(0, d[0]) + d[1]),
            });
            afterASkillTrgs[hi].push('status-destroy');
            const { atkStatus: atkhst, isPreviewEnd } = doPreviewHfield(bPlayers, this._getHeroField(pidx, { players: bPlayers, hidx: hi, isOnlyHeroStatus: true }), hi, STATUS_GROUP.heroStatus, afterASkillTrgs[hi], isExec, 1, true);
            if (isPreviewEnd) break;
            atkhst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
            if (i == 0) {
                if (afterASkillTrgs[hi].includes('other-skill')) afterASkillTrgs[hi].push('after-skill');
                const { atkStatus: atkcst, isPreviewEnd } = doPreviewHfield(bPlayers, bPlayers[pidx].combatStatus, hi, STATUS_GROUP.combatStatus, afterASkillTrgs[hi], isExec, 1);
                atkcst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
                if (isPreviewEnd) break;
            }
        }
        for (let i = 0; i < ehlen; ++i) {
            const hi = (cehidx + i) % ehlen;
            const h = bPlayers[epidx].heros[hi];
            if (h.hp > 0) {
                afterESkillTrgs[hi].push('status-destroy');
                const { atkStatus: atkhst, isPreviewEnd } = doPreviewHfield(bPlayers, this._getHeroField(epidx, { players: bPlayers, hidx: hi, isOnlyHeroStatus: true }), hi, STATUS_GROUP.heroStatus, afterESkillTrgs[hi], isExec);
                atkhst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
                if (isPreviewEnd) break;
            }
            if (i == 0) {
                const { atkStatus: atkcst, isPreviewEnd } = doPreviewHfield(bPlayers, bPlayers[epidx].combatStatus, hi, STATUS_GROUP.combatStatus, afterESkillTrgs[hi], isExec);
                atkcst.forEach(([task, isUnshift]) => (isUnshift ? atkStatuesUnshift : atkStatues).push(task));
                if (isPreviewEnd) break;
            }
        }
        if (isExec) {
            this.taskQueue.addStatusAtk(atkStatues);
            this.taskQueue.addStatusAtk(atkStatuesUnshift.reverse(), { isUnshift: true });
        }
        if (skill) {
            const [_afterAOnlySkillTrgs, afterEOnlySkillTrgs] = [atriggers, etriggers]
                .map(xtrgs => xtrgs.map(trgs => trgs.filter(trg => trg.startsWith('skill')).map(trg => ('after-' + trg)) as Trigger[]));
            for (let i = 0; i < ehlen; ++i) {
                const hidxs = (dmgedHidx + i) % ehlen;
                const slotres = this._detectSlot(epidx, afterEOnlySkillTrgs[hidxs], { hidxs, players: bPlayers, isExec });
                mergeWillHeals(bWillHeal, slotres.willHeals, bPlayers);
            }
        }
        for (const smn of (isExec ? players : bPlayers)[pidx].summons) {
            if (!oSummonEids.includes(smn.entityId) || (selectSummon != -1 && (bPlayers[pidx].summons[selectSummon] ?? bPlayers[pidx].summons.find(s => s.id == selectSummon))?.entityId != smn.entityId)) continue;
            const strigger = [...dtriggers, ...(skillres.summonTrigger ?? [])];
            if (skill && skill.type != SKILL_TYPE.Vehicle) strigger.push(`after-skilltype${skill.type}`, 'after-skill')
            strigger.forEach(trg => {
                const trounds = [0];
                if (isExec) this._detectSummon(pidx, trg, { csummon: [smn], skid, players, atkHidx: ohidx, isQuickAction });
                while (trounds.length && !isExec) {
                    const tround = trounds.pop();
                    const { smnres } = this._detectSummon(pidx, trg, { csummon: [smn], players: bPlayers, skid, atkHidx: ohidx, tround, hcard: withCard, isExec: false });
                    const { cmds } = smnres?.exec?.({ summon: smn, heros: bPlayers[pidx].heros, combatStatus: bPlayers[pidx].combatStatus, eCombatStatus: bPlayers[epidx].combatStatus }) ?? {};
                    if (smnres) {
                        const damages: SmnDamageHandle = (isOppo: boolean = true, cnt?: number, element?: DamageType, hidxs?: number[]) => {
                            const dmgElement = element ?? smn.element;
                            return {
                                dmgElement,
                                willDamages: new Array(isOppo ? ehlen : ahlen).fill(0).map((_, i) => [
                                    (hidxs ?? [isOppo ? ehidx() : ahidx()]).includes(i) && dmgElement != DAMAGE_TYPE.Pierce ? (cnt ?? smn.damage ?? -1) : -1,
                                    (hidxs ?? getBackHidxs(bPlayers[epidx].heros)).includes(i) ? element == DAMAGE_TYPE.Pierce ? (cnt ?? 0) : smn.pdmg : 0,
                                ]),
                            }
                        }
                        calcAtk(bPlayers, {
                            ...smnres,
                            element: smn.element,
                            heal: isCdt(smn.shieldOrHeal > 0, smn.shieldOrHeal),
                            cmds,
                            damages
                        }, 'summon', smn.id, skid, 1);
                        if (smnres.tround) trounds.push(smnres.tround);
                    }
                }
            });
        }

        if (!isExec) {
            let isPreviewEnd = false;
            willSwitch[epidx].filter(v => v).forEach(() => {
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(bPlayers, this._getHeroField(epidx, { players: bPlayers, hidx: odmgedHidx, isOnlyHeroStatus: true }), odmgedHidx, STATUS_GROUP.heroStatus, ['switch-from', 'switch-to'], isExec));
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(bPlayers, bPlayers[epidx].combatStatus, odmgedHidx, STATUS_GROUP.combatStatus, ['switch-from', 'switch-to', 'switch'], isExec));
            });
            willSwitch[pidx].filter(v => v).forEach(() => {
                const triggers: Trigger[] = skid == -1 ? dtriggers : ['switch-from', 'switch-to', 'switch'];
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(bPlayers, this._getHeroField(pidx, { players: bPlayers, hidx: ahidx(), isOnlyHeroStatus: true }), ahidx(), STATUS_GROUP.heroStatus, triggers, isExec, 1));
                if (!isPreviewEnd) ({ isPreviewEnd } = doPreviewHfield(bPlayers, bPlayers[pidx].combatStatus, ahidx(), STATUS_GROUP.combatStatus, triggers, isExec, 1));
            });
            players.forEach(p => {
                p.supports.forEach((spt, spti) => {
                    if (spt.cnt < -supportCnt[p.pidx][spti]) {
                        this._doSupportDestroy(pidx, 1, { isExec, supportCnt });
                    }
                });
            });
            willHp = willHp.map((_, i) => {
                const alldamage = bWillDamages.reduce((a, b) => a + Math.max(0, b[i][0]) + Math.max(0, b[i][1]), 0);
                const hasVal = bWillDamages.some(v => v[i][0] >= 0 || v[i][1] > 0) || [-3, -1, 0].every(hl => bWillHeal[i] != hl);
                if (!hasVal) {
                    if (bWillHeal[i] == 0 || bWillHeal[i] == -3) return 100;
                    return undefined;
                }
                const res = Math.max(0, bWillHeal[i]) - alldamage;
                const whpidx = Math.floor(i / (pidx == 0 ? ehlen : ahlen));
                const whhidx = i % (pidx == 0 ? ehlen : ahlen);
                const hero = this.players[whpidx].heros[whhidx];
                if (hero.hp <= 0 && res <= 0) return undefined;
                if (res + hero.hp <= 0 && reviveTriggeredCnt[whpidx][whhidx] > 0) {
                    return reviveTriggeredCnt[whpidx][whhidx] - hero.hp - 0.3;
                }
                const isKilled = willKill[whpidx * bPlayers[0].heros.length + whhidx];
                if (isKilled < 0) return isKilled;
                return bPlayers[whpidx].heros[whhidx].hp + Math.max(0, bWillHeal[i]) - hero.hp;
            });
            willSummons[0] = bPlayers[epidx].summons.filter(wsmn => this.players[epidx].summons.every(smn => smn.id != wsmn.id))
                .map(wsmn => (wsmn.UI.isWill = true, wsmn));
            willSummons[1] = bPlayers[pidx].summons.filter(wsmn => this.players[pidx].summons.every(smn => smn.id != wsmn.id))
                .map(wsmn => {
                    const nsmn = this._getSummonById(wsmn.handle(wsmn, { skid }).willSummon)[0] ?? wsmn;
                    nsmn.UI.isWill = true;
                    return nsmn;
                });
            const nsummons = [...this._getSummonById(skillres.summonPre), ...this._getSummonById(skillres.summon)];
            summonCnt.forEach((smns, pi, smna) => {
                const osmn = oplayers[pi].summons;
                const nsmn = bPlayers[pi].summons;
                smna[pi] = smns.map((_, si) => {
                    if (osmn.length - 1 < si || (pi == pidx && nsmn[si]?.handle(nsmn[si], { skid }).willSummon)) return 0;
                    const smnCnt = getObjById(nsmn, osmn[si].id)?.useCnt ?? 0;
                    let res = smnCnt - osmn[si].useCnt;
                    if (res == 0 && pi == pidx && nsummons.some(s => s.id == nsmn[si].id)) res += 0.3;
                    return res;
                });
            });
        } else if (skid > 0) {
            this.delay(0, async () => {
                await this._execTask();
                this._doActionAfter(pidx, isQuickAction);
                await this._execTask();
                await this._changeTurn(pidx, isQuickAction, 'useSkill');
                await this._execTask();
            });
        }
        return {
            willHp, willAttachs: bWillAttach, elTips: aElTips, dmgElements: aDmgElements, willHeal: aWillHeal, energyCnt, players,
            summonCnt, supportCnt, willSummons, willSwitch, willDamages: aWillDamages, atriggers, etriggers, tarHidx, invalidInfo,
        }
    }
    /**
     * 计算伤害
     * @param pidx 发起攻击的玩家序号
     * @param dmgElement 伤害的元素附着
     * @param damages 所有角色将要受到的伤害[敌方, 我方]
     * @param dmgedHidx 受击角色索引idx
     * @param players 所有玩家信息 
     * @param options isAttach 是否为自己附着元素, isSummon 召唤物攻击id, isExec 是否执行, isSwtich 切换后攻击的角色序号
     *                isSwirl 是否为扩散伤害, isReadySkill 是否为准备技能, aWillheals 立即回血, bWillHeals 预览回血, isSwirlExec 扩散伤害是否执行,
     *                atriggers 攻击者触发时机, etriggers 受击者触发时机, skid 技能id, sktype 技能类型, hcardsCnt 当前手牌数, atkId 造成伤害来源id, 
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
     *          minusDiceSkill: 用技能减骰子
     *          isQuickAction: 是否为快速行动
     */
    private _calcDamage(
        pidx: number, dmgElement: DamageType, damages: number[][], dmgedHidx: number, oplayers: Player[],
        options: {
            isAttach?: boolean, isSummon?: number, isExec?: boolean, isSwirl?: boolean, discards?: Card[], isChargedAtk?: boolean,
            skid?: number, sktype?: SkillType, isFallAtk?: boolean, isReadySkill?: boolean, isSwirlExec?: boolean, aWillHeals?: number[],
            bWillHeals?: number[], atriggers?: Trigger[][], etriggers?: Trigger[][], usedDice?: number, atkId?: number,
            dmgElements?: DamageType[], willSwitch?: boolean[][], elTips?: [string, PureElementType, PureElementType][], hcardsCnt?: number,
            willAttachs?: (PureElementType | undefined)[], multiDmg?: number, isAtkSelf?: number, withCard?: Card, isQuickAction?: boolean,
            minusDiceSkillIds?: number[], willheals?: number[][], minusDiceSkill?: number[][], supportCnt?: number[][], isSwitch?: number,
            tasks?: AtkTask[], energyCnt?: number[][],
        } = {}) {
        const players = clone(oplayers);
        const epidx = pidx ^ 1;
        const { heros: { length: oahlen } } = players[pidx];
        const { heros: { length: oehlen } } = players[epidx];
        const { isAttach, isSummon = -1, isSwirl, isExec = true, skid = -1, isAtkSelf = 0,
            isReadySkill, sktype, minusDiceSkillIds = [], atkId, tasks = [], willSwitch, isQuickAction = false,
            aWillHeals = new Array<number>(oahlen + oehlen).fill(-1), bWillHeals = new Array<number>(oahlen + oehlen).fill(-1),
            usedDice = 0, dmgElements = new Array<DamageType>(oehlen + oahlen).fill(DAMAGE_TYPE.Physical),
            willAttachs = new Array<PureElementType | undefined>(isAttach || isAtkSelf ? oahlen : oehlen).fill(undefined), isSwitch = -1,
            elTips = new Array(oahlen + oehlen).fill(0).map(() => ['', PURE_ELEMENT_TYPE.Cryo, PURE_ELEMENT_TYPE.Cryo]), minusDiceSkill = [],
            atriggers: atrg = new Array(oahlen).fill(0).map(() => []), etriggers: etrg = new Array(oehlen).fill(0).map(() => []),
            discards = [], withCard, isChargedAtk, isFallAtk, supportCnt, energyCnt,
        } = options;
        let { multiDmg = 0 } = options;
        let willDamages = damages;
        if (!isSwirl) {
            if (willDamages.length == 0) willDamages = new Array(oahlen + oehlen).fill(0).map(() => [-1, 0]);
            else if (willDamages.length < oehlen + oahlen) {
                const admg = new Array(oahlen + oahlen - willDamages.length).fill(0).map(() => [-1, 0]);
                if (pidx ^ 1 ^ isAtkSelf) willDamages = admg.concat(willDamages);
                else willDamages = willDamages.concat(admg);
            } else if (pidx ^ 1) {
                willDamages = willDamages.slice(oehlen).concat(willDamages.slice(0, oehlen));
            }
        }
        const res = clone({
            willDamages,
            willAttachs,
            dmgElements,
            players,
            elTips,
            atriggers: atrg,
            etriggers: etrg,
            aWillHeals,
            bWillHeals,
            isQuickAction,
            isFallAtk: false,
            tasks,
        });
        const isSelf = isAtkSelf || !!isAttach;
        const { heros: aheros, summons: asummons, playerInfo } = res.players[pidx];
        const dmgedPidx = epidx ^ +isSelf;
        const atkPidx = dmgedPidx ^ 1;
        const { heros: dmgedheros, heros: { length: ehlen }, summons: esummons, handCards } = res.players[dmgedPidx];
        const { heros: { length: ahlen }, heros: atkheros } = res.players[atkPidx];
        let { hcardsCnt = handCards.length } = options;
        const dmgedfhero = dmgedheros[dmgedHidx];
        if (dmgedfhero.hp <= 0) return res;
        const getDmgIdxOffset = ehlen * dmgedPidx;
        const aGetDmgIdxOffset = ahlen * atkPidx;
        const getDmgIdx = dmgedHidx + getDmgIdxOffset;
        const atkHidx = isSwitch > -1 ? isSwitch : getAtkHidx(atkheros);
        const afhero = aheros[atkHidx];
        const atriggers: Trigger[][] = res.atriggers.map(() => []);
        const etriggers: Trigger[][] = res.etriggers.map(() => []);
        const aist: Status[][] = new Array(ahlen).fill(0).map(() => []);
        const aost: Status[] = [];
        const eist: Status[][] = new Array(ehlen).fill(0).map(() => []);
        const eost: Status[] = [];
        const trgEl: keyof typeof PURE_ELEMENT_TYPE = ELEMENT_TYPE_KEY[dmgElement];
        let swirlDmg: PureElementType | undefined;
        let isAttachElement: 'attach' | 'consume' | 'null' = 'null';
        if (dmgElement != DAMAGE_TYPE.Pierce && (res.willDamages[getDmgIdx][0] >= 0 || isAttach)) {
            const isDmgAttach = dmgElement != DAMAGE_TYPE.Physical && dmgElement != DAMAGE_TYPE.Anemo && dmgElement != DAMAGE_TYPE.Geo;
            res.dmgElements[getDmgIdx] = dmgElement;
            // 将要附着的元素
            if (isDmgAttach && !dmgedfhero.attachElement.includes(dmgElement as PureElementType)) {
                res.willAttachs[dmgedHidx] = dmgElement;
            }
            const elTypes: ElementType[] = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro];
            if ( // 没有元素反应(不含冰草共存)
                dmgedfhero.attachElement.length == 0 ||
                (dmgedfhero.attachElement as ElementType[]).includes(dmgElement) ||
                (dmgElement == DAMAGE_TYPE.Anemo || dmgElement == DAMAGE_TYPE.Geo) && !elTypes.includes(dmgedfhero.attachElement[0])
            ) {
                if (dmgedfhero.attachElement.length == 0 && isDmgAttach) {
                    isAttachElement = 'attach';
                }
            } else if (dmgElement != DAMAGE_TYPE.Physical) {
                let isElDmg = true;
                isAttachElement = 'consume';
                const [attachElement] = dmgedfhero.attachElement;
                const elTipIdx = dmgedPidx * ehlen + dmgedHidx;
                if (dmgElement == ELEMENT_TYPE.Anemo) { // 扩散
                    res.willAttachs[dmgedHidx] = dmgElement;
                    res.elTips[elTipIdx] = ['扩散', attachElement, dmgElement];
                    atriggers.forEach((trg, tri) => {
                        if (!isSelf) {
                            if (tri == atkHidx) trg.push('Swirl');
                            else trg.push('other-Swirl');
                        }
                        trg.push('Swirl-oppo');
                    });
                    etriggers.forEach((trg, tri) => {
                        if (isSelf) {
                            if (tri == dmgedHidx) trg.push('Swirl');
                            else trg.push('other-Swirl');
                        }
                        if (tri == dmgedHidx) trg.push('get-Swirl')
                    });
                    swirlDmg = attachElement;
                } else if (dmgElement == ELEMENT_TYPE.Geo) { // 结晶
                    res.willAttachs[dmgedHidx] = dmgElement;
                    ++res.willDamages[getDmgIdx][0];
                    res.elTips[elTipIdx] = ['结晶', attachElement, dmgElement];
                    atriggers.forEach((trg, tri) => {
                        if (!isSelf) {
                            if (tri == atkHidx) trg.push('Crystallize');
                            else trg.push('other-Crystallize');
                        }
                        trg.push('Crystallize-oppo');
                    });
                    etriggers.forEach((trg, tri) => {
                        if (isSelf) {
                            if (tri == dmgedHidx) trg.push('Crystallize');
                            else trg.push('other-Crystallize');
                        }
                        if (tri == dmgedHidx) trg.push('get-Crystallize')
                    });
                } else {
                    const attachType = (1 << PURE_ELEMENT_CODE[attachElement]) + (1 << PURE_ELEMENT_CODE[dmgElement]);
                    const hasEls = (el1: PureElementType, el2: PureElementType) =>
                        (attachType >> PURE_ELEMENT_CODE[el1] & 1) == 1 && (attachType >> PURE_ELEMENT_CODE[el2] & 1) == 1;
                    if (hasEls(ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Dendro)) { // 冰草共存
                        isElDmg = false;
                        dmgedfhero.attachElement = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Dendro];
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro)) { // 水火 蒸发
                        res.willDamages[getDmgIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = ['蒸发', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Vaporize');
                                else trg.push('other-Vaporize');
                            }
                            trg.push('Vaporize-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Vaporize');
                                else trg.push('other-Vaporize');
                            }
                            if (tri == dmgedHidx) trg.push('get-Vaporize')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Cryo)) { // 冰火 融化
                        res.willDamages[getDmgIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = ['融化', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Melt');
                                else trg.push('other-Melt');
                            }
                            trg.push('Melt-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Melt');
                                else trg.push('other-Melt');
                            }
                            if (tri == dmgedHidx) trg.push('get-Melt')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Electro)) { // 水雷 感电
                        if (!isAttach) {
                            for (let i = 0; i < ehlen; ++i) {
                                const dmg = res.willDamages[i + getDmgIdxOffset];
                                const idx = +(i != dmgedHidx);
                                if (dmg[idx] < 0) dmg[idx] = 0;
                                ++dmg[idx];
                            }
                        }
                        res.elTips[elTipIdx] = ['感电', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('ElectroCharged');
                                else trg.push('other-ElectroCharged');
                            }
                            trg.push('ElectroCharged-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('ElectroCharged');
                                else trg.push('other-ElectroCharged');
                            }
                            if (tri == dmgedHidx) trg.push('get-ElectroCharged')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Electro, ELEMENT_TYPE.Cryo)) { // 冰雷 超导
                        if (!isAttach) {
                            for (let i = 0; i < ehlen; ++i) {
                                const dmg = res.willDamages[i + getDmgIdxOffset];
                                const idx = +(i != dmgedHidx);
                                if (dmg[idx] < 0) dmg[idx] = 0;
                                ++dmg[idx];
                            }
                        }
                        res.elTips[elTipIdx] = ['超导', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Superconduct');
                                else trg.push('other-Superconduct');
                            }
                            trg.push('Superconduct-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Superconduct');
                                else trg.push('other-Superconduct');
                            }
                            if (tri == dmgedHidx) trg.push('get-Superconduct')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Cryo)) { // 水冰 冻结
                        res.willDamages[getDmgIdx][0] += +!isAttach;
                        eist[dmgedHidx].push(this.newStatus(106));
                        res.elTips[elTipIdx] = ['冻结', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Frozen');
                                else trg.push('other-Frozen');
                            }
                            trg.push('Frozen-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Frozen');
                                else trg.push('other-Frozen');
                            }
                            if (tri == dmgedHidx) trg.push('get-Frozen')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Dendro)) { // 水草 绽放
                        ++res.willDamages[getDmgIdx][0];
                        res.elTips[elTipIdx] = ['绽放', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Bloom');
                                else trg.push('other-Bloom');
                            }
                            trg.push('Bloom-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Bloom');
                                else trg.push('other-Bloom');
                            }
                            if (tri == dmgedHidx) trg.push('get-Bloom')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro)) { // 火雷 超载
                        res.willDamages[getDmgIdx][0] += 2;
                        if (dmgedfhero.isFront) {
                            const { isSwitch = -1, isSwitchOppo = -1 } = this._doCmds(pidx, [{ cmd: 'switch-after', isOppo: !isAtkSelf }], {
                                players: res.players,
                                isPriority: true,
                                isUnshift: true,
                                isExec,
                                energyCnt,
                                willSwitch,
                                supportCnt,
                            });
                            if (!isExec) this._detectSkill(dmgedPidx, 'switch-to', { players, isExec, hidxs: Math.max(isSwitch, isSwitchOppo), energyCnt });
                        }
                        res.elTips[elTipIdx] = ['超载', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Overload');
                                else trg.push('other-Overload');
                            }
                            trg.push('Overload-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Overload');
                                else trg.push('other-Overload');
                            }
                            if (tri == dmgedHidx) trg.push('get-Overload')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Dendro)) { // 火草 燃烧
                        ++res.willDamages[getDmgIdx][0];
                        const cpidx = dmgedPidx ^ 1;
                        this._updateSummon(cpidx, [this.newSummon(115)], res.players, isExec, { isSummon, supportCnt });
                        res.elTips[elTipIdx] = ['燃烧', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Burning');
                                else trg.push('other-Burning');
                            }
                            trg.push('Burning-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Burning');
                                else trg.push('other-Burning');
                            }
                            if (tri == dmgedHidx) trg.push('get-Burning')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Electro, ELEMENT_TYPE.Dendro)) { // 雷草 原激化
                        ++res.willDamages[getDmgIdx][0];
                        res.elTips[elTipIdx] = ['原激化', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isSelf) {
                                if (tri == atkHidx) trg.push('Quicken');
                                else trg.push('other-Quicken');
                            }
                            trg.push('Quicken-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isSelf) {
                                if (tri == dmgedHidx) trg.push('Quicken');
                                else trg.push('other-Quicken');
                            }
                            if (tri == dmgedHidx) trg.push('get-Quicken')
                        });
                    }
                }
                if (isElDmg) {
                    const SwirlOrCrystallize = dmgElement == ELEMENT_TYPE.Anemo || dmgElement == ELEMENT_TYPE.Geo ?
                        `:${PURE_ELEMENT_TYPE_KEY[attachElement]}` : '';
                    const elReactionTriggers: Trigger[] = [
                        'elReaction',
                        `elReaction-${trgEl}${SwirlOrCrystallize}` as Trigger,
                        `elReaction-${PURE_ELEMENT_TYPE_KEY[attachElement]}`,
                    ];
                    const otherElReactionTriggers: Trigger[] = [
                        'other-elReaction',
                        `other-elReaction-${trgEl}` as Trigger,
                        `other-elReaction-${ELEMENT_TYPE_KEY[attachElement]}` as Trigger,
                    ];
                    atriggers.forEach((trgs, tri) => {
                        if (!isSelf) {
                            if (tri == atkHidx) trgs.push(...elReactionTriggers);
                            else trgs.push(...otherElReactionTriggers);
                        }
                        trgs.push(...otherElReactionTriggers.map(t => t.replace('other', 'get') + '-oppo' as Trigger));
                    });
                    etriggers.forEach((trgs, tri) => {
                        if (isSelf) {
                            if (tri == dmgedHidx) trgs.push(...elReactionTriggers);
                            else trgs.push(...otherElReactionTriggers);
                        }
                        if (tri == dmgedHidx) trgs.push(...elReactionTriggers.map(t => `get-${t}` as Trigger));
                        else trgs.push('other-get-elReaction');
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
                if (elDmg > 0) trg.push(`${trgEl}-getdmg`);
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
                if (elDmg > 0) trg.push(`${trgEl}-getdmg`);
                if (pierceDmg > 0) trg.push('Pierce-getdmg');
            }
        });
        const getdmg = () => res.willDamages
            .slice(getDmgIdxOffset, getDmgIdxOffset + ehlen)
            .map(([dmg, pdmg]) => dmg == -1 && pdmg == 0 ? -1 : Math.max(0, dmg) + pdmg);
        const agetdmg = () => res.willDamages
            .slice(aGetDmgIdxOffset, aGetDmgIdxOffset + ahlen)
            .map(([dmg, pdmg]) => dmg == -1 && pdmg == 0 ? -1 : Math.max(0, dmg) + pdmg);

        if (isSwirl) {
            atriggers[atkHidx].push(`${trgEl}-dmg-Swirl` as Trigger, 'dmg-Swirl');
            etriggers[dmgedHidx].push(`${trgEl}-getdmg-Swirl` as Trigger);
        } else {
            const eWillDamage = res.willDamages.slice(getDmgIdxOffset, getDmgIdxOffset + ehlen);
            if (eWillDamage.some(dmg => dmg[0] > -1 || dmg[1] > 0)) {
                atriggers.forEach((trgs, ti) => {
                    if (!isAttach && !isAtkSelf) {
                        if (ti == atkHidx) trgs.push('dmg');
                        else trgs.push('other-dmg');
                    }
                    trgs.push('getdmg-oppo');
                    if (dmgElement != ELEMENT_TYPE.Physical) {
                        if (ti == atkHidx && !isAttach && !isAtkSelf) trgs.push('el-dmg');
                        trgs.push('el-getdmg-oppo');
                    }
                });
                if (eWillDamage.some(dmg => dmg[0] > -1)) {
                    atriggers.forEach((trgs, ti) => {
                        if (!isAttach && !isAtkSelf) {
                            if (ti == atkHidx) trgs.push(`${trgEl}-dmg`);
                            else trgs.push(`other-${trgEl}-dmg`);
                        }
                        trgs.push(`${trgEl}-getdmg-oppo`);
                    });
                }
                if (eWillDamage.some(dmg => dmg[1] > 0)) {
                    atriggers.forEach((trgs, ti) => {
                        if (!isAttach && !isAtkSelf) {
                            if (ti == atkHidx) trgs.push('Pierce-dmg');
                            else trgs.push('other-Pierce-dmg');
                        }
                        trgs.push('Pierce-getdmg-oppo');
                    });
                }
            }
            if (skid > -1 && sktype != undefined) {
                const sktrg = sktype == SKILL_TYPE.Vehicle ? 'vehicle' : 'skill';
                atriggers.forEach((trg, ti) => {
                    const isOther = ti != atkHidx ? 'other-' : '';
                    trg.push(`${isOther}${sktrg}`, `${isOther}skilltype${sktype}`);
                });
                etriggers.forEach(trgs => trgs.push(`${sktrg}-oppo`));
            }
            if (isReadySkill) atriggers[atkHidx].push('useReadySkill');
        }
        atkheros.forEach((_, hi) => {
            this._detectSkill(atkPidx, atriggers[hi], {
                hidxs: hi,
                heros: atkheros,
                isExec,
                getdmg: agetdmg(),
                dmg: getdmg(),
                discards,
                isQuickAction: res.isQuickAction,
                energyCnt,
            });
        });
        if (!isExec && skid > -1 && energyCnt) {
            this._doCmds(atkPidx, [{ cmd: 'getEnergy', cnt: energyCnt[atkPidx][atkHidx], hidxs: [atkHidx] }], { players: res.players, isExec: false });
        }
        for (let i = 0; i < ahlen; ++i) {
            const chi = (atkHidx + i) % ahlen;
            const trgs = atriggers[isSummon > -1 ? atkHidx : chi];
            const hfieldres = this._detectSlotAndStatus(atkPidx, trgs, {
                types: [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.MultiDamage],
                hidxs: chi,
                players: res.players,
                isExec,
                isOnlyExec: !isExec,
                sktype,
                skid,
                isChargedAtk,
                isFallAtk,
                isSummon,
                dmgedHidx,
                dmgSource: skid > -1 ? (atkId ?? afhero.id) : isSummon,
                dmgElement,
                minusDiceSkillIds,
                minusDiceSkill,
                hasDmg: res.willDamages[getDmgIdx][0] > 0,
                discards,
                hcard: withCard,
                supportCnt,
                willSwitch,
                energyCnt,
                isUnshift: trgs.some(trg => trg.includes('get') && !trg.includes('oppo')),
                isQuickAction: res.isQuickAction,
                ehidx: dmgedHidx,
                summons: asummons,
                usedDice,
                dmg: getdmg(),
            });
            aist[chi].push(...hfieldres.heroStatus);
            aost.push(...hfieldres.combatStatus);
            if (res.willDamages[getDmgIdx][0] > 0) {
                res.willDamages[getDmgIdx][0] += hfieldres.addDmg;
                multiDmg += hfieldres.multiDmg;
            }
            res.isQuickAction ||= hfieldres.isQuickAction;
            res.isFallAtk ||= hfieldres.isFallAtk;
            hfieldres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                if (pIsSelf) (phidxs ?? getBackHidxs(aheros)).forEach(hi => res.willDamages[hi + aGetDmgIdxOffset][1] += pdmg);
                else (phidxs ?? getBackHidxs(dmgedheros)).forEach(hi => res.willDamages[hi + getDmgIdxOffset][1] += pdmg);
            });
            mergeWillHeals(res.aWillHeals, hfieldres.aWillHeals);
            mergeWillHeals(res.bWillHeals, hfieldres.bWillHeals);
            res.tasks.push(...hfieldres.tasks);
        }

        const asmnres = this._detectSummon(atkPidx, atriggers[atkHidx], {
            csummon: asummons,
            isExec,
            heros: atkheros,
            minusDiceSkillIds,
            minusDiceSkill,
            skid,
            isSummon,
            supportCnt,
            willSwitch,
            energyCnt,
            isQuickAction: res.isQuickAction,
            atkHidx,
        });
        if (res.willDamages[getDmgIdx][0] > 0) res.willDamages[getDmgIdx][0] += asmnres.addDmg;
        mergeWillHeals(res.bWillHeals, asmnres.willHeals);

        const asptres = this._detectSupport(atkPidx, atriggers[atkHidx], {
            players: res.players,
            isExec,
            skid,
            sktype,
            getdmg: getdmg(),
            minusDiceSkillIds,
            minusDiceSkill,
            heal: res.bWillHeals,
            discardCnt: discards.length,
            supportCnt,
            energyCnt,
            isQuickAction: res.isQuickAction,
        });
        mergeWillHeals(res.bWillHeals, asptres.willHeals);
        res.tasks.push(...asptres.tasks);

        dmgedheros.forEach((_, hi) => {
            this._detectSkill(dmgedPidx, etriggers[hi], {
                hidxs: hi,
                heros: dmgedheros,
                isExec,
                getdmg: getdmg(),
                isQuickAction: res.isQuickAction,
                energyCnt,
            });
        });
        for (let i = 0; i < ehlen; ++i) {
            const chi = (dmgedHidx + i) % ehlen;
            const trgs = etriggers[chi];
            const hfieldres = this._detectSlotAndStatus(dmgedPidx, trgs, {
                types: [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage],
                hidxs: chi,
                players: res.players,
                isExec,
                getdmg: getdmg(),
                supportCnt,
                willSwitch,
                energyCnt,
                isQuickAction: res.isQuickAction, isOnlyExec: !isExec,
                sktype,
                skid,
                isChargedAtk,
                isFallAtk,
                isSummon,
                dmgedHidx,
                dmgSource: skid > -1 ? (atkId ?? afhero.id) : isSummon,
                dmgElement,
                minusDiceSkillIds,
                minusDiceSkill,
                hasDmg: res.willDamages[getDmgIdx][0] > 0,
                discards,
                hcard: withCard,
                hcardsCnt,
            });
            eist[chi].push(...hfieldres.heroStatus);
            eost.push(...hfieldres.combatStatus);
            if (res.willDamages[getDmgIdx][0] > 0) {
                res.willDamages[getDmgIdx][0] += hfieldres.getDmg;
            }
            res.isQuickAction ||= hfieldres.isQuickAction;
            res.isFallAtk ||= hfieldres.isFallAtk;
            hfieldres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                if (!pIsSelf) {
                    (phidxs ?? getBackHidxs(aheros)).forEach(hi => {
                        res.willDamages[hi + aGetDmgIdxOffset][1] += pdmg;
                    });
                } else {
                    (phidxs ?? getBackHidxs(dmgedheros)).forEach(hi => {
                        res.willDamages[hi + getDmgIdxOffset][1] += pdmg;
                    });
                }
            });
            hcardsCnt = hfieldres.hcardsCnt ?? 0;
            res.tasks.push(...hfieldres.tasks);
            mergeWillHeals(res.aWillHeals, hfieldres.aWillHeals);
            mergeWillHeals(res.bWillHeals, hfieldres.bWillHeals);
        }
        if (!isSwirl) {
            this._detectSummon(dmgedPidx, [...new Set(etriggers.flat())], {
                csummon: esummons,
                players: res.players,
                supportCnt,
                willSwitch,
                energyCnt,
                isExec,
                isQuickAction: res.isQuickAction,
                dmgedHidx,
                getdmg: getdmg(),
            });
            this._detectSupport(dmgedPidx, [...new Set(etriggers.flat())], {
                players: res.players,
                isExec,
                getdmg: getdmg(),
                skid,
                sktype,
                supportCnt,
                energyCnt,
                isQuickAction: res.isQuickAction,
            });

            atriggers.forEach((t, ti) => res.atriggers[ti] = [...new Set([...res.atriggers[ti], ...t])]);
        }
        etriggers.forEach((t, ti) => res.etriggers[ti] = [...new Set([...res.etriggers[ti], ...t])]);

        if (isAttachElement == 'attach') dmgedfhero.attachElement.push(dmgElement as PureElementType);
        else if (isAttachElement == 'consume') dmgedfhero.attachElement.shift();

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
        if (dmgElement != DAMAGE_TYPE.Pierce && res.willDamages[getDmgIdx][0] > 0) {
            let restDmg = res.willDamages[getDmgIdx][0];
            if (!isSwirl) restDmg *= multiDmg || 1;
            restDmg = this._detectSkill(dmgedPidx, 'reduce-dmg', {
                players: res.players,
                type: SKILL_TYPE.PassiveHidden,
                hidxs: dmgedHidx,
                restDmg,
                isExec,
                isOnlyExec: !isExec,
            }).restDmg ?? -1;
            const { restDmg: nrestdmg = -1, pdmgs, hcardsCnt: sshcardscnt = 0 } = this._detectSlotAndStatus(dmgedPidx, 'reduce-dmg', {
                types: [STATUS_TYPE.Shield, STATUS_TYPE.Barrier],
                players: res.players,
                dmgElement,
                restDmg,
                hidxs: dmgedHidx,
                dmgSource: skid > -1 ? (atkId ?? afhero.id) : isSummon,
                isSummon,
                hcardsCnt,
                isExec,
                isOnlyExec: !isExec,
                isUnshift: true,
                orderAfter: 'reduce-dmg',
            });
            restDmg = nrestdmg;
            pdmgs.forEach(([pdmg, phidxs]) => {
                (phidxs ?? getBackHidxs(dmgedheros)).forEach(hi => {
                    res.willDamages[hi + getDmgIdxOffset][1] += pdmg;
                });
            });
            res.willDamages[getDmgIdx][0] = restDmg;
            hcardsCnt = sshcardscnt;
        }
        if (!isAtkSelf) {
            for (let i = 0; i < ahlen; ++i) {
                const chi = (atkHidx + i) % ahlen;
                const trgs = atriggers[isSummon > -1 ? atkHidx : chi];
                if (!trgs.includes('dmg') && !trgs.includes('other-dmg')) continue;
                const hfieldres = this._detectSlotAndStatus(pidx, 'after-dmg', {
                    types: [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage],
                    hidxs: chi,
                    players: res.players,
                    isExec,
                    isOnlyExec: !isExec,
                    sktype,
                    skid,
                    isChargedAtk,
                    isFallAtk,
                    isSummon,
                    dmgedHidx,
                    dmgSource: skid > -1 ? (atkId ?? afhero.id) : isSummon,
                    dmgElement,
                    minusDiceSkillIds,
                    minusDiceSkill,
                    hasDmg: res.willDamages[getDmgIdx][0] > 0,
                    discards,
                    hcard: withCard,
                    supportCnt,
                    willSwitch,
                    energyCnt,
                    isUnshift: trgs.some(trg => trg.includes('get') && !trg.includes('oppo')),
                    isQuickAction: res.isQuickAction,
                    ehidx: dmgedHidx,
                    summons: asummons,
                    usedDice,
                    dmg: getdmg(),
                });
                aist[chi].push(...hfieldres.heroStatus);
                aost.push(...hfieldres.combatStatus);
                if (res.willDamages[getDmgIdx][0] > 0) {
                    res.willDamages[getDmgIdx][0] += hfieldres.addDmg;
                }
                res.isQuickAction ||= hfieldres.isQuickAction;
                res.isFallAtk ||= hfieldres.isFallAtk;
                hfieldres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                    if (pIsSelf) (phidxs ?? getBackHidxs(aheros)).forEach(hi => res.willDamages[hi + aGetDmgIdxOffset][1] += pdmg);
                    else (phidxs ?? getBackHidxs(dmgedheros)).forEach(hi => res.willDamages[hi + getDmgIdxOffset][1] += pdmg);
                });
                mergeWillHeals(res.aWillHeals, hfieldres.aWillHeals);
                mergeWillHeals(res.bWillHeals, hfieldres.bWillHeals);
                res.tasks.push(...hfieldres.tasks);
            }
            if (atriggers[atkHidx].includes('dmg')) {
                this._detectSupport(pidx, 'after-dmg', {
                    players: res.players,
                    isExec,
                    skid,
                    sktype,
                    getdmg: getdmg(),
                    supportCnt,
                });
            }
        }

        if (atriggers[atkHidx].includes('Crystallize-oppo')) aost.push(this.newStatus(111));
        if (atriggers[atkHidx].includes('Bloom-oppo') && !hasObjById([...aost, ...res.players[atkPidx].combatStatus], 112081)) {
            aost.push(this.newStatus(116));
        }
        if (atriggers[atkHidx].includes('Quicken-oppo')) aost.push(this.newStatus(117));
        const stscmds: Cmds[] = [];
        aheros.forEach((_, i) => {
            if (aist[i].length == 0) return;
            stscmds.push({ cmd: 'getStatus', status: aist[i], hidxs: [i], isOppo: !!(isAtkSelf || isAttach) })
        });
        dmgedheros.forEach((_, i) => {
            if (eist[i].length == 0) return;
            stscmds.push({ cmd: 'getStatus', status: eist[i], hidxs: [i], isOppo: !(isAtkSelf || isAttach) })
        });
        stscmds.push({ cmd: 'getStatus', status: aost, isOppo: !!(isAtkSelf || isAttach) });
        stscmds.push({ cmd: 'getStatus', status: eost, isOppo: !(isAtkSelf || isAttach) });
        this._doCmds(pidx, stscmds, { players: res.players, ahidx: atkHidx, ehidx: dmgedHidx, isExec });
        this._updateSummon(dmgedPidx, [], res.players, isExec, { destroy: +(isSummon == -1) });
        this._updateSummon(atkPidx, [], res.players, isExec, { destroy: +(isSummon == -1) });
        if (!isSwirl && isExec) {
            if (res.willDamages.some(d => Math.max(0, d[0]) + d[1] > 0)) {
                const willKilledHidxs: number[] = [];
                dmgedheros.forEach((h, hi) => {
                    if (h.hp <= res.willDamages[hi + getDmgIdxOffset].reduce((a, b) => a + b)) {
                        willKilledHidxs.push(hi);
                    }
                });
                if (willKilledHidxs.length > 0) {
                    const dieHeros: Hero[] = clone(dmgedheros.filter((_, hi) => willKilledHidxs.includes(hi)));
                    const { isDie: fieldIsDie } = this._detectSlotAndStatus(dmgedPidx, 'will-killed', {
                        types: STATUS_TYPE.NonDefeat,
                        players: res.players,
                        hidxs: willKilledHidxs,
                        isQuickAction: res.isQuickAction,
                        isEffectStatus: true,
                        isPriority: true,
                        isUnshift: true,
                    });
                    const slotsDestroy: number[] = dmgedheros.map(() => 0);
                    const slotDestroyHidxs = dieHeros.filter(h => {
                        const isDie = h.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonDefeat)) && fieldIsDie && h.equipments.length > 0;
                        if (isDie) slotsDestroy[h.hidx] += h.equipments.length;
                        return isDie;
                    }).map(v => v.hidx);
                    if (slotDestroyHidxs.length > 0) {
                        this._detectStatus(dmgedPidx, STATUS_TYPE.Usage, 'slot-destroy', {
                            players: res.players,
                            isOnlyCombatStatus: true,
                            slotsDestroy,
                            isQuickAction: res.isQuickAction,
                            isExec,
                        });
                    }
                }
            }
        }
        if (swirlDmg != undefined) {
            const otheridx = new Array(ehlen - 1).fill(0).map((_, i) => (dmgedHidx + i + 1) % ehlen).filter(i => dmgedheros[i].hp > 0);
            otheridx.forEach((i, idx) => {
                if (res.willDamages[i + getDmgIdxOffset][0] < 0) res.willDamages[i + getDmgIdxOffset][0] = 0;
                ++res.willDamages[i + getDmgIdxOffset][0];
                assgin(res, this._calcDamage(pidx, swirlDmg, res.willDamages, i, res.players, {
                    ...options, isSwirl: true, isSwirlExec: idx == otheridx.length - 1,
                    atriggers: res.atriggers, etriggers: res.etriggers, dmgElements: res.dmgElements,
                    elTips: res.elTips, willAttachs: res.willAttachs, hcardsCnt,
                    tasks: res.tasks,
                }));
            });
        }
        return res;
    }
    /**
     * 检查选择的卡的合法性并自动选择合适的骰子
     * @param pidx 玩家序号
     * @param cardIdx 要使用的卡牌序号
     * @param options.isReconcile 是否为调和
     * @param options.heroIdx 选择的第一个角色序号
     * @returns isValid 选择的卡是否合法, diceSelect 是否选择骰子的数组, skillIdx 使用技能的序号, switchIdx 切换角色的序号, summonIdx 选择的中召唤物序号
     */
    private _checkCard(pidx: number, players: Player[], cardIdx: number, options: { isReconcile?: boolean, heroIdx?: number, summonIdx?: number } = {}) {
        const { isReconcile, heroIdx, summonIdx } = options;
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const { dice, heros, hidx, summons, combatStatus, playerInfo: { isUsedLegend }, handCards } = player;
        const currCard = handCards[cardIdx];
        if (!currCard) throw new Error(`@_checkCard:p${pidx}的卡牌${cardIdx}不存在,${handCards.map(c => `[${c.name}]`)}`);
        const { cost, canSelectHero, type, userType, energy, costType, anydice, costChange } = currCard;
        const ncost = Math.max(0, cost + anydice - costChange);
        const cardres = currCard.handle(currCard, {
            pidx,
            heros,
            hero: heros[heroIdx ?? hidx],
            combatStatus,
            summons,
            eheros: opponent.heros,
            dmgedHidx: opponent.hidx,
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
            selectHeros: isCdt(heroIdx != undefined, [heroIdx!]),
            selectSummon: summonIdx,
        });
        const res: {
            isValid: boolean,
            diceSelect: boolean[],
            supportCnt: number[][],
            summonCnt?: number[][],
            skillId?: number,
            switchIdx?: number,
            attackPreview?: Preview,
            heroCanSelect?: boolean[],
        } = {
            isValid: false,
            diceSelect: new Array(MAX_DICE_COUNT).fill(false),
            supportCnt: players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0)),
            summonCnt: cardres.summonCnt,
            skillId: undefined,
            switchIdx: undefined,
            attackPreview: undefined,
            heroCanSelect: undefined,
        };
        if (!isReconcile &&
            (cardres.hidxs?.length == 0 ||
                cardres.summon && summons.length == MAX_SUMMON_COUNT ||
                cardres.isValid == false ||
                currCard.hasSubtype(CARD_SUBTYPE.Legend) && isUsedLegend ||
                heros[hidx].energy < energy) ||
            isReconcile && (currCard.tag.includes(CARD_TAG.NonReconcile) || dice.every(d => d == DICE_COST_TYPE.Omni || d == this._getFrontHero(pidx).element))
        ) {
            return res;
        }
        res.heroCanSelect = heros.map((hero, i) => {
            const canSelectHeros = cardres.canSelectHero?.[i] ?? (hero.hp > 0);
            return canSelectHero > 0 && canSelectHeros && (
                type == CARD_TYPE.Support ||
                type == CARD_TYPE.Event && currCard.subType.length == 0 ||
                currCard.hasSubtype(CARD_SUBTYPE.Weapon) && userType == hero.weaponType ||
                currCard.hasSubtype(CARD_SUBTYPE.Artifact, CARD_SUBTYPE.Vehicle) ||
                currCard.hasSubtype(CARD_SUBTYPE.Food) && !hasObjById(hero.heroStatus, 303300) ||
                currCard.hasSubtype(CARD_SUBTYPE.Talent) && userType == hero.id && (hero.isFront || !currCard.hasSubtype(CARD_SUBTYPE.Action) || currCard.type == CARD_TYPE.Event) ||
                currCard.hasSubtype(CARD_SUBTYPE.Action, CARD_SUBTYPE.Legend, CARD_SUBTYPE.ElementResonance) && userType == 0
            );
        });
        const notSelectHero = res.heroCanSelect.some(v => v) && heroIdx == undefined;
        if ((cardres.forcePreview || !cardres.notPreview) && !notSelectHero) {
            const { isSwitch: switchIdx, attackPreview } = this._doCmds(pidx, cardres.cmds, { players, withCard: currCard, isExec: false });
            res.switchIdx = switchIdx;
            res.attackPreview = attackPreview;
            res.skillId = userType == 0 || userType == heros[hidx].id ? cardres.cmds?.find(({ cmd }) => cmd == 'useSkill')?.cnt ?? -1 : -1;
        }
        if (isReconcile) {
            const dices = player.dice.map((d, di) => [d, di] as const).filter(([d]) => d != DICE_COST_TYPE.Omni && d != heros[hidx].element);
            const [dice] = dices.slice(-1)[0];
            const [, didx] = dices.find(([d]) => d == dice)!;
            res.diceSelect[didx] = true;
            res.isValid = true;
        } else {
            const isLen = ncost <= dice.length;
            const isElDice = (costType != DICE_TYPE.Same ?
                dice.filter(d => d == DICE_COST_TYPE.Omni || d == costType || costType == DICE_TYPE.Any).length :
                dice.filter(d => d == DICE_COST_TYPE.Omni).length + Math.max(0, ...Object.values(dice.reduce((a, c) => {
                    if (c != DICE_COST_TYPE.Omni) a[c] = (a[c] ?? 0) + 1;
                    return a;
                }, {} as Record<DiceCostType, number>)))) >= ncost - anydice;
            res.isValid = isLen && isElDice;
            if (res.isValid) res.diceSelect = this._selectDice(player, costType, ncost, anydice);
        }
        return res;
    }
    /**
     * 使用卡牌
     * @param pidx 玩家序号
     * @param cardIdx 使用的卡牌序号
     * @param diceSelect 选择要消耗的骰子
     * @param options.socket socket
     * @param options.selectHeros 使用卡牌时选择的角色序号组
     * @param options.selectSummon 使用卡牌时选择的召唤物序号
     * @param options.selectSupport 使用卡牌时选择的支援物序号
     * @param options.getcard 抓到牌时触发效果(而非使用牌)的牌
     * @param options.isQuickAction 是否为快速行动
     * @param options.pickCard 是否为挑选后打出
     */
    private async _useCard(pidx: number, cardIdx: number, diceSelect: boolean[],
        options: {
            socket?: Socket, selectHeros?: number[], selectSummon?: number, selectSupport?: number,
            getCard?: Card, isQuickAction?: boolean, pickCard?: Card,
        } = {}) {
        const { socket, selectHeros = [], selectSummon = -1, selectSupport = -1, getCard, pickCard } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const currCard = getCard ?? pickCard ?? player.handCards[cardIdx];
        if (!getCard && !pickCard) {
            const preview = this.previews.find(pre =>
                pre.type == ACTION_TYPE.UseCard &&
                pre.cardIdxs?.[0] == cardIdx &&
                (pre.heroIdxs?.length ?? 0) == selectHeros.length &&
                pre.heroIdxs?.every(hi => selectHeros.includes(hi)) &&
                (pre.summonIdx ?? -1) == selectSummon &&
                (pre.supportIdx ?? -1) == selectSupport
            );
            if (!preview?.isValid) return this.emit('useCard-invalid', pidx, { socket, tip: '卡牌使用无效' });
            const isDiceValid = checkDices(player.dice.filter((_, i) => diceSelect[i]), { card: currCard });
            if (!isDiceValid) return this.emit('useCard-invalidDice', pidx, { socket, tip: '骰子不符合要求' });
            this._writeLog(`[${player.name}](${player.pidx})打出卡牌[${currCard.name}]`, 'info');
            player.dice = player.dice.filter((_, i) => !diceSelect[i]);
        }
        const hidxs = currCard.canSelectSummon != -1 ? [selectSummon] :
            currCard.canSelectSupport != -1 ? [selectSupport] :
                currCard.canSelectHero == 0 ? [player.hidx] : selectHeros;
        player.handCards = player.handCards.filter((_, ci) => ci != cardIdx);
        const oSupportCnt = player.supports.length;
        const slotUse = currCard.type == CARD_TYPE.Equipment;
        const cardres = currCard.handle(currCard, {
            heros: player.heros,
            hero: player.heros[selectHeros?.[0] ?? player.hidx],
            combatStatus: player.combatStatus,
            eheros: opponent.heros,
            eCombatStatus: opponent.combatStatus,
            dmgedHidx: opponent.hidx,
            epile: opponent.pile,
            selectHeros,
            selectSummon,
            selectSupport,
            summons: player.summons,
            esummons: opponent.summons,
            hcards: player.handCards,
            hcardsCnt: player.handCards.length,
            ehcardsCnt: opponent.handCards.length,
            round: this.round,
            playerInfo: player.playerInfo,
            eplayerInfo: opponent.playerInfo,
            supports: player.supports,
            esupports: opponent.supports,
            isExec: true,
            slotUse,
            randomInArr: this._randomInArr.bind(this),
            randomInt: this._randomInt.bind(this),
            getCardIds: this._getCardIds.bind(this),
        });
        if (getCard && this._hasNotTriggered(cardres.trigger, 'getcard')) return;
        const isAction = currCard.hasSubtype(CARD_SUBTYPE.Action);
        const cardcmds = (getCard ? cardres.execmds : cardres.cmds) ?? [];
        const isUseSkill = cardcmds.some(({ cmd, cnt }) => cmd == 'useSkill' && cnt != -2);
        let isInvalid = false;
        let { isQuickAction = !isAction } = options;
        if (getCard) {
            cardcmds.push({ cmd: 'discard', card: currCard.entityId, cnt: 1, isAttach: true });
            cardcmds.reverse();
        } else if (!pickCard) {
            player.playerInfo.isUsedCardPerRound = true;
            if (currCard.hasSubtype(CARD_SUBTYPE.Legend)) player.playerInfo.isUsedLegend = true;
            this._detectSkill(pidx, 'card');
            // await this._execTask();
            const { minusDiceCard, isFallAtk: ifa, isInvalid: inv, isQuickAction: iqa } = this._detectSlotAndStatus(pidx, 'card', {
                types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.NonEvent],
                hidxs: allHidxs(player.heros),
                hcard: currCard,
                equipHidx: hidxs[0],
                isQuickAction,
            });
            isInvalid = inv;
            isQuickAction || iqa;
            // await this._execTask();
            this._detectSupport(pidx, 'card', { hcard: currCard, minusDiceCard, isQuickAction });
            // await this._execTask();
            this._detectSupport(pidx ^ 1, 'ecard', { hcard: currCard, isQuickAction });
            // await this._execTask();
            if (isAction) player.isFallAtk = ifa;
            const { usedCardIds } = player.playerInfo;
            usedCardIds.push(currCard.id);
        }
        this._doEquip(pidx, player.heros[hidxs[0]], currCard, { isDestroy: cardres.isDestroy });
        if (isInvalid) {
            this._doActionAfter(pidx, isQuickAction);
            this._startTimer();
            this.emit(`useCard-${currCard.name}-invalid-${pidx}`, pidx, { actionInfo: { card: currCard }, isQuickAction: true });
            await this._execTask();
            await this._doActionStart(pidx);
        } else {
            if (currCard.type != CARD_TYPE.Equipment) cardres.exec?.();
            let destroyedSupportCnt = oSupportCnt - player.supports.length;
            const { willHeals = [], bWillDamages: willDamages = [], bDmgElements: dmgElements = [], elTips = [] }
                = this._doCmds(pidx, cardcmds, {
                    withCard: isCdt(!getCard, currCard),
                    isAction: !isQuickAction,
                    hidxs: isCdt(currCard.canSelectHero > 0, hidxs),
                    source: currCard.id,
                    isUnshift: !!getCard,
                });
            if (cardres.hidxs && currCard.type != CARD_TYPE.Equipment) assgin(hidxs, cardres.hidxs);
            if (cardres.support) {
                if (player.supports.length == MAX_SUPPORT_COUNT) {
                    if (selectSupport > -1) {
                        player.supports.splice(selectSupport, 1);
                        ++destroyedSupportCnt;
                    } else if (currCard.type == CARD_TYPE.Support) {
                        throw new Error('@_useCard: selectSupport is invalid');
                    }
                }
                this._getSupportById(cardres.support).forEach(support => {
                    if (player.supports.length < MAX_SUPPORT_COUNT) {
                        player.supports.push(support.setEntityId(this._genEntityId()));
                        this._detectSupport(pidx, 'enter', { csupport: [support], isQuickAction: true });
                    }
                });
            }
            this._getSupportById(cardres.supportOppo).forEach(support => {
                if (opponent.supports.length < MAX_SUPPORT_COUNT) {
                    opponent.supports.push(support.setEntityId(this._genEntityId()));
                    this._detectSupport(pidx ^ 1, 'enter', { csupport: [support], isQuickAction: true });
                }
            });
            if (destroyedSupportCnt) this._doSupportDestroy(pidx, destroyedSupportCnt);
            this._updateSummon(pidx, this._getSummonById(cardres.summon), this.players, true, { destroy: 1 });
            this._updateSummon(pidx ^ 1, [], this.players, true, { destroy: 1 });
            const stscmds: Cmds[] = [
                { cmd: 'getStatus', status: cardres.status, hidxs: cardres.hidxs ?? hidxs },
                { cmd: 'getStatus', status: cardres.statusOppo, hidxs: cardres.hidxs ?? [opponent.hidx], isOppo: true },
            ];
            this._doCmds(pidx, stscmds, { source: currCard.id });
            if (isAction) player.canAction = false;
            const damageVOs: DamageVO[] = ((willDamages.length > 0 || elTips.some(([n]) => n != '')) && willHeals.length == 0 ? [[]] : willHeals).map((hl, hli) => ({
                dmgSource: 'card',
                atkPidx: pidx,
                atkHidx: -1,
                tarHidx: hli == 0 ? opponent.hidx : -1,
                willDamages: hli == 0 ? willDamages : [],
                willHeals: hl,
                dmgElements: hli == 0 ? dmgElements : [],
                elTips: hli == 0 ? elTips : [],
            }));
            const dmgvoLen = damageVOs.length || 1;
            for (let voi = 0; voi < dmgvoLen; ++voi) {
                const canAction = voi == dmgvoLen - 1;
                const damageVO = damageVOs[voi];
                if (damageVO != undefined && (willDamages.length > 0 || willHeals.length > 0)) {
                    if (canAction) this._doActionAfter(pidx, isQuickAction);
                    await this._doDamage(pidx, damageVO, {
                        atkname: currCard.name,
                        canAction,
                        isQuickAction,
                        actionInfo: isCdt(!pickCard, { card: currCard }),
                    });
                    if (canAction) await this._execTask();
                } else {
                    if (!isUseSkill) {
                        this._doActionAfter(pidx, isQuickAction);
                        this._startTimer();
                        this.emit(`useCard-${currCard.name}`, pidx, {
                            canAction,
                            damageVO,
                            isQuickAction,
                            actionInfo: isCdt(!pickCard, { card: currCard }),
                        });
                    }
                    await this._execTask();
                }
            }
            if (!getCard && !pickCard && !isUseSkill) {
                if (isAction) this._changeTurn(pidx, isQuickAction, 'useCard');
                else this._doActionStart(pidx);
            }
        }
    }
    /**
     * 挑选卡牌
     * @param pidx 玩家序号
     * @param selectIdx 选择卡牌的序号
     * @param skillId 可能的使用技能ID
     */
    private async _pickCard(pidx: number, selectIdx: number, skillId: number) {
        const { cardType, isQuickAction, phase = PHASE.ACTION, hidxs } = this.pickModal;
        const selectId = this.pickModal.cards[selectIdx].id;
        this.players[pidx].phase = phase;
        const pickSummon: Summon[] = [];
        switch (cardType) {
            case 'getCard':
                this._doCmds(pidx, [{ cmd: 'getCard', card: selectId, cnt: 1 }], { isPriority: true, isUnshift: true });
                break;
            case 'summon':
                pickSummon.push(this.newSummon(selectId));
                break;
            case 'useCard':
                this._useCard(pidx, -1, [], { isQuickAction, pickCard: this.newCard(selectId), selectHeros: hidxs });
                break;
            default:
                const e: never = cardType;
                throw new Error(`@_pickCard: unknown cardType: ${e}`);
        }
        await this._execTask('pickCard');
        if (skillId > 0) this._useSkill(pidx, skillId, { pickSummon, isPickCard: true });
        this.pickModal.cards = [];
        this._detectSupport(pidx, 'pick', { isQuickAction });
        await this._execTask();
    }
    /**
     * 转换回合
     * @param pidx 玩家序号
     * @param isQuickAction 是否为快速行动
     * @param type 发动转换回合的来源
     * @param options.isDieSwitch 是否为被击倒后重新选择角色
     */
    private async _changeTurn(pidx: number, isQuickAction: boolean, type: string, options: { isDieSwitch?: boolean } = {}) {
        const isEnd = this.players.some(p => p.heros.every(h => h.hp <= 0)) && this.taskQueue.isTaskEmpty();
        if (isEnd) return;
        const isDie = !this._hasNotDieSwitch();
        if (!isDie) await wait(() => this.needWait, { maxtime: 2e5 });
        const { isDieSwitch = false } = options;
        const isOppoActionEnd = this.players[pidx ^ 1]?.phase >= PHASE.ACTION_END;
        this.players[pidx].canAction = false;
        const isChange = !isQuickAction && !isDie &&
            (!isDieSwitch && !isOppoActionEnd || isDieSwitch && this.players[pidx]?.phase < PHASE.ACTION_END) &&
            !this._detectSlot(pidx ^ +isDieSwitch, 'change-turn').isQuickAction &&
            !this._detectStatus(pidx ^ +isDieSwitch, STATUS_TYPE.Usage, 'change-turn', { isOnlyCombatStatus: true }).isQuickAction;
        if (isChange) {
            this.players[this.currentPlayerIdx].canAction = false;
            this.players[this.currentPlayerIdx].status = PLAYER_STATUS.WAITING;
            ++this.currentPlayerIdx;
            this.players[this.currentPlayerIdx].status = PLAYER_STATUS.PLAYING;
            if (type != 'endPhase') {
                this.players.forEach(p => {
                    if (p.pidx == this.currentPlayerIdx) p.UI.info = '我方行动中....';
                    else p.UI.info = '对方行动中....';
                });
            }
        }
        const tip = isCdt(!isQuickAction && !isDie && this.taskQueue.isTaskEmpty(), isChange ? '{p}回合开始' : '继续{p}回合');
        this._startTimer();
        this.emit(`changeTurn-${type}-isChange:${isChange}`, pidx, { tip, isChange });
        await this.delay(1e3);
        const currPlayer = this.players[this.currentPlayerIdx];
        const hasReadyskill = currPlayer.heros[currPlayer.hidx].heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonAction)) &&
            currPlayer.heros[currPlayer.hidx].heroStatus.some(sts => sts.hasType(STATUS_TYPE.ReadySkill));
        if (!isDie) await this._doActionStart(this.currentPlayerIdx);
        currPlayer.canAction = !isDie;
        this.emit(`changeTurn-${type}-setCanAction:${!isDie}`, pidx, { isChange, hasReadyskill });
    }
    /**
     * 玩家选择行动前
     * @param pidx 玩家序号
     */
    private async _doActionStart(pidx: number) {
        this._detectSkill(pidx, 'action-start');
        await this._execTask();
        this._detectSlotAndStatus(pidx, ['action-start', 'useReadySkill'], { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.ReadySkill], isOnlyFront: true, isQuickAction: true });
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
    private _doActionAfter(pidx: number, isQuickAction: boolean = false) {
        this._detectSkill(pidx, 'action-after', { type: SKILL_TYPE.Passive, isQuickAction });
        this._detectSlotAndStatus(pidx, 'action-after', { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage], isOnlyFront: true, isQuickAction });
        this._detectSupport(pidx, 'action-after', { isQuickAction });
        this._detectSkill(pidx ^ 1, 'action-after-oppo', { type: SKILL_TYPE.Passive, isQuickAction });
        this._detectSlotAndStatus(pidx ^ 1, 'action-after-oppo', { types: STATUS_TYPE.Usage, isOnlyFront: true, isQuickAction });
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
                h.vehicleSlot?.[1].handle({ reset: true, hero: h, skill: h.vehicleSlot[1] });
                h.skills.forEach(skill => skill.handle({ reset: true, skill, hero: h }))
            });
            player.supports.forEach(spt => { // 重置支援区
                spt.handle(spt, { reset: true });
                spt.card.handle(spt.card, { reset: true });
            });
            const rCombatStatus: Status[] = [];
            player.summons.forEach(smn => { // 重置召唤物
                const { rCombatStatus: sts } = smn.handle(smn, { reset: true });
                rCombatStatus.push(...this._getStatusById(sts));
            });
            player.heros.forEach(h => {
                h.equipments.forEach(slot => slot.handle(slot, { reset: true })); // 重置装备
                h.heroStatus.forEach(sts => sts.handle(sts, { reset: true })); // 重置角色状态
            });
            player.combatStatus.forEach(sts => sts.handle(sts, { reset: true })); // 重置出战状态
            if (rCombatStatus.length > 0) this._updateStatus(player.pidx, rCombatStatus, player.combatStatus, this.players, { hidx: player.hidx, isExec: true });
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
        await this.delay(1250);
        for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
            if (this.round == 1) { // 检测游戏开始 game-start
                this._detectSkill(cpidx, 'game-start');
                await this._execTask();
                this._detectSkill(cpidx, 'switch-to', { hidxs: [this.players[cpidx].hidx] });
                await this._execTask();
            }
            // 检测回合开始阶段 phase-start
            this._detectSlotAndStatus(cpidx, 'phase-start', {
                types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage],
                hidxs: allHidxs(this.players[cpidx].heros),
                isQuickAction: true,
            });
            // await this._execTask();
            this._detectSummon(cpidx, 'phase-start');
            // await this._execTask();
            this._detectSupport(cpidx, 'phase-start', { firstPlayer: this.startIdx, isQuickAction: true });
            // await this._execTask();
        }
        await this._execTask();
        await wait(() => this.players.every(p => p.phase == PHASE.ACTION_START) &&
            this.taskQueue.isTaskEmpty() && !this.taskQueue.isExecuting, { maxtime: 6e6 });
        // 回合开始阶段结束，进入行动阶段 phase-action
        this.phase = PHASE.ACTION;
        this.players[this.startIdx].status = PLAYER_STATUS.PLAYING;
        this.players.forEach(p => {
            p.phase = PHASE.ACTION;
            if (p.pidx == this.startIdx) {
                p.UI.info = '我方行动中....';
                p.canAction = true;
            } else p.UI.info = '对方行动中....';
        });
        this._startTimer();
        this.emit(flag, pidx, { tip: '{p}回合开始' });
        await this.delay(1e3);
        await this._doActionStart(this.startIdx);
    }
    /**
     * 回合结束阶段
     * @param pidx 玩家序号
     * @param flag flag
     */
    private _doPhaseEnd(pidx: number, flag: string) {
        this.delay(800, async () => {
            for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
                this._detectSkill(cpidx, 'phase-end');
                // await this._execTask();
                this._detectSlotAndStatus(cpidx, 'phase-end', {
                    types: [STATUS_TYPE.Attack, STATUS_TYPE.Round, STATUS_TYPE.Accumulate],
                    hidxs: allHidxs(this.players[cpidx].heros),
                });
                // await this._execTask();
                this._detectSummon(cpidx, 'phase-end');
                // await this._execTask();
                this._detectSupport(cpidx, 'phase-end');
                // await this._execTask();
            }
            await this._execTask();
            await wait(() => this.needWait, { maxtime: 6e6 });
            // 回合结束摸牌
            const getCardCmds: Cmds[] = [{ cmd: 'getCard', cnt: 2 }];
            this._doCmds(this.startIdx, getCardCmds);
            await this._execTask();
            this._doCmds(this.startIdx ^ 1, getCardCmds);
            await this._execTask();
            this.emit(flag + '--getCard', pidx);
            await wait(() => this.needWait, { freq: 100 });
            this.currentPlayerIdx = this.startIdx;
            this.phase = PHASE.DICE;
            ++this.round;
            if (this.round == MAX_GAME_ROUND) return this._gameEnd(-2);
            for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
                this._detectSkill(cpidx, 'turn-end');
                await this._execTask();
                this._detectSlotAndStatus(cpidx, 'turn-end', {
                    types: [STATUS_TYPE.Attack, STATUS_TYPE.Round, STATUS_TYPE.Accumulate],
                    hidxs: allHidxs(this.players[cpidx].heros),
                });
                await this._execTask();
                this._detectSummon(cpidx, 'turn-end');
                await this._execTask();
                this._detectSupport(cpidx, 'turn-end');
                await this._execTask();
            }
            this.players.forEach(player => {
                player.status = PLAYER_STATUS.WAITING;
                player.phase = PHASE.DICE;
                player.rollCnt = INIT_ROLL_COUNT;
                player.dice = this._rollDice(player.pidx);
                player.playerInfo.isUsedCardPerRound = false;
                player.UI.showRerollBtn = true;
                player.UI.info = '等待对方选择......';
                player.heros.forEach(h => h.hp == -1 && (h.hp = -2));
                if (player.id == AI_ID) this._reroll(player.dice.map(d => d != DICE_COST_TYPE.Omni && !player.heros.map(h => h.element).includes(d)), player.pidx, 'reroll-ai');
            });
            this.emit(flag, pidx, { tip: '骰子投掷阶段' });
        });
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
        player.phase = PHASE.ACTION_END;
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], ['end-phase', 'any-end-phase']);
        await this._execTask();
        this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'any-end-phase');
        await this._execTask();
        this._detectSummon(pidx, 'end-phase');
        await this._execTask();
        this._doActionAfter(pidx);
        await this._execTask();
        if (this.players[pidx ^ 1].phase != PHASE.ACTION_END) {
            this.startIdx = pidx;
        }
        await wait(() => this.needWait);
        const isActionEnd = this.players.every(p => p.phase == PHASE.ACTION_END);
        if (!isActionEnd) this._changeTurn(pidx, false, 'endPhase');
        this.players.forEach(p => {
            if (isActionEnd) p.UI.info = '结束阶段...';
            else if (p.pidx == this.currentPlayerIdx) p.UI.info = '对方行动中....';
            else p.UI.info = '对方结束已结束回合...';
        });
        this.players[this.currentPlayerIdx ^ 1].canAction = true;
        this._writeLog(`[${player.name}](${player.pidx})结束了回合`);
        this.emit(flag, pidx, { tip: isCdt(isActionEnd, '回合结束阶段') });
        if (isActionEnd) { // 双方都结束回合，进入回合结束阶段
            this.phase = PHASE.ACTION_END;
            this._writeLog(`第${this.round}轮结束`);
            this._doPhaseEnd(pidx, 'phaseEnd');
        }
    }
    /**
     * 装备弃置
     * @param pidx 玩家序号
     * @param hidx 弃置装备角色索引
     * @param slot 弃置的装备
     * @param options players 玩家数组, slotsDestroy 弃置的装备数量
     */
    private _doSlotDestroy(pidx: number, hidx: number, slot: Card, options: { players?: Player[], slotsDestroy?: number[] } = {}) {
        const { players = this.players, slotsDestroy = players[pidx].heros.map(h => +(h.hidx == hidx)) } = options;
        this._detectSlot(pidx, 'slot-destroy', { players, cSlot: slot, hidxs: [hidx] });
        this._detectStatus(pidx, STATUS_TYPE.Usage, 'slot-destroy', { players, isOnlyCombatStatus: true, slotsDestroy });
    }
    /**
     * 状态被移除时发动
     * @param pidx
     * @param hidxs 检测的角色索引
     * @param cStatus 被移除的状态
     * @param hidx 被移除状态的角色索引
     * @param isQuickAction 是否是快速行动
     */
    private _doStatusDestroy(pidx: number, hidxs: number[], cStatus: Status, hidx: number, isQuickAction?: boolean) {
        const player = this.players[pidx];
        const heros = player.heros;
        this._writeLog(`[${player.name}](${player.pidx})弃置${cStatus.group == STATUS_GROUP.heroStatus ? `[${heros[hidx].name}]角色` : '出战'}状态[${cStatus.name}](${cStatus.entityId})`, 'system');
        cStatus.entityId = 1;
        // 被移除的状态触发
        this._detectStatus(pidx, STATUS_TYPE.Attack, 'status-destroy', { cStatus, hidxs: [hidx], isUnshift: true, isQuickAction });
        // 其他状态因被移除状态触发
        this._detectSkill(pidx, 'status-destroy', { hidxs, source: cStatus.id, sourceHidx: hidx, isQuickAction });
        this._detectSlotAndStatus(pidx, 'status-destroy', { types: STATUS_TYPE.Usage, source: cStatus.id, sourceHidx: hidx, isQuickAction });
    }
    /**
     * 召唤物消失时发动
     * @param pidx 玩家序号
     */
    private _doSummonDestroy(pidx: number, summon: Summon) {
        this._writeLog(`[${this.players[pidx].name}](${pidx})弃置召唤物[${summon.name}](${summon.entityId})`, 'system');
        this._detectSummon(pidx, 'summon-destroy', { csummon: [summon], isUnshift: true });
        this._detectSupport(pidx, 'summon-destroy');
    }
    /**
     * 支援物消失时发动
     * @param pidx 玩家序号
     * @param isExec 是否执行
     */
    private _doSupportDestroy(pidx: number, destroyedCnt: number, options: { supportCnt?: number[][], isExec?: boolean } = {}) {
        const { supportCnt, isExec = true } = options;
        if (isExec) this.players[pidx].playerInfo.destroyedSupport += destroyedCnt;
        this._detectSupport(pidx, 'support-destroy', { supportCnt, isExec, isQuickAction: true });
    }
    /**
     * 进行伤害
     * @param pidx 造成伤害的角色
     * @param damageVO 伤害信息
     * @param options.slotSelect 装备亮起
     * @param options.summonSelect 召唤物亮起
     * @param options.supportSelect 支援物亮起
     * @param options.canAction 是否可行动
     * @param options.isQuickAction 是否为快速行动
     * @param options.atkname 攻击实体名称
     * @param options.skid 造成伤害的技能id
     * @param options.cmds 命令集(目前用于技能充能)
     * @param options.heroSelect 角色亮起
     * @param options.isActionInfo 是否显示行动信息
     * @param options.actionInfo 行动信息
     */
    private async _doDamage(pidx: number, damageVO: DamageVO, options: {
        slotSelect?: number[], summonSelect?: number[], canAction?: boolean, skid?: number,
        isQuickAction?: boolean, atkname?: string, supportSelect?: number[], cmds?: Cmds[],
        heroSelect?: number[], isActionInfo?: boolean, actionInfo?: ActionInfo,
    } = {}) {
        if (damageVO == -1) return;
        const isDie = new Set<number>();
        const heroDie: number[][] = this.players.map(() => []);
        const { slotSelect, summonSelect, supportSelect, heroSelect, canAction = true, isQuickAction,
            atkname = '', cmds = [], skid = -1, isActionInfo, actionInfo,
        } = options;
        const { atkPidx, atkHidx, dmgElements = [], willDamages = [], willHeals = [] } = damageVO;
        const intvl = willDamages.every(([d, p]) => d == -1 && p == 0) && willHeals.every(h => h == -1) ? 1e3 : 2250;
        const logPrefix = `[${this.players[atkPidx].name}](${atkPidx})${atkHidx > -1 ? `[${this.players[atkPidx].heros[atkHidx].name}]` : `[${atkname.replace(/\(\-\d+\)/, '')}]`}对`;
        const logs: string[] = [];
        for (const p of this.players) {
            for (let offset = 0; offset < p.heros.length; ++offset) {
                const h = p.heros[(p.hidx + offset) % p.heros.length];
                const phidx = h.hidx + p.pidx * this.players[0].heros.length;
                const heal = Math.max(0, willHeals[phidx] ?? 0);
                if (h.hp > 0 || heal % 1 != 0) {
                    const damage = willDamages[phidx]?.reduce((a, b) => a + Math.max(0, b), 0) ?? 0;
                    if (heal % 1 != 0) h.hp = Math.ceil(heal);
                    else h.hp = Math.max(0, h.hp - damage + heal);
                    if ((willDamages[phidx]?.[0] ?? -1) >= 0) logs.push(`${logPrefix}[${p.name}][${h.name}]造成${willDamages[phidx][0]}点${ELEMENT_NAME[dmgElements[phidx]]}伤害`);
                    if (willDamages[phidx]?.[1]) logs.push(`${logPrefix}[${p.name}][${h.name}]造成${willDamages[phidx][1]}点穿透伤害`);
                    if ((willHeals[phidx] ?? -1) >= 0) logs.push(`${logPrefix}[${p.name}][${h.name}]治疗${Math.ceil(heal)}点`);
                    // 被击倒
                    if (h.hp == 0 &&
                        h.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonDefeat)) &&
                        (!h.talentSlot || !h.talentSlot.hasTag(CARD_TAG.NonDefeat) || h.talentSlot.perCnt <= 0)
                    ) {
                        this.players[p.pidx ^ 1].canAction = false;
                        isDie.add(p.pidx);
                        heroDie[p.pidx].push(h.hidx);
                    }
                } else if (willDamages.length > 0) {
                    willDamages[phidx] = [-1, 0];
                }
            }
        }
        logs.forEach(log => this._writeLog(log));
        if (isDie.size > 0) {
            // 击倒对方角色
            for (const cpidx of isDie) {
                if (cpidx != pidx) {
                    this._detectSlotAndStatus(pidx, 'kill', { types: STATUS_TYPE.Usage, hidxs: allHidxs(this.players[pidx].heros), skid, isUnshift: true });
                }
                this._detectSkill(cpidx, 'killed', { hidxs: heroDie[cpidx] });
            }
            this.taskQueue.addTask(`heroDie-${damageVO.dmgSource}-${atkname}`, [[() => {
                const tips = ['', ''];
                for (const cpidx of isDie) {
                    const cplayer = this.players[cpidx];
                    for (const chidx of heroDie[cpidx]) {
                        const h = cplayer.heros[chidx];
                        h.hp = -1;
                        h.heroStatus.forEach(sts => !sts.hasType(STATUS_TYPE.NonDestroy) && sts.dispose());
                        h.talentSlot = null;
                        h.artifactSlot = null;
                        h.weaponSlot = null;
                        h.vehicleSlot = null;
                        h.attachElement.length = 0;
                        h.energy = 0;
                        h.skills.forEach(s => s.handle({ hero: h, skill: s, reset: true }));
                        if (!h.isFront) {
                            heroDie[cpidx].splice(heroDie[cpidx].indexOf(chidx), 1);
                            if (heroDie[cpidx].length == 0) isDie.delete(cpidx);
                            continue;
                        }
                        h.isFront = false;
                        if (this._isWin() == -1) {
                            this.isDieBackChange = !isQuickAction && cplayer.phase == PHASE.ACTION;
                            cplayer.status = PLAYER_STATUS.DIESWITCH;
                            cplayer.UI.info = '请选择出战角色...';
                            if (!isDie.has(cpidx ^ 1)) this.players[cpidx ^ 1].UI.info = '等待对方选择出战角色......';
                            tips[cpidx] = '请选择出战角色';
                            if (!isDie.has(cpidx ^ 1)) tips[cpidx ^ 1] = '等待对方选择出战角色';
                        }
                    }
                }
                this.emit(`heroDie-${damageVO.dmgSource}-${atkname}`, pidx, {
                    tip: tips,
                    notPreview: true,
                    isQuickAction: isQuickAction && isDie.size == 0,
                });
            }]], { orderAfter: 'switch', isUnshift: true });
        }
        this._doCmds(pidx, cmds);
        this.emit(`${damageVO.dmgSource}-doDamage-${atkname}`, pidx, {
            damageVO,
            isActionInfo,
            slotSelect,
            summonSelect,
            supportSelect,
            heroSelect,
            notUpdate: damageVO.dmgSource == 'status',
            canAction,
            isQuickAction: isQuickAction && isDie.size == 0,
            actionInfo,
        });
        if (this.env == 'test') this.testDmgFn.forEach(f => f());
        await this.delay(intvl);
    }
    /**
     * 检测治疗
     * @param pidx 玩家序号
     * @param heal 治疗量
     * @param players 玩家信息
     * @param options.isExec 是否执行
     * @param options.notPreHeal 是否不进行预回血判断(目前只用于禁疗)
     * @param options.isQuickAction 是否为快速行动
     * @param options.source 触发来源id
     */
    private _detectHeal(pidx: number, heal: number[], players: Player[], options: {
        isExec?: boolean, notPreHeal?: boolean, isQuickAction?: boolean, supportCnt?: number[][], source?: number,
    } = {}) {
        const { isExec = true, notPreHeal, isQuickAction, supportCnt = INIT_SUPPORTCNT(), source } = options;
        const { heros, hidx } = players[pidx];
        const tmpHeals = new Array(heros.length).fill(0);
        let tasks: AtkTask[] = [];
        if (heal.some(hl => hl > -1)) {
            heal.forEach((h, hi, ha) => {
                if (h == -1) return;
                ha[hi] = Math.min(heros[hi].maxHp - heros[hi].hp, h);
            });
            if (!notPreHeal) {
                this._detectSkill(pidx, 'pre-heal', { heal, players, hidxs: allHidxs(heros), source, isQuickAction, isExec });
                this._detectStatus(pidx, STATUS_TYPE.Usage, 'pre-heal', { heal, players, hidxs: allHidxs(heros), supportCnt, source, isQuickAction, isExec, isOnlyExec: !isExec });
            }
            heal.forEach((h, hi, ha) => {
                if (h == -1) return;
                tmpHeals[hi] += ha[hi];
                heros[hi].hp += ha[hi];
            });
            for (let i = 0; i < heal.length; ++i) {
                const hi = (hidx + i) % heal.length;
                if (heal[hi] > -1) this._detectSkill(pidx, 'heal', { hidxs: hi, players, heal, isQuickAction, isExec });
                const { tasks: ht } = this._detectSlotAndStatus(pidx, heal[hi] > -1 ? 'heal' : 'other-heal', {
                    types: STATUS_TYPE.Usage, hidxs: hi, players, heal, isQuickAction, supportCnt, source, isExec, isOnlyExec: !isExec,
                });
                tasks.push(...ht);
            }
            this._detectSupport(pidx, 'heal', { heal, players, isQuickAction, supportCnt, isExec });
            this._detectSupport(pidx ^ 1, 'heal-oppo', { heal, players, isQuickAction, supportCnt, isExec });
        }
        return { tmpHeals, tasks }
    }
    /**
     * 弃牌后的处理
     * @param pidx 玩家序号
     * @param discards 将要舍弃的牌
     * @param options players 玩家信息, isAction 是否为战斗行动, isExec 是否执行
     */
    private _doDiscard(pidx: number, discards: Card[], options: {
        players?: Player[], isAction?: boolean, isExec?: boolean, supportCnt?: number[][],
    } = {}) {
        const { players = this.players, isAction, isExec = true, supportCnt = INIT_SUPPORTCNT() } = options;
        const summons = [...players[pidx].summons];
        const tasks: AtkTask[] = [];
        const nsummons: Summon[] = [];
        let willHeals: number[] | undefined;
        for (const card of discards) {
            const cardres = card.handle(card, { summons, trigger: 'discard', isExec });
            if (this._hasNotTriggered(cardres.trigger, 'discard')) continue;
            if (cardres.cmds) {
                const { bWillDamages = [] } = this._doCmds(pidx, cardres.cmds, { players: clone(players), isAction, isExec: false, supportCnt });
                if (bWillDamages.length > 0) {
                    const atkname = `${card.name}(${card.entityId})`;
                    tasks.push({ pidx, cmds: cardres.cmds, atkname });
                    if (isExec) {
                        this.taskQueue.addTask(`doDamage-${atkname}`, [[async () => {
                            const { bWillDamages: willDamages = [], willHeals: [whl] = [], bDmgElements: dmgElements = [],
                                elTips = [], atkedIdxs: [tarHidx] = [-1] }
                                = this._doCmds(pidx, cardres.cmds, { isAction });
                            await this._doDamage(pidx, {
                                dmgSource: 'card',
                                atkPidx: pidx,
                                atkHidx: -1,
                                tarHidx,
                                willHeals: whl,
                                willDamages,
                                dmgElements,
                                elTips,
                            }, { atkname });
                        }]], { isDmg: true });
                    }
                }
            }
            if (cardres.summon) {
                const nsmns = this._getSummonById(cardres.summon);
                summons.push(...nsmns);
                nsummons.push(...nsmns);
            }
        }
        this._detectSkill(pidx, 'discard', { players, discards, isExec });
        const { bWillHeals: stsheal, } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'discard', {
            discards, players, isExec, isOnlyExec: !isExec, isQuickAction: !isAction, supportCnt,
        });
        if (!willHeals) willHeals = stsheal;
        else mergeWillHeals(willHeals, stsheal);
        this._detectSupport(pidx, 'discard', { players, discardCnt: discards.length, isExec, isQuickAction: !isAction, supportCnt });
        this._updateSummon(pidx, nsummons, players, isExec);
        if (nsummons.length && isExec) {
            const name = `_doDiscard-summon:${nsummons.map(s => `[${s.name}]`).join('')}`;
            this.taskQueue.addTask(name, [[() => this.emit(name, pidx)]]);
        }
        return { tasks, willHeals, supportCnt }
    }
    /**
     * 给角色附属装备
     * @param pidx 玩家序号
     * @param hero 被装备的角色
     * @param equipment 装备卡
     * @param options.isDestroy 是否直接弃置
     * @param options.isExec 是否执行
     */
    private _doEquip(pidx: number, hero: Hero, equipment: Card | number, options: { isDestroy?: boolean, isExec?: boolean } = {}) {
        if (typeof equipment == 'number') equipment = this.newCard(equipment);
        if (equipment.type != CARD_TYPE.Equipment) return;
        const { isDestroy, isExec = true } = options;
        const explIdx = equipment.UI.description.lastIndexOf('；（');
        if (explIdx > -1) equipment.UI.description = equipment.UI.description.slice(0, explIdx);
        if (isExec && (hero.equipments.some(s => s.subType[0] == equipment.subType[0]) || isDestroy)) {
            const destroySlot = isDestroy ? equipment : hero.equipments.find(s => s.subType[0] == equipment.subType[0])!;
            this._doSlotDestroy(pidx, hero.hidx, destroySlot);
        }
        if (!isDestroy) {
            if (equipment.hasSubtype(CARD_SUBTYPE.Weapon)) { // 武器
                if (hero.weaponSlot?.id == equipment.id) equipment.setEntityId(hero.weaponSlot.entityId);
                hero.weaponSlot = equipment.setEntityId(this._genEntityId());
            } else if (equipment.hasSubtype(CARD_SUBTYPE.Artifact)) { // 圣遗物
                if (hero.artifactSlot?.id == equipment.id) equipment.setEntityId(hero.artifactSlot.entityId);
                hero.artifactSlot = equipment.setEntityId(this._genEntityId());
            } else if (equipment.hasSubtype(CARD_SUBTYPE.Talent)) { // 天赋
                hero.talentSlot = equipment.setEntityId(hero.talentSlot?.entityId ?? this._genEntityId());
            } else if (equipment.hasSubtype(CARD_SUBTYPE.Vehicle)) { // 特技
                if (hero.vehicleSlot?.[0].id == equipment.id) equipment.setEntityId(hero.vehicleSlot[0].entityId);
                hero.vehicleSlot = [equipment.setEntityId(this._genEntityId()), this.newSkill(equipment.id * 10 + 1)];
            }
        }
    }
    /**
     * 状态攻击
     */
    private async _doStatusAtk(stsTask: StatusTask) {
        if (!this._hasNotDieSwitch() || !this.taskQueue.isExecuting) return false;
        const { entityId, group, pidx, isSelf = 0, trigger = '', hidx: ohidx = this.players[pidx].hidx,
            discards = [], hcard, skid, name: atkname } = stsTask;
        let { isQuickAction } = stsTask;
        let { heros: aheros, hidx: ahidx, summons: aSummon, pile, handCards, combatStatus } = this.players[pidx];
        const { heros: eheros, hidx: eFrontIdx, combatStatus: eCombatStatus } = this.players[pidx ^ 1];
        ahidx = group == STATUS_GROUP.combatStatus ? ahidx : ohidx;
        const atkStatus = (group == STATUS_GROUP.heroStatus ? this.players[pidx].heros[ahidx].heroStatus : combatStatus).find(sts => sts.entityId == entityId)!;
        if (atkStatus == undefined) {
            this.taskQueue.removeTask({ source: entityId });
            console.info(`@_doStatusAtk: 状态[${atkname}]不存在`);
            if (this.taskQueue.isTaskEmpty()) this.emit(`statusAtk-${atkname}-notexist`, pidx, { isQuickAction });
            return true;
        }
        const stsres = atkStatus.handle(atkStatus, {
            heros: aheros,
            combatStatus,
            eheros,
            eCombatStatus,
            trigger,
            hidx: ahidx,
            pile,
            skid,
            summons: aSummon,
            hcards: handCards,
            discards,
            hcard,
            talent: getObjById(aheros, getHidById(atkStatus.id))?.talentSlot,
            isExecTask: true,
            randomInt: this._randomInt.bind(this),
        });
        const effectSelf = isSelf || stsres.heal || stsres.cmds?.some(({ cmd }) => cmd == 'heal');
        const { cmds: oexecmds = [] } = stsres.exec?.() ?? {};
        if (
            (!stsres.damage && !stsres.heal && !stsres.pdmg &&
                [...(stsres.cmds ?? []), ...oexecmds].every(({ cmd }) => !['heal', 'revive', 'addMaxHp'].includes(cmd))) ||
            (effectSelf ? aheros : eheros)[effectSelf ? ahidx : eFrontIdx].hp <= 0
        ) {
            this.emit(`statusAtk-${atkname}-cancel`, pidx, { isQuickAction });
            return true;
        }
        const stsreshidxs = stsres.hidxs ?? getBackHidxs(isSelf ? aheros : eheros);
        const atkedIdx = isSelf ? ahidx : (stsres.hidxs?.[0] ?? eFrontIdx);
        const { willDamages, dmgElements, players: players1, elTips, isQuickAction: iqa }
            = this._calcDamage(
                pidx,
                (stsres.element ?? ELEMENT_TYPE.Physical) as ElementType,
                new Array((isSelf ? aheros : eheros).length).fill(0).map((_, i) => [
                    i == atkedIdx ? (stsres.damage ?? -1) : -1,
                    (stsreshidxs.includes(i)) ? (stsres.pdmg ?? 0) : 0,
                ]),
                atkedIdx,
                this.players,
                { isAtkSelf: isSelf, skid, atkId: atkStatus.id, isQuickAction }
            );
        isQuickAction ||= iqa;
        assgin(this.players, players1);
        const oCnt = atkStatus.useCnt;
        const { cmds: execmds = [] } = stsres.exec?.(atkStatus, { heros: aheros, summons: aSummon, combatStatus }) ?? {};
        let willHeals: number[][] = [];
        const cmds = [...(stsres.cmds ?? []), ...execmds];
        if (stsres.heal) cmds.push({ cmd: 'heal', cnt: stsres.heal, hidxs: stsres.hidxs });
        if (cmds.length > 0) {
            const { willHeals: cmdheal } = this._doCmds(pidx, cmds, { isAction: !isQuickAction });
            if (cmdheal) willHeals = cmdheal;
        }
        if (!atkStatus.hasType(STATUS_TYPE.Hide)) {
            this._writeLog(`[${this.players[pidx].name}](${pidx})[${atkname}]发动${oCnt != atkStatus.useCnt ? ` ${oCnt}→${atkStatus.useCnt}` : ''}`);
        }
        const whLen = willHeals.length || 1;
        const selectedIdx = atkStatus.group == STATUS_GROUP.heroStatus ?
            getObjIdxById(aheros[ahidx].heroStatus.filter(s => !s.hasType(STATUS_TYPE.Hide)), atkStatus.id) :
            getObjIdxById(this.players[pidx].combatStatus.filter(s => !s.hasType(STATUS_TYPE.Hide)), atkStatus.id);
        for (let hli = 0; hli < whLen; ++hli) {
            const hl = willHeals[hli];
            const canAction = hli == whLen - 1;
            await this._doDamage(pidx ^ isSelf, {
                dmgSource: 'status',
                atkPidx: pidx ^ isSelf,
                atkHidx: -1,
                tarHidx: atkedIdx,
                willDamages,
                dmgElements,
                elTips,
                willHeals: hl,
                selected: isCdt(selectedIdx > -1, [pidx, atkStatus.group, ahidx, selectedIdx]),
            }, { atkname, canAction, isQuickAction, isActionInfo: false });
        }
        if (!atkStatus.hasType(STATUS_TYPE.Accumulate) && (atkStatus.useCnt == 0 || atkStatus.roundCnt == 0)) {
            atkStatus.type.splice(atkStatus.type.indexOf(STATUS_TYPE.Attack), 1);
            this._updateStatus(pidx, [], group == STATUS_GROUP.combatStatus ? combatStatus : aheros[ahidx].heroStatus, this.players);
        }
        return true;
    }
    /**
    * 检测技能发动
    * @param pidx 玩家序号
    * @param hidx 发动技能角色的索引idx
    * @param trigger 触发的时机
    * @param options players 玩家组, heros 角色组, eheros 敌方角色组, isExec 是否执行, getdmg 受到伤害数, cskid 只检测某技能id,
    *                heal 回血数, discards 我方弃牌, dmg 造成的伤害, hidxs 只检测某些序号角色, isExecTask 是否为执行任务, 
    *                isQuickAction 是否为快速行动, card 打出的卡牌, energyCnt 充能变化, source 触发id, sourceHidx 触发的角色序号hidx,
    *                restDmg 减伤
    * @returns isQuickAction: 是否为快速行动, heros 变化后的我方角色组, eheros 变化后的对方角色组, isTriggered 是否触发被动, restDmg 减伤
    *          dmgElement 被动附魔
    */
    private _detectSkill(pidx: number, otrigger: Trigger | Trigger[],
        options: {
            players?: Player[], heros?: Hero[], eheros?: Hero[], hidxs?: number[] | number, cskid?: number,
            isExec?: boolean, getdmg?: number[], heal?: number[], discards?: Card[], isExecTask?: boolean,
            dmg?: number[], isQuickAction?: boolean, card?: Card, energyCnt?: number[][], source?: number,
            sourceHidx?: number, type?: SkillType | SkillType[], restDmg?: number, isOnlyExec?: boolean,
        } = {}
    ) {
        const { players = this.players, isExec = true, getdmg = [], dmg = [], heal = [], discards = [], card, source, sourceHidx,
            isExecTask, heros = players[pidx].heros, eheros = players[pidx ^ 1].heros, cskid = -1, energyCnt, isOnlyExec } = options;
        let { hidxs = allHidxs(heros), isQuickAction, type = [], restDmg } = options;
        let isTriggered = false;
        let dmgElement: ElementType | undefined;
        const cmds: Cmds[] = [];
        const task: [() => void | Promise<void>, number?, number?][] = [];
        if (!Array.isArray(hidxs)) hidxs = [hidxs];
        if (!Array.isArray(type)) type = [type];
        for (const hidx of hidxs) {
            const hero = heros[hidx];
            const skills = hero.skills;
            const triggers: Trigger[] = [];
            if (typeof otrigger == 'string') triggers.push(otrigger);
            else triggers.push(...otrigger);
            for (let i = 0; i < skills.length; ++i) {
                const skill = skills[i];
                if (cskid > -1 && cskid != skill.id || type.length > 0 && !type.includes(skill.type)) continue;
                for (const trigger of triggers) {
                    const skillres = skill.handle({
                        skill,
                        hero,
                        combatStatus: players[pidx].combatStatus,
                        getdmg,
                        trigger,
                        heros,
                        eheros,
                        heal,
                        discards,
                        dmg,
                        talent: isCdt(!isExec && card?.id == getTalentIdByHid(hero.id), card) ?? hero.talentSlot,
                        source,
                        sourceHidx,
                        restDmg,
                        isExecTask,
                    });
                    if (this._hasNotTriggered(skillres.trigger, trigger)) continue;
                    isTriggered = true;
                    isQuickAction ||= !!skillres.isQuickAction;
                    restDmg = skillres.restDmg;
                    dmgElement = skillres.dmgElement;
                    cmds.push(...(skillres.cmds ?? []));
                    cmds.push({ cmd: 'getStatus', status: skillres.status, hidxs: [hidx] });
                    cmds.push({ cmd: 'getStatus', status: skillres.statusOppo, isOppo: true });
                    if (isExec || isOnlyExec) {
                        if (isExecTask || skillres.isNotAddTask || isOnlyExec) {
                            skillres.exec?.();
                            this._updateStatus(pidx, [], hero.heroStatus, players, { hidx, isQuickAction, isExec });
                        }
                        if (isExec && !skillres.isNotAddTask) {
                            if (!isExecTask) {
                                const args = clone(Array.from(arguments));
                                args[2] = {
                                    ...(args[2] ?? {}),
                                    isExecTask: true,
                                    cskid: skill.id,
                                    hidxs: hidx,
                                    players: undefined,
                                    heros: undefined,
                                    eheros: undefined,
                                };
                                this.taskQueue.addTask(`skill-${skill.name}:${trigger}`, args);
                            } else {
                                const skillHandle = async () => {
                                    this._writeLog(`[${players[pidx].name}](${pidx})[${hero.name}][${skill.name}]发动`, 'info');
                                    const { willHeals = [] } = this._doCmds(pidx, cmds, { isAction: !isQuickAction });
                                    const heroSelect = [pidx, hidx];
                                    const actionInfo: ActionInfo = {
                                        avatar: hero.UI.avatar,
                                        content: skill.name,
                                        subContent: SKILL_TYPE_NAME[skill.type],
                                    }
                                    if (willHeals[0]?.length) {
                                        await this._doDamage(pidx, {
                                            dmgSource: 'skill',
                                            atkPidx: pidx,
                                            atkHidx: -1,
                                            tarHidx: -1,
                                            willHeals: willHeals[0],
                                            willDamages: [],
                                            dmgElements: [],
                                            elTips: [],
                                        }, {
                                            atkname: skill.name,
                                            heroSelect,
                                            isQuickAction,
                                            actionInfo,
                                        });
                                    } else {
                                        this.emit(`_doSkill-${skill.name}:${trigger}`, pidx, { heroSelect, isQuickAction, actionInfo });
                                    }
                                }
                                task.push([skillHandle, 1e3]);
                            }
                        } else {
                            this._doCmds(pidx, cmds, { players, energyCnt, isExec, isAction: !isQuickAction });
                        }
                    } else {
                        this._doCmds(pidx, cmds, { players, energyCnt, isExec, isAction: !isQuickAction });
                    }
                }
            }
        }
        return { isQuickAction, cmds, isTriggered, task, restDmg, dmgElement }
    }
    /**
     * 检测装备发动
     * @param pidx 玩家序号
     * @param triggers 触发时机
     * @param options 配置项: isOnlyRead 是否只读, hidxs 当前角色索引, summons 当前玩家召唤物, switchHeroDiceCnt 切换角色需要骰子,
     *                        heal 回血量, heros 我方角色组, eheros 敌方角色组, hcard 使用的牌, isChargedAtk 是否为重击, skid 使用技能的id, 
     *                        taskMark 任务标记, isFallAtk 是否为下落攻击, isExec 是否执行task(配合新heros), isDieSwitch 是否为死后切换角色,
     *                        usedDice 使用的骰子数, dmgedHidx 被攻击角色的idx, minusDiceCard 用卡减骰子, isSummon 是否为召唤物攻击id
     *                        minusDiceSkillIds 用技能减骰子id, isExecTask 是否执行任务队列, getdmg 受到的伤害, isQuickAction 是否为快速攻击,
     *                        isUnshift 是否立即加入task, minusDiceSkill 技能当前被x减费后留存的骰子数, isEffectStatus 是否直接更新状态,
     *                        hcardsCnt 当前手牌数, energyCnt 充能变化, source 触发来源id, smgSource 造成伤害来源id, restDmg 减伤
     * @returns willHeals 将要回血, switchHeroDiceCnt 切换角色需要骰子, addDmg 条件加伤, heroStatus 新增角色状态, combatStatus 新增出战状态,
     *          isQuickAction 是否为快速攻击, supportCnt 支援区的变化数, restDmg 减伤
     */
    private _detectSlot(pidx: number, otriggers: Trigger | Trigger[], options: {
        players?: Player[], hidxs?: number | number[], summons?: Summon[], dmgedHidx?: number, taskMark?: [number, CardSubtype, number, Trigger, number],
        switchHeroDiceCnt?: number, heal?: number[], heros?: Hero[], eheros?: Hero[], minusDiceCard?: number, isUnshift?: boolean,
        hcard?: Card, isChargedAtk?: boolean, isFallAtk?: boolean, skid?: number, isSummon?: number, willSwitch?: boolean[][],
        isExec?: boolean, usedDice?: number, isQuickAction?: boolean, getdmg?: number[], dmg?: number[], isEffectStatus?: boolean,
        minusDiceSkillIds?: number[], minusDiceSkill?: number[][], cSlot?: Card | null, supportCnt?: number[][], sktype?: SkillType,
        hcardsCnt?: number, energyCnt?: number[][], source?: number, dmgSource?: number, isOnlyExec?: boolean, restDmg?: number,
        orderAfter?: string, sourceHidx?: number, hasDmg?: boolean,
    } = {}) {
        const triggers: Trigger[] = [];
        if (typeof otriggers == 'string') triggers.push(otriggers);
        else triggers.push(...otriggers);
        const { players = this.players, summons = players[pidx].summons, heal, hcard, dmgedHidx = players[pidx ^ 1].hidx,
            heros = players[pidx].heros, eheros = players[pidx ^ 1].heros, taskMark, isUnshift, minusDiceSkillIds = [],
            isChargedAtk, isFallAtk = players[pidx].isFallAtk, isExec = true, isSummon = -1, minusDiceSkill = [],
            skid = -1, sktype, usedDice = 0, getdmg, dmg, isEffectStatus, energyCnt, source, dmgSource, orderAfter,
            supportCnt = INIT_SUPPORTCNT(), willSwitch = players.map(p => p.heros.map(() => false)), isOnlyExec,
            sourceHidx, hasDmg } = options;
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        let { switchHeroDiceCnt = 0, minusDiceCard = 0, hidxs = [player.hidx], cSlot,
            isQuickAction, hcardsCnt = player.handCards.length, restDmg } = options;
        let addDmg = 0;
        const heroStatus: Status[] = [];
        const combatStatus: Status[] = [];
        const cmds: Cmds[] = [];
        const task: [() => void | Promise<void>, number?, number?][] = [];
        const ahidx = player.hidx;
        if (Array.isArray(hidxs)) {
            hidxs = hidxs.map(hi => (hi - ahidx + heros.length) % heros.length).sort().map(hi => (hi + ahidx) % heros.length);
        } else if (hidxs < 0) {
            hidxs = [];
        } else {
            hidxs = [hidxs];
        }
        let exwkhidxs: number[] = [];
        const detectSlot = (slot: Card | null | undefined, hidx: number) => {
            if (!slot || (taskMark && (!slot.hasSubtype(taskMark[1]) || slot.entityId != taskMark[2]))) return;
            const tcmds: Cmds[] = [];
            let isAddTask = false;
            let isDestroy = false;
            const isMinusDiceCard = hcard && hcard.cost + hcard.anydice > minusDiceCard;
            const destroySlot = () => {
                const hero = player.heros[hidx];
                if (hero.talentSlot?.entityId == slot.entityId) hero.talentSlot = null;
                if (hero.vehicleSlot?.[0].entityId == slot.entityId) hero.vehicleSlot = null;
                this._doSlotDestroy(pidx, hidx, slot, { players });
            }
            for (const trigger of triggers) {
                if (taskMark && taskMark[3] != trigger) continue;
                const slotres = slot.handle(slot, {
                    heros,
                    hero: heros[hidx],
                    combatStatus: player.combatStatus,
                    pile: player.pile,
                    eheros,
                    dmgedHidx,
                    ehcardsCnt: opponent.handCards.length,
                    summons,
                    trigger,
                    switchHeroDiceCnt,
                    isQuickAction,
                    hcard,
                    heal,
                    isChargedAtk,
                    isFallAtk,
                    hcards: player.handCards,
                    hcardsCnt,
                    dicesCnt: player.dice.length - usedDice,
                    skid,
                    sktype,
                    isSummon,
                    isExec,
                    minusDiceCard,
                    isMinusDiceTalent: isMinusDiceCard && hcard.hasSubtype(CARD_SUBTYPE.Talent) && hcard.userType == heros[hidx]?.id,
                    isMinusDiceCard,
                    isMinusDiceSkill: minusDiceSkillIds.includes(slot.entityId),
                    minusDiceSkill,
                    getdmg,
                    dmg,
                    playerInfo: player.playerInfo,
                    source,
                    sourceHidx,
                    dmgSource,
                    restDmg,
                    hasDmg,
                    isExecTask: !!taskMark,
                    randomInt: this._randomInt.bind(this),
                });
                if (this._hasNotTriggered(slotres.trigger, trigger)) {
                    if (taskMark?.[3] == trigger) this.emit(`_doSlot-${slot.name}(${slot.entityId}):${trigger}-cancel`, pidx, { isQuickAction });
                    if (!taskMark || triggers.includes(taskMark[3])) continue;
                }
                tcmds.push(...(slotres.execmds ?? []));
                cmds.push(...(slotres.execmds ?? []));
                isDestroy ||= !!slotres.isDestroy;
                if (slot.hasTag(CARD_TAG.Barrier)) restDmg = slotres.restDmg;
                if (taskMark || (!isExec && isOnlyExec) || (isExec && !slotres.execmds?.length && !slotres.isAddTask)) {
                    if (!taskMark && slotres.isDestroy) destroySlot();
                    slotres.exec?.();
                }
                isQuickAction ||= !!slotres.isQuickAction;
                isAddTask ||= !!slotres.isAddTask;
                switchHeroDiceCnt = Math.max(0, switchHeroDiceCnt - (slotres.minusDiceHero ?? 0));
                minusDiceCard += slotres.minusDiceCard ?? 0;
                addDmg += slotres.addDmgCdt ?? 0;
                if (trigger == 'will-killed' && slot.hasTag(CARD_TAG.NonDefeat)) exwkhidxs.push(hidx);
                const slotsts = this._getStatusById(slotres.status);
                heroStatus.push(...slotsts.filter(s => s.group == STATUS_GROUP.heroStatus));
                combatStatus.push(...slotsts.filter(s => s.group == STATUS_GROUP.combatStatus));
                if (isEffectStatus) {
                    if (heroStatus.length > 0) {
                        this._updateStatus(pidx, heroStatus, heros[hidx].heroStatus, players, { hidx });
                    }
                    if (combatStatus.length > 0) {
                        this._updateStatus(pidx, combatStatus, players[pidx].combatStatus, players);
                    }
                }
                const slotstsop = this._getStatusById(slotres.statusOppo);
                const hstop = slotstsop.filter(s => s.group == STATUS_GROUP.heroStatus);
                const cstop = slotstsop.filter(s => s.group == STATUS_GROUP.combatStatus);
                if (hstop.length > 0) {
                    (slotres.hidxs ?? [eheros.findIndex(h => h.isFront)]).forEach(hi => {
                        this._updateStatus(pidx ^ 1, hstop, eheros[hi].heroStatus, players, { hidx: hi });
                    });
                }
                if (cstop.length > 0) this._updateStatus(pidx ^ 1, cstop, players[pidx ^ 1].combatStatus, players);
                tcmds.forEach(({ cmd, cnt }) => cmd == 'discard' && (hcardsCnt -= cnt || 1));
                if (isExec && (tcmds.length > 0 || isAddTask)) {
                    if (!taskMark) {
                        const args = clone(Array.from(arguments));
                        args[2] = {
                            ...(args[2] ?? {}),
                            taskMark: [hidx, slot.subType[0], slot.entityId, trigger, heros[hidx].entityId],
                            players: undefined,
                            heros: undefined,
                            eheros: undefined,
                        };
                        this.taskQueue.addTask(`slot-${slot.name}(${slot.entityId}):${trigger}`, args, { isUnshift, orderAfter });
                    } else {
                        const slotHandle = async () => {
                            let willHeals: number[] = [];
                            let tarHidx = hidx;
                            let willDamages: number[][] = [];
                            let dmgElements: DamageType[] = [];
                            let elTips: [string, PureElementType, PureElementType][] = [];
                            this._writeLog(`[${player.name}](${player.pidx})[${heros[hidx].name}][${slot.name}]发动`, 'info');
                            if (!isAddTask || tcmds.length > 0) {
                                const { willHeals: cmdwh, atkedIdxs: [atkedIdx] = [hidx], bWillDamages: wdmg = [], bDmgElements: del = [], elTips: elt = [] }
                                    = this._doCmds(pidx, tcmds, { source: slot.id, isAction: !isQuickAction, isPriority: true });
                                willHeals = cmdwh?.[0] ?? [];
                                tarHidx = atkedIdx;
                                willDamages = wdmg;
                                dmgElements = del;
                                elTips = elt;
                            }
                            if (slotres.summon) this._updateSummon(pidx, this._getSummonById(slotres.summon));
                            const slotSelect = [pidx, hidx, SLOT_CODE[slot.subType[0]], +isDestroy];
                            if (willHeals.length || willDamages.length) {
                                await this._doDamage(pidx, {
                                    dmgSource: 'card',
                                    atkPidx: pidx,
                                    atkHidx: -1,
                                    tarHidx,
                                    willHeals,
                                    willDamages,
                                    dmgElements,
                                    elTips,
                                }, { atkname: slot.name, slotSelect, isQuickAction });
                            } else {
                                this.emit(`_doSlot-${slot.name}(${slot.entityId}):${trigger}`, pidx, { slotSelect, isQuickAction });
                            }
                            if (isDestroy) destroySlot();
                        };
                        task.push([slotHandle, 800]);
                    }
                } else {
                    if (slotres.summon) this._updateSummon(pidx, this._getSummonById(slotres.summon), players, isExec, { isSummon, supportCnt });
                }
                if (slotres.isOrTrigger) break;
            }
        }
        if (cSlot) {
            if (taskMark) {
                hidxs[0] = heros.find(h => h.entityId == taskMark[4])!.hidx;
                const hero = heros[hidxs[0]];
                cSlot = hero.equipments.find(s => s.entityId == cSlot!.entityId);
            }
            detectSlot(cSlot, hidxs[0] ?? player.hidx);
        } else {
            for (let hidx of hidxs) {
                if (taskMark) {
                    if (taskMark[0] != hidx) continue;
                    hidx = heros.find(h => h.entityId == taskMark[4])!.hidx;
                }
                const fHero = heros[hidx];
                const slots = fHero.equipments.slice();
                if (hcard && hcard.userType == fHero.id && slots.every(slot => slot.id != hcard.id)) slots.push(hcard);
                for (const slot of slots) {
                    detectSlot(slot, hidx);
                }
            }
        }
        let willHeals: number[] | undefined;
        const tasks: AtkTask[] = [];
        if (!isExec) {
            const { willHeals: cmdheal, tasks: cmdtasks = [] } = this._doCmds(pidx, cmds, {
                players, getdmg, supportCnt, willSwitch, energyCnt, isExec: false, source: cSlot?.id, isPriority: true,
            });
            willHeals = cmdheal?.reduce((a, c) => {
                c.forEach((hl, hli) => {
                    if (a[hli] == -1) a[hli] = hl;
                    else a[hli] += hl;
                });
                return a;
            }, new Array<number>(heros.length + eheros.length).fill(-1));
            tasks.push(...cmdtasks);
        }
        return {
            willHeals, nwkhidxs: hidxs.filter(hi => !exwkhidxs.includes(hi)), switchHeroDiceCnt, addDmg, tasks,
            supportCnt, heroStatus, combatStatus, isQuickAction, minusDiceCard, cmds, task, restDmg, hcardsCnt,
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
     *                isOnlyExec 是否只执行status的exec方法(用于calcDamage的预览), dmgedHidx 受到攻击的角色序号, fhidx 出战角色序号(用于切换时判断fromHidx),
     *                sourceHidx 触发来源角色序号, restDmg 减伤
     * @returns isQuickAction 是否有快速行动, minusDiceHero 减少切换角色的骰子,switchHeroDiceCnt 实际减少切换角色的骰子, cmds 要执行的命令, 
     *          statusIdsAndPidx 额外攻击, isInvalid 使用卡是否有效, minusDiceCard 使用卡减少骰子, getdmg 受到的伤害, restDmg 减伤
    */
    private _detectStatus(pidx: number, otypes: StatusType | StatusType[], otrigger: Trigger | Trigger[], options: {
        isQuickAction?: boolean, isExec?: boolean, isOnlyFront?: boolean, switchHeroDiceCnt?: number, heal?: number[],
        players?: Player[], hidxs?: number | number[], sktype?: SkillType, hcard?: Card, discards?: Card[], getdmg?: number[], slotsDestroy?: number[],
        isOnlyHeroStatus?: boolean, isOnlyCombatStatus?: boolean, heros?: Hero[], minusDiceCard?: number, isSummon?: number, cStatus?: Status,
        eheros?: Hero[], isUnshift?: boolean, isSwitchAtk?: boolean, dmgSource?: number, dmgedHidx?: number, isPriority?: boolean,
        hasDmg?: boolean, minusDiceSkillIds?: number[], source?: number, isChargedAtk?: boolean, isFallAtk?: boolean, supportCnt?: number[][],
        minusDiceSkill?: number[][], isOnlyExec?: boolean, fhidx?: number, dmgElement?: DamageType, skid?: number, willSwitch?: boolean[][],
        energyCnt?: number[][], dmg?: number[], sourceHidx?: number, taskMark?: [number, number, number, Trigger, number], restDmg?: number,
        orderAfter?: string,
    } = {}) {
        const types: StatusType[] = [];
        const triggers: Trigger[] = [];
        if (Array.isArray(otypes)) types.push(...otypes);
        else types.push(otypes);
        if (typeof otrigger == 'string') triggers.push(otrigger);
        else triggers.push(...otrigger);
        let { isQuickAction, switchHeroDiceCnt = 0, minusDiceCard = 0, restDmg } = options;
        const { isExec = true, isOnlyFront, players = this.players, hasDmg, orderAfter,
            hcard, isOnlyHeroStatus, isOnlyCombatStatus, heal, discards = [], getdmg = [], dmg = [],
            isUnshift, taskMark, sktype, isSummon = -1, dmgSource = -1, minusDiceSkillIds = [], source = -1,
            isChargedAtk, isFallAtk, cStatus, minusDiceSkill = [], isOnlyExec, dmgedHidx = -1,
            fhidx, dmgElement, skid = -1, supportCnt = INIT_SUPPORTCNT(), slotsDestroy, sourceHidx = -1,
            willSwitch = players.map(p => p.heros.map(() => false)), isPriority, energyCnt } = options;
        let isInvalid = false;
        const cmds: Cmds[] = [];
        const taskcmds: Cmds[] = [];
        const statusAtks: StatusTask[] = [];
        const statusAtksPre: StatusTask[] = [];
        let aWillHeals: number[] | undefined;
        let readySkill = -1;
        let stsFallAtk = false;
        const task: [() => void | Promise<void>, number?, number?][] = [];
        let addDmg = 0;
        let getDmg = 0;
        let multiDmg = 0;
        const pdmgs: [number, number[] | undefined, boolean][] = [];
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const pheros = options.heros ?? player.heros;
        const peheros = options.eheros ?? opponent.heros;
        const ahidx = player.hidx;
        let { hidxs = [ahidx] } = options;
        if (Array.isArray(hidxs)) {
            hidxs = hidxs.map(hi => (hi - ahidx + pheros.length) % pheros.length).sort().map(hi => (hi + ahidx) % pheros.length);
        } else if (hidxs < 0) {
            hidxs = [];
        } else {
            hidxs = [hidxs];
        }
        const detectStatus = (stses: Status | Status[], group: StatusGroup, hidx: number, triggers: Trigger[]) => {
            if (!Array.isArray(stses)) stses = [stses];
            const stsEntityIds = stses.map(sts => sts.entityId);
            for (const sts of stses) {
                const isDiffTaskMark = taskMark && ((group == STATUS_GROUP.heroStatus && taskMark[0] != hidx) || taskMark[1] != group || taskMark[2] != sts.entityId);
                if ((types.length > 0 && !sts.hasType(...types)) || isDiffTaskMark || !stsEntityIds.includes(sts.entityId) || (sts.useCnt == 0 && !sts.hasType(STATUS_TYPE.Accumulate, STATUS_TYPE.Attack))) continue;
                const isMinusDiceCard = hcard && hcard.cost + hcard.anydice > minusDiceCard;
                for (const trigger of triggers) {
                    if (trigger == 'status-destroy' && cStatus?.id == source && cStatus.entityId == 1) break;
                    const stsres = sts.handle(sts, {
                        heros: pheros,
                        combatStatus: player.combatStatus,
                        eheros: peheros,
                        eCombatStatus: opponent.combatStatus,
                        hidx,
                        dmgedHidx,
                        trigger,
                        phase: player.phase,
                        hcard,
                        talent: isCdt(!isExec && hcard?.id == getTalentIdByHid(getHidById(sts.id)), hcard) ??
                            getObjById(pheros, getHidById(sts.id))?.talentSlot,
                        discards,
                        heal,
                        summons: player.summons,
                        esummons: opponent.summons,
                        hcards: player.handCards,
                        ehcards: opponent.handCards,
                        pile: player.pile,
                        playerInfo: player.playerInfo,
                        skid,
                        sktype,
                        isSummon,
                        isFallAtk,
                        isChargedAtk,
                        dmgSource,
                        hasDmg,
                        dmgElement,
                        source,
                        sourceHidx,
                        switchHeroDiceCnt,
                        isQuickAction,
                        minusDiceCard,
                        isMinusDiceCard,
                        isMinusDiceTalent: isMinusDiceCard && hcard.hasSubtype(CARD_SUBTYPE.Talent) && hcard.userType == pheros[hidx]?.id,
                        isMinusDiceWeapon: isMinusDiceCard && hcard.hasSubtype(CARD_SUBTYPE.Weapon),
                        isMinusDiceArtifact: isMinusDiceCard && hcard.hasSubtype(CARD_SUBTYPE.Artifact),
                        isMinusDiceSkill: minusDiceSkillIds.includes(sts.entityId),
                        minusDiceSkill,
                        getdmg,
                        dmg,
                        slotsDestroy,
                        isExec,
                        isExecTask: !!taskMark,
                        isSelfRound: this.currentPlayerIdx == pidx,
                        restDmg,
                        randomInt: this._randomInt.bind(this),
                        randomInArr: this._randomInArr.bind(this),
                    });
                    if (this._hasNotTriggered(stsres.trigger, trigger)) {
                        if (taskMark?.[3] == trigger) this.emit(`_doStatus-${sts.name}(${sts.entityId}):${trigger}-cancel`, pidx, { isQuickAction });
                        if (!taskMark || triggers.includes(taskMark[3])) continue;
                    }
                    if (sts.hasType(STATUS_TYPE.Barrier, STATUS_TYPE.Shield)) {
                        restDmg = stsres.restDmg;
                    }
                    if (sts.hasType(STATUS_TYPE.AddDamage)) {
                        addDmg += stsres.addDmgCdt ?? 0;
                        getDmg += stsres.getDmg ?? 0;
                    }
                    if (sts.hasType(STATUS_TYPE.MultiDamage)) {
                        multiDmg += stsres.multiDmgCdt ?? 0;
                    }
                    switchHeroDiceCnt += stsres.addDiceHero ?? 0;
                    switchHeroDiceCnt = Math.max(0, switchHeroDiceCnt - (stsres.minusDiceHero ?? 0));
                    minusDiceCard += stsres.minusDiceCard ?? 0;
                    if (stsres.summon) this._updateSummon(pidx, this._getSummonById(stsres.summon), players, isExec, { isSummon, supportCnt });
                    if (!sts.hasType(STATUS_TYPE.Attack) && stsres.pdmg) pdmgs.push([stsres.pdmg, stsres.hidxs, !!stsres.isSelf]);
                    isInvalid ||= stsres.isInvalid ?? false;
                    isQuickAction ||= (hcard && !hcard.hasSubtype(CARD_SUBTYPE.Action)) || !!stsres.isQuickAction;
                    stsFallAtk ||= !!stsres.isFallAtk;
                    if (isExec || isOnlyExec) {
                        const oCnt = sts.useCnt;
                        const oPct = sts.perCnt;
                        const stsexecres = stsres.exec?.();
                        const stscmds = [...(stsres.cmds ?? []), ...(stsexecres?.cmds ?? [])];
                        if (isExec || !stsres.notPreview) (stsres.isAddTask ? taskcmds : cmds).push(...stscmds);
                        if (!sts.hasType(STATUS_TYPE.Attack) && stsres.heal) {
                            const { willHeals: cmdheal = [] } = this._doCmds(pidx, [{ cmd: 'heal', cnt: stsres.heal, hidxs: stsres.hidxs }],
                                { players, source: sts.id, isPriority: true });
                            aWillHeals = isCdt(cmdheal.length > 0, () => cmdheal!.reduce((a, c) => (mergeWillHeals(a, c), a)));
                        } else if (stscmds.some(({ cmd }) => ['heal', 'addMaxHp'].includes(cmd))) {
                            const { willHeals: cmdheal = [] } = this._doCmds(pidx, stscmds.filter(({ cmd }) => ['heal', 'addMaxHp'].includes(cmd)),
                                { players, source: sts.id, isPriority: true, isOnlyGetWillHeal: true });
                            aWillHeals = isCdt(cmdheal.length > 0, () => cmdheal!.reduce((a, c) => (mergeWillHeals(a, c), a)));
                        }
                        if (isExec && !isOnlyExec) {
                            const trgGetcard = ['drawcard', 'getcard'].includes(trigger) ? `(${hcard?.entityId ?? -1})` : '';
                            if (
                                (types.includes(STATUS_TYPE.Attack) && !trigger.startsWith('after') &&
                                    (stsres.damage || stsres.pdmg || stsres.heal)) ||
                                stscmds.some(({ cmd }) => ['heal', 'revive', 'addMaxHp'].includes(cmd))
                            ) {
                                (isUnshift ? statusAtksPre : statusAtks).push({
                                    id: sts.id,
                                    name: sts.name + `[card${trgGetcard}]`,
                                    entityId: sts.entityId,
                                    group,
                                    pidx,
                                    isSelf: +!!stsres.isSelf,
                                    trigger,
                                    hidx,
                                    skid,
                                    isQuickAction,
                                    discards,
                                    hcard,
                                    source: stsres.source,
                                });
                            } else {
                                if (stsres.isAddTask) {
                                    let intvl = 1000;
                                    if (stsres.damage || stsres.pdmg) intvl += 1000;
                                    if (!taskMark) {
                                        const args = clone(Array.from(arguments));
                                        args[3] = {
                                            ...(args[3] ?? {}),
                                            taskMark: [hidx, group, sts.entityId, trigger, pheros[hidx].entityId],
                                            players: undefined,
                                        };
                                        this.taskQueue.addTask(`status-${sts.name}(${sts.entityId}):${trigger}${trgGetcard}`, args, { isUnshift, isDmg: true, orderAfter });
                                    } else {
                                        const statusHandle = async () => {
                                            const { hidx: ahidx, heros, combatStatus } = this.players[pidx];
                                            this._doCmds(pidx, stscmds, {
                                                hidxs: [group == STATUS_GROUP.combatStatus ? ahidx : hidx],
                                                withCard: hcard,
                                                trigger,
                                                source: sts.id,
                                                isPriority: true,
                                            });
                                            const statuses = group == STATUS_GROUP.heroStatus ?
                                                this.players[pidx].heros[hidx].heroStatus :
                                                this.players[pidx].combatStatus;
                                            const curStatus = statuses.find(s => s.entityId == sts.entityId);
                                            if (!curStatus) return;
                                            stsres.exec?.(curStatus, { heros, combatStatus });
                                            if (!curStatus.hasType(STATUS_TYPE.TempNonDestroy, STATUS_TYPE.Accumulate) && (curStatus.useCnt == 0 || curStatus.roundCnt == 0)) {
                                                curStatus.type.push(STATUS_TYPE.TempNonDestroy);
                                            }
                                            const useCntChange = `${oCnt}→${curStatus.useCnt}`;
                                            const perCntChange = `${oPct}→${curStatus.perCnt}`;
                                            this._writeLog(`[${player.name}](${player.pidx})${trigger}:${sts.name}${sts.useCnt != -1 ? `.useCnt:${useCntChange}` : ''}${curStatus.perCnt != -1 ? `.perCnt:${perCntChange}` : ''}`, 'system');
                                            if (!curStatus.hasType(STATUS_TYPE.Hide)) this._writeLog(`[${player.name}](${player.pidx})[${curStatus.name}]发动${oCnt != curStatus.useCnt ? ` ${useCntChange}` : ''}`, stsres.notLog ? 'system' : 'log');
                                            const flag = `_doStatus-${group == STATUS_GROUP.heroStatus ? 'hero' : 'combat'}Status-task-${curStatus.name}(${curStatus.entityId})`;
                                            const curStatusIdx = statuses.filter(s => !s.hasType(STATUS_TYPE.Hide)).findIndex(s => s.entityId == sts.entityId);
                                            if (curStatusIdx == -1) intvl = 0;
                                            this.emit(flag, pidx, { isQuickAction, statusSelect: isCdt(curStatusIdx > -1, [pidx, group, hidx, curStatusIdx]) });
                                            if ((curStatus.useCnt == 0 || curStatus.roundCnt == 0) && !curStatus.hasType(STATUS_TYPE.Accumulate)) {
                                                curStatus.type.splice(curStatus.type.indexOf(STATUS_TYPE.TempNonDestroy), 1);
                                            }
                                        };
                                        task.push([statusHandle, intvl]);
                                    }
                                } else {
                                    this._writeLog(`[${player.name}](${player.pidx})${trigger}:${sts.name}${sts.useCnt != -1 ? `.useCnt:${oCnt}→${sts.useCnt}` : ''}${sts.perCnt != -1 ? `.perCnt:${oPct}→${sts.perCnt}` : ''}`, 'system');
                                    this._writeLog(`[${player.name}](${player.pidx})[${sts.name}]发动${oCnt != sts.useCnt ? ` ${oCnt}→${sts.useCnt}` : ''}`, isCdt(sts.hasType(STATUS_TYPE.Hide), stsres.notLog ? 'system' : 'log'));
                                    this._doCmds(pidx, stscmds, { players, hidxs: [hidx], withCard: hcard, source: sts.id, isPriority: true });
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
        }
        if (cStatus) {
            const chidx = taskMark && cStatus.group == STATUS_GROUP.heroStatus ?
                pheros.find(h => h.entityId == taskMark[4])!.hidx : (hidxs?.[0] ?? player.hidx);
            if (!pheros[chidx].heroStatus.some(s => s.hasType(STATUS_TYPE.NonAction)) || !triggers.includes('useReadySkill')) {
                detectStatus(cStatus, cStatus.group, chidx, triggers);
            }
        } else {
            for (let i = 0; i < pheros.length; ++i) {
                const hidx = (i + (fhidx ?? player.hidx)) % pheros.length;
                const chero = pheros[hidx];
                if (chero.heroStatus.some(sts => sts.hasType(STATUS_TYPE.NonAction)) && triggers.includes('useReadySkill')) continue;
                if ((hidxs ?? [hidx]).includes(hidx)) {
                    if (!isOnlyCombatStatus && (chero.isFront || !isOnlyFront)) {
                        detectStatus(chero.heroStatus, STATUS_GROUP.heroStatus, hidx, triggers);
                    }
                    if (i == 0 && !isOnlyHeroStatus) detectStatus(player.combatStatus, STATUS_GROUP.combatStatus, hidx, triggers);
                }
            }
        }
        if (isExec && !taskMark) {
            this.taskQueue.addStatusAtk(statusAtks.map(s => ({ ...s, isQuickAction })), { isUnshift, isPriority });
            this.taskQueue.addStatusAtk(statusAtksPre.map(s => ({ ...s, isQuickAction })), { isUnshift: true, isPriority });
        }
        if (readySkill > -1) this.delay(1200, () => this._useSkill(pidx, readySkill, { isReadySkill: true }));
        let bWillHeals: number[] | undefined;
        const tasks: AtkTask[] = [];
        if (!isExec) {
            cmds.push(...taskcmds);
            const { willHeals: cmdheal = [], tasks: cmdtasks = [] } = this._doCmds(pidx, cmds, {
                players,
                heros: pheros,
                eheros: peheros,
                supportCnt,
                willSwitch,
                energyCnt,
                getdmg,
                withCard: hcard,
                isAction: !isQuickAction,
                source: cStatus?.id,
                isExec: false,
            });
            bWillHeals = isCdt(cmdheal.length > 0, () => cmdheal!.reduce((a, c) => (mergeWillHeals(a, c), a)));
            tasks.push(...cmdtasks);
        }
        return {
            isQuickAction, switchHeroDiceCnt, isInvalid, minusDiceCard, task, tasks, addDmg, getDmg, multiDmg,
            aWillHeals, bWillHeals, supportCnt, pdmgs, cmds, isFallAtk: stsFallAtk, restDmg,
        }
    }
    /**
     * 检测角色区域
     * @param pidx 玩家序号
     * @param otrigger 触发条件
     * @param options 配置项
     */
    private _detectSlotAndStatus(pidx: number, otrigger: Trigger | Trigger[], options: {
        types?: StatusType | StatusType[], players?: Player[], hidxs?: number | number[], summons?: Summon[], ehidx?: number,
        switchHeroDiceCnt?: number, heal?: number[], minusDiceCard?: number, isUnshift?: boolean, hcard?: Card, orderAfter?: string,
        isChargedAtk?: boolean, isFallAtk?: boolean, skid?: number, supportCnt?: number[][], willSwitch?: boolean[][],
        isSummon?: number, isExec?: boolean, usedDice?: number, isQuickAction?: boolean, getdmg?: number[], dmg?: number[],
        minusDiceSkillIds?: number[], minusDiceSkill?: number[][], phase?: number, sktype?: SkillType, isEffectStatus?: boolean,
        discards?: Card[], cStatus?: Status, isSwitchAtk?: boolean, dmgSource?: number, dmgedHidx?: number, isOnlyFront?: boolean,
        hasDmg?: boolean, source?: number, isOnlyExec?: boolean, fhidx?: number, dmgElement?: DamageType, isPriority?: boolean,
        hcardsCnt?: number, energyCnt?: number[][], sourceHidx?: number, isOnlyHeroStatus?: boolean, restDmg?: number, equipHidx?: number,
    }) {
        const triggers: Trigger[] = [];
        if (typeof otrigger == 'string') triggers.push(otrigger);
        else triggers.push(...otrigger);
        const { players = this.players, hcard, equipHidx } = options;
        const { hidx: ahidx, heros, combatStatus: aCombatStatus } = players[pidx];
        let { types = [], hidxs = [ahidx], switchHeroDiceCnt, restDmg, hcardsCnt } = options;
        if (Array.isArray(hidxs)) {
            hidxs = hidxs.map(hi => (hi - ahidx + heros.length) % heros.length).sort().map(hi => (hi + ahidx) % heros.length);
        } else if (hidxs < 0) {
            hidxs = [];
        } else {
            hidxs = [hidxs];
        }
        options.minusDiceCard ??= 0;
        if (!Array.isArray(types)) types = [types];
        let isInvalid = false;
        const cmds: Cmds[] = [];
        let aWillHeals: number[] | undefined;
        let addDmg = 0;
        let getDmg = 0;
        let multiDmg = 0;
        const pdmgs: [number, number[] | undefined, boolean][] = [];
        const heroStatus: Status[] = [];
        const combatStatus: Status[] = [];
        const tasks: AtkTask[] = [];
        let bWillHeals: number[] | undefined;
        let isQuickAction = false;
        let minusDiceCard = 0;
        let isFallAtk = false;
        let isDie = true;
        for (const hidx of hidxs) {
            const heroField = this._getHeroField(pidx, {
                players, hidx, hcard, equipHidx, includeCombatStatus: triggers.some(trg => trg.includes('switch-to')),
            });
            for (const field of heroField) {
                if ('group' in field) {
                    if (triggers.includes('will-killed') && !isDie && field.hasType(STATUS_TYPE.NonDefeat)) continue;
                    const { isQuickAction: stsIqa, isInvalid: stsIsInvalid, minusDiceCard: stsMinusDiceCard, addDmg: stsAddDmg, getDmg: stsGetDmg,
                        switchHeroDiceCnt: stsSwitchHeroDiceCnt, aWillHeals: stsAWhl, multiDmg: stsMultiDmg,
                        bWillHeals: stsBWhl, pdmgs: stsPdmgs, cmds: stsCmds, isFallAtk: stsFallAtk, tasks: ststasks, restDmg: stsRestDmg }
                        = this._detectStatus(pidx, types, triggers, { ...options, cStatus: field, hidxs: hidx });
                    addDmg += stsAddDmg;
                    getDmg += stsGetDmg;
                    multiDmg += stsMultiDmg;
                    options.switchHeroDiceCnt = stsSwitchHeroDiceCnt;
                    options.minusDiceCard = stsMinusDiceCard;
                    options.restDmg = stsRestDmg;
                    pdmgs.push(...stsPdmgs);
                    isInvalid ||= stsIsInvalid;
                    isFallAtk ||= stsFallAtk;
                    options.isQuickAction ||= stsIqa;
                    cmds.push(...stsCmds);
                    tasks.push(...ststasks);
                    if (!aWillHeals) aWillHeals = stsAWhl;
                    else mergeWillHeals(aWillHeals, stsAWhl);
                    if (!bWillHeals) bWillHeals = stsBWhl;
                    else mergeWillHeals(bWillHeals, stsBWhl);
                    if (triggers.includes('will-killed') && field.hasType(STATUS_TYPE.NonDefeat)) isDie = false;
                    if (triggers.includes('turn-end') && field.roundCnt > 0) --field.roundCnt;
                } else {
                    if (triggers.includes('will-killed') && !isDie && field.hasTag(CARD_TAG.NonDefeat)) continue;
                    const { switchHeroDiceCnt: slotSwitchHeroDiceCnt, addDmg: slotAddDmg, isQuickAction: slotIqa, hcardsCnt: slotHcardsCnt,
                        heroStatus: slotHeroStatus, willHeals: slotWhl, combatStatus: slotCombatSatatus, restDmg: slotRestDmg,
                        minusDiceCard: slotMinusDiceCard, cmds: slotCmds, tasks: slottasks }
                        = this._detectSlot(pidx, triggers, { ...options, cSlot: field, hidxs: hidx });
                    options.switchHeroDiceCnt = slotSwitchHeroDiceCnt;
                    addDmg += slotAddDmg;
                    heroStatus.push(...slotHeroStatus);
                    combatStatus.push(...slotCombatSatatus);
                    options.isQuickAction ||= slotIqa;
                    options.minusDiceCard = slotMinusDiceCard;
                    options.restDmg = slotRestDmg;
                    options.hcardsCnt = slotHcardsCnt;
                    cmds.push(...slotCmds);
                    if (!bWillHeals) bWillHeals = slotWhl;
                    else mergeWillHeals(bWillHeals, slotWhl);
                    tasks.push(...slottasks);
                    if (triggers.includes('will-killed') && field.hasTag(CARD_TAG.NonDefeat)) isDie = false;
                }
            }
            ({ minusDiceCard, switchHeroDiceCnt, restDmg, hcardsCnt } = options);
            isQuickAction ||= !!options.isQuickAction;
            if (triggers.includes('turn-end')) {
                this._updateStatus(pidx, [], heros[hidx].heroStatus, players, { hidx, isExec: true });
                if (hidx == ahidx) this._updateStatus(pidx, [], aCombatStatus, players, { hidx: ahidx, isExec: true });
            }
        }
        return {
            minusDiceCard, switchHeroDiceCnt, isInvalid, cmds, aWillHeals, bWillHeals, isQuickAction, restDmg, hcardsCnt,
            addDmg, getDmg, multiDmg, pdmgs, heroStatus, combatStatus, isFallAtk, isDie, tasks,
        }
    }
    /**
     * 召唤物效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param options isUnshift 是否前插入事件, csummon 当前的召唤物, isExec 是否执行召唤物攻击, isExecTask 是否执行任务队列,
     *                hcard 使用的牌, minusDiceSkillIds 减骰id, skid 使用技能id, tsummon 执行task的召唤物, hidx 当前出战角色,
     *                players 当前玩家数组, eheros 当前敌方角色组, tround 当前触发回合, minusDiceSkill 技能当前被x减费后留存的骰子数,
     *                switchHeroDiceCnt 切换需要的骰子, dmgedHidx 受伤角色索引, atkHidx 攻击角色索引, getdmg 受伤量
     * @returns smncmds 命令集, addDmg 加伤, switchHeroDiceCnt 切换需要的骰子, minusDiceSkill 用技能减骰子, willheals 将回血数
     */
    private _detectSummon(pidx: number, ostate: Trigger | Trigger[],
        options: {
            isUnshift?: boolean, csummon?: Summon[], isExec?: boolean, isExecTask?: boolean, hidx?: number, isSummon?: number,
            hcard?: Card, minusDiceSkillIds?: number[], skid?: number, tsummon?: Summon[], isQuickAction?: boolean, supportCnt?: number[][],
            players?: Player[], heros?: Hero[], eheros?: Hero[], tround?: number, minusDiceSkill?: number[][], willSwitch?: boolean[][],
            energyCnt?: number[][], switchHeroDiceCnt?: number, dmgedHidx?: number, atkHidx?: number, getdmg?: number[],
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostate == 'string') states.push(ostate);
        else states.push(...ostate);
        const { players = this.players } = options;
        const player = players[pidx];
        const { isUnshift, csummon, isExec = true, minusDiceSkillIds = [], hcard, isExecTask,
            skid = -1, tsummon, tround = 0, hidx = player.hidx, heros = player.heros,
            eheros = players[pidx ^ 1].heros, willSwitch = players.map(p => p.heros.map(() => false)),
            minusDiceSkill = [], isSummon, supportCnt = INIT_SUPPORTCNT(), energyCnt, dmgedHidx,
            atkHidx = player.hidx, getdmg = [] } = options;
        let { isQuickAction, switchHeroDiceCnt = 0 } = options;
        const isChargedAtk = player.dice.length % 2 == 0;
        const smncmds: Cmds[] = [];
        let addDmg = 0;
        let smnres: SummonHandleRes | undefined;
        const task: [() => void | Promise<void>, number?, number?][] = [];
        const summons: Summon[] = tsummon ?? csummon ?? [...player.summons];
        for (const state of states) {
            for (const summon of summons) {
                const hid = getHidById(summon.id);
                const summonres = summon.handle(summon, {
                    trigger: state,
                    heros,
                    combatStatus: player.combatStatus,
                    summons: player.summons,
                    eheros,
                    hidx,
                    isChargedAtk,
                    isFallAtk: player.isFallAtk,
                    hcard,
                    talent: isCdt(!isExec && hcard?.id == getTalentIdByHid(hid), hcard) ?? getObjById(heros, hid)?.talentSlot,
                    isExec,
                    isMinusDiceSkill: minusDiceSkillIds.includes(summon.entityId),
                    minusDiceSkill,
                    skid,
                    tround,
                    isExecTask,
                    isSummon,
                    switchHeroDiceCnt,
                    isQuickAction,
                    dmgedHidx,
                    atkHidx,
                    getdmg,
                    reset: state == 'enter',
                });
                if (this._hasNotTriggered(summonres.trigger, state)) continue;
                isQuickAction ||= !!summonres.isQuickAction;
                smnres = summonres;
                addDmg += summonres.addDmgCdt ?? 0;
                switchHeroDiceCnt += summonres.addDiceHero ?? 0;
                switchHeroDiceCnt = Math.max(0, switchHeroDiceCnt - (summonres.minusDiceHero ?? 0));
                if (summonres.isNotAddTask) {
                    if (summonres.exec && isExec) {
                        const { cmds = [] } = summonres.exec?.({
                            summon,
                            heros,
                            eheros,
                            combatStatus: player.combatStatus,
                            eCombatStatus: players[pidx ^ 1].combatStatus,
                        }) ?? {};
                        this._doCmds(pidx, cmds, { players, isExec, isPriority: true });
                        smncmds.push(...cmds);
                    }
                    continue;
                }
                if (summonres.cmds) {
                    smncmds.push(...summonres.cmds);
                    this._doCmds(pidx, summonres.cmds, { heros, isExec, isPriority: true });
                }
                if (isExec) {
                    if (!isExecTask) {
                        const args = clone(Array.from(arguments));
                        args[2] = {
                            ...(args[2] ?? {}),
                            isExecTask: true,
                            tsummon: [summon],
                            players: undefined,
                            heros: undefined,
                            eheros: undefined,
                        };
                        this.taskQueue.addTask(`summon-${summon.name}(${summon.entityId}):${state}`, args, { isUnshift, isDmg: true });
                    } else {
                        const summonHandle1 = async () => {
                            let { heros: aHeros, hidx: ahidx, summons: aSummons, combatStatus } = this.players[pidx];
                            let { heros: eHeros, hidx: eFrontIdx, combatStatus: eCombatStatus } = this.players[pidx ^ 1];
                            const smn = getObjById(aSummons, summon.id)!;
                            const oCnt = smn.useCnt;
                            const oPct = smn.perCnt;
                            const smnexecres = summonres.exec?.({
                                summon: smn,
                                heros: aHeros,
                                eheros: eHeros,
                                combatStatus,
                                eCombatStatus,
                            });
                            this._writeLog(`[${player.name}](${player.pidx})${state}:${smn.name}${oCnt != -1 ? `.useCnt:${oCnt}→${smn.useCnt}` : ''}${smn.perCnt != -1 ? `.perCnt:${oPct}→${smn.perCnt}` : ''}`, 'system');
                            const selected = [pidx, getObjIdxById(aSummons, smn.id), +(smn.useCnt == 0 && state == 'phase-end')];
                            if (smnexecres?.cmds) {
                                const damages: SmnDamageHandle = (isOppo: boolean = true, cnt?: number, element?: DamageType, hidxs?: number[]) => {
                                    const dmgElement = element ?? smn.element;
                                    return {
                                        dmgElement,
                                        willDamages: new Array((isOppo ? eHeros : aHeros).length).fill(0).map((_, i) => [
                                            (hidxs ?? [isOppo ? eFrontIdx : ahidx]).includes(i) && dmgElement != DAMAGE_TYPE.Pierce ? (cnt ?? smn.damage ?? -1) : -1,
                                            (hidxs ?? getBackHidxs(eHeros)).includes(i) ? element == DAMAGE_TYPE.Pierce ? (cnt ?? 0) : (smnres?.pdmg ?? smn.pdmg) : 0,
                                        ]),
                                    }
                                }
                                const { atkedIdxs: [tarHidx] = [-1], bWillDamages: willDamages = [],
                                    willHeals: [willHeals] = [], bDmgElements: dmgElements = [], elTips = [] }
                                    = this._doCmds(pidx, smnexecres.cmds, {
                                        heal: isCdt(smn.shieldOrHeal > 0, smn.shieldOrHeal),
                                        damages,
                                        isSummon: smn.id,
                                        isUnshift: true,
                                    });
                                selected[2] = +(smn.useCnt == 0 && state == 'phase-end');
                                const tround = summonres.tround ?? 0;
                                await this._doDamage(pidx, {
                                    dmgSource: 'summon',
                                    atkPidx: pidx,
                                    atkHidx: -1,
                                    tarHidx,
                                    willDamages,
                                    willHeals,
                                    dmgElements,
                                    elTips,
                                    selected,
                                }, { atkname: smn.name, summonSelect: selected, isQuickAction, canAction: tround == 0 });
                                if (smn.useCnt == 0) {
                                    this._updateSummon(pidx, [], this.players, true, { destroy: smn.entityId, trigger: state });
                                }
                                if (tround > 0) {
                                    const args = clone(Array.from(arguments));
                                    args[2] = {
                                        ...(args[2] ?? {}),
                                        tsummon: [smn],
                                        tround,
                                        players: undefined,
                                        heros: undefined,
                                        eheros: undefined,
                                    };
                                    this.taskQueue.addTask(`summon-${smn.name}(${smn.entityId})r${tround}:${state}`, args, { isUnshift: true, isDmg: true });
                                }
                            } else {
                                this.emit(`_doSummon-${smn.name}(${smn.entityId}):${state}`, pidx, { summonSelect: selected, isQuickAction });
                            }
                        };
                        task.push([summonHandle1, 1e3]);
                    }
                }
            }
        }
        let willHeals: number[][] | undefined;
        if (!isExec) {
            ({ willHeals } = this._doCmds(pidx, smncmds, { supportCnt, willSwitch, energyCnt, isExec: false }));
        }
        return { smncmds, addDmg, switchHeroDiceCnt, willHeals, isQuickAction, csummon, task, smnres }
    }
    /**
     * 支援物效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param options switchHeroDiceCnt 切换需要的骰子, hcard 使用的牌, players 最新的玩家信息, skid 使用的技能id
     *                hidx 将要切换的玩家, minusDiceSkill 用技能减骰子, isExecTask 是否执行任务队列, isExec 是否执行, firstPlayer 先手玩家pidx,
     *                getdmg 受伤量, heal 回血量, getcard 本次摸牌数, discardCnt 本次舍弃牌数, minusDiceSkill 技能当前被x减费后留存的骰子数, 
     *                csummon 选中的召唤物
     * @returns isQuickAction 是否快速行动, cmds 命令集, outStatus 出战状态, minusDiceHero 减少切换角色骰子, supportCnt 支援区数量,
     *          minusDiceCard 减少使用卡骰子, minusDiceSkill 用技能减骰子
     */
    private _detectSupport(pidx: number, ostates: Trigger | Trigger[],
        options: {
            switchHeroDiceCnt?: number, hcard?: Card, players?: Player[], firstPlayer?: number, minusDiceSkill?: number[][], sktype?: SkillType,
            isExec?: boolean, isQuickAction?: boolean, minusDiceCard?: number, csupport?: Support[], hidx?: number, skid?: number,
            minusDiceSkillIds?: number[], isExecTask?: boolean, getdmg?: number[], heal?: number[], discardCnt?: number, supportCnt?: number[][],
            energyCnt?: number[][], csummon?: Summon,
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostates == 'string') states.push(ostates);
        else states.push(...ostates);
        const { hcard, players = this.players, isExec = true, firstPlayer = -1, hidx = -1, skid = -1, sktype,
            isExecTask, csupport, getdmg, heal, discardCnt = 0, minusDiceSkillIds = [], minusDiceSkill = [],
            supportCnt = INIT_SUPPORTCNT(), energyCnt, csummon } = options;
        let { switchHeroDiceCnt = 0, isQuickAction = false, minusDiceCard = 0 } = options;
        const cmdsAll: Cmds[] = [];
        const task: [() => void | Promise<void>, number?, number?][] = [];
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const destroys: number[] = [];
        const exeSupport = csupport ?? player.supports;
        const lastSupport: Support[] = [];
        const willSummons: Summon[][] = players.map(() => []);
        let isLast = false;
        const detectSupport = (support: Support, stidx: number) => {
            for (const state of states) {
                const supportres = support.handle(support, {
                    dices: players[pidx].dice,
                    trigger: state,
                    heros: player.heros,
                    supports: player.supports,
                    pile: player.pile,
                    eheros: opponent.heros,
                    eCombatStatus: opponent.combatStatus,
                    eSupports: opponent.supports,
                    hidxs: [player.hidx],
                    hidx,
                    card: hcard,
                    hcards: players[pidx].handCards.concat(players[pidx].UI.willGetCard.cards),
                    csummon,
                    isFirst: firstPlayer == pidx,
                    playerInfo: player.playerInfo,
                    eplayerInfo: opponent.playerInfo,
                    minusDiceCard,
                    skid,
                    sktype,
                    switchHeroDiceCnt,
                    isQuickAction,
                    isMinusDiceTalent: hcard && hcard.hasSubtype(CARD_SUBTYPE.Talent) && hcard.cost + hcard.anydice > minusDiceCard,
                    isMinusDiceSkill: minusDiceSkillIds.includes(support.entityId),
                    minusDiceSkill,
                    getdmg,
                    heal,
                    discardCnt,
                    epile: opponent.pile,
                    isExecTask,
                    getCardIds: this._getCardIds.bind(this),
                });
                if (supportres.isLast && !isLast) lastSupport.push(support);
                if (this._hasNotTriggered(supportres.trigger, state) || (supportres.isLast && !isLast)) continue;
                isQuickAction ||= !!supportres.isQuickAction;
                switchHeroDiceCnt = Math.max(0, switchHeroDiceCnt - (supportres.minusDiceHero ?? 0));
                minusDiceCard += supportres.minusDiceCard ?? 0;
                supportCnt[pidx][stidx] += supportres.supportCnt ?? 0;
                const supportexecres = supportres.exec?.(clone(support), {
                    isExecTask: false,
                    csummon: isCdt(!isExec, csummon),
                }) ?? {};
                cmdsAll.push(...(supportexecres.cmds ?? []));
                if (isExec) {
                    if (supportres.isNotAddTask) {
                        const supportexecres = supportres.exec?.(support, { isExecTask: true }) ?? {};
                        this._doCmds(pidx, supportexecres.cmds)
                        if (supportexecres.isDestroy) destroys.push(stidx);
                    } else {
                        if (!isExecTask) {
                            const args = clone(Array.from(arguments));
                            args[2] = {
                                ...(args[2] ?? {}),
                                isExecTask: true,
                                csupport: [support],
                                players: undefined,
                            };
                            this.taskQueue.addTask(`support-${support.card.name}(${support.entityId}):${state}`, args, { isDmg: true });
                        } else {
                            const supportHandle = async () => {
                                const player = this.players[pidx];
                                const spt = player.supports.find(s => s.entityId == support.entityId);
                                if (!spt) throw new Error(`@supportHandle: support not found\n suport:${supportToString(support)}`);
                                const oCnt = spt.cnt;
                                const oPct = spt.perCnt;
                                const smnIdx = player.summons.findIndex(smn => smn.entityId == csummon?.entityId);
                                const supportexecres = supportres.exec?.(spt, {
                                    isExecTask: true,
                                    csummon: player.summons[smnIdx],
                                    supports: player.supports,
                                    eSupports: opponent.supports,
                                }) ?? {};
                                this._writeLog(`[${player.name}](${player.pidx})[${spt.card.name}]发动${oCnt != spt.cnt ? ` ${oCnt}→${spt.cnt}` : ''}`);
                                this._writeLog(`[${player.name}](${player.pidx})${state}:${spt.card.name}(${spt.entityId}).cnt:${oCnt}→${spt.cnt}.perCnt:${oPct}→${spt.perCnt}`, 'system');
                                const { willHeals } = this._doCmds(pidx, supportexecres.cmds);
                                if (supportres.summon) this._updateSummon(pidx, this._getSummonById(supportres.summon), this.players);
                                const supportSelect = [pidx, player.supports.findIndex(s => s.entityId == spt.entityId), +!!supportexecres.isDestroy];
                                if (willHeals?.length) {
                                    willHeals.forEach(async wh => {
                                        await this._doDamage(pidx, {
                                            dmgSource: 'support',
                                            atkPidx: pidx,
                                            atkHidx: -1,
                                            tarHidx: hidx,
                                            willHeals: wh,
                                            willDamages: [],
                                            dmgElements: [],
                                            elTips: [],
                                        }, { atkname: spt.card.name, supportSelect, isQuickAction });
                                    });
                                } else {
                                    this.emit(`_doSupport-${spt.card.name}(${spt.entityId}):${state}`, pidx, { supportSelect, isQuickAction });
                                }
                                if (supportexecres.isDestroy) {
                                    assgin(players[pidx].supports, players[pidx].supports.filter(s => s.entityId != spt.entityId));
                                    this._doSupportDestroy(pidx, 1);
                                }
                            }
                            if (player.supports.find(s => s.entityId == support.entityId)) task.push([supportHandle, 500]);
                        }
                    }
                } else if (supportres.summon) {
                    willSummons[pidx].push(...this._getSummonById(supportres.summon).map(smn => {
                        const willSmn = this._getSummonById(smn.handle(smn).willSummon)[0] ?? smn;
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
        let willHeals: number[] | undefined;
        const tasks: AtkTask[] = [];
        if (isExec) assgin(player.supports, player.supports.filter((_, stidx) => !destroys.includes(stidx)));
        else {
            const { willHeals: cmdheal = [], tasks: cmdtasks = [] } = this._doCmds(pidx, cmdsAll, { players, supportCnt, energyCnt, isAction: !isQuickAction, isExec: false });
            willHeals = isCdt(cmdheal.length > 0, () => cmdheal!.reduce((a, c) => (mergeWillHeals(a, c), a)));
            tasks.push(...cmdtasks);
        }
        return { isQuickAction, switchHeroDiceCnt, supportCnt, minusDiceCard, willSummons, willHeals, task, tasks }
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
        assgin(this.players[pidx].dice, ndices);
        return this._rollDice(pidx);
    }
    /**
     * 执行命令集
     * @param pidx 执行命令玩家序号
     * @param cmds 命令集
     * @param options withCard 是否使用卡, hidxs 角色索引组, heal 回血量, isExec 是否执行, heros 角色组, eheros 敌方角色组,
     *                ahidx 攻击角色序号, ehidx 受击角色序号, isAction 是否为战斗行动, source 触发来源id, getdmg 受到的伤害
     *                trigger 触发命令的时机, isPriority 是否为优先命令
     * @returns heros 角色组, eheros 敌方角色组, heroStatus 获得角色状态, willHeals 回血组,
     */
    private _doCmds(pidx: number, cmds?: Cmds[],
        options: {
            players?: Player[], withCard?: Card, hidxs?: number[], heal?: number, isAction?: boolean, source?: number,
            isExec?: boolean, heros?: Hero[], eheros?: Hero[], ahidx?: number, ehidx?: number, trigger?: Trigger,
            socket?: Socket, isSummon?: number, getdmg?: number[], supportCnt?: number[][], willSwitch?: boolean[][],
            damages?: SmnDamageHandle, isOnlyGetWillDamages?: boolean, isPriority?: boolean, isUnshift?: boolean,
            energyCnt?: number[][], isOnlyGetWillHeal?: boolean, skid?: number, sktype?: SkillType,
        } = {}
    ): {
        cmds?: Cmds[], heros?: Hero[], eheros?: Hero[], willHeals?: number[][],
        isSwitch?: number, isSwitchOppo?: number, willSwitch?: boolean[][], supportCnt?: number[][], willAttachs?: PureElementType[][],
        elTips?: [string, PureElementType, PureElementType][], aWillDamages?: number[][][], bWillDamages?: number[][],
        aDmgElements?: DamageType[], bDmgElements?: DamageType[], atkedIdxs?: number[], attackPreview?: Preview, tasks?: AtkTask[],
    } {
        const { players = this.players } = options;
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const { withCard, hidxs: chidxs, heal = 0, isExec = true, ahidx = player.hidx, ehidx = opponent.hidx,
            isAction, source = -1, damages, socket, isSummon = -1, trigger,
            willSwitch = players.map(p => p.heros.map(() => false)), isOnlyGetWillDamages,
            supportCnt = INIT_SUPPORTCNT(), isPriority, isUnshift, isOnlyGetWillHeal,
            energyCnt = players.map(p => p.heros.map(() => 0)), skid, sktype } = options;
        const cheros = player.heros;
        const ceheros = opponent.heros;
        if (cmds == undefined || cmds.length == 0) return {}
        let isSwitch: number = -1;
        let isSwitchOppo: number = -1;
        let heroStatus: Status[][] | undefined;
        let combatStatus: Status[] | undefined;
        let heroStatusOppo: Status[][] | undefined;
        let combatStatusOppo: Status[] | undefined;
        let willHeals: number[][] = [];
        const notPreHeal: boolean[] = [];
        const notDetect: boolean[] = [];
        let attackPreview: Preview | undefined;
        const tasks: AtkTask[] = [];
        const elTips: [string, PureElementType, PureElementType][] = Array.from({ length: cheros.length + ceheros.length }, () => ['', ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Cryo]);
        let aWillDamages: number[][][] | undefined;
        let bWillDamages: number[][] | undefined;
        const aDmgElements: DamageType[] = [];
        let bDmgElements: DamageType[] | undefined;
        let atkedIdxs: number[] | undefined;
        let willAttachs: PureElementType[][] | undefined;
        const tmpDamages: number[] = new Array(cheros.length).fill(0);
        const willHeals0: { mode: number, heals: number[] } = { mode: 0, heals: new Array(cheros.length + ceheros.length).fill(-1) };
        for (let i = 0; i < cmds.length; ++i) {
            const { cmd = '', cnt = 0, hidxs: ohidxs, element, card, status: stsargs, isOppo, isAttach = false, mode = 0, summonTrigger } = cmds[i];
            let { hidxs, subtype = [], cardTag = [] } = cmds[i];
            if (!Array.isArray(subtype)) subtype = [subtype];
            if (!Array.isArray(cardTag)) cardTag = [cardTag];
            if (!hidxs && chidxs) hidxs = [...chidxs];
            const getsts = this._getStatusById(stsargs);
            if (cmd == 'useSkill') {
                if (isExec) {
                    this.taskQueue.addTask(`doCmd--useSkill:${cnt}-p${pidx ^ +!!isOppo}`, [[() => {
                        this._useSkill(pidx ^ +!!isOppo, cnt, {
                            isSwitch,
                            isReadySkill: isAttach,
                            otriggers: summonTrigger,
                            selectSummon: ohidxs?.[0],
                            isQuickAction: isCdt(!!withCard, !isAction),
                            isChargedAtk: (player.dice.length + (withCard ? withCard.cost + withCard.anydice - withCard.costChange : 0)) % 2 == 0,
                        });
                    }]]);
                } else {
                    [attackPreview] = this._previewSkill(pidx, cnt, { withCard, isSwitch });
                }
            } else if (cmd.startsWith('switch-')) {
                const switchOppo = isOppo ?? false;
                const cpidx = pidx ^ +switchOppo;
                const heros = switchOppo ? ceheros : cheros;
                if (hasObjById(heros.find(h => h.isFront)?.heroStatus, 300005)) continue;
                if (isSwitch == -1) isSwitch = ohidxs?.[0] ?? -1;
                let nhidx = -1;
                let sdir = 0;
                if (cmd == 'switch-before') sdir = -1;
                else if (cmd == 'switch-after') sdir = 1;
                if (sdir == 0) {
                    nhidx = getNearestHidx(hidxs?.[0] ?? -1, heros);
                } else {
                    nhidx = this._getFrontHero(cpidx, { players, isSwitch, offset: sdir }).hidx;
                }
                if (nhidx > -1) {
                    if (switchOppo) isSwitchOppo = nhidx;
                    else isSwitch = nhidx;
                    if (!isExec) {
                        willSwitch[cpidx][nhidx] = true;
                        heros.forEach(h => h.isFront = h.hidx == nhidx);
                        players[cpidx].hidx = nhidx;
                    } else {
                        this.taskQueue.addTask(`doCmd--switch:${source}`, [[() => {
                            const toHidx = sdir == 0 ? nhidx : this._getFrontHero(cpidx, { offset: sdir }).hidx;
                            if (hasObjById(this.players[cpidx].heros.find(h => h.isFront)?.heroStatus, 300005)) return;
                            this._switchHero(cpidx, toHidx, `doCmd--switch:${source}`, { isQuickAction: !isAction, socket, trigger });
                        }, 0, cnt]], { isPriority, isUnshift, isDmg: !switchOppo });
                    }
                }
            } else if (['getCard', 'addCard', 'putCard'].includes(cmd)) {
                const cards: Card[] = [];
                const count = Math.abs(cnt);
                if (card) {
                    cards.push(...(Array.isArray(card) ? card : Array.from({ length: count }, () => clone(card)))
                        .map(c => typeof c == 'number' ? this.newCard(c) : c));
                }
                if (cmd == 'putCard') {
                    cmds.splice(i--, 1,
                        { cmd: 'discard', cnt: cards.length, card: cards, mode: CMD_MODE.IsNotPublic, isAttach: true },
                        { cmd: 'addCard', card: cards, hidxs: [-cards.length], mode: CMD_MODE.IsNotPublic }
                    );
                    continue;
                }
                const cpidx = pidx ^ +(isOppo ?? false);
                const cplayer = players[cpidx];
                if (cmd == 'getCard') {
                    const willGetCard: Card[] = [];
                    const exclude = ohidxs ?? [];
                    let restCnt = count || cards.length;
                    let isFromPile = isAttach;
                    while (restCnt-- > 0) {
                        let wcard: Card | null = null;
                        if (cards[count - restCnt - 1]) { // 摸指定卡
                            if (isAttach) { // 从牌库摸
                                const cid = cards[count - restCnt - 1].id;
                                const cardIdx = cplayer.pile.findIndex(c => c.id == cid);
                                if (cardIdx > -1 && isExec) [wcard] = cplayer.pile.splice(cardIdx, 1);
                            } else { // 直接生成
                                wcard = cards[count - restCnt - 1];
                            }
                        } else if (subtype.length == 0 && cardTag.length == 0) {
                            if (exclude.length > 0) { // 在指定的某几张牌中随机模
                                wcard = this.newCard(this._randomInArr(exclude)[0]);
                            } else { // 从牌库直接摸牌
                                isFromPile = true;
                                wcard = cplayer.pile.shift() ?? null;
                            }
                        } else { // 指定副类型
                            if (isAttach) {
                                if (cplayer.pile.every(c =>
                                    (subtype.length > 0 && !c.hasSubtype(...(subtype as CardSubtype[]))) ||
                                    (cardTag.length > 0 && !c.hasTag(...(cardTag as CardTag[]))))
                                ) {
                                    break;
                                }
                                while (wcard == null) {
                                    const cardIdx = cplayer.pile.findIndex(c => (c.hasSubtype(...(subtype as CardSubtype[])) || c.hasTag(...(cardTag as CardTag[]))) && !exclude.includes(c.id));
                                    if (cardIdx > -1) [wcard] = cplayer.pile.splice(cardIdx, 1);
                                }
                            } else {
                                const cardsPool = cardsTotal(this.version.value).filter(c => (c.hasSubtype(...(subtype as CardSubtype[])) || c.hasTag(...(cardTag as CardTag[]))) && !exclude.includes(c.id));
                                [wcard] = this._randomInArr(cardsPool);
                            }
                        }
                        if (wcard && wcard.id != 0) {
                            willGetCard.push(clone(wcard).setEntityId(this._genEntityId()));
                        }
                    }
                    if (willGetCard.length > 0) {
                        const rest = MAX_HANDCARDS_COUNT - cplayer.handCards.length;
                        const getcards = willGetCard.slice(0, rest);
                        if (isExec) {
                            const cardNames = willGetCard.map(c => `[${c.name}]`).join('');
                            const cardEntityIds = willGetCard.map(c => `(${c.entityId})`).join('');
                            this.taskQueue.addTask(`doCmd--getCard-p${cpidx}:${cardNames}`, [[async () => {
                                const p = this.players[cpidx];
                                if (mode != CMD_MODE.IsPublic) this._writeLog(`[${p.name}](${p.pidx})抓${willGetCard.length}张牌【p${cpidx}:${cardNames}】【${cardEntityIds}】`);
                                const rest = MAX_HANDCARDS_COUNT - p.handCards.length;
                                willGetCard.forEach((c, ci) => {
                                    c.UI.class = (isFromPile ? 'will-getcard-my-pile' : 'will-getcard-my-generate') + (ci < rest ? '' : '-over');
                                });
                                p.UI.willGetCard = {
                                    cards: [...willGetCard],
                                    isFromPile,
                                    isNotPublic: mode != CMD_MODE.IsPublic,
                                }
                                p.handCards.push(...willGetCard.slice(0, rest));
                                this.emit('doCmd--getCard', cpidx, { isQuickAction: !isAction });
                                p.UI.willGetCard = { cards: [], isFromPile: true, isNotPublic: true };
                                p.handCards.forEach(c => delete c.UI.class);
                            }, 1500]], { isPriority, isUnshift });
                        } else {
                            cplayer.handCards.push(...getcards);
                        }
                        const atriggers: Trigger[] = ['getcard'];
                        const etriggers: Trigger[] = ['getcard-oppo'];
                        if (isFromPile) {
                            atriggers.push('drawcard');
                            etriggers.push('drawcard-oppo');
                        }
                        for (const getcard of getcards) {
                            if (isExec) {
                                this.taskQueue.addTask(`doCmd--getCard-p${cpidx}-${getcard.name}(${getcard.entityId}):getcard/drawcard`, [[() => {
                                    this._detectStatus(cpidx, STATUS_TYPE.Usage, atriggers, {
                                        hidxs: allHidxs(cplayer.heros),
                                        isQuickAction: !isAction,
                                        hcard: getcard,
                                    });
                                    this._detectSupport(cpidx ^ 1, etriggers, { isQuickAction: !isAction });
                                    if (this.taskQueue.isTaskEmpty()) this.emit('doCmd--getCard:getcard/drawcard-cancel', cpidx, { isQuickAction: !isAction });
                                }]]);
                            } else {
                                this._detectStatus(cpidx, STATUS_TYPE.Usage, atriggers, {
                                    players,
                                    hidxs: allHidxs(cplayer.heros),
                                    isExec,
                                    isOnlyExec: !isExec,
                                    isQuickAction: !isAction,
                                    supportCnt,
                                    hcard: getcard,
                                });
                                this._detectSupport(cpidx ^ 1, etriggers, { players, isExec, isQuickAction: !isAction, supportCnt });
                            }
                            const cardres = getcard.handle(getcard, { heros: cplayer.heros, trigger: 'getcard' });
                            if (this._hasNotTriggered(cardres.trigger, 'getcard')) continue;
                            if (isExec) {
                                this.taskQueue.addTask(`doCmd--getCard-p${cpidx}-${getcard.name}(${getcard.entityId}):getcard`, [[async () => {
                                    await this._useCard(cpidx, -1, [], { getCard: getcard, isQuickAction: !isAction });
                                }]]);
                            } else {
                                for (const cmds of cardres.execmds ?? []) {
                                    if (!['attack', 'heal'].includes(cmds.cmd)) continue;
                                    tasks.push({ pidx: cpidx, cmds: [cmds], atkname: `${getcard.name}(${getcard.entityId})` });
                                }
                            }
                        }
                    }
                }
                if (cmd == 'addCard' && isExec) {
                    const cardMap = {};
                    cards.forEach(c => cardMap[c.name] = (cardMap[c.name] ?? 0) + 1);
                    const cardStr = Object.entries(cardMap).map(([name, cnt]) => `${cnt}张[${name}]`).join('');
                    this.taskQueue.addTask(`doCmd--addCard-p${cpidx}:${cardStr}`, [[async () => {
                        const p = this.players[cpidx];
                        p.UI.willAddCard.cards.push(...cards);
                        p.UI.willAddCard.isNotPublic = mode == CMD_MODE.IsNotPublic;
                        const scope = ohidxs?.[0] ?? 0;
                        const isRandom = !isAttach;
                        const isNotPublic = mode == CMD_MODE.IsNotPublic;
                        this._writeLog(`[${p.name}](${p.pidx})将${isNotPublic ? `【p${cpidx}:${cardStr}】【p${cpidx ^ 1}:${cards.length}张牌】` : `${cardStr}`}${Math.abs(scope) == cards.length ? '' : cnt < 0 ? '' : isRandom ? '随机' : '均匀'}加入牌库${scope != 0 ? `${scope > 0 ? '顶' : '底'}${cnt < 0 ? '第' : ''}${Math.abs(scope) == cards.length ? '' : `${Math.abs(scope)}张`}` : ''}`);
                        const count = cards.length;
                        const cscope = scope || p.pile.length;
                        if (cnt < 0) {
                            p.pile.splice(Math.abs(scope) - 1, 0, ...cards);
                        } else if (isRandom) {
                            const ranIdxs: number[] = [];
                            for (let i = 1; i <= count; ++i) {
                                let pos = this._randomInt(cscope - i * Math.sign(cscope));
                                if (cscope < 0 && pos == 0) pos = p.pile.length;
                                ranIdxs.push(pos);
                            }
                            ranIdxs.sort((a, b) => (a - b) * cscope).forEach(pos => p.pile.splice(pos, 0, cards.shift()!));
                        } else {
                            const step = parseInt(`${cscope / (count + 1)}`);
                            let rest = Math.abs(cscope % (count + 1));
                            for (let i = 1; i <= count; ++i) {
                                let pos = step * i + ((i - 1 + Math.min(rest, i))) * Math.sign(step);
                                if (cscope < 0 && pos == 0) pos = p.pile.length;
                                p.pile.splice(pos, 0, cards.shift()!);
                            }
                        }
                        this._writeLog(`[${p.name}](${p.pidx})加牌后牌库：${p.pile.map(c => `[${c.name}]`).join('')}`, 'system');
                        this.emit('doCmd--addcard', pidx, { isQuickAction: !isAction });
                        p.UI.willAddCard = { cards: [], isNotPublic: false };
                    }, 1500]], { isPriority, isUnshift });
                }
            } else if (['discard', 'stealCard'].includes(cmd)) {
                const isDiscard = cmd == 'discard';
                const discards: Card[] = [];
                let discardCnt = cnt || 1;
                const cpidx = pidx ^ +!!isOppo ^ +(cmd == 'stealCard');
                const cplayer = players[cpidx];
                const unselectedCards = cplayer.handCards.filter(c => c.entityId != withCard?.entityId).sort((a, b) => b.entityId - a.entityId);
                if (cmd == 'stealCard' && unselectedCards.length == 0) continue;
                const discardIdxs = (ohidxs ?? []).map(ci => cplayer.handCards.filter(c => c.entityId != withCard?.entityId)[ci].entityId);
                if (discardIdxs.length > 0) {
                    discards.push(...clone(unselectedCards.filter(c => discardIdxs.includes(c.entityId))));
                } else {
                    if (typeof card == 'number') {
                        if (unselectedCards.length > 0) {
                            let curIdx = -1;
                            while (discardCnt-- > 0) {
                                curIdx = unselectedCards.findIndex((c, ci) => ci > curIdx && (c.id == card || c.entityId == card));
                                if (curIdx == -1) break;
                                discards.push(clone(unselectedCards[curIdx]));
                            }
                        }
                    } else {
                        const hcardsSorted = clone(unselectedCards).sort((a, b) => ((b.cost + b.anydice) - (a.cost + a.anydice)));
                        if (card) { // 弃置指定手牌
                            discards.push(...clone(card as Card[]));
                        } else if (mode == CMD_MODE.AllHandCards) { // 弃置所有手牌
                            discards.push(...hcardsSorted);
                        } else {
                            const targetCnt = discardCnt;
                            while (discardCnt > 0) {
                                if (mode == CMD_MODE.Random) { // 弃置随机手牌
                                    const didx = this._randomInt(unselectedCards.length - 1);
                                    const [discard] = unselectedCards.splice(didx, 1);
                                    discards.push(clone(discard));
                                } else if (mode == CMD_MODE.HighHandCard) { // 弃置花费最高的手牌 
                                    if (hcardsSorted.length == 0) break;
                                    const maxCost = hcardsSorted[0].cost + hcardsSorted[0].anydice;
                                    const maxCostCards = unselectedCards.filter(c => c.cost + c.anydice == maxCost);
                                    const [{ entityId: ceid }] = isDiscard ? this._randomInArr(maxCostCards) : maxCostCards;
                                    const [discard] = unselectedCards.splice(unselectedCards.findIndex(c => c.entityId == ceid), 1);
                                    discards.push(clone(discard));
                                    hcardsSorted.splice(hcardsSorted.findIndex(c => c.entityId == ceid), 1);
                                } else if (mode == CMD_MODE.TopPileCard) { // 弃置牌堆顶的牌 
                                    if (cplayer.pile.length == 0) break;
                                    discards.push(clone(cplayer.pile[0]));
                                    discardIdxs.push(targetCnt - discardCnt);
                                } else if (mode == CMD_MODE.RandomPileCard) { // 弃置牌库中随机一张牌
                                    if (cplayer.pile.length == 0) break;
                                    const disIdx = this._randomInt(cplayer.pile.length - 1);
                                    discards.push(clone(cplayer.pile[disIdx]));
                                    discardIdxs.push(disIdx);
                                }
                                --discardCnt;
                            }
                        }
                    }
                }
                if (discards.length > 0) {
                    const isDiscardHand = mode == CMD_MODE.Random || mode == CMD_MODE.AllHandCards || mode == CMD_MODE.HighHandCard || card || ohidxs;
                    if (isExec) {
                        if (isDiscard) {
                            cplayer.playerInfo.discardCnt += discards.length;
                            cplayer.playerInfo.discardIds.push(...discards.map(c => c.id));
                        }
                        const cardNames = discards.map(c => `[${c.name}]【(${c.entityId})】`).join('');
                        this.taskQueue.addTask(`doCmd--discard-p${cpidx}:${cardNames}`, [[async () => {
                            const p = this.players[cpidx];
                            if (isDiscardHand) { // 舍弃手牌
                                discards.forEach(dc => p.UI.willDiscard.hcards.push(dc));
                                p.handCards.filter(dc => discards.map(c => c.entityId).includes(dc.entityId)).forEach(c => {
                                    c.UI.class = 'will-discard-hcard-my';
                                });
                            } else { // 舍弃牌库中的牌
                                p.UI.willDiscard.pile.push(...p.pile.filter((_, dcidx) => discardIdxs.includes(dcidx)));
                                p.pile = p.pile.filter((_, dcidx) => !discardIdxs.includes(dcidx));
                            }
                            p.UI.willDiscard.isNotPublic = isAttach;
                            this._writeLog(`[${p.name}](${p.pidx})${isDiscard ? '舍弃了' : '被夺取了'}${cardNames}`, isCdt(isAttach, 'system'));
                            const getcard = clone(p.UI.willDiscard.hcards);
                            this.emit('doCmd--discard', pidx, { isQuickAction: !isAction });
                            assgin(p.handCards, p.handCards.filter(dc => !discards.map(c => c.entityId).includes(dc.entityId)));
                            p.handCards.forEach((c, ci) => c.cidx = ci);
                            p.UI.willDiscard = { hcards: [], pile: [], isNotPublic: false };
                            if (!isAttach) {
                                if (isDiscard) this._doDiscard(pidx, discards!, { isAction });
                                else this._doCmds(cpidx ^ 1, [{ cmd: 'getCard', cnt, card: getcard, mode: CMD_MODE.IsPublic }], { isPriority: true, isUnshift: true });
                            }
                        }, 1500]], { isPriority, isUnshift });
                    } else {
                        if (!isAttach && isDiscard) {
                            const { tasks: distasks, willHeals: disheal } = this._doDiscard(pidx, discards, { players, isAction, isExec, supportCnt });
                            tasks.push(...distasks);
                            if (disheal) {
                                if (willHeals[0] == undefined) willHeals.push(disheal);
                                else mergeWillHeals(willHeals[0], disheal);
                                notDetect[0] = true;
                            }
                        }
                        assgin(players[cpidx].handCards, players[cpidx].handCards.filter(dc => !discards.map(c => c.entityId).includes(dc.entityId)));
                    }
                }
            } else if (cmd == 'getDice' && isExec) {
                let elements: DiceCostType[] = [];
                if (mode == CMD_MODE.Random) { // 随机不重复基础骰子
                    elements.push(...this._randomInArr(Object.values(PURE_ELEMENT_TYPE), cnt));
                } else if (mode == CMD_MODE.FrontHero) { // 当前出战角色(或者前后,用hidxs[0]控制)
                    const element = this._getFrontHero(pidx, { offset: ohidxs?.[0] ?? 0 }).element as PureElementType;
                    elements.push(...Array.from({ length: cnt }, () => element));
                } else if (mode == CMD_MODE.RandomAll) { // 随机可重复骰子
                    for (let i = 0; i < cnt; ++i) elements.push(this._randomInArr(Object.values(DICE_COST_TYPE))[0]);
                }
                const nel = (element as DiceCostType | undefined) ?? elements;
                this._writeLog(`[${player.name}](${player.pidx})获得${cnt}个骰子【p${player.pidx}:${(Array.isArray(nel) ? nel : new Array(cnt).fill(nel)).map(e => `[${ELEMENT_NAME[e].replace('元素', '')}]`).join('')}】`);
                assgin(player.dice, this._getDice(pidx, cnt, nel));
                for (let i = 0; i < cnt; ++i) {
                    this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'getdice-oppo', { isOnlyCombatStatus: true, isQuickAction: !isAction, source, isExec });
                }
            } else if (cmd == 'getEnergy') {
                ((isOppo ? ceheros : cheros) as Hero[]).forEach((h, hi) => {
                    if (h.hp > 0 && (ohidxs == undefined && h.isFront || ohidxs?.includes(hi))) {
                        if ((cnt > 0 && h.energy < h.maxEnergy) || (cnt < 0 && h.energy > 0)) {
                            const pcnt = Math.max(-h.energy, Math.min(h.maxEnergy - h.energy, cnt));
                            h.energy += pcnt;
                            if (isExec) {
                                this._writeLog(`[${player.name}](${player.pidx})[${h.name}]${pcnt > 0 ? '获得' : '失去'}${Math.abs(pcnt)}点充能`, 'system');
                            } else {
                                energyCnt[pidx ^ +!!isOppo][hi] += pcnt;
                            }
                        }
                    }
                });
            } else if (cmd == 'reroll' && player.dice.length > 0 && isExec) {
                player.phase = PHASE.DICE;
                player.rollCnt = cnt;
                player.UI.showRerollBtn = true;
            } else if (cmd == 'changeDice' && isExec) {
                const cpidx = pidx ^ +!!isOppo;
                const cplayer = players[cpidx];
                const nel = (mode == CMD_MODE.FrontHero ? this._getFrontHero(pidx).element : element ?? DICE_COST_TYPE.Omni) as DiceCostType;
                let ndice = cplayer.dice.slice();
                const diceCnt = arrToObj(DICE_WEIGHT, 0);
                ndice.forEach(d => ++diceCnt[d]);
                const effDice = (d: DiceCostType) => d == DICE_COST_TYPE.Omni ? 2 : +cplayer.heros.map(h => h.element).includes(d);
                ndice = objToArr(diceCnt)
                    .sort((a, b) => effDice(a[0]) - effDice(b[0]) || a[1] - b[1] || DICE_WEIGHT.indexOf(a[0]) - DICE_WEIGHT.indexOf(b[0]))
                    .flatMap(([d, cnt]) => new Array<DiceCostType>(cnt).fill(d));
                const changedDice: DiceCostType[] = [];
                for (let i = 0; i < Math.min(cnt || ndice.length, ndice.length); ++i) {
                    changedDice.push(ndice[i]);
                    ndice[i] = nel;
                }
                this._writeLog(`[${cplayer.name}](${cplayer.pidx})将${cnt || ndice.length}个骰子【p${cplayer.pidx}:${changedDice.map(d => `[${ELEMENT_NAME[d].replace('元素', '')}]`).join('')}】变为[${ELEMENT_NAME[nel].replace('元素', '')}]`);
                assgin(cplayer.dice, ndice);
                assgin(cplayer.dice, this._rollDice(cpidx));
            } else if (cmd == 'changeCard' && isExec) {
                player.phase = PHASE.CHANGE_CARD;
            } else if (cmd == 'getStatus') {
                if (isOppo) {
                    getsts.forEach(sts => {
                        if (sts.group == STATUS_GROUP.heroStatus) {
                            if (!heroStatusOppo) heroStatusOppo = new Array(ceheros.length).fill(0).map(() => []);
                            (ohidxs ?? [ehidx]).forEach(fhidx => heroStatusOppo![fhidx].push(sts));
                        } else {
                            if (!combatStatusOppo) combatStatusOppo = [];
                            combatStatusOppo.push(sts);
                        }
                    });
                } else {
                    getsts.forEach(sts => {
                        if (sts.group == STATUS_GROUP.heroStatus) {
                            if (!heroStatus) heroStatus = new Array(cheros.length).fill(0).map(() => []);
                            (ohidxs ?? [ahidx]).forEach(fhidx => heroStatus?.[fhidx].push(sts));
                        } else {
                            if (!combatStatus) combatStatus = [];
                            combatStatus.push(sts);
                        }
                    })
                }
            } else if (['heal', 'revive', 'addMaxHp'].includes(cmd)) {
                if (mode != willHeals0.mode) {
                    willHeals.push(willHeals0.heals.slice());
                    willHeals0.mode = mode;
                    willHeals0.heals = new Array(cheros.length + ceheros.length).fill(-1);
                }
                const willHeals1 = new Array(cheros.length).fill(0).map((_, hi) => {
                    if (cmd == 'addMaxHp' && !isOnlyGetWillHeal && (hidxs ?? [player.hidx]).includes(hi)) cheros[hi].maxHp += cnt;
                    return (hidxs ?? [player.hidx]).includes(hi) ? (cnt || heal) - (cmd == 'revive' ? 0.3 : 0) : -1;
                });
                notPreHeal[mode] ||= isAttach || cmd == 'revive' || (this.version.lt('v5.0.0') && cmd == 'addMaxHp');
                willHeals1.forEach((hl, hli) => {
                    if (hl > -1) {
                        const hlidx = hli + player.pidx * ceheros.length;
                        if (willHeals0.heals[hlidx] == -1) willHeals0.heals[hlidx] = 0;
                        willHeals0.heals[hlidx] += hl;
                    }
                });
                if (cnt == 0) cmds[i].cnt = heal;
                if (isExec && cmd == 'revive') this._detectSkill(pidx, 'revive', { hidxs });
            } else if (cmd == 'changeSummon') {
                const osummon = player.summons[ohidxs?.[0] ?? -1] ?? player.summons.find(s => s.id == ohidxs?.[0]);
                if (!osummon) continue;
                player.summons.splice(getObjIdxById(player.summons, osummon.id), 1, this.newSummon(cnt, osummon.useCnt).setEntityId(osummon.entityId));
            } else if (cmd == 'changePattern') {
                if (hidxs == undefined) throw new Error('hidxs is undefined');
                const newPattern = this.newHero(cnt);
                const { id, entityId, heroStatus: chsts, hp, isFront, hidx, attachElement, talentSlot, artifactSlot, weaponSlot, vehicleSlot, energy } = clone(cheros[hidxs[0]]);
                assgin(cheros[hidxs[0]], newPattern);
                cheros[hidxs[0]].id = id;
                cheros[hidxs[0]].entityId = entityId;
                assgin(cheros[hidxs[0]].heroStatus, chsts);
                cheros[hidxs[0]].hp = hp;
                cheros[hidxs[0]].isFront = isFront;
                cheros[hidxs[0]].hidx = hidx;
                assgin(cheros[hidxs[0]].attachElement, attachElement);
                cheros[hidxs[0]].talentSlot = talentSlot;
                cheros[hidxs[0]].artifactSlot = artifactSlot;
                cheros[hidxs[0]].weaponSlot = weaponSlot;
                cheros[hidxs[0]].vehicleSlot = vehicleSlot;
                cheros[hidxs[0]].energy = energy;
            } else if (cmd == 'getSkill' && isExec) {
                if (hidxs == undefined) throw new Error('@_doCmds-getSkill: hidxs is undefined');
                cheros[hidxs[0]].skills.splice(mode, 0, this.newSkill(cnt));
            } else if (cmd == 'loseSkill' && isExec) {
                if (hidxs == undefined) throw new Error('@_doCmds-loseSkill: hidxs is undefined');
                cheros[hidxs[0]].skills.splice(mode, 1);
            } else if (cmd == 'attach') {
                if (!willAttachs) willAttachs = new Array(player.heros.length + opponent.heros.length).fill(0).map(() => []);
                (ohidxs ?? [player.hidx]).forEach((hidx, hi) => {
                    const {
                        dmgElement: dmgel = (Array.isArray(element) ?
                            element[hi] : element ??
                            this._getFrontHero(pidx, { players })?.element ??
                            DAMAGE_TYPE.Physical) as ElementType,
                    } = damages?.(false, 0, element as DamageType | undefined, hidxs) ?? {};
                    const { players: players1, elTips: elTips1, willAttachs: willAttachs1 }
                        = this._calcDamage(pidx, dmgel, [], hidx, players, { isAttach: true, elTips, isExec, skid, sktype });
                    for (let i = 0; i < players[pidx].heros.length; ++i) {
                        const attachEl = willAttachs1[i];
                        if (attachEl == undefined) continue;
                        willAttachs![i + pidx * players[pidx ^ 1].heros.length].push(attachEl);
                    }
                    assgin(players, players1);
                    elTips1.forEach((et, eti) => et[0] != '' && (elTips[eti] = [...et]));
                });
            } else if (cmd == 'attack') {
                const atkOppo1 = isOppo ?? true;
                const epidx = pidx ^ +atkOppo1;
                if (!aWillDamages) aWillDamages = [];
                if (!bWillDamages) bWillDamages = new Array(player.heros.length + opponent.heros.length).fill(0).map(() => [-1, 0]);
                if (!bDmgElements) bDmgElements = new Array(players.flatMap(p => p.heros).length).fill(DAMAGE_TYPE.Physical);
                if (!willAttachs) willAttachs = new Array(player.heros.length + opponent.heros.length).fill(0).map(() => []);
                if (!atkedIdxs) atkedIdxs = [];
                const dmgcnt = cmds[i].cnt;
                const defaultCnt = dmgcnt ?? -1;
                const cWillDamages: number[][][] = [];
                const cDmgElements: DamageType[] = [];
                const cAtkedIdxs = ohidxs ?? [(atkOppo1 ? opponent : player).hidx];
                atkedIdxs.push(...cAtkedIdxs);
                cAtkedIdxs.forEach((hidx, hi) => {
                    const {
                        willDamages: wdmgs = new Array(players[epidx].heros.length).fill(0).map((_, i) => i == hidx ? [
                            defaultCnt >= 0 && element != DAMAGE_TYPE.Pierce ? defaultCnt : -1,
                            element == DAMAGE_TYPE.Pierce ? defaultCnt : 0] : [-1, 0]),
                        dmgElement: dmgel = (Array.isArray(element) ?
                            element[hi] : element ??
                            this._getFrontHero(pidx, { players, offset: ohidxs?.[0] })?.element ??
                            DAMAGE_TYPE.Physical) as ElementType,
                    } = damages?.(atkOppo1, dmgcnt, element as DamageType | undefined, ohidxs) ?? {};
                    if (atkOppo1) wdmgs.push(...Array.from({ length: players[epidx ^ 1].heros.length }, () => [-1, 0]));
                    else wdmgs.unshift(...Array.from({ length: players[epidx ^ 1].heros.length }, () => [-1, 0]));
                    aWillDamages!.push(wdmgs);
                    cWillDamages.push(wdmgs);
                    cDmgElements.push(dmgel);
                    if (dmgel == DAMAGE_TYPE.Pierce) {
                        const selfDmg = wdmgs?.slice(ceheros.length).map(([, pdmg]) => pdmg);
                        cheros.forEach((h, hi) => {
                            if (h.hp <= 0 || !selfDmg?.[hi] || selfDmg[hi] <= 0) return;
                            h.hp -= selfDmg[hi] - tmpDamages[hi];
                            tmpDamages[hi] = selfDmg[hi];
                        });
                    }
                });
                if (!isOnlyGetWillDamages) {
                    const { players: players1, elTips: elTips1, willDamages: willDamages1,
                        dmgElements: dmgElements1, willHeal: willHeal1, willAttachs: willAttachs1 }
                        = this._useSkill(pidx, -2, {
                            isPreview: !isExec,
                            players,
                            isSummon,
                            willDamages: cWillDamages,
                            dmgElements: cDmgElements,
                            atkedIdxs: cAtkedIdxs,
                            supportCnt,
                            isQuickAction: !isAction,
                        });
                    bWillDamages?.forEach((wdmg, wi) => {
                        if (wdmg[0] == -1) wdmg[0] = willDamages1[wi][0];
                        else wdmg[0] += Math.max(willDamages1[wi][0], 0);
                        wdmg[1] += willDamages1[wi][1];
                    });
                    dmgElements1.forEach((de, dei) => de != DAMAGE_TYPE.Physical && de != DAMAGE_TYPE.Pierce && (bDmgElements![dei] = de));
                    willHeal1.forEach((hl, hli) => {
                        if (hl > -1) {
                            const hlidx = hli + player.pidx * ceheros.length;
                            if (willHeals0.heals[hlidx] == -1) willHeals0.heals[hlidx] = 0;
                            willHeals0.heals[hlidx] += hl;
                        }
                    });
                    willAttachs1.forEach((wa, wai) => willAttachs![wai].push(...wa));
                    elTips1.forEach((et, eti) => et[0] != '' && (elTips[eti] = [...et]));
                    if (!isExec) {
                        const [atkPreview] = this._previewSkill(pidx, -2, {
                            withCard,
                            willDamages: cWillDamages,
                            dmgElements: cDmgElements,
                            atkedIdxs: isCdt(!atkOppo1, cAtkedIdxs),
                        });
                        if (!attackPreview) attackPreview = atkPreview;
                        else {
                            const { willHp: whp, willAttachs: wa } = atkPreview;
                            if (!attackPreview?.willHp) attackPreview.willHp = new Array(cheros.length + ceheros.length).fill(undefined);
                            if (!attackPreview?.willAttachs) attackPreview.willAttachs = Array.from({ length: cheros.length + ceheros.length }, () => []);
                            attackPreview?.willHp?.forEach((_, whpi, whpa) => {
                                if (whpa[whpi] == undefined) whpa[whpi] = whp?.[whpi];
                                else whpa[whpi] += whp?.[whpi] ?? 0;
                            });
                            if (wa && attackPreview?.willAttachs) {
                                attackPreview.willAttachs.forEach((_, wai, waa) => waa[wai].push(...wa[wai]));
                            }
                        }
                    } else {
                        assgin(players, players1);
                    }
                }
            } else if (cmd == 'pickCard' && isExec) {
                this.taskQueue.addTask(`doCmd--pickCard-${i}`, [[() => {
                    let cardIds: number[] = [];
                    if (isAttach) {
                        for (let i = 0; i < cnt; ++i) {
                            const cardsIdPool = this._getCardIds(c => (c.hasSubtype(subtype[i]) || c.hasTag(cardTag[i])));
                            cardIds.push(this._randomInArr(cardsIdPool)[0]);
                        }
                    } else {
                        const cardsIdPool = this._getCardIds(c => (c.hasSubtype(...(subtype as CardSubtype[])) || c.hasTag(...(cardTag as CardTag[]))));
                        cardIds = this._randomInArr((card ? card as number[] : cardsIdPool), cnt);
                    }
                    this.pickModal.phase = this.players[pidx].phase;
                    this.pickModal.isQuickAction = !isAction;
                    this.pickModal.hidxs = hidxs;
                    this.pickModal.skillId = ohidxs?.[0] ?? -1;
                    if (mode == CMD_MODE.GetCard || mode == CMD_MODE.UseCard) {
                        this.pickModal.cardType = mode == CMD_MODE.GetCard ? 'getCard' : 'useCard';
                        this.pickModal.cards = cardIds.map(c => this.newCard(c));
                    } else if (mode == CMD_MODE.GetSummon) {
                        this.pickModal.cardType = 'summon';
                        this.pickModal.cards = cardIds.map(c => {
                            const card = NULL_CARD();
                            const summon = this.newSummon(c);
                            card.id = summon.id;
                            card.UI = { ...summon.UI, cnt: 1 };
                            card.name = summon.name;
                            return card;
                        });
                    } else {
                        throw new Error('@_doCmds-pickCard: mode is undefined');
                    }
                    this.players[pidx].phase = PHASE.PICK_CARD;
                    this.emit(`pickCard-${i}`, pidx);
                }]], { isUnshift, isPriority });
            } else if (cmd == 'equip') {
                if (!card) continue;
                (ohidxs ?? [(isOppo ? opponent : player).hidx]).forEach(hidx => {
                    this._doEquip(pidx, player.heros[hidx], card as Card | number, { isExec });
                });
            } else if (cmd == 'exchangePos' && isExec) {
                const [h1 = -1, h2 = -1] = ohidxs ?? [];
                if (h1 == -1 || h2 == -1) throw new Error('@_doCmds-exchangePos: hidxs is undefined');
                this.taskQueue.addTask(`doCmd--exchangePos-h${h1}-h${h2}`, [[() => {
                    const player = this.players[pidx];
                    const heros = player.heros;
                    [heros[h1], heros[h2]] = [heros[h2], heros[h1]];
                    heros[h1].hidx = h1;
                    heros[h2].hidx = h2;
                    if (heros[h1].isFront) player.hidx = h1;
                    if (heros[h2].isFront) player.hidx = h2;
                    this.emit('doCmd--exchangePos', pidx, { isQuickAction: !isAction });
                }, 500]], { isPriority, isUnshift });
            } else if (cmd == 'exchangeHandCards' && isExec) {
                const hcards = [...player.handCards];
                const ehcards = [...opponent.handCards];
                assgin(player.handCards, ehcards);
                assgin(opponent.handCards, hcards);
                for (const hcard of player.handCards) {
                    this._detectStatus(pidx, STATUS_TYPE.Usage, 'getcard', { hidxs: allHidxs(player.heros), hcard, isQuickAction: !isAction });
                }
                for (const hcard of opponent.handCards) {
                    this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'getcard', { hidxs: allHidxs(opponent.heros), hcard, isQuickAction: !isAction });
                }
                this._writeLog('双方交换了手牌');
            }
        }

        if (willHeals0.heals.some(v => v != -1)) willHeals.push(willHeals0.heals.slice());
        const tmpHeals = new Array(cheros.length).fill(0);
        willHeals.forEach((whl, whli) => {
            if (!notDetect[whli]) {
                const willheal = whl.slice(pidx * ceheros.length, pidx * ceheros.length + cheros.length);
                const { tmpHeals: tmpheals, tasks: healtasks } = this._detectHeal(pidx, willheal, players, {
                    isExec,
                    notPreHeal: notPreHeal[whli],
                    isQuickAction: !isAction,
                    supportCnt,
                    source,
                });
                tmpHeals.forEach((_, hli, hla) => hla[hli] += tmpheals[hli]);
                willheal.forEach((hl, hli) => whl[pidx * ceheros.length + hli] = hl);
                tasks.push(...healtasks);
            }
        });
        tmpHeals.forEach((th, thi) => cheros[thi].hp -= th);
        tmpDamages.forEach((td, hi) => cheros[hi].hp += td);
        willHeals.forEach(whls => {
            whls.forEach((whl, whli) => {
                if (whl > -1) {
                    if (!attackPreview) attackPreview = { type: 'use-card', isValid: true, willHp: new Array(cheros.length + ceheros.length).fill(undefined) };
                    if (!attackPreview?.willHp) attackPreview.willHp = new Array(cheros.length + ceheros.length).fill(undefined);
                    if (attackPreview.willHp[whli] != 100) {
                        if (attackPreview.willHp[whli] == undefined) attackPreview!.willHp![whli] = whl;
                        else attackPreview.willHp[whli] += whl;
                        attackPreview.willHp[whli] ||= 100;
                    }
                }
            });
        });
        if (withCard && tasks.length && !isExec) {
            const { willHp: taskwhp, willAttachs: taskwa } = this._useSkill(pidx, -2, { isPreview: true, players, tasks });
            attackPreview?.willHp?.forEach((_, whpi, whpa) => {
                if (whpa[whpi] == undefined) whpa[whpi] = taskwhp?.[whpi];
                else whpa[whpi] += taskwhp?.[whpi] ?? 0;
            });
            if (taskwa && attackPreview?.willAttachs) {
                attackPreview.willAttachs.forEach((_, wai, waa) => waa[wai].push(...taskwa[wai]));
            }
        }
        for (let fhidx = 0; fhidx < cheros.length; ++fhidx) {
            const fhero = cheros[fhidx];
            if (heroStatus && heroStatus[fhidx].length) {
                this._updateStatus(pidx, heroStatus[fhidx], fhero.heroStatus, players, { hidx: fhidx, isExec, supportCnt, isQuickAction: !isAction });
            }
        }
        if (combatStatus) this._updateStatus(pidx, combatStatus, player.combatStatus, players, { hidx: ahidx, isExec, isQuickAction: !isAction });
        for (let fhidx = 0; fhidx < ceheros.length; ++fhidx) {
            const fhero = ceheros[fhidx];
            if (heroStatusOppo && heroStatusOppo[fhidx].length) {
                this._updateStatus(pidx ^ 1, heroStatusOppo[fhidx], fhero.heroStatus, players, { hidx: fhidx, isExec, supportCnt, isQuickAction: !isAction });
            }
        }
        if (combatStatusOppo) this._updateStatus(pidx ^ 1, combatStatusOppo, opponent.combatStatus, players, { hidx: ehidx, isExec, supportCnt, isQuickAction: !isAction });
        return {
            cmds, heros: cheros, eheros: ceheros, willHeals, isSwitch, isSwitchOppo, willSwitch, supportCnt,
            elTips, willAttachs, aDmgElements, bDmgElements, aWillDamages, bWillDamages, attackPreview, atkedIdxs, tasks,
        }
    }
    /**
     * 预览技能效果
     * @param pidx 玩家序号
     * @param skid 技能id -1为切换角色
     * @param options.withCard 卡使用技能
     * @param options.isSwitch 切换目标角色序号
     * @param options.isSummon 召唤物攻击预览
     * @param options.willDamages 卡牌/召唤物伤害
     * @param options.dmgElements 卡牌/召唤物伤害元素
     * @param options.atkedIdxs 自伤时的角色序号
     * @param options.tasks 切换角色前生成的攻击任务(如弃弹头)
     * @param options.willHeals 卡牌/召唤物回血
     * @returns 预览结果
     */
    private _previewSkill(pidx: number, skid?: number, options: {
        withCard?: Card, isSwitch?: number, isSummon?: number, willDamages?: number[][][],
        dmgElements?: DamageType[], atkedIdxs?: number[], tasks?: AtkTask[], willHeals?: number[][],
    } = {}) {
        const { withCard, isSwitch = -1, isSummon = -1, willDamages, dmgElements, atkedIdxs, tasks, willHeals } = options;
        const curRandom = this._random;
        const previews: Preview[] = [];
        const hero = isSwitch != -1 ? this.players[pidx].heros[isSwitch] : this._getFrontHero(pidx);
        if (!hero) return previews;
        const { skills, energy, heroStatus, hidx } = hero;
        const { dice, status, summons } = this.players[pidx];
        const skids = skid != undefined ? [skid] : skills.map(sk => sk.id);
        if (hero.vehicleSlot && skid == undefined) skids.unshift(hero.vehicleSlot[1].id);
        const isWaiting = status == PLAYER_STATUS.WAITING;
        const isNonAction = heroStatus.some(sts => sts.hasType(STATUS_TYPE.NonAction));
        for (const skillId of skids) {
            const hero = clone(this.players)[pidx].heros[hidx];
            const skill = hero.skills.find(sk => sk.id == skillId) ?? hero.vehicleSlot?.[1];
            const summonCanSelect: boolean[][] = this.players.map(() => new Array(MAX_SUMMON_COUNT).fill(false));
            const heroCanSelect: boolean[] = this.players[pidx].heros.map(h => h.hp > 0);
            let skillForbidden = true;
            const summonSelects: number[] = [];
            const heroSelects: number[] = allHidxs(this.players[pidx].heros);
            if (skill) {
                if (skill.type == SKILL_TYPE.Passive || skill.type == SKILL_TYPE.PassiveHidden) continue;
                const isLen = skill.cost[0].cnt + skill.cost[1].cnt - skill.costChange[0] - skill.costChange[1] > dice.length;
                const isElDice = (skill.cost[0].type != DICE_TYPE.Same ?
                    dice.filter(d => d == DICE_COST_TYPE.Omni || d == skill.cost[0].type).length :
                    dice.filter(d => d == DICE_COST_TYPE.Omni).length + Math.max(0, ...Object.values(dice.reduce((a, c) => {
                        if (c != DICE_COST_TYPE.Omni) a[c] = (a[c] ?? 0) + 1;
                        return a;
                    }, {} as Record<DiceCostType, number>)))) < skill.cost[0].cnt - skill.costChange[0];
                const isEnergy = skill.cost[2].cnt > 0 && skill.cost[2].cnt > energy;
                const needSelectSmn = skill.canSelectSummon != -1 && summons.length == 0;
                const skillres = skill.handle({ skill, hero });
                skillForbidden = isWaiting || this.phase != PHASE.ACTION || isNonAction || isLen || isElDice || isEnergy || !!skillres.isForbidden;
                skill.isForbidden = skillForbidden || needSelectSmn;
                if (skill.canSelectSummon != -1 && !skillForbidden) {
                    summonCanSelect[skill.canSelectSummon].fill(true);
                    summonSelects.push(...[this.players[pidx ^ 1].summons, summons][skill.canSelectSummon].map((_, smni) => smni));
                }
                if (skill.canSelectHero == -1 || skillForbidden) {
                    heroCanSelect.fill(false);
                    heroSelects.length = 0;
                }
            }
            const selects = [...summonSelects.map(s => ['smn', s]), ...heroSelects.map(h => ['hero', h])] as [string, number][];
            if (selects.length == 0) selects.push(['default', -1]);
            for (const [tag, selectItem] of selects) {
                const { willHp, willAttachs, summonCnt, supportCnt, willSummons, willSwitch, energyCnt, tarHidx }
                    = this._useSkill(pidx, skillId, {
                        isPreview: true,
                        withCard,
                        isSummon,
                        isSwitch,
                        willDamages,
                        dmgElements,
                        otriggers: isCdt(skillId == -1, ['switch-from', 'switch-to']),
                        atkedIdxs,
                        selectSummon: isCdt(tag == 'smn', selectItem),
                        selectHero: isCdt(tag == 'hero', selectItem),
                        tasks,
                        willHeals,
                    });
                const preview: Preview = {
                    type: ACTION_TYPE.UseSkill,
                    isValid: !skill?.isForbidden,
                    skillId,
                    diceSelect: this._checkSkill(pidx, skillId, skillId < 0 || skill?.isForbidden, isSwitch),
                    willHp,
                    willAttachs,
                    willSummonChange: summonCnt,
                    willSupportChange: supportCnt,
                    willSummons,
                    willSwitch,
                    willEnergyChange: energyCnt,
                    summonCanSelect,
                    heroCanSelect,
                    summonIdx: isCdt(tag == 'smn', selectItem),
                    heroIdxs: isCdt(tag == 'hero', [selectItem]),
                    tarHidx,
                }
                previews.push(preview);
                this._random = curRandom;
            }
        }
        return previews;
    }
    /**
     * 预览使用卡牌效果
     * @param pidx 玩家序号
     * @returns 预览结果
     */
    private _previewCard(pidx: number) {
        const curRandom = this._random;
        const { handCards } = this.players[pidx];
        const previews: Preview[] = [];
        for (const cidx in handCards) {
            const players = clone(this.players);
            const { canSelectHero, canSelectSummon, canSelectSupport, type } = handCards[cidx];
            const player = players[pidx];
            const { isValid: diceValid, diceSelect, heroCanSelect = [], supportCnt, attackPreview: atkPreview = {}, summonCnt }
                = this._checkCard(pidx, players, +cidx);
            const heroSelects: number[][] = [];
            const heroCanSelects: boolean[][] = [];
            const heroAtkPreview: Preview[] = [];
            const heroSwitchIdx: number[] = [];
            const heroSkillId: number[] = [];
            if (canSelectHero > 0 && diceValid) {
                const hidxWeight = (n: number) => (n + player.heros.length - player.hidx) % player.heros.length;
                const heroIdxs = heroCanSelect.map((v, i) => ({ v, i })).filter(v => v.v).map(v => v.i)
                    .sort((a, b) => hidxWeight(a) - hidxWeight(b));
                for (const hidxi of heroIdxs) {
                    heroSelects.push([hidxi]);
                    const { heroCanSelect: csh, attackPreview: atkpre, switchIdx: swidx = -1, skillId = -1 }
                        = this._checkCard(pidx, players, +cidx, { heroIdx: hidxi });
                    if (atkpre) heroAtkPreview[hidxi] = atkpre;
                    heroSwitchIdx[hidxi] = swidx;
                    heroSkillId[hidxi] = skillId;
                    if (canSelectHero == 2) {
                        if (!csh) continue;
                        heroCanSelects[hidxi] = csh;
                        for (const hidxj of csh.map((v, i) => ({ v, i })).filter(v => v.v).map(v => v.i)) {
                            if (hidxi != hidxj) heroSelects.push([hidxi, hidxj]);
                        }
                    }
                }
            }
            if (heroSelects.length == 0) heroSelects.push([]);
            for (const heroSelect of heroSelects) {
                let isValid = diceValid && canSelectHero == heroSelect.length && canSelectSummon == -1 && canSelectSupport == -1;
                const supportCanSelect: boolean[][] = players.map(() => new Array(MAX_SUPPORT_COUNT).fill(false));
                const summonCanSelect: boolean[][] = players.map(() => new Array(MAX_SUMMON_COUNT).fill(false));
                const isSupportAvalible = isValid;
                if (type == CARD_TYPE.Support) {
                    const isAvalible = player.supports.length < MAX_SUPPORT_COUNT;
                    isValid &&= isAvalible;
                    if (isSupportAvalible && !isAvalible) supportCanSelect[1].fill(true);
                }
                if (canSelectSummon != -1) summonCanSelect[canSelectSummon].fill(true);
                if (canSelectSupport != -1) supportCanSelect[canSelectSupport].fill(true);
                let hCanSelect = [...heroCanSelect];
                let attackPreview = hCanSelect.filter(v => v).length < 2 ? atkPreview : {};
                if (heroSelect.length > 0) {
                    if (canSelectHero == 1) attackPreview = heroAtkPreview[heroSelect[0]];
                    else if (canSelectHero == 2) hCanSelect = heroCanSelects[heroSelect[0]];
                }
                const willSummonChange = INIT_SUMMONCNT();
                (attackPreview as Preview)?.willSummonChange?.forEach((scnt, si) => scnt.forEach((v, i) => willSummonChange[si][i] += v));
                summonCnt?.forEach((scnt, si) => scnt.forEach((v, i) => willSummonChange[si][i] += v));
                const preview: Preview = {
                    willSupportChange: supportCnt,
                    ...attackPreview,
                    type: ACTION_TYPE.UseCard,
                    isValid,
                    diceSelect,
                    cardIdxs: [+cidx],
                    heroIdxs: heroSelect,
                    heroCanSelect: hCanSelect,
                    supportCanSelect,
                    summonCanSelect,
                    willSummonChange,
                }
                previews.push(preview);
                if (isSupportAvalible && !isValid || canSelectSupport != -1) {
                    for (let i = 0; i < MAX_SUPPORT_COUNT; ++i) {
                        previews.push({
                            ...preview,
                            isValid: canSelectSupport == -1 || diceValid,
                            supportIdx: i,
                        });
                    }
                }
                if (canSelectSummon != -1) {
                    for (let i = 0; i < players[+(canSelectSummon == pidx)].summons.length; ++i) {
                        const { summonCnt } = this._checkCard(pidx, players, +cidx, { summonIdx: i });
                        previews.push({
                            ...preview,
                            isValid: diceValid,
                            summonIdx: i,
                            willSummonChange: summonCnt,
                        });
                    }
                }
                this._random = curRandom;
            }
            // 调和的预览
            const { isValid, diceSelect: recondice } = this._checkCard(pidx, players, +cidx, { isReconcile: true });
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
            const { switchHeroDiceCnt, isQuickAction, tasks } = this._calcHeroSwitch(pidx, hidx, player.hidx);
            const diceSelect = player.dice.map(() => false);
            const isValid = player.dice.length >= switchHeroDiceCnt;
            if (isValid) {
                for (let i = player.dice.length - 1, cnt = switchHeroDiceCnt; i >= 0 && cnt > 0; --i, --cnt) {
                    diceSelect[i] = true;
                }
            }
            const [skillPreview] = this._previewSkill(pidx, -1, { isSwitch: hidx, tasks });
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
     * @param players 当前玩家数组
     * @param options.hidx 角色序号
     * @param options.isExec 是否执行加入任务队列
     * @param options.ohidx 旧附魔角色
     * @param options.supportCnt 支援区变化数
     * @param options.isQuickAction 是否为快速行动
     * @param options.isLog 是否记录日志（用于更新召唤物状态时不显示在日志中）
     * @param options.isAddAtkStsTask 是否添加协同攻击状态任务（用于螃蟹吃白术盾）
     * @returns 合并后状态
     */
    private _updateStatus(pidx: number, nStatus: Status[], oStatus: Status[], players: Player[],
        options: {
            hidx?: number, isExec?: boolean, ohidx?: number, supportCnt?: number[][], isQuickAction?: boolean,
            isLog?: boolean, isAddAtkStsTask?: boolean,
        } = {}
    ) {
        const newStatus: Status[] = clone(nStatus);
        const player = players[pidx];
        if (!player) return;
        const { isExec, ohidx, supportCnt, isQuickAction, isLog = true, isAddAtkStsTask } = options;
        let { hidx } = options;
        const { combatStatus, heros, hidx: phidx } = player;
        hidx ??= phidx;
        const updateAttachEl = (aheros: Hero[], ahidx: number, stype: StatusGroup, sts?: Status[]) => {
            const hero = aheros[ahidx];
            const [attachElSts] = [
                ...((stype == STATUS_GROUP.heroStatus && sts ? sts : hero.heroStatus).filter(s => s.hasType(STATUS_TYPE.Enchant) && (s.useCnt != 0 && s.roundCnt != 0))),
                ...((stype == STATUS_GROUP.combatStatus && sts ? sts : hero.hidx == phidx ? combatStatus : []).filter(s => s.hasType(STATUS_TYPE.Enchant) && (s.useCnt != 0 && s.roundCnt != 0))),
            ];
            const attachEl: ElementType = attachElSts?.handle(attachElSts, { heros: aheros, hidx: ahidx })?.attachEl ?? DAMAGE_TYPE.Physical;
            for (const skill of hero.skills) {
                if (skill.type == SKILL_TYPE.Passive || skill.type == SKILL_TYPE.Vehicle || skill.type == SKILL_TYPE.PassiveHidden || skill.dmgElement != DAMAGE_TYPE.Physical || skill.attachElement == attachEl) continue;
                skill.UI.description = skill.UI.description.replace(ELEMENT_NAME[skill.attachElement], ELEMENT_NAME[attachEl]);
                skill.attachElement = attachEl;
            }
        }
        newStatus.forEach(sts => {
            let cstIdx = getObjIdxById(oStatus, sts.id);
            const oriSts = oStatus[cstIdx];
            if (cstIdx > -1 && (oriSts.isTalent != sts.isTalent || (oriSts.useCnt == 0 && !oriSts.hasType(STATUS_TYPE.Accumulate)))) { // 如果状态带有天赋不同或状态已耗尽，则重新附属
                oStatus.splice(cstIdx, 1);
                cstIdx = -1;
            }
            if (cstIdx > -1) { // 重复生成状态
                const cStatus = oStatus[cstIdx];
                if (sts.maxCnt == 0) { // 不可叠加
                    oStatus[cstIdx] = clone(sts).setEntityId(oStatus[cstIdx].entityId);
                    oStatus[cstIdx].useCnt = Math.max(oStatus[cstIdx].useCnt, cStatus.useCnt);
                } else { // 可叠加
                    cStatus.maxCnt = sts.maxCnt;
                    cStatus.perCnt = sts.perCnt;
                    let oCnt = -1;
                    let nCnt = -1;
                    if (cStatus.roundCnt > -1) {
                        oCnt = cStatus.roundCnt;
                        cStatus.roundCnt = Math.max(cStatus.roundCnt, Math.min(cStatus.maxCnt, cStatus.roundCnt + sts.addCnt));
                        nCnt = cStatus.roundCnt;
                    } else {
                        cStatus.roundCnt = sts.roundCnt;
                    }
                    if (cStatus.useCnt > -1) {
                        oCnt = cStatus.useCnt;
                        cStatus.addUseCnt(sts.addCnt);
                        nCnt = cStatus.useCnt;
                    } else {
                        cStatus.useCnt = sts.useCnt;
                    }
                    if (isExec) this._writeLog(`[${player.name}](${player.pidx})${sts.group == STATUS_GROUP.heroStatus ? `[${heros[hidx].name}]` : ''}[${sts.name}]【(${cStatus.entityId})】 ${oCnt}→${nCnt}`);
                }
            } else { // 新附属状态
                if (hasObjById(heros[hidx].heroStatus, 300005) && sts.hasType(STATUS_TYPE.NonAction)) return;
                sts.setEntityId(this._genEntityId());
                const { isFallAtk = false } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'enter', { players, cStatus: sts, hidxs: [hidx], isExec });
                player.isFallAtk ||= isFallAtk;
                oStatus.push(sts);
                this._detectSkill(pidx, 'get-status', { players, hidxs: allHidxs(heros), source: sts.id, sourceHidx: hidx, isExec });
                this._detectSlotAndStatus(pidx, 'get-status', {
                    types: STATUS_TYPE.Usage,
                    players,
                    hidxs: allHidxs(heros),
                    source: sts.id,
                    sourceHidx: hidx,
                    isExec,
                    supportCnt,
                });
                if (isExec && isLog) {
                    this._writeLog(`[${player.name}](${player.pidx})${sts.group == STATUS_GROUP.heroStatus ? `[${heros[hidx].name}]附属角色` : '生成出战'}状态[${sts.name}]【(${sts.entityId})】`, isCdt(sts.hasType(STATUS_TYPE.Hide), 'system'));
                }
            }
            const stsres = sts.handle(sts, { heros, hidx });
            if (sts.hasType(STATUS_TYPE.Enchant)) updateAttachEl(heros, hidx, sts.group, oStatus);
            if (stsres.onlyOne) {
                heros.some((h, hi) => {
                    if (hi == hidx) return false;
                    const idx = getObjIdxById(h.heroStatus, sts.id);
                    if (idx > -1) h.heroStatus.splice(idx, 1);
                    return idx > -1;
                });
            }
        });
        oStatus.forEach(sts => {
            if (sts.hasType(STATUS_TYPE.Enchant)) {
                const stsres = sts.handle(sts, { heros, hidx });
                if (stsres.isUpdateAttachEl || ohidx != undefined ||
                    (!sts.hasType(STATUS_TYPE.TempNonDestroy) &&
                        ((sts.useCnt == 0 && !sts.hasType(STATUS_TYPE.Accumulate, STATUS_TYPE.Attack)) || sts.roundCnt == 0))
                ) {
                    if (ohidx != undefined) updateAttachEl(heros, ohidx, sts.group);
                    updateAttachEl(heros, hidx, sts.group);
                }
            }
        });
        assgin(oStatus, oStatus.sort((a, b) => Math.sign(a.summonId) - Math.sign(b.summonId))
            .filter(sts => {
                const isNotDestroy = ((sts.useCnt != 0 || sts.hasType(STATUS_TYPE.Accumulate, STATUS_TYPE.Attack)) && sts.roundCnt != 0) || sts.hasType(STATUS_TYPE.TempNonDestroy);
                const isStsAtk = isAddAtkStsTask && sts.useCnt == 0 && sts.hasType(STATUS_TYPE.Attack);
                if (isExec && (!isNotDestroy || isStsAtk) && sts.entityId != 1) this._doStatusDestroy(pidx, allHidxs(heros), sts, hidx, isQuickAction);
                return isNotDestroy || (sts.hasType(STATUS_TYPE.Attack) && sts.roundCnt != 0);
            }));
    }
    /**
     * 更新召唤物
     * @param pidx 玩家序号
     * @param nSummon 新召唤物
     * @param players 当前玩家数组
     * @param options isSummon 是否是召唤物生成的新召唤物, trigger 触发时机, destroy 是否销毁该entityId召唤物(0为不销毁,1为检测全部召唤物)
     * @returns 合并后召唤物
     */
    private _updateSummon(
        pidx: number, nSummon: Summon[], players: Player[] = this.players, isExec = true,
        options: { isSummon?: number, destroy?: number, trigger?: Trigger, supportCnt?: number[][] } = {}
    ) {
        const { summons = [], combatStatus = [], hidx = -1, heros = [], name = '' } = players[pidx] ?? {};
        const newSummon: Summon[] = clone(nSummon);
        const oriSummon: Summon[] = clone(summons);
        const { isSummon = -1, destroy = 0, trigger, supportCnt } = options;
        newSummon.forEach(smn => {
            let csmnIdx = oriSummon.findIndex(osm => osm.id == smn.id);
            const oriSmn = oriSummon[csmnIdx];
            if (csmnIdx > -1 && oriSmn.isTalent != smn.isTalent) { // 如果召唤物是否带有天赋不同，则重新附属
                oriSummon.splice(csmnIdx, 1);
                csmnIdx = -1;
            }
            let csummon: Summon = oriSummon[csmnIdx];
            let isGenerate = true;
            if (csmnIdx > -1) { // 重复生成召唤物
                oriSummon[csmnIdx].useCnt = Math.max(oriSmn.useCnt, Math.min(oriSmn.maxUse, oriSmn.useCnt + smn.useCnt));
                oriSummon[csmnIdx].perCnt = smn.perCnt;
                oriSummon[csmnIdx].damage = smn.damage;
            } else if (oriSummon.filter(smn => smn.isDestroy != SUMMON_DESTROY_TYPE.Used || smn.useCnt != 0).length < MAX_SUMMON_COUNT) { // 召唤区未满才能召唤
                csummon = smn.setEntityId(this._genEntityId());
                oriSummon.push(csummon);
                const { smnres = {} } = this._detectSummon(pidx, 'enter', { players, csummon: [smn], isExec });
                if (smnres.rCombatStatus) {
                    this._updateStatus(pidx, this._getStatusById(smnres.rCombatStatus), combatStatus, players, { hidx, isExec });
                }
                if (isExec) this._writeLog(`[${name}](${pidx})召唤[${smn.name}](${smn.entityId})`, 'system');
            } else isGenerate = false;
            if (isGenerate) this._detectSupport(pidx, 'summon-generate', { players, csummon, supportCnt, isExec });
        });
        if (isSummon > -1) return assgin(summons, oriSummon);
        assgin(summons, oriSummon.filter(smn => {
            if (smn.statusId > 0) { // 召唤物有关联状态
                const nSmnStatus = this.newStatus(smn.statusId, smn.id);
                const group = nSmnStatus.group;
                const statuses = [heros[hidx].heroStatus, combatStatus][group];
                const smnStatus = statuses.find(sts => sts.id == smn.statusId) ?? nSmnStatus;
                smnStatus.useCnt = smn.useCnt;
                this._updateStatus(pidx, [smnStatus], statuses, players, { hidx, isExec, isLog: false });
            }
            if (destroy != 1 && (!destroy || destroy != smn.entityId)) return true;
            if ( // 召唤物消失
                (smn.useCnt == 0 &&
                    (smn.isDestroy == SUMMON_DESTROY_TYPE.Used ||
                        (smn.isDestroy == SUMMON_DESTROY_TYPE.UsedRoundEnd && trigger == 'phase-end'))) ||
                (smn.isDestroy == SUMMON_DESTROY_TYPE.RoundEnd && trigger == 'phase-end')
            ) {
                const combatSts = combatStatus.find(sts => sts.summonId == smn.id);
                if (combatSts) {
                    combatSts.roundCnt = 0;
                    this._updateStatus(pidx, [], combatStatus, players, { isExec });
                } else {
                    for (let i = 0; i < heros.length; ++i) {
                        const hi = (hidx + i) % heros.length;
                        const heroSts = heros[hi].heroStatus.find(sts => sts.summonId == smn.id);
                        if (heroSts) {
                            heroSts.roundCnt = 0;
                            this._updateStatus(pidx, [], heros[hi].heroStatus, players, { hidx: hi, isExec });
                            break;
                        }
                    }
                }
                if (isExec) this._doSummonDestroy(pidx, smn);
                return false;
            }
            return true;
        }));
    }
    private _startTimer() {
        if (this.countdown.limit <= 0) return;
        if (this.countdown.timer != undefined) clearInterval(this.countdown.timer);
        this.countdown.curr = this.countdown.limit;
        this.countdown.timer = setInterval(() => {
            --this.countdown.curr;
            if (this.countdown.curr <= 0 || this.phase != PHASE.ACTION) {
                if (this.countdown.curr <= 0) this._doEndPhase(this.currentPlayerIdx, 'endPhase');
                this.countdown.curr = 0;
                clearInterval(this.countdown.timer);
                this.countdown.timer = undefined;
            }
        }, 1e3);
    }
    /**
     * 投降
     * @param pidx 发起投降玩家序号
     */
    private _giveup(pidx: number) {
        this._writeLog(`[${this.players[pidx].name}](${pidx})投降`);
        this._gameEnd(pidx ^ 1);
    }
    /**
     * 检测是否有赢家
     * @returns 赢家序号 -1为无 -2为双败
     */
    private _isWin() {
        let winnerIdx = -1;
        this.players.forEach((p, i) => {
            const isLose = p.heros.every(h => h.hp <= 0);
            if (isLose) {
                if (winnerIdx == -1) winnerIdx = i ^ 1;
                else winnerIdx = -2;
            }
        });
        if (winnerIdx != -1) {
            this.delay(2500, () => this._gameEnd(winnerIdx));
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
            p.phase = p.id == AI_ID ? PHASE.NOT_BEGIN : PHASE.NOT_READY;
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
        this.seed = '';
        this.shareCodes = ['', ''];
        this.emit('game-end', winnerIdx);
    }
    /**
     * 执行任务
     * @param stopWithTaskType 任务类型为此时不执行
     */
    private async _execTask(stopWithTaskType: string = '#') {
        try {
            if (this.taskQueue.isExecuting || this.taskQueue.isTaskEmpty()) return;
            this.taskQueue.isExecuting = true;
            while (!this.taskQueue.isTaskEmpty() && this.taskQueue.isExecuting &&
                !this.taskQueue.isDieWaiting &&
                this.players.every(p => p.phase != PHASE.PICK_CARD)
            ) {
                const [[peekTaskType]] = this.taskQueue.peekTask();
                if (peekTaskType.includes(stopWithTaskType)) break;
                const [[taskType, args, source, isDmg]] = this.taskQueue.getTask();
                if (!this._hasNotDieSwitch() && this.taskQueue.isDieWaiting) {
                    this.taskQueue.addTask(taskType, args, { isUnshift: true, source, isDmg });
                    break;
                }
                if (taskType.includes('heroDie')) this.taskQueue.isDieWaiting = true;
                if (taskType == 'not found' || !taskType || !args) break;
                let task: [() => void | Promise<void>, number?, number?][] | undefined;
                if (taskType.startsWith('status-')) task = this._detectStatus(...(args as Parameters<typeof this._detectStatus>)).task;
                else if (taskType.startsWith('support-')) task = this._detectSupport(...(args as Parameters<typeof this._detectSupport>)).task;
                else if (taskType.startsWith('summon-')) task = this._detectSummon(...(args as Parameters<typeof this._detectSummon>)).task;
                else if (taskType.startsWith('slot-')) task = this._detectSlot(...(args as Parameters<typeof this._detectSlot>)).task;
                else if (taskType.startsWith('skill-')) task = this._detectSkill(...(args as Parameters<typeof this._detectSkill>)).task;
                else task = args as [() => void, number?, number?][];
                if (taskType.startsWith('statusAtk-')) {
                    const isExeced = await this.taskQueue.execTask(taskType, [[() => this._doStatusAtk(args as StatusTask)]]);
                    if (!isExeced) {
                        this.taskQueue.addStatusAtk([args as StatusTask], { isUnshift: true });
                        break;
                    }
                } else {
                    if (task == undefined) continue;
                    await this.taskQueue.execTask(taskType, task);
                }
            }
            this.taskQueue.isExecuting = false;
        } catch (e) {
            const error: Error = e as Error;
            console.error(error);
            this.emitError(error);
        }
    }
    /**
    * 计算技能的变化伤害和骰子消耗
    * @param pidx 玩家序号
    * @param hidx 角色序号
    * @param options.isSwitch 切换的角色序号
    * @param options.isReadySkill 准备技能id
    * @param options.skid 使用的技能id
    * @param options.players 玩家数组
    * @param options.isExec 是否执行
    * @param options.isChargedAtk 是否为重击
    */
    private _calcSkillChange(pidx: number, hidx: number, options: {
        isSwitch?: number, isReadySkill?: boolean, skid?: number, players?: Player[], isExec?: boolean, isChargedAtk?: boolean,
    } = {}) {
        if (!this.isStart) return;
        const { isSwitch = -1, isReadySkill, skid = -1, players = this.players, isExec } = options;
        const player = players[pidx];
        const { isChargedAtk = player.dice.length % 2 == 0 } = options;
        if (hidx == -1 || skid == -2 || !player) return;
        const heros = player.heros;
        if (isSwitch > -1 && !isExec) hidx = isSwitch;
        const curHero = heros[hidx];
        if (!curHero) throw new Error(`@_calcSkillChange: hero not found\n pidx:${pidx},hidx:${hidx},skid:${skid},heros:[${heros.map(h => heroToString(h))}]`);
        const rskill = isReadySkill ? this.newSkill(skid) : null;
        const skills = [...curHero.skills.filter(sk => sk.type != SKILL_TYPE.Passive && sk.type != SKILL_TYPE.PassiveHidden)];
        if (curHero.vehicleSlot) skills.unshift(curHero.vehicleSlot[1]);
        const genSkillArr = <T>(item: T) => skills.map(() => clone(item));
        const dmgChange = genSkillArr(0);
        const costChange: [number, number, number[], number[][]][] = genSkillArr([0, 0, [], []]);
        const mds = skills.map(sk => sk.cost.slice(0, 2).map(v => v.cnt));
        for (const sts of [...curHero.heroStatus, ...(player.hidx == hidx ? player.combatStatus : [])]) {
            const stsres = sts.handle(sts, { trigger: 'calc' });
            if (!stsres.addDiceSkill) continue;
            const { skill = [0, 0, 0] } = stsres.addDiceSkill;
            for (const sidx in skills) {
                const curskill = skills[sidx];
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
                    const curSkill = skills[i];
                    const skillAddDmg = curSkill.type == SKILL_TYPE.Vehicle ? 0 : (res.addDmg ?? 0);
                    a[i] += skillAddDmg + (res[`addDmgType${curSkill.type}`] ?? 0);
                });
            }
        }
        const costChangeList: [number, number][][][] = [...genSkillArr([[], [], []])]; // [有色骰, 无色骰, 元素骰]
        const calcCostChange = <T extends { minusDiceSkill?: MinusDiceSkill }>(res: T, entityId: number, isOther = false) => {
            if (!res.minusDiceSkill) return;
            const { minusDiceSkill: { skill = [0, 0, 0], skills: mskills = [], elDice, isAll } } = res;
            if (isOther && !isAll) return;
            costChange.forEach((_, i) => {
                const curSkill = skills[i];
                for (let j = 0; j < 3; ++j) {
                    if (j == 0 && curSkill.cost[0].type != elDice) continue;
                    const ski = curHero.skills.findIndex(sk => sk.id == curSkill.id);
                    const change = (ski != -1 ? skill[j] : 0) + (res.minusDiceSkill?.[`skilltype${curSkill.type}`]?.[j] ?? 0) + (mskills[ski]?.[j] ?? 0);
                    if (change > 0) costChangeList[i][j].push([entityId, change]);
                }
            });
        }
        skills.forEach(curSkill => {
            const skillres = curSkill.handle({
                skill: curSkill,
                hero: curHero,
                hcards: player.handCards,
                trigger: 'calc',
            });
            calcCostChange(skillres, curSkill.id);
        });
        const heroField = this._getHeroField(pidx, { hidx, includeCombatStatus: true });
        for (const hfield of heroField) {
            const fieldres = hfield.handle(hfield as any, {
                heros,
                hero: player.heros[hidx],
                eheros: players[pidx ^ 1]?.heros,
                hidx,
                isChargedAtk,
                isFallAtk: player.isFallAtk,
                hcards: player.handCards,
                trigger: 'calc',
            });
            calcDmgChange(fieldres);
            calcCostChange(fieldres, hfield.entityId);
        }
        for (let i = 1; i < player.heros.length; ++i) {
            const hi = (hidx + i) % player.heros.length;
            const heroField = this._getHeroField(pidx, { hidx: hi, isOnlyHeroStatus: true });
            for (const hfield of heroField) {
                const fieldres = hfield.handle(hfield as any, {
                    heros,
                    hero: heros[hidx],
                    eheros: players[pidx ^ 1]?.heros,
                    hidx,
                    isChargedAtk,
                    isFallAtk: player.isFallAtk,
                    hcards: player.handCards,
                    trigger: 'calc',
                });
                if (!fieldres.trigger?.some(trg => trg.startsWith('other'))) continue;
                calcCostChange(fieldres, hfield.entityId, true);
            }
        }
        player.summons.forEach(smn => {
            const smnres = smn.handle(smn, {
                heros,
                hidx,
                isChargedAtk,
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
        for (let i = 0; i < skills.length; ++i) {
            const curSkill = skills[i];
            curSkill.dmgChange = dmgChange[i];
            let [elDice, anyDice] = mds[i];
            const [elCostChangeList, anyCostChangeList, diceCostChangeList] = clone(costChangeList[i]);
            const setCostChange = (eid: number) => {
                if (costChange[i][2].includes(eid)) {
                    const tmp = costChange[i][3].find(([e]) => e == eid);
                    tmp![1] = elDice + anyDice;
                } else {
                    costChange[i][2].push(eid);
                    costChange[i][3].push([eid, elDice + anyDice]);
                }
            }
            for (let d = 0; d < elCostChangeList.length; ++d) {
                if (elDice == 0) break;
                const [eid, cnt] = elCostChangeList[d];
                const mcnt = Math.min(elDice, cnt);
                elCostChangeList[d][1] -= mcnt;
                if (mcnt == cnt) elCostChangeList.splice(d--, 1);
                elDice -= mcnt;
                costChange[i][0] = Math.min(curSkill.cost[0].cnt, costChange[i][0] + cnt);
                setCostChange(eid)
            }
            while (anyCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = anyCostChangeList.shift()!;
                anyDice = Math.max(0, anyDice - cnt);
                costChange[i][1] = Math.min(curSkill.cost[1].cnt, costChange[i][1] + cnt);
                setCostChange(eid);
            }
            while (elCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = elCostChangeList.shift()!;
                anyDice = Math.max(0, anyDice - cnt);
                costChange[i][1] = Math.min(curSkill.cost[1].cnt, costChange[i][1] + cnt);
                setCostChange(eid);
            }
            for (let d = 0; d < diceCostChangeList.length; ++d) {
                if (elDice == 0) break;
                const [eid, cnt] = diceCostChangeList[d];
                const mcnt = Math.min(elDice, cnt);
                diceCostChangeList[d][1] -= mcnt;
                if (mcnt == cnt) diceCostChangeList.splice(d--, 1);
                elDice -= mcnt;
                costChange[i][0] = Math.min(curSkill.cost[0].cnt, costChange[i][0] + cnt);
                setCostChange(eid);
            }
            while (diceCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = diceCostChangeList.shift()!;
                anyDice = Math.max(0, anyDice - cnt);
                costChange[i][1] = Math.min(curSkill.cost[1].cnt, costChange[i][1] + cnt);
                setCostChange(eid);
            }
            curSkill.costChange = [...costChange[i]];
        }
        return skills.find(sk => sk.type == skid || sk.id == skid);
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
            const isMinusDiceWeapon = isMinusDiceCard && c.hasSubtype(CARD_SUBTYPE.Weapon);
            const isMinusDiceArtifact = isMinusDiceCard && c.hasSubtype(CARD_SUBTYPE.Artifact);
            const getMinusDiceCard = <T extends { handle: (...args: any) => { minusDiceCard?: number } }>(entity: T, hidx: number): number => {
                const isMinusDiceTalent = isMinusDiceCard && c.hasSubtype(CARD_SUBTYPE.Talent) && c.userType == player.heros[hidx].id;
                return entity.handle(entity, {
                    heros: player.heros,
                    hidxs: [hidx],
                    hidx,
                    hcard: c,
                    card: c,
                    minusDiceCard: costChange[ci],
                    isMinusDiceCard,
                    isMinusDiceTalent,
                    isMinusDiceWeapon,
                    isMinusDiceArtifact,
                })?.minusDiceCard ?? 0;
            }
            allHidxs(player.heros).forEach(hidx => {
                const heroField = this._getHeroField(pidx, { hidx });
                for (const hfield of heroField) {
                    costChange[ci] += getMinusDiceCard(hfield, hidx);
                }
            });
            player.summons.forEach(smn => {
                costChange[ci] += smn.handle(smn, {
                    heros: player.heros,
                    minusDiceCard: costChange[ci],
                })?.minusDiceCard ?? 0;
            });
            const lastSupport: Support[] = [];
            player.supports.forEach(spt => {
                const { minusDiceCard = 0, isLast } = spt.handle(spt, {
                    card: c,
                    dices: player.dice,
                    hcards: player.handCards,
                    heros: player.heros,
                    hidxs: [player.hidx],
                    playerInfo: player.playerInfo,
                    minusDiceCard: costChange[ci],
                    isMinusDiceTalent: isMinusDiceCard && c.hasSubtype(CARD_SUBTYPE.Talent),
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
            c.handle(c, { playerInfo: player.playerInfo, trigger: 'hcard-calc' });
        });
        player.handCards.forEach((c, i) => c.costChange = Math.min(c.cost + c.anydice, costChange[i]));
    }
    /**
     * 计算切换角色所需骰子及是否速切
     * @param pidx 玩家索引
     * @param tohidx 切换后的角色索引
     * @param fromhidx 切换前的角色索引
     * @param isExec 是否执行
     */
    private _calcHeroSwitch(pidx: number, tohidx: number, fromhidx: number, isExec: boolean = false) {
        const tasks: AtkTask[] = [];
        let { switchHeroDiceCnt } = this._detectSlotAndStatus(pidx, 'add-switch-from', { types: STATUS_TYPE.Usage, isExec, hidxs: fromhidx, switchHeroDiceCnt: INIT_SWITCH_HERO_DICE });
        ({ switchHeroDiceCnt } = this._detectSummon(pidx, 'add-switch', { isExec, switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectSupport(pidx, 'add-switch', { isExec, switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectSummon(pidx ^ 1, 'add-switch-oppo', { isExec, switchHeroDiceCnt }));
        let { isQuickAction } = this._detectSkill(pidx, 'minus-switch-from', { isExec, hidxs: fromhidx });
        ({ switchHeroDiceCnt, isQuickAction } = this._detectSlotAndStatus(pidx, 'minus-switch-from', { types: [STATUS_TYPE.Usage, STATUS_TYPE.Attack], isExec, hidxs: fromhidx, switchHeroDiceCnt, isQuickAction }));
        const { switchHeroDiceCnt: s, isQuickAction: q, tasks: t } = this._detectSlotAndStatus(pidx, 'minus-switch-to', { types: STATUS_TYPE.Usage, isExec, hidxs: tohidx, switchHeroDiceCnt, isQuickAction });
        switchHeroDiceCnt = s;
        isQuickAction = q;
        tasks.push(...t);
        ({ switchHeroDiceCnt, isQuickAction } = this._detectSlotAndStatus(pidx, 'minus-switch', { isExec, hidxs: allHidxs(this.players[pidx].heros), switchHeroDiceCnt, isQuickAction }));
        ({ switchHeroDiceCnt, isQuickAction } = this._detectSummon(pidx, 'minus-switch', { isExec, switchHeroDiceCnt, isQuickAction }));
        ({ switchHeroDiceCnt, isQuickAction } = this._detectSupport(pidx, 'minus-switch', { isExec, switchHeroDiceCnt, isQuickAction }));
        return { switchHeroDiceCnt, isQuickAction, tasks }
    }
    /**
     * 是否有阵亡
     * @param players 当前玩家组
     * @returns 是否有阵亡
     */
    private _hasNotDieSwitch(players: Player[] = this.players) {
        return players.every(p => p.status != PLAYER_STATUS.DIESWITCH);
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
     * @param options.isSwitch 之前已切换序号
     * @returns 当前出战角色信息
     */
    private _getFrontHero(pidx: number, options: { players?: Player[], offset?: number, isAll?: boolean, isSwitch?: number } = {}): Hero {
        const { players = this.players, offset = 0, isAll, isSwitch = -1 } = options;
        const player = players[pidx];
        const aliveHidxs = allHidxs(player.heros, { isAll, include: isCdt(offset != 0, player.hidx) });
        const fidx = aliveHidxs.findIndex(i => i == (isSwitch > -1 ? isSwitch : player.hidx));
        if (fidx == -1) return player.heros[fidx];
        return player.heros[aliveHidxs[(fidx + offset + aliveHidxs.length) % aliveHidxs.length]];
    }
    /**
     * 获取角色区域实体
     * @param pidx 玩家索引
     * @param options.players 玩家信息
     * @param options.hidx 角色序号(默认出战角色)
     * @param options.isOnlyHeroStatus 是否只获取角色状态
     * @param options.hcard 打出的为将要装备的牌
     * @param options.includeCombatStatus 是否获取出战状态
     * @param options.equipHidx 将要装备牌的角色索引
     * @returns 角色区域数组
     */
    private _getHeroField(pidx: number, options: {
        players?: Player[], hidx?: number, isOnlyHeroStatus?: boolean, hcard?: Card, includeCombatStatus?: boolean, equipHidx?: number,
    } = {}) {
        const { players = this.players, isOnlyHeroStatus, hcard, includeCombatStatus, equipHidx } = options;
        const { heros, combatStatus, hidx: ahidx } = players[pidx];
        const { hidx = ahidx } = options;
        const hero = heros[hidx] ?? this._getFrontHero(pidx, { players });
        if (!hero) return [];
        const field: (Card | Status)[] = [...hero.heroStatus];
        const isEquip = hcard && hidx == equipHidx;
        if (hero.weaponSlot && (!isEquip || !hcard?.hasSubtype(CARD_SUBTYPE.Weapon))) field.push(hero.weaponSlot);
        if (hero.artifactSlot && (!isEquip || !hcard?.hasSubtype(CARD_SUBTYPE.Artifact))) field.push(hero.artifactSlot);
        if (hero.vehicleSlot && (!isEquip || !hcard?.hasSubtype(CARD_SUBTYPE.Vehicle))) field.push(hero.vehicleSlot[0]);
        if (hero.talentSlot) field.push(hero.talentSlot);
        field.sort((a, b) => b.entityId - a.entityId);
        if (hcard && !hcard.hasSubtype(CARD_SUBTYPE.Talent) && hidx == equipHidx) field.push(hcard);
        if (includeCombatStatus || (hidx == ahidx && !isOnlyHeroStatus)) field.push(...combatStatus);
        return field;
    }
    /**
     * 根据id和参数获取状态数组
     * @param statusArgs 状态的id及参数
     * @returns 状态数组
     */
    private _getStatusById(statusArgs: (number | [number, ...any] | Status)[] | number | undefined): Status[] {
        if (statusArgs == undefined) return [];
        const args = typeof statusArgs == 'number' ? [statusArgs] : statusArgs;
        return args.map(stsargs => {
            if (Array.isArray(stsargs) || typeof stsargs == 'number') {
                return this.newStatus(...(typeof stsargs == 'number' ? [stsargs] : stsargs) as [number, ...any]);
            }
            return stsargs;
        });
    }
    /**
     * 根据id和参数获取召唤物数组
     * @param summonArgs 状态的id及参数
     * @returns 状态数组
     */
    private _getSummonById(summonArgs: (number | [number, ...any] | Summon)[] | number | undefined): Summon[] {
        if (summonArgs == undefined) return [];
        const args = typeof summonArgs == 'number' ? [summonArgs] : summonArgs;
        return args.map(smnargs => {
            if (Array.isArray(smnargs) || typeof smnargs == 'number') {
                return this.newSummon(...(typeof smnargs == 'number' ? [smnargs] : smnargs) as [number, ...any]);
            }
            return smnargs;
        });
    }
    /**
     * 根据id和参数获取支援物数组
     * @param summonArgs 状态的id及参数
     * @returns 状态数组
     */
    private _getSupportById(supportArgs: (number | [number, ...any] | Support)[] | number | undefined): Support[] {
        if (supportArgs == undefined) return [];
        const args = typeof supportArgs == 'number' ? [supportArgs] : supportArgs;
        return args.map(sptargs => {
            if (Array.isArray(sptargs) || typeof sptargs == 'number') {
                return this.newSupport(...(typeof sptargs == 'number' ? [sptargs] : sptargs) as [number, ...any]);
            }
            return sptargs;
        });
    }
    /**
     * 按条件获取卡牌id数组
     * @param filter 筛选条件
     * @returns 卡牌id数组
     */
    private _getCardIds(filter: (cards: Card) => boolean = () => true): number[] {
        return cardsTotal(this.version.value).filter(filter).map(card => card.id);
    }
}


