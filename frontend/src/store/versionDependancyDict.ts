import { Version } from "@@@/constant/enum";
import { cardsTotal } from "@@@/data/cards";
import { statusesTotal } from "@@@/data/statuses";
import { summonsTotal } from "@@@/data/summons";

let dict: Record<number, number> | null = null;

export const getDict = (version: Version): Record<number, number> => {
    if (dict == null) {
        dict = {};
        cardsTotal(version).forEach(c => c.addition.from && (dict![c.id] = c.addition.from));
        statusesTotal(version).forEach(s => s.addition.from && (dict![s.id] = s.addition.from));
        summonsTotal(version).forEach(s => s.addition.from && (dict![s.id] = s.addition.from));
    }
    return dict;
}
