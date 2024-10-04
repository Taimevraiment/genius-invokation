import { swapKeysAndValues } from "../utils/utils.js";
import {
    CARD_SUBTYPE, CARD_TYPE, COST_TYPE, DAMAGE_TYPE, DICE_COST_TYPE, DICE_TYPE, DiceCostType, ELEMENT_CODE, ELEMENT_TYPE,
    HERO_LOCAL, HERO_TAG, SKILL_TYPE, STATUS_TYPE, TypeConst, WEAPON_TYPE
} from "./enum.js";

export const HANDCARDS_GAP_PC = 48; // 电脑端手牌间隔(px)

export const HANDCARDS_OFFSET_PC = 45; // 电脑端手牌偏移(px)

export const HANDCARDS_GAP_MOBILE = 36; // 移动端手牌间隔(px)

export const HANDCARDS_OFFSET_MOBILE = 25; // 移动端手牌偏移(px)

export const SHIELD_ICON_URL = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Shield.webp'; // 护盾图标

export const BARRIER_ICON_URL = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Barrier.webp'; // 减伤盾图标

export const PURE_ELEMENT_NAME = {
    [ELEMENT_TYPE.Cryo]: '冰元素',
    [ELEMENT_TYPE.Hydro]: '水元素',
    [ELEMENT_TYPE.Pyro]: '火元素',
    [ELEMENT_TYPE.Electro]: '雷元素',
    [ELEMENT_TYPE.Anemo]: '风元素',
    [ELEMENT_TYPE.Geo]: '岩元素',
    [ELEMENT_TYPE.Dendro]: '草元素',
} as const;

export const ELEMENT_NAME = {
    [ELEMENT_TYPE.Physical]: '物理',
    ...PURE_ELEMENT_NAME,
    [DICE_TYPE.Same]: '同色',
    [COST_TYPE.Energy]: '充能',
    [DAMAGE_TYPE.Pierce]: '穿透',
    [STATUS_TYPE.Shield]: '护盾',
    [DICE_COST_TYPE.Omni]: '万能元素骰',
    [DICE_TYPE.Any]: '无色元素骰',
} as const;

export const ELEMENT_NAME_KEY = swapKeysAndValues(ELEMENT_NAME);

export type ElementNameKey = keyof typeof ELEMENT_NAME_KEY;

export const ELEMENT_COLOR = {
    [ELEMENT_TYPE.Physical]: '#aaaaaa',
    [ELEMENT_TYPE.Hydro]: '#0097e1',
    [ELEMENT_TYPE.Pyro]: '#ea4a4a',
    [ELEMENT_TYPE.Electro]: '#b780fa',
    [ELEMENT_TYPE.Cryo]: '#87f5f5',
    [ELEMENT_TYPE.Anemo]: '#36cfc9',
    [ELEMENT_TYPE.Geo]: '#ebc400',
    [ELEMENT_TYPE.Dendro]: '#72c269',
    [COST_TYPE.Same]: 'white',
    [COST_TYPE.Energy]: 'white',
    [DAMAGE_TYPE.Pierce]: '#e9e9e9',
    [STATUS_TYPE.Shield]: 'white',
    [DICE_COST_TYPE.Omni]: 'white',
    [COST_TYPE.Any]: 'white',
    Heal: '#3bec2e',
} as const;

export type ElementColorKey = keyof typeof ELEMENT_COLOR;

export const ELEMENT_URL = {
    [ELEMENT_TYPE.Physical]: 'https://patchwiki.biligame.com/images/ys/thumb/9/9b/5s42slt4q9wwwemq431j6nxkcc5rkp1.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E7%89%A9%E7%90%86.png',
    [ELEMENT_TYPE.Hydro]: 'https://patchwiki.biligame.com/images/ys/a/ab/6m3r7j2tmwx5x6zkvzs25davcm6add5.png',
    [ELEMENT_TYPE.Pyro]: 'https://patchwiki.biligame.com/images/ys/c/c6/bj6s4no20w4btn8no6gze4sfejhl51b.png',
    [ELEMENT_TYPE.Electro]: 'https://patchwiki.biligame.com/images/ys/0/06/c93s7x8gg5hn9u5htu1walapzte7nf1.png',
    [ELEMENT_TYPE.Cryo]: 'https://patchwiki.biligame.com/images/ys/4/44/ju6lyaklj98ichcjnlrg7268k1vsbif.png',
    [ELEMENT_TYPE.Anemo]: 'https://patchwiki.biligame.com/images/ys/3/35/nbqoy2m63thzml89w159ini4yq8gi6w.png',
    [ELEMENT_TYPE.Geo]: 'https://patchwiki.biligame.com/images/ys/1/1c/kf0eavezs5z89l82fxzon2dlnf3et05.png',
    [ELEMENT_TYPE.Dendro]: 'https://patchwiki.biligame.com/images/ys/8/8c/6fjk9iisffn0kaua98bodhn3j0igkdx.png',
} as const;

