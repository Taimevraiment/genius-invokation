import { Cmds, Summon } from "../../../typing";
import { ELEMENT_TYPE, ElementType, SUMMON_DESTROY_TYPE, SummonDestroyType, VERSION, Version } from "../../constant/enum.js";
import { ELEMENT_NAME } from "../../constant/UIconst.js";
import { getElByHid, getHidById } from "../../utils/gameUtil.js";
import { SummonHandleEvent, SummonHandleRes } from "../summons.js";
import { BaseVersionBuilder } from "./baseBuilder.js";

export class GISummon {
    id: number; // 唯一id
    entityId: number = -1; // 实体id
    name: string; // 名字
    useCnt: number; // 可用次数
    maxUse: number; // 最大次数
    shieldOrHeal: number; // 挡伤量(<0)/回复量(>0)
    damage: number; // 伤害量
    pdmg: number; // 穿透伤害
    element: ElementType; // 伤害元素
    isDestroy: SummonDestroyType; // 是否销毁：0次数用完销毁 1次数用完回合结束时销毁 2回合结束时强制销毁
    perCnt: number; // 每回合次数
    isTalent: boolean; // 是否有天赋
    statusId: number; // 可能对应的状态 -1不存在
    addition: string[]; // 额外信息
    handle: (summon: Summon, event?: SummonHandleEvent) => SummonHandleRes; // 处理函数
    isSelected: boolean = false; // 是否被选择
    canSelect: boolean = false; // 是否能被选择
    UI: {
        src: string; // 图片url
        description: string; // 描述
        descriptions: string[], // 处理后的技能描述
        hasPlus: boolean, // 是否有加号
        isWill: boolean, // 是否为将要生成的召唤物
        explains: string[], // 要解释的文本
    };
    constructor(
        id: number, name: string, description: string, src: string, useCnt: number, maxUse: number,
        shieldOrHeal: number, damage: number, element: ElementType,
        handle?: (summon: Summon, event: SummonHandleEvent, ver: Version) => SummonHandleRes | undefined,
        options: {
            pct?: number, isTalent?: boolean, adt?: string[], pdmg?: number, isDestroy?: SummonDestroyType,
            stsId?: number, spReset?: boolean, expl?: string[], pls?: boolean, ver?: Version,
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.useCnt = useCnt;
        this.maxUse = maxUse;
        this.shieldOrHeal = shieldOrHeal;
        this.damage = damage;
        this.element = element;
        const {
            pct = 0, isTalent = false, adt = [], pdmg = 0, isDestroy = 0, stsId = -1,
            spReset = false, expl = [], pls = false, ver = VERSION[0],
        } = options;
        const hid = getHidById(id);
        this.UI = {
            description: description
                .replace(/{defaultAtk}/, '【结束阶段：】{dealDmg}。；【[可用次数]：{useCnt}】' + (maxUse > useCnt ? `(可叠加，最多叠加到${maxUse}次)` : ''))
                .replace(/{dealDmg}/g, '造成{dmg}点[elDmg]')
                .replace(/elDmg/g, ELEMENT_NAME[element] + '伤害')
                .replace(/(?<=【)hro(?=】)|(?<=〖)hro(?=〗)/g, `hro${hid}`),
            src,
            hasPlus: pls,
            explains: [...(description.match(/(?<=【)[^【】]+\d(?=】)/g) ?? []), ...expl],
            isWill: false,
            descriptions: [],
        }
        this.perCnt = pct;
        this.isTalent = isTalent;
        this.addition = adt;
        this.pdmg = pdmg;
        this.isDestroy = isDestroy;
        this.statusId = stsId;
        this.handle = (summon, event = {}) => {
            const { reset = false } = event;
            if (reset) {
                summon.perCnt = pct;
                if (!spReset) return {}
            }
            if (handle) return handle(summon, event, ver) ?? {};
            return {
                trigger: ['phase-end'],
                exec: execEvent => phaseEndAtk(execEvent.summon ?? summon),
            }
        };
    }
    setEntityId(id: number): Summon {
        if (this.entityId == -1) this.entityId = id;
        return this;
    }
}

export const phaseEndAtk = (summon: Summon, healHidxs?: number[]): SummonHandleRes => {
    if (summon.isDestroy == 0) summon.useCnt = Math.max(0, summon.useCnt - 1);
    const cmds: Cmds[] = [];
    if (summon.damage > 0) cmds.push({ cmd: 'attack' });
    if (summon.shieldOrHeal > 0) cmds.push({ cmd: 'heal', hidxs: healHidxs });
    return { cmds }
}

export class SummonBuilder extends BaseVersionBuilder {
    private _id: number = -1;
    private _name: string;
    private _description: [Version, string][] = [];
    private _src: string = '';
    private _useCnt: number = 0;
    private _maxUse: number = 0;
    private _shieldOrHeal: number = 0;
    private _damage: [Version, number][] = [];
    private _pdmg: number = 0;
    private _element: ElementType | undefined;
    private _perCnt: number = 0;
    private _isTalent: boolean = false;
    private _addition: string[] = [];
    private _isDestroy: SummonDestroyType = SUMMON_DESTROY_TYPE.Used;
    private _statusId: number = -1;
    private _hasPlus: boolean = false;
    private _explains: string[] = [];
    private _spReset: boolean = false;
    private _handle: ((summon: Summon, event: SummonHandleEvent, ver: Version) => SummonHandleRes | undefined) | undefined;
    constructor(name: string) {
        super();
        this._name = name;
    }
    id(id: number) {
        this._id = id;
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
    useCnt(useCnt: number) {
        this._useCnt = useCnt;
        return this;
    }
    maxUse(maxUse: number) {
        this._maxUse = maxUse;
        return this;
    }
    shield(shield: number) {
        this._shieldOrHeal = -shield;
        return this;
    }
    heal(heal: number) {
        this._shieldOrHeal = heal;
        return this;
    }
    damage(damage: number, version: Version = VERSION[0]) {
        this._damage.push([version, damage]);
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
    pdmg(pdmg: number) {
        this._pdmg = pdmg;
        return this;
    }
    perCnt(perCnt: number) {
        this._perCnt = perCnt;
        return this;
    }
    talent(isTalent: boolean) {
        this._isTalent = isTalent;
        return this;
    }
    addition(...addition: string[]) {
        this._addition.push(...addition);
        return this;
    }
    statusId(stsId?: number) {
        this._statusId = stsId ?? -2;
        return this;
    }
    plus() {
        this._hasPlus = true;
        return this;
    }
    explains(...explains: string[]) {
        this._explains.push(...explains);
        return this;
    }
    spReset() {
        this._spReset = true;
        return this;
    }
    used() {
        this._isDestroy = SUMMON_DESTROY_TYPE.Used;
        return this;
    }
    roundEnd() {
        this._isDestroy = SUMMON_DESTROY_TYPE.RoundEnd;
        return this;
    }
    usedRoundEnd() {
        this._isDestroy = SUMMON_DESTROY_TYPE.UsedRoundEnd;
        return this;
    }
    handle(handle: (summon: Summon, event: SummonHandleEvent, ver: Version) => SummonHandleRes) {
        this._handle = handle;
        return this;
    }
    done() {
        const maxUse = this._maxUse || this._useCnt;
        const description = this._getValByVersion(this._description, '');
        const element = this._element ?? getElByHid(getHidById(this._id));
        const damage = this._getValByVersion(this._damage, 0);
        const stsId = this._statusId == -2 ? this._id : this._statusId;
        return new GISummon(this._id, this._name, description, this._src, this._useCnt, maxUse,
            this._shieldOrHeal, damage, element, this._handle,
            {
                pct: this._perCnt,
                isTalent: this._isTalent,
                adt: this._addition,
                pdmg: this._pdmg,
                isDestroy: this._isDestroy,
                stsId,
                spReset: this._spReset,
                expl: this._explains,
                pls: this._hasPlus,
                ver: this._version,
            }
        )
    }
}