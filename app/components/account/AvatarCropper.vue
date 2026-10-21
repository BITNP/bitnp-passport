<script setup lang="ts">
import { Cropper } from "vue-advanced-cropper";

import "vue-advanced-cropper/dist/style.css";

interface CropperInstance {
  getResult: () => { canvas?: HTMLCanvasElement };
  reset: () => void;
  rotate: (angle: number) => void;
  zoom: (factor: number) => void;
}

const emit = defineEmits<{ error: []; ready: [] }>();
const props = defineProps<{ file: File }>();
const cropper = ref<CropperInstance | null>(null);
const objectUrl = ref<string | null>(null);

function releaseObjectUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
}

watch(
  () => props.file,
  (file) => {
    releaseObjectUrl();
    objectUrl.value = URL.createObjectURL(file);
  },
  { immediate: true },
);

onBeforeUnmount(releaseObjectUrl);

const onReady = () => emit("ready");

const onError = () => emit("error");

const rotate = (angle: number) => cropper.value?.rotate(angle);

const zoom = (factor: number) => cropper.value?.zoom(factor);

const reset = () => cropper.value?.reset();

const crop = () =>
  new Promise<Blob | null>((resolve) => {
    const canvas = cropper.value?.getResult().canvas;
    if (!canvas) {
      resolve(null);

      return;
    }

    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
  });

defineExpose({ crop, reset, rotate, zoom });
</script>

<template>
  <Cropper
    ref="cropper"
    :canvas="{ width: 512, height: 512, fillColor: '#fff' }"
    check-orientation
    class="cropper"
    :debounce="0"
    image-restriction="fit-area"
    :resize-image="{ touch: true, wheel: { ratio: 0.1 }, adjustStencil: false }"
    :src="objectUrl"
    :stencil-props="{ aspectRatio: 1 }"
    transitions
    @error="onError"
    @ready="onReady"
  />
</template>

<style scoped>
.cropper {
  height: 320px;
  background: rgba(127, 127, 127, 0.12);
}
</style>