export const DICE_COLOR = {
    [DICE_TYPE.Any]: '#aaaaaa',
    [DICE_TYPE.Hydro]: '#0097e1',
    [DICE_TYPE.Pyro]: '#ea4a4a',
    [DICE_TYPE.Electro]: '#b780fa',
    [DICE_TYPE.Cryo]: '#87f5f5',
    [DICE_TYPE.Anemo]: '#36cfc9',
    [DICE_TYPE.Geo]: '#ebc400',
    [DICE_TYPE.Dendro]: '#72c269',
    [DICE_TYPE.Same]: '#fcffeb',
} as const;

export const CARD_TYPE_NAME = {
    [CARD_TYPE.Equipment]: '装备',
    [CARD_TYPE.Support]: '支援',
    [CARD_TYPE.Event]: '事件',
} as const;

export const CARD_SUBTYPE_NAME = {
    [CARD_SUBTYPE.Weapon]: '武器',
    [CARD_SUBTYPE.Artifact]: '圣遗物',
    [CARD_SUBTYPE.Vehicle]: '特技',
    [CARD_SUBTYPE.Place]: '场地',
    [CARD_SUBTYPE.Ally]: '伙伴',
    [CARD_SUBTYPE.Item]: '道具',
    [CARD_SUBTYPE.Food]: '料理',
    [CARD_SUBTYPE.Talent]: '天赋',
    [CARD_SUBTYPE.Action]: '战斗行动\uFEFF',
    [CARD_SUBTYPE.Legend]: '秘传',
    [CARD_SUBTYPE.ElementResonance]: '元素共鸣',
} as const;

export const CARD_SUBTYPE_URL = {
    [CARD_SUBTYPE.Weapon]: 'https://patchwiki.biligame.com/images/ys/thumb/c/ce/l98mlw9whvdgy6w95qlteb9wwc2dc5i.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E6%AD%A6%E5%99%A8.png',
    [CARD_SUBTYPE.Artifact]: 'https://patchwiki.biligame.com/images/ys/thumb/7/75/540z6nuruz9nb2do1epuwnocpe054kz.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E5%9C%A3%E9%81%97%E7%89%A9.png',
    [CARD_SUBTYPE.Vehicle]: 'https://patchwiki.biligame.com/images/ys/thumb/2/2e/70kbksdgkoky3vb89js27kqxxj0n9oe.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E7%89%B9%E6%8A%80.png',
    [CARD_SUBTYPE.Place]: 'https://patchwiki.biligame.com/images/ys/thumb/2/2b/54crg8w1f0ccqmh8x4qc6yg8qxnvy4c.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E5%9C%BA%E5%9C%B0.png',
    [CARD_SUBTYPE.Ally]: 'https://patchwiki.biligame.com/images/ys/thumb/a/aa/nwz9v6fm3wn5cdtnmq5m33nnzlubx8s.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E4%BC%99%E4%BC%B4.png',
    [CARD_SUBTYPE.Item]: 'https://patchwiki.biligame.com/images/ys/thumb/1/1c/9ljzczmf9xjnk6qwdx893iicjkw392h.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E9%81%93%E5%85%B7.png',
    [CARD_SUBTYPE.Food]: 'https://patchwiki.biligame.com/images/ys/thumb/3/3e/c3w8tms9npmrntwlvptylijslt7ujn1.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E6%96%99%E7%90%86.png',
    [CARD_SUBTYPE.Talent]: 'https://patchwiki.biligame.com/images/ys/thumb/8/82/pg8v7zj01kq1lohm9objnn9tv9ffdn4.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E5%A4%A9%E8%B5%8B.png',
    [CARD_SUBTYPE.Action]: 'https://api.ambr.top/assets/UI/UI_Gcg_Tag_Card_CombatAction.png',
    [CARD_SUBTYPE.Legend]: 'https://patchwiki.biligame.com/images/ys/thumb/9/90/iwrhiaj9r18jopmj1vtj6zbimxw0z72.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E7%A7%98%E4%BC%A0.png',
    [CARD_SUBTYPE.ElementResonance]: 'https://api.ambr.top/assets/UI/UI_Gcg_Tag_Card_Sync.png',
} as const;

