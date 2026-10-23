<script setup lang="ts">
import { Cropper } from "vue-advanced-cropper";

import type { AccountProfile } from "#shared/user";

import "vue-advanced-cropper/dist/style.css";

const emit = defineEmits<{ saved: [profile: AccountProfile] }>();
const { profile, uploadEnabled } = defineProps<{
  profile: AccountProfile;
  uploadEnabled: boolean;
}>();
const message = useMessage();
const { submit, pending } = useMutation(() =>
  refreshNuxtData("portal-session"),
);
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const cropper = useTemplateRef<InstanceType<typeof Cropper>>("cropper");
const imageUrl = ref<string | null>(null);
const editing = ref(false);
const cropReady = ref(false);

function releaseImage() {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = null;
  }
}

onBeforeUnmount(releaseImage);

function selectImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";

  if (!file) {
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    message.error("仅支持 JPG、PNG 或 WebP 图片");

    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    message.error("原图不能超过 10 MiB");

    return;
  }

  releaseImage();
  imageUrl.value = URL.createObjectURL(file);
  cropReady.value = false;
  editing.value = true;
}

const save = () =>
  submit(async () => {
    const canvas = cropper.value!.getResult().canvas;

    if (!canvas) {
      throw new Error("图片尚未准备好");
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );

    if (!blob) {
      throw new Error("裁剪失败，请重试");
    }

    const updated = await $fetch("/api/account/avatar", {
      method: "POST",
      body: blob,
    });
    emit("saved", updated);
    editing.value = false;
    message.success("头像已更新");
  });

const remove = () =>
  submit(async () => {
    const updated = await $fetch("/api/account/avatar", { method: "DELETE" });
    emit("saved", updated);
    message.success("头像已移除");
  });

function cropError() {
  cropReady.value = false;
  message.error("图片加载失败，请更换图片");
}
</script>

<template>
  <NCard title="头像">
    <NFlex align="center" :size="16" wrap>
      <UserAvatar :size="64" :user="profile.user" />
      <NFlex :size="8" vertical>
        <NFlex :size="8" wrap>
          <NButton
            :disabled="!uploadEnabled || profile.readOnly.avatar || pending"
            size="small"
            @click="fileInput?.click()"
          >
            {{ profile.user.avatarUrl ? "更换头像" : "上传头像" }}
          </NButton>
          <ConfirmAction
            v-if="profile.user.avatarUrl"
            :disabled="profile.readOnly.avatar || pending"
            message="确认移除头像？"
            @confirm="remove"
          >
            移除
          </ConfirmAction>
        </NFlex>
        <NText v-if="profile.readOnly.avatar" class="hint" depth="3">
          当前账户不能修改头像
        </NText>
        <NText v-else-if="!uploadEnabled" class="hint" depth="3">
          头像上传暂未开放
        </NText>
        <NText v-else class="hint" depth="3">
          支持 JPG、PNG、WebP，头像将公开显示
        </NText>
      </NFlex>
    </NFlex>
    <input
      ref="fileInput"
      accept="image/jpeg,image/png,image/webp"
      class="file-input"
      type="file"
      @change="selectImage"
    />
    <NModal
      v-model:show="editing"
      class="avatar-modal"
      :closable="!pending"
      :close-on-esc="!pending"
      :mask-closable="!pending"
      preset="card"
      title="编辑头像"
      @after-leave="releaseImage"
    >
      <Cropper
        v-if="imageUrl"
        ref="cropper"
        :canvas="{ width: 512, height: 512, fillColor: '#fff' }"
        check-orientation
        class="avatar-cropper"
        :debounce="0"
        image-restriction="fit-area"
        :resize-image="{
          touch: true,
          wheel: { ratio: 0.1 },
          adjustStencil: false,
        }"
        :src="imageUrl"
        :stencil-props="{ aspectRatio: 1 }"
        @error="cropError"
        @ready="cropReady = true"
      />
      <template #footer>
        <NFlex align="center" justify="space-between" :size="12" wrap>
          <NFlex :size="8" wrap>
            <NButton
              :disabled="!cropReady || pending"
              size="small"
              @click="cropper?.zoom(0.85)"
            >
              缩小
            </NButton>
            <NButton
              :disabled="!cropReady || pending"
              size="small"
              @click="cropper?.zoom(1.15)"
            >
              放大
            </NButton>
            <NButton
              :disabled="!cropReady || pending"
              size="small"
              @click="cropper?.rotate(90)"
            >
              旋转
            </NButton>
            <NButton
              :disabled="!cropReady || pending"
              size="small"
              @click="cropper?.reset()"
            >
              重置
            </NButton>
          </NFlex>
          <NFlex :size="8">
            <NButton :disabled="pending" @click="editing = false">取消</NButton>
            <NButton
              :disabled="!cropReady"
              :loading="pending"
              type="primary"
              @click="save"
            >
              保存头像
            </NButton>
          </NFlex>
        </NFlex>
      </template>
    </NModal>
  </NCard>
</template>

<style scoped>
.avatar-cropper {
  height: min(320px, 50vh);
  background: rgba(127, 127, 127, 0.12);
}

:global(.avatar-modal) {
  width: min(92vw, 480px);
  max-width: calc(100vw - 32px);
}

.file-input {
  display: none;
}

.hint {
  font-size: 12px;
}
</style>
