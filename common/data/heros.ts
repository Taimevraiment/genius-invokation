import { Cmds, Hero, Trigger } from '../../typing';
import { CMD_MODE, DAMAGE_TYPE, ELEMENT_TYPE, HERO_TAG, PureElementType, STATUS_TYPE, SWIRL_ELEMENT, VERSION, Version } from '../constant/enum.js';
import { NULL_HERO } from '../constant/init.js';
import { allHidxs, getBackHidxs, getMaxHertHidxs, getObjById, getObjIdxById, hasObjById } from '../utils/gameUtil.js';
import { isCdt } from '../utils/utils.js';
import { HeroBuilder } from './builder/heroBuilder.js';
import { NormalSkillBuilder, SkillBuilder } from './builder/skillBuilder.js';
import { skillTotal } from './skills.js';

// 11xx：冰
// 12xx：水
// 13xx：火
// 14xx：雷
// 15xx：风
// 16xx：岩
// 17xx：草
// 2xxx：原魔
// 6xxx：变换形态

const allHeros: Record<number, () => HeroBuilder> = {

    1101: () => new HeroBuilder(1).name('甘雨').offline('v1').liyue().cryo().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/195563531/e5c7d702f8033c4361f3b25a7f0b8b30_7432225060782505988.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u63dbg/a8c456eaabf9469d200b01e0a2f49bdd.png')
        .normalSkill(new NormalSkillBuilder('流天射术'))
        .skills(
            new SkillBuilder('山泽麟迹').description('{dealDmg}，生成【sts111012】。')
                .src('https://patchwiki.biligame.com/images/ys/f/f8/0pge9o51iepqfdd3n8zu9uxfmo08t4u.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/12109492/6e5de97b92327dc32895d68abb2f74ea_9018514544637920379.png')
                .elemental().damage(1).cost(3).handle(() => ({ status: 111012 })),
            new SkillBuilder('霜华矢').description('{dealDmg}，对所有敌方后台角色造成2点[穿透伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/d/de/d7vartodjuo8s7k0fkp6qsl09brzcvy.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/a4c1f60fc2461f2853edb4e765ba4262_6013693059397455292.png')
                .normal().damage(2).cost(5).handle(event => {
                    const { skill: { useCnt }, talent } = event;
                    return { pdmg: useCnt > 0 && talent ? 3 : 2 }
                }),
            new SkillBuilder('降众天华').description('{dealDmg}，对所有敌方后台角色造成1点[穿透伤害]，召唤【smn111011】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fc/jwj2u3ksefltv5hz9y5zjz3p1p7f8n7.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/12109492/c6917b506b4c303677c6246ee11049f3_937074104802749278.png')
                .burst(3).burst(2, 'v3.7.0').damage(2).damage(1, 'v3.7.0').cost(3).handle(() => ({ summon: 111011, pdmg: 1 }))
        ),

    1102: () => new HeroBuilder(2).name('迪奥娜').mondstadt().cryo().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/708ced07857094dd94314d65c9723360_8516852131632705389.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u63dbg/77a8563fd5083b309c14e2e89fd302d1.png')
        .normalSkill(new NormalSkillBuilder('猎人射术'))
        .skills(
            new SkillBuilder('猫爪冻冻').description('{dealDmg}，生成【sts111021】。')
                .src('https://patchwiki.biligame.com/images/ys/1/1e/293bqkk7gcer933p14viqh445sdwqzf.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/195563531/fc7cc8ae1d95bc094e69b8f3c1c270f8_1908586115904037757.png')
                .elemental().damage(2).cost(3).handle(event => ({ status: [[111021, !!event.talent]] })),
            new SkillBuilder('最烈特调').description('{dealDmg}，治疗此角色2点，召唤【smn111023】。')
                .src('https://patchwiki.biligame.com/images/ys/3/3a/gltxegl17e1mwhv3z3xdakycst8h5sg.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/195563531/d749ae8a4ce1c2693106ef4a39430ff7_1792825158969730188.png')
                .burst(3).damage(1).cost(3).handle(() => ({ summon: 111023, heal: 2 }))
        ),

    1103: () => new HeroBuilder(3).name('凯亚').mondstadt().cryo().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/161007a1aef385a3e9f4566702afef0b_7807393116480739426.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/4c4e0c95e68c8272388f781f38e2f410.png')
        .normalSkill(new NormalSkillBuilder('仪典剑术'))
        .skills(
            new SkillBuilder('霜袭').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/f/f6/bsd6rp5bwuwttd0pyo0ysn1dn39nesz.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/dbbef9e9d85229f503075f7b4ec5595a_1136270246875604440.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('凛冽轮舞').description('{dealDmg}，生成【sts111031】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b0/ozcnrn13ft9p6pe7tsamhik8lnp1dbk.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/250999f269669660e4fd24bdf510a507_2074342926999471449.png')
                .burst(2).damage(1).cost(4).handle(() => ({ status: 111031 }))
        ),

    1104: () => new HeroBuilder(4).name('重云').offline('v1').liyue().cryo().claymore()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/5192016de21d9f10eb851387bdf2ef39_3201745536478119133.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/c369d7851e6a8bf25acf7c515fb62b10.png')
        .normalSkill(new NormalSkillBuilder('灭邪四式'))
        .skills(
            new SkillBuilder('重华叠霜').description('{dealDmg}，生成【sts111041】。')
                .src('https://patchwiki.biligame.com/images/ys/9/95/l37dvsmjc6w2vpeue8xlpasuxwvdqga.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/90fe50a43ea7905773df4433d385e4d9_8501818730448316824.png')
                .elemental().damage(3).cost(3).handle(event => ({ status: [[111041, !!event.talent]] })),
            new SkillBuilder('云开星落').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/0/01/5vyck7f9rpns92tfop3r41xr1aats4u.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/0bddb45b9d91fb892ddaf2e8eb1e04a8_1565971516954358022.png')
                .burst(3).damage(7).cost(3)
        ),

    1105: () => new HeroBuilder(5).name('神里绫华').offline('v1').inazuma().cryo().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/755cad41d2f5d2cc97e7917ab53abd6a_8806486016418846297.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/ede96c5aba784f50bc86dc66e5b16b12.png')
        .normalSkill(new NormalSkillBuilder('神里流·倾'))
        .skills(
            new SkillBuilder('神里流·冰华').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/2/2b/loq6n32a0wpbs8cu4vji5iiyr5pxsui.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/da5da3bfc8c50c570b12b5410d0366d5_4795744347782351925.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('神里流·霜灭').description('{dealDmg}，召唤【smn111051】。')
                .src('https://patchwiki.biligame.com/images/ys/5/58/mcbp6hjwbi9pi7ux0cag1qrhtcod2oi.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/e590d8ed5ffda912275916a7885793e2_4175761153899718840.png')
                .burst(3).damage(4).cost(3).handle(() => ({ summon: 111051 })),
            new SkillBuilder('神里流·霰步').description('此角色被切换为｢出战角色｣时，附属【sts111052】。')
                .src('https://patchwiki.biligame.com/images/ys/b/bf/35ci2ri2f4j1n844qgcfu6mltipvy6o.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/0e41ec30bd552ebdca2caf26a53ff3c4_7388012937739952914.png')
                .passive().handle(event => {
                    const { hero: { talentSlot } } = event;
                    return { trigger: ['switch-to'], status: [[111052, 1, +!!talentSlot]] }
                })
        ),

    1106: () => new HeroBuilder(6).name('优菈').since('v3.5.0').mondstadt().cryo().claymore()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/4e77b64507209b6abb78b60b9f207c29_5483057583233196198.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/a3a5645e234da6457e28033a7418f63a.png')
        .normalSkill(new NormalSkillBuilder('西风剑术·宗室'))
        .skills(
            new SkillBuilder('冰潮的涡旋').description('{dealDmg}，如果角色未附属【sts111061】，则使其附属【sts111061】。')
                .src('https://patchwiki.biligame.com/images/ys/8/8a/q921jjp73rov2uov6hzuhh1ncxzluew.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/7cd81d9357655d9c620f961bb8d80b59_6750120717511006729.png')
                .elemental().damage(2).cost(3).handle(event => {
                    const { hero: { heroStatus } } = event;
                    return { status: isCdt(!hasObjById(heroStatus, 111061), 111061) }
                }),
            new SkillBuilder('凝浪之光剑').description('{dealDmg}，召唤【smn111062】。')
                .src('https://patchwiki.biligame.com/images/ys/a/aa/1qme7ho5ktg0yglv8mv7a2xf0i7w6fu.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/c17312b62a4b4cf7a5d3cfe0cccceb9c_3754080379232773644.png')
                .burst(2).damage(2).cost(3).handle(() => ({ summon: 111062 }))
        ),

    1107: () => new HeroBuilder(7).name('申鹤').since('v3.7.0').liyue().cryo().polearm()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/40d8984c2bd2fda810f0170394ac2729_1971286688556670312.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/6d96a0d3974c54a772259e72f9335ee4.png')
        .normalSkill(new NormalSkillBuilder('踏辰摄斗'))
        .skills(
            new SkillBuilder('仰灵威召将役咒').description('{dealDmg}，生成【sts111071】。')
                .src('https://patchwiki.biligame.com/images/ys/7/73/7826w7dfmnl3bypl1liwuqcu3907s7l.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/c7750c7dbf76e9e3dffa7df162028a4d_5325191736377199101.png')
                .elemental().damage(2).cost(3).handle(event => ({ status: [[111071, !!event.talent]] })),
            new SkillBuilder('神女遣灵真诀').description('{dealDmg}，召唤【smn111073】。')
                .src('https://patchwiki.biligame.com/images/ys/4/49/cquyhtfdkpk25f0sk3afsnb5j502yhk.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/89e2ed92b6352a5925652f421aaddbaa_7169125488313816137.png')
                .burst(2).damage(1).cost(3).handle(() => ({ summon: 111073 }))
        ),

    1108: () => new HeroBuilder(8).name('七七').since('v4.0.0').liyue().cryo().sword()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/12/258999284/e94e3710ff2819e5f5fd6ddf51a90910_7928049319389729133.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u060fg/c0bd5fd46a539c9d90b4f0470e26c154.png')
        .normalSkill(new NormalSkillBuilder('云来古剑法'))
        .skills(
            new SkillBuilder('仙法·寒病鬼差').description('召唤【smn111081】。')
                .src('https://patchwiki.biligame.com/images/ys/2/26/jd1wryrgs25urbr57sq2xnqd4ftpziw.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/08/12/258999284/8ef482a027dfd52ec96e07ce452c38ce_2112371814644076808.jpg')
                .elemental().cost(3).handle(() => ({ summon: 111081 })),
            new SkillBuilder('仙法·救苦度厄').description('{dealDmg}，生成【sts111082】。')
                .src('https://patchwiki.biligame.com/images/ys/6/6c/p0xq33l7riqu49e0oryu8p1pjg6vzyb.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/08/12/258999284/fbf260ac04da9e7eafa3967cd9bed42c_824806426983130530.jpg')
                .burst(3).damage(3).cost(3).handle(event => {
                    const { talent, heros = [] } = event;
                    const hidxs = allHidxs(heros, { isDie: true });
                    const isExecTalent = hidxs.length > 0 && talent && talent.perCnt > 0;
                    return {
                        status: 111082,
                        cmds: isCdt(isExecTalent, [{ cmd: 'revive', cnt: 2, hidxs }]),
                        exec: () => { isExecTalent && --talent.perCnt }
                    }
                })
        ),

    1109: () => new HeroBuilder(279).name('莱依拉').since('v4.3.0').sumeru().cryo().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/94b1677048ddaa84ab735bb8f90c209d_3451890112016676238.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/8f522e8496dfdb2636a6eb273fa153b7.png')
        .normalSkill(new NormalSkillBuilder('熠辉轨度剑'))
        .skills(
            new SkillBuilder('垂裳端凝之夜').description('生成【sts111091】和【sts111092】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f4992b1b1ccc7488e72d044a689add90.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/752935b8ac76b044a14e788b146542d9_8202062186002160885.png')
                .elemental().cost(3).handle(() => ({ statusPre: [111091, 111092] })),
            new SkillBuilder('星流摇床之梦').description('{dealDmg}，召唤【smn111093】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/890bd4e04afaa53a01d52fc1087c8da7.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/e419e8855adc7d838639a2dacb3be165_5717426653880544475.png')
                .burst(2).damage(3).cost(3).handle(() => ({ summon: 111093 }))
        ),

    1110: () => new HeroBuilder(334).name('夏洛蒂').since('v4.5.0').fontaine(HERO_TAG.ArkhePneuma).cryo().catalyst()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/0bad00e61b01e543de83347130cab711_7623245668285687441.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/f8260dca225e3d4def208ce068673d7c.png')
        .normalSkill(new NormalSkillBuilder('冷色摄影律'))
        .skills(
            new SkillBuilder('取景·冰点构图法').description('{dealDmg}，目标角色附属【sts111101】。')
                .src('https://patchwiki.biligame.com/images/ys/5/59/dzffxm3w1c8nanj1jt7vwoafxvetdbm.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/b6d86920e87c55dfbde7ca49052830f4_4249513964105684090.png')
                .elemental().damage(1).cost(3).handle(() => ({ statusOppo: 111101 })),
            new SkillBuilder('定格·全方位确证').description('{dealDmg}，治疗我方所有角色1点，召唤【smn111102】。')
                .src('https://patchwiki.biligame.com/images/ys/0/06/sg317tpcyew82aovprl39dfxavasbd4.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/e1d95cabb132d11c4fc412719e026aa6_3660966934155106231.png')
                .burst(2).damage(1).cost(3).handle(event => ({ heal: 1, hidxs: allHidxs(event.heros), summon: 111102 }))
        ),

    1111: () => new HeroBuilder(363).name('莱欧斯利').since('v4.7.0').fontaine(HERO_TAG.ArkheOusia).cryo().catalyst()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/064e881b99d30a1ce455d16a11768a24_8173906534678189661.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/4a9641995fd67126ff2b1e0d0294db57.png')
        .normalSkill(new NormalSkillBuilder('迅烈倾霜拳'))
        .skills(
            new SkillBuilder('冰牙突驰').description('{dealDmg}，本角色附属【sts111111】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/682e824a7cf31c433eabdf8f101592b1.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/2996ceb349568c064073978f3c45f419_3333678689971567936.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 111111 })),
            new SkillBuilder('黑金狼噬').description('{dealDmg}，生成【sts111112】。；【本角色在本回合中受到伤害或治疗每累计到2次时：】此技能少花费1个元素骰（最多少花费2个）。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/bfa34d0f6363c94bbc3e5a2164196028.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/1156bc48af506ea88c321bfc3e0de56a_8959649322241374469.png')
                .burst(3).damage(2).cost(3).handle(event => {
                    const { skill: { perCnt }, trigger = '' } = event;
                    return {
                        status: isCdt(trigger == 'skilltype3', 111112),
                        trigger: isCdt(perCnt < 4, ['getdmg', 'heal']),
                        minusDiceSkill: { skilltype3: [0, 0, Math.floor(perCnt / 2)] },
                        exec: () => {
                            if (['getdmg', 'heal'].includes(trigger)) ++event.hero.skills[2].perCnt;
                        }
                    }
                })
        ),

    1112: () => new HeroBuilder(407).name('菲米尼').since('v5.0.0').fontaine(HERO_TAG.ArkhePneuma).fatui().cryo().claymore()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/edc282bd8955faa88895b23c4061a2f5_7931855952099336084.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u9b0pg/4c9e507d20691ab1f31c20ba0003b9a9.png')
        .normalSkill(new NormalSkillBuilder('洑流剑'))
        .skills(
            new SkillBuilder('浮冰增压').description('{dealDmg}，若角色未附属【sts111121】，则使其附属【sts111121】。')
                .src('https://patchwiki.biligame.com/images/ys/d/d8/4w9vt1jcc6qhbza7awafyd70sxxs74l.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/631401634edd0a641a42a09722d82f09_6491825398627675961.png')
                .elemental().damage(2).cost(3).handle(event => {
                    const { hero: { heroStatus } } = event;
                    return { status: isCdt(!hasObjById(heroStatus, 111121), 111121) }
                }),
            new SkillBuilder('猎影潜袭').description('{dealDmg}，本角色附属【sts111122】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fe/95kd83tmndwc6ikoti7judkg0l1yyw1.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/4c548a11ba631ee6ccf70282d8af1718_5268158437550047138.png')
                .burst(2).damage(4).cost(3).handle(() => ({ status: 111122 }))
        ),

    1113: () => new HeroBuilder(432).name('罗莎莉亚').since('v5.2.0').mondstadt().cryo().polearm()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/11/19/258999284/4d0f8a88e70da601b334197a6f76c08f_4323853645135590656.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u0263g/d7c932b74ce84dc5fec8c91155dca4b0.png')
        .normalSkill(new NormalSkillBuilder('教会枪术'))
        .skills(
            new SkillBuilder('噬罪的告解').description('{dealDmg}，生成1层【sts111131】。（触发【sts111131】的效果时，会生成【sts111133】。）')
                .description('{dealDmg}，生成2层【sts111131】。（触发【sts111131】的效果时，会生成【sts111133】。）', 'v5.3.0')
                .src('https://patchwiki.biligame.com/images/ys/a/ac/2mx664lxxjofyc3dpqn0fv087g56rwi.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/71e41a887bf75f12f458ddaea87d1ae4_4540027086914779796.png')
                .elemental().damage(1).cost(3).handle((_, ver) => ({ statusPre: [[111131, isCdt(ver.gte('v5.3.0'), 1)]] })),
            new SkillBuilder('终命的圣礼').description('{dealDmg}，生成2层【sts111131】，召唤【smn111132】。')
                .src('https://patchwiki.biligame.com/images/ys/4/48/ms5styvozdm37zw7rvuduc0b66khtrt.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/17/258999284/9084652922b62c2033a0ac777811eb5c_1228859002995546833.png')
                .burst(2).damage(1).cost(3).handle(() => ({ statusPre: 111131, summon: 111132 }))
        ),

    1201: () => new HeroBuilder(9).name('芭芭拉').offline('v1').mondstadt().hydro().catalyst()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/f3e20082ab5ec42e599bac75159e5219_4717661811158065369.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/e92854385a3584dbbbd087ee5c49c69d.png')
        .normalSkill(new NormalSkillBuilder('水之浅唱'))
        .skills(
            new SkillBuilder('演唱，开始♪').description('{dealDmg}，召唤【smn112011】。')
                .src('https://patchwiki.biligame.com/images/ys/3/3d/dhyj1p18ghyyewzm8mrun808th2ula6.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/29a56a05d9f5b91ad6c19590afa4e44b_242169391927783668.png')
                .elemental().damage(1).cost(3).handle(() => ({ summon: 112011 })),
            new SkillBuilder('闪耀奇迹').description('治疗我方所有角色4点。')
                .src('https://patchwiki.biligame.com/images/ys/1/1f/mje4jhrya5ok36js3z6f5l8z2sfjg1n.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/03122bb05df17906af5f686ef8a6f2ba_4670328861321191920.png')
                .burst(3).cost(3).handle(event => ({ heal: 4, hidxs: allHidxs(event.heros) }))
        ),

    1202: () => new HeroBuilder(10).name('行秋').liyue().hydro().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/e522e3d11a6de75d38264655a531adf2_137376333068857031.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/dcec68115a5ccddf72741a1d1cac0e0e.png')
        .normalSkill(new NormalSkillBuilder('古华剑法'))
        .skills(
            new SkillBuilder('画雨笼山').description('{dealDmg}，本角色[附着水元素]，生成【sts112021】。')
                .src('https://patchwiki.biligame.com/images/ys/9/9f/n2lo8l7ov8w0bx2jwh5qcvmmflm8wbs.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/6ebbfb60e7eee60282022e0c935672dd_2463677033991737689.png')
                .elemental().damage(2).cost(3).handle(event => ({ status: [[112021, !!event.talent]], isAttach: true })),
            new SkillBuilder('裁雨留虹').description('{dealDmg}，本角色[附着水元素]，生成【sts112022】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fb/rj85t7tm68l6y8yyuvryh2hagcz1g3b.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/c8eb10016106e63120b6b5c92fcb2a5e_1562905905897327561.png')
                .burst(2).damage(2).damage(1, 'v4.1.0').cost(3).handle(() => ({ status: 112022, isAttach: true }))
        ),

    1203: () => new HeroBuilder(11).name('莫娜').offline('v1').mondstadt().hydro().catalyst()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/b48dbc3857d34dac326ae26c8c6cf779_954386122796941241.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/0962d5ea36a7216959bd0becb32e8761.png')
        .normalSkill(new NormalSkillBuilder('因果点破'))
        .skills(
            new SkillBuilder('水中幻愿').description('{dealDmg}，召唤【smn112031】。')
                .src('https://patchwiki.biligame.com/images/ys/4/41/fbfrg3ytuk388anpxvam5c28nf3n575.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/675b2ca2079729403ddaf84809171b53_3868880190025927848.png')
                .elemental().damage(1).cost(3).handle(() => ({ summon: 112031 })),
            new SkillBuilder('星命定轨').description('{dealDmg}，生成【sts112032】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e7/lhrcsp8l0nalp24l55335y1b8pazt8b.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/9cd333219d9081547d9c8f3d16a5b7c3_530937262031086854.png')
                .burst(3).damage(4).cost(3).handle(() => ({ status: 112032 })),
            new SkillBuilder('虚实流动').description('【此角色为出战角色，我方执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。（每回合1次）')
                .src('https://patchwiki.biligame.com/images/ys/1/12/j3lyz5vb4rhxspzbh9sl9toglxhk5d6.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/bc5c12ac6eb36b8d24f03864bf281b87_4261814317325062178.png')
                .passive().handle(event => ({ trigger: ['active-switch-from'], isNotAddTask: true, isQuickAction: event.skill.useCnt == 0 }))
        ),

    1204: () => new HeroBuilder(12).name('达达利亚').since('v3.7.0').fatui().hydro().bow()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a892e95a4bfde50980ebda3eb93e0ea3_7272571451164412234.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/013727346ac991708abee93c3dca762a.png')
        .normalSkill(new NormalSkillBuilder('断雨'))
        .skills(
            new SkillBuilder('魔王武装·狂澜').description('切换为【sts112042】，然后{dealDmg}，并使目标角色附属【sts112043】。')
                .description('切换为【sts112042】，然后{dealDmg}。', 'v4.1.0')
                .src('https://patchwiki.biligame.com/images/ys/c/ca/0jufd7tgnwppqkiwkkspioz1efhafbh.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/393b86b2158acd396af9fe09f9cd887c_8219782349327935117.png')
                .elemental().damage(2).cost(3).handle(event => {
                    const { hero: { heroStatus } } = event;
                    const sts112041 = getObjIdxById(heroStatus, 112041);
                    return {
                        status: 112042,
                        statusOppo: 112043,
                        exec: () => { sts112041 > -1 && heroStatus.splice(sts112041, 1) }
                    }
                }),
            new SkillBuilder('极恶技·尽灭闪').description('依据【hro】当前所处状态，进行不同的攻击：；【远程状态·魔弹一闪】：{dealDmg}，返还2点[充能]，目标角色附属【sts112043】。；【近战状态·尽灭水光】：造成{dmg+2}点[水元素伤害]。')
                .description('依据【hro】当前所处状态，进行不同的攻击：；【远程状态·魔弹一闪】：{dealDmg}，返还2点[充能]，目标角色附属【sts112043】。；【近战状态·尽灭水光】：造成{dmg+3}点[水元素伤害]。', 'v4.1.0')
                .src('https://patchwiki.biligame.com/images/ys/3/3f/s2ril7y96ghgom0365u65uu1iq3hdoe.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/de5fd6fc3f4530233cba1774deea0706_8854785564582245062.png')
                .burst(3).damage(5).damage(4, 'v4.1.0').cost(3).handle((event, ver) => {
                    const { hero: { heroStatus } } = event;
                    if (hasObjById(heroStatus, 112042)) return { addDmgCdt: ver.lt('v4.1.0') ? 3 : 2 }
                    return { statusOppo: 112043, energy: 2 }
                }),
            new SkillBuilder('遏浪').description('战斗开始时，初始附属【sts112041】。；角色所附属的【sts112042】效果结束时，重新附属【sts112041】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e6/s9urw8i8oidze3t6kgeivc054cg3ued.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b32057264f488d0df6429a135d5ce3e5_4144919367463512201.png')
                .passive().handle(() => ({ trigger: ['game-start', 'revive'], status: 112041 }))
        ),

    1205: () => new HeroBuilder(13).name('珊瑚宫心海').since('v3.5.0').inazuma().hydro().catalyst()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/89d5a757e494bded4020080c075bf32e_3429989759479851369.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/a3d326e3d228b0a9413cc26893d20c60.png')
        .normalSkill(new NormalSkillBuilder('水有常形'))
        .skills(
            new SkillBuilder('海月之誓').description('本角色[附着水元素]，召唤【smn112051】。')
                .src('https://patchwiki.biligame.com/images/ys/4/4a/3xnadr88l6sbo4vimaz67889y77nfz5.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/b366769c94d320e36f7ae259a68d8364_2006791096014715556.png')
                .elemental().cost(3).handle(() => ({ summon: 112051, isAttach: true })),
            new SkillBuilder('海人化羽').description('{dealDmg}，治疗我方所有角色1点，本角色附属【sts112052】。')
                .description('{dealDmg}，本角色附属【sts112052】。', 'v3.6.0')
                .src('https://patchwiki.biligame.com/images/ys/7/7a/a5apmahnio46pxnjy2ejzd7hgts9a7i.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/c9160408f2b03a1b2cedb046aa09f3be_3291666669631292065.png')
                .burst(2).damage(2).damage(3, 'v3.6.0').cost(3).handle((event, ver) => {
                    const { talent, summons = [], heros = [] } = event;
                    const smn112051 = getObjById(summons, 112051);
                    const summon = isCdt<[number, number][]>(ver.gte('v4.2.0') && talent && !smn112051, [[112051, 1]]);
                    return {
                        summon,
                        cmds: [{ cmd: 'getStatus', status: 112052 }],
                        heal: isCdt(ver.gte('v3.6.0'), 1),
                        hidxs: allHidxs(heros),
                        exec: () => { talent && smn112051?.addUseCnt(true) }
                    }
                })
        ),

    1206: () => new HeroBuilder(14).name('神里绫人').since('v3.6.0').inazuma().hydro().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/8abc91faf473b3d11fb53db32862737a_4252453982763739636.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/774d77ccc6fe33be0c5953238090d926.png')
        .normalSkill(new NormalSkillBuilder('神里流·转'))
        .skills(
            new SkillBuilder('神里流·镜花').description('{dealDmg}，本角色附属【sts112061】。')
                .src('https://patchwiki.biligame.com/images/ys/5/5d/15a6f0hbhixe9lsimlem2brt4lmm4tg.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/7d59ca30b30a9c7fdccaab51f5f3ddb6_6887701647607769506.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 112061 })),
            new SkillBuilder('神里流·水囿').description('{dealDmg}，召唤【smn112062】。')
                .src('https://patchwiki.biligame.com/images/ys/6/66/ank1fvv2zp5ctqqmjhkciryr0v5aikl.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/1d3a5df815f4f5dbac3338448f2c1d22_7767414617660800462.png')
                .burst(2).burst(3, 'v4.1.0').damage(1).damage(3, 'v4.1.0').cost(3).handle(() => ({ summon: 112062 }))
        ),

    1207: () => new HeroBuilder(15).name('坎蒂丝').since('v3.8.0').sumeru().hydro().polearm()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/62c7b1917c4d60c69ca5ef0f011ab8f7_6753229827849116335.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/6dcba2a54e7f7f1df7951987eeed39f1.png')
        .normalSkill(new NormalSkillBuilder('流耀枪术·守势'))
        .skills(
            new SkillBuilder('圣仪·苍鹭庇卫').description('本角色附属【sts112071】并[准备技能]：【rsk12074】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b0/ay6ytf53eoh7q26tim9feavkmui7m67.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/b66a56151a7b1d1b554543bf5a5fcbe8_3742905607972259834.png')
                .elemental().cost(3).handle(() => ({ status: [112071, 112074] })),
            new SkillBuilder('圣仪·灰鸰衒潮').description('{dealDmg}，生成【sts112072】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fc/ipi3ncx8dl44m9og51z6g72pu1mux41.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/65b29af9633d647a90b9ff0acd90d750_1308512450439952516.png')
                .burst(2).damage(2).cost(3).handle(event => ({ status: [[112072, !!event.talent]] }))
        ),

    1208: () => new HeroBuilder(16).name('妮露').since('v4.2.0').sumeru().hydro().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/c204ab1e33aa03f8b8936c5730408063_855558974512689147.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/1bd791ccee166f25f6c9526fa30628af.png')
        .normalSkill(new NormalSkillBuilder('弦月舞步'))
        .skills(
            new SkillBuilder('七域舞步').description('{dealDmg}，如果队伍中包含‹2水元素角色›和‹7草元素角色›且不包含其他元素的角色，就生成【sts112081】。')
                .src('https://patchwiki.biligame.com/images/ys/7/70/eou9puc088y2tptuyz5obaecxu4mlwe.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/dda23813ac8a901419da3fcfe5fdcdd3_1625330009471386599.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { heros = [] } = event;
                    const onlyHydroOrDendro = heros.every(h => h.element == ELEMENT_TYPE.Hydro || h.element == ELEMENT_TYPE.Dendro);
                    const hasDendro = heros.some(h => h.element == ELEMENT_TYPE.Dendro);
                    return { statusPre: isCdt(onlyHydroOrDendro && hasDendro, 112081) }
                }),
            new SkillBuilder('浮莲舞步·远梦聆泉').description('{dealDmg}，目标角色附属【sts112083】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e4/g0jxv4e1j04516p1lse7kbmq9e169o4.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/d90ebd60eb4eb78a42d0f2f95cab33fc_4581262526420283887.png')
                .burst(2).damage(2).cost(3).handle(() => ({ statusOppo: 112083 }))
        ),

    1209: () => new HeroBuilder(280).name('夜兰').since('v4.3.0').liyue().hydro().bow()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/5e7cb3adbfd464b00dbc707f442fe96d_6990020566246221581.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/7c33c2830e1d5dba89d671e18b507f23.png')
        .normalSkill(new NormalSkillBuilder('潜形隐曜弓'))
        .skills(
            new SkillBuilder('萦络纵命索').description('{dealDmg}，此角色的【sts112091】层数+2。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/3fdd9553568d44d74d9719f3231b6a8d.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/3ed2b13a1d082aa48aadf38b12f2c0d4_7432676773939994875.png')
                .elemental().damage(3).cost(3).handle(() => ({ status: [[112091, 2]] })),
            new SkillBuilder('渊图玲珑骰').description('{dealDmg}，生成【sts112092】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/b77306b0f53c2bfc141ccb93f866374d.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/8ef70a485219c07361bcfa62d01198a3_6128235753822442226.png')
                .burst(3).damage(3).damage(1, 'v4.6.1').cost(3).handle(() => ({ status: 112092 })),
            new SkillBuilder('破局').description('战斗开始时，初始附属【sts112091】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/9d80088a6e6cb7f8913f3bc14e6f48ab.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/3d521526d51c8e9b090a046c0187ace9_6247094106411719876.png')
                .passive().handle(() => ({ trigger: ['game-start', 'revive'], status: 112091 }))
        ),

    1210: () => new HeroBuilder(335).name('那维莱特').since('v4.5.0').fontaine(HERO_TAG.ArkhePneuma).hydro().catalyst()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/86e0474f40841fbc5faff7870fe9cd0c_8511334021456599978.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/eac3491b067897444fbedb6a9a3e58ad.png')
        .normalSkill(new NormalSkillBuilder('如水从平'))
        .skills(
            new SkillBuilder('泪水啊，我必偿还').description('{dealDmg}，角色附属【sts112101】。')
                .src('https://patchwiki.biligame.com/images/ys/7/78/l63dicjkhcq42evmggc34tdr97rsc29.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/472b87458851b9cf53d0bbe34596e076_7997139213955787355.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 112101 })),
            new SkillBuilder('潮水啊，我已归来').description('{dealDmg}，对所有后台敌人造成1点[穿透伤害]，生成[可用次数]为2的【sts112101】。')
                .src('https://patchwiki.biligame.com/images/ys/3/34/f74fkdp404dawd3hcptki3v7yaw6ydg.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/31a30f1436a733695fc91d1248c157e1_6560934694291577179.png')
                .burst(2).damage(2).cost(3).handle(() => ({ pdmg: 1, status: [[112101, 2]] }))
        ),

    1211: () => new HeroBuilder(364).name('芙宁娜').since('v4.7.0').fontaine(HERO_TAG.ArkheOusia).hydro().sword()
        .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/e958e09d88022d4a18633be9bf51b399.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/fa0204761d8dae8b0dbaac46a494752f.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/e330408cba4b278428656f4e5c7a8915.png',
            'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Char_AvatarIcon_FurinaOusia.webp')
        .normalSkill(new NormalSkillBuilder('独舞之邀').perCnt(1).description('；【每回合1次：】如果手牌中没有【crd112113】，则生成手牌【crd112113】。')
            .handle(event => {
                const { skill, hcards = [] } = event;
                if (skill.perCnt <= 0 || hasObjById(hcards, 112113)) return;
                return { cmds: [{ cmd: 'getCard', cnt: 1, card: 112113 }], exec: () => { --skill.perCnt } }
            }))
        .skills(
            skillTotal[12112](),
            new SkillBuilder('万众狂欢').description('{dealDmg}，生成【sts112114】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/41d5043a50d5e8617dfa47e1a21aa25c.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/808b53862627bda5900f820650997a77_3050208693053163874.png')
                .burst(2).damage(2).cost(4).handle(() => ({ status: 112114 })),
            new SkillBuilder('始基力：圣俗杂座').id(12115).description('战斗开始时，生成手牌【crd112113】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/02b8738828b4ce238059cd8d47a56267.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/5ee50826cdd9cb5c1d48d55b04f84aa1_187435207931585226.png')
                .passive().handle(() => ({ trigger: ['game-start'], cmds: [{ cmd: 'getCard', cnt: 1, card: 112113 }] }))
        ),

    1213: () => new HeroBuilder(433).name('希格雯').since('v5.2.0').fontaine(HERO_TAG.ArkheOusia).hydro().bow()
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u0263g/8abf0e180b4dad16808966a1995ab08e.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u0263g/2576f665c6de5e7cc3c16ce1773f90e8.png')
        .normalSkill(new NormalSkillBuilder('靶向治疗'))
        .skills(
            new SkillBuilder('弹跳水疗法').description('生成1张【crd112131】，将其置于我方牌库顶部第3张牌的位置，本角色附属3层【sts122】。（触发【crd112131】的效果后，会生成【crd112132】并置入对方牌库\\；触发【crd112132】的效果后，会生成【crd112133】并置入我方牌库）')
                .src('https://patchwiki.biligame.com/images/ys/c/cb/ds8xetx81vimcqf1iplwz39bcocnaom.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/f19c7aee67405f75ab2232607be81ea8_369892106478425408.png')
                .elemental().cost(3).handle(() => ({ cmds: [{ cmd: 'addCard', cnt: -1, card: 112131, hidxs: [3] }], status: [[122, 3]] })),
            new SkillBuilder('过饱和心意注射').description('{dealDmg}，然后[准备技能]：【rsk12135】。')
                .src('https://patchwiki.biligame.com/images/ys/a/a8/lb2b4b7sa7rdl2ykmlhk7jwmi6a53i6.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/dcbf94bb5239ad88636d33ab552a9e80_4185011562027950809.png')
                .burst(2).damage(2).cost(3).handle(() => ({ status: 112134 })),
            new SkillBuilder('细致入微的诊疗').description('我方角色所附属的【sts122】被完全移除后，该角色获得1点额外最大生命值。（对每名角色最多生效3次）；【我方切换到本角色时：】如果我方场上存在【sts112101】，则使其[可用次数]-1，本角色获得1点[充能]。')
                .src('https://patchwiki.biligame.com/images/ys/5/55/m43lxh8gyu0yaq70sczycvsk9sforzc.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/8a6a3792e47546b5ec81ee636445c4d8_6392784692082623561.png')
                .passive().handle(event => {
                    const { hero, heros = [], sourceHidx = -1, source = -1, combatStatus = [], trigger = '' } = event;
                    const triggers: Trigger[] = ['game-start', 'revive', 'killed'];
                    const cmds: Cmds[] = [];
                    if (trigger == 'status-destroy' && source == 122 && hasObjById(heros[sourceHidx]?.heroStatus, 112136)) {
                        triggers.push('status-destroy');
                    }
                    if (trigger == 'switch-to' && hasObjById(combatStatus, 112101) && hero.energy < hero.maxEnergy) {
                        triggers.push('switch-to');
                        cmds.push({ cmd: 'getEnergy', cnt: 1, hidxs: [hero.hidx] });
                    }
                    if (['game-start', 'revive'].includes(trigger)) {
                        cmds.push({ cmd: 'getStatus', status: 112136, hidxs: allHidxs(heros) });
                    }
                    return {
                        trigger: triggers,
                        cmds,
                        isNotAddTask: !['switch-to', 'status-destroy'].includes(trigger),
                        exec: () => {
                            if (trigger == 'switch-to') {
                                const sts112101 = getObjById(combatStatus, 112101);
                                if (sts112101?.minusUseCnt() == 0) sts112101.type.length = 0;
                            } else if (trigger == 'killed') {
                                heros.forEach(h => getObjById(h.heroStatus, 112136)?.dispose());
                            }
                        }
                    }
                })
        ),

    1214: () => new HeroBuilder(444).name('玛拉妮').since('v5.3.0').natlan().hydro().catalyst()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/1088c1bedbeeba3217e8ae968bad7191_4305921354282696376.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u502gh/751d43f3f0f8c0c7ff15116b7a6286c8.png')
        .normalSkill(new NormalSkillBuilder('降温处理'))
        .skills(
            new SkillBuilder('踏鲨破浪').description('自身附属【crd112142】，然后进入【sts112141】，并获得2点｢夜魂值｣。（角色进入【sts112141】后不可使用此技能）')
                .src('https://patchwiki.biligame.com/images/ys/c/cf/6st36uogdsny0hmvb5j4uqh1i9lj27n.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/c0769da88723a8460722bf3f9b45a36d_6871593320341772759.png')
                .elemental().cost(2).handle(({ hero }) => ({
                    cmds: [{ cmd: 'equip', hidxs: [hero.hidx], card: 112142 }],
                    status: [[112141, 2]],
                    isForbidden: hasObjById(hero.heroStatus, 112141)
                })),
            new SkillBuilder('爆瀑飞弹').description('{dealDmg}，召唤【smn112144】。')
                .src('https://patchwiki.biligame.com/images/ys/2/20/deylgtgmao0abaizxdec4d3ya8ivhoq.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/ef6e70eabb280577276038ef5de4b953_998934977401309909.png')
                .burst(2).damage(2).cost(3).handle(() => ({ summon: 112144 })),
        ),

    1301: () => new HeroBuilder(17).name('迪卢克').offline('v1').mondstadt().pyro().claymore()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/62a4fe60bee58508b5cb8ea1379bc975_5924535359245042441.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/844c962c95ae1dfe1b3b14cafdb277c3.png')
        .normalSkill(new NormalSkillBuilder('淬炼之剑'))
        .skills(
            new SkillBuilder('逆焰之刃').description('{dealDmg}。每回合第三次使用本技能时，伤害+2。')
                .src('https://patchwiki.biligame.com/images/ys/e/ef/e4f6sb7ammsholnhufv95kmtfozj9fs.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/7651d152d160362e7c75ce224f92298c_5143713055633145888.png')
                .elemental().damage(3).cost(3).handle(event => ({ addDmgCdt: isCdt(event.skill.useCntPerRound == 2, 2) })),
            new SkillBuilder('黎明').description('{dealDmg}，本角色附属【sts113011】。')
                .src('https://patchwiki.biligame.com/images/ys/5/58/6jikt2165rekj99qwm3999hb6qsy04o.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/25bdbe8a9495cdc4f48c2a223d06fac1_8334072998945792701.png')
                .burst(3).damage(8).cost(4).handle(() => ({ status: 113011 }))
        ),

    1302: () => new HeroBuilder(18).name('香菱').offline('v1').liyue().pyro().polearm()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/db00cd121173cb6fcfefcd2269fffe8d_3134519584249287466.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/1606f568f0bf22d9e9a1758a5f599643.png')
        .normalSkill(new NormalSkillBuilder('白案功夫'))
        .skills(
            new SkillBuilder('锅巴出击').description('召唤【smn113021】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e0/ioytpg3b208mckx76izeidcojyybs0g.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/eff41796c703a21e367766cd96ccfefc_4096903365398601995.png')
                .elemental().cost(3).handle(event => ({ summon: 113021, addDmgCdt: isCdt(!!event.talent, 1) })),
            new SkillBuilder('旋火轮').description('{dealDmg}，生成【sts113022】。')
                .src('https://patchwiki.biligame.com/images/ys/8/8f/abxrclvx2nuyo4rsvbq1rxlcb2vcqh6.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/c324cd014801eaea70ee05529d9ba3ff_2574087438784210727.png')
                .burst(2).damage(3).damage(2, 'v3.8.0').cost(4).handle(() => ({ status: 113022 }))
        ),

    1303: () => new HeroBuilder(19).name('班尼特').mondstadt().pyro().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/d89f82644792213864d7882f1e6a6d57_6202328605123550683.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/f16f7127bb6cad2295ff249d3414b497.png')
        .normalSkill(new NormalSkillBuilder('好运剑'))
        .skills(
            new SkillBuilder('热情过载').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/9/94/n851q7f1jehvs60c7lywx72vz6thjyi.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/4e4211389dbbc941630ae7a29ad01fe8_82456441478642234.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('美妙旅程').description('{dealDmg}，生成【sts113031】。')
                .src('https://patchwiki.biligame.com/images/ys/1/13/avxfgtbz3r8qu7zk71dcr8kk3e949zi.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6cdff59fc3701119002ab7cb38157a2c_8058649649755407178.png')
                .burst(2).damage(2).cost(4).handle(event => ({ statusAfter: [[113031, !!event.talent]] }))
        ),

    1304: () => new HeroBuilder(20).name('安柏').since('v3.7.0').mondstadt().pyro().bow()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/915473ac6c13d0bea16d141adca38359_823004675460920277.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/6aedca19a0357e653046e151d4796835.png')
        .normalSkill(new NormalSkillBuilder('神射手'))
        .skills(
            new SkillBuilder('爆炸玩偶').description('召唤【smn113041】。')
                .src('https://patchwiki.biligame.com/images/ys/4/47/52p9ytkmov9g5ms8mzzovuc4tzya3nl.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/36e0f7549a2676d340220d9b0da2e037_4582096687507723724.png')
                .elemental().cost(3).handle(() => ({ summon: 113041 })),
            new SkillBuilder('箭雨').description('{dealDmg}，对所有敌方后台角色造成2点[穿透伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/9/91/jbwgghhm13093k7uyxazjkmigmsq6zj.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/cae15535936cce8934a1c0a2330e69ac_2372376468187258300.png')
                .burst(2).damage(2).cost(3).handle(() => ({ pdmg: 2 }))
        ),

    1305: () => new HeroBuilder(21).name('宵宫').inazuma().pyro().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/0ab761b86c16f0c1f8088132e488d641_2788225354118870949.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/f6230c2cdf9f915b6297d0782e6510ad.png')
        .normalSkill(new NormalSkillBuilder('烟火打扬'))
        .skills(
            new SkillBuilder('焰硝庭火舞').description('本角色附属【sts113051】。（此技能不产生[充能]）')
                .src('https://patchwiki.biligame.com/images/ys/4/4d/nxz4yj425tcxv3bevn05eu33wrqv2jr.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/cec17a1d299dd83a96a4e2e791a21da4_3223499260532391975.png')
                .elemental().cost(1).energy(-1).handle(event => ({ status: [[113051, !!event.talent]] })),
            new SkillBuilder('琉金云间草').description('{dealDmg}，生成【sts113052】。')
                .src('https://patchwiki.biligame.com/images/ys/2/22/p14o20u95t6u0b4hngqf8hhku0r1krx.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/938ac8f32d0998f3c896b862d0791b56_7334292135415645740.png')
                .burst(3).burst(2, 'v3.4.0').damage(3).damage(4, 'v3.8.0').damage(3, 'v3.4.0').cost(3).cost(4, 'v3.8.0').cost(3, 'v3.4.0')
                .handle(() => ({ status: 113052 }))
        ),

    1306: () => new HeroBuilder(22).name('可莉').since('v3.4.0').mondstadt().pyro().catalyst()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/69fb352f7c86836d42648a2bd9c61773_8899766719245799680.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/e5f16924297448c8ac7d582da6f4fe34.png')
        .normalSkill(new NormalSkillBuilder('砰砰'))
        .skills(
            new SkillBuilder('蹦蹦炸弹').description('{dealDmg}，本角色附属【sts113061】。')
                .src('https://patchwiki.biligame.com/images/ys/9/99/eqni0xudmuxvbflx6kviz8l793fju23.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/12/09/12109492/4409746db70c242861fb0a6addafd850_1072795968508012901.png')
                .elemental().damage(3).cost(3).handle(event => ({ status: [[113061, !!event.talent]] })),
            new SkillBuilder('轰轰火花').description('{dealDmg}，在对方场上生成【sts113063】。')
                .src('https://patchwiki.biligame.com/images/ys/2/28/s88qf6z943kpscss1oye99kmccz2y10.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/01/18/12109492/3f4f659ff99b2435aa3662f4d17d537d_4727800863330247216.png')
                .burst(3).damage(3).cost(3).handle(() => ({ statusOppo: 113063 }))
        ),

    1307: () => new HeroBuilder(23).name('胡桃').since('v3.7.0').liyue().pyro().polearm()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fb95dbcb2f4ad804f1c3bbe767c3595e_5336167659518462076.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/ada775c7d535074ed9b2b77ec3070978.png')
        .normalSkill(new NormalSkillBuilder('往生秘传枪法'))
        .skills(
            new SkillBuilder('蝶引来生').description('本角色附属【sts113071】。')
                .src('https://patchwiki.biligame.com/images/ys/f/f3/0g43qqxknh3k0v6j7b6q4u6jl5hfbee.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/de4fd19b85ccff272b9a4c98ca3812a6_2552949834321842909.png')
                .elemental().cost(2).handle(() => ({ status: 113071 })),
            new SkillBuilder('安神秘法').description('{dealDmg}，治疗自身2点。如果本角色生命值不多于6，则造成的伤害和治疗各+1。')
                .src('https://patchwiki.biligame.com/images/ys/b/b0/cpmmff7d7wctcaepp47ix06vprvpsrs.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e2a7845bb7627390caddc5aebee27b65_4410957076093902563.png')
                .burst(3).damage(4).cost(3).handle(event => {
                    const { hero: { hp } } = event;
                    const isHp6 = hp <= 6;
                    return { heal: isHp6 ? 3 : 2, addDmgCdt: isCdt(isHp6, 1) }
                })
        ),

    1308: () => new HeroBuilder(24).name('烟绯').since('v3.8.0').liyue().pyro().catalyst()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/df1805ae68d4dee99369058360f397cd_6712537786885000576.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/c3cba1bf2d63f748a32392d259264ccc.png')
        .normalSkill(new NormalSkillBuilder('火漆印制'))
        .skills(
            new SkillBuilder('丹书立约').description('{dealDmg}，本角色附属【sts113081】。')
                .src('https://patchwiki.biligame.com/images/ys/4/4d/c4zvyjyfmjxif0axdrokruczxky5dc7.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/649b9c9adf75bb1dd7606c75bc0589c1_3860785563340483833.png')
                .elemental().damage(3).cost(3).handle(() => ({ status: 113081 })),
            new SkillBuilder('凭此结契').description('{dealDmg}，本角色附属【sts113081】和【sts113082】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b0/iike33982frep1bmhcdj0juxpcidqey.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/d135e7fc5ac836105a3f8bfb22ef346e_6469409230143043569.png')
                .burst(2).damage(3).cost(3).handle(() => ({ status: [113081, 113082] }))
        ),

    1309: () => new HeroBuilder(25).name('迪希雅').since('v4.1.0').sumeru().eremite().pyro().claymore()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/9865ac83f483b177c63e99360305dc28_7940275616970367103.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/1f1ecf33ab6dba84c36880f7c92e8e54.png')
        .normalSkill(new NormalSkillBuilder('拂金剑斗术'))
        .skills(
            new SkillBuilder('熔铁流狱').description('召唤【smn113093】\\；如果已存在【smn113093】，就先造成{dmg+1}点[火元素伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/8/8c/k583v0pci7akj1fbcin40ogho11mxzr.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/b590f6bfaf00c68987b204aa33e937aa_4421699992460567189.png')
                .elemental().cost(3).handle(event => {
                    const { summons = [] } = event;
                    const isSmned = hasObjById(summons, 113093);
                    return { summon: 113093, addDmgCdt: isCdt(isSmned, 1) }
                }),
            new SkillBuilder('炎啸狮子咬').description('{dealDmg}，然后[准备技能]：【rsk13095】。')
                .src('https://patchwiki.biligame.com/images/ys/7/7f/ap84alhaz0b3jc9uh4e2nl84at46do1.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/22/258999284/d4af1c58efe84398677b12a796a10091_49820199465503907.png')
                .burst(2).damage(3).cost(4).handle(() => ({ status: 113092 }))
        ),

    1310: () => new HeroBuilder(281).name('林尼').since('v4.3.0').fontaine(HERO_TAG.ArkhePneuma).fatui().pyro().bow()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/e0cc3a4602a418aaebb0855ad147f91e_261319803814200678.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/45a1a4f44d1f5af987980c5079085392.png')
        .normalSkill(new NormalSkillBuilder('迫牌易位式'))
        .skills(
            new SkillBuilder('隐具魔术箭').description('{dealDmg}，召唤【smn113101】，累积1层【sts113102】。；如果本角色生命值至少为6，则对自身造成1点[穿透伤害]。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/1d65a51c36eca7169247316ff7e14a89.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5e46c170e7ce41c20bf76c27c4a16d89_689217131128119675.png')
                .normal().damage(2).cost(3).handle(event => ({ pdmgSelf: isCdt(event.hero.hp >= 6, 1), summon: 113101, status: 113102 })),
            new SkillBuilder('眩惑光戏法').description('{dealDmg}。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f86fcf037ad32d9973e84673f33f2b2b.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/22ed66987bb301d836569cf8fd4fc845_378167615829921519.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('大魔术·灵迹巡游').description('{dealDmg}，召唤【smn113101】，累积1层【sts113102】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/9859ed5f65f53d9fb21c11b2a6df50d8.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/6d91a8911290da444b67711806a75a56_5602716403383894799.png')
                .burst(2).damage(3).cost(3).handle(() => ({ summon: 113101, status: 113102 }))
        ),

    1311: () => new HeroBuilder(319).name('托马').since('v4.4.0').inazuma().pyro().polearm()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/a21241c40833d2aee5336ae8fdd58c41_7254789917363324478.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/23fd1154d3898bf8082c562634250f8d.png')
        .normalSkill(new NormalSkillBuilder('迅破枪势'))
        .skills(
            new SkillBuilder('烈烧佑命之侍护').description('{dealDmg}，生成【sts113111】。')
                .src('https://patchwiki.biligame.com/images/ys/6/6a/s3cppco85ykmlq1xuqfqfohdwuk3ogi.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/5943ef23f4dde5b6015a06e67e8332a5_7948056671343155927.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 113111 })),
            new SkillBuilder('真红炽火之大铠').description('{dealDmg}，生成【sts113111】和【sts113112】。')
                .src('https://patchwiki.biligame.com/images/ys/2/21/a47iyqyy205fi0kyn38tmakcinh281j.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/7d6cb477d20cd8b75925ce62d3b73e8e_5295401799072493605.png')
                .burst(2).damage(2).cost(3).handle(event => ({ status: [113111, [113112, !!event.talent]] }))
        ),

    1312: () => new HeroBuilder(365).name('辛焱').since('v4.7.0').liyue().pyro().claymore()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/2538459953fb12e38da66416bd1db19a_2302423233068754101.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/78f87dda37f211ee6e090ee66503335d.png')
        .normalSkill(new NormalSkillBuilder('炎舞'))
        .skills(
            new SkillBuilder('热情拂扫').description('{dealDmg}，随机[舍弃]1张元素骰费用最高的手牌，生成【sts113121】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/dbd50c015ba92d80ee8c5feab9b1f16d.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/32dd71b5685b54f23af58c4afa8cffc7_1218700248488941422.png')
                .elemental().damage(2).cost(3).handle(() => ({
                    cmds: [{ cmd: 'discard', cnt: 1, mode: CMD_MODE.HighHandCard }],
                    status: 113121,
                })),
            new SkillBuilder('叛逆刮弦').description('{dealDmg}，对所有敌方后台角色造成2点[穿透伤害]\\；[舍弃]我方所有手牌，生成【sts113123】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/0f007a2905436bfbbcc0f286889fea82.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/6387793092d6e4fbf598834d1c4735b0_3596019311060413612.png')
                .burst(2).damage(3).dmgElement(DAMAGE_TYPE.Physical).cost(3).handle(() => ({
                    pdmg: 2,
                    cmds: [{ cmd: 'discard', mode: CMD_MODE.AllHandCards }],
                    status: 113123,
                }))
        ),

    1313: () => new HeroBuilder(395).name('夏沃蕾').since('v4.8.0').fontaine(HERO_TAG.ArkheOusia).pyro().polearm()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/6c91fd059cdcc4f1c068b0a255350433_8349286385786874049.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/a428c5149c159454c1ea98b254d80990.png')
        .normalSkill(new NormalSkillBuilder('线列枪刺·改'))
        .skills(
            new SkillBuilder('近迫式急促拦射').description('{dealDmg}。；【此技能结算后：】如果我方手牌中含有【crd113131】，则[舍弃]1张并治疗我方受伤最多的角色1点。')
                .src('https://patchwiki.biligame.com/images/ys/7/71/lh98vjaiu8gy537a5k4a3ypm6rde11w.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/550f45fcecc3b2ed7c472f0b5854350e_764894768056545994.png')
                .elemental().damage(2).cost(3).handle(event => {
                    const { hcards = [], heros = [] } = event;
                    if (hcards.every(c => c.id != 113131)) return;
                    return { cmds: [{ cmd: 'discard', cnt: 1, card: 113131 }, { cmd: 'heal', cnt: 1, hidxs: getMaxHertHidxs(heros) }] }
                }),
            new SkillBuilder('圆阵掷弹爆轰术').description('{dealDmg}，在敌方场上生成【sts113132】。')
                .src('https://patchwiki.biligame.com/images/ys/2/2c/b0tlvwd776zbom2sewxulwqzyq2fsa6.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/065f5a0ba4fa470e36c730b94862e27e_5007009973065767790.png')
                .burst(2).damage(2).cost(3).handle(() => ({ statusOppoPre: 113132 })),
            new SkillBuilder('纵阵武力统筹').description('【敌方角色受到超载反应伤害后：】生成手牌【crd113131】。（每回合1次）')
                .src('https://patchwiki.biligame.com/images/ys/f/fe/etjv39dbype1nvxty7pn43rlczzrf3p.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/a5b60cf0ca11cd6359a6c54c815174e1_907488869279933822.png')
                .passive().handle(event => {
                    const { skill: { useCntPerRound } } = event;
                    if (useCntPerRound > 0) return;
                    return { trigger: ['Overload-oppo'], cmds: [{ cmd: 'getCard', cnt: 1, card: 113131 }] }
                })
        ),

    1314: () => new HeroBuilder(454).name('阿蕾奇诺').since('v5.4.0').fatui().pyro().polearm()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/6d1379337d377cb94b3a5df789c57af0_4432986078863302985.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u8c1lh/2b18a446223227da615ba874800e6a7e.png')
        .normalSkill(new NormalSkillBuilder('斩首之邀').description('，若可能，消耗目标至多3层【sts122】，提高等量伤害。')
            .handle(event => {
                const { eheros = [], hero } = event;
                const dmgElement = isCdt(hasObjById(hero.heroStatus, 122), DAMAGE_TYPE.Pyro);
                const sts122 = getObjById(eheros.find(h => h.isFront)?.heroStatus, 122);
                if (!sts122) return { dmgElement }
                const addDmgCdt = Math.min(3, sts122.useCnt);
                return { dmgElement, addDmgCdt, exec: () => sts122.minusUseCnt(addDmgCdt) }
            }))
        .skills(
            new SkillBuilder('万相化灰').description('在对方场上生成5层【sts113141】，然后{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/d/d5/ggy5txvitobnp70gsp8u761qxv84y43.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/7810c834269545540dea50ba88c3a25c_6894619581902279780.png')
                .elemental().damage(2).cost(3).handle(() => ({ statusOppoPre: 113141 })),
            new SkillBuilder('厄月将升').description('{dealDmg}，移除自身所有【sts122】，每移除1层，治疗自身1点。')
                .src('https://patchwiki.biligame.com/images/ys/d/da/cucu0jsa375iqeeh9xzfeohcueq6gcc.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/deb7835cea5aa6a48d80b8880ead635b_7631695322014410848.png')
                .burst(3).damage(4).cost(3).handle(event => {
                    const { hero: { heroStatus } } = event;
                    const sts122 = getObjById(heroStatus, 122);
                    return { heal: sts122?.useCnt ?? 0, exec: () => sts122?.dispose() }
                }),
            new SkillBuilder('唯厄月可知晓').description('角色不会受到【ski,2】以外的治疗。；【自身附属〖sts122〗时：】角色造成的[物理伤害]变为[火元素伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/5/54/pxn17pilom6vwve4bs6vsemh1dvt89k.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/a2a8eb8cafea01ec4461915fe495127c_5101380063673897230.png')
                .passive().handle(event => {
                    const { hero, heal = [], source = -1, trigger = '' } = event;
                    if (trigger == 'pre-heal' && source != 13143) heal[hero.hidx] = -1;
                }),
            new SkillBuilder().passive(true).handle(event => {
                const { restDmg = -1, hero } = event;
                const sts122 = getObjById(hero.heroStatus, 122);
                if (restDmg == -1 || !sts122) return;
                if (restDmg == 0) return { trigger: ['reduce-dmg'], isNotAddTask: true, restDmg }
                return { trigger: ['reduce-dmg'], isNotAddTask: true, restDmg: restDmg - 1, exec: () => sts122.minusUseCnt() }
            })
        ),

    1401: () => new HeroBuilder(26).name('菲谢尔').mondstadt().electro().bow()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/02/195563531/41fc0a943f93c80bdcf24dbce13a0956_3894833720039304594.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/e4166ac0aa3f216c59ff3e8a5e44fa70.png')
        .normalSkill(new NormalSkillBuilder('灭罪之矢'))
        .skills(
            new SkillBuilder('夜巡影翼').description('{dealDmg}，召唤【smn114011】。')
                .src('https://patchwiki.biligame.com/images/ys/2/29/9ikuan4r5rhgza5nlxl86m718d3zmtt.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/4ab444ac20da8ea0990ff891600596ed_358383106993654545.png')
                .elemental().damage(1).cost(3).handle(event => ({ summon: [[114011, !!event.talent]] })),
            new SkillBuilder('至夜幻现').description('{dealDmg}，对所有敌方后台角色造成2点[穿透伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/5/5e/oi2xpx4ad1wuo0g4nozm1yqfxzmzrut.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/bac9b0ca7056b02ffac854871d7cb0e0_7559183843121315562.png')
                .burst(3).damage(4).cost(3).handle(() => ({ pdmg: 2 }))
        ),

    1402: () => new HeroBuilder(27).name('雷泽').mondstadt().electro().claymore()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/52cc6519a87290840830b64f25117070_8992911737218383504.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/04a1d8fdbc395113542897c6ea6f13c5.png')
        .normalSkill(new NormalSkillBuilder('钢脊'))
        .skills(
            new SkillBuilder('利爪与苍雷').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/0/02/e16tz7kk056z1n3duql87hoj6gxf8z5.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/d9a4f69257c64d52769a6b0a9af8031a_2133845428381568499.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('雷牙').description('{dealDmg}，本角色附属【sts114021】。')
                .src('https://patchwiki.biligame.com/images/ys/0/04/o12dwfbbsokckmhk1rmuj9i5fekwenv.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/2fcead6f24aba2d2595e98615756f175_4684225450339126121.png')
                .burst(2).burst(3, 'v3.8.0').damage(3).damage(5, 'v3.8.0').cost(3).handle(() => ({ status: 114021 }))
        ),

    1403: () => new HeroBuilder(28).name('刻晴').offline('v1').liyue().electro().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/2dd94ec81fda4b55e9d90ae89de4cf80_5019006447640086752.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/c6196a177b92302347a85c6e51fde46a.png')
        .normalSkill(new NormalSkillBuilder('云来剑法'))
        .skills(
            new SkillBuilder('星斗归位').description('{dealDmg}，生成手牌【crd114031】。')
                .src('https://patchwiki.biligame.com/images/ys/5/58/8ajyn7zzhal0dopp6vi3lnryq12gq28.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/c351b44d3163278214f6f9db09c020fd_3304441541356399096.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { talent, card, hcards = [] } = event;
                    const hasCard114031 = hasObjById(hcards, 114031) || card?.id == 114031;
                    return {
                        status: isCdt(hasCard114031, [[114032, +!!talent]]),
                        cmds: isCdt(hasCard114031,
                            isCdt<Cmds[]>(card?.id != 114031,
                                [{ cmd: 'discard', card: 114031 }]),
                            [{ cmd: 'getCard', cnt: 1, card: 114031 }]
                        ),
                    }
                }),
            new SkillBuilder('天街巡游').description('{dealDmg}，对所有敌方后台角色造成3点[穿透伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/a/a0/hl9rfd4cwbif4a7gw3zmep0cdsgn6mu.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a74c053cad9ec216f37e5dc8ab5094d0_6153800052390998584.png')
                .burst(3).damage(4).cost(4).handle(() => ({ pdmg: 3 }))
        ),

    1404: () => new HeroBuilder(29).name('赛诺').sumeru().electro().polearm()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/7f62549984cde8b10d694d05c0618a06_5004521367910517162.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/bf685f0e1d6e30d903fb7c9202a4acdc.png')
        .normalSkill(new NormalSkillBuilder('七圣枪术'))
        .skills(
            new SkillBuilder('秘仪·律渊渡魂').description('{dealDmg}，【sts114041】的｢凭依｣级数+1。').description('{dealDmg}。', 'v4.8.0')
                .src('https://patchwiki.biligame.com/images/ys/4/4e/07nlgs0ws704oq4zbisr6ocw66qiyxh.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/4158f2729a2812dd54941af53f348acc_440344287585392498.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('圣仪·煟煌随狼行').description('{dealDmg}，【sts114041】的｢凭依｣级数+2。')
                .src('https://patchwiki.biligame.com/images/ys/4/43/97c3rcihd4xaaxhdqfmjiy5acjtr6xs.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a4c6f2756a7b065b0319bddd5f9d61ee_4163672646150158077.png')
                .burst(2).damage(4).cost(4),
            new SkillBuilder('行度誓惩').description('战斗开始时，初始附属【sts114041】。')
                .src('https://patchwiki.biligame.com/images/ys/7/71/7jaouwue7o0q82ndc0f2da0sw5nxc4d.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/c61b597d14d7915b53d8bf462e8ad609_6351825637878214573.png')
                .passive().handle(() => ({ trigger: ['game-start', 'revive'], status: 114041 }))
        ),

    1405: () => new HeroBuilder(30).name('北斗').since('v3.4.0').liyue().electro().claymore()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/20a9053476de0a5b82ae38f678df287b_1479624244948739352.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/f68c082b2adf084ad7783776ceb1c334.png')
        .normalSkill(new NormalSkillBuilder('征涛'))
        .skills(
            new SkillBuilder('捉浪').description('本角色附属【sts114051】，并[准备技能]：【rsk14054】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e5/k9meeap7ei7ox3q9yx4b6803v79m6om.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/12/09/12109492/ab87d12b9075094e4ddc0637d3d938ba_5680751413245970029.png')
                .elemental().cost(3).handle(() => ({ status: [114051, 114055] })),
            new SkillBuilder('斫雷').description('{dealDmg}，生成【sts114053】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e8/738iv8ypner8eho40gwxipqfr6hzfdg.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/12/09/12109492/de30554b41553d6c58e6922c47937862_5183453852325935866.png')
                .burst(3).damage(2).damage(3, 'v3.8.0').cost(3).cost(4, 'v3.8.0').handle(() => ({ status: 114053 }))
        ),

    1406: () => new HeroBuilder(31).name('九条裟罗').since('v3.5.0').offline('v1').inazuma().electro().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/7bef3d1a8bfd273866a62b05ce89c0c2_2441417120175670805.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/668657253155dc79461268e4be2b93b6.png')
        .normalSkill(new NormalSkillBuilder('天狗传弓术'))
        .skills(
            new SkillBuilder('鸦羽天狗霆雷召咒').description('{dealDmg}，召唤【smn114061】。')
                .src('https://patchwiki.biligame.com/images/ys/7/7a/0we2peecoitxx412iw1toi30feb7uqz.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/cf253866ef5fd4ae4d19e81afbefd074_689676764945311191.png')
                .elemental().damage(1).cost(3).handle(() => ({ summon: 114061 })),
            new SkillBuilder('煌煌千道镇式').description('{dealDmg}，召唤【smn114062】。')
                .src('https://patchwiki.biligame.com/images/ys/8/88/a454xedesmgk8h4a9q4f4wddudzzkwq.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/02/04/12109492/affa346d8b3bdc6281da340c52f5c4a4_394143682255893684.png')
                .burst(2).damage(1).cost(4).handle(() => ({ summon: 114062 }))
        ),

    1407: () => new HeroBuilder(32).name('雷电将军').since('v3.7.0').inazuma().electro().polearm()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e9cb40e812da2147e3786f7cc3b2bd7d_208524583698335951.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/4069a33a82e3fc1327f97e14de6d16eb.png')
        .normalSkill(new NormalSkillBuilder('源流'))
        .skills(
            new SkillBuilder('神变·恶曜开眼').description('召唤【smn114071】。')
                .src('https://patchwiki.biligame.com/images/ys/2/2e/7b213rdcyu4wbzbt2lyz3xge9jur2u6.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ca5a55d164f3a97852b0d7fc59d09875_1236252164045819134.png')
                .elemental().cost(3).handle(() => ({ summon: 114071 })),
            new SkillBuilder('奥义·梦想真说').description('{dealDmg}，其他我方角色获得2点[充能]。')
                .src('https://patchwiki.biligame.com/images/ys/8/84/3elwfz4r3jrizlpe5zx9f0vhqzc7aef.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e32265b2715186774b8d4bcf3d918880_1471851977626289486.png')
                .burst(2).damage(3).cost(4).handle(event => {
                    const { heros = [], talent, hero: { heroStatus } } = event;
                    const hidxs: number[] = heros.filter(v => !v.isFront).map(v => v.hidx);
                    const sts114072 = getObjById(heroStatus, 114072);
                    return {
                        addDmgCdt: (sts114072?.useCnt ?? 0) * (talent ? 2 : 1),
                        cmds: [{ cmd: 'getEnergy', cnt: 2, hidxs }],
                    }
                }),
            new SkillBuilder('诸愿百眼之轮').description('战斗开始时，初始附属【sts114072】。')
                .src('https://patchwiki.biligame.com/images/ys/0/0f/5ardhper4s2i541lmywmazv31hfn0q9.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2df2771f98519d3d46ad0551977ca99a_7788585308123167206.png')
                .passive().handle(() => ({ trigger: ['game-start', 'revive'], status: 114072 }))
        ),

    1408: () => new HeroBuilder(33).name('八重神子').since('v3.7.0').inazuma().electro().catalyst()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/7e55525ee5cff216360b46322aa107ee_5470950562732053429.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/82839e50c43ef6d72676e9b6957fadba.png')
        .normalSkill(new NormalSkillBuilder('狐灵食罪式'))
        .skills(
            new SkillBuilder('野千役咒·杀生樱').description('召唤【smn114081】。如果场上原本已存在【smn114081】，则额外使其造成的伤害+1。（最多+1）')
                .description('召唤【smn114081】。', 'v5.3.0')
                .src('https://patchwiki.biligame.com/images/ys/3/3d/guf5f3kk06kmo3y0uln71jqsovem8yk.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/5d52bb5027ee98ea6295c7cbe6f75260_4362138600485261556.png')
                .elemental().cost(3).handle((event, ver) => ({ summon: [[114081, isCdt(ver.gte('v5.3.0') && hasObjById(event.summons, 114081), 2)]] })),
            new SkillBuilder('大密法·天狐显真').description('{dealDmg}\\；如果我方场上存在【smn114081】，则将其消灭，然后生成【sts114083】。')
                .src('https://patchwiki.biligame.com/images/ys/e/ea/8y36keriq61eszpx5mm5ph7fvwa07ad.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b5ebdd77cfd7a6e12d1326c08e8f9214_6239158387266355120.png')
                .burst(2).damage(4).cost(3).handle(event => {
                    const { talent, summons = [] } = event;
                    const smn114081Idx = getObjIdxById(summons, 114081);
                    let status: number[] = [];
                    if (smn114081Idx > -1) {
                        summons.splice(smn114081Idx, 1);
                        status.push(114083);
                        if (talent) status.push(114082);
                    }
                    return { status }
                })
        ),

    1409: () => new HeroBuilder(34).name('丽莎').since('v4.0.0').offline('v1').mondstadt().electro().catalyst()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/12/203927054/129fe37de1bed078b49b9bc79ef2e757_1437470149833493317.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/94c38cd6acf1adb7d0fa8cd4e72636e3.png')
        .normalSkill(new NormalSkillBuilder('指尖雷暴').description('；使敌方出战角色附属【sts114091】。')
            .description('；如果此技能为[重击]，则使敌方出战角色附属【sts114091】。', 'v5.1.0', 'v1')
            .handle((event, ver) => ({ statusOppo: isCdt(ver.gte('v5.1.0') || event.isChargedAtk, 114091) })))
        .skills(
            new SkillBuilder('苍雷').description('{dealDmg}\\；如果敌方出战角色未附属【sts114091】，则使其附属【sts114091】。')
                .src('https://patchwiki.biligame.com/images/ys/1/13/1tkxwb0js8qxi9yi8bm6tpub8f9ba19.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/bb9487283d20c857804988ace8572ebc_971397791433710881.png')
                .elemental().damage(2).cost(3).handle(event => {
                    const { eheros = [] } = event;
                    const hasSts = hasObjById(eheros.find(h => h.isFront)?.heroStatus, 114091);
                    return { statusOppo: isCdt(!hasSts, 114091) }
                }),
            new SkillBuilder('蔷薇的雷光').description('{dealDmg}，召唤【smn114092】，使敌方出战角色附属【sts114091】。')
                .description('{dealDmg}，召唤【smn114092】。', 'v4.8.0')
                .src('https://patchwiki.biligame.com/images/ys/0/01/l5uobg3f84vj4x52kanzphba9ype2tw.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/08/03/203927054/d641396daad417dda3c4f9a26f02bfdc_897742072769166162.png')
                .burst(2).damage(2).cost(3).handle((_, ver) => ({ summon: 114092, statusOppo: isCdt(ver.gte('v4.8.0'), 114091) }))
        ),

    1410: () => new HeroBuilder(35).name('多莉').since('v4.2.0').sumeru().electro().claymore()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/20b47c429b784fac1ef2c80d560c93cc_6932125694251188191.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/871b0b3d06bc11d69f9cb1df72309371.png')
        .normalSkill(new NormalSkillBuilder('妙显剑舞·改'))
        .skills(
            new SkillBuilder('镇灵之灯·烦恼解决炮').description('{dealDmg}，召唤【smn114101】。')
                .src('https://patchwiki.biligame.com/images/ys/3/37/1eiismiuis2sxbg937vk1uhz3ge2yr2.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/91280ec7f6956790332305adff93a619_8857314989004908195.png')
                .elemental().damage(2).cost(3).handle(() => ({ summon: 114101 })),
            new SkillBuilder('卡萨扎莱宫的无微不至').description('{dealDmg}，召唤【smn114102】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b7/pzuxl8ukf3do834omkdzx5p8yfape0u.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/a1870db7855c7037f700f74152d1f28e_1635879084262346523.png')
                .burst(2).damage(1).cost(3).handle(event => ({ summon: [[114102, !!event.talent]] }))
        ),

    1411: () => new HeroBuilder(348).name('久岐忍').since('v4.6.0').inazuma().electro().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/97e8a503ac00ee72817a33b15bc6e971_1406073271702365176.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/4a44a309f2d797406a2389655b03234d.png')
        .normalSkill(new NormalSkillBuilder('忍流飞刃斩'))
        .skills(
            new SkillBuilder('越袚雷草之轮').description('生成【sts114111】。如果本角色生命值至少为6，则对自身造成2点[穿透伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/3/31/fv5yfpb6wv4qr22o5shuixr9zqnpxcm.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/2c5603069fd6b7e1738de78d8ee13a40_2690219876080442261.png')
                .elemental().cost(3).handle(event => ({ status: 114111, pdmgSelf: isCdt(event.hero.hp >= 6, 2) })),
            new SkillBuilder('御咏鸣神刈山祭').description('{dealDmg}，治疗本角色2点。')
                .src('https://patchwiki.biligame.com/images/ys/e/e9/s3ky8ara3d50e1z7ced1wyap6iwmhoi.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/20e4d43aa23679f40e2f3afbdb467a3b_3325226986841086396.png')
                .burst(2).damage(4).cost(3).handle(() => ({ heal: 2 }))
        ),

    1412: () => new HeroBuilder(445).name('克洛琳德').since('v5.3.0').fontaine(HERO_TAG.ArkheOusia).electro().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/adef4ee6c8ae0b4db618caf0e86531ff_6176090203850156704.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u502gh/c61c0c32057a97d78f2a1c88d228642e.png')
        .normalSkill(new NormalSkillBuilder('逐影之誓').damage(1)
            .description('如果本角色附属【sts114121】，则此技能少花费1个[无色元素骰]。')
            .handle(event => ({ minusDiceSkill: { skilltype1: isCdt(hasObjById(event.hero.heroStatus, 114121), [0, 1, 0]) } })))
        .skills(
            new SkillBuilder('狩夜之巡').description('自身附属【sts114121】，移除自身所有【sts122】。然后根据所移除的层数，造成[雷元素伤害]，并治疗自身。（伤害和治疗最多4点）')
                .src('https://patchwiki.biligame.com/images/ys/b/b7/agbainwvpxydyft7odt4jvvjlawtjhc.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/12/31/258999284/46fcc98c1a7293e393ee520246fb2693_4818683097172627285.png')
                .elemental().cost(2).handle(event => {
                    const { hero: { heroStatus } } = event;
                    const sts122 = getObjById(heroStatus, 122);
                    const cnt = Math.min(4, sts122?.useCnt ?? 0) || undefined;
                    return { addDmgCdt: cnt, heal: cnt ?? 0, status: 114121, exec: () => sts122?.dispose() }
                }),
            new SkillBuilder('残光将终').description('{dealDmg}，自身附属4层【sts122】。')
                .src('https://patchwiki.biligame.com/images/ys/2/25/rky0mg25hu7cdg7imhukjzv1kof8zfo.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2025/01/01/258999284/69cf1e122a47e7f9be17f270561b3e97_8748368510268606258.png')
                .burst(2).damage(3).cost(3).handle(() => ({ status: [[122, 4]] }))
        ),

    1501: () => new HeroBuilder(36).name('砂糖').offline('v1').mondstadt().anemo().catalyst()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/a6944247959cfa7caa4d874887b40aaa_8329961295999544635.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/f21012595a86a127fcdb5cc4aec87e05.png')
        .normalSkill(new NormalSkillBuilder('简式风灵作成'))
        .skills(
            new SkillBuilder('风灵作成·陆叁零捌').description('{dealDmg}，使对方强制切换到前一个角色。')
                .src('https://patchwiki.biligame.com/images/ys/6/6a/lu1s5jeliurancx62txk0i7pbgeu07d.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/20e905e459a535c372b1c0eacf6dd9d8_1859277343951133632.png')
                .elemental().damage(3).cost(3).handle(() => ({ cmds: [{ cmd: 'switch-before', isOppo: true }] })),
            new SkillBuilder('禁·风灵作成·柒伍同构贰型').description('{dealDmg}，召唤【smn115011】。')
                .src('https://patchwiki.biligame.com/images/ys/8/8b/mfq7sbev9evjdy9lxkfsp96np5fockl.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/2f7e7dededadbb4bec6cd5a1e3b8714a_8254714025319039539.png')
                .burst(2).damage(1).cost(3).handle(event => ({ summonPre: [[115011, !!event.talent]] }))
        ),

    1502: () => new HeroBuilder(37).name('琴').offline('v1').mondstadt().anemo().sword()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/88b869ceca8108bfd6dd14a68d5e9610_2290626250490650584.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/9dd710fa45f1d7df996331ca92b2ae3a.png')
        .normalSkill(new NormalSkillBuilder('西风剑术'))
        .skills(
            new SkillBuilder('风压剑').description('{dealDmg}，使对方强制切换到下一个角色。')
                .src('https://patchwiki.biligame.com/images/ys/7/76/qzlqexf6zwkkcpxpyevb3m4viwepssv.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/68d6fd8c9815617b0491dd19586ae2f4_2703229586151516906.png')
                .elemental().damage(3).cost(3).handle(() => ({ cmds: [{ cmd: 'switch-after', isOppo: true }] })),
            new SkillBuilder('蒲公英之风').description('治疗我方所有角色2点，召唤【smn115021】。')
                .src('https://patchwiki.biligame.com/images/ys/2/23/gqtjyn7ckzz3g0zbtmska8ws1ry1dqj.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e4d3dd465a4f6026ba923619c1827c94_3960747061292563787.png')
                .burst(2).burst(3, 'v4.2.0').cost(4).handle(event => ({ summon: 115021, heal: 2, hidxs: allHidxs(event.heros) }))
        ),

    1503: () => new HeroBuilder(38).name('温迪').since('v3.7.0').mondstadt().anemo().bow()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b8d0f177c157908bbe1ef65774d5a4e5_6672388573788855956.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/0ad1fda4450c4aa9949706c37324ee11.png')
        .normalSkill(new NormalSkillBuilder('神代射术'))
        .skills(
            new SkillBuilder('高天之歌').description('{dealDmg}，生成【sts115031】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fe/hhb16pe3sq5duv4cu299atxbi78k7ae.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/73d15303525e2658bf60d8336109d92e_404486790465744082.png')
                .elemental().damage(2).cost(3).handle(event => ({ status: [[115031, !!event.talent]] })),
            new SkillBuilder('风神之诗').description('{dealDmg}，召唤【smn115034】。')
                .src('https://patchwiki.biligame.com/images/ys/c/cf/iv3keguj9pqi3blf8j9xk10olca914v.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/3e4ec3f94bfd2547b1431d8fa2cd2889_8125698290989309719.png')
                .burst(2).damage(2).cost(3).handle(() => ({ summonPre: 115034 }))
        ),

    1504: () => new HeroBuilder(39).name('魈').since('v3.7.0').liyue().anemo().polearm()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/cdb6d5f322226b118ce989ed2f02e932_3401048792875977242.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/ac4a8ff803416b736c99096b6a7ff33a.png')
        .normalSkill(new NormalSkillBuilder('卷积微尘'))
        .skills(
            new SkillBuilder('风轮两立').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/8/82/16jnimrpz65wm0ch1npu1f35j3mbuyy.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/0f23faa9eda436e8d493764afaac9f5a_3023794288508183778.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('靖妖傩舞').description('{dealDmg}，本角色附属【sts115041】。')
                .src('https://patchwiki.biligame.com/images/ys/9/9f/7dxxr4z59ch7bsg0xaoxxi38meuaeff.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/081c165d08ff75ec2f15215cfc892056_2221900956718137863.png')
                .burst(2).damage(4).cost(3).handle(event => {
                    const { talent } = event;
                    const status = [115041];
                    if (talent) status.push(115042);
                    return { status }
                })
        ),

    1505: () => new HeroBuilder(40).name('枫原万叶').since('v3.8.0').inazuma().anemo().sword()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/0aedb983698b4d5abcd1a4405a0ed634_7726035612370611710.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/83f16b6621747e630856b4e1a831f750.png')
        .normalSkill(new NormalSkillBuilder('我流剑术'))
        .skills(
            new SkillBuilder('千早振').description('{dealDmg}，本角色附属【sts115051】。；如果此技能引发了扩散，则将【sts115051】转换为被扩散的元素。；【此技能结算后：】我方切换到后一个角色。')
                .src('https://patchwiki.biligame.com/images/ys/2/29/f7rwj3qb9kffejm2kt2oq7ltl843nrk.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/c492b46c71485b1377cf8c9f3f5dd6e8_6376046014259793309.png')
                .elemental().damage(1).damage(3, 'v4.8.0').cost(3).handle(event => ({
                    status: [[115051, event.swirlEl]],
                    cmds: [{ cmd: 'switch-after' }],
                })),
            new SkillBuilder('万叶之一刀').description('{dealDmg}，召唤【smn115052】。')
                .src('https://patchwiki.biligame.com/images/ys/4/47/g6cfvzw12ruiclawmxh903fcoowmr9j.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/07/07/183046623/293efb8c9d869e84be6bc02039d72104_7417737523106108019.png')
                .burst(2).damage(1).damage(3, 'v4.8.0').cost(3).handle(() => ({ summonPre: 115052 }))
        ),

    1506: () => new HeroBuilder(41).name('流浪者').since('v4.1.0').anemo().catalyst()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/1c63a8f561bdfe0a7d7e1053ff9c42f8_8476567918375768271.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/942e8b6dc3fcd818cd8067cecb562225.png')
        .normalSkill(new NormalSkillBuilder('行幡鸣弦'))
        .skills(
            new SkillBuilder('羽画·风姿华歌').description('{dealDmg}，本角色附属【sts115061】。')
                .src('https://patchwiki.biligame.com/images/ys/0/0c/p9khnkc2qxezjcsy2yqn1t1608iq7df.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/af6e40020a01e57e5bf16ed76dfadd97_2412715488042159947.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 115061 })),
            new SkillBuilder('狂言·式乐五番').description('{dealDmg}\\；如果角色附属有【sts115061】，则将其移除并使此伤害+1。')
                .src('https://patchwiki.biligame.com/images/ys/3/31/jq8wshhifimtmgedysk1xlscepp9d6l.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/9b7fa91d73564e2cb0cbbbc0d1b75cb3_8357319180909129225.png')
                .burst(3).damage(7).cost(3).handle(event => {
                    const { hero: { heroStatus } } = event;
                    const sts115061 = getObjById(heroStatus, 115061);
                    return { addDmgCdt: isCdt(!!sts115061, 1), exec: () => sts115061?.dispose() }
                })
        ),

    1507: () => new HeroBuilder(320).name('早柚').since('v4.4.0').inazuma().anemo().claymore()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/7ba293dd475e123f98a89e2c6448c22d_2852763407290233167.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/9f7f3f7d1794d4d58b3bce4ba311c170.png')
        .normalSkill(new NormalSkillBuilder('忍刀·终末番'))
        .skills(
            new SkillBuilder('呜呼流·风隐急进').description('{dealDmg}，本角色[准备技能]：【rsk15074】。；如果当前技能引发了扩散，则【rsk15074】将改为造成被扩散元素的伤害。')
                .src('https://patchwiki.biligame.com/images/ys/f/f1/nft00ohrbmn6j4hqssftn7kh4ha3nk5.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/1b3691e9a037a54d02076135237d2925_8714311620973409736.png')
                .elemental().damage(1).cost(3).handle(event => {
                    const { swirlEl = ELEMENT_TYPE.Anemo } = event;
                    return { status: [[115071, swirlEl]] }
                }),
            new SkillBuilder('呜呼流·影貉缭乱').description('{dealDmg}，召唤【smn115072】。')
                .src('https://patchwiki.biligame.com/images/ys/7/74/6cc1al7p5kum4yuwp7rtqt6ymv0gl9y.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/3457c9ea9df5a90c56a5be0d8e30482b_4898602838938710962.png')
                .burst(2).damage(1).cost(3).handle(() => ({ summon: 115072 }))
        ),

    1508: () => new HeroBuilder(282).name('琳妮特').since('v4.3.0').fontaine(HERO_TAG.ArkheOusia).fatui().anemo().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/138a3a7a50a96267097824590e869fe1_5113881666208140363.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/a9748bebc335c1ae1931f633742f818e.png')
        .normalSkill(new NormalSkillBuilder('迅捷礼刺剑'))
        .skills(
            new SkillBuilder('谜影障身法').description('{dealDmg}，本回合第一次使用此技能、且自身生命值不多于8时，治疗自身2点，但是附属【sts115081】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/b2ba9e68ed4a405e54b4786ecac7c3e3.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/2d696e8b97e9fe9fb4572a81786780d6_2735599059161740228.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { hero: { hp }, skill: { useCntPerRound }, talent } = event;
                    const cdt = hp <= 8 && useCntPerRound == 0;
                    const hasTalent = talent && useCntPerRound == 1;
                    return {
                        heal: isCdt(cdt, 2),
                        status: isCdt(cdt, 115081),
                        addDmgCdt: isCdt(hasTalent, 2),
                        cmds: isCdt(hasTalent, [{ cmd: 'switch-before', isOppo: true }]),
                    }
                }),
            new SkillBuilder('魔术·运变惊奇').description('{dealDmg}，召唤【smn115082】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/20bd958ebc8383c98bfff1c6620deade.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/6f97ce81f1862b031947b8a82ec8c680_8034117038151757666.png')
                .burst(2).damage(2).cost(3).handle(() => ({ summon: 115082 }))
        ),

    1509: () => new HeroBuilder(349).name('珐露珊').since('v4.6.0').sumeru().anemo().bow()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/df01c4398360e3884ceef43d0717699d_6350296313348675536.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/0e689ff47e1651bd6178bcc6192b5a11.png')
        .normalSkill(new NormalSkillBuilder('迴身箭术'))
        .skills(
            new SkillBuilder('非想风天').description('{dealDmg}，本角色附属【sts115091】。')
                .src('https://patchwiki.biligame.com/images/ys/a/a5/a1tqqztvc2osslkg9s3oatxesdw8zdm.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/7fb2f931bdb1d001003ac18fa8c5a042_180586662624215779.png')
                .elemental().damage(3).cost(3).handle(() => ({ status: 115091 })),
            new SkillBuilder('抟风秘道').description('{dealDmg}，召唤【smn115093】。')
                .src('https://patchwiki.biligame.com/images/ys/c/ca/da9v501c8j71zqew4flylr7hmqq5r31.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/c992b62ec652ce301ab6e9895aac1284_9109457382282902369.png')
                .burst(2).damage(1).cost(3).handle(event => ({ summon: [[115093, !!event.talent]] }))
        ),

    1510: () => new HeroBuilder(408).name('闲云').since('v5.0.0').liyue().anemo().catalyst()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/25d2e76748611db680909e98c1629e41_2183137475204023064.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u9b0pg/895c928cc596421e6ecb3e12a8f9ff5d.png')
        .normalSkill(new NormalSkillBuilder('清风散花词'))
        .skills(
            new SkillBuilder('朝起鹤云').description('{dealDmg}，生成【sts115101】，本角色附属【sts115104】。')
                .src('https://patchwiki.biligame.com/images/ys/6/6d/ri0edrmy086b2ia85dya1xh5x7thc22.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/1914d2cb4199cd49e28604f105b1e57d_5159935908470746953.png')
                .elemental().damage(1).damage(2, 'v5.4.0').cost(3).handle(() => ({ status: [115101, 115104] })),
            new SkillBuilder('暮集竹星').description('{dealDmg}，治疗所有我方角色1点，生成手牌【crd115102】。')
                .src('https://patchwiki.biligame.com/images/ys/1/1c/qartvv52tlakx38vhaucxgm3zb9xlnn.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/9defe82ef629b59ef3c373d3ba64e492_2031181392714657327.png')
                .burst(2).damage(1).cost(3).handle(event => ({ heal: 1, hidxs: allHidxs(event.heros), cmds: [{ cmd: 'getCard', cnt: 1, card: 115102 }] }))
        ),

    1601: () => new HeroBuilder(42).name('凝光').offline('v1').liyue().geo().catalyst()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/6105ce8dd57dfd2efbea4d4e9bc99a7f_3316973407293091241.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/69b48f96666e12872c81087955a4abcb.png')
        .normalSkill(new NormalSkillBuilder('千金掷'))
        .skills(
            new SkillBuilder('璇玑屏').description('{dealDmg}，生成【sts116011】。')
                .src('https://patchwiki.biligame.com/images/ys/c/c7/fhhajrw49bck487xgc9tm832v1lydan.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e16efaaa1d7a4e0e50c2df84b5870ea3_8679057305261038668.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 116011 })),
            new SkillBuilder('天权崩玉').description('{dealDmg}，如果【sts116011】在场，就使此伤害+2。')
                .src('https://patchwiki.biligame.com/images/ys/a/a7/3s4vt3i6mu5kopy55xern2tdvq2tl2a.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/2930a6e689cea53607ab586a8cde8c97_8943298426488751810.png')
                .burst(3).damage(6).cost(3).handle(event => {
                    const { combatStatus = [] } = event;
                    return { addDmgCdt: isCdt(hasObjById(combatStatus, 116011), 2) };
                })
        ),

    1602: () => new HeroBuilder(43).name('诺艾尔').offline('v1').mondstadt().geo().claymore()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/e985b9bc4ec19c9e982c5b018ebbd74e_3315904207091435338.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/a1163fe769ec8e0e244e952e8f7c9f9d.png')
        .normalSkill(new NormalSkillBuilder('西风剑术·女仆'))
        .skills(
            new SkillBuilder('护心铠').description('{dealDmg}，生成【sts116021】。')
                .src('https://patchwiki.biligame.com/images/ys/d/de/bfodvzfdm75orbjztzb2tu29vc1cr2f.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/1b0a3de6e27ee7758a947371fb4789ad_6207555536600733923.png')
                .elemental().damage(1).cost(3).handle(() => ({ status: 116021 })),
            new SkillBuilder('大扫除').description('{dealDmg}，本角色附属【sts116022】。')
                .src('https://patchwiki.biligame.com/images/ys/6/62/5drxd3veuo8k8peke518xe7kyfxl4yr.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e3847d4db2fd91fcd97388ab950598fd_6553932389060621914.png')
                .burst(2).damage(4).cost(4).handle(() => ({ status: 116022 }))
        ),

    1603: () => new HeroBuilder(44).name('钟离').since('v3.7.0').liyue().geo().polearm()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/025bfe8320c376254bec54a9507ad33a_604601120081367211.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/1f8e8ca48f32c190a937fc519e706b92.png')
        .normalSkill(new NormalSkillBuilder('岩雨'))
        .skills(
            new SkillBuilder('地心').description('{dealDmg}，召唤【smn116031】。')
                .src('https://patchwiki.biligame.com/images/ys/e/ee/k5fhv7fxeg9ofaauivue65iid8mh7ou.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/71af9d46cf47c0b17aabf4805341cfb2_8343080343050934571.png')
                .elemental().damage(1).cost(3).handle(() => ({ summon: 116031 })),
            new SkillBuilder('地心·磐礴').description('{dealDmg}，召唤【smn116031】，生成【sts116032】。')
                .src('https://patchwiki.biligame.com/images/ys/6/6b/4gtr1hu4msb4sulc3tpaq3k7uwvjo9d.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d89ebbeba3f31335d3ccf495fa29adf6_1138994566223638735.png')
                .elemental().damage(3).cost(5).handle(() => ({ summon: 116031, status: 116032 })),
            new SkillBuilder('天星').description('{dealDmg}，目标角色附属【sts116033】。')
                .src('https://patchwiki.biligame.com/images/ys/a/a3/isu08rwkjyir4rbkc3rk2bk15ko8y7a.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/03c6245c3468e7d518e1292ac0f22c5a_8147918389515243613.png')
                .burst(3).damage(4).cost(3).handle(() => ({ statusOppo: 116033 }))
        ),

    1604: () => new HeroBuilder(45).name('阿贝多').since('v4.0.0').mondstadt().geo().sword()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/08/12/82503813/5ec1824cea9aad20a4e2ddca9f4b090e_8072421465872569194.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/5bc8d6153d2a0f33252114d8c0754a23.png')
        .normalSkill(new NormalSkillBuilder('西风剑术·白'))
        .skills(
            new SkillBuilder('创生法·拟造阳华').description('召唤【smn116041】。')
                .src('https://patchwiki.biligame.com/images/ys/4/49/7juclt9sdhys5cqpsszabbcgvr80onv.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/d74358fdddc26940e736836760dd7c94_829927587434288065.png')
                .elemental().cost(3).handle(() => ({ summon: 116041 })),
            new SkillBuilder('诞生式·大地之潮').description('{dealDmg}。如果【smn116041】在场，就使此伤害+2。')
                .src('https://patchwiki.biligame.com/images/ys/b/b7/jtvi7qufpjdnlob7t4vj8afpbqxi9w8.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/08/02/82503813/75d7ab3b57d9db6cee911be55e21a4a0_3851331594331778687.png')
                .burst(2).damage(4).cost(3).handle(event => {
                    const { summons = [] } = event;
                    return { addDmgCdt: isCdt(hasObjById(summons, 116041), 2) };
                })
        ),

    1605: () => new HeroBuilder(46).name('荒泷一斗').since('v3.6.0').inazuma().geo().claymore()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/0f6a96fb219e919f92c2768dd4a8d17d_2763599020845762537.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/a7f896027d32b91c3cbab7a77d53b62e.png')
        .normalSkill(new NormalSkillBuilder('喧哗屋传说'))
        .skills(
            new SkillBuilder('魔杀绝技·赤牛发破！').description('{dealDmg}，召唤【smn116051】，本角色附属【sts116054】。')
                .src('https://patchwiki.biligame.com/images/ys/a/a5/3jpx4gxudn54mk2ll6v5mxl0hqrt3e5.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/b4b64a69f56b22af463637781ef1c035_1284380292638397340.png')
                .elemental().damage(1).cost(3).handle(() => ({ summon: 116051, status: 116054 })),
            new SkillBuilder('最恶鬼王·一斗轰临！！').description('{dealDmg}，本角色附属【sts116053】。')
                .src('https://patchwiki.biligame.com/images/ys/0/08/al3ofu1w19zdogu1bf0pqvj7qjx9nc4.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/ba4c88cde04f2cd06944ddcda99c5475_7502957554265579801.png')
                .burst(3).damage(4).damage(5, 'v4.2.0').cost(3).handle(() => ({ status: 116053 }))
        ),

    1606: () => new HeroBuilder(283).name('五郎').since('v4.3.0').inazuma().geo().bow()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/a7a11aafd2166bd18514eb85107bbe6f_8372190332816763613.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/25cce22b0e3bb52323b98ca51942645c.png')
        .normalSkill(new NormalSkillBuilder('呲牙裂扇箭'))
        .skills(
            new SkillBuilder('犬坂吠吠方圆阵').description('{dealDmg}，生成【sts116061】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/82cfdcfa18c2ac51c7d7c80ad271b850.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/3d25c8d7ea6541f2b0873f0dad5892a0_8644416094552727288.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 116061 })),
            new SkillBuilder('兽牙逐突形胜战法').description('{dealDmg}，生成【sts116061】，召唤【smn116062】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/0d85c76bf3b545043bed5237d3713569.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/44d2af6450e8e7b56f1108e96609754c_6106169218939314736.png')
                .burst(2).damage(2).cost(3).handle(() => ({ status: 116061, summon: 116062 }))
        ),

    1607: () => new HeroBuilder(366).name('云堇').since('v4.7.0').liyue().geo().polearm()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/1d2e9fbd3e021de0c2e944e9c3dbfab3_8286048443691981221.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/e293da3c41de47ddc78daf4af1950a32.png')
        .normalSkill(new NormalSkillBuilder('拂云出手'))
        .skills(
            new SkillBuilder('旋云开相').description('生成【sts116073】，本角色附属【sts116071】并[准备技能]：【rsk16074】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/1800fefaf04f62c348cfecf558a0d573.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/9653b6a5d3fda17c3e8443962584b311_4509508959084319555.png')
                .elemental().cost(3).handle(() => ({ status: [116073, 116072, 116071] })),
            new SkillBuilder('破嶂见旌仪').description('{dealDmg}，生成3层【sts116073】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/4fbd00e2cf6f2931fdf7c1d3c3f3d196.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/289c56363620f16b7372fc097b9a9883_846777564977909040.png')
                .burst(2).damage(2).cost(3).handle(() => ({ status: [[116073, 3]] }))
        ),

    1608: () => new HeroBuilder(396).name('娜维娅').since('v4.8.0').fontaine(HERO_TAG.ArkheOusia).geo().claymore()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/4c23484ade8f496c7bbf790a1dd43d30_170105147546023510.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/684bdd3ce161df1f5acb5ddc4aa59505.png')
        .normalSkill(new NormalSkillBuilder('直率的辞绝'))
        .skills(
            new SkillBuilder('典仪式晶火').description('{dealDmg}，本角色附属【sts116084】\\；从手牌中[舍弃]至多5张【crd116081】，每[舍弃]1张都使此伤害+1并抓1张牌。')
                .src('https://patchwiki.biligame.com/images/ys/7/71/nfo33f6mtxhgnz8i0a2sy8sgmv15fwm.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/d0dcd28c67d7d98130a278f53fcb774c_2487646826758507883.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { hcards = [] } = event;
                    const cnt = Math.min(5, hcards.filter(c => c.id == 116081).length);
                    return { addDmgCdt: cnt, status: 116084, cmds: [{ cmd: 'discard', cnt, card: 116081 }, { cmd: 'getCard', cnt }] }
                }),
            new SkillBuilder('如霰澄天的鸣礼').description('{dealDmg}，对所有敌方后台角色造成1点[穿透伤害]。召唤【smn116082】，生成1张【crd116081】加入手牌。')
                .src('https://patchwiki.biligame.com/images/ys/4/47/8e1kz8l4bi9oqq01b9het09tpn9ssso.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/7ae275333bb0c81948bea2c0d00a23aa_778675072682900471.png')
                .burst(2).damage(1).cost(3).handle(() => ({ pdmg: 1, summon: 116082, cmds: [{ cmd: 'getCard', cnt: 1, card: 116081 }] })),
            new SkillBuilder('互助关系网').description('【敌方角色受到结晶反应伤害后：】生成3张【crd116081】，随机置入我方牌库中。')
                .src('https://patchwiki.biligame.com/images/ys/6/6c/l8wc2drm8xfqy6r6xx67wdz4v9juh71.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/9a263a986264889c557bf0d205e8c7a8_1252019379378683321.png')
                .passive().handle(() => ({ trigger: ['Crystallize-oppo'], cmds: [{ cmd: 'addCard', cnt: 3, card: 116081 }] }))
        ),

    1609: () => new HeroBuilder(420).name('千织').since('v5.1.0').inazuma().geo().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/0c071f2c9c3766e11e8c78b4fec8bcfa_5816124722791875404.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u539vg/3c860e49ed049afab518114f5639b046.png')
        .normalSkill(new NormalSkillBuilder('心织刀流'))
        .skills(
            new SkillBuilder('羽袖一触').description('从3个【smn116097】中[挑选]1个召唤。')
                .src('https://patchwiki.biligame.com/images/ys/c/c1/o1q0bq8i2xiqwwtzpadn62ht0f1mk92.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/8ef27719f84860001bce5a1f5df2dcd3_8474447068629975560.png')
                .elemental().cost(3).handle(event => {
                    const { talent } = event;
                    return {
                        summonPre: isCdt(!!talent, 116094),
                        pickCard: {
                            cnt: talent ? 4 : 3,
                            mode: CMD_MODE.GetSummon,
                            card: [116091, 116092, 116093, 116095, 116096],
                        }
                    }
                }),
            new SkillBuilder('二刀之形·比翼').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/0/02/cdpd5piic1usrgyidali0ij8m5gcu4h.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/6b70159787ab6231003590f7ec5309d2_291726310963939149.png')
                .burst(2).damage(5).cost(3)
        ),

    1701: () => new HeroBuilder(47).name('柯莱').offline('v1').sumeru().dendro().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/cca275e9c7e6fa6cf61c5e1d6768db9d_4064677380613373250.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/a0f79ba2105b03a5b72e01c14c1ee79c.png')
        .normalSkill(new NormalSkillBuilder('祈颂射艺'))
        .skills(
            new SkillBuilder('拂花偈叶').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/1/17/pr0uli0a3fs8r3qiotnnx0ikaeudmw4.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/1bfdd645a02ea655cf3d4fa34d468a36_6197207334476477244.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { talent } = event;
                    if (!talent || talent.perCnt <= 0) return;
                    return { statusPre: 117012, exec: () => talent.minusPerCnt() };
                }),
            new SkillBuilder('猫猫秘宝').description('{dealDmg}，召唤【smn117011】。')
                .src('https://patchwiki.biligame.com/images/ys/c/ca/hthhze7cs9vq6uazr06lqu2dhserw7n.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/0b58649d9870ae67b3e956820f164d6f_5553345163926201274.png')
                .burst(2).damage(2).cost(3).handle(() => ({ summon: 117011 }))
        ),

    1702: () => new HeroBuilder(48).name('提纳里').since('v3.6.0').sumeru().dendro().bow()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/33a72f8ddf94c32c750dd7c5c75d928e_176590332162344255.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/0ca272d70321db004cae3cb271b330f3.png')
        .normalSkill(new NormalSkillBuilder('藏蕴破障'))
        .skills(
            new SkillBuilder('识果种雷').description('{dealDmg}，本角色附属【sts117021】。')
                .src('https://patchwiki.biligame.com/images/ys/3/31/s5y6cir0ywerb7tr4jf6wol6c04853j.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/2c6ed232f35902bac751007dfa939cd5_4160841179457575513.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 117021 })),
            new SkillBuilder('造生缠藤箭').description('{dealDmg}，对所有敌方后台角色造成1点[穿透伤害]。')
                .src('https://patchwiki.biligame.com/images/ys/5/51/b0eieymbvfevi1ai796ect5s4eg9t84.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2023/03/28/12109492/417d1805fd1254e78a4b04530e33e066_3564804613469935798.png')
                .burst(2).damage(4).cost(3).handle(() => ({ pdmg: 1 }))
        ),

    1703: () => new HeroBuilder(49).name('纳西妲').since('v3.7.0').sumeru().dendro().catalyst()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/7bd8cbd84e026de8af13599573750f63_9093638409228219545.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/442b83b64081b49383de8f77e43eb80c.png')
        .normalSkill(new NormalSkillBuilder('行相'))
        .skills(
            new SkillBuilder('所闻遍计').description('{dealDmg}，目标角色附属【sts117031】\\；如果在附属前目标角色已附属有【sts117031】，就改为对所有敌方角色附属【sts117031】。')
                .src('https://patchwiki.biligame.com/images/ys/8/8b/hfb5j6xnze5j5e5tmixhieq59y78fwn.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ca47312e3d57bc47516b703e9a7d5615_6453606035541146217.png')
                .elemental().damage(2).cost(3).handle(event => {
                    const { eheros = [], heros = [] } = event;
                    const hidxs = isCdt(hasObjById(eheros.find(h => h.isFront)?.heroStatus, 117031), allHidxs(heros));
                    return { statusOppoPre: 117031, hidxs };
                }),
            new SkillBuilder('所闻遍计·真如').description('{dealDmg}，所有敌方角色附属【sts117031】。')
                .src('https://patchwiki.biligame.com/images/ys/6/64/qq68p4qre9yxfhxkn97q9quvgo3qbum.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d30e1ee8bc69a2235f36b74ddda3832b_8853500709483692571.png')
                .elemental().damage(3).cost(5).handle(event => ({ statusOppoPre: 117031, hidxs: allHidxs(event.heros) })),
            new SkillBuilder('心景幻成').description('{dealDmg}，生成【sts117032】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b2/hiqeufp1d8c37jqo8maxpkvjuiu32lq.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ab5d92e19144f4e483bce180409d0ecf_4393685660579955496.png')
                .burst(2).damage(4).cost(3).handle(event => {
                    const { talent, heros = [] } = event;
                    const elements = heros.filter(h => h.hp > 0).map(h => h.element);
                    return { statusAfter: [[117032, !!talent, elements.includes(ELEMENT_TYPE.Hydro)]] }
                })
        ),

    1704: () => new HeroBuilder(50).name('瑶瑶').since('v4.1.0').liyue().dendro().polearm()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/a351e4595bfcbec661319951fd9bc7c1_739695784762644208.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/4cf30a41392384d709e3d958a29dfab0.png')
        .normalSkill(new NormalSkillBuilder('颠扑连环枪'))
        .skills(
            new SkillBuilder('云台团团降芦菔').description('召唤【smn117041】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b9/1kp0f3qy6c5glhcphgbxi3nze2nq695.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/73c9611548f96cbcaaa820548576ff81_266542015961172436.png')
                .elemental().cost(3).handle(event => ({ summon: [[117041, !!event.talent]] })),
            new SkillBuilder('云颗珊珊月中落').description('{dealDmg}，生成【sts117043】。')
                .src('https://patchwiki.biligame.com/images/ys/6/6e/34fahwmjls4qg1gnq2ew4v0mdxa2hqg.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/f364530033902093e271b5b3b26c0018_6031597060341810921.png')
                .burst(2).damage(1).cost(4).handle(() => ({ status: 117043 }))
        ),

    1705: () => new HeroBuilder(51).name('白术').since('v4.2.0').liyue().dendro().catalyst()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/0251f3d9b514e6971ccb10284a9340a9_5804585615005847738.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/80f126aa0347192046fdb7ff1d8304bf.png')
        .normalSkill(new NormalSkillBuilder('金匮针解'))
        .skills(
            new SkillBuilder('太素诊要').description('{dealDmg}，召唤【smn117051】。')
                .src('https://patchwiki.biligame.com/images/ys/5/54/7wvszy5h117tqsmaz7xs3bejqswdhvb.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/9b90e33f91378f8e5870959f184d5d44_8164440439409077402.png')
                .elemental().damage(1).cost(3).handle(() => ({ summon: 117051 })),
            new SkillBuilder('愈气全形论').description('生成【sts117052】和【sts117053】。')
                .src('https://patchwiki.biligame.com/images/ys/b/b9/6hkbfzw7gp37q857d9cz779lqrctziz.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/04/258999284/1cd096e52394a3e30c8617e8025e23f4_7844475516100755523.png')
                .burst(2).cost(4).handle(() => ({ status: [117052, 117053] }))
        ),

    1706: () => new HeroBuilder(284).name('艾尔海森').since('v4.3.0').sumeru().dendro().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/2b1b835110bfe23777d9e9a19a010c4b_6565453178979267276.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/987050c315dd16f26cfd23acc48c9114.png')
        .normalSkill(new NormalSkillBuilder('溯因反绎法'))
        .skills(
            new SkillBuilder('共相·理式摹写').description('{dealDmg}，本角色附属【sts117061】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/02a567f5717fcd6351cb861142722369.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/66d0bbacd89e3b8c5ffe2ffb8bd88fb8_8269978882036661533.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 117061 })),
            new SkillBuilder('殊境·显象缚结').description('{dealDmg}。消耗【sts117061】，此伤害提升所消耗【sts117061】的持续回合值。如果消耗【sts117061】的持续回合为0/1/2，则为角色附属持续回合为3/2/1的【sts117061】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/7d8db8835772773ef227796ba9955c31.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/3e3c04e07682dde6272b8569f39e7359_862983076929139931.png')
                .burst(2).damage(4).cost(3).handle(event => {
                    const { hero: { heroStatus }, talent } = event;
                    const sts117061 = getObjById(heroStatus, 117061);
                    const rcnt = sts117061?.roundCnt ?? 0;
                    return {
                        status: isCdt(!sts117061, [[117061, 3]]),
                        addDmgCdt: rcnt,
                        exec: () => { sts117061 && (sts117061.roundCnt = 3 - (!!talent ? 0 : rcnt)) }
                    }
                })
        ),

    1707: () => new HeroBuilder(336).name('绮良良').since('v4.5.0').inazuma().dendro().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/650f884967057168a0b9b4025a032c11_2097188456727270580.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/5a8903dcc480dd442f17404bd3630d93.png')
        .normalSkill(new NormalSkillBuilder('箱纸切削术'))
        .skills(
            new SkillBuilder('呜喵町飞足').description('生成【sts117071】和【sts117072】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e6/t5pihmh5sg8ccu6nm7stvb71maxxz9x.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/f19df62c04e80071c2278ae5ef2f21ff_8786745388682460864.png')
                .elemental().cost(3).handle(() => ({ status: [117071, 117072] })),
            new SkillBuilder('秘法·惊喜特派').description('{dealDmg}，在敌方场上生成【sts117073】。')
                .src('https://patchwiki.biligame.com/images/ys/9/9a/dbkhj9brr5xbkjgx56nabv1dgk7gxio.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/02/28/258999284/562bc0909575afbc29f1971ae2c4b24d_5181008040290623097.png')
                .burst(2).damage(4).cost(3).handle(() => ({ statusOppo: 117073 }))
        ),

    1708: () => new HeroBuilder(367).name('卡维').since('v4.7.0').sumeru().dendro().sword()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/2879f08ce85d5ab6c5b69e8e729923e5_5879182844975848941.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/b7673cdfbbc24627cabf32bb1a3efe0c.png')
        .normalSkill(new NormalSkillBuilder('旋规设矩'))
        .skills(
            new SkillBuilder('画则巧施').description('{dealDmg}，生成【sts117082】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/1ae339d4c664e477455b738f1bbb52ed.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/c16266bb9d15e3d2f72b5c9928d8c3da_4617658453359064497.png')
                .elemental().damage(2).cost(3).handle(() => ({ status: 117082 })),
            new SkillBuilder('繁绘隅穹').description('{dealDmg}，本角色附属【sts117081】，生成2层【sts117082】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/203718fd9317e4c089e8ae572c04e40e.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/40b352ac9244264e9eecf3413512fae2_1420990360545160672.png')
                .burst(2).damage(3).cost(3).handle(() => ({ status: [117081, [117082, 2]] }))
        ),

    1709: () => new HeroBuilder(455).name('基尼奇').since('v5.4.0').natlan().dendro().claymore()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/4656f4ff645d719e6621821c16038822_3079189442707648158.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u8c1lh/afdcc3827593f09ace6932ea92516f9d.png')
        .normalSkill(new NormalSkillBuilder('夜阳斗技'))
        .skills(
            new SkillBuilder('悬猎·游骋高狩').description('选一个我方角色，自身附属【sts117091】并进入【sts117092】。{dealDmg}，然后与所选角色交换位置。')
                .src('https://patchwiki.biligame.com/images/ys/a/a2/08equlc0irtfiur6id02qiwromqwpl5.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/cccdba35b77374e5ef8c19c7d429f985_1146383664533306901.png')
                .elemental().damage(2).cost(3).canSelectHero(1).handle(event => ({
                    cmds: [{ cmd: 'exchangePos', hidxs: [event.hero.hidx, event.selectHero ?? -1] }],
                    statusPre: [117092, 117091],
                })),
            new SkillBuilder('向伟大圣龙致意').description('{dealDmg}，召唤【smn117093】。')
                .src('https://patchwiki.biligame.com/images/ys/1/1d/n9v0lfr4q0xiampd0miscmsqnfloqjt.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2025/02/11/258999284/1a120150229bd26a62ef3ce3dae3b478_6999667122640021034.png')
                .burst(2).damage(1).cost(3).handle(() => ({ summon: 117093 })),
        ),

    2101: () => new HeroBuilder(52).name('愚人众·冰萤术士').since('v3.7.0').fatui().cryo()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/549d1869ad1f7d1d27fb5c733a239373_8053361497142459397.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/22a03af7f319a9d1583bc8d33781c241.png')
        .normalSkill(new NormalSkillBuilder('冰萤棱锥').catalyst().handle(event => {
            if (hasObjById(event.summons, 121011)) return { summon: [[121011, 1]] }
        }))
        .skills(
            new SkillBuilder('虚雾摇唤').description('{dealDmg}，召唤【smn121011】。')
                .src('https://patchwiki.biligame.com/images/ys/6/63/ba46nzqmjmyf97k0w9u5f70ll5b6xwh.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a2577774e5f89006d35488e99dc15531_1749914171755434787.png')
                .elemental().damage(1).cost(3).handle(() => ({ summon: 121011 })),
            new SkillBuilder('冰枝白花').description('{dealDmg}，本角色[附着冰元素]，生成【sts121012】。')
                .src('https://patchwiki.biligame.com/images/ys/5/54/1wmf5ct2ccet6bltjvkqs03jusibbrs.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/1368416ac693a1e50e703e92d93d2043_1088350178906732314.png')
                .burst(3).damage(5).cost(3).handle(event => {
                    const { summons = [] } = event;
                    const useCnt = getObjById(summons, 121011)?.useCnt ?? 0;
                    return { isAttach: true, status: [[121012, useCnt]] }
                })
        ),

    2102: () => new HeroBuilder(277).name('｢女士｣').since('v4.3.0').fatui().cryo()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/f5904898779c5de0fd9cf2f207f5d2f8_1917054016449064269.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/b433655430a3f8d58e2e9f73b83567a3.png')
        .normalSkill(new NormalSkillBuilder('霜锋霰舞').catalyst())
        .skills(
            new SkillBuilder('凛冽之刺').description('{dealDmg}，目标角色附属【sts121022】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/887fc71fd182117241270c692d12a2de.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/fcd147fbb1603eebf7574496af8424df_6173017475342647286.png')
                .elemental().damage(2).cost(3).handle(() => ({ statusOppo: 121022 })),
            new SkillBuilder('红莲冰茧').description('{dealDmg}，治疗本角色2点。移除【sts121021】，本角色永久转换为[｢焚尽的炽炎魔女｣]形态。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/d6cc71f74d274ae4cf0255b403cfb4da.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/ed3c25462958e78b9156b668a319bc7a_1717048070002778416.png')
                .burst(2).damage(4).cost(3).handle(() => ({ heal: 2 })),
            new SkillBuilder('邪眼之威').description('战斗开始时，初始附属【sts121021】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/ed9acfc03544bd410106bc9bd50f3c49.png')
                .passive().handle(() => ({ trigger: ['game-start', 'revive'], status: 121021 }))
        ),

    2103: () => new HeroBuilder(321).name('无相之冰').since('v4.4.0').maxHp(8).monster().cryo()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/452f63cf4e88b83a99bb781e8ae34122_3507980204838910528.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/3d51fdddc0b7e8ffdb4284b4320028d6.png')
        .normalSkill(new NormalSkillBuilder('冰锥迸射').catalyst())
        .skills(
            new SkillBuilder('圆舞冰环').description('{dealDmg}，本角色附属【sts121031】。')
                .src('https://patchwiki.biligame.com/images/ys/9/9d/ff2hpksrbxpfe1wl6iyzcmw44521jmy.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/67efe676784e835017414a7d5e0d4355_8823792902089803501.png')
                .elemental().damage(3).cost(3).handle(() => ({ status: 121031 })),
            new SkillBuilder('冰棱轰坠').description('{dealDmg}，对所有敌方后台角色造成1点[穿透伤害]，召唤【smn121033】。')
                .src('https://patchwiki.biligame.com/images/ys/7/70/2cn3ntlfdulqls3gpsmmm54w8hxk97t.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/6f1d186efcaa3d682cbea2a1009fddfa_3844365324429029242.png')
                .burst(2).damage(2).cost(3).handle(() => ({ pdmg: 1, summon: 121033 })),
            new SkillBuilder('冰晶核心').description('战斗开始时，初始附属【sts121034】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fd/mgyby1c37lbykdol0uuyzduyugfmb0f.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/5e08c69f4911a028c4a559c1de33a4d9_7840872634290634295.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 121034 }))
        ),

    2104: () => new HeroBuilder(397).name('愚人众·霜役人').since('v4.8.0').fatui().cryo()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/a7baaff1ecc4dcda963698919ef2cae4_3934264341680499887.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/16b46893b0a27f52004e9377cd62c623.png')
        .normalSkill(new NormalSkillBuilder('迅捷剑锋'))
        .skills(
            new SkillBuilder('霜刃截击').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/3/3d/9ey3xozz1ho95mjplt7r9exqqh1iqbc.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/58d0c62ef0d8d47f00c04f4dea077279_4513441128219896668.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('掠袭之刺').description('{dealDmg}，本角色附属【sts121042】。')
                .src('https://patchwiki.biligame.com/images/ys/a/ad/j8mjqzvynh98w3e5qkkxe3li00i0tv5.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/91aaf5308bc072b31b6624af8f2ad1f0_601312319464014295.png')
                .burst(2).damage(4).cost(3).handle(() => ({ status: 121042 })),
            new SkillBuilder('血契掠影').description('【本角色使用技能后：】对敌方出战角色附属[可用次数]为（本技能最终伤害值-2）的【sts122】。（最多5层）')
                .src('https://patchwiki.biligame.com/images/ys/8/82/izm590u04twm2v4y5md823l6fqeevof.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/07/07/258999284/78e32bb625cf50b2f92487f8577bff6b_4076485311764645060.png')
                .passive().handle(event => {
                    const { dmg = [], talent, eheros = [] } = event;
                    let fdmg = Math.min(5, Math.max(0, dmg.reduce((a, b) => a + Math.max(0, b), 0) - 2));
                    if (talent) {
                        const ocnt = getObjById(eheros.find(h => h.isFront)?.heroStatus, 122)?.useCnt ?? 0;
                        const fcnt = (ocnt + fdmg) * 2;
                        fdmg = fcnt - ocnt;
                    }
                    if (fdmg <= 0) return;
                    return { trigger: ['after-skill'], statusOppo: [[122, fdmg]] }
                })
        ),

    2201: () => new HeroBuilder(53).name('纯水精灵·洛蒂娅').offline('v1').monster().hydro()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/322de5ae9b660a9bf16eb96908949f20_6864460867288429831.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/aead2d2ae3013f2a1de52e4c77dcffa2.png')
        .normalSkill(new NormalSkillBuilder('翻涌').catalyst())
        .skills(
            new SkillBuilder('纯水幻造').description('随机召唤1种【纯水幻形】。（优先生成不同的类型，召唤区最多同时存在两种【纯水幻形】）')
                .description('随机召唤1种【纯水幻形】。（优先生成不同的类型）', 'v4.3.0')
                .src('https://patchwiki.biligame.com/images/ys/9/94/fh1ril80gsejz0l84u6siiq6lz6tlkr.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/3e2457b116526a30a834120f8c438ca6_2477510128488129478.png')
                .elemental().cost(3).explain('smn122011', 'smn122012', 'smn122013').handle((event, ver) => {
                    const { summons = [], randomInArr } = event;
                    if (!randomInArr) return;
                    const opools = [122011, 122012, 122013];
                    const pools = opools.filter(smnid => !hasObjById(summons, smnid));
                    if (ver.gte('v4.3.0') && pools.length == 1) {
                        pools.length = 0;
                        pools.push(...opools.filter(smnid => hasObjById(summons, smnid)));
                    }
                    const summon = randomInArr(ver.lt('v4.3.0') && pools.length == 0 ? opools : pools);
                    return { summon }
                }),
            new SkillBuilder('林野百态').description('随机召唤2种【纯水幻形】。（优先生成不同的类型，召唤区最多同时存在两种【纯水幻形】）')
                .description('随机召唤2种【纯水幻形】。（优先生成不同的类型）', 'v4.3.0')
                .src('https://patchwiki.biligame.com/images/ys/c/c6/bci7cin5911l7uqva01dft0ak44a1jo.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6924bae6c836d2b494b5a172da6cfd70_4019717338422727435.png')
                .elemental().cost(5).explain('smn122011', 'smn122012', 'smn122013').handle((event, ver) => {
                    const { summons = [], randomInArr } = event;
                    if (!randomInArr) return;
                    const opools = [122011, 122012, 122013];
                    const pools = opools.filter(smnid => !hasObjById(summons, smnid));
                    let summonId1 = -1;
                    if (pools.length == 1) {
                        if (ver.gte('v4.3.0')) return { summon: opools.filter(smnid => hasObjById(summons, smnid)) }
                        summonId1 = pools[0];
                    }
                    if (pools.length == 2) {
                        if (ver.lt('v4.3.0')) return { summon: pools }
                        summonId1 = opools.find(smnid => !pools.includes(smnid))!;
                    }
                    if (pools.length == 3 || (ver.lt('v4.3.0') && pools.length == 0)) {
                        [summonId1] = randomInArr(pools, 2);
                        pools.splice(pools.indexOf(summonId1), 1);
                    }
                    const [summonId2] = randomInArr(pools);
                    return { summon: [summonId1, summonId2] }
                }),
            new SkillBuilder('潮涌与激流').description('{dealDmg}\\；我方每有1个召唤物，再使此伤害+1。')
                .description('{dealDmg}\\；我方每有1个召唤物，再使此伤害+2。', 'v4.2.0')
                .src('https://patchwiki.biligame.com/images/ys/3/3b/8nz5w00ylo8dxpa8gt93f4d6ldjs5d2.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/37dedea23dfa78e8fb4e356bb4a4bed4_1738280724029210097.png')
                .burst(3).damage(4).damage(2, 'v4.2.0').cost(3).handle((event, ver) => {
                    const { talent, summons = [] } = event;
                    if (talent) summons.forEach(smn => smn.addUseCnt(true));
                    return { addDmgCdt: summons.length * (ver.lt('v4.2.0') ? 2 : 1) }
                })
        ),

    2202: () => new HeroBuilder(54).name('愚人众·藏镜仕女').fatui().hydro()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3fc3ca86fcfc5333343aed2bb93f972c_2058660383709712628.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/31cf07745466716c6ecddaa137aaf642.png')
        .normalSkill(new NormalSkillBuilder('水弹').catalyst())
        .skills(
            new SkillBuilder('潋波绽破').description('{dealDmg}，目标角色附属【sts122021】。')
                .src('https://patchwiki.biligame.com/images/ys/b/bb/ejgc07c2acyw7emun013j336cvmksvt.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/72eb60be8d1a88f12671264e29101ad4_5912821621104766081.png')
                .elemental().damage(3).damage(2, 'v5.3.0').damage(3, 'v3.7.0').cost(3)
                .handle(event => ({ statusOppo: [[122021, !!event.talent]] })),
            new SkillBuilder('粼镜折光').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/8/80/1dsnenenx6cm0ojaln742iwx60rzc1r.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/9bd9b0f4cad85c234146ef15518ee57e_5116572838966914686.png')
                .burst(2).damage(5).cost(3)
        ),

    2203: () => new HeroBuilder(350).name('深渊使徒·激流').since('v4.6.0').maxHp(6).monster().hydro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/8e4f28eaf527a26d7b014eed8ee0f966_202629246380655977.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/2fe9a301115a32a2006fa0b075760551.png')
        .normalSkill(new NormalSkillBuilder('波刃锋斩'))
        .skills(
            new SkillBuilder('洄涡锋刃').description('{dealDmg}，然后[准备技能]：【rsk22035】。')
                .src('https://patchwiki.biligame.com/images/ys/2/24/t9ua2iv40wm0f3yig6vxig7onh3up3n.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/84c980b8b25210d2cd1bd9d2377cd932_6861846186263087638.png')
                .elemental().damage(1).damage(2, 'v5.3.0').cost(3).handle(() => ({ status: 122032 })),
            new SkillBuilder('激流强震').description('{dealDmg}，在对方场上生成【sts122033】。')
                .src('https://patchwiki.biligame.com/images/ys/d/d8/oiwyudqa0jod9q7e41b6gsk3ok9g4b8.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/190ea01a320f9023eee1656e09528bb2_8501522101938982601.png')
                .burst(2).damage(3).cost(3).handle(() => ({ statusOppo: 122033 })),
            new SkillBuilder('水之新生').description('战斗开始时，初始附属【sts122031】。')
                .src('https://patchwiki.biligame.com/images/ys/b/bc/361y0pjxizeur4u3r6dolnbu9hdc12m.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/9783051b9763b8f81a40693a8581356b_6481810639931260223.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 122031 }))
        ),

    2204: () => new HeroBuilder(368).name('吞星之鲸').since('v4.7.0').maxHp(5).monster().hydro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/17c1739ef970603be767fa88764fc44f_4845015785088476307.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/e29c46b79a53a6c428d46017eecb52c2.png')
        .normalSkill(new NormalSkillBuilder('碎涛旋跃'))
        .skills(
            new SkillBuilder('迸落星雨').description('{dealDmg}，此角色每有3点【无尽食欲】提供的额外最大生命，此伤害+1（最多+3）。然后[舍弃]1张原本元素骰费用最高的手牌。')
                .description('{dealDmg}，此角色每有3点【无尽食欲】提供的额外最大生命，此伤害+1（最多+4）。然后[舍弃]1张原本元素骰费用最高的手牌。', 'v5.0.0')
                .description('{dealDmg}，此角色每有3点【无尽食欲】提供的额外最大生命，此伤害+1（最多+5）。然后[舍弃]1张原本元素骰费用最高的手牌。', 'v4.8.0')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f5c0f89cf02925ec13e306d11a5f7bd8.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/942e3d28310f4395ee7e3f1580268db8_512199522496433076.png')
                .elemental().damage(1).cost(3).explain('sts122041').handle((event, ver) => {
                    const { hero: { heroStatus } } = event;
                    return {
                        addDmgCdt: Math.min(ver.lt('v4.8.0') ? 5 : ver.lt('v5.0.0') ? 4 : 3, Math.floor(getObjById(heroStatus, 122042)?.useCnt ?? 0) / 3),
                        cmds: [{ cmd: 'discard', mode: CMD_MODE.HighHandCard }],
                    }
                }),
            new SkillBuilder('横噬鲸吞').description('{dealDmg}，对敌方所有后台角色造成1点[穿透伤害]。召唤【smn122043】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/347f4286f0891f1b6937c9ac8cf5b1f7.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/4a25287ec5707c0cbcdfa997c1621224_1686936517736141335.png')
                .burst(2).damage(1).cost(3).handle(event => {
                    const { combatStatus } = event;
                    const sts122041 = getObjById(combatStatus, 122041);
                    if (!sts122041) return;
                    const [, , dmg, cnt] = sts122041.addition;
                    return { pdmg: 1, summon: isCdt(+cnt > 0, [[122043, +dmg, +cnt]]) }
                }),
            new SkillBuilder('无尽食欲').description('战斗开始时，生成【sts122041】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/a9e29da334dce66803ef9edb13b8e8d9.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/66b604a5c6cc6b3ca21c5bee7bee28a5_2353476581760344471.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 122041 }))
        ),

    2205: () => new HeroBuilder(409).name('丘丘水行游侠').since('v5.0.0').hilichurl().hydro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/79deea8fbb624269dc7a85fb22bbf649_2655043128470707650.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u9b0pg/17912c63d03adfefcb3cc1c262909ffb.png')
        .normalSkill(new NormalSkillBuilder('镰刀旋斩'))
        .skills(
            new SkillBuilder('狂澜镰击').description('{dealDmg}。；如果有敌方角色附属有【sts106】或【sts122052】，则本角色获得1点[充能]。（每回合1次）')
                .src('https://patchwiki.biligame.com/images/ys/1/10/lnygbgud3vpwaeo78le24h55nsbz1ke.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/5bcf4aecbc53a844c2a25c980f2ab6ac_2541470900687128535.png')
                .elemental().damage(3).cost(3).perCnt(1).handle(event => {
                    const { eheros = [], skill } = event;
                    if (skill.perCnt <= 0) return;
                    const eStatus = eheros.flatMap(h => h.heroStatus);
                    const eAttachment = eheros.find(h => h.isFront)?.attachElement?.[0];
                    if (eAttachment == ELEMENT_TYPE.Cryo || hasObjById(eStatus, 106) || hasObjById(eStatus, 122052)) {
                        return { cmds: [{ cmd: 'getEnergy', cnt: 1 }], exec: () => { --skill.perCnt } }
                    }
                }),
            new SkillBuilder('浮泡攻势').description('{dealDmg}，生成手牌【crd122051】。')
                .src('https://patchwiki.biligame.com/images/ys/7/78/4l236g81or3zb78ozzojs6dm67wjmev.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/08/27/258999284/1eef9550382f6987f37db0e387ed9ea5_1022099738869474504.png')
                .burst(2).damage(3).cost(3).handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 1, card: 122051 }] }))
        ),

    2301: () => new HeroBuilder(55).name('愚人众·火之债务处理人').maxHp(9).maxHp(10, 'v4.3.0').fatui().pyro()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/9f134f05bb71f0ee1afb33785cf945e9_8487118119361104507.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/de42691212adcb46a66595c833bd3598.png')
        .normalSkill(new NormalSkillBuilder('突刺'))
        .skills(
            new SkillBuilder('伺机而动').description('{dealDmg}，本角色附属【sts123011】。')
                .src('https://patchwiki.biligame.com/images/ys/3/36/rr6eiuoeleum3em795e7r1x687ielwb.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/3903202fe02b486f479ba7f8d32d8658_8665610180849380821.png')
                .elemental().damage(1).cost(3).handle(event => ({ status: [[123011, !!event.talent]] })),
            new SkillBuilder('焚毁之锋').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/5/5a/lz90owtayb7iw587z7ve8nfdfy8eysp.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/7cef125734bc7fb32e80c64c06e5f755_2159532089128773899.png')
                .burst(2).damage(5).cost(3),
            new SkillBuilder('潜行大师').description('战斗开始时，初始附属【sts123011】。')
                .src('https://patchwiki.biligame.com/images/ys/7/7c/13bz5tmyohu7u0xeu56llgv6lp81vlv.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6c9ca6c9b2ecc89b7f6c4d5b6004afea_7794139484811179967.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 123011 }))
        ),

    2302: () => new HeroBuilder(56).name('深渊咏者·渊火').since('v3.7.0').offline('v1').maxHp(6).monster().pyro()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/1e2c28dfe8d5f14a70af6219a888432a_956783985247152270.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/d7d09bef17eaf8c40fc6307bd0458deb.png')
        .normalSkill(new NormalSkillBuilder('拯救之焰').catalyst())
        .skills(
            new SkillBuilder('炽烈箴言').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/b/bd/npp1xbnlyr7e4jn8mznv55dnm3wowxz.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/3090acc4a927cba996b6356f99db87d9_8220742127501145178.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('天陨预兆').description('{dealDmg}，召唤【smn123021】。')
                .src('https://patchwiki.biligame.com/images/ys/d/d3/7igqw47k9eg48907jvj0xqumreiav0v.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/dfa378fb6c635d91b99fcc65edcb0546_1724051858233871114.png')
                .burst(2).damage(3).cost(4).handle(() => ({ summon: 123021 })),
            new SkillBuilder('火之新生').description('战斗开始时，初始附属【sts123022】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fa/8adfhj3wss2apzgmrqqg3zz3cbi92tf.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/24722a3923aa2362a5ecdaa248a3f37b_100670191008092035.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 123022 }))
        ),

    2303: () => new HeroBuilder(285).name('镀金旅团·炽沙叙事人').since('v4.3.0').eremite().pyro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/ccc5db5ede1a2303cc018e18995fbab1_2557032699772032384.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/f9bf42e94783ffb86a7dcbbb9c3e38b8.png')
        .normalSkill(new NormalSkillBuilder('烧蚀之光').catalyst())
        .skills(
            new SkillBuilder('炎晶迸击').description('{dealDmg}，生成1层【sts123032】。').description('{dealDmg}。', 'v5.1.0')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/714623e3c2775d4e7cc1c78573e5443e.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/95c606e65f456edfec8a28c18f17f6cc_4264699545618649047.png')
                .elemental().damage(3).cost(3).handle((_, ver) => ({ status: isCdt(ver.gte('v5.1.0'), 123032) })),
            new SkillBuilder('厄灵苏醒·炎之魔蝎').description('{dealDmg}。整场牌局限制1次，将1张【crd123031】加入我方手牌。')
                .description('{dealDmg}，召唤【smn123031】。', 'v5.1.0')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/637396968147be2805479aebcbe5b825.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/84274abeb2c38f6f46c94dd2953323db_4939077374255699145.png')
                .burst(2).damage(3).damage(2, 'v5.1.0').cost(3).handle((event, ver) => {
                    const { talent, summons = [], skill: { useCnt } } = event;
                    if (ver.lt('v5.1.0')) {
                        const isSmned = hasObjById(summons, 123031);
                        return {
                            summon: [[123031, !!talent]],
                            status: isCdt(!isSmned, [[123033, talent ? 2 : 1]]),
                        }
                    }
                    if (useCnt == 0) return { cmds: [{ cmd: 'getCard', cnt: 1, card: 123031 }] }
                }),
            new SkillBuilder('厄灵之能').description('【此角色受到伤害后：】如果此角色生命值不多于7，则获得1点[充能]。（每回合1次）')
                .description('【此角色受到伤害后：】如果此角色生命值不多于7，则获得1点[充能]。（整场牌局限制1次）', 'v5.1.0')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/9262db8e7ec7952af306117cb67d668d.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/b9854a003c9d7e5b14bed92132391e9e_754640348498205527.png')
                .passive().handle((event, ver) => {
                    const { hero: { hp, hidx }, skill: { useCnt, useCntPerRound }, getdmg = [] } = event;
                    if (hp - getdmg[hidx] > 7) return;
                    if (ver.lt('v5.1.0') && useCnt || ver.gte('v5.1.0') && useCntPerRound) return;
                    return { trigger: ['getdmg'], cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: [hidx] }] }
                })
        ),

    2304: () => new HeroBuilder(351).name('铁甲熔火帝皇').since('v4.6.0').maxHp(5).maxHp(6, 'v5.4.0').monster().pyro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/e96a9a84bdc0f1d2171010770f0605f0_3000155239481283018.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/713d2c89ff5f8e8e8b7da465857dc70f.png')
        .normalSkill(new NormalSkillBuilder('重钳碎击'))
        .skills(
            new SkillBuilder('烈焰燃绽').description('{dealDmg}\\；如果本角色附属有至少7层【sts123041】，则此伤害+1。；然后，本角色附属2层【sts123041】。')
                .src('https://patchwiki.biligame.com/images/ys/e/ee/pkoq2y1juntwzekemn1cu1fiv9h5ed6.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/b73f1ffc4ba14fa027c3e36104bf7119_3142073596996390484.png')
                .elemental().damage(1).cost(3).handle(event => {
                    const { hero: { heroStatus } } = event;
                    const sts123041Cnt = getObjById(heroStatus, 123041)?.useCnt ?? 0;
                    return { addDmgCdt: isCdt(sts123041Cnt >= 7, 1), status: [[123041, 2]] }
                }),
            new SkillBuilder('战阵爆轰').description('本角色[准备技能]：【rsk23046】。')
                .src('https://patchwiki.biligame.com/images/ys/1/13/i71orby9fhck49mknktqyvzdy8lgzse.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/5e576be9db73eed2272d0a78bad44763_3474057319865960269.png')
                .burst(2).cost(3).handle(() => ({ status: 123043 })),
            new SkillBuilder('帝王甲胄').description('战斗开始时：初始附属5层【sts123041】。；【我方执行任意行动后：】如果我方场上存在【sts123041】以外的[护盾]状态或[护盾]出战状态，则将其全部移除\\；每移除1个，就使角色附属2层【sts123041】。')
                .src('https://patchwiki.biligame.com/images/ys/8/87/qph3kacdek5tjt4zh3awlfttsdtv5sm.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/ff758e8c9934e346c98ad5e864cc097e_6735052592007467103.png')
                .passive().handle(event => {
                    const { hero, heros = [], combatStatus = [], trigger = '' } = event;
                    let stsCnt = 0;
                    if (trigger == 'game-start') stsCnt = 5;
                    else if (trigger == 'action-after') {
                        stsCnt += [...heros.flatMap(h => h.heroStatus), ...combatStatus].filter(sts => sts.hasType(STATUS_TYPE.Shield) && sts.id != 123041).length * 2;
                        if (stsCnt > 0 && (hero.talentSlot?.perCnt ?? 0) > 0) stsCnt += 2;
                    }
                    if (stsCnt == 0) return;
                    stsCnt += getObjById(hero.heroStatus, 123041)?.useCnt ?? 0;
                    return {
                        trigger: ['game-start', 'action-after'],
                        status: [[123041, stsCnt]],
                        exec: () => {
                            if (trigger == 'game-start') return;
                            for (const sts of [...heros.flatMap(h => h.heroStatus), ...combatStatus]) {
                                if (sts.hasType(STATUS_TYPE.Shield)) sts.dispose();
                            }
                            if (hero.talentSlot && hero.talentSlot.perCnt > 0) hero.talentSlot.minusPerCnt();
                        }
                    }
                })
        ),

    2401: () => new HeroBuilder(57).name('无相之雷').since('v3.7.0').maxHp(8).monster().electro()
        .src('https://act-upload.mihoyo.com/ys-obc/2023/05/17/183046623/df234a18db1aa6f769ac3b32b0168ebf_4040044349475544115.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/1a3098561b2f1526156ad02d258e6ed5.png')
        .normalSkill(new NormalSkillBuilder('雷晶投射').catalyst())
        .skills(
            new SkillBuilder('猜拳三连击').description('{dealDmg}，然后分别[准备技能]：【rsk24015】和【rsk24016】。')
                .src('https://patchwiki.biligame.com/images/ys/0/03/gxbm4c2a3966ufxlvac2yh21cgawee6.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bb497b9de8d5f5aaecdecd8b54ad7113_1742166172951785514.png')
                .elemental().damage(2).cost(5).handle(() => ({ status: 124011 })),
            new SkillBuilder('雳霆镇锁').description('{dealDmg}，召唤【smn124013】。')
                .src('https://patchwiki.biligame.com/images/ys/8/8d/pol2fxnr3wl5u430iyzcgv9fzjpds1q.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/0a2d29c148c0c9dda778c3d8387ec4c8_6867523488576292893.png')
                .burst(2).damage(2).cost(3).handle(() => ({ summon: 124013 })),
            new SkillBuilder('雷晶核心').description('战斗开始时，初始附属【sts124014】。')
                .src('https://patchwiki.biligame.com/images/ys/1/13/4tkgv2y83mfzyyum8iifx9wqsjfj8af.png',
                    'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/84c224cb71bd755ebeb0ab587bf22901_3554738173380528607.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 124014 }))
        ),

    2402: () => new HeroBuilder(286).name('雷音权现').since('v4.3.0').monster().electro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/7577bb07bad6418da34d16e788e56dc7_5139467133099341814.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/2c69a56d98a6aaf7b24319a362568f9f.png')
        .normalSkill(new NormalSkillBuilder('轰霆翼斩').catalyst())
        .skills(
            new SkillBuilder('雷墙倾轧').description('对附属有【sts124022】的敌方角色{dealDmg}。（如果敌方不存在符合条件角色，则改为对出战角色造成伤害）')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/1f1b73b917fc25ea3c71c08583037cb1.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/ca84fd08636d380d57da96f9a37e9e7f_7121937516609130674.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { eheros = [] } = event;
                    const sts124022hidx = eheros.find(h => hasObjById(h.heroStatus, 124022))?.hidx;
                    if (sts124022hidx == undefined) return;
                    return { atkTo: sts124022hidx }
                }),
            new SkillBuilder('轰雷禁锢').description('{dealDmg}，召唤【smn124023】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/924d4e27f199d95cde09b26ce36d6e8b.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/eb2b0fb434298a92925563a640f462a9_5945618352718846846.png')
                .burst(2).damage(2).cost(3).handle(() => ({ summon: 124023 })),
            new SkillBuilder('雷霆探知').description('战斗开始时，在敌方场上生成【sts124021】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/85101cecf76e834437a758fc19093700.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/eb1d94ce0af17b97f756f8c126a5863a_674902409578889354.png')
                .passive().handle(() => ({ trigger: ['game-start'], statusOppo: 124021 }))
        ),

    2403: () => new HeroBuilder(322).name('千年珍珠骏麟').since('v4.4.0').maxHp(8).monster().electro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/6ea12823806de2c2c7fe62d839410c8b_8031642621604475811.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/54bce42537a3bc38d77aa159d8f61355.png')
        .normalSkill(new NormalSkillBuilder('旋尾扇击'))
        .skills(
            new SkillBuilder('霞舞鱼群').description('{dealDmg}。；【每回合1次：】如果本角色已附属【sts124032】，则使其[可用次数]+1。')
                .src('https://patchwiki.biligame.com/images/ys/3/3a/fej2c9u7kria1j2btaxy7f9o9k7uuyg.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/ba6b95e623fd861b69316a6f649d150c_90481026227323793.png')
                .elemental().damage(3).cost(3).perCnt(1).handle(event => {
                    const { hero: { heroStatus }, skill } = event;
                    const sts124032 = getObjById(heroStatus, 124032);
                    if (skill.perCnt <= 0 || !sts124032) return;
                    return {
                        exec: () => {
                            sts124032.addUseCnt();
                            --skill.perCnt;
                        }
                    }
                }),
            new SkillBuilder('原海古雷').description('{dealDmg}，本角色附属【sts124032】，召唤【smn124031】。')
                .src('https://patchwiki.biligame.com/images/ys/1/1f/popxzd68zzf3mhig28gkekdxhef63zf.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/68b45e352424c4127c47bd9fdee5bd78_7983386802406853220.png')
                .burst(2).damage(1).cost(3).handle(() => ({ status: 124032, summon: 124031 })),
            new SkillBuilder('明珠甲胄').description('战斗开始时，本角色附属【sts124032】。')
                .src('https://patchwiki.biligame.com/images/ys/f/fc/0v3wnltquhqgjaig2kp4o6qicrstkwl.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/17/258999284/34245e37e3d9881e1ac466ba3058fead_3899055182644035950.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 124032 }))
        ),

    2404: () => new HeroBuilder(337).name('愚人众·雷萤术士').since('v4.5.0').fatui().electro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/e7e0e8c1cab4d08764f95d14345c4eef_4303268682366227358.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/84e21c3810a36fda0935379b8fd2a317.png')
        .normalSkill(new NormalSkillBuilder('轰闪落雷').catalyst())
        .skills(
            new SkillBuilder('雾虚之召').description('召唤【smn124041】。')
                .src('https://patchwiki.biligame.com/images/ys/b/ba/gyx575dg0jl0555jhw17pfr0kkge1dg.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/170a763eb069a3f4577b04dbeb73f3a7_245180266074223049.png')
                .elemental().cost(3).handle(() => ({ summon: 124041, statusOppo: 124044 })),
            new SkillBuilder('霆雷之护').description('{dealDmg}，本角色[附着雷元素]，生成【sts124042】并[准备技能]：【rsk24044】。')
                .src('https://patchwiki.biligame.com/images/ys/b/bb/qyleol8t4tzuujvuj3wlfk6h53icvcb.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/7ddbd6e73bea8f907590c964c2f88d98_2187578641261417207.png')
                .burst(2).damage(1).cost(3).handle(event => {
                    const { summons = [] } = event;
                    const useCnt = getObjById(summons, 124041)?.useCnt ?? 0;
                    return { isAttach: true, status: [[124042, useCnt], 124043] }
                })
        ),

    2405: () => new HeroBuilder(369).name('圣骸毒蝎').since('v4.7.0').consecratedBeast().electro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/379deb8c564c0af89f544ff6bab049d2_839388424690765015.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/a0b7c961a2b65824a4d68d461f059298.png')
        .normalSkill(new NormalSkillBuilder('蝎爪钳击'))
        .skills(
            new SkillBuilder('蝎尾锥刺').description('{dealDmg}。；生成1张【crd124051】，随机置入我方牌库顶部2张牌之中。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/ba3107753a28bf55c7279482d9b0c9ed.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/0e1110651dbff69343c8e40bf3c7e93f_6498390434174190990.png')
                .elemental().damage(3).cost(3).handle(() => ({ cmds: [{ cmd: 'addCard', card: 124051, cnt: 1, hidxs: [2] }] })),
            new SkillBuilder('雷锥散射').description('{dealDmg}，[舍弃]手牌中最多3张【crd124051】，在对方场上生成【sts124052】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/4d58f950df06a277f43a21dcdfa58eb0.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/54dc8816d5fb42528ba84eaefb1a8068_7565040194931804591.png')
                .burst(2).damage(3).cost(3).handle(event => {
                    const { hcards = [] } = event;
                    const cnt = Math.min(3, hcards.filter(c => c.id == 124051).length);
                    if (cnt == 0) return;
                    return { cmds: [{ cmd: 'discard', cnt, card: 124051 }], statusOppo: [[124052, cnt]] }
                }),
            new SkillBuilder('不朽亡骸·雷').description('回合结束时，生成两张【crd124051】，随机置入我方牌库顶部10张牌中。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/f2c9fb8d451bc79e309ce9f397738a39.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/02cbaf22d48774e6e7cff5203e9562eb_9127079687708650066.png')
                .passive().handle(() => ({ trigger: ['turn-end'], cmds: [{ cmd: 'addCard', card: 124051, cnt: 2, hidxs: [10] }] }))
        ),

    2406: () => new HeroBuilder(421).name('深渊咏者·紫电').since('v5.1.0').maxHp(6).monster().electro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/a4da9c3a6be238f2edb2f7a59187c3ae_1949002269283702790.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u539vg/91a752a687a07ebac5cd8e8241806cc6.png')
        .normalSkill(new NormalSkillBuilder('渊薮落雷').catalyst())
        .skills(
            new SkillBuilder('秘渊虚霆').description('{dealDmg}。；如果目标已[附着雷元素]，则夺取对方1点[充能]。（如果夺取时此角色[充能]已满，则改为由下一个[充能]未满的角色获得[充能]）')
                .src('https://patchwiki.biligame.com/images/ys/8/80/ja71zowdrykselwnuq05wwwtwz98mqz.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/f06197e6de2668bf74bc73a391116c1f_9175472387527320923.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { eheros = [], heros = [] } = event;
                    const ehero = eheros.find(h => h.isFront);
                    if (!ehero?.attachElement.includes(ELEMENT_TYPE.Electro) || ehero.energy == 0) return;
                    const hidxs = allHidxs(heros, { cdt: h => h.energy < h.maxEnergy }).slice(0, 1);
                    return { cmds: [{ cmd: 'getEnergy', cnt: -1, isOppo: true }, { cmd: 'getEnergy', cnt: 1, hidxs }] }
                }),
            new SkillBuilder('狂迸骇雷').description('{dealDmg}。如果目标[充能]不多于1，造成的伤害+2。')
                .src('https://patchwiki.biligame.com/images/ys/0/0c/g9ebbv77szz3in5lhcizahlcs1l19ft.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/7315eed5a999d03bf46e6fa40a97d2ab_3785888462903729262.png')
                .burst(2).damage(3).cost(3).handle(event => ({ addDmgCdt: isCdt((event.eheros?.find(h => h.isFront)?.energy ?? 3) <= 1, 2) })),
            new SkillBuilder('雷之新生').description('战斗开始时，初始附属【sts124061】。')
                .src('https://patchwiki.biligame.com/images/ys/f/f2/38qfb9pun8odt1sp4anaytzwzsitth7.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/07e9c627e0391e19a7a610b4505a827a_6922644027589193780.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 124061 }))
        ),

    2501: () => new HeroBuilder(58).name('魔偶剑鬼').monster().anemo()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/5b21d3abb8dd7245a8f5f540d8049fcb_59481287402207724.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/f6a1743d67ca3e21074e1f0c704c4549.png')
        .normalSkill(new NormalSkillBuilder('一文字'))
        .skills(
            new SkillBuilder('孤风刀势').description('召唤【smn125011】。').description('{dealDmg},召唤【smn125011】。', 'v3.4.0')
                .src('https://patchwiki.biligame.com/images/ys/f/f2/gucxzyumx6uaumg6r6ms4czbw32v3gt.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a72086131fbe3e03201926a46dac48f3_7155522304163694322.png')
                .elemental().damage(1, 'v3.4.0').cost(3).handle(event => ({
                    summon: 125011,
                    cmds: isCdt(!!event.talent, [{ cmd: 'switch-after' }]),
                })),
            new SkillBuilder('霜驰影突').description('召唤【smn125012】。').description('{dealDmg},召唤【smn125012】。', 'v3.4.0')
                .src('https://patchwiki.biligame.com/images/ys/1/17/a8qboxl35nar8vuaho1cewppy0fp43t.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/6df8766388e62c6a97f9898605fb45e2_6047730151662669218.png')
                .elemental().damage(1, 'v3.4.0').costCryo(3).handle(event => ({
                    summon: 125012,
                    cmds: isCdt(!!event.talent, [{ cmd: 'switch-before' }]),
                })),
            new SkillBuilder('机巧伪天狗抄').description('{dealDmg}，触发我方所有【剑影】召唤物效果。（不消耗其[可用次数]）')
                .src('https://patchwiki.biligame.com/images/ys/f/fd/ren7lbexbnyvrdvn0aqhbrxx6atdoov.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/75142675f9625abbe1d9686f1a7f59b7_6144574132276306286.png')
                .burst(3).damage(4).cost(3)
        ),

    2502: () => new HeroBuilder(287).name('特瓦林').since('v4.3.0').monster().anemo()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/83ef329668e4d3f2521c712881a9a028_6040566226446903836.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/690d318b28b1bde9d7ffc17a337b632b.png')
        .normalSkill(new NormalSkillBuilder('裂爪横击'))
        .skills(
            new SkillBuilder('暴风轰击').description('{dealDmg}，目标角色附属【sts125021】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/6d5115adf3c4273b26e05690e4222f51.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/8e44228dec3be9b4259aa2adb521583b_5399958061718053885.png')
                .elemental().damage(2).cost(3).handle(() => ({ statusOppo: 125021 })),
            new SkillBuilder('风龙涤流').description('{dealDmg}，然后分别[准备技能]：【rsk25025】和【rsk25026】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/8b5ffe13741032cb75964df7fcec0fa2.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/d2d2168c6889018520e518229c610c7b_2627906278875893396.png')
                .elemental().damage(2).cost(5).handle(() => ({ status: 125022 })),
            new SkillBuilder('终天闭幕曲').description('{dealDmg}，所有敌方后台角色附属【sts125021】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/dc176e73075e38839e1557815da53cc8.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/ea18fc2d49dac1d270821cc0f318aa9e_7299667602196853258.png')
                .burst(2).damage(5).cost(4).handle(event => ({ statusOppo: 125021, hidxs: getBackHidxs(event.eheros) }))
        ),

    2503: () => new HeroBuilder(370).name('圣骸飞蛇').since('v4.7.0').monster().consecratedBeast().anemo()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/39bdf909aff15f061d4d9ea3d4c2b2ab_472359532850721936.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/c1d78d82c85022519c595a9ab954ebfb.png')
        .normalSkill(new NormalSkillBuilder('旋尾迅击'))
        .skills(
            new SkillBuilder('盘绕风引').description('{dealDmg}，抓1张牌。')
                .description('{dealDmg}，抓1张【crd124051】\\；然后，手牌中每有1张【crd124051】，抓1张牌（每回合最多抓2张）。', 'v4.8.0')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/8c6ea09bfd6308bb23bf32d96d640487.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/20afc68783ad98f1da36cc3a5286bee6_5169119727722449200.png')
                .elemental().damage(3).damage(2, 'v4.8.0').cost(3).perCnt(2).handle((event, ver) => {
                    if (ver.gte('v4.8.0')) return { cmds: [{ cmd: 'getCard', cnt: 1 }] }
                    const { hcards = [], skill } = event;
                    const cmds: Cmds[] = [{ cmd: 'getCard', cnt: 1, card: 124051, isAttach: true }];
                    let cnt = 0;
                    if (skill.perCnt > 0) {
                        cnt = Math.min(skill.perCnt, hcards.filter(c => c.id == 124051).length + +(hcards.length < 10));
                        cmds.push({ cmd: 'getCard', cnt });
                    }
                    return { cmds, exec: () => { skill.perCnt -= cnt } }
                }),
            new SkillBuilder('错落风涡').description('{dealDmg}，[舍弃]手牌中所有的【crd124051】，每[舍弃]2张，此次伤害翻倍1次。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/468894f96582f384ff87859549de0536.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/65225a24479d53ed9bbc0200d6786423_1124235468902631200.png')
                .burst(2).damage(2).cost(3).handle(event => {
                    const { hcards = [] } = event;
                    const cnt = hcards.filter(c => c.id == 124051).length;
                    return { cmds: [{ cmd: 'discard', cnt, card: 124051 }], multiDmgCdt: 2 ** Math.floor(cnt / 2) }
                }),
            new SkillBuilder('不朽亡骸·风').description('战斗开始时，生成6张【crd124051】，均匀放入牌库。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/b20cdf60cef51f689592487d6587d353.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/3f113b01a3fbab406f2ddb81d9a2a019_675662049327994953.png')
                .passive().handle(() => ({ trigger: ['game-start'], cmds: [{ cmd: 'addCard', cnt: 6, card: 124051, isAttach: true }] }))
        ),

    2601: () => new HeroBuilder(59).name('丘丘岩盔王').maxHp(8).hilichurl().geo()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/db05474f6bdc3a5080e141d72c876548_5712469579238063350.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/2886b95ca3fcd79cf72577fd0276cb94.png')
        .normalSkill(new NormalSkillBuilder('Plama Lawa'))
        .skills(
            new SkillBuilder('Movo Lawa').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/2/25/8sausa1g74119xvltdmopivnxclkn4l.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/e605c46abaca4c05ff7fcc803d318644_1932728961174964565.png')
                .elemental().damage(3).cost(3).dmgElement(DAMAGE_TYPE.Physical),
            new SkillBuilder('Upa Shato').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/e/ef/jc6xafunhp1qi3wcqemc5wir9d973px.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/a63aaedd24cfbefc634b2ac2a77d5f4f_7864871648075602067.png')
                .burst(2).damage(5).cost(3).dmgElement(DAMAGE_TYPE.Physical),
            new SkillBuilder('魔化：岩盔').description('战斗开始时，初始附属【sts126011】和【sts126012】。')
                .src('https://patchwiki.biligame.com/images/ys/3/3e/i50gzgkih3a45yl3df7hvq6143bw6r9.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/60d5501fc29ffb28bc6d2a435b463b2a_6974894146119719968.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: [126011, 126012] }))
        ),

    2602: () => new HeroBuilder(278).name('若陀龙王').since('v4.3.0').monster().geo()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/521fdaa2d51e93166ccbf2a91a1047aa_2809827424052136166.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/1dde94ee671e2a61b42ff051b816f490.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/e1688d349ca1ff0f5f78bb6bdae07b6f.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/8e7128d60419e53054de5daa1e096252.png',
            'https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u084qf/6bfb045422ca297b5ead653065fecfbe.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/949d01e6a23ceba1d6adeae6ac445374.png')
        .normalSkill(new NormalSkillBuilder('碎岩冲撞'))
        .skills(
            new SkillBuilder('磅礴之气').description('{dealDmg}，如果发生了结晶反应，则角色[汲取对应元素的力量]。；如果本技能中角色未汲取元素的力量，则附属【sts126021】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/5ab059679b08fba559b68f7d361a64be.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/b49c1863d6b6a61ec13501c27d8204bf_1566255463657696734.png')
                .elemental().damage(3).cost(3).handle(event => {
                    const { eheros = [] } = event;
                    const crystallizeEl = eheros.find(h => h.isFront)?.attachElement?.find(el => (Object.values(SWIRL_ELEMENT) as PureElementType[]).includes(el)) ?? ELEMENT_TYPE.Geo;
                    if (crystallizeEl == ELEMENT_TYPE.Geo) return { status: 126022 }
                }),
            new SkillBuilder('山崩毁阵').description('{dealDmg}，每汲取过一种元素此伤害+1。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/3eea73a1f50aaa9ab8f03546a0db4483.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/eeb2325a52556c0f9259eb3d47807c45_994928579787374692.png')
                .burst(2).damage(4).cost(3).handle(event => ({ addDmgCdt: getObjById(event.hero.heroStatus, 126021)?.useCnt ?? 0 })),
            new SkillBuilder('磐岩百相').description('战斗开始时，初始附属【sts126021】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u084qf/c7dc740570a4a65821767e0e2ba83529.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/3c29d28a60d100687cf9968a3a278e4d_5040009350976601315.png')
                .passive().handle(() => ({ trigger: ['game-start'], status: 126021 }))
        ),

    2603: () => new HeroBuilder(434).name('黄金王兽').since('v5.2.0').monster().geo()
        .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_card_face_u0263g/50d5c739b78bbfc9456ca75393a85e36.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u0263g/b060baa72903bc181b63c4baa83d430a.png')
        .normalSkill(new NormalSkillBuilder('王狼直击'))
        .skills(
            new SkillBuilder('兽境轰召').description('{dealDmg}，并使对方出战角色附属2层【sts126031】，召唤【smn126032】。')
                .src('https://patchwiki.biligame.com/images/ys/5/58/7e3q4ziz9klancofuscufqq9o59c250.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/4e3681910d6030538828aaca2d9a8ec4_807642467059739344.png')
                .elemental().damage(1).cost(3).handle(event => ({ statusOppo: [[126031, !!event.talent, 2]], summon: 126032 })),
            new SkillBuilder('黄金侵绞').description('{dealDmg}，对所有敌方后台角色造成1点[穿透伤害]，并使所有敌方角色附属【sts126031】。')
                .src('https://patchwiki.biligame.com/images/ys/e/e8/ii9k22imfs6cv033oudl24jprt04vpd.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/11/18/258999284/fa73097822d092389bcf8fff81b90224_4686715611294853097.png')
                .burst(2).damage(3).cost(3).handle(event => {
                    const { eheros = [], talent } = event;
                    return {
                        pdmg: 1,
                        cmds: [{ cmd: 'getStatus', status: [[126031, !!talent]], hidxs: allHidxs(eheros), isOppo: true }],
                    }
                })
        ),

    2701: () => new HeroBuilder(60).name('翠翎恐蕈').offline('v1').monster().dendro()
        .src('https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/83e1eecf95f1e3ba10afad2e2a4de03c_4053328098702513548.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/0c8a00c0737279e0349769448e7a1f35.png')
        .normalSkill(new NormalSkillBuilder('菌王舞步'))
        .skills(
            new SkillBuilder('不稳定孢子云').description('{dealDmg}。')
                .src('https://patchwiki.biligame.com/images/ys/4/46/2tjoad0wz0qn966hqp6vvgfvi07izaf.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/875de1c4943f909a4adf7802bbb1034f_3081914478799274881.png')
                .elemental().damage(3).cost(3),
            new SkillBuilder('尾羽豪放').description('{dealDmg}，消耗所有｢【sts127011】｣层数，每层使本伤害+1。')
                .src('https://patchwiki.biligame.com/images/ys/3/36/gyhrz87493bups3avpelhusplml11gw.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/34525ada2f131e99da075f32283db903_3717723304434052962.png')
                .burst(2).damage(4).cost(3).handle(event => {
                    const { hero: { heroStatus } } = event;
                    return { addDmgCdt: getObjById(heroStatus, 127011)?.useCnt }
                }),
            new SkillBuilder('活化激能').description('战斗开始时，初始附属【sts127011】。')
                .src('https://patchwiki.biligame.com/images/ys/7/79/q3o61yegls3thng3z7dns2sykg2voci.png',
                    'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/f72847095bda0ccb92781ed3f1c1bb4e_1629774298046012918.png')
                .passive().handle(() => ({ trigger: ['game-start', 'revive'], status: 127011 }))
        ),

    2702: () => new HeroBuilder(371).name('阿佩普的绿洲守望者').since('v4.7.0').monster().dendro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/59b3a5744a5e0cef3a742cf97ee1a48e_9222353554920937369.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_ud1cjg/6c67691a5ce406ff1ac33796448454ed.png')
        .normalSkill(new NormalSkillBuilder('失乡重击'))
        .skills(
            new SkillBuilder('生命流束').description('{dealDmg}，抓1张【crd127021】，生成1层【sts127026】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/a2598b6377145054026356571e3494d6.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/6b6af66686864e881e180633491577b7_1337053029698647969.png')
                .elemental().damage(2).cost(3).handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 1, card: 127021, isAttach: true }], statusPre: 127026 })),
            new SkillBuilder('终景迸落').description('{dealDmg}，抓1张【crd127021】，生成2层【sts127026】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/e2b183c009d60ca57023829db15c23fb.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/67a564cb356fc0cfddb1f98658d35573_3718187889744663164.png')
                .burst(2).damage(2).cost(3).handle(() => ({ cmds: [{ cmd: 'getCard', cnt: 1, card: 127021, isAttach: true }], statusPre: [[127026, 2]] })),
            new SkillBuilder('增殖感召').description('战斗开始时，生成5张【crd127021】，随机放入牌库。我方召唤4个【smn127022】后，此角色附属【sts127027】，并获得1点[护盾]。')
                .description('战斗开始时，生成6张【crd127021】，随机放入牌库。我方召唤4个【smn127022】后，此角色附属【sts127027】，并获得2点[护盾]。', 'v5.1.0')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/665265a425ebbddf512f6c93f35e725d.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/d5084bf33845c72c75d6b590a21b3f93_3778267969787494418.png')
                .passive().handle((_, ver) => ({ trigger: ['game-start'], status: 127029, cmds: [{ cmd: 'addCard', cnt: ver.lt('v5.1.0') ? 6 : 5, card: 127021 }] }))
        ),

    2703: () => new HeroBuilder(422).name('镀金旅团·叶轮舞者').since('v5.1.0').eremite().dendro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/d817cec7f1b14e0949f458e3b9746fa3_8569570692569956190.png')
        .avatar('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_char_icon_u539vg/3a4c97c13970817f79729204fbc2279c.png')
        .normalSkill(new NormalSkillBuilder('叶轮轻扫'))
        .skills(
            new SkillBuilder('蔓延旋舞').description('{dealDmg}，生成1层【sts127033】。')
                .src('https://patchwiki.biligame.com/images/ys/1/10/3uggqlvnngykujm38c9noimrtyt0rr1.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/d69cd6abad732aa60170bc087993b671_5098242204074695402.png')
                .elemental().damage(3).cost(3).handle(() => ({ status: 127033 })),
            new SkillBuilder('厄灵苏醒·草之灵蛇').description('{dealDmg}。整场牌局限制一次，将一张【crd127032】加入我方手牌。')
                .src('https://patchwiki.biligame.com/images/ys/9/9f/38nbbui6agyvv8du9z8di7g5p4z8jyr.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/96b81cdc1ce8dfac226116c9fe43992a_2705445042404454391.png')
                .burst(2).damage(4).cost(3).handle(event => {
                    if (event.skill.useCnt > 0) return;
                    return { cmds: [{ cmd: 'getCard', cnt: 1, card: 127032 }] }
                }),
            new SkillBuilder('厄灵之能').description('【此角色受到伤害后：】如果此角色生命值不多于7，则获得1点[充能]。（每回合1次）')
                .src('https://patchwiki.biligame.com/images/ys/6/6e/5l8jvgeetqk54cioz7rf7a9ugv4yo26.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2024/10/08/258999284/6f2fc1e2e7ad6747577d954f3db9012f_2120144226908224970.png')
                .passive().handle(event => {
                    const { hero: { hp, hidx }, skill: { useCntPerRound }, getdmg = [] } = event;
                    if (hp - getdmg[hidx] > 7 || useCntPerRound) return;
                    return { trigger: ['getdmg'], cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: [hidx] }] }
                })
        ),

    6301: () => new HeroBuilder().name('焚尽的炽炎魔女').since('v4.3.0').fatui().pyro()
        .src('https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/36f1358533325d377d6a4e99eec5918f_6190662149106536998.png')
        .normalSkill(new NormalSkillBuilder('红莲之蛾').catalyst())
        .skills(
            new SkillBuilder('烬灭之鞭').description('{dealDmg}，目标角色附属【sts163011】。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/fa766b02212311a6f0d15c0904b7af40.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/5ebe47ad42ad678785def13a30f485ad_5687308121190951050.png')
                .elemental().damage(2).cost(3).handle(() => ({ statusOppo: 163011 })),
            new SkillBuilder('燃焰旋织').description('{dealDmg}。')
                .src('https://act-webstatic.mihoyo.com/hk4e/e20200928calculate/item_skill_icon_u033pf/1dee7d6a7c6efeb3621013c59f051c31.png',
                    'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/456005ca57b543d460e516403de7dd7b_5879470454090240332.png')
                .burst(2).damage(6).cost(3)
        ),

}

export const herosTotal = (version: Version = VERSION[0]) => {
    if (version == 'vlatest') version = VERSION[0];
    const heros: Hero[] = [];
    for (const idx in allHeros) {
        const heroBuilder = allHeros[idx]().version(version);
        if (heroBuilder.notExist || heroBuilder.notInHeroPool) continue;
        heros.push(heroBuilder.id(+idx).done());
    }
    return heros;
}

export const newHero = (version?: Version) => (id: number) => allHeros[id]?.().id(id).version(version).done() ?? NULL_HERO();

export const parseHero = (shareId: number, version?: Version) => herosTotal(version).find(h => h.shareId == shareId) ?? NULL_HERO();
