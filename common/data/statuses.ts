import { AddDiceSkill, Card, Cmds, GameInfo, Hero, MinuDiceSkill, Status, Summon, Trigger } from "../../typing";
import { STATUS_BG_COLOR, StatusBgColor, ELEMENT_NAME_KEY, ELEMENT_NAME, STATUS_BG_COLOR_KEY, ElementNameKey, SHIELD_ICON_URL } from "../constant/UIconst.js";
import { isCdt } from "../utils/utils.js";
import {
    CARD_SUBTYPE, ELEMENT_TYPE, ElementType, PureElementType, STATUS_GROUP, STATUS_TYPE, SkillType,
    StatusGroup, StatusType, VERSION, Version,
} from "../constant/enum.js";
import { newHero } from "./heros.js";

export class GIStatus {
    id: number; // 唯一id
    entityId: number = -1; // 实体id
    name: string; // 名字
    group: StatusGroup; // 0角色状态 1阵营状态
    type: StatusType[]; // 类型: 0隐藏 1攻击 2挡伤 3回合 4使用 5翻倍伤害 6条件加伤 7护盾 8元素附魔 9累积 10标记 11准备技能 12死后不删除 13免击倒 14无法行动 15暂时不消失 16条件附魔
    useCnt: number; // 剩余使用次数: -1为无次数限制
    maxCnt: number; // 最多叠加的次数: 0为不能叠加
    addCnt: number; // 叠加时次数
    perCnt: number; // 每回合使用次数
    roundCnt: number; // 剩余轮次数: -1为无轮次限制
    isTalent: boolean; // 是否有天赋
    handle: (status: Status, event: StatusHandleEvent) => StatusHandleRes; // 处理函数
    summonId: number; // 可能对应的召唤物 -1不存在
    addition: string[]; // 额外信息
    UI: {
        icon: string, // 图标
        description: string, // 描述
        descriptions: string[], // 处理后的技能描述
        explains: string[], // 要解释的文本
        isSelected: boolean, // 是否正在发动
        iconBg: StatusBgColor, // 图标背景
    };
    constructor(
        id: number, name: string, description: string, icon: string, group: StatusGroup, type: StatusType[],
        useCnt: number, maxCnt: number, roundCnt: number, handle?: (status: Status, event?: StatusHandleEvent) => StatusHandleRes | undefined,
        options: {
            smnId?: number, pct?: number, icbg?: StatusBgColor, expl?: string[], act?: number,
            isTalent?: boolean, isReset?: boolean, adt?: string[]
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.group = group;
        this.type = type;
        this.useCnt = useCnt;
        this.maxCnt = maxCnt;
        this.roundCnt = roundCnt;
        const { smnId = -1, pct = 0, icbg = STATUS_BG_COLOR.Transparent, expl = [], act = Math.max(useCnt, roundCnt),
            isTalent = false, isReset = true, adt = [] } = options;
        this.UI = {
            description,
            icon,
            iconBg: icbg,
            explains: [...(description.match(/(?<=【)[^【】]+\d(?=】)/g) ?? []), ...expl],
            descriptions: [],
            isSelected: false,
        }
        this.addCnt = act;
        this.summonId = smnId;
        this.perCnt = pct;
        this.isTalent = isTalent;
        this.addition = adt;
        let thandle = handle ?? (() => ({}));
        if (type.includes(STATUS_TYPE.Shield)) {
            // this.icon = 'shield2';
            this.UI.icon = SHIELD_ICON_URL;
            this.UI.iconBg = STATUS_BG_COLOR[STATUS_TYPE.Shield];
            thandle = (status, event = {}) => {
                let { restDmg = 0 } = event;
                let rest: StatusHandleRes = {};
                if (handle) {
                    const { restDmg: dmg = -1, ...other } = handle(status, event) ?? {};
                    if (dmg > -1) restDmg = dmg;
                    rest = { ...other };
                }
                if (restDmg <= 0) return { restDmg, ...rest };
                const shieldDmg = Math.min(restDmg, status.useCnt);
                status.useCnt -= shieldDmg;
                return { restDmg: restDmg - shieldDmg, ...rest };
            }
        } else if (type.includes(STATUS_TYPE.Barrier) && this.UI.icon == '') {
            // this.icon = 'shield';
            // this.iconBg = '#9268db';
            this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Barrier.webp';
        }
        if (this.UI.iconBg == STATUS_BG_COLOR.Transparent) {
            if (id == 111052) {
                this.UI.iconBg = STATUS_BG_COLOR[ELEMENT_NAME_KEY[name.slice(0, 3) as ElementNameKey] as PureElementType];
            } else if (icon.startsWith('buff')) {
                if (icon == 'buff2') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Buff.webp';
                if (icon == 'buff3') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Special.webp';
                this.UI.iconBg = STATUS_BG_COLOR.Buff;
            } else if (['satiety', 'debuff'].includes(icon)) {
                if (icon == 'satiety') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Food.webp';
                if (icon == 'debuff') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Debuff.webp';
                // this.iconBg = DEBUFF_BG_COLOR;
            } else if (icon.includes('heal')) {
                if (icon == 'heal') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Heal.webp';
                if (icon == 'heal2') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Revive.webp';
                // this.iconBg = '#95ff7a';
            } else if (icon.startsWith('ski')) {
                const heroId = +icon.slice(3, 7);
                this.UI.iconBg = STATUS_BG_COLOR[newHero()(heroId).element];
            }
        }
        this.handle = (status, event = {}) => {
            const { reset = false } = event;
            if (reset) {
                if (isReset) status.perCnt = pct;
                return {}
            }
            return thandle(status, event) ?? {};
        }
    }
    setEntityId(id: number): Status {
        if (this.entityId == -1) this.entityId = id;
        return this;
    }
    hasType(...types: StatusType[]): boolean {
        return this.type.some(v => types.includes(v));
    }
}

export type StatusHandleEvent = {
    restDmg?: number,
    summon?: Summon,
    hidx?: number,
    heros?: Hero[],
    eheros?: Hero[],
    dmgElement?: ElementType,
    reset?: boolean,
    trigger?: Trigger,
    card?: Card,
    discards?: Card[],
    isChargedAtk?: boolean,
    isFallAtk?: boolean,
    phase?: number,
    skilltype?: SkillType,
    hidxs?: number[],
    hasDmg?: boolean,
    dmgSource?: number,
    minusDiceCard?: number,
    isMinusDiceSkill?: boolean,
    heal?: number[],
    force?: boolean,
    summons?: Summon[],
    esummons?: Summon[],
    getDmgIdx?: number,
    hcardsCnt?: number,
    pile?: Card[],
    playerInfo?: GameInfo,
    isSummon?: number,
    source?: number,
}

export type StatusHandleRes = {
    restDmg?: number,
    damage?: number,
    pdmg?: number,
    element?: ElementType,
    trigger?: Trigger[],
    addDmg?: number,
    addDmgType1?: number,
    addDmgType2?: number,
    addDmgType3?: number,
    addDmgCdt?: number,
    multiDmgCdt?: number,
    addDmgSummon?: number,
    addDiceSkill?: AddDiceSkill,
    getDmg?: number,
    minusDiceCard?: number,
    minusDiceHero?: number,
    addDiceHero?: number,
    minusDiceSkill?: MinuDiceSkill,
    heal?: number,
    hidxs?: number[],
    isQuickAction?: boolean,
    isSelf?: boolean,
    skill?: number,
    cmds?: Cmds[],
    summon?: Summon[],
    isInvalid?: boolean,
    onlyOne?: boolean,
    attachEl?: PureElementType,
    isUpdateAttachEl?: boolean,
    atkOffset?: number,
    isAddTask?: boolean,
    exec?: (eStatus?: Status, event?: StatusExecEvent) => StatusExecRes | void,
}

export type StatusExecEvent = {
    switchHeroDiceCnt?: number,
    heros?: Hero[],
    summons?: Summon[],
    isQuickAction?: boolean,
}

export type StatusExecRes = {
    cmds?: Cmds[],
    switchHeroDiceCnt?: number,
    hidxs?: number[],
}

const senlin1Sts = (id: number, name: string) => {
    return new GIStatus(id, name + '(生效中)', '【角色在本回合中，下次对角色打出｢天赋｣或使用｢元素战技｣时：】少花费2个元素骰。',
        'buff2', STATUS_GROUP.heroStatus, [STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign], 1, 0, 1, (status, event = {}) => {
            const { card, heros = [], hidx = -1, trigger = '', minusDiceCard: mdc = 0, isMinusDiceSkill = false } = event;
            const isMinusCard = card && card.hasSubtype(CARD_SUBTYPE.Talent) && card.userType == heros[hidx]?.id && card.cost + card.anydice > mdc;
            return {
                minusDiceSkill: { skilltype2: [0, 0, 2] },
                minusDiceCard: isCdt(isMinusCard, 2),
                trigger: ['skilltype2', 'card'],
                exec: () => {
                    if (trigger == 'card' && !isMinusCard) return;
                    if (trigger == 'skilltype2' && !isMinusDiceSkill) return;
                    --status.useCnt;
                }
            }
        });
}

// const card587sts = (element: number) => {
//     const names = ['', '藏镜仕女', '火铳游击兵', '雷锤前锋军', '冰萤术士'];
//     return new GIStatus(2123 + element, '愚人众伏兵·' + names[element], `所在阵营的角色使用技能后：对所在阵营的出战角色造成1点[${ELEMENT[element]}伤害]。(每回合1次)；【[可用次数]：{useCnt}】`,
//         ELEMENT_ICON[element] + '-dice', 1, [1], 2, 0, -1, status => ({
//             damage: isCdt(status.perCnt > 0, 1),
//             element: ELEMENT_ICON.indexOf(status.icon.split('-')[0]),
//             isSelf: true,
//             trigger: ['after-skill'],
//             exec: eStatus => {
//                 if (eStatus && eStatus.perCnt > 0) {
//                     --eStatus.useCnt;
//                     --eStatus.perCnt;
//                 }
//             }
//         }), { icbg: DEBUFF_BG_COLOR, pct: 1 });
// }

// const card751sts = (windEl: number) => {
//     return new GIStatus(2118 + windEl, '风物之诗咏·' + ELEMENT_NAME[windEl][0], `我方角色和召唤物所造成的[${ELEMENT_NAME[windEl]}伤害]+1。；【[可用次数]：{useCnt}】`,
//         'buff4', 1, [6], 2, 0, -1, status => ({
//             trigger: [`${ELEMENT_ICON[STATUS_BG_COLOR.indexOf(status.iconBg)]}-dmg` as Trigger],
//             addDmgCdt: 1,
//             exec: () => { --status.useCnt }
//         }), { icbg: STATUS_BG_COLOR[windEl] })
// }

const shieldStatus = (id: number, name: string, cnt = 2, mcnt = 0) =>
    new GIStatus(id, name, `为我方出战角色提供${cnt}点[护盾]。${mcnt > 0 ? `(可叠加，最多到${mcnt})` : ''}`,
        '', STATUS_GROUP.combatStatus, [STATUS_TYPE.Shield], cnt, mcnt, -1);

// const readySkillShieldStatus = (id: number, name: string) =>
//     new GIStatus(id, name, '准备技能期间，提供2点[护盾]，保护所附属角色。',
//         '', STATUS_GROUP.heroStatus, [STATUS_TYPE.Shield], 2, 0, -1);

// const oncePerRound = (id: number, name: string) =>
//     new GIStatus(id, `${name}(冷却中)`, `本回合无法再打出【${name}】。`,
//         'debuff', STATUS_GROUP.combatStatus, [STATUS_TYPE.Round, STATUS_TYPE.Sign], -1, 0, 1);


const statusTotal: Record<number, (version: Version, ...args: any) => Status> = {
    // 2000: () => new GIStatus(2000, '', '', '', -1, [], 0, 0, 0),

    111012: () => new GIStatus(111012, '冰莲', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
        '', STATUS_GROUP.combatStatus, [STATUS_TYPE.Barrier], 2, 0, -1, (status, event = {}) => {
            const { restDmg = 0 } = event;
            if (restDmg <= 0) return { restDmg }
            --status.useCnt;
            return { restDmg: restDmg - 1 }
        }),

    // 2002: (isTalent = false) => new GIStatus(2002, '雨帘剑', `【我方出战角色受到至少为${isTalent ? 2 : 3}的伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】`,
    //     '', 1, [2], isTalent ? 3 : 2, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg < 3 - +status.isTalent) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: restDmg - 1 }
    //     }, { isTalent }),

    // 2003: () => new GIStatus(2003, '虹剑势', '【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1102,2', 1, [1], 3, 0, -1, () => ({
    //         damage: 1,
    //         element: 1,
    //         trigger: ['after-skilltype1'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     }), { icbg: STATUS_BG_COLOR[1] }),

    106: () => new GIStatus(106, '冻结', '角色无法使用技能持续到回合结束。；角色受到[火元素伤害]或[物理伤害]时，移除此效果，使该伤害+2',
        'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Frozen.webp',
        STATUS_GROUP.heroStatus, [STATUS_TYPE.Round, STATUS_TYPE.Sign, STATUS_TYPE.NonAction], -1, 0, 1, (status, event = {}) => {
            const { trigger = '' } = event;
            if (['Physical-getdmg', 'Pyro-getdmg'].includes(trigger)) {
                return { addDmgCdt: 2, exec: () => { --status.roundCnt } }
            }
        }),

    116: () => new GIStatus(116, '草原核', '【我方对敌方出战角色造成[火元素伤害]或[雷元素伤害]时，】伤害值+2。；【[可用次数]：{useCnt}】',
        'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Reaction_116.webp',
        STATUS_GROUP.combatStatus, [STATUS_TYPE.AddDamage], 1, 0, -1, (status, event = {}) => {
            const { eheros = [], getDmgIdx = -1 } = event;
            if (!eheros[getDmgIdx]?.isFront) return;
            return {
                addDmgCdt: 2,
                trigger: ['Pyro-dmg', 'Electro-dmg'],
                exec: () => { --status.useCnt },
            }
        }),

    117: () => new GIStatus(117, '激化领域', '【我方对敌方出战角色造成[雷元素伤害]或[草元素伤害]时，】伤害值+1。；【[可用次数]：{useCnt}】',
        'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Reaction_117.webp',
        STATUS_GROUP.combatStatus, [STATUS_TYPE.AddDamage], 2, 0, -1, (status, event = {}) => {
            const { eheros = [], getDmgIdx = -1 } = event;
            if (!eheros[getDmgIdx]?.isFront) return;
            return {
                addDmgCdt: 1,
                trigger: ['Dendro-dmg', 'Electro-dmg'],
                exec: () => { --status.useCnt },
            }
        }),

    111: () => shieldStatus(111, '结晶', 1, 2),

    111052: (_, el: PureElementType, rcnt = 1, addDmg = 0) =>
        new GIStatus(111052, `${ELEMENT_NAME[el]}附魔`, `所附属角色造成的[物理伤害]变为[${ELEMENT_NAME[el]}伤害]${addDmg > 0 ? `，且造成的[${ELEMENT_NAME[el]}伤害]+${addDmg}` : ''}。；【[持续回合]：{roundCnt}】`,
            `buff${addDmg > 0 ? '4' : ''}`, STATUS_GROUP.heroStatus, [STATUS_TYPE.Enchant], -1, 0, rcnt, status => ({
                attachEl: STATUS_BG_COLOR_KEY[status.UI.iconBg] as PureElementType,
                addDmg: -status.perCnt,
            }), { pct: -addDmg }),

    303300: () => new GIStatus(303300, '饱腹', '本回合无法食用更多的｢料理｣。',
        'satiety', STATUS_GROUP.heroStatus, [STATUS_TYPE.Round, STATUS_TYPE.Sign], -1, 0, 1),

    // 2010: () => new GIStatus(2010, '换班时间(生效中)', '【我方下次执行｢切换角色｣行动时：】少花费1个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, -1, status => ({
    //         minusDiceHero: 1,
    //         trigger: ['change-from'],
    //         exec: (_eStatus, execEvent = {}) => {
    //             let { switchHeroDiceCnt = 0 } = execEvent;
    //             if (switchHeroDiceCnt > 0) {
    //                 --status.useCnt;
    //                 --switchHeroDiceCnt;
    //             }
    //             return { switchHeroDiceCnt }
    //         }
    //     })),

    // 2011: () => new GIStatus(2011, '交给我吧！(生效中)', '【我方下次执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。',
    //     'buff3', 1, [4, 10], 1, 0, -1, status => ({
    //         isQuickAction: true,
    //         trigger: ['change-from'],
    //         exec: (_eStatus, execEvent = {}) => {
    //             const { isQuickAction = false } = execEvent;
    //             if (isQuickAction) --status.useCnt
    //         },
    //     })),

    // 2012: () => new GIStatus(2012, '泡影', '【我方造成技能伤害时：】移除此状态，使本次伤害加倍。',
    //     'ski1103,2', 1, [5, 10], 1, 0, -1, status => {
    //         --status.useCnt;
    //         return { multiDmgCdt: 2 }
    //     }, { icbg: STATUS_BG_COLOR[1] }),

    // 2013: (summonId: number) => new GIStatus(2013, '虚影', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
    //     '', 1, [2], 1, 0, 1, (status, event = {}) => {
    //         const { restDmg = 0, summon } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         if (summon) --summon.useCnt;
    //         return { restDmg: restDmg - 1 }
    //     }, { smnId: summonId }),

    // 2014: () => new GIStatus(2014, '绝云锅巴(生效中)', '本回合中，目标角色下一次｢普通攻击｣造成的伤害+1。',
    //     'buff5', 0, [4, 6, 10], 1, 0, 1, status => ({
    //         addDmgType1: 1,
    //         trigger: ['skilltype1'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2015: () => new GIStatus(2015, '仙跳墙(生效中)', '本回合中，目标角色下一次｢元素爆发｣造成的伤害+3。',
    //     'buff2', 0, [4, 6, 10], 1, 0, 1, status => ({
    //         addDmgType3: 3,
    //         trigger: ['skilltype3'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2016: () => new GIStatus(2016, '烤蘑菇披萨(生效中)', '两回合内结束阶段再治疗此角色1点。',
    //     'heal', 0, [3], 2, 0, -1, (_status, event = {}) => {
    //         const { hidx = -1 } = event;
    //         return {
    //             trigger: ['phase-end'],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //                 return { cmds: [{ cmd: 'heal', cnt: 1, hidxs: [hidx] }] }
    //             },
    //         }
    //     }),

    // 2017: () => new GIStatus(2017, '鹤归之时(生效中)', '【我方下一次使用技能后：】将下一个我方后台角色切换到场上。',
    //     'buff3', 1, [4, 10], 1, 0, -1, status => ({
    //         trigger: ['skill'],
    //         cmds: [{ cmd: 'switch-after', cnt: 2500 }],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2018: () => new GIStatus(2018, '莲花酥(生效中)', '本回合中，目标角色下次受到的伤害-3。',
    //     '', 0, [2, 10], 1, 0, 1, (status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: Math.max(0, restDmg - 3) }
    //     }),

    // 2019: () => new GIStatus(2019, '兽肉薄荷卷(生效中)', '本回合中，该角色｢普通攻击｣少花费1个[无色元素骰]。；【[可用次数]：{useCnt}】',
    //     'buff2', 0, [4], 3, 0, 1, (status, event = {}) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             },
    //         }
    //     }),

    // 2020: () => new GIStatus(2020, '旋火轮', '【我方角色使用技能后：】造成2点[火元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1202,2', 1, [1], 2, 0, -1, () => ({
    //         damage: 2,
    //         element: 2,
    //         trigger: ['after-skill'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     }), { icbg: STATUS_BG_COLOR[2] }),

    // 2021: () => new GIStatus(2021, '北地烟熏鸡(生效中)', '本回合中，目标角色下一次｢普通攻击｣少花费1个[无色元素骰]。',
    //     'buff2', 0, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             },
    //         }
    //     }),

    // 2022: () => new GIStatus(2022, '复苏冷却中', '本回合无法通过｢料理｣复苏角色。', 'satiety', 1, [3, 10], -1, 0, 1),

    // 2023: () => new GIStatus(2023, '刺身拼盘(生效中)', '本回合中，该角色｢普通攻击｣造成的伤害+1。',
    //     'buff2', 0, [4, 6, 10], -1, 0, 1, () => ({ addDmgType1: 1 })),

    // 2024: () => new GIStatus(2024, '唐杜尔烤鸡(生效中)', '本回合中，所附属角色下一次｢元素战技｣造成的伤害+2。',
    //     'buff2', 0, [4, 6, 10], 1, 0, 1, status => ({
    //         addDmgType2: 2,
    //         trigger: ['skilltype2'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2025: () => new GIStatus(2025, '黄油蟹蟹(生效中)', '本回合中，所附属角色下次受到伤害-2。',
    //     '', 0, [2, 10], 1, 0, 1, (status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: Math.max(0, restDmg - 2) }
    //     }),

    // 2026: (useCnt: number) => new GIStatus(2026, '千岩之护', '根据｢璃月｣角色的数量提供[护盾]，保护所附属角色。', '', 0, [7], useCnt, 0, -1),

    // 2027: () => new GIStatus(2027, '璇玑屏', '【我方出战角色受到至少为2的伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
    //     '', 1, [2, 6], 2, 0, -1, (status, event = {}) => {
    //         const { restDmg = -1, heros = [] } = event;
    //         if (restDmg > -1) {
    //             if (restDmg < 2) return { restDmg }
    //             --status.useCnt;
    //             return { restDmg: restDmg - 1 }
    //         }
    //         if (!heros.find(h => h.id == 1501)?.talentSlot) return;
    //         return {
    //             trigger: ['rock-dmg'],
    //             addDmgCdt: 1,
    //         }
    //     }),

    // 2028: () => new GIStatus(2028, '新叶', '【我方角色的技能引发[草元素相关反应]后：】造成1点[草元素伤害]。(每回合1次)；【[持续回合]：{roundCnt}】',
    //     'buff6', 1, [1], 1, 0, 1, () => ({
    //         damage: 1,
    //         element: 7,
    //         trigger: ['el7Reaction'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     })),

    // 2029: () => new GIStatus(2029, '元素共鸣：热诚之火(生效中)', '本回合中，我方当前出战角色下一次引发[火元素相关反应]时，造成的伤害+3。',
    //     'buff2', 0, [6, 10], 1, 0, 1, (status, event = {}) => ({
    //         addDmgCdt: 3,
    //         trigger: (event?.isSkill ?? -1) > -1 ? ['el2Reaction'] : [],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2030: () => new GIStatus(2030, '元素共鸣：粉碎之冰(生效中)', '本回合中，我方当前出战角色下一次造成的伤害+2。',
    //     'buff2', 0, [6, 10], 1, 0, 1, status => ({
    //         addDmg: 2,
    //         trigger: ['skill'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2031: () => new GIStatus(2031, '元素共鸣：坚定之岩(生效中)', '【本回合中，我方角色下一次造成[岩元素伤害]后：】如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充3点[护盾]。',
    //     'buff2', 1, [4, 10], 1, 0, 1, (_status, event = {}) => {
    //         const { hidx = -1, isSkill = -1 } = event;
    //         return {
    //             trigger: ['rock-dmg'],
    //             isAddTask: true,
    //             exec: (eStatus, execEvent = {}) => {
    //                 if (!eStatus) return;
    //                 const { heros = [] } = execEvent;
    //                 const shieldStatus = heros[hidx]?.outStatus.find(ost => ost.type.includes(7));
    //                 if (shieldStatus && isSkill > -1) {
    //                     shieldStatus.useCnt += 3;
    //                     --eStatus.useCnt;
    //                 }
    //             }
    //         }
    //     }),

    // 2032: () => new GIStatus(2032, '元素共鸣：蔓生之草(生效中)', '本回合中，我方下一次引发元素反应时，造成的伤害+2。',
    //     'buff2', 1, [4, 6, 10], 1, 0, 1, status => ({
    //         addDmgCdt: 2,
    //         trigger: ['elReaction'],
    //         exec: () => { --status.useCnt },
    //     })),

    111021: (_, isTalent = false) => new GIStatus(111021, '猫爪护盾', '为我方出战角色提供1点[护盾]。',
        '', STATUS_GROUP.combatStatus, [STATUS_TYPE.Shield], isTalent ? 2 : 1, 0, -1, undefined, { isTalent }),

    // 2034: (isTalent = false) => new GIStatus(2034, '鼓舞领域', '【我方角色使用技能时：】如果该角色生命值至少为7，则使此伤害额外+2; 技能结算后，如果该角色生命值不多于6，则治疗该角色2点。；【[持续回合]：{roundCnt}】',
    //     'ski1203,2', 1, [1, 4, 6], -1, 0, 2, (status, event = {}) => {
    //         const { heros = [], hidx = -1, trigger = '' } = event;
    //         if (hidx == -1) return;
    //         const fHero = heros[hidx];
    //         return {
    //             trigger: ['skill', 'after-skill'],
    //             addDmgCdt: isCdt(fHero.hp >= 7 || status.isTalent, 2),
    //             heal: isCdt(fHero.hp <= 6 && trigger == 'after-skill', Math.min(2, fHero.maxhp - fHero.hp)),
    //         }
    //     }, { icbg: STATUS_BG_COLOR[2], isTalent }),

    // 2035: () => new GIStatus(2035, '雷狼', '【所附属角色使用｢普通攻击｣或｢元素战技｣后：】造成2点[雷元素伤害]。；【[持续回合]：{roundCnt}】',
    //     'ski1302,2', 0, [1], -1, 0, 2, () => ({
    //         damage: 2,
    //         element: 3,
    //         trigger: ['after-skilltype1', 'after-skilltype2'],
    //     }), { icbg: STATUS_BG_COLOR[3] }),

    // 2036: () => new GIStatus(2036, '护体岩铠', '为我方出战角色提供2点[护盾]。此[护盾]耗尽前，我方受到的[物理伤害]减半。(向上取整)',
    //     '', 1, [7], 2, 0, -1, (_status, event = {}) => {
    //         const { restDmg = 0, willAttach = -1 } = event;
    //         if (restDmg < 2 || willAttach > 0) return { restDmg }
    //         return { restDmg: Math.ceil(restDmg / 2) }
    //     }),

    // 2037: () => new GIStatus(2037, '大扫除', '【角色使用｢普通攻击｣时：】少花费1个[岩元素骰]。(每回合1次)；角色｢普通攻击｣造成的伤害+2，造成的[物理伤害]变为[岩元素伤害]。；【[持续回合]：{roundCnt}】',
    //     'ski1502,2', 0, [6, 8], -1, 0, 2, (status, event = {}) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => status.perCnt > 0);
    //         return {
    //             addDmgType1: 2,
    //             ...minusSkillRes,
    //             trigger: ['skilltype1'],
    //             attachEl: 6,
    //             exec: () => {
    //                 if (status.perCnt > 0 && isMinusSkill) --status.perCnt;
    //             },
    //         }
    //     }, { pct: 1, icbg: STATUS_BG_COLOR[6] }),

    111031: () => new GIStatus(111031, '寒冰之棱', '【我方切换角色后：】造成2点[冰元素伤害]。；【[可用次数]：{useCnt}】',
        'ski1003,2', STATUS_GROUP.combatStatus, [STATUS_TYPE.Attack], 3, 0, -1, () => ({
            damage: 2,
            element: ELEMENT_TYPE.Cryo,
            trigger: ['change-from'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    // 2039: (isTalent = false) => new GIStatus(2039, '重华叠霜领域', `我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[冰元素伤害]${isTalent ? '，｢普通攻击｣造成的伤害+1' : ''}。；【[持续回合]：{roundCnt}】`,
    //     'buff', 1, isTalent ? [6, 8] : [8], -1, 0, 2, (status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         const isWeapon = hidx > -1 && [1, 2, 5].includes(heros[hidx]?.weaponType ?? 0);
    //         return {
    //             trigger: ['skilltype1'],
    //             addDmgType1: isCdt(status.isTalent && isWeapon, 1),
    //             attachEl: isCdt(isWeapon, 4),
    //         }
    //     }, { icbg: STATUS_BG_COLOR[4], isTalent }),

    // 2040: (isTalent = false) => new GIStatus(2040, '庭火焰硝', `所附属角色｢普通攻击｣伤害+1，造成的[物理伤害]变为[火元素伤害]。${isTalent ? '；【所附属角色使用｢普通攻击｣后：】造成1点[火元素伤害]。' : ''}；【[可用次数]：{useCnt}】`,
    //     'buff4', 0, [1, 6, 8], 3, 0, -1, (status, event = {}) => {
    //         const { trigger = '' } = event;
    //         return {
    //             trigger: ['skilltype1', 'after-skilltype1'],
    //             addDmgType1: 1,
    //             damage: isCdt(status.isTalent && trigger.endsWith('skilltype1'), 1),
    //             element: 2,
    //             attachEl: 2,
    //             exec: eStatus => {
    //                 if (!status.isTalent) --status.useCnt;
    //                 else if (eStatus) --eStatus.useCnt;
    //             },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[2], isTalent }),

    // 2041: () => new GIStatus(2041, '琉金火光', '【hro1204】以外的我方角色使用技能后：造成1点[火元素伤害]。；【[持续回合]：{roundCnt}】',
    //     'ski1204,2', 1, [1], -1, 0, 2, (_status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         return {
    //             damage: 1,
    //             element: 2,
    //             trigger: isCdt(hidx > -1 && heros[hidx].id != 1204, ['after-skill']),
    //         }
    //     }, { icbg: STATUS_BG_COLOR[2] }),

    // 2042: (summonId: number) => new GIStatus(2042, '纯水幻形·蛙', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
    //     '', 1, [2], 1, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0, summon } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         if (summon) --summon.useCnt;
    //         return { restDmg: restDmg - 1 }
    //     }, { smnId: summonId }),

    // 2043: (isTalent = false) => new GIStatus(2043, '水光破镜', '所附属角色受到的[水元素伤害]+1。；【[持续回合]：{roundCnt}】；(同一方场上最多存在一个此状态)',
    //     'debuff', 0, isTalent ? [4, 6] : [6], -1, 0, isTalent ? 3 : 2, status => {
    //         const trigger: Trigger[] = ['water-getdmg'];
    //         if (status.isTalent) trigger.push('change-from');
    //         return {
    //             getDmg: 1,
    //             addDiceHero: isCdt(status.isTalent, 1),
    //             trigger,
    //             onlyOne: true,
    //         }
    //     }, { isTalent }),

    // 2044: (isTalent = false) => new GIStatus(2044, '潜行', '所附属角色受到的伤害-1，造成的伤害+1。；【[可用次数]：{useCnt}】',
    //     '', 0, isTalent ? [2, 6, 8] : [2, 6], isTalent ? 3 : 2, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg > 0) --status.useCnt;
    //         return {
    //             addDmg: 1,
    //             restDmg: Math.max(0, restDmg - 1),
    //             trigger: ['skill'],
    //             attachEl: isCdt(status.isTalent, 2),
    //             exec: () => { --status.useCnt },
    //         }
    //     }, { isTalent }),

    // 2045: () => new GIStatus(2045, '岩盔', '【所附属角色受到伤害时：】抵消1点伤害。；抵消[岩元素伤害]时，需额外消耗1次[可用次数]。；【[可用次数]：{useCnt}】',
    //     '', 0, [2], 3, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0, willAttach = 0, heros = [], hidx = -1 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         if (status.useCnt > 0 && willAttach == 6) --status.useCnt;
    //         if (status.useCnt == 0) {
    //             const ist2046 = heros[hidx].inStatus.find(ist => ist.id == 2046);
    //             if (ist2046) ist2046.useCnt = 0;
    //         }
    //         return { restDmg: restDmg - 1 }
    //     }),

    // 2046: () => new GIStatus(2046, '坚岩之力', '角色造成的[物理伤害]变为[岩元素伤害]。；【每回合1次：】角色造成的伤害+1。；【角色所附属的岩盔被移除后：】也移除此状态。',
    //     'buff4', 0, [4, 6, 8, 10], 1, 0, -1, status => ({
    //         addDmg: isCdt(status.perCnt > 0, 1),
    //         trigger: ['skill'],
    //         attachEl: 6,
    //         exec: () => {
    //             if (status.perCnt > 0) --status.perCnt;
    //         },
    //     }), { pct: 1, icbg: STATUS_BG_COLOR[6] }),

    // 2047: () => new GIStatus(2047, '活化激能', '【本角色造成或受到元素伤害后：】累积1层｢活化激能｣。(最多累积3层)；【结束阶段：】如果｢活化激能｣层数已达到上限，就将其清空。同时，角色失去所有[充能]。',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_FungusRaptor_S.webp',
    //     0, [9], 0, 3, -1, (status, event = {}) => {
    //         const { trigger = '', heros = [], hidx = -1 } = event;
    //         return {
    //             trigger: ['el-dmg', 'el-getdmg', 'phase-end'],
    //             exec: () => {
    //                 if (hidx == -1) return;
    //                 const hero = heros[hidx];
    //                 const maxCnt = status.maxCnt + +!!hero.talentSlot;
    //                 if (trigger == 'phase-end') {
    //                     if (status.useCnt == maxCnt) {
    //                         status.useCnt = 0;
    //                         return { cmds: [{ cmd: 'getEnergy', cnt: -hero.energy, hidxs: [hidx] }] }
    //                     }
    //                 } else if (status.useCnt < maxCnt) {
    //                     ++status.useCnt;
    //                 }
    //             },
    //         }
    //     }),

    301102: () => new GIStatus(301102, '千年的大乐章·别离之歌', '我方角色造成的伤害+1。；【[持续回合]：{roundCnt}】',
        'buff5', STATUS_GROUP.heroStatus, [STATUS_TYPE.Round, STATUS_TYPE.AddDamage], -1, 0, 2, () => ({ addDmg: 1 })),

    // 2049: () => shieldStatus(2049, '叛逆的守护', 1, 2),

    // 2050: () => new GIStatus(2050, '重嶂不移', '提供2点[护盾]，保护所附属角色。', '', 0, [7], 2, 0, -1),

    // 2051: () => new GIStatus(2051, '重攻击(生效中)', '本回合中，当前我方出战角色下次｢普通攻击｣造成的伤害+1。；【此次｢普通攻击｣为[重击]时：】伤害额外+1。',
    //     'buff3', 0, [6, 10], 1, 0, 1, (status, event = {}) => ({
    //         addDmgType1: 1,
    //         addDmgCdt: isCdt(event?.isChargedAtk, 1),
    //         trigger: ['skilltype1'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2052: () => new GIStatus(2052, '大梦的曲调(生效中)', '【我方下次打出｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, -1, (status, event = {}) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && [0, 1].some(v => card.subType.includes(v)) && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 1,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 2053: () => new GIStatus(2053, '藏锋何处(生效中)', '【本回合中，我方下一次打出｢武器｣手牌时：】少花费2个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.subType.includes(0) && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 2,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 2054: () => new GIStatus(2054, '自由的新风(生效中)', '【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；【[可用次数]：{useCnt}】',
    //     'buff3', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { card, playerInfo: { isKillCurRound = false } = {} } = event;
    //         if (!isKillCurRound) return;
    //         const triggers: Trigger[] = ['kill', 'skill', 'change-from'];
    //         if (card?.subType.includes(7)) triggers.push('card');
    //         return {
    //             trigger: triggers,
    //             isQuickAction: true,
    //             exec: (_eStatus, execEvent = {}) => {
    //                 if (execEvent.isQuickAction) --status.useCnt;
    //             },
    //         }
    //     }),

    // 2055: () => new GIStatus(2055, '旧时庭园(生效中)', '本回合中，我方下次打出｢武器｣或｢圣遗物｣装备牌时少花费2个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.subType.some(v => v < 2) && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 2,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 2056: () => new GIStatus(2056, '风与自由(生效中)', '【本回合中，我方角色使用技能后：】将下一个我方后台角色切换到场上。',
    //     'buff2', 1, [4, 10], 1, 0, 1, status => ({
    //         trigger: ['skill'],
    //         cmds: [{ cmd: 'switch-after', cnt: 2500 }],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2057: () => new GIStatus(2057, '岩与契约(生效中)', '【下回合行动阶段开始时：】生成3点[万能元素骰]，并摸1张牌。',
    //     'buff3', 1, [4, 10], 1, 0, -1, () => ({
    //         trigger: ['phase-start'],
    //         cmds: [{ cmd: 'getDice', cnt: 3, element: 0 }, { cmd: 'getCard', cnt: 1 }],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     })),

    // 2058: (isTalent = false) => new GIStatus(2058, '爆裂火花', '【所附属角色进行[重击]时：】少花费1个[火元素骰]，并且伤害+1。；【[可用次数]：{useCnt}】',
    //     'buff5', 0, [4, 6], isTalent ? 2 : 1, 0, -1, (status, event = {}) => {
    //         if (!event.isChargedAtk) return;
    //         const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] });
    //         return {
    //             trigger: ['skilltype1'],
    //             addDmgCdt: 1,
    //             ...minusSkillRes,
    //             exec: () => { --status.useCnt },
    //         }
    //     }, { isTalent }),

    // 2059: () => new GIStatus(2059, '轰轰火花', '【所在阵营的角色使用技能后：】对所在阵营的出战角色造成2点[火元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1205,2', 1, [1], 2, 0, -1, () => ({
    //         damage: 2,
    //         element: 2,
    //         isSelf: true,
    //         trigger: ['after-skill'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         }
    //     }), { icbg: DEBUFF_BG_COLOR }),

    // 2060: () => new GIStatus(2060, '启途誓使', '【结束阶段：】累积1级｢凭依｣。；【根据｢凭依｣级数，提供效果：】；大于等于2级：[物理伤害]转化为[雷元素伤害];；大于等于4级：造成的伤害+2;；大于等于6级：｢凭依｣级数-4。',
    //     'ski1304,2', 0, [8, 9], 0, 6, -1, (status, event = {}) => {
    //         const { trigger = '' } = event;
    //         const isAttachEl = status.useCnt >= 2;
    //         return {
    //             trigger: ['phase-end', 'skilltype3'],
    //             addDmg: isCdt(status.useCnt >= 4, 2),
    //             attachEl: isCdt(isAttachEl, 3),
    //             isUpdateAttachEl: isAttachEl,
    //             exec: () => {
    //                 if (trigger == 'phase-end') ++status.useCnt;
    //                 else if (trigger == 'skilltype3') status.useCnt += 2;
    //                 if (status.useCnt >= status.maxCnt) status.useCnt -= 4;
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[3] }),

    301103: (name: string) => senlin1Sts(301103, name),

    301104: (name: string) => senlin1Sts(301104, name),

    // 2062: () => readySkillShieldStatus(2062, '捉浪·涛拥之守'),

    // 2063: () => new GIStatus(2063, '雷兽之盾', '【我方角色｢普通攻击｣后：】造成1点[雷元素伤害]。；【我方角色受到至少为3的伤害时：】抵消其中1点伤害。；【[持续回合]：{roundCnt}】',
    //     'ski1305,2', 0, [1, 2], -1, 0, 2, (_status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         return {
    //             damage: 1,
    //             element: 3,
    //             trigger: ['after-skilltype1'],
    //             restDmg: restDmg < 3 ? restDmg : restDmg - 1,
    //         }
    //     }, { icbg: STATUS_BG_COLOR[3] }),

    // 2064: () => new GIStatus(2064, '鸣煌护持', '所附属角色｢元素战技｣和｢元素爆发｣造成的伤害+1。；【[可用次数]：{useCnt}】',
    //     'buff5', 0, [6], 2, 0, -1, (status, event = {}) => {
    //         const { skilltype, hasDmg = false } = event;
    //         const trigger: Trigger[] = [];
    //         if (hasDmg && ([SKILL_TYPE.Elemental, SKILL_TYPE.Burst] as SkillType[]).includes(skilltype)) {
    //             trigger.push(`skilltype${skilltype}`);
    //         }
    //         return {
    //             addDmgType2: 1,
    //             addDmgType3: 1,
    //             trigger,
    //             exec: () => { --status.useCnt },
    //         }
    //     }),

    // 2065: () => new GIStatus(2065, '仪来羽衣', '所附属角色｢普通攻击｣造成的伤害+1。；【所附属角色｢普通攻击｣后：】治疗所有我方角色1点。；【[持续回合]：{roundCnt}】',
    //     'ski1104,2', 0, [1, 6], -1, 0, 2, (_status, event = {}) => {
    //         const { heros = [], trigger = '' } = event;
    //         return {
    //             addDmgType1: 1,
    //             trigger: ['skilltype1', 'after-skilltype1'],
    //             heal: isCdt(trigger == 'after-skilltype1', 1),
    //             hidxs: allHidxs(heros),
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1] }),

