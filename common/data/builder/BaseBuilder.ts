import { DICE_TYPE, DiceType, VERSION, Version } from "../../constant/enum.js";

export class BaseVersionBuilder {
    protected _version: Version = VERSION[0];
    protected _getValByVersion<T>(vals: [Version, T][], defaultVal?: T) {
        const [, val = defaultVal] = vals.sort(([a], [b]) => a < b ? 1 : -1).find(([ver]) => ver <= this._version) ?? [];
        return val;
    }
}

export class BaseBuilder extends BaseVersionBuilder {
    protected _id: number;
    protected _shareId: number;
    protected _name: string = '无';
    protected _cost: number = 0;
    protected _costType: DiceType = DICE_TYPE.Same;
    constructor(id: number, shareId: number) {
        super();
        this._id = id;
        this._shareId = shareId;
        this._version = 'v3.3.0';
    }
    name(name: string) {
        this._name = name;
        return this;
    }
    since(version: Version) {
        this._version = version;
        return this;
    }
    cost(cost: number, type: DiceType) {
        this._cost = cost;
        this._costType = type;
        return this;
    }
    costCryo(cost: number) {
        return this.cost(cost, DICE_TYPE.Cryo);
    }
    costHydor(cost: number) {
        return this.cost(cost, DICE_TYPE.Hydro);
    }
    costPyro(cost: number) {
        return this.cost(cost, DICE_TYPE.Pyro);
    }
    costElectro(cost: number) {
        return this.cost(cost, DICE_TYPE.Electro);
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
