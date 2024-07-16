import { COST_TYPE, DAMAGE_TYPE, DICE_TYPE, ELEMENT_TYPE, ElementType, SKILL_TYPE, SkillCostType, SkillType, STATUS_TYPE, VERSION, Version, WEAPON_TYPE, WEAPON_TYPE_CODE, WeaponType } from "../../constant/enum.js";
import { ELEMENT_NAME } from "../../constant/UIconst.js";
import { clone } from "../../utils/utils.js";
import { SkillHandleEvent, SkillHandleRes } from "../heros.js";
import { BaseVersionBuilder } from "./baseBuilder.js";

export class GISkill {
    id: number = -1; // 唯一id
    name: string; // 技能名
    type: SkillType; // 技能类型：1普通攻击 2元素战技 3元素爆发 4被动技能
    damage: number; // 伤害量
    dmgElement: ElementType; // 伤害元素
    cost: [ // 费用列表 [元素骰, 任意骰, 充能]
        { cnt: number, type: SkillCostType },
        { cnt: number, type: typeof DICE_TYPE.Any },
        { cnt: number, type: typeof COST_TYPE.Energy },
    ];
    attachElement: ElementType = ELEMENT_TYPE.Physical; // 附魔属性
    handle: (event: SkillHandleEvent) => SkillHandleRes; // 处理函数
    isForbidden: boolean = false; // 是否禁用
    dmgChange: number = 0; // 伤害变化
    costChange: [number, number, number[]] = [0, 0, []]; // 费用变化 [元素骰, 任意骰, 生效的entityId组]
    useCntPerRound: number = 0; // 本回合技能已使用次数
    perCnt: number = 0; // 每回合使用次数
    useCnt: number = 0; // 整局技能使用次数
    rskid: number = -1; // 准备技能的id
    UI: {
        src: string, // 图片url
        description: string; // 技能描述
        descriptions: string[], // 处理后的技能描述
        explains: string[], // 要解释的文本
    };
    constructor(
        name: string, description: string, type: SkillType, damage: number, cost: number, costElement?: SkillCostType,
        options: { id?: number, ac?: number, ec?: number, de?: ElementType, rskid?: number, pct?: number, expl?: string[], ver?: Version } = {},
        src?: string | string[], handle?: (hevent: SkillHandleEvent, version: Version) => SkillHandleRes | undefined
    ) {
        this.name = name;
        this.type = type;
        this.damage = damage;
        const { id = -1, ac = 0, ec = 0, de, rskid = -1, pct = 0, expl = [], ver = VERSION[0] } = options;
        costElement ??= DICE_TYPE.Same;
        this.dmgElement = de ?? (costElement == DICE_TYPE.Same ? DAMAGE_TYPE.Physical : costElement);
        this.UI = {
            description: description.replace(/{dealDmg}/g, '造成{dmg}点[elDmg]').replace(/elDmg/g, ELEMENT_NAME[this.dmgElement] + '伤害'),
            src: (Array.isArray(src) ? src : [src]).filter(v => v != '')[0] ?? '',
            explains: [...(description.match(/(?<=【)[^【】]+(?=】)/g) ?? []), ...expl],
            descriptions: [],
        };
        if (id > -1) this.id = id;
        this.rskid = rskid;
        this.cost = [{ cnt: cost, type: costElement }, { cnt: ac, type: COST_TYPE.Any }, { cnt: ec, type: COST_TYPE.Energy }];
        this.perCnt = pct;
        this.handle = hevent => {
            const { reset = false, heros = [], hero, skidx, isReadySkill = false } = hevent;
            const handleres = handle?.(hevent, ver) ?? {};
            if (isReadySkill) return handleres;
            const curskill = hero.skills[skidx];
            if (reset) {
                curskill.useCntPerRound = 0;
                curskill.perCnt = pct;
                return {}
            }
            let dmgElement = handleres.dmgElement;
            let atkOffset = handleres.atkOffset;
            for (const ist of hero.heroStatus) {
                const event = { ...clone(hevent), hidx: heros.findIndex(h => h.id == hero.id) };
                delete event.minusDiceSkill;
                const stsres = ist.handle(ist, event) ?? {};
                if (ist.hasType(STATUS_TYPE.ConditionalEnchant) && stsres.attachEl && dmgElement == DAMAGE_TYPE.Physical) {
                    dmgElement = stsres.attachEl;
                }
                if (stsres.atkOffset) atkOffset = stsres.atkOffset;
            }
            return {
                ...handleres,
                dmgElement,
                atkOffset,
                exec: () => {
                    handleres.exec?.();
                    ++curskill.useCnt;
                    ++curskill.useCntPerRound;
                }
            }
        }
    }
}

