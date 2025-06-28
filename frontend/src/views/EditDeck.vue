<template>
    <div class="edit-deck-container" @click="cancel">
        <button class="edit-btn exit" @click.stop="exit">返回</button>
        <div v-if="editDeckIdx == -1 && isEditDeck" class="edit-deck-list">
            <div v-for="(deck, did) in decks" :key="'deckid:' + did" class="deck"
                :class="{ 'curr-deck': deckIdx == did }" @click="toEditDeck(did)">
                <div class="deck-info">
                    <div class="forbidden" style="border-radius: 5px 5px 0 0;"
                        v-if="deckIdx == did && (deck.heroIds.some(h => h.id == 0) || deck.cardIds.length < 30)">
                        卡组不完整
                    </div>
                    <div>{{ deck.name }}</div>
                    <div style="height: 1.2rem;">
                        {{ OFFLINE_VERSION.includes(deck.version as OfflineVersion) ? '实体版' : '' }}{{
                            compareVersionFn(deck.version).value }}
                    </div>
                    <div class="deck-heros">
                        <div v-for="(hero, hidx) in deck.heroIds" :key="hidx" class="deck-hero">
                            <img v-if="hero.avatar" :src="hero.avatar" :alt="hero.name"
                                style="width: 100%;height: 100%;" />
                            <div v-else
                                style="height: 100%;aspect-ratio: 1/1;align-content: center;text-align: center;border-radius: 50%;"
                                :style="{ backgroundColor: ELEMENT_COLOR[hero.element] }">
                                {{ hero.name }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="edit-btn-group">
                    <div class="edit-list-icon" @click.stop="selectDeck(did)">出战</div>
                    <img class="edit-list-icon" @click.stop="deleteDeck(did)" src="@@/svg/delete.svg"
                        style="width: 15%;" alt="删" />
                </div>
            </div>
        </div>
        <div v-else class="edit-container">
            <button class="edit-btn exit" @click.stop="exit">返回</button>
            <button class="edit-btn save" @click.stop="isEditDeck ? saveDeck() : saveConfig()">
                {{ mode.startsWith('edit') ? '保存' : '创建' }}
            </button>
            <button class="edit-btn share-deck" @click.stop="isEditDeck ? shareDeck() : exportConfig()">
                {{ isEditDeck ? '分享' : '导出' }}
            </button>
            <div class="deck-share-img" v-if="isShowDeckShareImg" @click.stop="">
                <span>{{herosDeck.filter(h => h.id > 0).length + cardsDeck.length}}</span>
                <canvas id="deck-share" style="width: 100%;height: 100%;"></canvas>
                <img src="@@/image/deck-share.png" style="width: 100%;height: 100%;position: absolute;top: 0;left: 0;"
                    draggable="false">
                <img class="deck-share-hero-img" v-for="(hero, hidx) in herosDeck" :key="hidx" :src="hero.UI.src"
                    :style="{ left: `${29.4 + 13.5 * hidx}%` }" />
                <img class="deck-share-card-img"
                    v-for="(card, cidx) in cardsDeck.flatMap(c => c.UI.cnt == 1 ? c : new Array(c.UI.cnt).fill(c))"
                    :style="{ left: `${21 + 9.5 * (cidx % 6)}%`, top: `${32 + 10.9 * Math.floor(cidx / 6)}%` }"
                    :key="cidx" :src="card.UI.src">
            </div>
            <div class="edit-deck-btn-group">
                <button @click.stop="{ currIdx = 0; updateInfo(); }" :class="{ active: currIdx == 0 }">
                    角色
                </button>
                <button @click.stop="{ currIdx = 1; updateInfo(); }" :class="{ active: currIdx == 1 }">
                    卡组
                </button>
                <select name="version" id="version" v-model="version" :size="selectSize" @click.stop="clickSelect"
                    @change="updateInfo()">
                    <option v-for="ver in versionSelect" :key="ver" :value="ver">
                        {{ ver }}
                    </option>
                </select>
                <button class="edit-btn reset-config" @click="changeVersion(currIdx, -1)">清除配置</button>
                <div v-if="isEditDeck">
                    <input id="isOfflineInput" type="checkbox" :checked="isOfflineVersion"
                        @change="switchOfflineVersion" />
                    <label for="isOfflineInput">实体版</label>
                </div>
            </div>
            <input v-model="deckName" class="deck-name" />
            <template v-if="isEditDeck">
                <button class="edit-btn share" @click.stop="showShareCode">复制分享码</button>
                <input type="text" v-model="pShareCode" class="share-code-input" placeholder="粘贴分享码" />
                <button id="paste-share-code" class="edit-btn share" v-if="pShareCode.length > 0"
                    @click.stop="pasteShareCode">
                    粘贴分享码
                </button>
                <div class="share-code" v-if="isShowShareCode" @click.stop="">{{ shareCode }}</div>
            </template>
            <div v-if="currIdx == 0">
                <div class="heros-deck" :class="{ 'mobile-heros-deck': isMobile }" v-if="isEditDeck">
                    <div class="hero-deck" :class="{ 'mobile-hero-avatar': isMobile }"
                        v-for="(dhero, dhidx) in herosDeck" :key="dhidx" @click.stop="showHeroInfo(dhero.id)">
                        <img class="hero-img" :src="dhero.UI.avatar" v-if="dhero?.UI.avatar?.length > 0"
                            :alt="dhero.name" draggable="false" />
                        <span v-else class="hero-img"
                            style="background-color: #ffd0a2;border-radius: 50%;aspect-ratio: 1/1;">
                            {{ dhero.name }}
                        </span>
                        <div class="icon-group" v-if="dhero.id > 1000">
                            <span v-for="(icon, cidx) in heroMoveIcon" :key="cidx" class="edit-icon"
                                @click.stop="icon.handle(dhidx)">
                                {{ icon.name }}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="heros-total" :class="{ 'mobile-heros-total': isMobile, 'config-total': !isEditDeck }">
                    <div class="hero-total" :class="{ 'mobile-hero-deck': isMobile }" v-for="dthero in allHeros"
                        :key="dthero.id" :style="{ color: ELEMENT_COLOR[dthero.element] }"
                        @click.stop="showHeroInfo(dthero.id)">
                        <span class="hero-img">{{ dthero.name }}</span>
                        <div class="hero-hp" v-if="(dthero?.hp ?? 0) > 0">
                            <img class="hero-hp-bg" src="@@/image/hero-hp-bg.png" />
                            <StrokedText class="hero-hp-cnt" :class="{ 'mobile-hero-hp-cnt': isMobile }">
                                {{ dthero.maxHp }}
                            </StrokedText>
                        </div>
                        <img class="hero-img" :src="dthero.UI.src" v-if="dthero?.UI.src?.length > 0" :alt="dthero.name"
                            draggable="false" />
                        <div class="icon-group" v-if="!dthero.UI.isActive && isEditDeck">
                            <span v-for="(icon, cidx) in heroSelectIcon" :key="cidx" class="edit-icon"
                                @click.stop="icon.handle(dthero.id)">
                                {{ icon.name }}
                            </span>
                        </div>
                        <div v-else-if="isEditDeck" class="selected">已选择</div>
                        <select :name="`config-${dthero.id}-version`" :id="`config-${dthero.id}-version`"
                            v-if="!isEditDeck" v-model="herosVersion[dthero.id]" style="z-index:2;" @click.stop="cancel"
                            @change="changeVersion(currIdx, dthero.id)">
                            <option v-for="ver in versionSelect" :key="ver" :value="ver">
                                {{ ver }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>
            <div v-else>
                <div :style="{ position: 'absolute', right: '10%', top: '5%' }" v-if="isEditDeck">{{ cardsDeckLen }}/30
                </div>
                <div class="cards-deck" :class="{ 'mobile-cards-deck': isMobile }" v-if="isEditDeck">
                    <div class="card-deck" :class="{ 'mobile-card-deck': isMobile }" v-for="(dcard, dcidx) in cardsDeck"
                        :key="dcidx" @click.stop="showCardInfo(dcard.id)">
                        <Actioncard :card="dcard" :isMobile="isMobile" isHideBorder isHideCost
                            style="width: 100%;height: 100%;">
                            <span class="edit-icon card-select-icon"
                                v-if="(allCards.find(c => c.id === dcard.id)?.UI.cnt ?? -1) > 0"
                                @click.stop="selectCard(dcard.id)">+</span>
                            <span class="edit-icon card-remove-icon" @click.stop="removeCard(dcard.id)">-</span>
                            <div class="card-cnt">{{ dcard.UI.cnt }}</div>
                        </Actioncard>
                    </div>
                </div>
                <div class="cards-total" :class="{ 'mobile-cards-total': isMobile, 'config-total': !isEditDeck }">
                    <div class="card-total" :class="{ 'mobile-card-deck': isMobile }"
                        v-for="(dtcard, dtcidx) in allCards" :key="dtcidx" @click.stop="showCardInfo(dtcard.id)">
                        <Actioncard :card="dtcard" :isMobile="isMobile" isHideBorder :isHideCost="dtcard.UI.cnt == 0"
                            style="width: 100%;height: 100%;">
                            <template v-if="isEditDeck">
                                <div class="forbidden" v-if="dtcard.UI.cnt == -1">
                                    已失效
                                </div>
                                <span v-else-if="dtcard.UI.cnt > 0" class="edit-icon card-select-icon"
                                    @click.stop="selectCard(dtcard.id)">+</span>
                                <div v-else class="selected">已选完</div>
                                <span class="edit-icon card-remove-icon" @click.stop="removeCard(dtcard.id)"
                                    v-if="dtcard.UI.cnt >= 0 && cardsDeck.some(c => c.id == dtcard.id)">-</span>
                                <div class="card-cnt" v-if="dtcard.UI.cnt > 0">{{ dtcard.UI.cnt }}</div>
                            </template>
                            <select :name="`config-${dtcard.id}-version`" :id="`config-${dtcard.id}-version`"
                                v-if="!isEditDeck" v-model="cardsVersion[dtcard.id]" style="z-index:2;"
                                @click.stop="cancel" @change="changeVersion(currIdx, dtcard.id)">
                                <option v-for="ver in versionSelect" :key="ver" :value="ver">
                                    {{ ver }}
                                </option>
                            </select>
                        </Actioncard>
                    </div>
                </div>
            </div>
            <button class="edit-btn filter" @click.stop="showFilter">筛选</button>
            <button class="edit-btn reset" @click="reset">重置</button>
            <div class="filter-condition" v-if="isShowFilter" @click.stop="">
                <select name="sinceVersion" class="filter-select" v-model="sinceVersionFilter" @change="updateInfo()">
                    <option v-for="ver in sinceVersionSelect" :key="ver" :value="ver">
                        {{ ver }}
                    </option>
                </select>
                <span class="filter-tag" :class="{ active: isOnlyShowConfiged }"
                    @click.stop="selectFilter(currIdx)">只显示修改过</span>
                <div v-for="(htitle, fidx) in [heroFilter, cardFilter][currIdx]" :key="fidx">
                    <div class="filter-title">{{ htitle.name }}</div>
                    <div class="filter-tags">
                        <span class="filter-tag" :class="{ active: val.tap }" v-for="(val, sidx) in htitle.value"
                            :style="{ color: val.color }" :key="sidx" @click.stop="selectFilter(fidx, sidx)">
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
        <InfoModal :info="modalInfo" :isMobile="isMobile" :isConfig="!isEditDeck" />
    </div>
    <div class="debug-mask" v-if="maskOpacity != 0" :style="{ opacity: maskOpacity }"></div>
</template>

<script setup lang="ts">
import InfoModal from '@/components/InfoModal.vue';
import {
    CARD_SUBTYPE, CARD_TAG, CARD_TYPE, CardSubtype, CardType, DICE_TYPE, DiceType, ELEMENT_TYPE, ElementType, HERO_LOCAL,
    HERO_LOCAL_CODE, HeroLocal, HeroTag, INFO_TYPE, OFFLINE_VERSION, OfflineVersion, PURE_ELEMENT_CODE, PURE_ELEMENT_TYPE,
    TypeConst, Version, VERSION, WEAPON_TYPE, WeaponType,
} from '@@@/constant/enum';
import { DECK_CARD_COUNT } from '@@@/constant/gameOption';
import { NULL_CARD, NULL_CUSTOM_VERSION_CONFIG, NULL_HERO, NULL_MODAL } from '@@@/constant/init';
import {
    CARD_SUBTYPE_NAME, CARD_TYPE_NAME, ELEMENT_COLOR, ELEMENT_NAME_KEY, HERO_LOCAL_NAME, PURE_ELEMENT_NAME, WEAPON_TYPE_NAME,
} from '@@@/constant/UIconst';
import { DeckVO, OriDeck } from 'typing';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { cardsTotal, newCard } from '../../../common/data/cards';
import { herosTotal, newHero, parseHero } from '../../../common/data/heros';
import { arrToObj, clone, exportFile, genShareCode, objToArr, parseShareCode } from '../../../common/utils/utils';
import { Card, CustomVersionConfig, Hero, InfoVO } from '../../../typing';
import { compareVersionFn } from '@@@/utils/gameUtil';
import Actioncard from '@/components/Card.vue';
import StrokedText from '@/components/StrokedText.vue';

type Filter<T> = {
    name: string,
    value: {
        name: string,
        val: T,
        tap: boolean,
        color: string,
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
const route = useRoute();

const isMobile = ref(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)); // 是否为手机
const maskOpacity = ref(+(history.state.maskOpacity ?? 0));
const mode: string = (route.params?.mode ?? 'edit-deck') as string;
const isEditDeck = mode == 'edit-deck';

const oriDecks = ref<OriDeck[]>(JSON.parse(localStorage.getItem('GIdecks') || '[]')); // 原始卡组列表
const editDeckIdx = ref<number>(-1); // 当前编辑卡组索引
const oriVersion = computed(() => oriDecks.value[editDeckIdx.value]?.version ?? 'vlatest');
const version = ref<Version>(compareVersionFn(oriVersion.value).value); // 当前版本
const herosPool = computed<Hero[]>(() => herosTotal(version.value, false, !isEditDeck)); // 选择的角色池
const cardsPool = computed<Card[]>(() => cardsTotal(version.value, false, !isEditDeck)); // 选择的卡组池

const currIdx = ref<TagIndex>(TAG_INDEX.Hero); // 当前选择的标签页
const allHeros = ref<Hero[]>([...herosPool.value]); // 可选择角色池
const allCards = ref<Card[]>([...cardsPool.value]); // 可选择卡池
const herosDeck = ref<Hero[]>([]); // 当前角色组
const cardsDeck = ref<Card[]>([]); // 当前卡组
const decks = computed<DeckVO[]>(() => oriDecks.value.map(deck => { // 卡组列表
    const { heroIds, cardIds } = parseShareCode(deck.shareCode);
    return {
        name: deck.name,
        version: deck.version,
        heroIds: heroIds.map(hid => {
            const hero = parseHero(hid);
            return {
                id: hero.id,
                name: hero.name,
                element: hero.element,
                tags: hero.tags,
                src: hero.UI.src,
                avatar: hero.UI.avatar,
            }
        }),
        cardIds,
    }
}));
const deckName = ref<string>(''); // 卡组名字
const editDeck = ref<{ heroIds: number[], cardIds: number[] }>({ heroIds: [], cardIds: [] }); // 当前编辑卡组
const deckIdx = ref<number>(Number(localStorage.getItem('GIdeckIdx') || 0)); // 出战卡组id
const cardsDeckLen = computed<number>(() => cardsDeck.value.map(v => v.UI.cnt).reduce((a, b) => a + b, 0)); // 卡组数量
const modalInfo = ref<InfoVO>(NULL_MODAL());
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
const versionSelect = computed(() => isOfflineVersion.value ? OFFLINE_VERSION : VERSION);
const heroFilter = ref<HeroFilter>();
const cardFilter = ref<CardFilter>();
const isOnlyShowConfiged = ref<boolean>(false);
const filterSelected = ref<string[]>([]);
const isShowFilter = ref<boolean>(false);
const isShowShareCode = ref<boolean>(false);
const shareCode = ref<string>('');
const pShareCode = ref<string>('');
const isShowDeckShareImg = ref<boolean>(false);
const isOfflineVersion = ref<boolean>(false);
const selectSize = ref<number>(0);
const sinceVersionSelect = computed(() => ['实装版本'].concat(versionSelect.value.filter(ver => compareVersionFn(ver).lte(version.value))));
const sinceVersionFilter = ref(sinceVersionSelect.value[0]);

const { configName } = history.state;
if (configName) deckName.value = configName;
const customVersionList: CustomVersionConfig[] = JSON.parse(localStorage.getItem('7szh_custom_version_list') || '[]'); // 自定义版本列表
if (mode == 'create') deckName.value = `版本配置${customVersionList.length + 1}`;
const customVersionIdx = customVersionList.findIndex(v => v.name == configName); // 当前自定义版本配置索引
const customVersion = ref<CustomVersionConfig>(customVersionList[customVersionIdx] || NULL_CUSTOM_VERSION_CONFIG()); // 当前自定义版本配置
version.value = customVersion.value.baseVersion;
const herosVersion = ref<Record<number, Version>>({});
herosPool.value.forEach(h => herosVersion.value[h.id] = customVersion.value.diff[h.id] ?? version.value);
const cardsVersion = ref<Record<number, Version>>({});
cardsPool.value.forEach(c => cardsVersion.value[c.id] = customVersion.value.diff[c.id] ?? version.value);
const isDiffEmpty = computed(() => Object.keys(customVersion.value.diff).length == 0);

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
        version: version.value == VERSION[0] ? 'vlatest' : version.value,
        shareCode: shareCode.value,
    }
    const decks = JSON.stringify(oriDecks.value);
    localStorage.setItem('GIdecks', decks);
    editDeckIdx.value = -1;
}

// 删除卡组
const deleteDeck = (did: number) => {
    const isConfirm = confirm('确认删除？');
    if (isConfirm) {
        oriDecks.value[did] = {
            name: '默认卡组',
            version: VERSION[0],
            shareCode: genShareCode([0, 0, 0]),
        };
        const decks = JSON.stringify(oriDecks.value);
        localStorage.setItem('GIdecks', decks);
    }
}

// 分享卡组
const shareDeck = () => {
    isShowDeckShareImg.value = true;
}

// 切换线下版
const switchOfflineVersion = () => {
    isOfflineVersion.value = !isOfflineVersion.value;
    if (isOfflineVersion.value) {
        version.value = OFFLINE_VERSION[0];
    } else {
        version.value = VERSION[0];
    }
    updateInfo();
}

// 点击下拉框
const clickSelect = () => {
    if (versionSelect.value.length < 5 || isMobile.value) return;
    if (selectSize.value == 0) selectSize.value = 5;
    else selectSize.value = 0;
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
            color: aidx == 1 ? ELEMENT_COLOR[ELEMENT_NAME_KEY[name + '元素']] : 'white',
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
    if (isEditDeck) {
        herosDeck.value = herosDeck.value.map(h => herosPool.value.some(ph => ph.id == h.id) ? h : NULL_HERO());
        if (currIdx.value == TAG_INDEX.Hero || init) {
            allHeros.value = [];
            const heroIds = herosDeck.value.map(v => v.id);
            herosPool.value.forEach(h => {
                h.UI.isActive = heroIds.includes(h.id);
                allHeros.value.push(h);
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
            if (cardsPool.value.every(pc => pc.id != c.id)) return false;
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
                if (element == ELEMENT_TYPE.Physical || !Array.from({ length: 2 }, (_, i) => 331001 + i + PURE_ELEMENT_CODE[element] * 100).includes(c.id)) {
                    c.UI.cnt = -1;
                } else if (c.UI.cnt == -1) c.UI.cnt = 2;
            } else if (c.hasTag(CARD_TAG.LocalResonance)) { // 所属地区(包括魔物、愚人众)
                const [local] = objToArr(lcMap).find(([, lc]) => lc > 1) ?? [];
                if (local == undefined || c.id != 331800 + HERO_LOCAL_CODE[local]) c.UI.cnt = -1;
                else if (c.UI.cnt == -1) c.UI.cnt = 2;
            }
        });
    } else {
        allHeros.value = herosPool.value.map(h => {
            if (!customVersion.value.diff[h.id]) return h;
            return newHero(customVersion.value.diff[h.id])(h.id);
        });
        allCards.value = cardsPool.value.map(c => {
            if (!customVersion.value.diff[c.id]) return c;
            return newCard(customVersion.value.diff[c.id])(c.id);
        });
    }
    const cardFilterRes = cardFilter.value?.map(ftype => {
        return ftype.value.filter(v => v.tap).map(v => v.val);
    }) as [CardType[], CardSubtype[], number[], DiceType[]];
    allCards.value = allCards.value.filter(c => {
        const t = cardFilterRes[0].length == 0 || cardFilterRes[0].includes(c.type);
        const st = cardFilterRes[1].length == 0 || cardFilterRes[1].every(v => c.hasSubtype(v));
        const co = cardFilterRes[2].length == 0 || cardFilterRes[2].includes(c.cost + c.anydice);
        const ct = cardFilterRes[3].length == 0 || cardFilterRes[3].includes(c.costType);
        const sinceVersion = sinceVersionFilter.value == '实装版本' || c.sinceVersion == sinceVersionFilter.value;
        const isConfigTalent = isEditDeck || !c.hasSubtype(CARD_SUBTYPE.Talent);
        const isConfigShow = isEditDeck || !isOnlyShowConfiged.value || customVersion.value.diff[c.id];
        return t && st && co && ct && sinceVersion && isConfigTalent && isConfigShow;
    }).sort((a, b) => {
        if (a.UI.cnt == -1 && b.UI.cnt != -1) return 1;
        if (a.UI.cnt != -1 && b.UI.cnt == -1) return -1;
        return 0;
    });
    const heroFilterRes: [HeroTag[], ElementType[], WeaponType[]] = heroFilter.value?.map(ftype => {
        return ftype.value.filter(v => v.tap).map(v => v.val);
    }) as [HeroTag[], ElementType[], WeaponType[]];
    allHeros.value = allHeros.value.filter(h => {
        const tag = heroFilterRes[0].length == 0 || heroFilterRes[0].every(hl => h.tags.includes(hl));
        const element = heroFilterRes[1].length == 0 || heroFilterRes[1].includes(h.element);
        const weapon = heroFilterRes[2].length == 0 || heroFilterRes[2].includes(h.weaponType);
        const sinceVersion = sinceVersionFilter.value == '实装版本' || h.sinceVersion == sinceVersionFilter.value;
        const isConfigShow = isEditDeck || !isOnlyShowConfiged.value || customVersion.value.diff[h.id];
        return tag && element && weapon && sinceVersion && isConfigShow;
    });
    filterSelected.value = (sinceVersionFilter.value == '实装版本' ? [] : [sinceVersionFilter.value])
        .concat([heroFilter, cardFilter][currIdx.value].value
            ?.filter(ftype => ftype.value.filter(v => v.tap).length > 0)
            .flatMap(ftype => ftype.value.filter(v => v.tap).map(v => v.name)) ?? []);
}

// 进入配置版本页面
if (!isEditDeck) {
    resetCardFilter();
    resetHeroFilter();
    updateInfo(true);
}

// 进入编辑卡组界面
const toEditDeck = (did: number) => {
    editDeckIdx.value = did;
    version.value = compareVersionFn(oriVersion.value).value;
    isOfflineVersion.value = OFFLINE_VERSION.includes(version.value as OfflineVersion);
    currIdx.value = TAG_INDEX.Hero;
    deckName.value = oriDecks.value[did].name;
    editDeck.value = parseShareCode(oriDecks.value[did].shareCode);
    herosDeck.value = editDeck.value.heroIds.map(hid => {
        return clone(herosPool.value.find(v => v.shareId == hid)) ?? NULL_HERO();
    });
    cardsDeck.value = [];
    for (const cid of editDeck.value.cardIds) {
        const card = clone(cardsPool.value.find(v => v.shareId == cid))?.setCnt(1);
        if (card == undefined) continue;
        const dCard = cardsDeck.value.find(c => c.id == card.id);
        if (dCard == undefined) cardsDeck.value.push(card);
        else ++dCard.UI.cnt;
    };
    resetCardFilter();
    resetHeroFilter();
    updateInfo(true);
}

// 更新分享码
const updateShareCode = () => {
    shareCode.value = genShareCode(herosDeck.value.map(v => v.shareId).concat(cardsDeck.value.flatMap(v => new Array(v.UI.cnt).fill(v.shareId))));
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
    const card = allCards.value.find(c => c.id == cid) ?? NULL_CARD();
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
        version: customVersion.value.diff[hid] ?? version.value,
        isShow: true,
        type: INFO_TYPE.Hero,
        info: allHeros.value.find(h => h.id == hid)!,
    }
}

