import { AddDiceSkill, Card, Cmds, GameInfo, Hero, MinuDiceSkill, Status, Summon, Trigger } from "../../typing";
import {
    CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CMD_MODE, DAMAGE_TYPE, DICE_COST_TYPE, ELEMENT_CODE, ELEMENT_CODE_KEY, ELEMENT_TYPE, ELEMENT_TYPE_KEY, ElementCode, ElementType, HERO_TAG, PureElementType, SKILL_TYPE, STATUS_TYPE, SkillType, Version, WEAPON_TYPE, WeaponType
} from "../constant/enum.js";
import { MAX_USE_COUNT } from "../constant/gameOption.js";
import { DEBUFF_BG_COLOR, ELEMENT_ICON, ELEMENT_NAME, STATUS_BG_COLOR, STATUS_BG_COLOR_KEY } from "../constant/UIconst.js";
import { allHidxs, getBackHidxs, getHidById, getMaxHertHidxs, getMinHertHidxs, getObjById, getObjIdxById, hasObjById } from "../utils/gameUtil.js";
import { clone, isCdt } from "../utils/utils.js";
import { StatusBuilder } from "./builder/statusBuilder.js";
import { newSummon } from "./summons.js";

export type StatusHandleEvent = {
    restDmg?: number,
    summon?: Summon,
    hidx?: number,
    heros?: Hero[],
    combatStatus?: Status[],
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
    isMinusDiceTalent?: boolean,
    isMinusDiceSkill?: boolean,
    minusDiceSkill?: number[][],
    heal?: number[],
    force?: boolean,
    summons?: Summon[],
    esummons?: Summon[],
    getDmgIdx?: number,
    hcardsCnt?: number,
    pile?: Card[],
    playerInfo?: GameInfo,
    isSummon?: number[],
    source?: number,
    randomInt?: (len?: number) => number,
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
};

export type StatusExecEvent = {
    switchHeroDiceCnt?: number,
    heros?: Hero[],
    combatStatus?: Status[],
    summons?: Summon[],
    isQuickAction?: boolean,
}

export type StatusExecRes = {
    cmds?: Cmds[],
    switchHeroDiceCnt?: number,
    hidxs?: number[],
}

const enchantStatus = (el: PureElementType, addDmg: number = 0) => {
    const elName = ELEMENT_NAME[el];
    const hasAddDmgDesc = addDmg > 0 ? `，且造成的[${elName}伤害]+${addDmg}` : '';
    return new StatusBuilder(`${elName}附魔`).heroStatus().type(STATUS_TYPE.Enchant)
        .icon(`buff${addDmg > 0 ? '4' : ''}`).iconBg(STATUS_BG_COLOR[el])
        .description(`所附属角色造成的[物理伤害]变为[${elName}伤害]${hasAddDmgDesc}。；[roundCnt]`)
        .handle(status => ({
            attachEl: STATUS_BG_COLOR_KEY[status.UI.iconBg] as PureElementType,
            addDmg,
        }));
}

const readySkillStatus = (name: string, skill: number, shieldStatusId?: number) => {
    return new StatusBuilder(name).heroStatus().icon('buff3').useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.ReadySkill)
        .description(`本角色将在下次行动时，直接使用技能：【rsk${skill}】。`)
        .handle((status, event) => ({
            trigger: ['change-from', 'useReadySkill'],
            skill,
            exec: () => {
                --status.useCnt;
                if (shieldStatusId) {
                    const { heros = [], hidx = -1 } = event;
                    const shieldStatus = getObjById(heros[hidx].heroStatus, shieldStatusId);
                    if (shieldStatus) shieldStatus.useCnt = 0;
                }
            }
        }))
}

const senlin1Status = (name: string) => {
    return new StatusBuilder(name + '(生效中)').heroStatus().icon('buff2').roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【角色在本回合中，下次对角色打出｢天赋｣或使用｢元素战技｣时：】少花费2个元素骰。')
        .handle((status, event) => {
            const { card, heros = [], hidx = -1, trigger = '', minusDiceCard: mdc = 0, isMinusDiceSkill = false } = event;
            const isMinusCard = card && card.hasSubtype(CARD_SUBTYPE.Talent) && card.userType == heros[hidx]?.id && card.cost + card.anydice > mdc;
            return {
                minusDiceSkill: { skilltype2: [0, 0, 2] },
                minusDiceCard: isCdt(isMinusCard, 2),
                trigger: ['skilltype2', 'card'],
                exec: () => {
                    if (trigger == 'card' && !isMinusCard) return;
                    if (trigger == 'skilltype2' && !isMinusDiceSkill) return;
                    --status.roundCnt;
                }
            }
        });
}

const senlin2Status = (name: string) => {
    return new StatusBuilder(name + '(生效中)').heroStatus().icon('buff2').roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【角色在本回合中，下次使用｢普通攻击｣后：】生成2个此角色类型的元素骰。')
        .handle(status => ({
            trigger: ['skilltype1'],
            exec: () => {
                --status.roundCnt;
                return { cmds: [{ cmd: 'getDice', cnt: 2, mode: CMD_MODE.FrontHero }] }
            }
        }));
}

const card311306sts = (name: string) => {
    return new StatusBuilder(name).heroStatus().icon('buff5').roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('本回合内，所附属角色下次造成的伤害额外+1。')
        .handle(status => ({
            trigger: ['skill'],
            addDmg: 1,
            exec: () => { --status.roundCnt }
        }));
}

// const card587sts = (element: number) => {
//     const names = ['', '藏镜仕女', '火铳游击兵', '雷锤前锋军', '冰萤术士'];
//     return new GIStatus(2123 + element, '愚人众伏兵·' + names[element], `所在阵营的角色使用技能后：对所在阵营的出战角色造成1点[${ELEMENT[element]}伤害]。(每回合1次)；[useCnt]`,
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

const status11505x = (swirlEl: PureElementType) => {
    return new StatusBuilder('风物之诗咏·' + ELEMENT_NAME[swirlEl][0]).combatStatus().icon('buff4').useCnt(2)
        .type(STATUS_TYPE.AddDamage).iconBg(STATUS_BG_COLOR[swirlEl])
        .description(`我方角色和召唤物所造成的[${ELEMENT_NAME[swirlEl]}伤害]+1。；[useCnt]`)
        .handle(status => ({
            trigger: [`${ELEMENT_TYPE_KEY[STATUS_BG_COLOR_KEY[status.UI.iconBg] as ElementType]}-dmg`],
            addDmgCdt: 1,
            exec: () => { --status.useCnt }
        }));
}

const shieldStatus = (name: string, cnt = 2, mcnt = 0) => {
    return new StatusBuilder(name).combatStatus().type(STATUS_TYPE.Shield).useCnt(cnt).maxCnt(mcnt)
        .description(`为我方出战角色提供${cnt}点[护盾]。${mcnt > 0 ? `(可叠加，最多到${mcnt})` : ''}`);
}

const readySkillShieldStatus = (name: string) => {
    return new StatusBuilder(name).heroStatus().type(STATUS_TYPE.Shield).useCnt(2)
        .description(`准备技能期间，提供2点[护盾]，保护所附属角色。`);
}

const coolDownStatus = (name: string) => {
    return new StatusBuilder(`${name}(冷却中)`).combatStatus().icon('debuff').roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign).description(`本回合无法再打出【${name}】。`);
}


