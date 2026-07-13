import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nexusai_education_conversations";

export default function useConversation() {

    const [conversations, setConversations] = useState([]);

    const [activeId, setActiveId] = useState(null);

    // ==========================================
    // Load Conversations
    // ==========================================

    useEffect(() => {

        try {

            const saved = localStorage.getItem(STORAGE_KEY);

            if (!saved) return;

            const chats = JSON.parse(saved);

            if (!Array.isArray(chats)) return;

            setConversations(chats);

            if (chats.length > 0) {

                setActiveId(chats[0].id);

            }

        }

        catch (err) {

            console.error(err);

        }

    }, []);

    // ==========================================
    // Save Conversations
    // ==========================================

    useEffect(() => {

        localStorage.setItem(

            STORAGE_KEY,

            JSON.stringify(conversations)

        );

    }, [conversations]);

    // ==========================================
    // Create Conversation
    // ==========================================

    function createConversation(

        title = "New Chat"

    ) {

        const chat = {

            id: crypto.randomUUID(),

            title,

            createdAt: Date.now(),

            updatedAt: Date.now(),

            messages: [

                {

                    id: crypto.randomUUID(),

                    role: "assistant",

                    title: "NexusAI Education AI",

                    mode: "learn",

                    content:
`# 👋 Welcome

Ask me anything.

I can help you with:

- 📘 Learn
- 💻 Coding
- 📝 Exams
- 🎯 Quiz
- 📄 Notes
- 🗺 Roadmaps
- 🎤 Interview`

                }

            ]

        };

        setConversations(prev => [

            chat,

            ...prev,

        ]);

        setActiveId(chat.id);

        return chat.id;

    }

    // ==========================================
    // Delete Conversation
    // ==========================================

    function deleteConversation(id) {

        setConversations(prev => {

            const updated = prev.filter(

                c => c.id !== id

            );

            if (

                activeId === id

            ) {

                setActiveId(

                    updated.length

                        ? updated[0].id

                        : null

                );

            }

            return updated;

        });

    }

    // ==========================================
    // Rename
    // ==========================================

    function renameConversation(

        id,

        title

    ) {

        setConversations(prev =>

            prev.map(chat =>

                chat.id === id

                    ? {

                        ...chat,

                        title,

                        updatedAt: Date.now(),

                    }

                    : chat

            )

        );

    }

    // ==========================================
    // Update Messages
    // ==========================================

    function updateMessages(

        id,

        messages

    ) {

        setConversations(prev =>

            prev.map(chat =>

                chat.id === id

                    ? {

                        ...chat,

                        messages: [...messages],

                        updatedAt: Date.now(),

                    }

                    : chat

            )

        );

    }

    // ==========================================
    // Append Message
    // ==========================================

    function appendMessage(

        id,

        message

    ) {

        setConversations(prev =>

            prev.map(chat =>

                chat.id === id

                    ? {

                        ...chat,

                        messages: [

                            ...chat.messages,

                            message,

                        ],

                        updatedAt: Date.now(),

                    }

                    : chat

            )

        );

    }

    // ==========================================
    // Update Last Assistant Message
    // (Streaming)
    // ==========================================

    function updateLastAssistant(

        id,

        text

    ) {

        setConversations(prev =>

            prev.map(chat => {

                if (

                    chat.id !== id

                )

                    return chat;

                const msgs = [

                    ...chat.messages,

                ];

                for (

                    let i = msgs.length - 1;

                    i >= 0;

                    i--

                ) {

                    if (

                        msgs[i].role ===

                        "assistant"

                    ) {

                        msgs[i] = {

                            ...msgs[i],

                            content: text,

                        };

                        break;

                    }

                }

                return {

                    ...chat,

                    messages: msgs,

                    updatedAt: Date.now(),

                };

            })

        );

    }

    // ==========================================
    // Current Conversation
    // ==========================================

    const currentConversation = useMemo(

        () =>

            conversations.find(

                c => c.id === activeId

            ) || null,

        [

            conversations,

            activeId,

        ]

    );

    return {

        conversations,

        activeId,

        currentConversation,

        setActiveId,

        createConversation,

        deleteConversation,

        renameConversation,

        updateMessages,

        appendMessage,

        updateLastAssistant,

    };

}