    // 2066: () => new GIStatus(2066, '冷酷之心', '【所附属角色使用〖ski1006,1〗时：】移除此状态，使本次伤害+3。',
    //     'buff4', 0, [4, 6, 10], 1, 0, -1, status => ({
    //         trigger: ['skilltype2'],
    //         addDmgCdt: 3,
    //         exec: () => { --status.useCnt },
    //     }), { icbg: STATUS_BG_COLOR[4] }),

    // 2067: () => new GIStatus(2067, '泷廻鉴花', '所附属角色｢普通攻击｣造成的伤害+1，造成的[物理伤害]变为[水元素伤害]。；【[可用次数]：{useCnt}】',
    //     'buff4', 0, [6, 8], 3, 0, -1, status => {
    //         return {
    //             addDmgType1: 1,
    //             trigger: ['skilltype1'],
    //             attachEl: 1,
    //             exec: () => { --status.useCnt },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1] }),

    // 2068: () => new GIStatus(2068, '乱神之怪力', '【所附属角色进行[重击]时：】造成的伤害+1。如果[可用次数]至少为2，则还会使本技能少花费1个[无色元素骰]。；【[可用次数]：{useCnt}】(可叠加，最多叠加到3次)',
    //     'buff4', 0, [6], 1, 3, -1, (status, event = {}) => {
    //         if (!event.isChargedAtk) return;
    //         const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] }, () => status.useCnt >= 2);
    //         return {
    //             addDmgCdt: 1,
    //             ...minusSkillRes,
    //             trigger: ['skilltype1'],
    //             exec: () => { --status.useCnt },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[6] }),

