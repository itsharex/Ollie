import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useSettingsStore } from './settingsStore'
import { useModelsStore } from './modelsStore'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
  timestamp: number
  isStreaming?: boolean
}

export interface ChatOptions {
  temperature?: number
  topK?: number
  topP?: number
  maxTokens?: number
}

interface ChatState {
  messages: ChatMessage[]
  currentChatId: string | null
  currentModel: string
  isStreaming: boolean
  streamingMessageId: string | null
  currentStreamId: string | null  // Track current stream ID
  updateCounter: number  // Force re-render counter
  lastUpdate: number  // Timestamp for updates
  currentSystemPrompt: string | null

  // Actions
  setCurrentModel: (model: string) => void
  setCurrentChatId: (chatId: string | null) => void
  createNewChat: (opts?: { model?: string; systemPrompt?: string; paramsJson?: string }) => Promise<string | null>
  loadChat: (chatId: string, systemPrompt?: string | null) => Promise<boolean>
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string) => void
  updateStreamingMessage: (id: string, content: string) => void
  setStreaming: (isStreaming: boolean, messageId?: string, streamId?: string) => void
  sendMessage: (content: string, options?: ChatOptions, images?: string[]) => Promise<void>
  editUserMessage: (messageId: string, newContent: string) => Promise<void>
  stopStreaming: () => void
  clearMessages: () => void
  generateAutoTitle: (chatId: string, userContent: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentChatId: null,
  currentModel: '',
  isStreaming: false,
  streamingMessageId: null,
  currentStreamId: null,
  updateCounter: 0,
  lastUpdate: 0,
  currentSystemPrompt: null,

  setCurrentModel: (model) => set({ currentModel: model }),
  setCurrentChatId: (chatId) => set({ currentChatId: chatId }),

  createNewChat: async (opts) => {
    try {
      const res = await invoke<any>('db_create_chat', {
        model: (opts?.model ?? get().currentModel) || null,
        systemPrompt: opts?.systemPrompt ?? (useSettingsStore.getState().systemPrompt || null),
        paramsJson: opts?.paramsJson ?? null,
      })
      const chatId = res?.id as string
      // Store the system prompt in state so we use it immediately
      set({ currentChatId: chatId, messages: [], currentSystemPrompt: res?.system_prompt || null })
      return chatId
    } catch (e) {
      console.error('db_create_chat failed', e)
      return null
    }
  },

  loadChat: async (chatId: string, systemPrompt?: string | null) => {
    try {
      const state = get()
      if (state.isStreaming) {
        await state.stopStreaming()
      }
      set({ currentChatId: chatId, messages: [], currentSystemPrompt: systemPrompt || null })
      const rows = await invoke<any>('db_list_messages', { chatId, limit: 1000 })
      const msgs: ChatMessage[] = (rows as any[]).map((r) => {
        let images: string[] | undefined
        try {
          if (r.meta_json) {
            const meta = JSON.parse(r.meta_json)
            if (meta.images && Array.isArray(meta.images)) {
              images = meta.images
            }
          }
        } catch (e) { }

        return {
          id: r.id,
          role: (r.role as 'user' | 'assistant' | 'system'),
          content: r.content,
          images,
          timestamp: Number(r.created_at) || Date.now(),
        }
      })
      set({ messages: msgs })
      return true
    } catch (e) {
      console.error('db_list_messages failed', e)
      return false
    }
  },

  addMessage: (message) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newMessage: ChatMessage = {
      ...message,
      id,
      timestamp: Date.now(),
    }
    set((state) => ({ messages: [...state.messages, newMessage] }))
    return id
  },

  updateMessage: (id, content) => {
    set((state) => {
      const messageIndex = state.messages.findIndex(msg => msg.id === id)
      if (messageIndex === -1) {
        console.warn(`Message with id ${id} not found`)
        return state
      }

      // Create completely new array and objects to force React re-render
      const newMessages = state.messages.map((msg, index) => {
        if (index === messageIndex) {
          return {
            id: msg.id,
            role: msg.role,
            content: content,
            timestamp: msg.timestamp,
            isStreaming: false
          }
        }
        return { ...msg } // Also clone other messages to be safe
      })

      console.log('🔄 Force updating final message:', id, 'content length:', content.length)

      return {
        messages: newMessages,
        updateCounter: state.updateCounter + 1,
        lastUpdate: Date.now()
      }
    })
  },

  updateStreamingMessage: (id, content) => {
    set((state) => {
      const messageIndex = state.messages.findIndex(msg => msg.id === id)
      if (messageIndex === -1) {
        console.warn(`Streaming message with id ${id} not found`)
        return state
      }

      // Create completely new array and objects to force React re-render
      const newMessages = state.messages.map((msg, index) => {
        if (index === messageIndex) {
          return {
            id: msg.id,
            role: msg.role,
            content: content,
            timestamp: msg.timestamp,
            isStreaming: true
          }
        }
        return { ...msg } // Also clone other messages to be safe
      })

      console.log('🔄 Force updating streaming message:', id, 'content length:', content.length)

      return {
        messages: newMessages,
        updateCounter: state.updateCounter + 1,
        lastUpdate: Date.now()
      }
    })
  },

  setStreaming: (isStreaming, messageId, streamId) => {
    set({
      isStreaming,
      streamingMessageId: messageId || null,
      currentStreamId: streamId || null
    })
  },

  sendMessage: async (content: string, options?: ChatOptions, images?: string[]) => {
    const state = get()

    if (state.isStreaming) {
      console.warn('Already streaming, stopping current stream first')
      await state.stopStreaming()
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (!state.currentModel) {
      console.error('No model selected')
      return
    }

    // Ensure we have a chat in DB
    if (!state.currentChatId) {
      await get().createNewChat({ model: state.currentModel })
    }

    // Add user message (UI)
    state.addMessage({
      role: 'user',
      content: content.trim(),
      images,
    })
    // Persist user message
    const chatId = get().currentChatId
    if (chatId) {
      try {
        // Ensure chat has model set in DB
        if (state.currentModel) {
          invoke('db_set_chat_model', { chatId, model: state.currentModel }).catch(() => { })
        }

        const metaJson = images && images.length > 0 ? JSON.stringify({ images }) : null
        await invoke('db_append_message', { chatId, role: 'user', content: content.trim(), metaJson })
        // Inform listeners (Sidebar) to refresh chats ordering
        window.dispatchEvent(new CustomEvent('chats-refresh'))
      } catch (e) {
        console.warn('db_append_message (user) failed', e)
      }
    }

    // Add assistant message placeholder
    const assistantMessageId = state.addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    let currentStreamId: string | null = null
    // Don't set streaming yet - wait for event listeners

    let unlistenChunk: (() => void) | null = null
    let unlistenError: (() => void) | null = null
    let unlistenComplete: (() => void) | null = null
    let unlistenStreamStart: (() => void) | null = null
    let unlistenCancelled: (() => void) | null = null

    const cleanup = () => {
      console.log('Cleaning up event listeners for message:', assistantMessageId)
      if (unlistenChunk) unlistenChunk()
      if (unlistenError) unlistenError()
      if (unlistenComplete) unlistenComplete()
      if (unlistenStreamStart) unlistenStreamStart()
      if (unlistenCancelled) unlistenCancelled()
    }

    try {
      let persisted = false
      console.log('Setting up event listeners for message:', assistantMessageId)
      // Listen for stream start to get stream ID
      unlistenStreamStart = await listen('chat:stream-start', (event: any) => {
        const { stream_id } = event.payload as { stream_id: string }
        console.log('Stream started with ID:', stream_id)
        currentStreamId = stream_id
        const currentState = get()
        currentState.setStreaming(true, assistantMessageId, stream_id)
      })

      // Listen for cancellation
      unlistenCancelled = await listen('chat:cancelled', (event: any) => {
        const { stream_id } = event.payload as { stream_id: string }
        console.log('Stream cancelled:', stream_id)
        if (stream_id === currentStreamId) {
          const currentState = get()
          currentState.setStreaming(false)
          cleanup()
        }
      })
      // Set up event listeners for streaming
      unlistenChunk = await listen('chat:chunk', (event: any) => {
        const chunk = event.payload as { message?: { role?: string; content?: string }; done?: boolean }
        console.log('🟢 CHUNK RECEIVED for message:', assistantMessageId, 'chunk:', chunk)

        // Only process chunks for the currently streaming assistant message
        const currentState = get()
        if (currentState.streamingMessageId !== assistantMessageId) {
          console.warn('⚠️ Ignoring chunk from different message stream')
          return
        }

        const part = chunk?.message?.content ?? ''
        if (part.length > 0) {
          const currentMessage = currentState.messages.find(m => m.id === assistantMessageId)
          if (currentMessage) {
            const newContent = (currentMessage.content || '') + part
            console.log('📝 Updating message content, total length:', newContent.length)
            currentState.updateStreamingMessage(assistantMessageId, newContent)
          } else {
            console.error('❌ Could not find message with ID:', assistantMessageId)
          }
        }

        // If the provider sends a done=true with no content, we must still finalize
        if (chunk?.done) {
          console.log('✅ Chunk marked as done, stopping stream (finalize message)')
          const finalState = get()
          finalState.setStreaming(false)
          const currentMessage = finalState.messages.find(m => m.id === assistantMessageId)
          if (currentMessage) {
            finalState.updateMessage(assistantMessageId, currentMessage.content || '')
            // Persist assistant message once
            if (!persisted && chatId) {
              invoke('db_append_message', { chatId, role: 'assistant', content: currentMessage.content || '', metaJson: null })
                .then(() => window.dispatchEvent(new CustomEvent('chats-refresh')))
                .catch((e) => console.warn('db_append_message (assistant) failed', e))
              persisted = true
            }
          }

          // Check triggers (in case complete event is skipped/too late)
          const stateAfter = get()
          if (stateAfter.messages.length <= 5 && chatId) {
            const userMsg = stateAfter.messages.find(m => m.role === 'user')
            if (userMsg && !stateAfter.currentSystemPrompt?.includes('Generate a short')) {
              stateAfter.generateAutoTitle(chatId, userMsg.content).catch(console.error)
            }
          }

          cleanup()
        }
      })

      unlistenError = await listen('chat:error', (event: any) => {
        console.error('Chat error:', event.payload)
        const payload = event.payload as { stream_id?: string; error?: string }
        if (payload?.stream_id && payload.stream_id !== currentStreamId) {
          console.warn('Ignoring error from different stream:', payload.stream_id)
          return
        }
        state.setStreaming(false)

        // Don't replace content if we already have some response
        const currentMessage = get().messages.find(m => m.id === assistantMessageId)
        if (currentMessage && currentMessage.content.trim()) {
          // Just stop streaming, keep existing content
          state.updateMessage(assistantMessageId, currentMessage.content)
        } else {
          // No content yet, show error
          state.updateMessage(assistantMessageId, `Error: ${payload?.error || 'Failed to get response from model'}`)
        }
        cleanup()
      })

      unlistenComplete = await listen('chat:complete', (event: any) => {
        const payload = event.payload as { completed: boolean; stream_id?: string }
        console.log('Stream completion event:', payload)

        // Only process completion for the current stream
        if (payload.stream_id && payload.stream_id !== currentStreamId) {
          console.warn('Ignoring completion from different stream:', payload.stream_id)
          return
        }

        if (!payload.completed) {
          console.warn('Stream completed but not successfully')
        }

        // Always stop streaming when we get completion signal for our stream
        const currentState = get()
        if (currentState.isStreaming && currentState.streamingMessageId === assistantMessageId) {
          console.log('Stopping stream due to completion event')
          currentState.setStreaming(false)

          // Remove isStreaming flag from the message using updateMessage
          const currentMessage = currentState.messages.find(m => m.id === assistantMessageId)
          if (currentMessage) {
            currentState.updateMessage(assistantMessageId, currentMessage.content)
            // Persist assistant message once if not yet persisted
            if (!persisted && chatId) {
              invoke('db_append_message', { chatId, role: 'assistant', content: currentMessage.content || '', metaJson: null })
                .then(() => window.dispatchEvent(new CustomEvent('chats-refresh')))
                .catch((e) => console.warn('db_append_message (assistant) failed', e))
              persisted = true
            }
          }
        }
        cleanup()

        // Check triggers
        const finalState = get()
        if (finalState.messages.length <= 5 && chatId) {
          const userMsg = finalState.messages.find(m => m.role === 'user')
          if (userMsg && !finalState.currentSystemPrompt?.includes('Generate a short')) {
            // Avoid recursion
            finalState.generateAutoTitle(chatId, userMsg.content).catch(console.error)
          }
        }
      })

      // NOW set streaming state after all listeners are ready (before invoke)
      state.setStreaming(true, assistantMessageId)

      // Prepare messages for API from a fresh snapshot to avoid stale state
      const latest = get()
      const apiMessages = latest.messages
        .filter(msg => msg.role !== 'assistant' || msg.content.trim() !== '')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          images: msg.images,
        }))

      // Inject system prompt if it exists
      const freshState = get()
      if (freshState.currentSystemPrompt) {
        apiMessages.unshift({ role: 'system', content: freshState.currentSystemPrompt, images: undefined })
      }

      // Send the chat request
      await invoke('chat_stream', {
        request: {
          model: state.currentModel,
          messages: apiMessages,
          stream: true,
          options: options ? {
            temperature: options.temperature,
            top_k: options.topK,
            top_p: options.topP,
            max_tokens: options.maxTokens,
          } : undefined,
        },
      })

      // Add a timeout safety net
      setTimeout(() => {
        const currentState = get()
        if (currentState.isStreaming && currentState.streamingMessageId === assistantMessageId) {
          currentState.setStreaming(false)
          cleanup()
        }
      }, 60000) // 60 second timeout

    } catch (error) {
      console.error('Failed to send message:', error)
      state.setStreaming(false)
      state.updateMessage(assistantMessageId, `Error: ${error}`)
      cleanup()
    }
  },

  editUserMessage: async (messageId: string, newContent: string) => {
    const state = get()
    if (state.isStreaming) {
      await state.stopStreaming()
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const msgIndex = state.messages.findIndex(m => m.id === messageId)
    if (msgIndex === -1) {
      console.error('Message to edit not found')
      return
    }

    const message = state.messages[msgIndex]
    const chatId = state.currentChatId

    if (!chatId) {
      console.error('No current chat ID')
      return
    }

    // 1. Update Database
    try {
      await invoke('db_update_message', { id: messageId, content: newContent })
      // Delete all messages after this one (maintain context consistency)
      await invoke('db_delete_messages_after', { chatId, timestamp: message.timestamp })
    } catch (e) {
      console.error('Failed to update/truncate DB for edit:', e)
      return
    }

    // 2. Update Local State
    // Truncate messages to just include this one and prior ones
    const truncatedMessages = state.messages.slice(0, msgIndex + 1)
    // Update content of the edited message
    truncatedMessages[msgIndex] = { ...message, content: newContent }

    set({ messages: truncatedMessages })

    // 3. Trigger Generation (Re-use logic from sendMessage mostly)

    // Add assistant message placeholder
    const assistantMessageId = state.addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    let currentStreamId: string | null = null

    // --- Listener Implementation (Duplicate of sendMessage) ---
    // Ideally this should be refactored into a reusable `generateResponse` function

    let unlistenChunk: (() => void) | null = null
    let unlistenError: (() => void) | null = null
    let unlistenComplete: (() => void) | null = null
    let unlistenStreamStart: (() => void) | null = null
    let unlistenCancelled: (() => void) | null = null

    const cleanup = () => {
      console.log('Cleaning up event listeners for message:', assistantMessageId)
      if (unlistenChunk) unlistenChunk()
      if (unlistenError) unlistenError()
      if (unlistenComplete) unlistenComplete()
      if (unlistenStreamStart) unlistenStreamStart()
      if (unlistenCancelled) unlistenCancelled()
    }

    try {
      let persisted = false

      unlistenStreamStart = await listen('chat:stream-start', (event: any) => {
        const { stream_id } = event.payload as { stream_id: string }
        currentStreamId = stream_id
        get().setStreaming(true, assistantMessageId, stream_id)
      })

      unlistenCancelled = await listen('chat:cancelled', (event: any) => {
        const { stream_id } = event.payload as { stream_id: string }
        if (stream_id === currentStreamId) {
          get().setStreaming(false)
          cleanup()
        }
      })

      unlistenChunk = await listen('chat:chunk', (event: any) => {
        const chunk = event.payload as { message?: { role?: string; content?: string }; done?: boolean }
        const currentState = get()
        if (currentState.streamingMessageId !== assistantMessageId) return

        const part = chunk?.message?.content ?? ''
        if (part.length > 0) {
          const currentMessage = currentState.messages.find(m => m.id === assistantMessageId)
          if (currentMessage) {
            currentState.updateStreamingMessage(assistantMessageId, (currentMessage.content || '') + part)
          }
        }

        if (chunk?.done) {
          const finalState = get()
          finalState.setStreaming(false)
          const currentMessage = finalState.messages.find(m => m.id === assistantMessageId)
          if (currentMessage) {
            finalState.updateMessage(assistantMessageId, currentMessage.content || '')
            if (!persisted && chatId) {
              invoke('db_append_message', { chatId, role: 'assistant', content: currentMessage.content || '', metaJson: null })
                .then(() => window.dispatchEvent(new CustomEvent('chats-refresh')))
                .catch((e) => console.warn('db_append_message (assistant) failed', e))
              persisted = true
            }
          }
          cleanup()
        }
      })

      unlistenError = await listen('chat:error', (event: any) => {
        const payload = event.payload as { stream_id?: string; error?: string }
        if (payload?.stream_id && payload.stream_id !== currentStreamId) return

        const st = get()
        st.setStreaming(false)
        const currentMessage = st.messages.find(m => m.id === assistantMessageId)
        if (currentMessage && !currentMessage.content) {
          st.updateMessage(assistantMessageId, `Error: ${payload?.error || 'Failed'}`)
        }
        cleanup()
      })

      unlistenComplete = await listen('chat:complete', (event: any) => {
        const payload = event.payload as { completed: boolean; stream_id?: string }
        if (payload.stream_id && payload.stream_id !== currentStreamId) return

        const st = get()
        if (st.isStreaming && st.streamingMessageId === assistantMessageId) {
          st.setStreaming(false)
          const currentMessage = st.messages.find(m => m.id === assistantMessageId)
          if (currentMessage) {
            st.updateMessage(assistantMessageId, currentMessage.content)
            if (!persisted && chatId) {
              invoke('db_append_message', { chatId, role: 'assistant', content: currentMessage.content || '', metaJson: null })
                .then(() => window.dispatchEvent(new CustomEvent('chats-refresh')))
                .catch((e) => console.warn('db_append_message (assistant) failed', e))
              persisted = true
            }
          }
        }
        cleanup()
      })

      get().setStreaming(true, assistantMessageId)

      // Prepare messages
      const latest = get()
      const apiMessages = latest.messages
        .filter(msg => msg.role !== 'assistant' || msg.content.trim() !== '')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          images: msg.images,
        }))

      const freshState = get()
      if (freshState.currentSystemPrompt) {
        apiMessages.unshift({ role: 'system', content: freshState.currentSystemPrompt, images: undefined })
      }

      await invoke('chat_stream', {
        request: {
          model: state.currentModel,
          messages: apiMessages,
          stream: true,
          options: undefined // Use defaults for edit regenerate for now
        },
      })

    } catch (error) {
      console.error('Failed to regenerate message:', error)
      get().setStreaming(false)
      get().updateMessage(assistantMessageId, `Error: ${error}`)
      cleanup()
    }
  },

  stopStreaming: async () => {
    const state = get()
    if (state.isStreaming) {
      try {
        await invoke('abort_chat')
        state.setStreaming(false)
      } catch (error) {
        console.error('Failed to stop streaming:', error)
        // Force stop anyway
        state.setStreaming(false)
      }
    }
  },

  clearMessages: () => {
    set({ messages: [], isStreaming: false, streamingMessageId: null })
  },

  generateAutoTitle: async (chatId, userContent) => {
    const state = get()
    if (!state.currentModel) return

    // Check if title already exists to avoid double generation
    // We can't easily check DB here without query, but we can rely on frontend state not having title?
    // Actually, let's just proceed. The last write wins.

    const context = userContent.slice(0, 500)

    // Select the best model for titling (prefer text models over vision/small models if available)
    const { models } = useModelsStore.getState()
    // Prioritize fast, instruction-following models. Avoid reasoning models (r1) if possible for this simple task.
    const preferredTextModels = ['llama3.2', 'mistral', 'gemma2', 'qwen2.5-coder', 'qwen2.5', 'llama3.1', 'phi', 'tinyllama']

    let titleModel = state.currentModel

    // If current model is likely a VLM or very small, try to find a better text model
    const isVLM = ['moondream', 'llava', 'vl'].some(k => state.currentModel.includes(k))

    if (isVLM) {
      // Try to find a non-reasoning model first
      let betterModel = models.find(m =>
        preferredTextModels.some(p => m.name.includes(p)) && !m.name.includes('r1')
      )

      // Fallback to reasoning models if no other choice (e.g. only deepseek-r1 installed)
      if (!betterModel) {
        betterModel = models.find(m => preferredTextModels.some(p => m.name.includes(p)) || m.name.includes('deepseek'))
      }

      if (betterModel) {
        titleModel = betterModel.name
        console.log('🧠 Switching to better text model for titling:', titleModel)
      }
    }

    let titleAccumulator = ''
    let titleStreamId: string | null = null
    let isDone = false

    // Create a promise that resolves when generation is done
    await new Promise<void>(async (resolvePromise) => {
      let unlistenChunk: (() => void) | null = null
      let unlistenStart: (() => void) | null = null
      let timeout: any = null

      const cleanup = () => {
        if (timeout) clearTimeout(timeout)
        if (unlistenChunk) unlistenChunk()
        if (unlistenStart) unlistenStart()
      }

      // Wrap resolve to cleanup
      const resolve = () => {
        cleanup()
        resolvePromise()
      }

      unlistenChunk = await listen('chat:chunk', (event: any) => {
        const chunk = event.payload as { stream_id?: string; message?: { content?: string }; done?: boolean }
        if (chunk.stream_id && chunk.stream_id === titleStreamId) {
          if (chunk.message?.content) {
            titleAccumulator += chunk.message.content
          }
          if (chunk.done) {
            isDone = true
            resolve()
          }
        }
      })

      unlistenStart = await listen('chat:stream-start', (event: any) => {
        const payload = event.payload as { stream_id: string }
        if (!titleStreamId) {
          titleStreamId = payload.stream_id
        }
      })

      // Timeout safety (60s)
      timeout = setTimeout(() => {
        if (!isDone) {
          console.warn('⚠️ Auto-Title: Timed out')
          resolve()
        }
      }, 60000)

      try {
        await invoke('chat_stream', {
          request: {
            model: titleModel,
            messages: [
              { role: 'system', content: 'Generate a very short title (3-5 words) for the user message. Output ONLY the title text. Do not use quotes.' },
              { role: 'user', content: `Message: "${context}"` }
            ],
            stream: true,
            // DeepSeek R1 needs more tokens to "think", even for short answers
            options: { temperature: 0.7, max_tokens: titleModel.includes('thinking') || titleModel.includes('r1') ? 2048 : 256 }
          }
        })
      } catch (e) {
        console.error('Auto-title invoke failed', e)
        resolve()
      }
    })

    // Helper to strip <think> tags (common in reasoning models)
    const stripThinkTags = (text: string) => {
      return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }

    // Process result
    let cleanTitle = stripThinkTags(titleAccumulator).replace(/["']/g, '').trim()

    // Fallback logic: if empty, try to derive from text manually
    if (!cleanTitle && context.length > 0) {
      // Very basic fallback
      cleanTitle = context.split(' ').slice(0, 4).join(' ') + '...'
    }

    if (cleanTitle) {
      await invoke('db_set_chat_title', { chatId, title: cleanTitle })
      window.dispatchEvent(new CustomEvent('chats-refresh'))
    }
  }
}))