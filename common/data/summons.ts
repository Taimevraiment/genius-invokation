
import { Card, Hero, MinusDiceSkill, Status, Summon, Trigger } from "../../typing";
import { DAMAGE_TYPE, ELEMENT_TYPE, ElementType, SKILL_TYPE, SUMMON_TAG, VERSION, Version } from "../constant/enum.js";
import { MAX_USE_COUNT } from "../constant/gameOption.js";
import { ELEMENT_URL, STATUS_ICON } from "../constant/UIconst.js";
import CmdsGenerator from "../utils/cmdsGenerator.js";
import { allHidxs, getBackHidxs, getDerivantParentId, getFrontHidx, getHidById, getMaxHertHidxs, getMinHertHidxs, getNearestHidx, getNextBackHidx, getObjById, getObjIdxById, hasObjById } from "../utils/gameUtil.js";
import { isCdt } from "../utils/utils.js";
import { SummonBuilder } from "./builder/summonBuilder.js";

export type SummonHandleEvent = {
    trigger?: Trigger,
    heros?: Hero[],
    combatStatus?: Status[],
    summons?: Summon[],
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
    isSummon?: number,
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
    dmgedHidx?: number,
    atkHidx?: number,
    getdmg?: number[],
}

export type SummonHandleRes = {
    triggers?: Trigger[],
    addDmg?: number,
    addDmgType1?: number,
    addDmgType2?: number,
    addDmgType3?: number,
    addDmgCdt?: number,
    addPdmg?: number,
    rCombatStatus?: (number | [number, ...any])[] | number,
    isNotAddTask?: boolean,
    element?: ElementType,
    pdmg?: number,
    hidxs?: number[],
    addDiceHero?: number,
    minusDiceHero?: number,
    minusDiceCard?: number,
    minusDiceSkill?: MinusDiceSkill,
    tround?: number,
    willSummon?: number,
    isQuickAction?: boolean,
    isTrigger?: boolean,
    exec?: (event: SummonExecEvent) => SummonExecRes | void,
}

export type SummonExecEvent = {
    summon?: Summon,
    heros?: Hero[],
    eheros?: Hero[],
    combatStatus?: Status[],
    eCombatStatus?: Status[],
}

export type SummonExecRes = {
    cmds?: CmdsGenerator,
}

const crd12702summon = () => {
    return new SummonBuilder('增殖生命体').useCnt(1).damage(1)
        .description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/5c6f5f310243aea5eff849b26dd80269_2475050287145431617.png');
}


