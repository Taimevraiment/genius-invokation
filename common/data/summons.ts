
import { Card, Cmds, Hero, MinuDiceSkill, Status, Summon, Trigger } from "../../typing";
import { DAMAGE_TYPE, ELEMENT_TYPE, ElementType, SKILL_TYPE, SUMMON_DESTROY_TYPE, Version } from "../constant/enum.js";
import { allHidxs, getAtkHidx, getHidById, getMaxHertHidxs, getMinHertHidxs, getNearestHidx, getObjById, getObjIdxById, hasObjById } from "../utils/gameUtil.js";
import { isCdt } from "../utils/utils.js";
import { phaseEndAtk, SummonBuilder } from "./builder/summonBuilder.js";
import { newStatus } from "./statuses.js";

export type SummonHandleEvent = {
    trigger?: Trigger,
    heros?: Hero[],
    eheros?: Hero[],
    hidx?: number,
    reset?: boolean,
    isChargedAtk?: boolean,
    isFallAtk?: boolean,
    hcard?: Card,
    talent?: Card | null,
    isExec?: boolean,
    skid?: number,
    minusDiceCard?: number,
    isMinusDiceSkill?: boolean,
    minusDiceSkill?: number[][],
    tround?: number,
    isExecTask?: boolean,
}

export type SummonHandleRes = {
    trigger?: Trigger[],
    cmds?: Cmds[],
    addDmg?: number,
    addDmgType1?: number,
    addDmgType2?: number,
    addDmgType3?: number,
    addDmgCdt?: number,
    rCombatStatus?: (number | [number, ...any])[] | number,
    isNotAddTask?: boolean,
    damage?: number,
    element?: ElementType,
    addDiceHero?: number,
    minusDiceCard?: number,
    minusDiceSkill?: MinuDiceSkill,
    tround?: number,
    willSummon?: Summon,
    isQuickAction?: boolean,
    exec?: (event: SummonExecEvent) => SummonExecRes | void,
}

export type SummonExecEvent = {
    summon?: Summon,
    heros?: Hero[],
    eheros?: Hero[],
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
    combatStatus?: Status[],
    eCombatStatus?: Status[],
}

export type SummonExecRes = {
    cmds?: Cmds[],
    switchHeroDiceCnt?: number,
}

const crd12702summon = () => {
    return new SummonBuilder('增殖生命体').useCnt(1).damage(1)
        .description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/5c6f5f310243aea5eff849b26dd80269_2475050287145431617.png');
}