// 显示卡片信息
const showCardInfo = (cid: number) => {
    if (cid <= 0) return;
    modalInfo.value = {
        version: customVersion.value.diff[cid] ?? version.value,
        isShow: true,
        type: INFO_TYPE.Card,
        info: allCards.value.find(c => c.id == cid)!,
    }
}

const selectFilter = (tidx: number, vidx: number = -1) => {
    if (vidx == -1) isOnlyShowConfiged.value = !isOnlyShowConfiged.value;
    const tags = [heroFilter, cardFilter][currIdx.value].value?.[tidx].value;
    if (!tags) return;
    const select = tags[vidx];
    if (select) {
        select.tap = !select.tap;
        if (currIdx.value == TAG_INDEX.Hero && [1, 2].includes(tidx) || currIdx.value == TAG_INDEX.Card && [0, 2, 3].includes(tidx)) {
            tags.forEach((v, vi) => {
                if (vi != vidx) v.tap = false;
            });
        }
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
        ha[hi] = herosPool.value.find(v => v.shareId == heroIds[hi]) ?? NULL_HERO();
    });
    cardsDeck.value = [];
    for (const cid of cardIds) {
        const card = cardsDeck.value.find(c => c.shareId == cid);
        if (card) ++card.UI.cnt;
        else {
            const ncard = clone(cardsPool.value.find(c => c.shareId == cid))?.setCnt(1);
            if (ncard) cardsDeck.value.push(ncard);
        }
    }
    updateShareCode();
    pShareCode.value = '';
}

