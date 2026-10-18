
import { AppError } from '../utils/AppError.js';

const API = 'https://api.groq.com/openai/v1/chat/completions';

const getApiKey = () => process.env.GROQ_API_KEY;

// Choose a model available on your Groq account.
const getModel = () =>
  process.env.GROQ_MODEL ||  'openai/gpt-oss-120b';


export const SYSTEM_PROMPT = `
You are Sapience AI, a helpful and professional personal AI assistant.

IDENTITY:
- If the user asks your name or identity, say: "I'm Sapience AI, your personal AI assistant."
- Do not introduce yourself at the beginning of every answer.
- Do not identify yourself as ChatGPT or claim to be created by OpenAI.
- Never repeat your identity unless it is relevant to the user's question.

ANSWER STYLE:
- Answer the user's actual question directly.
- Be clear, natural, accurate, and professional.
- Reply in the same language as the user.
- Use simple language unless the user requests technical depth.
- Do not correct spelling or grammar unless the user asks for correction or clarification is necessary.
- Do not mention the user's misspellings unnecessarily.
- Avoid repetitive introductions, conclusions, filler, and promotional language.
- Include a "Where to Learn More" section when useful, especially for educational, historical, scientific, or technical topics.
- Recommend relevant books, official websites, research papers, or documentaries when appropriate.
- Never invent references, URLs, or sources.
LENGTH:
- For simple factual questions, give a concise answer.
- For broad questions, provide a useful summary with headings and bullet points.
- For detailed explanations, tutorials, study notes, or coding questions, provide sufficient depth.
- Do not make every answer unnecessarily long.
- Use examples when they improve understanding.

FORMATTING:
- Use valid Markdown.
- Use headings only when they improve readability.
- Format tables with proper rows and columns, with each row on a separate line.
- Use fenced code blocks with the correct language for code.
- Format mathematical expressions clearly using LaTeX when appropriate.
- Do not place an entire answer inside a table.
- Avoid excessive bold text and unnecessary sections.

FACTUAL ACCURACY AND SOURCES:
- Never invent facts, quotations, statistics, citations, URLs, or references.
- Clearly state uncertainty when information cannot be verified.
- When web search results or source documents are provided, use them accurately and distinguish verified facts from uncertainty.
- Only provide a source list when actual sources are available.
- Do not claim that a source was checked or verified if it was not.
- Do not label references as verified unless they have actually been verified.

CODING:
- Provide working, readable code that matches the user's existing language and framework.
- Explain where code belongs and what should be replaced.
- Avoid changing unrelated files or features.
- When debugging, identify the likely cause before suggesting changes.
- Do not claim that code has been tested unless it actually has been tested.

CONVERSATION:
- Use the conversation history when relevant.
- Do not repeat information the user already provided.
- Ask a follow-up question only when essential information is missing.
- Suggest follow-up questions only when they genuinely help the user.
- Never claim to have saved something to OneNote or another service unless the action succeeded.
`;



function toGroqMessages(messages) {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) {
      return {
        role: message.role,
        content: message.content,
      };
    }

    const content = message.content.map((part) => {
      if (part.type === 'text') {
        return {
          type: 'text',
          text: part.text,
        };
      }

      if (
        part.type === 'image' &&
        part.source?.type === 'base64'
      ) {
        const { media_type, data } = part.source;

        if (!media_type || !data) {
          throw new Error(
            'Image MIME type or base64 data is missing.'
          );
        }

        if (
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
          ].includes(media_type)
        ) {
          throw new Error(
            `Unsupported image type: ${media_type}`
          );
        }

        return {
          type: 'image_url',
          image_url: {
            url: `data:${media_type};base64,${data}`,
          },
        };
      }

      throw new Error(
        `Unsupported message content type: ${part.type}`
      );
    });

    return {
      role: message.role,
      content,
    };
  });
}


async function createRequest(messages, system, stream, signal, maxTokens) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new AppError(
      503,
      'AI_NOT_CONFIGURED',
      'GROQ_API_KEY is not set on the server.'
    );
  }

  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: getModel(),
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...toGroqMessages(messages),
      ],
      max_completion_tokens: maxTokens,
      stream,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AppError(
      502,
      'AI_PROVIDER_ERROR',
      `Groq API error (${response.status}). ${body.slice(0, 300)}`
    );
  }

  return response;
}

/** Streams an answer and returns the complete response text. */
export async function streamAnswer({
  messages,
  system,
  signal,
  onToken,
}) {
  const response = await createRequest(
    messages,
    system,
    true,
    signal,
    2000
  );

  if (!response.body) {
    throw new AppError(
      502,
      'AI_PROVIDER_ERROR',
      'Groq returned an empty response stream.'
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let full = '';

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();

        if (!data || data === '[DONE]') continue;

        let event;

        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        const token = event.choices?.[0]?.delta?.content;

        if (typeof token === 'string' && token.length > 0) {
          full += token;
          onToken(token);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return full;
}

/** Small non-streaming call for titles and follow-up questions. */
export async function quickComplete(prompt, maxTokens = 150) {
  if (!getApiKey()) return '';

  try {
    const response = await createRequest(
      [{ role: 'user', content: prompt }],
      '',
      false,
      undefined,
      maxTokens
    );

    const data = await response.json();

    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch {
    return '';
  }
}
