import { Card, Cmds, GameInfo, Hero, MinuDiceSkill, Status, Summon, Trigger } from "../../typing"
import { ELEMENT_TYPE, ElementType, PureElementType, Version } from "../constant/enum.js"
import { getObjById } from "../utils/gameUtil.js"
import { isCdt } from "../utils/utils.js"
import { SkillBuilder } from "./builder/skillBuilder.js"
import { newStatus } from "./statuses.js"
import { newSummon } from "./summons.js"

export type SkillHandleEvent = {
    hero: Hero,
    skidx: number,
    reset?: boolean,
    card?: Card,
    heros?: Hero[],
    combatStatus?: Status[],
    eheros?: Hero[],
    hcards?: Card[],
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
    isTalent?: boolean,
    randomInArr?: <T>(arr: T[]) => T,
}

export type SkillHandleRes = {
    status?: Status[],
    statusOppo?: Status[],
    summon?: Summon[],
    trigger?: Trigger[],
    isAttach?: boolean,
    pdmg?: number,
    pdmgSelf?: number,
    addDmgCdt?: number,
    multiDmgCdt?: number,
    isQuickAction?: boolean,
    statusPre?: Status[],
    statusOppoPre?: Status[],
    summonPre?: Summon[],
    statusAfter?: Status[],
    statusOppoAfter?: Status[],
    cmds?: Cmds[],
    heal?: number,
    hidxs?: number[],
    dmgElement?: ElementType,
    atkOffset?: number,
    atkTo?: number,
    minusDiceSkill?: MinuDiceSkill,
    isNotAddTask?: boolean,
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

    12112: () => new SkillBuilder('孤心沙龙').description('【hro】当前处于｢始基力:荒性｣形态，召唤【smn112111】。；(【hro】处于｢始基力:芒性｣形态时，会改为召唤【smn112112】。)')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/629f7630db6af1831478699dbe6a04e0.png',
            'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/d605827c81562212ec685c75f8788b85_3866956682696340528.png')
        .elemental().cost(3).handle((event, ver) => {
            const { hero: { talentSlot }, card } = event;
            const isTalent = !!talentSlot || card?.id == 212111;
            return { summon: [newSummon(ver)(112111)], status: isCdt(isTalent, [newStatus(ver)(112116)]) }
        }),

    12122: () => new SkillBuilder('孤心沙龙').description('【hro】当前处于｢始基力:芒性｣形态，召唤【smn112112】。；(【hro】处于｢始基力:荒性｣形态时，会改为召唤【smn112111】。)')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/3a6b3aa64583eed30205cc6959de0b11.png')
        .elemental().cost(3).handle((event, ver) => {
            const { hero: { talentSlot }, card } = event;
            const isTalent = !!talentSlot || card?.id == 212111;
            return { summon: [newSummon(ver)(112112)], status: isCdt(isTalent, [newStatus(ver)(112116)]) }
        }),

    13095: () => new SkillBuilder('焚落踢').description('{dealDmg}。').burst().readySkill().damage(3),

    14054: () => new SkillBuilder('踏潮').description('{dealDmg}。').elemental().readySkill().damage(3).damage(2, 'v3.8.0'),

    15074: () => new SkillBuilder('风风轮舞踢').description('{dealDmg}(或被扩散元素的伤害)。').elemental().readySkill().damage(2),

    15075: () => ski1507x(ELEMENT_TYPE.Cryo),

    15076: () => ski1507x(ELEMENT_TYPE.Hydro),

    15077: () => ski1507x(ELEMENT_TYPE.Pyro),

    15078: () => ski1507x(ELEMENT_TYPE.Electro),

    16074: () => new SkillBuilder('长枪开相').description('{dealDmg}; 如果本回合中我方[舍弃]或[调和]过至少1张牌，则此伤害+1。')
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
        .elemental().readySkill().damage(2).handle((_, ver) => ({ status: [newStatus(ver)(124012)] })),

    24016: () => new SkillBuilder('猜拳三连击·布').description('{dealDmg}。').elemental().readySkill().damage(3),

    24044: () => new SkillBuilder('霆电迸发').description('{dealDmg}。').burst().readySkill().damage(2),

    25025: () => new SkillBuilder('长延涤流').description('对下一个敌方后台角色{dealDmg}，然后[准备技能]：【rsk25026】。(敌方没有后台角色时，改为对出战角色造成伤害)')
        .elemental().readySkill().damage(1).handle((_, ver) => ({ atkOffset: 1, status: [newStatus(ver)(125023)] })),

    25026: () => new SkillBuilder('终幕涤流').description('对上一个敌方后台角色{dealDmg}。(敌方没有后台角色时，改为对出战角色造成伤害)')
        .elemental().readySkill().damage(2).handle(() => ({ atkOffset: -1 })),

    66013: () => new SkillBuilder('霜刺破袭').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/ac22f83f25890eca87720581f6b06408.png')
        .elemental().damage(3).costCryo(3).handle((_, ver) => ({ status: [newStatus(ver)(126022)] })),

    66023: () => new SkillBuilder('洪流重斥').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/45a7f8c8f26f921fce5bb8738bf1bec0.png')
        .elemental().damage(3).costHydro(3).handle((_, ver) => ({ status: [newStatus(ver)(126022)] })),

    66033: () => new SkillBuilder('炽焰重斥').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/160f02ee2bfde3fcfdc558c78a168899.png')
        .elemental().damage(3).costPyro(3).handle((_, ver) => ({ status: [newStatus(ver)(126022)] })),

    66043: () => new SkillBuilder('霆雷破袭').description('{dealDmg}，此角色附属【sts126022】。')
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/466e63dcff914eaaa05c7710346033f1.png')
        .elemental().damage(3).costElectro(3).handle((_, ver) => ({ status: [newStatus(ver)(126022)] })),

}
export const newSkill = (version: Version) => (id: number) => skillTotal[id]().version(version).id(id).done();

