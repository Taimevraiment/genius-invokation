import { Card } from "../../../typing";
import {
    CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CardSubtype,
    CardTag, CardType, DiceType, HERO_LOCAL_CODE_KEY,
    HeroLocalCode, PURE_ELEMENT_CODE_KEY, PureElementCode, VERSION, Version, WEAPON_TYPE_CODE_KEY, WeaponType
} from "../../constant/enum.js";
import { ELEMENT_NAME, HERO_LOCAL_NAME, WEAPON_TYPE_NAME } from "../../constant/UIconst.js";
import { getHidById } from "../../utils/gameUtil.js";
import { CardHandleEvent, CardHandleRes } from "../cards.js";
import { newStatus } from "../statuses.js";
import { BaseBuilder } from "./baseBuilder.js";

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
        handle?: (card: Card, event: CardHandleEvent, version: Version) => CardHandleRes | undefined,
        options: {
            tag?: CardTag[], uct?: number, pct?: number, expl?: string[], energy?: number, anydice?: number, cnt?: number,
            canSelectSummon?: 0 | 1 | -1, canSelectSupport?: 0 | 1 | -1, canSelectHero?: number,
            isResetUct?: boolean, isResetPct?: boolean, spReset?: boolean, ver?: Version
        } = {}
    ) {
        this.id = id;
        this.shareId = shareId;
        this.name = name;
        this.version = version;
        subType ??= [];
        if (typeof subType !== 'object') subType = [subType];
        const { tag = [], uct = -1, pct = 0, expl = [], energy = 0, anydice = 0, canSelectSummon = -1, cnt = 2,
            isResetPct = true, isResetUct = false, spReset = false, canSelectSupport = -1, ver = VERSION[0] } = options;
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
                const res = ohandle?.(card, event, ver) ?? {};
                return {
                    ...res,
                    status: [...(res?.status ?? []), newStatus(ver)(303300)],
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
                    return ohandle?.(card, event, ver);
                }
            }
            this.UI.description = this.UI.description
                .replace(/{action}/, `[战斗行动]：我方出战角色为【hro】时，装备此牌。；【hro】装备此牌后，立刻使用一次【ski】。`)
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
        this.UI.description = this.UI.description.replace(/(?<=〖)hro(?=〗)/g, `hro${hid}`).replace(/(?<=【)hro(?=】)/g, `hro${hid}`);
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
            return handle?.(card, event, ver) ?? {};
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