export const SLOT_CODE = {
    [CARD_SUBTYPE.Weapon]: 0,
    [CARD_SUBTYPE.Artifact]: 1,
    [CARD_SUBTYPE.Talent]: 2,
    [CARD_SUBTYPE.Vehicle]: 3,
} as const;

export const SKILL_TYPE_NAME = {
    [SKILL_TYPE.Normal]: '普通攻击',
    [SKILL_TYPE.Elemental]: '元素战技',
    [SKILL_TYPE.Burst]: '元素爆发',
    [SKILL_TYPE.Passive]: '被动技能',
    [SKILL_TYPE.Vehicle]: '特技',
} as const;

export const SKILL_TYPE_ABBR = {
    [SKILL_TYPE.Normal]: '普',
    [SKILL_TYPE.Elemental]: '技',
    [SKILL_TYPE.Burst]: '爆',
    [SKILL_TYPE.Passive]: '被',
    [SKILL_TYPE.Vehicle]: '特',
} as const;

export const ELEMENT_ICON = {
    [ELEMENT_TYPE.Physical]: 'physical',
    [COST_TYPE.Hydro]: 'hydro',
    [COST_TYPE.Pyro]: 'pyro',
    [COST_TYPE.Electro]: 'electro',
    [COST_TYPE.Cryo]: 'cryo',
    [COST_TYPE.Anemo]: 'anemo',
    [COST_TYPE.Geo]: 'geo',
    [COST_TYPE.Dendro]: 'dendro',
    [COST_TYPE.Same]: 'same',
    [COST_TYPE.Energy]: 'energy',
    [CARD_SUBTYPE.Legend]: 'legend',
    [STATUS_TYPE.Shield]: 'shield',
    [DICE_COST_TYPE.Omni]: 'omni',
    [COST_TYPE.Any]: 'any',
} as const;

export const CHANGE_GOOD_COLOR = '#4dff00'; // 减骰绿色

export const CHANGE_BAD_COLOR = '#ff7575'; // 增骰红色

export const DEBUFF_BG_COLOR = CHANGE_BAD_COLOR; // debuff红色

export const STATUS_BG_COLOR = {
    [ELEMENT_TYPE.Physical]: '#848484',
    [ELEMENT_TYPE.Cryo]: '#00b7dc',
    [ELEMENT_TYPE.Hydro]: '#003ab6',
    [ELEMENT_TYPE.Pyro]: '#b46534',
    [ELEMENT_TYPE.Electro]: '#9956c8',
    [ELEMENT_TYPE.Anemo]: '#62c8b3',
    [ELEMENT_TYPE.Geo]: '#c39c26',
    [ELEMENT_TYPE.Dendro]: '#869c17',
    Debuff: DEBUFF_BG_COLOR,
    Buff: '#b9a11a',
    Transparent: '#00000000',
} as const;

export type StatusBgColor = TypeConst<typeof STATUS_BG_COLOR>;

export const STATUS_BG_COLOR_KEY = swapKeysAndValues(STATUS_BG_COLOR);

export const STATUS_BG_COLOR_CODE = {
    Transparent: -1,
    ...ELEMENT_CODE,
    Debuff: 8,
    Buff: 9,
    Forbidden: 10,
} as const;

