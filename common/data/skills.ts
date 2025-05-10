import { Card, GameInfo, Hero, MinusDiceSkill, Skill, Status, Summon, Trigger } from "../../typing"
import { CARD_SUBTYPE, CardSubtype, CMD_MODE, ELEMENT_TYPE, ElementType, PureElementType, Version } from "../constant/enum.js"
import CmdsGenerator from "../utils/cmdsGenerator.js"
import { allHidxs, getNextBackHidx, getObjById, hasObjById } from "../utils/gameUtil.js"
import { isCdt } from "../utils/utils.js"
import { SkillBuilder } from "./builder/skillBuilder.js"

export type SkillHandleEvent = {
    hero: Hero,
    skill: Skill,
    reset?: boolean,
    card?: Card,
    heros?: Hero[],
    combatStatus?: Status[],
    eheros?: Hero[],
    hcards?: Card[],
    ehcards?: Card[],
    summons?: Summon[],
    isChargedAtk?: boolean,
    isFallAtk?: boolean,
    isReadySkill?: boolean,
    isExec?: boolean,
    getdmg?: number[],
    swirlEl?: PureElementType,
    trigger?: Trigger,
    minusDiceSkill?: number[][],
    heal?: number[],
    playerInfo?: GameInfo,
    discards?: Card[],
    dmg?: number[],
    talent?: Card | null,
    pile?: Card[],
    isExecTask?: boolean,
    source?: number,
    sourceHidx?: number,
    selectHero?: number,
    restDmg?: number,
    randomInArr?: <T>(arr: T[], cnt?: number) => T[],
    getCardIds?: (filter?: (card: Card) => boolean) => number[],
}

export type SkillHandleRes = {
    status?: (number | [number, ...any])[] | number,
    statusOppo?: (number | [number, ...any])[] | number,
    equip?: number,
    summon?: (number | [number, ...any])[] | number,
    triggers?: Trigger[],
    isAttach?: boolean,
    isAttachOppo?: boolean,
    pdmg?: number,
    pdmgSelf?: number,
    addDmgCdt?: number,
    multiDmgCdt?: number,
    isQuickAction?: boolean,
    statusPre?: (number | [number, ...any] | Status)[] | number,
    statusOppoPre?: (number | [number, ...any] | Status)[] | number,
    summonPre?: (number | [number, ...any] | Summon)[] | number,
    statusAfter?: (number | [number, ...any | Status])[] | number,
    statusOppoAfter?: (number | [number, ...any] | Status)[] | number,
    cmds?: CmdsGenerator,
    skillAfter?: CmdsGenerator,
    skillBefore?: CmdsGenerator,
    heal?: number,
    hidxs?: number[],
    dmgElement?: ElementType,
    atkOffset?: number,
    atkTo?: number,
    minusDiceSkill?: MinusDiceSkill,
    isNotAddTask?: boolean,
    summonTriggers?: Trigger[],
    isForbidden?: boolean,
    energy?: number,
    restDmg?: number,
    pickCard?: {
        cnt: number,
        card?: number[],
        subtype?: CardSubtype[],
        mode: number,
        isOrdered?: boolean,
    },
    isTrigger?: boolean,
    exec?: () => void,
}

const ski1507x = (swirlEl: PureElementType) => {
    return new SkillBuilder('风风轮舞踢').description('{dealDmg}。').elemental().readySkill().damage(2).dmgElement(swirlEl);
}

