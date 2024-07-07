import { DiceCostType, DiceType, ElementType, HeroTag, InfoType } from "@@@/constant/enum"
import { Card } from "../typing"

type DeckVO = {
    name: string,
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
    shareCode: string,
}

