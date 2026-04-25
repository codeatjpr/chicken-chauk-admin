import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import { ImagePlus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type ImageUploadFieldProps = {
  label: string
  file: File | null
  onFileChange: (file: File | null) => void
  currentImageUrl?: string | null
  accept?: string
  hint?: string
  disabled?: boolean
  className?: string
  previewClassName?: string
  emptyLabel?: string
}

function fileMatchesAccept(file: File, accept: string): boolean {
  const raw = accept.trim()
  if (!raw) return file.type.startsWith('image/')
  const parts = raw.split(',').map((s) => s.trim().toLowerCase())
  const type = file.type.toLowerCase()
  for (const p of parts) {
    if (p === 'image/*' && type.startsWith('image/')) return true
    if (p === type) return true
  }
  return false
}

export function ImageUploadField({
  label,
  file,
  onFileChange,
  currentImageUrl,
  accept = 'image/jpeg,image/png',
  hint,
  disabled = false,
  className,
  previewClassName,
  emptyLabel = 'No image selected',
}: ImageUploadFieldProps) {
  const [inputKey, setInputKey] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)

  const previewUrl = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const visibleUrl = previewUrl ?? currentImageUrl ?? null

  const applyFile = useCallback(
    (next: File | null) => {
      if (!next) {
        onFileChange(null)
        return
      }
      if (!next.type.startsWith('image/')) return
      if (!fileMatchesAccept(next, accept)) return
      onFileChange(next)
      setInputKey((k) => k + 1)
    },
    [accept, onFileChange],
  )

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragDepth.current += 1
    if (e.dataTransfer.types.includes('Files')) setDragActive(true)
  }, [disabled])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragActive(false)
    }
  }, [])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) e.dataTransfer.dropEffect = 'copy'
  }, [disabled])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragDepth.current = 0
      setDragActive(false)
      if (disabled) return
      const dropped = e.dataTransfer.files?.[0]
      if (dropped) applyFile(dropped)
    },
    [applyFile, disabled],
  )

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs">{label}</Label>
      <div
        role="group"
        aria-label={`${label}: drag and drop an image here, or choose a file below`}
        aria-disabled={disabled}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          'relative overflow-hidden rounded-lg transition-colors',
          !disabled && 'cursor-default',
          dragActive &&
            !disabled &&
            'ring-primary ring-2 ring-offset-2 ring-offset-background',
        )}
      >
        {visibleUrl ? (
          <img
            src={visibleUrl}
            alt=""
            className={cn(
              'border-border max-h-32 w-full rounded-lg border object-contain',
              dragActive && !disabled && 'opacity-70',
              previewClassName,
            )}
          />
        ) : (
          <div
            className={cn(
              'text-muted-foreground flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-xs',
              dragActive && !disabled
                ? 'border-primary bg-primary/8 text-foreground'
                : 'bg-muted border-border',
              previewClassName,
            )}
          >
            <Upload className="size-6 shrink-0 opacity-70" aria-hidden />
            <span className="font-medium">Drop image here</span>
            <span className="text-[11px] opacity-80">{emptyLabel}</span>
          </div>
        )}
        {dragActive && !disabled ? (
          <div className="bg-primary/10 pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg">
            <span className="text-primary text-sm font-medium">Release to upload</span>
          </div>
        ) : null}
      </div>
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            key={inputKey}
            type="file"
            accept={accept}
            disabled={disabled}
            className="min-w-0 flex-1 text-sm"
            onChange={(event) => applyFile(event.target.files?.[0] ?? null)}
          />
          <ImagePlus className="text-muted-foreground size-4 shrink-0" aria-hidden />
          {file ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onFileChange(null)
                setInputKey((value) => value + 1)
              }}
            >
              <X className="size-3.5" aria-hidden />
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
      {file ? (
        <p className="text-muted-foreground text-xs">
          Selected: {file.name}
        </p>
      ) : null}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}
