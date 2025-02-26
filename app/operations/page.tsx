'use client'

import { useEffect, useState, useCallback } from 'react'
import { useVMwareStore } from '@/lib/store/vmware'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Play, Pause, RotateCw, Square, Settings, GripVertical } from 'lucide-react'
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
import { DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface VMStatus {
  id: string
  status: 'running' | 'stopped' | 'paused' | 'suspended'
  lastOperation?: string
}

interface Container {
  id: string
  name: string
  vmx_path: string
  hardware_id?: string
}

interface Hardware {
  id: string
  name: string
}

interface SortableTableRowProps {
  container: Container
  hardware: Hardware | undefined
  vmStatus: VMStatus | undefined
  loading: boolean
  selectedVMs: string[]
  setSelectedVMs: (vms: string[]) => void
  batchOperation: (operation: 'start' | 'stop' | 'pause' | 'reset', containerId?: string) => Promise<void>
  handleHardwareChange: (containerId: string, hardwareId: string) => Promise<void>
  hardwares: Hardware[]
}

// 可排序的表格行组件
function SortableTableRow({ 
  container, 
  hardware, 
  vmStatus, 
  loading, 
  selectedVMs, 
  setSelectedVMs, 
  batchOperation, 
  handleHardwareChange,
  hardwares 
}: SortableTableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: container.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-accent' : undefined}>
      <TableCell>
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="touch-none select-none">
            <GripVertical 
              className="w-5 h-5 hover:text-foreground text-muted-foreground/60 [&:active]:cursor-grabbing cursor-grab" 
            />
          </div>
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
        </div>
      </TableCell>
      <TableCell>{container.name}</TableCell>
      <TableCell>
        <Select
          value={container.hardware_id || "none"}
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
            vmStatus?.status === 'running' ? 'bg-green-500' :
            vmStatus?.status === 'paused' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
          {vmStatus?.status || '未知'}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => batchOperation('start', container.id)}
            disabled={loading || vmStatus?.status === 'running'}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => batchOperation('stop', container.id)}
            disabled={loading || vmStatus?.status === 'stopped'}
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function OperationsPage() {
  const { containers, hardwares, updateContainer, reorderContainers, saveToDisk } = useVMwareStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVMs, setSelectedVMs] = useState<string[]>([])
  const [vmStatuses, setVMStatuses] = useState<Record<string, VMStatus>>({})

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // 8px的移动距离才触发拖拽
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms的延迟才触发拖拽
        tolerance: 5, // 5px的容差
      },
    })
  )

  // 将 refreshStatus 包装在 useCallback 中以避免重复创建
  const refreshStatus = useCallback(async () => {
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
  }, [containers])

  // 初始加载和页面可见性变化时的自动刷新
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // 处理页面可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面变为可见时，立即刷新一次
        refreshStatus();
        // 然后开始定时刷新
        intervalId = setInterval(refreshStatus, 10000);
      } else {
        // 页面不可见时，清除定时器
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    // 添加可见性变化监听器
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 初始加载时立即刷新一次
    refreshStatus();
    
    // 如果页面当前可见，开始定时刷新
    if (document.visibilityState === 'visible') {
      intervalId = setInterval(refreshStatus, 10000);
    }

    // 清理函数
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refreshStatus]); // 依赖于 refreshStatus

  // 添加页面卸载时的保存逻辑
  useEffect(() => {
    return () => {
      // 页面卸载时保存状态
      saveToDisk();
    };
  }, [saveToDisk]);

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
            vmxPath: container.vmx_path,
            hardwareId: container.hardware_id  // 传递硬件配置ID
          })
        }
      } else {
        // 否则操作所有选中的虚拟机
        for (const id of selectedVMs) {
          const container = containers.find(c => c.id === id)
          if (!container) continue
  
          await invoke('vm_operation', {
            operation,
            vmxPath: container.vmx_path,
            hardwareId: container.hardware_id  // 传递硬件配置ID
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

  // 处理硬件配置变更 - 移除立即保存逻辑
  const handleHardwareChange = async (containerId: string, hardwareId: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const hardwareIdToSave = hardwareId === "none" ? null : hardwareId;
      
      await updateContainer(containerId, { 
        hardware_id: hardwareIdToSave  // 改为 hardware_id
      });

    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      // 直接传递 active.id 和 over.id 给 reorderContainers
      reorderContainers(active.id as string, over.id as string)
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
            <SortableContext items={containers.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {containers.map((container) => (
                <SortableTableRow
                  key={container.id}
                  container={container}
                  hardware={hardwares.find(h => h.id === container.hardware_id)}
                  vmStatus={vmStatuses[container.id]}
                  loading={loading}
                  selectedVMs={selectedVMs}
                  setSelectedVMs={setSelectedVMs}
                  batchOperation={batchOperation}
                  handleHardwareChange={handleHardwareChange}
                  hardwares={hardwares}
                />
              ))}
            </SortableContext>
          </TableBody>
        </Table>
      </DndContext>
    </div>
  )
} 