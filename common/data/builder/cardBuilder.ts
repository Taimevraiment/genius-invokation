import { Card, Trigger, VersionCompareFn } from "../../../typing";
import {
    CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CardSubtype, CardTag, CardType, DICE_TYPE, DiceType, ELEMENT_CODE, HERO_LOCAL_CODE_KEY,
    HeroLocalCode, OfflineVersion, OnlineVersion, PURE_ELEMENT_CODE_KEY, PureElementCode,
    STATUS_TYPE, VERSION, Version,
    WEAPON_TYPE_CODE_KEY, WeaponType, WeaponTypeCode
} from "../../constant/enum.js";
import { ELEMENT_NAME, HERO_LOCAL_NAME, WEAPON_TYPE_NAME } from "../../constant/UIconst.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { compareVersionFn, getElByHid, getHidById, getVehicleIdByCid, hasObjById } from "../../utils/gameUtil.js";
import { convertToArray, isCdt } from "../../utils/utils.js";
import { CardHandleEvent, CardHandleRes } from "../cards.js";
import { BaseCostBuilder, VersionMap } from "./baseBuilder.js";

export type CardBuilderHandleRes = Omit<CardHandleRes, 'triggers'> & { triggers?: Trigger | Trigger[] };

export type CardBuilderHandleEvent = CardHandleEvent & { cmds: CmdsGenerator, execmds: CmdsGenerator, cmdsBefore: CmdsGenerator };

