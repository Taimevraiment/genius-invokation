import { Card, Cmds, GameInfo, Hero, MinuDiceSkill, Summon, Support, Trigger } from '../../typing';
import { DiceCostType, SupportType, VERSION, Version } from '../constant/enum.js';

export class GISupport {
    id: number; // 唯一id 从4000开始
    entityId: number = -1; // 实体id
    card: Card; // 场地卡
    cnt: number; // 次数
    perCnt: number; // 每回合x次
    hpCnt: number; // 回血数
    type: SupportType; // 类型 1轮次 2收集物 3常驻
    handle: (support: Support, event?: SupportHandleEvent) => SupportHandleRes; // 处理效果函数
    isSelected: boolean = false; // 是否被选择
    canSelect: boolean = false; // 能否被选择    
    constructor(
        id: number, card: Card, cnt: number, perCnt: number, type: SupportType,
        handle: (support: Support, event?: SupportHandleEvent) => SupportHandleRes | undefined, hpCnt = 0
    ) {
        this.id = id;
        this.card = card;
        this.cnt = cnt;
        this.perCnt = perCnt;
        this.type = type;
        this.hpCnt = hpCnt;
        this.handle = (support, event = {}) => {
            const { reset = false } = event;
            if (reset && perCnt > 0) {
                support.perCnt = perCnt;
                return {}
            }
            return handle(support, event) ?? {};
        };
    }
    setEntityId(id: number): Support {
        if (this.entityId == -1) this.entityId = id;
        return this;
    }
}

export type SupportHandleEvent = {
    dices?: DiceCostType[],
    trigger?: Trigger,
    eheros?: Hero[],
    heros?: Hero[],
    reset?: boolean,
    card?: Card,
    hcards?: Card[],
    isFirst?: boolean,
    hidxs?: number[],
    playerInfo?: GameInfo,
    minusDiceCard?: number,
    minusDiceSkillIds?: number[],
    isSkill?: number,
    hidx?: number,
    heal?: number[],
    getdmg?: number[],
    discard?: number,
    epile?: Card[],
}

export type SupportHandleRes = {
    trigger?: Trigger[],
    exec?: (event: SupportExecEvent) => SupportExecRes,
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
    summon?: Summon[],
}

export type SupportExecEvent = {
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
    summonDiffCnt?: number,
}

export type SupportExecRes = {
    cmds?: Cmds[],
    isDestroy: boolean,
    switchHeroDiceCnt?: number,
    summon?: Summon[],
}

// const DICE_WEIGHT = [ // 吃骰子的优先级权重(越低越优先)
//     DICE_COST_TYPE.Omni,
//     DICE_COST_TYPE.Cryo,
//     DICE_COST_TYPE.Hydro,
//     DICE_COST_TYPE.Pyro,
//     DICE_COST_TYPE.Electro,
//     DICE_COST_TYPE.Geo,
//     DICE_COST_TYPE.Dendro,
//     DICE_COST_TYPE.Anemo,
// ];

// const getSortedDices = (dices: DiceCostType[]) => {
//     const diceCnt = arrToObj(DICE_WEIGHT, 0);
//     dices.forEach(d => ++diceCnt[d]);
//     return objToArr(diceCnt)
//         .sort((a, b) => b[1] * (b[0] == DICE_COST_TYPE.Omni ? 0 : 1) - a[1] * (a[0] == DICE_COST_TYPE.Omni ? 0 : 1) || DICE_WEIGHT.indexOf(a[0]) - DICE_WEIGHT.indexOf(b[0]))
//         .flatMap(([d, cnt]) => new Array<DiceCostType>(cnt).fill(d));
// }

