import { Card, Cmd, Cmds, Status, Trigger } from "../../typing";
import { CMD_MODE, CardSubtype, CardTag, DamageType, DiceCostType, ELEMENT_TYPE, ElementType, SkillType } from "../constant/enum.js";
import { convertToArray, isCdt } from "./utils.js";

export default class CmdsGenerator {
    value: Cmds[];
    constructor(cmds?: Cmds | Cmds[] | CmdsGenerator) {
        if (cmds == undefined) this.value = [];
        else if (cmds instanceof CmdsGenerator) this.value = [...cmds.value];
        else this.value = convertToArray(cmds);
    }
    get isUseSkill() {
        return this.value.some(({ cmd, cnt = 0 }) => cmd == 'useSkill' && cnt > 0);
    }
    get length() {
        return this.value.length;
    }
    get isSwitch() {
        return this.value.some(({ cmd }) => cmd.includes('switch'));
    }
    get res() {
        return;
    }
    getDice(cnt: number, options: { element?: (DiceCostType | 'Physical') | (DiceCostType | 'Physical')[], mode?: number, frontOffset?: 1 | -1 } = {}) {
        const { element, mode, frontOffset } = options;
        if (element == ELEMENT_TYPE.Physical) return this;
        this.value.push({
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
        card?: Card | (Card | number)[] | number, exclude?: number[], include?: number[],
        isOppo?: boolean, isFromPile?: boolean, until?: boolean,
    } = {}) {
        const { subtype, cardTag, card, exclude, include, isOppo, isFromPile, until } = options;
        this.value.push({
            cmd: 'getCard',
            cnt,
            subtype,
            cardTag,
            card,
            hidxs: isCdt(subtype || cardTag, exclude, include),
            isOppo,
            isAttach: isCdt(card || subtype || cardTag, isFromPile),
            mode: +!!until,
        });
        return this;
    }
    getEnergy(cnt: number, options: { hidxs?: number | number[], isOppo?: boolean, isSp?: boolean } = {}) {
        let { hidxs, isOppo, isSp: isAttach } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this.value.push({ cmd: 'getEnergy', cnt, hidxs, isOppo, isAttach });
        return this;
    }
    heal(cnt?: number, options: { hidxs?: number | number[], order?: number, notPreHeal?: boolean } = {}) {
        let { hidxs, order: mode, notPreHeal: isAttach } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this.value.push({ cmd: 'heal', cnt, hidxs, mode, isAttach });
        return this;
    }
    smnHeal(options?: { hidxs?: number | number[], order?: number, notPreHeal?: boolean }) {
        this.heal(undefined, options);
        return this;
    }
    revive(cnt: number, hidxs?: number | number[]) {
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this.value.push({ cmd: 'revive', cnt, hidxs });
        return this;
    }
    addMaxHp(cnt: number, hidxs?: number | number[], order?: number) {
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this.value.push({ cmd: 'addMaxHp', cnt, hidxs, mode: order });
        return this;
    }
    getStatus(status: number | (number | Status | [number, ...any[]])[] | undefined, options: { hidxs?: number | number[], isOppo?: boolean } = {}) {
        let { hidxs, isOppo } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this.value.push({ cmd: 'getStatus', status, hidxs, isOppo });
        return this;
    }
    reroll(cnt: number) {
        this.value.push({ cmd: 'reroll', cnt });
        return this;
    }
    switchTo(hidx?: number, isOppo?: boolean) {
        if (hidx != undefined) this.value.push({ cmd: 'switch-to', hidxs: [hidx], isOppo });
        return this;
    }
    switchBefore(isOppo?: boolean) {
        this.value.push({ cmd: 'switch-before', isOppo });
        return this;
    }
    switchAfter(isOppo?: boolean) {
        this.value.push({ cmd: 'switch-after', isOppo });
        return this;
    }
    attach(options: { element?: ElementType | ElementType[], hidxs?: number | number[], isOppo?: boolean } = {}) {
        let { element, hidxs, isOppo } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this.value.push({ cmd: 'attach', element, hidxs, isOppo });
        return this;
    }
    attack(damage?: number, element?: DamageType | DamageType[], options: { hidxs?: number | number[], isOppo?: boolean } = {}) {
        let { hidxs, isOppo } = options;
        hidxs = hidxs != undefined ? convertToArray(hidxs) : hidxs;
        this.value.push({ cmd: 'attack', cnt: damage, element, hidxs, isOppo });
        return this;
    }
    smnAttack(options: { hidxs?: number | number[], isOppo?: boolean } = {}) {
        this.attack(undefined, undefined, options);
        return this;
    }
    changeDice(options: { cnt?: number, element?: DiceCostType, isFront?: boolean } = {}) {
        const { cnt, element, isFront } = options;
        this.value.push({ cmd: 'changeDice', cnt, element, mode: isCdt(isFront, CMD_MODE.FrontHero) });
        return this;
    }
    changeCard() {
        this.value.push({ cmd: 'changeCard' });
        return this;
    }
    changeSummon(changedSmnIdOrIdx: number, newSmnId: number) {
        this.value.push({ cmd: 'changeSummon', cnt: newSmnId, hidxs: [changedSmnIdOrIdx] });
        return this;
    }
    changePattern(changedHidx: number, newHid: number) {
        this.value.push({ cmd: 'changePattern', cnt: newHid, hidxs: [changedHidx] });
        return this;
    }
    useSkill(options: {
        skillId?: number, skillType?: SkillType, isOppo?: boolean,
        isReadySkill?: boolean, selectSummon?: number, summonTrigger?: Trigger | Trigger[],
    }) {
        const { skillId, skillType, isOppo, isReadySkill: isAttach, selectSummon, summonTrigger } = options;
        this.value.push({
            cmd: 'useSkill',
            cnt: skillType ?? skillId ?? -1,
            isAttach,
            summonTrigger,
            hidxs: isCdt(selectSummon, [selectSummon!]),
            isOppo,
        });
        return this;
    }
    summonTrigger(selectSummon: number, isOppo?: boolean) {
        this.useSkill({ skillId: -2, selectSummon, summonTrigger: 'phase-end', isOppo });
        return this;
    }
    getSkill(hidx: number, skillId: number, skidx: number) {
        this.value.push({ cmd: 'getSkill', cnt: skillId, hidxs: [hidx], mode: skidx });
        return this;
    }
    loseSkill(hidx: number, skidx: number) {
        this.value.push({ cmd: 'loseSkill', hidxs: [hidx], mode: skidx });
        return this;
    }
    addCard(cnt: number, card: Card | (Card | number)[] | number,
        options: { scope?: number, isRandom?: boolean, isNotPublic?: boolean, addTo?: number, isOppo?: boolean } = {}
    ) {
        const { scope, isRandom = true, isNotPublic, addTo, isOppo } = options;
        const hidx = addTo ?? scope;
        this.value.push({
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
        this.value.push({ cmd: 'discard', cnt, card, isOppo, isAttach, hidxs, mode });
        return this;
    }
    stealCard(cnt: number, mode: number) {
        this.value.push({ cmd: 'stealCard', cnt, mode });
        return this;
    }
    putCard(card: Card | (Card | number)[] | number, scope: number) {
        this.value.push({ cmd: 'putCard', card, hidxs: [scope] });
        return this;
    }
    pickCard(cnt: number, mode: number, options: {
        card?: number[], subtype?: CardSubtype | CardSubtype[], cardTag?: CardTag | CardTag[],
        skillId?: number, isSpecify?: boolean,
    } = {}) {
        const { card, subtype, cardTag, skillId, isSpecify: isAttach } = options;
        this.value.push({ cmd: 'pickCard', cnt, card, mode, subtype, cardTag, hidxs: isCdt(skillId, [skillId!]), isAttach });
        return this;
    }
    equip(hidxs: number | number[], card?: Card | number, isOppo?: boolean) {
        hidxs = convertToArray(hidxs);
        this.value.push({ cmd: 'equip', hidxs, card, isOppo });
        return this;
    }
    exchangePos(hidx1: number, hidx2: number) {
        this.value.push({ cmd: 'exchangePos', hidxs: [hidx1, hidx2] });
        return this;
    }
    exchangeHandCards() {
        this.value.push({ cmd: 'exchangeHandCards' });
        return this;
    }
    consumeNightSoul(hidx?: number, cnt: number = 1) {
        const hidxs = hidx != undefined ? convertToArray(hidx) : hidx;
        this.value.push({ cmd: 'consumeNightSoul', cnt, hidxs });
        return this;
    }
    consumeDice(diceSelect: boolean[] | number) {
        this.value.push({ cmd: 'consumeDice', hidxs: typeof diceSelect == 'number' ? [-diceSelect] : diceSelect.map(Number) });
        return this;
    }
    convertCard(eid: number, cid: number) {
        this.value.push({ cmd: 'convertCard', hidxs: [eid, cid] });
        return this;
    }
    addCmds(cmds?: Cmds[] | CmdsGenerator) {
        if (cmds != undefined) this.value.push(...(Array.isArray(cmds) ? cmds : cmds.value));
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
    reverse() {
        this.value.reverse();
        return this;
    }
    order() {
        this.value.forEach((cmds, i) => cmds.mode = i);
        return this;
    }
    clear() {
        this.value = [];
        return this;
    }
}