const reset = () => {
    if (currIdx.value == TAG_INDEX.Hero) resetHeroFilter();
    else resetCardFilter();
    sinceVersionFilter.value = sinceVersionSelect.value[0];
    isOnlyShowConfiged.value = false;
    updateInfo();
}

const cancel = () => {
    isShowFilter.value = false;
    isShowShareCode.value = false;
    isShowDeckShareImg.value = false;
    modalInfo.value = NULL_MODAL();
    selectSize.value = 0;
}

// 改变版本
const changeVersion = (currIdx: TagIndex, id: number) => {
    if (id == -1) {
        customVersion.value.baseVersion = version.value;
        customVersion.value.diff = {};
        allHeros.value.forEach(h => herosVersion.value[h.id] = version.value);
        allCards.value.forEach(c => cardsVersion.value[c.id] = version.value);
    } else if (currIdx == 0) {
        if (customVersion.value.baseVersion == herosVersion.value[id]) delete customVersion.value.diff[id];
        else customVersion.value.diff[id] = herosVersion.value[id];
        const hidx = allHeros.value.findIndex(h => h.id == id);
        allHeros.value.splice(hidx, 1, newHero(herosVersion.value[id])(id));
    } else {
        if (customVersion.value.baseVersion == cardsVersion.value[id]) delete customVersion.value.diff[id];
        else customVersion.value.diff[id] = cardsVersion.value[id];
        const cidx = allCards.value.findIndex(c => c.id == id);
        allCards.value.splice(cidx, 1, newCard(cardsVersion.value[id])(id));
    }
}