export class GICard {
    id: number; // 唯一id
    shareId: number; // 分享码id
    entityId: number = -1; // 实体id
    name: string; // 卡牌名
    sinceVersion: OnlineVersion; // 加入的版本
    offlineVersion: OfflineVersion | null; // 线下版本
    cost: number; // 费用
    costChange: number = 0; // 费用变化
    costType: DiceType; // 费用类型
    type: CardType; // 牌类型
    subType: CardSubtype[]; // 副类型
    tag: CardTag[]; // 特殊作用标签
    userType: number | WeaponType; // 使用人类型匹配：0全匹配 匹配武器Hero.weaponType 匹配天赋/特技Hero.id
    useCnt: number; // 累积点数
    perCnt: number; // 每回合的效果使用次数
    energy: number; // 需要的充能
    anydice: number; // 除了元素骰以外需要的任意骰
    handle: (card: Card, event?: CardHandleEvent) => CardHandleRes; // 卡牌发动的效果函数
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
        class?: string, // 动画的class
    };
    constructor(
        id: number, shareId: number, name: string, version: OnlineVersion, description: string, src: string, cost: number, costType: DiceType,
        type: CardType, subType?: CardSubtype | CardSubtype[], userType: number | WeaponType = 0, offlineVersion: OfflineVersion | null = null,
        handle?: (card: Card, event: CardBuilderHandleEvent, version: VersionCompareFn) => CardBuilderHandleRes | undefined | void,
        options: {
            tag?: CardTag[], uct?: number, pct?: number, expl?: string[], energy?: number, anydice?: number, cnt?: number,
            canSelectSummon?: 0 | 1 | -1, canSelectSupport?: 0 | 1 | -1, canSelectHero?: number, isUseNightSoul?: boolean,
            isResetUct?: boolean, isResetPct?: boolean, spReset?: boolean, ver?: Version
        } = {}
    ) {
        this.id = id;
        this.shareId = shareId;
        this.name = name;
        this.sinceVersion = version;
        this.offlineVersion = offlineVersion;
        subType ??= [];
        subType = convertToArray(subType);
        const { tag = [], uct = -1, pct = 0, expl = [], energy = 0, anydice = 0, canSelectSummon = -1, cnt = 2, canSelectHero = 0,
            isResetPct = true, isResetUct = false, spReset = false, canSelectSupport = -1, ver = VERSION[0], isUseNightSoul } = options;
        const hid = getHidById(id);
        description = description
            .replace(/(?<=〖)ski,(\d)(?=〗)/g, `ski${hid},$1`)
            .replace(/(?<=【)ski,(\d)(?=】)/g, `ski${hid},$1`)
            .replace(/\[useCnt\]/g, '【[可用次数]：{useCnt}】');
        this.UI = {
            description,
            src,
            cnt,
            descriptions: [],
            explains: [...(description.match(/(?<=【)[^【】]+\d(?=】)/g) ?? []), ...expl],
        }
        if (tag.includes(CARD_TAG.LocalResonance)) this.UI.description += `；（牌组包含至少2个「${HERO_LOCAL_NAME[HERO_LOCAL_CODE_KEY[(id - 331800) as HeroLocalCode]]}」角色，才能加入牌组）`;
        else if (subType.includes(CARD_SUBTYPE.Weapon)) this.UI.description += `；（「${WEAPON_TYPE_NAME[userType as WeaponType]}」【角色】才能装备。角色最多装备1件「武器」）`;
        else if (subType.includes(CARD_SUBTYPE.Relic)) this.UI.description += `；（角色最多装备1件「圣遗物」）`;
        else if (subType.includes(CARD_SUBTYPE.Vehicle)) {
            const vehicle = `rsk${getVehicleIdByCid(id)}`;
            const vehicleDesc = ` [特技]：【${vehicle}】；${uct > 0 ? `【[可用次数]：{useCnt}】；` : ''}`;
            if (this.UI.description.includes('{vehicle}')) {
                this.UI.description = this.UI.description.replace('{vehicle}', vehicleDesc);
            } else {
                this.UI.description += (this.UI.description != '' ? '；' : '') + vehicleDesc;
            }
            this.UI.description += `；（角色最多装备1个「特技」）`;
            this.UI.explains.push(vehicle);
            const ohandle = handle;
            const destroyTriggers: Trigger[] = ['action-after', 'action-start', 'action-start-oppo'];
            if (isUseNightSoul) {
                handle = (card, event, ver) => {
                    const res = ohandle?.(card, event, ver);
                    const { hero, combatStatus, trigger = '', execmds } = event;
                    if (!hero) return res;
                    const nightSoul = hero.heroStatus.find(s => s.hasType(STATUS_TYPE.NightSoul));
                    if (!nightSoul) return res;
                    if (trigger == 'slot-destroy') {
                        return { triggers: 'slot-destroy', exec: () => nightSoul.dispose(true) }
                    }
                    if (destroyTriggers.includes(trigger) && !hasObjById(combatStatus, 303238) && nightSoul.useCnt == 0) {
                        return { triggers: destroyTriggers, isDestroy: true, exec: () => nightSoul.dispose(true) }
                    }
                    execmds.consumeNightSoul(hero.hidx);
                    return res;
                }
            } else {
                handle = (card, event, ver) => {
                    const res = ohandle?.(card, event, ver) ?? {};
                    const { trigger = '' } = event;
                    if (destroyTriggers.includes(trigger) && card.useCnt == 0) {
                        return { triggers: destroyTriggers, isDestroy: true }
                    }
                    if (event.trigger != 'vehicle' || res.triggers?.includes('vehicle')) return res;
                    return {
                        triggers: 'vehicle',
                        exec: () => {
                            card.minusUseCnt();
                            return isCdt(!res.triggers, () => res.exec?.());
                        },
                    }
                }
            }
        } else if (subType.includes(CARD_SUBTYPE.Food)) {
            if (tag.includes(CARD_TAG.Revive)) this.UI.description += `；（每回合中，最多通过「料理」复苏1个角色，并且每个角色最多食用1次「料理」）`;
            else this.UI.description += `；（每回合每个角色最多食用1次「料理」）`;
            const ohandle = handle;
            handle = (card, event, ver) => {
                const res = ohandle?.(card, event, ver) ?? {};
                const ressts = typeof res?.status == 'number' ? [res.status] : res?.status ?? [];
                return {
                    isValid: event.heros?.some(h => !hasObjById(h.heroStatus, 303300)),
                    ...res,
                    status: [...ressts, 303300],
                    notPreview: true,
                }
            }
        } else if (subType.includes(CARD_SUBTYPE.Talent)) {
            const hro = `hro${hid}`;
            const ski = `ski${hid},${userType}`;
            if (this.UI.description.startsWith('{action}')) {
                if (!this.UI.explains.includes(ski)) this.UI.explains.unshift(ski);
                const ohandle = handle;
                const cnt = hid * 10 + (userType as number) + 1;
                handle = (card, event, ver) => {
                    const { slotUse = false, cmds } = event;
                    const ohandleres = ohandle?.(card, event, ver) ?? {};
                    if (slotUse && !ohandleres.cmds?.isUseSkill) {
                        cmds.useSkill({ skillId: cnt });
                        return { triggers: 'skill', isValid: ohandleres.isValid }
                    }
                    return ohandleres;
                }
            }
            this.UI.description = this.UI.description
                .replace(/{action}/, `[战斗行动]：我方出战角色为【hro】时，装备此牌。；【hro】装备此牌后，立刻使用一次‹#f4dca2【ski】›。`)
                .replace(/(?<=〖)ski(?=〗)/g, ski)
                .replace(/(?<=【)ski(?=】)/g, ski)
                + `；（牌组中包含【${hro}】，才能加入牌组）`;
            userType = hid;
        } else if (subType.includes(CARD_SUBTYPE.Legend)) {
            this.UI.description += `；（整局游戏只能打出一张「秘传」卡牌\\；这张牌一定在你的起始手牌中）`;
            this.UI.cnt = 1;
        } else if (subType.includes(CARD_SUBTYPE.ElementResonance)) {
            const elCode = Math.floor(id / 100) % 10 as PureElementCode;
            this.UI.description += `；（牌组中包含至少2个‹${elCode}${ELEMENT_NAME[PURE_ELEMENT_CODE_KEY[elCode]]}›角色，才能加入牌组）`;
        }
        if (tag.includes(CARD_TAG.Barrier)) {
            const ohandle = handle;
            handle = (card, event, ver) => {
                const { restDmg = -1 } = event;
                const res = ohandle?.(card, event, ver) ?? {};
                if (restDmg == -1) return res;
                return { ...res, triggers: 'reduce-dmg' }
            }
        }
        this.UI.description = this.UI.description.replace(/(?<=〖)hro(?=〗)/g, `hro${hid}`).replace(/(?<=【)hro(?=】)/g, `hro${hid}`);
        this.cost = cost;
        this.costType = costType;
        this.type = type;
        this.subType = subType ?? [];
        this.tag = tag;
        this.userType = userType;
        this.canSelectHero = canSelectHero;
        this.handle = (card, event) => {
            const cmds = new CmdsGenerator();
            const execmds = new CmdsGenerator();
            const cmdsBefore = new CmdsGenerator();
            const cevent: CardBuilderHandleEvent = { ...event, cmds, execmds, cmdsBefore };
            const { reset = false } = cevent;
            if (reset) {
                if (isResetPct) card.perCnt = pct;
                if (isResetUct) card.useCnt = uct;
                if (!spReset) return {}
            }
            const builderRes = handle?.(card, cevent, compareVersionFn(ver)) ?? {};
            const res: CardHandleRes = {
                ...builderRes,
                cmds,
                execmds,
                cmdsBefore,
                triggers: isCdt(builderRes.triggers, convertToArray(builderRes.triggers) as Trigger[]),
            }
            return res;
        }
        this.useCnt = uct;
        this.perCnt = pct;
        this.energy = energy;
        this.anydice = anydice;
        this.canSelectSummon = canSelectSummon;
        this.canSelectSupport = canSelectSupport;
    }
    setEntityId(entityId: number): Card {
        this.entityId = entityId;
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
    addUseCnt(n: number = 1): number {
        this.useCnt += n;
        return this.useCnt;
    }
    addUseCntMax(max: number, n?: number): void {
        this.addUseCnt(n);
        this.useCnt = Math.min(max, this.useCnt);
    }
    minusUseCnt(n: number = 1): void {
        this.useCnt = Math.max(0, this.useCnt - n);
    }
    addPerCnt(n: number = 1): void {
        this.perCnt += n;
    }
    minusPerCnt(n: number = 1): void {
        this.perCnt -= n;
    }
}

