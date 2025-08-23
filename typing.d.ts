import {
    ActionType, CardSubtype, CardTag, DAMAGE_TYPE, DamageType, DiceCostType, ELEMENT_REACTION, ElementType, InfoType,
    Phase, PlayerStatus, PURE_ELEMENT_TYPE, PureElementType, SkillType, StatusGroup, SWIRL_ELEMENT, Version,
} from "./common/constant/enum"
import { ArrayHero, ArrayStatus } from "./common/data/builder/baseBuilder"
import { type GICard } from "./common/data/builder/cardBuilder"
import { type GIHero } from "./common/data/builder/heroBuilder"
import { type GISkill } from "./common/data/builder/skillBuilder"
import { type GIStatus } from "./common/data/builder/statusBuilder"
import { type GISummon } from "./common/data/builder/summonBuilder"
import { type GISupport } from "./common/data/builder/supportBuilder"
import CmdsGenerator from "./common/utils/cmdsGenerator"
import { versionWrap } from "./common/utils/gameUtil"

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
    ip?: string, // 客户端ip地址
    rid: number, // 所在房间id
    handCards: Card[], // 手牌
    heros: ArrayHero, // 登场英雄
    pile: Card[], // 牌库
    supports: Support[], // 支援物
    summons: Summon[], // 召唤物
    dice: DiceCostType[], // 骰子
    rollCnt: number, // 骰子投掷次数
    status: PlayerStatus, // 玩家当前状态
    combatStatus: ArrayStatus, // 出战状态
    phase: Phase, // 玩家当前阶段
    pidx: number, // 玩家序号
    hidx: number, // 出战角色序号
    isFallAtk: boolean, // 是否为下落攻击状态
    canAction: boolean, // 是否可以行动
    playerInfo: GameInfo,
    isOffline: boolean,
    UI: {
        info: string, // 右上角提示信息
        heroSwitchDice: number, // 切换角色所需骰子
        showRerollBtn: boolean, // 是否显示重投按钮
        willGetCard: {
            cards: Card[], // 即将获得的卡
            isNotPublic: boolean, // 是否公开
            isFromPile: boolean, // 是否从牌库获得
        },
        willAddCard: {
            cards: Card[], // 即将加入牌库的卡
            isNotPublic: boolean, // 是否公开
        },
        willDiscard: { // 即将舍弃的卡
            hcards: Card[], // 手牌
            pile: Card[], // 牌库
            isNotPublic: boolean, // 是否公开
        },
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

type Skill = GISkill;

type MinusDiceSkill = {
    skill?: number[], // 所有技能减费
    skills?: number[][], // 每个特判技能减费
    skilltype1?: number[], // 普通攻击减费
    skilltype2?: number[], // 元素战技减费
    skilltype3?: number[], // 元素爆发减费
    skilltype5?: number[], // 特技减费
    elDice?: PureElementType, // 是否减某种元素骰
    isAll?: boolean, // 是否对其他角色生效
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
    sktype?: SkillType, // 引起协同攻击的技能类型
    atkHidx?: number,// 攻击角色hidx
    isQuickAction?: boolean, // 是否为快速行动
    discards?: Card[], // 舍弃的牌
    hcard?: Card, // 调和或使用的牌
    source?: number, // 触发该状态的实体id
    isPriority?: boolean, // 是否优先攻击出战角色，即不鞭尸
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
    summon?: (number | [number, ...any] | Summon)[] | number,
    isOppo?: boolean,
    summonTrigger?: Trigger | Trigger[],
}

type Cmd = 'getDice' | 'getCard' | 'getEnergy' | 'heal' | 'getStatus' | 'reroll' | 'revive' | 'switch-to' | 'switch-before' |
    'switch-after' | 'attach' | 'attack' | 'changeDice' | 'changeCard' | 'changeSummon' | 'useSkill' | 'changePattern' |
    'getSkill' | 'loseSkill' | 'addCard' | 'discard' | 'pickCard' | 'addMaxHp' | 'equip' | 'exchangePos' | 'stealCard' |
    'putCard' | 'exchangeHandCards' | 'consumeNightSoul' | 'getNightSoul' | 'consumeDice' | 'convertCard' | 'getSummon';

type GameInfo = {
    isUsedLegend: boolean, // 是否使用秘传卡
    relicCnt: number, // 初始牌堆圣遗物数量
    relicTypeCnt: number, // 初始牌堆圣遗物种类
    weaponCnt: number, // 初始牌堆武器数量
    weaponTypeCnt: number, // 初始牌堆武器种类
    talentCnt: number, // 初始牌堆天赋数量
    talentTypeCnt: number, // 初始牌堆天赋种类
    usedCardIds: number[], // 使用过的牌的id
    destroyedSupport: number, // 我方被弃置的支援牌数量
    destroyedSummon: number, // 我方被弃置的召唤物数量
    oppoGetElDmgType: number, // 敌方受到元素伤害的种类(用位计数)
    discardCnt: number, // 每回合舍弃卡牌的数量
    reconcileCnt: number, // 每回合调和次数
    discardIds: number[], // 舍弃卡牌的id
    initCardIds: number[], // 初始牌组id
    isUsedCardPerRound: boolean, // 我方本回合是否使用过行动卡
    usedVehcileCnt: number, // 本局打出过的特技牌数量
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

type DmgSource = 'skill' | 'status' | 'summon' | 'card' | 'support' | 'null';

type DamageVO = {
    dmgSource: DmgSource, // 造成伤害来源
    atkPidx: number, // 攻击者玩家序号
    atkHidx: number, // 攻击者角色序号
    tarHidx: number, // 受攻击角色序号
    willHeals: number[], // 回血量
    willDamages: number[][], // 造成伤害
    dmgElements: DamageType[], // 元素伤害类型
    elTips: [string, PureElementType, PureElementType][], // 元素反应提示
    curPlayers?: Player[], // 当前玩家数组
    selected?: number[], // 伤害来源闪光(状态/召唤物)
};

type TrgElRe = keyof typeof SWIRL_ELEMENT;
type TrgSkType = Exclude<SkillType, 4 | 5>;
type TrgEl = keyof typeof PURE_ELEMENT_TYPE;
type TrgDmg = 'el' | keyof typeof DAMAGE_TYPE;
type TrgOppo = '-oppo' | '';
type TrgGet = 'get-' | '';
type TrgOther = 'other-' | '';
type TrgAfter = 'after-' | '';
type TrgActive = 'active-' | '';
type TrgDice = 'add-' | 'minus-' | '';
type TrgPre = 'pre-' | '';

type Trigger = 'phase-start' | 'phase-end' | 'phase-dice' | 'game-start' | `action-start${TrgOppo}` | `action-after${TrgOppo}` |
    'end-phase' | 'any-end-phase' | `${TrgAfter}${TrgOther}skill${TrgOppo}` | `${TrgAfter}${TrgOther}skilltype${SkillType}` |
    `${TrgActive | TrgDice}switch` | `${TrgActive | TrgDice}switch-to` | `${TrgActive | TrgDice}switch-from` | 'card' |
    `${TrgGet | TrgOther}elReaction` | `getdice${TrgOppo}` | `${keyof typeof ELEMENT_REACTION}${TrgOppo}` |
    `${TrgGet | TrgOther}elReaction-${TrgEl}${TrgOppo}` | `elReaction-Anemo:${TrgElRe}` | 'ecard' | `elReaction-Geo:${TrgElRe}` |
    'get-elReaction-oppo' | 'kill' | 'killed' | 'will-killed' | `${TrgOther | TrgAfter}dmg` | `${TrgOther}${TrgDmg}-dmg` | 'other-get-elReaction' |
    'dmg-Swirl' | `${TrgElRe}-dmg-Swirl` | `${TrgOther | TrgAfter}getdmg` | `${TrgDmg}-getdmg${TrgOppo}` | 'getdmg-oppo' | 'revive' |
    `heal${TrgOppo}` | `${TrgOther | TrgPre}heal` | 'useReadySkill' | 'status-destroy' | 'summon-destroy' | 'slot-destroy' | 'support-destroy' |
    'calc' | 'reconcile' | 'discard' | `getcard${TrgOppo}` | `${TrgOther | TrgGet}${keyof typeof ELEMENT_REACTION}` | 'enter' |
    `${TrgOther}vehicle${TrgOppo}` | 'change-turn' | 'turn-end' | `${TrgActive | TrgDice}switch${TrgOppo}` | 'hcard-calc' | `${TrgPre}get-status` |
    'summon-generate' | `drawcard${TrgOppo}` | 'reduce-dmg' | 'pick' | 'trigger' | `${TrgPre}consumeNightSoul` |
    'getNightSoul' | 'ready-skill' | '';

type Entity = Skill | Status | Summon | Card | Support;

type Countdown = {
    limit: number, // 倒计时配置
    curr: number, // 当前倒计时
    timer: NodeJS.Timeout | undefined, // 定时器
}

type ActionData = {
    type: ActionType,
    skillId?: number, // 使用的技能id -1无
    cardIdxs?: number[], // 使用/替换的卡牌序号
    heroIdxs?: number[], // 选择的目标角色序号
    summonIdx?: number, // 选择的召唤物序号 -1无
    supportIdx?: number, // 选择的支援物序号 -1无
    diceSelect?: boolean[], // 使用/替换的骰子序号
    heroIds?: number[], // 卡组角色id
    cardIds?: number[], // 卡组卡牌id
    shareCode?: string, // 分享码
    flag?: string, // 发起请求的标志
    recordData?: RecordData, // 对局回放数据
}

type RecordData = {
    seed: string, // 当局种子
    pidx: number, // 存录像的人的pidx
    name: string, // 房间名字
    username: string[], // 玩家名字数组
    shareCode: string[], // 玩家分享码数组
    version: Version, // 牌局版本
    actionLog: ActionLog[], // 录像回放数据
    customVersionConfig?: CustomVersionConfig, // 自定义版本配置
    isPlaying?: boolean, // 是否正在播放录像
    isExecuting?: boolean, // 是否正在执行录像
}

type ActionInfo = {
    content?: string, // 提示词
    card?: Card, // 使用卡时的卡牌
    isOppo?: boolean, // 是否对方角色
    isShow?: boolean, // 是否显示
    avatar?: string, // 角色头像
    subContent?: string, // 提示词
}

type ActionLog = {
    actionData: ActionData,
    pidx: number,
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
    handCardsInfo: {
        count: number[],
        forbiddenKnowledge: number[],
    }
    isWin: number,
    tip: string,
    actionInfo: ActionInfo,
    slotSelect: number[],
    heroSelect: number[],
    statusSelect: number[],
    summonSelect: number[],
    supportSelect: number[],
    pickModal: PickCard,
    watchers: number,
    recordData?: RecordData,
    flag: string,
}>

type Preview = ActionData & {
    isValid: boolean,
    willHp?: (number | undefined)[],
    willAttachs?: ElementType[][],
    willSwitch?: boolean[][],
    willSummons?: Summon[][],
    changedSummons?: (Summon | undefined)[][],
    willSummonChange?: number[][],
    willSupportChange?: number[][],
    willEnergyChange?: number[][],
    changedHeros?: (string | undefined)[][],
    heroCanSelect?: boolean[],
    supportCanSelect?: boolean[][],
    summonCanSelect?: boolean[][],
    switchHeroDiceCnt?: number,
    isQuickAction?: boolean,
    tarHidx?: number,
}

type LogType = 'log' | 'system' | 'info' | 'emit';

type CalcAtkRes = {
    element?: DamageType | DiceCostType,
    heal?: number,
    damage?: number,
    pdmg?: number,
    isSelf?: boolean,
    isPriority?: boolean,
    hidxs?: number[],
    cmds?: CmdsGenerator,
    execmds?: CmdsGenerator,
    damages?: SmnDamageHandle,
    exec?: (...args: any) => any,
}

type SmnDamageHandle = (isOppo?: boolean, cnt?: number, element?: DamageType, hidxs?: number[]) => { dmgElement: DamageType, willDamages: number[][] }

type AtkTask = {
    pidx: number,
    cmds: CmdsGenerator,
    atkname: string,
}

type PickCard = {
    cards: Card[],
    selectIdx: number,
    cardType: PickCardType,
    skillId: number,
    hidxs?: number[],
    phase?: Phase,
    isQuickAction?: boolean,
}

type PickCardType = 'getCard' | 'summon' | 'useCard';

type VersionWrapper = ReturnType<typeof versionWrap>;

type TaskItem = [
    string, // 任务名称
    any[] | StatusTask, // 任务参数
    number, // 触发该任务的实体id
    boolean, // 任务是否为有伤害任务
];

type Env = 'prod' | 'dev' | 'test';

type CustomVersionConfig = {
    name: string,
    baseVersion: Version,
    diff: Record<number, Version>,
    banList: number[],
}