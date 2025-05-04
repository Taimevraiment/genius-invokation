import { swapKeysAndValues } from "../utils/utils.js";

export type TypeConst<T> = T[keyof T];

export const SWIRL_ELEMENT = {
    Cryo: 'Cryo', // 冰 1
    Hydro: 'Hydro', // 水 2
    Pyro: 'Pyro', // 火 3
    Electro: 'Electro', // 雷 4
} as const;

export type SwirlElementType = TypeConst<typeof SWIRL_ELEMENT>;

export const SWIRL_ELEMENT_TYPE_KEY: Record<SwirlElementType, keyof typeof SWIRL_ELEMENT> = swapKeysAndValues(SWIRL_ELEMENT);

export const PURE_ELEMENT_TYPE = {
    ...SWIRL_ELEMENT,
    Anemo: 'Anemo', // 风 5
    Geo: 'Geo', // 岩 6
    Dendro: 'Dendro', // 草 7
} as const;

export type PureElementType = TypeConst<typeof PURE_ELEMENT_TYPE>;

export const PURE_ELEMENT_TYPE_KEY: Record<PureElementType, keyof typeof PURE_ELEMENT_TYPE> = swapKeysAndValues(PURE_ELEMENT_TYPE);

export type PureElementTypeKey = keyof typeof PURE_ELEMENT_TYPE;

export const ELEMENT_TYPE = {
    Physical: 'Physical', // 物理 0
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
    Pierce: 'Pierce', // 穿透
    ...ELEMENT_TYPE,
} as const;

export type DamageType = TypeConst<typeof DAMAGE_TYPE>;

export const SKILL_COST_TYPE = {
    ...PURE_ELEMENT_TYPE,
    Same: 'Same', // 同色 8
} as const;

export type SkillCostType = TypeConst<typeof SKILL_COST_TYPE>;

export const DICE_TYPE = {
    Any: 'Any', // 无色 0
    ...SKILL_COST_TYPE,

} as const;

export type DiceType = TypeConst<typeof DICE_TYPE>;

export const COST_TYPE = {
    ...DICE_TYPE,
    Energy: 'Energy', // 充能 9
} as const;

export type CostType = TypeConst<typeof COST_TYPE>;

export const CARD_TYPE = {
    Equipment: 'Equipment', // 装备 0
    Support: 'Support', // 支援 1
    Event: 'Event', // 事件 2
} as const;

export type CardType = TypeConst<typeof CARD_TYPE>;


export const DICE_COST_TYPE = {
    Omni: 'Omni', // 万能骰 0
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
    Weapon: 'Weapon', // 武器
    Relic: 'Relic', // 圣遗物
    Vehicle: 'Vehicle', // 特技
} as const;

export const CARD_SUBTYPE_SUPPORT = {
    Place: 'Place', // 场地
    Ally: 'Ally', // 伙伴
    Item: 'Item', // 道具
} as const;

export type CardSubtypeSupport = TypeConst<typeof CARD_SUBTYPE_SUPPORT>;

export const CARD_SUBTYPE = {
    ...CARD_SUBTYPE_EQUIPMENT,
    ...CARD_SUBTYPE_SUPPORT,
    Food: 'Food', // 料理
    Talent: 'Talent', // 天赋
    Action: 'Action', // 战斗行动
    Legend: 'Legend', // 秘传
    ElementResonance: 'ElementResonance', // 元素共鸣
} as const;

export type CardSubtype = TypeConst<typeof CARD_SUBTYPE>;

export const CARD_TAG = {
    Barrier: 'Barrier', // 减伤 0
    Revive: 'Revive', // 复苏料理 1
    LocalResonance: 'LocalResonance', // 所属共鸣 2
    NonDefeat: 'NonDefeat', // 免击倒 3
    NonReconcile: 'NonReconcile', // 不能调和 4
    Enchant: 'Enchant', // 附魔 5
} as const;

export type CardTag = TypeConst<typeof CARD_TAG>;

