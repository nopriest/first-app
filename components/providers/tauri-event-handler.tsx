'use client'

import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useVMwareStore } from '@/lib/store/vmware'

export function TauriEventHandler() {
  const { saveToDisk } = useVMwareStore()

  useEffect(() => {
    const unsubscribe = listen('save-before-close', async () => {
      console.log('Saving before close...');
      try {
        await saveToDisk();
        console.log('Config saved before close');
      } catch (error) {
        console.error('Failed to save config before close:', error);
      }
    });

    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [saveToDisk]);

  return null;
} 