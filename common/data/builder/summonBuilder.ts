import { Cmds, Summon, Trigger, VersionCompareFn } from "../../../typing";
import { ELEMENT_TYPE, ElementType, SUMMON_DESTROY_TYPE, SummonDestroyType, VERSION, Version } from "../../constant/enum.js";
import { MAX_USE_COUNT } from "../../constant/gameOption.js";
import { ELEMENT_NAME } from "../../constant/UIconst.js";
import { compareVersionFn, getElByHid, getHidById } from "../../utils/gameUtil.js";
import { SummonHandleEvent, SummonHandleRes } from "../summons.js";
import { BaseBuilder, VersionMap } from "./baseBuilder.js";

type SummonBuilderHandleRes = Omit<SummonHandleRes, 'triggers'> & { triggers?: Trigger | Trigger[] };

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
    addition: any[]; // 额外信息
    handle: (summon: Summon, event?: SummonHandleEvent) => SummonHandleRes; // 处理函数
    UI: {
        src: string; // 图片url
        description: string; // 描述
        descriptions: string[], // 处理后的技能描述
        icon: string, // 右上角图标
        hasPlus: boolean, // 是否有加号
        isWill: boolean, // 是否为将要生成的召唤物
        explains: string[], // 要解释的文本
    };
    constructor(
        id: number, name: string, description: string, src: string, useCnt: number, maxUse: number,
        shieldOrHeal: number, damage: number, element: ElementType,
        handle?: (summon: Summon, event: SummonHandleEvent, ver: VersionCompareFn) => SummonBuilderHandleRes | undefined,
        options: {
            pct?: number, isTalent?: boolean, adt?: any[], pdmg?: number, isDestroy?: SummonDestroyType,
            stsId?: number, spReset?: boolean, expl?: string[], icon?: string, pls?: boolean, ver?: Version,
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
            spReset = false, expl = [], icon = '', pls = false, ver = VERSION[0],
        } = options;
        const hid = getHidById(id);
        this.UI = {
            description: description
                .replace(/{([^\{\}]*)defaultAtk((?:\{.+\}|[^\{\}])*)}/, '【结束阶段：】$1{dealDmg}$2；[useCnt]')
                .replace(/\[useCnt\]/, '【[可用次数]：{useCnt}】' + (maxUse > useCnt ? `（可叠加，${maxUse == MAX_USE_COUNT ? '没有上限' : `最多叠加到${maxUse}次`}）` : ''))
                .replace(/{dealDmg}/g, '造成{dmg}点[elDmg]')
                .replace(/elDmg/g, ELEMENT_NAME[element] + '伤害')
                .replace(/(?<=〖)hro(?=〗)/g, `hro${hid}`)
                .replace(/(?<=【)hro(?=】)/g, `hro${hid}`),
            src,
            icon,
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
        if (this.UI.src == '#') this.UI.src = `https://gi-tcg-assets.guyutongxue.site/api/v2/images/${id}`;
        this.handle = (summon, event = {}) => {
            const { reset, trigger } = event;
            if (reset) {
                summon.perCnt = pct;
                if (!spReset && trigger != 'enter') return {}
            }
            if (!handle) {
                return {
                    triggers: ['phase-end'],
                    exec: execEvent => (execEvent.summon ?? summon).phaseEndAtk(event),
                }
            }
            const builderRes = handle(summon, event, compareVersionFn(ver)) ?? {};
            const res: SummonHandleRes = {
                ...builderRes,
                triggers: Array.isArray(builderRes.triggers) ? builderRes.triggers : builderRes.triggers ? [builderRes.triggers] : undefined,
            }
            return res;
        };
    }
    setEntityId(id: number): Summon {
        this.entityId = id;
        return this;
    }
    phaseEndAtk(event: SummonHandleEvent, healHidxs?: number[]): SummonHandleRes {
        if (this.isDestroy == SUMMON_DESTROY_TYPE.Used) this.minusUseCnt();
        else if (!event.isExec) this.useCnt = -100;
        const cmds: Cmds[] = [];
        if (this.damage >= 0) cmds.push({ cmd: 'attack' });
        if (this.shieldOrHeal > 0) cmds.push({ cmd: 'heal', hidxs: healHidxs });
        return { cmds }
    }
    addUseCnt(ignoreMax: boolean): void
    addUseCnt(n?: number, ignoreMax?: boolean): void
    addUseCnt(n: number | boolean = 1, ignoreMax: boolean = false) {
        if (typeof n == 'boolean' && n) ++this.useCnt;
        else {
            if (n == false) n = 1;
            if (ignoreMax) this.useCnt += n;
            else this.useCnt = Math.max(this.useCnt, Math.min(this.maxUse, this.useCnt + n));
        }
    }
    minusUseCnt(n: number = 1) {
        this.useCnt = Math.max(0, this.useCnt - n);
    }
    addPerCnt(n: number = 1) {
        this.perCnt += n;
    }
    minusPerCnt(n: number = 1) {
        this.perCnt = Math.max(0, this.perCnt - n);
    }
    dispose(isExec: boolean = true) {
        if (isExec) {
            this.isDestroy = SUMMON_DESTROY_TYPE.Used;
            this.useCnt = 0;
        } else {
            this.useCnt = -100;
        }
    }
}