const summonTotal: Record<number, (...args: any) => SummonBuilder> = {

    115: () => new SummonBuilder('燃烧烈焰').useCnt(1).maxUse(2).damage(1).pyro().description('{defaultAtk。}')
        .src('https://patchwiki.biligame.com/images/ys/8/8b/2nnf0b70wnuaw0yn45i9db61l6dwg9x.png'),

    111011: () => new SummonBuilder('冰灵珠').useCnt(2).damage(1).pdmg(1)
        .description('{defaultAtk，对所有后台敌人造成1点[穿透伤害]。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/07c346ef7197c24c76a25d3b47ed5e66_3626039813983519562.png'),

    111023: () => new SummonBuilder('酒雾领域').useCnt(2).damage(1).heal(2)
        .description('{defaultAtk，治疗我方出战角色{shield}点。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/a8a7cc75353c6df3921b63e42f46fe7d_3484731987232379289.png'),

    111051: () => new SummonBuilder('霜见雪关扉').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/0e04dc93febea28566d127704a0eef5c_8035762422701723644.png'),

    111062: () => new SummonBuilder('光降之剑').maxUse(1000).damage(3).damage(2, 'v3.8.0').physical().plus().roundEnd()
        .description('【〖hro〗使用｢普通攻击｣或｢元素战技｣时：】此牌累积2点｢能量层数｣，但是【hro1106】不会获得[充能]。；【结束阶段：】弃置此牌。{dealDmg}; 每有1点｢能量层数｣，都使次伤害+1。(影响此牌｢[可用次数]｣的效果会作用于｢能量层数｣。)')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/a475346a830d9b62d189dc9267b35a7a_4963009310206732642.png')
        .handle((summon, event = {}) => {
            const { heros = [], isExec = true, trigger = '' } = event;
            const fhero = getObjById(heros, getHidById(summon.id));
            if (['enter', 'summon-destroy'].includes(trigger)) {
                fhero?.skills.forEach(skill => {
                    if (skill.type == SKILL_TYPE.Normal || skill.type == SKILL_TYPE.Elemental) {
                        skill.cost[2].cnt = trigger == 'enter' ? -1 : 0;
                    }
                });
                return;
            }
            const hero = heros[getAtkHidx(heros)];
            if (hero?.id == fhero?.id && !isExec && ['skilltype1', 'skilltype2'].includes(trigger)) {
                summon.useCnt += !!hero.talentSlot && trigger == 'skilltype2' ? 3 : 2;
            }
            return {
                trigger: ['phase-end', 'skilltype1', 'skilltype2'],
                isNotAddTask: trigger != 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon, heros: hs = [] } = execEvent;
                    if (trigger == 'phase-end') {
                        return { cmds: [{ cmd: 'attack', cnt: smn.damage + smn.useCnt }] }
                    }
                    const hero = hs[getAtkHidx(hs)];
                    if (hero?.id == getHidById(summon.id)) {
                        smn.useCnt += !!hero.talentSlot && trigger == 'skilltype2' ? 3 : 2;
                    }
                },
            }
        }),

    111073: () => new SummonBuilder('箓灵').useCnt(2).damage(1)
        .description('{defaultAtk。}；【召唤物在场时：】敌方角色受到的[冰元素伤害]和[物理伤害]+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/7deee3f26916cf28fd145b110f81d852_4270139379454156566.png')
        .handle((summon, event = {}) => {
            const { trigger = '' } = event;
            return {
                addDmgCdt: 1,
                isNotAddTask: trigger != 'phase-end',
                trigger: ['Cryo-getdmg-oppo', 'Physical-getdmg-oppo', 'phase-end'],
                exec: execEvent => {
                    if (trigger == 'phase-end') return phaseEndAtk(execEvent?.summon ?? summon);
                },
            }
        }),

    111081: () => new SummonBuilder('寒病鬼差').useCnt(3).perCnt(1).perCnt(0, 'v4.7.0').damage(1)
        .description('{defaultAtk。}；【此召唤物在场时，〖hro〗使用｢普通攻击｣后：】治疗受伤最多的我方角色1点; 【每回合1次：】再治疗我方出战角色1点。')
        .description('{defaultAtk。}；【此召唤物在场时，〖hro〗使用｢普通攻击｣后：】治疗受伤最多的我方角色1点。', 'v4.7.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/16/12109492/f9ea7576630eb5a8c46aae9ea8f61c7b_317750933065064305.png')
        .handle((summon, event = {}, ver) => {
            const { heros = [], trigger = '', tround = 0, isExec = true } = event;
            const triggers: Trigger[] = ['phase-end'];
            const hidxs = getMaxHertHidxs(heros);
            const fhero = heros[getAtkHidx(heros)];
            const isHeal = fhero?.id == getHidById(summon.id) && trigger == 'after-skilltype1' && hidxs.length > 0;
            const hasTround = ver >= 'v4.7.0' && trigger == 'after-skilltype1' && tround == 0 && summon.perCnt > 0 && fhero.hp < fhero.maxHp;
            if (isHeal) triggers.push('after-skilltype1');
            const skcmds: Cmds[] = [{ cmd: 'heal', cnt: 1, hidxs }];
            const trdcmds: Cmds[] = [];
            if (hasTround || tround == 1) trdcmds.push({ cmd: 'heal', cnt: 1 });
            return {
                trigger: triggers,
                cmds: isCdt(isHeal && !isExec, [...skcmds, ...trdcmds]),
                tround: isCdt(hasTround, 1),
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (tround == 1) {
                        --smn.perCnt;
                        return { cmds: trdcmds }
                    }
                    if (trigger == 'after-skilltype1') return { cmds: skcmds }
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                },
            }
        }),

    111093: () => new SummonBuilder('饰梦天球').useCnt(2).damage(1)
        .description('{defaultAtk。如果【sts111092】在场，则使其累积1枚｢晚星｣。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/1b86f1cb97411b77d51cc22bb5622ff7_2462971599599504312.png')
        .handle(summon => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { summon: smn = summon, combatStatus = [] } = execEvent;
                const sts111092 = getObjById(combatStatus, 111092);
                if (sts111092) ++sts111092.useCnt;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                return { cmds: [{ cmd: 'attack' }] }
            }
        })),

    111102: () => new SummonBuilder('临事场域').useCnt(2).damage(1).heal(1)
        .description('{defaultAtk，治疗我方出战角色{shield}点。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/a4249ebb8a68e2843cdd2fa78937912c_2796631322062911422.png'),

    112011: () => new SummonBuilder('歌声之环').useCnt(2).heal(1)
        .description('【结束阶段：】治疗所有我方角色{shield}点，然后对我方出战角色[附着水元素]。；[useCnt]')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/d406a937bb6794a26ac46bf1fc9cfe3b_7906063991052689263.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { summon: smn = summon } = execEvent;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                return { cmds: [{ cmd: 'heal', hidxs: allHidxs(event.heros) }, { cmd: 'attach' }] }
            },
        })),

    112031: () => new SummonBuilder('虚影').useCnt(1).damage(1).shield(1).statusId().roundEnd()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【结束阶段：】弃置此牌，{dealDmg}。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/098f3edd0f9ac347a9424c6417de6987_7446453175998729325.png'),

    112051: (useCnt: number = 2) => new SummonBuilder('化海月').useCnt(useCnt).maxUse(2).damage(1).heal(1)
        .description('【结束阶段：】{dealDmg}，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/4608304a2a01f7f33b59b731543a761b_3713077215425832494.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { summon: smn = summon } = execEvent;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                const { heros = [] } = event;
                const hero = getObjById(heros, getHidById(smn.id));
                const isTalent = !!hero?.talentSlot && hasObjById(hero?.heroStatus, 112052);
                return { cmds: [{ cmd: 'attack', cnt: isCdt(isTalent, smn.damage + 1) }, { cmd: 'heal' }] }
            }
        })),

    112062: () => new SummonBuilder('清净之园囿').useCnt(2).damage(2)
        .description('{defaultAtk。}；【此召唤物在场时：】我方角色｢普通攻击｣造成的伤害+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/ef32ccb60a38cb7bfa31372dd5953970_1908841666370199656.png')
        .handle((summon, event) => ({
            addDmgType1: 1,
            trigger: ['phase-end', 'skilltype1'],
            isNotAddTask: event.trigger == 'skilltype1',
            exec: execEvent => {
                if (event?.trigger == 'phase-end') return phaseEndAtk(execEvent?.summon ?? summon);
            },
        })),

    112082: () => new SummonBuilder('丰穰之核').useCnt(1).maxUse(3).damage(2).dendro()
        .description('{defaultAtk。}；【我方宣布结束时：】如果此牌的[可用次数]至少为2，则造成2点[草元素伤害]。(需消耗[可用次数])')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/865915f8734cdc641df43198eb728497_5603461429712047360.png')
        .handle((summon, event) => {
            const { heros = [] } = event;
            const hero = getObjById(heros, getHidById(summon.id));
            const isTalent = !!hero?.talentSlot;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.useCnt >= 2) triggers.push('end-phase');
            return {
                trigger: triggers,
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack', cnt: isCdt(isTalent, smn.damage + 1) }] };
                },
            }
        }),

    112111: (useCnt: number = 2) => new SummonBuilder('沙龙成员').useCnt(useCnt).maxUse(4).damage(1)
        .description('{defaultAtk。如果我方存在生命值至少为6的角色，则对一位受伤最少的我方角色造成1点[穿透伤害]，然后再造成1点[水元素伤害]。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/8cfed9e54e85d3bd44fc7e7e3aa9564a_6917287984925848695.png')
        .handle((summon, event) => {
            const { tround = 0, heros = [] } = event;
            const hasTround = tround == 0 && heros.some(h => h.hp >= 6);
            return {
                trigger: ['phase-end'],
                tround: isCdt(hasTround, 1),
                exec: execEvent => {
                    const { summon: smn = summon, heros: hs = heros } = execEvent;
                    if (!hasTround) smn.useCnt = Math.max(0, smn.useCnt - 1);
                    if (tround == 0) return { cmds: [{ cmd: 'attack' }] }
                    return {
                        cmds: [
                            { cmd: 'attack', cnt: 1 },
                            { cmd: 'attack', element: DAMAGE_TYPE.Pierce, hidxs: getMinHertHidxs(hs), cnt: 1, isOppo: false },
                        ]
                    }
                },
            }
        }),

    112112: (useCnt: number = 2) => new SummonBuilder('众水的歌者').useCnt(useCnt).maxUse(4).heal(1)
        .description('【结束阶段：】治疗所有我方角色1点。如果我方存在生命值不多于5的角色，则再治疗一位受伤最多的角色1点。；[useCnt]')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/e223897c5723dcc6b6ea50fcdf966232_9198406692148038444.png')
        .handle((summon, event) => {
            const { tround = 0, heros = [] } = event;
            const hasTround = tround == 0 && heros.some(h => h.hp <= 4);
            return {
                trigger: ['phase-end'],
                tround: isCdt(hasTround, 1),
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (!hasTround) smn.useCnt = Math.max(0, smn.useCnt - 1);
                    if (tround == 0) return { cmds: [{ cmd: 'heal', hidxs: allHidxs(heros) }] }
                    return { cmds: [{ cmd: 'heal', hidxs: getMaxHertHidxs(heros) }] }
                },
            }
        }),

    113021: () => new SummonBuilder('锅巴').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/19b63677c8f4e6cabed15711be406e09_2795447472820195792.png'),

    113041: () => new SummonBuilder('兔兔伯爵').useCnt(1).shield(2).damage(2).usedRoundEnd().statusId()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以{dealDmg}。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/6864ff4d13f55e24080152f88fef542f_1635591582740112856.png')
        .handle((summon, event, ver) => {
            const { heros = [], trigger = '', isExec = true } = event;
            const triggers: Trigger[] = [];
            if (summon.useCnt == 0) triggers.push('phase-end');
            const hero = heros[getAtkHidx(heros)];
            const cnt = isCdt(hero?.id == getHidById(summon.id) && trigger == 'after-skilltype1' && !!hero?.talentSlot, ver < 'v4.2.0' ? 3 : 4);
            if (cnt) {
                triggers.push('after-skilltype1');
                if (!isExec) summon.useCnt = -100;
            }
            return {
                trigger: triggers,
                damage: cnt,
                element: summon.element,
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'after-skilltype1') {
                        smn.isDestroy = SUMMON_DESTROY_TYPE.Used;
                        smn.useCnt = 0;
                    }
                    return { cmds: [{ cmd: 'attack', cnt }] }
                },
            }
        }),

    113093: () => new SummonBuilder('净焰剑狱领域').useCnt(3).damage(1).spReset()
        .description('{defaultAtk。}；【当此召唤物在场且〖hro〗在我方后台，我方出战角色受到伤害时：】抵消1点伤害; 然后，如果【hro】生命值至少为7，则对其造成1点[穿透伤害]。(每回合1次)')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/5fe195423d5308573221c9d25f08d6d7_2012000078881285374.png')
        .handle((summon, event) => {
            const { reset = false } = event;
            if (reset) return { trigger: ['enter'], rCombatStatus: 113094 }
            return {
                trigger: ['phase-end'],
                exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
            }
        }),

    113101: () => new SummonBuilder('怪笑猫猫帽').useCnt(1).maxUse(2).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/27885c0d6d1bd4ae42ea0d69d357198d_8888407409706694377.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { summon: smn = summon } = execEvent;
                const { talent } = event;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                if (talent && talent.perCnt > 0) {
                    --talent.perCnt;
                    return { cmds: [{ cmd: 'attack', cnt: smn.damage + 2 }] }
                }
                return { cmds: [{ cmd: 'attack' }] }
            }
        })),

    114011: (isTalent: boolean = false) => new SummonBuilder('奥兹').useCnt(2).damage(1).talent(isTalent)
        .description(`{defaultAtk。}${isTalent ? '；【hro】｢普通攻击｣后：造成2点[雷元素伤害]。(需消耗[可用次数])' : ''}`)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/ea0ab20ac46c334e1afd6483b28bb901_2978591195898491598.png')
        .handle((summon, event) => {
            const { heros = [], trigger = '', isExec = true } = event;
            const triggers: Trigger[] = ['phase-end'];
            let cnt = isCdt(trigger != 'phase-end', 2);
            if (heros[getAtkHidx(heros)]?.id == getHidById(summon.id) && summon.isTalent) {
                triggers.push('after-skilltype1');
                if (!isExec && trigger == 'after-skilltype1') --summon.useCnt;
            }
            return {
                trigger: triggers,
                damage: cnt,
                element: summon.element,
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack', cnt }] };
                },
            }
        }),

    114061: () => new SummonBuilder('天狗咒雷·伏').useCnt(1).damage(1)
        .description('{defaultAtk，我方出战角色附属【sts114063】。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/aef9cba89ecb16fa0d73ffef53cad44e_6822516960472237055.png')
        .handle(summon => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { cmds = [] } = phaseEndAtk(execEvent?.summon ?? summon);
                return {
                    cmds: [...cmds, { cmd: 'getStatus', status: 114063 }],
                }
            }
        })),

    114062: () => new SummonBuilder('天狗咒雷·雷砾').useCnt(2).damage(2)
        .description('{defaultAtk，我方出战角色附属【sts114063】。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/51bca1f202172ad60abbace59b96c346_7973049003331786903.png')
        .handle(summon => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { cmds = [] } = phaseEndAtk(execEvent?.summon ?? summon);
                return {
                    cmds: [...cmds, { cmd: 'getStatus', status: 114063 }],
                }
            }
        })),

    114071: () => new SummonBuilder('雷罚恶曜之眼').useCnt(3).damage(1)
        .description('{defaultAtk。}；【此召唤物在场时：】我方角色｢元素爆发｣造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/a27cfa39a258ff4b80f01b1964e6faac_1649452858766133852.png')
        .handle(summon => ({
            addDmgType3: 1,
            trigger: ['phase-end'],
            exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
        })),

    114081: () => new SummonBuilder('杀生樱').useCnt(3).maxUse(6).damage(1)
        .description('{defaultAtk。}；【我方宣布结束时：】如果此牌的[可用次数]至少为4，则造成1点[雷元素伤害]。(需消耗[可用次数])')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/d63267f4388f521b1481a85ace6de257_3147336152102036232.png')
        .handle(summon => {
            const triggers: Trigger[] = ['phase-end'];
            if (summon.useCnt >= 4) triggers.push('end-phase');
            return {
                trigger: triggers,
                exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
            }
        }),

    114092: () => new SummonBuilder('蔷薇雷光').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/0ea69a82861d8469ecdbbc78797e9fd8_3713104012683105893.png'),

    114101: () => new SummonBuilder('售后服务弹').useCnt(1).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/fe4516935ffa9eb9b193411113fa823f_372775257521707079.png'),

    114102: (isTalent: boolean = false) => new SummonBuilder('灯中幽精').useCnt(2).heal(2).talent(isTalent).plus(isTalent)
        .description(`【结束阶段：】治疗我方出战角色{shield}点，并使其获得1点[充能]。${isTalent ? '；治疗生命值不多于6的角色时，治疗量+1; 使没有[充能]的角色获得[充能]时，获得量+1。' : ''}；[useCnt]`)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/c8209ff8f2c21e01e4e05203385410d7_8366905551575281519.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { summon: smn = summon } = execEvent;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                const { heros = [] } = event;
                const fhero = heros.find(h => h.isFront);
                if (!fhero) throw new Error('fhero is undefined');
                return {
                    cmds: [
                        { cmd: 'heal', cnt: isCdt(fhero.hp <= 6 && smn.isTalent, smn.shieldOrHeal + 1) },
                        { cmd: 'getEnergy', cnt: fhero.energy == 0 && smn.isTalent ? 2 : 1 }
                    ]
                }
            }
        })),

    115011: (isTalent: boolean = false) => new SummonBuilder('大型风灵').useCnt(3).damage(2).talent(isTalent)
        .description(`{defaultAtk。}；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)${isTalent ? '；此召唤物在场时：如果此牌的元素已转换，则使我方造成的此类元素伤害+1。' : ''}`)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9ed867751e0b4cbb697279969593a81c_1968548064764444761.png')
        .handle((summon, event) => {
            const { trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            const changeElTrg = ELEMENT_TYPE[summon.element] + '-dmg' as Trigger;
            if (summon.element == ELEMENT_TYPE.Anemo) triggers.push('elReaction-Anemo');
            const isTalent = summon.isTalent && summon.element != ELEMENT_TYPE.Anemo && trigger == changeElTrg;
            if (isTalent) triggers.push(changeElTrg);
            return {
                trigger: triggers,
                isNotAddTask: isTalent || trigger.startsWith('elReaction-Anemo'),
                addDmgCdt: isCdt(isTalent, 1),
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger.startsWith('elReaction-Anemo:') && smn.element == ELEMENT_TYPE.Anemo) {
                        const element = ELEMENT_TYPE[trigger.slice(trigger.indexOf(':') + 1) as ElementType];
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                }
            }
        }),

    115021: () => new SummonBuilder('蒲公英领域').useCnt(2).damage(1).damage(2, 'v4.2.0').heal(1)
        .description('{defaultAtk，治疗我方出战角色{shield}点。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/13c4609aff96cf57ad218ddf954ecc08_1272742665837129862.png')
        .handle((summon, event) => {
            const { heros = [], trigger = '' } = event;
            const isTalent = !!getObjById(heros, getHidById(summon.id))?.talentSlot;
            return {
                trigger: ['phase-end', 'Anemo-dmg'],
                isNotAddTask: trigger == 'Anemo-dmg',
                addDmgCdt: isCdt(isTalent, 1),
                exec: execEvent => {
                    if (trigger == 'Anemo-dmg') return;
                    return phaseEndAtk(execEvent?.summon ?? summon);
                }
            }
        }),

    115034: () => new SummonBuilder('暴风之眼').useCnt(2).damage(2)
        .description('{defaultAtk，对方切换到[距离我方出战角色最近的角色]。}；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/b0b8a8e9a43548bc39fceba101ea0ab6_1760632395524982528.png')
        .handle((summon, event) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == ELEMENT_TYPE.Anemo) triggers.push('elReaction-Anemo');
            return {
                trigger: triggers,
                isNotAddTask: trigger.startsWith('elReaction-Anemo'),
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') {
                        smn.useCnt = Math.max(0, smn.useCnt - 1);
                        return { cmds: [{ cmd: 'attack' }, { cmd: 'switch-to', hidxs: [getNearestHidx(hidx, heros)], isOppo: true }] };
                    }
                    if (trigger.startsWith('elReaction-Anemo:') && smn.element == ELEMENT_TYPE.Anemo) {
                        const element = ELEMENT_TYPE[trigger.slice(trigger.indexOf(':') + 1) as ElementType];
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                }
            }
        }),

    115052: () => new SummonBuilder('流风秋野').useCnt(3).damage(1)
        .description('{defaultAtk。}；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/8296c70266ae557b635c27b20e2fd615_5814665570399175790.png')
        .handle((summon, event) => {
            const { trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == ELEMENT_TYPE.Anemo) triggers.push('elReaction-Anemo');
            return {
                trigger: triggers,
                isNotAddTask: trigger.startsWith('elReaction-Anemo'),
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger.startsWith('elReaction-Anemo:') && smn.element == ELEMENT_TYPE.Anemo) {
                        const element = ELEMENT_TYPE[trigger.slice(trigger.indexOf(':') + 1) as ElementType];
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                }
            }
        }),

    115072: () => new SummonBuilder('不倒貉貉').useCnt(2).damage(1).heal(2)
        .description('{defaultAtk，治疗我方受伤最多的角色{shield}点。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/e78e66eddfb70ab60a6f4d3733a8c3ab_4021248491292359775.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { heros = [] } = event;
                const { summon: smn = summon } = execEvent;
                return phaseEndAtk(smn, getMaxHertHidxs(heros));
            }
        })),

    115082: () => new SummonBuilder('惊奇猫猫盒').useCnt(2).damage(1).spReset()
        .description('{defaultAtk。}；【当此召唤物在场，我方出战角色受到伤害时：】抵消1点伤害。(每回合1次)；【我方角色受到‹1冰›/‹2水›/‹3火›/‹4雷›元素伤害时：】转换此牌的元素类型，改为造成所受到的元素类型的伤害。(离场前仅限一次)')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/18e98a957a314ade3c2f0722db5a36fe_4019045966791621132.png')
        .handle((summon, event) => {
            const { reset = false, trigger = '' } = event;
            if (reset) return { trigger: ['enter'], rCombatStatus: 115083 }
            const getdmgTrgs: Trigger[] = ['Hydro-getdmg', 'Pyro-getdmg', 'Electro-getdmg', 'Cryo-getdmg'];
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == ELEMENT_TYPE.Anemo && getdmgTrgs.includes(trigger)) {
                triggers.push(trigger);
            }
            return {
                trigger: triggers,
                isNotAddTask: trigger.includes('-getdmg'),
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger.includes('-getdmg') && smn.element == ELEMENT_TYPE.Anemo) {
                        const element = ELEMENT_TYPE[trigger.slice(0, trigger.indexOf('-getdmg')) as ElementType];
                        return { cmds: [{ cmd: 'changeElement', element }] };
                    }
                },
            }
        }),

    115093: (isTalent: boolean = false) => new SummonBuilder('赫耀多方面体').useCnt(3).damage(1).talent(isTalent)
        .description('{defaultAtk。}；【此召唤物在场时：】敌方角色受到的[风元素伤害]+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/d51fd00a7e640ba13b62315e5184be58_168888966568961527.png')
        .handle((summon, event) => {
            const { trigger = '' } = event;
            const triggers: Trigger[] = ['Anemo-getdmg-oppo', 'phase-end'];
            if (summon.isTalent) triggers.push('phase-start', 'enter');
            return {
                addDmgCdt: 1,
                isNotAddTask: trigger == 'Anemo-getdmg-oppo',
                trigger: triggers,
                exec: execEvent => {
                    if (trigger == 'phase-end') return phaseEndAtk(execEvent?.summon ?? summon);
                    if (['phase-start', 'enter'].includes(trigger)) return { cmds: [{ cmd: 'getDice', cnt: 1, element: ELEMENT_TYPE.Anemo }] }
                },
            }
        }),

    116031: () => new SummonBuilder('岩脊').useCnt(2).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/251c5e32d6cbdfb4c4d0e14e7088ab67_7008401766526335309.png'),

    116041: () => new SummonBuilder('阳华').useCnt(3).damage(1).perCnt(1)
        .description('{defaultAtk。}；【此召唤物在场，我方执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。(每回合1次)')
        .description('{defaultAtk。}；【此召唤物在场时：】我方角色进行[下落攻击]时少花费1个[无色元素骰]。(每回合1次)', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/5e2b48f4db9bfae76d4ab9400f535b4f_1116777827962231889.png')
        .handle((summon, event, ver) => {
            const { heros = [], isFallAtk = false, isMinusDiceSkill, trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            let minusDiceCdt = isFallAtk;
            if (ver < 'v4.8.0') {
                triggers.push('skilltype1');
                minusDiceCdt &&= summon.perCnt > 0;
            } else {
                triggers.push('change-from');
                minusDiceCdt &&= !!getObjById(heros, getHidById(summon.id))?.talentSlot;
            }
            return {
                minusDiceSkill: isCdt(minusDiceCdt, { skilltype1: [0, 1, 0] }),
                isNotAddTask: trigger != 'phase-end',
                trigger: triggers,
                isQuickAction: ver >= 'v4.8.0' && summon.perCnt > 0,
                exec: execEvent => {
                    const { summon: smn = summon, isQuickAction = false } = execEvent;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger == 'skilltype1' && isMinusDiceSkill) --smn.perCnt;
                    if (trigger == 'change-from' && isQuickAction) --smn.perCnt;
                }
            }
        }),

    116051: () => new SummonBuilder('阿丑').useCnt(1).damage(1).shield(1).perCnt(1).statusId().roundEnd()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【此召唤物在场期间可触发1次：】我方角色受到伤害后，为【hro】附属【sts116054】。；【结束阶段：】弃置此牌，{dealDmg}。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/9beb8c255664a152c8e9ca35697c7d9e_263220232522666772.png')
        .handle((summon, event) => {
            const { heros = [], trigger = '' } = event;
            const hero = getObjById(heros, getHidById(summon.id));
            return {
                trigger: ['phase-end', 'getdmg'],
                isNotAddTask: trigger == 'getdmg',
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (smn.perCnt <= 0 || trigger != 'getdmg' || hero?.hidx == undefined || hero.hp <= 0) return;
                    --smn.perCnt;
                    return { cmds: [{ cmd: 'getStatus', status: 116054, hidxs: [hero.hidx] }] }
                },
            }
        }),

    116062: () => new SummonBuilder('大将威仪').useCnt(2).damage(1)
        .description('{defaultAtk。；如果队伍中存在2名‹6岩元素›角色，则生成【sts111】。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/669b37ae522405031419cd14f6e8daf0_5829987868413544081.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { cmds = [] } = phaseEndAtk(execEvent?.summon ?? summon);
                const { heros = [] } = event;
                if (heros.filter(h => h.element == ELEMENT_TYPE.Geo).length >= 2) {
                    cmds.push({ cmd: 'getStatus', status: 111 })
                }
                return { cmds }
            }
        })),

    116082: () => new SummonBuilder('金花礼炮').useCnt(2).damage(1)
        .description('{defaultAtk，摸1张【crd116081】。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/ca1b1317e66c9b1092afa2a516dddcd4_5204752880345309322.png')
        .handle(summon => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { summon: smn = summon } = execEvent;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                return { cmds: [{ cmd: 'attack' }, { cmd: 'getCard', cnt: 1, card: 116081, isAttach: true }] }
            }
        })),

    117011: () => new SummonBuilder('柯里安巴').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/4562f5108720b7a6048440a1b86c963d_9140007412773415051.png'),

    117022: () => new SummonBuilder('藏蕴花矢').useCnt(1).maxUse(2).damage(1).description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/dc8e548704ca0e52d1c6669fac469b3d_5168805556784249785.png'),

    117041: (isTalent: boolean = false) => new SummonBuilder('月桂·抛掷型').useCnt(2).damage(1).heal(1).talent(isTalent)
        .description(`{defaultAtk，治疗我方受伤最多的角色{shield}点。${isTalent ? '；如果可用次数仅剩余1，则此效果造成的伤害和治疗各+1。' : ''}}`)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/7bc79d56afd059a2f88d45ae0c500923_7487275599868058123.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { heros = [] } = event;
                const { summon: smn = summon } = execEvent;
                const isLast = smn.isTalent && smn.useCnt == 1;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                const cmds: Cmds[] = [{ cmd: 'attack', cnt: isCdt(isLast, smn.damage + 1) }];
                const hidxs = getMaxHertHidxs(heros);
                if (hidxs.length > 0) cmds.push({ cmd: 'heal', cnt: isCdt(isLast, smn.shieldOrHeal + 1), hidxs });
                return { cmds }
            }
        })),

    117051: () => new SummonBuilder('游丝徵灵').useCnt(1).damage(1).heal(1)
        .description('{defaultAtk，治疗我方出战角色{shield}点。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/42b6402e196eec814b923ac88b2ec3e6_7208177288974921556.png'),

    121011: () => new SummonBuilder('冰萤').useCnt(2).maxUse(3).damage(1)
        .description('{defaultAtk。}；【〖hro〗｢普通攻击｣后：】此牌[可用次数]+1。；【〖hro〗受到元素反应伤害后：】此牌[可用次数]-1。')
        .description('{defaultAtk。}；【〖hro〗｢普通攻击｣后：】此牌[可用次数]+1。；【我方角色受到元素反应伤害后：】此牌[可用次数]-1。', 'v4.1.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/e98436c034423b951fb726977b37f6b1_915982547283319448.png')
        .handle((summon, event, ver) => {
            const { trigger = '', heros = [], talent, isExec = true } = event;
            const triggers: Trigger[] = ['phase-end'];
            const hero = heros[getAtkHidx(heros)];
            if (!hero) return;
            const isHero = hero?.id == getHidById(summon.id);
            const isTalent = isHero && talent && talent.perCnt == -1;
            if (ver < 'v4.1.0' || isHero) triggers.push('get-elReaction');
            if (!isExec && trigger == 'get-elReaction' && (ver < 'v4.1.0' || isHero)) {
                summon.useCnt = Math.max(0, summon.useCnt - 1);
            }
            const isTalentTrg = ['after-skilltype1', 'after-skilltype2'].includes(trigger);
            if (isHero) {
                triggers.push('skilltype1');
                if (isTalent && isTalentTrg) {
                    triggers.push(trigger);
                }
                if (!isExec && trigger == 'after-skilltype1') {
                    summon.useCnt = Math.max(summon.useCnt, Math.min(summon.maxUse, summon.useCnt + 1));
                }
            }
            return {
                trigger: triggers,
                damage: isCdt(isTalent, 2),
                element: summon.element,
                isNotAddTask: !isTalent && trigger != 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (isTalent || trigger.includes('skilltype1')) {
                        smn.useCnt = Math.max(smn.useCnt, Math.min(smn.maxUse, smn.useCnt + 1));
                        if (isTalent && isTalentTrg) {
                            talent.perCnt = 0;
                            return { cmds: [{ cmd: 'attack', cnt: 2 }] }
                        }
                        return;
                    }
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    if (trigger == 'phase-end') return { cmds: [{ cmd: 'attack' }] }
                }
            }
        }),

    121033: () => new SummonBuilder('刺击冰棱').useCnt(2).damage(1)
        .description('{对敌方[距离我方出战角色最近的角色]defaultAtk}。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/7becac09916614d57a2f084749634d5d_3605800251898465783.png')
        .handle((summon, event) => ({
            trigger: ['phase-end'],
            exec: execEvent => {
                const { hidx = -1, eheros = [] } = event;
                const { summon: smn = summon } = execEvent;
                smn.useCnt = Math.max(0, smn.useCnt - 1);
                return { cmds: [{ cmd: 'attack', hidxs: [getNearestHidx(hidx, eheros)] }] }
            }
        })),

    122011: () => new SummonBuilder('纯水幻形·花鼠').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9c9ed1587353d9e563a2dee53ffb0e2a_5326741860473626981.png')
        .handle((summon, event, ver) => ({
            willSummon: isCdt([22012, 22013].includes(event.skid ?? -1), newSummon(ver)(122011)),
            trigger: ['phase-end'],
            exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
        })),

    122012: () => new SummonBuilder('纯水幻形·飞鸢').useCnt(3).damage(1).description('{defaultAtk。}')
        .src('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_CardFace_Summon_Raptor.webp')
        .handle((summon, event, ver) => ({
            willSummon: isCdt([22012, 22013].includes(event.skid ?? -1), newSummon(ver)(122011)),
            trigger: ['phase-end'],
            exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
        })),

    122013: () => new SummonBuilder('纯水幻形·蛙').useCnt(1).useCnt(2, 'v4.3.0').damage(2).shield(1).usedRoundEnd().statusId()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以{dealDmg}。')
        .src('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_CardFace_Summon_Frog.webp')
        .handle((summon, event, ver) => {
            const trigger: Trigger[] = [];
            if (summon.useCnt == 0) trigger.push('phase-end');
            return {
                willSummon: isCdt([22012, 22013].includes(event.skid ?? -1), newSummon(ver)(122011)),
                trigger,
                exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
            }
        }),

    122043: (dmg: number = -1, useCnt: number = -1) => new SummonBuilder('黑色幻影').useCnt(useCnt).damage(dmg).electro().statusId()
        .description('【入场时：】获得我方已吞噬卡牌中最高元素骰费用值的｢攻击力｣，获得该费用的已吞噬卡牌数量的[可用次数]。；【结束阶段和我方宣布结束时：】造成此牌｢攻击力｣值的[雷元素伤害]。；【我方出战角色受到伤害时：】抵消1点伤害，然后此牌[可用次数]-2。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/71d21daf1689d58b7b86691b894a1d2c_6622906347878958966.png')
        .handle(summon => ({
            trigger: ['phase-end', 'end-phase'],
            exec: execEvent => phaseEndAtk(execEvent.summon ?? summon),
        })),

    123021: () => new SummonBuilder('黯火炉心').useCnt(2).damage(1).pdmg(1)
        .description('{defaultAtk，对所有敌方后台角色造成1点[穿透伤害]。}')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/68087eeb0ffed52029a7ad3220eb04db_2391994745432576824.png'),

    123031: (isTalent: boolean = false) => new SummonBuilder('厄灵·炎之魔蝎').useCnt(2).damage(1).plus(isTalent).talent(isTalent)
        .description(`{defaultAtk${isTalent ? '; 如果本回合中【hro】使用过｢普通攻击｣或｢元素战技｣，则此伤害+1' : ''}。}；【入场时和行动阶段开始：】使我方【hro】附属【sts123033】。(【smn123031】在场时每回合至多${isTalent ? 2 : 1}次，使角色受到的伤害-1。)`)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/8bb20558ca4a0f53569eb23a7547bdff_6164361177759522363.png')
        .handle((summon, event, ver) => {
            const { heros = [], trigger = '' } = event;
            const hidx = getObjIdxById(heros, getHidById(summon.id));
            return {
                trigger: ['phase-end', 'phase-start'],
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    const hero = heros[hidx];
                    if (trigger == 'phase-end') {
                        smn.useCnt = Math.max(0, smn.useCnt - 1);
                        let addDmg = 0;
                        if (hero.hp > 0) {
                            addDmg = +(smn.isTalent && hero.skills.some(sk => (sk.type == SKILL_TYPE.Normal || sk.type == SKILL_TYPE.Elemental) && sk.useCnt > 0));
                        }
                        return { cmds: [{ cmd: 'attack', cnt: smn.damage + addDmg }] }
                    }
                    if (trigger == 'phase-start' && hero.hp > 0) {
                        return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(123033, smn.isTalent ? 2 : 1)], hidxs: [hidx] }] }
                    }
                },
            }
        }),

    124013: () => new SummonBuilder('雷锁镇域').useCnt(2).damage(1).perCnt(1)
        .description('{defaultAtk。}；【此召唤物在场时：】敌方执行｢切换角色｣行动的元素骰费用+1。(每回合1次)')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/8df8ffcdace3033ced5ccedc1dc7da68_5001323349681512527.png')
        .handle((summon, event) => {
            const { trigger = '' } = event;
            return {
                addDiceHero: summon.perCnt,
                isNotAddTask: trigger != 'phase-end',
                trigger: ['phase-end', 'change-oppo'],
                exec: execEvent => {
                    const { summon: smn = summon, switchHeroDiceCnt = 0 } = execEvent;
                    if (trigger == 'phase-end') return phaseEndAtk(smn);
                    if (trigger == 'change-oppo' && smn.perCnt > 0) {
                        --smn.perCnt;
                        return { switchHeroDiceCnt: switchHeroDiceCnt + 1 }
                    }
                    return { switchHeroDiceCnt }
                }
            }
        }),

    124023: () => new SummonBuilder('轰雷禁锢').useCnt(1).damage(3)
        .description('【结束阶段：】对附属【sts124022】的敌方角色{dealDmg}。(如果敌方不存在符合条件角色，则改为对出战角色造成伤害)；[useCnt]')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/552ec062eef427f9a1986f92ee19c716_8843394885297317371.png')
        .handle((summon, event) => {
            const { eheros = [] } = event;
            const sts124022Idx = eheros.findIndex(h => hasObjById(h.heroStatus, 124022));
            const hidxs = isCdt(sts124022Idx > -1, [sts124022Idx]);
            return {
                trigger: ['phase-end'],
                exec: () => {
                    summon.useCnt = Math.max(0, summon.useCnt - 1);
                    return { cmds: [{ cmd: 'attack', hidxs }] }
                },
            }
        }),

    124031: () => new SummonBuilder('共鸣珊瑚珠').useCnt(2).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/5776f31ac915874cb7eadd77a0098839_1777069343038822943.png'),

    124041: () => new SummonBuilder('雷萤').useCnt(3).damage(1)
        .description('{defaultAtk；【敌方累积打出3张行动牌后：】此牌[可用次数]+1。(最多叠加到3)；【〖hro〗受到元素反应伤害后：】此牌[可用次数]-1。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/b49d5bd6e23362e65f2819b62c1752f6_652290106975576928.png')
        .handle((summon, event) => {
            const { trigger = '', heros = [], isExec = true } = event;
            const triggers: Trigger[] = ['phase-end'];
            const hero = getObjById(heros, getHidById(summon.id));
            if (hero?.isFront) {
                triggers.push('get-elReaction');
                if (!isExec && trigger == 'get-elReaction') {
                    summon.useCnt = Math.max(0, summon.useCnt - 1);
                }
            }
            if ((hero?.talentSlot?.perCnt ?? 0) > 0 && summon.useCnt >= 3) triggers.push('action-start');
            return {
                trigger: triggers,
                damage: summon.damage,
                element: summon.element,
                isNotAddTask: trigger == 'get-elReaction',
                exec: execEvent => {
                    const { summon: smn = summon, heros: hrs = heros, eCombatStatus = [] } = execEvent;
                    smn.useCnt = Math.max(0, smn.useCnt - 1);
                    if (smn.useCnt == 0) {
                        const sts124044 = getObjIdxById(eCombatStatus, 124044) ?? -1;
                        if (sts124044 > -1) eCombatStatus.splice(sts124044, 1);
                    }
                    if (trigger == 'get-elReaction') return;
                    const chero = getObjById(hrs, getHidById(smn.id));
                    if (trigger == 'action-start' && chero?.talentSlot) --chero.talentSlot.perCnt;
                    return { cmds: [{ cmd: 'attack' }] }
                }
            }
        }),

    125011: () => new SummonBuilder('剑影·孤风').useCnt(2).damage(1)
        .description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/90767acfd11dc25ae46a333557b3ee2a_4658043205818200753.png')
        .handle((summon, event) => {
            const { trigger = '', heros = [], isExecTask = false } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (getObjById(heros, getHidById(summon.id))?.isFront || isExecTask) triggers.push('after-skilltype3')
            return {
                trigger: triggers,
                damage: summon.damage,
                element: summon.element,
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack' }] }
                },
            }
        }),

    125012: () => new SummonBuilder('剑影·霜驰').useCnt(2).damage(1).cryo()
        .description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3f77ab65d8d940df9b3cf70d96ae0b25_8204101439924542003.png')
        .handle((summon, event) => {
            const { trigger = '', heros = [], isExecTask = false } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (getObjById(heros, getHidById(summon.id))?.isFront || isExecTask) triggers.push('after-skilltype3')
            return {
                trigger: triggers,
                damage: summon.damage,
                element: summon.element,
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') smn.useCnt = Math.max(0, smn.useCnt - 1);
                    return { cmds: [{ cmd: 'attack' }] }
                },
            }
        }),

    127022: () => crd12702summon(),

    127023: () => crd12702summon(),

    127024: () => crd12702summon(),

    127025: () => crd12702summon(),

    302201: (src: string) => new SummonBuilder('愤怒的太郎丸').useCnt(2).damage(2).physical().description('{defaultAtk。}').src(src),

    303211: () => new SummonBuilder('冰箭丘丘人').useCnt(2).damage(1).cryo().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/ba55e6e19d419b16ec763dfcfb655834_213836850123099432.png'),

    303212: () => new SummonBuilder('水丘丘萨满').useCnt(2).damage(1).hydro().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/1fc573971ff6d8a6ede47f966be9a6a9_2274801154807218394.png'),

    303213: () => new SummonBuilder('冲锋丘丘人').useCnt(2).damage(1).pyro().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/b2751af5c3dddc5a4bf7909bd2382adc_8142471467728886523.png'),

    303214: () => new SummonBuilder('雷箭丘丘人').useCnt(2).damage(1).electro().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/084fbb351267f4a6eb5b4eb167cebe51_7018603863032841385.png'),

}

export const newSummon = (version?: Version) => (id: number, ...args: any) => summonTotal[id](...args).id(id).version(version).done();