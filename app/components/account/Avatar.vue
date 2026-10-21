<script setup lang="ts">
import type { Profile } from "#shared/types";

interface AvatarCropperInstance {
  crop: () => Promise<Blob | null>;
  reset: () => void;
  rotate: (angle: number) => void;
  zoom: (factor: number) => void;
}

const emit = defineEmits<{ updated: [avatarUrl: string | null] }>();
const props = defineProps<{
  profile: Profile;
  avatarUrl: string | null;
}>();
const message = useMessage();
const { data: session } = await usePortalSession();
const { submit, pending } = useMutation();

const fileInput = ref<HTMLInputElement | null>(null);
const cropper = ref<AvatarCropperInstance | null>(null);
const selectedFile = ref<File | null>(null);
const editing = ref(false);
const cropReady = ref(false);

const maxOriginalBytes = 10 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

const avatarName = computed(
  () =>
    [props.profile.lastName, props.profile.firstName].join("") ||
    props.profile.username,
);
const pictureReadOnly = computed(
  () =>
    props.profile.userProfileMetadata?.attributes.find(
      (field) => field.name === "picture",
    )?.readOnly === true,
);

function applyAvatar(avatarUrl: string | null) {
  emit("updated", avatarUrl);
  if (session.value) {
    session.value.user.avatarUrl = avatarUrl;
  }
}

function pickFile() {
  if (pictureReadOnly.value) {
    return;
  }

  fileInput.value?.click();
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  if (!acceptedTypes.includes(file.type)) {
    message.error("仅支持 JPG、PNG 或 WebP 图片");

    return;
  }
  if (file.size > maxOriginalBytes) {
    message.error("原图不能超过 10 MiB");

    return;
  }

  selectedFile.value = file;
  cropReady.value = false;
  editing.value = true;
}

function clearCropper() {
  selectedFile.value = null;
  cropReady.value = false;
}

const save = () =>
  submit(async () => {
    const blob = await cropper.value?.crop();
    if (!blob) {
      throw new Error("裁剪失败，请重试");
    }
    if (blob.size > 2 * 1024 * 1024) {
      throw new Error("裁剪后的头像不能超过 2 MiB");
    }

    const body = new FormData();
    body.append("file", blob, "avatar.jpg");
    const result = await $fetch<{
      profile: Profile;
      avatarUrl: string | null;
    }>("/api/account/avatar", { method: "POST", body });

    applyAvatar(result.avatarUrl);
    editing.value = false;
    message.success("头像已更新");
  });

const remove = () =>
  submit(async () => {
    const result = await $fetch<{
      profile: Profile;
      avatarUrl: string | null;
    }>("/api/account/avatar", { method: "DELETE" });

    applyAvatar(result.avatarUrl);
    message.success("头像已移除");
  });

function onCropError() {
  cropReady.value = false;
  message.error("图片加载失败，请更换图片");
}
</script>

<template>
  <NCard title="头像">
    <NFlex align="center" :size="16" wrap>
      <UserAvatar :name="avatarName" :size="80" :src="avatarUrl" />
      <NFlex :size="8" vertical>
        <NFlex :size="8" wrap>
          <NButton :disabled="pictureReadOnly || pending" @click="pickFile">
            {{ avatarUrl ? "更换头像" : "上传头像" }}
          </NButton>
          <ConfirmAction
            v-if="avatarUrl"
            :disabled="pictureReadOnly || pending"
            message="确认移除头像？"
            @confirm="remove"
          >
            移除
          </ConfirmAction>
        </NFlex>
        <NText class="hint" depth="3">
          支持 JPG、PNG、WebP，裁剪为正方形；头像将公开显示。
        </NText>
        <NText v-if="pictureReadOnly" class="hint" depth="3">
          头像已由管理员锁定。
        </NText>
      </NFlex>
    </NFlex>

    <input
      ref="fileInput"
      accept="image/jpeg,image/png,image/webp"
      class="file-input"
      type="file"
      @change="onFileChange"
    />

    <NModal
      v-model:show="editing"
      class="avatar-modal"
      preset="card"
      title="编辑头像"
      @after-leave="clearCropper"
    >
      <div class="cropper-shell">
        <AccountAvatarCropper
          v-if="selectedFile"
          ref="cropper"
          :file="selectedFile"
          @error="onCropError"
          @ready="cropReady = true"
        />
      </div>
      <template #footer>
        <NFlex align="center" justify="space-between" :size="12" wrap>
          <NFlex :size="8" wrap>
            <NButton size="small" @click="cropper?.zoom(0.85)">缩小</NButton>
            <NButton size="small" @click="cropper?.zoom(1.15)">放大</NButton>
            <NButton size="small" @click="cropper?.rotate(90)">旋转</NButton>
            <NButton size="small" @click="cropper?.reset()">重置</NButton>
          </NFlex>
          <NFlex :size="8">
            <NButton @click="editing = false">取消</NButton>
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
.cropper-shell {
  height: 320px;
}

.cropper-shell :deep(.vue-advanced-cropper) {
  height: 100%;
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
