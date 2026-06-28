'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Site, Wave, RefreshType, REFRESH_TYPES, REFRESH_TYPE_LABELS } from '@/lib/types'

const ALL_COUNTRIES = [
  'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Bolivia', 'Brazil', 'Canada',
  'Chile', 'China', 'Colombia', 'Costa Rica', 'Czech Republic', 'Denmark', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Finland', 'France', 'Germany', 'Ghana', 'Greece',
  'Guatemala', 'Honduras', 'Hong Kong', 'Hungary', 'India', 'Indonesia', 'Ireland', 'Israel',
  'Italy', 'Japan', 'Jordan', 'Kenya', 'Malaysia', 'Mexico', 'Morocco', 'Netherlands',
  'New Zealand', 'Nicaragua', 'Nigeria', 'Norway', 'Pakistan', 'Panama', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Saudi Arabia', 'Singapore',
  'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand',
  'Turkey', 'UAE', 'UK', 'United Kingdom', 'United States', 'USA', 'Uruguay', 'Venezuela',
  'Vietnam',
].sort()

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (site: Site) => void
}

export function AddSiteDialog({ open, onClose, onAdd }: Props) {
  const [name,        setName]        = useState('')
  const [address,     setAddress]     = useState('')
  const [city,        setCity]        = useState('')
  const [state,       setState]       = useState('')
  const [country,     setCountry]     = useState('Brazil')
  const [wave,        setWave]        = useState<Wave | undefined>(undefined)
  const [refreshType, setRefreshType] = useState<RefreshType | undefined>(undefined)

  function handleAdd() {
    if (!name || !address || !city) return
    onAdd({
      id: `site_${Date.now()}`,
      name, address, city, state, country,
      status: 'pending',
      dias: {},
      wave,
      refreshType,
      createdAt: new Date().toISOString(),
    })
    setName(''); setAddress(''); setCity(''); setState('')
    setCountry('Brazil'); setWave(undefined); setRefreshType(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Add Site</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-gray-300">Country</Label>
            <Select value={country} onValueChange={v => v && setCountry(v)}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 max-h-48">
                {ALL_COUNTRIES.map(c => (
                  <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Rollout Wave</Label>
              <Select value={wave?.toString() || 'none'} onValueChange={v => setWave(v === 'none' ? undefined : Number(v) as Wave)}>
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Wave (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="none" className="text-gray-400">No wave</SelectItem>
                  <SelectItem value="1" className="text-white">Wave 1</SelectItem>
                  <SelectItem value="2" className="text-white">Wave 2</SelectItem>
                  <SelectItem value="3" className="text-white">Wave 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300">Refresh Type</Label>
              <Select value={refreshType || 'none'} onValueChange={v => setRefreshType(v === 'none' ? undefined : v as RefreshType)}>
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Type (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="none" className="text-gray-400">No type</SelectItem>
                  {REFRESH_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="text-white">{t} — {REFRESH_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {[
            { label: 'Site Name',      value: name,    setter: setName,    placeholder: 'e.g. NYC-HQ-01' },
            { label: 'Address',        value: address, setter: setAddress, placeholder: '100 Main St' },
            { label: 'City',           value: city,    setter: setCity,    placeholder: 'New York' },
            { label: 'State / Region', value: state,   setter: setState,   placeholder: 'NY' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <Label className="text-gray-300">{label}</Label>
              <Input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder}
                className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleAdd} disabled={!name || !address || !city} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Add Site
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
