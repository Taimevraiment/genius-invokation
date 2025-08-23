import { Card, GameInfo, Hero, Player, Skill, Status, Summon, Support, Trigger, VersionWrapper } from "../../../typing.js";
import { DamageType, DICE_TYPE, DiceCostType, DiceType, OFFLINE_VERSION, OfflineVersion, OnlineVersion, SkillType, StatusType, VERSION, Version } from "../../constant/enum.js";
import CmdsGenerator from "../../utils/cmdsGenerator.js";
import { getObjById, hasObjById, versionWrap } from "../../utils/gameUtil.js";

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

export class ArrayHero extends Array<Hero> {
    constructor(...args: any[]) {
        super(...args);
    }
    get frontHidx() {
        return this.findIndex(h => h.isFront);
    }
    // 获取所有存活/死亡角色的索引hidx
    allHidxs(options: { isDie?: boolean, isAll?: boolean, exclude?: number, cdt?: (h: Hero) => boolean, limit?: number } = {}) {
        const { isDie = false, isAll = false, cdt = () => true, limit = -1, exclude = -1 } = options;
        if (this.frontHidx == -1 || limit == 0) return [];
        const hidxs: number[] = [];
        for (let i = 0; i < this.length; ++i) {
            const hi = (this.frontHidx + i) % this.length;
            const h = this[hi];
            if (isAll || ((isDie ? h.hp <= 0 : h.hp > 0) && exclude != hi && cdt(h))) {
                hidxs.push(hi);
                if (hidxs.length == limit) break;
            }
        }
        return hidxs;
    }
    // 获得出战角色(或按出战顺序前/后的角色)
    getFront(options: { offset?: number, isAll?: boolean } = {}) {
        const { offset = 0, isAll } = options;
        const aliveHidxs = this.allHidxs({ isAll });
        const fidx = aliveHidxs.findIndex(i => i == this.frontHidx);
        if (fidx == -1) return;
        return this[aliveHidxs[(fidx + offset + aliveHidxs.length) % aliveHidxs.length]];
    }
    // 获得距离出战角色最近的hidx
    getNearestHidx(hidx: number = -1) {
        if (hidx == -1) return -1;
        const livehidxs = this.allHidxs();
        let minDistance = livehidxs.length;
        let hidxs: number[] = [];
        for (const hi of livehidxs) {
            const distance = Math.min(Math.abs(hi - hidx), hi + this.length - hidx);
            if (distance == 0) return hi;
            if (distance == minDistance) hidxs.push(hi);
            else if (distance < minDistance) {
                minDistance = distance;
                hidxs = [hi];
            }
        }
        if (hidxs.length == 0) return -1;
        return Math.min(...hidxs);
    }
    // 获取受伤最多的角色的hidxs(最多一个number的数组)
    getMaxHertHidxs(options: { isBack?: boolean } = {}) {
        const { isBack = false } = options;
        if (this.frontHidx == -1) return [];
        const maxHert = Math.max(...this.filter(h => h.hp > 0 && (!isBack || !h.isFront)).map(h => h.maxHp - h.hp));
        if (maxHert == 0) return [];
        const hidxs: number[] = [];
        for (let i = +isBack; i < this.length; ++i) {
            const hidx = (i + this.frontHidx) % this.length;
            const hert = this[hidx].maxHp - this[hidx].hp;
            if (this[hidx].hp > 0 && hert == maxHert) {
                hidxs.push(hidx);
                break;
            }
        }
        return hidxs;
    }
    // 获取受伤最少的角色的hidx(最多一个number的数组)
    getMinHertHidxs() {
        if (this.frontHidx == -1) return [];
        const minHert = Math.min(...this.filter(h => h.hp > 0).map(h => h.maxHp - h.hp));
        const hidxs: number[] = [];
        for (let i = 0; i < this.length; ++i) {
            const hidx = (i + this.frontHidx) % this.length;
            const hert = this[hidx].maxHp - this[hidx].hp;
            if (this[hidx].hp > 0 && hert == minHert) {
                hidxs.push(hidx);
                break;
            }
        }
        return hidxs;
    }
    // 获取生命值最低角色的hidx(只有一个number的数组)
    getMinHpHidxs() {
        if (this.frontHidx == -1) return [];
        const minHp = Math.min(...this.filter(h => h.hp > 0).map(h => h.hp));
        const hidxs: number[] = [];
        for (let i = 0; i < this.length; ++i) {
            const hidx = (i + this.frontHidx) % this.length;
            if (this[hidx].hp == minHp) {
                hidxs.push(hidx);
                break;
            }
        }
        return hidxs;
    }
    // 获得所有后台角色hidx
    getBackHidxs(limit?: number) {
        return this.allHidxs({ exclude: this.frontHidx, limit });
    }
    // 获得下一个后台角色hidx(只有一个number的数组)
    getNextBackHidx() {
        return this.getBackHidxs(1);
    }
}

export class ArrayStatus extends Array<Status> {
    constructor(...args: any[]) {
        super(...args);
    }
    filter(predicate: (value: Status, index: number, array: Status[]) => unknown, thisArg?: any): ArrayStatus {
        return super.filter(predicate, thisArg) as ArrayStatus;
    }
    get(id: number | StatusType) {
        if (typeof id == 'number') return getObjById(this, id);
        return this.find(s => s.hasType(id));
    }
    has(id: number | StatusType) {
        if (typeof id == 'number') return hasObjById(this, id);
        return this.some(s => s.hasType(id));
    }
}

export interface EntityHandleEvent {
    pidx: number,
    hero: Hero,
    heros: ArrayHero,
    hidx: number,
    combatStatus: ArrayStatus,
    pile: Card[],
    eheros: ArrayHero,
    ehidx: number,
    eCombatStatus: ArrayStatus,
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
    skill?: Skill,
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