export class CardBuilder extends BaseBuilder {
    private _curVersion: Version = VERSION[0];
    private _type: CardType = CARD_TYPE.Event;
    private _subtype: CardSubtype[] = [];
    private _tag: CardTag[] = [];
    private _userType: number | WeaponType = 0;
    private _useCnt: number = -1;
    private _perCnt: number = 0;
    private _energy: number = 0;
    private _anydice: number = 0;
    private _handle: ((card: Card, event: CardHandleEvent, version: Version) => CardHandleRes | undefined) | undefined;
    private _canSelectHero: number = 0;
    private _canSelectSummon: -1 | 0 | 1 = -1;
    private _canSelectSupport: -1 | 0 | 1 = -1;
    private _isResetUseCnt: boolean = false;
    private _isResetPerCnt: boolean = true;
    private _isSpReset: boolean = false;
    private _src: string = '';
    private _description: [Version, string][] = [];
    private _explains: string[] = [];
    private _cnt: number = 2;
    constructor(shareId: number) {
        super(shareId);
        if (shareId == -1) this._cnt = -2;
    }
    get notInCardPool() {
        return this._cnt == -2;
    }
    get notExist() {
        return this._version > this._curVersion;
    }
    version(version?: Version) {
        if (version != undefined) this._curVersion = version;
        return this;
    }
    description(description: string, version: Version = VERSION[0]) {
        this._description.push([version, description]);
        return this;
    }
    src(src: string) {
        this._src = src;
        return this;
    }
    explain(...explain: string[]) {
        this._explains.push(...explain);
        return this;
    }
    cnt(cnt: number) {
        this._cnt = cnt;
        return this;
    }
    equipment() {
        this._type = CARD_TYPE.Equipment;
        this._canSelectHero = 1;
        return this;
    }
    weapon(weaponType?: WeaponType) {
        this._subtype.push(CARD_SUBTYPE.Weapon);
        if (weaponType != undefined) this._userType = weaponType;
        return this.equipment();
    }
    artifact() {
        this._subtype.push(CARD_SUBTYPE.Artifact);
        return this.equipment();
    }
    talent(skillIdx: number = -1) {
        this._subtype.push(CARD_SUBTYPE.Talent);
        if (skillIdx != -1) {
            this._subtype.push(CARD_SUBTYPE.Action);
            this._userType = skillIdx;
        }
        return this.equipment();
    }
    place() {
        this._subtype.push(CARD_SUBTYPE.Place);
        return this.support();
    }
    ally() {
        this._subtype.push(CARD_SUBTYPE.Ally);
        return this.support();
    }
    item() {
        this._subtype.push(CARD_SUBTYPE.Item);
        return this.support();
    }
    support() {
        this._type = CARD_TYPE.Support;
        return this;
    }
    event(isAction: boolean = false) {
        this._type = CARD_TYPE.Event;
        if (isAction) this._subtype.push(CARD_SUBTYPE.Action);
        return this;
    }
    food() {
        this._subtype.push(CARD_SUBTYPE.Food);
        return this;
    }
    legend() {
        this._subtype.push(CARD_SUBTYPE.Legend);
        this._cnt = 1;
        return this;
    }
    subtype(...subtypes: CardSubtype[]) {
        this._subtype.push(...subtypes);
        return this;
    }
    tag(...tags: CardTag[]) {
        this._tag.push(...tags);
        return this;
    }
    useCnt(useCnt: number) {
        this._useCnt = useCnt;
        return this;
    }
    perCnt(perCnt: number) {
        this._perCnt = perCnt;
        return this;
    }
    energy(energy: number) {
        this._energy = energy;
        return this;
    }
    anydice(anydice: number) {
        this._anydice = anydice;
        return this;
    }
    canSelectHero(canSelectHero: number) {
        this._canSelectHero = canSelectHero;
        return this;
    }
    canSelectSummon(canSelectSummon: 0 | 1) {
        this._canSelectSummon = canSelectSummon;
        return this;
    }
    canSelectSupport(canSelectSupport: 0 | 1) {
        this._canSelectSupport = canSelectSupport;
        return this;
    }
    handle(handle: (card: Card, event: CardHandleEvent, version: Version) => CardHandleRes | undefined) {
        this._handle = handle;
        return this;
    }
    isResetUseCnt(isResetUseCnt: boolean = true) {
        this._isResetUseCnt = isResetUseCnt;
        return this;
    }
    isResetPerCnt(isResetPerCnt: boolean = false) {
        this._isResetPerCnt = isResetPerCnt;
        return this;
    }
    isSpReset(isSpReset: boolean) {
        this._isSpReset = isSpReset;
        return this;
    }
    done() {
        if (this.notExist) return;
        if (this._subtype.includes(CARD_SUBTYPE.Weapon)) {
            this._userType ||= WEAPON_TYPE_CODE_KEY[Math.floor(this._id / 100) % 10];
        }
        if (this._subtype.includes(CARD_SUBTYPE.Talent) && !this._subtype.includes(CARD_SUBTYPE.Action)) {
            this._userType = getHidById(this._id);
        }
        const description = this._getValByVersion(this._description, '');
        const cost = this._getValByVersion(this._cost, 0);
        return new GICard(this._id, this._shareId, this._name, this._version, description, this._src,
            cost, this._costType, this._type, this._subtype, this._userType, this._handle,
            {
                tag: this._tag,
                uct: this._useCnt,
                pct: this._perCnt,
                expl: this._explains,
                energy: this._energy,
                anydice: this._anydice,
                cnt: this._cnt,
                canSelectSummon: this._canSelectSummon,
                canSelectSupport: this._canSelectSupport,
                canSelectHero: this._canSelectHero,
                isResetUct: this._isResetUseCnt,
                isResetPct: this._isResetPerCnt,
                spReset: this._isSpReset,
                ver: this._curVersion,
            });
    }
}