export class SkillBuilder extends BaseVersionBuilder {
    private _name: string = '';
    private _type: SkillType = SKILL_TYPE.Passive;
    private _damage: [Version, number][] = [];
    private _dmgElement: ElementType | undefined;
    private _cost: number = 0;
    private _costElement: SkillCostType | undefined;
    private _anyCost: number = 0;
    private _energyCost: [Version, number][] = [];
    private _handle: ((event: SkillHandleEvent, ver: Version) => SkillHandleRes) | undefined;
    private _perCnt: number = 0;
    private _rskidx: number = -1;
    private _src: string[] = [];
    private _description: string = '';
    private _explains: string[] = [];
    constructor(name: string) {
        super();
        this._name = name;
    }
    normal() {
        this._type = SKILL_TYPE.Normal;
        return this;
    }
    elemental() {
        this._type = SKILL_TYPE.Elemental;
        return this;
    }
    burst(energy: number, version: Version = VERSION[0]) {
        this._type = SKILL_TYPE.Burst;
        this._energyCost.push([version, energy]);
        return this;
    }
    damage(damage: number, version: Version = VERSION[0]) {
        this._damage.push([version, damage]);
        return this;
    }
    dmgElement(element: ElementType) {
        if (this._dmgElement == undefined) this._dmgElement = element;
        return this;
    }
    cost(cost: number, element?: SkillCostType) {
        this._cost = cost;
        if (element != undefined) this._costElement = element;
        return this;
    }
    costElement(element: ElementType) {
        if (this._costElement == undefined) {
            if (element == ELEMENT_TYPE.Physical) this._costElement = DICE_TYPE.Same;
            else this._costElement = element;
        }
        return this;
    }
    costCryo(cost: number) {
        return this.cost(cost).costElement(DICE_TYPE.Cryo);
    }
    costHydor(cost: number) {
        return this.cost(cost).costElement(DICE_TYPE.Hydro);
    }
    costPyro(cost: number) {
        return this.cost(cost).costElement(DICE_TYPE.Pyro);
    }
    costElectro(cost: number) {
        return this.cost(cost).costElement(DICE_TYPE.Electro);
    }
    costAnemo(cost: number) {
        return this.cost(cost).costElement(DICE_TYPE.Anemo);
    }
    costGeo(cost: number) {
        return this.cost(cost).costElement(DICE_TYPE.Geo);
    }
    costDendro(cost: number) {
        return this.cost(cost).costElement(DICE_TYPE.Dendro);
    }
    costSame(cost: number) {
        return this.cost(cost).costElement(ELEMENT_TYPE.Physical);
    }
    costAny(cost: number) {
        this._anyCost = cost;
        return this;
    }
    handle(handle: ((event: SkillHandleEvent, ver: Version) => SkillHandleRes) | undefined) {
        this._handle = handle;
        return this;
    }
    perCnt(pct: number) {
        this._perCnt = pct;
        return this;
    }
    rskidx(rskidx: number) {
        this._rskidx = rskidx;
        return this;
    }
    src(...srcs: string[]) {
        this._src.push(...srcs.filter(v => v != ''));
        return this;
    }
    description(description: string) {
        this._description = description;
        return this;
    }
    explain(explains: string[]) {
        this._explains = explains;
        return this;
    }
    done() {
        const ec = this._getValByVersion(this._energyCost, 0);
        const damage = this._getValByVersion(this._damage, 0);
        return new GISkill(this._name, this._description, this._type, damage, this._cost, this._costElement,
            {
                ac: this._anyCost,
                ec,
                de: this._dmgElement,
                expl: this._explains,
                pct: this._perCnt,
                rskid: this._rskidx,
                ver: this._version,
            },
            this._src, this._handle);
    }

}

