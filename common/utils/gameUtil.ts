import { Card, Hero, Player, Skill } from "../../typing";
import { COST_TYPE, DICE_COST_TYPE, DICE_TYPE, DiceCostType, ELEMENT_CODE_KEY, ElementCode, ElementType, Version } from "../constant/enum.js";
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
                    --tarWillHeals[hli];
                    if (hl == 0) --tarWillHeals[hli];
                } else tarWillHeals[hli] = hl;
            } else if (!players) tarWillHeals[hli] += hl;
        }
    });
    players?.forEach(p => p.heros.forEach(h => h.hp = Math.min(h.maxHp, h.hp + Math.max(0, (resHeals as number[])[h.hidx + (p.pidx * players[0].heros.length)]))));
}

// 比较版本大小
const compareVersion = (v1: Version, v2: Version) => {
    if (v1 === v2) return 0;
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
        lt: (ver: Version) => compareVersion(curVersion, ver) < 0,
        lte: (ver: Version) => compareVersion(curVersion, ver) <= 0,
        gt: (ver: Version) => compareVersion(curVersion, ver) > 0,
        gte: (ver: Version) => compareVersion(curVersion, ver) >= 0,
        eq: (ver: Version) => compareVersion(curVersion, ver) == 0,
    }
}
