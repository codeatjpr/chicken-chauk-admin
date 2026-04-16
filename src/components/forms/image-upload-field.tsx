import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
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

  const previewUrl = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const visibleUrl = previewUrl ?? currentImageUrl ?? null

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs">{label}</Label>
      {visibleUrl ? (
        <img
          src={visibleUrl}
          alt=""
          className={cn(
            'border-border max-h-32 rounded-lg border object-contain',
            previewClassName,
          )}
        />
      ) : (
        <div
          className={cn(
            'bg-muted text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-xs',
            previewClassName,
          )}
        >
          {emptyLabel}
        </div>
      )}
      {!disabled ? (
        <div className="flex items-center gap-2">
          <Input
            key={inputKey}
            type="file"
            accept={accept}
            disabled={disabled}
            className="text-sm"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
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
