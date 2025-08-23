import { Card, GameInfo, Hero, Player, Skill, Status, Summon, Support, Trigger } from "../../typing";
import { CARD_SUBTYPE, COST_TYPE, DICE_COST_TYPE, DICE_TYPE, DiceCostType, ELEMENT_CODE_KEY, ElementCode, ElementType, OFFLINE_VERSION, OfflineVersion, SKILL_TYPE, VERSION, Version } from "../constant/enum.js";
import { DICE_WEIGHT, SKILL_TYPE_NAME } from "../constant/UIconst.js";
import { EntityHandleEvent, InputHandle } from "../data/builder/baseBuilder";
import { arrToObj, objToArr } from "./utils.js";

// 获取所有存活/死亡角色的索引hidx
export const allHidxs = (heros?: Hero[], options: {
    isDie?: boolean, exclude?: number, include?: number, isAll?: boolean,
    cdt?: (h: Hero) => boolean, limit?: number, frontIdx?: number,
} = {}): number[] => {
    const { isDie = false, exclude = -1, include = -1, isAll = false, cdt = () => true, limit = -1, frontIdx } = options;
    const hidx = frontIdx ?? heros?.findIndex(h => h.isFront) ?? -1;
    if (!heros || hidx == -1 || limit == 0) return [];
    const hidxs: number[] = [];
    for (let i = 0; i < heros.length; ++i) {
        const hi = (hidx + i) % heros.length;
        const h = heros[hi];
        if (isAll || include == hi || ((isDie ? h.hp <= 0 : h.hp > 0) && exclude != hi && cdt(h))) {
            hidxs.push(hi);
            if (hidxs.length == limit) break;
        }
    }
    return hidxs;
}