export const WEAPON_TYPE = {
    Other: 'Other', // 其他武器 0
    Catalyst: 'Catalyst', // 法器 1
    Bow: 'Bow', // 弓 2
    Claymore: 'Claymore', // 双手剑 3
    Polearm: 'Polearm', // 长柄武器 4
    Sword: 'Sword', // 单手剑 5
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
    heroStatus: 0, // 角色状态
    combatStatus: 1, // 出战状态
} as const;

export type StatusGroup = TypeConst<typeof STATUS_GROUP>;

export const STATUS_TYPE = {
    Hide: 'Hide', // 隐藏 0
    Attack: 'Attack', // 攻击 1
    Barrier: 'Barrier', // 减伤 2
    Round: 'Round', // 回合 3
    Usage: 'Usage', // 使用 4
    MultiDamage: 'MultiDamage', // 乘伤 5
    AddDamage: 'AddDamage', // 加伤 6
    Shield: 'Shield', // 护盾 7
    Enchant: 'Enchant', // 附魔 8
    Accumulate: 'Accumulate', // 累积 9
    Sign: 'Sign', // 标记 10
    ReadySkill: 'ReadySkill', // 准备技能 11
    NonDestroy: 'NonDestroy', // 死后不删除 12
    NonDefeat: 'NonDefeat', // 免击倒 13
    NonAction: 'NonAction', // 无法行动 14
    TempNonDestroy: 'TempNonDestroy', // 暂时不消失 15
    ConditionalEnchant: 'ConditionalEnchant', // 条件附魔 16
    NightSoul: 'NightSoul', // 夜魂加持 17
    NonEvent: 'NonEvent', // 事件牌失效 18
    Show: 'Show', // 死后也显示 19
} as const;

export type StatusType = TypeConst<typeof STATUS_TYPE>;

export const SUPPORT_TYPE = {
    Round: 1, // 轮次
    Collection: 2, // 收集物
    Permanent: 3, // 常驻
} as const;

export type SupportType = TypeConst<typeof SUPPORT_TYPE>;

export const HERO_LOCAL = {
    Monster: 'Monster', // 魔物 0
    Mondstadt: 'Mondstadt', // 蒙德 1
    Liyue: 'Liyue', // 璃月 2
    Inazuma: 'Inazuma', // 稻妻 3
    Sumeru: 'Sumeru', // 须弥 4
    Fontaine: 'Fontaine', // 枫丹 5
    Natlan: 'Natlan', // 纳塔 6
    Snezhnaya: 'Snezhnaya', // 至冬 7
    Fatui: 'Fatui', // 愚人众 8
    Hilichurl: 'Hilichurl', // 丘丘人 9
    Eremite: 'Eremite', // 镀金旅团 10
    ArkheOusia: 'ArkheOusia', // 始基力:荒性 11
    ArkhePneuma: 'ArkhePneuma', // 始基力:芒性 12
    ConsecratedBeast: 'ConsecratedBeast', // 圣骸兽 13
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
    [HERO_LOCAL.Snezhnaya]: 7,
    [HERO_LOCAL.Fatui]: 216,
    [HERO_LOCAL.Hilichurl]: 0,
    [HERO_LOCAL.Eremite]: 0,
    [HERO_LOCAL.ArkheOusia]: 0,
    [HERO_LOCAL.ArkhePneuma]: 0,
    [HERO_LOCAL.ConsecratedBeast]: 0,
} as const;

export type HeroLocalCode = TypeConst<typeof HERO_LOCAL_CODE>;

export const HERO_LOCAL_CODE_KEY = swapKeysAndValues(HERO_LOCAL_CODE);

export const HERO_TAG = {
    ...HERO_LOCAL,
    Ousia: 'Ousia', // 荒 11
    Pneuma: 'Pneuma', // 芒 12
} as const;

export type HeroTag = TypeConst<typeof HERO_TAG>;

export const ELEMENT_REACTION = {
    Overload: 103, // 超载
    Superconduct: 104, // 超导
    Swirl: 107, // 扩散
    ElectroCharged: 105, // 感电
    Vaporize: 102, // 蒸发
    Melt: 101, // 融化
    Burning: 115, // 燃烧
    Frozen: 106, // 冻结
    Crystallize: 111, // 结晶
    Quicken: 117, // 原激化
    Bloom: 116, // 绽放
} as const;