const allSummons: Record<number, (...args: any) => SummonBuilder> = {

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

    111062: () => new SummonBuilder('光降之剑').maxUse(MAX_USE_COUNT).damage(3).damage(2, 'v3.8.0').physical().collection().plus().roundEnd()
        .description('【〖hro〗使用「普通攻击」或「元素战技」时：】此牌累积2点「能量层数」，但是【hro1106】不会获得[充能]。；【结束阶段：】弃置此牌。{dealDmg}\\；每有1点「能量层数」，都使次伤害+1。（影响此牌「[可用次数]」的效果会作用于「能量层数」。）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/a475346a830d9b62d189dc9267b35a7a_4963009310206732642.png')
        .handle((summon, event) => {
            const { heros, talent, isExec = true, trigger = '' } = event;
            const hero = getObjById(heros, getHidById(summon.id));
            if (['enter', 'summon-destroy'].includes(trigger)) {
                hero?.skills.forEach(skill => {
                    if (skill.type == SKILL_TYPE.Normal || skill.type == SKILL_TYPE.Elemental) {
                        skill.cost[2].cnt = trigger == 'enter' ? -1 : 0;
                    }
                });
                return;
            }
            if (hero?.isFront && !isExec && ['skilltype1', 'skilltype2'].includes(trigger)) {
                summon.addUseCnt(!!talent && trigger == 'skilltype2' ? 3 : 2);
            }
            return {
                triggers: ['phase-end', 'skilltype1', 'skilltype2'],
                isNotAddTask: trigger != 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') cmds.attack(smn.damage + smn.useCnt);
                    else if (hero?.isFront) smn.addUseCnt(!!talent && trigger == 'skilltype2' ? 3 : 2);
                },
            }
        }),

    111073: () => new SummonBuilder('箓灵').useCnt(2).damage(1)
        .description('{defaultAtk。}；【召唤物在场时：】敌方角色受到的[冰元素伤害]和[物理伤害]+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/7deee3f26916cf28fd145b110f81d852_4270139379454156566.png')
        .handle((_, event) => ({
            addDmgCdt: 1,
            isNotAddTask: event.trigger != 'phase-end',
            triggers: ['Cryo-getdmg-oppo', 'Physical-getdmg-oppo', 'phase-end'],
            isOnlyPhaseEnd: true,
        })),

    111081: () => new SummonBuilder('寒病鬼差').useCnt(3).perCnt(1).perCnt(0, 'v4.7.0').damage(1)
        .description('{defaultAtk。}；【此召唤物在场时，〖hro〗使用「普通攻击」后：】治疗受伤最多的我方角色1点\\；【每回合1次：】再治疗我方出战角色1点。')
        .description('{defaultAtk。}；【此召唤物在场时，〖hro〗使用「普通攻击」后：】治疗受伤最多的我方角色1点。', 'v4.7.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/16/12109492/f9ea7576630eb5a8c46aae9ea8f61c7b_317750933065064305.png')
        .handle((summon, event, ver) => {
            const { heros = [], atkHidx = -1, trigger, tround = 0 } = event;
            const triggers: Trigger[] = ['phase-end'];
            const hidxs = getMaxHertHidxs(heros);
            const fhero = heros[atkHidx];
            const isHeal = fhero?.id == getHidById(summon.id) && trigger == 'after-skilltype1' && hidxs.length > 0;
            const hasTround = ver.gte('v4.7.0') && trigger == 'after-skilltype1' && tround == 0 && summon.perCnt > 0 && fhero.hp < fhero.maxHp;
            if (isHeal) triggers.push('after-skilltype1');
            return {
                triggers,
                tround: isCdt(hasTround, 1),
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (tround == 1) {
                        smn.minusPerCnt();
                        return cmds.heal(1).res;
                    }
                    if (trigger == 'after-skilltype1') return cmds.heal(1, { hidxs }).res;
                    if (trigger == 'phase-end') smn.phaseEndAtk(event, cmds);
                },
            }
        }),

    111093: () => new SummonBuilder('饰梦天球').useCnt(2).damage(1)
        .description('{defaultAtk。如果【sts111092】在场，则使其累积1枚「晚星」。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/1b86f1cb97411b77d51cc22bb5622ff7_2462971599599504312.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, combatStatus, cmds } = execEvent;
                getObjById(combatStatus, 111092)?.addUseCnt();
                smn.phaseEndAtk(event, cmds);
            }
        })),

    111102: () => new SummonBuilder('临事场域').useCnt(2).damage(1).heal(1)
        .description('{defaultAtk，治疗我方出战角色{shield}点。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/a4249ebb8a68e2843cdd2fa78937912c_2796631322062911422.png'),

    111132: () => new SummonBuilder('极寒的冰枪').useCnt(2).damage(1)
        .description('{defaultAtk，生成2层【sts111131】。}')
        .description('{defaultAtk，生成1层【sts111131】。}', 'v5.3.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/722c71c78b82483790cadd1b0f620f83_4380247943885927570.png')
        .handle((summon, event, ver) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds).getStatus([[111131, isCdt(ver.lt('v5.3.0'), 1)]]);
            }
        })),

    112011: () => new SummonBuilder('歌声之环').useCnt(2).heal(1)
        .description('【结束阶段：】治疗所有我方角色{shield}点，然后对我方出战角色[附着水元素]。；[useCnt]')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/d406a937bb6794a26ac46bf1fc9cfe3b_7906063991052689263.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds, allHidxs(event.heros)).attach();
            },
        })),

    112031: () => new SummonBuilder('虚影').useCnt(1).damage(1).shield(1).statusId().roundEnd()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【结束阶段：】弃置此牌，{dealDmg}。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/098f3edd0f9ac347a9424c6417de6987_7446453175998729325.png'),

    112051: (useCnt: number = 2) => new SummonBuilder('化海月').useCnt(useCnt).maxUse(4).maxUse(2, 'v5.3.0').damage(1).heal(1)
        .description('【结束阶段：】{dealDmg}，治疗我方出战角色{shield}点。；[useCnt]')
        .description('【结束阶段：】{dealDmg}，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】', 'v5.3.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/4608304a2a01f7f33b59b731543a761b_3713077215425832494.png'),

    112062: () => new SummonBuilder('清净之园囿').useCnt(2).damage(2)
        .description('{defaultAtk。}；【此召唤物在场时：】我方角色「普通攻击」造成的伤害+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/ef32ccb60a38cb7bfa31372dd5953970_1908841666370199656.png')
        .handle((_, event) => ({
            addDmgType1: 1,
            triggers: ['phase-end', 'skilltype1'],
            isNotAddTask: event.trigger == 'skilltype1',
            isOnlyPhaseEnd: true,
        })),

    112082: () => new SummonBuilder('丰穰之核').useCnt(1).maxUse(3).damage(2).dendro()
        .description('{defaultAtk。}；【我方宣布结束时：】如果此牌的[可用次数]至少为2，则造成2点[草元素伤害]。（需消耗[可用次数]）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/865915f8734cdc641df43198eb728497_5603461429712047360.png')
        .handle(summon => {
            const triggers: Trigger[] = ['phase-end'];
            if (summon.useCnt >= 2) triggers.push('end-phase');
            return { triggers }
        }),

    112111: (useCnt: number = 2) => new SummonBuilder('沙龙成员').useCnt(useCnt).maxUse(4).damage(1)
        .description('{defaultAtk。如果我方存在生命值至少为6的角色，则对一位受伤最少的我方角色造成1点[穿透伤害]，然后再造成1点[水元素伤害]。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/8cfed9e54e85d3bd44fc7e7e3aa9564a_6917287984925848695.png')
        .handle((summon, event) => {
            const { tround = 0, heros = [] } = event;
            const hasTround = tround == 0 && heros.some(h => h.hp >= 6);
            return {
                triggers: 'phase-end',
                tround: isCdt(hasTround, 1),
                exec: execEvent => {
                    const { summon: smn = summon, heros: hs = heros, cmds } = execEvent;
                    if (!hasTround) smn.phaseEndAtk(event, cmds).clear();
                    cmds.attack();
                    if (tround == 0) return;
                    cmds.attack(1, DAMAGE_TYPE.Pierce, { hidxs: getMinHertHidxs(hs), isOppo: false });
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
                triggers: 'phase-end',
                tround: isCdt(hasTround, 1),
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (!hasTround) smn.phaseEndAtk(event, cmds).clear();
                    cmds.smnHeal({ hidxs: allHidxs(heros) });
                    if (tround == 0) return;
                    cmds.clear().smnHeal({ hidxs: getMaxHertHidxs(heros) });
                },
            }
        }),

    112144: () => new SummonBuilder('鲨鲨飞弹').useCnt(2).maxUse(MAX_USE_COUNT).damage(2).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/2cac5c299862a3ba055935093fd9baa1_2832493176442019382.png'),

    113021: () => new SummonBuilder('锅巴').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/19b63677c8f4e6cabed15711be406e09_2795447472820195792.png'),

    113041: () => new SummonBuilder('兔兔伯爵').useCnt(1).shield(2).damage(2).usedRoundEnd().statusId()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以{dealDmg}。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/6864ff4d13f55e24080152f88fef542f_1635591582740112856.png')
        .handle((summon, event, ver) => {
            const { heros = [], atkHidx = -1, talent, trigger, isExec = true } = event;
            const triggers: Trigger[] = [];
            if (summon.useCnt == 0) triggers.push('phase-end');
            const hero = heros[atkHidx];
            const cnt = isCdt(hero?.id == getHidById(summon.id) && trigger == 'after-skilltype1' && !!talent, ver.lt('v4.2.0') && !ver.isOffline ? 3 : 4);
            if (cnt) triggers.push('after-skilltype1');
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (!isExec) smn.useCnt = -100;
                    else if (trigger == 'after-skilltype1') smn.dispose();
                    cmds.attack(cnt);
                },
            }
        }),

    113093: () => new SummonBuilder('净焰剑狱领域').useCnt(3).damage(1).spReset()
        .description('{defaultAtk。}；【当此召唤物在场且〖hro〗在我方后台，我方出战角色受到伤害时：】抵消1点伤害\\；然后，如果【hro】生命值至少为7，则对其造成1点[穿透伤害]。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/5fe195423d5308573221c9d25f08d6d7_2012000078881285374.png')
        .handle((_, event) => {
            if (event.reset) return { triggers: 'enter', rCombatStatus: 113094 }
            return { triggers: 'phase-end' }
        }),

    113101: () => new SummonBuilder('怪笑猫猫帽').useCnt(1).maxUse(2).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/27885c0d6d1bd4ae42ea0d69d357198d_8888407409706694377.png'),

    114011: (isTalent: boolean = false) => new SummonBuilder('奥兹').useCnt(2).damage(1).talent(isTalent)
        .description(`{defaultAtk。}${isTalent ? '；【hro】「普通攻击」后：造成2点[雷元素伤害]。（需消耗[可用次数]）' : ''}`)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/ea0ab20ac46c334e1afd6483b28bb901_2978591195898491598.png')
        .handle((summon, event) => {
            const { heros = [], trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            const cnt = isCdt(trigger != 'phase-end', 2);
            if (getObjById(heros, getHidById(summon.id))?.isFront && summon.isTalent) {
                triggers.push('after-skilltype1');
            }
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    smn.phaseEndAtk(event, cmds).clear().attack(cnt);
                },
            }
        }),

    114061: () => new SummonBuilder('天狗咒雷·伏').useCnt(1).damage(1)
        .description('{defaultAtk，我方出战角色附属【sts114063】。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/aef9cba89ecb16fa0d73ffef53cad44e_6822516960472237055.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds).getStatus(114063);
            }
        })),

    114062: () => new SummonBuilder('天狗咒雷·雷砾').useCnt(2).damage(2)
        .description('{defaultAtk，我方出战角色附属【sts114063】。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/51bca1f202172ad60abbace59b96c346_7973049003331786903.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds).getStatus(114063);
            }
        })),

    114071: () => new SummonBuilder('雷罚恶曜之眼').useCnt(3).damage(1)
        .description('{defaultAtk。}；【此召唤物在场时：】我方角色「元素爆发」造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/a27cfa39a258ff4b80f01b1964e6faac_1649452858766133852.png')
        .handle(() => ({ addDmgType3: 1, triggers: 'phase-end' })),

    114081: (dmg: number = 1) => new SummonBuilder('杀生樱').useCnt(3).maxUse(6).damage(dmg)
        .description('{defaultAtk。}；【我方宣布结束时：】如果此牌的[可用次数]至少为4，则造成1点[雷元素伤害]。（需消耗[可用次数]）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/d63267f4388f521b1481a85ace6de257_3147336152102036232.png')
        .handle(summon => {
            const triggers: Trigger[] = ['phase-end'];
            if (summon.useCnt >= 4) triggers.push('end-phase');
            return { triggers }
        }),

    114092: () => new SummonBuilder('蔷薇雷光').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/0ea69a82861d8469ecdbbc78797e9fd8_3713104012683105893.png'),

    114101: () => new SummonBuilder('售后服务弹').useCnt(1).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/fe4516935ffa9eb9b193411113fa823f_372775257521707079.png'),

    114102: (isTalent: boolean = false) => new SummonBuilder('灯中幽精').useCnt(2).heal(2).talent(isTalent).plus(isTalent)
        .description(`【结束阶段：】治疗我方出战角色{shield}点，并使其获得1点[充能]。${isTalent ? '；治疗生命值不多于6的角色时，治疗量+1\\；使没有[充能]的角色获得[充能]时，获得量+1。' : ''}；[useCnt]`)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/c8209ff8f2c21e01e4e05203385410d7_8366905551575281519.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { heros = [] } = event;
                const fhero = heros.find(h => h.isFront);
                if (!fhero) return;
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds).clear()
                    .heal(isCdt(fhero.hp <= 6 && smn.isTalent, smn.shieldOrHeal + 1))
                    .getEnergy(fhero.energy == 0 && smn.isTalent ? 2 : 1);
            }
        })),

    115011: (isTalent: boolean = false) => new SummonBuilder('大型风灵').useCnt(3).damage(2).talent(isTalent)
        .description(`{defaultAtk。}；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。（离场前仅限一次）${isTalent ? '；【此召唤物在场时：】如果此牌的元素已转换，则使我方造成的此类元素伤害+1。' : ''}`)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9ed867751e0b4cbb697279969593a81c_1968548064764444761.png')
        .handle((summon, event) => {
            const { trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            const changeElTrgs = ['-dmg', '-dmg-Swirl'].map(t => ELEMENT_TYPE[summon.element] + t) as Trigger[];
            if (summon.element == ELEMENT_TYPE.Anemo) triggers.push('elReaction-Anemo');
            const isTalent = summon.isTalent && summon.element != ELEMENT_TYPE.Anemo && changeElTrgs.some(t => t == trigger);
            if (isTalent) triggers.push(...changeElTrgs);
            return {
                triggers,
                isNotAddTask: isTalent,
                addDmgCdt: isCdt(isTalent, 1),
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (trigger?.startsWith('elReaction-Anemo:') && smn.element == ELEMENT_TYPE.Anemo) {
                        smn.element = ELEMENT_TYPE[trigger.slice(trigger.indexOf(':') + 1) as ElementType];
                    }
                }
            }
        }),

    115021: () => new SummonBuilder('蒲公英领域').useCnt(3).useCnt(2, 'v5.3.0').damage(1).damage(2, 'v4.2.0').heal(1)
        .description('{defaultAtk，治疗我方出战角色{shield}点。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/13c4609aff96cf57ad218ddf954ecc08_1272742665837129862.png')
        .handle((_, event) => {
            const { talent, trigger } = event;
            return {
                triggers: ['phase-end', 'Anemo-dmg'],
                isNotAddTask: trigger == 'Anemo-dmg',
                addDmgCdt: isCdt(!!talent, 1),
                isOnlyPhaseEnd: true,
            }
        }),

    115034: () => new SummonBuilder('暴风之眼').useCnt(2).damage(2)
        .description('{defaultAtk，对方切换到[距离我方出战角色最近的角色]。}；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。（离场前仅限一次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/b0b8a8e9a43548bc39fceba101ea0ab6_1760632395524982528.png')
        .handle((summon, event) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == ELEMENT_TYPE.Anemo) triggers.push('elReaction-Anemo');
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') {
                        return smn.phaseEndAtk(event, cmds).switchTo(getNearestHidx(hidx, heros), true).res;
                    }
                    smn.changeAnemoElement(trigger);
                }
            }
        }),

    115052: () => new SummonBuilder('流风秋野').useCnt(3).damage(1)
        .description('{defaultAtk。}；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。（离场前仅限一次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/8296c70266ae557b635c27b20e2fd615_5814665570399175790.png')
        .handle((summon, event) => {
            const { trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == ELEMENT_TYPE.Anemo) triggers.push('elReaction-Anemo');
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    smn.changeAnemoElement(trigger);
                }
            }
        }),

    115072: () => new SummonBuilder('不倒貉貉').useCnt(2).damage(1).heal(2)
        .description('{defaultAtk，治疗我方受伤最多的角色{shield}点。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/e78e66eddfb70ab60a6f4d3733a8c3ab_4021248491292359775.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds, getMaxHertHidxs(event.heros));
            }
        })),

    115082: () => new SummonBuilder('惊奇猫猫盒').useCnt(2).damage(1).spReset()
        .description('{defaultAtk。}；【当此召唤物在场，我方出战角色受到伤害时：】抵消1点伤害。（每回合1次）；【我方角色受到‹1冰›/‹2水›/‹3火›/‹4雷›元素伤害时：】转换此牌的元素类型，改为造成所受到的元素类型的伤害。（离场前仅限一次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/18e98a957a314ade3c2f0722db5a36fe_4019045966791621132.png')
        .handle((summon, event) => {
            const { reset, trigger = '' } = event;
            if (reset) return { triggers: 'enter', rCombatStatus: 115083 }
            const getdmgTrgs: Trigger[] = ['Hydro-getdmg', 'Pyro-getdmg', 'Electro-getdmg', 'Cryo-getdmg'];
            const triggers: Trigger[] = ['phase-end'];
            if (summon.element == ELEMENT_TYPE.Anemo && getdmgTrgs.includes(trigger)) {
                triggers.push(trigger);
            }
            return {
                triggers,
                isNotAddTask: trigger.includes('-getdmg'),
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (trigger.includes('-getdmg') && smn.element == ELEMENT_TYPE.Anemo) {
                        smn.element = ELEMENT_TYPE[trigger.slice(0, trigger.indexOf('-getdmg')) as ElementType];
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
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (['phase-start', 'enter'].includes(trigger)) cmds.getDice(1, { element: ELEMENT_TYPE.Anemo });
                },
            }
        }),

    115143: () => new SummonBuilder('小貘').useCnt(3).icon(STATUS_ICON.Special)
        .description('【结束阶段：】生成1张【crd115142】，将其置于我方牌组顶部。；[useCnt]')
        .src('/image/tmp/UI_Gcg_CardFace_Summon_Mizuki.png')
        .handle(summon => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                cmds.addCard(1, 115142, { scope: 1 });
                smn.minusUseCnt();
            },
        })),

    116031: () => new SummonBuilder('岩脊').useCnt(2).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/251c5e32d6cbdfb4c4d0e14e7088ab67_7008401766526335309.png'),

    116041: () => new SummonBuilder('阳华').useCnt(3).damage(1).perCnt(1)
        .description('{defaultAtk。}；【此召唤物在场，我方执行「切换角色」行动时：】将此次切换视为「[快速行动]」而非「[战斗行动]」。（每回合1次）')
        .description('{defaultAtk。}；【此召唤物在场时：】我方角色进行[下落攻击]时少花费1个[无色元素骰]。（每回合1次）', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/5e2b48f4db9bfae76d4ab9400f535b4f_1116777827962231889.png')
        .handle((summon, event, ver) => {
            const { talent, isFallAtk, isMinusDiceSkill, isQuickAction, trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            let minusDiceCdt = isFallAtk;
            if (isFallAtk) triggers.push('skilltype1');
            if (ver.lt('v4.8.0') && !ver.isOffline) {
                minusDiceCdt &&= summon.perCnt > 0;
            } else {
                if (!isQuickAction && summon.perCnt > 0) triggers.push('minus-switch');
                minusDiceCdt &&= !!talent;
            }
            return {
                minusDiceSkill: isCdt(minusDiceCdt, { skilltype1: [0, 1, 0] }),
                isNotAddTask: trigger != 'phase-end',
                triggers,
                isQuickAction: trigger == 'minus-switch',
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (trigger == 'skilltype1' && isMinusDiceSkill && (ver.lt('v4.8.0') && !ver.isOffline)) smn.minusPerCnt();
                    if (trigger == 'minus-switch') smn.minusPerCnt();
                }
            }
        }),

    116051: () => new SummonBuilder('阿丑').useCnt(1).damage(1).shield(1).perCnt(1).statusId().roundEnd()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【此召唤物在场期间可触发1次：】我方角色受到伤害后，为【hro】附属【sts116054】。；【结束阶段：】弃置此牌，{dealDmg}。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/9beb8c255664a152c8e9ca35697c7d9e_263220232522666772.png')
        .handle((summon, event) => {
            const { heros, trigger } = event;
            const hero = getObjById(heros, getHidById(summon.id));
            return {
                triggers: ['phase-end', 'getdmg'],
                isNotAddTask: trigger == 'getdmg',
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (smn.perCnt <= 0 || trigger != 'getdmg' || hero?.hidx == undefined || hero.hp <= 0) return;
                    smn.minusPerCnt();
                    cmds.getStatus(116054, { hidxs: hero.hidx });
                },
            }
        }),

    116062: () => new SummonBuilder('大将威仪').useCnt(2).damage(1)
        .description('{defaultAtk。；如果队伍中存在2名‹6岩元素›角色，则生成【sts111】。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/669b37ae522405031419cd14f6e8daf0_5829987868413544081.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds);
                const { heros = [] } = event;
                if (heros.filter(h => h.element == ELEMENT_TYPE.Geo).length >= 2) {
                    cmds.getStatus(111);
                }
            }
        })),

    116082: () => new SummonBuilder('金花礼炮').useCnt(2).damage(1)
        .description('{defaultAtk，抓1张【crd116081】。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/ca1b1317e66c9b1092afa2a516dddcd4_5204752880345309322.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds).getCard(1, { card: 116081, isFromPile: true });
            }
        })),

    116091: () => new SummonBuilder('不悦挥刀之袖').useCnt(2).damage(1)
        .description('{defaultAtk。}；【此牌在场时：】我方【hro】造成的[物理伤害]变为[岩元素伤害]，且「普通攻击」造成的[岩元素伤害]+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/8c0d9573073fee39837238debd80774c_1966112146303462873.png')
        .handle((summon, event) => ({
            triggers: ['enter', 'phase-end'],
            isNotAddTask: event.trigger == 'enter',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                if (event.trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                cmds.getStatus(116098, { hidxs: getObjById(event.heros, getHidById(summon.id))?.hidx });
            }
        })),

    116092: () => new SummonBuilder('无事发生之袖').useCnt(2).damage(1).perCnt(1)
        .description('{defaultAtk。}；【此牌在场时，我方使用技能后：】切换至下一个我方角色。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/98131080535cd67357f26c38e2294630_5447717373017140684.png')
        .handle((summon, event) => {
            const { trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.perCnt > 0) triggers.push('after-skill');
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (trigger == 'after-skill') {
                        smn.minusPerCnt();
                        cmds.switchAfter();
                    }
                }
            }
        }),

    116093: () => new SummonBuilder('轻松迎敌之袖').useCnt(2).damage(1).perCnt(1)
        .description('{defaultAtk。}；【此牌在场时，〖hro〗以外的我方角色使用技能后：】{dealDmg}。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/47a725b8793a1379e47d5715edbbdf15_6178888087176525256.png')
        .handle((summon, event) => {
            const { skid = -1, trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (getHidById(skid) != getHidById(summon.id) && summon.perCnt > 0) triggers.push('after-skill');
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    smn.minusPerCnt();
                    cmds.attack();
                },
            }
        }),

    116094: () => new SummonBuilder('平静养身之袖').useCnt(2).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/146a6915e6959c88352ca50b671726f1_8195662062376364418.png'),

    116095: () => new SummonBuilder('闭目战斗之袖').useCnt(2).damage(1).perCnt(2)
        .description('{defaultAtk。}；【此牌在场时：】我方【hro】及【千织的自动制御人形】造成的[岩元素伤害]+1。（每回合2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/2c436857aec7c71268ae762835386ffc_7173560903994006420.png')
        .handle((summon, event) => {
            const { skid = -1, isSummon = -1, trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            const hid = getHidById(summon.id);
            const isAddDmg = summon.perCnt > 0 && (getHidById(skid) == hid || getHidById(isSummon) == hid);
            if (isAddDmg) triggers.push('Geo-dmg');
            return {
                triggers,
                isNotAddTask: trigger != 'phase-end',
                addDmgCdt: isCdt(isAddDmg, 1),
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (trigger == 'Geo-dmg') smn.minusPerCnt();
                }
            }
        }),

    116096: () => new SummonBuilder('侧目睥睨之袖').useCnt(2).damage(1).perCnt(1)
        .description('{defaultAtk。}；【〖hro〗进行「普通攻击」时：】少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/8c0d9573073fee39837238debd80774c_1093502271962485608.png')
        .handle((summon, event) => {
            const { heros = [], isMinusDiceSkill, trigger } = event;
            const hero = getObjById(heros, getHidById(summon.id));
            const triggers: Trigger[] = ['phase-end'];
            if (summon.perCnt > 0 && hero?.isFront) triggers.push('skilltype1');
            return {
                triggers,
                minusDiceSkill: isCdt(summon.perCnt > 0, { skilltype1: [0, 0, 1] }),
                isNotAddTask: trigger != 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (trigger == 'skilltype1' && isMinusDiceSkill) smn.minusPerCnt();
                }
            }
        }),

    116097: () => new SummonBuilder('千织的自动制御人形').description('千织拥有多种自动制御人形，不但能自动发起攻击，还会提供多种增益效果。'),

    116103: () => new SummonBuilder('冲天转转·脱离').useCnt(1).damage(1)
        .description('{defaultAtk，对下一个敌方后台角色造成1点[穿透伤害]。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/03/22/258999284/cc08c2c835426ea190041ff7be7ff0c9_1608888123917049873.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { eheros, combatStatus } = event;
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds);
                const hidxs = getNextBackHidx(eheros);
                if (hidxs.length) cmds.attack(hasObjById(combatStatus, 116101) ? 2 : 1, DAMAGE_TYPE.Pierce, { hidxs });
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
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                const isLast = smn.isTalent && smn.useCnt == 1;
                smn.phaseEndAtk(event, cmds).clear().attack(isCdt(isLast, smn.damage + 1));
                const hidxs = getMaxHertHidxs(event.heros);
                if (hidxs.length > 0) cmds.heal(isCdt(isLast, smn.shieldOrHeal + 1), { hidxs });
            }
        })),

    117051: () => new SummonBuilder('游丝徵灵').useCnt(1).damage(1).heal(1)
        .description('{defaultAtk，治疗我方出战角色{shield}点。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/42b6402e196eec814b923ac88b2ec3e6_7208177288974921556.png'),

    117093: () => new SummonBuilder('伟大圣龙阿乔').useCnt(2).damage(1)
        .description('{defaultAtk，然后对敌方下一个角色造成1点[草元素伤害]。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/3490c9f20c262433875fd6e584e6d627_7543779796581839169.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { eheros = [] } = event;
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds);
                const backHidxs = getNextBackHidx(eheros);
                if (backHidxs.length > 0) cmds.smnAttack({ hidxs: backHidxs });
            }
        })),

    117101: () => new SummonBuilder('柔灯之匣·一阶').useCnt(3).maxUse(6).damage(1)
        .description('{defaultAtk。；【我方造成燃烧反应伤害后：】此牌升级为【smn117102】。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/03/22/258999284/4832db511e57a4673f91cfab4ec6e260_2114320537892261405.png')
        .handle((summon, event) => ({
            triggers: ['Burning', 'phase-end'],
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                if (event.trigger == 'Burning') return cmds.changeSummon(smn.id, 117102).res;
                smn.phaseEndAtk(event, cmds);
            }
        })),

    117102: (cnt: number = 3) => new SummonBuilder('柔灯之匣·二阶').useCnt(cnt).maxUse(6).damage(2).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/03/22/258999284/02806cab25353aa6b35f89c675e517c6_3569134135175708486.png'),

    117103: () => new SummonBuilder('柔灯之匣·三阶').useCnt(1).damage(1).description('{对敌方全体defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/03/22/258999284/eacf5e3609a63656b348ed0972016239_7375246412914411207.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds);
                getBackHidxs(event.eheros).forEach(hi => cmds.smnAttack({ hidxs: hi }));
            }
        })),

    121011: (cnt: number = 2) => new SummonBuilder('冰萤').useCnt(cnt).maxUse(3).damage(1)
        .description('{defaultAtk。}；【〖hro〗「普通攻击」后：】此牌[可用次数]+1。；【〖hro〗受到元素反应伤害后：】此牌[可用次数]-1。')
        .description('{defaultAtk。}；【〖hro〗「普通攻击」后：】此牌[可用次数]+1。；【我方角色受到元素反应伤害后：】此牌[可用次数]-1。', 'v4.1.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/e98436c034423b951fb726977b37f6b1_915982547283319448.png')
        .handle((summon, event, ver) => {
            const { trigger = '', heros = [], atkHidx = -1, dmgedHidx = -1, talent, getdmg = [] } = event;
            const triggers: Trigger[] = ['phase-end'];
            const atkHero = heros[atkHidx];
            const dmgedHero = heros[dmgedHidx];
            const isAtkHero = atkHero?.id == getHidById(summon.id);
            const isDmgedHero = dmgedHero?.id == getHidById(summon.id) && (getdmg[dmgedHidx] ?? -1) != -1;
            const isTalent = isAtkHero && talent && talent.perCnt == -1 && ['after-skilltype1', 'after-skilltype2'].includes(trigger);
            if (ver.lt('v4.1.0') || isDmgedHero) triggers.push('get-elReaction');
            if (trigger == 'get-elReaction' && (ver.lt('v4.1.0') || isDmgedHero)) summon.minusUseCnt();
            if (isAtkHero && isTalent) triggers.push(trigger);
            return {
                triggers,
                isNotAddTask: !isTalent && trigger != 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (isTalent) {
                        talent.perCnt = 0;
                        return cmds.attack(2).res;
                    }
                    if (trigger == 'phase-end') smn.phaseEndAtk(event, cmds);
                }
            }
        }),

    121033: () => new SummonBuilder('刺击冰棱').useCnt(2).damage(1)
        .description('{对敌方[距离我方出战角色最近的角色]defaultAtk}。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/7becac09916614d57a2f084749634d5d_3605800251898465783.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { hidx = -1, eheros = [] } = event;
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds).clear().smnAttack({ hidxs: getNearestHidx(hidx, eheros) });
            }
        })),

    122011: () => new SummonBuilder('纯水幻形·花鼠').useCnt(2).damage(2).description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9c9ed1587353d9e563a2dee53ffb0e2a_5326741860473626981.png')
        .handle((_, event) => ({
            willSummon: isCdt([22012, 22013].includes(event.skid ?? -1), 122011),
            triggers: 'phase-end',
        })),

    122012: () => new SummonBuilder('纯水幻形·飞鸢').useCnt(3).damage(1).description('{defaultAtk。}')
        .src('#')
        .handle((_, event) => ({
            willSummon: isCdt([22012, 22013].includes(event.skid ?? -1), 122011),
            triggers: 'phase-end',
        })),

    122013: () => new SummonBuilder('纯水幻形·蛙').useCnt(1).useCnt(2, 'v4.3.0').damage(2).shield(1).usedRoundEnd().statusId()
        .description('【我方出战角色受到伤害时：】抵消{shield}点伤害。；[useCnt]，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以{dealDmg}。')
        .src('#')
        .handle((summon, event) => {
            const triggers: Trigger[] = [];
            if (summon.useCnt == 0) triggers.push('phase-end');
            return {
                willSummon: isCdt([22012, 22013].includes(event.skid ?? -1), 122011),
                triggers,
            }
        }),

    122043: (dmg: number = -1, useCnt: number = -1) => new SummonBuilder('黑色幻影').useCnt(useCnt).damage(dmg).electro().statusId()
        .description('【入场时：】获得我方已吞噬卡牌中最高元素骰费用值的「攻击力」，获得该费用的已吞噬卡牌数量的[可用次数]。；【结束阶段和我方宣布结束时：】造成此牌「攻击力」值的[雷元素伤害]。；【我方出战角色受到伤害时：】抵消1点伤害，然后此牌[可用次数]-2。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/71d21daf1689d58b7b86691b894a1d2c_6622906347878958966.png')
        .handle(() => ({ triggers: ['phase-end', 'end-phase'] })),

    123021: () => new SummonBuilder('黯火炉心').useCnt(2).damage(1).pdmg(1)
        .description('{defaultAtk，对所有敌方后台角色造成1点[穿透伤害]。}')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/68087eeb0ffed52029a7ad3220eb04db_2391994745432576824.png'),

    123031: (isTalent: boolean = false) => new SummonBuilder('厄灵·炎之魔蝎').useCnt(2).damage(1).plus(isTalent).talent(isTalent)
        .description(`{defaultAtk${isTalent ? '\\；如果本回合中【hro】使用过「普通攻击」或「元素战技」，则此伤害+1' : ''}。}；【入场时和行动阶段开始：】使我方【hro】附属【sts123033】。(【smn123031】在场时每回合至多${isTalent ? 2 : 1}次，使角色受到的伤害-1。)`)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/8bb20558ca4a0f53569eb23a7547bdff_6164361177759522363.png')
        .handle((summon, event) => {
            const { heros = [], trigger } = event;
            const hidx = getObjIdxById(heros, getHidById(summon.id));
            return {
                triggers: ['phase-end', 'phase-start'],
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    const hero = heros[hidx];
                    if (trigger == 'phase-end') {
                        let addDmg = 0;
                        if (hero.hp > 0) {
                            addDmg = +(smn.isTalent && hero.skills.some(sk => (sk.type == SKILL_TYPE.Normal || sk.type == SKILL_TYPE.Elemental) && sk.useCnt > 0));
                        }
                        return smn.phaseEndAtk(event, cmds).clear().attack(smn.damage + addDmg).res;
                    }
                    if (trigger == 'phase-start' && hero.hp > 0) {
                        cmds.getStatus([[123033, smn.isTalent ? 2 : 1]], { hidxs: hidx });
                    }
                },
            }
        }),

    124013: () => new SummonBuilder('雷锁镇域').useCnt(2).damage(1).perCnt(1)
        .description('{defaultAtk。}；【此召唤物在场时：】敌方执行「切换角色」行动的元素骰费用+1。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/8df8ffcdace3033ced5ccedc1dc7da68_5001323349681512527.png')
        .handle((summon, event) => {
            const { trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (summon.perCnt > 0) triggers.push('add-switch-oppo');
            return {
                addDiceHero: summon.perCnt,
                isNotAddTask: trigger != 'phase-end',
                triggers,
                exec: execEvent => {
                    let { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') return smn.phaseEndAtk(event, cmds).res;
                    if (trigger == 'add-switch-oppo') smn.minusPerCnt();
                }
            }
        }),

    124023: () => new SummonBuilder('轰雷禁锢').useCnt(1).damage(3)
        .description('【结束阶段：】对附属【sts124022】的敌方角色{dealDmg}。（如果敌方不存在符合条件角色，则改为对出战角色造成伤害）；[useCnt]')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/552ec062eef427f9a1986f92ee19c716_8843394885297317371.png')
        .handle((summon, event) => {
            const { eheros = [] } = event;
            const sts124022hidx = eheros.find(h => hasObjById(h.heroStatus, 124022))?.hidx ?? -1;
            const hidxs = isCdt(sts124022hidx != -1, [sts124022hidx]);
            return {
                triggers: 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    smn.phaseEndAtk(event, cmds).clear().smnAttack({ hidxs });
                },
            }
        }),

    124031: () => new SummonBuilder('共鸣珊瑚珠').useCnt(2).damage(1).description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/5776f31ac915874cb7eadd77a0098839_1777069343038822943.png'),

    124041: () => new SummonBuilder('雷萤').useCnt(3).damage(1)
        .description('{defaultAtk；【敌方累积打出3张行动牌后：】此牌[可用次数]+1。（最多叠加到3）；【〖hro〗受到元素反应伤害后：】此牌[可用次数]-1。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/b49d5bd6e23362e65f2819b62c1752f6_652290106975576928.png')
        .handle((summon, event) => {
            const { trigger, heros = [], talent, dmgedHidx = -1, getdmg = [] } = event;
            const triggers: Trigger[] = ['phase-end'];
            const hero = getObjById(heros, getHidById(summon.id));
            if ((talent?.perCnt ?? 0) > 0 && summon.useCnt >= 3) triggers.push('action-start');
            const isHero = hero?.isFront && (getdmg[dmgedHidx] ?? -1) != -1;
            if (isHero && trigger == 'get-elReaction') {
                triggers.push('get-elReaction');
                summon.minusUseCnt();
            }
            return {
                triggers,
                isNotAddTask: trigger == 'get-elReaction',
                exec: execEvent => {
                    const { summon: smn = summon, heros: hrs = heros, eCombatStatus, cmds } = execEvent;
                    if (trigger != 'get-elReaction') smn.phaseEndAtk(event, cmds).clear();
                    if (smn.useCnt == 0) getObjById(eCombatStatus, 124044)?.dispose();
                    if (trigger == 'get-elReaction') return;
                    const chero = getObjById(hrs, getHidById(smn.id));
                    if (trigger == 'action-start') chero?.talentSlot?.minusPerCnt();
                    cmds.attack();
                }
            }
        }),

    125011: () => new SummonBuilder('剑影·孤风').useCnt(2).damage(1)
        .description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/90767acfd11dc25ae46a333557b3ee2a_4658043205818200753.png')
        .handle((summon, event) => {
            const { trigger, skid = -1 } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (skid == 25014) triggers.push('after-skilltype3')
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') smn.phaseEndAtk(event, cmds).clear();
                    cmds.attack();
                },
            }
        }),

    125012: () => new SummonBuilder('剑影·霜驰').useCnt(2).damage(1).cryo()
        .description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3f77ab65d8d940df9b3cf70d96ae0b25_8204101439924542003.png')
        .handle((summon, event) => {
            const { trigger, skid = -1 } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (skid == 25014) triggers.push('after-skilltype3')
            return {
                triggers,
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    if (trigger == 'phase-end') smn.phaseEndAtk(event, cmds).clear();
                    cmds.attack();
                },
            }
        }),

    126032: () => new SummonBuilder('兽境犬首').useCnt(2).damage(1)
        .description('{defaultAtk，使敌方出战角色附属【sts126031】。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/3e32a0169cd4d974e63d42a9db75e7eb_6960651172648088173.png')
        .handle((summon, event) => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                smn.phaseEndAtk(event, cmds).getStatus([[126031, !!event.talent]], { isOppo: true });
            }
        })),

    127022: () => crd12702summon(),

    127023: () => crd12702summon(),

    127024: () => crd12702summon(),

    127025: () => crd12702summon(),

    301028: () => new SummonBuilder('积木小人').from(301033).useCnt(2).damage(1).physical()
        .description('{defaultAtk。}').tag(SUMMON_TAG.Simulanka)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/07/28/258999284/80704cf14d47841ff54dfd658bdffba4_5364615516522900370.png'),

    301029: () => new SummonBuilder('折纸飞鼠').from(301034).useCnt(2).addition('effect', 1).icon(STATUS_ICON.Special)
        .description(`【结束阶段：】获得{effect}层【sts169】。；[useCnt]`).tag(SUMMON_TAG.Simulanka)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/07/28/258999284/b1d95145d18301e8c5d22b8f314d95b3_4086315130176794183.png')
        .handle(summon => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                cmds.getStatus([[169, summon.addition.effect]]);
                smn.minusUseCnt();
            }
        })),

    301030: () => new SummonBuilder('跳跳纸蛙').from(301035).useCnt(2).addition('effect', 1).icon(STATUS_ICON.Special)
        .description(`【结束阶段：】抓{effect}张牌。；[useCnt]`).tag(SUMMON_TAG.Simulanka)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/07/28/258999284/40278ec42e615000753d766e5e6ddf22_1265067356573715766.png')
        .handle(summon => ({
            triggers: 'phase-end',
            exec: execEvent => {
                const { summon: smn = summon, cmds } = execEvent;
                cmds.getCard(summon.addition.effect);
                smn.minusUseCnt();
            }
        })),

    301031: () => new SummonBuilder('折纸胖胖鼠').from(301036).useCnt(1).heal(2).tag(SUMMON_TAG.Simulanka)
        .description('【结束阶段：】治疗受伤最多的我方角色{shield}点。；[useCnt]')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/07/28/258999284/8f36cb575445a91e8db23f3d50c9e96c_5654752298718783353.png')
        .handle((summon, event) => {
            const hidxs = getMaxHertHidxs(event.heros);
            return {
                triggers: isCdt(hidxs.length > 0, 'phase-end'),
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    cmds.heal(smn.shieldOrHeal, { hidxs });
                }
            }
        }),

    302201: () => new SummonBuilder('愤怒的太郎丸').from(322024).useCnt(2).damage(2).physical().description('{defaultAtk。}')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/21981b1c1976bec9d767097aa861227d_6685318429748077021.png'),

    303211: () => new SummonBuilder('冰箭丘丘人').from(332015).useCnt(2).damage(1).cryo().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/ba55e6e19d419b16ec763dfcfb655834_213836850123099432.png'),

    303212: () => new SummonBuilder('水丘丘萨满').from(332015).useCnt(2).damage(1).hydro().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/1fc573971ff6d8a6ede47f966be9a6a9_2274801154807218394.png'),

    303213: () => new SummonBuilder('冲锋丘丘人').from(332015).useCnt(2).damage(1).pyro().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/b2751af5c3dddc5a4bf7909bd2382adc_8142471467728886523.png'),

    303214: () => new SummonBuilder('雷箭丘丘人').from(332015).useCnt(2).damage(1).electro().description('{defaultAtk。}')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/084fbb351267f4a6eb5b4eb167cebe51_7018603863032841385.png'),

    303245: (dmg: number = 0, useCnt: number = 0) =>
        new SummonBuilder('「邪龙」').from(332051).useCnt(useCnt + 1).addition('effect', Math.min(5, dmg + 1)).icon(ELEMENT_URL[DAMAGE_TYPE.Physical])
            .description('【结束阶段：】造成{effect}点[穿透伤害]。；[useCnt]').tag(SUMMON_TAG.Simulanka)
            .src('')
            .handle((summon, event) => ({
                triggers: 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon, cmds } = execEvent;
                    cmds.attack(smn.addition.effect, DAMAGE_TYPE.Pierce, { hidxs: getFrontHidx(event.eheros) });
                    smn.minusUseCnt();
                }
            })),

}

export const summonsTotal = (version: Version = VERSION[0]) => {
    if (version == 'vlatest') version = VERSION[0];
    const summons: Summon[] = [];
    for (const idx in allSummons) {
        summons.push(allSummons[idx]().version(version).id(+idx).done());
    }
    return summons;
}

export const newSummon = (version?: Version, options: { diff?: Record<number, Version>, dict?: Record<number, number> } = {}) => {
    return (id: number, ...args: any) => {
        const { diff = {}, dict = {} } = options;
        const dversion = diff[getDerivantParentId(id, dict)] ?? diff[getHidById(id)] ?? diff[id] ?? version;
        return allSummons[id](...args).id(id).version(dversion).done();
    }
}