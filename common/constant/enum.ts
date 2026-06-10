import { swapKeysAndValues } from "../utils/utils.js";

export type TypeConst<T> = T[keyof T];

export const SWIRL_ELEMENT_TYPE = {
    /** 冰 1 */ Cryo: 'Cryo',
    /** 水 2 */ Hydro: 'Hydro',
    /** 火 3 */ Pyro: 'Pyro',
    /** 雷 4 */ Electro: 'Electro',
} as const;

export type SwirlElementType = TypeConst<typeof SWIRL_ELEMENT_TYPE>;

export const SWIRL_ELEMENT_TYPE_KEY: Record<SwirlElementType, keyof typeof SWIRL_ELEMENT_TYPE> = swapKeysAndValues(SWIRL_ELEMENT_TYPE);

export const PURE_ELEMENT_TYPE = {
    ...SWIRL_ELEMENT_TYPE,
    /** 风 5 */ Anemo: 'Anemo',
    /** 岩 6 */ Geo: 'Geo',
    /** 草 7 */ Dendro: 'Dendro',
} as const;

export type PureElementType = TypeConst<typeof PURE_ELEMENT_TYPE>;

export const PURE_ELEMENT_TYPE_KEY: Record<PureElementType, keyof typeof PURE_ELEMENT_TYPE> = swapKeysAndValues(PURE_ELEMENT_TYPE);

export type PureElementTypeKey = keyof typeof PURE_ELEMENT_TYPE;

export const ELEMENT_TYPE = {
    /** 物理 0 */ Physical: 'Physical',
    ...PURE_ELEMENT_TYPE,
} as const;

export type ElementType = TypeConst<typeof ELEMENT_TYPE>;

export const ELEMENT_TYPE_KEY: Record<ElementType, keyof typeof ELEMENT_TYPE> = swapKeysAndValues(ELEMENT_TYPE);

export const PURE_ELEMENT_CODE = {
    [ELEMENT_TYPE.Cryo]: 1,
    [ELEMENT_TYPE.Hydro]: 2,
    [ELEMENT_TYPE.Pyro]: 3,
    [ELEMENT_TYPE.Electro]: 4,
    [ELEMENT_TYPE.Anemo]: 5,
    [ELEMENT_TYPE.Geo]: 6,
    [ELEMENT_TYPE.Dendro]: 7,
} as const;

export type PureElementCode = TypeConst<typeof PURE_ELEMENT_CODE>;

export const PURE_ELEMENT_CODE_KEY: Record<PureElementCode, PureElementType> = swapKeysAndValues(PURE_ELEMENT_CODE);

export const ELEMENT_CODE = {
    [ELEMENT_TYPE.Physical]: 0,
    ...PURE_ELEMENT_CODE,
} as const;

export type ElementCode = TypeConst<typeof ELEMENT_CODE>;

export const ELEMENT_CODE_KEY: Record<ElementCode, ElementType> = swapKeysAndValues(ELEMENT_CODE);

export const DAMAGE_TYPE = {
    /** 穿透 */ Pierce: 'Pierce',
    ...ELEMENT_TYPE,
} as const;

export type DamageType = TypeConst<typeof DAMAGE_TYPE>;

export const SKILL_COST_TYPE = {
    ...PURE_ELEMENT_TYPE,
    /** 同色 8 */ Same: 'Same',
} as const;

export type SkillCostType = TypeConst<typeof SKILL_COST_TYPE>;

export const DICE_TYPE = {
    /** 无色 0 */ Any: 'Any',
    ...SKILL_COST_TYPE,

} as const;

export type DiceType = TypeConst<typeof DICE_TYPE>;

export const DICE_TYPE_CODE = {
    [DICE_TYPE.Any]: 0,
    ...PURE_ELEMENT_CODE,
    [DICE_TYPE.Same]: 8,
} as const;

export const DICE_TYPE_CODE_KEY = swapKeysAndValues(DICE_TYPE_CODE);

