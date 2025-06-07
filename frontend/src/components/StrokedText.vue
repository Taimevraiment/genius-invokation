<template>
    <div class="stroked-text-container">
        <div class="stroked-text" :style="strokeTextStyle">
            <slot></slot>
        </div>
        <div class="raw-text">
            <slot></slot>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
    width?: number | string,
    strokeColor?: string,
}>();
const width = computed(() => isNaN(Number(props.width)) ? 2 : Number(props.width));
const strokeColor = computed(() => props.strokeColor ?? 'black');
const strokeTextStyle = computed(() => ({ '-webkit-text-stroke': `${width.value}px ${strokeColor.value}` }));
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