import { Card, MinusDiceSkill, Support, Trigger, VersionWrapper } from "../../../typing";
import { DiceCostType, SUPPORT_TYPE, SupportType, VERSION, Version } from "../../constant/enum.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { getEntityHandleEvent, versionWrap } from "../../utils/gameUtil.js";
import { convertToArray, deleteUndefinedProperties, isCdt } from "../../utils/utils.js";
import { BaseBuilder, EntityBuilderHandleEvent, EntityHandleEvent, InputHandle, VersionMap } from "./baseBuilder.js";

export interface SupportHandleEvent extends EntityHandleEvent { }

export interface SupportHandleRes {
    triggers?: Trigger[],
    exec?: () => SupportExecRes,
    minusDiceCard?: number,
    minusDiceHero?: number,
    minusDiceSkill?: MinusDiceSkill,
    element?: DiceCostType | 'front',
    cnt?: number,
    addRollCnt?: number,
    isQuickAction?: boolean,
    isNotAddTask?: boolean,
    isOrTrigger?: boolean,
    isLast?: boolean,
    isExchange?: boolean,
    isAfterSkill?: boolean,
    notLog?: boolean,
}

export interface SupportExecRes {
    cmds?: CmdsGenerator,
    isDestroy?: boolean,
}

export interface SupportBuilderHandleEvent extends SupportHandleEvent, Omit<EntityBuilderHandleEvent, 'cmds'> { }

type SupportBuilderHandleRes = Omit<SupportHandleRes, 'triggers' | 'exec'> & {
    summon?: (number | [number, ...any])[] | number,
    triggers?: Trigger | Trigger[],
    exec?: (cmds: CmdsGenerator) => SupportExecRes | void,
};

export class GISupport {
    entityId: number = -1; // 实体id
    card: Card; // 场地卡
    cnt: number; // 次数
    perCnt: number; // 每回合x次
    heal: number; // 回血数
    type: SupportType; // 类型 1轮次 2收集物 3常驻
    handle: (support: Support, event: InputHandle<SupportHandleEvent>) => SupportHandleRes; // 处理效果函数

    constructor(
        card: Card, cnt: number, perCnt: number, type: SupportType,
        handle: ((support: Support, event: SupportBuilderHandleEvent, ver: VersionWrapper) => SupportBuilderHandleRes | undefined | void) | undefined,
        heal = 0, ver: Version = VERSION[0],
    ) {
        this.card = card;
        this.cnt = cnt;
        this.perCnt = perCnt;
        this.type = type;
        this.heal = heal;
        this.handle = (support, event) => {
            if (event.trigger == 'reset' && perCnt > 0) {
                support.perCnt = perCnt;
                return { notLog: true, isNotAddTask: true, triggers: ['reset'] }
            }
            const { players, pidx, ...oevent } = event;
            const pevent = getEntityHandleEvent(pidx, players, event, support);
            const cevent = {
                ...pevent,
                ...deleteUndefinedProperties(oevent),
            };
            const builderRes = handle?.(support, cevent, versionWrap(ver)) ?? {};
            const res: SupportHandleRes = {
                ...builderRes,
                triggers: isCdt(builderRes.triggers, convertToArray(builderRes.triggers) as Trigger[]),
                exec: () => {
                    const cmds = new CmdsGenerator();
                    if (builderRes.summon) cmds.getSummon(builderRes.summon);
                    const exeres = builderRes.exec?.(cmds);
                    return { ...exeres, cmds }
                }
            }
            return res;
        };
    }
    addCnt(cnt: number = 1, max: number = 1e3) {
        this.cnt = Math.min(max, this.cnt + cnt);
        return this.cnt;
    }
    minusCnt(cnt: number = 1) {
        this.cnt -= cnt;
        return this.cnt;
    }
    setCnt(cnt: number = 0) {
        this.cnt = cnt;
        return this.cnt;
    }
    minusPerCnt(cnt: number = 1) {
        this.perCnt -= cnt;
    }
    setPerCnt(cnt: number = 0) {
        this.perCnt = cnt;
    }
    setEntityId(id: number): Support {
        this.entityId = id;
        return this;
    }
}

export class SupportBuilder extends BaseBuilder {
    private _card: Card | undefined;
    private _cnt: VersionMap<number> = new VersionMap();
    private _perCnt: VersionMap<number> = new VersionMap();
    private _type: VersionMap<SupportType> = new VersionMap();
    private _heal: number = 0;
    private _handle: ((support: Support, event: SupportBuilderHandleEvent, ver: VersionWrapper) => SupportBuilderHandleRes | undefined | void) | undefined = () => ({});
    constructor() {
        super();
    }
    get id() {
        return this._card?.id ?? -1;
    }
    card(card: Card) {
        this._card = card;
        return this;
    }
    perCnt(perCnt: number, version: Version = 'vlatest') {
        this._perCnt.set([version, perCnt]);
        return this;
    }
    round(cnt: number, version: Version = 'vlatest') {
        this._type.set([version, SUPPORT_TYPE.Round]);
        this._cnt.set([version, cnt]);
        return this;
    }
    collection(cnt: number = 0, version: Version = 'vlatest') {
        this._type.set([version, SUPPORT_TYPE.Collection]);
        this._cnt.set([version, cnt]);
        return this;
    }
    permanent(cnt: number = 0, version: Version = 'vlatest') {
        this._type.set([version, SUPPORT_TYPE.Permanent]);
        this._cnt.set([version, cnt]);
        return this;
    }
    heal(heal: number) {
        this._heal = heal;
        return this;
    }
    handle(handle: (support: Support, event: SupportBuilderHandleEvent, ver: VersionWrapper) => SupportBuilderHandleRes | undefined | void) {
        this._handle = handle;
        return this;
    }
    done() {
        if (this._card == undefined) throw new Error("SupportBuilder: card is undefined");
        const perCnt = this._perCnt.get(this._curVersion, 0);
        const cnt = this._cnt.get(this._curVersion, 0);
        const type = this._type.get(this._curVersion, SUPPORT_TYPE.Permanent);
        return new GISupport(this._card, cnt, perCnt, type, this._handle, this._heal, this._curVersion);
    }
}

