import {
  BarChart3,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Hash,
  Link2,
  ListChecks,
  MapPin,
  Paperclip,
  Type,
  User,
  Users,
} from 'lucide-react'
import type React from 'react'
import type { MarkdownDataViewColumnType } from './markdownDataViewColumnType'

export const iconByColumnType: Record<MarkdownDataViewColumnType, React.ComponentType<{ className?: string }>> = {
  checkbox: CheckSquare,
  date: Calendar,
  'multi-select': ListChecks,
  number: Hash,
  progress: BarChart3,
  select: ChevronDown,
  link: Link2,
  geodata: MapPin,
  text: Type,
  'created-time': Clock,
  attachment: Paperclip,
  member: Users,
  'created-by': User,
}
