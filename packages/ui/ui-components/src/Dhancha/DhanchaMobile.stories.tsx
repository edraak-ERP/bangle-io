import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { DhanchaSmallscreen } from './index';

const meta: Meta<typeof DhanchaSmallscreen> = {
  title: 'DhanchaSmallscreen',
  component: DhanchaSmallscreen,
  argTypes: {},
  decorators: [],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof DhanchaSmallscreen>;

export const Main: Story = {
  args: {
    titlebar: <div className="w-full bg-colorBgLayerFloat">I am titlebar</div>,
    mainContent: <MainContent />,
  },
};

function MainContent() {
  const [_noteSidebarOpen, toggleNoteSidebar] = useState(true);
  const [_workspaceSidebarOpen, toggleWorkspaceSidebar] = useState(true);

  return (
    <div
      style={{
        backgroundColor: 'pink',
        height: '100%',
      }}
    >
      <div>
        Main content
        <button
          type="button"
          onClick={() => {
            toggleNoteSidebar((r) => !r);
          }}
        >
          Note Sidebar
        </button>
        <button
          type="button"
          onClick={() => {
            toggleWorkspaceSidebar((r) => !r);
          }}
        >
          Workspace Sidebar
        </button>
        <div>{generateText({ lines: 111 })}</div>
      </div>
    </div>
  );
}

function _NoteSidebar() {
  const [noteSidebarOpen, _toggleNoteSidebar] = useState(true);

  return noteSidebarOpen ? (
    <div
      style={{
        backgroundColor: 'lightblue',
        height: '100vh',
        overflowY: 'scroll',
      }}
    >
      <div>Note sidebar</div>
      <div>{generateText({ lines: 10 })}</div>
    </div>
  ) : null;
}

function _WorkspaceSidebar() {
  const [workspaceSidebarOpen, toggleWorkspaceSidebar] = useState(true);

  return workspaceSidebarOpen ? (
    <div
      role="button"
      tabIndex={0}
      style={{
        backgroundColor: 'lightgreen',
        height: '100vh',
        overflowY: 'scroll',
      }}
      onClick={() => {
        toggleWorkspaceSidebar((r) => !r);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggleWorkspaceSidebar((r) => !r);
        }
      }}
    >
      <div>{generateText({ lines: 10 })}</div>
    </div>
  ) : null;
}

function generateText({ lines = 10 }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: demo array for storybook
        <div key={i} style={{ marginTop: '1rem' }}>
          Tabbed UI Premise: make it clear which file I am working on and
          improve the top level organization of the app. I think it is time to
          just create a master UI skeleton that I can try out independently and
          progressively enhance it for the user. Again prone to the itch of
          creation, I need to think about what skeleton will work best for me.
          MemUI, logSeq and many more in my notes, have decent UI , I just need
          to capture it. Dhancha the main skeleton of the app. headerSection
          mainSection primaryColumn sidebar Notes nThis will be a good exercise
          to break up things in app directory, keep the in mind good article on
          css styling
          https://www.baldurbjarnason.com/2021/100-things-every-web-developer-should-know/
          also do some research on styling.
        </div>
      ))}
    </div>
  );
}
