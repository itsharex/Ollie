use async_trait::async_trait;
use futures::{stream::BoxStream, Stream};

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use std::collections::VecDeque;
use std::pin::Pin;
use std::task::{Context, Poll};
use crate::providers::traits::{LLMProvider, ProviderEvent, Usage};
use crate::providers::{ChatMessage, ProviderConfig, ChatOptions};

#[derive(Debug, Deserialize, Clone)]
struct OllamaMessage {
    #[allow(dead_code)]
    role: String,
    content: String,
    tool_calls: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize, Clone)]
struct OllamaResponse {
    message: Option<OllamaMessage>,
    done: bool,
    prompt_eval_count: Option<i32>,
    eval_count: Option<i32>,
    // timestamps...
}

pub struct OllamaProvider;

#[async_trait]
impl LLMProvider for OllamaProvider {
    async fn stream_chat(
        &self,
        config: &ProviderConfig,
        model: &str,
        messages: &[ChatMessage],
        tools: Option<Vec<serde_json::Value>>,
        options: Option<ChatOptions>,
    ) -> anyhow::Result<BoxStream<'static, ProviderEvent>> {
        let url = config.get_base_url();
        let endpoint = format!("{}/api/chat", url);
        
        // Use a default client or one from config
        let client = Client::builder().build()?;
        
        let mut final_messages = messages.to_vec();
        let has_tools = tools.as_ref().map(|t| !t.is_empty()).unwrap_or(false);

        let mut payload = json!({
            "model": model,
            "stream": true,
        });
        
        if let Some(ref t) = tools {
            if !t.is_empty() {
                // Inject System Prompt for tool usage support on small models
                let instruction = "\nYou have access to tools/functions. If the user asks for something that requires a tool, please use the available tools to verify or retrieve information. Ensure you use the correct tool name and arguments.";

                if let Some(first) = final_messages.first_mut() {
                    if first.role == "system" {
                        first.content.push_str(instruction);
                    } else {
                        final_messages.insert(0, ChatMessage {
                            role: "system".to_string(),
                            content: instruction.trim().to_string(),
                            images: None,
                            tool_calls: None,
                            tool_call_id: None,
                        });
                    }
                } else {
                     final_messages.push(ChatMessage {
                            role: "system".to_string(),
                            content: instruction.trim().to_string(),
                            images: None,
                            tool_calls: None,
                            tool_call_id: None,
                        });
                }
                
                payload["tools"] = json!(t);
            }
        }

        payload["messages"] = json!(final_messages);
        
        if let Some(ref opts) = options {
             let mut options_map = serde_json::Map::new();
             if let Some(temp) = opts.temperature { 
                 options_map.insert("temperature".to_string(), json!(temp)); 
             }
             if let Some(top_k) = opts.top_k { 
                 options_map.insert("top_k".to_string(), json!(top_k)); 
             }
             if let Some(top_p) = opts.top_p { 
                 options_map.insert("top_p".to_string(), json!(top_p)); 
             }
             if let Some(max_tokens) = opts.max_tokens { 
                 options_map.insert("num_predict".to_string(), json!(max_tokens)); 
             }
             payload["options"] = json!(options_map);
        }

        let response = client.post(&endpoint)
            .json(&payload)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            
            // Check if the error is about tools not being supported
            if has_tools && text.contains("does not support tools") {
                // Retry without tools - rebuild payload without tools field
                let mut retry_payload = json!({
                    "model": model,
                    "stream": true,
                    "messages": json!(messages), // Use original messages without tool instruction
                });
                
                if let Some(ref opts) = options {
                    let mut options_map = serde_json::Map::new();
                    if let Some(temp) = opts.temperature { 
                        options_map.insert("temperature".to_string(), json!(temp)); 
                    }
                    if let Some(top_k) = opts.top_k { 
                        options_map.insert("top_k".to_string(), json!(top_k)); 
                    }
                    if let Some(top_p) = opts.top_p { 
                        options_map.insert("top_p".to_string(), json!(top_p)); 
                    }
                    if let Some(max_tokens) = opts.max_tokens { 
                        options_map.insert("num_predict".to_string(), json!(max_tokens)); 
                    }
                    retry_payload["options"] = json!(options_map);
                }
                
                let retry_response = client.post(&endpoint)
                    .json(&retry_payload)
                    .send()
                    .await?;
                
                if !retry_response.status().is_success() {
                    let retry_text = retry_response.text().await.unwrap_or_default();
                    return Err(anyhow::anyhow!("Ollama error: {}", retry_text));
                }
                
                // Create stream with a warning message prepended
                let warning_msg = format!("**Note:** The model `{}` does not support MCP tools. Continuing without tool access.\n\n", model);
                let stream = retry_response.bytes_stream();
                return Ok(Box::pin(OllamaStream::new_with_warning(Box::pin(stream), warning_msg)));
            }
            
