use async_trait::async_trait;
use futures::stream::BoxStream;
use serde_json::Value;
use crate::providers::{ChatMessage, ProviderConfig, ChatOptions};

#[derive(Debug, Clone)]
pub struct Usage {
    #[allow(dead_code)]
    pub prompt_tokens: Option<i32>,
    #[allow(dead_code)]
    pub completion_tokens: Option<i32>,
    #[allow(dead_code)]
    pub total_tokens: Option<i32>,
}

#[derive(Debug, Clone)]
pub enum ProviderEvent {
    /// A chunk of text content
    Content(String),
    /// A COMPLETE tool call (not a delta). 
    /// The provider adapter is responsible for assembling deltas.
    ToolCall(Value),
    /// Usage statistics
    #[allow(dead_code)]
    Usage(Usage),
    /// An error occurred
    Error(String),
}

#[async_trait]
pub trait LLMProvider: Send + Sync {
    /// Stream chat completion events
    async fn stream_chat(
        &self,
        config: &ProviderConfig,
        model: &str,
        messages: &[ChatMessage],
        tools: Option<Vec<Value>>,
        options: Option<ChatOptions>,
    ) -> anyhow::Result<BoxStream<'static, ProviderEvent>>;
}