export type ElementReaction = TypeConst<typeof ELEMENT_REACTION>;

export const SKILL_TYPE = {
    PassiveHidden: 0, // 隐藏被动
    Normal: 1, // 普通攻击
    Elemental: 2, // 元素战技
    Burst: 3, // 元素爆发
    Passive: 4, // 被动技能
    Vehicle: 5, // 特技
} as const;

export type SkillType = TypeConst<typeof SKILL_TYPE>;

export const SUMMON_DESTROY_TYPE = {
    Used: 0, // 次数用完直接销毁
    UsedRoundEnd: 1, // 次数用完后，回合结束时销毁
    RoundEnd: 2, // 回合结束时强制销毁
} as const;

export type SummonDestroyType = TypeConst<typeof SUMMON_DESTROY_TYPE>;

export const CMD_MODE = {
    Random: 1, // 随机不重复基础骰子
    FrontHero: 2, // 当前出战角色(hidxs[0]控制前后)元素骰子
    HighHandCard: 3, // 弃置花费最高的手牌 
    AllHandCards: 4, // 弃置所有手牌
    TopPileCard: 5, // 弃置牌堆顶的牌
    RandomPileCard: 6, // 弃置牌库中随机一张牌
    IsNotPublic: 7, // 不公开加入牌库的牌
    IsPublic: 8, // 公开抓到的牌
    GetSummon: 9, // 使用技能挑选牌
    GetCard: 10, // 挑选牌
    UseCard: 11 // 挑选并打出牌
} as const;

export const INFO_TYPE = {
    Skill: 'skill', // 技能
    Hero: 'hero', // 角色
    Card: 'card', // 卡牌/支援物
    Summon: 'summon', // 召唤物
    Support: 'support', // 支援物
} as const;

export type InfoType = TypeConst<typeof INFO_TYPE>;

export const PHASE = {
    NOT_READY: 0, // 未准备
    NOT_BEGIN: 1, // 未开始
    CHANGE_CARD: 2, // 换牌
    CHOOSE_HERO: 3, // 选择出战角色
    DICE: 4, // 掷骰子
    ACTION_START: 5, // 行动开始
    ACTION: 6, // 行动中
    ACTION_END: 7, // 行动结束
    PHASE_END: 8, // 回合结束
    PICK_CARD: 9, // 挑选卡牌
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
    StartGame: 'start-game', // 开始游戏
    ChangeCard: 'change-card', // 替换手牌
    ChooseInitHero: 'choose-init-hero', // 选择初始出战角色
    UseCard: 'use-card', // 使用手牌
    UseSkill: 'use-skill', // 使用技能
    Reconcile: 'reconcile', // 调和手牌
    Reroll: 'reroll', // 重投骰子
    SwitchHero: 'switch-hero', // 切换角色
    EndPhase: 'end-phase', // 结束回合
    GiveUp: 'give-up', // 投降
    PickCard: 'pick-card', // 挑选卡牌
} as const;

export type ActionType = TypeConst<typeof ACTION_TYPE>;

export const VERSION = [
    'v5.6.0', 'v5.5.0', 'v5.4.0', 'v5.3.0', 'v5.2.0', 'v5.1.0', 'v5.0.0',
    'v4.8.0', 'v4.7.0', 'v4.6.1', 'v4.6.0', 'v4.5.0', 'v4.4.0', 'v4.3.0', 'v4.2.0', 'v4.1.0', 'v4.0.0',
    'v3.8.0', 'v3.7.0', 'v3.6.0', 'v3.5.0', 'v3.4.0', 'v3.3.0',
] as const;

export type OnlineVersion = typeof VERSION[number] | 'vlatest';

export const OFFLINE_VERSION = ['v2', 'v1'] as const;

export type OfflineVersion = typeof OFFLINE_VERSION[number];

export type Version = OnlineVersion | OfflineVersion;