export class SummonBuilder extends BaseBuilder {
    private _id: number = -1;
    private _name: string;
    private _src: string = '';
    private _useCnt: VersionMap<number> = new VersionMap();
    private _maxUse: VersionMap<number> = new VersionMap();
    private _shieldOrHeal: number = 0;
    private _damage: VersionMap<number> = new VersionMap();
    private _pdmg: number = 0;
    private _element: ElementType | undefined;
    private _perCnt: VersionMap<number> = new VersionMap();
    private _isTalent: boolean = false;
    private _addition: any[] = [];
    private _isDestroy: SummonDestroyType = SUMMON_DESTROY_TYPE.Used;
    private _statusId: number = -1;
    private _icon: string = 'TimeState';
    private _hasPlus: boolean = false;
    private _explains: string[] = [];
    private _spReset: boolean = false;
    private _handle: ((summon: Summon, event: SummonHandleEvent, ver: VersionCompareFn) => SummonBuilderHandleRes | undefined) | undefined;
    constructor(name: string) {
        super();
        this._name = name;
    }
    id(id: number) {
        this._id = id;
        return this;
    }
    src(src: string) {
        this._src = src;
        return this;
    }
    useCnt(useCnt: number, version: Version = 'vlatest') {
        this._useCnt.set([version, useCnt]);
        return this;
    }
    maxUse(maxUse: number, version: Version = 'vlatest') {
        this._maxUse.set([version, maxUse]);
        return this;
    }
    shield(shield: number) {
        this._shieldOrHeal = -shield;
        this._icon = 'Barrier';
        return this;
    }
    heal(heal: number) {
        this._shieldOrHeal = heal;
        return this;
    }
    damage(damage: number, version: Version = 'vlatest') {
        this._damage.set([version, damage]);
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
    perCnt(perCnt: number, version: Version = 'vlatest') {
        this._perCnt.set([version, perCnt]);
        return this;
    }
    talent(isTalent: boolean) {
        this._isTalent = isTalent;
        return this;
    }
    addition(...addition: any[]) {
        this._addition.push(...addition);
        return this;
    }
    statusId(stsId?: number) {
        this._statusId = stsId ?? -2;
        return this;
    }
    collection() {
        this._icon = 'Counter';
        return this;
    }
    plus(plus: boolean = true) {
        this._hasPlus = plus;
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
    handle(handle: (summon: Summon, event: SummonHandleEvent, ver: VersionCompareFn) => SummonBuilderHandleRes | undefined) {
        this._handle = handle;
        return this;
    }
    done() {
        const useCnt = this._useCnt.get(this._curVersion, 0);
        const maxUse = this._maxUse.get(this._curVersion, 0) || useCnt;
        const description = this._description.get(this._curVersion, '');
        const element = this._element ?? getElByHid(getHidById(this._id));
        const perCnt = this._perCnt.get(this._curVersion, 0);
        const damage = this._damage.get(this._curVersion, -1);
        const stsId = this._statusId == -2 ? this._id : this._statusId;
        return new GISummon(this._id, this._name, description, this._src, useCnt, maxUse,
            this._shieldOrHeal, damage, element, this._handle,
            {
                pct: perCnt,
                isTalent: this._isTalent,
                adt: this._addition,
                pdmg: this._pdmg,
                isDestroy: this._isDestroy,
                stsId,
                spReset: this._spReset,
                expl: this._explains,
                icon: this._icon,
                pls: this._hasPlus,
                ver: this._curVersion,
            }
        )
    }
}