function AgentSelector({

  agentType,

  setAgentType

}) {

  const agents = [

    {
      id: "engineer",
      label: "Engineer"
    },

    {
      id: "conversational",
      label: "Conversational"
    },

    {
      id: "research",
      label: "Research"
    },

    {
      id: "education",
      label: "Education"
    },

    {
      id: "automation",
      label: "Automation"
    }

  ];

  return (

    <div className="agent-selector">

      <label>

        AI Mode

      </label>

      <div className="agent-modes">

        {

          agents.map(agent => (

            <button

              key={agent.id}

              className={

                agentType === agent.id

                  ? "mode-btn active"

                  : "mode-btn"

              }

              onClick={() =>

                setAgentType(

                  agent.id

                )

              }

            >

              {agent.label}

            </button>

          ))

        }

      </div>

    </div>

  );

}

export default AgentSelector;