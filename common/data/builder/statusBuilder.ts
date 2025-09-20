import { Status, Trigger, VersionWrapper } from "../../../typing";
import { CARD_TYPE, DAMAGE_TYPE, STATUS_GROUP, STATUS_TYPE, StatusGroup, StatusType, VERSION, Version } from "../../constant/enum.js";
import { IS_USE_OFFICIAL_SRC, MAX_USE_COUNT } from "../../constant/gameOption.js";
import { ELEMENT_ICON_NAME, GUYU_PREIFIX, STATUS_BG_COLOR, STATUS_ICON, StatusBgColor } from "../../constant/UIconst.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { getElByHid, getEntityHandleEvent, getHidById, versionWrap } from "../../utils/gameUtil.js";
import { convertToArray, deleteUndefinedProperties, isCdt } from "../../utils/utils.js";
import { BaseBuilder, EntityBuilderHandleEvent, EntityHandleEvent, EntityHandleRes, InputHandle, VersionMap } from "./baseBuilder.js";

export interface StatusHandleEvent extends EntityHandleEvent { }

export interface StatusHandleRes extends EntityHandleRes {
    damage?: number,
    pdmg?: number,
    heal?: number,
    isSelf?: boolean,
    isInvalid?: boolean,
    onlyOne?: boolean,
    isUpdateAttachEl?: boolean,
    atkOffset?: number,
    isFallAtk?: boolean,
    exec?: () => boolean,
}

export interface StatusBuilderHandleRes extends Omit<StatusHandleRes, 'triggers' | 'hidxs' | 'exec'> {
    skill?: number,
    triggers?: Trigger | Trigger[],
    hidxs?: number | number[],
    exec?: () => any;
};