export const skillTotal: Record<number, () => SkillBuilder> = {
    12074: () => new SkillBuilder('苍鹭震击').description('{dealDmg}。').elemental().readySkill().damage(3),

    12104: () => new SkillBuilder('衡平推裁').description('{dealDmg}，如果生命值至少为6，则对自身造成1点[穿透伤害]，使伤害+1。')
        .normal().readySkill().damage(2).handle(event => {
            const { hero: { hp } } = event;
            if (hp >= 6) return { addDmgCdt: 1, pdmgSelf: 1 }
        }),

    12112: () => new SkillBuilder('孤心沙龙').description('【hro】当前处于「始基力:荒性」形态，召唤【smn112111】。；（【hro】处于「始基力:芒性」形态时，会改为召唤【smn112112】。）')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/629f7630db6af1831478699dbe6a04e0.png',
            'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/d605827c81562212ec685c75f8788b85_3866956682696340528.png')
        .elemental().cost(3).handle(event => ({ summon: 112111, status: isCdt(!!event.talent, 112116) })),

    12122: () => new SkillBuilder('孤心沙龙').description('【hro1211】当前处于「始基力:芒性」形态，召唤【smn112112】。；（【hro】处于「始基力:荒性」形态时，会改为召唤【smn112111】。）')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/3a6b3aa64583eed30205cc6959de0b11.png')
        .elemental().cost(3).handle(event => ({ summon: 112112, status: isCdt(!!event.talent, 112116) })),

    12135: () => new SkillBuilder('满满心意药剂冲击').description('{dealDmg}。').burst().readySkill().damage(2),

    13095: () => new SkillBuilder('焚落踢').description('{dealDmg}。').burst().readySkill().damage(3),

    13155: () => new SkillBuilder('驰轮车·疾驰').description('【行动阶段开始时：】获得2个[万能元素骰]。')
        .elemental().readySkill().handle(() => ({ status: 113158 })),

    14054: () => new SkillBuilder('踏潮').description('{dealDmg}。')
        .elemental().readySkill().damage(3).damage(2, 'v3.8.0').handle(event => {
            if (event.talent) return { status: 114052 }
        }),

    15074: () => new SkillBuilder('风风轮舞踢').description('{dealDmg}（或被扩散元素的伤害）。').elemental().readySkill().damage(2),

    15075: () => ski1507x(ELEMENT_TYPE.Cryo),

    15076: () => ski1507x(ELEMENT_TYPE.Hydro),

    15077: () => ski1507x(ELEMENT_TYPE.Pyro),

    15078: () => ski1507x(ELEMENT_TYPE.Electro),

    16074: () => new SkillBuilder('长枪开相').description('{dealDmg}\\；如果本回合中我方[舍弃]或[调和]过至少1张牌，则此伤害+1。')
        .elemental().readySkill().damage(2).handle(event => {
            const { playerInfo: { discardCnt = 0, reconcileCnt = 0 } = {} } = event;
            return { addDmgCdt: isCdt(discardCnt + reconcileCnt > 0, 1) }
        }),

    22035: () => new SkillBuilder('涟锋旋刃').description('{dealDmg}。').elemental().readySkill().damage(1),

    23046: () => new SkillBuilder('炽烈轰破').description('{dealDmg}，对敌方所有后台角色造成2点[穿透伤害]。本角色每附属有2层【sts123041】，就使此技能造成的[火元素伤害]+1。')
        .burst().readySkill().damage(1).handle(event => {
            const { hero: { heroStatus } } = event;
            return { pdmg: 2, addDmgCdt: Math.floor((getObjById(heroStatus, 123041)?.useCnt ?? 0) / 2) }
        }),

    24015: () => new SkillBuilder('猜拳三连击·剪刀').description('{dealDmg}，然后[准备技能]：【rsk24016】。')
        .elemental().readySkill().damage(2).handle(() => ({ status: 124012 })),

    24016: () => new SkillBuilder('猜拳三连击·布').description('{dealDmg}。').elemental().readySkill().damage(3),

    24044: () => new SkillBuilder('霆电迸发').description('{dealDmg}。').burst().readySkill().damage(2),

    25025: () => new SkillBuilder('长延涤流').description('对下一个敌方后台角色{dealDmg}，然后[准备技能]：【rsk25026】。（敌方没有后台角色时，改为对出战角色造成伤害）')
        .elemental().readySkill().damage(1).handle(() => ({ atkOffset: 1, status: 125023 })),

    25026: () => new SkillBuilder('终幕涤流').description('对上一个敌方后台角色{dealDmg}。（敌方没有后台角色时，改为对出战角色造成伤害）')
        .elemental().readySkill().damage(2).handle(() => ({ atkOffset: -1 })),

    66013: () => new SkillBuilder('霜刺破袭').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/ac22f83f25890eca87720581f6b06408.png')
        .elemental().damage(3).costCryo(3).handle(() => ({ status: 126022 })),

    66023: () => new SkillBuilder('洪流重斥').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/45a7f8c8f26f921fce5bb8738bf1bec0.png')
        .elemental().damage(3).costHydro(3).handle(() => ({ status: 126022 })),

    66033: () => new SkillBuilder('炽焰重斥').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/160f02ee2bfde3fcfdc558c78a168899.png')
        .elemental().damage(3).costPyro(3).handle(() => ({ status: 126022 })),

    66043: () => new SkillBuilder('霆雷破袭').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/466e63dcff914eaaa05c7710346033f1.png')
        .elemental().damage(3).costElectro(3).handle(() => ({ status: 126022 })),

    1121422: () => new SkillBuilder('鲨鲨冲浪板').description('切换到上一个我方角色，使敌方出战角色附属1层【sts112143】。（若我方后台角色均被击倒，则额外消耗1点「夜魂值」）')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/5df64b9953797e1c33fe8345f84618b9_1679708139843446825.png')
        .vehicle().cost(1).handle(({ heros, cmds, skillAfter }) => {
            cmds.switchBefore();
            if (allHidxs(heros).length == 1) skillAfter.consumeNightSoul();
            return { statusOppo: 112143 }
        }),

    1131541: () => new SkillBuilder('跃升').description('消耗1点「夜魂值」，{dealDmg}。')
        .src('/image/tmp/Skill_Vehicle_Mavuika2_-899064990.png')
        .vehicle().damage(4).costAny(1),

    1131551: () => new SkillBuilder('涉渡').description('我方切换到下一个角色，将1个元素骰转换为[万能元素骰]。（此技能释放后，我方可继续行动）')
        .src('/image/tmp/Skill_Vehicle_Mavuika3_789405650.png')
        .vehicle().costSame(0).handle(({ cmds }) => (cmds.switchAfter().changeDice({ cnt: 1 }), { isQuickAction: true })),

    1131561: () => new SkillBuilder('疾驰').description('消耗1点「夜魂值」，然后[准备技能]：【rsk13155】。')
        .src('/image/tmp/Skill_Vehicle_Mavuika1_2075538931.png')
        .vehicle().costAny(2).handle(({ skillAfter, hero: { hidx } }) => skillAfter.consumeNightSoul(hidx).getStatus(113157).res),

    1151021: () => new SkillBuilder('仙力助推').description('治疗所附属角色2点，并使其下次「普通攻击」视为[下落攻击]，伤害+1，并且技能结算后造成1点[风元素伤害]。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/5a01bcb1b784636d628ab0397e1cd3a5_6599178806120748311.png')
        .vehicle().costSame(1).handle(() => ({ heal: 2, statusPre: 115103 })),

    1151121: () => new SkillBuilder('多重瞄准').description('消耗1点「夜魂值」，随机[舍弃]3张原本元素骰费用最高的手牌，然后{dealDmg}。')
        .src('/image/tmp/Skill_Vehicle_Chasca_-159040159.png')
        .vehicle().damage(1).cost(2).handle(({ skillAfter, hero: { hidx } }) => {
            skillAfter.consumeNightSoul(hidx).discard({ cnt: 3, mode: CMD_MODE.HighHandCard });
        }),

    1161021: () => new SkillBuilder('转转冲击').description('附属角色消耗1点「夜魂值」，{dealDmg}，对敌方下一个后台角色造成1点[穿透伤害]。')
        .src('#')
        .vehicle().damage(2).costAny(1).handle(event => {
            const { eheros, combatStatus, hero: { hidx }, skillAfter } = event;
            const hidxs = getNextBackHidx(eheros);
            skillAfter.consumeNightSoul(hidx);
            if (hidxs.length == 0) return;
            return { pdmg: hasObjById(combatStatus, 116101) ? 2 : 1, hidxs }
        }),

    1161121: () => new SkillBuilder('高速腾跃').description('附属角色消耗1点「夜魂值」，抓3张牌。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2025/05/06/258999284/6e198a5ebf0245a681cbb894919886d1_5120040167043277378.png')
        .vehicle().costAny(2).handle(({ skillAfter, hero: { hidx } }) => skillAfter.consumeNightSoul(hidx).getCard(3).res),

    1220511: () => new SkillBuilder('水泡战法').description('（需准备1个行动轮）造成1点[水元素伤害]，敌方出战角色附属【sts122052】。')
        .src('#')
        .vehicle().costSame(1).handle(() => ({ status: 122053 })),

    1220512: () => new SkillBuilder('水泡封锁').description('{dealDmg}，敌方出战角色附属【sts122052】。')
        .vehicle().readySkill().damage(1).handle(() => ({ statusOppo: 122052 })),

    1230311: () => new SkillBuilder('炙烧攻势').description('{dealDmg}。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/91a1aeec8fb8ae9e5eaaf64a839dabcb_6571191726509456077.png')
        .vehicle().damage(2).costSame(2),

    1270321: () => new SkillBuilder('藤蔓锋鳞').description('{dealDmg}。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/1ff71b6c76cb900018bd9f98b8c7add7_7309401796826933036.png')
        .vehicle().damage(1).costAny(1).energy(1),

    3130011: () => new SkillBuilder('原海水刃').description('{dealDmg}。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/5f3971c1d0665eb3d72f68415c3da8ae_6268200576026280012.png')
        .vehicle().damage(2).costAny(2),

    3130021: () => new SkillBuilder('钩物巧技').description('{dealDmg}，窃取1张原本元素骰费用最高的对方手牌，然后对手抓1张牌。；如果我方手牌数不多于2，此特技少花费1个元素骰。')
        .description('{dealDmg}，窃取1张原本元素骰费用最高的对方手牌。；如果我方手牌数不多于2，此特技少花费1个元素骰。', 'v5.4.0')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/47028d693a802faabc73d11039645385_3536480308383070177.png')
        .vehicle().damage(1).costSame(2).handle((event, ver) => {
            const { hcards = [], cmds } = event;
            cmds.stealCard(1, CMD_MODE.HighHandCard);
            if (ver.gte('v5.4.0')) cmds.getCard(1, { isOppo: true });
            return { minusDiceSkill: isCdt(hcards.length <= 2, { skilltype5: [0, 0, 1] }) }
        }),

    3130031: () => new SkillBuilder('游隙灵道').description('选择一个我方「召唤物」，立刻触发其「结束阶段」效果。（每回合最多使用1次）')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/8a8518fd7fb8b5be6968d77a1d34f2ac_127972242004343862.png')
        .vehicle().costSame(1).canSelectSummon(1).perCnt(1).handle(event => ({
            summonTriggers: 'phase-end',
            isForbidden: event.skill.perCnt == 0,
            exec: () => { --event.skill.perCnt },
        })),

    3130041: () => new SkillBuilder('掘进突击').description('抓2张牌。然后，如果手牌中存在名称不存在于本局最初牌组中的牌，则提供2点[护盾]保护所附属角色。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/04/258999284/e9339d30ff4a5642b32bc1208063a08c_2715679545278748017.png')
        .vehicle().costAny(2).handle(event => {
            const { hcards = [], playerInfo: { initCardIds = [] } = {}, pile = [], cmds } = event;
            cmds.getCard(2);
            if ([...hcards, ...pile.slice(0, 2)].some(c => !initCardIds.includes(c.id))) {
                cmds.getStatus(301301);
            }
        }),

    3130051: () => new SkillBuilder('灵性援护').description('从「场地」「道具」「料理」中[挑选]1张加入手牌，并且治疗附属角色1点。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/80e0cad80855e14a1efebb4b6ba2cd67_801740963269596598.png')
        .vehicle().costSame(1).handle(() => ({
            pickCard: {
                cnt: 3,
                mode: CMD_MODE.GetCard,
                subtype: [CARD_SUBTYPE.Place, CARD_SUBTYPE.Item, CARD_SUBTYPE.Food],
                isOrdered: true,
            },
            heal: 1,
        })),

    3130063: () => new SkillBuilder('迅疾滑翔').description('切换到下一名角色，敌方出战角色附属【sts301302】。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/796ae18833e4f5507dfb6b187bd47f50_8652305763536855055.png')
        .vehicle().costSame(1).handle(({ cmds }) => (cmds.switchAfter(), { statusOppo: 301302 })),

    3130071: () => new SkillBuilder('浪船·迅击炮').description('{dealDmg}。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2025/03/22/258999284/d51ae51bce40330458cea198b5dba91d_9095998201034503166.png')
        .vehicle().damage(2).costSame(1),

    3130081: () => new SkillBuilder('昂扬状态').description('附属角色[准备技能]2次「普通攻击」。')
        .src('#', 'https://act-upload.mihoyo.com/wiki-user-upload/2025/05/06/258999284/75019ddf20d1485e844ad7c5e3106e0f_5220421915413934082.png')
        .vehicle().costAny(3).handle(() => ({ status: 301303 })),

    3130092: () => new SkillBuilder('呀！呀！').description('从牌库中抓一张【特技牌】，下次我方打出【特技牌】少花费2个元素骰。')
        .src('/image/tmp/Skill_GCG_SaurusBaby_345786978.png')
        .vehicle().costAny(2).handle(({ cmds }) => cmds.getCard(1, { subtype: CARD_SUBTYPE.Vehicle, isFromPile: true }).getStatus(301308).res),

}
export const newSkill = (version: Version) => (id: number) => skillTotal[id]().version(version).id(id).done();