export const ENERGY_COST_TYPE = {
    /** 充能 9 */ Energy: 'Energy',
    /** 战意 10 */ SpEnergy1315: 'SpEnergy1315',
    /** 蛇之狡谋 11 */ SpEnergy1116: 'SpEnergy1116',
} as const;

export type EnergyCostType = TypeConst<typeof ENERGY_COST_TYPE>;

export const COST_TYPE = {
    ...DICE_TYPE,
    ...ENERGY_COST_TYPE,
} as const;

export type CostType = TypeConst<typeof COST_TYPE>;

export const CARD_TYPE = {
    /** 装备 0 */ Equipment: 'Equipment',
    /** 支援 1 */ Support: 'Support',
    /** 事件 2 */ Event: 'Event',
} as const;

export type CardType = TypeConst<typeof CARD_TYPE>;

export const DICE_COST_TYPE = {
    /** 万能骰 0 */ Omni: 'Omni',
    ...PURE_ELEMENT_TYPE,
} as const;

export type DiceCostType = TypeConst<typeof DICE_COST_TYPE>;

export const DICE_COST_TYPE_CODE = {
    [DICE_COST_TYPE.Omni]: 0,
    ...PURE_ELEMENT_CODE,
} as const;

export type DiceCostTypeCode = TypeConst<typeof DICE_COST_TYPE_CODE>;

export const DICE_COST_TYPE_CODE_KEY = swapKeysAndValues(DICE_COST_TYPE_CODE);

export const CARD_SUBTYPE_EQUIPMENT = {
    /** 武器 */ Weapon: 'Weapon',
    /** 圣遗物 */ Relic: 'Relic',
    /** 特技 */ Vehicle: 'Vehicle',
} as const;

export const CARD_SUBTYPE_SUPPORT = {
    /** 场地 */ Place: 'Place',
    /** 伙伴 */ Ally: 'Ally',
    /** 道具 */ Item: 'Item',
    /** 元素幻变 */ Blessing: 'Blessing',
} as const;

export type CardSubtypeSupport = TypeConst<typeof CARD_SUBTYPE_SUPPORT>;

export const CARD_SUBTYPE = {
    ...CARD_SUBTYPE_EQUIPMENT,
    ...CARD_SUBTYPE_SUPPORT,
    /** 料理 */ Food: 'Food',
    /** 天赋 */ Talent: 'Talent',
    /** 战斗行动 */ Action: 'Action',
    /** 秘传 */ Legend: 'Legend',
    /** 元素共鸣 */ ElementResonance: 'ElementResonance',
    /** 希穆兰卡 */ Simulanka: 'Simulanka',
    /** 冒险地点 */ Adventure: 'Adventure',
} as const;

export type CardSubtype = TypeConst<typeof CARD_SUBTYPE>;

export const WEAPON_TYPE = {
    /** 其他武器 0 */ Other: 'Other',
    /** 法器 1 */ Catalyst: 'Catalyst',
    /** 弓 2 */ Bow: 'Bow',
    /** 双手剑 3 */ Claymore: 'Claymore',
    /** 长柄武器 4 */ Polearm: 'Polearm',
    /** 单手剑 5 */ Sword: 'Sword',
} as const;

export type WeaponType = TypeConst<typeof WEAPON_TYPE>;

export const WEAPON_TYPE_CODE = {
    [WEAPON_TYPE.Other]: 0,
    [WEAPON_TYPE.Catalyst]: 1,
    [WEAPON_TYPE.Bow]: 2,
    [WEAPON_TYPE.Claymore]: 3,
    [WEAPON_TYPE.Polearm]: 4,
    [WEAPON_TYPE.Sword]: 5,
} as const;

export type WeaponTypeCode = TypeConst<typeof WEAPON_TYPE_CODE>;

export const WEAPON_TYPE_CODE_KEY = swapKeysAndValues(WEAPON_TYPE_CODE);

export const STATUS_GROUP = {
    /** 角色状态 */ heroStatus: 0,
    /** 出战状态 */ combatStatus: 1,
    /** 附着效果状态 */ attachment: 2,
} as const;

export type StatusGroup = TypeConst<typeof STATUS_GROUP>;

