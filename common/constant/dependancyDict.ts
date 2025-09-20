import { cardsTotal } from "../data/cards.js";
import { herosTotal } from "../data/heros.js";
import { statusesTotal } from "../data/statuses.js";
import { summonsTotal } from "../data/summons.js";
import { getHidById } from "../utils/gameUtil.js";
import { Version, VERSION } from "./enum.js";

const dict: Record<number, number> = {};
const versionChanges: Record<number, Version[]> = {};

herosTotal(VERSION[0]).forEach(h => versionChanges[h.id] = []);
const allCards = cardsTotal(VERSION[0]);
allCards.forEach(c => {
    if (c.variables.from) dict[c.id] = c.variables.from;
    if (c.shareId > 0) versionChanges[c.id] = [];
    versionChanges[getHidById(c.id)]?.push(...c.UI.versionChanges);
});
allCards.forEach(c => versionChanges[c.variables.from ?? -1]?.push(...c.UI.versionChanges));
statusesTotal(VERSION[0]).forEach(s => {
    const { from } = s.variables;
    if (from) {
        dict[s.id] = from;
        versionChanges[from]?.push(...s.UI.versionChanges);
    }
    versionChanges[getHidById(s.id)]?.push(...s.UI.versionChanges);
});
summonsTotal(VERSION[0]).forEach(s => {
    const { from } = s.variables;
    if (from) {
        dict[s.id] = from;
        versionChanges[from]?.push(...s.UI.versionChanges);
    }
    versionChanges[getHidById(s.id)]?.push(...s.UI.versionChanges);
});

for (const [key, value] of Object.entries(versionChanges)) {
    versionChanges[+key] = [...new Set(value)];
}

export { dict, versionChanges };

