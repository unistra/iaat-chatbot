/**
 * @jest-environment jsdom
 */
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require('util');
  global.TextEncoder = NodeTextEncoder;
  global.TextDecoder = NodeTextDecoder;
}

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve({ choices: [{ message: { content: 'Bot response' } }] }),
  })
);

describe('Chatbot UI functions', () => {
  let chatPopup, chatToggle, chatMessages, userInput;
  let chatbotInstance;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="iaat-chatbot">
        <button class="cb-chat-toggle"></button>
        <div class="cb-chat-popup">
          <header class="cb-chat-header">
            <span>🤖 Chatbot</span>
            <div class="cb-chat-header-buttons">
              <button class="cb-clear-chat"></button>
              <button class="cb-close-chat"></button>
            </div>
          </header>
          <main class="cb-chat-messages"></main>
          <form class="cb-chat-form">
            <textarea class="cb-chat-input"></textarea>
            <button type="submit" class="cb-chat-send-button"></button>
          </form>
        </div>
      </div>
    `;

    jest.resetModules();
    require('./chatbot.ts'); // Execute the file to make Chatbot available globally
    const IaatChatbot = global.IaatChatbot; // Access IaatChatbot from the global scope

    // Directly instantiate the IaatChatbot class with options
    chatbotInstance = new IaatChatbot('iaat-chatbot', {
      proxyUrl: 'http://localhost:8000/chat',
      openByDefault: 'false',
      maxConversationLength: 4,
      welcomeMessage: 'Welcome!',
    });

    // Assign DOM elements after Chatbot constructor has run
    const chatbotContainer = document.getElementById('iaat-chatbot');
    chatPopup = chatbotContainer.querySelector('.cb-chat-popup');
    chatToggle = chatbotContainer.querySelector('.cb-chat-toggle');
    chatMessages = chatbotContainer.querySelector('.cb-chat-messages');
    userInput = chatbotContainer.querySelector('.cb-chat-input');

    // Clear conversation and DOM for a clean test state
    chatbotInstance.setConversation([]);
    chatMessages.innerHTML = '';
    jest.clearAllMocks();
  });

  test('toggleChat should toggle active and hidden classes', () => {
    chatbotInstance.toggleChat(false);
    expect(chatPopup.classList.contains('active')).toBe(true);
    expect(chatToggle.classList.contains('hidden')).toBe(true);
    chatbotInstance.toggleChat(true);
    expect(chatPopup.classList.contains('active')).toBe(false);
    expect(chatToggle.classList.contains('hidden')).toBe(false);
  });

  test('addMessage should add a user message', () => {
    chatbotInstance.addMessage('user', 'Hello user');
    expect(chatMessages.children.length).toBe(1);
    expect(chatMessages.children[0].textContent).toBe('Hello user');
  });

  test('addMessage should add a bot message', () => {
    chatbotInstance.addMessage('assistant', 'Hello bot');
    expect(chatMessages.children.length).toBe(1);
  });

  test('toggleTypingIndicator should show and hide indicator', () => {
    chatbotInstance.toggleTypingIndicator(true);
    expect(document.querySelector('#typing-indicator')).not.toBeNull();
    chatbotInstance.toggleTypingIndicator(false);
    expect(document.querySelector('#typing-indicator')).toBeNull();
  });

  test('handleUserMessage should send message and get response', async () => {
    userInput.value = 'Test message';
    await chatbotInstance.handleUserMessage();
    expect(chatMessages.children.length).toBe(2);
    expect(chatbotInstance.getConversation()).toEqual([
      { role: 'user', content: 'Test message' },
      { role: 'assistant', content: 'Bot response' },
    ]);
    expect(userInput.value).toBe('');
  });

  test('handleUserMessage should handle API error', async () => {
    global.fetch.mockImplementationOnce(() => Promise.reject(new Error('API Error')));
    userInput.value = 'Error message';
    await chatbotInstance.handleUserMessage();
    expect(chatMessages.children.length).toBe(2);
    expect(chatMessages.lastChild.textContent).toContain('Error');
  });

  test('handleUserMessage should truncate conversation history', async () => {
    chatbotInstance.setConversation([
      { role: 'user', content: '1' }, { role: 'assistant', content: '2' },
      { role: 'user', content: '3' }, { role: 'assistant', content: '4' },
      { role: 'user', content: '5' }, { role: 'assistant', content: '6' },
    ]);
    userInput.value = 'New message';
    await chatbotInstance.handleUserMessage();
    const sentMessages = JSON.parse(global.fetch.mock.calls[0][1].body).messages;
    expect(sentMessages.length).toBe(chatbotInstance.options.maxConversationLength);
    expect(sentMessages[sentMessages.length - 2].content).toBe('6');
    expect(chatbotInstance.getConversation().length).toBe(8);
  });

  test('getConversation should return the conversation', () => {
    const conv = [{ role: 'user', content: 'test' }];
    chatbotInstance.setConversation(conv);
    expect(chatbotInstance.getConversation()).toBe(conv);
  });

  test('setConversation should update the conversation', () => {
    const newConv = [{ role: 'assistant', content: 'new' }];
    chatbotInstance.setConversation(newConv);
    expect(chatbotInstance.getConversation()).toEqual(newConv);
  });

  test('getConversationStorageKey should return the correct key', () => {
    expect(chatbotInstance.getConversationStorageKey()).toBe('chatbotConversation');
  });

  test('assistant message links should open in new tab', () => {
    const markdownLink = '[Click me](https://example.com)';
    chatbotInstance.addMessage('assistant', markdownLink);
    const message = chatMessages.lastElementChild;
    expect(message).not.toBeNull();
    const link = message.querySelector('a');
    expect(link).not.toBeNull();
    expect(link.href).toBe('https://example.com/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  test('should scroll to top of the newly added assistant message', () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    let scrollIntoViewCalled = false;
    HTMLElement.prototype.scrollIntoView = function() {
      scrollIntoViewCalled = true;
    };
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb();
        return 0;
      });
    chatbotInstance.addMessage('assistant', 'Scroll test');
    expect(scrollIntoViewCalled).toBe(true);
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    rafSpy.mockRestore();
  });
});

describe('Chatbot streaming responses', () => {
  const DONE_MARKER = ['[', 'DO', 'NE', ']'].join('');
  let chatMessages, userInput;
  let chatbotInstance;
  let originalScrollIntoView;
  let rafSpy;

  const sseResponse = (events) => {
    const encoder = new TextEncoder();
    let index = 0;
    return {
      ok: true,
      headers: { get: () => 'text/event-stream' },
      body: {
        getReader: () => ({
          read: () => Promise.resolve(
            index < events.length
              ? { done: false, value: encoder.encode(events[index]) }
              : { done: true, value: undefined }
          ).then((result) => {
            index += 1;
            return result;
          })
        }),
      },
    };
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="iaat-chatbot">
        <button class="cb-chat-toggle"></button>
        <div class="cb-chat-popup">
          <header class="cb-chat-header">
            <span>🤖 Chatbot</span>
            <div class="cb-chat-header-buttons">
              <button class="cb-clear-chat"></button>
              <button class="cb-close-chat"></button>
            </div>
          </header>
          <main class="cb-chat-messages"></main>
          <form class="cb-chat-form">
            <textarea class="cb-chat-input"></textarea>
            <button type="submit" class="cb-chat-send-button"></button>
          </form>
        </div>
      </div>
    `;

    jest.resetModules();
    require('./chatbot.ts');
    const IaatChatbot = global.IaatChatbot;

    chatbotInstance = new IaatChatbot('iaat-chatbot', {
      proxyUrl: 'http://localhost:8000/chat',
      openByDefault: 'false',
      maxConversationLength: 4,
      welcomeMessage: 'Welcome!',
      stream: true,
    });

    const chatbotContainer = document.getElementById('iaat-chatbot');
    chatMessages = chatbotContainer.querySelector('.cb-chat-messages');
    userInput = chatbotContainer.querySelector('.cb-chat-input');

    chatbotInstance.setConversation([]);
    chatMessages.innerHTML = '';

    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = jest.fn();
    rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb();
        return 0;
      });

    jest.clearAllMocks();
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    rafSpy.mockRestore();
  });

  test('handleUserMessage should send stream: true in the request body', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve(sseResponse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n']))
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sentBody.stream).toBe(true);
    expect(sentBody.messages).toHaveLength(1);
  });

  test('streamed chunks should render as a single assistant message', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
          `data: ${DONE_MARKER}\n\n`,
        ])
      )
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    const botMessages = chatMessages.querySelectorAll('.cb-bot-message');
    expect(botMessages.length).toBe(1);
    expect(botMessages[0].textContent).toContain('Hello world');
    expect(chatbotInstance.getConversation()).toEqual([
      { role: 'user', content: 'Stream test' },
      { role: 'assistant', content: 'Hello world' },
    ]);
  });

  test('SSE events split across network chunks should be reassembled', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"cont',
          'ent":"lo"}}]}\n\n',
        ])
      )
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    const botMessages = chatMessages.querySelectorAll('.cb-bot-message');
    expect(botMessages.length).toBe(1);
    expect(botMessages[0].textContent).toContain('Hello');
    expect(chatbotInstance.getConversation()[1].content).toBe('Hello');
  });

  test('malformed SSE data lines should be ignored', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          'data: {not valid json}\n\n',
          'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        ])
      )
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    const botMessages = chatMessages.querySelectorAll('.cb-bot-message');
    expect(botMessages.length).toBe(1);
    expect(botMessages[0].textContent).toContain('ok');
  });

  test('mid-stream error should keep the partial content and show an error', async () => {
    const encoder = new TextEncoder();
    const goodChunk = encoder.encode('data: {"choices":[{"delta":{"content":"Part"}}]}\n\n');
    let step = 0;
    const reader = {
      read: () => {
        step += 1;
        if (step === 1) return Promise.resolve({ done: false, value: goodChunk });
        if (step === 2) return Promise.reject(new Error('network down'));
        return Promise.resolve({ done: true, value: undefined });
      },
    };
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, headers: { get: () => 'text/event-stream' }, body: { getReader: () => reader } })
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    const botMessages = chatMessages.querySelectorAll('.cb-bot-message');
    expect(botMessages.length).toBe(1);
    expect(botMessages[0].textContent).toContain('Part');
    expect(chatbotInstance.getConversation()[1]).toEqual({ role: 'assistant', content: 'Part' });
    expect(chatMessages.lastElementChild.textContent).toContain('Error');
  });

  test('should fall back to JSON response when there is no stream body', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        body: null,
        json: () => Promise.resolve({ choices: [{ message: { content: 'JSON reply' } }] }),
      })
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    expect(chatbotInstance.getConversation()).toEqual([
      { role: 'user', content: 'Stream test' },
      { role: 'assistant', content: 'JSON reply' },
    ]);
  });

  test('should use the JSON path when the backend ignores streaming', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        body: {},
        json: () => Promise.resolve({ choices: [{ message: { content: 'Plain reply' } }] }),
      })
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    expect(chatbotInstance.getConversation()).toEqual([
      { role: 'user', content: 'Stream test' },
      { role: 'assistant', content: 'Plain reply' },
    ]);
  });

  test('an empty stream should show the no-response fallback', async () => {
    global.fetch.mockImplementationOnce(() => Promise.resolve(sseResponse([`data: ${DONE_MARKER}\n\n`])));
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    const botMessages = chatMessages.querySelectorAll('.cb-bot-message');
    expect(botMessages.length).toBe(1);
    expect(botMessages[0].textContent.trim()).toBe('(No response from API)');
    expect(chatbotInstance.getConversation()[1].content).toBe('(No response from API)');
  });

  test('the typing indicator should be hidden once the stream renders its first chunk', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Live"}}]}\n\n',
        ])
      )
    );
    userInput.value = 'Stream test';
    await chatbotInstance.handleUserMessage();
    expect(document.querySelector('#typing-indicator')).toBeNull();
    const botMessages = chatMessages.querySelectorAll('.cb-bot-message');
    expect(botMessages.length).toBe(1);
    expect(botMessages[0].textContent).toContain('Live');
  });
});
