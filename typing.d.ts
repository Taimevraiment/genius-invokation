import {
    ActionType, CardSubtype, CardTag, DAMAGE_TYPE, DamageType, DiceCostType, ELEMENT_REACTION, ElementType, InfoType,
    Phase, PlayerStatus, PURE_ELEMENT_TYPE, PureElementType, SkillType, StatusGroup, SWIRL_ELEMENT, Version,
} from "./common/constant/enum"
import { type GICard } from "./common/data/builder/cardBuilder"
import { type GIHero } from "./common/data/builder/heroBuilder"
import { type GISkill } from "./common/data/builder/skillBuilder"
import { type GIStatus } from "./common/data/builder/statusBuilder"
import { type GISummon } from "./common/data/builder/summonBuilder"
import { type GISupport } from "./common/data/builder/supportBuilder"

type RoomList = {
    id: number,
    name: string,
    isStart: boolean,
    version: Version,
    playerCnt: number,
    hasPassWord: boolean,
}[]

type PlayerList = {
    id: number,
    name: string,
    rid: number,
    status: number,
}[]

type Player = {
    id: number, // id
    name: string, // 名字
    rid: number, // 所在房间id
    handCards: Card[], // 手牌
    heros: Hero[], // 登场英雄
    pile: Card[], // 牌库
    supports: Support[], // 支援物
    summons: Summon[], // 召唤物
    dice: DiceCostType[], // 骰子
    rollCnt: number, // 骰子投掷次数
    status: PlayerStatus, // 玩家当前状态
    combatStatus: Status[], // 出战状态
    phase: Phase, // 玩家当前阶段
    pidx: number, // 玩家序号
    hidx: number, // 出战角色序号
    isFallAtk: boolean, // 是否为下落攻击状态
    canAction: boolean, // 是否可以行动
    playerInfo: GameInfo,
    deckIdx: number, // 出战卡组id
    isOffline: boolean,
    UI: {
        info: string, // 右上角提示信息
        heroSwitchDice: number, // 切换角色所需骰子
        showRerollBtn: boolean, // 是否显示重投按钮
        willGetCard: Card[], // 即将获得的卡
        willAddCard: {
            cards: Card[], // 即将加入牌库的卡
            isNotPublic: boolean, // 是否公开
        },
        willDiscard: Card[][], // 即将舍弃的卡 [手牌, 牌库]
        atkhidx: number, // 攻击角色序号
        tarhidx: number, // 受击角色序号
    }
}

type Deck = {
    name: string,
    heroIds: number[],
    cardIds: number[],
}

type Card = GICard;

type Support = GISupport;

type Summon = GISummon;

type Status = GIStatus;

type Hero = GIHero;

type Skill = GISkill

type MinuDiceSkill = {
    skill?: number[],
    skills?: number[][],
    skilltype1?: number[],
    skilltype2?: number[],
    skilltype3?: number[],
    skilltype5?: number[],
    elDice?: PureElementType,
}

type AddDiceSkill = {
    skill?: number[],
    skilltype1?: number[],
    skilltype2?: number[],
    skilltype3?: number[],
    skilltype5?: number[],
}

type StatusTask = {
    id: number, // 攻击状态id
    name: string, // 状态名称
    entityId: number, // 攻击状态entityId
    group: StatusGroup, // 攻击状态类型：0角色状态 1阵营状态
    pidx: number, // 攻击者pidx
    isSelf: number, // 是否为自伤
    trigger: Trigger, // 触发条件
    hidx: number, // 攻击者hidx
    skid: number, // 引起协同攻击的技能id -1为切换角色
    isQuickAction?: boolean, // 是否为快速行动
    discards?: Card[], // 舍弃的牌
    card?: Card, // 调和或使用的牌
}

type Cmds = {
    cmd: Cmd,
    cnt?: number,
    mode?: number,
    element?: DiceCostType | DamageType | (DiceCostType | DamageType)[],
    hidxs?: number[],
    isAttach?: boolean,
    card?: Card | number | (Card | number)[],
    subtype?: CardSubtype | CardSubtype[],
    cardTag?: CardTag | CardTag[],
    status?: (number | [number, ...any] | Status)[] | number,
    isOppo?: boolean,
}

type Cmd = 'getDice' | 'getCard' | 'getEnergy' | 'heal' | 'getStatus' | 'reroll' | 'revive' | 'switch-to' |
    'switch-before' | 'switch-after' | 'attach' | 'attack' | 'changeDice' | 'changeCard' | 'changeElement' | 'useSkill' |
    'changePattern' | 'getSkill' | 'loseSkill' | 'addCard' | 'discard';

type GameInfo = {
    isUsedLegend: boolean, // 是否使用秘传卡
    artifactCnt: number, // 初始牌堆圣遗物数量
    artifactTypeCnt: number, // 初始牌堆圣遗物种类
    weaponCnt: number, // 初始牌堆武器数量
    weaponTypeCnt: number, // 初始牌堆武器种类
    talentCnt: number, // 初始牌堆天赋数量
    talentTypeCnt: number, // 初始牌堆天赋种类
    usedCardIds: number[], // 使用过的牌的id
    destroyedSupport: number, // 我方被弃置的支援牌数量
    oppoGetElDmgType: number, // 敌方受到元素伤害的种类(用位计数)
    discardCnt: number, // 每回合舍弃卡牌的数量
    reconcileCnt: number, // 每回合调和次数
    discardIds: number[], // 舍弃卡牌的id
    initCardIds: number[], // 初始牌组id
    isUsedCardPerRound: boolean, // 我方本回合是否使用过行动卡
}

