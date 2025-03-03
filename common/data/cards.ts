import { Card, Cmds, GameInfo, Hero, MinusDiceSkill, Status, Summon, Support, Trigger } from '../../typing';
import {
    CARD_SUBTYPE, CARD_TAG, CMD_MODE, DAMAGE_TYPE, DICE_COST_TYPE, DiceCostType, ELEMENT_CODE, ELEMENT_TYPE, ElementType, HERO_LOCAL,
    HERO_TAG, HeroTag, PHASE, PURE_ELEMENT_TYPE, PureElementType, SKILL_TYPE, SkillType, STATUS_TYPE,
    VERSION, Version
} from '../constant/enum.js';
import { MAX_SUMMON_COUNT, MAX_SUPPORT_COUNT } from '../constant/gameOption.js';
import { INIT_SUMMONCNT, NULL_CARD } from '../constant/init.js';
import { ELEMENT_NAME, PURE_ELEMENT_NAME } from '../constant/UIconst.js';
import { allHidxs, getBackHidxs, getHidById, getMaxHertHidxs, getObjById, getObjIdxById, getTalentIdByHid, getVehicleIdByCid, hasObjById, isTalentFront } from '../utils/gameUtil.js';
import { isCdt, objToArr } from '../utils/utils.js';
import { CardBuilder } from './builder/cardBuilder.js';

export type CardHandleEvent = {
    pidx?: number,
    heros?: Hero[],
    hero?: Hero,
    combatStatus?: Status[],
    pile?: Card[],
    eheros?: Hero[],
    eCombatStatus?: Status[],
    epile?: Card[],
    reset?: boolean,
    hcard?: Card,
    trigger?: Trigger,
    summons?: Summon[],
    esummons?: Summon[],
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
    hcards?: Card[],
    hcardsCnt?: number,
    ehcardsCnt?: number,
    heal?: number[],
    ephase?: number,
    isChargedAtk?: boolean,
    isFallAtk?: boolean,
    round?: number,
    playerInfo?: GameInfo,
    eplayerInfo?: GameInfo,
    dicesCnt?: number,
    restDmg?: number,
    skid?: number,
    sktype?: SkillType,
    isSummon?: number,
    isExec?: boolean,
    supports?: Support[],
    esupports?: Support[],
    isMinusDiceCard?: boolean,
    isMinusDiceTalent?: boolean,
    minusDiceCard?: number,
    isMinusDiceSkill?: boolean,
    isMinusDiceWeapon?: boolean,
    isMinusDiceArtifact?: boolean,
    minusDiceSkill?: number[][],
    dmgedHidx?: number,
    getdmg?: number[],
    dmg?: number[],
    hasDmg?: boolean,
    slotUse?: boolean,
    isExecTask?: boolean,
    selectHeros?: number[],
    selectSummon?: number,
    selectSupport?: number,
    source?: number,
    sourceHidx?: number,
    dmgSource?: number,
    randomInArr?: <T>(arr: T[], cnt?: number) => T[],
    randomInt?: (max?: number) => number,
    getCardIds?: (filter?: (card: Card) => boolean) => number[],
}

export type CardHandleRes = {
    support?: (number | [number, ...any])[] | number,
    supportOppo?: (number | [number, ...any])[] | number,
    cmds?: Cmds[],
    execmds?: Cmds[],
    triggers?: Trigger[],
    status?: (number | [number, ...any])[] | number,
    statusOppo?: (number | [number, ...any])[] | number,
    canSelectHero?: boolean[],
    summon?: (number | [number, ...any])[] | number,
    addDmg?: number,
    addDmgType1?: number,
    addDmgType2?: number,
    addDmgType3?: number,
    addDmgCdt?: number,
    minusDiceSkill?: MinusDiceSkill,
    minusDiceCard?: number,
    minusDiceHero?: number,
    hidxs?: number[],
    isValid?: boolean,
    element?: DiceCostType,
    cnt?: number,
    isDestroy?: boolean,
    restDmg?: number,
    isAddTask?: boolean,
    notPreview?: boolean,
    forcePreview?: boolean,
    summonCnt?: number[][],
    isQuickAction?: boolean,
    isOrTrigger?: boolean,
    isTrigger?: boolean,
    exec?: () => CardExecRes | void,
};

export type CardExecRes = {
    hidxs?: number[],
}

const normalWeapon = (shareId: number) => {
    return new CardBuilder(shareId)
        .description('【角色造成的伤害+1】。')
        .weapon().costSame(2).handle(() => ({ addDmg: 1 }));
}

const sacrificialWeapon = (shareId: number) => {
    return new CardBuilder(shareId)
        .description('【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】生成1个此角色类型的元素骰（每回合1次）。')
        .weapon().costSame(3).perCnt(1).handle((card, event) => ({
            addDmg: 1,
            triggers: isCdt(card.perCnt > 0, 'skilltype2'),
            execmds: isCdt(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: event.hero?.element }]),
            exec: () => card.minusPerCnt()
        }));
}

const skywardWeapon = (shareId: number) => {
    return new CardBuilder(shareId)
        .description('【角色造成的伤害+1】。；【每回合1次：】角色使用｢普通攻击｣造成的伤害额外+1。')
        .weapon().costSame(3).perCnt(1).handle(card => ({
            addDmg: 1,
            addDmgCdt: card.perCnt,
            triggers: isCdt(card.perCnt > 0, 'skilltype1'),
            exec: () => card.minusPerCnt()
        }));
}

const senlin1Weapon = (shareId: number, name: string, stsId: number) => {
    return new CardBuilder(shareId).name(name).weapon().costSame(3)
        .description('【角色造成的伤害+1】。；【入场时：】所附属角色在本回合中，下次对角色打出｢天赋｣或使用｢元素战技｣时少花费2个元素骰。')
        .handle(() => ({ addDmg: 1, status: [[stsId, name]] }));
}

const senlin2Weapon = (shareId: number, name: string, stsId: number) => {
    return new CardBuilder(shareId).name(name).weapon().costAny(3)
        .description('【角色造成的伤害+1】。；【入场时：】所附属角色在本回合中，下次使用｢普通攻击｣后：生成2个此角色类型的元素骰。')
        .handle(() => ({ addDmg: 1, status: [[stsId, name]] }));
}

const barrierWeaponHandle = (card: Card, event: CardHandleEvent): (Omit<CardHandleRes, 'trigger'> & { trigger?: Trigger | Trigger[] }) | undefined => {
    const { hcards = [], hcardsCnt = hcards.length, restDmg = -1, sktype = SKILL_TYPE.Vehicle } = event;
    if (restDmg > -1) {
        if (card.perCnt <= 0 || hcardsCnt == 0 || restDmg == 0) return { restDmg }
        return {
            restDmg: restDmg - 1,
            execmds: [{ cmd: 'discard', mode: CMD_MODE.HighHandCard }],
            exec: () => {
                card.addUseCnt();
                card.minusPerCnt();
            }
        }
    }
    if (card.useCnt == 0 || sktype == SKILL_TYPE.Vehicle) return;
    return {
        trigger: 'dmg',
        addDmgCdt: 1,
        execmds: [{ cmd: 'getCard', cnt: card.useCnt }],
        exec: () => { card.useCnt = 0 }
    }
}

