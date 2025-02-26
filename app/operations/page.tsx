'use client'

import { useEffect, useState } from 'react'
import { useVMwareStore } from '@/lib/store/vmware'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Play, Pause, RotateCw, Square, Settings } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { invoke } from '@tauri-apps/api/tauri'

interface VMStatus {
  id: string
  status: 'running' | 'stopped' | 'paused' | 'suspended'
  lastOperation?: string
}

export default function OperationsPage() {
  const { containers, hardwares, updateContainer } = useVMwareStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVMs, setSelectedVMs] = useState<string[]>([])
  const [vmStatuses, setVMStatuses] = useState<Record<string, VMStatus>>({})

  // 获取所有VM状态
  const refreshStatus = async () => {
    try {
      setLoading(true)
      const runningVMs = await invoke<string[]>('list_running_vms')
      
      const newStatuses: Record<string, VMStatus> = {}
      containers.forEach(container => {
        newStatuses[container.id] = {
          id: container.id,
          status: runningVMs.includes(container.vmx_path) ? 'running' : 'stopped'
        }
      })
      setVMStatuses(newStatuses)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  // 批量操作函数
  const batchOperation = async (operation: 'start' | 'stop' | 'pause' | 'reset', containerId?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      // 如果提供了containerId，就只操作这一个虚拟机
      if (containerId) {
        const container = containers.find(c => c.id === containerId)
        if (container) {
          await invoke('vm_operation', {
            operation,
            vmxPath: container.vmx_path
          })
        }
      } else {
        // 否则操作所有选中的虚拟机
        for (const id of selectedVMs) {
          const container = containers.find(c => c.id === id)
          if (!container) continue
  
          await invoke('vm_operation', {
            operation,
            vmxPath: container.vmx_path
          })
        }
      }

      await refreshStatus()
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const onCheckedChange = (checked: boolean | string) => {
    if (checked) {
      setSelectedVMs(containers.map(c => c.id))
    } else {
      setSelectedVMs([])
    }
  }

  // 处理硬件配置变更
  const handleHardwareChange = async (containerId: string, hardwareId: string) => {
    try {
      setLoading(true)
      setError(null)
      
      // 更新容器的硬件配置，如果选择了"none"则设置为null
      await updateContainer(containerId, { 
        hardwareId: hardwareId === "none" ? null : hardwareId 
      })
      
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">批量操作</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshStatus()}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '刷新状态'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* 批量操作工具栏 */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => batchOperation('start')}
          disabled={loading || selectedVMs.length === 0}
        >
          <Play className="w-4 h-4 mr-2" />
          启动
        </Button>
        <Button
          onClick={() => batchOperation('stop')}
          disabled={loading || selectedVMs.length === 0}
        >
          <Square className="w-4 h-4 mr-2" />
          停止
        </Button>
        <Button
          onClick={() => batchOperation('pause')}
          disabled={loading || selectedVMs.length === 0}
        >
          <Pause className="w-4 h-4 mr-2" />
          暂停
        </Button>
        <Button
          onClick={() => batchOperation('reset')}
          disabled={loading || selectedVMs.length === 0}
        >
          <RotateCw className="w-4 h-4 mr-2" />
          重启
        </Button>
      </div>

      {/* 虚拟机列表表格 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedVMs.length === containers.length}
                onCheckedChange={onCheckedChange}
              />
            </TableHead>
            <TableHead>虚拟机名称</TableHead>
            <TableHead>硬件配置</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {containers.map((container) => {
            const hardware = hardwares.find(h => h.id === container.hardwareId)
            return (
              <TableRow key={container.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedVMs.includes(container.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedVMs([...selectedVMs, container.id])
                      } else {
                        setSelectedVMs(selectedVMs.filter(id => id !== container.id))
                      }
                    }}
                  />
                </TableCell>
                <TableCell>{container.name}</TableCell>
                <TableCell>
                  <Select
                    value={container.hardwareId || "none"}
                    onValueChange={(value) => handleHardwareChange(container.id, value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="选择硬件配置" />
                    </SelectTrigger>
                    <SelectContent>
                      {hardwares.map((hw) => (
                        <SelectItem key={hw.id} value={hw.id}>
                          {hw.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="none">未配置</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      vmStatuses[container.id]?.status === 'running' ? 'bg-green-500' :
                      vmStatuses[container.id]?.status === 'paused' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    {vmStatuses[container.id]?.status || '未知'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => batchOperation('start', container.id)}
                      disabled={loading || vmStatuses[container.id]?.status === 'running'}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => batchOperation('stop', container.id)}
                      disabled={loading || vmStatuses[container.id]?.status === 'stopped'}
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
} 