import { Card, Support, VersionCompareFn } from "../../../typing";
import { SUPPORT_TYPE, SupportType, VERSION, Version } from "../../constant/enum.js";
import { compareVersionFn } from "../../utils/gameUtil.js";
import { SupportHandleEvent, SupportHandleRes } from "../supports.js";
import { BaseBuilder, VersionMap } from "./baseBuilder.js";

export class GISupport {
    entityId: number = -1; // 实体id
    card: Card; // 场地卡
    cnt: number; // 次数
    perCnt: number; // 每回合x次
    heal: number; // 回血数
    type: SupportType; // 类型 1轮次 2收集物 3常驻
    handle: (support: Support, event?: SupportHandleEvent) => SupportHandleRes; // 处理效果函数

    constructor(
        card: Card, cnt: number, perCnt: number, type: SupportType,
        handle: ((support: Support, event: SupportHandleEvent, ver: VersionCompareFn) => SupportHandleRes | undefined | void) | undefined,
        heal = 0, ver: Version = VERSION[0],
    ) {
        this.card = card;
        this.cnt = cnt;
        this.perCnt = perCnt;
        this.type = type;
        this.heal = heal;
        this.handle = (support, event = {}) => {
            const { reset = false } = event;
            if (reset && perCnt > 0) {
                support.perCnt = perCnt;
                return {}
            }
            return handle?.(support, event, compareVersionFn(ver)) ?? {};
        };
    }
    setEntityId(id: number): Support {
        this.entityId = id;
        return this;
    }
}

export class SupportBuilder extends BaseBuilder {
    private _card: Card | undefined;
    private _cnt: number = 0;
    private _perCnt: VersionMap<number> = new VersionMap();
    private _type: SupportType = SUPPORT_TYPE.Permanent;
    private _heal: number = 0;
    private _handle: ((support: Support, event: SupportHandleEvent, ver: VersionCompareFn) => SupportHandleRes | undefined | void) | undefined = () => ({});
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
    round(cnt: number) {
        this._type = SUPPORT_TYPE.Round;
        this._cnt = cnt;
        return this;
    }
    collection(cnt: number = 0) {
        this._type = SUPPORT_TYPE.Collection;
        this._cnt = cnt;
        return this;
    }
    permanent(cnt: number = 0) {
        this._type = SUPPORT_TYPE.Permanent;
        this._cnt = cnt;
        return this;
    }
    heal(heal: number) {
        this._heal = heal;
        return this;
    }
    handle(handle: (support: Support, event: SupportHandleEvent, ver: VersionCompareFn) => SupportHandleRes | undefined | void) {
        this._handle = handle;
        return this;
    }
    done() {
        if (this._card == undefined) throw new Error("SupportBuilder: card is undefined");
        const perCnt = this._perCnt.get(this._curVersion, 0);
        return new GISupport(this._card, this._cnt, perCnt, this._type, this._handle, this._heal, this._curVersion);
    }
}

