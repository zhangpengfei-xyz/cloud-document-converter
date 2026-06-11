<script setup lang="ts">
import { Eye } from 'lucide-vue-next'
import { Flag } from '@/core/message'

const handleViewAsMarkdown = async () => {
  if (import.meta.env.DEV) {
    console.log(
      `chrome.runtime.sendMessage({ flag: '${Flag.ExecuteViewScript}'})`,
    )
  } else {
    await chrome.runtime.sendMessage({ flag: Flag.ExecuteViewScript })
  }

  window.close()
}
</script>

<template>
  <main class="w-48 bg-popover p-1 text-popover-foreground">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
      @click="handleViewAsMarkdown"
    >
      <Eye class="size-4 text-muted-foreground" />
      <span>View as Markdown</span>
    </button>
  </main>
</template>
