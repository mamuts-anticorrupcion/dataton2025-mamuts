'use client';
import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

export function ScrollArea({
  children,
  className,
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <ScrollAreaPrimitive.Root className={`overflow-hidden ${className ?? ''}`}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex touch-none select-none bg-slate-800 p-[1px] transition hover:bg-slate-700"
      >
        <ScrollAreaPrimitive.Thumb className="flex-1 rounded-full bg-slate-600" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