const normalElArtifact = (shareId: number, element: PureElementType) => {
    return new CardBuilder(shareId).artifact().costAny(2).costSame(2, 'v4.0.0').perCnt(1)
        .description(`【对角色打出｢天赋｣或角色使用技能时：】少花费1个[${ELEMENT_NAME[element]}骰]。（每回合1次）`)
        .handle((card, event) => {
            if (card.perCnt <= 0) return;
            const { trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
            return {
                minusDiceSkill: { skill: [1, 0, 0], elDice: element },
                minusDiceCard: isCdt(isMinusDiceTalent, 1),
                triggers: ['skill', 'card'],
                exec: () => {
                    if (trigger == 'card' && isMinusDiceTalent || trigger == 'skill' && isMinusDiceSkill) {
                        card.minusPerCnt();
                    }
                }
            }
        });
}

const advancedElArtifact = (shareId: number, element: PureElementType) => {
    return new CardBuilder(shareId).offline('v1').artifact().costSame(2).costAny(3, 'v4.0.0').perCnt(1)
        .description(`【对角色打出｢天赋｣或角色使用技能时：】少花费1个[${ELEMENT_NAME[element]}骰]。（每回合1次）；【投掷阶段：】2个元素骰初始总是投出[${ELEMENT_NAME[element]}骰]。`)
        .handle((card, event) => {
            const { trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
            const isMinusCard = isMinusDiceTalent && card.perCnt > 0;
            return {
                minusDiceSkill: isCdt(card.perCnt > 0, { skill: [1, 0, 0], elDice: element }),
                minusDiceCard: isCdt(isMinusCard, 1),
                triggers: ['skill', 'card', 'phase-dice'],
                element,
                cnt: 2,
                exec: () => {
                    if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skill' && isMinusDiceSkill)) {
                        card.minusPerCnt();
                    }
                }
            }
        });
}

const elCard = (shareId: number, element: PureElementType) => {
    const elName = PURE_ELEMENT_NAME[element];
    return new CardBuilder(shareId).name('元素共鸣：交织之' + elName[0]).offline('v1')
        .subtype(CARD_SUBTYPE.ElementResonance).costSame(0)
        .description(`生成1个[${elName}骰]。`)
        .handle(() => ({ cmds: [{ cmd: 'getDice', cnt: 1, element }] }));
}

const magicCount = (cnt: number, shareId?: number) => {
    return new CardBuilder(shareId).name(`幻戏${cnt > 0 ? `倒计时：${cnt}` : '开始！'}`).event().costSame(cnt)
        .description(`将我方所有元素骰转换为[万能元素骰]，抓4张牌。${cnt > 0 ? '；此牌在手牌或牌库中被[舍弃]后：将1张元素骰费用比此卡少1个的｢幻戏倒计时｣放置到你的牌库顶。' : ''}`)
        .src(`https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_CardFace_Event_Event_MagicCount${cnt}.webp`)
        .handle((_, event) => {
            const { trigger } = event;
            const cmds: Cmds[] = trigger == 'discard' ?
                [{ cmd: 'addCard', cnt: 1, card: 332036 - cnt, hidxs: [1] }] :
                [{ cmd: 'changeDice' }, { cmd: 'getCard', cnt: 4 }];
            return { triggers: isCdt(cnt > 0, 'discard'), cmds }
        })
}

// 31xxxx：装备
//   311xxx：武器
//     3111xx：法器
//     3112xx：弓
//     3113xx：双手剑
//     3114xx：长柄武器
//     3115xx：单手剑
//   312xxx：圣遗物
//   313xxx：特技
// 32xxxx：支援
//   321xxx：场地
//   322xxx：伙伴
//   323xxx：道具
// 33xxxx：事件
//   330xxx：秘传
//   331xxx：共鸣
//   332xxx：事件
//   333xxx：料理
// 2xxxx1：天赋

const allCards: Record<number, () => CardBuilder> = {

    311101: () => normalWeapon(121).name('魔导绪论').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/1abc432f853c6fa24624a92646c62237_7336928583967273301.png'),

    311102: () => sacrificialWeapon(122).name('祭礼残章').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/35a99ec73d99ed979a915e9a10a33a1e_5761287146349681281.png'),

    311103: () => skywardWeapon(123).name('天空之卷')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/347336161ab1d81f0b5bf1508a392f64_4021839086739887808.png'),

    311104: () => new CardBuilder(124).name('千夜浮梦').since('v3.7.0').weapon().costSame(3).perCnt(2)
        .description('【角色造成的伤害+1】。；【我方角色引发元素反应时：】造成的伤害+1。（每回合最多触发2次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a56d5cf80b505c42a3643534d3dc2821_8758750260465224130.png')
        .handle((card, event) => {
            const { sktype = SKILL_TYPE.Vehicle } = event;
            if (sktype == SKILL_TYPE.Vehicle || card.perCnt <= 0) return { addDmg: 1 }
            return { addDmg: 1, addDmgCdt: 1, triggers: 'elReaction', exec: () => card.minusPerCnt() }
        }),

    311105: () => new CardBuilder(125).name('盈满之实').since('v3.8.0').weapon().costAny(3)
        .description('【角色造成的伤害+1】。；【入场时：】抓2张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/f396d3f86aecfc992feb76ed44485171_1252924063800768441.png')
        .handle(() => ({ addDmg: 1, cmds: [{ cmd: 'getCard', cnt: 2 }] })),

    311106: () => new CardBuilder(299).name('四风原典').since('v4.3.0').weapon().costSame(3).useCnt(0)
        .description('【此牌每有1点｢伤害加成｣，角色造成的伤害+1】。；【结束阶段：】此牌累积1点｢伤害加成｣。（最多累积到2点）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/c2774faa0cd618dddb0b7a641eede205_6906642161037931045.png')
        .handle(card => ({
            addDmg: card.useCnt,
            triggers: isCdt(card.useCnt < 2, 'phase-end'),
            isAddTask: true,
            exec: () => { card.addUseCnt() },
        })),

    311107: () => new CardBuilder(300).name('图莱杜拉的回忆').since('v4.3.0').weapon().costSame(3).perCnt(2)
        .description('【角色造成的伤害+1】。；【角色进行[重击]时：】少花费1个[无色元素骰]。（每回合最多触发2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/8f3cd8f38e2c411713f9b5e6dc826653_5506358063099958204.png')
        .handle((card, event) => {
            const { isChargedAtk, isMinusDiceSkill } = event;
            return {
                addDmg: 1,
                triggers: isCdt(card.perCnt > 0 && isMinusDiceSkill, 'skilltype1'),
                minusDiceSkill: isCdt(card.perCnt > 0 && isChargedAtk, { skilltype1: [0, 1, 0] }),
                exec: () => card.minusPerCnt()
            }
        }),

    311108: () => new CardBuilder(342).name('万世流涌大典').since('v4.5.0').weapon().costSame(3).perCnt(1).useCnt(0).isResetUseCnt()
        .description('【角色造成的伤害+1】。；【角色受到伤害或治疗后：】如果本回合已受到伤害或治疗累积2次，则角色本回合中下次造成的伤害+2。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/9a6794d76b3ea150a101e354f9f5a162_9095966637954555968.png')
        .handle((card, { hero }) => ({
            addDmg: 1,
            triggers: isCdt(card.perCnt > 0, ['getdmg', 'heal']),
            isAddTask: true,
            execmds: isCdt(card.useCnt == 1, [{ cmd: 'getStatus', status: 301108, hidxs: [hero?.hidx ?? -1] }]),
            exec: () => {
                if (card.useCnt < 2) card.addUseCnt();
                if (card.useCnt >= 2) card.minusPerCnt();
            }
        })),

    311109: () => new CardBuilder(381).name('金流监督').since('v4.7.0').weapon().costSame(2).perCnt(2)
        .description('【角色受到伤害或治疗后：】使角色本回合中下一次｢普通攻击｣少花费1个[无色元素骰]，且造成的伤害+1。（每回合至多2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/83ab325be102a71a7df848546e7eacbb_2193569914822395358.png')
        .handle((card, event) => {
            const { hero } = event;
            if (!hero || hasObjById(hero.heroStatus, 301111) || card.perCnt <= 0) return;
            return {
                triggers: ['getdmg', 'heal'],
                execmds: [{ cmd: 'getStatus', status: 301111, hidxs: [hero.hidx] }],
                exec: () => card.minusPerCnt()
            }
        }),

    311110: () => new CardBuilder(438).name('纯水流华').since('v5.2.0').weapon().costSame(1).perCnt(1)
        .description('【入场时和回合结束时：】角色附属1层【sts122】。；【我方行动前：】所附属角色如果未附属【sts122】，则生成1个随机基础元素骰，并且角色下次造成的伤害+1。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/6875a5c89d6dd60c91e5b79ab433a0b3_8573604898930608503.png')
        .handle((card, event) => {
            const { hero, trigger } = event;
            if (!hero) return;
            const triggers: Trigger[] = ['phase-end'];
            const execmds: Cmds[] = [];
            if (trigger == 'phase-end') execmds.push({ cmd: 'getStatus', status: 122, hidxs: [hero.hidx] });
            else if (trigger == 'action-start' && card.perCnt > 0 && !hasObjById(hero?.heroStatus, 122)) {
                triggers.push('action-start');
                execmds.push({ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }, { cmd: 'getStatus', status: 301112, hidxs: [hero.hidx] });
            }
            return {
                triggers,
                isAddTask: true,
                status: 122,
                execmds,
                exec: () => { trigger == 'action-start' && card.minusPerCnt() },
            }
        }),

    311201: () => normalWeapon(126).name('鸦羽弓').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/e20881692f9c3dcb128e3768347af4c0_5029781426547880539.png'),

    311202: () => sacrificialWeapon(127).name('祭礼弓').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/4adb0666f4e171943739e4baa0863b48_5457536750893996771.png'),

    311203: () => skywardWeapon(128).name('天空之翼')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/b50f747817c941c6ea72a56b4501a99c_2147958904876284896.png'),

    311204: () => new CardBuilder(129).name('阿莫斯之弓').since('v3.7.0').offline('v1').weapon().costSame(3).perCnt(1)
        .description('【角色造成的伤害+1】。；【角色使用原本元素骰费用+充能费用至少为5的技能时，】伤害额外+2。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d974aa6b36205d2c4ee83900f6383f40_5244142374562514025.png')
        .handle((card, event) => {
            const { hero, skid = -1, sktype = SKILL_TYPE.Vehicle } = event;
            let isAddDmg = card.perCnt > 0 && skid > -1 && sktype != SKILL_TYPE.Vehicle;
            if (isAddDmg) {
                const cskill = hero?.skills.find(sk => sk.id == skid);
                if (cskill) isAddDmg &&= cskill.damage > 0 && cskill.cost.reduce((a, c) => a + c.cnt, 0) >= 5;
            }
            return {
                addDmg: 1,
                addDmgCdt: isCdt(isAddDmg, 2),
                triggers: isCdt(isAddDmg, 'skill'),
                exec: () => card.minusPerCnt()
            }
        }),

    311205: () => new CardBuilder(130).name('终末嗟叹之诗').since('v3.7.0').weapon().costSame(3)
        .description('【角色造成的伤害+1】。；【角色使用｢元素爆发｣后：】生成【sts301102】。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fc5f899e61c9236a1319ea0f3c8b7a64_3821389462721294816.png')
        .handle((_, { hero }) => ({ addDmg: 1, triggers: 'skilltype3', execmds: [{ cmd: 'getStatus', status: 301102, hidxs: [hero?.hidx ?? -1] }] })),

    311206: () => senlin1Weapon(131, '王下近侍', 301103).since('v4.0.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/c667e01fa50b448958eff1d077a7ce1b_1806864451648421284.png'),

    311207: () => new CardBuilder(382).name('竭泽').since('v4.7.0').weapon().costSame(2).perCnt(2).useCnt(0)
        .description('【我方打出名称不存在于初始牌组中的行动牌后：】此牌累积1点｢渔猎｣。（最多累积2点，每回合最多累积2点）；【角色使用技能时：】如果此牌已有｢渔猎｣，则消耗所有｢渔猎｣，使此技能伤害+1，并且每消耗1点｢渔猎｣就抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/ea03edad3c81f49bddc24a5689f278d2_6229118249248157024.png')
        .handle((card, event) => {
            const { playerInfo: { initCardIds = [] } = {}, hcard, trigger } = event;
            const triggers: Trigger[] = [];
            if (card.useCnt > 0) triggers.push('skill');
            if (hcard && !initCardIds.includes(hcard.id) && card.useCnt < 2 && card.perCnt > 0) triggers.push('card');
            return {
                triggers,
                addDmg: isCdt(card.useCnt > 0, 1),
                execmds: isCdt(trigger == 'skill' && card.useCnt > 0, [{ cmd: 'getCard', cnt: card.useCnt }]),
                exec: () => {
                    if (trigger == 'card') {
                        card.addUseCnt();
                        card.minusPerCnt();
                    } else if (trigger == 'skill') {
                        card.useCnt = 0;
                    }
                }
            }
        }),

    311301: () => normalWeapon(132).name('白铁大剑').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/d8916ae5aaa5296a25c1f54713e2fd85_802175621117502141.png'),

    311302: () => sacrificialWeapon(133).name('祭礼大剑').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/35a410a0aad34824fdcf8ae986893d30_2999739715093754473.png'),

    311303: () => new CardBuilder(134).name('狼的末路').offline('v1').weapon().costSame(3)
        .description('【角色造成的伤害+1】。；攻击剩余生命值不多于6的目标时，伤害额外+2。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/3ec60d32f7ce9f816a6dd784b8800e93_4564486285810218753.png')
        .handle((_, event) => {
            const { eheros = [], dmgedHidx = -1 } = event;
            return { triggers: 'skill', addDmg: 1, addDmgCdt: isCdt((eheros[dmgedHidx]?.hp ?? 10) <= 6, 2) }
        }),

    311304: () => skywardWeapon(135).name('天空之傲')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/7ce2f924ae1b0922ea14eef9fbd3f2bb_951683174491798888.png'),

    311305: () => new CardBuilder(136).name('钟剑').since('v3.7.0').weapon().costSame(3).perCnt(1)
        .description('【角色造成的伤害+1】。；【角色使用技能后：】为我方出战角色提供1点[护盾]。（每回合1次，可叠加到2点）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e8bf7a38608cc3811f32f396ccea01d4_493091124030114777.png')
        .handle((card, event) => {
            const { combatStatus = [] } = event;
            const shieldCnt = getObjById(combatStatus, 121013)?.useCnt ?? 0;
            const isTriggered = card.perCnt > 0 && shieldCnt < 2;
            return {
                addDmg: 1,
                triggers: isCdt(isTriggered, 'skill'),
                execmds: [{ cmd: 'getStatus', status: 121013 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    311306: () => new CardBuilder(301).name('苇海信标').since('v4.3.0').weapon().costSame(3).perCnt(0b11)
        .description('【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】本回合内，角色下次造成的伤害额外+1。（每回合1次）；【角色受到伤害后：】本回合内，角色下次造成的伤害额外+1。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/4148c247b2685dfcb305cc9b6c5e8cff_6450004800527281410.png')
        .handle((card, event) => {
            const { hero, trigger } = event;
            if (!hero) return;
            const isTriggered1 = trigger == 'skilltype2' && (card.perCnt >> 0 & 1) == 1;
            const isTriggered2 = trigger == 'getdmg' && (card.perCnt >> 1 & 1) == 1;
            return {
                addDmg: 1,
                triggers: ['skilltype2', 'getdmg'],
                execmds: isCdt(isTriggered1 || isTriggered2, [{ cmd: 'getStatus', status: 301105 + +isTriggered2, hidxs: [hero.hidx] }]),
                exec: () => {
                    if (isTriggered1) card.perCnt &= ~(1 << 0);
                    if (isTriggered2) card.perCnt &= ~(1 << 1);
                }
            }
        }),

    311307: () => senlin2Weapon(383, '森林王器', 301109).since('v4.7.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/9d317a3a81e47ab989c633ff609b5861_5509350951295616421.png'),

    311308: () => new CardBuilder(401).name('｢究极霸王超级魔剑｣').since('v4.8.0').weapon().costSame(2)
        .description('此牌会记录本局游戏中你打出过的名称不存在于初始牌组中的行动牌数量，称为｢声援｣。〔[card]（当前为{unt}点）〕如果此牌的｢声援｣至少为2/4/8，则角色造成的伤害+1/2/3。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/21e68f35af52025a6088ca7aec78ef8f_7867921157902864538.png')
        .handle((card, event) => {
            const { playerInfo: { usedCardIds = [], initCardIds = [] } = {}, hcard, trigger } = event;
            if (trigger == 'hcard-calc') {
                card.useCnt = usedCardIds.filter(c => !initCardIds.includes(c)).length;
                return;
            }
            return {
                triggers: isCdt(!initCardIds.includes(hcard?.id ?? 0), 'card'),
                addDmg: Math.min(3, Math.floor(Math.log2(card.useCnt))),
                exec: () => { card.addUseCnt() },
            }
        }),

    311309: () => new CardBuilder(426).name('便携动力锯').since('v5.1.0').weapon().costSame(2).tag(CARD_TAG.Barrier).useCnt(0).perCnt(1)
        .description('【所附属角色受到伤害时：】如可能，[舍弃]原本元素骰费用最高的1张手牌，以抵消1点伤害，然后累积1点｢坚忍标记｣。（每回合1次）；【角色造成伤害时：】如果此牌已有｢坚忍标记｣，则消耗所有｢坚忍标记｣，使此伤害+1，并且每消耗1点｢坚忍标记｣就抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/04/258999284/12bb81a54a568778a58e8ba5094501c8_8843117623857806924.png')
        .handle(barrierWeaponHandle),

    311401: () => normalWeapon(137).name('白缨枪').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/2618b55f8449904277794039473df17c_5042678227170067991.png'),

    311402: () => new CardBuilder(138).name('千岩长枪').weapon().costSame(3)
        .description('【角色造成的伤害+1】。；【入场时：】队伍中每有1名｢璃月｣角色，此牌就为附属的角色提供1点[护盾]。（最多3点）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/7b6b74c3444f624f117f8e05344d27ec_6292708375904670698.png')
        .handle((_, event, ver) => {
            const { heros } = event;
            const liyueCnt = Math.min(3, heros?.filter(h => h.tags.includes(HERO_LOCAL.Liyue) && (ver.gte('v3.7.0') || h.hp > 0))?.length ?? 0);
            return { addDmg: 1, status: [[301101, liyueCnt]] }
        }),

    311403: () => skywardWeapon(139).name('天空之脊')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/788811f1c1ce03f56a89ecde4cbe52a7_2992557107190163621.png'),

    311404: () => new CardBuilder(140).name('贯虹之槊').since('v3.7.0').weapon().costSame(3).perCnt(1)
        .description('【角色造成的伤害+1】。；角色如果在[护盾]角色状态或[护盾]出战状态的保护下，则造成的伤害额外+1。；【角色使用｢元素战技｣后：】如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充1点[护盾]。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/0a1242b4eeb9c6b6e731466fb182cb60_6226689090161933551.png')
        .handle((card, event) => {
            const { hero, combatStatus = [], trigger, isExecTask } = event;
            const isShieldStatus = hero?.heroStatus.some(ist => ist.hasType(STATUS_TYPE.Shield)) ||
                combatStatus.some(ost => ost.hasType(STATUS_TYPE.Shield));
            const ost = combatStatus.find(ost => ost.hasType(STATUS_TYPE.Shield));
            return {
                addDmg: 1,
                addDmgCdt: isCdt(isShieldStatus && trigger == 'skill', 1),
                triggers: ['skill', 'skilltype2'],
                isAddTask: trigger == 'skilltype2' && card.perCnt > 0 && (!isExecTask || !!ost),
                exec: () => {
                    if (card.perCnt == 0 || trigger != 'skilltype2' || !ost) return;
                    ost.addUseCnt(true);
                    card.minusPerCnt();
                }
            }
        }),

    311405: () => new CardBuilder(141).name('薙草之稻光').since('v3.7.0').weapon().costSame(3).perCnt(1)
        .description('【角色造成的伤害+1】。；【每回合自动触发1次：】如果所附属角色没有[充能]，就使其获得1点[充能]。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/1ed5905877be45aca0e92093e3b5fdbe_7752495456460826672.png')
        .handle((card, event) => {
            const { hero, slotUse, isExecTask } = event;
            if (!hero) return;
            const isTriggered = !isExecTask || (card.perCnt > 0 && hero?.energy == 0);
            const cmds = isCdt<Cmds[]>(isTriggered, [{ cmd: 'getEnergy', cnt: 1, hidxs: [hero.hidx] }]);
            if (slotUse && cmds) card.minusPerCnt();
            return {
                addDmg: 1,
                cmds,
                triggers: isCdt(isTriggered, ['action-after-oppo', 'action-after']),
                execmds: cmds,
                exec: () => card.minusPerCnt(),
            }
        }),

    311406: () => senlin1Weapon(142, '贯月矢', 301104).since('v4.1.0').offline('v1')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/9d44a608d1ba86c970a0fe897f22121c_7239489409641716764.png'),

    311407: () => new CardBuilder(302).name('和璞鸢').since('v4.3.0').weapon().costSame(3).useCnt(0).isResetUseCnt()
        .description('【角色造成的伤害+1】。；【角色使用技能后：】直到回合结束前，此牌所提供的伤害加成值额外+1。（最多累积到+2）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/15/258999284/972e1ba2e544111bc0069697539b707e_7547101337974467153.png')
        .handle(card => ({
            addDmg: 1 + card.useCnt,
            triggers: isCdt(card.useCnt < 2, 'skill'),
            isAddTask: true,
            exec: () => { card.addUseCnt() },
        })),

    311408: () => new CardBuilder(355).name('公义的酬报').since('v4.6.0').weapon().costSame(2).useCnt(0)
        .description('角色使用｢元素爆发｣造成的伤害+2。；【我方出战角色受到伤害或治疗后：】累积1点｢公义之理｣。如果此牌已累积3点｢公义之理｣，则消耗3点｢公义之理｣，使角色获得1点[充能]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/000bcdedf14ef6af2cfa36a003841098_4382151758785122038.png')
        .handle((card, event) => {
            const { heros = [], hero, getdmg = [], heal = [] } = event;
            if (!hero) return;
            const fhidx = heros.findIndex(h => h.isFront);
            const trigger: Trigger[] = [];
            if (getdmg[fhidx] > 0) trigger.push('getdmg', 'other-getdmg');
            if (heal[fhidx] >= 0) trigger.push('heal', 'other-heal');
            return {
                triggers: trigger,
                addDmgType3: 2,
                execmds: isCdt(card.useCnt >= 2, [{ cmd: 'getEnergy', cnt: 1, hidxs: [hero.hidx] }]),
                isAddTask: true,
                exec: () => { card.addUseCnt() >= 3 && card.minusUseCnt(3) }
            }
        }),

    311409: () => new CardBuilder(402).name('勘探钻机').since('v4.8.0').weapon().costSame(2).tag(CARD_TAG.Barrier).useCnt(0).perCnt(1).perCnt(2, 'v5.0.0')
        .description('【所附属角色受到伤害时：】如可能，[舍弃]原本元素骰费用最高的1张手牌，以抵消1点伤害，然后累积1点｢团结｣。（每回合1次）；【角色造成伤害时：】如果此牌已有｢团结｣，则消耗所有｢团结｣，使此伤害+1，并且每消耗1点｢团结｣就抓1张牌。')
        .description('【所附属角色受到伤害时：】如可能，[舍弃]原本元素骰费用最高的1张手牌，以抵消1点伤害，然后累积1点｢团结｣。（每回合最多触发2次）；【角色使用技能时：】如果此牌已有｢团结｣，则消耗所有｢团结｣，使此技能伤害+1，并且每消耗1点｢团结｣就抓1张牌。', 'v5.0.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/ad09f3e1b00c0c246816af88dd5f457b_4905856338602635848.png')
        .handle(barrierWeaponHandle),

    311501: () => normalWeapon(143).name('旅行剑').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/2540a7ead6f2e957a6f25c9899ce428b_3859616323968734996.png'),

    311502: () => sacrificialWeapon(144).name('祭礼剑').offline('v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/5dda866add6d4244a69c0ffdd2b53e51_1375735839691106206.png'),

    311503: () => new CardBuilder(145).name('风鹰剑').offline('v1').weapon().costSame(3).perCnt(2)
        .description('【角色造成的伤害+1】。；【对方使用技能后：】如果所附属角色为｢出战角色｣，则治疗该角色1点。（每回合至多2次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/fcad55ff202d5dc8fa1d782f0b2f3400_3902557354688808483.png')
        .handle((card, event) => {
            const { hero, isExecTask } = event;
            if (!hero) return;
            const isTriggered = !!hero?.isFront && (hero?.hp ?? 0) > 0 && card.perCnt > 0;
            return {
                addDmg: 1,
                triggers: isCdt(!isExecTask || isTriggered, 'after-skill-oppo'),
                isAddTask: true,
                execmds: isCdt(isTriggered, [{ cmd: 'heal', cnt: 1, hidxs: [hero.hidx] }]),
                exec: () => card.minusPerCnt(),
            }
        }),

    311504: () => skywardWeapon(146).name('天空之刃').since('v3.7.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b3a9cd06298bf6dcd9191a88bb754f14_6317636823354305889.png'),

    311505: () => new CardBuilder(147).name('西风剑').since('v3.6.0').weapon().costSame(3).perCnt(1)
        .description('【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】角色额外获得1点[充能]。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/e1938c4cf6e50cfcb65d67ef10bc16a3_1486330508550781744.png')
        .handle((card, event) => {
            const { hero } = event;
            return {
                addDmg: 1,
                triggers: isCdt(card.perCnt > 0 && hero && hero.energy < hero.maxEnergy, 'skilltype2'),
                execmds: [{ cmd: 'getEnergy', cnt: 1 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    311506: () => new CardBuilder(303).name('裁叶萃光').since('v4.3.0').weapon().costSame(3).perCnt(2)
        .description('【角色造成的伤害+1】。；【角色使用｢普通攻击｣后：】生成1个随机的基础元素骰。（每回合最多触发2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/4d3935c7b67e051b02f9a525357b2fb0_8903486552471935304.png')
        .handle(card => ({
            addDmg: 1,
            triggers: isCdt(card.perCnt > 0, 'skilltype1'),
            execmds: [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }],
            exec: () => card.minusPerCnt(),
        })),

    311507: () => senlin2Weapon(327, '原木刀', 301107).since('v4.4.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/1f97927392b79a716430461251ff53e2_4196794667556484935.png'),

    311508: () => new CardBuilder(384).name('静水流涌之辉').since('v4.7.0').weapon().costSame(2).useCnt(0).perCnt(1)
        .description('【我方角色受到伤害或治疗后：】此牌累积1点｢湖光｣。；【角色进行｢普通攻击｣时：】如果已有12点｢湖光｣，则消耗12点，使此技能少花费2个[无色元素骰]且造成的伤害+1，并且治疗所附属角色1点。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/92753a699957dc63318f06ab506d7e41_8008667568462089258.png')
        .handle((card, event) => {
            const { heal = [], getdmg = [], trigger } = event;
            const triggers: Trigger[] = ['getdmg', 'heal', 'other-getdmg', 'other-heal'];
            const isTriggered = card.useCnt >= 12 && card.perCnt > 0;
            if (isTriggered) triggers.push('skilltype1');
            const cnt = heal.concat(getdmg).filter(v => v >= 0).length;
            return {
                triggers,
                isAddTask: trigger != 'skilltype1',
                addDmgCdt: isCdt(isTriggered && trigger == 'skilltype1', 1),
                isOrTrigger: true,
                execmds: isCdt(isTriggered && trigger == 'skilltype1', [{ cmd: 'heal', cnt: 1 }]),
                minusDiceSkill: isCdt(isTriggered, { skilltype1: [0, 2, 0] }),
                exec: () => {
                    if (trigger == 'skilltype1') {
                        card.minusUseCnt(12);
                        card.minusPerCnt();
                    } else card.addUseCnt(cnt);
                }
            }
        }),

    312001: () => new CardBuilder(148).name('冒险家头带').artifact().costSame(1).perCnt(3)
        .description('【角色使用｢普通攻击｣后：】治疗自身1点（每回合至多3次）。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/c2617ba94c31d82bd4af6df8e74aac91_8306847584147063772.png')
        .handle((card, event) => {
            const { hero } = event;
            if (!hero || card.perCnt <= 0 || hero.maxHp == hero.hp) return;
            return {
                triggers: 'skilltype1',
                execmds: [{ cmd: 'heal', cnt: 1, hidxs: [hero.hidx] }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312002: () => new CardBuilder(149).name('幸运儿银冠').artifact().costAny(2).perCnt(1)
        .description('【角色使用｢元素战技｣后：】治疗自身2点（每回合1次）。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/27d7021e8d3dc0ee1b6f271558179c77_4899141043311513249.png')
        .handle((card, event) => {
            const { hero } = event;
            if (!hero || card.perCnt <= 0 || hero.maxHp == hero.hp) return;
            return {
                triggers: 'skilltype2',
                execmds: [{ cmd: 'heal', cnt: 2, hidxs: [hero.hidx] }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312003: () => new CardBuilder(150).name('游医的方巾').artifact().costSame(1).perCnt(1)
        .description('【角色使用｢元素爆发｣后：】治疗所有我方角色1点（每回合1次）。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/27f34fa09a68f4de71cd8ce12b2ff2ea_7632599925994945499.png')
        .handle((card, event) => {
            const { heros = [] } = event;
            if (card.perCnt <= 0 || heros?.every(h => h.maxHp == h.hp)) return;
            return {
                triggers: 'skilltype3',
                execmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(heros) }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312004: () => new CardBuilder(151).name('赌徒的耳环').artifact().costSame(1).perCnt(3).perCnt(0, 'v3.8.0').isResetPerCnt()
        .description('【敌方角色被击倒后：】如果所附属角色为｢出战角色｣，则生成2个[万能元素骰]。（整场牌局限制3次）')
        .description('【敌方角色被击倒后：】如果所附属角色为｢出战角色｣，则生成2个[万能元素骰]。', 'v3.8.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/c36e23e6486cfc14ba1afac19d73620e_6020851449922266352.png')
        .handle((card, event, ver) => {
            const { hero } = event;
            if ((ver.gte('v3.8.0') && card.perCnt <= 0) || !hero?.isFront) return;
            return {
                triggers: 'kill',
                execmds: [{ cmd: 'getDice', cnt: 2, element: DICE_COST_TYPE.Omni }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312005: () => new CardBuilder(152).name('教官的帽子').offline('v1').artifact().costAny(2).perCnt(3)
        .description('【角色引发元素反应后：】生成1个此角色元素类型的元素骰。（每回合至多3次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/66b3c1346a589e0dea45a58cd4d65c5a_3513743616827517581.png')
        .handle((card, event) => {
            const { sktype = SKILL_TYPE.Vehicle, hero } = event;
            if (card.perCnt <= 0 || sktype == SKILL_TYPE.Vehicle) return;
            return {
                triggers: 'elReaction',
                execmds: [{ cmd: 'getDice', cnt: 1, element: hero?.element }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312006: () => new CardBuilder(153).name('流放者头冠').artifact().costAny(2).perCnt(1)
        .description('【角色使用｢元素爆发｣后：】所有后台我方角色获得1点[充能]。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/dd30c7290b9379c5a1a91e0bb5d881c3_4746512653382401326.png')
        .handle((card, event) => {
            const { heros = [] } = event;
            const hidxs = getBackHidxs(heros);
            const isTriggered = heros.some(h => hidxs.includes(h.hidx) && h.energy < h.maxEnergy);
            if (card.perCnt <= 0 || !isTriggered) return;
            return {
                triggers: 'skilltype3',
                execmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }],
                exec: () => card.minusPerCnt()
            }
        }),

    312007: () => new CardBuilder(154).name('华饰之兜').since('v3.5.0').artifact().costSame(1).costAny(2, 'v4.0.0')
        .description('【其他我方角色使用｢元素爆发｣后：】所附属角色获得1点[充能]。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/82dc7fbd9334da0ca277b234c902a394_6676194364878839414.png')
        .handle((_, event) => {
            const { hero } = event;
            if (!hero || hero.energy >= hero.maxEnergy) return;
            return { triggers: 'other-skilltype3', execmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: [hero.hidx] }] }
        }),

    312008: () => new CardBuilder(155).name('绝缘之旗印').since('v3.7.0').artifact().costSame(2).costAny(3, 'v4.0.0').perCnt(1).perCnt(0, 'v4.1.0')
        .description('【其他我方角色使用｢元素爆发｣后：】所附属角色获得1点[充能]。；角色使用｢元素爆发｣造成的伤害+2。（每回合1次）')
        .description('【其他我方角色使用｢元素爆发｣后：】所附属角色获得1点[充能]。；角色使用｢元素爆发｣造成的伤害+2。', 'v4.1.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/361399b0aa575a2805da6765d3c0e17c_4972333427190668688.png')
        .handle((card, event, ver) => {
            const { hero, trigger } = event;
            if (!hero || (trigger == 'other-skilltype3' && hero.energy >= hero.maxEnergy)) return;
            const isAddDmg = ver.lt('v4.1.0') || card.perCnt > 0;
            return {
                addDmgType3: isCdt(isAddDmg, 2),
                triggers: ['other-skilltype3', 'skilltype3'],
                execmds: isCdt(trigger == 'other-skilltype3', [{ cmd: 'getEnergy', cnt: 1, hidxs: [hero.hidx] }]),
                exec: () => { trigger == 'skilltype3' && isAddDmg && card.minusPerCnt() }
            }
        }),

    312009: () => new CardBuilder(156).name('将帅兜鍪').since('v3.5.0').artifact().costSame(2)
        .description('【行动阶段开始时：】为角色附属｢【sts301201】｣。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/86ed124f5715f96604248a48a57de351_6600927335776465307.png')
        .handle((_, { hero }) => ({
            triggers: 'phase-start',
            execmds: [{ cmd: 'getStatus', status: 301201, hidxs: [hero?.hidx ?? -1] }],
        })),

    312010: () => new CardBuilder(157).name('千岩牢固').since('v3.7.0').artifact().costSame(3).perCnt(1)
        .description('【行动阶段开始时：】为角色附属｢【sts301201】｣。；【角色受到伤害后：】如果所附属角色为｢出战角色｣，则生成1个此角色元素类型的元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/6b1e8983b34f821da73f7a93076a501e_3915605735095366427.png')
        .handle((card, event) => {
            const { hero, trigger, isExecTask } = event;
            const isGetDmg = trigger == 'getdmg' && card.perCnt > 0 && (!isExecTask || hero?.isFront);
            const execmds: Cmds[] = [];
            if (trigger == 'phase-start') execmds.push({ cmd: 'getStatus', status: 301201, hidxs: [hero?.hidx ?? -1] });
            if (isGetDmg) execmds.push({ cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero });
            return {
                triggers: ['phase-start', 'getdmg'],
                execmds,
                exec: () => { isGetDmg && card.minusPerCnt() }
            }
        }),

    312011: () => new CardBuilder(158).name('虺雷之姿').since('v3.7.0').artifact().costAny(2).costSame(2, 'v4.0.0').perCnt(1)
        .description('【对角色打出｢天赋｣或角色使用｢普通攻击｣时：】少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d136fc0fd368a268fe3adaba8c0e64bb_8574805937216108762.png')
        .handle((card, event) => {
            if (card.perCnt <= 0) return;
            const { trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
            return {
                minusDiceSkill: { skilltype1: [0, 0, 1] },
                minusDiceCard: isCdt(isMinusDiceTalent, 1),
                triggers: ['skilltype1', 'card'],
                exec: () => {
                    if (trigger == 'card' && isMinusDiceTalent || trigger == 'skilltype1' && isMinusDiceSkill) {
                        card.minusPerCnt();
                    }
                }
            }
        }),

    312012: () => new CardBuilder(159).name('辰砂往生录').since('v3.7.0').artifact().costAny(3).costSame(3, 'v4.0.0').perCnt(1)
        .description('【对角色打出｢天赋｣或角色使用｢普通攻击｣时：】少花费1个元素骰。（每回合1次）；【角色被切换为｢出战角色｣后：】本回合中，角色｢普通攻击｣造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ad8e8b77b4efc4aabd42b7954fbc244c_7518202688884952912.png')
        .handle((card, event) => {
            const { hero, trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
            const isMinusCard = isMinusDiceTalent && card.perCnt > 0;
            return {
                minusDiceSkill: isCdt(card.perCnt > 0, { skilltype1: [0, 0, 1] }),
                minusDiceCard: isCdt(isMinusCard, 1),
                triggers: ['skilltype1', 'card', 'switch-to'],
                execmds: isCdt(trigger == 'switch-to', [{ cmd: 'getStatus', status: 301203, hidxs: [hero?.hidx ?? -1] }]),
                exec: () => {
                    if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype1' && isMinusDiceSkill)) {
                        card.minusPerCnt();
                    }
                }
            }
        }),

    312013: () => new CardBuilder(160).name('无常之面').since('v3.7.0').offline('v1').artifact().costAny(2).costSame(2, 'v4.0.0').perCnt(1)
        .description('【对角色打出｢天赋｣或角色使用｢元素战技｣时：】少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/e2a6d4ad4958d5fff80bb17ec93189ab_7011820758446145491.png')
        .handle((card, event) => {
            if (card.perCnt <= 0) return;
            const { trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
            return {
                minusDiceSkill: { skilltype2: [0, 0, 1] },
                minusDiceCard: isCdt(isMinusDiceTalent, 1),
                triggers: ['skilltype2', 'card'],
                exec: () => {
                    if (trigger == 'card' && isMinusDiceTalent || trigger == 'skilltype2' && isMinusDiceSkill) {
                        card.minusPerCnt();
                    }
                }
            }
        }),

    312014: () => new CardBuilder(161).name('追忆之注连').since('v3.7.0').offline('v1').artifact().costAny(3).costSame(3, 'v4.0.0').perCnt(1)
        .description('【对角色打出｢天赋｣或角色使用｢元素战技｣时：】少花费1个元素骰。（每回合1次）；【如果角色具有至少2点[充能]，】就使角色｢普通攻击｣和｢元素战技｣造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/48be75f0a23375adb34789dcb1e95a97_850843251536084281.png')
        .handle((card, event) => {
            const { hero, trigger, isMinusDiceTalent, isMinusDiceSkill } = event;
            const isMinusCard = isMinusDiceTalent && card.perCnt > 0;
            const isAddDmg = (hero?.energy ?? 0) >= 2;
            return {
                addDmgType1: isCdt(isAddDmg, 1),
                addDmgType2: isCdt(isAddDmg, 1),
                minusDiceSkill: isCdt(card.perCnt > 0, { skilltype2: [0, 0, 1] }),
                minusDiceCard: isCdt(isMinusCard, 1),
                triggers: ['skilltype2', 'card'],
                exec: () => {
                    if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype2' && isMinusDiceSkill)) {
                        card.minusPerCnt();
                    }
                }
            }
        }),

    312015: () => new CardBuilder(162).name('海祇之冠').since('v4.1.0').artifact().costSame(1).useCnt(0).isResetPerCnt()
        .description('我方角色每受到3点治疗，此牌就累计1个｢海染泡沫｣。（最多累积2个〔[slot]，当前已受到{pct}点治疗〕）；【角色造成伤害时：】消耗所有｢海染泡沫｣，每消耗1个都能使造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/dfea4a0c2219c145125277f8eddb8269_3306254185680856587.png')
        .handle((card, event) => {
            const { trigger = '', heal = [], sktype = SKILL_TYPE.Vehicle } = event;
            const allHeal = heal.reduce((a, b) => a + Math.max(0, b), 0);
            const isHeal = ['heal', 'other-heal'].includes(trigger);
            if (isHeal && (allHeal == 0 || card.useCnt == 2)) return;
            return {
                triggers: ['dmg', 'heal', 'other-heal'],
                addDmgCdt: isCdt(sktype != SKILL_TYPE.Vehicle, card.useCnt),
                isAddTask: isHeal,
                exec: () => {
                    if (isHeal) {
                        card.perCnt = Math.max(card.useCnt * 3 - 6, card.perCnt - allHeal);
                        card.addUseCnt(Math.floor(-card.perCnt / 3));
                        card.perCnt %= 3;
                    } else if (trigger == 'dmg' && sktype != SKILL_TYPE.Vehicle) {
                        card.useCnt = 0;
                    }
                }
            }
        }),

    312016: () => new CardBuilder(163).name('海染砗磲').since('v4.2.0').artifact().costAny(3).useCnt(0).isResetPerCnt()
        .description('【入场时：】治疗所附属角色2点。；我方角色每受到3点治疗，此牌就累计1个｢海染泡沫｣。（最多累积2个〔[slot]，当前已受到{pct}点治疗〕）；【角色造成伤害时：】消耗所有｢海染泡沫｣，每消耗1个都能使造成的伤害+1。')
        .description('【入场时：】治疗所附属角色3点。；我方角色每受到3点治疗，此牌就累计1个｢海染泡沫｣。（最多累积2个〔[slot]，当前已受到{pct}点治疗〕）；【角色造成伤害时：】消耗所有｢海染泡沫｣，每消耗1个都能使造成的伤害+1。', 'v4.3.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/16b4765f951281f2547ba40eeb994271_8658397109914249143.png')
        .handle((card, event) => {
            const { trigger = '', heal = [], sktype = SKILL_TYPE.Vehicle } = event;
            const allHeal = heal.reduce((a, b) => a + Math.max(0, b), 0);
            const isHeal = ['heal', 'other-heal'].includes(trigger);
            if (isHeal && (allHeal == 0 || card.useCnt == 2)) return;
            return {
                triggers: ['dmg', 'heal', 'other-heal'],
                addDmgCdt: isCdt(sktype != SKILL_TYPE.Vehicle, card.useCnt),
                cmds: [{ cmd: 'heal', cnt: 2 }],
                isAddTask: isHeal,
                notPreview: true,
                exec: () => {
                    if (isHeal) {
                        card.perCnt = Math.max(card.useCnt * 3 - 6, card.perCnt - allHeal);
                        card.addUseCnt(Math.floor(-card.perCnt / 3));
                        card.perCnt %= 3;
                    } else if (trigger == 'dmg' && sktype != SKILL_TYPE.Vehicle) {
                        card.useCnt = 0;
                    }
                }
            }
        }),

    312017: () => new CardBuilder(164).name('沙王的投影').offline('v1').since('v4.2.0').artifact().costSame(1).perCnt(1)
        .description('【入场时：】抓1张牌。；【所附属角色为出战角色期间，敌方受到元素反应伤害时：】抓1张牌。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/fe25340f51936207ac2a9e71a8cad87e_3874053549243035788.png')
        .handle((card, event) => {
            const { hero, hasDmg, isExecTask } = event;
            return {
                triggers: isCdt(card.perCnt > 0 && (isExecTask || hero?.isFront && hasDmg), 'get-elReaction-oppo'),
                cmds: [{ cmd: 'getCard', cnt: 1 }],
                execmds: [{ cmd: 'getCard', cnt: 1 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312018: () => new CardBuilder(304).name('饰金之梦').since('v4.3.0').artifact().costSame(3).costAny(3, 'v4.5.0').perCnt(2)
        .description('【入场时：】生成1个所附属角色类型的元素骰。如果我方队伍中存在3种不同元素类型的角色，则改为生成2个。；【所附属角色为出战角色期间，敌方受到元素反应伤害时：】抓1张牌。（每回合至多2次）')
        .description('【入场时：】生成1个所附属角色类型的元素骰。如果我方队伍中存在3种不同元素类型的角色，则则额外生成1个[万能元素骰]。；【所附属角色为出战角色期间，敌方受到元素反应伤害时：】抓1张牌。（每回合至多2次）', 'v4.5.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/b0f1283d8fec75259495c4ef24cc768a_277942760294951822.png')
        .handle((card, event, ver) => {
            const { heros = [], hero, hasDmg, isExecTask } = event;
            const isExtra = new Set(heros.map(h => h.element)).size == 3;
            const cmds: Cmds[] = [];
            if (ver.lt('v4.5.0')) {
                cmds.push({ cmd: 'getDice', cnt: 1, element: hero?.element });
                if (isExtra) cmds.push({ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni });
            } else {
                cmds.push({ cmd: 'getDice', cnt: isExtra ? 2 : 1, element: hero?.element });
            }
            return {
                triggers: isCdt(card.perCnt > 0 && (isExecTask || hero?.isFront && hasDmg), 'get-elReaction-oppo'),
                cmds,
                execmds: [{ cmd: 'getCard', cnt: 1 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312019: () => new CardBuilder(305).name('浮溯之珏').since('v4.3.0').artifact().costSame(0).perCnt(1)
        .description('【角色使用｢普通攻击｣后：】抓1张牌。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/8ac2175960ea0dace83f9bd76efb70ef_3923530911851671969.png')
        .handle(card => ({
            triggers: isCdt(card.perCnt > 0, 'skilltype1'),
            execmds: [{ cmd: 'getCard', cnt: 1 }],
            exec: () => card.minusPerCnt(),
        })),

    312020: () => new CardBuilder(306).name('来歆余响').since('v4.3.0').artifact().costSame(2).perCnt(0b11)
        .description('【角色使用｢普通攻击｣后：】抓1张牌。（每回合1次）；【角色使用技能后：】如果我方元素骰数量不多于手牌数量，则生成1个所附属角色类型的元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/d9db70a7475940b91d63699e1276678d_8473736559088406285.png')
        .handle((card, event) => {
            const { hero, hcardsCnt = 0, dicesCnt = 0 } = event;
            const isGetCard = (card.perCnt >> 0 & 1) == 1;
            const isGetDice = dicesCnt <= hcardsCnt && (card.perCnt >> 1 & 1) == 1;
            const execmds: Cmds[] = [];
            if (isGetCard) execmds.push({ cmd: 'getCard', cnt: 1 });
            if (isGetDice) execmds.push({ cmd: 'getDice', cnt: 1, element: hero?.element });
            return {
                triggers: ['skill', 'skilltype1'],
                execmds,
                exec: () => {
                    if (isGetCard) card.perCnt &= ~(1 << 0);
                    if (isGetDice) card.perCnt &= ~(1 << 1);
                }
            }
        }),

    312021: () => new CardBuilder(307).name('灵光明烁之心').offline('v1').since('v4.3.0').artifact().costSame(0).perCnt(1)
        .description('【角色受到伤害后：】如果所附属角色为｢出战角色｣，则抓1张牌。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/3a2b86994907366639498965934b1d99_16804113149239958.png')
        .handle((card, event) => {
            const { hero, isExecTask } = event;
            if (card.perCnt <= 0 || (!isExecTask && !hero?.isFront)) return;
            return {
                triggers: 'getdmg',
                execmds: [{ cmd: 'getCard', cnt: 1 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312022: () => new CardBuilder(308).name('花海甘露之光').since('v4.3.0').artifact().costSame(1).perCnt(1)
        .description('【角色受到伤害后：】如果所附属角色为｢出战角色｣，则抓1张牌，并且在本回合结束阶段中治疗所附属角色1点。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/aaaf307c3c9725d0c8f0be7d264e04bd_9827908420304255.png')
        .handle((card, event) => {
            const { hero, isExecTask } = event;
            const isGetCard = card.perCnt > 0 && (isExecTask || hero?.isFront);
            const execmds: Cmds[] = [];
            if (card.perCnt <= 0) execmds.push({ cmd: 'heal', cnt: 1, hidxs: [hero?.hidx ?? -1] });
            if (isGetCard) execmds.push({ cmd: 'getCard', cnt: 1 });
            return {
                triggers: ['getdmg', 'phase-end'],
                isAddTask: card.perCnt == 0,
                execmds,
                exec: () => { isGetCard && card.minusPerCnt() }
            }
        }),

    312023: () => new CardBuilder(328).name('老兵的容颜').since('v4.4.0').artifact().costAny(2).useCnt(0).perCnt(1).isResetUseCnt()
        .description('【角色受到伤害或治疗后：】根据本回合触发此效果的次数，执行不同的效果。；【第一次触发：】生成1个此角色类型的元素骰。；【第二次触发：】抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/166e56c3c68e531c97f4fdfde1adde06_4511818010196081435.png')
        .handle((card, event) => {
            const { hero } = event;
            if (card.perCnt <= 0 || !hero) return;
            const execmds: Cmds[] = [{ cmd: 'getDice', element: hero.element, cnt: 1 }, { cmd: 'getCard', cnt: 1 }];
            return {
                triggers: ['getdmg', 'heal'],
                execmds: [execmds[card.useCnt]],
                exec: () => { card.addUseCnt() == 2 && card.minusPerCnt() }
            }
        }),

    312024: () => new CardBuilder(385).name('逐影猎人').since('v4.7.0').artifact().costAny(3).useCnt(0).perCnt(1).isResetUseCnt()
        .description('【角色受到伤害或治疗后：】根据本回合触发此效果的次数，执行不同的效果。；【第一次触发：】生成1个此角色类型的元素骰。；【第二次触发：】抓1张牌。；【第四次触发：】生成1个此角色类型的元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/8d877f34a6ce748ac2f474d83fa05785_4045703223333362794.png')
        .handle((card, event) => {
            const { hero } = event;
            if (card.perCnt <= 0 || !hero) return;
            const execmds: Cmds[] = [{ cmd: 'getDice', element: hero.element, cnt: 1 }, { cmd: 'getCard', cnt: 1 }];
            return {
                triggers: ['getdmg', 'heal'],
                isAddTask: true,
                execmds: isCdt(card.useCnt != 2, [execmds[card.useCnt % 3]]),
                exec: () => { card.addUseCnt() == 4 && card.minusPerCnt() }
            }
        }),

    312025: () => new CardBuilder(343).name('黄金剧团的奖赏').since('v4.5.0').artifact().costSame(0).useCnt(0)
        .description('【结束阶段：】如果所附属的角色在后台，则此牌累积1点｢报酬｣。（最多累积2点）；【对角色打出｢天赋｣或角色使用｢元素战技｣时：】此牌每有1点｢报酬｣，就将其消耗，以少花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/0f7dfce291215155b3a48a56c8c996c4_3799856037595257577.png')
        .handle((card, event) => {
            const { hero, hcard, trigger, isMinusDiceTalent, isMinusDiceSkill, minusDiceCard: mdc = 0, minusDiceSkill = [], skid } = event;
            const isPhaseEnd = trigger == 'phase-end' && card.useCnt < 2 && !hero?.isFront;
            return {
                minusDiceSkill: { skilltype2: [0, 0, card.useCnt] },
                minusDiceCard: isCdt(isMinusDiceTalent, card.useCnt),
                triggers: ['phase-end', 'card', 'skilltype2'],
                isAddTask: isPhaseEnd,
                exec: () => {
                    if (isPhaseEnd) {
                        card.addUseCnt();
                    } else if (trigger == 'card' && isMinusDiceTalent && hcard) {
                        card.minusUseCnt(hcard.cost + hcard.anydice - mdc);
                    } else if (trigger == 'skilltype2' && isMinusDiceSkill) {
                        const skill = hero?.skills.find(sk => sk.id == skid)?.cost ?? [{ cnt: 0 }, { cnt: 0 }];
                        const skillcost = skill[0].cnt + skill[1].cnt;
                        card.minusUseCnt(skillcost - minusDiceSkill.find(([eid]) => eid == card.entityId)![1]);
                    }
                }
            }
        }),

    312026: () => new CardBuilder(386).name('黄金剧团').since('v4.7.0').artifact().costSame(2).useCnt(0)
        .description('【结束阶段：】如果所附属的角色在后台，则此牌累积2点｢报酬｣。（最多累积4点）；【对角色打出｢天赋｣或角色使用｢元素战技｣时：】此牌每有1点｢报酬｣，就将其消耗，以少花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/bbe185732644f5d29e9097985c4c09a8_8068337050754144727.png')
        .handle((card, event) => {
            const { hero, hcard, trigger, isMinusDiceTalent, isMinusDiceSkill, minusDiceCard: mdc = 0, minusDiceSkill = [], skid } = event;
            const isPhaseEnd = trigger == 'phase-end' && card.useCnt < 4 && !hero?.isFront;
            return {
                minusDiceSkill: { skilltype2: [0, 0, card.useCnt] },
                minusDiceCard: isCdt(isMinusDiceTalent, card.useCnt),
                triggers: ['phase-end', 'card', 'skilltype2'],
                isAddTask: isPhaseEnd,
                exec: () => {
                    if (isPhaseEnd) {
                        card.addUseCntMax(4, 2);
                    } else if (trigger == 'card' && isMinusDiceTalent && hcard) {
                        card.minusUseCnt(hcard.cost + hcard.anydice - mdc);
                    } else if (trigger == 'skilltype2' && isMinusDiceSkill) {
                        const skill = hero?.skills.find(sk => sk.id == skid)?.cost ?? [{ cnt: 0 }, { cnt: 0 }];
                        const skillcost = skill[0].cnt + skill[1].cnt;
                        card.minusUseCnt(skillcost - minusDiceSkill.find(([eid]) => eid == card.entityId)![1])
                    }
                }
            }
        }),

    312027: () => new CardBuilder(356).name('紫晶的花冠').since('v4.6.0').artifact().costSame(1).useCnt(0).perCnt(2)
        .description('【所附属角色为出战角色，敌方受到[草元素伤害]后：】累积1枚｢花冠水晶｣。如果｢花冠水晶｣大于等于我方手牌数，则生成1个随机基础元素骰。（每回合至多生成2个）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/e431910b741b3723c64334265ce3e93e_3262613974155239712.png')
        .handle((card, event) => {
            const { hero, hcardsCnt = 0 } = event;
            if (!hero?.isFront) return;
            const isGetDice = card.useCnt + 1 >= hcardsCnt && card.perCnt > 0;
            return {
                triggers: 'Dendro-getdmg-oppo',
                execmds: isCdt(isGetDice, [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }]),
                isAddTask: true,
                exec: () => {
                    card.addUseCnt();
                    if (isGetDice) card.minusPerCnt();
                }
            }
        }),

    312028: () => new CardBuilder(387).name('乐园遗落之花').since('v4.7.0').artifact().costSame(2).useCnt(0).perCnt(2)
        .description('【所附属角色为出战角色，敌方受到[草元素伤害]或发生了[草元素相关反应]后：】累积2枚｢花冠水晶｣。如果｢花冠水晶｣大于等于我方手牌数，则生成1个[万能元素骰]。（每回合至多生成2个）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/5a997c90413e44f8147b136856facd2b_8759080322483134287.png')
        .handle((card, event) => {
            const { hero, hcards: { length: hcardsCnt } = [] } = event;
            if (!hero?.isFront) return;
            const isGetDice = card.useCnt + 2 >= hcardsCnt && card.perCnt > 0;
            return {
                triggers: ['Dendro-getdmg-oppo', 'get-elReaction-Dendro-oppo'],
                execmds: isCdt(isGetDice, [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }]),
                isAddTask: true,
                exec: () => {
                    card.addUseCnt(2);
                    if (isGetDice) card.minusPerCnt();
                }
            }
        }),

    312029: () => new CardBuilder(403).name('角斗士的凯旋').since('v4.8.0').artifact().costSame(0).perCnt(1)
        .description('【角色使用｢普通攻击｣时：】如果我方手牌数量不多于2，则少消耗1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/7c41bdc8b55d96ceafee346cd339e564_7638181105517812729.png')
        .handle((card, event) => {
            const { hcardsCnt = 0, isMinusDiceSkill } = event;
            if (hcardsCnt > 2 || card.perCnt <= 0) return;
            return {
                triggers: 'skilltype1',
                minusDiceSkill: { skilltype1: [0, 0, 1] },
                exec: () => { isMinusDiceSkill && card.minusPerCnt() }
            }
        }),

    312030: () => new CardBuilder(427).name('指挥的礼帽').since('v5.1.0').artifact().costSame(1).perCnt(1)
        .description('【我方切换到所附属角色后：】[舍弃]原本元素骰费用最高的1张手牌，将2个元素骰转换为[万能元素骰]，并使角色下次使用技能或打出｢天赋｣时少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/04/258999284/a304d1400ed0bcb463f93b2be2558833_8026218308357759960.png')
        .handle((card, event) => {
            const { hcardsCnt = 0, hero } = event;
            if (!hero || card.perCnt <= 0 || hcardsCnt == 0) return;
            return {
                triggers: 'switch-to',
                execmds: [
                    { cmd: 'discard', mode: CMD_MODE.HighHandCard },
                    { cmd: 'changeDice', cnt: 2 },
                    { cmd: 'getStatus', status: 301204, hidxs: [hero.hidx] },
                ],
                exec: () => card.minusPerCnt(),
            }
        }),

    312031: () => new CardBuilder(439).name('少女易逝的芳颜').since('v5.2.0').artifact().costSame(1).perCnt(2)
        .description('【附属角色受到圣遗物以外的治疗后：】治疗我方受伤最多的角色1点。（每回合至多触发2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/f2d558606c493ca9b41c6cb9224f4a0c_3510396940887157125.png')
        .handle((card, event) => {
            const { source = -1, heros = [] } = event;
            if (card.perCnt <= 0 || source.toString().startsWith('312') || heros.every(h => h.hp >= h.maxHp)) return;
            return {
                triggers: 'heal',
                execmds: [{ cmd: 'heal', cnt: 1, hidxs: getMaxHertHidxs(heros) }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312032: () => new CardBuilder(448).name('魔战士的羽面').since('v5.3.0').artifact().costAny(2).perCnt(1)
        .description('【附属角色使用[特技]后：】获得1点[充能]。（每回合1次)')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/7a6508ce85f6e89913c30f37d158150e_142786359709140614.png')
        .handle((card, event) => {
            const { hero } = event;
            if (card.perCnt <= 0 || !hero || hero.energy >= hero.maxEnergy) return;
            return {
                triggers: 'vehicle',
                execmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: [hero.hidx] }],
                exec: () => card.minusPerCnt(),
            }
        }),

    312101: () => normalElArtifact(165, ELEMENT_TYPE.Cryo).name('破冰踏雪的回音')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/65841e618f66c6cb19823657118de30e_3244206711075165707.png'),

    312102: () => advancedElArtifact(166, ELEMENT_TYPE.Cryo).name('冰风迷途的勇士')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/9f6238a08b5844b652365304f05a4e8e_1667994661821497515.png'),

    312201: () => normalElArtifact(167, ELEMENT_TYPE.Hydro).name('酒渍船帽')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/26c4d2daa8a4686107a39f372a2066f3_2037156632546120753.png'),

    312202: () => advancedElArtifact(168, ELEMENT_TYPE.Hydro).name('沉沦之心')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/b415a4b00134ee115f7abd0518623f4f_8721743655470015978.png'),

    312301: () => normalElArtifact(169, ELEMENT_TYPE.Pyro).name('焦灼的魔女帽')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/0d841e5b1b0bbf09b8fa1bb7a3e9125b_8584142007202998007.png'),

    312302: () => advancedElArtifact(170, ELEMENT_TYPE.Pyro).name('炽烈的炎之魔女')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/fa55d0e05799d88270cc50bd7148bfcf_3804037770932131779.png'),

    312401: () => normalElArtifact(171, ELEMENT_TYPE.Electro).name('唤雷的头冠')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/00d958c2d533c85d56613c0d718d9498_7034674946756695515.png'),

    312402: () => advancedElArtifact(172, ELEMENT_TYPE.Electro).name('如雷的盛怒')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/3c5878d193077253d00e39f6db043270_1544021479773717286.png'),

    312501: () => normalElArtifact(173, ELEMENT_TYPE.Anemo).name('翠绿的猎人之冠')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/ab97ddfef51292e8032722be4b90033c_7637964083886847648.png'),

    312502: () => advancedElArtifact(174, ELEMENT_TYPE.Anemo).name('翠绿之影')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/b95596e3e5648849048417635b619e2e_2329852964215208759.png'),

    312601: () => normalElArtifact(175, ELEMENT_TYPE.Geo).name('不动玄石之相')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/886a90f766bcecf0e8812513b7075638_2236001599325966947.png'),

    312602: () => advancedElArtifact(176, ELEMENT_TYPE.Geo).name('悠古的磐岩')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/977478ceacb3093ecefcf986aeacc1c5_8889340500329632165.png'),

    312701: () => normalElArtifact(177, ELEMENT_TYPE.Dendro).name('月桂的宝冠')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/ee4fbb8c86fcc3d54c5e6717b3b62ddb_7264725145151740958.png'),

    312702: () => advancedElArtifact(178, ELEMENT_TYPE.Dendro).name('深林的记忆')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/8c84639efb7e6a9fb445daafdee873fe_8494733884893501982.png'),

    313001: () => new CardBuilder(413).name('异色猎刀鳐').since('v5.0.0').vehicle().costSame(0).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/0d55e21afcc8d3c7cf6ced335e61d1ed_4875228470615091891.png'),

    313002: () => new CardBuilder(414).name('匿叶龙').since('v5.0.0').vehicle().costSame(1).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/287e61466a4267642dd2a744082cd968_4105284594778183841.png'),

    313003: () => new CardBuilder(415).name('鳍游龙').since('v5.0.0').vehicle().costSame(2).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/e09b424842396b5009b8507cdd1e24aa_6586947503862363.png'),

    313004: () => new CardBuilder(428).name('嵴锋龙').since('v5.1.0').vehicle().costSame(2).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/04/258999284/34506374c580288b88c38dee3b6af998_278198034630026427.png'),

    313005: () => new CardBuilder(440).name('暝视龙').since('v5.2.0').vehicle().costSame(2).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/13/258999284/73fa32443ce6c88b50cc8ef3546e5feb_8093849092566791328.png'),

    313006: () => new CardBuilder(449).name('绒翼龙').since('v5.3.0').vehicle().costSame(1).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/9a5a0408639062f81d7ed4007eea7a19_7598137844845621529.png')
        .description('【入场时：】敌方出战角色附属【sts301302】。；【附属角色切换为出战角色时，且敌方出战角色附属〖sts301302〗时：】如可能，[舍弃]原本元素骰费用最高的1张手牌，将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣，少花费1个元素骰，并移除对方所有角色的【sts301302】。')
        .handle((_, event) => {
            const { eheros = [], dmgedHidx = -1, hcardsCnt = 0, switchHeroDiceCnt = 0 } = event;
            const triggers: Trigger[] = [];
            const isTriggered = hcardsCnt > 0 && hasObjById(eheros[dmgedHidx]?.heroStatus, 301302) && switchHeroDiceCnt > 0;
            if (isTriggered) triggers.push('minus-switch-to');
            return {
                cmds: [{ cmd: 'getStatus', status: 301302, isOppo: true }],
                triggers,
                minusDiceHero: isCdt(isTriggered, 1),
                isQuickAction: isTriggered,
                execmds: isCdt(isTriggered, [{ cmd: 'discard', cnt: 1, mode: CMD_MODE.HighHandCard }]),
                exec: () => eheros.forEach(h => getObjById(h.heroStatus, 301302)?.dispose()),
            }
        }),

    313007: () => new CardBuilder(465).name('浪船').since('v5.5.0').vehicle().costSame(5).useCnt(2)
        .src('tmp/UI_Gcg_CardFace_Modify_Vehicle_LangChuan_1441176747')
        .description('【入场时：】为我方附属角色提供2点[护盾]。；【附属角色切换至后台时：】此牌[可用次数]+1。')
        .handle((card, event) => ({
            triggers: 'switch-from',
            isAddTask: true,
            cmds: [{ cmd: 'getStatus', status: 301304, hidxs: event.selectHeros }],
            exec: () => { card.addUseCnt() }
        })),

    321001: () => new CardBuilder(179).name('璃月港口').offline('v1').place().costSame(2)
        .description('【结束阶段：】抓2张牌。；[可用次数]：2。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/c9f669c64195790d3ca31ee6559360ab_669337352006808767.png'),

    321002: () => new CardBuilder(180).name('骑士团图书馆').offline('v1').place().costSame(0).costSame(1, 'v4.5.0')
        .description('【入场时：】选择任意元素骰重投。；【投掷阶段：】获得额外一次重投机会。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/cedc39cd65a6fde9ec51971973328b74_5542237863639059092.png'),

    321003: () => new CardBuilder(181).name('群玉阁').place().costSame(0)
        .description('【行动阶段开始时：】如果我方手牌数不多于3，则弃置此牌，生成1个[万能元素骰]。；【投掷阶段：】2个元素骰初始总是投出我方出战角色类型的元素。')
        .description('【投掷阶段：】2个元素骰初始总是投出我方出战角色类型的元素。', 'v4.5.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/a170755e85072e3672834ae9f4d558d5_593047424158919411.png'),

    321004: () => new CardBuilder(182).name('晨曦酒庄').place().costSame(2)
        .description('【我方执行行动｢切换角色｣时：】少花费1个元素骰。（每回合至多2次）')
        .description('【我方执行行动｢切换角色｣时：】少花费1个元素骰。（每回合1次）', 'v4.8.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/27ea1b01a7d0011b40c0180e4fba0490_7938002191515673602.png'),

    321005: () => new CardBuilder(183).name('望舒客栈').place().costSame(2)
        .description('【结束阶段：】治疗受伤最多的我方后台角色2点。；[可用次数]：2')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/7ae272a8b40944f34630e0ec54c22317_1223200541912838887.png'),

    321006: () => new CardBuilder(184).name('西风大教堂').offline('v1').place().costSame(2)
        .description('【结束阶段：】治疗我方出战角色2点。；[可用次数]：2')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/e47492f5cf0d78f285c20ac6b38c8ed3_5642129970809736301.png'),

    321007: () => new CardBuilder(185).name('天守阁').since('v3.7.0').place().costSame(2)
        .description('【行动阶段开始时：】如果我方的元素骰包含5种不同的元素，则生成1个[万能元素骰]。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a6f2b064d7711e30c742b802770bef71_3841942586663095539.png'),

    321008: () => new CardBuilder(186).name('鸣神大社').since('v3.6.0').place().costSame(2)
        .description('【每回合自动触发1次：】生成1个随机的基础元素骰。；[可用次数]：3')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/25bee82daa48f8018a4a921319ca2686_8817000056070129488.png'),

    321009: () => new CardBuilder(187).name('珊瑚宫').since('v3.7.0').place().costSame(2)
        .description('【结束阶段：】治疗所有我方角色1点。；[可用次数]：2')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2d016c4db4d3ce5c383d4fdb2a33f3e9_8583073738643262052.png'),

    321010: () => new CardBuilder(188).name('须弥城').since('v3.7.0').place().costSame(2)
        .description('【对角色打出｢天赋｣或我方角色使用技能时：】如果我方元素骰数量不多于手牌数量，则少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a659c38687c72bdd6244b9ef3c28390b_972040861793737387.png'),

    321011: () => new CardBuilder(189).name('桓那兰那').since('v3.7.0').offline('v1').place().costSame(0)
        .description('【结束阶段：】收集最多2个未使用的元素骰。；【行动阶段开始时：】拿回此牌所收集的元素骰。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d46d38ef070b2340e8ee9dfa697aad3f_8762501854367946191.png'),

    321012: () => new CardBuilder(190).name('镇守之森').since('v3.7.0').place().costSame(1)
        .description('【行动阶段开始时：】如果我方不是｢先手牌手｣，则生成1个出战角色类型的元素骰。；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/5a543775e68a6f02d0ba6526712d32c3_5028743115976906315.png'),

    321013: () => new CardBuilder(191).name('黄金屋').since('v4.0.0').place().costSame(0)
        .description('【我方打出原本元素骰至少为3的｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。（每回合1次）；[可用次数]：2')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/b8d17f6fa027ce2ae0d7032daf5b0ee8_2325912171963958867.png'),

    321014: () => new CardBuilder(192).name('化城郭').since('v4.1.0').place().costSame(1)
        .description('【我方选择行动前，元素骰为0时：】生成1个[万能元素骰]。（每回合1次）；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/5649867012fe98050232cf0b29c89609_1113164615099773768.png'),

    321015: () => new CardBuilder(193).name('风龙废墟').since('v4.2.0').place().costSame(2)
        .description('【入场时：】从牌组中随机抽取一张｢天赋｣牌。；【我方打出｢天赋｣牌，或我方角色使用原本元素骰消耗至少为4的技能时：】少花费1个元素骰。（每回合1次）；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/1812234f8a4cbd2445ce3bc1387df37c_4843239005964574553.png'),

    321016: () => new CardBuilder(309).name('湖中垂柳').since('v4.3.0').place().costSame(1)
        .description('【结束阶段：】如果我方手牌数量不多于2，则抓2张牌。；[可用次数]：2')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/15/258999284/3e8a5c300c5c01f7fedaac87bd641d92_296932138041166470.png'),

    321017: () => new CardBuilder(310).name('欧庇克莱歌剧院').since('v4.3.0').place().costSame(1)
        .description('【我方选择行动前：】如果我方角色所装备卡牌的原本元素骰费用总和不比对方更低，则生成1个出战角色类型的元素骰。（每回合1次）；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/d34719921cedd17675f38dccc24ebf43_8000545229587575448.png'),

    321018: () => new CardBuilder(344).name('梅洛彼得堡').since('v4.5.0').place().costSame(1)
        .description('【我方出战角色受到伤害或治疗后：】此牌累积1点｢禁令｣。（最多累积到4点）；【行动阶段开始时：】如果此牌已有4点｢禁令｣，则消耗4点，在敌方场上生成【sts301018】。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/41b42ed41f27f21f01858c0cdacd6286_8391561387795885599.png'),

    321019: () => new CardBuilder(357).name('清籁岛').since('v4.6.0').place().costSame(1)
        .description('【任意阵营的角色受到治疗后：】使该角色附属【sts301019】。；[持续回合]：2')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/2bfc84b730feaf6a350373080d97c255_2788497572764739451.png'),

    321020: () => new CardBuilder(388).name('赤王陵').since('v4.7.0').place().costSame(1)
        .description('【对方累积抓4张牌后：】弃置此牌，在对方牌库顶生成2张【crd301020】。然后直到本回合结束前，对方每抓1张牌，就立刻生成1张【crd301020】随机地置入对方牌库中。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/ad50dbbd94e8a1e52add8ad5efa5d61f_7946928210268600604.png'),

    321021: () => new CardBuilder(389).name('中央实验室遗址').since('v4.7.0').place().costSame(1)
        .description('【我方[舍弃]或[调和]1张牌后：】此牌累积1点｢实验进展｣。每当｢实验进展｣达到3点、6点、9点时，就获得1个[万能元素骰]。然后，如果｢实验进展｣至少为9点，则弃置此牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/519cc801980bbb5907f9a25ca017d03a_4463551389207387795.png'),

    321022: () => new CardBuilder(416).name('圣火竞技场').since('v5.0.0').place().costSame(2)
        .description('【我方使用技能或特技后：】此牌累积1点｢角逐之焰｣。；【｢角逐之焰｣达到2时：】生成1个随机基础元素骰。；【达到4时：】治疗我方出战角色2点。；【达到6时：】弃置此牌，使当前的我方出战角色在2回合内造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/24/258999284/1b4eb98d6fba0e8a0746a356a5d3f34c_7076497852083287608.png'),

    321023: () => new CardBuilder(429).name('特佩利舞台').since('v5.1.0').place().costSame(0)
        .description('【我方打出名称不存在于本局最初牌组的牌时：】此牌累积1点｢瞩目｣。；【敌方打出名称不存在于本局最初牌组的牌时：】此牌扣除1点｢瞩目｣。；【行动阶段开始时：】如果此牌有至少3点｢瞩目｣，则生成1个随机基础元素骰\\；如果此牌有至少1点｢瞩目｣，将1个元素骰转换为[万能元素骰]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/4b25dc7789eb47de50bf4f6d6001cfe6_5614159247725037900.png'),

    321024: () => new CardBuilder(441).name('｢悬木人｣').since('v5.2.0').place().costSame(0)
        .description('【我方打出名称不存在于本局最初牌组的牌时：】如果打出的牌元素骰费用不低于此牌的｢极限运动点｣，则生成1个随机基础元素骰，然后此牌累积1个｢极限运动点｣。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/19/258999284/ee6915d12a55c0a65c9bb6cc9e0d1885_4525633690549389172.png'),

    321025: () => new CardBuilder(450).name('｢流泉之众｣').since('v5.3.0').place().costSame(2)
        .description('【我方｢召唤物｣入场时：】使其[可用次数]+1。；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/15deff457845725502df383e62e7c440_8867444785716505365.png'),

    321026: () => new CardBuilder(458).name('｢花羽会｣').since('v5.4.0').place().costSame(0)
        .description('【我方[舍弃]2张卡牌后：】我方下一个后台角色获得1层“下次切换至前台时，回复1个对应元素的骰子”。（可叠加，每次触发一层）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/10/258999284/635fd5e4f710374bb0ee919f77dd1776_8605976792632571882.png'),

    321027: () => new CardBuilder(466).name('｢烟谜主｣').since('v5.5.0').place().costSame(0)
        .description('此牌初始具有4点【灵觉】。；【我方[挑选]后：灵觉】-1。；【行动阶段开始时：】若【灵觉】为0，则移除自身，然后从3个随机元素骰费用为2的支援牌中[挑选]一个生成。')
        .src('tmp/UI_Gcg_CardFace_Assist_Location_YanmiZhu_1307857034'),

    322001: () => new CardBuilder(194).name('派蒙').offline('v1').ally().costSame(3)
        .description('【行动阶段开始时：】生成2点[万能元素骰]。；[可用次数]：2。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/8b291b7aa846d8e987a9c7d60af3cffb_7229054083686130166.png'),

    322002: () => new CardBuilder(195).name('凯瑟琳').ally().costSame(1).costAny(2, 'v3.6.0')
        .description('【我方执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/67cf3f813876e6df62f21dc45c378fa3_4407562376050767664.png'),

    322003: () => new CardBuilder(196).name('蒂玛乌斯').offline('v1').ally().costSame(2).useCnt(1)
        .description('【入场时：】此牌附带2个｢合成材料｣。如果我方牌组中初始包含至少6张｢圣遗物｣，则从牌组中随机抽取一张｢圣遗物｣牌。；【结束阶段：】补充1个｢合成材料｣。；【打出｢圣遗物｣手牌时：】如可能，则支付等同于｢圣遗物｣总费用数量的｢合成材料｣，以免费装备此｢圣遗物｣（每回合1次）')
        .description('【入场时：】此牌附带2个｢合成材料｣。；【结束阶段：】补充1个｢合成材料｣。；【打出｢圣遗物｣手牌时：】如可能，则支付等同于｢圣遗物｣总费用数量的｢合成材料｣，以免费装备此｢圣遗物｣（每回合1次）', 'v4.3.0')
        .description('【入场时：】此牌附带2个｢合成材料｣。；【结束阶段：】补充1个｢合成材料｣。；【打出｢圣遗物｣手牌时：】如可能，则支付等同于｢圣遗物｣总费用数量的｢合成材料｣，以免费装备此｢圣遗物｣（每回合1次）；【触发上述效果后：】抓1张牌。（整场牌局限制1次）', 'v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/839e1884908b6ce5e8bc2d27bde98f20_778730297202034218.png'),

    322004: () => new CardBuilder(197).name('瓦格纳').offline('v1').ally().costSame(2).useCnt(1)
        .description('【入场时：】此牌附带2个｢锻造原胚｣。如果我方牌组中初始包含至少3种不同的｢武器｣，则从牌组中随机抽取一张｢武器｣牌。；【结束阶段：】补充1个｢锻造原胚｣。；【打出｢武器｣手牌时：】如可能，则支付等同于｢武器｣总费用数量的｢锻造原胚｣，以免费装备此｢武器｣（每回合1次）')
        .description('【入场时：】此牌附带2个｢锻造原胚｣。；【结束阶段：】补充1个｢锻造原胚｣。；【打出｢武器｣手牌时：】如可能，则支付等同于｢武器｣总费用数量的｢锻造原胚｣，以免费装备此｢武器｣（每回合1次）', 'v4.3.0')
        .description('【入场时：】此牌附带2个｢锻造原胚｣。；【结束阶段：】补充1个｢锻造原胚｣。；【打出｢武器｣手牌时：】如可能，则支付等同于｢武器｣总费用数量的｢锻造原胚｣，以免费装备此｢武器｣（每回合1次）；【触发上述效果后：】抓1张牌。（整场牌局限制1次）', 'v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/9a47df734f5bd5d52ce3ade67cf50cfa_2013364341657681878.png'),

    322005: () => new CardBuilder(198).name('卯师傅').offline('v1').ally().costSame(1)
        .description('【打出｢料理｣事件牌后：】生成1个随机基础元素骰。（每回合1次）；【打出｢料理｣事件牌后：】从牌组中随机抽取1张｢料理｣事件牌。（整场牌局限制1次）')
        .description('【打出｢料理｣事件牌后：】生成1个随机基础元素骰。（每回合1次）', 'v4.1.0')
        .description('【打出｢料理｣事件牌后：】掷骰并获得1个元素骰。（每回合1次）；【打出｢料理｣事件牌后：】从我方牌库底展示卡牌，直到出现1张｢料理｣事件牌为止，将这张｢料理｣事件牌加入手牌，然后将你的牌库洗牌。（整场牌局限制1次）', 'v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/430ad3710929867f9a4da3cb40812181_3109488257851299648.png'),

    322006: () => new CardBuilder(199).name('阿圆').ally().costSame(2)
        .description('【打出｢场地｣支援牌时：】少花费2个元素骰。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/0fa92f9ea49deff80274c1c4702e46e3_5650398579643580888.png'),

    322007: () => new CardBuilder(200).name('提米').offline('v1').ally().costSame(0)
        .description('【每回合自动触发1次：】此牌累积1只｢鸽子｣。；如果此牌已累积3只｢鸽子｣，则弃置此牌，抓1张牌，并生成1点[万能元素骰]。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/638d754606562a2ff5aa768e9e0008a9_2604997534782710176.png'),

    322008: () => new CardBuilder(201).name('立本').offline('v1').ally().costSame(0)
        .description('【结束阶段：】收集我方未使用的元素骰（每种最多1个）。；【行动阶段开始时：】如果此牌已收集3个元素骰，则抓2张牌，生成2点[万能元素骰]，然后弃置此牌。')
        .description('【结束阶段：】从你元素骰区中选择最多3个元素骰放到此牌上（每种最多1个）。；【行动阶段开始时：】如果此牌上有3个以上的元素骰，则抓2张牌，生成2点[万能元素骰]。', 'v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/dbe203124b2b61d17f0c46523679ee52_7625356549640398540.png'),

    322009: () => new CardBuilder(202).name('常九爷').ally().costSame(0)
        .description('【双方角色使用技能后：】如果造成了[物理伤害]、[穿透伤害]或引发了【元素反应】，此牌积累1个｢灵感｣。；如果此牌已积累3个｢灵感｣，弃置此牌并抓2张牌。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/df918cc6348b04d9f287c9b2f429c35c_3616287504640722699.png'),

    322010: () => new CardBuilder(203).name('艾琳').ally().costSame(2)
        .description('【我方角色使用本回合使用过的技能时：】少花费1个元素骰。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/8c0a0d6b2fab8ef94f09ed61451ec972_2061140384853735643.png'),

    322011: () => new CardBuilder(204).name('田铁嘴').offline('v1').ally().costAny(2)
        .description('【结束阶段：】我方一名充能未满的角色获得1点[充能]。（出战角色优先）；[可用次数]：2')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/163adc79a3050ea18fc75293e76f1a13_607175307652592237.png'),

    322012: () => new CardBuilder(205).name('刘苏').ally().costSame(1)
        .description('【我方切换到一个没有[充能]的角色后：】使我方出战角色获得1点[充能]。（每回合1次）；[可用次数]：2')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/2d2a294488e6a5ecff2af216d1a4a81c_2786433729730992349.png'),

    322013: () => new CardBuilder(206).name('花散里').since('v3.7.0').ally().costSame(0)
        .description('【召唤物消失时：】此牌累积1点｢大袚｣进度。（最多累积3点）；【我方打出｢武器｣或｢圣遗物｣装备时：】如果｢大袚｣进度已达到3，则弃置此牌，使打出的卡牌少花费2个元素骰。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/874298075217770b022b0f3a02261a2a_7985920737393426048.png'),

    322014: () => new CardBuilder(207).name('鲸井小弟').since('v3.7.0').ally().costSame(0)
        .description('【行动阶段开始时：】生成1点[万能元素骰]。然后，如果对方的支援区未满，则将此牌转移到对方的支援区。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/8d008ff3e1a2b0cf5b4b212e1509726c_1757117943857279627.png'),

    322015: () => new CardBuilder(208).name('旭东').since('v3.7.0').offline('v1').ally().costAny(2)
        .description('【打出｢料理｣事件牌时：】少花费2个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a23ea3b4f3cb6b2df59b912bb418f5b8_1362269257088452771.png'),

    322016: () => new CardBuilder(209).name('迪娜泽黛').since('v3.7.0').ally().costSame(1)
        .description('【打出｢伙伴｣支援牌时：】少花费1个元素骰。（每回合1次）；【打出｢伙伴｣支援牌后：】从牌组中随机抽取1张｢伙牌｣支援牌。（整场牌局限1次）')
        .description('【打出｢伙伴｣支援牌时：】少花费1个元素骰。（每回合1次）', 'v4.1.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f08622b4178df0e2856f22c5e89a5bbb_735371509950287883.png'),

    322017: () => new CardBuilder(210).name('拉娜').since('v3.7.0').ally().costSame(2)
        .description('【我方角色使用｢元素战技｣后：】生成1个我方下一个后台角色类型的元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f0c19a49595f68895e309e5bf5760c1f_8058110322505961900.png'),

    322018: () => new CardBuilder(211).name('老章').since('v3.8.0').offline('v1').ally().costSame(1)
        .description('【我方打出｢武器｣手牌时：】少花费1个元素骰\\；我方场上每有1个已装备｢武器｣的角色，就额外少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/c332425d700b588ed93ae01f9817e568_3896726709346713005.png'),

    322019: () => new CardBuilder(212).name('塞塔蕾').since('v4.0.0').ally().costSame(1)
        .description('【双方执行任何行动后，手牌数量为0时：】抓1张牌。；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/b4a9b32d9ff26697821d3cf0f2444ef7_7283838166930329300.png'),

    322020: () => new CardBuilder(213).name('弥生七月').since('v4.1.0').offline('v1').ally().costSame(1)
        .description('【我方打出｢圣遗物｣手牌时：】少花费1个元素骰\\；如果我方场上已有2个装备｢圣遗物｣的角色，就额外少花费1个元素骰。（每回合1次）')
        .description('【我方打出｢圣遗物｣手牌时：】少花费1个元素骰\\；如果我方场上每有1个装备｢圣遗物｣的角色，就额外少花费1个元素骰。（每回合1次）', 'v4.6.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/09820a12324bca69fe30277287462e2f_7162251245504180312.png'),

    322021: () => new CardBuilder(311).name('玛梅赫').since('v4.3.0').ally().costSame(0)
        .description('【我方打出｢玛梅赫｣以外的｢料理｣/｢场地｣/｢伙伴｣/｢道具｣行动牌后：】随机生成1张｢玛梅赫｣以外的｢料理｣/｢场地｣/｢伙伴｣/｢道具｣行动牌，将其加入手牌。（每回合1次）；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/eb0cb5b32a8c816b7f13c3d44d0a0fe4_6830305949958078300.png'),

    322022: () => new CardBuilder(329).name('婕德').since('v4.4.0').ally().costSame(1).costAny(2, 'v4.6.0')
        .description('此牌会记录本场对局中我方支援区弃置卡牌的数量，称为｢阅历｣。（最多6点〔[card]，当前为{dessptcnt}点〕）；【我方角色使用｢元素爆发｣后：】如果｢阅历｣至少为6，则弃置此牌，对我方出战角色附属【sts302205】。')
        .description('此牌会记录本场对局中我方支援区弃置卡牌的数量，称为｢阅历｣。（最多6点）；【我方角色使用｢元素爆发｣后：】如果｢阅历｣至少为5，则弃置此牌，生成【｢阅历｣-2】数量的[万能元素骰]。', 'v4.6.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/8931597db1022094e0ebdf3e91f5f44c_6917553066022383928.png'),

    322023: () => new CardBuilder(330).name('西尔弗和迈勒斯').since('v4.4.0').ally().costSame(1)
        .description('此牌会记录本场对局中敌方角色受到过的元素伤害种类数，称为｢侍从的周到｣。（最多4点〔[card]，当前为{eldmgcnt}点〕）；【结束阶段：】如果｢侍从的周到｣至少为3，则弃置此牌，然后抓｢侍从的周到｣点数的牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/e160832e6337e402fc01d5f89c042aa3_8868205734801507533.png'),

    322024: () => new CardBuilder(358).name('太郎丸').since('v4.6.0').ally().costAny(2)
        .description('【入场时：】生成4张【crd302202】，均匀地置入我方牌库中。；我方打出2张【crd302202】后：弃置此牌，召唤【smn302201】。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/21981b1c1976bec9d767097aa861227d_6685318429748077021.png'),

    322025: () => new CardBuilder(359).name('白手套和渔夫').since('v4.6.0').ally().costSame(0)
        .description('【结束阶段：】生成1张【crd302203】，随机将其置入我方牌库顶部5张牌之中。；如果此牌的[可用次数]仅剩1次，则抓1张牌。；[可用次数]：2')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/08e6d818575b52bd4459ec98798a799a_2502234583603653928.png'),

    322026: () => new CardBuilder(390).name('亚瑟先生').since('v4.7.0').ally().costSame(0)
        .description('【我方[舍弃]或[调和]1张牌后：】此牌累积1点｢新闻线索｣。（最多累积到2点）；【结束阶段：】如果此牌已累积2点｢新闻线索｣，则扣除2点，复制对方牌库顶的1张牌加入我方手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/c2b793adbb8201b2e886bfd05b55b216_2354473128226348221.png'),

    322027: () => new CardBuilder(404).name('瑟琳').since('v4.8.0').ally().costAny(2)
        .description('【每回合自动触发1次：】将1张随机的｢美露莘的声援｣放入我方手牌。；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/c4e68c446ec66d090c933d9765281e58_8386778533653121298.png'),

    322028: () => new CardBuilder(417).name('阿伽娅').since('v5.0.0').ally().costSame(1)
        .description('我方使用｢特技｣时：少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/24/258999284/10e2b03ab56591fdebdeadd3dcd091dc_4193411804004313763.png'),

    323001: () => new CardBuilder(214).name('参量质变仪').offline('v1').item().costAny(2)
        .description('【双方角色使用技能后：】如果造成了元素伤害，此牌积累1个｢质变进度｣。；此牌已累积3个｢质变进度｣时，弃置此牌并生成3个不同的基础元素骰。')
        .description('【双方角色使用技能后：】如果造成了元素伤害，此牌积累1个｢质变进度｣。；如果此牌已累积3个｢质变进度｣，则弃置此牌，投掷并获得3个元素骰。', 'v1')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/380f0bb73ffac88a2e8b60a1069a8246_3779576916894165131.png'),

    323002: () => new CardBuilder(215).name('便携营养袋').item().costSame(1).costSame(2, 'v4.1.0')
        .description('【入场时：】从牌组中随机抽取1张｢料理｣事件。；【我方打出｢料理｣事件牌时：】从牌组中随机抽取1张｢料理｣事件。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/ab41e76335be5fe031e9d2d6a4bc5cb1_7623544243734791763.png'),

    323003: () => new CardBuilder(216).name('红羽团扇').since('v3.7.0').item().costSame(2)
        .description('【我方切换角色后：】本回合中，我方执行的下次｢切换角色｣行动视为｢[快速行动]｣而非｢[战斗行动]｣，并且少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e48e87cff7b902011afa232be419b12a_7174729288626413060.png'),

    323004: () => new CardBuilder(217).name('寻宝仙灵').since('v3.7.0').offline('v1').item().costSame(1)
        .description('【我方角色使用技能后：】此牌累积1个｢寻宝线索｣。；当此牌已累积3个｢寻宝线索｣时，弃置此牌并抓3张牌。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/4321ae941ccf75069eb630547df61e3c_1672242083656433331.png'),

    323005: () => new CardBuilder(312).name('化种匣').since('v4.3.0').item().costSame(0)
        .description('【我方打出原本元素骰费用至少为2的支援牌时：】少花费1个元素骰。（每回合1次）；[可用次数]：2')
        .description('【我方打出原本元素骰费用为1的支援牌时：】少花费1个元素骰。（每回合1次）；[可用次数]：2', 'v4.6.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/3a16ca3da02eaf503cc8169d5e29e938_8021832463219302062.png'),

    323006: () => new CardBuilder(313).name('留念镜').since('v4.3.0').item().costSame(1)
        .description('【我方打出｢武器｣/｢圣遗物｣/｢场地｣/｢伙伴｣手牌时：】如果本场对局中我方曾经打出过所打出牌的同名卡牌，则少花费2个元素骰。（每回合1次）；[可用次数]：2')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/aa32049459ce38daffbfe5dc82eb9303_2738230079920133028.png'),

    323007: () => new CardBuilder(345).name('流明石触媒').since('v4.5.0').item().costAny(3).costSame(2, 'v4.8.0').useCnt(0).isResetUseCnt()
        .description('【我方打出行动牌后：】如果此牌在场期间本回合中我方已打出3张行动牌，则抓1张牌并生成1个[万能元素骰]。（每回合1次〔[support]，当前已打出{unt}张〕）；[可用次数]：3')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/f705b86904d8413be39df62741a8c81e_885257763287819413.png'),

    323008: () => new CardBuilder(391).name('苦舍桓').since('v4.7.0').item().costSame(1).costSame(0, 'v4.8.0')
        .description('【行动阶段开始时：】[舍弃]最多2张原本元素骰费用最高的手牌，每[舍弃]1张，此牌就累积1点｢记忆和梦｣。（最多2点）；【我方角色使用技能时：】如果我方本回合未打出过行动牌，则消耗1点｢记忆和梦｣，以使此技能少花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/67607b9684e9fb62a44f68c0f3a2e30c_5397809820905590818.png'),

    330001: () => new CardBuilder(218).name('旧时庭园').since('v3.8.0').legend().costSame(0)
        .description('【我方有角色已装备｢武器｣或｢圣遗物｣时，才能打出：】本回合中，我方下次打出｢武器｣或｢圣遗物｣装备牌时少花费2个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/cd9d8158b2361b984da8c061926bb636_390832108951639145.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            return { status: 300001, isValid: heros.some(h => h.weaponSlot != null || h.artifactSlot != null) }
        }),

    330002: () => new CardBuilder(219).name('磐岩盟契').since('v3.8.0').legend().costSame(0)
        .description('【我方剩余元素骰数量为0时，才能打出：】生成2个不同的基础元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/194eb0cdc9200aca52848d54b971743f_2099934631074713677.png')
        .handle((_, event) => ({ cmds: [{ cmd: 'getDice', cnt: 2, mode: CMD_MODE.Random }], isValid: event.dicesCnt == 0 })),

    330003: () => new CardBuilder(220).name('愉舞欢游').since('v4.0.0').legend().costSame(0)
        .description('【我方出战角色的元素类型为‹1冰›/‹2水›/‹3火›/‹4雷›/‹7草›时，才能打出：】对我方所有具有元素附着的角色，附着我方出战角色类型的元素。')
        .description('【我方出战角色的元素类型为‹1冰›/‹2水›/‹3火›/‹4雷›/‹7草›时，才能打出：】对我方所有角色，附着我方出战角色类型的元素。', 'v4.2.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/f11867042dd52c75e73d7b2e68b03430_7080334454031898922.png')
        .handle((_, event, ver) => {
            const { hero, heros } = event;
            const elements: ElementType[] = [ELEMENT_TYPE.Cryo, ELEMENT_TYPE.Hydro, ELEMENT_TYPE.Pyro, ELEMENT_TYPE.Electro, ELEMENT_TYPE.Dendro];
            const hidxs = allHidxs(heros, { cdt: h => ver.lt('v4.2.0') || h.attachElement.length > 0 });
            const isValid = !!hero && elements.includes(hero.element) && hidxs.length > 0;
            return { cmds: [{ cmd: 'attach', hidxs }], isValid }
        }),

    330004: () => new CardBuilder(221).name('自由的新风').since('v4.1.0').legend().costSame(0)
        .description('【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；【[可用次数]：】1')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/bccf12a9c926bec7203e543c469ac58d_1423280855629304603.png')
        .handle(() => ({ status: 300002 })),

    330005: () => new CardBuilder(222).name('万家灶火').since('v4.2.0').legend().costSame(0)
        .description('【第1回合打出此牌时：】如果我方牌组中初始包含至少2张不同的｢天赋｣牌，则抓1张｢天赋｣牌。；【第2回合及以后打出此牌时：】我方抓【当前回合数-1】数量的牌。（最多抓4张〔，当前为回合{round}〕）')
        .description('我方抓【当前回合数-1】数量的牌。（最多抓4张）', 'v4.7.0')
        .description('我方抓【当前回合数】数量的牌。（最多抓4张）', 'v4.4.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/4c214784418f974b6b3fa294b415cdb4_8205569284186975732.png')
        .handle((_, event, ver) => {
            const { round = 1, playerInfo: { talentTypeCnt = 0 } = {} } = event;
            if (ver.lt('v4.4.0')) return { cmds: [{ cmd: 'getCard', cnt: Math.min(4, round) }] }
            if (ver.lt('v4.7.0')) return { cmds: [{ cmd: 'getCard', cnt: Math.min(4, round - 1) }], isValid: round > 1 }
            if (round > 1) return { cmds: [{ cmd: 'getCard', cnt: Math.min(4, round - 1) }] }
            return { cmds: [{ cmd: 'getCard', subtype: CARD_SUBTYPE.Talent, cnt: 1, isAttach: true }], isValid: talentTypeCnt >= 2 }
        }),

    330006: () => new CardBuilder(314).name('裁定之时').since('v4.3.0').legend().costSame(1)
        .description('本回合中，对方牌手打出的3张｢事件牌｣无效。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/9ed8846c18cdf85e9b451a702d91c6e8_6360061723145748301.png')
        .handle(() => ({ statusOppo: 300003 })),

    330007: () => new CardBuilder(346).name('抗争之日·碎梦之时').since('v4.5.0').legend().costSame(0).canSelectHero(1)
        .description('本回合中，目标我方角色受到的伤害-1。（最多生效4次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/035d9f63a863e8ad26cb6ecf62725411_2229767666746467527.png')
        .handle(() => ({ status: 300004 })),

    330008: () => new CardBuilder(392).name('旧日鏖战').since('v4.7.0').legend().costSame(1)
        .description('敌方出战角色失去1点[充能]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/e09e62a684575d632c731f3725280df2_7385957084481452662.png')
        .handle((_, event) => ({
            isValid: !!event.eheros?.find(h => h.isFront)?.energy,
            cmds: [{ cmd: 'getEnergy', cnt: -1, isOppo: true }],
        })),

    330009: () => new CardBuilder(418).name('赦免宣告').since('v5.0.0').legend().costSame(1).canSelectHero(1)
        .description('本回合中，目标角色免疫冻结、眩晕、石化等无法使用技能的效果，并且该角色为｢出战角色｣时不会因效果而切换。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/24/258999284/76e84615db9526436d399c79aaa9d47a_2755116418615718064.png')
        .handle(() => ({ status: 300005 })),

    330010: () => new CardBuilder(451).name('归火圣夜巡礼').since('v5.3.0').legend().costSame(0)
        .description('在双方场上生成【crd300006】，然后我方场上的【crd300006】的｢斗志｣+1。（【crd300006】会将各自阵营对对方造成的伤害记录为｢斗志｣，每回合行动阶段开始时｢斗志｣较高的一方会清空｢斗志｣，使当前出战角色在本回合中造成的伤害+1。）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/30/258999284/d672bab118d384d06e9422e74c47b50b_903174325403791558.png')
        .handle((_, event) => {
            const { supports = [], esupports = [] } = event;
            const spt300006 = supports.find(s => s.card.id == 300006);
            return {
                support: isCdt(!spt300006, [[300006, 1]]),
                supportOppo: isCdt(esupports.every(s => s.card.id != 300006), 300006),
                exec: () => { spt300006 && ++spt300006.cnt }
            }
        }),

    331101: () => elCard(223, ELEMENT_TYPE.Cryo)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3c2290805dd2554703ca4c5be3ae6d8a_7656625119620764962.png'),

    331102: () => new CardBuilder(224).name('元素共鸣：粉碎之冰').offline('v1').subtype(CARD_SUBTYPE.ElementResonance).costCryo(1)
        .description('本回合中，我方当前出战角色下一次造成的伤害+2。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75833613/4bbbf27e898aeace567039c5c2bb2a7c_4533106343661611310.png')
        .handle((_, { hero }) => ({ status: 303112, hidxs: [hero?.hidx ?? -1] })),

    331201: () => elCard(225, ELEMENT_TYPE.Hydro)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/4111a176d3936db8220047ff52e37c40_264497451263620555.png'),

    331202: () => new CardBuilder(226).name('元素共鸣：愈疗之水').offline('v1').subtype(CARD_SUBTYPE.ElementResonance).costHydro(1)
        .description('治疗我方出战角色2点。然后，治疗我方所有后台角色1点。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/2735fa558713779ca2f925701643157a_7412042337637299588.png')
        .handle((_, event) => {
            const { heros = [], hero } = event;
            return {
                cmds: [
                    { cmd: 'heal', cnt: 2, hidxs: [hero?.hidx ?? -1] },
                    { cmd: 'heal', cnt: 1, hidxs: getBackHidxs(heros) },
                ],
                isValid: heros.some(h => h.hp < h.maxHp),
            }
        }),

    331301: () => elCard(227, ELEMENT_TYPE.Pyro)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/a37ec2ccbb719551f14586a51609a049_6190862804933467057.png'),

    331302: () => new CardBuilder(228).name('元素共鸣：热诚之火').offline('v1').subtype(CARD_SUBTYPE.ElementResonance).costPyro(1)
        .description('本回合中，我方当前出战角色下一次引发[火元素相关反应]时，造成的伤害+3。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/82515ce0a16de7f3fba6e02232545230_5475039957819136120.png')
        .handle((_, { hero }) => ({ status: 303132, hidxs: [hero?.hidx ?? -1] })),

    331401: () => elCard(229, ELEMENT_TYPE.Electro)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/d7a7653168cd80943a50578aa1251f7a_1527724411934371635.png'),

    331402: () => new CardBuilder(230).name('元素共鸣：强能之雷').offline('v1').subtype(CARD_SUBTYPE.ElementResonance).costElectro(1)
        .description('我方出战角色和下一名充能未满的角色获得1点[充能]。')
        .description('我方一名充能未满的角色获得1点[充能]。（出战角色优先）', 'v5.5.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/24c0eec5aa696696abeacd2a9ab2e443_2548840222933909920.png')
        .handle((_, event, ver) => {
            const { heros = [], hero } = event;
            const hidxs: number[] = [];
            for (const chidx of (ver.lt('v5.5.0') ? allHidxs : getBackHidxs)(heros)) {
                const chero = heros[chidx];
                if (chero.energy < chero.maxEnergy) {
                    hidxs.push(chidx);
                    break;
                }
            }
            if (ver.gte('v5.5.0') && hero && hero.energy < hero.maxEnergy) hidxs.unshift(hero.hidx);
            return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }], isValid: hidxs.length > 0 }
        }),

    331501: () => elCard(231, ELEMENT_TYPE.Anemo)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/f3fdbb9e308bfd69c04aa4e6681ad71d_7543590216853591638.png'),

    331502: () => new CardBuilder(232).name('元素共鸣：迅捷之风').offline('v1').subtype(CARD_SUBTYPE.ElementResonance).costAnemo(1)
        .description('【我方下次执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣，并且少花费1个元素骰。；我方下次触发扩散反应时对目标以外的所有敌方角色造成的伤害+1。')
        .description('切换到目标角色，并生成1点[万能元素骰]。', 'v5.5.0').canSelectHero(1, 'v5.5.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/707f537df32de90d61b3ac8e8dcd4daf_7351067372939949818.png')
        .handle((_, event, ver) => {
            if (ver.lt('v5.5.0')) {
                const { heros = [], selectHeros } = event;
                return {
                    cmds: [{ cmd: 'switch-to', hidxs: selectHeros }, { cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }],
                    canSelectHero: heros.map(h => !h.isFront && h.hp > 0),
                }
            }
            return { status: [303133, 303134] }
        }),

    331601: () => elCard(233, ELEMENT_TYPE.Geo)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/cdd36a350467dd02ab79a4c49f07ba7f_4199152511760822055.png'),

    331602: () => new CardBuilder(234).name('元素共鸣：坚定之岩').offline('v1').subtype(CARD_SUBTYPE.ElementResonance).costGeo(1)
        .description('为我方出战角色提供3点[护盾]。')
        .description('本回合中，我方角色下一次造成[岩元素伤害]后：如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充3点[护盾]。', 'v5.5.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/504be5406c58bbc3e269ceb8780eaa54_8358329092517997158.png')
        .handle(() => ({ status: 303162 })),

    331701: () => elCard(235, ELEMENT_TYPE.Dendro)
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/f6109c65a24602b1ad921d5bd5f94d97_2028353267602639806.png'),

    331702: () => new CardBuilder(236).name('元素共鸣：蔓生之草').offline('v1').subtype(CARD_SUBTYPE.ElementResonance).costDendro(1)
        .description('若我方场上存在【smn115】/【sts116】/【sts117】，则对对方出战角色造成1点[火元素伤害]/[水元素伤害]/[雷元素伤害]。')
        .description('本回合中，我方角色下一次引发元素反应时，造成的伤害+2。；使我方场上的｢【smn115】｣、｢【sts116】｣和｢【sts117】｣[可用次数]+1。', 'v5.5.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/af52f6c4f7f85bb3d3242778dc257c5c_1159043703701983776.png')
        .handle((_, event, ver) => {
            const { combatStatus = [], summons = [] } = event;
            if (ver.lt('v5.5.0')) {
                return {
                    status: 303172,
                    exec: () => {
                        combatStatus.forEach(ost => (ost.id == 116 || ost.id == 117) && ost.addUseCnt(true));
                        summons.forEach(smn => smn.id == 115 && smn.addUseCnt(true));
                    }
                }
            }
            const cmds: Cmds[] = [];
            const hasSts117 = hasObjById(combatStatus, 117);
            if (hasSts117) cmds.push({ cmd: 'attack', cnt: 1, element: DAMAGE_TYPE.Electro });
            if ((getObjById(combatStatus, 116)?.useCnt ?? 0) > +hasSts117) cmds.push({ cmd: 'attack', cnt: 1, element: DAMAGE_TYPE.Hydro });
            if (hasObjById(summons, 115)) cmds.push({ cmd: 'attack', cnt: 1, element: DAMAGE_TYPE.Pyro });
            cmds.forEach((_, i, a) => a[i].mode = i);
            return { cmds, isValid: cmds.length > 0 }
        }),

    331801: () => new CardBuilder(237).name('风与自由').since('v3.7.0').tag(CARD_TAG.LocalResonance).costSame(0).costSame(1, 'v4.3.0')
        .description('【本回合中，我方角色使用技能后：】将下一个我方后台角色切换到场上。')
        .description('【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；【[可用次数]：】1', 'v4.1.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/5a34fd4bfa32edfe062f0f6eb76106f4_4397297165227014906.png')
        .handle((_, event, ver) => {
            const { heros = [] } = event;
            return { isValid: ver.lt('v4.1.0') || allHidxs(heros).length > 1, status: 303181 }
        }),

    331802: () => new CardBuilder(238).name('岩与契约').since('v3.7.0').tag(CARD_TAG.LocalResonance).costAny(3)
        .description('【下回合行动阶段开始时：】生成3点[万能元素骰]，并抓1张牌。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/7ffbf85a7089e25fc48f6a48826e1fa4_183114830191275147.png')
        .handle(() => ({ status: 303182 })),

    331803: () => new CardBuilder(239).name('雷与永恒').since('v3.7.0').tag(CARD_TAG.LocalResonance).costSame(0)
        .description('将我方所有元素骰转换为[万能元素骰]。')
        .description('将我方所有元素骰转换为当前出战角色的元素。', 'v4.0.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/760c101ed6ef3b500a830ae430458d89_4230653799114143139.png')
        .handle((_, _e, ver) => ({ cmds: [{ cmd: 'changeDice', mode: isCdt(ver.lt('v4.0.0'), CMD_MODE.FrontHero) }] })),

    331804: () => new CardBuilder(240).name('草与智慧').since('v3.7.0').tag(CARD_TAG.LocalResonance).costSame(1)
        .description('抓1张牌。然后，选择任意手牌替换。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/1c656067801c6beb53803faefedd0a47_7333316108362576471.png')
        .handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 1 }, { cmd: 'changeCard' }] })),

    331805: () => new CardBuilder(393).name('水与正义').since('v4.7.0').tag(CARD_TAG.LocalResonance).costAny(2)
        .description('平均分配我方未被击倒的角色的生命值，然后治疗所有我方角色1点。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/e4ef932872a23852c3c2a7912e5f7d77_449791480408929176.png')
        .handle((_, event) => {
            const { heros = [], hero } = event;
            if (!hero) return;
            const hidxs = allHidxs(heros);
            const cmds: Cmds[] = [];
            if (hidxs.length > 1) {
                const allHp = heros.reduce((a, c) => c.hp > 0 ? a + c.hp : a, 0);
                const baseHp = Math.floor(allHp / hidxs.length);
                const fhps = Array.from({ length: heros.length }, (_, hpi) => heros[hpi].hp > 0 ? baseHp : -1);
                let restHp = allHp - baseHp * hidxs.length;
                for (let i = 0; i < heros.length; ++i) {
                    const hi = (hero.hidx + i) % heros.length;
                    if (fhps[hi] == -1) continue;
                    if (restHp-- <= 0) break;
                    ++fhps[hi];
                }
                for (let i = 0; i < heros.length; ++i) {
                    if (fhps[i] == -1) continue;
                    const chp = fhps[i] - heros[i].hp;
                    if (chp == 0) continue;
                    const isOppo = chp > 0;
                    const cmd = !isOppo ? 'attack' : 'heal';
                    const element = isCdt(!isOppo, DAMAGE_TYPE.Pierce);
                    cmds.push({ cmd, cnt: Math.abs(chp), element, isOppo: false, hidxs: [i], isAttach: isOppo });
                }
            }
            cmds.push({ cmd: 'heal', cnt: 1, hidxs, mode: 1 });
            return { cmds }
        }),

    332001: () => new CardBuilder(241).name('最好的伙伴！').offline('v1').event().costAny(2)
        .description('将所花费的元素骰转换为2个[万能元素骰]。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/3fc6d26bb7b306296834c0b14abd4bc6_3989407061293772527.png')
        .handle(() => ({ cmds: [{ cmd: 'getDice', cnt: 2, element: DICE_COST_TYPE.Omni }] })),

    332002: () => new CardBuilder(242).name('换班时间').offline('v1').event().costSame(0)
        .description('【我方下次执行｢切换角色｣行动时：】少花费1个元素骰。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/c512c490a548f8322503c59c9d87c89a_5960770686347735037.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            return { isValid: allHidxs(heros).length > 1, status: 303202 }
        }),

    332003: () => new CardBuilder(243).name('一掷乾坤').offline('v1').event().costSame(0)
        .description('选择任意元素骰【重投】，可重投2次。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/524d3e5c5e6f3fad28a931abd9c7bb92_2495658906309226331.png')
        .handle(() => ({ cmds: [{ cmd: 'reroll', cnt: 2 }] })),

    332004: () => new CardBuilder(244).name('运筹帷幄').offline('v1').event().costSame(1)
        .description('抓2张牌。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/88a4ec8b97063fad015a9112ee352a88_3657371852718944273.png')
        .handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 2 }] })),

    332005: () => new CardBuilder(245).name('本大爷还没有输！').offline('v1').event().costSame(0)
        .description('【本回合有我方角色被击倒，才能打出：】生成1个[万能元素骰]，我方当前出战角色获得1点[充能]。（每回合中，最多只能打出1张此牌）')
        .description('【本回合有我方角色被击倒，才能打出：】生成1个[万能元素骰]，我方当前出战角色获得1点[充能]。', 'v4.0.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/a1ae1067afcf9899a958c166b7b32fa0_5333005492197066238.png')
        .handle((_, event, ver) => {
            const { heros = [], combatStatus = [] } = event;
            return {
                isValid: (ver.lt('v4.0.0') || !hasObjById(combatStatus, 303205)) && heros.some(h => h.hp == -1),
                cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }, { cmd: 'getEnergy', cnt: 1 }],
                status: isCdt(ver.gte('v4.0.0'), 303205),
            }
        }),

    332006: () => new CardBuilder(246).name('交给我吧！').offline('v1').event().costSame(0)
        .description('【我方下次执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/182f87b4ad80bc18e051098c8d73ba98_7868509334361476394.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            return { isValid: allHidxs(heros).length > 1, status: 303206 }
        }),

    332007: () => new CardBuilder(247).name('鹤归之时').offline('v1').event().costSame(1)
        .description('【我方下一次使用技能后：】将下一个我方后台角色切换到场上。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/4b9215f7e25ed9581698b45f67164395_8716418184979886737.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            return { isValid: allHidxs(heros).length > 1, status: 303207 }
        }),

    332008: () => new CardBuilder(248).name('星天之兆').offline('v1').event().costAny(2)
        .description('我方当前出战角色【获得1点[充能]】。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/e6e557f4dd2762ecb727e14c66bafb57_828613557415004800.png')
        .handle((_, event) => {
            const { hero } = event;
            if (!hero) return;
            return { cmds: [{ cmd: 'getEnergy', cnt: 1 }], isValid: hero.energy < hero.maxEnergy }
        }),

    332009: () => new CardBuilder(249).name('白垩之术').offline('v1').event().costSame(0)
        .description('从最多2个我方后台角色身上，转移1点[充能]到我方出战角色。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/567c17051137fdd9e5c981ea584df298_4305321690584111415.png')
        .handle((_, event) => {
            const { heros = [], hero } = event;
            let isNeedEnergy = true;
            let hasEnergy = false;
            heros.forEach(h => {
                if (h.isFront) isNeedEnergy = h.energy < h.maxEnergy;
                else hasEnergy ||= h.energy > 0;
            });
            return {
                isValid: isNeedEnergy && hasEnergy,
                exec: () => {
                    let getEnergy = 0;
                    const fhidx = hero?.hidx ?? -1;
                    for (let i = 1; i < heros.length; ++i) {
                        const h = heros[(i + fhidx) % heros.length];
                        if (getEnergy >= 2) break;
                        if (h.energy == 0) continue;
                        --h.energy;
                        ++getEnergy;
                    }
                    if (fhidx > -1) heros[fhidx].energy = Math.min(heros[fhidx].energy + getEnergy, heros[fhidx].maxEnergy);
                }
            }
        }),

    332010: () => new CardBuilder(250).name('诸武精通').event().costSame(0).canSelectHero(2)
        .description('将一个装备在我方角色的｢武器｣装备牌，转移给另一个武器类型相同的我方角色，并重置其效果的｢每回合｣次数限制。')
        .description('将一个装备在我方角色的｢武器｣装备牌，转移给另一个武器类型相同的我方角色。', 'v4.1.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/05625ae4eed490d0958191d8022174cd_5288127036517503589.png')
        .handle((_, event, ver) => {
            const { heros = [], selectHeros = [] } = event;
            const selectCnt = selectHeros.length;
            let canSelectHero: boolean[] = heros.map(() => false);
            if (selectCnt == 0) {
                canSelectHero = heros.map(h => h.weaponSlot != null);
            } else if (selectCnt == 1) {
                const selectHero = heros[selectHeros[0]];
                canSelectHero = heros.map(h => h.weaponType == selectHero?.weaponType && h.hp > 0);
            }
            return {
                canSelectHero,
                exec: () => {
                    const [fromHeroIdx, toHeroIdx] = selectHeros;
                    const fromHero = heros[fromHeroIdx];
                    const toHero = heros[toHeroIdx];
                    const fromWeapon = fromHero.weaponSlot;
                    if (fromWeapon) {
                        fromHero.weaponSlot = null;
                        if (ver.gte('v4.1.0')) fromWeapon.handle(fromWeapon, { reset: true });
                        toHero.weaponSlot = fromWeapon;
                    }
                }
            }
        }),

    332011: () => new CardBuilder(251).name('神宝迁宫祝词').offline('v1').event().costSame(0).canSelectHero(2)
        .description('将一个装备在我方角色的｢圣遗物｣装备牌，转移给另一个我方角色，并重置其效果的｢每回合｣次数限制。')
        .description('将一个装备在我方角色的｢圣遗物｣装备牌，转移给另一个我方角色。', 'v4.1.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/a67aefe7f7473b2bc9f602917bad9c5f_6329604065139808609.png')
        .handle((_, event, ver) => {
            const { heros = [], selectHeros = [] } = event;
            const selectCnt = selectHeros.length;
            return {
                canSelectHero: selectCnt == 0 ? heros.map(h => h.artifactSlot != null) : heros.map(h => h.hp > 0),
                exec: () => {
                    const [fromHeroIdx, toHeroIdx] = selectHeros;
                    const fromHero = heros[fromHeroIdx];
                    const toHero = heros[toHeroIdx];
                    const fromArtifact = fromHero.artifactSlot;
                    if (fromArtifact) {
                        fromHero.artifactSlot = null;
                        if (ver.gte('v4.1.0')) fromArtifact.handle(fromArtifact, { reset: true });
                        toHero.artifactSlot = fromArtifact;
                    }
                }
            }
        }),

    332012: () => new CardBuilder(252).name('快快缝补术').offline('v1').event().costSame(1).canSelectSummon(1)
        .description('选择一个我方｢召唤物｣，使其[可用次数]+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/1ede638fa4bb08aef24d03edf5c5d1d9_6232288201967488424.png')
        .handle((_, event) => {
            const { pidx = -1, summons = [], selectSummon = -1 } = event;
            const summonCnt = INIT_SUMMONCNT();
            if (selectSummon > -1 && pidx > -1) summonCnt[pidx][selectSummon] = 1;
            return { summonCnt, exec: () => summons[selectSummon]?.addUseCnt(true) }
        }),

    332013: () => new CardBuilder(253).name('送你一程').offline('v1').event().costAny(2).canSelectSummon(0)
        .description('选择一个敌方｢召唤物｣，使其[可用次数]-2。')
        .description('选择一个敌方｢召唤物｣，将其消灭。', 'v3.7.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/c0c1b91fe602e0d29159e8ae5effe537_7465992504913868183.png')
        .handle((_, event, ver) => {
            const { pidx = -1, esummons = [], selectSummon = -1 } = event;
            const summonCnt = INIT_SUMMONCNT();
            if (selectSummon > -1 && pidx > -1) summonCnt[pidx ^ 1][selectSummon] = ver.lt('v3.7.0') ? -100 : -2;
            return {
                summonCnt,
                exec: () => {
                    const selectSmn = esummons[selectSummon];
                    if (ver.lt('v3.7.0')) selectSmn.dispose();
                    else selectSmn.minusUseCnt(2);
                }
            }
        }),

    332014: () => new CardBuilder(254).name('护法之誓').event().costSame(4)
        .description('消灭所有｢召唤物｣。（不分敌我！）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/9df79dcb5f6faeed4d1f1b286dcaba76_1426047687046512159.png')
        .handle((_, event) => {
            const summonCnt = INIT_SUMMONCNT();
            summonCnt.forEach(s => s.fill(-100));
            return {
                summonCnt,
                exec: () => {
                    const { summons = [], esummons = [] } = event;
                    summons.forEach(smn => smn.dispose());
                    esummons.forEach(smn => smn.dispose());
                }
            }
        }),

    332015: () => new CardBuilder(255).name('深渊的呼唤').tag(CARD_TAG.LocalResonance).costSame(2)
        .description('召唤一个随机｢丘丘人｣召唤物！').explain('smn303211', 'smn303212', 'smn303213', 'smn303214')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/011610bb3aedb5dddfa1db1322c0fd60_7383120485374723900.png')
        .handle((_, event) => {
            const { summons = [], randomInArr, isExec } = event;
            if (summons.length == MAX_SUMMON_COUNT) return { isValid: false }
            if (!isExec || !randomInArr) return;
            const smnIds = [303211, 303212, 303213, 303214].filter(sid => !hasObjById(summons, sid));
            return { summon: randomInArr(smnIds) }
        }),

    332016: () => new CardBuilder(256).name('愚人众的阴谋').since('v3.7.0').tag(CARD_TAG.LocalResonance).costSame(2)
        .description('在对方场上，生成1个随机类型的｢愚人众伏兵｣。').explain('sts303216', 'sts303217', 'sts303218', 'sts303219')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/388f7b09c6abb51bf35cdf5799b20371_5031929258147413659.png')
        .handle((_, event) => {
            const { eCombatStatus = [], randomInArr, isExec } = event;
            if (!isExec || !randomInArr) return;
            const stsIds = [303216, 303217, 303218, 303219].filter(sid => !hasObjById(eCombatStatus, sid));
            return { statusOppo: randomInArr(stsIds) }
        }),

    332017: () => new CardBuilder(257).name('下落斩').since('v3.7.0').event(true).costSame(3).canSelectHero(1)
        .description('[战斗行动]：切换到目标角色，然后该角色进行｢普通攻击｣。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/a3aa3a8c13499a0c999fc765c4a0623d_2838069371786460200.png')
        .handle((_, event) => {
            const { heros = [], selectHeros } = event;
            return {
                cmds: [{ cmd: 'switch-to', hidxs: selectHeros }, { cmd: 'useSkill', cnt: SKILL_TYPE.Normal }],
                canSelectHero: heros.map(h => !h.isFront && h.hp > 0 && h.heroStatus.every(s => !s.hasType(STATUS_TYPE.NonAction))),
                notPreview: true,
            }
        }),

    332018: () => new CardBuilder(258).name('重攻击').since('v3.7.0').event().costSame(1)
        .description('本回合中，当前我方出战角色下次｢普通攻击｣造成的伤害+1。；【此次｢普通攻击｣为[重击]时：】伤害额外+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/563473c5f59960d334e2105c1571a982_2028527927557315162.png')
        .handle((_, { hero }) => ({ status: 303220, hidxs: [hero?.hidx ?? -1] })),

    332019: () => new CardBuilder(259).name('温妮莎传奇').since('v3.7.0').event().costSame(3)
        .description('生成4个不同类型的基础元素骰。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/e8473742fd9e3966ccba393f52a1915a_7280949762836305617.png')
        .handle(() => ({ cmds: [{ cmd: 'getDice', cnt: 4, mode: CMD_MODE.Random }] })),

    332020: () => new CardBuilder(260).name('永远的友谊').since('v3.7.0').event().costSame(2)
        .description('牌数小于4的牌手抓牌，直到手牌数各为4张。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/31/183046623/d5a778eb85b98892156d269044c54147_5022722922597227063.png')
        .handle((_, event) => {
            const { hcards: { length: hcardsCnt } = [], ehcardsCnt = 0 } = event;
            const cmds: Cmds[] = [];
            if (hcardsCnt < 4) cmds.push({ cmd: 'getCard', cnt: 4 - hcardsCnt });
            if (ehcardsCnt < 4) cmds.push({ cmd: 'getCard', cnt: 4 - ehcardsCnt, isOppo: true });
            return { cmds, isValid: cmds.length > 0 }
        }),

    332021: () => new CardBuilder(261).name('大梦的曲调').since('v3.8.0').event().costSame(0)
        .description('【我方下次打出｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/ebb47b7bd7d4929bbddae2179d46bc28_2360293196273396029.png')
        .handle(() => ({ status: 302021 })),

    332022: () => new CardBuilder(262).name('藏锋何处').since('v4.0.0').event().costSame(0).canSelectHero(1)
        .description('将一个我方角色所装备的｢武器｣返回手牌。；【本回合中，我方下一次打出｢武器｣手牌时：】少花费2个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/888e75a6b80b0f407683eb2af7d25882_7417759921565488584.png')
        .handle((_, event) => {
            const { hero, heros = [] } = event;
            return {
                status: 303222,
                canSelectHero: heros.map(h => h.weaponSlot != null),
                cmds: [{ cmd: 'getCard', cnt: 1, card: isCdt(!!hero?.weaponSlot, () => hero!.weaponSlot!.id) }],
                exec: () => { hero!.weaponSlot = null },
            }
        }),

    332023: () => new CardBuilder(263).name('拳力斗技！').since('v4.1.0').event().costSame(0)
        .description('【我方至少剩余8个元素骰，且对方未宣布结束时，才能打出：】本回合中一位牌手先宣布结束时，未宣布结束的牌手抓2张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/fa58de973ea4811ffe1812487dfb51c4_1089814927914226900.png')
        .handle((_, event) => {
            const { dicesCnt = 0, ephase = -1 } = event;
            const isValid = dicesCnt >= 8 && ephase <= PHASE.ACTION;
            return { isValid, status: 303223 }
        }),

    332024: () => new CardBuilder(264).name('琴音之诗').since('v4.2.0').event().costSame(0).canSelectHero(1)
        .description('将一个我方角色所装备的｢圣遗物｣返回手牌。；【本回合中，我方下一次打出｢圣遗物｣手牌时：】少花费1个元素骰。如果打出此牌前我方未打出过其他行动牌，则改为少花费2个元素骰。')
        .description('将一个我方角色所装备的｢圣遗物｣返回手牌。；【本回合中，我方下一次打出｢圣遗物｣手牌时：】少花费2个元素骰。', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/4c4a398dfed6fe5486f64725f89bb76c_6509340727185201552.png')
        .handle((_, event, ver) => {
            const { hero, heros = [], playerInfo: { isUsedCardPerRound } = {} } = event;
            return {
                status: ver.gte('v4.8.0') && isUsedCardPerRound ? 303232 : 303224,
                canSelectHero: heros.map(h => h.artifactSlot != null),
                cmds: [{ cmd: 'getCard', cnt: 1, card: isCdt(!!hero?.artifactSlot, () => hero!.artifactSlot!.id) }],
                exec: () => { hero!.artifactSlot = null },
            }
        }),

    332025: () => new CardBuilder(315).name('野猪公主').since('v4.3.0').event().costSame(0)
        .description('【本回合中，我方每有1张装备在角色身上的｢装备牌｣被弃置时：】获得1个[万能元素骰]。（最多获得2个）；（角色被击倒时弃置装备牌，或者覆盖装备｢武器｣或｢圣遗物｣，都可以触发此效果）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/7721cfea320d981f2daa537b95bb7bc1_3900294074977500858.png')
        .handle(() => ({ status: 303225 })),

    332026: () => new CardBuilder(316).name('坍陷与契机').since('v4.3.0').event().costSame(0).costSame(1, 'v4.8.0')
        .description('【我方至少剩余8个元素骰，且对方未宣布结束时，才能打出：】本回合中，双方牌手进行｢切换角色｣行动时需要额外花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/312a021086d348d6e7fed96949b68b64_469348099361246418.png')
        .handle((_, event) => {
            const { dicesCnt = 0, ephase = -1 } = event;
            const isValid = dicesCnt >= 8 && ephase <= PHASE.ACTION;
            return { isValid, status: 303226, statusOppo: 303226 };
        }),

    332027: () => new CardBuilder(317).name('浮烁的四叶印').since('v4.3.0').event().costSame(0).canSelectHero(1)
        .description('目标角色附属【sts303227】：每个回合的结束阶段，我方都切换到此角色。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/4845ea28326df1869e6385677b360722_5388810612366437595.png')
        .handle(() => ({ status: 303227 })),

    332028: () => new CardBuilder(331).name('机关铸成之链').since('v4.4.0').event().costSame(0).canSelectHero(1)
        .description('【目标我方角色每次受到伤害或治疗后：】累积1点｢备战度｣（最多累积2点）。；【我方打出原本费用不多于｢备战度｣的｢武器｣或｢圣遗物｣时:】移除所有｢备战度｣，以免费打出该牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/51fdd12cc46cba10a8454337b8c2de30_3419304185196056567.png')
        .handle(() => ({ status: 303228 })),

    332029: () => new CardBuilder(332).name('净觉花').since('v4.4.0').event().costSame(0).canSelectSupport(1)
        .description('选择一张我方支援区的牌，将其弃置。然后，在我方手牌中随机生成2张支援牌。；【本回合中，我方下次打出支援牌时：】少花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/ce12f855ad452ad6af08c0a4068ec8fb_3736050498099832800.png')
        .handle((_, event) => {
            const { supports = [], selectSupport = -1, isExec } = event;
            if (isExec) supports.splice(selectSupport, 1)
            return {
                status: 303229,
                cmds: [{ cmd: 'getCard', cnt: 2, subtype: [CARD_SUBTYPE.Place, CARD_SUBTYPE.Ally, CARD_SUBTYPE.Item] }],
            }
        }),

    332030: () => new CardBuilder(347).name('可控性去危害化式定向爆破').since('v4.5.0').event().costSame(1)
        .description('【对方支援区和召唤物区的卡牌数量总和至少为4时，才能打出：】双方所有召唤物的[可用次数]-1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/2e859c0e0c52bfe566e2200bb70dae89_789491720602984153.png')
        .handle((_, event) => {
            const { esupports = [], summons = [], esummons = [] } = event;
            const summonCnt = INIT_SUMMONCNT();
            summonCnt.forEach(s => s.fill(-1));
            return {
                isValid: esupports.length + esummons.length >= 4,
                summonCnt,
                exec: () => {
                    summons.forEach(smn => smn.minusUseCnt());
                    esummons.forEach(smn => smn.minusUseCnt());
                }
            }
        }),

    332031: () => new CardBuilder(360).name('海中寻宝').since('v4.6.0').event().costSame(2).costSame(1, 'v4.6.1')
        .description('生成6张【crd303230】，随机地置入我方牌库中。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/40001dfa11a6aa20be3de16e0c89d598_3587066228917552605.png')
        .handle(() => ({ cmds: [{ cmd: 'addCard', cnt: 6, card: 303230 }] })),

    332032: () => magicCount(3, 394).since('v4.7.0'),

    332036: () => new CardBuilder(405).name('｢看到那小子挣钱…｣').since('v4.8.0').event().costSame(0)
        .description('本回合中，每当对方获得2个元素骰，你就获得1个[万能元素骰]。（此效果提供的元素骰除外）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/def6430ab4786110ca59b7c0b5db74bb_6410535231278063665.png')
        .handle(() => ({ status: 303236 })),

    332037: () => new CardBuilder(406).name('噔噔！').since('v4.8.0').event().costSame(0)
        .description('对我方｢出战角色｣造成1点[物理伤害]。本回合的结束阶段时，抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/9d4fdc428069d3b7f538e56c8bf222d8_660249598222625991.png')
        .handle(() => ({ cmds: [{ cmd: 'attack', element: DAMAGE_TYPE.Physical, cnt: 1, isOppo: false }], status: 303237 })),

    332039: () => new CardBuilder(419).name('龙伙伴的聚餐').since('v5.0.0').event().costSame(0).canSelectHero(1)
        .description('选择一个装备在我方角色的｢特技｣装备牌，使其[可用次数]+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/24/258999284/d6bc8f4595323b94a240d692f60e9587_6859675329237579153.png')
        .handle((_, event) => {
            const { selectHeros: [hidx] = [], heros = [] } = event;
            return {
                canSelectHero: heros.map(h => h.vehicleSlot != null && h.vehicleSlot[1].useCnt > -1),
                exec: () => { heros[hidx]?.vehicleSlot?.[0]?.addUseCnt() },
            }
        }),

    332040: () => new CardBuilder(430).name('镀金旅团的茶歇').since('v5.1.0').event().costSame(2)
        .description('如果我方存在相同元素类型的角色，则从3张｢场地｣中[挑选]1张加入手牌;；如果我方存在相同武器类型的角色，则从3张｢道具｣中[挑选]1张加入手牌;；如果我方存在相同所属势力的角色，则从3张｢料理｣中[挑选]1张加入手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/04/258999284/d95d31b9e43e517d1044e7b6bfdea685_4585783706555955668.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            const cmds: Cmds[] = [];
            const canSelectPlace = new Set(heros.map(h => h.element)).size < heros.length;
            const canSelectItem = new Set(heros.map(h => h.weaponType)).size < heros.length;
            const canSelectFood = objToArr(heros.reduce((a, h) => (h.tags.forEach(t => a[t] = (a[t] ?? 0) + 1), a), {} as Record<HeroTag, number>)).some(([, n]) => n > 1);
            if (canSelectPlace) cmds.push({ cmd: 'pickCard', subtype: CARD_SUBTYPE.Place, cnt: 3, mode: CMD_MODE.GetCard });
            if (canSelectItem) cmds.push({ cmd: 'pickCard', subtype: CARD_SUBTYPE.Item, cnt: 3, mode: CMD_MODE.GetCard });
            if (canSelectFood) cmds.push({ cmd: 'pickCard', subtype: CARD_SUBTYPE.Food, cnt: 3, mode: CMD_MODE.GetCard });
            if (cmds.length == 0) return { isValid: false }
            return { cmds }
        }),

    332041: () => new CardBuilder(442).name('强劲冲浪拍档！').since('v5.2.0').event().costSame(0)
        .description('【双方场上至少存在合计2个｢召唤物｣时，才能打出：】随机触发我方和敌方各1个｢召唤物｣的｢结束阶段｣效果。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/0a500a2d6316ffc96851715d545815da_8008891091384379637.png')
        .handle((_, event) => {
            const { summons = [], esummons = [], randomInt } = event;
            const cmds: Cmds[] = [];
            if (randomInt) {
                if (summons.length) cmds.push({ cmd: 'useSkill', cnt: -2, hidxs: [randomInt(summons.length - 1)], summonTrigger: 'phase-end' });
                if (esummons.length) cmds.push({ cmd: 'useSkill', cnt: -2, hidxs: [randomInt(esummons.length - 1)], summonTrigger: 'phase-end', isOppo: true });
            }
            return { isValid: summons.length + esummons.length >= 2, cmds }
        }),

    332042: () => new CardBuilder(452).name('燃素充盈').since('v5.3.0').event().costSame(0)
        .description('【本回合我方下次角色消耗｢夜魂值｣后：】该角色获得1点｢夜魂值｣。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/30/258999284/068e20b26575d73b69a1b0b9913bfad4_976865676378334660.png')
        .handle(() => ({ status: 303238 })),

    332043: () => new CardBuilder(459).name('小嵴锋龙！发现宝藏！').since('v5.4.0').event().costSame(1)
        .description('向双方牌组中放入2张【crd332042】，随后双方各抓2张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/10/258999284/7f43e01235d3b59c48ac6d9ebd803748_5052551949082854888.png')
        .handle(() => ({
            cmds: [
                { cmd: 'addCard', cnt: 2, card: 332042, isOppo: true },
                { cmd: 'addCard', cnt: 2, card: 332042 },
                { cmd: 'getCard', cnt: 2, isOppo: true },
                { cmd: 'getCard', cnt: 2 },
            ]
        })),

    332044: () => new CardBuilder(467).name('以极限之名').since('v5.5.0').event().costSame(4)
        .description('交换双方手牌，然后手牌较少的一方抓牌直到手牌数等同于手牌多的一方。')
        .src('tmp/UI_Gcg_CardFace_Event_Event_NiyeLong_942149019')
        .handle((_, event) => {
            const { hcardsCnt = 0, ehcardsCnt = 0 } = event;
            const diff = hcardsCnt - ehcardsCnt;
            const cmds: Cmds[] = [{ cmd: 'exchangeHandCards' }];
            if (diff != 0) cmds.push({ cmd: 'getCard', cnt: Math.abs(diff), isOppo: diff < 0 });
            return { cmds }
        }),

    333001: () => new CardBuilder(265).name('绝云锅巴').food().costSame(0).canSelectHero(1)
        .description('本回合中，目标角色下一次｢普通攻击｣造成的伤害+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/1e59df2632c1822d98a24047f97144cd_5355214783454165570.png')
        .handle(() => ({ status: 303301 })),

    333002: () => new CardBuilder(266).name('仙跳墙').offline('v1').food().costAny(2).canSelectHero(1)
        .description('本回合中，目标角色下一次｢元素爆发｣造成的伤害+3。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/d5f601020016ee5b999837dc291dc939_1995091421771489590.png')
        .handle(() => ({ status: 303302 })),

    333003: () => new CardBuilder(267).name('莲花酥').offline('v1').food().costSame(1).canSelectHero(1)
        .description('本回合中，目标角色下次受到的伤害-3。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/3df4388cf37da743d62547874329e020_8062215832659512862.png')
        .handle(() => ({ status: 303303 })),

    333004: () => new CardBuilder(268).name('北地烟熏鸡').food().costSame(0).canSelectHero(1)
        .description('本回合中，目标角色下一次｢普通攻击｣少花费1个[无色元素骰]。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/bea77758f2b1392abba322e54cb43dc4_7154513228471011328.png')
        .handle(() => ({ status: 303304 })),

    333005: () => new CardBuilder(269).name('甜甜花酿鸡').offline('v1').food().costSame(0).canSelectHero(1)
        .description('治疗目标角色1点。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/bb5528c89decc6e54ade58e1c672cbfa_4113972688843190708.png')
        .handle((_, event) => {
            const canSelectHero = event.heros?.map(h => h.hp < h.maxHp && h.hp > 0);
            return { cmds: [{ cmd: 'heal', cnt: 1 }], canSelectHero }
        }),

    333006: () => new CardBuilder(270).name('蒙德土豆饼').offline('v1').food().costSame(1).canSelectHero(1)
        .description('治疗目标角色2点。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/f1026f0a187267e7484d04885e62558a_1248842015783359733.png')
        .handle((_, event) => {
            const canSelectHero = event.heros?.map(h => h.hp < h.maxHp && h.hp > 0);
            return { cmds: [{ cmd: 'heal', cnt: 2 }], canSelectHero }
        }),

    333007: () => new CardBuilder(271).name('烤蘑菇披萨').offline('v1').food().costSame(1).canSelectHero(1)
        .description('治疗目标角色1点，两回合内结束阶段再治疗此角色1点。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/915af5fee026a95d6001559c3a1737ff_7749997812479443913.png')
        .handle((_, event) => {
            const canSelectHero = event.heros?.map(h => h.hp < h.maxHp && h.hp > 0);
            return { cmds: [{ cmd: 'heal', cnt: 1 }], status: 303305, canSelectHero }
        }),

    333008: () => new CardBuilder(272).name('兽肉薄荷卷').food().costSame(1).canSelectHero(1)
        .description('目标角色在本回合结束前，之后的三次｢普通攻击｣都少花费1个[无色元素骰]。')
        .description('目标角色在本回合结束前，｢普通攻击｣都少花费1个[无色元素骰]。', 'v3.4.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/02a88d1110794248403455ca8a872a96_7596521902301090637.png')
        .handle(() => ({ status: 303306 })),

    333009: () => new CardBuilder(273).name('提瓦特煎蛋').since('v3.7.0').offline('v1').food().costSame(2).costSame(3, 'v4.1.0').canSelectHero(1)
        .description('复苏目标角色，并治疗此角色1点。').tag(CARD_TAG.Revive)
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/981cc0d2da6a2dc2b535b1ee25a77622_592021532068551671.png')
        .handle((_, event) => {
            const { heros = [], selectHeros, combatStatus = [] } = event;
            const canSelectHero = heros.map(h => h.hp <= 0 && !hasObjById(combatStatus, 303307));
            return { cmds: [{ cmd: 'revive', cnt: 1, hidxs: selectHeros }], status: 303307, canSelectHero }
        }),

    333010: () => new CardBuilder(274).name('刺身拼盘').since('v3.7.0').food().costSame(1).canSelectHero(1)
        .description('目标角色在本回合结束前，｢普通攻击｣造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/66806f78b2ced1ea0be9b888d912a61a_8814575863313174324.png')
        .handle(() => ({ status: 303308 })),

    333011: () => new CardBuilder(275).name('唐杜尔烤鸡').since('v3.7.0').food().costAny(2)
        .description('本回合中，所有我方角色下一次｢元素战技｣造成的伤害+2。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/ebc939f0b5695910118e65f9acfc95ff_8938771284871719730.png')
        .handle((_, event) => {
            const hidxs = event.heros?.filter(h => !hasObjById(h.heroStatus, 303300) && h.hp > 0).map(h => h.hidx);
            return { status: 303309, hidxs }
        }),

    333012: () => new CardBuilder(276).name('黄油蟹蟹').since('v3.7.0').food().costAny(2)
        .description('本回合中，所有我方角色下次受到伤害-2。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/371abd087dfb6c3ec9435668d927ee75_1853952407602581228.png')
        .handle((_, event) => {
            const hidxs = event.heros?.filter(h => !hasObjById(h.heroStatus, 303300) && h.hp > 0).map(h => h.hidx);
            return { status: 303310, hidxs }
        }),

    333013: () => new CardBuilder(318).name('炸鱼薯条').since('v4.3.0').food().costAny(2)
        .description('本回合中，所有我方角色下次使用技能时少花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/21ece93fa784b810495128f6f0b14c59_4336812734349949596.png')
        .handle((_, event) => {
            const hidxs = event.heros?.filter(h => !hasObjById(h.heroStatus, 303300) && h.hp > 0).map(h => h.hidx);
            return { status: 303311, hidxs }
        }),

    333014: () => new CardBuilder(333).name('松茸酿肉卷').since('v4.4.0').food().costSame(2).canSelectHero(1)
        .description('治疗目标角色2点，3回合内结束阶段再治疗此角色1点。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/9001508071c110f4b13088edeb22c8b4_7346504108686077875.png')
        .handle((_, event) => {
            const canSelectHero = event.heros?.map(h => h.hp < h.maxHp && h.hp > 0);
            return { cmds: [{ cmd: 'heal', cnt: 2 }], status: 303312, canSelectHero }
        }),

    333015: () => new CardBuilder(361).name('缤纷马卡龙').since('v4.6.0').food().costAny(2).canSelectHero(1)
        .description('治疗目标角色1点，该角色接下来3次受到伤害后再治疗其1点。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/287f535c9a60620259bb149a75a3a001_7028948017645858669.png')
        .handle((_, event) => {
            const canSelectHero = event.heros?.map(h => h.hp < h.maxHp && h.hp > 0);
            return { cmds: [{ cmd: 'heal', cnt: 1 }], status: 303313, canSelectHero }
        }),

    333016: () => new CardBuilder(431).name('龙龙饼干').since('v5.1.0').food().costSame(0).canSelectHero(1)
        .description('本回合中，目标角色下一次使用｢特技｣少花费1个元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/04/258999284/e473f7de075963ef435079bafd6c0388_8656398544128053014.png')
        .handle(() => ({ status: 303314 })),

    333017: () => new CardBuilder(443).name('宝石闪闪').since('v5.2.0').food().costSame(1).canSelectHero(1)
        .description('目标角色获得1点额外最大生命值。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/a06469da4cbc09f6bba2ae51a6808f23_7880465946055268242.png')
        .handle(() => ({ cmds: [{ cmd: 'addMaxHp', cnt: 1 }] })),

    333018: () => new CardBuilder(453).name('咚咚嘭嘭').since('v5.3.0').food().costSame(1).canSelectHero(1)
        .description('接下来3次名称不存在于初始牌组中牌加入我方手牌时，目标我方角色治疗自身1点。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/30/258999284/1c24dbdc3c8e0b65b342ea2b88412222_1756624425919028253.png')
        .handle(() => ({ status: 303315 })),

    333019: () => new CardBuilder(460).name('温泉时光').since('v5.4.0').food().costSame(1).canSelectHero(1)
        .description('治疗目标角色1点，我方场上每有1个召唤物，则额外治疗1点。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/10/258999284/930a4ce59c928b77102192d730b2594b_856448637254416810.png')
        .handle((_, event) => {
            const { summons: { length } = [], heros = [] } = event;
            const canSelectHero = heros.map(h => h.hp < h.maxHp && h.hp > 0);
            return { cmds: [{ cmd: 'heal', cnt: 1 + length }], canSelectHero }
        }),

    333020: () => new CardBuilder(468).name('奇瑰之汤').since('v5.5.0').food().costSame(1).canSelectHero(1)
        .description('从3个随机效果中[挑选]1个，对目标角色生效。')
        .src('tmp/UI_Gcg_CardFace_Event_Food_MingShi_-1513751782')
        .handle(() => ({
            cmds: [{
                cmd: 'pickCard',
                cnt: 3,
                card: [333021, 333022, 333023, 333024, 333025, 333026],
                mode: CMD_MODE.UseCard,
            }]
        })),

    211011: () => new CardBuilder(61).name('唯此一心').offline('v1').talent(2).costCryo(5)
        .description('{action}；装备有此牌的【hro】使用【ski】时：如果此技能在本场对局中曾经被使用过，则其对敌方后台角色造成的[穿透伤害]改为3点。')
        .description('{action}；装备有此牌的【hro】使用【ski】时：如果此技能在本场对局中曾经被使用过，则其造成的[冰元素伤害]+1，并且改为对敌方后台角色造成3点[穿透伤害]。', 'v3.7.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/15a100ee0285878fc5749663031fa05a_7762319984393418259.png')
        .handle((card, event, ver) => {
            if (ver.gte('v3.7.0')) return;
            const { heros = [] } = event;
            const hero = getObjById(heros, card.userType as number);
            return { addDmgCdt: isCdt(!!hero?.skills[2].useCnt, 1) }
        }),

    211021: () => new CardBuilder(62).name('猫爪冰摇').talent(1).costCryo(3).costCryo(4, 'v4.1.0')
        .description('{action}；装备有此牌的【hro】生成的【sts111021】，所提供的[护盾]值+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/cb37f02217bcd8ae5f6e4a6eb9bae539_3357631204660850476.png'),

    211031: () => new CardBuilder(63).name('冷血之剑').talent(1).costCryo(4).perCnt(1)
        .description('{action}；装备有此牌的【hro】使用【ski】后：治疗自身2点。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/616ba40396a3998560d79d3e720dbfd2_3275119808720081204.png')
        .handle((card, event) => {
            const { hero } = event;
            if (card.perCnt <= 0 || !hero || hero.hp == hero.maxHp) return;
            return {
                triggers: 'skilltype2',
                execmds: [{ cmd: 'heal', cnt: 2, hidxs: [hero.hidx] }],
                exec: () => card.minusPerCnt(),
            }
        }),

    211041: () => new CardBuilder(64).name('吐纳真定').offline('v1').talent(1).costCryo(3).costCryo(4, 'v4.2.0')
        .description('{action}；装备有此牌的【hro】生成的【sts111041】获得以下效果：；使我方单手剑、双手剑或长柄武器角色的｢普通攻击｣伤害+1。')
        .description('{action}；装备有此牌的【hro】生成的【sts111041】获得以下效果：；初始[持续回合]+1，使我方单手剑、双手剑或长柄武器角色的｢普通攻击｣伤害+1。', 'v4.2.0')
        .src('https://patchwiki.biligame.com/images/ys/e/e6/qfsltpvntkjxioew81iehfhy5xvl7v6.png'),

    211051: () => new CardBuilder(65).name('寒天宣命祝词').offline('v1').talent().costCryo(2).perCnt(1)
        .description('装备有此牌的【hro】生成的【sts111052】会使所附魔角色造成的[冰元素伤害]+1。；切换到装备有此牌的【hro】时：少花费1个元素骰。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/7d706fd25ab0b3c4f8cca3af08d8a07b_2913232629544868049.png')
        .handle((card, event) => {
            const { switchHeroDiceCnt = 0 } = event;
            if (switchHeroDiceCnt == 0 || card.perCnt <= 0) return;
            return {
                triggers: 'minus-switch-to',
                minusDiceHero: 1,
                exec: () => card.minusPerCnt(),
            }
        }),


    211061: () => new CardBuilder(66).name('战欲涌现').since('v3.5.0').talent(2).costCryo(3).energy(2)
        .description('{action}。；装备有此牌的【hro】使用【ski,1】时，会额外为【smn111062】累积1点｢能量层数｣。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/54bfba5d0eb40f38a0b679808dbf3941_5181344457570733816.png'),

    211071: () => new CardBuilder(67).name('忘玄').since('v3.7.0').talent(1).costCryo(3)
        .description('{action}；装备有此牌的【hro】生成的【sts111071】被我方角色的｢普通攻击｣触发时：不消耗[可用次数]。（每回合1次）。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/9df7f8bf2b97688d9a8fae220b4ff799_2381296963104605530.png'),

    211081: () => new CardBuilder(68).name('起死回骸').since('v4.0.0').talent(2).costCryo(4).costCryo(5, 'v4.7.0').energy(3).perCnt(2).isResetPerCnt()
        .description('{action}；装备有此牌的【hro】使用【ski】时，复苏我方所有倒下角色，并治疗其2点。（整场牌局限制2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/258999284/d5ef496771a846af08ec05fff036bf17_8628795343837772161.png'),

    211091: () => new CardBuilder(288).name('归芒携信').since('v4.3.0').talent(1).costCryo(3)
        .description('{action}；装备有此牌的【hro】在场时，每当【sts111092】造成伤害，就抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/bf34b0aa7f7664582ddb7eacaf1bd9ca_8982816839843813094.png')
        .handle((_, event) => {
            const { dmgSource = -1 } = event;
            if (dmgSource != 111092) return;
            return { triggers: 'after-dmg', execmds: [{ cmd: 'getCard', cnt: 1 }] }
        }),

    211101: () => new CardBuilder(338).name('以有趣相关为要义').since('v4.5.0').talent(1).costCryo(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】在场时，我方角色进行｢普通攻击｣后：如果对方场上附属有【sts111101】，则治疗我方出战角色2点。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/29c5370c3846c6c0a5722ef1f6c94d97_1023653312046109359.png')
        .handle((card, event) => {
            const { heros = [], eheros = [] } = event;
            if (card.perCnt <= 0 || !hasObjById(eheros.flatMap(h => h.heroStatus), 111101)) return;
            const hero = heros.find(h => h.isFront);
            if (!hero || hero.hp == hero.maxHp) return;
            return {
                triggers: ['skilltype1', 'other-skilltype1'],
                execmds: [{ cmd: 'heal', cnt: 2 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    211111: () => new CardBuilder(372).name('予行恶者以惩惧').since('v4.7.0').talent(0).costCryo(1).anydice(2).useCnt(0)
        .description('{action}；装备有此牌的【hro】受到伤害或治疗后，此牌累积1点｢惩戒计数｣。；装备有此牌的【hro】使用技能时：如果已有3点｢惩戒计数｣，则消耗3点使此技能伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/ba5051d7c24ad430dcd83d95e4a6bf42_1747806350562559991.png')
        .handle((card, event) => {
            const { trigger } = event;
            return {
                triggers: ['getdmg', 'heal', 'skill'],
                addDmgCdt: isCdt(card.useCnt >= 3, 1),
                isAddTask: trigger != 'skill',
                exec: () => {
                    if (trigger == 'getdmg' || trigger == 'heal') {
                        card.addUseCnt();
                    } else if (trigger == 'skill' && card.useCnt >= 3) {
                        card.minusUseCnt(3);
                    }
                }
            }
        }),

    211121: () => new CardBuilder(410).name('梦晓与决意之刻').since('v5.0.0').talent(1).costCryo(3).perCnt(2)
        .description('{action}；装备有此牌的【hro】使用技能后，抓1张牌。（每回合至多触发2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/64216fa8f7b8b6af5888be62b1e5446f_690317746253684619.png')
        .handle(card => {
            if (card.perCnt <= 0) return;
            return {
                triggers: 'skill',
                execmds: [{ cmd: 'getCard', cnt: 1 }],
                exec: () => card.minusPerCnt()
            }
        }),

    211131: () => new CardBuilder(435).name('代行裁判').since('v5.2.0').talent(1).costCryo(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】使用【ski】，或我方生成【sts111133】后，在手牌中生成1张【crd332002】。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/bd4108a18f1959114c7437640fd7e25f_8622667424074363979.png')
        .handle((card, event) => {
            if (card.perCnt <= 0) return;
            const { source = -1, trigger } = event;
            const triggers: Trigger[] = ['skilltype2'];
            if (trigger == 'get-status' && source == 111133) triggers.push('get-status');
            return {
                triggers,
                execmds: [{ cmd: 'getCard', cnt: 1, card: 332002 }],
                exec: () => card.minusPerCnt()
            }
        }),

    212011: () => new CardBuilder(69).name('光辉的季节').offline('v1').talent(1).costHydro(3).costHydro(4, 'v4.2.0').perCnt(1)
        .description('{action}；装备有此牌的【hro】在场时，【smn112011】会使我方执行｢切换角色｣行动时少花费1个元素骰。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/a0b27dbfb223e2fe52b7362ad80c3d76_4257766629162615403.png')
        .handle((card, event) => {
            const { summons = [], switchHeroDiceCnt = 0 } = event;
            if (card.perCnt <= 0 || !hasObjById(summons, 112011) || switchHeroDiceCnt == 0) return;
            return {
                triggers: 'minus-switch',
                minusDiceHero: 1,
                exec: () => card.minusPerCnt()
            }
        }),

    212021: () => new CardBuilder(70).name('重帘留香').talent(1).costHydro(3).costHydro(4, 'v4.2.0')
        .description('{action}；装备有此牌的【hro】生成的【sts112021】，会在我方出战角色受到至少为2的伤害时抵消伤害，并且初始[可用次数]+1。')
        .description('{action}；装备有此牌的【hro】生成的【sts112021】初始[可用次数]+1。', 'v4.2.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/eb3cd31f7a2c433499221b5664a264f3_3086723857644931388.png'),

    212031: () => new CardBuilder(71).name('沉没的预言').offline('v1').talent(2).costHydro(3).energy(3)
        .description('{action}；装备有此牌的【hro】出战期间，我方引发的[水元素相关反应]伤害额外+2。')
        .src('https://patchwiki.biligame.com/images/ys/d/de/1o1lt07ey988flsh538t7ywvnpzvzjk.png')
        .handle((_, event) => ({ triggers: 'elReaction-Hydro', addDmgCdt: isCdt(event.hero?.isFront, 2) })),

    212041: () => new CardBuilder(72).name('深渊之灾·凝水盛放').since('v3.7.0').talent(1).costHydro(3).costHydro(4, 'v4.1.0')
        .description('{action}；结束阶段：装备有此牌的【hro】在场时，敌方出战角色附属有【sts112043】，则对其造成1点[穿透伤害]。')
        .description('{action}；结束阶段：装备有此牌的【hro】在场时，对敌方所有附属有【sts112043】的角色造成1点[穿透伤害]。', 'v4.1.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e56754de22dbaf1cfb84ce85af588d21_7106803920286784988.png'),

    212051: () => new CardBuilder(73).name('匣中玉栉').since('v3.5.0').talent(2).costHydro(3).energy(2)
        .description('{action}；装备有此牌的【hro】使用【ski】时：召唤一个[可用次数]为1的【smn112051】\\；如果【smn112051】已在场，则改为使其[可用次数]+1。；【sts112052】存在期间，【smn112051】造成的伤害+1。')
        .description('{action}；装备有此牌的【hro】使用【ski】时：如果【smn112051】已在场，则改为使其[可用次数]+1。；【sts112052】存在期间，【smn112051】造成的伤害+1。', 'v4.2.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/5e980c377a2142322435bb4487b4f8fc_5354100201913685764.png'),

    212061: () => new CardBuilder(74).name('镜华风姿').since('v3.6.0').talent(1).costHydro(3)
        .description('{action}；装备有此牌的【hro】触发【sts112061】的效果时，对于生命值不多于6的敌人伤害+2。')
        .description('{action}；装备有此牌的【hro】触发【sts112061】的效果时，对于生命值不多于6的敌人伤害+1。', 'v4.7.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/a222141c6f996c368c642afe39572e9f_2099787104835776248.png')
        .handle((_, event, ver) => {
            const { eheros = [], hero, dmgedHidx = -1 } = event;
            if ((eheros[dmgedHidx]?.hp ?? 10) <= 6 && hasObjById(hero?.heroStatus, 112061)) {
                return { triggers: 'skilltype1', addDmgCdt: ver.lt('v4.7.0') ? 1 : 2 }
            }
        }),

    212071: () => new CardBuilder(75).name('衍溢的汐潮').since('v3.8.0').talent(2).costHydro(3).costHydro(4, 'v4.2.0').energy(2)
        .description('{action}；装备有此牌的【hro】生成的【sts112072】额外具有以下效果：我方角色｢普通攻击｣后：造成1点[水元素伤害]。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/64b78d95471e27f99a8cf1cf2a946537_1864982310212941599.png'),

    212081: () => new CardBuilder(76).name('星天的花雨').since('v4.2.0').talent(1).costHydro(3)
        .description('{action}；装备有此牌的【hro】在场时：我方【smn112082】造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/8cc9e5054277fa7e344648ac99671e7d_2129982885233274884.png'),

    212091: () => new CardBuilder(289).name('猜先有方').since('v4.2.0').talent(1).costHydro(3)
        .description('{action}；【投掷阶段：】装备有此牌的【hro】在场，则我方队伍中每有1种元素类型，就使1个元素骰总是投出[万能元素骰]。（最多3个）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/09/258999284/3914bb6ef21abc1f7e373cfe38d8be27_3734095446197720091.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            return { triggers: 'phase-dice', element: DICE_COST_TYPE.Omni, cnt: Math.min(3, new Set(heros.map(h => h.element)).size) }
        }),

    212101: () => new CardBuilder(339).name('古海孑遗的权柄').since('v4.5.0').talent(0).costHydro(1).anydice(2)
        .description('{action}；我方角色引发[水元素相关反应]后：装备有此牌的【hro】接下来2次造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/d419604605c1acde00b841ecf8c82864_58733338663118408.png')
        .handle((_, event) => {
            const { sktype = SKILL_TYPE.Vehicle, hero } = event;
            if (sktype == SKILL_TYPE.Vehicle || !hero) return;
            return {
                triggers: ['elReaction-Hydro', 'other-elReaction-Hydro'],
                status: 112103,
                hidxs: [hero.hidx],
            }
        }),

    212111: () => new CardBuilder(373).name('｢诸君听我颂，共举爱之杯！｣').since('v4.7.0').talent(1).costHydro(3)
        .description('{action}；装备有此牌的【hro】使用【ski】时，会对自身附属【sts112116】。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/fb5f84b550dcdcfcff9197573aee45a8_1289322499384647153.png')
        .handle((_, event) => {
            const { hero } = event;
            if (!hero || hero.tags.includes(HERO_TAG.ArkheOusia)) return;
            return { triggers: 'skill', cmds: [{ cmd: 'useSkill', cnt: 12122 }] }
        }),

    212131: () => new CardBuilder(436).name('应有适当的休息').since('v5.2.0').talent(1).costHydro(3)
        .description('{action}；装备有此牌的【hro】使用【ski】后，使我方接下来2次｢元素战技｣或召唤物造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/87596a798d0c90b9c572100e46e3b0e6_5333461488553294390.png')
        .handle(() => ({ triggers: 'skilltype2', execmds: [{ cmd: 'getStatus', status: 112135 }] })),

    212141: () => new CardBuilder(446).name('夜域赐礼·波涛顶底').since('v5.3.0').talent().costHydro(1).perCnt(1)
        .description('【装备有此牌的〖hro〗切换为｢出战角色｣时：】触发1个随机我方｢召唤物｣的｢结束阶段｣效果。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/92151754bedb92e5b3e0f97b6a83325d_6443479384111696580.png')
        .handle((card, event) => {
            const { summons = [], randomInt } = event;
            if (!randomInt || card.perCnt <= 0 || summons.length == 0) return { notPreview: true };
            return {
                triggers: 'switch-to',
                execmds: [{ cmd: 'useSkill', cnt: -2, hidxs: [randomInt(summons.length - 1)], summonTrigger: 'phase-end' }],
                notPreview: true,
                exec: () => card.minusPerCnt()
            }
        }),

    213011: () => new CardBuilder(77).name('流火焦灼').offline('v1').talent(1).costPyro(3)
        .description('{action}；装备有此牌的【hro】每回合第2次与第3次使用【ski】时，少花费1个[火元素骰]。')
        .description('{action}；装备有此牌的【hro】每回合第2次使用【ski】时，少花费1个[火元素骰]。', 'v4.7.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/5d72a776e175c52de3c4ebb113f2b9e7_2138984540269318755.png')
        .handle((_, event, ver) => {
            const { hero } = event;
            if (!hero) return;
            const { skills: [, { useCntPerRound = 0 }] } = hero;
            const isMinus = useCntPerRound == 1 || (ver.gte('v4.7.0') && useCntPerRound == 2);
            return { triggers: 'skill', minusDiceSkill: isCdt(isMinus, { skilltype2: [1, 0, 0], elDice: ELEMENT_TYPE.Pyro }) }
        }),

    213021: () => new CardBuilder(78).name('交叉火力').offline('v1').talent(1).costPyro(3).costPyro(4, 'v4.2.0')
        .description('{action}；装备有此牌的【hro】施放【ski】时，自身也会造成1点[火元素伤害]。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/101e8ef859847643178755f3bcacbad5_4705629747924939707.png'),

    213031: () => new CardBuilder(79).name('冒险憧憬').talent(2).costPyro(4).energy(2)
        .description('{action}；装备有此牌的【hro】生成的【sts113031】，其伤害提升效果改为总是生效，不再具有生命值限制。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/044617980be5a70980f7826036963e74_8167452876830335549.png'),

    213041: () => new CardBuilder(80).name('一触即发').since('v3.7.0').talent(1).costPyro(3)
        .description('{action}；【〖hro〗｢普通攻击｣后：】如果此牌和【smn113041】仍在场，则引爆【smn113041】，造成4点[火元素伤害]。')
        .description('{action}；【〖hro〗｢普通攻击｣后：】如果此牌和【smn113041】仍在场，则引爆【smn113041】，造成3点[火元素伤害]。', 'v4.2.0')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2a48f2862634d319b9165838de944561_3946596064567874908.png'),

    213051: () => new CardBuilder(81).name('长野原龙势流星群').talent(1).costPyro(1).costPyro(2, 'v4.7.0')
        .description('{action}；装备有此牌的【hro】生成的【sts113051】触发后：额外造成1点[火元素伤害]。', 'v4.2.0', 'vlatest')
        .description('{action}；装备有此牌的【hro】生成的【sts113051】初始[可用次数]+1，且触发后：额外造成1点[火元素伤害]。', 'v4.7.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/126c63df7d92e7d9c0a815a7a54558fc_6536428182837399330.png'),

    213061: () => new CardBuilder(82).name('砰砰礼物').since('v3.4.0').talent(1).costPyro(3)
        .description('{action}；装备有此牌的【hro】生成的【sts113061】的[可用次数]+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/0cca153cadfef3f9ccfd37fd2b306b61_8853740768385239334.png'),

    213071: () => new CardBuilder(83).name('血之灶火').since('v3.7.0').talent(1).costPyro(2)
        .description('{action}；装备有此牌的【hro】在生命值不多于6时，造成的[火元素伤害]+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/950a1fe6fcb977429942fcf0db1a6cc6_4713651560561730973.png')
        .handle((_, event) => {
            const { hero } = event;
            if (!hero || hero.hp > 6) return;
            return { triggers: 'Pyro-dmg', addDmgCdt: 1 }
        }),

    213081: () => new CardBuilder(84).name('最终解释权').since('v3.8.0').talent(0).costPyro(1).anydice(2)
        .description('{action}；装备有此牌的【hro】进行[重击]时：对生命值不多于6的敌人造成的伤害+1。；如果触发了【sts113081】，则在技能结算后抓1张牌。')
        .description('{action}；装备有此牌的【hro】进行[重击]时：对生命值不多于6的敌人造成的伤害+1。', 'v4.2.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/ad8a2130c54da3c3f25d094b7019cb69_4536540887547691720.png')
        .handle((_, event, ver) => {
            const { isChargedAtk, hero, eheros = [], dmgedHidx = -1, isExecTask } = event;
            if (!isChargedAtk && !isExecTask) return;
            return {
                triggers: 'skilltype1',
                addDmgCdt: isCdt((eheros[dmgedHidx]?.hp ?? 10) <= 6, 1),
                execmds: isCdt(ver.gte('v4.2.0') && (hasObjById(hero?.heroStatus, 113081) || isExecTask), [{ cmd: 'getCard', cnt: 1 }])
            }
        }),

    213091: () => new CardBuilder(85).name('崇诚之真').since('v4.1.0').talent(1).costPyro(4)
        .description('{action}；【结束阶段：】如果装备有此牌的【hro】生命值不多于6，则治疗该角色2点。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/161a55bb8e3e5141557f38536579e897_3725263134237782114.png')
        .handle((_, event) => {
            const { hero, isExecTask } = event;
            if (!hero || (hero.hp > 6 && isExecTask)) return;
            return {
                triggers: 'phase-end',
                execmds: [{ cmd: 'heal', cnt: 2, hidxs: [hero.hidx] }]
            }
        }),

    213101: () => new CardBuilder(290).name('完场喝彩').since('v4.3.0').talent(1).costPyro(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】在场时，【hro】自身和【smn113101】对具有‹3火元素附着›的角色造成的伤害+2。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/be471c09e294aaf12766ee17b624ddcc_5013564012859422460.png')
        .handle((card, event) => {
            const { eheros = [], dmgedHidx = -1, dmgSource = -1, isSummon = -1 } = event;
            const isAttachPyro = eheros[dmgedHidx]?.attachElement?.includes(ELEMENT_TYPE.Pyro);
            if (card.perCnt > 0 && isAttachPyro && (dmgSource == card.userType || isSummon == 113101)) {
                return { triggers: 'dmg', addDmgCdt: 2, exec: () => card.minusPerCnt() }
            }
        }),

    213111: () => new CardBuilder(323).name('僚佐的才巧').since('v4.4.0').talent(2).costPyro(3).energy(2)
        .description('{action}；装备有此牌的【hro】生成的【sts113112】，初始[可用次数]+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/d1ba5d6f1a7bdb24e95ca829357df03a_6674733466390586160.png'),

    213121: () => new CardBuilder(374).name('地狱里摇摆').since('v4.7.0').talent(0).costPyro(1).anydice(2).perCnt(1)
        .description('{action}；【装备有此牌的〖hro〗使用技能时：】如果我方手牌数量不多于1，则造成的伤害+2。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/219c7c6843e4ead2ab8ab2ce7044f5c3_8151320593747508491.png')
        .handle((card, { hcards = [], hcard }) => {
            if ((hcards.length - +(card.entityId == hcard?.entityId)) > 1 || card.perCnt <= 0) return;
            return { triggers: 'skill', addDmgCdt: 2, exec: () => card.minusPerCnt() }
        }),

    213131: () => new CardBuilder(398).name('尖兵协同战法').since('v4.8.0').talent().costPyro(2)
        .description('【队伍中包含‹3火元素›角色和‹4雷元素›角色且不包含其他元素的角色，才能打出：】将此牌装备给【hro】。；装备有此牌的【hro】在场，敌方角色受到超载反应伤害后：我方接下来造成的2次[火元素伤害]或[雷元素伤害]+1。（包括扩散反应造成的[火元素伤害]或[雷元素伤害]）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/63d30082fb5068d4b847292c999003a4_5250915378710745589.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            const onlyPyroOrElectro = heros.every(h => h.element == ELEMENT_TYPE.Pyro || h.element == ELEMENT_TYPE.Electro);
            const hasElectro = heros.some(h => h.element == ELEMENT_TYPE.Electro);
            return {
                isValid: onlyPyroOrElectro && hasElectro,
                triggers: ['Overload', 'other-Overload'],
                execmds: [{ cmd: 'getStatus', status: 113134 }],
            }
        }),

    213141: () => new CardBuilder(456).name('所有的仇与债皆由我偿…').since('v5.4.0').talent(-2).costPyro(2)
        .description('[战斗行动]：我方出战角色为【hro】时，对该角色打出，使【hro】附属3层【sts122】。；装备有此牌的【hro】受到伤害时，若可能，消耗1层【sts122】，以抵消1点伤害。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/9770a329be6b9be3965bc3240c531cb4_511464347620244194.png')
        .handle((card, event) => ({ isValid: !!getObjById(event.heros, card.userType as number)?.isFront, status: [[122, 3]] })),

    214011: () => new CardBuilder(86).name('噬星魔鸦').talent(1).costElectro(3)
        .description('{action}；装备有此牌的【hro】生成的【smn114011】，会在【hro】｢普通攻击｣后造成2点[雷元素伤害]。（需消耗[可用次数]）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/95879bb5f97234a4af1210b522e2c948_1206699082030452030.png'),

    214021: () => new CardBuilder(87).name('觉醒').talent(1).costElectro(3).costElectro(4, 'v4.2.0').perCnt(1).perCnt(0, 'v4.2.0')
        .description('{action}；装备有此牌的【hro】使用【ski】后：使我方一个‹4雷元素›角色获得1点[充能]。（出战角色优先，每回合1次）')
        .description('{action}；装备有此牌的【hro】使用【ski】后：使我方一个‹4雷元素›角色获得1点[充能]。（出战角色优先）', 'v4.2.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/7b07468873ea01ee319208a3e1f608e3_1769364352128477547.png')
        .handle((card, event, ver) => {
            const { heros = [] } = event;
            if (ver.gte('v4.2.0') && card.perCnt <= 0) return;
            const hidxs = allHidxs(heros, { cdt: h => h.hp > 0 && h.element == ELEMENT_TYPE.Electro && h.energy < h.maxEnergy, limit: 1 });
            if (hidxs.length == 0) return;
            return {
                triggers: 'skilltype2',
                execmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }],
                exec: () => card.minusPerCnt(),
            }
        }),

    214031: () => new CardBuilder(88).name('抵天雷罚').offline('v1').talent(1).costElectro(3)
        .description('{action}；装备有此牌的【hro】生成的【sts114032】获得以下效果：初始[持续回合]+1，并且会使所附属角色造成的[雷元素伤害]+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/58e4a4eca066cc26e6547f590def46ad_1659079510132865575.png'),

    214041: () => new CardBuilder(89).name('落羽的裁择').talent(1).costElectro(3).perCnt(2).perCnt(1, 'v5.0.0').perCnt(0, 'v4.8.0')
        .description('{action}；装备有此牌的【hro】在【sts114041】的｢凭依｣级数至少为2时使用【ski】时，造成的伤害额外+1。（每回合2次）')
        .description('{action}；装备有此牌的【hro】在【sts114041】的｢凭依｣级数至少为2时使用【ski】时，造成的伤害额外+2。（每回合1次）', 'v5.0.0')
        .description('{action}；装备有此牌的【hro】在【sts114041】的｢凭依｣级数为偶数时使用【ski】时，造成的伤害额外+1。', 'v4.8.0')
        .description('{action}；装备有此牌的【hro】在【sts114041】的｢凭依｣级数为3或5时使用【ski】时，造成的伤害额外+1。', 'v4.2.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/b4f218c914886ea4ab9ce4e0e129a8af_2603691344610696520.png')
        .handle((card, event, ver) => {
            const { hero } = event;
            const stsCnt = (getObjById(hero?.heroStatus, 114041)?.useCnt ?? 0) - (ver.gte('v4.8.0') ? 1 : 0);
            let addDmgCdt = 0;
            if (
                ver.lt('v4.2.0') && [3, 5].includes(stsCnt) ||
                ver.lt('v4.8.0') && stsCnt % 2 == 0 ||
                ver.gte('v5.0.0') && stsCnt >= 2 && card.perCnt > 0
            ) {
                addDmgCdt = 1;
            } else if (ver.gte('v4.8.0') && stsCnt >= 2 && card.perCnt > 0) addDmgCdt = 2;
            if (addDmgCdt == 0) return;
            return {
                triggers: 'skilltype2',
                addDmgCdt,
                exec: () => { ver.gte('v4.8.0') && card.minusPerCnt() }
            }
        }),

    214051: () => new CardBuilder(90).name('霹雳连霄').since('v3.4.0').talent(1).costElectro(3)
        .description('{action}；装备有此牌的【hro】使用【rsk14054】时：使【hro】本回合内｢普通攻击｣少花费1个[无色元素骰]。')
        .description('{action}；装备有此牌的【hro】在[准备技能]期间受过伤害后：使【hro】本回合内｢普通攻击｣少花费1个[无色元素骰]。', 'v4.2.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/c3004d7c3873556c01124277c58b4b87_6946169426849615589.png'),

    214061: () => new CardBuilder(91).name('我界').since('v3.5.0').offline('v1')
        .talent(1).talent(2, 'v4.2.0').costElectro(3).costElectro(4, 'v4.2.0').energy(0).energy(2, 'v4.2.0')
        .description('{action}；装备有此牌的【hro】在场时，我方附属有【sts114063】的‹4雷元素›角色，｢元素战技｣和｢元素爆发｣造成的伤害额外+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/3eb3cbf6779afc39d7812e5dd6e504d9_148906889400555580.png')
        .handle((_, event) => {
            const { heros = [] } = event;
            if (!heros.find(h => h.isFront && h.element == ELEMENT_TYPE.Electro && hasObjById(h.heroStatus, 114063))) return;
            return {
                addDmgCdt: 1,
                triggers: ['skilltype2', 'skilltype3', 'other-skilltype2', 'other-skilltype3'],
            }
        }),

    214071: () => new CardBuilder(92).name('万千的愿望').since('v3.7.0').talent(2).costElectro(4).energy(2)
        .description('{action}；装备有此牌的【hro】使用【ski】时每消耗1点｢愿力｣，都使造成的伤害额外+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bea2df42c6cb8eecf724f2da60554278_2483208280861354828.png'),

    214081: () => new CardBuilder(93).name('神篱之御荫').since('v3.7.0').talent(2).costElectro(3).energy(2)
        .description('{action}；装备有此牌的【hro】通过【ski】消灭了【smn114081】后，本回合下次使用【ski,1】时少花费2个元素骰。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bdb47c41b068190b9f0fd7fe1ca46bf3_449350753177106926.png'),

    214091: () => new CardBuilder(94).name('脉冲的魔女').since('v4.0.0').offline('v1').talent().costElectro(1).perCnt(1)
        .description('切换到装备有此牌的【hro】后：使敌方出战角色附属【sts114091】。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/608b48c391745b8cbae976d971b8b8c0_2956537094434701939.png')
        .handle(card => {
            if (card.perCnt <= 0) return;
            return {
                triggers: 'switch-to',
                execmds: [{ cmd: 'getStatus', status: 114091, isOppo: true }],
                exec: () => card.minusPerCnt(),
            }
        }),

    214101: () => new CardBuilder(95).name('酌盈剂虚').since('v4.2.0').talent(2).costElectro(3).energy(2)
        .description('{action}；装备有此牌的【hro】所召唤的【smn114102】，对生命值不多于6的角色造成的治疗+1，使没有[充能]的角色获得[充能]时获得量+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/da73eb59f8fbd54b1c3da24d494108f7_706910708906017594.png'),

    214111: () => new CardBuilder(362).name('割舍软弱之心').since('v4.6.0').talent(2).costElectro(4).costElectro(3, 'v5.3.0')
        .perCnt(1).energy(2).tag(CARD_TAG.NonDefeat)
        .description('{action}；装备有此牌的【hro】被击倒时：角色[免于被击倒]，并治疗该角色到1点生命值。（每回合1次）；如果装备有此牌的【hro】生命值不多于5，则该角色造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/b53d6688202a139f452bda31939162f8_3511216535123780784.png')
        .handle((card, event) => {
            const { hero, trigger } = event;
            const isRevive = card.perCnt > 0 && trigger == 'will-killed';
            const triggers: Trigger[] = ['skill'];
            if (isRevive) triggers.push('will-killed');
            return {
                triggers,
                addDmgCdt: isCdt((hero?.hp ?? 10) <= 5, 1),
                execmds: isCdt(isRevive, [{ cmd: 'revive', cnt: 1 }]),
                exec: () => {
                    if (isRevive) card.minusPerCnt();
                }
            }
        }),

    214121: () => new CardBuilder(447).name('破夜的明焰').since('v5.3.0').talent(1).costElectro(2)
        .description('{action}；【我方角色引发[雷元素相关反应]后：】本回合【hro】下次造成的伤害+1。（可叠加，最多叠加到+3）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/fe3f64e0a6220b41d9db19a6cbb7c8e8_815543173218385253.png')
        .handle((_, event) => {
            const { hero, sktype = SKILL_TYPE.Vehicle } = event;
            if (!hero || sktype == SKILL_TYPE.Vehicle || getObjById(hero.heroStatus, 114122)?.useCnt == 3) return;
            return {
                triggers: ['elReaction-Electro', 'other-elReaction-Electro'],
                execmds: [{ cmd: 'getStatus', status: 114122, hidxs: [hero.hidx] }],
            }
        }),

    215011: () => new CardBuilder(96).name('混元熵增论').offline('v1').talent(2).costAnemo(3).energy(2).energy(3, 'v4.2.0')
        .description('{action}；装备有此牌的【hro】生成的【smn115011】已转换成另一种元素后：我方造成的此类元素伤害+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/93fb13495601c24680e2299f9ed4f582_2499309288429565866.png'),

    215021: () => new CardBuilder(97).name('蒲公英的国土').offline('v1').talent(2).costAnemo(4).energy(2)
        .description('{action}；装备有此牌的【hro】在场时，【smn115021】会使我方造成的[风元素伤害]+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/4e162cfa636a6db51f166d7d82fbad4f_6452993893511545582.png'),

    215031: () => new CardBuilder(98).name('绪风之拥').since('v3.7.0').talent(1).costAnemo(3)
        .description('{action}；装备有此牌的【hro】生成的【sts115031】触发后，会使本回合中我方角色下次｢普通攻击｣少花费1个[无色元素骰]。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f46cfa06d1b3ebe29fe8ed2c986b4586_6729812664471389603.png'),

    215041: () => new CardBuilder(99).name('降魔·护法夜叉').since('v3.7.0').talent(2).costAnemo(3).energy(2)
        .description('{action}；装备有此牌的【hro】附属【sts115041】期间，使用【ski,1】时少花费1个[风元素骰]。（每附属1次【sts115041】，可触发2次）')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fae27eb5db055cf623a80c11e08bb07c_2875856165408881126.png'),

    215051: () => new CardBuilder(100).name('风物之诗咏').since('v3.8.0').talent(1).costAnemo(3)
        .description('{action}；装备有此牌的【hro】引发扩散反应后：使我方角色和召唤物接下来2次所造成的的被扩散元素类型的伤害+1。（每种元素类型分别计算次数）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/dd06fa7b0ec63f3e60534a634ebd6fd2_9125107885461849882.png')
        .handle((_, event) => {
            const { trigger = '' } = event;
            const windEl = trigger.startsWith('elReaction-Anemo') ? PURE_ELEMENT_TYPE[trigger.slice(trigger.indexOf(':') + 1) as PureElementType] : ELEMENT_TYPE.Anemo;
            return {
                triggers: 'elReaction-Anemo',
                status: isCdt(windEl != ELEMENT_TYPE.Anemo, 115050 + (6 + ELEMENT_CODE[windEl]) % 10),
            }
        }),

    215061: () => new CardBuilder(101).name('梦迹一风').since('v4.1.0').talent(1).costAnemo(4)
        .description('{action}；装备有此牌的【hro】在【sts115061】状态下进行[重击]后：下次从该角色执行｢切换角色｣行动时少花费1个元素骰，并且造成1点[风元素伤害]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/08a42903fcff2a5249ef1fc4021ecf7a_492792879105973370.png')
        .handle((_, event) => {
            const { isChargedAtk, hero, isExecTask } = event;
            if (!hero) return;
            const hasSts115061 = hasObjById(hero?.heroStatus, 115061);
            if (isChargedAtk && hasSts115061 || isExecTask) {
                return { triggers: 'skilltype1', execmds: [{ cmd: 'getStatus', status: 115062, hidxs: [hero.hidx] }] }
            }
        }),

    215071: () => new CardBuilder(324).name('偷懒的新方法').since('v4.4.0').talent(1).costAnemo(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】为出战角色期间，我方引发扩散反应时：抓2张牌。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/8399149d2618f3566580df22b153579a_4849308244790424730.png')
        .handle((card, event) => {
            const { hero } = event;
            if (!hero?.isFront || card.perCnt <= 0) return;
            return {
                triggers: 'Swirl',
                execmds: [{ cmd: 'getCard', cnt: 2 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    215081: () => new CardBuilder(291).name('如影流露的冷刃').since('v4.3.0').talent(1).costAnemo(3)
        .description('{action}；装备有此牌的【hro】每回合第二次使用【ski】时：伤害+2，并强制敌方切换到前一个角色。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/09214e6eaeb5399f4f1dd78e7a9fcf66_5441065129648025265.png'),

    215091: () => new CardBuilder(352).name('妙道合真').since('v4.6.0').talent(2).costAnemo(3).energy(2)
        .description('{action}；装备有此牌的【hro】所召唤的【smn115093】入场时和行动阶段开始时：生成1个[风元素骰]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/6f4712bcbbe53515e63c1de112a58967_7457105821554314257.png'),

    215101: () => new CardBuilder(411).name('知是留云僊').since('v5.0.0').talent(1).costAnemo(3).useCnt(0).perCnt(2)
        .description('{action}；我方切换角色时，此牌累积1层｢风翎｣。（每回合最多累积2层）；装备有此牌的【hro】使用【ski,0】时，消耗所有｢风翎｣，每消耗1层都使伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/62bc79a32ed8d588a83497004487fb3c_1818674885518885960.png')
        .handle((card, event) => {
            const { trigger } = event;
            if (trigger == 'switch' && card.perCnt <= 0) return;
            return {
                triggers: ['switch', 'skilltype1'],
                addDmgCdt: isCdt(trigger == 'skilltype1', card.useCnt),
                isAddTask: trigger == 'switch',
                exec: () => {
                    if (trigger == 'switch') {
                        card.addUseCnt();
                        card.minusPerCnt();
                    } else if (trigger == 'skilltype1') card.useCnt = 0;
                }
            }
        }),

    216011: () => new CardBuilder(102).name('储之千日，用之一刻').offline('v1').talent(1).costGeo(4)
        .description('{action}；装备有此牌的【hro】在场时，【sts116011】会使我方造成的[岩元素伤害]+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/8b72e98d01d978567eac5b3ad09d7ec1_7682448375697308965.png'),

    216021: () => new CardBuilder(103).name('支援就交给我吧').offline('v1').talent(1).costGeo(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】｢普通攻击｣后：如果此牌和【sts116021】仍在场，治疗我方所有角色1点。（每回合1次）')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/4c6332fd42d6edc64633a44aa900b32f_248861550176006555.png')
        .handle((card, event) => {
            const { heros = [], combatStatus = [] } = event;
            if (!hasObjById(combatStatus, 116021) || card.perCnt <= 0) return;
            return {
                triggers: 'skilltype1',
                execmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(heros) }],
                exec: () => card.minusPerCnt(),
            }
        }),

    216031: () => new CardBuilder(104).name('炊金馔玉').since('v3.7.0').talent(2).costGeo(5)
        .description('{action}；装备有此牌的【hro】生命值至少为7时，【hro】造成的伤害和我方召唤物造成的[岩元素伤害]+1。')
        .description('{action}；装备有此牌的【hro】在场时，我方出战角色在[护盾]角色状态或[护盾]出战状态的保护下时，我方召唤物造成的[岩元素伤害]+1。', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/05/24/255120502/1742e240e25035ec13155e7975f7fe3e_495500543253279445.png')
        .handle((_, event, ver) => {
            const { hero, heros, combatStatus = [], sktype = SKILL_TYPE.Vehicle, isSummon = -1 } = event;
            if (ver.lt('v4.8.0')) {
                const fhero = heros?.find(h => h.isFront);
                const istShield = fhero?.heroStatus.some(sts => sts.hasType(STATUS_TYPE.Shield));
                const ostShield = combatStatus.some(sts => sts.hasType(STATUS_TYPE.Shield));
                if ((!istShield && !ostShield) || isSummon == -1) return;
                return { triggers: 'Geo-dmg', addDmgCdt: 1 }
            }
            if (!hero || hero.hp < 7) return;
            const triggers: Trigger[] = [];
            if (hero.isFront && sktype != SKILL_TYPE.Vehicle) triggers.push('dmg');
            if (isSummon > -1) triggers.push('Geo-dmg')
            return { triggers, addDmgCdt: 1 }
        }),

    216041: () => new CardBuilder(105).name('神性之陨').since('v4.0.0').talent(1).costGeo(3)
        .description('{action}；装备有此牌的【hro】在场时，如果我方场上存在【smn116041】，则我方角色进行[下落攻击]时造成的伤害+1，且少花费1个[无色元素骰]。')
        .description('{action}；装备有此牌的【hro】在场时，如果我方场上存在【smn116041】，则我方角色进行[下落攻击]时造成的伤害+1。', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/82503813/d10a709aa03d497521636f9ef39ee531_3239361065263302475.png')
        .handle((_, event) => {
            const { summons = [], isFallAtk } = event;
            if (hasObjById(summons, 116041) && isFallAtk) {
                return { triggers: ['skilltype1', 'other-skilltype1'], addDmgCdt: 1 }
            }
        }),

    216051: () => new CardBuilder(106).name('荒泷第一').since('v3.6.0').talent(0).costGeo(1).anydice(2)
        .description('{action}；装备有此牌的【hro】每回合第2次及以后使用【ski】时：如果触发【sts116054】，伤害额外+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/46588f6b5a254be9e797cc0cfe050dc7_8733062928845037185.png')
        .handle((_, event) => {
            const { hero, isChargedAtk } = event;
            if (!hero) return;
            const { heroStatus, skills: [{ useCntPerRound }] } = hero;
            if (isChargedAtk && useCntPerRound >= 2 && hasObjById(heroStatus, 116054)) {
                return { triggers: 'skilltype1', addDmgCdt: 1 }
            }
        }),

    216061: () => new CardBuilder(292).name('犬奔·疾如风').since('v4.3.0').talent(1).costGeo(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】在场时，我方角色造成[岩元素伤害]后：如果场上存在【sts116061】，抓1张牌。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5355a3c8d887fd0cc8fe8301c80d48ba_7375558397858714678.png')
        .handle((card, event) => {
            const { combatStatus = [], sktype = SKILL_TYPE.Vehicle } = event;
            if (!hasObjById(combatStatus, 116061) || card.perCnt <= 0 || sktype == SKILL_TYPE.Vehicle) return;
            return { triggers: ['Geo-dmg', 'other-Geo-dmg'], execmds: [{ cmd: 'getCard', cnt: 1 }], exec: () => card.minusPerCnt() }
        }),

    216071: () => new CardBuilder(375).name('庄谐并举').since('v4.7.0').talent(2).costGeo(3).energy(2)
        .description('{action}；装备有此牌的【hro】在场，且我方触发【sts116073】时：如果我方没有手牌，则使此次技能伤害+2。')
        .description('{action}；装备有此牌的【hro】在场时，我方没有手牌，则【sts116073】会使｢普通攻击｣造成的伤害额外+2。', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/51cdfbb5318ad7af6ad0eece4ef05423_8606735009174856621.png'),

    216081: () => new CardBuilder(399).name('不明流通渠道').talent(1).costGeo(3).perCnt(1)
        .description('{action}；【装备有此牌的〖hro〗使用技能后：】抓2张【crd116081】。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/ff75f3060780eb4e510f0f60c336dcb6_6404286710698044326.png')
        .handle((card, event) => {
            const { pile = [] } = event;
            if (card.perCnt <= 0 || !hasObjById(pile, 116081)) return;
            return {
                triggers: 'skill',
                execmds: [{ cmd: 'getCard', cnt: 2, card: 116081, isAttach: true }],
                exec: () => card.minusPerCnt(),
            }
        }),

    216091: () => new CardBuilder(423).name('落染五色').since('v5.1.0').talent(1).costGeo(4).costGeo(3, 'v5.4.0')
        .description('{action}；装备有此牌的【hro】使用【ski】时：额外召唤1个【smn116094】，并改为从4个【smn116097】中[挑选]1个并召唤。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/469388e91dfc3c32fa631dbd8984bb1c_6906890829853379228.png'),

    216101: () => new CardBuilder(463).name('夜域赐礼·团结炉心').since('v5.5.0').talent().costGeo(1).perCnt(2)
        .description('【此牌在场时：】我方【crd116102】或【smn116103】触发效果后，抓1张牌。（每回合2次）')
        .src('tmp/UI_Gcg_CardFace_Modify_Talent_Kachina_-298830647')
        .handle((card, event) => {
            const { source } = event;
            if (card.perCnt <= 0 || (source != 116102 && source != 116103)) return;
            return {
                triggers: 'trigger',
                execmds: [{ cmd: 'getCard', cnt: 1 }],
                exec: () => card.minusPerCnt(),
            }
        }),

    217011: () => new CardBuilder(107).name('飞叶迴斜').offline('v1').talent(1).costDendro(4).costDendro(3, 'v3.4.0').perCnt(1)
        .description('{action}；装备有此牌的【hro】使用了【ski】的回合中，我方角色的技能引发[草元素相关反应]后：造成1点[草元素伤害]。（每回合1次）')
        .src('https://patchwiki.biligame.com/images/ys/0/01/6f79lc4y34av8nsfwxiwtbir2g9b93e.png'),

    217021: () => new CardBuilder(108).name('眼识殊明').since('v3.6.0').talent(1).costDendro(4)
        .description('{action}；装备有此牌的【hro】在附属【sts117021】期间，进行[重击]时少花费1个[无色元素骰]。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/e949b69145f320ae71ce466813339573_5047924760236436750.png')
        .handle((_, event) => {
            const { isChargedAtk, hero } = event;
            if (isChargedAtk && hasObjById(hero?.heroStatus, 117021)) {
                return { triggers: 'skilltype1', minusDiceSkill: { skilltype1: [0, 1, 0] } }
            }
        }),

    217031: () => new CardBuilder(109).name('心识蕴藏之种').since('v3.7.0').talent(3).costDendro(3).energy(2)
        .description('{action}；装备有此牌的【hro】在场时，根据我方队伍中存在的元素类型提供效果：；‹3火元素›：【sts117032】在场时，自身受到元素反应触发【sts117031】的敌方角色，所受【sts117031】的[穿透伤害]改为[草元素伤害];；‹4雷元素›：【sts117032】入场时，使当前对方场上【sts117031】的[可用次数]+1;；‹2水元素›：装备有此牌的【hro】所生成的【sts117032】初始[持续回合]+1。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/013c862d1c89850fb23f26763f601b11_823565145951775374.png'),

    217041: () => new CardBuilder(110).name('慈惠仁心').since('v4.1.0').talent(1).costDendro(3)
        .description('{action}；装备有此牌的【hro】生成的【smn117041】，在[可用次数]仅剩余最后1次时造成的伤害和治疗各+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/2b762e3829ac4a902190fde3e0f5377e_8510806015272134296.png'),

    217051: () => new CardBuilder(111).name('在地为化').since('v4.2.0').talent(2).costDendro(4).energy(2)
        .description('{action}；装备有此牌的【hro】在场，【sts117053】触发治疗效果时：生成1个出战角色类型的元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/aa3ad0a53cd667f9d6e5393214dfa09d_9069092032307263917.png'),

    217061: () => new CardBuilder(293).name('正理').since('v4.3.0').talent(2).costDendro(3).energy(2)
        .description('{action}；装备有此牌的【hro】使用【ski】时，如果消耗了[持续回合]至少为1的【sts117061】，则总是附属[持续回合]为3的【sts117061】，并且抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/1ea58f5478681a7975c0b79906df7e07_2030819403219420224.png')
        .handle((_, event) => {
            if (!hasObjById(event.hero?.heroStatus, 117061)) return;
            return { triggers: 'skilltype3', execmds: [{ cmd: 'getCard', cnt: 1 }] }
        }),

    217071: () => new CardBuilder(340).name('沿途百景会心').since('v4.5.0').talent(1).costDendro(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】为出战角色，我方进行｢切换角色｣行动时：少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/d00693f2246c912c56900d481e37104a_1436874897141676884.png')
        .handle((card, event) => {
            const { switchHeroDiceCnt = 0 } = event;
            if (card.perCnt <= 0 || switchHeroDiceCnt == 0) return;
            return {
                triggers: 'minus-switch-from',
                minusDiceHero: 1,
                exec: () => card.minusPerCnt()
            }
        }),

    217081: () => new CardBuilder(376).name('预算师的技艺').since('v4.7.0').talent(1).costDendro(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】在场时，我方触发【sts117082】的效果后：将1张所[舍弃]卡牌的复制加入你的手牌。如果该牌为｢场地｣牌，则使本回合中我方下次打出｢场地｣时少花费2个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/10ea9432a97b89788ede72906f5af735_8657249785871520397.png'),

    217091: () => new CardBuilder(457).name('索报皆偿').since('v5.4.0').talent().costDendro(1).perCnt(1)
        .description('装备有此牌的【hro】切换至前台或使用【ski,1】时：若我方手牌不多于对方，则窃取1张原本元素骰费用最高的对方手牌，然后对手抓1张牌。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/a47cc0e0df6da9b518948c51861e73ab_5159453302126122992.png')
        .handle((card, event) => {
            const { hcardsCnt = 0, ehcardsCnt = 0 } = event;
            if (card.perCnt <= 0 || ehcardsCnt == 0 || hcardsCnt > ehcardsCnt) return;
            return {
                triggers: ['switch-to', 'skilltype2'],
                execmds: [
                    { cmd: 'stealCard', cnt: 1, mode: CMD_MODE.HighHandCard },
                    { cmd: 'getCard', cnt: 1, isOppo: true },
                ],
                exec: () => card.minusPerCnt()
            }
        }),

    217101: () => new CardBuilder(464).name('茉洁香迹').since('v5.5.0').talent().costDendro(1).perCnt(1)
        .description('所附属角色造成的[物理伤害]变为[草元素伤害]。；【装备有此牌的〖hro〗｢普通攻击｣后：】我方最高等级的｢柔灯之匣｣立刻行动1次。（每回合1次）')
        .src('tmp/UI_Gcg_CardFace_Modify_Talent_Emilie_2014980344'),

    221011: () => new CardBuilder(112).name('冰萤寒光').since('v3.7.0').talent(1).costCryo(3)
        .description('{action}；装备有此牌的【hro】使用技能后：如果【smn121011】的[可用次数]被叠加到超过上限，则造成2点[冰元素伤害]。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a6d2ef9ea6bacdc1b48a5253345986cd_7285265484367498835.png')
        .handle((card, event) => {
            const { summons = [], trigger = '' } = event;
            const summon = getObjById(summons, 121011);
            if (summon && ['skilltype1', 'skilltype2'].includes(trigger)) {
                const cnt = +trigger.slice(-1);
                if (summon.useCnt + cnt > summon.maxUse) card.perCnt = -1;
                else card.perCnt = 0;
            }
        }),

    221021: () => new CardBuilder(294).name('苦痛奉还').since('v4.3.0').talent().costSame(3).tag(CARD_TAG.Barrier).perCnt(1)
        .description('我方出战角色为【hro】时，才能打出：入场时，生成3个【hro】当前元素类型的元素骰。；角色受到至少为3点的伤害时：抵消1点伤害，然后根据【hro】的形态对敌方出战角色附属【sts121022】或【sts121022,1】。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/b053865b60ec217331ea86ff7fb8789c_3260337021267875040.png')
        .handle((card, event) => {
            const { hero, heros, restDmg = -1 } = event;
            if (!hero) return;
            if (restDmg > -1) {
                if (restDmg < 3 || card.perCnt == 0) return { restDmg }
                return { restDmg: restDmg - 1, statusOppo: hero.element == ELEMENT_TYPE.Cryo ? 121022 : 163011, exec: () => card.minusPerCnt() }
            }
            return { isValid: isTalentFront(heros, card), cmds: [{ cmd: 'getDice', cnt: 3, element: hero.element }] }
        }),

    221031: () => new CardBuilder(325).name('严霜棱晶').since('v4.4.0').talent().costCryo(1)
        .description('我方出战角色为【hro】时，才能打出：使其附属【sts121034】。；装备有此牌的【hro】触发【sts121034】后：对敌方出战角色附属【sts121022】。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/71d1da569b1927b33c9cd1dcf04c7ab1_880598011600009874.png')
        .handle((card, event) => {
            const { heros = [] } = event;
            return { isValid: isTalentFront(heros, card), status: 121034 }
        }),

    221041: () => new CardBuilder(400).name('冰雅刺剑').since('v4.8.0').talent(1).costCryo(3)
        .description('{action}；【装备有此牌的〖hro〗触发〖ski,3〗后：】使敌方出战角色的【sts122】层数翻倍。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/a0597437167a2f8b5637ae66b393bd84_1668427359164092344.png'),

    222011: () => new CardBuilder(113).name('百川奔流').offline('v1').talent(3).costHydro(4).energy(3)
        .description('{action}；装备有此牌的【hro】施放【ski】时：使我方所有召唤物[可用次数]+1。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/b1a0f699a2168c60bc338529c3dee38b_3650391807139860687.png'),

    222021: () => new CardBuilder(114).name('镜锢之笼').talent(1).costHydro(3).costHydro(4, 'v4.2.0')
        .description('{action}；装备有此牌的【hro】生成的【sts122021】获得以下效果：；初始[持续回合]+1，并且会使所附属角色受到的[水元素伤害]+1。')
        .description('{action}；装备有此牌的【hro】生成的【sts122021】获得以下效果：；初始[持续回合]+1，并且会使所附属角色切换到其他角色时元素骰费用+1。', 'v4.8.0')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/12109492/b0294bbab49b071b0baa570bc2339917_4550477078586399854.png'),

    222031: () => new CardBuilder(353).name('暗流涌动').since('v4.6.0').talent().costHydro(1)
        .description('【入场时：】如果装备有此牌的【hro】已触发过【sts122031】，则在对方场上生成【sts122033】。；装备有此牌的【hro】被击倒或触发【sts122031】时：在对方场上生成【sts122033】。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/1dc62c9d9244cd9d63b6f01253ca9533_7942036787353741713.png')
        .handle((_, event) => {
            const { hero } = event;
            const isTriggered = !hasObjById(hero?.heroStatus, 122031);
            return {
                triggers: 'will-killed',
                statusOppo: isCdt(isTriggered, 122033),
                execmds: [{ cmd: 'getStatus', status: 122033, isOppo: true }],
            }
        }),

    222041: () => new CardBuilder(377).name('无光鲸噬').since('v4.7.0').talent(1).costHydro(4).perCnt(1)
        .description('{action}；装备有此牌的【hro】使用【ski】[舍弃]1张手牌后：治疗此角色该手牌元素骰费用的点数。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/6c8ce9408dc45b74242f45fb45c2e5d0_4468452485234515493.png')
        .handle((card, event) => {
            if (card.perCnt == 0) return;
            const { hcards = [], hcard } = event;
            return {
                triggers: 'skilltype2',
                execmds: [{ cmd: 'heal', cnt: Math.max(...hcards.filter(c => c.entityId != hcard?.entityId).map(c => c.cost + c.anydice)) }],
                exec: () => card.minusPerCnt(),
            }
        }),

    222051: () => new CardBuilder(412).name('轻盈水沫').since('v5.0.0').talent(1).costHydro(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】在场，我方使用｢特技｣时：少花费1个元素骰。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/b95574484dca95f9e3a11750c6b3058a_7054619643283816743.png')
        .handle((card, event) => {
            if (card.perCnt <= 0) return;
            return {
                triggers: ['vehicle', 'other-vehicle'],
                minusDiceSkill: { skilltype5: [0, 0, 1], isAll: true },
                exec: () => { event.isMinusDiceSkill && card.minusPerCnt() }
            }
        }),

    223011: () => new CardBuilder(115).name('悉数讨回').talent(1).costPyro(3)
        .description('{action}；装备有此牌的【hro】生成的【sts123011】获得以下效果：；初始[可用次数]+1，并且使所附属角色造成的[物理伤害]变为[火元素伤害]。')
        .src('https://patchwiki.biligame.com/images/ys/4/4b/p2lmo1107n5nwc2pulpjkurlixa2o4h.png'),

    223021: () => new CardBuilder(116).name('烬火重燃').since('v3.7.0').offline('v1').talent().costPyro(2)
        .description('【入场时：】如果装备有此牌的【hro】已触发过【sts123022】，就立刻弃置此牌，为角色附属【sts123024】。；装备有此牌的【hro】触发【sts123022】时：弃置此牌，为角色附属【sts123024】。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/c065153c09a84ed9d7c358c8cc61171f_8734243408282507546.png')
        .handle((card, event) => {
            const { heros = [], trigger } = event;
            if (!hasObjById(getObjById(heros, card.userType as number)?.heroStatus, 123022) || trigger == 'will-killed') {
                return { triggers: 'will-killed', status: 123024, isDestroy: true }
            }
        }),

    223031: () => new CardBuilder(295).name('魔蝎烈祸').since('v4.3.0').talent(2).costPyro(3).energy(2)
        .description('{action}；装备有此牌的【hro】在场，我方使用【rsk1230311】击倒敌方角色后：将一张【crd123031】加入手牌。；【回合结束时：】生成1层【sts123032】、')
        .description('{action}；装备有此牌的【hro】生成的【smn123031】在【hro】使用过｢普通攻击｣或｢元素战技｣的回合中，造成的伤害+1。；【smn123031】的减伤效果改为每回合至多2次。', 'v5.1.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/031bfa06becb52b34954ea500aabc799_7419173290621234199.png')
        .handle((_, event, ver) => {
            if (ver.lt('v5.1.0')) return;
            const { skid = -1, trigger } = event;
            const triggers: Trigger[] = ['phase-end'];
            if (skid == 1230311) triggers.push('kill');
            return {
                triggers,
                isAddTask: true,
                execmds: isCdt(trigger == 'kill',
                    [{ cmd: 'getCard', cnt: 1, card: 123031 }],
                    [{ cmd: 'getStatus', status: 123032 }]
                )
            }
        }),

    223041: () => new CardBuilder(354).name('熔火铁甲').since('v4.6.0').talent().costPyro(1).perCnt(1)
        .description('【入场时：】对装备有此牌的【hro】[附着火元素]。；我方除【sts123041】以外的[护盾]状态或[护盾]出战状态被移除后：装备有此牌的【hro】附属2层【sts123041】。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/c6d40de0f6da94fb8a8ddeccc458e5f0_8856536643600313687.png')
        .handle((_, { hero }) => ({ cmds: [{ cmd: 'attach', hidxs: [hero?.hidx ?? -1] }] })),

    224011: () => new CardBuilder(117).name('汲能棱晶').since('v3.7.0').talent().event(true).costElectro(2).costElectro(3, 'v4.2.0')
        .description('[战斗行动]：我方出战角色为【hro】时，治疗该角色3点，并附属【sts124014】。')
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/3257a4da5f15922e8f068e49f5107130_6618336041939702810.png')
        .handle((card, event) => {
            const { heros = [] } = event;
            return { isValid: isTalentFront(heros, card), status: 124014, cmds: [{ cmd: 'heal', cnt: 3 }] }
        }),

    224021: () => new CardBuilder(296).name('悲号回唱').since('v4.3.0').talent(1).talent(-1, 'v4.4.0').costElectro(3).costSame(0, 'v4.4.0').perCnt(1)
        .description('{action}；装备有此牌的【hro】在场，附属有【sts124022】的敌方角色受到伤害时：我方抓1张牌。（每回合1次）')
        .description('装备有此牌的【hro】在场，附属有【sts124022】的敌方角色受到伤害时：我方抓1张牌。（每回合1次）', 'v4.4.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/2dd249ed58e8390841360d901bb0908d_4304004857878819810.png')
        .handle((card, event) => {
            if (card.perCnt <= 0) return;
            const { dmg = [], eheros = [], isExecTask } = event;
            const [ehero] = eheros.filter(h => hasObjById(h.heroStatus, 124022));
            if (!isExecTask && (!ehero || (dmg[ehero.hidx] ?? -1) < 0)) return;
            return { triggers: 'getdmg-oppo', execmds: [{ cmd: 'getCard', cnt: 1 }], exec: () => card.minusPerCnt() }
        }),

    224031: () => new CardBuilder(326).name('明珠固化').since('v4.4.0').talent().costSame(0)
        .description('我方出战角色为【hro】时，才能打出：入场时，使【hro】附属[可用次数]为1的【sts124032】\\；如果已附属【sts124032】，则使其[可用次数]+1。；装备有此牌的【hro】所附属的【sts124032】抵消召唤物造成的伤害时，改为每回合2次不消耗[可用次数]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/ec966272143de66e191950a6016cf14f_3693512171806066057.png')
        .handle((card, event) => {
            const { hero, heros } = event;
            const cnt = (getObjById(hero?.heroStatus, 124032)?.useCnt ?? 0) + 1;
            return { isValid: isTalentFront(heros, card), status: [[124032, true, cnt]] }
        }),

    224041: () => new CardBuilder(341).name('雷萤浮闪').since('v4.5.0').talent(1).costElectro(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】在场时，我方选择行动前：如果【smn124041】的[可用次数]至少为3，则【smn124041】立刻造成1点[雷元素伤害]。（需消耗[可用次数]，每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/adf954bd07442eed0bc3c77847c2d727_1148348250566405252.png'),

    224051: () => new CardBuilder(378).name('亡雷凝蓄').since('v4.7.0').talent().costElectro(1)
        .description('【入场时：】生成1张【crd124051】，置入我方手牌。；装备有此牌的【hro】在场时，我方打出【crd124051】后：抓1张牌，然后生成1张【crd124051】，随机置入我方牌库中。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/5138e59de35ef8ede3a26540a7b883e0_5065992084832534424.png')
        .handle((_, { hcard }) => ({
            triggers: 'card',
            cmds: [{ cmd: 'getCard', cnt: 1, card: 124051 }],
            execmds: isCdt(hcard?.id == 124051, [{ cmd: 'getCard', cnt: 1 }, { cmd: 'addCard', cnt: 1, card: 124051 }]),
        })),

    224061: () => new CardBuilder(424).name('侵雷重闪').since('v5.1.0').talent().costElectro(1)
        .description('【入场时：】如果装备有此牌的【hro】已触发过【sts124061】，则使敌方出战角色失去1点[充能]。；装备有此牌的【hro】被击倒或触发【sts124061】时：弃置此牌，使敌方出战角色失去1点[充能]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/caa9283f50c2093abad5c6ba1bf73335_6393422977381042780.png').
        handle((card, event) => {
            const { heros = [], slotUse, trigger } = event;
            if (!hasObjById(getObjById(heros, card.userType as number)?.heroStatus, 124061) || trigger == 'will-killed') {
                const cmds: Cmds[] = [{ cmd: 'getEnergy', cnt: -1, isOppo: true }];
                return { triggers: 'will-killed', cmds, execmds: cmds, isDestroy: !slotUse }
            }
        }),

    225011: () => new CardBuilder(118).name('机巧神通').talent(1).costAnemo(3)
        .description('{action}；装备有此牌的【hro】施放【ski】后，我方切换到后一个角色；施放【ski,2】后，我方切换到前一个角色。')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/12109492/29356bd9bc7cbd8bf4843d6725cb8af6_6954582480310016602.png'),

    225021: () => new CardBuilder(297).name('毁裂风涡').since('v4.3.0').talent(1).costAnemo(3).perCnt(1)
        .description('{action}；装备有此牌的【hro】在场时，敌方出战角色所附属的【sts125021】状态被移除后：对下一个敌方后台角色附属【sts125021】。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/2832d884a3a931ecf486c2259908f41b_7125699530621449061.png'),

    225031: () => new CardBuilder(379).name('亡风啸卷').since('v4.7.0').talent().costAnemo(1)
        .description('【入场时：】生成1张【crd124051】，置入我方手牌。；装备有此牌的【hro】在场时，我方打出【crd124051】后：本回合中，我方下次切换角色后，生成1个出战角色类型的元素骰。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/fe1743d31d026423617324d6c74ff0af_8502180086842896297.png')
        .handle((_, { hcard }) => ({
            triggers: 'card',
            cmds: [{ cmd: 'getCard', cnt: 1, card: 124051 }],
            execmds: isCdt(hcard?.id == 124051, [{ cmd: 'getStatus', status: 125032 }]),
        })),

    226011: () => new CardBuilder(119).name('重铸：岩盔').talent(2).costGeo(4).energy(2)
        .description('{action}；装备有此牌的【hro】击倒敌方角色后：【hro】重新附属【sts126011】和【sts126012】。')
        .src('https://patchwiki.biligame.com/images/ys/9/9f/ijpaagvk7o9jh1pzb933vl9l2l4islk.png')
        .handle((card, event) => {
            const { skid = -1, hero } = event;
            if (getHidById(skid) != card.userType || !hero) return;
            return { triggers: 'kill', execmds: [{ cmd: 'getStatus', status: [126011, 126012], hidxs: [hero.hidx] }] }
        }),

    226022: () => new CardBuilder(298).name('晦朔千引').since('v4.3.0').talent().event(true).costSame(2)
        .description('[战斗行动]：我方出战角色为【hro】时，对该角色打出。使【hro】附属【sts126022】，然后生成每种我方角色所具有的元素类型的元素骰各1个。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5fd09f6cb9ecdc308105a2965989fdec_6866194267097059630.png')
        .handle((card, event) => {
            const { heros = [] } = event;
            const element = [...new Set(heros.map(h => h.element))];
            return {
                isValid: isTalentFront(heros, card),
                status: 126022,
                cmds: [{ cmd: 'getDice', cnt: element.length, element }],
            }
        }),

    226031: () => new CardBuilder(437).name('异兽侵蚀').since('v5.2.0').talent(1).costGeo(3)
        .description('{action}；装备有此牌的【hro】在场时，对方的【sts126031】最多可叠加到5次，并且所附属角色不在后台时也会生效。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/e61044db77d2bee655c1d045df887554_5793154205438411376.png')
        .handle((_, event) => {
            const { eheros = [], slotUse } = event;
            if (!slotUse) return;
            eheros.forEach(h => h.heroStatus.forEach(sts => sts.id == 126031 && (sts.maxCnt = 5)));
        }),

    227011: () => new CardBuilder(120).name('孢子增殖').offline('v1').talent(1).costDendro(3)
        .description('{action}；装备有此牌的【hro】可累积的｢【sts127011】｣层数+1。')
        .src('https://patchwiki.biligame.com/images/ys/4/41/bj27pgk1uzd78oc9twitrw7aj1fzatb.png'),

    227021: () => new CardBuilder(380).name('万千子嗣').since('v4.7.0').talent().costDendro(2)
        .description('【入场时：】生成4张【crd127021】，随机置入我方牌库。；装备有此牌的【hro】在场时，我方【smn127022】造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/37bdaf8745b1264fdac723555ba2938b_177410860486747187.png')
        .handle((_, event) => {
            const { isSummon = -1 } = event;
            const isAddDmg = [127022, 127023, 127024, 127025].includes(isSummon);
            return { cmds: [{ cmd: 'addCard', cnt: 4, card: 127021 }], triggers: ['dmg', 'other-dmg'], addDmgCdt: isCdt(isAddDmg, 1) }
        }),

    227031: () => new CardBuilder(425).name('灵蛇旋嘶').since('v5.1.0').talent(1).costDendro(3)
        .description('{action}；装备有此牌的【hro】在场，我方装备了【crd127032】的角色切换至出战时：造成1点[草元素伤害]。（每回合1次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/6f6a41cd2ca30f56ff066b73a5be903d_3952798209334004681.png'),

    112113: () => new CardBuilder().name('圣俗杂座').event().costSame(0)
        .description('在｢始基力:荒性｣和｢始基力:芒性｣之中，切换【hro】的形态。；如果我方场上存在【smn112111】或【smn112112】，也切换其形态。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/6b2b966c07c54e8d86dd0ef057ae5c4a_6986508112474897949.png')
        .handle((card, event) => {
            const { heros = [] } = event;
            const hidx = getObjIdxById(heros, getHidById(card.id));
            if (hidx == -1) return;
            const hero = heros[hidx];
            const clocal = hero.tags.at(-1);
            const nsummonId = +(clocal == HERO_TAG.ArkheOusia);
            return {
                cmds: [
                    { cmd: 'loseSkill', hidxs: [hidx], mode: 1 },
                    { cmd: 'getSkill', hidxs: [hidx], cnt: 12112 + nsummonId * 10, mode: 1 },
                    { cmd: 'changeSummon', cnt: 112111 + nsummonId, hidxs: [112111 + (nsummonId ^ 1)] },
                ],
                exec: () => {
                    hero.tags.pop();
                    if (clocal == HERO_TAG.ArkhePneuma) {
                        hero.tags.push(HERO_TAG.ArkheOusia);
                        hero.UI.src = hero.UI.srcs[0];
                    } else {
                        hero.tags.push(HERO_TAG.ArkhePneuma);
                        hero.UI.src = hero.UI.srcs[1];
                    }
                }
            }
        }),

    112131: () => new CardBuilder().name('激愈水球·大').event().costSame(0)
        .description('【抓到此牌时：】治疗我方出战角色3点。生成1张【crd112132】，将其置于对方牌库顶部第2张牌的位置。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/19/258999284/47eb08392a0efd5cf6aa29704aa12f38_328269596356756432.png')
        .handle(() => ({
            triggers: 'getcard',
            execmds: [{ cmd: 'heal', cnt: 3 }, { cmd: 'addCard', card: 112132, cnt: -1, hidxs: [2], isOppo: true }],
        })),

    112132: () => new CardBuilder().name('激愈水球·中').event().costSame(0)
        .description('【抓到此牌时：】对所在阵营的出战角色造成2点[水元素伤害]。生成1张【crd112133】，将其置于对方牌库顶部。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/19/258999284/222f333f4beff94cffb0b9f4ece05e17_5182172070860859937.png')
        .handle(() => ({
            triggers: 'getcard',
            execmds: [
                { cmd: 'attack', cnt: 2, element: DAMAGE_TYPE.Hydro, isOppo: false },
                { cmd: 'addCard', card: 112133, cnt: 1, hidxs: [1], isOppo: true },
            ],
        })),

    112133: () => new CardBuilder().name('激愈水球·小').event().costSame(0)
        .description('【抓到此牌时：】治疗所有我方角色1点，生成【sts112101】。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/19/258999284/a94874bb8e80358f5354d7d64697366f_2676191020837949319.png')
        .handle((_, event) => ({
            triggers: 'getcard',
            execmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(event.heros) }, { cmd: 'getStatus', status: 112101 }],
        })),

    112142: () => new CardBuilder().name('咬咬鲨鱼').vehicle(true).costSame(0)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/d5b28af6dee07cf37bb2bfaa757a4656_5892221598902559399.png')
        .description('【双方切换角色后，且〖hro〗为出战角色时：】消耗1点｢夜魂值｣，使敌方出战角色附属【sts112143】。')
        .handle((_, event) => {
            const { hero, trigger } = event;
            if (trigger == 'switch-oppo' && !hero?.isFront) return;
            return {
                triggers: ['switch-to', 'switch-oppo'],
                isAddTask: true,
                execmds: [{ cmd: 'getStatus', status: 112143, isOppo: true }],
            }
        }),

    113131: () => new CardBuilder().name('超量装药弹头').event(true).costPyro(2)
        .description('[战斗行动]：对敌方｢出战角色｣造成1点[火元素伤害]。；【此牌被[舍弃]时：】对敌方｢出战角色｣造成1点[火元素伤害]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/9e3f3602c9eb4929bd9713b86c7fc5a1_5877781091007295306.png')
        .handle(() => ({ triggers: 'discard', cmds: [{ cmd: 'attack', element: DAMAGE_TYPE.Pyro, cnt: 1 }] })),

    114031: () => new CardBuilder().name('雷楔').talent().event(true).costElectro(3)
        .description('[战斗行动]：将【hro】切换到场上，立刻使用【ski,1】。本次【ski,1】会为【hro】附属【sts114032】，但是不会再生成【雷楔】。(【hro】使用【ski,1】时，如果此牌在手中：不会再生成【雷楔】，而是改为[舍弃]此牌，并为【hro】附属【sts114032】)')
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/12109492/3d370650e825a27046596aaf4a53bb8d_7172676693296305743.png')
        .handle((card, event) => {
            const { heros = [] } = event;
            const hero = getObjById(heros, card.userType as number);
            if (!hero) return;
            const cmds: Cmds[] = [{ cmd: 'useSkill', cnt: 14032 }];
            if (!hero.isFront) cmds.unshift({ cmd: 'switch-to', hidxs: [hero.hidx] });
            return { triggers: 'skilltype2', cmds }
        }),

    115102: () => new CardBuilder().name('竹星').vehicle().costSame(0).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/e58400e1d1d763da8b03886edd298d0e_3195150843851699982.png'),

    116081: () => new CardBuilder().name('裂晶弹片').event().costSame(1)
        .description('对敌方｢出战角色｣造成1点物理伤害，抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/cab5b83ad4392bcc286804ebc8f664db_6422552968387467695.png')
        .handle(() => ({ cmds: [{ cmd: 'attack', element: DAMAGE_TYPE.Physical, cnt: 1 }, { cmd: 'getCard', cnt: 1 }] })),

    116102: () => new CardBuilder().name('冲天转转').vehicle(true).costSame(0)
        .description('【附属角色切换至后台时：】消耗1点｢夜魂值｣，召唤【smn116103】。')
        .handle((_) => ({ triggers: 'switch-from', isAddTask: true, summon: 116103, isTrigger: true })),

    122051: () => new CardBuilder().name('水泡史莱姆').vehicle().costSame(0).useCnt(2)
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/4135146ec3ade2b16373478d9cc6f4f5_3656451016033618979.png'),

    123031: () => new CardBuilder().name('厄灵·炎之魔蝎').vehicle().costSame(0).tag(CARD_TAG.Barrier).useCnt(1).perCnt(2)
        .description('【所附属角色受到伤害时：】如可能，失去1点[充能]，以抵消1点伤害，然后生成【sts123032】。（每回合至多2次）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/8bb20558ca4a0f53569eb23a7547bdff_4485030285188835351.png')
        .handle((card, event) => {
            const { hero, restDmg = -1 } = event;
            if (restDmg == -1 || !hero) return;
            const isBarrier = card.perCnt > 0 && !!hero?.energy;
            if (!isBarrier || restDmg == 0) return { restDmg }
            return {
                restDmg: restDmg - 1,
                execmds: [{ cmd: 'getEnergy', cnt: -1, hidxs: [hero.hidx] }, { cmd: 'getStatus', status: 123032 }],
                exec: () => card.minusPerCnt()
            }
        }),

    124051: () => new CardBuilder().name('噬骸能量块').event().costSame(0)
        .description('随机[舍弃]1张原本元素骰费用最高的手牌，生成1个我方出战角色类型的元素骰。（每回合最多打出1张）')
        .description('随机[舍弃]1张原本元素骰费用最高的手牌，生成1个我方出战角色类型的元素骰。如果我方出战角色是｢圣骸兽｣角色，则使其获得1点[充能]。（每回合最多打出1张）', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/7cb3ab81a7226897afdff50f4d567c13_7393439119842323642.png')
        .handle((_, event, ver) => {
            const { hero, combatStatus = [] } = event;
            const cmds: Cmds[] = [{ cmd: 'discard', mode: CMD_MODE.HighHandCard }, { cmd: 'getDice', cnt: 1, mode: CMD_MODE.FrontHero }];
            if (ver.lt('v4.8.0') && hero?.tags.includes(HERO_TAG.ConsecratedBeast)) cmds.push({ cmd: 'getEnergy', cnt: 1 })
            return { isValid: !hasObjById(combatStatus, 124053), cmds, status: 124053 }
        }),

    127021: () => new CardBuilder().name('唤醒眷属').event().costDendro(2)
        .description('【打出此牌或[舍弃]此牌时：】召唤一个独立的【smn127022】。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/5c6f5f310243aea5eff849b26dd80269_5016592096671426026.png')
        .handle((_, event) => {
            const { summons = [] } = event;
            if (summons.length == MAX_SUMMON_COUNT) return { isValid: false }
            let summon = 127022;
            while (hasObjById(summons, summon)) ++summon;
            return { triggers: 'discard', summon }
        }),

    127032: () => new CardBuilder().name('厄灵·草之灵蛇').vehicle().costSame(0).useCnt(2).perCnt(1).isSpReset()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/3261818320d16e4b8cabb03dbe540914_8652138560686355356.png')
        .handle((card, event) => {
            const { skid = -1, combatStatus = [], heros = [], slotUse, hcard, reset, trigger } = event;
            const hid = getHidById(card.id);
            const talent = getObjById(heros, hid)?.talentSlot;
            if (trigger == 'card' && hcard?.id == getTalentIdByHid(hid)) {
                return { triggers: 'card', exec: () => { card.perCnt == 0 && card.addPerCnt() } };
            }
            if (slotUse || reset) {
                if (!talent && card.perCnt == 1) card.minusPerCnt();
                return;
            }
            if (talent && trigger == 'switch-to') {
                if (card.perCnt <= 0) return;
                return { triggers: 'switch-to', execmds: [{ cmd: 'attack', cnt: 1, element: DAMAGE_TYPE.Dendro }], exec: () => card.minusPerCnt() };
            }
            if (skid != getVehicleIdByCid(card.id) || hasObjById(combatStatus, 127033)) return { triggers: 'vehicle' };
            return { exec: () => { !talent && card.perCnt == 1 && card.minusPerCnt() } }
        }),

    300006: () => new CardBuilder().name('斗争之火').place()
        .description('此牌会记录本回合你对敌方角色造成的伤害，记为｢斗志｣。；【行动阶段开始时：】若此牌是场上｢斗志｣最高的斗争之火，则清空此牌的｢斗志｣，使我方出战角色本回合造成的伤害+1。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/2e88a5df59e2b48de1bc62d60dd1ba5b_5370407805539882566.png'),

    301020: () => new CardBuilder().name('禁忌知识').event().costSame(0).tag(CARD_TAG.NonReconcile)
        .description('无法使用此牌进行元素调和，且每回合最多只能打出1张｢禁忌知识｣。；对我方出战角色造成1点[穿透伤害]，抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/fe20720734d5041d50cf6eab08689916_6711209992824489498.png')
        .handle((_, event) => {
            const { hero, combatStatus } = event;
            if (!hero) return;
            return {
                isValid: !hasObjById(combatStatus, 301021),
                cmds: [{ cmd: 'attack', cnt: 1, element: DAMAGE_TYPE.Pierce, hidxs: [hero.hidx], isOppo: false }, { cmd: 'getCard', cnt: 1 }],
                status: 301021,
            }
        }),

    302202: () => new CardBuilder().name('太郎丸的存款').event().costSame(0)
        .description('生成1个[万能元素骰]。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/ec89e83a04c551ed3814157e8ee4a3e8_6552557422383245360.png')
        .handle(() => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: DICE_COST_TYPE.Omni }] })),

    302203: () => new CardBuilder().name('｢清洁工作｣').event().costSame(0)
        .description('我方出战角色下次造成伤害+1。（可叠加，最多叠加到+2）')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/382849ade5e2cebea6b3a77a92f49f5b_4826032308536650097.png')
        .handle(() => ({ status: 302204 })),

    302206: () => new CardBuilder().name('瑟琳的声援').event().costSame(0)
        .description('随机将2张美露莘推荐的｢料理｣加入手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 2, subtype: CARD_SUBTYPE.Food }] })),

    302207: () => new CardBuilder().name('洛梅的声援').event().costSame(0)
        .description('随机将2张美露莘好奇的｢圣遗物｣加入手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 2, subtype: CARD_SUBTYPE.Artifact }] })),

    302208: () => new CardBuilder().name('柯莎的声援').event().costSame(0)
        .description('随机将2张美露莘称赞的｢武器｣加入手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 2, subtype: CARD_SUBTYPE.Weapon }] })),

    302209: () => new CardBuilder().name('夏诺蒂拉的声援').event().costSame(1)
        .description('随机将2张美露莘看好的超棒事件牌加入手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle(() => ({
            cmds: [{
                cmd: 'getCard',
                cnt: 2,
                subtype: CARD_SUBTYPE.ElementResonance,
                cardTag: CARD_TAG.LocalResonance,
                hidxs: [331101, 331201, 331331, 331401, 331501, 331601, 331701, 332015, 332016],
            }]
        })),

    302210: () => new CardBuilder().name('希洛娜的声援').event().costSame(0)
        .description('接下来3个回合结束时，各将1张美露莘看好的超棒事件牌加入手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle(() => ({ status: 302219 })),

    302211: () => new CardBuilder().name('希露艾的声援').event().costSame(1)
        .description('复制对方牌库顶部的3张牌，加入手牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle((_, event) => {
            const { epile = [] } = event;
            return { cmds: [{ cmd: 'getCard', cnt: 3, card: epile.slice(0, 3) }] }
        }),

    302212: () => new CardBuilder().name('薇尔妲的声援').event().costAny(2)
        .description('随机将2张｢秘传｣卡牌加入你的手牌，并恢复双方牌手的｢秘传｣卡牌使用机会。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle((_, event) => ({
            cmds: [{ cmd: 'getCard', cnt: 2, subtype: CARD_SUBTYPE.Legend }],
            exec: () => {
                const { playerInfo, eplayerInfo } = event;
                if (playerInfo) playerInfo.isUsedLegend = false;
                if (eplayerInfo) eplayerInfo.isUsedLegend = false;
            }
        })),

    302213: () => new CardBuilder().name('芙佳的声援').event().costSame(0)
        .description('随机生成｢伙伴｣到场上，直到填满双方支援区。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle((_, event) => {
            const { supports = [], esupports = [], randomInArr, getCardIds, isExec } = event;
            if (!randomInArr || !getCardIds) return;
            const support: number[] = [];
            const supportOppo: number[] = [];
            if (isExec) {
                const supportLen = MAX_SUPPORT_COUNT - supports.length;
                const esupportLen = MAX_SUPPORT_COUNT - esupports.length;
                const allyPool = getCardIds(c => c.hasSubtype(CARD_SUBTYPE.Ally));
                for (let i = 0; i < supportLen; ++i) {
                    support.push(randomInArr(allyPool)[0]);
                }
                for (let i = 0; i < esupportLen; ++i) {
                    supportOppo.push(randomInArr(allyPool)[0]);
                }
            }
            return { support, supportOppo }
        }),

    302214: () => new CardBuilder().name('托皮娅的声援').event().costSame(0)
        .description('抓2张牌，双方获得以下效果：本回合打出手牌后，随机[舍弃]1张牌或抓1张牌。')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], status: 302216, statusOppo: 302216 })),

    302215: () => new CardBuilder().name('卢蒂妮的声援').event().costSame(0)
        .description('抓2张牌，双方获得以下效果：角色使用技能后，随机受到2点治疗或2点[穿透伤害]。[可用次数]：2')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/b8cc5a1a4f585ab31d7af7621fe7cc9a_7205746796255007122.png')
        .handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 2 }], status: 302217, statusOppo: 302217 })),

    303230: () => new CardBuilder().name('海底宝藏').event().costSame(0)
        .description('治疗我方出战角色1点，生成1个随机基础元素骰。（每个角色每回合最多受到1次来自本效果的治疗。）')
        .description('治疗我方出战角色1点，生成1个随机基础元素骰。', 'v4.8.0')
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/3aff8ec3cf191b9696331d29ccb9d81e_7906651546886585440.png')
        .handle((_, event, ver) => {
            const { hero } = event;
            if (!hero) return;
            const cmds: Cmds[] = [{ cmd: 'getDice', cnt: 1, mode: CMD_MODE.Random }];
            if (ver.lt('v4.8.0') || !hasObjById(hero.heroStatus, 303231)) cmds.push({ cmd: 'heal', cnt: 1 });
            return { cmds, status: isCdt(ver.gte('v4.8.0'), 303231) }
        }),

    332033: () => magicCount(2),

    332034: () => magicCount(1),

    332035: () => magicCount(0),

    333021: () => new CardBuilder().name('奇瑰之汤·疗愈').food().costSame(0).canSelectHero(1)
        .description('治疗目标角色2点。')
        .src('tmp/UI_Gcg_CardFace_Event_Food_MingShi_-1513751782')
        .handle(() => ({ cmds: [{ cmd: 'heal', cnt: 2 }] })),

    333022: () => new CardBuilder().name('奇瑰之汤·助佑').food().costSame(0).canSelectHero(1)
        .src('tmp/UI_Gcg_CardFace_Event_Food_MingShi_-1513751782')
        .description('本回合中，目标角色下次使用技能时少花费2个元素骰。')
        .handle(() => ({ status: 303317 })),

    333023: () => new CardBuilder().name('奇瑰之汤·激愤').food().costSame(0).canSelectHero(1)
        .src('tmp/UI_Gcg_CardFace_Event_Food_MingShi_-1513751782')
        .description('本回合中，目标角色下一次造成的伤害+2。')
        .handle(() => ({ status: 303318 })),

    333024: () => new CardBuilder().name('奇瑰之汤·宁静').food().costSame(0).canSelectHero(1)
        .src('tmp/UI_Gcg_CardFace_Event_Food_MingShi_-1513751782')
        .description('本回合中，目标角色下次受到的伤害-2。')
        .handle(() => ({ status: 303319 })),

    333025: () => new CardBuilder().name('奇瑰之汤·安神').food().costSame(0).canSelectHero(1)
        .src('tmp/UI_Gcg_CardFace_Event_Food_MingShi_-1513751782')
        .description('本回合中，目标我方角色受到的伤害-1。（最多生效3次）')
        .handle(() => ({ status: 303320 })),

    333026: () => new CardBuilder().name('奇瑰之汤·鼓舞').food().costSame(0).canSelectHero(1)
        .src('tmp/UI_Gcg_CardFace_Event_Food_MingShi_-1513751782')
        .description('目标角色获得1点额外最大生命值。')
        .handle(() => ({ cmds: [{ cmd: 'addMaxHp', cnt: 1 }] })),

}

export const cardsTotal = (version: Version = VERSION[0]) => {
    if (version == 'vlatest') version = VERSION[0];
    const cards: Card[] = [];
    for (const id in allCards) {
        const cardBuilder = allCards[id]().version(version);
        if (cardBuilder.notExist || cardBuilder.notInCardPool) continue;
        cards.push(cardBuilder.id(+id).done()!);
    }
    return cards;
}

export const newCard = (version?: Version) => (id: number) => allCards[id]?.().id(id).version(version).done() ?? NULL_CARD();

export const parseCard = (shareId: number, version?: Version) => cardsTotal(version).find(c => c.shareId == shareId) ?? NULL_CARD();
