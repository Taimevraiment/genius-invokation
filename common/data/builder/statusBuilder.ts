import { Status, VersionCompareFn } from "../../../typing";
import { STATUS_GROUP, STATUS_TYPE, StatusGroup, StatusType, VERSION, Version } from "../../constant/enum.js";
import { MAX_USE_COUNT } from "../../constant/gameOption.js";
import { BARRIER_ICON_URL, SHIELD_ICON_URL, STATUS_BG_COLOR, StatusBgColor } from "../../constant/UIconst.js";
import { compareVersionFn, getElByHid, getHidById } from "../../utils/gameUtil.js";
import { StatusHandleEvent, StatusHandleRes } from "../statuses.js";
import { BaseBuilder, VersionMap } from "./baseBuilder.js";

export class GIStatus {
    id: number; // 唯一id
    entityId: number = -1; // 实体id
    name: string; // 名字
    group: StatusGroup; // 0角色状态 1阵营状态
    type: StatusType[]; // 类型: 0隐藏 1攻击 2挡伤 3回合 4使用 5翻倍伤害 6条件加伤 7护盾 8元素附魔 9累积 10标记 11准备技能 12死后不删除 13免击倒 14无法行动 15暂时不消失 16条件附魔
    useCnt: number; // 剩余使用次数: -1为无次数限制
    maxCnt: number; // 最多叠加的次数: 0为不能叠加
    addCnt: number; // 叠加时次数
    perCnt: number; // 每回合使用次数
    roundCnt: number; // 剩余轮次数: -1为无轮次限制
    isTalent: boolean; // 是否有天赋
    handle: (status: Status, event?: StatusHandleEvent) => StatusHandleRes; // 处理函数
    summonId: number; // 可能对应的召唤物 -1不存在
    addition: any[]; // 额外信息
    UI: {
        icon: string, // 图标
        description: string, // 描述
        descriptions: string[], // 处理后的技能描述
        explains: string[], // 要解释的文本
        iconBg: StatusBgColor, // 图标背景
    };
    constructor(
        id: number, name: string, description: string, icon: string, group: StatusGroup, type: StatusType[],
        useCnt: number, maxCnt: number, roundCnt: number, handle?: (status: Status, event: StatusHandleEvent, ver: VersionCompareFn) => StatusHandleRes | undefined,
        options: {
            smnId?: number, pct?: number, icbg?: StatusBgColor, expl?: string[], act?: number,
            isTalent?: boolean, isReset?: boolean, adt?: any[], ver?: Version,
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.group = group;
        this.type = type;
        this.useCnt = useCnt;
        this.maxCnt = maxCnt;
        this.roundCnt = roundCnt;
        const { smnId = -1, pct = 0, icbg = STATUS_BG_COLOR.Transparent, expl = [], act = Math.max(useCnt, roundCnt),
            isTalent = false, isReset = true, adt = [], ver = VERSION[0] } = options;
        const hid = getHidById(id);
        const el = getElByHid(hid);
        description = description
            .replace(/\[useCnt\]/g, '【[可用次数]：{useCnt}】' + (maxCnt == 0 ? '' : `（可叠加，${maxCnt == MAX_USE_COUNT ? '没有上限' : `最多叠加到${maxCnt}次`}）`))
            .replace(/\[roundCnt\]/g, '【[持续回合]：{roundCnt}】' + (maxCnt == 0 ? '' : `（可叠加，最多叠加到${maxCnt}回合）`))
            .replace(/(?<=〖)ski,([^〖〗]+)(?=〗)/g, `ski${hid},$1`)
            .replace(/(?<=【)ski,([^【】]+)(?=】)/g, `ski${hid},$1`)
            .replace(/(?<=【)hro(?=】)|(?<=〖)hro(?=〗)/g, `hro${hid}`);
        this.UI = {
            description,
            icon: icon.replace(/ski,(\d)/, `ski${hid},$1`),
            iconBg: icbg,
            explains: [...(description.match(/(?<=【)[^【】]+\d(?=】)|(?<=〖)[^〖〗]+\d(?=〗)/g) ?? []), ...expl],
            descriptions: [],
        }
        this.addCnt = act;
        this.summonId = smnId;
        this.perCnt = pct;
        this.isTalent = isTalent;
        this.addition = adt;
        let thandle = handle ?? (() => ({}));
        if (type.includes(STATUS_TYPE.Shield)) {
            // this.icon = 'shield2';
            // this.UI.iconBg = STATUS_BG_COLOR[STATUS_TYPE.Shield];
            this.UI.icon = SHIELD_ICON_URL;
            thandle = (status, event = {}) => {
                let { restDmg = -1 } = event;
                let rest: StatusHandleRes = {};
                if (handle) {
                    const { restDmg: dmg = -1, ...other } = handle(status, event, compareVersionFn(ver)) ?? {};
                    if (dmg > -1) restDmg = dmg;
                    rest = { ...other };
                }
                if (restDmg <= 0) return { restDmg, ...rest };
                const shieldDmg = Math.min(restDmg, status.useCnt);
                status.useCnt -= shieldDmg;
                return { restDmg: restDmg - shieldDmg, ...rest };
            }
        } else if (type.includes(STATUS_TYPE.Barrier) && this.UI.icon == '') {
            // this.icon = 'shield';
            // this.iconBg = '#9268db';
            this.UI.icon = BARRIER_ICON_URL;
        }
        if (this.UI.iconBg == STATUS_BG_COLOR.Transparent) {
            if (icon.startsWith('buff')) {
                if (icon == 'buff2') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Buff.webp';
                if (icon == 'buff3') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Special.webp';
                if (icon == 'buff' || icon == 'buff4') this.UI.iconBg = STATUS_BG_COLOR[el];
                else this.UI.iconBg = STATUS_BG_COLOR.Buff;
            } else if (['satiety', 'debuff'].includes(icon)) {
                if (icon == 'satiety') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Food.webp';
                if (icon == 'debuff') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Debuff.webp';
                // this.iconBg = DEBUFF_BG_COLOR;
            } else if (icon.includes('heal')) {
                if (icon == 'heal') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Heal.webp';
                if (icon == 'heal2') this.UI.icon = 'https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Common_Revive.webp';
                // this.iconBg = '#95ff7a';
            } else if (icon.startsWith('ski')) {
                this.UI.iconBg = STATUS_BG_COLOR[el];
            }
        }
        this.handle = (status, event = {}) => {
            const { reset = false } = event;
            if (reset) {
                if (isReset) status.perCnt = pct;
                return {}
            }
            return thandle(status, event, compareVersionFn(ver)) ?? {};
        }
    }
    setEntityId(id: number): Status {
        this.entityId = id;
        return this;
    }
    hasType(...types: StatusType[]): boolean {
        return this.type.some(v => types.includes(v));
    }
}

export class StatusBuilder extends BaseBuilder {
    private _id: number = -1;
    private _name: string = '无';
    private _group: StatusGroup = STATUS_GROUP.heroStatus;
    private _type: StatusType[] = [];
    private _useCnt: VersionMap<number> = new VersionMap();
    private _maxCnt: VersionMap<number> = new VersionMap();
    private _addCnt: number = 0;
    private _perCnt: VersionMap<number> = new VersionMap();
    private _roundCnt: VersionMap<number> = new VersionMap();
    private _icon: VersionMap<string> = new VersionMap();
    private _explains: string[] = [];
    private _iconBg: StatusBgColor = STATUS_BG_COLOR.Transparent;
    private _isTalent: boolean = false;
    private _summonId: number = -1;
    private _addition: any[] = [];
    private _isReset: boolean = true;
    private _handle: ((status: Status, event: StatusHandleEvent, ver: VersionCompareFn) => StatusHandleRes | undefined | void) | undefined;
    private _typeCdt: [(ver: VersionCompareFn) => boolean, StatusType[]][] = [];
    private _barrierCdt: [(ver: VersionCompareFn) => boolean, number][] = [];
    private _barrierCnt: number = 1;
    private _barrierUsage: number = 1;
    constructor(name: string) {
        super();
        this._name = name;
    }
    id(id: number) {
        this._id = id;
        return this;
    }
    heroStatus() {
        this._group = STATUS_GROUP.heroStatus;
        return this;
    }
    combatStatus() {
        this._group = STATUS_GROUP.combatStatus;
        return this;
    }
    type(...types: StatusType[]): StatusBuilder;
    type(cdt: boolean, ...types: StatusType[]): StatusBuilder;
    type(cdt: (ver: VersionCompareFn) => boolean, ...types: StatusType[]): StatusBuilder;
    type(cdt: StatusType | ((ver: VersionCompareFn) => boolean) | boolean, ...types: StatusType[]) {
        if (typeof cdt == 'function') {
            this._typeCdt.push([cdt, types]);
            return this;
        }
        if (typeof cdt == 'boolean') {
            if (cdt) this._type.push(...types);
            return this;
        }
        this._type.push(cdt, ...types);
        return this;
    }
    typeOverride(...types: StatusType[]) {
        this._type = [];
        this._type.push(...types);
        return this;
    }
    useCnt(useCnt: number, cdt: boolean): StatusBuilder;
    useCnt(useCnt: number, version?: Version, cdt?: boolean): StatusBuilder;
    useCnt(useCnt: number, version: Version | boolean = 'vlatest', cdt: boolean = true) {
        if (typeof version == 'boolean') {
            if (version) this._useCnt.set(['vlatest', useCnt]);
        } else if (cdt) {
            this._useCnt.set([version, useCnt]);
        }
        return this;
    }
    maxCnt(maxCnt: number, version: Version = 'vlatest') {
        this._maxCnt.set([version, maxCnt]);
        return this;
    }
    addCnt(addCnt?: number) {
        if (addCnt != undefined) this._addCnt = addCnt;
        return this;
    }
    perCnt(perCnt: number, cdt?: boolean): StatusBuilder;
    perCnt(perCnt: number, ver?: Version, cdt?: boolean): StatusBuilder;
    perCnt(perCnt: number, cdt: boolean | Version = true, cdt2: boolean = true) {
        if (typeof cdt == 'boolean') {
            if (cdt) this._perCnt.set(['vlatest', perCnt]);
            return this;
        }
        if (cdt2) this._perCnt.set([cdt, perCnt]);
        return this;
    }
    roundCnt(roundCnt: number, cdt: boolean): StatusBuilder;
    roundCnt(roundCnt: number, version?: Version, cdt?: boolean): StatusBuilder;
    roundCnt(roundCnt: number, version: Version | boolean = 'vlatest', cdt: boolean = true) {
        if (typeof version == 'boolean') {
            if (version) this._roundCnt.set(['vlatest', roundCnt]);
        } else if (cdt) {
            this._roundCnt.set([version, roundCnt]);
        }
        return this;
    }
    icon(icon: string, version: Version = 'vlatest') {
        this._icon.set([version, icon]);
        return this;
    }
    explains(...explains: string[]) {
        this._explains.push(...explains);
        return this;
    }
    iconBg(iconBg: StatusBgColor) {
        this._iconBg = iconBg;
        return this;
    }
    talent(isTalent: boolean) {
        this._isTalent = isTalent;
        return this;
    }
    summonId(smnId?: number) {
        this._summonId = smnId ?? -2;
        return this;
    }
    addition(...addition: any[]) {
        this._addition.push(...addition);
        return this;
    }
    notReset() {
        this._isReset = false;
        return this;
    }
    handle(handle: (status: Status, event: StatusHandleEvent, ver: VersionCompareFn) => StatusHandleRes | undefined | void) {
        this._handle = handle;
        return this;
    }
    barrierCdt(cnt: number, cdt?: boolean): StatusBuilder;
    barrierCdt(cnt: number, cdt?: (ver: VersionCompareFn) => boolean): StatusBuilder;
    barrierCdt(cnt: number, cdt: ((ver: VersionCompareFn) => boolean) | boolean = () => true) {
        if (typeof cdt == 'boolean') this._barrierCdt.push([() => cdt, cnt]);
        else this._barrierCdt.push([cdt, cnt]);
        return this;
    }
    barrierCnt(cnt: number) {
        this._barrierCnt = cnt;
        return this;
    }
    barrierUsage(cnt: number) {
        this._barrierUsage = cnt;
        return this;
    }
    done() {
        const description = this._description.get(this._curVersion, '');
        const icon = this._icon.get(this._curVersion, '');
        const perCnt = this._perCnt.get(this._curVersion, 0);
        const useCnt = this._useCnt.get(this._curVersion, -1);
        const roundCnt = this._roundCnt.get(this._curVersion, -1);
        const smnId = this._summonId == -2 ? this._id : this._summonId;
        const maxCnt = this._maxCnt.get(this._curVersion, 0);
        this._typeCdt.forEach(([cdt, types]) => {
            if (cdt(compareVersionFn(this._curVersion))) this._type.push(...types);
        });
        const handle = this._type.includes(STATUS_TYPE.Barrier) && !this._handle ?
            (status: Status, event: StatusHandleEvent, ver: VersionCompareFn) => {
                const { restDmg = -1, summon, getdmg = [], hidx = -1 } = event;
                if (restDmg < this._barrierCdt.reduce((a, c) => c[0](ver) ? c[1] : a, 1)) return { restDmg }
                if (status.useCnt > 0) status.useCnt = Math.max(0, status.useCnt - this._barrierUsage);
                if (summon && summon.statusId != -1 && this._summonId != -1) summon.useCnt = Math.max(0, summon.useCnt - this._barrierUsage);
                if (getdmg.length > 0) getdmg[hidx] = Math.max(0, restDmg - this._barrierCnt);
                return { restDmg: Math.max(0, restDmg - this._barrierCnt) }
            } : (status: Status, event: StatusHandleEvent, ver: VersionCompareFn) => this._handle?.(status, event, ver) ?? {};
        return new GIStatus(this._id, this._name, description, icon, this._group, this._type,
            useCnt, maxCnt, roundCnt, handle,
            {
                pct: perCnt,
                act: this._addCnt || Math.max(useCnt, roundCnt),
                icbg: this._iconBg,
                isTalent: this._isTalent,
                smnId,
                adt: this._addition,
                expl: this._explains,
                isReset: this._isReset,
                ver: this._curVersion,
            }
        );
    }

}