'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { useVMwareStore } from '@/lib/store/vmware'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { open } from '@tauri-apps/api/dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label'
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
import { useRouter } from 'next/navigation'

interface Hardware {
  id: string
  name: string
  bios_path: string
  vmx_path: string
  created_at: string
}

interface NewHardware {
  name: string
  biosPath: string
  vmxPath: string
}

interface VirtualItem {
  index: number
  start: number
  size: number
  key: string | number
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  )
}

export default function HardwarePage() {
  const { 
    vmwarePath, 
    hardwares, 
    addHardware, 
    removeHardware,
    addHardwares,
    loadFromDisk
  } = useVMwareStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [newHardware, setNewHardware] = useState<NewHardware>({
    name: '',
    biosPath: '',
    vmxPath: '',
  })
  const parentRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const itemsPerPage = 10
  const currentItems = useMemo(() => 
    hardwares.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [hardwares, page, itemsPerPage]
  )
  const totalPages = useMemo(() => 
    Math.ceil(hardwares.length / itemsPerPage),
    [hardwares.length, itemsPerPage]
  )
  const [hardwareToDelete, setHardwareToDelete] = useState<string | null>(null)
  const router = useRouter()
  const initialized = useRef(false)

  const scanHardware = async () => {
    if (!vmwarePath) return
    
    try {
      setLoading(true)
      setError(null)
      const list = await invoke<Hardware[]>('scan_hardware_files', { vmwarePath })
      addHardwares(list)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const selectFile = async (type: 'bios' | 'vmx') => {
    try {
      const selected = await open({
        filters: [{
          name: type === 'bios' ? 'BIOS ROM' : 'VMX Executable',
          extensions: type === 'bios' ? ['rom'] : ['exe']
        }],
        multiple: false
      })
      
      if (selected && typeof selected === 'string') {
        const fieldName = type === 'bios' ? 'biosPath' : 'vmxPath'
        console.log(`Setting ${fieldName} to:`, selected)
        setNewHardware(prev => ({
          ...prev,
          [fieldName]: selected
        }))
      }
    } catch (err) {
      setError(err as string)
    }
  }

  const addHardwareConfig = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Adding hardware with:', newHardware)
      const hardware = await invoke<Hardware>('add_hardware', {
        ...newHardware
      })
      addHardware(hardware)
      setIsOpen(false)
      setNewHardware({ name: '', biosPath: '', vmxPath: '' })
    } catch (err) {
      console.error('Error in addHardware:', err)
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!hardwareToDelete) return
    
    try {
      setLoading(true)
      setError(null)
      await invoke('delete_hardware', { id: hardwareToDelete })
      removeHardware(hardwareToDelete)
      setHardwareToDelete(null)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const scanButton = (
    <Button
      variant="outline"
      onClick={scanHardware}
      disabled={loading || !vmwarePath}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <RefreshCw className="w-4 h-4 mr-2" />
      )}
      扫描默认硬件
    </Button>
  )

  useEffect(() => {
    console.log('HardwarePage mounted, loading data...');
    loadFromDisk().then(() => {
      console.log('Hardware data loaded');
    }).catch(err => {
      console.error('Failed to load hardware data:', err);
      setError('加载硬件配置失败');
    });
  }, []);

  useEffect(() => {
    if (vmwarePath && hardwares.length === 0 && !initialized.current) {
      console.log('Scanning for default hardware...');
      scanHardware();
      initialized.current = true;
    }
  }, [vmwarePath, hardwares.length]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleTabClick = useCallback((href: string) => {
    router.push(href)
  }, [router])

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">硬件管理</h1>
        <div className="flex gap-2">
          {scanButton}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                添加硬件配置
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加新的硬件配置</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">配置名称</Label>
                  <Input
                    id="name"
                    value={newHardware.name}
                    onChange={e => setNewHardware(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入配置名称"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>BIOS ROM文件</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newHardware.biosPath}
                      readOnly
                      placeholder="选择BIOS.440.ROM文件"
                    />
                    <Button variant="outline" onClick={() => selectFile('bios')}>
                      浏览
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>VMX可执行文件</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newHardware.vmxPath}
                      readOnly
                      placeholder="选择vmware-vmx.exe文件"
                    />
                    <Button variant="outline" onClick={() => selectFile('vmx')}>
                      浏览
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  取消
                </Button>
                <Button 
                  onClick={addHardwareConfig}
                  disabled={loading || !newHardware.name || !newHardware.biosPath || !newHardware.vmxPath}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认添加'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {currentItems.map((hardware) => (
          <div
            key={hardware.id}
            className="border rounded-lg p-4 hover:bg-accent transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{hardware.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  创建时间: {new Date(hardware.created_at).toLocaleString()}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">BIOS: {hardware.bios_path}</p>
                  <p className="text-sm">VMX: {hardware.vmx_path}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setHardwareToDelete(hardware.id)}
                  disabled={loading}
                >
                  删除
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="py-2 px-4">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            下一页
          </Button>
        </div>
      )}

      <AlertDialog 
        open={!!hardwareToDelete} 
        onOpenChange={(open: boolean) => !open && setHardwareToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个硬件配置吗？此操作无法撤销。
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