// 保存版本配置
const saveConfig = () => {
    customVersion.value.name = deckName.value.trim() || `版本配置${customVersionList.length + 1}`;
    if (isDiffEmpty.value) return alert('配置不能为空');
    if (customVersionList.filter(v => v.name == deckName.value).length > 1) {
        if (!confirm('已存在同名配置，是否覆盖？')) return;
        if (customVersionIdx > -1) customVersionList.splice(customVersionIdx, 1);
        const oldIdx = customVersionList.findIndex(v => v.name == deckName.value);
        customVersionList[oldIdx] = customVersion.value;
    } else if (customVersionIdx == -1) {
        customVersionList.push(customVersion.value);
    } else {
        customVersionList[customVersionIdx] = customVersion.value;
    }
    localStorage.setItem('7szh_custom_version_list', JSON.stringify(customVersionList));
    router.push({ name: 'index', state: { saveConfig: true } })
}

// 导出版本配置
const exportConfig = () => {
    customVersion.value.name = deckName.value.trim() || `版本配置${customVersionList.length + 1}`;
    if (isDiffEmpty.value) return alert('配置不能为空');
    exportFile(`${customVersion.value.name}.json`, JSON.stringify(customVersion.value));
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
    font-family: HYWH;
}

.edit-deck-list {
    width: 100%;
    height: 80%;
    background-color: #db8803;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    overflow-y: auto;
    white-space: nowrap;
    border-top: 10px solid #572e00;
    border-bottom: 10px solid #572e00;
    padding: 5px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
}

