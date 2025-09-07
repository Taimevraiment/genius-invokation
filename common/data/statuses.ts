import { Status, Trigger } from "../../typing";
import {
    CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CMD_MODE, DAMAGE_TYPE, DICE_COST_TYPE, ELEMENT_CODE, ELEMENT_CODE_KEY, ELEMENT_TYPE,
    ELEMENT_TYPE_KEY, ElementType, HERO_TAG, PHASE, PureElementType, PureElementTypeKey, SKILL_TYPE, SkillType, STATUS_TYPE, VERSION,
    Version, WEAPON_TYPE, WeaponType
} from "../constant/enum.js";
import { MAX_STATUS_COUNT, MAX_SUMMON_COUNT, MAX_USE_COUNT } from "../constant/gameOption.js";
import { NULL_STATUS } from "../constant/init.js";
import { DEBUFF_BG_COLOR, ELEMENT_ICON, ELEMENT_NAME, SKILL_TYPE_NAME, STATUS_BG_COLOR, STATUS_ICON } from "../constant/UIconst.js";
import { getDerivantParentId, getHidById, getObjById, getTalentIdByHid, getVehicleIdByCid, hasObjById } from "../utils/gameUtil.js";
import { isCdt } from "../utils/utils.js";
import { StatusBuilder, StatusBuilderHandleEvent, StatusBuilderHandleRes, StatusHandleRes } from "./builder/statusBuilder.js";

const enchantStatus = (el: PureElementType, addDmg: number = 0) => {
    const elName = ELEMENT_NAME[el];
    const hasAddDmgDesc = addDmg > 0 ? `，且造成的[${elName}伤害]+${addDmg}` : '';
    return new StatusBuilder(`${elName}附魔`).heroStatus().type(STATUS_TYPE.Enchant)
        .icon(addDmg > 0 ? STATUS_ICON.ElementAtkUp : STATUS_ICON.Enchant)
        .description(`所附属角色造成的[物理伤害]变为[${elName}伤害]${hasAddDmgDesc}。；[roundCnt]`)
        .handle(() => ({ attachEl: el, addDmg }));
}

// statusId若为-1则显示角标, >0为护盾状态Id, <0为关联特技牌id
const readySkillStatus = (name: string, skill: number, statusId: number = 0, exec?: (event: StatusBuilderHandleEvent) => void) => {
    return new StatusBuilder(name).heroStatus().icon(STATUS_ICON.Special).useCnt(1)
        .type(STATUS_TYPE.ReadySkill).type(statusId >= 0, STATUS_TYPE.Sign)
        .description(`本角色将在下次行动时，直接使用技能：【${skill < 5 ? SKILL_TYPE_NAME[skill as SkillType] : `rsk${skill}`}】。`)
        .handle((status, event) => {
            const { hero, trigger, source } = event;
            if (trigger == 'slot-destroy' && source == -statusId) {
                return { triggers: trigger, exec: () => status.dispose() }
            }
            const triggers: Trigger[] = ['switch-from'];
            if (!hero.heroStatus.has(STATUS_TYPE.NonAction)) triggers.push('useReadySkill');
            return {
                triggers,
                skill: isCdt(trigger == 'useReadySkill', skill),
                exec: () => {
                    status.minusUseCnt();
                    exec?.(event);
                    hero.heroStatus.get(statusId)?.dispose();
                }
            }
        });
}

const senlin1Status = (name: string) => {
    return new StatusBuilder(name + '（生效中）').heroStatus().icon(STATUS_ICON.Buff).roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【角色在本回合中，下次对角色打出「天赋」或使用「元素战技」时：】少花费2个元素骰。')
        .handle((status, event) => {
            if (status.roundCnt <= 0) return;
            const { trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
            return {
                minusDiceSkill: { skilltype2: [0, 0, 2] },
                minusDiceCard: isCdt(isMinusDiceTalent, 2),
                triggers: ['skilltype2', 'card'],
                exec: () => {
                    if (trigger == 'card' && isMinusDiceTalent || trigger == 'skilltype2' && isMinusDiceSkill) {
                        status.dispose();
                    }
                }
            }
        });
}

const senlin2Status = (name: string) => {
    return new StatusBuilder(name + '（生效中）').heroStatus().icon(STATUS_ICON.Buff).roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【角色在本回合中，下次使用「普通攻击」后：】生成2个此角色类型的元素骰。')
        .handle((status, { cmds }) => ({
            triggers: 'skilltype1',
            exec: () => {
                status.dispose();
                cmds.getDice(2, { mode: CMD_MODE.FrontHero });
            }
        }));
}

const card311306sts = (name: string) => {
    return new StatusBuilder(name).heroStatus().icon(STATUS_ICON.AtkUp).roundCnt(1).useCnt(1).maxCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).type(ver => !ver.isOffline, STATUS_TYPE.Sign).from(311306)
        .description('本回合内，所附属角色下次造成的伤害额外+1。')
        .handle(status => ({ triggers: 'skill', addDmg: status.useCnt, exec: () => status.dispose() }));
}

const card332016sts = (element: ElementType) => {
    const names = ['', '冰萤术士', '藏镜仕女', '火铳游击兵', '雷锤前锋军'];
    return new StatusBuilder('愚人众伏兵·' + names[ELEMENT_CODE[element]]).combatStatus().useCnt(2).perCnt(1)
        .type(STATUS_TYPE.Attack).icon(ELEMENT_ICON[element] + '-dice').iconBg(DEBUFF_BG_COLOR).from(332016)
        .description(`所在阵营的角色使用技能后：对所在阵营的出战角色造成1点[${ELEMENT_NAME[element]}伤害]。（每回合1次）；[useCnt]`)
        .handle(status => ({
            triggers: isCdt(status.perCnt > 0, 'after-skill'),
            damage: 1,
            element,
            isSelf: true,
            exec: () => {
                status.minusUseCnt();
                status.minusPerCnt();
            }
        }));
}

const card332024sts = (minusCnt: number) => {
    return new StatusBuilder('琴音之诗（生效中）').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(332024)
        .description(`【本回合中，我方下一次打出「圣遗物」手牌时：】少花费${minusCnt}个元素骰。`)
        .handle((status, event) => {
            const { isMinusDiceRelic } = event;
            if (!isMinusDiceRelic) return;
            return {
                minusDiceCard: minusCnt,
                triggers: 'card',
                exec: () => status.dispose(),
            }
        });
}

const hero1505sts = (swirlEl: PureElementType) => {
    return new StatusBuilder(`风物之诗咏·${ELEMENT_NAME[swirlEl][0]}`).combatStatus().icon(STATUS_ICON.ElementAtkUp).useCnt(2)
        .type(STATUS_TYPE.AddDamage).iconBg(STATUS_BG_COLOR[swirlEl])
        .description(`我方角色和召唤物所造成的[${ELEMENT_NAME[swirlEl]}伤害]+1。；[useCnt]`)
        .handle((status, event) => {
            const { skill, isSummon = -1 } = event;
            if (!skill?.isHeroSkill && isSummon == -1) return;
            return {
                triggers: [`${ELEMENT_TYPE_KEY[swirlEl] as PureElementTypeKey}-dmg`],
                addDmgCdt: 1,
                exec: () => status.minusUseCnt(),
            }
        });
}

const hero1513sts = (swirlEl: PureElementType) => {
    return new StatusBuilder(`聚风真眼·${ELEMENT_NAME[swirlEl][0]}`).combatStatus().useCnt(1)
        .type(STATUS_TYPE.Attack).icon('#')
        .description(`【所在阵营选择行动前：】对所附属角色造成1点[${ELEMENT_NAME[swirlEl]}伤害]。；[useCnt]`)
        .handle(status => ({
            damage: 1,
            element: swirlEl,
            isSelf: true,
            triggers: 'action-start',
            exec: () => status.minusUseCnt(),
        }));
}

const hero1611sts = (el: ElementType) => {
    const stsId = [, 216116, 216114, 216115, 216117, , 216113][ELEMENT_CODE[el]];
    return new StatusBuilder(`「源音采样」·${ELEMENT_NAME[el][0]}`).heroStatus().icon('#').maxCnt(3)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.NonDestroy, STATUS_TYPE.Show)
        .description(`【回合开始时：】如果所附属角色拥有2点「夜魂值」，则在敌方场上生成【sts${stsId}】。激活全部「源音采样」后，消耗2点「夜魂值」。`)
        .handle((status, event) => {
            const { heros, hidx = -1, cmds } = event;
            const heroStatus = heros[hidx]?.heroStatus;
            if ((getObjById(heroStatus, 116111)?.useCnt ?? 0) < 2) return;
            cmds.getStatus(stsId, { isOppo: true });
            const sts = [...heroStatus].reverse().find(s => [116113, 116114, 116115, 116116, 116117].includes(s.id));
            if (status.id == sts?.id) cmds.consumeNightSoul(hidx, 2);
            return { triggers: 'phase-start', isAddTask: true }
        });
}

const hero1611sts2 = (el: ElementType) => {
    return new StatusBuilder(`受到的${ELEMENT_NAME[el]}伤害增加`).combatStatus().type(STATUS_TYPE.AddDamage)
        .icon(`${ELEMENT_ICON[el]}-dice`).iconBg(DEBUFF_BG_COLOR).roundCnt(1)
        .description(`我方受到的[${ELEMENT_NAME[el]}伤害]增加1点。；[roundCnt]`)
        .handle(() => ({ triggers: `${ELEMENT_TYPE_KEY[el]}-getdmg`, getDmg: 1 }));
}

const shieldCombatStatus = (name: string, cnt = 2, mcnt = 0) => {
    return new StatusBuilder(name).combatStatus().type(STATUS_TYPE.Shield).useCnt(cnt).maxCnt(mcnt)
        .description(`为我方出战角色提供${cnt}点[护盾]。${mcnt > 0 ? `（可叠加${mcnt < MAX_USE_COUNT ? `，最多到${mcnt}` : ''}）` : ''}`);
}

const shieldHeroStatus = (name: string, cnt = 2, maxCnt = 0) => {
    return new StatusBuilder(name).heroStatus().useCnt(cnt).maxCnt(maxCnt).type(STATUS_TYPE.Shield)
        .description(`提供${cnt}点[护盾]，保护所附属角色。${maxCnt > 0 ? `（可叠加${maxCnt < MAX_USE_COUNT ? `，最多到${maxCnt}` : ''}）` : ''}`)
}

const readySkillShieldStatus = (name: string) => {
    return new StatusBuilder(name).heroStatus().type(STATUS_TYPE.Shield).useCnt(2)
        .description(`准备技能期间，提供2点[护盾]，保护所附属角色。`);
}

const coolDownStatus = (name: string, cardId: number) => {
    return new StatusBuilder(`${name}（冷却中）`).combatStatus().icon(STATUS_ICON.Debuff).roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign).from(cardId)
        .description(`本回合无法再打出【crd${cardId}】。`);
}

const continuousActionHandle = (status: Status, event: StatusBuilderHandleEvent): StatusBuilderHandleRes | void => {
    const { trigger } = event;
    if (trigger != 'kill' && status.useCnt == -1) return;
    return {
        triggers: ['change-turn', 'kill'],
        isQuickAction: trigger == 'change-turn',
        exec: () => {
            if (trigger == 'kill') status.useCnt = 1;
            else if (trigger == 'change-turn') status.dispose();
        },
    }
}

const nightSoul = (options: { isAccumate?: boolean, roundCnt?: number } = {}) => {
    const { isAccumate = true, roundCnt = -1 } = options;
    return () => new StatusBuilder('夜魂加持').heroStatus().useCnt(0).maxCnt(2).addCnt(0).roundCnt(roundCnt)
        .type(STATUS_TYPE.Accumulate, STATUS_TYPE.Usage, STATUS_TYPE.NightSoul)
        .description(`所附属角色可累积「夜魂值」。（最多累积到2点）${isAccumate ? '' : '；「夜魂值」为0时，退出【夜魂加持】。'}${roundCnt > -1 ? `；[roundCnt]` : ''}`)
        .handle(status => {
            if (status.useCnt > 0 || isAccumate) return;
            return { triggers: ['action-start', 'action-start-oppo'], exec: () => status.dispose() }
        });
}