export interface StatusBuilderHandleEvent extends StatusHandleEvent, EntityBuilderHandleEvent { };

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
    handle: (status: Status, event: InputHandle<StatusHandleEvent>) => StatusHandleRes; // 处理函数
    summonId: number; // 可能对应的召唤物 -1不存在
    variables: Record<string, number>; // 变量
    UI: {
        icon: string, // 图标
        description: string, // 描述
        descriptions: string[], // 处理后的技能描述
        explains: string[], // 要解释的文本
        iconBg: StatusBgColor, // 图标背景
        versionChanges: Version[], // 版本变更
    };
    constructor(
        id: number, name: string, description: string, icon: string, group: StatusGroup, type: StatusType[],
        useCnt: number, maxCnt: number, roundCnt: number,
        handle?: (status: Status, event: StatusBuilderHandleEvent, ver: VersionWrapper) => StatusBuilderHandleRes | undefined,
        options: {
            smnId?: number, pct?: number, icbg?: StatusBgColor, expl?: string[], act?: number,
            isTalent?: boolean, isReset?: boolean, vars?: Record<string, number>, ver?: Version, versionChanges?: Version[],
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.group = group;
        this.type = type;
        this.useCnt = useCnt;
        this.maxCnt = maxCnt;
        this.roundCnt = roundCnt;
        const { smnId = -1, pct = 0, icbg = STATUS_BG_COLOR.Transparent, expl = [], act = -1,
            isTalent = false, isReset = true, vars = {}, ver = VERSION[0], versionChanges = [] } = options;
        const hid = getHidById(id);
        description = description
            .replace(/\[useCnt\]/g, `【[可用次数]：${useCnt}】` + (maxCnt == 0 ? '' : `（可叠加，${maxCnt == MAX_USE_COUNT ? '没有上限' : `最多叠加到${maxCnt}次`}）`))
            .replace(/\[roundCnt\]/g, `【[持续回合]：${roundCnt}】` + (maxCnt == 0 || useCnt > -1 ? '' : `（可叠加，最多叠加到${maxCnt}回合）`))
            .replace(/(?<=〖)ski,(.+?)(?=〗)/g, `ski${hid},$1`)
            .replace(/(?<=【)ski,(.+?)(?=】)/g, `ski${hid},$1`)
            .replace(/(?<=〖)hro(?=〗)/g, `hro${hid}`)
            .replace(/(?<=【)hro(?=】)/g, `hro${hid}`);
        this.UI = {
            description,
            icon: icon.replace(/ski,(\d)/, `ski${hid},$1`),
            iconBg: icbg,
            explains: [
                ...(description.match(/(?<=〖)[^〖〗]+\d(?=〗)/g) ?? []),
                ...(description.match(/(?<=【)[^【】]+\d(?=】)/g) ?? []),
                ...expl,
            ],
            descriptions: [],
            versionChanges,
        }
        this.addCnt = act == -1 ? Math.max(useCnt, roundCnt) : act;
        this.summonId = smnId;
        this.perCnt = pct;
        this.isTalent = isTalent;
        this.variables = vars;
        let thandle: (status: Status, event: StatusBuilderHandleEvent, ver: VersionWrapper) => StatusBuilderHandleRes | undefined = handle ?? (() => ({}));
        if (type.includes(STATUS_TYPE.Shield)) {
            this.UI.icon ||= STATUS_ICON.Shield;
            thandle = (status, event) => {
                let { restDmg } = event;
                let rest: StatusBuilderHandleRes = {};
                if (handle) {
                    const { restDmg: dmg = -1, ...other } = handle(status, event, versionWrap(ver)) ?? {};
                    if (dmg > -1) restDmg = dmg;
                    rest = { ...other };
                }
                if (restDmg < 0) return rest;
                const shieldDmg = Math.min(restDmg, status.useCnt);
                return { restDmg: restDmg - shieldDmg, ...rest, triggers: 'reduce-dmg', exec: () => status.minusUseCnt(shieldDmg) }
            }
        } else if (type.includes(STATUS_TYPE.Barrier) && this.UI.icon == '') {
            this.UI.icon = STATUS_ICON.Barrier;
            thandle = (status, event) => {
                const { restDmg } = event;
                const handleres = handle?.(status, event, versionWrap(ver)) ?? {};
                if (restDmg == -1) return handleres;
                return { ...handleres, triggers: 'reduce-dmg' }
            }
        } else if (type.includes(STATUS_TYPE.ImmuneDamage)) {
            thandle = (status, event) => {
                const { dmgElement, trigger, cmds } = event;
                const el = getElByHid(hid);
                const res = handle?.(status, event, versionWrap(ver));
                if (trigger == 'reduce-dmg' && dmgElement == el) {
                    return { ...res, restDmg: 0, triggers: trigger }
                }
                if (trigger == 'enter') {
                    cmds.attach({ element: el });
                    return { ...res, triggers: trigger }
                }
                return res;
            }
        } else if (type.includes(STATUS_TYPE.NonEvent)) {
            this.UI.icon = STATUS_ICON.DebuffCountered01;
            thandle = (status, event) => {
                if (event.hcard?.type != CARD_TYPE.Event) return;
                return { triggers: 'card', isInvalid: true, exec: () => status.minusUseCnt() }
            }
        } else if (type.includes(STATUS_TYPE.NightSoul)) {
            const element = ELEMENT_ICON_NAME[Math.floor(id / 1e3) % 10];
            this.UI.icon = `https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_Nightsoul_${element}.webp`;
        } else if (Object.values<string>(STATUS_ICON).slice(0, 4).includes(icon) && IS_USE_OFFICIAL_SRC) {
            const element = icon == STATUS_ICON.Enchant || icon == STATUS_ICON.ElementAtkUp ? ELEMENT_ICON_NAME[Math.floor(id / 1e3) % 10] : '';
            const iconName = icon == STATUS_ICON.Enchant ? 'Element_Enchant_' :
                icon == STATUS_ICON.ElementAtkUp ? 'Element_Atk_Up_' :
                    icon == STATUS_ICON.AtkUp ? 'Common_Atk_Up' :
                        icon == STATUS_ICON.AtkSelf ? 'Common_Atk_Self' : '';
            this.UI.icon = `https://gi-tcg-assets.guyutongxue.site/assets/UI_Gcg_Buff_${iconName}${element}.webp`;
            this.UI.iconBg = STATUS_BG_COLOR.Transparent;
        }
        if (IS_USE_OFFICIAL_SRC && !/^http|tmp/.test(this.UI.icon)) {
            this.UI.icon = '#';
            this.UI.iconBg = STATUS_BG_COLOR.Transparent;
        }
        this.UI.icon = this.UI.icon.replace('tmpski', 'ski');
        if (this.UI.icon == '#') this.UI.icon = `${GUYU_PREIFIX}${id}`;
        // else if (this.UI.iconBg == STATUS_BG_COLOR.Transparent) {
        //     if (icon == STATUS_ICON.Enchant || icon == STATUS_ICON.ElementAtkUp || icon.startsWith('ski')) {
        //         this.UI.iconBg = STATUS_BG_COLOR[getElByHid(hid)];
        //     } else if (icon == STATUS_ICON.AtkUp || icon == STATUS_ICON.AtkSelf) {
        //         this.UI.iconBg = STATUS_BG_COLOR.Buff;
        //     }
        // }
        this.handle = (status, event) => {
            const cmds = new CmdsGenerator();
            const { players, pidx, ...oevent } = event;
            const pevent = getEntityHandleEvent(pidx, players, event, status);
            const cevent = {
                ...pevent,
                ...deleteUndefinedProperties(oevent),
                cmds,
            };
            if (cevent.trigger == 'reset') {
                if (isReset) status.perCnt = pct;
                return { notLog: true, isAddTask: false, triggers: isCdt(isReset, ['reset']) }
            }
            const builderRes = thandle(status, cevent, versionWrap(ver)) ?? {};
            const { damage, element, heal, pdmg, isSelf, isPriority, skill, status: sts, statusOppo,
                hidxs = isCdt(isSelf && status.group == STATUS_GROUP.heroStatus, cevent.hidx), summon, summonOppo,
            } = builderRes;
            if (this.hasType(STATUS_TYPE.Attack)) {
                if (damage) cmds.attack(damage, element, { hidxs, isOppo: !isSelf, isPriority });
                if (pdmg) cmds.attack(pdmg, DAMAGE_TYPE.Pierce, { hidxs, isOppo: !isSelf });
                if (heal) cmds.heal(heal, { hidxs });
            }
            if (sts) cmds.getStatus(sts);
            if (statusOppo) cmds.getStatus(statusOppo, { isOppo: true });
            if (summon) cmds.getSummon(summon);
            if (summonOppo) cmds.getSummon(summonOppo, { isOppo: true });
            if (skill) cmds.useSkill({ skillId: skill });
            const res: StatusHandleRes = {
                ...builderRes,
                cmds,
                triggers: isCdt(builderRes.triggers, convertToArray(builderRes.triggers) as Trigger[]),
                hidxs: isCdt(builderRes.hidxs, convertToArray(builderRes.hidxs) as number[]),
                exec: () => builderRes.exec?.() === true,
            }
            return res;
        }
    }
    get isDestroy() {
        return (this.roundCnt == 0 || this.useCnt == 0 && !this.hasType(STATUS_TYPE.Accumulate)) &&
            !this.hasType(STATUS_TYPE.NonDestroy, STATUS_TYPE.Attack);
    }
    setEntityId(id: number): Status {
        this.entityId = id;
        return this;
    }
    hasType(...types: StatusType[]): boolean {
        if (types.length == 0) return true;
        return this.type.some(v => types.includes(v));
    }
    addUseCnt(ignoreMax: boolean): void
    addUseCnt(n?: number, ignoreMax?: boolean): void
    addUseCnt(n: number | boolean = 1, ignoreMax: boolean = false): void {
        if (typeof n == 'boolean' && n) ++this.useCnt;
        else {
            if (n == false) n = 1;
            if (ignoreMax || this.maxCnt == 0) this.useCnt += n;
            else this.useCnt = Math.max(this.useCnt, Math.min(this.maxCnt, this.useCnt + n));
        }
    }
    addUseCntMod(mod: number, n?: number): void {
        this.addUseCnt(n);
        this.useCnt %= mod;
    }
    minusUseCnt(n: number = 1): number {
        this.useCnt = Math.max(0, this.useCnt - n);
        return this.useCnt;
    }
    setUseCnt(n: number = 0): number {
        this.useCnt = n;
        return this.useCnt;
    }
    minusPerCnt(n: number = 1): number {
        this.perCnt -= n;
        return this.perCnt;
    }
    addRoundCnt(n: number = 1): void {
        this.roundCnt = Math.max(this.roundCnt, Math.min(this.maxCnt, this.roundCnt + n));
    }
    minusRoundCnt(n: number = 1): void {
        const nrcnt = this.roundCnt - n;
        if (nrcnt < 0) throw new Error(`${this.name}(${this.entityId}).roundCnt < 0`);
        this.roundCnt = nrcnt;
    }
    dispose(includeAtk: boolean = true): void {
        this.useCnt = 0;
        this.roundCnt = 0;
        const nonDestroy = this.type.indexOf(STATUS_TYPE.NonDestroy);
        if (nonDestroy > -1) this.type.splice(nonDestroy, 1);
        if (includeAtk) {
            const attack = this.type.indexOf(STATUS_TYPE.Attack);
            if (attack > -1) this.type.splice(attack, 1);
        }
    }
}

