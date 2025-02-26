'use client'

import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useVMwareStore } from '@/lib/store/vmware'
import { Button } from '@/components/ui/button'
import { Loader2, FolderSearch, Plus } from 'lucide-react'
import { open } from '@tauri-apps/api/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Container {
  id: string
  name: string
  vmx_path: string
  created_at: string
}

export default function ContainersPage() {
  const { 
    vmwarePath, 
    containers,
    addContainer,
    removeContainer,
    addContainers,
    loadFromDisk 
  } = useVMwareStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [containerToDelete, setContainerToDelete] = useState<string | null>(null)

  useEffect(() => {
    console.log('ContainersPage mounted, loading data...');
    loadFromDisk().catch(err => {
      console.error('Failed to load container data:', err);
      setError('加载容器配置失败');
    });
  }, [loadFromDisk]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000); // 3秒后自动清除错误信息

      return () => clearTimeout(timer);
    }
  }, [error]);

  const scanVMXFiles = async () => {
    if (!vmwarePath) return
    
    try {
      setLoading(true)
      setError(null)
      const newContainers = await invoke<Container[]>('scan_vmx_files', { path: vmwarePath })
      
      // 过滤掉已存在的容器
      const uniqueContainers = newContainers.filter(newContainer => 
        !containers.some(existing => existing.vmx_path === newContainer.vmx_path)
      );
      
      if (uniqueContainers.length === 0) {
        setError('没有发现新的 VMX 文件');
        return;
      }

      addContainers(uniqueContainers)
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
        // 检查是否已存在相同路径的容器
        const exists = containers.some(c => c.vmx_path === selected);
        if (exists) {
          setError('该 VMX 文件已存在');
          return;
        }

        const container = await invoke<Container>('add_container', {
          vmxPath: selected,
          name: selected.split('/').pop()?.replace('.vmx', '') || 'Unknown'
        })
        addContainer(container)
      }
    } catch (err) {
      setError(err as string)
    }
  }

  const handleDelete = async () => {
    if (!containerToDelete) return
    
    try {
      setLoading(true)
      setError(null)
      await invoke('delete_container', { id: containerToDelete })
      removeContainer(containerToDelete)
      setContainerToDelete(null)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">虚拟机管理</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => vmwarePath && scanVMXFiles()}
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
        {containers.map((container) => (
          <div
            key={container.id}
            className="border rounded-lg p-4 hover:bg-accent transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{container.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{container.vmx_path}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  编辑
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setContainerToDelete(container.id)}>
                  删除
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog 
        open={!!containerToDelete} 
        onOpenChange={(open) => !open && setContainerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个容器吗？此操作不会删除实际的 VMX 文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 