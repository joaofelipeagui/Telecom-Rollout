'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Site, LATAM_COUNTRIES } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (site: Site) => void
}

export function AddSiteDialog({ open, onClose, onAdd }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('Brazil')

  function handleAdd() {
    if (!name || !address || !city) return
    onAdd({
      id: `site_${Date.now()}`,
      name, address, city, state, country,
      status: 'pending',
      dias: {},
      createdAt: new Date().toISOString(),
    })
    setName(''); setAddress(''); setCity(''); setState(''); setCountry('Brazil')
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
                {LATAM_COUNTRIES.map(c => (
                  <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {[
            { label: 'Site Name', value: name, setter: setName, placeholder: 'e.g. Agência Centro SP' },
            { label: 'Address', value: address, setter: setAddress, placeholder: 'Rua Augusta, 1000' },
            { label: 'City', value: city, setter: setCity, placeholder: 'São Paulo' },
            { label: 'State / Region', value: state, setter: setState, placeholder: 'SP' },
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
