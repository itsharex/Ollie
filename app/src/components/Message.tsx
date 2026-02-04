import { User, Copy, Check, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useChatStore, type ChatMessage } from '../store/chatStore'
import Markdown from '../lib/markdown'
import TextareaAutosize from 'react-textarea-autosize'

interface MessageProps {
  message: ChatMessage
}

export default function Message({ message }: MessageProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const editUserMessage = useChatStore(state => state.editUserMessage)

  // Debug re-renders
  // console.log('Message component render:', message.id, 'isBinding:', isEditing)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditContent(message.content)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(message.content)
  }

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      editUserMessage(message.id, editContent)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const isUser = message.role === 'user'

  return (
    <div className={`w-full flex items-start gap-6 py-8 ${isUser ? 'bg-gray-50/50' : 'bg-white'} group border-b border-gray-100/50 last:border-b-0`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${isUser
        ? 'bg-gradient-to-br from-blue-600 to-blue-700'
        : 'bg-white border border-gray-100'
        }`}>
        {isUser ? (
          <User size={20} className="text-white" />
        ) : (
          <img src="/ollie-logo.png" alt="Ollie" className="w-6 h-6 object-contain" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className={`text-sm font-semibold mb-3 ${isUser ? 'text-blue-900' : 'text-gray-900'
              }`}>
              {isUser ? 'You' : 'Ollie'}
            </div>

            {isEditing ? (
              <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-sm">
                <TextareaAutosize
                  value={editContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full resize-none outline-none text-gray-900 text-base leading-relaxed"
                  minRows={1}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    Save & Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Attached Images */}
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {message.images.map((img, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <img
                          src={`data:image/png;base64,${img}`}
                          alt="Attachment"
                          className="max-w-xs max-h-64 object-cover block"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="prose prose-base max-w-none text-gray-900 leading-relaxed">
                  {(() => {
                    // Handle DeepSeek <think> blocks
                    const thinkMatch = message.content.match(/<think>([\s\S]*?)<\/think>/)
                    const thinkContent = thinkMatch ? thinkMatch[1] : null
                    const cleanContent = message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

                    return (
                      <>
                        {thinkContent && (
                          <details className="mb-4 group">
                            <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 select-none flex items-center gap-1">
                              <span className="opacity-50 group-open:opacity-100 transition-opacity">💭 Thought Process</span>
                            </summary>
                            <div className="mt-2 pl-3 border-l-2 border-gray-100 text-xs text-gray-500 font-mono whitespace-pre-wrap">
                              {thinkContent}
                            </div>
                          </details>
                        )}
                        <Markdown content={cleanContent || (message.isStreaming && !thinkContent ? '' : message.content)} />
                      </>
                    )
                  })()}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1 rounded-full"></span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
            {/* Edit Button (User only) */}
            {isUser && !isEditing && (
              <button
                onClick={handleEdit}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                title="Edit message"
              >
                <Pencil size={16} />
              </button>
            )}

            {/* Copy button */}
            {!isUser && !isEditing && message.content && (
              <button
                onClick={copyToClipboard}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                title="Copy message"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}