'use client'

import { useEffect, useRef } from 'react'
import { useVMwareStore } from '@/lib/store/vmware'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { loadFromDisk } = useVMwareStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      console.log('StoreProvider: Initial loading of hardware...')
      loadFromDisk().then(() => {
        console.log('StoreProvider: Initial load completed')
        initialized.current = true
      }).catch(err => {
        console.error('StoreProvider: Failed to load hardware:', err)
      })
    }
  }, [])

  return children
} 