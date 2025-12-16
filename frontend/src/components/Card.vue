<template>
    <div class="card" :class="{ 'mobile-card': isMobile }" :style="{ '--card-width': `${cardWidth}px` }">
        <div class="card-border" v-if="!isHideBorder"></div>
        <img class="card-img" :src="getPngIcon('card-bg')" alt="" style="transform: rotateY(180deg);" />
        <img class="card-img" v-if="card.UI.src" :src="getPngIcon(card.UI.src)" :alt="card.name" />
        <template v-if="(card?.id ?? 0) != 0">
            <img class="legend-border" v-if="card.subType?.includes(CARD_SUBTYPE.Legend)"
                :src="getPngIcon('legend-border')" draggable="false" />
            <div class="side-icons">
                <div class="card-cost" v-if="!isHideCost"
                    :style="{ color: card.costChanges[0] > 0 ? CHANGE_GOOD_COLOR : 'white' }">
                    <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[card.costType])" draggable="false" />
                    <StrokedText class="cost-text">{{ Math.max(0, card.cost - card.costChanges[0]) }}</StrokedText>
                </div>
                <div class="card-cost" v-if="!isHideCost && card.anydice > 0"
                    :style="{ color: card.costChange - card.cost > 0 || card.costChanges[1] > 0 ? CHANGE_GOOD_COLOR : 'white' }">
                    <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Any])" draggable="false" />
                    <StrokedText class="cost-text">
                        {{ Math.max(0, card.anydice - card.costChanges[1] - Math.max(0, card.costChanges[0] -
                            card.cost)) }}
                    </StrokedText>
                </div>
                <div class="card-cost" v-if="!isHideCost && card.energy > 0">
                    <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Energy])" draggable="false" />
                    <StrokedText class="cost-text">{{ card.energy }}</StrokedText>
                </div>
                <div class="card-cost" v-if="!isHideCost && card.subType.includes(CARD_SUBTYPE.Legend)">
                    <img class="cost-img" :src="getDiceBgIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])" />
                </div>
            </div>
            <span class="card-content" v-if="card?.UI.src?.length == 0">
                {{ card.name }}
            </span>
        </template>
        <slot></slot>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

import { CHANGE_GOOD_COLOR, ELEMENT_ICON } from '@@@/constant/UIconst';
import { CARD_SUBTYPE, COST_TYPE } from '@@@/constant/enum';
import { Card } from '../../../typing';
import StrokedText from './StrokedText.vue';

const props = defineProps<{
    card: Card,
    isMobile: boolean,
    width?: number,
    isHideCost?: boolean,
    isHideBorder?: boolean,
}>();

const card = computed<Card>(() => props.card);
const isMobile = computed<boolean>(() => props.isMobile);
const cardWidth = computed(() => props.width ?? (isMobile.value ? 60 : 90));
const isHideCost = computed<boolean>(() => props.isHideCost || false);
const isHideBorder = computed<boolean>(() => props.isHideBorder || false);

// 获取骰子背景
const getDiceBgIcon = (name: string) => {
    return `/image/${name}-dice-bg.png`;
};

// 获取png图片
const getPngIcon = (name: string) => {
    if (name.startsWith('http')) return name;
    return `/image/${name}.png`;
};

</script>

<style scoped>
@property --card-width {
    syntax: '<length>';
    inherits: false;
    initial-value: 90px;
}

.card {
    position: absolute;
    width: var(--card-width);
    aspect-ratio: 7/12;
    /* height: 154px; */
    top: 0;
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
    transition: 0.3s;
    z-index: 1;
    /* background-color: #8caee1d0; */
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    backface-visibility: hidden;
    font-family: HYWH;
}

.card-img {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border-radius: 10px;
    color: white;
}


.legend-border {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    border-radius: inherit;
}

.card-content {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    padding-top: 20px;
    box-sizing: border-box;
}

.side-icons {
    position: absolute;
    display: flex;
    flex-direction: column;
    left: -15%;
    top: -5%;
    width: max(30px, 45%);
    height: 100%;
    gap: 1%;
    z-index: 1;
    pointer-events: none;
}

.card-cost {
    position: relative;
    aspect-ratio: 1/1;
    color: white;
    text-align: center;
    line-height: 30px;
}

.cost-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.cost-text {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    font-size: calc(var(--card-width)*0.25);
    line-height: calc(var(--card-width)*0.25);
}

.card-border {
    border: min(15px, 1.5vw) solid transparent;
    border-image: url(@@/image/Gold.png) 75 stretch;
    box-sizing: border-box;
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 1;
}

.mobile-card .cost-text {
    font-size: calc(var(--card-width)*0.2);
    line-height: calc(var(--card-width)*0.2);
}
</style>