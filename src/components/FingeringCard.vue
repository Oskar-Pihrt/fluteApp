<script setup lang="ts">
import KeyChart from '@/components/KeyChart.vue'
import { type Fingering, prettyCode } from '@/domain/fingering'
import { getInstrument, REQUIREMENT_LABELS } from '@/instruments'

/** One fingering rendered as a diagram plus its notation and caveats. */
const props = withDefaults(
  defineProps<{ fingering: Fingering; size?: 'sm' | 'md' | 'lg'; showKind?: boolean }>(),
  { size: 'md', showKind: true },
)

const KIND_LABELS: Record<Fingering['kind'], string> = {
  primary: 'Primary',
  alternate: 'Alternate',
  trill: 'Trill / fast passage',
  harmonic: 'Harmonic',
}
</script>

<template>
  <div class="flex items-center gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
    <KeyChart
      :keys="props.fingering.keys"
      :vented="props.fingering.vented"
      :size="props.size"
      :instrument="getInstrument(props.fingering.instrument)"
      class="shrink-0"
    />

    <div class="min-w-0 flex-1 space-y-2">
      <div v-if="props.showKind" class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          :class="
            props.fingering.kind === 'primary'
              ? 'bg-accent-400 text-ink-950'
              : 'border border-ink-600 text-ink-200'
          "
        >
          {{ KIND_LABELS[props.fingering.kind] }}
        </span>
        <span
          v-for="requirement in props.fingering.requires"
          :key="requirement"
          class="rounded-md border border-ink-600 px-2 py-0.5 text-[11px] text-ink-400"
        >
          {{ REQUIREMENT_LABELS[requirement] }}
        </span>
      </div>

      <p class="font-mono text-xs leading-relaxed break-words text-ink-200">
        {{ prettyCode(props.fingering.code) }}
      </p>

      <p v-if="props.fingering.comment" class="text-xs leading-relaxed text-ink-400">
        {{ props.fingering.comment }}
      </p>

      <p
        v-if="props.fingering.verify"
        class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200"
      >
        <strong class="font-semibold">Needs checking:</strong> {{ props.fingering.verify }}
      </p>
    </div>
  </div>
</template>
