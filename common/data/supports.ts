import { Card, Cmds, GameInfo, Hero, MinuDiceSkill, Status, Support, Trigger } from '../../typing';
import { CARD_SUBTYPE, CARD_TYPE, CMD_MODE, DICE_COST_TYPE, DiceCostType, ELEMENT_CODE_KEY, ELEMENT_TYPE_KEY, PURE_ELEMENT_CODE, PURE_ELEMENT_TYPE_KEY, SKILL_TYPE, Version } from '../constant/enum.js';
import { allHidxs, getBackHidxs, getMaxHertHidxs } from '../utils/gameUtil.js';
import { arrToObj, isCdt, objToArr } from '../utils/utils.js';
import { SupportBuilder } from './builder/supportBuilder.js';
import { newStatus } from './statuses.js';

export type SupportHandleEvent = {
    dices?: DiceCostType[],
    trigger?: Trigger,
    eheros?: Hero[],
    eCombatStatus?: Status[],
    heros?: Hero[],
    reset?: boolean,
    card?: Card,
    hcards?: Card[],
    isFirst?: boolean,
    hidxs?: number[],
    playerInfo?: GameInfo,
    minusDiceCard?: number,
    isMinusDiceSkill?: boolean,
    minusDiceSkill?: number[][],
    isMinusDiceTalent?: boolean,
    skid?: number,
    hidx?: number,
    heal?: number[],
    getdmg?: number[],
    discard?: number,
    epile?: Card[],
    isExecTask?: boolean,
}

export type SupportHandleRes = {
    trigger?: Trigger[],
    exec?: (support: Support, event: SupportExecEvent) => SupportExecRes,
    minusDiceCard?: number,
    minusDiceHero?: number,
    minusDiceSkill?: MinuDiceSkill,
    element?: DiceCostType | -2,
    cnt?: number,
    addRollCnt?: number,
    isQuickAction?: boolean,
    isExchange?: boolean,
    supportCnt?: number,
    isNotAddTask?: boolean,
    isOrTrigger?: boolean,
    isLast?: boolean,
    summon?: (number | [number, ...any])[] | number,
}

export type SupportExecEvent = {
    isExecTask?: boolean,
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
}

export type SupportExecRes = {
    cmds?: Cmds[],
    isDestroy: boolean,
    switchHeroDiceCnt?: number,
    summon?: (number | [number, ...any])[] | number,
}

const DICE_WEIGHT = [ // 吃骰子的优先级权重(越低越优先)
    DICE_COST_TYPE.Omni,
    DICE_COST_TYPE.Cryo,
    DICE_COST_TYPE.Hydro,
    DICE_COST_TYPE.Pyro,
    DICE_COST_TYPE.Electro,
    DICE_COST_TYPE.Geo,
    DICE_COST_TYPE.Dendro,
    DICE_COST_TYPE.Anemo,
];

const getSortedDices = (dices: DiceCostType[]) => {
    const diceCnt = arrToObj(DICE_WEIGHT, 0);
    dices.forEach(d => ++diceCnt[d]);
    return objToArr(diceCnt)
        .sort((a, b) => b[1] * +(b[0] != DICE_COST_TYPE.Omni) - a[1] * +(a[0] != DICE_COST_TYPE.Omni) || DICE_WEIGHT.indexOf(a[0]) - DICE_WEIGHT.indexOf(b[0]))
        .flatMap(([d, cnt]) => new Array<DiceCostType>(cnt).fill(d));
}

