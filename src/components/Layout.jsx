import React from 'react';

const Layout = ({ directorySection, chatSection, contentSection }) => {
  return (
    <div className="h-screen flex flex-col">
      {/* Top section with directory and chat */}
      <div className="flex h-1/2 border-b">
        {/* Directory column */}
        <div className="w-1/2 border-r overflow-y-auto">
          {directorySection}
        </div>
        {/* Chat column */}
        <div className="w-1/2 relative">
          {chatSection}
        </div>
      </div>

      {/* Bottom section for content */}
      <div className="h-1/2 overflow-y-auto p-4">
        {contentSection}
      </div>
    </div>
  );
};

export default Layout; 