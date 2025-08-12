import { Card, Trigger } from '../../typing';
import { CARD_SUBTYPE, CARD_TYPE, CMD_MODE, DICE_COST_TYPE, ELEMENT_CODE_KEY, ELEMENT_TYPE_KEY, PURE_ELEMENT_CODE, PURE_ELEMENT_TYPE_KEY, SUMMON_TAG, Version } from '../constant/enum.js';
import { DICE_WEIGHT } from '../constant/UIconst.js';
import { allHidxs, getBackHidxs, getDerivantParentId, getMaxHertHidxs, getNextBackHidx, getObjById, getSortedDices, hasObjById } from '../utils/gameUtil.js';
import { isCdt, objToArr } from '../utils/utils.js';
import { SupportBuilder } from './builder/supportBuilder.js';

const supportTotal: Record<number, (...args: any) => SupportBuilder> = {

    // 斗争之火
    300006: (cnt: number = 0) => new SupportBuilder().collection(cnt).handle((support, event) => {
        const { getdmg = [], supports = [], esupports = [], trigger } = event;
        const isTriggered = support.cnt > Math.max(...[...supports, ...esupports].filter(s => s.card.id == support.card.id && s.entityId != support.entityId).map(s => s.cnt));
        if (trigger == 'phase-start' && !isTriggered) return;
        const supportCnt = isCdt(trigger == 'after-dmg', getdmg.reduce((a, c) => a + Math.max(0, c), 0));
        return {
            triggers: ['after-dmg', 'phase-start'],
            supportCnt,
            exec: (spt, cmds) => {
                if (trigger == 'after-dmg') spt.cnt += supportCnt ?? 0;
                else if (trigger == 'phase-start') {
                    spt.cnt = 0;
                    cmds.getStatus(300007);
                }
            }
        }
    }),
    // 璃月港口
    321001: () => new SupportBuilder().round(2).handle(() => ({
        triggers: 'phase-end',
        exec: (spt, cmds) => (cmds.getCard(2), { isDestroy: --spt.cnt == 0 })
    })),
    // 骑士团图书馆
    321002: () => new SupportBuilder().permanent().handle((_, event) => ({
        triggers: ['phase-dice', 'enter'],
        isNotAddTask: true,
        addRollCnt: 1,
        exec: (_, cmds) => { event.trigger == 'enter' && cmds.reroll(1) }
    })),
    // 群玉阁
    321003: () => new SupportBuilder().permanent().handle((_, event, ver) => {
        const { hcards = [], trigger } = event;
        const triggers: Trigger[] = ['phase-dice'];
        if ((ver.gte('v4.5.0') || ver.isOffline) && hcards.length <= 3) triggers.push('phase-start');
        return {
            triggers,
            element: -2,
            cnt: 2,
            exec: (_, cmds) => {
                if (trigger != 'phase-start') return;
                cmds.getDice(1, { element: DICE_COST_TYPE.Omni });
                return { isDestroy: true }
            }
        }
    }),
    // 晨曦酒庄
    321004: () => new SupportBuilder().permanent().perCnt(2).perCnt(1, 'v4.8.0').handle((support, event) => {
        const { switchHeroDiceCnt = 0 } = event;
        if (support.perCnt <= 0 || switchHeroDiceCnt == 0) return;
        return {
            triggers: 'minus-switch',
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
            triggers: 'phase-end',
            exec: (spt, cmds) => (cmds.heal(2, { hidxs }), { isDestroy: --spt.cnt == 0 })
        }
    }),
    // 西风大教堂
    321006: () => new SupportBuilder().round(2).heal(2).handle((_, event) => {
        const { heros = [], hidx } = event;
        if (hidx == -1 || heros[hidx].hp == heros[hidx].maxHp) return;
        return {
            triggers: 'phase-end',
            exec: (spt, cmds) => (cmds.heal(2, { hidxs: hidx }), { isDestroy: --spt.cnt == 0 })
        }
    }),
    // 天守阁
    321007: () => new SupportBuilder().permanent().handle((_, event) => {
        const { dices = [] } = event;
        if (new Set(dices.filter(v => v != DICE_COST_TYPE.Omni)).size + dices.filter(v => v == DICE_COST_TYPE.Omni).length < 5) return;
        return {
            triggers: 'phase-start',
            exec: (_, cmds) => cmds.getDice(1, { element: DICE_COST_TYPE.Omni }).res,
        }
    }),
    // 鸣神大社
    321008: () => new SupportBuilder().round(4).round(3, 'v6.0.0').handle((_, event, ver) => {
        const { dices = [], isExecTask } = event;
        if (ver.gte('v6.0.0') && dices.length % 2 == 0 && !isExecTask) return;
        return {
            triggers: ver.lt('v6.0.0') ? ['phase-start', 'enter'] : 'after-skill',
            supportCnt: -1,
            exec: (spt, cmds) => (cmds.getDice(1, { mode: CMD_MODE.Random }), { isDestroy: --spt.cnt == 0 })
        }
    }),
    // 珊瑚宫
    321009: () => new SupportBuilder().round(2).handle((_, event) => {
        const { heros = [] } = event;
        if (heros.every(h => h.hp <= 0 || h.hp == h.maxHp)) return;
        return {
            triggers: 'phase-end',
            exec: (spt, cmds) => (cmds.heal(1, { hidxs: allHidxs(heros) }), { isDestroy: --spt.cnt == 0 })
        }
    }),
    // 须弥城
    321010: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { dices = [], hcards = [], isMinusDiceTalent, isMinusDiceSkill, trigger } = event;
        if (dices.length > hcards.length || support.perCnt <= 0) return;
        return {
            minusDiceSkill: { skill: [0, 0, 1] },
            minusDiceCard: isCdt(isMinusDiceTalent, 1),
            triggers: ['skill', 'card'],
            isNotAddTask: true,
            exec: spt => {
                if (trigger == 'skill' && isMinusDiceSkill || trigger == 'card' && isMinusDiceTalent) {
                    --spt.perCnt;
                }
            }
        }
    }),
    // 桓那兰那
    321011: () => new SupportBuilder().collection().handle((support, event) => {
        const { dices = [], trigger } = event;
        if (trigger == 'phase-start' && support.perCnt == 0 || trigger == 'phase-end' && dices.length == 0) return;
        return {
            triggers: ['phase-end', 'phase-start'],
            exec: (spt, cmds, execEvent) => {
                if (!execEvent.isExecTask) return;
                if (trigger == 'phase-end') {
                    const pdices = getSortedDices(dices);
                    dices.length = 0;
                    dices.push(...pdices.slice(2));
                    spt.perCnt = -pdices.slice(0, 2).map(v => DICE_WEIGHT.indexOf(v) + 1).join('');
                    spt.cnt = pdices.slice(0, 2).length;
                } else if (trigger == 'phase-start') {
                    const element = spt.perCnt.toString().slice(1).split('').map(v => DICE_WEIGHT[Number(v) - 1]);
                    spt.cnt = 0;
                    spt.perCnt = 0;
                    if (element.length > 0) cmds.getDice(Math.min(2, element.length), { element });
                }
            }
        }
    }),
    // 镇守之森
    321012: () => new SupportBuilder().round(3).perCnt(1).perCnt(0, 'v6.0.0').handle((support, event, ver) => {
        const { isFirst = true, dices = [], isMinusDiceSkill } = event;
        if (ver.lt('v6.0.0')) {
            if (isFirst) return;
            return {
                triggers: 'phase-start',
                exec: (spt, cmds) => (cmds.getDice(1, { mode: CMD_MODE.FrontHero }), { isDestroy: --spt.cnt == 0 })
            }
        }
        if (dices.length % 2 == 1 || support.perCnt <= 0) return;
        return {
            triggers: 'skilltype1',
            minusDiceSkill: { skilltype1: [0, 0, 1] },
            isNotAddTask: true,
            exec: spt => {
                if (isMinusDiceSkill) {
                    --spt.perCnt;
                    --spt.cnt;
                }
                return { isDestroy: spt.cnt == 0 }
            }
        }
    }),
    // 黄金屋
    321013: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { hcard, minusDiceCard: mdc = 0 } = event;
        if (support.perCnt > 0 && hcard && hcard.cost >= 3 && hcard.hasSubtype(CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Relic) && hcard.cost > mdc) {
            return {
                triggers: 'card',
                isNotAddTask: true,
                minusDiceCard: 1,
                exec: spt => {
                    --spt.perCnt;
                    return { isDestroy: --spt.cnt == 0 }
                }
            }
        }
    }),
    // 化城郭
    321014: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { dices = [] } = event;
        if (support.perCnt == 0 || dices.length > 0) return;
        return {
            triggers: 'action-start',
            exec: (spt, cmds) => {
                --spt.perCnt;
                cmds.getDice(1, { element: DICE_COST_TYPE.Omni });
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 风龙废墟
    321015: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { heros = [], hidx, trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
        if (trigger == 'enter') {
            return {
                triggers: 'enter',
                isNotAddTask: true,
                exec: (_, cmds) => cmds.getCard(1, { subtype: CARD_SUBTYPE.Talent, isFromPile: true }).res,
            }
        }
        const isCardMinus = isMinusDiceTalent && support.perCnt > 0;
        const skills = heros[hidx]?.skills.map(skill => {
            if (support.perCnt > 0 && skill.cost[0].cnt + skill.cost[1].cnt >= 4) return [0, 0, 1];
            return [0, 0, 0];
        });
        const isMinus = support.perCnt > 0 && (trigger == 'card' && isCardMinus || trigger == 'skill' && isMinusDiceSkill);
        return {
            triggers: ['skill', 'card'],
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
        if (hcards.length > 2) return;
        return { triggers: 'phase-end', exec: (spt, cmds) => (cmds.getCard(2), { isDestroy: --spt.cnt == 0 }) }
    }),
    // 欧庇克莱歌剧院
    321017: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { heros = [], eheros = [] } = event;
        const slotCost = heros.flatMap(h => h.equipments).reduce((a, b) => a + b.cost + b.anydice, 0);
        const eslotCost = eheros.flatMap(h => h.equipments).reduce((a, b) => a + b.cost + b.anydice, 0);
        if (slotCost >= eslotCost && support.perCnt > 0) {
            return {
                triggers: 'action-start',
                exec: (spt, cmds) => {
                    --spt.perCnt;
                    cmds.getDice(1, { mode: CMD_MODE.FrontHero });
                    return { isDestroy: --spt.cnt == 0 }
                }
            }
        }
    }),
    // 梅洛彼得堡
    321018: () => new SupportBuilder().collection().handle((support, event) => {
        const { hidx, getdmg = [], heal = [], trigger } = event;
        const triggers: Trigger[] = [];
        if (support.cnt < 4) {
            if (getdmg[hidx] > 0) triggers.push('getdmg');
            if (heal[hidx] > 0) triggers.push('heal');
        } else triggers.push('phase-start');
        const isAdd = triggers.some(tr => ['getdmg', 'heal'].includes(tr));
        return {
            triggers: triggers,
            supportCnt: isCdt(isAdd, 1),
            exec: (spt, cmds) => {
                if (trigger == 'phase-start') {
                    spt.cnt -= 4;
                    return cmds.getStatus(301018, { isOppo: true }).res;
                }
                spt.cnt = Math.min(4, spt.cnt + 1);
            }
        }
    }),
    // 清籁岛
    321019: () => new SupportBuilder().round(2).handle((_, event) => {
        const { heal = [], trigger } = event;
        const hidxs = heal.map((hl, hli) => ({ hl, hli })).filter(v => v.hl > 0).map(v => v.hli);
        return {
            triggers: ['heal', 'heal-oppo', 'phase-end'],
            exec: (spt, cmds) => {
                if (trigger == 'phase-end') return { isDestroy: --spt.cnt == 0 }
                cmds.getStatus(301019, { hidxs, isOppo: trigger == 'heal-oppo' });
            }
        }
    }),
    // 赤王陵
    321020: () => new SupportBuilder().collection().handle(support => ({
        triggers: 'drawcard-oppo',
        supportCnt: support.cnt < 4 ? 1 : -5,
        exec: (spt, cmds) => {
            if (++spt.cnt < 4) return;
            cmds.addCard(2, 301020, { scope: 2, isOppo: true }).getStatus(301022, { isOppo: true });
            return { isDestroy: true }
        },
    })),
    // 中央实验室遗址
    321021: () => new SupportBuilder().collection().handle((support, event) => {
        const { discards: { length: discardCnt } = [0], trigger } = event;
        return {
            triggers: ['discard', 'reconcile'],
            supportCnt: support.cnt + discardCnt < 9 ? discardCnt : -10,
            exec: (spt, cmds) => {
                const ocnt = spt.cnt;
                if (trigger == 'reconcile') ++spt.cnt;
                else if (trigger == 'discard') spt.cnt += discardCnt;
                const cnt = Math.floor(spt.cnt / 3) - Math.floor(ocnt / 3);
                if (cnt == 0) return;
                cmds.getDice(cnt, { element: DICE_COST_TYPE.Omni });
                return { isDestroy: spt.cnt >= 9 }
            },
        }
    }),
    // 圣火竞技场
    321022: () => new SupportBuilder().collection().handle(support => ({
        triggers: ['skill', 'vehicle'],
        supportCnt: support.cnt < 5 ? 1 : -7,
        exec: (spt, cmds) => {
            ++spt.cnt;
            if (spt.cnt == 2) cmds.getDice(1, { mode: CMD_MODE.Random });
            else if (spt.cnt == 4) cmds.heal(2);
            else if (spt.cnt == 6) cmds.getStatus(301023);
            return { isDestroy: spt.cnt >= 6 }
        }
    })),
    // 特佩利舞台
    321023: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger = '', playerInfo: { initCardIds: acids = [] } = {},
            eplayerInfo: { initCardIds: ecids = [] } = {} } = event;
        const hcard = event.hcard ?? support.card;
        const triggers: Trigger[] = [];
        if (['card', 'enter'].includes(trigger) && !acids.includes(hcard.id)) triggers.push(trigger);
        else if (hcard && trigger == 'ecard' && support.cnt > 0 && !ecids.includes(hcard.id)) triggers.push(trigger);
        if (support.cnt > 0) triggers.push('phase-start');
        return {
            triggers: triggers,
            supportCnt: trigger == 'card' ? 1 : trigger == 'ecard' ? -1 : 0,
            exec: (spt, cmds) => {
                if (trigger == 'phase-start') {
                    if (spt.cnt >= 3) cmds.getDice(1, { mode: CMD_MODE.Random });
                    if (spt.cnt >= 1) cmds.changeDice({ cnt: 1 });
                } else if (['card', 'enter'].includes(trigger)) ++spt.cnt;
                else if (trigger == 'ecard') --spt.cnt;
            }
        }
    }),
    // 「悬木人」
    321024: () => new SupportBuilder().round(1).handle((support, event) => {
        const { hcard, playerInfo: { initCardIds = [] } = {} } = event;
        if (!hcard || initCardIds.includes(hcard.id) || hcard.cost + hcard.anydice < support.cnt) return;
        return {
            triggers: 'card',
            supportCnt: 1,
            exec: (spt, cmds) => {
                ++spt.cnt;
                cmds.getDice(1, { mode: CMD_MODE.Random });
            }
        }
    }),
    // 「流泉之众」
    321025: () => new SupportBuilder().round(3).handle(() => ({
        triggers: 'summon-generate',
        supportCnt: -1,
        exec: (spt, _, execEvent) => {
            execEvent.csummon?.addUseCnt(true);
            return { isDestroy: --spt.cnt == 0 }
        }
    })),
    // 「花羽会」
    321026: () => new SupportBuilder().collection().handle((support, event) => {
        const { discards: { length: discardCnt } = [0], heros } = event;
        return {
            triggers: 'discard',
            supportCnt: (support.cnt + discardCnt) % 2 - support.cnt,
            exec: (spt, cmds) => {
                const ncnt = spt.cnt + discardCnt;
                spt.cnt = ncnt % 2;
                if (ncnt < 2) return;
                cmds.getStatus([[301024, Math.floor(ncnt / 2)]], { hidxs: getNextBackHidx(heros) });
            }
        }
    }),
    // 「烟谜主」
    321027: () => new SupportBuilder().round(4).handle((support, event) => ({
        triggers: support.cnt > 0 ? 'pick' : 'phase-start',
        exec: (spt, cmds) => {
            const { trigger, getCardIds } = event;
            if (trigger == 'pick') {
                --spt.cnt;
                return;
            }
            cmds.pickCard(3, CMD_MODE.UseCard, { card: getCardIds?.(c => c.type == CARD_TYPE.Support && c.cost == 2) });
            return { isDestroy: true }
        }
    })),
    // 「沃陆之邦」
    321028: () => new SupportBuilder().permanent().handle((_, event) => ({
        triggers: ['ready-skill', 'switch'],
        exec: (_, cmds) => {
            const { trigger, hidx, heros = [] } = event;
            const cnt = trigger == 'ready-skill' ? 3 : 2;
            cmds.getStatus([[301025, cnt]], { hidxs: hidx });
            const ocnt = getObjById(heros[hidx].heroStatus, 301025)?.useCnt ?? 0;
            if (ocnt < 3 && ocnt + cnt >= 3) cmds.heal(1, { hidxs: hidx });
        }
    })),
    // 墨色酒馆
    321029: () => new SupportBuilder().collection(3).handle((_, event) => {
        const { trigger, summons = [], randomInArr } = event;
        if (trigger == 'enter') return { triggers: 'enter', exec: (_, cmds) => cmds.getCard(1, { include: [301034, 301035, 301036] }).res }
        if (trigger != 'end-phase') return;
        const selectSummons = summons.filter(s => s.hasTag(SUMMON_TAG.Simulanka)) ?? [];
        if (selectSummons.length == 0) return;
        return {
            triggers: 'end-phase',
            exec: (spt, cmds) => {
                cmds.summonTrigger(summons.findIndex(s => s.entityId == randomInArr(selectSummons)[0].entityId));
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 星轨王城
    321030: () => new SupportBuilder().permanent().handle((_, event) => {
        const { trigger, combatStatus } = event;
        const triggers: Trigger[] = ['enter', 'phase-end'];
        if (!hasObjById(combatStatus, 301032)) triggers.push('skilltype2');
        if (!hasObjById(combatStatus, 301037)) triggers.push('skilltype3');
        return {
            triggers,
            exec: (spt, cmds) => {
                if (trigger == 'enter') return cmds.getCard(1, { card: 301033 }).res;
                if (trigger == 'phase-end') spt.cnt = 0;
                else if (trigger == 'skilltype2') cmds.getStatus(301032);
                else if (trigger == 'skilltype3') cmds.getStatus(301037);
            }
        }
    }),
    // 派蒙
    322001: () => new SupportBuilder().round(2).handle(() => ({
        triggers: 'phase-start',
        exec: (spt, cmds) => (cmds.getDice(2, { element: DICE_COST_TYPE.Omni }), { isDestroy: --spt.cnt == 0 })
    })),
    // 凯瑟琳
    322002: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (event.isQuickAction || support.perCnt <= 0) return;
        return {
            triggers: 'minus-switch',
            isNotAddTask: true,
            isQuickAction: true,
            exec: spt => { --spt.perCnt }
        }
    }),
    // 蒂玛乌斯
    322003: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { hcard, trigger, minusDiceCard: mdc = 0, playerInfo: { relicCnt = 0 } = {} } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver.gte('v4.3.0') && relicCnt >= 6) triggers.push('enter');
        const isMinus = support.perCnt > 0 && hcard && hcard.hasSubtype(CARD_SUBTYPE.Relic) && hcard.cost > mdc && support.cnt >= hcard.cost - mdc;
        if (trigger == 'card' && !isMinus) return;
        return {
            triggers: triggers,
            isNotAddTask: trigger == 'card' && support.card.useCnt <= 0,
            isLast: true,
            minusDiceCard: isMinus ? hcard.cost - mdc : 0,
            exec: (spt, cmds) => {
                if (trigger == 'enter') return cmds.getCard(1, { subtype: CARD_SUBTYPE.Relic, isFromPile: true }).res;
                if (trigger == 'phase-end') ++spt.cnt;
                else if (trigger == 'card' && isMinus) {
                    spt.cnt -= hcard.cost - mdc;
                    --spt.perCnt;
                    if (ver.isOffline && spt.card.useCnt > 0) {
                        spt.card.minusUseCnt();
                        cmds.getCard(1);
                    }
                }
            }
        }
    }),
    // 瓦格纳
    322004: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { hcard, trigger, minusDiceCard: mdc = 0, playerInfo: { weaponTypeCnt = 0 } = {} } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver.gte('v4.3.0') && weaponTypeCnt >= 3) triggers.push('enter');
        const isMinus = support.perCnt > 0 && hcard && hcard.hasSubtype(CARD_SUBTYPE.Weapon) && hcard.cost > mdc && support.cnt >= hcard.cost - mdc;
        if (trigger == 'card' && !isMinus) return;
        return {
            triggers: triggers,
            isNotAddTask: trigger == 'card' && support.card.useCnt <= 0,
            isLast: true,
            minusDiceCard: isMinus ? hcard.cost - mdc : 0,
            exec: (spt, cmds) => {
                if (trigger == 'enter') return cmds.getCard(1, { subtype: CARD_SUBTYPE.Weapon, isFromPile: true }).res;
                if (trigger == 'phase-end') ++spt.cnt;
                else if (trigger == 'card' && isMinus) {
                    spt.cnt -= hcard.cost - mdc;
                    --spt.perCnt;
                    if (ver.isOffline && spt.card.useCnt > 0) {
                        spt.card.minusUseCnt();
                        cmds.getCard(1);
                    }
                }
            }
        }
    }),
    // 卯师傅
    322005: () => new SupportBuilder().permanent(1).perCnt(1).handle((support, event, ver) => {
        const { hcard, pile = [] } = event;
        if (!hcard?.hasSubtype(CARD_SUBTYPE.Food)) return;
        const isGetDice = support.perCnt > 0;
        const isGetCard = support.cnt > 0 && pile.some(c => c.hasSubtype(CARD_SUBTYPE.Food));
        if (!isGetDice && !isGetCard) return;
        return {
            triggers: 'card',
            exec: (spt, cmds) => {
                if (isGetDice) {
                    --spt.perCnt;
                    cmds.getDice(1, { mode: CMD_MODE.Random });
                }
                if ((ver.gte('v4.1.0') || ver.isOffline) && isGetCard) {
                    --spt.cnt;
                    cmds.getCard(1, { subtype: CARD_SUBTYPE.Food, isFromPile: true });
                }
            }
        }
    }),
    // 阿圆
    322006: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { hcard, minusDiceCard: mdc = 0 } = event;
        if (support.perCnt <= 0 || !hcard || !hcard.hasSubtype(CARD_SUBTYPE.Place) || hcard.cost <= mdc) return;
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: 2,
            exec: spt => { --spt.perCnt }
        }
    }),
    // 提米
    322007: () => new SupportBuilder().collection().handle(() => ({
        triggers: ['phase-start', 'enter'],
        exec: (spt, cmds) => {
            if (++spt.cnt < 3) return;
            cmds.getCard(1).getDice(1, { element: DICE_COST_TYPE.Omni });
            return { isDestroy: true }
        }
    })),
    // 立本
    322008: () => new SupportBuilder().collection().handle((support, event) => {
        const { dices = [], trigger } = event;
        const triggers: Trigger[] = ['phase-end'];
        if (support.cnt >= 3) triggers.push('phase-start');
        return {
            triggers,
            exec: (spt, cmds, execEvent) => {
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
                } else if (trigger == 'phase-start') {
                    cmds.getCard(2).getDice(2, { element: DICE_COST_TYPE.Omni });
                    return { isDestroy: true }
                }
            }
        }
    }),
    // 常九爷
    322009: () => new SupportBuilder().collection().handle(support => ({
        triggers: [
            'Physical-dmg', 'Physical-getdmg', 'Physical-getdmg-oppo',
            'Pierce-dmg', 'Pierce-getdmg', 'Pierce-getdmg-oppo',
            'elReaction', 'get-elReaction', 'get-elReaction-oppo',
        ],
        isAfterSkill: true,
        isOrTrigger: true,
        supportCnt: support.cnt < 2 ? 1 : -3,
        exec: (spt, cmds) => {
            if (++spt.cnt < 3) return;
            cmds.getCard(2);
            return { isDestroy: true }
        }
    })),
    // 艾琳
    322010: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        const { heros = [], hidx, isMinusDiceSkill } = event;
        const skills = heros[hidx]?.skills.map(skill => [0, 0, +(skill.useCntPerRound > 0)]);
        return {
            triggers: 'skill',
            isNotAddTask: true,
            minusDiceSkill: { skills },
            exec: spt => { isMinusDiceSkill && --spt.perCnt }
        }
    }),
    // 田铁嘴
    322011: () => new SupportBuilder().round(2).handle((_, event) => {
        const hidxs = allHidxs(event.heros, { cdt: h => h.energy != h.maxEnergy, limit: 1 });
        if (hidxs.length == 0) return;
        return {
            triggers: 'phase-end',
            exec: (spt, cmds) => (cmds.getEnergy(1, { hidxs }), { isDestroy: --spt.cnt == 0 })
        }
    }),
    // 刘苏
    322012: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { heros = [], hidx = -1 } = event;
        if (support.perCnt <= 0 || (heros[hidx]?.energy ?? 1) != 0) return;
        return {
            triggers: 'switch',
            supportCnt: -1,
            exec: (spt, cmds) => {
                --spt.perCnt;
                cmds.getEnergy(1);
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 花散里
    322013: () => new SupportBuilder().collection().handle((support, event) => {
        const { hcard, trigger, minusDiceCard: mdc = 0 } = event;
        const isMinus = support.cnt >= 3 && hcard && hcard.hasSubtype(CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Relic) && hcard.cost > mdc;
        return {
            triggers: ['summon-destroy', 'card'],
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
        triggers: 'phase-start',
        isExchange: true,
        exec: (_, cmds) => cmds.getDice(1, { element: DICE_COST_TYPE.Omni }).res,
    })),
    // 旭东
    322015: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { hcard, minusDiceCard: mdc = 0 } = event;
        if (support.perCnt <= 0 || !hcard || !hcard.hasSubtype(CARD_SUBTYPE.Food) || hcard.cost <= mdc) return;
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: 2,
            exec: spt => { --spt.perCnt }
        }
    }),
    // 迪娜泽黛
    322016: () => new SupportBuilder().permanent(1).perCnt(1).handle((support, event, ver) => {
        const { hcard, minusDiceCard: mdc = 0, pile = [] } = event;
        if (!hcard || !hcard.hasSubtype(CARD_SUBTYPE.Ally)) return;
        const isMinus = hcard.cost > mdc && support.perCnt > 0;
        const isGetCard = ver.gte('v4.1.0') && support.cnt > 0 && pile.some(c => c.hasSubtype(CARD_SUBTYPE.Ally));
        return {
            triggers: 'card',
            isNotAddTask: !isGetCard,
            minusDiceCard: isCdt(isMinus, 1),
            exec: (spt, cmds) => {
                if (isMinus) --spt.perCnt;
                if (isGetCard) {
                    --spt.cnt;
                    cmds.getCard(1, { subtype: CARD_SUBTYPE.Ally, isFromPile: true });
                }
            }
        }
    }),
    // 拉娜
    322017: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0 || getBackHidxs(event.heros).length == 0) return;
        return {
            triggers: 'skilltype2',
            exec: (spt, cmds) => {
                --spt.perCnt;
                cmds.getDice(1, { mode: CMD_MODE.FrontHero, frontOffset: 1 });
            }
        }
    }),
    // 老章
    322018: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        const { hcard, heros = [], minusDiceCard: mdc = 0 } = event;
        if (!hcard || !hcard.hasSubtype(CARD_SUBTYPE.Weapon) || hcard.cost <= mdc) return;
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: 1 + heros.filter(h => h.weaponSlot != null).length,
            exec: spt => { --spt.perCnt }
        }
    }),
    // 塞塔蕾
    322019: () => new SupportBuilder().collection(3).handle((_, event) => {
        if ((event.hcards?.length ?? 1) > 0) return;
        return {
            triggers: ['action-after', 'action-after-oppo'],
            exec: (spt, cmds) => (cmds.getCard(1), { isDestroy: --spt.cnt == 0 })
        }
    }),
    // 弥生七月
    322020: () => new SupportBuilder().permanent().perCnt(1).handle((support, event, ver) => {
        if (support.perCnt <= 0) return;
        const { hcard, heros = [], minusDiceCard: mdc = 0 } = event;
        if (!hcard || !hcard.hasSubtype(CARD_SUBTYPE.Relic) || hcard.cost <= mdc) return;
        const relicLen = heros.filter(h => h.relicSlot != null).length;
        const minusCnt = 1 + +(ver.lt('v4.6.0') ? relicLen : (relicLen >= 2));
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: minusCnt,
            exec: spt => { --spt.perCnt }
        }
    }),
    // 玛梅赫
    322021: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { hcard } = event;
        const subtype = [CARD_SUBTYPE.Food, CARD_SUBTYPE.Ally, CARD_SUBTYPE.Place, CARD_SUBTYPE.Item];
        if (support.perCnt <= 0 || hcard?.id == support.card.id || !hcard?.hasSubtype(...subtype)) return;
        return {
            triggers: 'card',
            exec: (spt, cmds) => {
                --spt.perCnt;
                cmds.getCard(1, { subtype, exclude: [support.card.id] });
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 婕德
    322022: () => new SupportBuilder().collection().handle((support, event, ver) => {
        const { trigger, playerInfo: { destroyedSupport = 0 } = {} } = event;
        if (trigger == 'enter') {
            support.cnt = Math.min(6, destroyedSupport);
            return;
        }
        const threshold = ver.lt('v4.6.0') ? 5 : 6;
        return {
            triggers: support.cnt >= threshold ? 'skilltype3' : 'support-destroy',
            supportCnt: isCdt(support.cnt >= threshold, -10, 1),
            exec: (spt, cmds) => {
                if (trigger == 'skilltype3') {
                    if (ver.lt('v4.6.0')) {
                        cmds.getDice(spt.cnt - 2, { element: DICE_COST_TYPE.Omni });
                        return { isDestroy: true }
                    }
                    cmds.getStatus(302205);
                    return { isDestroy: true }
                }
                if (trigger == 'support-destroy') spt.cnt = Math.min(6, destroyedSupport);
            }
        }
    }),
    // 西尔弗和迈勒斯
    322023: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger, playerInfo: { oppoGetElDmgType = 0 } = {}, isExecTask } = event;
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
        const [el] = objToArr(PURE_ELEMENT_TYPE_KEY).find(([, elname]) => elname == trigger?.slice(0, trigger.indexOf('-getdmg-oppo'))) ?? [];
        return {
            triggers: triggers,
            supportCnt: isCdt(el && (oppoGetElDmgType >> PURE_ELEMENT_CODE[el] & 1) == 0, 1),
            exec: (spt, cmds) => {
                if (trigger == 'phase-end' && spt.cnt >= 3) {
                    cmds.getCard(spt.cnt);
                    return { isDestroy: true }
                }
                if (trigger?.endsWith('-getdmg-oppo')) spt.cnt = Math.min(4, oppoGetElDmgType.toString(2).split('').filter(v => +v).length);
            }
        }
    }),
    // 太郎丸
    322024: () => new SupportBuilder().collection().handle((support, event) => {
        if (event.trigger == 'enter') {
            return { triggers: 'enter', exec: (_, cmds) => cmds.addCard(4, 302202, { isRandom: false }).res }
        }
        if (event.hcard?.id != 302202) return;
        return {
            triggers: 'card',
            summon: isCdt(support.cnt == 1, 302201),
            exec: spt => ({ isDestroy: ++spt.cnt >= 2 }),
        }
    }),
    // 白手套和渔夫
    322025: () => new SupportBuilder().round(2).handle(() => ({
        triggers: 'phase-end',
        exec: (spt, cmds) => {
            cmds.addCard(1, 302203, { scope: 5 });
            if (spt.cnt == 1) cmds.getCard(1);
            return { isDestroy: --spt.cnt == 0 }
        }
    })),
    // 亚瑟先生
    322026: () => new SupportBuilder().collection().handle((support, event) => {
        const { discards: { length: discardCnt } = [0], trigger, epile = [] } = event;
        if (+(support.cnt >= 2) ^ +(trigger == 'phase-end' && epile.length > 0)) return;
        return {
            triggers: ['discard', 'reconcile', 'phase-end'],
            supportCnt: isCdt(trigger != 'phase-end', Math.min(2 - support.cnt, discardCnt)),
            exec: (spt, cmds) => {
                if (trigger == 'phase-end') {
                    spt.cnt = 0;
                    cmds.getCard(1, { card: epile[0].id });
                }
                spt.cnt = Math.min(2, spt.cnt + (trigger == 'reconcile' ? 1 : discardCnt));
            },
        }
    }),
    // 瑟琳
    322027: () => new SupportBuilder().round(3).handle(() => ({
        triggers: ['phase-start', 'enter'],
        exec: (spt, cmds) => {
            cmds.getCard(1, { include: Array.from({ length: 10 }, (_, i) => 302206 + i) });
            return { isDestroy: --spt.cnt == 0 }
        }
    })),
    // 阿伽娅
    322028: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        return {
            triggers: 'vehicle',
            isNotAddTask: true,
            minusDiceSkill: { skilltype5: [0, 0, 1] },
            exec: spt => { event.isMinusDiceSkill && --spt.perCnt }
        }
    }),
    // 森林的祝福
    322029: () => new SupportBuilder().permanent().handle(() => ({
        triggers: ['enter', 'elReaction'],
        exec: (_, cmds) => cmds.getCard(1, { include: [301034, 301035, 301036] }).res,
    })),
    // 预言女神的礼物
    322030: () => new SupportBuilder().collection(2).handle((_, event) => {
        const { trigger, csummon } = event;
        const triggers: Trigger[] = ['enter'];
        if (csummon && csummon.hasTag(SUMMON_TAG.Simulanka)) triggers.push('summon-generate');
        return {
            triggers,
            exec: (spt, cmds, execEvent) => {
                if (trigger == 'enter') return cmds.getCard(2, { card: 301033 }).addCard(2, 301033).res;
                if (trigger == 'summon-generate') {
                    const { csummon } = execEvent;
                    if (csummon) {
                        if (csummon.id == 301028) ++csummon.damage;
                        else if (csummon.id == 3010301) ++csummon.shieldOrHeal;
                        else ++csummon.addition.effect;
                    }
                    return { isDestroy: --spt.cnt == 0 }
                }
            },
        }
    }),
    // 参量质变仪
    323001: () => new SupportBuilder().collection().handle(support => ({
        triggers: ['el-dmg', 'el-getdmg', 'el-getdmg-oppo'],
        isAfterSkill: true,
        isOrTrigger: true,
        supportCnt: support.cnt < 2 ? 1 : -3,
        exec: (spt, cmds) => {
            if (++spt.cnt < 3) return;
            cmds.getDice(3, { mode: CMD_MODE.Random });
            return { isDestroy: true }
        }
    })),
    // 便携营养袋
    323002: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { hcard, pile = [], trigger } = event;
        if (!pile.some(c => c.hasSubtype(CARD_SUBTYPE.Food))) return;
        if (trigger != 'enter' && (support.perCnt <= 0 || !hcard?.hasSubtype(CARD_SUBTYPE.Food))) return;
        return {
            triggers: ['card', 'enter'],
            exec: (spt, cmds) => {
                if (trigger != 'enter') --spt.perCnt;
                cmds.getCard(1, { subtype: CARD_SUBTYPE.Food, isFromPile: true });
            }
        }
    }),
    // 红羽团扇
    323003: () => new SupportBuilder().permanent().perCnt(1).handle(support => {
        if (support.perCnt <= 0) return;
        return {
            triggers: 'switch',
            exec: (spt, cmds) => {
                --spt.perCnt;
                cmds.getStatus(302303);
            }
        }
    }),
    // 寻宝仙灵
    323004: () => new SupportBuilder().collection().handle(support => ({
        triggers: 'after-skill',
        isAfterSkill: true,
        supportCnt: support.cnt < 2 ? 1 : -3,
        exec: (spt, cmds) => {
            if (++spt.cnt < 3) return;
            cmds.getCard(3);
            return { isDestroy: true }
        }
    })),
    // 化种匣
    323005: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { hcard, minusDiceCard: mdc = 0 } = event;
        if (!hcard || hcard.type != CARD_TYPE.Support || support.perCnt <= 0 || hcard.cost <= mdc) return;
        if (ver.lt('v4.6.0') && !ver.isOffline ? hcard.cost != 1 : hcard.cost < 2) return;
        return {
            triggers: 'card',
            minusDiceCard: 1,
            isNotAddTask: true,
            exec: spt => {
                --spt.perCnt;
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 留念镜
    323006: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { hcard, playerInfo: { usedCardIds = [] } = {}, minusDiceCard: mdc = 0 } = event;
        const subtypes = [CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Relic, CARD_SUBTYPE.Place, CARD_SUBTYPE.Ally];
        if (!hcard || !usedCardIds.includes(hcard.id) || !hcard.hasSubtype(...subtypes) || support.perCnt <= 0 || hcard.cost <= mdc) return;
        return {
            triggers: 'card',
            minusDiceCard: 2,
            isNotAddTask: true,
            exec: spt => {
                --spt.perCnt;
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 流明石触媒
    323007: () => new SupportBuilder().collection(3).perCnt(1).handle(support => {
        if (support.perCnt <= 0) return;
        return {
            triggers: 'card',
            supportCnt: isCdt(support.card.useCnt == 2, -1),
            exec: (spt, cmds) => {
                if (spt.card.addUseCnt() < 3) return;
                --spt.perCnt;
                spt.card.useCnt = 0;
                cmds.getCard(1).getDice(1, { element: DICE_COST_TYPE.Omni });
                return { isDestroy: --spt.cnt == 0 }
            }
        }
    }),
    // 苦舍桓
    323008: () => new SupportBuilder().collection().perCnt(1).handle((support, event) => {
        const { hcards = [], trigger, isMinusDiceSkill } = event;
        if (trigger == 'phase-start' && (support.cnt >= 2 || hcards.length == 0)) return;
        if (support.perCnt == 0 && (trigger == 'card' || (trigger == 'skill' && support.cnt == 0))) return;
        return {
            triggers: ['phase-start', 'skill', 'card'],
            minusDiceSkill: isCdt(support.perCnt > 0 && support.cnt > 0, { skill: [0, 0, 1] }),
            isNotAddTask: trigger != 'phase-start',
            exec: (spt, cmds) => {
                if (trigger == 'phase-start') {
                    const cnt = Math.min(hcards.length, 2 - spt.cnt);
                    spt.cnt += cnt;
                    return cmds.discard({ cnt, mode: CMD_MODE.HighHandCard }).res;
                }
                if (trigger == 'card') --spt.perCnt;
                else if (trigger == 'skill' && isMinusDiceSkill) --spt.cnt;
            },
        }
    }),

}

export const newSupport = (version: Version, options: { diff?: Record<number, Version>, dict?: Record<number, number> } = {}) => {
    return (card: Card, ...args: any[]) => {
        const { diff = {}, dict = {} } = options;
        const dversion = diff[getDerivantParentId(card.id, dict)] ?? diff[card.id] ?? version;
        return supportTotal[card.id](...args).card(card).version(dversion).done();
    }
}