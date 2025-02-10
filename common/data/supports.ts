import { Card, Cmds, GameInfo, Hero, MinusDiceSkill, Status, Summon, Support, Trigger } from '../../typing';
import { CARD_SUBTYPE, CARD_TYPE, CMD_MODE, DICE_COST_TYPE, DiceCostType, ELEMENT_CODE_KEY, ELEMENT_TYPE_KEY, PURE_ELEMENT_CODE, PURE_ELEMENT_TYPE_KEY, SKILL_TYPE, SkillType, Version } from '../constant/enum.js';
import { DICE_WEIGHT } from '../constant/UIconst.js';
import { allHidxs, getBackHidxs, getMaxHertHidxs, getNextBackHidx } from '../utils/gameUtil.js';
import { arrToObj, isCdt, objToArr } from '../utils/utils.js';
import { SupportBuilder } from './builder/supportBuilder.js';

export type SupportHandleEvent = {
    dices?: DiceCostType[],
    trigger?: Trigger,
    eheros?: Hero[],
    eCombatStatus?: Status[],
    eSupports?: Support[],
    heros?: Hero[],
    supports?: Support[],
    pile?: Card[],
    reset?: boolean,
    card?: Card,
    hcards?: Card[],
    csummon?: Summon,
    isFirst?: boolean,
    hidxs?: number[],
    playerInfo?: GameInfo,
    eplayerInfo?: GameInfo,
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
    minusDiceCard?: number,
    isMinusDiceSkill?: boolean,
    minusDiceSkill?: number[][],
    isMinusDiceTalent?: boolean,
    skid?: number,
    sktype?: SkillType,
    hidx?: number,
    heal?: number[],
    getdmg?: number[],
    discardCnt?: number,
    epile?: Card[],
    isExecTask?: boolean,
}

export type SupportHandleRes = {
    trigger?: Trigger[],
    exec?: (support: Support, event: SupportExecEvent) => SupportExecRes | void,
    minusDiceCard?: number,
    minusDiceHero?: number,
    minusDiceSkill?: MinusDiceSkill,
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
    csummon?: Summon,
    isExecTask?: boolean,
}

export type SupportExecRes = {
    cmds?: Cmds[],
    isDestroy?: boolean,
    summon?: (number | [number, ...any])[] | number,
}

const getSortedDices = (dices: DiceCostType[]) => {
    const diceCnt = arrToObj(DICE_WEIGHT, 0);
    dices.forEach(d => ++diceCnt[d]);
    return objToArr(diceCnt)
        .sort((a, b) => b[1] * +(b[0] != DICE_COST_TYPE.Omni) - a[1] * +(a[0] != DICE_COST_TYPE.Omni) || DICE_WEIGHT.indexOf(a[0]) - DICE_WEIGHT.indexOf(b[0]))
        .flatMap(([d, cnt]) => new Array<DiceCostType>(cnt).fill(d));
}

