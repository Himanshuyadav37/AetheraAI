import {
  createContext,
  useContext,
  useState
} from "react";

import api from "../services/api";

const ChatContext =
  createContext();

export function ChatProvider({
  children
}) {

  const [
    conversationId,
    setConversationId
  ] = useState(null);

  const [
    messages,
    setMessages
  ] = useState([]);

  const [
    selectedConversation,
    setSelectedConversation
  ] = useState(null);

  const [
    currentAgent,
    setCurrentAgent
  ] = useState(
    "conversational"
  );

  /* ===========================
     Global Refresh
  =========================== */

  const [
    refreshKey,
    setRefreshKey
  ] = useState(0);

  function refreshApp() {

    setRefreshKey(
      prev => prev + 1
    );

  }

  /* ===========================
     New Chat
  =========================== */

  function newChat() {

    setConversationId(
      null
    );

    setMessages([]);

    setSelectedConversation(
      null
    );

  }

  /* ===========================
     Load Conversation
  =========================== */

  async function loadConversation(
    id
  ) {

    try {

      const response =
        await api.get(
          `/conversations/${id}`
        );

      console.log(
        response.data
      );

      setConversationId(
        id
      );

      setCurrentAgent(
        response.data.agent_type
      );

      setSelectedConversation(
        response.data
      );

      setMessages(
        response.data.messages || []
      );

    }

    catch (error) {

      console.error(
        error
      );

    }

  }

  return (

    <ChatContext.Provider

      value={{

        conversationId,

        setConversationId,

        messages,

        setMessages,

        selectedConversation,

        setSelectedConversation,

        currentAgent,

        setCurrentAgent,

        refreshKey,

        refreshApp,

        newChat,

        loadConversation

      }}

    >

      {children}

    </ChatContext.Provider>

  );

}

export function useChat() {

  return useContext(
    ChatContext
  );

}