export const STATUS_TYPE = {
    /** 隐藏 0 */ Hide: 'Hide',
    /** 攻击 1 */ Attack: 'Attack',
    /** 减伤 2 */ Barrier: 'Barrier',
    /** 回合 3 */ Round: 'Round',
    /** 使用 4 */ Usage: 'Usage',
    /** 乘伤 5 */ MultiDamage: 'MultiDamage',
    /** 加伤 6 */ AddDamage: 'AddDamage',
    /** 护盾 7 */ Shield: 'Shield',
    /** 附魔 8 */ Enchant: 'Enchant',
    /** 累积 9 */ Accumulate: 'Accumulate',
    /** 标记 10 */ Sign: 'Sign',
    /** 准备技能 11 */ ReadySkill: 'ReadySkill',
    /** 死后不删除 12 */ NonDestroy: 'NonDestroy',
    /** 免击倒 13 */ NonDefeat: 'NonDefeat',
    /** 无法行动 14 */ NonAction: 'NonAction',
    /** 条件附魔 15 */ ConditionalEnchant: 'ConditionalEnchant',
    /** 夜魂加持 16 */ NightSoul: 'NightSoul',
    /** 事件牌失效 17 */ NonEvent: 'NonEvent',
    /** 死后也显示 18 */ Show: 'Show',
    /** 仅用作解释 19 */ OnlyExplain: 'OnlyExplain',
    /** 免疫伤害 20 */ ImmuneDamage: 'ImmuneDamage',
} as const;

export type StatusType = TypeConst<typeof STATUS_TYPE>;

export const SUMMON_TAG = {
    /** 希穆兰卡 */ Simulanka: 'Simulanka',
    /** 仅用作解释 */ OnlyExplain: 'OnlyExplain',
} as const;

export type SummonTag = TypeConst<typeof SUMMON_TAG>;

export const SUPPORT_TYPE = {
    /** 轮次 */ Round: 1,
    /** 收集物 */ Collection: 2,
    /** 常驻 */ Permanent: 3,
} as const;

export type SupportType = TypeConst<typeof SUPPORT_TYPE>;

export const HERO_LOCAL = {
    /** 魔物 0 */ Monster: 'Monster',
    /** 蒙德 1 */ Mondstadt: 'Mondstadt',
    /** 璃月 2 */ Liyue: 'Liyue',
    /** 稻妻 3 */ Inazuma: 'Inazuma',
    /** 须弥 4 */ Sumeru: 'Sumeru',
    /** 枫丹 5 */ Fontaine: 'Fontaine',
    /** 纳塔 6 */ Natlan: 'Natlan',
    /** 至冬 7 */ Snezhnaya: 'Snezhnaya',
    /** 愚人众 8 */ Fatui: 'Fatui',
    /** 丘丘人 9 */ Hilichurl: 'Hilichurl',
    /** 镀金旅团 10 */ Eremite: 'Eremite',
    /** 始基力:荒性 11 */ ArkheOusia: 'ArkheOusia',
    /** 始基力:芒性 12 */ ArkhePneuma: 'ArkhePneuma',
    /** 圣骸兽 13 */ ConsecratedBeast: 'ConsecratedBeast',
    /** 寰宇劫灭 14 */ CosmicCalamity: 'CosmicCalamity',
    /** 挪德卡莱 15 */ Nodkrai: 'Nodkrai',
} as const;

export type HeroLocal = TypeConst<typeof HERO_LOCAL>;

export const HERO_LOCAL_CODE = {
    [HERO_LOCAL.Monster]: 215,
    [HERO_LOCAL.Mondstadt]: 1,
    [HERO_LOCAL.Liyue]: 2,
    [HERO_LOCAL.Inazuma]: 3,
    [HERO_LOCAL.Sumeru]: 4,
    [HERO_LOCAL.Fontaine]: 5,
    [HERO_LOCAL.Natlan]: 6,
    [HERO_LOCAL.Snezhnaya]: 0,
    [HERO_LOCAL.Fatui]: 216,
    [HERO_LOCAL.Hilichurl]: 0,
    [HERO_LOCAL.Eremite]: 0,
    [HERO_LOCAL.ArkheOusia]: 0,
    [HERO_LOCAL.ArkhePneuma]: 0,
    [HERO_LOCAL.ConsecratedBeast]: 0,
    [HERO_LOCAL.Nodkrai]: 7,
} as const;