export class StatusBuilder extends BaseBuilder {
    private _id: number = -1;
    private _name: VersionMap<string> = this._createVersionMap();
    private _group: StatusGroup = STATUS_GROUP.heroStatus;
    private _type: StatusType[] = [];
    private _useCnt: VersionMap<number> = this._createVersionMap();
    private _maxCnt: VersionMap<number> = this._createVersionMap();
    private _addCnt: number = -1;
    private _perCnt: VersionMap<number> = this._createVersionMap();
    private _roundCnt: VersionMap<number> = this._createVersionMap();
    private _icon: VersionMap<string> = this._createVersionMap();
    private _explains: string[] = [];
    private _iconBg: StatusBgColor = STATUS_BG_COLOR.Transparent;
    private _isTalent: boolean = false;
    private _summonId: number = -1;
    private _variables: Record<string, number> = {};
    private _isReset: boolean = true;
    private _handle: ((status: Status, event: StatusBuilderHandleEvent, ver: VersionWrapper) => StatusBuilderHandleRes | undefined | void) | undefined;
    private _typeCdt: [(ver: VersionWrapper) => boolean, StatusType[]][] = [];
    private _barrierCdt: [(ver: VersionWrapper) => boolean, number][] = [];
    private _barrierCnt: (status: Status) => number = () => 1;
    private _barrierUsage: (status: Status) => number = () => 1;
    constructor(name: string) {
        super();
        this._name.set(['vlatest', name]);
    }
    get isOnlyExplain() {
        return this._type.includes(STATUS_TYPE.OnlyExplain);
    }
    id(id: number) {
        if (this._id == -1) this._id = id;
        return this;
    }
    name(name: string, version: Version = 'vlatest') {
        this._name.set([version, name]);
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
    descriptionOnly(description: string, ...versions: Version[]) {
        this.type(STATUS_TYPE.OnlyExplain);
        return this.description(description, ...versions);
    }
    type(...types: StatusType[]): StatusBuilder;
    type(cdt: boolean, ...types: StatusType[]): StatusBuilder;
    type(cdt: (ver: VersionWrapper) => boolean, ...types: StatusType[]): StatusBuilder;
    type(cdt: StatusType | ((ver: VersionWrapper) => boolean) | boolean, ...types: StatusType[]) {
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
        this._type = [...types];
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
    variables(key: string, value?: number) {
        this._variables[key] = value ?? 0;
        return this;
    }
    notReset() {
        this._isReset = false;
        return this;
    }
    handle(handle: (status: Status, event: StatusBuilderHandleEvent, ver: VersionWrapper) => StatusBuilderHandleRes | undefined | void) {
        this._handle = handle;
        return this;
    }
    barrierCdt(cnt: number, cdt?: boolean): StatusBuilder;
    barrierCdt(cnt: number, cdt?: (ver: VersionWrapper) => boolean): StatusBuilder;
    barrierCdt(cnt: number, cdt: ((ver: VersionWrapper) => boolean) | boolean = () => true) {
        if (typeof cdt == 'boolean') this._barrierCdt.push([() => cdt, cnt]);
        else this._barrierCdt.push([cdt, cnt]);
        return this;
    }
    barrierCnt(cnt: (status: Status) => number): StatusBuilder;
    barrierCnt(cnt: number): StatusBuilder;
    barrierCnt(cnt: number | ((status: Status) => number)) {
        if (typeof cnt == 'number') this._barrierCnt = () => cnt;
        else this._barrierCnt = cnt;
        return this;
    }
    barrierUsage(cnt: (status: Status) => number): StatusBuilder;
    barrierUsage(cnt: number): StatusBuilder;
    barrierUsage(cnt: number | ((status: Status) => number)) {
        if (typeof cnt == 'number') this._barrierUsage = () => cnt;
        else this._barrierUsage = cnt;
        return this;
    }
    from(id: number) {
        this.variables('from', id);
        return this;
    }
    done() {
        const name = this._name.get(this._curVersion, '无');
        const description = this._description.get(this._curVersion, '');
        const icon = this._icon.get(this._curVersion, '');
        const perCnt = this._perCnt.get(this._curVersion, 0);
        const useCnt = this._useCnt.get(this._curVersion, -1);
        const roundCnt = this._roundCnt.get(this._curVersion, -1);
        const smnId = this._summonId == -2 ? this._id : this._summonId;
        const maxCnt = this._maxCnt.get(this._curVersion, 0);
        this._typeCdt.forEach(([cdt, types]) => cdt(versionWrap(this._curVersion)) && this._type.push(...types));
        if (this._type.includes(STATUS_TYPE.NonDefeat)) this.variables(STATUS_TYPE.NonDefeat, 1);
        if (this._type.includes(STATUS_TYPE.Barrier)) this.variables(STATUS_TYPE.Barrier, 1);
        const handle = this._type.includes(STATUS_TYPE.Barrier) && !this._handle ?
            (status: Status, event: StatusHandleEvent, ver: VersionWrapper): StatusBuilderHandleRes => {
                const { restDmg = -1, summons = [], getdmg = [], hidx = -1 } = event;
                const triggers: Trigger = 'reduce-dmg';
                if (restDmg < this._barrierCdt.reduce((a, c) => c[0](ver) ? c[1] : a, 1)) return { triggers, restDmg }
                const summon = summons.find(smn => smn.id == status.summonId);
                return {
                    triggers,
                    restDmg: Math.max(0, restDmg - this._barrierCnt(status)),
                    exec: () => {
                        if (status.useCnt > 0) status.minusUseCnt(this._barrierUsage(status));
                        if (summon && summon.statusId != -1 && this._summonId != -1) summon.minusUseCnt(this._barrierUsage(status));
                        if (getdmg.length > 0) getdmg[hidx] = Math.max(0, restDmg - this._barrierCnt(status));
                    }
                }
            } : (status: Status, event: StatusBuilderHandleEvent, ver: VersionWrapper) => this._handle?.(status, event, ver) ?? {};
        return new GIStatus(this._id, name, description, icon, this._group, this._type,
            useCnt, maxCnt, roundCnt, handle,
            {
                pct: perCnt,
                act: this._addCnt,
                icbg: this._iconBg,
                isTalent: this._isTalent,
                smnId,
                vars: this._variables,
                expl: this._explains,
                isReset: this._isReset,
                ver: this._curVersion,
                versionChanges: this.versionChanges,
            }
        );
    }

}