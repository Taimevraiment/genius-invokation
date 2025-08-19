import { Card, Skill } from "../../../typing";
import { ELEMENT_CODE_KEY, ELEMENT_TYPE, ElementCode, ElementType, HERO_LOCAL, HeroTag, OfflineVersion, OnlineVersion, PureElementType, SKILL_TYPE, Version, WEAPON_TYPE, WeaponType } from "../../constant/enum.js";
import { versionWrap } from "../../utils/gameUtil.js";
import { convertToArray } from "../../utils/utils.js";
import { BaseCostBuilder, VersionMap } from "./baseBuilder.js";
import { GISkill, NormalSkillBuilder, SkillBuilder } from "./skillBuilder.js";
import { ArrayStatus } from "./statusBuilder.js";

export class GIHero {
    id: number; // 唯一id
    shareId: number; // 分享码id
    entityId: number = -1; // 实体id
    name: string; // 角色名
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
    UI: {
        src: string, // 立绘url
        srcs: string[], // 所有立绘url
        avatar: string, // 头像url
        avatars: string[], // 所有头像url
        isActive: boolean, // 是否发光
        curVersion: Version, // 当前版本
        versionChanges: Version[], // 版本变更
    };
    constructor(
        id: number, shareId: number, name: string, version: OnlineVersion, curVersion: Version, tags: HeroTag | HeroTag[], maxHp: number, element: ElementType,
        weaponType: WeaponType, src: string | string[], avatar: string | string[], offlineVersion: OfflineVersion | null = null,
        skills: GISkill[] = [], maxEnergy: number = 0, versionChanges: Version[] = [],
    ) {
        this.id = id;
        this.shareId = shareId;
        this.name = name;
        this.sinceVersion = version;
        this.tags = convertToArray(tags);
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.element = element;
        this.weaponType = weaponType;
        src = convertToArray(src);
        avatar = convertToArray(avatar);
        this.UI = {
            src: src[0],
            srcs: src,
            avatar: avatar[0],
            avatars: avatar,
            isActive: false,
            curVersion,
            versionChanges,
        }
        this.skills.push(...skills);
        this.maxEnergy = maxEnergy || (this.skills.find(s => s.type == SKILL_TYPE.Burst)?.cost[2].cnt ?? 0);
        this.offlineVersion = offlineVersion;
    }
    get equipments(): Card[] {
        const slots = [this.weaponSlot, this.relicSlot, this.talentSlot, this.vehicleSlot?.[0] ?? null].filter(s => s != null) as Card[];
        return slots.sort((a, b) => b.entityId - a.entityId);
    }
}

export class ArrayHero extends Array<GIHero> {
    constructor(...args: any[]) {
        super(...args);
    }
    get frontHidx() {
        return this.findIndex(h => h.isFront);
    }
    // 获取所有存活/死亡角色的索引hidx
    allHidxs(options: { isDie?: boolean, isAll?: boolean, exclude?: number, cdt?: (h: GIHero) => boolean, limit?: number } = {}) {
        const { isDie = false, isAll = false, cdt = () => true, limit = -1, exclude = -1 } = options;
        if (this.frontHidx == -1 || limit == 0) return [];
        const hidxs: number[] = [];
        for (let i = 0; i < this.length; ++i) {
            const hi = (this.frontHidx + i) % this.length;
            const h = this[hi];
            if (isAll || ((isDie ? h.hp <= 0 : h.hp > 0) && exclude != hi && cdt(h))) {
                hidxs.push(hi);
                if (hidxs.length == limit) break;
            }
        }
        return hidxs;
    }
    // 获得出战角色(或按出战顺序前/后的角色)
    getFront(options: { offset?: number, isAll?: boolean } = {}) {
        const { offset = 0, isAll } = options;
        const aliveHidxs = this.allHidxs({ isAll });
        const fidx = aliveHidxs.findIndex(i => i == this.frontHidx);
        if (fidx == -1) return;
        return this[aliveHidxs[(fidx + offset + aliveHidxs.length) % aliveHidxs.length]];
    }
    // 获得距离出战角色最近的hidx
    getNearestHidx(hidx: number = -1) {
        if (hidx == -1) return -1;
        const livehidxs = this.allHidxs();
        let minDistance = livehidxs.length;
        let hidxs: number[] = [];
        for (const hi of livehidxs) {
            const distance = Math.min(Math.abs(hi - hidx), hi + this.length - hidx);
            if (distance == 0) return hi;
            if (distance == minDistance) hidxs.push(hi);
            else if (distance < minDistance) {
                minDistance = distance;
                hidxs = [hi];
            }
        }
        if (hidxs.length == 0) return -1;
        return Math.min(...hidxs);
    }
    // 获取受伤最多的角色的hidxs(最多一个number的数组)
    getMaxHertHidxs(options: { isBack?: boolean } = {}) {
        const { isBack = false } = options;
        if (this.frontHidx == -1) return [];
        const maxHert = Math.max(...this.filter(h => h.hp > 0 && (!isBack || !h.isFront)).map(h => h.maxHp - h.hp));
        if (maxHert == 0) return [];
        const hidxs: number[] = [];
        for (let i = +isBack; i < this.length; ++i) {
            const hidx = (i + this.frontHidx) % this.length;
            const hert = this[hidx].maxHp - this[hidx].hp;
            if (this[hidx].hp > 0 && hert == maxHert) {
                hidxs.push(hidx);
                break;
            }
        }
        return hidxs;
    }
    // 获取受伤最少的角色的hidx(最多一个number的数组)
    getMinHertHidxs() {
        if (this.frontHidx == -1) return [];
        const minHert = Math.min(...this.filter(h => h.hp > 0).map(h => h.maxHp - h.hp));
        const hidxs: number[] = [];
        for (let i = 0; i < this.length; ++i) {
            const hidx = (i + this.frontHidx) % this.length;
            const hert = this[hidx].maxHp - this[hidx].hp;
            if (this[hidx].hp > 0 && hert == minHert) {
                hidxs.push(hidx);
                break;
            }
        }
        return hidxs;
    }
    // 获取生命值最低角色的hidx(只有一个number的数组)
    getMinHpHidxs() {
        if (this.frontHidx == -1) return [];
        const minHp = Math.min(...this.filter(h => h.hp > 0).map(h => h.hp));
        const hidxs: number[] = [];
        for (let i = 0; i < this.length; ++i) {
            const hidx = (i + this.frontHidx) % this.length;
            if (this[hidx].hp == minHp) {
                hidxs.push(hidx);
                break;
            }
        }
        return hidxs;
    }
    // 获得所有后台角色hidx
    getBackHidxs(limit?: number) {
        return this.allHidxs({ exclude: this.frontHidx, limit });
    }
    // 获得下一个后台角色hidx(只有一个number的数组)
    getNextBackHidx() {
        return this.getBackHidxs(1);
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
            this._maxEnergy, this.versionChanges);
    }
}