const supportTotal: Record<number, (...args: any) => SupportBuilder> = {

    // 斗争之火
    300006: (cnt: number = 0) => new SupportBuilder().collection(cnt).handle((support, event) => {
        const { getdmg = [], supports = [], eSupports = [], trigger = '' } = event;
        const isTriggered = support.cnt > Math.max(...[...supports, ...eSupports].filter(s => s.card.id == support.card.id && s.entityId != support.entityId).map(s => s.cnt));
        if (trigger == 'phase-start' && !isTriggered) return;
        const supportCnt = isCdt(trigger == 'after-dmg', getdmg.reduce((a, c) => a + Math.max(0, c), 0));
        return {
            trigger: ['after-dmg', 'phase-start'],
            supportCnt,
            exec: spt => {
                const cmds: Cmds[] = [];
                if (trigger == 'after-dmg') spt.cnt += supportCnt ?? 0;
                else if (trigger == 'phase-start') {
                    spt.cnt = 0;
                    cmds.push({ cmd: 'getStatus', status: 300007 });
                }
                return { cmds }
            }
        }
    }),
    // 璃月港口
    321001: () => new SupportBuilder().round(2).handle(() => ({
        trigger: ['phase-end'],
        exec: spt => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: --spt.cnt == 0 })
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
        if (ver.gte('v4.5.0') && hcards.length <= 3) triggers.push('phase-start');
        return {
            trigger: triggers,
            element: -2,
            cnt: 2,
            exec: () => {
                if (trigger != 'phase-start') return;
                return { cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }], isDestroy: true }
            }
        }
    }),
    // 晨曦酒庄
    321004: () => new SupportBuilder().permanent().perCnt(2).perCnt(1, 'v4.8.0').handle((support, event) => {
        const { switchHeroDiceCnt = 0 } = event;
        if (support.perCnt <= 0 || switchHeroDiceCnt == 0) return;
        return {
            trigger: ['minus-switch'],
            isNotAddTask: true,
            minusDiceHero: 1,
            exec: spt => { --spt.perCnt }
        }
    }),
    // 望舒客栈
    321005: () => new SupportBuilder().round(2).heal(2).handle((_, event) => {
        const { heros = [] } = event;
        const hidxs = getMaxHertHidxs(heros, { isBack: true });
        if (hidxs.length == 0) return;
        return {
            trigger: ['phase-end'],
            exec: spt => ({ cmds: [{ cmd: 'heal', cnt: 2, hidxs }], isDestroy: --spt.cnt == 0 })
        }
    }),
    // 西风大教堂
    321006: () => new SupportBuilder().round(2).heal(2).handle((_, event) => {
        const { heros = [] } = event;
        const fhidx = heros.findIndex(h => h.isFront);
        if (fhidx == -1 || heros[fhidx].hp == heros[fhidx].maxHp) return;
        return {
            trigger: ['phase-end'],
            exec: spt => ({ cmds: [{ cmd: 'heal', hidxs: [fhidx], cnt: 2 }], isDestroy: --spt.cnt == 0 })
        }
    }),
    // 天守阁
    321007: () => new SupportBuilder().permanent().handle((_, event) => {
        const { dices = [] } = event;
        return {
            trigger: ['phase-start'],
            exec: () => {
                if (new Set(dices.filter(v => v != DICE_COST_TYPE.Omni)).size + dices.filter(v => v == DICE_COST_TYPE.Omni).length >= 5) {
                    return { cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }] }
                }
            }
        }
    }),
    // 鸣神大社
    321008: () => new SupportBuilder().round(3).handle(() => ({
        trigger: ['phase-start', 'enter'],
        exec: spt => ({ cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }], isDestroy: --spt.cnt == 0 })
    })),
    // 珊瑚宫
    321009: () => new SupportBuilder().round(2).handle((_, event) => {
        const { heros = [] } = event;
        if (heros.every(h => h.hp == h.maxHp)) return;
        return {
            trigger: ['phase-end'],
            exec: spt => ({ cmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(heros) }], isDestroy: --spt.cnt == 0 })
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
            }
        }
    }),
    // 桓那兰那
    321011: () => new SupportBuilder().collection().handle((_, event) => {
        const { dices = [], trigger } = event;
        return {
            trigger: ['phase-end', 'phase-start'],
            exec: spt => {
                if (trigger == 'phase-end') {
                    const pdices = getSortedDices(dices);
                    dices.length = 0;
                    dices.push(...pdices.slice(2));
                    spt.perCnt = -pdices.slice(0, 2).map(v => DICE_WEIGHT.indexOf(v) + 1).join('');
                    spt.cnt = pdices.slice(0, 2).length;
                    return;
                }
                if (trigger == 'phase-start') {
                    const element = spt.perCnt.toString().slice(1).split('').map(v => DICE_WEIGHT[Number(v) - 1]);
                    spt.cnt = 0;
                    spt.perCnt = 0;
                    if (element.length > 0) return { cmds: [{ cmd: 'getDice', cnt: 2, element }] }
                }
            }
        }
    }),
    // 镇守之森
    321012: () => new SupportBuilder().round(3).handle((_, event) => {
        const { isFirst = true } = event;
        if (isFirst) return;
        return {
            trigger: ['phase-start'],
            exec: spt => ({ cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero }], isDestroy: --spt.cnt == 0 })
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
                if (!isMinus) return;
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
            exec: spt => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], isDestroy: --spt.cnt == 0 })
        }
    }),
    // 欧庇克莱歌剧院
    321017: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { heros = [], eheros = [] } = event;
        const slotCost = heros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot, h.vehicleSlot?.[0]])
            .filter(slot => slot).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
        const eslotCost = eheros.flatMap(h => [h.talentSlot, h.artifactSlot, h.weaponSlot, h.vehicleSlot?.[0]])
            .filter(slot => slot).reduce((a, b) => a + (b?.cost ?? 0) + (b?.anydice ?? 0), 0);
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
    321018: () => new SupportBuilder().collection().handle((support, event) => {
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
                    return { cmds: [{ cmd: 'getStatus', status: 301018, isOppo: true }] }
                }
                spt.cnt = Math.min(4, spt.cnt + 1);
            }
        }
    }),
    // 清籁岛
    321019: () => new SupportBuilder().round(2).handle((_, event) => {
        const { heal = [], trigger = '' } = event;
        const hidxs = heal.map((hl, hli) => ({ hl, hli })).filter(v => v.hl > 0).map(v => v.hli);
        return {
            trigger: ['heal', 'heal-oppo', 'phase-end'],
            exec: spt => {
                if (trigger == 'phase-end') return { isDestroy: --spt.cnt == 0 }
                return { cmds: [{ cmd: 'getStatus', status: 301019, hidxs, isOppo: trigger == 'heal-oppo' }] }
            }
        }
    }),
    // 赤王陵
    321020: () => new SupportBuilder().collection().handle(support => ({
        trigger: ['drawcard-oppo'],
        supportCnt: support.cnt < 4 ? 1 : -5,
        exec: spt => {
            ++spt.cnt;
            if (spt.cnt < 4) return;
            return {
                cmds: [
                    { cmd: 'addCard', cnt: 2, card: 301020, hidxs: [2], isOppo: true },
                    { cmd: 'getStatus', status: 301022, isOppo: true },
                ],
                isDestroy: true,
            }
        },
    })),
    // 中央实验室遗址
    321021: () => new SupportBuilder().collection().handle((_, event) => {
        const { discardCnt = 1, trigger = '' } = event;
        return {
            trigger: ['discard', 'reconcile'],
            supportCnt: discardCnt,
            exec: spt => {
                const ocnt = spt.cnt;
                if (trigger == 'reconcile') ++spt.cnt;
                else if (trigger == 'discard') spt.cnt += discardCnt;
                const dcnt = Math.floor(spt.cnt / 3) - Math.floor(ocnt / 3);
                if (dcnt == 0) return;
                return { cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }], isDestroy: spt.cnt >= 9 }
            },
        }
    }),
    // 圣火竞技场
    321022: () => new SupportBuilder().collection().handle(() => ({
        trigger: ['skill', 'vehicle'],
        supportCnt: 1,
        exec: spt => {
            ++spt.cnt;
            const cmds: Cmds[] = [];
            if (spt.cnt == 2) cmds.push({ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random });
            else if (spt.cnt == 4) cmds.push({ cmd: 'heal', cnt: 2 });
            else if (spt.cnt == 6) cmds.push({ cmd: 'getStatus', status: 301023 });
            return { cmds, isDestroy: spt.cnt >= 6 }
        }
    })),
    // 特佩利舞台
    321023: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger = '', card, playerInfo: { initCardIds: acids = [] } = {}, eplayerInfo: { initCardIds: ecids = [] } = {} } = event;
        const triggers: Trigger[] = [];
        if (['card', 'enter'].includes(trigger) && !acids.includes(card?.id ?? support.card.id)) triggers.push(trigger);
        else if (card && trigger == 'ecard' && support.cnt > 0 && !ecids.includes(card.id)) triggers.push(trigger);
        if (support.cnt > 0) triggers.push('phase-start');
        return {
            trigger: triggers,
            supportCnt: trigger == 'card' ? 1 : trigger == 'ecard' ? -1 : 0,
            exec: spt => {
                const cmds: Cmds[] = [];
                if (trigger == 'phase-start') {
                    if (spt.cnt >= 3) cmds.push({ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random });
                    if (spt.cnt >= 1) cmds.push({ cmd: 'changeDice', cnt: 1 });
                } else if (['card', 'enter'].includes(trigger)) ++spt.cnt;
                else if (trigger == 'ecard') --spt.cnt;
                return { cmds }
            }
        }
    }),
    // ｢悬木人｣
    321024: () => new SupportBuilder().round(1).handle((support, event) => {
        const { card, playerInfo: { initCardIds = [] } = {} } = event;
        if (!card || initCardIds.includes(card.id) || card.cost + card.anydice < support.cnt) return;
        return {
            trigger: ['card'],
            supportCnt: 1,
            exec: spt => {
                ++spt.cnt;
                return { cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }] }
            }
        }
    }),
    // ｢流泉之众｣
    321025: () => new SupportBuilder().round(3).handle(() => ({
        trigger: ['summon-generate'],
        supportCnt: -1,
        exec: (spt, execEvent) => {
            const { csummon, isExecTask = true } = execEvent;
            csummon?.addUseCnt(true);
            if (!isExecTask) return;
            return { isDestroy: --spt.cnt == 0 }
        }
    })),
    // ｢花羽会｣
    321026: () => new SupportBuilder().collection().handle((_, event) => {
        const { discardCnt = 1, heros } = event;
        return {
            trigger: ['discard'],
            supportCnt: discardCnt,
            exec: spt => {
                const ncnt = spt.cnt + discardCnt;
                spt.cnt = ncnt % 2;
                if (ncnt < 2) return;
                return { cmds: [{ cmd: 'getStatus', status: [[301024, Math.floor(ncnt / 2)]], hidxs: getNextBackHidx(heros) }] }
            }
        }
    }),
    // 派蒙
    322001: () => new SupportBuilder().round(2).handle(() => ({
        trigger: ['phase-start'],
        exec: spt => ({ cmds: [{ cmd: 'getDice', cnt: 2, element: DICE_COST_TYPE.Omni }], isDestroy: --spt.cnt == 0 })
    })),
    // 凯瑟琳
    322002: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (event.isQuickAction || support.perCnt <= 0) return;
        return {
            trigger: ['minus-switch'],
            isNotAddTask: true,
            isQuickAction: true,
            exec: spt => { --spt.perCnt }
        }
    }),
    // 蒂玛乌斯
    322003: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { card, trigger = '', minusDiceCard: mdc = 0, playerInfo: { artifactCnt = 0 } = {} } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver.gte('v4.3.0') && artifactCnt >= 6) triggers.push('enter');
        const isMinus = support.perCnt > 0 && card && card.hasSubtype(CARD_SUBTYPE.Artifact) && card.cost > mdc && support.cnt >= card.cost - mdc;
        if (trigger === 'card' && !isMinus) return;
        return {
            trigger: triggers,
            isNotAddTask: trigger == 'card' && support.card.useCnt <= 0,
            isLast: true,
            minusDiceCard: isMinus ? card.cost - mdc : 0,
            exec: spt => {
                if (trigger == 'enter') return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Artifact, isAttach: true }] }
                if (trigger == 'phase-end') ++spt.cnt;
                else if (trigger == 'card' && isMinus) {
                    spt.cnt -= card.cost - mdc;
                    --spt.perCnt;
                    if (ver.isOffline && spt.card.useCnt > 0) {
                        spt.card.minusUseCnt();
                        return { cmds: [{ cmd: 'getCard', cnt: 1 }] }
                    }
                }
            }
        }
    }),
    // 瓦格纳
    322004: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { card, trigger = '', minusDiceCard: mdc = 0, playerInfo: { weaponTypeCnt = 0 } = {} } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver.gte('v4.3.0') && weaponTypeCnt >= 3) triggers.push('enter');
        const isMinus = support.perCnt > 0 && card && card.hasSubtype(CARD_SUBTYPE.Weapon) && card.cost > mdc && support.cnt >= card.cost - mdc;
        if (trigger == 'card' && !isMinus) return;
        return {
            trigger: triggers,
            isNotAddTask: trigger == 'card' && support.card.useCnt <= 0,
            isLast: true,
            minusDiceCard: isMinus ? card.cost - mdc : 0,
            exec: spt => {
                if (trigger == 'enter') return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Weapon, isAttach: true }] }
                if (trigger == 'phase-end') ++spt.cnt;
                else if (trigger == 'card' && isMinus) {
                    spt.cnt -= card.cost - mdc;
                    --spt.perCnt;
                    if (ver.isOffline && spt.card.useCnt > 0) {
                        spt.card.minusUseCnt();
                        return { cmds: [{ cmd: 'getCard', cnt: 1 }] }
                    }
                }
            }
        }
    }),
    // 卯师傅
    322005: () => new SupportBuilder().permanent(1).perCnt(1).handle((_, event, ver) => {
        const { card } = event;
        return {
            trigger: ['card'],
            exec: spt => {
                if (spt.perCnt <= 0 || !card?.hasSubtype(CARD_SUBTYPE.Food)) return;
                --spt.perCnt;
                const cmds: Cmds[] = [{ cmd: 'getDice', cnt: 1, mode: ver.isOffline ? CMD_MODE.RandomAll : CMD_MODE.Random }];
                if (ver.gte('v4.1.0') && spt.cnt > 0) {
                    --spt.cnt;
                    cmds.push({ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Food, isAttach: true });
                }
                return { cmds }
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
            exec: spt => { isMinus && --spt.perCnt }
        }
    }),
    // 提米
    322007: () => new SupportBuilder().collection().handle(() => ({
        trigger: ['phase-start', 'enter'],
        exec: spt => {
            if (++spt.cnt < 3) return;
            return {
                cmds: [{ cmd: 'getCard', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }],
                isDestroy: true,
            }
        }
    })),
    // 立本
    322008: () => new SupportBuilder().collection().handle((support, event) => {
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
                    return;
                }
                if (trigger == 'phase-start') {
                    return { cmds: [{ cmd: 'getCard', cnt: 2 }, { cmd: 'getDice', cnt: 2, element: DICE_COST_TYPE.Omni }], isDestroy: true }
                }
            }
        }
    }),
    // 常九爷
    322009: () => new SupportBuilder().collection().handle((support, event) => {
        const { sktype = SKILL_TYPE.Vehicle } = event;
        if (sktype == SKILL_TYPE.Vehicle) return;
        return {
            trigger: ['Physical-dmg', 'Physical-getdmg', 'Pierce-dmg', 'Pierce-getdmg', 'elReaction', 'get-elReaction'],
            supportCnt: support.cnt < 2 ? 1 : -3,
            isOrTrigger: true,
            exec: spt => {
                if (++spt.cnt < 3) return;
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
            exec: spt => { isMinusDiceSkill && --spt.perCnt }
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
            exec: spt => {
                if (hidxs.length == 0) return;
                return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }], isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 刘苏
    322012: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { heros = [], hidx = -1 } = event;
        if (support.perCnt <= 0 || (heros[hidx]?.energy ?? 1) > 0) return;
        return {
            trigger: ['switch'],
            supportCnt: -1,
            exec: spt => {
                --spt.perCnt;
                return { cmds: [{ cmd: 'getEnergy', cnt: 1 }], isDestroy: --spt.cnt == 0 }
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
            exec: spt => { isMinus && --spt.perCnt }
        }
    }),
    // 迪娜泽黛
    322016: () => new SupportBuilder().permanent(1).perCnt(1).handle((support, event, ver) => {
        const { card, minusDiceCard: mdc = 0, pile = [] } = event;
        const isMinus = card && card.hasSubtype(CARD_SUBTYPE.Ally) && card.cost > mdc && support.perCnt > 0;
        return {
            trigger: ['card'],
            isNotAddTask: ver.lt('v4.1.0') || support.cnt == 0,
            minusDiceCard: isCdt(isMinus, 1),
            exec: spt => {
                const cmds: Cmds[] = [];
                if (isMinus) --spt.perCnt;
                if (ver.gte('v4.1.0') && spt.cnt > 0 && pile.some(c => c.hasSubtype(CARD_SUBTYPE.Ally))) {
                    --spt.cnt;
                    cmds.push({ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Ally, isAttach: true });
                }
                return { cmds }
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
                return { cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero, hidxs: [1] }] }
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
            exec: spt => { isMinus && --spt.perCnt }
        }
    }),
    // 塞塔蕾
    322019: () => new SupportBuilder().collection(3).handle((_, event) => {
        const { hcards } = event;
        if ((hcards?.length ?? 1) > 0) return;
        return {
            trigger: ['action-after', 'action-after-oppo'],
            exec: spt => ({ cmds: [{ cmd: 'getCard', cnt: 1 }], isDestroy: --spt.cnt == 0 })
        }
    }),
    // 弥生七月
    322020: () => new SupportBuilder().permanent().perCnt(1).handle((support, event, ver) => {
        if (support.perCnt <= 0) return;
        const { card, heros = [], minusDiceCard: mdc = 0 } = event;
        const isMinus = card && card.hasSubtype(CARD_SUBTYPE.Artifact) && card.cost > mdc;
        const artifactLen = heros.filter(h => h.artifactSlot != null).length;
        const minusCnt = 1 + +(ver.lt('v4.6.0') ? artifactLen : (artifactLen >= 2));
        return {
            trigger: ['card'],
            isNotAddTask: true,
            minusDiceCard: isCdt(isMinus, minusCnt),
            exec: spt => { isMinus && --spt.perCnt }
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
        const threshold = ver.lt('v4.6.0') ? 5 : 6;
        return {
            trigger: support.cnt >= threshold ? ['skilltype3'] : ['support-destroy'],
            supportCnt: isCdt(support.cnt >= threshold, -10, 1),
            exec: spt => {
                if (trigger == 'skilltype3') {
                    if (ver.lt('v4.6.0')) return { cmds: [{ cmd: 'getDice', cnt: spt.cnt - 2, element: DICE_COST_TYPE.Omni }], isDestroy: true }
                    return { cmds: [{ cmd: 'getStatus', status: 302205 }], isDestroy: true }
                }
                if (trigger == 'support-destroy') spt.cnt = Math.min(6, destroyedSupport);
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
        exec: spt => {
            const cmds: Cmds[] = [{ cmd: 'addCard', cnt: 1, card: 302203, hidxs: [5] }];
            if (spt.cnt == 1) cmds.push({ cmd: 'getCard', cnt: 1 });
            return { cmds, isDestroy: --spt.cnt == 0 }
        }
    })),
    // 亚瑟先生
    322026: () => new SupportBuilder().collection().handle((support, event) => {
        const { discardCnt = 1, trigger = '', epile = [] } = event;
        if (+(support.cnt >= 2) ^ +(trigger == 'phase-end' && epile.length > 0)) return;
        return {
            trigger: ['discard', 'reconcile', 'phase-end'],
            supportCnt: isCdt(trigger != 'phase-end', discardCnt),
            exec: spt => {
                if (trigger == 'phase-end') {
                    spt.cnt = 0;
                    return { cmds: [{ cmd: 'getCard', cnt: 1, card: epile[0].id }] }
                }
                spt.cnt = Math.min(2, spt.cnt + (trigger == 'reconcile' ? 1 : discardCnt));
            },
        }
    }),
    // 瑟琳
    322027: () => new SupportBuilder().round(3).handle(() => ({
        trigger: ['phase-start', 'enter'],
        exec: spt => ({
            cmds: [{ cmd: 'getCard', cnt: 1, hidxs: Array.from({ length: 10 }, (_, i) => 302206 + i) }],
            isDestroy: --spt.cnt == 0,
        }),
    })),
    // 阿伽娅
    322028: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        return {
            trigger: ['vehicle'],
            isNotAddTask: true,
            minusDiceSkill: { skilltype5: [0, 0, 1] },
            exec: spt => { event.isMinusDiceSkill && --spt.perCnt }
        }
    }),
    // 参量质变仪
    323001: () => new SupportBuilder().collection().handle((support, event, ver) => {
        const { sktype = SKILL_TYPE.Vehicle } = event;
        if (sktype == SKILL_TYPE.Vehicle) return;
        return {
            trigger: ['el-dmg', 'el-getdmg'],
            supportCnt: support.cnt < 2 ? 1 : -3,
            exec: spt => {
                if (++spt.cnt < 3) return;
                return { cmds: [{ cmd: 'getDice', cnt: 3, mode: ver.isOffline ? CMD_MODE.RandomAll : CMD_MODE.Random }], isDestroy: true }
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
                return { cmds: [{ cmd: 'getCard', cnt: 1, subtype: CARD_SUBTYPE.Food, isAttach: true }] }
            }
        }
    }),
    // 红羽团扇
    323003: () => new SupportBuilder().permanent().perCnt(1).handle(support => {
        if (support.perCnt <= 0) return;
        return {
            trigger: ['switch'],
            supportCnt: -1,
            exec: spt => {
                --spt.perCnt;
                return { cmds: [{ cmd: 'getStatus', status: 302303 }] }
            }
        }
    }),
    // 寻宝仙灵
    323004: () => new SupportBuilder().collection().handle(support => ({
        trigger: ['skill'],
        supportCnt: support.cnt < 2 ? 1 : -3,
        exec: spt => {
            if (++spt.cnt < 3) return;
            return { cmds: [{ cmd: 'getCard', cnt: 3 }], isDestroy: true }
        }
    })),
    // 化种匣
    323005: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { card, minusDiceCard: mdc = 0 } = event;
        if (card && (ver.lt('v4.6.0') ? card.cost == 1 : card.cost >= 2) && card.type == CARD_TYPE.Support && support.perCnt > 0 && card.cost > mdc) {
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
                if (spt.card.addUseCnt() == 3) {
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
                return { cmds }
            },
        }
    }),

}

export const newSupport = (version: Version) => {
    return (card: Card, ...args: any[]) => {
        return supportTotal[card.id](...args).card(card).version(version).done();
    }
}