import { Card, GameInfo, Hero, Player, Status, Summon, Support, Trigger, VersionWrapper } from "../../../typing.js";
import { DamageType, DICE_TYPE, DiceCostType, DiceType, OFFLINE_VERSION, OfflineVersion, OnlineVersion, SkillType, VERSION, Version } from "../../constant/enum.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { versionWrap } from "../../utils/gameUtil.js";

export class VersionMap<T> {
    private _map: [VersionWrapper, T][] = [];
    constructor() { }
    set(map: [Version, T]) {
        const [version, val] = map;
        const value = this._map.find(([ver]) => ver.eq(version));
        if (value) value[1] = val;
        else this._map.push([versionWrap(version), val]);
    }
    get(version: Version, defaultValue: T): T {
        if (OFFLINE_VERSION.includes(version as OfflineVersion)) {
            const value = this._map.find(([ver]) => OFFLINE_VERSION.includes(ver.value as OfflineVersion));
            if (value) return value[1];
            version = VERSION[0];
        }
        return this._map.sort(([a], [b]) => a.lt(b.ver) ? -1 : 1).find(([ver]) => ver.gt(version))?.[1] ?? defaultValue;
    }
    get versions() {
        return this._map.filter(([v]) => (Array.from(VERSION) as string[]).includes(v.ver)).map(([v]) => v.ver);
    }
}

export class BaseBuilder {
    protected _versionMaps: VersionMap<any>[] = [];
    protected _curVersion: Version = VERSION[0];
    protected _description: VersionMap<string> = this._createVersionMap();
    protected _createVersionMap<T>() {
        const map = new VersionMap<T>();
        this._versionMaps.push(map);
        return map;
    }
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
    get versionChanges() {
        return [...new Set(this._versionMaps.map(map => map.versions).flat())];
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

export interface EntityHandleEvent {
    pidx: number,
    hero: Hero,
    heros: Hero[],
    hidx: number,
    combatStatus: Status[],
    pile: Card[],
    eheros: Hero[],
    ehidx: number,
    eCombatStatus: Status[],
    epile: Card[],
    reset: boolean,
    hcard: Card | null,
    trigger: Trigger,
    summons: Summon[],
    esummons: Summon[],
    switchHeroDiceCnt: number,
    isQuickAction: boolean,
    hcards: Card[],
    ehcards: Card[],
    hcardsCnt: number,
    ehcardsCnt: number,
    heal: number[],
    phase: number,
    ephase: number,
    isChargedAtk: boolean,
    isFallAtk: boolean,
    round: number,
    playerInfo: GameInfo,
    eplayerInfo: GameInfo,
    dices: DiceCostType[],
    dicesCnt: number,
    restDmg: number,
    skid: number,
    sktype: SkillType,
    isSummon: number,
    isExec: boolean,
    supports: Support[],
    esupports: Support[],
    isMinusDiceCard: boolean,
    isMinusDiceTalent: boolean,
    minusDiceCard: number,
    isMinusDiceSkill: boolean,
    minusDiceSkill: number[][],
    dmgedHidx: number,
    getdmg: number[],
    dmg: number[],
    hasDmg: boolean,
    isExecTask: boolean,
    selectHeros: number[],
    selectSummon: number,
    selectSupport: number,
    source: number,
    sourceHidx: number,
    dmgSource: number,
    discards: Card[],
    talent: Card | null,
    slotsDestroyCnt: number[],
    isSelfRound: boolean,
    isSwirlExec: boolean,
    atkHidx: number,
    isFirst: boolean,
    randomInArr: <T>(arr: T[], cnt?: number) => T[],
    randomInt: (max?: number) => number,
    getCardIds: (filter?: (card: Card) => boolean) => number[],
    sourceStatus?: Status,
    dmgElement?: DamageType,
    csummon?: Summon,
}

export interface EntityBuilderHandleEvent extends EntityHandleEvent {
    isMinusDiceWeapon: boolean,
    isMinusDiceRelic: boolean,
    isMinusDiceVehicle: boolean,
    cmds: CmdsGenerator,
    cmdsBefore: CmdsGenerator,
    cmdsAfter: CmdsGenerator,
}

export type InputHandle<T extends {}> = Partial<T> & {
    pidx: number,
    players: Player[],
    randomInArr: <T>(arr: T[], cnt?: number) => T[],
    randomInt: (max?: number) => number,
    getCardIds: (filter?: (card: Card) => boolean) => number[],
};