const supportTotal: Record<number, (...args: any) => Support> = {
    // 4000: () => new GISupport(4000, 0, 0, 0, 0, () => ({})),

    // // 派蒙
    // 4001: (card: Card) => new GISupport(4001, card, 2, 0, 1, support => ({
    //     trigger: ['phase-start'],
    //     exec: () => ({ cmds: [{ cmd: 'getDice', cnt: 2, element: 0 }], isDestroy: --support.cnt == 0 })
    // })),
    // // 参量质变仪
    // 4002: (card: Card) => new GISupport(4002, card, 0, 0, 2, (support, event = {}) => {
    //     const { isSkill = -1 } = event;
    //     if (isSkill == -1) return;
    //     return {
    //         trigger: ['el-dmg', 'el-getdmg'],
    //         supportCnt: support.cnt < 2 ? 1 : -3,
    //         exec: () => {
    //             if (++support.cnt < 3) return { isDestroy: false }
    //             return { cmds: [{ cmd: 'getDice', cnt: 3, element: -1 }], isDestroy: true }
    //         }
    //     }
    // }),
    // // 璃月港口
    // 4003: (card: Card) => new GISupport(4003, card, 2, 0, 1, support => ({
    //     trigger: ['phase-end'],
    //     exec: () => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: --support.cnt == 0 })
    // })),
    // // 常九爷
    // 4004: (card: Card) => new GISupport(4004, card, 0, 0, 2, (support, event = {}) => {
    //     const { isSkill = -1 } = event;
    //     if (isSkill == -1) return;
    //     return {
    //         trigger: ['any-dmg', 'any-getdmg', 'pen-dmg', 'pen-getdmg', 'elReaction', 'get-elReaction'],
    //         supportCnt: support.cnt < 2 ? 1 : -3,
    //         isOrTrigger: true,
    //         exec: () => {
    //             if (++support.cnt < 3) return { isDestroy: false }
    //             return { cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: true }
    //         }
    //     }
    // }),
    // // 立本
    // 4005: (card: Card) => new GISupport(4005, card, 0, 0, 2, (support, event = {}) => {
    //     const { dices = [], trigger } = event;
    //     return {
    //         trigger: ['phase-end', 'phase-start'],
    //         exec: () => {
    //             if (trigger == 'phase-end') {
    //                 const pdices = getSortedDices(dices);
    //                 dices.length = 0;
    //                 while (pdices.length > 0) {
    //                     if (support.cnt >= 3) {
    //                         dices.push(...pdices);
    //                         break;
    //                     }
    //                     const pdice = pdices!.shift();
    //                     ++support.cnt;
    //                     while (pdices[0] == pdice && pdice > 0) {
    //                         pdices.shift();
    //                         dices.push(pdice);
    //                     }
    //                 }
    //                 return { isDestroy: false }
    //             }
    //             if (trigger == 'phase-start' && support.cnt >= 3) {
    //                 return { cmds: [{ cmd: 'getCard', cnt: 2 }, { cmd: 'getDice', cnt: 2, element: 0 }], isDestroy: true }
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 望舒客栈
    // 4006: (card: Card) => new GISupport(4006, card, 2, 0, 1, (support, event = {}) => {
    //     const { heros = [] } = event;
    //     const minHp = Math.min(...heros.filter(h => h.hp > 0 && h.hp < h.maxhp && !h.isFront).map(h => h.hp));
    //     const hidxs: number[] = [];
    //     const fhidx = heros.findIndex(h => h.isFront);
    //     for (let i = 1; i < heros.length; ++i) {
    //         const hidx = (i + fhidx) % heros.length;
    //         if (heros[hidx].hp == minHp) {
    //             hidxs.push(hidx);
    //             break;
    //         }
    //     }
    //     if (hidxs.length == 0) return;
    //     return {
    //         trigger: ['phase-end'],
    //         exec: () => ({ cmds: [{ cmd: 'heal', hidxs, cnt: 2 }], isDestroy: --support.cnt == 0 })
    //     }
    // }, 2),
    // // 西风大教堂
    // 4007: (card: Card) => new GISupport(4007, card, 2, 0, 1, (support, event = {}) => {
    //     const { heros = [] } = event;
    //     return {
    //         trigger: ['phase-end'],
    //         exec: () => {
    //             const frontHeroIdx = heros.findIndex(h => h.isFront);
    //             if (frontHeroIdx == -1 || heros[frontHeroIdx].hp == heros[frontHeroIdx].maxhp) {
    //                 return { isDestroy: false }
    //             }
    //             return { cmds: [{ cmd: 'heal', hidxs: [frontHeroIdx], cnt: 2 }], isDestroy: --support.cnt == 0 }
    //         }
    //     }
    // }, 2),

    // // 晨曦酒庄
    // 4008: (card: Card) => new GISupport(4008, card, 0, 1, 3, support => ({
    //     trigger: ['change'],
    //     isNotAddTask: true,
    //     minusDiceHero: support.perCnt,
    //     exec: execEvent => {
    //         let { switchHeroDiceCnt = 0 } = execEvent;
    //         if (support.perCnt > 0 && switchHeroDiceCnt > 0) {
    //             --support.perCnt;
    //             --switchHeroDiceCnt;
    //         }
    //         return { switchHeroDiceCnt, isDestroy: false }
    //     }
    // })),
    // // 骑士团图书馆
    // 4009: (card: Card) => new GISupport(4009, card, 0, 0, 3, () => ({
    //     trigger: ['phase-dice'],
    //     addRollCnt: 1,
    // })),
    // // 群玉阁
    // 4010: (card: Card) => new GISupport(4010, card, 0, 0, 3, (_support, event = {}) => {
    //     const { hcards = [], trigger = '' } = event;
    //     const triggers: Trigger[] = ['phase-dice'];
    //     if (hcards.length <= 3) triggers.push('phase-start');
    //     return {
    //         trigger: triggers,
    //         element: -2,
    //         cnt: 2,
    //         exec: () => {
    //             if (trigger == 'phase-start') {
    //                 return { cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }], isDestroy: true }
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 凯瑟琳
    // 4011: (card: Card) => new GISupport(4011, card, 0, 1, 3, support => ({
    //     trigger: ['change'],
    //     isNotAddTask: true,
    //     isQuickAction: support.perCnt == 1,
    //     exec: execEvent => {
    //         if (support.perCnt > 0 && execEvent?.isQuickAction) --support.perCnt;
    //         return { isDestroy: false }
    //     }
    // })),
    // // 蒂玛乌斯
    // 4012: (card: Card) => new GISupport(4012, card, 2, 1, 2, (support, event = {}) => {
    //     const { card, trigger = '', minusDiceCard: mdc = 0 } = event;
    //     const isMinus = support.perCnt > 0 && card && card.subType.includes(1) && card.cost > mdc && support.cnt >= card.cost - mdc;
    //     return {
    //         trigger: ['phase-end', 'card'],
    //         isNotAddTask: trigger != 'phase-end',
    //         isLast: true,
    //         minusDiceCard: isMinus ? card.cost - mdc : 0,
    //         exec: () => {
    //             if (trigger == 'phase-end') ++support.cnt;
    //             else if (trigger == 'card' && isMinus) {
    //                 support.cnt -= card.cost - mdc;
    //                 --support.perCnt;
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 瓦格纳
    // 4013: (card: Card) => new GISupport(4013, card, 2, 1, 2, (support, event = {}) => {
    //     const { card, trigger = '', minusDiceCard: mdc = 0 } = event;
    //     const isMinus = support.perCnt > 0 && card && card.subType.includes(0) && card.cost > mdc && support.cnt >= card.cost - mdc;
    //     return {
    //         trigger: ['phase-end', 'card'],
    //         isNotAddTask: trigger != 'phase-end',
    //         isLast: true,
    //         minusDiceCard: isMinus ? card.cost - mdc : 0,
    //         exec: () => {
    //             if (trigger == 'phase-end') ++support.cnt;
    //             else if (trigger == 'card' && isMinus) {
    //                 support.cnt -= card.cost - mdc;
    //                 --support.perCnt;
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 卯师傅
    // 4014: (card: Card) => new GISupport(4014, card, 1, 1, 3, (support, event = {}) => {
    //     const { card } = event;
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         exec: () => {
    //             if (support.perCnt <= 0 || !card?.subType?.includes(5)) return { isDestroy: false }
    //             --support.perCnt;
    //             const cmds: Cmds[] = [{ cmd: 'getDice', cnt: 1, element: -1 }];
    //             if (support.cnt > 0) {
    //                 --support.cnt;
    //                 cmds.push({ cmd: 'getCard', cnt: 1, subtype: 5 });
    //             }
    //             return { cmds, isDestroy: false }
    //         }
    //     }
    // }),
    // // 阿圆
    // 4015: (card: Card) => new GISupport(4015, card, 0, 1, 3, (support, event = {}) => {
    //     const { card, minusDiceCard: mdc = 0 } = event;
    //     const isMinus = support.perCnt > 0 && card && card.subType.includes(2) && card.cost > mdc;
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         minusDiceCard: isCdt(isMinus, 2),
    //         exec: () => {
    //             if (isMinus) --support.perCnt;
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 提米
    // 4016: (card: Card) => new GISupport(4016, card, 1, 0, 2, support => ({
    //     trigger: ['phase-start'],
    //     exec: () => {
    //         if (++support.cnt < 3) return { isDestroy: false }
    //         return {
    //             cmds: [{ cmd: 'getCard', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: 0 }],
    //             isDestroy: true,
    //         }
    //     }
    // })),
    // // 艾琳
    // 4017: (card: Card) => new GISupport(4017, card, 0, 1, 3, (support, event = {}) => {
    //     const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 1] },
    //         skill => (skill?.useCnt ?? 0) > 0 && support.perCnt > 0);
    //     return {
    //         trigger: ['skill'],
    //         isNotAddTask: true,
    //         ...minusSkillRes,
    //         exec: () => {
    //             if (support.perCnt > 0 && isMinusSkill) {
    //                 --support.perCnt;
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 田铁嘴
    // 4018: (card: Card) => new GISupport(4018, card, 2, 0, 1, (support, event = {}) => {
    //     const { heros = [] } = event;
    //     const hidxs: number[] = [];
    //     const frontHeroIdx = heros.findIndex(h => h.isFront);
    //     if (frontHeroIdx > -1 && heros[frontHeroIdx].energy < heros[frontHeroIdx].maxEnergy) {
    //         hidxs.push(frontHeroIdx);
    //     } else {
    //         const hidx = heros.findIndex(h => h.energy < h.maxEnergy);
    //         if (hidx > -1) hidxs.push(hidx);
    //     }
    //     return {
    //         trigger: ['phase-end'],
    //         exec: () => {
    //             if (hidxs.length == 0) return { isDestroy: false }
    //             return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }], isDestroy: --support.cnt == 0 }
    //         }
    //     }
    // }),
    // // 刘苏
    // 4019: (card: Card) => new GISupport(4019, card, 2, 1, 2, (support, event = {}) => {
    //     const { heros = [], hidx = -1 } = event;
    //     if (hidx == -1) return;
    //     return {
    //         trigger: ['change'],
    //         exec: () => {
    //             if (support.perCnt == 0 || (heros[hidx]?.energy ?? 1) > 0) return { isDestroy: false }
    //             --support.perCnt;
    //             return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: [hidx] }], isDestroy: --support.cnt == 0 }
    //         }
    //     }
    // }),
    // // 便携营养袋
    // 4020: (card: Card) => new GISupport(4020, card, 0, 1, 3, (support, event = {}) => {
    //     const { card } = event;
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         exec: () => {
    //             if (support.perCnt <= 0 || !card?.subType?.includes(5)) return { isDestroy: false }
    //             --support.perCnt;
    //             return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: 5 }], isDestroy: false }
    //         }
    //     }
    // }),
    // // 天守阁
    // 4021: (card: Card) => new GISupport(4021, card, 0, 0, 3,
    //     (_support, event = {}) => {
    //         const { dices = [] } = event;
    //         return {
    //             trigger: ['phase-start'],
    //             exec: () => {
    //                 const cmds: Cmds[] = [];
    //                 if (new Set(dices.filter(v => v > 0)).size + dices.filter(v => v == 0).length >= 5) {
    //                     cmds.push({ cmd: 'getDice', cnt: 1, element: 0 });
    //                 }
    //                 return { cmds, isDestroy: false }
    //             }
    //         }
    //     }),
    // // 鸣神大社
    // 4022: (card: Card) => new GISupport(4022, card, 2, 0, 1, support => ({
    //     trigger: ['phase-start'],
    //     exec: () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: -1 }], isDestroy: --support.cnt == 0 })
    // })),
    // // 珊瑚宫
    // 4023: (card: Card) => new GISupport(4023, card, 2, 0, 1, (support, event = {}) => {
    //     const { heros = [] } = event;
    //     if (heros.every(h => h.hp == h.maxhp)) return;
    //     return {
    //         trigger: ['phase-end'],
    //         exec: () => ({ cmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(event.heros) }], isDestroy: --support.cnt == 0 })
    //     }
    // }),
    // // 须弥城
    // 4024: (card: Card) => new GISupport(4024, card, 0, 1, 3, (support, event = {}) => {
    //     const { dices = [], hcards = [], card, trigger = '', minusDiceCard: mdc = 0 } = event;
    //     const isMinus = dices.length <= hcards.length && support.perCnt > 0;
    //     const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 1] }, () => isMinus);
    //     const isCard = card && card.subType.includes(6) && card.cost + card.anydice > mdc;
    //     return {
    //         ...minusSkillRes,
    //         minusDiceCard: isCdt(isMinus && isCard, 1),
    //         trigger: ['skill', 'card'],
    //         isNotAddTask: true,
    //         exec: () => {
    //             if (isMinus && (trigger == 'skill' && isMinusSkill || trigger == 'card' && isCard)) {
    //                 --support.perCnt;
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 桓那兰那
    // 4025: (card: Card) => new GISupport(4025, card, 0, 0, 2, (support, event = {}) => {
    //     const { dices = [], trigger } = event;
    //     return {
    //         trigger: ['phase-end', 'phase-start'],
    //         exec: () => {
    //             if (trigger == 'phase-end') {
    //                 const pdices = getSortedDices(dices);
    //                 dices.length = 0;
    //                 dices.push(...pdices.slice(2));
    //                 support.perCnt = -pdices.slice(0, 2).map(v => v == 0 ? 8 : v).join('');
    //                 support.cnt = pdices.slice(0, 2).length;
    //                 return { isDestroy: false }
    //             } else if (trigger == 'phase-start') {
    //                 const element = support.perCnt.toString().slice(1).split('').map(v => Number(v) % 8);
    //                 support.cnt = 0;
    //                 support.perCnt = 0;
    //                 if (element.length > 0) return { cmds: [{ cmd: 'getDice', cnt: 2, element }], isDestroy: false }
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 镇守之森
    // 4026: (card: Card) => new GISupport(4026, card, 3, 0, 1, (support, event = {}) => {
    //     const { isFirst = true } = event;
    //     if (isFirst) return;
    //     return {
    //         trigger: ['phase-start'],
    //         exec: () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: -2 }], isDestroy: --support.cnt == 0 })
    //     }
    // }),
    // // 黄金屋
    // 4027: (card: Card) => new GISupport(4027, card, 2, 1, 2, (support, event = {}) => {
    //     const { card, minusDiceCard: mdc = 0 } = event;
    //     const isMinus = support.perCnt > 0 && card && card.cost >= 3 && card.subType.some(v => v < 2) && card.cost > mdc;
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         minusDiceCard: isCdt(isMinus, 1),
    //         exec: () => {
    //             if (!isMinus) return { isDestroy: false }
    //             --support.perCnt;
    //             return { isDestroy: --support.cnt == 0 }
    //         }
    //     }
    // }),
    // // 化城郭
    // 4028: (card: Card) => new GISupport(4028, card, 3, 1, 2, (support, event = {}) => {
    //     const { dices = [] } = event;
    //     if (support.perCnt == 0 || dices.length > 0) return;
    //     return {
    //         trigger: ['action-start'],
    //         exec: () => {
    //             --support.perCnt;
    //             return { cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }], isDestroy: --support.cnt == 0 }
    //         }
    //     }
    // }),
    // // 花散里
    // 4029: (card: Card) => new GISupport(4029, card, 0, 0, 2, (support, event = {}) => {
    //     const { card, trigger = '', minusDiceCard: mdc = 0 } = event;
    //     const isMinus = support.cnt >= 3 && card && card.subType.some(v => v < 2) && card.cost > mdc;
    //     return {
    //         trigger: ['summon-destroy', 'card'],
    //         minusDiceCard: isCdt(isMinus, 2),
    //         exec: execEvent => {
    //             let { summonDiffCnt = 0 } = execEvent;
    //             if (trigger == 'card' && isMinus) return { isDestroy: true }
    //             if (trigger == 'summon-destroy' && support.cnt < 3) {
    //                 support.cnt = Math.min(3, support.cnt + summonDiffCnt);
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 鲸井小弟
    // 4030: (card: Card) => new GISupport(4030, card, 0, 0, 3, () => ({
    //     trigger: ['phase-start'],
    //     isExchange: true,
    //     exec: () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }], isDestroy: true })
    // })),
    // // 旭东
    // 4031: (card: Card) => new GISupport(4031, card, 0, 1, 3, (support, event = {}) => {
    //     const { card, minusDiceCard: mdc = 0 } = event;
    //     const isMinus = card && card.subType.includes(5) && card.cost > mdc && support.perCnt > 0;
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         minusDiceCard: isCdt(isMinus, 2),
    //         exec: () => {
    //             if (isMinus) --support.perCnt;
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 迪娜泽黛
    // 4032: (card: Card) => new GISupport(4032, card, -1, 1, 3, (support, event = {}) => {
    //     const { card, minusDiceCard: mdc = 0 } = event;
    //     const isMinus = card && card.subType.includes(3) && card.cost > mdc && support.perCnt > 0;
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         minusDiceCard: isCdt(isMinus, 1),
    //         exec: () => {
    //             let cmds: Cmds[] | undefined;
    //             if (isMinus) --support.perCnt;
    //             if (support.cnt < 0) {
    //                 ++support.cnt;
    //                 cmds = [{ cmd: 'getCard', cnt: 1, subtype: 3 }];
    //             }
    //             return { cmds, isDestroy: false }
    //         }
    //     }
    // }),
    // // 拉娜
    // 4033: (card: Card) => new GISupport(4033, card, 0, 1, 3, (support, event = {}) => {
    //     const { heros = [] } = event;
    //     if (support.perCnt == 0 || getBackHidxs(heros).length == 0) return;
    //     return {
    //         trigger: ['skilltype2'],
    //         exec: () => {
    //             --support.perCnt;
    //             return {
    //                 cmds: [{ cmd: 'getDice', cnt: 1, element: -3 }],
    //                 isDestroy: false,
    //             }
    //         }
    //     }
    // }),
    // // 老章
    // 4034: (card: Card) => new GISupport(4034, card, 0, 1, 3, (support, event = {}) => {
    //     const { card, heros = [], minusDiceCard: mdc = 0 } = event;
    //     const isMinus = card && card.subType.includes(0) && card.cost > mdc && support.perCnt > 0;
    //     const minusCnt = 1 + heros.filter(h => h.weaponSlot != null).length;
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         minusDiceCard: isCdt(isMinus, minusCnt),
    //         exec: () => {
    //             if (isMinus) --support.perCnt;
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 塞塔蕾
    // 4035: (card: Card) => new GISupport(4035, card, 3, 0, 2, (support, event = {}) => {
    //     const { hcards } = event;
    //     if ((hcards?.length ?? 1) > 0) return;
    //     return {
    //         trigger: ['action-after', 'action-after-oppo'],
    //         exec: () => ({ cmds: [{ cmd: 'getCard', cnt: 1 }], isDestroy: --support.cnt == 0 })
    //     }
    // }),
    // // 弥生七月
    // 4036: (card: Card) => new GISupport(4036, card, 0, 1, 3, (support, event = {}) => {
    //     const { card, heros = [], minusDiceCard: mdc = 0 } = event;
    //     const isMinus = card && card.subType.includes(1) && card.cost > mdc && support.perCnt > 0;
    //     const minusCnt = 1 + +(heros.filter(h => h.artifactSlot != null).length >= 2);
    //     return {
    //         trigger: ['card'],
    //         isNotAddTask: true,
    //         minusDiceCard: isCdt(isMinus, minusCnt),
    //         exec: () => {
    //             if (isMinus) --support.perCnt;
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 红羽团扇
    // 4037: (card: Card) => new GISupport(4037, card, 0, 1, 3, support => ({
    //     trigger: ['change'],
    //     isNotAddTask: true,
    //     exec: () => {
    //         if (support.perCnt == 0) return { isDestroy: false }
    //         --support.perCnt;
    //         return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2084)] }], isDestroy: false }
    //     }
    // })),
    // // 寻宝仙灵
    // 4038: (card: Card) => new GISupport(4038, card, 0, 0, 2, support => ({
    //     trigger: ['skill'],
    //     supportCnt: support.cnt < 2 ? 1 : -3,
    //     exec: () => {
    //         if (++support.cnt < 3) return { isDestroy: false }
    //         return { cmds: [{ cmd: 'getCard', cnt: 3 }], isDestroy: true }
    //     }
    // })),
    // // 风龙废墟
    // 4039: (card: Card) => new GISupport(4039, card, 3, 1, 2, (support, event = {}) => {
    //     const { card, trigger = '', minusDiceCard: mdc = 0 } = event;
    //     const isCardMinus = card && card.subType.includes(6) && card.cost > mdc && support.perCnt > 0;
    //     const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 1] },
    //         skill => support.perCnt > 0 && skill.cost.toString().padStart(2, '0').split('').reduce((a, c) => a + Number(c), 0) >= 4)
    //     return {
    //         trigger: ['skill', 'card'],
    //         isNotAddTask: true,
    //         minusDiceCard: isCdt(isCardMinus, 1),
    //         ...minusSkillRes,
    //         exec: () => {
    //             if (support.perCnt > 0 && (trigger == 'card' && isCardMinus || trigger.startsWith('skill') && isMinusSkill)) {
    //                 --support.perCnt;
    //                 --support.cnt;
    //             }
    //             return { isDestroy: support.cnt == 0 }
    //         }
    //     }
    // }),
    // // 湖中垂柳
    // 4040: (card: Card) => new GISupport(4040, card, 2, 0, 1, (support, event = {}) => {
    //     const { hcards = [] } = event;
    //     return {
    //         trigger: hcards.length <= 2 ? ['phase-end'] : [],
    //         exec: () => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: --support.cnt == 0 })
    //     }
    // }),
    // // 欧庇克莱歌剧院
    // 4041: (card: Card) => new GISupport(4041, card, 3, 1, 2, (support, event = {}) => {
    //     const { heros = [], eheros = [] } = event;
    //     const slotCost = heros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot])
    //         .filter(slot => slot != null).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
    //     const eslotCost = eheros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot])
    //         .filter(slot => slot != null).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
    //     if (slotCost >= eslotCost && support.perCnt > 0) {
    //         return {
    //             trigger: ['action-start'],
    //             exec: () => {
    //                 --support.perCnt;
    //                 return { cmds: [{ cmd: 'getDice', cnt: 1, element: -2 }], isDestroy: --support.cnt == 0 }
    //             }
    //         }
    //     }
    // }),
    // // 玛梅赫
    // 4042: (card: Card) => new GISupport(4042, card, 3, 1, 2, (support, event = {}) => {
    //     const { card } = event;
    //     const isUse = card?.id != 321 && support.perCnt > 0 && card?.subType.some(st => [2, 3, 4, 5].includes(st));
    //     return {
    //         trigger: isUse ? ['card'] : [],
    //         exec: () => {
    //             --support.cnt;
    //             --support.perCnt;
    //             let card: Card | undefined;
    //             while (!card) {
    //                 let rid = Math.ceil(Math.random() * 400 + 200);
    //                 if (rid == 321) continue;
    //                 if (rid > 500) rid += 100;
    //                 card = cardsTotal(rid);
    //             }
    //             return { cmds: [{ cmd: 'getCard', cnt: 1, card }], isDestroy: support.cnt == 0 }
    //         }
    //     }
    // }),
    // // 化种匣
    // 4043: (card: Card) => new GISupport(4043, card, 2, 1, 2, (support, event = {}) => {
    //     const { card, minusDiceCard: mdc = 0 } = event;
    //     if (card && card.cost >= 2 && card.type == 1 && support.perCnt > 0 && card.cost > mdc) {
    //         return {
    //             trigger: ['card'],
    //             minusDiceCard: 1,
    //             isNotAddTask: true,
    //             exec: () => {
    //                 --support.perCnt;
    //                 return { isDestroy: --support.cnt == 0 }
    //             }
    //         }
    //     }
    // }),
    // // 留念镜
    // 4044: (card: Card) => new GISupport(4044, card, 2, 1, 2, (support, event = {}) => {
    //     const { card, playerInfo: { usedcards = [] } = {}, minusDiceCard: mdc = 0 } = event;
    //     if (card && usedcards.includes(card.id) && card.subType.some(sbtp => sbtp < 4) && support.perCnt > 0 && card.cost > mdc) {
    //         return {
    //             trigger: ['card'],
    //             minusDiceCard: 2,
    //             isNotAddTask: true,
    //             exec: () => {
    //                 --support.perCnt;
    //                 return { isDestroy: --support.cnt == 0 }
    //             }
    //         }
    //     }
    // }),
    // // 婕德
    // 4045: (card: Card, cnt: number) => new GISupport(4045, card, cnt, 0, 2, (support, event = {}) => {
    //     const { trigger = '', playerInfo: { destroyedSupport = 0 } = {} } = event;
    //     return {
    //         trigger: support.cnt >= 6 ? ['skilltype3'] : ['support-destroy'],
    //         supportCnt: isCdt(support.cnt >= 6, -10),
    //         exec: () => {
    //             if (trigger == 'skilltype3') return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2188)] }], isDestroy: true }
    //             if (trigger == 'support-destroy') support.cnt = Math.min(6, destroyedSupport);
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 西尔弗和迈勒斯
    // 4046: (card: Card, cnt: number) => new GISupport(4046, card, cnt, 0, 2, (support, event = {}) => {
    //     const { trigger = '', playerInfo: { oppoGetElDmgType = 0 } = {} } = event;
    //     const triggers: Trigger[] = [1, 2, 3, 4, 5, 6, 7].map(v => ELEMENT_ICON[v] + '-getdmg-oppo') as Trigger[];
    //     if (support.cnt >= 4) triggers.length = 0;
    //     if (support.cnt >= 3) triggers.push('phase-end');
    //     return {
    //         trigger: triggers,
    //         isNotAddTask: trigger != 'phase-end',
    //         exec: () => {
    //             if (trigger == 'phase-end' && support.cnt >= 3) {
    //                 return { cmds: [{ cmd: 'getCard', cnt: support.cnt }], isDestroy: true }
    //             }
    //             if (trigger.endsWith('-getdmg-oppo')) {
    //                 let typelist = oppoGetElDmgType;
    //                 let elcnt = 0;
    //                 while (typelist != 0) {
    //                     typelist &= typelist - 1;
    //                     ++elcnt;
    //                 }
    //                 support.cnt = Math.min(4, elcnt);
    //             }
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 梅洛彼得堡
    // 4047: (card: Card) => new GISupport(4047, card, 0, 0, 2, (support, event = {}) => {
    //     const { hidxs = [], getdmg = [], heal = [], eheros = [], trigger = '' } = event;
    //     const triggers: Trigger[] = [];
    //     if (trigger == 'getdmg' && getdmg[hidxs[0]] > 0 && support.cnt < 4) triggers.push('getdmg');
    //     if (trigger == 'heal' && heal[hidxs[0]] > 0 && support.cnt < 4) triggers.push('heal');
    //     const hasSts2174 = eheros.flatMap(h => h.outStatus).some(ost => ost.id == 2174);
    //     if (support.cnt >= 4 && !hasSts2174) triggers.push('phase-start');
    //     const isAdd = triggers.some(tr => ['getdmg', 'heal'].includes(tr));
    //     return {
    //         trigger: triggers,
    //         supportCnt: isCdt(isAdd, 1),
    //         exec: () => {
    //             if (trigger == 'phase-start') {
    //                 support.cnt -= 4;
    //                 return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2174)], isOppo: true }], isDestroy: false }
    //             }
    //             support.cnt = Math.min(4, support.cnt + 1);
    //             return { isDestroy: false }
    //         }
    //     }
    // }),
    // // 流明石触媒
    // 4048: (card: Card) => new GISupport(4048, card, 3, 3, 2, support => {
    //     const triggers: Trigger[] = [];
    //     if (support.perCnt > 0) triggers.push('card');
    //     return {
    //         trigger: triggers,
    //         exec: () => {
    //             if (--support.perCnt == 0) --support.cnt;
    //             return {
    //                 cmds: isCdt(support.perCnt == 0, [{ cmd: 'getCard', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: 0 }]),
    //                 isDestroy: support.cnt == 0,
    //             }
    //         }
    //     }
    // }),
    // // 清籁岛
    // 4049: (card: Card) => new GISupport(4049, card, 2, 0, 1, (support, event = {}) => {
    //     const { heal = [], trigger = '' } = event;
    //     const hidxs = heal.map((hl, hli) => ({ hl, hli })).filter(v => v.hl > 0).map(v => v.hli);
    //     return {
    //         trigger: ['heal', 'eheal', 'phase-end'],
    //         exec: () => {
    //             if (trigger == 'phase-end') return { isDestroy: --support.cnt == 0 }
    //             return {
    //                 cmds: [{ cmd: 'getStatus', status: [heroStatus(2184)], hidxs, isOppo: trigger == 'eheal' }],
    //                 isDestroy: false,
    //             }
    //         }
    //     }
    // }),
    // // 太郎丸
    // 4050: (card: Card) => new GISupport(4050, card, 0, 0, 2, (support, event = {}) => {
    //     if (event.card?.id != 902) return;
    //     return {
    //         trigger: ['card'],
    //         summon: isCdt(support.cnt == 1, [newSummonee(3059, support.card.src)]),
    //         exec: () => ({ isDestroy: ++support.cnt >= 2 }),
    //     }
    // }),
    // // 白手套和渔夫
    // 4051: (card: Card) => new GISupport(4051, card, 2, 0, 1, support => ({
    //     trigger: ['phase-end'],
    //     exec: () => {
    //         const cmds: Cmds[] = [{ cmd: 'addCard', cnt: 1, card: 903, hidxs: [5] }];
    //         if (support.cnt == 1) cmds.push({ cmd: 'getCard', cnt: 1 });
    //         return { cmds, isDestroy: --support.cnt == 0 }
    //     }
    // })),
    // // 赤王陵
    // 4052: (card: Card) => new GISupport(4052, card, 0, 0, 2, (support, event = {}) => {
    //     const { getcard = 0 } = event;
    //     return {
    //         trigger: ['getcard-oppo'],
    //         supportCnt: getcard + support.cnt < 4 ? getcard : -5,
    //         exec: () => {
    //             support.cnt += getcard;
    //             if (support.cnt < 4) return { isDestroy: false }
    //             return {
    //                 cmds: [
    //                     { cmd: 'addCard', cnt: 2, card: 908, hidxs: [2], isOppo: true },
    //                     { cmd: 'getStatus', status: [heroStatus(2214)], isOppo: true },
    //                 ],
    //                 isDestroy: true,
    //             }
    //         },
    //     }
    // }),
    // // 中央实验室遗址
    // 4053: (card: Card) => new GISupport(4053, card, 0, 0, 2, (support, event = {}) => {
    //     const { discard = 0, trigger = '' } = event;
    //     return {
    //         trigger: ['discard', 'reconcile'],
    //         exec: () => {
    //             const ocnt = support.cnt;
    //             if (trigger == 'reconcile') ++support.cnt;
    //             else if (trigger == 'discard') support.cnt += discard;
    //             const dcnt = Math.floor(support.cnt / 3) - Math.floor(ocnt / 3);
    //             if (dcnt == 0) return { isDestroy: false }
    //             return { cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }], isDestroy: support.cnt >= 9 }
    //         },
    //     }
    // }),
    // // 亚瑟先生
    // 4054: (card: Card) => new GISupport(4054, card, 0, 0, 2, (support, event = {}) => {
    //     const { discard = 0, trigger = '', epile = [] } = event;
    //     if (+(support.cnt >= 2) ^ +(trigger == 'phase-end' && epile.length > 0)) return;
    //     return {
    //         trigger: ['discard', 'reconcile', 'phase-end'],
    //         exec: () => {
    //             if (trigger == 'phase-end') {
    //                 support.cnt = 0;
    //                 return { cmds: [{ cmd: 'getCard', cnt: 1, card: epile[0].id }], isDestroy: false }
    //             }
    //             support.cnt = Math.min(2, support.cnt + (trigger == 'reconcile' ? 1 : discard));
    //             return { isDestroy: false }
    //         },
    //     }
    // }),
    // // 苦舍桓
    // 4055: (card: Card) => new GISupport(4055, card, 0, 1, 2, (support, event = {}) => {
    //     const { hcards = [], isSkill = -1, trigger = '' } = event;
    //     if (trigger == 'phase-start' && (support.cnt >= 2 || hcards.length == 0)) return;
    //     if (support.perCnt == 0 && (trigger == 'card' || (trigger == 'skill' && support.cnt == 0))) return;
    //     const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, support.cnt] }, () => support.perCnt > 0 && support.cnt > 0);
    //     return {
    //         trigger: ['phase-start', 'skill', 'card'],
    //         ...minusSkillRes,
    //         isNotAddTask: trigger != 'phase-start',
    //         exec: () => {
    //             const cmds: Cmds[] = [];
    //             if (trigger == 'card') --support.perCnt;
    //             else if (trigger == 'phase-start') {
    //                 const cnt = Math.min(hcards.length, 2 - support.cnt);
    //                 support.cnt += cnt;
    //                 cmds.push({ cmd: 'discard', cnt, element: 0 });
    //             } else if (trigger == 'skill' && isMinusSkill) {
    //                 support.cnt -= minusSkillRes.minusDiceSkills[isSkill].reduce((a, b) => a + b);
    //             }
    //             return { cmds, isDestroy: false }
    //         },
    //     }
    // }),
    // // 瑟琳
    // 4056: (card: Card) => new GISupport(4056, card, 3, 0, 1, support => ({
    //     trigger: ['phase-start'],
    //     exec: () => ({ cmds: [{ cmd: 'getCard', cnt: 1, card: 914 }], isDestroy: --support.cnt == 0 }),
    // })),
}

export const newSupport = (version: Version = VERSION[0]) => (id: number, ...args: any) => supportTotal[id](version, ...args);