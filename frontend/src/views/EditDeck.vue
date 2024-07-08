<template>
    <div class="edit-deck-container" @click="cancel">
        <button class="edit-btn exit" @click.stop="exit">返回</button>
        <div v-if="editDeckIdx == -1" class="edit-deck-list">
            <div v-for="(deck, did) in decks" :key="'deckid:' + did" class="deck"
                :class="{ 'curr-deck': deckIdx == did }" @click="toEditDeck(did)">
                {{ deck.name }}
                <div v-for="(hero, hidx) in deck.heroIds" :key="hidx" class="deck-hero"
                    :style="{ backgroundColor: ELEMENT_COLOR[hero?.element ?? 0] }">
                    {{ hero?.name || '无' }}
                </div>
                <div class="edit-btn-group">
                    <span v-for="( icon, cidx ) in deckListEditIcon" :key="cidx" class="edit-list-icon"
                        @click.stop="icon.handle(did)">
                        {{ icon.name }}
                    </span>
                </div>
            </div>
        </div>
        <div v-else class="edit-container">
            <button class="edit-btn exit" @click.stop="exit">返回</button>
            <button class="edit-btn save" @click.stop="saveDeck">保存</button>
            <div class="edit-deck-btn-group">
                <button @click.stop="{ currIdx = 0; updateInfo(); }" :class="{ active: currIdx == 0 }">
                    角色
                </button>
                <button @click.stop="{ currIdx = 1; updateInfo(); }" :class="{ active: currIdx == 1 }">
                    卡组
                </button>
            </div>
            <input v-model="deckName" class="deck-name" />
            <button class="edit-btn share" @click.stop="showShareCode">复制分享码</button>
            <input type="text" v-model="pShareCode" class="share-code-input" placeholder="粘贴分享码" />
            <button class="edit-btn share" v-if="pShareCode.length > 0" @click.stop="pasteShareCode">粘贴分享码</button>
            <div class="share-code" v-if="isShowShareCode" @click.stop="">{{ shareCode }}</div>
            <div v-if="currIdx == 0">
                <div class="heros-deck">
                    <div class="hero-deck" :class="{ 'mobile-hero-deck': isMobile }" v-for="(dhero, dhidx) in herosDeck"
                        :key="dhidx" @click.stop="showHeroInfo(dhero.id)">
                        <img class="hero-img" :src="dhero.UI.src" v-if="dhero?.UI.src?.length > 0" :alt="dhero.name"
                            draggable="false" />
                        <span v-else class="hero-img">{{ dhero.name }}</span>
                        <div class="icon-group" v-if="dhero.id > 1000">
                            <span v-for="(icon, cidx) in heroMoveIcon" :key="cidx" class="edit-icon"
                                @click.stop="icon.handle(dhidx)">
                                {{ icon.name }}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="heros-total">
                    <div class="hero-total" :class="{ 'mobile-hero-deck': isMobile }" v-for="dthero in allHeros"
                        :key="dthero.id" :style="{ color: ELEMENT_COLOR[dthero.element] }"
                        @click.stop="showHeroInfo(dthero.id)">
                        <span class="hero-img">{{ dthero.name }}</span>
                        <img class="hero-img" :src="dthero.UI.src" v-if="dthero?.UI.src?.length > 0" :alt="dthero.name"
                            draggable="false" />
                        <div class="icon-group" v-if="!dthero.isSelected">
                            <span v-for="(icon, cidx) in heroSelectIcon" :key="cidx" class="edit-icon"
                                @click.stop="icon.handle(dthero.id)">
                                {{ icon.name }}
                            </span>
                        </div>
                        <div v-else class="selected">已选择</div>
                    </div>
                </div>
            </div>
            <div v-else>
                <div :style="{ position: 'absolute', right: '10%', top: '5%' }">{{ cardsDeckLen }}/30</div>
                <div class="cards-deck">
                    <div class="card-deck" :class="{ 'mobile-card-deck': isMobile }" v-for="(dcard, dcidx) in cardsDeck"
                        :key="dcidx" @click.stop="showCardInfo(dcard.id)">
                        <div class="card-img-content">
                            <span class="card-img">{{ dcard.name }}</span>
                            <img class="card-img" :src="dcard.UI.src" v-if="dcard?.UI.src?.length > 0" :alt="dcard.name"
                                draggable="false" />
                            <img class="subtype8-border" v-if="dcard.hasSubtype(CARD_SUBTYPE.Legend)"
                                :src="getPngIcon('subtype8-border')" />
                        </div>
                        <div class="card-cost">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[dcard.costType])" draggable="false" />
                            <span>{{ dcard.cost }}</span>
                        </div>
                        <div class="card-energy" v-if="dcard?.anydice ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[DICE_TYPE.Any])" draggable="false" />
                            <span>{{ dcard?.anydice ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dcard?.energy ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[COST_TYPE.Energy])"
                                draggable="false" />
                            <span>{{ dcard?.energy ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dcard?.hasSubtype(CARD_SUBTYPE.Legend)">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])"
                                draggable="false" />
                        </div>
                        <span class="edit-icon card-select-icon"
                            v-if="(allCards.find(c => c.id === dcard.id)?.UI.cnt ?? -1) > 0"
                            @click.stop="selectCard(dcard.id)">+</span>
                        <span class="edit-icon card-remove-icon" @click.stop="removeCard(dcard.id)">-</span>
                        <div class="card-cnt">{{ dcard.UI.cnt }}</div>
                    </div>
                </div>
                <div class="cards-total">
                    <div class="card-total" :class="{ 'mobile-card-deck': isMobile }"
                        v-for="(dtcard, dtcidx) in allCards" :key="dtcidx" @click.stop="showCardInfo(dtcard.id)">
                        <div class="card-img-content">
                            <span class="card-img">{{ dtcard.name }}</span>
                            <img class="card-img" :src="dtcard.UI.src" v-if="dtcard?.UI.src?.length > 0"
                                :alt="dtcard.name" draggable="false" />
                            <img class="subtype8-border" v-if="dtcard.hasSubtype(CARD_SUBTYPE.Legend)"
                                :src="getPngIcon('subtype8-border')" />
                        </div>
                        <div class="card-cost">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[dtcard.costType])" draggable="false" />
                            <span>{{ dtcard.cost }}</span>
                        </div>
                        <div class="card-energy" v-if="dtcard?.anydice ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[DICE_TYPE.Any])" draggable="false" />
                            <span>{{ dtcard?.anydice ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dtcard?.energy ?? 0 > 0">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[COST_TYPE.Energy])"
                                draggable="false" />
                            <span>{{ dtcard?.energy ?? 0 }}</span>
                        </div>
                        <div class="card-energy" v-if="dtcard?.hasSubtype(CARD_SUBTYPE.Legend)">
                            <img class="dice-img" :src="getDiceIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])"
                                draggable="false" />
                        </div>
                        <div class="forbidden" v-if="dtcard.UI.cnt == -1">
                            已失效
                        </div>
                        <span class="edit-icon card-select-icon" @click.stop="selectCard(dtcard.id)"
                            v-else-if="dtcard.UI.cnt > 0">+</span>
                        <div v-else class="selected">已选完</div>
                        <span class="edit-icon card-remove-icon" @click.stop="removeCard(dtcard.id)"
                            v-if="dtcard.UI.cnt >= 0 && cardsDeck.some(c => c.id == dtcard.id)">-</span>
                        <div class="card-cnt" v-if="dtcard.UI.cnt >= 0">{{ dtcard.UI.cnt }}</div>
                    </div>
                </div>
            </div>
            <button class="edit-btn filter" @click.stop="showFilter">筛选</button>
            <button class="edit-btn reset" @click="reset">重置</button>
            <div class="filter-condition" v-if="isShowFilter" @click.stop="">
                <div v-for="(htitle, hidx) in [heroFilter, cardFilter][currIdx]" :key="hidx">
                    <div class="filter-title">{{ htitle.name }}</div>
                    <div class="filter-tags">
                        <span class="filter-tag" :class="{ 'active': val.tap }" v-for="(val, sidx) in htitle.value"
                            :key="sidx" @click.stop="selectFilter(hidx, sidx)">
                            {{ val.name }}
                        </span>
                    </div>
                </div>
            </div>
            <div class="filter-selected" v-if="filterSelected.length > 0">
                <span class="filter-tag active" v-for="(stag, atidx) in filterSelected" :key="atidx">
                    {{ stag }}
                </span>
            </div>
        </div>
    </div>
    <InfoModal :info="modalInfo" :isMobile="isMobile" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
    CARD_SUBTYPE, HERO_LOCAL, Version, ELEMENT_TYPE, TypeConst, CARD_TAG, HeroLocal, CardSubtype, HeroTag, ElementType,
    WeaponType, CardType, DiceType, PURE_ELEMENT_CODE, DICE_TYPE, COST_TYPE, INFO_TYPE, PURE_ELEMENT_TYPE, WEAPON_TYPE,
    CARD_TYPE,
} from '@@@/constant/enum';
import {
    ELEMENT_COLOR, ELEMENT_ICON, HERO_LOCAL_NAME, PURE_ELEMENT_NAME, WEAPON_TYPE_NAME, CARD_TYPE_NAME,
    CARD_SUBTYPE_NAME, HERO_LOCAL_CODE,
} from '@@@/constant/UIconst';
import { cardsTotal } from '../../../common/data/cards';
import { herosTotal, newHero } from '../../../common/data/heros';
import InfoModal from '@/components/InfoModal.vue';
import { arrToObj, clone, genShareCode, objToArr, parseShareCode } from '../../../common/utils/utils';
import { useRouter } from 'vue-router';
import { Card, Hero, InfoVO } from '../../../typing';
import { DeckVO, OriDeck } from 'typing';
import { NULL_HERO, NULL_MODAL } from '@@@/constant/init';
import { DECK_CARD_COUNT } from '@@@/constant/gameOption';

type Filter<T> = {
    name: string,
    value: {
        name: string,
        val: T,
        tap: boolean,
    }[]
}
type HeroFilter = [Filter<HeroTag>, Filter<ElementType>, Filter<WeaponType>];
type CardFilter = [Filter<CardType>, Filter<CardSubtype>, Filter<number>, Filter<DiceType>];

const TAG_INDEX = { // 标签页
    Hero: 0,
    Card: 1,
} as const;
type TagIndex = TypeConst<typeof TAG_INDEX>;
const router = useRouter();

// todo 要加入选择版本的下拉框
const version = ref<Version>('v4.7.0');
const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)); // 是否为手机

const herosPool = computed<Hero[]>(() => herosTotal(version.value).filter(h => h.id < 3000)); // 选择的角色池
const cardsPool = computed<Card[]>(() => cardsTotal(version.value).filter(c => c.UI.cnt > 0)); // 选择的卡组池
const oriDecks = ref<OriDeck[]>(JSON.parse(localStorage.getItem('GIdecks') || '[]')); // 原始卡组列表

const currIdx = ref<TagIndex>(TAG_INDEX.Hero); // 当前选择的标签页：0角色 1卡组
const allHeros = ref<Hero[]>([...herosPool.value]); // 可选择角色池
const allCards = ref<Card[]>([...cardsPool.value]); // 可选择卡池
const herosDeck = ref<Hero[]>([]); // 当前角色组
const cardsDeck = ref<Card[]>([]); // 当前卡组
const decks = computed<DeckVO[]>(() => oriDecks.value.map(deck => {
    const { heroIds, cardIds } = parseShareCode(deck.shareCode);
    return {
        name: deck.name,
        heroIds: heroIds.map(hid => {
            const hero = newHero(version.value)(hid);
            return {
                id: hero?.id ?? 1000,
                name: hero?.name ?? '无',
                element: hero?.element ?? ELEMENT_TYPE.Physical,
                tags: hero?.tags ?? [],
                src: hero?.UI.src ?? '',
            }
        }),
        cardIds,
    }
})); // 卡组列表
const editDeckIdx = ref<number>(-1); // 当前编辑卡组索引
const deckName = ref<string>(''); // 卡组名字
const editDeck = ref<{ heroIds: number[], cardIds: number[] }>({ heroIds: [], cardIds: [] }); // 当前编辑卡组
const deckIdx = ref<number>(Number(localStorage.getItem('GIdeckIdx') || 0)); // 出战卡组id
const cardsDeckLen = ref<number>(0); // 卡组数量
const modalInfo = ref<InfoVO>({ ...NULL_MODAL });
const deckListEditIcon = ref([
    { name: '战', handle: (idx: number) => selectDeck(idx) },
    { name: '删', handle: (idx: number) => deleteDeck(idx) },
]);
const heroSelectIcon = ref([
    { name: '左', handle: (idx: number) => selectHero(0, idx) },
    { name: '中', handle: (idx: number) => selectHero(1, idx) },
    { name: '右', handle: (idx: number) => selectHero(2, idx) },
]);
const heroMoveIcon = ref([
    { name: '←', handle: (pos: number) => MoveHero(pos, -1) },
    { name: '↓', handle: (pos: number) => MoveHero(pos, 0) },
    { name: '→', handle: (pos: number) => MoveHero(pos, 1) },
]);
const heroFilter = ref<HeroFilter>();
const cardFilter = ref<CardFilter>();
const filterSelected = ref<string[]>([]);
const isShowFilter = ref<boolean>(false);
const isShowShareCode = ref<boolean>(false);
const shareCode = ref<string>('');
const pShareCode = ref<string>('');

// 获取png图片
const getPngIcon = (name: string) => {
    if (name.startsWith('http')) return name;
    return `/image/${name}.png`;
}

// 选择出战卡组
const selectDeck = (didx: number) => {
    deckIdx.value = didx;
    localStorage.setItem('GIdeckIdx', didx.toString());
}

// 保存卡组
const saveDeck = () => {
    updateShareCode();
    oriDecks.value[editDeckIdx.value] = {
        name: deckName.value || '默认卡组',
        shareCode: shareCode.value,
    }
    localStorage.setItem('GIdecks', JSON.stringify(oriDecks.value));
    editDeckIdx.value = -1;
}

// 删除卡组
const deleteDeck = (did: number) => {
    const isConfirm = confirm('确认删除？');
    if (isConfirm) {
        oriDecks.value[did] = {
            name: '默认卡组',
            shareCode: genShareCode([0, 0, 0]),
        };
        localStorage.setItem('GIdecks', JSON.stringify(decks));
    }
}

// 重置角色筛选
const resetHeroFilter = () => {
    const heroFilterTitle = ['所属', '元素', '武器'];
    const heroVal = [
        Object.values(HERO_LOCAL),
        Object.values(PURE_ELEMENT_TYPE),
        Object.values(WEAPON_TYPE),
    ];
    heroFilter.value = [
        Object.values(HERO_LOCAL_NAME),
        Object.values(PURE_ELEMENT_NAME).map(([v]) => v),
        Object.values(WEAPON_TYPE_NAME),
    ].map((arr, aidx) => ({
        name: heroFilterTitle[aidx],
        value: arr.map((name, i) => ({
            name,
            val: heroVal[aidx][i],
            tap: false,
        })),
    })) as HeroFilter;
}

// 重置卡牌筛选
const resetCardFilter = () => {
    const cardFilterTitle = ['类型', '副类型', '花费', '花费类型'];
    const cardVal = [
        Object.values(CARD_TYPE),
        Object.values(CARD_SUBTYPE),
        [0, 1, 2, 3, 4, 5],
        Object.values(DICE_TYPE),
    ];
    cardFilter.value = [
        Object.values(CARD_TYPE_NAME),
        Object.values(CARD_SUBTYPE_NAME),
        [0, 1, 2, 3, 4, 5],
        ['任意', ...Object.values(PURE_ELEMENT_NAME).map(([v]) => v), '同色'],
    ].map((arr, aidx) => ({
        name: cardFilterTitle[aidx],
        value: arr.map((name, i) => ({
            name,
            val: cardVal[aidx][i],
            tap: false,
        })),
    })) as CardFilter;
}

const updateInfo = (init = false) => {
    if (currIdx.value == TAG_INDEX.Hero || init) {
        allHeros.value = [];
        const heroIds = herosDeck.value.map(v => v.id);
        herosPool.value.forEach(h => {
            if (h.id > 1000) {
                h.isSelected = +heroIds.includes(h.id);
                allHeros.value.push(h);
            }
        });
    }
    if (currIdx.value == TAG_INDEX.Card || init) {
        allCards.value = [];
        cardsPool.value.forEach(c => {
            const cnt = c.UI.cnt - (cardsDeck.value.find(cd => cd.id == c.id)?.UI.cnt ?? 0);
            if (c.id > 0) allCards.value.push(clone(c).setCnt(cnt));
        });
        cardsDeck.value.sort((a, b) => a.id - b.id);
    }
    const elMap = arrToObj(Object.values(ELEMENT_TYPE), 0);
    const lcMap = arrToObj(Object.values(HERO_LOCAL), 0);
    herosDeck.value.forEach(h => {
        ++elMap[h.element];
        h.tags.forEach(lc => {
            if (lc in lcMap) ++lcMap[lc as HeroLocal];
        });
    });
    cardsDeck.value = cardsDeck.value.filter(c => {
        if (c.hasSubtype(CARD_SUBTYPE.Talent)) { // 天赋牌
            return herosDeck.value.map(h => h.id).includes(c.userType as number);
        }
        if (c.hasSubtype(CARD_SUBTYPE.ElementResonance)) { // 元素共鸣
            const [element] = objToArr(elMap).find(([, el]) => el > 1) ?? [ELEMENT_TYPE.Physical];
            if (element == ELEMENT_TYPE.Physical) return false;
            const elCode = PURE_ELEMENT_CODE[element] * 100;
            return [331001 + elCode, 331002 + elCode].includes(c.id);
        }
        if (c.hasTag(CARD_TAG.LocalResonance)) { // 地区共鸣(包括魔物、愚人众)
            const [local] = objToArr(lcMap).find(([, lc]) => lc > 1) ?? [];
            if (local == undefined) return false;
            return c.id == 331800 + HERO_LOCAL_CODE[local];
        }
        return true;
    });
    allCards.value.forEach(c => {
        if (c.hasSubtype(CARD_SUBTYPE.Talent)) { // 天赋牌
            if (!herosDeck.value.some(h => h.id == c.userType)) c.UI.cnt = -1;
            else if (c.UI.cnt == -1) c.UI.cnt = 2;
        } else if (c.hasSubtype(CARD_SUBTYPE.ElementResonance)) { // 元素共鸣
            const [element] = objToArr(elMap).find(([, el]) => el > 1) ?? [ELEMENT_TYPE.Physical];
            if (element == ELEMENT_TYPE.Physical || ![331001 + PURE_ELEMENT_CODE[element] * 100, 331002 + PURE_ELEMENT_CODE[element] * 100].includes(c.id)) {
                c.UI.cnt = -1;
            } else if (c.UI.cnt == -1) c.UI.cnt = 2;
        } else if (c.hasTag(CARD_TAG.LocalResonance)) { // 所属地区(包括魔物、愚人众)
            const [local] = objToArr(lcMap).find(([, lc]) => lc > 1) ?? [];
            if (local == undefined || c.id != 331800 + HERO_LOCAL_CODE[local]) c.UI.cnt = -1;
            else if (c.UI.cnt == -1) c.UI.cnt = 2;
        }
    });
    const cardFilterRes: [CardType[], CardSubtype[], number[], DiceType[]] = cardFilter.value?.map(ftype => {
        return ftype.value.filter(v => v.tap).map(v => v.val);
    }) as [CardType[], CardSubtype[], number[], DiceType[]];
    allCards.value = allCards.value.filter(c => {
        const t = cardFilterRes[0].length == 0 || cardFilterRes[0].includes(c.type);
        const st = cardFilterRes[1].length == 0 || cardFilterRes[1].every(v => c.hasSubtype(v));
        const co = cardFilterRes[2].length == 0 || cardFilterRes[2].includes(c.cost + c.anydice);
        const ct = cardFilterRes[3].length == 0 || cardFilterRes[3].includes(c.costType);
        return t && st && co && ct;
    }).sort((a, b) => {
        if (a.UI.cnt * b.UI.cnt > 0) return 0;
        return b.UI.cnt - a.UI.cnt;
    });
    const heroFilterRes: [HeroTag[], ElementType[], WeaponType[]] = heroFilter.value?.map(ftype => {
        return ftype.value.filter(v => v.tap).map(v => v.val);
    }) as [HeroTag[], ElementType[], WeaponType[]];
    allHeros.value = allHeros.value.filter(h => {
        const tag = heroFilterRes[0].length == 0 || heroFilterRes[0].every(hl => h.tags.includes(hl));
        const element = heroFilterRes[1].length == 0 || heroFilterRes[1].includes(h.element);
        const weapon = heroFilterRes[2].length == 0 || heroFilterRes[2].includes(h.weaponType);
        return tag && element && weapon;
    });
    cardsDeckLen.value = cardsDeck.value.map(v => v.UI.cnt).reduce((a, b) => a + b, 0);
    filterSelected.value = [heroFilter, cardFilter][currIdx.value].value
        ?.filter(ftype => ftype.value.filter(v => v.tap).length > 0)
        .flatMap(ftype => ftype.value.filter(v => v.tap).map(v => v.name)) ?? [];
}


// 获取骰子背景
const getDiceIcon = (name: string) => {
    return `/image/${name}-dice-bg.png`;
}

// 进入编辑卡组界面
const toEditDeck = (did: number) => {
    editDeckIdx.value = did;
    currIdx.value = 0;
    deckName.value = oriDecks.value[did].name;
    editDeck.value = parseShareCode(oriDecks.value[did].shareCode);
    herosDeck.value = editDeck.value.heroIds.map(hid => {
        return clone(herosPool.value.find(v => v.id == hid)!);
    });
    cardsDeck.value = [];
    editDeck.value.cardIds.forEach((cid: number) => {
        const card = clone(cardsPool.value.find(v => v.id == cid)!).setCnt(1);
        const dCard = cardsDeck.value.find(c => c.id == card.id);
        if (dCard == undefined) cardsDeck.value.push(card);
        else ++dCard.UI.cnt;
    });
    resetCardFilter();
    resetHeroFilter();
    updateInfo(true);
}

// 更新分享码
const updateShareCode = () => {
    shareCode.value = genShareCode((herosDeck.value.map(v => v.id).concat(cardsDeck.value.flatMap(v => new Array(v.UI.cnt).fill(v.id)))));
}

// 返回
const exit = () => {
    if (editDeckIdx.value == -1) {
        router.back();
        return;
    }
    editDeckIdx.value = -1;
}

// 选择角色
const selectHero = (pos: number, hid: number) => {
    cancel();
    herosDeck.value[pos] = { ...(allHeros.value.find(v => v.id == hid) ?? allHeros.value[0]) };
    updateInfo();
}

// 移动角色
const MoveHero = (pos: number, dir: number) => {
    cancel();
    if (dir == 0) {
        herosDeck.value[pos] = NULL_HERO();
        updateInfo();
    } else {
        const npos = (pos + dir + 3) % 3;
        [herosDeck.value[pos], herosDeck.value[npos]] = [herosDeck.value[npos], herosDeck.value[pos]];
    }

}

// 选择卡片
const selectCard = (cid: number) => {
    cancel();
    if (cardsDeckLen.value >= DECK_CARD_COUNT) return alert('卡组已满');
    const card = allCards.value.find(c => c.id == cid) ?? allCards.value[0];
    --card.UI.cnt;
    const curCard = cardsDeck.value.find(cd => cd.id == card.id);
    if (curCard == undefined) cardsDeck.value.push(clone(card).setCnt(1));
    else curCard.UI.cnt = card.hasSubtype(CARD_SUBTYPE.Legend) ? 1 : 2 - card.UI.cnt;
    updateInfo();
    cancel();
}

// 移除卡片
const removeCard = (cid: number) => {
    cancel();
    const cidx = cardsDeck.value.findIndex(c => c.id == cid);
    const card = cardsDeck.value[cidx];
    if (--card.UI.cnt <= 0) cardsDeck.value.splice(cidx, 1);
    updateInfo();
    cancel();
}

// 显示角色信息
const showHeroInfo = (hid: number) => {
    if (hid <= 1000) return;
    modalInfo.value = {
        version: version.value,
        isShow: true,
        type: INFO_TYPE.Hero,
        info: herosPool.value.find(h => h.id == hid)!,
    }
}

// 显示卡片信息
const showCardInfo = (cid: number) => {
    if (cid <= 0) return;
    modalInfo.value = {
        version: version.value,
        isShow: true,
        type: INFO_TYPE.Card,
        info: cardsPool.value.find(c => c.id == cid)!,
    }
}

const selectFilter = (tidx: number, vidx: number) => {
    const tags = [heroFilter, cardFilter][currIdx.value].value?.[tidx].value;
    if (!tags) return;
    const select = tags[vidx];
    select.tap = !select.tap;
    if (currIdx.value == 0 && [1, 2].includes(tidx) || currIdx.value == 1 && [0, 2, 3].includes(tidx)) {
        tags.forEach((v, vi) => {
            if (vi != vidx) v.tap = false;
        });
    }
    updateInfo();
}

const showFilter = () => {
    isShowFilter.value = !isShowFilter.value;
}

const showShareCode = () => {
    isShowShareCode.value = true;
    updateShareCode();
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(shareCode.value).then(() => confirm('已成功复制到剪贴板'))
            .catch(err => alert('无法复制到剪贴板:' + err));
    } else if (document.execCommand) {
        var textArea = document.createElement('textarea');
        textArea.value = shareCode.value;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        setTimeout(() => {
            document.execCommand('copy');
            textArea.remove();
            confirm('已成功复制到剪贴板')
        }, 0);
    } else {
        alert('无法复制到剪贴板');
    }
}