export class Skill1Builder {
    private _weaponType: WeaponType | undefined;
    private _handle: ((event: SkillHandleEvent) => SkillHandleRes) | undefined;
    private _description: string = '';
    private _perCnt: number = 0;
    private _costElement: ElementType = ELEMENT_TYPE.Physical;
    private _explains: string[] = [];
    private _builder: SkillBuilder;
    private _src: string[] = [
        'https://patchwiki.biligame.com/images/ys/9/9c/occv1a1p5dow2oo7ge2mrnx3wkeuwls.png',
        'https://patchwiki.biligame.com/images/ys/a/a8/brgaa29n63j4fkh74sc2vx8ja8qvzhp.png',
        'https://patchwiki.biligame.com/images/ys/4/4b/9lnhohp6ls5szxul5egwal8mlegq64w.png',
        'https://patchwiki.biligame.com/images/ys/9/9c/sd9tso1r747k73jkpljqos0ahy03pow.png',
        'https://patchwiki.biligame.com/images/ys/6/63/ow012uhlpkdmn4rflhm1avvbf3cjvpu.png',
        'https://patchwiki.biligame.com/images/ys/f/f1/96gt1watdz1lcoqqgqsv0qio44wo50h.png',
    ];
    private _src2: string[] = [
        'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/726f23517c8595c477dd65c987b42482_2398074192370829528.png',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/54dd31a9c0a4417ca4b5463532d7f5e8_811908281150698503.png',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/11/24/12109492/949d07ba4f72b33b739fb0ed413a7fa2_29820066415359915.png',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/fc4695c7947675242718788122db81d3_5540544149749295930.png',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/11/27/12109492/0cd68ecb1a011d94e2b4be1b99ac3302_8062496215333431665.png',
        'https://uploadstatic.mihoyo.com/ys-obc/2022/11/26/12109492/2bfbf024135461849666339c43d60b2c_1257931966790216673.png',
    ];
    constructor(name: string) {
        this._builder = new SkillBuilder(name).normal().costAny(2);
    }
    version(version: Version) {
        this._builder.version(version);
        return this;
    }
    weaponType(weaponType: WeaponType) {
        this._weaponType ??= weaponType;
        return this;
    }
    catalyst() {
        this._weaponType = WEAPON_TYPE.Catalyst;
        return this;
    }
    costElement(costElement: ElementType) {
        this._costElement = costElement;
        return this;
    }
    description(description: string) {
        this._description = description;
        return this;
    }
    perCnt(pct: number) {
        this._perCnt = pct;
        return this;
    }
    explain(...explains: string[]) {
        this._explains.push(...explains);
        return this;
    }
    done() {
        this._weaponType ??= WEAPON_TYPE.Other;
        const costElement = this._costElement == ELEMENT_TYPE.Physical ? DICE_TYPE.Same : this._costElement;
        const isCatalyst = this._weaponType == WEAPON_TYPE.Catalyst;
        const dmgElement = isCatalyst ? this._costElement : ELEMENT_TYPE.Physical;
        return this._builder
            .description(`造成{dmg}点[${ELEMENT_NAME[dmgElement]}伤害]。${this._description}`)
            .src(this._src[WEAPON_TYPE_CODE[this._weaponType]], this._src2[WEAPON_TYPE_CODE[this._weaponType]])
            .cost(1, costElement)
            .damage(isCatalyst ? 1 : 2)
            .dmgElement(dmgElement)
            .perCnt(this._perCnt)
            .explain(this._explains)
            .handle(this._handle)
            .done();
    }
}
