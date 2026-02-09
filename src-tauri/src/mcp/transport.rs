use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use anyhow::{Result, Context};
use serde_json::Value;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest_eventsource::{Event, EventSource, RequestBuilderExt};

// ============================================================================
// Stdio Transport
// ============================================================================

pub struct StdioTransport {
    process: Child,
    reader: BufReader<tokio::process::ChildStdout>,
    writer: tokio::process::ChildStdin,
}

impl StdioTransport {
    pub fn new(command: &str, args: &[String]) -> Result<Self> {
        let mut process = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .context(format!("Failed to spawn command: {}", command))?;

        let stdin = process.stdin.take().context("Failed to open stdin")?;
        let stdout = process.stdout.take().context("Failed to open stdout")?;
        let reader = BufReader::new(stdout);

        Ok(Self {
            process,
            reader,
            writer: stdin,
        })
    }

    pub async fn send(&mut self, message: Value) -> Result<()> {
        let json = serde_json::to_string(&message)?;
        self.writer.write_all(json.as_bytes()).await?;
        self.writer.write_all(b"\n").await?;
        self.writer.flush().await?;
        Ok(())
    }

    pub async fn receive(&mut self) -> Result<Option<Value>> {
        let mut line = String::new();
        let bytes_read = self.reader.read_line(&mut line).await?;
        if bytes_read == 0 {
            return Ok(None);
        }
        let message: Value = serde_json::from_str(&line).context("Failed to parse JSON")?;
        Ok(Some(message))
    }

    #[allow(dead_code)]
    pub async fn close(&mut self) -> Result<()> {
        self.process.kill().await?;
        Ok(())
    }
}

// ============================================================================
// SSE Transport
// ============================================================================

pub struct SseTransport {
    event_source: EventSource,
    client: reqwest::Client,
    post_url: Option<String>,
    headers: HeaderMap,
}

impl SseTransport {
    pub fn new(url: &str, auth_token: Option<String>) -> Result<Self> {
        let mut headers = HeaderMap::new();
        if let Some(token) = auth_token {
            let mut val = HeaderValue::from_str(&format!("Bearer {}", token))?;
            val.set_sensitive(true);
            headers.insert(AUTHORIZATION, val);
        }

        let client = reqwest::Client::new();
        let event_source = client.get(url)
            .headers(headers.clone())
            .eventsource()?;

        Ok(Self {
            event_source,
            client,
            post_url: None,
            headers,
        })
    }

    pub async fn send(&mut self, message: Value) -> Result<()> {
        if let Some(url) = &self.post_url {
            self.client.post(url)
                .headers(self.headers.clone())
                .json(&message)
                .send()
                .await?
                .error_for_status()?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("No POST endpoint discovered yet"))
        }
    }

    pub async fn receive(&mut self) -> Result<Option<Value>> {
        while let Some(event) = self.event_source.next().await {
            match event {
                Ok(Event::Open) => continue,
                Ok(Event::Message(message)) => {
                    // Check for endpoint event first
                    if message.event == "endpoint" {
                        self.post_url = Some(message.data.trim().to_string());
                        continue;
                    }
                    // Try to parse as JSON-RPC message
                    if let Ok(val) = serde_json::from_str::<Value>(&message.data) {
                        return Ok(Some(val));
                    }
                }
                Err(e) => return Err(anyhow::anyhow!("SSE Error: {}", e)),
            }
        }
        Ok(None)
    }

    #[allow(dead_code)]
    pub async fn close(&mut self) -> Result<()> {
        self.event_source.close();
        Ok(())
    }
}

// ============================================================================
// Transport Enum (Compiler-recommended approach for dyn compatibility)
// ============================================================================

pub enum Transport {
    Stdio(StdioTransport),
    Sse(SseTransport),
}

impl Transport {
    pub async fn send(&mut self, message: Value) -> Result<()> {
        match self {
            Transport::Stdio(t) => t.send(message).await,
            Transport::Sse(t) => t.send(message).await,
        }
    }

    pub async fn receive(&mut self) -> Result<Option<Value>> {
        match self {
            Transport::Stdio(t) => t.receive().await,
            Transport::Sse(t) => t.receive().await,
        }
    }

    #[allow(dead_code)]
    pub async fn close(&mut self) -> Result<()> {
        match self {
            Transport::Stdio(t) => t.close().await,
            Transport::Sse(t) => t.close().await,
        }
    }
}