            return Err(anyhow::anyhow!("Ollama error: {}", text));
        }

        let stream = response.bytes_stream();
        Ok(Box::pin(OllamaStream::new(Box::pin(stream))))
    }
}

struct OllamaStream {
    inner: Pin<Box<dyn Stream<Item = reqwest::Result<bytes::Bytes>> + Send>>,
    buffer: String,
    queue: VecDeque<ProviderEvent>,
}

impl OllamaStream {
    fn new(inner: Pin<Box<dyn Stream<Item = reqwest::Result<bytes::Bytes>> + Send>>) -> Self {
        Self {
            inner,
            buffer: String::new(),
            queue: VecDeque::new(),
        }
    }
    
    fn new_with_warning(inner: Pin<Box<dyn Stream<Item = reqwest::Result<bytes::Bytes>> + Send>>, warning: String) -> Self {
        let mut queue = VecDeque::new();
        queue.push_back(ProviderEvent::Content(warning));
        Self {
            inner,
            buffer: String::new(),
            queue,
        }
    }
    
    fn process_line(&mut self, line: &str) {
        if line.trim().is_empty() { return; }
        
        match serde_json::from_str::<OllamaResponse>(line) {
            Ok(chunk) => {
                if let Some(msg) = chunk.message {
                    // Emit content
                    if !msg.content.is_empty() {
                         self.queue.push_back(ProviderEvent::Content(msg.content));
                    }
                    
                    // Emit tool calls
                    if let Some(calls) = msg.tool_calls {
                        for call in calls {
                            self.queue.push_back(ProviderEvent::ToolCall(call));
                        }
                    }
                }
                
                if chunk.done {
                     // Emit usage
                     let usage = Usage {
                         prompt_tokens: chunk.prompt_eval_count,
                         completion_tokens: chunk.eval_count,
                         total_tokens: Some(chunk.prompt_eval_count.unwrap_or(0) + chunk.eval_count.unwrap_or(0)),
                     };
                     self.queue.push_back(ProviderEvent::Usage(usage));
                }
            }
            Err(_e) => {
                // Log error but don't crash stream yet?
                // self.queue.push_back(ProviderEvent::Error(format!("Parse error: {}", e)));
            }
        }
    }
}

impl Stream for OllamaStream {
    type Item = ProviderEvent;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        // 1. Drain queue
        if let Some(event) = self.queue.pop_front() {
            return Poll::Ready(Some(event));
        }
        
        // 2. Poll inner stream
        loop {
            match self.inner.as_mut().poll_next(cx) {
                Poll::Ready(Some(Ok(bytes))) => {
                    let s = String::from_utf8_lossy(&bytes);
                    self.buffer.push_str(&s);
                    
                    let mut processed_something = false;
                    while let Some(pos) = self.buffer.find('\n') {
                        let line = self.buffer[..pos].to_string();
                        self.buffer = self.buffer[pos+1..].to_string();
                        self.process_line(&line);
                        processed_something = true;
                    }
                    
                    if processed_something && !self.queue.is_empty() {
                         return Poll::Ready(Some(self.queue.pop_front().unwrap()));
                    }
                    // If we processed lines but queue is still empty (empty lines?), loop again
                }
                Poll::Ready(Some(Err(e))) => {
                    return Poll::Ready(Some(ProviderEvent::Error(e.to_string())));
                }
                Poll::Ready(None) => {
                    // End of stream. Process remaining buffer?
                    if !self.buffer.is_empty() {
                        let line = self.buffer.clone();
                        self.buffer.clear();
                        self.process_line(&line);
                        if !self.queue.is_empty() {
                             return Poll::Ready(Some(self.queue.pop_front().unwrap()));
                        }
                    }
                    return Poll::Ready(None);
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}
