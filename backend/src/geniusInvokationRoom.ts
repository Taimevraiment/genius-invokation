import LZString from 'lz-string';
import * as fs from 'node:fs';
import http from 'node:http';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, Socket } from 'socket.io';
import { dict } from '../../common/constant/dependancyDict.js';
import {
    ACTION_TYPE, ActionType, CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CMD_MODE, COST_TYPE,
    CostType, DAMAGE_TYPE,
    DICE_COST_TYPE, DICE_TYPE,
    DICE_TYPE_CODE_KEY,
    DamageType, DiceCostType, ELEMENT_REACTION, ELEMENT_TYPE, ELEMENT_TYPE_KEY, ElementCode, ElementType, HERO_LOCAL, HERO_LOCAL_CODE,
    PHASE, PLAYER_STATUS, PURE_ELEMENT_CODE, PURE_ELEMENT_CODE_KEY, PURE_ELEMENT_TYPE, PURE_ELEMENT_TYPE_KEY, Phase,
    PureElementType, SKILL_COST_TYPE, SKILL_TYPE, STATUS_GROUP, STATUS_TYPE, SUMMON_DESTROY_TYPE, SWIRL_ELEMENT_TYPE, SkillType, StatusGroup, StatusType, SwirlElementType, Version
} from '../../common/constant/enum.js';
import {
    AI_ID, DECK_CARD_COUNT, INIT_DICE_COUNT, INIT_HANDCARDS_COUNT,
    INIT_PILE_COUNT,
    INIT_ROLL_COUNT, INIT_SWITCH_HERO_DICE, MAX_DICE_COUNT,
    MAX_GAME_ROUND, MAX_HANDCARDS_COUNT, MAX_STATUS_COUNT, MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT,
    STATUS_DESTROY_ID
} from '../../common/constant/gameOption.js';
import { INIT_DAMAGEVO, INIT_PLAYER, NULL_CARD } from '../../common/constant/init.js';
import { DICE_WEIGHT, ELEMENT_NAME, SKILL_TYPE_NAME, SLOT_CODE } from '../../common/constant/UIconst.js';
import { ArrayHero, ArrayStatus, ArraySummon, ArraySupport, EntityHandleEvent, InputHandle } from '../../common/data/builder/baseBuilder.js';
import { CardHandleRes, GICard } from '../../common/data/builder/cardBuilder.js';
import { StatusHandleRes } from '../../common/data/builder/statusBuilder.js';
import { SummonHandleRes } from '../../common/data/builder/summonBuilder.js';
import { cardsTotal, newCard, parseCard } from '../../common/data/cards.js';
import { herosTotal, newHero, parseHero } from '../../common/data/heros.js';
import { newSkill } from '../../common/data/skills.js';
import { newStatus } from '../../common/data/statuses.js';
import { newSummon } from '../../common/data/summons.js';
import { newSupport } from '../../common/data/supports.js';
import CmdsGenerator from '../../common/utils/cmdsGenerator.js';
import {
    checkDices,
    getElByHid,
    getHidById,
    getObjIdxById, getSortedDices, getVehicleIdByCid,
    heroToString, playerToString, versionWrap
} from '../../common/utils/gameUtil.js';
import { arrToObj, assign, clone, convertToArray, delay, getSecretData, isCdt, objToArr, parseShareCode, wait } from '../../common/utils/utils.js';
import {
    ActionData, ActionInfo, Card, Cmds, Countdown, CustomVersionConfig, DamageVO, DmgSource, EnergyIcons, Env, Hero, LogType, MinusDiceSkill, PickCard,
    Player, Preview, RecordData, ServerData, Skill, Status, Summon, Support, Trigger, VersionWrapper
} from '../../typing';
import TaskQueue from './taskQueue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const secretKey = await getSecretData('secretKey');
const koishiUrl = await getSecretData('koishiUrl');

// Error.stackTraceLimit = 20;

export default class GeniusInvokationRoom {
    private io?: Server; // socket.io
    id: number; // 房间id
    name: string; // 房间名
    version: VersionWrapper; // 游戏版本
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
    private entityIdIdx: number = -700000; // 实体id序号标记
    previews: Preview[] = []; // 当前出战玩家预览
    private log: { content: string, type: LogType }[] = []; // 当局游戏的日志
    private systemLog: string = ''; // 系统日志
    private errorLog: string[] = []; // 错误日志
    private reporterLog: { name: string, message: string }[] = []; // 报告者问题
    private recordData: RecordData; // 行动操作日志
    countdown: Countdown = { limit: 0, curr: 0, timer: undefined }; // 倒计时
    private isDieBackChange: boolean = true; // 用于记录角色被击倒切换角色后是否转换回合
    private pickModal: PickCard = { cards: [], selectIdx: -1, cardType: 'getCard' };// 挑选卡牌信息
    private preview!: { // 预览全局变量
        isValid: boolean, // 是否合法
        isExec: boolean, // 是否不为预览
        willAttachs: ([ElementType, ElementType] | ElementType)[][][], // 附着预览
        isQuickAction: boolean, // 是否为快速行动
        hpChange: number[][], // 0不变 1有伤害 2有回血 3复活 <0超杀伤害
        summonChange: number[], // 有变化的召唤物entityId
        supportChange: number[], // 有变化的支援物entityId
        changedSummons: (Summon | undefined)[][], // 召唤物变化预览
        willSwitch: boolean[][], // 角色切换预览
        tarHidx: number, // 受攻击角色hidx
        triggers: Set<Trigger>[][], // 造成伤害后形成的触发时机
    };
    private shareCodes: string[] = ['', '']; // 卡组码
    allowLookon: boolean; // 是否允许观战
    customVersionConfig?: CustomVersionConfig; // 自定义版本配置
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
    private wait = async (cdt: () => any, options: { delay?: number, freq?: number, maxtime?: number, isImmediate?: boolean, callback?: () => void } = {}) => {
        if (this.env == 'test' || !this.preview.isExec && this.id > 0) return;
        await wait(cdt, options);
    }
    testDmgFn: (() => void)[] = []; // 伤害测试用
    testTaskFn: (() => void)[] = []; // 任务测试用
    // private _heartBreak: (NodeJS.Timeout | undefined)[][] = [[undefined, undefined], [undefined, undefined]]; // 心跳包的标记