export const HERO_LOCAL_NAME = {
    [HERO_LOCAL.Monster]: '魔物',
    [HERO_LOCAL.Mondstadt]: '蒙德',
    [HERO_LOCAL.Liyue]: '璃月',
    [HERO_LOCAL.Inazuma]: '稻妻',
    [HERO_LOCAL.Sumeru]: '须弥',
    [HERO_LOCAL.Fontaine]: '枫丹',
    [HERO_LOCAL.Natlan]: '纳塔',
    [HERO_LOCAL.Snezhnaya]: '至冬',
    [HERO_LOCAL.Fatui]: '愚人众',
    [HERO_TAG.Hilichurl]: '丘丘人',
    [HERO_TAG.Eremite]: '镀金旅团',
    [HERO_TAG.ArkheOusia]: '始基力:荒性',
    [HERO_TAG.ArkhePneuma]: '始基力:芒性',
    [HERO_TAG.ConsecratedBeast]: '圣骸兽',
} as const;

export const HERO_TAG_NAME = {
    ...HERO_LOCAL_NAME,
    [HERO_TAG.Ousia]: '荒',
    [HERO_TAG.Pneuma]: '芒',
} as const;

export const HERO_TAG_URL = {
    [HERO_TAG.Monster]: '/image/local0.png',
    [HERO_TAG.Mondstadt]: '/image/local1.png',
    [HERO_TAG.Liyue]: '/image/local2.png',
    [HERO_TAG.Inazuma]: '/image/local3.png',
    [HERO_TAG.Sumeru]: '/image/local4.png',
    [HERO_TAG.Fontaine]: 'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/270e3e7772698578d0679b4b60cf03da.png',
    [HERO_LOCAL.Natlan]: '',
    [HERO_LOCAL.Snezhnaya]: '',
    [HERO_TAG.Fatui]: '/image/local8.png',
    [HERO_TAG.Hilichurl]: '/image/local9.png',
    [HERO_TAG.Eremite]: '/image/local10.png',
    [HERO_TAG.ArkheOusia]: 'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/2bf769807e6739fbeb8b5781b9689386.png',
    [HERO_TAG.Ousia]: 'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/2bf769807e6739fbeb8b5781b9689386.png',
    [HERO_TAG.ArkhePneuma]: 'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/bb176892163d7c0d63e664b01217802d.png',
    [HERO_TAG.Pneuma]: 'https://act-webstatic.mihoyo.com/hk4e/e20230518cardlanding/picture/bb176892163d7c0d63e664b01217802d.png',
    [HERO_TAG.ConsecratedBeast]: '/image/local13.png',
} as const;

export const WEAPON_TYPE_NAME = {
    [WEAPON_TYPE.Other]: '其他武器',
    [WEAPON_TYPE.Catalyst]: '法器',
    [WEAPON_TYPE.Bow]: '弓',
    [WEAPON_TYPE.Claymore]: '双手剑',
    [WEAPON_TYPE.Polearm]: '长柄武器',
    [WEAPON_TYPE.Sword]: '单手剑',
} as const;

export const WEAPON_TYPE_URL = {
    [WEAPON_TYPE.Other]: 'https://api.ambr.top/assets/UI/UI_Gcg_Tag_Weapon_None.png',
    [WEAPON_TYPE.Sword]: 'https://patchwiki.biligame.com/images/ys/thumb/9/99/ci8ct35ze990qobgxr3qrn5ja7odwq6.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E5%8D%95%E6%89%8B%E5%89%91.png',
    [WEAPON_TYPE.Claymore]: 'https://patchwiki.biligame.com/images/ys/thumb/5/5f/oya1teccyuglwbbcb13gepwwax63pp8.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E5%8F%8C%E6%89%8B%E5%89%91.png',
    [WEAPON_TYPE.Bow]: 'https://patchwiki.biligame.com/images/ys/thumb/4/47/ck3noau3m5bj3f5in9ac4oipcsfd5on.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E5%BC%93.png',
    [WEAPON_TYPE.Catalyst]: 'https://patchwiki.biligame.com/images/ys/thumb/c/c9/ds5nd67iwl6pmc8mukcl42qkqo4675o.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E6%B3%95%E5%99%A8.png',
    [WEAPON_TYPE.Polearm]: 'https://patchwiki.biligame.com/images/ys/thumb/0/04/8q4g6en1xo23qzvh7rglnvy2q3t72yt.png/30px-%E5%8D%A1%E7%89%8CUI-%E5%9B%BE%E6%A0%87-%E9%95%BF%E6%9F%84%E6%AD%A6%E5%99%A8.png',
} as const;

