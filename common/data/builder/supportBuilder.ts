import { Card, MinusDiceSkill, Summon, Support, Trigger, VersionWrapper } from "../../../typing";
import { DiceCostType, SUPPORT_TYPE, SupportType, VERSION, Version } from "../../constant/enum.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { getEntityHandleEvent, versionWrap } from "../../utils/gameUtil.js";
import { convertToArray, isCdt } from "../../utils/utils.js";
import { BaseBuilder, EntityHandleEvent, InputHandle, VersionMap } from "./baseBuilder.js";

export interface SupportHandleEvent extends EntityHandleEvent { }

export type SupportHandleRes = {
    triggers?: Trigger[],
    exec?: (support: Support, event: SupportExecEvent) => SupportExecRes | void,
    minusDiceCard?: number,
    minusDiceHero?: number,
    minusDiceSkill?: MinusDiceSkill,
    element?: DiceCostType | -2,
    cnt?: number,
    addRollCnt?: number,
    isQuickAction?: boolean,
    supportCnt?: number,
    isNotAddTask?: boolean,
    isOrTrigger?: boolean,
    isLast?: boolean,
    isExchange?: boolean,
    isAfterSkill?: boolean,
    summon?: (number | [number, ...any])[] | number,
}

export type SupportExecEvent = {
    csummon?: Summon,
    isExecTask?: boolean,
    supports?: Support[],
    esupports?: Support[],
}

export type SupportExecRes = {
    cmds?: CmdsGenerator,
    isDestroy?: boolean,
    summon?: (number | [number, ...any])[] | number,
}

type SupportBuilderHandleRes = Omit<SupportHandleRes, 'triggers' | 'exec'> & {
    triggers?: Trigger | Trigger[],
    exec?: (support: Support, cmds: CmdsGenerator, event: SupportExecEvent) => SupportExecRes | void,
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
        handle: ((support: Support, event: SupportHandleEvent, ver: VersionWrapper) => SupportBuilderHandleRes | undefined | void) | undefined,
        heal = 0, ver: Version = VERSION[0],
    ) {
        this.card = card;
        this.cnt = cnt;
        this.perCnt = perCnt;
        this.type = type;
        this.heal = heal;
        this.handle = (support, event) => {
            if (event.reset && perCnt > 0) {
                support.perCnt = perCnt;
                return {}
            }
            const { players, pidx, ...oevent } = event;
            const pevent = getEntityHandleEvent(pidx, players, event);
            const cevent: SupportHandleEvent = {
                ...pevent,
                ...oevent,
            };
            const builderRes = handle?.(support, cevent, versionWrap(ver)) ?? {};
            const res: SupportHandleRes = {
                ...builderRes,
                triggers: isCdt(builderRes.triggers, convertToArray(builderRes.triggers) as Trigger[]),
                exec: (support, event) => {
                    const cmds = new CmdsGenerator();
                    const exeres = builderRes.exec?.(support, cmds, event);
                    return { ...exeres, cmds }
                }
            }
            return res;
        };
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
    private _type: SupportType = SUPPORT_TYPE.Permanent;
    private _heal: number = 0;
    private _handle: ((support: Support, event: SupportHandleEvent, ver: VersionWrapper) => SupportBuilderHandleRes | undefined | void) | undefined = () => ({});
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
        this._type = SUPPORT_TYPE.Round;
        this._cnt.set([version, cnt]);
        return this;
    }
    collection(cnt: number = 0, version: Version = 'vlatest') {
        this._type = SUPPORT_TYPE.Collection;
        this._cnt.set([version, cnt]);
        return this;
    }
    permanent(cnt: number = 0, version: Version = 'vlatest') {
        this._type = SUPPORT_TYPE.Permanent;
        this._cnt.set([version, cnt]);
        return this;
    }
    heal(heal: number) {
        this._heal = heal;
        return this;
    }
    handle(handle: (support: Support, event: SupportHandleEvent, ver: VersionWrapper) => SupportBuilderHandleRes | undefined | void) {
        this._handle = handle;
        return this;
    }
    done() {
        if (this._card == undefined) throw new Error("SupportBuilder: card is undefined");
        const perCnt = this._perCnt.get(this._curVersion, 0);
        const cnt = this._cnt.get(this._curVersion, 0);
        return new GISupport(this._card, cnt, perCnt, this._type, this._handle, this._heal, this._curVersion);
    }
}

