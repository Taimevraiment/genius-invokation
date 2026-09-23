<template>
    <div class="stroked-text-container">
        <div class="stroked-text" :style="strokeTextStyle">
            <slot></slot>
        </div>
        <div class="raw-text" :style="textStyle">
            <slot></slot>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
    width?: number | string,
    color?: string,
    strokeColor?: string,
}>();
const width = computed(() => isNaN(Number(props.width)) ? 2 : Number(props.width));
const textStyle = computed(() => {
    const color = props.color || 'inherit';
    if (!color.includes(',')) return { color: color }
    return {
        backgroundImage: `linear-gradient(${color})`,
        backgroundClip: 'text',
        color: 'transparent',
    }
});
const strokeTextStyle = computed(() => ({ '-webkit-text-stroke': `${width.value}px ${props.strokeColor || 'black'}` }));
</script>

<style scoped>
.stroked-text-container {
    display: inline-grid;
    grid-template-areas: 'a';
    justify-items: center;
    align-items: center;
}

.stroked-text {
    grid-area: a;
}

.raw-text {
    grid-area: a;
}
</style>