const pasteShareCode = () => {
    const { heroIds, cardIds } = parseShareCode(pShareCode.value);
    herosDeck.value.forEach((_, hi, ha) => {
        ha[hi] = herosPool.value.find(v => v.id == heroIds[hi])!;
    });
    cardsDeck.value = [];
    for (const cid of cardIds) {
        const card = cardsDeck.value.find(c => c.id == cid);
        if (card == undefined) cardsDeck.value.push(clone(cardsPool.value.find(c => c.id == cid)!).setCnt(1));
        else ++card.UI.cnt;
    }
    updateShareCode();
    pShareCode.value = '';
}

const reset = () => {
    if (currIdx.value == 0) resetHeroFilter();
    else resetCardFilter();
    updateInfo();
}

const cancel = () => {
    isShowFilter.value = false;
    isShowShareCode.value = false;
    modalInfo.value = { ...NULL_MODAL }
}


</script>

<style scoped>
body div {
    user-select: none;
}

.edit-deck-container {
    position: relative;
    width: 100%;
    height: 95vh;
    background-color: #daa98a;
    overflow: hidden;
}

.edit-deck-list {
    width: 100%;
    background-color: #db8803;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    overflow-x: auto;
    white-space: nowrap;
    border-top: 10px solid #572e00;
    border-bottom: 10px solid #572e00;
    padding: 5px 10px;
    box-sizing: border-box;
}

