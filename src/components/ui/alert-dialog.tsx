import * as React from 'react'
import { AlertDialog as AD } from '@base-ui/react/alert-dialog'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function AlertDialog({ ...props }: AD.Root.Props) {
  return <AD.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: AD.Trigger.Props) {
  return <AD.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: AD.Portal.Props) {
  return <AD.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({ className, ...props }: AD.Backdrop.Props) {
  return (
    <AD.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({ className, ...props }: AD.Popup.Props) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AD.Popup
        data-slot="alert-dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-lg duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 sm:rounded-xl',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: AD.Title.Props) {
  return (
    <AD.Title
      data-slot="alert-dialog-title"
      className={cn('font-heading text-lg font-semibold text-foreground', className)}
      {...props}
    />
  )
}

type AlertDialogDescriptionProps = AD.Description.Props & {
  asChild?: boolean
}

function AlertDialogDescription({ className, asChild, children, ...props }: AlertDialogDescriptionProps) {
  const mergedClass = cn('text-sm text-muted-foreground', className)

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>
    return (
      <AD.Description
        data-slot="alert-dialog-description"
        render={React.cloneElement(child, {
          className: cn(mergedClass, child.props.className),
        })}
        {...props}
      />
    )
  }

  return (
    <AD.Description data-slot="alert-dialog-description" className={mergedClass} {...props}>
      {children}
    </AD.Description>
  )
}

function AlertDialogAction({ className, ...props }: AD.Close.Props) {
  return (
    <AD.Close
      data-slot="alert-dialog-action"
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({ className, ...props }: AD.Close.Props) {
  return (
    <AD.Close
      data-slot="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
