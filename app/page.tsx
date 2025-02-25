import Link from "next/link";
import { Settings, Box } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold mb-4">欢迎使用 VMware 管理器</h2>
        <p className="text-muted-foreground">
          请使用左侧菜单开始管理您的虚拟机
        </p>
      </div>
    </div>
  );
}