.deck {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 200px;
    width: 100px;
    background-color: #ddba54;
    margin: 5px;
    padding: 5px;
    border-radius: 10px;
    cursor: pointer;
}

.deck:hover,
.deck:active {
    background-color: #daaf2f;
}

.deck-hero {
    height: 22%;
    width: 95%;
    margin: 3px 0;
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #775900;
}

.edit-btn-group {
    margin-top: 5px;
}

.edit-list-icon {
    padding: 0 10px;
    margin: 5px;
    border: 2px solid black;
    border-radius: 5px;
    cursor: pointer;
}

.edit-list-icon:hover,
.edit-list-icon:active {
    background-color: #8a5a00;
    color: white;
}

.edit-deck {
    width: 100%;
    height: 100%;
    background-color: #daa98a;
    position: absolute;
    padding: 5px 10px;
    box-sizing: border-box;
}

.edit-btn {
    border: 5px outset orange;
    background-color: #be7b00;
    cursor: pointer;
    border-radius: 5px;
}

.edit-btn:hover {
    background-color: #e0aa46;
    border: 5px outset #ffd27e;
}

.edit-btn:active {
    background-color: #e0aa46;
    border: 5px inset #ffd27e;
}

.edit-btn.exit {
    position: absolute;
    top: 0;
    left: 0;
}

