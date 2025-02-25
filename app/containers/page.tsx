'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useVMwareStore } from '@/lib/store/vmware'
import { Button } from '@/components/ui/button'
import { Loader2, FolderSearch, Plus } from 'lucide-react'
import { open } from '@tauri-apps/api/dialog'

interface VMXInfo {
  path: string
  name: string
  config?: string
}

export default function ContainersPage() {
  const { vmwarePath } = useVMwareStore()
  const [vmxFiles, setVmxFiles] = useState<VMXInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scanVMXFiles = async (path: string) => {
    try {
      setLoading(true)
      setError(null)
      const files = await invoke<VMXInfo[]>('scan_vmx_files', { path })
      setVmxFiles(files)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const selectVMXFile = async () => {
    try {
      const selected = await open({
        filters: [{
          name: 'VMX Files',
          extensions: ['vmx']
        }],
        multiple: false
      })
      
      if (selected && typeof selected === 'string') {
        // 添加到列表中
        setVmxFiles(prev => [...prev, {
          path: selected,
          name: selected.split('/').pop()?.replace('.vmx', '') || 'Unknown'
        }])
      }
    } catch (err) {
      setError(err as string)
    }
  }

  useEffect(() => {
    if (vmwarePath) {
      scanVMXFiles(vmwarePath)
    }
  }, [vmwarePath])

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">虚拟机管理</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => vmwarePath && scanVMXFiles(vmwarePath)}
            disabled={loading || !vmwarePath}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderSearch className="w-4 h-4" />
            )}
            扫描VMX文件
          </Button>
          <Button onClick={selectVMXFile}>
            <Plus className="w-4 h-4 mr-2" />
            添加VMX文件
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {vmxFiles.map((vmx) => (
          <div
            key={vmx.path}
            className="border rounded-lg p-4 hover:bg-accent transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{vmx.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{vmx.path}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  编辑
                </Button>
                <Button variant="destructive" size="sm">
                  删除
                </Button>
              </div>
            </div>
            {vmx.config && (
              <pre className="mt-4 p-2 bg-muted rounded text-sm overflow-x-auto">
                {vmx.config}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 