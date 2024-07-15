import { Card, Cmds, GameInfo, Hero, MinuDiceSkill, Skill, Status, Summon, Trigger } from '../../typing';
import {
    ElementType,
    PureElementType,
    VERSION, Version
} from '../constant/enum.js';
import { NULL_HERO } from '../constant/init.js';
import { HeroBuilder } from './builder/HeroBuilder.js';
import { Skill1Builder, SkillBuilder } from './builder/SkillBuilder';
import { newStatus } from './statuses.js';
import { newSummon } from './summons.js';

export type SkillHandleEvent = {
    hero: Hero,
    skidx: number,
    reset?: boolean,
    card?: Card,
    heros?: Hero[],
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
    inStatusOppoPre?: Status[],
    outStatusOppoPre?: Status[],
    inStatusPre?: Status[],
    outStatusPre?: Status[],
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

// 11xx：冰
// 12xx：水
// 13xx：火
// 14xx：雷
// 15xx：风
// 16xx：岩
// 17xx：草
// 2xxx：原魔
// 6xxx：变换形态

const readySkillTotal: Record<number, (ver: Version) => Skill> = {
    // 1: () => new GISkill('踏潮', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]。', 2, 3, 0, 3, { id: 14054, ec: -2, rskid: 1 }),

    // 2: () => new GISkill('猜拳三连击·剪刀', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]，然后[准备技能]：【rsk3】。', 2, 2, 0, 3, { id: 24015, ec: -2, rskid: 2 }),

    // 3: () => new GISkill('猜拳三连击·布', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]。', 2, 3, 0, 3, { ec: -2, rskid: 3 }),

    // 4: () => new GISkill('苍鹭震击', '(需准备1个行动轮)；造成{dmg}点[水元素伤害]。', 2, 3, 0, 1, { ec: -2, rskid: 4 }),

    // 5: () => new GISkill('焚落踢', '(需准备1个行动轮)；造成{dmg}点[火元素伤害]。', 3, 3, 0, 2, { ec: -2, rskid: 5 }),

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

    // 12: () => new GISkill('风风轮舞踢', '(需准备1个行动轮)；造成{dmg}点[风元素伤害](或被扩散元素的伤害)。', 2, 2, 0, 5, { ec: -2, rskid: 12 }),

    // 13: () => new GISkill('风风轮舞踢', '(需准备1个行动轮)；造成{dmg}点[水元素伤害]。', 2, 2, 0, 1, { ec: -2, rskid: 13 }),

    // 14: () => new GISkill('风风轮舞踢', '(需准备1个行动轮)；造成{dmg}点[火元素伤害]。', 2, 2, 0, 2, { ec: -2, rskid: 14 }),

    // 15: () => new GISkill('风风轮舞踢', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]。', 2, 2, 0, 3, { ec: -2, rskid: 15 }),

    // 16: () => new GISkill('风风轮舞踢', '(需准备1个行动轮)；造成{dmg}点[冰元素伤害]。', 2, 2, 0, 4, { ec: -2, rskid: 16 }),

    // 17: () => new GISkill('衡平推裁', '(需准备1个行动轮)；造成{dmg}点[水元素伤害]，如果生命值至少为6，则对自身造成1点[穿透伤害]，使伤害+1。',
    //     1, 2, 0, 1, { ec: -2, rskid: 17 }, '', event => {
    //         const { hero: { hp } } = event;
    //         if (hp >= 6) return { addDmgCdt: 1, pdmgSelf: 1 }
    //     }),

    // 18: () => new GISkill('霆电迸发', '(需准备1个行动轮)；造成{dmg}点[雷元素伤害]。', 3, 2, 0, 3, { ec: -2, rskid: 18 }),

    // 19: () => new GISkill('涟锋旋刃', '(需准备1个行动轮)；造成{dmg}点[水元素伤害]。', 2, 1, 0, 1, { ec: -2, rskid: 19 }),

    // 20: () => new GISkill('炽烈轰破', '(需准备1个行动轮)；造成{dmg}点[火元素伤害]，对敌方所有后台角色造成2点[穿透伤害]。本角色每附属有2层【sts2182】，就使此技能造成的[火元素伤害]+1。',
    //     3, 1, 0, 2, { ec: -2, rskid: 20 }, '', event => {
    //         const { hero: { heroStatus } } = event;
    //         return { pdmg: 2, addDmgCdt: Math.floor((heroStatus.find(ist => ist.id == 2182)?.useCnt ?? 0) / 2) }
    //     }),

    // 21: () => new GISkill('长枪开相', '(需准备1个行动轮)；造成{dmg}点[岩元素伤害]; 如果本回合中我方[舍弃]或[调和]过至少1张牌，则此伤害+1。',
    //     2, 2, 0, 6, { ec: -2, rskid: 21 }, '', event => {
    //         const { playerInfo: { discardCnt = 0, reconcileCnt = 0 } = {} } = event;
    //         return { addDmgCdt: isCdt(discardCnt + reconcileCnt > 0, 1) }
    //     }),

    // 22: ver => new GISkill('孤心沙龙', '【芙宁娜】当前处于｢始基力:荒性｣形态，召唤【smn3060】。；(【芙宁娜】处于｢始基力:芒性｣形态时，会改为召唤【smn3061】。)', 2, 0, 3, 1, { rskid: 22 }, [
    //     'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/629f7630db6af1831478699dbe6a04e0.png',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/d605827c81562212ec685c75f8788b85_3866956682696340528.png',
    // ], event => {
    //     const { hero: { talentSlot }, card } = event;
    //     const isTalent = !!talentSlot || card?.id == 785;
    //     return { summon: [newSummon(ver)(3060)], status: isCdt(isTalent, [newStatus(ver)(2196)],) }
    // }),

    // 23: ver => new GISkill('孤心沙龙', '【芙宁娜】当前处于｢始基力:芒性｣形态，召唤【smn3061】。；(【芙宁娜】处于｢始基力:荒性｣形态时，会改为召唤【smn3060】。)', 2, 0, 3, 1, { rskid: 23 },
    //     'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/3a6b3aa64583eed30205cc6959de0b11.png',
    //     event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 785;
    //         return { summon: [newSummon(ver)(3061)], status: isCdt(isTalent, [newStatus(ver)(2196)],) }
    //     }),
}

export const readySkill = (rskid: number, version: Version) => readySkillTotal[rskid](version);

const allHeros: Record<number, () => HeroBuilder> = {
    // 1000: () => new GIHero(1000, '无', 'v0.0.0', [], 0, 0, 0, ''),

    1101: () => new HeroBuilder(1101, 1).name('甘雨').liyue().cryo().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/195563531/e5c7d702f8033c4361f3b25a7f0b8b30_7432225060782505988.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u63dbg/a8c456eaabf9469d200b01e0a2f49bdd.png')
        .skill1(new Skill1Builder('流天射术'))
        .skills(
            new SkillBuilder('山泽麟迹').description('{dealDmg}，生成【sts111012】。')
                .src('https://patchwiki.biligame.com/images/ys/f/f8/0pge9o51iepqfdd3n8zu9uxfmo08t4u.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/12109492/6e5de97b92327dc32895d68abb2f74ea_9018514544637920379.png')
                .elemental().damage(1).cost(3).handle((_, ver) => ({ status: [newStatus(ver)(111012)] })),
            new SkillBuilder('霜华矢').description('{dealDmg}，对所有敌方后台角色造成2点[穿透伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/d/de/d7vartodjuo8s7k0fkp6qsl09brzcvy.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/a4c1f60fc2461f2853edb4e765ba4262_6013693059397455292.png')
                .normal().damage(2).cost(5).handle(event => {
                    const { hero: { skills, talentSlot }, card } = event;
                    const isTalent = skills[2].useCnt && (!!talentSlot || card?.id == 211011);
                    return { pdmg: isTalent ? 3 : 2 }
                }),
            new SkillBuilder('降众天华').description('{dealDmg}，对所有敌方后台角色造成1点[穿透伤害]，召唤【smn111011】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fc/jwj2u3ksefltv5hz9y5zjz3p1p7f8n7.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/12109492/c6917b506b4c303677c6246ee11049f3_937074104802749278.png')
                .burst(3).burst(2, 'v3.7.0').damage(2).damage(1, 'v3.7.0').cost(3)
                .handle((_, ver) => ({ summon: [newSummon(ver)(111011)], pdmg: 1 }))
        ),

    1102: () => new HeroBuilder(1102, 2).name('迪奥娜').mondstadt().cryo().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/708ced07857094dd94314d65c9723360_8516852131632705389.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u63dbg/77a8563fd5083b309c14e2e89fd302d1.png')
        .skill1(new Skill1Builder('猎人射术'))
        .skills(
            new SkillBuilder('猫爪冻冻').description('{dealDmg}，生成【sts111021】。')
                .src('https://patchwiki.biligame.com/images/ys/1/1e/293bqkk7gcer933p14viqh445sdwqzf.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/195563531/fc7cc8ae1d95bc094e69b8f3c1c270f8_1908586115904037757.png')
                .elemental().damage(2).cost(3).handle((event, ver) => {
                    const { hero: { talentSlot }, card } = event;
                    const isTalent = !!talentSlot || card?.id == 211021;
                    return { status: [newStatus(ver)(111021, isTalent)] };
                }),
            new SkillBuilder('最烈特调').description('{dealDmg}，治疗此角色2点，召唤【smn111023】。')
                .src('https://patchwiki.biligame.com/images/ys/3/3a/gltxegl17e1mwhv3z3xdakycst8h5sg.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/195563531/d749ae8a4ce1c2693106ef4a39430ff7_1792825158969730188.png')
                .burst(3).damage(1).cost(3).handle((_, ver) => ({ summon: [newSummon(ver)(111023)], heal: 2 }))
        ),

    1103: () => new HeroBuilder(1103, 3).name('凯亚').mondstadt().cryo().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/161007a1aef385a3e9f4566702afef0b_7807393116480739426.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/4c4e0c95e68c8272388f781f38e2f410.png')
        .skill1(new Skill1Builder('仪典剑术'))
        .skills(
            new SkillBuilder('霜袭').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/f/f6/bsd6rp5bwuwttd0pyo0ysn1dn39nesz.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/dbbef9e9d85229f503075f7b4ec5595a_1136270246875604440.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('凛冽轮舞').description('{dealDmg}，生成【sts111031】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b0/ozcnrn13ft9p6pe7tsamhik8lnp1dbk.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/250999f269669660e4fd24bdf510a507_2074342926999471449.png')
                .burst(2).damage(1).cost(4).handle((_, ver) => ({ status: [newStatus(ver)(111031)] }))
        ),

    // 1104: ver => new GIHero(1104, 4, '重云', 'v3.3.0', HERO_LOCAL.Liyue, 10, ELEMENT_TYPE.Cryo, WEAPON_TYPE.Claymore,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/5192016de21d9f10eb851387bdf2ef39_3201745536478119133.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/c369d7851e6a8bf25acf7c515fb62b10.png',
    //     skill1('灭邪四式'), [
    //     new GISkill('重华叠霜', '{dealDmg}，生成【sts111041】。',
    //         SKILL_TYPE.Elemental, 3, 3, DICE_TYPE.Cryo, {}, [
    //         'https://patchwiki.biligame.com/images/ys/9/95/l37dvsmjc6w2vpeue8xlpasuxwvdqga.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/90fe50a43ea7905773df4433d385e4d9_8501818730448316824.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 211041;
    //         return { status: [newStatus(ver)(111041, isTalent)] }
    //     }),
    //     new GISkill('云开星落', '{dealDmg}。',
    //         SKILL_TYPE.Burst, 7, 3, DICE_TYPE.Cryo, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/0/01/5vyck7f9rpns92tfop3r41xr1aats4u.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/0bddb45b9d91fb892ddaf2e8eb1e04a8_1565971516954358022.png'])
    // ]),

    // 1105: ver => new GIHero(1105, 5, '神里绫华', 'v3.3.0', HERO_LOCAL.Inazuma, 10, ELEMENT_TYPE.Cryo, WEAPON_TYPE.Sword,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/755cad41d2f5d2cc97e7917ab53abd6a_8806486016418846297.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/ede96c5aba784f50bc86dc66e5b16b12.png',
    //     skill1('神里流·倾'), [
    //     new GISkill('神里流·冰华', '{dealDmg}。',
    //         SKILL_TYPE.Elemental, 3, 3, DICE_TYPE.Cryo, {}, [
    //         'https://patchwiki.biligame.com/images/ys/2/2b/loq6n32a0wpbs8cu4vji5iiyr5pxsui.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/da5da3bfc8c50c570b12b5410d0366d5_4795744347782351925.png']),
    //     new GISkill('神里流·霜灭', '{dealDmg}，召唤【smn111051】。',
    //         SKILL_TYPE.Burst, 4, 3, DICE_TYPE.Cryo, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/5/58/mcbp6hjwbi9pi7ux0cag1qrhtcod2oi.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/e590d8ed5ffda912275916a7885793e2_4175761153899718840.png',
    //     ], () => ({ summon: [newSummon(ver)(111051)] })),
    //     new GISkill('神里流·霰步', '此角色被切换为｢出战角色｣时，附属【sts111052】。',
    //         SKILL_TYPE.Passive, 0, 0, DICE_TYPE.Same, {}, [
    //         'https://patchwiki.biligame.com/images/ys/b/bf/35ci2ri2f4j1n844qgcfu6mltipvy6o.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/0e41ec30bd552ebdca2caf26a53ff3c4_7388012937739952914.png',
    //     ], event => {
    //         const { hero: { talentSlot } } = event;
    //         return {
    //             trigger: ['change-to'],
    //             status: [newStatus(ver)(111052, 1, +!!talentSlot)],
    //         }
    //     })
    // ]),

    // 1106: ver => new GIHero(1106, 6, '优菈', 'v3.5.0', HERO_LOCAL.Mondstadt, 10, ELEMENT_TYPE.Cryo, WEAPON_TYPE.Claymore,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/4e77b64507209b6abb78b60b9f207c29_5483057583233196198.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/a3a5645e234da6457e28033a7418f63a.png',
    //     skill1('西风剑术·宗室'), [
    //     new GISkill('冰潮的涡旋', '{dealDmg}，如果角色未附属【sts111061】，则使其附属【sts111061】。',
    //         SKILL_TYPE.Elemental, 2, 3, DICE_TYPE.Cryo, {}, [
    //         'https://patchwiki.biligame.com/images/ys/8/8a/q921jjp73rov2uov6hzuhh1ncxzluew.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/7cd81d9357655d9c620f961bb8d80b59_6750120717511006729.png',
    //     ], event => {
    //         const { hero: { heroStatus } } = event;
    //         return { status: isCdt(!hasStatus(heroStatus, 111061), [newStatus(ver)(111061)]) }
    //     }),
    //     new GISkill('凝浪之光剑', '{dealDmg}，召唤【smn111062】。',
    //         SKILL_TYPE.Burst, 2, 3, DICE_TYPE.Cryo, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/a/aa/1qme7ho5ktg0yglv8mv7a2xf0i7w6fu.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/c17312b62a4b4cf7a5d3cfe0cccceb9c_3754080379232773644.png',
    //     ], () => ({ summon: [newSummon(ver)(111062)] }))
    // ]),

    // 1107: ver => new GIHero(1107, 7, '申鹤', 'v3.7.0', HERO_LOCAL.Liyue, 10, ELEMENT_TYPE.Cryo, WEAPON_TYPE.Polearm,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/40d8984c2bd2fda810f0170394ac2729_1971286688556670312.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/6d96a0d3974c54a772259e72f9335ee4.png',
    //     skill1('踏辰摄斗'), [
    //     new GISkill('仰灵威召将役咒', '{dealDmg}，生成【sts111071】。',
    //         SKILL_TYPE.Elemental, 2, 3, DICE_TYPE.Cryo, {}, [
    //         'https://patchwiki.biligame.com/images/ys/7/73/7826w7dfmnl3bypl1liwuqcu3907s7l.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/c7750c7dbf76e9e3dffa7df162028a4d_5325191736377199101.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 211071;
    //         return { status: [newStatus(ver)(111071, isTalent)] }
    //     }),
    //     new GISkill('神女遣灵真诀', '{dealDmg}，召唤【smn111073】。',
    //         SKILL_TYPE.Burst, 1, 3, DICE_TYPE.Cryo, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/4/49/cquyhtfdkpk25f0sk3afsnb5j502yhk.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/89e2ed92b6352a5925652f421aaddbaa_7169125488313816137.png',
    //     ], () => ({ summon: [newSummon(ver)(111073)] }))
    // ]),

    // 1108: ver => new GIHero(1108, 8, '七七', 'v4.0.0', HERO_LOCAL.Liyue, 10, ELEMENT_TYPE.Cryo, WEAPON_TYPE.Sword,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/08/12/258999284/e94e3710ff2819e5f5fd6ddf51a90910_7928049319389729133.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/c0bd5fd46a539c9d90b4f0470e26c154.png',
    //     skill1('云来古剑法'), [
    //     new GISkill('仙法·寒病鬼差', '召唤【smn111081】。',
    //         SKILL_TYPE.Elemental, 0, 3, DICE_TYPE.Cryo, {}, [
    //         'https://patchwiki.biligame.com/images/ys/2/26/jd1wryrgs25urbr57sq2xnqd4ftpziw.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/08/12/258999284/8ef482a027dfd52ec96e07ce452c38ce_2112371814644076808.jpg',
    //     ], () => ({ summon: [newSummon(ver)(111081)] })),
    //     new GISkill('仙法·救苦度厄', '造成{dmg}点[冰元素伤害]，生成【sts111082】。',
    //         SKILL_TYPE.Burst, 3, 3, DICE_TYPE.Cryo, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/6/6c/p0xq33l7riqu49e0oryu8p1pjg6vzyb.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/08/12/258999284/fbf260ac04da9e7eafa3967cd9bed42c_824806426983130530.jpg',
    //     ], event => {
    //         const { hero: { talentSlot }, card, heros = [] } = event;
    //         const talent = talentSlot ?? isCdt(card?.id == 211081, card);
    //         const hidxs = allHidxs(heros, { isDie: true });
    //         const isExecTalent = hidxs.length > 0 && talent && talent.perCnt > 0;
    //         return {
    //             status: [newStatus(ver)(111082)],
    //             cmds: isCdt<Cmds[]>(isExecTalent, [{ cmd: 'revive', cnt: 2, hidxs }]),
    //             ...(isExecTalent ? { heal: 1.7, hidxs } : {}),
    //             exec: () => {
    //                 if (isExecTalent) --talent.perCnt;
    //             }
    //         }
    //     })
    // ]),

    // 1109: () => new GIHero(1109, '莱依拉', 4, 10, 4, 1,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/94b1677048ddaa84ab735bb8f90c209d_3451890112016676238.png',
    //     skill1('熠辉轨度剑'), [
    //     new GISkill('垂裳端凝之夜', '生成【sts2128】和【sts2129】。', 2, 0, 3, 4, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f4992b1b1ccc7488e72d044a689add90.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/752935b8ac76b044a14e788b146542d9_8202062186002160885.png',
    //     ], () => ({ status: [newStatus(2128), newStatus(2129)] })),
    //     new GISkill('星流摇床之梦', '造成{dmg}点[冰元素伤害]，召唤【smn3047】。', 3, 3, 3, 4, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/890bd4e04afaa53a01d52fc1087c8da7.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/e419e8855adc7d838639a2dacb3be165_5717426653880544475.png',
    //     ], () => ({ summon: [newSummon(ver)(3047)] }))
    // ]),

    // 1110: () => new GIHero(1110, 334, '夏洛蒂', [5, 12], 10, 4, 4,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/0bad00e61b01e543de83347130cab711_7623245668285687441.png',
    //     skill1('冷色摄影律'), [
    //     new GISkill('取景·冰点构图法', '造成{dmg}点[冰元素伤害]，目标角色附属【sts2163】。', 2, 1, 3, 4, {}, [
    //         'https://patchwiki.biligame.com/images/ys/5/59/dzffxm3w1c8nanj1jt7vwoafxvetdbm.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/b6d86920e87c55dfbde7ca49052830f4_4249513964105684090.png',
    //     ], () => ({ statusOppo: [newStatus(2163)] })),
    //     new GISkill('定格·全方位确证', '造成{dmg}点[冰元素伤害]，治疗我方所有角色1点，召唤【smn3056】。', 3, 1, 3, 4, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/0/06/sg317tpcyew82aovprl39dfxavasbd4.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/e1d95cabb132d11c4fc412719e026aa6_3660966934155106231.png',
    //     ], event => ({ heal: 1, hidxs: allHidxs(event.heros), summon: [newSummon(ver)(3056)] }))
    // ]),

    // 1111: () => new GIHero(1111, '莱欧斯利', [5, 11], 10, 4, 4,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/064e881b99d30a1ce455d16a11768a24_8173906534678189661.png',
    //     skill1('迅烈倾霜拳'), [
    //     new GISkill('冰牙突驰', '造成{dmg}点[冰元素伤害]，本角色附属【sts2192】。', 2, 2, 3, 4, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/682e824a7cf31c433eabdf8f101592b1.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/2996ceb349568c064073978f3c45f419_3333678689971567936.png',
    //     ], () => ({ status: [newStatus(2192)] })),
    //     new GISkill('黑金狼噬', '造成{dmg}点[冰元素伤害]，生成【sts2193】。；【本角色在本回合中受到伤害或治疗每累计到2次时：】此技能少花费1个元素骰(最多少花费2个)。', 3, 2, 3, 4, { ec: 3 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/bfa34d0f6363c94bbc3e5a2164196028.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/1156bc48af506ea88c321bfc3e0de56a_8959649322241374469.png',
    //     ], event => {
    //         const { hero: { skills: [, , { perCnt }] }, trigger = '' } = event;
    //         if (trigger == 'calc') {
    //             return { minusDiceSkill: { skilltype3: [0, 0, Math.floor(perCnt / 2)] } }
    //         }
    //         return {
    //             status: isCdt(trigger == 'skilltype3', [newStatus(2193)]),
    //             trigger: isCdt(perCnt < 4, ['getdmg', 'heal']),
    //             exec: () => {
    //                 if (['getdmg', 'heal'].includes(trigger)) ++event.hero.skills[2].perCnt;
    //             }
    //         }
    //     })
    // ]),

    // 1001: () => new GIHero(1001, '芭芭拉', 1, 10, 1, 4,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/f3e20082ab5ec42e599bac75159e5219_4717661811158065369.png',
    //     skill1('水之浅唱'), [
    //     new GISkill('演唱，开始♪', '造成{dmg}点[水元素伤害]，召唤【smn3015】。', 2, 1, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/3d/dhyj1p18ghyyewzm8mrun808th2ula6.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/29a56a05d9f5b91ad6c19590afa4e44b_242169391927783668.png',
    //     ], () => ({ summon: [newSummon(ver)(3015)] })),
    //     new GISkill('闪耀奇迹', '治疗我方所有角色4点。', 3, 0, 3, 1, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/1/1f/mje4jhrya5ok36js3z6f5l8z2sfjg1n.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/03122bb05df17906af5f686ef8a6f2ba_4670328861321191920.png',
    //     ], event => ({ heal: 4, hidxs: allHidxs(event.heros) }))
    // ]),

    // 1002: () => new GIHero(1002, '行秋', 2, 10, 1, 1,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/e522e3d11a6de75d38264655a531adf2_137376333068857031.png',
    //     skill1('古华剑法'), [
    //     new GISkill('画雨笼山', '造成{dmg}点[水元素伤害]，本角色[附着水元素]，生成【sts2002】。', 2, 2, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/9/9f/n2lo8l7ov8w0bx2jwh5qcvmmflm8wbs.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/6ebbfb60e7eee60282022e0c935672dd_2463677033991737689.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 703;
    //         return { status: [newStatus(2002, isTalent)], isAttach: true }
    //     }),
    //     new GISkill('裁雨留虹', '造成{dmg}点[水元素伤害]，本角色[附着水元素]，生成【sts2003】。', 3, 2, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/f/fb/rj85t7tm68l6y8yyuvryh2hagcz1g3b.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/c8eb10016106e63120b6b5c92fcb2a5e_1562905905897327561.png',
    //     ], () => ({ status: [newStatus(2003)], isAttach: true }))
    // ]),

    // 1003: () => new GIHero(1003, '莫娜', 1, 10, 1, 4,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/b48dbc3857d34dac326ae26c8c6cf779_954386122796941241.png',
    //     skill1('因果点破'), [
    //     new GISkill('水中幻愿', '造成{dmg}点[水元素伤害]，召唤【smn3004】。', 2, 1, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/4/41/fbfrg3ytuk388anpxvam5c28nf3n575.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/675b2ca2079729403ddaf84809171b53_3868880190025927848.png',
    //     ], () => ({ summon: [newSummon(ver)(3004)] })),
    //     new GISkill('星命定轨', '造成{dmg}点[水元素伤害]，生成【sts2012】。', 3, 4, 3, 1, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/e/e7/lhrcsp8l0nalp24l55335y1b8pazt8b.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/9cd333219d9081547d9c8f3d16a5b7c3_530937262031086854.png',
    //     ], () => ({ status: [newStatus(2012)] })),
    //     new GISkill('虚实流动', '【此角色为出战角色，我方执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。(每回合1次)', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/1/12/j3lyz5vb4rhxspzbh9sl9toglxhk5d6.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/bc5c12ac6eb36b8d24f03864bf281b87_4261814317325062178.png',
    //     ], event => {
    //         const { hero: { skills: [, , , { useCnt = 1 }] } } = event;
    //         return {
    //             trigger: ['change-from'],
    //             isQuickAction: useCnt == 0,
    //         }
    //     })
    // ]),

    // 1004: () => new GIHero(1004, '珊瑚宫心海', 3, 10, 1, 4,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/89d5a757e494bded4020080c075bf32e_3429989759479851369.png',
    //     skill1('水有常形'), [
    //     new GISkill('海月之誓', '本角色[附着水元素]，召唤【smn3023】。', 2, 0, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/4/4a/3xnadr88l6sbo4vimaz67889y77nfz5.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/b366769c94d320e36f7ae259a68d8364_2006791096014715556.png',
    //     ], () => ({ summon: [newSummon(ver)(3023)], isAttach: true })),
    //     new GISkill('海人化羽', '造成{dmg}点[水元素伤害]，治疗我方所有角色1点，本角色附属【sts2065】。', 3, 2, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/7/7a/a5apmahnio46pxnjy2ejzd7hgts9a7i.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/c9160408f2b03a1b2cedb046aa09f3be_3291666669631292065.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card, summons = [], heros = [] } = event;
    //         const smn3023 = summons.find(smn => smn.id == 3023);
    //         const isTalent = !!talentSlot || card?.id == 731;
    //         const summon = isCdt(isTalent && !smn3023, [newSummon(ver)(3023, 1)]);
    //         if (isTalent && smn3023) ++smn3023.useCnt;
    //         return { heal: 1, hidxs: allHidxs(heros), status: [newStatus(2065)], summon }
    //     })
    // ]),

    // 1005: () => new GIHero(1005, '神里绫人', 3, 10, 1, 1,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/8abc91faf473b3d11fb53db32862737a_4252453982763739636.png',
    //     skill1('神里流·转'), [
    //     new GISkill('神里流·镜花', '造成{dmg}点[水元素伤害]，本角色附属【sts2067】。', 2, 2, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/5/5d/15a6f0hbhixe9lsimlem2brt4lmm4tg.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/7d59ca30b30a9c7fdccaab51f5f3ddb6_6887701647607769506.png',
    //     ], () => ({ status: [newStatus(2067)] })),
    //     new GISkill('神里流·水囿', '造成{dmg}点[水元素伤害]，召唤【smn3025】。', 3, 1, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/6/66/ank1fvv2zp5ctqqmjhkciryr0v5aikl.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/1d3a5df815f4f5dbac3338448f2c1d22_7767414617660800462.png',
    //     ], () => ({ summon: [newSummon(ver)(3025)] }))
    // ]),

    // 1006: () => new GIHero(1006, '达达利亚', 8, 10, 1, 3,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a892e95a4bfde50980ebda3eb93e0ea3_7272571451164412234.png',
    //     skill1('断雨'), [
    //     new GISkill('魔王武装·狂澜', '切换为【sts2075】，然后造成{dmg}点[水元素伤害]，并使目标角色附属【sts2076】。', 2, 2, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/c/ca/0jufd7tgnwppqkiwkkspioz1efhafbh.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/393b86b2158acd396af9fe09f9cd887c_8219782349327935117.png',
    //     ], event => {
    //         const { hero: { inStatus } } = event;
    //         const sts2074 = inStatus.findIndex(ist => ist.id == 2074);
    //         return {
    //             status: [newStatus(2075)],
    //             statusOppo: [newStatus(2076)],
    //             exec: () => {
    //                 if (sts2074 > -1) inStatus.splice(sts2074, 1);
    //             }
    //         }
    //     }),
    //     new GISkill('极恶技·尽灭闪', '依据【达达利亚】当前所处状态，进行不同的攻击：；【远程状态·魔弹一闪】：造成{dmg}点[水元素伤害]，返还2点[充能]，目标角色附属【sts2076】。；【近战状态·尽灭水光】：造成{dmg+2}点[水元素伤害]。', 3, 5, 3, 1, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/3/3f/s2ril7y96ghgom0365u65uu1iq3hdoe.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/de5fd6fc3f4530233cba1774deea0706_8854785564582245062.png',
    //     ], event => {
    //         const { hero: { inStatus } } = event;
    //         const bStatus = inStatus.some(ist => ist.id == 2074);
    //         if (!bStatus) return { addDmgCdt: 2 }
    //         return { statusOppo: [newStatus(2076)], cmds: [{ cmd: 'getEnergy', cnt: 2 }] }
    //     }),
    //     new GISkill('遏浪', '战斗开始时，初始附属【sts2074】。；角色所附属的【sts2075】效果结束时，重新附属【sts2074】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/e/e6/s9urw8i8oidze3t6kgeivc054cg3ued.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b32057264f488d0df6429a135d5ce3e5_4144919367463512201.png',
    //     ], () => ({ trigger: ['game-start', 'revive'], status: [newStatus(2074)] })),
    // ]),

    // 1007: () => new GIHero(1007, '坎蒂丝', 4, 10, 1, 5,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/62c7b1917c4d60c69ca5ef0f011ab8f7_6753229827849116335.png',
    //     skill1('流耀枪术·守势'), [
    //     new GISkill('圣仪·苍鹭庇卫', '本角色附属【sts2094】并[准备技能]：【rsk4】。', 2, 0, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/b/b0/ay6ytf53eoh7q26tim9feavkmui7m67.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/b66a56151a7b1d1b554543bf5a5fcbe8_3742905607972259834.png',
    //     ], () => ({ status: [newStatus(2094), newStatus(2190, ['rsk4'])] })),
    //     new GISkill('圣仪·灰鸰衒潮', '造成{dmg}点[水元素伤害]，生成【sts2095】。', 3, 2, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/f/fc/ipi3ncx8dl44m9og51z6g72pu1mux41.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/65b29af9633d647a90b9ff0acd90d750_1308512450439952516.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = talentSlot != null || card?.id == 749;
    //         return { status: [newStatus(2095, isTalent)] }
    //     })
    // ]),

    // 1008: () => new GIHero(1008, '妮露', 4, 10, 1, 1,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/c204ab1e33aa03f8b8936c5730408063_855558974512689147.png',
    //     skill1('弦月舞步'), [
    //     new GISkill('七域舞步', '造成{dmg}点[水元素伤害]，如果队伍中包含‹1水元素角色›和‹7草元素角色›且不包含其他元素的角色，就生成【sts2111】。', 2, 3, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/7/70/eou9puc088y2tptuyz5obaecxu4mlwe.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/dda23813ac8a901419da3fcfe5fdcdd3_1625330009471386599.png',
    //     ], event => {
    //         const { heros = [] } = event;
    //         const hasEl1Or7Only = heros.every(h => [1, 7].includes(h.element));
    //         const hasEl7 = heros.some(h => h.element == 7);
    //         return { outStatusPre: isCdt(hasEl1Or7Only && hasEl7, [newStatus(2111)]) }
    //     }),
    //     new GISkill('浮莲舞步·远梦聆泉', '造成{dmg}点[水元素伤害]，目标角色附属【sts2112】。', 3, 2, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/e/e4/g0jxv4e1j04516p1lse7kbmq9e169o4.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/d90ebd60eb4eb78a42d0f2f95cab33fc_4581262526420283887.png',
    //     ], () => ({ statusOppo: [newStatus(2112)] }))
    // ]),

    // 1009: () => new GIHero(1009, '夜兰', 2, 10, 1, 3,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/5e7cb3adbfd464b00dbc707f442fe96d_6990020566246221581.png',
    //     skill1('潜形隐曜弓'), [
    //     new GISkill('萦络纵命索', '造成{dmg}点[水元素伤害]，此角色的【sts2130】层数+2。', 2, 3, 3, 1, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/3fdd9553568d44d74d9719f3231b6a8d.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/3ed2b13a1d082aa48aadf38b12f2c0d4_7432676773939994875.png',
    //     ], () => ({ status: [newStatus(2130, 2)] })),
    //     new GISkill('渊图玲珑骰', '造成{dmg}点[水元素伤害]，生成【sts2131】。', 3, 3, 3, 1, { ec: 3 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/b77306b0f53c2bfc141ccb93f866374d.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/8ef70a485219c07361bcfa62d01198a3_6128235753822442226.png',
    //     ], () => ({ status: [newStatus(2131)] })),
    //     new GISkill('破局', '战斗开始时，初始附属【sts2130】。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/9d80088a6e6cb7f8913f3bc14e6f48ab.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/3d521526d51c8e9b090a046c0187ace9_6247094106411719876.png',
    //     ], () => ({ trigger: ['game-start', 'revive'], status: [newStatus(2130)] }))
    // ]),

    // 1010: () => new GIHero(1010, 335, '那维莱特', [5, 12], 10, 1, 4,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/86e0474f40841fbc5faff7870fe9cd0c_8511334021456599978.png',
    //     skill1('如水从平'), [
    //     new GISkill('泪水啊，我必偿还', '造成{dmg}点[水元素伤害]，角色附属【sts2164】。', 2, 2, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/7/78/l63dicjkhcq42evmggc34tdr97rsc29.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/472b87458851b9cf53d0bbe34596e076_7997139213955787355.png',
    //     ], () => ({ status: [newStatus(2164)] })),
    //     new GISkill('潮水啊，我已归来', '造成{dmg}点[水元素伤害]，对所有后台敌人造成1点[穿透伤害]，生成[可用次数]为2的【sts2164】。', 3, 2, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/3/34/f74fkdp404dawd3hcptki3v7yaw6ydg.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/31a30f1436a733695fc91d1248c157e1_6560934694291577179.png',
    //     ], () => ({ pdmg: 1, status: [newStatus(2164, 2)] })),
    // ]),

    // 1011: () => new GIHero(1011, '芙宁娜', [5, 11], 10, 1, 1, [
    //     'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/e958e09d88022d4a18633be9bf51b399.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/fa0204761d8dae8b0dbaac46a494752f.png',
    // ], skill1('独舞之邀', undefined, event => {
    //     const { hero: { skills: [skill1] }, hcards = [] } = event;
    //     if (skill1.perCnt == 0 || hcards.some(c => c.id == 905)) return;
    //     return { cmds: [{ cmd: 'getCard', cnt: 1, card: 905 }], exec: () => { --skill1.perCnt } }
    // }, '；【每回合1次：】如果手牌中没有【crd905】，则生成手牌【crd905】。', { pct: 1 }), [
    //     new GISkill('孤心沙龙', '【芙宁娜】当前处于｢始基力:荒性｣形态，召唤【smn3060】。；(【芙宁娜】处于｢始基力:芒性｣形态时，会改为召唤【smn3061】。)', 2, 0, 3, 1, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/629f7630db6af1831478699dbe6a04e0.png',
    //         '',
    //     ], event => {
    //         const { hero: { local, talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 785;
    //         return { summon: [newSummon(ver)(local.includes(11) ? 3060 : 3061)], status: isCdt(isTalent, [newStatus(2196)],) }
    //     }),
    //     new GISkill('万众狂欢', '造成{dmg}点[水元素伤害]，生成【sts2194】。', 3, 2, 4, 1, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/41d5043a50d5e8617dfa47e1a21aa25c.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/808b53862627bda5900f820650997a77_3050208693053163874.png',
    //     ], () => ({ status: [newStatus(2194)] })),
    //     new GISkill('始基力：圣俗杂座', '战斗开始时，生成手牌【crd905】。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/02b8738828b4ce238059cd8d47a56267.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/5ee50826cdd9cb5c1d48d55b04f84aa1_187435207931585226.png',
    //     ], () => ({ trigger: ['game-start'], cmds: [{ cmd: 'getCard', cnt: 1, card: 905 }] })),
    // ]),

    // 1201: () => new GIHero(1201, '迪卢克', 1, 10, 2, 2,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/62a4fe60bee58508b5cb8ea1379bc975_5924535359245042441.png',
    //     skill1('淬炼之剑'), [
    //     new GISkill('逆焰之刃', '造成{dmg}点[火元素伤害]。每回合第三次使用本技能时，伤害+2。', 2, 3, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/e/ef/e4f6sb7ammsholnhufv95kmtfozj9fs.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/7651d152d160362e7c75ce224f92298c_5143713055633145888.png',
    //     ], event => {
    //         const { hero: { skills: [, { useCnt }] } } = event;
    //         return { addDmgCdt: isCdt(useCnt == 2, 2) }
    //     }),
    //     new GISkill('黎明', '造成{dmg}点[火元素伤害]，本角色附属【sts2008,2,2】。', 3, 8, 4, 2, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/5/58/6jikt2165rekj99qwm3999hb6qsy04o.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/25bdbe8a9495cdc4f48c2a223d06fac1_8334072998945792701.png',
    //     ], () => ({ status: [newStatus(2008, 2, 2)] }))
    // ]),

    // 1202: () => new GIHero(1202, '香菱', 2, 10, 2, 5,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/db00cd121173cb6fcfefcd2269fffe8d_3134519584249287466.png',
    //     skill1('白案功夫'), [
    //     new GISkill('锅巴出击', '召唤【smn3007】。', 2, 0, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/e/e0/ioytpg3b208mckx76izeidcojyybs0g.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/eff41796c703a21e367766cd96ccfefc_4096903365398601995.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 708;
    //         return {
    //             summon: [newSummon(ver)(3007)],
    //             addDmgCdt: isCdt(isTalent, 1),
    //         };
    //     }),
    //     new GISkill('旋火轮', '造成{dmg}点[火元素伤害]，生成【sts2020】。', 3, 3, 4, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/8/8f/abxrclvx2nuyo4rsvbq1rxlcb2vcqh6.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/c324cd014801eaea70ee05529d9ba3ff_2574087438784210727.png',
    //     ], () => ({ status: [newStatus(2020)] }))
    // ]),

    // 1203: () => new GIHero(1203, '班尼特', 1, 10, 2, 1,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/d89f82644792213864d7882f1e6a6d57_6202328605123550683.png',
    //     skill1('好运剑'), [
    //     new GISkill('热情过载', '造成{dmg}点[火元素伤害]。', 2, 3, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/9/94/n851q7f1jehvs60c7lywx72vz6thjyi.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/4e4211389dbbc941630ae7a29ad01fe8_82456441478642234.png']),
    //     new GISkill('美妙旅程', '造成{dmg}点[火元素伤害]，生成【sts2034】。', 3, 2, 4, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/1/13/avxfgtbz3r8qu7zk71dcr8kk3e949zi.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6cdff59fc3701119002ab7cb38157a2c_8058649649755407178.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 713;
    //         return { outStatusPre: [newStatus(2034, isTalent)] }
    //     })
    // ]),

    // 1204: () => new GIHero(1204, '宵宫', 3, 10, 2, 3,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/0ab761b86c16f0c1f8088132e488d641_2788225354118870949.png',
    //     skill1('烟火打扬'), [
    //     new GISkill('焰硝庭火舞', '本角色附属【sts2040】。(此技能不产生[充能])', 2, 0, 1, 2, { ec: -1 }, [
    //         'https://patchwiki.biligame.com/images/ys/4/4d/nxz4yj425tcxv3bevn05eu33wrqv2jr.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/cec17a1d299dd83a96a4e2e791a21da4_3223499260532391975.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 719;
    //         return { status: [newStatus(2040, isTalent)] }
    //     }),
    //     new GISkill('琉金云间草', '造成{dmg}点[火元素伤害]，生成【sts2041】。', 3, 3, 3, 2, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/2/22/p14o20u95t6u0b4hngqf8hhku0r1krx.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/938ac8f32d0998f3c896b862d0791b56_7334292135415645740.png',
    //     ], () => ({ status: [newStatus(2041)] }))
    // ]),

    // 1205: () => new GIHero(1205, '可莉', 1, 10, 2, 4,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/69fb352f7c86836d42648a2bd9c61773_8899766719245799680.png',
    //     skill1('砰砰'), [
    //     new GISkill('蹦蹦炸弹', '造成{dmg}点[火元素伤害]，本角色附属【sts2058】。', 2, 3, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/9/99/eqni0xudmuxvbflx6kviz8l793fju23.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/12/09/12109492/4409746db70c242861fb0a6addafd850_1072795968508012901.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 727;
    //         return { status: [newStatus(2058, isTalent)] }
    //     }),
    //     new GISkill('轰轰火花', '造成{dmg}点[火元素伤害]，在对方场上生成【sts2059】。', 3, 3, 3, 2, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/2/28/s88qf6z943kpscss1oye99kmccz2y10.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/01/18/12109492/3f4f659ff99b2435aa3662f4d17d537d_4727800863330247216.png',
    //     ], () => ({ statusOppo: [newStatus(2059)] }))
    // ]),

    // 1206: () => new GIHero(1206, '安柏', 1, 10, 2, 3,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/915473ac6c13d0bea16d141adca38359_823004675460920277.png',
    //     skill1('神射手'), [
    //     new GISkill('爆炸玩偶', '召唤【smn3029】。', 2, 0, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/4/47/52p9ytkmov9g5ms8mzzovuc4tzya3nl.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/36e0f7549a2676d340220d9b0da2e037_4582096687507723724.png',
    //     ], () => ({ summon: [newSummon(ver)(3029)] })),
    //     new GISkill('箭雨', '造成{dmg}点[火元素伤害]，对所有敌方后台角色造成2点[穿透伤害]。', 3, 2, 3, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/9/91/jbwgghhm13093k7uyxazjkmigmsq6zj.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/cae15535936cce8934a1c0a2330e69ac_2372376468187258300.png',
    //     ], () => ({ pdmg: 2 }))
    // ]),

    // 1207: () => new GIHero(1207, '胡桃', 2, 10, 2, 5,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fb95dbcb2f4ad804f1c3bbe767c3595e_5336167659518462076.png',
    //     skill1('往生秘传枪法'), [
    //     new GISkill('蝶引来生', '本角色附属【sts2078】。', 2, 0, 2, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/f/f3/0g43qqxknh3k0v6j7b6q4u6jl5hfbee.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/de4fd19b85ccff272b9a4c98ca3812a6_2552949834321842909.png',
    //     ], () => ({ status: [newStatus(2078)] })),
    //     new GISkill('安神秘法', '造成{dmg}点[火元素伤害]，治疗自身2点。如果本角色生命值不多于6，则造成的伤害和治疗各+1。', 3, 4, 3, 2, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/b/b0/cpmmff7d7wctcaepp47ix06vprvpsrs.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e2a7845bb7627390caddc5aebee27b65_4410957076093902563.png',
    //     ], event => {
    //         const { hero: { hp } } = event;
    //         const isHp6 = hp <= 6;
    //         return { heal: isHp6 ? 3 : 2, addDmgCdt: isCdt(isHp6, 1) }
    //     })
    // ]),

    // 1208: () => new GIHero(1208, '烟绯', 2, 10, 2, 4,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/df1805ae68d4dee99369058360f397cd_6712537786885000576.png',
    //     skill1('火漆印制'), [
    //     new GISkill('丹书立约', '造成{dmg}点[火元素伤害]，本角色附属【sts2096】。', 2, 3, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/4/4d/c4zvyjyfmjxif0axdrokruczxky5dc7.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/649b9c9adf75bb1dd7606c75bc0589c1_3860785563340483833.png',
    //     ], () => ({ status: [newStatus(2096)] })),
    //     new GISkill('凭此结契', '造成{dmg}点[火元素伤害]，本角色附属【sts2096】和【sts2097】。', 3, 3, 3, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/b/b0/iike33982frep1bmhcdj0juxpcidqey.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/d135e7fc5ac836105a3f8bfb22ef346e_6469409230143043569.png',
    //     ], () => ({ status: [newStatus(2096), newStatus(2097)] }))
    // ]),

    // 1209: () => new GIHero(1209, '迪希雅', [4, 10], 10, 2, 2,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/9865ac83f483b177c63e99360305dc28_7940275616970367103.png',
    //     skill1('拂金剑斗术'), [
    //     new GISkill('熔铁流狱', '召唤【smn3041】; 如果已存在【smn3041】，就先造成{dmg+1}点[火元素伤害]。', 2, 0, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/8/8c/k583v0pci7akj1fbcin40ogho11mxzr.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/b590f6bfaf00c68987b204aa33e937aa_4421699992460567189.png',
    //     ], event => {
    //         const { summons = [] } = event;
    //         const isSmned = summons.some(smn => smn.id == 3041);
    //         return {
    //             summon: [newSummon(ver)(3041)],
    //             addDmgCdt: isCdt(isSmned, 1),
    //         }
    //     }),
    //     new GISkill('炎啸狮子咬', '造成{dmg}点[火元素伤害]，然后[准备技能]：【rsk5】。', 3, 3, 4, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/7/7f/ap84alhaz0b3jc9uh4e2nl84at46do1.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/d4af1c58efe84398677b12a796a10091_49820199465503907.png',
    //     ], () => ({ status: [newStatus(2123)] }))
    // ]),

    // 1210: () => new GIHero(1210, '林尼', [5, 8, 12], 10, 2, 3,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/e0cc3a4602a418aaebb0855ad147f91e_261319803814200678.png',
    //     skill1('迫牌易位式'), [
    //     new GISkill('隐具魔术箭', '造成{dmg}点[火元素伤害]，召唤【smn3048】，累积1层【sts2132】。；如果本角色生命值至少为6，则对自身造成1点[穿透伤害]。', 1, 2, 3, 2, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/1d65a51c36eca7169247316ff7e14a89.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5e46c170e7ce41c20bf76c27c4a16d89_689217131128119675.png',
    //     ], event => {
    //         const { hero: { hp } } = event;
    //         return { pdmgSelf: isCdt(hp >= 6, 1), summon: [newSummon(ver)(3048)], status: [newStatus(2132)] }
    //     }),
    //     new GISkill('眩惑光戏法', '造成{dmg}点[火元素伤害]。', 2, 3, 3, 2, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f86fcf037ad32d9973e84673f33f2b2b.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/22ed66987bb301d836569cf8fd4fc845_378167615829921519.png']),
    //     new GISkill('大魔术·灵迹巡游', '造成{dmg}点[火元素伤害]，召唤【smn3048】，累积1层【sts2132】。', 3, 3, 3, 2, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/9859ed5f65f53d9fb21c11b2a6df50d8.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/6d91a8911290da444b67711806a75a56_5602716403383894799.png',
    //     ], () => ({ summon: [newSummon(ver)(3048)], status: [newStatus(2132)] }))
    // ]),

    // 1211: () => new GIHero(1211, 319, '托马', 3, 10, 2, 5,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/a21241c40833d2aee5336ae8fdd58c41_7254789917363324478.png',
    //     skill1('迅破枪势'), [
    //     new GISkill('烈烧佑命之侍护', '造成{dmg}点[火元素伤害]，生成【sts2106】。', 2, 2, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/6/6a/s3cppco85ykmlq1xuqfqfohdwuk3ogi.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/5943ef23f4dde5b6015a06e67e8332a5_7948056671343155927.png',
    //     ], () => ({ status: [newStatus(2106)] })),
    //     new GISkill('真红炽火之大铠', '造成{dmg}点[火元素伤害]，生成【sts2106】和【sts2154】。', 3, 2, 3, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/2/21/a47iyqyy205fi0kyn38tmakcinh281j.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/7d6cb477d20cd8b75925ce62d3b73e8e_5295401799072493605.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 772;
    //         return { status: [newStatus(2106), newStatus(2154, isTalent)] }
    //     })
    // ]),

    // 1212: () => new GIHero(1212, '辛焱', 2, 10, 2, 2,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/2538459953fb12e38da66416bd1db19a_2302423233068754101.png',
    //     skill1('炎舞'), [
    //     new GISkill('热情拂扫', '造成{dmg}点[火元素伤害]，随机[舍弃]1张元素骰费用最高的手牌，生成【sts2197】。', 2, 2, 3, 2, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/dbd50c015ba92d80ee8c5feab9b1f16d.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/32dd71b5685b54f23af58c4afa8cffc7_1218700248488941422.png',
    //     ], () => ({ cmds: [{ cmd: 'discard', element: 0 }], status: [newStatus(2197)] })),
    //     new GISkill('叛逆刮弦', '造成{dmg}点[物理伤害]，对所有敌方后台角色造成2点[穿透伤害]; [舍弃]我方所有手牌，生成【sts2199】。', 3, 3, 3, 2, { ec: 2, de: 0 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/0f007a2905436bfbbcc0f286889fea82.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/6387793092d6e4fbf598834d1c4735b0_3596019311060413612.png',
    //     ], () => ({ pdmg: 2, status: [newStatus(2199)], cmds: [{ cmd: 'discard', element: 1 }] }))
    // ]),

    // 1213: () => new GIHero(1213, '夏沃蕾', [5, 11], 10, 2, 5,
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Char_Avatar_Chevreuse.webp',
    //     skill1('线列枪刺·改'), [
    //     new GISkill('近迫式急促拦射', '造成{dmg}点[火元素伤害]。；【此技能结算后：】如果我方手牌中含有【crd912】，则[舍弃]1张并治疗我方受伤最多的角色1点。。', 2, 3, 3, 2, {}, [
    //         '',
    //         '',
    //     ], event => {
    //         const { hcards = [], heros = [] } = event;
    //         if (hcards.every(c => c.id != 912)) return;
    //         return { cmds: [{ cmd: 'discard', cnt: 1, card: 912 }, { cmd: 'heal', cnt: 1, hidxs: getMaxHertHidxs(heros) }] }
    //     }),
    //     new GISkill('圆阵掷弹爆轰术', '造成{dmg}点[火元素伤害]，在敌方场上生成【sts2218】。', 3, 3, 3, 2, { ec: 2 }, [
    //         '',
    //         '',
    //     ], () => ({ statusOppo: [newStatus(2218)] })),
    //     new GISkill('纵阵武力统筹', '【敌方角色受到超载反应伤害后：】生成手牌【crd912】。(每回合1次)', 4, 0, 0, 0, {}, [
    //         '',
    //         '',
    //     ], event => {
    //         const { hero: { skills: [, , , { useCnt }] } } = event;
    //         if (useCnt > 0) return;
    //         return { trigger: ['Vaporize'], cmds: [{ cmd: 'getCard', cnt: 1, card: 912 }] }
    //     })
    // ]),

    // 1301: () => new GIHero(1301, '菲谢尔', 1, 10, 3, 3,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/08/02/195563531/41fc0a943f93c80bdcf24dbce13a0956_3894833720039304594.png',
    //     skill1('灭罪之矢'), [
    //     new GISkill('夜巡影翼', '造成{dmg}点[雷元素伤害]，召唤【smn3008】。', 2, 1, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/2/29/9ikuan4r5rhgza5nlxl86m718d3zmtt.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/4ab444ac20da8ea0990ff891600596ed_358383106993654545.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 709;
    //         return { summon: [newSummon(ver)(3008, isTalent)] }
    //     }),
    //     new GISkill('至夜幻现', '造成{dmg}点[雷元素伤害]，对所有敌方后台角色造成2点[穿透伤害]。', 3, 4, 3, 3, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/5/5e/oi2xpx4ad1wuo0g4nozm1yqfxzmzrut.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/bac9b0ca7056b02ffac854871d7cb0e0_7559183843121315562.png',
    //     ], () => ({ pdmg: 2 }))
    // ]),

    // 1302: () => new GIHero(1302, '雷泽', 1, 10, 3, 2,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/52cc6519a87290840830b64f25117070_8992911737218383504.png',
    //     skill1('钢脊'), [
    //     new GISkill('利爪与苍雷', '造成{dmg}点[雷元素伤害]。', 2, 3, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/0/02/e16tz7kk056z1n3duql87hoj6gxf8z5.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/d9a4f69257c64d52769a6b0a9af8031a_2133845428381568499.png']),
    //     new GISkill('雷牙', '造成{dmg}点[雷元素伤害]，本角色附属【sts2035】。', 3, 3, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/0/04/o12dwfbbsokckmhk1rmuj9i5fekwenv.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/2fcead6f24aba2d2595e98615756f175_4684225450339126121.png',
    //     ], () => ({ status: [newStatus(2035)] }))
    // ]),

    // 1303: () => new GIHero(1303, '刻晴', 2, 10, 3, 1,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/2dd94ec81fda4b55e9d90ae89de4cf80_5019006447640086752.png',
    //     skill1('云来剑法'), [
    //     new GISkill('星斗归位', '造成{dmg}点[雷元素伤害]，生成手牌【crd901】', 2, 3, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/5/58/8ajyn7zzhal0dopp6vi3lnryq12gq28.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/c351b44d3163278214f6f9db09c020fd_3304441541356399096.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card, hcards = [] } = event;
    //         const isTalent = +(!!talentSlot || card?.id == 720);
    //         const hasCard901 = hcards.some(c => c.id == 901);
    //         return {
    //             status: isCdt(card?.id == 901 || hasCard901, [newStatus(2008, 3, 2 + isTalent, isTalent)]),
    //             cmds: isCdt<Cmds[]>(hasCard901, [{ cmd: 'discard', card: 901 }], [{ cmd: 'getCard', cnt: 1, card: 901 }]),
    //         }
    //     }),
    //     new GISkill('天街巡游', '造成{dmg}点[雷元素伤害]，对所有敌方后台角色造成3点[穿透伤害]。', 3, 4, 4, 3, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/a/a0/hl9rfd4cwbif4a7gw3zmep0cdsgn6mu.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a74c053cad9ec216f37e5dc8ab5094d0_6153800052390998584.png',
    //     ], () => ({ pdmg: 3 }))
    // ]),

    // 1304: () => new GIHero(1304, '赛诺', 4, 10, 3, 5,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/7f62549984cde8b10d694d05c0618a06_5004521367910517162.png',
    //     skill1('七圣枪术'), [
    //     new GISkill('秘仪·律渊渡魂', '造成{dmg}点[雷元素伤害]。', 2, 3, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/4/4e/07nlgs0ws704oq4zbisr6ocw66qiyxh.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/4158f2729a2812dd54941af53f348acc_440344287585392498.png',
    //     ], event => {
    //         const { hero: { talentSlot, inStatus }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 728;
    //         const sts2060cnt = inStatus.find(ist => ist.id == 2060)?.useCnt ?? -1;
    //         return { addDmgCdt: isCdt(isTalent && sts2060cnt % 2 == 0, 1) }
    //     }),
    //     new GISkill('圣仪·煟煌随狼行', '造成{dmg}点[雷元素伤害]，【sts2060】的｢凭依｣级数+2。', 3, 4, 4, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/4/43/97c3rcihd4xaaxhdqfmjiy5acjtr6xs.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a4c6f2756a7b065b0319bddd5f9d61ee_4163672646150158077.png',
    //     ]),
    //     new GISkill('行度誓惩', '战斗开始时，初始附属【sts2060】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/7/71/7jaouwue7o0q82ndc0f2da0sw5nxc4d.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/c61b597d14d7915b53d8bf462e8ad609_6351825637878214573.png',
    //     ], () => ({ trigger: ['game-start', 'revive'], status: [newStatus(2060)] }))
    // ]),

    // 1305: () => new GIHero(1305, '北斗', 2, 10, 3, 2,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/20a9053476de0a5b82ae38f678df287b_1479624244948739352.png',
    //     skill1('征涛'), [
    //     new GISkill('捉浪', '本角色附属【sts2062】，并[准备技能]：【rsk1】。', 2, 0, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/e/e5/k9meeap7ei7ox3q9yx4b6803v79m6om.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/12/09/12109492/ab87d12b9075094e4ddc0637d3d938ba_5680751413245970029.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const status = [newStatus(2062), newStatus(2189)];
    //         if (!!talentSlot || card?.id == 729) status.push(newStatus(2107));
    //         return { status }
    //     }),
    //     new GISkill('斫雷', '造成{dmg}点[雷元素伤害]，生成【sts2063】。', 3, 2, 3, 3, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/e/e8/738iv8ypner8eho40gwxipqfr6hzfdg.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/12/09/12109492/de30554b41553d6c58e6922c47937862_5183453852325935866.png',
    //     ], () => ({ status: [newStatus(2063)] }))
    // ]),

    // 1306: () => new GIHero(1306, '九条裟罗', 3, 10, 3, 3,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/7bef3d1a8bfd273866a62b05ce89c0c2_2441417120175670805.png',
    //     skill1('天狗传弓术'), [
    //     new GISkill('鸦羽天狗霆雷召咒', '造成{dmg}点[雷元素伤害]，召唤【smn3021】。', 2, 1, 3, 3, { expl: ['sts2064'] }, [
    //         'https://patchwiki.biligame.com/images/ys/7/7a/0we2peecoitxx412iw1toi30feb7uqz.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/cf253866ef5fd4ae4d19e81afbefd074_689676764945311191.png',
    //     ], () => ({ summon: [newSummon(ver)(3021)] })),
    //     new GISkill('煌煌千道镇式', '造成{dmg}点[雷元素伤害]，召唤【smn3022】。', 3, 1, 4, 3, { ec: 2, expl: ['sts2064'] }, [
    //         'https://patchwiki.biligame.com/images/ys/8/88/a454xedesmgk8h4a9q4f4wddudzzkwq.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/affa346d8b3bdc6281da340c52f5c4a4_394143682255893684.png',
    //     ], () => ({ summon: [newSummon(ver)(3022)] }))
    // ]),

    // 1307: () => new GIHero(1307, '雷电将军', 3, 10, 3, 5,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e9cb40e812da2147e3786f7cc3b2bd7d_208524583698335951.png',
    //     skill1('源流'), [
    //     new GISkill('神变·恶曜开眼', '召唤【smn3030】。', 2, 0, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/2/2e/7b213rdcyu4wbzbt2lyz3xge9jur2u6.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ca5a55d164f3a97852b0d7fc59d09875_1236252164045819134.png',
    //     ], () => ({ summon: [newSummon(ver)(3030)] })),
    //     new GISkill('奥义·梦想真说', '造成{dmg}点[雷元素伤害]，其他我方角色获得2点[充能]。', 3, 3, 4, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/8/84/3elwfz4r3jrizlpe5zx9f0vhqzc7aef.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e32265b2715186774b8d4bcf3d918880_1471851977626289486.png',
    //     ], event => {
    //         const { heros = [], card, hero: { talentSlot, inStatus } } = event;
    //         const hidxs: number[] = heros.map((h, hi) => ({ val: h.isFront, hi })).filter(v => !v.val).map(v => v.hi);
    //         const isTalent = talentSlot != null || card?.id == 740;
    //         const sts2080 = inStatus.find(ist => ist.id == 2080);
    //         return {
    //             addDmgCdt: (sts2080?.useCnt ?? 0) * (isTalent ? 2 : 1),
    //             cmds: [{ cmd: 'getEnergy', cnt: 2, hidxs }],
    //         }
    //     }),
    //     new GISkill('诸愿百眼之轮', '战斗开始时，初始附属【sts2080】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/0/0f/5ardhper4s2i541lmywmazv31hfn0q9.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2df2771f98519d3d46ad0551977ca99a_7788585308123167206.png',
    //     ], () => ({ trigger: ['game-start', 'revive'], status: [newStatus(2080)] }))
    // ]),

    // 1308: () => new GIHero(1308, '八重神子', 3, 10, 3, 4,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/7e55525ee5cff216360b46322aa107ee_5470950562732053429.png',
    //     skill1('狐灵食罪式'), [
    //     new GISkill('野千役咒·杀生樱', '召唤【smn3031】。', 2, 0, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/3d/guf5f3kk06kmo3y0uln71jqsovem8yk.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/5d52bb5027ee98ea6295c7cbe6f75260_4362138600485261556.png',
    //     ], () => ({ summon: [newSummon(ver)(3031)] })),
    //     new GISkill('大密法·天狐显真', '造成{dmg}点[雷元素伤害]; 如果我方场上存在【smn3031】，则将其消灭，然后生成【sts2081】。', 3, 4, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/e/ea/8y36keriq61eszpx5mm5ph7fvwa07ad.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b5ebdd77cfd7a6e12d1326c08e8f9214_6239158387266355120.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card, summons = [] } = event;
    //         const status3031Idx = summons.findIndex(smn => smn.id == 3031);
    //         let status: Status[] = [];
    //         if (status3031Idx > -1) {
    //             summons.splice(status3031Idx, 1);
    //             status.push(newStatus(2081));
    //             if (!!talentSlot || card?.id == 741) status.push(newStatus(2109));
    //         }
    //         return { status }
    //     })
    // ]),

    // 1309: () => new GIHero(1309, '丽莎', 1, 10, 3, 4,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/08/12/203927054/129fe37de1bed078b49b9bc79ef2e757_1437470149833493317.png',
    //     skill1('指尖雷暴', undefined, event => {
    //         const { isChargedAtk = false } = event;
    //         return { statusOppo: isCdt(isChargedAtk, [newStatus(2099)]) }
    //     }, '；如果此技能为[重击]，则使敌方出战角色附属【sts2099】。'), [
    //     new GISkill('苍雷', '造成{dmg}点[雷元素伤害]; 如果敌方出战角色未附属【sts2099】，则使其附属【sts2099】。', 2, 2, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/1/13/1tkxwb0js8qxi9yi8bm6tpub8f9ba19.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/bb9487283d20c857804988ace8572ebc_971397791433710881.png',
    //     ], event => {
    //         const { eheros = [] } = event;
    //         const status2099 = eheros.find(h => h.isFront)?.inStatus?.find(ist => ist.id == 2099);
    //         const addDmgCdt = isCdt(!!status2099, status2099?.useCnt ?? 0);
    //         if (status2099) status2099.useCnt = 0;
    //         return { statusOppo: isCdt(!status2099, [newStatus(2099)]), addDmgCdt }
    //     }),
    //     new GISkill('蔷薇的雷光', '造成{dmg}点[雷元素伤害]，召唤【smn3038】。', 3, 2, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/0/01/l5uobg3f84vj4x52kanzphba9ype2tw.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/d641396daad417dda3c4f9a26f02bfdc_897742072769166162.png',
    //     ], () => ({ summon: [newSummon(ver)(3038)] }))
    // ]),

    // 1310: () => new GIHero(1310, '多莉', 4, 10, 3, 2,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/20b47c429b784fac1ef2c80d560c93cc_6932125694251188191.png',
    //     skill1('妙显剑舞·改'), [
    //     new GISkill('镇灵之灯·烦恼解决炮', '造成{dmg}点[雷元素伤害]，召唤【smn3044】。', 2, 2, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/37/1eiismiuis2sxbg937vk1uhz3ge2yr2.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/91280ec7f6956790332305adff93a619_8857314989004908195.png',
    //     ], () => ({ summon: [newSummon(ver)(3044)] })),
    //     new GISkill('卡萨扎莱宫的无微不至', '造成{dmg}点[雷元素伤害]，召唤【smn3045】。', 3, 1, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/b/b7/pzuxl8ukf3do834omkdzx5p8yfape0u.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/a1870db7855c7037f700f74152d1f28e_1635879084262346523.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = talentSlot != null || card?.id == 759;
    //         return { summon: [newSummon(ver)(3045, isTalent)] }
    //     })
    // ]),

    // 1311: () => new GIHero(1311, '久岐忍', 3, 10, 3, 1,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/97e8a503ac00ee72817a33b15bc6e971_1406073271702365176.png',
    //     skill1('忍流飞刃斩'), [
    //     new GISkill('越袚雷草之轮', '生成【sts2176】。如果本角色生命值至少为6，则对自身造成2点[穿透伤害]。', 2, 0, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/31/fv5yfpb6wv4qr22o5shuixr9zqnpxcm.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/2c5603069fd6b7e1738de78d8ee13a40_2690219876080442261.png',
    //     ], event => {
    //         const { hero: { hp } } = event;
    //         return { status: [newStatus(2176)], pdmgSelf: isCdt(hp >= 6, 2) }
    //     }),
    //     new GISkill('御咏鸣神刈山祭', '造成{dmg}点[雷元素伤害]，治疗本角色2点。', 3, 4, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/e/e9/s3ky8ara3d50e1z7ced1wyap6iwmhoi.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/20e4d43aa23679f40e2f3afbdb467a3b_3325226986841086396.png',
    //     ], () => ({ heal: 2 }))
    // ]),

    // 1401: () => new GIHero(1401, '砂糖', 1, 10, 5, 4,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/a6944247959cfa7caa4d874887b40aaa_8329961295999544635.png',
    //     skill1('简式风灵作成'), [
    //     new GISkill('风灵作成·陆叁零捌', '造成{dmg}点[风元素伤害]，使对方强制切换到前一个角色。', 2, 3, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/6/6a/lu1s5jeliurancx62txk0i7pbgeu07d.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/20e905e459a535c372b1c0eacf6dd9d8_1859277343951133632.png',
    //     ], () => ({ cmds: [{ cmd: 'switch-before', cnt: 2500, isOppo: true }] })),
    //     new GISkill('禁·风灵作成·柒伍同构贰型', '造成{dmg}点[风元素伤害]，召唤【smn3005】。', 3, 1, 3, 5, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/8/8b/mfq7sbev9evjdy9lxkfsp96np5fockl.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/2f7e7dededadbb4bec6cd5a1e3b8714a_8254714025319039539.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 706;
    //         return { summonPre: [newSummon(ver)(3005, isTalent)] }
    //     })
    // ]),

    // 1402: () => new GIHero(1402, '琴', 1, 10, 5, 1,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/88b869ceca8108bfd6dd14a68d5e9610_2290626250490650584.png',
    //     skill1('西风剑术'), [
    //     new GISkill('风压剑', '造成{dmg}点[风元素伤害]，使对方强制切换到下一个角色。', 2, 3, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/7/76/qzlqexf6zwkkcpxpyevb3m4viwepssv.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/68d6fd8c9815617b0491dd19586ae2f4_2703229586151516906.png',
    //     ], () => ({ cmds: [{ cmd: 'switch-after', cnt: 2500, isOppo: true }] })),
    //     new GISkill('蒲公英之风', '治疗我方所有角色2点，召唤【smn3006】。', 3, 0, 4, 5, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/2/23/gqtjyn7ckzz3g0zbtmska8ws1ry1dqj.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e4d3dd465a4f6026ba923619c1827c94_3960747061292563787.png',
    //     ], event => {
    //         const { heros = [] } = event;
    //         return { summon: [newSummon(ver)(3006)], heal: 2, hidxs: allHidxs(heros) }
    //     })
    // ]),

    // 1403: () => new GIHero(1403, '温迪', 1, 10, 5, 3,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b8d0f177c157908bbe1ef65774d5a4e5_6672388573788855956.png',
    //     skill1('神代射术'), [
    //     new GISkill('高天之歌', '造成{dmg}点[风元素伤害]，生成【sts2082】。', 2, 2, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/f/fe/hhb16pe3sq5duv4cu299atxbi78k7ae.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/73d15303525e2658bf60d8336109d92e_404486790465744082.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 742;
    //         return { status: [newStatus(2082, isTalent)] }
    //     }),
    //     new GISkill('风神之诗', '造成{dmg}点[风元素伤害]，召唤【smn3032】。', 3, 2, 3, 5, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/c/cf/iv3keguj9pqi3blf8j9xk10olca914v.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/3e4ec3f94bfd2547b1431d8fa2cd2889_8125698290989309719.png',
    //     ], () => ({ summonPre: [newSummon(ver)(3032)] }))
    // ]),

    // 1404: () => new GIHero(1404, '魈', 2, 10, 5, 5,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/cdb6d5f322226b118ce989ed2f02e932_3401048792875977242.png',
    //     skill1('卷积微尘'), [
    //     new GISkill('风轮两立', '造成{dmg}点[风元素伤害]。', 2, 3, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/8/82/16jnimrpz65wm0ch1npu1f35j3mbuyy.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/0f23faa9eda436e8d493764afaac9f5a_3023794288508183778.png']),
    //     new GISkill('靖妖傩舞', '造成{dmg}点[风元素伤害]，本角色附属【sts2085】。', 3, 4, 3, 5, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/9/9f/7dxxr4z59ch7bsg0xaoxxi38meuaeff.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/081c165d08ff75ec2f15215cfc892056_2221900956718137863.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const status = [newStatus(2085)];
    //         if (!!talentSlot || card?.id == 743) status.push(newStatus(2115));
    //         return { status }
    //     })
    // ]),

    // 1405: () => new GIHero(1405, '枫原万叶', 3, 10, 5, 1,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/0aedb983698b4d5abcd1a4405a0ed634_7726035612370611710.png',
    //     skill1('我流剑术'), [
    //     new GISkill('千早振', '造成{dmg}点[风元素伤害]，本角色附属【sts2098】。；如果此技能引发了扩散，则将【sts2098】转换为被扩散的元素。；【此技能结算后：】我方切换到后一个角色。', 2, 3, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/2/29/f7rwj3qb9kffejm2kt2oq7ltl843nrk.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/c492b46c71485b1377cf8c9f3f5dd6e8_6376046014259793309.png',
    //     ], event => ({
    //         status: [newStatus(2098, event.windEl)],
    //         cmds: [{ cmd: 'switch-after', cnt: 2500 }],
    //     })),
    //     new GISkill('万叶之一刀', '造成{dmg}点[风元素伤害]，召唤【smn3037】。', 3, 3, 3, 5, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/4/47/g6cfvzw12ruiclawmxh903fcoowmr9j.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/293efb8c9d869e84be6bc02039d72104_7417737523106108019.png',
    //     ], () => ({ summonPre: [newSummon(ver)(3037)] }))
    // ]),

    // 1406: () => new GIHero(1406, '流浪者', [], 10, 5, 4,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/1c63a8f561bdfe0a7d7e1053ff9c42f8_8476567918375768271.png',
    //     skill1('行幡鸣弦'), [
    //     new GISkill('羽画·风姿华歌', '造成{dmg}点[风元素伤害]，本角色附属【sts2102】。', 2, 2, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/0/0c/p9khnkc2qxezjcsy2yqn1t1608iq7df.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/af6e40020a01e57e5bf16ed76dfadd97_2412715488042159947.png',
    //     ], () => ({ status: [newStatus(2102)] })),
    //     new GISkill('狂言·式乐五番', '造成{dmg}点[风元素伤害]; 如果角色附属有【sts2102】，则将其移除并使此伤害+1。', 3, 7, 3, 5, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/3/31/jq8wshhifimtmgedysk1xlscepp9d6l.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/9b7fa91d73564e2cb0cbbbc0d1b75cb3_8357319180909129225.png',
    //     ], event => {
    //         const { hero: { inStatus } } = event;
    //         const sts2102 = inStatus.find(ist => ist.id == 2102);
    //         return {
    //             addDmgCdt: isCdt(!!sts2102, 1),
    //             exec: () => {
    //                 if (sts2102) sts2102.useCnt = 0;
    //             }
    //         }
    //     })
    // ]),

    // 1407: () => new GIHero(1407, '琳妮特', [5, 8, 11], 10, 5, 1,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/138a3a7a50a96267097824590e869fe1_5113881666208140363.png',
    //     skill1('迅捷礼刺剑'), [
    //     new GISkill('谜影障身法', '造成{dmg}点[风元素伤害]，本回合第一次使用此技能、且自身生命值不多于8时，治疗自身2点，但是附属【sts2133】。', 2, 3, 3, 5, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/b2ba9e68ed4a405e54b4786ecac7c3e3.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/2d696e8b97e9fe9fb4572a81786780d6_2735599059161740228.png',
    //     ], event => {
    //         const { hero: { talentSlot, hp, skills: [, { useCnt }] }, card } = event;
    //         const cdt = hp <= 8 && useCnt == 0;
    //         const isTalent = (!!talentSlot || card?.id == 764) && useCnt == 1;
    //         return {
    //             heal: isCdt(cdt, 2),
    //             status: isCdt(cdt, [newStatus(2133)]),
    //             addDmgCdt: isCdt(isTalent, 2),
    //             cmds: isCdt(isTalent, [{ cmd: 'switch-before', cnt: 2500, isOppo: true }]),
    //         }
    //     }),
    //     new GISkill('魔术·运变惊奇', '造成{dmg}点[风元素伤害]，召唤【smn3049】。', 3, 2, 3, 5, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/20bd958ebc8383c98bfff1c6620deade.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/6f97ce81f1862b031947b8a82ec8c680_8034117038151757666.png',
    //     ], () => ({ summon: [newSummon(ver)(3049)] }))
    // ]),

    // 1408: () => new GIHero(1408, '早柚', 3, 10, 5, 2,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/7ba293dd475e123f98a89e2c6448c22d_2852763407290233167.png',
    //     skill1('忍刀·终末番'), [
    //     new GISkill('呜呼流·风隐急进', '造成{dmg}点[风元素伤害]，本角色[准备技能]：【rsk12】。；如果当前技能引发了扩散，则【rsk12】将改为造成被扩散元素的伤害。', 2, 1, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/f/f1/nft00ohrbmn6j4hqssftn7kh4ha3nk5.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/1b3691e9a037a54d02076135237d2925_8714311620973409736.png',
    //     ], event => {
    //         const { windEl = 0 } = event;
    //         return { status: [newStatus(2155, windEl)] }
    //     }),
    //     new GISkill('呜呼流·影貉缭乱', '造成{dmg}点[风元素伤害]，召唤【smn3053】。', 3, 1, 3, 5, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/7/74/6cc1al7p5kum4yuwp7rtqt6ymv0gl9y.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/3457c9ea9df5a90c56a5be0d8e30482b_4898602838938710962.png',
    //     ], () => ({ summon: [newSummon(ver)(3053)] }))
    // ]),

    // 1409: () => new GIHero(1409, '珐露珊', 4, 10, 5, 3,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/df01c4398360e3884ceef43d0717699d_6350296313348675536.png',
    //     skill1('迴身箭术'), [
    //     new GISkill('非想风天', '造成{dmg}点[风元素伤害]，本角色附属【sts2177】。', 2, 3, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/a/a5/a1tqqztvc2osslkg9s3oatxesdw8zdm.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/7fb2f931bdb1d001003ac18fa8c5a042_180586662624215779.png',
    //     ], () => ({ status: [newStatus(2177)] })),
    //     new GISkill('抟风秘道', '造成{dmg}点[风元素伤害]，召唤【smn3058】。', 3, 1, 3, 5, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/c/ca/da9v501c8j71zqew4flylr7hmqq5r31.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/c992b62ec652ce301ab6e9895aac1284_9109457382282902369.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card, summons = [] } = event;
    //         const isTalent = !!talentSlot || card?.id == 781;
    //         const isExist = summons.some(smn => smn.id == 3058);
    //         return {
    //             summon: [newSummon(ver)(3058, isTalent)],
    //             cmds: isCdt<Cmds[]>(isTalent && !isExist, [{ cmd: 'getDice', cnt: 1, element: 5 }])
    //         }
    //     })
    // ]),

    // 1501: () => new GIHero(1501, '凝光', 2, 10, 6, 4,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/6105ce8dd57dfd2efbea4d4e9bc99a7f_3316973407293091241.png',
    //     skill1('千金掷'), [
    //     new GISkill('璇玑屏', '造成{dmg}点[岩元素伤害]，生成【sts2027】。', 2, 2, 3, 6, {}, [
    //         'https://patchwiki.biligame.com/images/ys/c/c7/fhhajrw49bck487xgc9tm832v1lydan.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e16efaaa1d7a4e0e50c2df84b5870ea3_8679057305261038668.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         return { status: [newStatus(2027)], addDmgCdt: isCdt(!talentSlot && card?.id == 710, 1) };
    //     }),
    //     new GISkill('天权崩玉', '造成{dmg}点[岩元素伤害]，如果【sts2027】在场，就使此伤害+2。', 3, 6, 3, 6, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/a/a7/3s4vt3i6mu5kopy55xern2tdvq2tl2a.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/2930a6e689cea53607ab586a8cde8c97_8943298426488751810.png',
    //     ], event => {
    //         const { hero: { outStatus } } = event;
    //         return { addDmgCdt: isCdt(outStatus.some(sts => sts.id == 2027), 2) };
    //     })
    // ]),

    // 1502: () => new GIHero(1502, '诺艾尔', 1, 10, 6, 2,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/e985b9bc4ec19c9e982c5b018ebbd74e_3315904207091435338.png',
    //     skill1('西风剑术·女仆'), [
    //     new GISkill('护心铠', '造成{dmg}点[岩元素伤害]，生成【sts2036】。', 2, 1, 3, 6, {}, [
    //         'https://patchwiki.biligame.com/images/ys/d/de/bfodvzfdm75orbjztzb2tu29vc1cr2f.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/1b0a3de6e27ee7758a947371fb4789ad_6207555536600733923.png',
    //     ], () => ({ status: [newStatus(2036)] })),
    //     new GISkill('大扫除', '造成{dmg}点[岩元素伤害]，本角色附属【sts2037】。', 3, 4, 4, 6, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/6/62/5drxd3veuo8k8peke518xe7kyfxl4yr.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e3847d4db2fd91fcd97388ab950598fd_6553932389060621914.png',
    //     ], () => ({ status: [newStatus(2037)] }))
    // ]),

    // 1503: () => new GIHero(1503, '荒泷一斗', 3, 10, 6, 2,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/0f6a96fb219e919f92c2768dd4a8d17d_2763599020845762537.png',
    //     skill1('喧哗屋传说'), [
    //     new GISkill('魔杀绝技·赤牛发破！', '造成{dmg}点[岩元素伤害]，召唤【smn3026】，本角色附属【sts2068】。', 2, 1, 3, 6, {}, [
    //         'https://patchwiki.biligame.com/images/ys/a/a5/3jpx4gxudn54mk2ll6v5mxl0hqrt3e5.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/b4b64a69f56b22af463637781ef1c035_1284380292638397340.png',
    //     ], () => ({ summon: [newSummon(ver)(3026)], status: [newStatus(2068)] })),
    //     new GISkill('最恶鬼王·一斗轰临！！', '造成{dmg}点[岩元素伤害]，本角色附属【sts2069】。', 3, 4, 3, 6, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/0/08/al3ofu1w19zdogu1bf0pqvj7qjx9nc4.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/ba4c88cde04f2cd06944ddcda99c5475_7502957554265579801.png',
    //     ], () => ({ status: [newStatus(2069)] }))
    // ]),

    // 1504: () => new GIHero(1504, '钟离', 2, 10, 6, 5,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/025bfe8320c376254bec54a9507ad33a_604601120081367211.png',
    //     skill1('岩雨'), [
    //     new GISkill('地心', '造成{dmg}点[岩元素伤害]，召唤【smn3033】。', 2, 1, 3, 6, {}, [
    //         'https://patchwiki.biligame.com/images/ys/e/ee/k5fhv7fxeg9ofaauivue65iid8mh7ou.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/71af9d46cf47c0b17aabf4805341cfb2_8343080343050934571.png',
    //     ], () => ({ summon: [newSummon(ver)(3033)] })),
    //     new GISkill('地心·磐礴', '造成{dmg}点[岩元素伤害]，召唤【smn3033】，生成【sts2086】。', 2, 3, 5, 6, {}, [
    //         'https://patchwiki.biligame.com/images/ys/6/6b/4gtr1hu4msb4sulc3tpaq3k7uwvjo9d.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d89ebbeba3f31335d3ccf495fa29adf6_1138994566223638735.png',
    //     ], () => ({ summon: [newSummon(ver)(3033)], status: [newStatus(2086)] })),
    //     new GISkill('天星', '造成{dmg}点[岩元素伤害]，目标角色附属【sts2087】。', 3, 4, 3, 6, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/a/a3/isu08rwkjyir4rbkc3rk2bk15ko8y7a.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/03c6245c3468e7d518e1292ac0f22c5a_8147918389515243613.png',
    //     ], () => ({ statusOppo: [newStatus(2087)] }))
    // ]),

    // 1505: () => new GIHero(1505, '阿贝多', 1, 10, 6, 1,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/08/12/82503813/5ec1824cea9aad20a4e2ddca9f4b090e_8072421465872569194.png',
    //     skill1('西风剑术·白'), [
    //     new GISkill('创生法·拟造阳华', '召唤【smn3040】。', 2, 0, 3, 6, {}, [
    //         'https://patchwiki.biligame.com/images/ys/4/49/7juclt9sdhys5cqpsszabbcgvr80onv.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/d74358fdddc26940e736836760dd7c94_829927587434288065.png',
    //     ], () => ({ summon: [newSummon(ver)(3040)] })),
    //     new GISkill('诞生式·大地之潮', '造成{dmg}点[岩元素伤害]。如果【3040】在场，就使此伤害+2。', 3, 4, 3, 6, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/b/b7/jtvi7qufpjdnlob7t4vj8afpbqxi9w8.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/75d7ab3b57d9db6cee911be55e21a4a0_3851331594331778687.png',
    //     ], event => {
    //         const { summons = [] } = event;
    //         return { addDmgCdt: isCdt(summons.some(smn => smn.id == 3040), 2) };
    //     })
    // ]),

    // 1506: () => new GIHero(1506, '五郎', 3, 10, 6, 3,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/a7a11aafd2166bd18514eb85107bbe6f_8372190332816763613.png',
    //     skill1('呲牙裂扇箭'), [
    //     new GISkill('犬坂吠吠方圆阵', '造成{dmg}点[岩元素伤害]，生成【sts2135】。', 2, 2, 3, 6, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/82cfdcfa18c2ac51c7d7c80ad271b850.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/3d25c8d7ea6541f2b0873f0dad5892a0_8644416094552727288.png',
    //     ], () => ({ status: [newStatus(2135)] })),
    //     new GISkill('兽牙逐突形胜战法', '造成{dmg}点[岩元素伤害]，生成【sts2135】，召唤【smn3050】。', 3, 2, 3, 6, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/0d85c76bf3b545043bed5237d3713569.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/44d2af6450e8e7b56f1108e96609754c_6106169218939314736.png',
    //     ], () => ({ status: [newStatus(2135)], summon: [newSummon(ver)(3050)] }))
    // ]),

    // 1507: () => new GIHero(1507, '云堇', 2, 10, 6, 5,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/1d2e9fbd3e021de0c2e944e9c3dbfab3_8286048443691981221.png',
    //     skill1('拂云出手'), [
    //     new GISkill('旋云开相', '生成【sts2198】，本角色附属【sts2200】并[准备技能]：【rsk21】。', 2, 0, 3, 6, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/1800fefaf04f62c348cfecf558a0d573.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/9653b6a5d3fda17c3e8443962584b311_4509508959084319555.png',
    //     ], () => ({ status: [newStatus(2198), newStatus(2200), newStatus(2201)] })),
    //     new GISkill('破嶂见旌仪', '造成{dmg}点[岩元素伤害]，生成3层【sts2198】。', 3, 2, 3, 6, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/4fbd00e2cf6f2931fdf7c1d3c3f3d196.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/289c56363620f16b7372fc097b9a9883_846777564977909040.png',
    //     ], () => ({ status: [newStatus(2198, 3)] }))
    // ]),

    // 1508: () => new GIHero(1508, '娜维娅', [5, 11], 10, 6, 2,
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Char_Avatar_Navia.webp',
    //     skill1('直率的辞绝'), [
    //     new GISkill('典仪式晶火', '造成{dmg}点[岩元素伤害]，本角色附属【sts2008,6】; 从手牌中[舍弃]至多5张【crd913】，每[舍弃]1张都使此伤害+1并摸1张牌。', 2, 3, 3, 6, {}, [
    //         '',
    //         '',
    //     ], event => {
    //         const { hcards = [] } = event;
    //         const cnt = Math.min(5, hcards.filter(c => c.id == 913).length);
    //         return { addDmgCdt: cnt, status: [newStatus(2008, 6)], cmds: [{ cmd: 'discard', cnt, card: 913 }, { cmd: 'getCard', cnt }] }
    //     }),
    //     new GISkill('如霰澄天的鸣礼', '造成{dmg}点[岩元素伤害]，对所有敌方后台角色造成1点[穿透伤害]。召唤【smn3067】，生成1张【crd913】加入手牌。', 3, 1, 3, 6, { ec: 2 }, [
    //         '',
    //         '',
    //     ], () => ({ pdmg: 1, summon: [newSummon(ver)(3067)], cmds: [{ cmd: 'getCard', cnt: 1, card: 913 }] })),
    //     new GISkill('互助关系网', '【敌方角色受到结晶反应伤害后：】生成3张【crd913】，随机置入我方牌库中。', 4, 0, 0, 0, {}, [
    //         '',
    //         '',
    //     ], () => ({ trigger: ['el6Reaction'], cmds: [{ cmd: 'addCard', cnt: 3, card: 913 }] }))
    // ]),

    // 1601: () => new GIHero(1601, '柯莱', 4, 10, 7, 3,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/cca275e9c7e6fa6cf61c5e1d6768db9d_4064677380613373250.png',
    //     skill1('祈颂射艺'), [
    //     new GISkill('拂花偈叶', '造成{dmg}点[草元素伤害]。', 2, 3, 3, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/1/17/pr0uli0a3fs8r3qiotnnx0ikaeudmw4.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/1bfdd645a02ea655cf3d4fa34d468a36_6197207334476477244.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         if (talentSlot == null && card?.id != 711) return;
    //         return { outStatusPre: [newStatus(2028)] };
    //     }),
    //     new GISkill('猫猫秘宝', '造成{dmg}点[草元素伤害]，召唤【smn3009】。', 3, 2, 3, 7, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/c/ca/hthhze7cs9vq6uazr06lqu2dhserw7n.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/0b58649d9870ae67b3e956820f164d6f_5553345163926201274.png',
    //     ], () => ({ summon: [newSummon(ver)(3009)] }))
    // ]),

    // 1602: () => new GIHero(1602, '提纳里', 4, 10, 7, 3,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/33a72f8ddf94c32c750dd7c5c75d928e_176590332162344255.png',
    //     skill1('藏蕴破障'), [
    //     new GISkill('识果种雷', '造成{dmg}点[草元素伤害]，本角色附属【sts2071】。', 2, 2, 3, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/31/s5y6cir0ywerb7tr4jf6wol6c04853j.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/2c6ed232f35902bac751007dfa939cd5_4160841179457575513.png',
    //     ], () => ({ status: [newStatus(2071)] })),
    //     new GISkill('造生缠藤箭', '造成{dmg}点[草元素伤害]，对所有敌方后台角色造成1点[穿透伤害]。', 3, 4, 3, 7, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/5/51/b0eieymbvfevi1ai796ect5s4eg9t84.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/417d1805fd1254e78a4b04530e33e066_3564804613469935798.png',
    //     ], () => ({ pdmg: 1 }))
    // ]),

    // 1603: () => new GIHero(1603, '纳西妲', 4, 10, 7, 4,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/7bd8cbd84e026de8af13599573750f63_9093638409228219545.png',
    //     skill1('行相'), [
    //     new GISkill('所闻遍计', '造成{dmg}点[草元素伤害]，目标角色附属【sts2088】; 如果在附属前目标角色已附属有【sts2088】，就改为对所有敌方角色附属【sts2088】。', 2, 2, 3, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/8/8b/hfb5j6xnze5j5e5tmixhieq59y78fwn.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ca47312e3d57bc47516b703e9a7d5615_6453606035541146217.png',
    //     ], event => {
    //         const { eheros = [], heros = [] } = event;
    //         const hidxs = isCdt(eheros.find(h => h.isFront)?.inStatus.some(ist => ist.id == 2088), allHidxs(heros));
    //         return { inStatusOppoPre: [newStatus(2088)], hidxs };
    //     }),
    //     new GISkill('所闻遍计·真如', '造成{dmg}点[草元素伤害]，所有敌方角色附属【sts2088】。', 2, 3, 5, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/6/64/qq68p4qre9yxfhxkn97q9quvgo3qbum.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d30e1ee8bc69a2235f36b74ddda3832b_8853500709483692571.png',
    //     ], event => ({ inStatusOppoPre: [newStatus(2088)], hidxs: allHidxs(event.heros) })),
    //     new GISkill('心景幻成', '造成{dmg}点[草元素伤害]，生成【sts2089】。', 3, 4, 3, 7, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/b/b2/hiqeufp1d8c37jqo8maxpkvjuiu32lq.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ab5d92e19144f4e483bce180409d0ecf_4393685660579955496.png',
    //     ], event => {
    //         const { hero: { talentSlot, inStatus }, card, heros = [], eheros = [] } = event;
    //         const isTalent = talentSlot != null || card?.id == 745;
    //         const elements = heros.filter(h => h.hp > 0).map(h => h.element);
    //         if (elements.includes(3) && isTalent && inStatus.every(ist => ist.id != 2089)) {
    //             eheros.forEach(h => {
    //                 const ist2088 = h.inStatus.find(ist => ist.id == 2088);
    //                 if (ist2088) ++ist2088.useCnt;
    //             });
    //         }
    //         return { status: [newStatus(2089, isTalent && elements.includes(1))] }
    //     })
    // ]),

    // 1604: () => new GIHero(1604, '瑶瑶', 2, 10, 7, 5,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/a351e4595bfcbec661319951fd9bc7c1_739695784762644208.png',
    //     skill1('颠扑连环枪'), [
    //     new GISkill('云台团团降芦菔', '召唤【smn3042】。', 2, 0, 3, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/b/b9/1kp0f3qy6c5glhcphgbxi3nze2nq695.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/73c9611548f96cbcaaa820548576ff81_266542015961172436.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = talentSlot != null || card?.id == 757;
    //         return { summon: [newSummon(ver)(3042, isTalent)] }
    //     }),
    //     new GISkill('云颗珊珊月中落', '造成{dmg}点[草元素伤害]，生成【sts2104】。', 3, 1, 4, 7, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/6/6e/34fahwmjls4qg1gnq2ew4v0mdxa2hqg.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/f364530033902093e271b5b3b26c0018_6031597060341810921.png',
    //     ], () => ({ status: [newStatus(2104)] }))
    // ]),

    // 1605: () => new GIHero(1605, '白术', 2, 10, 7, 4,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/0251f3d9b514e6971ccb10284a9340a9_5804585615005847738.png',
    //     skill1('金匮针解'), [
    //     new GISkill('太素诊要', '造成{dmg}点[草元素伤害]，召唤【smn3046】。', 2, 1, 3, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/5/54/7wvszy5h117tqsmaz7xs3bejqswdhvb.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/9b90e33f91378f8e5870959f184d5d44_8164440439409077402.png',
    //     ], () => ({ summon: [newSummon(ver)(3046)] })),
    //     new GISkill('愈气全形论', '生成【sts2113】和【sts2114】。', 3, 0, 4, 7, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/b/b9/6hkbfzw7gp37q857d9cz779lqrctziz.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/1cd096e52394a3e30c8617e8025e23f4_7844475516100755523.png',
    //     ], () => ({ status: [newStatus(2113), newStatus(2114)] }))
    // ]),

    // 1606: () => new GIHero(1606, '艾尔海森', 4, 10, 7, 1,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/2b1b835110bfe23777d9e9a19a010c4b_6565453178979267276.png',
    //     skill1('溯因反绎法'), [
    //     new GISkill('共相·理式摹写', '造成{dmg}点[草元素伤害]，本角色附属【sts2136】。', 2, 2, 3, 7, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/02a567f5717fcd6351cb861142722369.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/66d0bbacd89e3b8c5ffe2ffb8bd88fb8_8269978882036661533.png',
    //     ], () => ({ status: [newStatus(2136)] })),
    //     new GISkill('殊境·显象缚结', '造成{dmg}点[草元素伤害]。消耗【sts2136】，此伤害提升所消耗【sts2136】的持续回合值。如果消耗【sts2136】的持续回合为0/1/2，则为角色附属持续回合为3/2/1的【sts2136】。', 3, 4, 3, 7, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/7d8db8835772773ef227796ba9955c31.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/3e3c04e07682dde6272b8569f39e7359_862983076929139931.png',
    //     ], event => {
    //         const { hero: { inStatus, talentSlot }, card } = event;
    //         const sts2136 = inStatus.find(ist => ist.id == 2136);
    //         const isTalent = (!!talentSlot || card?.id == 766) && !!sts2136;
    //         const rcnt = sts2136?.roundCnt ?? 0;
    //         return {
    //             status: isCdt(!sts2136, [newStatus(2136, 3 - (isTalent ? 0 : rcnt))]),
    //             addDmgCdt: rcnt,
    //             cmds: isCdt(isTalent, [{ cmd: 'getCard', cnt: 1 }]),
    //             exec: () => {
    //                 if (sts2136) sts2136.roundCnt = 3 - (isTalent ? 0 : rcnt);
    //             }
    //         }
    //     })
    // ]),

    // 1607: () => new GIHero(1607, 336, '绮良良', 3, 10, 7, 1,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/650f884967057168a0b9b4025a032c11_2097188456727270580.png',
    //     skill1('箱纸切削术'), [
    //     new GISkill('呜喵町飞足', '生成【sts2167】和【sts2168】。', 2, 0, 3, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/e/e6/t5pihmh5sg8ccu6nm7stvb71maxxz9x.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/f19df62c04e80071c2278ae5ef2f21ff_8786745388682460864.png',
    //     ], () => ({ status: [newStatus(2167), newStatus(2168)] })),
    //     new GISkill('秘法·惊喜特派', '造成{dmg}点[草元素伤害]，在敌方场上生成【sts2169】。', 3, 4, 3, 7, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/9/9a/dbkhj9brr5xbkjgx56nabv1dgk7gxio.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/562bc0909575afbc29f1971ae2c4b24d_5181008040290623097.png',
    //     ], () => ({ statusOppo: [newStatus(2169)] }))
    // ]),

    // 1608: () => new GIHero(1608, '卡维', 4, 10, 7, 2,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/2879f08ce85d5ab6c5b69e8e729923e5_5879182844975848941.png',
    //     skill1('旋规设矩'), [
    //     new GISkill('画则巧施', '造成{dmg}点[草元素伤害]，生成【sts2202】。', 2, 2, 3, 7, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/1ae339d4c664e477455b738f1bbb52ed.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/c16266bb9d15e3d2f72b5c9928d8c3da_4617658453359064497.png',
    //     ], () => ({ status: [newStatus(2202)] })),
    //     new GISkill('繁绘隅穹', '造成{dmg}点[草元素伤害]，本角色附属【sts2203】，生成2层【sts2202】。', 3, 3, 3, 7, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/203718fd9317e4c089e8ae572c04e40e.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/40b352ac9244264e9eecf3413512fae2_1420990360545160672.png',
    //     ], () => ({ status: [newStatus(2203), newStatus(2202, 2)] }))
    // ]),

    // 1701: () => new GIHero(1701, '愚人众·冰萤术士', 8, 10, 4, 0,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/549d1869ad1f7d1d27fb5c733a239373_8053361497142459397.png',
    //     skill1('冰萤棱锥', 4), [
    //     new GISkill('虚雾摇唤', '造成{dmg}点[冰元素伤害]，召唤【smn3034】。', 2, 1, 3, 4, {}, [
    //         'https://patchwiki.biligame.com/images/ys/6/63/ba46nzqmjmyf97k0w9u5f70ll5b6xwh.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a2577774e5f89006d35488e99dc15531_1749914171755434787.png',
    //     ], () => ({ summon: [newSummon(ver)(3034)] })),
    //     new GISkill('冰枝白花', '造成{dmg}点[冰元素伤害]，本角色[附着冰元素]，生成【sts2090】。', 3, 5, 3, 4, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/5/54/1wmf5ct2ccet6bltjvkqs03jusibbrs.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/1368416ac693a1e50e703e92d93d2043_1088350178906732314.png',
    //     ], event => {
    //         const { summons = [] } = event;
    //         const useCnt = summons.find(smn => smn.id == 3034)?.useCnt ?? 0;
    //         return { isAttach: true, status: [newStatus(2090, useCnt)] }
    //     })
    // ]),

    // 1702: () => new GIHero(1702, 277, '「女士」', 8, 10, 4, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/f5904898779c5de0fd9cf2f207f5d2f8_1917054016449064269.png',
    //     skill1('霜锋霰舞', 4), [
    //     new GISkill('凛冽之刺', '造成{dmg}点[冰元素伤害]，目标角色附属【sts2137】。', 2, 2, 3, 4, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/887fc71fd182117241270c692d12a2de.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/fcd147fbb1603eebf7574496af8424df_6173017475342647286.png',
    //     ], () => ({ statusOppo: [newStatus(2137)] })),
    //     new GISkill('红莲冰茧', '造成{dmg}点[冰元素伤害]，治疗本角色2点。移除【sts2138】，本角色永久转换为[｢焚尽的炽炎魔女｣]形态。', 3, 4, 3, 4, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/d6cc71f74d274ae4cf0255b403cfb4da.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/ed3c25462958e78b9156b668a319bc7a_1717048070002778416.png',
    //     ], () => ({ heal: 2 })),
    //     new GISkill('邪眼之威', '战斗开始时，初始附属【sts2138】。', 4, 0, 0, 0, {},
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/ed9acfc03544bd410106bc9bd50f3c49.png',
    //         () => ({ trigger: ['game-start'], status: [newStatus(2138)] }))
    // ]),

    // 1703: () => new GIHero(1703, 321, '无相之冰', 0, 8, 4, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/452f63cf4e88b83a99bb781e8ae34122_3507980204838910528.png',
    //     skill1('冰锥迸射', 4), [
    //     new GISkill('圆舞冰环', '造成{dmg}点[冰元素伤害]，本角色附属【sts2156】。', 2, 3, 3, 4, {}, [
    //         'https://patchwiki.biligame.com/images/ys/9/9d/ff2hpksrbxpfe1wl6iyzcmw44521jmy.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/67efe676784e835017414a7d5e0d4355_8823792902089803501.png',
    //     ], () => ({ status: [newStatus(2156)] })),
    //     new GISkill('冰棱轰坠', '造成{dmg}点[冰元素伤害]，对所有敌方后台角色造成1点[穿透伤害]，召唤【smn3054】。', 3, 2, 3, 4, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/7/70/2cn3ntlfdulqls3gpsmmm54w8hxk97t.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/6f1d186efcaa3d682cbea2a1009fddfa_3844365324429029242.png',
    //     ], () => ({ pdmg: 1, summon: [newSummon(ver)(3054)] })),
    //     new GISkill('冰晶核心', '战斗开始时，初始附属【sts2157】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/f/fd/mgyby1c37lbykdol0uuyzduyugfmb0f.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/5e08c69f4911a028c4a559c1de33a4d9_7840872634290634295.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2157)] }))
    // ]),

    // 1704: () => new GIHero(1704, '愚人众·霜役人', 8, 10, 4, 0,
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Char_Monster_EscadronIce.webp',
    //     skill1('迅捷剑锋'), [
    //     new GISkill('霜刃截击', '造成{dmg}点[冰元素伤害]。', 2, 3, 3, 4, {}, [
    //         '',
    //         '',
    //     ]),
    //     new GISkill('掠袭之刺', '造成{dmg}点[冰元素伤害]，本角色附属【sts2220】。', 3, 4, 3, 4, { ec: 2 }, [
    //         '',
    //         '',
    //     ], () => ({ status: [newStatus(2220)] })),
    //     new GISkill('血契掠影', '【本角色使用技能后：】对敌方出战角色附属[可用次数]为(本技能最终伤害值-2)的【sts2221】。(最多5层)', 4, 0, 0, 0, {}, [
    //         '',
    //         '',
    //     ], event => {
    //         const { dmg = [], hero: { talentSlot }, card, eheros = [] } = event;
    //         let fdmg = Math.min(5, Math.max(0, dmg.reduce((a, b) => a + b, 0) - 2));
    //         if (talentSlot || card?.id == 795) {
    //             const ocnt = eheros.find(h => h.isFront)?.inStatus.find(ist => ist.id == 2221)?.useCnt ?? 0;
    //             const fcnt = (ocnt + fdmg) * 2;
    //             fdmg = fcnt - ocnt;
    //         }
    //         if (fdmg <= 0) return;
    //         return { trigger: ['skill'], status: [newStatus(2221, fdmg)] }
    //     })
    // ]),

    // 1721: () => new GIHero(1721, '纯水精灵·洛蒂娅', 0, 10, 1, 0,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/322de5ae9b660a9bf16eb96908949f20_6864460867288429831.png',
    //     skill1('翻涌', 4), [
    //     new GISkill('纯水幻造', '随机召唤1种【纯水幻形】。(优先生成不同的类型，召唤区最多同时存在两种【纯水幻形】)', 2, 0, 3, 1, { expl: ['smn3016', 'smn3017', 'smn3018'] }, [
    //         'https://patchwiki.biligame.com/images/ys/9/94/fh1ril80gsejz0l84u6siiq6lz6tlkr.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/3e2457b116526a30a834120f8c438ca6_2477510128488129478.png',
    //     ], event => {
    //         const { summons = [] } = event;
    //         const pools = [3016, 3017, 3018].filter(smnid => summons.every(smn => smn.id != smnid));
    //         if (pools.length == 1) {
    //             pools.length = 0;
    //             pools.push(...[3016, 3017, 3018].filter(smnid => summons.some(smn => smn.id == smnid)));
    //         }
    //         const summonId = pools[Math.floor(Math.random() * pools.length)];
    //         return { summon: [newSummon(ver)(summonId)] }
    //     }),
    //     new GISkill('林野百态', '随机召唤2种【纯水幻形】。(优先生成不同的类型，召唤区最多同时存在两种【纯水幻形】)', 2, 0, 5, 1, { expl: ['smn3016', 'smn3017', 'smn3018'] }, [
    //         'https://patchwiki.biligame.com/images/ys/c/c6/bci7cin5911l7uqva01dft0ak44a1jo.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6924bae6c836d2b494b5a172da6cfd70_4019717338422727435.png',
    //     ], event => {
    //         const { summons = [] } = event;
    //         const pools = [3016, 3017, 3018].filter(smnid => summons.every(smn => smn.id != smnid));
    //         if (pools.length == 1) {
    //             pools.length = 0;
    //             pools.push(...[3016, 3017, 3018].filter(smnid => summons.some(smn => smn.id == smnid)));
    //             return { summon: [newSummon(ver)(pools[0]), newSummon(ver)(pools[1])] }
    //         }
    //         let summonId1 = -1;
    //         if (pools.length == 2) {
    //             summonId1 = [3016, 3017, 3018].find(smnid => !pools.includes(smnid)) ?? -1;
    //         }
    //         if (pools.length == 3) {
    //             summonId1 = pools[Math.floor(Math.random() * pools.length)];
    //             pools.splice(pools.indexOf(summonId1), 1);
    //         }
    //         const summonId2 = pools[Math.floor(Math.random() * pools.length)];
    //         return { summon: [newSummon(ver)(summonId1), newSummon(ver)(summonId2)] }
    //     }),
    //     new GISkill('潮涌与激流', '造成{dmg}点[水元素伤害]; 我方每有1个召唤物，再使此伤害+1。', 3, 4, 3, 1, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/3/3b/8nz5w00ylo8dxpa8gt93f4d6ldjs5d2.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/37dedea23dfa78e8fb4e356bb4a4bed4_1738280724029210097.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card, summons = [] } = event;
    //         if (!!talentSlot || card?.id == 721) summons.forEach(smn => ++smn.useCnt);
    //         return { addDmgCdt: summons.length }
    //     })
    // ]),

    // 1722: () => new GIHero(1722, '愚人众·藏镜仕女', 8, 10, 1, 0,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3fc3ca86fcfc5333343aed2bb93f972c_2058660383709712628.png',
    //     skill1('水弹', 4), [
    //     new GISkill('潋波绽破', '造成{dmg}点[水元素伤害]，目标角色附属【sts2043】。', 2, 2, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/b/bb/ejgc07c2acyw7emun013j336cvmksvt.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/72eb60be8d1a88f12671264e29101ad4_5912821621104766081.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 722;
    //         return { statusOppo: [newStatus(2043, isTalent)] }
    //     }),
    //     new GISkill('粼镜折光', '造成{dmg}点[水元素伤害]。', 3, 5, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/8/80/1dsnenenx6cm0ojaln742iwx60rzc1r.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/9bd9b0f4cad85c234146ef15518ee57e_5116572838966914686.png'])
    // ]),

    // 1723: () => new GIHero(1723, '深渊使徒·激流', 0, 6, 1, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/8e4f28eaf527a26d7b014eed8ee0f966_202629246380655977.png',
    //     skill1('波刃锋斩'), [
    //     new GISkill('洄涡锋刃', '造成{dmg}点[水元素伤害]，然后[准备技能]：【rsk19】。', 2, 2, 3, 1, {}, [
    //         'https://patchwiki.biligame.com/images/ys/2/24/t9ua2iv40wm0f3yig6vxig7onh3up3n.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/84c980b8b25210d2cd1bd9d2377cd932_6861846186263087638.png',
    //     ], () => ({ status: [newStatus(2179)] })),
    //     new GISkill('激流强震', '造成{dmg}点[水元素伤害]，在对方场上生成【sts2180】。', 3, 3, 3, 1, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/d/d8/oiwyudqa0jod9q7e41b6gsk3ok9g4b8.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/190ea01a320f9023eee1656e09528bb2_8501522101938982601.png',
    //     ], () => ({ statusOppo: [newStatus(2180)] })),
    //     new GISkill('水之新生', '战斗开始时，初始附属【sts2181】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/b/bc/361y0pjxizeur4u3r6dolnbu9hdc12m.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/9783051b9763b8f81a40693a8581356b_6481810639931260223.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2181)] }))
    // ]),

    // 1724: () => new GIHero(1724, '吞星之鲸', 0, 5, 1, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/17c1739ef970603be767fa88764fc44f_4845015785088476307.png',
    //     skill1('碎涛旋跃'), [
    //     new GISkill('迸落星雨', '造成{dmg}点[水元素伤害]，此角色每有3点【无尽食欲】提供的额外最大生命，此伤害+1(最多+5)。然后[舍弃]1张原本元素骰费用最高的手牌。', 2, 1, 3, 1, { expl: ['sts2205'] }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f5c0f89cf02925ec13e306d11a5f7bd8.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/942e3d28310f4395ee7e3f1580268db8_512199522496433076.png',
    //     ], event => {
    //         const { hero: { inStatus } } = event;
    //         return {
    //             addDmgCdt: Math.min(5, Math.floor((inStatus.find(ist => ist.id == 2217)?.useCnt ?? 0) / 3)),
    //             cmds: [{ cmd: 'discard', element: 0 }],
    //         }
    //     }),
    //     new GISkill('横噬鲸吞', '造成{dmg}点[水元素伤害]，对敌方所有后台角色造成1点[穿透伤害]。召唤【smn3062】。', 3, 1, 3, 1, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/347f4286f0891f1b6937c9ac8cf5b1f7.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/4a25287ec5707c0cbcdfa997c1621224_1686936517736141335.png',
    //     ], event => {
    //         const { hero: { outStatus } } = event;
    //         const sts2205 = outStatus.find(ost => ost.id == 2205);
    //         if (!sts2205) return;
    //         const [, , dmg, cnt] = sts2205.addition;
    //         return { pdmg: 1, summon: [newSummon(ver)(3062, dmg, cnt)] }
    //     }),
    //     new GISkill('无尽食欲', '战斗开始时，生成【sts2205】。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/a9e29da334dce66803ef9edb13b8e8d9.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/66b604a5c6cc6b3ca21c5bee7bee28a5_2353476581760344471.png',
    //     ], () => ({ trigger: ['game-start', 'revive'], status: [newStatus(2205)] }))
    // ]),

    // 1741: () => new GIHero(1741, '愚人众·火之债务处理人', 8, 9, 2, 0,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9f134f05bb71f0ee1afb33785cf945e9_8487118119361104507.png',
    //     skill1('突刺'), [
    //     new GISkill('伺机而动', '造成{dmg}点[火元素伤害]，本角色附属【sts2044】。', 2, 1, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/36/rr6eiuoeleum3em795e7r1x687ielwb.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/3903202fe02b486f479ba7f8d32d8658_8665610180849380821.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const isTalent = !!talentSlot || card?.id == 723;
    //         return { status: [newStatus(2044, isTalent)] }
    //     }),
    //     new GISkill('焚毁之锋', '造成{dmg}点[火元素伤害]。', 3, 5, 3, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/5/5a/lz90owtayb7iw587z7ve8nfdfy8eysp.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/7cef125734bc7fb32e80c64c06e5f755_2159532089128773899.png']),
    //     new GISkill('潜行大师', '战斗开始时，初始附属【sts2044】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/7/7c/13bz5tmyohu7u0xeu56llgv6lp81vlv.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6c9ca6c9b2ecc89b7f6c4d5b6004afea_7794139484811179967.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2044)] }))
    // ]),

    // 1742: () => new GIHero(1742, '深渊咏者·渊火', 0, 6, 2, 0,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/1e2c28dfe8d5f14a70af6219a888432a_956783985247152270.png',
    //     skill1('拯救之焰', 4), [
    //     new GISkill('炽烈箴言', '造成{dmg}点[火元素伤害]。', 2, 3, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/b/bd/npp1xbnlyr7e4jn8mznv55dnm3wowxz.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/3090acc4a927cba996b6356f99db87d9_8220742127501145178.png']),
    //     new GISkill('天陨预兆', '造成{dmg}点[火元素伤害]，召唤【smn3036】。', 3, 3, 4, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/d/d3/7igqw47k9eg48907jvj0xqumreiav0v.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/dfa378fb6c635d91b99fcc65edcb0546_1724051858233871114.png',
    //     ], () => ({ summon: [newSummon(ver)(3036)] })),
    //     new GISkill('火之新生', '战斗开始时，初始附属【sts2092】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/f/fa/8adfhj3wss2apzgmrqqg3zz3cbi92tf.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/24722a3923aa2362a5ecdaa248a3f37b_100670191008092035.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2092)] }))
    // ]),

    // 1743: () => new GIHero(1743, 285, '镀金旅团·炽沙叙事人', 10, 10, 2, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/ccc5db5ede1a2303cc018e18995fbab1_2557032699772032384.png',
    //     skill1('烧蚀之光', 4), [
    //     new GISkill('炎晶迸击', '造成{dmg}点[火元素伤害]。', 2, 3, 3, 2, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/714623e3c2775d4e7cc1c78573e5443e.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/95c606e65f456edfec8a28c18f17f6cc_4264699545618649047.png']),
    //     new GISkill('厄灵苏醒·炎之魔蝎', '造成{dmg}点[火元素伤害]，召唤【smn3051】。', 3, 2, 3, 2, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/637396968147be2805479aebcbe5b825.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/84274abeb2c38f6f46c94dd2953323db_4939077374255699145.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card, summons = [] } = event;
    //         const isTalent = !!talentSlot || card?.id == 768;
    //         const isSmned = summons.some(smn => smn.id == 3051);
    //         return {
    //             summon: [newSummon(ver)(3051, isTalent)],
    //             status: isCdt(!isSmned, [newStatus(2139, isTalent ? 2 : 1)]),
    //         }
    //     }),
    //     new GISkill('厄灵之能', '【此角色受到伤害后：】如果此角色生命值不多于7，则获得1点[充能]。（整场牌局限制1次）。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/9262db8e7ec7952af306117cb67d668d.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/b9854a003c9d7e5b14bed92132391e9e_754640348498205527.png',
    //     ], event => {
    //         const { hero: { hp, skills: [, , , skill4], energy, maxEnergy }, getdmg = 0 } = event;
    //         if (hp - getdmg > 7 || energy >= maxEnergy || skill4.isUsed) return;
    //         return { trigger: ['getdmg'], cmds: [{ cmd: 'getEnergy', cnt: 1 }] }
    //     })
    // ]),

    // 1744: () => new GIHero(1744, '铁甲熔火帝皇', 0, 6, 2, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/e96a9a84bdc0f1d2171010770f0605f0_3000155239481283018.png',
    //     skill1('重钳碎击'), [
    //     new GISkill('烈焰燃绽', '造成{dmg}点[火元素伤害]; 如果本角色附属有至少7层【sts2182】，则此伤害+1。；然后，本角色附属2层【sts2182】。', 2, 1, 3, 2, {}, [
    //         'https://patchwiki.biligame.com/images/ys/e/ee/pkoq2y1juntwzekemn1cu1fiv9h5ed6.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/b73f1ffc4ba14fa027c3e36104bf7119_3142073596996390484.png',
    //     ], event => {
    //         const { hero: { inStatus } } = event;
    //         const sts2182Cnt = inStatus.find(ist => ist.id == 2182)?.useCnt ?? 0;
    //         return { addDmgCdt: isCdt(sts2182Cnt >= 7, 1), status: [newStatus(2182, 2)] }
    //     }),
    //     new GISkill('战阵爆轰', '本角色[准备技能]：【rsk20】。', 3, 0, 3, 2, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/1/13/i71orby9fhck49mknktqyvzdy8lgzse.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/5e576be9db73eed2272d0a78bad44763_3474057319865960269.png',
    //     ], () => ({ status: [newStatus(2183)] })),
    //     new GISkill('帝王甲胄', '战斗开始时：初始附属5层【sts2182】。；【我方执行任意行动后：】如果我方场上存在【sts2182】以外的[护盾]状态或[护盾]出战状态，则将其全部移除; 每移除1个，就使角色附属2层【sts2182】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/8/87/qph3kacdek5tjt4zh3awlfttsdtv5sm.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/ff758e8c9934e346c98ad5e864cc097e_6735052592007467103.png',
    //     ], event => {
    //         const { hero, heros = [], trigger = '' } = event;
    //         let stsCnt = 0;
    //         if (trigger == 'game-start') stsCnt = 5;
    //         else if (trigger == 'action-after') {
    //             heros.forEach(hero => stsCnt += [...hero.inStatus, ...hero.outStatus].filter(sts => sts.type.includes(7) && sts.id != 2182).length * 2);
    //             if (stsCnt > 0 && (hero.talentSlot?.perCnt ?? 0) > 0) stsCnt += 2;
    //         }
    //         if (stsCnt == 0) return;
    //         return {
    //             trigger: ['game-start', 'action-after'],
    //             status: isCdt(stsCnt > 0, [newStatus(2182, stsCnt)]),
    //             exec: () => {
    //                 if (trigger == 'game-start' || stsCnt == 0) return;
    //                 for (const hero of heros) {
    //                     hero.inStatus.forEach(ist => {
    //                         if (ist.type.includes(7) && ist.id != 2182) ist.useCnt = 0;
    //                     });
    //                     if (hero.isFront) {
    //                         hero.outStatus.forEach(ost => {
    //                             if (ost.type.includes(7)) ost.useCnt = 0;
    //                         });
    //                     }
    //                 }
    //                 if (stsCnt > 0 && hero.talentSlot && hero.talentSlot.perCnt > 0) --hero.talentSlot.perCnt;
    //             }
    //         }
    //     })
    // ]),

    // 1761: () => new GIHero(1761, '无相之雷', 0, 8, 3, 0,
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/df234a18db1aa6f769ac3b32b0168ebf_4040044349475544115.png',
    //     skill1('雷晶投射', 4), [
    //     new GISkill('猜拳三连击', '造成{dmg}点[雷元素伤害]，然后分别[准备技能]：【rsk2】和【rsk3】。', 2, 2, 5, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/0/03/gxbm4c2a3966ufxlvac2yh21cgawee6.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bb497b9de8d5f5aaecdecd8b54ad7113_1742166172951785514.png',
    //     ], () => ({ status: [newStatus(2117)] })),
    //     new GISkill('雳霆镇锁', '造成{dmg}点[雷元素伤害]，召唤【smn3035】。', 3, 2, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/8/8d/pol2fxnr3wl5u430iyzcgv9fzjpds1q.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/0a2d29c148c0c9dda778c3d8387ec4c8_6867523488576292893.png',
    //     ], () => ({ summon: [newSummon(ver)(3035)] })),
    //     new GISkill('雷晶核心', '战斗开始时，初始附属【sts2091】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/1/13/4tkgv2y83mfzyyum8iifx9wqsjfj8af.png',
    //         'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/84c224cb71bd755ebeb0ab587bf22901_3554738173380528607.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2091)] }))
    // ]),

    // 1762: () => new GIHero(1762, '雷音权现', 0, 10, 3, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/7577bb07bad6418da34d16e788e56dc7_5139467133099341814.png',
    //     skill1('轰霆翼斩', 4), [
    //     new GISkill('雷墙倾轧', '对附属有【sts2141】的敌方角色造成{dmg}点[雷元素伤害]。(如果敌方不存在符合条件角色，则改为对出战角色造成伤害)', 2, 3, 3, 3, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/1f1b73b917fc25ea3c71c08583037cb1.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/ca84fd08636d380d57da96f9a37e9e7f_7121937516609130674.png',
    //     ], event => {
    //         const { eheros = [] } = event;
    //         const sts2141 = eheros.findIndex(h => h.inStatus.some(ist => ist.id === 2141));
    //         if (sts2141 == -1) return;
    //         return { atkTo: sts2141 }
    //     }),
    //     new GISkill('轰雷禁锢', '造成{dmg}点[雷元素伤害]，召唤【smn3052】。', 3, 2, 3, 3, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/924d4e27f199d95cde09b26ce36d6e8b.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/eb2b0fb434298a92925563a640f462a9_5945618352718846846.png',
    //     ], () => ({ summon: [newSummon(ver)(3052)] })),
    //     new GISkill('雷霆探知', '战斗开始时，在敌方场上生成【sts2140】。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/85101cecf76e834437a758fc19093700.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/eb1d94ce0af17b97f756f8c126a5863a_674902409578889354.png',
    //     ], () => ({ trigger: ['game-start'], statusOppo: [newStatus(2140)] }))
    // ]),

    // 1763: () => new GIHero(1763, 322, '千年珍珠骏麟', 0, 8, 3, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/6ea12823806de2c2c7fe62d839410c8b_8031642621604475811.png',
    //     skill1('旋尾扇击'), [
    //     new GISkill('霞舞鱼群', '造成{dmg}点[雷元素伤害]。；【每回合1次：】如果本角色已附属【sts2158】，则使其[可用次数]+1。', 2, 3, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/3a/fej2c9u7kria1j2btaxy7f9o9k7uuyg.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/ba6b95e623fd861b69316a6f649d150c_90481026227323793.png',
    //     ], event => ({
    //         exec: () => {
    //             const { hero: { inStatus } } = event;
    //             const sts2158 = inStatus.find(ist => ist.id == 2158);
    //             if (sts2158) ++sts2158.useCnt;
    //         }
    //     })),
    //     new GISkill('原海古雷', '造成{dmg}点[雷元素伤害]，本角色附属【sts2158】，召唤【smn3055】。', 3, 1, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/1/1f/popxzd68zzf3mhig28gkekdxhef63zf.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/68b45e352424c4127c47bd9fdee5bd78_7983386802406853220.png',
    //     ], () => ({ status: [newStatus(2158)], summon: [newSummon(ver)(3055)] })),
    //     new GISkill('明珠甲胄', '战斗开始时，本角色附属【sts2158】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/f/fc/0v3wnltquhqgjaig2kp4o6qicrstkwl.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/34245e37e3d9881e1ac466ba3058fead_3899055182644035950.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2158)] }))
    // ]),

    // 1764: () => new GIHero(1764, 337, '愚人众·雷萤术士', 8, 10, 3, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/e7e0e8c1cab4d08764f95d14345c4eef_4303268682366227358.png',
    //     skill1('轰闪落雷', 4), [
    //     new GISkill('雾虚之召', '召唤【smn3057】。', 2, 0, 3, 3, {}, [
    //         'https://patchwiki.biligame.com/images/ys/b/ba/gyx575dg0jl0555jhw17pfr0kkge1dg.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/170a763eb069a3f4577b04dbeb73f3a7_245180266074223049.png',
    //     ], () => ({ summon: [newSummon(ver)(3057)], statusOppo: [newStatus(2175)] })),
    //     new GISkill('霆雷之护', '造成{dmg}点[雷元素伤害]，本角色[附着雷元素]，生成【sts2170】并[准备技能]：【rsk18】。', 3, 1, 3, 3, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/b/bb/qyleol8t4tzuujvuj3wlfk6h53icvcb.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/7ddbd6e73bea8f907590c964c2f88d98_2187578641261417207.png',
    //     ], event => {
    //         const { summons = [] } = event;
    //         const useCnt = summons.find(smn => smn.id == 3057)?.useCnt ?? 0;
    //         return { isAttach: true, status: [newStatus(2170, useCnt), newStatus(2171)] }
    //     })
    // ]),

    // 1765: () => new GIHero(1765, '圣骸毒蝎', [0, 13], 10, 3, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/379deb8c564c0af89f544ff6bab049d2_839388424690765015.png',
    //     skill1('蝎爪钳击'), [
    //     new GISkill('蝎尾锥刺', '造成{dmg}点[雷元素伤害]。；生成1张【crd906】，随机置入我方牌库顶部2张牌之中。', 2, 3, 3, 3, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/ba3107753a28bf55c7279482d9b0c9ed.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/0e1110651dbff69343c8e40bf3c7e93f_6498390434174190990.png',
    //     ], () => ({ cmds: [{ cmd: 'addCard', card: 906, cnt: 1, hidxs: [2] }] })),
    //     new GISkill('雷锥散射', '造成{dmg}点[雷元素伤害]，弃置手牌中最多3张【crd906】，在对方场上生成【sts2206】。', 3, 3, 3, 3, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/4d58f950df06a277f43a21dcdfa58eb0.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/54dc8816d5fb42528ba84eaefb1a8068_7565040194931804591.png',
    //     ], event => {
    //         const { hcards = [] } = event;
    //         const cnt = Math.min(3, hcards.filter(c => c.id == 906).length);
    //         if (cnt == 0) return;
    //         return { cmds: [{ cmd: 'discard', cnt, card: 906 }], statusOppo: [newStatus(2206, cnt)] }
    //     }),
    //     new GISkill('不朽亡骸·雷', '回合结束时，生成两张【crd906】，随机置入我方牌库顶部10张牌中。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f2c9fb8d451bc79e309ce9f397738a39.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/02cbaf22d48774e6e7cff5203e9562eb_9127079687708650066.png',
    //     ], () => ({ trigger: ['phase-end'], cmds: [{ cmd: 'addCard', card: 906, cnt: 2, hidxs: [10] }] }))
    // ]),

    // 1781: () => new GIHero(1781, '魔偶剑鬼', 0, 10, 5, 0,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/5b21d3abb8dd7245a8f5f540d8049fcb_59481287402207724.png',
    //     skill1('一文字'), [
    //     new GISkill('孤风刀势', '召唤【smn3019】。', 2, 0, 3, 5, {}, [
    //         'https://patchwiki.biligame.com/images/ys/f/f2/gucxzyumx6uaumg6r6ms4czbw32v3gt.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a72086131fbe3e03201926a46dac48f3_7155522304163694322.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         const cmds = isCdt<Cmds[]>(!!talentSlot || card?.id == 724, [{ cmd: 'switch-after', cnt: 2500 }]);
    //         return { summon: [newSummon(ver)(3019)], cmds }
    //     }),
    //     new GISkill('霜驰影突', '召唤【smn3020】。', 2, 0, 3, 4, {}, [
    //         'https://patchwiki.biligame.com/images/ys/1/17/a8qboxl35nar8vuaho1cewppy0fp43t.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6df8766388e62c6a97f9898605fb45e2_6047730151662669218.png',
    //     ], event => {
    //         const { hero: { talentSlot }, card } = event;
    //         return {
    //             summon: [newSummon(ver)(3020)],
    //             cmds: isCdt<Cmds[]>(!!talentSlot || card?.id == 724, [{ cmd: 'switch-before', cnt: 2500 }]),
    //         }
    //     }),
    //     new GISkill('机巧伪天狗抄', '造成{dmg}点[风元素伤害]，触发我方所有【剑影】召唤物效果。(不消耗其可用次数)', 3, 4, 3, 5, { ec: 3 }, [
    //         'https://patchwiki.biligame.com/images/ys/f/fd/ren7lbexbnyvrdvn0aqhbrxx6atdoov.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/75142675f9625abbe1d9686f1a7f59b7_6144574132276306286.png'])
    // ]),

    // 1782: () => new GIHero(1782, '特瓦林', 0, 10, 5, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/83ef329668e4d3f2521c712881a9a028_6040566226446903836.png',
    //     skill1('裂爪横击'), [
    //     new GISkill('暴风轰击', '造成{dmg}点[风元素伤害]，目标角色附属【sts2142】。', 2, 2, 3, 5, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/6d5115adf3c4273b26e05690e4222f51.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/8e44228dec3be9b4259aa2adb521583b_5399958061718053885.png',
    //     ], () => ({ statusOppo: [newStatus(2142)] })),
    //     new GISkill('风龙涤流', '造成{dmg}点[风元素伤害]，然后分别[准备技能]：【rsk6】和【rsk7】。', 2, 2, 5, 5, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/8b5ffe13741032cb75964df7fcec0fa2.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/d2d2168c6889018520e518229c610c7b_2627906278875893396.png',
    //     ], () => ({ status: [newStatus(2143)] })),
    //     new GISkill('终天闭幕曲', '造成{dmg}点[风元素伤害]，所有敌方后台角色附属【sts2142】。', 3, 5, 4, 5, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/dc176e73075e38839e1557815da53cc8.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/ea18fc2d49dac1d270821cc0f318aa9e_7299667602196853258.png',
    //     ], event => {
    //         const { eheros = [] } = event;
    //         return { statusOppo: [newStatus(2142)], hidxs: getBackHidxs(eheros) }
    //     })
    // ]),

    // 1783: () => new GIHero(1783, '圣骸飞蛇', [0, 13], 10, 5, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/39bdf909aff15f061d4d9ea3d4c2b2ab_472359532850721936.png',
    //     skill1('旋尾迅击'), [
    //     new GISkill('盘绕风引', '造成{dmg}点[风元素伤害]，摸1张【crd906】; 然后，手牌中每有1张【crd906】，摸1张牌(每回合最多摸2张)。', 2, 2, 3, 5, { pct: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/8c6ea09bfd6308bb23bf32d96d640487.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/20afc68783ad98f1da36cc3a5286bee6_5169119727722449200.png',
    //     ], event => {
    //         const { hcards = [], hero: { skills: [, skill1] } } = event;
    //         const cmds: Cmds[] = [{ cmd: 'getCard', cnt: 1, card: 906, isAttach: true }];
    //         let cnt = 0;
    //         if (skill1.perCnt > 0) {
    //             cnt = Math.min(skill1.perCnt, hcards.filter(c => c.id == 906).length + +(hcards.length < 10));
    //             cmds.push({ cmd: 'getCard', cnt });
    //         }
    //         return { cmds, exec: () => { skill1.perCnt -= cnt } }
    //     }),
    //     new GISkill('错落风涡', '造成{dmg}点[风元素伤害]，[舍弃]手牌中所有的【crd906】，每[舍弃]2张，此次伤害翻倍1次。', 3, 2, 3, 5, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/468894f96582f384ff87859549de0536.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/65225a24479d53ed9bbc0200d6786423_1124235468902631200.png',
    //     ], event => {
    //         const { hcards = [] } = event;
    //         const cnt = hcards.filter(c => c.id == 906).length;
    //         return { cmds: [{ cmd: 'discard', cnt, card: 906 }], multiDmgCdt: 2 ** Math.floor(cnt / 2) }
    //     }),
    //     new GISkill('不朽亡骸·风', '战斗开始时，生成6张【crd906】，均匀放入牌库。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/b20cdf60cef51f689592487d6587d353.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/3f113b01a3fbab406f2ddb81d9a2a019_675662049327994953.png',
    //     ], () => ({ trigger: ['game-start'], cmds: [{ cmd: 'addCard', cnt: 6, card: 906, element: 1 }] })),
    // ]),

    // 1801: () => new GIHero(1801, '丘丘岩盔王', [0, 9], 8, 6, 0,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/db05474f6bdc3a5080e141d72c876548_5712469579238063350.png',
    //     skill1('Plama Lawa'), [
    //     new GISkill('Movo Lawa', '造成{dmg}点[物理伤害]。', 2, 3, 3, 6, { de: 0 }, [
    //         'https://patchwiki.biligame.com/images/ys/2/25/8sausa1g74119xvltdmopivnxclkn4l.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e605c46abaca4c05ff7fcc803d318644_1932728961174964565.png']),
    //     new GISkill('Upa Shato', '造成{dmg}点[物理伤害]。', 3, 5, 3, 6, { ec: 2, de: 0 }, [
    //         'https://patchwiki.biligame.com/images/ys/e/ef/jc6xafunhp1qi3wcqemc5wir9d973px.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a63aaedd24cfbefc634b2ac2a77d5f4f_7864871648075602067.png']),
    //     new GISkill('魔化：岩盔', '战斗开始时，初始附属【sts2045】和【sts2046】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/3/3e/i50gzgkih3a45yl3df7hvq6143bw6r9.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/60d5501fc29ffb28bc6d2a435b463b2a_6974894146119719968.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2045), newStatus(2046)] }))
    // ]),

    // 1802: () => new GIHero(1802, '若陀龙王', 0, 10, 6, 0, [
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/521fdaa2d51e93166ccbf2a91a1047aa_2809827424052136166.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/e1688d349ca1ff0f5f78bb6bdae07b6f.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/8e7128d60419e53054de5daa1e096252.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/6bfb045422ca297b5ead653065fecfbe.png',
    //     'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/1dde94ee671e2a61b42ff051b816f490.png'],
    //     skill1('碎岩冲撞'), [
    //     new GISkill('磅礴之气', '造成{dmg}点[岩元素伤害]，如果发生了结晶反应，则角色[汲取对应元素的力量]。；如果本技能中角色未汲取元素的力量，则附属【sts2145】。', 2, 3, 3, 6, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/5ab059679b08fba559b68f7d361a64be.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/b49c1863d6b6a61ec13501c27d8204bf_1566255463657696734.png',
    //     ], event => {
    //         const { eheros = [], hero: { id, inStatus }, heros, isExec = false } = event;
    //         if (!isExec) return;
    //         const rockEl = eheros.find(h => h.isFront)?.attachElement?.find(el => el > 0 && el < 5) ?? 6;
    //         if (rockEl == 6) return { status: [newStatus(2145)] }
    //         const sts2153 = inStatus.find(ist => ist.id == 2153)!;
    //         return { ...heroStatus(2153).handle(sts2153, { heros, hidx: heros?.findIndex(h => h.id == id), trigger: `el6Reaction:${rockEl}` as Trigger })?.exec?.() }
    //     }),
    //     new GISkill('山崩毁阵', '造成{dmg}点[岩元素伤害]，每汲取过一种元素此伤害+1。', 3, 4, 3, 6, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/3eea73a1f50aaa9ab8f03546a0db4483.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/eeb2325a52556c0f9259eb3d47807c45_994928579787374692.png',
    //     ], event => ({ addDmgCdt: event.hero.inStatus.find(ist => ist.id == 2153)?.useCnt ?? 0 })),
    //     new GISkill('磐岩百相', '战斗开始时，初始附属【sts2153】。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/c7dc740570a4a65821767e0e2ba83529.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/3c29d28a60d100687cf9968a3a278e4d_5040009350976601315.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2153)] }))
    // ]),

    // 1821: () => new GIHero(1821, '翠翎恐蕈', 0, 10, 7, 0,
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/83e1eecf95f1e3ba10afad2e2a4de03c_4053328098702513548.png',
    //     skill1('菌王舞步'), [
    //     new GISkill('不稳定孢子云', '造成{dmg}点[草元素伤害]。', 2, 3, 3, 7, {}, [
    //         'https://patchwiki.biligame.com/images/ys/4/46/2tjoad0wz0qn966hqp6vvgfvi07izaf.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/875de1c4943f909a4adf7802bbb1034f_3081914478799274881.png']),
    //     new GISkill('尾羽豪放', '造成{dmg}点[草元素伤害]，消耗所有｢【sts2047】｣层数，每层使本伤害+1。', 3, 4, 3, 7, { ec: 2 }, [
    //         'https://patchwiki.biligame.com/images/ys/3/36/gyhrz87493bups3avpelhusplml11gw.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/34525ada2f131e99da075f32283db903_3717723304434052962.png',
    //     ], event => {
    //         const { hero: { inStatus } } = event;
    //         const sts2047 = inStatus.find(ist => ist.id == 2047);
    //         const addDmgCdt = sts2047?.useCnt ?? 0;
    //         if (sts2047) sts2047.useCnt = -1;
    //         return { addDmgCdt }
    //     }),
    //     new GISkill('活化激能', '战斗开始时，初始附属【sts2047】。', 4, 0, 0, 0, {}, [
    //         'https://patchwiki.biligame.com/images/ys/7/79/q3o61yegls3thng3z7dns2sykg2voci.png',
    //         'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/f72847095bda0ccb92781ed3f1c1bb4e_1629774298046012918.png',
    //     ], () => ({ trigger: ['game-start', 'revive'], status: [newStatus(2047)] }))
    // ]),

    // 1822: () => new GIHero(1822, '阿佩普的绿洲守望者', 0, 10, 7, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/59b3a5744a5e0cef3a742cf97ee1a48e_9222353554920937369.png',
    //     skill1('失乡重击'), [
    //     new GISkill('生命流束', '造成{dmg}点[草元素伤害]，摸1张【crd907】，生成1层【sts2209】。', 2, 2, 3, 7, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/a2598b6377145054026356571e3494d6.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/6b6af66686864e881e180633491577b7_1337053029698647969.png',
    //     ], () => ({ cmds: [{ cmd: 'getCard', cnt: 1, card: 907, isAttach: true }], status: [newStatus(2209)] })),
    //     new GISkill('终景迸落', '造成{dmg}点[草元素伤害]，摸1张【crd907】，生成2层【sts2209】。', 3, 2, 3, 7, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/e2b183c009d60ca57023829db15c23fb.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/67a564cb356fc0cfddb1f98658d35573_3718187889744663164.png',
    //     ], () => ({ cmds: [{ cmd: 'getCard', cnt: 1, card: 907, isAttach: true }], status: [newStatus(2209, 2)] })),
    //     new GISkill('增殖感召', '战斗开始时，生成6张【crd907】，随机放入牌库。我方召唤4个【smn3063】后，此角色附属【sts2210】，并获得2点[护盾]。', 4, 0, 0, 0, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/665265a425ebbddf512f6c93f35e725d.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/d5084bf33845c72c75d6b590a21b3f93_3778267969787494418.png',
    //     ], () => ({ trigger: ['game-start'], status: [newStatus(2216)] }))
    // ]),


    // 1851: () => new GIHero(1851, '焚尽的炽炎魔女', 8, 10, 2, 0,
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/36f1358533325d377d6a4e99eec5918f_6190662149106536998.png',
    //     skill1('红莲之蛾', 4), [
    //     new GISkill('烬灭之鞭', '造成{dmg}点[火元素伤害]，目标角色附属【sts2137,1】。', 2, 2, 3, 2, {}, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/fa766b02212311a6f0d15c0904b7af40.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/5ebe47ad42ad678785def13a30f485ad_5687308121190951050.png',
    //     ], () => ({ statusOppo: [newStatus(2137, 1)] })),
    //     new GISkill('燃焰旋织', '造成{dmg}点[火元素伤害]。', 3, 6, 3, 2, { ec: 2 }, [
    //         'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/1dee7d6a7c6efeb3621013c59f051c31.png',
    //         'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/456005ca57b543d460e516403de7dd7b_5879470454090240332.png'])
    // ]),

}

export const herosTotal = (version: Version = VERSION[0]) => {
    const heros: Hero[] = [];
    for (const idx in allHeros) {
        const hero = allHeros[idx]().version(version).done();
        if (hero.version > version) continue;
        if (hero.id > 6000) continue;
        heros.push(hero);
    }
    return heros;
}

export const newHero = (version: Version = VERSION[0]) => (id: number) => allHeros[id]?.().version(version).done() ?? NULL_HERO();

export const parseHero = (shareId: number) => herosTotal().find(h => h.shareId == shareId) ?? NULL_HERO();
