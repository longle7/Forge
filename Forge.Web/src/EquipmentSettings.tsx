import { useState } from 'react'
import { Group, Switch } from './components'
import { BODYWEIGHT, FULL_GYM, HOME_DUMBBELLS, loadEquipment, sameEquipment, saveEquipment } from './equipment'
import { Icon } from './icons'
import { EQUIPMENT_LABELS, type Equipment } from './lifts'

const PRESETS = [
  { label: 'Full gym', detail: 'Barbells, machines, cables, and more', equipment: FULL_GYM },
  { label: 'Home dumbbells', detail: 'Dumbbells and a bench', equipment: HOME_DUMBBELLS },
  { label: 'Bodyweight only', detail: 'No equipment', equipment: BODYWEIGHT },
]

/** Settings → Your equipment: a preset, or each kind of equipment on or off. Saved as you change it. */
export function EquipmentSettings() {
  const [equipment, setEquipment] = useState(loadEquipment)
  const change = (next: Equipment[]) => {
    setEquipment(next)
    saveEquipment(next)
  }
  const toggle = (item: Equipment, on: boolean) => change(on ? [...equipment, item] : equipment.filter((e) => e !== item))

  return (
    <>
      <Group title="Your equipment">
        <div role="radiogroup" aria-label="Your equipment" className="divide-y divide-line">
          {PRESETS.map((preset) => {
            const chosen = sameEquipment(preset.equipment, equipment)
            return (
              <button key={preset.label} role="radio" aria-checked={chosen} onClick={() => change(preset.equipment)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
                <span className="flex-1">
                  <span className="block">{preset.label}</span>
                  <span className="block text-[15px] text-muted">{preset.detail}</span>
                </span>
                {chosen && <Icon name="check" className="size-5 text-coral-ink" />}
              </button>
            )
          })}
        </div>
      </Group>
      <Group footer="Adding an exercise shows only the lifts you can do with these until you turn off Only my equipment, and swaps stick to them. Kept on this device.">
        {FULL_GYM.map((item) => (
          <div key={item} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
            <span className="flex-1">
              {EQUIPMENT_LABELS[item]}
              {item === 'bodyweight' && <span className="block text-[15px] text-muted">Always on</span>}
            </span>
            <Switch checked={item === 'bodyweight' || equipment.includes(item)} onChange={(on) => toggle(item, on)} label={EQUIPMENT_LABELS[item]} disabled={item === 'bodyweight'} />
          </div>
        ))}
      </Group>
    </>
  )
}
