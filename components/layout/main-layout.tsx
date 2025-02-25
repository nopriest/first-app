'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Settings,
  Box,
  Cpu,
  LayoutGrid,
} from "lucide-react"

const navigation = [
  {
    name: "容器管理",
    href: "/containers",
    icon: Box
  },
  {
    name: "硬件管理",
    href: "/hardware",
    icon: Cpu
  },
  {
    name: "批量操作",
    href: "/batch",
    icon: LayoutGrid
  },
  {
    name: "设置",
    href: "/settings",
    icon: Settings
  }
]

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen">
      <aside className="border-r bg-muted/30">
        <nav className="flex flex-col gap-2 p-4">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              VMware 管理器
            </h2>
          </div>
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent"
                )}
                prefetch={true}  // 预加载页面
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
} 