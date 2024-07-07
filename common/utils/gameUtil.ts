import { Card, Hero, Skill } from "../../typing";
import { COST_TYPE, DICE_COST_TYPE, DICE_TYPE, DiceCostType } from "../constant/enum";
import { arrToObj, objToArr } from "./utils";

// 获取所有存活/死亡角色的索引hidx
export const allHidxs = (heros?: Hero[], options: { isDie?: boolean, exclude?: number, isAll?: boolean } = {}): number[] => {
    const { isDie = false, exclude = -1, isAll = false } = options;
    return heros?.filter(h => isAll || ((isDie ? h.hp <= 0 : h.hp > 0) && exclude != h.hidx)).map(v => v.hidx) ?? [];
}

// 获取受伤最多的角色的hidxs(只有一个number的数组)
export const getMaxHertHidxs = (heros: Hero[], fhidx?: number): number[] => {
    fhidx = fhidx ?? heros.findIndex(h => h.isFront);
    if (fhidx == -1) return [];
    const maxHert = Math.max(...heros.filter(h => h.hp > 0).map(h => h.maxHp - h.hp));
    const hidxs: number[] = [];
    for (let i = 0; i < heros.length; ++i) {
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
    return heros.some(h => h.isSelected > 0) ? heros.findIndex(h => h.isSelected) : heros.findIndex(h => h.isFront);
}

// 获得距离出战角色最近的hidx
export const getNearestHidx = (hidx: number, heros: Hero[]): number => {
    let res = hidx;
    const livehidxs = allHidxs(heros);
    if (heros[hidx].hp <= 0) {
        const [[nhidx]] = livehidxs.map(v => [v, Math.abs(v - res)]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        res = nhidx;
    }
    return res;
}

// 获得所有后台角色hidx
export const getBackHidxs = (heros: Hero[], frontIdx: number = -1): number[] => {
    const hidxs = heros.filter(h => {
        if (frontIdx == -1 && h.isFront) frontIdx = h.hidx;
        return h.hp > 0 && (frontIdx == -1 ? !h.isFront : h.hidx != frontIdx)
    }).map(h => h.hidx) ?? [];
    return hidxs.slice(frontIdx).concat(hidxs.slice(0, frontIdx));
}

// 检查骰子是否合法
export const checkDices = (dices: DiceCostType[], options: { card?: Card, skill?: Skill, heroSwitchDice?: number } = {}) => {
    const { card, skill, heroSwitchDice = -1 } = options;
    const diceLen = dices.length;
    const diceCnt = arrToObj<DiceCostType, number>(Object.values(DICE_COST_TYPE), 0);
    dices.forEach(d => ++diceCnt[d]);
    const diceCntArr = objToArr(diceCnt);
    const typeCnt = diceCntArr.filter(v => v[0] != DICE_COST_TYPE.Omni).length;
    if (card) { // 选择卡所消耗的骰子
        const { cost, costType, anydice } = card;
        if (diceLen < cost + anydice) return false;
        if (costType == DICE_TYPE.Any) return true;
        if (costType != DICE_TYPE.Same) {
            const elDiceValid = diceCnt[costType] + diceCnt[DICE_COST_TYPE.Omni] >= cost;
            const anyDiceValid = diceCntArr.reduce((a, b) => a + b[1], 0) - cost == anydice;
            return elDiceValid && anyDiceValid;
        }
        return !(typeCnt > 2 || (typeCnt == 2 && diceCnt[DICE_COST_TYPE.Omni] == 0));
    }
    if (skill) { // 选择技能所消耗的骰子
        const [elDice, anyDice] = skill.cost;
        if (elDice.type != COST_TYPE.Same) {
            const elDiceValid = diceCnt[elDice.type] + diceCnt[DICE_COST_TYPE.Omni] >= elDice.cnt;
            const anyDiceValid = diceCntArr.reduce((a, b) => a + b[1], 0) - elDice.cnt == anyDice.cnt;
            return elDiceValid && anyDiceValid;
        }
        return !(typeCnt > 2 || (typeCnt == 2 && diceCnt[DICE_COST_TYPE.Omni] == 0));
    }
    if (heroSwitchDice > -1) { // 切换角色所消耗的骰子
        return diceLen == heroSwitchDice;
    }
    return false;
}
