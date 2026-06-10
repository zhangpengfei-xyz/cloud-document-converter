<script setup lang="ts">
import { watch } from 'vue'
import { useForm, Field as VeeField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod/v4'
import { pick } from 'es-toolkit'
import { LoaderCircle } from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingKey, Table, Grid, Theme } from '@/common/settings'
import { useSettings } from '../shared/settings'

const schema = z.object({
  [SettingKey.Theme]: z.enum(Theme),
  [SettingKey.Table]: z.enum(Table),
  [SettingKey.Grid]: z.enum(Grid),
  [SettingKey.TextHighlight]: z.boolean(),
})

const { query, mutation } = useSettings()

const { meta, isSubmitting, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: query.data.value,
})

watch(query.data, newValues => {
  if (newValues) {
    resetForm({
      values: pick(newValues, [
        SettingKey.Theme,
        SettingKey.Table,
        SettingKey.Grid,
        SettingKey.TextHighlight,
      ]),
    })

    localStorage.setItem('cache.theme', newValues[SettingKey.Theme])
  }
})

const onSubmit = handleSubmit.withControlled(async values => {
  await mutation.mutateAsync(values)
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2"> General </CardTitle>
    </CardHeader>
    <CardContent class="space-y-6">
      <form id="form-vee-general" class="w-2/3 space-y-6" @submit="onSubmit">
        <VeeField v-slot="{ field, errors }" :name="`[${SettingKey.Theme}]`">
          <Field orientation="responsive" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-theme">Theme</FieldLabel>
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select
              v-else
              :model-value="field.value"
              @update:model-value="field.onChange"
            >
              <SelectTrigger
                id="form-vee-general-theme"
                :aria-invalid="!!errors.length"
              >
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :key="Theme.Light" :value="Theme.Light"
                    >Light
                  </SelectItem>
                  <SelectItem :key="Theme.Dark" :value="Theme.Dark"
                    >Dark
                  </SelectItem>
                  <SelectItem :key="Theme.System" :value="Theme.System"
                    >System
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </VeeField>

        <VeeField v-slot="{ field, errors }" :name="`[${SettingKey.Table}]`">
          <Field orientation="responsive" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-table"
                >Handling of tables</FieldLabel
              >
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select
              v-else
              :model-value="field.value"
              @update:model-value="field.onChange"
            >
              <SelectTrigger
                id="form-vee-general-table"
                :aria-invalid="!!errors.length"
              >
                <SelectValue placeholder="Select handling" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :key="Table.Filtered" :value="Table.Filtered"
                    >Filter non-phrasing content
                  </SelectItem>
                  <SelectItem
                    :key="Table.NonPhrasingContentToHTML"
                    :value="Table.NonPhrasingContentToHTML"
                    >Convert table with non-phrasing content to HTML
                  </SelectItem>
                  <SelectItem :key="Table.ToHTML" :value="Table.ToHTML"
                    >Convert all tables to HTML
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </VeeField>
        <VeeField v-slot="{ field, errors }" :name="`[${SettingKey.Grid}]`">
          <Field orientation="responsive" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-grid"
                >Handling of grids</FieldLabel
              >
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Select
              v-else
              :model-value="field.value"
              @update:model-value="field.onChange"
            >
              <SelectTrigger
                id="form-vee-general-grid"
                :aria-invalid="!!errors.length"
              >
                <SelectValue placeholder="Select handling" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :key="Grid.Flatten" :value="Grid.Flatten"
                    >Flatten
                  </SelectItem>
                  <SelectItem :key="Grid.ToTable" :value="Grid.ToTable"
                    >To Table
                  </SelectItem>
                  <SelectItem :key="Grid.ToHTML" :value="Grid.ToHTML"
                    >To HTML
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </VeeField>
        <VeeField
          v-slot="{ field, errors }"
          :name="`[${SettingKey.TextHighlight}]`"
        >
          <Field orientation="horizontal" :data-invalid="!!errors.length">
            <FieldContent>
              <FieldLabel for="form-vee-general-text-highlight"
                >Preserve text highlighting (font color, font background
                color)</FieldLabel
              >
              <FieldError v-if="errors.length" :errors="errors" />
            </FieldContent>
            <Skeleton v-if="query.isPending.value" class="h-9 w-40" />
            <Switch
              v-else
              id="form-vee-general-text-highlight"
              :name="field.name"
              :model-value="field.value"
              :aria-invalid="!!errors.length"
              @update:model-value="field.onChange"
            />
          </Field>
        </VeeField>
        <Button
          type="submit"
          class="relative"
          :disabled="query.isPending.value || isSubmitting"
        >
          <LoaderCircle v-if="isSubmitting" class="size-5 animate-spin" />
          <template v-if="meta.dirty">
            <span
              class="bg-primary absolute -right-1 -top-1 inline-flex size-3 animate-ping rounded-full opacity-75"
            ></span>
            <span
              class="bg-primary absolute -right-1 -top-1 inline-flex size-3 rounded-full"
            ></span>
          </template>
          Save
        </Button>
      </form>
    </CardContent>
  </Card>
</template>