    // 2069: () => new GIStatus(2069, '怒目鬼王', '所附属角色｢普通攻击｣造成的伤害+1，造成的[物理伤害]变为[岩元素伤害]。；【[持续回合]：{roundCnt}】；【所附属角色｢普通攻击｣后：】为其附属【sts2068】。(每回合1次)',
    //     'ski1503,2', 0, [6, 8], -1, 0, 2, status => ({
    //         addDmgType1: 1,
    //         attachEl: 6,
    //         trigger: ['skilltype1'],
    //         exec: () => {
    //             if (status.perCnt <= 0) return;
    //             --status.perCnt;
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2068)] }] }
    //         }
    //     }), { icbg: STATUS_BG_COLOR[6], pct: 1 }),

    // 2070: (summonId: number) => new GIStatus(2070, '阿丑', '【我方出战角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
    //     '', 1, [2], 1, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0, summon } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         if (summon) --summon.useCnt;
    //         return { restDmg: restDmg - 1 }
    //     }, { smnId: summonId }),

    // 2071: () => new GIStatus(2071, '通塞识', '【所附属角色进行[重击]时：】造成的[物理伤害]变为[草元素伤害]，并且会在技能结算后召唤【smn3027】。；【[可用次数]：{useCnt}】',
    //     'buff', 0, [16], 3, 0, -1, (status, event = {}) => {
    //         if (!event.isChargedAtk) return;
    //         return {
    //             summon: [newSummonee(3027)],
    //             trigger: ['skilltype1'],
    //             attachEl: 7,
    //             exec: () => { --status.useCnt },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[7] }),

    // 2072: () => new GIStatus(2072, '辰砂往生录(生效中)', '本回合中，角色｢普通攻击｣造成的伤害+1。',
    //     'buff5', 0, [6, 10], -1, 0, 1, () => ({ addDmgType1: 1 })),

    // 2073: (isTalent = false) => new GIStatus(2073, '冰翎', `我方角色造成的[冰元素伤害]+1。(包括角色引发的‹4冰元素›扩散的伤害)；【[可用次数]：{useCnt}】${isTalent ? '；我方角色通过｢普通攻击｣触发此效果时，不消耗｢[可用次数]｣。(每回合1次)' : ''}`,
    //     'buff4', 1, [6], 2, 0, -1, (status, event = {}) => {
    //         const { skilltype = -1, isSkill = -1 } = event;
    //         return {
    //             addDmgCdt: 1,
    //             trigger: isSkill > -1 ? ['ice-dmg', 'ice-dmg-wind'] : [],
    //             exec: () => {
    //                 if (status.perCnt == 1 && skilltype == 1) {
    //                     --status.perCnt;
    //                 } else {
    //                     --status.useCnt;
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[4], pct: isCdt(isTalent, 1), isTalent }),

    // 2074: () => new GIStatus(2074, '远程状态', '【所附属角色进行[重击]后：】目标角色附属【sts2076】。',
    //     'ski1106,3', 0, [10], -1, 0, -1, (_status, event = {}) => ({
    //         trigger: ['skilltype1'],
    //         exec: () => {
    //             const { isChargedAtk = false } = event;
    //             return { cmds: isCdt<Cmds[]>(isChargedAtk, [{ cmd: 'getStatus', status: [heroStatus(2076)], isOppo: true }]) }
    //         }
    //     }), { icbg: STATUS_BG_COLOR[1] }),

    // 2075: () => new GIStatus(2075, '近战状态', '角色造成的[物理伤害]转换为[水元素伤害]。；【角色进行[重击]后：】目标角色附属【sts2076】。；角色对附属有【sts2076】的角色造成的伤害+1;；【角色对已附属有断流的角色使用技能后：】对下一个敌方后台角色造成1点[穿透伤害]。(每回合至多2次)；【[持续回合]：{roundCnt}】',
    //     'ski1106,1', 0, [3, 6, 8], -1, 0, 2, (status, event = {}) => {
    //         const { isChargedAtk, eheros = [], trigger = '' } = event;
    //         const efHero = eheros.find(h => h.isFront);
    //         const isDuanliu = efHero?.inStatus.some(ist => ist.id == 2076);
    //         let afterIdx = (eheros.findIndex(h => h.isFront) + 1) % eheros.length;
    //         if ((eheros[afterIdx]?.hp ?? 0) <= 0) afterIdx = (eheros.findIndex(h => h.isFront) - 1 + eheros.length) % eheros.length;
    //         if ((eheros[afterIdx]?.hp ?? 0) <= 0) afterIdx = -1;
    //         const isPenDmg = status.perCnt > 0 && isDuanliu && afterIdx > -1 && trigger == 'skill';
    //         return {
    //             trigger: ['phase-end', 'skill'],
    //             pdmg: isCdt(isPenDmg, 1),
    //             hidxs: isCdt(isPenDmg, [afterIdx]),
    //             addDmgCdt: isCdt(isDuanliu, 1),
    //             attachEl: 1,
    //             exec: () => {
    //                 if (trigger == 'phase-end' && status.roundCnt == 1) {
    //                     return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2074)] }] }
    //                 }
    //                 if (isPenDmg) --status.perCnt;
    //                 return { cmds: isCdt<Cmds[]>(isChargedAtk, [{ cmd: 'getStatus', status: [heroStatus(2076)], isOppo: true }]) }
    //             },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1], pct: 2 }),

    // 2076: () => new GIStatus(2076, '断流', '【所附属角色被击倒后：】对所在阵营的出战角色附属【断流】。',
    //     'ski1106,2', 0, [1, 4, 10, 12], -1, 0, -1, (status, event = {}) => {
    //         const { heros = [], hidx = -1, eheros = [], hidxs, trigger = '' } = event;
    //         const triggers: Trigger[] = ['killed'];
    //         const isTalent = trigger == 'phase-end' && !!eheros.find(h => h.id == 1106)?.talentSlot && heros[hidx].isFront;
    //         if (isTalent) triggers.push('phase-end');
    //         return {
    //             trigger: triggers,
    //             pdmg: isCdt(isTalent, 1),
    //             hidxs: isCdt(isTalent, [hidx]),
    //             isSelf: isCdt(isTalent, true),
    //             exec: () => {
    //                 if (trigger == 'killed') {
    //                     const type12 = status.type.indexOf(12);
    //                     if (type12 > -1) status.type.splice(type12, 1);
    //                     return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2076, status.icon)], hidxs }] }
    //                 }
    //             }
    //         }
    //     }, { icbg: DEBUFF_BG_COLOR }),

    // 2077: (summonId: number) => new GIStatus(2077, '兔兔伯爵', '【我方出战角色受到伤害时：】抵消2点伤害。；【[可用次数]：{useCnt}】',
    //     '', 1, [2], 1, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0, summon } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         if (summon) --summon.useCnt;
    //         return { restDmg: Math.max(0, restDmg - 2) }
    //     }, { smnId: summonId }),

    // 2078: () => new GIStatus(2078, '彼岸蝶舞', '所附属角色造成的[物理伤害]变为[火元素伤害]，且角色造成的[火元素伤害]+1。；【所附属角色进行[重击]时：】目标角色附属【sts2079】。；【[持续回合]：{roundCnt}】',
    //     'buff5', 0, [8], -1, 0, 2, (_status, event = {}) => ({
    //         addDmg: 1,
    //         attachEl: 2,
    //         trigger: ['skill'],
    //         exec: () => ({ cmds: isCdt<Cmds[]>(event.isChargedAtk, [{ cmd: 'getStatus', status: [heroStatus(2079)], isOppo: true }]) })
    //     })),

    // 2079: () => new GIStatus(2079, '血梅香', '【结束阶段：】对所附属角色造成1点[火元素伤害]。；【[可用次数]：{useCnt}】',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Dot.webp',
    //     0, [1], 1, 0, -1, () => ({
    //         damage: 1,
    //         element: 2,
    //         isSelf: true,
    //         trigger: ['phase-end'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     })),

    // 2080: () => new GIStatus(2080, '诸愿百眼之轮', '【其他我方角色使用｢元素爆发｣后：】累积1点｢愿力｣。(最多累积3点)；【所附属角色使用〖ski1307,2〗时：】消耗所有｢愿力｣，每点｢愿力｣使造成的伤害+1。',
    //     'ski1307,2', 0, [6, 9], 0, 3, -1, (status, event = {}) => {
    //         const { trigger = '' } = event;
    //         return {
    //             trigger: ['other-skilltype3', 'skilltype3'],
    //             exec: () => {
    //                 if (trigger == 'skilltype3') {
    //                     status.useCnt = 0;
    //                 } else if (trigger == 'other-skilltype3') {
    //                     status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[3] }),

    // 2081: () => new GIStatus(2081, '天狐霆雷', '【我方选择行动前：】造成3点[雷元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1308,2', 1, [1, 10], 1, 0, -1, () => ({
    //         damage: 3,
    //         element: 3,
    //         trigger: ['action-start'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     }), { icbg: STATUS_BG_COLOR[3] }),

    // 2082: (isTalent = false) => new GIStatus(2082, '风域', `【我方执行｢切换角色｣行动时：】少花费1个元素骰。${isTalent ? '触发该效果后，使本回合中我方角色下次｢普通攻击｣少花费1个[无色元素骰]。' : ''}；【[可用次数]：{useCnt}】`,
    //     'buff3', 1, [4], 2, 0, -1, status => ({
    //         minusDiceHero: 1,
    //         trigger: ['change-from'],
    //         exec: (_eStatus, execEvent = {}) => {
    //             const { switchHeroDiceCnt = 0 } = execEvent;
    //             if (switchHeroDiceCnt == 0) return { switchHeroDiceCnt }
    //             --status.useCnt;
    //             return {
    //                 switchHeroDiceCnt: switchHeroDiceCnt - 1,
    //                 outStatus: isCdt(status.isTalent, [heroStatus(2108)]),
    //             }
    //         }
    //     }), { isTalent }),

    // 2084: () => new GIStatus(2084, '红羽团扇(生效中)', '本回合中，我方执行的下次｢切换角色｣行动视为｢[快速行动]｣而非｢[战斗行动]｣，并且少花费1个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, -1, status => ({
    //         minusDiceHero: 1,
    //         isQuickAction: true,
    //         trigger: ['change-from'],
    //         exec: (_eStatus, execEvent = {}) => {
    //             const { switchHeroDiceCnt = 0, isQuickAction = false } = execEvent;
    //             if (switchHeroDiceCnt == 0 && !isQuickAction) return { switchHeroDiceCnt }
    //             --status.useCnt;
    //             return { switchHeroDiceCnt: Math.max(0, switchHeroDiceCnt - 1) }
    //         }
    //     })),

    // 2085: () => new GIStatus(2085, '夜叉傩面', '所附属角色造成的[物理伤害]变为[风元素伤害]，且角色造成的[风元素伤害]+1。；【所附属角色进行[下落攻击]时：】伤害额外+2。；【所附属角色为出战角色，我方执行｢切换角色｣行动时：】少花费1个元素骰。(每回合1次)；【[持续回合]：{roundCnt}】',
    //     'ski1404,2', 0, [4, 6, 8], -1, 0, 2, (status, event = {}) => {
    //         const { isFallAtk = false, trigger = '' } = event;
    //         return {
    //             addDmg: 1,
    //             addDmgCdt: isCdt(isFallAtk, 2),
    //             minusDiceHero: status.perCnt,
    //             trigger: ['wind-dmg', 'change-from'],
    //             attachEl: 5,
    //             exec: (_eStatus, execEvent = {}) => {
    //                 if (trigger == 'change-from' && status.perCnt > 0) {
    //                     const { switchHeroDiceCnt = 0 } = execEvent;
    //                     if (switchHeroDiceCnt == 0) return { switchHeroDiceCnt }
    //                     --status.perCnt;
    //                     return { switchHeroDiceCnt: switchHeroDiceCnt - 1 }
    //                 }
    //             },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[5], pct: 1 }),

    // 2086: () => shieldStatus(2086, '玉璋护盾'),

    // 2087: () => new GIStatus(2087, '石化', '【角色无法使用技能。】(持续到回合结束)', 'ski1504,3', 0, [3, 10, 14], -1, 0, 1, undefined, { icbg: DEBUFF_BG_COLOR }),

    // 2088: () => new GIStatus(2088, '蕴种印', '【任意具有蕴种印的所在阵营角色受到元素反应伤害后：】对所有附属角色1点[穿透伤害]。；【[可用次数]：{useCnt}】',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Nahida_S.webp',
    //     0, [1], 2, 0, -1, (_status, event = {}) => {
    //         const { heros = [], eheros = [], hidx = -1 } = event;
    //         const hidxs: number[] = [];
    //         heros.forEach((h, hi) => {
    //             if (h.inStatus.some(ist => ist.id == 2088) && hi != hidx) {
    //                 hidxs.push(hi);
    //             }
    //         });
    //         const fhero = eheros.find(h => h.isFront);
    //         const hasEl2 = eheros.map(h => h.talentSlot).some(slot => slot?.id == 745) &&
    //             fhero?.outStatus?.some(ost => ost.id == 2089) &&
    //             eheros.filter(h => h.hp > 0).some(h => h.element == 2);
    //         if (!hasEl2 && hidx > -1) hidxs.push(hidx);
    //         return {
    //             damage: isCdt(hasEl2, 1),
    //             element: 7,
    //             pdmg: 1,
    //             isSelf: true,
    //             hidxs,
    //             trigger: ['get-elReaction'],
    //             exec: (eStatus, execEvent = {}) => {
    //                 const { heros = [] } = execEvent;
    //                 heros.forEach((h, hi) => {
    //                     if (hidxs.includes(hi)) {
    //                         const ist2088Idx = h.inStatus.findIndex(ist => ist.id == 2088);
    //                         if (ist2088Idx > -1) {
    //                             const ist2088 = h.inStatus[ist2088Idx];
    //                             --ist2088.useCnt;
    //                             if (ist2088.useCnt == 0 && hi != hidx) {
    //                                 h.inStatus.splice(ist2088Idx, 1);
    //                             }
    //                         }
    //                     }
    //                 });
    //                 if (hasEl2 && eStatus) --eStatus.useCnt;
    //             }
    //         }
    //     }),

    // 2089: (isTalent = false) => new GIStatus(2089, '摩耶之殿', '【我方引发元素反应时：】伤害额外+1。；【[持续回合]：{roundCnt}】',
    //     'ski1603,3', 1, [6], -1, 0, isTalent ? 3 : 2, () => ({
    //         addDmgCdt: 1,
    //         trigger: ['elReaction'],
    //     }), { icbg: STATUS_BG_COLOR[7], isTalent }),

    // 2090: (useCnt = 0) => new GIStatus(2090, '流萤护罩', '为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【smn3034】，则额外提供其[可用次数]的[护盾]。(最多额外提供3点[护盾])',
    //     '', 1, [7], 1 + Math.min(3, useCnt), 0, -1),

    // 2091: () => new GIStatus(2091, '雷晶核心', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。',
    //     'heal2', 0, [10, 13], 1, 0, -1, () => ({
    //         trigger: ['will-killed'],
    //         cmds: [{ cmd: 'revive', cnt: 1 }],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         }
    //     })),

    // 2092: () => new GIStatus(2092, '火之新生', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。此效果触发后，此角色造成的[火元素伤害]+1。',
    //     'heal2', 0, [10, 13], 1, 0, -1, (_status, event = {}) => ({
    //         trigger: ['will-killed'],
    //         cmds: [{ cmd: 'revive', cnt: 4 }],
    //         exec: eStatus => {
    //             if (eStatus) {
    //                 --eStatus.useCnt;
    //                 return;
    //             }
    //             const { heros = [], hidx = -1 } = event;
    //             const inStatus = [heroStatus(2191)];
    //             if (heros[hidx]?.talentSlot) {
    //                 heros[hidx].talentSlot = null;
    //                 inStatus.push(heroStatus(2093))
    //             }
    //             return { cmds: [{ cmd: 'getStatus', status: inStatus }] }
    //         }
    //     })),

    // 2093: () => new GIStatus(2093, '渊火加护', '为所附属角色提供2点[护盾]。此[护盾]耗尽后：对所有敌方角色造成1点[穿透伤害]。',
    //     '', 0, [1, 7], 2, 0, -1, (status, event = {}) => {
    //         if (status.useCnt > 0) return;
    //         const { eheros = [] } = event;
    //         return {
    //             trigger: ['status-destroy'],
    //             pdmg: 1,
    //             hidxs: allHidxs(eheros),
    //         }
    //     }),

    // 2094: () => readySkillShieldStatus(2094, '苍鹭护盾'),

    // 2095: (isTalent = false) => new GIStatus(2095, '赤冕祝祷', `我方角色｢普通攻击｣造成的伤害+1。；我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[水元素伤害]。；【我方切换角色后：】造成1点[水元素伤害]。(每回合1次)；${isTalent ? '【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。(每回合1次)；' : ''}【[持续回合]：{roundCnt}】`,
    //     'ski1107,2', 1, [1, 6, 8], -1, 0, 2, (status, event = {}) => {
    //         const { heros = [], hidx = -1, trigger = '' } = event;
    //         const isWeapon = hidx > -1 && [1, 2, 5].includes(heros[hidx]?.weaponType ?? 0);
    //         let isDmg = true;
    //         const triggers: Trigger[] = ['skilltype1'];
    //         if (trigger == 'change-from') {
    //             isDmg = (status.perCnt >> 0 & 1) == 1;
    //             if (isDmg) triggers.push('change-from');
    //         } else if (trigger == 'after-skilltype1' && status.isTalent) {
    //             isDmg = (status.perCnt >> 1 & 1) == 1;
    //             if (isDmg) triggers.push('after-skilltype1');
    //         }
    //         return {
    //             trigger: triggers,
    //             addDmgType1: 1,
    //             damage: isCdt(isDmg, 1),
    //             element: 1,
    //             attachEl: isCdt(isWeapon, 1),
    //             exec: eStatus => {
    //                 const trg = ['change-from', 'after-skilltype1'].indexOf(trigger);
    //                 if (eStatus && trg > -1) eStatus.perCnt &= ~(1 << trg);
    //             },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1], pct: isTalent ? 3 : 1, isTalent }),

    // 2096: () => new GIStatus(2096, '丹火印', '【角色进行[重击]时：】造成的伤害+2。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
    //     'buff5', 0, [6], 1, 2, -1, (status, event = {}) => {
    //         if (!event.isChargedAtk) return;
    //         return {
    //             trigger: ['skilltype1'],
    //             addDmgCdt: 2,
    //             exec: () => { --status.useCnt },
    //         }
    //     }),

    // 2097: () => new GIStatus(2097, '灼灼', '【角色进行[重击]时：】少花费1个[火元素骰]。(每回合1次)；【结束阶段：】角色附属【sts2096】。；【[持续回合]：{roundCnt}】',
    //     'ski1208,2', 0, [3, 4], -1, 0, 2, (status, event = {}) => {
    //         const { isChargedAtk = false, trigger = '' } = event;
    //         const isMinus = isChargedAtk && status.perCnt > 0;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => isMinus);
    //         return {
    //             trigger: ['skilltype1', 'phase-end'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (trigger == 'phase-end') return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2096)] }] }
    //                 if (trigger == 'skilltype1' && isMinus && isMinusSkill) --status.perCnt;
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[2], pct: 1 }),

    // 2098: (windEl = 5) => new GIStatus(2098, '乱岚拨止' + `${windEl < 5 ? '·' + ELEMENT[windEl][0] : ''}`,
    //     `【所附属角色进行[下落攻击]时：】造成的[物理伤害]变为[${ELEMENT[windEl]}伤害]，且伤害+1。；【角色使用技能后：】移除此效果。`,
    //     'buff', 0, [6, 10, 16], 1, 0, -1, (status, event = {}) => {
    //         const { isFallAtk = false } = event;
    //         return {
    //             addDmgCdt: isCdt(isFallAtk, 1),
    //             trigger: ['skill'],
    //             attachEl: isCdt(isFallAtk, STATUS_BG_COLOR.indexOf(status.iconBg)),
    //             exec: () => { --status.useCnt },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[windEl] }),

    // 2099: () => new GIStatus(2099, '引雷', '此状态初始具有2层｢引雷｣; 重复附属时，叠加1层｢引雷｣。｢引雷｣最多可以叠加到4层。；【结束阶段：】叠加1层｢引雷｣。；【所附属角色受到〖ski1309,1〗伤害时：】移除此状态，每层｢引雷｣使此伤害+1。',
    //     'debuff', 0, [6], 2, 4, -1, status => ({
    //         trigger: ['phase-end'],
    //         exec: () => { status.useCnt = Math.min(status.maxCnt, status.useCnt + 1) },
    //     }), { act: 1 }),

    // 2100: () => new GIStatus(2100, '度厄真符', '【我方角色使用技能后：】如果该角色生命值未满，则治疗该角色2点。；【[可用次数]：{useCnt}】',
    //     'ski1008,2', 1, [1], 3, 0, -1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         const fhero = heros[hidx];
    //         const isHeal = (fhero?.hp ?? 0) < (fhero?.maxhp ?? 0);
    //         return {
    //             trigger: ['after-skill'],
    //             heal: isCdt(isHeal, 2),
    //             exec: eStatus => {
    //                 if (isHeal && eStatus) --eStatus.useCnt;
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[4] }),

    // 2101: () => new GIStatus(2101, '拳力斗技！(生效中)', '【本回合中，一位牌手先宣布结束时：】未宣布结束的牌手摸2张牌。',
    //     'buff3', 0, [4, 10], 1, 0, -1, (_status, event = {}) => {
    //         const { phase = -1 } = event;
    //         return {
    //             trigger: ['any-end-phase'],
    //             cmds: [{ cmd: 'getCard', cnt: 2, isOppo: phase > 6 }],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //             }
    //         }
    //     }),

    // 2102: () => new GIStatus(2102, '优风倾姿', '【所附属角色进行｢普通攻击｣时：】造成的伤害+2; 如果敌方存在后台角色，则此技能改为对下一个敌方后台角色造成伤害。；【[可用次数]：{useCnt}】',
    //     'buff5', 0, [6], 2, 0, -1, (status, { trigger = '' } = {}) => ({
    //         addDmgType1: 2,
    //         trigger: ['skilltype1'],
    //         atkOffset: isCdt(trigger == 'skilltype1', 1),
    //         exec: () => { --status.useCnt },
    //     })),

    // 2103: () => new GIStatus(2103, '倾落', '下次从该角色执行｢切换角色｣行动时少花费1个元素骰，并且造成1点[风元素伤害]。；【[可用次数]：{useCnt}】',
    //     'buff6', 0, [1, 4], 1, 0, -1, () => ({
    //         trigger: ['change-from'],
    //         damage: 1,
    //         element: 5,
    //         minusDiceHero: 1,
    //         exec: (eStatus, execEvent = {}) => {
    //             const { switchHeroDiceCnt = -1 } = execEvent;
    //             if (switchHeroDiceCnt > -1) {
    //                 if (switchHeroDiceCnt == 0) return { switchHeroDiceCnt }
    //                 return { switchHeroDiceCnt: switchHeroDiceCnt - 1 }
    //             }
    //             if (eStatus) --eStatus.useCnt;
    //         }
    //     })),

    // 2104: () => new GIStatus(2104, '桂子仙机', '【我方切换角色后：】造成1点[草元素伤害]，治疗我方出战角色1点。；【[可用次数]：{useCnt}】',
    //     'ski1604,2', 1, [1], 3, 0, -1, () => ({
    //         damage: 1,
    //         element: 7,
    //         heal: 1,
    //         trigger: ['change-from'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         }
    //     }), { icbg: STATUS_BG_COLOR[7] }),

    // 2105: (summonId: number) => new GIStatus(2105, '净焰剑狱之护', '【〖hro1209〗在我方后台，我方出战角色受到伤害时：】抵消1点伤害; 然后，如果【hro1209】生命值至少为7，则对其造成1点[穿透伤害]。',
    //     '', 1, [2], 1, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0, heros = [] } = event;
    //         const hero = heros.find(h => h.id == 1209);
    //         if (restDmg <= 0 || !hero || heros[getAtkHidx(heros)]?.id == 1209) return { restDmg }
    //         --status.useCnt;
    //         return {
    //             pdmg: isCdt(hero.hp >= 7, 1),
    //             hidxs: isCdt(hero.hp >= 7, [heros.findIndex(h => h.id == 1209)]),
    //             restDmg: restDmg - 1,
    //         }
    //     }, { smnId: summonId }),

    // 2106: () => shieldStatus(2106, '烈烧佑命护盾', 1, 3),

    // 2107: () => new GIStatus(2107, '奔潮引电', '本回合内所附属的角色｢普通攻击｣少花费1个[无色元素骰]。；【[可用次数]：{useCnt}】',
    //     'buff3', 0, [3, 4], 2, 0, 1, (status, event = {}) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             }
    //         }
    //     }),

    // 2108: () => new GIStatus(2108, '协鸣之风', '本回合中，我方角色下次｢普通攻击｣少花费1个[无色元素骰]。',
    //     'buff3', 0, [3, 4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             }
    //         }
    //     }),

    // 2109: () => new GIStatus(2109, '遣役之仪', '本回合中，所附属角色下次施放【ski1308,1】时少花费2个元素骰。',
    //     'buff3', 0, [3, 4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 2] });
    //         return {
    //             trigger: ['skilltype2'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             }
    //         }
    //     }),

    // 2110: () => new GIStatus(2110, '琴音之诗(生效中)', '【本回合中，我方下一次打出｢圣遗物｣手牌时：】少花费2个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.subType.includes(1) && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 2,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 112081: () => new GIStatus(112081, '金杯的丰馈', '【敌方角色受到绽放反应时：】我方不再生成【sts2005】，而是改为召唤【smn3043】。',
    //     'ski1108,1', 1, [4, 10], -1, 0, -1, (_status, event = {}) => {
    //         const { isElStatus = [] } = event;
    //         return {
    //             trigger: ['get-elReaction-oppo'],
    //             summon: isCdt(isElStatus[0], [newSummonee(3043)]),
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1] }),

    // 2112: () => new GIStatus(2112, '永世流沔', '【结束阶段：】对所附属角色造成3点[水元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1108,2', 0, [1], 1, 0, -1, () => ({
    //         damage: 3,
    //         element: 1,
    //         isSelf: true,
    //         trigger: ['phase-end'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     }), { icbg: DEBUFF_BG_COLOR }),

    // 2113: () => new GIStatus(2113, '脉摄宣明', '【行动阶段开始时：】生成【sts2114】。；【[可用次数]：{useCnt}】',
    //     'ski1605,2', 1, [4], 2, 0, -1, (_status) => ({
    //         trigger: ['phase-start'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2114)] }] }
    //         },
    //     }), { icbg: STATUS_BG_COLOR[7] }),

    // 2114: () => new GIStatus(2114, '无欲气护盾', '提供1点[护盾]，保护我方出战角色。；【此效果被移除，或被重复生成时：】造成1点[草元素伤害]，治疗我方出战角色1点。',
    //     '', 1, [1, 7], 1, 0, -1, (status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         const fhero = heros[hidx];
    //         if (!fhero) return;
    //         const triggers: Trigger[] = [];
    //         if (status.useCnt == 0) triggers.push('status-destroy');
    //         if (fhero.id == 1605) triggers.push('skilltype3');
    //         if (fhero.outStatus.some(ist => ist.id == 2113)) triggers.push('phase-start');
    //         const isTalent = !!heros.find(h => h.id == 1605)?.talentSlot;
    //         return {
    //             damage: 1,
    //             element: 7,
    //             heal: 1,
    //             trigger: triggers,
    //             cmds: isCdt(fhero.hp < fhero.maxhp && isTalent, [{ cmd: 'getDice', cnt: 1, element: -2 }]),
    //         }
    //     }),

    // 2115: () => new GIStatus(2115, '降魔·忿怒显相', '【所附属角色使用〖ski1404,1〗时：】少花费1个[风元素骰]。；【[可用次数]：{useCnt}】；【所附属角色不再附属〖sts2085〗时：】移除此效果。',
    //     'buff2', 0, [3, 4], 2, 0, -1, (status, event = {}) => {
    //         const { heros = [], trigger = '' } = event;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] });
    //         const hasSts2085 = heros?.find(h => h.id == 1404)?.inStatus?.find(ist => ist.id == 2085);
    //         const triggers: Trigger[] = ['skilltype2'];
    //         if (trigger == 'phase-end' && (hasSts2085?.roundCnt ?? 0) <= 1) triggers.push('phase-end');
    //         return {
    //             trigger: triggers,
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (trigger == 'phase-end') status.useCnt = 0;
    //                 else if (isMinusSkill) --status.useCnt;
    //             }
    //         }
    //     }),

    // 2116: () => oncePerRound(2116, '本大爷还没有输！'),

    // 2117: () => new GIStatus(2117, '猜拳三连击·剪刀', '本角色将在下次行动时，直接使用技能：【rsk2】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, (status, event = {}) => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 2,
    //         exec: () => {
    //             const { trigger = '' } = event;
    //             --status.useCnt;
    //             if (trigger == 'change-from') return;
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2118)] }] }
    //         }
    //     })),

    // 2118: () => new GIStatus(2118, '猜拳三连击·布', '本角色将在下次行动时，直接使用技能：【rsk3】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 3,
    //         exec: () => { --status.useCnt },
    //     })),

    // 2119: () => card751sts(1),

    // 2120: () => card751sts(2),

    // 2121: () => card751sts(3),

    // 2122: () => card751sts(4),

    // 2123: () => new GIStatus(2123, '焚落踢', '本角色将在下次行动时，直接使用技能：【rsk5】。',
    //     'ski1209,2', 0, [10, 11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 5,
    //         exec: () => { --status.useCnt },
    //     }), { icbg: STATUS_BG_COLOR[2] }),

    // 2124: () => card587sts(1),

    // 2125: () => card587sts(2),

    // 2126: () => card587sts(3),

    // 2127: () => card587sts(4),

    // 2128: () => shieldStatus(2128, '安眠帷幕护盾'),

    // 2129: () => new GIStatus(2129, '飞星', '【我方角色使用技能后：】累积1枚｢晚星｣。；如果｢晚星｣已有至少4枚，则消耗4枚｢晚星｣，造成1点[冰元素伤害]。(生成此出战状态的技能，也会触发此效果)；【重复生成此出战状态时：】累积2枚｢晚星｣。',
    //     'ski1009,1', 1, [1, 9], 1, 16, -1, (status, event = {}) => {
    //         const { heros = [], hidx = -1, trigger = '', card } = event;
    //         const addCnt = heros[hidx]?.id == 1009 && trigger == 'skilltype2' ? 2 : 0;
    //         const isDmg = status.useCnt + addCnt >= 4;
    //         return {
    //             trigger: [`${isDmg ? 'after-' : ''}skill`],
    //             damage: isCdt(isDmg, 1),
    //             element: 4,
    //             cmds: isCdt(!!heros?.find(h => h.id == 1009)?.talentSlot || card?.id == 761, [{ cmd: 'getCard', cnt: 1 }]),
    //             exec: eStatus => {
    //                 ++status.useCnt;
    //                 if (eStatus) eStatus.useCnt -= 4;
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[4], act: 2 }),

    // 2130: (act = 1) => new GIStatus(2130, '破局', '此状态初始具有1层｢破局｣; 重复附属时，叠加1层｢破局｣。｢破局｣最多可以叠加到3层。；【结束阶段：】叠加1层｢破局｣。；【所附属角色｢普通攻击｣时：】如果｢破局｣已有2层，则消耗2层｢破局｣，使造成的[物理伤害]转换为[水元素伤害]，并摸1张牌。',
    //     'buff', 0, [9, 16], 1, 3, -1, (status, event = {}) => {
    //         const { trigger = '' } = event;
    //         const triggers: Trigger[] = ['phase-end'];
    //         if (status.useCnt >= 2) triggers.push('skilltype1');
    //         return {
    //             trigger: triggers,
    //             attachEl: isCdt(status.useCnt >= 2 && trigger == 'skilltype1', 1),
    //             cmds: isCdt(trigger == 'skilltype1', [{ cmd: 'getCard', cnt: 1 }]),
    //             exec: () => {
    //                 if (trigger == 'skilltype1') status.useCnt -= 2;
    //                 else if (trigger == 'phase-end') status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1], act }),

    // 2131: () => new GIStatus(2131, '玄掷玲珑', '【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。；【[持续回合]：{roundCnt}】',
    //     'ski1109,2', 1, [1], -1, 0, 2, () => ({
    //         damage: 1,
    //         element: 1,
    //         trigger: ['after-skilltype1'],
    //     }), { icbg: STATUS_BG_COLOR[1] }),

    // 2132: () => new GIStatus(2132, '隐具余数', '｢隐具余数｣最多可以叠加到3层。；【角色使用〖ski1210,2〗时：】每层｢隐具余数｣使伤害+1。技能结算后，耗尽｢隐具余数｣，每层治疗角色1点。',
    //     'buff2', 0, [1, 6], 1, 3, -1, (status, event = {}) => ({
    //         trigger: ['skilltype2', 'after-skilltype2'],
    //         addDmgCdt: status.useCnt,
    //         heal: isCdt(event.trigger == 'after-skilltype2', status.useCnt),
    //         exec: eStatus => {
    //             if (eStatus) eStatus.useCnt = 0;
    //         }
    //     })),

    // 2133: () => new GIStatus(2133, '攻袭余威', '【结束阶段：】如果角色生命值至少为6，则受到2点[穿透伤害]。；【[持续回合]：{roundCnt}】',
    //     'debuff', 0, [1, 3], 1, 0, 1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         if (hidx == -1) return;
    //         return {
    //             trigger: isCdt(heros[hidx].hp >= 6, ['phase-end']),
    //             pdmg: 2,
    //             hidxs: [hidx],
    //             isSelf: true,
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //             }
    //         }
    //     }),

    // 2134: (summonId: number) => new GIStatus(2134, '惊奇猫猫盒的嘲讽', '【我方出战角色受到伤害时：】抵消1点伤害。(每回合1次)',
    //     '', 1, [2], 1, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: restDmg - 1 }
    //     }, { smnId: summonId }),

    // 2135: () => new GIStatus(2135, '大将旗指物', '我方角色造成的[岩元素伤害]+1。；【[持续回合]：{roundCnt}】(可叠加，最多叠加到3回合)',
    //     'ski1506,1', 0, [3, 6], -1, 3, 2, (_status, event = {}) => {
    //         const { isSkill = -1 } = event;
    //         return {
    //             trigger: isSkill > -1 ? ['rock-dmg'] : [],
    //             addDmgCdt: 1,
    //         }
    //     }, { icbg: STATUS_BG_COLOR[6] }),

    // 2136: (rcnt = 2) => new GIStatus(2136, '琢光镜', '角色造成的[物理伤害]变为[草元素伤害]。；【角色｢普通攻击｣后：】造成1点[草元素伤害]。如果此技能为[重击]，则使此状态的[持续回合]+1。；【[持续回合]：{roundCnt}】(可叠加，最多叠加到3回合)',
    //     'ski1606,2', 0, [1, 8], -1, 3, rcnt, (status, event = {}) => {
    //         const { isChargedAtk = false, trigger = '' } = event;
    //         return {
    //             attachEl: 7,
    //             trigger: ['skilltype1', 'after-skilltype1'],
    //             damage: isCdt(trigger == 'after-skilltype1', 1),
    //             element: 7,
    //             exec: () => {
    //                 if (isChargedAtk) {
    //                     status.roundCnt = Math.min(status.maxCnt, status.roundCnt + 1);
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[7] }),

    // 2137: (type = 0) => new GIStatus(2137, ['严寒', '炽热'][type], `【结束阶段：】对所附属角色造成1点[${['冰', '火'][type]}元素伤害]。；【[可用次数]：{useCnt}】；所附属角色被附属【sts2137${[',1', ''][type]}】时，移除此效果。`,
    //     ELEMENT_ICON[[4, 2][type]] + '-dice', 0, [1], 1, 0, -1, status => ({
    //         damage: 1,
    //         element: status.perCnt == 0 ? 4 : 2,
    //         isSelf: true,
    //         trigger: ['phase-end'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     }), { icbg: DEBUFF_BG_COLOR, pct: -type }),

    // 2138: () => new GIStatus(2138, '冰封的炽炎魔女', '【行动阶段开始时：】如果所附属角色生命值不多于4，则移除此效果。；【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。【此效果被移除时：】所附属角色转换为[｢焚尽的炽炎魔女｣]形态。',
    //     'ski1702,3', 0, [4, 10, 13], 1, 0, -1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1, trigger = '' } = event;
    //         const triggers: Trigger[] = ['will-killed', 'skilltype3'];
    //         if ((heros[hidx]?.hp ?? 10) <= 4) triggers.push('phase-start');
    //         return {
    //             trigger: triggers,
    //             cmds: isCdt(trigger == 'will-killed', [{ cmd: 'revive', cnt: 1 }]),
    //             exec: eStatus => {
    //                 if (eStatus) {
    //                     --eStatus.useCnt;
    //                     return;
    //                 }
    //                 return { cmds: [{ cmd: 'changePattern', cnt: 1851, hidxs: [hidx] }] }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[4] }),

    // 2139: (cnt = 1) => new GIStatus(2139, '炎之魔蝎·守势', '【附属角色受到伤害时：】抵消1点伤害。；【[可用次数]：{useCnt}】',
    //     '', 0, [2], cnt, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: restDmg - 1 }
    //     }),

    // 2140: () => new GIStatus(2140, '雷霆探针', '【所在阵营角色使用技能后：】对所在阵营出战角色附属【sts2141】。(每回合1次)',
    //     'ski1762,3', 1, [10], -1, 0, -1, status => ({
    //         trigger: ['skill'],
    //         exec: () => {
    //             if (status.perCnt <= 0) return;
    //             --status.perCnt;
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2141)] }] }
    //         }
    //     }), { icbg: DEBUFF_BG_COLOR, pct: 1 }),

    // 2141: () => new GIStatus(2141, '雷鸣探知', '【所附属角色受到〖hro1762〗及其召唤物造成的伤害时：】移除此状态，使此伤害+1。；(同一方场上最多存在一个此状态。【hro1762】的部分技能，会以所附属角色为目标。)',
    //     'debuff', 0, [6, 10], 1, 0, -1, (status, event = {}) => {
    //         const { dmgSource = 0, eheros = [] } = event;
    //         const getDmg = +(dmgSource == 1762 || dmgSource == 3052);
    //         const talent = eheros.find(h => h.id == 1762)?.talentSlot;
    //         const isTalent = talent && talent.useCnt > 0;
    //         return {
    //             trigger: ['getdmg'],
    //             getDmg,
    //             onlyOne: true,
    //             cmds: isCdt(isTalent, [{ cmd: 'getCard', cnt: 1, isOppo: true }]),
    //             exec: () => {
    //                 if (getDmg > 0) --status.useCnt;
    //                 if (isTalent) --talent.useCnt;
    //             }
    //         }
    //     }, { isReset: false }),

    // 2142: () => new GIStatus(2142, '坍毁', '所附属角色受到的[物理伤害]或[风元素伤害]+2。；【[可用次数]：{useCnt}】',
    //     'debuff', 0, [6], 1, 0, -1, (status, event = {}) => {
    //         const { heros = [], hidx = -1, eheros = [] } = event;
    //         return {
    //             trigger: ['any-getdmg', 'wind-getdmg'],
    //             getDmg: 2,
    //             exec: () => {
    //                 --status.useCnt;
    //                 const talent = eheros.find(h => h.id == 1782)?.talentSlot;
    //                 if (status.useCnt == 0 && talent && talent.useCnt > 0) {
    //                     --talent.useCnt;
    //                     const all = allHidxs(heros);
    //                     const hidxs = [all[(all.indexOf(hidx) + 1) % all.length]];
    //                     return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2142)], hidxs }] }
    //                 }
    //             }
    //         }
    //     }),

    // 2143: () => new GIStatus(2143, '风龙吐息', '本角色将在下次行动时，直接使用技能：【rsk6】。',
    //     'buff3', 0, [11], 1, 0, -1, (status, event = {}) => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 6,
    //         exec: () => {
    //             const { trigger = '' } = event;
    //             --status.useCnt;
    //             if (trigger == 'change-from') return;
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2144)] }] }
    //         }
    //     })),

    // 2144: () => new GIStatus(2144, '风龙吐息', '本角色将在下次行动时，直接使用技能：【rsk7】。',
    //     'buff3', 0, [11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 7,
    //         exec: () => { --status.useCnt },
    //     })),

    // 2145: () => new GIStatus(2145, '磐岩百相·元素凝晶', '【角色受到‹4冰›/‹1水›/‹2火›/‹3雷›元素伤害后：】如果角色当前未汲取该元素的力量，则移除此状态，然后角色[汲取对应元素的力量]。',
    //     'ski1802,1', 0, [10], 1, 0, -1, (status, event = {}) => {
    //         const { heros = [], hidx = -1, trigger = '' } = event;
    //         if (hidx == -1) return;
    //         const hero = heros[hidx];
    //         const curEl = hero.srcs.indexOf(hero.src);
    //         const drawEl = ELEMENT_ICON.indexOf(trigger.split('-')[0]);
    //         return {
    //             trigger: ['ice-getdmg', 'water-getdmg', 'fire-getdmg', 'thunder-getdmg'],
    //             exec: () => {
    //                 if (curEl != drawEl) {
    //                     --status.useCnt;
    //                     const sts2153 = hero.inStatus.find(ist => ist.id == 2153);
    //                     if (!sts2153) throw new Error('status not found');
    //                     return { ...heroStatus(2153).handle(sts2153, { ...event, trigger: `el6Reaction:${drawEl}` as Trigger })?.exec?.() }
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[6], expl: ['rsk8', 'rsk9', 'rsk10', 'rsk11'] }),

    // 2146: () => new GIStatus(2146, '裁定之时(生效中)', '本回合中，我方打出的事件牌无效。；【[可用次数]：{useCnt}】',
    //     'debuff', 1, [4], 3, 0, 1, (status, event = {}) => {
    //         const { card } = event;
    //         const isInvalid = card?.type == 2;
    //         return {
    //             trigger: ['card'],
    //             isInvalid,
    //             exec: () => {
    //                 if (isInvalid) --status.useCnt;
    //             }
    //         }
    //     }),

    // 2147: () => new GIStatus(2147, '坍陷与契机(生效中)', '【本回合中，双方牌手进行｢切换角色｣行动时：】需要额外花费1个元素骰。',
    //     'debuff', 1, [4, 10], -1, 0, 1, () => ({ trigger: ['change-from'], addDiceHero: 1 })),


    // 2148: () => new GIStatus(2148, '野猪公主(生效中)', '【本回合中，我方每有一张装备在角色身上的｢装备牌｣被弃置时：】获得1个[万能元素骰]。；【[可用次数]：{useCnt}】；(角色被击倒时弃置装备牌，或者覆盖装备｢武器｣或｢圣遗物｣，都可以触发此效果)',
    //     'buff2', 1, [4], 2, 0, 1, (status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         return {
    //             trigger: ['slot-destroy'],
    //             exec: () => {
    //                 let cnt = 0;
    //                 if (heros[hidx].weaponSlot != null) ++cnt;
    //                 if (heros[hidx].artifactSlot != null) ++cnt;
    //                 if (heros[hidx].talentSlot != null) ++cnt;
    //                 cnt = Math.max(1, Math.min(2, cnt));
    //                 status.useCnt -= cnt;
    //                 return { cmds: [{ cmd: 'getDice', cnt, element: 0 }] }
    //             }
    //         }
    //     }),

    // 2149: () => new GIStatus(2149, '沙海守望·主动出击', '本回合内，所附属角色下次造成的伤害额外+1。',
    //     'buff5', 0, [4, 6, 10], 1, 0, 1, status => ({
    //         trigger: ['skill'],
    //         addDmg: 1,
    //         exec: () => { --status.useCnt }
    //     })),

    // 2150: () => new GIStatus(2150, '沙海守望·攻势防御', '本回合内，所附属角色下次造成的伤害额外+1。',
    //     'buff5', 0, [4, 6, 10], 1, 0, 1, status => ({
    //         trigger: ['skill'],
    //         addDmg: 1,
    //         exec: () => { --status.useCnt }
    //     })),

    // 2151: () => new GIStatus(2151, '四叶印(生效中)', '【结束阶段：】切换到所附属角色。',
    //     'buff3', 0, [3, 10], -1, 0, -1, (_status, event = {}) => ({
    //         trigger: ['phase-end'],
    //         exec: () => {
    //             const { hidx = -1 } = event;
    //             return { cmds: [{ cmd: 'switch-to', hidxs: [hidx], cnt: 1100 }] }
    //         }
    //     })),

    // 2152: () => new GIStatus(2152, '炸鱼薯条(生效中)', '本回合中，所附属角色下次使用技能时少花费1个元素骰。',
    //     'buff2', 0, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 1] });
    //         return {
    //             trigger: ['skill'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             },
    //         }
    //     }),

    // 2153: () => new GIStatus(2153, '磐岩百相·元素汲取', '角色可以汲取‹4冰›/‹1水›/‹2火›/‹3雷›元素的力量，然后根据所汲取的元素类型，获得技能‹4霜刺破袭›/‹1洪流重斥›/‹2炽焰重斥›/‹3霆雷破袭›。(角色同时只能汲取一种元素，此状态会记录角色已汲取过的元素类型数量)；【角色汲取了一种和当前不同的元素后：】生成1个所汲取元素类型的元素骰。',
    //     'buff2', 0, [9, 12], 0, 4, -1, (status, event = {}) => ({
    //         trigger: ['el6Reaction'],
    //         exec: () => {
    //             const { heros = [], hidx = -1, trigger = '' } = event;
    //             const hero = heros[hidx];
    //             const curEl = hero.srcs.indexOf(hero.src);
    //             const drawEl = trigger.startsWith('el6Reaction') ? Number(trigger.slice(trigger.indexOf(':') + 1)) : 0;
    //             if (drawEl == 0 || drawEl == curEl) return;
    //             const isDrawed = status.perCnt != 0;
    //             hero.src = hero.srcs[drawEl];
    //             let els = -status.perCnt;
    //             if ((els >> drawEl - 1 & 1) == 0) {
    //                 els |= 1 << drawEl - 1;
    //                 ++status.useCnt;
    //                 status.perCnt = -els;
    //             }
    //             const cmds: Cmds[] = [{ cmd: 'getDice', cnt: 1, element: drawEl }, { cmd: 'getSkill', hidxs: [hidx], cnt: 7 + drawEl, element: 2 }];
    //             if (isDrawed) cmds.splice(1, 0, { cmd: 'loseSkill', hidxs: [hidx], element: 2 });
    //             return { cmds }
    //         }
    //     }), { expl: ['rsk8', 'rsk9', 'rsk10', 'rsk11'] }),

    // 2154: (isTalent = false) => new GIStatus(2154, '炽火大铠', '【我方角色｢普通攻击｣后：】造成1点[火元素伤害]，生成【sts2106】。；【[可用次数]：{useCnt}】',
    //     'ski1211,2', 1, [1], isTalent ? 3 : 2, 0, -1, (_status: Status) => ({
    //         damage: 1,
    //         element: 2,
    //         trigger: ['after-skilltype1'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2106)] }] }
    //         },
    //     }), { icbg: STATUS_BG_COLOR[2], isTalent }),

    // 2155: (windEl = 0) => new GIStatus(2155, '风风轮', '本角色将在下次行动时，直接使用技能：【rsk12】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 12 + Number(status.addition[0]),
    //         exec: () => { --status.useCnt },
    //     }), { adt: [windEl] }),

    // 2156: () => new GIStatus(2156, '四迸冰锥', '【我方角色｢普通攻击｣时：】对所有敌方后台角色造成1点[穿透伤害]。；【[可用次数]：{useCnt}】',
    //     'buff6', 0, [], 1, 0, -1, status => ({
    //         pdmg: 1,
    //         trigger: ['skilltype1'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2157: () => new GIStatus(2157, '冰晶核心', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。',
    //     'heal2', 0, [10, 13], 1, 0, -1, (_status, event = {}) => ({
    //         trigger: ['will-killed'],
    //         cmds: [{ cmd: 'revive', cnt: 1 }],
    //         exec: eStatus => {
    //             const { heros = [], hidx = -1 } = event;
    //             if (eStatus) {
    //                 --eStatus.useCnt;
    //                 return;
    //             }
    //             if (!heros[hidx].talentSlot) return;
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2137)], isOppo: true }] }
    //         }
    //     })),

    // 2158: (isTalent = false, useCnt = 2, addCnt?: number) => new GIStatus(2158, '原海明珠', `【所附属角色受到伤害时：】抵消1点伤害。；【每回合${isTalent ? 2 : 1}次：】抵消来自召唤物的伤害时不消耗[可用次数]。；【[可用次数]：{useCnt}】；【我方宣布结束时：】如果所附属角色为｢出战角色｣，则摸1张牌。`,
    //     '', 0, [2, 4], useCnt, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0, heros = [], hidx = -1, dmgSource = -1 } = event;
    //         if (restDmg > 0) {
    //             if (Math.floor(dmgSource / 1000) == 3 && status.perCnt > 0) --status.perCnt;
    //             else --status.useCnt;
    //             return { restDmg: restDmg - 1 }
    //         }
    //         return {
    //             restDmg,
    //             trigger: isCdt(heros[hidx]?.isFront, ['end-phase']),
    //             cmds: isCdt(heros[hidx]?.isFront, [{ cmd: 'getCard', cnt: 1 }]),
    //         }
    //     }, { isTalent, pct: isTalent ? 2 : 1, act: addCnt }),

    // 2159: () => new GIStatus(2159, '松茸酿肉卷(生效中)', '【结束阶段：】治疗该角色1点。【[可用次数]：{useCnt}】',
    //     'heal', 0, [3], 3, 0, -1, (_status, event = {}) => {
    //         const { hidx = -1 } = event;
    //         return {
    //             trigger: ['phase-end'],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //                 return { cmds: [{ cmd: 'heal', cnt: 1, hidxs: [hidx] }] }
    //             },
    //         }
    //     }),

    // 2160: (name: string) => new GIStatus(2160, `${name}(生效中)`, '【角色在本回合中，下次使用｢普通攻击｣后：】生成2个此角色类型的元素骰。',
    //     'buff2', 0, [3, 4, 10], 1, 0, 1, status => ({
    //         trigger: ['skilltype1'],
    //         exec: () => {
    //             --status.useCnt;
    //             return { cmds: [{ cmd: 'getDice', element: -2, cnt: 2 }] }
    //         }
    //     })),

    // 2161: () => new GIStatus(2161, '净觉花(生效中)', '【本回合中，我方下次打出支援牌时：】少花费1个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.type == 1 && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 1,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 2162: () => new GIStatus(2162, '机关铸成之链(生效中)', '【所附属角色每次受到伤害或治疗后：】累积1点｢备战度｣(最多累积2点)。；【我方打出原本费用不多于｢备战度｣的｢武器｣或｢圣遗物｣时:】移除此状态，以免费打出该牌。',
    //     'buff3', 0, [4, 9], 0, 0, -1, (status, event = {}) => {
    //         const { card, trigger = '', heal = [], hidx = -1, minusDiceCard: mdc = 0 } = event;
    //         const isMinus = card && card.subType.some(st => st < 2) && card.cost > mdc && status.useCnt >= card.cost;
    //         return {
    //             trigger: ['getdmg', 'heal', 'card'],
    //             minusDiceCard: isMinus ? card.cost - mdc : 0,
    //             exec: () => {
    //                 if (trigger == 'getdmg' || trigger == 'heal' && heal[hidx] > 0) {
    //                     status.useCnt = Math.min(2, status.useCnt + 1);
    //                 } else if (trigger == 'card' && isMinus) {
    //                     status.type.pop();
    //                     status.useCnt = 0;
    //                 }
    //             }
    //         }
    //     }),

    // 2163: () => new GIStatus(2163, '瞬时剪影', `【结束阶段：】对所附属角色造成1点[冰元素伤害]; 如果[可用次数]仅剩余1且所附属角色具有[冰元素附着]，则此伤害+1。；【[可用次数]：{useCnt}】`,
    //     'ice-dice', 0, [1], 2, 0, -1, (status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         const isAddDmg = heros[hidx]?.attachElement.includes(4) && status.useCnt == 1;
    //         return {
    //             damage: isCdt(isAddDmg, 2, 1),
    //             element: 4,
    //             isSelf: true,
    //             trigger: ['phase-end'],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //             },
    //         }
    //     }, { icbg: DEBUFF_BG_COLOR }),

    // 2164: (cnt = 1) => new GIStatus(2164, '源水之滴', `【〖hro1110〗进行｢普通攻击｣后：】治疗【hro1110】2点，然后如果【hro1110】是我方｢出战角色｣，则[准备技能]：【rsk17】。；【[可用次数]：{useCnt}】(可叠加，最多叠加到3次)`,
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Neuvillette_S.webp', 1, [1], cnt, 3, -1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         if (heros[hidx]?.id != 1110) return;
    //         return {
    //             heal: 2,
    //             hidxs: [heros.findIndex(h => h.id = 1110)],
    //             trigger: ['after-skilltype1'],
    //             exec: (eStatus, execEvent = {}) => {
    //                 const { heros: hs = [] } = execEvent;
    //                 if (eStatus) --eStatus.useCnt;
    //                 if (hs.find(h => h.id == 1110)?.isFront) {
    //                     return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2165)] }] }
    //                 }
    //             },
    //         }
    //     }),

    // 2165: () => new GIStatus(2165, '衡平推裁', `本角色将在下次行动时，直接使用技能：【rsk17】。`,
    //     'buff3', 0, [10, 11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 17,
    //         exec: () => { --status.useCnt },
    //     })),

    // 2166: () => new GIStatus(2166, '遗龙之荣', '角色造成的伤害+1。【[可用次数]:{useCnt}】',
    //     'buff2', 0, [4, 6], 2, 0, -1, status => ({
    //         addDmg: 1,
    //         trigger: ['skill'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2167: () => new GIStatus(2167, '猫箱急件', '【绮良良为出战角色时，我方切换角色后：】造成1点[草元素伤害]，摸1张牌。；【[可用次数]：{useCnt}】(可叠加，最多叠加到2次)',
    //     'ski1607,1', 1, [1], 1, 2, -1, (_status, event = {}) => {
    //         const { heros = [], force = false } = event;
    //         if (!heros.find(h => h.id == 1607)?.isFront && !force) return;
    //         return {
    //             damage: 1,
    //             element: 7,
    //             trigger: ['change-from'],
    //             cmds: [{ cmd: 'getCard', cnt: 1 }],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //             },
    //         }
    //     }, { icbg: STATUS_BG_COLOR[7] }),

    // 2168: () => shieldStatus(2168, '安全运输护盾'),

    // 2169: () => new GIStatus(2169, '猫草豆蔻', '【所在阵营打出2张行动牌后：】对所在阵营的出战角色造成1点[草元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1607,2', 1, [1, 4], 2, 0, -1, status => ({
    //         damage: isCdt(status.perCnt <= -1, 1),
    //         element: 7,
    //         isSelf: true,
    //         trigger: ['card'],
    //         exec: eStatus => {
    //             --status.perCnt;
    //             if (eStatus) {
    //                 --eStatus.useCnt;
    //                 eStatus.perCnt = 0;
    //             }
    //         },
    //     }), { icbg: DEBUFF_BG_COLOR }),

    // 2170: (useCnt = 0) => new GIStatus(2170, '雷萤护罩', '为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【smn3057】，则额外提供其[可用次数]的[护盾]。(最多额外提供3点[护盾])',
    //     '', 1, [7], 1 + Math.min(3, useCnt), 0, -1),

    // 2171: () => new GIStatus(2171, '霆电迸发', '本角色将在下次行动时，直接使用技能：【rsk18】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 18,
    //         exec: () => { --status.useCnt },
    //     })),

    301108: () => new GIStatus(301108, '万世的浪涛', '角色在本回合中，下次造成的伤害+2。',
        'buff5', STATUS_GROUP.heroStatus, [STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign], 1, 0, 1, status => ({
            addDmg: 2,
            trigger: ['skill'],
            exec: () => { --status.useCnt },
        })),

    // 2173: () => new GIStatus(2173, '抗争之日·碎梦之时(生效中)', '本回合中，所附属角色受到的伤害-1。；【[可用次数]：{useCnt}】',
    //     '', 0, [2], 4, 0, 1, (status, event = {}) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: Math.max(0, restDmg - 1) }
    //     }),

    // 2174: () => new GIStatus(2174, '严格禁令', '本回合中，所在阵营打出的事件牌无效。；【[可用次数]：{useCnt}】',
    //     'debuff', 1, [4], 1, 0, 1, (status, event = {}) => {
    //         const { card } = event;
    //         const isInvalid = card?.type == 2;
    //         return {
    //             trigger: ['card'],
    //             isInvalid,
    //             exec: () => {
    //                 if (isInvalid) --status.useCnt;
    //             }
    //         }
    //     }),

    // 2175: () => new GIStatus(2175, '雷压', '每当我方累积打出3张行动牌，就会触发敌方场上【smn3057】的效果。(使【smn3057】的[可用次数]+1)',
    //     'debuff', 1, [4, 9], 0, 3, -1, (status, event = {}) => ({
    //         trigger: ['card'],
    //         exec: () => {
    //             const { esummons = [] } = event;
    //             status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
    //             const summon = esummons.find(smn => smn.id == status.summonId);
    //             if (summon && summon.useCnt < 3) {
    //                 ++summon.useCnt;
    //                 status.useCnt = 0;
    //             }
    //         },
    //     })),

    // 2176: () => new GIStatus(2176, '越袚草轮', '【我方切换角色后：】造成1点[雷元素伤害]，治疗我方受伤最多的角色1点。(每回合1次)；【[可用次数]：{useCnt}】',
    //     'ski1311,1', 1, [1], 3, 0, -1, (status, event = {}) => {
    //         if (status.perCnt == 0) return;
    //         return {
    //             damage: 1,
    //             element: 3,
    //             heal: 1,
    //             hidxs: getMaxHertHidxs(event.heros ?? []),
    //             trigger: ['change-from'],
    //             exec: eStatus => {
    //                 if (eStatus) {
    //                     --eStatus.useCnt;
    //                     --eStatus.perCnt;
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[3], pct: 1 }),

    // 2177: () => new GIStatus(2177, '疾风示现', '【所附属角色进行[重击]时：】少花费1个[无色元素骰]，造成的[物理伤害]变为[风元素伤害]，并且使目标角色附属【sts2178】；【[可用次数]：{useCnt}】',
    //     'buff', 0, [16], 1, 0, -1, (status, event = {}) => {
    //         const { isChargedAtk = false } = event;
    //         if (!isChargedAtk) return;
    //         const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             attachEl: 5,
    //             exec: () => {
    //                 --status.useCnt;
    //                 return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2178)], isOppo: true }] }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[5] }),

    // 2178: () => new GIStatus(2178, '风压坍陷', '【结束阶段：】将附属角色切换为｢出战角色｣。；【[可用次数]：{useCnt}】；(同一方场上最多存在一个此状态)',
    //     'ski1409,1', 0, [3], 1, 0, -1, (_status, event = {}) => ({
    //         trigger: ['phase-end'],
    //         onlyOne: true,
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //             const { hidx = -1 } = event;
    //             return { cmds: [{ cmd: 'switch-to', hidxs: [hidx], cnt: 1100 }] }
    //         }
    //     }), { icbg: DEBUFF_BG_COLOR }),

    // 2179: () => new GIStatus(2179, '涟锋旋刃', '本角色将在下次行动时，直接使用技能：【rsk19】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 19,
    //         exec: () => { --status.useCnt },
    //     })),

    // 2180: () => new GIStatus(2180, '暗流的诅咒', '【所在阵营的角色使用｢元素战技｣或｢元素爆发｣时：】需要多花费1个元素骰。；【[可用次数]：{useCnt}】',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Debuff_Common_CostSkill.webp',
    //     1, [4], 2, 0, -1, status => ({
    //         trigger: ['skilltype2', 'skilltype3'],
    //         addDiceSkill: {
    //             skilltype2: [0, 0, 1],
    //             skilltype3: [0, 0, 1],
    //         },
    //         exec: () => { --status.useCnt },
    //     })),

    // 2181: () => new GIStatus(2181, '水之新生', '【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。触发此效果后，角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。',
    //     'heal2', 0, [10, 13], 1, 0, -1, () => ({
    //         trigger: ['will-killed'],
    //         cmds: [{ cmd: 'revive', cnt: 4 }],
    //         exec: eStatus => {
    //             if (eStatus) {
    //                 --eStatus.useCnt;
    //                 return;
    //             }
    //             return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2187)] }] }
    //         }
    //     })),

    // 2182: (useCnt = 1) => new GIStatus(2182, '重甲蟹壳', '每层提供1点[护盾]，保护所附属角色。', '', 0, [7], useCnt, 1000, -1),

    // 2183: () => new GIStatus(2183, '积蓄烈威', '本角色将在下次行动时，直接使用技能：【rsk20】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, status => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 20,
    //         exec: () => { --status.useCnt },
    //     })),

    // 2184: () => new GIStatus(2184, '悠远雷暴', '【结束阶段：】对所附属角色造成2点[穿透伤害]。；【[可用次数]：{useCnt}】',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Dot.webp',
    //     0, [1], 1, 0, -1, (_status, event = {}) => {
    //         const { hidx = -1 } = event;
    //         return {
    //             trigger: ['phase-end'],
    //             pdmg: 2,
    //             hidxs: [hidx],
    //             isSelf: true,
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //             }
    //         }
    //     }),

    // 2185: () => new GIStatus(2185, '｢清洁工作｣(生效中)', '我方出战角色下次造成的伤害+1。；(可叠加，最多叠加到+2)',
    //     'buff5', 1, [4, 6], 1, 2, -1, status => ({
    //         trigger: ['skill'],
    //         addDmg: status.useCnt,
    //         exec: () => { status.useCnt = 0 },
    //     })),

    // 2186: () => new GIStatus(2186, '缤纷马卡龙(生效中)', '【所附属角色受到伤害后：】治疗该角色1点。；【[可用次数]：{useCnt}】',
    //     'heal', 0, [1], 3, 0, -1, () => ({
    //         heal: 1,
    //         trigger: ['getdmg'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     })),

    // 2187: () => new GIStatus(2187, '水之新生·锐势', '角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。',
    //     'buff4', 0, [6, 8, 10], 1, 0, -1, () => ({ attachEl: 1, addDmg: 1 }), { icbg: STATUS_BG_COLOR[1] }),

    // 2188: () => new GIStatus(2188, '沙与梦', '【对角色打出｢天赋｣或角色使用技能时：】少花费3个元素骰。；【[可用次数]：{useCnt}】',
    //     'buff2', 0, [4], 1, 0, -1, (status, event = {}) => {
    //         const { card, heros = [], hidx = -1, trigger = '', minusDiceCard: mdc = 0 } = event;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 3] });
    //         const isCardMinus = card && card.subType.includes(6) && card.userType == heros[hidx]?.id && card.cost + card.anydice > mdc;
    //         return {
    //             ...minusSkillRes,
    //             minusDiceCard: isCdt(isCardMinus, 3),
    //             trigger: ['card', 'skill'],
    //             exec: () => {
    //                 if (trigger == 'card' && isCardMinus || trigger == 'skill' && isMinusSkill) --status.useCnt;
    //             },
    //         }
    //     }),

    // 2189: () => new GIStatus(2189, '踏潮', '本角色将在下次行动时，直接使用技能：【rsk1】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, (status, event = {}) => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 1,
    //         exec: () => {
    //             --status.useCnt;
    //             const { heros = [], hidx = -1 } = event;
    //             const sts2062 = heros[hidx].inStatus.find(ist => ist.id == 2062);
    //             if (sts2062) sts2062.useCnt = 0;
    //         }
    //     })),

    // 2190: () => new GIStatus(2190, '苍鹭震击', '本角色将在下次行动时，直接使用技能：【rsk4】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, (status, event = {}) => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 4,
    //         exec: () => {
    //             --status.useCnt;
    //             const { heros = [], hidx = -1 } = event;
    //             const sts2094 = heros[hidx].inStatus.find(ist => ist.id == 2094);
    //             if (sts2094) sts2094.useCnt = 0;
    //         }
    //     })),

    // 2191: () => new GIStatus(2191, '火之新生·锐势', '角色造成的[火元素伤害]+1。', 'buff4', 0, [6, 10], 1, 0, -1, () => ({ addDmg: 1 }), { icbg: STATUS_BG_COLOR[2] }),

    // 2192: () => new GIStatus(2192, '寒烈的惩裁', '【角色进行｢普通攻击｣时：】如果角色生命至少为6，则此技能少花费1个[冰元素骰]，伤害+1，且对自身造成1点[穿透伤害]。；如果角色生命不多于5，则使此伤害+1，并且技能结算后治疗角色2点。；【[可用次数]：{useCnt}】',
    //     'ski1011,1', 0, [1, 6], 2, 0, -1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1, trigger = '' } = event;
    //         if (hidx == -1) return;
    //         if (trigger == 'calc') {
    //             if ((heros[hidx]?.hp ?? 0) < 6) return;
    //             const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] });
    //             return { ...minusSkillRes }
    //         }
    //         let res: StatusHandleRes = {};
    //         if ((heros[hidx]?.hp ?? 0) >= 6) res = { addDmgCdt: 1, pdmg: 1, hidxs: [hidx], isSelf: true };
    //         else res = { addDmgCdt: 1, heal: 2 };
    //         return {
    //             trigger: ['after-skilltype1', 'skilltype1'],
    //             ...res,
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[4] }),

    // 2193: () => new GIStatus(2193, '余威冰锥', '【我方选择行动前：】造成2点[冰元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1011,2', 1, [1], 1, 0, -1, () => ({
    //         damage: 2,
    //         element: 4,
    //         trigger: ['action-start'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     }), { icbg: STATUS_BG_COLOR[4] }),

    // 2194: () => new GIStatus(2194, '普世欢腾', '【我方出战角色受到伤害或治疗后：】叠加1点【sts2195】。；【[持续回合]：{roundCnt}】',
    //     'ski1111,2', 1, [4], -1, 0, 2, (_status, event = {}) => {
    //         const { heal = [], hidx = -1, trigger = '' } = event;
    //         const triggers: Trigger[] = ['getdmg'];
    //         if (trigger == 'heal' && (heal[hidx] ?? 0) > 0) triggers.push('heal');
    //         return {
    //             trigger: triggers,
    //             exec: () => ({ cmds: [{ cmd: 'getStatus', status: [heroStatus(2195)] }] }),
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1] }),

    // 2195: () => new GIStatus(2195, '狂欢值', '我方造成的伤害+1。(包括角色引发的扩散伤害)；【[可用次数]：{useCnt}(可叠加，没有上限)】',
    //     'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Furina_E_02.webp',
    //     1, [4, 6], 1, 1000, 1, (status, { trigger } = {}) => ({
    //         trigger: ['dmg', 'dmg-wind'],
    //         addDmg: 1,
    //         exec: () => {
    //             if (trigger == 'dmg') --status.useCnt
    //         },
    //     })),

    // 2196: () => new GIStatus(2196, '万众瞩目', '【角色进行｢普通攻击｣时：】使角色造成的造成的[物理伤害]变为[水元素伤害]。如果角色处于｢荒｣形态，则治疗我方所有后台角色1点; 如果角色处于｢芒｣形态，则此伤害+2，但是对一位受伤最少的我方角色造成1点[穿透伤害]。；【[可用次数]：{useCnt}】',
    //     'buff4', 0, [1, 8], 1, 0, -1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         if (hidx == -1) return;
    //         const { local } = heros[hidx];
    //         let res: StatusHandleRes = {};
    //         if (local.includes(11)) res = { heal: 1, hidxs: getBackHidxs(heros) };
    //         else res = { addDmgCdt: 2, pdmg: 1, hidxs: getMinHertHidxs(heros), isSelf: true };
    //         return {
    //             attachEl: 1,
    //             trigger: ['after-skilltype1', 'skilltype1'],
    //             ...res,
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1] }),


    // 2197: () => shieldStatus(2197, '热情护盾'),

    // 2198: (useCnt = 1) => new GIStatus(2198, '飞云旗阵', '我方角色进行｢普通攻击｣时：造成的伤害+1。；如果我方手牌数量不多于1，则此技能少花费1个元素骰。；【[可用次数]：{useCnt}(可叠加，最多叠加到4次)】',
    //     'ski1507,1', 1, [4, 6], useCnt, 4, -1, (status, event = {}) => {
    //         const { hcardsCnt = 10, heros = [] } = event;
    //         const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => hcardsCnt <= 1);
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             addDmgType1: 1,
    //             addDmgCdt: isCdt(hcardsCnt == 0 && !!heros.find(h => h.id == 1507)?.talentSlot, 2),
    //             exec: () => { --status.useCnt }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[6] }),

    // 2199: () => new GIStatus(2199, '氛围烈焰', '【我方宣布结束时：】如果我方的手牌数量不多于1，则造成1点[火元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1212,2', 1, [1], 2, 0, -1, (_status, event = {}) => {
    //         const { hcardsCnt = 10 } = event;
    //         if (hcardsCnt > 1) return;
    //         return {
    //             trigger: ['end-phase'],
    //             damage: 1,
    //             element: 2,
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[2] }),

    // 2200: () => readySkillShieldStatus(2200, '旋云护盾'),

    // 2201: () => new GIStatus(2201, '长枪开相', '本角色将在下次行动时，直接使用技能：【rsk21】。',
    //     'buff3', 0, [10, 11], 1, 0, -1, (status, event = {}) => ({
    //         trigger: ['change-from', 'useReadySkill'],
    //         skill: 21,
    //         exec: () => {
    //             --status.useCnt;
    //             const { heros = [], hidx = -1 } = event;
    //             const sts2200 = heros[hidx].inStatus.find(ist => ist.id == 2200);
    //             if (sts2200) sts2200.useCnt = 0;
    //         }
    //     })),

    // 2202: (useCnt = 1) => new GIStatus(2202, '迸发扫描', '【双方选择行动前：】如果我方场上存在【sts2005】或【smn3043】，则使其[可用次数]-1，并[舍弃]我方牌库顶的1张卡牌。然后，造成所[舍弃]卡牌的元素骰费用+1的[草元素伤害]。；【[可用次数]：{useCnt}(可叠加，最多叠加到3次)】',
    //     'ski1608,1', 1, [1], useCnt, 3, -1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1, summons = [], pile = [], card } = event;
    //         if (pile.length == 0 || heros[hidx].outStatus.every(ost => ost.id != 2005) && summons.every(smn => smn.id != 3043)) return;
    //         const cmds: Cmds[] = [{ cmd: 'discard', element: 2 }];
    //         const thero = heros.find(h => h.id == 1608)!;
    //         if (card?.id == 788 || !!thero.talentSlot) {
    //             const talent = card ?? thero.talentSlot as Card;
    //             if (talent.perCnt > 0) {
    //                 cmds.push({ cmd: 'getCard', cnt: 1, card: pile[0].id });
    //                 if (pile[0].subType.includes(2)) cmds.push({ cmd: 'getStatus', status: [heroStatus(2204)] });
    //             }
    //         }
    //         return {
    //             trigger: ['action-start', 'action-start-oppo'],
    //             damage: pile[0].cost + pile[0].anydice + 1,
    //             element: 7,
    //             cmds,
    //             exec: (eStatus, execEvent = {}) => {
    //                 if (eStatus) {
    //                     --eStatus.useCnt;
    //                     const { heros: hs = [], summons: smns = [] } = execEvent;
    //                     const fhero = hs[hidx];
    //                     const sts2005 = fhero.outStatus.find(ost => ost.id == 2005);
    //                     if (sts2005) --sts2005.useCnt;
    //                     else {
    //                         const summon = smns.find(smn => smn.id == 3043);
    //                         --summon!.useCnt;
    //                     }
    //                     const thero = hs.find(h => h.id == 1608)!;
    //                     if (card?.id == 788 || !!thero.talentSlot) {
    //                         const talent = card ?? thero.talentSlot as Card;
    //                         if (talent.perCnt > 0) --talent.perCnt;
    //                     }
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[7] }),

    // 2203: () => new GIStatus(2203, '梅赫拉克的助力', '角色｢普通攻击｣造成的伤害+1，且造成的[物理伤害]变为[草元素伤害]。；【角色｢普通攻击｣后：】生成【sts2202】。；【[持续回合]:{roundCnt}】',
    //     'ski1608,2', 0, [4, 6, 8], -1, 0, 2, () => ({
    //         trigger: ['skilltype1'],
    //         attachEl: 7,
    //         addDmgType1: 1,
    //         exec: () => ({ cmds: [{ cmd: 'getStatus', status: [heroStatus(2202)] }] })
    //     }), { icbg: STATUS_BG_COLOR[7] }),

    // 2204: () => new GIStatus(2204, '预算师的技艺(生效中)', '我方下次【打出｢场地｣支援牌时：】少花费2个元素骰。',
    //     'buff3', 1, [4, 10], 1, 0, 1, (status, event = {}) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.subType.includes(2) && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 2,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 2205: () => new GIStatus(2205, '深噬之域', '我方[舍弃]或[调和]的手牌，会被吞噬。；【每吞噬3张牌：】【hro1724】获得1点额外最大生命; 如果其中存在原本元素骰费用值相同的牌，则额外获得1点; 如果3张均相同，再额外获得1点。',
    //     'ski1724,3', 1, [4, 9], 0, 3, -1, (status, event = {}) => {
    //         const { discards: [discards, type] = [[], 0], card, heros = [] } = event;
    //         if (type != 0) return;
    //         return {
    //             trigger: ['discard', 'reconcile'],
    //             isAddTask: true,
    //             exec: (eStatus, execEvent = {}) => {
    //                 eStatus ??= clone(status);
    //                 const { heros: hs = heros } = execEvent;
    //                 const hidx = hs.findIndex(h => h.id == 1724);
    //                 if (hidx == -1) return;
    //                 const [cost1, cost2, maxDice] = eStatus.addition;
    //                 if (card && card.id > 0) discards.splice(0, 10, card);
    //                 let cnt = 0;
    //                 discards.forEach(c => {
    //                     const cost = c.cost + c.anydice;
    //                     if (cost > maxDice) {
    //                         eStatus.addition[2] = cost;
    //                         eStatus.addition[3] = 1;
    //                     } else if (cost == maxDice) {
    //                         ++eStatus.addition[3];
    //                     }
    //                     if (eStatus.useCnt < 2) {
    //                         eStatus.addition[eStatus.useCnt] = cost;
    //                         ++eStatus.useCnt;
    //                     } else {
    //                         cnt += 1 + +(cost1 == cost) + +(cost2 == cost);
    //                         eStatus.useCnt = 0;
    //                         heros[hidx].maxhp += cnt;
    //                     }
    //                 });
    //                 if (cnt > 0) {
    //                     const healcmds = Array.from<Cmds[], Cmds>({ length: cnt }, (_, i) => ({ cmd: 'heal', cnt: 1, hidxs: [hidx], round: i }));
    //                     return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2217, cnt)], hidxs: [hidx] }, ...healcmds], }
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[1], adt: [-1, -1, 0, 0] }),

    // 2206: (useCnt = -1) => new GIStatus(2206, '雷锥陷阱', '【所在阵营的角色使用技能后：】对所在阵营的出战角色造成2点[雷元素伤害]。；【[可用次数]：初始为创建时所弃置的噬骸能量块张数。(最多叠加到3)】',
    //     'ski1765,2', 1, [1], useCnt, 3, -1, () => ({
    //         damage: 2,
    //         element: 3,
    //         isSelf: true,
    //         trigger: ['after-skill'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         }
    //     }), { icbg: DEBUFF_BG_COLOR }),

    // 2207: () => oncePerRound(2207, '噬骸能量块'),

    // 2208: () => new GIStatus(2208, '亡风啸卷(生效中)', '【本回合中我方下次切换角色后】：生成1个出战角色类型的元素骰。',
    //     'buff3', 1, [4, 10], 1, 0, 1, () => ({
    //         trigger: ['change-from'],
    //         isAddTask: true,
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //             return { cmds: [{ cmd: 'getDice', cnt: 1, element: -2 }] }
    //         }
    //     })),

    // 2209: (useCnt = 1) => new GIStatus(2209, '绿洲之滋养', '【我方打出〖crd907〗时：】少花费1个元素骰。；【[可用次数]：{useCnt}(可叠加到3)】',
    //     'ski1822,1', 1, [4], useCnt, 3, -1, (status, event = {}) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.id == 907 && card.cost > mdc) {
    //             return {
    //                 trigger: ['card'],
    //                 minusDiceCard: 1,
    //                 exec: () => { --status.useCnt }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[7] }),

    // 2210: () => new GIStatus(2210, '重燃的绿洲之心', '所附属角色造成的伤害+3。；【所附属角色使用技能后：】移除我方场上的【sts2209】，每移除1层就治疗所附属角色1点。',
    //     'ski1822,2', 0, [6, 10], -1, 0, -1, (_status, event = {}) => {
    //         const { heros = [], hidx = -1 } = event;
    //         const sts2209 = heros[hidx]?.outStatus.find(ost => ost.id == 2209);
    //         let cnt = 0;
    //         if (sts2209) {
    //             cnt = sts2209.useCnt;
    //             sts2209.useCnt = 0;
    //         }
    //         return {
    //             trigger: ['skill'],
    //             addDmg: 3,
    //             cmds: [{ cmd: 'heal', cnt }],
    //         }
    //     }, { icbg: STATUS_BG_COLOR[7] }),

    // 2211: () => new GIStatus(2211, '绿洲之庇护', '提供2点[护盾]，保护所附属角色。', '', 0, [7], 2, 0, -1),

    // 2212: (summonId: number, useCnt = 1) => new GIStatus(2212, '黑色幻影', '【我方出战角色受到伤害时：】抵消1点伤害，然后[可用次数]-2。；【[可用次数]：{useCnt}】',
    //     '', 1, [2], useCnt, 0, -1, (status, event = {}) => {
    //         const { restDmg = 0, summon } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         status.useCnt = Math.max(0, status.useCnt - 2);
    //         if (summon) summon.useCnt = Math.max(0, summon.useCnt - 2);
    //         return { restDmg: restDmg - 1 }
    //     }, { smnId: summonId }),

    301111: () => new GIStatus(301111, '金流监督(生效中)', '本回合中，角色下一次｢普通攻击｣少花费1个[无色元素骰]，且造成的伤害+1。',
        'buff5', STATUS_GROUP.heroStatus, [STATUS_TYPE.Usage], 1, 2, 1, status => ({
            trigger: ['skilltype1'],
            addDmgType1: 1,
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => { --status.useCnt },
        })),

    // 2214: () => new GIStatus(2214, '赤王陵(生效中)', '直到本回合结束前，所在阵营每摸1张牌，就立刻生成1张【crd908】，随机地置入我方牌库中。',
    //     'debuff', 1, [4, 10], -1, 0, 1, (_status, event = {}) => {
    //         const { getcard = 0 } = event;
    //         return {
    //             trigger: ['getcard'],
    //             isAddTask: true,
    //             exec: () => ({ cmds: [{ cmd: 'addCard', cnt: getcard, card: 908, element: 1 }] }),
    //         }
    //     }),

    // 2215: () => oncePerRound(2215, '禁忌知识'),

    // 2216: () => new GIStatus(2216, '绿洲之心', '我方召唤4个【smn3063】后，我方【hro1822】附属【sts2210】，并获得2点[护盾]。',
    //     'ski1822,2', 1, [9], 0, 4, -1, (status, event = {}) => {
    //         const { card, discards: [discards] = [[]], heros = [] } = event;
    //         if (card?.id != 907 && discards.every(c => c.id != 907) && status.useCnt < 4) return;
    //         return {
    //             trigger: ['card', 'discard'],
    //             exec: () => {
    //                 if (++status.useCnt == 4) {
    //                     return { cmds: [{ cmd: 'getStatus', status: [heroStatus(2210), heroStatus(2211)] }], hidxs: [heros.findIndex(h => h.id == 1822)] }
    //                 }
    //             }
    //         }
    //     }, { icbg: STATUS_BG_COLOR[7] }),

    // 2217: (cnt = 1) => new GIStatus(2217, '奇异之躯', '每层为【hro1724】提供1点额外最大生命。',
    //     'ski1724,3', 0, [9], cnt, 1000, -1, undefined, { icbg: STATUS_BG_COLOR[1] }),

    // 2218: () => new GIStatus(2218, '二重毁伤弹', '【所在阵营切换角色后：】对切换到的角色造成1点[火元素伤害]。；【[可用次数]：{useCnt}】',
    //     'ski1213,2', 1, [1], 2, 0, -1, () => ({
    //         damage: 1,
    //         element: 2,
    //         isSelf: true,
    //         trigger: ['change-to'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         }
    //     }), { icbg: DEBUFF_BG_COLOR }),

    // 2219: () => new GIStatus(2219, '尖兵协同战法(生效中)', '我方造成的[火元素伤害]或[雷元素伤害]+1。(包括角色引发的扩散伤害)；【[可用次数]：{useCnt}】',
    //     'buff2', 1, [4, 6], 2, 0, -1, status => ({
    //         trigger: ['fire-dmg', 'thunder-dmg', 'fire-dmg-wind', 'thunder-dmg-wind'],
    //         addDmgCdt: 1,
    //         exec: () => { --status.useCnt },
    //     })),

    // 2220: () => new GIStatus(2220, '掠袭锐势', '【结束阶段：】对所有附属有【sts2221】的敌方角色造成1点[穿透伤害]。；【[持续回合]：{useCnt}】',
    //     'ski1704,2', 0, [1], 2, 0, -1, (status, { heros = [] } = {}) => ({
    //         trigger: ['phase-end'],
    //         pdmg: 1,
    //         hidxs: heros.map((h, hi) => ({ h, hi })).filter(v => v.h.inStatus.some(ist => ist.id == 2221)).map(v => v.hi),
    //         exec: () => { --status.useCnt },
    //     }), { icbg: STATUS_BG_COLOR[4] }),

    // 2221: (useCnt = 1) => new GIStatus(2221, '生命之契', '【所附属角色受到治疗时：】此效果每有1次[可用次数]，就消耗1次，以抵消1点所受到的治疗。(无法抵消复苏治疗和分配生命值引发的治疗)；【[可用次数]：{useCnt}(可叠加，没有上限)】',
    //     '', 0, [1], useCnt, 0, -1, (status, event = {}) => {
    //         const { heal = [] } = event;
    //         return {
    //             trigger: ['pre-heal'],
    //             exec: () => { --status.useCnt },
    //         }
    //     }, { icbg: DEBUFF_BG_COLOR }),

    // 2222: () => new GIStatus(2222, '噔噔！(生效中)', '结束阶段时，摸2张牌。',
    //     'buff3', 0, [3], 1, 0, -1, () => ({
    //         trigger: ['phase-end'],
    //         cmds: [{ cmd: 'getCard', cnt: 2 }],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     })),

    // 2223: () => new GIStatus(2223, '｢看到那小子挣钱…｣(生效中)', '本回合中，每当对方获得2个元素骰，你就获得1个[万能元素骰]。(此效果提供的元素骰除外)',
    //     'buff3', 1, [4, 9], 0, 0, 1, (status, event = {}) => {
    //         const { getcard = 0, source = -1 } = event;
    //         if (source == 2223) return;
    //         const cnt = status.useCnt + getcard;
    //         return {
    //             trigger: ['getdice-oppo'],
    //             isAddTask: true,
    //             cmds: isCdt(cnt >= 2, [{ cmd: 'getDice', cnt: Math.floor(cnt / 2), element: 0 }]),
    //             exec: () => { status.useCnt = cnt % 2 }
    //         }
    //     }),

};

export const newStatus = (version: Version = VERSION[0]) => (id: number, ...args: any) => statusTotal[id](version, ...args);