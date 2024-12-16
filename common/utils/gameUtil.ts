import { Card, Hero, Player, Skill, Status, Summon, Support } from "../../typing";
import { COST_TYPE, DICE_COST_TYPE, DICE_TYPE, DiceCostType, ELEMENT_CODE_KEY, ElementCode, ElementType, OFFLINE_VERSION, OfflineVersion, Version } from "../constant/enum.js";
import { arrToObj, objToArr } from "./utils.js";

// 获取所有存活/死亡角色的索引hidx
export const allHidxs = (heros?: Hero[], options: {
    isDie?: boolean, exclude?: number, include?: number, isAll?: boolean, cdt?: (h: Hero) => boolean,
} = {}): number[] => {
    const { isDie = false, exclude = -1, include = -1, isAll = false, cdt = () => true } = options;
    const hidx = heros?.findIndex(h => h.isFront) ?? -1;
    if (!heros || hidx == -1) return [];
    const hidxs: number[] = [];
    for (let i = 0; i < heros.length; ++i) {
        const hi = (hidx + i) % heros.length;
        const h = heros[hi];
        if (isAll || include == hi || ((isDie ? h.hp < 0 : h.hp >= 0) && exclude != hi && cdt(h))) hidxs.push(hi);
    }
    return hidxs;
}

// 获取受伤最多的角色的hidxs(只有一个number的数组)
export const getMaxHertHidxs = (heros: Hero[], options: { fhidx?: number, isBack?: boolean } = {}): number[] => {
    const { fhidx = heros.findIndex(h => h.isFront), isBack = false } = options;
    if (fhidx == -1) return [];
    const maxHert = Math.max(...heros.filter(h => h.hp > 0 && (!isBack || !h.isFront)).map(h => h.maxHp - h.hp));
    if (maxHert == 0) return [];
    const hidxs: number[] = [];
    for (let i = +isBack; i < heros.length; ++i) {
        const hidx = (i + fhidx) % heros.length;
        const hert = heros[hidx].maxHp - heros[hidx].hp;
        if (heros[hidx].hp > 0 && hert == maxHert) {
            hidxs.push(hidx);
            break;
        }
    }
    return hidxs;
}

// 获取受伤最少的角色的hidxs(只有一个number的数组)
export const getMinHertHidxs = (heros: Hero[], fhidx?: number): number[] => {
    fhidx = fhidx ?? heros.findIndex(h => h.isFront);
    if (fhidx == -1) return [];
    const minHert = Math.min(...heros.filter(h => h.hp > 0).map(h => h.maxHp - h.hp));
    const hidxs: number[] = [];
    for (let i = 0; i < heros.length; ++i) {
        const hidx = (i + fhidx) % heros.length;
        const hert = heros[hidx].maxHp - heros[hidx].hp;
        if (heros[hidx].hp > 0 && hert == minHert) {
            hidxs.push(hidx);
            break;
        }
    }
    return hidxs;
}

// 获取攻击角色hidx
export const getAtkHidx = (heros: Hero[]): number => {
    return heros.findIndex(h => h.isFront);
}

// 获得距离出战角色最近的hidx
export const getNearestHidx = (hidx: number, heros: Hero[]): number => {
    const livehidxs = allHidxs(heros);
    for (let i = 0; i < heros.length; ++i) {
        if (livehidxs.indexOf((hidx + i) % heros.length) > -1) return hidx + i;
    }
    return -1;
}

// 获得所有后台角色hidx
export const getBackHidxs = (heros: Hero[], frontIdx: number = heros.findIndex(h => h.isFront)): number[] => {
    const hidxs: number[] = [];
    for (let i = 1; i < heros.length; ++i) {
        const hidx = (frontIdx + i) % heros.length;
        if (heros[hidx].hp > 0) hidxs.push(hidx);
    }
    return hidxs;
}

