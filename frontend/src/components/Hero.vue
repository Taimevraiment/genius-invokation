<template>
    <div class="hero" :style="{
        backgroundColor: hero.UI.src == '' ? ELEMENT_COLOR[hero.element ?? ELEMENT_TYPE.Physical] : '',
    }">
        <NightSoul class="night-soul" v-if="hero.heroStatus.some(s => s.hasType(STATUS_TYPE.NightSoul))"
            :color="NIGHT_SOUL_BG_COLOR[hero.element]" />
        <div class="card-border" v-if="!isHideBorder"></div>
        <div class="hero-img-content">
            <img :class="['hero-img', { blink: isBlink }]" :src="isBlink || hero.UI.src" v-if="hero?.UI.src?.length > 0"
                :alt="hero.name" />
            <div v-else class="hero-name">{{ hero?.name }}</div>
        </div>
        <div class="hero-freeze" v-if="hasObjById(hero.heroStatus, 106)">
            <img :src="getPngIcon('freeze-bg')" />
        </div>
        <div class="hero-freeze" v-if="hasObjById(hero.heroStatus, 116033)">
            <img :src="getPngIcon('rocken-bg')" />
        </div>
        <div class="hero-shield"
            v-if="[...hero.heroStatus, ...combatStatus].some(sts => sts.hasType(STATUS_TYPE.Shield) && sts.useCnt > 0)">
        </div>
        <div class="hero-barrier" v-if="(
            hero.heroStatus.some(ist => ist.hasType(STATUS_TYPE.Barrier) && ist.variables[STATUS_TYPE.Barrier] == 1) ||
            hero.isFront && combatStatus.some(ost => ost.hasType(STATUS_TYPE.Barrier) && ost.variables[STATUS_TYPE.Barrier] == 1) ||
            hero.talentSlot?.tag.includes(CARD_TAG.Barrier) && hero.talentSlot.perCnt != 0 ||
            hero.weaponSlot?.tag.includes(CARD_TAG.Barrier) && hero.weaponSlot.perCnt != 0) ||
            hero.vehicleSlot?.[0].tag.includes(CARD_TAG.Barrier) && hero.vehicleSlot[0].perCnt != 0">
            <img :src="getPngIcon('barrier-bg')" alt="" style="width: 100%;height: 100%;">
        </div>
        <div class="hero-hp" :class="{ 'mobile-hero-hp': isMobile }" :style="{ top: hpPosY }"
            v-if="hero.hp >= 0 && !isHideHp">
            <img class="hero-hp-bg" src="@@/image/hero-hp-bg.png" :style="{
                filter: `${hasObjById(hero.heroStatus, 122) ? 'saturate(2.2) hue-rotate(-25deg) contrast(0.8)' :
                    hero.hp == hero.maxHp ? 'brightness(1.2)' : ''}`
            }" />
            <StrokedText class="hero-hp-cnt" :class="{ 'is-change': hpCurcnt?.isChange }">
                {{ Math.max(0, hpCurcnt?.val ?? hero.hp) }}
            </StrokedText>
        </div>
        <div class="hero-right-bar" v-if="hero && hero.hp > 0 && !isHideEnergy">
            <div v-for="(_, eidx) in Math.abs(hero.maxEnergy) / (hero.maxEnergy >= 0 ? 1 : 2)" :key="eidx"
                class="hero-energy" :class="{ 'mobile-energy': isMobile }">
                <img class="hero-energy-img" :src="getEnergyIcon(
                    hero.maxEnergy < 0 && Math.abs(hero.energy) + Math.max(0, energyCnt) + (hero.maxEnergy / 2) - 1 >= eidx,
                    hero.maxEnergy < 0
                )">
                <img class="hero-energy-img" :class="{
                    blink: (Math.abs(hero.energy) - 1 < eidx && Math.abs(hero.energy) + (energyCnt) - 1 >= eidx) ||
                        (Math.abs(hero.energy) + (hero.maxEnergy / 2) - 1 < eidx && Math.abs(hero.energy) + (energyCnt) + (hero.maxEnergy / 2) - 1 >= eidx)
                }" :src="getEnergyIcon(
                    Math.abs(hero.energy) + Math.max(0, energyCnt) - 1 >= eidx,
                    hero.maxEnergy < 0,
                    Math.abs(hero.energy) + Math.max(0, energyCnt) + (hero.maxEnergy / 2) - 1 >= eidx
                )" />
            </div>
            <slot name="hero-right-bar"></slot>
        </div>
        <slot></slot>
    </div>
</template>
<script lang="ts" setup>
import { CARD_TAG, ELEMENT_TYPE, STATUS_TYPE } from '@@@/constant/enum';
import { ELEMENT_COLOR, NIGHT_SOUL_BG_COLOR } from '@@@/constant/UIconst';
import { hasObjById } from '@@@/utils/gameUtil';
import { computed } from 'vue';
import { Hero, Status } from '../../../typing';
import NightSoul from './NightSoul.vue';
import StrokedText from './StrokedText.vue';

