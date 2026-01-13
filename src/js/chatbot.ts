import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Configuration to override marked and open links in new windows.
 */
marked.use({
  renderer: {
    link(this: any, link: { href: string; title?: string | null; text: string }) {
      const titleAttr = link.title ? ` title="${link.title}"` : '';
      return `<a href="${link.href}"${titleAttr} target="_blank" rel="noopener noreferrer">${link.text}</a>`;
    }
  }
});

/**
 * Represents the main Chatbot application logic and UI interactions.
 */
class IaatChatbot {
  /**
   * @typedef {object} ChatMessage
   * @property {string} role - 'user' | 'assistant' | 'error'
   * @property {string} content - The message content, can include markdown for assistant messages.
   */
  conversation: Array<{ role: 'user' | 'assistant' | 'error'; content: string }>;

  /**
   * The key used to store and retrieve the conversation from localStorage.
   * @type {string}
   */
  CONVERSATION_STORAGE_KEY: string;

  /**
   * The main container for the chatbot UI.
   * @type {HTMLElement|null}
   */
  chatbotContainer: HTMLElement | null;

  /**
   * @param {object} [options] - Configuration options for the chatbot.
   * @param {string} [options.proxyUrl] - The URL of the backend proxy.
   * @param {string} [options.openByDefault] - Whether the chat should be open by default.
   * @param {number} [options.maxConversationLength] - Maximum number of messages to send to the backend.
   * @param {string} [options.welcomeMessage] - The initial welcome message.
   */
  options!: {
    proxyUrl?: string;
    openByDefault?: string;
    maxConversationLength?: number;
    welcomeMessage?: string;
    accessKey?: string | null;
  };

  /**
   * Initializes the Chatbot instance.
   * @param {string} containerId - The ID of the main chatbot container element.
   * @param {object} [options] - Configuration options for the chatbot.
   */
  constructor(containerId: string, options: object = {}) {
    /**
     * Stores the entire conversation history.
     * @type {Array<ChatMessage>}
     */
    this.conversation = [];

    /**
     * The key used to store and retrieve the conversation from localStorage.
     * @type {string}
     */
    this.CONVERSATION_STORAGE_KEY = 'chatbotConversation';

    /**
     * The main container for the chatbot UI.
     * @type {HTMLElement|null}
     */
    this.chatbotContainer = document.getElementById(containerId);
    if (!this.chatbotContainer) {
      console.error(`Chatbot container #${containerId} not found!`);
      return;
    }

    this.options = {
      proxyUrl: '/api/chat',
      openByDefault: 'false',
      maxConversationLength: 10,
      welcomeMessage: 'Welcome!',
      accessKey: null,
      ...options,
    };

    this.initEventListeners();
    this.addMessage('assistant', this.options.welcomeMessage || '', false);
    this.loadConversation();

    if (this.options.openByDefault === 'true') {
      this.toggleChat(false);
    }
  }

