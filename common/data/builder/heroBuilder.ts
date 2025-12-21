import { Card, EnergyIcons, Skill, Status } from "../../../typing";
import { CARD_TAG, ELEMENT_CODE_KEY, ELEMENT_TYPE, ElementCode, ElementType, HERO_LOCAL, HeroTag, OfflineVersion, OnlineVersion, PureElementType, SKILL_TYPE, STATUS_TYPE, Version, WEAPON_TYPE, WeaponType } from "../../constant/enum.js";
import { GUYU_PREIFIX } from "../../constant/UIconst.js";
import { versionWrap } from "../../utils/gameUtil.js";
import { clone, convertToArray } from "../../utils/utils.js";
import { ArrayStatus, BaseCostBuilder, Entity, VersionMap } from "./baseBuilder.js";
import { GISkill, NormalSkillBuilder, SkillBuilder } from "./skillBuilder.js";

export class GIHero extends Entity {
    shareId: number; // 分享码id
    sinceVersion: OnlineVersion; // 加入的版本
    offlineVersion: OfflineVersion | null; // 线下版本
    tags: HeroTag[]; // 所属
    maxHp: number; // 最大血量
    hp: number; // 当前血量
    element: ElementType; // 角色元素
    weaponType: WeaponType; // 武器类型
    maxEnergy: number; // 最大充能
    energy: number = 0; // 当前充能
    hidx: number = -1; // 角色序号
    skills: Skill[] = []; // 技能组
    weaponSlot: Card | null = null; // 武器栏
    relicSlot: Card | null = null; // 圣遗物栏
    talentSlot: Card | null = null; // 天赋栏
    vehicleSlot: [Card, Skill] | null = null; // 特技栏
    heroStatus: ArrayStatus = new ArrayStatus(); // 角色状态
    isFront: boolean = false; // 是否为前台角色
    attachElement: PureElementType[] = []; // 附着元素
    updateEnergyIcon: (hero: GIHero, energyCnt: number) => EnergyIcons; // 更新充能图标
    UI: {
        src: string, // 立绘url
        srcs: string[], // 所有立绘url
        avatar: string, // 头像url
        avatars: string[], // 所有头像url
        isActive: boolean, // 是否发光
        curVersion: Version, // 当前版本
        versionChanges: Version[], // 版本变更
        maxEnergy: number, // 最大充能图标数量
        energyIcons: EnergyIcons, // 充能图标[底色，前色，是否闪烁]
    };
    constructor(
        id: number, shareId: number, name: string, version: OnlineVersion, curVersion: Version, tags: HeroTag | HeroTag[], maxHp: number,
        element: ElementType, weaponType: WeaponType, src: string | string[], avatar: string | string[], offlineVersion: OfflineVersion | null = null,
        skills: GISkill[] = [], maxEnergy: number = 0, versionChanges: Version[] = [], uiMaxEnergy?: number,
        updateEnergyIcon?: (hero: GIHero, energyCnt: number) => EnergyIcons,
    ) {
        super(id, name);
        this.shareId = shareId;
        this.sinceVersion = version;
        this.tags = convertToArray(tags);
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.element = element;
        this.weaponType = weaponType;
        src = convertToArray(src).filter(v => v != '').map(v => {
            if (v.startsWith('#')) return `${GUYU_PREIFIX}${v.slice(1) || id}`;
            return v;
        });
        avatar = convertToArray(avatar);
        this.skills.push(...skills);
        this.maxEnergy = maxEnergy || (this.skills.find(s => s.type == SKILL_TYPE.Burst)?.cost[2].cnt ?? 0);
        uiMaxEnergy ??= Math.abs(this.maxEnergy);
        this.UI = {
            src: src[0],
            srcs: src,
            avatar: avatar[0],
            avatars: avatar,
            isActive: false,
            curVersion,
            versionChanges,
            maxEnergy: uiMaxEnergy,
            energyIcons: [new Array(uiMaxEnergy).fill('/image/energy-empty.png'), [], []],
        }
        this.offlineVersion = offlineVersion;
        this.updateEnergyIcon = updateEnergyIcon ?? ((hero, energyCnt) => {
            const energyIcons = clone(hero.UI.energyIcons);
            energyIcons[1] = new Array(uiMaxEnergy).fill(0).map((_, eidx) => {
                if (hero.energy + Math.max(0, energyCnt) - 1 >= eidx) return '/image/energy-charged.png';
                return '/image/energy-empty.png';
            });
            energyIcons[2] = new Array(uiMaxEnergy).fill(0).map((_, eidx) => {
                if (energyCnt < 0) return -energyCnt - 1 >= eidx ? 2 : 0;
                return +(hero.energy - 1 < eidx && hero.energy + energyCnt - 1 >= eidx);
            });
            return energyIcons;
        });
        this.UI.energyIcons = this.updateEnergyIcon(this, 0);
    }
    get equipments(): Card[] {
        return [this.weaponSlot, this.relicSlot, this.talentSlot, this.vehicleSlot?.[0] ?? null]
            .filter((s): s is Card => s != null)
            .sort((a, b) => b.entityId - a.entityId);
    }
    get heroFields(): (Card | Status)[] {
        return [...this.heroStatus, ...this.equipments].sort((a, b) => b.entityId - a.entityId);
    }
    get hurtHp() {
        return this.maxHp - this.hp;
    }
    get isHurt() {
        return this.hp > 0 && this.hurtHp > 0;
    }
    get isFullEnergy() {
        return this.energy == this.maxEnergy;
    }
    get isDie() {
        return this.hp <= 0;
    }
    get hasSubHurt() {
        return this.heroStatus.has(STATUS_TYPE.Shield, STATUS_TYPE.Barrier) ||
            this.equipments.some(eq => eq.hasTag(CARD_TAG.Barrier));
    }
    get spEnergy() {
        if (this.energy >= 0) return 0;
        return -this.energy;
    }
}