.edit-btn.save {
    position: absolute;
    top: 0;
    left: 50px;
}

.edit-btn.filter {
    position: absolute;
    bottom: 5px;
    left: 5px;
}

.edit-btn.reset {
    position: absolute;
    bottom: 5px;
    left: 55px;
}

.edit-btn.share {
    transform: translate(20px);
}

.share-code {
    user-select: all;
    position: absolute;
    top: 40px;
    left: 80px;
    width: 80%;
    background-color: #d38900;
    border: 3px solid #583a01;
    word-break: break-all;
    text-align: center;
    padding: 10px;
    margin: 5px;
    border-radius: 10px;
    z-index: 10;
}

.deck-name {
    margin-left: 15%;
    background-color: #daa98a;
    border: 0;
    padding: 5px;
}

.share-code-input {
    margin-left: 5%;
    background-color: #daa98a;
    border: 0;
    padding: 5px;
    width: 80px;
}

.edit-deck-btn-group {
    position: absolute;
    top: 50px;
    left: 0;
    display: flex;
    flex-direction: column;
}

.edit-deck-btn-group button {
    background-color: #925f00;
    border: 3px solid #583a01;
    padding: 10px 2px;
    margin: 5px;
    border-radius: 10px;
    cursor: pointer;
}

.edit-deck-btn-group button:hover,
.edit-deck-btn-group button:active {
    background-color: #d2a858;
}

