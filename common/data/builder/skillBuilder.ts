import { Trigger, VersionWrapper } from "../../../typing.js";
import {
    COST_TYPE, DAMAGE_TYPE, DICE_TYPE, ELEMENT_CODE_KEY, ELEMENT_TYPE, ElementCode, ElementType, SKILL_TYPE, SkillCostType,
    SkillType, STATUS_TYPE, VERSION, Version, WEAPON_TYPE, WEAPON_TYPE_CODE, WeaponType
} from "../../constant/enum.js";
import { ELEMENT_NAME, GUYU_PREIFIX } from "../../constant/UIconst.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { getHidById, versionWrap } from "../../utils/gameUtil.js";
import { clone, convertToArray, isCdt } from "../../utils/utils.js";
import { SkillHandleEvent, SkillHandleRes } from "../skills.js";
import { BaseBuilder, VersionMap } from "./baseBuilder.js";

type SkillBuilderHandleRes = Omit<SkillHandleRes, 'summonTriggers' | 'triggers'> & { summonTriggers?: Trigger | Trigger[], triggers?: Trigger | Trigger[] };

type SkillBuilderHandleEvent = SkillHandleEvent & { cmds: CmdsGenerator, skillAfter: CmdsGenerator, skillBefore: CmdsGenerator };

export class GISkill {
    id: number; // 唯一id
    name: string; // 技能名
    type: SkillType; // 技能类型：0隐藏被动 1普通攻击 2元素战技 3元素爆发 4被动技能 5特技
    damage: number; // 伤害量
    dmgElement: ElementType; // 伤害元素
    cost: [ // 费用列表 [元素骰, 任意骰, 充能]
        { cnt: number, type: SkillCostType },
        { cnt: number, type: typeof DICE_TYPE.Any },
        { cnt: number, type: typeof COST_TYPE.Energy | typeof COST_TYPE.SpEnergy },
    ];
    attachElement: ElementType = ELEMENT_TYPE.Physical; // 附魔属性
    handle: (event: SkillHandleEvent) => SkillHandleRes; // 处理函数
    isForbidden: boolean = false; // 是否禁用
    dmgChange: number = 0; // 伤害变化
    costChange: [number, number, number[], number[][]] = [0, 0, [], []]; // 费用变化 [元素骰, 任意骰, 生效的entityId组, 技能当前被x减费后留存的骰子数]
    useCntPerRound: number = 0; // 本回合技能已使用次数
    perCnt: number = 0; // 每回合使用次数
    useCnt: number = 0; // 整局技能使用次数
    canSelectSummon: -1 | 0 | 1; // 能选择的召唤物 -1不能选择 0能选择敌方 1能选择我方
    canSelectHero: -1 | 0 | 1; // 能选择的角色 -1不能选择 0能选择敌方 1能选择我方
    addition: Record<string, number>; // 额外信息
    UI: {
        src: string, // 图片url
        description: string; // 技能描述
        descriptions: string[], // 处理后的技能描述
        explains: string[], // 要解释的文本
    };
    constructor(
        name: string, description: string, type: SkillType, damage: number, cost: number, costElement?: SkillCostType,
        options: {
            id?: number, ac?: number, ec?: number, de?: ElementType, pct?: number, expl?: string[], ver?: Version,
            canSelectSummon?: -1 | 0 | 1, canSelectHero?: -1 | 0 | 1, adt?: Record<string, number>, spe?: boolean,
        } = {},
        src?: string | string[],
        handle?: (hevent: SkillBuilderHandleEvent, version: VersionWrapper) => SkillBuilderHandleRes | undefined | void
    ) {
        this.name = name;
        this.type = type;
        this.damage = damage;
        const { id = -1, ac = 0, ec = 0, de, pct = 0, expl = [], ver = VERSION[0], adt = {},
            canSelectSummon = -1, canSelectHero = -1, spe = false,
        } = options;
        costElement ??= DICE_TYPE.Same;
        this.dmgElement = de ?? (costElement == DICE_TYPE.Same ? DAMAGE_TYPE.Physical : costElement);
        const hid = getHidById(id);
        description = description
            .replace(/{dealDmg}/g, '造成{dmg}点[elDmg]')
            .replace(/elDmg/g, ELEMENT_NAME[this.dmgElement] + '伤害')
            .replace(/(?<=〖)ski,(.+?)(?=〗)/g, `ski${hid},$1`)
            .replace(/(?<=【)ski,(.+?)(?=】)/g, `ski${hid},$1`);
        this.UI = {
            description,
            src: convertToArray(src).filter(v => v != '').map(v => {
                if (v?.startsWith('#')) {
                    if (v == '#') return `${GUYU_PREIFIX}${id}`;
                    return `${GUYU_PREIFIX}${v.slice(1)}`;
                }
                return v;
            })[0] ?? '',
            explains: [...(description.match(/(?<=【).+?(?=】)/g) ?? []), ...expl],
            descriptions: [],
        };
        this.id = id;
        this.cost = [{ cnt: cost, type: costElement }, { cnt: ac, type: COST_TYPE.Any }, { cnt: ec, type: spe ? COST_TYPE.SpEnergy : COST_TYPE.Energy }];
        this.perCnt = pct;
        this.canSelectSummon = canSelectSummon;
        this.canSelectHero = canSelectHero;
        this.addition = adt;
        this.handle = hevent => {
            const cmds = new CmdsGenerator();
            const skillAfter = new CmdsGenerator();
            const skillBefore = new CmdsGenerator();
            const hbevent: SkillBuilderHandleEvent = { ...hevent, cmds, skillAfter, skillBefore };
            const { reset = false, hero, skill: { id }, isReadySkill = false } = hevent;
            const builderRes = handle?.(hbevent, versionWrap(ver)) ?? {};
            const res: SkillHandleRes = {
                ...builderRes,
                cmds,
                skillAfter,
                skillBefore,
                triggers: isCdt(builderRes.triggers, convertToArray(builderRes.triggers) as Trigger[]),
                summonTriggers: isCdt(builderRes.summonTriggers, convertToArray(builderRes.summonTriggers) as Trigger[]),
            }
            if (isReadySkill) return res;
            const curskill = hero.skills.find(sk => sk.id == id) ?? hero.vehicleSlot?.[1];
            if (!curskill) throw new Error(`@skill_constructor: 未找到技能, skid:${id}, hero:${hero.name}`);
            if (reset) {
                curskill.useCntPerRound = 0;
                curskill.perCnt = pct;
                curskill.addition = adt;
                return {};
            }
            let dmgElement = res.dmgElement;
            let atkOffset = res.atkOffset;
            for (const ist of hero.heroStatus) {
                const event = { ...clone(hevent), hidx: hero.hidx };
                delete event.minusDiceSkill;
                const stsres = ist.handle(ist, event) ?? {};
                if (ist.hasType(STATUS_TYPE.ConditionalEnchant) && stsres.attachEl && this.dmgElement == DAMAGE_TYPE.Physical) {
                    dmgElement = stsres.attachEl;
                }
                if (stsres.atkOffset) atkOffset = stsres.atkOffset;
            }
            return {
                ...res,
                dmgElement,
                atkOffset,
                exec: () => {
                    res.exec?.();
                    ++curskill.useCnt;
                    ++curskill.useCntPerRound;
                }
            }
        }
    }
}