    constructor(
        id: number, name: string, version: Version, password: string, countdown: number,
        allowLookon: boolean, env: Env, customVersionConfig?: CustomVersionConfig, io?: Server
    ) {
        this.io = io;
        this.id = id;
        this.name = name || `房间${id}`;
        this.version = versionWrap(version);
        this.password = password;
        this.countdown.limit = countdown;
        this.allowLookon = allowLookon;
        this.customVersionConfig = customVersionConfig;
        this.recordData = { name: this.name, pidx: -1, username: [], shareCode: [], seed: '', version, actionLog: [], customVersionConfig }
        this.env = id < 0 ? 'prod' : env;
        const { diff = [] } = customVersionConfig ?? {};
        this.newStatus = newStatus(version, { diff, dict });
        this.newCard = newCard(version, { diff, dict });
        this.newHero = newHero(version);
        this.newSummon = newSummon(version, { diff, dict });
        this.newSupport = (id: number | Card, ...args: any[]) => {
            if (typeof id === 'number') return newSupport(version, { diff, dict })(this.newCard(id), ...args);
            return newSupport(version, { diff, dict })(id, ...args);
        }
        this.newSkill = newSkill(version, { diff });
        this.taskQueue = new TaskQueue(this._writeLog.bind(this), this.env);
        this._resetPreview();
        this.delay = async (time: number = -1, fn?: () => any) => {
            if (this.env == 'test' || !this.preview.isExec || time < 0) return fn?.();
            await delay(time, fn);
        }
    }
    get isDev() {
        return this.env == 'dev' && this.id > 0;
    }
    get currentPlayerIdx() {
        return this._currentPlayerIdx;
    }
    set currentPlayerIdx(val: number) {
        this._currentPlayerIdx = (val + PLAYER_COUNT) % PLAYER_COUNT;
    }
    get needWait() {
        return this.taskQueue.isTaskEmpty() && !this.taskQueue.isExecuting && !this.taskQueue.canExecTask &&
            this.players.every(p => p.status != PLAYER_STATUS.DIESWITCH);
    }
    get string() {
        return `{\n`
            + `  name: ${this.name}\n`
            + `  id: ${this.id}\n`
            + `  version: ${this.version.value}\n`
            + `  password: ${this.password}\n`
            + `  seed: ${this.seed}\n`
            + `  currentPlayerIdx: ${this.currentPlayerIdx}\n`
            + `  onlinePlayersCnt: ${this.onlinePlayersCnt}\n`
            + `  preview: ${JSON.stringify(this.preview)}\n`
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
            + `${this.systemLog.replace(/【p?\d*:?(.+?)】/g, '$1').split('\n').map(l => '    ' + l).join('\n')}\n`
            + `}`;
    }
    get roomInfoLog() {
        return '\nroomInfo: {\n'
            + `  seed: ${this.seed}\n`
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
    get handleEvent() {
        return {
            round: this.round,
            players: this.players,
            randomInt: this._randomInt.bind(this),
            randomInArr: this._randomInArr.bind(this),
            getCardIds: this._getCardIds.bind(this),
        }
    }
    get hasDieSwitch() {
        return this.players.some(p => p.status == PLAYER_STATUS.DIESWITCH);
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
        return selected.map(idx => arr[idx]);
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
        if (this.env == 'test' || !this.preview.isExec) return;
        if (type != 'system' && type != 'emit') this.log.push({ content: log.replace(/\{.*?\}/g, ''), type });
        this.systemLog += log.replace(/\{|\}/g, '') + '\n';
    }
    /**
     * 导出日志
     */
    exportLog(options: { isShowRoomInfo?: boolean, isError?: boolean, info?: string } = {}) {
        if (this.env == 'test' || this.id < -1) return;
        const { isShowRoomInfo = true, isError, info = '' } = options;
        let log = this.systemLog.replace(/【p?\d*:?(.+?)】/g, '$1') + '\n' +
            this.errorLog.join('\n') + '\n' +
            this.reporterLog.map(l => `[${l.name}]: ${l.message}\n`).join('');
        if (isShowRoomInfo) log += this.roomInfoLog;
        const path = `${__dirname}/../../../logs/${this.seed || `${new Date().toISOString().split('T')[0]}-${this.version.value.replace(/\./g, '_')}-r${this.id}`}`;
        fs.writeFile(`${path}.log`, log, err => err && console.error('err:', err));
        if (!this.isDev) {
            const recordData: RecordData = { ...this.recordData, username: this.players.map(v => v.name), pidx: 0 };
            fs.writeFile(`${path}.gi`, LZString.compressToBase64(JSON.stringify(recordData)), err => err && console.error('err:', err));
        }
        if (!this.isDev) http.get(`${koishiUrl}?message=${isError ? `7szh报错了[${this.players.map(p => p.name).join('vs')}]` : `7szh有日志被发送了:${info}`}`, { headers: { flag: secretKey } });
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
    private async _getPreview(pidx: number) {
        // const preview = clone(this.preview);
        const skillPreviews = await this._previewSkill(pidx);
        const cardPreviews = await this._previewCard(pidx);
        const switchPreviews = await this._previewSwitch(pidx);
        // this.preview = clone(preview);
        return [...skillPreviews, ...cardPreviews, ...switchPreviews];
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
     * @param options.ohidx 切换前角色序号
     * @param options.trigger 触发时机
     */
    async emit(flag: string, pidx: number, options: {
        socket?: Socket, tip?: string | string[], damageVO?: DamageVO, notPreview?: boolean, notUpdate?: boolean, actionInfo?: ActionInfo,
        isQuickAction?: boolean, canAction?: boolean, isChange?: boolean, isActionInfo?: boolean, slotSelect?: number[], ohidx?: number,
        heroSelect?: number[], statusSelect?: number[], summonSelect?: number[], supportSelect?: number[], trigger?: Trigger,
    } = {}, callback?: () => void) {
        if (pidx < 0) return;
        flag += `-p${pidx}`;
        try {
            const { socket, tip = '', actionInfo, damageVO = null, notPreview, isActionInfo, canAction = true,
                slotSelect = [], heroSelect = [], statusSelect = [], summonSelect = [], supportSelect = [], notUpdate,
                isQuickAction = this.preview.isQuickAction, isChange, ohidx, trigger,
            } = options;
            const isDelay = (statusSelect + '' + summonSelect) ? 0 : -1;
            this.players.forEach(p => {
                p.handCards.sort((a, b) => a.id - b.id || b.entityId - a.entityId).forEach((c, ci) => c.cidx = ci);
                if (this.preview.isExec) p.heros.forEach(h => h.UI.energyIcons = h.updateEnergyIcon(h, 0));
                if (this.isStart && p.hidx != -1) {
                    p.heros.forEach(h => {
                        if (!notUpdate) {
                            this.delay(isDelay, () => {
                                this._updateStatus(p.pidx, [], h.heroStatus,
                                    { hidx: h.hidx, isAddAtkStsTask: true });
                            });
                        }
                        this._calcSkillChange(p.pidx, { hidx: h.hidx });
                    });
                    if (!notUpdate) {
                        this.delay(isDelay, () => {
                            this._updateStatus(p.pidx, [], p.combatStatus,
                                { ohidx: isCdt(p.pidx == pidx, ohidx), isAddAtkStsTask: true });
                        });
                    }
                    if (!notUpdate) {
                        this.delay(isDelay, () => this._updateSummon(p.pidx, [], { destroy: summonSelect?.[3] ?? 1, trigger }));
                    }
                }
                p.canAction = canAction && (p.pidx == this.currentPlayerIdx || !isChange) &&
                    (isQuickAction || p.canAction || flag.includes('Update')) && this.taskQueue.isTaskEmpty() &&
                    this.isStart && p.phase == PHASE.ACTION && p.status == PLAYER_STATUS.PLAYING &&
                    (p.heros[p.hidx].heroStatus.has(STATUS_TYPE.NonAction) ||
                        !p.heros[p.hidx].heroStatus.has(STATUS_TYPE.ReadySkill));
                this._calcCardChange(p.pidx);
            });
            if (this.env == 'test' || !this.preview.isExec) return;
            // 计算预测行动的所有情况
            const cplayer = this.players[this.currentPlayerIdx];
            if (
                this.phase == PHASE.ACTION && !notPreview && cplayer.canAction && !flag.includes('Update') && !this.hasDieSwitch &&
                this.taskQueue.isTaskEmpty() && !this.taskQueue.isExecuting && cplayer.status == PLAYER_STATUS.PLAYING
            ) {
                if (this.id > 0) {
                    this.previews = [];
                    this.previews = await this._getPreview(this.currentPlayerIdx);
                }
                this.preview.isQuickAction = isQuickAction;
                if ( // AI行动
                    (flag.startsWith('changeTurn') && flag.includes('setP1CanAction') ||
                        flag.includes('reroll') || flag.includes('reconcile') ||
                        ((flag.includes('useCard') || flag.includes('card-doDamage') || flag.endsWith('card')) && !isChange)
                    ) && cplayer.id == AI_ID
                ) {
                    this.delay(2e3, () => {
                        this._resetPreview();
                        const actionType: ActionType[] = [ACTION_TYPE.UseCard, ACTION_TYPE.UseSkill, ACTION_TYPE.Reconcile, ACTION_TYPE.SwitchHero];
                        const { pidx: cpidx, dice, heros } = cplayer;
                        if (cplayer.phase == PHASE.DICE) {
                            this._reroll(dice.map(d => d != DICE_COST_TYPE.Omni && !heros.map(h => h.element).includes(d)), cpidx, 'reroll-ai');
                            return;
                        }
                        if (cplayer.phase == PHASE.PICK_CARD) {
                            this._pickCard(cpidx, 0);
                            return;
                        }
                        while (true) {
                            const [action] = this._randomInArr(actionType);
                            const pres = this.previews.filter(p => p.type == action && p.isValid);
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
                                        this._useSkill(cpidx, preview.skillId!, { selectSummon: preview.summonIdx, diceSelect: preview.diceSelect });
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
            if (cplayer?.id == AI_ID && cplayer?.phase == PHASE.PICK_CARD && flag.startsWith('pickCard')) {
                // AI挑选卡牌
                this.delay(1e3, () => this._pickCard(cplayer.pidx, this._randomInt(this.pickModal.cards.length - 1)));
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
                handCardsInfo: {
                    count: this.players.map(p => p.handCards.length),
                    forbiddenKnowledge: this.players.map(p => p.handCards.filter(c => c.id == 301020).length),
                },
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
                flag: `[${this.id}]${flag}`,
            };
            const _serverDataVO = (vopidx: number, tip: string | string[]) => {
                const log = this.log.map(lg => {
                    const cpidxs = lg.content.match(/(?<=【p)\d+(?=:)/g)?.map(Number) ?? [];
                    if (vopidx == -1) return { content: lg.content.replace(/【p\d+:(.+?)】/g, '$1'), type: lg.type }
                    const logctt = lg.content
                        .replace(/\[card(?:\d|-)+?\]/, '')
                        .replace(new RegExp(`\\[${this.players[vopidx]?.name}\\]\\(${vopidx}\\)`, 'g'), '[我方]')
                        .replace(new RegExp(`\\[${this.players[vopidx ^ 1]?.name}\\]\\(${vopidx ^ 1}\\)`, 'g'), '[对方]');
                    if (cpidxs.length == 0) return { content: logctt.replace(/【.+?】/g, ''), type: lg.type }
                    const content = cpidxs.reduce((a, c) => {
                        return a.replace(new RegExp(`【p${c}:(.+?)】`, 'g'), c == vopidx || this.recordData.username.length ? '$1' : '');
                    }, logctt).replace(/【.+?】/g, '');
                    return { content, type: lg.type }
                });
                const content = actionInfo?.content || (isActionInfo ? log.filter(lg => lg.type == 'info').at(-1)?.content.replace(/\s*\d→\d/g, '') ?? '' : '');
                if (flag.startsWith('game-end') && this.recordData.username.length == 0) this.recordData.username = this.players.map(v => v.name);
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
                        tip.includes('{p}') ? { tip: tip.replace(/\{p\}/, vopidx == this.currentPlayerIdx ? '我方' : '对方') } : {}),
                    log: log.map(v => v.content),
                    actionInfo: {
                        ...actionInfo,
                        content,
                        isShow: content != '' || !!actionInfo?.card,
                        isOppo: pidx != vopidx,
                    },
                    recordData: isCdt(flag.startsWith('game-end') || this.id < -1, { ...this.recordData, pidx: vopidx }),
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
                    ..._serverDataVO(this.id > 0 ? -1 : this.recordData.pidx, tip),
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
            if (this.id < 0 && flag == 'roomInfoUpdate') this.recordData.pidx = pidx;
            callback?.();
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
    emitError(err: Error | string) {
        if (typeof err === 'string') err = new Error(err);
        if (err.stack) this.errorLog.push(err.stack);
        this.io?.to([`7szh-${this.id}`, `7szh-${this.id}-p0`, `7szh-${this.id}-p1`]).emit('error', err.message);
        this.exportLog({ isError: true });
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
        aiPlayer.heros = new ArrayHero();
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
        const cardIdsPool = this._getCardIds(c => c.UI.cnt > 0);
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
     * @param seed 指定种子
     */
    start(pidx: number, flag: string, seed?: string) {
        this.seed = seed || Math.floor(Math.random() * 1e10).toString();
        this._random = +this.seed;
        this.recordData.seed = this.seed;
        this.recordData.shareCode = this.shareCodes;
        this.recordData.isExecuting = false;
        this.recordData.isPlaying = false;
        const d = new Date();
        const format = (n: number) => n.toString().padStart(2, '0');
        if (this.env != 'test') console.info(`[${this.id}]start-seed:${this.seed}`);
        this.seed = `${d.getFullYear()}-${format(d.getMonth() + 1)}-${format(d.getDate())}-${format(d.getHours())}-${format(d.getMinutes())}-${format(d.getSeconds())}-${this.version.value.replace(/\./g, '_')}-r${this.id}-s${this.seed}`;
        this.entityIdIdx = -700000;
        this.isStart = true;
        this.currentPlayerIdx = this.players[1].id == AI_ID ? 0 : this.env != 'prod' && this.id > 0 ? 1 : this._randomInt(PLAYER_COUNT);
        this.startIdx = this.currentPlayerIdx;
        this.phase = PHASE.CHANGE_CARD;
        this.winner = -1;
        this.round = 1;
        this.log = [];
        this.systemLog = '';
        this.errorLog = [];
        this.reporterLog = [];
        if (this.id > 0) this.recordData.actionLog = [];
        this.taskQueue.init();
        if (this.players[1].id == AI_ID) this._initAI();
        this.players.forEach(p => {
            p.phase = this.phase;
            p.hidx = -1;
            p.heros.forEach((h, hidx) => {
                h.setEntityId(this._genEntityId());
                h.hidx = hidx;
            });
            p.supports.splice(0, MAX_SUPPORT_COUNT);
            p.summons.splice(0, MAX_SUMMON_COUNT);
            p.dice = [];
            p.combatStatus.splice(0, MAX_STATUS_COUNT);
            p.status = PLAYER_STATUS.WAITING;
            p.playerInfo.weaponTypeCnt = new Set(p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Weapon)).map(c => c.id)).size;
            p.playerInfo.weaponCnt = p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Weapon)).length;
            p.playerInfo.relicTypeCnt = new Set(p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Relic)).map(c => c.id)).size;
            p.playerInfo.relicCnt = p.pile.filter(c => c.hasSubtype(CARD_SUBTYPE.Relic)).length;
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
            p.pile.forEach((c, ci) => c.cidx = ci);
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
            aiPlayer.heros.fhidx = aiPlayer.hidx;
            aiPlayer.phase == PHASE.DICE;
        }
        this.emit(flag, pidx);
    }
    /**
     * 停止游戏
     */
    stop() {
        this.recordData.actionLog = [];
        this.taskQueue.init();
    }
    /**
     * 获取行动
     * @param actionData 行动数据
     * @param pidx 发起行动的玩家序号
     * @param socket 发送请求socket
     */
    async getAction(actionData: ActionData, pidx: number = this.currentPlayerIdx, socket?: Socket, isRecord?: boolean) {
        if (this.taskQueue.isExecuting) return;
        if (this.id < -1 && !isRecord && actionData.type != ACTION_TYPE.PlayRecord && actionData.type != ACTION_TYPE.PuaseRecord) return;
        if (this.id > 0) this.recordData.actionLog.push({ actionData, pidx });
        const { heroIds = [], cardIds = [], cardIdxs = [], heroIdxs = [], diceSelect = [], skillId = -1,
            summonIdx = -1, supportIdx = -1, shareCode = '', recordData, flag = 'noflag' } = actionData;
        const player = this.players[pidx];
        if (!player) return;
        // this.resetHeartBreak(pidx);
        if (player.phase == PHASE.ACTION && this.taskQueue.isTaskEmpty()) this._resetPreview();
        switch (actionData.type) {
            case ACTION_TYPE.StartGame:
                if (this.players.length < PLAYER_COUNT) return this.emit('playersError', pidx, { socket, tip: `玩家为${PLAYER_COUNT}人才能开始游戏` });
                if (this.shareCodes[pidx] != shareCode && heroIds.length > 0 && cardIds.length > 0) {
                    if (heroIds.includes(0) || cardIds.length < DECK_CARD_COUNT) return this.emit('deckCompleteError', pidx, { socket, tip: '当前出战卡组不完整' });
                    const version = this.customVersionConfig ? this.customVersionConfig.baseVersion : this.version.value;
                    const options = { diff: this.customVersionConfig?.diff, banList: this.customVersionConfig?.banList, dict };
                    player.heros = new ArrayHero(...heroIds.map(hid => parseHero(hid, version, options)));
                    player.pile = cardIds.map(cid => parseCard(cid, version, options));
                    if (player.heros.some(h => h.id == 0) || player.pile.some(c => c.id == 0)) {
                        return this.emit('deckVersionError', pidx, { socket, tip: '当前卡组版本不匹配' });
                    }
                }
                player.phase = (player.phase ^ 1) as Phase;
                if (player.phase == PHASE.NOT_BEGIN) this.shareCodes[pidx] = shareCode;
                if (this.winner > -1 && this.winner < PLAYER_COUNT) this.winner += PLAYER_COUNT;
                if (this.players.every(p => p.phase == PHASE.NOT_BEGIN)) { // 双方都准备开始
                    this.start(pidx, flag, isCdt(isRecord, this.recordData.seed));
                    return 1;
                } else {
                    await this.emit(flag, pidx);
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
                await this._switchHero(pidx, heroIdxs[0], flag, { socket, diceSelect });
                break;
            case ACTION_TYPE.UseSkill:
                await this._useSkill(pidx, skillId, {
                    selectSummon: summonIdx,
                    selectHero: heroIdxs[0],
                    diceSelect,
                });
                break;
            case ACTION_TYPE.UseCard:
                await this._useCard(pidx, cardIdxs[0], diceSelect, { socket, selectHeros: heroIdxs, selectSummon: summonIdx, selectSupport: supportIdx });
                break;
            case ACTION_TYPE.Reconcile:
                await this._reconcile(pidx, diceSelect, cardIdxs[0], flag, socket);
                break;
            case ACTION_TYPE.EndPhase:
                await this._doEndPhase(pidx, flag);
                break;
            case ACTION_TYPE.GiveUp:
                this._giveup(pidx);
                break;
            case ACTION_TYPE.PickCard:
                await this._pickCard(pidx, cardIdxs[0]);
                break;
            case ACTION_TYPE.PlayRecord:
                if (this.recordData.isPlaying) return;
                if (recordData) this.recordData = recordData;
                if (!this.isStart) {
                    this.players.forEach(p => {
                        const shareCodes = this.recordData.shareCode;
                        const { heroIds, cardIds } = parseShareCode(shareCodes[p.pidx]);
                        this.getAction({ type: ACTION_TYPE.StartGame, heroIds, cardIds, shareCode: shareCodes[p.pidx] }, p.pidx, socket, true);
                    });
                }
                this.delay(0, async () => {
                    try {
                        await this.wait(() => !this.recordData.isExecuting);
                        this.recordData.isPlaying = true;
                        while (this.recordData.isPlaying && this.recordData.actionLog.length > 0) {
                            await this.delay(1e3 + Math.random() * 1e3);
                            const [{ pidx: willPidx }] = this.recordData.actionLog;
                            const player = this.players[willPidx];
                            await this.wait(() => this.needWait && this.preview.isExec && player.canAction ||
                                player.phase == PHASE.PICK_CARD || player.status == PLAYER_STATUS.DIESWITCH ||
                                ([PHASE.CHANGE_CARD, PHASE.CHOOSE_HERO, PHASE.DICE] as Phase[]).includes(this.phase), { maxtime: 3e6 });
                            await this.delay((this.phase == PHASE.ACTION ? 4e3 : 5e2) + Math.random() * 1e3);
                            this.recordData.isExecuting = true;
                            if (!this.recordData.isPlaying) break;
                            const { actionData, pidx } = this.recordData.actionLog.shift()!;
                            const { phase } = this.players[pidx];
                            if (
                                !([PHASE.ACTION, PHASE.CHANGE_CARD, PHASE.CHOOSE_HERO, PHASE.DICE, PHASE.ACTION_END] as Phase[]).includes(phase) ||
                                actionData.type == ACTION_TYPE.ChangeCard && !([PHASE.CHANGE_CARD, PHASE.ACTION, PHASE.CHOOSE_HERO] as Phase[]).includes(phase) ||
                                actionData.type == ACTION_TYPE.ChooseInitHero && phase != PHASE.CHOOSE_HERO && phase != PHASE.DICE ||
                                actionData.type == ACTION_TYPE.Reroll && phase != PHASE.DICE && phase != PHASE.ACTION ||
                                actionData.type != ACTION_TYPE.PickCard && phase == PHASE.PICK_CARD
                            ) {
                                this.recordData.actionLog.unshift({ actionData, pidx });
                                continue;
                            }
                            if (recordData?.actionLog[0]?.actionData.type == ACTION_TYPE.PickCard) {
                                const { actionData, pidx } = this.recordData.actionLog.shift()!;
                                this.delay(4e3 + Math.random() * 1e3, async () => {
                                    await this.wait(() => this.recordData.isPlaying, { freq: 1e3 });
                                    this.getAction(actionData, pidx, socket, true);
                                });
                            }
                            await this.getAction(actionData, pidx, socket, true);
                        }
                        this.recordData.isPlaying = false;
                        this.recordData.isExecuting = false;
                    } catch (e) {
                        this.emitError('录像文件损坏');
                    }
                });
                break;
            case ACTION_TYPE.PuaseRecord:
                this.recordData.isPlaying = false;
                break;
            default:
                const actionType: never = actionData.type;
                throw new Error(`@getAction: 未知的ActionType[${actionType}]`);
        }
    }
    /**
     * 仅开发用
     * @param actionData 开发调试数据
     */
    async getActionDev(actionData: {
        cpidx: number, cmds: Cmds[], dices: DiceCostType[], hps: { hidx: number, hp: number }[],
        clearSts: { hidx: number, stsid: number }[], attachs: { hidx: number, el: ElementCode, isAdd: boolean }[],
        setStsCnt: { hidx: number, stsid: number, type: string, val: number }[],
        setSmnCnt: { smnidx: number, type: string, val: number[] }[],
        setSptCnt: { sptidx: number, type: string, val: number }[],
        setSlotCnt: { hidx: number, slotid: number, type: string, val: number }[],
        disCardCnt: number, smnIds: number[][], sptIds: number[], seed: string, flag: string
    }) {
        const { cpidx, cmds, dices, attachs = [], hps = [], disCardCnt = 0, clearSts = [], setStsCnt = [],
            setSmnCnt = [], setSptCnt = [], setSlotCnt = [], smnIds = [], sptIds = [], seed = '', flag = '' } = actionData;
        if (flag.includes('seed')) {
            if (!this.isStart) this._setSeed(seed);
            return;
        }
        if (this.env == 'prod' && !this.seed.endsWith(`-s${seed}`)) return;
        if (flag.includes('log')) return this.exportLog({ isShowRoomInfo: false });
        await this.wait(() => this.taskQueue.isTaskEmpty(), { callback: () => this.taskQueue.init() });
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
            if (type == 'p') sts.setPerCnt(val);
            else if (type == 'u') sts.setUseCnt(val);
            else if (type == 'r') sts.roundCnt = val;
        }
        for (const { hidx, slotid, type, val } of setSlotCnt) {
            const hero = heros[hidx];
            const slot = hero.equipments.find(s => s.id == slotid);
            if (!slot) continue;
            if (type == 'p') slot.setPerCnt(val);
            else if (type == 'u') slot.setUseCnt(val);
        }
        if (dices) player.dice = dices;
        if (disCardCnt < 0) player.handCards.sort((a, b) => b.entityId - a.entityId).splice(disCardCnt, 10);
        if (smnIds[0]?.[0] == 0) player.summons.splice(0, MAX_SUMMON_COUNT);
        else if (smnIds[0]?.[0] < 0) player.summons.splice(smnIds[0][0]);
        else if (smnIds.length > 0) {
            this._updateSummon(cpidx, smnIds.map(smnid => this.newSummon(smnid[0], ...smnid.slice(1))));
        }
        for (const { smnidx, type, val } of setSmnCnt) {
            const smn = player.summons[smnidx];
            if (!smn) continue;
            if (type == 'p') smn.setPerCnt(val[0]);
            else if (type == 'u') smn.setUseCnt(val[0]);
        }
        if (sptIds[0] == 0) player.supports = new ArraySupport();
        else if (sptIds[0] < 0) player.supports.splice(sptIds[0]);
        else {
            while (sptIds.length > 0 && !player.supports.isFull) {
                player.supports.push(this.newSupport(sptIds.shift()!).setEntityId(this._genEntityId()));
            }
        }
        for (const { sptidx, type, val } of setSptCnt) {
            const spt = player.supports[sptidx];
            if (!spt) continue;
            if (type == 'p') spt.setPerCnt(val);
            else if (type == 'u') spt.setUseCnt(val);
        }
        if (flag.includes('resetLegend')) player.playerInfo.isUsedLegend = false;
        this._doCmds(cpidx, cmds);
        await this._execTask();
        this.players[this.currentPlayerIdx].isChargedAtk = this.players[this.currentPlayerIdx].dice.length % 2 == 0;
        this.emit(flag, cpidx, { isQuickAction: true });
    }
    /**
     * 替换手牌
     * @param pidx 玩家序号
     * @param cardIdxs 要替换的手牌序号
     * @param flag flag
     */
    private _changeCard(pidx: number, cardIdxs: number[], flag: string, socket?: Socket) { // 换牌
        const player = this.players[pidx];
        const handCardsLen = player.handCards.length + cardIdxs.length;
        const blackIds = new Set<number>();
        cardIdxs.forEach(cidx => blackIds.add(player.handCards[cidx].id));
        const oldCards = player.handCards.filter((_, idx) => cardIdxs.includes(idx));
        for (let i = 0; i < oldCards.length; ++i) {
            player.pile.splice(this._randomInt(player.pile.length - 1), 0, oldCards[i]);
            oldCards[i].UI.class = 'changed-card';
        }
        let newIdx = 0;
        while (player.handCards.length < handCardsLen && newIdx < player.pile.length - 1) {
            const newCard = player.pile[newIdx++];
            if (blackIds.has(newCard.id)) continue;
            player.pile.splice(--newIdx, 1);
            newCard.UI.class = 'change-card';
            player.handCards.push(newCard.setEntityId(this._genEntityId()));
        }
        while (player.handCards.length < handCardsLen) {
            const newCard = player.pile.shift()!.setEntityId(this._genEntityId());
            newCard.UI.class = 'change-card';
            player.handCards.push(newCard);
        }
        const delayTime = 2e3;
        if (this.phase == PHASE.ACTION) {
            this.delay(delayTime, async () => {
                player.phase = PHASE.ACTION;
                await this.emit(flag + '-action', pidx, { isQuickAction: true });
            });
        } else {
            player.UI.info = `${this.startIdx == player.pidx ? '我方' : '对方'}先手，等待对方选择......`;
            this.delay(delayTime, async () => {
                player.phase = PHASE.CHOOSE_HERO;
                await this.emit(flag + '-init', pidx, { tip: '选择出战角色', socket });
            });
        }
        this.emit(flag, pidx, { socket }, () => {
            player.handCards.forEach(c => c.UI.class == 'change-card' && delete c.UI.class);
            assign(player.handCards, player.handCards.filter(c => !c.UI.class));
            this._writeLog(player.handCards.reduce((a, c) => a + `[${c.name}](${c.entityId})`, `[${player.name}](${player.pidx})换牌后手牌为`), 'system');
        });
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
        player.heros.fhidx = hidx;
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
     * @param options.skid 技能触发的切换角色id
     * @param options.sktype 技能触发的切换角色类型
     */
    private async _switchHero(pidx: number, hidx: number, flag: string, options: {
        socket?: Socket, diceSelect?: boolean[], skill?: Skill,
    } = {}) {
        const { socket, diceSelect, skill } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const isDieSwitch = player.status == PLAYER_STATUS.DIESWITCH;
        if (this.preview.isExec && this.id > 0) {
            const { switchHeroDiceCnt: needDices = INIT_SWITCH_HERO_DICE } = this.previews.find(pre => pre.type == ACTION_TYPE.SwitchHero && pre.heroIdxs![0] == hidx) ?? {};
            if (!isDieSwitch && diceSelect && diceSelect.filter(d => d).length != needDices) return this.emit('switchHeroDiceError', pidx, { socket, tip: '骰子不符合要求' });
        }
        const ohidx = player.hidx;
        if (isDieSwitch) { // 被击倒后选择出战角色
            this.preview.isQuickAction = !this.isDieBackChange;
            const isOppoActioning = opponent.phase == PHASE.ACTION && this.preview.isQuickAction;
            player.UI.info = (isOppoActioning ? '对方' : '我方') + '行动中....';
            player.status = PLAYER_STATUS.WAITING;
            const isActioning = player.phase == PHASE.ACTION && !this.preview.isQuickAction;
            opponent.UI.info = isActioning ? '对方行动中....' : player.phase > PHASE.ACTION ? '对方已结束回合...' : '我方行动中....';
            if (isOppoActioning) this.players[this.currentPlayerIdx].canAction = true;
            this.taskQueue.isDieWaiting = false;
        } else if (diceSelect != undefined) { // 主动切换角色
            this._calcHeroSwitch(pidx, hidx, ohidx);
            for (let i = 0; i < player.heros.length; ++i) {
                const chi = (ohidx + i) % player.heros.length;
                const triggers: Trigger[] = ['active-switch'];
                if (chi == ohidx) triggers.push('active-switch-from');
                else if (chi == hidx) triggers.push('active-switch-to');
                this._detectHero(pidx, triggers, { hidxs: chi, types: STATUS_TYPE.Usage });
            }
            this._detectSummon(pidx, 'active-switch');
            this._detectSupport(pidx, 'active-switch', { hidx });
            this._detectHandcards(pidx, 'active-switch');
            this._doCmds(pidx, CmdsGenerator.ins.consumeDice(diceSelect));
        }
        const isQuickSwitch = this.preview.isQuickAction && !isDieSwitch && this.phase == PHASE.ACTION && !!diceSelect;
        this._writeLog(`[${player.name}](${player.pidx})切换为[${player.heros[hidx].name}]出战${isQuickSwitch ? '（快速行动）' : ''}`, 'info');
        const isChangeTurn = (isDieSwitch || diceSelect != undefined) && !this.hasDieSwitch;
        this.taskQueue.addTask('switchHero', async () => {
            for (let i = 0; i < player.heros.length; ++i) {
                const chi = (hidx + i) % player.heros.length;
                const triggers: Trigger[] = [];
                const types: StatusType[] = [STATUS_TYPE.Usage, STATUS_TYPE.Attack];
                let sourceHidx = -1;
                if (chi == ohidx) {
                    triggers.push('switch-from');
                    types.push(STATUS_TYPE.ReadySkill);
                    sourceHidx = hidx;
                } else if (chi == hidx) {
                    triggers.push('switch-to');
                    sourceHidx = ohidx;
                } else continue;
                triggers.push('switch');
                this._detectHero(pidx, triggers, { hidxs: chi, types, sourceHidx, skill, includeCombatStatus: true });
            }
            this._detectSupport(pidx, 'switch', { hidx, skill });
            player.isFallAtk = true;
            player.hidx = hidx;
            player.heros.forEach((h, idx) => h.isFront = idx == hidx);
            player.heros.fhidx = hidx;
            this._detectHero(pidx ^ 1, 'switch-oppo', { hidxs: opponent.hidx, types: STATUS_TYPE.Usage });
            if (player.heros[ohidx].hp == 0) player.heros[ohidx].hp = -1;
            await this.emit(flag, pidx, {
                ohidx,
                notPreview: isChangeTurn,
                actionInfo: {
                    content: `${pidx == player.pidx ? '我方' : '对方'}切换角色：${player.heros[hidx].name}`,
                    avatar: player.heros[hidx].UI.avatar,
                    subContent: isCdt(!!isQuickSwitch, '（快速行动）'),
                }
            });
        }, { delayAfter: 1e3, isUnshift: true, isImmediate: true, orderAfter: 'minus-switch' });
        await this._execTask();
        if (diceSelect != undefined) this._doActionAfter(pidx);
        await this._execTask();
        if (isDieSwitch) this._detectHero(pidx, 'killed', { types: STATUS_TYPE.Usage, hidxs: ohidx, includeCombatStatus: true })
        await this._execTask();
        if (isChangeTurn) await this._changeTurn(pidx, 'switchHero', { isDieSwitch });
    }
    /**
     * 投骰子
     * @param pidx 玩家序号
     * @param diceSelect 骰子数组
     * @returns 新的骰子数组
     */
    private _rollDice(pidx: number, diceSelect: boolean[] = [], players: Player[] = this.players) {
        const isInit = this.phase == PHASE.DICE && diceSelect.length == 0;
        const player = players[pidx];
        const dices = isInit ? [] : [...player.dice];
        const diceIdxs: number[] = diceSelect.map((s, i) => ({ s, i })).filter(v => v.s).map(v => v.i);
        const scnt = dices.length - diceIdxs.length;
        const tmpDice = arrToObj<DiceCostType, number>(Object.values(DICE_COST_TYPE), 0);
        let diceLen = isInit ? INIT_DICE_COUNT : dices.length;
        dices.forEach((d, di) => !diceIdxs.includes(di) && ++tmpDice[d]);
        if (isInit) { // 投掷阶段检测
            const handleEvent = { pidx, ...this.handleEvent };
            player.heros.forEach(h => {
                for (const slot of h.equipments) {
                    if (diceLen == 0) continue;
                    const slotres = slot.handle(slot, { ...handleEvent, trigger: 'phase-dice' });
                    const { element, cnt = 0 } = slotres;
                    const cel = !element || element == ELEMENT_TYPE.Physical ? DICE_COST_TYPE.Omni : element;
                    const dcnt = Math.min(diceLen, cnt);
                    tmpDice[cel] += dcnt;
                    diceLen -= dcnt;
                }
            });
            for (const support of player.supports) {
                const supportres = support.handle(support, { ...handleEvent, trigger: 'phase-dice' });
                if (this._hasNotTriggered(supportres.triggers, 'phase-dice') || diceLen == 0) continue;
                let { element = DICE_COST_TYPE.Omni, cnt = 0, addRollCnt = 0 } = supportres;
                if (element == 'front') element = player.heros.getFront().element as DiceCostType;
                if (element == undefined) {
                    console.info('ERROR@rollDice: element is undefined');
                    break;
                }
                element = convertToArray(element);
                cnt = convertToArray(cnt);
                for (let i = 0; i < element.length; ++i) {
                    const el = element[i];
                    const ccnt = cnt[i];
                    const dcnt = Math.min(diceLen, ccnt);
                    tmpDice[el] += dcnt;
                    diceLen -= dcnt;
                }
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
                    await this.emit(`${flag}-action`, pidx, { isQuickAction: true });
                } else { // 每回合开始时重投
                    player.phase = PHASE.ACTION_START;
                    if (this.players.every(p => p.phase == PHASE.ACTION_START)) { // 双方都重投完骰子
                        this._doReset();
                        await this._execTask();
                        await this.delay(1e3);
                        await this._doPhaseStart(flag, pidx);
                        await this.emit(`${flag}-finish`, pidx);
                    } else if (player.id != AI_ID) {
                        await this.emit(`${flag}-finish`, pidx, { socket });
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
        const reconcileDice = player.heros.getFront().element as DiceCostType | undefined;
        if (!reconcileDice) return this.emit('reconcileDiceError', pidx, { socket, tip: '未找到出战角色' });
        if (player.dice.every(d => d == DICE_COST_TYPE.Omni || d == reconcileDice)) return this.emit('reconcileDiceError', pidx, { socket, tip: '没有可以调和的骰子' });
        if (currCard.hasTag(CARD_TAG.NonReconcile) || currCard.hasAttachment(207)) {
            return this.emit('reconcileCardError', pidx, { socket, tip: '该卡牌不能调和' });
        }
        this.preview.isQuickAction = true;
        this._detectHero(pidx, 'reconcile', { types: STATUS_TYPE.Usage, hcard: currCard });
        this._detectSupport(pidx, 'reconcile');
        const { diceEl } = this._detectHandcards(pidx, 'reconcile', { cCard: currCard });
        player.dice = player.dice.map((d, di) => diceSelect[di] ? diceEl ?? reconcileDice : d);
        player.dice = this._rollDice(pidx);
        assign(player.handCards, player.handCards.filter((_, ci) => ci != cardIdx));
        ++player.playerInfo.reconcileCnt;
        this._writeLog(`[${player.name}](${player.pidx})【p${player.pidx}:将[${currCard.name}]】进行了调和`, 'info');
        this._doActionAfter(pidx);
        await this.emit(flag, pidx, { isActionInfo: true });
        await this.delay(1100);
        await this._execTask();
        await this._doActionStart(pidx);
        await this._changeTurn(pidx, 'reconcile');
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
        const heroEle = new Set<DiceCostType>(player.heros.filter(h => h.hp > 0)
            .flatMap(h => h.skills.map(s => s.cost[0].type))
            .filter(d => d != SKILL_COST_TYPE.Same));
        const frontEle = player.heros.getFront().element;
        if (costType == COST_TYPE.Same && elDiceCnt > 0) {
            let maxDice: DiceCostType | null = null;
            const weight = (el: DiceCostType, cnt = 0) => {
                return +(el == DICE_COST_TYPE.Omni) * 1000
                    + +(el == frontEle) * 500
                    + +heroEle.has(el) * 400
                    - +(cnt == elDiceCnt) * 300
                    - cnt * 10
                    - DICE_WEIGHT.indexOf(el);
            };
            const omniCnt = player.dice.filter(d => d == DICE_COST_TYPE.Omni).length;
            const diceCnts = objToArr(diceCnt).filter(([el, cnt]) => cnt > 0 && el != DICE_COST_TYPE.Omni).sort((a, b) => weight(...a) - weight(...b));
            const diceOther = diceCnts.find(([el]) => !heroEle.has(el));
            if (diceOther && diceOther[1] + omniCnt >= elDiceCnt) maxDice = diceOther[0];
            else {
                const diceHeroEl = diceCnts.find(([el]) => heroEle.has(el));
                if (diceHeroEl && diceHeroEl[1] + omniCnt >= elDiceCnt) maxDice = diceHeroEl[0];
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
                    + +heroEle.has(el) * 300
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
     * @returns 选择骰子情况的数组
     */
    private _checkSkill(pidx: number, skid: number, isForbidden: boolean = true) {
        const player = this.players[pidx];
        if (isForbidden) return new Array(player.dice.length).fill(false);
        const skill = this._calcSkillChange(pidx, { skid });
        if (!skill) return player.dice.map(() => false);
        let anyDiceCnt = skill.cost[1].cnt - skill.costChange[1];
        let { cnt: elementDiceCnt, type: costType } = skill.cost[0];
        elementDiceCnt -= skill.costChange[0];
        return this._selectDice(player, costType, elementDiceCnt, anyDiceCnt);
    }
    /**
    * 使用技能
    * @param pidx 玩家序号
    * @param skid 技能id/技能类型
    * @param options.withCard 是否为使用卡
    * @param options.socket socket
    * @param options.selectSummon 使用技能时选择的召唤物序号
    * @param options.pickSummon 挑选的召唤物
    * @param options.selectHero 使用技能时选择的角色序号
    * @param options.diceSelect 使用的骰子
    */
    private async _useSkill(pidx: number, skid: number | SkillType, options: {
        withCard?: Card, socket?: Socket, selectSummon?: number, selectHero?: number, diceSelect?: boolean[],
    } = {}) {
        const { withCard, selectSummon = -1, selectHero = -1, socket, diceSelect } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const { heros, dice } = player;
        const { heros: eheros } = opponent;
        const skill = this._calcSkillChange(pidx, { skid });
        if (!skill) throw new Error('ERROR@_useSkill: 技能不存在');
        if (diceSelect) {
            const useDices = dice.filter((_, di) => diceSelect[di]);
            const isValid = checkDices(useDices, { skill });
            this.preview.isValid = isValid;
            if (!isValid && this.preview.isExec) return this.emit('useSkillDiceInvalid', pidx, { socket, tip: '骰子不符合要求', notPreview: true });
        }
        const atkHero = heros.getFront();
        if (!skill || !atkHero) return;
        const selectSummonInvalid = skill.canSelectSummon != -1 && selectSummon == -1;
        const selectHeroInvalid = skill.canSelectHero != -1 && selectHero == -1;
        const nonAction = atkHero.heroStatus.has(STATUS_TYPE.NonAction);
        if (selectSummonInvalid || selectHeroInvalid || nonAction) {
            this.preview.isValid = false;
            if (selectSummonInvalid) return this.emit('useSkillSelectSummonInvalid', pidx, { socket, notPreview: true, tip: '未选择召唤物' });
            if (selectHeroInvalid) return this.emit('useSkillSelectHeroInvalid', pidx, { socket, notPreview: true, tip: '未选择角色' });
            if (nonAction) {
                this._doActionAfter(pidx);
                await this._execTask();
                await this._changeTurn(pidx, 'useSkill');
                await this._execTask();
                return;
            }
        }
        this._doCmds(pidx, CmdsGenerator.ins.consumeDice(diceSelect));
        const skillres = skill.handle({
            pidx,
            ...this.handleEvent,
            skill,
            hcard: withCard,
            swirlEl: eheros.getFront().attachElement?.find(el => Object.values(SWIRL_ELEMENT_TYPE).includes(el as SwirlElementType)),
            trigger: skill.isReadySkill ? 'useReadySkill' : 'skill',
            selectHeros: [selectHero],
            selectSummon,
        });
        const { cmds: skillcmds } = skillres;
        this.preview.isQuickAction = false || !!skillres.isQuickAction;
        const oIsFallAtk = player.isFallAtk;
        player.isFallAtk &&= skill.type == SKILL_TYPE.Normal;
        player.isFallAtk ||= !!skillres.isFallAtk;
        this._writeLog(`[${player.name}](${pidx})[${atkHero.name}]使用了[${SKILL_TYPE_NAME[skill.type]}][${skill.name}]`, 'info');
        skillres.exec?.();
        const isVehicle = skill.type == SKILL_TYPE.Vehicle;
        await this.emit(`useSkill-${skill.name}`, pidx, {
            socket,
            canAction: false,
            slotSelect: isCdt(isVehicle, [pidx, heros.frontHidx, SLOT_CODE.Vehicle]),
            heroSelect: isCdt(!isVehicle && (!skillcmds.hasDamage || skillcmds.filterCmds('attack').every(c => c.isOppo == false)), [pidx, heros.frontHidx]),
            actionInfo: {
                avatar: atkHero.UI.avatar,
                content: skill.name,
                subContent: SKILL_TYPE_NAME[skill.type],
            }
        });
        this._doCmds(pidx, skillcmds, {
            atkname: skill.name,
            dmgSource: 'skill',
            skill,
            source: skill.isHeroSkill ? atkHero.id : skill.id,
            trigger: 'skill',
            multiDmg: skillres.multiDmgCdt,
            notPreview: skillres.notPreview,
            isImmediate: true,
        });
        if (!skillcmds.hasDamage) await this.delay(1e3);
        await this._execTask();
        player.isFallAtk = !skill.isHeroSkill && oIsFallAtk;
        if (!skill.isReadySkill) {
            const convertToAfter = (trgs: Set<Trigger>) => [...trgs].map(t => t.includes('skill') ? 'after-' + t as Trigger : t);
            for (let i = 0; i < heros.length; ++i) {
                const hi = (player.hidx + i) % heros.length;
                const trgs = this.preview.triggers[pidx][hi];
                this._detectHero(pidx, convertToAfter(trgs),
                    { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage], hidxs: +hi, skill, source: atkHero.id, isAfterSkill: true });
                await this._execTask();
            }
            const afterTriggers = (p: number) => convertToAfter(new Set(this.preview.triggers[p].flatMap(t => [...t])));
            this._detectSummon(pidx, afterTriggers(pidx), { skill, source: atkHero.id, isAfterSkill: true });
            await this._execTask();
            this._detectSupport(pidx, afterTriggers(pidx), { skill, source: atkHero.id, isAfterSkill: true });
            await this._execTask();
            this._emitEvent(pidx ^ 1, afterTriggers(pidx ^ 1), { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage], skill, isAfterSkill: true });
            await this._execTask();
        }
        this.preview.triggers.forEach(trgs => trgs.forEach(t => t.clear()));
        this._doCmds(pidx, skillcmds.after, {
            atkname: skill.name,
            dmgSource: 'skill',
            skill,
            source: skill.isHeroSkill ? atkHero.id : skill.id,
            trigger: 'skill',
            notPreview: skillres.notPreview,
        });
        await this._execTask();
        this._doActionAfter(pidx);
        await this._execTask();
        if (!withCard) {
            await this._changeTurn(pidx, 'useSkill');
            await this._execTask();
        }
    }
    /**
     * 计算伤害
     * @param pidx 发起攻击的玩家序号
     * @param dmgElement 伤害的元素附着
     * @param damages 所有角色将要受到的伤害[敌方, 我方]
     * @param dmgedHidx 受击角色索引idx
     * @param options isAttach 是否为自己附着元素, isSummon 召唤物攻击id, isSwirl 是否为扩散伤害, isSwirlExec 扩散伤害是否执行,
     *                atriggers 攻击者触发时机, etriggers 受击者触发时机, skill 技能, atkId 造成伤害来源id/entityId, 
     *                isAtkSelf 是否为对自身攻击, withCard 可能使用的卡, elTips 元素反应提示, dmgElements 本次伤害元素,
     *                isFirstAtk 是否为第一次攻击(用于会同时造成后台伤害的情况导致的重复触发), isImmediate 是否加入立即执行队列
     * @returns willDamages: 所有角色将要受到的伤害[p0, p1][普攻伤害, 穿透伤害], 
     *          willHeals 将治疗量
     *          dmgElements 本次伤害元素,
     *          elTips 元素反应提示 
     *          atriggers 攻击者触发时机
     *          etriggers 受击者触发时机
     */
    private _calcDamage(pidx: number, dmgElement: DamageType, damages: number[][], dmgedHidx: number, options: {
        isAttach?: boolean, isSummon?: number, isSwirl?: boolean, skill?: Skill, isSwirlExec?: boolean,
        atkId?: number, willHeals?: number[], elTips?: [string, PureElementType, PureElementType][],
        dmgElements?: DamageType[], multiDmg?: number, isAtkSelf?: number, withCard?: Card, isImmediate?: boolean,
        atkHidx?: number, atriggers?: Set<Trigger>[], etriggers?: Set<Trigger>[], isFirstAtk?: boolean,
    } = {}) {
        const epidx = pidx ^ 1;
        const { heros: { length: oahlen }, heros: aheros, playerInfo } = this.players[pidx];
        const { heros: { length: oehlen } } = this.players[epidx];
        const { isAttach, isSummon = -1, isSwirl, isAtkSelf = 0, isSwirlExec, atkId, isFirstAtk,
            dmgElements = new Array<DamageType>(oehlen + oahlen).fill(DAMAGE_TYPE.Physical),
            elTips = new Array(oahlen + oehlen).fill(0).map(() => ['', PURE_ELEMENT_TYPE.Cryo, PURE_ELEMENT_TYPE.Cryo]),
            atriggers: atrg = new Array(oahlen).fill(0).map(() => new Set()), etriggers: etrg = new Array(oehlen).fill(0).map(() => new Set()),
            withCard, skill, willHeals = new Array(oahlen + oehlen).fill(-1), isImmediate,
        } = options;
        let { multiDmg = 0, atkHidx } = options;
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
            willHeals,
            dmgElements,
            elTips,
            atriggers: atrg,
            etriggers: etrg,
        });
        const dmgedPidx = epidx ^ +isAtkSelf;
        const atkPidx = dmgedPidx ^ 1;
        const { heros: dmgedheros, heros: { length: ehlen } } = this.players[dmgedPidx];
        const { heros: { length: ahlen }, combatStatus: aCombatStatus, isFallAtk } = this.players[atkPidx];
        const dmgedfhero = dmgedheros[dmgedHidx];
        const getDmgIdxOffset = ehlen * dmgedPidx;
        const aGetDmgIdxOffset = ahlen * pidx;
        const getDmgIdx = dmgedHidx + getDmgIdxOffset;
        if (dmgedfhero.hp <= 0) {
            if (dmgedfhero.hp == 0) res.dmgElements[getDmgIdx] = dmgElement;
            return res;
        }
        atkHidx ??= aheros.frontHidx;
        const atriggers: Set<Trigger>[] = res.atriggers.map(() => new Set());
        const etriggers: Set<Trigger>[] = res.etriggers.map(() => new Set());
        const trgEl: keyof typeof PURE_ELEMENT_TYPE = ELEMENT_TYPE_KEY[dmgElement];
        let swirlDmg: PureElementType | undefined; // 扩散形成的伤害元素
        let isAttachElement: 'attach' | 'consume' | 'null' = 'null';
        if (dmgElement != DAMAGE_TYPE.Pierce && (res.willDamages[getDmgIdx][0] >= 0 || isAttach)) {
            // 是否有元素附着
            const isDmgAttach = dmgElement != DAMAGE_TYPE.Physical && dmgElement != DAMAGE_TYPE.Anemo && dmgElement != DAMAGE_TYPE.Geo;
            res.dmgElements[getDmgIdx] = dmgElement;
            const elTypes: ElementType[] = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro];
            if ( // 没有元素反应(不含冰草共存)
                dmgedfhero.attachElement.length == 0 ||
                (dmgedfhero.attachElement as ElementType[]).includes(dmgElement) ||
                ((dmgElement == DAMAGE_TYPE.Anemo || dmgElement == DAMAGE_TYPE.Geo) && !elTypes.includes(dmgedfhero.attachElement[0]))
            ) {
                if (dmgedfhero.attachElement.length == 0 && isDmgAttach) {
                    isAttachElement = 'attach';
                    this.preview.willAttachs[dmgedPidx][dmgedHidx].push(dmgElement);
                }
            } else if (dmgElement != DAMAGE_TYPE.Physical) {
                let isElDmg = true;
                isAttachElement = 'consume';
                const [attachElement] = dmgedfhero.attachElement;
                const elTipIdx = dmgedPidx * ehlen + dmgedHidx;
                const existElIdx = this.preview.willAttachs[dmgedPidx][dmgedHidx].indexOf(attachElement);
                if (existElIdx > -1) this.preview.willAttachs[dmgedPidx][dmgedHidx].splice(existElIdx, 1);
                this.preview.willAttachs[dmgedPidx][dmgedHidx].push([attachElement, dmgElement]);
                if (dmgElement == ELEMENT_TYPE.Anemo) { // 扩散
                    res.elTips[elTipIdx] = ['扩散', attachElement, dmgElement];
                    atriggers.forEach((trg, tri) => {
                        if (!isAtkSelf) {
                            if (tri == atkHidx) trg.add('Swirl');
                            else trg.add('other-Swirl');
                        }
                        trg.add('Swirl-oppo');
                    });
                    etriggers.forEach((trg, tri) => {
                        if (isAtkSelf) {
                            if (tri == dmgedHidx) trg.add('Swirl');
                            else trg.add('other-Swirl');
                        }
                        if (tri == dmgedHidx) trg.add('get-Swirl')
                    });
                    swirlDmg = attachElement;
                } else if (dmgElement == ELEMENT_TYPE.Geo) { // 结晶
                    if (!isAttach) ++res.willDamages[getDmgIdx][0];
                    res.elTips[elTipIdx] = ['结晶', attachElement, dmgElement];
                    atriggers.forEach((trg, tri) => {
                        if (!isAtkSelf) {
                            if (tri == atkHidx) trg.add('Crystallize');
                            else trg.add('other-Crystallize');
                        }
                        trg.add('Crystallize-oppo');
                    });
                    etriggers.forEach((trg, tri) => {
                        if (isAtkSelf) {
                            if (tri == dmgedHidx) trg.add('Crystallize');
                            else trg.add('other-Crystallize');
                        }
                        if (tri == dmgedHidx) trg.add('get-Crystallize')
                    });
                } else {
                    const attachType = (1 << PURE_ELEMENT_CODE[attachElement]) + (1 << PURE_ELEMENT_CODE[dmgElement]);
                    const hasEls = (el1: PureElementType, el2: PureElementType) =>
                        (attachType >> PURE_ELEMENT_CODE[el1] & 1) == 1 && (attachType >> PURE_ELEMENT_CODE[el2] & 1) == 1;
                    if (hasEls(ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Dendro)) { // 冰草共存
                        isElDmg = false;
                        isAttachElement = 'null';
                        this.preview.willAttachs[dmgedPidx][dmgedHidx].pop();
                        this.preview.willAttachs[dmgedPidx][dmgedHidx].push(attachElement, dmgElement);
                        dmgedfhero.attachElement = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Dendro];
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro)) { // 水火 蒸发
                        res.willDamages[getDmgIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = ['蒸发', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Vaporize');
                                else trg.add('other-Vaporize');
                            }
                            trg.add('Vaporize-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Vaporize');
                                else trg.add('other-Vaporize');
                            }
                            if (tri == dmgedHidx) trg.add('get-Vaporize')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Cryo)) { // 冰火 融化
                        res.willDamages[getDmgIdx][0] += isAttach ? 0 : 2;
                        res.elTips[elTipIdx] = ['融化', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Melt');
                                else trg.add('other-Melt');
                            }
                            trg.add('Melt-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Melt');
                                else trg.add('other-Melt');
                            }
                            if (tri == dmgedHidx) trg.add('get-Melt')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Electro)) { // 水雷 感电
                        if (aheros.some(h => h.id == 1417)) { // 转化为月感电
                            res.elTips[elTipIdx] = ['月感电', attachElement, dmgElement];
                            atriggers.forEach((trg, tri) => {
                                if (!isAtkSelf) {
                                    if (tri == atkHidx) trg.add('LunarElectroCharged');
                                    else trg.add('other-LunarElectroCharged');
                                }
                                trg.add('ElectroCharged-oppo');
                            });
                            etriggers.forEach((trg, tri) => {
                                if (isAtkSelf) {
                                    if (tri == dmgedHidx) trg.add('LunarElectroCharged');
                                    else trg.add('other-LunarElectroCharged');
                                }
                                if (tri == dmgedHidx) trg.add('get-LunarElectroCharged')
                            });
                            const cpidx = dmgedPidx ^ 1;
                            this._updateSummon(cpidx, this._getSummonById(205), { isSummon, destroy: +(isSummon == -1) });
                        } else {
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
                                if (!isAtkSelf) {
                                    if (tri == atkHidx) trg.add('ElectroCharged');
                                    else trg.add('other-ElectroCharged');
                                }
                                trg.add('ElectroCharged-oppo');
                            });
                            etriggers.forEach((trg, tri) => {
                                if (isAtkSelf) {
                                    if (tri == dmgedHidx) trg.add('ElectroCharged');
                                    else trg.add('other-ElectroCharged');
                                }
                                if (tri == dmgedHidx) trg.add('get-ElectroCharged')
                            });
                        }
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
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Superconduct');
                                else trg.add('other-Superconduct');
                            }
                            trg.add('Superconduct-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Superconduct');
                                else trg.add('other-Superconduct');
                            }
                            if (tri == dmgedHidx) trg.add('get-Superconduct')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Cryo)) { // 水冰 冻结
                        res.willDamages[getDmgIdx][0] += +!isAttach;
                        this._updateStatus(dmgedPidx, this._getStatusById(106), dmgedheros[dmgedHidx].heroStatus);
                        res.elTips[elTipIdx] = ['冻结', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Frozen');
                                else trg.add('other-Frozen');
                            }
                            trg.add('Frozen-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Frozen');
                                else trg.add('other-Frozen');
                            }
                            if (tri == dmgedHidx) trg.add('get-Frozen')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Dendro)) { // 水草 绽放
                        ++res.willDamages[getDmgIdx][0];
                        res.elTips[elTipIdx] = ['绽放', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Bloom');
                                else trg.add('other-Bloom');
                            }
                            trg.add('Bloom-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Bloom');
                                else trg.add('other-Bloom');
                            }
                            if (tri == dmgedHidx) trg.add('get-Bloom')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro)) { // 火雷 超载
                        res.willDamages[getDmgIdx][0] += 2;
                        if (dmgedfhero.isFront) {
                            this._doCmds(dmgedPidx, CmdsGenerator.ins.switchAfter(), {
                                source: ELEMENT_REACTION.Overload,
                                isPriority: true,
                                isUnshift: true,
                            });
                        }
                        res.elTips[elTipIdx] = ['超载', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Overload');
                                else trg.add('other-Overload');
                            }
                            trg.add('Overload-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Overload');
                                else trg.add('other-Overload');
                            }
                            if (tri == dmgedHidx) trg.add('get-Overload')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Dendro)) { // 火草 燃烧
                        ++res.willDamages[getDmgIdx][0];
                        const cpidx = dmgedPidx ^ 1;
                        this._updateSummon(cpidx, this._getSummonById(115), { isSummon, destroy: +(isSummon == -1) });
                        res.elTips[elTipIdx] = ['燃烧', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Burning');
                                else trg.add('other-Burning');
                            }
                            trg.add('Burning-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Burning');
                                else trg.add('other-Burning');
                            }
                            if (tri == dmgedHidx) trg.add('get-Burning')
                        });
                    } else if (hasEls(ELEMENT_TYPE.Electro, ELEMENT_TYPE.Dendro)) { // 雷草 原激化
                        ++res.willDamages[getDmgIdx][0];
                        res.elTips[elTipIdx] = ['原激化', attachElement, dmgElement];
                        atriggers.forEach((trg, tri) => {
                            if (!isAtkSelf) {
                                if (tri == atkHidx) trg.add('Quicken');
                                else trg.add('other-Quicken');
                            }
                            trg.add('Quicken-oppo');
                        });
                        etriggers.forEach((trg, tri) => {
                            if (isAtkSelf) {
                                if (tri == dmgedHidx) trg.add('Quicken');
                                else trg.add('other-Quicken');
                            }
                            if (tri == dmgedHidx) trg.add('get-Quicken')
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
                        `other-elReaction-${trgEl}${SwirlOrCrystallize}` as Trigger,
                        `other-elReaction-${PURE_ELEMENT_TYPE_KEY[attachElement]}`,
                    ];
                    atriggers.forEach((trgs, tri) => {
                        if (!isAtkSelf) {
                            if (tri == atkHidx) elReactionTriggers.forEach(t => trgs.add(t));
                            else otherElReactionTriggers.forEach(t => trgs.add(t));
                        }
                        otherElReactionTriggers.map(t => t.replace('other', 'get') + '-oppo' as Trigger).forEach(t => trgs.add(t));
                    });
                    etriggers.forEach((trgs, tri) => {
                        if (isAtkSelf) {
                            if (tri == dmgedHidx) elReactionTriggers.forEach(t => trgs.add(t));
                            else otherElReactionTriggers.forEach(t => trgs.add(t));
                        }
                        if (tri == dmgedHidx) elReactionTriggers.flatMap(t => [`get-${t}`, `${t}-oppo`] as Trigger[]).forEach(t => trgs.add(t));
                        else trgs.add('other-get-elReaction');
                    });
                }
            }
        }
        const assignDmgTrigger = (triggers: Set<Trigger>[], isA: boolean) => {
            const admgIdxOffset = isA ? aGetDmgIdxOffset : getDmgIdxOffset;
            if (!isSwirl && !swirlDmg || isSwirl && isSwirlExec) {
                triggers.forEach((trg, tidx) => {
                    const [elDmg, pierceDmg] = res.willDamages[tidx + admgIdxOffset];
                    const isOtherGetDmg = res.willDamages.slice(admgIdxOffset, admgIdxOffset + ehlen)
                        .some((dmg, didx) => (dmg[0] > -1 || dmg[1] > 0) && didx != tidx);
                    if (isOtherGetDmg) trg.add('other-getdmg');
                    if (elDmg > 0 || pierceDmg > 0) {
                        trg.add('getdmg');
                        if (elDmg > 0) {
                            if (dmgElement != ELEMENT_TYPE.Physical) trg.add('el-getdmg');
                            trg.add(`${trgEl}-getdmg`);
                        }
                        if (pierceDmg > 0) trg.add('Pierce-getdmg');
                    }
                    if (trg.has('getdmg') || trg.has('other-getdmg')) trg.add('all-getdmg');
                });
                const edmgIdxOffset = isA ? getDmgIdxOffset : aGetDmgIdxOffset;
                const wdmgs = res.willDamages.slice(edmgIdxOffset, edmgIdxOffset + ehlen);
                if (wdmgs.some(dmg => dmg[0] > -1 || dmg[1] > 0)) {
                    triggers.forEach((trgs, ti) => {
                        if (!isAtkSelf && isA && isFirstAtk && dmgElement != DAMAGE_TYPE.Pierce) {
                            if (ti == atkHidx) {
                                trgs.add('dmg');
                                if (skill?.isHeroSkill) trgs.add('skill-dmg');
                            } else trgs.add('other-dmg');
                        }
                        trgs.add('getdmg-oppo');
                        if (dmgElement != DAMAGE_TYPE.Physical) {
                            if (ti == atkHidx && !isAtkSelf) trgs.add('el-dmg');
                            trgs.add('el-getdmg-oppo');
                        }
                    });
                    if (wdmgs.some(dmg => dmg[0] > -1)) {
                        triggers.forEach((trgs, ti) => {
                            if (!isAtkSelf && isA) {
                                if (ti == atkHidx) trgs.add(`${trgEl}-dmg`);
                                else trgs.add(`other-${trgEl}-dmg`);
                            }
                            trgs.add(`${trgEl}-getdmg-oppo`);
                        });
                    }
                    if (wdmgs.some(dmg => dmg[1] > 0)) {
                        triggers.forEach((trgs, ti) => {
                            if (!isAtkSelf && isA) {
                                if (ti == atkHidx) trgs.add('Pierce-dmg');
                                else trgs.add('other-Pierce-dmg');
                            }
                            trgs.add('Pierce-getdmg-oppo');
                        });
                    }
                }
            }
        }
        const assignDmgTriggerAll = () => {
            assignDmgTrigger(etriggers, false);
            assignDmgTrigger(atriggers, true);
            etriggers.forEach((trgs, ti) => trgs.forEach(t => res.etriggers[ti].add(t)));
            if (!isSwirl) atriggers.forEach((trgs, ti) => trgs.forEach(t => res.atriggers[ti].add(t)));
        }
        assignDmgTriggerAll();
        const getdmg = () => res.willDamages
            .slice(getDmgIdxOffset, getDmgIdxOffset + ehlen)
            .map(([dmg, pdmg]) => dmg == -1 && pdmg == 0 ? -1 : Math.max(0, dmg) + pdmg);
        const agetdmg = () => res.willDamages
            .slice(aGetDmgIdxOffset, aGetDmgIdxOffset + ahlen)
            .map(([dmg, pdmg]) => dmg == -1 && pdmg == 0 ? -1 : Math.max(0, dmg) + pdmg);
        const hasDmg = res.willDamages[getDmgIdx][0] > -1;

        if (isSwirl) {
            atriggers[atkHidx].add(`${trgEl}-dmg-Swirl` as Trigger).add('dmg-Swirl');
            etriggers[dmgedHidx].add(`${trgEl}-getdmg-Swirl` as Trigger);
        } else if (!isAtkSelf && isFirstAtk && skill) {
            if (skill.isReadySkill) atriggers[atkHidx].add('useReadySkill');
            const sktrg = skill.type == SKILL_TYPE.Vehicle ? 'vehicle' : 'skill';
            atriggers.forEach((trg, ti) => {
                const isOther = ti != atkHidx ? 'other-' : '';
                if (skill.type != SKILL_TYPE.Passive) trg.add(`${isOther}${sktrg}`);
                trg.add(`${isOther}skilltype${skill.type}`);
            });
            etriggers.forEach(trgs => trgs.add(`${sktrg}-oppo`));
            if (isFallAtk) atriggers.forEach((trg, ti) => trg.add(ti == atkHidx ? 'fallatk' : 'other-fallatk'));
        }

        const source = isSummon > -1 ? isSummon : atkId; // 角色/状态/召唤物id
        for (let i = 0; i < ahlen; ++i) {
            const chi = (atkHidx + i) % ahlen;
            const trgs = atriggers[isSummon > -1 ? atkHidx : chi];
            const hfieldres = this._detectHero(atkPidx, trgs, {
                hidxs: chi,
                types: [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.MultiDamage, STATUS_TYPE.Attack],
                getdmg: agetdmg(),
                dmg: getdmg(),
                skill,
                isSummon,
                dmgedHidx,
                dmgElement,
                source,
                hasDmg,
                hcard: withCard,
                isSwirlExec,
                isImmediate,
            });
            res.willDamages[getDmgIdx][0] += hfieldres.addDmg;
            multiDmg += hfieldres.multiDmg;
            hfieldres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                if (pIsSelf) (phidxs ?? aheros.getBackHidxs()).forEach(hi => res.willDamages[hi + aGetDmgIdxOffset][1] += pdmg);
                else (phidxs ?? dmgedheros.getBackHidxs()).forEach(hi => res.willDamages[hi + getDmgIdxOffset][1] += pdmg);
            });
            dmgedheros.forEach((_, hi) => res.willDamages[hi + getDmgIdxOffset][1] > 0 && (res.willDamages[hi + getDmgIdxOffset][1] += hfieldres.addPdmg))
            hfieldres.heals.forEach((hl, hli) => {
                if (hl == -1) return;
                res.willHeals[hli + aGetDmgIdxOffset] = Math.max(0, res.willHeals[hli + aGetDmgIdxOffset]) + hl;
            });
        }

        const asmnres = this._detectSummon(atkPidx, atriggers[atkHidx], { skill, isSummon, dmgElement, source: source });
        res.willDamages[getDmgIdx][0] += asmnres.addDmg;

        this._detectSupport(atkPidx, atriggers[atkHidx], { skill, getdmg: getdmg(), dmgElement, source: source });

        for (let i = 0; i < ehlen; ++i) {
            const chi = (dmgedHidx + i) % ehlen;
            const trgs = etriggers[chi];
            const hfieldres = this._detectHero(dmgedPidx, trgs, {
                hidxs: chi,
                types: [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Attack],
                getdmg: getdmg(),
                skill,
                isSummon,
                dmgedHidx,
                source,
                dmgElement,
                hasDmg,
                hcard: withCard,
                isSwirlExec,
            });
            res.willDamages[getDmgIdx][0] += hfieldres.getDmg;
            hfieldres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                if (!pIsSelf) {
                    (phidxs ?? aheros.getBackHidxs()).forEach(hi => {
                        res.willDamages[hi + aGetDmgIdxOffset][1] += pdmg;
                    });
                } else {
                    (phidxs ?? dmgedheros.getBackHidxs()).forEach(hi => {
                        res.willDamages[hi + getDmgIdxOffset][1] += pdmg;
                    });
                }
            });
        }

        this._detectSummon(dmgedPidx, new Set(etriggers.flatMap(t => [...t])), {
            skill,
            dmgedHidx,
            dmgElement,
            getdmg: getdmg(),
            source: source,
        });
        this._detectSupport(dmgedPidx, new Set(etriggers.flatMap(t => [...t])), {
            getdmg: getdmg(),
            skill,
            dmgElement,
            source: source,
        });

        if (isAttachElement == 'attach') dmgedfhero.attachElement.push(dmgElement as PureElementType);
        else if (isAttachElement == 'consume') dmgedfhero.attachElement.shift();
        const immueSts = dmgedheros[dmgedHidx].heroStatus.get(STATUS_TYPE.ImmuneDamage);
        if (immueSts && dmgedfhero.attachElement.length == 0) {
            const el = getElByHid(getHidById(immueSts.id)) as PureElementType;
            this._doCmds(pidx, CmdsGenerator.ins.attach({ element: el, hidxs: dmgedHidx }));
        }

        if (res.atriggers[atkHidx].has('el-getdmg-oppo')) {
            let elcnt = playerInfo.oppoGetElDmgType;
            for (const trg of res.atriggers[atkHidx]) {
                if (trg == 'el-getdmg-oppo' || !trg.endsWith('-getdmg-oppo')) continue;
                const [el] = objToArr(PURE_ELEMENT_TYPE_KEY).find(([, elname]) => elname == trg.slice(0, trg.indexOf('-getdmg-oppo'))) ?? [];
                if (el == undefined || (elcnt >> PURE_ELEMENT_CODE[el] & 1) == 1) continue;
                elcnt |= (1 << PURE_ELEMENT_CODE[el]);
            }
            playerInfo.oppoGetElDmgType = elcnt;
        }
        if (dmgElement != DAMAGE_TYPE.Pierce && res.willDamages[getDmgIdx][0] > 0) {
            let restDmg = res.willDamages[getDmgIdx][0];
            if (!isSwirl) restDmg *= multiDmg || 1;
            const { restDmg: hrestDmg, pdmgs: hpdmgs } = this._detectHero(dmgedPidx, 'reduce-dmg', {
                hidxs: dmgedHidx,
                types: [STATUS_TYPE.Shield, STATUS_TYPE.Barrier, STATUS_TYPE.ImmuneDamage],
                restDmg,
                dmgElement,
                source,
                isSummon,
                isSwirlExec,
            });
            restDmg = hrestDmg;
            hpdmgs.forEach(([pdmg, phidxs]) => {
                (phidxs ?? dmgedheros.getBackHidxs()).forEach(hi => {
                    res.willDamages[hi + getDmgIdxOffset][1] += pdmg;
                });
            });
            res.willDamages[getDmgIdx][0] = restDmg;
        }
        if (!isAtkSelf) {
            for (let i = 0; i < ahlen; ++i) {
                const chi = (atkHidx + i) % ahlen;
                const trgs = atriggers[isSummon > -1 ? atkHidx : chi];
                if (!trgs.has('dmg') && !trgs.has('other-dmg')) continue;
                const hfieldres = this._detectHero(atkPidx, 'after-dmg', {
                    types: [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage],
                    hidxs: chi,
                    skill,
                    isSummon,
                    dmgedHidx,
                    source,
                    dmgElement,
                    hasDmg,
                    hcard: withCard,
                    dmg: getdmg(),
                    isSwirlExec,
                });
                res.willDamages[getDmgIdx][0] += hfieldres.addDmg;
                hfieldres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                    if (pIsSelf) (phidxs ?? aheros.getBackHidxs()).forEach(hi => res.willDamages[hi + aGetDmgIdxOffset][1] += pdmg);
                    else (phidxs ?? dmgedheros.getBackHidxs()).forEach(hi => res.willDamages[hi + getDmgIdxOffset][1] += pdmg);
                });
            }
            if (atriggers[atkHidx].has('dmg')) {
                this._detectSupport(pidx, 'after-dmg', {
                    skill,
                    getdmg: getdmg(),
                    dmgElement,
                    source: source,
                });
            }
            for (let i = 0; i < ehlen; ++i) {
                const chi = (dmgedHidx + i) % ehlen;
                const trgs = etriggers[chi];
                if (!trgs.has('getdmg')) continue;
                this._detectHero(dmgedPidx, 'after-getdmg', {
                    types: STATUS_TYPE.Usage,
                    hidxs: chi,
                    getdmg: getdmg(),
                    skill,
                    isSummon,
                    dmgedHidx,
                    source,
                    dmgElement,
                    hasDmg,
                    hcard: withCard,
                    isSwirlExec,
                });
            }
        }

        assignDmgTriggerAll();

        if (atriggers[atkHidx].has('Crystallize-oppo')) this._updateStatus(atkPidx, this._getStatusById(111), aCombatStatus);
        if (atriggers[atkHidx].has('Bloom-oppo')) this._updateStatus(atkPidx, this._getStatusById(116), aCombatStatus);
        if (atriggers[atkHidx].has('Quicken-oppo')) this._updateStatus(atkPidx, this._getStatusById(117), aCombatStatus);
        if (swirlDmg != undefined) {
            const otheridx = dmgedheros.allHidxs({ startHidx: dmgedHidx, exclude: dmgedHidx });
            otheridx.forEach((i, idx) => {
                if (res.willDamages[i + getDmgIdxOffset][0] < 0) res.willDamages[i + getDmgIdxOffset][0] = 0;
                ++res.willDamages[i + getDmgIdxOffset][0];
                assign(res, this._calcDamage(pidx, swirlDmg, res.willDamages, i, {
                    ...options, isSwirl: true, isSwirlExec: idx == otheridx.length - 1, atriggers: res.atriggers,
                    etriggers: res.etriggers, dmgElements: res.dmgElements, elTips: res.elTips, willHeals: res.willHeals,
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
    private _checkCard(pidx: number, cardIdx: number, options: { isReconcile?: boolean, heroIdx?: number, summonIdx?: number } = {}) {
        const { isReconcile, heroIdx, summonIdx } = options;
        const player = this.players[pidx];
        const { dice, heros, hidx, summons, playerInfo: { isUsedLegend }, handCards } = player;
        const currCard = handCards[cardIdx];
        if (!currCard) throw new Error(`ERROR@_checkCard:p${pidx}的卡牌${cardIdx}不存在,手牌:${handCards.map(c => `[${c.name}]`)}`);
        const { cost, canSelectHero, type, userType, energy, costType: rawCostType, anydice, costChange, costChanges } = currCard;
        const { cardDiceType } = currCard.variables;
        const costType = cardDiceType != undefined ? DICE_TYPE_CODE_KEY[cardDiceType] : rawCostType;
        const ncost = Math.max(0, cost + anydice - costChange);
        const cardres = currCard.handle(currCard, {
            pidx,
            ...this.handleEvent,
            hero: heros[heroIdx ?? hidx],
            slotUse: type == CARD_TYPE.Equipment,
            selectHeros: isCdt(heroIdx != undefined, [heroIdx!]),
            selectSummon: summonIdx,
        });
        const res: {
            isValid: boolean,
            diceSelect: boolean[],
            skillId?: number,
            switchIdx?: number,
            attackPreview?: Preview,
            heroCanSelect?: boolean[],
        } = {
            isValid: false,
            diceSelect: new Array(MAX_DICE_COUNT).fill(false),
        };
        const cardSummonsId = this._getSummonById(cardres.summon).map(s => s.id);
        if (!isReconcile &&
            (cardres.hidxs?.length == 0 ||
                cardSummonsId.length > 0 && (summons.length == MAX_SUMMON_COUNT && summons.every(s => !cardSummonsId.includes(s.id))) ||
                cardres.isValid == false ||
                currCard.hasSubtype(CARD_SUBTYPE.Legend) && isUsedLegend ||
                Math.abs(heros[hidx].energy) < Math.abs(energy)) ||
            isReconcile && (currCard.hasTag(CARD_TAG.NonReconcile) || currCard.hasAttachment(207) ||
                dice.every(d => d == DICE_COST_TYPE.Omni || d == heros.getFront().element))
        ) {
            return res;
        }
        res.heroCanSelect = heros.map((hero, i) => {
            const canSelectHeros = cardres.canSelectHero?.[i] ?? (hero.hp > 0);
            return canSelectHero > 0 && canSelectHeros && (
                type == CARD_TYPE.Support ||
                type == CARD_TYPE.Event && !currCard.hasSubtype(CARD_SUBTYPE.Food, CARD_SUBTYPE.Talent) && (userType == 0 || userType == hero.id) ||
                currCard.hasSubtype(CARD_SUBTYPE.Weapon) && userType == hero.weaponType ||
                currCard.hasSubtype(CARD_SUBTYPE.Relic) ||
                currCard.hasSubtype(CARD_SUBTYPE.Food) && !hero.heroStatus.has(303300) ||
                currCard.hasSubtype(CARD_SUBTYPE.Talent) && userType == hero.id && (hero.isFront || !currCard.hasSubtype(CARD_SUBTYPE.Action) || currCard.type == CARD_TYPE.Event) ||
                currCard.hasSubtype(CARD_SUBTYPE.Vehicle) && (userType == 0 || userType == hero.id)
            );
        });
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
                }, {} as Record<DiceCostType, number>)))) >= cost - costChanges[0];
            res.isValid = isLen && isElDice;
            if (res.isValid) {
                res.diceSelect = this._selectDice(
                    player,
                    costType,
                    Math.max(0, cost - costChanges[0] - costChanges[2]),
                    Math.max(0, anydice - costChanges[1] - Math.max(0, costChanges[0] + costChanges[2] - cost))
                );
            }
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
     * @param options.pickCard 是否为挑选后打出
     */
    private async _useCard(pidx: number, cardIdx: number, diceSelect: boolean[], options: {
        socket?: Socket, selectHeros?: number[], selectSummon?: number, selectSupport?: number, getCard?: Card, pickCard?: Card,
    } = {}) {
        const { socket, selectHeros = [], selectSummon = -1, selectSupport = -1, getCard, pickCard } = options;
        const player = this.players[pidx];
        const currCard = getCard ?? pickCard ?? player.handCards[cardIdx];
        if (!getCard && !pickCard) {
            if (this.id > 0 && this.preview.isExec) {
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
            }
            this._writeLog(`[${player.name}](${player.pidx})打出卡牌[${currCard.name}]【(${currCard.entityId})】`, 'info');
            this._doCmds(pidx, CmdsGenerator.ins.consumeDice(diceSelect));
        }
        const hidxs = currCard.canSelectSummon != -1 ? [selectSummon] :
            currCard.canSelectSupport != -1 ? [selectSupport] :
                currCard.canSelectHero == 0 ? [player.hidx] : selectHeros;
        assign(player.handCards, player.handCards.filter((_, ci) => ci != cardIdx));
        const destroyedSupports = clone(player.supports);
        const cardres = currCard.handle(currCard, {
            pidx,
            ...this.handleEvent,
            hero: player.heros[selectHeros[0] ?? player.hidx],
            selectHeros,
            selectSummon,
            selectSupport,
            slotUse: currCard.type == CARD_TYPE.Equipment,
        });
        if (getCard && this._hasNotTriggered(cardres.triggers, 'getcard')) return;
        if (cardres.notPreview && !this.preview.isExec) return;
        const isAction = currCard.hasSubtype(CARD_SUBTYPE.Action);
        const cardcmds = getCard ? cardres.execmds : cardres.cmds;
        if (getCard && !cardcmds?.hasCmds('convertCard')) {
            cardcmds?.discard({ card: currCard.entityId, notTrigger: true, mode: CMD_MODE.IsPublic });
        }
        this._doEquip(pidx, player.heros[hidxs[0]], currCard, { isDestroy: cardres.isDestroy });
        let isInvalid = false;
        if (!getCard && !pickCard) {
            player.playerInfo.isUsedCardPerRound = true;
            if (currCard.hasSubtype(CARD_SUBTYPE.Legend)) player.playerInfo.isUsedLegend = true;
            if (currCard.hasSubtype(CARD_SUBTYPE.Vehicle)) ++player.playerInfo.usedVehcileCnt;
            const { isInvalid: invalid } = this._emitEvent(pidx, 'card',
                { types: [STATUS_TYPE.NonEvent, STATUS_TYPE.Attack, STATUS_TYPE.Usage], hcard: currCard });
            isInvalid ||= invalid;
            this._emitEvent(pidx ^ 1, 'ecard', { types: STATUS_TYPE.Usage, hcard: currCard });
            player.playerInfo.usedCardIds.push(currCard.id);
        }
        if (isInvalid) {
            await this.emit(`useCard-${currCard.name}-invalid`, pidx, { actionInfo: { card: currCard }, isQuickAction: true });
            this._doActionAfter(pidx);
            this._startTimer();
            await this._execTask();
            await this._doActionStart(pidx);
            this._startTimer();
        } else {
            if (currCard.type != CARD_TYPE.Equipment) cardres.exec?.();
            if (!getCard) await this.emit(`${pickCard ? 'pickCard' : 'useCard'}-${currCard.name}`, pidx, { actionInfo: { card: currCard } });
            if (!getCard && !pickCard) {
                assign(destroyedSupports, destroyedSupports.filter(s => player.supports.every(ps => ps.entityId != s.entityId)));
                if (cardres.support) {
                    if (player.supports.isFull) {
                        if (selectSupport > -1) {
                            const [destroyedSupport] = player.supports.splice(selectSupport, 1);
                            destroyedSupports.push(destroyedSupport);
                        } else if (currCard.type == CARD_TYPE.Support) {
                            throw new Error('ERROR@_useCard: selectSupport is invalid');
                        }
                    }
                }
                destroyedSupports.forEach(spt => this._doSupportDestroy(pidx, spt))
            }
            if (cardres.hidxs && currCard.type != CARD_TYPE.Equipment) assign(hidxs, cardres.hidxs);
            this._doCmds(pidx, cardcmds, {
                withCard: isCdt(!getCard, currCard),
                hidxs: isCdt(currCard.canSelectHero > 0, hidxs),
                source: currCard.id,
                atkname: currCard.name,
                dmgSource: 'card',
                isImmediate: true,
                actionInfo: isCdt(!getCard && !pickCard, { card: currCard }),
                trigger: 'card',
                isUnshift: true,
            });
            if (isAction) player.canAction = false;
            await this._execTask(isCdt(pickCard, 'pickCard'));
            if (!getCard && !pickCard) {
                this.preview.isQuickAction = !isAction;
                this._doActionAfter(pidx);
            }
            this._startTimer();
            await this._execTask(isCdt(pickCard, 'pickCard'));
            if (!getCard && !pickCard) {
                await this._changeTurn(pidx, 'useCard');
            }
        }
    }
    /**
     * 挑选卡牌
     * @param pidx 玩家序号
     * @param selectIdx 选择卡牌的序号
     */
    private async _pickCard(pidx: number, selectIdx: number) {
        this._writeLog(`【p:${pidx}:[${this.players[pidx].name}](${pidx})挑选了[${this.pickModal.cards[selectIdx].name}]】`);
        const { cardType, phase = PHASE.ACTION, hidxs } = this.pickModal;
        this.players[pidx].phase = phase;
        const selectId = this.pickModal.cards[selectIdx].id;
        const cmds = new CmdsGenerator();
        switch (cardType) {
            case 'getCard':
                cmds.getCard(1, { card: selectId });
                break;
            case 'getSummon':
                cmds.getSummon(selectId);
                break;
            case 'useCard':
                await this._useCard(pidx, -1, [], { pickCard: this.newCard(selectId), selectHeros: hidxs });
                break;
            default:
                const e: never = cardType;
                throw new Error(`ERROR@_pickCard: unknown cardType: ${e}`);
        }
        this._doCmds(pidx, cmds, { isPriority: true, isUnshift: true });
        await this._execTask('pickCard');
        this._detectHero(pidx, 'pick');
        this._detectSupport(pidx, 'pick');
        this.pickModal.cards = [];
        await this._execTask();
    }
    /**
     * 转换回合
     * @param pidx 玩家序号
     * @param type 发动转换回合的来源
     * @param options.isDieSwitch 是否为被击倒后重新选择角色
     */
    private async _changeTurn(pidx: number, type: string, options: { isDieSwitch?: boolean } = {}) {
        const isEnd = this.players.some(p => p.heros.every(h => h.hp <= 0)) && this.taskQueue.isTaskEmpty();
        if (isEnd || !this.preview.isExec) return;
        const isDie = this.hasDieSwitch;
        if (!isDie) await this.wait(() => this.needWait, { maxtime: 2e5 });
        const { isDieSwitch = false } = options;
        const isOppoActionEnd = this.players[pidx ^ 1]?.phase >= PHASE.ACTION_END;
        this.players[pidx].canAction = false;
        const isChange = () => !this.preview.isQuickAction && !isDie &&
            (isDieSwitch ? this.players[pidx].phase < PHASE.ACTION_END : !isOppoActionEnd);
        if (isChange()) this._detectHero(pidx ^ +isDieSwitch, 'change-turn', { types: STATUS_TYPE.Usage });
        if (isChange()) {
            this.players[this.currentPlayerIdx].canAction = false;
            this.players[this.currentPlayerIdx].status = PLAYER_STATUS.WAITING;
            ++this.currentPlayerIdx;
            this.players[this.currentPlayerIdx].status = PLAYER_STATUS.PLAYING;
            if (type != 'endPhase') {
                this.players.forEach(p => {
                    p.UI.info = (p.pidx == this.currentPlayerIdx ? '我方' : '对方') + '行动中....';
                });
            }
        }
        const tip = isCdt(!this.preview.isQuickAction && !isDie && this.taskQueue.isTaskEmpty(), isChange() ? '{p}开始行动' : '{p}继续行动');
        this._startTimer();
        await this.emit(`changeTurn-${type}-isChange:${isChange()}`, pidx, { tip, isChange: isChange() });
        await this.delay(1e3);
        const currPlayer = this.players[this.currentPlayerIdx];
        const hasReadyskill = !currPlayer.heros[currPlayer.hidx].heroStatus.has(STATUS_TYPE.NonAction) &&
            currPlayer.heros[currPlayer.hidx].heroStatus.has(STATUS_TYPE.ReadySkill);
        if (!isDie) await this._doActionStart(this.currentPlayerIdx);
        if (!hasReadyskill) {
            currPlayer.canAction = !isDie;
            await this.emit(`changeTurn-${type}-setP${this.currentPlayerIdx}CanAction:${!isDie}`, pidx, { isChange: isChange() });
        }
    }
    /**
     * 玩家选择行动前
     * @param pidx 玩家序号
     */
    private async _doActionStart(pidx: number) {
        if (!this.preview.isExec) return;
        this.preview.isQuickAction = true;
        this._detectHero(pidx, 'action-start', { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage] });
        await this._execTask();
        this._detectSummon(pidx, 'action-start');
        await this._execTask();
        this._detectSupport(pidx, 'action-start');
        await this._execTask();
        this._detectHandcards(pidx, 'action-start');
        await this._execTask();
        this._detectPilecards(pidx, 'action-start');
        await this._execTask();
        this._detectHero(pidx ^ 1, 'action-start-oppo', { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage] });
        await this._execTask();
        const player = this.players[pidx];
        player.isChargedAtk = player.dice.length % 2 == 0;
        this.players[pidx ^ 1].isChargedAtk = this.players[pidx ^ 1].dice.length % 2 == 0;
        if (!player.heros[player.hidx].heroStatus.has(STATUS_TYPE.NonAction)) {
            this._detectHero(pidx, 'useReadySkill', { types: STATUS_TYPE.ReadySkill });
            await this._execTask();
        }
    }
    /**
     * 玩家执行任意行动后
     * @param pidx 玩家序号
     */
    private _doActionAfter(pidx: number) {
        if (!this.preview.isExec) return;
        this._detectHero(pidx, 'action-after', { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage] });
        this._detectSupport(pidx, 'action-after');
        this._detectHero(pidx ^ 1, 'action-after-oppo', { types: STATUS_TYPE.Usage });
        this._detectSupport(pidx ^ 1, 'action-after-oppo');
    }
    /**
     * 每回合开始的重置
     */
    private _doReset() {
        this.players.forEach(player => {
            player.playerInfo.discardCnt = 0;
            player.playerInfo.reconcileCnt = 0;
            const handleEvent = { pidx: player.pidx, ...this.handleEvent };
            player.heros.forEach(h => { // 重置技能
                h.vehicleSlot?.[1].handle({ ...handleEvent, trigger: 'reset', hero: h, skill: h.vehicleSlot[1] });
                h.skills.filter(s => !s.isPassive).forEach(skill => skill.handle({ ...handleEvent, trigger: 'reset', skill, hero: h }));
            });
            this._emitEvent(player.pidx, 'reset');
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
        await this.emit(flag + '-init', pidx, { tip: `第${this.round}回合开始` });
        this._writeLog(`第${this.round}回合开始`);
        await this.delay(1250);
        for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
            if (this.round == 1) { // 检测游戏开始 game-start
                this._detectHero(cpidx, 'game-start');
                await this._execTask();
                this._detectHero(cpidx, 'switch-to', { hidxs: this.players[cpidx].hidx });
                await this._execTask();
            }
            this.players[cpidx].isFallAtk = this.round == 1;
            // 检测回合开始阶段 phase-start
            this.preview.isQuickAction = true;
            this._detectHero(cpidx, 'phase-start', {
                hidxs: this.players[cpidx].heros.allHidxs({ startHidx: 0 }),
                types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage],
            });
            this._detectSummon(cpidx, 'phase-start');
            this._detectSupport(cpidx, 'phase-start', { firstPlayer: this.startIdx });
            this._detectHandcards(cpidx, 'phase-start');
        }
        await this._execTask();
        await this.wait(() => this.players.every(p => p.phase == PHASE.ACTION_START) && this.needWait, { maxtime: 6e6 });
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
        await this.emit(flag, pidx, { tip: '{p}行动开始' });
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
                this._detectHero(cpidx, 'phase-end', { types: [STATUS_TYPE.Attack, STATUS_TYPE.Round, STATUS_TYPE.Accumulate] });
                this._detectSummon(cpidx, 'phase-end');
                this._detectSupport(cpidx, 'phase-end');
                this._detectHandcards(cpidx, 'phase-end');
                this._detectPilecards(cpidx, 'phase-end');
            }
            await this._execTask();
            await this.wait(() => this.needWait, { maxtime: 6e6 });
            if (this.winner != -1) return;
            // 回合结束摸牌
            const getCardCmds: Cmds[] = [{ cmd: 'getCard', cnt: 2 }];
            this._doCmds(this.startIdx, getCardCmds);
            await this._execTask();
            this._doCmds(this.startIdx ^ 1, getCardCmds);
            await this._execTask();
            await this.emit(flag + '--getCard', pidx);
            await this.wait(() => this.needWait, { freq: 100, delay: 600 });
            this.currentPlayerIdx = this.startIdx;
            this.phase = PHASE.DICE;
            ++this.round;
            if (this.round == MAX_GAME_ROUND) return this._gameEnd(-2);
            for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
                this._detectHero(cpidx, 'turn-end', {
                    types: [STATUS_TYPE.Attack, STATUS_TYPE.Round, STATUS_TYPE.Accumulate],
                    hidxs: this.players[cpidx].heros.allHidxs({ isAll: true }),
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
            await this.emit(flag, pidx, { tip: '骰子投掷阶段' });
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
        this._detectHero(pidx, ['end-phase', 'any-end-phase'], { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage] });
        await this._execTask();
        this._detectSummon(pidx, 'end-phase');
        await this._execTask();
        this._detectSupport(pidx, 'end-phase');
        await this._execTask();
        this._detectHero(pidx ^ 1, 'any-end-phase', { types: STATUS_TYPE.Usage });
        await this._execTask();
        this._doActionAfter(pidx);
        await this._execTask();
        if (this.players[pidx ^ 1].phase != PHASE.ACTION_END) {
            this.startIdx = pidx;
        }
        await this.wait(() => this.needWait);
        const isActionEnd = this.players.every(p => p.phase == PHASE.ACTION_END);
        this._writeLog(`[${player.name}](${player.pidx})结束了回合`);
        await this.emit(flag, pidx, { tip: `{p}结束了回合` });
        await this.delay(1500);
        if (!isActionEnd) await this._changeTurn(pidx, 'endPhase');
        else await this.emit(flag, pidx, { tip: '回合结束阶段' });
        this.players.forEach(p => {
            if (isActionEnd) p.UI.info = '结束阶段...';
            else if (p.pidx == this.currentPlayerIdx) p.UI.info = '对方已结束回合...';
            else p.UI.info = '对方行动中....';
        });
        this.players[this.currentPlayerIdx].canAction = true;
        if (isActionEnd) { // 双方都结束回合，进入回合结束阶段
            this.phase = PHASE.ACTION_END;
            this._writeLog(`第${this.round}回合结束`);
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
    private _doSlotDestroy(pidx: number, hidx: number, slot: Card) {
        // 被弃置的装备触发
        this._detectHero(pidx, 'slot-destroy', { hidxs: hidx, cSlot: slot });
        // 其他因被弃置的装备触发
        this._detectHero(pidx, 'slot-destroy', {
            hcard: slot,
            source: slot.id,
            sourceHidx: hidx,
            types: [STATUS_TYPE.ReadySkill, STATUS_TYPE.Usage],
        });
        if (slot.hasTag(CARD_TAG.Enchant)) {
            for (const skill of this.players[pidx].heros[hidx].skills.filter(s => !s.isPassive)) {
                if (skill.dmgElement != DAMAGE_TYPE.Physical) continue;
                skill.UI.description = skill.UI.description.replace(ELEMENT_NAME[skill.attachElement], ELEMENT_NAME[DAMAGE_TYPE.Physical]);
                skill.attachElement = DAMAGE_TYPE.Physical;
            }
        }
        const hero = this.players[pidx].heros[hidx];
        if (hero.talentSlot?.entityId == slot.entityId) hero.talentSlot = null;
        if (hero.vehicleSlot?.[0].entityId == slot.entityId) hero.vehicleSlot = null;
    }
    /**
     * 状态被移除时发动
     * @param pidx
     * @param cStatus 被移除的状态
     * @param hidx 被移除状态的角色索引
     */
    private _doStatusDestroy(pidx: number, cStatus: Status, hidx: number) {
        const player = this.players[pidx];
        const heros = player.heros;
        this._writeLog(`[${player.name}](${player.pidx})弃置${cStatus.group == STATUS_GROUP.heroStatus ? `[${heros[hidx].name}]角色` : '出战'}状态[${cStatus.name}](${cStatus.entityId})`, 'system');
        // cStatus.entityId = STATUS_DESTROY_ID;
        // 被移除的状态触发
        this._detectHero(pidx, 'destroy', { types: [STATUS_TYPE.Attack, STATUS_TYPE.Usage], cStatus, hidxs: hidx });
        // 其他因被移除状态触发
        this._detectHero(pidx, 'status-destroy', { types: [STATUS_TYPE.Usage, STATUS_TYPE.Attack], source: cStatus.id, sourceHidx: hidx });
    }
    /**
     * 召唤物消失时发动
     * @param pidx 玩家序号
     */
    private _doSummonDestroy(pidx: number, summon: Summon) {
        ++this.players[pidx].playerInfo.destroyedSummon;
        this._writeLog(`[${this.players[pidx].name}](${pidx})弃置召唤物[${summon.name}](${summon.entityId})`, 'system');
        // 弃置的召唤物触发
        this._detectSummon(pidx, 'destroy', { cSummon: summon });
        // 其他因弃置召唤物触发
        this._detectHero(pidx, 'summon-destroy', { source: summon.id })
        this._detectSupport(pidx, 'summon-destroy', { source: summon.id });
        this._detectSupport(pidx ^ 1, 'summon-destroy', { source: summon.id });
    }
    /**
     * 支援物消失时发动
     * @param pidx 玩家序号
     * @param isExec 是否执行
     */
    private _doSupportDestroy(pidx: number, support: Support) {
        this.players[pidx].playerInfo.destroyedSupport++;
        this._writeLog(`[${this.players[pidx].name}](${pidx})弃置支援物${support.name}(${support.entityId})`, 'system');
        // 弃置的支援物触发
        this._detectSupport(pidx, 'destroy', { cSupport: support });
        // 其他因弃置支援物触发
        this._detectSupport(pidx, 'support-destroy', { source: support.id });
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
     * @param options.trigger 触发时机
     */
    private async _doDamage(pidx: number, damageVO: DamageVO, options: {
        slotSelect?: number[], summonSelect?: number[], canAction?: boolean, skill?: Skill,
        atkname?: string, supportSelect?: number[], heroSelect?: number[], trigger?: Trigger,
        isActionInfo?: boolean, actionInfo?: ActionInfo, statusSelect?: number[],
    } = {}) {
        const isDie = new Set<number>();
        const heroDie: number[][] = this.players.map(() => []);
        const { slotSelect, summonSelect, supportSelect, heroSelect, canAction = true,
            atkname = '', skill, isActionInfo, actionInfo, statusSelect, trigger,
        } = options;
        const { atkPidx, atkHidx, dmgElements, willDamages, willHeals, elTips } = damageVO;
        if (willDamages.every(([d, p]) => d == -1 && p == 0) && willHeals.every(h => h == -1)) return;
        const logPrefix = `[${this.players[atkPidx].name}](${atkPidx})${atkHidx > -1 ? `[${this.players[atkPidx].heros[atkHidx].name}]` : `[${atkname.replace(/\(\-\d+\)/, '')}]`}对`;
        const logs: string[] = [];
        for (const p of this.players) {
            for (let offset = 0; offset < p.heros.length; ++offset) {
                const h = p.heros[(p.hidx + offset) % p.heros.length];
                const phidx = h.hidx + p.pidx * this.players[0].heros.length;
                const isDead = h.hp <= 0 && willHeals[phidx] % 1 <= 0;
                if (isDead) willHeals[phidx] = -1;
                const heal = Math.max(0, willHeals[phidx]);
                if (h.hp >= 0 || heal % 1 != 0) {
                    const eldmg = willDamages[phidx][0];
                    const pdmg = willDamages[phidx][1];
                    const rheal = heal % 1 != 0 ? Math.ceil(heal) : Math.min(heal, h.hurtHp);
                    if (eldmg >= 0 || pdmg > 0) this.preview.hpChange[p.pidx][h.hidx] = 1;
                    if (willHeals[phidx] != -1) {
                        if (this.preview.hpChange[p.pidx][h.hidx] != 1) this.preview.hpChange[p.pidx][h.hidx] = 2;
                        willHeals[phidx] = rheal;
                    }
                    let ohp = h.hp;
                    if (heal % 1 != 0) {
                        h.hp = rheal;
                        this.preview.hpChange[p.pidx][h.hidx] = 3;
                    } else {
                        h.hp = h.hp - Math.max(0, eldmg) - pdmg + rheal;
                    }
                    if (h.hp < 0) {
                        this.preview.hpChange[p.pidx][h.hidx] = h.hp;
                        h.hp = 0;
                    }
                    if (eldmg >= 0) logs.push(`${logPrefix}[${p.name}](${p.pidx})[${h.name}]造成${willDamages[phidx][0]}点${ELEMENT_NAME[dmgElements[phidx]]}伤害${elTips[phidx][0] ? `（${elTips[phidx][0]}）` : ''} hp:${ohp}→${ohp - eldmg}`);
                    ohp -= Math.max(0, eldmg);
                    if (heal % 1 != 0) ohp = 0;
                    if (pdmg > 0) logs.push(`${logPrefix}[${p.name}](${p.pidx})[${h.name}]造成${willDamages[phidx][1]}点穿透伤害 hp:${ohp}→${ohp - pdmg}`);
                    if ((willHeals[phidx] ?? -1) >= 0) logs.push(`${logPrefix}[${p.name}](${p.pidx})[${h.name}]治疗${rheal}点 hp:${ohp}→${ohp + rheal}`);
                    if (h.hp == 0 && !isDead) {
                        this._detectHero(p.pidx, 'will-killed', { types: STATUS_TYPE.NonDefeat, hidxs: h.hidx, isOnlyHero: true });
                        // 被击倒
                        if (h.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonDefeat) || sts.variables[STATUS_TYPE.NonDefeat] == 0) &&
                            (!h.talentSlot || !h.talentSlot.hasTag(CARD_TAG.NonDefeat) || h.talentSlot.perCnt <= 0)
                        ) {
                            this.players[p.pidx ^ 1].canAction = false;
                            isDie.add(p.pidx);
                            heroDie[p.pidx].push(h.hidx);
                            h.equipments.forEach(slot => this._doSlotDestroy(p.pidx, h.hidx, slot));
                        }
                    }
                } else if (willDamages.length > 0) {
                    willDamages[phidx] = [-1, 0];
                }
            }
        }
        logs.forEach(log => this._writeLog(log, 'info'));
        if (this.env == 'test') this.testDmgFn.forEach(f => f());
        if (isDie.size > 0) {
            // 击倒对方角色
            for (const cpidx of isDie) {
                if (cpidx != atkPidx) {
                    this._detectHero(atkPidx, 'kill', { types: STATUS_TYPE.Usage, skill });
                }
            }
            this.taskQueue.addTask(`heroDie-${damageVO.dmgSource}-${atkname}`, async () => {
                if (!this.preview.isExec) return this.taskQueue.stopPreview();
                const tips = ['', ''];
                for (const cpidx of isDie) {
                    const cplayer = this.players[cpidx];
                    for (const chidx of heroDie[cpidx]) {
                        const h = cplayer.heros[chidx];
                        h.hp = -1;
                        h.heroStatus.forEach(sts => !sts.hasType(STATUS_TYPE.NonDestroy) && sts.dispose());
                        h.talentSlot = null;
                        h.relicSlot = null;
                        h.weaponSlot = null;
                        h.vehicleSlot = null;
                        h.attachElement.length = 0;
                        h.energy = 0;
                        h.skills.forEach(s => s.handle({ pidx: cpidx, ...this.handleEvent, hero: h, skill: s, trigger: 'reset' }));
                        if (!h.isFront) {
                            heroDie[cpidx].splice(heroDie[cpidx].indexOf(chidx), 1);
                            if (heroDie[cpidx].length == 0) isDie.delete(cpidx);
                            continue;
                        }
                        h.isFront = false;
                        if (this._isWin() == -1) {
                            this.taskQueue.isDieWaiting = true;
                            this.isDieBackChange = !this.preview.isQuickAction && cplayer.phase == PHASE.ACTION;
                            cplayer.status = PLAYER_STATUS.DIESWITCH;
                            cplayer.UI.info = '请选择出战角色...';
                            if (!isDie.has(cpidx ^ 1)) this.players[cpidx ^ 1].UI.info = '等待对方选择出战角色......';
                            tips[cpidx] = '请选择出战角色';
                            if (!isDie.has(cpidx ^ 1)) tips[cpidx ^ 1] = '等待对方选择出战角色';
                        }
                    }
                }
                await this.emit(`heroDie-${damageVO.dmgSource}-${atkname}`, pidx, {
                    tip: tips,
                    notPreview: true,
                    isQuickAction: this.preview.isQuickAction && isDie.size == 0,
                });
            }, { addAfterNonDmg: true, isUnshift: true });
        }
        if (damageVO.dmgSource == 'status' && statusSelect) {
            const [cpidx, group, chidx, cidx] = statusSelect;
            const player = this.players[cpidx];
            const sts = (group == STATUS_GROUP.combatStatus ? player.combatStatus : player.heros[chidx].heroStatus)[cidx];
            if (sts?.hasType(STATUS_TYPE.Attack) && !sts.hasType(STATUS_TYPE.Accumulate) && sts.useCnt == 0) sts.dispose();
        }
        await this.emit(`${damageVO.dmgSource}-doDamage-${atkname}`, pidx, {
            damageVO,
            isActionInfo,
            slotSelect,
            summonSelect,
            supportSelect,
            heroSelect,
            statusSelect,
            canAction,
            isQuickAction: this.preview.isQuickAction && isDie.size == 0,
            actionInfo,
            notPreview: !this.preview.isQuickAction,
            trigger,
        });
        await this.delay(2250 + (damageVO.willDamages.some(([d, p]) => d >= 0 && p > 0) ? 2100 : 0));
    }
    /**
     * 检测治疗
     * @param pidx 玩家序号
     * @param willHeals 治疗量
     * @param players 玩家信息
     * @param options.notPreHeal 是否不进行预回血判断(目前只用于禁疗)
     * @param options.source 触发来源id
     */
    private _detectHeal(pidx: number, willHeals: number[], options: { notPreHeal?: boolean, source?: number, skill?: Skill } = {}) {
        const { notPreHeal, source, skill } = options;
        const { heros, hidx } = this.players[pidx];
        if (willHeals.every(hl => hl == -1)) return;
        const offsetHidx = pidx * this.players[0].heros.length;
        const heal = willHeals.slice(offsetHidx, offsetHidx + heros.length);
        heal.forEach((hl, hli, hla) => {
            if (hl == -1) return;
            hla[hli] = Math.min(heros[hli].hurtHp, hl);
        });
        if (!notPreHeal) {
            this._detectHero(pidx, 'pre-heal', { types: STATUS_TYPE.Usage, heal, source, skill });
            heal.forEach((hl, hli) => {
                const chi = offsetHidx + hli;
                willHeals[chi] = hl;
            });
        }
        for (let i = 0; i < heal.length; ++i) {
            const hi = (hidx + i) % heal.length;
            const trgs: Trigger[] = ['all-heal'];
            heal.forEach((hl, hli) => {
                if (hl == -1) return;
                if (hli == hi) trgs.push('heal');
                else trgs.push('other-heal');
            });
            this._detectHero(pidx, trgs, {
                types: STATUS_TYPE.Usage,
                hidxs: hi,
                heal,
                source,
            });
        }
        this._detectSupport(pidx, 'heal', { heal });
        this._detectSupport(pidx ^ 1, 'heal-oppo', { heal });
    }
    /**
     * 弃牌后的处理
     * @param pidx 玩家序号
     * @param discards 将要舍弃的牌
     * @param options isFromPile 是否从牌库弃牌
     */
    private _doDiscard(pidx: number, discards: Card[], options: {
        isPriority?: boolean, isUnshift?: boolean, isFromPile?: boolean,
    } = {}) {
        const { isPriority, isUnshift, isFromPile } = options;
        for (const card of discards) {
            const cardres = card.handle(card, { pidx, ...this.handleEvent, source: +!!isFromPile, trigger: 'discard' });
            if (!this._hasNotTriggered(cardres.triggers, 'discard')) {
                const cmds = new CmdsGenerator(cardres.execmds);
                if (cmds.isEmpty) cmds.addCmds(cardres.cmds);
                this._doCmds(pidx, cmds, {
                    atkname: `${card.name}(${card.entityId})`,
                    isPriority,
                    isUnshift,
                    trigger: 'discard',
                });
            }
            this._detectHero(pidx, 'discard', { types: STATUS_TYPE.Usage, source: +!!isFromPile, hcard: card });
            this._detectSupport(pidx, 'discard', { hcard: card, source: +!!isFromPile });
        }
    }
    /**
     * 给角色附属装备
     * @param pidx 玩家序号
     * @param hero 被装备的角色
     * @param equipment 装备卡
     * @param options.isDestroy 是否直接弃置
     */
    private _doEquip(pidx: number, hero: Hero, equipment: Card | number, options: { isDestroy?: boolean } = {}) {
        if (typeof equipment == 'number') equipment = this.newCard(equipment);
        if (equipment.type != CARD_TYPE.Equipment) return;
        const { isDestroy } = options;
        const explIdx = equipment.UI.description.lastIndexOf('；（');
        if (explIdx > -1) equipment.UI.description = equipment.UI.description.slice(0, explIdx);
        if (!equipment.hasSubtype(CARD_SUBTYPE.Talent) && hero.equipments.some(s => s.subType[0] == equipment.subType[0]) || isDestroy) {
            const destroySlot = isDestroy ? equipment : hero.equipments.find(s => s.subType[0] == equipment.subType[0])!;
            this._doSlotDestroy(pidx, hero.hidx, destroySlot);
        }
        if (!isDestroy) {
            equipment.attachments.clear();
            delete equipment.variables.cardDiceType;
            if (equipment.hasSubtype(CARD_SUBTYPE.Weapon)) { // 武器
                if (hero.weaponSlot?.id == equipment.id) equipment.setEntityId(hero.weaponSlot.entityId);
                hero.weaponSlot = equipment.setEntityId(this._genEntityId());
            } else if (equipment.hasSubtype(CARD_SUBTYPE.Relic)) { // 圣遗物
                if (hero.relicSlot?.id == equipment.id) equipment.setEntityId(hero.relicSlot.entityId);
                hero.relicSlot = equipment.setEntityId(this._genEntityId());
            } else if (equipment.hasSubtype(CARD_SUBTYPE.Talent)) { // 天赋
                hero.talentSlot = equipment.setEntityId(hero.talentSlot?.entityId ?? this._genEntityId());
            } else if (equipment.hasSubtype(CARD_SUBTYPE.Vehicle)) { // 特技
                if (hero.vehicleSlot?.[0].id == equipment.id) equipment.setEntityId(hero.vehicleSlot[0].entityId);
                hero.vehicleSlot = [equipment.setEntityId(this._genEntityId()), this.newSkill(getVehicleIdByCid(equipment.id))];
            }
            if (equipment.hasTag(CARD_TAG.Enchant)) {
                const { attachEl } = equipment.handle(equipment, { pidx, ...this.handleEvent });
                if (!attachEl) throw new Error('ERROR@_doEquip: Enchant equipment must have attachEl');
                for (const skill of hero.skills) {
                    if (skill.dmgElement != DAMAGE_TYPE.Physical) continue;
                    skill.attachElement = attachEl;
                    skill.UI.description = skill.UI.description.replace(ELEMENT_NAME[DAMAGE_TYPE.Physical], ELEMENT_NAME[attachEl]);
                }
            }
        }
    }
    /**
    * 角色技能发动
    * @param pidx 玩家序号
    * @param trigger 触发的时机
    * @param hidx 发动技能角色的索引idx
    * @param options.dmg 造成伤害数
    * @param options.hcard 使用的牌
    * @param options.heal 回血数
    * @param options.source 触发id
    * @param options.sourceHidx 触发的角色序号hidx,
    * @param options.restDmg 减伤
    * @param options.hasDmg 是否造成伤害
    * @returns restDmg 减伤, isInvalid 是否合法
    */
    private _detectSkill(pidx: number, otrigger: Trigger | Trigger[], hidx: number, options: { restDmg?: number, isAfterSkill?: boolean } = {}) {
        const { heros, name } = this.players[pidx];
        let { restDmg = -1, isAfterSkill } = options;
        let isInvalid = false;
        const triggers = convertToArray(otrigger);
        const { skills, name: hname, UI: { avatar }, isDie } = heros[hidx];
        if (!isDie) {
            for (const skill of skills.filter(s => s.isPassive)) {
                for (const trigger of triggers) {
                    const skillres = skill.handle({
                        pidx,
                        ...this.handleEvent,
                        ...options,
                        skill,
                        hidx,
                        trigger,
                        restDmg,
                        isQuickAction: this.preview.isQuickAction,
                    });
                    if (this._hasNotTriggered(skillres.triggers, trigger)) continue;
                    if ((!!isAfterSkill && !!skill) != trigger.startsWith('after')) continue;
                    this.preview.isQuickAction ||= !!skillres.isQuickAction;
                    restDmg = skillres.restDmg ?? restDmg;
                    isInvalid ||= !!skillres.isInvalid;
                    const isPassiveHidden = skill.type == SKILL_TYPE.PassiveHidden && skill.name == '';
                    const execute = () => {
                        const isCancel = skillres.exec?.() === true;
                        if (isCancel) return isCancel;
                        this._updateStatus(pidx, [], heros[hidx].heroStatus, { hidx });
                        if (trigger != 'reset') this._writeLog(`[${name}](${pidx})[${hname}][${skill.name}]发动`, isPassiveHidden || skillres.notLog ? 'system' : 'info');
                    }
                    if (skillres.isNotAddTask) {
                        const isCancel = execute();
                        if (isCancel) break;
                        this._doCmds(pidx, skillres.cmds, { source: skill.id, trigger, skill });
                    } else {
                        this.taskQueue.addTask(`doSkill-${skill.name}(${skill.id}):${trigger}`, async () => {
                            const isCancel = execute();
                            if (isCancel) {
                                if (this.taskQueue.isTaskEmpty()) await this.emit(`doSkill-${skill.name}:${trigger}-cancel`, pidx);
                                return;
                            }
                            const heroSelect = [pidx, hidx];
                            const actionInfo = isCdt(!isPassiveHidden, {
                                avatar,
                                content: skill.name,
                                subContent: SKILL_TYPE_NAME[skill.type],
                            });
                            this._doCmds(pidx, skillres.cmds, { dmgSource: 'skill', actionInfo, heroSelect, skill, atkname: skill.name, source: skill.id, trigger });
                            if (!skillres.cmds.hasDamage) this.emit(`doSkill-${skill.name}:${trigger}`, pidx, { heroSelect, actionInfo });
                            if (skillres.isTrigger) this._emitEvent(pidx, 'trigger', { source: skill.id, sourceHidx: hidx });
                        }, { delayAfter: 1e3 });
                    }
                }
            }
        }
        return { restDmg, isInvalid }
    }
    /**
     * 角色区效果发动
     * @param pidx 玩家序号
     * @param trigger 触发时机
     * @param options 配置项
     * @returns 
     */
    private _detectHero(pidx: number, otrigger: Trigger | Trigger[] | Set<Trigger>, options: {
        types?: StatusType | StatusType[], hidxs?: number | number[], hcard?: Card, restDmg?: number, discards?: Card[],
        sourceHidx?: number, source?: number, minusDiceCard?: number, heal?: number[], switchHeroDiceCnt?: number,
        getdmg?: number[], dmg?: number[], hasDmg?: boolean, isSummon?: number, sourceStatus?: Status, isSwirlExec?: boolean,
        dmgElement?: DamageType, sourceSummon?: Summon, cStatus?: Status, cSlot?: Card, isOnlyHero?: boolean, skill?: Skill,
        includeCombatStatus?: boolean, dmgedHidx?: number, isAfterSkill?: boolean, isImmediate?: boolean,
    } = {}) {
        const player = this.players[pidx];
        const { name, heros, hidx: ahidx, combatStatus } = player;
        const { types, hcard, heal, getdmg, dmg, hasDmg, isSummon, source, sourceHidx, dmgElement, isAfterSkill, sourceStatus,
            isSwirlExec, dmgedHidx, sourceSummon, cStatus, cSlot, isOnlyHero, skill, includeCombatStatus, isImmediate,
        } = options;
        let { hidxs = heros.allHidxs(), restDmg = -1, minusDiceCard = 0, switchHeroDiceCnt = 0 } = options;
        if (Array.isArray(hidxs)) {
            hidxs = hidxs.map(hi => (hi - ahidx + heros.length) % heros.length).sort().map(hi => (hi + ahidx) % heros.length);
        } else if (hidxs < 0) hidxs = [];
        else hidxs = [hidxs];
        let addDmg = 0;
        let addPdmg = 0;
        let getDmg = 0;
        let multiDmg = 0;
        let isInvalid = false;
        const pdmgs: [number, number[] | undefined, boolean][] = [];
        const heals: number[] = new Array(heros.length).fill(-1);
        const triggers = convertToArray(otrigger);
        for (const hidx of hidxs) {
            if (!cStatus && !cSlot) {
                const { isInvalid: skiIsInValid, restDmg: skiRestDmg } = this._detectSkill(pidx, triggers, hidx, options);
                restDmg = skiRestDmg;
                isInvalid ||= skiIsInValid;
            }
            const hfields = cStatus ? [cStatus] : cSlot ? [cSlot] : [...heros[hidx].heroFields];
            if (!cStatus && !cSlot && (!isOnlyHero && hidx == ahidx || includeCombatStatus)) hfields.push(...combatStatus);
            for (const hfield of hfields) {
                const isStatus = 'group' in hfield;
                if (triggers.includes('turn-end') && isStatus && hfield.roundCnt > 0) hfield.minusRoundCnt();
                if (isStatus) {
                    if (!hfield.hasType(...convertToArray(types))) continue;
                    if (hfield.useCnt == 0 && !hfield.hasType(STATUS_TYPE.Shield, STATUS_TYPE.Accumulate)) continue;
                }
                for (const otrigger of triggers) {
                    const trigger = isStatus && hfield.group == STATUS_GROUP.combatStatus ? otrigger.replace('other-', '') as Trigger : otrigger;
                    if (trigger == 'reduce-dmg' && isStatus && hfield.hasType(STATUS_TYPE.Barrier) && hfield.variables[STATUS_TYPE.Barrier] == 0) continue;
                    if (trigger == 'status-destroy' && isStatus && hfield.id == source) continue;
                    if (trigger == 'will-killed') {
                        if (heros[hidx].hp > 0) {
                            if (isStatus && hfield.hasType(STATUS_TYPE.NonDefeat)) continue;
                            if (!isStatus && hfield.hasTag(CARD_TAG.NonDefeat)) continue;
                        } else {
                            if (hfield.variables[STATUS_TYPE.NonDefeat] == 0) continue;
                            if (hfield.variables[CARD_TAG.NonDefeat] == 0) continue;
                        }
                    }
                    if (trigger == 'card' && hcard?.entityId == hfield.entityId) continue;
                    const hfieldres = hfield.handle(hfield as any, {
                        pidx,
                        ...this.handleEvent,
                        hidx,
                        skill,
                        hcard,
                        heal,
                        minusDiceCard,
                        restDmg,
                        trigger,
                        switchHeroDiceCnt,
                        getdmg,
                        dmg,
                        hasDmg,
                        isSummon,
                        source,
                        sourceHidx,
                        dmgElement,
                        sourceStatus,
                        isSelfRound: this.currentPlayerIdx == pidx,
                        isSwirlExec,
                        sourceSummon,
                        dmgedHidx,
                        isQuickAction: this.preview.isQuickAction,
                    });
                    if (this._hasNotTriggered(hfieldres.triggers, trigger)) continue;
                    if ((!!isAfterSkill && !!skill) != (!!hfieldres.isAfterSkill || trigger.startsWith('after'))) continue;
                    if (hfieldres.notPreview && !this.preview.isExec) {
                        this.taskQueue.stopPreview();
                        break;
                    }
                    const isSlotDestroy = !isStatus && !!(hfieldres as CardHandleRes).isDestroy;
                    if (isSlotDestroy) this._doSlotDestroy(pidx, hidx, hfield);
                    if (
                        isStatus && hfield.hasType(STATUS_TYPE.Shield, STATUS_TYPE.Barrier, STATUS_TYPE.ImmuneDamage) ||
                        !isStatus && hfield.hasTag(CARD_TAG.Barrier)
                    ) {
                        restDmg = hfieldres.restDmg ?? restDmg;
                    }
                    if (isStatus) {
                        isInvalid ||= !!(hfieldres as StatusHandleRes).isInvalid;
                        if (!hfield.hasType(STATUS_TYPE.Attack)) {
                            if ((hfieldres as StatusHandleRes).pdmg) {
                                pdmgs.push([(hfieldres as StatusHandleRes).pdmg!, hfieldres.hidxs, !!(hfieldres as StatusHandleRes).isSelf]);
                            }
                            if ((hfieldres as StatusHandleRes).heal) {
                                (hfieldres.hidxs ?? [heros.frontHidx]).forEach(hli => {
                                    heals[hli] = Math.max(0, heals[hli]) + (hfieldres as StatusHandleRes).heal!;
                                });
                            }
                        }
                    }
                    this.preview.isQuickAction ||= !!hfieldres.isQuickAction;
                    switchHeroDiceCnt += hfieldres.addDiceHero ?? 0;
                    switchHeroDiceCnt = Math.max(0, switchHeroDiceCnt - (hfieldres.minusDiceHero ?? 0));
                    minusDiceCard += hfieldres.minusDiceCard ?? 0;
                    if (hasDmg) {
                        addDmg += hfieldres.addDmgCdt ?? 0;
                        addPdmg += hfieldres.addPdmg ?? 0;
                        multiDmg += hfieldres.multiDmgCdt ?? 0;
                        getDmg += hfieldres.getDmg ?? 0;
                    }
                    const hfieldType = isStatus ? 'Status' : 'Slot';
                    const execute = () => {
                        if (hfield.useCnt == 0 && isStatus && !hfield.hasType(STATUS_TYPE.Shield, STATUS_TYPE.Accumulate)) return true;
                        const oCnt = hfield.useCnt;
                        const oPct = hfield.perCnt;
                        const isCancel = hfieldres.exec?.();
                        if (isCancel) return true;
                        if (trigger != 'reset') {
                            this._writeLog(`[${name}](${pidx})${heros[hidx].name}-${hfield.name}:${trigger}${hfield.useCnt != -1 ? ` useCnt:${oCnt}→${hfield.useCnt}` : ''}${hfield.perCnt != -1 ? ` perCnt:${oPct}→${hfield.perCnt}` : ''}`, 'system');
                            this._writeLog(`[${name}](${pidx})[${heros[hidx].name}][${hfield.name}]发动${oCnt > -1 && oCnt != hfield.useCnt ? ` ${oCnt}→${hfield.useCnt}` : ''}`, isCdt(isStatus && hfield.hasType(STATUS_TYPE.Hide), hfieldres.notLog ? 'system' : 'log'));
                        }
                    }
                    const rescmds = isStatus ? hfieldres.cmds : hfieldres.execmds;
                    if (hfieldres.isAddTask || (rescmds?.notEmpty && hfieldres.isAddTask != false)) {
                        this.taskQueue.addTask(`do${hfieldType}-p${pidx}-h${hidx}-${hfield.name}(${hfield.entityId}):${trigger}`, async () => {
                            const isCancel = execute();
                            const slotSelect = isCdt(!isStatus && (rescmds?.notEmpty || hfieldres.isAddTask) && !isCancel, () => [
                                pidx,
                                hidx,
                                SLOT_CODE[(hfield as Card).subType[0]],
                                +isSlotDestroy,
                            ]);
                            const statusSelect = isCdt(isStatus && (rescmds?.notEmpty || hfieldres.isAddTask) && !isCancel, () => [
                                pidx,
                                (hfield as Status).group,
                                (hfield as Status).group == STATUS_GROUP.combatStatus ? player.hidx : hidx,
                                getObjIdxById((hfield as Status).group == STATUS_GROUP.combatStatus ? combatStatus : heros[hidx].heroStatus, hfield.entityId, 'entityId'),
                                +((hfield as Status).isDestroy),
                            ]);
                            if (!isCancel) {
                                this._doCmds(pidx, rescmds, {
                                    atkname: hfield.name,
                                    dmgSource: !isStatus ? 'card' : 'status',
                                    source: hfield.id,
                                    slotSelect,
                                    statusSelect,
                                    trigger,
                                    isUnshift: trigger == 'dmg' || rescmds?.hasCmds('revive'),
                                    isImmediate: isImmediate && trigger == 'dmg',
                                });
                            }
                            if (!rescmds?.hasDamage || (isCancel && this.taskQueue.isTaskEmpty())) {
                                await this.emit(`do${hfieldType}-${hfield.name}(${hfield.entityId}):${trigger}${isCancel ? '-cancel' : ''}`, pidx, { slotSelect, statusSelect });
                                if (isCancel) return;
                            }
                            if (hfieldres.isTrigger) this._emitEvent(pidx, 'trigger', { source: hfield.id, sourceHidx: hidx });
                            await this.delay(!rescmds?.hasDamage ? 600 : -1);
                        }, { isDmg: rescmds?.hasDamage, isUnshift: trigger == 'dmg', isImmediate: isImmediate && trigger == 'dmg' });
                    } else {
                        const isCancel = execute();
                        if (isCancel) break;
                        this._doCmds(pidx, rescmds, { source: hfield.id, trigger });
                    }
                    if (hfieldres.isOrTrigger) break;
                }
            }
        }
        return { restDmg, minusDiceCard, switchHeroDiceCnt, addDmg, addPdmg, getDmg, multiDmg, isInvalid, pdmgs, heals }
    }
    /**
     * 召唤物效果发动
     * @param pidx 玩家idx
     * @param trigger 触发时机
     * @param options cSummon 当前的召唤物, hcard 使用的牌, skill 使用技能,
     *                tround 当前触发回合, switchHeroDiceCnt 切换需要的骰子, dmgedHidx 受伤角色索引, getdmg 受伤量
     * @returns addDmg 加伤, switchHeroDiceCnt 切换需要的骰子
     */
    private _detectSummon(pidx: number, otrigger: Trigger | Trigger[] | Set<Trigger>, options: {
        cSummon?: Summon | Summon[], hcard?: Card, skill?: Skill, tround?: number, isSummon?: number,
        switchHeroDiceCnt?: number, getdmg?: number[], dmgedHidx?: number, isAfterSkill?: boolean,
        dmgElement?: DamageType, source?: number,
    } = {}) {
        const triggers = convertToArray(otrigger);
        const { cSummon, hcard, skill, tround, isSummon, getdmg, dmgedHidx, isAfterSkill, dmgElement, source } = options;
        let { switchHeroDiceCnt = 0 } = options;
        const { name, summons } = this.players[pidx];
        let addDmg = 0;
        const exeSummon = !cSummon ? summons : convertToArray(cSummon)
        for (const summon of exeSummon) {
            for (const trigger of triggers) {
                const summonres = summon.handle(summon, {
                    pidx,
                    ...this.handleEvent,
                    trigger,
                    hcard,
                    skill,
                    tround,
                    isSummon,
                    switchHeroDiceCnt,
                    getdmg,
                    dmgedHidx,
                    dmgElement,
                    source,
                    isQuickAction: this.preview.isQuickAction,
                });
                if (this._hasNotTriggered(summonres.triggers, trigger)) continue;
                if ((!!isAfterSkill && !!skill) != (!!summonres.isAfterSkill || trigger.startsWith('after'))) continue;
                if (trigger == 'phase-end' && summon.isDestroy == SUMMON_DESTROY_TYPE.UsedRoundEnd && summon.useCnt > 0) continue;
                this.preview.isQuickAction ||= !!summonres.isQuickAction;
                addDmg += summonres.addDmgCdt ?? 0;
                switchHeroDiceCnt += summonres.addDiceHero ?? 0;
                switchHeroDiceCnt = Math.max(0, switchHeroDiceCnt - (summonres.minusDiceHero ?? 0));
                const execute = () => {
                    const oCnt = summon.useCnt;
                    const oPct = summon.perCnt;
                    const smnexecres = summonres.exec?.();
                    if (trigger != 'reset') this._writeLog(`[${name}](${pidx})${summon.name}:${trigger}${oCnt != -1 ? `.useCnt:${oCnt}→${summon.useCnt}` : ''}${summon.perCnt != -1 ? `.perCnt:${oPct}→${summon.perCnt}` : ''}`, 'system');
                    return smnexecres?.cmds;
                }
                if (summonres.isNotAddTask) this._doCmds(pidx, execute(), { source: summon.entityId, trigger });
                else {
                    this.taskQueue.addTask(`_detectSummon-p${pidx}-${summon.name}(${summon.entityId}):${trigger}`, async () => {
                        const restround = summonres.tround ?? 0;
                        const cmds = execute();
                        const summonSelect = [
                            pidx,
                            getObjIdxById(summons, summon.id),
                            +(summon.useCnt == 0 && summon.isDestroy == SUMMON_DESTROY_TYPE.Used ||
                                trigger == 'phase-end' && summon.isDestroy == SUMMON_DESTROY_TYPE.RoundEnd ||
                                summon.useCnt == 0 && trigger == 'phase-end' && summon.isDestroy == SUMMON_DESTROY_TYPE.UsedRoundEnd),
                            summon.entityId,
                        ];
                        this._doCmds(pidx, cmds, {
                            atkname: summon.name,
                            dmgSource: 'summon',
                            source: summon.entityId,
                            isSummon: summon.id,
                            summonSelect,
                            canAction: restround == 0,
                            trigger,
                        });
                        if (restround > 0) this._detectSummon(pidx, trigger, { ...options, cSummon: summon, tround: restround });
                        if (summonres.isTrigger) this._emitEvent(pidx, 'trigger', { source: summon.id });
                        if (!cmds?.hasDamage) {
                            await this.emit(`doSummon-${summon.name}(${summon.entityId}):${trigger}`, pidx, { summonSelect });
                            await this.delay(1e3);
                        }
                    }, { isDmg: true });
                }
            }
        }
        return { switchHeroDiceCnt, addDmg }
    }
    /**
     * 支援物效果发动
     * @param pidx 玩家idx
     * @param trigger 触发时机
     * @param options switchHeroDiceCnt 切换需要的骰子, hcard 使用的牌, skill 使用的技能,
     *                hidx 将要切换的玩家,  firstPlayer 先手玩家pidx, getdmg 受伤量, heal 回血量, 
     *                sourceSummon 选中的召唤物, sourceStatus 状态来源
     * @returns minusDiceHero 减少切换角色骰子, minusDiceCard 减少使用卡骰子,
     */
    private _detectSupport(pidx: number, otrigger: Trigger | Trigger[] | Set<Trigger>, options: {
        switchHeroDiceCnt?: number, hcard?: Card, firstPlayer?: number, minusDiceCard?: number, hidx?: number,
        getdmg?: number[], heal?: number[], sourceStatus?: Status, skill?: Skill, source?: number,
        sourceSummon?: Summon, cSupport?: Support | Support[], isAfterSkill?: boolean, dmgElement?: DamageType,
    } = {}) {
        const { hidx, hcard, firstPlayer, skill, getdmg, heal, sourceStatus, sourceSummon, cSupport, source, isAfterSkill, dmgElement } = options;
        let { switchHeroDiceCnt = 0, minusDiceCard = 0 } = options;
        const triggers = convertToArray(otrigger);
        const { name, supports } = this.players[pidx];
        const { supports: eSupports } = this.players[pidx ^ 1];
        const exeSupport = !cSupport ? supports : convertToArray(cSupport);
        const lastSupport: Support[] = [];
        let isLast = false;
        const detectSupport = (support: Support) => {
            for (const trigger of triggers) {
                const supportres = support.handle(support, {
                    pidx,
                    ...this.handleEvent,
                    trigger,
                    hidx,
                    hcard,
                    isFirst: firstPlayer == pidx,
                    minusDiceCard,
                    skill,
                    switchHeroDiceCnt,
                    getdmg,
                    heal,
                    source,
                    sourceStatus,
                    sourceSummon,
                    dmgElement,
                    isQuickAction: this.preview.isQuickAction,
                });
                if (supportres.isLast && !isLast) lastSupport.push(support);
                if (this._hasNotTriggered(supportres.triggers, trigger)) continue;
                if (supportres.isLast && !isLast) break;
                if ((!!isAfterSkill && !!skill) != (!!supportres.isAfterSkill || trigger.startsWith('after'))) break;
                this.preview.isQuickAction ||= !!supportres.isQuickAction;
                switchHeroDiceCnt = Math.max(0, switchHeroDiceCnt - (supportres.minusDiceHero ?? 0));
                minusDiceCard += supportres.minusDiceCard ?? 0;
                const execute = () => {
                    const oCnt = support.useCnt;
                    const oPct = support.perCnt;
                    const supportexecres = supportres.exec?.();
                    if (!supportexecres?.isCancel && trigger != 'reset') {
                        this._writeLog(`[${name}](${pidx})[${support.name}]发动${oCnt != support.useCnt ? ` ${oCnt}→${support.useCnt}` : ''}`, supportres.notLog ? 'system' : 'log');
                        this._writeLog(`[${name}](${pidx})${trigger}:${support.name}(${support.entityId}).cnt:${oCnt}→${support.useCnt}.perCnt:${oPct}→${support.perCnt}`, 'system');
                    }
                    return supportexecres ?? {};
                }
                const doSupportDestroy = () => {
                    assign(supports, supports.filter(s => s.entityId != support.entityId));
                    this._doSupportDestroy(pidx, support);
                }
                if (supportres.isNotAddTask) {
                    const { cmds, isDestroy, isCancel } = execute();
                    if (isCancel) continue;
                    this._doCmds(pidx, cmds, { source: support.id, trigger });
                    if (isDestroy) doSupportDestroy();
                } else {
                    const taskName = `_detectSupport-p${pidx}-${support.name}(${support.entityId}):${trigger}`;
                    this.taskQueue.addTask(taskName, async () => {
                        const { cmds, isDestroy, isCancel } = execute();
                        if (isCancel) return this.emit(`${taskName}-cancel`, pidx, { notPreview: true });
                        const sptIdx = supports.findIndex(s => s.entityId == support.entityId);
                        if (supportres.isExchange && !eSupports.isFull) {
                            const exchangeTaskName = `doSupport-exchange:${support.name}(${support.entityId})`;
                            this.taskQueue.addTask(exchangeTaskName, () => {
                                supports.splice(sptIdx, 1);
                                eSupports.push(support);
                                if (this.taskQueue.isTaskEmpty()) this.emit(exchangeTaskName, pidx, { notPreview: true });
                            }, { isUnshift: true });
                        }
                        const supportSelect = [pidx, supports.findIndex(s => s.entityId == support.entityId), +!!isDestroy];
                        this._doCmds(pidx, cmds, {
                            atkname: support.name,
                            dmgSource: 'support',
                            source: support.id,
                            supportSelect: isCdt(!isDestroy, supportSelect),
                            trigger,
                        });
                        if (!cmds?.hasDamage || isDestroy) await this.emit(`doSupport-${support.name}(${support.entityId}):${trigger}`, pidx, { supportSelect });
                        if (isDestroy) doSupportDestroy();
                    }, { delayAfter: 800 });
                }
                if (supportres.isOrTrigger) break;
            }
        }
        exeSupport.forEach(detectSupport);
        isLast = true;
        lastSupport.forEach(detectSupport);
        return { switchHeroDiceCnt, minusDiceCard }
    }
    /**
     * 手牌效果发动
     * @param pidx 玩家序号
     * @param otrigger 触发时机
     */
    private _detectHandcards(pidx: number, otrigger: Trigger | Trigger[] | Set<Trigger>, options: { cCard?: Card } = {}) {
        const { cCard } = options;
        const triggers = convertToArray(otrigger);
        const handcards = cCard ? [cCard] : this.players[pidx].handCards.sort((a, b) => b.entityId - a.entityId);
        let isInvalid = false;
        let diceEl: DiceCostType | undefined;
        for (const card of handcards) {
            if (card.type != CARD_TYPE.Equipment) {
                for (const trigger of triggers) {
                    const handcardres = card.handle(card, { pidx, ...this.handleEvent, trigger, });
                    if (this._hasNotTriggered(handcardres.triggers, trigger)) continue;
                    this.taskQueue.addTask(`doHandcards-${card.name}(${card.id}):${trigger}`, () => {
                        handcardres.exec?.();
                        if (trigger != 'reset') this._writeLog(`[${this.players[pidx].name}](${pidx})[${card.name}]发动`);
                        this._doCmds(pidx, handcardres.execmds, { trigger });
                    });
                }
            }
            for (const attachment of card.attachments) {
                for (const trigger of triggers) {
                    const attachmentres = attachment.handle(attachment, { pidx, ...this.handleEvent, trigger, });
                    if (this._hasNotTriggered(attachmentres.triggers, trigger)) continue;
                    isInvalid ||= !!attachmentres.isInvalid;
                    diceEl = attachmentres.diceEl;
                    this.taskQueue.addTask(`doHandcardsAttachment-${card.name}(${card.id})-${attachment.name}(${attachment.id}):${trigger}`, () => {
                        attachmentres.exec?.();
                        if (trigger != 'reset') this._writeLog(`[${this.players[pidx].name}](${pidx})手牌【p${pidx}[${card.name}]】附着状态[${attachment.name}]发动`);
                        this._doCmds(pidx, attachmentres.cmds, { trigger, atkname: attachment.name, source: attachment.id, dmgSource: 'status' });
                    });
                }
            }
        }
        return { isInvalid, diceEl }
    }
    /**
     * 牌库效果发动
     * @param pidx 玩家序号
     * @param otrigger 触发时机
     */
    private _detectPilecards(pidx: number, otrigger: Trigger | Trigger[] | Set<Trigger>) {
        const triggers = convertToArray(otrigger);
        const { pile } = this.players[pidx];
        for (let i = pile.length - 1; i >= 0; --i) {
            const card = pile[i];
            if (card.type != CARD_TYPE.Equipment) {
                for (const trigger of triggers) {
                    const handcardres = card.handle(card, { pidx, ...this.handleEvent, trigger, });
                    if (this._hasNotTriggered(handcardres.triggers, trigger)) continue;
                    this.taskQueue.addTask(`doPilecards-${card.name}(${card.id}):${trigger}`, () => {
                        handcardres.exec?.();
                        if (trigger != 'reset') this._writeLog(`[${this.players[pidx].name}](${pidx})[${card.name}]发动`);
                        this._doCmds(pidx, handcardres.execmds, { trigger });
                    });
                }
            }
            for (const attachment of card.attachments) {
                for (const trigger of triggers) {
                    const atchres = attachment.handle(attachment, { pidx, ...this.handleEvent, trigger });
                    if (this._hasNotTriggered(atchres.triggers, trigger)) continue;
                    this.taskQueue.addTask(`doPilecardsAttachment-${card.name}(${card.id})-${attachment.name}(${attachment.id}):${trigger}`, () => {
                        atchres.exec?.();
                        if (trigger != 'reset') this._writeLog(`[${this.players[pidx].name}](${pidx})牌库【p[${card.name}]】附着状态[${attachment.name}]发动`);
                        this._doCmds(pidx, atchres.cmds, { trigger, atkname: attachment.name, source: attachment.id, dmgSource: 'status' });
                    });
                }
            }
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
        assign(this.players[pidx].dice, ndices);
        return this._rollDice(pidx);
    }
    private _emitEvent(pidx: number, trigger: Trigger | Trigger[] | Set<Trigger>, options: {
        types?: StatusType | StatusType[], hidxs?: number | number[], hcard?: Card, sourceHidx?: number,
        restDmg?: number, source?: number, skill?: Skill, isAfterSkill?: boolean,
    } = {}) {
        // 先监听出战角色，然后监听出战状态，最后依次监听后台角色状态
        let { isInvalid, minusDiceCard } = this._detectHero(pidx, trigger, options);
        this._detectSummon(pidx, trigger, options);
        this._detectSupport(pidx, trigger, { ...options, minusDiceCard });
        isInvalid ||= this._detectHandcards(pidx, trigger).isInvalid;
        return { isInvalid }
    }
    /**
     * 执行命令集
     * @param pidx 执行命令玩家序号
     * @param cmds 命令集
     * @param options withCard 是否使用卡, hidxs 角色索引组, source 触发来源id, isPriority 是否为优先命令
     * @returns 
     */
    private _doCmds(pidx: number, cmds?: Cmds[] | CmdsGenerator, options: {
        withCard?: Card, hidxs?: number[], source?: number, socket?: Socket, skill?: Skill, notPreview?: boolean,
        isImmediate?: boolean, isPriority?: boolean, isUnshift?: boolean, isSummon?: number, trigger?: Trigger,
        slotSelect?: number[], summonSelect?: number[], statusSelect?: number[], canAction?: boolean, atkname?: string,
        heroSelect?: number[], supportSelect?: number[], dmgSource?: DmgSource, isActionInfo?: boolean, actionInfo?: ActionInfo,
        multiDmg?: number,
    } = {}) {
        const { withCard, hidxs: chidxs, source, socket, skill, supportSelect, isSummon, statusSelect,
            isImmediate, isPriority, isUnshift, slotSelect, summonSelect, canAction = true, atkname,
            heroSelect, isActionInfo, actionInfo, dmgSource = 'null', trigger = '', notPreview, multiDmg,
        } = options;
        cmds = Array.isArray(cmds) ? cmds : cmds?.value ?? [];
        if (cmds.length == 0) return;
        if (isUnshift) cmds.reverse();
        const damageCmds = new CmdsGenerator();
        const doDamage = () => {
            if (damageCmds.isEmpty) return;
            const cDamageCmds = new CmdsGenerator(clone(damageCmds.value));
            damageCmds.clear();
            this.taskQueue.addTask(`doCmd--damage-${atkname}:${trigger}`, async () => {
                const allHeroLen = this.players.flatMap(p => p.heros).length;
                let damageVO: DamageVO = INIT_DAMAGEVO(allHeroLen);
                let isFirstAtk = true;
                for (const cmdidx in cDamageCmds.value) {
                    const cmds = cDamageCmds.value[cmdidx];
                    const ncmds = new CmdsGenerator();
                    const { cmd, cnt = cmd == 'attack' ? -1 : 0, hidxs: ohidxs, isAttach,
                        isOppo = cmd == 'attack', mode, element, status: target, callback } = cmds;
                    callback?.(ncmds);
                    cDamageCmds.addCmds(ncmds);
                    const cpidx = pidx ^ +isOppo;
                    const cplayer = this.players[cpidx];
                    const copponent = this.players[cpidx ^ 1];
                    const atkPidx = cpidx ^ +(isOppo && cmd == 'attack');
                    const { hidxs = chidxs ?? ohidxs ?? [cplayer.heros.frontHidx] } = cmds;
                    if (mode == CMD_MODE.ByOrder) {
                        damageVO = INIT_DAMAGEVO(allHeroLen);
                        isFirstAtk = true;
                    }
                    if (damageVO.atkPidx == -1) damageVO.atkPidx = atkPidx;
                    let notPreHeal = cmd == 'revive' || (this.version.lt('v5.0.0') && cmd == 'addMaxHp');
                    if (['heal', 'addMaxHp', 'revive'].includes(cmd)) {
                        const offsetHidx = atkPidx * this.players[0].heros.length;
                        cplayer.heros.forEach((h, hi) => {
                            if (cmd == 'addMaxHp' && hidxs.includes(hi)) h.maxHp += cnt;
                            const heal = hidxs.includes(hi) ? cnt - (cmd == 'revive' ? 0.3 : 0) : -1;
                            if (heal == -1) return;
                            const chi = offsetHidx + hi;
                            if (damageVO.willHeals[chi] == -1) damageVO.willHeals[chi] = 0;
                            damageVO.willHeals[chi] += heal;
                        });
                        if (cmd == 'revive') this._emitEvent(cpidx, 'revive', { types: STATUS_TYPE.NonDestroy, hidxs, source });
                        notPreHeal ||= !!isAttach;
                    } else if (cmd == 'attack') {
                        if (damageVO.atkHidx == -1) damageVO.atkHidx = skill && skill.type != SKILL_TYPE.Vehicle ? copponent.heros.frontHidx : -1;
                        let cAtkedIdxs = target == CMD_MODE.MaxHpHero ? cplayer.heros.getMaxHpHidxs() :
                            ohidxs ?? (element == DAMAGE_TYPE.Pierce && isOppo ? cplayer.heros.getBackHidxs() : [cplayer.heros.frontHidx]);
                        if (cnt >= 0 && isOppo && skill?.type != SKILL_TYPE.Passive) {
                            if (dmgSource == 'skill' && this.preview.tarHidx == -1) this.preview.tarHidx = cAtkedIdxs[0];
                            if (damageVO.tarHidx == -1) damageVO.tarHidx = cAtkedIdxs[0];
                        }
                        if (mode == CMD_MODE.IsPriority) {
                            for (let i = 0; i < cAtkedIdxs.length; ++i) {
                                const chidx = cAtkedIdxs[i];
                                if (cplayer.heros[chidx].hp <= 0) {
                                    cAtkedIdxs[i] = (chidx + 1) % cplayer.heros.length;
                                    --i;
                                }
                            }
                            cAtkedIdxs = [...new Set(cAtkedIdxs)];
                        }
                        const atkHero = copponent.heros.getFront();
                        cAtkedIdxs.forEach((hidx, hi) => {
                            const wdmgs = new Array(cplayer.heros.length).fill(0).map((_, i) => i == hidx ? [
                                cnt >= 0 && element != DAMAGE_TYPE.Pierce ? cnt : -1,
                                element == DAMAGE_TYPE.Pierce ? cnt : 0] : [-1, 0]);
                            const dmgel = (Array.isArray(element) ? element[hi] :
                                element ?? atkHero?.element ?? DAMAGE_TYPE.Physical) as DamageType;
                            if (isOppo) wdmgs.push(...Array.from({ length: copponent.heros.length }, () => [-1, 0]));
                            else wdmgs.unshift(...Array.from({ length: copponent.heros.length }, () => [-1, 0]));
                            const { elTips, willDamages, willHeals, dmgElements, atriggers, etriggers }
                                = this._calcDamage(pidx, dmgel, wdmgs, hidx, {
                                    isAttach,
                                    isSummon,
                                    skill,
                                    atkId: source,
                                    isAtkSelf: +!isOppo,
                                    isFirstAtk,
                                    multiDmg,
                                    isImmediate,
                                });
                            elTips.forEach((et, eti) => et[0] != '' && (damageVO.elTips[eti] = [...et]));
                            willDamages.forEach((wdmg, wi) => {
                                if (wdmg[0] != -1) {
                                    if (damageVO.willDamages[wi][0] == -1) damageVO.willDamages[wi][0] = 0;
                                    damageVO.willDamages[wi][0] += wdmg[0];
                                }
                                damageVO.willDamages[wi][1] += wdmg[1];
                            });
                            willHeals.forEach((whl, whli) => {
                                if (whl == -1) return;
                                damageVO.willHeals[whli] = Math.max(0, damageVO.willHeals[whli]) + whl;
                            });
                            dmgElements.forEach((dmgel, dei) => {
                                if (dmgel != DAMAGE_TYPE.Physical) damageVO.dmgElements[dei] = dmgel;
                            });
                            this.preview.triggers[cpidx].forEach((trgs, tri) => etriggers[tri].forEach(t => trgs.add(t)));
                            this.preview.triggers[cpidx ^ 1].forEach((trgs, tri) => atriggers[tri].forEach(t => trgs.add(t)));
                        });
                        isFirstAtk = false;
                    }
                    const isLast = +cmdidx == cDamageCmds.length - 1;
                    if (isLast || cDamageCmds.value[+cmdidx + 1].mode == CMD_MODE.ByOrder) {
                        this._detectHeal(atkPidx, damageVO.willHeals, { notPreHeal, source, skill });
                        damageVO.dmgSource = dmgSource;
                        const needSelect = +cmdidx == 0 || mode != CMD_MODE.ByOrder;
                        await this._doDamage(pidx, damageVO, {
                            slotSelect: isCdt(needSelect, slotSelect),
                            summonSelect: isCdt(needSelect, summonSelect),
                            statusSelect: isCdt(needSelect, statusSelect),
                            heroSelect: isCdt(needSelect, heroSelect),
                            supportSelect: isCdt(needSelect, supportSelect),
                            canAction: canAction && isLast,
                            skill,
                            atkname,
                            isActionInfo,
                            actionInfo: isCdt(needSelect, actionInfo),
                            trigger,
                        });
                    }
                }
                if (notPreview && !this.preview.isExec) this.taskQueue.stopPreview();
            }, { isImmediate, isPriority, isUnshift, isDmg: !cDamageCmds.isPriority });
        }
        for (let i = 0; i < cmds.length; ++i) {
            const { cmd, cnt = 0, hidxs: ohidxs, element, card, status: stsargs, summon: smnargs,
                isOppo, isAttach = false, mode = 0, trigger: cmdtrg, callback, cardFilter,
            } = cmds[i];
            const cpidx = pidx ^ +!!isOppo ^ +(cmd == 'stealCard');
            const cplayer = this.players[cpidx];
            const copponent = this.players[cpidx ^ 1];
            const { name, heros, dice, handCards, pile, UI, playerInfo, summons } = cplayer;
            let { hidxs = chidxs } = cmds[i];
            if (!['attack', 'heal', 'addMaxHp', 'revive'].includes(cmd)) doDamage();
            if (cmd == 'useSkill') {
                this.taskQueue.addTask(`doCmd--useSkill:${cnt}-p${cpidx}:${trigger}`, async () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    if (typeof stsargs == 'number' && !cplayer.heros[stsargs].isFront) {
                        return this.emit('useSkill-cancel', cpidx);
                    }
                    await this._useSkill(cpidx, cnt || -2, {
                        selectSummon: ohidxs?.[0],
                        withCard,
                    });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd.startsWith('switch-')) {
                const sdir = cmd == 'switch-before' ? -1 : cmd == 'switch-after' ? 1 : 0;
                this.taskQueue.addTask(`doCmd--switch-p${cpidx}:${source}:${trigger}`, async () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const { isInvalid } = this._emitEvent(cpidx, 'pre-switch', { types: STATUS_TYPE.Usage, hidxs: heros.frontHidx });
                    if (isInvalid) return;
                    const toHidx = sdir == 0 ? heros.getNearestHidx(hidxs?.[0]) : heros.getFront({ offset: sdir })?.hidx ?? -1;
                    if (toHidx == -1) throw new Error(`ERROR@doCmd--${cmd}: toHidx is not found, hidxs:${hidxs}, sdir:${sdir}`);
                    if (!this.preview.isExec) this.preview.willSwitch[cpidx][toHidx] = true;
                    await this._switchHero(cpidx, toHidx, `doCmd--switch:${source}`, { socket, skill });
                }, { isImmediate, isPriority, isUnshift });
            } else if (['getCard', 'addCard', 'putCard'].includes(cmd)) {
                const cards: Card[] = [];
                const count = Math.abs(cnt);
                if (card) {
                    cards.push(...(Array.isArray(card) ? card : Array.from({ length: count }, () => clone(card)))
                        .map(c => typeof c == 'number' ? this.newCard(c) : c));
                }
                if (cmd == 'putCard') {
                    if (handCards.length == 0) continue;
                    if (mode == CMD_MODE.HighHandCard || mode == CMD_MODE.LowHandCard) {
                        let restCnt = cnt;
                        let hcardsSorted = clone(handCards).sort((a, b) =>
                            (b.currDiceCost - a.currDiceCost) * (mode == CMD_MODE.HighHandCard ? 1 : -1) || (b.entityId - a.entityId));
                        while (hcardsSorted.length > 0) {
                            const cost = hcardsSorted[0].currDiceCost;
                            const costCards = hcardsSorted.filter(c => c.currDiceCost == cost);
                            cards.push(...this._randomInArr(costCards, restCnt));
                            if (cards.length == cnt) break;
                            restCnt -= cards.length;
                            hcardsSorted = hcardsSorted.filter(c => c.currDiceCost != cost);
                        }
                    } else if (mode == CMD_MODE.AllHandCards) {
                        cards.push(...clone(handCards));
                    }
                    const putCardCmds: Cmds[] = [
                        { cmd: 'discard', cnt: cards.length, card: cards, mode: CMD_MODE.IsNotPublic, isAttach: true, isOppo },
                        { cmd: 'addCard', card: cards, hidxs: [-cards.length], mode: CMD_MODE.IsNotPublic, isOppo }
                    ];
                    if (isUnshift) putCardCmds.reverse();
                    cmds.splice(i--, 1, ...putCardCmds);
                    continue;
                }
                if (cmd == 'getCard') {
                    this.taskQueue.addTask(`doCmd--getCard-p${cpidx}:${trigger}`, async () => {
                        const ncmds = new CmdsGenerator();
                        callback?.(ncmds);
                        this._doCmds(cpidx, ncmds);
                        const willGetCard: Card[] = [];
                        const exclude = ohidxs ?? [];
                        let restCnt = stsargs ? count - handCards.filter(c => c.UI.class != 'discard').length : (count || cards.length);
                        let isFromPile = isAttach;
                        while (restCnt-- > 0) {
                            let wcard: Card | null = null;
                            if (cards[count - restCnt - 1]) { // 摸指定卡
                                if (isAttach) { // 从牌库摸
                                    const cid = cards[count - restCnt - 1].id;
                                    const cardIdx = pile.findIndex(c => c.id == cid);
                                    if (cardIdx > -1) [wcard] = pile.splice(cardIdx, 1);
                                } else { // 直接生成
                                    wcard = cards[count - restCnt - 1];
                                }
                            } else if (cardFilter) { // 指定类型
                                if (isAttach) {
                                    if (pile.every(c => !cardFilter(c))) break;
                                    while (wcard == null) {
                                        const cardIdx = pile.findIndex(c => cardFilter(c) && !exclude.includes(c.id));
                                        if (cardIdx > -1) [wcard] = pile.splice(cardIdx, 1);
                                    }
                                } else {
                                    const cardsIdPool = this._getCardIds(c => cardFilter(c) && !exclude.includes(c.id));
                                    wcard = this.newCard(this._randomInArr(cardsIdPool)[0]);
                                }
                            } else {
                                if (exclude.length > 0) { // 在指定的某几张牌中随机模
                                    wcard = this.newCard(this._randomInArr(exclude)[0]);
                                } else { // 从牌库直接摸牌
                                    isFromPile = true;
                                    wcard = pile.shift() ?? null;
                                }
                            }
                            if (wcard && wcard.id != 0) {
                                willGetCard.push(clone(wcard).setEntityId(this._genEntityId()));
                            }
                        }
                        if (willGetCard.length > 0) {
                            const rest = MAX_HANDCARDS_COUNT - handCards.length;
                            const getcards = willGetCard.slice(0, rest);
                            const cardNames = willGetCard.map(c => `[${c.name}]`).join('');
                            const cardEntityIds = willGetCard.map(c => `(${c.entityId})`).join('');
                            if (stsargs && count - handCards.length < willGetCard.length) {
                                let excess = willGetCard.length - count + handCards.length;
                                while (excess-- > 0) {
                                    const excard = willGetCard.pop();
                                    if (excard) pile.unshift(excard);
                                }
                            }
                            if (mode != CMD_MODE.IsPublic) this._writeLog(`[${name}](${cpidx})抓${willGetCard.length}张牌【p${cpidx}:${cardNames}】【${cardEntityIds}】`);
                            willGetCard.forEach((c, ci) => {
                                c.UI.class = (isFromPile ? 'will-getcard-my-pile' : 'will-getcard-my-generate') + (ci < rest ? '' : '-over');
                            });
                            UI.willGetCard = {
                                cards: [...willGetCard],
                                isFromPile,
                                isNotPublic: mode != CMD_MODE.IsPublic,
                            }
                            handCards.push(...willGetCard.slice(0, rest));
                            await this.emit('getCard', cpidx);
                            UI.willGetCard = { cards: [], isFromPile: true, isNotPublic: true };
                            handCards.forEach(c => delete c.UI.class);
                            const atriggers: Trigger[] = ['getcard'];
                            const etriggers: Trigger[] = ['getcard-oppo'];
                            if (isFromPile) {
                                atriggers.push('drawcard');
                                etriggers.push('drawcard-oppo');
                            }
                            for (const getCard of getcards) {
                                this.taskQueue.addTask(`doCmd--getCard-p${cpidx}-${getCard.name}(${getCard.entityId}):drawcard`, async () => {
                                    if (cplayer.handCards.some(c => c.entityId == getCard.entityId)) {
                                        this._detectHero(cpidx, atriggers, { types: STATUS_TYPE.Usage, hcard: getCard });
                                        this._detectSupport(cpidx ^ 1, etriggers);
                                    }
                                    if (this.taskQueue.isTaskEmpty()) await this.emit('getCard:drawcard-cancel', cpidx);
                                });
                                const cardres = getCard.handle(getCard, { pidx: cpidx, ...this.handleEvent, trigger: 'getcard' });
                                if (this._hasNotTriggered(cardres.triggers, 'getcard')) continue;
                                this.taskQueue.addTask(`doCmd--getCard-p${cpidx}-${getCard.name}(${getCard.entityId}):getcard`, async () => {
                                    if (cplayer.handCards.some(c => c.entityId == getCard.entityId)) {
                                        await this._useCard(cpidx, -1, [], { getCard });
                                    } else if (this.taskQueue.isTaskEmpty()) {
                                        await this.emit('getCard:getcard-cancel', cpidx);
                                    }
                                });
                            }
                            await this.delay(1500);
                        }
                    }, { isImmediate, isPriority, isUnshift });
                }
                if (cmd == 'addCard') {
                    const cardMap = {};
                    cards.forEach(c => cardMap[c.name] = (cardMap[c.name] ?? 0) + 1);
                    const cardStr = Object.entries(cardMap).map(([name, cnt]) => `${cnt}张[${name}]`).join('');
                    this.taskQueue.addTask(`doCmd--addCard-p${cpidx}:${trigger}:${cardStr}`, async () => {
                        const ncmds = new CmdsGenerator();
                        callback?.(ncmds);
                        this._doCmds(cpidx, ncmds);
                        UI.willAddCard.cards.push(...cards);
                        UI.willAddCard.isNotPublic = mode == CMD_MODE.IsNotPublic;
                        const scope = ohidxs?.[0] ?? 0;
                        const isRandom = !isAttach;
                        const isNotPublic = mode == CMD_MODE.IsNotPublic;
                        this._writeLog(`[${name}](${cpidx})将${isNotPublic ? `【p${cpidx}:${cardStr}】【p${cpidx ^ 1}:${cards.length}张牌】` : `${cardStr}`}${Math.abs(scope) == cards.length ? '' : cnt < 0 ? '' : isRandom ? '随机' : '均匀'}加入牌库${scope != 0 ? `${scope > 0 ? '顶' : '底'}${cnt < 0 && Math.abs(scope) != cards.length ? '第' : ''}${Math.abs(scope) == cards.length ? '' : `${Math.abs(scope)}张`}` : ''}`);
                        const count = cards.length;
                        const cscope = scope || pile.length;
                        if (cnt < 0) {
                            pile.splice(Math.abs(scope) - 1, 0, ...cards);
                        } else if (isRandom) {
                            const ranIdxs: number[] = [];
                            for (let i = 1; i <= count; ++i) {
                                let pos = this._randomInt(cscope - i * Math.sign(cscope));
                                if (cscope < 0 && pos == 0) pos = pile.length;
                                ranIdxs.push(pos);
                            }
                            ranIdxs.sort((a, b) => (a - b) * cscope).forEach(pos => pile.splice(pos, 0, cards.shift()!));
                        } else {
                            const step = parseInt(`${cscope / (count + 1)}`);
                            let rest = Math.abs(cscope % (count + 1));
                            for (let i = 1; i <= count; ++i) {
                                let pos = step * i + ((i - 1 + Math.min(rest, i))) * Math.sign(step);
                                if (cscope < 0 && pos == 0) pos = pile.length;
                                pile.splice(pos, 0, cards.shift()!);
                            }
                        }
                        this._writeLog(`[${name}](${cpidx})加牌后牌库：${pile.map(c => `[${c.name}]`).join('')}`, 'system');
                        await this.emit('addcard', cpidx);
                        UI.willAddCard = { cards: [], isNotPublic: false };
                    }, { delayAfter: 1500, isImmediate, isPriority, isUnshift });
                }
            } else if (['discard', 'stealCard'].includes(cmd)) {
                this.taskQueue.addTask(`doCmd--discard-p${cpidx}:${trigger}`, async () => {
                    const isDiscard = cmd == 'discard';
                    const discards: Card[] = [];
                    let discardCnt = cnt || 1;
                    const unselectedCards = handCards.filter(c => c.entityId != withCard?.entityId).sort((a, b) => b.entityId - a.entityId);
                    if (cmd == 'stealCard' && unselectedCards.length == 0) return;
                    const discardIdxs = (ohidxs ?? []).map(ci => handCards.filter(c => c.entityId != withCard?.entityId)[ci].entityId);
                    if (discardIdxs.length > 0) {
                        discards.push(...clone(unselectedCards.filter(c => discardIdxs.includes(c.entityId))));
                    } else {
                        if (typeof card == 'number') {
                            if (unselectedCards.length > 0) {
                                let curIdx = -1;
                                while (discardCnt-- > 0) {
                                    curIdx = unselectedCards.findIndex((c, ci) => ci > curIdx && (c.id == card || c.entityId == card || c.currDiceCost == card));
                                    if (curIdx == -1) break;
                                    discards.push(clone(unselectedCards[curIdx]));
                                }
                            }
                        } else {
                            const hcardsSorted = clone(unselectedCards).sort((a, b) => (b.currDiceCost - a.currDiceCost));
                            if (card) { // 弃置指定牌
                                (convertToArray(clone(card)) as Card[]).forEach(c => {
                                    if (c.entityId == -1) discardIdxs.push(c.cidx);
                                    discards.push(c);
                                });
                            } else if (mode == CMD_MODE.AllHandCards) { // 弃置所有手牌
                                discards.push(...hcardsSorted);
                            } else {
                                while (discardCnt > 0) {
                                    if (mode == CMD_MODE.Random || mode == CMD_MODE.HighHandCard || mode == CMD_MODE.LowHandCard) {
                                        if (unselectedCards.length == 0) break;
                                        if (mode == CMD_MODE.Random) { // 弃置随机手牌
                                            const didx = this._randomInt(unselectedCards.length - 1);
                                            const [discard] = unselectedCards.splice(didx, 1);
                                            discards.push(clone(discard));
                                        } else if (mode == CMD_MODE.HighHandCard || mode == CMD_MODE.LowHandCard) { // 弃置花费最高/低的手牌
                                            const cost = hcardsSorted.at(mode == CMD_MODE.HighHandCard ? 0 : -1)!.currDiceCost;
                                            const costCards = unselectedCards.filter(c => c.currDiceCost == cost);
                                            const [{ entityId: ceid }] = isDiscard ? this._randomInArr(costCards) : costCards;
                                            const [discard] = unselectedCards.splice(unselectedCards.findIndex(c => c.entityId == ceid), 1);
                                            discards.push(clone(discard));
                                            hcardsSorted.splice(hcardsSorted.findIndex(c => c.entityId == ceid), 1);
                                        }
                                    } else {
                                        if (pile.length - (cnt - discardCnt) == 0) break;
                                        if (mode == CMD_MODE.TopPileCard) { // 弃置牌堆顶的牌 
                                            const discardIdx = Math.min(pile.length, cnt) - (cnt - discardCnt) - 1;
                                            discards.push(clone(pile[discardIdx]));
                                            discardIdxs.push(discardIdx);
                                        } else if (mode == CMD_MODE.RandomPileCard) { // 弃置牌库中随机一张牌
                                            const disIdx = this._randomInt(pile.length - 1);
                                            discards.push(clone(pile[disIdx]));
                                            discardIdxs.push(disIdx);
                                        }
                                    }
                                    --discardCnt;
                                }
                            }
                        }
                    }
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds, discards);
                    this._doCmds(cpidx, ncmds);
                    if (discards.length > 0) {
                        const isDiscardHand = mode == CMD_MODE.Random || mode == CMD_MODE.AllHandCards ||
                            mode == CMD_MODE.HighHandCard || mode == CMD_MODE.LowHandCard || ohidxs ||
                            (card != undefined && (!(card instanceof GICard) || card.entityId != -1));
                        if (isDiscard) {
                            playerInfo.discardCnt += discards.length;
                            playerInfo.discardIds.push(...discards.map(c => c.id));
                        }
                        const cardNames = discards.map(c => `[${c.name}]【(${c.entityId})】`).join('');
                        handCards.forEach(c => discards.some(dc => dc.entityId == c.entityId) && (c.UI.class = 'discard'));
                        if (isDiscardHand) { // 舍弃手牌
                            discards.forEach(dc => UI.willDiscard.hcards.push(dc));
                            handCards.filter(dc => discards.map(c => c.entityId).includes(dc.entityId)).forEach(c => {
                                c.UI.class = 'will-discard-hcard-my';
                            });
                        } else { // 舍弃牌库中的牌
                            UI.willDiscard.pile.push(...clone(pile.filter((_, dcidx) => discardIdxs.includes(dcidx))));
                            assign(pile, pile.filter((_, dcidx) => !discardIdxs.includes(dcidx)));
                        }
                        UI.willDiscard.isNotPublic = mode != CMD_MODE.IsPublic && isAttach;
                        this._writeLog(`[${name}](${cpidx})${isDiscard ? '舍弃了' : '被夺取了'}${cardNames}`, isCdt(isAttach, 'system'));
                        const getcard = clone(UI.willDiscard.hcards);
                        await this.emit('discard', cpidx);
                        assign(handCards, handCards.filter(dc => !discards.map(c => c.entityId).includes(dc.entityId)));
                        handCards.forEach((c, ci) => c.cidx = ci);
                        UI.willDiscard = { hcards: [], pile: [], isNotPublic: false };
                        if (!isAttach) {
                            if (isDiscard) this._doDiscard(cpidx, discards, { isFromPile: !isDiscardHand, isPriority, isUnshift });
                            else this._doCmds(cpidx ^ 1, [{ cmd: 'getCard', cnt, card: getcard, mode: CMD_MODE.IsPublic }], { trigger, isPriority: true, isUnshift: true });
                        }
                    }
                }, { delayAfter: 1500, isImmediate, isPriority, isUnshift });
            } else if (cmd == 'getDice') {
                this.taskQueue.addTask(`doCmd--getDice-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    let elements: DiceCostType[] = [];
                    if (mode == CMD_MODE.Random) { // 随机骰子
                        if (this.version.isOffline) { // 随机可重复骰子
                            for (let i = 0; i < cnt; ++i) elements.push(this._randomInArr(Object.values(DICE_COST_TYPE))[0]);
                        } else { // 随机不重复基础骰子
                            elements.push(...this._randomInArr(Object.values(PURE_ELEMENT_TYPE), cnt));
                        }
                    } else if (mode == CMD_MODE.FrontHero) { // 当前出战角色(或者前后,用hidxs[0]控制)
                        const element = heros.getFront({ offset: ohidxs?.[0] }).element as PureElementType;
                        elements.push(...Array.from({ length: cnt }, () => element));
                    }
                    const nel = (element as DiceCostType | undefined) ?? elements;
                    this._writeLog(`[${name}](${cpidx})获得${cnt}个骰子【p${cpidx}:${(Array.isArray(nel) ? nel : new Array<DiceCostType>(cnt).fill(nel)).map(e => `[${ELEMENT_NAME[e]?.replace('元素', '')}]`).join('')}】`);
                    assign(dice, this._getDice(cpidx, cnt, nel));
                    for (let i = 0; i < cnt; ++i) {
                        this._detectHero(cpidx ^ 1, 'getdice-oppo', { types: STATUS_TYPE.Usage, source, hidxs: this.players[cpidx ^ 1].hidx });
                    }
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'getEnergy') {
                this.taskQueue.addTask(`doCmd--getEnergy-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    heros.forEach((h, hi) => {
                        if (h.hp > 0 && (hidxs == undefined && h.isFront || hidxs?.includes(hi))) {
                            if (h.maxEnergy > 0 != isAttach) {
                                if ((cnt > 0 && Math.abs(h.energy) < Math.abs(h.maxEnergy)) || (cnt < 0 && Math.abs(h.energy) > 0)) {
                                    const pcnt = isAttach ?
                                        Math.max(h.energy, Math.min(h.energy - h.maxEnergy, cnt)) :
                                        Math.max(-h.energy, Math.min(h.maxEnergy - h.energy, cnt));
                                    h.energy += pcnt * (isAttach ? -1 : 1);
                                    if (pcnt != 0) {
                                        this._writeLog(`[${name}](${cpidx})[${h.name}]${pcnt > 0 ? '获得' : '失去'}${Math.abs(pcnt)}点${isAttach ? ELEMENT_NAME[h.skills.find(s => s.type == SKILL_TYPE.Burst)?.cost[2].type ?? COST_TYPE.Energy] : '充能'}`);
                                    }
                                }
                            }
                        }
                    });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'reroll') {
                if (dice.length == 0) continue;
                this.taskQueue.addTask(`doCmd--reroll-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    cplayer.phase = PHASE.DICE;
                    cplayer.rollCnt = cnt;
                    UI.showRerollBtn = true;
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'changeDice') {
                this.taskQueue.addTask(`doCmd--changeDice-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const nel = (mode == CMD_MODE.FrontHero ? heros.getFront().element : element ?? DICE_COST_TYPE.Omni) as DiceCostType;
                    let ndice = dice.slice();
                    const diceCnt = arrToObj(DICE_WEIGHT, 0);
                    ndice.forEach(d => ++diceCnt[d]);
                    const effDice = (d: DiceCostType) => d == DICE_COST_TYPE.Omni ? 2 : +heros.map(h => h.element).includes(d);
                    ndice = objToArr(diceCnt)
                        .sort((a, b) => effDice(a[0]) - effDice(b[0]) || a[1] - b[1] || DICE_WEIGHT.indexOf(a[0]) - DICE_WEIGHT.indexOf(b[0]))
                        .flatMap(([d, cnt]) => new Array<DiceCostType>(cnt).fill(d));
                    const changedDice: DiceCostType[] = [];
                    for (let i = 0; i < Math.min(cnt || ndice.length, ndice.length); ++i) {
                        if (ndice[i] == DICE_COST_TYPE.Omni || ndice[i] == nel) continue;
                        changedDice.push(ndice[i]);
                        ndice[i] = nel;
                    }
                    if (changedDice.length == 0) return;
                    this._writeLog(`[${name}](${cpidx})将${cnt || ndice.length}个骰子【p${cpidx}:${changedDice.map(d => `[${ELEMENT_NAME[d].replace('元素', '')}]`).join('')}】变为[${ELEMENT_NAME[nel].replace('元素', '')}]`);
                    assign(dice, ndice);
                    assign(dice, this._rollDice(cpidx));
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'changeCard') {
                this.taskQueue.addTask(`doCmd--changeCard-p${cpidx}:${trigger}`, async () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    cplayer.phase = PHASE.CHANGE_CARD;
                    await this.emit(cmd, pidx, { notPreview: true, notUpdate: true, socket });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'getStatus') {
                this.taskQueue.addTask(`doCmd--getStatus-p${cpidx}:${trigger}`, () => {
                    if (heros.frontHidx == -1) return;
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const getsts = this._getStatusById(stsargs);
                    const ast: ArrayStatus[] = new Array(handCards.length).fill(0).map(() => new ArrayStatus());
                    const pst: ArrayStatus[] = new Array(pile.length).fill(0).map(() => new ArrayStatus());
                    const hst: ArrayStatus[] = new Array(heros.length).fill(0).map(() => new ArrayStatus());
                    const cst: ArrayStatus = new ArrayStatus();
                    const chidxs: number[] = [];
                    getsts.forEach(sts => {
                        switch (sts.group) {
                            case STATUS_GROUP.heroStatus:
                                ((isOppo ? ohidxs : hidxs) ?? [heros.frontHidx]).forEach(fhidx => hst[fhidx].push(sts));
                                break;
                            case STATUS_GROUP.combatStatus:
                                cst.push(sts);
                                break;
                            case STATUS_GROUP.attachment:
                                const isHandcard = mode != CMD_MODE.RandomPileCard;
                                let cdidxs = pile.map((_, i) => i);
                                if (mode == CMD_MODE.HighHandCard || mode == CMD_MODE.LowHandCard) {
                                    cdidxs = [];
                                    let restCnt = cnt;
                                    let hcardsSorted = clone(handCards).sort((a, b) =>
                                        (b.currDiceCost - a.currDiceCost) * (mode == CMD_MODE.HighHandCard ? 1 : -1) || (b.entityId - a.entityId));
                                    while (hcardsSorted.length > 0) {
                                        const cost = hcardsSorted[0].currDiceCost;
                                        const costCards = hcardsSorted.filter(c => c.currDiceCost == cost);
                                        cdidxs.push(...this._randomInArr(costCards, restCnt).map(c => c.cidx));
                                        if (cdidxs.length == cnt) break;
                                        restCnt -= cdidxs.length;
                                        hcardsSorted = hcardsSorted.filter(c => c.currDiceCost != cost);
                                    }
                                } else if (isHandcard) {
                                    cdidxs = handCards.map(c => c.cidx);
                                }
                                if (chidxs.length == 0) chidxs.push(...this._randomInArr(cdidxs, cnt || 1));
                                ((isOppo ? ohidxs : hidxs) ?? chidxs).forEach(cdidx => (isHandcard ? ast : pst)[cdidx].push(sts));
                                break;
                            default:
                                const e: never = sts.group;
                                throw new Error(`ERROR@_doCmds_getStatus: unknown statusType: ${e}`);
                        }
                    });
                    for (let hcidx = 0; hcidx < handCards.length; ++hcidx) {
                        if (ast[hcidx].length == 0) continue;
                        this._updateStatus(cpidx, ast[hcidx], handCards[hcidx].attachments, { hidx: hcidx });
                    }
                    for (let pcidx = 0; pcidx < pile.length; ++pcidx) {
                        if (pst[pcidx].length == 0) continue;
                        this._updateStatus(cpidx, pst[pcidx], pile[pcidx].attachments, { hidx: -pcidx });
                    }
                    for (let dhidx = 0; dhidx < heros.length; ++dhidx) {
                        const fhidx = (heros.frontHidx + dhidx) % heros.length;
                        const fhero = heros[fhidx];
                        if (hst[fhidx].length == 0) continue;
                        if (fhero.hp <= 0 && mode == CMD_MODE.IsPriority) {
                            hst[(fhidx + 1) % heros.length].push(...hst[fhidx]);
                        } else {
                            this._updateStatus(cpidx, hst[fhidx], fhero.heroStatus, { hidx: fhidx });
                        }
                    }
                    if (cst.length) this._updateStatus(cpidx, cst, cplayer.combatStatus);
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'getSummon') {
                this.taskQueue.addTask(`doCmd--getSummon-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    this._updateSummon(cpidx, this._getSummonById(smnargs), { destroy: mode })
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'getSupport') {
                this.taskQueue.addTask(`doCmd--getSupport-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    this._getSupportById(smnargs as number | (number | [number, ...any[]])).forEach(support => {
                        if (!cplayer.supports.isFull) {
                            cplayer.supports.push(support.setEntityId(this._genEntityId()));
                            this._detectSupport(cpidx, 'enter', { cSupport: support });
                        }
                    });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'destroySummon') {
                this.taskQueue.addTask(`doCmd--destroySummon-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    if (!this.preview.isExec) return this.taskQueue.stopPreview();
                    if (smnargs) {
                        const smnIds = convertToArray(smnargs);
                        this._randomInArr(summons.filter((smn, suidx) => smnIds.includes(smn.id) || smnIds.includes(suidx) || smnIds.includes(smn.entityId)), cnt)
                            .forEach(smn => smn.dispose());
                    } else {
                        this._randomInArr(summons, cnt).forEach(smn => smn.dispose());
                    }
                    this._updateSummon(cpidx, [], { destroy: mode })
                }, { isImmediate, isPriority, isUnshift });
            } else if (['heal', 'revive', 'addMaxHp', 'attack'].includes(cmd)) {
                damageCmds.addCmds(cmds[i]);
            } else if (cmd == 'changeSummon') {
                this.taskQueue.addTask(`doCmd--changeSummon-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const osummon = summons[ohidxs?.[0] ?? -1] ?? summons.find(s => s.id == ohidxs?.[0]);
                    if (!osummon) return;
                    const nsummon = this.newSummon(cnt, osummon.useCnt).setEntityId(osummon.entityId);
                    const suidx = getObjIdxById(summons, osummon.id);
                    summons.splice(suidx, 1, nsummon);
                    if (!this.preview.isExec) {
                        nsummon.UI.willChange = true;
                        this.preview.changedSummons[cpidx][suidx] = nsummon;
                    }
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'changePattern') {
                if (hidxs == undefined) throw new Error('hidxs is undefined');
                this.taskQueue.addTask(`doCmd--changePattern-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const newPattern = this.newHero(cnt);
                    const { id, entityId, heroStatus: chsts, hp, isFront, hidx, attachElement, talentSlot, relicSlot, weaponSlot, vehicleSlot, energy } = clone(heros[hidxs[0]]);
                    assign(heros[hidxs[0]], newPattern);
                    heros[hidxs[0]].id = id;
                    heros[hidxs[0]].entityId = entityId;
                    assign(heros[hidxs[0]].heroStatus, chsts);
                    heros[hidxs[0]].hp = hp;
                    heros[hidxs[0]].isFront = isFront;
                    heros[hidxs[0]].hidx = hidx;
                    assign(heros[hidxs[0]].attachElement, attachElement);
                    heros[hidxs[0]].talentSlot = talentSlot;
                    heros[hidxs[0]].relicSlot = relicSlot;
                    heros[hidxs[0]].weaponSlot = weaponSlot;
                    heros[hidxs[0]].vehicleSlot = vehicleSlot;
                    heros[hidxs[0]].energy = energy;
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'getSkill') {
                if (hidxs == undefined) throw new Error('ERROR@_doCmds-getSkill: hidxs is undefined');
                this.taskQueue.addTask(`doCmd--getSkill-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    heros[hidxs[0]].skills.splice(mode, 0, this.newSkill(cnt));
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'loseSkill') {
                if (hidxs == undefined) throw new Error('ERROR@_doCmds-loseSkill: hidxs is undefined');
                this.taskQueue.addTask(`doCmd--loseSkill-p${cpidx}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    heros[hidxs[0]].skills.splice(mode, 1);
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'attach') {
                this.taskQueue.addTask(`doCmd--attach-p${cpidx}:${trigger}`, async () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const damageVO = INIT_DAMAGEVO(this.players.flatMap(p => p.heros).length);
                    (ohidxs ?? [heros.frontHidx]).forEach((hidx, hi) => {
                        const attachEl = (Array.isArray(element) ? element[hi] : element ?? this.players[pidx].heros.getFront().element) as ElementType;
                        const { elTips, atriggers, etriggers } = this._calcDamage(pidx, attachEl, [], hidx, { isAttach: true, isAtkSelf: +!isOppo, skill, atkId: source });
                        elTips.forEach((et, eti) => et[0] != '' && (damageVO.elTips[eti] = [...et]));
                        this.preview.triggers[cpidx].forEach((trgs, tri) => etriggers[tri].forEach(t => trgs.add(t)));
                        this.preview.triggers[cpidx ^ 1].forEach((trgs, tri) => atriggers[tri].forEach(t => trgs.add(t)));
                        const phidx = hidx + cpidx * this.players[0].heros.length;
                        this._writeLog(`[${this.players[pidx].name}](${pidx})[${(skill ? this.players[pidx].heros.getFront().name : atkname)?.replace(/\(\-\d+\)/, '')}]对[${this.players[pidx ^ +!!isOppo].name}](${pidx ^ +!isOppo})[${this.players[pidx ^ +!!isOppo].heros[hidx].name}]附着${ELEMENT_NAME[attachEl]}${elTips[phidx][0] ? `（${elTips[phidx][0]}）` : ''}`)
                    });
                    await this.emit('attach', cpidx, { socket, damageVO });
                    if (damageVO.elTips.some(([t]) => t != '')) await this.delay(2e3);
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'pickCard') {
                this.taskQueue.addTask(`doCmd--pickCard-p${cpidx}:${trigger}`, async () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    let cardIds: number[] = [];
                    if (isAttach) {
                        for (let i = 0; i < cnt; ++i) {
                            const cardsIdPool = this._getCardIds(c => cardFilter?.(c, i));
                            cardIds.push(this._randomInArr(cardsIdPool)[0]);
                        }
                    } else {
                        const cardsIdPool = this._getCardIds(cardFilter);
                        cardIds = this._randomInArr((card ? card as number[] : cardsIdPool), cnt);
                    }
                    this.pickModal.phase = this.players[pidx].phase;
                    this.pickModal.hidxs = hidxs;
                    if (mode == CMD_MODE.GetCard || mode == CMD_MODE.UseCard) {
                        this.pickModal.cardType = mode == CMD_MODE.GetCard ? 'getCard' : 'useCard';
                        this.pickModal.cards = cardIds.map(c => this.newCard(c));
                    } else if (mode == CMD_MODE.GetSummon) {
                        this.pickModal.cardType = 'getSummon';
                        this.pickModal.cards = cardIds.map(c => {
                            const card = NULL_CARD();
                            const summon = this.newSummon(c);
                            card.id = summon.id;
                            card.UI = { ...summon.UI, cnt: 1 };
                            card.name = summon.name;
                            return card;
                        });
                    } else {
                        throw new Error('ERROR@_doCmds-pickCard: mode is undefined');
                    }
                    this.players[pidx].phase = PHASE.PICK_CARD;
                    this._writeLog(`[${cplayer.name}]在(${cpidx})${this.pickModal.cards.map(c => `[${c.name}]`).join('')}中进行挑选`, 'system');
                    await this.emit(`pickCard-cmdidx${i}`, cpidx);
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'equip') {
                if (!card) throw new Error('ERROR@_doCmds-equip: card is undefined');
                this.taskQueue.addTask(`doCmd--equip-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    (ohidxs ?? [heros.frontHidx]).forEach(hidx => {
                        this._doEquip(pidx, heros[hidx], card as Card | number);
                    });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'exchangePos') {
                const [h1 = -1, h2 = -1] = ohidxs ?? [];
                if (h1 == -1 || h2 == -1) throw new Error('ERROR@_doCmds-exchangePos: hidxs is undefined');
                this.taskQueue.addTask(`doCmd--exchangePos-h${h1}-h${h2}:${trigger}`, async () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    [heros[h1], heros[h2]] = [heros[h2], heros[h1]];
                    heros[h1].hidx = h1;
                    heros[h2].hidx = h2;
                    if (heros[h1].isFront) cplayer.hidx = h1;
                    if (heros[h2].isFront) cplayer.hidx = h2;
                    await this.emit('exchangePos', cpidx);
                }, { delayAfter: 600, isImmediate, isPriority, isUnshift });
            } else if (cmd == 'exchangeHandCards') {
                this.taskQueue.addTask(`doCmd--exchangeHandCards-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const hcards = [...handCards];
                    const ehcards = [...copponent.handCards];
                    assign(handCards, ehcards);
                    assign(copponent.handCards, hcards);
                    for (const hcard of handCards) {
                        this._emitEvent(cpidx, 'getcard', { types: STATUS_TYPE.Usage, hidxs: heros.allHidxs(), hcard });
                    }
                    for (const hcard of copponent.handCards) {
                        this._emitEvent(cpidx ^ 1, 'getcard', { types: STATUS_TYPE.Usage, hidxs: copponent.heros.allHidxs(), hcard });
                    }
                    this._writeLog('双方交换了手牌');
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'consumeNightSoul') {
                const hidx = ohidxs?.[0] ?? heros.frontHidx;
                this.taskQueue.addTask(`doCmd--consumeNightSoul-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const { isInvalid } = this._emitEvent(cpidx, 'pre-consumeNightSoul', { types: STATUS_TYPE.Usage, restDmg: cnt, hidxs: heros.allHidxs(), sourceHidx: hidx });
                    if (isInvalid) return;
                    const nightSoul = heros[hidx].heroStatus.get(STATUS_TYPE.NightSoul);
                    if (!nightSoul) return;
                    nightSoul.minusUseCnt(cnt);
                    this._detectHero(pidx, 'consumeNightSoul', { types: STATUS_TYPE.Usage, sourceHidx: hidx, source: nightSoul?.id });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'getNightSoul') {
                const hidx = ohidxs?.[0] ?? heros.frontHidx;
                this.taskQueue.addTask(`getNightSoul-p${cpidx}-h${hidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const nightSoul = heros[hidx].heroStatus.get(STATUS_TYPE.NightSoul);
                    if (!nightSoul) return;
                    const ocnt = nightSoul.useCnt;
                    nightSoul.addUseCnt(cnt);
                    this._writeLog(`[${name}](${cpidx})[${heros[hidx].name}]获得${cnt}点「夜魂值」${ocnt}→${nightSoul.useCnt}`);
                    this._detectHero(pidx, 'getNightSoul', {
                        types: [STATUS_TYPE.Usage, STATUS_TYPE.Attack],
                        source: nightSoul.id,
                        sourceHidx: hidx,
                    });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'consumeDice') {
                if (!ohidxs || ohidxs.length == 0) continue;
                const ncmds = new CmdsGenerator();
                callback?.(ncmds);
                this._doCmds(cpidx, ncmds);
                if (ohidxs[0] < 0) {
                    const pdices = getSortedDices(dice);
                    assign(dice, pdices.slice(-ohidxs[0]));
                    assign(dice, this._rollDice(cpidx, dice.map(() => false)));
                } else {
                    assign(dice, dice.filter((_, i) => !ohidxs[i]));
                }
            } else if (cmd == 'convertCard') {
                const [eid = -1, cid = -1] = ohidxs ?? [];
                this.taskQueue.addTask(`doCmd--convertCard-p${cpidx}-${eid}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const cidx = handCards.findIndex(c => c.entityId == eid);
                    const ncard = this.newCard(cid).setEntityId(eid);
                    ncard.attachments = new ArrayStatus(handCards[cidx].attachments.slice());
                    handCards.splice(cidx, 1, ncard);
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'summonTrigger' && ohidxs) {
                const cSummon = mode == CMD_MODE.ByOrder ? cplayer.summons :
                    mode == CMD_MODE.Random ? this._randomInArr(cplayer.summons, ohidxs?.[0]) :
                        ohidxs.map(sid => cplayer.summons[sid] ?? cplayer.summons.find(s => s.id == sid || s.entityId == sid)).filter(v => !!v);
                if (mode == CMD_MODE.Random && !this.preview.isExec) return this.taskQueue.stopPreview();
                this.taskQueue.addTask(`doCmd--summonTrigger-p${cpidx}:${trigger}(${cmdtrg})`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    this._detectSummon(cpidx, cmdtrg ?? 'phase-end', { cSummon, source });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'adventure') {
                this.taskQueue.addTask(`doCmd--adventure-p${cpidx}:${trigger}`, () => {
                    const ncmds = new CmdsGenerator();
                    callback?.(ncmds);
                    this._doCmds(cpidx, ncmds);
                    const adventure = cplayer.supports.has(CARD_SUBTYPE.Adventure);
                    const canAdventure = adventure || !cplayer.supports.isFull;
                    if (!adventure) {
                        this._doCmds(cpidx, CmdsGenerator.ins.pickCard(3, CMD_MODE.UseCard, { subtype: CARD_SUBTYPE.Adventure, }), { isImmediate: true });
                    }
                    if (canAdventure) this._emitEvent(cpidx, 'adventure', { types: STATUS_TYPE.Usage });
                }, { isImmediate, isPriority, isUnshift });
            } else if (cmd == 'addUseSummon') {
                const eid = ohidxs![0];
                const smn = summons.find(s => s.id == eid || s.entityId == eid) ?? summons[eid];
                smn.addUseCnt(cnt || 1, true);
                this._detectSummon(cpidx, 'summon-usecnt-add', { cSummon: smn });
            }
        }
        doDamage();
    }
    /**
     * 重置预览变量
     */
    private _resetPreview() {
        this.preview = {
            isValid: true,
            isExec: true,
            willAttachs: this.players.map(p => p.heros.map(() => [])),
            isQuickAction: false,
            hpChange: this.players.map(p => p.heros.map(() => 0)),
            summonChange: [],
            supportChange: [],
            changedSummons: this.players.map(() => Array.from({ length: MAX_SUMMON_COUNT }, () => undefined)),
            willSwitch: this.players.map(p => p.heros.map(() => false)),
            tarHidx: -1,
            triggers: this.players.map(p => p.heros.map(() => new Set())),
        }
        this.taskQueue.init();
    }
    // 把预览差别解析出来的函数
    private _calcPreview(oplayers: Player[]) {
        const willHp = oplayers.map((p, pi) => {
            return p.heros.map((h, hi) => {
                const type = this.preview.hpChange[pi][hi];
                const chero = this.players[pi].heros[hi];
                if (type < 0) return type - h.hp; // 超杀
                if (type == 3) return chero.hp - h.hp - 0.3; // 复活
                if (chero.hp != h.hp || type == 1) return Math.max(0, chero.hp) - h.hp; // 有变化
                if (type == 0) return undefined; // 无变化
                return 100; // 回血+0
            });
        }).flat();
        const energyCnt = oplayers.map((p, pi) => {
            return p.heros.map((h, hi) => {
                return Math.abs(this.players[pi].heros[hi].energy) - Math.abs(h.energy);
            });
        });
        let energyIcons: EnergyIcons[][] | undefined;
        if (energyCnt.some(v => v.some(v => v != 0))) {
            energyIcons = oplayers.map((p, pi) => {
                return p.heros.map((h, hi) => {
                    return h.updateEnergyIcon(h, Math.abs(this.players[pi].heros[hi].energy) - Math.abs(h.energy));
                });
            });
        }
        const changedHeros = oplayers.map((p, pi) => {
            const cheros = this.players[pi].heros;
            return p.heros.map(h => {
                const cSrc = cheros.get(h.entityId)?.UI.src;
                if (h.UI.src == cSrc) return undefined;
                return cSrc;
            });
        });
        const willSummons = oplayers.map((p, pi) => {
            return this.players[pi].summons.filter(wsmn => p.summons.every(s => s.entityId != wsmn.entityId))
                .map(wsmn => {
                    const [nsmn = wsmn] = this._getSummonById(wsmn.handle(wsmn, { pidx: pi, ...this.handleEvent }).willSummon);
                    nsmn.UI.isWill = true;
                    return nsmn;
                });
        });
        const summonCnt = oplayers.map((p, pi) => {
            const csummons = this.players[pi].summons;
            return p.summons.map(osmn => {
                const csmn = csummons.get(osmn.entityId);
                if (!csmn) return -100;
                return csmn.useCnt - osmn.useCnt + +(this.preview.summonChange.includes(osmn.entityId));
            });
        });
        const supportCnt = oplayers.map((p, pi) => {
            const csupport = this.players[pi].supports;
            return p.supports.map(ospt => {
                const cspt = csupport.get(ospt.entityId);
                if (!cspt) return -100;
                return cspt.useCnt - ospt.useCnt + +(this.preview.supportChange.includes(ospt.entityId));
            });
        });
        return { willHp, willSummons, summonCnt, energyIcons, supportCnt, changedHeros }
    }
    /**
     * 预览技能效果
     * @param pidx 玩家序号
     * @returns 预览结果
     */
    private async _previewSkill(pidx: number) {
        const curRandom = this._random;
        const curPlayers = clone(this.players);
        const curEntityIdIdx = this.entityIdIdx;
        const previews: Preview[] = [];
        const hero = curPlayers[pidx].heros.getFront();
        if (!hero) return previews;
        const { skills, energy, heroStatus } = hero;
        const heroSkills = skills.filter(sk => !sk.isPassive);
        if (hero.vehicleSlot) heroSkills.unshift(hero.vehicleSlot[1]);
        const isWaiting = curPlayers[pidx].status == PLAYER_STATUS.WAITING;
        const isNonAction = heroStatus.has(STATUS_TYPE.NonAction);
        this._resetPreview();
        for (const skill of heroSkills) {
            const { dice, summons, heros } = this.players[pidx];
            const summonCanSelect: boolean[][] = this.players.map(() => new Array(MAX_SUMMON_COUNT).fill(false));
            const heroCanSelect: boolean[] = this.players[pidx].heros.map(h => h.hp > 0);
            let skillForbidden = true;
            const summonSelects: number[] = [];
            const heroSelects: number[] = heros.allHidxs();
            const isLen = skill.cost[0].cnt + skill.cost[1].cnt - skill.costChange[0] - skill.costChange[1] > dice.length;
            const isElDice = (skill.cost[0].type != DICE_TYPE.Same ?
                dice.filter(d => d == DICE_COST_TYPE.Omni || d == skill.cost[0].type).length :
                dice.filter(d => d == DICE_COST_TYPE.Omni).length + Math.max(0, ...Object.values(dice.reduce((a, c) => {
                    if (c != DICE_COST_TYPE.Omni) a[c] = (a[c] ?? 0) + 1;
                    return a;
                }, {} as Record<DiceCostType, number>)))) < skill.cost[0].cnt - skill.costChange[0];
            const isEnergy = skill.cost[2].cnt > 0 && skill.cost[2].cnt > (skill.cost[2].type == COST_TYPE.Energy ? energy : -energy);
            const needSelectSmn = skill.canSelectSummon != -1 && summons.length == 0;
            const skillres = skill.handle({ pidx, ...this.handleEvent, skill });
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
            const selects = [...summonSelects.map(s => ['smn', s]), ...heroSelects.map(h => ['hero', h])] as [string, number][];
            if (selects.length == 0) selects.push(['default', -1]);
            const cplayers = clone(this.players);
            const crandom = this._random;
            const cEntityIdIdx = this.entityIdIdx;
            for (const [tag, selectItem] of selects) {
                this.preview.isExec = false;
                const diceSelect = this._checkSkill(pidx, skill.id, skill.isForbidden);
                await this._useSkill(pidx, skill.id, { selectSummon: selectItem, diceSelect });
                await this._execTask();
                const { willHp, willSummons, summonCnt, energyIcons, supportCnt, changedHeros } = this._calcPreview(curPlayers);
                const preview: Preview = {
                    type: ACTION_TYPE.UseSkill,
                    isValid: !skill.isForbidden,
                    skillId: skill.id,
                    diceSelect,
                    willHp,
                    willAttachs: clone(this.preview.willAttachs),
                    willSummonChange: summonCnt,
                    willSupportChange: supportCnt,
                    willSummons,
                    changedSummons: clone(this.preview.changedSummons),
                    changedHeros,
                    willSwitch: this.preview.willSwitch,
                    energyIcons,
                    summonCanSelect,
                    heroCanSelect,
                    summonIdx: isCdt(tag == 'smn', selectItem),
                    heroIdxs: isCdt(tag == 'hero', [selectItem]),
                    tarHidx: this.preview.tarHidx,
                }
                previews.push(preview);
                assign(this.players, clone(cplayers));
                this._random = crandom;
                this.entityIdIdx = cEntityIdIdx;
                this._resetPreview();
            }
            assign(this.players, clone(curPlayers));
            this._random = curRandom;
            this.entityIdIdx = curEntityIdIdx;
            this._resetPreview();
        }
        return previews;
    }
    /**
     * 预览使用卡牌效果
     * @param pidx 玩家序号
     * @returns 预览结果
     */
    private async _previewCard(pidx: number) {
        const curRandom = this._random;
        const curPlayers = clone(this.players);
        const curEntityIdIdx = this.entityIdIdx;
        const previews: Preview[] = [];
        const { handCards } = curPlayers[pidx];
        this._resetPreview();
        for (const cidx in handCards) {
            this.preview.isExec = false;
            const { canSelectHero, canSelectSummon, canSelectSupport, type } = handCards[cidx];
            const { heros, hidx, supports } = this.players[pidx];
            const { isValid: diceValid, diceSelect, heroCanSelect = [] } = this._checkCard(pidx, +cidx);
            const heroSelects: number[][] = [];
            const heroCanSelects: boolean[][] = [];
            const heroSwitchIdx: number[] = [];
            const heroSkillId: number[] = [];
            if (canSelectHero > 0 && diceValid) {
                const hidxWeight = (n: number) => (n + heros.length - hidx) % heros.length;
                const heroIdxs = heroCanSelect.map((v, i) => ({ v, i })).filter(v => v.v).map(v => v.i)
                    .sort((a, b) => hidxWeight(a) - hidxWeight(b));
                for (const hidxi of heroIdxs) {
                    heroSelects.push([hidxi]);
                    const { heroCanSelect: csh, switchIdx: swidx = -1, skillId = -1 }
                        = this._checkCard(pidx, +cidx, { heroIdx: hidxi });
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
            if (heroSelects.length == 0 || canSelectHero > 1) heroSelects.unshift([]);
            for (const heroSelect of heroSelects) {
                this.preview.isExec = false;
                let isValid = diceValid && canSelectHero == heroSelect.length && canSelectSummon == -1 && canSelectSupport == -1;
                const supportCanSelect: boolean[][] = this.players.map(() => new Array(MAX_SUPPORT_COUNT).fill(false));
                const summonCanSelect: boolean[][] = this.players.map(() => new Array(MAX_SUMMON_COUNT).fill(false));
                const isSupportAvalible = isValid;
                if (type == CARD_TYPE.Support) {
                    const isAvalible = !supports.isFull;
                    isValid &&= isAvalible;
                    if (isSupportAvalible && !isAvalible) supportCanSelect[1].fill(true);
                }
                if (canSelectSummon != -1) summonCanSelect[canSelectSummon].fill(true);
                if (canSelectSupport != -1) supportCanSelect[canSelectSupport].fill(true);
                let hCanSelect = [...heroCanSelect];
                if (heroSelect.length > 0 && canSelectHero == 2) {
                    hCanSelect = heroCanSelects[heroSelect[0]];
                }
                if (isValid) {
                    await this._useCard(pidx, +cidx, diceSelect, { selectHeros: heroSelect });
                    await this._execTask();
                }
                const { willHp, willSummons, summonCnt, energyIcons, supportCnt, changedHeros } = this._calcPreview(curPlayers);
                const preview: Preview = {
                    willSupportChange: supportCnt,
                    type: ACTION_TYPE.UseCard,
                    willHp,
                    willSwitch: this.preview.willSwitch,
                    isValid,
                    diceSelect,
                    cardIdxs: [+cidx],
                    heroIdxs: heroSelect,
                    heroCanSelect: hCanSelect,
                    supportCanSelect,
                    summonCanSelect,
                    willSummons,
                    willSummonChange: summonCnt,
                    changedHeros,
                    changedSummons: clone(this.preview.changedSummons),
                    willAttachs: clone(this.preview.willAttachs),
                    energyIcons,
                }
                const isSupportMax = isSupportAvalible && !isValid;
                const needSelectSupport = canSelectSupport != -1 && this.players[+(canSelectSupport == pidx)].supports.length;
                if (isSupportMax || needSelectSupport) {
                    const pcnt = isSupportMax ? MAX_SUPPORT_COUNT : this.players[+(canSelectSupport == pidx)].supports.length;
                    for (let i = 0; i < pcnt; ++i) {
                        previews.push({
                            ...preview,
                            isValid: canSelectSupport == -1 || diceValid,
                            supportIdx: i,
                        });
                    }
                } else if (canSelectSummon != -1 && this.players[+(canSelectSummon == pidx)].summons.length) {
                    assign(this.players, clone(curPlayers));
                    this._random = curRandom;
                    this.entityIdIdx = curEntityIdIdx;
                    this._resetPreview();
                    for (let i = 0; i < this.players[+(canSelectSummon == pidx)].summons.length; ++i) {
                        this.preview.isExec = false;
                        this._checkCard(pidx, +cidx, { summonIdx: i });
                        await this._useCard(pidx, +cidx, diceSelect, { selectHeros: heroSelect, selectSummon: i });
                        await this._execTask();
                        const { willHp, willSummons, summonCnt, energyIcons, supportCnt, changedHeros } = this._calcPreview(curPlayers);
                        previews.push({
                            willSupportChange: supportCnt,
                            type: ACTION_TYPE.UseCard,
                            willHp,
                            willSwitch: this.preview.willSwitch,
                            diceSelect,
                            cardIdxs: [+cidx],
                            heroIdxs: heroSelect,
                            heroCanSelect: hCanSelect,
                            supportCanSelect,
                            summonCanSelect,
                            willSummons,
                            willSummonChange: summonCnt,
                            changedHeros,
                            changedSummons: clone(this.preview.changedSummons),
                            willAttachs: clone(this.preview.willAttachs),
                            energyIcons,
                            isValid: diceValid,
                            summonIdx: i,
                        });
                        assign(this.players, clone(curPlayers));
                        this._random = curRandom;
                        this.entityIdIdx = curEntityIdIdx;
                        this._resetPreview();
                    }
                } else {
                    previews.push(preview);
                }
                assign(this.players, clone(curPlayers));
                this._random = curRandom;
                this.entityIdIdx = curEntityIdIdx;
                this._resetPreview();
            }
            this.preview.isExec = false;
            // 调和的预览
            const { isValid, diceSelect: recondice } = this._checkCard(pidx, +cidx, { isReconcile: true });
            const preview: Preview = {
                type: ACTION_TYPE.Reconcile,
                isValid,
                cardIdxs: [+cidx],
                diceSelect: recondice,
            }
            previews.push(preview);
            assign(this.players, clone(curPlayers));
            this._random = curRandom;
            this.entityIdIdx = curEntityIdIdx;
            this._resetPreview();
        }
        return previews;
    }
    /**
     * 预览切换角色效果
     * @param pidx 玩家序号
     * @returns 预览结果
     */
    private async _previewSwitch(pidx: number) {
        const curRandom = this._random;
        const curPlayers = clone(this.players);
        const curEntityIdIdx = this.entityIdIdx;
        const previews: Preview[] = [];
        const hidxs = curPlayers[pidx].heros.getBackHidxs();
        this._resetPreview();
        for (const toHidx of hidxs) {
            this.preview.isExec = false;
            const { hidx, dice, heros } = this.players[pidx];
            const { switchHeroDiceCnt } = this._calcHeroSwitch(pidx, toHidx, hidx);
            const diceSelect = dice.map(() => false);
            const isValid = dice.length >= switchHeroDiceCnt;
            if (isValid) {
                for (let i = dice.length - 1, cnt = switchHeroDiceCnt; i >= 0 && cnt > 0; --i, --cnt) {
                    diceSelect[i] = true;
                }
            }
            await this._switchHero(pidx, toHidx, 'switch-preview', { diceSelect });
            await this._execTask();
            const { willHp, energyIcons, supportCnt, willSummons } = this._calcPreview(curPlayers);
            const preview: Preview = {
                type: ACTION_TYPE.SwitchHero,
                heroIdxs: [toHidx],
                isValid,
                diceSelect,
                switchHeroDiceCnt,
                heroCanSelect: heros.map(h => hidxs.includes(h.hidx)),
                willHp,
                willSwitch: this.preview.willSwitch,
                energyIcons,
                willSupportChange: supportCnt,
                willSummons,
                willAttachs: clone(this.preview.willAttachs),
                isQuickAction: this.preview.isQuickAction,
            }
            previews.push(preview);
            assign(this.players, clone(curPlayers));
            this._random = curRandom;
            this.entityIdIdx = curEntityIdIdx;
            this._resetPreview();
        }
        return previews;
    }
    /**
     * 更新状态
     * @param pidx 玩家序号
     * @param nStatus 新状态
     * @param oStatus 原状态
     * @param options.hidx 角色序号
     * @param options.ohidx 旧附魔角色
     * @param options.isLog 是否记录日志（用于更新召唤物状态时不显示在日志中）
     * @param options.isAddAtkStsTask 是否添加协同攻击状态任务（用于螃蟹吃白术盾）
     * @returns 合并后状态
     */
    private _updateStatus(pidx: number, nStatus: Status[] | ArrayStatus, oStatus: ArrayStatus, options: {
        isLog?: boolean, hidx?: number, ohidx?: number, isAddAtkStsTask?: boolean,
    } = {}) {
        const newStatus = clone(nStatus);
        const { name, combatStatus, heros, hidx: phidx, pile, handCards } = this.players[pidx];
        const { isLog = true, hidx = phidx, ohidx, isAddAtkStsTask } = options;
        const handleEvent = { pidx, ...this.handleEvent };
        const updateAttachEl = (ahidx: number, stype: StatusGroup, sts?: Status[]) => {
            if (stype > STATUS_GROUP.combatStatus) return;
            const hero = heros[ahidx];
            const [attachElSts] = [
                ...((stype == STATUS_GROUP.heroStatus && sts ? sts : hero.heroStatus).filter(s => s.hasType(STATUS_TYPE.Enchant) && (s.useCnt != 0 && s.roundCnt != 0))),
                ...((stype == STATUS_GROUP.combatStatus && sts ? sts : hero.hidx == phidx ? combatStatus : []).filter(s => s.hasType(STATUS_TYPE.Enchant) && (s.useCnt != 0 && s.roundCnt != 0))),
            ];
            const attachEl: ElementType = attachElSts?.handle(attachElSts, { ...handleEvent, hidx: ahidx })?.attachEl ?? DAMAGE_TYPE.Physical;
            for (const skill of hero.skills) {
                if (!skill.isHeroSkill || skill.isPassive || skill.dmgElement != DAMAGE_TYPE.Physical || skill.attachElement == attachEl) continue;
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
                    oStatus[cstIdx].variables = cStatus.variables;
                    oStatus[cstIdx] = clone(sts).setEntityId(oStatus[cstIdx].entityId);
                    oStatus[cstIdx].setUseCnt(Math.max(oStatus[cstIdx].useCnt, cStatus.useCnt));
                } else { // 可叠加
                    cStatus.maxCnt = sts.maxCnt;
                    cStatus.setPerCnt(sts.perCnt);
                    let oCnt = -1;
                    let nCnt = -1;
                    if (cStatus.roundCnt > -1 && cStatus.useCnt == -1) {
                        oCnt = cStatus.roundCnt;
                        cStatus.addRoundCnt(cStatus.addCnt);
                        nCnt = cStatus.roundCnt;
                    } else {
                        cStatus.roundCnt = sts.roundCnt;
                    }
                    if (cStatus.useCnt > -1) {
                        oCnt = cStatus.useCnt;
                        cStatus.addUseCnt(sts.addCnt);
                        nCnt = cStatus.useCnt;
                    } else {
                        cStatus.setUseCnt(sts.useCnt);
                    }
                    this._writeLog(`[${name}](${pidx})${sts.group == STATUS_GROUP.heroStatus ? `[${heros[hidx].name}]` : ''}[${sts.name}]【(${cStatus.entityId})】 ${oCnt}→${nCnt}`);
                }
            } else { // 新附属状态
                sts.setEntityId(this._genEntityId());
                this._detectHero(pidx, 'enter', { types: STATUS_TYPE.Usage, cStatus: sts, hidxs: [hidx], source: sts.id });
                const { isInvalid } = this._detectHero(pidx, 'pre-get-status', {
                    types: [STATUS_TYPE.Usage, STATUS_TYPE.Attack],
                    hidxs: heros.allHidxs(),
                    source: sts.id,
                    sourceHidx: hidx,
                    sourceStatus: sts,
                });
                if (isInvalid) return;
                oStatus.push(sts);
                const stsGroup = [`[${heros[hidx]?.name}]附属角色`, '生成出战', `卡牌【p${pidx}${(hidx < 0 ? pile : handCards)[Math.abs(hidx)]?.name}】附着效果`][sts.group];
                this._writeLog(`[${name}](${pidx})${stsGroup}状态[${sts.name}]【(${sts.entityId})】`, isCdt(sts.hasType(STATUS_TYPE.Hide) || !isLog, 'system'));
                const stsres = sts.handle(sts, { ...handleEvent, hidx });
                if (sts.hasType(STATUS_TYPE.Enchant)) updateAttachEl(hidx, sts.group, oStatus);
                if (stsres.onlyOne) {
                    heros.some((h, hi) => {
                        if (hi == hidx) return false;
                        const idx = getObjIdxById(h.heroStatus, sts.id);
                        if (idx > -1) h.heroStatus.splice(idx, 1);
                        return idx > -1;
                    });
                }
            }
            const trigger = sts.hasType(STATUS_TYPE.ReadySkill) ? 'ready-skill' : 'get-status';
            this._detectHero(pidx, trigger, {
                types: [STATUS_TYPE.Usage, STATUS_TYPE.Attack],
                hidxs: heros.allHidxs(),
                source: sts.id,
                sourceHidx: hidx,
                sourceStatus: sts,
            });
            this._detectSupport(pidx, trigger, { source: sts.id, sourceStatus: sts });
            this._detectHero(pidx ^ 1, 'get-status-oppo', {
                hidxs: this.players[pidx ^ 1].heros.allHidxs(),
                source: sts.id,
                sourceHidx: hidx,
                sourceStatus: sts,
            });
        });
        oStatus.forEach(sts => {
            if (sts.hasType(STATUS_TYPE.Enchant)) {
                const stsres = sts.handle(sts, { ...handleEvent, hidx });
                if (stsres.isUpdateAttachEl || ohidx != undefined || sts.isDestroy) {
                    if (ohidx != undefined) updateAttachEl(ohidx, sts.group);
                    updateAttachEl(hidx, sts.group);
                }
            }
        });
        assign(oStatus, oStatus.sort((a, b) => +b.hasType(STATUS_TYPE.NightSoul) - +a.hasType(STATUS_TYPE.NightSoul) || Math.sign(a.summonId) - Math.sign(b.summonId))
            .filter(sts => {
                const isStsAtk = isAddAtkStsTask && sts.useCnt == 0 && sts.hasType(STATUS_TYPE.Attack) && !sts.hasType(STATUS_TYPE.Accumulate);
                if ((sts.isDestroy || isStsAtk) && sts.entityId != STATUS_DESTROY_ID) this._doStatusDestroy(pidx, sts, hidx);
                return !sts.isDestroy;
            }));
    }
    /**
     * 更新召唤物
     * @param pidx 玩家序号
     * @param nSummon 新召唤物
     * @param options.isSummon 是否是召唤物生成的新召唤物
     * @param options.trigger 触发时机
     * @param options.destroy 是否检测销毁该entityId召唤物(0为不销毁,1为检测全部召唤物)
     * @returns 合并后召唤物
     */
    private _updateSummon(pidx: number, nSummon: Summon[] | ArraySummon, options: {
        isSummon?: number, destroy?: number, trigger?: Trigger,
    } = {}) {
        const { summons, combatStatus, hidx, heros, name } = this.players[pidx];
        const newSummon: Summon[] = clone(nSummon);
        const oriSummon: Summon[] = clone(summons);
        const { isSummon = -1, destroy = 0, trigger } = options;
        const generateSummonEntityIds: number[] = [];
        newSummon.forEach(smn => {
            let csmnIdx = oriSummon.findIndex(osm => osm.id == smn.id);
            const oriSmn = oriSummon[csmnIdx];
            if (csmnIdx > -1 && oriSmn.isTalent != smn.isTalent) { // 如果召唤物是否带有天赋不同，则重新附属
                oriSummon.splice(csmnIdx, 1);
                csmnIdx = oriSmn.entityId;
                this._doSummonDestroy(pidx, oriSmn);
            }
            let csummon: Summon = oriSummon[csmnIdx];
            let isGenerate = true;
            if (csmnIdx > -1) { // 重复生成召唤物
                const ocnt = oriSummon[csmnIdx].useCnt;
                oriSummon[csmnIdx].variables = smn.variables;
                oriSummon[csmnIdx].setUseCnt(Math.max(oriSmn.useCnt, smn.useCnt, Math.min(oriSmn.maxUse, oriSmn.useCnt + smn.useCnt)));
                oriSummon[csmnIdx].setPerCnt(smn.perCnt);
                oriSummon[csmnIdx].damage = smn.damage;
                if (ocnt < oriSummon[csmnIdx].useCnt) this._detectSummon(pidx, 'summon-usecnt-add', { cSummon: oriSummon[csmnIdx] });
            } else if (oriSummon.filter(smn => smn.isDestroy != SUMMON_DESTROY_TYPE.Used || smn.useCnt != 0).length < MAX_SUMMON_COUNT) { // 召唤区未满才能召唤
                csummon = smn.setEntityId(csmnIdx == -1 ? this._genEntityId() : csmnIdx);
                oriSummon.push(csummon);
                this._detectSummon(pidx, 'enter', { cSummon: smn });
                this._writeLog(`[${name}](${pidx})召唤[${smn.name}]【(${smn.entityId})】`);
            } else isGenerate = false;
            if (isGenerate) generateSummonEntityIds.push(csummon.entityId);
        });
        if (isSummon > -1) assign(summons, oriSummon);
        else {
            assign(summons, oriSummon.filter(smn => {
                if (smn.statusId > 0) { // 召唤物有关联状态
                    const nSmnStatus = this.newStatus(smn.statusId);
                    const group = nSmnStatus.group;
                    const statuses = [heros[hidx].heroStatus, combatStatus][group];
                    let smnStatus = statuses.find(sts => sts.id == smn.statusId);
                    if (smnStatus || smn.useCnt > 0) {
                        smnStatus ??= nSmnStatus;
                        smnStatus.setUseCnt(smn.useCnt);
                        this._updateStatus(pidx, this._getStatusById([smnStatus]), statuses, { hidx, isLog: false });
                    }
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
                        combatSts.dispose();
                        this._updateStatus(pidx, [], combatStatus);
                    } else {
                        for (let i = 0; i < heros.length; ++i) {
                            const hi = (hidx + i) % heros.length;
                            const heroSts = heros[hi].heroStatus.find(sts => sts.summonId == smn.id);
                            if (heroSts) {
                                heroSts.dispose();
                                this._updateStatus(pidx, [], heros[hi].heroStatus, { hidx: hi });
                                break;
                            }
                        }
                    }
                    this._doSummonDestroy(pidx, smn);
                    return false;
                }
                return true;
            }));
        }
        generateSummonEntityIds.forEach(eid => {
            const sourceSummon = summons.get(eid);
            this._detectHero(pidx, 'summon-generate', { types: STATUS_TYPE.Usage, sourceSummon });
            this._detectSupport(pidx, 'summon-generate', { sourceSummon });
        });
    }
    /**
     * 开始计时
     */
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
        if (!this.preview.isExec) return 0;
        let winnerIdx = -1;
        this.players.forEach((p, i) => {
            const isLose = p.heros.every(h => h.hp <= 0);
            if (isLose) {
                if (winnerIdx == -1) winnerIdx = i ^ 1;
                else winnerIdx = -2;
            }
        });
        if (winnerIdx != -1) {
            this.winner = -3; // 标记游戏结束停止所有结算
            this.taskQueue.init();
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
            p.playerInfo = { ...INIT_PLAYER().playerInfo };
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
        this.taskQueue.stopPreview();
        this.emit('game-end', winnerIdx);
    }
    /**
     * 执行任务
     * @param stopWithTaskType 任务类型为此时不执行
     */
    private async _execTask(stopWithTaskType: string = '#') {
        try {
            if (this.taskQueue.isExecuting && !this.taskQueue.canExecTask || this.taskQueue.isTaskEmpty()) return;
            this.taskQueue.isExecuting = true;
            const canExec = () => !this.taskQueue.isTaskEmpty() && !this.hasDieSwitch &&
                (this.taskQueue.isExecuting || this.taskQueue.canExecTask) &&
                !this.taskQueue.isDieWaiting && this.players.every(p => p.phase != PHASE.PICK_CARD);
            while (canExec()) {
                const [[peekTaskType]] = this.taskQueue.peekTask();
                if (peekTaskType.includes(stopWithTaskType)) break;
                const [[taskType, args]] = this.taskQueue.getTask();
                if (taskType == 'not found' || !taskType || !args) break;
                if (this.taskQueue.isTaskEmpty()) this.taskQueue.canExecTask = true;
                await this.taskQueue.execTask(taskType, args as [() => void, number?, number?][], this.preview.isExec);
            }
            this.taskQueue.isExecuting = false;
            this.taskQueue.canExecTask = false;
            if (this.players.some(p => p.phase == PHASE.PICK_CARD) && !this.preview.isExec) {
                this.pickModal.cards = [];
                return this.taskQueue.stopPreview();
            }
            if (stopWithTaskType != 'pickCard') {
                await this.wait(() => this.players.every(p => p.phase != PHASE.PICK_CARD) && this.pickModal.cards.length == 0, { maxtime: 6e6 });
            }
            if (canExec()) await this._execTask();
        } catch (e) {
            const error: Error = e as Error;
            console.error(error);
            this.emitError(error);
        }
    }
    /**
    * 计算技能的变化伤害和骰子消耗
    * @param pidx 玩家序号
    * @param options.hidx 角色序号
    * @param options.skid 使用的技能id
    */
    private _calcSkillChange(pidx: number, options: { hidx?: number, skid?: number } = {}) {
        if (!this.isStart || this.phase < PHASE.ACTION_START) return;
        const player = this.players[pidx];
        const { skid = -1, hidx = player.hidx } = options;
        const { heros, combatStatus } = player;
        const curHero = heros[hidx];
        if (!curHero) throw new Error(`ERROR@_calcSkillChange: hero not found\n pidx:${pidx},hidx:${hidx},skid:${skid},heros:[${heros.map(h => heroToString(h))}]`);
        const skills = [...curHero.skills.filter(sk => !sk.isPassive)];
        if (curHero.vehicleSlot) skills.unshift(curHero.vehicleSlot[1]);
        const skill = skid == -1 ? null : skills.find(s => s.type == skid || s.id == skid) ?? this.newSkill(skid);
        const genSkillArr = <T>(item: T) => curHero.skills.map(() => clone(item));
        const dmgChange = genSkillArr(0);
        const costChange: [number, number, number[], number[][]][] = genSkillArr([0, 0, [], []]);
        const mds = skills.map(sk => sk.cost.slice(0, 2).map(v => v.cnt));
        const handleEvent = { pidx, ...this.handleEvent };
        for (const sts of [...curHero.heroStatus, ...(player.hidx == hidx ? player.combatStatus : [])]) {
            const stsres = sts.handle(sts, { ...handleEvent, trigger: 'calc' });
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
            if (skill?.isReadySkill) {
                dmgChange[0] += (res.addDmg ?? 0) + (res[`addDmgType${skill.type}`] ?? 0);
            } else {
                dmgChange.forEach((_, i, a) => {
                    const curSkill = curHero.skills[i];
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
                const curSkill = curHero.skills[i];
                if (curSkill.isPassive) return;
                for (let j = 0; j < 3; ++j) {
                    if (j == 0 && elDice != undefined && curSkill.cost[0].type != elDice) {
                        skill[1] += skill[0];
                        continue;
                    }
                    const change = skill[j] + (res.minusDiceSkill?.[`skilltype${curSkill.type}`]?.[j] ?? 0) + (mskills[i]?.[j] ?? 0);
                    if (change > 0) costChangeList[i][j].push([entityId, change]);
                }
            });
        }
        skills.forEach(curSkill => {
            const skillres = curSkill.handle({
                ...handleEvent,
                skill: curSkill,
                hero: curHero,
                hidx,
                trigger: 'calc',
            });
            calcCostChange(skillres, curSkill.id);
        });
        const heroField = [...heros[hidx].heroFields, ...isCdt(hidx == player.hidx, combatStatus, [])];
        for (const hfield of heroField) {
            const fieldres = hfield.handle(hfield as any, {
                ...handleEvent,
                hidx,
                hero: curHero,
                trigger: 'calc',
            });
            calcDmgChange(fieldres);
            calcCostChange(fieldres, hfield.entityId);
        }
        for (let i = 1; i < player.heros.length; ++i) {
            const hi = (player.hidx + i) % player.heros.length;
            for (const hfield of heros[hi].heroFields) {
                const fieldres = hfield.handle(hfield as any, {
                    ...handleEvent,
                    hidx,
                    hero: curHero,
                    trigger: 'calc',
                });
                if (!fieldres.triggers?.some(trg => trg.startsWith('other'))) continue;
                calcCostChange(fieldres, hfield.entityId, true);
            }
        }
        player.summons.forEach(smn => {
            const smnres = smn.handle(smn, {
                ...handleEvent,
                trigger: 'calc',
            });
            calcDmgChange(smnres);
            calcCostChange(smnres, smn.entityId);
        });
        player.supports.forEach(support => {
            const sptres = support.handle(support, { ...handleEvent, trigger: 'calc' });
            calcCostChange(sptres, support.entityId);
        });
        if (skill?.isReadySkill) {
            skill.dmgChange = dmgChange[0];
            return skill;
        }
        for (let i = 0; i < curHero.skills.length; ++i) {
            const curSkill = curHero.skills[i];
            curSkill.dmgChange = dmgChange[i];
            if (curSkill.isPassive) break;
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
        return skill;
    }
    /**
     * 计算卡牌的变化骰子消耗
     * @param pidx 玩家索引
     */
    private _calcCardChange(pidx: number) {
        if (!this.isStart || this.phase < PHASE.ACTION_START) return;
        const player = this.players[pidx];
        if (!player) return;
        const { handCards, heros, combatStatus, summons, supports } = player;
        const costChange = handCards.map(() => [0, 0, 0]);
        const curHero = heros.getFront();
        if (!curHero) return;
        const handleEvent = { pidx, ...this.handleEvent }
        handCards.forEach((c, ci) => {
            const currCostChange = () => costChange[ci].reduce((a, b) => a + b);
            const getMinusDiceCard = <T extends {
                handle: (entity: any, event: InputHandle<Partial<EntityHandleEvent>>) =>
                    { minusDiceCard?: number, minusDiceCardEl?: ElementType }
            }>(entity: T, hidx: number) => {
                const { minusDiceCard = 0, minusDiceCardEl } = entity.handle(entity, {
                    ...handleEvent,
                    hidx,
                    hcard: c,
                    minusDiceCard: currCostChange(),
                    isMinusDiceTalent: c.userType == heros[hidx].id,
                });
                return { minusDiceCard, minusDiceCardEl }
            }
            c.attachments.forEach(att => {
                const { minusDiceCard = 0, addDiceCard = 0, cardDiceType } = att.handle(att, {
                    ...handleEvent,
                    hcard: c,
                    minusDiceCard: currCostChange(),
                });
                costChange[ci][2] += minusDiceCard - addDiceCard;
                if (cardDiceType == undefined) delete c.variables.cardDiceType;
            });
            heros.allHidxs().forEach(hidx => {
                for (const hfield of [...heros[hidx].heroFields, ...isCdt(hidx == heros.frontHidx, combatStatus, [])]) {
                    const { minusDiceCard, minusDiceCardEl } = getMinusDiceCard(hfield, hidx);
                    costChange[ci][+!!(minusDiceCardEl && minusDiceCardEl != c.costType)] += minusDiceCard;
                }
            });
            summons.forEach(smn => {
                costChange[ci][0] += smn.handle(smn, {
                    ...handleEvent,
                    minusDiceCard: currCostChange(),
                })?.minusDiceCard ?? 0;
            });
            const lastSupport: Support[] = [];
            supports.forEach(spt => {
                const { minusDiceCard = 0, isLast } = spt.handle(spt, {
                    ...handleEvent,
                    hcard: c,
                    minusDiceCard: currCostChange(),
                });
                if (isLast) lastSupport.push(spt);
                else costChange[ci][0] += minusDiceCard;
            });
            lastSupport.forEach(spt => {
                costChange[ci][0] += spt.handle(spt, {
                    ...handleEvent,
                    hcard: c,
                    minusDiceCard: currCostChange(),
                })?.minusDiceCard ?? 0;
            });
            c.handle(c, { pidx, ...this.handleEvent, trigger: 'hcard-calc' });
        });
        handCards.forEach((c, i) => {
            c.costChanges[2] = costChange[i][2];
            c.costChanges[0] = Math.min(c.currDiceCost, costChange[i][0]);
            c.costChanges[1] = Math.min(c.anydice, costChange[i][1]);
        });
    }
    /**
     * 计算切换角色所需骰子及是否速切
     * @param pidx 玩家索引
     * @param tohidx 切换后的角色索引
     * @param fromhidx 切换前的角色索引
     */
    private _calcHeroSwitch(pidx: number, tohidx: number, fromhidx: number) {
        let { switchHeroDiceCnt } = this._detectHero(pidx, ['add-switch', 'add-switch-from'], { types: STATUS_TYPE.Usage, hidxs: fromhidx, switchHeroDiceCnt: INIT_SWITCH_HERO_DICE });
        ({ switchHeroDiceCnt } = this._detectHero(pidx, 'add-switch-to', { types: STATUS_TYPE.Usage, hidxs: tohidx, switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectSummon(pidx, 'add-switch', { switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectSupport(pidx, 'add-switch', { switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectSummon(pidx ^ 1, 'add-switch-oppo', { switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectHero(pidx, 'minus-switch-from', { types: [STATUS_TYPE.Usage, STATUS_TYPE.Attack], hidxs: fromhidx, switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectHero(pidx, 'minus-switch-to', { types: STATUS_TYPE.Usage, hidxs: tohidx, switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectHero(pidx, 'minus-switch', { switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectSummon(pidx, 'minus-switch', { switchHeroDiceCnt }));
        ({ switchHeroDiceCnt } = this._detectSupport(pidx, 'minus-switch', { switchHeroDiceCnt }));
        return { switchHeroDiceCnt }
    }
    /**
     * 是否未触发
     * @param triggers 触发组
     * @param trigger 触发值
     * @returns 是否未触发
     */
    private _hasNotTriggered(triggers: Trigger[] | undefined, trigger: Trigger) {
        return (triggers ?? []).every(tr => tr != trigger && tr != trigger.split(':')[0]);
    }
    /**
     * 根据id和参数获取状态数组
     * @param statusArgs 状态的id及参数
     * @returns 状态数组
     */
    private _getStatusById(statusArgs?: (number | [number, ...any] | Status)[] | number): ArrayStatus {
        const args = statusArgs == undefined ? [] : typeof statusArgs == 'number' ? [statusArgs] : statusArgs;
        return new ArrayStatus(...args.map(stsargs => {
            if (Array.isArray(stsargs) || typeof stsargs == 'number') {
                return this.newStatus(...convertToArray(stsargs) as [number, ...any]);
            }
            return stsargs;
        }).filter(sts => sts.id > 0));
    }
    /**
     * 根据id和参数获取召唤物数组
     * @param summonArgs 状态的id及参数
     * @returns 状态数组
     */
    private _getSummonById(summonArgs: (number | [number, ...any] | Summon)[] | number | undefined): ArraySummon {
        const args = summonArgs == undefined ? [] : typeof summonArgs == 'number' ? [summonArgs] : summonArgs;
        return new ArraySummon(...args.map(smnargs => {
            if (Array.isArray(smnargs) || typeof smnargs == 'number') {
                return this.newSummon(...convertToArray(smnargs) as [number, ...any]);
            }
            return smnargs;
        }));
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
                return this.newSupport(...convertToArray(sptargs) as [number, ...any]);
            }
            return sptargs;
        });
    }
    /**
     * 按条件获取卡牌id数组
     * @param filter 筛选条件
     * @returns 卡牌id数组
     */
    private _getCardIds(filter: (cards: Card) => any = () => true): number[] {
        return cardsTotal(this.version.value, { ignoreInPool: true }).filter(filter).map(card => card.id);
    }
}