type InfoVO = {
    version: Version, // 版本
    isShow: boolean, // 是否显示模态框
    type: InfoType | null, // 显示类型
    skidx?: number, // 如果type=Skill,技能的序号
    combatStatus?: Status[] | null, // 如果type=Skill|Hero,出战状态
    info: Hero | Card | Summon | null,
}

type ExplainContent = Card | Summon | Status | Skill | string;

type DamageVO = {
    dmgSource: 'skill' | 'status' | 'summon' | 'card' | 'support' | 'null', // 造成伤害来源
    atkPidx: number, // 攻击者玩家序号
    atkHidx: number, // 攻击者角色序号
    tarHidx: number, // 受攻击角色序号
    willHeals: number[], // 回血量
    willDamages: number[][], // 造成伤害
    dmgElements: DamageType[], // 元素伤害类型
    elTips: [string, PureElementType, PureElementType][], // 元素反应提示
    selected?: number[], // 伤害来源闪光(状态/召唤物)
} | -1;

type TrgElRe = keyof typeof SWIRL_ELEMENT;
type TrgSkType = Exclude<SkillType, 4 | 5>;
type TrgEl = keyof typeof PURE_ELEMENT_TYPE;
type TrgDmg = 'el' | keyof typeof DAMAGE_TYPE;
type TrgOppo = '-oppo' | '';
type TrgGet = 'get-' | '';
type TrgOther = 'other-' | '';
type TrgAfter = 'after-' | '';

type Trigger = 'phase-start' | 'phase-end' | 'phase-dice' | 'game-start' | `action-start${TrgOppo}` | `action-after${TrgOppo}` |
    'end-phase' | 'any-end-phase' | `${TrgOther | TrgAfter}skill${TrgOppo}` | `${TrgOther | TrgAfter}skilltype${SkillType}` |
    `change${TrgOppo}` | 'change-to' | 'change-from' | 'card' | `${TrgGet | TrgOther}elReaction` | `getdice${TrgOppo}` |
    `${TrgOther | TrgGet}elReaction-${TrgEl}` | `elReaction-Anemo:${TrgElRe}` | 'ecard' | `elReaction-Geo:${TrgElRe}` |
    'get-elReaction-oppo' | 'kill' | 'killed' | 'will-killed' | `${TrgOther}dmg` | `${TrgDmg}-dmg` | 'other-get-elReaction' |
    'dmg-Swirl' | `${TrgElRe}-dmg-Swirl` | `${TrgOther}getdmg` | `${TrgDmg}-getdmg${TrgOppo}` | 'getdmg-oppo' | 'revive' |
    `heal${TrgOppo}` | 'pre-heal' | 'useReadySkill' | 'status-destroy' | 'summon-destroy' | 'slot-destroy' | 'support-destroy' | 'calc' |
    'reconcile' | 'discard' | `getcard${TrgOppo}` | `${TrgOther}${keyof typeof ELEMENT_REACTION}` | 'enter' | `${TrgOther}vehicle${TrgOppo}` |
    'change-turn' | '';

type Entity = Skill | Status | Summon | Card | Support;

type Countdown = {
    limit: number, // 倒计时配置
    curr: number, // 当前倒计时
    timer: NodeJS.Timeout | undefined, // 定时器
}

type ActionData = {
    type: ActionType,
    cpidx?: number, // 发起请求的玩家序号
    skillId?: number, // 使用的技能id -1无
    cardIdxs?: number[], // 使用/替换的卡牌序号
    heroIdxs?: number[], // 选择的目标角色序号
    summonIdx?: number, // 选择的召唤物序号 -1无
    supportIdx?: number, // 选择的支援物序号 -1无
    diceSelect?: boolean[], // 使用/替换的骰子序号
    deckIdx?: number, // 使用的卡组序号 -1无
    shareCode?: string, // 卡组分享码
    flag?: string, // 发起请求的标志
}

type ServerData = Readonly<{
    players: Player[],
    previews: Preview[],
    phase: Phase,
    isStart: boolean,
    round: number,
    currCountdown: number,
    damageVO: DamageVO | null,
    log: string[],
    pileCnt: number[],
    diceCnt: number[],
    handCardsCnt: number[],
    isWin: number,
    tip: string,
    actionInfo: string,
    slotSelect: number[],
    heroSelect: number[],
    statusSelect: number[],
    summonSelect: number[],
    supportSelect: number[],
    flag: string,
}>

type Preview = Readonly<ActionData & {
    isValid: boolean,
    willHp?: (number | undefined)[],
    willAttachs?: ElementType[][],
    willSwitch?: boolean[][],
    willSummons?: Summon[][],
    willSummonChange?: number[][],
    willSupportChange?: number[][],
    heroCanSelect?: boolean[],
    supportCanSelect?: boolean[][],
    summonCanSelect?: boolean[][],
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
}>

type LogType = 'log' | 'system' | 'info';

type CalcAtkRes = {
    element?: DamageType,
    heal?: number,
    damage?: number,
    pdmg?: number,
    isSelf?: boolean,
    hidxs?: number[],
    cmds?: Cmds[],
    damages?: SmnDamageHandle,
    exec?: (...args: any) => any,
}

type SmnDamageHandle = (isOppo?: boolean, cnt?: number, element?: DamageType, hidxs?: number[]) => { dmgElement: DamageType, willDamages: number[][] }
