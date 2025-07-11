import type { ActionVariant } from '@bangle.io/ui-components';
import React from 'react';
import { Actions } from '../common/actions';
import { ContentSection } from '../common/content-section';
import { EmptyStateIllustration } from '../common/empty-state-illustration';
import { PageHeader } from '../common/page-header';

interface NoticeViewProps {
  title: string;
  description?: React.ReactNode;
  illustration?: React.ReactNode;
  actions?: {
    label: string;
    variant?: ActionVariant;
    onClick: () => void;
  }[];
}

/** Displays a standard notice message with a title, description, illustration, and optional actions. */
export function NoticeView({
  title,
  description,
  illustration = <EmptyStateIllustration />,
  actions,
}: NoticeViewProps) {
  return (
    <ContentSection hasPadding className="mx-auto w-full max-w-lg">
      <PageHeader title={title} illustration={illustration} />
      {description && (
        <p className="mt-2 text-center text-muted-foreground">{description}</p>
      )}
      {actions && actions.length > 0 && <Actions actions={actions} />}
    </ContentSection>
  );
}
