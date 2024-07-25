import { DICE_TYPE, DiceType, VERSION, Version } from "../../constant/enum.js";

export class BaseVersionBuilder {
    protected _version: Version = VERSION[0];
    protected _curVersion: Version = VERSION[0];
    protected _getValByVersion<T>(vals: [Version, T][], defaultVal: T) {
        return vals.sort(([a], [b]) => a < b ? -1 : 1).find(([ver]) => ver > this._curVersion)?.[1] ?? defaultVal;
    }
    since(version: Version) {
        this._version = version;
        return this;
    }
    version(version: Version | undefined) {
        if (version != undefined) this._curVersion = version;
        return this;
    }
}

export class BaseBuilder extends BaseVersionBuilder {
    protected _id: number = -1;
    protected _shareId: number;
    protected _name: string = '无';
    protected _cost: [Version, number][] = [];
    protected _costType: DiceType = DICE_TYPE.Same;
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
    cost(cost: number, type: DiceType, version: Version = 'vlatest') {
        this._cost.push([version, cost]);
        this._costType = type;
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
    costAnemo(cost: number) {
        return this.cost(cost, DICE_TYPE.Anemo);
    }
    costGeo(cost: number) {
        return this.cost(cost, DICE_TYPE.Geo);
    }
    costDendro(cost: number) {
        return this.cost(cost, DICE_TYPE.Dendro);
    }
    costSame(cost: number) {
        return this.cost(cost, DICE_TYPE.Same);
    }
    costAny(cost: number) {
        return this.cost(cost, DICE_TYPE.Any);
    }
}
