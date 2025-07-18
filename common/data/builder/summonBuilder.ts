import { Summon, Trigger, VersionWrapper } from "../../../typing";
import { ELEMENT_TYPE, ElementType, SUMMON_DESTROY_TYPE, SummonDestroyType, VERSION, Version } from "../../constant/enum.js";
import { MAX_USE_COUNT } from "../../constant/gameOption.js";
import { ELEMENT_NAME, GUYU_PREIFIX } from "../../constant/UIconst.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { getElByHid, getHidById, versionWrap } from "../../utils/gameUtil.js";
import { convertToArray, isCdt } from "../../utils/utils.js";
import { SummonExecEvent, SummonExecRes, SummonHandleEvent, SummonHandleRes } from "../summons.js";
import { BaseBuilder, VersionMap } from "./baseBuilder.js";

type SummonBuilderExecEvent = SummonExecEvent & { cmds: CmdsGenerator };

type SummonBuilderHandleRes = Omit<SummonHandleRes, 'triggers' | 'exec'> & {
    triggers?: Trigger | Trigger[],
    exec?: (event: SummonBuilderExecEvent) => SummonExecRes | void,
    isOnlyPhaseEnd?: boolean,
};

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
    addition: Record<string, number>; // 额外信息
    handle: (summon: Summon, event?: SummonHandleEvent) => SummonHandleRes; // 处理函数
    UI: {
        src: string; // 图片url
        description: string; // 描述
        descriptions: string[], // 处理后的技能描述
        topIcon: string, // 右上角图标
        bottomIcon: string, // 左下角图标
        hasPlus: boolean, // 是否有加号
        isWill: boolean, // 是否为将要生成的召唤物
        willChange: boolean, // 是否将要变化的召唤物
        isAdd: boolean, // 召唤物是否增加过次数
        explains: string[], // 要解释的文本
        curVersion: Version, // 当前版本
        versionChanges: Version[], // 版本更新
    };
    constructor(
        id: number, name: string, description: string, src: string, useCnt: number, maxUse: number,
        shieldOrHeal: number, damage: number, element: ElementType, curVersion: Version,
        handle?: (summon: Summon, event: SummonHandleEvent, ver: VersionWrapper) => SummonBuilderHandleRes | undefined,
        options: {
            pct?: number, isTalent?: boolean, adt?: Record<string, number>, pdmg?: number, isDestroy?: SummonDestroyType, stsId?: number,
            spReset?: boolean, expl?: string[], topIcon?: string, bottomIcon?: string, pls?: boolean, ver?: Version, versionChanges?: Version[],
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
            pct = 0, isTalent = false, adt = {}, pdmg = 0, isDestroy = 0, stsId = -1, spReset = false,
            expl = [], topIcon = '', bottomIcon = '', pls = false, ver = VERSION[0], versionChanges = [],
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
            topIcon,
            bottomIcon,
            hasPlus: pls,
            explains: [...(description.match(/(?<=【)[^【】]+\d(?=】)/g) ?? []), ...expl],
            isWill: false,
            willChange: false,
            isAdd: false,
            descriptions: [],
            curVersion,
            versionChanges,
        }
        this.perCnt = pct;
        this.isTalent = isTalent;
        this.addition = adt;
        this.pdmg = pdmg;
        this.isDestroy = isDestroy;
        this.statusId = stsId;
        if (this.UI.src == '#') this.UI.src = `${GUYU_PREIFIX}${id}`;
        this.handle = (summon, event = {}) => {
            const { reset, trigger } = event;
            if (reset) {
                summon.perCnt = pct;
                if (!spReset && trigger != 'enter') return {}
            }
            const cmds = new CmdsGenerator();
            if (!handle) {
                return {
                    triggers: ['phase-end'],
                    exec: execEvent => ({ cmds: (execEvent.summon ?? summon).phaseEndAtk(event, cmds) }),
                }
            }
            const builderRes = handle(summon, event, versionWrap(ver)) ?? {};
            return {
                ...builderRes,
                triggers: isCdt(builderRes.triggers, convertToArray(builderRes.triggers) as Trigger[]),
                exec: execEvent => {
                    if (!builderRes.exec) {
                        builderRes.exec = execEvent => {
                            const { summon: smn = summon, cmds } = execEvent;
                            if (!builderRes.isOnlyPhaseEnd || event.trigger == 'phase-end') smn.phaseEndAtk(event, cmds);
                        }
                    }
                    builderRes.exec({ ...execEvent, cmds });
                    return { cmds }
                }
            }
        };
    }
    setEntityId(id: number): Summon {
        this.entityId = id;
        return this;
    }
    phaseEndAtk(event: SummonHandleEvent, cmds: CmdsGenerator, healHidxs?: number[]): CmdsGenerator {
        if (this.isDestroy == SUMMON_DESTROY_TYPE.Used) this.minusUseCnt();
        else if (!event.isExec) this.useCnt = -100;
        if (this.damage >= 0) cmds.attack();
        if (this.shieldOrHeal > 0) cmds.smnHeal({ hidxs: healHidxs });
        return cmds;
    }
    changeAnemoElement(trigger: Trigger) {
        if (trigger.includes('elReaction-Anemo:') && this.element == ELEMENT_TYPE.Anemo) {
            this.element = ELEMENT_TYPE[trigger.slice(trigger.indexOf(':') + 1) as ElementType];
        }
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
    private _useCnt: VersionMap<number> = this._createVersionMap();
    private _maxUse: VersionMap<number> = this._createVersionMap();
    private _shieldOrHeal: number = 0;
    private _damage: VersionMap<number> = this._createVersionMap();
    private _pdmg: number = 0;
    private _element: ElementType | undefined;
    private _perCnt: VersionMap<number> = this._createVersionMap();
    private _isTalent: boolean = false;
    private _addition: Record<string, number> = {};
    private _isDestroy: SummonDestroyType = SUMMON_DESTROY_TYPE.Used;
    private _statusId: number = -1;
    private _topIcon: string = 'TimeState';
    private _bottomIcon: string = '';
    private _hasPlus: boolean = false;
    private _explains: string[] = [];
    private _spReset: boolean = false;
    private _handle: ((summon: Summon, event: SummonHandleEvent, ver: VersionWrapper) => SummonBuilderHandleRes | undefined) | undefined;
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
    maxUse(maxUse: number, ...version: Version[]) {
        if (version.length == 0) version = ['vlatest'];
        version.forEach(v => this._maxUse.set([v, maxUse]));
        return this;
    }
    shield(shield: number) {
        this._shieldOrHeal = -shield;
        this._topIcon = 'Barrier';
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
    addition(key: string, value: number) {
        this._addition[key] = value;;
        return this;
    }
    statusId(stsId?: number) {
        this._statusId = stsId ?? -2;
        return this;
    }
    collection() {
        this._topIcon = 'Counter';
        return this;
    }
    icon(icon: string) {
        this._bottomIcon = icon;
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
    from(id: number) {
        this.addition('from', id);
        return this;
    }
    handle(handle: (summon: Summon, event: SummonHandleEvent, ver: VersionWrapper) => SummonBuilderHandleRes | undefined) {
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
            this._shieldOrHeal, damage, element, this._curVersion, this._handle,
            {
                pct: perCnt,
                isTalent: this._isTalent,
                adt: this._addition,
                pdmg: this._pdmg,
                isDestroy: this._isDestroy,
                stsId,
                spReset: this._spReset,
                expl: this._explains,
                topIcon: this._topIcon,
                bottomIcon: this._bottomIcon,
                pls: this._hasPlus,
                ver: this._curVersion,
                versionChanges: this.versionChanges,
            }
        )
    }
}