// 检查骰子是否合法
export const checkDices = (dices: DiceCostType[], options: { card?: Card, skill?: Skill, heroSwitchDice?: number } = {}): boolean => {
    const { card, skill, heroSwitchDice = -1 } = options;
    const diceLen = dices.length;
    const diceCnt = arrToObj<DiceCostType, number>(Object.values(DICE_COST_TYPE), 0);
    dices.forEach(d => ++diceCnt[d]);
    const diceCntArr = objToArr(diceCnt);
    const typeCnt = diceCntArr.filter(([v, n]) => v != DICE_COST_TYPE.Omni && n > 0).length;
    if (card) { // 选择卡所消耗的骰子
        const { cost, costType, anydice, costChange } = card;
        if (diceLen != cost + anydice - costChange) return false;
        if (costType == DICE_TYPE.Any) return true;
        if (costType != DICE_TYPE.Same) {
            const elDiceValid = diceCnt[costType] + diceCnt[DICE_COST_TYPE.Omni] >= cost - costChange;
            const anyDiceValid = diceCntArr.reduce((a, [, b]) => a + b, 0) - cost + costChange == anydice;
            return elDiceValid && anyDiceValid;
        }
        return !(typeCnt > 2 || (typeCnt == 2 && diceCnt[DICE_COST_TYPE.Omni] == 0));
    }
    if (skill) { // 选择技能所消耗的骰子
        const [elDice, anyDice] = skill.cost;
        const [elMinus, anyMinus] = skill.costChange;
        if (diceLen != elDice.cnt + anyDice.cnt - elMinus - anyMinus) return false;
        if (elDice.type != COST_TYPE.Same) {
            const elDiceValid = diceCnt[elDice.type] + diceCnt[DICE_COST_TYPE.Omni] >= elDice.cnt - elMinus;
            const anyDiceValid = diceCntArr.reduce((a, b) => a + b[1], 0) - elDice.cnt + elMinus == anyDice.cnt - anyMinus;
            return elDiceValid && anyDiceValid;
        }
        return !(typeCnt > 2 || (typeCnt == 2 && diceCnt[DICE_COST_TYPE.Omni] == 0));
    }
    if (heroSwitchDice > -1) { // 切换角色所消耗的骰子
        return diceLen == heroSwitchDice;
    }
    return false;
}

// 是否含有某id
export const hasObjById = <T extends { id: number }>(obj: T[] | undefined, id: number) => {
    return !!obj?.some(o => o.id == id);
}

// 找出含有某id的对象
export const getObjById = <T extends { id: number }>(obj: T[] | undefined, id: number): T | undefined => {
    return obj?.find(o => o.id == id);
}

// 找出某id所在队列序号
export const getObjIdxById = <T extends { id: number }>(obj: T[] | undefined, id: number): number => {
    return obj?.findIndex(o => o.id == id) ?? -1;
}

// 根据id提取角色id
export const getHidById = (id: number): number => Math.floor(id / 10) % 1e4;

// 根据角色id获取元素
export const getElByHid = (hid: number): ElementType => ELEMENT_CODE_KEY[Math.floor(hid / 100) % 10 as ElementCode];

// 根据角色id获取天赋id
export const getTalentIdByHid = (hid: number): number => {
    if (hid == 2602) return 226022;
    return +`2${hid}1`
}

// 合并预回血
export const mergeWillHeals = (tarWillHeals: number[], resHeals?: number[] | number[][], players?: Player[]) => {
    if (!resHeals) return;
    if (typeof resHeals[0] != 'number') {
        return (resHeals as number[][]).forEach(hl => mergeWillHeals(tarWillHeals, hl, players));
    }
    (resHeals as number[]).forEach((hl, hli) => {
        if (hl > -1) {
            if (tarWillHeals[hli] < 0) {
                if (players) {
                    tarWillHeals[hli] = -2;
                    if (hl == 0) tarWillHeals[hli] = -3;
                } else tarWillHeals[hli] = hl;
            } else if (!players) tarWillHeals[hli] += hl;
        }
    });
    players?.forEach(p => p.heros.forEach(h => h.hp = Math.min(h.maxHp, h.hp + Math.max(0, (resHeals as number[])[h.hidx + (p.pidx * players[0].heros.length)]))));
}

// 比较版本大小
const compareVersion = (v1: Version, v2: Version | null) => {
    if (v1 === v2) return 0;
    if (v2 === null || +OFFLINE_VERSION.includes(v1 as OfflineVersion) ^ +OFFLINE_VERSION.includes(v2 as OfflineVersion)) {
        return -1;
    }
    if (v1 === 'vlatest') return 1;
    if (v2 === 'vlatest') return -1;
    const v1s = v1.slice(1).split('.').map(Number);
    const v2s = v2.slice(1).split('.').map(Number);
    for (let i = 0; i < v1s.length; ++i) {
        if (v1s[i] > v2s[i]) return 1;
        if (v1s[i] < v2s[i]) return -1;
    }
    return 0;
}

