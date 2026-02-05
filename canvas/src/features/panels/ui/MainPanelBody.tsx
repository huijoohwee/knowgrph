import React from 'react';

interface MainPanelBodyProps {
  header: React.ReactNode;
  children: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
  scrollable?: boolean;
}

export default function MainPanelBody({ header, children, scrollRef, scrollable = true }: MainPanelBodyProps) {
  return (
    <aside className="h-full w-full min-h-0 flex flex-col overflow-hidden" aria-label="Main Panel">
      {header}
      <section
        ref={scrollRef}
        className={`flex-1 min-h-0 w-full ${scrollable ? 'overflow-auto' : 'overflow-hidden'}`}
        aria-label="Main Panel Content"
      >
        {children}
      </section>
    </aside>
  );
}