const props = defineProps<{
    hero: Hero,
    isMobile?: boolean,
    isBlink?: string,
    hpChange?: {
        isChange: boolean,
        val: number
    },
    energyCnt?: number,
    combatStatus?: Status[],
    hpPosY?: string,
    isHideHp?: boolean,
    isHideEnergy?: boolean,
    isHideBorder?: boolean,
}>();

const hero = computed(() => props.hero);
const isMobile = computed(() => props.isMobile ?? false);
const isBlink = computed(() => props.isBlink);
const hpCurcnt = computed(() => props.hpChange);
const energyCnt = computed(() => props.energyCnt ?? 0);
const combatStatus = computed(() => props.combatStatus ?? []);
const hpPosY = computed(() => props.hpPosY ?? '-5%');
const isHideHp = computed(() => props.isHideHp ?? false);
const isHideEnergy = computed(() => props.isHideEnergy ?? false);
const isHideBorder = computed(() => props.isHideBorder ?? false);

// 获取png图片
const getPngIcon = (name: string) => {
    if (name.startsWith('http') || name == '') return name;
    return `/image/${name}.png`;
};
// 获取充能图标
const getEnergyIcon = (isCharged: boolean = false, isSp: boolean = false, isFull: boolean = false) => {
    return `/image/${isSp ? 'sp-' : ''}energy-${isCharged ? 'charged' : 'empty'}${isSp && isFull ? '-full' : ''}.png`;
};
</script>
<style scoped>
@property --front-val {
    syntax: '<percentage>';
    inherits: false;
    initial-value: 0%;
}

.hero {
    --scale-val-will: 1;
    position: relative;
    width: 100%;
    aspect-ratio: 7/12;
    border-radius: 10px;
    margin: 0 5%;
    cursor: pointer;
    transition: --front-val 0.3s, box-shadow 0.5s;
    background: white;
    transform: translateY(var(--front-val)) scale(var(--scale-val-will));
}

.night-soul {
    position: absolute;
    width: 105%;
    height: 130%;
    bottom: -2%;
    left: 50%;
    transform: translateX(-50%);
}

.hero-hp-bg,
.card-border {
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 1;
}

.card-border {
    border: min(15px, 1.5vw) solid transparent;
    border-image: url(@@/image/Gold.png) 75 stretch;
    box-sizing: border-box;
}

.hero-hp {
    position: absolute;
    left: -20%;
    width: 45%;
    aspect-ratio: 1/1;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: min(23px, max(16px, 2vw));
}

.hero-hp-cnt {
    color: white;
    z-index: 1;
    padding-top: 10%;
    transform: scale(var(--scale-val-change));
    transition: transform 0.3s;
}

.hero-name {
    position: absolute;
    top: 30px;
    left: 8px;
}

.hero-right-bar {
    position: absolute;
    right: -3%;
    top: 15px;
    width: 30%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    z-index: 1;
}

.hero-energy {
    position: relative;
    width: 15px;
    height: 15px;
    margin-bottom: 1px;
}

.hero-energy-img {
    width: 140%;
    height: 100%;
    position: absolute;
}

.hero-energy-img.blink {
    --blink-opacity: 0.2;
}

.hero-img-content {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    box-sizing: border-box;
}

.hero-img {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    width: 100%;
    height: 100%;
    line-height: 500%;
}

.hero-freeze {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 105%;
    height: 105%;
    transform: translate(-50%, -50%);
    border-radius: inherit;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1;
}

.hero-freeze>img {
    width: 100%;
    height: 100%;
    border-radius: inherit;
}

.hero-barrier {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 120%;
    height: 108%;
    transform: translate(-50%, -50%);
    /* border-radius: inherit;
  border-left: 5px solid #bff6ffbb;
  border-right: 5px solid #bff6ffbb; */
}

.hero-shield {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 101%;
    height: 102%;
    transform: translate(-50%, -50%);
    border-radius: 5px;
    border: 2px solid #fffdd2e9;
    box-shadow: 0 0 10px 5px #fffdd2e9 inset;
    box-sizing: border-box;
    z-index: 1;
}

.blink {
    --blink-opacity: 0.5;
    animation: blink 1s linear infinite alternate;
}

.hero-img.blink {
    --blink-opacity: 0.9;
}

.is-change {
    --scale-val-change: 1.5;
}

.mobile-hero-hp {
    width: 55%;
}

.mobile-energy {
    width: 12px;
    height: 12px;
    margin: 0;
}

@keyframes blink {
    0% {
        opacity: var(--blink-opacity);
    }

    50% {
        opacity: 1;
    }

    100% {
        opacity: var(--blink-opacity);
    }
}
</style>