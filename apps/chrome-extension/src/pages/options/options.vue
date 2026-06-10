<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { cva } from 'class-variance-authority'
import { SettingsIcon } from 'lucide-vue-next'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SIDEBAR_WIDTH } from '@/components/ui/sidebar/utils'
import { cn } from '@/lib/utils'
import { useInitTheme } from '../shared/theme'

const route = useRoute()

const menuItemLinkVariants = cva(
  'flex justify-start items-center gap-2 w-full py-2 px-4 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ring-sidebar-ring focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground [&.router-link-exact-active]:bg-sidebar-accent [&.router-link-exact-active]:font-medium [&.router-link-exact-active]:text-sidebar-accent-foreground',
)

useInitTheme()
</script>

<template>
  <div class="w-full xl:w-300 h-full flex justify-start items-start">
    <div
      :style="{
        width: SIDEBAR_WIDTH,
      }"
      class="h-svh p-2 hidden md:block"
    >
      <div
        class="w-full h-full p-2 flex flex-col justify-start items-start gap-2 border border-sidebar-border rounded-lg bg-sidebar shadow-sm"
      >
        <div class="w-full flex justify-start items-center gap-2 p-4">
          <img class="w-8" src="/logo.svg" />
          <h3 class="text-xl font-medium">Settings</h3>
        </div>
        <ul class="w-full flex flex-col justify-start items-start gap-2">
          <li class="w-full">
            <RouterLink :class="cn(menuItemLinkVariants())" to="/general">
              <SettingsIcon />
              General
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
    <main class="p-5 flex-1">
      <div class="mb-2 flex justify-start items-center gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink as-child>
                <RouterLink to="/"> Home </RouterLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <span class="cursor-pointer hover:text-accent-foreground">
                    {{ typeof route.name === 'string' ? 'General' : '' }}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <RouterLink to="/general">
                    <DropdownMenuCheckboxItem
                      :model-value="route.name === 'general'"
                      >General
                    </DropdownMenuCheckboxItem>
                  </RouterLink>
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <RouterView />
    </main>
  </div>
</template>