export type HeroLocalCode = TypeConst<typeof HERO_LOCAL_CODE>;

export const HERO_LOCAL_CODE_KEY = swapKeysAndValues(HERO_LOCAL_CODE);

export const CARD_TAG = {
    /** 减伤 0 */ Barrier: 'Barrier', 
    /** 复苏料理 1 */ Revive: 'Revive', 
    /** 所属共鸣 2 */ LocalResonance: 'LocalResonance', 
    /** 免击倒 3 */ NonDefeat: 'NonDefeat', 
    /** 不能调和 4 */ NonReconcile: 'NonReconcile', 
    /** 附魔 5 */ Enchant: 'Enchant', 
    ...HERO_LOCAL,
} as const;

export type CardTag = TypeConst<typeof CARD_TAG>;

export const HERO_TAG = {
    ...HERO_LOCAL,
    /** 荒 11 */ Ousia: 'Ousia', 
    /** 芒 12 */ Pneuma: 'Pneuma', 
} as const;

export type HeroTag = TypeConst<typeof HERO_TAG>;

export const ELEMENT_REACTION = {
    /** 融化 */ Melt: 101,
    /** 蒸发 */ Vaporize: 102,
    /** 超载 */ Overload: 103,
    /** 超导 */ Superconduct: 104,
    /** 感电 */ ElectroCharged: 105,
    /** 冻结 */ Frozen: 106,
    /** 扩散 */ Swirl: 107,
    /** 结晶 */ Crystallize: 111,
    /** 燃烧 */ Burning: 115,
    /** 绽放 */ Bloom: 116,
    /** 原激化 */ Quicken: 117,
    /** 月感电 */ LunarElectroCharged: 118,
    /** 月绽放 */ LunarBloom: 119,
} as const;

export type ElementReaction = TypeConst<typeof ELEMENT_REACTION>;

export const SKILL_TYPE = {
    /** 隐藏被动 */ PassiveHidden: 0, 
    /** 普通攻击 */ Normal: 1, 
    /** 元素战技 */ Elemental: 2, 
    /** 元素爆发 */ Burst: 3, 
    /** 被动技能 */ Passive: 4, 
    /** 特技 */ Vehicle: 5, 
} as const;

export type SkillType = TypeConst<typeof SKILL_TYPE>;

export const SUMMON_DESTROY_TYPE = {
    /** 次数用完直接销毁 */ Used: 'Used',
    /** 次数用完后，回合结束时销毁 */ UsedRoundEnd: 'UsedRoundEnd',
    /** 回合结束时强制销毁*/ RoundEnd: 'RoundEnd',
} as const;

export type SummonDestroyType = TypeConst<typeof SUMMON_DESTROY_TYPE>;

export const EFFECT_TYPE = {
    Discard: '舍弃',
    Pick: '挑选',
    ReadySkill: '准备技能',
    Summon: '召唤',
    Heal: '治疗',
    Shield: '护盾',
    NightSoul: '夜魂',
    BondofLife: 'sts122',
    Vehicle: '特技',
    PierceDmg: '穿透伤害',
    GenerateCard: '生成行动牌',
    Energy: '充能',
    Adventure: '冒险',
} as const;
export type EffectType = TypeConst<typeof EFFECT_TYPE>;

