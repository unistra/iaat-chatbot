/**
 * @jest-environment jsdom
 */
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
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
});