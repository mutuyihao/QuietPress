import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          认证错误
        </h1>
        <p className="text-muted-foreground mb-6">
          登录过程中发生错误，请重试。
        </p>
        <Button asChild>
          <Link href="/auth/login">返回登录</Link>
        </Button>
      </div>
    </div>
  )
}
