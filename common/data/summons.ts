
import { Card, Cmds, Hero, MinuDiceSkill, Status, Summon, Trigger } from "../../typing";
import { ELEMENT_TYPE, ElementType, SummonDestroyType, VERSION, Version } from "../constant/enum.js";
import { ELEMENT_NAME } from "../constant/UIconst.js";
import { getAtkHidx, getHidById, getMaxHertHidxs } from "../utils/gameUtil.js";
import { isCdt } from "../utils/utils.js";

export class GISummon {
    id: number; // 唯一id 从3000开始
    entityId: number = -1; // 实体id
    name: string; // 名字
    useCnt: number; // 可用次数
    maxUse: number; // 最大次数
    shieldOrHeal: number; // 挡伤量(<0)/回复量(>0)
    damage: number; // 伤害量
    pdmg: number; // 穿透伤害
    element: ElementType; // 伤害元素：0物理 1水 2火 3雷 4冰 5风 6岩 7草
    isDestroy: SummonDestroyType; // 是否销毁：0次数用完销毁 1次数用完回合结束时销毁 2回合结束时强制销毁
    perCnt: number; // 每回合次数
    isTalent: boolean; // 是否有天赋
    statusId: number; // 可能对应的状态 -1不存在
    addition: string[]; // 额外信息
    handle: (summon: Summon, event?: SummonHandleEvent) => SummonHandleRes; // 处理函数
    isSelected: boolean = false; // 是否被选择
    canSelect: boolean = false; // 是否能被选择
    UI: {
        src: string; // 图片url
        description: string; // 描述
        descriptions: string[], // 处理后的技能描述
        hasPlus: boolean, // 是否有加号
        isWill: boolean, // 是否为将要生成的召唤物
        explains: string[], // 要解释的文本
    };
    constructor(
        id: number, name: string, description: string, src: string, useCnt: number, maxUse: number,
        shieldOrHeal: number, damage: number, element: ElementType, handle?: (summon: Summon, event: SummonHandleEvent) => SummonHandleRes | undefined,
        options: {
            pct?: number, isTalent?: boolean, adt?: string[], pdmg?: number, isDestroy?: SummonDestroyType,
            stsId?: number, spReset?: boolean, expl?: string[], pls?: boolean,
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.useCnt = useCnt;
        this.maxUse = maxUse;
        this.shieldOrHeal = shieldOrHeal;
        this.damage = damage;
        this.element = element;
        const {
            pct = 0, isTalent = false, adt = [], pdmg = 0, isDestroy = 0, stsId = -1,
            spReset = false, expl = [], pls = false,
        } = options;
        const hid = getHidById(id);
        this.UI = {
            description: description
                .replace(/{defaultAtk}/, '【结束阶段：】{dealDmg}。；【[可用次数]：{useCnt}】' + (maxUse > useCnt ? `(可叠加，最多叠加到${maxUse}次)` : ''))
                .replace(/{dealDmg}/g, '造成{dmg}点[elDmg]')
                .replace(/elDmg/g, ELEMENT_NAME[element] + '伤害')
                .replace(/(?<=【)hro(?=】)|(?<=〖)hro(?=〗)/g, `hro${hid}`),
            src,
            hasPlus: pls,
            explains: [...(description.match(/(?<=【)[^【】]+\d(?=】)/g) ?? []), ...expl],
            isWill: false,
            descriptions: [],
        }
        this.perCnt = pct;
        this.isTalent = isTalent;
        this.addition = adt;
        this.pdmg = pdmg;
        this.isDestroy = isDestroy;
        this.statusId = stsId;
        this.handle = (summon, event = {}) => {
            const { reset = false } = event;
            if (reset) {
                summon.perCnt = pct;
                if (!spReset) return {}
            }
            if (handle) return handle(summon, event) ?? {};
            return {
                trigger: ['phase-end'],
                exec: execEvent => phaseEndAtk(execEvent.summon ?? summon),
            }
        };
    }
    setEntityId(id: number): Summon {
        if (this.entityId == -1) this.entityId = id;
        return this;
    }
}

export type SummonHandleEvent = {
    trigger?: Trigger,
    heros?: Hero[],
    eheros?: Hero[],
    hidx?: number,
    reset?: boolean,
    isChargedAtk?: boolean,
    isFallAtk?: boolean,
    hcard?: Card,
    isExec?: boolean,
    isSkill?: number,
    minusDiceCard?: number,
    minusDiceSkillIds?: number[],
    tround?: number,
    force?: boolean,
}

export type SummonHandleRes = {
    trigger?: Trigger[],
    cmds?: Cmds[],
    addDmg?: number,
    addDmgType1?: number,
    addDmgType2?: number,
    addDmgType3?: number,
    addDmgCdt?: number,
    rCombatStatus?: Status[],
    isNotAddTask?: boolean,
    damage?: number,
    element?: number,
    addDiceHero?: number,
    minusDiceCard?: number,
    minusDiceSkill?: MinuDiceSkill,
    tround?: number,
    willSummon?: Summon,
    exec?: (event: SummonExecEvent) => SummonExecRes | void,
}

export type SummonExecEvent = {
    summon?: Summon,
    heros?: Hero[],
    eheros?: Hero[],
    switchHeroDiceCnt?: number,
}

export type SummonExecRes = {
    cmds?: Cmds[],
    switchHeroDiceCnt?: number,
}

const phaseEndAtk = (summon: Summon, healHidxs?: number[]): SummonHandleRes => {
    if (summon.isDestroy == 0) summon.useCnt = Math.max(0, summon.useCnt - 1);
    const cmds: Cmds[] = [];
    if (summon.damage > 0) cmds.push({ cmd: 'attack' });
    if (summon.shieldOrHeal > 0) cmds.push({ cmd: 'heal', hidxs: healHidxs });
    return { cmds }
}

// const crd907summon = (id: number) => {
//     return new GISummon(id, '增殖生命体', '【结束阶段：】造成{dmg}点[草元素伤害]。；【[可用次数]：{useCnt}】',
//         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/5c6f5f310243aea5eff849b26dd80269_2475050287145431617.png',
//         1, 1, 0, 1, 7);
// }

const summonTotal: Record<number, (version: Version, ...args: any) => Summon> = {
    // 3000: () => new GISummon(3000, '', '', '', -1, -1, -1, 0, 0, () => ({})),

    115: () => new GISummon(115, '燃烧烈焰', '{defaultAtk}',
        'https://patchwiki.biligame.com/images/ys/8/8b/2nnf0b70wnuaw0yn45i9db61l6dwg9x.png',
        1, 2, 0, 1, ELEMENT_TYPE.Pyro),

    111011: () => new GISummon(111011, '冰灵珠', '【结束阶段：】{dealDmg}，对所有后台敌人造成1点[穿透伤害]。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/07c346ef7197c24c76a25d3b47ed5e66_3626039813983519562.png',
        2, 2, 0, 1, ELEMENT_TYPE.Cryo, undefined, { pdmg: 1 }),

    111051: () => new GISummon(111051, '霜见雪关扉', '{defaultAtk}',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/0e04dc93febea28566d127704a0eef5c_8035762422701723644.png',
        2, 2, 0, 2, ELEMENT_TYPE.Cryo),

    111062: () => new GISummon(111062, '光降之剑', '【〖hro〗使用｢普通攻击｣或｢元素战技｣时：】此牌累积2点｢能量层数｣，但是【hro1106】不会获得[充能]。；【结束阶段：】弃置此牌。{dealDmg}; 每有1点｢能量层数｣，都使次伤害+1。(影响此牌｢[可用次数]｣的效果会作用于｢能量层数｣。)',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/a475346a830d9b62d189dc9267b35a7a_4963009310206732642.png',
        0, 1000, 0, 3, ELEMENT_TYPE.Physical, (summon, event) => {
            const { heros = [], trigger = '' } = event;
            return {
                trigger: ['phase-end', 'skilltype1', 'skilltype2'],
                isNotAddTask: trigger != 'phase-end',
                exec: execEvent => {
                    const { summon: smn = summon } = execEvent;
                    if (trigger == 'phase-end') {
                        return { cmds: [{ cmd: 'attack', cnt: smn.damage + smn.useCnt }] }
                    }
                    const hero = heros[getAtkHidx(heros)];
                    if (hero?.id == getHidById(summon.id)) {
                        const cnt = !!hero.talentSlot && trigger == 'skilltype2' ? 3 : 2;
                        smn.useCnt += cnt;
                        return { cmds: [{ cmd: 'getEnergy', cnt: -1 }] }
                    }
                },
            }
        }, { pls: true, isDestroy: 2 }),

    111073: () => new GISummon(111073, '箓灵', '{defaultAtk}；【召唤物在场时：】敌方角色受到的[冰元素伤害]和[物理伤害]+1。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/7deee3f26916cf28fd145b110f81d852_4270139379454156566.png',
        2, 2, 0, 1, ELEMENT_TYPE.Cryo, (summon, event) => {
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

    111081: () => new GISummon(111081, '寒病鬼差', '{defaultAtk}；【此召唤物在场时，〖hro〗使用｢普通攻击｣后：】治疗受伤最多的我方角色1点; 【每回合1次：】再治疗我方出战角色1点。',
        'https://act-upload.mihoyo.com/ys-obc/2023/08/16/12109492/f9ea7576630eb5a8c46aae9ea8f61c7b_317750933065064305.png',
        3, 3, 0, 1, ELEMENT_TYPE.Cryo, (summon, event) => {
            const { heros = [], trigger = '', tround = 0, isExec = false } = event;
            const triggers: Trigger[] = ['phase-end'];
            const hidxs = getMaxHertHidxs(heros);
            const fhero = heros[getAtkHidx(heros)];
            const isHeal = fhero?.id == getHidById(summon.id) && trigger == 'skilltype1' && hidxs.length > 0;
            const hasTround = trigger == 'skilltype1' && tround == 0 && summon.perCnt > 0 && fhero.hp < fhero.maxHp;
            if (isHeal) triggers.push('skilltype1');
            const skcmds: Cmds[] = [{ cmd: 'heal', cnt: 1, hidxs }];
            const trdcmds: Cmds[] = [];
            if (hasTround || tround == 1) trdcmds.push({ cmd: 'heal', cnt: 1 });
            return {
                trigger: triggers,
                cmds: isCdt(isHeal && !isExec, [...skcmds, ...trdcmds]),
                tround: isCdt(hasTround, 1),
                exec: execEvent => {
                    if (tround == 1) {
                        --summon.perCnt;
                        return { cmds: trdcmds }
                    }
                    if (trigger == 'skilltype1') return { cmds: skcmds }
                    if (trigger == 'phase-end') return phaseEndAtk(execEvent?.summon ?? summon);
                },
            }
        }, { pct: 1 }),

    // 3004: () => new GISummon(3004, '虚影', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【结束阶段：】弃置此牌，造成{dmg}点[水元素伤害]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/098f3edd0f9ac347a9424c6417de6987_7446453175998729325.png',
    //     1, 1, -1, 1, 1, undefined, { isDestroy: 2, stsId: 2013 }),

    // 3005: (_, isTalent = false) => new GISummon(3005, '大型风灵', `【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)${isTalent ? '；此召唤物在场时：如果此牌的元素已转换，则使我方造成的此类元素伤害+1。' : ''}`,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9ed867751e0b4cbb697279969593a81c_1968548064764444761.png',
    //     3, 3, 0, 2, 5, (summon, event) => {
    //         const { trigger = '' } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         const changeElTrg = ELEMENT_ICON[summon.element] + '-dmg' as Trigger;
    //         if (summon.element == 5) triggers.push('el5Reaction');
    //         const isTalent = summon.isTalent && summon.element < 5 && trigger == changeElTrg;
    //         if (isTalent) triggers.push(changeElTrg);
    //         return {
    //             trigger: triggers,
    //             isNotAddTask: isTalent || trigger.startsWith('el5Reaction'),
    //             addDmgCdt: isCdt(isTalent, 1),
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') return phaseEndAtk(smn);
    //                 if (trigger.startsWith('el5Reaction:') && smn.element == 5) {
    //                     const element = Number(trigger.slice(trigger.indexOf(':') + 1));
    //                     return { cmds: [{ cmd: 'changeElement', element }] };
    //                 }
    //             }
    //         }
    //     }, { isTalent }),

    // 3006: () => new GISummon(3006, '蒲公英领域', '【结束阶段：】造成{dmg}点[风元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/13c4609aff96cf57ad218ddf954ecc08_1272742665837129862.png',
    //     2, 2, 1, 1, 5, (summon, event) => {
    //         const { heros = [], trigger = '' } = event;
    //         const isTalent = !!heros.find(h => h.id == 1402)?.talentSlot;
    //         return {
    //             trigger: ['phase-end', 'wind-dmg'],
    //             isNotAddTask: trigger == 'wind-dmg',
    //             addDmgCdt: isCdt(isTalent, 1),
    //             exec: execEvent => {
    //                 if (trigger == 'wind-dmg') return;
    //                 return phaseEndAtk(execEvent?.summon ?? summon);
    //             }
    //         }
    //     }),

    // 3007: () => new GISummon(3007, '锅巴', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/19b63677c8f4e6cabed15711be406e09_2795447472820195792.png',
    //     2, 2, 0, 2, 2),

    // 3008: (isTalent = false) => new GISummon(3008, '奥兹', `【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】${isTalent ? '；【hro1301】｢普通攻击｣后：造成2点[雷元素伤害]。(需消耗[可用次数])' : ''}`,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/ea0ab20ac46c334e1afd6483b28bb901_2978591195898491598.png',
    //     2, 2, 0, 1, 3, (summon, event) => {
    //         const { heros = [], trigger = '', isExec = true } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         let cnt = isCdt(trigger != 'phase-end', 2);
    //         if (heros[getAtkHidx(heros)]?.id == 1301 && summon.isTalent) {
    //             triggers.push('after-skilltype1');
    //             if (!isExec && trigger == 'after-skilltype1') --summon.useCnt;
    //         }
    //         return {
    //             trigger: triggers,
    //             damage: cnt,
    //             element: summon.element,
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 return { cmds: [{ cmd: 'attack', cnt }] };
    //             },
    //         }
    //     }, { isTalent }),

    // 3009: () => new GISummon(3009, '柯里安巴', '【结束阶段：】造成{dmg}点[草元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/4562f5108720b7a6048440a1b86c963d_9140007412773415051.png',
    //     2, 2, 0, 2, 7),

    // 3010: () => new GISummon(3010, '水丘丘萨满', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/1fc573971ff6d8a6ede47f966be9a6a9_2274801154807218394.png',
    //     2, 2, 0, 1, 1),

    // 3011: () => new GISummon(3011, '冲锋丘丘人', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/b2751af5c3dddc5a4bf7909bd2382adc_8142471467728886523.png',
    //     2, 2, 0, 1, 2),

    // 3012: () => new GISummon(3012, '雷箭丘丘人', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/084fbb351267f4a6eb5b4eb167cebe51_7018603863032841385.png',
    //     2, 2, 0, 1, 3),

    // 3013: () => new GISummon(3013, '冰箭丘丘人', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/183046623/ba55e6e19d419b16ec763dfcfb655834_213836850123099432.png',
    //     2, 2, 0, 1, 4),

    111023: () => new GISummon(111023, '酒雾领域', '【结束阶段：】造成{dmg}点[冰元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/a8a7cc75353c6df3921b63e42f46fe7d_3484731987232379289.png',
        2, 2, 2, 1, ELEMENT_TYPE.Cryo),

    // 3015: () => new GISummon(3015, '歌声之环', '【结束阶段：】治疗所有我方角色{shield}点，然后对我方出战角色[附着水元素]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/d406a937bb6794a26ac46bf1fc9cfe3b_7906063991052689263.png',
    //     2, 2, 1, 0, 1, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { summon: smn = summon } = execEvent;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             return { cmds: [{ cmd: 'heal', hidxs: allHidxs(event.heros) }, { cmd: 'attach' }] }
    //         }
    //     })),

    // 3016: () => new GISummon(3016, '纯水幻形·花鼠', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9c9ed1587353d9e563a2dee53ffb0e2a_5326741860473626981.png',
    //     2, 2, 0, 2, 1),

    // 3017: () => new GISummon(3017, '纯水幻形·飞鸢', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_CardFace_Summon_Raptor.webp',
    //     3, 3, 0, 1, 1, () => ({ willSummon: newSummon(ver)(3016) })),

    // 3018: () => new GISummon(3018, '纯水幻形·蛙', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以造成{dmg}点[水元素伤害]。',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_CardFace_Summon_Frog.webp',
    //     1, 1, -1, 2, 1, summon => {
    //         const trigger: Trigger[] = [];
    //         if (summon.useCnt == 0) trigger.push('phase-end');
    //         return {
    //             willSummon: newSummon(ver)(3016),
    //             trigger,
    //             exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
    //         }
    //     }, { isDestroy: 1, stsId: 2042 }),

    // 3019: () => new GISummon(3019, '剑影·孤风', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/90767acfd11dc25ae46a333557b3ee2a_4658043205818200753.png',
    //     2, 2, 0, 1, 5, (summon, event) => {
    //         const { trigger = '', heros = [], force = false } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (heros.find(h => h.id == 1781)?.isFront || force) triggers.push('after-skilltype3')
    //         return {
    //             trigger: triggers,
    //             damage: summon.damage,
    //             element: summon.element,
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 return { cmds: [{ cmd: 'attack' }] }
    //             },
    //         }
    //     }),

    // 3020: () => new GISummon(3020, '剑影·霜驰', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3f77ab65d8d940df9b3cf70d96ae0b25_8204101439924542003.png',
    //     2, 2, 0, 1, 4, (summon, event) => {
    //         const { trigger = '', heros = [], force = false } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (heros.find(h => h.id == 1781)?.isFront || force) triggers.push('after-skilltype3')
    //         return {
    //             trigger: triggers,
    //             damage: summon.damage,
    //             element: summon.element,
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 return { cmds: [{ cmd: 'attack' }] }
    //             },
    //         }
    //     }),

    // 3021: () => new GISummon(3021, '天狗咒雷·伏', '【结束阶段：】造成{dmg}点[雷元素伤害]，我方出战角色附属【sts2064】。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/aef9cba89ecb16fa0d73ffef53cad44e_6822516960472237055.png',
    //     1, 1, 0, 1, 3, summon => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { cmds = [] } = phaseEndAtk(execEvent?.summon ?? summon);
    //             return {
    //                 cmds: [...cmds, { cmd: 'getStatus', status: [heroStatus(2064)] }],
    //             }
    //         }
    //     })),

    // 3022: () => new GISummon(3022, '天狗咒雷·雷砾', '【结束阶段：】造成{dmg}点[雷元素伤害]，我方出战角色附属【sts2064】。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/51bca1f202172ad60abbace59b96c346_7973049003331786903.png',
    //     2, 2, 0, 2, 3, summon => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { cmds = [] } = phaseEndAtk(execEvent?.summon ?? summon);
    //             return {
    //                 cmds: [...cmds, { cmd: 'getStatus', status: [heroStatus(2064)] }],
    //             }
    //         }
    //     })),

    // 3023: (useCnt = 2) => new GISummon(3023, '化海月', '【结束阶段：】造成{dmg}点[水元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/4608304a2a01f7f33b59b731543a761b_3713077215425832494.png',
    //     useCnt, 2, 1, 1, 1, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { summon: smn = summon } = execEvent;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             const { heros = [] } = event;
    //             const hero = heros.find(h => h.id == 1104);
    //             const isTalent = !!hero?.talentSlot && hero?.inStatus?.some(ist => ist.id == 2065);
    //             return {
    //                 cmds: [
    //                     { cmd: 'attack', cnt: isCdt(isTalent, smn.damage + 1) },
    //                     { cmd: 'heal' }
    //                 ]
    //             }
    //         }
    //     })),

    // 3025: () => new GISummon(3025, '清净之园囿', '【结束阶段：】造成{dmg}点[水元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】我方角色｢普通攻击｣造成的伤害+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/ef32ccb60a38cb7bfa31372dd5953970_1908841666370199656.png',
    //     2, 2, 0, 2, 1, (summon, event) => ({
    //         addDmgType1: 1,
    //         trigger: ['phase-end', 'skilltype1'],
    //         exec: execEvent => {
    //             if (event?.trigger == 'phase-end') return phaseEndAtk(execEvent?.summon ?? summon);
    //         },
    //     })),

    // 3026: () => new GISummon(3026, '阿丑', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【此召唤物在场期间可触发1次：】我方角色受到伤害后，为【hro1503】附属【sts2068】。；【结束阶段：】弃置此牌，造成{dmg}点[岩元素伤害]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/9beb8c255664a152c8e9ca35697c7d9e_263220232522666772.png',
    //     1, 1, -1, 1, 6, (summon, event) => {
    //         const { heros = [], trigger = '' } = event;
    //         const hidx = heros.findIndex(h => h.id == 1503 && h.hp > 0);
    //         return {
    //             trigger: ['phase-end', 'getdmg'],
    //             isNotAddTask: trigger == 'getdmg',
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') return phaseEndAtk(smn);
    //                 if (smn.perCnt <= 0 || trigger != 'getdmg' || hidx == -1) return;
    //                 --smn.perCnt;
    //                 return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2068)], hidxs: [hidx] }] }
    //             },
    //         }
    //     }, { pct: 1, isDestroy: 2, stsId: 2070 }),

    // 3027: () => new GISummon(3027, '藏蕴花矢', '【结束阶段：】造成{dmg}点[草元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/dc8e548704ca0e52d1c6669fac469b3d_5168805556784249785.png',
    //     1, 2, 0, 1, 7),

    // 3029: () => new GISummon(3029, '兔兔伯爵', '【我方出战角色受到伤害时：】抵消{shield}点伤害。；【[可用次数]：{useCnt}】，耗尽时不弃置此牌。；【结束阶段，如果可用次数已耗尽：】弃置此牌以造成{dmg}点[火元素伤害]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/6864ff4d13f55e24080152f88fef542f_1635591582740112856.png',
    //     1, 1, -2, 2, 2, (summon, event) => {
    //         const { heros = [], trigger = '', isExec = true } = event;
    //         const triggers: Trigger[] = [];
    //         if (summon.useCnt == 0) triggers.push('phase-end');
    //         const hero = heros[getAtkHidx(heros)];
    //         const cnt = isCdt(hero?.id == 1206 && trigger == 'after-skilltype1' && !!hero?.talentSlot, 4);
    //         if (cnt) {
    //             triggers.push('after-skilltype1');
    //             if (!isExec) {
    //                 summon.isDestroy = 0;
    //                 summon.useCnt = 0;
    //             }
    //         }
    //         return {
    //             trigger: triggers,
    //             damage: cnt,
    //             element: summon.element,
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'after-skilltype1') {
    //                     smn.isDestroy = 0;
    //                     smn.useCnt = 0;
    //                 }
    //                 return { cmds: [{ cmd: 'attack', cnt }] }
    //             },
    //         }
    //     }, { isDestroy: 1, stsId: 2077 }),

    // 3030: () => new GISummon(3030, '雷罚恶曜之眼', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】我方角色｢元素爆发｣造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/a27cfa39a258ff4b80f01b1964e6faac_1649452858766133852.png',
    //     3, 3, 0, 1, 3, summon => ({
    //         addDmgType3: 1,
    //         trigger: ['phase-end'],
    //         exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
    //     })),

    // 3031: () => new GISummon(3031, '杀生樱', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到6次)；【我方宣布结束时：】如果此牌的[可用次数]至少为4，则造成1点[雷元素伤害]。(需消耗[可用次数])',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/d63267f4388f521b1481a85ace6de257_3147336152102036232.png',
    //     3, 6, 0, 1, 3, summon => {
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (summon.useCnt >= 4) triggers.push('end-phase');
    //         return {
    //             trigger: triggers,
    //             exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
    //         }
    //     }),

    // 3032: () => new GISummon(3032, '暴风之眼', '【结束阶段：】造成{dmg}点[风元素伤害]，对方切换到[距离我方出战角色最近的角色]。；【[可用次数]：{useCnt}】；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/b0b8a8e9a43548bc39fceba101ea0ab6_1760632395524982528.png',
    //     2, 2, 0, 2, 5, (summon, event) => {
    //         const { heros = [], trigger = '' } = event;
    //         const hidx = heros.findIndex(h => h.isFront);
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (summon.element == 5) triggers.push('el5Reaction');
    //         return {
    //             trigger: triggers,
    //             isNotAddTask: trigger.startsWith('el5Reaction'),
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') {
    //                     smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                     return { cmds: [{ cmd: 'attack' }, { cmd: 'switch-to', hidxs: [hidx], cnt: 2500, isOppo: true }] };
    //                 }
    //                 if (trigger.startsWith('el5Reaction:') && smn.element == 5) {
    //                     const element = Number(trigger.slice(trigger.indexOf(':') + 1));
    //                     return { cmds: [{ cmd: 'changeElement', element }] };
    //                 }
    //             }
    //         }
    //     }),

    // 3033: () => new GISummon(3033, '岩脊', '【结束阶段：】造成{dmg}点[岩元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/251c5e32d6cbdfb4c4d0e14e7088ab67_7008401766526335309.png',
    //     2, 2, 0, 1, 6),

    // 3034: () => new GISummon(3034, '冰萤', '【结束阶段：】造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到3次)；【愚人众·冰萤术士｢普通攻击｣后：】此牌[可用次数]+1。；【愚人众·冰萤术士受到元素反应伤害后：】此牌[可用次数]-1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/e98436c034423b951fb726977b37f6b1_915982547283319448.png',
    //     2, 3, 0, 1, 4, (summon, event) => {
    //         const { trigger = '', heros = [], hcard, isExec = true } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         const hero = heros[getAtkHidx(heros)];
    //         const cnt = Number(trigger.slice(-1));
    //         const isTalent = !isNaN(cnt) && hero?.id == 1701 && (!!hero?.talentSlot || hcard?.id == 746) && summon.useCnt + cnt > summon.maxUse;
    //         if (hero?.id == 1701) {
    //             triggers.push('skilltype1', 'get-elReaction', 'after-skilltype1');
    //             if (isTalent && trigger == 'after-skilltype2') {
    //                 triggers.push('after-skilltype2');
    //             }
    //             if (!isExec) {
    //                 if (['after-skilltype1', 'after-skilltype2'].includes(trigger)) {
    //                     summon.useCnt = Math.max(summon.useCnt, Math.min(summon.maxUse, summon.useCnt + 1));
    //                 }
    //                 if (trigger == 'get-elReaction') {
    //                     summon.useCnt = Math.max(0, summon.useCnt - 1);
    //                 }
    //             }
    //         }
    //         return {
    //             trigger: triggers,
    //             damage: isCdt(isTalent, 2),
    //             element: summon.element,
    //             isNotAddTask: !isTalent && trigger != 'phase-end',
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger.startsWith('after-skilltype')) {
    //                     if (isTalent || trigger == 'after-skilltype1') smn.useCnt = Math.max(smn.useCnt, Math.min(smn.maxUse, smn.useCnt + 1));
    //                     if (isTalent) return { cmds: [{ cmd: 'attack', cnt: 2 }] }
    //                     return;
    //                 }
    //                 smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 if (trigger == 'phase-end') return { cmds: [{ cmd: 'attack' }] }
    //             }
    //         }
    //     }),

    // 3035: () => new GISummon(3035, '雷锁镇域', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】敌方执行｢切换角色｣行动的元素骰费用+1。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/8df8ffcdace3033ced5ccedc1dc7da68_5001323349681512527.png',
    //     2, 2, 0, 1, 3, (summon, event) => {
    //         const { trigger = '' } = event;
    //         return {
    //             addDiceHero: summon.perCnt,
    //             isNotAddTask: trigger != 'phase-end',
    //             trigger: ['phase-end', 'change-oppo'],
    //             exec: execEvent => {
    //                 const { summon: smn = summon, switchHeroDiceCnt = 0 } = execEvent;
    //                 if (trigger == 'phase-end') return phaseEndAtk(smn);
    //                 if (trigger == 'change-oppo' && smn.perCnt > 0) {
    //                     --smn.perCnt;
    //                     return { switchHeroDiceCnt: switchHeroDiceCnt + 1 }
    //                 }
    //                 return { switchHeroDiceCnt }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 3036: () => new GISummon(3036, '黯火炉心', '【结束阶段：】造成{dmg}点[火元素伤害]，对所有敌方后台角色造成1点[穿透伤害]。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/68087eeb0ffed52029a7ad3220eb04db_2391994745432576824.png',
    //     2, 2, 0, 1, 2, undefined, { pdmg: 1 }),

    // 3037: () => new GISummon(3037, '流风秋野', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【我方角色或召唤物引发扩散反应后：】转换此牌的元素类型，改为造成被扩散的元素类型的伤害。(离场前仅限一次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/8296c70266ae557b635c27b20e2fd615_5814665570399175790.png',
    //     3, 3, 0, 1, 5, (summon, event) => {
    //         const { trigger = '' } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (summon.element == 5) triggers.push('el5Reaction');
    //         return {
    //             trigger: triggers,
    //             isNotAddTask: trigger.startsWith('el5Reaction'),
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') return phaseEndAtk(smn);
    //                 if (trigger.startsWith('el5Reaction:') && smn.element == 5) {
    //                     const element = Number(trigger.slice(trigger.indexOf(':') + 1));
    //                     return { cmds: [{ cmd: 'changeElement', element }] };
    //                 }
    //             }
    //         }
    //     }),

    // 3038: () => new GISummon(3038, '蔷薇雷光', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/0ea69a82861d8469ecdbbc78797e9fd8_3713104012683105893.png',
    //     2, 2, 0, 2, 3),

    // 3040: () => new GISummon(3040, '阳华', '【结束阶段：】造成{dmg}点[岩元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】我方角色进行[下落攻击]时少花费1个[无色元素骰]。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/5e2b48f4db9bfae76d4ab9400f535b4f_1116777827962231889.png',
    //     3, 3, 0, 1, 6, (summon, event) => {
    //         const { isFallAtk = false, trigger = '' } = event;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] },
    //             () => isFallAtk && summon.perCnt > 0);
    //         return {
    //             ...minusSkillRes,
    //             isNotAddTask: trigger == 'skilltype1',
    //             trigger: ['skilltype1', 'phase-end'],
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') return phaseEndAtk(smn);
    //                 if (trigger == 'skilltype1' && isMinusSkill) --smn.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 3041: () => new GISummon(3041, '净焰剑狱领域', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】；【当此召唤物在场且〖hro1209〗在我方后台，我方出战角色受到伤害时：】抵消1点伤害; 然后，如果【hro1209】生命值至少为7，则对其造成1点[穿透伤害]。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/5fe195423d5308573221c9d25f08d6d7_2012000078881285374.png',
    //     3, 3, 0, 1, 2, (summon, event) => {
    //         const { reset = false } = event;
    //         if (reset) return { rOutStatus: [heroStatus(2105, 3041)] }
    //         return {
    //             trigger: ['phase-end'],
    //             exec: execEvent => phaseEndAtk(execEvent?.summon ?? summon),
    //         }
    //     }, { spReset: true }),

    // 3042: (isTalent = false) => new GISummon(3042, '月桂·抛掷型', `【结束阶段：】造成{dmg}点[草元素伤害]，治疗我方受伤最多的角色{shield}点。${isTalent ? '；如果可用次数仅剩余1，则此效果造成的伤害和治疗各+1。' : ''}；【[可用次数]：{useCnt}】`,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/7bc79d56afd059a2f88d45ae0c500923_7487275599868058123.png',
    //     2, 2, 1, 1, 7, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { heros = [] } = event;
    //             const { summon: smn = summon } = execEvent;
    //             const isLast = smn.isTalent && smn.useCnt == 1;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             const cmds: Cmds[] = [{ cmd: 'attack', cnt: isCdt(isLast, smn.damage + 1) }];
    //             const hidxs = getMaxHertHidxs(heros);
    //             if (hidxs.length > 0) cmds.push({ cmd: 'heal', cnt: isCdt(isLast, smn.shield + 1), hidxs });
    //             return { cmds }
    //         }
    //     }), { isTalent }),

    // 3043: () => new GISummon(3043, '丰穰之核', '【结束阶段：】造成{dmg}点[草元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到3次)；【我方宣布结束时：】如果此牌的[可用次数]至少为2，则造成2点[草元素伤害]。(需消耗[可用次数])',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/865915f8734cdc641df43198eb728497_5603461429712047360.png',
    //     1, 3, 0, 2, 7, (summon, event) => {
    //         const { heros = [] } = event;
    //         const hero = heros.find(h => h.id == 1108);
    //         const isTalent = !!hero?.talentSlot;
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (summon.useCnt >= 2) triggers.push('end-phase');
    //         return {
    //             trigger: triggers,
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 return { cmds: [{ cmd: 'attack', cnt: isCdt(isTalent, smn.damage + 1) }] };
    //             },
    //         }
    //     }),

    // 3044: () => new GISummon(3044, '售后服务弹', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/fe4516935ffa9eb9b193411113fa823f_372775257521707079.png',
    //     1, 1, 0, 1, 3),

    // 3045: (isTalent = false) => new GISummon(3045, '灯中幽精', `【结束阶段：】治疗我方出战角色{shield}点，并使其获得1点[充能]。${isTalent ? '；治疗生命值不多于6的角色时，治疗量+1; 使没有[充能]的角色获得[充能]时，获得量+1。' : ''}；【[可用次数]：{useCnt}】`,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/c8209ff8f2c21e01e4e05203385410d7_8366905551575281519.png',
    //     2, 2, 2, 0, 0, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { summon: smn = summon } = execEvent;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             const { heros = [] } = event;
    //             const fhero = heros.find(h => h.isFront);
    //             if (!fhero) throw new Error('fhero is undefined');
    //             return {
    //                 cmds: [
    //                     { cmd: 'heal', cnt: isCdt(fhero.hp <= 6 && smn.isTalent, smn.shield + 1) },
    //                     { cmd: 'getEnergy', cnt: fhero.energy == 0 && smn.isTalent ? 2 : 1 }
    //                 ]
    //             }
    //         }
    //     }), { isTalent, pls: isTalent }),

    // 3046: () => new GISummon(3046, '游丝徵灵', '【结束阶段：】造成{dmg}点[草元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/42b6402e196eec814b923ac88b2ec3e6_7208177288974921556.png',
    //     1, 1, 1, 1, 7),

    // 3047: () => new GISummon(3047, '饰梦天球', '【结束阶段：】造成{dmg}点[冰元素伤害]。如果【sts2129】在场，则使其累积1枚｢晚星｣。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/1b86f1cb97411b77d51cc22bb5622ff7_2462971599599504312.png',
    //     2, 2, 0, 1, 4, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { summon: smn = summon } = execEvent;
    //             const { heros = [] } = event;
    //             const sts2129 = heros.find(h => h.isFront)?.outStatus?.find(ost => ost.id == 2129);
    //             if (sts2129) ++sts2129.useCnt;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             return { cmds: [{ cmd: 'attack' }] }
    //         }
    //     })),

    // 3048: () => new GISummon(3048, '怪笑猫猫帽', '【结束阶段：】造成{dmg}点[火元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/27885c0d6d1bd4ae42ea0d69d357198d_8888407409706694377.png',
    //     1, 2, 0, 1, 2, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { summon: smn = summon } = execEvent;
    //             const { heros = [] } = event;
    //             const talent = heros.find(h => h.id == 1210)?.talentSlot;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             if (talent && talent.useCnt > 0) {
    //                 --talent.useCnt;
    //                 return { cmds: [{ cmd: 'attack', cnt: smn.damage + 2 }] }
    //             }
    //             return { cmds: [{ cmd: 'attack' }] }
    //         }
    //     })),

    // 3049: () => new GISummon(3049, '惊奇猫猫盒', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【当此召唤物在场，我方出战角色受到伤害时：】抵消1点伤害。(每回合1次)；【我方角色受到‹4冰›/‹1水›/‹2火›/‹3雷›元素伤害时：】转换此牌的元素类型，改为造成所受到的元素类型的伤害。（离场前仅限一次）',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/18e98a957a314ade3c2f0722db5a36fe_4019045966791621132.png',
    //     2, 2, 0, 1, 5, (summon, event) => {
    //         const { reset = false, trigger = '' } = event;
    //         if (reset) return { rOutStatus: [heroStatus(2134, 3049)] }
    //         const getdmg = ['water-getdmg', 'fire-getdmg', 'thunder-getdmg', 'ice-getdmg'];
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (summon.element == 5 && getdmg.includes(trigger)) {
    //             triggers.push(trigger);
    //         }
    //         return {
    //             trigger: triggers,
    //             isNotAddTask: trigger.includes('-getdmg'),
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') return phaseEndAtk(smn);
    //                 if (trigger.includes('-getdmg') && smn.element == 5) {
    //                     const element = ELEMENT_ICON.indexOf(trigger.slice(0, trigger.indexOf('-getdmg')));
    //                     return { cmds: [{ cmd: 'changeElement', element }] };
    //                 }
    //             },
    //         }
    //     }, { spReset: true }),


    // 3050: () => new GISummon(3050, '大将威仪', '【结束阶段：】造成{dmg}点[岩元素伤害]；如果队伍中存在2名‹6岩元素›角色，则生成【sts2007】。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/669b37ae522405031419cd14f6e8daf0_5829987868413544081.png',
    //     2, 2, 0, 1, 6, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { cmds = [] } = phaseEndAtk(execEvent?.summon ?? summon);
    //             const { heros = [] } = event;
    //             if (heros.filter(h => h.element == 6).length >= 2) {
    //                 cmds.push({ cmd: 'getStatus', status: [heroStatus(2007)] })
    //             }
    //             return { cmds }
    //         }
    //     })),

    // 3051: (isTalent = false) => new GISummon(3051, '厄灵·炎之魔蝎', `【结束阶段：】造成{dmg}点[火元素伤害]${isTalent ? '; 如果本回合中【hro1743】使用过｢普通攻击｣或｢元素战技｣，则此伤害+1' : ''}。；【[可用次数]：{useCnt}】；【入场时和行动阶段开始：】使我方【hro1743】附属【sts2139】。(【厄灵·炎之魔蝎】在场时每回合至多${isTalent ? 2 : 1}次，使角色受到的伤害-1。)`,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/8bb20558ca4a0f53569eb23a7547bdff_6164361177759522363.png',
    //     2, 2, 0, 1, 2, (summon, event) => {
    //         const { heros = [], trigger = '' } = event;
    //         const hidx = heros.findIndex(h => h.id == 1743 && h.hp > 0);
    //         return {
    //             trigger: ['phase-end', 'phase-start'],
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (trigger == 'phase-end') {
    //                     smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                     let addDmg = 0;
    //                     if (hidx > -1) {
    //                         const hero = heros[hidx];
    //                         addDmg = +(smn.isTalent && hero.skills.some(sk => sk.type < 3 && sk.useCnt > 0));
    //                     }
    //                     return { cmds: [{ cmd: 'attack', cnt: smn.damage + addDmg }] }
    //                 }
    //                 if (trigger == 'phase-start' && hidx > -1) {
    //                     return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2139, smn.isTalent ? 2 : 1)], hidxs: [hidx] }] }
    //                 }
    //             },
    //         }
    //     }, { isTalent, pls: isTalent }),

    // 3052: () => new GISummon(3052, '轰雷禁锢', '【结束阶段：】对附属【sts2141】的敌方角色造成{dmg}点[雷元素伤害]。(如果敌方不存在符合条件角色，则改为对出战角色造成伤害)；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/552ec062eef427f9a1986f92ee19c716_8843394885297317371.png',
    //     1, 1, 0, 3, 3, (summon, event) => {
    //         const { eheros = [] } = event;
    //         const sts2141 = eheros.findIndex(h => h.inStatus.some(ist => ist.id == 2141));
    //         const hidxs = isCdt(sts2141 > -1, [sts2141]);
    //         return {
    //             trigger: ['phase-end'],
    //             exec: () => {
    //                 summon.useCnt = Math.max(0, summon.useCnt - 1);
    //                 return { cmds: [{ cmd: 'attack', hidxs }] }
    //             },
    //         }
    //     }),

    // 3053: () => new GISummon(3053, '不倒貉貉', `【结束阶段：】造成{dmg}点[风元素伤害]，治疗我方受伤最多的角色{shield}点。；【[可用次数]：{useCnt}】`,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/e78e66eddfb70ab60a6f4d3733a8c3ab_4021248491292359775.png',
    //     2, 2, 2, 1, 5, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { heros = [] } = event;
    //             const { summon: smn = summon } = execEvent;
    //             return phaseEndAtk(smn, getMaxHertHidxs(heros));
    //         }
    //     })),

    // 3054: () => new GISummon(3054, '刺击冰棱', `【结束阶段：】对敌方[距离我方出战角色最近的角色]造成{dmg}点[冰元素伤害]。；【[可用次数]：{useCnt}】`,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/7becac09916614d57a2f084749634d5d_3605800251898465783.png',
    //     2, 2, 0, 1, 4, (summon, event) => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { heros = [], eheros = [] } = event;
    //             const { summon: smn = summon } = execEvent;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             return { cmds: [{ cmd: 'attack', hidxs: [getNearestHidx(heros.findIndex(h => h.isFront), eheros)] }] }
    //         }
    //     })),

    // 3055: () => new GISummon(3055, '共鸣珊瑚珠', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/5776f31ac915874cb7eadd77a0098839_1777069343038822943.png',
    //     2, 2, 0, 1, 3),

    // 3056: () => new GISummon(3056, '临事场域', '【结束阶段：】造成{dmg}点[冰元素伤害]，治疗我方出战角色{shield}点。；【[可用次数]：{useCnt}】',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/a4249ebb8a68e2843cdd2fa78937912c_2796631322062911422.png',
    //     2, 2, 1, 1, 4),

    // 3057: () => new GISummon(3057, '雷萤', '【结束阶段：】造成{dmg}点[雷元素伤害]。；【[可用次数]：{useCnt}】；【敌方累积打出3张行动牌后：】此牌[可用次数]+1。(最多叠加到3)；【愚人众·雷萤术士受到元素反应伤害后：】此牌[可用次数]-1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/b49d5bd6e23362e65f2819b62c1752f6_652290106975576928.png',
    //     3, 3, 0, 1, 3, (summon, event) => {
    //         const { trigger = '', heros = [], isExec = true } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         const hero = heros.find(h => h.id == 1764);
    //         if (hero?.isFront) {
    //             triggers.push('get-elReaction');
    //             if (!isExec && trigger == 'get-elReaction') {
    //                 summon.useCnt = Math.max(0, summon.useCnt - 1);
    //             }
    //         }
    //         if ((hero?.talentSlot?.useCnt ?? 0) > 0 && summon.useCnt >= 3) triggers.push('action-start');
    //         return {
    //             trigger: triggers,
    //             damage: 1,
    //             element: 3,
    //             isNotAddTask: trigger == 'get-elReaction',
    //             exec: execEvent => {
    //                 const { summon: smn = summon, heros: hrs = heros, eheros = [] } = execEvent;
    //                 smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 if (smn.useCnt == 0) {
    //                     const eOutStatus = eheros.find(h => h.isFront)?.outStatus;
    //                     const sts2175 = eOutStatus?.findIndex(ist => ist.id == 2175) ?? -1;
    //                     if (sts2175 > -1) eOutStatus?.splice(sts2175, 1);
    //                 }
    //                 if (trigger == 'get-elReaction') return;
    //                 const chero = hrs.find(h => h.id == 1764);
    //                 if (trigger == 'action-start' && chero?.talentSlot) --chero.talentSlot.useCnt;
    //                 return { cmds: [{ cmd: 'attack' }] }
    //             }
    //         }
    //     }),

    // 3058: (isTalent = false) => new GISummon(3058, '赫耀多方面体', '【结束阶段：】造成{dmg}点[风元素伤害]。；【[可用次数]：{useCnt}】；【此召唤物在场时：】敌方角色受到的[风元素伤害]+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/d51fd00a7e640ba13b62315e5184be58_168888966568961527.png',
    //     3, 3, 0, 1, 5, (summon, event) => {
    //         const { trigger = '' } = event;
    //         const triggers: Trigger[] = ['wind-getdmg-oppo', 'phase-end'];
    //         if (summon.isTalent) triggers.push('phase-start');
    //         return {
    //             addDmgCdt: 1,
    //             isNotAddTask: trigger == 'wind-getdmg-oppo',
    //             trigger: triggers,
    //             exec: execEvent => {
    //                 if (trigger == 'phase-end') return phaseEndAtk(execEvent?.summon ?? summon);
    //                 if (trigger == 'phase-start') return { cmds: [{ cmd: 'getDice', cnt: 1, element: 5 }] }
    //             },
    //         }
    //     }, { isTalent }),

    // 3059: (src = '') => new GISummon(3059, '愤怒的太郎丸', '【结束阶段：】造成{dmg}点[物理伤害]。；【[可用次数]：{useCnt}】', src, 2, 2, 0, 2, 0),

    // 3060: (useCnt = 2) => new GISummon(3060, '沙龙成员', '【结束阶段：】造成{dmg}点[水元素伤害]。如果我方存在生命值至少为6的角色，则对一位受伤最少的我方角色造成1点[穿透伤害]，然后再造成1点[水元素伤害]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到4次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/8cfed9e54e85d3bd44fc7e7e3aa9564a_6917287984925848695.png',
    //     useCnt, 4, 0, 1, 1, (summon, event) => {
    //         const { tround = 0, heros = [] } = event;
    //         const hasTround = tround == 0 && heros.some(h => h.hp >= 6);
    //         return {
    //             trigger: ['phase-end'],
    //             tround: isCdt(hasTround, 1),
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (!hasTround) smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 if (tround == 0) return { cmds: [{ cmd: 'attack' }] }
    //                 return { cmds: [{ cmd: 'attack', element: -1, hidxs: getMinHertHidxs(heros), cnt: 1, isOppo: true }, { cmd: 'attack', cnt: 1 }] }
    //             },
    //         }
    //     }),

    // 3061: (useCnt = 2) => new GISummon(3061, '众水的歌者', '【结束阶段：】治疗所有我方角色1点。如果我方存在生命值不多于5的角色，则再治疗一位受伤最多的角色1点。；【[可用次数]：{useCnt}】(可叠加，最多叠加到4次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/e223897c5723dcc6b6ea50fcdf966232_9198406692148038444.png',
    //     useCnt, 4, 1, 0, 0, (summon, event) => {
    //         const { tround = 0, heros = [] } = event;
    //         const hasTround = tround == 0 && heros.some(h => h.hp <= 4);
    //         return {
    //             trigger: ['phase-end'],
    //             tround: isCdt(hasTround, 1),
    //             exec: execEvent => {
    //                 const { summon: smn = summon } = execEvent;
    //                 if (!hasTround) smn.useCnt = Math.max(0, smn.useCnt - 1);
    //                 if (tround == 0) return { cmds: [{ cmd: 'heal', hidxs: allHidxs(heros) }] }
    //                 return { cmds: [{ cmd: 'heal', hidxs: getMaxHertHidxs(heros) }] }
    //             },
    //         }
    //     }),

    // 3062: (dmg = -1, useCnt = -1) => new GISummon(3062, '黑色幻影', `【入场时：】获得我方已吞噬卡牌中最高元素骰费用值的｢攻击力｣，获得该费用的已吞噬卡牌数量的[可用次数]。；【结束阶段和我方宣布结束时：】造成${dmg == -1 ? '此牌｢攻击力｣值的' : '{dmg}点'}[雷元素伤害]。；【我方出战角色受到伤害时：】抵消1点伤害，然后此牌[可用次数]-2。${useCnt == -1 ? '' : '；【[可用次数]：{useCnt}】'}`,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/71d21daf1689d58b7b86691b894a1d2c_6622906347878958966.png',
    //     useCnt, useCnt, 0, dmg, 3, summon => ({
    //         trigger: ['phase-end', 'end-phase'],
    //         exec: execEvent => phaseEndAtk(execEvent.summon ?? summon),
    //     }), { stsId: 2212 }),

    // 3063: () => crd907summon(3063),

    // 3064: () => crd907summon(3064),

    // 3065: () => crd907summon(3065),

    // 3066: () => crd907summon(3066),

    // 3067: () => new GISummon(3067, '金花礼炮', '【结束阶段：】造成{dmg}点[岩元素伤害]，摸1张【crd913】。；【[可用次数]：{useCnt}】',
    //     '',
    //     2, 2, 0, 1, 6, summon => ({
    //         trigger: ['phase-end'],
    //         exec: execEvent => {
    //             const { summon: smn = summon } = execEvent;
    //             smn.useCnt = Math.max(0, smn.useCnt - 1);
    //             return { cmds: [{ cmd: 'attack' }, { cmd: 'getCard', cnt: 1, card: 913, isAttach: true }] }
    //         }
    //     })),

}

export const newSummon = (version: Version = VERSION[0]) => (id: number, ...args: any) => summonTotal[id](version, ...args);