const supportTotal: Record<number, (...args: any) => SupportBuilder> = {

    // 璃月港口
    321001: () => new SupportBuilder().round(2).handle(() => ({
        trigger: ['phase-end'],
        exec: support => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: --support.cnt == 0 })
    })),
    // 骑士团图书馆
    321002: () => new SupportBuilder().permanent().handle(() => ({
        trigger: ['phase-dice', 'enter'],
        addRollCnt: 1,
    })),
    // 群玉阁
    321003: () => new SupportBuilder().permanent().handle((_, event, ver) => {
        const { hcards = [], trigger = '' } = event;
        const triggers: Trigger[] = ['phase-dice'];
        if (ver >= 'v4.5.0' && hcards.length <= 3) triggers.push('phase-start');
        return {
            trigger: triggers,
            element: -2,
            cnt: 2,
            exec: () => {
                if (trigger == 'phase-start') {
                    return { cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }], isDestroy: true }
                }
                return { isDestroy: false }
            }
        }
    }),
    // 晨曦酒庄
    321004: () => new SupportBuilder().permanent().perCnt(2).perCnt(1, 'v4.8.0').handle(support => {
        if (support.perCnt <= 0) return;
        return {
            trigger: ['change'],
            isNotAddTask: true,
            minusDiceHero: 1,
            exec: (spt, execEvent) => {
                let { switchHeroDiceCnt = 0 } = execEvent;
                if (switchHeroDiceCnt > 0) {
                    --spt.perCnt;
                    --switchHeroDiceCnt;
                }
                return { switchHeroDiceCnt, isDestroy: false }
            }
        }
    }),
    // 望舒客栈
    321005: () => new SupportBuilder().round(2).heal(2).handle((_, event) => {
        const { heros = [] } = event;
        const hidxs = getMaxHertHidxs(heros, { isBack: true });
        if (hidxs.length == 0) return;
        return {
            trigger: ['phase-end'],
            exec: support => ({ cmds: [{ cmd: 'heal', cnt: 2, hidxs }], isDestroy: --support.cnt == 0 })
        }
    }),
    // 西风大教堂
    321006: () => new SupportBuilder().round(2).heal(2).handle((_, event) => {
        const { heros = [] } = event;
        const fhidx = heros.findIndex(h => h.isFront);
        if (fhidx == -1 || heros[fhidx].hp == heros[fhidx].maxHp) return;
        return {
            trigger: ['phase-end'],
            exec: support => ({ cmds: [{ cmd: 'heal', hidxs: [fhidx], cnt: 2 }], isDestroy: --support.cnt == 0 })
        }
    }),
    // 天守阁
    321007: () => new SupportBuilder().permanent().handle((_, event) => {
        const { dices = [] } = event;
        return {
            trigger: ['phase-start'],
            exec: () => {
                const cmds: Cmds[] = [];
                if (new Set(dices.filter(v => v != DICE_COST_TYPE.Omni)).size + dices.filter(v => v == DICE_COST_TYPE.Omni).length >= 5) {
                    cmds.push({ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni });
                }
                return { cmds, isDestroy: false }
            }
        }
    }),
    // 鸣神大社
    321008: () => new SupportBuilder().round(3).handle(() => ({
        trigger: ['phase-start', 'enter'],
        exec: support => ({ cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }], isDestroy: --support.cnt == 0 })
    })),
    // 珊瑚宫
    321009: () => new SupportBuilder().round(2).handle((_, event) => {
        const { heros = [] } = event;
        if (heros.every(h => h.hp == h.maxHp)) return;
        return {
            trigger: ['phase-end'],
            exec: support => ({ cmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(heros) }], isDestroy: --support.cnt == 0 })
        }
    }),
    // 须弥城
    321010: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { dices = [], hcards = [], isMinusDiceTalent = false, isMinusDiceSkill = false, trigger = '' } = event;
        if (dices.length > hcards.length || support.perCnt <= 0) return;
        return {
            minusDiceSkill: { skill: [0, 0, 1] },
            minusDiceCard: isCdt(isMinusDiceTalent, 1),
            trigger: ['skill', 'card'],
            isNotAddTask: true,
            exec: spt => {
                if (trigger == 'skill' && isMinusDiceSkill || trigger == 'card' && isMinusDiceTalent) {
                    --spt.perCnt;
                }
                return { isDestroy: false }
            }
        }
    }),
    // 桓那兰那
    321011: () => new SupportBuilder().collection().handle((_, event) => {
        const { dices = [], trigger } = event;
        return {
            trigger: ['phase-end', 'phase-start'],
            exec: support => {
                if (trigger == 'phase-end') {
                    const pdices = getSortedDices(dices);
                    dices.length = 0;
                    dices.push(...pdices.slice(2));
                    support.perCnt = -pdices.slice(0, 2).map(v => DICE_WEIGHT.indexOf(v) + 1).join('');
                    support.cnt = pdices.slice(0, 2).length;
                    return { isDestroy: false }
                } else if (trigger == 'phase-start') {
                    const element = support.perCnt.toString().slice(1).split('').map(v => DICE_WEIGHT[Number(v) - 1]);
                    support.cnt = 0;
                    support.perCnt = 0;
                    if (element.length > 0) return { cmds: [{ cmd: 'getDice', cnt: 2, element }], isDestroy: false }
                }
                return { isDestroy: false }
            }
        }
    }),
    // 镇守之森
    321012: () => new SupportBuilder().round(3).handle((_, event) => {
        const { isFirst = true } = event;
        if (isFirst) return;
        return {
            trigger: ['phase-start'],
            exec: support => ({ cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero }], isDestroy: --support.cnt == 0 })
        }
    }),
    // 黄金屋
    321013: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { card, minusDiceCard: mdc = 0 } = event;
        const isMinus = support.perCnt > 0 && card && card.cost >= 3 && card.hasSubtype(CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Artifact) && card.cost > mdc;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isMinus, 1),
            exec: spt => {
                if (!isMinus) return { isDestroy: false }
                --spt.perCnt;
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 化城郭
    321014: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { dices = [] } = event;
        if (support.perCnt == 0 || dices.length > 0) return;
        return {
            trigger: ['action-start'],
            exec: spt => {
                --spt.perCnt;
                return { cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }], isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 风龙废墟
    321015: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { heros = [], hidxs: [hidx] = [], trigger = '', isMinusDiceTalent = false, isMinusDiceSkill = false } = event;
        const isCardMinus = isMinusDiceTalent && support.perCnt > 0;
        const skills = heros[hidx]?.skills.filter(v => v.type != SKILL_TYPE.Passive).map(skill => {
            if (support.perCnt > 0 && skill.cost[0].cnt + skill.cost[1].cnt >= 4) return [0, 0, 1];
            return [0, 0, 0];
        });
        const isMinus = support.perCnt > 0 && (trigger == 'card' && isCardMinus || trigger == 'skill' && isMinusDiceSkill);
        return {
            trigger: ['skill', 'card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isCardMinus, 1),
            minusDiceSkill: { skills },
            supportCnt: isCdt(isMinus, -1),
            exec: spt => {
                if (isMinus) {
                    --spt.perCnt;
                    --spt.cnt;
                }
                return { isDestroy: spt.cnt == 0 }
            }
        }
    }),
    // 湖中垂柳
    321016: () => new SupportBuilder().round(2).handle((_, event) => {
        const { hcards = [] } = event;
        return {
            trigger: isCdt(hcards.length <= 2, ['phase-end']),
            exec: support => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: --support.cnt == 0 })
        }
    }),
    // 欧庇克莱歌剧院
    321017: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { heros = [], eheros = [] } = event;
        const slotCost = heros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot, h.vehicleSlot])
            .filter(slot => slot != null).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
        const eslotCost = eheros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot, h.vehicleSlot])
            .filter(slot => slot != null).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
        if (slotCost >= eslotCost && support.perCnt > 0) {
            return {
                trigger: ['action-start'],
                exec: spt => {
                    --spt.perCnt;
                    return { cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero }], isDestroy: --spt.cnt == 0 }
                }
            }
        }
    }),
    // 梅洛彼得堡
    321018: () => new SupportBuilder().collection().handle((support, event, ver) => {
        const { hidxs: [hidx] = [], getdmg = [], heal = [], trigger = '' } = event;
        const triggers: Trigger[] = [];
        if (trigger == 'getdmg' && getdmg[hidx] > 0 && support.cnt < 4) triggers.push('getdmg');
        if (trigger == 'heal' && heal[hidx] > 0 && support.cnt < 4) triggers.push('heal');
        if (support.cnt >= 4) triggers.push('phase-start');
        const isAdd = triggers.some(tr => ['getdmg', 'heal'].includes(tr));
        return {
            trigger: triggers,
            supportCnt: isCdt(isAdd, 1),
            exec: spt => {
                if (trigger == 'phase-start') {
                    spt.cnt -= 4;
                    return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(301018)], isOppo: true }], isDestroy: false }
                }
                spt.cnt = Math.min(4, spt.cnt + 1);
                return { isDestroy: false }
            }
        }
    }),
    // 清籁岛
    321019: () => new SupportBuilder().round(2).handle((_, event, ver) => {
        const { heal = [], trigger = '' } = event;
        const hidxs = heal.map((hl, hli) => ({ hl, hli })).filter(v => v.hl > 0).map(v => v.hli);
        return {
            trigger: ['heal', 'heal-oppo', 'phase-end'],
            exec: support => {
                if (trigger == 'phase-end') return { isDestroy: --support.cnt == 0 }
                return {
                    cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(301019)], hidxs, isOppo: trigger == 'heal-oppo' }],
                    isDestroy: false,
                }
            }
        }
    }),
    // 赤王陵
    321020: () => new SupportBuilder().collection().handle((support, _, ver) => ({
        trigger: ['getcard-oppo'],
        supportCnt: 1 + (support.cnt < 4 ? 1 : -5),
        exec: spt => {
            ++spt.cnt;
            if (spt.cnt < 4) return { isDestroy: false }
            return {
                cmds: [
                    { cmd: 'addCard', cnt: 2, card: 301020, hidxs: [2], isOppo: true },
                    { cmd: 'getStatus', status: [newStatus(ver)(301022)], isOppo: true },
                ],
                isDestroy: true,
            }
        },
    })),
    // 中央实验室遗址
    321021: () => new SupportBuilder().collection().handle((_, event) => {
        const { discard = 0, trigger = '' } = event;
        return {
            trigger: ['discard', 'reconcile'],
            supportCnt: discard || 1,
            exec: support => {
                const ocnt = support.cnt;
                if (trigger == 'reconcile') ++support.cnt;
                else if (trigger == 'discard') support.cnt += discard;
                const dcnt = Math.floor(support.cnt / 3) - Math.floor(ocnt / 3);
                if (dcnt == 0) return { isDestroy: false }
                return { cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }], isDestroy: support.cnt >= 9 }
            },
        }
    }),
    // 圣火竞技场
    321022: () => new SupportBuilder().collection().handle((_s, _e, ver) => ({
        trigger: ['skill', 'vehicle'],
        supportCnt: 1,
        exec: support => {
            ++support.cnt;
            const cmds: Cmds[] = [];
            if (support.cnt == 2) cmds.push({ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random });
            else if (support.cnt == 4) cmds.push({ cmd: 'heal', cnt: 2 });
            else if (support.cnt == 6) cmds.push({ cmd: 'getStatus', status: [newStatus(ver)(301023)] });
            return { cmds, isDestroy: support.cnt >= 6 }
        }
    })),
    // 派蒙
    322001: () => new SupportBuilder().round(2).handle(() => ({
        trigger: ['phase-start'],
        exec: support => ({ cmds: [{ cmd: 'getDice', cnt: 2, element: DICE_COST_TYPE.Omni }], isDestroy: --support.cnt == 0 })
    })),
    // 凯瑟琳
    322002: () => new SupportBuilder().permanent().perCnt(1).handle(support => ({
        trigger: ['change'],
        isNotAddTask: true,
        isQuickAction: support.perCnt == 1,
        exec: (spt, execEvent) => {
            if (spt.perCnt > 0 && execEvent.isQuickAction) --spt.perCnt;
            return { isDestroy: false }
        }
    })),
    // 蒂玛乌斯
    322003: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { card, trigger = '', minusDiceCard: mdc = 0, playerInfo: { artifactCnt = 0 } = {} } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver >= 'v4.3.0' && artifactCnt >= 6) triggers.push('enter');
        const isMinus = support.perCnt > 0 && card && card.hasSubtype(CARD_SUBTYPE.Artifact) && card.cost > mdc && support.cnt >= card.cost - mdc;
        return {
            trigger: triggers,
            isNotAddTask: trigger != 'phase-end',
            isLast: true,
            minusDiceCard: isMinus ? card.cost - mdc : 0,
            exec: spt => {
                if (trigger == 'enter') return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Artifact, isAttach: true }], isDestroy: false }
                if (trigger == 'phase-end') ++spt.cnt;
                else if (trigger == 'card' && isMinus) {
                    spt.cnt -= card.cost - mdc;
                    --spt.perCnt;
                }
                return { isDestroy: false }
            }
        }
    }),
    // 瓦格纳
    322004: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { card, trigger = '', minusDiceCard: mdc = 0, playerInfo: { weaponTypeCnt = 0 } = {} } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver >= 'v4.3.0' && weaponTypeCnt >= 3) triggers.push('enter');
        const isMinus = support.perCnt > 0 && card && card.hasSubtype(CARD_SUBTYPE.Weapon) && card.cost > mdc && support.cnt >= card.cost - mdc;
        return {
            trigger: triggers,
            isNotAddTask: trigger != 'phase-end',
            isLast: true,
            minusDiceCard: isMinus ? card.cost - mdc : 0,
            exec: spt => {
                if (trigger == 'enter') return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Weapon, isAttach: true }], isDestroy: false }
                if (trigger == 'phase-end') ++spt.cnt;
                else if (trigger == 'card' && isMinus) {
                    spt.cnt -= card.cost - mdc;
                    --spt.perCnt;
                }
                return { isDestroy: false }
            }
        }
    }),
    // 卯师傅
    322005: () => new SupportBuilder().permanent(1).perCnt(1).handle((_, event, ver) => {
        const { card } = event;
        return {
            trigger: ['card'],
            exec: support => {
                if (support.perCnt <= 0 || !card?.hasSubtype(CARD_SUBTYPE.Food)) return { isDestroy: false }
                --support.perCnt;
                const cmds: Cmds[] = [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }];
                if (ver >= 'v4.1.0' && support.cnt > 0) {
                    --support.cnt;
                    cmds.push({ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Food, isAttach: true });
                }
                return { cmds, isDestroy: false }
            }
        }
    }),
    // 阿圆
    322006: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        const { card, minusDiceCard: mdc = 0 } = event;
        const isMinus = card && card.hasSubtype(CARD_SUBTYPE.Place) && card.cost > mdc;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isMinus, 2),
            exec: spt => {
                if (isMinus) --spt.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 提米
    322007: () => new SupportBuilder().collection(0).handle(() => ({
        trigger: ['phase-start', 'enter'],
        exec: support => {
            if (++support.cnt < 3) return { isDestroy: false }
            return {
                cmds: [{ cmd: 'getCard', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }],
                isDestroy: true,
            }
        }
    })),
    // 立本
    322008: () => new SupportBuilder().collection(0).handle((support, event) => {
        const { dices = [], trigger } = event;
        const triggers: Trigger[] = ['phase-end'];
        if (support.cnt >= 3) triggers.push('phase-start');
        return {
            trigger: triggers,
            exec: (spt, execEvent) => {
                if (trigger == 'phase-end' && (execEvent.isExecTask ?? true)) {
                    const pdices = getSortedDices(dices);
                    dices.length = 0;
                    while (pdices.length > 0) {
                        if (spt.cnt >= 3) {
                            dices.push(...pdices);
                            break;
                        }
                        const pdice = pdices.shift()!;
                        ++spt.cnt;
                        while (pdices[0] == pdice && pdice != DICE_COST_TYPE.Omni) {
                            dices.push(pdices.shift()!);
                        }
                    }
                    return { isDestroy: false }
                }
                if (trigger == 'phase-start') {
                    return { cmds: [{ cmd: 'getCard', cnt: 2 }, { cmd: 'getDice', cnt: 2, element: DICE_COST_TYPE.Omni }], isDestroy: true }
                }
                return { isDestroy: false }
            }
        }
    }),
    // 常九爷
    322009: () => new SupportBuilder().collection().handle((support, event) => {
        const { skid = -1 } = event;
        if (skid == -1) return;
        return {
            trigger: ['Physical-dmg', 'Physical-getdmg', 'Pierce-dmg', 'Pierce-getdmg', 'elReaction', 'get-elReaction'],
            supportCnt: support.cnt < 2 ? 1 : -3,
            isOrTrigger: true,
            exec: spt => {
                if (++spt.cnt < 3) return { isDestroy: false }
                return { cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: true }
            }
        }
    }),
    // 艾琳
    322010: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        const { heros = [], hidxs: [hidx] = [-1], isMinusDiceSkill = false } = event;
        const skills = heros[hidx]?.skills.map(skill => {
            if (skill.useCntPerRound > 0) return [0, 0, 1];
            return [0, 0, 0];
        });
        return {
            trigger: ['skill'],
            isNotAddTask: true,
            minusDiceSkill: { skills },
            exec: spt => {
                if (isMinusDiceSkill) --spt.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 田铁嘴
    322011: () => new SupportBuilder().round(2).handle((_, event) => {
        const { heros = [] } = event;
        const hidxs: number[] = [];
        const frontHeroIdx = heros.findIndex(h => h.isFront);
        if (frontHeroIdx > -1 && heros[frontHeroIdx].energy < heros[frontHeroIdx].maxEnergy) {
            hidxs.push(frontHeroIdx);
        } else {
            const hidx = heros.findIndex(h => h.energy < h.maxEnergy);
            if (hidx > -1) hidxs.push(hidx);
        }
        return {
            trigger: ['phase-end'],
            exec: support => {
                if (hidxs.length == 0) return { isDestroy: false }
                return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }], isDestroy: --support.cnt == 0 }
            }
        }
    }),
    // 刘苏
    322012: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { heros = [], hidx = -1 } = event;
        if (support.perCnt <= 0 || (heros[hidx]?.energy ?? 1) > 0) return;
        return {
            trigger: ['change'],
            supportCnt: -1,
            exec: spt => {
                --spt.perCnt;
                return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: [hidx] }], isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 花散里
    322013: () => new SupportBuilder().collection().handle((support, event) => {
        const { card, trigger = '', minusDiceCard: mdc = 0 } = event;
        const isMinus = support.cnt >= 3 && card && card.hasSubtype(CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Artifact) && card.cost > mdc;
        return {
            trigger: ['summon-destroy', 'card'],
            minusDiceCard: isCdt(isMinus, 2),
            isNotAddTask: trigger == 'card',
            supportCnt: isCdt(trigger == 'summon-destroy', 1),
            exec: spt => {
                if (trigger == 'card' && isMinus) return { isDestroy: true }
                if (trigger == 'summon-destroy' && spt.cnt < 3) ++spt.cnt;
                return { isDestroy: false }
            }
        }
    }),
    // 鲸井小弟
    322014: () => new SupportBuilder().permanent().handle(() => ({
        trigger: ['phase-start'],
        isExchange: true,
        exec: () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }], isDestroy: true })
    })),
    // 旭东
    322015: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        const { card, minusDiceCard: mdc = 0 } = event;
        const isMinus = card && card.hasSubtype(CARD_SUBTYPE.Food) && card.cost > mdc;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isMinus, 2),
            exec: spt => {
                if (isMinus) --spt.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 迪娜泽黛
    322016: () => new SupportBuilder().permanent(1).perCnt(1).handle((support, event, ver) => {
        const { card, minusDiceCard: mdc = 0 } = event;
        const isMinus = card && card.hasSubtype(CARD_SUBTYPE.Ally) && card.cost > mdc && support.perCnt > 0;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isMinus, 1),
            exec: spt => {
                const cmds: Cmds[] = [];
                if (isMinus) --spt.perCnt;
                if (ver >= 'v4.1.0' && spt.cnt > 0) {
                    --spt.cnt;
                    cmds.push({ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Ally, isAttach: true });
                }
                return { cmds, isDestroy: false }
            }
        }
    }),
    // 拉娜
    322017: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { heros = [] } = event;
        if (support.perCnt <= 0 || getBackHidxs(heros).length == 0) return;
        return {
            trigger: ['skilltype2'],
            exec: spt => {
                --spt.perCnt;
                return { cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero, hidxs: [1] }], isDestroy: false }
            }
        }
    }),
    // 老章
    322018: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        const { card, heros = [], minusDiceCard: mdc = 0 } = event;
        const isMinus = card && card.hasSubtype(CARD_SUBTYPE.Weapon) && card.cost > mdc;
        const minusCnt = 1 + heros.filter(h => h.weaponSlot != null).length;
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isMinus, minusCnt),
            exec: spt => {
                if (isMinus) --spt.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 塞塔蕾
    322019: () => new SupportBuilder().collection(3).handle((_, event) => {
        const { hcards } = event;
        if ((hcards?.length ?? 1) > 0) return;
        return {
            trigger: ['action-after', 'action-after-oppo'],
            exec: support => ({ cmds: [{ cmd: 'getCard', cnt: 1 }], isDestroy: --support.cnt == 0 })
        }
    }),
    // 弥生七月
    322020: () => new SupportBuilder().permanent().perCnt(1).handle((support, event, ver) => {
        if (support.perCnt <= 0) return;
        const { card, heros = [], minusDiceCard: mdc = 0 } = event;
        const isMinus = card && card.hasSubtype(CARD_SUBTYPE.Artifact) && card.cost > mdc;
        const artifactLen = heros.filter(h => h.artifactSlot != null).length;
        const minusCnt = 1 + +(ver < 'v4.6.0' ? artifactLen : (artifactLen >= 2));
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isMinus, minusCnt),
            exec: spt => {
                if (isMinus) --spt.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 玛梅赫
    322021: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { card } = event;
        const subtype = [CARD_SUBTYPE.Food, CARD_SUBTYPE.Ally, CARD_SUBTYPE.Place, CARD_SUBTYPE.Item];
        if (support.perCnt <= 0 || card?.id == support.card.id || !card?.hasSubtype(...subtype)) return;
        return {
            trigger: ['card'],
            exec: spt => {
                --spt.perCnt;
                return { cmds: [{ cmd: 'getCard', cnt: 1, subtype, hidxs: [spt.card.id] }], isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 婕德
    322022: () => new SupportBuilder().collection().handle((support, event, ver) => {
        const { trigger = '', playerInfo: { destroyedSupport = 0 } = {} } = event;
        if (trigger == 'enter') {
            support.cnt = Math.min(6, destroyedSupport);
            return;
        }
        const threshold = ver < 'v4.6.0' ? 5 : 6;
        return {
            trigger: support.cnt >= threshold ? ['skilltype3'] : ['support-destroy'],
            supportCnt: isCdt(support.cnt >= threshold, -10, 1),
            exec: spt => {
                if (trigger == 'skilltype3') {
                    if (ver < 'v4.6.0') return { cmds: [{ cmd: 'getDice', cnt: spt.cnt - 2, element: DICE_COST_TYPE.Omni }], isDestroy: true }
                    return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(302205)] }], isDestroy: true }
                }
                if (trigger == 'support-destroy') spt.cnt = Math.min(6, destroyedSupport);
                return { isDestroy: false }
            }
        }
    }),
    // 西尔弗和迈勒斯
    322023: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger = '', playerInfo: { oppoGetElDmgType = 0 } = {}, isExecTask } = event;
        if (trigger == 'enter') {
            support.cnt = Math.min(4, oppoGetElDmgType.toString(2).split('').filter(v => +v).length);
            return;
        }
        const triggers: Trigger[] = [];
        Object.values(PURE_ELEMENT_CODE).forEach(elcode => {
            if ((oppoGetElDmgType >> elcode & 1) == 0 || isExecTask) triggers.push(`${ELEMENT_TYPE_KEY[ELEMENT_CODE_KEY[elcode]]}-getdmg-oppo`);
        });
        if (support.cnt >= 4) triggers.length = 0;
        if (support.cnt >= 3) triggers.push('phase-end');
        const [el] = objToArr(PURE_ELEMENT_TYPE_KEY).find(([, elname]) => elname == trigger.slice(0, trigger.indexOf('-getdmg-oppo'))) ?? [];
        return {
            trigger: triggers,
            supportCnt: isCdt(el != undefined && (oppoGetElDmgType >> PURE_ELEMENT_CODE[el] & 1) == 0, 1),
            exec: spt => {
                if (trigger == 'phase-end' && spt.cnt >= 3) {
                    return { cmds: [{ cmd: 'getCard', cnt: spt.cnt }], isDestroy: true }
                }
                if (trigger.endsWith('-getdmg-oppo')) spt.cnt = Math.min(4, oppoGetElDmgType.toString(2).split('').filter(v => +v).length);
                return { isDestroy: false }
            }
        }
    }),
    // 太郎丸
    322024: () => new SupportBuilder().collection().handle((support, event) => {
        if (event.card?.id != 302202) return;
        return {
            trigger: ['card'],
            summon: isCdt(support.cnt == 1, [[302201, support.card.UI.src]]),
            exec: spt => ({ isDestroy: ++spt.cnt >= 2 }),
        }
    }),
    // 白手套和渔夫
    322025: () => new SupportBuilder().round(2).handle(() => ({
        trigger: ['phase-end'],
        exec: support => {
            const cmds: Cmds[] = [{ cmd: 'addCard', cnt: 1, card: 302203, hidxs: [5] }];
            if (support.cnt == 1) cmds.push({ cmd: 'getCard', cnt: 1 });
            return { cmds, isDestroy: --support.cnt == 0 }
        }
    })),
    // 亚瑟先生
    322026: () => new SupportBuilder().collection().handle((support, event) => {
        const { discard = 0, trigger = '', epile = [] } = event;
        if (+(support.cnt >= 2) ^ +(trigger == 'phase-end' && epile.length > 0)) return;
        return {
            trigger: ['discard', 'reconcile', 'phase-end'],
            supportCnt: isCdt(trigger != 'phase-end', discard || 1),
            exec: spt => {
                if (trigger == 'phase-end') {
                    spt.cnt = 0;
                    return { cmds: [{ cmd: 'getCard', cnt: 1, card: epile[0].id }], isDestroy: false }
                }
                spt.cnt = Math.min(2, spt.cnt + (trigger == 'reconcile' ? 1 : discard));
                return { isDestroy: false }
            },
        }
    }),
    // 瑟琳
    322027: () => new SupportBuilder().round(3).handle(() => ({
        trigger: ['phase-start', 'enter'],
        exec: support => ({
            cmds: [{ cmd: 'getCard', cnt: 1, hidxs: Array.from({ length: 10 }, (_, i) => 302206 + i) }],
            isDestroy: --support.cnt == 0,
        }),
    })),
    // 阿伽娅
    322028: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        return {
            trigger: ['vehicle'],
            isNotAddTask: true,
            minusDiceSkill: { vehicle: [0, 0, 1] },
            exec: spt => {
                if (event.isMinusDiceSkill) --spt.perCnt;
                return { isDestroy: false }
            }
        }
    }),
    // 参量质变仪
    323001: () => new SupportBuilder().collection().handle((support, event) => {
        const { skid = -1 } = event;
        if (skid == -1) return;
        return {
            trigger: ['el-dmg', 'el-getdmg'],
            supportCnt: support.cnt < 2 ? 1 : -3,
            exec: spt => {
                if (++spt.cnt < 3) return { isDestroy: false }
                return { cmds: [{ cmd: 'getDice', cnt: 3, mode: CMD_MODE.Random }], isDestroy: true }
            }
        }
    }),
    // 便携营养袋
    323002: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { card, trigger = '' } = event;
        if (trigger != 'enter' && (support.perCnt <= 0 || !card?.hasSubtype(CARD_SUBTYPE.Food))) return;
        return {
            trigger: ['card', 'enter'],
            exec: spt => {
                if (trigger != 'enter') --spt.perCnt;
                return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Food, isAttach: true }], isDestroy: false }
            }
        }
    }),
    // 红羽团扇
    323003: () => new SupportBuilder().permanent().perCnt(1).handle((support, _, ver) => {
        if (support.perCnt <= 0) return;
        return {
            trigger: ['change'],
            exec: spt => {
                --spt.perCnt;
                return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(302303)] }], isDestroy: false }
            }
        }
    }),
    // 寻宝仙灵
    323004: () => new SupportBuilder().collection().handle(support => ({
        trigger: ['skill'],
        supportCnt: support.cnt < 2 ? 1 : -3,
        exec: spt => {
            if (++spt.cnt < 3) return { isDestroy: false }
            return { cmds: [{ cmd: 'getCard', cnt: 3 }], isDestroy: true }
        }
    })),
    // 化种匣
    323005: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { card, minusDiceCard: mdc = 0 } = event;
        if (card && (ver < 'v4.6.0' ? card.cost == 1 : card.cost >= 2) && card.type == CARD_TYPE.Support && support.perCnt > 0 && card.cost > mdc) {
            return {
                trigger: ['card'],
                minusDiceCard: 1,
                isNotAddTask: true,
                exec: spt => {
                    --spt.perCnt;
                    return { isDestroy: --spt.cnt == 0 }
                }
            }
        }
    }),
    // 留念镜
    323006: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { card, playerInfo: { usedCardIds = [] } = {}, minusDiceCard: mdc = 0 } = event;
        const subtypes = [CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Artifact, CARD_SUBTYPE.Place, CARD_SUBTYPE.Ally];
        if (card && usedCardIds.includes(card.id) && card.hasSubtype(...subtypes) && support.perCnt > 0 && card.cost > mdc) {
            return {
                trigger: ['card'],
                minusDiceCard: 2,
                isNotAddTask: true,
                exec: spt => {
                    --spt.perCnt;
                    return { isDestroy: --spt.cnt == 0 }
                }
            }
        }
    }),
    // 流明石触媒
    323007: () => new SupportBuilder().collection(3).perCnt(1).handle(support => {
        const triggers: Trigger[] = [];
        if (support.perCnt > 0) triggers.push('card');
        return {
            trigger: triggers,
            supportCnt: isCdt(support.card.useCnt == 2, -1),
            exec: spt => {
                if (++spt.card.useCnt == 3) {
                    --spt.perCnt;
                    --spt.cnt;
                    spt.card.useCnt = 0;
                }
                return {
                    cmds: isCdt(spt.perCnt == 0, [{ cmd: 'getCard', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }]),
                    isDestroy: spt.cnt == 0,
                }
            }
        }
    }),
    // 苦舍桓
    323008: () => new SupportBuilder().collection().perCnt(1).handle((support, event) => {
        const { hcards = [], trigger = '', isMinusDiceSkill = false } = event;
        if (trigger == 'phase-start' && (support.cnt >= 2 || hcards.length == 0)) return;
        if (support.perCnt == 0 && (trigger == 'card' || (trigger == 'skill' && support.cnt == 0))) return;
        return {
            trigger: ['phase-start', 'skill', 'card'],
            minusDiceSkill: isCdt(support.perCnt > 0 && support.cnt > 0, { skill: [0, 0, support.cnt] }),
            isNotAddTask: trigger != 'phase-start',
            exec: spt => {
                const cmds: Cmds[] = [];
                if (trigger == 'card') --spt.perCnt;
                else if (trigger == 'phase-start') {
                    const cnt = Math.min(hcards.length, 2 - spt.cnt);
                    spt.cnt += cnt;
                    cmds.push({ cmd: 'discard', cnt, mode: CMD_MODE.HighHandCard });
                } else if (trigger == 'skill' && isMinusDiceSkill) {
                    --spt.cnt;
                }
                return { cmds, isDestroy: false }
            },
        }
    }),

}

export const newSupport = (version: Version) => {
    return (card: Card, ...args: any[]) => {
        return supportTotal[card.id](...args).card(card).version(version).done();
    }
}