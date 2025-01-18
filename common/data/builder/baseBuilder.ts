import { VersionCompareFn } from "../../../typing.js";
import { DICE_TYPE, DiceType, OFFLINE_VERSION, OfflineVersion, OnlineVersion, VERSION, Version } from "../../constant/enum.js";
import { compareVersionFn } from "../../utils/gameUtil.js";

export class VersionMap<T> {
    private _map: [VersionCompareFn, T][] = [];
    constructor() { }
    set(map: [Version, T]) {
        const [version, val] = map;
        const value = this._map.find(([ver]) => ver.eq(version));
        if (value) value[1] = val;
        else this._map.push([compareVersionFn(version), val]);
    }
    get(version: Version, defaultValue: T): T {
        if (OFFLINE_VERSION.includes(version as OfflineVersion)) {
            const value = this._map.find(([ver]) => OFFLINE_VERSION.includes(ver.value as OfflineVersion));
            if (value) return value[1];
            version = VERSION[0];
        }
        return this._map.sort(([a], [b]) => a.lt(b.value) ? -1 : 1).find(([ver]) => ver.gt(version))?.[1] ?? defaultValue;
    }
}

export class BaseBuilder {
    protected _curVersion: Version = VERSION[0];
    protected _description: VersionMap<string> = new VersionMap();
    version(version: Version | undefined) {
        if (version == 'vlatest') version = VERSION[0];
        if (version != undefined) this._curVersion = version;
        return this;
    }
    description(description: string, ...versions: Version[]) {
        if (versions.length == 0) versions = ['vlatest'];
        versions.forEach(v => this._description.set([v, description]));
        return this;
    }
}

export class BaseCostBuilder extends BaseBuilder {
    protected _id: number = -1;
    protected _shareId: number;
    protected _name: string = '无';
    protected _version: OnlineVersion = VERSION[0];
    protected _offlineVersion: OfflineVersion | null = null;
    protected _cost: VersionMap<number> = new VersionMap();
    protected _costType: VersionMap<DiceType> = new VersionMap();
    ;
    constructor(shareId: number) {
        super();
        this._shareId = shareId;
        this._version = 'v3.3.0';
    }
    id(id: number) {
        this._id = id;
        return this;
    }
    name(name: string) {
        this._name = name;
        return this;
    }
    since(version: OnlineVersion) {
        this._version = version;
        return this;
    }
    offline(offlineVersion: OfflineVersion) {
        this._offlineVersion = offlineVersion;
        return this;
    }
    cost(cost: number, type: DiceType = DICE_TYPE.Same, version: Version = 'vlatest') {
        this._cost.set([version, cost]);
        this._costType.set([version, type]);
        return this;
    }
    costCryo(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Cryo, version);
    }
    costHydro(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Hydro, version);
    }
    costPyro(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Pyro, version);
    }
    costElectro(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Electro, version);
    }
    costAnemo(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Anemo, version);
    }
    costGeo(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Geo, version);
    }
    costDendro(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Dendro, version);
    }
    costSame(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Same, version);
    }
    costAny(cost: number, version?: Version) {
        return this.cost(cost, DICE_TYPE.Any, version);
    }
}