// 获取受伤最多的角色的hidxs(最多一个number的数组)
export const getMaxHertHidxs = (heros: Hero[] = [], options: { fhidx?: number, isBack?: boolean } = {}): number[] => {
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

// 获取受伤最少的角色的hidx(最多一个number的数组)
export const getMinHertHidxs = (heros: Hero[] = [], fhidx?: number): number[] => {
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

// 获取生命值最低角色的hidx(只有一个number的数组)
export const getMinHpHidxs = (heros: Hero[] = [], fhidx: number = heros.findIndex(h => h.isFront)): number[] => {
    if (fhidx == -1) return [];
    const minHp = Math.min(...heros.filter(h => h.hp > 0).map(h => h.hp));
    const hidxs: number[] = [];
    for (let i = 0; i < heros.length; ++i) {
        const hidx = (i + fhidx) % heros.length;
        if (heros[hidx].hp == minHp) {
            hidxs.push(hidx);
            break;
        }
    }
    return hidxs;
}

// 获取出战角色hidx
export const getFrontHidx = (heros?: Hero[]): number => {
    return heros?.findIndex(h => h.isFront) ?? -1;
}

// 获得距离出战角色最近的hidx
export const getNearestHidx = (hidx: number, heros: Hero[]): number => {
    const livehidxs = allHidxs(heros);
    let minDistance = livehidxs.length;
    let hidxs: number[] = [];
    for (const hi of livehidxs) {
        const distance = Math.min(Math.abs(hi - hidx), hi + heros.length - hidx);
        if (distance == 0) return hi;
        if (distance < minDistance) {
            minDistance = distance;
            hidxs = [hi];
        } else if (distance == minDistance) {
            hidxs.push(hi);
        }
    }
    if (hidxs.length == 0) return -1;
    return Math.min(...hidxs);
}

// 获得所有后台角色hidx
export const getBackHidxs = (heros?: Hero[], frontIdx: number = heros?.findIndex(h => h.isFront) ?? -1, limit?: number): number[] => {
    return allHidxs(heros, { exclude: frontIdx, frontIdx, limit });
}

// 获得下一个后台角色hidx(只有一个number的数组)
export const getNextBackHidx = (heros?: Hero[], frontIdx: number = heros?.findIndex(h => h.isFront) ?? -1): number[] => {
    return getBackHidxs(heros, frontIdx, 1);
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
        const { cost, costType, anydice, costChange, costChanges } = card;
        if (diceLen != cost + anydice - costChange) return false;
        if (costType == DICE_TYPE.Any) return true;
        if (costType != DICE_TYPE.Same) {
            const elDiceValid = diceCnt[costType] + diceCnt[DICE_COST_TYPE.Omni] >= cost - costChanges[0];
            const anyDiceValid = diceCntArr.reduce((a, [, b]) => a + b, 0) - cost + costChange == anydice;
            return elDiceValid && anyDiceValid;
        }
        return !(typeCnt > 2 || (typeCnt == 2 && diceCnt[DICE_COST_TYPE.Omni] == 0));
    }
    if (skill) { // 选择技能所消耗的骰子
        const [elDice, anyDice] = skill.cost;
        const [elMinus, anyMinus] = skill.costChange;
        if (diceLen != elDice.cnt + anyDice.cnt - elMinus - anyMinus) return false;
        if (elDice.type != COST_TYPE.Same || elDice.cnt == 0) {
            const elDiceValid = elDice.cnt == 0 || (elDice.type != COST_TYPE.Same && diceCnt[elDice.type] + diceCnt[DICE_COST_TYPE.Omni] >= elDice.cnt - elMinus);
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
export const hasObjById = <T extends { id: number }, U extends keyof T>(obj: T[] | undefined, value: T[U], key: U = 'id' as U) => {
    return !!obj?.some(o => o[key] == value);
}

// 找出含有某id的对象
export const getObjById = <T extends { id: number }, U extends keyof T>(obj: T[] | undefined, value: T[U], key: U = 'id' as U): T | undefined => {
    return obj?.find(o => o[key] == value);
}

// 找出某id所在队列序号
export const getObjIdxById = <T extends { id: number }, U extends keyof T>(obj: T[] | undefined, value: T[U], key: U = 'id' as U): number => {
    return obj?.findIndex(o => o[key] == value) ?? -1;
}

// 根据id提取角色id
export const getHidById = (id: number): number => {
    const [first] = id.toString();
    if (first != '1' && first != '2') return 0;
    return Math.floor(id / 10) % 1e4;
};

// 根据角色id获取元素
export const getElByHid = (hid: number): ElementType => ELEMENT_CODE_KEY[Math.floor(hid / 100) % 10 as ElementCode];

// 天赋卡是否需要角色为出战角色
export const isTalentFront = (heros: Hero[] | undefined, card: Card) => !!getObjById(heros, card.userType as number)?.isFront;

// 根据角色id获取天赋id
export const getTalentIdByHid = (hid: number): number => {
    if (hid == 2602) return 226022;
    return +`2${hid}1`;
}
// 根据特技卡id获取特技技能id
export const getVehicleIdByCid = (cid: number): number => {
    const SpecialCard: Record<number, number> = {
        112142: 1121422,
        313006: 3130063,
        313009: 3130092,
    };
    return SpecialCard[cid] ?? +`${cid}1`;
}

// 获取排序后的骰子
export const getSortedDices = (dices: DiceCostType[]) => {
    const diceCnt = arrToObj(DICE_WEIGHT, 0);
    dices.forEach(d => ++diceCnt[d]);
    return objToArr(diceCnt)
        .sort((a, b) => b[1] * +(b[0] != DICE_COST_TYPE.Omni) - a[1] * +(a[0] != DICE_COST_TYPE.Omni) || DICE_WEIGHT.indexOf(a[0]) - DICE_WEIGHT.indexOf(b[0]))
        .flatMap(([d, cnt]) => new Array<DiceCostType>(cnt).fill(d));
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

// 获取衍生物的父id(递归寻找追溯至card/hero)
export const getDerivantParentId = (id: number, dict: Record<number, number>) => {
    let parentId = dict[id];
    while (dict[parentId] != undefined) {
        parentId = dict[parentId];
    }
    return parentId;
}

// 比较版本大小
export const compareVersion = (v1: Version, v2: Version | null) => {
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
export const versionWrap = (curVersion: Version) => {
    return {
        ver: curVersion,
        value: curVersion == 'vlatest' ? VERSION[0] : curVersion,
        isOffline: OFFLINE_VERSION.includes(curVersion as OfflineVersion),
        lt: (ver: Version | null) => compareVersion(curVersion, ver) < 0,
        lte: (ver: Version | null) => compareVersion(curVersion, ver) <= 0,
        gt: (ver: Version | null) => compareVersion(curVersion, ver) > 0,
        gte: (ver: Version | null) => compareVersion(curVersion, ver) >= 0,
        eq: (ver: Version | null) => compareVersion(curVersion, ver) == 0,
        range: (ver1: Version | null, ver2: Version | null) => compareVersion(curVersion, ver1) >= 0 && compareVersion(curVersion, ver2) < 0,
    }
}

// 将玩家信息对象转换为字符串
export const playerToString = (player: Player, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    const prefix1 = '  '.repeat(prefixSpace + 1);
    return `${prefix}{\n`
        + `${prefix1}name: ${player.name}\n`
        + `${prefix1}id: ${player.id}\n`
        + `${prefix1}pidx: ${player.pidx}\n`
        + `${prefix1}hidx: ${player.hidx}\n`
        + `${prefix1}phase: ${player.phase}\n`
        + `${prefix1}isOffline: ${player.isOffline}\n`
        + `${prefix1}canAction: ${player.canAction}\n`
        + `${prefix1}isFallAtk: ${player.isFallAtk}\n`
        + `${prefix1}dice: ${player.dice.map(d => `[${d}]`).join('')}\n`
        + `${prefix1}rollCnt: ${player.rollCnt}\n`
        + `${prefix1}status: ${player.status}\n`
        + `${prefix1}handCards: ${player.handCards.map(c => `[${c.name}](${c.entityId})`).join('')}\n`
        + `${prefix1}pile: ${player.pile.map(c => `[${c.name}]`).join('')}\n`
        + `${prefix1}playerInfo: ${playerInfoToString(player.playerInfo, prefixSpace + 2)}\n`
        + `${prefix1}combatStatus: [\n`
        + `${player.combatStatus.map(s => statusToString(s, prefixSpace + 2)).join('') || prefix1 + '  \n'}`
        + `${prefix1}]\n`
        + `${prefix1}heros: [\n`
        + `${player.heros.map(s => heroToString(s, prefixSpace + 2)).join('') || prefix1 + '  \n'}`
        + `${prefix1}]\n`
        + `${prefix1}summons: [\n`
        + `${player.summons.map(s => summonToString(s, prefixSpace + 2)).join('') || prefix1 + '  \n'}`
        + `${prefix1}]\n`
        + `${prefix1}supports: [\n`
        + `${player.supports.map(s => supportToString(s, prefixSpace + 2)).join('') || prefix1 + '  \n'}`
        + `${prefix1}]\n`
        + `${prefix}}\n`;
}

export const playerInfoToString = (playerInfo: GameInfo, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace - 1);
    const prefix1 = '  '.repeat(prefixSpace);
    return `{\n`
        + `${prefix1}isUsedLegend: ${playerInfo.isUsedLegend}\n`
        + `${prefix1}relicCnt: ${playerInfo.relicCnt}\n`
        + `${prefix1}relicTypeCnt: ${playerInfo.relicTypeCnt}\n`
        + `${prefix1}weaponCnt: ${playerInfo.weaponCnt}\n`
        + `${prefix1}weaponTypeCnt: ${playerInfo.weaponTypeCnt}\n`
        + `${prefix1}talentCnt: ${playerInfo.talentCnt}\n`
        + `${prefix1}talentTypeCnt: ${playerInfo.talentTypeCnt}\n`
        + `${prefix1}usedCardIds: ${playerInfo.usedCardIds}\n`
        + `${prefix1}destroyedSupport: ${playerInfo.destroyedSupport}\n`
        + `${prefix1}destroyedSummon: ${playerInfo.destroyedSummon}\n`
        + `${prefix1}oppoGetElDmgType: ${playerInfo.oppoGetElDmgType}\n`
        + `${prefix1}discardCnt: ${playerInfo.discardCnt}\n`
        + `${prefix1}reconcileCnt: ${playerInfo.reconcileCnt}\n`
        + `${prefix1}discardIds: ${playerInfo.discardIds}\n`
        + `${prefix1}initCardIds: ${playerInfo.initCardIds}\n`
        + `${prefix1}isUsedCardPerRound: ${playerInfo.isUsedCardPerRound}\n`
        + `${prefix}}`;
}

export const statusToString = (sts: Status, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    const prefix1 = '  '.repeat(prefixSpace + 1);
    return `${prefix}{\n`
        + `${prefix1}name: ${sts.name}\n`
        + `${prefix1}id: ${sts.id}\n`
        + `${prefix1}entityId: ${sts.entityId}\n`
        + `${prefix1}useCnt: ${sts.useCnt}\n`
        + `${prefix1}perCnt: ${sts.perCnt}\n`
        + `${prefix1}maxCnt: ${sts.maxCnt}\n`
        + `${prefix1}roundCnt: ${sts.roundCnt}\n`
        + `${prefix1}addCnt: ${sts.addCnt}\n`
        + `${prefix1}type: ${sts.type}\n`
        + `${prefix1}isTalent: ${sts.isTalent}\n`
        + `${prefix1}addition: [${JSON.stringify(sts.addition)}]\n`
        + `${prefix}}\n`;
}

export const summonToString = (smn: Summon, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    const prefix1 = '  '.repeat(prefixSpace + 1);
    return `${prefix}{\n`
        + `${prefix1}name: ${smn.name}\n`
        + `${prefix1}id: ${smn.id}\n`
        + `${prefix1}entityId: ${smn.entityId}\n`
        + `${prefix1}useCnt: ${smn.useCnt}\n`
        + `${prefix1}maxUse: ${smn.maxUse}\n`
        + `${prefix1}perCnt: ${smn.perCnt}\n`
        + `${prefix1}damage: ${smn.damage}\n`
        + `${prefix1}element: ${smn.element}\n`
        + `${prefix1}pdmg: ${smn.pdmg}\n`
        + `${prefix1}shieldOrHeal: ${smn.shieldOrHeal}\n`
        + `${prefix1}isDestroy: ${smn.isDestroy}\n`
        + `${prefix1}isTalent: ${smn.isTalent}\n`
        + `${prefix1}addition: [${JSON.stringify(smn.addition)}]\n`
        + `${prefix}}\n`;
}

export const supportToString = (spt: Support, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    const prefix1 = '  '.repeat(prefixSpace + 1);
    return `${prefix}{\n`
        + `${prefix1}name: ${spt.card.name}\n`
        + `${prefix1}id: ${spt.card.id}\n`
        + `${prefix1}entityId: ${spt.entityId}\n`
        + `${prefix1}cnt: ${spt.cnt}\n`
        + `${prefix1}perCnt: ${spt.perCnt}\n`
        + `${prefix1}type: ${spt.type}\n`
        + `${prefix1}heal: ${spt.heal}\n`
        + `${prefix}}\n`;
}

export const heroToString = (hero: Hero, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    const prefix1 = '  '.repeat(prefixSpace + 1);
    return `${prefix}{\n`
        + `${prefix1}name: ${hero.name}\n`
        + `${prefix1}id: ${hero.id}\n`
        + `${prefix1}entityId: ${hero.entityId}\n`
        + `${prefix1}hp: ${hero.hp}\n`
        + `${prefix1}maxHp: ${hero.maxHp}\n`
        + `${prefix1}element: ${hero.element}\n`
        + `${prefix1}energy: ${hero.energy}\n`
        + `${prefix1}maxEnergy: ${hero.maxEnergy}\n`
        + `${prefix1}hidx: ${hero.hidx}\n`
        + `${prefix1}isFront: ${hero.isFront}\n`
        + `${prefix1}attachElement: ${hero.attachElement}\n`
        + `${prefix1}weaponType: ${hero.weaponType}\n`
        + `${prefix1}tags: ${hero.tags}\n`
        + `${prefix1}weaponSlot: ${cardToString(hero.weaponSlot, prefixSpace + 1, false)}`
        + `${prefix1}relicSlot: ${cardToString(hero.relicSlot, prefixSpace + 1, false)}`
        + `${prefix1}talentSlot: ${cardToString(hero.talentSlot, prefixSpace + 1, false)}`
        + `${prefix1}vehicleSlot: ${cardToString(hero.vehicleSlot?.[0], prefixSpace + 1, false)}`
        + `${prefix1}heroStatus: [\n`
        + `${hero.heroStatus.map(s => statusToString(s, prefixSpace + 2)).join('') || prefix1 + '  \n'}`
        + `${prefix1}]\n`
        + `${prefix1}skills: [\n`
        + `${hero.skills.map(s => skillToString(s, prefixSpace + 2)).join('') || prefix1 + '  \n'}`
        + `${prefix1}]\n`
        + `${prefix}}\n`;
}

export const cardToString = (card: Card | null | undefined, prefixSpace: number = 1, wrap: boolean = true) => {
    const prefix = '  '.repeat(prefixSpace);
    const prefix1 = '  '.repeat(prefixSpace + 1);
    if (!card) return 'null\n';
    return `${wrap ? prefix : ''}{\n`
        + `${prefix1}name: ${card.name}\n`
        + `${prefix1}id: ${card.id}\n`
        + `${prefix1}entityId: ${card.entityId}\n`
        + `${prefix1}cost: ${card.cost}\n`
        + `${prefix1}costType: ${card.costType}\n`
        + `${prefix1}costChange: ${card.costChange}\n`
        + `${prefix1}type: ${card.type}\n`
        + `${prefix1}subType: ${card.subType}\n`
        + `${prefix1}tag: ${card.tag}\n`
        + `${prefix1}userType: ${card.userType}\n`
        + `${prefix1}useCnt: ${card.useCnt}\n`
        + `${prefix1}perCnt: ${card.perCnt}\n`
        + `${prefix1}energy: ${card.energy}\n`
        + `${prefix1}anydice: ${card.anydice}\n`
        + `${prefix}}\n`;
}

export const skillToString = (skill: Skill, prefixSpace: number = 1) => {
    const prefix = '  '.repeat(prefixSpace);
    const prefix1 = '  '.repeat(prefixSpace + 1);
    return `${prefix}{\n`
        + `${prefix1}name: ${skill.name}\n`
        + `${prefix1}id: ${skill.id}\n`
        + `${prefix1}type: ${SKILL_TYPE_NAME[skill.type]}\n`
        + `${prefix1}damage: ${skill.damage}\n`
        + `${prefix1}dmgElement: ${skill.dmgElement}\n`
        + `${prefix1}cost: [${skill.cost.map(c => c.cnt)}]\n`
        + `${prefix1}attachElement: ${skill.attachElement}\n`
        + `${prefix1}isForbidden: ${skill.isForbidden}\n`
        + `${prefix1}dmgChange: ${skill.dmgChange}\n`
        + `${prefix1}costChange: ${JSON.stringify(skill.costChange)}\n`
        + `${prefix1}useCntPerRound: ${skill.useCntPerRound}\n`
        + `${prefix1}perCnt: ${skill.perCnt}\n`
        + `${prefix1}useCnt: ${skill.useCnt}\n`
        + `${prefix1}addition: [${JSON.stringify(skill.addition)}]\n`
        + `${prefix}}\n`;
}

export const getEntityHandleEvent = <T extends InputHandle<Partial<EntityHandleEvent>>>(pidx: number, players: Player[], event: T) => {
    const player = players[pidx];
    const opponent = players[pidx ^ 1];
    const { hidx = player.hidx, isMinusDiceCard = false, hcard = null } = event;
    const hero = player.heros[hidx];
    return {
        pidx,
        heros: player.heros,
        hidx,
        hero,
        combatStatus: player.combatStatus,
        pile: player.pile,
        hcards: player.handCards,
        hcardsCnt: player.handCards.length,
        summons: player.summons,
        supports: player.supports,
        phase: player.phase,
        playerInfo: player.playerInfo,
        dices: player.dice,
        dicesCnt: player.dice.length,
        heal: player.heros.map(() => -1),
        eheros: opponent.heros,
        ehidx: opponent.hidx,
        eCombatStatus: opponent.combatStatus,
        epile: opponent.pile,
        esummons: opponent.summons,
        esupports: opponent.supports,
        ehcards: opponent.handCards,
        ehcardsCnt: opponent.handCards.length,
        ephase: opponent.phase,
        eplayerInfo: opponent.playerInfo,
        reset: false,
        trigger: '' as Trigger,
        switchHeroDiceCnt: 0,
        isQuickAction: false,
        hcard,
        isChargedAtk: false,
        isFallAtk: player.isFallAtk,
        round: 1,
        restDmg: -1,
        skid: -1,
        sktype: SKILL_TYPE.Vehicle,
        isSummon: -1,
        isExec: false,
        isMinusDiceCard,
        isMinusDiceTalent: false,
        minusDiceCard: 0,
        isMinusDiceSkill: false,
        isMinusDiceWeapon: isMinusDiceCard && !!hcard?.hasSubtype(CARD_SUBTYPE.Weapon),
        isMinusDiceRelic: isMinusDiceCard && !!hcard?.hasSubtype(CARD_SUBTYPE.Relic),
        isMinusDiceVehicle: isMinusDiceCard && !!hcard?.hasSubtype(CARD_SUBTYPE.Vehicle),
        minusDiceSkill: [],
        dmgedHidx: opponent.hidx,
        getdmg: player.heros.map(() => -1),
        dmg: player.heros.map(() => -1),
        hasDmg: false,
        isExecTask: false,
        selectHeros: [],
        selectSummon: -1,
        selectSupport: -1,
        source: -1,
        sourceHidx: -1,
        dmgSource: -1,
        discards: [],
        talent: hero.talentSlot,
        slotsDestroyCnt: player.heros.map(() => 0),
        isSelfRound: false,
        isSwirlExec: false,
        atkHidx: player.hidx,
        isFirst: false,
    }
}
