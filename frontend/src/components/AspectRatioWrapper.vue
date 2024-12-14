<template>
    <div class="aspect-ratio-wrapper">
        <div class="aspect-ratio-wrapper-inner" :style="{ paddingTop: `${(1 / props.ratio) * 100}%` }">
            <div class="aspect-ratio-wrapper-content">
                <slot></slot>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    ratio: number,
}>();
</script>

<style scoped>
.aspect-ratio-wrapper-inner {
    width: 100%;
    height: 0;
    position: relative;
}

.aspect-ratio-wrapper-content {
    position: absolute;
    inset: 0;
}
</style>