// 比较版本大小
export const compareVersionFn = (curVersion: Version) => {
    return {
        value: curVersion,
        isOffline: OFFLINE_VERSION.includes(curVersion as OfflineVersion),
        lt: (ver: Version | null) => compareVersion(curVersion, ver) < 0,
        lte: (ver: Version | null) => compareVersion(curVersion, ver) <= 0,
        gt: (ver: Version | null) => compareVersion(curVersion, ver) > 0,
        gte: (ver: Version | null) => compareVersion(curVersion, ver) >= 0,
        eq: (ver: Version | null) => compareVersion(curVersion, ver) == 0,
    }
}

// 将玩家信息对象转换为字符串
export const playerToString = (player: Player, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    return `{\n${prefix}name: ${player.name}\n`
        + `${prefix}id: ${player.id}\n`
        + `${prefix}pidx: ${player.pidx}\n`
        + `${prefix}isOffline: ${player.isOffline}\n`
        + `${prefix}canAction: ${player.canAction}\n`
        + `${prefix}isFallAtk: ${player.isFallAtk}\n`
        + `${prefix}dice: ${player.dice.map(d => `[${d}]`).join('')}\n`
        + `${prefix}rollCnt: ${player.rollCnt}\n`
        + `${prefix}status: ${player.status}\n`
        + `${prefix}handCards: ${player.handCards.map(c => `[${c.name}]`).join('')}\n`
        + `${prefix}pile: ${player.pile.map(c => `[${c.name}]`).join('')}\n`
        + `${prefix}combatStatus: [${player.combatStatus.map(s => statusToString(s, prefixSpace + 1)).join(', ')}]\n`
        + `${prefix}heros: [${player.heros.map(s => heroToString(s, prefixSpace + 1)).join(', ')}]\n`
        + `${prefix}summons: [${player.summons.map(s => summonToString(s, prefixSpace + 1)).join(', ')}]\n`
        + `${prefix}supports: [${player.supports.map(s => supportToString(s, prefixSpace + 1)).join(', ')}]\n`
        + `${'  '.repeat(prefixSpace - 1)}}`;
}

export const statusToString = (sts: Status, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    return `{\n${prefix}name: ${sts.name}\n`
        + `${prefix}id: ${sts.id}\n`
        + `${prefix}entityId: ${sts.entityId}\n`
        + `${prefix}useCnt: ${sts.useCnt}\n`
        + `${prefix}perCnt: ${sts.perCnt}\n`
        + `${prefix}maxCnt: ${sts.maxCnt}\n`
        + `${prefix}roundCnt: ${sts.roundCnt}\n`
        + `${prefix}addCnt: ${sts.addCnt}\n`
        + `${prefix}type: ${sts.type}\n`
        + `${prefix}isTalent: ${sts.isTalent}\n`
        + `${prefix}addition: [${sts.addition}]\n`
        + `${'  '.repeat(prefixSpace - 1)}}`;
}

export const summonToString = (smn: Summon, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    return `{\n${prefix}name: ${smn.name}\n`
        + `${prefix}id: ${smn.id}\n`
        + `${prefix}entityId: ${smn.entityId}\n`
        + `${prefix}useCnt: ${smn.useCnt}\n`
        + `${prefix}maxUse: ${smn.maxUse}\n`
        + `${prefix}perCnt: ${smn.perCnt}\n`
        + `${prefix}damage: ${smn.damage}\n`
        + `${prefix}element: ${smn.element}\n`
        + `${prefix}pdmg: ${smn.pdmg}\n`
        + `${prefix}shieldOrHeal: ${smn.shieldOrHeal}\n`
        + `${prefix}isDestroy: ${smn.isDestroy}\n`
        + `${prefix}isTalent: ${smn.isTalent}\n`
        + `${prefix}addition: [${smn.addition}]\n`
        + `${'  '.repeat(prefixSpace - 1)}}`;
}

