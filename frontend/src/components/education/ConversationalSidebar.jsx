import {
    MessageSquare,
    Plus,
    Trash2,
    Search,
} from "lucide-react";

import { useState } from "react";

function ConversationSidebar({

    conversations,

    activeId,

    onSelect,

    onNew,

    onDelete,

}) {

    const [search, setSearch] = useState("");

    const filtered = conversations.filter(

        (chat) =>

            chat.title

                .toLowerCase()

                .includes(

                    search.toLowerCase()

                )

    );

    return (

        <aside className="conversation-sidebar">

            <button

                className="new-conversation-btn"

                onClick={onNew}

            >

                <Plus size={18}/>

                New Chat

            </button>

            <div className="sidebar-search">

                <Search size={16}/>

                <input

                    placeholder="Search chats..."

                    value={search}

                    onChange={(e)=>

                        setSearch(

                            e.target.value

                        )

                    }

                />

            </div>

            <div className="conversation-list">

                {

                    filtered.map(

                        (chat)=>(

                            <div

                                key={chat.id}

                                className={`conversation-item ${

                                    activeId===chat.id

                                    ?

                                    "active"

                                    :

                                    ""

                                }`}

                                onClick={()=>

                                    onSelect(chat.id)

                                }

                            >

                                <div className="conversation-left">

                                    <MessageSquare

                                        size={18}

                                    />

                                    <span>

                                        {

                                            chat.title

                                        }

                                    </span>

                                </div>

                                <button

                                    className="delete-chat"

                                    onClick={(e)=>{

                                        e.stopPropagation();

                                        onDelete(

                                            chat.id

                                        );

                                    }}

                                >

                                    <Trash2 size={15}/>

                                </button>

                            </div>

                        )

                    )

                }

            </div>

        </aside>

    );

}

export default ConversationSidebar;