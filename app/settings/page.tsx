'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Button } from "@/components/ui/button"
import { useVMwareStore } from '@/lib/store/vmware'
import { Settings, FolderOpen } from 'lucide-react'
import { open } from '@tauri-apps/api/dialog'

export default function SettingsPage() {
  const { vmwarePath, setVMwarePath } = useVMwareStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectVMwarePath = async () => {
    try {
      setLoading(true)
      setError(null)
      const path = await invoke<string>('get_vmware_path')
      setVMwarePath(path)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const selectVMwarePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择VMware安装目录'
      })
      if (selected && typeof selected === 'string') {
        setVMwarePath(selected)
      }
    } catch (err) {
      setError(err as string)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6" />
        <h1 className="text-2xl font-bold">VMware 设置</h1>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">VMware 安装路径</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={vmwarePath || ''}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-muted"
            />
            <Button
              variant="outline"
              onClick={selectVMwarePath}
              className="flex gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              浏览
            </Button>
            <Button 
              onClick={detectVMwarePath}
              disabled={loading}
            >
              自动检测
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
} 