  /**
   * Initializes all necessary DOM event listeners for the chatbot UI.
   * @returns {void}
   */
  initEventListeners(): void {
    /** @type {HTMLButtonElement|null|undefined} */
    const chatToggle = this.chatbotContainer?.querySelector<HTMLButtonElement>('.cb-chat-toggle');
    /** @type {HTMLFormElement|null|undefined} */
    const chatForm = this.chatbotContainer?.querySelector<HTMLFormElement>('.cb-chat-form');
    /** @type {HTMLTextAreaElement|null|undefined} */
    const userInput = this.chatbotContainer?.querySelector<HTMLTextAreaElement>('.cb-chat-input');
    /** @type {HTMLButtonElement|null|undefined} */
    const closeChat = this.chatbotContainer?.querySelector<HTMLButtonElement>('.cb-close-chat');
    /** @type {HTMLButtonElement|null|undefined} */
    const clearChatButton = this.chatbotContainer?.querySelector<HTMLButtonElement>('.cb-clear-chat');

    if (chatToggle) chatToggle.addEventListener('click', () => this.toggleChat(false));
    if (closeChat) closeChat.addEventListener('click', () => this.toggleChat(true));
    if (clearChatButton) clearChatButton.addEventListener('click', () => this.clearConversation());

    if (chatForm) {
      chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        this.handleUserMessage();
      });
    }

    if (userInput) {
      userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          this.handleUserMessage();
        }
      });
      userInput.addEventListener('input', () => this.autoExpandTextarea(userInput));
      this.autoExpandTextarea(userInput); // Initial adjustment
    }
  }

  /**
   * Saves the current conversation to localStorage.
   * @returns {void}
   */
  saveConversation(): void {
    try {
      localStorage.setItem(this.getConversationStorageKey(), JSON.stringify(this.getConversation()));
    } catch (e) {
      console.error('Error saving conversation to localStorage:', e);
    }
  }

  /**
   * Loads the conversation from localStorage and renders it.
   * @returns {boolean} True if a conversation was loaded, false otherwise.
   */
  loadConversation(): boolean {
    try {
      const storedConversation = localStorage.getItem(this.getConversationStorageKey());
      if (storedConversation) {
        this.setConversation(JSON.parse(storedConversation));
        this.getConversation().forEach(msg => this.addMessage(msg.role, msg.content, false));
        return true;
      }
    } catch (e) {
      console.error('Error loading conversation from localStorage:', e);
      localStorage.removeItem(this.getConversationStorageKey());
    }
    return false;
  }

  /**
   * Clears the conversation history, localStorage, and re-displays the welcome message.
   * @returns {void}
   */
  clearConversation(): void {
    this.setConversation([]);
    localStorage.removeItem(this.getConversationStorageKey());
    /** @type {HTMLDivElement|null|undefined} */
    const messagesDiv = this.chatbotContainer?.querySelector<HTMLDivElement>('.cb-chat-messages');
    if (messagesDiv) messagesDiv.innerHTML = '';
    this.addMessage('assistant', this.options?.welcomeMessage || '', false);
  }

  /**
   * Toggles the chat window's visibility.
   * @param {boolean} [forceState] - If true, forces the chat to close. If false, forces it to open.
   * @returns {void}
   */
  toggleChat(forceState?: boolean): void {
    if (!this.chatbotContainer) return;
    /** @type {HTMLDivElement|null} */
    const chatPopup = this.chatbotContainer.querySelector<HTMLDivElement>('.cb-chat-popup');
    /** @type {HTMLButtonElement|null} */
    const chatToggle = this.chatbotContainer.querySelector<HTMLButtonElement>('.cb-chat-toggle');
    const isActive = forceState !== undefined ? forceState : chatPopup?.classList.contains('active');
    chatPopup?.classList.toggle('active', !isActive);
    chatToggle?.classList.toggle('hidden', !isActive);

    // If the chat is now active (opened), focus the input
    /** @type {HTMLTextAreaElement|null} */
    const userInput = this.chatbotContainer.querySelector<HTMLTextAreaElement>('.cb-chat-input');
    if (!isActive && userInput) userInput.focus();
  }

  /**
   * Adds a message to the chat window.
   * @param {string} role - The role of the sender ('user', 'assistant', or 'error').
   * @param {string} content - The HTML content of the message.
   * @param {boolean} [save] - Whether to save the conversation to localStorage after adding the message.
   * @returns {void}
   */
  addMessage(role: 'user' | 'assistant' | 'error', content: string, save = true): void {
    if (!this.chatbotContainer) return;
    /** @type {HTMLDivElement|null} */
    const messagesDiv = this.chatbotContainer.querySelector<HTMLDivElement>('.cb-chat-messages');
    const messageClass = role === 'user' ? 'cb-user-message' : (role === 'error' ? 'cb-error' : 'cb-bot-message');

    const messageElement = document.createElement('div');
    messageElement.className = `cb-message ${messageClass}`;

    let renderedContent = content;
    if (role === 'assistant') renderedContent = marked.parse(content) as string;

    messageElement.innerHTML = DOMPurify.sanitize(renderedContent, {
      ADD_ATTR: ['target', 'rel'], // authorize target and rel
    });
    messagesDiv?.appendChild(messageElement);
    if (messagesDiv) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      });
    }

    if (save) this.saveConversation();
  }

  /**
   * Shows or hides the typing indicator in the chat.
   * @param {boolean} show - Whether to show or hide the indicator.
   * @returns {void}
   */
  toggleTypingIndicator(show: boolean): void {
    if (!this.chatbotContainer) return;
    /** @type {HTMLDivElement|null} */
    const messagesDiv = this.chatbotContainer.querySelector<HTMLDivElement>('.cb-chat-messages');
    /** @type {HTMLDivElement|null} */
    let typingIndicator = this.chatbotContainer.querySelector<HTMLDivElement>('#typing-indicator');

    if (show) {
      if (!typingIndicator) {
        typingIndicator = document.createElement('div');
        typingIndicator.id = 'typing-indicator';
        typingIndicator.className = 'cb-message cb-bot-message';
        typingIndicator.innerHTML = '<span class="typing-text">🤖<span class="dots"></span></span>';
        messagesDiv?.appendChild(typingIndicator);
      }
    } else {
      typingIndicator?.remove();
    }

    if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  /**
   * Automatically expands the textarea height based on content, up to a max of 5 rows.
   * @param {HTMLTextAreaElement} textarea - The textarea element to expand.
   * @returns {void}
   */
  autoExpandTextarea(textarea: HTMLTextAreaElement): void {
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 18;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;

    const minHeight = lineHeight * 2 + paddingTop + paddingBottom;
    const maxHeight = lineHeight * 10 + paddingTop + paddingBottom;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(newHeight, minHeight)}px`;
  }

  /**
   * Handles the entire process of sending a user message and receiving a response.
   * This includes updating the UI, interacting with the API, and managing conversation history.
   * @returns {Promise<void>}
   */
  async handleUserMessage(): Promise<void> {
    if (!this.chatbotContainer) return;
    /** @type {HTMLTextAreaElement|null} */
    const input = this.chatbotContainer.querySelector<HTMLTextAreaElement>('.cb-chat-input');
    /** @type {HTMLButtonElement|null} */
    const sendButton = this.chatbotContainer?.querySelector<HTMLButtonElement>('.cb-chat-send-button');

    const message = input?.value.trim();
    if (!message || !input) return;

    input.disabled = true;
    if (sendButton) sendButton.disabled = true;

    this.addMessage('user', message);
    this.setConversation([...this.getConversation(), { role: 'user', content: message }]);
    input.value = '';
    this.autoExpandTextarea(input);

    this.toggleTypingIndicator(true);

    try {
      const currentConversation = this.getConversation();
      const conversationToSend = currentConversation.slice(Math.max(currentConversation.length - (this.options?.maxConversationLength || 0), 0));

      /** @type {{ 'Content-Type': string; [key: string]: string }} */
      const headers: { [key: string]: string } = { 'Content-Type': 'application/json' };
      if (this.options?.accessKey) headers['Authorization'] = `Bearer ${this.options.accessKey}`;

      const response = await fetch(this.options?.proxyUrl || '', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: conversationToSend }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '(No response from API)';

      this.setConversation([...this.getConversation(), { role: 'assistant', content: reply }]);
      this.addMessage('assistant', reply);
      this.saveConversation();
    } catch (error) {
      console.error('Error during API call:', error);
      this.addMessage('error', '<strong>Error:</strong> Could not contact the assistant. Please try again later.');
    } finally {
      this.toggleTypingIndicator(false);
      input.disabled = false;
      if (sendButton) sendButton.disabled = false;
      input.focus();
    }
  }

  /**
   * Updates the proxy URL for future API calls.
   * @param {string} newUrl - The new proxy URL to use.
   * @returns {void}
   */
  public setProxyUrl(newUrl: string): void {
    if (this.options) {
      this.options.proxyUrl = newUrl;
    }
  }

  /**
   * Returns the current conversation history.
   * @returns {Array<ChatMessage>} The conversation array.
   */
  getConversation(): Array<{ role: 'user' | 'assistant' | 'error'; content: string }> {
    return this.conversation;
  }

  /**
   * Sets the conversation history to a new value.
   * @param {Array<ChatMessage>} newConversation - The new conversation array.
   * @returns {void}
   */
  setConversation(newConversation: Array<{ role: 'user' | 'assistant' | 'error'; content: string }>): void {
    this.conversation = newConversation;
  }

  /**
   * Returns the key used for storing the conversation in localStorage.
   * @returns {string} The localStorage key.
   */
  getConversationStorageKey(): string {
    return this.CONVERSATION_STORAGE_KEY;
  }
}

/** @type {any} */
(window as any).IaatChatbot = IaatChatbot;

export default IaatChatbot;
