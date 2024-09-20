import { ElementType, HeroTag, Version } from "@@@/constant/enum"

type DeckVO = {
    name: string,
    version: Version,
    heroIds: {
        id: number,
        name: string,
        element: ElementType,
        tags: HeroTag[],
        src: string,
        avatar: string,
    }[],
    cardIds: number[],
}

type OriDeck = {
    name: string,
    version: Version,
    shareCode: string,
}