const allStatuses: Record<number, (...args: any) => StatusBuilder> = {

    106: () => new StatusBuilder('冻结').heroStatus().roundCnt(1).icon('#')
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign, STATUS_TYPE.NonAction)
        .description('角色无法使用技能持续到回合结束。；角色受到[火元素伤害]或[物理伤害]时，移除此效果，使该伤害+2')
        .handle(status => ({
            getDmg: 2,
            triggers: ['Physical-getdmg', 'Pyro-getdmg'],
            exec: () => status.dispose(),
        })),

    111: () => shieldCombatStatus('结晶', 1, 2),

    116: () => new StatusBuilder('草原核').combatStatus().type(STATUS_TYPE.AddDamage).icon('#').useCnt(1)
        .description('【我方对敌方出战角色造成[火元素伤害]或[雷元素伤害]时，】伤害值+2。；[useCnt]')
        .handle((status, event) => {
            if (!event.eDmgedHero.isFront) return;
            return {
                addDmgCdt: 2,
                triggers: ['Pyro-dmg', 'Electro-dmg'],
                exec: () => status.minusUseCnt(),
            }
        }),

    117: () => new StatusBuilder('激化领域').combatStatus().type(STATUS_TYPE.AddDamage).icon('#').useCnt(2).useCnt(3, 'v3.4.0')
        .description('【我方对敌方出战角色造成[雷元素伤害]或[草元素伤害]时，】伤害值+1。；[useCnt]')
        .handle((status, event) => {
            if (!event.eDmgedHero.isFront) return;
            return {
                addDmgCdt: 1,
                triggers: ['Dendro-dmg', 'Electro-dmg'],
                exec: () => status.minusUseCnt(),
            }
        }),

    122: (useCnt: number = 1) => new StatusBuilder('生命之契').heroStatus().icon('#')
        .type(STATUS_TYPE.Usage).useCnt(useCnt).maxCnt(MAX_USE_COUNT)
        .description('【所附属角色受到治疗时：】此效果每有1次[可用次数]，就消耗1次，以抵消1点所受到的治疗。（无法抵消复苏或分配生命值引发的治疗）；[useCnt]')
        .description('【所附属角色受到治疗时：】此效果每有1次[可用次数]，就消耗1次，以抵消1点所受到的治疗。（无法抵消复苏、获得最大生命值或分配生命值引发的治疗）；[useCnt]', 'v5.0.0')
        .handle((status, event) => {
            const { heal, hidx } = event;
            if ((heal[hidx] ?? 0) <= 0) return;
            return {
                triggers: 'pre-heal',
                exec: () => {
                    const reduceHeal = Math.min(status.useCnt, heal[hidx]);
                    heal[hidx] -= reduceHeal;
                    status.minusUseCnt(reduceHeal);
                },
            }
        }),

    169: (cnt: number = 1) => new StatusBuilder('高效切换').combatStatus().icon(STATUS_ICON.Buff)
        .useCnt(cnt).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.Usage).from(301029)
        .description('【我方下次执行「切换角色」行动时：】少花费1个元素骰。；[useCnt]')
        .handle((status, event) => {
            const { switchHeroDiceCnt = 0 } = event;
            if (switchHeroDiceCnt == 0) return;
            return {
                minusDiceHero: 1,
                triggers: 'minus-switch',
                exec: () => status.minusUseCnt(),
            }
        }),

    170: () => new StatusBuilder('敏捷切换').combatStatus().icon(STATUS_ICON.Special)
        .useCnt(1).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.Usage)
        .description('【我方下次执行「切换角色」行动时：】将此次切换视为「[快速行动]」而非「[战斗行动]」。；[useCnt]')
        .handle((status, event) => {
            if (event.isQuickAction) return;
            return {
                isQuickAction: true,
                triggers: 'minus-switch-from',
                exec: () => status.minusUseCnt(),
            }
        }),

    111012: () => new StatusBuilder('冰莲').combatStatus().type(STATUS_TYPE.Barrier).useCnt(2)
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    111021: (isTalent: boolean = false) => new StatusBuilder('猫爪护盾').combatStatus().type(STATUS_TYPE.Shield)
        .useCnt(isTalent ? 2 : 1).description('为我方出战角色提供1点[护盾]。').talent(isTalent),

    111031: () => new StatusBuilder('寒冰之棱').combatStatus().type(STATUS_TYPE.Attack).useCnt(3)
        .description('【我方切换角色后：】造成2点[冰元素伤害]。；[useCnt]').icon('ski,2')
        .handle(status => ({
            damage: 2,
            element: DAMAGE_TYPE.Cryo,
            triggers: 'switch-from',
            exec: () => status.minusUseCnt(),
        })),

    111041: (isTalent: boolean = false) => new StatusBuilder('重华叠霜领域').combatStatus()
        .roundCnt(2).roundCnt(3, 'v4.2.0', isTalent).talent(isTalent).icon(STATUS_ICON.Enchant)
        .description(`我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[冰元素伤害]${isTalent ? '，「普通攻击」造成的伤害+1' : ''}。；[roundCnt]`)
        .type(STATUS_TYPE.Enchant).type(isTalent, STATUS_TYPE.AddDamage)
        .handle((status, event) => {
            if (!([WEAPON_TYPE.Sword, WEAPON_TYPE.Claymore, WEAPON_TYPE.Polearm] as WeaponType[]).includes(event.hero.weaponType)) return;
            return {
                triggers: 'skilltype1',
                addDmgType1: isCdt(status.isTalent, 1),
                attachEl: ELEMENT_TYPE.Cryo,
            }
        }),

    111052: (rcnt: number = 1, addDmg: number = 0) => enchantStatus(ELEMENT_TYPE.Cryo, addDmg).roundCnt(rcnt),

    111054: () => new StatusBuilder('神里流·霰步').heroStatus().icon(STATUS_ICON.Buff).useCnt(1).roundCnt(1)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign, STATUS_TYPE.Round)
        .description('本回合内，所附属角色下次「普通攻击」造成的伤害+1。')
        .handle(status => ({ triggers: 'skilltype1', addDmgType1: 1, exec: () => status.minusUseCnt() })),

    111061: () => new StatusBuilder('冷酷之心').heroStatus().icon(STATUS_ICON.ElementAtkUp).useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('【所附属角色使用〖ski,1〗时：】移除此状态，使本次伤害+3。')
        .description('【所附属角色使用〖ski,1〗时：】移除此状态，使本次伤害+2。', 'v3.8.0')
        .handle((status, _, ver) => ({
            triggers: 'skilltype2',
            addDmgCdt: ver.lt('v3.8.0') ? 2 : 3,
            exec: () => status.minusUseCnt(),
        })),

    111071: (isTalent: boolean = false) => new StatusBuilder('冰翎').combatStatus().icon(STATUS_ICON.ElementAtkUp).useCnt(2).useCnt(3, 'v4.2.0').perCnt(1, isTalent)
        .type(STATUS_TYPE.AddDamage).talent(isTalent)
        .description(`我方角色造成的[冰元素伤害]+1。（包括角色引发的‹1冰元素›扩散的伤害）；[useCnt]${isTalent ? '；我方角色通过「普通攻击」触发此效果时，不消耗「[可用次数]」。（每回合1次）' : ''}`)
        .handle((status, event) => {
            const { skill } = event;
            if (!skill?.isHeroSkill) return;
            return {
                addDmgCdt: 1,
                triggers: ['Cryo-dmg', 'Cryo-dmg-Swirl'],
                exec: () => {
                    if (status.perCnt > 0 && skill.type == SKILL_TYPE.Normal) status.minusPerCnt();
                    else status.minusUseCnt();
                }
            }
        }),

    111082: () => new StatusBuilder('度厄真符').combatStatus().icon('ski,2').useCnt(3).type(STATUS_TYPE.Attack)
        .description('【我方角色使用技能后：】如果该角色生命值未满，则治疗该角色2点。；[useCnt]')
        .handle((status, event) => {
            const { hero, skill } = event;
            if (skill?.id == 11083 || !hero.isHurted) return;
            return {
                triggers: 'after-skill',
                heal: 2,
                exec: () => status.minusUseCnt()
            }
        }),

    111091: () => shieldCombatStatus('安眠帷幕护盾'),

    111092: () => new StatusBuilder('飞星').combatStatus().icon('ski,1').useCnt(0).maxCnt(MAX_USE_COUNT).addCnt(2)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('【我方角色使用技能后：】累积1枚「晚星」。；如果「晚星」已有至少4枚，则消耗4枚「晚星」，造成1点[冰元素伤害]。（生成此出战状态的技能，也会触发此效果）；【重复生成此出战状态时：】累积2枚「晚星」。')
        .handle((status, event) => {
            const { trigger } = event;
            const isDmg = status.useCnt >= 4 && trigger == 'after-skill';
            const triggers: Trigger[] = ['skill'];
            if (isDmg) triggers.push('after-skill');
            return {
                triggers,
                damage: isCdt(isDmg, 1),
                element: DAMAGE_TYPE.Cryo,
                exec: () => {
                    if (trigger == 'skill') status.addUseCnt();
                    else if (trigger == 'after-skill') status.minusUseCnt(4);
                }
            }
        }),

    111101: () => new StatusBuilder('瞬时剪影').heroStatus().icon('cryo-dice').useCnt(2).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description(`【结束阶段：】对所附属角色造成1点[冰元素伤害]\\；如果[可用次数]仅剩余1且所附属角色具有[冰元素附着]，则此伤害+1。；[useCnt]`)
        .handle((status, event) => {
            const isAddDmg = event.hero.attachElement.includes(ELEMENT_TYPE.Cryo) && status.useCnt == 1;
            return {
                damage: 1 + +isAddDmg,
                element: DAMAGE_TYPE.Cryo,
                isSelf: true,
                triggers: 'phase-end',
                exec: () => status.minusUseCnt(),
            }
        }),

    111111: () => new StatusBuilder('寒烈的惩裁').heroStatus().icon('ski,1').useCnt(2).type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage)
        .description('【角色进行「普通攻击」时：】如果角色生命至少为6，则此技能少花费1个[冰元素骰]，伤害+1，且对自身造成1点[穿透伤害]。；如果角色生命不多于5，则使此伤害+1，并且技能结算后治疗角色2点。；[useCnt]')
        .handle((status, event) => {
            const { hero, hidx } = event;
            const res: StatusBuilderHandleRes = hero.hp >= 6 ? { pdmg: 1, hidxs: hidx, isSelf: true } : { heal: 2 };
            return {
                triggers: 'skilltype1',
                minusDiceSkill: isCdt(hero.hp >= 6, { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Cryo }),
                addDmgCdt: 1,
                ...res,
                exec: () => status.minusUseCnt(),
            }
        }),

    111112: () => new StatusBuilder('余威冰锥').combatStatus().icon('ski,2').useCnt(1).type(STATUS_TYPE.Attack)
        .description('【我方选择行动前：】造成2点[冰元素伤害]。；[useCnt]')
        .handle(status => ({
            damage: 2,
            element: DAMAGE_TYPE.Cryo,
            triggers: 'action-start',
            exec: () => status.minusUseCnt(),
        })),

    111121: () => new StatusBuilder('佩伊刻计').heroStatus().icon(STATUS_ICON.Buff).useCnt(0)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('【我方每抓1张牌后：】此牌累积1层「压力阶级」。；【所附属角色使用〖ski,1〗时：】如果「压力阶级」至少有2层，则移除此效果，使技能少花费1元素骰，且如果此技能结算后「压力阶级」至少有4层，则再额外造成2点[物理伤害]。')
        .handle((status, event) => {
            const { trigger } = event;
            return {
                triggers: ['drawcard', 'after-skilltype2'],
                minusDiceSkill: isCdt(status.useCnt >= 2, { skilltype2: [0, 0, 1] }),
                damage: isCdt(status.useCnt >= 4 && trigger == 'after-skilltype2', 2),
                element: DAMAGE_TYPE.Physical,
                exec: () => {
                    if (trigger == 'after-skilltype2' && status.useCnt >= 2) {
                        status.dispose();
                    } else if (trigger == 'drawcard') {
                        status.addUseCnt();
                    }
                }
            }
        }),

    111122: () => new StatusBuilder('潜猎模式').heroStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Usage).notReset()
        .description('【我方抓3张牌后：】提供1点[护盾]，保护所附属角色。（可叠加，最多叠加至2点〔\\；当前已抓{pct}张牌 〕）。；【所附属角色使用「普通攻击」或「元素战技」后：】将原本元素骰费用最高的至多2张手牌置于牌库底，然后抓等量的牌。；[roundCnt]')
        .handle((status, event) => {
            const { hero, hidx, hcards, trigger, cmds } = event;
            const triggers: Trigger[] = ['skilltype1', 'skilltype2'];
            const shield = hero.heroStatus.get(111123);
            if (!shield || shield.useCnt < shield.maxCnt) triggers.push('drawcard');
            return {
                triggers,
                isAddTask: true,
                exec: () => {
                    if (trigger.includes('skilltype')) {
                        cmds.putCard({ cnt: 2, mode: CMD_MODE.HighHandCard }).getCard(Math.min(hcards.length, 2));
                    } else if (trigger == 'drawcard' && status.minusPerCnt() == -3) {
                        status.perCnt = 0;
                        cmds.getStatus(111123, { hidxs: hidx });
                    }
                }
            }
        }),

    111123: () => shieldHeroStatus('潜猎护盾', 1, 2),

    111131: (cnt: number = 2) => new StatusBuilder('洞察破绽').combatStatus().useCnt(cnt).maxCnt(MAX_USE_COUNT).icon('#').type(STATUS_TYPE.Usage)
        .description('【我方角色使用技能后：】此效果每有1层，就有10%的概率生成【sts111133】。如果生成了【sts111133】，就使此效果层数减半。（向下取整）')
        .handle((status, event) => {
            const { randomInt, trigger, cmds } = event;
            if (trigger != 'skill' || randomInt(9) >= status.useCnt) return;
            return {
                triggers: 'skill',
                isAddTask: true,
                exec: () => {
                    status.useCnt = Math.floor(status.useCnt / 2);
                    cmds.getStatus(111133);
                }
            }
        }),

    111133: () => new StatusBuilder('强攻破绽').combatStatus().useCnt(1).icon('#')
        .type(STATUS_TYPE.Usage, STATUS_TYPE.MultiDamage, STATUS_TYPE.Sign)
        .description('【我方造成技能伤害时：】移除此状态，使本次伤害加倍。')
        .handle(status => ({ multiDmgCdt: 2, triggers: 'skill', exec: () => status.minusUseCnt() })),

    111141: nightSoul({ roundCnt: 2 }),

    111142: () => shieldCombatStatus('白曜护盾', 1, MAX_USE_COUNT).icon('ski,1').icon('#'),

    111143: () => new StatusBuilder('伊兹帕帕').combatStatus().roundCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Attack, STATUS_TYPE.Round).icon('#')
        .description('【我方角色受到伤害后：】减少1点【hro】的「夜魂值」，生成1层【sts111142】。；当【hro】获得「夜魂值」并使自身「夜魂值」等于2时，优先对敌方出战角色造成1点[冰元素伤害]。；[roundCnt]')
        .handle((status, event) => {
            const { trigger, heros, cmds, source } = event;
            const hero = heros.get(getHidById(status.id));
            if (!hero) return;
            const nightSoul = hero.heroStatus.get(111141);
            if (!nightSoul) return;
            if (trigger == 'after-getdmg') {
                if (nightSoul.useCnt == 0) return;
                cmds.consumeNightSoul(hero.hidx).getStatus(111142);
                return { triggers: trigger }
            }
            if (trigger == 'getNightSoul' && source == nightSoul.id && nightSoul.useCnt == 2) {
                return { triggers: trigger, damage: 1, element: DAMAGE_TYPE.Cryo, isPriority: true }
            }
        }),

    112021: (isTalent: boolean = false) => new StatusBuilder('雨帘剑').combatStatus().useCnt(2).useCnt(3, isTalent)
        .type(STATUS_TYPE.Barrier).talent(isTalent).barrierCdt(3).barrierCdt(2, ver => (ver.gte('v4.2.0') || ver.isOffline) && isTalent)
        .description(`【我方出战角色受到至少为${isTalent ? 2 : 3}的伤害时：】抵消1点伤害。；[useCnt]`)
        .description(`【我方出战角色受到至少为3的伤害时：】抵消1点伤害。；[useCnt]`, 'v4.2.0'),

    112022: () => new StatusBuilder('虹剑势').combatStatus().icon('ski,2').useCnt(3).type(STATUS_TYPE.Attack)
        .description('【我方角色「普通攻击」后：】造成1点[水元素伤害]。；[useCnt]')
        .description('【我方角色「普通攻击」后：】造成2点[水元素伤害]。；[useCnt]', 'v3.6.0')
        .handle((status, _, ver) => ({
            damage: isCdt(ver.lt('v3.6.0') && !ver.isOffline, 2, 1),
            element: DAMAGE_TYPE.Hydro,
            triggers: 'after-skilltype1',
            exec: () => status.minusUseCnt(),
        })),

    112031: () => new StatusBuilder('虚影').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    112032: () => new StatusBuilder('泡影').combatStatus().icon('ski,2').useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.MultiDamage, STATUS_TYPE.Sign)
        .description('【我方造成技能伤害时：】移除此状态，使本次伤害加倍。')
        .handle(status => ({ multiDmgCdt: 2, triggers: 'skill', exec: () => status.minusUseCnt() })),

    112041: () => new StatusBuilder('远程状态').heroStatus().icon('ski,3').type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【所附属角色进行[重击]后：】目标角色附属【sts112043】。')
        .handle((_, { isChargedAtk }) => ({ statusOppo: isCdt(isChargedAtk, 112043), triggers: 'skilltype1' })),

    112042: () => new StatusBuilder('近战状态').heroStatus().icon('ski,1').roundCnt(2).perCnt(2)
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('角色造成的[物理伤害]转换为[水元素伤害]。；【角色进行[重击]后：】目标角色附属【sts112043】。；角色对附属有【sts112043】的角色造成的伤害+1;；【角色对已附属有断流的角色使用技能后：】对下一个敌方后台角色造成1点[穿透伤害]。（每回合至多2次）；[roundCnt]')
        .handle((status, event) => {
            const { isChargedAtk, eheros, trigger, cmds, hidx } = event;
            const isDuanliu = eheros.getFront()?.heroStatus.has(112043);
            const hidxs = eheros.getNextBackHidx();
            const isPdmg = status.perCnt > 0 && isDuanliu && hidxs.length && trigger == 'skill';
            const triggers: Trigger[] = ['skill'];
            if (status.roundCnt == 1) triggers.push('phase-end');
            if (isChargedAtk) cmds.getStatus(112043, { isOppo: true });
            return {
                triggers,
                pdmg: isCdt(isPdmg, 1),
                hidxs: isCdt(isPdmg, hidxs),
                addDmgCdt: isCdt(isDuanliu, 1),
                attachEl: ELEMENT_TYPE.Hydro,
                exec: () => {
                    if (trigger == 'phase-end') return cmds.getStatus(112041, { hidxs: hidx });
                    if (isPdmg) status.minusPerCnt();
                },
            }
        }),

    112043: () => new StatusBuilder('断流').heroStatus().icon('ski,2').iconBg(DEBUFF_BG_COLOR).roundCnt(2, 'v4.1.0')
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.NonDestroy).type(ver => ver.gte('v4.1.0'), STATUS_TYPE.Sign)
        .description('【所附属角色被击倒后：】对所在阵营的出战角色附属【断流】。')
        .handle((status, event, ver) => {
            const { hero, hidx, eheros, trigger, cmds } = event;
            const triggers: Trigger[] = ['killed'];
            const isTalent = !!eheros.get(getHidById(status.id))?.talentSlot && (ver.lt('v4.1.0') || hero.isFront);
            if (isTalent) triggers.push('phase-end');
            return {
                triggers,
                pdmg: isCdt(isTalent, 1),
                hidxs: isCdt(isTalent, hidx),
                isSelf: isCdt(isTalent, true),
                exec: () => {
                    if (trigger != 'killed') return;
                    status.dispose();
                    cmds.getStatus(112043);
                }
            }
        }),

    112052: () => new StatusBuilder('仪来羽衣').heroStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage)
        .description('所附属角色「普通攻击」造成的伤害+1。；【所附属角色「普通攻击」后：】治疗所有我方角色1点。；[roundCnt]')
        .handle((_, event) => {
            const { heros, trigger } = event;
            return {
                addDmgType1: 1,
                triggers: ['skilltype1', 'after-skilltype1'],
                heal: isCdt(trigger == 'after-skilltype1', 1),
                hidxs: heros.allHidxs(),
            }
        }),

    112061: () => new StatusBuilder('泷廻鉴花').heroStatus().icon(STATUS_ICON.ElementAtkUp).useCnt(3).useCnt(2, 'v4.1.0')
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色「普通攻击」造成的伤害+1，造成的[物理伤害]变为[水元素伤害]。；[useCnt]')
        .handle(status => ({
            addDmgType1: 1,
            triggers: 'skilltype1',
            attachEl: ELEMENT_TYPE.Hydro,
            exec: () => status.minusUseCnt(),
        })),

    112071: () => readySkillShieldStatus('苍鹭护盾'),

    112072: (isTalent: boolean = false) => new StatusBuilder('赤冕祝祷').combatStatus().icon('ski,2').roundCnt(2).perCnt(1).perCnt(0b11, isTalent)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant).talent(isTalent)
        .description(`我方角色「普通攻击」造成的伤害+1。；我方单手剑、双手剑或长柄武器角色造成的[物理伤害]变为[水元素伤害]。；【我方切换角色后：】造成1点[水元素伤害]。（每回合1次）；${isTalent ? '【我方角色「普通攻击」后：】造成1点[水元素伤害]。（每回合1次）；' : ''}[roundCnt]`)
        .handle((status, event) => {
            const { hero, trigger } = event;
            const isWeapon = ([WEAPON_TYPE.Sword, WEAPON_TYPE.Claymore, WEAPON_TYPE.Polearm] as WeaponType[]).includes(hero.weaponType);
            let isDmg = false;
            const triggers: Trigger[] = ['skilltype1'];
            if (trigger == 'switch-from') {
                isDmg = (status.perCnt >> 0 & 1) == 1;
                if (isDmg) triggers.push('switch-from');
            } else if (trigger == 'after-skilltype1' && status.isTalent) {
                isDmg = (status.perCnt >> 1 & 1) == 1;
                if (isDmg) triggers.push('after-skilltype1');
            }
            return {
                triggers,
                addDmgType1: 1,
                damage: isCdt(isDmg, 1),
                element: DAMAGE_TYPE.Hydro,
                attachEl: isCdt(isWeapon, ELEMENT_TYPE.Hydro),
                exec: () => {
                    const trg = ['switch-from', 'after-skilltype1'].indexOf(trigger);
                    if (trg > -1) status.perCnt &= ~(1 << trg);
                },
            }
        }),

    112074: () => readySkillStatus('苍鹭震击', 12074, 112071),

    112081: () => new StatusBuilder('金杯的丰馈').combatStatus().icon('ski,1').type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【敌方角色受到绽放反应时：】我方不再生成【sts116】，而是改为召唤【smn112082】。')
        .handle((_, event) => {
            const { trigger, source } = event;
            if (trigger == 'pre-get-status' && source == 116) return { triggers: trigger, isInvalid: true }
            return { triggers: 'Bloom-oppo', summon: 112082, isAddTask: false }
        }),

    112083: () => new StatusBuilder('永世流沔').heroStatus().icon('ski,2').useCnt(1).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【结束阶段：】对所附属角色造成2点[水元素伤害]。；[useCnt]')
        .description('【结束阶段：】对所附属角色造成3点[水元素伤害]。；[useCnt]', 'v5.6.0')
        .handle((status, _, ver) => ({
            damage: isCdt(ver.lt('v5.6.0'), 3, 2),
            element: DAMAGE_TYPE.Hydro,
            isSelf: true,
            triggers: 'phase-end',
            exec: () => status.minusUseCnt(),
        })),

    112091: (act: number = 1) => new StatusBuilder('破局').heroStatus().useCnt(1).maxCnt(3).addCnt(act)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate, STATUS_TYPE.ConditionalEnchant).icon(STATUS_ICON.Enchant)
        .description('此状态初始具有1层「破局」\\；重复附属时，叠加1层「破局」。「破局」最多可以叠加到3层。；【结束阶段：】叠加1层「破局」。；【所附属角色「普通攻击」时：】如果「破局」已有2层，则消耗2层「破局」，使造成的[物理伤害]转换为[水元素伤害]，并抓1张牌。')
        .handle((status, event) => {
            const { trigger, cmds } = event;
            const triggers: Trigger[] = [];
            if (status.useCnt < status.maxCnt) triggers.push('phase-end');
            if (status.useCnt >= 2) triggers.push('skilltype1');
            if (trigger == 'skilltype1') cmds.getCard(1);
            return {
                triggers,
                attachEl: isCdt(status.useCnt >= 2 && trigger == 'skilltype1', ELEMENT_TYPE.Hydro),
                exec: () => {
                    if (trigger == 'skilltype1') status.minusUseCnt(2);
                    else if (trigger == 'phase-end') status.addUseCnt();
                }
            }
        }),

    112092: () => new StatusBuilder('玄掷玲珑').combatStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack)
        .description('【我方角色「普通攻击」后：】造成1点[水元素伤害]。；[roundCnt]')
        .description('【我方角色「普通攻击」后：】造成2点[水元素伤害]。；[roundCnt]', 'v4.6.1')
        .handle((_s, _e, ver) => ({
            damage: ver.lt('v4.6.1') ? 2 : 1,
            element: DAMAGE_TYPE.Hydro,
            triggers: 'after-skilltype1',
        })),

    112101: (cnt: number = 1) => new StatusBuilder('源水之滴').combatStatus().useCnt(cnt).maxCnt(3).type(STATUS_TYPE.Attack).icon('#')
        .description('【〖hro〗进行「普通攻击」后：】治疗【hro】2点，然后如果【hro】是我方「出战角色」，则[准备技能]：【rsk12104】。；[useCnt]')
        .handle((status, event) => {
            const { heros, skill, cmds } = event;
            if (skill?.id != 12101) return;
            const hero = heros.get(getHidById(status.id));
            if (hero?.isFront) cmds.getStatus(112102);
            return {
                heal: 2,
                hidxs: hero?.hidx,
                triggers: 'after-skilltype1',
                exec: () => status.minusUseCnt(),
            }
        }),

    112102: () => readySkillStatus('衡平推裁', 12104),

    112103: () => new StatusBuilder('遗龙之荣').heroStatus().icon(STATUS_ICON.Buff).useCnt(2).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('角色造成的伤害+1。；[useCnt]')
        .handle(status => ({ addDmg: 1, triggers: 'skill', exec: () => status.minusUseCnt() })),

    112114: () => new StatusBuilder('普世欢腾').combatStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Usage)
        .description('【我方出战角色受到伤害或治疗后：】叠加1点【sts112115】。；[roundCnt]')
        .handle((_, event) => (event.cmds.getStatus(112115), { triggers: isCdt(event.dmgedHidx == event.hero.hidx, ['getdmg', 'heal']) })),

    112115: () => new StatusBuilder('狂欢值').combatStatus().useCnt(1).maxCnt(MAX_USE_COUNT)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).icon('#')
        .description('我方造成的伤害+1。（包括角色引发的扩散伤害）；[useCnt]')
        .handle((status, event) => {
            const { skill, trigger } = event;
            return {
                triggers: ['dmg', 'dmg-Swirl'],
                addDmg: 1,
                addDmgCdt: isCdt(!skill?.isHeroSkill || trigger == 'dmg-Swirl', 1),
                exec: () => status.minusUseCnt(),
            }
        }),

    112116: () => new StatusBuilder('万众瞩目').heroStatus().icon(STATUS_ICON.Special).useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('【角色进行「普通攻击」时：】使角色造成的造成的[物理伤害]变为[水元素伤害]。如果角色处于「荒」形态，则治疗我方所有后台角色1点\\；如果角色处于「芒」形态，则此伤害+2，但是对一位受伤最少的我方角色造成1点[穿透伤害]。；[useCnt]')
        .handle((status, event) => {
            const { hero: { tags }, heros } = event;
            const res: StatusHandleRes = tags.includes(HERO_TAG.ArkheOusia) ?
                { heal: 1, hidxs: heros.getBackHidxs() } :
                { addDmgCdt: 2, pdmg: 1, hidxs: heros.getMinHertHidxs(), isSelf: true };
            return {
                attachEl: ELEMENT_TYPE.Hydro,
                triggers: 'skilltype1',
                ...res,
                exec: () => status.minusUseCnt()
            }
        }),

    112134: () => readySkillStatus('满满心意药剂冲击', 12135),

    112135: () => new StatusBuilder('静养').combatStatus().useCnt(2).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).icon('#')
        .description('我方「元素战技」或召唤物造成的伤害+1。；[useCnt]')
        .handle((status, event) => {
            const { isSummon, skill } = event;
            return {
                addDmgCdt: isCdt(isSummon != -1, 1),
                addDmgType2: 1,
                triggers: isCdt(isSummon != -1 || skill?.type == SKILL_TYPE.Elemental, 'dmg'),
                exec: () => status.minusUseCnt(),
            }
        }),

    112136: () => new StatusBuilder('细致入微的诊疗').heroStatus().useCnt(3)
        .type(STATUS_TYPE.Hide, STATUS_TYPE.Usage, STATUS_TYPE.NonDestroy)
        .handle((status, event) => {
            const { hidx, source, sourceHidx, cmds } = event;
            // if (trigger == 'revive') return { triggers: 'revive', exec: () => status.useCnt = 3 };
            if (hidx != sourceHidx || source != 122) return;
            cmds.addMaxHp(1, hidx);
            return { triggers: 'status-destroy', exec: () => status.minusUseCnt() }
        }),

    112141: nightSoul(),

    112143: () => new StatusBuilder('啃咬目标').heroStatus().useCnt(1).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.AddDamage).icon('#')
        .description('【受到〖hro〗或〖smn112144〗伤害时：】移除此效果，每层使此伤害+2。（层数可叠加，没有上限）')
        .handle((status, event) => {
            const { isSummon, skill } = event;
            if (isSummon != 112144 && getHidById(skill?.id) != getHidById(status.id)) return;
            return { triggers: 'getdmg', getDmg: 2 * status.useCnt, exec: () => status.dispose() }
        }),

    113011: () => enchantStatus(ELEMENT_TYPE.Pyro).roundCnt(2),

    113022: () => new StatusBuilder('旋火轮').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack)
        .description('【我方角色使用技能后：】造成2点[火元素伤害]。；[useCnt]')
        .handle((status, event) => ({
            triggers: isCdt(event.skill?.id != 13023, 'after-skill'),
            damage: 2,
            element: DAMAGE_TYPE.Pyro,
            exec: () => status.minusUseCnt(),
        })),

    113031: (isTalent: boolean = false) => new StatusBuilder('鼓舞领域').combatStatus().icon('ski,2').roundCnt(2)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).talent(isTalent)
        .description(`【我方角色使用技能时：】${isTalent ? '' : '如果该角色生命值至少为7，则'}使此伤害额外+2\\；技能结算后，如果该角色生命值不多于6，则治疗该角色2点。；[roundCnt]`)
        .handle((status, { hero: { hp }, trigger }) => ({
            triggers: ['skill', 'after-skill'],
            addDmgCdt: isCdt(hp >= 7 || status.isTalent, 2),
            heal: isCdt(hp < 7 && trigger == 'after-skill', 2),
        })),

    113041: () => new StatusBuilder('兔兔伯爵').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消2点伤害。；[useCnt]').barrierCnt(2),

    113051: (isTalent: boolean = false) => new StatusBuilder('庭火焰硝').heroStatus().icon(STATUS_ICON.ElementAtkUp)
        .useCnt(3).useCnt(2, 'v4.7.0').useCnt(3, 'v4.7.0', isTalent).useCnt(2, 'v4.2.0')
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant).type(isTalent, STATUS_TYPE.Attack).talent(isTalent)
        .description(`所附属角色「普通攻击」伤害+1，造成的[物理伤害]变为[火元素伤害]。${isTalent ? '；【所附属角色使用「普通攻击」后：】造成1点[火元素伤害]。' : ''}；[useCnt]`)
        .handle((status, event) => ({
            triggers: ['skilltype1', 'after-skilltype1'],
            addDmgType1: 1,
            damage: isCdt(status.isTalent && event.trigger == 'after-skilltype1', 1),
            element: DAMAGE_TYPE.Pyro,
            attachEl: ELEMENT_TYPE.Pyro,
            exec: () => +status.isTalent ^ +(event.trigger == 'skilltype1') && status.minusUseCnt(),
        })),

    113052: () => new StatusBuilder('琉金火光').combatStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack)
        .description('【hro】以外的我方角色使用技能后：造成1点[火元素伤害]。；[roundCnt]')
        .handle((status, event) => {
            if (event.hero.id == getHidById(status.id)) return;
            return { triggers: 'after-skill', damage: 1, element: DAMAGE_TYPE.Pyro }
        }),

    113061: (isTalent: boolean = false) => new StatusBuilder('爆裂火花').heroStatus().icon(STATUS_ICON.AtkUp).useCnt(1).useCnt(2, isTalent)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).talent(isTalent)
        .description('【所附属角色进行[重击]时：】少花费1个[火元素骰]，并且伤害+1。；[useCnt]')
        .handle((status, event) => {
            if (!event.isChargedAtk) return;
            return {
                triggers: 'skilltype1',
                addDmgCdt: 1,
                minusDiceSkill: { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Pyro },
                exec: () => status.minusUseCnt(),
            }
        }),

    113063: () => new StatusBuilder('轰轰火花').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营的角色使用技能后：】对所在阵营的出战角色造成2点[火元素伤害]。；[useCnt]')
        .handle(status => ({
            damage: 2,
            element: DAMAGE_TYPE.Pyro,
            isSelf: true,
            triggers: 'after-skill',
            exec: () => status.minusUseCnt(),
        })),

    113071: () => new StatusBuilder('彼岸蝶舞').heroStatus().icon(STATUS_ICON.AtkUp).roundCnt(2).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色造成的[物理伤害]变为[火元素伤害]，且角色造成的[火元素伤害]+1。；【所附属角色进行[重击]时：】目标角色附属【sts113072】。；[roundCnt]')
        .handle((_, { isChargedAtk, cmds }) => ({
            addDmg: 1,
            attachEl: ELEMENT_TYPE.Pyro,
            triggers: 'skill',
            exec: () => isChargedAtk && cmds.getStatus(113072, { isOppo: true }),
        })),

    113072: () => new StatusBuilder('血梅香').heroStatus().useCnt(1).type(STATUS_TYPE.Attack).icon(STATUS_ICON.Dot)
        .description('【结束阶段：】对所附属角色造成1点[火元素伤害]。；[useCnt]')
        .handle(status => ({
            damage: 1,
            element: DAMAGE_TYPE.Pyro,
            isSelf: true,
            triggers: 'phase-end',
            exec: () => status.minusUseCnt(),
        })),

    113081: () => new StatusBuilder('丹火印').heroStatus().icon(STATUS_ICON.AtkUp).useCnt(1).maxCnt(2).maxCnt(0, 'v4.2.0').type(STATUS_TYPE.AddDamage)
        .description('【角色进行[重击]时：】造成的伤害+2。；[useCnt]')
        .handle((status, event) => {
            if (!event.isChargedAtk) return;
            return {
                triggers: 'skilltype1',
                addDmgCdt: 2,
                exec: () => status.minusUseCnt(),
            }
        }),

    113082: () => new StatusBuilder('灼灼').heroStatus().icon('ski,2').roundCnt(2).perCnt(1).type(STATUS_TYPE.Round, STATUS_TYPE.Usage)
        .description('【角色进行[重击]时：】少花费1个[火元素骰]。（每回合1次）；【结束阶段：】角色附属【sts113081】。；[roundCnt]')
        .handle((status, event) => {
            const { isChargedAtk, isMinusDiceSkill, trigger, cmds, hidx } = event;
            return {
                triggers: ['skilltype1', 'phase-end'],
                isAddTask: trigger == 'phase-end',
                minusDiceSkill: isCdt(isChargedAtk && status.perCnt > 0, { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Pyro }),
                exec: () => {
                    if (trigger == 'phase-end') cmds.getStatus(113081, { hidxs: hidx });
                    else if (trigger == 'skilltype1' && isChargedAtk && isMinusDiceSkill) status.minusPerCnt();
                }
            }
        }),

    113092: () => readySkillStatus('焚落踢', 13095).icon('ski,2'),

    113094: () => new StatusBuilder('净焰剑狱之护').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier, STATUS_TYPE.Usage).summonId(113093)
        .description('【〖hro〗在我方后台，我方出战角色受到伤害时：】抵消1点伤害\\；然后，如果【hro】生命值至少为7，则对其造成1点[穿透伤害]。')
        .handle((status, event) => {
            const { restDmg, heros, hidx, trigger } = event;
            const hid = getHidById(status.id);
            const hero = heros.get(hid);
            if (trigger == 'enter') {
                if (status.hasType(STATUS_TYPE.Barrier) && hero?.isFront) {
                    status.type = [STATUS_TYPE.Usage];
                }
                return;
            }
            if (trigger == 'switch-to') {
                const toHero = heros[hidx];
                status.type = [STATUS_TYPE.Usage];
                if (toHero.id != hid) status.type.push(STATUS_TYPE.Barrier);
                return;
            }
            if (restDmg <= 0 || !hero || hero.isFront) return { restDmg }
            return {
                restDmg: restDmg - 1,
                pdmg: isCdt(hero.hp >= 7, 1),
                isSelf: true,
                hidxs: isCdt(hero.hp >= 7, hero.hidx),
                exec: () => status.minusUseCnt(),
            }
        }),

    113102: () => new StatusBuilder('隐具余数').heroStatus().icon(STATUS_ICON.Buff).useCnt(1).maxCnt(3).type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage)
        .description('「隐具余数」最多可以叠加到3层。；【角色使用〖ski,2〗时：】每层「隐具余数」使伤害+1。技能结算后，耗尽「隐具余数」，每层治疗角色1点。')
        .handle((status, event) => ({
            triggers: ['skilltype2', 'after-skilltype2'],
            addDmgCdt: status.useCnt,
            heal: isCdt(event.trigger == 'after-skilltype2', status.useCnt),
            exec: () => event.trigger == 'after-skilltype2' && status.dispose(),
        })),

    113111: () => shieldCombatStatus('烈烧佑命护盾', 1, 3),

    113112: (isTalent: boolean = false) => new StatusBuilder('炽火大铠').combatStatus().icon('ski,2').type(STATUS_TYPE.Attack)
        .useCnt(2).useCnt(3, isTalent).talent(isTalent)
        .description('【我方角色「普通攻击」后：】造成1点[火元素伤害]，生成【sts113111】。；[useCnt]')
        .handle((status, event) => ({
            damage: 1,
            element: DAMAGE_TYPE.Pyro,
            triggers: 'after-skilltype1',
            exec: () => {
                status.minusUseCnt();
                event.cmds.getStatus(113111);
            },
        })),

    113121: () => shieldCombatStatus('热情护盾'),

    113123: () => new StatusBuilder('氛围烈焰').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack)
        .description('【我方宣布结束时：】如果我方的手牌数量不多于1，则造成1点[火元素伤害]。；[useCnt]')
        .handle((status, event) => {
            const { hcards } = event;
            if (hcards.length > 1) return;
            return {
                triggers: 'end-phase',
                damage: 1,
                element: DAMAGE_TYPE.Pyro,
                exec: () => status.minusUseCnt(),
            }
        }),

    113132: () => new StatusBuilder('二重毁伤弹').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营切换角色后：】对切换到的角色造成1点[火元素伤害]。；[useCnt]')
        .handle(status => ({
            damage: 1,
            element: DAMAGE_TYPE.Pyro,
            isSelf: true,
            triggers: 'switch-from',
            exec: () => status.minusUseCnt(),
        })),

    113134: () => new StatusBuilder('尖兵协同战法（生效中）').combatStatus().icon(STATUS_ICON.Buff).useCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('我方造成的[火元素伤害]或[雷元素伤害]+1。（包括角色引发的扩散伤害）；[useCnt]')
        .handle(status => ({
            triggers: ['Pyro-dmg', 'Electro-dmg', 'Pyro-dmg-Swirl', 'Electro-dmg-Swirl'],
            addDmgCdt: 1,
            exec: () => status.minusUseCnt(),
        })),

    113141: () => new StatusBuilder('血债勒令').combatStatus().useCnt(5).type(STATUS_TYPE.Usage).icon('#')
        .description('【我方角色受伤后：】我方受到伤害的角色和敌方【hro】均附属1层【sts122】。；[useCnt]')
        .handle((status, event) => {
            const { hidx = -1, heros, eheros, getdmg, cmds } = event;
            const hidxs: number[] = [];
            for (let i = 0; i < getdmg.length; ++i) {
                if (hidxs.length >= status.useCnt) break;
                const hi = (hidx + i) % heros.length;
                if ((getdmg[hi] ?? -1) > -1) hidxs.push(hi);
            }
            cmds.getStatus(122, { hidxs });
            const ehero = getObjById(eheros, getHidById(status.id));
            if (ehero) cmds.getStatus(122, { hidxs: ehero.hidx, isOppo: true });
            return { triggers: 'getdmg', cmds, exec: () => status.minusUseCnt(hidxs.length) }
        }),

    113151: nightSoul({ isAccumate: false }),

    113152: () => new StatusBuilder('死生之炉').heroStatus().useCnt(2).icon('ski,2').icon('#')
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('我方全体角色的技能不消耗「夜魂值」。；我方全体角色「普通攻击」造成的伤害+1。；[useCnt]')
        .handle((status, event) => {
            const { restDmg = 1 } = event;
            const cnt = Math.min(status.useCnt, restDmg);
            return {
                triggers: ['skilltype1', 'other-skilltype1', 'pre-consumeNightSoul'],
                addDmgCdt: 1,
                isInvalid: true,
                exec: () => status.minusUseCnt(cnt)
            }
        }),

    113153: () => new StatusBuilder('诸火武装·焚曜之环').combatStatus().icon('ski,1').icon('#')
        .type(STATUS_TYPE.Attack)
        .description('【我方其他角色使用「普通攻击」或[特技]后：】消耗【hro】1点「夜魂值」，造成1点[火元素伤害]。（【hro】退出【sts113151】后销毁）')
        .handle((status, event) => {
            const { heros, cmds, trigger, source = -1 } = event;
            if (trigger == 'status-destroy' && source == 113151) {
                return { triggers: trigger, exec: () => status.dispose() }
            }
            const hid = getHidById(status.id);
            if (source == hid) return;
            return {
                triggers: ['after-skilltype1', 'after-skilltype5'],
                damage: 1,
                element: DAMAGE_TYPE.Pyro,
                exec: () => cmds.consumeNightSoul(getObjById(heros, hid)?.hidx),
            }
        }),

    113157: () => readySkillStatus('驰轮车·疾驰（生效中）', 13155),

    113158: () => new StatusBuilder('驰轮车·疾驰（生效中）').combatStatus().useCnt(1)
        .icon(STATUS_ICON.Special).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【行动阶段开始时：】生成2个[万能元素骰]。')
        .handle((status, event) => ({
            triggers: 'phase-start',
            isAddTask: true,
            exec: () => {
                status.minusUseCnt();
                event.cmds.getDice(2, { element: DICE_COST_TYPE.Omni });
            },
        })),

    114021: () => new StatusBuilder('雷狼').heroStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack)
        .description('【所附属角色使用「普通攻击」或「元素战技」后：】造成2点[雷元素伤害]。；[roundCnt]')
        .handle(() => ({
            damage: 2,
            element: DAMAGE_TYPE.Electro,
            triggers: ['after-skilltype1', 'after-skilltype2'],
        })),

    114032: (isTalent: boolean = false) => enchantStatus(ELEMENT_TYPE.Electro, +isTalent).roundCnt(2 + +isTalent).talent(isTalent),

    114041: () => new StatusBuilder('启途誓使').heroStatus().icon('ski,2').useCnt(0).maxCnt(MAX_STATUS_COUNT)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Enchant, STATUS_TYPE.Accumulate)
        .description('【结束阶段：】累积1级「凭依」，如果「凭依」级数至少为8，则「凭依」级数-6。；【根据「凭依」级数，提供效果：】；大于等于2级：[物理伤害]转化为[雷元素伤害];；大于等于4级：造成的伤害+2。')
        .description('【结束阶段：】累积1级「凭依」。；【根据「凭依」级数，提供效果：】；大于等于2级：[物理伤害]转化为[雷元素伤害];；大于等于4级：造成的伤害+2;；大于等于6级：「凭依」级数-4。', 'v4.8.0')
        .handle((status, event, ver) => {
            const { trigger } = event;
            const isAttachEl = status.useCnt >= 2;
            const triggers: Trigger[] = ['phase-end', 'skilltype3'];
            if (ver.gte('v4.8.0')) triggers.push('skilltype2');
            return {
                triggers,
                addDmg: isCdt(status.useCnt >= 4, 2),
                attachEl: isCdt(isAttachEl, ELEMENT_TYPE.Electro),
                isUpdateAttachEl: isAttachEl,
                exec: () => {
                    if (trigger == 'phase-end' || trigger == 'skilltype2') status.addUseCnt();
                    else if (trigger == 'skilltype3') status.addUseCnt(2);
                    if (ver.lt('v4.8.0')) {
                        if (status.useCnt >= 6) status.minusUseCnt(4);
                    } else if (trigger == 'phase-end' && status.useCnt >= 8) {
                        status.minusUseCnt(6);
                    }
                }
            }
        }),

    114051: () => readySkillShieldStatus('捉浪·涛拥之守').handle((_s, { cmds }, ver) => {
        if (ver.gte('v4.2.0') || ver.isOffline) return;
        cmds.getStatus(114052);
        return { triggers: 'getdmg' }
    }),

    114052: () => new StatusBuilder('奔潮引电').heroStatus().icon(STATUS_ICON.Special)
        .useCnt(2).roundCnt(1).type(STATUS_TYPE.Round, STATUS_TYPE.Usage)
        .description('本回合内所附属的角色「普通攻击」少花费1个[无色元素骰]。；[useCnt]')
        .handle((status, event) => ({
            triggers: 'skilltype1',
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => { event.isMinusDiceSkill && status.minusUseCnt() }
        })),

    114053: () => new StatusBuilder('雷兽之盾').heroStatus().icon('ski,2').roundCnt(2).type(STATUS_TYPE.Attack, STATUS_TYPE.Barrier)
        .description('【我方角色「普通攻击」后：】造成1点[雷元素伤害]。；【我方角色受到至少为3的伤害时：】抵消其中1点伤害。；[roundCnt]')
        .handle((_, event) => {
            const { restDmg = -1 } = event;
            if (restDmg >= 0) return { triggers: 'reduce-dmg', restDmg: restDmg < 3 ? restDmg : restDmg - 1 }
            return { triggers: 'after-skilltype1', damage: 1, element: DAMAGE_TYPE.Electro }
        }),

    114055: () => readySkillStatus('踏潮', 14054, 114051),

    114063: () => new StatusBuilder('鸣煌护持').heroStatus().icon(STATUS_ICON.AtkUp).useCnt(2).type(STATUS_TYPE.AddDamage)
        .description('所附属角色「元素战技」和「元素爆发」造成的伤害+1。；[useCnt]')
        .handle(status => ({
            addDmgType2: 1,
            addDmgType3: 1,
            triggers: ['skilltype2', 'skilltype3'],
            exec: () => status.minusUseCnt(),
        })),

    114072: () => new StatusBuilder('诸愿百眼之轮').heroStatus().icon('ski,2').useCnt(0).maxCnt(3).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Accumulate)
        .description('【其他我方角色使用「元素爆发」后：】累积1点「愿力」。（最多累积3点）；【所附属角色使用〖ski,2〗时：】消耗所有「愿力」，每点「愿力」使造成的伤害+1。')
        .handle((status, event) => {
            const { trigger } = event;
            return {
                triggers: ['other-skilltype3', 'skilltype3'],
                exec: () => {
                    if (trigger == 'skilltype3') status.useCnt = 0;
                    else if (trigger == 'other-skilltype3') status.addUseCnt();
                }
            }
        }),

    114082: () => new StatusBuilder('遣役之仪').heroStatus().icon(STATUS_ICON.Special).roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('本回合中，所附属角色下次施放【ski,1】时少花费2个元素骰。')
        .handle((status, event) => ({
            triggers: 'skilltype2',
            minusDiceSkill: { skilltype2: [0, 0, 2] },
            exec: () => { event.isMinusDiceSkill && status.dispose() },
        })),

    114083: () => new StatusBuilder('天狐霆雷').combatStatus().icon('ski,2').useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Sign)
        .description('【我方选择行动前：】造成3点[雷元素伤害]。；[useCnt]')
        .handle(status => ({
            damage: 3,
            element: DAMAGE_TYPE.Electro,
            triggers: 'action-start',
            exec: () => status.minusUseCnt(),
        })),

    114091: () => new StatusBuilder('引雷').heroStatus().icon(STATUS_ICON.Debuff).useCnt(2).addCnt(1).maxCnt(4)
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage)
        .description('此状态初始具有2层「引雷」\\；重复附属时，叠加1层「引雷」。「引雷」最多可以叠加到4层。；【结束阶段：】叠加1层「引雷」。；【所附属角色受到〖ski,1〗或〖smn114092〗伤害时：】移除此状态，每层「引雷」使此伤害+1。')
        .description('此状态初始具有2层「引雷」\\；重复附属时，叠加1层「引雷」。「引雷」最多可以叠加到4层。；【结束阶段：】叠加1层「引雷」。；【所附属角色受到〖ski,1〗伤害时：】移除此状态，每层「引雷」使此伤害+1。', 'v5.1.0', 'v1')
        .handle((status, event, ver) => {
            const { skill, isSummon = -1, trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (skill?.id == 14092 || (ver.gte('v5.1.0') && isSummon == 114092)) triggers.push('getdmg');
            return {
                triggers,
                getDmg: status.useCnt,
                exec: () => {
                    if (trigger == 'phase-end') status.addUseCnt();
                    else if (trigger == 'getdmg') status.dispose();
                },
            }
        }),

    114111: () => new StatusBuilder('越袚草轮').combatStatus().icon('ski,1').useCnt(3).perCnt(1).type(STATUS_TYPE.Attack)
        .description('【我方切换角色后：】造成1点[雷元素伤害]，治疗我方受伤最多的角色1点。（每回合1次）；[useCnt]')
        .handle((status, event) => {
            if (status.perCnt <= 0) return;
            event.cmds.heal(1, { hidxs: event.heros.getMaxHertHidxs() });
            return {
                damage: 1,
                element: DAMAGE_TYPE.Electro,
                triggers: 'switch-from',
                exec: () => {
                    status.minusUseCnt();
                    status.minusPerCnt();
                }
            }
        }),

    114121: () => new StatusBuilder('夜巡').heroStatus().icon('ski,1').roundCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Enchant)
        .description('角色受到【ski,1】以外的治疗时，改为附属等量的【sts122】。；【所附属角色使用普通攻击时：】造成的[物理伤害]变为[雷元素伤害]，并使自身附属2层【sts122】。')
        .handle((_, event) => {
            const { heal, hidx = -1, source = -1, trigger, cmds } = event;
            const triggers: Trigger[] = ['skilltype1'];
            if (trigger == 'skilltype1') {
                cmds.getStatus([[122, 2]], { hidxs: hidx });
            } else if (trigger == 'pre-heal' && source != 14122 && (heal[hidx] ?? 0) > 0) {
                triggers.push('pre-heal');
                cmds.getStatus([[122, heal[hidx]]], { hidxs: hidx });
                heal[hidx] = -1;
            }
            return { triggers, attachEl: ELEMENT_TYPE.Electro }
        }),

    114122: () => new StatusBuilder('破夜的明焰（生效中）').heroStatus().icon(STATUS_ICON.AtkUp).useCnt(1).maxCnt(3).type(STATUS_TYPE.AddDamage)
        .description('所附属角色下次造成的伤害+1。；（可叠加，最多叠加到+3）')
        .handle(status => ({ triggers: 'skill', addDmg: status.useCnt, exec: () => status.dispose() })),

    114131: () => new StatusBuilder('寂想瞑影').heroStatus().icon('ski,2').roundCnt(2)
        .type(STATUS_TYPE.Enchant, STATUS_TYPE.AddDamage, STATUS_TYPE.Attack)
        .description('【所附属角色使用「普通攻击」时：】造成的[物理伤害]变为[雷元素伤害]，伤害+1，少花费1个[无色元素骰]，并且对敌方生命值最低的角色造成1点[穿透伤害]。；[roundCnt]')
        .handle((_, event) => ({
            triggers: 'after-skilltype1',
            attachEl: ELEMENT_TYPE.Electro,
            addDmgType1: 1,
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            pdmg: 1,
            hidxs: event.eheros.getMinHpHidxs(),
        })),

    114132: () => new StatusBuilder('轰雷凝集').heroStatus().icon(STATUS_ICON.Special).useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【我方角色引发[雷元素相关反应]后：】所附属角色获得1点[充能]。；[useCnt]')
        .handle((status, event) => {
            const { hidx, cmds } = event;
            cmds.getEnergy(1, { hidxs: hidx });
            return {
                triggers: 'elReaction-Electro',
                isAddTask: true,
                isAfterSkill: true,
                exec: () => status.minusUseCnt(),
            }
        }),

    114141: nightSoul({ isAccumate: false }),

    114142: (isTalent: boolean = false) => new StatusBuilder('动能标示').combatStatus().icon('tmp/UI_Gcg_Buff_Iansan_S')
        .useCnt(2 + +isTalent).type(STATUS_TYPE.AddDamage)
        .description('【我方角色造成伤害时：】使该次伤害+2。如果【hro】处于【sts114141】，则不消耗[可用次数]，改为消耗【hro】1点「夜魂值」。；[useCnt]')
        .handle((status, event) => {
            const { hasDmg, heros, cmds } = event;
            if (!hasDmg) return;
            const hero = getObjById(heros, getHidById(status.id));
            if (hasObjById(hero?.heroStatus, 114141)) cmds.consumeNightSoul(hero!.hidx);
            return { triggers: 'skill', addDmgCdt: 2, exec: () => { cmds.isEmpty && status.minusUseCnt() } }
        }),

    115031: (isTalent: boolean = false) => new StatusBuilder('风域').combatStatus().icon(STATUS_ICON.Special)
        .useCnt(2).type(STATUS_TYPE.Usage).talent(isTalent)
        .description(`【我方执行「切换角色」行动时：】少花费1个元素骰。${isTalent ? '触发该效果后，使本回合中我方角色下次「普通攻击」少花费1个[无色元素骰]。' : ''}；[useCnt]`)
        .handle((status, event) => {
            const { switchHeroDiceCnt = 0, cmds } = event;
            if (switchHeroDiceCnt == 0) return;
            if (status.isTalent) cmds.getStatus(115033);
            return {
                minusDiceHero: 1,
                triggers: 'minus-switch',
                exec: () => status.minusUseCnt()
            }
        }),

    115033: () => new StatusBuilder('协鸣之风').combatStatus().icon(STATUS_ICON.Special).roundCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('本回合中，我方角色下次「普通攻击」少花费1个[无色元素骰]。')
        .handle((status, event) => ({
            triggers: 'skilltype1',
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => { event.isMinusDiceSkill && status.dispose() },
        })),

    115041: () => new StatusBuilder('夜叉傩面').heroStatus().icon('ski,2').roundCnt(2).perCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色造成的[物理伤害]变为[风元素伤害]，且角色造成的[风元素伤害]+1。；【所附属角色进行[下落攻击]时：】伤害额外+2。；【所附属角色为出战角色，我方执行「切换角色」行动时：】少花费1个元素骰。（每回合1次）；[roundCnt]')
        .handle((status, event) => {
            const { isFallAtk, switchHeroDiceCnt = 0, trigger } = event;
            const triggers: Trigger[] = ['Anemo-dmg'];
            if (switchHeroDiceCnt > 0 && status.perCnt > 0) triggers.push('minus-switch-from');
            return {
                addDmg: 1,
                addDmgCdt: isCdt(isFallAtk, 2),
                minusDiceHero: 1,
                triggers,
                attachEl: ELEMENT_TYPE.Anemo,
                exec: () => { trigger == 'minus-switch-from' && status.minusPerCnt() },
            }
        }),

    115042: () => new StatusBuilder('降魔·忿怒显相').heroStatus().icon(STATUS_ICON.Buff).useCnt(2).type(STATUS_TYPE.Round, STATUS_TYPE.Usage)
        .description('【所附属角色使用〖ski,1〗时：】少花费1个[风元素骰]。；[useCnt]；【所附属角色不再附属〖sts115041〗时：】移除此效果。')
        .handle((status, event) => {
            const { isMinusDiceSkill, source = -1, trigger } = event;
            const triggers: Trigger[] = ['skilltype2'];
            if (trigger == 'status-destroy' && source == 115041) triggers.push('status-destroy');
            return {
                triggers,
                minusDiceSkill: { skilltype2: [1, 0, 0], elDice: ELEMENT_TYPE.Anemo },
                exec: () => {
                    if (trigger == 'status-destroy') status.dispose();
                    else if (isMinusDiceSkill) status.minusUseCnt();
                }
            }
        }),

    115051: (swirlEl: PureElementType = ELEMENT_TYPE.Anemo) =>
        new StatusBuilder('乱岚拨止' + `${swirlEl != ELEMENT_TYPE.Anemo ? `·${ELEMENT_NAME[swirlEl][0]}` : ''}`)
            .heroStatus().icon(STATUS_ICON.Enchant).useCnt(1).iconBg(STATUS_BG_COLOR[swirlEl]).perCnt(1).perCnt(0, 'v4.8.0')
            .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign, STATUS_TYPE.ConditionalEnchant)
            .type(ver => ver.gte('v4.8.0'), STATUS_TYPE.Usage, STATUS_TYPE.ReadySkill)
            .description(`【我方下次通过「切换角色」行动切换到所附属角色时：】将此次切换视为「[快速行动]」而非「[战斗行动]」。；【我方选择行动前：】如果所附属角色为「出战角色」，则直接使用「普通攻击」\\；本次「普通攻击」造成的[物理伤害]变为[${ELEMENT_NAME[swirlEl]}伤害]，结算后移除此效果。`)
            .description(`【所附属角色进行[下落攻击]时：】造成的[物理伤害]变为[${ELEMENT_NAME[swirlEl]}伤害]，且伤害+1。；【角色使用技能后：】移除此效果。`, 'v4.8.0')
            .handle((status, event, ver) => {
                const { isFallAtk, isQuickAction: iqa, trigger, heros, cmds } = event;
                if (ver.lt('v4.8.0')) {
                    return {
                        addDmgCdt: isCdt(isFallAtk, 1),
                        triggers: 'skilltype1',
                        attachEl: isCdt(isFallAtk, swirlEl),
                        exec: () => status.minusUseCnt(),
                    }
                }
                const isQuickAction = trigger == 'minus-switch-to' && !iqa && status.perCnt > 0;
                return {
                    triggers: ['minus-switch-to', 'action-start', 'skilltype1'],
                    isQuickAction,
                    attachEl: swirlEl,
                    exec: () => {
                        if (trigger == 'action-start' && getObjById(heros, getHidById(status.id))?.isFront) return cmds.useSkill({ skillType: SKILL_TYPE.Normal });
                        if (trigger == 'skilltype1' && status.useCnt > 0) status.minusUseCnt();
                        if (isQuickAction) status.minusPerCnt();
                    },
                }
            }),

    115057: () => hero1505sts(ELEMENT_TYPE.Cryo),

    115058: () => hero1505sts(ELEMENT_TYPE.Hydro),

    115059: () => hero1505sts(ELEMENT_TYPE.Pyro),

    115050: () => hero1505sts(ELEMENT_TYPE.Electro),

    115061: () => new StatusBuilder('优风倾姿').heroStatus().icon(STATUS_ICON.AtkUp).useCnt(2).type(STATUS_TYPE.AddDamage)
        .description('【所附属角色进行「普通攻击」时：】造成的伤害+2\\；如果敌方存在后台角色，则此技能改为对下一个敌方后台角色造成伤害。；[useCnt]')
        .handle((status, event) => ({
            addDmgType1: 2,
            triggers: 'skilltype1',
            atkOffset: isCdt(event.trigger == 'skilltype1', 1),
            exec: () => status.minusUseCnt(),
        })),

    115062: () => new StatusBuilder('倾落').heroStatus().icon(STATUS_ICON.AtkSelf).useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Usage)
        .description('下次从该角色执行「切换角色」行动时少花费1个元素骰，并且造成1点[风元素伤害]。；[useCnt]')
        .handle((status, event) => ({
            triggers: ['minus-switch-from', 'switch-from'],
            damage: isCdt(event.trigger == 'switch-from', 1),
            element: DAMAGE_TYPE.Anemo,
            minusDiceHero: 1,
            exec: () => status.minusUseCnt()
        })),

    115071: (swirlEl: PureElementType) => readySkillStatus('风风轮', 15074).addition('element', ELEMENT_CODE[swirlEl])
        .handle(status => ({
            triggers: ['switch-from', 'useReadySkill'],
            skill: 15074 + (status.addition.element % 5),
            exec: () => status.minusUseCnt(),
        })),

    115081: () => new StatusBuilder('攻袭余威').heroStatus().icon(STATUS_ICON.Debuff).useCnt(1).roundCnt(1)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Round)
        .description('【结束阶段：】如果角色生命值至少为6，则受到2点[穿透伤害]。；[roundCnt]')
        .handle((status, event) => {
            const { heros, hidx = -1 } = event;
            if (heros[hidx] == undefined) return;
            return {
                triggers: isCdt(heros[hidx].hp >= 6, 'phase-end'),
                pdmg: 2,
                hidxs: hidx,
                isSelf: true,
                exec: () => status.minusUseCnt(),
            }
        }),

    115083: () => new StatusBuilder('惊奇猫猫盒的嘲讽').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId(115082)
        .description('【我方出战角色受到伤害时：】抵消1点伤害。（每回合1次）'),

    115091: () => new StatusBuilder('疾风示现').heroStatus().icon(STATUS_ICON.Enchant).useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.ConditionalEnchant)
        .description('【所附属角色进行[重击]时：】少花费1个[无色元素骰]，造成的[物理伤害]变为[风元素伤害]，并且使目标角色附属【sts115092】；[useCnt]')
        .handle((status, event) => {
            const { isChargedAtk, cmds } = event;
            if (!isChargedAtk) return;
            cmds.getStatus(115092, { isOppo: true });
            return {
                triggers: 'skilltype1',
                minusDiceSkill: { skilltype1: [0, 1, 0] },
                attachEl: ELEMENT_TYPE.Anemo,
                exec: () => status.minusUseCnt()
            }
        }),

    115092: () => new StatusBuilder('风压坍陷').heroStatus().icon('ski,1').useCnt(1)
        .type(STATUS_TYPE.Round).iconBg(DEBUFF_BG_COLOR)
        .description('【结束阶段：】将附属角色切换为「出战角色」。；[useCnt]；（同一方场上最多存在一个此状态）')
        .handle((status, event) => ({
            triggers: 'phase-end',
            onlyOne: true,
            isAddTask: true,
            exec: () => {
                status.minusUseCnt();
                const { hidx = -1, cmds } = event;
                cmds.switchTo(hidx);
            }
        })),

    115101: () => new StatusBuilder('步天梯').combatStatus().icon(STATUS_ICON.Special).useCnt(1).maxCnt(2).type(STATUS_TYPE.Usage)
        .description('【我方执行「切换角色」行动时：】少花费1个元素骰。；[useCnt]')
        .handle((status, event) => {
            const { switchHeroDiceCnt = 0 } = event;
            if (switchHeroDiceCnt == 0) return;
            return { minusDiceHero: 1, triggers: 'minus-switch', exec: () => status.minusUseCnt() }
        }),

    115103: () => new StatusBuilder('踏风腾跃').heroStatus().icon('ski,2').useCnt(1)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('角色进行「普通攻击」时：此技能视为[下落攻击]，并且伤害+1。技能结算后，造成1点[风元素伤害]。；[useCnt]')
        .handle((status, event) => {
            const { skill, trigger = '' } = event;
            if (trigger == 'enter' || (['skill', 'vehicle', 'card'].includes(trigger) && skill?.type != SKILL_TYPE.Normal)) {
                return { triggers: trigger, isFallAtk: true }
            }
            return {
                triggers: ['after-skilltype1', 'skilltype1'],
                addDmgCdt: 1,
                element: DAMAGE_TYPE.Anemo,
                damage: 1,
                exec: () => status.minusUseCnt(),
            }
        }),

    115104: () => new StatusBuilder('闲云冲击波').heroStatus().icon(STATUS_ICON.AtkSelf).useCnt(1).maxCnt(2).type(STATUS_TYPE.Attack)
        .description('【我方切换到所附属角色后：】造成1点[风元素伤害]。；[useCnt]')
        .handle(status => ({
            triggers: 'switch-to',
            damage: 1,
            element: DAMAGE_TYPE.Anemo,
            exec: () => status.minusUseCnt(),
        })),

    115111: nightSoul(),

    115118: () => new StatusBuilder('掩护的心意').combatStatus().useCnt(2).icon(STATUS_ICON.Special).type(STATUS_TYPE.Usage)
        .description('【我方「切换角色」时：】抓1张牌。；[useCnt]')
        .handle((status, event) => ({
            triggers: 'switch-from',
            isAddTask: true,
            exec: () => {
                status.minusUseCnt();
                event.cmds.getCard(1);
            }
        })),

    115121: (cnt: number = 1) => shieldCombatStatus('凤缕护盾', cnt, MAX_USE_COUNT).icon('#')
        .description(`为我方出战角色提供1点[护盾]。（可叠加，没有上限）`),

    115130: () => new StatusBuilder('聚风真眼').type(STATUS_TYPE.OnlyExplain)
        .description('【所在阵营选择行动前：】对所附属角色造成1点对应元素伤害，可用次数1。'),

    115131: () => readySkillStatus('在罪之先', 15135, 0, event => {
        const { heros, hidx = -1, trigger } = event;
        const sts115132 = getObjById(heros[hidx]?.heroStatus, 115132);
        if (!sts115132 || sts115132.perCnt != -2) return;
        if (sts115132.useCnt == 0) sts115132.dispose();
        if (trigger == 'switch-from') sts115132.perCnt = -1;
    }),

    115132: () => new StatusBuilder('变格').heroStatus().useCnt(1).maxCnt(MAX_USE_COUNT)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Usage).icon('#')
        .description('如果此状态有2层，则消耗2层此状态，并且本角色下次【ski,1】将视为快速行动，并且此次【rsk15135】伤害+1。（可叠加，没有上限）')
        .handle((status, event) => {
            if (status.useCnt < 2 || event.source != 115131) return;
            return { triggers: 'ready-skill', exec: () => status.minusUseCnt(2) }
        }),

    115133: () => hero1513sts(ELEMENT_TYPE.Cryo),

    115134: () => hero1513sts(ELEMENT_TYPE.Hydro),

    115135: () => hero1513sts(ELEMENT_TYPE.Pyro),

    115136: () => hero1513sts(ELEMENT_TYPE.Electro),

    115141: () => new StatusBuilder('梦浮').heroStatus().icon('tmp/UI_Gcg_Buff_Mizuki_S').useCnt(1).type(STATUS_TYPE.Attack)
        .description('【我方宣布结束时：】将所附属角色切换为出战角色，并造成1点[风元素伤害]。；[useCnt]')
        .handle((status, event) => {
            const { cmds, hidx = -1, heros } = event;
            if (!heros[hidx]?.isFront) cmds.switchTo(hidx);
            cmds.attack(1, DAMAGE_TYPE.Anemo);
            return {
                triggers: 'end-phase',
                isImmediate: true,
                exec: () => status.minusUseCnt()
            }
        }),

    116011: () => new StatusBuilder('璇玑屏').combatStatus().useCnt(2).type(STATUS_TYPE.Barrier, STATUS_TYPE.AddDamage)
        .description('【我方出战角色受到至少为2的伤害时：】抵消1点伤害。；[useCnt]')
        .handle((status, event) => {
            const { restDmg = -1, heros } = event;
            if (restDmg >= 0) {
                if (restDmg < 2) return { restDmg }
                return { restDmg: restDmg - 1, exec: () => status.minusUseCnt() }
            }
            if (!getObjById(heros, getHidById(status.id))?.talentSlot) return;
            return { triggers: 'Geo-dmg', addDmgCdt: 1 }
        }),

    116021: () => new StatusBuilder('护体岩铠').combatStatus().useCnt(2).type(STATUS_TYPE.Shield)
        .description('为我方出战角色提供2点[护盾]。此[护盾]耗尽前，我方受到的[物理伤害]减半。（向上取整）')
        .handle((_, event) => {
            const { restDmg = 0, dmgElement } = event;
            if (restDmg < 2 || dmgElement != DAMAGE_TYPE.Physical) return { restDmg }
            return { restDmg: Math.ceil(restDmg / 2) }
        }),

    116022: () => new StatusBuilder('大扫除').heroStatus().icon('ski,2').roundCnt(2).perCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('【角色使用「普通攻击」时：】少花费1个[岩元素骰]。（每回合1次）；角色「普通攻击」造成的伤害+2，造成的[物理伤害]变为[岩元素伤害]。；[roundCnt]')
        .handle((status, event) => ({
            addDmgType1: 2,
            minusDiceSkill: isCdt(status.perCnt > 0, { skilltype1: [1, 0, 0], elDice: ELEMENT_TYPE.Geo }),
            triggers: 'skilltype1',
            attachEl: ELEMENT_TYPE.Geo,
            exec: () => status.perCnt > 0 && event.isMinusDiceSkill && status.minusPerCnt(),
        })),

    116032: () => shieldCombatStatus('玉璋护盾'),

    116033: () => new StatusBuilder('石化').heroStatus().icon('ski,3').roundCnt(1).iconBg(DEBUFF_BG_COLOR)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign, STATUS_TYPE.NonAction)
        .description('【角色无法使用技能。】（持续到回合结束）'),

    116051: () => new StatusBuilder('阿丑').combatStatus().useCnt(1).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    116053: () => new StatusBuilder('怒目鬼王').heroStatus().icon('ski,2').roundCnt(2).perCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('所附属角色「普通攻击」造成的伤害+1，造成的[物理伤害]变为[岩元素伤害]。；[roundCnt]；【所附属角色「普通攻击」后：】为其附属【sts116054】。（每回合1次）')
        .description('所附属角色「普通攻击」造成的伤害+2，造成的[物理伤害]变为[岩元素伤害]。；[roundCnt]；【所附属角色「普通攻击」后：】为其附属【sts116054】。（每回合1次）', 'v4.2.0')
        .handle((status, { cmds }, ver) => ({
            addDmgType1: isCdt(ver.lt('v4.2.0'), 2, 1),
            attachEl: ELEMENT_TYPE.Geo,
            triggers: 'skilltype1',
            exec: () => {
                if (status.perCnt <= 0) return;
                status.minusPerCnt();
                cmds.getStatus(116054);
            }
        })),

    116054: () => new StatusBuilder('乱神之怪力').heroStatus().icon(STATUS_ICON.ElementAtkUp).useCnt(1).maxCnt(3).type(STATUS_TYPE.AddDamage)
        .description('【所附属角色进行[重击]时：】造成的伤害+1。如果[可用次数]至少为2，则还会使本技能少花费1个[无色元素骰]。；[useCnt]')
        .handle((status, event) => {
            if (!event.isChargedAtk) return;
            return {
                addDmgCdt: 1,
                minusDiceSkill: isCdt(status.useCnt >= 2, { skilltype1: [0, 1, 0] }),
                triggers: 'skilltype1',
                exec: () => status.minusUseCnt(),
            }
        }),

    116061: () => new StatusBuilder('大将旗指物').combatStatus().icon('ski,1').roundCnt(2).maxCnt(3)
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage)
        .description('我方角色造成的[岩元素伤害]+1。；[roundCnt]')
        .handle((_, event) => {
            if (!event.skill?.isHeroSkill) return;
            return { triggers: 'Geo-dmg', addDmgCdt: 1 }
        }),

    116071: () => readySkillShieldStatus('旋云护盾'),

    116072: () => readySkillStatus('长枪开相', 16074, 116071),

    116073: (useCnt: number = 1) => new StatusBuilder('飞云旗阵').combatStatus().icon('ski,1').useCnt(useCnt).maxCnt(4)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage)
        .description('我方角色进行「普通攻击」时：如果我方手牌数量不多于1，则此技能少花费1个元素骰。；[useCnt]')
        .description('我方角色进行「普通攻击」时：造成的伤害+1。；如果我方手牌数量不多于1，则此技能少花费1个元素骰。；[useCnt]】', 'v4.8.0')
        .handle((status, event, ver) => {
            const { hcards: { length: hcardsCnt }, heros, isMinusDiceSkill } = event;
            const isTriggered = ver.gte('v4.8.0') || isMinusDiceSkill;
            return {
                triggers: 'skilltype1',
                minusDiceSkill: isCdt(hcardsCnt <= 1, { skilltype1: [0, 0, 1] }),
                addDmgType1: isCdt(ver.lt('v4.8.0'), 1),
                addDmgCdt: isCdt(hcardsCnt == 0 && !!getObjById(heros, getHidById(status.id))?.talentSlot && isTriggered, 2),
                exec: () => { isTriggered && status.minusUseCnt() }
            }
        }),

    116084: () => enchantStatus(ELEMENT_TYPE.Geo).roundCnt(2),

    116098: () => new StatusBuilder('岩元素附魔').heroStatus().type(STATUS_TYPE.Enchant, STATUS_TYPE.Sign).icon(STATUS_ICON.Enchant).summonId(116091)
        .description('所附属角色「普通攻击」造成的伤害+1，造成的[物理伤害]变为[岩元素伤害]。')
        .handle(() => ({ addDmgType1: 1, attachEl: ELEMENT_TYPE.Geo })),

    116101: () => new StatusBuilder('超级钻钻领域').combatStatus().useCnt(3).type(STATUS_TYPE.AddDamage).icon('ski,2')
        .description('【此牌在场时：】我方【crd116102】造成的[岩元素伤害]+1，造成的[穿透伤害]+1。；[useCnt]')
        .handle((status, event) => {
            const { skill, isSummon = -1 } = event;
            if (skill?.id != getVehicleIdByCid(116102) && isSummon != 116103) return;
            return { triggers: 'Geo-dmg', addDmgCdt: 1, exec: () => status.minusUseCnt() }
        }),

    116104: nightSoul(),

    116111: nightSoul(),

    116113: (useCnt: number = 1) => hero1611sts(ELEMENT_TYPE.Geo).useCnt(useCnt),

    116114: (useCnt: number = 1) => hero1611sts(ELEMENT_TYPE.Hydro).useCnt(useCnt),

    116115: (useCnt: number = 1) => hero1611sts(ELEMENT_TYPE.Pyro).useCnt(useCnt),

    116116: (useCnt: number = 1) => hero1611sts(ELEMENT_TYPE.Cryo).useCnt(useCnt),

    116117: (useCnt: number = 1) => hero1611sts(ELEMENT_TYPE.Electro).useCnt(useCnt),

    117012: () => new StatusBuilder('新叶').combatStatus().icon(STATUS_ICON.AtkSelf).useCnt(1).roundCnt(1).type(STATUS_TYPE.Attack)
        .description('【我方角色的技能引发[草元素相关反应]后：】造成1点[草元素伤害]。（每回合1次）；[roundCnt]')
        .handle((status, event) => {
            if (!event.skill?.isHeroSkill) return;
            return {
                damage: 1,
                element: DAMAGE_TYPE.Dendro,
                triggers: ['elReaction-Dendro', 'other-elReaction-Dendro'],
                exec: () => status.minusUseCnt(),
            }
        }),

    117021: () => new StatusBuilder('通塞识').heroStatus().icon(STATUS_ICON.Enchant).useCnt(3)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.ConditionalEnchant)
        .description('【所附属角色进行[重击]时：】造成的[物理伤害]变为[草元素伤害]，并且会在技能结算后召唤【smn117022】。；[useCnt]')
        .handle((status, event) => {
            if (!event.isChargedAtk) return;
            return {
                summon: 117022,
                triggers: 'skilltype1',
                attachEl: ELEMENT_TYPE.Dendro,
                exec: () => status.minusUseCnt(),
            }
        }),

    117031: () => new StatusBuilder('蕴种印').heroStatus().useCnt(2).type(STATUS_TYPE.Attack).icon('#')
        .description('【任意具有蕴种印的所在阵营角色受到元素反应伤害后：】对所有附属角色造成1点[穿透伤害]。；[useCnt]')
        .handle((status, event) => {
            const { heros, eheros, hidx = -1, eCombatStatus, dmgedHidx, hasDmg, hcard, trigger } = event;
            const source = isCdt(trigger == 'other-get-elReaction', getObjById(heros[dmgedHidx].heroStatus, status.id)?.entityId);
            if (trigger == 'other-get-elReaction' && !source || !hasDmg) return;
            const hasPyro = trigger == 'get-elReaction' &&
                (!!getObjById(eheros, getHidById(status.id))?.talentSlot || hcard?.id == 217031) &&
                hasObjById(eCombatStatus, 117032) &&
                eheros.some(h => h.element == ELEMENT_TYPE.Pyro);
            return {
                damage: isCdt(hasPyro, 1),
                element: DAMAGE_TYPE.Dendro,
                pdmg: isCdt(!hasPyro, 1),
                isSelf: true,
                hidxs: hidx,
                triggers: ['get-elReaction', 'other-get-elReaction'],
                source,
                exec: () => status.minusUseCnt(),
            }
        }),

    117032: (isTalent: boolean = false, hasHydro: boolean = false) => new StatusBuilder('摩耶之殿').combatStatus().icon('ski,3')
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).roundCnt(2).roundCnt(3, isTalent && hasHydro).talent(isTalent)
        .description('【我方引发元素反应时：】伤害额外+1。；[roundCnt]')
        .handle((status, event) => {
            const { trigger, heros, eheros } = event;
            return {
                triggers: ['elReaction', 'other-elReaction', 'enter'],
                addDmgCdt: 1,
                exec: () => {
                    if (!status.isTalent || heros.every(h => h.element != ELEMENT_TYPE.Electro) || trigger != 'enter') return;
                    eheros.forEach(h => getObjById(h.heroStatus, 117031)?.addUseCnt());
                }
            }
        }),

    117043: () => new StatusBuilder('桂子仙机').combatStatus().icon('ski,2').useCnt(3).type(STATUS_TYPE.Attack)
        .description('【我方切换角色后：】造成1点[草元素伤害]，治疗我方出战角色1点。；[useCnt]')
        .handle(status => ({
            damage: 1,
            element: DAMAGE_TYPE.Dendro,
            heal: 1,
            triggers: 'switch-from',
            exec: () => status.minusUseCnt(),
        })),

    117052: () => new StatusBuilder('脉摄宣明').combatStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Usage)
        .description('【行动阶段开始时：】生成【sts117053】。；[useCnt]')
        .handle((status, event) => ({
            triggers: 'phase-start',
            isAddTask: true,
            exec: () => {
                status.minusUseCnt();
                event.cmds.getStatus(117053);
            },
        })),

    117053: () => new StatusBuilder('无欲气护盾').combatStatus().useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Shield)
        .description('提供1点[护盾]，保护我方出战角色。；【此效果被移除，或被重复生成时：】造成1点[草元素伤害]，治疗我方出战角色1点。')
        .handle((status, event) => {
            const { heros, hidx = -1, combatStatus, talent, cmds } = event;
            const fhero = heros[hidx];
            if (!fhero) return;
            const hid = getHidById(status.id);
            const triggers: Trigger[] = [];
            if (status.useCnt == 0) triggers.push('status-destroy');
            if (fhero.id == hid) triggers.push('after-skilltype3');
            if (hasObjById(combatStatus, 117052)) triggers.push('phase-start');
            return {
                damage: 1,
                element: DAMAGE_TYPE.Dendro,
                heal: 1,
                triggers,
                exec: () => { talent && cmds.getDice(1, { mode: CMD_MODE.FrontHero }) },
            }
        }),

    117061: (rcnt: number = 2) => new StatusBuilder('琢光镜').heroStatus().icon('ski,2').roundCnt(rcnt).maxCnt(3)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage, STATUS_TYPE.Enchant)
        .description('角色造成的[物理伤害]变为[草元素伤害]。；【角色「普通攻击」后：】造成1点[草元素伤害]。如果此技能为[重击]，则使此状态的[持续回合]+1。；[roundCnt]')
        .handle((status, event) => ({
            attachEl: ELEMENT_TYPE.Dendro,
            triggers: ['skilltype1', 'after-skilltype1'],
            damage: 1,
            element: DAMAGE_TYPE.Dendro,
            exec: () => { event.isChargedAtk && status.addRoundCnt(1) }
        })),

    117071: () => new StatusBuilder('猫箱急件').combatStatus().icon('ski,1').useCnt(1).maxCnt(2).type(STATUS_TYPE.Attack)
        .description('【〖hro〗为出战角色时，我方切换角色后：】造成1点[草元素伤害]，抓1张牌。；[useCnt]')
        .handle((status, event) => {
            const { heros, hidx = -1, cmds } = event;
            if (heros[hidx]?.id != getHidById(status.id)) return;
            return {
                damage: 1,
                element: DAMAGE_TYPE.Dendro,
                triggers: 'switch-from',
                exec: () => {
                    status.minusUseCnt();
                    cmds.getCard(1);
                },
            }
        }),

    117072: () => shieldCombatStatus('安全运输护盾'),

    117073: () => new StatusBuilder('猫草豆蔻').combatStatus().icon('ski,2').useCnt(2)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营打出2张行动牌后：】对所在阵营的出战角色造成1点[草元素伤害]。〔（当前已打出{pct}张）〕；[useCnt]')
        .handle(status => ({
            damage: isCdt(status.perCnt <= -1, 1),
            element: DAMAGE_TYPE.Dendro,
            isSelf: true,
            triggers: 'card',
            isAddTask: true,
            exec: () => {
                if (status.perCnt > -1) {
                    status.minusPerCnt();
                } else {
                    status.minusUseCnt();
                    status.perCnt = 0;
                }
            },
        })),

    117081: () => new StatusBuilder('梅赫拉克的助力').heroStatus().icon('ski,2').roundCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant)
        .description('角色「普通攻击」造成的伤害+1，且造成的[物理伤害]变为[草元素伤害]。；【角色「普通攻击」后：】生成【sts117082】。；【[持续回合]:{roundCnt}】')
        .handle((_, { cmds }) => ({
            triggers: 'skilltype1',
            attachEl: ELEMENT_TYPE.Dendro,
            addDmgType1: 1,
            exec: () => cmds.getStatus(117082),
        })),

    117082: (useCnt: number = 1) => new StatusBuilder('迸发扫描').combatStatus().icon('ski,1').useCnt(useCnt).maxCnt(3).type(STATUS_TYPE.Attack)
        .description('【双方选择行动前：】如果我方场上存在【sts116】或【smn112082】，则使其[可用次数]-1，并[舍弃]我方牌库顶的1张卡牌。然后，造成所[舍弃]卡牌的元素骰费用的[草元素伤害]。；[useCnt]')
        .description('【双方选择行动前：】如果我方场上存在【sts116】或【smn112082】，则使其[可用次数]-1，并[舍弃]我方牌库顶的1张卡牌。然后，造成所[舍弃]卡牌的元素骰费用+1的[草元素伤害]。；[useCnt]', 'v4.8.0')
        .addition('dmg', -1).addition('cid').handle((status, event, ver) => {
            const { heros, summons, pile, hcard, combatStatus, talent, cmds } = event;
            if (pile.length == 0 || !hasObjById(combatStatus, 116) && !hasObjById(summons, 112082)) return;
            cmds.discard({ mode: CMD_MODE.TopPileCard });
            if (status.addition.dmg == -1) {
                status.addition.dmg = pile[0].cost + pile[0].anydice + +(ver.lt('v4.8.0'));
                status.addition.cid = pile[0].id;
            }
            cmds.attack(status.addition.dmg, DAMAGE_TYPE.Dendro);
            const isPlace = talent && talent.perCnt > 0 && pile[0].hasSubtype(CARD_SUBTYPE.Place);
            if (talent) {
                cmds.getCard(1, { card: status.addition.cid });
                if (isPlace) cmds.getStatus(117083);
            }
            return {
                triggers: ['action-start', 'action-start-oppo'],
                exec: () => {
                    status.minusUseCnt();
                    const sts116 = combatStatus.get(116);
                    if (sts116) sts116.minusUseCnt();
                    else getObjById(summons, 112082)?.minusUseCnt();
                    const thero = heros.get(getHidById(status.id));
                    if (thero) {
                        const talent = isCdt(hcard?.id == getTalentIdByHid(thero.id), hcard) ?? thero.talentSlot;
                        if (talent && isPlace) talent.minusPerCnt();
                    }
                    status.addition.dmg = -1;
                }
            }
        }),

    117083: () => new StatusBuilder('预算师的技艺（生效中）').combatStatus().icon(STATUS_ICON.Special).useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('我方下次【打出「场地」支援牌时：】少花费2个元素骰。')
        .handle((status, event) => {
            const { hcard, isMinusDiceCard } = event;
            if (!isMinusDiceCard || !hcard?.hasSubtype(CARD_SUBTYPE.Place)) return;
            return { triggers: 'card', minusDiceCard: 2, exec: () => status.minusUseCnt() }
        }),

    117091: () => new StatusBuilder('钩锁链接').heroStatus().roundCnt(2).type(STATUS_TYPE.Usage, STATUS_TYPE.Round).icon('#')
        .description('【敌方受到燃烧或我方其他角色使用特技后：】附属角色获得1点「夜魂值」。；【当「夜魂值」等于2点时：】附属角色附属【sts117094】，随后消耗2点「夜魂值」。；[roundCnt]')
        .handle((status, event) => {
            const { heros, hidx = -1, trigger = '', cmds } = event;
            return {
                triggers: ['other-vehicle', 'Burning-oppo', 'turn-end', 'action-start', 'action-start-oppo'],
                exec: () => {
                    const heroStatus = heros[hidx]?.heroStatus;
                    const nightSoul = heroStatus?.find(s => s.hasType(STATUS_TYPE.NightSoul));
                    if (!nightSoul) return;
                    if (trigger == 'turn-end') {
                        if (status.roundCnt == 1) nightSoul.roundCnt = 0;
                        return;
                    }
                    if (['other-vehicle', 'Burning-oppo'].includes(trigger)) nightSoul.addUseCnt();
                    if (nightSoul.useCnt == 2 && !hasObjById(heroStatus, 117094)) {
                        cmds.getStatus(117094, { hidxs: hidx }).consumeNightSoul(hidx, 2);
                    }
                }
            }
        }),

    117092: nightSoul(),

    117094: () => new StatusBuilder('钩锁准备').heroStatus().useCnt(1).type(STATUS_TYPE.Attack, STATUS_TYPE.Sign).icon('#')
        .description('【我方选择行动前，若附属角色为出战角色：】对最近的敌方角色造成3点[草元素伤害]。；[useCnt]')
        .handle((status, event) => {
            const { heros, hidx = -1, eheros } = event;
            if (!heros[hidx]?.isFront) return;
            return {
                damage: 3,
                element: DAMAGE_TYPE.Dendro,
                hidxs: eheros.getNearestHidx(hidx),
                triggers: 'action-start',
                exec: () => status.minusUseCnt(),
            }
        }),

    117104: () => new StatusBuilder('余薰（生效中）').heroStatus().useCnt(1).type(STATUS_TYPE.Usage).icon(STATUS_ICON.Buff)
        .description('【双方角色使用技能后：】触发1次我方【smn115】的回合结束效果。')
        .handle((status, event) => {
            if (!hasObjById(event.summons, 115)) return;
            event.cmds.summonTrigger(115);
            return {
                triggers: ['after-skill', 'after-other-skill', 'after-skill-oppo'],
                isAddTask: true,
                exec: () => status.minusUseCnt()
            }
        }),

    121012: (useCnt: number = 0) => new StatusBuilder('流萤护罩').combatStatus().useCnt(1 + Math.min(3, useCnt)).type(STATUS_TYPE.Shield)
        .description('为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【smn121011】，则额外提供其[可用次数]的[护盾]。（最多额外提供3点[护盾]）'),

    121013: () => shieldCombatStatus('叛逆的守护', 1, 2),

    121021: () => new StatusBuilder('冰封的炽炎魔女').heroStatus().icon('ski,3').useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【行动阶段开始时：】如果所附属角色生命值不多于4，则移除此效果。；【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。【此效果被移除时：】所附属角色转换为[「焚尽的炽炎魔女」]形态。')
        .handle((status, event) => {
            const { heros, hidx = -1, trigger, cmds } = event;
            const triggers: Trigger[] = ['will-killed', 'skilltype3'];
            if ((heros[hidx]?.hp ?? 10) <= 4) triggers.push('phase-start');
            if (trigger == 'will-killed') cmds.revive(1, hidx);
            cmds.changePattern(hidx, 6301);
            return {
                triggers,
                isAddTask: trigger != 'skilltype3',
                exec: () => {
                    status.minusUseCnt();
                    if (trigger == 'skilltype3') status.minusUseCnt();
                }
            }
        }),

    121022: () => new StatusBuilder('严寒').heroStatus().useCnt(1).type(STATUS_TYPE.Attack)
        .icon('cryo-dice').iconBg(DEBUFF_BG_COLOR)
        .description('【结束阶段：】对所附属角色造成1点[冰元素伤害]。；[useCnt]；所附属角色被附属【sts163011】时，移除此效果。')
        .handle((status, event) => {
            const { trigger, hero } = event;
            if (trigger == 'enter') {
                return {
                    triggers: 'enter',
                    exec: () => {
                        const sts163011 = hero.heroStatus.get(163011);
                        if (sts163011) {
                            sts163011.roundCnt = 0;
                            sts163011.useCnt = 0;
                        }
                    }
                }
            }
            return {
                damage: 1,
                element: DAMAGE_TYPE.Cryo,
                isSelf: true,
                triggers: 'phase-end',
                exec: () => status.minusUseCnt(),
            }
        }),

    121031: () => new StatusBuilder('四迸冰锥').heroStatus().icon(STATUS_ICON.AtkSelf).useCnt(1).type(STATUS_TYPE.Usage)
        .description('【我方角色「普通攻击」时：】对所有敌方后台角色造成1点[穿透伤害]。；[useCnt]')
        .handle(status => ({
            pdmg: 1,
            triggers: 'skilltype1',
            exec: () => status.minusUseCnt(),
        })),

    121034: () => new StatusBuilder('冰晶核心').heroStatus().icon(STATUS_ICON.Revive).useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。')
        .handle((status, event) => {
            const { heros, hidx, cmds } = event;
            cmds.revive(1, hidx);
            if (heros[hidx]?.talentSlot) cmds.getStatus(121022, { isOppo: true });
            return { triggers: 'will-killed', exec: () => status.minusUseCnt() }
        }),

    121042: () => new StatusBuilder('掠袭锐势').heroStatus().icon('ski,2').useCnt(2).type(STATUS_TYPE.Attack)
        .description('【结束阶段：】对所有附属有【sts122】的敌方角色造成1点[穿透伤害]。；[useCnt]')
        .handle((status, event) => ({
            triggers: 'phase-end',
            pdmg: 1,
            hidxs: event.eheros.filter(h => h.heroStatus.has(122)).map(h => h.hidx),
            exec: () => status.minusUseCnt(),
        })),

    122013: () => new StatusBuilder('纯水幻形·蛙').combatStatus().useCnt(1).useCnt(2, 'v4.3.0')
        .type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    122021: (isTalent: boolean = false) => new StatusBuilder('水光破镜').heroStatus().icon(STATUS_ICON.Debuff).roundCnt(2).roundCnt(3, isTalent)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Usage).talent(isTalent)
        .description(`所附属角色切换到其他角色时元素骰费用+1${isTalent ? '，并且会使所附属角色受到的[水元素伤害]+1' : ''}。；[roundCnt]；（同一方场上最多存在一个此状态）`)
        .description(`所附属角色受到的[水元素伤害]+1${isTalent ? '，并且会使所附属角色切换到其他角色时元素骰费用+1' : ''}。；[roundCnt]；（同一方场上最多存在一个此状态）`, 'v4.8.0')
        .handle((status, _, ver) => ({
            addDiceHero: isCdt(ver.gte('v4.8.0') || status.isTalent, 1),
            getDmg: isCdt(ver.lt('v4.8.0') || status.isTalent, 1),
            triggers: ['Hydro-getdmg', 'add-switch-from'],
            onlyOne: true,
        })),

    122031: () => new StatusBuilder('水之新生').heroStatus().icon(STATUS_ICON.Revive).useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。触发此效果后，角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。')
        .handle((status, event) => {
            const { hidx, cmds } = event;
            cmds.revive(4, hidx).getStatus(122037, { hidxs: hidx });
            return { triggers: 'will-killed', exec: () => status.minusUseCnt() }
        }),

    122032: () => readySkillStatus('涟锋旋刃', 22035),

    122033: () => new StatusBuilder('暗流的诅咒').combatStatus().useCnt(2).type(STATUS_TYPE.Usage)
        .icon(STATUS_ICON.DebuffCostSkill)
        .description('【所在阵营的角色使用「元素战技」或「元素爆发」时：】需要多花费1个元素骰。；[useCnt]')
        .handle(status => ({
            triggers: ['skilltype2', 'skilltype3'],
            addDiceSkill: {
                skilltype2: [0, 0, 1],
                skilltype3: [0, 0, 1],
            },
            exec: () => status.minusUseCnt(),
        })),

    122037: () => new StatusBuilder('水之新生·锐势').heroStatus().icon(STATUS_ICON.ElementAtkUp)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant, STATUS_TYPE.Sign)
        .description('角色造成的[物理伤害]变为[水元素伤害]，且[水元素伤害]+1。')
        .handle(() => ({ attachEl: ELEMENT_TYPE.Hydro, addDmg: 1 })),

    122041: () => new StatusBuilder('深噬之域').combatStatus().icon('ski,3').useCnt(0).maxCnt(3).type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('我方[舍弃]或[调和]的卡牌，会被吞噬。；【每吞噬3张牌：】【hro】在回合结束时获得1点额外最大生命\\；如果其中存在原本元素骰费用值相同的牌，则额外获得1点\\；如果3张均相同，再额外获得1点。〔（本回合结束时获得{pct}点）〕')
        .description('我方[舍弃]或[调和]的卡牌，会被吞噬。；【每吞噬3张牌：】【hro】获得1点额外最大生命\\；如果其中存在原本元素骰费用值相同的牌，则额外获得1点\\；如果3张均相同，再额外获得1点。', 'v5.0.0')
        .addition('cost1', -1).addition('cost2', -1).addition('maxDice').addition('maxDiceCnt')
        .handle((status, event, ver) => {
            const { hcard, heros, trigger, cmds } = event;
            if (!hcard) return;
            const triggers: Trigger[] = ['discard', 'reconcile'];
            if (ver.gte('v5.0.0') && status.perCnt != 0) triggers.push('phase-end');
            return {
                triggers,
                isAddTask: true,
                exec: () => {
                    const hero = heros.get(getHidById(status.id));
                    if (!hero) return;
                    if (trigger == 'phase-end') {
                        const cnt = -status.perCnt;
                        status.perCnt = 0;
                        return cmds.getStatus([[122042, cnt]], { hidxs: hero.hidx }).addMaxHp(cnt, hero.hidx);
                    }
                    let cnt = 0;
                    const { cost1, cost2, maxDice } = status.addition;
                    const cost = hcard.cost + hcard.anydice;
                    if (cost > maxDice) {
                        status.addition.maxDice = cost;
                        status.addition.maxDiceCnt = 1;
                    } else if (cost == maxDice) {
                        ++status.addition.maxDiceCnt;
                    }
                    if (status.useCnt < 2) {
                        status.addition[`cost${status.useCnt + 1}`] = cost;
                        status.addUseCnt();
                    } else {
                        ++cnt;
                        if (cost1 == cost2 || cost == cost1 || cost == cost2) ++cnt;
                        if (cost == cost1 && cost == cost2) ++cnt;
                        status.useCnt = 0;
                    }
                    if (cnt > 0) {
                        if (ver.lt('v5.0.0')) {
                            cmds.getStatus([[122042, cnt]], { hidxs: hero.hidx });
                            for (let i = 0; i < cnt; ++i) cmds.addMaxHp(1, hero.hidx, true);
                        }
                        status.perCnt -= cnt;
                    }
                }
            }
        }),

    122042: (cnt: number = 1) => new StatusBuilder('奇异之躯').heroStatus().icon('ski,3')
        .type(STATUS_TYPE.Accumulate).useCnt(cnt).maxCnt(MAX_USE_COUNT)
        .description('每层为【hro】提供1点额外最大生命。'),

    122043: (useCnt: number = 1) => new StatusBuilder('黑色幻影').combatStatus().useCnt(useCnt).type(STATUS_TYPE.Barrier).summonId()
        .description('【我方出战角色受到伤害时：】抵消1点伤害，然后[可用次数]-2。；[useCnt]').barrierUsage(2),

    122052: () => new StatusBuilder('水泡围困').heroStatus().roundCnt(1).icon('#')
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign, STATUS_TYPE.NonAction)
        .description('【角色无法使用技能。】（持续到回合结束）'),

    122053: () => readySkillStatus('水泡封锁（准备中）', 1220512, -122051),

    123011: (isTalent: boolean = false) => new StatusBuilder('潜行').heroStatus().useCnt(2).useCnt(3, isTalent)
        .type(STATUS_TYPE.Barrier, STATUS_TYPE.AddDamage).type(isTalent, STATUS_TYPE.Enchant).talent(isTalent)
        .description(`所附属角色受到的伤害-1，造成的伤害+1。；[useCnt]${isTalent ? '；所附属角色造成的[物理伤害]变为[火元素伤害]。' : ''}`)
        .handle((status, event) => {
            const { restDmg = -1 } = event;
            return {
                addDmg: 1,
                restDmg: isCdt(restDmg > -1, Math.max(0, restDmg - 1)),
                triggers: ['skill', 'reduce-dmg'],
                attachEl: isCdt(status.isTalent, ELEMENT_TYPE.Pyro),
                exec: () => status.minusUseCnt(),
            }
        }),

    123022: () => new StatusBuilder('火之新生').heroStatus().icon(STATUS_ICON.Revive).useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。此效果触发后，此角色造成的[火元素伤害]+1。')
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到3点生命值。', 'v4.6.0')
        .handle((status, event, ver) => {
            const { hidx, cmds } = event;
            cmds.revive(ver.lt('v4.6.0') ? 3 : 4, hidx);
            if (ver.gte('v4.6.0')) cmds.getStatus(123026, { hidxs: hidx });
            return { triggers: 'will-killed', exec: () => status.minusUseCnt() }
        }),

    123024: () => new StatusBuilder('渊火加护').heroStatus().useCnt(2)
        .type(STATUS_TYPE.Shield).type(ver => ver.gte('v4.6.0'), STATUS_TYPE.Attack)
        .description('为所附属角色提供2点[护盾]。此[护盾]耗尽后：对所有敌方角色造成1点[穿透伤害]。')
        .description('为所附属角色提供2点[护盾]。', 'v4.6.0')
        .handle((status, event, ver) => {
            if (status.useCnt > 0 || ver.lt('v4.6.0')) return;
            const { eheros } = event;
            return { triggers: 'status-destroy', pdmg: 1, hidxs: eheros.allHidxs() }
        }),

    123026: () => new StatusBuilder('火之新生·锐势').heroStatus().icon(STATUS_ICON.ElementAtkUp)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('角色造成的[火元素伤害]+1。')
        .handle(() => ({ addDmg: 1 })),

    123032: () => new StatusBuilder('魔蝎祝福').combatStatus().icon('ski,2').useCnt(1).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.AddDamage)
        .description('我方使用【crd123031】的[特技]时：移除此效果，每有1层「魔蝎祝福」，就使此[特技]造成的伤害+1。；[useCnt]')
        .handle((status, event) => {
            if (event.skill?.id != 1230311) return;
            return { triggers: 'vehicle', addDmgCdt: status.useCnt, exec: () => status.dispose() }
        }),

    123033: (useCnt: number = 1) => new StatusBuilder('炎之魔蝎·守势').heroStatus()
        .useCnt(useCnt).type(STATUS_TYPE.Barrier)
        .description('【附属角色受到伤害时：】抵消1点伤害。；[useCnt]'),

    123041: (useCnt: number = 1) => new StatusBuilder('重甲蟹壳').heroStatus().useCnt(useCnt).maxCnt(MAX_USE_COUNT)
        .description('每层提供1点[护盾]，保护所附属角色。').type(STATUS_TYPE.Shield),

    123043: () => readySkillStatus('积蓄烈威', 23046),

    123051: (cnt: number = 1) => new StatusBuilder('忿恨').heroStatus().icon('tmp/UI_Gcg_Buff_TheAbyssXiuhcoatl_S')
        .useCnt(cnt).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.AddDamage)
        .description('每层使所附属角色造成的伤害和「元素爆发」造成的[穿透伤害]+1。（可叠加，没有上限）')
        .handle((status, event) => {
            if (!event.skill?.isHeroSkill) return;
            return { triggers: 'dmg', addDmgCdt: status.useCnt }
        }),

    123052: () => new StatusBuilder('弃置卡牌数').heroStatus().icon(STATUS_ICON.Buff)
        .useCnt(0).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate, STATUS_TYPE.NonDestroy)
        .description('我方每[舍弃]6张卡牌，自身附属1层【sts123051】。；〔目前已弃置{unt}张卡牌。〕')
        .handle((status, event) => ({
            triggers: 'discard',
            exec: () => {
                const cnt = Math.floor((status.useCnt % 6 + 1) / 6);
                if (cnt > 0) event.cmds.getStatus([[123051, cnt]]);
                status.addUseCnt();
            }
        })),

    124011: () => readySkillStatus('猜拳三连击·剪刀', 24015),

    124012: () => readySkillStatus('猜拳三连击·布', 24016),

    124014: () => new StatusBuilder('雷晶核心').heroStatus().icon(STATUS_ICON.Revive).useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到1点生命值。')
        .handle((status, { hidx, cmds }) => (cmds.revive(1, hidx), {
            triggers: 'will-killed',
            exec: () => status.minusUseCnt(),
        })),

    124021: () => new StatusBuilder('雷霆探针').combatStatus().icon('ski,3')
        .type(STATUS_TYPE.Sign, STATUS_TYPE.Usage).iconBg(DEBUFF_BG_COLOR).perCnt(1)
        .description('【所在阵营角色使用技能后：】对所在阵营出战角色附属【sts124022】。（每回合1次）')
        .handle((status, event) => {
            if (status.perCnt <= 0) return;
            event.cmds.getStatus(124022);
            return { triggers: 'skill', exec: () => status.minusPerCnt() }
        }),

    124022: () => new StatusBuilder('雷鸣探知').heroStatus().icon(STATUS_ICON.Debuff).useCnt(1).perCnt(1, 'v4.4.0')
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).notReset()
        .description('【所附属角色受到〖hro〗及其召唤物造成的伤害时：】移除此状态，使此伤害+1。；（同一方场上最多存在一个此状态。【hro】的部分技能，会以所附属角色为目标。）')
        .description('【此状态存在期间，可以触发1次：】所附属角色受到〖hro〗及其召唤物造成的伤害+1。；（同一方场上最多存在一个此状态。【hro】的部分技能，会以所附属角色为目标。）', 'v4.4.0')
        .handle((status, event, ver) => {
            const { skill, isSummon } = event;
            if (getHidById(skill?.id) != getHidById(status.id) && isSummon != 124023) return;
            return {
                triggers: 'getdmg',
                getDmg: 1,
                onlyOne: true,
                exec: () => {
                    if (ver.lt('v4.4.0')) status.minusPerCnt();
                    else status.minusUseCnt();
                }
            }
        }),

    124032: (isTalent: boolean = false, useCnt: number = 2) => new StatusBuilder('原海明珠').heroStatus()
        .type(STATUS_TYPE.Barrier, STATUS_TYPE.Usage).talent(isTalent).useCnt(useCnt).perCnt(1).perCnt(2, isTalent)
        .description(`【所附属角色受到伤害时：】抵消1点伤害。；【每回合${isTalent ? 2 : 1}次：】抵消来自召唤物的伤害时不消耗[可用次数]。；[useCnt]；【我方宣布结束时：】如果所附属角色为「出战角色」，则抓1张牌。`)
        .handle((status, event) => {
            const { restDmg = -1, heros, hidx = -1, isSummon = -1, cmds } = event;
            if (restDmg >= 0) {
                if (restDmg == 0) return { restDmg }
                const smnDmg = isSummon > -1 && status.perCnt > 0;
                return { restDmg: restDmg - 1, exec: () => { smnDmg ? status.minusPerCnt() : status.minusUseCnt() } }
            }
            const hero = heros[hidx];
            if (!hero || !hero.isFront) return;
            cmds.getCard(1);
            return { triggers: 'end-phase', isAddTask: true }
        }),

    124042: (useCnt: number = 0) => new StatusBuilder('雷萤护罩').combatStatus().useCnt(1 + Math.min(3, useCnt)).type(STATUS_TYPE.Shield)
        .description('为我方出战角色提供1点[护盾]。；【创建时：】如果我方场上存在【smn124041】，则额外提供其[可用次数]的[护盾]。（最多额外提供3点[护盾]）'),

    124043: () => readySkillStatus('霆电迸发', 24044),

    124044: () => new StatusBuilder('雷压').combatStatus().icon(STATUS_ICON.Debuff).useCnt(0).maxCnt(3)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('每当我方累积打出3张行动牌，就会触发敌方场上【smn124041】的效果。（使【smn124041】的[可用次数]+1）')
        .handle((status, event) => ({
            triggers: 'card',
            exec: () => {
                const { esummons } = event;
                status.addUseCnt();
                const summon = getObjById(esummons, 124041);
                if (status.useCnt >= 3 && summon && summon.useCnt < 3) {
                    summon.addUseCnt();
                    status.useCnt = 0;
                }
            },
        })),

    124052: (useCnt: number = 0) => new StatusBuilder('雷锥陷阱').combatStatus().icon('ski,2').useCnt(useCnt).maxCnt(3)
        .type(STATUS_TYPE.Attack).iconBg(DEBUFF_BG_COLOR)
        .description('【所在阵营的角色使用技能后：】对所在阵营的出战角色造成2点[雷元素伤害]。；【[可用次数]：初始为创建时所弃置的〖crd124051〗张数。（最多叠加到3）】')
        .handle(status => ({
            damage: 2,
            element: DAMAGE_TYPE.Electro,
            isSelf: true,
            triggers: 'after-skill',
            exec: () => status.minusUseCnt(),
        })),

    124053: () => coolDownStatus('噬骸能量块', 124051),

    124061: () => new StatusBuilder('雷之新生').heroStatus().icon(STATUS_ICON.Revive).useCnt(1).type(STATUS_TYPE.Sign, STATUS_TYPE.NonDefeat)
        .description('【所附属角色被击倒时：】移除此效果，使角色[免于被击倒]，并治疗该角色到4点生命值。此效果触发后，此角色造成的[雷元素伤害]+1。')
        .handle((status, event) => {
            const { hidx = -1, cmds } = event;
            cmds.revive(4, hidx).getStatus(124062, { hidxs: hidx });
            return { triggers: 'will-killed', exec: () => status.minusUseCnt() }
        }),

    124062: () => new StatusBuilder('雷之新生·锐势').heroStatus().icon(STATUS_ICON.ElementAtkUp)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('角色造成的[雷元素伤害]+1。')
        .handle(() => ({ addDmg: 1 })),

    125021: () => new StatusBuilder('坍毁').heroStatus().icon(STATUS_ICON.Debuff).useCnt(1).type(STATUS_TYPE.AddDamage)
        .description('所附属角色受到的[物理伤害]或[风元素伤害]+2。；[useCnt]')
        .handle((status, event) => ({
            triggers: ['Physical-getdmg', 'Anemo-getdmg'],
            getDmg: 2,
            exec: () => {
                const { heros, hidx = -1, eheros, cmds } = event;
                status.minusUseCnt();
                const talent = getObjById(eheros, getHidById(status.id))?.talentSlot;
                if (heros[hidx]?.isFront && status.useCnt == 0 && talent && talent.perCnt > 0) {
                    talent.minusPerCnt();
                    cmds.getStatus(125021, { hidxs: heros.getNextBackHidx() });
                }
            }
        })),

    125022: () => readySkillStatus('风龙吐息', 25025, -1),

    125023: () => readySkillStatus('风龙吐息', 25026, -1),

    125032: () => new StatusBuilder('亡风啸卷（生效中）').combatStatus().icon(STATUS_ICON.Special).roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign)
        .description('【本回合中我方下次切换角色后】：生成1个出战角色类型的元素骰。')
        .handle((status, event) => ({
            triggers: 'switch-from',
            isAddTask: true,
            exec: () => {
                status.dispose();
                event.cmds.getDice(1, { mode: CMD_MODE.FrontHero });
            }
        })),

    126011: () => new StatusBuilder('岩盔').heroStatus().useCnt(3).type(STATUS_TYPE.Barrier)
        .description('【所附属角色受到伤害时：】抵消1点伤害。；抵消[岩元素伤害]时，需额外消耗1次[可用次数]。；[useCnt]')
        .handle((status, event) => {
            const { restDmg = -1, dmgElement, heros, hidx = -1 } = event;
            if (restDmg <= 0) return { restDmg }
            return {
                restDmg: restDmg - 1,
                exec: () => {
                    status.minusUseCnt();
                    if (status.useCnt > 0 && dmgElement == DAMAGE_TYPE.Geo) status.minusUseCnt();
                    if (status.useCnt == 0) getObjById(heros[hidx]?.heroStatus, 126012)?.dispose();
                }
            }
        }),

    126012: () => new StatusBuilder('坚岩之力').heroStatus().icon(STATUS_ICON.ElementAtkUp).perCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Enchant, STATUS_TYPE.Sign)
        .description('角色造成的[物理伤害]变为[岩元素伤害]。；【每回合1次：】角色造成的伤害+1。；【角色所附属的〖sts126011〗被移除后：】也移除此状态。')
        .handle(status => ({
            addDmg: status.perCnt,
            triggers: 'skill',
            attachEl: ELEMENT_TYPE.Geo,
            exec: () => status.perCnt > 0 && status.minusPerCnt(),
        })),

    126021: () => new StatusBuilder('磐岩百相·元素汲取').heroStatus().icon(STATUS_ICON.Buff).useCnt(0).maxCnt(4)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate, STATUS_TYPE.NonDestroy)
        .description('角色可以汲取‹1冰›/‹2水›/‹3火›/‹4雷›元素的力量，然后根据所汲取的元素类型，获得技能‹1【rsk66013】›/‹2【rsk66023】›/‹3【rsk66033】›/‹4【rsk66043】›。（角色同时只能汲取一种元素，此状态会记录角色已汲取过的元素类型数量）；【角色汲取了一种和当前不同的元素后：】生成1个所汲取元素类型的元素骰。')
        .handle((status, event) => {
            const { heros, hidx = -1, skill, trigger = '', cmds } = event;
            const hero = heros[hidx];
            if (!hero) return;
            const triggers: Trigger[] = [];
            const sts126022 = getObjById(hero.heroStatus, 126022);
            if (sts126022) triggers.push('Cryo-getdmg', 'Hydro-getdmg', 'Pyro-getdmg', 'Electro-getdmg');
            const isSkill = skill?.id == 26022 && trigger.startsWith('elReaction-Geo:');
            if (isSkill) triggers.push('elReaction-Geo');
            return {
                triggers,
                exec: () => {
                    const curElCode = hero.UI.srcs.indexOf(hero.UI.src);
                    const drawElCode = isSkill ?
                        ELEMENT_CODE[ELEMENT_TYPE[trigger.split(':')[1] as ElementType]] :
                        ELEMENT_CODE[ELEMENT_TYPE[trigger.split('-')[0] as ElementType]];
                    if (drawElCode == curElCode) {
                        if (isSkill) return cmds.getStatus(126022, { hidxs: hidx });
                        return;
                    }
                    if (sts126022 && trigger.endsWith('getdmg')) sts126022.minusUseCnt();
                    const isDrawed = status.perCnt != 0;
                    hero.UI.src = hero.UI.srcs[drawElCode];
                    // const oels = status.perCnt;
                    let els = -status.perCnt;
                    if ((els >> drawElCode - 1 & 1) == 0) {
                        els |= 1 << drawElCode - 1;
                        status.addUseCnt();
                        status.perCnt = -els;
                    }
                    cmds.getDice(1, { element: ELEMENT_CODE_KEY[drawElCode] });
                    // if (oels == status.perCnt) cmds.getStatus(126022, { hidxs: hidx });
                    if (isDrawed) cmds.loseSkill(hidx, 2);
                    cmds.getSkill(hidx, 66003 + drawElCode * 10, 2);
                }
            }
        }),

    126022: () => new StatusBuilder('磐岩百相·元素凝晶').heroStatus().icon('ski,1').useCnt(1).type(STATUS_TYPE.Sign)
        .explains('rsk66013', 'rsk66023', 'rsk66033', 'rsk66043')
        .description('【角色受到‹1冰›/‹2水›/‹3火›/‹4雷›元素伤害后：】如果角色当前未汲取该元素的力量，则移除此状态，然后角色[汲取对应元素的力量]。'),

    126031: (isTalent: boolean = false, ucnt: number = 1) => new StatusBuilder('黄金侵蚀').heroStatus().useCnt(ucnt).maxCnt(isTalent ? 5 : 3)
        .icon(STATUS_ICON.Dot).type(STATUS_TYPE.Attack)
        .description('【结束阶段：】如果所附属角色位于后台，则此效果每有1次[可用次数]，就对所附属角色造成1点[穿透伤害]。；【[可用次数]：{useCnt}】（可叠加，最多叠加到3次）')
        .handle((status, event) => {
            const { heros, hidx = -1, eheros } = event;
            const isTalent = getObjById(eheros, getHidById(status.id))?.talentSlot;
            if (heros[hidx]?.isFront && !isTalent) return;
            return {
                triggers: 'phase-end',
                pdmg: status.useCnt,
                hidxs: hidx,
                isSelf: true,
                exec: () => status.minusUseCnt()
            }
        }),

    127011: () => new StatusBuilder('活化激能').heroStatus().useCnt(0).maxCnt(3).type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate).icon('#')
        .description('【本角色造成或受到元素伤害后：】累积1层「活化激能」。（最多累积3层）；【结束阶段：】如果「活化激能」层数已达到上限，就将其清空。同时，角色失去所有[充能]。')
        .handle((status, event) => {
            const { trigger, heros, hidx = -1, cmds } = event;
            const triggers: Trigger[] = ['skilltype3'];
            const hero = heros[hidx];
            if (!hero) return;
            const maxCnt = status.maxCnt + +!!hero.talentSlot;
            if (status.useCnt == maxCnt) triggers.push('phase-end');
            else triggers.push('el-dmg', 'el-getdmg');
            return {
                triggers,
                isAddTask: trigger == 'phase-end',
                exec: () => {
                    if (trigger == 'skilltype3') {
                        status.useCnt = 0;
                        return;
                    }
                    if (trigger == 'phase-end') {
                        status.useCnt = 0;
                        return cmds.getEnergy(-hero.energy, { hidxs: hidx });
                    }
                    if (status.useCnt < maxCnt) status.addUseCnt(true);
                },
            }
        }),

    127026: (useCnt: number = 1) => new StatusBuilder('绿洲之滋养').combatStatus().icon('ski,1')
        .type(STATUS_TYPE.Usage).useCnt(useCnt).maxCnt(3)
        .description('【我方打出〖crd127021〗时：】少花费1个元素骰。；[useCnt]')
        .handle((status, event) => {
            const { hcard, isMinusDiceCard } = event;
            if (!isMinusDiceCard || hcard?.id != 127021) return;
            return { triggers: 'card', minusDiceCard: 1, exec: () => status.minusUseCnt() }
        }),

    127027: () => new StatusBuilder('重燃的绿洲之心').heroStatus().icon('ski,2')
        .type(STATUS_TYPE.Attack, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('所附属角色造成的伤害+3。；【所附属角色使用技能后：】移除我方场上的【sts127026】，每移除1层就治疗所附属角色1点。')
        .handle((_, event) => {
            const sts127026 = event.combatStatus.get(127026);
            return {
                triggers: 'after-skill',
                addDmg: 3,
                heal: sts127026?.useCnt,
                exec: () => sts127026?.dispose(),
            }
        }),

    127028: () => shieldHeroStatus('绿洲之庇护', 1).useCnt(2, 'v5.1.0')
        .description('提供2点[护盾]，保护所附属角色。', 'v5.1.0'),

    127029: () => new StatusBuilder('绿洲之心').combatStatus().icon('ski,2').useCnt(0).maxCnt(4)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate)
        .description('我方召唤4个【smn127022】后，我方【hro】附属【sts127027】，并获得1点[护盾]。')
        .description('我方召唤4个【smn127022】后，我方【hro】附属【sts127027】，并获得2点[护盾]。', 'v5.1.0')
        .handle((status, event) => {
            const { hcard, heros, summons, cmds } = event;
            if (summons.length == MAX_SUMMON_COUNT || (hcard?.id != 127021 && status.useCnt < 4)) return;
            return {
                triggers: ['card', 'discard'],
                exec: () => {
                    status.addUseCnt(+!!(hcard?.id == 127021));
                    if (status.useCnt < 4) return;
                    status.dispose();
                    cmds.getStatus([127027, 127028], { hidxs: getObjById(heros, getHidById(status.id))?.hidx });
                }
            }
        }),

    127033: () => new StatusBuilder('灵蛇祝福').combatStatus().icon('ski,2').useCnt(1).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.AddDamage)
        .description('我方使用【crd127032】的[特技]时：此[特技]造成的伤害+1，并且不消耗【crd127032】的[可用次数]。；[useCnt]')
        .handle((status, event) => {
            if (event.skill?.id != 1270321) return;
            return { triggers: 'vehicle', addDmgCdt: 1, exec: () => status.minusUseCnt() }
        }),

    127041: () => new StatusBuilder('食足力增').heroStatus().icon(STATUS_ICON.Buff).useCnt(1).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.AddDamage)
        .description('每层使自身下次造成的伤害+1。（可叠加，没有上限，每次最多生效2层）')
        .description('自身下次造成的伤害+1。（可叠加，没有上限）', 'v6.0.0')
        .handle((status, _, ver) => {
            const addDmg = ver.lt('v6.0.0') ? 1 : Math.min(2, status.useCnt);
            return { triggers: 'skill', addDmg, exec: () => status.minusUseCnt(addDmg) }
        }),

    127042: () => new StatusBuilder('食足体健').heroStatus().icon(STATUS_ICON.Buff).useCnt(1).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.Barrier)
        .description('自身下次受到的伤害-1。（可叠加，没有上限）').barrierCnt(1),

    163011: () => new StatusBuilder('炽热').heroStatus().useCnt(1).type(STATUS_TYPE.Attack)
        .icon('pyro-dice').iconBg(DEBUFF_BG_COLOR)
        .description('【结束阶段：】对所附属角色造成1点[火元素伤害]。；[useCnt]；所附属角色被附属【sts121022】时，移除此效果。')
        .handle((status, event) => {
            const { trigger, heros, hidx = -1 } = event;
            if (trigger == 'enter') {
                return {
                    triggers: 'enter',
                    exec: () => {
                        const sts121022 = getObjById(heros[hidx]?.heroStatus, 121022);
                        if (sts121022) {
                            sts121022.roundCnt = 0;
                            sts121022.useCnt = 0;
                        }
                    }
                }
            }
            return {
                damage: 1,
                element: DAMAGE_TYPE.Pyro,
                isSelf: true,
                triggers: 'phase-end',
                exec: () => status.minusUseCnt(),
            }
        }),

    211142: () => new StatusBuilder('五重天的寒雨（生效中）').combatStatus().useCnt(2)
        .icon(STATUS_ICON.AtkUp).type(STATUS_TYPE.AddDamage)
        .description('我方下次造成的[水元素伤害]和[火元素伤害]+1。；[useCnt]')
        .handle(status => ({ triggers: ['Hydro-dmg', 'Pyro-dmg'], addDmgCdt: 1, exec: () => status.minusUseCnt() })),

    216113: () => hero1611sts2(ELEMENT_TYPE.Geo),

    216114: () => hero1611sts2(ELEMENT_TYPE.Hydro),

    216115: () => hero1611sts2(ELEMENT_TYPE.Pyro),

    216116: () => hero1611sts2(ELEMENT_TYPE.Cryo),

    216117: () => hero1611sts2(ELEMENT_TYPE.Electro),

    223052: () => new StatusBuilder('罔极盛怒（生效中）').heroStatus().icon(STATUS_ICON.Buff)
        .useCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign)
        .description('所附属角色下次造成的伤害+1。')
        .handle((status, event) => {
            if (!event.skill?.isHeroSkill) return;
            return { triggers: 'dmg', addDmgCdt: 1, exec: () => status.minusUseCnt() }
        }),

    300001: () => new StatusBuilder('旧时庭园（生效中）').combatStatus().icon(STATUS_ICON.Buff).roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(330001)
        .description('本回合中，我方下次打出「武器」或「圣遗物」装备牌时少花费2个元素骰。')
        .handle((status, event) => {
            const { isMinusDiceWeapon, isMinusDiceRelic } = event;
            if (!isMinusDiceWeapon && !isMinusDiceRelic) return;
            return {
                minusDiceCard: 2,
                triggers: 'card',
                exec: () => status.dispose(),
            }
        }),

    300002: () => new StatusBuilder('自由的新风（生效中）').combatStatus().roundCnt(1).icon(STATUS_ICON.Special)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(330004)
        .description('【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；[useCnt]')
        .handle(continuousActionHandle),

    300003: () => new StatusBuilder('裁定之时（生效中）').combatStatus()
        .useCnt(3).roundCnt(1).type(STATUS_TYPE.NonEvent).from(330006)
        .description('本回合中，我方打出的事件牌无效。；[useCnt]'),

    300004: () => new StatusBuilder('抗争之日·碎梦之时（生效中）').heroStatus()
        .useCnt(4).roundCnt(1).type(STATUS_TYPE.Barrier).from(330007)
        .description('本回合中，所附属角色受到的伤害-1。；[useCnt]'),

    300005: () => new StatusBuilder('赦免宣告（生效中）').heroStatus().icon(STATUS_ICON.Buff).roundCnt(2).roundCnt(1, 'v5.8.0')
        .type(STATUS_TYPE.Round, STATUS_TYPE.Usage).type(ver => ver.lt('v5.8.0'), STATUS_TYPE.Sign).from(330009)
        .description('所附属角色免疫冻结、眩晕、石化等无法使用技能的效果，并且该角色为「出战角色」时不会因效果而切换。；[roundCnt]')
        .description('本回合中，所附属角色免疫冻结、眩晕、石化等无法使用技能的效果，并且该角色为「出战角色」时不会因效果而切换。', 'v5.8.0')
        .handle((_, event) => {
            const { hidx = -1, sourceStatus, sourceHidx } = event;
            if (hidx != sourceHidx || !sourceStatus?.hasType(STATUS_TYPE.NonAction)) return;
            return { triggers: 'pre-get-status', isInvalid: true }
        }),

    300007: () => new StatusBuilder('斗争之火（生效中）').heroStatus().icon(STATUS_ICON.AtkUp).roundCnt(1)
        .type(STATUS_TYPE.AddDamage).from(300006)
        .description('本回合中出战角色造成的伤害+1。')
        .handle(() => ({ triggers: 'skill', addDmg: 1 })),

    301018: () => new StatusBuilder('严格禁令').combatStatus()
        .useCnt(1).roundCnt(1).type(STATUS_TYPE.NonEvent).from(321018)
        .description('本回合中，所在阵营打出的事件牌无效。；[useCnt]'),

    301019: () => new StatusBuilder('悠远雷暴').heroStatus().useCnt(1)
        .type(STATUS_TYPE.Attack).icon(STATUS_ICON.Dot).from(321019)
        .description('【结束阶段：】对所附属角色造成2点[穿透伤害]。；[useCnt]')
        .handle((status, event) => ({
            triggers: 'phase-end',
            pdmg: 2,
            hidxs: event.hidx,
            isSelf: true,
            exec: () => status.minusUseCnt(),
        })),

    301021: () => coolDownStatus('禁忌知识', 301020),

    301022: () => new StatusBuilder('赤王陵（生效中）').combatStatus()
        .icon(STATUS_ICON.Debuff).roundCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(321020)
        .description('直到本回合结束前，所在阵营每抓1张牌，就立刻生成1张【crd301020】，随机地置入我方牌库中。')
        .handle((_, { cmds }) => ({
            triggers: 'drawcard',
            isAddTask: true,
            exec: () => cmds.addCard(1, 301020),
        })),

    301023: () => new StatusBuilder('圣火竞技场（生效中）').heroStatus()
        .icon(STATUS_ICON.AtkUp).roundCnt(2).type(STATUS_TYPE.AddDamage).from(321022)
        .description('角色造成的伤害+1。；[roundCnt]')
        .handle(() => ({ addDmg: 1 })),

    301024: (cnt: number = 1) => new StatusBuilder('「花羽会」（生效中）').heroStatus().useCnt(cnt).maxCnt(MAX_USE_COUNT)
        .icon(STATUS_ICON.Special).type(STATUS_TYPE.Usage).from(321026)
        .description('下次切换至前台时，回复1个对应元素的骰子。（可叠加，每次触发一层）')
        .handle((status, event) => {
            const { heros, hidx = -1, cmds } = event;
            cmds.getDice(1, { element: heros[hidx]?.element });
            return {
                triggers: 'switch-to',
                isAddTask: true,
                exec: () => status.minusUseCnt()
            }
        }),

    301025: (cnt: number) => new StatusBuilder('锻炼').heroStatus().useCnt(cnt).maxCnt(5)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.AddDamage).from(321028)
        .description('自身层数到达3时，治疗所附属角色1点\\；若自身层数等于5，则所附属角色造成的伤害+1。（可叠加，最多叠加到5层）')
        .handle((status, event) => {
            if (!event.skill?.isHeroSkill || status.useCnt < 5) return;
            return { triggers: 'dmg', addDmgCdt: 1 }
        }),

    301032: () => new StatusBuilder('星轨王城（生效中）').combatStatus().useCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(321030)
        .description('下次打出【crd301033】时少花费1个元素骰。')
        .handle((status, event) => {
            const { hcard, isMinusDiceCard } = event;
            if (!isMinusDiceCard || hcard?.id != 301033) return;
            return { triggers: 'card', minusDiceCard: 1, exec: () => status.dispose() }
        }),

    301037: () => new StatusBuilder('星轨王城（生效中）').combatStatus().useCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(321030)
        .description('下次打出的【crd301033】效果量+1。')
        .handle((status, event) => {
            const { sourceSummon } = event;
            if (!sourceSummon || sourceSummon.id != 301028) return;
            ++sourceSummon.damage;
            return { triggers: 'summon-generate', exec: () => status.dispose() }
        }),

    301101: (useCnt: number) => new StatusBuilder('千岩之护').heroStatus()
        .useCnt(useCnt).type(STATUS_TYPE.Shield).from(311402)
        .description('根据「璃月」角色的数量提供[护盾]，保护所附属角色。'),

    301102: () => new StatusBuilder('千年的大乐章·别离之歌').combatStatus()
        .icon(STATUS_ICON.AtkUp).roundCnt(2).from(311205)
        .description('我方角色造成的伤害+1。；[roundCnt]')
        .type(STATUS_TYPE.Round, STATUS_TYPE.AddDamage)
        .handle(() => ({ addDmg: 1 })),

    301103: (name: string) => senlin1Status(name).from(311206),

    301104: (name: string) => senlin1Status(name).from(311406),

    301105: () => card311306sts('沙海守望·主动出击'),

    301106: () => card311306sts('沙海守望·攻势防御'),

    301107: (name: string) => senlin2Status(name).from(311507),

    301108: () => new StatusBuilder('万世的浪涛').heroStatus().icon(STATUS_ICON.AtkUp).roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(311108)
        .description('角色在本回合中，下次造成的伤害+2。')
        .handle(status => ({ addDmg: 2, triggers: 'skill', exec: () => status.dispose() })),

    301109: (name: string) => senlin2Status(name).from(311307),

    301111: () => new StatusBuilder('金流监督（生效中）').heroStatus().icon(STATUS_ICON.AtkUp)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).roundCnt(1).from(311109)
        .description('本回合中，角色下一次「普通攻击」少花费1个[无色元素骰]，且造成的伤害+1。')
        .handle(status => ({
            triggers: 'skilltype1',
            addDmgType1: 1,
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => status.dispose(),
        })),

    301112: () => new StatusBuilder('纯水流华（生效中）').heroStatus().icon(STATUS_ICON.AtkUp).useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(311110)
        .description('所附属角色下次造成的伤害+1。')
        .handle(status => ({ triggers: 'skill', addDmg: 1, exec: () => status.minusUseCnt() })),

    301201: () => shieldHeroStatus('重嶂不移').from(312009),

    301203: () => new StatusBuilder('辰砂往生录（生效中）').heroStatus().icon(STATUS_ICON.AtkUp).roundCnt(1)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(312012)
        .description('本回合中，角色「普通攻击」造成的伤害+1。')
        .handle(() => ({ addDmgType1: 1 })),

    301204: () => new StatusBuilder('指挥的礼帽（生效中）').heroStatus().icon(STATUS_ICON.Buff).useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(312030)
        .description('【所附属角色下次使用技能或打出「天赋」时：】少花费1个元素骰。；[useCnt]')
        .handle((status, event) => {
            const { trigger, isMinusDiceSkill, isMinusDiceTalent } = event;
            return {
                minusDiceSkill: { skill: [0, 0, 1] },
                minusDiceCard: isCdt(isMinusDiceTalent, 1),
                triggers: ['card', 'skill'],
                exec: () => {
                    if (trigger == 'card' && isMinusDiceTalent || trigger == 'skill' && isMinusDiceSkill) {
                        status.minusUseCnt();
                    }
                },
            }
        }),

    301205: () => new StatusBuilder('诸圣的礼冠（生效中）').heroStatus().icon(STATUS_ICON.Buff).useCnt(1)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(312033)
        .description('所附属角色下次造成的伤害或特技伤害+1。')
        .handle(status => ({ addDmgCdt: 1, triggers: ['skill', 'vehicle'], exec: () => status.minusUseCnt() })),

    301206: () => new StatusBuilder('失冕的宝冠（生效中）').heroStatus().icon(STATUS_ICON.Debuff)
        .useCnt(1).maxCnt(MAX_USE_COUNT).type(STATUS_TYPE.AddDamage).from(312035)
        .description('每层使所附属角色下次受到的伤害+1。（可叠加，没有上限）')
        .handle(status => ({ triggers: 'getdmg', getDmg: status.useCnt, exec: () => status.dispose() })),

    301207: () => new StatusBuilder('谐律异想断章（生效中）').combatStatus().icon(STATUS_ICON.Buff)
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(312039)
        .description('角色使用技能时少花费1个元素骰。')
        .handle((status, event) => ({
            triggers: 'skill',
            minusDiceSkill: { skill: [0, 0, 1] },
            exec: () => { event.isMinusDiceSkill && status.dispose() },
        })),

    301208: () => new StatusBuilder('宗室面具（生效中）').heroStatus().icon(STATUS_ICON.Buff)
        .roundCnt(1).type(STATUS_TYPE.Round, STATUS_TYPE.Sign, STATUS_TYPE.AddDamage).from(312037)
        .description('本回合内，所附属角色造成的伤害+1。')
        .handle(() => ({ addDmg: 1 })),

    301209: () => new StatusBuilder('紫晶的花冠（生效中）').combatStatus().icon(STATUS_ICON.Buff).useCnt(1)
        .roundCnt(1).type(STATUS_TYPE.Round, STATUS_TYPE.Sign, STATUS_TYPE.AddDamage).from(312027)
        .description('本回合内下次我方引发元素反应时伤害额外+2。')
        .handle((status, event) => {
            if (!event.hasDmg) return;
            return { triggers: 'elReaction', addDmgCdt: 2, exec: () => status.minusUseCnt() }
        }),

    301301: () => shieldHeroStatus('掘进的收获').from(313004),

    301302: () => new StatusBuilder('目标').heroStatus().useCnt(1)
        .icon(STATUS_ICON.Debuff).type(STATUS_TYPE.Usage).from(313006)
        .description('【敌方附属有〖crd313006〗的角色切换至前台时：】自身减少1层效果。'),

    301303: () => readySkillStatus('突角龙（生效中）', SKILL_TYPE.Normal, -1,
        ({ cmds }) => cmds.getStatus(301305)).icon('#').from(313008),

    301304: () => shieldHeroStatus('浪船').from(313007),

    301305: () => readySkillStatus('突角龙（生效中）', SKILL_TYPE.Normal, -1).icon('#').from(313008),

    301306: () => new StatusBuilder('呀——！').combatStatus().icon('#').iconBg(STATUS_BG_COLOR.Physical)
        .type(STATUS_TYPE.Attack, STATUS_TYPE.Usage).useCnt(1).from(313009)
        .description('【我方打出特技牌时：】若本局游戏我方累计打出了6张【特技牌】，我方出战角色获得3点[护盾]，然后造成3点[物理伤害]。')
        .handle((status, event) => {
            const { playerInfo: { usedVehcileCnt = 0 }, cmds } = event;
            if (usedVehcileCnt > 0) status.useCnt = usedVehcileCnt;
            if (usedVehcileCnt < 6) return;
            cmds.getStatus(301307);
            return {
                triggers: ['enter', 'card'],
                damage: 3,
                element: DAMAGE_TYPE.Physical,
                exec: () => status.dispose(),
            }
        }),

    301307: () => shieldHeroStatus('龙伙伴的声援！', 3).from(301306),

    301308: () => new StatusBuilder('龙伙伴的鼓舞！').combatStatus().icon(STATUS_ICON.Buff).useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(313009)
        .description('我方下次打出【特技牌】少花费2个元素骰。')
        .handle((status, event) => {
            const { isMinusDiceVehicle } = event;
            if (!isMinusDiceVehicle) return;
            return {
                minusDiceCard: 2,
                triggers: 'card',
                exec: () => status.minusUseCnt()
            }
        }),

    302021: () => new StatusBuilder('大梦的曲调（生效中）').combatStatus().icon(STATUS_ICON.Buff).useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(332021)
        .description('【我方下次打出「武器」或「圣遗物」手牌时：】少花费1个元素骰。')
        .handle((status, event) => {
            const { isMinusDiceWeapon, isMinusDiceRelic } = event;
            if (!isMinusDiceWeapon && !isMinusDiceRelic) return;
            return {
                minusDiceCard: 1,
                triggers: 'card',
                exec: () => status.minusUseCnt(),
            }
        }),

    302204: () => new StatusBuilder('「清洁工作」（生效中）').combatStatus().icon(STATUS_ICON.AtkUp).useCnt(1).maxCnt(2)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage).from(302203)
        .description('我方出战角色下次造成的伤害+1。；（可叠加，最多叠加到+2）')
        .handle(status => ({ triggers: 'skill', addDmg: status.useCnt, exec: () => status.dispose() })),

    302205: () => new StatusBuilder('沙与梦').heroStatus().useCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage).from(322022)
        .description('【对角色打出「天赋」或角色使用技能时：】少花费3个元素骰。；[useCnt]')
        .handle((status, event) => {
            if (status.useCnt <= 0) return;
            const { trigger, isMinusDiceSkill, isMinusDiceTalent } = event;
            return {
                minusDiceSkill: { skill: [0, 0, 3] },
                minusDiceCard: isCdt(isMinusDiceTalent, 3),
                triggers: ['card', 'skill'],
                exec: () => {
                    if (trigger == 'card' && isMinusDiceTalent || trigger == 'skill' && isMinusDiceSkill) {
                        status.minusUseCnt();
                    }
                },
            }
        }),

    302216: () => new StatusBuilder('托皮娅的心意').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon('#').from(302214)
        .description('本回合打出手牌后，随机[舍弃]1张牌或抓1张牌。')
        .handle((_, event) => {
            const { isSelfRound, cmds, randomInt } = event;
            const triggers: Trigger[] = ['card'];
            if (isSelfRound) triggers.push('enter');
            return {
                triggers,
                isAddTask: true,
                notPreview: true,
                exec: () => {
                    if (randomInt()) cmds.getCard(1);
                    else cmds.discard({ mode: CMD_MODE.Random });
                }
            }
        }),

    302217: () => new StatusBuilder('卢蒂妮的心意').combatStatus().useCnt(2)
        .type(STATUS_TYPE.Attack).icon('#').from(302215)
        .description('【我方角色使用技能后：】受到2点治疗或2点[穿透伤害]。；[useCnt]')
        .handle((status, event) => {
            const { hidx = -1, randomInt } = event;
            const res = [{ heal: 2 }, { pdmg: 2, isSelf: true, hidxs: hidx }][randomInt!()];
            return {
                triggers: 'after-skill',
                notPreview: true,
                ...res,
                exec: () => status.minusUseCnt(),
            }
        }),

    302219: () => new StatusBuilder('希洛娜的心意').combatStatus().useCnt(3)
        .type(STATUS_TYPE.Round).icon('#').from(302216)
        .description('将1张美露莘看好的超棒事件牌加入手牌。；[useCnt]')
        .handle((status, event) => ({
            triggers: 'phase-end',
            isAddTask: true,
            exec: () => {
                status.minusUseCnt();
                event.cmds.getCard(1, {
                    subtype: CARD_SUBTYPE.ElementResonance,
                    cardTag: CARD_TAG.LocalResonance,
                    exclude: [331101, 331201, 331331, 331401, 331501, 331601, 331701, 332015, 332016],
                });
            }
        })),

    302303: () => new StatusBuilder('红羽团扇（生效中）').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(323003)
        .description('本回合中，我方执行的下次「切换角色」行动视为「[快速行动]」而非「[战斗行动]」，并且少花费1个元素骰。')
        .handle((status, event) => {
            const { isQuickAction, switchHeroDiceCnt = 0 } = event;
            if (switchHeroDiceCnt == 0 && isQuickAction) return;
            return {
                minusDiceHero: 1,
                isQuickAction: true,
                triggers: 'minus-switch',
                exec: () => status.dispose(),
            }
        }),

    303112: () => new StatusBuilder('元素共鸣：粉碎之冰（生效中）').heroStatus().icon(STATUS_ICON.Buff)
        .roundCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(331102)
        .description('本回合中，我方当前出战角色下一次造成的伤害+2。')
        .handle(status => ({ addDmg: 2, triggers: 'skill', exec: () => status.dispose() })),

    303132: () => new StatusBuilder('元素共鸣：热诚之火（生效中）').heroStatus().icon(STATUS_ICON.Buff)
        .roundCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(331302)
        .description('本回合中，我方当前出战角色下一次引发[火元素相关反应]时，造成的伤害+3。')
        .handle((status, event) => ({
            addDmgCdt: 3,
            triggers: isCdt(event.skill?.isHeroSkill, 'elReaction-Pyro'),
            exec: () => status.dispose(),
        })),

    303133: () => new StatusBuilder('元素共鸣：迅捷之风（生效中）').combatStatus().icon(STATUS_ICON.Buff)
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(331502)
        .description('【我方下次执行「切换角色」行动时：】少花费1个元素骰。')
        .handle((status, event) => {
            const { switchHeroDiceCnt = 0 } = event;
            if (switchHeroDiceCnt == 0) return;
            return {
                minusDiceHero: 1,
                triggers: 'minus-switch',
                exec: () => status.minusUseCnt()
            }
        }),

    303134: () => new StatusBuilder('元素共鸣：迅捷之风（生效中）').combatStatus().icon(STATUS_ICON.AtkUp)
        .useCnt(1).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(331502)
        .description('我方下次触发扩散反应时对目标以外的所有敌方角色造成的伤害+1。')
        .handle((status, event) => ({
            triggers: 'dmg-Swirl',
            addDmgCdt: 1,
            exec: () => { event.isSwirlExec && status.minusUseCnt() },
        })),

    303136: () => new StatusBuilder('元素共鸣：迅捷之风（生效中）').combatStatus().icon(STATUS_ICON.Buff)
        .useCnt(1).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(331502)
        .description('【我方下次执行「切换角色」行动时：】将此次切换视为「[快速行动]」而非「[战斗行动]」。')
        .handle((status, event) => {
            if (event.isQuickAction) return;
            return {
                isQuickAction: true,
                triggers: 'minus-switch-from',
                exec: () => status.minusUseCnt()
            }
        }),

    303162: () => new StatusBuilder('护盾').name('元素共鸣：坚定之岩（生效中）', 'v5.5.0').combatStatus().useCnt(3)
        .type(ver => ver.gte('v5.5.0'), STATUS_TYPE.Shield).icon(STATUS_ICON.Buff, 'v5.5.0').from(331602)
        .type(ver => ver.lt('v5.5.0'), STATUS_TYPE.Usage, STATUS_TYPE.Sign).useCnt(1, 'v5.5.0').roundCnt(1, 'v5.5.0')
        .description('为我方出战角色提供3点[护盾]。')
        .description('【本回合中，我方角色下一次造成[岩元素伤害]后：】如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充3点[护盾]。', 'v5.5.0')
        .handle((status, event, ver) => {
            if (ver.gte('v5.5.0')) return;
            return {
                triggers: 'Geo-dmg',
                isAddTask: true,
                exec: () => {
                    const shieldStatus = event.combatStatus.get(STATUS_TYPE.Shield);
                    if (shieldStatus && event.skill?.isHeroSkill) {
                        shieldStatus.addUseCnt(3, true);
                        status.minusUseCnt();
                    }
                }
            }
        }),

    303172: () => new StatusBuilder('元素共鸣：蔓生之草（生效中）').combatStatus().useCnt(1).roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(331702)
        .description('本回合中，我方下一次引发元素反应时，造成的伤害+2。')
        .handle(status => ({
            addDmgCdt: 2,
            triggers: ['elReaction', 'other-elReaction'],
            exec: () => status.minusUseCnt(),
        })),

    303181: () => new StatusBuilder('风与自由（生效中）').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).icon(STATUS_ICON.Special, 'v4.1.0').from(331801)
        .description('【本回合中，我方角色使用技能后：】将下一个我方后台角色切换到场上。')
        .description('【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；[useCnt]', 'v4.1.0')
        .handle((status, event, ver) => {
            if (ver.lt('v4.1.0') && !ver.isOffline) return continuousActionHandle(status, event);
            event.cmds.switchAfter();
            return { triggers: 'skill', exec: () => status.dispose() }
        }),

    303182: () => new StatusBuilder('岩与契约（生效中）').combatStatus().useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Special).from(331802)
        .description('【下回合行动阶段开始时：】生成3点[万能元素骰]，并抓1张牌。')
        .handle((status, { cmds }) => ({
            triggers: 'phase-start',
            isAddTask: true,
            exec: () => {
                status.minusUseCnt();
                cmds.getDice(3, { element: DICE_COST_TYPE.Omni }).getCard(1);
            },
        })),

    303202: () => new StatusBuilder('换班时间（生效中）').combatStatus().useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(332002)
        .description('【我方下次执行「切换角色」行动时：】少花费1个元素骰。')
        .handle((status, event) => {
            const { switchHeroDiceCnt = 0 } = event;
            if (switchHeroDiceCnt == 0) return;
            return {
                minusDiceHero: 1,
                triggers: 'minus-switch',
                exec: () => status.minusUseCnt()
            }
        }),

    303205: () => coolDownStatus('本大爷还没有输！', 332005),

    303206: () => new StatusBuilder('交给我吧！（生效中）').combatStatus().useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Special).from(332006)
        .description('【我方下次执行「切换角色」行动时：】将此次切换视为「[快速行动]」而非「[战斗行动]」。')
        .handle((status, event) => {
            if (event.isQuickAction) return;
            return {
                isQuickAction: true,
                triggers: 'minus-switch-from',
                exec: () => status.minusUseCnt(),
            }
        }),

    303207: () => new StatusBuilder('鹤归之时（生效中）').combatStatus().useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Special).from(332007)
        .description('【我方下一次使用技能后：】将下一个我方后台角色切换到场上。')
        .handle((status, { cmds }) => (cmds.switchAfter(), { triggers: 'skill', exec: () => status.minusUseCnt() })),

    303216: () => card332016sts(ELEMENT_TYPE.Cryo),

    303217: () => card332016sts(ELEMENT_TYPE.Hydro),

    303218: () => card332016sts(ELEMENT_TYPE.Pyro),

    303219: () => card332016sts(ELEMENT_TYPE.Electro),

    303220: () => new StatusBuilder('重攻击（生效中）').heroStatus().roundCnt(1)
        .type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).icon(STATUS_ICON.Special).from(332018)
        .description('本回合中，当前我方出战角色下次「普通攻击」造成的伤害+1。；【此次「普通攻击」为[重击]时：】伤害额外+1。')
        .handle((status, event) => ({
            addDmgType1: 1,
            addDmgCdt: isCdt(event?.isChargedAtk, 1),
            triggers: 'skilltype1',
            exec: () => status.dispose(),
        })),

    303222: () => new StatusBuilder('藏锋何处（生效中）').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(332022)
        .description('【本回合中，我方下一次打出「武器」手牌时：】少花费2个元素骰。')
        .handle((status, event) => {
            if (!event.isMinusDiceWeapon) return;
            return {
                minusDiceCard: 2,
                triggers: 'card',
                exec: () => status.dispose(),
            }
        }),

    303223: () => new StatusBuilder('拳力斗技！（生效中）').combatStatus().useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Special).from(332023)
        .description('【本回合中，一位牌手先宣布结束时：】未宣布结束的牌手抓2张牌。')
        .handle((status, event) => {
            const { phase = -1, cmds } = event;
            cmds.getCard(2, { isOppo: phase > PHASE.ACTION });
            return {
                triggers: 'any-end-phase',
                isAddTask: true,
                exec: () => status.minusUseCnt(),
            }
        }),

    303224: () => card332024sts(2),

    303225: () => new StatusBuilder('野猪公主（生效中）').combatStatus().useCnt(2).roundCnt(1)
        .type(STATUS_TYPE.Usage).icon(STATUS_ICON.Buff).from(332025)
        .description('【本回合中，我方每有一张装备在角色身上的「装备牌」被弃置时：】获得1个[万能元素骰]。；[useCnt]；（角色被击倒时弃置装备牌，或者覆盖装备「武器」「圣遗物」或「特技」，都可以触发此效果）')
        .description('【本回合中，我方每有一张装备在角色身上的「装备牌」被弃置时：】获得1个[万能元素骰]。；[useCnt]；（角色被击倒时弃置装备牌，或者覆盖装备「武器」或「圣遗物」，都可以触发此效果）', 'v5.0.0')
        .handle((status, event) => ({
            triggers: 'slot-destroy',
            isAddTask: true,
            exec: () => {
                const { slotsDestroyCnt, cmds } = event;
                const cnt = Math.min(status.useCnt, slotsDestroyCnt.reduce((a, b) => a + b, 0));
                status.minusUseCnt(cnt);
                cmds.getDice(cnt, { element: DICE_COST_TYPE.Omni });
            }
        })),

    303226: () => new StatusBuilder('坍陷与契机（生效中）').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.DebuffCostSwitch).from(332026)
        .description('【本回合中，双方牌手进行「切换角色」行动时：】需要额外花费1个元素骰。')
        .handle(() => ({ triggers: 'add-switch', addDiceHero: 1 })),

    303227: () => new StatusBuilder('四叶印').heroStatus()
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign).icon(STATUS_ICON.Special).from(332027)
        .description('【结束阶段：】切换到所附属角色。')
        .handle((_, { cmds, hidx }) => ({
            triggers: 'phase-end',
            isAddTask: true,
            exec: () => cmds.switchTo(hidx),
        })),

    303228: () => new StatusBuilder('机关铸成之链（生效中）').heroStatus().useCnt(0)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate).icon(STATUS_ICON.Special).from(332028)
        .description('【所附属角色每次受到伤害或治疗后：】累积1点「备战度」（最多累积2点）。；【我方打出原本费用不多于「备战度」的「武器」或「圣遗物」时:】移除此状态，以免费打出该牌。')
        .handle((status, event) => {
            const { hcard, trigger, isMinusDiceWeapon, isMinusDiceRelic } = event;
            const isMinus = (isMinusDiceWeapon || isMinusDiceRelic) && status.useCnt >= (hcard?.cost ?? 3);
            const triggers: Trigger[] = [];
            if (status.useCnt < 2) triggers.push('getdmg', 'heal');
            if (isMinus) triggers.push('card');
            return {
                triggers,
                minusDiceCard: isCdt(isMinus, status.useCnt),
                isAddTask: trigger != 'card',
                exec: () => {
                    if (trigger == 'getdmg' || trigger == 'heal') {
                        status.addUseCnt();
                    } else if (trigger == 'card' && isMinus) {
                        status.dispose();
                    }
                }
            }
        }),

    303229: () => new StatusBuilder('净觉花（生效中）').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(332029)
        .description('【本回合中，我方下次打出支援牌时：】少花费1个元素骰。')
        .handle((status, event) => {
            const { hcard, isMinusDiceCard } = event;
            if (!isMinusDiceCard || hcard?.type != CARD_TYPE.Support) return;
            return { triggers: 'card', minusDiceCard: 1, exec: () => status.dispose() }
        }),

    303231: () => coolDownStatus('海底宝藏', 303230).heroStatus().description('本回合此角色不会再受到来自「【crd303230】」的治疗。'),

    303232: () => card332024sts(1),

    303236: () => new StatusBuilder('「看到那小子挣钱…」（生效中）').combatStatus().useCnt(0).roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Accumulate).icon(STATUS_ICON.Special).from(332036)
        .description('【本回合中，每当对方获得2个元素骰时：】你获得1个[万能元素骰]。（此效果提供的元素骰除外）')
        .handle((status, event) => {
            const { source = -1, cmds } = event;
            if (status.useCnt == 1) cmds.getDice(1, { element: DICE_COST_TYPE.Omni });
            return {
                triggers: isCdt(source != status.id, 'getdice-oppo'),
                isAddTask: true,
                exec: () => status.addUseCntMod(2),
            }
        }),

    303237: () => new StatusBuilder('噔噔！（生效中）').combatStatus().useCnt(1)
        .type(STATUS_TYPE.Round, STATUS_TYPE.Sign).icon(STATUS_ICON.Special).from(332037)
        .description('【结束阶段：】抓1张牌。；[useCnt]')
        .handle((status, { cmds }) => ({
            triggers: 'phase-end',
            isAddTask: true,
            exec: () => {
                status.minusUseCnt();
                cmds.getCard(1);
            },
        })),

    303238: () => new StatusBuilder('燃素充盈（生效中）').combatStatus().roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(332042)
        .description('【本回合我方角色下次消耗「夜魂值」后：】该角色获得1点「夜魂值」。')
        .handle((status, event) => {
            const { sourceHidx = -1, cmds } = event;
            if (sourceHidx == -1 || status.roundCnt <= 0) return;
            return {
                triggers: 'consumeNightSoul',
                isAddTask: true,
                exec: () => {
                    cmds.getNightSoul(1, sourceHidx);
                    status.dispose();
                }
            }
        }),

    303239: () => new StatusBuilder('困困冥想术（生效中）').combatStatus().useCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(332045)
        .description('我方下次打出不属于初始卡组的牌少花费2个元素骰。')
        .handle((status, event) => {
            const { hcard, playerInfo: { initCardIds }, isMinusDiceCard } = event;
            if (!hcard || initCardIds.includes(hcard.id) || !isMinusDiceCard) return;
            return { triggers: 'card', minusDiceCard: 2, exec: () => status.minusUseCnt() }
        }),

    303240: () => new StatusBuilder('还魂诗').heroStatus().addCnt(0).useCnt(1).roundCnt(1)
        .type(STATUS_TYPE.Usage, STATUS_TYPE.NonDefeat).icon('#').from(331806)
        .description('【本回合内，所附属角色被击倒时：】如可能，消耗等同于此牌「重燃」的元素骰，使角色[免于被击倒]，并治疗该角色到1点生命值。然后此牌「重燃」+1。')
        .handle((status, event) => {
            const { hidx = -1, cmds, dicesCnt = 0 } = event;
            status.addition[STATUS_TYPE.NonDefeat] = 0;
            if (dicesCnt < status.useCnt) return;
            cmds.revive(1, hidx).consumeDice(status.useCnt);
            status.addition[STATUS_TYPE.NonDefeat] = 1;
            return { triggers: 'will-killed', exec: () => status.addUseCnt(true) }
        }),

    303241: () => new StatusBuilder('健身的成果（生效中）').heroStatus().useCnt(2)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage).from(332048)
        .description('【我方其他角色[准备技能]时：】所选角色下次「元素战技」少花费1个元素骰。（至多触发2次，不可叠加）')
        .handle((status, event) => {
            const { heros, hidx = -1, sourceHidx = -1, cmds } = event;
            if (hidx == sourceHidx || hasObjById(heros[hidx]?.heroStatus, 303242)) return;
            cmds.getStatus(303242, { hidxs: hidx });
            return { triggers: 'ready-skill', isAddTask: true, exec: () => status.minusUseCnt() }
        }),

    303242: () => new StatusBuilder('健身的成果（生效中）').heroStatus().useCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage).from(303241)
        .description('该角色下次元素战技少花费1个元素骰。（不可叠加）')
        .handle((status, event) => ({
            triggers: 'skilltype2',
            minusDiceSkill: { skilltype2: [0, 0, 1] },
            exec: () => { event.isMinusDiceSkill && status.minusUseCnt() }
        })),

    303243: () => new StatusBuilder('很棒，哥们。（生效中）').combatStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(332050)
        .description('下次使用「特技」牌后，生成1个[万能元素骰]。')
        .handle((status, event) => {
            const { hcard, cmds } = event;
            if (!hcard?.hasSubtype(CARD_SUBTYPE.Vehicle)) return;
            cmds.getDice(1, { element: DICE_COST_TYPE.Omni });
            return { triggers: 'card', isAddTask: true, exec: () => status.dispose() }
        }),

    303244: () => new StatusBuilder('收获时间（生效中）').combatStatus().useCnt(1).maxCnt(2)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Round).from(332049)
        .description('【结束阶段：】生成一张【crd332049】，随机置入我方牌组。（可叠加，最多叠加到2）')
        .handle((status, { cmds }) => ({
            triggers: 'phase-end',
            isAddTask: true,
            exec: () => {
                cmds.addCard(status.useCnt, 332049);
                status.dispose();
            },
        })),

    303300: () => new StatusBuilder('饱腹').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Food).type(STATUS_TYPE.Round, STATUS_TYPE.Sign)
        .description('本回合无法食用更多的「料理」。'),

    303301: () => new StatusBuilder('绝云锅巴（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.AtkUp).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(333001)
        .description('本回合中，目标角色下一次「普通攻击」造成的伤害+1。')
        .handle(status => ({
            addDmgType1: 1,
            triggers: 'skilltype1',
            exec: () => status.dispose(),
        })),

    303302: () => new StatusBuilder('仙跳墙（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(333002)
        .description('本回合中，目标角色下一次「元素爆发」造成的伤害+3。')
        .handle(status => ({ addDmgType3: 3, triggers: 'skilltype3', exec: () => status.dispose() })),

    303303: () => new StatusBuilder('莲花酥（生效中）').heroStatus().useCnt(1).roundCnt(1)
        .type(STATUS_TYPE.Barrier, STATUS_TYPE.Sign).from(333003)
        .description('本回合中，目标角色下次受到的伤害-3。').barrierCnt(3),

    303304: () => new StatusBuilder('北地烟熏鸡（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(333004)
        .description('本回合中，目标角色下一次「普通攻击」少花费1个[无色元素骰]。')
        .handle((status, event) => ({
            triggers: 'skilltype1',
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => { event.isMinusDiceSkill && status.dispose() },
        })),

    303305: () => new StatusBuilder('烤蘑菇披萨（生效中）').heroStatus().useCnt(2)
        .icon(STATUS_ICON.Heal).type(STATUS_TYPE.Round).from(333007)
        .description('两回合内结束阶段再治疗此角色1点。')
        .handle((status, { hidx, cmds }) => ({
            triggers: 'phase-end',
            exec: () => {
                status.minusUseCnt();
                cmds.heal(1, { hidxs: hidx });
            },
        })),

    303306: () => new StatusBuilder('兽肉薄荷卷（生效中）').heroStatus().useCnt(3).useCnt(-1, 'v3.4.0').roundCnt(1)
        .type(STATUS_TYPE.Usage).type(ver => ver.lt('v3.4.0') && !ver.isOffline, STATUS_TYPE.Sign)
        .icon(STATUS_ICON.Buff).from(333008)
        .description('本回合中，该角色「普通攻击」少花费1个[无色元素骰]。；[useCnt]')
        .description('本回合中，该角色「普通攻击」少花费1个[无色元素骰]。', 'v3.4.0')
        .handle((status, event, ver) => ({
            triggers: 'skilltype1',
            minusDiceSkill: { skilltype1: [0, 1, 0] },
            exec: () => { (ver.gte('v3.4.0') || ver.isOffline) && event.isMinusDiceSkill && status.minusUseCnt() },
        })),

    303307: () => new StatusBuilder('复苏冷却中').combatStatus().roundCnt(1)
        .icon(STATUS_ICON.Food).type(STATUS_TYPE.Round, STATUS_TYPE.Sign)
        .description('本回合无法通过「料理」复苏角色。'),

    303308: () => new StatusBuilder('刺身拼盘（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(333010)
        .description('本回合中，该角色「普通攻击」造成的伤害+1。')
        .handle(() => ({ addDmgType1: 1 })),

    303309: () => new StatusBuilder('唐杜尔烤鸡（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(333011)
        .description('本回合中，所附属角色下一次「元素战技」造成的伤害+2。')
        .handle(status => ({ addDmgType2: 2, triggers: 'skilltype2', exec: () => status.dispose() })),

    303310: () => new StatusBuilder('黄油蟹蟹（生效中）').heroStatus().useCnt(1).roundCnt(1)
        .type(STATUS_TYPE.Barrier, STATUS_TYPE.Sign).from(333012)
        .description('本回合中，所附属角色下次受到伤害-2。').barrierCnt(2),

    303311: () => new StatusBuilder('炸鱼薯条（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(333013)
        .description('本回合中，所附属角色下次使用技能时少花费1个元素骰。')
        .handle((status, event) => ({
            triggers: 'skill',
            minusDiceSkill: { skill: [0, 0, 1] },
            exec: () => { event.isMinusDiceSkill && status.dispose() },
        })),

    303312: () => new StatusBuilder('松茸酿肉卷（生效中）').heroStatus().useCnt(3)
        .icon(STATUS_ICON.Heal).type(STATUS_TYPE.Round).from(333014)
        .description('【结束阶段：】治疗该角色1点。；[useCnt]')
        .handle((status, { hidx, cmds }) => ({
            triggers: 'phase-end',
            exec: () => {
                status.minusUseCnt();
                cmds.heal(1, { hidxs: hidx });
            },
        })),

    303313: () => new StatusBuilder('缤纷马卡龙（生效中）').heroStatus().useCnt(3)
        .icon(STATUS_ICON.Heal).type(STATUS_TYPE.Attack).from(333015)
        .description('【所附属角色受到伤害后：】治疗该角色1点。；[useCnt]')
        .handle((status, { hidx = -1 }) => ({
            heal: 1,
            hidxs: hidx,
            triggers: 'getdmg',
            exec: () => status.minusUseCnt(),
        })),

    303314: () => new StatusBuilder('龙龙饼干（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(333016)
        .description('本回合中，所附属角色下一次使用「特技」少花费1个元素骰。')
        .handle((status, event) => ({
            triggers: 'vehicle',
            minusDiceSkill: { skilltype5: [0, 0, 1] },
            exec: () => { event.isMinusDiceSkill && status.dispose() },
        })),

    303315: () => new StatusBuilder('咚咚嘭嘭（生效中）').heroStatus().useCnt(3)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage).from(333018)
        .description('名称不存在于初始牌组中牌加入我方手牌时，所附属角色治疗自身1点。；[useCnt]')
        .handle((status, event) => {
            const { hero, playerInfo: { initCardIds }, hidx, hcard, cmds } = event;
            if (!hcard || initCardIds.includes(hcard?.id) || !hero.isHurted) return;
            cmds.heal(1, { hidxs: hidx });
            return { triggers: 'getcard', exec: () => status.minusUseCnt() }
        }),

    303317: () => new StatusBuilder('奇瑰之汤·助佑（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Round, STATUS_TYPE.Usage, STATUS_TYPE.Sign).from(333022)
        .description('本回合中，该角色下次使用技能时少花费2个元素骰。')
        .handle((status, event) => ({
            triggers: 'skill',
            minusDiceSkill: { skill: [0, 0, 2] },
            exec: () => { event.isMinusDiceSkill && status.dispose() },
        })),

    303318: () => new StatusBuilder('奇瑰之汤·激愤（生效中）').heroStatus().roundCnt(1)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.AddDamage, STATUS_TYPE.Sign).from(333023)
        .description('本回合中，该角色下一次造成的伤害+2。')
        .handle(status => ({ addDmg: 2, triggers: 'skill', exec: () => status.dispose() })),

    303319: () => new StatusBuilder('奇瑰之汤·宁静（生效中）').heroStatus().useCnt(1).roundCnt(1)
        .type(STATUS_TYPE.Barrier, STATUS_TYPE.Sign).icon(STATUS_ICON.Buff).from(333024)
        .description('本回合中，该角色下次受到的伤害-2。').barrierCnt(2),

    303320: () => new StatusBuilder('奇瑰之汤·安神（生效中）').heroStatus().useCnt(3).roundCnt(1)
        .type(STATUS_TYPE.Barrier).icon(STATUS_ICON.Buff).from(333025)
        .description('本回合中，该我方角色受到的伤害-1。；[useCnt]'),

    303321: () => new StatusBuilder('纵声欢唱（生效中）').combatStatus().useCnt(2)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage).from(333027)
        .description('下次切换角色少花费1个[无色元素骰]。')
        .handle((status, event) => {
            const { switchHeroDiceCnt = 0 } = event;
            if (switchHeroDiceCnt == 0) return;
            return { minusDiceHero: 1, triggers: 'minus-switch', exec: () => status.minusUseCnt() }
        }),

    303322: () => new StatusBuilder('丰稔之赐（生效中）').heroStatus().useCnt(2)
        .icon(STATUS_ICON.Buff).type(STATUS_TYPE.Usage).from(333028)
        .description('【该角色[准备技能]时：】治疗自身1点。；[useCnt]')
        .handle((status, event) => {
            const { hidx, sourceHidx, cmds } = event;
            if (hidx != sourceHidx) return;
            cmds.heal(1, { hidxs: hidx });
            return { triggers: 'ready-skill', exec: () => status.minusUseCnt() }
        }),

};

export const statusesTotal = (version: Version = VERSION[0]) => {
    if (version == 'vlatest') version = VERSION[0];
    const statuses: Status[] = [];
    for (const id in allStatuses) {
        const statusBuilder = allStatuses[id]();
        if (statusBuilder.isOnlyExplain) continue;
        statuses.push(statusBuilder.version(version).id(+id).done());
    }
    return statuses;
}

export const newStatus = (version?: Version, options: { diff?: Record<number, Version>, dict?: Record<number, number> } = {}) => {
    return (id: number, ...args: any) => {
        const { diff = {}, dict = {} } = options;
        const dversion = diff[getDerivantParentId(id, dict)] ?? diff[getHidById(id)] ?? diff[id] ?? version;
        return allStatuses[id]?.(...args).id(id).version(dversion).done() ?? NULL_STATUS();
    }
}