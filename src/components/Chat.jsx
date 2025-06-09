function Chat() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Single file list display */}
      <div className="flex items-center gap-2 p-2 border-b">
        {selectedFiles.map((file) => (
          <FileChip key={file.path} file={file} onRemove={handleRemoveFile} />
        ))}
      </div>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </div>

      {/* Chat input area */}
      <div className="border-t p-4">
        <ChatInput onSubmit={handleSubmit} />
      </div>
    </div>
  );
} 