export const DICE_WEIGHT = [ // 骰子的优先级权重(越低越优先)
    DICE_COST_TYPE.Omni,
    DICE_COST_TYPE.Cryo,
    DICE_COST_TYPE.Hydro,
    DICE_COST_TYPE.Pyro,
    DICE_COST_TYPE.Electro,
    DICE_COST_TYPE.Geo,
    DICE_COST_TYPE.Dendro,
    DICE_COST_TYPE.Anemo,
];

const elReactionExplain: { [key: string]: (...args: any) => string } = {
    融化: (isAttach = false) => `【融化】：${!isAttach ? '本伤害+2' : '没有效果'}`,
    蒸发: (isAttach = false) => `【融化】：${!isAttach ? '本伤害+2' : '没有效果'}`,
    感电: (isAttach = false) => `【感电】：${!isAttach ? '本伤害+1，对目标以外的所有敌方角色造成1点穿透伤害' : '没有效果'}`,
    超导: (isAttach = false) => `【超导】：${!isAttach ? '本伤害+1，对目标以外的所有敌方角色造成1点穿透伤害' : '没有效果'}`,
    超载: (isAttach = false) => `【超载】：${!isAttach ? '本伤害+1，' : ''}目标强制切换到下一个角色`,
    冻结: (isAttach = false) => `【冻结】：${!isAttach ? '本伤害+1，' : ''}使目标本回合无法行动(受到物理伤害或火元素伤害后提前解除，但是伤害+2)`,
    燃烧: (isAttach = false) => `【燃烧】：${!isAttach ? '本伤害+1，' : ''}生成回合结束时造成1点火元素伤害的\\[燃烧烈焰](可用次数1，最多叠加到2)`,
    绽放: (isAttach = false) => `【绽放】：${!isAttach ? '本伤害+1，' : ''}生成使下次火元素或雷元素伤害+2的\\[草原核]`,
    原激化: (isAttach = false) => `【原激化】：${!isAttach ? '本伤害+1，' : ''}生成使下2次草元素或雷元素伤害+1的\\[激化领域]`,
    扩散: (el: string) => `【扩散(${el})】：对目标以外的所有敌方角色造成1点${el}元素伤害`,
    结晶: (el: string) => `【结晶(${el})】：本伤害+1，我方出战角色获得1点护盾(可叠加，最多2点)`,
}
const elr = (elrname: string, elOrIsAttach?: string | boolean) => elReactionExplain[elrname](elOrIsAttach);

const diceExpl = (el: DiceCostType) => `花费投出了*[${ELEMENT_NAME[el]}骰]的元素骰，来支付此费用。；(*[万能元素骰]也可以支付此费用。)`