const statusTotal: Record<number, (...args: any) => StatusBuilder> = {

    106: () => new StatusBuilder('冻结').heroStatus().roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign, STATUS_TYPE.NonAction)
        .description('角色无法使用技能持续到回合结束。；角色受到[火元素伤害]或[物理伤害]时，移除此效果，使该伤害+2')
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Frozen.webp')
        .handle((status, event) => {
            const { trigger = '' } = event;
            if (['Physical-getdmg', 'Pyro-getdmg'].includes(trigger)) {
                return { addDmgCdt: 2, exec: () => { --status.roundCnt } }
            }
        }),

    111: () => shieldStatus('结晶', 1, 2),

    116: () => new StatusBuilder('草原核').combatStatus().type(STATUS_TYPE.AddDamage).useCnt(1)
        .description('【我方对敌方出战角色造成[火元素伤害]或[雷元素伤害]时，】伤害值+2。；[useCnt]')
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Reaction_116.webp')
        .handle((status, event) => {
            const { eheros = [], getDmgIdx = -1 } = event;
            if (!eheros[getDmgIdx]?.isFront) return;
            return {
                addDmgCdt: 2,
                trigger: ['Pyro-dmg', 'Electro-dmg'],
                exec: () => { --status.useCnt },
            }
        }),

    117: () => new StatusBuilder('激化领域').combatStatus().type(STATUS_TYPE.AddDamage).useCnt(2)
        .description('【我方对敌方出战角色造成[雷元素伤害]或[草元素伤害]时，】伤害值+1。；[useCnt]')
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Reaction_117.webp')
        .handle((status, event) => {
            const { eheros = [], getDmgIdx = -1 } = event;
            if (!eheros[getDmgIdx]?.isFront) return;
            return {
                addDmgCdt: 1,
                trigger: ['Dendro-dmg', 'Electro-dmg'],
                exec: () => { --status.useCnt },
            }
        }),

    122: (useCnt: number = 1) => new StatusBuilder('生命之契').heroStatus().useCnt(useCnt).maxCnt(MAX_USE_COUNT)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Debuff_Common_HpDebts.webp')
        .description('【所附属角色受到治疗时：】此效果每有1次[可用次数]，就消耗1次，以抵消1点所受到的治疗。(无法抵消复苏治疗和分配生命值引发的治疗)；[useCnt]')
    // .handle((status, event) => {
    //     const { heal = [] } = event;

    //     return {
    //         trigger: ['pre-heal'],
    //         exec: () => { --status.useCnt },
    //     }
    // })
    , // todo 没做完

    111012: () => new StatusBuilder('冰莲').combatStatus().type(STATUS_TYPE.Barrier).useCnt(2)
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    111021: (isTalent: boolean = false) => new StatusBuilder('猫爪护盾').combatStatus().type(STATUS_TYPE.Shield)
        .useCnt(isTalent ? 2 : 1).description('为我方出战角色提供1点[护盾]。').talent(isTalent),

    111031: () => new StatusBuilder('寒冰之棱').combatStatus().type(STATUS_TYPE.Attack).useCnt(3)
        .description('【我方切换角色后：】造成2点[冰元素伤害]。；[useCnt]').icon('ski,2')
        .handle(() => ({
            damage: 2,
            element: ELEMENT_TYPE.Cryo,
            trigger: ['change-from'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    111041: (isTalent: boolean = false) => new StatusBuilder('重华叠霜领域').combatStatus()
        .roundCnt(2).roundCnt(3, 'v4.2.0', isTalent).talent(isTalent).icon('buff')
        .description(`我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[冰元素伤害]${isTalent ? '，｢普通攻击｣造成的伤害+1' : ''}。；[roundCnt]`)
        .type(STATUS_TYPE.Enchant).type(isTalent, STATUS_TYPE.AddDamage)
        .handle((status, event) => {
            const { heros = [], hidx = -1 } = event;
            const isWeapon = hidx > -1 && ([WEAPON_TYPE.Sword, WEAPON_TYPE.Claymore, WEAPON_TYPE.Polearm] as WeaponType[]).includes(heros[hidx].weaponType);
            return {
                trigger: ['skilltype1'],
                addDmgType1: isCdt(status.isTalent && isWeapon, 1),
                attachEl: isCdt(isWeapon, ELEMENT_TYPE.Cryo),
            }
        }),

    111052: (rcnt: number = 1, addDmg: number = 0) => enchantStatus(ELEMENT_TYPE.Cryo, addDmg).roundCnt(rcnt),

    111061: () => new StatusBuilder('冷酷之心').heroStatus().icon('buff4').useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('【所附属角色使用〖ski,1〗时：】移除此状态，使本次伤害+3。')
        .description('【所附属角色使用〖ski,1〗时：】移除此状态，使本次伤害+2。', 'v3.8.0')
        .handle((status, _, ver) => ({
            trigger: ['skilltype2'],
            addDmgCdt: ver < 'v3.8.0' ? 2 : 3,
            exec: () => { --status.useCnt },
        })),

    111071: (isTalent: boolean = false) => new StatusBuilder('冰翎').combatStatus().icon('buff4').useCnt(2).useCnt(3, 'v4.2.0').perCnt(1, isTalent)
        .type(STATUS_TYPE.AddDamage).talent(isTalent)
        .description(`我方角色造成的[冰元素伤害]+1。(包括角色引发的‹1冰元素›扩散的伤害)；[useCnt]${isTalent ? '；我方角色通过｢普通攻击｣触发此效果时，不消耗｢[可用次数]｣。(每回合1次)' : ''}`)
        .handle((status, event) => {
            const { skilltype = -1 } = event;
            return {
                addDmgCdt: 1,
                trigger: isCdt(skilltype != -1, ['Cryo-dmg', 'Cryo-dmg-Swirl']),
                exec: () => {
                    if (status.perCnt == 1 && skilltype == SKILL_TYPE.Normal) {
                        --status.perCnt;
                    } else {
                        --status.useCnt;
                    }
                }
            }
        }),

    111082: () => new StatusBuilder('度厄真符').combatStatus().icon('ski,2').useCnt(3).type(STATUS_TYPE.Attack)
        .description('【我方角色使用技能后：】如果该角色生命值未满，则治疗该角色2点。；[useCnt]')
        .handle((_, event) => {
            const { heros = [], hidx = -1 } = event;
            const fhero = heros[hidx];
            if (!fhero) return;
            const isHeal = fhero.hp < fhero.maxHp;
            return {
                trigger: ['after-skill'],
                heal: isCdt(isHeal, 2),
                exec: eStatus => {
                    if (isHeal && eStatus) --eStatus.useCnt;
                }
            }
        }),

    111091: () => shieldStatus('安眠帷幕护盾'),

    111092: () => new StatusBuilder('飞星').combatStatus().icon('ski,1').useCnt(1).maxCnt(MAX_USE_COUNT).addCnt(2)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('【我方角色使用技能后：】累积1枚｢晚星｣。；如果｢晚星｣已有至少4枚，则消耗4枚｢晚星｣，造成1点[冰元素伤害]。(生成此出战状态的技能，也会触发此效果)；【重复生成此出战状态时：】累积2枚｢晚星｣。')
        .handle((status, event) => {
            const { heros = [], card, trigger = '' } = event;
            const hid = getHidById(status.id);
            const isDmg = status.useCnt >= 4 && trigger == 'after-skill';
            const isTalent = !!getObjById(heros, hid)?.talentSlot || card?.id == 211091;
            const triggers: Trigger[] = ['skill'];
            if (isDmg) triggers.push('after-skill');
            return {
                trigger: triggers,
                damage: isCdt(isDmg, 1),
                element: DAMAGE_TYPE.Cryo,
                cmds: isCdt(isTalent, [{ cmd: 'getCard', cnt: 1 }]),
                exec: eStatus => {
                    if (trigger == 'skill') ++status.useCnt;
                    if (eStatus) eStatus.useCnt -= 4;
                }
            }
        }),

    111101: () => new StatusBuilder('瞬时剪影').heroStatus().icon('ice-dice').useCnt(2).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description(`【结束阶段：】对所附属角色造成1点[冰元素伤害]; 如果[可用次数]仅剩余1且所附属角色具有[冰元素附着]，则此伤害+1。；[useCnt]`)
        .handle((status, event) => {
            const { heros = [], hidx = -1 } = event;
            const isAddDmg = heros[hidx]?.attachElement.includes(ELEMENT_TYPE.Cryo) && status.useCnt == 1;
            return {
                damage: isCdt(isAddDmg, 2, 1),
                element: DAMAGE_TYPE.Cryo,
                isSelf: true,
                trigger: ['phase-end'],
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                },
            }
        }),

    111111: () => new StatusBuilder('寒烈的惩裁').heroStatus().icon('ski,1').useCnt(2).type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage)
        .description('【角色进行｢普通攻击｣时：】如果角色生命至少为6，则此技能少花费1个[冰元素骰]，伤害+1，且对自身造成1点[穿透伤害]。；如果角色生命不多于5，则使此伤害+1，并且技能结算后治疗角色2点。；[useCnt]')
        .handle((_, event) => {
            const { heros = [], hidx = -1 } = event;
            if (hidx == -1) return;
            let res: StatusHandleRes = {};
            const curHp = heros[hidx]?.hp ?? 0;
            if (curHp >= 6) res = { addDmgCdt: 1, pdmg: 1, hidxs: [hidx], isSelf: true };
            else res = { addDmgCdt: 1, heal: 2 };
            return {
                trigger: ['after-skilltype1', 'skilltype1'],
                minusDiceSkill: isCdt(curHp < 6, { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Cryo }),
                ...res,
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt
                }
            }
        }),

    111112: () => new StatusBuilder('余威冰锥').combatStatus().icon('ski,2').useCnt(1).type(STATUS_TYPE.Attack)
        .description('【我方选择行动前：】造成2点[冰元素伤害]。；[useCnt]')
        .handle(() => ({
            damage: 2,
            element: DAMAGE_TYPE.Cryo,
            trigger: ['action-start'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    112021: (isTalent: boolean = false) => new StatusBuilder('雨帘剑').combatStatus().useCnt(2).useCnt(3, isTalent)
        .type(STATUS_TYPE.Barrier).talent(isTalent).barrierCdt(3).barrierCdt(2, ver => ver >= 'v4.2.0' && isTalent)
        .description(`【我方出战角色受到至少为${isTalent ? 2 : 3}的伤害时：】抵消1点伤害。；[useCnt]`)
        .description(`【我方出战角色受到至少为3的伤害时：】抵消1点伤害。；[useCnt]`, 'v4.2.0'),

    112022: () => new StatusBuilder('虹剑势').combatStatus().icon('ski,2').useCnt(3).type(STATUS_TYPE.Attack)
        .description('【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。；[useCnt]')
        .description('【我方角色｢普通攻击｣后：】造成2点[水元素伤害]。；[useCnt]', 'v3.6.0')
        .handle((_s, _e, ver) => ({
            damage: ver < 'v3.6.0' ? 2 : 1,
            element: DAMAGE_TYPE.Hydro,
            trigger: ['after-skilltype1'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    112031: () => new StatusBuilder('虚影').combatStatus().roundCnt(1).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    112032: () => new StatusBuilder('泡影').combatStatus().icon('ski,2').useCnt(1)
        .type(STATUS_TYPE.MultiDamage, STATUS_TYPE.Sign)
        .description('【我方造成技能伤害时：】移除此状态，使本次伤害加倍。')
        .handle((status, event) => ({
            multiDmgCdt: 2,
            trigger: isCdt(event.hasDmg, ['skill']),
            exec: () => { --status.useCnt }
        })),

    112041: () => new StatusBuilder('远程状态').heroStatus().icon('ski,3').type(STATUS_TYPE.Sign)
        .description('【所附属角色进行[重击]后：】目标角色附属【sts112043】。')
        .handle((_, event, ver) => ({
            trigger: ['skilltype1'],
            exec: () => {
                const { isChargedAtk = false } = event;
                return { cmds: isCdt(isChargedAtk, [{ cmd: 'getStatus', status: [newStatus(ver)(112043)], isOppo: true }]) }
            }
        })),

    112042: () => new StatusBuilder('近战状态').heroStatus().icon('ski,1').roundCnt(2).perCnt(2)
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('角色造成的[物理伤害]转换为[水元素伤害]。；【角色进行[重击]后：】目标角色附属【sts112043】。；角色对附属有【sts112043】的角色造成的伤害+1;；【角色对已附属有断流的角色使用技能后：】对下一个敌方后台角色造成1点[穿透伤害]。(每回合至多2次)；[roundCnt]')
        .handle((status, event, ver) => {
            const { isChargedAtk, eheros = [], trigger = '' } = event;
            const efHero = eheros.find(h => h.isFront);
            const isDuanliu = hasObjById(efHero?.heroStatus, 112043);
            const [afterIdx = -1] = getBackHidxs(eheros);
            const isPenDmg = status.perCnt > 0 && isDuanliu && afterIdx > -1 && trigger == 'skill';
            return {
                trigger: ['phase-end', 'skill'],
                pdmg: isCdt(isPenDmg, 1),
                hidxs: isCdt(isPenDmg, [afterIdx]),
                addDmgCdt: isCdt(isDuanliu, 1),
                attachEl: ELEMENT_TYPE.Hydro,
                exec: () => {
                    if (trigger == 'phase-end' && status.roundCnt == 1) {
                        return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(112041)] }] }
                    }
                    if (isPenDmg) --status.perCnt;
                    return { cmds: isCdt(isChargedAtk, [{ cmd: 'getStatus', status: [newStatus(ver)(112043)], isOppo: true }]) }
                },
            }
        }),

    112043: () => new StatusBuilder('断流').heroStatus().icon('ski,2').iconBg(DEBUFF_BG_COLOR).roundCnt(2, 'v4.1.0')
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.NonDestroy).type(ver => ver >= 'v4.1.0', STATUS_TYPE.Sign)
        .description('【所附属角色被击倒后：】对所在阵营的出战角色附属【断流】。')
        .handle((status, event, ver) => {
            const { heros = [], hidx = -1, eheros = [], hidxs, trigger = '' } = event;
            const triggers: Trigger[] = ['killed'];
            const isTalent = trigger == 'phase-end' && !!getObjById(eheros, getHidById(status.id))?.talentSlot && (ver < 'v4.1.0' || heros[hidx].isFront);
            if (isTalent) triggers.push('phase-end');
            return {
                trigger: triggers,
                pdmg: isCdt(isTalent, 1),
                hidxs: isCdt(isTalent, [hidx]),
                isSelf: isCdt(isTalent, true),
                exec: () => {
                    if (trigger == 'killed') {
                        const nonDestroy = status.type.indexOf(STATUS_TYPE.NonDestroy);
                        if (nonDestroy > -1) status.type.splice(nonDestroy, 1);
                        return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(112043)], hidxs }] }
                    }
                }
            }
        }),

    112052: () => new StatusBuilder('仪来羽衣').heroStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage)
        .description('所附属角色｢普通攻击｣造成的伤害+1。；【所附属角色｢普通攻击｣后：】治疗所有我方角色1点。；[roundCnt]')
        .handle((_status, event) => {
            const { heros = [], trigger = '' } = event;
            return {
                addDmgType1: 1,
                trigger: ['skilltype1', 'after-skilltype1'],
                heal: isCdt(trigger == 'after-skilltype1', 1),
                hidxs: allHidxs(heros),
            }
        }),

    112061: () => new StatusBuilder('泷廻鉴花').heroStatus().icon('buff4').useCnt(3).useCnt(2, 'v4.1.0')
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色｢普通攻击｣造成的伤害+1，造成的[物理伤害]变为[水元素伤害]。；[useCnt]')
        .handle(status => ({
            addDmgType1: 1,
            trigger: ['skilltype1'],
            attachEl: ELEMENT_TYPE.Hydro,
            exec: () => { --status.useCnt },
        })),

    112071: () => readySkillShieldStatus('苍鹭护盾'),

    112072: (isTalent: boolean = false) => new StatusBuilder('赤冕祝祷').combatStatus().icon('ski,2').roundCnt(2).perCnt(1).perCnt(3, isTalent)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant).talent(isTalent)
        .description(`我方角色｢普通攻击｣造成的伤害+1。；我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[水元素伤害]。；【我方切换角色后：】造成1点[水元素伤害]。(每回合1次)；${isTalent ? '【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。(每回合1次)；' : ''}[roundCnt]`)
        .handle((status, event) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const isWeapon = hidx > -1 && ([WEAPON_TYPE.Sword, WEAPON_TYPE.Claymore, WEAPON_TYPE.Polearm] as WeaponType[]).includes(heros[hidx]?.weaponType);
            let isDmg = true;
            const triggers: Trigger[] = ['skilltype1'];
            if (trigger == 'change-from') {
                isDmg = (status.perCnt >> 0 & 1) == 1;
                if (isDmg) triggers.push('change-from');
            } else if (trigger == 'after-skilltype1' && status.isTalent) {
                isDmg = (status.perCnt >> 1 & 1) == 1;
                if (isDmg) triggers.push('after-skilltype1');
            }
            return {
                trigger: triggers,
                addDmgType1: 1,
                damage: isCdt(isDmg, 1),
                element: ELEMENT_TYPE.Hydro,
                attachEl: isCdt(isWeapon, ELEMENT_TYPE.Hydro),
                exec: eStatus => {
                    const trg = ['change-from', 'after-skilltype1'].indexOf(trigger);
                    if (eStatus && trg > -1) eStatus.perCnt &= ~(1 << trg);
                },
            }
        }),

    112074: () => readySkillStatus('苍鹭震击', 12074, 112071),

    112081: () => new StatusBuilder('金杯的丰馈').combatStatus().icon('ski,1').type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【敌方角色受到绽放反应时：】我方不再生成【sts116】，而是改为召唤【smn112082】。')
        .handle((_s, _e, ver) => ({ trigger: ['Bloom'], summon: [newSummon(ver)(3043)] })),

    112083: () => new StatusBuilder('永世流沔').heroStatus().icon('ski,2').useCnt(1).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【结束阶段：】对所附属角色造成3点[水元素伤害]。；[useCnt]')
        .handle(() => ({
            damage: 3,
            element: ELEMENT_TYPE.Hydro,
            isSelf: true,
            trigger: ['phase-end'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    112091: (act: number = 1) => new StatusBuilder('破局').heroStatus().useCnt(1).maxCnt(3).addCnt(act)
        .type(STATUS_TYPE.Accumulate, STATUS_TYPE.ConditionalEnchant).icon('buff').iconBg(STATUS_BG_COLOR[ELEMENT_TYPE.Hydro])
        .description('此状态初始具有1层｢破局｣; 重复附属时，叠加1层｢破局｣。｢破局｣最多可以叠加到3层。；【结束阶段：】叠加1层｢破局｣。；【所附属角色｢普通攻击｣时：】如果｢破局｣已有2层，则消耗2层｢破局｣，使造成的[物理伤害]转换为[水元素伤害]，并抓1张牌。')
        .handle((status, event) => {
            const { trigger = '' } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (status.useCnt >= 2) triggers.push('skilltype1');
            return {
                trigger: triggers,
                attachEl: isCdt(status.useCnt >= 2 && trigger == 'skilltype1', ELEMENT_TYPE.Hydro),
                cmds: isCdt(trigger == 'skilltype1', [{ cmd: 'getCard', cnt: 1 }]),
                exec: () => {
                    if (trigger == 'skilltype1') status.useCnt -= 2;
                    else if (trigger == 'phase-end') status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
                }
            }
        }),

    112092: () => new StatusBuilder('玄掷玲珑').combatStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack)
        .description('【我方角色｢普通攻击｣后：】造成1点[水元素伤害]。；[roundCnt]')
        .description('【我方角色｢普通攻击｣后：】造成2点[水元素伤害]。；[roundCnt]', 'v4.6.1')
        .handle((_s, _e, ver) => ({
            damage: ver < 'v4.6.1' ? 2 : 1,
            element: ELEMENT_TYPE.Hydro,
            trigger: ['after-skilltype1'],
        })),

    112101: (cnt: number = 1) => new StatusBuilder('源水之滴').combatStatus().useCnt(cnt).maxCnt(3).type(STATUS_TYPE.Attack)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Neuvillette_S.webp')
        .description('【〖hro〗进行｢普通攻击｣后：】治疗【hro】2点，然后如果【hro】是我方｢出战角色｣，则[准备技能]：【rsk12104】。；[useCnt]')
        .handle((status, event, ver) => {
            const { heros = [], hidx = -1 } = event;
            const hid = getHidById(status.id);
            if (heros[hidx]?.id != hid) return;
            return {
                heal: 2,
                hidxs: [heros.findIndex(h => h.id = hid)],
                trigger: ['after-skilltype1'],
                exec: (eStatus, execEvent = {}) => {
                    const { heros: hs = [] } = execEvent;
                    if (eStatus) --eStatus.useCnt;
                    if (getObjById(hs, hid)?.isFront) {
                        return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(112102)] }] }
                    }
                },
            }
        }),

    112102: () => readySkillStatus('衡平推裁', 12104),

    112103: () => new StatusBuilder('遗龙之荣').heroStatus().icon('buff2').useCnt(2).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('角色造成的伤害+1。【[可用次数]:{useCnt}】')
        .handle(status => ({
            addDmg: 1,
            trigger: ['skill'],
            exec: () => { --status.useCnt },
        })),

    112114: () => new StatusBuilder('普世欢腾').combatStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Usage)
        .description('【我方出战角色受到伤害或治疗后：】叠加1点【sts112115】。；[roundCnt]')
        .handle((_status, event, ver) => {
            const { heal = [], hidx = -1, trigger = '' } = event;
            const triggers: Trigger[] = ['getdmg'];
            if (trigger == 'heal' && (heal[hidx] ?? 0) > 0) triggers.push('heal');
            return {
                trigger: triggers,
                exec: () => ({ cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(112115)] }] }),
            }
        }),

    112115: () => new StatusBuilder('狂欢值').combatStatus().useCnt(1).maxCnt(MAX_USE_COUNT)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Furina_E_02.webp')
        .description('我方造成的伤害+1。(包括角色引发的扩散伤害)；【[可用次数]：{useCnt}】')
        .handle((status, { trigger } = {}) => ({
            trigger: ['dmg', 'dmg-Swirl'],
            addDmg: 1,
            exec: () => {
                if (trigger == 'dmg') --status.useCnt
            },
        })),

    112116: () => new StatusBuilder('万众瞩目').heroStatus().icon('buff4').useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Enchant)
        .description('【角色进行｢普通攻击｣时：】使角色造成的造成的[物理伤害]变为[水元素伤害]。如果角色处于｢荒｣形态，则治疗我方所有后台角色1点; 如果角色处于｢芒｣形态，则此伤害+2，但是对一位受伤最少的我方角色造成1点[穿透伤害]。；[useCnt]')
        .handle((_status, event) => {
            const { heros = [], hidx = -1 } = event;
            if (hidx == -1) return;
            const { tags } = heros[hidx];
            let res: StatusHandleRes = {};
            if (tags.includes(HERO_TAG.ArkheOusia)) res = { heal: 1, hidxs: getBackHidxs(heros) };
            else res = { addDmgCdt: 2, pdmg: 1, hidxs: getMinHertHidxs(heros), isSelf: true };
            return {
                attachEl: ELEMENT_TYPE.Hydro,
                trigger: ['after-skilltype1', 'skilltype1'],
                ...res,
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt
                }
            }
        }),

    113011: () => enchantStatus(ELEMENT_TYPE.Pyro).roundCnt(2),

    113022: () => new StatusBuilder('旋火轮').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack)
        .description('【我方角色使用技能后：】造成2点[火元素伤害]。；[useCnt]')
        .handle(() => ({
            damage: 2,
            element: ELEMENT_TYPE.Pyro,
            trigger: ['after-skill'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    113031: (isTalent: boolean = false) => new StatusBuilder('鼓舞领域').combatStatus().icon('ski,2').roundCnt(2)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).talent(isTalent)
        .description('【我方角色使用技能时：】如果该角色生命值至少为7，则使此伤害额外+2; 技能结算后，如果该角色生命值不多于6，则治疗该角色2点。；[roundCnt]')
        .handle((status, event) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            if (hidx == -1) return;
            const fHero = heros[hidx];
            return {
                trigger: ['skill', 'after-skill'],
                addDmgCdt: isCdt(fHero.hp >= 7 || status.isTalent, 2),
                heal: isCdt(fHero.hp <= 6 && trigger == 'after-skill', Math.min(2, fHero.maxHp - fHero.hp)),
            }
        }),

    113051: (isTalent: boolean = false) => new StatusBuilder('庭火焰硝').heroStatus().icon('buff4')
        .useCnt(3).useCnt(2, 'v4.7.0').useCnt(3, 'v4.7.0', isTalent).useCnt(2, 'v4.2.0')
        .type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant).talent(isTalent)
        .description(`所附属角色｢普通攻击｣伤害+1，造成的[物理伤害]变为[火元素伤害]。${isTalent ? '；【所附属角色使用｢普通攻击｣后：】造成1点[火元素伤害]。' : ''}；[useCnt]`)
        .handle((status, event) => {
            const { trigger = '' } = event;
            return {
                trigger: ['skilltype1', 'after-skilltype1'],
                addDmgType1: 1,
                damage: isCdt(status.isTalent && trigger.endsWith('skilltype1'), 1),
                element: ELEMENT_TYPE.Pyro,
                attachEl: ELEMENT_TYPE.Pyro,
                exec: eStatus => {
                    if (!status.isTalent) --status.useCnt;
                    else if (eStatus) --eStatus.useCnt;
                },
            }
        }),

    113052: () => new StatusBuilder('琉金火光').combatStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack)
        .description('【hro】以外的我方角色使用技能后：造成1点[火元素伤害]。；[roundCnt]')
        .handle((status, event) => {
            const { heros = [], hidx = -1 } = event;
            return {
                damage: 1,
                element: ELEMENT_TYPE.Pyro,
                trigger: isCdt(hidx > -1 && heros[hidx].id != getHidById(status.id), ['after-skill']),
            }
        }),

    113041: () => new StatusBuilder('兔兔伯爵').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消2点伤害。；[useCnt]').barrierCnt(2),

    113061: (isTalent: boolean = false) => new StatusBuilder('爆裂火花').heroStatus().icon('buff5').useCnt(1).useCnt(2, isTalent)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).talent(isTalent)
        .description('【所附属角色进行[重击]时：】少花费1个[火元素骰]，并且伤害+1。；[useCnt]')
        .handle((status, event) => {
            if (!event.isChargedAtk) return;
            return {
                trigger: ['skilltype1'],
                addDmgCdt: 1,
                minusDiceSkill: { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Pyro },
                exec: () => { --status.useCnt },
            }
        }),

    113063: () => new StatusBuilder('轰轰火花').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营的角色使用技能后：】对所在阵营的出战角色造成2点[火元素伤害]。；[useCnt]')
        .handle(() => ({
            damage: 2,
            element: ELEMENT_TYPE.Pyro,
            isSelf: true,
            trigger: ['after-skill'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        })),

    113071: () => new StatusBuilder('彼岸蝶舞').heroStatus().icon('buff5').roundCnt(2).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色造成的[物理伤害]变为[火元素伤害]，且角色造成的[火元素伤害]+1。；【所附属角色进行[重击]时：】目标角色附属【sts113072】。；[roundCnt]')
        .handle((_, event, ver) => ({
            addDmg: 1,
            attachEl: ELEMENT_TYPE.Pyro,
            trigger: ['skill'],
            exec: () => ({ cmds: isCdt(event.isChargedAtk, [{ cmd: 'getStatus', status: [newStatus(ver)(113072)], isOppo: true }]) })
        })),

    113072: () => new StatusBuilder('血梅香').combatStatus().useCnt(1).type(STATUS_TYPE.Attack)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Dot.webp')
        .description('【结束阶段：】对所附属角色造成1点[火元素伤害]。；[useCnt]')
        .handle(() => ({
            damage: 1,
            element: ELEMENT_TYPE.Pyro,
            isSelf: true,
            trigger: ['phase-end'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    113081: () => new StatusBuilder('丹火印').heroStatus().icon('buff5').useCnt(1).maxCnt(2).maxCnt(0, 'v4.2.0').type(STATUS_TYPE.AddDamage)
        .description('【角色进行[重击]时：】造成的伤害+2。；[useCnt]')
        .handle((status, event) => {
            if (!event.isChargedAtk) return;
            return {
                trigger: ['skilltype1'],
                addDmgCdt: 2,
                exec: () => { --status.useCnt },
            }
        }),

    113082: () => new StatusBuilder('灼灼').heroStatus().icon('ski,2').roundCnt(2).perCnt(1).type(STATUS_TYPE.Round, STATUS_TYPE.Usage)
        .description('【角色进行[重击]时：】少花费1个[火元素骰]。(每回合1次)；【结束阶段：】角色附属【sts113081】。；[roundCnt]')
        .handle((status, event, ver) => {
            const { isChargedAtk = false, isMinusDiceSkill = false, trigger = '' } = event;
            return {
                trigger: ['skilltype1', 'phase-end'],
                minusDiceSkill: isCdt(isChargedAtk && status.perCnt > 0, { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Pyro }),
                exec: () => {
                    if (trigger == 'phase-end') return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(113081)] }] }
                    if (trigger == 'skilltype1' && isMinusDiceSkill) --status.perCnt;
                }
            }
        }),

    113092: () => readySkillStatus('焚落踢', 13095).icon('ski,2'),

    113094: () => new StatusBuilder('净焰剑狱之护').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId(113093)
        .description('【〖hro〗在我方后台，我方出战角色受到伤害时：】抵消1点伤害; 然后，如果【hro】生命值至少为7，则对其造成1点[穿透伤害]。')
        .handle((status, event) => {
            const { restDmg = 0, heros = [] } = event;
            const hid = getHidById(status.id);
            const hero = getObjById(heros, hid);
            if (restDmg <= 0 || !hero || hero.isFront) return { restDmg }
            --status.useCnt;
            return {
                pdmg: isCdt(hero.hp >= 7, 1),
                hidxs: isCdt(hero.hp >= 7, [getObjIdxById(heros, hid)]),
                restDmg: restDmg - 1,
            }
        }),

    113102: () => new StatusBuilder('隐具余数').heroStatus().icon('buff2').useCnt(1).maxCnt(3).type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage)
        .description('｢隐具余数｣最多可以叠加到3层。；【角色使用〖ski,2〗时：】每层｢隐具余数｣使伤害+1。技能结算后，耗尽｢隐具余数｣，每层治疗角色1点。')
        .handle((status, event) => ({
            trigger: ['skilltype2', 'after-skilltype2'],
            addDmgCdt: status.useCnt,
            heal: isCdt(event.trigger == 'after-skilltype2', status.useCnt),
            exec: eStatus => {
                if (eStatus) eStatus.useCnt = 0;
            }
        })),

    113111: () => shieldStatus('烈烧佑命护盾', 1, 3),

    113112: (isTalent: boolean = false) => new StatusBuilder('炽火大铠').combatStatus().icon('ski,2').type(STATUS_TYPE.Attack)
        .useCnt(2).useCnt(3, isTalent).talent(isTalent)
        .description('【我方角色｢普通攻击｣后：】造成1点[火元素伤害]，生成【sts113111】。；[useCnt]')
        .handle((_s, _e, ver) => ({
            damage: 1,
            element: ELEMENT_TYPE.Pyro,
            trigger: ['after-skilltype1'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
                return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(113111)] }] }
            },
        })),

    113121: () => shieldStatus('热情护盾'),

    113123: () => new StatusBuilder('氛围烈焰').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack)
        .description('【我方宣布结束时：】如果我方的手牌数量不多于1，则造成1点[火元素伤害]。；[useCnt]')
        .handle((_, event) => {
            const { hcardsCnt = 10 } = event;
            if (hcardsCnt > 1) return;
            return {
                trigger: ['end-phase'],
                damage: 1,
                element: ELEMENT_TYPE.Pyro,
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                }
            }
        }),

    113132: () => new StatusBuilder('二重毁伤弹').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营切换角色后：】对切换到的角色造成1点[火元素伤害]。；[useCnt]')
        .handle(() => ({
            damage: 1,
            element: ELEMENT_TYPE.Pyro,
            isSelf: true,
            trigger: ['change-to'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        })),

    113134: () => new StatusBuilder('尖兵协同战法(生效中)').combatStatus().icon('buff2').useCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('我方造成的[火元素伤害]或[雷元素伤害]+1。(包括角色引发的扩散伤害)；[useCnt]')
        .handle(status => ({
            trigger: ['Pyro-dmg', 'Electro-dmg', 'Pyro-dmg-Swirl', 'Electro-dmg-Swirl'],
            addDmgCdt: 1,
            exec: () => { --status.useCnt },
        })),

    114021: () => new StatusBuilder('雷狼').heroStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack)
        .description('【所附属角色使用｢普通攻击｣或｢元素战技｣后：】造成2点[雷元素伤害]。；[roundCnt]')
        .handle(() => ({
            damage: 2,
            element: ELEMENT_TYPE.Electro,
            trigger: ['after-skilltype1', 'after-skilltype2'],
        })),

    114032: (isTalent: boolean = false) => enchantStatus(ELEMENT_TYPE.Electro, +isTalent).roundCnt(2 + +isTalent).talent(isTalent),

    114041: () => new StatusBuilder('启途誓使').heroStatus().icon('ski,2').roundCnt(0).maxCnt(100).type(STATUS_TYPE.Enchant, STATUS_TYPE.Accumulate)
        .description('【结束阶段：】累积1级｢凭依｣，如果｢凭依｣级数至少为8，则｢凭依｣级数-6。；【根据｢凭依｣级数，提供效果：】；大于等于2级：[物理伤害]转化为[雷元素伤害];；大于等于4级：造成的伤害+2。')
        .description('【结束阶段：】累积1级｢凭依｣。；【根据｢凭依｣级数，提供效果：】；大于等于2级：[物理伤害]转化为[雷元素伤害];；大于等于4级：造成的伤害+2;；大于等于6级：｢凭依｣级数-4。', 'v4.8.0')
        .handle((status, event, ver) => {
            const { trigger = '' } = event;
            const isAttachEl = status.useCnt >= 2;
            const triggers: Trigger[] = ['phase-end', 'skilltype3'];
            if (ver >= 'v4.8.0') triggers.push('skilltype2');
            return {
                trigger: triggers,
                addDmg: isCdt(status.useCnt >= 4, 2),
                attachEl: isCdt(isAttachEl, ELEMENT_TYPE.Electro),
                isUpdateAttachEl: isAttachEl,
                exec: () => {
                    if (trigger == 'phase-end' || trigger == 'skilltype2') ++status.useCnt;
                    else if (trigger == 'skilltype3') status.useCnt += 2;
                    if (ver < 'v4.8.0') {
                        if (status.useCnt >= 6) status.useCnt -= 4;
                    } else {
                        if (trigger == 'phase-end' && status.useCnt >= 8) status.useCnt -= 6;
                    }
                }
            }
        }),

    114051: () => readySkillShieldStatus('捉浪·涛拥之守').handle((_s, _e, ver) => {
        if (ver >= 'v4.2.0') return;
        return {
            trigger: ['getdmg'],
            exec: () => ({ cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(114052)] }] })
        }
    }),

    114052: () => new StatusBuilder('奔潮引电').heroStatus().icon('buff3').useCnt(2).roundCnt(1).type(STATUS_TYPE.Round, STATUS_TYPE.Usage)
        .description('本回合内所附属的角色｢普通攻击｣少花费1个[无色元素骰]。；[useCnt]')
        .handle((status, event) => ({
            trigger: ['skilltype1'],
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => {
                if (event.isMinusDiceSkill) --status.useCnt;
            }
        })),

    114053: () => new StatusBuilder('雷兽之盾').heroStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack, STATUS_TYPE.Barrier)
        .description('【我方角色｢普通攻击｣后：】造成1点[雷元素伤害]。；【我方角色受到至少为3的伤害时：】抵消其中1点伤害。；[roundCnt]')
        .handle((_, event) => {
            const { restDmg = 0 } = event;
            return {
                damage: 1,
                element: ELEMENT_TYPE.Electro,
                trigger: ['after-skilltype1'],
                restDmg: restDmg < 3 ? restDmg : restDmg - 1,
            }
        }),

    114055: () => readySkillStatus('踏潮', 14054, 114051),

    114063: () => new StatusBuilder('鸣煌护持').heroStatus().icon('buff5').useCnt(2).type(STATUS_TYPE.AddDamage)
        .description('所附属角色｢元素战技｣和｢元素爆发｣造成的伤害+1。；[useCnt]')
        .handle((status, event) => {
            const { skilltype = 1, hasDmg = false } = event;
            const trigger: Trigger[] = [];
            if (hasDmg && ([SKILL_TYPE.Elemental, SKILL_TYPE.Burst] as SkillType[]).includes(skilltype)) {
                trigger.push(`skilltype${skilltype}` as Trigger);
            }
            return {
                addDmgType2: 1,
                addDmgType3: 1,
                trigger,
                exec: () => { --status.useCnt },
            }
        }),

    114072: () => new StatusBuilder('诸愿百眼之轮').heroStatus().icon('ski,2').useCnt(0).maxCnt(3).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Accumulate)
        .description('【其他我方角色使用｢元素爆发｣后：】累积1点｢愿力｣。(最多累积3点)；【所附属角色使用〖ski,2〗时：】消耗所有｢愿力｣，每点｢愿力｣使造成的伤害+1。')
        .handle((status, event) => {
            const { trigger = '' } = event;
            return {
                trigger: ['other-skilltype3', 'skilltype3'],
                exec: () => {
                    if (trigger == 'skilltype3') {
                        status.useCnt = 0;
                    } else if (trigger == 'other-skilltype3') {
                        status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
                    }
                }
            }
        }),

    114082: () => new StatusBuilder('遣役之仪').heroStatus().icon('buff3').roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('本回合中，所附属角色下次施放【ski,1】时少花费2个元素骰。')
        .handle((status, event) => ({
            trigger: ['skilltype2'],
            minusDiceSkill: { skilltype2: [0, 0, 2] },
            exec: () => {
                if (event.isMinusDiceSkill) --status.roundCnt;
            }
        })),

    114083: () => new StatusBuilder('天狐霆雷').combatStatus().icon('ski,2').useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Sign)
        .description('【我方选择行动前：】造成3点[雷元素伤害]。；[useCnt]')
        .handle(() => ({
            damage: 3,
            element: ELEMENT_TYPE.Electro,
            trigger: ['action-start'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    114091: () => new StatusBuilder('引雷').heroStatus().icon('debuff').useCnt(2).addCnt(1).maxCnt(4).type(STATUS_TYPE.AddDamage)
        .description('此状态初始具有2层｢引雷｣; 重复附属时，叠加1层｢引雷｣。｢引雷｣最多可以叠加到4层。；【结束阶段：】叠加1层｢引雷｣。；【所附属角色受到〖ski,1〗伤害时：】移除此状态，每层｢引雷｣使此伤害+1。')
        .handle(status => ({
            trigger: ['phase-end'],
            exec: () => { status.useCnt = Math.min(status.maxCnt, status.useCnt + 1) },
        })),

    114111: () => new StatusBuilder('越袚草轮').combatStatus().icon('ski,1').useCnt(3).perCnt(1).type(STATUS_TYPE.Attack)
        .description('【我方切换角色后：】造成1点[雷元素伤害]，治疗我方受伤最多的角色1点。(每回合1次)；[useCnt]')
        .handle((status, event) => {
            if (status.perCnt <= 0) return;
            return {
                damage: 1,
                element: ELEMENT_TYPE.Electro,
                heal: 1,
                hidxs: getMaxHertHidxs(event.heros ?? []),
                trigger: ['change-from'],
                exec: eStatus => {
                    if (eStatus) {
                        --eStatus.useCnt;
                        --eStatus.perCnt;
                    }
                }
            }
        }),

    115031: (isTalent: boolean = false) => new StatusBuilder('风域').combatStatus().icon('buff3').useCnt(2).type(STATUS_TYPE.Usage).talent(isTalent)
        .description(`【我方执行｢切换角色｣行动时：】少花费1个元素骰。${isTalent ? '触发该效果后，使本回合中我方角色下次｢普通攻击｣少花费1个[无色元素骰]。' : ''}；[useCnt]`)
        .handle((status, _, ver) => ({
            minusDiceHero: 1,
            trigger: ['change-from'],
            exec: (_eStatus, execEvent = {}) => {
                const { switchHeroDiceCnt = 0 } = execEvent;
                if (switchHeroDiceCnt == 0) return { switchHeroDiceCnt }
                --status.useCnt;
                return {
                    switchHeroDiceCnt: switchHeroDiceCnt - 1,
                    outStatus: isCdt(status.isTalent, [newStatus(ver)(115033)]),
                }
            }
        })),

    115033: () => new StatusBuilder('协鸣之风').heroStatus().icon('buff3').roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('本回合中，我方角色下次｢普通攻击｣少花费1个[无色元素骰]。')
        .handle((status, event) => ({
            trigger: ['skilltype1'],
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => {
                if (event.isMinusDiceSkill) --status.roundCnt;
            }
        })),

    115041: () => new StatusBuilder('夜叉傩面').heroStatus().icon('ski,2').roundCnt(2).perCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色造成的[物理伤害]变为[风元素伤害]，且角色造成的[风元素伤害]+1。；【所附属角色进行[下落攻击]时：】伤害额外+2。；【所附属角色为出战角色，我方执行｢切换角色｣行动时：】少花费1个元素骰。(每回合1次)；[roundCnt]')
        .handle((status, event) => {
            const { isFallAtk = false, trigger = '' } = event;
            return {
                addDmg: 1,
                addDmgCdt: isCdt(isFallAtk, 2),
                minusDiceHero: status.perCnt,
                trigger: ['Anemo-dmg', 'change-from'],
                attachEl: ELEMENT_TYPE.Anemo,
                exec: (_, execEvent = {}) => {
                    if (trigger == 'change-from' && status.perCnt > 0) {
                        const { switchHeroDiceCnt = 0 } = execEvent;
                        if (switchHeroDiceCnt == 0) return { switchHeroDiceCnt }
                        --status.perCnt;
                        return { switchHeroDiceCnt: switchHeroDiceCnt - 1 }
                    }
                },
            }
        }),

    115042: () => new StatusBuilder('降魔·忿怒显相').heroStatus().icon('buff2').useCnt(2).type(STATUS_TYPE.Round, STATUS_TYPE.Usage)
        .description('【所附属角色使用〖ski,1〗时：】少花费1个[风元素骰]。；[useCnt]；【所附属角色不再附属〖sts115041〗时：】移除此效果。')
        .handle((status, event) => {
            const { heros = [], hidx = -1, isMinusDiceSkill = false, trigger = '' } = event;
            const hasSts115041 = getObjById(heros[hidx]?.heroStatus, 115041);
            const triggers: Trigger[] = ['skilltype2'];
            if (trigger == 'phase-end' && (hasSts115041?.roundCnt ?? 0) <= 1) triggers.push('phase-end');
            return {
                trigger: triggers,
                minusDiceSkill: { skilltype2: [1, 0, 0], elDice: ELEMENT_TYPE.Anemo },
                exec: () => {
                    if (trigger == 'phase-end') status.useCnt = 0;
                    else if (isMinusDiceSkill) --status.useCnt;
                }
            }
        }),

    115051: (swirlEl: PureElementType = ELEMENT_TYPE.Anemo) =>
        new StatusBuilder('乱岚拨止' + `${swirlEl != ELEMENT_TYPE.Anemo ? `·${ELEMENT_NAME[swirlEl][0]}` : ''}`)
            .heroStatus().icon('buff').useCnt(1).iconBg(STATUS_BG_COLOR[swirlEl])
            .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign, STATUS_TYPE.ConditionalEnchant)
            .description(`【我方下次通过｢切换角色｣行动切换到所附属角色时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。；【我方选择行动前：】如果所附属角色为｢出战角色｣，则直接使用｢普通攻击｣; 本次｢普通攻击｣造成的[物理伤害]变为[${ELEMENT_NAME[swirlEl]}伤害]，结算后移除此效果。`)
            .description(`【所附属角色进行[下落攻击]时：】造成的[物理伤害]变为[${ELEMENT_NAME[swirlEl]}伤害]，且伤害+1。；【角色使用技能后：】移除此效果。`, 'v3.8.0')
            .handle((status, event, ver) => {
                const { isFallAtk = false, trigger = '' } = event;
                if (ver < 'v4.8.0') {
                    return {
                        addDmgCdt: isCdt(isFallAtk, 1),
                        trigger: ['skill'],
                        attachEl: isCdt(isFallAtk, ELEMENT_TYPE[STATUS_BG_COLOR_KEY[status.UI.iconBg] as PureElementType]),
                        exec: () => { --status.useCnt },
                    }
                }
                return {
                    trigger: ['change-from', 'action-start'],
                    isQuickAction: true,
                    attachEl: ELEMENT_TYPE[STATUS_BG_COLOR_KEY[status.UI.iconBg] as PureElementType],
                    exec: () => {
                        if (trigger == 'action-start') {
                            --status.useCnt;
                            return { cmds: [{ cmd: 'useSkill', cnt: 0 }] }
                        }
                    },
                }
            }),

    115057: () => status11505x(ELEMENT_TYPE.Cryo),

    115058: () => status11505x(ELEMENT_TYPE.Hydro),

    115059: () => status11505x(ELEMENT_TYPE.Pyro),

    115050: () => status11505x(ELEMENT_TYPE.Electro),

    115061: () => new StatusBuilder('优风倾姿').heroStatus().icon('buff5').useCnt(2).type(STATUS_TYPE.AddDamage)
        .description('【所附属角色进行｢普通攻击｣时：】造成的伤害+2; 如果敌方存在后台角色，则此技能改为对下一个敌方后台角色造成伤害。；[useCnt]')
        .handle((status, { trigger = '' } = {}) => ({
            addDmgType1: 2,
            trigger: ['skilltype1'],
            atkOffset: isCdt(trigger == 'skilltype1', 1),
            exec: () => { --status.useCnt },
        })),

    115062: () => new StatusBuilder('倾落').heroStatus().icon('buff6').useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Usage)
        .description('下次从该角色执行｢切换角色｣行动时少花费1个元素骰，并且造成1点[风元素伤害]。；[useCnt]')
        .handle(() => ({
            trigger: ['change-from'],
            damage: 1,
            element: ELEMENT_TYPE.Anemo,
            minusDiceHero: 1,
            exec: (eStatus, execEvent = {}) => {
                const { switchHeroDiceCnt = -1 } = execEvent;
                if (switchHeroDiceCnt > -1) {
                    if (switchHeroDiceCnt == 0) return { switchHeroDiceCnt }
                    return { switchHeroDiceCnt: switchHeroDiceCnt - 1 }
                }
                if (eStatus) --eStatus.useCnt;
            }
        })),

    115071: (swirlEl: PureElementType) => readySkillStatus('风风轮', 15074).addition(swirlEl)
        .handle(status => ({
            trigger: ['change-from', 'useReadySkill'],
            skill: 15074 + (ELEMENT_CODE[status.addition[0] as ElementType] % 5),
            exec: () => { --status.useCnt },
        })),

    115081: () => new StatusBuilder('攻袭余威').heroStatus().icon('debuff').roundCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Round)
        .description('【结束阶段：】如果角色生命值至少为6，则受到2点[穿透伤害]。；[roundCnt]')
        .handle((_status, event) => {
            const { heros = [], hidx = -1 } = event;
            if (hidx == -1) return;
            return {
                trigger: isCdt(heros[hidx].hp >= 6, ['phase-end']),
                pdmg: 2,
                hidxs: [hidx],
                isSelf: true,
                exec: eStatus => {
                    if (eStatus) --eStatus.roundCnt;
                }
            }
        }),

    115083: () => new StatusBuilder('惊奇猫猫盒的嘲讽').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId(115082)
        .description('【我方出战角色受到伤害时：】抵消1点伤害。(每回合1次)'),

    115091: () => new StatusBuilder('疾风示现').heroStatus().icon('buff').useCnt(1).type(STATUS_TYPE.ConditionalEnchant)
        .description('【所附属角色进行[重击]时：】少花费1个[无色元素骰]，造成的[物理伤害]变为[风元素伤害]，并且使目标角色附属【sts115092】；[useCnt]')
        .handle((status, event, ver) => {
            const { isChargedAtk = false } = event;
            if (!isChargedAtk) return;
            return {
                trigger: ['skilltype1'],
                minusDiceSkill: { skilltype1: [0, 1, 0] },
                attachEl: ELEMENT_TYPE.Anemo,
                exec: () => {
                    --status.useCnt;
                    return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(115092)], isOppo: true }] }
                }
            }
        }),

    115092: () => new StatusBuilder('风压坍陷').heroStatus().icon('ski,1').useCnt(1).type(STATUS_TYPE.Round).iconBg(DEBUFF_BG_COLOR)
        .description('【结束阶段：】将附属角色切换为｢出战角色｣。；[useCnt]；(同一方场上最多存在一个此状态)')
        .handle((_status, event) => ({
            trigger: ['phase-end'],
            onlyOne: true,
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
                const { hidx = -1 } = event;
                return { cmds: [{ cmd: 'switch-to', hidxs: [hidx] }] }
            }
        })),

    116011: () => new StatusBuilder('璇玑屏').combatStatus().useCnt(2).type(STATUS_TYPE.Barrier, STATUS_TYPE.AddDamage)
        .description('【我方出战角色受到至少为2的伤害时：】抵消1点伤害。；[useCnt]')
        .handle((status, event) => {
            const { restDmg = 0, heros = [] } = event;
            if (restDmg > 0) {
                if (restDmg < 2) return { restDmg }
                --status.useCnt;
                return { restDmg: restDmg - 1 }
            }
            if (!getObjById(heros, getHidById(status.id))?.talentSlot) return;
            return { trigger: ['Geo-dmg'], addDmgCdt: 1 }
        }),

    116021: () => new StatusBuilder('护体岩铠').combatStatus().useCnt(2).type(STATUS_TYPE.Shield)
        .description('为我方出战角色提供2点[护盾]。此[护盾]耗尽前，我方受到的[物理伤害]减半。(向上取整)')
        .handle((_status, event) => {
            const { restDmg = 0, dmgElement } = event;
            if (restDmg < 2 || dmgElement != DAMAGE_TYPE.Physical) return { restDmg }
            return { restDmg: Math.ceil(restDmg / 2) }
        }),

    116022: () => new StatusBuilder('大扫除').heroStatus().icon('ski,2').roundCnt(2).perCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('【角色使用｢普通攻击｣时：】少花费1个[岩元素骰]。(每回合1次)；角色｢普通攻击｣造成的伤害+2，造成的[物理伤害]变为[岩元素伤害]。；[roundCnt]')
        .handle((status, event) => ({
            addDmgType1: 2,
            minusDiceSkill: isCdt(status.perCnt > 0, { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Geo }),
            trigger: ['skilltype1'],
            attachEl: ELEMENT_TYPE.Geo,
            exec: () => {
                if (status.perCnt > 0 && event.isMinusDiceSkill) --status.perCnt;
            },
        })),

    116032: () => shieldStatus('玉璋护盾'),

    116033: () => new StatusBuilder('石化').heroStatus().icon('ski,3').roundCnt(1).iconBg(DEBUFF_BG_COLOR)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign, STATUS_TYPE.NonAction)
        .description('【角色无法使用技能。】(持续到回合结束)'),

    116051: () => new StatusBuilder('阿丑').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    116053: () => new StatusBuilder('怒目鬼王').heroStatus().icon('ski,2').roundCnt(2).perCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色｢普通攻击｣造成的伤害+1，造成的[物理伤害]变为[岩元素伤害]。；[roundCnt]；【所附属角色｢普通攻击｣后：】为其附属【sts116054】。(每回合1次)')
        .description('所附属角色｢普通攻击｣造成的伤害+2，造成的[物理伤害]变为[岩元素伤害]。；[roundCnt]；【所附属角色｢普通攻击｣后：】为其附属【sts116054】。(每回合1次)', 'v4.2.0')
        .handle((status, _, ver) => ({
            addDmgType1: ver < 'v4.2.0' ? 2 : 1,
            attachEl: ELEMENT_TYPE.Geo,
            trigger: ['skilltype1'],
            exec: () => {
                if (status.perCnt <= 0) return;
                --status.perCnt;
                return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(116054)] }] }
            }
        })),

    116054: () => new StatusBuilder('乱神之怪力').heroStatus().icon('buff4').useCnt(1).maxCnt(3).type(STATUS_TYPE.AddDamage)
        .description('【所附属角色进行[重击]时：】造成的伤害+1。如果[可用次数]至少为2，则还会使本技能少花费1个[无色元素骰]。；[useCnt]')
        .handle((status, event) => {
            if (!event.isChargedAtk) return;
            return {
                addDmgCdt: 1,
                minusDiceSkill: isCdt(status.useCnt >= 2, { skilltype1: [0, 1, 0] }),
                trigger: ['skilltype1'],
                exec: () => { --status.useCnt },
            }
        }),

    116061: () => new StatusBuilder('大将旗指物').heroStatus().icon('ski,1').roundCnt(2).maxCnt(3)
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage)
        .description('我方角色造成的[岩元素伤害]+1。；[roundCnt]')
        .handle((_status, event) => {
            const { skilltype = -1 } = event;
            return {
                trigger: isCdt(skilltype != -1, ['Geo-dmg']),
                addDmgCdt: 1,
            }
        }),

    116071: () => readySkillShieldStatus('旋云护盾'),

    116072: () => readySkillStatus('长枪开相', 16074, 116071),

    116073: (useCnt: number = 1) => new StatusBuilder('飞云旗阵').combatStatus().icon('ski,1').useCnt(useCnt).maxCnt(4)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('我方角色进行｢普通攻击｣时：如果我方手牌数量不多于1，则此技能少花费1个元素骰。；[useCnt]')
        .description('我方角色进行｢普通攻击｣时：造成的伤害+1。；如果我方手牌数量不多于1，则此技能少花费1个元素骰。；[useCnt]】', 'v4.8.0')
        .handle((status, event, ver) => {
            const { hcardsCnt = 10, heros = [] } = event;
            return {
                trigger: ['skilltype1'],
                minusDiceSkill: isCdt(hcardsCnt <= 1, { skilltype1: [0, 0, 1] }),
                addDmgType1: isCdt(ver < 'v4.8.0', 1),
                addDmgCdt: isCdt(hcardsCnt == 0 && !!getObjById(heros, getHidById(status.id))?.talentSlot, 2),
                exec: () => { --status.useCnt }
            }
        }),

    116084: () => enchantStatus(ELEMENT_TYPE.Geo).roundCnt(2),

    117012: () => new StatusBuilder('新叶').combatStatus().icon('buff6').roundCnt(1).type(STATUS_TYPE.Attack)
        .description('【我方角色的技能引发[草元素相关反应]后：】造成1点[草元素伤害]。(每回合1次)；[roundCnt]')
        .handle(() => ({
            damage: 1,
            element: ELEMENT_TYPE.Dendro,
            trigger: ['elReaction-Dendro'],
            exec: eStatus => {
                if (eStatus) --eStatus.roundCnt;
            },
        })),

    117021: () => new StatusBuilder('通塞识').heroStatus().icon('buff').useCnt(3).type(STATUS_TYPE.ConditionalEnchant)
        .description('【所附属角色进行[重击]时：】造成的[物理伤害]变为[草元素伤害]，并且会在技能结算后召唤【smn117022】。；[useCnt]')
        .handle((status, event, ver) => {
            if (!event.isChargedAtk) return;
            return {
                summon: [newSummon(ver)(117022)],
                trigger: ['skilltype1'],
                attachEl: ELEMENT_TYPE.Dendro,
                exec: () => { --status.useCnt },
            }
        }),

    117031: () => new StatusBuilder('蕴种印').heroStatus().useCnt(2).type(STATUS_TYPE.Attack)
        .description('【任意具有蕴种印的所在阵营角色受到元素反应伤害后：】对所有附属角色1点[穿透伤害]。；[useCnt]')
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Nahida_S.webp')
        .handle((_status, event) => {
            const { heros = [], eheros = [], hidx = -1, combatStatus = [] } = event;
            const hidxs: number[] = [];
            heros.forEach((h, hi) => {
                if (hasObjById(h.heroStatus, 117031) && hi != hidx) {
                    hidxs.push(hi);
                }
            });
            const hasPyro = eheros.map(h => h.talentSlot).some(slot => slot?.id == 217031) &&
                hasObjById(combatStatus, 117032) &&
                eheros.filter(h => h.hp > 0).some(h => h.element == ELEMENT_TYPE.Pyro);
            if (!hasPyro && hidx > -1) hidxs.push(hidx);
            return {
                damage: isCdt(hasPyro, 1),
                element: ELEMENT_TYPE.Dendro,
                pdmg: 1,
                isSelf: true,
                hidxs,
                trigger: ['get-elReaction'],
                exec: (eStatus, execEvent = {}) => {
                    const { heros = [] } = execEvent;
                    heros.forEach((h, hi) => {
                        if (hidxs.includes(hi)) {
                            const ist117031Idx = getObjIdxById(h.heroStatus, 117031);
                            if (ist117031Idx > -1) {
                                const ist117031 = h.heroStatus[ist117031Idx];
                                --ist117031.useCnt;
                                if (ist117031.useCnt == 0 && hi != hidx) {
                                    h.heroStatus.splice(ist117031Idx, 1);
                                }
                            }
                        }
                    });
                    if (hasPyro && eStatus) --eStatus.useCnt;
                }
            }
        }),

    117032: (isTalent: boolean = false) => new StatusBuilder('摩耶之殿').combatStatus()
        .icon('ski,3').roundCnt(2).roundCnt(3, isTalent).talent(isTalent)
        .description('【我方引发元素反应时：】伤害额外+1。；[roundCnt]')
        .handle(() => ({ addDmgCdt: 1, trigger: ['elReaction'] })),

    117043: () => new StatusBuilder('桂子仙机').combatStatus().icon('ski,2').useCnt(3).type(STATUS_TYPE.Attack)
        .description('【我方切换角色后：】造成1点[草元素伤害]，治疗我方出战角色1点。；[useCnt]')
        .handle(() => ({
            damage: 1,
            element: ELEMENT_TYPE.Dendro,
            heal: 1,
            trigger: ['change-from'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        })),

    117052: () => new StatusBuilder('脉摄宣明').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Usage)
        .description('【行动阶段开始时：】生成【sts117053】。；[useCnt]')
        .handle((_s, _e, ver) => ({
            trigger: ['phase-start'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
                return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(117053)] }] }
            },
        })),

    117053: () => new StatusBuilder('无欲气护盾').combatStatus().useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Shield)
        .description('提供1点[护盾]，保护我方出战角色。；【此效果被移除，或被重复生成时：】造成1点[草元素伤害]，治疗我方出战角色1点。')
        .handle((status, event) => {
            const { heros = [], hidx = -1, combatStatus = [] } = event;
            const fhero = heros[hidx];
            if (!fhero) return;
            const triggers: Trigger[] = [];
            if (status.useCnt == 0) triggers.push('status-destroy');
            const hid = getHidById(status.id)
            if (fhero.id == hid) triggers.push('skilltype3');
            if (hasObjById(combatStatus, 117052)) triggers.push('phase-start');
            const isTalent = !!getObjById(heros, hid)?.talentSlot;
            return {
                damage: 1,
                element: ELEMENT_TYPE.Dendro,
                heal: 1,
                trigger: triggers,
                cmds: isCdt(fhero.hp < fhero.maxHp && isTalent, [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero }]),
            }
        }),

    117061: (rcnt: number = 2) => new StatusBuilder('琢光镜').heroStatus().icon('ski,2').roundCnt(rcnt).maxCnt(3)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Enchant)
        .description('角色造成的[物理伤害]变为[草元素伤害]。；【角色｢普通攻击｣后：】造成1点[草元素伤害]。如果此技能为[重击]，则使此状态的[持续回合]+1。；[roundCnt]')
        .handle((status, event) => {
            const { isChargedAtk = false, trigger = '' } = event;
            return {
                attachEl: ELEMENT_TYPE.Dendro,
                trigger: ['skilltype1', 'after-skilltype1'],
                damage: isCdt(trigger == 'after-skilltype1', 1),
                element: ELEMENT_TYPE.Dendro,
                exec: () => {
                    if (isChargedAtk) {
                        status.roundCnt = Math.min(status.maxCnt, status.roundCnt + 1);
                    }
                }
            }
        }),

    117071: () => new StatusBuilder('猫箱急件').combatStatus().icon('ski,1').useCnt(1).maxCnt(2).type(STATUS_TYPE.Attack)
        .description('【〖hro〗为出战角色时，我方切换角色后：】造成1点[草元素伤害]，抓1张牌。；[useCnt]')
        .handle((status, event) => {
            const { heros = [], force = false } = event;
            if (!getObjById(heros, getHidById(status.id))?.isFront && !force) return;
            return {
                damage: 1,
                element: ELEMENT_TYPE.Dendro,
                trigger: ['change-from'],
                cmds: [{ cmd: 'getCard', cnt: 1 }],
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                },
            }
        }),

    117072: () => shieldStatus('安全运输护盾'),

    117073: () => new StatusBuilder('猫草豆蔻').combatStatus().icon('ski,2').useCnt(2)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营打出2张行动牌后：】对所在阵营的出战角色造成1点[草元素伤害]。；[useCnt]')
        .handle(status => ({
            damage: isCdt(status.perCnt <= -1, 1),
            element: ELEMENT_TYPE.Dendro,
            isSelf: true,
            trigger: ['card'],
            exec: eStatus => {
                --status.perCnt;
                if (eStatus) {
                    --eStatus.useCnt;
                    eStatus.perCnt = 0;
                }
            },
        })),

    117081: () => new StatusBuilder('梅赫拉克的助力').heroStatus().icon('ski,2').roundCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('角色｢普通攻击｣造成的伤害+1，且造成的[物理伤害]变为[草元素伤害]。；【角色｢普通攻击｣后：】生成【sts117082】。；【[持续回合]:{roundCnt}】')
        .handle((_s, _e, ver) => ({
            trigger: ['skilltype1'],
            attachEl: ELEMENT_TYPE.Dendro,
            addDmgType1: 1,
            exec: () => ({ cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(117082)] }] })
        })),

    117082: (useCnt: number = 1) => new StatusBuilder('迸发扫描').combatStatus().icon('ski,1').useCnt(useCnt).maxCnt(3).type(STATUS_TYPE.Attack)
        .description('【双方选择行动前：】如果我方场上存在【sts116】或【smn112082】，则使其[可用次数]-1，并[舍弃]我方牌库顶的1张卡牌。然后，造成所[舍弃]卡牌的元素骰费用的[草元素伤害]。；[useCnt]')
        .description('【双方选择行动前：】如果我方场上存在【sts116】或【smn112082】，则使其[可用次数]-1，并[舍弃]我方牌库顶的1张卡牌。然后，造成所[舍弃]卡牌的元素骰费用+1的[草元素伤害]。；[useCnt]', 'v4.8.0')
        .handle((status, event, ver) => {
            const { heros = [], summons = [], pile = [], card, combatStatus = [] } = event;
            if (pile.length == 0 || !hasObjById(combatStatus, 116) && !hasObjById(summons, 112082)) return;
            const cmds: Cmds[] = [{ cmd: 'discard', mode: CMD_MODE.TopPileCard }];
            const thero = getObjById(heros, getHidById(status.id))!;
            const talent = thero.talentSlot ?? card;
            if (talent && talent.id == 217081) {
                if (talent.perCnt > 0) {
                    cmds.push({ cmd: 'getCard', cnt: 1, card: pile[0].id });
                    if (pile[0].hasSubtype(CARD_SUBTYPE.Place)) cmds.push({ cmd: 'getStatus', status: [newStatus(ver)(117083)] });
                }
            }
            return {
                trigger: ['action-start', 'action-start-oppo'],
                damage: pile[0].cost + pile[0].anydice + (ver < 'v4.8.0' ? 1 : 0),
                element: ELEMENT_TYPE.Dendro,
                cmds,
                exec: (eStatus, execEvent = {}) => {
                    if (eStatus) {
                        --eStatus.useCnt;
                        const { heros: hs = [], summons: smns = [], combatStatus: ost = [] } = execEvent;
                        const sts116 = getObjById(ost, 116);
                        if (sts116) --sts116.useCnt;
                        else --getObjById(smns, 112082)!.useCnt;
                        const thero = getObjById(hs, getHidById(status.id))!;
                        const talent = thero.talentSlot ?? card;
                        if (talent && talent.id == 217081) {
                            if (talent.perCnt > 0) --talent.perCnt;
                        }
                    }
                }
            }
        }),

    117083: () => new StatusBuilder('预算师的技艺(生效中)').combatStatus().icon('buff3').useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('我方下次【打出｢场地｣支援牌时：】少花费2个元素骰。')
        .handle((status, event) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            if (card && card.hasSubtype(CARD_SUBTYPE.Place) && card.cost > mdc) {
                return {
                    minusDiceCard: 2,
                    trigger: ['card'],
                    exec: () => { --status.useCnt },
                }
            }
        }),

    121012: (useCnt: number = 0) => new StatusBuilder('流萤护罩').combatStatus().useCnt(1 + Math.min(3, useCnt)).type(STATUS_TYPE.Shield)
        .description('为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【smn121011】，则额外提供其[可用次数]的[护盾]。(最多额外提供3点[护盾])'),

    121013: () => shieldStatus('叛逆的守护', 1, 2),

    121021: () => new StatusBuilder('冰封的炽炎魔女').heroStatus().icon('ski,3').useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【行动阶段开始时：】如果所附属角色生命值不多于4，则移除此效果。；【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。【此效果被移除时：】所附属角色转换为[｢焚尽的炽炎魔女｣]形态。')
        .handle((_, event) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const triggers: Trigger[] = ['will-killed', 'skilltype3'];
            if ((heros[hidx]?.hp ?? 10) <= 4) triggers.push('phase-start');
            return {
                trigger: triggers,
                cmds: isCdt(trigger == 'will-killed', [{ cmd: 'revive', cnt: 1 }]),
                exec: eStatus => {
                    if (eStatus) {
                        --eStatus.useCnt;
                        return;
                    }
                    return { cmds: [{ cmd: 'changePattern', cnt: 6301, hidxs: [hidx] }] }
                }
            }
        }),

    121022: (type: number = 0) => new StatusBuilder(['严寒', '炽热'][type]).heroStatus().useCnt(1).type(STATUS_TYPE.Attack)
        .icon(ELEMENT_ICON[ELEMENT_CODE_KEY[[1, 3][type] as ElementCode]] + '-dice').iconBg(DEBUFF_BG_COLOR).perCnt(-type)
        .description(`【结束阶段：】对所附属角色造成1点[${['冰', '火'][type]}元素伤害]。；[useCnt]；所附属角色被附属【sts121022${[',1', ''][type]}】时，移除此效果。`)
        .handle(status => ({
            damage: 1,
            element: status.perCnt == 0 ? ELEMENT_TYPE.Cryo : ELEMENT_TYPE.Pyro,
            isSelf: true,
            trigger: ['phase-end'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    121031: () => new StatusBuilder('四迸冰锥').heroStatus().icon('buff6').useCnt(1)
        .description('【我方角色｢普通攻击｣时：】对所有敌方后台角色造成1点[穿透伤害]。；[useCnt]')
        .handle(status => ({
            pdmg: 1,
            trigger: ['skilltype1'],
            exec: () => { --status.useCnt },
        })),

    121034: () => new StatusBuilder('冰晶核心').heroStatus().icon('heal2').useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。')
        .handle((_, event, ver) => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: 1 }],
            exec: eStatus => {
                const { heros = [], hidx = -1 } = event;
                if (eStatus) {
                    --eStatus.useCnt;
                    return;
                }
                if (!heros[hidx].talentSlot) return;
                return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(121022)], isOppo: true }] }
            }
        })),

    121042: () => new StatusBuilder('掠袭锐势').heroStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack)
        .description('【结束阶段：】对所有附属有【sts122】的敌方角色造成1点[穿透伤害]。；[useCnt]')
        .handle((status, { heros = [] } = {}) => ({
            trigger: ['phase-end'],
            pdmg: 1,
            hidxs: heros.filter(h => hasObjById(h.heroStatus, 122)).map(h => h.hidx),
            exec: () => { --status.useCnt },
        })),

    122013: () => new StatusBuilder('纯水幻形·蛙').combatStatus().useCnt(1).useCnt(2, 'v4.3.0')
        .type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    122021: (isTalent: boolean = false) => new StatusBuilder('水光破镜').heroStatus().icon('debuff').roundCnt(2).roundCnt(3, isTalent)
        .type(STATUS_TYPE.AddDamage).type(isTalent, STATUS_TYPE.Usage).talent(isTalent)
        .description('所附属角色切换到其他角色时元素骰费用+1。；[roundCnt]；(同一方场上最多存在一个此状态)')
        .description('所附属角色受到的[水元素伤害]+1。；[roundCnt]；(同一方场上最多存在一个此状态)', 'v4.8.0')
        .handle(status => {
            const trigger: Trigger[] = ['Hydro-getdmg'];
            if (status.isTalent) trigger.push('change-from');
            return {
                addDiceHero: 1,
                getDmg: isCdt(status.isTalent, 1),
                trigger,
                onlyOne: true,
            }
        }),

    122031: () => new StatusBuilder('水之新生').heroStatus().icon('heal2').useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。触发此效果后，角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。')
        .handle((_s, _e, ver) => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: 4 }],
            exec: eStatus => {
                if (eStatus) {
                    --eStatus.useCnt;
                    return;
                }
                return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(122037)] }] }
            }
        })),

    122032: () => readySkillStatus('涟锋旋刃', 22035),

    122033: () => new StatusBuilder('暗流的诅咒').combatStatus().useCnt(2).type(STATUS_TYPE.Usage)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Debuff_Common_CostSkill.webp')
        .description('【所在阵营的角色使用｢元素战技｣或｢元素爆发｣时：】需要多花费1个元素骰。；[useCnt]')
        .handle(status => ({
            trigger: ['skilltype2', 'skilltype3'],
            addDiceSkill: {
                skilltype2: [0, 0, 1],
                skilltype3: [0, 0, 1],
            },
            exec: () => { --status.useCnt },
        })),

    122037: () => new StatusBuilder('水之新生·锐势').heroStatus().icon('buff4')
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant, STATUS_TYPE.Sign)
        .description('角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。')
        .handle(() => ({ attachEl: ELEMENT_TYPE.Hydro, addDmg: 1 })),

    122041: () => new StatusBuilder('深噬之域').combatStatus().icon('ski,3').useCnt(0).maxCnt(3).type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('我方[舍弃]或[调和]的卡牌，会被吞噬。；【每吞噬3张牌：】【hro】获得1点额外最大生命; 如果其中存在原本元素骰费用值相同的牌，则额外获得1点; 如果3张均相同，再额外获得1点。')
        .addition(-1, -1, 0, 0).handle((status, event, ver) => {
            const { discards = [], card, heros = [] } = event;
            return {
                trigger: ['discard', 'reconcile'],
                isAddTask: true,
                exec: (eStatus, execEvent = {}) => {
                    eStatus ??= clone(status);
                    const { heros: hs = heros } = execEvent;
                    const hidx = hs.findIndex(h => h.id == 1724);
                    if (hidx == -1) return;
                    const [cost1, cost2, maxDice] = eStatus.addition as number[];
                    if (card && card.id > 0) discards.splice(0, 10, card);
                    let cnt = 0;
                    discards.forEach(c => {
                        const cost = c.cost + c.anydice;
                        if (cost > maxDice) {
                            eStatus.addition[2] = cost;
                            eStatus.addition[3] = 1;
                        } else if (cost == maxDice) {
                            ++eStatus.addition[3];
                        }
                        if (eStatus.useCnt < 2) {
                            eStatus.addition[eStatus.useCnt] = cost;
                            ++eStatus.useCnt;
                        } else {
                            cnt += 1 + +(cost1 == cost) + +(cost2 == cost);
                            eStatus.useCnt = 0;
                            heros[hidx].maxHp += cnt;
                        }
                    });
                    if (cnt > 0) {
                        const healcmds = Array.from<Cmds[], Cmds>({ length: cnt }, (_, i) => ({ cmd: 'heal', cnt: 1, hidxs: [hidx], mode: i }));
                        return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(122042, cnt)], hidxs: [hidx] }, ...healcmds], }
                    }
                }
            }
        }),

    122042: (cnt: number = 1) => new StatusBuilder('奇异之躯').heroStatus().icon('ski,3')
        .type(STATUS_TYPE.Accumulate).useCnt(cnt).maxCnt(MAX_USE_COUNT)
        .description('每层为【hro】提供1点额外最大生命。'),

    122043: (useCnt: number = 1) => new StatusBuilder('黑色幻影').combatStatus().useCnt(useCnt).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害，然后[可用次数]-2。；[useCnt]').barrierUsage(2),

    123011: (isTalent: boolean = false) => new StatusBuilder('潜行').heroStatus().useCnt(2).useCnt(3, isTalent)
        .type(STATUS_TYPE.Barrier, STATUS_TYPE.AddDamage).type(isTalent, STATUS_TYPE.Enchant).talent(isTalent)
        .description('所附属角色受到的伤害-1，造成的伤害+1。；[useCnt]')
        .handle((status, event) => {
            const { restDmg = 0 } = event;
            if (restDmg > 0) --status.useCnt;
            return {
                addDmg: 1,
                restDmg: Math.max(0, restDmg - 1),
                trigger: ['skill'],
                attachEl: isCdt(status.isTalent, ELEMENT_TYPE.Pyro),
                exec: () => { --status.useCnt },
            }
        }),

    123022: () => new StatusBuilder('火之新生').heroStatus().icon('heal2').useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.ReadySkill)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。此效果触发后，此角色造成的[火元素伤害]+1。')
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到3点生命值。', 'v4.6.0')
        .handle((_status, event, ver) => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: ver < 'v4.6.0' ? 3 : 4 }],
            exec: eStatus => {
                if (eStatus) {
                    --eStatus.useCnt;
                    return;
                }
                const { heros = [], hidx = -1 } = event;
                const inStatus: Status[] = ver < 'v4.6.0' ? [newStatus(ver)(123026)] : [];
                if (heros[hidx]?.talentSlot) {
                    heros[hidx].talentSlot = null;
                    inStatus.push(newStatus(ver)(123024))
                }
                return { cmds: [{ cmd: 'getStatus', status: inStatus }] }
            }
        })),

    123024: () => new StatusBuilder('渊火加护').heroStatus().useCnt(2)
        .type(STATUS_TYPE.Shield).type(ver => ver >= 'v4.6.0', STATUS_TYPE.Attack)
        .description('为所附属角色提供2点[护盾]。此[护盾]耗尽后：对所有敌方角色造成1点[穿透伤害]。')
        .description('为所附属角色提供2点[护盾]。', 'v4.6.0')
        .handle((status, event, ver) => {
            if (status.useCnt > 0 || ver < 'v4.6.0') return;
            const { eheros = [] } = event;
            return {
                trigger: ['status-destroy'],
                pdmg: 1,
                hidxs: allHidxs(eheros),
            }
        }),

    123026: () => new StatusBuilder('火之新生·锐势').heroStatus().icon('buff4')
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('角色造成的[火元素伤害]+1。')
        .handle(() => ({ addDmg: 1 })),

    123033: (useCnt: number = 1) => new StatusBuilder('炎之魔蝎·守势').heroStatus()
        .useCnt(useCnt).type(STATUS_TYPE.Barrier)
        .description('【附属角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    123041: (useCnt: number = 1) => new StatusBuilder('重甲蟹壳').heroStatus().useCnt(useCnt).maxCnt(MAX_USE_COUNT)
        .description('每层提供1点[护盾]，保护所附属角色。').type(STATUS_TYPE.Shield),

    123043: () => readySkillStatus('积蓄烈威', 23046),

    124011: () => readySkillStatus('猜拳三连击·剪刀', 24015),

    124012: () => readySkillStatus('猜拳三连击·布', 24016),

    124014: () => new StatusBuilder('雷晶核心').heroStatus().icon('heal2').useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。')
        .handle(() => ({
            trigger: ['will-killed'],
            cmds: [{ cmd: 'revive', cnt: 1 }],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        })),

    124021: () => new StatusBuilder('雷霆探针').combatStatus().icon('ski,3')
        .type(STATUS_TYPE.Sign).iconBg(DEBUFF_BG_COLOR).perCnt(1)
        .description('【所在阵营角色使用技能后：】对所在阵营出战角色附属【sts124022】。(每回合1次)')
        .handle((status, _, ver) => ({
            trigger: ['skill'],
            exec: () => {
                if (status.perCnt <= 0) return;
                --status.perCnt;
                return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(124022)] }] }
            }
        })),

    124022: () => new StatusBuilder('雷鸣探知').heroStatus().icon('debuff').useCnt(1).perCnt(1, 'v4.4.0')
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).notReset()
        .description('【所附属角色受到〖hro〗及其召唤物造成的伤害时：】移除此状态，使此伤害+1。；(同一方场上最多存在一个此状态。【hro】的部分技能，会以所附属角色为目标。)')
        .description('【此状态存在期间，可以触发1次：】所附属角色受到〖hro〗及其召唤物造成的伤害+1。；(同一方场上最多存在一个此状态。【hro】的部分技能，会以所附属角色为目标。)', 'v4.4.0')
        .handle((status, event, ver) => {
            const { dmgSource = 0, eheros = [] } = event;
            const hid = getHidById(status.id);
            const getDmg = +(dmgSource == hid || dmgSource == 124023);
            const talent = getObjById(eheros, hid)?.talentSlot;
            const isTalent = talent && talent.useCnt > 0;
            return {
                trigger: ['getdmg'],
                getDmg,
                onlyOne: true,
                cmds: isCdt(isTalent, [{ cmd: 'getCard', cnt: 1, isOppo: true }]),
                exec: () => {
                    if (getDmg > 0) {
                        if (ver < 'v4.4.0') --status.perCnt;
                        else --status.useCnt;
                    }
                    if (isTalent) --talent.useCnt;
                }
            }
        }),

    124032: (isTalent: boolean = false, useCnt: number = 2, addCnt?: number) => new StatusBuilder('原海明珠').heroStatus()
        .type(STATUS_TYPE.Barrier, STATUS_TYPE.Usage).talent(isTalent).useCnt(useCnt).addCnt(addCnt).perCnt(1).perCnt(2, isTalent)
        .description(`【所附属角色受到伤害时：】抵消1点伤害。；【每回合${isTalent ? 2 : 1}次：】抵消来自召唤物的伤害时不消耗[可用次数]。；[useCnt]；【我方宣布结束时：】如果所附属角色为｢出战角色｣，则抓1张牌。`)
        .handle((status, event) => {
            const { restDmg = 0, heros = [], hidx = -1, isSummon: [smnId] = [-1] } = event;
            if (restDmg > 0) {
                if (smnId > -1 && status.perCnt > 0) --status.perCnt;
                else --status.useCnt;
                return { restDmg: restDmg - 1 }
            }
            const { isFront } = heros[hidx];
            return {
                restDmg,
                trigger: isCdt(isFront, ['end-phase']),
                cmds: isCdt(isFront, [{ cmd: 'getCard', cnt: 1 }]),
            }
        }),

    124042: (useCnt: number = 0) => new StatusBuilder('雷萤护罩').combatStatus().useCnt(1 + Math.min(3, useCnt)).type(STATUS_TYPE.Shield)
        .description('为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【smn124041】，则额外提供其[可用次数]的[护盾]。(最多额外提供3点[护盾])'),

    124043: () => readySkillStatus('霆电迸发', 24044),

    124044: () => new StatusBuilder('雷压').combatStatus().icon('debuff').useCnt(0).maxCnt(3)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('每当我方累积打出3张行动牌，就会触发敌方场上【smn12401】的效果。(使【smn124041】的[可用次数]+1)')
        .handle((status, event) => ({
            trigger: ['card'],
            exec: () => {
                const { esummons = [] } = event;
                status.useCnt = Math.min(status.maxCnt, status.useCnt + 1);
                const summon = getObjById(esummons, 124041);
                if (summon && summon.useCnt < 3) {
                    ++summon.useCnt;
                    status.useCnt = 0;
                }
            },
        })),

    124052: (useCnt: number = -1) => new StatusBuilder('雷锥陷阱').combatStatus().icon('ski,2').useCnt(useCnt).maxCnt(3)
        .type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营的角色使用技能后：】对所在阵营的出战角色造成2点[雷元素伤害]。；【[可用次数]：初始为创建时所弃置的〖crd124051〗张数。(最多叠加到3)】')
        .handle(() => ({
            damage: 2,
            element: ELEMENT_TYPE.Electro,
            isSelf: true,
            trigger: ['after-skill'],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            }
        })),

    124053: () => coolDownStatus('噬骸能量块'),

    125021: () => new StatusBuilder('坍毁').heroStatus().icon('debuff').useCnt(1).type(STATUS_TYPE.AddDamage)
        .description('所附属角色受到的[物理伤害]或[风元素伤害]+2。；[useCnt]')
        .handle((status, event, ver) => {
            const { heros = [], hidx = -1, eheros = [] } = event;
            return {
                trigger: ['Physical-getdmg', 'Anemo-getdmg'],
                getDmg: 2,
                exec: () => {
                    --status.useCnt;
                    const talent = getObjById(eheros, getHidById(status.id))?.talentSlot;
                    if (status.useCnt == 0 && talent && talent.useCnt > 0) {
                        --talent.useCnt;
                        const all = allHidxs(heros);
                        const hidxs = [all[(all.indexOf(hidx) + 1) % all.length]];
                        return { cmds: [{ cmd: 'getStatus', status: [newStatus(ver)(125021)], hidxs }] }
                    }
                }
            }
        }),

    125022: () => readySkillStatus('风龙吐息', 25025).typeOverride(STATUS_TYPE.ReadySkill),

    125023: () => readySkillStatus('风龙吐息', 25026).typeOverride(STATUS_TYPE.ReadySkill),

    125032: () => new StatusBuilder('亡风啸卷(生效中)').combatStatus().icon('buff3').roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【本回合中我方下次切换角色后】：生成1个出战角色类型的元素骰。')
        .handle(() => ({
            trigger: ['change-from'],
            isAddTask: true,
            exec: eStatus => {
                if (eStatus) --eStatus.roundCnt;
                return { cmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero }] }
            }
        })),

    126011: () => new StatusBuilder('岩盔').heroStatus().useCnt(3).type(STATUS_TYPE.Barrier)
        .description('【所附属角色受到伤害时：】抵消1点伤害。；抵消[岩元素伤害]时，需额外消耗1次[可用次数]。；[useCnt]')
        .handle((status, event) => {
            const { restDmg = 0, dmgElement, heros = [], hidx = -1 } = event;
            if (restDmg <= 0) return { restDmg }
            --status.useCnt;
            if (status.useCnt > 0 && dmgElement == DAMAGE_TYPE.Geo) --status.useCnt;
            if (status.useCnt == 0) {
                const sts126012 = getObjById(heros[hidx].heroStatus, 126012);
                if (sts126012) sts126012.useCnt = 0;
            }
            return { restDmg: restDmg - 1 }
        }),

    126012: () => new StatusBuilder('坚岩之力').heroStatus().icon('buff4').perCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant, STATUS_TYPE.Sign)
        .description('角色造成的[物理伤害]变为[岩元素伤害]。；【每回合1次：】角色造成的伤害+1。；【角色所附属的〖sts126011〗被移除后：】也移除此状态。')
        .handle(status => ({
            addDmg: status.perCnt,
            trigger: ['skill'],
            attachEl: ELEMENT_TYPE.Geo,
            exec: () => {
                if (status.perCnt > 0) --status.perCnt;
            },
        })),

    126021: () => new StatusBuilder('磐岩百相·元素汲取').heroStatus().icon('buff2').useCnt(0).maxCnt(4)
        .type(STATUS_TYPE.Accumulate, STATUS_TYPE.NonDestroy)
        .description('角色可以汲取‹1冰›/‹2水›/‹3火›/‹4雷›元素的力量，然后根据所汲取的元素类型，获得技能‹1【rsk66013】›/‹2【rsk66023】›/‹3【rsk66033】›/‹4【rsk66043】›。(角色同时只能汲取一种元素，此状态会记录角色已汲取过的元素类型数量)；【角色汲取了一种和当前不同的元素后：】生成1个所汲取元素类型的元素骰。')
        .handle((status, event) => ({
            trigger: ['elReaction-Geo'],
            exec: () => {
                const { heros = [], hidx = -1, trigger = '' } = event;
                const hero = heros[hidx];
                const curEl = hero.UI.srcs.indexOf(hero.UI.src);
                const drawEl = trigger.startsWith('elReaction-Geo') ? ELEMENT_CODE[trigger.slice(trigger.indexOf(':') + 1) as ElementType] : 0;
                if (drawEl == 0 || drawEl == curEl) return;
                const isDrawed = status.perCnt != 0;
                hero.UI.src = hero.UI.srcs[drawEl];
                let els = -status.perCnt;
                if ((els >> drawEl - 1 & 1) == 0) {
                    els |= 1 << drawEl - 1;
                    ++status.useCnt;
                    status.perCnt = -els;
                }
                const cmds: Cmds[] = [
                    { cmd: 'getDice', cnt: 1, element: ELEMENT_CODE_KEY[drawEl] },
                    { cmd: 'getSkill', hidxs: [hidx], cnt: 66003 + drawEl * 10, mode: 2 }
                ];
                if (isDrawed) cmds.splice(1, 0, { cmd: 'loseSkill', hidxs: [hidx], mode: 2 });
                return { cmds }
            }
        })),

    126022: () => new StatusBuilder('磐岩百相·元素凝晶').heroStatus().icon('ski,1').useCnt(1).type(STATUS_TYPE.Sign)
        .explains('rsk66013', 'rsk66023', 'rsk66033', 'rsk66043')
        .description('【角色受到‹1冰›/‹2水›/‹3火›/‹4雷›元素伤害后：】如果角色当前未汲取该元素的力量，则移除此状态，然后角色[汲取对应元素的力量]。')
        .handle((status, event) => {
            const { heros = [], hidx = -1, trigger = '' } = event;
            const triggers: Trigger[] = ['Cryo-getdmg', 'Hydro-getdmg', 'Pyro-getdmg', 'Electro-getdmg'];
            if (hidx == -1 || !triggers.includes(trigger)) return;
            const hero = heros[hidx];
            const curEl = hero.UI.srcs.indexOf(hero.UI.src) || ELEMENT_CODE[ELEMENT_TYPE.Geo];
            const drawEl = ELEMENT_CODE[trigger.split('-')[0] as ElementType];
            return {
                trigger: triggers,
                exec: () => {
                    if (curEl != drawEl) {
                        --status.useCnt;
                        const sts126021 = getObjById(hero.heroStatus, 126021)!;
                        return { ...sts126021.handle(sts126021, { ...event, trigger: `elReaction-Geo:${ELEMENT_CODE_KEY[drawEl]}` as Trigger })?.exec?.() }
                    }
                }
            }
        }),

    127011: () => new StatusBuilder('活化激能').heroStatus().useCnt(0).maxCnt(3).type(STATUS_TYPE.Accumulate)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_FungusRaptor_S.webp')
        .description('【本角色造成或受到元素伤害后：】累积1层｢活化激能｣。(最多累积3层)；【结束阶段：】如果｢活化激能｣层数已达到上限，就将其清空。同时，角色失去所有[充能]。')
        .handle((status, event) => {
            const { trigger = '', heros = [], hidx = -1 } = event;
            return {
                trigger: ['el-dmg', 'el-getdmg', 'phase-end'],
                exec: () => {
                    if (hidx == -1) return;
                    const hero = heros[hidx];
                    const maxCnt = status.maxCnt + +!!hero.talentSlot;
                    if (trigger == 'phase-end') {
                        if (status.useCnt == maxCnt) {
                            status.useCnt = 0;
                            return { cmds: [{ cmd: 'getEnergy', cnt: -hero.energy, hidxs: [hidx] }] }
                        }
                    } else if (status.useCnt < maxCnt) {
                        ++status.useCnt;
                    }
                },
            }
        }),

    127026: (useCnt: number = 1) => new StatusBuilder('绿洲之滋养').combatStatus().icon('ski,1')
        .type(STATUS_TYPE.Usage).useCnt(useCnt).maxCnt(3)
        .description('【我方打出〖crd127021〗时：】少花费1个元素骰。；[useCnt]')
        .handle((status, event) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            if (card && card.id == 127021 && card.cost > mdc) {
                return {
                    trigger: ['card'],
                    minusDiceCard: 1,
                    exec: () => { --status.useCnt }
                }
            }
        }),

    127027: () => new StatusBuilder('重燃的绿洲之心').heroStatus().icon('ski,2').type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('所附属角色造成的伤害+3。；【所附属角色使用技能后：】移除我方场上的【sts127026】，每移除1层就治疗所附属角色1点。')
        .handle((_status, event) => {
            const { combatStatus = [] } = event;
            const sts127026 = getObjById(combatStatus, 127026);
            let cnt = 0;
            if (sts127026) {
                cnt = sts127026.useCnt;
                sts127026.useCnt = 0;
            }
            return {
                trigger: ['skill'],
                addDmg: 3,
                cmds: [{ cmd: 'heal', cnt }],
            }
        }),

    127028: () => new StatusBuilder('绿洲之庇护').heroStatus().useCnt(2).type(STATUS_TYPE.Shield)
        .description('提供2点[护盾]，保护所附属角色。'),

    127029: () => new StatusBuilder('绿洲之心').combatStatus().icon('ski,2').useCnt(0).maxCnt(4).type(STATUS_TYPE.Accumulate)
        .description('我方召唤4个【smn127022】后，我方【hro】附属【sts127027】，并获得2点[护盾]。')
        .handle((status, event, ver) => {
            const { card, discards = [], heros = [] } = event;
            if (card?.id != 127021 && !hasObjById(discards, 127021) && status.useCnt < 4) return;
            return {
                trigger: ['card', 'discard'],
                exec: () => {
                    if (++status.useCnt == 4) {
                        return {
                            cmds: [{
                                cmd: 'getStatus',
                                status: [newStatus(ver)(127027), newStatus(ver)(127028)],
                                hidxs: [getObjIdxById(heros, getHidById(status.id))],
                            }]
                        }
                    }
                }
            }
        }),

    300001: () => new StatusBuilder('旧时庭园(生效中)').combatStatus().icon('buff2').roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('本回合中，我方下次打出｢武器｣或｢圣遗物｣装备牌时少花费2个元素骰。')
        .handle((status, event) => {
            const { card, minusDiceCard: mdc = 0 } = event;
            if (card && card.hasSubtype(CARD_SUBTYPE.Weapon, CARD_SUBTYPE.Artifact) && card.cost > mdc) {
                return {
                    minusDiceCard: 2,
                    trigger: ['card'],
                    exec: () => { --status.roundCnt },
                }
            }
        }),

    300002: () => new StatusBuilder('自由的新风(生效中)').combatStatus().roundCnt(1).icon('buff3')
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；[useCnt]')
        .handle((status, event) => {
            const { card, playerInfo: { isKillByMyRound = false } = {} } = event;
            if (!isKillByMyRound) return;
            const triggers: Trigger[] = ['kill', 'skill', 'change-from'];
            if (card?.hasSubtype(CARD_SUBTYPE.Action)) triggers.push('card');
            return {
                trigger: triggers,
                isQuickAction: true,
                exec: (_, execEvent = {}) => {
                    if (execEvent.isQuickAction) --status.roundCnt;
                },
            }
        }),

    300003: () => new StatusBuilder('裁定之时(生效中)').combatStatus().icon('debuff')
        .useCnt(3).roundCnt(1).type(STATUS_TYPE.Usage)
        .description('本回合中，我方打出的事件牌无效。；[useCnt]')
        .handle((status, event) => {
            const { card } = event;
            if (card?.type == CARD_TYPE.Event) {
                return {
                    trigger: ['card'],
                    isInvalid: true,
                    exec: () => { --status.useCnt }
                }
            }
        }),

    300004: () => new StatusBuilder('抗争之日·碎梦之时(生效中)').heroStatus()
        .useCnt(4).roundCnt(1).type(STATUS_TYPE.Barrier)
        .description('本回合中，所附属角色受到的伤害-1。；[useCnt]'),

    301018: () => new StatusBuilder('严格禁令').combatStatus().icon('debuff').roundCnt(1).type(STATUS_TYPE.Usage)
        .description('本回合中，所在阵营打出的事件牌无效。；[useCnt]')
        .handle((status, event) => {
            const { card } = event;
            const isInvalid = card?.type == CARD_TYPE.Event;
            return {
                trigger: ['card'],
                isInvalid,
                exec: () => {
                    if (isInvalid) --status.roundCnt;
                }
            }
        }),

    301019: () => new StatusBuilder('悠远雷暴').heroStatus().useCnt(1).type(STATUS_TYPE.Attack)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Dot.webp')
        .description('【结束阶段：】对所附属角色造成2点[穿透伤害]。；[useCnt]')
        .handle((_status, event) => {
            const { hidx = -1 } = event;
            return {
                trigger: ['phase-end'],
                pdmg: 2,
                hidxs: [hidx],
                isSelf: true,
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                }
            }
        }),

    301021: () => coolDownStatus('禁忌知识'),

    301022: () => new StatusBuilder('赤王陵(生效中)').combatStatus().icon('debuff').roundCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('直到本回合结束前，所在阵营每抓1张牌，就立刻生成1张【crd301020】，随机地置入我方牌库中。')
        .handle(() => ({
            trigger: ['getcard'],
            isAddTask: true,
            exec: () => ({ cmds: [{ cmd: 'addCard', cnt: 1, card: 301020, isAttach: true }] }),
        })),

    301101: (useCnt: number) => new StatusBuilder('千岩之护').heroStatus().useCnt(useCnt).type(STATUS_TYPE.Shield)
        .description('根据｢璃月｣角色的数量提供[护盾]，保护所附属角色。'),

    301102: () => new StatusBuilder('千年的大乐章·别离之歌').heroStatus().icon('buff5').roundCnt(2)
        .description('我方角色造成的伤害+1。；[roundCnt]')
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage).handle(() => ({ addDmg: 1 })),

    301103: (name: string) => senlin1Status(name),

    301104: (name: string) => senlin1Status(name),

    301105: () => card311306sts('沙海守望·主动出击'),

    301106: () => card311306sts('沙海守望·攻势防御'),

    301107: (name: string) => senlin2Status(name),

    301108: () => new StatusBuilder('万世的浪涛').heroStatus().icon('buff5').roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('角色在本回合中，下次造成的伤害+2。')
        .handle(status => ({
            addDmg: 2,
            trigger: ['skill'],
            exec: () => { --status.roundCnt },
        })),

    301109: (name: string) => senlin2Status(name),

    301111: () => new StatusBuilder('金流监督(生效中)').heroStatus().icon('buff5').roundCnt(1).type(STATUS_TYPE.Usage)
        .description('本回合中，角色下一次｢普通攻击｣少花费1个[无色元素骰]，且造成的伤害+1。')
        .handle(status => ({
            trigger: ['skilltype1'],
            addDmgType1: 1,
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => { --status.roundCnt },
        })),

    301201: () => new StatusBuilder('重嶂不移').heroStatus().useCnt(2).type(STATUS_TYPE.Shield)
        .description('提供2点[护盾]，保护所附属角色。'),

    301203: () => new StatusBuilder('辰砂往生录(生效中)').heroStatus().icon('buff5').roundCnt(1)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('本回合中，角色｢普通攻击｣造成的伤害+1。')
        .handle(() => ({ addDmgType1: 1 })),

    302204: () => new StatusBuilder('｢清洁工作｣(生效中)').combatStatus().icon('buff5').useCnt(1).maxCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('我方出战角色下次造成的伤害+1。；(可叠加，最多叠加到+2)')
        .handle(status => ({
            trigger: ['skill'],
            addDmg: status.useCnt,
            exec: () => { status.useCnt = 0 },
        })),

    302205: () => new StatusBuilder('沙与梦').heroStatus().icon('buff2').useCnt(1)
        .description('【对角色打出｢天赋｣或角色使用技能时：】少花费3个元素骰。；[useCnt]')
        .handle((status, event) => {
            const { trigger = '', isMinusDiceSkill = false, isMinusDiceTalent = false } = event;
            return {
                minusDiceSkill: { skill: [0, 0, 3] },
                minusDiceCard: isCdt(isMinusDiceTalent, 3),
                trigger: ['card', 'skill'],
                exec: () => {
                    if (trigger == 'card' && isMinusDiceTalent || trigger == 'skill' && isMinusDiceSkill) {
                        --status.useCnt;
                    }
                },
            }
        }),

    302216: () => new StatusBuilder('托皮娅的心意').combatStatus().roundCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .icon('https://gi-tcg-assets.guyutocngxue.site/assets/UI_Gcg_Buff_Event_Sticker.webp')
        .description('本回合打出手牌后，随机[舍弃]1张牌或抓1张牌。')
        .handle((_, event) => {
            const { randomInt } = event;
            return {
                trigger: ['card'],
                exec: () => {
                    const cmd: Cmds[] = [{ cmd: 'getCard', cnt: 1 }, { cmd: 'discard', cnt: 1, mode: CMD_MODE.Random }];
                    return { cmds: [cmd[randomInt!()]] }
                }
            }
        }),

    302217: () => new StatusBuilder('卢蒂妮的心意').combatStatus().useCnt(2).type(STATUS_TYPE.Attack)
        .icon('https://gi-tcg-assets.guyutocngxue.site/assets/UI_Gcg_Buff_Event_Sticker.webp')
        .description('角色使用技能后，随机受到2点治疗或2点[穿透伤害]。；[useCnt]')
        .handle((_, event) => {
            const { hidx = -1, randomInt } = event;
            const res: StatusHandleRes = [{ heal: 2 }, { pdmg: 2, isSelf: true, hidxs: [hidx] }][randomInt!()];
            return {
                trigger: ['skill'],
                ...res,
                exec: eStatus => {
                    if (eStatus) --eStatus.useCnt;
                }
            }
        }),

    302219: () => new StatusBuilder('希洛娜的心意').combatStatus().useCnt(3).type(STATUS_TYPE.Round, STATUS_TYPE.Sign)
        .icon('https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Event_Sticker.webp')
        .description('将1张美露莘看好的超棒事件牌加入手牌。；[useCnt]')
        .handle(status => ({
            trigger: ['phase-end'],
            exec: () => {
                --status.useCnt;
                return {
                    cmds: [{
                        cmd: 'getCard',
                        cnt: 2,
                        subtype: CARD_SUBTYPE.ElementResonance,
                        cardTag: CARD_TAG.LocalResonance,
                        hidxs: [331101, 331201, 331331, 331401, 331501, 331601, 331701, 332015, 332016],
                    }]
                }
            }
        })),

    302303: () => new StatusBuilder('红羽团扇(生效中)').combatStatus().icon('buff2')
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('本回合中，我方执行的下次｢切换角色｣行动视为｢[快速行动]｣而非｢[战斗行动]｣，并且少花费1个元素骰。')
        .handle(status => ({
            minusDiceHero: 1,
            isQuickAction: true,
            trigger: ['change-from'],
            exec: (_, execEvent = {}) => {
                const { switchHeroDiceCnt = 0, isQuickAction = false } = execEvent;
                if (switchHeroDiceCnt == 0 && !isQuickAction) return { switchHeroDiceCnt }
                --status.useCnt;
                return { switchHeroDiceCnt: Math.max(0, switchHeroDiceCnt - 1) }
            }
        })),

    303112: () => new StatusBuilder('元素共鸣：粉碎之冰(生效中)').heroStatus().icon('buff2')
        .roundCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('本回合中，我方当前出战角色下一次造成的伤害+2。')
        .handle(status => ({
            addDmg: 2,
            trigger: ['skill'],
            exec: () => { --status.roundCnt },
        })),

    303132: () => new StatusBuilder('元素共鸣：热诚之火(生效中)').heroStatus().icon('buff2')
        .roundCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('本回合中，我方当前出战角色下一次引发[火元素相关反应]时，造成的伤害+3。')
        .handle((status, { skilltype = -1 }) => ({
            addDmgCdt: 3,
            trigger: isCdt(skilltype != -1, ['elReaction-Pyro']),
            exec: () => { --status.roundCnt },
        })),

    303162: () => new StatusBuilder('元素共鸣：坚定之岩(生效中)').combatStatus().icon('buff2').roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【本回合中，我方角色下一次造成[岩元素伤害]后：】如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充3点[护盾]。')
        .handle((_status, event) => {
            const { skilltype = -1 } = event;
            return {
                trigger: ['Geo-dmg'],
                isAddTask: true,
                exec: (eStatus, execEvent = {}) => {
                    if (!eStatus) return;
                    const { combatStatus = [] } = execEvent;
                    const shieldStatus = combatStatus.find(ost => ost.hasType(STATUS_TYPE.Shield));
                    if (shieldStatus && skilltype != -1) {
                        shieldStatus.useCnt += 3;
                        --eStatus.useCnt;
                    }
                }
            }
        }),

    303172: () => new StatusBuilder('元素共鸣：蔓生之草(生效中)').combatStatus().icon('buff2')
        .roundCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('本回合中，我方下一次引发元素反应时，造成的伤害+2。')
        .handle(status => ({
            addDmgCdt: 2,
            trigger: ['elReaction'],
            exec: () => { --status.useCnt },
        })),

    303181: () => new StatusBuilder('风与自由(生效中)').combatStatus().icon('buff2').icon('buff3', 'v4.1.0')
        .roundCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【本回合中，我方角色使用技能后：】将下一个我方后台角色切换到场上。')
        .description('【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；[useCnt]', 'v4.1.0')
        .handle((status, event, ver) => {
            if (ver < 'v4.1.0') {
                const { card, playerInfo: { isKillByMyRound = false } = {} } = event;
                if (!isKillByMyRound) return;
                const triggers: Trigger[] = ['kill', 'skill', 'change-from'];
                if (card?.hasSubtype(CARD_SUBTYPE.Action)) triggers.push('card');
                return {
                    trigger: triggers,
                    isQuickAction: true,
                    exec: (_, execEvent = {}) => {
                        if (execEvent.isQuickAction) --status.roundCnt;
                    },
                }
            }
            return {
                trigger: ['skill'],
                cmds: [{ cmd: 'switch-after' }],
                exec: () => { --status.roundCnt },
            }
        }),

    303182: () => new StatusBuilder('岩与契约(生效中)').combatStatus().icon('buff3')
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【下回合行动阶段开始时：】生成3点[万能元素骰]，并抓1张牌。')
        .handle(() => ({
            trigger: ['phase-start'],
            cmds: [{ cmd: 'getDice', cnt: 3, element: DICE_COST_TYPE.Omni }, { cmd: 'getCard', cnt: 1 }],
            exec: eStatus => {
                if (eStatus) --eStatus.useCnt;
            },
        })),

    303202: () => new StatusBuilder('换班时间(生效中)').combatStatus().icon('buff2')
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【我方下次执行｢切换角色｣行动时：】少花费1个元素骰。')
        .handle(status => ({
            minusDiceHero: 1,
            trigger: ['change-from'],
            exec: (_, execEvent = {}) => {
                let { switchHeroDiceCnt = 0 } = execEvent;
                if (switchHeroDiceCnt > 0) {
                    --status.useCnt;
                    --switchHeroDiceCnt;
                }
                return { switchHeroDiceCnt }
            }
        })),

    303205: () => coolDownStatus('本大爷还没有输！'),

    303206: () => new StatusBuilder('交给我吧！(生效中)').combatStatus().icon('buff3')
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【我方下次执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。')
        .handle(status => ({
            isQuickAction: true,
            trigger: ['change-from'],
            exec: (_eStatus, execEvent = {}) => {
                const { isQuickAction = false } = execEvent;
                if (isQuickAction) --status.useCnt
            },
        })),

    303207: () => new StatusBuilder('鹤归之时(生效中)').combatStatus().icon('buff3')
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【我方下一次使用技能后：】将下一个我方后台角色切换到场上。')
        .handle(status => ({
            trigger: ['skill'],
            cmds: [{ cmd: 'switch-after', cnt: 2500 }],
            exec: () => { --status.useCnt },
        })),

    303300: () => new StatusBuilder('饱腹').heroStatus().icon('satiety').roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign)
        .description('本回合无法食用更多的｢料理｣。'),

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
    //     'heal', 0, [3], 2, 0, -1, (_status, event) => {
    //         const { hidx = -1 } = event;
    //         return {
    //             trigger: ['phase-end'],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //                 return { cmds: [{ cmd: 'heal', cnt: 1, hidxs: [hidx] }] }
    //             },
    //         }
    //     }),

    // 2018: () => new GIStatus(2018, '莲花酥(生效中)', '本回合中，目标角色下次受到的伤害-3。',
    //     '', 0, [2, 10], 1, 0, 1, (status, event) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: Math.max(0, restDmg - 3) }
    //     }),

    // 2019: () => new GIStatus(2019, '兽肉薄荷卷(生效中)', '本回合中，该角色｢普通攻击｣少花费1个[无色元素骰]。；[useCnt]',
    //     'buff2', 0, [4], 3, 0, 1, (status, event) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 1, 0] });
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             },
    //         }
    //     }),

    // 2021: () => new GIStatus(2021, '北地烟熏鸡(生效中)', '本回合中，目标角色下一次｢普通攻击｣少花费1个[无色元素骰]。',
    //     'buff2', 0, [4, 10], 1, 0, 1, (status, event) => {
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
    //     '', 0, [2, 10], 1, 0, 1, (status, event) => {
    //         const { restDmg = 0 } = event;
    //         if (restDmg <= 0) return { restDmg }
    //         --status.useCnt;
    //         return { restDmg: Math.max(0, restDmg - 2) }
    //     }),

    // 2051: () => new GIStatus(2051, '重攻击(生效中)', '本回合中，当前我方出战角色下次｢普通攻击｣造成的伤害+1。；【此次｢普通攻击｣为[重击]时：】伤害额外+1。',
    //     'buff3', 0, [6, 10], 1, 0, 1, (status, event) => ({
    //         addDmgType1: 1,
    //         addDmgCdt: isCdt(event?.isChargedAtk, 1),
    //         trigger: ['skilltype1'],
    //         exec: () => { --status.useCnt },
    //     })),

    // 2052: () => new GIStatus(2052, '大梦的曲调(生效中)', '【我方下次打出｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, -1, (status, event) => {
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
    //     'buff2', 1, [4, 10], 1, 0, 1, (status, event) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.subType.includes(0) && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 2,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 2101: () => new GIStatus(2101, '拳力斗技！(生效中)', '【本回合中，一位牌手先宣布结束时：】未宣布结束的牌手抓2张牌。',
    //     'buff3', 0, [4, 10], 1, 0, -1, (_status, event) => {
    //         const { phase = -1 } = event;
    //         return {
    //             trigger: ['any-end-phase'],
    //             cmds: [{ cmd: 'getCard', cnt: 2, isOppo: phase > 6 }],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //             }
    //         }
    //     }),

    // 2110: () => new GIStatus(2110, '琴音之诗(生效中)', '【本回合中，我方下一次打出｢圣遗物｣手牌时：】少花费2个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, 1, (status, event) => {
    //         const { card, minusDiceCard: mdc = 0 } = event;
    //         if (card && card.subType.includes(1) && card.cost > mdc) {
    //             return {
    //                 minusDiceCard: 2,
    //                 trigger: ['card'],
    //                 exec: () => { --status.useCnt },
    //             }
    //         }
    //     }),

    // 2124: () => card587sts(1),

    // 2125: () => card587sts(2),

    // 2126: () => card587sts(3),

    // 2127: () => card587sts(4),

    // 2147: () => new GIStatus(2147, '坍陷与契机(生效中)', '【本回合中，双方牌手进行｢切换角色｣行动时：】需要额外花费1个元素骰。',
    //     'debuff', 1, [4, 10], -1, 0, 1, () => ({ trigger: ['change-from'], addDiceHero: 1 })),


    // 2148: () => new GIStatus(2148, '野猪公主(生效中)', '【本回合中，我方每有一张装备在角色身上的｢装备牌｣被弃置时：】获得1个[万能元素骰]。；[useCnt]；(角色被击倒时弃置装备牌，或者覆盖装备｢武器｣或｢圣遗物｣，都可以触发此效果)',
    //     'buff2', 1, [4], 2, 0, 1, (status, event) => {
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

    // 2151: () => new GIStatus(2151, '四叶印(生效中)', '【结束阶段：】切换到所附属角色。',
    //     'buff3', 0, [3, 10], -1, 0, -1, (_status, event) => ({
    //         trigger: ['phase-end'],
    //         exec: () => {
    //             const { hidx = -1 } = event;
    //             return { cmds: [{ cmd: 'switch-to', hidxs: [hidx], cnt: 1100 }] }
    //         }
    //     })),

    // 2152: () => new GIStatus(2152, '炸鱼薯条(生效中)', '本回合中，所附属角色下次使用技能时少花费1个元素骰。',
    //     'buff2', 0, [4, 10], 1, 0, 1, (status, event) => {
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [0, 0, 1] });
    //         return {
    //             trigger: ['skill'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --status.useCnt;
    //             },
    //         }
    //     }),

    // 2159: () => new GIStatus(2159, '松茸酿肉卷(生效中)', '【结束阶段：】治疗该角色1点。[useCnt]',
    //     'heal', 0, [3], 3, 0, -1, (_status, event) => {
    //         const { hidx = -1 } = event;
    //         return {
    //             trigger: ['phase-end'],
    //             exec: eStatus => {
    //                 if (eStatus) --eStatus.useCnt;
    //                 return { cmds: [{ cmd: 'heal', cnt: 1, hidxs: [hidx] }] }
    //             },
    //         }
    //     }),

    // 2161: () => new GIStatus(2161, '净觉花(生效中)', '【本回合中，我方下次打出支援牌时：】少花费1个元素骰。',
    //     'buff2', 1, [4, 10], 1, 0, 1, (status, event) => {
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
    //     'buff3', 0, [4, 9], 0, 0, -1, (status, event) => {
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

    // 2186: () => new GIStatus(2186, '缤纷马卡龙(生效中)', '【所附属角色受到伤害后：】治疗该角色1点。；[useCnt]',
    //     'heal', 0, [1], 3, 0, -1, () => ({
    //         heal: 1,
    //         trigger: ['getdmg'],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     })),

    // 2222: () => new GIStatus(2222, '噔噔！(生效中)', '结束阶段时，抓2张牌。',
    //     'buff3', 0, [3], 1, 0, -1, () => ({
    //         trigger: ['phase-end'],
    //         cmds: [{ cmd: 'getCard', cnt: 2 }],
    //         exec: eStatus => {
    //             if (eStatus) --eStatus.useCnt;
    //         },
    //     })),

    // 2223: () => new GIStatus(2223, '｢看到那小子挣钱…｣(生效中)', '本回合中，每当对方获得2个元素骰，你就获得1个[万能元素骰]。(此效果提供的元素骰除外)',
    //     'buff3', 1, [4, 9], 0, 0, 1, (status, event) => {
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

export const newStatus = (version?: Version) => (id: number, ...args: any) => statusTotal[id](...args).id(id).version(version).done();