export class CardBuilder extends BaseCostBuilder {
    private _type: CardType = CARD_TYPE.Event;
    private _subtype: CardSubtype[] = [];
    private _tag: CardTag[] = [];
    private _userType: VersionMap<number | WeaponType> = new VersionMap();
    private _useCnt: VersionMap<number> = new VersionMap();
    private _perCnt: VersionMap<number> = new VersionMap();
    private _energy: VersionMap<number> = new VersionMap();
    private _anydice: number = 0;
    private _handle: ((card: Card, event: CardBuilderHandleEvent, version: VersionCompareFn) => CardBuilderHandleRes | undefined | void) | undefined;
    private _canSelectHero: VersionMap<number> = new VersionMap();
    private _canSelectSummon: -1 | 0 | 1 = -1;
    private _canSelectSupport: -1 | 0 | 1 = -1;
    private _isResetUseCnt: boolean = false;
    private _isResetPerCnt: boolean = true;
    private _isSpReset: boolean = false;
    private _src: string = '';
    private _explains: string[] = [];
    private _cnt: number = 2;
    private _isUseNightSoul: boolean = false;
    constructor(shareId?: number) {
        super(shareId ?? -1);
        if (shareId == undefined) this._cnt = -2;
    }
    get notInCardPool() {
        return this._cnt == -2;
    }
    get notExist() {
        const version = compareVersionFn(this._curVersion);
        return version.lt(this._version) && version.lt(this._offlineVersion);
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
        this._canSelectHero.set(['vlatest', 1]);
        return this;
    }
    weapon(weaponType?: WeaponType) {
        this._subtype.push(CARD_SUBTYPE.Weapon);
        if (weaponType != undefined) this._userType.set(['vlatest', weaponType]);
        return this.equipment();
    }
    relic() {
        this._subtype.push(CARD_SUBTYPE.Relic);
        return this.equipment();
    }
    vehicle(isUseNightSoul: boolean = false) {
        this._subtype.push(CARD_SUBTYPE.Vehicle);
        this._isUseNightSoul = isUseNightSoul;
        return this.equipment();
    }
    talent(skillIdx: number = -1, version: Version = 'vlatest') {
        if (version == 'vlatest') this.subtype(CARD_SUBTYPE.Talent);
        if (skillIdx != -1) {
            if (version == 'vlatest' || skillIdx == -2) this.subtype(CARD_SUBTYPE.Action);
            if (skillIdx > -1) this._userType.set([version, skillIdx]);
        }
        return this.equipment();
    }
    userType(hid: number = -1) {
        this._userType.set(['vlatest', hid]);
        return this;
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
    useCnt(useCnt: number, version: Version = 'vlatest') {
        this._useCnt.set([version, useCnt]);
        return this;
    }
    perCnt(perCnt: number, version: Version = 'vlatest') {
        this._perCnt.set([version, perCnt]);
        return this;
    }
    energy(energy: number, version: Version = 'vlatest') {
        this._energy.set([version, energy]);
        return this;
    }
    anydice(anydice: number) {
        this._anydice = anydice;
        return this;
    }
    canSelectHero(canSelectHero: number, version: Version = 'vlatest') {
        this._canSelectHero.set([version, canSelectHero]);
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
    handle(handle: (card: Card, event: CardBuilderHandleEvent, version: VersionCompareFn) => CardBuilderHandleRes | undefined | void) {
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
    isSpReset(isSpReset: boolean = true) {
        this._isSpReset = isSpReset;
        return this;
    }
    done() {
        let userType = this._userType.get(this._curVersion, 0);
        if (this._subtype.includes(CARD_SUBTYPE.Weapon)) {
            userType ||= WEAPON_TYPE_CODE_KEY[Math.floor(this._id / 100) % 10 as WeaponTypeCode];
        }
        if ((this._subtype.includes(CARD_SUBTYPE.Talent) && !this._subtype.includes(CARD_SUBTYPE.Action)) || userType == -1) {
            userType = getHidById(this._id);
        }
        if (this._type == CARD_TYPE.Support) {
            const handle = this._handle;
            this._handle = (card, event, ver) => {
                return { support: card.id, ...handle?.(card, event, ver) }
            };
        }
        const description = this._description.get(this._curVersion, '') +
            (this._isUseNightSoul ? '；{vehicle}；所附属角色「夜魂值」为0时，弃置此牌\\；此牌被弃置时，所附属角色结束【夜魂加持】。' : '');
        if (this._isUseNightSoul) {
            const nightSoulId = [, 111141, 112141, 113151, , 115111, 116104, 117092];
            this.explain(`【sts${nightSoulId[ELEMENT_CODE[getElByHid(getHidById(this._id))]]}】`)
        }
        const cost = this._cost.get(this._curVersion, 0);
        const costType = this._costType.get(this._curVersion, DICE_TYPE.Same);
        const useCnt = this._useCnt.get(this._curVersion, -1);
        const perCnt = this._perCnt.get(this._curVersion, 0);
        const energy = this._energy.get(this._curVersion, 0);
        const canSelectHero = this._canSelectHero.get(this._curVersion, 0);
        return new GICard(this._id, this._shareId, this._name, this._version, description, this._src,
            cost, costType, this._type, this._subtype, userType, this._offlineVersion, this._handle,
            {
                tag: this._tag,
                uct: useCnt,
                pct: perCnt,
                expl: this._explains,
                energy,
                anydice: this._anydice,
                cnt: this._cnt,
                canSelectSummon: this._canSelectSummon,
                canSelectSupport: this._canSelectSupport,
                canSelectHero,
                isResetUct: this._isResetUseCnt,
                isResetPct: this._isResetPerCnt,
                spReset: this._isSpReset,
                ver: this._curVersion,
                isUseNightSoul: this._isUseNightSoul,
            });
    }
}