.deck {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: min(500px, 100%);
    background-color: #ddba54;
    margin: 5px;
    padding: 5px;
    border-radius: 10px;
    cursor: pointer;
    box-sizing: border-box;
}

.deck:hover,
.deck:active {
    background-color: #daaf2f;
}

.deck-info {
    padding: 0 2%;
    flex: 7;
}

.deck-heros {
    display: flex;
    margin: 2px 0;
    gap: 2%;
}

.deck-hero {
    width: 15%;
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.edit-btn-group {
    display: flex;
    gap: 5%;
    flex: 3;
    justify-content: flex-end;
    align-items: center;
    width: fit-content;
}

.edit-list-icon {
    border: 2px solid black;
    border-radius: 5px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 5px;
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

.edit-deck-btn-group button {
    background-color: #925f00;
    border: 3px solid #583a01;
    padding: 10px 2px;
    margin: 5px;
    border-radius: 10px;
    cursor: pointer;
    font-family: HYWH;
}

.edit-deck-btn-group button:hover,
.edit-deck-btn-group button:active {
    background-color: #d2a858;
}

.edit-deck-btn-group button.active {
    background-color: #ffcf77;
}

button.edit-btn {
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

.edit-btn.share-deck {
    position: absolute;
    top: 0;
    left: 100px;
}

.deck-share-img {
    position: absolute;
    height: 100%;
    left: 50%;
    transform: translate(-50%);
    aspect-ratio: 120/163;
    background-color: #dfc98f;
    z-index: 10;
}

.deck-share-hero-img {
    position: absolute;
    width: 11.7%;
    top: 10.8%;
    z-index: -1;
}

.deck-share-card-img {
    position: absolute;
    width: 8%;
    z-index: -1;
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

.edit-btn.reset-config {
    padding: 0.2rem;
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
    margin-left: 20%;
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

select#version {
    margin: 5px;
    padding: 5px 0;
    border-radius: 5px;
    border: 3px solid #583a01;
    background-color: #ffcf77;
    font-family: HYWH;
}

input#isOfflineInput:checked {
    accent-color: #906725;
}

.heros-deck {
    position: absolute;
    left: 50%;
    top: 20%;
    transform: translate(-45%, -20%);
    background-color: #d59b3f;
    width: 80%;
    height: 20%;
    display: flex;
    justify-content: space-around;
    align-items: center;
    border-radius: 15px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.cards-deck {
    position: absolute;
    display: grid;
    grid-template-columns: repeat(auto-fill, 80px);
    justify-content: center;
    left: 50%;
    top: 20%;
    transform: translate(-45%, -20%);
    background-color: #d59b3f;
    width: 80%;
    height: 20%;
    overflow-y: scroll;
    border-radius: 15px;
    padding: 0 5px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.hero-deck {
    position: relative;
    /* background-color: #ffd0a2; */
    width: 110px;
    height: 95%;
    /* border-radius: 15px; */
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5%;
    align-items: center;
    cursor: pointer;
    overflow: hidden;
}

.heros-total,
.cards-total {
    position: absolute;
    display: grid;
    grid-template-columns: repeat(auto-fill, 130px);
    justify-content: center;
    left: 50%;
    bottom: 20%;
    transform: translate(-45%, 20%);
    background-color: #d59b3f;
    width: 80%;
    height: 50%;
    overflow-y: scroll;
    border-radius: 15px;
    padding: 5px;
    border: 5px solid #906725;
    box-sizing: border-box;
}

.hero-total,
.card-total,
.card-deck {
    position: relative;
    /* background-color: #ffd0a2; */
    width: 115px;
    height: 197px;
    border-radius: 10px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    margin: 5px 7px;
    cursor: pointer;
}

.card-deck {
    height: 90%;
    aspect-ratio: 7/12;
    width: auto;
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
    border-radius: 8px;
}

.hero-deck>.hero-img {
    position: relative;
    width: 80%;
}

.hero-hp {
    position: absolute;
    left: 0;
    top: 0;
    width: 30%;
    aspect-ratio: 1/1;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1;
    font-size: min(23px, max(16px, 2vw));
}

.hero-hp-bg {
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 1;
}

.hero-hp-cnt {
    position: absolute;
    color: white;
    z-index: 1;
}

.curr-deck {
    position: relative;
    box-shadow: 4px 4px 6px #ffeb56,
        -4px 4px 6px #ffeb56,
        4px -4px 6px #ffeb56,
        -4px -4px 6px #ffeb56;
}

.dice-img {
    position: absolute;
    left: -10px;
    top: -5px;
    width: 30px;
}

.card-cnt {
    background-color: #583a01;
    color: white;
    border: 2px solid black;
    border-radius: 10px;
    position: absolute;
    top: -3px;
    right: -3px;
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

.hero-deck>.icon-group {
    position: relative;
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
    z-index: 3;
}

.forbidden {
    position: absolute;
    left: 0;
    width: 100%;
    background: #ffb6b6f1;
    padding: 3px 0;
    color: red;
    font-weight: bold;
    text-align: center;
    box-sizing: border-box;
    z-index: 1;
}

.selected {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    padding-top: 50%;
    background: #0000009e;
    border-radius: 10px;
    color: white;
    text-align: center;
    box-sizing: border-box;
    z-index: 2;
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

.filter-select {
    margin: 5px;
    padding: 5px 0;
    border-radius: 5px;
    border: 3px solid #343b7d;
    background-color: #3a457d;
    color: white;
    font-family: HYWH;
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
    width: fit-content;
    margin: 4px 2px;
    padding: 3px 10px;
    border-radius: 5px;
    cursor: pointer;
    box-sizing: border-box;
    color: white;
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

select[id^=config] {
    position: absolute;
    bottom: 5%;
    border-radius: 5px;
    border: 3px solid #583a01;
    background-color: #ffcf77;
    font-family: HYWH;
}

.mobile-hero-deck,
.mobile-card-deck {
    width: 65px;
    height: 111px;
    border-radius: 8px;
    font-size: 8px;
}

.mobile-cards-deck,
.mobile-heros-deck {
    height: 35%;
    grid-template-columns: repeat(auto-fill, 75px);
}

.mobile-cards-total,
.mobile-heros-total {
    height: 38%;
    grid-template-columns: repeat(auto-fill, 75px);
}

.mobile-hero-hp-cnt {
    font-size: 12px;
}

.config-total {
    height: 80%;
    bottom: 25%;
}

.debug-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #dedede;
    z-index: 50;
    pointer-events: none;
}

::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    background: #cb7b19d1;
    border-radius: 10px;
}

::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: #dec19dd1;
}

@media screen and (orientation: portrait) {
    .edit-deck-container {
        height: 95vw;
        width: 95vh;
        transform-origin: 0 0;
        transform: rotateZ(90deg) translateY(-100%);
    }
}
</style>
