import { Card, Trigger } from '../../typing';
import { CARD_SUBTYPE, CARD_TYPE, CMD_MODE, DAMAGE_TYPE, DICE_COST_TYPE, DiceCostType, ELEMENT_CODE_KEY, ELEMENT_TYPE, ELEMENT_TYPE_KEY, PURE_ELEMENT_CODE, SUMMON_TAG, Version } from '../constant/enum.js';
import { DICE_WEIGHT } from '../constant/UIconst.js';
import { getDerivantParentId, getSortedDices } from '../utils/gameUtil.js';
import { isCdt } from '../utils/utils.js';
import { SupportBuilder } from './builder/supportBuilder.js';

const elTransfiguration = (el1: DiceCostType, el2: DiceCostType, reactionTrg: Trigger, code: number) => {
    return new SupportBuilder().permanent().handle((_, event) => ({
        triggers: ['phase-dice', reactionTrg],
        element: [el1, el2],
        cnt: [2, 2],
        exec: cmds => {
            if (event.trigger != reactionTrg) return;
            cmds.pickCard(2, CMD_MODE.GetCard, { card: [+`3030${code}1`, +`3030${code}2`] });
            return { isDestroy: true }
        }
    }));
}

const supportTotal: Record<number, (...args: any) => SupportBuilder> = {

    // 全频谱多重任务厨艺机关
    111159: () => new SupportBuilder().collection(2).handle(support => ({
        triggers: ['elReaction-Cryo', 'elReaction-Cryo-oppo'],
        isOrTrigger: true,
        exec: cmds => {
            cmds.getCard(1, { include: [111152, 111153, 111154, 111155] });
            return { isDestroy: support.minusUseCnt() == 0 }
        }
    })),
    // 斗争之火
    300006: (cnt: number = 0) => new SupportBuilder().collection(cnt).handle((support, event) => {
        const { getdmg = [], supports = [], esupports = [], trigger } = event;
        const isTriggered = support.useCnt > Math.max(...[...supports, ...esupports].filter(s => s.id == support.id && s.entityId != support.entityId).map(s => s.useCnt));
        if (trigger == 'phase-start' && !isTriggered) return;
        const supportCnt = isCdt(trigger == 'after-dmg', getdmg.reduce((a, c) => a + Math.max(0, c), 0), 0);
        return {
            triggers: ['after-dmg', 'phase-start'],
            exec: cmds => {
                if (trigger == 'after-dmg') support.addUseCnt(supportCnt);
                else if (trigger == 'phase-start') {
                    support.setUseCnt();
                    cmds.getStatus(300007);
                }
            }
        }
    }),
    // 超导祝佑·极寒
    303041: () => new SupportBuilder().collection(2).handle((support, event) => {
        const triggers: Trigger[] = ['phase-dice', 'phase-start'];
        if (support.useCnt > 0) triggers.push('Physical-getdmg-oppo', 'Cryo-getdmg-oppo');
        return {
            triggers,
            element: [DICE_COST_TYPE.Cryo, DICE_COST_TYPE.Electro],
            cnt: [2, 2],
            exec: cmds => {
                if (event.trigger == 'phase-start') return support.setUseCnt(2);
                if (event.trigger == 'phase-dice') return;
                cmds.getStatus([207, 201], { isOppo: true });
                support.minusUseCnt();
            }
        }
    }),
    // 超导祝佑·电冲
    303042: () => new SupportBuilder().collection(3).handle((support, event) => {
        const triggers: Trigger[] = ['phase-start'];
        if (support.useCnt > 0) triggers.push('Superconduct');
        return {
            triggers,
            exec: cmds => {
                if (event.trigger == 'phase-start') return support.setUseCnt(3);
                cmds.attack(2, DAMAGE_TYPE.Pierce, { target: CMD_MODE.MaxHpHero });
                support.minusUseCnt();
            }
        }
    }),
    // 蒸发祝佑·狂浪
    303051: () => new SupportBuilder().collection(2).handle((support, event) => {
        const triggers: Trigger[] = ['phase-start'];
        if (support.useCnt > 0) triggers.push('Vaporize');
        return {
            triggers,
            exec: cmds => {
                const { trigger, heros } = event;
                if (trigger == 'phase-start') return support.setUseCnt(2);
                const hidxs = heros.getMaxHurtHidxs();
                cmds.heal(2, { hidxs }).getStatus(303053, { hidxs });
                support.minusUseCnt();
            }
        }
    }),
    // 蒸发祝佑·炽燃
    303052: () => new SupportBuilder().collection(2).handle((support, event) => {
        const { hero, trigger, isMinusDiceSkill } = event;
        const triggers: Trigger[] = ['phase-start'];
        const isMinus = support.useCnt > 0 && hero.element == ELEMENT_TYPE.Pyro;
        if (isMinus && isMinusDiceSkill) triggers.push('skilltype2');
        return {
            triggers,
            minusDiceSkill: isCdt(isMinus, { skilltype2: [0, 0, 1] }),
            exec: () => {
                if (trigger == 'phase-start') return support.setUseCnt(2);
                support.minusUseCnt();
            }
        }
    }),
    // 璃月港口
    321001: () => new SupportBuilder().round(2).handle(support => ({
        triggers: 'phase-end',
        exec: cmds => (cmds.getCard(2), { isDestroy: support.minusUseCnt() == 0 })
    })),
    // 骑士团图书馆
    321002: () => new SupportBuilder().permanent().handle((_, event) => ({
        triggers: ['phase-dice', 'enter'],
        isNotAddTask: true,
        addRollCnt: 1,
        exec: cmds => { event.trigger == 'enter' && cmds.reroll(1) }
    })),
    // 群玉阁
    321003: () => new SupportBuilder().permanent().handle((_, event, ver) => {
        const { hcards = [], trigger } = event;
        const triggers: Trigger[] = ['phase-dice'];
        if ((ver.gte('v4.5.0') || ver.isOffline) && hcards.length <= 3) triggers.push('phase-start');
        return {
            triggers,
            element: 'front',
            cnt: 2,
            exec: cmds => {
                if (trigger != 'phase-start') return;
                cmds.getDice(1, { element: DICE_COST_TYPE.Omni });
                return { isDestroy: true }
            }
        }
    }),
    // 晨曦酒庄
    321004: () => new SupportBuilder().permanent().perCnt(2).perCnt(1, 'v4.8.0')
        .handle((support, event) => {
            if (support.perCnt <= 0 || event.switchHeroDiceCnt == 0) return;
            return {
                triggers: 'minus-switch',
                isNotAddTask: true,
                minusDiceHero: 1,
                exec: () => support.minusPerCnt(),
            }
        }),
    // 望舒客栈
    321005: () => new SupportBuilder().round(2).heal(2).handle((support, event) => {
        const hidxs = event.heros.getMaxHurtHidxs({ isBack: true });
        if (hidxs.length == 0) return;
        return {
            triggers: 'phase-end',
            exec: cmds => (cmds.heal(2, { hidxs }), { isDestroy: support.minusUseCnt() == 0 })
        }
    }),
    // 西风大教堂
    321006: () => new SupportBuilder().round(2).heal(2).handle((support, event) => {
        if (!event.hero.isHurt) return;
        return {
            triggers: 'phase-end',
            exec: cmds => (cmds.heal(2), { isDestroy: support.minusUseCnt() == 0 })
        }
    }),
    // 天守阁
    321007: () => new SupportBuilder().permanent().handle((_, event) => {
        const { dices } = event;
        if (new Set(dices.filter(v => v != DICE_COST_TYPE.Omni)).size + dices.filter(v => v == DICE_COST_TYPE.Omni).length < 5) return;
        return {
            triggers: 'phase-start',
            exec: cmds => cmds.getDice(1, { element: DICE_COST_TYPE.Omni }).res,
        }
    }),
    // 鸣神大社
    321008: () => new SupportBuilder().collection(2).round(3, 'v6.0.0')
        .handle((support, event, ver) => {
            const { dices, trigger } = event;
            const triggers: Trigger[] = ['phase-start'];
            if (ver.lt('v6.0.0') && !ver.isOffline) triggers.push('enter');
            else if (dices.length % 2 == 1 && support.useCnt > 0) triggers.push('after-skill');
            return {
                triggers,
                isNotAddTask: (ver.gte('v6.0.0') || ver.isOffline) && trigger == 'phase-start',
                exec: cmds => {
                    if (ver.lt('v6.0.0') && !ver.isOffline) cmds.getDice(1, { mode: CMD_MODE.Random });
                    else if (trigger == 'after-skill') cmds.getDice(1, { element: DICE_COST_TYPE.Omni });
                    if (trigger == 'phase-start' && (ver.gte('v6.0.0') || ver.isOffline)) {
                        support.setUseCnt(2);
                        return;
                    }
                    return { isDestroy: support.minusUseCnt() == 0 && ver.lt('v6.0.0') && !ver.isOffline }
                }
            }
        }),
    // 珊瑚宫
    321009: () => new SupportBuilder().round(2).handle((support, event) => {
        const { heros } = event;
        if (!heros.hasHurt) return;
        return {
            triggers: 'phase-end',
            exec: cmds => (cmds.heal(1, { hidxs: heros.allHidxs() }), { isDestroy: support.minusUseCnt() == 0 })
        }
    }),
    // 须弥城
    321010: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { dices, hcards, isMinusDiceTalent, isMinusDiceSkill } = event;
        if (dices.length > hcards.length || support.perCnt <= 0) return;
        const triggers: Trigger[] = [];
        if (isMinusDiceTalent) triggers.push('card');
        if (isMinusDiceSkill) triggers.push('skill');
        return {
            triggers,
            minusDiceSkill: { skill: [0, 0, 1] },
            minusDiceCard: isCdt(isMinusDiceTalent, 1),
            isNotAddTask: true,
            exec: () => support.minusPerCnt(),
        }
    }),
    // 桓那兰那
    321011: () => new SupportBuilder().collection().handle((support, event) => {
        const { dices, trigger } = event;
        if (trigger == 'phase-start' && support.perCnt == 0 || trigger == 'phase-end' && dices.length == 0) return;
        return {
            triggers: ['phase-end', 'phase-start'],
            exec: cmds => {
                if (trigger == 'phase-end') {
                    const pdices = getSortedDices(dices);
                    dices.length = 0;
                    dices.push(...pdices.slice(2));
                    support.setPerCnt(-pdices.slice(0, 2).map(v => DICE_WEIGHT.indexOf(v) + 1).join(''));
                    support.setUseCnt(pdices.slice(0, 2).length);
                } else if (trigger == 'phase-start') {
                    const element = support.perCnt.toString().slice(1).split('').map(v => DICE_WEIGHT[Number(v) - 1]);
                    support.setUseCnt();
                    support.setPerCnt();
                    if (element.length > 0) cmds.getDice(Math.min(2, element.length), { element });
                }
            }
        }
    }),
    // 镇守之森
    321012: () => new SupportBuilder().collection(4).collection(3, 'v6.0.0').handle((support, event, ver) => {
        const { isFirst, isMinusDiceSkill, isChargedAtk } = event;
        if (ver.lt('v6.0.0')) {
            return {
                triggers: isCdt(!isFirst, 'phase-start'),
                exec: cmds => (cmds.getDice(1, { mode: CMD_MODE.FrontHero }), { isDestroy: support.minusUseCnt() == 0 })
            }
        }
        return {
            triggers: isCdt(isMinusDiceSkill && isChargedAtk, 'skilltype1'),
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            isNotAddTask: true,
            exec: () => ({ isDestroy: support.minusUseCnt() == 0 }),
        }
    }),
    // 黄金屋
    321013: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { hcard, isMinusDiceWeapon, isMinusDiceRelic } = event;
        if (support.perCnt <= 0 ||
            !hcard || (ver.lt('v6.4.0') || ver.isOffline ? hcard.rawDiceCost : hcard.currDiceCost) < 3 ||
            (!isMinusDiceWeapon && !isMinusDiceRelic)) return;
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: 1,
            exec: () => {
                support.minusPerCnt();
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 化城郭
    321014: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        if (support.perCnt == 0 || event.dices.length > 0) return;
        return {
            triggers: 'action-start',
            exec: cmds => {
                support.minusPerCnt();
                cmds.getDice(1, { element: DICE_COST_TYPE.Omni });
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 风龙废墟
    321015: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { hero, trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
        if (trigger == 'enter') {
            return {
                triggers: trigger,
                isNotAddTask: true,
                exec: cmds => cmds.getCard(1, { subtype: CARD_SUBTYPE.Talent, isFromPile: true }).res,
            }
        }
        if (support.perCnt <= 0) return;
        const skills = hero.skills.map(skill => {
            if (support.perCnt > 0 && skill.rawDiceCost >= 4) return [0, 0, 1];
            return [0, 0, 0];
        });
        const triggers: Trigger[] = [];
        if (isMinusDiceTalent) triggers.push('card');
        if (isMinusDiceSkill) triggers.push('skill');
        return {
            triggers,
            isNotAddTask: true,
            minusDiceCard: 1,
            minusDiceSkill: { skills },
            exec: () => {
                support.minusPerCnt();
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 湖中垂柳
    321016: () => new SupportBuilder().round(2).handle((support, event) => {
        if (event.hcards.length > 2) return;
        return { triggers: 'phase-end', exec: cmds => (cmds.getCard(2), { isDestroy: support.minusUseCnt() == 0 }) }
    }),
    // 欧庇克莱歌剧院
    321017: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { heros, eheros } = event;
        const slotCost = heros.flatMap(h => h.equipments).reduce((a, b) => a + b.rawDiceCost, 0);
        const eslotCost = eheros.flatMap(h => h.equipments).reduce((a, b) => a + b.rawDiceCost, 0);
        if (slotCost < eslotCost || support.perCnt <= 0) return;
        return {
            triggers: 'action-start',
            exec: cmds => {
                support.minusPerCnt();
                cmds.getDice(1, { mode: CMD_MODE.FrontHero });
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 梅洛彼得堡
    321018: () => new SupportBuilder().collection().handle((support, event) => {
        const { hidx, getdmg, heal, trigger } = event;
        const triggers: Trigger[] = [];
        if (support.useCnt < 4) {
            if (getdmg[hidx] > 0) triggers.push('getdmg');
            if (heal[hidx] > 0) triggers.push('heal');
        } else triggers.push('phase-start');
        return {
            triggers: triggers,
            exec: cmds => {
                if (trigger == 'phase-start') {
                    support.minusUseCnt(4);
                    return cmds.getStatus(301018, { isOppo: true }).res;
                }
                support.addUseCntMax(4);
            }
        }
    }),
    // 清籁岛
    321019: () => new SupportBuilder().round(2).handle((support, event) => {
        const { heal, trigger } = event;
        const hidxs = heal.map((hl, hli) => ({ hl, hli })).filter(v => v.hl >= 0).map(v => v.hli);
        return {
            triggers: ['heal', 'heal-oppo', 'phase-end'],
            exec: cmds => {
                if (trigger == 'phase-end') return { isDestroy: support.minusUseCnt() == 0 }
                cmds.getStatus(301019, { hidxs, isOppo: trigger == 'heal-oppo' });
            }
        }
    }),
    // 赤王陵
    321020: () => new SupportBuilder().collection().handle(support => ({
        triggers: 'drawcard-oppo',
        exec: cmds => {
            if (support.addUseCnt() < 4) return;
            cmds.addCard(2, 301020, { scope: 2, isOppo: true }).getStatus(301022, { isOppo: true });
            return { isDestroy: true }
        },
    })),
    // 中央实验室遗址
    321021: () => new SupportBuilder().collection().handle(support => ({
        triggers: ['discard', 'reconcile'],
        exec: cmds => {
            const ocnt = support.useCnt;
            support.addUseCnt();
            const cnt = Math.floor(support.useCnt / 3) - Math.floor(ocnt / 3);
            if (cnt == 0) return;
            cmds.getDice(cnt, { element: DICE_COST_TYPE.Omni });
            return { isDestroy: support.useCnt >= 9 }
        },
    })),
    // 圣火竞技场
    321022: () => new SupportBuilder().collection().handle(support => ({
        triggers: ['after-skill', 'after-skilltype5'],
        exec: cmds => {
            support.addUseCnt();
            if (support.useCnt == 2) cmds.getDice(1, { mode: CMD_MODE.Random });
            else if (support.useCnt == 4) cmds.heal(2);
            else if (support.useCnt == 6) cmds.getStatus(301023);
            return { isDestroy: support.useCnt >= 6 }
        }
    })),
    // 特佩利舞台
    321023: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger, playerInfo: { initCardIds: acids }, eplayerInfo: { initCardIds: ecids } } = event;
        const hcard = event.hcard ?? support.card;
        const triggers: Trigger[] = [];
        if (['card', 'enter'].includes(trigger) && !acids.includes(hcard.id)) triggers.push(trigger);
        else if (trigger == 'ecard' && support.useCnt > 0 && !ecids.includes(hcard.id)) triggers.push(trigger);
        if (support.useCnt > 0) triggers.push('phase-start');
        return {
            triggers: triggers,
            exec: cmds => {
                if (trigger == 'phase-start') {
                    if (support.useCnt >= 3) cmds.getDice(1, { mode: CMD_MODE.Random });
                    if (support.useCnt >= 1) cmds.changeDice({ cnt: 1 });
                } else if (['card', 'enter'].includes(trigger)) support.addUseCnt();
                else if (trigger == 'ecard') support.minusUseCnt();
            }
        }
    }),
    // 「悬木人」
    321024: () => new SupportBuilder().round(1).handle((support, event, ver) => {
        const { hcard, playerInfo: { initCardIds } } = event;
        if (!hcard || initCardIds.includes(hcard.id) ||
            (ver.lt('v6.4.0') ? hcard.rawDiceCost : hcard.currDiceCost) < support.useCnt) return;
        return {
            triggers: 'card',
            exec: cmds => {
                support.addUseCnt();
                cmds.getDice(1, { mode: CMD_MODE.Random });
            }
        }
    }),
    // 「流泉之众」
    321025: () => new SupportBuilder().round(3).handle((support, event) => ({
        triggers: 'summon-generate',
        exec: cmds => {
            cmds.addUseSummon(event.sourceSummon!.entityId);
            return { isDestroy: support.minusUseCnt() == 0 }
        }
    })),
    // 「花羽会」
    321026: () => new SupportBuilder().collection().handle((support, event) => ({
        triggers: 'discard',
        exec: cmds => {
            const ncnt = support.useCnt + 1;
            support.setUseCnt(ncnt % 2);
            if (ncnt < 2) return;
            cmds.getStatus([[301024, Math.floor(ncnt / 2)]], { hidxs: event.heros.getNextBackHidx() });
        }
    })),
    // 「烟谜主」
    321027: () => new SupportBuilder().round(4).handle((support, event) => ({
        triggers: support.useCnt > 0 ? 'pick' : 'phase-start',
        exec: cmds => {
            const { trigger, getCardIds } = event;
            if (trigger == 'pick') {
                support.minusUseCnt();
                return;
            }
            cmds.pickCard(3, CMD_MODE.UseCard, { card: getCardIds(c => c.type == CARD_TYPE.Support && c.cost == 2) });
            return { isDestroy: true }
        }
    })),
    // 「沃陆之邦」
    321028: () => new SupportBuilder().permanent().handle((_, event) => {
        const { trigger, hidx, heros } = event;
        const ocnt = heros[hidx].heroStatus.getUseCnt(301025);
        if (ocnt == 5) return;
        return {
            triggers: ['ready-skill', 'switch'],
            exec: cmds => {
                const cnt = trigger == 'ready-skill' ? 3 : 2;
                cmds.getStatus([[301025, cnt]], { hidxs: hidx });
                if (ocnt < 3 && ocnt + cnt >= 3) cmds.heal(1, { hidxs: hidx });
            }
        }
    }),
    // 墨色酒馆
    321029: () => new SupportBuilder().collection(3).handle((support, event) => {
        const { trigger, summons } = event;
        if (trigger == 'enter') return { triggers: 'enter', exec: cmds => cmds.getCard(1, { include: [301034, 301035, 301036] }).res }
        if (trigger != 'end-phase') return;
        if (summons.getSimulanka().length == 0) return;
        return {
            triggers: 'end-phase',
            exec: cmds => {
                cmds.summonTrigger({ isRandom: true });
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 星轨王城
    321030: () => new SupportBuilder().permanent().handle((support, event) => {
        const { trigger, combatStatus } = event;
        const triggers: Trigger[] = ['enter', 'phase-end'];
        if (!combatStatus.has(301032)) triggers.push('skilltype2');
        if (!combatStatus.has(301037)) triggers.push('skilltype3');
        return {
            triggers,
            exec: cmds => {
                if (trigger == 'enter') return cmds.getCard(1, { card: 301033 }).res;
                if (trigger == 'phase-end') support.setUseCnt();
                else if (trigger == 'skilltype2') cmds.getStatus(301032);
                else if (trigger == 'skilltype3') cmds.getStatus(301037);
            }
        }
    }),
    // 冒险家协会
    321031: () => new SupportBuilder().round(3).handle(support => ({
        triggers: 'phase-end',
        exec: cmds => (cmds.adventure(), { isDestroy: support.minusUseCnt() == 0 }),
    })),
    // 沉玉谷
    321032: () => new SupportBuilder().collection(1).handle((support, event, ver) => ({
        triggers: 'adventure',
        exec: cmds => {
            support.addUseCnt();
            if (support.useCnt == 2) return cmds.getCard(2, { card: 333029 }).res;
            if (support.useCnt == 4) return cmds.getStatus([[169, 3], [170, 3]]).res;
            if (support.useCnt == (ver.lt('v6.3.0') ? 7 : 8)) {
                const { heros } = event;
                const hidxs = heros.getMaxHurtHidxs();
                cmds.attach({ element: ELEMENT_TYPE.Hydro, hidxs: heros.allHidxs() })
                    .heal(999, { hidxs })
                    .addMaxHp(2, hidxs);
                return { isDestroy: true }
            }
        }
    })),
    // 自体自身之塔
    321033: () => new SupportBuilder().collection(1).handle((support, event) => ({
        triggers: ['adventure', 'enter'],
        exec: cmds => {
            const { trigger, heros } = event;
            if (trigger == 'enter') return cmds.attack(1, DAMAGE_TYPE.Pierce, { hidxs: heros.allHidxs(), isOppo: false }).res;
            support.addUseCnt();
            if (support.useCnt % 2 == 0) cmds.getDice(1, { mode: CMD_MODE.Random });
            if (support.useCnt == 5) return cmds.getCard(1, { card: 301038 }).res;
            if (support.useCnt == 12) {
                cmds.getCard(1, { card: 301039 });
                return { isDestroy: true }
            }
        }
    })),
    // 天蛇船
    321034: () => new SupportBuilder().collection(1).handle(support => ({
        triggers: 'adventure',
        exec: cmds => {
            support.addUseCnt();
            cmds.changeDice({ cnt: 1 });
            if (support.useCnt == 2) return cmds.getCard(1).res;
            if (support.useCnt == 4) return cmds.getStatus([[172, 2]]).res;
            if (support.useCnt == 6) {
                cmds.destroySummon({ isOppo: true }).getSummon(301041);
                return { isDestroy: true }
            }
        }
    })),
    // 银月之庭
    321035: () => new SupportBuilder().collection().handle((support, event) => {
        if (![201, 206].includes(event.source)) return;
        return {
            triggers: 'get-status',
            exec: cmds => {
                if (support.addUseCnt() < 3) return;
                cmds.changeDice();
                support.setUseCnt();
            }
        }
    }),
    // 汐印石
    321036: () => new SupportBuilder().round(2).handle(support => ({
        triggers: 'phase-start',
        exec: cmds => {
            cmds.getStatus([201, 207], { isOppo: true });
            return { isDestroy: support.minusUseCnt() == 0 }
        }
    })),
    // 霜月之坊
    321037: () => new SupportBuilder().round(2).handle((support, event) => ({
        triggers: ['enter', 'phase-end'],
        exec: cmds => {
            const { trigger, heros } = event;
            if (trigger == 'enter') return cmds.getCard(2).heal(2, { hidxs: heros.getMaxHurtHidxs() }).res;
            cmds.getStatus(202, { cnt: 2, cardFilter: c => c.currDiceCost > 0 });
            return { isDestroy: support.minusUseCnt() == 0 }
        }
    })),
    // 那夏镇
    321038: () => new SupportBuilder().round(2).handle(support => ({
        triggers: 'phase-end',
        exec: cmds => {
            cmds.getStatus(206, { cnt: 2, cardFilter: c => c.currDiceCost >= 2 });
            if (support.minusUseCnt() == 0) {
                cmds.attack(2, DAMAGE_TYPE.Physical);
                return { isDestroy: true }
            }
        }
    })),
    // 月矩力试验设计局
    321039: () => new SupportBuilder().round(2).handle((support, event) => ({
        triggers: ['phase-end', 'destroy'],
        exec: cmds => {
            if (event.trigger == 'destroy') return cmds.getCard(2, { cardAttachment: 206, isFromPile: true }).getDice(1, { mode: CMD_MODE.Random }).res;
            cmds.getStatus(206, { cnt: 2, mode: CMD_MODE.RandomPileCard });
            return { isDestroy: support.minusUseCnt() == 0 }
        }
    })),
    // 派蒙
    322001: () => new SupportBuilder().round(2).handle(support => ({
        triggers: 'phase-start',
        exec: cmds => (cmds.getDice(2, { element: DICE_COST_TYPE.Omni }), { isDestroy: support.minusUseCnt() == 0 })
    })),
    // 凯瑟琳
    322002: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (event.isQuickAction || support.perCnt <= 0) return;
        return {
            triggers: 'minus-switch',
            isNotAddTask: true,
            isQuickAction: true,
            exec: () => { support.minusPerCnt() }
        }
    }),
    // 蒂玛乌斯
    322003: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { hcard, trigger, isMinusDiceCard, minusDiceCard: mdc, playerInfo: { relicCnt } } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver.gte('v4.3.0') && relicCnt >= 6) triggers.push('enter');
        const isMinus = support.perCnt > 0 && hcard && hcard.hasSubtype(CARD_SUBTYPE.Relic) &&
            isMinusDiceCard && support.useCnt >= hcard.currDiceCost - mdc;
        if (trigger == 'card' && !isMinus) return;
        return {
            triggers: triggers,
            isNotAddTask: trigger == 'card' && support.card.useCnt <= 0,
            isLast: true,
            minusDiceCard: isMinus ? hcard.cost - mdc : 0,
            exec: cmds => {
                if (trigger == 'enter') return cmds.getCard(1, { subtype: CARD_SUBTYPE.Relic, isFromPile: true }).res;
                if (trigger == 'phase-end') support.addUseCnt();
                else if (trigger == 'card' && isMinus) {
                    support.minusUseCnt(hcard.cost - mdc);
                    support.minusPerCnt();
                    if (ver.isOffline && support.card.useCnt > 0) {
                        support.card.minusUseCnt();
                        cmds.getCard(1);
                    }
                }
            }
        }
    }),
    // 瓦格纳
    322004: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { hcard, trigger, isMinusDiceCard, minusDiceCard: mdc, playerInfo: { weaponTypeCnt } } = event;
        const triggers: Trigger[] = ['phase-end', 'card'];
        if (ver.gte('v4.3.0') && weaponTypeCnt >= 3) triggers.push('enter');
        const isMinus = support.perCnt > 0 && hcard && hcard.hasSubtype(CARD_SUBTYPE.Weapon) &&
            isMinusDiceCard && support.useCnt >= hcard.currDiceCost - mdc;
        if (trigger == 'card' && !isMinus) return;
        return {
            triggers: triggers,
            isNotAddTask: trigger == 'card' && support.card.useCnt <= 0,
            isLast: true,
            minusDiceCard: isMinus ? hcard.cost - mdc : 0,
            exec: cmds => {
                if (trigger == 'enter') return cmds.getCard(1, { subtype: CARD_SUBTYPE.Weapon, isFromPile: true }).res;
                if (trigger == 'phase-end') support.addUseCnt();
                else if (trigger == 'card' && isMinus) {
                    support.minusUseCnt(hcard.cost - mdc);
                    support.minusPerCnt();
                    if (ver.isOffline && support.card.useCnt > 0) {
                        support.card.minusUseCnt();
                        cmds.getCard(1);
                    }
                }
            }
        }
    }),
    // 卯师傅
    322005: () => new SupportBuilder().permanent(1).perCnt(1).handle((support, event, ver) => {
        const { hcard, pile } = event;
        if (!hcard?.hasSubtype(CARD_SUBTYPE.Food)) return;
        const isGetDice = support.perCnt > 0;
        const isGetCard = support.useCnt > 0 && pile.some(c => c.hasSubtype(CARD_SUBTYPE.Food));
        if (!isGetDice && !isGetCard) return;
        return {
            triggers: 'card',
            exec: cmds => {
                if (isGetDice) {
                    support.minusPerCnt();
                    cmds.getDice(1, { mode: CMD_MODE.Random });
                }
                if ((ver.gte('v4.1.0') || ver.isOffline) && isGetCard) {
                    support.minusUseCnt();
                    cmds.getCard(1, { subtype: CARD_SUBTYPE.Food, isFromPile: true });
                }
            }
        }
    }),
    // 阿圆
    322006: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { hcard, isMinusDiceCard } = event;
        if (support.perCnt <= 0 || !hcard?.hasSubtype(CARD_SUBTYPE.Place) || !isMinusDiceCard) return;
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: 2,
            exec: () => { support.minusPerCnt() }
        }
    }),
    // 提米
    322007: () => new SupportBuilder().collection().handle(support => ({
        triggers: ['phase-start', 'enter'],
        exec: cmds => {
            if (support.addUseCnt() < 3) return;
            cmds.getCard(1).getDice(1, { element: DICE_COST_TYPE.Omni });
            return { isDestroy: true }
        }
    })),
    // 立本
    322008: () => new SupportBuilder().collection().handle((support, event) => {
        const { dices, trigger } = event;
        const triggers: Trigger[] = ['phase-end'];
        if (support.useCnt >= 3) triggers.push('phase-start');
        return {
            triggers,
            exec: cmds => {
                if (trigger == 'phase-end') {
                    const pdices = getSortedDices(dices);
                    dices.length = 0;
                    while (pdices.length > 0) {
                        if (support.useCnt >= 3) {
                            dices.push(...pdices);
                            break;
                        }
                        const pdice = pdices.shift()!;
                        support.addUseCnt();
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
        exec: cmds => {
            if (support.addUseCnt() < 3) return;
            cmds.getCard(2);
            return { isDestroy: true }
        }
    })),
    // 艾琳
    322010: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0) return;
        const { hero, isMinusDiceSkill, skill } = event;
        return {
            triggers: isCdt(isMinusDiceSkill && skill && skill.useCntPerRound > 1, 'skill'),
            isNotAddTask: true,
            minusDiceSkill: { skills: hero.skills.map(skill => [0, 0, +(skill.useCntPerRound > 0)]) },
            exec: () => support.minusPerCnt(),
        }
    }),
    // 田铁嘴
    322011: () => new SupportBuilder().round(2).handle((support, event) => {
        const hidxs = event.heros.allHidxs({ cdt: h => !h.isFullEnergy, limit: 1 });
        if (hidxs.length == 0) return;
        return {
            triggers: 'phase-end',
            exec: cmds => (cmds.getEnergy(1, { hidxs }), { isDestroy: support.minusUseCnt() == 0 })
        }
    }),
    // 刘苏
    322012: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { heros, hidx } = event;
        const isInvalid = () => support.perCnt <= 0 || (heros[hidx]?.energy ?? 1) != 0;
        if (isInvalid()) return;
        return {
            triggers: 'switch',
            exec: cmds => {
                if (isInvalid()) return { isCancel: true }
                support.minusPerCnt();
                cmds.getEnergy(1);
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 花散里
    322013: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger, isMinusDiceWeapon, isMinusDiceRelic } = event;
        const isMinus = support.useCnt >= 3 && (isMinusDiceWeapon || isMinusDiceRelic);
        const triggers: Trigger[] = ['summon-destroy'];
        if (isMinus) triggers.push('card');
        return {
            triggers,
            minusDiceCard: isCdt(isMinus, 2),
            isNotAddTask: trigger == 'card',
            exec: () => {
                if (trigger == 'card') return { isDestroy: true }
                if (trigger == 'summon-destroy' && support.useCnt < 3) support.addUseCnt();
            }
        }
    }),
    // 鲸井小弟
    322014: () => new SupportBuilder().permanent().handle(() => ({
        triggers: 'phase-start',
        isExchange: true,
        exec: cmds => cmds.getDice(1, { element: DICE_COST_TYPE.Omni }).res,
    })),
    // 旭东
    322015: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { hcard, isMinusDiceCard } = event;
        if (support.perCnt <= 0 || !hcard || !hcard.hasSubtype(CARD_SUBTYPE.Food) || !isMinusDiceCard) return;
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: 2,
            exec: () => { support.minusPerCnt() }
        }
    }),
    // 迪娜泽黛
    322016: () => new SupportBuilder().permanent(1).perCnt(1).handle((support, event, ver) => {
        const { hcard, isMinusDiceCard, pile } = event;
        if (!hcard || !hcard.hasSubtype(CARD_SUBTYPE.Ally)) return;
        const isMinus = isMinusDiceCard && support.perCnt > 0;
        const isGetCard = (ver.gte('v4.1.0') || ver.isOffline) && support.useCnt > 0 && pile.some(c => c.hasSubtype(CARD_SUBTYPE.Ally));
        if (!isMinus && !isGetCard) return;
        return {
            triggers: 'card',
            isNotAddTask: !isGetCard,
            minusDiceCard: isCdt(isMinus, 1),
            exec: cmds => {
                if (isMinus) support.minusPerCnt();
                if (isGetCard) {
                    support.minusUseCnt();
                    cmds.getCard(1, { subtype: CARD_SUBTYPE.Ally, isFromPile: true });
                }
            }
        }
    }),
    // 拉娜
    322017: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        if (support.perCnt <= 0 || event.heros.getBackHidxs().length == 0) return;
        return {
            triggers: 'after-skilltype2',
            exec: cmds => {
                support.minusPerCnt();
                cmds.getDice(1, { mode: CMD_MODE.FrontHero, frontOffset: 1 });
            }
        }
    }),
    // 老章
    322018: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { heros, isMinusDiceWeapon } = event;
        if (support.perCnt <= 0 || !isMinusDiceWeapon) return;
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: 1 + heros.filter(h => h.weaponSlot != null).length,
            exec: () => { support.minusPerCnt() }
        }
    }),
    // 塞塔蕾
    322019: () => new SupportBuilder().collection(3).handle((support, event) => {
        if (event.hcards.length > 0) return;
        return {
            triggers: ['action-after', 'action-after-oppo'],
            exec: cmds => (cmds.getCard(1), { isDestroy: support.minusUseCnt() == 0 })
        }
    }),
    // 弥生七月
    322020: () => new SupportBuilder().permanent().perCnt(1).handle((support, event, ver) => {
        if (support.perCnt <= 0) return;
        const { heros, isMinusDiceRelic } = event;
        if (!isMinusDiceRelic) return;
        const relicLen = heros.filter(h => h.relicSlot != null).length;
        const minusCnt = 1 + +(ver.lt('v4.6.0') ? relicLen : (relicLen >= 2));
        return {
            triggers: 'card',
            isNotAddTask: true,
            minusDiceCard: minusCnt,
            exec: () => support.minusPerCnt(),
        }
    }),
    // 玛梅赫
    322021: () => new SupportBuilder().collection(3).perCnt(1).handle((support, event) => {
        const { hcard } = event;
        const subtype = [CARD_SUBTYPE.Food, CARD_SUBTYPE.Ally, CARD_SUBTYPE.Place, CARD_SUBTYPE.Item];
        if (support.perCnt <= 0 || hcard?.id == support.id || !hcard?.hasSubtype(...subtype)) return;
        return {
            triggers: 'card',
            exec: cmds => {
                support.minusPerCnt();
                cmds.getCard(1, { subtype, exclude: support.id });
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 婕德
    322022: () => new SupportBuilder().collection().handle((support, event, ver) => {
        const { trigger, playerInfo: { destroyedSupport } } = event;
        if (trigger == 'enter') {
            support.setUseCnt(Math.min(6, destroyedSupport));
            return;
        }
        const threshold = ver.lt('v4.6.0') ? 5 : 6;
        return {
            triggers: support.useCnt >= threshold ? 'skilltype3' : 'support-destroy',
            exec: cmds => {
                if (trigger == 'skilltype3') {
                    if (ver.lt('v4.6.0')) cmds.getDice(support.useCnt - 2, { element: DICE_COST_TYPE.Omni });
                    else cmds.getStatus(302205);
                    return { isDestroy: true }
                }
                if (trigger == 'support-destroy') support.setUseCnt(Math.min(6, destroyedSupport));
            }
        }
    }),
    // 西尔弗和迈勒斯
    322023: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger, playerInfo: { oppoGetElDmgType } } = event;
        const cnt = () => Math.min(4, oppoGetElDmgType.toString(2).split('').filter(v => +v).length);
        if (trigger == 'enter') {
            support.setUseCnt(cnt());
            return;
        }
        const triggers: Trigger[] = [];
        Object.values(PURE_ELEMENT_CODE).forEach(elcode => {
            if ((oppoGetElDmgType >> elcode & 1) == 0) triggers.push(`${ELEMENT_TYPE_KEY[ELEMENT_CODE_KEY[elcode]]}-getdmg-oppo`);
        });
        if (support.useCnt >= 4) triggers.length = 0;
        if (support.useCnt >= 3) triggers.push('phase-end');
        return {
            triggers: triggers,
            exec: cmds => {
                if (trigger == 'phase-end' && support.useCnt >= 3) {
                    cmds.getCard(support.useCnt);
                    return { isDestroy: true }
                }
                if (trigger.endsWith('-getdmg-oppo')) support.setUseCnt(cnt() + 1);
            }
        }
    }),
    // 太郎丸
    322024: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger, hcard } = event;
        if (trigger == 'enter') {
            return { triggers: trigger, exec: cmds => cmds.addCard(4, 302202, { isRandom: false }).res }
        }
        if (hcard?.id != 302202) return;
        return {
            triggers: 'card',
            summon: isCdt(support.useCnt == 1, 302201),
            exec: () => ({ isDestroy: support.addUseCnt() >= 2 }),
        }
    }),
    // 白手套和渔夫
    322025: () => new SupportBuilder().round(2).handle(support => ({
        triggers: 'phase-end',
        exec: cmds => {
            cmds.addCard(1, 302203, { scope: 5 });
            if (support.useCnt == 1) cmds.getCard(1);
            return { isDestroy: support.minusUseCnt() == 0 }
        }
    })),
    // 亚瑟先生
    322026: () => new SupportBuilder().collection().handle((support, event) => {
        const { trigger, epile } = event;
        if (support.useCnt >= 2 != (trigger == 'phase-end' && epile.length > 0)) return;
        return {
            triggers: ['discard', 'reconcile', 'phase-end'],
            exec: cmds => {
                if (trigger == 'phase-end') {
                    support.setUseCnt();
                    return cmds.getCard(1, { card: epile[0].id }).res;
                }
                support.addUseCnt();
            },
        }
    }),
    // 瑟琳
    322027: () => new SupportBuilder().round(3).handle(support => ({
        triggers: ['phase-start', 'enter'],
        exec: cmds => {
            cmds.getCard(1, { include: Array.from({ length: 10 }, (_, i) => 302206 + i) });
            return { isDestroy: support.minusUseCnt() == 0 }
        }
    })),
    // 阿伽娅
    322028: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => ({
        triggers: isCdt(event.isMinusDiceSkill && support.perCnt > 0, 'vehicle'),
        isNotAddTask: true,
        minusDiceSkill: { skilltype5: [0, 0, 1] },
        exec: () => support.minusPerCnt(),
    })),
    // 森林的祝福
    322029: () => new SupportBuilder().permanent().handle(() => ({
        triggers: ['enter', 'elReaction'],
        isAfterSkill: true,
        exec: cmds => cmds.getCard(1, { include: [301034, 301035, 301036] }).res,
    })),
    // 预言女神的礼物
    322030: () => new SupportBuilder().collection(2).handle((support, event) => {
        const { trigger, sourceSummon } = event;
        const triggers: Trigger[] = ['enter'];
        if (sourceSummon?.hasTag(SUMMON_TAG.Simulanka)) triggers.push('summon-generate');
        return {
            triggers,
            exec: cmds => {
                if (trigger == 'enter') return cmds.getCard(2, { card: 301033 }).addCard(2, 301033).res;
                if (trigger == 'summon-generate' && sourceSummon) {
                    sourceSummon.addSimulankaEffect();
                    return { isDestroy: support.minusUseCnt() == 0 }
                }
            },
        }
    }),
    // 西摩尔
    322031: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { hcard, playerInfo: { initCardIds }, trigger, epile } = event;
        if (trigger == 'enter') {
            if (epile.length == 0) return;
            return { triggers: trigger, exec: cmds => cmds.getCard(1, { card: epile[0] }).res }
        }
        if (hcard && initCardIds.includes(hcard.id) || support.perCnt <= 0) return;
        return {
            triggers: 'card',
            exec: cmds => {
                cmds.adventure();
                support.minusPerCnt();
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 玻娜与「绿松石」
    322032: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { trigger } = event;
        if (trigger == 'enter') return { triggers: trigger, exec: cmds => cmds.adventure().res }
        if (support.perCnt <= 0) return;
        return {
            triggers: 'after-skilltype5',
            exec: cmds => {
                support.minusPerCnt();
                cmds.adventure();
            }
        }
    }),
    // 参量质变仪
    323001: () => new SupportBuilder().collection().handle(support => ({
        triggers: ['el-dmg', 'el-getdmg', 'el-getdmg-oppo'],
        isAfterSkill: true,
        isOrTrigger: true,
        exec: cmds => {
            if (support.addUseCnt() < 3) return;
            cmds.getDice(3, { mode: CMD_MODE.Random });
            return { isDestroy: true }
        }
    })),
    // 便携营养袋
    323002: () => new SupportBuilder().permanent().perCnt(1).handle((support, event) => {
        const { hcard, pile, trigger } = event;
        if (!pile.some(c => c.hasSubtype(CARD_SUBTYPE.Food))) return;
        if (trigger != 'enter' && (support.perCnt <= 0 || !hcard?.hasSubtype(CARD_SUBTYPE.Food))) return;
        return {
            triggers: ['card', 'enter'],
            exec: cmds => {
                if (trigger != 'enter') support.minusPerCnt();
                cmds.getCard(1, { subtype: CARD_SUBTYPE.Food, isFromPile: true });
            }
        }
    }),
    // 红羽团扇
    323003: () => new SupportBuilder().permanent().perCnt(1).handle(support => {
        if (support.perCnt <= 0) return;
        return {
            triggers: 'switch',
            exec: cmds => {
                support.minusPerCnt();
                cmds.getStatus(302303);
            }
        }
    }),
    // 寻宝仙灵
    323004: () => new SupportBuilder().collection().handle(support => ({
        triggers: 'after-skill',
        exec: cmds => {
            if (support.addUseCnt() < 3) return;
            cmds.getCard(3);
            return { isDestroy: true }
        }
    })),
    // 化种匣
    323005: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event, ver) => {
        const { hcard, isMinusDiceCard } = event;
        if (!hcard || hcard.type != CARD_TYPE.Support || support.perCnt <= 0 || !isMinusDiceCard) return;
        if (ver.lt('v4.6.0') && !ver.isOffline ? hcard.rawDiceCost != 1 : hcard.rawDiceCost < 2) return;
        return {
            triggers: 'card',
            minusDiceCard: 1,
            isNotAddTask: true,
            exec: () => {
                support.minusPerCnt();
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 留念镜
    323006: () => new SupportBuilder().collection(2).perCnt(1).handle((support, event) => {
        const { hcard, playerInfo: { usedCardIds }, isMinusDiceCard } = event;
        const subtypes = [CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Relic, CARD_SUBTYPE.Place, CARD_SUBTYPE.Ally];
        if (!hcard || !usedCardIds.includes(hcard.id) || !hcard.hasSubtype(...subtypes) || support.perCnt <= 0 || !isMinusDiceCard) return;
        return {
            triggers: 'card',
            minusDiceCard: 2,
            isNotAddTask: true,
            exec: () => {
                support.minusPerCnt();
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 流明石触媒
    323007: () => new SupportBuilder().collection(3).perCnt(1).handle(support => {
        if (support.perCnt <= 0) return;
        return {
            triggers: 'card',
            exec: cmds => {
                if (support.card.addUseCnt() < 3) return;
                support.minusPerCnt();
                support.card.setUseCnt();
                cmds.getCard(1).getDice(1, { element: DICE_COST_TYPE.Omni });
                return { isDestroy: support.minusUseCnt() == 0 }
            }
        }
    }),
    // 苦舍桓
    323008: () => new SupportBuilder().collection().perCnt(1).handle((support, event) => {
        const { hcards, trigger, isMinusDiceSkill } = event;
        if (trigger == 'phase-start' && (support.useCnt >= 2 || hcards.length == 0)) return;
        if (support.perCnt == 0 && (trigger == 'card' || (trigger == 'skill' && support.useCnt == 0))) return;
        const triggers: Trigger[] = ['phase-start', 'card'];
        if (isMinusDiceSkill) triggers.push('skill');
        return {
            triggers,
            minusDiceSkill: isCdt(support.perCnt > 0 && support.useCnt > 0, { skill: [0, 0, 1] }),
            isNotAddTask: trigger != 'phase-start',
            exec: cmds => {
                if (trigger == 'phase-start') {
                    const cnt = Math.min(hcards.length, 2 - support.useCnt);
                    support.addUseCnt(cnt);
                    return cmds.discard({ cnt, mode: CMD_MODE.HighHandCard }).res;
                }
                if (trigger == 'card') support.minusPerCnt();
                else if (trigger == 'skill') support.minusUseCnt();
            },
        }
    }),
    // 元素幻变：超导祝佑
    331004: () => elTransfiguration(ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Electro, 'Superconduct', 4),
    // 元素幻变：蒸发祝佑
    331005: () => elTransfiguration(ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro, 'Vaporize', 5),

}

export const newSupport = (version: Version, options: { diff?: Record<number, Version>, dict?: Record<number, number> } = {}) => {
    return (card: Card, ...args: any[]) => {
        const { diff = {}, dict = {} } = options;
        const dversion = diff[getDerivantParentId(card.id, dict)] ?? diff[card.id] ?? version;
        return supportTotal[card.id](...args).card(card).version(dversion).done();
    }
}