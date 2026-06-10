<script setup lang="ts">
import { Eye, Info, Settings } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Flag } from '@/common/message'
import { useInitTheme } from '../shared/theme'

useInitTheme()

const handleMessage = async (flag: Flag) => {
  if (import.meta.env.DEV) {
    console.log(`chrome.runtime.sendMessage({ flag: '${flag}'})`)
  } else {
    await chrome.runtime.sendMessage({ flag })
  }

  window.close()
}

const handleOpenOptionsPage = () => {
  if (import.meta.env.DEV) {
    window.open('/pages/options', '_blank')
  } else {
    chrome.runtime.openOptionsPage()
  }
}
</script>

<template>
  <DropdownMenu :open="true">
    <DropdownMenuContent class="border-0 rounded-none">
      <DropdownMenuItem @select="() => handleMessage(Flag.ExecuteViewScript)">
        <Eye />
        View as Markdown
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        :as-child="true"
        class="underline-offset-4 hover:underline"
        href="https://github.com/whale4113/cloud-document-converter"
        target="_blank"
      >
        <a>
          <Info />
          Help and Feedback
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem
        class="underline-offset-4 hover:underline"
        @select="handleOpenOptionsPage"
      >
        <Settings />
        Settings
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