export const supportToString = (spt: Support, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    return `{\n${prefix}name: ${spt.card.name}\n`
        + `${prefix}id: ${spt.card.id}\n`
        + `${prefix}entityId: ${spt.entityId}\n`
        + `${prefix}cnt: ${spt.cnt}\n`
        + `${prefix}perCnt: ${spt.perCnt}\n`
        + `${prefix}type: ${spt.type}\n`
        + `${prefix}heal: ${spt.heal}\n`
        + `${'  '.repeat(prefixSpace - 1)}}`;
}

export const heroToString = (hero: Hero, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    return `{\n${prefix}name: ${hero.name}\n`
        + `${prefix}id: ${hero.id}\n`
        + `${prefix}entityId: ${hero.entityId}\n`
        + `${prefix}hp: ${hero.hp}\n`
        + `${prefix}maxHp: ${hero.maxHp}\n`
        + `${prefix}element: ${hero.element}\n`
        + `${prefix}energy: ${hero.energy}\n`
        + `${prefix}maxEnergy: ${hero.maxEnergy}\n`
        + `${prefix}hidx: ${hero.hidx}\n`
        + `${prefix}isFront: ${hero.isFront}\n`
        + `${prefix}attachElement: ${hero.attachElement}\n`
        + `${prefix}weaponType: ${hero.weaponType}\n`
        + `${prefix}tags: ${hero.tags}\n`
        + `${prefix}weaponSlot: ${cardToString(hero.weaponSlot, prefixSpace + 1)}\n`
        + `${prefix}artifactSlot: ${cardToString(hero.artifactSlot, prefixSpace + 1)}\n`
        + `${prefix}talentSlot: ${cardToString(hero.talentSlot, prefixSpace + 1)}\n`
        + `${prefix}vehicleSlot: ${cardToString(hero.vehicleSlot?.[0], prefixSpace + 1)}\n`
        + `${prefix}heroStatus: [${hero.heroStatus.map(s => statusToString(s, prefixSpace + 1)).join(', ')}]\n`
        + `${prefix}skills: [${hero.skills.map(s => skillToString(s, prefixSpace + 1)).join(', ')}]\n`
        + `${'  '.repeat(prefixSpace - 1)}}`;
}

export const cardToString = (card: Card | null | undefined, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    if (!card) return 'null';
    return `{\n${prefix}name: ${card.name}\n`
        + `${prefix}id: ${card.id}\n`
        + `${prefix}entityId: ${card.entityId}\n`
        + `${prefix}cost: ${card.cost}\n`
        + `${prefix}costType: ${card.costType}\n`
        + `${prefix}costChange: ${card.costChange}\n`
        + `${prefix}type: ${card.type}\n`
        + `${prefix}subType: ${card.subType}\n`
        + `${prefix}tag: ${card.tag}\n`
        + `${prefix}userType: ${card.userType}\n`
        + `${prefix}useCnt: ${card.useCnt}\n`
        + `${prefix}perCnt: ${card.perCnt}\n`
        + `${prefix}energy: ${card.energy}\n`
        + `${prefix}anydice: ${card.anydice}\n`
        + `${'  '.repeat(prefixSpace - 1)}}`;
}

export const skillToString = (skill: Skill, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    return `{\n${prefix}name: ${skill.name}\n`
        + `${prefix}id: ${skill.id}\n`
        + `${prefix}type: ${skill.type}\n`
        + `${prefix}damage: ${skill.damage}\n`
        + `${prefix}dmgElement: ${skill.dmgElement}\n`
        + `${prefix}cost: [${skill.cost.map(c => c.cnt)}]\n`
        + `${prefix}attachElement: ${skill.attachElement}\n`
        + `${prefix}isForbidden: ${skill.isForbidden}\n`
        + `${prefix}dmgChange: ${skill.dmgChange}\n`
        + `${prefix}costChange: ${JSON.stringify(skill.costChange)}\n`
        + `${prefix}useCntPerRound: ${skill.useCntPerRound}\n`
        + `${prefix}perCnt: ${skill.perCnt}\n`
        + `${prefix}useCnt: ${skill.useCnt}\n`
        + `${prefix}addition: [${skill.addition}]\n`
        + `${'  '.repeat(prefixSpace - 1)}}`;
}

