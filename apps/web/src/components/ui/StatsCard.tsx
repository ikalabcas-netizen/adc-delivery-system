import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from './Card'

interface StatsCardProps {
  title:    string
  value:    string | number
  icon:     ReactNode
  iconBg?:  string   // Tailwind bg class e.g. 'bg-adc-100'
  iconColor?: string // Tailwind text class
  trend?:   { value: number; label: string }
  className?: string
}

export function StatsCard({ title, value, icon, iconBg = 'bg-adc-100', iconColor = 'text-adc-600', trend, className }: StatsCardProps) {
  const TrendIcon = trend
    ? trend.value > 0 ? TrendingUp : trend.value < 0 ? TrendingDown : Minus
    : null

  const trendColor = trend
    ? trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-red-600' : 'text-slate-500'
    : ''

  return (
    <Card className={cn('animate-fade-in', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
          {trend && TrendIcon && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trendColor)}>
              <TrendIcon size={12} />
              <span>{Math.abs(trend.value)}% {trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
    </Card>
  )
}
