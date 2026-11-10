<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const route = useRoute();

await navigateTo(
  {
    path: `/manage/users/${encodeURIComponent(String(route.params.id))}`,
    query: route.query,
  },
  { replace: true },
);
</script>
