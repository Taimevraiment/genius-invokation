import * as fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, Socket } from 'socket.io';
import {
    ACTION_TYPE, CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CMD_MODE, COST_TYPE, CardSubtype, DAMAGE_TYPE, DICE_COST_TYPE, DICE_TYPE, DamageType,
    DiceCostType, ELEMENT_TYPE, ELEMENT_TYPE_KEY, ElementType, PHASE, PLAYER_STATUS, PURE_ELEMENT_CODE, PURE_ELEMENT_CODE_KEY, PURE_ELEMENT_TYPE, PURE_ELEMENT_TYPE_KEY,
    Phase, PureElementCode, PureElementType, SKILL_TYPE, STATUS_GROUP, STATUS_TYPE, SUMMON_DESTROY_TYPE, SkillType, StatusGroup, StatusType, Version,
} from '../../common/constant/enum.js';
import {
    DECK_CARD_COUNT, INIT_DICE_COUNT, INIT_HANDCARDS_COUNT, INIT_ROLL_COUNT, INIT_SWITCH_HERO_DICE, MAX_DICE_COUNT,
    MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT, PLAYER_COUNT, SHUFFLE_COUNT,
} from '../../common/constant/gameOption.js';
import { INIT_PLAYER } from '../../common/constant/init.js';
import { ELEMENT_NAME, SKILL_TYPE_NAME } from '../../common/constant/UIconst.js';
import { CardHandleRes, newCard, parseCard } from '../../common/data/cards.js';
import { newHero, parseHero, readySkill } from '../../common/data/heros.js';
import { StatusHandleRes, newStatus } from '../../common/data/statuses.js';
import { SummonHandleRes, newSummon } from '../../common/data/summons.js';
import { allHidxs, checkDices, getAtkHidx, getBackHidxs, getNearestHidx } from '../../common/utils/gameUtil.js';
import { arrToObj, clone, delay, isCdt, objToArr, parseShareCode, wait } from '../../common/utils/utils.js';
import {
    ActionData, Card, Cmds, Countdown, DamageVO, Hero, MinuDiceSkill, Player, Preview, ServerData, Status, StatusTask,
    Summon, Support, TrgSkType, Trigger,
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
    previews: Preview[][] = [[], []]; // 预览
    log: string[] = []; // 当局游戏的日志
    countdown: Countdown = { limit: 0, curr: 0, timer: undefined }; // 倒计时
    newStatus: (id: number, ...args: any) => Status;
    newCard: (id: number, ...args: any) => Card;
    newHero: (id: number) => Hero;
    newSummon: (id: number, ...args: any) => Summon;
    private _currentPlayerIdx: number = 0; // 当前回合玩家 currentPlayerIdx
    private _random: number = 0; // 随机数

    constructor(io: Server, id: number, name: string, version: Version, password: string, countdown: number) {
        this.io = io;
        this.id = id;
        this.name = name || `房间${id}`;
        this.version = version;
        this.password = password;
        this.countdown.limit = countdown;
        this.newStatus = newStatus(version);
        this.newCard = newCard(version);
        this.newHero = newHero(version);
        this.newSummon = newSummon(version);
    }
    get currentPlayerIdx() {
        return this._currentPlayerIdx;
    }
    set currentPlayerIdx(val: number) {
        this._currentPlayerIdx = (val + PLAYER_COUNT) % PLAYER_COUNT;
    }
    private _serverDataVO(pidx: number, tip: string | string[], previews: Preview[][]) {
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
                    pile: [],
                    dice: [],
                    handCards: [],
                }
            }),
            previews: previews[pidx],
            ...(typeof tip != 'string' ? { tip: tip[pidx] } :
                tip.includes('{p}') ? { tip: tip.replace(/{p}/, pidx == this.currentPlayerIdx ? '你的' : '对方') } : {}),
        }
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
     * @param len 随机数最大值
     * @returns 随机整数
     */
    private _randomInt(len: number = 1) {
        this._random = (this._random * 13 + 29) % 1e10;
        return Math.floor(this._random % 1e6 / 1e6 * (len + 1));
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
    private _writeLog(str: string, isOnlySystem: boolean = false) {
        if (!isOnlySystem) this.log.push(str.replace(/{[^{}]+}/g, ''));
        fs.appendFile(`${__dirname}/../../../logs/${this.seed}.log`, str.replace(/{|}/g, '') + '\n', err => {
            if (err) return console.error('err:', err);
        });
    }
    /**
     * 获取预览
     * @param pidx 玩家序号
     */
    private _getPreview(pidx: number) {
        const previews: Preview[] = [];
        previews.push(...this._previewSkill(pidx));
        previews.push(...this._previewCard(pidx));
        previews.push(...this._previewSwitch(pidx));
        return previews;
    }
    emit(flag: string, pidx: number, options: {
        socket?: Socket, tip?: string | string[], actionInfo?: string, damageVO?: DamageVO, notPreview?: boolean
    } = {}) {
        const { socket, tip = '', actionInfo = '', damageVO = null, notPreview = false } = options;
        const previews: Preview[][] = new Array(PLAYER_COUNT).fill(0).map(() => []);
        this._clacCardChange(pidx);
        if (this.phase == PHASE.ACTION && !notPreview) { // 计算预测行动的所有情况
            this.players.forEach(p => previews[p.pidx] = this._getPreview(p.pidx));
        }
        this.previews = previews;
        const serverData: ServerData = {
            players: this.players.map(p => ({ ...p, pile: [] })),
            previews: [],
            phase: this.phase,
            isStart: this.isStart,
            round: this.round,
            currCountdown: this.countdown.curr,
            log: this.log,
            pileCnt: this.players.map(p => p.pile.length),
            diceCnt: this.players.map(p => p.dice.length),
            handCardsCnt: this.players.map(p => p.handCards.length),
            damageVO,
            tip: typeof tip == 'string' ? tip : '',
            actionInfo,
            isWin: this.winner,
            flag: `[${this.id}]${flag}-p${pidx}`,
        };
        if (socket) {
            socket.emit('getServerInfo', Object.freeze({
                ...serverData,
                ...this._serverDataVO(pidx, tip, previews),
            }));
        } else {
            this.io.to(`7szh-${this.id}`).emit('getServerInfo', Object.freeze(serverData));
            this.players.forEach(p => {
                this.io.to(`7szh-${this.id}-p${p.pidx}`).emit('getServerInfo', Object.freeze({
                    ...serverData,
                    ...this._serverDataVO(p.pidx, tip, previews),
                }));
            });
        }
    }
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
        this.emit(`player[${player.name}] enter room.`, pidx);
        return player;
    }
    start(pidx: number, flag: string) {
        this.seed = Math.floor(Math.random() * 1e10).toString();
        this._random = +this.seed;
        const d = new Date();
        const format = (n: number) => String(n).padStart(2, '0');
        console.info(`[${this.id}]start-seed:${this.seed}`);
        this.seed = `${d.getFullYear()}-${format(d.getMonth() + 1)}-${format(d.getDate())}-${format(d.getHours())}-${format(d.getMinutes())}-${format(d.getSeconds())}-` + this.seed;
        this.entityIdIdx = -500000;
        this.isStart = true;
        // this.currentPlayerIdx = this.players[1].id == 1 ? 0 : this._randomInt(PLAYER_COUNT);
        this.currentPlayerIdx = 1; // dev
        this.startIdx = this.currentPlayerIdx;
        this.phase = PHASE.CHANGE_CARD;
        this.round = 1;
        this.log = [];
        this.players.forEach(p => {
            p.phase = this.phase;
            p.heros.forEach((h, hidx) => {
                h.entityId = this._genEntityId();
                h.hidx = hidx;
            });
            p.supports = [];
            p.summons = [];
            p.dice = [];
            p.status = PLAYER_STATUS.WAITING;
            p.isUsedLengend = false;
            p.playerInfo.weaponTypeCnt = new Set(p.pile.filter(c => c.subType.includes(CARD_SUBTYPE.Weapon))).size;
            p.playerInfo.weaponCnt = p.pile.filter(c => c.subType.includes(CARD_SUBTYPE.Weapon)).length;
            p.playerInfo.artifactTypeCnt = new Set(p.pile.filter(c => c.subType.includes(CARD_SUBTYPE.Artifact))).size;
            p.playerInfo.artifactCnt = p.pile.filter(c => c.subType.includes(CARD_SUBTYPE.Artifact)).length;
            p.playerInfo.talentTypeCnt = new Set(p.pile.filter(c => c.subType.includes(CARD_SUBTYPE.Talent))).size;
            p.playerInfo.talentCnt = p.pile.filter(c => c.subType.includes(CARD_SUBTYPE.Talent)).length;
            p.playerInfo.initCardIds = [...new Set(p.pile.map(c => c.id))];
            for (let i = 0; i < SHUFFLE_COUNT; ++i) p.pile.sort(() => this._randomInt() - 0.5);
            for (let i = 0; i < INIT_HANDCARDS_COUNT; ++i) {
                const lengendIdx = p.pile.findIndex((c, ci) => ci >= i && c.subType.includes(CARD_SUBTYPE.Legend));
                if (lengendIdx == -1) break;
                [p.pile[i], p.pile[lengendIdx]] = [p.pile[lengendIdx], p.pile[i]];
            }
            p.handCards = p.pile.splice(0, INIT_HANDCARDS_COUNT).map(c => c.setEntityId(this._genEntityId()));
            p.UI.info = `${this.startIdx == p.pidx ? '我方' : '对方'}先手`;
            this._writeLog(p.handCards.reduce((a, c) => a += `[${c.name}]`, `[${p.name}]获得手牌`), true);
        });
        this.emit(flag, pidx);
    }
    /**
     * 获取行动
     * @param actionData 行动数据
     * @param socket 发送请求socket
     */
    getAction(actionData: ActionData, socket: Socket) {
        const { cpidx = this.currentPlayerIdx, deckIdx = -1, shareCode = '', cardIdxs = [], heroIdxs: [hidx, hidx2] = [],
            diceSelect = [], skillIdx = -1, summonIdx = -1, supportIdx = -1, flag = 'noflag' } = actionData;
        const player = this.players[cpidx];
        switch (actionData.type) {
            case ACTION_TYPE.StartGame:
                player.deckIdx = deckIdx;
                const { heroIds, cardIds } = parseShareCode(shareCode);
                if (heroIds.includes(0) || cardIds.length < DECK_CARD_COUNT) return this.emit('error', cpidx, { socket, tip: '当前出战卡组不完整' });
                player.heros = heroIds.map(parseHero);
                player.pile = cardIds.map(parseCard);
                if (player.heros.some(h => h.version > this.version) || player.pile.some(c => c.version > this.version)) return this.emit('error', cpidx, { socket, tip: '当前卡组版本不匹配' });
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
                this._chooseInitHero(cpidx, hidx, socket, flag);
                break;
            case ACTION_TYPE.Reroll:
                this._reroll(diceSelect, cpidx, socket, flag);
                break;
            case ACTION_TYPE.SwitchHero:
                this._switchHero(cpidx, hidx, socket, flag, diceSelect);
                break;
            case ACTION_TYPE.UseSkill:
                const useDices = player.dice.filter((_, di) => diceSelect[di]);
                const isValid = checkDices(useDices, { skill: player.heros[player.hidx].skills[skillIdx] });
                if (!isValid) this.emit('useSkillDiceInvalid', cpidx, { socket, tip: '骰子不符合要求', notPreview: true });
                else player.dice = player.dice.filter((_, di) => !diceSelect[di]);
                this._useSkill(cpidx, skillIdx);
                break;
            case ACTION_TYPE.UseCard:
                this._useCard(cpidx, cardIdxs[0], { selectHero: hidx, selectHero2: hidx2, selectSummon: summonIdx, selectSupport: supportIdx });
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
        attachs: { hidx: number, el: number, isAdd: boolean }[], disCardCnt: number, flag: string
    }) {
        const { cpidx, cmds, dices, attachs, hps, disCardCnt, clearSts, getSts, flag } = actionData;
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
                if (hidx >= heros.length) heros.forEach(h => h.heroStatus = []);
                else heros[hidx].heroStatus = [];
            }
            if (stsid == 0 || stsid == -2) {
                player.combatStatus = [];
            }
        }
        const stscmds: Cmds[] = [];
        for (const { hidxs, stsid } of getSts) {
            stscmds.push({ cmd: 'getStatus', status: [newStatus(this.version)(stsid)], hidxs });
        }
        if (dices) player.dice = dices;
        if (disCardCnt > 0) player.handCards = player.handCards.splice(0, disCardCnt);
        this._doCmds(cpidx, [...cmds, ...stscmds]);
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
        const idxPool: number[] = [];
        const genRanIdx = () => {
            let idx = -1;
            while (true) {
                idx = this._randomInt(player.pile.length - 1);
                if (!idxPool.includes(idx)) {
                    idxPool.push(idx);
                    return idx;
                }
            }
        }
        while (cardIdxs.length > 0) {
            const cardIdx = cardIdxs.shift()!;
            const ranIdx = genRanIdx();
            [player.handCards[cardIdx], player.pile[ranIdx]] = [player.pile[ranIdx], player.handCards[cardIdx]];
        }
        if (this.phase == PHASE.ACTION) {
            setTimeout(() => {
                player.phase = PHASE.ACTION;
                this.emit(flag + '-action', pidx);
            }, 1e3);
        } else {
            this._writeLog(player.handCards.reduce((a, c) => a + `[${c.name}]`, `[${player.name}]换牌后手牌为`), true);
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
                this._writeLog(player.dice.reduce((a, c) => a + `[${ELEMENT_NAME[c].replace(/元素/, '')}]`, `[${player.name}]初始骰子为`), true);
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
     * @param diceSelect 骰子数组, 如果为undefined则为被动切换
     */
    private _switchHero(pidx: number, hidx: number, socket: Socket | undefined, flag: string, diceSelect?: boolean[]) {
        // todo 切换角色要加入任务队列执行！！！
        this.taskQueue.addTask('switchHero', [() => { }, 1000])
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const dieChangeBack = ([PHASE.DIE_CHANGE_ACTION, PHASE.DIE_CHANGE_ACTION_END] as Phase[]).includes(player.phase);
        let isQuickAction = false;
        let switchHeroDiceCnt = 0;
        const cmds: Cmds[] = [];
        if (dieChangeBack) { // 被击倒后选择出战角色
            // isQuickAction ||= this.taskQueue.isQuickAction;
            const { isQuickAction: slotiqa } = this._detectSlot(pidx ^ 1, 'kill', { heros: opponent.heros, isQuickAction });
            isQuickAction ||= slotiqa;
            const { isQuickAction: stsiqa } = this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'kill', { isQuickAction, isOnlyFront: true });
            isQuickAction ||= stsiqa;
            const { cmds } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'killed', { hidxs: [player.hidx], hidx });
            this._doCmds(pidx, cmds);
            player.heros[player.hidx].heroStatus = player.heros[player.hidx].heroStatus.filter(sts => sts.hasType(STATUS_TYPE.NonDestroy));
            player.phase -= 3;
            const isOppoActioning = this.players[pidx ^ 1].phase == PHASE.ACTION;
            player.UI.info = isOppoActioning ? '对方行动中....' : '';
            const isActioning = player.phase == PHASE.ACTION;
            this.players[pidx ^ 1].UI.info = isActioning ? '对方行动中....' : '对方结束已结束回合...';
            if (isOppoActioning) this.players[this.currentPlayerIdx].canAction = true;
        } else { // 切换角色
            switchHeroDiceCnt = this._calcHeroSwitchDice(pidx, hidx, player.hidx, true);
            isQuickAction = this._detectSkill(pidx, 'change-from', { hidxs: player.hidx }).isQuickAction;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change', { hidxs: player.hidx, switchHeroDiceCnt }).switchHeroDiceCnt;
            const { isQuickAction: stsiqa, switchHeroDiceCnt: stschd } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-from', { isQuickAction, switchHeroDiceCnt, isOnlyFront: true });
            isQuickAction = stsiqa;
            switchHeroDiceCnt = stschd;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change-from', { hidxs: player.hidx, switchHeroDiceCnt }).switchHeroDiceCnt;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change', { hidxs: getBackHidxs(player.heros), switchHeroDiceCnt }).switchHeroDiceCnt;
            switchHeroDiceCnt = this._detectSlot(pidx, 'change-to', { hidxs: hidx, switchHeroDiceCnt }).switchHeroDiceCnt;
            const { cmds: supportcmd, isQuickAction: stiqa } = this._detectSupport(pidx, 'change', { isQuickAction, switchHeroDiceCnt, hidx });
            isQuickAction = stiqa;
            cmds.push(...supportcmd);
            const { switchHeroDiceCnt: needDices = INIT_SWITCH_HERO_DICE } = this.previews[pidx].find(pre => pre.type == ACTION_TYPE.SwitchHero && pre.heroIdxs![0] == hidx) ?? {};
            if (diceSelect?.filter(d => d).length != needDices) return this.emit('error', pidx, { socket, tip: '骰子不符合要求' })
            player.dice = player.dice.filter((_, i) => !(diceSelect?.[i] ?? true));
        }
        this._detectStatus(pidx, STATUS_TYPE.Attack, ['change-from', 'change-to'], { hidxs: [hidx], isQuickAction: isCdt(isQuickAction, 2) });
        this._doCmds(pidx, cmds);

        this._doActionAfter(pidx);
        this._changeTurn(pidx, isQuickAction, 'switchHero', dieChangeBack);
        this._writeLog(`[${player.name}]切换为[${player.heros[hidx].name}]出战${isQuickAction && !dieChangeBack ? '(快速行动)' : ''}`);
        this.emit(flag, pidx, { tip: isCdt(isQuickAction, '继续{p}回合') });
        this._doSwitchHeroAfter(pidx, hidx, player.hidx);
        // if (phase > PHASE.ACTION) {
        //     heros[hidx].inStatus.forEach(ist => {
        //         if (ist.roundCnt > 0) ++ist.roundCnt;
        //     });
        // }
        // if (changeFrom != undefined) {
        //     const noheros = this._updateStatus([], ncheros[hidx].outStatus, ncheros, -1, changeFrom).nheros ?? [];
        //     heros[changeFrom] = noheros[changeFrom];
        // }
    }
    /**
     * 切换角色后的处理
     * @param pidx 玩家序号
     * @param toHidx 切换到的角色序号
     * @param fromHidx 原出战角色序号
     */
    private _doSwitchHeroAfter(pidx: number, toHidx: number, fromHidx: number) {
        this.players[pidx].isFallAtk = true;
        this._detectSkill(pidx, 'change-to', { hidxs: fromHidx });
        this._detectStatus(pidx, STATUS_TYPE.ReadySkill, 'change-from', { hidxs: [fromHidx], isOnlyHeroStatus: true });
        this.players[pidx].hidx = toHidx;
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
            ++tmpDice[DICE_COST_TYPE.Omni]; // dev
            // ++tmpDice[this._randomInArr(Object.values(DICE_COST_TYPE))];
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
        if (player.rollCnt <= 0) return;
        player.dice = this._rollDice(pidx, diceSelect);
        this._writeLog(player.dice.reduce((a, c) => a + `[${ELEMENT_NAME[c].replace(/元素/, '')}]`, `[${player.name}]重投骰子后`), true);
        if (this.phase == PHASE.ACTION) { // 行动阶段重投
            setTimeout(() => {
                player.phase = PHASE.ACTION;
                player.rollCnt = INIT_ROLL_COUNT;
                this.emit(flag + '-action', pidx);
            }, 1e3);
        } else { // 每回合开始时重投
            if (--player.rollCnt <= 0) {
                player.UI.showRerollBtn = false;
                setTimeout(() => {
                    player.phase = PHASE.ACTION_START;
                    if (this.players.every(p => p.phase == PHASE.ACTION_START)) { // 双方都重投完骰子
                        this._doReset();
                        this._doPhaseStart(flag, pidx);
                    } else {
                        this.emit(flag, pidx, { socket });
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
    private _reconcile(pidx: number, diceSelect: boolean[], cardIdx: number, socket: Socket, flag: string) {
        if (diceSelect.indexOf(true) == -1) return this.emit('error', pidx, { socket, tip: '骰子不符合要求' });
        const player = this.players[pidx];
        const currCard = player.handCards[cardIdx];
        const reconcileDice = this._getFrontHero(pidx).element as DiceCostType;
        if (player.dice.every(d => d == DICE_COST_TYPE.Omni || d == reconcileDice)) return this.emit('error', pidx, { socket, tip: '没有可以调和的骰子' });
        if (currCard.hasTag(CARD_TAG.NonReconcile)) return this.emit('error', pidx, { socket, tip: '该卡牌不能调和' });
        this._detectStatus(pidx, STATUS_TYPE.Usage, 'reconcile', { card: currCard, isQuickAction: 2 });
        this._detectSupport(pidx, 'reconcile', { isQuickAction: true });
        player.dice = player.dice.map((d, di) => diceSelect[di] ? reconcileDice : d);
        player.dice = this._rollDice(pidx);
        player.handCards = player.handCards.filter((_, ci) => ci != cardIdx);
        ++player.playerInfo.reconcileCnt;
        this._writeLog(`[${player.name}]{将[${currCard.name}]}进行了调和`);
        this.emit(flag, pidx, { actionInfo: this.log.at(-1) });
    }
    /**
     * 检查选择技能的骰子是否合法
     * @param pidx 玩家序号
     * @param skidx 技能序号
     * @param isSwitch 切换的角色序号
     * @returns 选择骰子情况的数组
     */
    private _checkSkill(pidx: number, skidx: number, isSwitch: number = -1) {
        const player = this.players[pidx];
        const skill = this._calcSkillChange(pidx, player.hidx, { isSwitch, skidx });
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
     * @param skidx 选组技能的索引idx -1切换角色
     * @param options.isPreview 是否为预览
     * @param options.withCard 是否为使用卡
     * @param options.isSwitch 是否切换角色
     * @param options.isReadySkill 是否为准备技能
     * @param options.triggers 触发数组(出牌或切换角色时)
     */
    private _useSkill(pidx: number, skidx: number, options: { isPreview?: boolean, withCard?: Card, isSwitch?: number, isReadySkill?: boolean, otriggers?: Trigger | Trigger[] } = {}) {
        const { isPreview = false, withCard, isSwitch = -1, isReadySkill = false, otriggers = [] } = options;
        const isExec = !isPreview || isReadySkill;
        const mergeWillHeals = (oWillHeals: number[], resHeals?: number[]) => {
            if (!resHeals) return;
            resHeals.forEach((hl, hli) => {
                if (hl > -1) {
                    if (oWillHeals[hli] < 0) oWillHeals[hli] = hl;
                    else oWillHeals[hli] += hl;
                }
            });
        }
        const players = clone(this.players);
        const player = () => players[pidx];
        const opponent = () => players[pidx ^ 1];
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
        // const willSwitch = players.map(p => new Array(p.heros.length).fill(false));
        const hidx = isSwitch > -1 ? isSwitch : player().hidx;
        // 判断准备技能和切换角色的技能
        const skill = this._calcSkillChange(pidx, hidx, { readySkillId: isCdt(isReadySkill, skidx), isSwitch, skidx });
        const willDamagesPre: number[][] = players.flatMap(p => Array.from({ length: p.heros.length }, () => [-1, 0]));
        const willAttachPre: ElementType[][] = players.flatMap(p => Array.from({ length: p.heros.length }, () => []));
        const skillcmds: Cmds[] = [];
        const eskillcmds: Cmds[] = [];
        let isQuickAction = false;
        let switchAtkPre = 0;
        if (isSwitch > -1) { // 切换角色造成的攻击
            const changeTriggers: Trigger[] = ['change-from', 'change-to'];
            const { statusAtks } = this._detectStatus(pidx, STATUS_TYPE.Attack, changeTriggers, { isOnlyFront: true, isExec: false });
            switchAtkPre = statusAtks.length;
            if (statusAtks.length > 0 && !isExec) {
                for (let i = 0; i < switchAtkPre; ++i) {
                    const { entityId: stsId, group: stsType } = statusAtks[i];
                    const sts = [aHeros()[ahidx()].heroStatus, aCombatStatus()][stsType].find(sts => sts.entityId == stsId);
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
                                usedDice: skill.cost.reduce((a, b) => a + b.cnt, 0),
                                withCard: withCard,
                                minusDiceSkillIds: skill.costChange[2],
                            }
                        );
                        wdmg0.forEach((dmg, di) => {
                            willDamagesPre[di] = allHeros()[di].hp > 0 ? [...dmg] : [-1, 0];
                        });
                        for (let i = 0; i < ehlen; ++i) willAttachPre[i + (pidx ^ 1) * ahlen].push(wath0[i]);
                        players.forEach((_, i, a) => a[i] = players0[i]);
                        skillcmds.push(...elrcmds0[0]);
                        eskillcmds.push(...elrcmds0[1]);
                        isQuickAction ||= iqa0;
                    }
                }
            }
            if (isQuickAction) {
                // todo 如果是速动
            }
            // if (!isPreview) {
            //     if (switchAtkPre > 0) this.isSwitchAtking = true;
            //     await delay(1100 + switchAtkPre * 3000);
            //     await wait(() => switchAtkPre == 0 || !this.isSwitchAtking);
            //     let { heros: oeHeros, summons: oeSummon } = opponent;
            //     const { heros: oaHeros, summons: oaSummon } = player;
            //     aHeros = clone(oaHeros);
            //     aSummon = clone(oaSummon);
            //     eaHeros = clone(oeHeros);
            //     esummon = clone(oeSummon);
            // }
        }
        const supportCnt: number[][] = players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        let aElTips: [string, PureElementType, PureElementType][] = [];
        let dmgElements: DamageType[] = new Array(ehlen).fill(DAMAGE_TYPE.Physical);
        const aWillAttach: ElementType[][] = clone(willAttachPre);
        const aWillDamages: number[][] = new Array(ahlen + ehlen).fill(0).map(() => [-1, 0]);
        const aWillHeal: number[] = new Array(ahlen + ehlen).fill(-1);
        const statusIds: StatusTask[] = [];
        const isChargedAtk = skill?.type == SKILL_TYPE.Normal && ((player().dice.length + (!isPreview && withCard ? (skill?.cost[0].cnt ?? 0) + (skill?.cost[1].cnt ?? 0) : 0)) & 1) == 0;
        const isFallAtk = skill?.type == SKILL_TYPE.Normal && (player().isFallAtk || isSwitch > -1);
        const skillres = skill.handle({
            hero: aHeros()[hidx],
            heros: aHeros(),
            eheros: eHeros(),
            skidx,
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
        });
        skillcmds.push(...(skillres.cmds ?? []));
        if (isExec) skillres.exec?.();
        if (skill) {
            if (skill.cost[2].cnt == 0) {
                aHeros()[hidx].energy = Math.min(aHeros()[hidx].maxEnergy + 1, aHeros()[hidx].energy + 1);
            } else if (skill.cost[2].cnt > 0) {
                aHeros()[hidx].energy = 0;
            }
        }
        const atriggers: Trigger[][] = new Array(ahlen).fill(0).map(() => []);
        const etriggers: Trigger[][] = new Array(ehlen).fill(0).map(() => []);
        if (skidx > -1) {
            // this.isShowChangeHero = 0;
            if (skillres.atkOffset != undefined) {
                dmgedHidx = this._getFrontHero(pidx, { offset: skillres.atkOffset }).hidx;
            }
            if (skillres.atkTo != undefined) dmgedHidx = skillres.atkTo;
            const skillreshidxs = skillres.hidxs ?? getBackHidxs(eHeros());
            const willDamages = new Array(ahlen + ehlen).fill(0).map((_, di) => {
                if (di >= ehlen) {
                    const ahi = di - ehlen;
                    const pierceDmgOppo = (skillres.hidxs ?? [hidx]).includes(ahi) ? (skillres.pdmgSelf ?? 0) : 0;
                    return [-1, pierceDmgOppo]
                }
                const addDmg = skillres.addDmgCdt ?? 0;
                const elDmg = di == dmgedHidx && skill.damage + addDmg > 0 ? skill.damage + skill.dmgChange + addDmg : -1;
                const pierceDmg = skillreshidxs.includes(di) ? (skillres.pdmg ?? 0) : 0;
                return [elDmg, pierceDmg]
            });
            const stsprecmds: Cmds[] = [
                { cmd: 'getStatus', status: [...(skillres.statusPre ?? [])], hidxs: skillres.hidxs },
                { cmd: 'getStatus', status: [...(skillres.statusOppoPre ?? [])], hidxs: skillres.hidxs, isOppo: true },
            ];
            this._doCmds(pidx, stsprecmds, { heros: aHeros(), eheros: eHeros(), ahidx: hidx, ehidx: dmgedHidx, isAction: true });
            if (skillres.summonPre) player().summons = this._updateSummon(pidx, skillres.summonPre, aSummons(), aCombatStatus());
            if (skillres.heal) {
                const { willHeals } = this._doCmds(pidx, [{ cmd: 'heal', cnt: skillres.heal, hidxs: skillres.hidxs ?? [hidx] }], { isNotAddTask: true });
                mergeWillHeals(aWillHeal, willHeals);
            }
            const dmgEl = skillres.dmgElement ?? (skill.attachElement != ELEMENT_TYPE.Physical ? skill.attachElement : skill.dmgElement);
            const { willDamages: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1, supportCnt: supportCnt1,
                players: players1, elTips: elTips1, atriggers: atriggers1, etriggers: etriggers1,
                willHeals: healres, elrcmds: elrcmds1,
            } = this._calcDamage(
                pidx,
                dmgEl,
                willDamages,
                dmgedHidx,
                players,
                {
                    isExec,
                    skidx,
                    sktype: skill.type,
                    isChargedAtk,
                    isFallAtk,
                    isReadySkill,
                    multiDmg: skillres.multiDmgCdt,
                    usedDice: skill.cost.reduce((a, b) => a + b.cnt, 0),
                    willHeals: aWillHeal,
                    atriggers,
                    etriggers,
                }
            );
            dmgElements = [...dmgElements1];
            aElTips = [...elTips1];
            for (let i = 0; i < ehlen; ++i) aWillAttach[i + (pidx ^ 1) * ahlen].push(willAttachs1[i]);
            players.forEach((_, i, a) => a[i] = players1[i]);
            atriggers1.forEach((at, ati) => atriggers[ati].push(...at));
            etriggers1.forEach((et, eti) => etriggers[eti].push(...et));
            //     isQuickAction ||= iqa1;
            aWillHeal.forEach((_, awhi, awha) => awha[awhi] = healres[awhi]);
            supportCnt.forEach((_, sti, sta) => sta[sti].forEach((_, i, a) => a[i] += supportCnt1[sti][i]));
            skillcmds.push(...elrcmds1[0]);
            eskillcmds.push(...elrcmds1[1]);
            willDamage1.forEach((dmg, di) => {
                aWillDamages[di] = allHeros()[di].hp > 0 ? [...dmg] : [-1, 0];
            });
            if (skillres.summon) player().summons = this._updateSummon(pidx, skillres.summon, aSummons(), aCombatStatus());
            //     if (skillres.isAttach) {
            //         this._doCmds(pidx, [{ cmd: 'attach', hidxs: [hidx] }]);
            //         // todo 把下面的变为上面的一行
            //         const { eheros: aheros2, esummon: asummon2, aheros: eheros2, elrcmds: elrcmds2, willAttachs: willAttachs2,
            //             asummon: esummon2, elTips: elTips2, atriggers: etriggers2, etriggers: atriggers2, isQuickAction: iqa2,
            //         } = this._elementReaction(
            //             skill.dmgElement,
            //             [],
            //             hidx,
            //             aHeros, aSummon,
            //             eaHeros, esummon,
            //             { isAttach: true, isExec, elTips: elTips1 },
            //         );
            //         aHeros = [...aheros2];
            //         eaHeros = [...eheros2];
            //         aSummon = [...asummon2];
            //         esummon = [...esummon2];
            //         skillcmds.push(...elrcmds2[0]);
            //         eskillcmds.push(...elrcmds2[1]);
            //         aElTips = [...elTips2];
            //         isQuickAction ||= iqa2;
            //         const atkhidx = getAtkHidx(eaHeros);
            //         atriggers[hidx] = [...new Set([...atriggers[hidx], ...atriggers2[hidx]])];
            //         etriggers[atkhidx] = [...new Set([...etriggers[atkhidx], ...etriggers2[atkhidx]])];
            //         for (let i = 0; i < ahlen; ++i) aWillAttach[i + this.playerIdx * ehlen].push(willAttachs2[i]);
            //     }

        }

        const odmgedHidx = opponent().hidx;
        const bPlayers = clone(players);
        const bWillAttach: ElementType[][] = clone(aWillAttach);
        const bWillDamages: number[][][] = [aWillDamages];
        const bWillHeal: number[] = clone(aWillHeal);
        if (isPreview && switchAtkPre > 0) bWillDamages.unshift(clone(willDamagesPre));
        let isSwitchAtk = false;
        const isSwitchSelf = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd?.includes('switch') && !cmds.isOppo);
        const isSwitchOppo = (cmds: Cmds[]) => cmds.some(cmds => cmds.cmd?.includes('switch') && cmds.isOppo);
        const calcAtk = (res: any, type: string, stsId: number, ahidx: number, ehidx: number, isSkill = false, isSelf = false) => {
            const cpidx = pidx ^ +!isSelf;
            if (res?.damage == undefined && res?.pdmg == undefined && res?.heal == undefined) return false;
            if (res?.damage == undefined && res?.pdmg == undefined) {
                const { willHeals } = this._doCmds(cpidx, [{ cmd: 'heal', cnt: res.heal, hidxs: res.hidxs ?? allHidxs(bPlayers[cpidx].heros) }], { players: bPlayers });
                mergeWillHeals(bWillHeal, willHeals);
                return false;
            }
            if (ahidx == -1) ahidx = hidx;
            if (ehidx == -1) ehidx = odmgedHidx;
            const reshidxs = res?.hidxs ?? getBackHidxs(bPlayers[cpidx ^ 1].heros);
            const willDamages = new Array(isSelf ? ahlen : ehlen).fill(0).map((_, i) => [
                i == (isSelf ? ahidx : ehidx) ? (res?.damage ?? -1) : -1,
                reshidxs.includes(i) ? (res?.pdmg ?? 0) : 0
            ]);
            const { willDamages: willDamage3, willAttachs: willAttachs3, supportCnt: supportCnt3,
                players: players3, elrcmds: elrcmds3, etriggers: etriggers3, atriggers: atriggers3,
            } = this._calcDamage(
                cpidx,
                res.element,
                willDamages,
                isSelf ? ahidx : ehidx,
                bPlayers,
                {
                    isExec: false,
                    skidx: isCdt(isSkill, -2),
                }
            );
            const { isSwitch: csw = -1, isSwitchOppo: cswo = -1 } = this._doCmds(cpidx, elrcmds3[0], { isExec: false, isAction: true });
            if (cswo == -1 && type == 'die') return true;
            let obj: Summon | Status | undefined;
            if (type == 'summon') {
                obj = bPlayers[cpidx].summons.find(smnop => smnop.id == stsId);
                res?.exec?.({ summon: obj });
            } else {
                if (type == 'outStatus') obj = bPlayers[cpidx].combatStatus.find(sts3 => sts3.id == stsId);
                else if (type == 'inStatus') obj = bPlayers[cpidx].heros[isSelf ? ehidx : ahidx].heroStatus.find(sts3 => sts3.id == stsId);
                res?.exec?.(obj, { heros: bPlayers[cpidx].heros, eheros: bPlayers[cpidx ^ 1].heros });
            }
            supportCnt.forEach((_, sti, sta) => sta[sti].forEach((_, i, a) => a[i] += supportCnt3[sti][i]));
            bPlayers.forEach((_, i, a) => a[i] = players3[i]);
            for (let i = 0; i < (isSelf ? ahlen : ehlen); ++i) bWillAttach[i + cpidx * (isSelf ? ehlen : ahlen)].push(willAttachs3[i]);
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
                doAfterStatus(bPlayers[pidx].heros[ahidx].heroStatus, STATUS_GROUP.heroStatus, atriggers3[ahidx], ahidx, ehidx, 1, true);
                doAfterStatus(bPlayers[pidx].combatStatus, STATUS_GROUP.combatStatus, atriggers3[hidx], ahidx, ehidx, 1, true);
            } else {
                if (isSwitchOppo(elrcmds3[0])) etriggers3[hidx].push('change-from', 'change-to');
                const { statusAtks } = this._detectStatus(pidx ^ 1, STATUS_TYPE.Attack, etriggers3[odmgedHidx], { hidxs: [ehidx], isExec: false });
                if (statusAtks.length > 0) isSwitchAtk = true;
                doAfterStatus(bPlayers[pidx ^ 1].heros[ehidx].heroStatus, STATUS_GROUP.heroStatus, etriggers3[ehidx], ahidx, ehidx, 0, true);
                doAfterStatus(bPlayers[pidx ^ 1].combatStatus, STATUS_GROUP.combatStatus, etriggers3[odmgedHidx], ahidx, ehidx, 0, true);
            }
            return false;
        }
        const doAfterStatus = (ostatus: Status[], group: StatusGroup, trgs: Trigger[], ahidx: number, ehidx: number, isSelf = 0, isAfterSwitch = false) => {
            const status = clone(ostatus);
            if (ahidx == -1) ahidx = hidx;
            if (ehidx == -1) ehidx = odmgedHidx;
            const cpidx = pidx ^ +!isSelf;
            for (const sts of status) {
                if (sts.useCnt == 0) continue;
                for (const state of trgs) {
                    const stsres = sts.handle(sts, {
                        heros: bPlayers[cpidx].heros,
                        eheros: bPlayers[cpidx ^ 1].heros,
                        hidx: isSelf ? ahidx : ehidx,
                        trigger: state,
                        isChargedAtk: isSelf ? isChargedAtk : false,
                    });
                    const isSelfAtk = +!!stsres.isSelf;
                    if (this._hasNotTriggered(stsres.trigger, state)) continue;
                    if (sts.hasType(STATUS_TYPE.Attack) && (stsres.damage || stsres.pdmg || stsres.heal)) {
                        if (state.startsWith('change')) {
                            statusIds.push({
                                entityId: sts.entityId,
                                group,
                                pidx: cpidx,
                                isSelf: isSelfAtk,
                                trigger: state,
                                isAfterSwitch,
                                hidx: isSelf ? ahidx : ehidx,
                            });
                        }
                        const dmg = new Array(ahlen + ehlen).fill(0).map((_, di) => bWillDamages.reduce((a, b) => a + b[di][0] + b[di][1], 0));
                        const willKill = isSelf ? dmg[pidx * ahlen + ehidx] >= bPlayers[cpidx ^ 1].heros[ehidx].hp : dmg[(pidx ^ 1) * ehlen + ahidx] >= bPlayers[cpidx].heros[ahidx].hp;
                        if (calcAtk(stsres, willKill ? 'die' : (['hero', 'combat'][group] + 'Status'), sts.id, ahidx, ehidx, state.includes('skill'), !(isSelfAtk ^ isSelf))) continue;
                        if (stsres.heal) {
                            let willheals = new Array(ahlen + ehlen).fill(-1);
                            const whidx = skidx > -1 ? isSelf ? ahidx : ehidx : player().heros.findIndex(h => h.isSelected);
                            bPlayers[cpidx].heros.forEach((h, hi) => {
                                if ((stsres.hidxs ?? [whidx]).includes(hi)) {
                                    willheals[hi + cpidx * (isSelf ? ehlen : ahlen)] = Math.min(h.maxHp - h.hp, stsres.heal ?? -1);
                                }
                            });
                            mergeWillHeals(bWillHeal, willheals);
                        }
                    }
                }
            }
        }
        const { ndices, isSwitch: swc = -1, isSwitchOppo: swco = -1 } = this._doCmds(pidx, skillcmds, {
            heros: bPlayers[pidx].heros,
            eheros: bPlayers[pidx ^ 1].heros,
            summons: bPlayers[pidx].summons,
            isExec,
            isAction: true,
        });
        const { ndices: edices } = this._doCmds(pidx ^ 1, eskillcmds, {
            heros: bPlayers[pidx ^ 1].heros,
            eheros: bPlayers[pidx].heros,
            isExec,
            isAction: true,
        });
        const dtriggers: Trigger[] = [];
        if (typeof otriggers == 'string') dtriggers.push(otriggers);
        else dtriggers.push(...otriggers);
        const aswhidx = isSwitchSelf(skillcmds) ? swc : skidx == -1 && dtriggers.includes('change-to') ? aHeros().findIndex(h => h.isSelected > 0) : -1;
        const eswhidx = isSwitchOppo(skillcmds) ? swco : -1;
        if (skidx > -1) {
            const [afterASkillTrgs, afterESkillTrgs] = [atriggers, etriggers]
                .map(xtrgs => xtrgs.map(trgs => trgs.map(trg => trg.startsWith('skill') ? 'after-' + trg : trg.startsWith('after-') ? trg.slice(6) : trg) as Trigger[]));
            bPlayers[pidx ^ 1].heros.forEach((h, hi) => {
                doAfterStatus(h.heroStatus, STATUS_GROUP.heroStatus, afterESkillTrgs[hi], aswhidx, eswhidx);
                if (hi == odmgedHidx) doAfterStatus(bPlayers[pidx ^ 1].combatStatus, STATUS_GROUP.combatStatus, afterESkillTrgs[hi], aswhidx, eswhidx);
            });
            bPlayers[pidx].heros.forEach((h, hi) => {
                doAfterStatus(h.heroStatus, STATUS_GROUP.heroStatus, afterASkillTrgs[hi], aswhidx, eswhidx, 1);
                if (hi == hidx) doAfterStatus(bPlayers[pidx].combatStatus, STATUS_GROUP.combatStatus, afterASkillTrgs[hi], aswhidx, eswhidx, 1);
            });
            for (const smn of bPlayers[pidx].summons) {
                ([`after-skilltype${skill.type}`, `after-skill`] as Trigger[]).forEach(trg => {
                    const smnres = smn.handle(smn, { heros: bPlayers[pidx].heros, trigger: trg, hcard: withCard });
                    if (smnres?.trigger?.includes(trg)) {
                        calcAtk(smnres, 'summon', smn.id, aswhidx, eswhidx, true);
                        this._detectSummon(pidx, trg, { csummon: [smn], isExec });
                    }
                });
            }
        }
        if (isSwitchOppo(skillcmds)) {
            const { statusAtks } = this._detectStatus(pidx ^ 1, STATUS_TYPE.Attack, ['change-from', 'change-to'], { hidxs: [odmgedHidx], isExec: false, players: bPlayers });
            if (statusAtks.length > 0) isSwitchAtk = true;
            doAfterStatus(bPlayers[pidx ^ 1].heros[odmgedHidx].heroStatus, STATUS_GROUP.heroStatus, ['change-from', 'change-to'], aswhidx, eswhidx, 0, true);
            doAfterStatus(bPlayers[pidx ^ 1].combatStatus, STATUS_GROUP.combatStatus, ['change-from', 'change-to'], aswhidx, eswhidx, 0, true);
        }
        if (skidx == -1 || isSwitchSelf(skillcmds)) {
            const triggers: Trigger[] = skidx == -1 ? dtriggers : ['change-from', 'change-to'];
            const { statusAtks } = this._detectStatus(pidx, STATUS_TYPE.Attack, triggers, { hidxs: [hidx], isExec: false, players: bPlayers });
            if (statusAtks.length > 0) isSwitchAtk = true;
            doAfterStatus(bPlayers[pidx].heros[ahidx()].heroStatus, STATUS_GROUP.heroStatus, triggers, aswhidx, eswhidx, 1, true);
            doAfterStatus(bPlayers[pidx].combatStatus, STATUS_GROUP.combatStatus, triggers, aswhidx, eswhidx, 1, true);
        }
        const stscmds: Cmds[] = [
            { cmd: 'getStatus', status: skillres.status, hidxs: skillres.hidxs },
            { cmd: 'getStatus', status: skillres.statusOppo, hidxs: skillres.hidxs, isOppo: true },
        ];
        this._doCmds(pidx, stscmds, { players, ahidx: hidx, ehidx: dmgedHidx, isExec, isAction: true });
        let willHp: (number | undefined)[] = new Array(ahlen + ehlen).fill(undefined);
        if (!isExec) {
            willHp = willHp.map((_, i) => {
                const allHeal = bWillHeal.reduce((a, b) => a + Math.max(0, b), 0);
                const alldamage = bWillDamages.reduce((a, b) => a + Math.max(0, b[i][0]) + Math.max(0, b[i][1]), 0);
                const hasVal = bWillDamages.some(v => v[i][0] >= 0 || v[i][1] > 0) || bWillHeal.some(v => v > 0);
                if (!hasVal) {
                    if (bWillHeal.some(v => v == 0)) return 100;
                    return undefined;
                }
                const res = allHeal - alldamage;
                const hero = this.players[Math.floor(i / (pidx == 0 ? ahlen : ehlen)) ^ 1].heros[i % (pidx == 0 ? ehlen : ahlen)];
                if (hero.hp <= 0 && res <= 0) return undefined;
                if (res + hero.hp <= 0) {
                    if (hero.talentSlot?.hasTag(CARD_TAG.NonDefeat)) {
                        const reviveSlot = hero.talentSlot
                            .handle(hero.talentSlot, { trigger: 'will-killed' })
                            .execmds?.find(({ cmd }) => cmd == 'revive')?.cnt ?? 0;
                        if (reviveSlot > 0) {
                            return reviveSlot - hero.hp - 0.3;
                        }
                    }
                    const isReviveSts = hero.heroStatus.find(sts => sts.hasType(STATUS_TYPE.NonDefeat));
                    if (isReviveSts) {
                        return (isReviveSts.handle(isReviveSts, {}).cmds?.find(({ cmd }) => cmd == 'revive')?.cnt ?? 0) - hero.hp - 0.3;
                    }
                }
                return res;
            });
        }
        // const willAttachs = isExec ? new Array(ahlen + ehlen).fill(0).map(() => []) : bWillAttach.map(hwa => hwa.filter(wa => wa != ELEMENT_TYPE.Physical));
        const willSummons: Summon[][] = [[], []];
        const summonCnt: number[][] = players.map(() => new Array(MAX_SUMMON_COUNT).fill(0));
        if (!isExec) {
            willSummons[0] = bPlayers[pidx ^ 1].summons.filter(wsmn => this.players[pidx ^ 1].summons.every(smn => smn.id != wsmn.id))
                .map(wsmn => (wsmn.UI.isWill = true, wsmn));
            willSummons[1] = bPlayers[pidx].summons.filter(wsmn => this.players[pidx].summons.every(smn => smn.id != wsmn.id))
                .map(wsmn => {
                    const nsmn = wsmn.handle(wsmn).willSummon ?? wsmn;
                    nsmn.UI.isWill = true;
                    return nsmn;
                });
            summonCnt.forEach((smns, pi) => {
                const osmn = players[pi].summons;
                return smns.map((_, si) => {
                    if (osmn.length - 1 < si) return 0;
                    const smnCnt = bPlayers[pi].summons.find(smn => smn.id == osmn[si].id)?.useCnt ?? 0;
                    return smnCnt - osmn[si].useCnt;
                });
            });
        }
        if (isExec) {
            players[pidx].isFallAtk = false;
            players[pidx].canAction = false;
            if (ndices) player().dice = ndices;
            if (edices) opponent().dice = edices;
            if (isSwitchAtk) {
                // todo 先等待？
            }
            this.players.forEach((_, i, a) => a[i] = players[i]);
            this._writeLog(`[${player().name}][${aHeros()[player().hidx].name}]使用了[${SKILL_TYPE_NAME[skill.type]}][${skill.name}]`);
            this._doDamage(pidx, aWillAttach, {
                dmgSource: 'skill',
                atkPidx: pidx,
                atkHidx: aHeros()[player().hidx].hidx,
                tarHidx: dmgedHidx,
                willDamages: aWillDamages,
                dmgElements,
                elTips: aElTips,
                willHeals: aWillHeal,
            }, isSwitch);
            this._changeTurn(pidx, isQuickAction, 'useSkill');
        }
        return { willHp, willAttachs: bWillAttach, summonCnt, supportCnt, willSummons }
    }
    /**
     * 计算伤害
     * @param pidx 发起攻击的玩家序号
     * @param dmgElement 伤害的元素附着
     * @param damages 所有角色将要受到的伤害[敌方, 我方]
     * @param dmgedHidx 受击角色索引idx
     * @param players 所有玩家信息 
     * @param options isAttach 是否为自己附着元素, isSummon 召唤物攻击id, isExec 是否执行, getcards 双方准备摸牌数
     *                isSwirl 是否为扩散伤害, isReadySkill 是否为准备技能, willheals 回血, isSwirlExec 扩散伤害是否执行,
     *                elrcmds 命令执行, atriggers 攻击者触发时机, etriggers 受击者触发时机, skidx 技能序号, sktype 技能类型, 
     *                usedDice 使用的骰子, isSelf 是否为对自身攻击(目前仅用于statusAtk), withCard 可能使用的卡
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
        pidx: number, dmgElement: ElementType, damages: number[][], dmgedHidx: number, oplayers: Player[],
        options: {
            isAttach?: boolean, isSummon?: number, isExec?: boolean, isSwirl?: boolean, discards?: Card[], isChargedAtk?: boolean,
            skidx?: number, sktype?: SkillType, isFallAtk?: boolean, isReadySkill?: boolean, isSwirlExec?: boolean, willHeals?: number[],
            elrcmds?: Cmds[][], atriggers?: Trigger[][], etriggers?: Trigger[][], usedDice?: number, getcards?: number[], dmgElements?: DamageType[],
            elTips?: [string, PureElementType, PureElementType][], willAttachs?: ElementType[], multiDmg?: number, isSelf?: number, withCard?: Card,
            minusDiceSkillIds?: number[], willheals?: number[][],
        } = {}) {
        const players = clone(oplayers);
        const epidx = pidx ^ 1;
        const { heros: { length: ahlen } } = players[pidx];
        const { heros: { length: ehlen } } = players[epidx];
        const { isAttach = false, isSummon = -1, isSwirl = false, isExec = true, multiDmg = 1, skidx = -1, sktype, minusDiceSkillIds = [],
            isReadySkill = false, isSwirlExec = true, willHeals = new Array<number>(ahlen + ehlen).fill(-1),
            elrcmds = [[], []], usedDice = 0, dmgElements = new Array<DamageType>(ehlen).fill(DAMAGE_TYPE.Physical),
            willAttachs = new Array<ElementType>(ehlen).fill(ELEMENT_TYPE.Physical),
            elTips = new Array(ahlen + ehlen).fill(0).map(() => ['', PURE_ELEMENT_TYPE.Cryo, PURE_ELEMENT_TYPE.Cryo]),
            atriggers: atrg = new Array(ahlen).fill(0).map(() => []), etriggers: etrg = new Array(ehlen).fill(0).map(() => []),
            isSelf = 0, getcards: gcds = [0, 0], discards = [], withCard, isChargedAtk = false, isFallAtk = false,
        } = options;
        let willDamages = damages;
        if (!isSwirl) {
            if (willDamages.length == 0) willDamages = new Array(ahlen + ehlen).fill(0).map(() => [-1, 0]);
            else if (willDamages.length == ehlen) {
                const admg = new Array(ahlen).fill(0).map(() => [-1, 0]);
                if (pidx == 0) willDamages = admg.concat(willDamages);
                else willDamages = willDamages.concat(admg);
            } else if (pidx == 0) {
                willDamages = willDamages.slice(ehlen).concat(willDamages.slice(0, ehlen));
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
            willHeals,
            elrcmds,
            supportCnt: players.map(() => new Array<number>(MAX_SUPPORT_COUNT).fill(0)),
            isQuickAction: false,
        });
        const { heros: aheros, summons: asummons, playerInfo } = res.players[pidx];
        const { heros: eheros, summons: esummons } = res.players[epidx];
        const mergeSupportCnt = (resCnt?: number[][]) => {
            if (!resCnt) return;
            res.supportCnt.forEach((spt, spti) => spt.forEach((_, i, a) => a[i] += resCnt[spti][i]));
        }
        const mergeWillHeals = (resHeals?: number[], isSelf = true) => {
            if (!resHeals) return;
            resHeals.forEach((hl, hli) => {
                if (hl > -1) {
                    const nhli = hli + (isSelf ? epidx * aheros.length : pidx * eheros.length);
                    if (res.willHeals[nhli] < 0) res.willHeals[nhli] = hl;
                    else res.willHeals[nhli] += hl;
                }
            });
        }
        const efhero = eheros[dmgedHidx];
        if (efhero.hp <= 0) return res;
        const getDmgIdxOffset = ahlen * epidx;
        const getDmgIdx = dmgedHidx + getDmgIdxOffset;
        const atkHidx = getAtkHidx(aheros);
        const afhero = aheros[atkHidx];
        const atriggers: Trigger[][] = clone(res.atriggers);
        const etriggers: Trigger[][] = clone(res.etriggers);
        const trgEl = ELEMENT_TYPE_KEY[dmgElement];
        let swirlDmg: PureElementType | undefined;
        if (res.willDamages[getDmgIdx][0] > 0 || isAttach) {
            res.dmgElements[dmgedHidx] = dmgElement;
            if ( // 将要附着的元素
                dmgElement != ELEMENT_TYPE.Physical &&
                !efhero.attachElement.includes(dmgElement) &&
                !([ELEMENT_TYPE.Anemo, ELEMENT_TYPE.Geo] as ElementType[]).includes(dmgElement)
            ) {
                res.willAttachs[dmgedHidx] = dmgElement;
            }
            if ( // 没有元素反应(不含冰草共存)
                efhero.attachElement.length == 0 ||
                (efhero.attachElement as ElementType[]).includes(dmgElement)
            ) {
                if (efhero.attachElement.length == 0 && dmgElement != ELEMENT_TYPE.Physical) {
                    efhero.attachElement.push(dmgElement as PureElementType);
                }
            } else if (dmgElement != ELEMENT_TYPE.Physical) {
                let isElDmg = true;
                const attachElement = efhero.attachElement.shift()!;
                const elTipIdx = (pidx ^ +isAttach) * eheros.length + dmgedHidx;
                const elTypes: ElementType[] = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro, ELEMENT_TYPE.Hydro];
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
                            res.willDamages.forEach((dmg, i) => {
                                if (i >= pidx * aheros.length && i < pidx * aheros.length + eheros.length) {
                                    const idx = +(i != getDmgIdx);
                                    if (dmg[idx] < 0) dmg[idx] = 0;
                                    ++dmg[idx];
                                }
                            });
                        }
                        res.elTips[elTipIdx] = ['感电', dmgElement, attachElement];
                        atriggers[atkHidx].push('ElectroCharged');
                    } else if (hasEls(ELEMENT_TYPE.Electro, ELEMENT_TYPE.Cryo)) { // 冰雷 超导
                        if (!isAttach) {
                            res.willDamages.forEach((dmg, i) => {
                                if (i >= pidx * aheros.length && i < pidx * aheros.length + eheros.length) {
                                    const idx = +(i != getDmgIdx);
                                    if (dmg[idx] < 0) dmg[idx] = 0;
                                    ++dmg[idx];
                                }
                            });
                        }
                        res.elTips[elTipIdx] = ['超导', dmgElement, attachElement];
                        atriggers[atkHidx].push('Superconduct');
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Cryo)) { // 水冰 冻结
                        res.willDamages[getDmgIdx][0] += +!isAttach;
                        efhero.heroStatus = this._updateStatus(pidx, [this.newStatus(106)], efhero.heroStatus);
                        res.elTips[elTipIdx] = ['冻结', dmgElement, attachElement];
                        atriggers[atkHidx].push('Frozen');
                    } else if (hasEls(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Dendro)) { // 水草 绽放
                        ++res.willDamages[getDmgIdx][0];
                        res.elTips[elTipIdx] = ['绽放', dmgElement, attachElement];
                        atriggers[atkHidx].push('Bloom');
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro)) { // 火雷 超载
                        res.willDamages[getDmgIdx][0] += 2;
                        if (efhero.isFront) res.elrcmds[0].push({ cmd: 'switch-after', isOppo: !isSelf });
                        res.elTips[elTipIdx] = ['超载', dmgElement, attachElement];
                        atriggers[atkHidx].push('Overload');
                    } else if (hasEls(ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Dendro)) { // 火草 燃烧
                        ++res.willDamages[getDmgIdx][0];
                        res.players[pidx].summons = this._updateSummon(pidx, [this.newSummon(115)], res.players[pidx].summons, res.players[pidx].combatStatus, isExec, { isSummon });
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
                        `:${ELEMENT_TYPE_KEY[attachElement]}}` : '';
                    atriggers.forEach((trgs, tri) => {
                        if (tri == atkHidx) {
                            trgs.push(
                                'elReaction', 'get-elReaction-oppo',
                                `elReaction-${trgEl}${SwirlOrCrystallize}` as Trigger,
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
                    etriggers[dmgedHidx].push(
                        'get-elReaction',
                        `get-elReaction-${trgEl}${SwirlOrCrystallize}` as Trigger,
                        `get-elReaction-${ELEMENT_TYPE_KEY[attachElement]}` as Trigger,
                    );
                }
            }
        }
        etriggers.forEach((trg, tidx) => {
            const [elDmg, pierceDmg] = res.willDamages[tidx + getDmgIdxOffset];
            const isOtherGetDmg = res.willDamages
                .slice(eheros.length * pidx, eheros.length * pidx + aheros.length)
                .some((dmg, didx) => (dmg[0] > 0 || dmg[1] > 0) && didx != tidx);
            if (isOtherGetDmg) trg.push('other-getdmg');
            if (elDmg > 0 || pierceDmg > 0) {
                trg.push('getdmg');
                if (dmgElement != ELEMENT_TYPE.Physical) trg.push('el-getdmg');
                if (elDmg > 0) trg.push(`${trgEl}-getdmg`);
                if (pierceDmg > 0) trg.push('Pierce-getdmg');
            }
        });
        atriggers.forEach((trg, tidx) => {
            const [elDmg, pierceDmg] = res.willDamages[tidx + (aheros.length * epidx)];
            const isOtherGetDmg = res.willDamages
                .slice(aheros.length * epidx, aheros.length * epidx + eheros.length)
                .some((dmg, didx) => (dmg[0] > 0 || dmg[1] > 0) && didx != tidx);
            if (isOtherGetDmg) trg.push('other-getdmg');
            if (elDmg > 0 || pierceDmg > 0) {
                trg.push('getdmg');
                if (elDmg > 0) trg.push(`${trgEl}-getdmg`);
                if (pierceDmg > 0) trg.push('Pierce-getdmg');
            }
        });
        const aist: Status[][] = new Array(aheros.length).fill(0).map(() => []);
        const aost: Status[] = [];
        const eist: Status[][] = new Array(eheros.length).fill(0).map(() => []);
        const eost: Status[] = [];
        // const getcards: number[] = gcds;
        if (!isAttach) {
            if (isSwirl) {
                etriggers[dmgedHidx].push(`${trgEl}-getdmg-Swirl` as Trigger);
                atriggers[atkHidx].push(`${trgEl}-dmg-Swirl` as Trigger, 'dmg-Swirl');
            } else {
                const eWillDamage = res.willDamages.slice(pidx * aheros.length, pidx * aheros.length + eheros.length);
                if (eWillDamage.some(dmg => dmg.some(d => d > 0))) {
                    atriggers.forEach((trgs, ti) => {
                        if (ti == atkHidx) trgs.push('dmg', 'getdmg-oppo');
                        else trgs.push('other-dmg');
                    });
                    if (dmgElement != ELEMENT_TYPE.Physical) atriggers[atkHidx].push('el-dmg', 'el-getdmg-oppo');
                    if (eWillDamage.some(dmg => dmg[0] > 0)) {
                        atriggers[atkHidx].push(`${trgEl}-dmg`, `${trgEl}-getdmg-oppo`);
                    }
                    if (eWillDamage.some(dmg => dmg[1] > 0)) {
                        atriggers[atkHidx].push('Pierce-dmg', 'Pierce-getdmg-oppo');
                    }
                }
                if (skidx > -1 && !isReadySkill) {
                    atriggers.forEach((trg, ti) => {
                        const isOther = ti != atkHidx ? 'other-' : '';
                        trg.push(`${isOther}skill`, `${isOther}skilltype${sktype}` as Trigger);
                    });
                    etriggers.forEach(trgs => trgs.push('oppo-skill'));
                }
                if (isReadySkill) atriggers[atkHidx].push('useReadySkill');
            }
            const slotSummons: Summon[] = [];
            for (let i = 0; i < aheros.length; ++i) {
                const slotres = this._detectSlot(pidx, atriggers[isSummon > -1 ? atkHidx : i], {
                    hidxs: i,
                    heros: aheros,
                    eheros: eheros,
                    ehidx: dmgedHidx,
                    summons: asummons,
                    isChargedAtk,
                    isFallAtk,
                    isSkill: skidx,
                    isSummon,
                    usedDice,
                    isExec,
                    card: withCard,
                    minusDiceSkillIds,
                });
                aist[i].push(...slotres.heroStatus);
                aost.push(...slotres.combatStatus);
                slotSummons.push(...slotres.nsummons);
                mergeWillHeals(slotres.willHeals, true);
                if (res.willDamages[getDmgIdx][0] > 0) res.willDamages[getDmgIdx][0] += slotres.addDmg + (isSummon > -1 ? slotres.addDmgSummon : 0);
                mergeSupportCnt(slotres.supportCnt);
            }
            res.players[pidx].summons = this._updateSummon(pidx, slotSummons, res.players[pidx].summons, res.players[pidx].combatStatus, isExec, { isSummon });
            const getdmg = res.willDamages
                .slice(aheros.length * pidx, aheros.length * pidx + eheros.length)
                .map(dmg => dmg[0] == -1 && dmg[1] == 0 ? -1 : Math.max(0, dmg[0]) + dmg[1]);
            for (let i = 0; i < eheros.length; ++i) {
                const slotres = this._detectSlot(epidx, etriggers[i], {
                    hidxs: i,
                    heros: eheros,
                    eheros: aheros,
                    isExec,
                    getdmg,
                });
                eist[i].push(...slotres.heroStatus);
                eost.push(...slotres.combatStatus);
                mergeWillHeals(slotres.willHeals, false);
                mergeSupportCnt(slotres.supportCnt);
            }
        }
        const detectStatus = (trgs: Trigger[], hi: number, isSelf: boolean) => {
            const dmg = isSelf ? 'addDmg' : 'getDmg';
            const cpidx = pidx ^ +!isSelf;
            const stsres = this._detectStatus(cpidx, [], trgs, {
                hidxs: [hi],
                players,
                isExec,
                skilltype: sktype,
                isSummon,
                dmgSource: skidx > -1 ? afhero.id : isSummon,
                getDmgIdx: dmgedHidx,
                minusDiceSkillIds,
                hasDmg: res.willDamages[getDmgIdx][0] > 0,
                isReadySkill,
                discards,
            })
            if (res.willDamages[getDmgIdx][0] > 0) {
                res.willDamages[getDmgIdx][0] += (stsres?.[`${dmg}`] ?? 0) + (isSummon > -1 ? stsres.addDmgSummon ?? 0 : 0);
            }
            if (stsres.nsummons) {
                players[cpidx].summons = this._updateSummon(cpidx, stsres.nsummons, players[cpidx].summons, players[cpidx].combatStatus);
            }
            stsres.pdmgs.forEach(([pdmg, phidxs, pIsSelf]) => {
                if (+pIsSelf ^ +!isSelf) {
                    (phidxs ?? getBackHidxs(aheros)).forEach(hi => {
                        res.willDamages[hi + aheros.length * epidx][1] += pdmg;
                    });
                } else {
                    (phidxs ?? getBackHidxs(eheros)).forEach(hi => {
                        res.willDamages[hi + getDmgIdxOffset][1] += pdmg;
                    });
                }
            });
            mergeSupportCnt(stsres.supportCnt);
            mergeWillHeals(stsres.willHeals, isSelf);
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
            this._detectSummon(epidx, [...new Set(etriggers.flat())], {
                csummon: esummons,
                heros: eheros,
                eheros: aheros,
                isExec,
            });
            // const { heros: smneheros } = this._doCmds(epidx, esmncmd, { heros: eheros, isExec });
            //     if (smneheros) {
            //         res.eheros = [...smneheros];
            //         efhero = res.eheros[frontIdx];
            //     }
            const asmnres = this._detectSummon(pidx, atriggers[atkHidx], {
                csummon: asummons,
                hasDmg: true,
                isExec,
                heros: aheros,
                minusDiceSkillIds,
                isSkill: skidx,
            });
            if (res.willDamages[getDmgIdx][0] > 0) res.willDamages[getDmgIdx][0] += asmnres.addDmg;
            mergeWillHeals(asmnres.willHeals, true);
            const getdmg = res.willDamages.map(v => Math.max(0, v[0]) + v[1]);
            const asptres = this._detectSupport(pidx, atriggers[atkHidx], {
                isExec,
                isSkill: skidx,
                getdmg,
                minusDiceSkillIds,
                heal: res.willHeals,
                discard: discards.length,
            });
            //     res.elrcmds[0].push(...supportcmds);
            mergeSupportCnt(asptres.supportCnt);
            const esptres = this._detectSupport(epidx, [...new Set(etriggers.flat())], {
                isExec,
                getdmg,
                isSkill: skidx,
            });
            //     res.elrcmds[0].push(...supportoppocmds);
            mergeSupportCnt(esptres.supportCnt);
        }
        players[epidx].summons = this._updateSummon(epidx, [], esummons, players[epidx].combatStatus);
        res.players[pidx].summons = this._updateSummon(pidx, [], asummons, res.players[pidx].combatStatus);
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
            const otheridx = new Array(eheros.length - 1).fill(0).map((_, i) => (dmgedHidx + i + 1) % eheros.length);
            otheridx.forEach((i, idx) => {
                if (res.willDamages[i + getDmgIdxOffset][0] < 0) res.willDamages[i + getDmgIdxOffset][0] = 0;
                ++res.willDamages[i + getDmgIdxOffset][0];
                res = this._calcDamage(pidx, swirlDmg as PureElementType, res.willDamages, i, players,
                    {
                        ...options, isSwirl: true, isSwirlExec: idx == otheridx.length - 1,
                        atriggers: res.atriggers, etriggers: res.etriggers, dmgElements: res.dmgElements,
                        elTips: res.elTips, willAttachs: res.willAttachs, getcards: gcds,
                    });
            });
        }

        let restDmg = res.willDamages[getDmgIdx][0];
        if (efhero.isFront) {
            [efhero.weaponSlot, efhero.artifactSlot, efhero.talentSlot].forEach(slot => {
                if (slot?.hasTag(CARD_TAG.Barrier)) {
                    const { restDmg: slotresdmg = 0, statusOppo = [], hidxs, execmds = [] }
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
            restDmg = sts.handle(sts, { restDmg, dmgElement, heros: eheros, hidx: dmgedHidx, dmgSource: isSummon })?.restDmg ?? 0;
        });
        if (efhero.isFront) {
            res.players[epidx].combatStatus.filter(sts => sts.hasType(STATUS_TYPE.Barrier, STATUS_TYPE.Shield)).forEach(sts => {
                const oSummon = esummons.find(smn => smn.id == sts.summonId);
                const { restDmg: nrdmg = 0, pdmg = 0, hidxs: piercehidxs = [] } = sts.handle(sts, {
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
            let aMultiDmg = 0;
            res.players[pidx].combatStatus.filter(sts => sts.hasType(STATUS_TYPE.MultiDamage)).forEach(sts => {
                aMultiDmg += sts.handle(sts, {})?.multiDmgCdt ?? 0;
            });
            aMultiDmg += multiDmg;
            restDmg *= Math.max(1, aMultiDmg);
        }
        res.willDamages[getDmgIdx][0] = restDmg;
        const aGetDmgIdxOffset = ahlen * epidx;
        const dmg = res.willDamages.slice(getDmgIdxOffset, getDmgIdxOffset + ehlen).map(v => v.reduce((a, b) => a + Math.max(0, b)));
        const getdmg = res.willDamages.slice(aGetDmgIdxOffset, aGetDmgIdxOffset + ahlen).map(v => v.reduce((a, b) => a + Math.max(0, b)));
        aheros.forEach((_, hi) => {
            this._detectSkill(pidx, atriggers[hi], {
                hidxs: hi,
                heros: aheros,
                isExec,
                getdmg,
                dmg,
                discards,
            });
        });
        eheros.forEach((_, hi) => {
            this._detectSkill(epidx, etriggers[hi], {
                hidxs: hi,
                heros: eheros,
                isExec,
                getdmg: dmg,
            });
        });

        if (res.atriggers[atkHidx].includes('Crystallize')) aost.push(this.newStatus(111));
        if ((res.atriggers[atkHidx].includes('Bloom') && [...aost, ...res.players[pidx].combatStatus].every(sts => sts.id != 112081))) {
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
        stscmds.push({ cmd: 'getStatus', status: aost });
        stscmds.push({ cmd: 'getStatus', status: eost, isOppo: true });
        this._doCmds(pidx, stscmds, { heros: aheros, eheros: eheros, ahidx: atkHidx, ehidx: dmgedHidx });
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
                    const { nwkhidxs } = this._detectSlot(epidx, 'will-killed', { hidxs: willkilledhidxs, heros: eheros, eheros: aheros, isUnshift: true });
                    this._detectStatus(epidx, STATUS_TYPE.NonDefeat, 'will-killed', { hidxs: nwkhidxs, heros: eheros, eheros: aheros, isUnshift: true });
                    const slotDestroyHidxs = dieHeros.filter(h => {
                        const isDie = h.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonDefeat)) &&
                            willkilledhidxs.length == nwkhidxs.length &&
                            (h.weaponSlot != null || h.artifactSlot != null || h.talentSlot != null);
                        const revHero = eheros.find(eh => eh.id == h.id);
                        const isRevive = revHero?.weaponSlot != h.weaponSlot || revHero?.artifactSlot != h.artifactSlot || revHero?.talentSlot != h.talentSlot;
                        return isDie || isRevive;
                    }).map(v => v.hidx);
                    if (slotDestroyHidxs.length > 0) {
                        const { cmds = [] } = this._detectStatus(epidx, STATUS_TYPE.Usage, 'slot-destroy', { hidxs: slotDestroyHidxs, heros: eheros });
                        res.elrcmds[1].push(...cmds);
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
    private _checkCard(pidx: number, cardIdx: number, isReconcile: boolean = false) {
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const { dice, heros, hidx, summons, isUsedLengend, handCards } = player;
        const currCard = handCards[cardIdx];
        const { cost, canSelectHero, type, userType, canSelectSupport, costChange, canSelectSummon, energy } = currCard;
        let { costType, anydice } = currCard;
        let ncost = Math.max(0, cost + anydice - costChange);
        let isValid: boolean = false;
        let diceSelect: boolean[] = [];
        const diceLen = dice.length;
        const supportCnt: number[][] = this.players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        const willHp = new Array(this.players.flatMap(p => p.heros).length).fill(undefined);
        const willAttachs = new Array(this.players.reduce((a, c) => a + c.heros.length, 0)).fill(0).map(() => []);
        const cardres = currCard.handle(currCard, {
            hidxs: [hidx],
            heros,
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
        if (cardres.hidxs?.length == 0 ||
            cardres.summon && summons.length == MAX_SUMMON_COUNT ||
            cardres.isValid == false ||
            currCard.hasSubtype(CARD_SUBTYPE.Legend) && isUsedLengend ||
            heros[hidx].energy < energy ||
            isReconcile && (currCard.tag.includes(CARD_TAG.NonReconcile) || dice.every(d => d == DICE_COST_TYPE.Omni || d == this._getFrontHero(pidx).element))
        ) {
            return { isValid: false, diceSelect: new Array(diceLen).fill(false) };
        }
        heros.forEach((hero, i) => {
            const canSelectHeros = cardres.canSelectHero?.[i] ?? (hero.hp > 0);
            hero.canSelect = canSelectHero > 0 && canSelectHeros && (
                type == CARD_TYPE.Support || type == CARD_TYPE.Event && currCard.subType.length == 0 ||
                currCard.hasSubtype(CARD_SUBTYPE.Weapon) && userType == hero.weaponType ||
                currCard.hasSubtype(CARD_SUBTYPE.Artifact) ||
                currCard.hasSubtype(CARD_SUBTYPE.Food) && !hero.heroStatus.some(ist => ist.id == 303300) ||
                currCard.hasSubtype(CARD_SUBTYPE.Talent) && userType == hero.id && (hero.isFront || !currCard.hasSubtype(CARD_SUBTYPE.Action)) ||
                currCard.hasSubtype(CARD_SUBTYPE.Action, CARD_SUBTYPE.Legend, CARD_SUBTYPE.ElementResonance) && userType == 0
            );
        });
        if (userType == 0 && canSelectHero == heros.filter(h => h.isSelected).length ||
            userType == this._getFrontHero(pidx).id && canSelectHero == heros.filter(h => h.canSelect).length
        ) {
            // const { willHeals } = this._doCmds([...(cardres.cmds ?? [])], {
            //     isCard: true,
            //     hidxs: isCdt(heros.some(h => h.isSelected), [heros.findIndex(h => h.isSelected)]),
            //     isExec: false
            // });
            // willHeals?.forEach(whl => this._doHeal(whl, heros, { isExec: false }));
        }
        this.players.forEach(p => {
            p.summons.forEach(smn => {
                smn.canSelect = canSelectSummon > -1 && (p.pidx ^ canSelectSummon) != pidx;
                if (canSelectSummon == -1) smn.isSelected = false;
            });
            p.supports.forEach(spt => {
                if (type != CARD_TYPE.Support || p.supports.length < MAX_SUPPORT_COUNT) spt.canSelect = canSelectSupport > -1 && (p.pidx ^ canSelectSupport) != pidx;
                if (canSelectSupport == -1 && p.supports.length < MAX_SUPPORT_COUNT) spt.isSelected = false;
            });
        });
        const skillIdx = cardres.cmds?.find(({ cmd }) => cmd == 'useSkill')?.cnt ?? -1;
        const switchIdx = cardres.cmds?.find(({ cmd }) => cmd.startsWith('switch'))?.hidxs?.[0] ?? -1;
        if (isReconcile) [ncost, costType] = [1, DICE_TYPE.Any];
        if (ncost <= 0) return { isValid: ncost == 0, diceSelect: new Array(diceLen).fill(false), skillIdx, switchIdx };
        if (costType == DICE_TYPE.Any) {
            isValid = ncost <= diceLen;
            if (isValid) {
                for (let i = 0, tmpcost = ncost; i < diceLen; ++i) {
                    diceSelect.unshift(tmpcost-- > 0);
                }
            }
            return { isValid, diceSelect, skillIdx, switchIdx };
        }
        const diceCnt = arrToObj(Object.values(DICE_COST_TYPE), 0);
        dice.forEach(d => ++diceCnt[d]);
        if (costType != DICE_TYPE.Same) {
            ncost = Math.max(0, cost - costChange);
            anydice = Math.max(0, anydice - Math.max(0, costChange - cost));
            isValid = ncost <= diceCnt[costType] + diceCnt[DICE_COST_TYPE.Omni] && anydice <= diceLen - ncost;
            if (isValid) {
                for (let i = 0, tmpcost = anydice; i < diceLen && tmpcost > 0; ++i) {
                    diceSelect.unshift(tmpcost-- > 0);
                }
                for (let i = diceLen - anydice - 1, tmpcnt = ncost; i >= 0; --i) {
                    const cdice = dice[i];
                    if (cdice != costType && cdice != DICE_COST_TYPE.Omni) diceSelect.unshift(false);
                    else diceSelect.unshift(tmpcnt-- > 0);
                }
            } else diceSelect = new Array(diceLen).fill(false);
            return { isValid, diceSelect, skillIdx, switchIdx };
        }
        isValid = objToArr(diceCnt).some(([d, cnt]) => (d != DICE_COST_TYPE.Omni ? cnt : 0) + diceCnt[DICE_COST_TYPE.Omni] >= ncost);
        if (isValid) {
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
                if (cdice != maxDice && cdice != DICE_COST_TYPE.Omni) diceSelect.unshift(false);
                else diceSelect.unshift(tmpcnt-- > 0);
            }
        } else diceSelect = new Array(diceLen).fill(false);
        return { isValid, diceSelect, skillIdx, switchIdx, willHp, supportCnt, willAttachs };
    }
    /**
     * 使用卡牌
     * @param pidx 玩家序号
     * @param cardIdx 使用的卡牌序号
     * @param options.selectHero 使用卡牌时选择的角色序号
     * @param options.selectHero2 使用卡牌时选择的角色序号2
     * @param options.selectSummon 使用卡牌时选择的召唤物序号
     * @param options.selectSupport 使用卡牌时选择的支援物序号
     */
    private async _useCard(
        pidx: number, cardIdx: number, options: {
            selectHero?: number, selectHero2?: number, selectSummon?: number,
            selectSupport?: number, isPreview?: boolean,
        } = {}) {
        const { selectHero = -1, selectHero2 = -1, selectSummon = -1, selectSupport = -1, isPreview = false } = options;
        const player = this.players[pidx];
        const opponent = this.players[pidx ^ 1];
        const currCard = player.handCards[cardIdx];
        const hidxs = currCard.canSelectHero == 0 ? [player.hidx] : [selectHero, selectHero2].filter(v => v > -1);
        const handCards = player.handCards.filter((_, ci) => ci != cardIdx);
        if (currCard.type == CARD_TYPE.Support && player.supports.length == MAX_SUPPORT_COUNT) {
            ++player.playerInfo.destroyedSupport;
        }
        const oSupportCnt = player.supports.length;
        if (!isPreview) player.canAction = false;
        const cardres = currCard.handle(currCard, {
            hidxs,
            heros: player.heros,
            eheros: opponent.heros,
            ehidx: opponent.hidx,
            selectSummon,
            summons: player.summons,
            esummons: opponent.summons,
            hcards: player.handCards,
            ehcardsCnt: opponent.handCards.length,
            round: this.round,
            playerInfo: player.playerInfo,
            supports: player.supports,
            esupports: opponent.supports,
            isExec: true,
            slotUse: currCard.type == CARD_TYPE.Equipment,
        });
        player.playerInfo.destroyedSupport += oSupportCnt - player.supports.length;
        let isAction = currCard.hasSubtype(CARD_SUBTYPE.Action);
        let { minusDiceCard } = this._detectSlot(pidx, 'card', { hidxs: allHidxs(player.heros), hcard: currCard, isQuickAction: !isAction });
        await this._execTask();
        const { isInvalid, minusDiceCard: stsmdc, isQuickAction: iqa } = this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'card', { card: currCard, isOnlyFront: true, minusDiceCard });
        await this._execTask();
        const cardcmds = [...(cardres.cmds ?? [])];
        cardcmds.push(...(this._detectSkill(pidx, 'card').cmds ?? []));
        const { cmds: otherCmds } = this._detectSupport(pidx, 'card', { hcard: currCard, minusDiceCard: stsmdc, isQuickAction: !isAction });
        await this._execTask();
        cardcmds.push(...otherCmds);
        if (isInvalid) {
            this.emit(`useCard-${currCard.name}-invalid-${pidx}`, pidx);
        } else {
            if (currCard.type == CARD_TYPE.Equipment) {
                const explIdx = currCard.UI.description.indexOf('；(');
                currCard.UI.description = currCard.UI.description.slice(0, explIdx);
                if (
                    currCard.hasSubtype(CARD_SUBTYPE.Weapon) && player.heros[hidxs[0]].weaponSlot != null ||
                    currCard.hasSubtype(CARD_SUBTYPE.Artifact) && player.heros[hidxs[0]].artifactSlot != null ||
                    currCard.hasSubtype(CARD_SUBTYPE.Talent) && player.heros[hidxs[0]].talentSlot != null
                ) {
                    const { cmds = [] } = this._detectStatus(pidx, STATUS_TYPE.Usage, 'slot-destroy', { isOnlyCombatStatus: true, card: currCard });
                    await this._execTask();
                    cardcmds.push(...cmds);
                }
            } else {
                cardres.exec?.();
            }
            //     aHeros = clone(player.heros);
            const isUseSkill = cardcmds.some(({ cmd }) => cmd == 'useSkill');
            const { ndices, phase = player.phase, willHeals = [], isSwitch = -1, willAttachs = [], willDamages = [], dmgElements = [], elTips = [] }
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
                player.supports.push(...cardres.support);
            }
            if (oSupportCnt - player.supports.length > 0) isSupportDestroy = true;
            if (isSupportDestroy) this._doSupportDestroy(pidx);
            player.summons = this._updateSummon(pidx, cardres.summon ?? [], player.summons, player.combatStatus);
            opponent.summons = this._updateSummon(pidx, [], opponent.summons, opponent.combatStatus);
            const stscmds: Cmds[] = [
                { cmd: 'getStatus', status: cardres.status, hidxs: cardres.hidxs ?? hidxs },
                { cmd: 'getStatus', status: cardres.statusOppo, hidxs: cardres.hidxs ?? hidxs, isOppo: true },
            ];
            this._doCmds(pidx, stscmds);
            if (isAction && !isPreview) player.canAction = false;
            isAction &&= isUseSkill;
            if (isSwitch > -1) {
                this._detectStatus(pidx, STATUS_TYPE.Attack, 'change-from', { isQuickAction: isCdt(!isAction, 2), isSwitchAtk: isUseSkill });
            }
            if (iqa && currCard.hasSubtype(CARD_SUBTYPE.Action)) {
                // todo 如果是快速行动，且卡牌为战斗行动，则以快速心动为优先
            }
            if (ndices) player.dice = ndices;
            player.phase = phase;
            if (isPreview) {
                return { willAttachs }
            }
            this.emit('useCard', pidx, {
                damageVO: {
                    dmgSource: 'card',
                    atkPidx: pidx,
                    atkHidx: -1,
                    tarHidx: opponent.hidx,
                    willDamages,
                    willHeals,
                    dmgElements,
                    elTips,
                }
            });
            await this._execTask();
        }
        const { usedCardIds } = player.playerInfo;
        if (!usedCardIds.includes(currCard.id)) usedCardIds.push(currCard.id);
        if (currCard.hasSubtype(CARD_SUBTYPE.Legend)) player.isUsedLengend = true;
        if (currCard.type == CARD_TYPE.Equipment && !cardres?.isDestroy) { // 装备
            const tarHero = player.heros[hidxs[0]];
            if (currCard.hasSubtype(CARD_SUBTYPE.Weapon)) { // 武器
                tarHero.weaponSlot = clone(currCard);
            } else if (currCard.hasSubtype(CARD_SUBTYPE.Artifact)) { // 圣遗物
                tarHero.artifactSlot = clone(currCard);
            } else if (currCard.hasSubtype(CARD_SUBTYPE.Talent)) { // 天赋
                tarHero.talentSlot = clone(currCard);
            }
        }
        if (currCard.hasSubtype(CARD_SUBTYPE.Action)) {
            if (!isPreview && (currCard.type == CARD_TYPE.Event || isInvalid)) {
                this._changeTurn(pidx, true, 'useCard');
            }
        } else {
            this._doActionBefore(pidx);
        }
        this.log.push(`[${player.name}]使用了[${currCard.name}]`);
        player.handCards = handCards;
    }
    /**
     * 转换回合
     * @param pidx 玩家序号
     * @param isQuickAction 是否为快速行动
     * @param type 发动转换回合的来源
     * @param dieChangeBack 是否为被击倒后重新选择角色
     */
    private _changeTurn(pidx: number, isQuickAction: boolean, type: string, dieChangeBack = false) {// 转变回合人
        const isOppoActionEnd = this.players[pidx ^ 1]?.phase >= PHASE.ACTION_END;
        let canChange = false;
        this.players[pidx].canAction = false;
        let timeout = 2400;
        const isEndAtk = this.taskQueue.isTaskEmpty();
        if (type == 'switchHero') { // 如果有速切或对方结束回合或有额外攻击则不转变回合
            canChange = isEndAtk && (!dieChangeBack && !isOppoActionEnd && !isQuickAction ||
                dieChangeBack && this.players[pidx]?.phase < PHASE.ACTION_END);
            if (isOppoActionEnd) timeout = 2000;
        } else if (['useSkill', 'doSlot', 'doSummon', 'doSite', 'getDamage-status', 'useCard', 'doStatus', 'doSkill'].includes(type)) { // 如果对方已经结束则不转变
            canChange = !isOppoActionEnd && isEndAtk && !isQuickAction;
            if (['doSummon', 'doStatus', 'doSlot', 'doSkill'].includes(type)) timeout = 0;
        } else if (type == 'endPhase') {
            canChange = isEndAtk;
            timeout = 100;
        }
        if (!canChange) timeout = 0;
        this.players.forEach(p => {
            const hasReadySkill = this._getFrontHero(pidx ^ 1).heroStatus.some(sts => sts.hasType(STATUS_TYPE.ReadySkill)) &&
                this._getFrontHero(pidx ^ 1)?.heroStatus.every(sts => !sts.hasType(STATUS_TYPE.NonAction));
            p.canAction = !hasReadySkill && p.phase == PHASE.ACTION && this.taskQueue.isTaskEmpty() && this.isStart;
        });
        setTimeout(async () => {
            if (canChange) {
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
                const curPlayer = this.players[this.currentPlayerIdx];
                if (curPlayer.heros[curPlayer.hidx].heroStatus.every(sts => !sts.hasType(STATUS_TYPE.ReadySkill)) ||
                    curPlayer.heros[curPlayer.hidx].heroStatus.some(sts => sts.hasType(STATUS_TYPE.NonAction))) {
                    curPlayer.canAction = true;
                }
            } else {
                const ephase = this.players[this.currentPlayerIdx ^ 1]?.phase ?? 0;
                if ((ephase > PHASE.ACTION || isQuickAction) && isEndAtk) {
                    this.players[this.currentPlayerIdx].canAction = true;
                }
            }
            this.emit('changeTurn-' + type + '-canChange:' + canChange, pidx, { tip: '{p}回合开始' });
            // todo 上面对于canAction的判断放到下面的函数中
            // this._doActionBefore(this.currentPlayerIdx);
            // this._detectStatus(this.currentPlayerIdx, STATUS_TYPE.ReadySkill, 'useReadySkill', { isOnlyFront: true, isOnlyHeroStatus: true });
            // await this._execTask();
        }, timeout);
    }
    /**
     * 玩家选择行动前
     * @param pidx 玩家序号
     */
    private async _doActionBefore(pidx: number) {
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'action-start', { isOnlyFront: true });
        await this._execTask();
        this._detectSummon(pidx, 'action-start');
        await this._execTask();
        this._detectSupport(pidx, 'action-start');
        await this._execTask();
        this._detectStatus(pidx ^ 1, STATUS_TYPE.Attack, 'action-start-oppo', { isOnlyFront: true });
        await this._execTask();
    }
    /**
     * 玩家执行任意行动后
     * @param pidx 玩家序号
     */
    private async _doActionAfter(pidx: number, isQuickAction = false) {
        this._detectSkill(pidx, 'action-after');
        await this._execTask();
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'status-destroy', { isOnlyFront: true, isQuickAction: isCdt(isQuickAction, 2) });
        await this._execTask();
        this.players[pidx].heros.forEach(h => {
            h.heroStatus = this._updateStatus(pidx, [], h.heroStatus);
        });
        this.players[pidx].combatStatus = this._updateStatus(pidx, [], this.players[pidx].combatStatus);
        this._detectSupport(pidx, 'action-after', { isQuickAction });
        this._detectSupport(pidx ^ 1, 'action-after-oppo', { isQuickAction });
        await this._execTask();
    }
    /**
     * 每回合开始的重置
     */
    private _doReset() {
        this.players.forEach(player => {
            player.playerInfo.discardCnt = 0;
            player.playerInfo.reconcileCnt = 0;
            player.heros.forEach(h => { // 重置技能
                for (let i = 0; i < h.skills.length; ++i) {
                    const skill = h.skills[i];
                    (skill.rskid == -1 ? h.skills[i] : readySkill(skill.rskid, this.version)).handle({ reset: true, hero: h, skidx: i });
                }
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
            if (rCombatStatus.length > 0) player.combatStatus = this._updateStatus(player.pidx, rCombatStatus, player.combatStatus);
        });
    }
    /**
     * 执行回合开始阶段检测
     * @param flag flag
     * @param pidx 玩家序号
     */
    private _doPhaseStart(flag: string, pidx: number) {
        setTimeout(async () => {
            this.phase = PHASE.ACTION_START;
            this.players.forEach(p => p.rollCnt = INIT_ROLL_COUNT);
            this.emit(flag + '-init', pidx, { tip: `第${this.round}轮开始` });
            const exchangeSupprt: [Support, number][] = [];
            for (const cpidx of [this.startIdx, this.startIdx ^ 1]) {
                if (this.round == 1) { // 检测游戏开始 game-start
                    this._detectSkill(cpidx, 'game-start');
                    await this._execTask();
                    this._detectStatus(cpidx, STATUS_TYPE.Usage, 'change-to', { hidxs: [this.players[cpidx].hidx], isQuickAction: 2 });
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
        }, 1e3);
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
            // 回合结束摸牌
            const getCardCmds: Cmds[] = [{ cmd: 'getCard', cnt: 2 }];
            this._doCmds(this.startIdx, getCardCmds);
            await this._execTask();
            this._doCmds(this.startIdx ^ 1, getCardCmds);
            await this._execTask();
            // 持续回合数-1
            this.players.forEach(player => {
                player.heros.forEach((h, hi, a) => {
                    ([...h.heroStatus, ...(h.isFront ? player.combatStatus : [])]).forEach(sts => {
                        if (sts.roundCnt > 0) --sts.roundCnt;
                    });
                    a[hi].heroStatus = this._updateStatus(player.pidx, [], h.heroStatus, true, a, hi);
                });
                player.combatStatus = this._updateStatus(player.pidx, [], player.combatStatus, true, player.heros, player.hidx);
            });
            this.currentPlayerIdx = this.startIdx;
            this.phase = PHASE.DICE;
            ++this.round;
            this.players.forEach(player => {
                player.status = PLAYER_STATUS.WAITING;
                player.phase = PHASE.DICE;
                player.dice = [];
                player.UI.info = '等待对方选择......';
                player.heros.forEach(h => {
                    if (h.hp == 0) h.hp = -1;
                });
            });
            this.emit(flag, pidx);
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
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], ['end-phase', 'any-end-phase'], { phase: PHASE.ACTION_END });
        await this._execTask();
        this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'any-end-phase', { phase: PHASE.ACTION_END });
        await this._execTask();
        this._detectSummon(pidx, 'end-phase');
        await this._execTask();
        player.phase = PHASE.ACTION_END;
        if (this.players[pidx ^ 1].phase != PHASE.ACTION_END) {
            this.startIdx = pidx;
        }
        this.players[this.currentPlayerIdx].canAction = false;
        this._changeTurn(pidx, false, 'endPhase');
        const isActionEnd = this.players.every(p => p.phase == PHASE.ACTION_END);
        this.players.forEach(p => {
            if (isActionEnd) p.UI.info = '结束阶段...';
            else if (p.pidx == this.currentPlayerIdx) p.UI.info = '对方行动中....';
            else p.UI.info = '对方结束已结束回合...';
        });
        this.players[this.currentPlayerIdx ^ 1].canAction = true;
        this.log.push(`[${this.players[pidx].name}]结束了回合`);
        this.emit(flag, pidx);
        if (isActionEnd) { // 双方都结束回合，进入回合结束阶段
            this.phase = PHASE.ACTION_END;
            console.info(`[${this.id}]action-end`);
            this._doPhaseEnd(pidx, flag);
        }
    }
    /**
     * 状态被移除时发动
     * @param pidx 
     */
    private _doStatusDestroy(pidx: number, status: Status) {
        const { heros } = this.players[pidx];
        const { heros: eheros } = this.players[pidx ^ 1];
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'status-destroy', { heros, eheros, cStatus: status, isUnshift: true });
    }
    /**
     * 召唤物消失时发动
     * @param pidx 玩家序号
     */
    private _doSummonDestroy(pidx: number) {
        const { heros } = this.players[pidx];
        const { heros: eheros } = this.players[pidx ^ 1];
        this._detectStatus(pidx, [STATUS_TYPE.Attack, STATUS_TYPE.Usage], 'summon-destroy', { heros, eheros, isUnshift: true });
    }/**
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
     * @param willAttachs 附着元素
     * @param willDamages 伤害
     * @param isSwitch 是否切换角色
     */
    private _doDamage(pidx: number, willAttachs: ElementType[][], damageVO: DamageVO, isSwitch: number = -1) {
        if (damageVO == -1) return;
        let isDie = -1;
        const { willDamages = [] } = damageVO;
        willAttachs;
        win: for (const p of this.players) {
            let heroDie = -1;
            for (const h of p.heros) {
                if (h.hp > 0) {
                    h.hp = Math.max(0, h.hp - willDamages[h.hidx + p.pidx * this.players[0].heros.length].reduce((a, b) => a + Math.max(0, b), 0));
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
                        h.attachElement = [];
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
                    willDamages[h.hidx + (p.pidx ^ 1) * 3] = [-1, 0];
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
                        this.emit('getDamage-heroDie', isDie, { tip: tips });
                    }, 2400);
                }
            }
        }
        const actionInfo = damageVO.dmgSource == 'skill' ? this.log.at(-1) : '';
        this.emit('doDamage', pidx, { damageVO, actionInfo });
    }
    /**
     * 检测治疗
     * @param pidx 玩家序号
     * @param willHeal 治疗量
     * @param heros 治疗角色组
     * @param options.isExec 是否执行
     */
    _doHeal(pidx: number, willHeal: number[], heros: Hero[], options: { isExec?: boolean } = {}) {
        const { isExec = true } = options;
        const supportCnt = this.players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        const heal = willHeal.map(v => Math.max(-1, v) % 100);
        if (heal.some(hl => hl > -1)) {
            heal.forEach((h, hi) => {
                if (h > -1) this._detectSkill(pidx, 'heal', { hidxs: hi, heros, heal, isExec });
            });
            this._detectSlot(pidx, 'heal', { hidxs: allHidxs(heros), heal, heros, isExec });
            this._detectStatus(pidx, STATUS_TYPE.Usage, 'heal', { heal, heros, isExec });
            const { supportCnt: sptCnt } = this._detectSupport(pidx, 'heal', { heal, isExec });
            this._detectSupport(pidx ^ 1, 'heal-oppo', { heal, isExec });
            if (!isExec) supportCnt[pidx].forEach((_, i, a) => a[i] += sptCnt[pidx][i]);
        }
        return { supportCnt }
    }
    /**
     * 弃牌后的处理
     * @param pidx 玩家序号
     * @param cards 弃牌
     * @param options heros 角色组, isAction 是否为战斗行动
     */
    private _doDiscard(pidx: number, cards: Card[], options: { heros?: Hero[], isAction?: boolean } = {}) {
        const { heros = this.players[pidx].heros, isAction = false } = options;
        const summons: Summon[] = [];
        const cmds: Cmds[] = [];
        for (const card of cards) {
            const cardres = card.handle(card, { trigger: 'discard' });
            if (this._hasNotTriggered(cardres.trigger, 'discard')) continue;
            const { cmds: cardcmds = [] } = this._doCmds(pidx, cardres.cmds);
            cmds.push(...cardcmds);
            summons.push(...(cardres.summon ?? []));
        }
        this._detectSkill(pidx, 'discard', { heros, discards: cards });
        this._detectStatus(pidx, STATUS_TYPE.Usage, 'discard', { discards: cards, heros, isQuickAction: isCdt(!isAction, 2) });
        this._detectSupport(pidx, 'discard', { discard: cards.length, isQuickAction: !isAction });
        return { cmds, summons }
    }
    /**
     * 状态攻击
     */
    _doStatusAtk(stsTask: StatusTask) {
        return new Promise<boolean>(async resolve => {
            if (!this._hasNotDieChange() || !this.taskQueue.isExecuting) {
                resolve(false);
                return;
            }
            const { entityId, group, pidx, isSelf = 0, trigger = '', hidx: ohidx = this.players[pidx].hidx,
                isSwitchAtk: isa = false, isAfterSwitch = false } = stsTask;
            let { isQuickAction = false } = stsTask;
            if (isAfterSwitch) await delay(2300);
            let { heros: aheros, hidx: ahidx, summons: aSummon, pile, handCards: { length: hcardsCnt }, combatStatus } = this.players[pidx];
            let { heros: eheros, hidx: eFrontIdx } = this.players[pidx ^ 1];
            ahidx = group == STATUS_GROUP.combatStatus ? ahidx : ohidx;
            const getAtkStatus = () => (group == STATUS_GROUP.heroStatus ? aheros[ahidx].heroStatus : combatStatus).find(sts => sts.entityId = entityId)!;
            const atkedIdx = isSelf ? ahidx : eFrontIdx;
            if (getAtkStatus() == undefined) {
                resolve(true);
                return;
            }
            const stsres = getAtkStatus().handle(getAtkStatus(), {
                heros: aheros,
                eheros,
                trigger,
                hidx: ahidx,
                pile,
                summons: aSummon,
                hcardsCnt,
                force: true,
            });
            const stsreshidxs = stsres.hidxs ?? getBackHidxs(isSelf ? aheros : eheros);
            let { willDamages, dmgElements, players: players1, elrcmds, elTips, isQuickAction: iqa }
                = this._calcDamage(
                    pidx ^ isSelf,
                    (stsres.element ?? ELEMENT_TYPE.Physical) as ElementType,
                    new Array((isSelf ? aheros : eheros).length).fill(0).map((_, i) => [
                        i == atkedIdx ? (stsres.damage ?? -1) : -1,
                        (stsreshidxs.includes(i)) ? (stsres.pdmg ?? 0) : 0,
                    ]),
                    atkedIdx,
                    this.players,
                    { isSelf, skidx: isCdt(trigger.includes('skill'), -2) }
                );
            isQuickAction ||= iqa;
            this.players.forEach((_, i, a) => a[i] = players1[i]);
            const { cmds: execmds = [] } = stsres.exec?.(getAtkStatus(), { heros: aheros, summons: this.players[pidx].summons }) ?? {};
            let willHeals: number[] = [];
            const cmds = [...(stsres.cmds ?? []), ...(execmds ?? []), ...elrcmds[0]];
            this._doCmds(pidx ^ isSelf ^ 1, elrcmds[1], { heros: isSelf ? aheros : eheros });
            if (stsres.heal) cmds.push({ cmd: 'heal', cnt: stsres.heal, hidxs: stsres.hidxs });
            if (cmds.length > 0) {
                const { willHeals: cmdheal, ndices } = this._doCmds(pidx, cmds, { heros: aheros, summons: this.players[pidx].summons });
                if (cmdheal) willHeals = cmdheal;
                if (ndices) this.players[pidx].dice = ndices;
            }
            let isSwitchAtk = isa;
            if (!isSelf && elrcmds[0].some(cmds => cmds.cmd?.includes('switch') && cmds.isOppo)) {
                const { statusAtks: stpidx } = this._detectStatus(pidx ^ 1, STATUS_TYPE.Attack, ['change-from', 'change-to'], { hidxs: [eFrontIdx] });
                if (stpidx.length > 0) isSwitchAtk = true;
            }
            if (isQuickAction) {
                // todo 是否为快速行动
            }
            if (isSwitchAtk) {
                // todo 是否为切换攻击
            }
            this.emit(`_doStatusAtk-${getAtkStatus().name}`, pidx, {
                damageVO: {
                    dmgSource: 'status',
                    atkPidx: pidx ^ isSelf,
                    atkHidx: -1,
                    tarHidx: atkedIdx,
                    willDamages,
                    dmgElements,
                    elTips,
                    willHeals,
                }
            })
            // this.socket.emit('sendToServer', {
            //     statusId: [sid, stype, ahidx, isa, isQuickAction || iqa],
            //     cpidx: pidx,
            //     summonee,
            //     heros: aheros,
            //     eheros,
            //     esummon: isSelf ? asummon : esummon,
            //     willDamage,
            //     dmgElements,
            //     elTips,
            //     willHeals: isCdt(!!stsres.heal, willHeals[0]),
            //     dices,
            //     cmds,
            //     playerInfo: this.players[pidx].playerInfo,
            //     isEndAtk: this.taskQueue.isTaskEmpty() && !isSwitchAtk && !isa,
            //     step: 1,
            //     flag: `_doStatusAtk-${sid}-${pidx}`,
            // });
            await delay(1700);
            resolve(true);
        });
    }
    /**
    * 检测技能发动
    * @param pidx 玩家序号
    * @param hidx 发动技能角色的索引idx
    * @param trigger 触发的时机
    * @param options players 玩家组, heros 角色组, eheros 敌方角色组, isExec 是否执行, getdmg 受到伤害数, cskidx 只检测某技能,
    *                heal 回血数, discards 我方弃牌, dmg 造成的伤害, hidxs 只检测某些序号角色,
    *                isExecTask 是否为执行任务
    * @returns isQuickAction: 是否为快速行动, heros 变化后的我方角色组, eheros 变化后的对方角色组, isTriggered 是否触发被动
    */
    _detectSkill(pidx: number, otrigger: Trigger | Trigger[],
        options: {
            players?: Player[], heros?: Hero[], eheros?: Hero[], hidxs?: number[] | number, cskidx?: number,
            isExec?: boolean, getdmg?: number[], heal?: number[], discards?: Card[], isExecTask?: boolean,
            dmg?: number[],
        } = {}
    ) {
        const { players = this.players, isExec = true, getdmg = [], dmg = [], heal = [], discards = [],
            isExecTask = false, heros = players[pidx].heros, eheros = players[pidx ^ 1].heros, cskidx = -1 } = options;
        let { hidxs = [] } = options;
        let isTriggered = false;
        let isQuickAction = false;
        const cmds: Cmds[] = [];
        const task: [() => void, number][] = [];
        if (!Array.isArray(hidxs)) hidxs = [hidxs];
        for (const hidx of hidxs ?? allHidxs(heros)) {
            const hero = heros[hidx];
            const skills = hero.skills;
            const triggers: Trigger[] = [];
            if (typeof otrigger == 'string') triggers.push(otrigger);
            else triggers.push(...otrigger);
            for (let skidx = 0; skidx < skills.length; ++skidx) {
                if (cskidx > -1 && cskidx != skidx) continue;
                const skill = skills[skidx];
                for (const trigger of triggers) {
                    const skillres = skill.handle({
                        hero,
                        skidx,
                        getdmg,
                        trigger,
                        heros,
                        heal,
                        discards,
                        dmg,
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
                                args[1] = {
                                    ...(clone(args[1]) ?? {}),
                                    isExecTask: true,
                                    cskill: skidx,
                                    hidxs: hidx,
                                    heros: undefined,
                                    eheros: undefined,
                                };
                                this.taskQueue.addTask('skill-' + skill.name, args);
                            } else {
                                let intvl = 1000;
                                if (cmds.some(({ cmd }) => cmd == 'addCard')) intvl += 1200;
                                if (cmds.some(({ cmd }) => cmd == 'getCard')) intvl += 1500;
                                const skillHandle = () => {
                                    this._doCmds(pidx, cmds, { heros, eheros, isExec });
                                    this.emit(`_doSkill-${skill.name}`, pidx);
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
     *                        heal 回血量, heros 我方角色组, eheros 敌方角色组, hcard 使用的牌, isChargedAtk 是否为重击, isSkill 使用技能的idx, 
     *                        taskMark 任务标记, isFallAtk 是否为下落攻击, isExec 是否执行task(配合新heros), dieChangeBack 是否为死后切换角色,
     *                        card 可能要装备的卡, usedDice 使用的骰子数, ehidx 被攻击角色的idx, minusDiceCard 用卡减骰子, isSummon 是否为召唤物攻击
     *                        minusDiceSkillIds 用技能减骰子id, isExecTask 是否执行任务队列, getdmg 受到的伤害, isQuickAction 是否为快速攻击,
     *                        isUnshift 是否立即加入task,
     * @returns willHeals 将要回血, switchHeroDiceCnt 切换角色需要骰子, addDmg 条件加伤, heroStatus 新增角色状态, combatStatus 新增出战状态,
     *          addDmgSummon 召唤物加伤, nsummons 新出的召唤物, isQuickAction 是否为快速攻击, supportCnt 支援区的变化数
     */
    private _detectSlot(pidx: number, otriggers: Trigger | Trigger[], options: {
        players?: Player[], hidxs?: number | number[], summons?: Summon[], ehidx?: number, card?: Card | null, taskMark?: [number, CardSubtype],
        switchHeroDiceCnt?: number, heal?: number[], heros?: Hero[], eheros?: Hero[], minusDiceCard?: number, isUnshift?: boolean,
        hcard?: Card, isChargedAtk?: boolean, isFallAtk?: boolean, isSkill?: number, isSummon?: number,
        isExec?: boolean, intvl?: number[], usedDice?: number, isQuickAction?: boolean, getdmg?: number[],
        minusDiceSkillIds?: number[],
    } = {}) {
        const triggers: Trigger[] = [];
        if (typeof otriggers == 'string') triggers.push(otriggers);
        else triggers.push(...otriggers);
        const { players = this.players, summons = players[pidx].summons, heal, hcard, ehidx = players[pidx ^ 1].hidx,
            heros = players[pidx].heros, eheros = players[pidx ^ 1].heros, taskMark, isUnshift = false, minusDiceSkillIds = [],
            isChargedAtk = false, isFallAtk = players[pidx].isFallAtk, isExec = true, card, isSummon = -1,
            isSkill = -1, usedDice = 0, getdmg } = options;
        const player = players[pidx];
        let { switchHeroDiceCnt = 0, minusDiceCard = 0, hidxs = [player.hidx], isQuickAction = false } = options;
        let addDmg = 0;
        let addDmgSummon = 0;
        const heroStatus: Status[] = [];
        const combatStatus: Status[] = [];
        let nsummons: Summon[] = [];
        const cmds: Cmds[] = [];
        let minusDiceHero = 0;
        const task: [() => void, number][] = [];
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
            if (card?.type == CARD_TYPE.Equipment && slots.every(slot => slot?.entityId != card.entityId) && fHero.id == card.userType) slots.push(card);
            for (const slot of slots) {
                if (slot == null || (taskMark && !slot.hasSubtype(taskMark[1]))) continue;
                const tcmds: Cmds[] = [];
                let isAddTask: boolean = false;
                for (const trigger of triggers) {
                    const slotres = slot.handle(slot, {
                        heros,
                        hidxs: [hidx],
                        eheros,
                        ehidx,
                        summons,
                        trigger,
                        switchHeroDiceCnt,
                        hcard,
                        heal,
                        isChargedAtk,
                        isFallAtk,
                        hcards: player.handCards,
                        dicesCnt: player.dice.length - usedDice,
                        isSkill,
                        isSummon,
                        isExec,
                        minusDiceCard,
                        isMinusDiceSkill: minusDiceSkillIds.includes(slot.entityId),
                        getdmg,
                        playerInfo: player.playerInfo,
                        isExecTask: !!taskMark,
                    });
                    if (this._hasNotTriggered(slotres.trigger, trigger)) continue;
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
                    heroStatus.push(...slotsts.filter(s => s.group == STATUS_GROUP.heroStatus))
                    combatStatus.push(...slotsts.filter(s => s.group == STATUS_GROUP.combatStatus));
                    const slotstsop = slotres.statusOppo ?? [];
                    const hstop = slotstsop.filter(s => s.group == STATUS_GROUP.heroStatus);
                    const cstop = slotstsop.filter(s => s.group == STATUS_GROUP.combatStatus);
                    if (hstop.length > 0) {
                        (slotres.hidxs ?? [eheros.findIndex(h => h.isFront)]).forEach(hi => {
                            eheros[hi].heroStatus = this._updateStatus(pidx ^ 1, hstop, eheros[hi].heroStatus);
                        });
                    }
                    if (cstop.length > 0) {
                        players[pidx ^ 1].combatStatus = this._updateStatus(pidx ^ 1, cstop, players[pidx ^ 1].combatStatus);
                    }
                }
                if (isExec && (tcmds.length > 0 || isAddTask)) {
                    if (!taskMark) {
                        const args = clone(Array.from(arguments));
                        args[1] = {
                            ...(clone(args[1]) ?? {}),
                            taskMark: [hidx, slot.subType[0]],
                            heros: undefined,
                            eheros: undefined,
                        };
                        this.taskQueue.addTask('slot-' + slot.name, args, isUnshift);
                    } else {
                        const slotHandle = () => {
                            if (!isAddTask || tcmds.length > 0) {
                                const { ndices } = this._doCmds(pidx, tcmds, { heros, eheros });
                                if (ndices != undefined) players[pidx].dice = ndices;
                            }
                            this.emit(`_doSlot-${slot.name}`, pidx);
                        };
                        task.push([slotHandle, 800]);
                    }
                }
            }
        }
        const { willHeals, supportCnt } = this._doCmds(pidx, cmds, { isExec: false });
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
     *                phase 当前最新阶段, players 最新玩家信息, hidxs 只执行某几个角色, hidx 用于指定角色(目前只用于断流), heal 回血数,
     *                card 使用的卡, isOnlyHeroStatus 是否只执行角色状态, isOnlyCombatStatus 是否只执行出战状态, heros 当前角色组, eheros 敌人角色组,
     *                isSwitchAtk 是否切换攻击角色, taskMark 任务标记, skilltype 使用技能的类型, isSummon 触发的召唤物, discards 舍弃牌,
     *                isUnshift 是否插入执行, dmgSource 伤害来源id, getDmgIdx 受击角色序号, hasDmg 是否造成伤害, minusDiceSkillIds 减骰id,
     *                isReadySkill 是否为准备技能, source 触发来源id, cStatus 只检测这一个状态
     * @returns isQuickAction 是否有快速行动, minusDiceHero 减少切换角色的骰子,switchHeroDiceCnt 实际减少切换角色的骰子, cmds 要执行的命令, 
     *          statusIdsAndPidx 额外攻击, isInvalid 使用卡是否有效, minusDiceCard 使用卡减少骰子
    */
    private _detectStatus(pidx: number, otypes: StatusType | StatusType[], otrigger: Trigger | Trigger[],
        options: {
            isQuickAction?: boolean | number, isExec?: boolean, isOnlyFront?: boolean, switchHeroDiceCnt?: number, heal?: number[],
            phase?: number, players?: Player[], hidxs?: number[], hidx?: number, skilltype?: SkillType, card?: Card, discards?: Card[],
            isOnlyHeroStatus?: boolean, isOnlyCombatStatus?: boolean, heros?: Hero[], minusDiceCard?: number, isSummon?: number, cStatus?: Status,
            eheros?: Hero[], isUnshift?: boolean, isSwitchAtk?: boolean, taskMark?: number[], dmgSource?: number, getDmgIdx?: number,
            hasDmg?: boolean, minusDiceSkillIds?: number[], isReadySkill?: boolean, source?: number, isChargedAtk?: boolean, isFallAtk?: boolean,
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
            hidxs, hidx: ophidx = -1, card, isOnlyHeroStatus = false, isOnlyCombatStatus = false, heal, discards = [],
            isUnshift = false, isSwitchAtk = false, taskMark, skilltype, isSummon = -1, dmgSource = -1, getDmgIdx = -1,
            minusDiceSkillIds = [], isReadySkill = false, source = -1, isChargedAtk = false, isFallAtk = false, cStatus } = options;
        let addDiceHero = 0;
        let minusDiceHero = 0;
        let isInvalid = false;
        const cmds: Cmds[] = [];
        const statusAtks: StatusTask[] = [];
        const statusAtksPre: StatusTask[] = [];
        let readySkill = -1;
        let iqa = false;
        const task: [() => void, number][] = [];
        let addDmg = 0;
        let getDmg = 0;
        let addDmgSummon = 0;
        const nsummons: Summon[] = [];
        const pdmgs: [number, number[] | undefined, boolean][] = [];
        const player = players[pidx];
        const pheros = options.heros ?? player.heros;
        const peheros = options.eheros ?? players[pidx ^ 1].heros;
        const detectStatus = (stses: Status | Status[], group: StatusGroup, hidx: number, trigger: Trigger) => {
            if (!Array.isArray(stses)) stses = [stses];
            for (const sts of stses) {
                const isDiffTaskMark = taskMark && ((group == STATUS_GROUP.heroStatus && taskMark[0] != hidx) || taskMark[1] != group || taskMark[2] != sts.id);
                if (!sts.hasType(...types) || isDiffTaskMark) continue;
                const stsres = sts.handle(sts, {
                    heros: pheros,
                    eheros: peheros,
                    hidx,
                    trigger,
                    hidxs: [ophidx],
                    phase: pidx == player.phase ? phase : player.phase,
                    card,
                    discards,
                    minusDiceCard,
                    heal,
                    summons: player.summons,
                    esummons: players[pidx ^ 1].summons,
                    hcardsCnt: player.handCards.length,
                    pile: player.pile,
                    playerInfo: player.playerInfo,
                    skilltype,
                    isSummon,
                    isFallAtk,
                    isChargedAtk,
                    dmgSource,
                    getDmgIdx,
                    hasDmg,
                    source,
                    isMinusDiceSkill: minusDiceSkillIds.includes(sts.entityId),
                });
                if (sts.hasType(STATUS_TYPE.AddDamage) && (!this._hasNotTriggered(stsres.trigger, trigger) || isReadySkill)) {
                    addDmg += stsres.addDmgCdt ?? 0;
                    getDmg += stsres.getDmg ?? 0;
                    addDmgSummon += stsres.addDmgSummon ?? 0;
                }
                if (this._hasNotTriggered(stsres.trigger, trigger)) continue;
                const isTriggeredQuick = isQuickAction == 0 && stsres.isQuickAction;
                if (group == STATUS_GROUP.combatStatus) {
                    if (isQuickAction == 1 && stsres.isQuickAction && stsres.minusDiceHero == undefined) continue;
                    if (isQuickAction < 2) isQuickAction = Number(stsres.isQuickAction ?? false);
                }
                addDiceHero += stsres.addDiceHero ?? 0;
                minusDiceHero += stsres.minusDiceHero ?? 0;
                minusDiceCard += stsres.minusDiceCard ?? 0;
                nsummons.push(...(stsres.summon ?? []));
                if (!sts.hasType(STATUS_TYPE.Attack) && stsres.pdmg) pdmgs.push([stsres.pdmg, stsres.hidxs, !!stsres.isSelf])
                isInvalid ||= stsres.isInvalid ?? false;
                let stsiqa = isQuickAction == 2 || (!!card && !card.subType.includes(CARD_SUBTYPE.Action)) || !!stsres.isQuickAction;
                if (isExec && types.includes(STATUS_TYPE.Attack) && (stsres.damage || stsres.pdmg || stsres.heal)) {
                    (trigger == 'getdmg' ? statusAtksPre : statusAtks).push({
                        entityId: sts.entityId,
                        group,
                        pidx,
                        isSelf: +!!stsres.isSelf,
                        trigger,
                        hidx,
                        isSwitchAtk,
                        isQuickAction: stsiqa || trigger.startsWith('action-start')
                    });
                }
                iqa ||= stsiqa;
                if (isExec) {
                    const stsexecres = stsres.exec?.(undefined, { switchHeroDiceCnt, isQuickAction: isTriggeredQuick });
                    switchHeroDiceCnt = stsexecres?.switchHeroDiceCnt ?? switchHeroDiceCnt;
                    const stscmds = [...(stsres.cmds ?? []), ...(stsexecres?.cmds ?? [])];
                    cmds.push(...stscmds);
                    if (stsres.isAddTask || ((!types.includes(STATUS_TYPE.Attack) || !sts.hasType(STATUS_TYPE.Attack)) && !stsres.damage && !stsres.pdmg && !stsres.heal)) {
                        let intvl = 1000;
                        if (stsres.damage || stsres.pdmg) intvl = 2000;
                        if (!taskMark) {
                            const args = clone(Array.from(arguments));
                            args[3] = {
                                ...(clone(args[3]) ?? {}),
                                taskMark: [hidx, group, sts.id],
                            };
                            this.taskQueue.addTask('status-' + sts.name, args, isUnshift);
                        } else {
                            const statusHandle = async () => { // 回血
                                return new Promise<void>(async resolve => {
                                    console.info(`[${player.name}]${trigger}:${sts.name}.useCnt:${sts.useCnt}->${sts.useCnt - 1}`);
                                    let aheros: Hero[] = this.players[pidx].heros;
                                    let asummon: Summon[] = this.players[pidx].summons;
                                    const ahidx = players[pidx].hidx;
                                    const { ndices } = this._doCmds(pidx, stscmds, {
                                        hidxs: [group == STATUS_GROUP.combatStatus ? ahidx : hidx],
                                        heros: aheros,
                                        summons: asummon,
                                    });
                                    if (ndices) player.dice = ndices;
                                    const curStatus = (group == 0 ? aheros[hidx].heroStatus : players[pidx].combatStatus).find(s => s.entityId == sts.entityId);
                                    if (!curStatus) return;
                                    stsres.exec?.(curStatus, { heros: aheros });
                                    const flag = `_doStatus-${group == 0 ? 'hero' : 'combat'}Status-task-${curStatus.name}`;
                                    this.log.push(`[${this.players[pidx].name}][${curStatus.name}]发动`);
                                    this.emit(flag, pidx);
                                    if (curStatus.useCnt == 0) {
                                        await delay(intvl + 300);
                                        if (group == 0) {
                                            aheros[hidx].heroStatus = this._updateStatus(pidx, [], aheros[hidx].heroStatus, true, aheros, hidx);
                                        } else {
                                            players[pidx].combatStatus = this._updateStatus(pidx, [], players[pidx].combatStatus, true, aheros, hidx);
                                        }
                                        this.emit(flag + '-destroy', pidx);
                                    }
                                    resolve();
                                });
                            };
                            task.push([statusHandle, intvl]);
                        }
                    } else {
                        this._doCmds(pidx, stscmds, { heros: pheros, eheros: peheros, hidxs: [hidx], source: sts.id });
                    }
                    if (trigger == 'useReadySkill') {
                        if (isExec) players[pidx].canAction = false;
                        readySkill = stsres.skill ?? -1;
                    }
                }
            }
        }
        for (const trigger of triggers) {
            for (let i = 0; i < pheros.length; ++i) {
                const hidx = (i + player.hidx) % pheros.length;
                let h = pheros[hidx];
                if ((hidxs ?? [hidx]).includes(hidx) && (h.isFront || (!isOnlyCombatStatus && !isOnlyFront))) {
                    if (!isOnlyCombatStatus) detectStatus(isCdt(cStatus?.group == STATUS_GROUP.heroStatus, cStatus) ?? h.heroStatus, STATUS_GROUP.heroStatus, hidx, trigger);
                }
                if (i == 0 && !isOnlyHeroStatus) detectStatus(isCdt(cStatus?.group == STATUS_GROUP.combatStatus, cStatus) ?? player.combatStatus, STATUS_GROUP.combatStatus, player.hidx, trigger);
            }
        }
        if (isExec && !taskMark) {
            this.taskQueue.addStatusAtk(statusAtks, isUnshift);
            this.taskQueue.addStatusAtk(statusAtksPre, true);
        }
        if (readySkill > -1) setTimeout(() => this._useSkill(pidx, readySkill, { isReadySkill: true }), 1200);
        const { willHeals, supportCnt } = this._doCmds(pidx, cmds, { heros: pheros, eheros: peheros, isExec: false })
        return {
            isQuickAction: !!isQuickAction || iqa, addDiceHero, minusDiceHero, switchHeroDiceCnt, cmds, statusAtks, isInvalid, minusDiceCard, task,
            addDmg, getDmg, addDmgSummon, nsummons, willHeals, supportCnt, pdmgs,
        }
    }
    /**
     * 召唤物效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param options isUnshift 是否前插入事件, csummon 当前的召唤物, isExec 是否执行召唤物攻击, hasDmg 是否造成伤害, isExecTask 是否执行任务队列,
     *                hcard 使用的牌, minusDiceSkillIds 减骰id, isSkill 使用技能idx, tsummon 执行task的召唤物, hidx 当前出战角色
     *                players 当前玩家数组, eheros 当前敌方角色组, tround 当前触发回合
     * @returns smncmds 命令集, addDmg 加伤, addDiceHero 增加切换角色骰子数, switchHeroDiceCnt 改变骰子数, minusDiceSkill 用技能减骰子, willheals 将回血数
     */
    private _detectSummon(pidx: number, ostate: Trigger | Trigger[],
        options: {
            isUnshift?: boolean, csummon?: Summon[], isExec?: boolean, hasDmg?: boolean, isExecTask?: boolean, hidx?: number,
            hcard?: Card, minusDiceSkillIds?: number[], isSkill?: number, tsummon?: Summon[],
            players?: Player[], heros?: Hero[], eheros?: Hero[], tround?: number,
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostate == 'string') states.push(ostate);
        else states.push(...ostate);
        const { isUnshift = false, csummon, isExec = true, hasDmg = false, minusDiceSkillIds = [],
            players = this.players, hcard, isExecTask = false, isSkill = -1, tsummon, tround = 0,
            hidx = players[pidx].hidx, heros = players[pidx].heros, eheros = players[pidx ^ 1].heros, } = options;
        const player = players[pidx];
        const isChargedAtk = player.dice.length % 2 == 0;
        const smncmds: Cmds[] = [];
        let addDmg = 0;
        let addDiceHero = 0;
        let switchHeroDiceCnt = 0;
        const task: [() => void, number][] = [];
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
                    isExec,
                    minusDiceSkillIds,
                    isSkill,
                    tround,
                    force: isExecTask,
                });
                if (this._hasNotTriggered(summonres.trigger, state)) continue;
                if (summonres.isNotAddTask) {
                    addDmg += summonres.addDmgCdt ?? 0;
                    addDiceHero += summonres.addDiceHero ?? 0;
                    if (!isExec) continue;
                    if (summonres.exec && (!hasDmg || summonres.damage == undefined)) {
                        const { cmds = [], switchHeroDiceCnt: smnDiceCnt = 0 } = summonres.exec?.({ summon, eheros }) ?? {};
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
                if (state.startsWith('skill')) intvl = 2100;
                if (isExec) {
                    if (!isExecTask) {
                        const args = clone(Array.from(arguments));
                        args[2] = {
                            ...(clone(args[2]) ?? {}),
                            isExecTask: true,
                            tsummon: [summon],
                        };
                        this.taskQueue.addTask('summon-' + summon.name, args, isUnshift);
                    } else {
                        let aSummon = csummon ?? [...player.summons];
                        // let fIsEndAtk = true;
                        const summonHandle1 = async () => {
                            console.info(`[${player.name}]${state}:${summon.name}.useCnt:${summon.useCnt}->${summon.useCnt - 1}`);
                            const smnexecres = summonres.exec?.({ summon: summon, heros: this.players[pidx].heros, eheros: this.players[pidx ^ 1].heros });
                            if (smnexecres?.cmds) {
                                let { heros: eHeros, hidx: eFrontIdx } = this.players[pidx ^ 1];
                                let { heros: aHeros } = this.players[pidx];
                                const { changedEl, ndices } = this._doCmds(pidx, smnexecres.cmds, { heal: summon.shieldOrHeal, heros: aHeros });
                                if (changedEl) summon.element = changedEl;
                                if (ndices) player.dice = ndices;
                                const smnIdx = aSummon.findIndex(smn => smn.id == summon.id);
                                aSummon[smnIdx] = summon;
                                // let isSwitchAtk = false;
                                const damages = (isOppo: boolean = false, cnt?: number, element?: DamageType, hidxs?: number[]) =>
                                    new Array((isOppo ? aHeros : eHeros).length).fill(0).map((_, i) => [
                                        i == eFrontIdx && (element ?? summon.element) != DAMAGE_TYPE.Pierce ? ((cnt ?? summon.damage) || -1) : -1,
                                        summon.pdmg && (hidxs ?? getBackHidxs(eHeros)).includes(i) ? element == DAMAGE_TYPE.Pierce ? (cnt ?? 0) : summon.pdmg : 0,
                                    ]);
                                const { atkedIdx: [tarHidx] = [-1], willDamages = [], willHeals = [], dmgElements = [], elTips = [] }
                                    = this._doCmds(pidx, smncmds, { damages });
                                if (summon)
                                    // this._doCmds(pidx ^ 1, ecmds, { heros: eheros });
                                    this.emit(`_doSummon-${summon.name}`, pidx, {
                                        damageVO: {
                                            dmgSource: 'summon',
                                            atkPidx: pidx,
                                            atkHidx: -1,
                                            tarHidx,
                                            willDamages,
                                            willHeals,
                                            dmgElements,
                                            elTips,
                                        }

                                    });
                                await delay(1000);
                                players[pidx].summons = this._updateSummon(pidx, [], aSummon, this.players[pidx].combatStatus, true, { trigger: state });
                                const tround = summonres.tround ?? 0;
                                if (tround > 0) {
                                    const args = clone(Array.from(arguments));
                                    args[2] = clone(args[2]) ?? {};
                                    args[2].tsummon = [summon];
                                    args[2].tround = tround;
                                    this.taskQueue.addTask('summon-' + summon.name, args, true);
                                }
                            }
                        };
                        task.push([summonHandle1, intvl]);
                    }
                }
            }
        }
        const { willHeals } = this._doCmds(pidx, smncmds, { isExec: false });
        return { smncmds, addDmg, addDiceHero, switchHeroDiceCnt, willHeals, csummon, task }
    }
    /**
     * 支援物效果发动
     * @param pidx 玩家idx
     * @param state 触发状态
     * @param options switchHeroDiceCnt 切换需要的骰子, hcard 使用的牌, players 最新的玩家信息, summonDiffCnt 减少的召唤物数量, 
     *                hidx 将要切换的玩家, minusDiceSkill 用技能减骰子, isExecTask 是否执行任务队列, isExec 是否执行, firstPlayer 先手玩家pidx,
     *                getdmg 受伤量, heal 回血量, getcard 本次摸牌数, discard 本次舍弃牌数
     * @returns isQuickAction 是否快速行动, cmds 命令集, exchangeSupport 交换的支援牌, outStatus 出战状态, minusDiceHero 减少切换角色骰子, supportCnt 支援区数量,
     *          minusDiceCard 减少使用卡骰子, minusDiceSkill 用技能减骰子
     */
    private _detectSupport(pidx: number, ostates: Trigger | Trigger[],
        options: {
            switchHeroDiceCnt?: number, hcard?: Card, players?: Player[], summonDiffCnt?: number, firstPlayer?: number,
            isExec?: boolean, isQuickAction?: boolean, minusDiceCard?: number, csupport?: Support[], hidx?: number, isSkill?: number,
            minusDiceSkillIds?: number[], isExecTask?: boolean, getdmg?: number[], heal?: number[], discard?: number,
        } = {}) {
        const states: Trigger[] = [];
        if (typeof ostates == 'string') states.push(ostates);
        else states.push(...ostates);
        const { hcard, players = this.players, isExec = true, firstPlayer = -1, hidx = -1, isSkill = -1,
            isExecTask = false, csupport, getdmg, heal, discard = 0, minusDiceSkillIds = [] } = options;
        let { switchHeroDiceCnt = 0, summonDiffCnt = 0, isQuickAction = false, minusDiceCard = 0 } = options;
        const exchangeSupport: [Support, number][] = [];
        const cmds: Cmds[] = [];
        let minusDiceHero = 0;
        const supportCnt = players.map(() => new Array<number>(MAX_SUPPORT_COUNT).fill(0));
        const task: [() => void, number][] = [];
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
                    hidxs: [player.hidx],
                    hidx,
                    card: hcard,
                    hcards: players[pidx].handCards.concat(players[pidx].UI.willGetCard),
                    isFirst: firstPlayer == pidx,
                    playerInfo: player.playerInfo,
                    minusDiceCard,
                    isSkill,
                    minusDiceSkillIds,
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
                        const supportexecres = supportres.exec?.({ isQuickAction, switchHeroDiceCnt, summonDiffCnt });
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
                            this.taskQueue.addTask('support-' + support.card.name + support.entityId, args);
                        } else {
                            let curIntvl = 800;
                            const supportHandle = async () => {
                                const supportexecres = supportres.exec?.({ isQuickAction, switchHeroDiceCnt, summonDiffCnt }) ?? { isDestroy: false };
                                console.info(`[${player.name}]${state}:${support.card.name}-${support.entityId}.cnt:${support.cnt}.perCnt:${support.perCnt}`);
                                if (supportexecres.cmds) {
                                    if (supportexecres.cmds.some(({ cmd }) => cmd == 'getCard')) curIntvl = 2000;
                                    if (supportexecres.cmds.some(({ cmd }) => cmd == 'heal')) curIntvl = 1000;
                                }
                                // const { ndices, heros: nh } = this._doCmds(pidx, supportexecres.cmds, { summons: this.players[pidx].summons });
                                // const heros = nh ?? this.players[pidx].heros;
                                this.players[pidx].summons = this._updateSummon(pidx, supportres.summon ?? [], this.players[pidx].summons, this.players[pidx].combatStatus);
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
                                isQuickAction ||= state.startsWith('action-start');
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
     * @param element 获取骰子元素 -3为当前出战角色下一个角色元素 -2为当前出战角色元素 -1为随机不重复骰子 数字为所有一样 数组为指定元素
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
     *                ahidx 攻击角色序号, ehidx 受击角色序号, isAction 是否为战斗行动, source 触发来源的id, isNotAddTask 是否不加入task,
     * @returns ndices 骰子, phase 阶段, heros 角色组, eheros 敌方角色组, heroStatus 获得角色状态, willHeals 回血组, changedEl 变化元素
     */
    _doCmds(pidx: number, cmds?: Cmds[],
        options: {
            players?: Player[], withCard?: Card, hidxs?: number[], heal?: number, isAction?: boolean, source?: number,
            isExec?: boolean, heros?: Hero[], eheros?: Hero[], ahidx?: number, ehidx?: number,
            summons?: Summon[], isNotAddTask?: boolean, diceSelect?: boolean[], socket?: Socket,
            damages?: (isOppo?: boolean, cnt?: number, element?: DamageType, hidxs?: number[]) => number[][],
        } = {}
    ): {
        cmds?: Cmds[], ndices?: DiceCostType[], phase?: Phase, heros?: Hero[], eheros?: Hero[], willHeals?: number[],
        changedEl?: ElementType, isSwitch?: number, isSwitchOppo?: number, discards?: Card[], willSwitch?: boolean[][],
        supportCnt?: number[][], elTips?: [string, PureElementType, PureElementType][], willAttachs?: PureElementType[][],
        willDamages?: number[][], dmgElements?: DamageType[], atkedIdx?: number[],
    } {
        const { players = this.players } = options;
        const player = players[pidx];
        const opponent = players[pidx ^ 1];
        const { withCard, hidxs: chidxs, heal = 0, isExec = true, ahidx = player.hidx, ehidx = opponent.hidx,
            heros: ocheros, eheros: oceheros, isAction = false, source = -1, diceSelect = [], damages, socket } = options;
        const cheros = ocheros ?? player.heros;
        const ceheros = oceheros ?? opponent.heros;
        let ndices: DiceCostType[] | undefined;
        if (cmds == undefined || cmds.length == 0) return {}
        let isSwitch: number = cheros.findIndex(h => h.isSelected > 0);
        let isSwitchOppo: number = -1;
        let phase: Phase | undefined;
        let heroStatus: Status[][] | undefined;
        let combatStatus: Status[] | undefined;
        let heroStatusOppo: Status[][] | undefined;
        let combatStatusOppo: Status[] | undefined;
        // let summons: Summon[] | undefined;
        const willHeals: number[] = new Array(cheros.length + ceheros.length).fill(-1);
        let changedEl: ElementType | undefined;
        let discards: Card[] | undefined;
        const willSwitch: boolean[][] = players.map(p => new Array(p.heros.length).fill(false));
        const supportCnt: number[][] = players.map(() => new Array(MAX_SUPPORT_COUNT).fill(0));
        let elTips: [string, PureElementType, PureElementType][] | undefined;
        let willDamages: number[][] | undefined;
        let dmgElements: DamageType[] | undefined;
        let willAttachs: PureElementType[][] | undefined;
        let atkedIdx: number[] = [];
        const cmdlen = cmds.length;
        for (let i = 0; i < cmdlen; ++i) {
            const { cmd = '', cnt = 0, element, isReadySkill = false, status: getsts = [],
                card, isOppo = false, isAttach = false, mode = 0 } = cmds[i];
            let { hidxs, subtype = [] } = cmds[i];
            if (!hidxs && chidxs) hidxs = [...chidxs];
            if (!Array.isArray(subtype)) subtype = [subtype];
            if (cmd == 'useSkill') {
                this._useSkill(pidx, cnt, { isPreview: !isExec, withCard, isSwitch, isReadySkill });
            } else if (cmd.startsWith('switch-')) {
                if (isSwitch == -1) isSwitch = hidxs?.[0] ?? -1;
                let nhidx = -1;
                let sdir = 0;
                if (cmd == 'switch-before') sdir = -1;
                else if (cmd == 'switch-after') sdir = 1;
                const cpidx = pidx ^ +isOppo;
                const heros = isOppo ? ceheros : cheros;
                if (sdir == 0) {
                    nhidx = getNearestHidx(hidxs?.[0] ?? -1, heros);
                } else {
                    nhidx = this._getFrontHero(pidx, { offset: sdir }).hidx;
                }
                if (!isExec) {
                    willSwitch[cpidx][nhidx] = true;
                    if (isOppo) {
                        isSwitchOppo = nhidx;
                    } else if (isSwitch == -1) {
                        isSwitch = nhidx;
                    } else if (!cmds.some(({ cmd }) => cmd == 'useSkill')) {
                        this._useSkill(pidx, -1, { isPreview: true, otriggers: ['change-from', 'change-to'] });
                    }
                }
                if (nhidx > -1) {
                    cmds[i].hidxs = [nhidx];
                    this._switchHero(pidx, nhidx, socket, 'doCmd--switch');
                }
            } else if (['getCard', 'addCard'].includes(cmd)) {
                let cards: Card[] = [];
                if (card) {
                    cards = (Array.isArray(card) ? card : Array.from({ length: cnt }, () => clone(card)))
                        .map(c => typeof c == 'number' ? this.newCard(c) : c);
                }
                if (cmd == 'getCard') {
                    const exclude = cmds[i].hidxs ?? [];
                    let restCnt = cnt;
                    while (restCnt-- > 0) {
                        let wcard: Card | null = null;
                        if (cards[restCnt]) { // 摸指定卡
                            if (isAttach) { // 从牌库摸
                                const cid = cards[restCnt].id;
                                const cardIdx = player.pile.findIndex(c => c.id == cid);
                                if (cardIdx > -1) [wcard] = player.pile.splice(cardIdx, 1);
                            } else { // 直接生成
                                wcard = cards[restCnt];
                            }
                        } else if (subtype.length == 0) { // 摸除了指定之外的牌
                            if (player.pile.every(c => exclude.includes(c.id))) {
                                break;
                            }
                            const cardIdx = player.pile.findIndex(c => !exclude.includes(c.id));
                            if (cardIdx > -1) [wcard] = player.pile.splice(cardIdx, 1);
                        } else { // 指定副类型
                            if (player.pile.every(c => !c.hasSubtype(...(subtype as CardSubtype[])))) {
                                break;
                            }
                            while (wcard == null) {
                                const cardIdx = player.pile.findIndex(c => c.hasSubtype(...(subtype as CardSubtype[])) && !exclude.includes(c.id));
                                if (cardIdx > -1) [wcard] = player.pile.splice(cardIdx, 1);
                            }
                        }
                        if (wcard) {
                            wcard.entityId = this._genEntityId();
                            player.UI.willGetCard.push(wcard);
                        }
                    }
                    // todo 摸牌的task要先于下面的检测
                    for (let i = 0; i < cnt - restCnt; ++i) {
                        this._detectStatus(pidx ^ +isOppo, STATUS_TYPE.Usage, 'getcard', { isExec, isQuickAction: isCdt(!isAction, 2) });
                        const { supportCnt: sptCnt } = this._detectSupport(pidx ^ +!isOppo, 'getcard-oppo', { isExec, isQuickAction: !isAction });
                        supportCnt.forEach((spt, spti) => spt.forEach((_, i, a) => a[i] += sptCnt[spti][i]));
                    }
                }
                if (cmd == 'addCard') {
                    const cpidx = pidx ^ +isOppo;
                    player.UI.willAddCard.push(...cards);
                    if (isExec) {
                        setTimeout(() => {
                            const scope = hidxs?.[0] ?? 0;
                            const pileLen = players[cpidx].pile.length;
                            let restCnt = cnt;
                            if (isAttach) { // 随机
                                let cscope = scope > 0 ? Math.max(1, scope - cnt) : scope < 0 ? Math.min(-1, scope + cnt) : scope;
                                while (restCnt-- > 0) {
                                    let pos = (pileLen + Math.floor(Math.random() * (cscope || pileLen))) % pileLen;
                                    if (scope < 0) {
                                        ++pos;
                                        cscope = Math.max(scope, cscope - 1);
                                    } else if (scope > 0) {
                                        cscope = Math.min(scope, cscope + 1);
                                    }
                                    players[pidx].pile.splice(pos, 0, cards.shift()!);
                                }
                            } else { // 均匀
                                const step = Math.floor((scope || pileLen) / (cnt + 1)) + +(scope < 0);
                                while (restCnt-- > 0) {
                                    let pos = (pileLen + step * (cnt - restCnt)) % pileLen;
                                    players[pidx].pile.splice(pos, 0, cards.shift()!);
                                }
                            }
                            // emit(dataOpt, 'doCmd--' + cmd);
                        }, 1250);
                    }
                }
            } else if (cmd == 'discard') {
                if (discards == undefined) discards = [];
                let discardCnt = Math.max(1, cnt);
                const unselectedCards = player.handCards.filter(c => !c.selected);
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
                            const hcardsSorted = unselectedCards.slice().sort((a, b) => ((b.cost + b.anydice) - (a.cost + a.anydice)) || (Math.random() - 0.5));
                            const targetCnt = discardCnt;
                            while (discardCnt > 0) {
                                if (mode == CMD_MODE.HighHandCard) { // 弃置花费最高的手牌 
                                    if (hcardsSorted.length == 0) break;
                                    const didx = unselectedCards.findIndex(c => c.id == hcardsSorted[0].id);
                                    unselectedCards.splice(didx, 1);
                                    discardIdxs.push(didx);
                                    discards.push(clone(hcardsSorted.shift()!));
                                } else if (mode == CMD_MODE.TopPileCard) { // 弃置牌堆顶的牌 
                                    if (player.pile.length == 0) break;
                                    discards.push(clone(player.pile[0]));
                                    discardIdxs.push(targetCnt - discardCnt);
                                } else if (mode == CMD_MODE.RandomPileCard) { // 弃置牌库中随机一张牌
                                    if (player.pile.length == 0) break;
                                    const disIdx = Math.floor(Math.random() * player.pile.length);
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
                if (isExec) {
                    const { cmds: discmds, summons: dissmns } = this._doDiscard(pidx, discards, { heros: cheros, isAction });
                    cmds.push(...discmds);
                    if (dissmns.length > 0) {
                        const nsmns = this._updateSummon(pidx, dissmns, player.summons, player.combatStatus);
                        player.summons.splice(0, MAX_SUMMON_COUNT, ...nsmns);
                    }
                    if (mode == CMD_MODE.AllHandCards || mode == CMD_MODE.HighHandCard) { // 舍弃手牌
                        discardIdxs.forEach(dcidx => {
                            player.UI.willDiscard[0].push(player.handCards[dcidx]);
                        });
                        player.handCards = player.handCards.filter((_, dcidx) => !discardIdxs.includes(dcidx));
                    } else { // 舍弃牌库中的牌
                        player.UI.willDiscard[1].push(...player.pile.filter((_, dcidx) => discardIdxs.includes(dcidx)));
                        player.pile = player.pile.filter((_, dcidx) => !discardIdxs.includes(dcidx));
                    }
                    this.log.push(`[${player.name}]舍弃了${player.UI.willDiscard.map(cs => cs.map(c => `[${c.name}]`).join('')).join('')}`);
                    setTimeout(() => {
                        // emit
                    }, 1500);
                }
            } else if (cmd == 'getDice' && isExec) {
                let elements: DiceCostType[] = [];
                if (mode == CMD_MODE.RandomDice) { // 随机不重复
                    let ndice: DiceCostType = this._randomInArr(Object.values(PURE_ELEMENT_TYPE));
                    while (elements.includes(ndice)) ndice = this._randomInArr(Object.values(PURE_ELEMENT_TYPE));
                    elements.push(ndice);
                } else if (mode == CMD_MODE.FrontHero) { // 当前出战角色(或者前后,用cnt控制)
                    elements.push(this._getFrontHero(pidx, { offset: cnt }).element as PureElementType);
                }
                ndices = this._getDice(pidx, cnt, (element as DiceCostType | undefined) ?? elements);
                player.dice = [...ndices];
                for (let i = 0; i < cnt; ++i) {
                    this._detectStatus(pidx ^ 1, STATUS_TYPE.Usage, 'getdice-oppo', { isOnlyCombatStatus: true, isQuickAction: isAction ? 0 : 2, source, isExec });
                }
            } else if (cmd == 'getEnergy' && isExec) {
                ((isOppo ? ceheros : cheros) as Hero[]).forEach((h, hi) => {
                    if (h.hp > 0 && (hidxs == undefined && h.isFront || hidxs?.includes(hi))) {
                        h.energy = Math.max(0, Math.min(h.maxEnergy, h.energy + cnt));
                        // this.log.push(`[${player.name}][${h.name}]获得${cnt}点充能`);
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
                setTimeout(() => {
                    // this.socket.emit('sendToServer', {
                    //     phase: PHASE.CHANGE_CARD,
                    //     flag: 'useCard-changeCard-' + player.pidx,
                    // });
                }, 800);
            } else if (cmd == 'getStatus') {
                if (isOppo) {
                    getsts.forEach(sts => {
                        if (sts.group == STATUS_GROUP.heroStatus) {
                            if (!heroStatusOppo) heroStatusOppo = new Array(ceheros.length).fill(0).map(() => []);
                            (hidxs ?? [ehidx]).forEach(fhidx => heroStatusOppo?.[fhidx].push(sts));
                        } else {
                            if (!combatStatusOppo) combatStatusOppo = [];
                            combatStatusOppo.push(sts);
                        }
                    });
                } else {
                    getsts.forEach(sts => {
                        if (sts.group == STATUS_GROUP.heroStatus) {
                            if (!heroStatus) heroStatus = new Array(cheros.length).fill(0).map(() => []);
                            (hidxs ?? [ahidx]).forEach(fhidx => heroStatus?.[fhidx].push(sts));
                        } else {
                            if (!combatStatus) combatStatus = [];
                            combatStatus.push(sts);
                        }
                    })
                }
            } else if (['heal', 'revive'].includes(cmd)) {
                const willHeals1 = new Array(cheros.length).fill(0).map((_, hi) =>
                    (hidxs ?? [player.hidx]).includes(hi) ? Math.min(cheros[hi].maxHp - cheros[hi].hp, (cnt || heal) - (cmd == 'revive' ? 0.3 : 0)) : -1
                );
                willHeals1.forEach((hl, hli) => {
                    if (hl > -1) {
                        const hlidx = hli + (player.pidx ^ 1) * ceheros.length;
                        if (willHeals[hlidx] == -1) willHeals[hlidx] = 0;
                        willHeals[hlidx] += hl;
                        cheros[hli].hp += hl;
                    }
                });
                if (cnt == 0) cmds[i].cnt = heal;
                if (isExec) {
                    // todo 治疗动画加入队列 如果!isNotAddTask的话
                    if (cmd == 'revive') this._detectSkill(pidx, 'revive', { hidxs, heros: cheros });
                    this._doHeal(pidx, willHeals1, cheros);
                }
            } else if (cmd == 'changeElement') {
                changedEl = element as ElementType;
            } else if (cmd == 'changePattern') {
                if (hidxs == undefined) throw new Error('hidxs is undefined');
                const newPattern = this.newHero(cnt);
                const { heroStatus: chsts, hp, isFront, hidx, talentSlot, artifactSlot, weaponSlot, energy } = cheros[hidxs[0]];
                cheros[hidxs[0]] = newPattern;
                cheros[hidxs[0]].heroStatus = [...chsts];
                cheros[hidxs[0]].hp = hp;
                cheros[hidxs[0]].isFront = isFront;
                cheros[hidxs[0]].hidx = hidx;
                cheros[hidxs[0]].talentSlot = talentSlot;
                cheros[hidxs[0]].artifactSlot = artifactSlot;
                cheros[hidxs[0]].weaponSlot = weaponSlot;
                cheros[hidxs[0]].energy = energy;
            } else if (cmd == 'getSkill') {
                if (hidxs == undefined) throw new Error('@_doCmds-getSkill: hidxs is undefined');
                cheros[hidxs[0]].skills.splice(mode, 0, readySkill(cnt, this.version));
            } else if (cmd == 'loseSkill') {
                if (hidxs == undefined) throw new Error('@_doCmds-loseSkill: hidxs is undefined');
                cheros[hidxs[0]].skills.splice(mode, 1);
            } else if (cmd == 'attach') {
                (chidxs ?? []).forEach((hidx, hi) => {
                    const { players: players0, elTips: elTips1 }
                        = this._calcDamage(
                            pidx,
                            Array.isArray(element) ? element[hi] as ElementType : mode == CMD_MODE.FrontHero ? this._getFrontHero(pidx).element : element as ElementType,
                            [],
                            hidx,
                            players,
                            { isAttach: true },
                        );
                    players.forEach((_, i, a) => a[i] = players0[i]);
                    elTips = [...elTips1];
                });
            } else if (cmd == 'attack') {
                const cpidx = pidx ^ +isOppo;
                if (!willDamages) willDamages = new Array(player.heros.length + opponent.heros.length).fill(0).map(() => [-1, 0]);;
                if (!dmgElements) dmgElements = new Array(players[cpidx].heros.length).fill(DAMAGE_TYPE.Physical);
                if (!willAttachs) willAttachs = new Array(player.heros.length + opponent.heros.length).fill(0).map(() => []);
                (chidxs ?? [(isOppo ? player : opponent).hidx]).forEach((hidx, hi) => {
                    atkedIdx.push(hidx);
                    const dmgElement = Array.isArray(element) ? element[hi] as ElementType : mode == CMD_MODE.FrontHero ? this._getFrontHero(cpidx, { players }).element : element as ElementType;
                    const { willDamages: willDamage1, willAttachs: willAttachs1, dmgElements: dmgElements1, elrcmds: elrcmds1,
                        players: players1, elTips: elTips1,
                    } = this._calcDamage(
                        cpidx ^ 1,
                        dmgElement,
                        damages?.(isOppo, cnt, element as DamageType, hidxs) ?? new Array(players[cpidx].heros.length).fill(0).map((_, i) => i == hidx ? [cnt > 0 ? cnt : -1, cnt] : [-1, 0]),
                        hidx,
                        players,
                    );
                    willDamages!.forEach((wdmg, wdci) => {
                        const [nwdmg, nwpdmg] = willDamage1[wdci];
                        if (nwdmg > 0) wdmg[0] = Math.max(0, wdmg[0]) + nwdmg;
                        wdmg[1] += nwpdmg;
                    });
                    dmgElements1.forEach((de, dei) => {
                        if (de != DAMAGE_TYPE.Physical && de != DAMAGE_TYPE.Pierce) dmgElements![dei] = de;
                    });
                    for (let i = 0; i < players[cpidx].heros.length; ++i) {
                        const attachEl = willAttachs1[i];
                        if (attachEl == ELEMENT_TYPE.Physical) continue;
                        willAttachs![i + cpidx * players[cpidx ^ 1].heros.length].push(attachEl);
                    }
                    players.forEach((_, i, a) => a[i] = players1[i]);
                    elTips = [...elTips1];
                    this._doCmds(pidx ^ +isOppo, elrcmds1[0], { players });
                    this._doCmds(pidx ^ +!isOppo, elrcmds1[1], { players });
                });
            }
        }
        for (let fhidx = 0; fhidx < cheros.length; ++fhidx) {
            const fhero = cheros[fhidx];
            if (heroStatus && heroStatus[fhidx].length) {
                fhero.heroStatus = this._updateStatus(pidx, heroStatus[fhidx], fhero.heroStatus, true, cheros, fhidx);
            }
        }
        if (combatStatus) player.combatStatus = this._updateStatus(pidx, combatStatus, player.combatStatus, true, cheros, ahidx);
        for (let fhidx = 0; fhidx < ceheros.length; ++fhidx) {
            const fhero = ceheros[fhidx];
            if (heroStatusOppo && heroStatusOppo[fhidx].length) {
                fhero.heroStatus = this._updateStatus(pidx ^ 1, heroStatusOppo[fhidx], fhero.heroStatus, true, ceheros, fhidx);
            }
        }
        if (combatStatusOppo) opponent.combatStatus = this._updateStatus(pidx ^ 1, combatStatusOppo, opponent.combatStatus, true, ceheros, ehidx);
        return {
            cmds, ndices, phase, heros: cheros, eheros: ceheros, willHeals, changedEl, isSwitch, isSwitchOppo, discards,
            willSwitch, supportCnt, elTips, willAttachs, willDamages, dmgElements, atkedIdx,
        }
    }
    /**
     * 预览技能效果
     * @param pidx 玩家序号
     * @param skidx 技能序号
     * @returns 预览结果
     */
    private _previewSkill(pidx: number, skidx?: number) {
        const previews: Preview[] = [];
        const players = clone(this.players);
        const { skills, energy, maxEnergy, heroStatus } = this._getFrontHero(pidx, { players });
        const { dice, status } = players[pidx];
        const sidxs = skidx ? [skidx] : Array.from({ length: skills.length }, (_, i) => i);
        const isWaiting = status == PLAYER_STATUS.WAITING;
        const isNonAction = heroStatus.some(sts => sts.hasType(STATUS_TYPE.NonAction));
        for (const sidx of sidxs) {
            const skill = skills[sidx];
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
            const { willHp, willAttachs, summonCnt, supportCnt, willSummons } = this._useSkill(pidx, sidx, { isPreview: true });
            const preview: Preview = {
                type: ACTION_TYPE.UseSkill,
                players,
                isValid: !skill.isForbidden,
                skillIdx: +sidx,
                diceSelect: this._checkSkill(pidx, +sidx).map(v => skill.isForbidden ? false : v),
                willHp,
                willAttachs,
                willSummonChange: summonCnt,
                willSupportChange: supportCnt,
                willSummons,
            }
            previews.push(preview);
        }
        return previews;
    }
    /**
     * 预览使用卡牌效果
     * @param pidx 玩家序号
     * @returns 预览结果
     */
    private _previewCard(pidx: number) {
        const { handCards } = this.players[pidx];
        const previews: Preview[] = [];
        for (const cidx in handCards) {
            const { canSelectHero, canSelectSummon, canSelectSupport, type } = handCards[cidx];
            const cases = Math.min(1, canSelectHero);
            // todo 这里要考虑可选择的人数和能选择的人/支援物的所有情况
            for (let i = 0; i < cases; ++i) {
                const players = clone(this.players);
                const player = players[pidx];
                const opponent = players[pidx ^ 1];
                let isValid = false;
                const { isValid: checkValid, diceSelect, skillIdx = -1, switchIdx = -1 } = this._checkCard(pidx, +cidx);
                if (player.status == PLAYER_STATUS.PLAYING) {
                    isValid = checkValid && canSelectHero == 0 && canSelectSummon == -1 && canSelectSupport == -1;
                    if (type == CARD_TYPE.Support) {
                        const isAvalible = player.supports.length < MAX_SUPPORT_COUNT;
                        isValid &&= isAvalible;
                        if (!isAvalible) player.supports.forEach(s => s.canSelect = true);
                    }
                    if (checkValid && !isValid) {
                        isValid = true;
                        if (canSelectHero == 1 && player.heros.filter(h => h.canSelect).length == 1) {
                            player.heros.forEach(h => h.isSelected = +h.canSelect);
                        } else if (canSelectSummon == 0 && opponent.summons.filter(smn => smn.canSelect).length == 1) {
                            opponent.summons.forEach(smn => smn.isSelected = smn.canSelect);
                        } else if (canSelectSummon == 1 && player.summons.filter(smn => smn.canSelect).length == 1) {
                            player.summons.forEach(smn => smn.isSelected = smn.canSelect);
                        } else if (canSelectSupport == 1 && player.supports.filter(spt => spt.canSelect).length == 1) {
                            player.supports.forEach(spt => spt.isSelected = spt.canSelect);
                        } else isValid = false;
                    }
                }
                let switchPreview: Preview | undefined;
                let skillPreview: Preview | undefined;
                if (switchIdx > -1) [switchPreview] = this._previewSwitch(pidx, switchIdx);
                if (skillIdx > -1) [skillPreview] = this._previewSkill(pidx, skillIdx);
                // todo 把上面两个preview的属性加和合并到下面的preview
                const preview: Preview = {
                    ...(switchPreview ?? {}),
                    ...(skillPreview ?? {}),
                    type: ACTION_TYPE.UseCard,
                    players,
                    isValid,
                    cardIdxs: [+cidx],
                    diceSelect,
                }
                previews.push(preview);
            }
            // 调和的预览
            const players = clone(this.players);
            const { isValid, diceSelect } = this._checkCard(pidx, +cidx, true);
            // todo 调和的时机触发
            // this._doStatus(this.playerIdx, 4, 'reconcile', { card: handCards[cidx], isQuickAction: 2 });
            // this._doSupport(this.playerIdx, 'reconcile', { isQuickAction: true });
            const preview: Preview = {
                type: ACTION_TYPE.Reconcile,
                players,
                isValid,
                cardIdxs: [+cidx],
                diceSelect,
            }
            previews.push(preview);
        }
        return previews;
    }
    /**
     * 预览切换角色效果
     * @param pidx 玩家序号
     * @param hidx 切换角色的序号
     * @returns 预览结果
     */
    private _previewSwitch(pidx: number, hidx?: number) {
        const previews: Preview[] = [];
        const players = clone(this.players);
        const player = players[pidx];
        const hidxs = hidx ? [hidx] : getBackHidxs(player.heros);
        // todo 计算可能得攻击状态伤害
        for (const hidx of hidxs) {
            const switchHeroDiceCnt = this._calcHeroSwitchDice(pidx, hidx, player.hidx);
            let isQuickAction = false;
            isQuickAction = this._detectSkill(pidx, 'change-from', { hidxs: player.hidx, isExec: false }).isQuickAction;
            isQuickAction = this._detectStatus(pidx, STATUS_TYPE.Usage, 'change-from', { isQuickAction, isExec: false }).isQuickAction;
            isQuickAction = this._detectSupport(pidx, 'change', { isQuickAction, isExec: false }).isQuickAction;
            const diceSelect = player.dice.map(() => false);
            for (let i = player.dice.length - 1, cnt = switchHeroDiceCnt; i >= 0 && cnt > 0; --i, --cnt) {
                diceSelect[i] = true;
            }
            const preview: Preview = {
                type: ACTION_TYPE.SwitchHero,
                players,
                heroIdxs: [hidx],
                isValid: true,
                diceSelect,
                switchHeroDiceCnt,
                heroCanSelect: player.heros.map(h => !h.isFront),
                isQuickAction,
            }
            previews.push(preview);
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
     * @param hidx 附魔角色idx
     * @returns 合并后状态
     */
    _updateStatus(pidx: number, nStatus: Status[], oStatus: Status[], isExec = false, heros?: Hero[], hidx: number = -1, ohidx: number = -1) {
        const oriStatus: Status[] = clone(oStatus);
        const newStatus: Status[] = clone(nStatus);
        const updateAttachEl = (aheros: Hero[], ahidx: number, stype: number, sts?: Status[]) => {
            const hero = aheros[ahidx];
            const [attachElSts] = [
                ...((stype == 0 && sts ? sts : hero.heroStatus).filter(sts => sts.hasType(STATUS_TYPE.Enchant) && (sts.useCnt > 0 || sts.roundCnt > 0))),
                ...((stype == 1 && sts ? sts : this.players[pidx].combatStatus).filter(sts => sts.hasType(STATUS_TYPE.Enchant) && (sts.useCnt > 0 || sts.roundCnt > 0))),
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
            let cstIdx = oriStatus.findIndex(cst => cst.id == sts.id);
            const oriSts = oriStatus[cstIdx];
            if (cstIdx > -1 && oriSts.isTalent != sts.isTalent) { // 如果状态是否带有天赋不同，则重新附属
                oriStatus.splice(cstIdx, 1);
                cstIdx = -1;
            }
            if (cstIdx > -1) { // 重复生成状态
                if (sts.maxCnt == 0) { // 不可叠加
                    oriStatus[cstIdx] = clone(sts);
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
                oriStatus.push(sts.setEntityId(this._genEntityId()));
            }
            if (heros) {
                const stsres = sts.handle(sts, { heros, hidx });
                if (hidx > -1) {
                    if (sts.hasType(STATUS_TYPE.Enchant)) updateAttachEl(heros, hidx, sts.group, oriStatus);
                    if (stsres.onlyOne) {
                        heros.some((h, hi) => {
                            if (hi == hidx) return false;
                            const idx = h.heroStatus.findIndex(hst => hst.id == sts.id);
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
                const isNotDestroy = ((sts.useCnt != 0 || sts.hasType(STATUS_TYPE.Accumulate)) && sts.roundCnt != 0) || sts.hasType(STATUS_TYPE.Attack, STATUS_TYPE.TempNonDestroy);
                if (isExec) this._doStatusDestroy(pidx, sts);
                return isNotDestroy;
            });
    }
    /**
     * 更新召唤物
     * @param pidx 玩家序号
     * @param nSummon 新召唤物
     * @param oSummon 原召唤物
     * @param combatStatus 出战状态
     * @param options isSummon 是否是召唤物生成的新召唤物, trigger 触发时机
     * @returns 合并后召唤物
     */
    private _updateSummon(
        pidx: number, nSummon: Summon[], oSummon: Summon[], combatStatus: Status[], isExec = false,
        options: { isSummon?: number, trigger?: Trigger } = {}
    ) {
        const newSummon: Summon[] = clone(nSummon);
        const oriSummon: Summon[] = clone(oSummon);
        const { isSummon = -1, trigger = '' } = options;
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
                const smnres = smn.handle(smn, { reset: true });
                if (smnres.rCombatStatus) {
                    const nsts = this._updateStatus(pidx, smnres.rCombatStatus, combatStatus, isExec);
                    combatStatus.splice(0, 20, ...nsts);
                }
            }
        });
        if (isSummon > -1) return oriSummon;
        return oriSummon.filter(smn => {
            if (smn.statusId > 0) { // 召唤物有关联状态
                const smnStatus = combatStatus.find(sts => sts.id == smn.statusId) ?? this.newStatus(smn.statusId, smn.id);
                smnStatus.useCnt = smn.useCnt;
                const nsts = this._updateStatus(pidx, [smnStatus], combatStatus);
                combatStatus.splice(0, 20, ...nsts);
            }
            if ( // 召唤物消失
                (smn.useCnt == 0 &&
                    (smn.isDestroy == SUMMON_DESTROY_TYPE.Used ||
                        (smn.isDestroy == SUMMON_DESTROY_TYPE.UsedRoundEnd && trigger == 'phase-end'))) ||
                (smn.isDestroy == SUMMON_DESTROY_TYPE.RoundEnd && trigger == 'phase-end')
            ) {
                const stsIdx = combatStatus.findIndex(sts => sts.summonId == smn.id) ?? -1;
                if (stsIdx > -1) combatStatus.splice(stsIdx, 1);
                if (isExec) this._doSummonDestroy(pidx);
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
        this._gameEnd(pidx ^ 1);
    }
    /**
     * 检测是否有赢家
     * @returns 赢家序号 -1为无
     */
    private _isWin() {
        let winnerIdx = -1;
        this.players.forEach((p, i) => {
            if (p.heros.every(h => h.hp <= 0)) winnerIdx = i ^ 1;
        });
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
    _execTask() {
        if (this.taskQueue.isExecuting || this.taskQueue.isTaskEmpty() || !this._hasNotDieChange()) return;
        this.taskQueue.isExecuting = true;
        return new Promise<void>(async resolve => {
            let isDieChangeBack = false;
            while (this._hasNotDieChange() && !this.taskQueue.isTaskEmpty() && this.taskQueue.isExecuting) {
                const [taskType, args] = this.taskQueue.getTask() ?? [];
                if (taskType == undefined || args == undefined) break;
                let task: [() => void, number][] | undefined;
                if (taskType.startsWith('status-')) task = this._detectStatus(...(args as Parameters<typeof this._detectStatus>)).task;
                else if (taskType.startsWith('support-')) task = this._detectSupport(...(args as Parameters<typeof this._detectSupport>)).task;
                else if (taskType.startsWith('summon-')) task = this._detectSummon(...(args as Parameters<typeof this._detectSummon>)).task;
                else if (taskType.startsWith('slot-')) task = this._detectSlot(...(args as Parameters<typeof this._detectSlot>)).task;
                else if (taskType.startsWith('skill-')) task = this._detectSkill(...(args as Parameters<typeof this._detectSkill>)).task;
                else if (taskType.startsWith('statusAtk-')) {
                    const isExeced = await this._doStatusAtk(args as StatusTask);
                    if (!isExeced) {
                        this.taskQueue.addStatusAtk([args as StatusTask], true);
                        break;
                    }
                } else {
                    if (task == undefined) continue;
                    await this.taskQueue.execTask(taskType, task);
                }
                if (isDieChangeBack) isDieChangeBack = false;
                if (!this._hasNotDieChange()) isDieChangeBack = true;
                await wait(() => this._hasNotDieChange(), { delay: 0, maxtime: 1e9 });
            }
            this.taskQueue.isExecuting = false;
            resolve();
        });
    }
    /**
    * 计算技能的变化伤害和骰子消耗
    * @param pidx 玩家序号
    * @param hidx 角色序号
    * @param options.isSwitch 切换的角色序号
    * @param options.readySkillId 准备技能rskid
    * @param options.skidx 使用的技能序号
    */
    _calcSkillChange(pidx: number, hidx: number, options: { isSwitch?: number, readySkillId?: number, skidx?: number } = {}) {
        const { isSwitch = -1, readySkillId = -1, skidx: skidx = -1 } = options;
        const player = this.players[pidx];
        const heros = player.heros;
        if (isSwitch > -1) {
            hidx = isSwitch;
            this._detectSkill(pidx, 'change-to', { hidxs: hidx });
        }
        const curHero = heros[hidx];
        if (!curHero) throw new Error('@_calcSkillChange: hero not found');
        const rskill = readySkillId > -1 ? readySkill(readySkillId, this.version) : null;
        const dmgChange = curHero.skills.filter(sk => sk.type != SKILL_TYPE.Passive).map(() => 0);
        const costChange: [number, number, number[]][] = curHero.skills.filter(sk => sk.type != SKILL_TYPE.Passive).map(() => [0, 0, []]);
        let mds: number[][] = [];
        for (const curSkill of curHero.skills) {
            if (curSkill.type == SKILL_TYPE.Passive) break;
            mds.push(curSkill.cost.slice(0, 2).map(v => v.cnt));
        }
        const statuses = [...curHero.heroStatus, ...player.combatStatus];
        for (const sts of statuses) {
            const stsres = sts.handle(sts, { trigger: 'calc' });
            if (!stsres.addDiceSkill) continue;
            const { skill = [0, 0, 0] } = stsres.addDiceSkill;
            for (const sidx in curHero.skills) {
                const curskill = curHero.skills[sidx];
                if (curskill.type == SKILL_TYPE.Passive) break;
                const skilltype = stsres.addDiceSkill?.[`skilltype${curskill.type as TrgSkType}`] ?? [0, 0, 0];
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
            if (rskill) dmgChange[0] += (res.addDmg ?? 0) + (res[`addDmgType${rskill.type as TrgSkType}`] ?? 0);
            else {
                dmgChange.forEach((_, i, a) => {
                    const curSkill = curHero.skills[i];
                    a[i] += (res.addDmg ?? 0) + (res[`addDmgType${curSkill.type as TrgSkType}`] ?? 0);
                });
            }
        }
        const costChangeList: [number, number][][] = [[], [], []]; // [有色骰, 无色骰, 元素骰]
        const calcCostChange = <T extends { minusDiceSkill?: MinuDiceSkill }>(res: T, entityId: number) => {
            if (!res.minusDiceSkill) return;
            const { minusDiceSkill: { skill = [0, 0, 0], elDice } } = res;
            costChange.forEach((_, i) => {
                const curSkill = curHero.skills[i];
                if (curSkill.type != SKILL_TYPE.Passive) {
                    if (elDice != undefined) {
                        const elCostChange = skill[0] + (res.minusDiceSkill?.[`skilltype${curSkill.type}`]?.[0] ?? 0);
                        if (elCostChange > 0) costChangeList[0].push([entityId, elCostChange]);
                    }
                    const anyCostChange = skill[1] + (res.minusDiceSkill?.[`skilltype${curSkill.type}`]?.[1] ?? 0);
                    if (anyCostChange > 0) costChangeList[1].push([entityId, anyCostChange]);
                    const diceCostChange = skill[2] + (res.minusDiceSkill?.[`skilltype${curSkill.type}`]?.[2] ?? 0);
                    if (diceCostChange > 0) costChangeList[2].push([entityId, diceCostChange]);
                }
            });
        }
        curHero.skills.forEach((curSkill, skidx) => {
            const skillres = curSkill.handle({ hero: curHero, skidx, trigger: 'calc' });
            calcCostChange(skillres, curSkill.id);
        });
        [curHero.weaponSlot, curHero.artifactSlot, curHero.talentSlot].forEach(slot => {
            if (slot != null) {
                const slotres = slot.handle(slot, {
                    heros,
                    hidxs: [hidx],
                    isChargedAtk: (this.players[pidx].dice.length & 1) == 0,
                    hcards: this.players[pidx].handCards,
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
                hcardsCnt: this.players[pidx].handCards.length,
                trigger: 'calc',
            });
            calcDmgChange(stsres);
            calcCostChange(stsres, sts.entityId);
        });
        this.players[pidx].summons.forEach(smn => {
            const smnres = smn.handle(smn, {
                heros,
                hidx,
                isFallAtk: player.isFallAtk,
                trigger: 'calc',
            });
            calcDmgChange(smnres);
            calcCostChange(smnres, smn.entityId);
        });
        this.players[pidx].supports.forEach(support => {
            const sptres = support.handle(support, {
                heros,
                hidxs: [hidx],
                dices: this.players[pidx].dice,
                hcards: this.players[pidx].handCards,
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
            const [elCostChangeList, anyCostChangeList, diceCostChangeList] = clone(costChangeList);
            while (elCostChangeList.length > 0 && elDice > 0) {
                const [eid, cnt] = elCostChangeList.shift()!;
                elDice -= cnt;
                costChange[i][2].push(eid);
            }
            while (anyCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = anyCostChangeList.shift()!;
                anyDice -= cnt;
                costChange[i][2].push(eid);
            }
            while (elCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = elCostChangeList.shift()!;
                anyDice -= cnt;
                costChange[i][2].push(eid);
            }
            while (diceCostChangeList.length > 0 && elDice > 0) {
                const [eid, cnt] = diceCostChangeList.shift()!;
                elDice -= cnt;
                costChange[i][2].push(eid);
            }
            while (diceCostChangeList.length > 0 && anyDice > 0) {
                const [eid, cnt] = diceCostChangeList.shift()!;
                anyDice -= cnt;
                costChange[i][2].push(eid);
            }
            curSkill.costChange = [...costChange[i]];
        }
        return curHero.skills[skidx];
    }
    /**
     * 计算卡牌的变化骰子消耗
     * @param pidx 玩家索引
     */
    private _clacCardChange(pidx: number) {
        const player = this.players[pidx];
        if (!player) return;
        const costChange = player.handCards.map(() => 0);
        const curHero = this._getFrontHero(pidx);
        if (!curHero) return;
        player.handCards.forEach((c, ci) => {
            player.heros.forEach(h => {
                [h.weaponSlot, h.artifactSlot].forEach(slot => {
                    if (slot != null) {
                        costChange[ci] += slot.handle(slot, {
                            heros: [h],
                            hidxs: [0],
                            hcard: c,
                            minusDiceCard: costChange[ci],
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
        const aliveHeros = allHidxs(player.heros, { isAll });
        const fidx = aliveHeros.findIndex(i => i == player.hidx);
        return player.heros[aliveHeros[(fidx + offset) % aliveHeros.length]];
    }
}


