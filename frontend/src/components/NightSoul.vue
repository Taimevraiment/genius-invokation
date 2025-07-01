<template>
    <div class="night-soul-container">
        <div class="bg" :style="{ backgroundColor: props.color }"></div>
        <div v-for="(bubble, bidx) in bubbles" :key="bidx" :style="{
            '--x': bubble.x + '%',
            '--y': bubble.y + '%',
            '--duration': bubble.duration + 's',
            '--size': bubble.size + '%',
            backgroundColor: props.color,
        }" :class="`bubble ${bubble.animation}`"></div>
        <svg style="display: none;">
            <defs>
                <filter id="blob">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"></feGaussianBlur>
                    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10">
                    </feColorMatrix>
                </filter>
            </defs>
        </svg>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
    count: {
        type: Number,
        default: 10,
    },
    color: {
        type: String,
        default: 'black',
    }
});
type Bubble = {
    x: number, // percent
    y: number, // percent
    duration: number, // seconds
    size: number, // px
    animation: string, // name
}
const bubbles = ref<Bubble[]>([]);
for (let i = 0; i < props.count; ++i) {
    bubbles.value.push({
        x: props.count / 2 * (i - 1),
        y: Math.random() * 5 + 12,
        duration: Math.random() * 3 + 2,
        size: Math.random() * 10 + 45,
        animation: 'base',
    });
}
for (let i = 0; i < props.count; ++i) {
    bubbles.value.push({
        x: Math.random() * 100,
        y: Math.random() * 5 + 15,
        duration: Math.random() * 5 + 2,
        size: Math.random() * 10 + 35,
        animation: 'up',
    });
}
</script>

<style scoped>
.night-soul-container {
    position: relative;
    overflow: hidden;
    border-bottom-left-radius: inherit;
    border-bottom-right-radius: inherit;
}

.bubble {
    position: absolute;
    width: var(--size);
    aspect-ratio: 1/1;
    border-radius: 50%;
    top: var(--y);
    left: var(--x);
    filter: url(#blob);
}

.base {
    aspect-ratio: 1/2;
    animation: base var(--duration) infinite;
}

.up {
    animation: up var(--duration) infinite;
}

.bg {
    position: absolute;
    width: 100%;
    height: 80%;
    bottom: 0;
    border-radius: 10px;
}

@keyframes base {
    0% {
        transform: translateY(0);
    }

    25% {
        transform: translateY(-5px);
    }

    50% {
        transform: translateY(0);
    }

    75% {
        transform: translateY(5px);
    }

    100% {
        transform: translateY(0);
    }
}

@keyframes up {
    0% {
        transform: translateY(0);
    }

    100% {
        transform: translateY(-100px) scale(-.5);
    }
}
</style>