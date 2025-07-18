<template>
    <div class="card" :class="{ 'mobile-card': isMobile }">
        <div class="card-border" v-if="!isHideBorder"></div>
        <img class="card-img" :src="getPngIcon('card-bg')" alt="" style="transform: rotateY(180deg);" />
        <img class="card-img" v-if="card.UI.src" :src="getPngIcon(card.UI.src)" :alt="card.name" />
        <template v-if="(card?.id ?? 0) != 0">
            <img class="legend-border" v-if="card.subType.includes(CARD_SUBTYPE.Legend)"
                :src="getPngIcon('legend-border')" draggable="false" />
            <div class="card-cost" v-if="!isHideCost" :class="{ 'mobile-card-cost': isMobile }"
                :style="{ color: card.costChanges[0] > 0 ? CHANGE_GOOD_COLOR : 'white' }">
                <img class="cost-img hcard" :class="{ 'mobile-hcard': isMobile }"
                    :src="getDiceBgIcon(ELEMENT_ICON[card.costType])" draggable="false" />
                <StrokedText class="cost-text">{{ Math.max(0, card.cost - card.costChanges[0]) }}</StrokedText>
            </div>
            <div class="card-energy" :class="{ 'card-energy': !isMobile, 'mobile-card-energy': isMobile }"
                v-if="card.anydice > 0 && !isHideCost"
                :style="{ color: card.costChange - card.cost > 0 || card.costChanges[1] > 0 ? CHANGE_GOOD_COLOR : 'white' }">
                <img class="cost-img hcard" :class="{ 'mobile-hcard': isMobile }"
                    :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Any])" draggable="false" />
                <StrokedText class="cost-text">
                    {{ Math.max(0, card.anydice - card.costChanges[1] - Math.max(0, card.costChanges[0] - card.cost)) }}
                </StrokedText>
            </div>
            <div class="card-energy" :class="{ 'mobile-card-energy': isMobile }" v-if="card.energy > 0 && !isHideCost">
                <img class="cost-img hcard" :class="{ 'mobile-hcard': isMobile }"
                    :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Energy])" draggable="false" />
                <StrokedText class="cost-text">{{ card.energy }}</StrokedText>
            </div>
            <div class="card-energy" :class="{ 'mobile-card-energy': isMobile }"
                v-if="card.subType.includes(CARD_SUBTYPE.Legend) && !isHideCost">
                <img class="cost-img hcard" :class="{ 'mobile-hcard': isMobile }"
                    :src="getDiceBgIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])" />
            </div>
            <div class="card-content">
                <span v-if="card?.UI.src?.length == 0">{{ card.name }}</span>
            </div>
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
    isHideCost?: boolean,
    isHideBorder?: boolean,
}>();

const card = computed<Card>(() => props.card);
const isMobile = computed<boolean>(() => props.isMobile);
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
.card {
    position: absolute;
    width: 90px;
    height: 154px;
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
    position: relative;
    width: 100%;
    height: 100%;
    padding-top: 20px;
}

.card-cost {
    position: absolute;
    left: -30px;
    top: -10px;
    width: 30px;
    height: 30px;
    color: white;
    text-align: center;
    line-height: 30px;
    z-index: 1;
    pointer-events: none;
}

.card-energy {
    position: absolute;
    width: 20px;
    height: 20px;
    left: -25px;
    top: 30px;
    color: white;
    text-align: center;
    line-height: 20px;
    z-index: 1;
    pointer-events: none;
}

.cost-text {
    position: absolute;
    font-size: 20px;
    width: 40px;
    height: 42px;
}

.cost-img {
    position: absolute;
    width: 25px;
    height: 25px;
}

.hcard {
    width: 40px;
    height: 40px;
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

.mobile-card {
    width: 60px;
    height: 105px;
}

.mobile-card-cost,
.mobile-card-energy {
    left: -20px;
    width: 20px;
    height: 20px;
    line-height: 20px;
}

.mobile-card-energy {
    top: 20px;
}

.mobile-card-cost>.cost-text,
.mobile-card-energy>.cost-text {
    position: absolute;
    font-size: 16px;
    left: 5px;
    top: -5px;
}

.mobile-hcard {
    width: 30px;
    height: 30px;
}
</style>