.edit-deck-btn-group button.active {
    background-color: #ffcf77;
}

.heros-deck {
    position: absolute;
    left: 50%;
    top: 20%;
    transform: translate(-50%, -20%);
    background-color: #d59b3f;
    width: 80%;
    height: 30%;
    display: flex;
    justify-content: space-around;
    align-items: center;
    border-radius: 15px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.cards-deck {
    position: absolute;
    left: 50%;
    top: 20%;
    transform: translate(-50%, -20%);
    background-color: #d59b3f;
    width: 80%;
    height: 35%;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-radius: 15px;
    padding: 0 5px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.hero-deck {
    position: relative;
    background-color: #ffd0a2;
    width: 120px;
    height: 80%;
    border-radius: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    overflow: hidden;
}

.heros-total,
.cards-total {
    position: absolute;
    left: 50%;
    bottom: 20%;
    transform: translate(-50%, 20%);
    background-color: #d59b3f;
    width: 80%;
    height: 35%;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-radius: 15px;
    padding: 0 5px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.hero-total,
.card-total,
.card-deck {
    position: relative;
    background-color: #ffd0a2;
    width: 120px;
    height: 90%;
    border-radius: 10px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    margin: 5px;
    margin-bottom: 10px;
    cursor: pointer;
}

.hero-total {
    overflow: hidden;
}

.card-img-content {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 10px;
    overflow: hidden;
}

.hero-img,
.card-img {
    position: absolute;
    top: 0;
    width: 100%;
    text-align: center;
    line-height: 500%;
}

.curr-deck {
    box-shadow: 4px 4px 6px #ffeb56,
        -4px 4px 6px #ffeb56,
        4px -4px 6px #ffeb56,
        -4px -4px 6px #ffeb56;
}


.subtype8-border {
    position: absolute;
    width: 100%;
    height: 100%;
}

.card-cost {
    position: absolute;
    left: 0;
    top: 0;
    text-align: center;
    color: white;
    font-weight: bold;
    width: 20px;
    height: 20px;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-cost>span,
.card-energy>span {
    position: absolute;
    left: 0;
    top: 0;
}

.dice-img {
    position: absolute;
    left: -10px;
    top: -5px;
    width: 30px;
}

.card-energy {
    position: absolute;
    left: 0;
    top: 30px;
    text-align: center;
    color: white;
    font-weight: bold;
    width: 20px;
    height: 20px;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-cnt {
    background-color: #583a01;
    color: white;
    border: 2px solid black;
    border-radius: 10px;
    position: absolute;
    top: 3px;
    right: 3px;
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.icon-group {
    position: absolute;
    display: flex;
    bottom: 5px;
    width: 100%;
    justify-content: space-around;
}

.edit-icon {
    padding: 0 5px;
    border: 2px solid black;
    border-radius: 5px;
    cursor: pointer;
    color: black;
    background: white;
}

.card-select-icon {
    position: absolute;
    bottom: 5px;
    right: 5px;
    min-width: 12px;
    text-align: center;
}

.card-remove-icon {
    position: absolute;
    bottom: 5px;
    left: 5px;
    min-width: 12px;
    text-align: center;
}

.forbidden {
    position: absolute;
    width: 100%;
    background: #ffb6b6f1;
    padding: 3px 0;
    color: red;
    font-weight: bold;
    text-align: center;
    box-sizing: border-box;
}

.selected {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    padding-top: 50%;
    background: #0000009e;
    border-radius: inherit;
    color: white;
    text-align: center;
    box-sizing: border-box;
}

.filter-condition {
    position: absolute;
    bottom: 40px;
    left: 5px;
    border-radius: 10px;
    border: 4px solid #001b73;
    background-color: #566bb7;
    color: white;
    box-sizing: border-box;
    max-height: 70%;
    max-width: 50%;
    overflow: auto;
    padding: 5px;
}

.filter-title {
    padding: 5px;
    font-weight: bolder;
}

.filter-tags {
    display: flex;
    flex-wrap: wrap;
}

.filter-tag {
    border: 2px solid #343b7d;
    background-color: #3a457d;
    margin: 4px 2px;
    padding: 3px 10px;
    border-radius: 5px;
    cursor: pointer;
    box-sizing: border-box;
}

.filter-tag:active,
.filter-tag.active {
    background-color: #4b65cd;
}

.filter-selected {
    position: absolute;
    bottom: 10px;
    left: 110px;
}

.mobile-card-deck {
    width: 65px;
}

::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    background: transparent;
}

::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: #335c9973;
}

::-webkit-scrollbar-track {
    background: transparent;
}
</style>import { DeckVO, InfoVO } from 'typing';
import { Hero, Card } from '../../../typing';Card, import { DeckVO, InfoVO } from 'typing';
