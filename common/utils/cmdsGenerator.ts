import { Card, Cmd, Cmds, Status, Summon, Trigger } from "../../typing";
import { CMD_MODE, CardSubtype, CardTag, DamageType, DiceCostType, ELEMENT_TYPE, ElementType, SkillType } from "../constant/enum.js";
import { convertToArray, isCdt } from "./utils.js";

export default class CmdsGenerator {
    value: Cmds[];
    private _addType: 'push' | 'unshift' = 'push';
    constructor(cmds?: Cmds | Cmds[] | CmdsGenerator) {
        if (cmds == undefined) this.value = [];
        else if (cmds instanceof CmdsGenerator) this.value = [...cmds.value];
        else this.value = convertToArray(cmds);
    }
    static get ins() {
        return new CmdsGenerator();
    }
    get isUseSkill() {
        return this.value.some(({ cmd, cnt = 0 }) => cmd == 'useSkill' && cnt > 0);
    }
    get length() {
        return this.value.length;
    }
    get isEmpty() {
        return this.value.length == 0;
    }
    get notEmpty() {
        return this.value.length > 0;
    }
    get unshift() {
        this._addType = 'unshift';
        return this;
    }
    get push() {
        this._addType = 'push';
        return this;
    }
    get isSwitch() {
        return this.value.some(({ cmd }) => cmd.includes('switch'));
    }
    get hasDamage() {
        return this.hasCmds('heal', 'addMaxHp', 'revive') || this.getCmdCnt('attack') != undefined;
    }
    get isPriority() {
        return this.value.some(({ cmd, mode }) => cmd == 'attack' && mode == CMD_MODE.IsPriority);
    }
    get res() {
        this._addType = 'push';
        return undefined;
    }
    private _add(...cmd: Cmds[]) {
        if (this._addType == 'push') this.value.push(...cmd);
        else this.value.unshift(...cmd);
    }
    getDice(cnt: number, options: { element?: (DiceCostType | 'Physical') | (DiceCostType | 'Physical')[], mode?: number, frontOffset?: 1 | -1 } = {}) {
        const { element, mode, frontOffset } = options;
        if (element == ELEMENT_TYPE.Physical) return this;
        this._add({
            cmd: 'getDice',
            cnt,
            element,
            mode,
            hidxs: isCdt(frontOffset && mode == CMD_MODE.FrontHero, [frontOffset!]),
        });
        return this;
    }
    getCard(cnt: number, options: {
        subtype?: CardSubtype | CardSubtype[], cardTag?: CardTag | CardTag[],
        card?: Card | (Card | number)[] | number, exclude?: number | number[], include?: number | number[],
        isOppo?: boolean, isFromPile?: boolean, until?: boolean, mode?: number,
    } = {}) {
        const { subtype, cardTag, card, exclude, include, isOppo, isFromPile, until, mode } = options;
        this._add({
            cmd: 'getCard',
            cnt,
            subtype,
            cardTag,
            card,
            hidxs: convertToArray(isCdt(subtype || cardTag, exclude, include)),
            isOppo,
            isAttach: isCdt(card || subtype || cardTag, isFromPile),
            mode,
            status: +!!until,
        });
        return this;
    }
    getEnergy(cnt: number, options: { hidxs?: number | number[], isOppo?: boolean, isSp?: boolean } = {}) {
        if (cnt == 0) return this;
        let { hidxs, isOppo, isSp: isAttach } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this._add({ cmd: 'getEnergy', cnt, hidxs, isOppo, isAttach });
        return this;
    }
    heal(cnt?: number, options: { hidxs?: number | number[], isOrder?: boolean, notPreHeal?: boolean, isOppo?: boolean } = {}) {
        let { hidxs, isOrder, notPreHeal: isAttach, isOppo } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        if (hidxs?.length != 0) this._add({ cmd: 'heal', cnt, hidxs, mode: isCdt(isOrder, CMD_MODE.ByOrder), isAttach, isOppo });
        return this;
    }
    revive(cnt: number, hidxs?: number | number[]) {
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this._add({ cmd: 'revive', cnt, hidxs });
        return this;
    }
    addMaxHp(cnt: number, hidxs?: number | number[], isOrder?: boolean) {
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        if (hidxs?.length != 0) this._add({ cmd: 'addMaxHp', cnt, hidxs, mode: isCdt(isOrder, CMD_MODE.ByOrder) });
        return this;
    }
    getStatus(status: number | (number | Status | [number, ...any[]])[] | undefined, options: {
        hidxs?: number | number[], isOppo?: boolean, isPriority?: boolean,
    } = {}) {
        let { hidxs, isOppo, isPriority } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        if (status != undefined) this._add({ cmd: 'getStatus', status, hidxs, isOppo, mode: isCdt(isPriority, CMD_MODE.IsPriority) });
        return this;
    }
    getSummon(summon: number | (number | Summon | [number, ...any[]])[] | undefined, options: { isOppo?: boolean, destroy?: number } = {}) {
        const { isOppo, destroy } = options;
        if (summon != undefined) this._add({ cmd: 'getSummon', summon, isOppo, mode: destroy });
        return this;
    }
    getSupport(support: number | (number | [number, ...any[]])[] | undefined, options: { isOppo?: boolean } = {}) {
        const { isOppo } = options;
        if (support != undefined) this._add({ cmd: 'getSupport', summon: support, isOppo });
        return this;
    }
    destroySummon(options: { cnt?: number, isOppo?: boolean, summon?: number } = {}) {
        const { cnt = 1, isOppo, summon } = options;
        this._add({ cmd: 'destroySummon', cnt, isOppo, summon });
        return this;
    }
    reroll(cnt: number) {
        this._add({ cmd: 'reroll', cnt });
        return this;
    }
    switchTo(hidx?: number, isOppo?: boolean) {
        if (hidx != undefined) this._add({ cmd: 'switch-to', hidxs: [hidx], isOppo });
        return this;
    }
    switchBefore(isOppo?: boolean) {
        this._add({ cmd: 'switch-before', isOppo });
        return this;
    }
    switchAfter(isOppo?: boolean) {
        this._add({ cmd: 'switch-after', isOppo });
        return this;
    }
    attach(options: { element?: ElementType | ElementType[], hidxs?: number | number[], isOppo?: boolean } = {}) {
        let { element, hidxs, isOppo } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this._add({ cmd: 'attach', element, hidxs, isOppo });
        return this;
    }
    attack(damage?: number, element?: DamageType | DamageType[], options: {
        hidxs?: number | number[], isOppo?: boolean, isPriority?: boolean, isOrder?: boolean,
    } = {}) {
        let { hidxs, isOppo, isPriority, isOrder } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        if (hidxs?.length == 0) return this;
        const mode = isPriority ? CMD_MODE.IsPriority : isOrder ? CMD_MODE.ByOrder : 0;
        this._add({ cmd: 'attack', cnt: damage, element, hidxs, isOppo, mode });
        return this;
    }
    changeDice(options: { cnt?: number, element?: DiceCostType, isFront?: boolean } = {}) {
        const { cnt, element, isFront } = options;
        this._add({ cmd: 'changeDice', cnt, element, mode: isCdt(isFront, CMD_MODE.FrontHero) });
        return this;
    }
    changeCard() {
        this._add({ cmd: 'changeCard' });
        return this;
    }
    changeSummon(changedSmnIdOrIdx: number, newSmnId: number) {
        this._add({ cmd: 'changeSummon', cnt: newSmnId, hidxs: [changedSmnIdOrIdx] });
        return this;
    }
    changePattern(changedHidx: number, newHid: number) {
        this._add({ cmd: 'changePattern', cnt: newHid, hidxs: [changedHidx] });
        return this;
    }
    useSkill(options: {
        skillId?: number, skillType?: SkillType, isOppo?: boolean, selectSummon?: number,
        summonTrigger?: Trigger | Trigger[], hidx?: number,
    }) {
        const { skillId, skillType, isOppo, selectSummon = -1, summonTrigger, hidx } = options;
        this._add({
            cmd: 'useSkill',
            cnt: skillType ?? skillId ?? -1,
            trigger: summonTrigger,
            hidxs: isCdt(selectSummon > -1, [selectSummon]),
            status: hidx,
            isOppo,
        });
        return this;
    }
    summonTrigger(options: { selectSummon?: number | number[], trigger?: Trigger | Trigger[], isOppo?: boolean, isRandom?: boolean, isAll?: boolean } = {}) {
        const { selectSummon, trigger = 'phase-end', isOppo, isRandom, isAll } = options;
        const mode = isCdt(isRandom, CMD_MODE.Random, isCdt(isAll, CMD_MODE.ByOrder));
        this._add({ cmd: 'summonTrigger', hidxs: convertToArray(selectSummon), trigger, isOppo, mode })
        return this;
    }
    getSkill(hidx: number, skillId: number, skidx: number) {
        this._add({ cmd: 'getSkill', cnt: skillId, hidxs: [hidx], mode: skidx });
        return this;
    }
    loseSkill(hidx: number, skidx: number) {
        this._add({ cmd: 'loseSkill', hidxs: [hidx], mode: skidx });
        return this;
    }
    addCard(cnt: number, card: Card | (Card | number)[] | number,
        options: { scope?: number, isRandom?: boolean, isNotPublic?: boolean, addTo?: number, isOppo?: boolean } = {}
    ) {
        const { scope, isRandom = true, isNotPublic, addTo, isOppo } = options;
        const hidx = addTo ?? scope;
        this._add({
            cmd: 'addCard',
            cnt: cnt * (addTo ? -1 : 1),
            hidxs: isCdt(hidx != undefined, [hidx!]),
            isAttach: !isRandom,
            card,
            mode: isCdt(isNotPublic, CMD_MODE.IsNotPublic),
            isOppo,
        });
        return this;
    }
    discard(options: {
        cnt?: number, card?: Card | (Card | number)[] | number, isOppo?: boolean,
        notTrigger?: boolean, cidxs?: number[], mode?: number,
    }) {
        const { cnt, card, isOppo, notTrigger: isAttach, cidxs: hidxs, mode } = options;
        this._add({ cmd: 'discard', cnt, card, isOppo, isAttach, hidxs, mode });
        return this;
    }
    stealCard(cnt: number, mode: number) {
        this._add({ cmd: 'stealCard', cnt, mode });
        return this;
    }
    putCard(options: { card?: Card | (Card | number)[] | number, cnt?: number, mode?: number, isOppo?: boolean } = {}) {
        const { card, cnt = 0, mode, isOppo } = options;
        this._add({ cmd: 'putCard', card, cnt, mode, isOppo });
        return this;
    }
    pickCard(cnt: number, mode: number, options: {
        card?: number[], subtype?: CardSubtype | CardSubtype[], cardTag?: CardTag | CardTag[], isSpecify?: boolean,
    } = {}) {
        const { card, subtype, cardTag, isSpecify: isAttach } = options;
        this._add({ cmd: 'pickCard', cnt, card, mode, subtype, cardTag, isAttach });
        return this;
    }
    equip(hidxs: number | number[], card?: Card | number, isOppo?: boolean) {
        hidxs = convertToArray(hidxs);
        if (card != undefined) this._add({ cmd: 'equip', hidxs, card, isOppo });
        return this;
    }
    exchangePos(hidx1: number, hidx2: number = -1) {
        this._add({ cmd: 'exchangePos', hidxs: [hidx1, hidx2] });
        return this;
    }
    exchangeHandCards() {
        this._add({ cmd: 'exchangeHandCards' });
        return this;
    }
    consumeNightSoul(hidx?: number, cnt: number = 1) {
        const hidxs = hidx != undefined ? convertToArray(hidx) : hidx;
        this._add({ cmd: 'consumeNightSoul', cnt, hidxs });
        return this;
    }
    getNightSoul(cnt: number = 1, hidx?: number) {
        this._add({ cmd: 'getNightSoul', hidxs: hidx != undefined ? [hidx] : undefined, cnt });
        return this;
    }
    consumeDice(diceSelect?: boolean[] | number) {
        this._add({ cmd: 'consumeDice', hidxs: typeof diceSelect == 'number' ? [-diceSelect] : diceSelect?.map(Number) });
        return this;
    }
    convertCard(eid: number, cid: number) {
        this._add({ cmd: 'convertCard', hidxs: [eid, cid] });
        return this;
    }
    adventure() {
        this._add({ cmd: 'adventure' });
        return this;
    }
    callback(cb: () => void) {
        if (this.value.length > 0) this.value[this.value.length - 1].callback = cb;
        return this;
    }
    addCmds(cmds?: Cmds | Cmds[] | CmdsGenerator) {
        if (cmds != undefined) this._add(...(Array.isArray(cmds) ? cmds : cmds instanceof CmdsGenerator ? cmds.value : [cmds]));
        return this;
    }
    hasCmds(...cmds: Cmd[]) {
        return this.value.some(({ cmd }) => cmds.includes(cmd));
    }
    filterCmds(...cmds: Cmd[]) {
        return this.value.filter(({ cmd }) => cmds.includes(cmd));
    }
    getCmdCnt(cmd1: Cmd) {
        return this.value.find(({ cmd }) => cmd == cmd1)?.cnt;
    }
    clear() {
        this.value = [];
        this._addType = 'push';
        return this;
    }
}