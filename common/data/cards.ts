import { Card, Cmds, GameInfo, Hero, MinuDiceSkill, Status, Summon, Support, Trigger } from '../../typing';
import { newStatus } from './statuses.js';
import {
    CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CardSubtype, CardTag, CardType, DICE_COST_TYPE, DICE_TYPE, DiceCostType,
    DiceType, ELEMENT_TYPE, HERO_LOCAL_CODE_KEY, HeroLocalCode, PURE_ELEMENT_CODE_KEY, PureElementCode, PureElementType,
    VERSION, WEAPON_TYPE, WeaponType,
} from '../constant/enum.js';
import { ELEMENT_NAME, HERO_LOCAL_NAME, PURE_ELEMENT_NAME, WEAPON_TYPE_NAME } from '../constant/UIconst.js';
import { isCdt } from '../utils/utils.js';
import { Version } from '../constant/enum.js';
import { NULL_CARD } from '../constant/init.js';
import { getHidById } from '../utils/gameUtil.js';

export class GICard {
    id: number; // 唯一id
    shareId: number; // 分享码id
    entityId: number = -1; // 实体id
    name: string; // 卡牌名
    version: Version; // 加入的版本
    cost: number; // 费用
    costChange: number = 0; // 费用变化
    costType: DiceType; // 费用类型
    type: CardType; // 牌类型
    subType: CardSubtype[]; // 副类型
    tag: CardTag[]; // 特殊作用标签
    userType: number | WeaponType; // 使用人类型匹配：0全匹配 匹配武器Hero.weaponType 匹配天赋Hero.id
    useCnt: number; // 累积点数
    perCnt: number; // 每回合的效果使用次数
    energy: number; // 需要的充能
    anydice: number; // 除了元素骰以外需要的任意骰
    selected: boolean = false; // 是否被选择
    handle: (card: Card, event: CardHandleEvent) => CardHandleRes; // 卡牌发动的效果函数
    canSelectHero: number; // 能选择角色的数量
    canSelectSummon: -1 | 0 | 1; // 能选择的召唤物 -1不能选择 0能选择敌方 1能选择我方
    canSelectSupport: -1 | 0 | 1; // 能选择的支援 -1不能选择 0能选择敌方 1能选择我方
    cidx: number = -1; // 在手牌中的序号
    UI: {
        src: string, // 图片url
        description: string, // 卡牌描述
        cnt: number, // 卡牌数量，默认为2
        descriptions: string[], // 处理后的技能描述
        explains: string[], // 要解释的文本
    };
    constructor(
        id: number, shareId: number, name: string, version: Version, description: string, src: string, cost: number, costType: DiceType,
        type: CardType, subType?: CardSubtype | CardSubtype[], userType: number | WeaponType = 0,
        handle?: (card: Card, event: CardHandleEvent) => CardHandleRes | undefined,
        options: {
            tag?: CardTag[], uct?: number, pct?: number, expl?: string[], energy?: number, anydice?: number, cnt?: number,
            canSelectSummon?: 0 | 1 | -1, canSelectSupport?: 0 | 1 | -1, canSelectHero?: number,
            isResetUct?: boolean, isResetPct?: boolean, spReset?: boolean,
        } = {}
    ) {
        this.id = id;
        this.shareId = shareId;
        this.name = name;
        this.version = version;
        subType ??= [];
        if (typeof subType !== 'object') subType = [subType];
        const { tag = [], uct = -1, pct = 0, expl = [], energy = 0, anydice = 0, canSelectSummon = -1, cnt = 2,
            isResetPct = true, isResetUct = false, spReset = false, canSelectSupport = -1 } = options;
        let { canSelectHero = 0 } = options;
        const hid = getHidById(id);
        description = description
            .replace(/(?<=〖)ski,(\d)(?=〗)/g, `ski${hid},$1`)
            .replace(/(?<=【)ski,(\d)(?=】)/g, `ski${hid},$1`);
        this.UI = {
            description,
            src,
            cnt,
            descriptions: [],
            explains: [...(description.match(/(?<=【)[^【】]+\d(?=】)/g) ?? []), ...expl],
        }
        if (tag.includes(CARD_TAG.Revive)) this.UI.description += `；(每回合中，最多通过｢料理｣复苏1个角色，并且每个角色最多食用1次｢料理｣)`;
        else if (tag?.includes(CARD_TAG.LocalResonance)) this.UI.description += `；(牌组包含至少2个｢${HERO_LOCAL_NAME[HERO_LOCAL_CODE_KEY[(id - 331800) as HeroLocalCode]]}｣角色，才能加入牌组)`;
        else if (subType?.includes(CARD_SUBTYPE.Weapon)) this.UI.description += `；(｢${WEAPON_TYPE_NAME[userType as WeaponType]}｣【角色】才能装备。角色最多装备1件｢武器｣)`;
        else if (subType?.includes(CARD_SUBTYPE.Artifact)) this.UI.description += `；(角色最多装备1件｢圣遗物｣)`;
        else if (subType?.includes(CARD_SUBTYPE.Food)) {
            this.UI.description += `；(每回合每个角色最多食用1次｢料理｣)`;
            const ohandle = handle;
            handle = (card, event) => {
                const res = ohandle?.(card, event) ?? {};
                return {
                    ...res,
                    status: [...(res?.status ?? []), newStatus(version)(303300)],
                }
            }
        } else if (subType?.includes(CARD_SUBTYPE.Talent)) {
            const hro = `hro${hid}`;
            const ski = `ski${hid},${userType}`;
            if (this.UI.description.startsWith('{action}')) {
                if (!this.UI.explains.includes(ski)) this.UI.explains.unshift(ski);
                const ohandle = handle;
                const cnt = userType as number;
                handle = (card, event) => {
                    const { slotUse = false } = event;
                    if (slotUse) return { trigger: ['skill'], cmds: [{ cmd: 'useSkill', cnt }] }
                    return ohandle?.(card, event);
                }
            }
            this.UI.description = this.UI.description
                .replace(/{action}/, `[战斗行动]：我方出战角色为【hro】时，装备此牌。；【hro】装备此牌后，立刻使用一次【ski】。`)
                .replace(/(?<=〖)hro(?=〗)/g, hro)
                .replace(/(?<=【)hro(?=】)/g, hro)
                .replace(/(?<=〖)ski(?=〗)/g, ski)
                .replace(/(?<=【)ski(?=】)/g, ski) + `；(牌组中包含【${hro}】，才能加入牌组)`;
            userType = hid;
        } else if (subType?.includes(CARD_SUBTYPE.Legend)) {
            this.UI.description += `；(整局游戏只能打出一张｢秘传｣卡牌; 这张牌一定在你的起始手牌中)`;
            this.UI.cnt = 1;
        } else if (subType?.includes(CARD_SUBTYPE.ElementResonance)) {
            const elCode = Math.floor(id / 100) % 10 as PureElementCode;
            this.UI.description += `；(牌组中包含至少2个‹${elCode}${ELEMENT_NAME[PURE_ELEMENT_CODE_KEY[elCode]]}›角色，才能加入牌组)`;
        }
        if (type == CARD_TYPE.Equipment) canSelectHero = 1;
        this.cost = cost;
        this.costType = costType;
        this.type = type;
        this.subType = subType ?? [];
        this.tag = tag;
        this.userType = userType;
        this.canSelectHero = canSelectHero;
        this.handle = (card, event) => {
            const { reset = false } = event;
            if (reset) {
                if (isResetPct) card.perCnt = pct;
                if (isResetUct) card.useCnt = uct;
                if (!spReset) return {}
            }
            return handle?.(card, event) ?? {};
        }
        this.useCnt = uct;
        this.perCnt = pct;
        this.energy = energy;
        this.anydice = anydice;
        this.canSelectSummon = canSelectSummon;
        this.canSelectSupport = canSelectSupport;
    }
    setEntityId(entityId: number): Card {
        if (this.entityId == -1) this.entityId = entityId;
        return this;
    }
    setCnt(cnt: number): Card {
        this.UI.cnt = cnt;
        return this;
    }
    hasSubtype(...subtypes: CardSubtype[]): boolean {
        return this.subType.some(v => subtypes.includes(v));
    }
    hasTag(...tags: CardTag[]): boolean {
        return this.tag.some(v => tags.includes(v));
    }
}

export type CardHandleEvent = {
    heros?: Hero[],
    eheros?: Hero[],
    hidxs?: number[],
    reset?: boolean,
    hcard?: Card,
    trigger?: Trigger,
    summons?: Summon[],
    esummons?: Summon[],
    switchHeroDiceCnt?: number,
    hcards?: Card[],
    ehcardsCnt?: number,
    heal?: number[],
    ephase?: number,
    isChargedAtk?: boolean,
    isFallAtk?: boolean,
    round?: number,
    playerInfo?: GameInfo,
    dicesCnt?: number,
    restDmg?: number,
    isSkill?: number,
    isSummon?: number,
    isExec?: boolean,
    supports?: Support[],
    esupports?: Support[],
    minusDiceCard?: number,
    isMinusDiceSkill?: boolean,
    ehidx?: number,
    getdmg?: number[],
    slotUse?: boolean,
    isExecTask?: boolean,
    isElStatus?: boolean[],
    selectSummon?: number,
}

export type CardHandleRes = {
    support?: Support[],
    cmds?: Cmds[],
    execmds?: Cmds[],
    trigger?: Trigger[],
    status?: Status[],
    statusOppo?: Status[],
    canSelectHero?: boolean[],
    summon?: Summon[],
    addDmg?: number,
    addDmgType1?: number,
    addDmgType2?: number,
    addDmgType3?: number,
    addDmgSummon?: number,
    addDmgCdt?: number,
    minusDiceSkill?: MinuDiceSkill,
    minusDiceCard?: number,
    minusDiceHero?: number,
    hidxs?: number[],
    isValid?: boolean,
    element?: DiceCostType,
    cnt?: number,
    isDestroy?: boolean,
    restDmg?: number,
    isAddTask?: boolean,
    exec?: () => CardExecRes | void,
}

export type CardExecRes = {
    hidxs?: number[],
    switchHeroDiceCnt?: number,
}

const normalWeapon = (id: number, shareId: number, name: string, userType: WeaponType, src: string) => {
    return () => new GICard(id, shareId, name, 'v3.3.0', '【角色造成的伤害+1】。',
        src, 2, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, userType, () => ({ addDmg: 1 }));
}

const jiliWeapon = (id: number, shareId: number, name: string, userType: WeaponType, src: string) => {
    return () => new GICard(id, shareId, name, 'v3.3.0', '【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】生成1个此角色类型的元素骰(每回合1次)。',
        src, 3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, userType, (card, event) => {
            const { heros = [], hidxs: [hidx] = [] } = event;
            return {
                addDmg: 1,
                trigger: isCdt(card.perCnt > 0, ['skilltype2']),
                execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: (heros[hidx]?.element as PureElementType) ?? DICE_COST_TYPE.Omni }]),
                exec: () => { --card.perCnt }
            }
        }, { pct: 1 });
}

const tiankongWeapon = (id: number, shareId: number, name: string, version: Version, userType: WeaponType, src: string) => {
    return () => new GICard(id, shareId, name, version, '【角色造成的伤害+1】。；【每回合1次：】角色使用｢普通攻击｣造成的伤害额外+1。',
        src, 3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, userType, card => ({
            addDmg: 1,
            addDmgCdt: card.perCnt,
            trigger: isCdt(card.perCnt > 0, ['skilltype1']),
            exec: () => { --card.perCnt }
        }), { pct: 1 });
}

const senlin1Weapon = (id: number, shareId: number, name: string, version: Version, userType: WeaponType, stsId: number, src: string) => {
    return () => new GICard(id, shareId, name, version, '【角色造成的伤害+1】。；【入场时：】所附属角色在本回合中，下次对角色打出｢天赋｣或使用｢元素战技｣时少花费2个元素骰。',
        src, 3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, userType, () => ({ addDmg: 1, status: [newStatus(version)(stsId, name)] }));
}

// const senlin2Weapon = (id: number, name: string, version: Version, userType: number, stsId: number, src: string) => {
//     return () => new GICard(id, name, version, '【角色造成的伤害+1】。；【入场时：】所附属角色在本回合中，下次使用｢普通攻击｣后：生成2个此角色类型的元素骰。',
//         src, 3, DICE_TYPE.Any, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, userType, 1, () => ({ addDmg: 1, status: [newStatus(version)(stsId, name)] }));
// }

// const normalElArtifact = (id: number, name: string, element: PureElementType, src: string) => {
//     return () => new GICard(id, name, 'v3.3.0', `【对角色打出｢天赋｣或角色使用技能时：】少花费1个[${ELEMENT_NAME[element]}骰]。(每回合1次)`,
//         src, 2, DICE_TYPE.Any, CARD_TYPE.Equipment, CARD_SUBTYPE.Artifact, 0, 1, (card, event) => {
//             const { heros = [], hidxs: [hidx] = [], hcard, trigger = '', minusDiceCard: mdc = 0, isMinusDiceSkill = false } = event;
//             const isCardMinus = hcard && hcard.hasSubtype(CARD_SUBTYPE.Talent) && hcard.userType == heros[hidx]?.id && card.perCnt > 0 && hcard.cost + hcard.anydice > mdc;
//             return {
//                 minusDiceSkill: isCdt(card.perCnt > 0, { skill: [1, 0, 0], elDice: element }),
//                 minusDiceCard: isCdt(isCardMinus, 1),
//                 trigger: ['skill', 'card'],
//                 exec: () => {
//                     if (card.perCnt <= 0) return;
//                     if (trigger == 'card' && !isCardMinus) return;
//                     if (trigger == 'skill' && !isMinusDiceSkill) return;
//                     --card.perCnt;
//                 }
//             }
//         }, { pct: 1 });
// }

// const advancedElArtifact = (id: number, name: string, element: number, src: string) => {
//     return () => new GICard(id, name, `【对角色打出｢天赋｣或角色使用技能时：】少花费1个[${ELEMENT[element]}骰]。(每回合1次)；【投掷阶段：】2个元素骰初始总是投出[${ELEMENT[element]}骰]。`, src, 2, 8, 0, [1], 0, 1,
//         (card, event) => {
//             const { heros = [], hidxs: [hidx] = [], hcard, trigger = '', minusDiceCard: mdc = 0 } = event;
//             const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skill: [1, 0, 0] },
//                 skill => skill?.cost[0].color == element && card.perCnt > 0);
//             const isCardMinus = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidx]?.id && card.perCnt > 0 && hcard.cost + hcard.anydice > mdc;
//             return {
//                 ...minusSkillRes,
//                 minusDiceCard: isCdt(isCardMinus, 1),
//                 trigger: ['skill', 'card', 'phase-dice'],
//                 element,
//                 cnt: 2,
//                 exec: () => {
//                     if (trigger == 'card' && !isCardMinus || trigger == 'skill' && !isMinusSkill || card.perCnt <= 0) return;
//                     --card.perCnt;
//                 }
//             }
//         }, { pct: 1 });
// }

const elCard = (id: number, shareId: number, element: PureElementType, src: string): (ver: Version) => Card => {
    return ver => new GICard(id, shareId, '元素共鸣：交织之' + PURE_ELEMENT_NAME[element][0], ver, `生成1个[${PURE_ELEMENT_NAME[element]}骰]。`,
        src, 0, DICE_TYPE.Same, CARD_TYPE.Event, CARD_SUBTYPE.ElementResonance, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element }] }));
}

// const magicCount = (cnt: number, id?: number) => () => new GICard(id ?? (909 + 2 - cnt), `幻戏${cnt > 0 ? `倒计时：${cnt}` : '开始！'}`, `将我方所有元素骰转换为[万能元素骰]，摸4张牌。${cnt > 0 ? '；此牌在手牌或牌库中被[舍弃]后：将1张元素骰费用比此卡少1个的｢幻戏倒计时｣放置到你的牌库顶。' : ''}`,
//     id ? 'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/9c032dc20cdd269e79296d893806b112_6984839959914845407.png' :
//         `https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_CardFace_Event_Event_MagicCount${cnt}.webp`,
//     //  `/image/crd${909 + 2 - cnt}.png`,
//     cnt, 8, 2, [], 0, 0, (card, event) => {
//         const { trigger = '' } = event;
//         const cnt = +card.name.slice(-1) || 0;
//         const cmds: Cmds[] = trigger == 'discard' ?
//             [{ cmd: 'addCard', cnt: 1, card: 909 + 3 - cnt, hidxs: [1] }] :
//             [{ cmd: 'changeDice', element: 0 }, { cmd: 'getCard', cnt: 4 }];
//         return { trigger: isCdt(cnt > 0, ['discard']), cmds }
//     });

// 311xxx：武器
// 312xxx：圣遗物
// 321xxx：场地
// 322xxx：伙伴
// 323xxx：道具
// 330xxx：秘传
// 331xxx：共鸣
// 332xxx：事件
// 333xxx：料理
// 2xxxx1：天赋