export const CMD_MODE = {
    /** 随机不重复基础骰子 */ Random: 70001,
    /** 当前出战角色(hidxs[0]控制前后)元素骰子 */ FrontHero: 70002,
    /** 弃置当前花费最高的手牌 */ HighHandCard: 70003,
    /** 弃置所有手牌 */ AllHandCards: 70004,
    /** 弃置牌堆顶的牌 */ TopPileCard: 70005,
    /** 弃置牌库中随机一张牌 */ RandomPileCard: 70006,
    /** 不公开加入牌库的牌 */ IsNotPublic: 70007,
    /** 公开抓到的牌 */ IsPublic: 70008,
    /** 使用技能挑选牌 */ Summon: 70009,
    /** 挑选牌 */ GetCard: 70010,
    /** 挑选并打出牌 */ UseCard: 70011,
    /** 按顺序执行 */ ByOrder: 70012,
    /** 是否优先执行 */ IsPriority: 70013,
    /** 弃置花费最低的手牌 */ LowHandCard: 70014,
    /** 生命值最高的角色 */ MaxHp: 70015,
    /** 受伤最多的角色 */ MaxHurt: 70016,
    /** 费用最高或最低的牌 */ HighLowCard: 70017,
    /** 牌库中所有牌 */ AllPileCard: 70018,
} as const;

export const INFO_TYPE = {
    /** 技能 */ Skill: 'skill', 
    /** 角色 */ Hero: 'hero', 
    /** 卡牌/支援物 */ Card: 'card', 
    /** 召唤物 */ Summon: 'summon', 
    /** 支援物 */ Support: 'support', 
} as const;

export type InfoType = TypeConst<typeof INFO_TYPE>;

export const PHASE = {
    /** 未准备 */ NOT_READY: 0,
    /** 未开始 */ NOT_BEGIN: 1,
    /** 换牌 */ CHANGE_CARD: 2,
    /** 选择出战角色 */ CHOOSE_HERO: 3,
    /** 掷骰子 */ DICE: 4,
    /** 行动开始 */ ACTION_START: 5,
    /** 行动中 */ ACTION: 6,
    /** 行动结束 */ ACTION_END: 7,
    /** 回合结束 */ PHASE_END: 8,
    /** 挑选卡牌 */ PICK_CARD: 9,
} as const;

export type Phase = TypeConst<typeof PHASE>;

export const PLAYER_STATUS = {
    WAITING: 0,
    PLAYING: 1,
    DIESWITCH: 2,
    OFFLINE: 3,
} as const;

export type PlayerStatus = TypeConst<typeof PLAYER_STATUS>;

export const ACTION_TYPE = {
    /** 开始游戏 */ StartGame: 'start-game',
    /** 替换手牌 */ ChangeCard: 'change-card',
    /** 选择初始出战角色 */ ChooseInitHero: 'choose-init-hero',
    /** 使用手牌 */ UseCard: 'use-card',
    /** 使用技能 */ UseSkill: 'use-skill',
    /** 调和手牌 */ Reconcile: 'reconcile',
    /** 重投骰子 */ Reroll: 'reroll',
    /** 切换角色 */ SwitchHero: 'switch-hero',
    /** 结束回合 */ EndPhase: 'end-phase',
    /** 投降 */ GiveUp: 'give-up',
    /** 挑选卡牌 */ PickCard: 'pick-card',
    /** 放回对局 */ PlayRecord: 'play-record',
    /** 暂停对局 */ PuaseRecord: 'puase-record',
} as const;

export type ActionType = TypeConst<typeof ACTION_TYPE>;

export const VERSION = [
    'v6.7.0', 'v6.6.0', 'v6.5.0', 'v6.4.0', 'v6.3.0', 'v6.2.0', 'v6.1.0', 'v6.0.0',
    'v5.8.0', 'v5.7.0', 'v5.6.0', 'v5.5.0', 'v5.4.0', 'v5.3.0', 'v5.2.0', 'v5.1.0', 'v5.0.0',
    'v4.8.0', 'v4.7.0', 'v4.6.1', 'v4.6.0', 'v4.5.0', 'v4.4.0', 'v4.3.0', 'v4.2.0', 'v4.1.0', 'v4.0.0',
    'v3.8.0', 'v3.7.0', 'v3.6.0', 'v3.5.0', 'v3.4.0', 'v3.3.0',
] as const;

export type OnlineVersion = typeof VERSION[number] | 'vlatest';

export const OFFLINE_VERSION = ['v4', 'v3', 'v2', 'v1'] as const;

export type OfflineVersion = typeof OFFLINE_VERSION[number];

export type Version = OnlineVersion | OfflineVersion;