export class HeroBuilder extends BaseCostBuilder {
    private _tags: HeroTag[] = [];
    private _maxHp: VersionMap<number> = this._createVersionMap();
    private _maxEnergy: number = 0;
    private _element: ElementType | undefined;
    private _weaponType: WeaponType = WEAPON_TYPE.Other;
    private _skills: SkillBuilder[] = [];
    private _src: string[] = [];
    private _avatar: string[] = [];
    private _normalSkill: NormalSkillBuilder | undefined;
    private _uiMaxEnergy: number | undefined;
    private _updateEnergyIcon: ((hero: GIHero, energyCnt: number) => EnergyIcons) | undefined;
    constructor(shareId?: number) {
        super(shareId ?? -1);
    }
    get notExist() {
        const version = versionWrap(this._curVersion);
        return version.lt(this._version) && version.lt(this._offlineVersion);
    }
    get notInHeroPool() {
        return this._shareId == -1;
    }
    tags(...tags: HeroTag[]) {
        this._tags.push(...tags);
        return this;
    }
    maxHp(maxHp: number, ...version: Version[]) {
        if (version.length == 0) version = ['vlatest'];
        version.forEach(v => this._maxHp.set([v, maxHp]));
        return this;
    }
    spMaxEnergy(maxEnergy: number) {
        this._maxEnergy = -maxEnergy;
        return this;
    }
    monster() {
        this._tags.push(HERO_LOCAL.Monster);
        return this;
    }
    mondstadt() {
        this._tags.push(HERO_LOCAL.Mondstadt);
        return this;
    }
    liyue() {
        this._tags.push(HERO_LOCAL.Liyue);
        return this;
    }
    inazuma() {
        this._tags.push(HERO_LOCAL.Inazuma);
        return this;
    }
    sumeru() {
        this._tags.push(HERO_LOCAL.Sumeru);
        return this;
    }
    fontaine(Arkhe: typeof HERO_LOCAL.ArkheOusia | typeof HERO_LOCAL.ArkhePneuma) {
        this._tags.push(HERO_LOCAL.Fontaine, Arkhe);
        return this;
    }
    natlan() {
        this._tags.push(HERO_LOCAL.Natlan);
        return this;
    }
    snezhnaya() {
        this._tags.push(HERO_LOCAL.Snezhnaya);
        return this;
    }
    fatui() {
        this._tags.push(HERO_LOCAL.Fatui);
        return this;
    }
    eremite() {
        this._tags.push(HERO_LOCAL.Eremite);
        return this;
    }
    hilichurl() {
        this._tags.push(HERO_LOCAL.Monster, HERO_LOCAL.Hilichurl);
        return this;
    }
    consecratedBeast() {
        this._tags.push(HERO_LOCAL.Monster, HERO_LOCAL.ConsecratedBeast);
        return this;
    }
    cosmicCalamity() {
        this._tags.push(HERO_LOCAL.CosmicCalamity);
        return this;
    }
    physical() {
        this._element = ELEMENT_TYPE.Physical;
        return this;
    }
    cryo() {
        this._element = ELEMENT_TYPE.Cryo;
        return this;
    }
    hydro() {
        this._element = ELEMENT_TYPE.Hydro;
        return this;
    }
    pyro() {
        this._element = ELEMENT_TYPE.Pyro;
        return this;
    }
    electro() {
        this._element = ELEMENT_TYPE.Electro;
        return this;
    }
    anemo() {
        this._element = ELEMENT_TYPE.Anemo;
        return this;
    }
    geo() {
        this._element = ELEMENT_TYPE.Geo;
        return this;
    }
    dendro() {
        this._element = ELEMENT_TYPE.Dendro;
        return this;
    }
    /**
     * 弓
     */
    bow() {
        this._weaponType = WEAPON_TYPE.Bow;
        return this;
    }
    /**
     * 法器
     */
    catalyst() {
        this._weaponType = WEAPON_TYPE.Catalyst;
        return this;
    }
    /**
     * 双手剑
     */
    claymore() {
        this._weaponType = WEAPON_TYPE.Claymore;
        return this;
    }
    /**
     * 长柄武器
     */
    polearm() {
        this._weaponType = WEAPON_TYPE.Polearm;
        return this;
    }
    /**
     * 单手剑
     */
    sword() {
        this._weaponType = WEAPON_TYPE.Sword;
        return this;
    }
    normalSkill(normalSkillBuilder: NormalSkillBuilder | string) {
        if (typeof normalSkillBuilder == 'string') this._normalSkill = new NormalSkillBuilder(normalSkillBuilder);
        else this._normalSkill = normalSkillBuilder;
        return this;
    }
    skills(...skills: SkillBuilder[]) {
        this._skills.push(...skills);
        return this;
    }
    src(...src: string[]) {
        this._src.push(...src.filter(v => v != ''));
        return this;
    }
    avatar(...avatar: string[]) {
        this._avatar.push(...avatar.filter(v => v != ''));
        return this;
    }
    uiMaxEnergy(maxEnergy: number) {
        this._uiMaxEnergy = maxEnergy;
        return this;
    }
    updateEnergyIcon(updateEnergyIcon: (hero: GIHero, energyCnt: number) => EnergyIcons) {
        this._updateEnergyIcon = updateEnergyIcon;
        return this;
    }
    get versionChanges() {
        const vchanges = super.versionChanges;
        return [...new Set([...vchanges, ...this._skills.map(skill => skill.versionChanges)].flat())];
    }
    done() {
        const maxHp = this._maxHp.get(this._curVersion, 10);
        const element: ElementType = this._element ?? ELEMENT_CODE_KEY[Math.floor(this._id / 100) % 10 as ElementCode];
        const skills: (SkillBuilder | NormalSkillBuilder)[] = this._skills.slice();
        if (this._normalSkill != undefined) skills.unshift(this._normalSkill.weaponType(this._weaponType));
        return new GIHero(this._id, this._shareId, this._name, this._version, this._curVersion, this._tags,
            maxHp, element, this._weaponType, this._src, this._avatar, this._offlineVersion,
            skills.map((skill, skidx) => skill.costElement(element).id(this._id * 10 + skidx + 1).version(this._curVersion).done()),
            this._maxEnergy, this.versionChanges, this._uiMaxEnergy, this._updateEnergyIcon);
    }
}