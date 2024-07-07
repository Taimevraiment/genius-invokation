<template>
    <div>
        <img class="card-img" :src="card.UI.src" v-if="card?.UI.src?.length > 0" :alt="card.name" />
        <img class="lengend-border" v-if="card.hasSubtype(CARD_SUBTYPE.Legend)" :src="getPngIcon('lengend-border')" />
        <div class="card-content">
            <span v-if="card?.UI.src?.length == 0">{{ card.name }}</span>
            <div class="card-cost" :style="{ color: card.costChange > 0 ? CHANGE_GOOD_COLOR : 'white' }">
                <img class="cost-img hcard" :src="getDiceBgIcon(ELEMENT_ICON[card.costType])" />
                <span>{{ card.cost - card.costChange }}</span>
            </div>
            <!-- todo 重新考虑下面的减骰 -->
            <div class="card-energy" v-if="card.anydice > 0"
                :style="{ color: card.costChange > 0 ? CHANGE_GOOD_COLOR : 'white' }">
                <img class="cost-img hcard" :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Any])" />
                <span>{{ Math.max(0, card.anydice - Math.max(0, card.costChange - card.cost)) }}</span>
            </div>
            <div class="card-energy" v-if="card.energy > 0">
                <img class="cost-img hcard" :src="getDiceBgIcon(ELEMENT_ICON[COST_TYPE.Energy])" />
                <span>{{ card.energy }}</span>
            </div>
            <div class="card-energy" v-if="card.hasSubtype(CARD_SUBTYPE.Legend)">
                <img class="cost-img hcard" :src="getDiceBgIcon(ELEMENT_ICON[CARD_SUBTYPE.Legend])" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

import { ELEMENT_ICON, CHANGE_GOOD_COLOR } from '@@@/constant/UIconst';
import { CARD_SUBTYPE, COST_TYPE } from '@@@/constant/enum';
import { Card } from '../../../typing';

const props = defineProps(['card']);

const card = computed<Card>(() => props.card);

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

<style>
.card-img {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border-radius: 10px;
}


.lengend-border {
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
    left: -20px;
    top: -10px;
    width: 20px;
    height: 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    text-align: center;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-energy {
    position: absolute;
    width: 20px;
    height: 20px;
    left: -20px;
    top: 25px;
    color: white;
    font-weight: bold;
    text-align: center;
    line-height: 20px;
    -webkit-text-stroke: 1px black;
}

.card-cost>span,
.card-energy>span {
    position: absolute;
    left: 20px;
    top: 5px;
}


.cost-img {
    position: absolute;
    width: 25px;
    height: 25px;
}

.cost-img.hcard {
    width: 30px;
    height: 30px;
}
</style>