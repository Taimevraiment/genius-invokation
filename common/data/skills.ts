import { Card, Cmds, GameInfo, Hero, MinuDiceSkill, Status, Summon, Trigger } from "../../typing"
import { ELEMENT_TYPE, ElementType, PureElementType, Version } from "../constant/enum.js"
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
    statusOppoPre?: Status[],
    statusPre?: Status[],
    summonPre?: Summon[],
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
    return new SkillBuilder('风风轮舞踢').description('(需准备1个行动轮)；{dealDmg}。').elemental().readySkill().damage(2).dmgElement(swirlEl);
}

export const skillTotal: Record<number, () => SkillBuilder> = {
    12074: () => new SkillBuilder('苍鹭震击').description('(需准备1个行动轮)；{dealDmg}。').elemental().readySkill().damage(3),

    12104: () => new SkillBuilder('衡平推裁').description('(需准备1个行动轮)；{dealDmg}，如果生命值至少为6，则对自身造成1点[穿透伤害]，使伤害+1。')
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

    13095: () => new SkillBuilder('焚落踢').description('(需准备1个行动轮)；{dealDmg}。').burst().readySkill().damage(3),

    14054: () => new SkillBuilder('踏潮').description('(需准备1个行动轮)；{dealDmg}。').elemental().readySkill().damage(3).damage(2, 'v3.8.0'),

    15074: () => new SkillBuilder('风风轮舞踢').description('(需准备1个行动轮)；{dealDmg}(或被扩散元素的伤害)。').elemental().readySkill().damage(2),

    15075: () => ski1507x(ELEMENT_TYPE.Cryo),

    15076: () => ski1507x(ELEMENT_TYPE.Hydro),

    15077: () => ski1507x(ELEMENT_TYPE.Pyro),

    15078: () => ski1507x(ELEMENT_TYPE.Electro),

    16074: () => new SkillBuilder('长枪开相').description('(需准备1个行动轮)；{dealDmg}; 如果本回合中我方[舍弃]或[调和]过至少1张牌，则此伤害+1。')
        .elemental().readySkill().damage(2).handle(event => {
            const { playerInfo: { discardCnt = 0, reconcileCnt = 0 } = {} } = event;
            return { addDmgCdt: isCdt(discardCnt + reconcileCnt > 0, 1) }
        }),

    // 2: () => new GISkill('猜拳三连击·剪刀', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]，然后[准备技能]：【rsk3】。', 2, 2, 0, 3, { id: 24015, ec: -2, rskid: 2 }),

    // 3: () => new GISkill('猜拳三连击·布', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]。', 2, 3, 0, 3, { ec: -2, rskid: 3 }),

    // 6: () => new GISkill('长延涤流', '(需准备1个行动轮)；对下一个敌方后台角色造成{dmg}点[风元素伤害]，然后[准备技能]：【rsk7】。(敌方没有后台角色时，改为对出战角色造成伤害)',
    //     2, 1, 0, 5, { ec: -2, rskid: 6 }, '', () => ({ atkOffset: 1 })),

    // 7: () => new GISkill('终幕涤流', '(需准备1个行动轮)；对上一个敌方后台角色造成{dmg}点[风元素伤害]。(敌方没有后台角色时，改为对出战角色造成伤害)',
    //     2, 2, 0, 5, { ec: -2, rskid: 7 }, '', () => ({ atkOffset: -1 })),

    // 8: ver => new GISkill('洪流重斥', '造成{dmg}点[水元素伤害]，此角色附属【sts2145】。', 2, 3, 3, 1, { rskid: 8 },
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/45a7f8c8f26f921fce5bb8738bf1bec0.png',
    //     () => ({ status: [newStatus(ver)(2145)] })),

    // 9: ver => new GISkill('炽焰重斥', '造成{dmg}点[火元素伤害]，此角色附属【sts2145】。', 2, 3, 3, 2, { rskid: 9 },
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/160f02ee2bfde3fcfdc558c78a168899.png',
    //     () => ({ status: [newStatus(ver)(2145)] })),

    // 10: ver => new GISkill('霆雷破袭', '造成{dmg}点[雷元素伤害]，此角色附属【sts2145】。', 2, 3, 3, 3, { rskid: 10 },
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/466e63dcff914eaaa05c7710346033f1.png',
    //     () => ({ status: [newStatus(ver)(2145)] })),

    // 11: ver => new GISkill('霜刺破袭', '造成{dmg}点[冰元素伤害]，此角色附属【sts2145】。', 2, 3, 3, 4, { rskid: 11 },
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/ac22f83f25890eca87720581f6b06408.png',
    //     () => ({ status: [newStatus(ver)(2145)] })),

    // 18: () => new GISkill('霆电迸发', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]。', 3, 2, 0, 3, { ec: -2, rskid: 18 }),

    // 19: () => new GISkill('涟锋旋刃', '(需准备1个行动轮)；造成{dmg}点[水元素伤害]。', 2, 1, 0, 1, { ec: -2, rskid: 19 }),

    // 20: () => new GISkill('炽烈轰破', '(需准备1个行动轮)；造成{dmg}点[火元素伤害]，对敌方所有后台角色造成2点[穿透伤害]。本角色每附属有2层【sts2182】，就使此技能造成的[火元素伤害]+1。',
    //     3, 1, 0, 2, { ec: -2, rskid: 20 }, '', event => {
    //         const { hero: { heroStatus } } = event;
    //         return { pdmg: 2, addDmgCdt: Math.floor((heroStatus.find(ist => ist.id == 2182)?.useCnt ?? 0) / 2) }
    //     }),

}
export const newSkill = (version: Version) => (id: number) => skillTotal[id]().version(version).id(id).done();