const allCards: Record<number, (ver: Version) => Card> = {
    // 0: ()=> new GICard(0, '无', ''),

    311101: normalWeapon(311101, 121, '魔导绪论', WEAPON_TYPE.Catalyst, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/1abc432f853c6fa24624a92646c62237_7336928583967273301.png'),

    311102: jiliWeapon(311102, 122, '祭礼残章', WEAPON_TYPE.Catalyst, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/35a99ec73d99ed979a915e9a10a33a1e_5761287146349681281.png'),

    311103: tiankongWeapon(311103, 123, '天空之卷', 'v3.3.0', WEAPON_TYPE.Catalyst, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/347336161ab1d81f0b5bf1508a392f64_4021839086739887808.png'),

    311104: () => new GICard(311104, 124, '千夜浮梦', 'v3.7.0',
        '【角色造成的伤害+1】。；【我方角色引发元素反应时：】造成的伤害+1。(每回合最多触发2次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a56d5cf80b505c42a3643534d3dc2821_8758750260465224130.png',
        3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Catalyst, card => ({
            addDmg: 1,
            addDmgCdt: isCdt(card.perCnt > 0, 1),
            trigger: isCdt<Trigger[]>(card.perCnt > 0, ['elReaction']),
            exec: () => { --card.perCnt }
        }), { pct: 2 }),

    311105: () => new GICard(311105, 125, '盈满之实', 'v3.8.0',
        '【角色造成的伤害+1】。；【入场时：】摸2张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/f396d3f86aecfc992feb76ed44485171_1252924063800768441.png',
        3, DICE_TYPE.Any, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Catalyst, () => ({
            addDmg: 1,
            cmds: [{ cmd: 'getCard', cnt: 2 }],
        })),

    311106: () => new GICard(311106, 299, '四风原典', 'v4.3.0',
        '【此牌每有1点｢伤害加成｣，角色造成的伤害+1】。；【结束阶段：】此牌累积1点｢伤害加成｣。(最多累积到2点)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/c2774faa0cd618dddb0b7a641eede205_6906642161037931045.png',
        3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Catalyst, card => ({
            addDmg: card.useCnt,
            trigger: isCdt(card.useCnt < 2, ['phase-end']),
            exec: () => { ++card.useCnt }
        }), { uct: 0 }),

    311107: () => new GICard(311107, 300, '图莱杜拉的回忆', 'v4.3.0',
        '【角色造成的伤害+1】。；【角色进行[重击]时：】少花费1个[无色元素骰]。(每回合最多触发2次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/20/258999284/8f3cd8f38e2c411713f9b5e6dc826653_5506358063099958204.png',
        3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Catalyst, (card, event) => {
            const { isChargedAtk = false, isMinusDiceSkill = false } = event;
            return {
                addDmg: 1,
                trigger: isCdt(card.perCnt > 0 && isMinusDiceSkill, ['skilltype1']),
                minusDiceSkill: isCdt(card.perCnt > 0 && isChargedAtk, { skilltype1: [0, 1, 0] }),
                exec: () => { --card.perCnt }
            }
        }, { pct: 2 }),

    311108: ver => new GICard(311108, 342, '万世流涌大典', 'v4.5.0',
        '【角色造成的伤害+1】。；【角色受到伤害或治疗后：】如果本回合已受到伤害或治疗累积2次，则角色本回合中下次造成的伤害+2。(每回合1次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/9a6794d76b3ea150a101e354f9f5a162_9095966637954555968.png',
        3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Catalyst, (card, event) => {
            const { heal = [], hidxs: [hidx] = [], trigger = '' } = event;
            const isMinus = (trigger == 'getdmg' || trigger == 'heal' && heal[hidx] > 0) && card.perCnt > 0;
            return {
                addDmg: 1,
                trigger: isCdt(isMinus, ['getdmg', 'heal']),
                execmds: isCdt<Cmds[]>(isMinus && card.useCnt == 1, [{ cmd: 'getStatus', status: [newStatus(ver)(301108)] }]),
                exec: () => {
                    if (card.useCnt < 2) ++card.useCnt;
                    if (card.useCnt >= 2) --card.perCnt;
                }
            }
        }, { pct: 1, uct: 0, isResetUct: true }),

    311109: ver => new GICard(311109, 379, '金流监督', 'v4.7.0',
        '【角色受到伤害或治疗后：】使角色本回合中下一次｢普通攻击｣少花费1个[无色元素骰]，且造成的伤害+1。(每回合至多2次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/83ab325be102a71a7df848546e7eacbb_2193569914822395358.png',
        2, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Catalyst, (card, event) => {
            const { heal = [], hidxs: [hidx] = [], trigger = '' } = event;
            const isMinus = (trigger == 'getdmg' || trigger == 'heal' && heal[hidx] > 0) && card.perCnt > 0;
            if (!isMinus) return;
            return {
                trigger: ['getdmg', 'heal'],
                execmds: [{ cmd: 'getStatus', status: [newStatus(ver)(301111)] }],
                exec: () => { --card.perCnt }
            }
        }, { pct: 2 }),

    311201: normalWeapon(311201, 126, '鸦羽弓', WEAPON_TYPE.Bow, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/e20881692f9c3dcb128e3768347af4c0_5029781426547880539.png'),

    311202: jiliWeapon(311202, 127, '祭礼弓', WEAPON_TYPE.Bow, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/4adb0666f4e171943739e4baa0863b48_5457536750893996771.png'),

    311203: tiankongWeapon(311203, 128, '天空之翼', 'v3.3.0', WEAPON_TYPE.Bow, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/b50f747817c941c6ea72a56b4501a99c_2147958904876284896.png'),

    311204: () => new GICard(311204, 129, '阿莫斯之弓', 'v3.7.0',
        '【角色造成的伤害+1】。；【角色使用原本元素骰费用+充能费用至少为5的技能时，】伤害额外+2。(每回合1次)',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d974aa6b36205d2c4ee83900f6383f40_5244142374562514025.png',
        3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Bow, (card, event) => {
            const { heros = [], hidxs: [hidx] = [], isSkill = -1 } = event;
            let isAddDmg = card.perCnt > 0 && isSkill > -1;
            if (isAddDmg) {
                const cskill = heros[hidx].skills[isSkill];
                isAddDmg &&= cskill.cost.reduce((a, c) => a + c.cnt, 0) >= 5;
            }
            return {
                addDmg: 1,
                addDmgCdt: isCdt(isAddDmg, 2),
                trigger: isCdt(isAddDmg, ['skill']),
                exec: () => { --card.perCnt }
            }
        }, { pct: 1 }),

    311205: ver => new GICard(311205, 130, '终末嗟叹之诗', 'v3.7.0',
        '【角色造成的伤害+1】。；【角色使用｢元素爆发｣后：】生成【sts301102】。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fc5f899e61c9236a1319ea0f3c8b7a64_3821389462721294816.png',
        3, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Bow, () => ({
            addDmg: 1,
            trigger: ['skilltype3'],
            execmds: [{ cmd: 'getStatus', status: [newStatus(ver)(301102)] }],
        })),

    311206: senlin1Weapon(311206, 131, '王下近侍', 'v4.0.0', WEAPON_TYPE.Bow, 301103, 'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/c667e01fa50b448958eff1d077a7ce1b_1806864451648421284.png'),

    311207: () => new GICard(311207, 380, '竭泽', 'v4.7.0',
        '【我方打出名称不存在于初始牌组中的行动牌后：】此牌累积1点｢渔猎｣。(最多累积2点，每回合最多累积2点)；【角色使用技能时：】如果此牌已有｢渔猎｣，则消耗所有｢渔猎｣，使此技能伤害+1，并且每消耗1点｢渔猎｣就摸1张牌。',
        'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/ea03edad3c81f49bddc24a5689f278d2_6229118249248157024.png',
        2, DICE_TYPE.Same, CARD_TYPE.Equipment, CARD_SUBTYPE.Weapon, WEAPON_TYPE.Bow, (card, event) => {
            const { playerInfo: { initCardIds = [] } = {}, hcard, trigger = '' } = event;
            const triggers: Trigger[] = [];
            if (card.useCnt > 0) triggers.push('skill');
            if (hcard && !initCardIds.includes(hcard.id) && card.useCnt < 2 && card.perCnt > 0) triggers.push('card');
            return {
                trigger: triggers,
                addDmg: isCdt(card.useCnt > 0, 1),
                execmds: isCdt<Cmds[]>(trigger == 'skill' && card.useCnt > 0, [{ cmd: 'getCard', cnt: card.useCnt }]),
                exec: () => {
                    if (trigger == 'card') {
                        ++card.useCnt;
                        --card.perCnt;
                    } else if (trigger == 'skill') {
                        card.useCnt = 0;
                    }
                }
            }
        }, { uct: 0, pct: 2 }),

    // 41: normalWeapon(41, '白铁大剑', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/d8916ae5aaa5296a25c1f54713e2fd85_802175621117502141.png'),

    // 42: jiliWeapon(42, '祭礼大剑', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/35a410a0aad34824fdcf8ae986893d30_2999739715093754473.png'),

    // 43: () => new GICard(43, '狼的末路', '【角色造成的伤害+1】。；攻击剩余生命值不多于6的目标时，伤害额外+2。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/3ec60d32f7ce9f816a6dd784b8800e93_4564486285810218753.png',
    //     3, 8, 0, [0], 2, 1, (_card, event) => {
    //         const { eheros = [], ehidx = -1 } = event;
    //         return { trigger: ['skill'], addDmg: 1, addDmgCdt: isCdt((eheros[ehidx]?.hp ?? 10) <= 6, 2) }
    //     }),

    // 44: tiankongWeapon(44, '天空之傲', 2, 'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/7ce2f924ae1b0922ea14eef9fbd3f2bb_951683174491798888.png'),

    // 45: () => new GICard(45, '钟剑', '【角色造成的伤害+1】。；【角色使用技能后：】为我方出战角色提供1点[护盾]。(每回合1次，可叠加到2点)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e8bf7a38608cc3811f32f396ccea01d4_493091124030114777.png',
    //     3, 8, 0, [0], 2, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const shieldCnt = heros[hidx].outStatus.find(ost => ost.id == 2049)?.useCnt ?? 0;
    //         const isTriggered = card.perCnt > 0 && shieldCnt < 2;
    //         return {
    //             addDmg: 1,
    //             trigger: ['skill'],
    //             execmds: isCdt<Cmds[]>(isTriggered, [{ cmd: 'getStatus', status: [newStatus(2049)] }]),
    //             exec: () => {
    //                 if (isTriggered) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 46: () => new GICard(46, '苇海信标', '【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】本回合内，角色下次造成的伤害额外+1。(每回合1次)；【角色受到伤害后：】本回合内，角色下次造成的伤害额外+1。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/4148c247b2685dfcb305cc9b6c5e8cff_6450004800527281410.png',
    //     3, 8, 0, [0], 2, 1, (card, event) => {
    //         const { trigger = '' } = event;
    //         const isTriggered1 = trigger == 'skilltype2' && (card.perCnt >> 0 & 1) == 1;
    //         const isTriggered2 = trigger == 'getdmg' && (card.perCnt >> 1 & 1) == 1;
    //         return {
    //             addDmg: 1,
    //             trigger: ['skilltype2', 'getdmg'],
    //             execmds: isCdt<Cmds[]>(isTriggered1 || isTriggered2, [{ cmd: 'getStatus', status: [newStatus(2149 + +isTriggered2)] }]),
    //             exec: () => {
    //                 if (isTriggered1) card.perCnt &= ~(1 << 0);
    //                 if (isTriggered2) card.perCnt &= ~(1 << 1);
    //             }
    //         }
    //     }, { pct: 3 }),

    // 47: senlin2Weapon(47, '森林王器', 2, 'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/9d317a3a81e47ab989c633ff609b5861_5509350951295616421.png'),

    // 48: () => new GICard(48, '｢究极霸王超级魔剑｣', '此牌会记录本局游戏中你打出过的名称不存在于初始牌组中的行动牌种类，称为｢声援｣。如果此牌的｢声援｣至少为2/4/8，则角色造成的伤害+1/2/3。',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Weapon_BaWangJian.webp',
    //     2, 8, 0, [0], 2, 1, (card, event) => {
    //         const { playerInfo: { usedCardIds = [], initCardIds = [] } = {}, hcard, slotUse = false } = event;
    //         if (slotUse) {
    //             card.useCnt = usedCardIds.filter(c => !initCardIds.includes(c)).length;
    //             return;
    //         }
    //         const cardid = hcard?.id ?? 0;
    //         return {
    //             trigger: isCdt(!initCardIds.includes(cardid) && !usedCardIds.includes(cardid), ['card']),
    //             addDmg: card.useCnt >= 8 ? 3 : card.useCnt >= 4 ? 2 : +(card.useCnt >= 2),
    //             exec: () => { ++card.useCnt }
    //         }
    //     }),

    // 61: normalWeapon(61, '白缨枪', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/2618b55f8449904277794039473df17c_5042678227170067991.png'),

    // 62: () => new GICard(62, '千岩长枪', '【角色造成的伤害+1】。；【入场时：】队伍中每有一名｢璃月｣角色，此牌就为附属的角色提供1点[护盾]。(最多3点)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/7b6b74c3444f624f117f8e05344d27ec_6292708375904670698.png',
    //     3, 8, 0, [0], 5, 1, (_card, event) => {
    //         const { heros } = event;
    //         const liyueCnt = Math.min(3, heros?.filter(h => h.local.includes(2))?.length ?? 0);
    //         return { addDmg: 1, status: [newStatus(2026, liyueCnt)] }
    //     }),

    // 63: tiankongWeapon(63, '天空之脊', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/788811f1c1ce03f56a89ecde4cbe52a7_2992557107190163621.png'),

    // 64: () => new GICard(64, '贯虹之槊', '【角色造成的伤害+1】。；角色如果在[护盾]角色状态或[护盾]出战状态的保护下，则造成的伤害额外+1。；【角色使用｢元素战技｣后：】如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充1点[护盾]。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/0a1242b4eeb9c6b6e731466fb182cb60_6226689090161933551.png',
    //     3, 8, 0, [0], 5, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], trigger = '' } = event;
    //         const fhero = heros[hidx];
    //         const isShieldStatus = fhero?.inStatus.some(ist => ist.type.includes(7)) || fhero?.outStatus.some(ost => ost.type.includes(7));
    //         return {
    //             addDmg: 1,
    //             addDmgCdt: isCdt(isShieldStatus && trigger == 'skill', 1),
    //             trigger: ['skill', 'skilltype2'],
    //             isAddTask: trigger == 'skilltype2',
    //             exec: () => {
    //                 if (card.perCnt == 0 || trigger != 'skilltype2') return;
    //                 const ost = fhero.outStatus.find(ost => ost.type.includes(7));
    //                 if (ost) {
    //                     ++ost.useCnt;
    //                     --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 65: () => new GICard(65, '薙草之稻光', '【角色造成的伤害+1】。；【每回合自动触发1次：】如果所附属角色没有[充能]，就使其获得1点[充能]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/1ed5905877be45aca0e92093e3b5fdbe_7752495456460826672.png',
    //     3, 8, 0, [0], 5, 1, (_card, event) => {
    //         const { heros = [], hidxs = [] } = event;
    //         const execmds = isCdt<Cmds[]>(heros[hidxs[0]]?.energy > 0, [{ cmd: 'getEnergy', cnt: 1, hidxs }]);
    //         return { addDmg: 1, trigger: ['phase-start'], execmds }
    //     }),

    // 66: senlin1Weapon(66, '贯月矢', 5, 'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/9d44a608d1ba86c970a0fe897f22121c_7239489409641716764.png'),

    // 67: () => new GICard(67, '和璞鸢', '【角色造成的伤害+1】。；【角色使用技能后：】直到回合结束前，此牌所提供的伤害加成值额外+1。(最多累积到+2)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/15/258999284/972e1ba2e544111bc0069697539b707e_7547101337974467153.png',
    //     3, 8, 0, [0], 5, 1, card => ({
    //         addDmg: 1 + card.useCnt,
    //         trigger: ['skill'],
    //         exec: () => {
    //             if (card.useCnt < 2) ++card.useCnt;
    //         }
    //     }), { uct: 0, isResetUct: true }),

    // 68: () => new GICard(68, '公义的酬报', '角色使用｢元素爆发｣造成的伤害+2。；【我方出战角色受到伤害或治疗后：】累积1点｢公义之理｣。如果此牌已累积3点｢公义之理｣，则消耗3点｢公义之理｣，使角色获得1点[充能]。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/000bcdedf14ef6af2cfa36a003841098_4382151758785122038.png',
    //     2, 8, 0, [0], 5, 1, (card, event) => {
    //         const { heros = [], hidxs = [], getdmg = [], heal = [] } = event;
    //         const fhidx = heros.findIndex(h => h.isFront);
    //         const trigger: Trigger[] = [];
    //         if (getdmg[fhidx] > 0) trigger.push('getdmg', 'other-getdmg');
    //         if (heal[fhidx] > 0) trigger.push('heal');
    //         return {
    //             addDmgType3: 2,
    //             trigger,
    //             execmds: isCdt<Cmds[]>(card.useCnt >= 2, [{ cmd: 'getEnergy', cnt: 1, hidxs }]),
    //             isAddTask: true,
    //             exec: () => {
    //                 if (++card.useCnt >= 3) card.useCnt -= 3;
    //             }
    //         }
    //     }, { uct: 0 }),

    // 69: () => new GICard(69, '勘探钻机', '【所附属角色受到伤害时：】如可能，[舍弃]原本元素骰费用最高的1张手牌，以抵消1点伤害，然后累积1点｢团结｣。(每回合最多触发2次)；【角色使用技能时：】如果此牌已有｢团结｣，则消耗所有｢团结｣，使此技能伤害+1，并且每消耗1点｢团结｣就摸1张牌。',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Weapon_KanTanQiang.webp',
    //     2, 8, 0, [-1, 0], 5, 1, (card, event) => {
    //         const { restDmg = -1, hcards: { length: hcardsCnt } = [] } = event;
    //         if (restDmg > -1) {
    //             if (hcardsCnt == 0 || card.perCnt <= 0) return { restDmg }
    //             ++card.useCnt;
    //             --card.perCnt;
    //             return { restDmg: restDmg - 1, execmds: [{ cmd: 'discard', element: 0 }] }
    //         }
    //         if (card.useCnt <= 0) return;
    //         return {
    //             trigger: ['skill'],
    //             addDmgCdt: 1,
    //             execmds: [{ cmd: 'getCard', cnt: card.useCnt }],
    //             exec: () => { card.useCnt = 0 }
    //         }
    //     }, { uct: 0, pct: 2 }),

    // 81: normalWeapon(81, '旅行剑', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/2540a7ead6f2e957a6f25c9899ce428b_3859616323968734996.png'),

    // 82: jiliWeapon(82, '祭礼剑', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/5dda866add6d4244a69c0ffdd2b53e51_1375735839691106206.png'),

    // 83: () => new GICard(83, '风鹰剑', '【角色造成的伤害+1】。；【对方使用技能后：】如果所附属角色为｢出战角色｣，则治疗该角色1点。(每回合至多2次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/fcad55ff202d5dc8fa1d782f0b2f3400_3902557354688808483.png',
    //     3, 8, 0, [0], 1, 1, (card, event) => {
    //         const { hidxs } = event;
    //         return {
    //             addDmg: 1,
    //             trigger: ['oppo-skill'],
    //             execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'heal', cnt: 1, hidxs }]),
    //             exec: () => {
    //                 if (card.perCnt > 0) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 2 }),

    // 84: tiankongWeapon(84, '天空之刃', 1, 'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/b3a9cd06298bf6dcd9191a88bb754f14_6317636823354305889.png'),

    // 85: () => new GICard(85, '西风剑', '【角色造成的伤害+1】。；【角色使用｢元素战技｣后：】角色额外获得1点[充能]。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/e1938c4cf6e50cfcb65d67ef10bc16a3_1486330508550781744.png',
    //     3, 8, 0, [0], 1, 1, card => ({
    //         addDmg: 1,
    //         trigger: ['skilltype2'],
    //         execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getEnergy', cnt: 1 }]),
    //         exec: () => {
    //             if (card.perCnt > 0) --card.perCnt;
    //         }
    //     }), { pct: 1 }),

    // 86: () => new GICard(86, '裁叶萃光', '【角色造成的伤害+1】。；【角色使用｢普通攻击｣后：】生成1个随机的基础元素骰。(每回合最多触发2次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/4d3935c7b67e051b02f9a525357b2fb0_8903486552471935304.png',
    //     3, 8, 0, [0], 1, 1, card => ({
    //         addDmg: 1,
    //         trigger: ['skilltype1'],
    //         execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: -1 }]),
    //         exec: () => {
    //             if (card.perCnt > 0) --card.perCnt;
    //         }
    //     }), { pct: 2 }),

    // 87: senlin2Weapon(87, '原木刀', 1, 'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/1f97927392b79a716430461251ff53e2_4196794667556484935.png'),

    // 88: () => new GICard(88, '静水流涌之辉', '【我方角色受到伤害或治疗后：】此牌累积1点｢湖光｣。；【角色进行｢普通攻击｣时：】如果已有12点｢湖光｣，则消耗12点，使此技能少花费2个[无色元素骰]且造成的伤害+1，并且治疗所附属角色1点。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/92753a699957dc63318f06ab506d7e41_8008667568462089258.png',
    //     2, 8, 0, [0], 1, 1, (card, event) => {
    //         const { trigger = '' } = event;
    //         const triggers: Trigger[] = ['getdmg', 'heal'];
    //         const isTriggered = card.useCnt >= 12 && card.perCnt > 0;
    //         if (isTriggered) triggers.push('skilltype1');
    //         const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 2, 0] }, () => isTriggered);
    //         return {
    //             trigger: triggers,
    //             addDmgCdt: isCdt(trigger == 'skilltype1', 1),
    //             execmds: isCdt<Cmds[]>(isTriggered && trigger == 'skilltype1', [{ cmd: 'heal', cnt: 1 }]),
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (['getdmg', 'heal'].includes(trigger)) ++card.useCnt;
    //                 else if (trigger == 'skilltype1') {
    //                     card.useCnt -= 12;
    //                     --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { uct: 0, pct: 1 }),

    // 101: () => new GICard(101, '冒险家头带', '【角色使用｢普通攻击｣后：】治疗自身1点(每回合至多3次)。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/c2617ba94c31d82bd4af6df8e74aac91_8306847584147063772.png',
    //     1, 8, 0, [1], 0, 1, (card, event) => {
    //         const { hidxs = [], heros = [] } = event;
    //         const curHero = heros[hidxs[0]];
    //         const notUse = card.perCnt <= 0 || curHero?.maxhp == curHero?.hp;
    //         return {
    //             trigger: ['skilltype1'],
    //             execmds: isCdt<Cmds[]>(!notUse, [{ cmd: 'heal', cnt: 1, hidxs }]),
    //             exec: () => {
    //                 if (!notUse) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 3 }),

    // 102: () => new GICard(102, '幸运儿银冠', '【角色使用｢元素战技｣后：】治疗自身2点(每回合1次)。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75720734/27d7021e8d3dc0ee1b6f271558179c77_4899141043311513249.png',
    //     2, 0, 0, [1], 0, 1, (card, event) => {
    //         const { hidxs = [], heros = [] } = event;
    //         const curHero = heros[hidxs[0]];
    //         const notUse = card.perCnt <= 0 || curHero?.maxhp == curHero?.hp;
    //         return {
    //             trigger: ['skilltype2'],
    //             execmds: isCdt<Cmds[]>(!notUse, [{ cmd: 'heal', cnt: 2, hidxs }]),
    //             exec: () => {
    //                 if (!notUse) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 103: () => new GICard(103, '游医的方巾', '【角色使用｢元素爆发｣后：】治疗所有我方角色1点(每回合1次)。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/27f34fa09a68f4de71cd8ce12b2ff2ea_7632599925994945499.png',
    //     1, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [] } = event;
    //         const notUse = card.perCnt <= 0 || heros?.every(h => h.maxhp == h.hp);
    //         return {
    //             trigger: ['skilltype3'],
    //             execmds: isCdt<Cmds[]>(!notUse, [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(heros) }]),
    //             exec: () => {
    //                 if (!notUse) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 104: () => new GICard(104, '赌徒的耳环', '【敌方角色被击倒后：】如果所附属角色为｢出战角色｣，则生成2个[万能元素骰]。(整场牌局限制3次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/c36e23e6486cfc14ba1afac19d73620e_6020851449922266352.png',
    //     1, 8, 0, [1], 0, 1, card => ({
    //         trigger: ['kill'],
    //         execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 2, element: 0 }]),
    //         exec: () => {
    //             if (card.perCnt > 0) --card.perCnt;
    //         }
    //     }), { pct: 3, isResetPct: false }),

    // 105: () => new GICard(105, '教官的帽子', '【角色引发元素反应后：】生成1个此角色元素类型的元素骰。(每回合至多3次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/66b3c1346a589e0dea45a58cd4d65c5a_3513743616827517581.png',
    //     2, 0, 0, [1], 0, 1, card => ({
    //         trigger: ['elReaction'],
    //         execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: -2 }]),
    //         exec: () => {
    //             if (card.perCnt > 0) --card.perCnt;
    //         }
    //     }), { pct: 3, isResetPct: false }),

    // 106: () => new GICard(106, '流放者头冠', '【角色使用｢元素爆发｣后：】所有后台我方角色获得1点[充能]。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/dd30c7290b9379c5a1a91e0bb5d881c3_4746512653382401326.png',
    //     2, 0, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [] } = event;
    //         const hidxs = heros.map((h, hi) => ({ hi, f: h.isFront, hp: h.hp })).filter(v => !v.f && v.hp > 0).map(v => v.hi);
    //         return {
    //             trigger: ['skilltype3'],
    //             execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getEnergy', cnt: 1, hidxs }]),
    //             exec: () => {
    //                 if (card.perCnt > 0) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 107: () => new GICard(107, '华饰之兜', '【其他我方角色使用｢元素爆发｣后：】所附属角色获得1点[充能]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/82dc7fbd9334da0ca277b234c902a394_6676194364878839414.png',
    //     1, 8, 0, [1], 0, 1, (_card, { hidxs }) => ({
    //         trigger: ['other-skilltype3'],
    //         execmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }],
    //     })),

    // 108: () => new GICard(108, '绝缘之旗印', '【其他我方角色使用｢元素爆发｣后：】所附属角色获得1点[充能]。；角色使用｢元素爆发｣造成的伤害+2。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/361399b0aa575a2805da6765d3c0e17c_4972333427190668688.png',
    //     2, 8, 0, [1], 0, 1, (card, event) => {
    //         const { hidxs, trigger = '' } = event;
    //         return {
    //             addDmgType3: isCdt(card.perCnt > 0, 2),
    //             trigger: ['other-skilltype3', 'skilltype3'],
    //             execmds: isCdt<Cmds[]>(trigger == 'other-skilltype3', [{ cmd: 'getEnergy', cnt: 1, hidxs }]),
    //             exec: () => {
    //                 if (trigger == 'other-skilltype3') return;
    //                 if (card.perCnt > 0) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 109: () => new GICard(109, '将帅兜鍪', '【行动阶段开始时：】为角色附属｢【sts2050】｣。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/86ed124f5715f96604248a48a57de351_6600927335776465307.png',
    //     2, 8, 0, [1], 0, 1, () => ({
    //         trigger: ['phase-start'],
    //         execmds: [{ cmd: 'getStatus', status: [newStatus(2050)] }],
    //     })),

    // 110: () => new GICard(110, '千岩牢固', '【行动阶段开始时：】为角色附属｢【sts2050】｣。；【角色受到伤害后：】如果所附属角色为｢出战角色｣，则生成1个此角色元素类型的元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/6b1e8983b34f821da73f7a93076a501e_3915605735095366427.png',
    //     3, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], trigger = '', isExecTask = false } = event;
    //         const isGetDmg = trigger == 'getdmg' && card.perCnt > 0 && heros[hidx].isFront;
    //         return {
    //             trigger: ['phase-start', 'getdmg'],
    //             isAddTask: !isExecTask,
    //             execmds: isCdt<Cmds[]>(trigger == 'phase-start', [{ cmd: 'getStatus', status: [newStatus(2050)] }],
    //                 isCdt<Cmds[]>(isGetDmg, [{ cmd: 'getDice', cnt: 1, element: heros[hidx]?.element ?? 0 }])),
    //             exec: () => {
    //                 if (isGetDmg) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 111: () => new GICard(111, '虺雷之姿', '【对角色打出｢天赋｣或角色使用｢普通攻击｣时：】少花费1个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d136fc0fd368a268fe3adaba8c0e64bb_8574805937216108762.png',
    //     2, 0, 0, [1], 0, 1, (card, event) => {
    //         const { hcard, heros = [], hidxs: [hidx] = [], trigger = '', minusDiceCard: mdc = 0 } = event;
    //         const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidx]?.id && card.perCnt > 0 && hcard.cost + hcard.anydice > mdc;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => card.perCnt > 0);
    //         return {
    //             ...minusSkillRes,
    //             minusDiceCard: isCdt(isMinusCard, 1),
    //             trigger: ['skilltype1', 'card'],
    //             exec: () => {
    //                 if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype1' && isMinusSkill)) {
    //                     --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 112: () => new GICard(112, '辰砂往生录', '【对角色打出｢天赋｣或角色使用｢普通攻击｣时：】少花费1个元素骰。(每回合1次)；【角色被切换为｢出战角色｣后：】本回合中，角色｢普通攻击｣造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/ad8e8b77b4efc4aabd42b7954fbc244c_7518202688884952912.png',
    //     3, 0, 0, [1], 0, 1, (card, event) => {
    //         const { hcard, heros = [], hidxs: [hidx] = [], trigger = '', minusDiceCard: mdc = 0 } = event;
    //         const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidx]?.id && hcard.cost + hcard.anydice > mdc && card.perCnt > 0;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] }, () => card.perCnt > 0);
    //         return {
    //             ...minusSkillRes,
    //             minusDiceCard: isCdt(isMinusCard, 1),
    //             trigger: ['skilltype1', 'card', 'change-to'],
    //             execmds: isCdt<Cmds[]>(trigger == 'change-to', [{ cmd: 'getStatus', status: [newStatus(2072)] }]),
    //             exec: () => {
    //                 if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype1' && isMinusSkill)) {
    //                     --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 113: () => new GICard(113, '无常之面', '【对角色打出｢天赋｣或角色使用｢元素战技｣时：】少花费1个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/e2a6d4ad4958d5fff80bb17ec93189ab_7011820758446145491.png',
    //     2, 0, 0, [1], 0, 1, (card, event) => {
    //         const { hcard, heros = [], hidxs: [hidx] = [], trigger = '', minusDiceCard: mdc = 0 } = event;
    //         const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidx]?.id && card.perCnt > 0 && hcard.cost + hcard.anydice > mdc;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] }, () => card.perCnt > 0);
    //         return {
    //             ...minusSkillRes,
    //             minusDiceCard: isCdt(isMinusCard, 1),
    //             trigger: ['skilltype2', 'card'],
    //             exec: () => {
    //                 if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype2' && isMinusSkill)) {
    //                     --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 114: () => new GICard(114, '追忆之注连', '【对角色打出｢天赋｣或角色使用｢元素战技｣时：】少花费1个元素骰。(每回合1次)；【如果角色具有至少2点[充能]，】就使角色｢普通攻击｣和｢元素战技｣造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/24/183046623/48be75f0a23375adb34789dcb1e95a97_850843251536084281.png',
    //     3, 0, 0, [1], 0, 1, (card, event) => {
    //         const { hcard, heros = [], hidxs: [hidx] = [], trigger = '', minusDiceCard: mdc = 0 } = event;
    //         const isMinusCard = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidx]?.id && card.perCnt > 0 && hcard.cost + hcard.anydice > mdc;
    //         const isAddDmg = (heros[hidx]?.energy ?? 0) >= 2;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] }, () => card.perCnt > 0);
    //         return {
    //             addDmgType1: isCdt(isAddDmg, 1),
    //             addDmgType2: isCdt(isAddDmg, 1),
    //             ...minusSkillRes,
    //             minusDiceCard: isCdt(isMinusCard, 1),
    //             trigger: ['skilltype2', 'card'],
    //             exec: () => {
    //                 if (card.perCnt > 0 && (trigger == 'card' && isMinusCard || trigger == 'skilltype2' && isMinusSkill)) {
    //                     --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 115: () => new GICard(115, '海祇之冠', '我方角色每受到3点治疗，此牌就累计1个｢海染泡沫｣。(最多累积2个)；【角色造成伤害时：】消耗所有｢海染泡沫｣，每消耗1个都能使造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/dfea4a0c2219c145125277f8eddb8269_3306254185680856587.png',
    //     1, 8, 0, [1], 0, 1, (card, event) => {
    //         const { trigger = '', heal = [] } = event;
    //         const allHeal = heal.reduce((a, b) => a + b, 0);
    //         return {
    //             trigger: ['dmg', 'heal'],
    //             addDmgCdt: Math.floor(card.useCnt),
    //             isAddTask: trigger == 'heal',
    //             exec: () => {
    //                 if (trigger == 'heal') {
    //                     if (allHeal > 0) card.useCnt = Math.min(2, card.useCnt + allHeal * 0.34);
    //                     return;
    //                 }
    //                 if (trigger == 'dmg') card.useCnt %= 1;
    //             }
    //         }
    //     }, { uct: 0 }),

    // 116: () => new GICard(116, '海染砗磲', '【入场时：】治疗所附属角色2点。；我方角色每受到3点治疗，此牌就累计1个｢海染泡沫｣。(最多累积2个)；【角色造成伤害时：】消耗所有｢海染泡沫｣，每消耗1个都能使造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/16b4765f951281f2547ba40eeb994271_8658397109914249143.png',
    //     3, 0, 0, [1], 0, 1, (card, event) => {
    //         const { trigger = '', heal = [] } = event;
    //         const allHeal = heal.reduce((a, b) => a + b, 0);
    //         return {
    //             trigger: ['dmg', 'heal'],
    //             addDmgCdt: Math.floor(card.useCnt),
    //             cmds: [{ cmd: 'heal', cnt: 2 }],
    //             isAddTask: trigger == 'heal',
    //             exec: () => {
    //                 if (trigger == 'heal') {
    //                     if (allHeal > 0) card.useCnt = Math.min(2, card.useCnt + allHeal * 0.34);
    //                     return;
    //                 }
    //                 if (trigger == 'dmg') card.useCnt %= 1;
    //             }
    //         }
    //     }, { uct: 0.681 }),

    // 117: () => new GICard(117, '沙王的投影', '【入场时：】摸1张牌。；【所附属角色为出战角色期间，敌方受到元素反应伤害时：】摸1张牌。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/fe25340f51936207ac2a9e71a8cad87e_3874053549243035788.png',
    //     1, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const isUse = card.perCnt > 0 && heros[hidx].isFront;
    //         return {
    //             trigger: ['elReaction'],
    //             cmds: [{ cmd: 'getCard', cnt: 1 }],
    //             execmds: isCdt<Cmds[]>(isUse, [{ cmd: 'getCard', cnt: 1 }]),
    //             exec: () => {
    //                 if (isUse) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 118: () => new GICard(118, '饰金之梦', '【入场时：】生成1个所附属角色类型的元素骰。如果我方队伍中存在3种不同元素类型的角色，则改为生成2个。；【所附属角色为出战角色期间，敌方受到元素反应伤害时：】摸1张牌。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/b0f1283d8fec75259495c4ef24cc768a_277942760294951822.png',
    //     3, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const isExtra = new Set(heros.map(h => h.element)).size == 3;
    //         const isUse = card.perCnt > 0 && heros[hidx]?.isFront;
    //         return {
    //             trigger: ['elReaction'],
    //             cmds: [{ cmd: 'getDice', cnt: isExtra ? 2 : 1, element: heros[hidx]?.element }],
    //             execmds: isCdt<Cmds[]>(isUse, [{ cmd: 'getCard', cnt: 1 }]),
    //             exec: () => {
    //                 if (isUse) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 119: () => new GICard(119, '浮溯之珏', '【角色使用｢普通攻击｣后：】摸1张牌。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/8ac2175960ea0dace83f9bd76efb70ef_3923530911851671969.png',
    //     0, 8, 0, [1], 0, 1, card => ({
    //         trigger: ['skilltype1'],
    //         execmds: isCdt<Cmds[]>(card.perCnt > 0, [{ cmd: 'getCard', cnt: 1 }]),
    //         exec: () => {
    //             if (card.perCnt > 0) --card.perCnt;
    //         }
    //     }), { pct: 1 }),

    // 120: () => new GICard(120, '来歆余响', '【角色使用｢普通攻击｣后：】摸1张牌。(每回合1次)；【角色使用技能后：】如果我方元素骰数量不多于手牌数量，则生成1个所附属角色类型的元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/d9db70a7475940b91d63699e1276678d_8473736559088406285.png',
    //     2, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], hcards: { length: hcardsCnt } = [], dicesCnt = 0, trigger = '' } = event;
    //         const isGetCard = trigger == 'skilltype1' && (card.perCnt >> 0 & 1) == 1;
    //         const isGetDice = trigger.startsWith('skill') && dicesCnt <= hcardsCnt && (card.perCnt >> 1 & 1) == 1;
    //         const execmds: Cmds[] = [];
    //         if (isGetCard) execmds.push({ cmd: 'getCard', cnt: 1 });
    //         if (isGetDice) execmds.push({ cmd: 'getDice', cnt: 1, element: heros[hidx].element });
    //         return {
    //             trigger: ['skill'],
    //             execmds,
    //             exec: () => {
    //                 if (isGetCard) card.perCnt &= ~(1 << 0);
    //                 if (isGetDice) card.perCnt &= ~(1 << 1);
    //             }
    //         }
    //     }, { pct: 3 }),

    // 121: () => new GICard(121, 307, '灵光明烁之心', '【角色受到伤害后：】如果所附属角色为｢出战角色｣，则摸1张牌。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/3a2b86994907366639498965934b1d99_16804113149239958.png',
    //     0, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const isGetCard = card.perCnt > 0 && heros[hidx].isFront;
    //         return {
    //             trigger: ['getdmg'],
    //             isAddTask: card.perCnt > 0,
    //             cmds: isCdt<Cmds[]>(isGetCard, [{ cmd: 'getCard', cnt: 1 }]),
    //             exec: () => {
    //                 if (isGetCard) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 122: () => new GICard(122, '花海甘露之光', '【角色受到伤害后：】如果所附属角色为｢出战角色｣，则摸1张牌，并且在本回合结束阶段中治疗所附属角色1点。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/18/258999284/aaaf307c3c9725d0c8f0be7d264e04bd_9827908420304255.png',
    //     1, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs = [], trigger = '' } = event;
    //         const isHeal = trigger == 'phase-end' && card.perCnt <= 0;
    //         const isGetCard = trigger == 'getdmg' && card.perCnt > 0 && heros[hidxs[0]].isFront;
    //         return {
    //             trigger: ['getdmg', 'phase-end'],
    //             isAddTask: card.perCnt > 0,
    //             execmds: isCdt<Cmds[]>(isHeal, [{ cmd: 'heal', cnt: 1, hidxs }], isCdt(isGetCard, [{ cmd: 'getCard', cnt: 1 }])),
    //             exec: () => {
    //                 if (isGetCard) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 123: () => new GICard(123, '老兵的容颜', '【角色受到伤害或治疗后：】根据本回合触发此效果的次数，执行不同的效果。；【第一次触发：】生成1个此角色类型的元素骰。；【第二次触发：】摸1张牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/166e56c3c68e531c97f4fdfde1adde06_4511818010196081435.png',
    //     2, 0, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], heal = [], trigger = '' } = event;
    //         if (card.perCnt > 0 && (trigger == 'getdmg' || trigger == 'heal' && heal[hidx] > 0)) {
    //             const execmds: Cmds[] = [{ cmd: 'getDice', element: heros[hidx].element, cnt: 1 }, { cmd: 'getCard', cnt: 1 }];
    //             return {
    //                 trigger: ['getdmg', 'heal'],
    //                 execmds: [execmds[card.useCnt]],
    //                 exec: () => {
    //                     if (++card.useCnt == 2) --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { uct: 0, pct: 1, isResetUct: true }),

    // 124: () => new GICard(124, '逐影猎人', '【角色受到伤害或治疗后：】根据本回合触发此效果的次数，执行不同的效果。；【第一次触发：】生成1个此角色类型的元素骰。；【第二次触发：】摸1张牌。；【第四次触发：】生成1个此角色类型的元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/8d877f34a6ce748ac2f474d83fa05785_4045703223333362794.png',
    //     3, 0, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], heal = [], trigger = '' } = event;
    //         if (card.perCnt > 0 && (trigger == 'getdmg' || trigger == 'heal' && heal[hidx] > 0)) {
    //             const execmds: Cmds[] = [{ cmd: 'getDice', element: heros[hidx].element, cnt: 1 }, { cmd: 'getCard', cnt: 1 }];
    //             return {
    //                 trigger: ['getdmg', 'heal'],
    //                 execmds: isCdt(card.useCnt != 2, [execmds[card.useCnt % 3]]),
    //                 exec: () => {
    //                     if (++card.useCnt == 4) --card.perCnt;
    //                 }
    //             }
    //         }
    //     }, { uct: 0, pct: 1, isResetUct: true }),

    // 125: () => new GICard(125, '黄金剧团的奖赏', '【结束阶段：】如果所附属的角色在后台，则此牌累积1点｢报酬｣。(最多累积2点)；【对角色打出｢天赋｣或角色使用｢元素战技｣时：】此牌每有1点｢报酬｣，就将其消耗，以少花费1个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/0f7dfce291215155b3a48a56c8c996c4_3799856037595257577.png',
    //     0, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], hcard, trigger = '', minusDiceCard: mdc = 0, isSkill = -1 } = event;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, card.useCnt] });
    //         const isCardMinus = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidx]?.id && hcard.cost + hcard.anydice > mdc;
    //         const isPhaseEnd = trigger == 'phase-end' && card.useCnt < 2 && !heros[hidx]?.isFront;
    //         return {
    //             ...minusSkillRes,
    //             minusDiceCard: isCdt(isCardMinus, card.useCnt),
    //             trigger: ['phase-end', 'card', 'skilltype2'],
    //             isAddTask: isPhaseEnd,
    //             exec: () => {
    //                 if (isPhaseEnd) {
    //                     ++card.useCnt;
    //                 } else if (trigger == 'card' && isCardMinus) {
    //                     card.useCnt -= hcard.cost + hcard.anydice - mdc;
    //                 } else if (trigger == 'skilltype2' && isMinusSkill) {
    //                     const skill = heros[hidx]?.skills[isSkill].cost ?? [{ val: 0 }, { val: 0 }];
    //                     const skillcost = skill[0].val + skill[1].val;
    //                     card.useCnt -= skillcost - mdc - minusSkillRes.minusDiceSkill[isSkill].reduce((a, b) => a + b);
    //                 }
    //             }
    //         }
    //     }, { uct: 0 }),

    // 126: () => new GICard(126, '黄金剧团', '【结束阶段：】如果所附属的角色在后台，则此牌累积2点｢报酬｣。(最多累积4点)；【对角色打出｢天赋｣或角色使用｢元素战技｣时：】此牌每有1点｢报酬｣，就将其消耗，以少花费1个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/bbe185732644f5d29e9097985c4c09a8_8068337050754144727.png',
    //     2, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], hcard, trigger = '', minusDiceCard: mdc = 0, isSkill = -1 } = event;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype2: [0, 0, card.useCnt] });
    //         const isCardMinus = hcard && hcard.subType.includes(6) && hcard.userType == heros[hidx]?.id && hcard.cost + hcard.anydice > mdc;
    //         const isPhaseEnd = trigger == 'phase-end' && card.useCnt < 4 && !heros[hidx]?.isFront;
    //         return {
    //             ...minusSkillRes,
    //             minusDiceCard: isCdt(isCardMinus, card.useCnt),
    //             trigger: ['phase-end', 'card', 'skilltype2'],
    //             isAddTask: isPhaseEnd,
    //             exec: () => {
    //                 if (isPhaseEnd) {
    //                     card.useCnt = Math.min(4, card.useCnt + 2);
    //                 } else if (trigger == 'card' && isCardMinus) {
    //                     card.useCnt -= hcard.cost + hcard.anydice - mdc;
    //                 } else if (trigger == 'skilltype2' && isMinusSkill) {
    //                     const skill = heros[hidx]?.skills[isSkill].cost ?? [{ val: 0 }, { val: 0 }];
    //                     const skillcost = skill[0].val + skill[1].val;
    //                     card.useCnt -= skillcost - mdc - minusSkillRes.minusDiceSkill[isSkill].reduce((a, b) => a + b);
    //                 }
    //             }
    //         }
    //     }, { uct: 0 }),

    // 127: () => new GICard(127, '紫晶的花冠', '【所附属角色为出战角色，敌方受到[草元素伤害]后：】累积1枚｢花冠水晶｣。如果｢花冠水晶｣大于等于我方手牌数，则生成1个随机基础元素骰。(每回合至多生成2个)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/e431910b741b3723c64334265ce3e93e_3262613974155239712.png',
    //     1, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], hcards: { length: hcardsCnt } = [] } = event;
    //         if (!heros[hidx]?.isFront) return;
    //         return {
    //             trigger: ['grass-getdmg-oppo'],
    //             execmds: isCdt<Cmds[]>(card.useCnt + 1 >= hcardsCnt && card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: -1 }]),
    //             isAddTask: true,
    //             exec: () => {
    //                 if (++card.useCnt >= hcardsCnt && card.perCnt > 0) --card.perCnt;
    //             }
    //         }
    //     }, { uct: 0, pct: 2 }),

    // 128: () => new GICard(128, '乐园遗落之花', '【所附属角色为出战角色，敌方受到[草元素伤害]或发生了[草元素相关反应]后：】累积2枚｢花冠水晶｣。如果｢花冠水晶｣大于等于我方手牌数，则生成1个[万能元素骰]。(每回合至多生成2个)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/5a997c90413e44f8147b136856facd2b_8759080322483134287.png',
    //     2, 8, 0, [1], 0, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], hcards: { length: hcardsCnt } = [] } = event;
    //         if (!heros[hidx]?.isFront) return;
    //         return {
    //             trigger: ['grass-getdmg-oppo', 'el7Reaction'],
    //             execmds: isCdt<Cmds[]>(card.useCnt + 2 >= hcardsCnt && card.perCnt > 0, [{ cmd: 'getDice', cnt: 1, element: 0 }]),
    //             isAddTask: true,
    //             exec: () => {
    //                 card.useCnt += 2;
    //                 if (card.useCnt >= hcardsCnt && card.perCnt > 0) --card.perCnt;
    //             }
    //         }
    //     }, { uct: 0, pct: 2 }),

    // 129: () => new GICard(129, '角斗士的凯旋', '【角色使用｢普通攻击｣时：】如果我方手牌数量不多于2，则少消耗1个元素骰。(每回合1次)',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Weapon_JiaoDouShiXiao.webp',
    //     0, 8, 0, [1], 0, 1, (card, event) => {
    //         const { hcards: { length: hcardsCnt } = [] } = event;
    //         if (hcardsCnt > 2 || card.perCnt <= 0) return;
    //         const { minusSkillRes, isMinusSkill } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] });
    //         return {
    //             trigger: ['skilltype1'],
    //             ...minusSkillRes,
    //             exec: () => {
    //                 if (isMinusSkill) --card.perCnt;
    //             }
    //         }
    //     }, { pct: 1 }),

    // 180: normalElArtifact(180, '破冰踏雪的回音', 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/65841e618f66c6cb19823657118de30e_3244206711075165707.png'),

    // 181: advancedElArtifact(181, '冰风迷途的勇士', 4, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/9f6238a08b5844b652365304f05a4e8e_1667994661821497515.png'),

    // 182: normalElArtifact(182, '酒渍船帽', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/26c4d2daa8a4686107a39f372a2066f3_2037156632546120753.png'),

    // 183: advancedElArtifact(183, '沉沦之心', 1, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/b415a4b00134ee115f7abd0518623f4f_8721743655470015978.png'),

    // 184: normalElArtifact(184, '焦灼的魔女帽', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/0d841e5b1b0bbf09b8fa1bb7a3e9125b_8584142007202998007.png'),

    // 185: advancedElArtifact(185, '炽烈的炎之魔女', 2, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/fa55d0e05799d88270cc50bd7148bfcf_3804037770932131779.png'),

    // 186: normalElArtifact(186, '唤雷的头冠', 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/00d958c2d533c85d56613c0d718d9498_7034674946756695515.png'),

    // 187: advancedElArtifact(187, '如雷的盛怒', 3, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/3c5878d193077253d00e39f6db043270_1544021479773717286.png'),

    // 188: normalElArtifact(188, '翠绿的猎人之冠', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/ab97ddfef51292e8032722be4b90033c_7637964083886847648.png'),

    // 189: advancedElArtifact(189, '翠绿之影', 5, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/b95596e3e5648849048417635b619e2e_2329852964215208759.png'),

    // 190: normalElArtifact(190, '不动玄石之相', 6, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/886a90f766bcecf0e8812513b7075638_2236001599325966947.png'),

    // 191: advancedElArtifact(191, '悠古的磐岩', 6, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/977478ceacb3093ecefcf986aeacc1c5_8889340500329632165.png'),

    // 192: normalElArtifact(192, '月桂的宝冠', 7, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/ee4fbb8c86fcc3d54c5e6717b3b62ddb_7264725145151740958.png'),

    // 193: advancedElArtifact(193, '深林的记忆', 7, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/8c84639efb7e6a9fb445daafdee873fe_8494733884893501982.png'),

    // 201: ver => new GICard(201, '璃月港口', ver, '【结束阶段：】摸2张牌。；[可用次数]：2。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/c9f669c64195790d3ca31ee6559360ab_669337352006808767.png',
    //     2, 8, 1, [2], 0, 0, card => ({ support: [newSupport(4003, card)] })),

    // 202: () => new GICard(202, '骑士团图书馆', '【入场时：】选择任意元素骰重投。；【投掷阶段：】获得额外一次重投机会。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/cedc39cd65a6fde9ec51971973328b74_5542237863639059092.png',
    //     0, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4009, 202)], cmds: [{ cmd: 'reroll', cnt: 1 }], })),

    // 203: () => new GICard(203, '群玉阁', '【行动阶段开始时：】如果我方手牌数不多于3，则弃置此牌，生成1个[万能元素骰]。；【投掷阶段：】2个元素骰初始总是投出我方出战角色类型的元素。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/a170755e85072e3672834ae9f4d558d5_593047424158919411.png',
    //     0, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4010, 203)] })),

    // 204: () => new GICard(204, '晨曦酒庄', '【我方执行行动｢切换角色｣时：】少花费1个元素骰。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/27ea1b01a7d0011b40c0180e4fba0490_7938002191515673602.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4008, 204)] })),

    // 205: () => new GICard(205, '望舒客栈', '【结束阶段：】治疗受伤最多的我方后台角色2点。；[可用次数]：2',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/7ae272a8b40944f34630e0ec54c22317_1223200541912838887.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4006, 205)] })),

    // 206: () => new GICard(206, '西风大教堂', '【结束阶段：】治疗我方出战角色2点。；[可用次数]：2',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/e47492f5cf0d78f285c20ac6b38c8ed3_5642129970809736301.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4007, 206)] })),

    // 207: () => new GICard(207, '天守阁', '【行动阶段开始时：】如果我方的元素骰包含5种不同的元素，则生成1个[万能元素骰]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a6f2b064d7711e30c742b802770bef71_3841942586663095539.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4021, 207)] })),

    // 208: () => new GICard(208, '鸣神大社', '【每回合自动触发1次：】生成1个随机的基础元素骰。；[可用次数]：3',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/25bee82daa48f8018a4a921319ca2686_8817000056070129488.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4022, 208)], cmds: [{ cmd: 'getDice', cnt: 1, element: -1 }] })),

    // 209: () => new GICard(209, '珊瑚宫', '【结束阶段：】治疗所有我方角色1点。；[可用次数]：2',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2d016c4db4d3ce5c383d4fdb2a33f3e9_8583073738643262052.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4023, 209)] })),

    // 210: () => new GICard(210, '须弥城', '【对角色打出｢天赋｣或我方角色使用技能时：】如果我方元素骰数量不多于手牌数量，则少花费1个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a659c38687c72bdd6244b9ef3c28390b_972040861793737387.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4024, 210)] })),

    // 211: () => new GICard(211, '桓那兰那', '【结束阶段：】收集最多2个未使用的元素骰。；【行动阶段开始时：】拿回此牌所收集的元素骰。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/d46d38ef070b2340e8ee9dfa697aad3f_8762501854367946191.png',
    //     0, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4025, 211)] })),

    // 212: () => new GICard(212, '镇守之森', '【行动阶段开始时：】如果我方不是｢先手牌手｣，则生成1个出战角色类型的元素骰。；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/5a543775e68a6f02d0ba6526712d32c3_5028743115976906315.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4026, 212)] })),

    // 213: () => new GICard(213, '黄金屋', '【我方打出原本元素骰至少为3的｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。(每回合1次)；[可用次数]：2',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/b8d17f6fa027ce2ae0d7032daf5b0ee8_2325912171963958867.png',
    //     0, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4027, 213)] })),

    // 214: () => new GICard(214, '化城郭', '【我方选择行动前，元素骰为0时：】生成1个[万能元素骰]。(每回合1次)；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/5649867012fe98050232cf0b29c89609_1113164615099773768.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4028, 214)] })),

    // 215: () => new GICard(215, '风龙废墟', '【入场时：】从牌组中随机抽取一张｢天赋｣牌。；【我方打出｢天赋｣牌，或我方角色使用原本元素骰消耗至少为4的技能时：】少花费1个元素骰。(每回合1次)；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/1812234f8a4cbd2445ce3bc1387df37c_4843239005964574553.png',
    //     2, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4039, 215)], cmds: [{ cmd: 'getCard', cnt: 1, subtype: 6 }] })),

    // 216: () => new GICard(216, '湖中垂柳', '【结束阶段：】如果我方手牌数量不多于2，则抓2张牌。；[可用次数]：2',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/15/258999284/3e8a5c300c5c01f7fedaac87bd641d92_296932138041166470.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4040, 216)] })),

    // 217: () => new GICard(217, 310, '欧庇克莱歌剧院', '【我方选择行动前：】如果我方角色所装备卡牌的原本元素骰费用总和不比对方更低，则生成1个出战角色类型的元素骰。(每回合1次)；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/d34719921cedd17675f38dccc24ebf43_8000545229587575448.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4041, 217)] })),

    // 218: () => new GICard(218, '梅洛彼得堡', '【我方出战角色受到伤害或治疗后：】此牌累积1点｢禁令｣。(最多累积到4点)；【行动阶段开始时：】如果此牌已有4点｢禁令｣，则消耗4点，在敌方场上生成【sts2174】。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/41b42ed41f27f21f01858c0cdacd6286_8391561387795885599.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4047, 218)] })),

    // 219: () => new GICard(219, '清籁岛', '【任意阵营的角色受到治疗后：】使该角色附属【sts2184】。；[持续回合]：2',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/2bfc84b730feaf6a350373080d97c255_2788497572764739451.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4049, 219)] })),

    // 220: () => new GICard(220, '赤王陵', '【对方累积摸4张牌后：】弃置此牌，在对方牌库顶生成2张【crd908】。然后直到本回合结束前，对方每摸1张牌，就立刻生成1张【crd908】随机地置入对方牌库中。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/ad50dbbd94e8a1e52add8ad5efa5d61f_7946928210268600604.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4052, 220)] })),

    // 221: () => new GICard(221, '中央实验室遗址', '【我方[舍弃]或[调和]1张牌后：】此牌累积1点｢实验进展｣。每当｢实验进展｣达到3点、6点、9点时，就获得1个[万能元素骰]。然后，如果｢实验进展｣至少为9点，则弃置此牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/519cc801980bbb5907f9a25ca017d03a_4463551389207387795.png',
    //     1, 8, 1, [2], 0, 0, () => ({ support: [newSupport(4053, 221)] })),

    // 301: () => new GICard(301, '派蒙', '【行动阶段开始时：】生成2点[万能元素骰]。；[可用次数]：2。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/8b291b7aa846d8e987a9c7d60af3cffb_7229054083686130166.png',
    //     3, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4001, 301)] })),

    // 302: () => new GICard(302, '凯瑟琳', '【我方执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/67cf3f813876e6df62f21dc45c378fa3_4407562376050767664.png',
    //     1, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4011, 302)] })),

    // 303: () => new GICard(303, '蒂玛乌斯', '【入场时：】此牌附带2个｢合成材料｣。如果我方牌组中初始包含至少6张｢圣遗物｣，则从牌组中随机抽取一张｢圣遗物｣牌。；【结束阶段：】补充1个｢合成材料｣。；【打出｢圣遗物｣手牌时：】如可能，则支付等同于｢圣遗物｣总费用数量的｢合成材料｣，以免费装备此｢圣遗物｣(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/839e1884908b6ce5e8bc2d27bde98f20_778730297202034218.png',
    //     2, 8, 1, [3], 0, 0, (_card, event) => {
    //         const { playerInfo: { artifactCnt = 0 } = {} } = event;
    //         return {
    //             support: [newSupport(4012, 303)],
    //             cmds: isCdt<Cmds[]>(artifactCnt >= 6, [{ cmd: 'getCard', cnt: 1, subtype: 1 }]),
    //         }
    //     }),

    // 304: () => new GICard(304, '瓦格纳', '【入场时：】此牌附带2个｢锻造原胚｣。如果我方牌组中初始包含至少3种不同的｢武器｣，则从牌组中随机抽取一张｢武器｣牌。；【结束阶段：】补充1个｢锻造原胚｣。；【打出｢武器｣手牌时：】如可能，则支付等同于｢武器｣总费用数量的｢锻造原胚｣，以免费装备此｢武器｣(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/9a47df734f5bd5d52ce3ade67cf50cfa_2013364341657681878.png',
    //     2, 8, 1, [3], 0, 0, (_card, event) => {
    //         const { playerInfo: { weaponTypeCnt = 0 } = {} } = event;
    //         return {
    //             support: [newSupport(4013, 304)],
    //             cmds: isCdt<Cmds[]>(weaponTypeCnt >= 3, [{ cmd: 'getCard', cnt: 1, subtype: 0 }]),
    //         }
    //     }),

    // 305: () => new GICard(305, '卯师傅', '【打出｢料理｣事件牌后：】生成1个随机基础元素骰。(每回合1次)；【打出｢料理｣事件牌后：】从牌组中随机抽取1张｢料理｣事件牌。(整场牌局限制1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/430ad3710929867f9a4da3cb40812181_3109488257851299648.png',
    //     1, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4014, 305)] })),

    // 306: () => new GICard(306, '阿圆', '【打出｢场地｣支援牌时：】少花费2个元素骰。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/0fa92f9ea49deff80274c1c4702e46e3_5650398579643580888.png',
    //     2, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4015, 306)] })),

    // 307: () => new GICard(307, '提米', '【每回合自动触发1次：】此牌累积1只｢鸽子｣。；如果此牌已累积3只｢鸽子｣，则弃置此牌，摸1张牌，并生成1点[万能元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/638d754606562a2ff5aa768e9e0008a9_2604997534782710176.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4016, 307)] })),

    // 308: () => new GICard(308, '立本', '【结束阶段：】收集我方未使用的元素骰(每种最多1个)。；【行动阶段开始时：】如果此牌已收集3个元素骰，则摸2张牌，生成2点[万能元素骰]，然后弃置此牌。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/dbe203124b2b61d17f0c46523679ee52_7625356549640398540.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4005, 308)] })),

    // 309: () => new GICard(309, '常九爷', '【双方角色使用技能后：】如果造成了[物理伤害]、[穿透伤害]或引发了【元素反应】，此牌积累1个｢灵感｣。；如果此牌已积累3个｢灵感｣，弃置此牌并摸2张牌。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/df918cc6348b04d9f287c9b2f429c35c_3616287504640722699.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4004, 309)] })),

    // 310: () => new GICard(310, '艾琳', '【我方角色使用本回合使用过的技能时：】少花费1个元素骰。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/8c0a0d6b2fab8ef94f09ed61451ec972_2061140384853735643.png',
    //     2, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4017, 310)] })),

    // 311: () => new GICard(311, '田铁嘴', '【结束阶段：】我方一名充能未满的角色获得1点[充能]。(出战角色优先)；[可用次数]：2',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/163adc79a3050ea18fc75293e76f1a13_607175307652592237.png',
    //     2, 0, 1, [3], 0, 0, () => ({ support: [newSupport(4018, 311)] })),

    // 312: () => new GICard(312, '刘苏', '【我方切换角色后：】如果切换到的角色没有[充能]，则使该角色获得1点[充能]。(每回合1次)；[可用次数]：2',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/2d2a294488e6a5ecff2af216d1a4a81c_2786433729730992349.png',
    //     1, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4019, 312)] })),

    // 313: () => new GICard(313, '花散里', '【召唤物消失时：】此牌累积1点｢大袚｣进度。(最多累积3点)；【我方打出｢武器｣或｢圣遗物｣装备时：】如果｢大袚｣进度已达到3，则弃置此牌，使打出的卡牌少花费2个元素骰。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/874298075217770b022b0f3a02261a2a_7985920737393426048.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4029, 313)] })),

    // 314: () => new GICard(314, '鲸井小弟', '【行动阶段开始时：】生成1点[万能元素骰]。然后，如果对方的支援区未满，则将此牌转移到对方的支援区。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/8d008ff3e1a2b0cf5b4b212e1509726c_1757117943857279627.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4030, 314)] })),

    // 315: () => new GICard(315, '旭东', '【打出｢料理｣事件牌时：】少花费2个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a23ea3b4f3cb6b2df59b912bb418f5b8_1362269257088452771.png',
    //     2, 0, 1, [3], 0, 0, () => ({ support: [newSupport(4031, 315)] })),

    // 316: () => new GICard(316, '迪娜泽黛', '【打出｢伙伴｣支援牌时：】少花费1个元素骰。(每回合1次)；【打出｢伙伴｣支援牌后：】从牌组中随机抽取1张｢伙牌｣支援牌。(整场牌局限1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f08622b4178df0e2856f22c5e89a5bbb_735371509950287883.png',
    //     1, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4032, 316)] })),

    // 317: () => new GICard(317, '拉娜', '【我方角色使用｢元素战技｣后：】生成1个我方下一个后台角色类型的元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f0c19a49595f68895e309e5bf5760c1f_8058110322505961900.png',
    //     2, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4033, 317)] })),

    // 318: () => new GICard(318, '老章', '【我方打出｢武器｣手牌时：】少花费1个元素骰; 我方场上每有一个已装备｢武器｣的角色，就额外少花费1个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/c332425d700b588ed93ae01f9817e568_3896726709346713005.png',
    //     1, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4034, 318)] })),

    // 319: () => new GICard(319, '塞塔蕾', '【双方执行任何行动后，手牌数量为0时：】摸1张牌。；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/b4a9b32d9ff26697821d3cf0f2444ef7_7283838166930329300.png',
    //     1, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4035, 319)] })),

    // 320: () => new GICard(320, '弥生七月', '【我方打出｢圣遗物｣手牌时：】少花费1个元素骰; 如果我方场上已有2个装备｢圣遗物｣的角色，就额外少花费1个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/09820a12324bca69fe30277287462e2f_7162251245504180312.png',
    //     1, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4036, 320)] })),

    // 321: () => new GICard(321, '玛梅赫', '【我方打出｢玛梅赫｣以外的｢料理｣/｢场地｣/｢伙伴｣/｢道具｣行动牌后：】随机生成1张｢玛梅赫｣以外的｢料理｣/｢场地｣/｢伙伴｣/｢道具｣行动牌，将其加入手牌。(每回合1次)；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/eb0cb5b32a8c816b7f13c3d44d0a0fe4_6830305949958078300.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4042, 321)] })),

    // 322: () => new GICard(322, '婕德', '此牌会记录本场对局中我方支援区弃置卡牌的数量，称为｢阅历｣。(最多6点)；【我方角色使用｢元素爆发｣后：】如果｢阅历｣至少为6，则弃置此牌，对我方出战角色附属【sts2188】。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/8931597db1022094e0ebdf3e91f5f44c_6917553066022383928.png',
    //     1, 8, 1, [3], 0, 0, (_card, event) => {
    //         const { playerInfo: { destroyedSupport = 0 } = {} } = event;
    //         return { support: [newSupport(4045, 322, destroyedSupport)] }
    //     }),

    // 323: () => new GICard(323, '西尔弗和迈勒斯', '此牌会记录本场对局中敌方角色受到过的元素伤害种类数，称为｢侍从的周到｣。(最多4点)；【结束阶段：】如果｢侍从的周到｣至少为3，则弃置此牌，然后摸｢侍从的周到｣点数的牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/e160832e6337e402fc01d5f89c042aa3_8868205734801507533.png',
    //     1, 8, 1, [3], 0, 0, (_card, event) => {
    //         const { playerInfo: { oppoGetElDmgType = 0 } = {} } = event;
    //         let typelist = oppoGetElDmgType;
    //         let elcnt = 0;
    //         while (typelist != 0) {
    //             typelist &= typelist - 1;
    //             ++elcnt;
    //         }
    //         return { support: [newSupport(4046, 323, Math.min(4, elcnt))] }
    //     }),

    // 324: () => new GICard(324, '太郎丸', '【入场时：】生成4张【crd902】，均匀地置入我方牌库中。；我方打出2张【crd902】后：弃置此牌，召唤【smn3059】。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/21981b1c1976bec9d767097aa861227d_6685318429748077021.png',
    //     2, 0, 1, [3], 0, 0, () => ({ cmds: [{ cmd: 'addCard', cnt: 4, card: 902, element: 1 }], support: [newSupport(4050, 324)] })),

    // 325: () => new GICard(325, '白手套和渔夫', '【结束阶段：】生成1张【crd903】，随机将其置入我方牌库顶部5张牌之中。；如果此牌的[可用次数]仅剩1次，则摸1张牌。；[可用次数]：2',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/08e6d818575b52bd4459ec98798a799a_2502234583603653928.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4051, 325)] })),

    // 326: () => new GICard(326, '亚瑟先生', '【我方[舍弃]或[调和]1张牌后：】此牌累积1点｢新闻线索｣。(最多累积到2点)；【结束阶段：】如果此牌已累积2点｢新闻线索｣，则扣除2点，复制对方牌库顶的1张牌加入我方手牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/c2b793adbb8201b2e886bfd05b55b216_2354473128226348221.png',
    //     0, 8, 1, [3], 0, 0, () => ({ support: [newSupport(4054, 326)] })),

    // 327: () => new GICard(327, '瑟琳', '【每回合自动触发1次：】将1张随机的｢美露莘的声援｣放入我方手牌。；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/c2b793adbb8201b2e886bfd05b55b216_2354473128226348221.png',
    //     2, 0, 1, [3], 0, 0, () => ({ support: [newSupport(4054, 327)] })),

    // 401: () => new GICard(401, '参量质变仪', '【双方角色使用技能后：】如果造成了元素伤害，此牌积累1个｢质变进度｣。；此牌已累积3个｢质变进度｣时，弃置此牌并生成3个不同的基础元素骰。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/380f0bb73ffac88a2e8b60a1069a8246_3779576916894165131.png',
    //     2, 0, 1, [4], 0, 0, () => ({ support: [newSupport(4002, 401)] })),

    // 402: () => new GICard(402, '便携营养袋', '【入场时：】从牌组中随机抽取1张｢料理｣事件。；【我方打出｢料理｣事件牌时：】从牌组中随机抽取1张｢料理｣事件。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/158741257/ab41e76335be5fe031e9d2d6a4bc5cb1_7623544243734791763.png',
    //     1, 8, 1, [4], 0, 0, () => ({ support: [newSupport(4020, 402)], cmds: [{ cmd: 'getCard', cnt: 1, subtype: 5 }] })),

    // 403: () => new GICard(403, '红羽团扇', '【我方切换角色后：】本回合中，我方执行的下次｢切换角色｣行动视为｢[快速行动]｣而非｢[战斗行动]｣，并且少花费1个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e48e87cff7b902011afa232be419b12a_7174729288626413060.png',
    //     2, 8, 1, [4], 0, 0, () => ({ support: [newSupport(4037, 403)] })),

    // 404: () => new GICard(404, '寻宝仙灵', '【我方角色使用技能后：】此牌累积1个｢寻宝线索｣。；当此牌已累积3个｢寻宝线索｣时，弃置此牌并摸3张牌。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/4321ae941ccf75069eb630547df61e3c_1672242083656433331.png',
    //     1, 8, 1, [4], 0, 0, () => ({ support: [newSupport(4038, 404)] })),

    // 405: () => new GICard(405, '化种匣', '【我方打出原本元素骰费用至少为2的支援牌时：】少花费1个元素骰。(每回合1次)；[可用次数]：2',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/3a16ca3da02eaf503cc8169d5e29e938_8021832463219302062.png',
    //     0, 8, 1, [4], 0, 0, () => ({ support: [newSupport(4043, 405)] })),

    // 406: () => new GICard(406, '留念镜', '【我方打出｢武器｣/｢圣遗物｣/｢场地｣/｢伙伴｣手牌时：】如果本场对局中我方曾经打出过所打出牌的同名卡牌，则少花费2个元素骰。(每回合1次)；[可用次数]：2',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/aa32049459ce38daffbfe5dc82eb9303_2738230079920133028.png',
    //     1, 8, 1, [4], 0, 0, () => ({ support: [newSupport(4044, 406)] })),

    // 407: () => new GICard(407, '流明石触媒', '【我方打出行动牌后：】如果此牌在场期间本回合中我方已打出3张行动牌，则摸1张牌并生成1个[万能元素骰]。(每回合1次)；[可用次数]：3',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/f705b86904d8413be39df62741a8c81e_885257763287819413.png',
    //     2, 8, 1, [4], 0, 0, () => ({ support: [newSupport(4048, 407)] })),

    // 408: () => new GICard(408, '苦舍桓', '【行动阶段开始时：】[舍弃]最多2张原本元素骰费用最高的手牌，每[舍弃]1张，此牌就累积1点｢记忆和梦｣。(最多2点)；【我方角色使用技能时：】如果我方本回合未打出过行动牌，则消耗1点｢记忆和梦｣，以使此技能少花费1个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/67607b9684e9fb62a44f68c0f3a2e30c_5397809820905590818.png',
    //     0, 8, 1, [4], 0, 0, () => ({ support: [newSupport(4055, 408)] })),

    // 501: () => new GICard(501, '最好的伙伴！', '将所花费的元素骰转换为2个[万能元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/3fc6d26bb7b306296834c0b14abd4bc6_3989407061293772527.png',
    //     2, 0, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 2, element: 0 }] })),

    // 502: () => new GICard(502, '换班时间', '【我方下次执行｢切换角色｣行动时：】少花费1个元素骰。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/c512c490a548f8322503c59c9d87c89a_5960770686347735037.png',
    //     0, 8, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         return { isValid: allHidxs(heros).length > 1, status: [newStatus(2010)] }
    //     }),

    // 503: () => new GICard(503, '一掷乾坤', '选择任意元素骰【重投】，可重投2次。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/524d3e5c5e6f3fad28a931abd9c7bb92_2495658906309226331.png',
    //     0, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'reroll', cnt: 2 }] })),

    // 504: () => new GICard(504, '运筹帷幄', '摸2张牌。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/88a4ec8b97063fad015a9112ee352a88_3657371852718944273.png',
    //     1, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getCard', cnt: 2 }] })),

    // 505: () => new GICard(505, '本大爷还没有输！', '【本回合有我方角色被击倒，才能打出：】生成1个[万能元素骰]，我方当前出战角色获得1点[充能]。(每回合中，最多只能打出1张此牌)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/a1ae1067afcf9899a958c166b7b32fa0_5333005492197066238.png',
    //     0, 8, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         return {
    //             isValid: !heros[hidx]?.outStatus.some(ost => ost.id == 2116) && heros.some(h => h.hp == 0),
    //             cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }, { cmd: 'getEnergy', cnt: 1 }],
    //             status: [newStatus(2116)],
    //         }
    //     }),

    // 506: () => new GICard(506, '交给我吧！', '【我方下次执行｢切换角色｣行动时：】将此次切换视为｢[快速行动]｣而非｢[战斗行动]｣。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/182f87b4ad80bc18e051098c8d73ba98_7868509334361476394.png',
    //     0, 8, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         return { isValid: allHidxs(heros).length > 1, status: [newStatus(2011)] }
    //     }),

    // 507: () => new GICard(507, '鹤归之时', '【我方下一次使用技能后：】将下一个我方后台角色切换到场上。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/4b9215f7e25ed9581698b45f67164395_8716418184979886737.png',
    //     1, 8, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         return { isValid: allHidxs(heros).length > 1, status: [newStatus(2017)] }
    //     }),

    // 508: () => new GICard(508, '星天之兆', '我方当前出战角色【获得1点[充能]】。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/e6e557f4dd2762ecb727e14c66bafb57_828613557415004800.png',
    //     2, 0, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const hero = heros[hidx];
    //         return { cmds: [{ cmd: 'getEnergy', cnt: 1 }], isValid: (hero?.energy ?? 0) < (hero?.maxEnergy ?? 0) }
    //     }),

    // 509: () => new GICard(509, '白垩之术', '从最多2个我方后台角色身上，转移1点[充能]到我方出战角色。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/567c17051137fdd9e5c981ea584df298_4305321690584111415.png',
    //     1, 8, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs: [fhidx] = [] } = event;
    //         let isNeedEnergy = true;
    //         let hasEnergy = false;
    //         heros.forEach(h => {
    //             if (h.isFront) isNeedEnergy = h.energy < h.maxEnergy;
    //             else hasEnergy ||= h.energy > 0;
    //         });
    //         return {
    //             isValid: isNeedEnergy && hasEnergy,
    //             exec: () => {
    //                 let getEnergy = 0;
    //                 let needEnergy = heros[fhidx].maxEnergy - heros[fhidx].energy;
    //                 for (let i = 1; i < heros.length; ++i) {
    //                     const h = heros[(i + fhidx) % heros.length];
    //                     if (needEnergy == 0 || getEnergy >= 2) break;
    //                     if (h.energy == 0) continue;
    //                     --h.energy;
    //                     --needEnergy;
    //                     ++getEnergy;
    //                 }
    //                 heros[fhidx].energy += getEnergy;
    //             }
    //         }
    //     }),

    // 510: () => new GICard(510, '诸武精通', '将一个装备在我方角色的｢武器｣装备牌，转移给另一个武器类型相同的我方角色，并重置其效果的｢每回合｣次数限制。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/05625ae4eed490d0958191d8022174cd_5288127036517503589.png',
    //     0, 8, 2, [], 0, 2, (_card, event) => {
    //         const { heros = [], hidxs = [] } = event;
    //         const selectCnt = heros.filter(h => h.isSelected > 0).length;
    //         let canSelectHero;
    //         if (selectCnt == 0) {
    //             canSelectHero = heros.map(h => h.weaponSlot != null);
    //         } else if (selectCnt == 1) {
    //             const selectHero = heros.find(h => h.isSelected == 1);
    //             canSelectHero = heros.map(h => h.weaponType == selectHero?.weaponType && h.hp > 0);
    //         } else if (selectCnt == 2) {
    //             canSelectHero = heros.map(() => false);
    //         }
    //         return {
    //             canSelectHero,
    //             exec: () => {
    //                 const [fromHeroIdx, toHeroIdx] = hidxs;
    //                 const fromHero = heros[fromHeroIdx];
    //                 const toHero = heros[toHeroIdx];
    //                 const fromWeapon = fromHero.weaponSlot;
    //                 if (fromWeapon) {
    //                     fromHero.weaponSlot = null;
    //                     cardsTotal(fromWeapon.id).handle(fromWeapon, { reset: true });
    //                     toHero.weaponSlot = fromWeapon;
    //                 }
    //             }
    //         }
    //     }),

    // 511: () => new GICard(511, '神宝迁宫祝词', '将一个装备在我方角色的｢圣遗物｣装备牌，转移给另一个我方角色，并重置其效果的｢每回合｣次数限制。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/a67aefe7f7473b2bc9f602917bad9c5f_6329604065139808609.png',
    //     0, 8, 2, [], 0, 2, (_card, event) => {
    //         const { heros = [], hidxs = [] } = event;
    //         const selectCnt = heros.filter(h => h.isSelected > 0).length;
    //         const canSelectHero = selectCnt == 0 ? heros.map(h => h.artifactSlot != null) : heros.map(h => h.hp > 0);
    //         return {
    //             canSelectHero,
    //             exec: () => {
    //                 const [fromHeroIdx, toHeroIdx] = hidxs;
    //                 const fromHero = heros[fromHeroIdx];
    //                 const toHero = heros[toHeroIdx];
    //                 const fromArtifact = fromHero.artifactSlot;
    //                 if (fromArtifact) {
    //                     fromHero.artifactSlot = null;
    //                     cardsTotal(fromArtifact.id).handle(fromArtifact, { reset: true });
    //                     toHero.artifactSlot = fromArtifact;
    //                 }
    //             }
    //         }
    //     }),

    // 512: () => new GICard(512, '快快缝补术', '选择一个我方｢召唤物｣，使其[可用次数]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/1ede638fa4bb08aef24d03edf5c5d1d9_6232288201967488424.png',
    //     1, 8, 2, [], 0, 0, (_card, event) => ({
    //         exec: () => {
    //             const { summons = [] } = event;
    //             const selectSmn = summons.find(smn => smn.isSelected);
    //             if (selectSmn) ++selectSmn.useCnt;
    //         }
    //     }), { canSelectSummon: 1 }),

    // 513: () => new GICard(513, '送你一程', '选择一个敌方｢召唤物｣，使其[可用次数]-2。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/c0c1b91fe602e0d29159e8ae5effe537_7465992504913868183.png',
    //     2, 0, 2, [], 0, 0, (_card, event) => ({
    //         exec: () => {
    //             const { esummons = [] } = event;
    //             const selectSmn = esummons.find(smn => smn.isSelected);
    //             if (selectSmn) selectSmn.useCnt = Math.max(0, selectSmn.useCnt - 2);
    //         }
    //     }), { canSelectSummon: 0 }),

    // 514: () => new GICard(514, '护法之誓', '消灭所有｢召唤物｣。(不分敌我！)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/9df79dcb5f6faeed4d1f1b286dcaba76_1426047687046512159.png',
    //     4, 8, 2, [], 0, 0, (_card, event) => ({
    //         exec: () => {
    //             const { summons = [], esummons = [] } = event;
    //             summons.forEach(smn => (smn.useCnt = 0, smn.isDestroy = 0));
    //             esummons.forEach(smn => (smn.useCnt = 0, smn.isDestroy = 0));
    //         }
    //     })),

    // 515: () => new GICard(515, '下落斩', '[战斗行动]：切换到目标角色，然后该角色进行｢普通攻击｣。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/a3aa3a8c13499a0c999fc765c4a0623d_2838069371786460200.png',
    //     3, 8, 2, [7], 0, 1, (_card, event) => {
    //         const { heros = [], hidxs } = event;
    //         return {
    //             cmds: [{ cmd: 'switch-to', hidxs }, { cmd: 'useSkill', cnt: 0 }],
    //             canSelectHero: heros.map(h => !h.isFront && h.hp > 0),
    //         }
    //     }),

    // 516: () => new GICard(516, '重攻击', '本回合中，当前我方出战角色下次｢普通攻击｣造成的伤害+1。；【此次｢普通攻击｣为[重击]时：】伤害额外+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/563473c5f59960d334e2105c1571a982_2028527927557315162.png',
    //     1, 8, 2, [], 0, 0, (_card, { hidxs }) => ({ status: [newStatus(2051)], hidxs })),

    // 517: () => new GICard(517, '温妮莎传奇', '生成4个不同类型的基础元素骰。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/e8473742fd9e3966ccba393f52a1915a_7280949762836305617.png',
    //     3, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 4, element: -1 }] })),

    // 518: () => new GICard(518, '永远的友谊', '牌数小于4的牌手摸牌，直到手牌数各为4张。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/31/183046623/d5a778eb85b98892156d269044c54147_5022722922597227063.png',
    //     2, 8, 2, [], 0, 0, (_card, event) => {
    //         const { hcards: { length: hcardsCnt } = [], ehcardsCnt = 0 } = event;
    //         const cmds: Cmds[] = [];
    //         if (hcardsCnt < 5) cmds.push({ cmd: 'getCard', cnt: 5 - hcardsCnt });
    //         if (ehcardsCnt < 4) cmds.push({ cmd: 'getCard', cnt: 4 - ehcardsCnt, isOppo: true });
    //         return { cmds, isValid: cmds.length > 0 }
    //     }),

    // 519: () => new GICard(519, '大梦的曲调', '【我方下次打出｢武器｣或｢圣遗物｣手牌时：】少花费1个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/ebb47b7bd7d4929bbddae2179d46bc28_2360293196273396029.png',
    //     0, 8, 2, [], 0, 0, () => ({ status: [newStatus(2052)] })),

    // 520: () => new GICard(520, '藏锋何处', '将一个我方角色所装备的｢武器｣返回手牌。；【本回合中，我方下一次打出｢武器｣手牌时：】少花费2个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/888e75a6b80b0f407683eb2af7d25882_7417759921565488584.png',
    //     0, 8, 2, [], 0, 1, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const hero = heros[hidx];
    //         return {
    //             status: [newStatus(2053)],
    //             canSelectHero: heros.map(h => h.weaponSlot != null),
    //             cmds: [{ cmd: 'getCard', cnt: 1, card: isCdt(!!hero.weaponSlot, cardsTotal(hero.weaponSlot?.id ?? 0)) }],
    //             exec: () => { hero.weaponSlot = null },
    //         }
    //     }),

    // 521: () => new GICard(521, '拳力斗技！', '【我方至少剩余8个元素骰，且对方未宣布结束时，才能打出：】本回合中一位牌手先宣布结束时，未宣布结束的牌手摸2张牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/fa58de973ea4811ffe1812487dfb51c4_1089814927914226900.png',
    //     0, 8, 2, [], 0, 0, (_card, event) => {
    //         const { dicesCnt = 0, ephase = -1 } = event;
    //         const isValid = dicesCnt >= 8 && ephase <= 6;
    //         return { isValid, status: [newStatus(2101)] }
    //     }),

    // 522: () => new GICard(522, '琴音之诗', '将一个我方角色所装备的｢圣遗物｣返回手牌。；【本回合中，我方下一次打出｢圣遗物｣手牌时：】少花费2个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/4c4a398dfed6fe5486f64725f89bb76c_6509340727185201552.png',
    //     0, 8, 2, [], 0, 1, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const hero = heros[hidx];
    //         return {
    //             status: [newStatus(2110)],
    //             canSelectHero: heros.map(h => h.artifactSlot != null),
    //             cmds: [{ cmd: 'getCard', cnt: 1, card: isCdt(!!hero.artifactSlot, cardsTotal(hero.artifactSlot?.id ?? 0)) }],
    //             exec: () => { hero.artifactSlot = null },
    //         }
    //     }),

    // 523: () => new GICard(523, '野猪公主', '【本回合中，我方每有一张装备在角色身上的｢装备牌｣被弃置时：】获得1个[万能元素骰]。(最多获得2个)；(角色被击倒时弃置装备牌，或者覆盖装备｢武器｣或｢圣遗物｣，都可以触发此效果)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/7721cfea320d981f2daa537b95bb7bc1_3900294074977500858.png',
    //     0, 8, 2, [], 0, 0, () => ({ status: [newStatus(2148)] })),

    // 524: () => new GICard(524, '坍陷与契机', '【我方至少剩余8个元素骰，且对方未宣布结束时，才能打出：】本回合中，双方牌手进行｢切换角色｣行动时需要额外花费1个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/312a021086d348d6e7fed96949b68b64_469348099361246418.png',
    //     1, 8, 2, [], 0, 0, (_card, event) => {
    //         const { dicesCnt = 0, ephase = -1 } = event;
    //         const isValid = dicesCnt >= 8 && ephase <= 6;
    //         return { isValid, status: [newStatus(2147)], statusOppo: [newStatus(2147)] };
    //     }),

    // 525: () => new GICard(525, '浮烁的四叶印', '目标角色附属【四叶印】：每个回合的结束阶段，我方都切换到此角色。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/4845ea28326df1869e6385677b360722_5388810612366437595.png',
    //     0, 8, 2, [], 0, 1, () => ({ status: [newStatus(2151)] })),

    // 526: () => new GICard(526, '机关铸成之链', '【目标我方角色每次受到伤害或治疗后：】累积1点｢备战度｣(最多累积2点)。；【我方打出原本费用不多于｢备战度｣的｢武器｣或｢圣遗物｣时:】移除所有｢备战度｣，以免费打出该牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/51fdd12cc46cba10a8454337b8c2de30_3419304185196056567.png',
    //     0, 8, 2, [], 0, 1, () => ({ status: [newStatus(2162)] })),

    // 527: () => new GICard(527, 332, '净觉花', '选择一张我方支援区的牌，将其弃置。然后，在我方手牌中随机生成2张支援牌。；【本回合中，我方下次打出支援牌时：】少花费1个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/ce12f855ad452ad6af08c0a4068ec8fb_3736050498099832800.png',
    //     0, 8, 2, [], 0, 0, (_card, event) => {
    //         const { support = [] } = event;
    //         const disidx = support.findIndex(st => st.isSelected);
    //         support.splice(disidx, 1);
    //         support.forEach(st => {
    //             st.canSelect = false;
    //             st.isSelected = false;
    //         });
    //         const cards: Card[] = [];
    //         for (let i = 0; i < 2; ++i) {
    //             let c;
    //             while (!c) c = cardsTotal(Math.ceil(Math.random() * 300 + 200));
    //             cards.push(c);
    //         }
    //         return { status: [newStatus(2161)], cmds: [{ cmd: 'getCard', cnt: 2, card: cards }] };
    //     }, { canSelectSupport: 1 }),

    // 528: () => new GICard(528, 347, '可控性去危害化式定向爆破', '【对方支援区和召唤物区的卡牌数量总和至少为4时，才能打出：】双方所有召唤物的[可用次数]-1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/2e859c0e0c52bfe566e2200bb70dae89_789491720602984153.png',
    //     1, 8, 2, [], 0, 0, (_card, event) => {
    //         const { esupport = [], summons = [], esummons = [] } = event;
    //         return {
    //             isValid: esupport.length + esummons.length >= 4,
    //             exec: () => {
    //                 summons.forEach(smn => smn.useCnt = Math.max(0, smn.useCnt - 1));
    //                 esummons.forEach(smn => smn.useCnt = Math.max(0, smn.useCnt - 1));
    //             }
    //         }
    //     }),

    // 529: () => new GICard(529, '海中寻宝', '生成6张【crd904】，随机地置入我方牌库中。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/40001dfa11a6aa20be3de16e0c89d598_3587066228917552605.png',
    //     2, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'addCard', cnt: 6, card: 904 }] })),

    // 530: magicCount(3, 530),

    // 531: () => new GICard(531, '｢看到那小子挣钱…｣', '本回合中，每当对方获得2个元素骰，你就获得1个[万能元素骰]。(此效果提供的元素骰除外)',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Event_Event_ZhuanQian.webp',
    //     0, 8, 2, [], 0, 0, () => ({ status: [newStatus(2223)] })),

    // 532: () => new GICard(532, '噔噔！', '对我方｢出战角色｣造成1点[物理伤害]。本回合的结束阶段时，摸2张牌。',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Event_Event_DengDeng.webp',
    //     0, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'attack', element: 0, cnt: 1, isOppo: true }], status: [newStatus(2222)] })),

    // 561: () => new GICard(561, '自由的新风', '【本回合中，轮到我方行动期间有对方角色被击倒时：】本次行动结束后，我方可以再连续行动一次。；【[可用次数]：】1',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/24/258999284/bccf12a9c926bec7203e543c469ac58d_1423280855629304603.png',
    //     0, 8, 2, [8], 0, 0, () => ({ status: [newStatus(2054)] })),

    // 562: () => new GICard(562, '磐岩盟契', '【我方剩余元素骰数量为0时，才能打出：】生成2个不同的基础元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/194eb0cdc9200aca52848d54b971743f_2099934631074713677.png',
    //     0, 8, 2, [8], 0, 0, (_card, event) => {
    //         const { dicesCnt = 10 } = event;
    //         return { cmds: [{ cmd: 'getDice', cnt: 2, element: -1 }], isValid: dicesCnt == 0 }
    //     }),
    // 563: () => new GICard(563, '旧时庭园', '【我方有角色已装备｢武器｣或｢圣遗物｣时，才能打出：】本回合中，我方下次打出｢武器｣或｢圣遗物｣装备牌时少花费2个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/cd9d8158b2361b984da8c061926bb636_390832108951639145.png',
    //     0, 8, 2, [8], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         const isValid = heros.some(h => h.weaponSlot != null || h.artifactSlot != null);
    //         return { status: [newStatus(2055)], isValid }
    //     }),

    // 564: () => new GICard(564, '愉舞欢游', '【我方出战角色的元素类型为‹4冰›/‹1水›/‹2火›/‹3雷›/‹7草›时，才能打出：】对我方所有具有元素附着的角色，附着我方出战角色类型的元素。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/f11867042dd52c75e73d7b2e68b03430_7080334454031898922.png',
    //     0, 8, 2, [8], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         const isValid = [1, 2, 3, 4, 7].includes(heros.find(h => h.isFront)?.element ?? 0);
    //         const hidxs = heros.map((h, hi) => ({ hi, val: h.attachElement.length > 0 })).filter(v => v.val).map(v => v.hi);
    //         return { cmds: [{ cmd: 'attach', hidxs, element: -1 }], isValid }
    //     }),

    // 565: () => new GICard(565, '万家灶火', '【第1回合打出此牌时：】如果我方牌组中初始包含至少2张不同的｢天赋｣牌，则摸1张｢天赋｣牌。；【第2回合及以后打出此牌时：】我方摸【当前回合数-1】数量的牌。(最多摸4张)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/07/258999284/4c214784418f974b6b3fa294b415cdb4_8205569284186975732.png',
    //     0, 8, 2, [8], 0, 0, (_card, event) => {
    //         const { round = 1, playerInfo: { talentTypeCnt = 0 } = {} } = event;
    //         if (round > 1) return { cmds: [{ cmd: 'getCard', cnt: Math.min(4, round - 1) }] }
    //         return { isValid: talentTypeCnt >= 2, cmds: [{ cmd: 'getCard', subtype: 6, cnt: 1 }] }
    //     }),

    // 566: () => new GICard(566, 314, '裁定之时', '本回合中，对方牌手打出的3张｢事件牌｣无效。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/9ed8846c18cdf85e9b451a702d91c6e8_6360061723145748301.png',
    //     1, 8, 2, [8], 0, 0, () => ({ statusOppo: [newStatus(2146)] })),

    // 567: () => new GICard(567, 346, '抗争之日·碎梦之时', '本回合中，目标我方角色受到的伤害-1。(最多生效4次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/035d9f63a863e8ad26cb6ecf62725411_2229767666746467527.png',
    //     0, 8, 2, [8], 0, 1, () => ({ status: [newStatus(2173)] })),

    // 568: () => new GICard(568, '旧日鏖战', '敌方出战角色失去1点[充能]。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/e09e62a684575d632c731f3725280df2_7385957084481452662.png',
    //     1, 8, 2, [8], 0, 0, (_card, event) => {
    //         const { eheros = [] } = event;
    //         return {
    //             isValid: (eheros.find(h => h.isFront)?.energy ?? 0) > 0,
    //             cmds: [{ cmd: 'getEnergy', cnt: -1, isOppo: true }],
    //         }
    //     }),

    // 570: () => new GICard(570, '深渊的呼唤', '召唤一个随机｢丘丘人｣召唤物！',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/011610bb3aedb5dddfa1db1322c0fd60_7383120485374723900.png',
    //     2, 8, 2, [-3], 0, 0, (_card, event) => {
    //         const { summons = [] } = event;
    //         if (summons.length == 4) return { isValid: false }
    //         const smnIds = [3010, 3011, 3012, 3013].filter(sid => !summons.some(smn => smn.id === sid));
    //         return { summon: [newSummon(smnIds[Math.floor(Math.random() * smnIds.length)])] }
    //     },
    //     { expl: ['smn3010', 'smn3011', 'smn3012', 'smn3013'] }),

    // 571: () => new GICard(571, '风与自由', '【本回合中，我方角色使用技能后：】将下一个我方后台角色切换到场上。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/5a34fd4bfa32edfe062f0f6eb76106f4_4397297165227014906.png',
    //     0, 8, 2, [-3], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         return { isValid: allHidxs(heros).length > 1, status: [newStatus(2056)] }
    //     }),

    // 572: () => new GICard(572, '岩与契约', '【下回合行动阶段开始时：】生成3点[万能元素骰]，并摸1张牌。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/7ffbf85a7089e25fc48f6a48826e1fa4_183114830191275147.png',
    //     3, 0, 2, [-3], 0, 0, () => ({ status: [newStatus(2057)] })),

    // 573: () => new GICard(573, '雷与永恒', '将我方所有元素骰转换为[万能元素骰]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/760c101ed6ef3b500a830ae430458d89_4230653799114143139.png',
    //     0, 8, 2, [-3], 0, 0, () => ({ cmds: [{ cmd: 'changeDice', element: 0 }] })),

    // 574: () => new GICard(574, '草与智慧', '摸1张牌。然后，选择任意手牌替换。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/23/1694811/1c656067801c6beb53803faefedd0a47_7333316108362576471.png',
    //     1, 8, 2, [-3], 0, 0, () => ({ cmds: [{ cmd: 'getCard', cnt: 1 }, { cmd: 'changeCard', cnt: 2500 }] })),

    // 575: () => new GICard(575, '水与正义', '平均分配我方未被击倒的角色的生命值，然后治疗所有我方角色1点。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/e4ef932872a23852c3c2a7912e5f7d77_449791480408929176.png',
    //     2, 0, 2, [-3], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const hidxs = allHidxs(heros);
    //         const cmds: Cmds[] = [];
    //         if (hidxs.length > 1) {
    //             const allHp = heros.reduce((a, c) => c.hp > 0 ? a + c.hp : a, 0);
    //             const baseHp = Math.floor(allHp / hidxs.length);
    //             const fhps = Array.from({ length: heros.length }, (_, hpi) => heros[hpi].hp > 0 ? baseHp : -1);
    //             let restHp = allHp - baseHp * hidxs.length;
    //             for (let i = 0; i < heros.length; ++i) {
    //                 const hi = (hidx + i) % heros.length;
    //                 if (fhps[hi] == -1) continue;
    //                 if (restHp-- <= 0) break;
    //                 ++fhps[hi];
    //             }
    //             for (let i = 0; i < heros.length; ++i) {
    //                 if (fhps[i] == -1) continue;
    //                 const chp = fhps[i] - heros[i].hp;
    //                 if (chp == 0) continue;
    //                 const isOppo = chp < 0;
    //                 const cmd = !isOppo ? 'heal' : 'attack';
    //                 const element = isCdt(isOppo, -1);
    //                 cmds.push({ cmd, cnt: Math.abs(chp), element, isOppo, hidxs: [i] });
    //             }
    //         }
    //         cmds.push({ cmd: 'heal', cnt: 1, hidxs, round: 1 });
    //         return { cmds }
    //     }),

    // 578: () => new GICard(578, '愚人众的阴谋', '在对方场上，生成1个随机类型的｢愚人众伏兵｣。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/388f7b09c6abb51bf35cdf5799b20371_5031929258147413659.png',
    //     2, 8, 2, [-3], 0, 0, (_card, event) => {
    //         const { eheros = [] } = event;
    //         const stsIds = [2124, 2125, 2126, 2127].filter(sid => !eheros.find(h => h.isFront)?.outStatus.some(sts => sts.id === sid));
    //         return { statusOppo: [newStatus(stsIds[Math.floor(Math.random() * stsIds.length)])] }
    //     }, { expl: ['sts2124', 'sts2125', 'sts2126', 'sts2127'] }),

    331101: elCard(331101, 225, ELEMENT_TYPE.Cryo, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/3c2290805dd2554703ca4c5be3ae6d8a_7656625119620764962.png'),

    // 588: () => new GICard(588, '元素共鸣：粉碎之冰', '本回合中，我方当前出战角色下一次造成的伤害+2。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/75833613/4bbbf27e898aeace567039c5c2bb2a7c_4533106343661611310.png',
    //     1, 4, 2, [9], 0, 0, (_card, { hidxs }) => ({ status: [newStatus(2030)], hidxs })),

    331201: elCard(331201, 227, ELEMENT_TYPE.Hydro, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/4111a176d3936db8220047ff52e37c40_264497451263620555.png'),

    // 582: () => new GICard(582, '元素共鸣：愈疗之水', '治疗我方出战角色2点。然后，治疗我方所有后台角色1点。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/2735fa558713779ca2f925701643157a_7412042337637299588.png',
    //     1, 1, 2, [9], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs = [] } = event;
    //         return {
    //             cmds: [
    //                 { cmd: 'heal', cnt: 2, hidxs },
    //                 { cmd: 'heal', cnt: 1, hidxs: getBackHidxs(heros) },
    //             ],
    //             isValid: heros.some(h => h.hp < h.maxhp),
    //         }
    //     }),

    331301: elCard(331301, 229, ELEMENT_TYPE.Pyro, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/a37ec2ccbb719551f14586a51609a049_6190862804933467057.png'),

    // 584: () => new GICard(584, '元素共鸣：热诚之火', '本回合中，我方当前出战角色下一次引发[火元素相关反应]时，造成的伤害+3。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/82515ce0a16de7f3fba6e02232545230_5475039957819136120.png',
    //     1, 2, 2, [9], 0, 0, (_card, { hidxs }) => ({ status: [newStatus(2029)], hidxs })),

    331401: elCard(331401, 231, ELEMENT_TYPE.Electro, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/d7a7653168cd80943a50578aa1251f7a_1527724411934371635.png'),

    // 586: () => new GICard(586, '元素共鸣：强能之雷', '我方一名充能未满的角色获得1点[充能]。(出战角色优先)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/24c0eec5aa696696abeacd2a9ab2e443_2548840222933909920.png',
    //     1, 3, 2, [9], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs: [fhidx] = [] } = event;
    //         const hidxs: number[] = [];
    //         if (heros[fhidx].energy < heros[fhidx].maxEnergy) {
    //             hidxs.push(fhidx);
    //         } else {
    //             const hidx = heros.findIndex(h => h.energy < h.maxEnergy);
    //             if (hidx > -1) hidxs.push(hidx);
    //         }
    //         return { cmds: [{ cmd: 'getEnergy', cnt: 1, hidxs }], hidxs }
    //     }),

    331501: elCard(331501, 233, ELEMENT_TYPE.Anemo, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/f3fdbb9e308bfd69c04aa4e6681ad71d_7543590216853591638.png'),

    // 590: () => new GICard(590, '元素共鸣：迅捷之风', '切换到目标角色，并生成1点[万能元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/707f537df32de90d61b3ac8e8dcd4daf_7351067372939949818.png',
    //     1, 5, 2, [9], 0, 1, (_card, event) => {
    //         const { heros = [], hidxs } = event;
    //         return {
    //             cmds: [{ cmd: 'switch-to', hidxs }, { cmd: 'getDice', cnt: 1, element: 0 }],
    //             canSelectHero: heros.map(h => !h.isFront && h.hp > 0),
    //         }
    //     }),

    331604: elCard(331604, 235, ELEMENT_TYPE.Geo, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/cdd36a350467dd02ab79a4c49f07ba7f_4199152511760822055.png'),

    // 592: () => new GICard(592, '元素共鸣：坚定之岩', '本回合中，我方角色下一次造成[岩元素伤害]后：如果我方存在提供[护盾]的出战状态，则为一个此类出战状态补充3点[护盾]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/504be5406c58bbc3e269ceb8780eaa54_8358329092517997158.png',
    //     1, 6, 2, [9], 0, 0, () => ({ status: [newStatus(2031)] })),

    331701: elCard(331701, 237, ELEMENT_TYPE.Dendro, 'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/f6109c65a24602b1ad921d5bd5f94d97_2028353267602639806.png'),

    // 594: () => new GICard(594, '元素共鸣：蔓生之草', '本回合中，我方角色下一次引发元素反应时，造成的伤害+2。；使我方场上的｢燃烧烈焰｣、｢草原核｣和｢激化领域｣[可用次数]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75833613/af52f6c4f7f85bb3d3242778dc257c5c_1159043703701983776.png',
    //     1, 7, 2, [9], 0, 0, (_card, event) => {
    //         const { heros = [], summons = [] } = event;
    //         return {
    //             status: [newStatus(2032)],
    //             exec: () => {
    //                 const outStatus = heros.find(h => h.isFront)?.outStatus ?? [];
    //                 outStatus.forEach(ost => {
    //                     if (ost.id == 2005 || ost.id == 2006) ++ost.useCnt;
    //                 });
    //                 summons.forEach(smn => {
    //                     if (smn.id == 3002) ++smn.useCnt;
    //                 });
    //             }
    //         }
    //     }),

    // 601: () => new GICard(601, '绝云锅巴', '本回合中，目标角色下一次｢普通攻击｣造成的伤害+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/1e59df2632c1822d98a24047f97144cd_5355214783454165570.png',
    //     0, 8, 2, [5], 0, 1, () => ({ status: [newStatus(2014)] })),

    // 602: () => new GICard(602, '仙跳墙', '本回合中，目标角色下一次｢元素爆发｣造成的伤害+3。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/d5f601020016ee5b999837dc291dc939_1995091421771489590.png',
    //     2, 0, 2, [5], 0, 1, () => ({ status: [newStatus(2015)] })),

    // 603: () => new GICard(603, '莲花酥', '本回合中，目标角色下次受到的伤害-3。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/3df4388cf37da743d62547874329e020_8062215832659512862.png',
    //     1, 8, 2, [5], 0, 1, () => ({ status: [newStatus(2018)] })),

    // 604: () => new GICard(604, '北地烟熏鸡', '本回合中，目标角色下一次｢普通攻击｣少花费1个[无色元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/bea77758f2b1392abba322e54cb43dc4_7154513228471011328.png',
    //     0, 8, 2, [5], 0, 1, () => ({ status: [newStatus(2021)] })),

    // 605: () => new GICard(605, '甜甜花酿鸡', '治疗目标角色1点。(每回合每个角色最多食用1次｢料理｣)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/bb5528c89decc6e54ade58e1c672cbfa_4113972688843190708.png',
    //     0, 8, 2, [5], 0, 1, (_card, event) => {
    //         const canSelectHero = (event?.heros ?? []).map(h => h.hp < h.maxhp);
    //         return { cmds: [{ cmd: 'heal', cnt: 1 }], canSelectHero }
    //     }),

    // 606: () => new GICard(606, '蒙德土豆饼', '治疗目标角色2点。(每回合每个角色最多食用1次｢料理｣)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/f1026f0a187267e7484d04885e62558a_1248842015783359733.png',
    //     1, 8, 2, [5], 0, 1, (_card, event) => {
    //         const canSelectHero = (event?.heros ?? []).map(h => h.hp < h.maxhp);
    //         return { cmds: [{ cmd: 'heal', cnt: 2 }], canSelectHero }
    //     }),

    // 607: () => new GICard(607, '烤蘑菇披萨', '治疗目标角色1点，两回合内结束阶段再治疗此角色1点。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/915af5fee026a95d6001559c3a1737ff_7749997812479443913.png',
    //     1, 8, 2, [5], 0, 1, (_card, event) => {
    //         const canSelectHero = (event?.heros ?? []).map(h => h.hp < h.maxhp);
    //         return { cmds: [{ cmd: 'heal', cnt: 1 }], status: [newStatus(2016)], canSelectHero }
    //     }),

    // 608: () => new GICard(608, '兽肉薄荷卷', '目标角色在本回合结束前，之后的三次｢普通攻击｣都少花费1个[无色元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/79683714/02a88d1110794248403455ca8a872a96_7596521902301090637.png',
    //     1, 8, 2, [5], 0, 1, () => ({ status: [newStatus(2019)] })),

    // 609: () => new GICard(609, '提瓦特煎蛋', '复苏目标角色，并治疗此角色1点。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/981cc0d2da6a2dc2b535b1ee25a77622_592021532068551671.png',
    //     2, 8, 2, [-2, 5], 0, 1, (_card, event) => {
    //         const { heros = [], hidxs } = event;
    //         const isRevived = heros.find(h => h.isFront)?.outStatus.some(ist => ist.id == 2022);
    //         const canSelectHero = heros.map(h => h.hp <= 0 && !isRevived);
    //         return {
    //             cmds: [{ cmd: 'revive', cnt: 1, hidxs }],
    //             status: [newStatus(2022)],
    //             canSelectHero,
    //         }
    //     }),

    // 610: () => new GICard(610, '刺身拼盘', '目标角色在本回合结束前，｢普通攻击｣造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/66806f78b2ced1ea0be9b888d912a61a_8814575863313174324.png',
    //     1, 8, 2, [5], 0, 1, () => ({ status: [newStatus(2023)] })),

    // 611: () => new GICard(611, '唐杜尔烤鸡', '本回合中，所有我方角色下一次｢元素战技｣造成的伤害+2。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/ebc939f0b5695910118e65f9acfc95ff_8938771284871719730.png',
    //     2, 0, 2, [5], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         const hidxs = heros.map((h, hi) => ({ hi, val: !h.inStatus.some(ist => ist.id == 303300) && h.hp > 0 }))
    //             .filter(v => v.val).map(v => v.hi);
    //         return { status: [newStatus(2024)], hidxs }
    //     }),

    // 612: () => new GICard(612, '黄油蟹蟹', '本回合中，所有我方角色下次受到伤害-2。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/20/1694811/371abd087dfb6c3ec9435668d927ee75_1853952407602581228.png',
    //     2, 0, 2, [5], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         const hidxs = heros.map((h, hi) => ({ hi, val: !h.inStatus.some(ist => ist.id == 303300) && h.hp > 0 }))
    //             .filter(v => v.val).map(v => v.hi);
    //         return { status: [newStatus(2025)], hidxs }
    //     }),

    // 613: () => new GICard(613, 318, '炸鱼薯条', '本回合中，所有我方角色下次使用技能时少花费1个元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/17/258999284/21ece93fa784b810495128f6f0b14c59_4336812734349949596.png',
    //     2, 0, 2, [5], 0, 0, (_card, event) => {
    //         const { heros = [] } = event;
    //         const hidxs = heros.map((h, hi) => ({ hi, val: !h.inStatus.some(ist => ist.id == 303300) && h.hp > 0 }))
    //             .filter(v => v.val).map(v => v.hi);
    //         return { status: [newStatus(2152)], hidxs }
    //     }),

    // 614: () => new GICard(614, 333, '松茸酿肉卷', '治疗目标角色2点，3回合内结束阶段再治疗此角色1点。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/9001508071c110f4b13088edeb22c8b4_7346504108686077875.png',
    //     2, 8, 2, [5], 0, 1, (_card, event) => {
    //         const { heros = [] } = event;
    //         const canSelectHero = heros.map(h => h.hp < h.maxhp);
    //         return { cmds: [{ cmd: 'heal', cnt: 2 }], status: [newStatus(2159)], canSelectHero }
    //     }),

    // 615: () => new GICard(615, '缤纷马卡龙', '治疗目标角色1点，该角色接下来3次受到伤害后再治疗其1点。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/287f535c9a60620259bb149a75a3a001_7028948017645858669.png',
    //     2, 0, 2, [5], 0, 1, (_card, event) => {
    //         const { heros = [] } = event;
    //         const canSelectHero = heros.map(h => h.hp < h.maxhp);
    //         return { cmds: [{ cmd: 'heal', cnt: 1 }], status: [newStatus(2186)], canSelectHero }
    //     }),

    211011: () => new GICard(211011, 61, '唯此一心', 'v3.3.0',
        '{action}；装备有此牌的【hro】使用【ski】时：如果此技能在本场对局中曾经被使用过，则其对敌方后台角色造成的[穿透伤害]改为3点。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/15a100ee0285878fc5749663031fa05a_7762319984393418259.png',
        5, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent, CARD_SUBTYPE.Action], 2),

    211021: () => new GICard(211021, 62, '猫爪冰摇', 'v3.3.0',
        '{action}；装备有此牌的【hro】生成的【sts111021】，所提供的[护盾]值+1。',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/cb37f02217bcd8ae5f6e4a6eb9bae539_3357631204660850476.png',
        3, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent, CARD_SUBTYPE.Action], 1),

    211031: () => new GICard(211031, 63, '冷血之剑', 'v3.3.0',
        '{action}；装备有此牌的【hro】使用【ski】后：治疗自身2点。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/616ba40396a3998560d79d3e720dbfd2_3275119808720081204.png',
        4, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent, CARD_SUBTYPE.Action], 1, (card, event) => {
            if (card.perCnt <= 0) return;
            const { hidxs } = event;
            return {
                execmds: [{ cmd: 'heal', cnt: 2, hidxs }],
                exec: () => { --card.perCnt },
            }
        }, { pct: 1 }),

    211041: () => new GICard(211041, 64, '吐纳真定', 'v3.3.0',
        '{action}；装备有此牌的【hro】生成的【sts111041】获得以下效果：；使我方单手剑、双手剑或长柄武器角色的｢普通攻击｣伤害+1。',
        'https://patchwiki.biligame.com/images/ys/e/e6/qfsltpvntkjxioew81iehfhy5xvl7v6.png',
        3, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent, CARD_SUBTYPE.Action], 1),

    211051: () => new GICard(211051, 65, '寒天宣命祝词', 'v3.3.0',
        '装备有此牌的【hro】生成的【sts111052】会使所附魔角色造成的[冰元素伤害]+1。；切换到装备有此牌的【hro】时：少花费1个元素骰。(每回合1次)',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/7d706fd25ab0b3c4f8cca3af08d8a07b_2913232629544868049.png',
        2, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent], 0, (card, event) => ({
            trigger: ['change-to'],
            minusDiceHero: card.perCnt,
            exec: () => {
                let { switchHeroDiceCnt = 0 } = event;
                if (card.perCnt > 0 && switchHeroDiceCnt > 0) {
                    --card.perCnt;
                    --switchHeroDiceCnt;
                }
                return { switchHeroDiceCnt }
            },
        }), { pct: 1 }),

    211061: () => new GICard(211061, 66, '战欲涌现', 'v3.5.0',
        '{action}。；装备有此牌的【hro】使用【ski,1】时，会额外为【smn111062】累积1点｢能量层数｣。',
        'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/54bfba5d0eb40f38a0b679808dbf3941_5181344457570733816.png',
        3, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent, CARD_SUBTYPE.Action], 2, undefined, { energy: 2 }),

    211071: () => new GICard(211071, 67, '忘玄', 'v3.7.0',
        '{action}；装备有此牌的【hro】生成的【sts111071】被我方角色的｢普通攻击｣触发时：不消耗[可用次数]。(每回合1次)。',
        'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/9df7f8bf2b97688d9a8fae220b4ff799_2381296963104605530.png',
        3, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent, CARD_SUBTYPE.Action], 1),

    211081: () => new GICard(211081, 68, '起死回骸', 'v4.0.0',
        '{action}；装备有此牌的【hro】使用【ski】时，复苏我方所有倒下角色，并治疗其2点。(整场牌局限制2次)',
        'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/258999284/d5ef496771a846af08ec05fff036bf17_8628795343837772161.png',
        4, DICE_TYPE.Cryo, CARD_TYPE.Equipment, [CARD_SUBTYPE.Talent, CARD_SUBTYPE.Action], 2, undefined, { pct: 2, energy: 3, isResetPct: false }),

    // 703: () => new GICard(703, '重帘留香', '{action}；装备有此牌的【hro】生成的【sts2002】，会在我方出战角色受到至少为2的伤害时抵消伤害，并且初始[可用次数]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/eb3cd31f7a2c433499221b5664a264f3_3086723857644931388.png',
    //     3, 1, 0, [6, 7], 1102, 1),

    // 704: () => new GICard(704, '沉没的预言', '{action}；装备有此牌的【hro】出战期间，我方引发的[水元素相关反应]伤害额外+2。',
    //     'https://patchwiki.biligame.com/images/ys/d/de/1o1lt07ey988flsh538t7ywvnpzvzjk.png',
    //     3, 1, 0, [6, 7], 1103, 2, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         return { trigger: ['el1Reaction'], addDmgCdt: isCdt(heros[hidx]?.isFront, 2) }
    //     }, { energy: 3 }),

    // 705: () => new GICard(705, '流火焦灼', '{action}；装备有此牌的【hro】每回合第2次与第3次使用【ski】时，少花费1个[火元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/75720734/5d72a776e175c52de3c4ebb113f2b9e7_2138984540269318755.png',
    //     3, 2, 0, [6, 7], 1201, 1, (_card, event) => {
    //         const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype2: [0, 0, 1] }, skill => [1, 2].includes(skill.useCnt));
    //         return { trigger: ['skill'], ...minusSkillRes }
    //     }),

    // 706: () => new GICard(706, '混元熵增论', '{action}；装备有此牌的【hro】生成的【smn3005】已转换成另一种元素后：我方造成的此类元素伤害+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/93fb13495601c24680e2299f9ed4f582_2499309288429565866.png',
    //     3, 5, 0, [6, 7], 1401, 2, undefined, { energy: 2 }),

    // 707: () => new GICard(707, '蒲公英的国土', '{action}；装备有此牌的【hro】在场时，【smn3006】会使我方造成的[风元素伤害]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/4e162cfa636a6db51f166d7d82fbad4f_6452993893511545582.png',
    //     4, 5, 0, [6, 7], 1402, 2, undefined, { energy: 2 }),

    // 708: () => new GICard(708, '交叉火力', '{action}；装备有此牌的【hro】施放【ski】时，自身也会造成1点[火元素伤害]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/101e8ef859847643178755f3bcacbad5_4705629747924939707.png',
    //     3, 2, 0, [6, 7], 1202, 1),

    // 709: () => new GICard(709, '噬星魔鸦', '{action}；装备有此牌的【hro】生成的【smn3008】，会在【hro】｢普通攻击｣后造成2点[雷元素伤害]。(需消耗[可用次数])',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/95879bb5f97234a4af1210b522e2c948_1206699082030452030.png',
    //     3, 3, 0, [6, 7], 1301, 1),

    // 710: () => new GICard(710, '储之千日，用之一刻', '{action}；装备有此牌的【hro】在场时，【sts2027】会使我方造成的[岩元素伤害]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/8b72e98d01d978567eac5b3ad09d7ec1_7682448375697308965.png',
    //     4, 6, 0, [6, 7], 1501, 1),

    // 711: () => new GICard(711, '飞叶迴斜', '{action}；装备有此牌的【hro】使用了【ski】的回合中，我方角色的技能引发[草元素相关反应]后：造成1点[草元素伤害]。(每回合1次)',
    //     'https://patchwiki.biligame.com/images/ys/0/01/6f79lc4y34av8nsfwxiwtbir2g9b93e.png',
    //     4, 7, 0, [6, 7], 1601, 1),

    // 713: () => new GICard(713, '冒险憧憬', '{action}；装备有此牌的【hro】生成的【sts2034】，其伤害提升效果改为总是生效，不再具有生命值限制。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/05/12109492/044617980be5a70980f7826036963e74_8167452876830335549.png',
    //     4, 2, 0, [6, 7], 1203, 2, undefined, { energy: 2 }),

    // 714: () => new GICard(714, '觉醒', '{action}；装备有此牌的【hro】使用【ski】后：使我方一个‹3雷元素›角色获得1点[充能]。(出战角色优先，每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/7b07468873ea01ee319208a3e1f608e3_1769364352128477547.png',
    //     3, 3, 0, [6, 7], 1302, 1, (card, event) => {
    //         const { heros = [], hidxs: [fhidx] = [], isSkill = -1 } = event;
    //         if (isSkill != 1 || card.perCnt <= 0) return;
    //         const nhidxs: number[] = [];
    //         for (let i = 0; i < heros.length; ++i) {
    //             const hidx = (i + fhidx) % heros.length;
    //             const hero = heros[hidx];
    //             if (hero.hp > 0 && hero.element == 3 && hero.energy < hero.maxEnergy) {
    //                 nhidxs.push(hidx);
    //                 break;
    //             }
    //         }
    //         if (nhidxs.length == 0) return;
    //         return {
    //             trigger: ['skill'],
    //             execmds: [{ cmd: 'getEnergy', cnt: 1, hidxs: nhidxs }],
    //             exec: () => { --card.perCnt },
    //         }
    //     }, { pct: 1 }),

    // 715: () => new GICard(715, '支援就交给我吧', '{action}；装备有此牌的【hro】｢普通攻击｣后：如果此牌和【sts2036】仍在场，治疗我方所有角色1点。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/4c6332fd42d6edc64633a44aa900b32f_248861550176006555.png',
    //     3, 6, 0, [6, 7], 1502, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         if (heros[hidx]?.outStatus.some(ost => ost.id == 2036) && card.perCnt > 0) {
    //             return {
    //                 trigger: ['skilltype1'],
    //                 execmds: [{ cmd: 'heal', cnt: 1, hidxs: allHidxs(heros) }],
    //                 exec: () => { --card.perCnt },
    //             }
    //         }
    //     }, { pct: 1 }),

    // 716: () => new GICard(716, '光辉的季节', '{action}；装备有此牌的【hro】在场时，【smn3015】会使我方执行｢切换角色｣行动时少花费1个元素骰。(每回合1次)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/a0b27dbfb223e2fe52b7362ad80c3d76_4257766629162615403.png',
    //     3, 1, 0, [6, 7], 1101, 1, (card, event) => {
    //         let { summons = [], switchHeroDiceCnt = 0 } = event;
    //         if (card.perCnt > 0 && summons.some(smn => smn.id == 3015)) {
    //             return {
    //                 trigger: ['change'],
    //                 minusDiceHero: 1,
    //                 exec: () => {
    //                     if (switchHeroDiceCnt > 0) {
    //                         --card.perCnt;
    //                         --switchHeroDiceCnt;
    //                     }
    //                     return { switchHeroDiceCnt }
    //                 }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 719: () => new GICard(719, '长野原龙势流星群', '{action}；装备有此牌的【hro】生成的【sts2040】触发后：额外造成1点[火元素伤害]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/126c63df7d92e7d9c0a815a7a54558fc_6536428182837399330.png',
    //     1, 2, 0, [6, 7], 1204, 1),

    // 720: () => new GICard(720, '抵天雷罚', '{action}；装备有此牌的【hro】生成的【sts2008,3】获得以下效果：初始[持续回合]+1，并且会使所附属角色造成的[雷元素伤害]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/58e4a4eca066cc26e6547f590def46ad_1659079510132865575.png',
    //     3, 3, 0, [6, 7], 1303, 1),

    // 721: () => new GICard(721, '百川奔流', '{action}；装备有此牌的【hro】施放【ski】时：使我方所有召唤物[可用次数]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/b1a0f699a2168c60bc338529c3dee38b_3650391807139860687.png',
    //     4, 1, 0, [6, 7], 1721, 3, undefined, { energy: 3 }),

    // 722: () => new GICard(722, '镜锢之笼', '{action}；装备有此牌的【hro】生成的【sts2043】获得以下效果：；初始[持续回合]+1，并且会使所附属角色切换到其他角色时元素骰费用+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/12109492/b0294bbab49b071b0baa570bc2339917_4550477078586399854.png',
    //     3, 1, 0, [6, 7], 1722, 1),

    // 723: () => new GICard(723, '悉数讨回', '{action}；装备有此牌的【hro】生成的【sts2044】获得以下效果：；初始[持续回合]+1，并且使所附属角色造成的[物理伤害]变为[火元素伤害]。',
    //     'https://patchwiki.biligame.com/images/ys/4/4b/p2lmo1107n5nwc2pulpjkurlixa2o4h.png',
    //     3, 2, 0, [6, 7], 1741, 1),

    // 724: () => new GICard(724, '机巧神通', '{action}；装备有此牌的【hro】施放【ski】后，我方切换到后一个角色；施放【ski1781,2】后，我方切换到前一个角色。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/06/12109492/29356bd9bc7cbd8bf4843d6725cb8af6_6954582480310016602.png',
    //     3, 5, 0, [6, 7], 1781, 1),

    // 725: () => new GICard(725, '重铸：岩盔', '{action}；装备有此牌的【hro】击倒敌方角色后：【hro】重新附属【sts2045】和【sts2046】。',
    //     'https://patchwiki.biligame.com/images/ys/9/9f/ijpaagvk7o9jh1pzb933vl9l2l4islk.png',
    //     4, 6, 0, [6, 7], 1801, 2, () => ({
    //         trigger: ['kill'],
    //         execmds: [{ cmd: 'getStatus', status: [newStatus(2045), newStatus(2046)] }],
    //     }), { energy: 2 }),

    // 726: () => new GICard(726, '孢子增殖', '{action}；装备有此牌的【hro】可累积的｢【sts2047】｣层数+1。',
    //     'https://patchwiki.biligame.com/images/ys/4/41/bj27pgk1uzd78oc9twitrw7aj1fzatb.png',
    //     3, 7, 0, [6, 7], 1821, 1),

    // 727: () => new GICard(727, '砰砰礼物', '{action}；装备有此牌的【hro】生成的【sts2058】的[可用次数]+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/0cca153cadfef3f9ccfd37fd2b306b61_8853740768385239334.png',
    //     3, 2, 0, [6, 7], 1205, 1),

    // 728: () => new GICard(728, '落羽的裁择', '{action}；装备有此牌的【hro】在【sts2060】的｢凭依｣级数为偶数时使用【ski】时，造成的伤害额外+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/07/183046623/b4f218c914886ea4ab9ce4e0e129a8af_2603691344610696520.png',
    //     3, 3, 0, [6, 7], 1304, 1),

    // 729: () => new GICard(729, '霹雳连霄', '{action}；装备有此牌的【hro】使用【rsk1】时：使【hro】本回合内｢普通攻击｣少花费1个[无色元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/01/16/12109492/c3004d7c3873556c01124277c58b4b87_6946169426849615589.png',
    //     3, 3, 0, [6, 7], 1305, 1),

    // 730: () => new GICard(730, '我界', '{action}；装备有此牌的【hro】在场时，我方附属有【sts2064】的‹3雷元素›角色，｢元素战技｣和｢元素爆发｣造成的伤害额外+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/3eb3cbf6779afc39d7812e5dd6e504d9_148906889400555580.png',
    //     3, 3, 0, [6, 7], 1306, 1, (_card, event) => {
    //         const { heros = [] } = event;
    //         const hero = heros.find(h => h.isFront)!;
    //         if (hero.isFront && hero.element == 3 && hero.inStatus.some(ist => ist.id == 2064)) {
    //             return {
    //                 trigger: ['skilltype2', 'skilltype3', 'other-skilltype2', 'other-skilltype3'],
    //                 addDmgCdt: 1,
    //             }
    //         }
    //     }),

    // 731: () => new GICard(731, '匣中玉栉', '{action}；装备有此牌的【hro】使用【ski】时：召唤一个[可用次数]为1的【smn3023】; 如果【smn3023】已在场，则改为使其[可用次数]+1。；【sts2065】存在期间，【smn3023】造成的伤害+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/02/27/12109492/5e980c377a2142322435bb4487b4f8fc_5354100201913685764.png',
    //     3, 1, 0, [6, 7], 1104, 2, undefined, { energy: 2 }),

    // 733: () => new GICard(733, '镜华风姿', '{action}；装备有此牌的【hro】触发【sts2067】的效果时，对于生命值不多于6的敌人伤害+2。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/a222141c6f996c368c642afe39572e9f_2099787104835776248.png',
    //     3, 1, 0, [6, 7], 1105, 1, (_card, event) => {
    //         const { eheros = [], heros = [], hidxs: [hidx] = [], ehidx = -1 } = event;
    //         if ((eheros[ehidx]?.hp ?? 10) <= 6 && heros[hidx]?.inStatus.some(ist => ist.id == 2067)) {
    //             return { trigger: ['skilltype1'], addDmgCdt: 2 }
    //         }
    //     }),

    // 734: () => new GICard(734, '荒泷第一', '{action}；装备有此牌的【hro】每回合第2次及以后使用【ski】时：如果触发【sts2068】，伤害额外+1。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/46588f6b5a254be9e797cc0cfe050dc7_8733062928845037185.png',
    //     1, 6, 0, [6, 7], 1503, 0, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], isChargedAtk = false } = event;
    //         const { inStatus, skills: [{ useCnt }] } = heros[hidx];
    //         if (isChargedAtk && useCnt >= 1 && inStatus.some(ist => ist.id == 2068)) {
    //             return { trigger: ['skilltype1'], addDmgCdt: 1 }
    //         }
    //     }, { anydice: 2 }),

    // 735: () => new GICard(735, '眼识殊明', '{action}；装备有此牌的【hro】在附属【sts2071】期间，进行[重击]时少花费1个[无色元素骰]。',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2023/04/11/12109492/e949b69145f320ae71ce466813339573_5047924760236436750.png',
    //     4, 7, 0, [6, 7], 1602, 1, (_card, event) => {
    //         const { isChargedAtk = false, heros = [], hidxs: [hidx] = [] } = event;
    //         const { minusSkillRes } = minusDiceSkillHandle(event, { skilltype1: [0, 0, 1] },
    //             () => isChargedAtk && heros[hidx].inStatus.some(ist => ist.id == 2071));
    //         return { trigger: ['skilltype1'], ...minusSkillRes }
    //     }),

    // 737: () => new GICard(737, '深渊之灾·凝水盛放', '{action}；结束阶段：装备有此牌的【hro】在场时，敌方出战角色附属有【sts2076】，则对其造成1点[穿透伤害]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/e56754de22dbaf1cfb84ce85af588d21_7106803920286784988.png',
    //     3, 1, 0, [6, 7], 1106, 1),

    // 738: () => new GICard(738, '一触即发', '{action}；【〖hro〗｢普通攻击｣后：】如果此牌和【smn3029】仍在场，则引爆【smn3029】，造成4点[火元素伤害]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/2a48f2862634d319b9165838de944561_3946596064567874908.png',
    //     3, 2, 0, [6, 7], 1206, 1),

    // 739: () => new GICard(739, '血之灶火', '{action}；装备有此牌的【hro】在生命值不多于6时，造成的[火元素伤害]+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/950a1fe6fcb977429942fcf0db1a6cc6_4713651560561730973.png',
    //     2, 2, 0, [6, 7], 1207, 1, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         if ((heros[hidx]?.hp ?? 10) > 6) return;
    //         return { trigger: ['fire-dmg'], addDmgCdt: 1 }
    //     }),

    // 740: () => new GICard(740, '万千的愿望', '{action}；装备有此牌的【hro】使用【ski】时每消耗1点｢愿力｣，都使造成的伤害额外+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bea2df42c6cb8eecf724f2da60554278_2483208280861354828.png',
    //     4, 3, 0, [6, 7], 1307, 2, undefined, { energy: 2 }),

    // 741: () => new GICard(741, '神篱之御荫', '{action}；装备有此牌的【hro】通过【ski】消灭了【smn3031】后，本回合下次使用【ski1308,1】时少花费2个元素骰。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/bdb47c41b068190b9f0fd7fe1ca46bf3_449350753177106926.png',
    //     3, 3, 0, [6, 7], 1308, 2, undefined, { energy: 2 }),

    // 742: () => new GICard(742, '绪风之拥', '{action}；装备有此牌的【hro】生成的【sts2082】触发后，会使本回合中我方角色下次｢普通攻击｣少花费1个[无色元素骰]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/f46cfa06d1b3ebe29fe8ed2c986b4586_6729812664471389603.png',
    //     3, 5, 0, [6, 7], 1403, 1),

    // 743: () => new GICard(743, '降魔·护法夜叉', '{action}；装备有此牌的【hro】附属【sts2085】期间，使用【ski1404,1】时少花费1个[风元素骰]。(每附属1次【sts2085】，可触发2次)',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/fae27eb5db055cf623a80c11e08bb07c_2875856165408881126.png',
    //     3, 5, 0, [6, 7], 1404, 2, undefined, { energy: 2 }),

    // 744: () => new GICard(744, '炊金馔玉', '{action}；装备有此牌的【hro】在场时，我方出战角色在[护盾]角色状态或[护盾]出战状态的保护下时，我方召唤物造成的[岩元素伤害]+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/05/24/255120502/1742e240e25035ec13155e7975f7fe3e_495500543253279445.png',
    //     5, 6, 0, [6, 7], 1504, 2, (_card, event) => {
    //         const { heros = [] } = event;
    //         const fhero = heros.find(h => h.isFront);
    //         const istShield = fhero?.inStatus.some(ist => ist.type.includes(7));
    //         const ostShield = fhero?.outStatus.some(ost => ost.type.includes(7));
    //         if (istShield || ostShield) return { trigger: ['rock-dmg'], addDmgSummon: 1 }
    //     }),

    // 745: () => new GICard(745, '心识蕴藏之种', '{action}；装备有此牌的【hro】在场时，根据我方队伍中存在的元素类型提供效果：；‹2火元素›：【sts2089】在场时，自身受到元素反应触发【sts2088】的敌方角色，所受【sts2088】的[穿透伤害]改为[草元素伤害];；‹3雷元素›：【sts2089】入场时，使当前对方场上【sts2088】的[可用次数]+1;；‹1水元素›：装备有此牌的【hro】所生成的【sts2089】初始[持续回合]+1。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/013c862d1c89850fb23f26763f601b11_823565145951775374.png',
    //     3, 7, 0, [6, 7], 1603, 3, undefined, { energy: 2 }),

    // 746: () => new GICard(746, '冰萤寒光', '{action}；装备有此牌的【hro】使用技能后：如果【smn3034】的[可用次数]被叠加到超过上限，则造成2点[冰元素伤害]。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/a6d2ef9ea6bacdc1b48a5253345986cd_7285265484367498835.png',
    //     3, 4, 0, [6, 7], 1701, 1),

    // 747: () => new GICard(747, '汲能棱晶', '[战斗行动]：我方出战角色为【hro】时，治疗该角色3点，并附属【sts2091】。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/3257a4da5f15922e8f068e49f5107130_6618336041939702810.png',
    //     2, 3, 2, [6, 7], 1761, 1, () => ({ status: [newStatus(2091)], cmds: [{ cmd: 'heal', cnt: 3 }] })),

    // 748: () => new GICard(748, '烬火重燃', '【入场时：】如果装备有此牌的【hro】已触发过【sts2092】，就立刻弃置此牌，为角色附属【sts2093】。；装备有此牌的【hro】触发【sts2092】时：弃置此牌，为角色附属【sts2093】。',
    //     'https://act-upload.mihoyo.com/ys-obc/2023/05/16/183046623/c065153c09a84ed9d7c358c8cc61171f_8734243408282507546.png',
    //     2, 2, 0, [6], 1742, 1, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         if (heros[hidx]?.inStatus.every(ist => ist.id != 2092)) {
    //             return { status: [newStatus(2093)], isDestroy: true }
    //         }
    //     }),

    // 749: () => new GICard(749, '衍溢的汐潮', '{action}；装备有此牌的【hro】生成的【sts2095】额外具有以下效果：我方角色｢普通攻击｣后：造成1点[水元素伤害]。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/64b78d95471e27f99a8cf1cf2a946537_1864982310212941599.png',
    //     3, 1, 0, [6, 7], 1107, 2, undefined, { energy: 2 }),

    // 750: () => new GICard(750, '最终解释权', '{action}；装备有此牌的【hro】进行[重击]时：对生命值不多于6的敌人造成的伤害+1。；如果触发了【sts2096】，则在技能结算后摸1张牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/ad8a2130c54da3c3f25d094b7019cb69_4536540887547691720.png',
    //     1, 2, 0, [6, 7], 1208, 0, (_card, event) => {
    //         const { isChargedAtk = false, heros = [], hidxs: [hidx] = [], eheros = [], ehidx = -1 } = event;
    //         if (!isChargedAtk) return;
    //         return {
    //             trigger: ['skilltype1'],
    //             addDmgCdt: isCdt((eheros[ehidx]?.hp ?? 10) <= 6, 1),
    //             execmds: isCdt(heros[hidx]?.inStatus.some(ist => ist.id == 2096), [{ cmd: 'getCard', cnt: 1 }])
    //         }
    //     }, { anydice: 2 }),

    // 751: () => new GICard(751, '风物之诗咏', '{action}；装备有此牌的【hro】引发扩散反应后：使我方角色和召唤物接下来2次所造成的的被扩散元素类型的伤害+1。(每种元素类型分别计算次数)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/07/14/183046623/dd06fa7b0ec63f3e60534a634ebd6fd2_9125107885461849882.png',
    //     3, 5, 0, [6, 7], 1405, 1, (_card, event) => {
    //         const { trigger = '' } = event;
    //         const windEl = trigger.startsWith('el5Reaction') ? Number(trigger.slice(trigger.indexOf(':') + 1)) : 5;
    //         return { trigger: ['el5Reaction'], status: isCdt(windEl < 5, [newStatus(2118 + windEl)]) }
    //     }),

    // 752: () => new GICard(752, '脉冲的魔女', '切换到装备有此牌的【hro】后：使敌方出战角色附属【sts2099】。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/203927054/608b48c391745b8cbae976d971b8b8c0_2956537094434701939.png',
    //     1, 3, 0, [6], 1309, 1, (card, event) => {
    //         const { ehidx = -1 } = event;
    //         if (card.perCnt <= 0) return;
    //         return {
    //             trigger: ['change-to'],
    //             exec: () => {
    //                 --card.perCnt;
    //                 return { inStatusOppo: [newStatus(2099)], hidxs: [ehidx] }
    //             },
    //         }
    //     }, { pct: 1 }),

    // 754: () => new GICard(754, '神性之陨', '{action}；装备有此牌的【hro】在场时，如果我方场上存在【smn3040】，则我方角色进行[下落攻击]时造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/08/12/82503813/d10a709aa03d497521636f9ef39ee531_3239361065263302475.png',
    //     3, 6, 0, [6, 7], 1505, 1, (_card, event) => {
    //         const { summons = [], isFallAtk = false } = event;
    //         if (summons.some(smn => smn.id == 3040) && isFallAtk) return { trigger: ['skilltype1', 'other-skilltype1'], addDmgCdt: 1 }
    //     }),

    // 755: () => new GICard(755, '梦迹一风', '{action}；装备有此牌的【hro】在【sts2102】状态下进行[重击]后：下次从该角色执行｢切换角色｣行动时少花费1个元素骰，并且造成1点[风元素伤害]。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/08a42903fcff2a5249ef1fc4021ecf7a_492792879105973370.png',
    //     4, 5, 0, [6, 7], 1406, 1, (_card, event) => {
    //         const { isChargedAtk = false, heros = [], hidxs: [hidx] = [] } = event;
    //         const hasSts2102 = heros[hidx]?.inStatus.some(ist => ist.id == 2102);
    //         if (isChargedAtk && hasSts2102) return { trigger: ['skilltype1'], execmds: [{ cmd: 'getStatus', status: [newStatus(2103)] }] }
    //     }),

    // 756: () => new GICard(756, '崇诚之真', '{action}；【结束阶段：】如果装备有此牌的【hro】生命值不多于6，则治疗该角色2点。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/161a55bb8e3e5141557f38536579e897_3725263134237782114.png',
    //     4, 2, 0, [6, 7], 1209, 1, (_card, event) => {
    //         const { heros = [], hidxs = [] } = event;
    //         if ((heros[hidxs[0]]?.hp ?? 10) <= 6) return { trigger: ['phase-end'], execmds: [{ cmd: 'heal', cnt: 2, hidxs }] }
    //     }),

    // 757: () => new GICard(757, '慈惠仁心', '{action}；装备有此牌的【hro】生成的【smn3042】，在[可用次数]仅剩余最后1次时造成的伤害和治疗各+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/09/25/258999284/2b762e3829ac4a902190fde3e0f5377e_8510806015272134296.png',
    //     3, 7, 0, [6, 7], 1604, 1),

    // 758: () => new GICard(758, '星天的花雨', '{action}；装备有此牌的【hro】在场时：我方【smn3043】造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/8cc9e5054277fa7e344648ac99671e7d_2129982885233274884.png',
    //     3, 1, 0, [6, 7], 1108, 1),

    // 759: () => new GICard(759, '酌盈剂虚', '{action}；装备有此牌的【hro】所召唤的【smn3045】，对生命值不多于6的角色造成的治疗+1，使没有[充能]的角色获得[充能]时获得量+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/da73eb59f8fbd54b1c3da24d494108f7_706910708906017594.png',
    //     3, 3, 0, [6, 7], 1310, 2, undefined, { energy: 2 }),

    // 760: () => new GICard(760, '在地为化', '{action}；装备有此牌的【hro】在场，【sts2114】触发治疗效果时：生成1个出战角色类型的元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/11/08/258999284/aa3ad0a53cd667f9d6e5393214dfa09d_9069092032307263917.png',
    //     4, 7, 0, [6, 7], 1605, 2, undefined, { energy: 2 }),

    // 761: () => new GICard(761, '归芒携信', '{action}；装备有此牌的【hro】在场时，每当【sts2129】造成伤害，就摸1张牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/bf34b0aa7f7664582ddb7eacaf1bd9ca_8982816839843813094.png',
    //     3, 4, 0, [6, 7], 1009, 1),

    // 762: () => new GICard(762, '猜先有方', '{action}；【投掷阶段：】装备有此牌的【hro】在场，则我方队伍中每有1种元素类型，就使1个元素骰总是投出[万能元素骰]。(最多3个)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/09/258999284/3914bb6ef21abc1f7e373cfe38d8be27_3734095446197720091.png',
    //     3, 1, 0, [6, 7], 1109, 1, (_card, event) => {
    //         const { heros = [] } = event;
    //         return { trigger: ['phase-dice'], element: 0, cnt: Math.min(3, new Set(heros.map(h => h.element)).size) }
    //     }),

    // 763: () => new GICard(763, 290, '完场喝彩', '{action}；装备有此牌的【hro】在场时，【hro】自身和【smn3048】对具有‹2火元素附着›的角色造成的伤害+2。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/be471c09e294aaf12766ee17b624ddcc_5013564012859422460.png',
    //     3, 2, 0, [6, 7], 1210, 1, (card, event) => {
    //         const { heros = [], eheros = [], hidxs: [hidx] = [] } = event;
    //         const isAttachEl2 = eheros.find(h => h.isFront)?.attachElement.includes(2);
    //         if (card.perCnt > 0 && heros[hidx]?.isFront && isAttachEl2) {
    //             return {
    //                 trigger: ['skill'],
    //                 addDmgCdt: 2,
    //                 exec: () => { --card.perCnt },
    //             }
    //         }
    //     }, { pct: 1 }),

    // 764: () => new GICard(764, '如影流露的冷刃', '{action}；装备有此牌的【hro】每回合第二次使用【ski】时：伤害+2，并强制敌方切换到前一个角色。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/09214e6eaeb5399f4f1dd78e7a9fcf66_5441065129648025265.png',
    //     3, 5, 0, [6, 7], 1407, 1),

    // 765: () => new GICard(765, '犬奔·疾如风', '{action}；装备有此牌的【hro】在场时，我方角色造成[岩元素伤害]后：如果场上存在【sts2135】，摸1张牌。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5355a3c8d887fd0cc8fe8301c80d48ba_7375558397858714678.png',
    //     3, 6, 0, [6, 7], 1506, 1, (card, event) => {
    //         const { heros = [], isSkill = -1 } = event;
    //         const isUse = isSkill > -1 && heros.find(h => h.isFront)?.outStatus.some(ost => ost.id == 2135) && card.perCnt > 0;
    //         if (!isUse) return;
    //         return {
    //             trigger: ['rock-dmg'],
    //             execmds: [{ cmd: 'getCard', cnt: 1 }],
    //             exec: () => { --card.perCnt },
    //         }
    //     }, { pct: 1 }),

    // 766: () => new GICard(766, '正理', '{action}；装备有此牌的【hro】使用【ski】时，如果消耗了持续回合至少为1的【sts2136】，则总是附属持续回合为3的【sts2136】，并且摸1张牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/1ea58f5478681a7975c0b79906df7e07_2030819403219420224.png',
    //     3, 7, 0, [6, 7], 1606, 2, undefined, { energy: 2 }),

    // 767: () => new GICard(767, '苦痛奉还', '我方出战角色为【hro】时，才能打出：入场时，生成3个【hro】当前元素类型的元素骰。；角色受到至少为3点的伤害时：抵消1点伤害，然后根据【hro】的形态对敌方出战角色附属【sts2137】或【sts2137,1】。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/b053865b60ec217331ea86ff7fb8789c_3260337021267875040.png',
    //     3, 8, 0, [-1, 6], 1702, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], restDmg = -1 } = event;
    //         if (hidx == undefined) return;
    //         const hero = heros[hidx];
    //         if (restDmg > -1) {
    //             if (restDmg < 3 || card.perCnt == 0) return { restDmg }
    //             --card.perCnt;
    //             return { restDmg: restDmg - 1, inStatusOppo: [newStatus(2137, +(hero.element != 4))] }
    //         }
    //         return { isValid: hero?.isFront, cmds: [{ cmd: 'getDice', cnt: 3, element: hero.element }] }
    //     }, { pct: 1 }),

    // 768: () => new GICard(768, 295, '魔蝎烈祸', '{action}；装备有此牌的【hro】生成的【smn3051】在【hro】使用过｢普通攻击｣或｢元素战技｣的回合中，造成的伤害+1。；【smn3051】的减伤效果改为每回合至多2次。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/12/258999284/031bfa06becb52b34954ea500aabc799_7419173290621234199.png',
    //     3, 2, 0, [6, 7], 1743, 2, undefined, { energy: 2 }),

    // 769: () => new GICard(769, '悲号回唱', '{action}；装备有此牌的【hro】在场，附属有【sts2141】的敌方角色受到伤害时：我方摸1张牌。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/05/258999284/2dd249ed58e8390841360d901bb0908d_4304004857878819810.png',
    //     3, 3, 0, [6, 7], 1762, 1, undefined, { pct: 1 }),

    // 770: () => new GICard(770, '毁裂风涡', '{action}；装备有此牌的【hro】在场时，敌方出战角色所附属的【sts2142】状态被移除后：对下一个敌方后台角色附属【sts2142】。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/2832d884a3a931ecf486c2259908f41b_7125699530621449061.png',
    //     3, 5, 0, [6, 7], 1782, 1, undefined, { pct: 1 }),

    // 771: () => new GICard(771, '晦朔千引', '[战斗行动]：我方出战角色为【hro】时，对该角色打出。使【hro】附属【sts2145】，然后生成每种我方角色所具有的元素类型的元素骰各1个。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2023/12/19/258999284/5fd09f6cb9ecdc308105a2965989fdec_6866194267097059630.png',
    //     2, 8, 2, [6, 7], 1802, 1, (_card, event) => {
    //         const { heros = [] } = event;
    //         const element = [...new Set(heros.map(h => h.element))];
    //         return { status: [newStatus(2145)], cmds: [{ cmd: 'getDice', cnt: element.length, element }] }
    //     }),

    // 772: () => new GICard(772, '僚佐的才巧', '{action}；装备有此牌的【hro】生成的【sts2154】，初始[可用次数]+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/d1ba5d6f1a7bdb24e95ca829357df03a_6674733466390586160.png',
    //     3, 2, 0, [6, 7], 1211, 2, undefined, { energy: 2 }),

    // 773: () => new GICard(773, '偷懒的新方法', '{action}；装备有此牌的【hro】为出战角色期间，我方引发扩散反应时：摸2张牌。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/8399149d2618f3566580df22b153579a_4849308244790424730.png',
    //     3, 5, 0, [6, 7], 1408, 1, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         if (!heros[hidx]?.isFront || card.perCnt <= 0) return;
    //         return {
    //             trigger: ['el5Reaction'],
    //             execmds: [{ cmd: 'getCard', cnt: 2 }],
    //             exec: () => { --card.perCnt },
    //         }
    //     }, { pct: 1 }),

    // 774: () => new GICard(774, 325, '严霜棱晶', '我方出战角色为【hro】时，才能打出：使其附属【sts2157】。；装备有此牌的【hro】触发【sts2157】后：对敌方出战角色附属【sts2137】。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/27/258999284/71d1da569b1927b33c9cd1dcf04c7ab1_880598011600009874.png',
    //     1, 4, 0, [6], 1703, 1, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         return { isValid: heros[hidx]?.isFront, status: [newStatus(2157)] }
    //     }),

    // 775: () => new GICard(775, '明珠固化', '我方出战角色为【hro】时，才能打出：入场时，使【hro】附属[可用次数]为1的【sts2158】; 如果已附属【sts2158】，则使其[可用次数]+1。；装备有此牌的【hro】所附属的【sts2158】抵消召唤物造成的伤害时，改为每回合2次不消耗[可用次数]。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/01/25/258999284/ec966272143de66e191950a6016cf14f_3693512171806066057.png',
    //     0, 8, 0, [6], 1763, 1, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const hero = heros[hidx];
    //         const cnt = (hero.inStatus.find(ist => ist.id == 2158)?.useCnt ?? 0) + 1;
    //         return { isValid: hero?.isFront, status: [newStatus(2158, true, cnt, 1)] }
    //     }),

    // 776: () => new GICard(776, 338, '以有趣相关为要义', '{action}；装备有此牌的【hro】在场时，我方角色进行｢普通攻击｣后：如果对方场上附属有【sts2163】，则治疗我方出战角色2点。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/29c5370c3846c6c0a5722ef1f6c94d97_1023653312046109359.png',
    //     3, 4, 0, [6, 7], 1010, 1, (card, event) => {
    //         const { eheros = [] } = event;
    //         if (card.perCnt > 0 && eheros.flatMap(h => h.inStatus).some(ist => ist.id == 2163)) {
    //             return {
    //                 trigger: ['skilltype1', 'other-skilltype1'],
    //                 execmds: [{ cmd: 'heal', cnt: 2 }],
    //                 exec: () => { --card.perCnt },
    //             }
    //         }
    //     }, { pct: 1 }),

    // 777: () => new GICard(777, 339, '古海孑遗的权柄', '{action}；我方角色引发[水元素相关反应]后：装备有此牌的【hro】接下来2次造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/d419604605c1acde00b841ecf8c82864_58733338663118408.png',
    //     1, 1, 0, [6, 7], 1110, 0, (_card, event) => {
    //         const { isSkill = -1, hidxs } = event;
    //         if (isSkill == -1) return;
    //         return { trigger: ['el1Reaction', 'other-el1Reaction'], status: [newStatus(2166)], hidxs }
    //     }, { anydice: 2 }),

    // 778: () => new GICard(778, 340, '沿途百景会心', '{action}；装备有此牌的【hro】为出战角色，我方进行｢切换角色｣行动时：少花费1个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/d00693f2246c912c56900d481e37104a_1436874897141676884.png',
    //     3, 7, 0, [6, 7], 1607, 1, (card, event) => {
    //         let { switchHeroDiceCnt = 0 } = event;
    //         const isMinus = card.perCnt > 0;
    //         return {
    //             trigger: ['change-from'],
    //             minusDiceHero: isCdt(isMinus, 1),
    //             exec: () => {
    //                 if (switchHeroDiceCnt > 0 && isMinus) {
    //                     --card.perCnt;
    //                     --switchHeroDiceCnt;
    //                 }
    //                 return { switchHeroDiceCnt }
    //             }
    //         }
    //     }, { pct: 1 }),

    // 779: () => new GICard(779, 341, '雷萤浮闪', '{action}；装备有此牌的【hro】在场时，我方选择行动前：如果【smn3057】的[可用次数]至少为3，则【smn3057】立刻造成1点[雷元素伤害]。(需消耗[可用次数]，每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/03/06/258999284/adf954bd07442eed0bc3c77847c2d727_1148348250566405252.png',
    //     3, 3, 0, [6, 7], 1764, 1, undefined, { pct: 1 }),

    // 780: () => new GICard(780, '割舍软弱之心', '{action}；装备有此牌的【hro】被击倒时：角色[免于被击倒]，并治疗该角色到1点生命值。(每回合1次)；如果装备有此牌的【hro】生命值不多于5，则该角色造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/b53d6688202a139f452bda31939162f8_3511216535123780784.png',
    //     3, 3, 0, [6, 7, -4], 1311, 2, (card, event) => {
    //         const { heros = [], hidxs: [hidx] = [], trigger = '', reset = false } = event;
    //         if (reset) {
    //             if (!card.subType.includes(-4)) card.subType.push(-4);
    //             return;
    //         }
    //         const isRevive = card.perCnt > 0 && trigger == 'will-killed';
    //         return {
    //             trigger: ['skill', 'will-killed'],
    //             addDmgCdt: isCdt((heros[hidx]?.hp ?? 10) <= 5, 1),
    //             execmds: isCdt(isRevive, [{ cmd: 'revive', cnt: 1 }]),
    //             exec: () => {
    //                 if (isRevive) {
    //                     --card.perCnt;
    //                     card.subType.pop();
    //                 }
    //             }
    //         }
    //     }, { pct: 1, energy: 2, spReset: true }),

    // 781: () => new GICard(781, '妙道合真', '{action}；装备有此牌的【hro】所召唤的【smn3058】入场时和行动阶段开始时：生成1个[风元素骰]。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/6f4712bcbbe53515e63c1de112a58967_7457105821554314257.png',
    //     3, 5, 0, [6, 7], 1409, 2, undefined, { energy: 2 }),

    // 782: () => new GICard(782, '暗流涌动', '【入场时：】如果装备有此牌的【hro】已触发过【sts2181】，则在对方场上生成【sts2180】。；装备有此牌的【hro】被击倒或触发【sts2181】时：在对方场上生成【sts2180】。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/1dc62c9d9244cd9d63b6f01253ca9533_7942036787353741713.png',
    //     1, 1, 0, [6], 1723, 1, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const isTriggered = heros[hidx]?.inStatus.every(ist => ist.id != 2181);
    //         return {
    //             trigger: ['will-killed'],
    //             statusOppo: isCdt(isTriggered, [newStatus(2180)]),
    //             execmds: [{ cmd: 'getStatus', status: [newStatus(2180)], isOppo: true }],
    //         }
    //     }),

    // 783: () => new GICard(783, '熔火铁甲', '【入场时：】对装备有此牌的【hro】[附着火元素]。；我方除【sts2182】以外的[护盾]状态或[护盾]出战状态被移除后：装备有此牌的【hro】附属2层【sts2182】。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/04/15/258999284/c6d40de0f6da94fb8a8ddeccc458e5f0_8856536643600313687.png',
    //     1, 2, 0, [6], 1744, 1, (_card, { hidxs }) => ({ cmds: [{ cmd: 'attach', hidxs, element: 2 }] }), { pct: 1 }),

    // 784: () => new GICard(784, '予行恶者以惩惧', '{action}；装备有此牌的【hro】受到伤害或治疗后，此牌累积1点｢惩戒计数｣。；装备有此牌的【hro】使用技能时：如果已有3点｢惩戒计数｣，则消耗3点使此技能伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/ba5051d7c24ad430dcd83d95e4a6bf42_1747806350562559991.png',
    //     1, 4, 0, [6, 7], 1011, 0, (card, event) => {
    //         const { hidxs: [hidx] = [], heal = [], getdmg = [], trigger = '' } = event;
    //         return {
    //             trigger: ['getdmg', 'heal', 'skill'],
    //             addDmgCdt: isCdt(card.useCnt >= 3, 1),
    //             isAddTask: trigger != 'skill',
    //             exec: () => {
    //                 if (trigger == 'getdmg' && getdmg[hidx] > 0 || trigger == 'heal' && heal[hidx] > 0) {
    //                     ++card.useCnt;
    //                 } else if (trigger == 'skill' && card.useCnt >= 3) {
    //                     card.useCnt -= 3;
    //                 }
    //             }
    //         }
    //     }, { anydice: 2, uct: 0 }),

    // 785: () => new GICard(785, '｢诸君听我颂，共举爱之杯！｣', '{action}；装备有此牌的【hro】使用【ski】时，会对自身附属【sts2196】。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/fb5f84b550dcdcfcff9197573aee45a8_1289322499384647153.png',
    //     3, 1, 0, [6, 7], 1111, 1),

    // 786: () => new GICard(786, '地狱里摇摆', '{action}；【装备有此牌的〖hro〗使用技能时：】如果我方手牌数量不多于1，则造成的伤害+2。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/219c7c6843e4ead2ab8ab2ce7044f5c3_8151320593747508491.png',
    //     1, 2, 0, [6, 7], 1212, 0, (card, { hcards = [] }) => {
    //         if ((hcards.length - +card.selected) > 1 || card.perCnt <= 0) return;
    //         return { trigger: ['skill'], addDmgCdt: 2, exec: () => { --card.perCnt } }
    //     }, { pct: 1, anydice: 2 }),

    // 787: () => new GICard(787, '庄谐并举', '{action}；装备有此牌的【hro】在场时，我方没有手牌，则【sts2198】会使｢普通攻击｣造成的伤害额外+2。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/51cdfbb5318ad7af6ad0eece4ef05423_8606735009174856621.png',
    //     3, 6, 0, [6, 7], 1507, 2, (_card, { hcards = [] }) => {
    //         if (hcards.length > 0) return;
    //         return { trigger: ['skilltype1', 'other-skilltype1'], addDmgCdt: 2 }
    //     }, { energy: 2 }),

    // 788: () => new GICard(788, '预算师的技艺', '{action}；装备有此牌的【hro】在场时，我方触发【sts2202】的效果后：将1张所[舍弃]卡牌的复制加入你的手牌。如果该牌为｢场地｣牌，则使本回合中我方下次打出｢场地｣时少花费2个元素骰。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/10ea9432a97b89788ede72906f5af735_8657249785871520397.png',
    //     3, 7, 0, [6, 7], 1608, 1, undefined, { pct: 1 }),

    // 789: () => new GICard(789, '无光鲸噬', '{action}；装备有此牌的【hro】使用【ski】[舍弃]1张手牌后：治疗此角色该手牌元素骰费用的点数。(每回合1次)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/6c8ce9408dc45b74242f45fb45c2e5d0_4468452485234515493.png',
    //     4, 1, 0, [6, 7], 1724, 1, (card, { hcards = [] }) => {
    //         if (card.perCnt == 0) return;
    //         return {
    //             trigger: ['skilltype2'],
    //             execmds: [{ cmd: 'heal', cnt: Math.max(...hcards.filter(c => !c.selected).map(c => c.cost + c.anydice)) }],
    //             exec: () => { --card.perCnt },
    //         }
    //     }, { pct: 1 }),

    // 790: () => new GICard(790, '亡雷凝蓄', '【入场时：】生成1张【crd906】，置入我方手牌。；装备有此牌的【hro】在场时，我方打出【crd906】后：摸1张牌，然后生成1张【crd906】，随机置入我方牌库中。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/5138e59de35ef8ede3a26540a7b883e0_5065992084832534424.png',
    //     1, 3, 0, [6], 1765, 1, (_card, { hcard }) => ({
    //         trigger: ['card'],
    //         cmds: [{ cmd: 'getCard', cnt: 1, card: 906 }],
    //         execmds: isCdt(hcard?.id == 906, [{ cmd: 'getCard', cnt: 1 }, { cmd: 'addCard', cnt: 1, card: 906 }]),
    //     })),

    // 791: () => new GICard(791, '亡风啸卷', '【入场时：】生成1张【crd906】，置入我方手牌。；装备有此牌的【hro】在场时，我方打出【crd906】后：本回合中，我方下次切换角色后，生成1个出战角色类型的元素骰。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/fe1743d31d026423617324d6c74ff0af_8502180086842896297.png',
    //     1, 5, 0, [6], 1783, 1, (_card, { hcard }) => ({
    //         trigger: ['card'],
    //         cmds: [{ cmd: 'getCard', cnt: 1, card: 906 }],
    //         execmds: isCdt(hcard?.id == 906, [{ cmd: 'getStatus', status: [newStatus(2208)] }]),
    //     })),

    // 792: () => new GICard(792, '万千子嗣', '【入场时：】生成4张【crd907】，随机置入我方牌库。；装备有此牌的【hro】在场时，我方【smn3063】造成的伤害+1。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/37bdaf8745b1264fdac723555ba2938b_177410860486747187.png',
    //     2, 7, 0, [6], 1822, 1, (_card, event) => {
    //         const { isSummon = -1 } = event;
    //         return { cmds: [{ cmd: 'addCard', cnt: 4, card: 907 }], trigger: ['dmg', 'other-dmg'], addDmgSummon: isCdt(isSummon == 3063, 1) }
    //     }),

    // 793: () => new GICard(793, '尖兵协同战法', '【队伍中包含‹2火元素›角色和‹3雷元素›角色且不包含其他元素的角色，才能打出：】将此牌装备给【hro】。；装备有此牌的【hro】在场，敌方角色受到超载反应伤害后：我方接下来造成的2次[火元素伤害]或[雷元素伤害]+1。(包括扩散反应造成的[火元素伤害]或[雷元素伤害])',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Chevreuse.webp',
    //     2, 2, 0, [6], 1213, 1, (_card, event) => {
    //         const { heros = [], isElStatus = [] } = event;
    //         return {
    //             isValid: heros.every(h => [2, 3].includes(h.element)),
    //             status: isCdt(isElStatus[2], [newStatus(2219)]),
    //         }
    //     }),

    // 794: () => new GICard(794, '不明流通渠道', '{action}；【装备有此牌的〖hro〗使用技能后：】摸2张【crd913】。(每回合1次)',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_Navia.webp',
    //     3, 6, 0, [6, 7], 1508, 1, card => {
    //         if (card.perCnt <= 0) return;
    //         return {
    //             trigger: ['skill'],
    //             execmds: [{ cmd: 'getCard', cnt: 2, card: 913, isAttach: true }],
    //             exec: () => { --card.perCnt },
    //         }
    //     }, { pct: 1 }),

    // 795: () => new GICard(795, '冰雅刺剑', '{action}；【装备有此牌的〖hro〗触发【sts2221】后：】使敌方出战角色的【sts2221】层数翻倍。',
    //     'https://api.hakush.in/gi/UI/UI_Gcg_CardFace_Modify_Talent_EscadronIce.webp',
    //     3, 4, 0, [6, 7], 1704, 1),


    // 901: () => new GICard(901, '雷楔', '[战斗行动]：将【hro1303】切换到场上，立刻使用【ski1303,2】。本次【ski1303,2】会为【hro1303】附属【sts2008,3】，但是不会再生成【雷楔】。(【hro1303】使用【ski1303,2】时，如果此牌在手中：不会再生成【雷楔】，而是改为[舍弃]此牌，并为【hro1303】附属【sts2008,3】)',
    //     'https://uploadstatic.mihoyo.com/ys-obc/2022/12/12/12109492/3d370650e825a27046596aaf4a53bb8d_7172676693296305743.png',
    //     3, 3, 2, [7], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs: [fhidx] = [] } = event;
    //         const hidx = heros.findIndex(h => h.id == 1303);
    //         const cmds: Cmds[] = [{ cmd: 'useSkill', cnt: 1 }];
    //         if (hidx != fhidx) cmds.unshift({ cmd: 'switch-to', hidxs: [hidx] });
    //         return { trigger: ['skilltype2'], cmds }
    //     }),

    // 902: () => new GICard(902, '太郎丸的存款', '生成1个[万能元素骰]。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/ec89e83a04c551ed3814157e8ee4a3e8_6552557422383245360.png',
    //     0, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'getDice', cnt: 1, element: 0 }] })),

    // 903: () => new GICard(903, '｢清洁工作｣', '我方出战角色下次造成伤害+1。(可叠加，最多叠加到+2)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/382849ade5e2cebea6b3a77a92f49f5b_4826032308536650097.png',
    //     0, 8, 2, [], 0, 0, () => ({ status: [newStatus(2185)] })),

    // 904: () => new GICard(904, '海底宝藏', '治疗我方出战角色1点，生成1个随机基础元素骰。',
    //     'https://gi-tcg-assets.guyutongxue.support/assets/UI_Gcg_CardFace_Summon_Xunbao.webp',
    //     0, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'heal', cnt: 1 }, { cmd: 'getDice', cnt: 1, element: -1 }] })),

    // 905: () => new GICard(905, '圣俗杂座', '在｢始基力:荒性｣和｢始基力:芒性｣之中，切换【芙宁娜】的形态。；如果我方场上存在【沙龙成员】或【众水的歌者】，也切换其形态。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/03/258999284/6b2b966c07c54e8d86dd0ef057ae5c4a_6986508112474897949.png',
    //     0, 8, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [], summons = [], isExec = false } = event;
    //         if (!isExec) return;
    //         const hidx = heros.findIndex(h => h.id == 1111);
    //         if (hidx == -1) return;
    //         const hero = heros[hidx];
    //         const nlocal = ((hero.local.pop() ?? 11) - 11) ^ 1;
    //         hero.local.push(11 + nlocal);
    //         hero.src = hero.srcs[nlocal];
    //         const smnIdx = summons.findIndex(smn => smn.id == 3060 + (nlocal ^ 1));
    //         if (smnIdx > -1) {
    //             const useCnt = summons[smnIdx].useCnt;
    //             summons.splice(smnIdx, 1, newSummon(3060 + nlocal, useCnt));
    //         }
    //         return { cmds: [{ cmd: 'loseSkill', hidxs: [hidx], element: 1 }, { cmd: 'getSkill', hidxs: [hidx], cnt: 22 + nlocal, element: 1 }] }
    //     }),

    // 906: () => new GICard(906, '噬骸能量块', '随机[舍弃]1张原本元素骰费用最高的手牌，生成1个我方出战角色类型的元素骰。如果我方出战角色是｢圣骸兽｣角色，则使其获得1点[充能]。(每回合最多打出1张)',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/7cb3ab81a7226897afdff50f4d567c13_7393439119842323642.png',
    //     0, 8, 2, [], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs: [hidx] = [] } = event;
    //         const cmds: Cmds[] = [{ cmd: 'discard', element: 0 }, { cmd: 'getDice', cnt: 1, element: -2 }];
    //         const fhero = heros[hidx];
    //         if (fhero?.local.includes(13)) cmds.push({ cmd: 'getEnergy', cnt: 1 })
    //         return { isValid: !fhero?.outStatus.some(ost => ost.id == 2207), cmds, status: [newStatus(2207)] }
    //     }),

    // 907: () => new GICard(907, '唤醒眷属', '【打出此牌或[舍弃]此牌时：】召唤一个独立的【smn3063】。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/04/258999284/5c6f5f310243aea5eff849b26dd80269_5016592096671426026.png',
    //     2, 7, 2, [], 0, 0, (_card, event) => {
    //         const { summons = [] } = event;
    //         if (summons.length == 4) return { isValid: false }
    //         let smnid = 3063;
    //         while (summons.some(smn => smn.id == smnid)) ++smnid;
    //         return { trigger: ['discard'], summon: [newSummon(smnid)] }
    //     }),

    // 908: () => new GICard(908, '禁忌知识', '无法使用此牌进行元素调和，且每回合最多只能打出1张｢禁忌知识｣。；对我方出战角色造成1点[穿透伤害]，摸1张牌。',
    //     'https://act-upload.mihoyo.com/wiki-user-upload/2024/06/02/258999284/fe20720734d5041d50cf6eab08689916_6711209992824489498.png',
    //     0, 8, 2, [-5], 0, 0, (_card, event) => {
    //         const { heros = [], hidxs = [] } = event;
    //         return {
    //             isValid: !heros[hidxs[0]]?.outStatus.some(ost => ost.id == 2215),
    //             cmds: [{ cmd: 'attack', cnt: 1, element: -1, hidxs, isOppo: true }, { cmd: 'getCard', cnt: 1 }],
    //             status: [newStatus(2215)],
    //         }
    //     }),

    // 909: magicCount(2),

    // 910: magicCount(1),

    // 911: magicCount(0),

    // 912: () => new GICard(912, '超量装药弹头', '[战斗行动]：对敌方｢出战角色｣造成1点[火元素伤害]。；【此牌被[舍弃]时：】对敌方｢出战角色｣造成1点[火元素伤害]。',
    //     '',
    //     2, 2, 2, [7], 0, 0, () => ({ trigger: ['discard'], cmds: [{ cmd: 'attack', element: 2, cnt: 1 }] })),

    // 913: () => new GICard(913, '裂晶弹片', '对敌方｢出战角色｣造成1点物理伤害，摸1张牌。',
    //     '',
    //     1, 8, 2, [], 0, 0, () => ({ cmds: [{ cmd: 'attack', element: 0, cnt: 1 }, { cmd: 'getCard', cnt: 1 }] })),

}

export const cardsTotal = (version: Version = VERSION[0]) => {
    const cards: Card[] = [];
    for (const idx in allCards) {
        const card = allCards[idx](version);
        if (card.version > version) continue;
        if (card.UI.cnt == -2) continue; // 不在选牌库展示
        cards.push(card);
    }
    return cards;
}

export const newCard = (version: Version = VERSION[0]) => (id: number) => allCards[id]?.(version) ?? NULL_CARD();

export const parseCard = (shareId: number) => cardsTotal().find(c => c.shareId == shareId) ?? NULL_CARD();
