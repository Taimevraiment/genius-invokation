import { Card, Skill, Status } from "../../../typing";
import { ELEMENT_CODE_KEY, ELEMENT_TYPE, ElementCode, ElementType, HERO_LOCAL, HeroTag, PureElementType, SKILL_TYPE, Version, WEAPON_TYPE, WeaponType } from "../../constant/enum.js";
import { BaseBuilder } from "./baseBuilder.js";
import { GISkill, NormalSkillBuilder, SkillBuilder } from "./skillBuilder";

export class GIHero {
    id: number; // 唯一id
    shareId: number; // 分享码id
    entityId: number = -1; // 实体id
    name: string; // 角色名
    version: Version; // 加入的版本
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
    artifactSlot: Card | null = null; // 圣遗物栏
    talentSlot: Card | null = null; // 天赋栏
    heroStatus: Status[] = []; // 角色状态
    isFront: boolean = false; // 是否为前台角色
    attachElement: PureElementType[] = []; // 附着元素
    // canSelect: boolean = false; // 是否能被选择
    // isSelected: number = 0; // 是否被选择 0未被选择 1被选为一号位 2被选为二号位
    UI: {
        src: string, // 立绘url
        srcs: string[], // 所有立绘url
        avatar: string, // 头像url
        avatars: string[], // 所有头像url
        isActive: boolean, // 是否发光
    };
    constructor(
        id: number, shareId: number, name: string, version: Version, tags: HeroTag | HeroTag[], maxHp: number, element: ElementType,
        weaponType: WeaponType, src: string | string[], avatar: string | string[], skills: GISkill[] = [],
    ) {
        this.id = id;
        this.shareId = shareId;
        this.name = name;
        this.version = version;
        if (Array.isArray(tags)) this.tags = tags;
        else this.tags = [tags];
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.element = element;
        this.weaponType = weaponType;
        src = Array.isArray(src) ? src : [src];
        avatar = Array.isArray(avatar) ? avatar : [avatar];
        this.UI = {
            src: src[0],
            srcs: src,
            avatar: avatar[0],
            avatars: avatar,
            isActive: false,
        }
        this.skills.push(...skills);
        this.maxEnergy = this.skills.find(s => s.type == SKILL_TYPE.Burst)?.cost[2].cnt ?? 0;
    }
}

export class HeroBuilder extends BaseBuilder {
    private _tags: HeroTag[] = [];
    private _maxHp: [Version, number][] = [];
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
        return this._version > this._curVersion;
    }
    get notInHeroPool() {
        return this._shareId == -1;
    }
    tags(...tags: HeroTag[]) {
        this._tags.push(...tags);
        return this;
    }
    maxHp(maxHp: number, version: Version = 'vlatest') {
        this._maxHp.push([version, maxHp]);
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
    fontaine() {
        this._tags.push(HERO_LOCAL.Fontaine);
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
    bow() {
        this._weaponType = WEAPON_TYPE.Bow;
        return this;
    }
    catalyst() {
        this._weaponType = WEAPON_TYPE.Catalyst;
        return this;
    }
    claymore() {
        this._weaponType = WEAPON_TYPE.Claymore;
        return this;
    }
    polearm() {
        this._weaponType = WEAPON_TYPE.Polearm;
        return this;
    }
    sword() {
        this._weaponType = WEAPON_TYPE.Sword;
        return this;
    }
    normalSkill(normalSkillBuilder: NormalSkillBuilder) {
        this._normalSkill = normalSkillBuilder.version(this._version);
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
    done() {
        const maxHp = this._getValByVersion(this._maxHp, 10);
        const element: ElementType = this._element ?? ELEMENT_CODE_KEY[Math.floor(this._id / 100) % 10 as ElementCode];
        const skills: (SkillBuilder | NormalSkillBuilder)[] = this._skills.map(skill => skill.costElement(element));
        if (this._normalSkill != undefined) skills.unshift(this._normalSkill.weaponType(this._weaponType).costElement(element));
        return new GIHero(this._id, this._shareId, this._name, this._version, this._tags,
            maxHp, element, this._weaponType, this._src, this._avatar,
            skills.map((skill, skidx) => skill.id(this._id * 10 + skidx + 1).version(this._curVersion).done()));
    }
}