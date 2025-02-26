'use client'

import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { emit } from '@tauri-apps/api/event'
import { useVMwareStore } from '@/lib/store/vmware'

export function TauriEventHandler() {
  const { saveToDisk } = useVMwareStore()

  useEffect(() => {
    const unsubscribe = listen('save-before-close', async () => {
      console.log('Saving before close...');
      try {
        await saveToDisk();
        console.log('Config saved before close');
        // 通知后端保存完成
        await emit('save-completed');
      } catch (error) {
        console.error('Failed to save config before close:', error);
        // 即使保存失败也要通知后端，避免窗口无法关闭
        await emit('save-completed');
      }
    });

    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [saveToDisk]);

  return null;
} 