export class SkillBuilder extends BaseBuilder {
    private _name: string = '';
    private _id: number = -1;
    private _type: SkillType = SKILL_TYPE.Passive;
    private _damage: VersionMap<number> = this._createVersionMap();
    private _dmgElement: ElementType | undefined;
    private _cost: VersionMap<number> = this._createVersionMap();
    private _costElement: SkillCostType | undefined;
    private _anyCost: VersionMap<number> = this._createVersionMap();
    private _energyCost: VersionMap<number> = this._createVersionMap();
    private _isSpEnergy: boolean = false;
    private _handle: ((event: SkillBuilderHandleEvent, ver: VersionWrapper) => SkillBuilderHandleRes | undefined | void) | undefined;
    private _perCnt: number = 0;
    private _src: string[] = [];
    private _explains: string[] = [];
    private _readySkillRound: number = 0;
    private _canSelectSummon: -1 | 0 | 1 = -1;
    private _canSelectHero: -1 | 0 | 1 = -1;
    private _addition: Record<string, number> = {};
    constructor(name: string = '') {
        super();
        this._name = name;
    }
    id(id: number) {
        if (this._id == -1) this._id = id;
        return this;
    }
    normal() {
        this._type = SKILL_TYPE.Normal;
        return this;
    }
    elemental() {
        this._type = SKILL_TYPE.Elemental;
        return this;
    }
    burst(energy: number = 0, version: Version = 'vlatest') {
        this._type = SKILL_TYPE.Burst;
        this._energyCost.set([version, energy]);
        return this;
    }
    burstSp(energy: number = 0, version: Version = 'vlatest') {
        this.burst();
        this.energy(energy, true, version);
        return this;
    }
    passive(isHide: boolean = false) {
        this._type = isHide ? SKILL_TYPE.PassiveHidden : SKILL_TYPE.Passive;
        return this;
    }
    readySkill(round: number = 1) {
        if (this._energyCost.get('vlatest', 0) != -3) this._energyCost.set(['vlatest', -2]);
        this.costSame(0);
        this._readySkillRound = round;
        return this;
    }
    vehicle() {
        this._type = SKILL_TYPE.Vehicle;
        this._energyCost.set(['vlatest', -3]);
        return this;
    }
    energy(energy: number, isSp: boolean = false, version: Version = 'vlatest') {
        this._energyCost.set([version, energy]);
        this._isSpEnergy = isSp;
        return this;
    }
    damage(damage: number, version: Version = 'vlatest') {
        this._damage.set([version, damage]);
        return this;
    }
    dmgElement(element: ElementType) {
        if (this._dmgElement == undefined) this._dmgElement = element;
        return this;
    }
    cost(cost: number, version: Version = 'vlatest') {
        this._cost.set([version, cost]);
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
    costHydro(cost: number) {
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
    costAny(cost: number, version: Version = 'vlatest') {
        this._anyCost.set([version, cost]);
        return this;
    }
    handle(handle: ((event: SkillBuilderHandleEvent, ver: VersionWrapper) => SkillBuilderHandleRes | undefined | void) | undefined) {
        this._handle = handle;
        return this;
    }
    perCnt(pct: number) {
        this._perCnt = pct;
        return this;
    }
    src(...srcs: string[]) {
        this._src.push(...srcs.filter(v => v != ''));
        return this;
    }
    explain(...explains: string[]) {
        this._explains = explains;
        return this;
    }
    canSelectSummon(canSelectSummon: 0 | 1) {
        this._canSelectSummon = canSelectSummon;
        return this;
    }
    canSelectHero(canSelectHero: 0 | 1) {
        this._canSelectHero = canSelectHero;
        return this;
    }
    addition(key: string, value: number) {
        this._addition[key] = value;
        return this;
    }
    done() {
        const elCode = this._id.toString().startsWith('313') ? 0 :
            Math.floor(this._id / 1000 / (this._type == SKILL_TYPE.Vehicle ? 10 : 1)) % 10 as ElementCode;
        const element: ElementType = ELEMENT_CODE_KEY[elCode];
        this.costElement(element);
        if (this._costElement == undefined || this._costElement == COST_TYPE.Same) this.dmgElement(element);
        const readySkillDesc = this._readySkillRound > 0 ? `（需准备${this._readySkillRound}个行动轮）；` : '';
        const description = readySkillDesc + this._description.get(this._curVersion, '')
            .replace(/(?<=〖)hro(?=〗)/g, `hro${Math.floor(this._id / 10)}`)
            .replace(/(?<=【)hro(?=】)/g, `hro${Math.floor(this._id / 10)}`);
        const ec = this._energyCost.get(this._curVersion, 0);
        const damage = this._damage.get(this._curVersion, 0);
        const cost = this._cost.get(this._curVersion, 0);
        const anyCost = this._anyCost.get(this._curVersion, 0);
        return new GISkill(this._name, description, this._type, damage, cost, this._costElement,
            {
                id: this._id,
                ac: anyCost,
                ec,
                de: this._dmgElement,
                expl: this._explains,
                pct: this._perCnt,
                ver: this._curVersion,
                canSelectSummon: this._canSelectSummon,
                canSelectHero: this._canSelectHero,
                adt: this._addition,
                spe: this._isSpEnergy,
            },
            this._src, this._handle);
    }

}

export class NormalSkillBuilder extends BaseBuilder {
    private _id: number = -1;
    private _weaponType: WeaponType | undefined;
    private _handle: ((event: SkillBuilderHandleEvent, ver: VersionWrapper) => SkillBuilderHandleRes | undefined) | undefined;
    private _perCnt: number = 0;
    private _anyCost: number = 2;
    private _damage: number = 0;
    private _costElement: ElementType = ELEMENT_TYPE.Physical;
    private _energyCost: number = 0;
    private _isSpEnergy: boolean = false;
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
        super();
        this._builder = new SkillBuilder(name).normal();
    }
    id(id: number) {
        this._id = id;
        this._builder.id(id);
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
    costAny(cost: number) {
        this._anyCost = cost;
        return this;
    }
    costElement(costElement: ElementType) {
        if (this._costElement == ELEMENT_TYPE.Physical) this._costElement = costElement;
        return this;
    }
    damage(damage: number) {
        this._damage = damage;
        return this;
    }
    energy(energy: number, isSp: boolean = false) {
        this._energyCost = energy;
        this._isSpEnergy = isSp;
        return this;
    }
    handle(handle: ((event: SkillBuilderHandleEvent, ver: VersionWrapper) => SkillBuilderHandleRes | undefined)) {
        this._handle = handle;
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
        this.costElement(ELEMENT_CODE_KEY[Math.floor(this._id / 1000) % 10 as ElementCode]);
        const isCatalyst = this._weaponType == WEAPON_TYPE.Catalyst;
        const dmgElement = isCatalyst ? this._costElement : ELEMENT_TYPE.Physical;
        const description = this._description.get(this._curVersion, '');
        return this._builder
            .description(`造成{dmg}点[${ELEMENT_NAME[dmgElement]}伤害]${description.startsWith('，') ? '' : '。'}${description}`)
            .src(this._src[WEAPON_TYPE_CODE[this._weaponType]], this._src2[WEAPON_TYPE_CODE[this._weaponType]])
            .cost(1)
            .costAny(this._anyCost)
            .costElement(this._costElement)
            .energy(this._energyCost, this._isSpEnergy)
            .damage(this._damage || (isCatalyst ? 1 : 2))
            .dmgElement(dmgElement)
            .perCnt(this._perCnt)
            .explain(...this._explains)
            .handle(this._handle)
            .done();
    }
}
