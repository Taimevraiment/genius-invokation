import { DiceCostType, DiceType, ElementType, HeroTag, InfoType, Version } from "@@@/constant/enum"
import { Card } from "../typing"

type DeckVO = {
    name: string,
    version: Version,
    heroIds: {
        id: number,
        name: string,
        element: ElementType,
        tags: HeroTag[],
        src: string,
    }[],
    cardIds: number[],
}

type OriDeck = {
    name: string,
    version: Version,
    shareCode: string,
}

