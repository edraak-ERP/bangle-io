import { Button } from '@bangle.io/ui-components';
import React from 'react';

export interface Item {
  label: string;
  href: string;
  relativeTime?: string | null;
}

interface ItemListProps {
  heading: string;
  items: Item[];
  emptyMessage: string;
  showViewMore?: boolean;
  onClickViewMore?: () => void;
}

export function PageItemList({
  heading,
  items,
  emptyMessage,
  showViewMore,
  onClickViewMore,
}: ItemListProps) {
  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col items-center gap-3 px-4">
      {items.length > 0 ? (
        <>
          <h3 className="self-start font-semibold text-muted-foreground text-sm">
            {heading}
          </h3>
          <div className="flex w-full flex-col gap-2">
            {items.map(({ label, href, relativeTime }) => (
              <Button
                key={label + href}
                variant="ghost"
                asChild
                className="flex w-full items-center justify-between"
              >
                <a href={href}>
                  <span className="font-medium">{label}</span>
                  {relativeTime && (
                    <span className="text-muted-foreground text-sm">
                      {relativeTime}
                    </span>
                  )}
                </a>
              </Button>
            ))}
            {showViewMore && onClickViewMore && (
              <Button
                variant="ghost"
                onClick={onClickViewMore}
                className="flex w-full items-center justify-between"
              >
                <span className="font-medium">{t.app.common.viewAll}</span>
                <span className="text-sm">→</span>
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="text-muted-foreground text-sm">{emptyMessage}</div>
      )}
    </div>
  );
}