export const RULE_EXPLAIN: { [key: string]: string } = {
    充能: '角色使用\\｢元素爆发｣时，需要消耗‹9›充能。角色使用\\｢元素战技｣或\\｢普通攻击｣后，会获得1点‹9›充能。',
    可用次数: '此牌效果触发后，会消耗1次【可用次数】;；【可用次数】耗尽后，立刻弃置此牌。',
    持续回合: '每回合结束阶段，【持续回合】-1。【持续回合】耗尽后，会立刻弃置此牌。',
    准备技能: '有些技能无法被直接使用，而是需要一定次数的行动轮来进行【准备】。；轮到一位牌手行动时，如果该牌手的\\｢出战角色｣正在【准备】技能，则跳过该牌手的行动；如果技能已经完成【准备】，角色将会在此时直接使用此技能。(此类需要【准备】的技能，无法触发\\｢使用技能后｣效果。)；只有\\｢出战角色｣才能【准备】技能；如果正在【准备】技能的\\｢出战角色｣被切换到后台，技能的【准备】就会被打断。',
    免于被击倒: '一些效果会使角色在生命值降为0的时候【免于被击倒】，并治疗该角色到一定生命值。；此时，角色不视为被【击倒】过。(因此，角色所附属的装备和状态不会被弃置，充能也不会被清空)',
    护盾: '此护盾所保护的角色受到伤害时，将会消耗护盾值来抵消伤害。',
    穿透伤害: '穿透伤害无法受到伤害加成，但是也不会被护盾、伤害免疫等效果抵消。',
    快速行动: '执行了一次快速行动后，我方可以继续进行其他行动。；只有执行了一次战斗行动后，才会轮到对方行动。',
    战斗行动: '我方执行了一次战斗行动后，会轮到对方行动。；【打出具有此规则的手牌是一个战斗行动，而非快速行动。】',
    重击: '我方行动开始前，如果元素骰的总数为偶数，则进行的｢普通攻击｣视为｢重击｣。',
    下落攻击: '角色被切换为\\｢出战角色｣后，本回合内的下一个战斗行动若为\\｢普通攻击｣，则被视为\\｢下落攻击｣。',
    万能元素骰: '‹13›万能元素可以视为任何类型的元素，来支付各种费用。',
    无色元素骰: '可以用任意类型的元素骰子组合，来支付此类费用。',
    物理伤害: '物理伤害不会附着元素，也不会发生元素反应',
    水元素骰: diceExpl(DICE_TYPE.Hydro),
    水元素伤害: `附着‹2›水元素，可发生元素反应：；‹2›‹3›${elr('蒸发')}；‹2›‹4›${elr('感电')}；‹2›‹1›${elr('冻结')}；‹2›‹7›${elr('绽放')}`,
    附着水元素: `不通过伤害附着‹2›水元素时，发生的元素反应会忽略伤害效果：；‹2›‹3›${elr('蒸发', true)}；‹2›‹4›${elr('感电', true)}；‹2›‹1›${elr('冻结', true)}；‹2›‹7›${elr('绽放', true)}`,
    水元素相关反应: `‹2›‹3›${elr('蒸发')}；‹2›‹4›${elr('感电')}；‹2›‹1›${elr('冻结')}；‹2›‹7›${elr('绽放')}；‹6›‹2›${elr('结晶', '水')}；‹5›‹2›${elr('扩散', '水')}`,
    火元素骰: diceExpl(DICE_TYPE.Pyro),
    火元素伤害: `附着‹3›火元素，可发生元素反应：；‹3›‹1›${elr('融化')}；‹3›‹2›${elr('蒸发')}；‹3›‹4›${elr('超载')}；‹3›‹7›${elr('燃烧')}`,
    附着火元素: `不通过伤害附着‹3›火元素时，发生的元素反应会忽略伤害效果：；‹3›‹1›${elr('融化', true)}；‹3›‹2›${elr('蒸发', true)}；‹3›‹4›${elr('超载', true)}；‹3›‹7›${elr('燃烧', true)}`,
    火元素相关反应: `‹3›‹1›${elr('融化')}；‹3›‹2›${elr('蒸发')}；‹3›‹4›${elr('超载')}；‹3›‹7›${elr('燃烧')}；‹6›‹3›${elr('结晶', '火')}；‹5›‹3›${elr('扩散', '火')}`,
    雷元素骰: diceExpl(DICE_TYPE.Electro),
    雷元素伤害: `附着‹4›雷元素，可发生元素反应：；‹4›‹1›${elr('超导')}；‹4›‹2›${elr('感电')}；‹4›‹3›${elr('超载')}；‹4›‹7›${elr('原激化')}`,
    附着雷元素: `不通过伤害附着‹4›雷元素时，发生的元素反应会忽略伤害效果：；‹4›‹1›${elr('超导', true)}；‹4›‹2›${elr('感电', true)}；‹4›‹3›${elr('超载', true)}；‹4›‹7›${elr('原激化', true)}`,
    雷元素相关反应: `‹4›‹1›${elr('超导')}；‹4›‹2›${elr('感电')}；‹4›‹3›${elr('超载')}；‹4›‹7›${elr('原激化')}；‹6›‹4›${elr('结晶', '雷')}；‹5›‹4›${elr('扩散', '雷')}`,
    冰元素骰: diceExpl(DICE_TYPE.Cryo),
    冰元素伤害: `附着‹1›冰元素，可发生元素反应：；‹1›‹3›${elr('融化')}；‹1›‹4›${elr('超导')}；‹1›‹2›${elr('冻结')}`,
    附着冰元素: `不通过伤害附着‹1›冰元素时，发生的元素反应会忽略伤害效果：；‹1›‹3›${elr('融化', true)}；‹1›‹4›${elr('超导', true)}；‹1›‹2›${elr('冻结', true)}`,
    冰元素相关反应: `‹1›‹3›${elr('融化')}；‹1›‹4›${elr('超导')}；‹1›‹2›${elr('冻结')}；‹6›‹1›${elr('结晶', '冰')}；‹5›‹1›${elr('扩散', '冰')}`,
    风元素骰: diceExpl(DICE_TYPE.Anemo),
    风元素伤害: `和已附着的元素发生元素反应：；‹5›‹1›${elr('扩散', '冰')}；‹5›‹2›${elr('扩散', '水')}；‹5›‹3›${elr('扩散', '火')}；‹5›‹4›${elr('扩散', '雷')}`,
    风元素相关反应: `$‹5›‹1›{elr('扩散', '冰')}；‹5›‹2›${elr('扩散', '水')}；‹5›‹3›${elr('扩散', '火')}；‹5›‹4›${elr('扩散', '雷')}`,
    岩元素骰: diceExpl(DICE_TYPE.Geo),
    岩元素伤害: `和已附着的元素发生元素反应：；‹6›‹1›${elr('结晶', '冰')}；‹6›‹2›${elr('结晶', '水')}；‹6›‹3›${elr('结晶', '火')}；‹6›‹4›${elr('结晶', '雷')}`,
    岩元素相关反应: `‹6›‹1›${elr('结晶', '冰')}；‹6›‹2›${elr('结晶', '水')}；‹6›‹3›${elr('结晶', '火')}；‹6›‹4›${elr('结晶', '雷')}`,
    草元素骰: diceExpl(DICE_TYPE.Dendro),
    草元素伤害: `附着‹7›草元素元素，可发生元素反应：；‹7›‹2›${elr('绽放')}；‹7›‹3›${elr('燃烧')}；‹7›‹4›${elr('原激化')}`,
    附着草元素: `不通过伤害附着‹7›草元素时，发生的元素反应会忽略伤害效果：；‹7›‹2›${elr('绽放', true)}；‹7›‹3›${elr('燃烧', true)}；‹7›‹4›${elr('原激化', true)}`,
    草元素相关反应: `‹7›‹2›${elr('绽放')}；‹7›‹3›${elr('燃烧')}；‹7›‹4›${elr('原激化')}`,
    距离我方出战角色最近的角色: '对方场上距离我方出战角色｢最近｣的角色，指的是位置与我方出战角色最接近的敌方角色。如果存在多个位置最接近的角色，则其中靠前的角色被视为｢最近｣。',
    '｢焚尽的炽炎魔女｣': '\\｢女士｣可以永久地转化为\\｢焚尽的炽炎魔女｣形态。；转换后，\\｢女士｣的元素类型会从‹1冰元素›转换为‹3火元素›。；转换后，此角色可以使用\\｢焚尽的炽炎魔女｣的技能，但是不能再使用\\｢女士｣原本的技能。',
    汲取对应元素的力量: '若陀龙王可以汲取‹1冰›/‹2水›/‹3火›/‹4雷›元素的力量。(同时只能汲取一种)；【若陀龙王已汲取上述元素的力量时：】根据所汲取的元素类型，获得技能‹1【rsk66013】›/‹2【rsk66023】›/‹3【rsk66033】›/‹4【rsk66043】›。',
    舍弃: '通过行动牌或角色技能的效果，将行动牌从手牌或牌库中弃置。',
    调和: '为了进行元素调和，而将行动牌从手牌中弃置。',
    特技: '出战角色装备有｢特技｣卡牌时，就可以使用对应的｢特技｣。使用｢特技｣是一种｢战斗行动｣。角色因冻结、石化、眩晕等原因无法使用技能时，也会同时无法使用｢特技｣。角色使用｢特技｣时不视为使用技能，无法触发｢使用技能后｣｢角色引发元素反应后｣等效果；角色使用｢特技｣造成的伤害不被视为角色造成的伤害。',
    挑选: '从特定的多张牌中选择1张执行效果。',
}
